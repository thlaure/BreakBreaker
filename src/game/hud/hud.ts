import type { Snapshot } from '../../sim/sim';
import type { SimEvent } from '../../sim/types';
import { BOOTH_TEXT_MS } from '../render/serviceMath';
import {
  AlertBanner,
  activeIncidents,
  alertFromEvent,
  guideMarks,
  hintIds,
  isNewAttack,
  type Box,
  type GuideMark,
  type Incident,
} from './alerts';
import { firstRuinHelp } from '../render/actionHintMath';
import { DEFAULT_ACT_LABEL, contextPrompt, hpLabel, incidentLines, roundPanel, type IncidentLine, type RoundPanel } from './format';
import { makeCard, renderCard, type Card } from './hudCards';
import { Cache, el } from './hudDom';
import { EdgeMarkers, type CameraView } from './hudEdges';
import { openIntro } from './hudIntro';
import { makeRound, renderRound, type RoundEls } from './hudRound';
import { StatsPanel } from './hudStats';

export type { CameraView } from './hudEdges';

/** How long the first-ruin help line stays (once per game). */
export const HELP_MS = 7000;
/** How long the red screen-edge glow of a new attack lasts (matches bb-glow in hud.css). */
const GLOW_MS = 700;
/** Touch buttons in the bottom-right corner (see play/index.html), kept clear of the edge indicators. */
const TOUCH_PAD_W = 200;
const TOUCH_PAD_H = 250;
/** How long « Énergie insuffisante » stays after a refused Furie / Onde. */
export const ENERGY_HINT_MS = 1200;
/** How far the score list's stepped border and drop shadow (box-shadow, see hud.css) reach past its box. */
const PANEL_SHADOW = { right: 8, bottom: 8 };

/**
 * HTML overlay `#hud`: score list (pixel font) and incident cards (top-left), contextual prompt under Paul, an alert banner when an
 * incident or round starts, one edge indicator per active incident whose target is off-screen, and the non-modal round
 * panel (top centre, under the banner and clear of the stats panel) during the breather between rounds.
 */
export class Hud {
  readonly root = el('div', 'bb-hud');
  private readonly c = new Cache();
  /** Screen-reader copy of Paul's health (the visible bar is drawn over his head in the world). */
  private readonly hp = el('div', 'bb-sr');
  private readonly statsPanel = new StatsPanel(this.c);
  /** « Énergie insuffisante » is showing (a refused Furie / Onde), until its timer clears it. */
  private refused = false;
  /** Until when (performance.now) a booth's call / refusal line shows under it: the prompt text steps aside. */
  private boothLineUntil = 0;
  private refusedTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly top = el('div', 'bb-top');
  private readonly cardsEl = el('div', 'bb-cards');
  private readonly cards = new Map<string, Card>();
  private readonly round: RoundEls;
  private readonly prompt = el('div', 'bb-prompt');
  private readonly edges = el('div', 'bb-edges');
  private readonly markers = new EdgeMarkers(this.edges, this.c);
  private readonly alert: AlertBanner;
  private readonly banner = el('div', 'bb-banner');
  private readonly bannerHint = el('span', 'hint');
  private readonly actBtn: HTMLElement | null;
  /** Touch Furie / Onde buttons: dim until available, glowing when ready. */
  private readonly furieBtn: HTMLElement | null;
  private readonly ondeBtn: HTMLElement | null;
  private readonly touchRoot: HTMLElement | null;
  /** Cached `.bb-top` / `.bb-tools` boxes (indicators and banner keep clear of them); refreshed on resize and card changes. */
  private topBox: Box | null = null;
  private toolsBox: Box | null = null;
  private readonly onResize = (): void => {
    this.topBox = null;
    this.toolsBox = null;
  };
  private lastNow = -1;
  private lastRescue = Number.POSITIVE_INFINITY;
  private rescueDrain: 'en cours' | 'interrompu' = 'en cours';

  /** Red screen-edge glow on each new attack. */
  private readonly glow = el('div', 'bb-glow');
  private glowTimer: ReturnType<typeof setTimeout> | null = null;
  /** One-line help the first time a ruin stands (once per game: this Hud lives as long as the game). */
  private readonly help = el('div', 'bb-help');
  private helpShown = false;
  private helpUntil = 0;

