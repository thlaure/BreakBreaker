import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, Vec } from '../../sim/types';

/**
 * Incident alerts: a pixel banner when an incident or a round starts and one edge indicator per active incident.
 * Generic on purpose: a new kind of "casse" event only needs an entry in INCIDENT_ALERTS and a line in
 * `alertFromEvent` / `activeIncidents`. A round start has no position: its banner shows no arrow and no distance.
 */
export type IncidentKind = 'school' | 'groupHarassed' | 'elderlyRobbed';
/** Everything the banner can announce: positioned incidents and position-less round starts. */
export type AlertKind = IncidentKind | 'wave';
export type AlertTone = 'fire' | 'warn' | 'wave';
export type AlertIcon = 'flame' | 'alert' | 'horde';

export interface AlertSpec {
  /** Banner title. */
  title: string;
  /** Banner sub-line. */
  sub: string;
  /** Short label of the edge indicator. */
  label: string;
  tone: AlertTone;
  icon: AlertIcon;
}

export const INCIDENT_ALERTS: Readonly<Record<IncidentKind, AlertSpec>> = {
  school: { title: 'ÉCOLE EN FEU !', sub: 'Rejoins l’école', label: 'ÉCOLE', tone: 'fire', icon: 'flame' },
  groupHarassed: { title: 'AGRESSION EN COURS !', sub: 'Une personne est menacée', label: 'AGRESSION', tone: 'warn', icon: 'alert' },
  elderlyRobbed: { title: 'VOL EN COURS !', sub: 'Une personne âgée est menacée', label: 'VOL', tone: 'warn', icon: 'alert' },
};

/** What the banner shows for an alert: the spec plus the wave line and whether it points somewhere. */
export interface ShownAlert extends AlertSpec {
  /** Small « Manche N · T casseurs » line of an incident banner (empty when unknown or for a round start). */
  meta: string;
  /** False for a round start: no arrow, no distance. */
  positioned: boolean;
}

/** "1 casseur", "9 casseurs". */
export function casseurs(n: number): string {
  return `${n} ${n === 1 ? 'casseur' : 'casseurs'}`;
}

/** Banner content of an alert kind; `wave`/`total` give the wave number and the rioters to knock out (0 = unknown). */
export function incidentAlert(kind: AlertKind, wave = 0, total = 0): ShownAlert {
  if (kind === 'wave')
    return {
      title: `MANCHE ${wave} !`,
      sub: `${casseurs(total)} à neutraliser`,
      label: 'MANCHE',
      tone: 'wave',
      icon: 'horde',
      meta: '',
      positioned: false,
    };
  const meta = wave > 0 && total > 0 ? `Manche ${wave} · ${casseurs(total)}` : '';
  return { ...INCIDENT_ALERTS[kind], meta, positioned: true };
}

/** An incident on the map: what it is and where. */
export interface Incident {
  id: string;
  kind: IncidentKind;
  pos: Vec;
}

/** Something the banner announces: an incident (with a position) or a round start (pos null), with its round/total. */
export interface Alert {
  id: string;
  kind: AlertKind;
  pos: Vec | null;
  wave: number;
  total: number;
}

/** The alert announced by a sim event (incident start or round start), or null. */
export function alertFromEvent(e: SimEvent): Alert | null {
  if (e.type === 'SchoolStarted') return { id: e.incidentId, kind: 'school', pos: { ...e.pos }, wave: e.wave, total: e.total };
  if (e.type === 'RescueStarted') return { id: e.incidentId, kind: e.kind, pos: { ...e.pos }, wave: e.wave, total: e.total };
  if (e.type === 'RoundStarted') return { id: `round#${e.index}`, kind: 'wave', pos: null, wave: e.index, total: e.total };
  return null;
}

/** Incidents that still need Paul: the school while it is threatened, the rescue while the victim is threatened. */
export function activeIncidents(s: Snapshot): Incident[] {
  const out: Incident[] = [];
  const st = s.school.stage;
  if (st === 'attack' || st === 'cinematic' || st === 'reinforcements')
    out.push({ id: 'school', kind: 'school', pos: { ...DISTRICT.school.door } });
  if (s.rescue?.stage === 'threat') out.push({ id: 'rescue', kind: s.rescue.kind, pos: { ...s.rescue.victimPos } });
  return out;
}

/** Distance in metres (1 tile = 32 px = 1 m), rounded. */
export function meters(from: Vec, to: Vec): number {
  return Math.round(Math.hypot(to.x - from.x, to.y - from.y) / CONFIG.tile);
}

