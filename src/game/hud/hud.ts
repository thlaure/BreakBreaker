import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { DEFAULT_ACT_LABEL, contextPrompt, incidentLines, type IncidentLine } from './format';

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
  private readonly slots: HTMLElement[] = [];
  private readonly top = el('div', 'bb-top');
  private readonly cards: Record<'school' | 'rescue', Card>;
  private readonly prompt = el('div', 'bb-prompt');
  private readonly arrow = el('div', 'bb-arrow');
  private readonly arrowGlyph = el('span', 'glyph', '➤');
  private readonly arrowLabel = el('span', 'lbl');
  private readonly actBtn: HTMLElement | null;
  private lastNow = -1;
  private lastRescue = Number.POSITIVE_INFINITY;
  private rescueDrain: 'en cours' | 'interrompu' = 'en cours';

  constructor(parent: HTMLElement, touchRoot: HTMLElement | null) {
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
    l2.append(this.wave, rocks);
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
    this.root.append(top, this.prompt, this.arrow);
    parent.append(this.root);
    this.actBtn = touchRoot?.querySelector<HTMLElement>('[data-action=act]') ?? null;
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  destroy(): void {
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
    this.slots.forEach((slot, i) => {
      const full = i < s.carried;
      c.text(slot, full ? '●' : '○');
    });

    this.trackRescue(s);
    const lines = incidentLines(s, this.rescueDrain);
    for (const key of ['school', 'rescue'] as const) this.card(this.cards[key], lines.find((l) => l.key === key), s);

    const p = contextPrompt(s);
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
    card.root.hidden = !line;
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
    const box = this.top.getBoundingClientRect();
    if (x < box.right + 30 && y < box.bottom + 24) y = Math.round(box.bottom + 24);
    const deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    this.arrow.hidden = false;
    this.c.style(this.arrow, `left:${x}px;top:${y}px`);
    this.c.style(this.arrowGlyph, `transform:rotate(${deg}deg)`);
    this.c.text(this.arrowLabel, same(t, SCHOOL_DOOR) ? 'École' : 'Secours');
  }
}
