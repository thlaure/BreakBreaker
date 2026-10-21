import type { Launch, Vec } from '../../sim/types';

/** Flight time (ms) of a body launched during the mode furie. */
export const LAUNCH_MS = 700;
/** Peak height (px) of the flight arc. */
export const LAUNCH_ARC_PX = 26;
/** Margin (px) kept between a landing body and the world edge. */
export const LAUNCH_EDGE_PX = 12;
/** Last seconds of the mode furie in which the aura fades and blinks. */
export const FURIE_FADE_SEC = 2;

export interface LaunchPose {
  /** Ground point under the body (shadow, landing depth). */
  x: number;
  y: number;
  /** Height above the ground (px). */
  lift: number;
  /** Rotation in degrees. */
  angle: number;
  scaleX: number;
  scaleY: number;
  /** 0..1 flight progress (1 = landed). */
  t: number;
}

/**
 * How far (px, ≤ launch.power) the body travels along `launch.dir` from `from`: the farthest sample along the path that
 * is inside the world (with LAUNCH_EDGE_PX margin) and free (`blocked` false). The body flies over walls, it only
 * never lands in one or off the map. `step` = sampling distance.
 */
export function landingDistance(
  from: Vec,
  launch: Launch,
  world: { width: number; height: number },
  blocked: (p: Vec) => boolean,
  step = 8,
): number {
  let best = 0;
  const m = LAUNCH_EDGE_PX;
  for (let d = step; d <= launch.power + 1e-6; d += step) {
    const x = from.x + launch.dir.x * d;
    const y = from.y + launch.dir.y * d;
    if (x < m || y < m || x > world.width - m || y > world.height - m) break;
    if (!blocked({ x, y })) best = d;
  }
  return best;
}

/**
 * Pose of a launched body `ms` after the KO: ease-out travel over `dist` px, an arc of LAUNCH_ARC_PX, `spin` turns
 * eased the same way (the tourbillon), and a squash that wobbles while airborne then settles to 1.
 */
export function launchPose(from: Vec, launch: Launch, dist: number, ms: number): LaunchPose {
  const t = Math.min(1, Math.max(0, ms / LAUNCH_MS));
  const ease = 1 - (1 - t) ** 3;
  const wobble = Math.sin(t * Math.PI * 6) * (1 - t) * 0.18;
  return {
    x: from.x + launch.dir.x * dist * ease,
    y: from.y + launch.dir.y * dist * ease,
    lift: Math.sin(Math.PI * t) * LAUNCH_ARC_PX,
    angle: launch.spin * 360 * ease,
    scaleX: 1 + wobble,
    scaleY: 1 - wobble,
    t,
  };
}

/**
 * Aura strength for `secondsLeft` of mode furie at render time `nowMs`: 1 while plenty is left; in the last
 * FURIE_FADE_SEC it fades toward 0.25 and blinks faster and faster.
 */
export function auraAlpha(secondsLeft: number, nowMs: number): number {
  if (secondsLeft >= FURIE_FADE_SEC) return 1;
  const k = Math.max(0, secondsLeft) / FURIE_FADE_SEC;
  const period = 90 + 160 * k;
  const blink = Math.floor(nowMs / period) % 2 === 0 ? 1 : 0.45;
  return (0.25 + 0.75 * k) * blink;
}

/** Flight time (ms) of a body « satellisé » by the onde d’énergie; shorter, without spin, under reduced motion. */
export const SATELLITE_MS = 1300;
export const SATELLITE_MS_REDUCED = 500;
/** How high (px, screen up) a satellite climbs by the end of its flight: it leaves for the sky. */
export const SATELLITE_RISE_PX = 220;
/** Scale of a satellite at the end of its flight. */
export const SATELLITE_END_SCALE = 0.25;
/** Ease-in exponent of the satellite travel (slow start, then fast). */
const SATELLITE_EASE = 2.4;

export interface SatellitePose {
  /** Point under the body along the beam (not clamped to the map). */
  x: number;
  y: number;
  /** Height above that point (px). */
  lift: number;
  angle: number;
  scale: number;
  /** 0..1 flight progress (1 = gone, twinkle time). */
  t: number;
}

/**
 * Pose of a satellite `ms` after the beam KO: ease-in travel over the whole `launch.power` along `launch.dir` (never
 * clamped to the world), climbing SATELLITE_RISE_PX, spinning `spin` turns, shrinking to SATELLITE_END_SCALE. Reduced
 * motion: SATELLITE_MS_REDUCED and no spin.
 */
export function satellitePose(from: Vec, launch: Launch, ms: number, reduced = false): SatellitePose {
  const dur = reduced ? SATELLITE_MS_REDUCED : SATELLITE_MS;
  const t = Math.min(1, Math.max(0, ms / dur));
  const ease = t ** SATELLITE_EASE;
  return {
    x: from.x + launch.dir.x * launch.power * ease,
    y: from.y + launch.dir.y * launch.power * ease,
    lift: SATELLITE_RISE_PX * t * t,
    angle: reduced ? 0 : launch.spin * 360 * ease,
    scale: 1 - (1 - SATELLITE_END_SCALE) * t,
    t,
  };
}

/** Satellites of one beam leave one after the other: SATELLITE_STAGGER_MS per index, at most SATELLITE_DELAY_MAX_MS. */
export const SATELLITE_STAGGER_MS = 30;
export const SATELLITE_DELAY_MAX_MS = 120;

/** Deterministic take-off delay (ms) of the `index`-th body satellised by one beam (0, 30, 60, 90, 120, 0, 30…). */
export function satelliteDelay(index: number): number {
  const steps = SATELLITE_DELAY_MAX_MS / SATELLITE_STAGGER_MS + 1;
  return (Math.max(0, Math.floor(index)) % steps) * SATELLITE_STAGGER_MS;
}

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a satellite leaves the view: null while `cur` is still inside `view` shrunk by `inset` (world px); else the
 * point where the segment `prev` → `cur` crosses that inner rectangle's edge (when `prev` was inside), clamped inside
 * it — so a twinkle drawn there is always on screen.
 */
export function edgeExit(prev: Vec, cur: Vec, view: ViewRect, inset: number): Vec | null {
  const x0 = view.x + inset;
  const y0 = view.y + inset;
  const x1 = view.x + view.width - inset;
  const y1 = view.y + view.height - inset;
  const inside = (p: Vec): boolean => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  if (inside(cur)) return null;
  let p = cur;
  if (inside(prev)) {
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    let t = 1;
    if (dx > 0) t = Math.min(t, (x1 - prev.x) / dx);
    if (dx < 0) t = Math.min(t, (x0 - prev.x) / dx);
    if (dy > 0) t = Math.min(t, (y1 - prev.y) / dy);
    if (dy < 0) t = Math.min(t, (y0 - prev.y) / dy);
    p = { x: prev.x + dx * t, y: prev.y + dy * t };
  }
  return { x: Math.min(x1, Math.max(x0, p.x)), y: Math.min(y1, Math.max(y0, p.y)) };
}
