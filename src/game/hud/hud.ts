import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { CONTROLS, INTRO_ACTIONS, INTRO_GOAL } from '../../content/controls';
import { DEFAULT_ACT_LABEL, contextPrompt, incidentLines, weaponLine, type IncidentLine } from './format';

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

const ARROW_PAD = 44;
const SLOTS = CONFIG.rock.maxCarried;
const ICONS = { school: '⌂', rescue: '✚' } as const;
const TILE = CONFIG.tile;
const SCHOOL_DOOR = DISTRICT.school.door;

const same = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;

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

interface Card {
  root: HTMLElement;
  ico: HTMLElement;
  name: HTMLElement;
  time: HTMLElement;
  status: HTMLElement;
  dist: HTMLElement;
}

/** HTML overlay `#hud` (top-left), contextual prompt under Paul and an edge arrow toward the active objective. */
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
  private readonly arrow = el('div', 'bb-arrow');
  private readonly arrowGlyph = el('span', 'glyph', '➤');
  private readonly arrowLabel = el('span', 'lbl');
  private readonly banner = el('div', 'bb-banner');
  private readonly bannerHint = el('span', 'hint');
  private readonly actBtn: HTMLElement | null;
  private readonly touchRoot: HTMLElement | null;
  /** Cached `.bb-top` box (the arrow keeps clear of it); refreshed on resize and when a card shows/hides. */
  private topBox: { right: number; bottom: number } | null = null;
  private readonly onResize = (): void => {
    this.topBox = null;
  };
  private lastNow = -1;
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
    this.arrow.append(this.arrowGlyph, this.arrowLabel);
    this.arrow.hidden = true;
    this.prompt.hidden = true;
    this.prompt.setAttribute('aria-live', 'polite');
    this.banner.append(el('b', 'title', 'Renforts en approche !'), this.bannerHint);
    this.banner.hidden = true;
    this.banner.setAttribute('role', 'status');
    const cmd = el('button', 'bb-controls-btn', 'Commandes');
    cmd.type = 'button';
    cmd.setAttribute('aria-haspopup', 'dialog');
    cmd.addEventListener('click', () => this.opts.onControls?.());
    this.tools.append(cmd);
    this.root.append(top, this.prompt, this.arrow, this.banner, this.tools);
    parent.append(this.root);
    this.touchRoot = touchRoot;
    this.actBtn = touchRoot?.querySelector<HTMLElement>('[data-action=act]') ?? null;
    window.addEventListener('resize', this.onResize);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
    this.topBox = null;
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
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    if (this.actBtn) this.actBtn.textContent = DEFAULT_ACT_LABEL;
  }

  update(s: Snapshot, view: CameraView): void {
    const c = this.c;
    c.text(this.hpNum, `${Math.ceil(s.hp)}/${s.hpMax}`);
    const pct = Math.max(0, Math.min(100, (100 * s.hp) / s.hpMax));
    c.style(this.hpFill, `width:${pct.toFixed(0)}%`);
    c.cls(this.hpFill, pct <= 30 ? 'fill low' : 'fill');
    c.text(this.score, `Score : ${s.score}`);
    c.text(this.kos, `Casseurs neutralisés : ${s.kos}`);
    c.text(this.wave, `Vague ${s.wave}`);
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
    if (cinematic) c.text(this.bannerHint, touch ? 'Touchez l’écran pour passer' : 'Agir / Espace pour passer');

    const p = cinematic ? null : contextPrompt(s, touch);
    this.prompt.hidden = !p;
    c.text(this.prompt, p?.text ?? '');
    if (this.actBtn) c.text(this.actBtn, p?.label ?? DEFAULT_ACT_LABEL);

    this.updateArrow(s, view);
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
    c.cls(card.root, `bb-card st-${slug}`);
    c.text(card.ico, ICONS[line.key]);
    c.text(card.name, line.name);
    c.text(card.time, line.time);
    c.text(card.status, line.status);
    const over = line.status === 'sauvé' || line.status === 'perdu';
    const target = line.key === 'school' ? SCHOOL_DOOR : line.target;
    const tiles = Math.round(Math.hypot(target.x - s.player.pos.x, target.y - s.player.pos.y) / TILE);
    c.text(card.dist, over ? '' : `${tiles} m`);
  }

  private updateArrow(s: Snapshot, view: CameraView): void {
    const t = s.objective;
    if (!t) {
      this.arrow.hidden = true;
      return;
    }
    const sx = (t.x - view.x) * view.zoom;
    const sy = (t.y - view.y) * view.zoom;
    const m = ARROW_PAD / 2;
    if (sx >= m && sx <= view.width - m && sy >= m && sy <= view.height - m) {
      this.arrow.hidden = true;
      return;
    }
    const cx = view.width / 2;
    const cy = view.height / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const k = Math.min((cx - ARROW_PAD) / Math.abs(dx || 1e-6), (cy - ARROW_PAD) / Math.abs(dy || 1e-6));
    const x = Math.round(cx + dx * k);
    let y = Math.round(cy + dy * k);
    // keep clear of the HUD card in the top-left corner
    this.topBox ??= (({ right, bottom }) => ({ right, bottom }))(this.top.getBoundingClientRect());
    const box = this.topBox;
    if (x < box.right + 30 && y < box.bottom + 24) y = Math.round(box.bottom + 24);
    const deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    this.arrow.hidden = false;
    this.c.style(this.arrow, `left:${x}px;top:${y}px`);
    this.c.style(this.arrowGlyph, `transform:rotate(${deg}deg)`);
    this.c.text(this.arrowLabel, same(t, SCHOOL_DOOR) ? 'École' : 'Secours');
  }
}