export function formatMeters(from: Vec, to: Vec): string {
  return `${meters(from, to)} m`;
}

/** Screen angle in whole degrees (0 = right, 90 = down) from `from` toward `to`. */
export function bearingDeg(from: Vec, to: Vec): number {
  return Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Targets closer than this to the screen border count as off-screen (they would sit under the indicator). */
export const ONSCREEN_MARGIN = 16;
const GAP = 4;

/**
 * Centre of an edge indicator of half-size `half` for a target at screen point `t`, or null when the target is on
 * screen. The point lies on the ray from the screen centre toward the target, clamped `pad` px inside the edges, then
 * moved out of every `avoid` box (HUD panel, Commandes button, touch controls) by the smallest in-bounds shift.
 */
export function edgePosition(t: Vec, view: { width: number; height: number }, half: Vec, pad: number, avoid: Box[] = []): Vec | null {
  const { width: w, height: h } = view;
  const m = ONSCREEN_MARGIN;
  if (t.x >= m && t.x <= w - m && t.y >= m && t.y <= h - m) return null;
  const minX = Math.min(w / 2, half.x + pad);
  const maxX = Math.max(w / 2, w - half.x - pad);
  const minY = Math.min(h / 2, half.y + pad);
  const maxY = Math.max(h / 2, h - half.y - pad);
  const cx = w / 2;
  const cy = h / 2;
  const dx = t.x - cx;
  const dy = t.y - cy;
  const kx = dx === 0 ? Infinity : (dx > 0 ? maxX - cx : cx - minX) / Math.abs(dx);
  const ky = dy === 0 ? Infinity : (dy > 0 ? maxY - cy : cy - minY) / Math.abs(dy);
  const k = Math.min(kx, ky);
  let p = { x: cx + dx * k, y: cy + dy * k };
  for (const b of avoid) {
    const l = b.left - half.x - GAP;
    const r = b.right + half.x + GAP;
    const tp = b.top - half.y - GAP;
    const bt = b.bottom + half.y + GAP;
    if (p.x <= l || p.x >= r || p.y <= tp || p.y >= bt) continue;
    const moves: Vec[] = [
      { x: p.x, y: bt },
      { x: p.x, y: tp },
      { x: r, y: p.y },
      { x: l, y: p.y },
    ].filter((q) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY);
    if (moves.length === 0) continue;
    moves.sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y));
    p = moves[0]!;
  }
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/* ---------- pixel-art SVG icons (built in code, crisp edges, no external images) ---------- */

const PALETTE: Record<string, string> = {
  K: '#14121c',
  R: '#c4372b',
  O: '#ff7a2e',
  Y: '#ffd166',
  W: '#fff7e0',
  C: 'currentColor',
};

type Sprite = AlertIcon | 'arrow' | 'arrowDiag';

const SPRITES: Record<Sprite, string[]> = {
  flame: [
    '....K.....',
    '...KRK....',
    '...KRRK.K.',
    '..KRORK.KK',
    '.KROORRKRK',
    '.KROYORRRK',
    'KROYYYORRK',
    'KROYWYYORK',
    'KROYWWYORK',
    '.KROYYORK.',
    '..KKKKKK..',
  ],
  alert: [
    '....KK....',
    '...KYYK...',
    '...KYYK...',
    '..KYKKYK..',
    '..KYKKYK..',
    '.KYYKKYYK.',
    '.KYYKKYYK.',
    'KYYYYYYYYK',
    'KYYYKKYYYK',
    'KKKKKKKKKK',
  ],
  // a small horde: three hooded silhouettes, red/orange
  horde: [
    '....KK....',
    '...KRRK...',
    '.KKKRRKKK.',
    'KOOKRRKOOK',
    'KOOKKKKOOK',
    'KKKRRRRKKK',
    'KOKRRRRKOK',
    'KOKRRRRKOK',
    'KKKRKKRKKK',
    '..KK..KK..',
  ],
  // points right (0°); rotated toward the target
  arrow: ['....C...', '....CC..', 'CCCCCCC.', 'CCCCCCCC', 'CCCCCCC.', '....CC..', '....C...'],
  // points down-right (45°)
  arrowDiag: ['CC......', 'CCC.....', '.CCC...C', '..CCC.CC', '...CCCCC', '....CCCC', '...CCCCC'],
};

/**
 * Pixel arrow toward `deg` (0 = right, 90 = down), snapped to 8 directions so the art is only ever turned by
 * multiples of 90° (stays crisp): a straight sprite for 0/90/180/270, a diagonal one for the others.
 */
