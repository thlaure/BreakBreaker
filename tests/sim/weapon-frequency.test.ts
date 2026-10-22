import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer } from '../../src/sim/player';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';
import { Weapons } from '../../src/sim/weapons';
import { autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const grid = new Grid(DISTRICT);
const far = (p: { x: number; y: number }) => ({ x: p.x + 1000, y: p.y + 1000 });

describe('fewer weapons: the street timer', () => {
  test('tunables: first at 20 s, then every 30–45 s, at most 1 on the ground, no drop within 200 px of a weapon on the ground', () => {
    expect(CONFIG.weapons.firstSpawn).toBe(20);
    expect(CONFIG.weapons.spawnEvery).toEqual([30, 45]);
    expect(CONFIG.weapons.maxGround).toBe(1);
    expect(CONFIG.weapons.clearRadius).toBe(200);
  });

  test('the first street weapon appears at 20 s, the next ones 30–45 s apart (picked up at once)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = new Weapons(grid, rng(seed));
      const paul = createPlayer({ ...DISTRICT.playerSpawn });
      const at: number[] = [];
      for (let t = 0; t <= 400; t += 0.5) {
        if (of(w.step(0.5, t, paul), 'WeaponSpawned').length > 0) at.push(t);
        w.ground.length = 0;
      }
      expect(at[0]).toBe(CONFIG.weapons.firstSpawn);
      for (let k = 1; k < at.length; k++) {
        expect(at[k]! - at[k - 1]!).toBeGreaterThanOrEqual(30 - 0.5);
        expect(at[k]! - at[k - 1]!).toBeLessThanOrEqual(45 + 0.5);
      }
    }
  });

  test('never more than one street weapon on the ground (a new one only once the last one expired, 60 s)', () => {
    const w = new Weapons(grid, rng(3));
    const paul = createPlayer({ ...DISTRICT.playerSpawn });
    let spawned = 0;
    for (let t = 0; t < 600; t += 1) {
      spawned += of(w.step(1, t, paul), 'WeaponSpawned').length;
      expect(w.ground.length).toBeLessThanOrEqual(1);
    }
    expect(spawned).toBeGreaterThan(1);
    expect(spawned).toBeLessThanOrEqual(Math.ceil(600 / CONFIG.weapons.groundLifetime));
  });
});

describe('fewer weapons: no piles near Paul', () => {
  const paul = DISTRICT.playerSpawn;
  const near = { x: paul.x + 150, y: paul.y };

  test('a regular drop (twist, breather) is skipped while a weapon lies within 200 px of Paul; farther away it drops', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = new Weapons(grid, rng(seed));
      w.ground.push({ id: 99, kind: 'baton', pos: { ...near }, expiresAt: null });
      expect(w.dropSpecial(paul)).toBeNull();
      expect(w.ground).toHaveLength(1);
      w.ground[0]!.pos = { x: paul.x + 260, y: paul.y };
      expect(w.dropSpecial(paul)).not.toBeNull();
    }
  });

  test('the bouclier still drops next to a weapon on the ground', () => {
    const w = new Weapons(grid, rng(1));
    w.ground.push({ id: 99, kind: 'baton', pos: { ...near }, expiresAt: null });
    expect(w.dropSpecial(paul, 'bouclier')?.kind).toBe('bouclier');
  });

  test('the street timer skips its spawn while a weapon lies within 200 px (and reschedules)', () => {
    const w = new Weapons(grid, rng(2));
    const p = createPlayer({ ...paul });
    w.ground.push({ id: 99, kind: 'marteau', pos: { ...near }, expiresAt: 1e9 });
    expect(of(w.step(1, CONFIG.weapons.firstSpawn, p), 'WeaponSpawned')).toEqual([]);
    // gone (picked up): the timer was rescheduled 30–45 s later, not retried at once
    w.ground.length = 0;
    expect(of(w.step(1, CONFIG.weapons.firstSpawn + 1, p), 'WeaponSpawned')).toEqual([]);
    let next = -1;
    for (let t = CONFIG.weapons.firstSpawn + 2; t <= CONFIG.weapons.firstSpawn + 50 && next < 0; t++)
      if (of(w.step(1, t, p), 'WeaponSpawned').length > 0) next = t;
    expect(next - CONFIG.weapons.firstSpawn).toBeGreaterThanOrEqual(30);
    expect(next - CONFIG.weapons.firstSpawn).toBeLessThanOrEqual(46);
  });

  test('the Caïd drop is skipped while a weapon lies within 200 px of Paul', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = new Weapons(grid, rng(seed));
      w.ground.push({ id: 99, kind: 'baton', pos: { ...near }, expiresAt: null });
      expect(w.dropAt({ x: paul.x + 40, y: paul.y }, paul)).toBeNull();
    }
  });
});

