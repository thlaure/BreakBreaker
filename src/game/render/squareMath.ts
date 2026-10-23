/** Pure helpers of the main square's fronts (church, château, sauna): no Phaser import here. */
import type { Rect } from '../../sim/map/district';
import type { Vec } from '../../sim/types';
import { FACADE_H } from './geometry';

/** The sauna's hanging board (French, in-game text). */
export const SAUNA_SIGN = 'Sauna – Ne pas déranger';

/** Half the width (px) of the château balcony's floor slab. */
export const BALCONY_HALF_W = 20;

/**
 * World px of the centre of the château balcony floor: over the door tile (`doorX` its left edge), on the top of the
 * front wall, so the balcony juts out over the gate and faces the square (south).
 */
export function chateauBalcony(b: Rect, doorX: number, tile: number): Vec {
  const x = Math.min(Math.max(doorX + tile / 2, b.x + BALCONY_HALF_W), b.x + b.w - BALCONY_HALF_W);
  return { x, y: b.y + b.h - FACADE_H };
}

/** Steam rising from the sauna's stove pipe: a soft white particle plume, or none under reduced motion. */
export interface SteamSpec {
  /** ms between two puffs. */
  frequency: number;
  lifespan: { min: number; max: number };
  speedY: { min: number; max: number };
  speedX: { min: number; max: number };
  scale: { start: number; end: number };
  alpha: { start: number; end: number };
}
export function steamSpec(reducedMotion: boolean): SteamSpec | null {
  if (reducedMotion) return null;
  return {
    frequency: 140,
    lifespan: { min: 1600, max: 2600 },
    speedY: { min: -30, max: -16 },
    speedX: { min: -6, max: 6 },
    scale: { start: 3, end: 9 },
    alpha: { start: 0.55, end: 0 },
  };
}

/** The sauna lantern's warm light (alpha): a gentle candle flicker, steady under reduced motion. */
export function lanternGlow(timeMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.2;
  return 0.16 + 0.06 * Math.abs(Math.sin(timeMs / 190) * Math.sin(timeMs / 317));
}

/** Slow drift (px, -1..1) of the k-th blurry silhouette behind the steamed glass; none under reduced motion. */
export function silhouetteDrift(timeMs: number, k: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.round(Math.sin(timeMs / 1400 + k * 2.1));
}
