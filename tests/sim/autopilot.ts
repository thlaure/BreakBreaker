import type { Sim } from '../../src/sim/sim';
import type { InputFrame } from '../../src/sim/types';

export const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false };

/** When each hostile was first seen active, per sim (sim time). */
const seen = new WeakMap<Sim, Map<number, number>>();

/**
 * Test bot: knocks out (through the scoring path) every active hostile once it has been active `koAfterSec`
 * (default 0: as soon as it enters), skips the school cinematic, and otherwise stands still. Call once before
 * each `sim.step` and feed it the returned frame.
 */
export function autopilot(sim: Sim, opts: { koAfterSec?: number } = {}): InputFrame {
  const after = opts.koAfterSec ?? 0;
  let first = seen.get(sim);
  if (!first) {
    first = new Map();
    seen.set(sim, first);
  }
  if (sim.school.stage === 'cinematic') sim.skipCinematic();
  for (const h of sim.horde.active()) {
    const t = first.get(h.lifeId);
    if (t === undefined) first.set(h.lifeId, sim.now);
    if (sim.now - (t ?? sim.now) + 1e-9 >= after && sim.horde.applyHit(h.lifeId, 99) === 'ko') {
      sim.rules.onKnockout(h.lifeId);
      first.delete(h.lifeId);
    }
  }
  return IDLE;
}
