import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde } from '../../src/sim/hostiles';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer, damagePlayer, stepPlayer, sweep, type HostileView } from '../../src/sim/player';
import type { InputFrame, Vec } from '../../src/sim/types';

const grid = new Grid(DISTRICT);
const DT = 1 / 60;
const idle: InputFrame = {
  move: { x: 0, y: 0 },
  aim: null,
  run: false,
  strike: false,
  chargeHeld: false,
  throwRock: false,
  act: false,
  furie: false,
};
const view = (lifeId: number, pos: Vec, active = true): HostileView => ({ lifeId, pos, r: CONFIG.hostile.radius, active });

test('sweep hits at most 3, each once per swing (RC-06)', () => {
  const p = createPlayer({ x: 656, y: 720 });
  p.facing = { x: 1, y: 0 };
  const targets = [
    view(1, { x: 700, y: 720 }),
    view(2, { x: 670, y: 720 }),
    view(3, { x: 690, y: 730 }),
    view(4, { x: 680, y: 712 }),
    view(5, { x: 705, y: 715 }),
    view(6, { x: 610, y: 720 }), // behind Paul, but farther than the 3 nearest
  ];
  const r1 = sweep(p, 0, targets, grid);
  expect(r1.hits).toHaveLength(3);
  expect(r1.hits).toEqual([2, 4, 3]); // nearest first
  expect(r1.hits).not.toContain(6);
  // same swing again (within cooldown): same swingId, no repeated hits
  const r2 = sweep(p, 0.1, targets, grid);
  expect(r2.swingId).toBe(r1.swingId);
  expect(r2.hits).toEqual([]);
  // after cooldown: a new swing
  const r3 = sweep(p, CONFIG.melee.cooldown, targets, grid);
  expect(r3.swingId).toBe(r1.swingId + 1);
  expect(r3.hits).toHaveLength(3);
});

test('two hits KO a rioter, KO body takes no more hits (RC-07, RC-08)', () => {
  const horde = new Horde();
  const h = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 700, y: 720 } })!;
  expect(h.hp).toBe(2);
  expect(horde.applyHit(h.lifeId, 1)).toBe('hit');
  expect(horde.applyHit(h.lifeId, 1)).toBe('ko');
  expect(horde.applyHit(h.lifeId, 1)).toBe('ignored');
  expect(h.state).toBe('ko');
  expect(horde.list).toContain(h); // body persists
  expect(horde.active()).not.toContain(h);
  const p = createPlayer({ x: 656, y: 720 });
  p.facing = { x: 1, y: 0 };
  expect(sweep(p, 0, horde.views(), grid).hits).toEqual([]);
  expect(horde.applyHit(9999, 1)).toBe('ignored');
});

test('sweep cannot reach through a building or the group (RC-24)', () => {
  // building R(12,15,4,4): x 384..512, y 480..608 — Paul west of it, hostile north of it, line crosses the corner
  const p = createPlayer({ x: 372, y: 510 });
  p.facing = { x: 1, y: -1 };
  expect(sweep(p, 0, [view(1, { x: 410, y: 472 })], grid).hits).toEqual([]);
  // the first peaceful group: Paul just west of it, hostile just north of it, line crosses the corner
  const g = DISTRICT.peacefulGroups[0]!.area;
  const q = createPlayer({ x: g.x - 8, y: g.y + 34 });
  q.facing = { x: 1, y: -1 };
  expect(sweep(q, 0, [view(2, { x: g.x + 30, y: g.y - 8 })], grid).hits).toEqual([]);
  // control: same geometry in open ground hits
  const c = createPlayer({ x: 656, y: 760 });
  c.facing = { x: 1, y: -1 };
  expect(sweep(c, 0, [view(3, { x: 694, y: 722 })], grid).hits).toEqual([3]);
});

test('8-direction move: diagonal same speed as straight (RC-03)', () => {
  const a = createPlayer({ x: 656, y: 720 });
  const b = createPlayer({ x: 656, y: 720 });
  for (let i = 0; i < 60; i++) {
    stepPlayer(a, { ...idle, move: { x: 1, y: 0 } }, DT, i * DT, grid);
    stepPlayer(b, { ...idle, move: { x: 1, y: 1 } }, DT, i * DT, grid);
  }
  const da = Math.hypot(a.pos.x - 656, a.pos.y - 720);
  const db = Math.hypot(b.pos.x - 656, b.pos.y - 720);
  expect(da).toBeCloseTo(CONFIG.player.walk, 3);
  expect(db).toBeCloseTo(da, 3);
  expect(b.facing.x).toBeCloseTo(Math.SQRT1_2);
  expect(b.facing.y).toBeCloseTo(Math.SQRT1_2);
  // run speed, and aim overrides facing
  const c = createPlayer({ x: 656, y: 720 });
  for (let i = 0; i < 60; i++) stepPlayer(c, { ...idle, move: { x: 0, y: 1 }, run: true, aim: { x: -1, y: 0 } }, DT, i * DT, grid);
  expect(c.pos.y - 720).toBeCloseTo(CONFIG.player.run, 3);
  expect(c.facing).toEqual({ x: -1, y: 0 });
  // idle keeps last facing
  stepPlayer(b, idle, DT, 1, grid);
  expect(b.facing.x).toBeCloseTo(Math.SQRT1_2);
});

test('invulnerability window 0.6 s blocks the second hit (RC-12)', () => {
  const p = createPlayer({ x: 656, y: 720 });
  expect(damagePlayer(p, 5, 0)).toBe(true);
  expect(p.hp).toBe(95);
  expect(damagePlayer(p, 5, 0.3)).toBe(false);
  expect(p.hp).toBe(95);
  expect(damagePlayer(p, 5, 0.61)).toBe(true);
  expect(p.hp).toBe(90);
  expect(damagePlayer(p, 200, 2)).toBe(true);
  expect(p.ko).toBe(true);
  expect(p.hp).toBe(0);
});

test('circular sweep: hits a rioter behind Paul and turns him to face it', () => {
  const p = createPlayer({ x: 656, y: 720 });
  p.facing = { x: 1, y: 0 };
  const r = sweep(p, 0, [view(1, { x: 620, y: 720 })], grid);
  expect(r.hits).toEqual([1]);
  expect(p.facing.x).toBeCloseTo(-1);
  expect(p.facing.y).toBeCloseTo(0);
});

test('circular sweep still respects range', () => {
  const p = createPlayer({ x: 656, y: 720 });
  const far = CONFIG.melee.range + CONFIG.hostile.radius + 1;
  expect(sweep(p, 0, [view(1, { x: 656, y: 720 - far })], grid).hits).toEqual([]);
});
