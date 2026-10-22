/** Pure helpers of the decor fronts (CAF, TASTY CROUSTY): no Phaser import here. */

/** Gap (px) between two people of a queue, feet to feet. */
export const QUEUE_GAP = 13;
/** Half the width of a queued person (px), so the last one stays on the wall. */
const PERSON_HALF = 5;

/**
 * Feet x of the people queuing along a front, from the door outward: the first `gap` px past `from`, then every
 * QUEUE_GAP px toward `dir` (+1 east, -1 west), as many as fit before `limit` (at most `n`).
 */
export function queueSlots(from: number, limit: number, n: number, dir: 1 | -1 = 1, gap = 8): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const x = from + dir * (gap + PERSON_HALF + k * QUEUE_GAP);
    if (dir === 1 ? x + PERSON_HALF > limit : x - PERSON_HALF < limit) break;
    out.push(x);
  }
  return out;
}

/** Idle breathing of the k-th queued person: 1 px up now and then, out of phase; none under reduced motion. */
export function queueBob(timeMs: number, k: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.sin(timeMs / 800 + k * 1.7) > 0.7 ? -1 : 0;
}

/** Fryer smoke rising from the TASTY CROUSTY chimney: a slow particle plume, or none under reduced motion. */
export interface SmokeSpec {
  /** ms between two puffs. */
  frequency: number;
  lifespan: { min: number; max: number };
  speedY: { min: number; max: number };
  speedX: { min: number; max: number };
  scale: { start: number; end: number };
  alpha: { start: number; end: number };
}
export function smokeSpec(reducedMotion: boolean): SmokeSpec | null {
  if (reducedMotion) return null;
  return {
    frequency: 180,
    lifespan: { min: 2000, max: 3000 },
    speedY: { min: -22, max: -12 },
    speedX: { min: 2, max: 9 },
    scale: { start: 4, end: 10 },
    alpha: { start: 0.6, end: 0 },
  };
}

/** Lit sign glow of the fast food: a slow soft pulse (alpha), steady under reduced motion. */
export function signGlow(timeMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.22;
  return 0.18 + 0.08 * (0.5 + 0.5 * Math.sin(timeMs / 600));
}
