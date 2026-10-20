import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { FirePatches } from '../../src/sim/firepatch';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import type { SimEvent, Vec } from '../../src/sim/types';

const grid = new Grid(DISTRICT);
const DT = 1 / 60;
const FREE: Vec = { x: 656, y: 720 };
const FP = CONFIG.firePatch;

/** Runs `sec` of steps from `t0`; `at(now)` = Paul's position; returns events and the times Paul was hurt. */
function run(fp: FirePatches, t0: number, sec: number, at: (now: number) => Vec) {
  const ev: SimEvent[] = [];
  const hurts: number[] = [];
  let now = t0;
  for (let i = 0; i < Math.round(sec / DT); i++) {
    now += DT;
    ev.push(
      ...fp.step(now, grid, at(now), (amount) => {
        expect(amount).toBe(FP.damage);
        hurts.push(now);
        return true;
      }),
    );
  }
  return { ev, hurts, now };
}

test('a bottle lands after its flight and starts a patch there', () => {
  const fp = new FirePatches();
  fp.throwBottle({ x: 856, y: 720 }, FREE, CONFIG.firebomber.flightSec);
  expect(fp.flying()).toHaveLength(1);
  const { ev } = run(fp, 0, CONFIG.firebomber.flightSec - 0.05, () => ({ x: 0, y: 0 }));
  expect(ev).toEqual([]);
  expect(fp.list).toHaveLength(0);
  const r = run(fp, CONFIG.firebomber.flightSec - 0.05, 0.1, () => ({ x: 0, y: 0 }));
  expect(r.ev).toEqual([{ type: 'FirePatchStarted', id: 1, pos: FREE }]);
  expect(fp.flying()).toHaveLength(0);
  expect(fp.list).toHaveLength(1);
});

test('standing inside hurts every 0.5 s; outside never; the patch expires at 3.5 s', () => {
  const fp = new FirePatches();
  fp.throwBottle(FREE, FREE, 0);
  const { hurts, now } = run(fp, 0, 5, () => ({ x: FREE.x + FP.radius - 2, y: FREE.y }));
  // first tick on landing, then every 0.5 s while it burns
  expect(hurts.length).toBe(Math.floor(FP.lifeSec / FP.tickSec));
  for (let k = 1; k < hurts.length; k++) expect(hurts[k]! - hurts[k - 1]!).toBeCloseTo(FP.tickSec, 6);
  expect(hurts[hurts.length - 1]!).toBeLessThan(FP.lifeSec + 1e-6);
  expect(fp.list).toHaveLength(0);
  void now;

  const out = new FirePatches();
  out.throwBottle(FREE, FREE, 0);
  expect(run(out, 0, 3, () => ({ x: FREE.x + FP.radius + 2, y: FREE.y })).hurts).toEqual([]);
});

test('secondsLeft counts down from 3.5 s', () => {
  const fp = new FirePatches();
  fp.throwBottle(FREE, FREE, 0);
  run(fp, 0, 1, () => ({ x: 0, y: 0 }));
  expect(fp.view(1)[0]!.secondsLeft).toBeCloseTo(FP.lifeSec - 1, 6);
  expect(fp.view(1)[0]!.r).toBe(FP.radius);
});

test('a refused hit (invulnerable) is retried at once, the next tick waits 0.5 s from the hit that landed', () => {
  const fp = new FirePatches();
  fp.throwBottle(FREE, FREE, 0);
  const hits: number[] = [];
  let now = 0;
  let refuse = 3;
  for (let i = 0; i < 90; i++) {
    now += DT;
    fp.step(now, grid, FREE, () => {
      if (refuse-- > 0) return false;
      hits.push(now);
      return true;
    });
  }
  expect(hits[0]).toBeCloseTo(4 * DT, 6);
  expect(hits[1]! - hits[0]!).toBeCloseTo(FP.tickSec, 6);
});

test('at most 6 patches: a 7th pushes the oldest out', () => {
  const fp = new FirePatches();
  for (let k = 0; k < 7; k++) fp.throwBottle(FREE, { x: 400 + k * 70, y: 720 }, 0);
  const { ev } = run(fp, 0, DT, () => ({ x: 0, y: 0 }));
  expect(ev.filter((e) => e.type === 'FirePatchStarted')).toHaveLength(7);
  expect(fp.list).toHaveLength(FP.maxAlive);
  expect(fp.list.map((p) => p.id)).toEqual([2, 3, 4, 5, 6, 7]);
});

test('a bottle landing in a solid lights the nearest free point, never inside the wall', () => {
  const b = DISTRICT.buildings[0]!;
  const inside = { x: b.x + 2, y: b.y + 2 };
  expect(grid.isSolidPx(inside)).toBe(true);
  const fp = new FirePatches();
  fp.throwBottle(FREE, inside, 0);
  const { ev } = run(fp, 0, DT, () => ({ x: 0, y: 0 }));
  const started = ev.filter((e): e is Extract<SimEvent, { type: 'FirePatchStarted' }> => e.type === 'FirePatchStarted');
  if (started.length === 1) {
    expect(grid.isSolidPx(started[0]!.pos)).toBe(false);
    expect(Math.hypot(started[0]!.pos.x - inside.x, started[0]!.pos.y - inside.y)).toBeLessThanOrEqual(64);
  } else expect(fp.list).toHaveLength(0);
  // deep inside a building: no free point near → skipped
  const deep = new FirePatches();
  const big = DISTRICT.buildings.reduce((a, c) => (c.w * c.h > a.w * a.h ? c : a));
  deep.throwBottle(FREE, { x: big.x + big.w / 2, y: big.y + big.h / 2 }, 0);
  run(deep, 0, DT, () => ({ x: 0, y: 0 }));
  for (const p of deep.list) expect(grid.isSolidPx(p.pos)).toBe(false);
});
