import type { Snapshot } from '../sim/sim';
import { SFX } from './assets';

export type Sfx = (typeof SFX)[number];

/**
 * Fire loop level for a frame: 0 when no target is attacked or burning, else 0.35..1 following the lowest health among
 * them (a fire still going out after its attack keeps the loop at its floor).
 */
export function threatLevel(s: Snapshot): number {
  if (s.ended) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const t of s.targets) if (t.state === 'attacked' || t.burning) min = Math.min(min, t.hp / t.maxHp);
  return min === Number.POSITIVE_INFINITY ? 0 : 0.35 + 0.65 * (1 - Math.max(0, Math.min(1, min)));
}

/** Playback rate of the heavier hits (brute, Caïd). */
export const HEAVY_RATE = 0.7;

/**
 * Impact one-shots (hits, hurt, thuds and the synthesised tock / pop / thump / boing / clank) play at a slightly random
 * pitch, ±PITCH_JITTER of their rate, so a run of hits does not sound mechanical. Render only (Math.random, never the
 * sim's stream); sirens, the alarm, chimes and the hums keep their exact pitch.
 */
export const PITCH_JITTER = 0.06;
const IMPACT_SFX: ReadonlySet<Sfx> = new Set<Sfx>(['hit1', 'hit2', 'hit3', 'hurt', 'land']);

/** The sample is an impact one-shot whose pitch is jittered. */
export function isImpactSfx(key: Sfx): boolean {
  return IMPACT_SFX.has(key);
}

/** Rate factor for one draw `r` in [0, 1): 1 ± PITCH_JITTER. */
export function pitchJitter(r: number): number {
  return 1 + (r * 2 - 1) * PITCH_JITTER;
}
