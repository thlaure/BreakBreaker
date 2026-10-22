import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer, sweep, type HostileView } from '../../src/sim/player';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, Vec } from '../../src/sim/types';
import { WEAPONS, Weapons } from '../../src/sim/weapons';

const grid = new Grid(DISTRICT);
const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: false };
const view = (lifeId: number, pos: Vec): HostileView => ({ lifeId, pos, r: CONFIG.hostile.radius, active: true });

describe('weapon pickups', () => {
  test('weapons appear at random over time, at most 1 on the ground, on walkable spots away from Paul', () => {
    const w = new Weapons(grid, rng(3));
    const paul = createPlayer({ ...DISTRICT.playerSpawn });
    let spawned = 0;
    for (let t = 0; t < 300; t += 1) {
      for (const e of w.step(1, t, paul)) if (e.type === 'WeaponSpawned') spawned++;
      expect(w.ground.length).toBeLessThanOrEqual(CONFIG.weapons.maxGround);
      for (const g of w.ground) {
        expect(grid.circleBlocked(g.pos, 8)).toBe(false);
        expect(grid.isGroup(g.pos)).toBe(false);
      }
    }
    expect(spawned).toBeGreaterThanOrEqual(1);
    expect(new Set(w.ground.map((g) => g.kind)).size).toBeGreaterThanOrEqual(1);
  });

  test('walking over a weapon picks it up with its full number of strikes, replacing the current one', () => {
    const w = new Weapons(grid, rng(1));
    const paul = createPlayer({ x: 656, y: 720 });
    w.ground.push({ id: 1, kind: 'baton', pos: { x: 666, y: 720 }, expiresAt: null });
    const ev = w.step(CONFIG.step, 0, paul);
    expect(ev).toContainEqual({ type: 'WeaponPickedUp', kind: 'baton' });
    expect(w.held).toEqual({ kind: 'baton', uses: WEAPONS.baton.uses });
    expect(w.ground).toHaveLength(0);
    w.ground.push({ id: 2, kind: 'panneau', pos: { x: 660, y: 720 }, expiresAt: null });
    w.step(CONFIG.step, 0, paul);
    expect(w.held).toEqual({ kind: 'panneau', uses: WEAPONS.panneau.uses });
  });

  test('each kind has its own reach, all longer than bare hands', () => {
    for (const k of Object.values(WEAPONS)) expect(k.range).toBeGreaterThan(CONFIG.melee.range);
    expect(WEAPONS.panneau.range).toBeGreaterThan(WEAPONS.marteau.range);
  });

  test('sweep uses the given reach', () => {
    const p = createPlayer({ x: 656, y: 720 });
    const t = [view(1, { x: 656 + WEAPONS.panneau.range, y: 720 })];
    expect(sweep(p, 0, t, grid).hits).toEqual([]);
    expect(sweep(p, 1, t, grid, WEAPONS.panneau.range).hits).toEqual([1]);
  });

  test('a strike that hits uses one strike; a miss is free; the weapon breaks at 0', () => {
    const w = new Weapons(grid, rng(1));
    w.held = { kind: 'marteau', uses: 2 };
    expect(w.onSwing(0)).toEqual([]);
    expect(w.held).toEqual({ kind: 'marteau', uses: 2 });
    expect(w.onSwing(3)).toEqual([]);
    expect(w.held?.uses).toBe(1);
    expect(w.onSwing(1)).toEqual([{ type: 'WeaponBroken', kind: 'marteau' }]);
    expect(w.held).toBeNull();
  });
});

describe('weapons in the Sim', () => {
  const strikeAt = (sim: Sim, at: Vec) => {
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: at })!;
    h.nextAttackAt = 99;
    sim.step({ ...IDLE, strike: true });
    return h;
  };

  test('bare hands: a rioter needs 2 hits', () => {
    const sim = new Sim(5);
    const h = strikeAt(sim, { x: sim.player.pos.x + 30, y: sim.player.pos.y });
    expect(h.state).not.toBe('ko');
    expect(h.hp).toBe(1);
  });

  test('with a weapon: one hit KOs, at the weapon reach, and uses one strike', () => {
    const sim = new Sim(5);
    sim.weapons.held = { kind: 'panneau', uses: 5 };
    const reach = WEAPONS.panneau.range - 2;
    const h = strikeAt(sim, { x: sim.player.pos.x + reach, y: sim.player.pos.y });
    expect(h.state).toBe('ko');
    expect(sim.rules.kos).toBe(1);
    expect(sim.weapons.held?.uses).toBe(4);
    expect(sim.snapshot().weapon).toEqual({ kind: 'panneau', uses: 4 });
  });

  test('snapshot lists weapons on the ground with their expiry (render reads it from there)', () => {
    const sim = new Sim(5);
    sim.weapons.ground.push({ id: 9, kind: 'marteau', pos: { x: 100, y: 100 }, expiresAt: null });
    sim.weapons.ground.push({ id: 10, kind: 'baton', pos: { x: 200, y: 100 }, expiresAt: 42 });
    expect(sim.snapshot().weaponsOnGround).toEqual([
      { id: 9, kind: 'marteau', pos: { x: 100, y: 100 }, expiresAt: null },
      { id: 10, kind: 'baton', pos: { x: 200, y: 100 }, expiresAt: 42 },
    ]);
  });
});

