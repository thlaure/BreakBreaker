import { CONFIG } from './config';
import type { FlowField } from './map/flowfield';
import { dist, norm, sub } from './math';
import type { SpatialHash } from './spatial';
import type { HordeCtx, HordeSite, Hostile } from './hostiles';
import type { Vec } from './types';

/** Per-hostile AI bookkeeping kept out of the public Hostile shape. */
export interface Aux {
  /**
   * 'bottle' = a firebomber's Molotov aimed at Paul (counts in the throw windup cap like a rock); 'aim' / 'burst' = a
   * shooter aiming, then firing its burst (no windup cap: shooters are few). 'brawl' = a blow at an ally (`foe`; no
   * windup cap: the cap keeps Paul's fights fair, not the allies').
   */
  windKind: 'contact' | 'throw' | 'molotov' | 'bottle' | 'aim' | 'burst' | 'brawl' | null;
  /** The ally a 'brawl' windup is aimed at (null otherwise). */
  foe: number | null;
  /** Shooter: the fixed line of the current aim (from its position at aim start toward where Paul stood). */
  aimFrom: Vec | null;
  /** Shooter: bullets left in the burst and when the next one leaves. */
  shotsLeft: number;
  nextShotAt: number;
  /** A Molotov marked so turns into this role once its bottle hit its site (then it goes for Paul). */
  afterThrow: 'firebomber' | null;
  throwTo: Vec | null;
  /** Index of the site attack point this degrader / Molotov goes for. */
  pointIdx: number | null;
  progressPos: Vec;
  progressAt: number;
  /** Until this time, steer by flow field even when a straight line looks clear (set when stuck). */
  fieldUntil: number;
  /** Post a site-bound rioter returns to after engaging Paul (null = none, or it left it for good). */
  home: 'facade' | 'victim' | null;
  /** Sim time it first reached its post (degrading its site / threatening its victim), null before. */
  postAt: number | null;
}

export const R = CONFIG.hostile.radius;
export const NEAR_GOAL = 24;
const STUCK_PX = 8;
const STUCK_SEC = 2;
/** Blocked by neighbours this close to the goal means queuing, not stuck. */
const QUEUE_DIST = 64;
export const EPS = 1e-9;
export const ZERO: Vec = { x: 0, y: 0 };

export const isZero = (v: Vec): boolean => v.x === 0 && v.y === 0;

/** The standing site a degrader / Molotov goes for, or null (missing or ruined → it turns on Paul). */
export function siteOf(h: Hostile, ctx: HordeCtx): HordeSite | null {
  const s = h.site ? ctx.sites[h.site] : undefined;
  return s && s.standing && s.points.length > 0 ? s : null;
}

/** The site attack point this hostile goes for: the nearest one at first, the next one when stuck. */
export function sitePoint(h: Hostile, a: Aux, pts: Vec[]): Vec {
  if (a.pointIdx === null) {
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (dist(h.pos, pts[i]!) < dist(h.pos, pts[best]!)) best = i;
    a.pointIdx = best;
  }
  return pts[a.pointIdx % pts.length]!;
}

export function degrader(h: Hostile, a: Aux, site: HordeSite, now: number, ctx: HordeCtx): Vec {
  const goal = sitePoint(h, a, site.points);
  if (dist(h.pos, goal) <= NEAR_GOAL) {
    h.state = 'degrade';
    return ZERO;
  }
  if (h.state === 'degrade') h.state = 'approach';
  return steer(h, a, goal, site.field, now, ctx);
}

/** Straight line when clear (and not recovering from being stuck), else follow the flow field. */
export function steer(h: Hostile, a: Aux, goal: Vec, field: FlowField | null, now: number, ctx: HordeCtx): Vec {
  if (!field || (now >= a.fieldUntil && ctx.grid.lineClear(h.pos, goal))) return norm(sub(goal, h.pos));
  const dir = field.dirAt(h.pos);
  return isZero(dir) ? norm(sub(goal, h.pos)) : dir;
}

/** Push apart from overlapping active hostiles and out of Paul's body. */
export function separation(hash: SpatialHash<{ id: number; pos: Vec }>, h: Hostile, player: Vec): Vec {
  const out = { x: 0, y: 0 };
  for (const n of hash.query(h.pos, 2 * R)) {
    if (n.id === h.lifeId) continue;
    const d = dist(h.pos, n.pos);
    const overlap = 2 * R - d;
    if (overlap <= 0) continue;
    const dir = d === 0 ? { x: h.lifeId < n.id ? -1 : 1, y: 0 } : norm(sub(h.pos, n.pos));
    out.x += dir.x * overlap * 0.5;
    out.y += dir.y * overlap * 0.5;
  }
  const dp = dist(h.pos, player);
  const minP = R + CONFIG.player.radius;
  if (dp < minP && dp > 0) {
    const dir = norm(sub(h.pos, player));
    out.x += dir.x * (minP - dp);
    out.y += dir.y * (minP - dp);
  }
  return out;
}

export function crowded(hash: SpatialHash<{ id: number; pos: Vec }>, h: Hostile): boolean {
  return hash.query(h.pos, 2 * R + 1).some((n) => n.id !== h.lifeId);
}

export function goalOf(h: Hostile, a: Aux, ctx: HordeCtx): Vec | null {
  if (h.target === 'player') return ctx.player.pos;
  if (h.target === 'victim') return ctx.victimPos;
  const site = siteOf(h, ctx);
  return a.pointIdx === null || !site ? null : site.points[a.pointIdx % site.points.length]!;
}

/**
 * No progress > 8 px in 2 s while trying to move -> steer by flow field for 2 s and, for a degrader or Molotov,
 * try the next site attack point. A hostile held back by neighbours near its goal is queuing and is not treated as stuck.
 * The field rebuild throttle is never bypassed: the field is rebuilt on its normal 0.25 s cadence anyway.
 */
export function trackProgress(h: Hostile, a: Aux, moving: boolean, crowded: boolean, now: number, ctx: HordeCtx): void {
  const goal = goalOf(h, a, ctx);
  const queuing = crowded && goal !== null && dist(h.pos, goal) <= QUEUE_DIST;
  if (!moving || queuing || a.progressAt === -Infinity || dist(h.pos, a.progressPos) > STUCK_PX) {
    a.progressPos = { ...h.pos };
    a.progressAt = now;
    return;
  }
  if (now - a.progressAt <= STUCK_SEC) return;
  a.fieldUntil = now + STUCK_SEC;
  const site = h.target === 'facade' ? siteOf(h, ctx) : null;
  if (site && a.pointIdx !== null) a.pointIdx = (a.pointIdx + 1) % site.points.length;
  a.progressPos = { ...h.pos };
  a.progressAt = now;
}