  private readonly tools = el('div', 'bb-tools');
  private intro: HTMLElement | null = null;
  private introCleanup: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    touchRoot: HTMLElement | null,
    private readonly opts: { onControls?: () => void } = {},
  ) {
    this.root.id = 'hud';
    this.root.hidden = true;
    const top = this.top;
    const hp = this.hp;
    hp.setAttribute('role', 'progressbar');
    hp.setAttribute('aria-valuemin', '0');
    top.append(hp, this.statsPanel.list, this.cardsEl);
    this.round = makeRound();
    this.prompt.hidden = true;
    this.prompt.setAttribute('aria-live', 'polite');
    this.banner.append(el('b', 'title', 'Renforts en approche !'), this.bannerHint);
    this.banner.hidden = true;
    this.banner.setAttribute('role', 'status');
    const cmd = el('button', 'bb-controls-btn', 'Commandes');
    cmd.type = 'button';
    cmd.setAttribute('aria-haspopup', 'dialog');
    cmd.setAttribute('aria-label', 'Commandes'); // keeps its name when it shrinks to a "?" on touch
    cmd.addEventListener('click', () => this.opts.onControls?.());
    this.tools.append(cmd);
    this.glow.hidden = true;
    this.glow.setAttribute('aria-hidden', 'true');
    this.help.hidden = true;
    this.help.setAttribute('role', 'status');
    this.root.append(this.glow, top, this.prompt, this.help, this.edges, this.banner, this.tools, this.round.root);
    this.alert = new AlertBanner(this.root);
    parent.append(this.root);
    this.touchRoot = touchRoot;
    this.actBtn = touchRoot?.querySelector<HTMLElement>('[data-action=act]') ?? null;
    if (this.actBtn) this.actBtn.style.display = 'none';
    this.furieBtn = touchRoot?.querySelector<HTMLElement>('[data-action=furie]') ?? null;
    this.ondeBtn = touchRoot?.querySelector<HTMLElement>('[data-action=onde]') ?? null;
    window.addEventListener('resize', this.onResize);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
    this.onResize();
  }

  /** Sim events of the frame: a new incident or round pops the alert banner; a refused Furie / Onde shows its hint. */
  onEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'EnergyRefused') this.showRefused();
      if (e.type === 'ServiceCalled' || e.type === 'ServiceRefused') this.boothLineUntil = performance.now() + BOOTH_TEXT_MS;
      const inc = alertFromEvent(e);
      if (inc) this.alert.push(inc);
    }
    if (events.some(isNewAttack)) this.flashGlow();
  }

  /** The red glow round the screen edges, restarted on each new attack (CSS; a soft static glow under reduced motion). */
  private flashGlow(): void {
    this.glow.hidden = false;
    this.glow.classList.remove('on');
    void this.glow.offsetWidth;
    this.glow.classList.add('on');
    if (this.glowTimer !== null) clearTimeout(this.glowTimer);
    this.glowTimer = setTimeout(() => {
      this.glow.hidden = true;
      this.glow.classList.remove('on');
      this.glowTimer = null;
    }, GLOW_MS);
  }

  /** The first time a ruin stands in this game: « Ramasse une caisse à outils, puis appuie sur F… » for HELP_MS. */
  private updateHelp(s: Snapshot, touch: boolean): void {
    const now = performance.now();
    if (!this.helpShown && !s.ended && s.targets.some((t) => t.state === 'ruined')) {
      this.helpShown = true;
      this.helpUntil = now + HELP_MS;
      this.c.text(this.help, firstRuinHelp(touch));
    }
    this.help.hidden = s.ended || now >= this.helpUntil;
  }

  /** « Énergie insuffisante » in the ÉNERGIE row for ENERGY_HINT_MS (a new refusal restarts it). */
  private showRefused(): void {
    this.refused = true;
    if (this.refusedTimer !== null) clearTimeout(this.refusedTimer);
    this.refusedTimer = setTimeout(() => {
      this.refused = false;
      this.refusedTimer = null;
    }, ENERGY_HINT_MS);
  }

  /**
   * Blocking card shown when the game launches: goal + the main keys, over a dimmed screen. The game waits (the caller
   * pauses the sim); any key, click or tap anywhere calls `onDismiss` (once) and closes it. `hideIntro` closes it silently.
   */
  showIntro(touch: boolean, onDismiss: () => void = () => undefined): void {
    this.hideIntro();
    const { veil, cleanup } = openIntro(touch, onDismiss, () => this.hideIntro());
    this.introCleanup = cleanup;
    this.intro = veil;
    this.root.append(veil);
  }

  hideIntro(): void {
    this.introCleanup?.();
    this.introCleanup = null;
    this.intro?.remove();
    this.intro = null;
  }

  destroy(): void {
    this.hideIntro();
    this.alert.destroy();
    if (this.refusedTimer !== null) clearTimeout(this.refusedTimer);
    if (this.glowTimer !== null) clearTimeout(this.glowTimer);
    for (const b of [this.furieBtn, this.ondeBtn]) b?.classList.remove('ready', 'dim');
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    if (this.actBtn) {
      this.actBtn.textContent = DEFAULT_ACT_LABEL;
      this.actBtn.style.display = 'none';
      this.actBtn.classList.remove('bb-act-ready');
    }
  }

  update(s: Snapshot, view: CameraView): void {
    const c = this.c;
    const touch = this.touchRoot?.classList.contains('visible') ?? false;
    this.updateHp(s);
    this.statsPanel.update(s);
    this.updateEnergy(s, touch);

    this.trackRescue(s);
    this.updateCards(incidentLines(s, this.rescueDrain), s);

    const cinematic = s.school.stage === 'cinematic' && !s.ended;
    this.banner.hidden = !cinematic;
    if (cinematic) c.text(this.bannerHint, touch ? 'Touchez l’écran pour passer' : 'Espace ou F pour passer');

    const p = cinematic ? null : contextPrompt(s, touch);
    // the booth's own line (under the booth, in the world) replaces the prompt text for a moment; Agir stays
    this.prompt.hidden = !p || performance.now() < this.boothLineUntil;
    c.text(this.prompt, p?.text ?? '');
    // the bubble above the target is the cue: the line under Paul stays for screen readers only
    c.cls(this.prompt, p?.inWorld ? 'bb-prompt bb-sr' : 'bb-prompt');
    if (this.actBtn) {
      // Only an actionable prompt (repair, put out a fire, a booth call) shows the touch Agir button, labelled with
      // the action and pulsing.
      c.style(this.actBtn, p?.label ? '' : 'display:none');
      c.text(this.actBtn, p?.label ?? DEFAULT_ACT_LABEL);
      this.actBtn.classList.toggle('bb-act-ready', !!p?.label);
    }

    const active = s.ended ? [] : activeIncidents(s);
    if (s.ended) this.alert.clear();
    else this.alert.prune(new Set([...active.map((i) => i.id), ...hintIds(s)]));
    this.alert.track(s.player.pos);
    this.placeAlert();
    this.updateRound(roundPanel(s));
    this.updateEdges(active, s, view, touch);
    this.updateGuides(guideMarks(s), s, view, touch);
    this.updateHelp(s, touch);
  }

  /**
   * The ÉNERGIE row (bar width, a pop when it fills, the state class: soft blink at the onde, gold blink when full, the
   * drain in mode furie; the refusal hint) and the touch Furie / Onde buttons (dim until available, `ready` glow).
   */
  private updateEnergy(s: Snapshot, touch: boolean): void {
    this.statsPanel.updateEnergy(s, touch, this.refused);
    const btn = (b: HTMLElement | null, ready: boolean, label: string): void => {
      if (!b) return;
      b.classList.toggle('ready', ready);
      b.classList.toggle('dim', !ready);
      const a = ready ? `${label} : disponible` : `${label} : énergie insuffisante`;
      if (b.getAttribute('aria-label') !== a) b.setAttribute('aria-label', a);
    };
    btn(this.furieBtn, s.energy.ready.furie && !s.furie && !s.player.ko, 'Furie');
    btn(this.ondeBtn, s.energy.ready.onde && !s.player.ko, 'Onde');
  }

  /** « Santé 85 sur 100 » for screen readers (progressbar, visually hidden). */
  private updateHp(s: Snapshot): void {
    const hp = Math.max(0, Math.ceil(s.hp));
    const label = hpLabel(s.hp, s.hpMax);
    if (this.hp.getAttribute('aria-label') === label) return;
    this.hp.setAttribute('aria-label', label);
    this.hp.setAttribute('aria-valuemax', String(s.hpMax));
    this.hp.setAttribute('aria-valuenow', String(hp));
    this.hp.textContent = label;
  }

  /** The snapshot has no rescue status: infer drain from the reserve between sim steps (kept while paused). */
  private trackRescue(s: Snapshot): void {
    if (!s.rescue) {
      this.lastRescue = Number.POSITIVE_INFINITY;
      return;
    }
    if (s.now !== this.lastNow) {
      if (s.rescue.remaining < this.lastRescue - 1e-9) this.rescueDrain = 'en cours';
      else if (this.lastRescue !== Number.POSITIVE_INFINITY) this.rescueDrain = 'interrompu';
      this.lastRescue = s.rescue.remaining;
    }
    this.lastNow = s.now;
  }

  /** One card per line, in order: created on first sight, removed once its incident is over. */
  private updateCards(lines: IncidentLine[], s: Snapshot): void {
    const keep = new Set<string>();
    lines.forEach((line, i) => {
      keep.add(line.key);
      let card = this.cards.get(line.key);
      if (!card) {
        card = makeCard();
        this.cards.set(line.key, card);
        this.topBox = null;
      }
      if (this.cardsEl.children[i] !== card.root) this.cardsEl.insertBefore(card.root, this.cardsEl.children[i] ?? null);
      renderCard(this.c, card, line, s);
    });
    for (const [key, card] of this.cards) {
      if (keep.has(key)) continue;
      card.root.remove();
      this.cards.delete(key);
      this.topBox = null;
    }
  }

  /** The breather's round panel: shown while `p` is non-null, never interactive (pointer-events: none). */
  private updateRound(p: RoundPanel | null): void {
    if (renderRound(this.c, this.round, p)) this.placeRound();
  }

  private boxes(): { top: Box; tools: Box } {
    const box = (e: HTMLElement): Box => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    if (!this.topBox) {
      // the score list's pixel border and hard drop shadow are box-shadows, outside its layout box
      const t = box(this.top);
      this.topBox = { ...t, right: t.right + PANEL_SHADOW.right, bottom: t.bottom + PANEL_SHADOW.bottom };
    }
    this.toolsBox ??= box(this.tools);
    return { top: this.topBox, tools: this.toolsBox };
  }

  /** Top centre, or just under the score list / Commandes button when the screen is too narrow to fit between. */
  private placeAlert(): void {
    const a = this.alert.el;
    if (a.hidden) return;
    const { top, tools } = this.boxes();
    const w = a.offsetWidth;
    const left = (window.innerWidth - w) / 2;
    const clash = left < top.right + 8 || left + w > tools.left - 8;
    this.c.style(a, clash ? `top:${Math.round(Math.max(top.bottom, tools.bottom) + 8)}px` : '');
  }

  /**
   * Round panel: top centre under the alert banner when one shows, or under the stats panel / Commandes button when the
   * screen is too narrow to fit between them (phones). Paul stays at the screen centre, below it.
   */
  private placeRound(): void {
    const p = this.round.root;
    const { top, tools } = this.boxes();
    const w = p.offsetWidth;
    const left = (window.innerWidth - w) / 2;
    const clash = left < top.right + 8 || left + w > tools.left - 8;
    let y = clash ? Math.max(top.bottom, tools.bottom) + 8 : 0;
    const a = this.alert.el;
    if (!a.hidden) y = Math.max(y, a.getBoundingClientRect().bottom + 12);
    this.c.style(p, y > 0 ? `top:${Math.round(y)}px` : '');
  }

  /** The boxes edge indicators keep clear of: the stats panel, the Commandes button, the touch controls. */
  private edgeAvoid(view: CameraView, touch: boolean): Box[] {
    const { top, tools } = this.boxes();
    const avoid: Box[] = [top, { left: tools.left, top: 0, right: view.width, bottom: tools.bottom }];
    if (touch) avoid.push({ left: view.width - TOUCH_PAD_W, top: view.height - TOUCH_PAD_H, right: view.width, bottom: view.height });
    return avoid;
  }

  /**
   * One pixel indicator per active incident, at the screen edge toward it, only while it is off-screen. A target under
   * attack pulses faster as its health falls (--pulse).
   */
  private updateEdges(list: Incident[], s: Snapshot, view: CameraView, touch: boolean): void {
    this.markers.updateEdges(list, s, view, this.edgeAvoid(view, touch));
  }

  /** Repair guidance (guideMarks): the ruins to rebuild or the toolboxes to fetch, at the screen edge while off-screen. */
  private updateGuides(list: GuideMark[], s: Snapshot, view: CameraView, touch: boolean): void {
    this.markers.updateGuides(list, s, view, this.edgeAvoid(view, touch));
  }
}