export function arrowFor(deg: number): { sprite: 'arrow' | 'arrowDiag'; rot: number } {
  const q = (((Math.round(deg / 45) * 45) % 360) + 360) % 360;
  return q % 90 === 0 ? { sprite: 'arrow', rot: q } : { sprite: 'arrowDiag', rot: q - 45 };
}

/** Points the pixel arrow inside `el` toward `deg`; touches the DOM only when the direction changes. */
export function setArrow(el: HTMLElement, deg: number, scale = 2): void {
  const { sprite, rot } = arrowFor(deg);
  const key = `${sprite}:${rot}`;
  if (el.dataset.dir === key) return;
  if (!el.dataset.dir?.startsWith(`${sprite}:`)) el.innerHTML = pixelSvg(sprite, scale);
  el.dataset.dir = key;
  el.style.transform = rot ? `rotate(${rot}deg)` : '';
}

/** Inline SVG of a pixel sprite, `scale` CSS px per art pixel. */
export function pixelSvg(name: Sprite, scale = 2): string {
  const rows = SPRITES[name];
  const h = rows.length;
  const w = rows[0]!.length;
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = PALETTE[row[x]!];
      if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}

/* ---------- banner ---------- */

/** How long a banner stays on screen. */
export const ALERT_MS = 6000;
/** Alerts waiting behind the one on screen (older ones are dropped beyond this). */
const QUEUE_MAX = 3;

/**
 * Top-centre pixel banner announcing a new incident or round (role="alert"). One at a time; later ones queue and
 * show after. For a positioned alert the arrow and distance are refreshed by `track(playerPos)` while visible
 * (aria-hidden: not re-announced); a round start has neither.
 */
export class AlertBanner {
  readonly el: HTMLElement;
  private readonly ico: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly dir: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly dist: HTMLElement;
  private current: Alert | null = null;
  private readonly queue: Alert[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastDist = '';

  constructor(parent: HTMLElement) {
    const mk = (tag: string, cls: string): HTMLElement => {
      const e = document.createElement(tag);
      e.className = cls;
      return e;
    };
    this.el = mk('div', 'bb-alert');
    this.el.setAttribute('role', 'alert');
    this.el.hidden = true;
    this.ico = mk('span', 'ico');
    const txt = mk('div', 'txt');
    this.title = mk('b', 'title');
    this.sub = mk('span', 'sub');
    this.meta = mk('span', 'meta');
    txt.append(this.title, this.sub, this.meta);
    const dir = mk('div', 'dir');
    dir.setAttribute('aria-hidden', 'true');
    this.dir = dir;
    this.arrow = mk('span', 'arrow');
    this.dist = mk('span', 'dist');
    dir.append(this.arrow, this.dist);
    this.el.append(this.ico, txt, dir);
    parent.append(this.el);
  }

  get shown(): Alert | null {
    return this.current;
  }

  push(incident: Alert): void {
    if (this.current) {
      this.queue.push(incident);
      if (this.queue.length > QUEUE_MAX) this.queue.shift();
      return;
    }
    this.show(incident);
  }

  /** Live arrow (player → incident, 8 directions) and distance. */
  track(playerPos: Vec): void {
    const inc = this.current;
    if (!inc?.pos) return;
    setArrow(this.arrow, bearingDeg(playerPos, inc.pos), 3);
    const d = formatMeters(playerPos, inc.pos);
    if (d !== this.lastDist) {
      this.lastDist = d;
      this.dist.textContent = d;
    }
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
    this.current = null;
    this.el.hidden = true;
  }

  destroy(): void {
    this.clear();
    this.el.remove();
  }

  private show(incident: Alert): void {
    const spec = incidentAlert(incident.kind, incident.wave, incident.total);
    this.current = incident;
    this.el.className = `bb-alert tone-${spec.tone}`;
    this.ico.innerHTML = pixelSvg(spec.icon, 3);
    this.title.textContent = spec.title;
    this.sub.textContent = spec.sub;
    this.meta.textContent = spec.meta;
    this.meta.hidden = !spec.meta;
    this.dir.hidden = !spec.positioned;
    this.lastDist = '';
    this.dist.textContent = '';
    this.el.hidden = false;
    this.timer = setTimeout(() => this.next(), ALERT_MS);
  }

  private next(): void {
    this.timer = null;
    this.current = null;
    this.el.hidden = true;
    const n = this.queue.shift();
    if (!n) return;
    void this.el.offsetWidth; // restart the stepped entry animation
    this.show(n);
  }
}
