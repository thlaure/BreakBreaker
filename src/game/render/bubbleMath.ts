import type { Vec } from '../../sim/types';

/**
 * Pure curves of the bouclier's protection bubble (render/specials.ts draws it). Everything returns whole pixels where
 * a size or a position is concerned, so the bubble stays crisp under the integer camera zoom.
 */

/** Resting radius of the bubble around Paul, px. */
export const BUBBLE_R = 24;
/** Height of the bubble's centre above Paul's feet (sprite origin), px: it wraps his whole body. */
export const BUBBLE_LIFT = 13;
/** Pulse: ±1 px over this period (none with reduced motion). */
export const BUBBLE_PULSE_MS = 900;
/** The bubble flickers, faster and faster, during its last seconds, then pops. */
export const BUBBLE_FLICKER_SEC = 3;
/** Pop ring when the bubble expires (or is dropped): duration and how far it grows past the bubble. */
export const POP_MS = 280;
export const POP_GROW_PX = 10;
/** Ripple ring where something hits the bubble, and the brief rim flash. */
export const RIPPLE_MS = 320;
export const RIPPLE_MAX_PX = 10;
/** Moving highlight arc: one turn in this long, and its length (radians). */
export const HIGHLIGHT_TURN_MS = 4000;
export const HIGHLIGHT_ARC = 1.1;
/** Highlight angle with reduced motion: fixed on the upper left (radians, screen: y down). */
export const HIGHLIGHT_REST = (-3 * Math.PI) / 4;

/** Bubble radius (whole px): BUBBLE_R ± 1 px gentle pulse; BUBBLE_R with reduced motion. */
export function bubbleRadius(nowMs: number, reducedMotion = false): number {
  if (reducedMotion) return BUBBLE_R;
  return BUBBLE_R + Math.round(Math.sin((2 * Math.PI * nowMs) / BUBBLE_PULSE_MS));
}

/**
 * Opacity multiplier of the bubble (0..1). Full until its last BUBBLE_FLICKER_SEC; then it fades toward 0.55 and,
 * without reduced motion, flickers off (×0.3) on a period shrinking from 240 ms to 60 ms as the time runs out. With
 * reduced motion: the fade only, no flicker.
 */
export function bubbleAlpha(secondsLeft: number, nowMs: number, reducedMotion = false): number {
  if (secondsLeft >= BUBBLE_FLICKER_SEC) return 1;
  const f = Math.max(0, Math.min(1, secondsLeft / BUBBLE_FLICKER_SEC));
  const fade = 0.55 + 0.45 * f;
  if (reducedMotion) return fade;
  const period = 60 + 180 * f;
  const off = Math.floor(nowMs / (period / 2)) % 2 === 1;
  return off ? fade * 0.3 : fade;
}

/** Start angle (radians) of the highlight arc: slowly circling; fixed upper left with reduced motion. */
export function highlightAngle(nowMs: number, reducedMotion = false): number {
  if (reducedMotion) return HIGHLIGHT_REST;
  return HIGHLIGHT_REST + (2 * Math.PI * (nowMs % HIGHLIGHT_TURN_MS)) / HIGHLIGHT_TURN_MS;
}

/** Pop ring `ms` after the bubble went: whole-px radius growing from `r` by POP_GROW_PX, alpha 1 → 0; null when over. */
export function popRing(ms: number, r: number = BUBBLE_R): { r: number; alpha: number } | null {
  if (ms < 0 || ms >= POP_MS) return null;
  const t = ms / POP_MS;
  return { r: Math.round(r + POP_GROW_PX * t), alpha: 1 - t };
}

/** Ripple ring `ms` after a hit: whole-px radius 2 → RIPPLE_MAX_PX, alpha 1 → 0; null when over. */
export function rippleRing(ms: number): { r: number; alpha: number } | null {
  if (ms < 0 || ms >= RIPPLE_MS) return null;
  const t = ms / RIPPLE_MS;
  return { r: Math.round(2 + (RIPPLE_MAX_PX - 2) * t), alpha: 1 - t };
}

/**
 * Where a hit shows on the bubble: the rim point (whole px) of the bubble centred on `center` (radius `r`) in the
 * direction from Paul's feet `feet` to the sim's block position `hit`; straight up when they coincide.
 */
export function rimPoint(center: Vec, feet: Vec, hit: Vec, r: number = BUBBLE_R): Vec {
  const dx = hit.x - feet.x;
  const dy = hit.y - feet.y;
  const l = Math.hypot(dx, dy);
  const ux = l > 1e-6 ? dx / l : 0;
  const uy = l > 1e-6 ? dy / l : -1;
  return { x: Math.round(center.x + ux * r), y: Math.round(center.y + uy * r) };
}
