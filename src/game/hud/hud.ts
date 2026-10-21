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
  contextPrompt,
  incidentLines,
  itemsLine,
  roundPanel,
  toolboxLine,
  waveLine,
  weaponLine,
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
const TOUCH_PAD_H = 210;
const SLOTS = CONFIG.rock.maxCarried;
const TILE = CONFIG.tile;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
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
 * HTML overlay `#hud`: stats and incident cards (top-left), contextual prompt under Paul, an alert banner when an
 * incident or round starts, one edge indicator per active incident whose target is off-screen, and the non-modal round
 * panel (top centre, under the banner and clear of the stats panel) during the breather between rounds.
 */
export class Hud {
  readonly root = el('div', 'bb-hud');
  private readonly c = new Cache();
  private readonly hpFill = el('div', 'fill');
  private readonly hpNum = el('span', 'num');
  private readonly score = el('span', 'stat');
  private readonly kos = el('span', 'stat');
  private readonly wave = el('span', 'stat');
  private readonly weapon = el('span', 'stat');
  private readonly kit = el('span', 'stat');
  /** Belongings Paul carries back to the rescue victim (hidden when none). */
  private readonly items = el('span', 'stat items');
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
  private readonly touchRoot: HTMLElement | null;
  /** Cached `.bb-top` / `.bb-tools` boxes (indicators and banner keep clear of them); refreshed on resize and card changes. */
  private topBox: Box | null = null;
  private toolsBox: Box | null = null;
  private readonly onResize = (): void => {
    this.topBox = null;
    this.toolsBox = null;
  };
  private lastNow = -1;
  /** Round number last shown (the line pulses once when it changes). */
  private lastWave = -1;
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
    const hp = el('div', 'bb-hp');
    const bar = el('div', 'bar');
    bar.append(this.hpFill);
    bar.setAttribute('role', 'img');
    hp.append(el('span', 'ico', '♥'), el('span', 'lbl', 'Santé'), bar, this.hpNum);
    const l1 = el('div', 'bb-line');
    l1.append(this.score, this.kos);
    const l2 = el('div', 'bb-line');
    const rocks = el('span', 'stat');
    rocks.append(el('span', 'lbl', 'Pierres '));
    for (let i = 0; i < SLOTS; i++) {
      const s = el('span', 'slot', '○');
      this.slots.push(s);
      rocks.append(s);
    }
    this.items.hidden = true;
    l2.append(this.wave, rocks, this.kit, this.items, this.weapon);
    top.append(hp, l1, l2, this.cardsEl);
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
    window.addEventListener('resize', this.onResize);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
    this.onResize();
  }

  /** Sim events of the frame: a new incident or round pops the alert banner. */
  onEvents(events: SimEvent[]): void {
    for (const e of events) {
      const inc = alertFromEvent(e);
      if (inc) this.alert.push(inc);
    }
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
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    if (this.actBtn) {
      this.actBtn.textContent = DEFAULT_ACT_LABEL;
      this.actBtn.style.display = 'none';
    }
  }

  update(s: Snapshot, view: CameraView): void {
    const c = this.c;
    c.text(this.hpNum, `${Math.ceil(s.hp)}/${s.hpMax}`);
    const pct = Math.max(0, Math.min(100, (100 * s.hp) / s.hpMax));
    c.style(this.hpFill, `width:${pct.toFixed(0)}%`);
    c.cls(this.hpFill, pct <= 30 ? 'fill low' : 'fill');
    c.text(this.score, `Score : ${s.score}`);
    c.text(this.kos, `Casseurs neutralisés : ${s.kos}`);
    c.text(this.wave, waveLine(s));
    if (s.round !== this.lastWave) {
      if (this.lastWave >= 0) {
        // restart the stepped pulse (CSS, off under prefers-reduced-motion)
        this.wave.classList.remove('pulse');
        void this.wave.offsetWidth;
        this.wave.classList.add('pulse');
      }
      this.lastWave = s.round;
    }
    c.text(this.weapon, weaponLine(s));
    c.cls(this.weapon, s.furie ? 'stat furie' : 'stat');
    c.text(this.kit, toolboxLine(s));
    c.cls(this.kit, s.toolboxes.carried ? 'stat kit full' : 'stat kit');
    const items = itemsLine(s);
    this.items.hidden = items === null;
    c.text(this.items, items ?? '');
    this.slots.forEach((slot, i) => {
      const full = i < s.carried;
      c.text(slot, full ? '●' : '○');
    });

    this.trackRescue(s);
    this.updateCards(incidentLines(s, this.rescueDrain), s);

    const touch = this.touchRoot?.classList.contains('visible') ?? false;
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
    else this.alert.prune(new Set(active.map((i) => i.id)));
    this.alert.track(s.player.pos);
    this.placeAlert();
    this.updateRound(roundPanel(s));
    this.updateEdges(active, s, view, touch);
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
    this.topBox ??= box(this.top);
    this.toolsBox ??= box(this.tools);
    return { top: this.topBox, tools: this.toolsBox };
  }

  /** Top centre, or just under the stats panel / Commandes button when the screen is too narrow to fit between. */
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
