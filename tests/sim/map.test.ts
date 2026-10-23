import { describe, expect, test } from 'vitest';
import { DISTRICT, targetDoor, type Rect } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { moveCircle } from '../../src/sim/map/collide';
import { FlowField } from '../../src/sim/map/flowfield';
import { SpatialHash } from '../../src/sim/spatial';
import { dist, norm, scale } from '../../src/sim/math';

const grid = new Grid(DISTRICT);
const open = { x: 700, y: 1100 };
const b0 = DISTRICT.buildings[0]!;
const leftOfBuilding = { x: b0.x - 40, y: b0.y + b0.h / 2 };
const g = DISTRICT.peacefulGroups[0]!.area;
const C = (tx: number, ty: number) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
const R = (tx: number, ty: number, tw: number, th: number): Rect => ({ x: tx * 32, y: ty * 32, w: tw * 32, h: th * 32 });
/** Gap between two rects (0 when they touch or overlap). */
const rectGap = (a: Rect, b: Rect): number =>
  Math.hypot(Math.max(b.x - (a.x + a.w), 0, a.x - (b.x + b.w)), Math.max(b.y - (a.y + a.h), 0, a.y - (b.y + b.h)));
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** The square's doors: town hall, church, château, sauna. */
const CHURCH_DOOR = C(27, 30);
const decorDoor = (id: string) => DISTRICT.decor.find((d) => d.id === id)!.door;
const squareDoors = () => [targetDoor('townHall'), CHURCH_DOOR, decorDoor('chateau'), decorDoor('sauna')];
const frontOfGroup = { x: g.x - 32, y: g.y + g.h / 2 };
const behindGroup = { x: g.x + g.w + 32, y: g.y + g.h / 2 };

