import type { Vec } from '../../sim/types';

/** The glove shoots out on its spring in GLOVE_OUT_MS (with a small overshoot), then pulls back in GLOVE_BACK_MS. */
export const GLOVE_OUT_MS = 120;
export const GLOVE_BACK_MS = 110;

/**
 * Extension of the spring-loaded glove `ageMs` after the punch, as a share of its target distance: 0 → 1 over
 * GLOVE_OUT_MS with a small spring overshoot (about 1.03, exactly 1 at GLOVE_OUT_MS), then 1 → 0 over
 * GLOVE_BACK_MS (ease-in); 0 once done or before it starts.
 */
export function gloveExtent(ageMs: number): number {
  if (ageMs <= 0) return 0;
  if (ageMs < GLOVE_OUT_MS) {
    const t = ageMs / GLOVE_OUT_MS;
    // damped spring 1 − e^(−6t)·cos(3πt/2): cos(3π/2) = 0, so it ends on exactly 1
    return Math.min(1.2, 1 - Math.exp(-6 * t) * Math.cos(1.5 * Math.PI * t));
  }
  const back = (ageMs - GLOVE_OUT_MS) / GLOVE_BACK_MS;
  if (back >= 1) return 0;
  return 1 - back * back;
}

/** Whether the punch is still drawn `ageMs` after it. */
export function gloveActive(ageMs: number): boolean {
  return ageMs >= 0 && ageMs < GLOVE_OUT_MS + GLOVE_BACK_MS;
}

/** Points of the glove's zigzag spring from `a` to `b`: `coils` zigzags `amp` px wide (whole pixels). */
export function springPoints(a: Vec, b: Vec, coils = 5, amp = 3): Vec[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [{ x: Math.round(a.x), y: Math.round(a.y) }];
  const ux = dx / len;
  const uy = dy / len;
  const pts: Vec[] = [{ x: Math.round(a.x), y: Math.round(a.y) }];
  const n = coils * 2;
  for (let i = 1; i < n; i++) {
    const s = (i / n) * len;
    const side = i % 2 === 0 ? -amp : amp;
    pts.push({ x: Math.round(a.x + ux * s - uy * side), y: Math.round(a.y + uy * s + ux * side) });
  }
  pts.push({ x: Math.round(b.x), y: Math.round(b.y) });
  return pts;
}

/** Length (px) of a bullet's yellow dash, and how far ahead of its position it reaches. */
export const DASH_BACK = 5;
export const DASH_FRONT = 1;

/** The yellow dash of a bullet at `pos` flying along unit `dir` (tail, head). */
export function bulletDash(pos: Vec, dir: Vec): { tail: Vec; head: Vec } {
  return {
    tail: { x: pos.x - dir.x * DASH_BACK, y: pos.y - dir.y * DASH_BACK },
    head: { x: pos.x + dir.x * DASH_FRONT, y: pos.y + dir.y * DASH_FRONT },
  };
}

/**
 * How a rioter holds its rifle: aiming = along its facing (the aim line), flipped when pointing left so it is never
 * upside down; otherwise lowered at its side (barrel down-forward).
 */
export function riflePose(facing: Vec, aiming: boolean): { angle: number; flipY: boolean; side: number } {
  const side = facing.x < 0 ? -1 : 1;
  if (!aiming) return { angle: side < 0 ? 180 - 30 : 30, flipY: side < 0, side };
  const angle = (Math.atan2(facing.y, facing.x) * 180) / Math.PI;
  return { angle, flipY: side < 0, side };
}
