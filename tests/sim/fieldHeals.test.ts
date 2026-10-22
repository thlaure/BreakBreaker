import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { FieldHeals } from '../../src/sim/fieldHeals';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { dist } from '../../src/sim/math';
import { createPlayer } from '../../src/sim/player';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import { Sim } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';
import { autopilot } from './autopilot';

const F = CONFIG.fieldHeal;
const grid = new Grid(DISTRICT);

function setup(seed = 1) {
  const heals = new FieldHeals(grid, rng(seed));
  const player = createPlayer(DISTRICT.playerSpawn);
  const rules = new Rules();
  let now = 0;
  const step = (dt = CONFIG.step) => {
    now += dt;
    return heals.step(now, { player, rules });
  };
  return { heals, player, rules, step, at: () => now };
}

const dropped = (ev: SimEvent[]) => ev.filter((e) => e.type === 'SmallHealDropped');

describe('field heals (unit)', () => {
  test('every 8th eligible KO drops one near Paul, not on him, on a walkable spot away from walls', () => {
    const { heals, player, step } = setup();
    heals.count(F.every - 1);
    expect(dropped(step())).toEqual([]);
    heals.count(1);
    const ev = dropped(step());
    expect(ev).toHaveLength(1);
    const h = heals.ground[0]!;
    const d = dist(h.pos, player.pos);
    expect(d).toBeGreaterThanOrEqual(F.minDist - 1e-6);
    expect(d).toBeLessThanOrEqual(F.maxDist + grid.tile);
    expect(d).toBeGreaterThan(F.pickupRadius);
    expect(grid.circleBlocked(h.pos, F.wallClear)).toBe(false);
    expect(grid.lineClear(player.pos, h.pos)).toBe(true);
    expect(ev[0]).toEqual({ type: 'SmallHealDropped', id: h.id, pos: h.pos });
  });

  test('at most two on the ground; the next one waits (counter keeps its remainder) and drops once a place frees', () => {
    const { heals, player, step } = setup(3);
    heals.count(F.every * 2);
    step();
    expect(heals.ground).toHaveLength(2);
    // a third tranche plus 3: one waits, 3 stay in the counter
    heals.count(F.every + 3);
    expect(dropped(step())).toEqual([]);
    expect(heals.ground).toHaveLength(2);
    expect(heals.pending()).toBe(F.every + 3);
    // many more KOs while full: at most one heal waits (no hidden pile)
    heals.count(F.every * 5);
    step();
    expect(heals.pending()).toBe(F.every * 2 - 1);
    // Paul picks one up: the waiting one drops, the remainder (7) stays
    player.hp = 50;
    player.pos = { ...heals.ground[0]!.pos };
    const ev = step();
    expect(ev.some((e) => e.type === 'SmallHealPicked')).toBe(true);
    expect(dropped(ev)).toHaveLength(1);
    expect(heals.ground).toHaveLength(2);
    expect(heals.pending()).toBe(F.every - 1);
  });

  test('pickup heals +10 and clamps at max health; at full health it stays', () => {
    const { heals, player, step } = setup(5);
    heals.count(F.every);
    step();
    const h = heals.ground[0]!;
    player.pos = { ...h.pos };
    expect(step().filter((e) => e.type === 'SmallHealPicked')).toEqual([]);
    expect(heals.ground).toHaveLength(1);
    player.hp = 95;
    expect(step().filter((e) => e.type === 'SmallHealPicked')).toEqual([{ type: 'SmallHealPicked', id: h.id, amount: 5 }]);
    expect(player.hp).toBe(CONFIG.player.maxHp);
    expect(heals.ground).toHaveLength(0);

    heals.count(F.every);
    step();
    player.hp = 40;
    player.pos = { ...heals.ground[0]!.pos };
    step();
    expect(player.hp).toBe(40 + F.amount);
  });

  test('a KO Paul or an ended session takes nothing', () => {
    const { heals, player, rules, step } = setup(6);
    heals.count(F.every);
    step();
    player.hp = 50;
    rules.end('quit');
    player.pos = { ...heals.ground[0]!.pos };
    step();
    expect(player.hp).toBe(50);
    expect(heals.ground).toHaveLength(1);
  });

  test('it expires after 20 s (expiresAt set for the render blink)', () => {
    const { heals, step, at } = setup(7);
    heals.count(F.every);
    step();
    const h = heals.ground[0]!;
    expect(h.expiresAt).toBeCloseTo(at() + F.lifeSec, 6);
    while (at() < h.expiresAt - 0.5) step();
    expect(heals.ground).toHaveLength(1);
    for (let i = 0; i < 60; i++) step();
    expect(heals.ground).toHaveLength(0);
  });

  test('deterministic: same seed, same spots', () => {
    const a = setup(11);
    const b = setup(11);
    for (const s of [a, b]) {
      s.heals.count(F.every * 2);
      s.step();
    }
    expect(a.heals.ground).toEqual(b.heals.ground);
  });
});

describe('field heals in the sim', () => {
  test('round-roster KOs feed the counter: 8 KOs → one heal; snapshot exposes it', () => {
    const sim = new Sim(1, { invulnerable: true });
    const all: SimEvent[] = [];
    for (let i = 0; i < 60 * 120 && sim.rules.kos < F.every; i++) all.push(...sim.step(autopilot(sim)));
    for (let i = 0; i < 3; i++) all.push(...sim.step(autopilot(sim)));
    expect(dropped(all).length).toBeGreaterThanOrEqual(1);
    expect(sim.snapshot().fieldHeals.length).toBeGreaterThanOrEqual(1);
    const s = sim.snapshot().fieldHeals[0]!;
    expect(s).toEqual({ id: s.id, pos: s.pos, expiresAt: s.expiresAt });
  });

  test('patrol KOs do not count', () => {
    const sim = new Sim(2, { invulnerable: true });
    // through the intro: no round yet; patrol-like hostiles (round null) KO'd never feed the counter
    for (let i = 0; i < 60; i++) sim.step(autopilot(sim));
    for (let k = 0; k < F.every * 2; k++) {
      const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { ...DISTRICT.hostileSpawns[0]! } })!;
      sim.horde.applyHit(h.lifeId, 99);
      sim.rules.onKnockout(h.lifeId, h.pos);
    }
    for (let i = 0; i < 5; i++) sim.step(autopilot(sim));
    expect(sim.snapshot().fieldHeals).toEqual([]);
  });

  test('two sims with the same seed drop the same heals', () => {
    const run = () => {
      const sim = new Sim(9, { invulnerable: true });
      const out: SimEvent[] = [];
      for (let i = 0; i < 60 * 90; i++) out.push(...sim.step(autopilot(sim)));
      return dropped(out);
    };
    const a = run();
    expect(a.length).toBeGreaterThan(0);
    expect(run()).toEqual(a);
  });
});