test('weapons last: stick 15, sign 10, hammer 8 strikes that hit', () => {
  expect(WEAPONS.baton.uses).toBe(15);
  expect(WEAPONS.panneau.uses).toBe(10);
  expect(WEAPONS.marteau.uses).toBe(8);
});

describe('special drops', () => {
  test('dropSpecial places a weapon 160–480 px from Paul now, ignoring the timer; it vanishes after 15 s', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = new Weapons(grid, rng(seed));
      const paul = createPlayer({ ...DISTRICT.playerSpawn });
      w.step(CONFIG.step, 1, paul); // before the first timed spawn
      expect(w.ground).toHaveLength(0);
      const g = w.dropSpecial(paul.pos)!;
      expect(g).not.toBeNull();
      expect(w.ground).toEqual([g]);
      expect(g.expiresAt).toBeCloseTo(1 + CONFIG.weapons.dropLifetime, 6);
      const d = Math.hypot(g.pos.x - paul.pos.x, g.pos.y - paul.pos.y);
      expect(d).toBeGreaterThanOrEqual(CONFIG.weapons.minDist - 32);
      expect(d).toBeLessThanOrEqual(CONFIG.weapons.maxDist + 32);
      expect(grid.circleBlocked(g.pos, 8)).toBe(false);
      w.step(CONFIG.step, 1 + CONFIG.weapons.dropLifetime - 0.1, paul);
      expect(w.ground.some((x) => x.id === g.id)).toBe(true);
      w.step(CONFIG.step, 1 + CONFIG.weapons.dropLifetime + 0.01, paul);
      expect(w.ground.some((x) => x.id === g.id)).toBe(false);
    }
  });

  test('a timed street spawn nobody picks up vanishes after 60 s (expiresAt set for the render blink)', () => {
    const w = new Weapons(grid, rng(3));
    const paul = createPlayer({ ...DISTRICT.playerSpawn });
    const t0 = CONFIG.weapons.firstSpawn;
    w.step(1, t0, paul);
    expect(w.ground).toHaveLength(1);
    const g = w.ground[0]!;
    expect(CONFIG.weapons.groundLifetime).toBe(60);
    expect(g.expiresAt).toBeCloseTo(t0 + CONFIG.weapons.groundLifetime, 6);
    w.step(1, t0 + CONFIG.weapons.groundLifetime - 0.1, paul);
    expect(w.ground.some((x) => x.id === g.id)).toBe(true);
    w.step(1, t0 + CONFIG.weapons.groundLifetime + 0.01, paul);
    expect(w.ground.some((x) => x.id === g.id)).toBe(false);
  });

  test('the « at most 1 street weapon on the ground » cap frees up once the weapon expires', () => {
    const w = new Weapons(grid, rng(3));
    const paul = createPlayer({ ...DISTRICT.playerSpawn });
    const spawns: number[] = [];
    for (let t = 0; t <= 300; t += 1) {
      for (const e of w.step(1, t, paul)) if (e.type === 'WeaponSpawned') spawns.push(t);
      expect(w.ground.length).toBeLessThanOrEqual(CONFIG.weapons.maxGround);
      for (const g of w.ground) expect(t).toBeLessThan(g.expiresAt!);
    }
    expect(spawns.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < spawns.length; i++) expect(spawns[i]! - spawns[i - 1]!).toBeGreaterThanOrEqual(CONFIG.weapons.groundLifetime);
  });

  test('special drops keep their 15 s; the first shooter\'s flashball lasts 60 s like the street weapons', () => {
    const w = new Weapons(grid, rng(4));
    const paul = createPlayer({ ...DISTRICT.playerSpawn });
    w.step(CONFIG.step, 2, paul);
    expect(w.dropSpecial(paul.pos)!.expiresAt).toBeCloseTo(2 + CONFIG.weapons.dropLifetime, 6);
    expect(w.dropSpecial(paul.pos, 'bouclier')!.expiresAt).toBeCloseTo(2 + CONFIG.weapons.dropLifetime, 6);
    const f = w.dropNear(paul.pos, 'flashball', 120, 220)!;
    expect(f.expiresAt).toBeCloseTo(2 + CONFIG.weapons.groundLifetime, 6);
  });

  test('expiry is deterministic per seed', () => {
    const run = () => {
      const w = new Weapons(grid, rng(11));
      const paul = createPlayer({ ...DISTRICT.playerSpawn });
      const log: string[] = [];
      for (let t = 0; t <= 400; t += 0.5)
        for (const e of w.step(0.5, t, paul)) if (e.type === 'WeaponSpawned') log.push(`${t}:${e.kind}:${e.pos.x},${e.pos.y}`);
      return { log, ground: w.ground.map((g) => ({ ...g })) };
    };
    expect(run()).toEqual(run());
  });
});
