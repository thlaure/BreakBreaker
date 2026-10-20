import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
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
  pixelSvg,
  setArrow,
  type Box,
  type Incident,
} from './alerts';
import { DEFAULT_ACT_LABEL, contextPrompt, incidentLines, waveLine, weaponLine, type IncidentLine } from './format';

/** How long the launch card stays on screen if the player does not close it. */
const INTRO_MS = 25_000;

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
const ICONS = { school: pixelSvg('flame', 1), rescue: pixelSvg('alert', 1) } as const;
const TILE = CONFIG.tile;
const SCHOOL_DOOR = DISTRICT.school.door;

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
  status: HTMLElement;
  dist: HTMLElement;
}

/**
 * HTML overlay `#hud`: stats and incident cards (top-left), contextual prompt under Paul, an alert banner when an
 * incident starts and one edge indicator per active incident whose target is off-screen.
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
  private readonly slots: HTMLElement[] = [];
  private readonly top = el('div', 'bb-top');
  private readonly cards: Record<'school' | 'rescue', Card>;
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
  /** Wave number last shown (the line pulses once when it changes). */
  private lastWave = -1;
  private lastRescue = Number.POSITIVE_INFINITY;
  private rescueDrain: 'en cours' | 'interrompu' = 'en cours';

  private readonly tools = el('div', 'bb-tools');
  private intro: HTMLElement | null = null;
  private introTimer: ReturnType<typeof setTimeout> | null = null;

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
    l2.append(this.wave, rocks, this.weapon);
    const cards = el('div', 'bb-cards');
    const mk = (): Card => {
      const root = el('div', 'bb-card');
      const c: Card = { root, ico: el('span', 'ico'), name: el('b', 'name'), time: el('span', 'time'), status: el('span', 'status'), dist: el('span', 'dist') };
      root.hidden = true;
      root.append(c.ico, c.name, c.time, c.status, c.dist);
      cards.append(root);
      return c;
    };
    this.cards = { school: mk(), rescue: mk() };
    top.append(hp, l1, l2, cards);
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
    this.root.append(top, this.prompt, this.edges, this.banner, this.tools);
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

  /** Sim events of the frame: a new incident or fill wave pops the alert banner. */
  onEvents(events: SimEvent[]): void {
    for (const e of events) {
      const inc = alertFromEvent(e);
      if (inc) this.alert.push(inc);
    }
  }

  /**
   * Non-blocking card shown when the game launches (the game is already running): goal + the main keys.
   * Closes with its button, on its own after INTRO_MS, or when `hideIntro` is called.
   */
  showIntro(touch: boolean): void {
    this.hideIntro();
    const card = el('div', 'bb-intro');
    card.setAttribute('role', 'status');
    card.append(el('b', 'title', 'Comment jouer'), el('p', 'goal', INTRO_GOAL));
    const list = el('dl', 'keys');
    for (const name of INTRO_ACTIONS) {
      const row = CONTROLS.find((c) => c.action === name);
      if (!row) continue;
      list.append(el('dt', '', name), el('dd', '', touch ? row.touch : row.keyboard));
    }
    const close = el('button', 'close', 'Compris');
    close.type = 'button';
    close.addEventListener('click', () => this.hideIntro());
    card.append(list, close);
    this.intro = card;
    this.root.append(card);
    this.introTimer = setTimeout(() => this.hideIntro(), INTRO_MS);
  }

  hideIntro(): void {
    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = null;
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
    if (s.wave !== this.lastWave) {
      if (this.lastWave >= 0) {
        // restart the stepped pulse (CSS, off under prefers-reduced-motion)
        this.wave.classList.remove('pulse');
        void this.wave.offsetWidth;
        this.wave.classList.add('pulse');
      }
      this.lastWave = s.wave;
    }
    c.text(this.weapon, weaponLine(s));
    this.slots.forEach((slot, i) => {
      const full = i < s.carried;
      c.text(slot, full ? '●' : '○');
    });

    this.trackRescue(s);
    const lines = incidentLines(s, this.rescueDrain);
    for (const key of ['school', 'rescue'] as const) this.card(this.cards[key], lines.find((l) => l.key === key), s);

    const touch = this.touchRoot?.classList.contains('visible') ?? false;
    const cinematic = s.school.stage === 'cinematic' && !s.ended;
    this.banner.hidden = !cinematic;
    if (cinematic) c.text(this.bannerHint, touch ? 'Touchez l’écran pour passer' : 'Espace ou F pour passer');

    const p = cinematic ? null : contextPrompt(s, touch);
    this.prompt.hidden = !p;
    c.text(this.prompt, p?.text ?? '');
    if (this.actBtn) {
      // Only an actionable prompt shows the touch Agir button (none in this slice; repairs will use it).
      c.style(this.actBtn, p?.label ? '' : 'display:none');
      c.text(this.actBtn, p?.label ?? DEFAULT_ACT_LABEL);
    }

    if (s.ended) this.alert.clear();
    this.alert.track(s.player.pos);
    this.placeAlert();
    this.updateEdges(s.ended ? [] : activeIncidents(s), s, view, touch);
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

  private card(card: Card, line: IncidentLine | undefined, s: Snapshot): void {
    const c = this.c;
    if (card.root.hidden !== !line) {
      card.root.hidden = !line;
      this.topBox = null;
    }
    if (!line) return;
    const slug = line.status.replace(/\s/g, '-');
    c.cls(card.root, `bb-card k-${line.key} st-${slug}`);
    if (!card.ico.firstChild) card.ico.innerHTML = ICONS[line.key];
    c.text(card.name, line.name);
    c.text(card.time, line.time);
    c.text(card.status, line.status);
    const over = line.status === 'sauvé' || line.status === 'perdu' || line.status === 'sauvée' || line.status === 'perdue';
    const target = line.key === 'school' ? SCHOOL_DOOR : line.target;
    const tiles = Math.round(Math.hypot(target.x - s.player.pos.x, target.y - s.player.pos.y) / TILE);
    c.text(card.dist, over ? '' : `${tiles} m`);
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
    let e = this.edgeEls.get(key);
    if (e && e.root.dataset.kind !== inc.kind) {
      e.root.remove();
      e = undefined;
    }
    if (e) return e;
    const root = el('div', `bb-edge tone-${spec.tone}`);
    root.dataset.kind = inc.kind;
    const arrow = el('span', 'arrow');
    const ico = el('span', 'ico');
    ico.innerHTML = pixelSvg(spec.icon, 2);
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
