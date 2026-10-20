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
