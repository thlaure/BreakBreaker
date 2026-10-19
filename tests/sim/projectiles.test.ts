import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { Rocks, type RockCtx } from '../../src/sim/projectiles';
import type { SimEvent, Vec } from '../../src/sim/types';

const grid = new Grid(DISTRICT);
const g = DISTRICT.peacefulGroup.area;
const b0 = DISTRICT.buildings[0]!;
const R = CONFIG.player.radius;
const DT = 1 / 60;

const groupBlocks = (a: Vec, b: Vec): number | null => {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (grid.isGroup({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return t;
  }
  return null;
};
const mkCtx = (player: Vec, over: Partial<RockCtx> = {}): RockCtx => ({
  player: { pos: player, r: R, invulnerable: false },
  hostiles: [],
  groupBlocks,
  victimPos: null,
  ...over,
});
const run = (rocks: Rocks, secs: number, ctx: RockCtx, dt = DT, t0 = 0): SimEvent[] => {
  const ev: SimEvent[] = [];
  let now = t0;
  for (let i = 0; i < Math.ceil(secs / dt); i++) {
    now += dt;
    ev.push(...rocks.step(dt, now, ctx));
  }
  return ev;
};
const of = (ev: SimEvent[], type: SimEvent['type']) => ev.filter((e) => e.type === type);

const open = { x: 700, y: 1100 };
const far = { x: 1300, y: 1300 };
const landTarget = { x: 900, y: 1100 };

describe('projectiles', () => {
  test('dodged rock lands recoverable (RC-11)', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(open, landTarget, 0);
    const ev = run(rocks, 2, mkCtx(far));
    expect(rocks.ground().length).toBe(1);
    expect(rocks.flying().length).toBe(0);
    expect(of(ev, 'ProjectileLanded').length).toBe(1);
  });

  test('rock hitting Paul damages once then lands (RC-12)', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(open, landTarget, 0);
    const ev = run(rocks, 2, mkCtx({ x: 800, y: 1100 }));
    const dmg = of(ev, 'PlayerDamaged');
    expect(dmg.length).toBe(1);
    expect(dmg[0]).toEqual({ type: 'PlayerDamaged', amount: 5 });
    // lands at the hit point (on Paul), so it is then auto-picked up
    expect(of(ev, 'ProjectileLanded').length).toBe(1);
    expect(rocks.ground().length + rocks.carried).toBe(1);
  });

  test('flying rock is never picked up (RC-13)', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(open, landTarget, 0);
    const ctx = mkCtx({ x: 800, y: 1100 }, { player: { pos: { x: 800, y: 1100 }, r: R, invulnerable: true } });
    let now = 0;
    while (rocks.flying().length > 0) {
      now += DT;
      rocks.step(DT, now, ctx);
      if (rocks.flying().length > 0) expect(rocks.carried).toBe(0);
      expect(now).toBeLessThan(3);
    }
    expect(rocks.ground().length).toBe(1);
  });

  test('pick up within 28 px, once (RC-14, RC-20)', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(open, landTarget, 0);
    run(rocks, 2, mkCtx(far));
    expect(rocks.ground().length).toBe(1);
    const near = mkCtx({ x: landTarget.x + 27, y: landTarget.y });
    const ev = [...rocks.step(DT, 3, near), ...rocks.step(DT, 3.02, near)];
    expect(rocks.carried).toBe(1);
    expect(of(ev, 'ProjectilePickedUp').length).toBe(1);
    expect(rocks.ground().length).toBe(0);
  });

  test('rock beyond pickup radius is not picked up', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(open, landTarget, 0);
    run(rocks, 2, mkCtx(far));
    rocks.step(DT, 3, mkCtx({ x: landTarget.x + 29, y: landTarget.y }));
    expect(rocks.carried).toBe(0);
    expect(rocks.ground().length).toBe(1);
  });

  test('stock full leaves rock on ground (RC-15)', () => {
    const rocks = new Rocks(grid);
    rocks.carried = 3;
    rocks.spawnEnemy(open, landTarget, 0);
    run(rocks, 2, mkCtx(far));
    const ev = rocks.step(DT, 3, mkCtx(landTarget));
    expect(rocks.carried).toBe(3);
    expect(rocks.ground().length).toBe(1);
    expect(of(ev, 'ProjectilePickedUp').length).toBe(0);
  });

  test('return consumes stock, empty stock does nothing (RC-16, RC-17)', () => {
    const rocks = new Rocks(grid);
    expect(rocks.returnRock(open, { x: 1, y: 0 }, 0)).toBeNull();
    expect(rocks.carried).toBe(0);
    rocks.carried = 2;
    const r = rocks.returnRock(open, { x: 1, y: 0 }, 1);
    expect(r).not.toBeNull();
    expect(rocks.carried).toBe(1);
    expect(rocks.returnRock(open, { x: 1, y: 0 }, 1.1)).toBeNull(); // cooldown
    expect(rocks.carried).toBe(1);
    expect(rocks.returnRock(open, { x: 1, y: 0 }, 1.6)).not.toBeNull();
    expect(rocks.carried).toBe(0);
    expect(rocks.returnRock(open, { x: 1, y: 0 }, 5)).toBeNull();
    expect(rocks.carried).toBe(0);
  });

  test('returned rock hits one hostile then is removed (RC-18, RC-19)', () => {
    const rocks = new Rocks(grid);
    rocks.carried = 1;
    rocks.returnRock(open, { x: 1, y: 0 }, 0);
    const hostiles = [
      { lifeId: 11, pos: { x: 780, y: 1100 }, r: 7, active: true },
      { lifeId: 12, pos: { x: 840, y: 1100 }, r: 7, active: true },
    ];
    const ev = run(rocks, 1, mkCtx(open, { hostiles }));
    const hits = of(ev, 'HitConfirmed');
    expect(hits).toEqual([{ type: 'HitConfirmed', targetLifeId: 11, damage: 1, source: 'rock' }]);
    expect(rocks.flying().length).toBe(0);
    expect(rocks.ground().length).toBe(0);
  });

  test('inactive hostile is skipped by returned rock', () => {
    const rocks = new Rocks(grid);
    rocks.carried = 1;
    rocks.returnRock(open, { x: 1, y: 0 }, 0);
    const hostiles = [
      { lifeId: 11, pos: { x: 780, y: 1100 }, r: 7, active: false },
      { lifeId: 12, pos: { x: 840, y: 1100 }, r: 7, active: true },
    ];
    const hits = of(run(rocks, 1, mkCtx(open, { hostiles })), 'HitConfirmed');
    expect(hits.length).toBe(1);
    expect((hits[0] as { targetLifeId: number }).targetLifeId).toBe(12);
  });

  test('returned rock stops on peaceful group without damage (RC-22, RC-24)', () => {
    const rocks = new Rocks(grid);
    rocks.carried = 1;
    const y = g.y + g.h / 2;
    const from = { x: g.x - 100, y };
    rocks.returnRock(from, { x: 1, y: 0 }, 0);
    const hostiles = [{ lifeId: 21, pos: { x: g.x + g.w + 30, y }, r: 7, active: true }];
    const ev = run(rocks, 1, mkCtx(from, { hostiles }));
    expect(of(ev, 'ProtectedGroupBlockedImpact').length).toBe(1);
    expect(of(ev, 'HitConfirmed').length).toBe(0);
    expect(rocks.flying().length).toBe(0);
    expect(rocks.ground().length).toBe(0);
  });

  test('enemy rock never damages hostiles and group blocks it before Paul behind', () => {
    const rocks = new Rocks(grid);
    const y = g.y + g.h / 2;
    const from = { x: g.x - 100, y };
    const to = { x: g.x + g.w + 100, y };
    rocks.spawnEnemy(from, to, 0);
    const behind = { x: g.x + g.w + 10, y };
    const ev = run(rocks, 2, mkCtx(behind, { hostiles: [{ lifeId: 1, pos: { x: g.x - 50, y }, r: 7, active: true }] }));
    expect(of(ev, 'PlayerDamaged').length).toBe(0);
    expect(of(ev, 'HitConfirmed').length).toBe(0);
    expect(rocks.flying().length + rocks.ground().length).toBe(0);
  });

  test('fast rock at 12 fps does not tunnel through Paul', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy({ x: 600, y: 1100 }, { x: 1000, y: 1100 }, 0);
    const ev = run(rocks, 3, mkCtx({ x: 800, y: 1100 }), 1 / 12);
    expect(of(ev, 'PlayerDamaged').length).toBe(1);
  });

  test('rock landing on building/group/off-map is removed', () => {
    for (const to of [
      { x: b0.x + b0.w / 2, y: b0.y + b0.h / 2 },
      { x: g.x + g.w / 2, y: g.y + g.h / 2 },
      { x: -50, y: 100 },
    ]) {
      const rocks = new Rocks(grid);
      const from = { x: to.x < 0 ? 20 : to.x, y: to.x < 0 ? 100 : to.y + 200 };
      const r = rocks.spawnEnemy(from, to, 0)!;
      run(rocks, 3, mkCtx(far));
      expect(r.state).toBe('Removed');
      expect(rocks.ground().length).toBe(0);
      expect(rocks.flying().length).toBe(0);
    }
  });

  test('flying cap 24 and ground cap 16 recycle oldest away from Paul (RC-46)', () => {
    const rocks = new Rocks(grid);
    for (let i = 0; i < 24; i++) expect(rocks.spawnEnemy(open, landTarget, 0)).not.toBeNull();
    expect(rocks.spawnEnemy(open, landTarget, 0)).toBeNull();
    run(rocks, 3, mkCtx(far));
    expect(rocks.ground().length).toBe(16);
    expect(rocks.flying().length).toBe(0);

    // fresh set: 16 landed at distinct times, then one more
    const r2 = new Rocks(grid);
    let now = 0;
    for (let i = 0; i < 17; i++) {
      r2.spawnEnemy({ x: 700, y: 1100 }, { x: 700 + 100 + i * 10, y: 1100 }, now);
      for (let k = 0; k < 90; k++) {
        now += DT;
        r2.step(DT, now, mkCtx(far));
      }
    }
    const ground = r2.ground();
    expect(ground.length).toBe(16);
    const ids = ground.map((r) => r.id);
    expect(ids).not.toContain(1); // oldest recycled
    expect(ids).toContain(17);

    // everything within 64px of Paul: new rock is dropped instead
    const r3 = new Rocks(grid);
    for (let i = 0; i < 16; i++) r3.spawnEnemy(open, { x: 800, y: 1100 }, 0);
    run(r3, 2, mkCtx({ x: 800, y: 1100 }, { player: { pos: { x: 800, y: 1100 }, r: R, invulnerable: true } }));
    // pickup would collect them; use a far Paul placed < 64 px but > pickup radius
    const r4 = new Rocks(grid);
    r4.carried = 3;
    for (let i = 0; i < 16; i++) r4.spawnEnemy(open, { x: 800, y: 1100 }, 0);
    const near = mkCtx({ x: 840, y: 1100 });
    run(r4, 2, near);
    expect(r4.ground().length).toBe(16);
    r4.spawnEnemy(open, { x: 800, y: 1100 }, 3);
    run(r4, 2, near, DT, 3);
    expect(r4.ground().length).toBe(16);
    expect(r4.ground().every((r) => r.id <= 16)).toBe(true);
  });

  test('ids and lifeIds unique, kinds cycle, removed rocks are pruned', () => {
    const rocks = new Rocks(grid);
    const a = rocks.spawnEnemy(open, landTarget, 0)!;
    const b = rocks.spawnEnemy(open, landTarget, 0)!;
    const c = rocks.spawnEnemy(open, landTarget, 0)!;
    expect(new Set([a.kind, b.kind, c.kind]).size).toBe(3);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    expect(a.lifeId).not.toBe(b.lifeId);
    rocks.carried = 0;
    run(rocks, 2, mkCtx(far));
    run(rocks, 1, mkCtx(landTarget), DT, 2);
    expect(rocks.ground().length).toBe(0);
    expect((rocks as unknown as { rocks: unknown[] }).rocks.length).toBe(0);
  });
});