describe('map', () => {
  test('diagonal move is not faster than straight', () => {
    const p1 = moveCircle(grid, open, { x: 3, y: 0 }, 7);
    const p2 = moveCircle(grid, open, scale(norm({ x: 1, y: 1 }), 3), 7);
    expect(dist(open, p2)).toBeCloseTo(dist(open, p1), 5);
  });
  test('cannot walk through a building or a trunk (RC-51)', () => {
    let p = leftOfBuilding;
    for (let i = 0; i < 200; i++) p = moveCircle(grid, p, { x: 3, y: 0 }, 7);
    expect(grid.isSolidPx(p)).toBe(false);
    expect(p.x).toBeLessThan(b0.x);
    const t = DISTRICT.trunks[0]!;
    let q = { x: t.x - 60, y: t.y };
    for (let i = 0; i < 100; i++) q = moveCircle(grid, q, { x: 3, y: 0 }, 7);
    expect(q.x).toBeLessThan(t.x);
  });
  test('map edge is solid', () => {
    let p = { x: 20, y: 700 };
    for (let i = 0; i < 50; i++) p = moveCircle(grid, p, { x: -3, y: 0 }, 7);
    expect(p.x).toBeGreaterThanOrEqual(7);
  });
  test('flow field routes around the peaceful group (RC-23)', () => {
    const ff = new FlowField(grid);
    ff.rebuild(behindGroup);
    let p = frontOfGroup;
    for (let i = 0; i < 2000 && dist(p, behindGroup) > 16; i++) p = moveCircle(grid, p, scale(ff.dirAt(p), 2), 7);
    expect(dist(p, behindGroup)).toBeLessThanOrEqual(16);
  });
  test('every station, school door and rescue site is reachable from spawn', () => {
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    for (const t of [...DISTRICT.stations, DISTRICT.school.door, ...DISTRICT.rescueSites, ...DISTRICT.hostileSpawns])
      expect(ff.dirAt(t)).not.toEqual({ x: 0, y: 0 });
  });
  test('every target attack point and door, kit site, station, rescue site and hostile spawn is reachable from spawn', () => {
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    const pts = [
      ...DISTRICT.targets.flatMap((t) => [...t.attackPoints, ...(t.prop ? [] : [t.door])]),
      ...DISTRICT.kitSites,
      ...DISTRICT.stations,
      ...DISTRICT.rescueSites,
      ...DISTRICT.hostileSpawns,
    ];
    for (const p of pts) expect(ff.stepsAt(p)).toBeGreaterThanOrEqual(0);
    // a prop door sits inside the solid footprint; its neighbours must still be reachable
    for (const t of DISTRICT.targets.filter((x) => x.prop)) expect(t.attackPoints.every((p) => !grid.isSolidPx(p))).toBe(true);
  });
  test('props block movement and line of sight: walking into car1 from the left keeps x < 544', () => {
    const car = DISTRICT.targets.find((t) => t.id === 'car1')!.footprint;
    expect(car.x).toBe(544);
    let p = { x: car.x - 40, y: car.y + car.h / 2 };
    for (let i = 0; i < 100; i++) p = moveCircle(grid, p, { x: 3, y: 0 }, 7);
    expect(p.x).toBeLessThan(544);
    expect(grid.isSolidPx({ x: car.x + 4, y: car.y + 4 })).toBe(true);
    expect(grid.lineClear({ x: car.x - 40, y: car.y + 16 }, { x: car.x + 80, y: car.y + 16 })).toBe(false);
  });
  test('kit sites are walkable and >= 48 px from every target footprint', () => {
    for (const k of DISTRICT.kitSites) {
      expect(grid.isSolidPx(k)).toBe(false);
      expect(grid.circleBlocked(k, 7)).toBe(false);
      for (const t of DISTRICT.targets) {
        const f = t.footprint;
        const dx = Math.max(f.x - k.x, 0, k.x - (f.x + f.w));
        const dy = Math.max(f.y - k.y, 0, k.y - (f.y + f.h));
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(48);
      }
    }
  });
  test('school door is within a 12 s walk of spawn', () => {
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.school.door);
    let p = DISTRICT.playerSpawn;
    let steps = 0;
    while (dist(p, DISTRICT.school.door) > 16 && steps < 3000) {
      p = moveCircle(grid, p, scale(ff.dirAt(p), 3), 7);
      steps++;
    }
    expect(steps * 3).toBeLessThanOrEqual(2100);
    expect(dist(p, DISTRICT.school.door)).toBeLessThanOrEqual(16);
  });
  test('all listed points are on walkable, non-group tiles', () => {
    const d = DISTRICT;
    const pts = [d.playerSpawn, d.school.door, ...d.school.facadePoints, ...d.stations, ...d.hostileSpawns, ...d.rescueSites];
    for (const p of pts) {
      expect(grid.isSolid(Math.floor(p.x / 32), Math.floor(p.y / 32))).toBe(false);
      expect(grid.isSolidPx(p)).toBe(false);
      expect(grid.isGroup(p)).toBe(false);
    }
    for (const gr of d.peacefulGroups) expect(gr.members.every((m) => grid.isGroup(m))).toBe(true);
    expect(d.school.facadePoints.length).toBeGreaterThanOrEqual(3);
  });
  test('the main square: town hall on slot 1, church on slot 6, château on slot 7, sauna appended on slot 12', () => {
    const b = DISTRICT.buildings;
    expect(b).toHaveLength(13);
    expect(b[1]).toEqual(R(14, 27, 6, 4));
    expect(b[6]).toEqual(R(25, 25, 4, 5));
    expect(b[7]).toEqual(R(27, 14, 6, 4));
    expect(b[12]).toEqual(R(31, 29, 4, 3));
    const th = DISTRICT.targets.find((t) => t.id === 'townHall')!;
    expect(th.footprint).toEqual(b[1]);
    expect(th.door).toEqual(C(17, 31));
    expect(DISTRICT.decor.find((d) => d.id === 'chateau')).toMatchObject({ sign: 'CHÂTEAU', footprint: b[7], door: C(30, 18) });
    expect(DISTRICT.decor.find((d) => d.id === 'sauna')).toMatchObject({ sign: 'SAUNA', footprint: b[12], door: C(33, 32) });
    // church, château and sauna are no targets yet; the monument stays where it was
    for (const i of [6, 7, 12]) for (const t of DISTRICT.targets) expect(overlaps(t.footprint, b[i]!)).toBe(false);
    expect(DISTRICT.monument.plinth).toEqual(R(33, 21, 2, 2));
  });
  test('three peaceful groups, 6 members each, none overlapping a building, the monument or each other', () => {
    const groups = DISTRICT.peacefulGroups;
    expect(groups).toHaveLength(3);
    const props = DISTRICT.targets.filter((t) => t.prop).map((t) => t.footprint);
    for (const gr of groups) {
      expect(gr.members).toHaveLength(6);
      for (const m of gr.members)
        expect(m.x > gr.area.x && m.x < gr.area.x + gr.area.w && m.y > gr.area.y && m.y < gr.area.y + gr.area.h).toBe(true);
      for (const b of [...DISTRICT.buildings, ...props, DISTRICT.monument.plinth]) expect(rectGap(gr.area, b)).toBeGreaterThan(0);
      expect(rectGap(gr.area, DISTRICT.monument.plinth)).toBeGreaterThanOrEqual(64);
      for (const t of DISTRICT.trunks) expect(grid.isGroup(t)).toBe(false);
      for (const o of groups) if (o !== gr) expect(rectGap(gr.area, o.area)).toBeGreaterThanOrEqual(64);
    }
  });
  test('every spawn, heal station, kit site and Paul’s start is free and >= 64 px from the square’s doors', () => {
    const pts = [DISTRICT.playerSpawn, ...DISTRICT.hostileSpawns, ...DISTRICT.stations, ...DISTRICT.kitSites];
    for (const p of pts) {
      expect(grid.isSolidPx(p)).toBe(false);
      expect(grid.circleBlocked(p, 7)).toBe(false);
      expect(grid.isGroup(p)).toBe(false);
      for (const door of squareDoors()) expect(dist(p, door)).toBeGreaterThanOrEqual(64);
    }
  });
  test('a flow-field path exists from each hostile spawn to the church door and the town hall door', () => {
    for (const door of [CHURCH_DOOR, targetDoor('townHall')]) {
      expect(grid.circleBlocked(door, 7)).toBe(false);
      const ff = new FlowField(grid);
      ff.rebuild(door);
      for (const s of DISTRICT.hostileSpawns) expect(ff.stepsAt(s)).toBeGreaterThanOrEqual(0);
    }
  });
  test('spatial hash returns only nearby entities', () => {
    const h = new SpatialHash<{ id: number; pos: { x: number; y: number } }>(64);
    h.insert({ id: 1, pos: { x: 10, y: 10 } });
    h.insert({ id: 2, pos: { x: 500, y: 500 } });
    expect(h.query({ x: 0, y: 0 }, 50).map((e) => e.id)).toEqual([1]);
  });
});
