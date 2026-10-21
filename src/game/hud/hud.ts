import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, Vec } from '../../sim/types';
import { CONTROLS, INTRO_ACTIONS, INTRO_GOAL } from '../../content/controls';
import {
  AlertBanner,
  activeIncidents,
  alertFromEvent,
  bearingDeg,
  edgePosition,
  formatMeters,
  hintIds,
  incidentAlert,
  incidentLook,
  pixelSvg,
  setArrow,
  type AlertIcon,
  type Box,
  type Incident,
} from './alerts';
import {
  DEFAULT_ACT_LABEL,
  ENERGY_REFUSED_HINT,
  contextPrompt,
  energyView,
  hpLabel,
  incidentLines,
  itemsLine,
  roundPanel,
  roundValue,
  waveLine,
  weaponValue,
  type IncidentLine,
  type RoundPanel,
} from './format';

export interface CameraView {
  /** World coordinates of the top-left corner of the visible area. */
  x: number;
  y: number;
  zoom: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
}

/** Half-size (px) of an edge indicator and its distance from the screen border. */
const EDGE_HALF: Vec = { x: 66, y: 20 };
const EDGE_PAD = 8;
/** Touch buttons in the bottom-right corner (see jouer/index.html), kept clear of the edge indicators. */
const TOUCH_PAD_W = 200;
const TOUCH_PAD_H = 250;
/** How long « Énergie insuffisante » stays after a refused Furie / Onde. */
export const ENERGY_HINT_MS = 1200;
/** How far the score list's stepped border and drop shadow (box-shadow, see hud.css) reach past its box. */
const PANEL_SHADOW = { right: 8, bottom: 8 };
const SLOTS = CONFIG.rock.maxCarried;
const TILE = CONFIG.tile;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

interface StatRow {
  li: HTMLElement;
  val: HTMLElement;
}

/** One row of the score list: small muted label, big bright value. */
function statRow(cls: string, label: string): StatRow {
  const li = el('li', `row ${cls}`);
  const val = el('span', 'val');
  li.append(el('span', 'lbl', label), val);
  return { li, val };
}

function aria(node: HTMLElement, label: string): void {
  if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
}

/** Writes to the DOM only when the value changed. */
class Cache {
  private readonly texts = new WeakMap<HTMLElement, string>();
  private readonly classes = new WeakMap<HTMLElement, string>();
  private readonly styles = new WeakMap<HTMLElement, string>();
  text(node: HTMLElement, value: string): void {
    if (this.texts.get(node) === value) return;
    this.texts.set(node, value);
    node.textContent = value;
  }
  cls(node: HTMLElement, value: string): void {
    if (this.classes.get(node) === value) return;
    this.classes.set(node, value);
    node.className = value;
  }
  style(node: HTMLElement, css: string): void {
    if (this.styles.get(node) === css) return;
    this.styles.set(node, css);
    node.style.cssText = css;
  }
}

interface Edge {
  root: HTMLElement;
  arrow: HTMLElement;
  dist: HTMLElement;
}

interface Card {
  root: HTMLElement;
  ico: HTMLElement;
  name: HTMLElement;
  time: HTMLElement;
  /** Mini health bar of an attacked target (hidden for the rescue). */
  bar: HTMLElement;
  fill: HTMLElement;
  status: HTMLElement;
  /** Rescue belongings progress (« Objets 1/3 rendus »), hidden otherwise. */
  items: HTMLElement;
  dist: HTMLElement;
}

