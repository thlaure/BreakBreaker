import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { RESCUE_COUNT, THROWER_SHARE, pressure, tableTotal } from '../../src/sim/director';
import { occupierCount } from '../../src/sim/monument';
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
    // round 4: its fill (roster − attack − rescue) makes at least two groups (the runner pack is one of them)
    const R = 4;
    const sim = toRound(R);
    // the second beat is the monument occupation (first one: 6 occupiers) or the rescue
    const second = sim.director.plan!.beats.flat().includes('monument') ? occupierCount(1, R) : RESCUE_COUNT;
    const objective = sim.attacks.filter((a) => a.round === R).reduce((n, a) => n + a.total(), 0) + second;
    const plan = sim.director.fillPlan();
    expect(plan.reduce((n, g) => n + g.size, 0)).toBe(sim.director.total - objective);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.filter((g) => g.pack)).toHaveLength(1);
    expect(plan[plan.length - 1]!.climax).toBe(true);
    const size = (g: number): number => plan[g - 1]!.size;
    // everyone but the fill is knocked out at once (objective rioters would otherwise hold the entry gate)
    const step = (): void => {
      for (const h of sim.horde.active())
        if (!isFill(h.incidentId, R) && sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId);
      sim.step(IDLE);
    };
    for (let i = 0; i < 60 * 40; i++) step();
    const g1 = sim.horde.list.filter((h) => isFill(h.incidentId, R, 1));
    expect(g1.length).toBe(size(1));
    for (const h of g1.slice(1)) sim.horde.applyHit(h.lifeId, 99);
    for (let i = 0; i < 60 * 5; i++) step();
    expect(sim.horde.list.some((h) => isFill(h.incidentId, R, 2))).toBe(false);
    sim.horde.applyHit(g1[0]!.lifeId, 99);
    const cleared = sim.now;
    const entries: number[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      const before = sim.horde.list.filter((h) => isFill(h.incidentId, R, 2)).length;
      step();
      if (sim.horde.list.filter((h) => isFill(h.incidentId, R, 2)).length > before) entries.push(sim.now);
    }
    expect(entries).toHaveLength(size(2));
    expect(entries[0]! - cleared).toBeGreaterThanOrEqual(CONFIG.round.firstDelay - CONFIG.step - 1e-9);
    expect(entries[0]! - cleared).toBeLessThanOrEqual(CONFIG.round.firstDelay + 2 * CONFIG.step + 1e-9);
    // the climax group and the runner pack come 0.8 s apart
    const interval = plan[1]!.climax || plan[1]!.pack ? CONFIG.round.climaxInterval : CONFIG.round.interval;
    for (let k = 1; k < entries.length; k++) expect(entries[k]! - entries[k - 1]!).toBeCloseTo(interval, 1);
  });

  test('round 1 has no rock throwers; from round 2 a fifth of the fill (outside the runner pack) throws rocks', () => {
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
      const fill = all.filter((r) => r.round === round && r.fill && r.role !== 'runner');
      expect(fill.length).toBeGreaterThan(0);
      expect(fill.filter((r) => r.role === 'thrower')).toHaveLength(Math.floor(fill.length * THROWER_SHARE));
    }
  });
});
