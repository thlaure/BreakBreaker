import { expect, test, vi } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde, type HordeCtx } from '../../src/sim/hostiles';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer, type Player } from '../../src/sim/player';
import { Rocks } from '../../src/sim/projectiles';
import type { SimEvent, Vec } from '../../src/sim/types';

const grid = new Grid(DISTRICT);
const DT = 1 / 60;

const mkCtx = (player: Player, over: Partial<HordeCtx> = {}): HordeCtx => ({
  player,
  grid,
  fields: { player: new FlowField(grid), school: new FlowField(grid), victim: null },
  rocks: new Rocks(grid),
  facadePoints: DISTRICT.school.facadePoints,
  victimPos: null,
  schoolStanding: true,
  pressure: 1,
  ...over,
});
const d = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

test('thrower winds up >= 0.6 s before rock exists (RC-10)', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  const horde = new Horde();
  horde.spawn({ variant: 'antifa', role: 'thrower', pos: { x: 856, y: 720 } });
  let t0: number | null = null;
  let started: Extract<SimEvent, { type: 'EnemyThrowStarted' }> | null = null;
  let rockAt: number | null = null;
  for (let i = 0; i < 180 && rockAt === null; i++) {
    const now = i * DT;
    for (const e of horde.step(DT, now, ctx)) {
      if (e.type === 'EnemyThrowStarted' && t0 === null) {
        t0 = now;
        started = e;
      }
    }
    if (t0 === null) expect(ctx.rocks.flying()).toHaveLength(0);
    else if (now < t0 + CONFIG.rock.windupMin - 1e-9) expect(ctx.rocks.flying()).toHaveLength(0);
    else if (ctx.rocks.flying().length > 0) rockAt = now;
  }
  expect(t0).not.toBeNull();
  expect(started!.to).toEqual({ x: 656, y: 720 });
  expect(started!.until).toBeCloseTo(t0! + CONFIG.rock.windupMin, 6);
  expect(rockAt).not.toBeNull();
  expect(rockAt! - t0!).toBeGreaterThanOrEqual(CONFIG.rock.windupMin - 1e-9);
  expect(ctx.rocks.flying()[0]!.to).toEqual({ x: 656, y: 720 });
});

test('no more than 2 contact windups at pressure 1', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  const horde = new Horde();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 656 + Math.cos(a) * 17, y: 720 + Math.sin(a) * 17 } });
  }
  let maxWind = 0;
  let damage = 0;
  for (let i = 0; i < 300; i++) {
    for (const e of horde.step(DT, i * DT, ctx)) if (e.type === 'PlayerDamaged') {
      expect(e.amount).toBe(5);
      damage++;
    }
    const w = horde.list.filter((h) => h.state === 'windup').length;
    expect(w).toBeLessThanOrEqual(2);
    maxWind = Math.max(maxWind, w);
  }
  expect(maxWind).toBe(2);
  expect(damage).toBeGreaterThan(0);
});

test('higher pressure raises windup limit and damage', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player, { pressure: 12 });
  const horde = new Horde();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 656 + Math.cos(a) * 17, y: 720 + Math.sin(a) * 17 } });
  }
  let maxWind = 0;
  const amounts = new Set<number>();
  for (let i = 0; i < 120; i++) {
    for (const e of horde.step(DT, i * DT, ctx)) if (e.type === 'PlayerDamaged') amounts.add(e.amount);
    maxWind = Math.max(maxWind, horde.list.filter((h) => h.state === 'windup').length);
  }
  expect(maxWind).toBe(4);
  expect([...amounts]).toEqual([11]);
});

test('contact hit is dodged by moving out of reach during windup', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  const horde = new Horde();
  const h = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 674, y: 720 } })!;
  horde.step(DT, 0, ctx);
  expect(h.state).toBe('windup');
  player.pos = { x: 556, y: 720 };
  const ev: SimEvent[] = [];
  for (let i = 1; i <= 40; i++) ev.push(...horde.step(DT, i * DT, ctx));
  expect(ev.filter((e) => e.type === 'PlayerDamaged')).toHaveLength(0);
});

test('degrader reaches facade and enters degrade; switches to player when school destroyed', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  const horde = new Horde();
  const h = horde.spawn({ variant: 'palestinian', role: 'degrader', pos: { x: 300, y: 400 } })!;
  expect(h.target).toBe('facade');
  let i = 0;
  for (; i < 600 && h.state !== 'degrade'; i++) horde.step(DT, i * DT, ctx);
  expect(h.state).toBe('degrade');
  expect(Math.min(...DISTRICT.school.facadePoints.map((f) => d(f, h.pos)))).toBeLessThanOrEqual(24);
  ctx.schoolStanding = false;
  horde.step(DT, i * DT, ctx);
  expect(h.target).toBe('player');
  expect(h.state).not.toBe('degrade');
});

test('aggressor threatens the victim', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const victimPos = DISTRICT.rescueSites[0]!;
  const vf = new FlowField(grid);
  const ctx = mkCtx(player, { victimPos, fields: { player: new FlowField(grid), school: new FlowField(grid), victim: vf } });
  const horde = new Horde();
  const h = horde.spawn({ variant: 'classic', role: 'aggressor', pos: { x: victimPos.x + 100, y: victimPos.y }, incidentId: 'r1' })!;
  expect(h.target).toBe('victim');
  for (let i = 0; i < 300 && h.state !== 'threaten'; i++) horde.step(DT, i * DT, ctx);
  expect(h.state).toBe('threaten');
  expect(d(h.pos, victimPos)).toBeLessThanOrEqual(24);
});

