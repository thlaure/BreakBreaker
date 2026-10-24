import { CONFIG } from '../../sim/config';
import type { Rect } from '../../sim/map/district';
import type { Vec } from '../../sim/types';

/** Pure placement and motion of the Halloween decorations (render only, no Phaser, no sim rng). */

/** Two pumpkins on the pavement in front of each building, at its two ends. */
export function pumpkinSpots(buildings: readonly Rect[]): Vec[] {
  const out: Vec[] = [];
  for (const b of buildings) {
    const y = b.y + b.h + 12;
    out.push({ x: b.x + 10, y }, { x: b.x + b.w - 10, y });
  }
  return out;
}

const T = CONFIG.tile;

/** Where the friendly ghosts float: open ground on and around the main square (tile coordinates × tile size). */
export const GHOST_SPOTS: readonly Vec[] = [
  { x: 21.5 * T, y: 22.5 * T },
  { x: 34.5 * T, y: 26.5 * T },
  { x: 24.5 * T, y: 13.5 * T },
  { x: 37.5 * T, y: 13.5 * T },
];

/** Vertical bob of ghost `k` (whole px in [-3, 3]); 0 under reduced motion. */
export function ghostBob(timeMs: number, k: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.round(3 * Math.sin(timeMs / 600 + k * 1.9));
}

export const BAT_COUNT = 6;

/** Centres the bats circle around (px), spread over the map. */
const BAT_CENTRES: readonly Vec[] = [
  { x: 8 * T, y: 7 * T },
  { x: 29 * T, y: 7 * T },
  { x: 40 * T, y: 6 * T },
  { x: 24 * T, y: 20 * T },
  { x: 35 * T, y: 33 * T },
  { x: 12 * T, y: 32 * T },
];

/** Position of bat `k`: a circle of radius 30–54 px around its centre, a different speed each; hanging at the centre's top under reduced motion. */
export function batPos(timeMs: number, k: number, reducedMotion: boolean): Vec {
  const c = BAT_CENTRES[k % BAT_CENTRES.length]!;
  const r = 30 + (k % 3) * 12;
  if (reducedMotion) return { x: c.x, y: c.y - r };
  const a = (timeMs / (1400 + k * 230)) * Math.PI * 2 + k;
  return { x: Math.round(c.x + r * Math.cos(a)), y: Math.round(c.y + r * 0.5 * Math.sin(a)) };
}
