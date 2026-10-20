import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { THROWER_SHARE, pressure, tableTotal } from '../../src/sim/director';
import { Sim } from '../../src/sim/sim';
import type { Role } from '../../src/sim/types';
import { IDLE, autopilot } from './autopilot';

/** Plays rounds with instant KOs until round `n` has just started. */
function toRound(n: number, seed = 3): Sim {
  const sim = new Sim(seed, { invulnerable: true });
  for (let i = 0; i < 60 * 600 && !(sim.director.round === n && sim.director.phase === 'play'); i++) sim.step(autopilot(sim));
  expect(sim.director).toMatchObject({ round: n, phase: 'play' });
  return sim;
}

const isFill = (id: string | null, round: number, group?: number): boolean =>
  id !== null && id.startsWith(`round#${round}:fill#`) && (group === undefined || id.endsWith(`#${group}`));

describe('round balancing', () => {
  test('round rosters grow slowly: 10, 14, 18, 22, then +4, capped at 40', () => {
    expect(tableTotal(1)).toBe(10);
    expect(tableTotal(2)).toBe(14);
    expect(tableTotal(4)).toBe(22);
    expect(tableTotal(5)).toBe(26);
    expect(tableTotal(8)).toBe(38);
    expect(tableTotal(30)).toBe(CONFIG.round.maxTotal);
  });

  test('pressure rises slowly with rounds and KOs', () => {
    expect(pressure(1, 0)).toBe(1);
    expect(pressure(1, 29)).toBe(1);
    expect(pressure(2, 0)).toBe(2);
    expect(pressure(3, 30)).toBe(3);
    expect(pressure(50, 500)).toBe(CONFIG.pressureMax);
  });

  test('rioters of a round enter one by one, never more than the entry gate', () => {
    const sim = toRound(3);
    sim.rules.kos = 500; // even at max pressure
    const known = new Set(sim.horde.list.map((h) => h.lifeId));
    let maxActive = 0;
    for (let i = 0; i < 60 * 60; i++) {
      sim.step(IDLE);
      // rescue aggressors appear around their victim at once; everyone else walks in through the queue
      const entered = sim.horde.list.filter((h) => !known.has(h.lifeId) && h.role !== 'aggressor');
      expect(entered.length).toBeLessThanOrEqual(1); // never a burst
      for (const h of sim.horde.list) known.add(h.lifeId);
      maxActive = Math.max(maxActive, sim.horde.active().length);
    }
    expect(maxActive).toBeLessThanOrEqual(CONFIG.round.gate + CONFIG.rescue.aggressors[1]);
    expect(maxActive).toBeGreaterThan(4);
  });

  test('fill groups are discrete: the next one is queued only once the current one is down, then enters firstDelay later; the climax group enters 0.8 s apart', () => {
    const sim = toRound(2);
    // round 2: car (4) + rescue (3) → 7 fill rioters in two groups, the last one (4) is the climax
    for (let i = 0; i < 60 * 40; i++) sim.step(IDLE);
    const g1 = sim.horde.list.filter((h) => isFill(h.incidentId, 2, 1));
    expect(g1.length).toBe(3);
    for (const h of g1.slice(1)) sim.horde.applyHit(h.lifeId, 99);
    for (let i = 0; i < 60 * 5; i++) sim.step(IDLE);
    expect(sim.horde.list.some((h) => isFill(h.incidentId, 2, 2))).toBe(false);
    sim.horde.applyHit(g1[0]!.lifeId, 99);
    const cleared = sim.now;
    const entries: number[] = [];
    for (let i = 0; i < 60 * 10; i++) {
      const before = sim.horde.list.filter((h) => isFill(h.incidentId, 2, 2)).length;
      sim.step(IDLE);
      if (sim.horde.list.filter((h) => isFill(h.incidentId, 2, 2)).length > before) entries.push(sim.now);
    }
    expect(entries).toHaveLength(4);
    expect(entries[0]! - cleared).toBeGreaterThanOrEqual(CONFIG.round.firstDelay - CONFIG.step - 1e-9);
    expect(entries[0]! - cleared).toBeLessThanOrEqual(CONFIG.round.firstDelay + 2 * CONFIG.step + 1e-9);
    for (let k = 1; k < entries.length; k++) expect(entries[k]! - entries[k - 1]!).toBeCloseTo(CONFIG.round.climaxInterval, 1);
  });

  test('round 1 has no rock throwers; from round 2 a fifth of the fill throws rocks', () => {
    const sim = new Sim(4, { invulnerable: true });
    const roles = new Map<number, { round: number | null; role: Role; fill: boolean }>();
    for (let i = 0; i < 60 * 600 && sim.director.round <= 3; i++) {
      sim.step(autopilot(sim));
      for (const h of sim.horde.list)
        if (!roles.has(h.lifeId)) roles.set(h.lifeId, { round: h.round, role: h.role, fill: isFill(h.incidentId, h.round ?? 0) });
    }
    const all = [...roles.values()];
    expect(all.filter((r) => r.round === 1).some((r) => r.role === 'thrower')).toBe(false);
    for (const round of [2, 3]) {
      const fill = all.filter((r) => r.round === round && r.fill);
      expect(fill.length).toBeGreaterThan(0);
      expect(fill.filter((r) => r.role === 'thrower')).toHaveLength(Math.floor(fill.length * THROWER_SHARE));
    }
  });
});