test('spawn returns null beyond 40 active hostiles (RC-46)', () => {
  const horde = new Horde();
  const ids = new Set<number>();
  for (let k = 0; k < CONFIG.caps.hostiles; k++) {
    const h = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 600 + k, y: 720 } });
    expect(h).not.toBeNull();
    ids.add(h!.lifeId);
  }
  expect(ids.size).toBe(40);
  expect(horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 600, y: 720 } })).toBeNull();
  const first = horde.list[0]!;
  horde.applyHit(first.lifeId, 2);
  const again = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 600, y: 720 } });
  expect(again).not.toBeNull();
  expect(ids.has(again!.lifeId)).toBe(false); // lifeId never reused
});

test('KO bodies are capped at 16, oldest removed first', () => {
  const horde = new Horde();
  const kos: number[] = [];
  for (let k = 0; k < 20; k++) {
    const h = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 600, y: 720 } })!;
    horde.applyHit(h.lifeId, 2);
    kos.push(h.lifeId);
  }
  const bodies = horde.list.filter((h) => h.state === 'ko').map((h) => h.lifeId);
  expect(bodies).toEqual(kos.slice(4));
});

test('stuck hostile still reaches Paul around the group within 20 s', () => {
  // group area x 768..896, y 576..672: Paul north of it, hostile south of it
  const player = createPlayer({ x: 832, y: 540 });
  const ctx = mkCtx(player);
  const horde = new Horde();
  const h = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 832, y: 700 } })!;
  let reached = false;
  for (let i = 0; i < 20 * 60 && !reached; i++) {
    horde.step(DT, i * DT, ctx);
    expect(grid.circleBlocked(h.pos, CONFIG.hostile.radius)).toBe(false);
    if (d(h.pos, player.pos) <= 24) reached = true;
  }
  expect(reached).toBe(true);
});

test('crowd around Paul never rebuilds the player field more than once per 0.25 s', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  const spy = vi.spyOn(ctx.fields.player, 'rebuild');
  const horde = new Horde();
  for (let k = 0; k < 30; k++) {
    const ring = 20 + 14 * Math.floor(k / 8);
    const a = (k / 8) * Math.PI * 2 + Math.floor(k / 8) * 0.3;
    horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 656 + Math.cos(a) * ring, y: 720 + Math.sin(a) * ring } });
  }
  for (let i = 0; i < 600; i++) horde.step(DT, i * DT, ctx);
  expect(horde.active()).toHaveLength(30);
  expect(spy.mock.calls.length).toBeLessThanOrEqual(10 / 0.25 + 1);
});

test('degrader genuinely stuck on a trunk advances to the next facade point', () => {
  // trunk at (336,368) r6: the straight line x=328 clears it by 8 px (point-clear) but a r7 body snags on it
  const player = createPlayer({ x: 656, y: 720 });
  const A = { x: 328, y: 300 };
  const B = { x: 200, y: 320 };
  const ctx = mkCtx(player, { facadePoints: [A, B] });
  const horde = new Horde();
  const h = horde.spawn({ variant: 'classic', role: 'degrader', pos: { x: 328, y: 420 } })!;
  let i = 0;
  let stuckSeen = false;
  for (; i < 900 && h.state !== 'degrade'; i++) {
    horde.step(DT, i * DT, ctx);
    if (i === 120) stuckSeen = h.pos.y > 370; // held below the trunk for 2 s (no progress)
  }
  expect(stuckSeen).toBe(true);
  expect(h.state).toBe('degrade');
  expect(d(h.pos, B)).toBeLessThanOrEqual(24); // stuck branch moved its goal from A to B
  expect(d(h.pos, A)).toBeGreaterThan(24);
});

test('EnemyRockThrown fires on the step the enemy rock is spawned, with its id', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  const horde = new Horde();
  horde.spawn({ variant: 'antifa', role: 'thrower', pos: { x: 856, y: 720 } });
  const thrown: number[] = [];
  for (let i = 0; i < 180 && thrown.length === 0; i++) {
    const before = ctx.rocks.flying().length;
    for (const e of horde.step(DT, i * DT, ctx)) if (e.type === 'EnemyRockThrown') thrown.push(e.rockId);
    if (thrown.length === 0) expect(ctx.rocks.flying()).toHaveLength(before);
  }
  expect(thrown).toHaveLength(1);
  expect(ctx.rocks.flying().map((r) => r.id)).toEqual(thrown);
});

test('no EnemyRockThrown when the flying cap cancels the throw', () => {
  const player = createPlayer({ x: 656, y: 720 });
  const ctx = mkCtx(player);
  vi.spyOn(ctx.rocks, 'spawnEnemy').mockReturnValue(null);
  const horde = new Horde();
  horde.spawn({ variant: 'antifa', role: 'thrower', pos: { x: 856, y: 720 } });
  let started = 0;
  for (let i = 0; i < 180; i++)
    for (const e of horde.step(DT, i * DT, ctx)) {
      expect(e.type).not.toBe('EnemyRockThrown');
      if (e.type === 'EnemyThrowStarted') started++;
    }
  expect(started).toBeGreaterThan(0);
});
