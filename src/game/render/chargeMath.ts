/** Radius (px) of the onde d’énergie charge ring drawn around Paul (clears his sprite). */
export const CHARGE_RING_R = 16;
/** Height (px) above Paul's feet of the ring's centre (mid-body). */
export const CHARGE_RING_Y = 12;

/**
 * The charge ring's progress arc: from 12 o’clock (`start`, radians, Phaser's y-down convention) clockwise to `end`,
 * a full turn at `progress` 1 (clamped to [0, 1]).
 */
export function chargeRing(progress: number): { start: number; end: number; radius: number } {
  const p = Math.max(0, Math.min(1, progress));
  const start = -Math.PI / 2;
  return { start, end: start + p * 2 * Math.PI, radius: CHARGE_RING_R };
}
