import type { SimEvent } from '../../sim/types';
import type { Shake } from '../render/fallMath';

export const HIT_STOP_MS = 60;
export const SHAKE_MS = 120;
export const SHAKE_PX = 2;
/** Tiny shake on a strike that hits in mode furie (none under prefers-reduced-motion). */
export const FURIE_SHAKE: Shake = { ms: 90, px: 1.5 };
/** Small shake when the onde d’énergie fires (none under prefers-reduced-motion). */
export const BEAM_SHAKE_MS = 160;
export const BEAM_SHAKE_PX = 2;
/** Light shake with a new danger's banner. */
export const ALERT_SHAKE: Shake = { ms: 220, px: 1.5 };
export const NEW_DANGER: ReadonlySet<SimEvent['type']> = new Set([
  'TargetIgnited',
  'CasseStarted',
  'RescueStarted',
  'MonumentAttacked',
  'CaidArrived',
]);
const BASE_W = 640;
const BASE_H = 360;
export const PAN_IN_MS = 700;
export const PAN_OUT_MS = 500;

export function integerZoom(width: number, height: number): number {
  const [bw, bh] = height > width ? [BASE_H, BASE_W] : [BASE_W, BASE_H];
  return Math.max(1, Math.floor(Math.min(width / bw, height / bh)));
}