describe('fewer weapons: twist, Caïd and breather drops', () => {
  const paul = DISTRICT.playerSpawn;

  test('twist drop: round 2 never a bouclier, a regular weapon about 1 time in 2 (else nothing)', () => {
    let regular = 0;
    const n = 200;
    for (let seed = 1; seed <= n; seed++) {
      const { drop, special } = new Weapons(grid, rng(seed)).dropTwist(paul, 2);
      expect(special).toBeNull();
      if (drop) {
        expect(drop.kind).not.toBe('bouclier');
        regular++;
      }
    }
    expect(regular / n).toBeGreaterThan(0.38);
    expect(regular / n).toBeLessThan(0.62);
  });

  test('twist drop from round 3: a bouclier 1 in 2; otherwise a regular weapon 1 in 2 (≈ 50 / 25 / 25 %)', () => {
    let shields = 0;
    let regular = 0;
    let none = 0;
    const n = 400;
    for (let seed = 1; seed <= n; seed++) {
      const { drop, special } = new Weapons(grid, rng(seed)).dropTwist(paul, 3 + (seed % 5));
      if (special) {
        expect(drop!.kind).toBe('bouclier');
        shields++;
      } else if (drop) regular++;
      else none++;
    }
    expect(shields / n).toBeGreaterThan(0.4);
    expect(shields / n).toBeLessThan(0.6);
    expect(regular / n).toBeGreaterThan(0.17);
    expect(regular / n).toBeLessThan(0.33);
    expect(none / n).toBeGreaterThan(0.17);
    expect(none / n).toBeLessThan(0.33);
  });

  test('the Caïd drops a regular weapon about 1 time in 2 (seeded), at his position', () => {
    expect(CONFIG.caid.dropShare).toBe(0.5);
    let dropped = 0;
    const n = 200;
    for (let seed = 1; seed <= n; seed++) {
      const at = { x: paul.x + 40, y: paul.y };
      const g = new Weapons(grid, rng(seed)).dropAt(at, far(paul));
      if (g) {
        expect(g.pos).toEqual(at);
        expect(['baton', 'marteau', 'panneau']).toContain(g.kind);
        dropped++;
      }
    }
    expect(dropped / n).toBeGreaterThan(0.38);
    expect(dropped / n).toBeLessThan(0.62);
  });

  test('the breather drop comes only at the end of even rounds', () => {
    const sim = new Sim(5, { invulnerable: true });
    const orig = sim.weapons.dropSpecial.bind(sim.weapons);
    let calls = 0;
    sim.weapons.dropSpecial = (p, k) => {
      calls++;
      return orig(p, k);
    };
    const seen: { index: number; calls: number }[] = [];
    for (let i = 0; i < 60 * 1500 && sim.director.round <= 6; i++) {
      calls = 0;
      const ev = sim.step(autopilot(sim));
      for (const r of of(ev, 'RoundCompleted')) seen.push({ index: r.index, calls });
    }
    expect(seen.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const s of seen) expect(s.calls, `round ${s.index}`).toBe(s.index % 2 === 0 ? 1 : 0);
  });

  test('a session is still deterministic with the new draws', () => {
    const run = () => {
      const sim = new Sim(11, { invulnerable: true });
      const out: string[] = [];
      for (let i = 0; i < 60 * 900 && sim.director.round <= 5; i++)
        for (const e of of(sim.step(autopilot(sim, { koAfterSec: 4 })), 'WeaponSpawned')) out.push(`${sim.now.toFixed(3)}:${e.kind}`);
      return out;
    };
    expect(run()).toEqual(run());
  });
});