/** The round panel's nodes; `objKey` is the objectives list last written (rebuilt only when it changes). */
interface RoundEls {
  root: HTMLElement;
  title: HTMLElement;
  kos: HTMLElement;
  obj: HTMLElement;
  points: HTMLElement;
  bonus: HTMLElement;
  heals: HTMLElement;
  count: HTMLElement;
  objKey: string;
}

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
  /** Score list (top-left, pixel font): one row per stat, in order. */
  private readonly stats = el('ul', 'bb-stats');
  private readonly score = statRow('score', 'SCORE');
  private readonly kos = statRow('kos', 'NEUTRALISÉS');
  private readonly wave = statRow('wave', 'MANCHE');
  private readonly rocks = statRow('rocks minor', 'PIERRES');
  private readonly weapon = statRow('weapon minor', 'ARME');
  /** The energy gauge: a segmented pixel bar (ticks at 50 % and 100 %) and what it allows (« ONDE · C », « FURIE · R »). */
  private readonly energy = statRow('energy minor', 'ÉNERGIE');
  private readonly energyBar = el('span', 'ebar');
  private readonly energyFill = el('span', 'efill');
  private readonly energyTag = el('span', 'etag');
  /** Gauge value last shown (the bar pops when it goes up). */
  private lastEnergy = Number.NaN;
  /** « Énergie insuffisante » is showing (a refused Furie / Onde), until its timer clears it. */
  private refused = false;
  private refusedTimer: ReturnType<typeof setTimeout> | null = null;
  /** Belongings Paul carries back to the rescue victim (hidden when none). */
  private readonly items = statRow('items minor', 'OBJETS');
  private readonly slots: HTMLElement[] = [];
  private readonly top = el('div', 'bb-top');
  private readonly cardsEl = el('div', 'bb-cards');
  private readonly cards = new Map<string, Card>();
  private readonly round: RoundEls;
  private readonly prompt = el('div', 'bb-prompt');
  private readonly edges = el('div', 'bb-edges');
  private readonly edgeEls = new Map<string, Edge>();
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
  /** Round number last shown (the row pulses once when it changes). */
  private lastWave = -1;
  /** Score last shown (its value pops when it goes up). */
  private lastScore = Number.NaN;
  private lastRescue = Number.POSITIVE_INFINITY;
  private rescueDrain: 'en cours' | 'interrompu' = 'en cours';

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
    for (let i = 0; i < SLOTS; i++) {
      const slot = el('span', 'slot', '○');
      this.slots.push(slot);
      this.rocks.val.append(slot);
    }
    this.items.li.hidden = true;
    this.score.val.addEventListener('animationend', () => this.score.val.classList.remove('pop'));
    this.energyBar.setAttribute('aria-hidden', 'true');
    this.energyBar.append(this.energyFill, el('i', 'tick t50'));
    this.energyBar.addEventListener('animationend', () => this.energyBar.classList.remove('pop'));
    this.energy.val.append(this.energyBar, this.energyTag);
    this.stats.setAttribute('aria-label', 'Score');
    this.stats.append(...[this.score, this.kos, this.wave, this.rocks, this.weapon, this.energy, this.items].map((r) => r.li));
    top.append(hp, this.stats, this.cardsEl);
    this.round = this.makeRound();
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
    this.root.append(top, this.prompt, this.edges, this.banner, this.tools, this.round.root);
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
      const inc = alertFromEvent(e);
      if (inc) this.alert.push(inc);
    }
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
    const card = el('div', 'bb-intro');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Comment jouer');
    card.append(el('b', 'title', 'Comment jouer'), el('p', 'goal', INTRO_GOAL));
    const list = el('dl', 'keys');
    for (const name of INTRO_ACTIONS) {
      const row = CONTROLS.find((c) => c.action === name);
      if (!row) continue;
      list.append(el('dt', '', name), el('dd', '', touch ? row.touch : row.keyboard));
    }
    const go = el('p', 'go', touch ? 'Touche l’écran pour commencer' : 'Appuie sur une touche pour commencer');
    card.append(list, go);
    const veil = el('div', 'bb-intro-veil');
    veil.append(card);
    let done = false;
    const dismiss = (e: Event): void => {
      if (done) return;
      // a lone modifier (Maj, Ctrl…) is not "a key": wait for a real one
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      done = true;
      // the key that starts the game must not also act in it
      e.preventDefault();
      e.stopImmediatePropagation();
      this.hideIntro();
      onDismiss();
    };
    // capture on window: the key or tap never reaches the game controls underneath
    window.addEventListener('keydown', dismiss, true);
    window.addEventListener('pointerdown', dismiss, true);
    this.introCleanup = () => {
      window.removeEventListener('keydown', dismiss, true);
      window.removeEventListener('pointerdown', dismiss, true);
    };
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
    for (const b of [this.furieBtn, this.ondeBtn]) b?.classList.remove('ready', 'dim');
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    if (this.actBtn) {
      this.actBtn.textContent = DEFAULT_ACT_LABEL;
      this.actBtn.style.display = 'none';
    }
  }

  update(s: Snapshot, view: CameraView): void {
    const c = this.c;
    const touch = this.touchRoot?.classList.contains('visible') ?? false;
    this.updateHp(s);
    this.updateStats(s);
    this.updateEnergy(s, touch);

    this.trackRescue(s);
    this.updateCards(incidentLines(s, this.rescueDrain), s);

    const cinematic = s.school.stage === 'cinematic' && !s.ended;
    this.banner.hidden = !cinematic;
    if (cinematic) c.text(this.bannerHint, touch ? 'Touchez l’écran pour passer' : 'Espace ou F pour passer');

    const p = cinematic ? null : contextPrompt(s, touch);
    this.prompt.hidden = !p;
    c.text(this.prompt, p?.text ?? '');
    if (this.actBtn) {
      // Only an actionable prompt (repair / put out a fire) shows the touch Agir button, labelled with the action.
      c.style(this.actBtn, p?.label ? '' : 'display:none');
      c.text(this.actBtn, p?.label ?? DEFAULT_ACT_LABEL);
    }

    const active = s.ended ? [] : activeIncidents(s);
    if (s.ended) this.alert.clear();
    else this.alert.prune(new Set([...active.map((i) => i.id), ...hintIds(s)]));
    this.alert.track(s.player.pos);
    this.placeAlert();
    this.updateRound(roundPanel(s));
    this.updateEdges(active, s, view, touch);
  }

  /** The score list: values, the score pop (only when it goes up) and the round pulse (when the round changes). */
  private updateStats(s: Snapshot): void {
    const c = this.c;
    c.text(this.score.val, String(s.score));
    if (s.score !== this.lastScore) {
      const up = s.score > this.lastScore; // false on the first frame (NaN)
      this.lastScore = s.score;
      // restart the stepped pop (CSS, off under prefers-reduced-motion); a drop clears it
      this.score.val.classList.remove('pop');
      if (up) {
        void this.score.val.offsetWidth;
        this.score.val.classList.add('pop');
      }
    }
    c.text(this.kos.val, String(s.kos));
    aria(this.kos.li, `Casseurs neutralisés : ${s.kos}`);
    c.text(this.wave.val, roundValue(s));
    aria(this.wave.li, waveLine(s));
    if (s.round !== this.lastWave) {
      if (this.lastWave >= 0) {
        // restart the stepped pulse (CSS, off under prefers-reduced-motion)
        this.wave.li.classList.remove('pulse');
        void this.wave.li.offsetWidth;
        this.wave.li.classList.add('pulse');
      }
      this.lastWave = s.round;
    }
    this.slots.forEach((slot, i) => c.text(slot, i < s.carried ? '●' : '○'));
    aria(this.rocks.li, `Pierres : ${s.carried} sur ${SLOTS}`);
    c.text(this.weapon.val, weaponValue(s));
    this.weapon.li.classList.toggle('furie', s.furie !== null);
    const items = itemsLine(s);
    this.items.li.hidden = items === null;
    c.text(this.items.val, String(s.carriedItems));
  }

  /**
   * The ÉNERGIE row (bar width, a pop when it fills, the state class: soft blink at the onde, gold blink when full, the
   * drain in mode furie; the refusal hint) and the touch Furie / Onde buttons (dim until available, `ready` glow).
   */
  private updateEnergy(s: Snapshot, touch: boolean): void {
    const c = this.c;
    const v = energyView(s, touch);
    c.style(this.energyFill, `width:${v.pct.toFixed(1)}%`);
    c.cls(this.energy.li, `row energy minor st-${v.state}${this.refused ? ' refused' : ''}`);
    c.text(this.energyTag, this.refused ? ENERGY_REFUSED_HINT : v.tag);
    aria(this.energy.li, v.aria);
    if (s.energy.value !== this.lastEnergy) {
      const up = s.energy.value > this.lastEnergy; // false on the first frame (NaN)
      this.lastEnergy = s.energy.value;
      if (up) {
        this.energyBar.classList.remove('pop');
        void this.energyBar.offsetWidth;
        this.energyBar.classList.add('pop');
      }
    }
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
        card = this.makeCard();
        this.cards.set(line.key, card);
        this.topBox = null;
      }
      if (this.cardsEl.children[i] !== card.root) this.cardsEl.insertBefore(card.root, this.cardsEl.children[i] ?? null);
      this.card(card, line, s);
    });
    for (const [key, card] of this.cards) {
      if (keep.has(key)) continue;
      card.root.remove();
      this.cards.delete(key);
      this.topBox = null;
    }
  }

  private makeCard(): Card {
    const root = el('div', 'bb-card');
    const bar = el('span', 'hpbar');
    const fill = el('span', 'fill');
    bar.append(fill);
    bar.setAttribute('aria-hidden', 'true');
    const c: Card = { root, ico: el('span', 'ico'), name: el('b', 'name'), time: el('span', 'time'), bar, fill, status: el('span', 'status'), items: el('span', 'items'), dist: el('span', 'dist') };
    c.items.hidden = true;
    root.append(c.ico, c.name, bar, c.time, c.status, c.items, c.dist);
    return c;
  }

  private card(card: Card, line: IncidentLine, s: Snapshot): void {
    const c = this.c;
    const slug = line.status.replace(/\s/g, '-');
    c.cls(card.root, `bb-card k-${line.kind} st-${slug}`);
    const target = line.hp !== null && line.kind !== 'flag';
    const icon: AlertIcon = incidentLook(line.kind, target ? line.status === 'en feu' : undefined).icon;
    if (card.ico.dataset.icon !== icon) {
      card.ico.dataset.icon = icon;
      card.ico.innerHTML = pixelSvg(icon, 1);
    }
    c.text(card.name, line.name);
    c.text(card.time, line.time);
    card.bar.hidden = line.hp === null;
    if (line.hp !== null) {
      c.style(card.fill, `width:${line.hp.toFixed(0)}%`);
      // a target's health turns red when low; the flag's capture bar fills up (no alarm colour)
      c.cls(card.fill, line.kind === 'flag' ? 'fill capture' : line.hp <= 30 ? 'fill low' : 'fill');
    }
    c.text(card.status, line.status);
    card.items.hidden = line.items === null;
    c.text(card.items, line.items ?? '');
    const tiles = Math.round(Math.hypot(line.target.x - s.player.pos.x, line.target.y - s.player.pos.y) / TILE);
    c.text(card.dist, `${tiles} m`);
  }

  private makeRound(): RoundEls {
    const root = el('div', 'bb-round');
    root.setAttribute('role', 'status');
    root.hidden = true;
    const r: RoundEls = {
      root,
      title: el('b', 'title'),
      kos: el('span', 'kos'),
      obj: el('ul', 'obj'),
      points: el('span', 'points'),
      bonus: el('span', 'bonus'),
      heals: el('span', 'heals'),
      count: el('span', 'count'),
      objKey: '',
    };
    const score = el('div', 'score');
    score.append(r.points, r.bonus);
    root.append(r.title, r.kos, r.obj, score, r.heals, r.count);
    return r;
  }

  /** The breather's round panel: shown while `p` is non-null, never interactive (pointer-events: none). */
  private updateRound(p: RoundPanel | null): void {
    const r = this.round;
    const c = this.c;
    if (!p) {
      r.root.hidden = true;
      return;
    }
    if (r.root.hidden) {
      r.root.hidden = false;
      // restart the stepped entry animation
      r.root.classList.remove('in');
      void r.root.offsetWidth;
      r.root.classList.add('in');
    }
    c.text(r.title, p.title);
    c.text(r.kos, p.kos);
    const key = p.objectives.map((o) => `${o.name}:${o.result}`).join('|');
    if (key !== r.objKey) {
      r.objKey = key;
      r.obj.replaceChildren(
        ...p.objectives.map((o) => {
          const li = el('li', o.result === 'réussi' ? 'ok' : 'bad');
          li.append(`${o.name} : `, el('b', '', o.result));
          return li;
        }),
      );
    }
    c.text(r.points, p.points);
    r.bonus.hidden = !p.bonus;
    c.text(r.bonus, p.bonus ?? '');
    c.text(r.heals, p.heals);
    c.text(r.count, p.countdown);
    this.placeRound();
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

  /** One pixel indicator per active incident, at the screen edge toward it, only while it is off-screen. */
  private updateEdges(list: Incident[], s: Snapshot, view: CameraView, touch: boolean): void {
    const seen = new Set<string>();
    const { top, tools } = this.boxes();
    const avoid: Box[] = [top, { left: tools.left, top: 0, right: view.width, bottom: tools.bottom }];
    if (touch) avoid.push({ left: view.width - TOUCH_PAD_W, top: view.height - TOUCH_PAD_H, right: view.width, bottom: view.height });
    for (const inc of list) {
      const screen = { x: (inc.pos.x - view.x) * view.zoom, y: (inc.pos.y - view.y) * view.zoom };
      const at = edgePosition(screen, view, EDGE_HALF, EDGE_PAD, avoid);
      if (!at) continue;
      seen.add(inc.id);
      const e = this.edge(inc);
      this.c.style(e.root, `left:${at.x}px;top:${at.y}px`);
      setArrow(e.arrow, bearingDeg(at, screen));
      this.c.text(e.dist, formatMeters(s.player.pos, inc.pos));
    }
    for (const [id, e] of this.edgeEls) {
      if (seen.has(id)) continue;
      e.root.remove();
      this.edgeEls.delete(id);
    }
  }

  private edge(inc: Incident): Edge {
    const key = inc.id;
    const spec = incidentAlert(inc.kind);
    const look = incidentLook(inc.kind, inc.burning);
    let e = this.edgeEls.get(key);
    if (e && (e.root.dataset.kind !== inc.kind || e.root.dataset.tone !== look.tone)) {
      e.root.remove();
      e = undefined;
    }
    if (e) return e;
    const root = el('div', `bb-edge tone-${look.tone}`);
    root.dataset.kind = inc.kind;
    root.dataset.tone = look.tone;
    const arrow = el('span', 'arrow');
    const ico = el('span', 'ico');
    ico.innerHTML = pixelSvg(look.icon, 2);
    const txt = el('span', 'txt');
    const dist = el('span', 'dist');
    txt.append(el('b', 'lbl', spec.label), dist);
    root.append(arrow, ico, txt);
    this.edges.append(root);
    e = { root, arrow, dist };
    this.edgeEls.set(key, e);
    return e;
  }
}
