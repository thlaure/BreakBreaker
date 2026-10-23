import { describe, expect, test } from 'vitest';
import { DISTRICT, type Rect } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { PRISON_POSTS } from '../../src/sim/prison';
import { Sim } from '../../src/sim/sim';
import type { Vec } from '../../src/sim/types';
import { autopilot } from './autopilot';

const T = 32;
const C = (tx: number, ty: number): Vec => ({ x: tx * T + T / 2, y: ty * T + T / 2 });
const R = (tx: number, ty: number, tw: number, th: number): Rect => ({ x: tx * T, y: ty * T, w: tw * T, h: th * T });
const grid = new Grid(DISTRICT);
/** Distance from a point to a rect (0 inside). */
const rectDist = (r: Rect, p: Vec): number =>
  Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), Math.max(r.y - p.y, 0, p.y - (r.y + r.h)));
/** Gap between two rects (0 when they touch or overlap). */
const rectGap = (a: Rect, b: Rect): number =>
  Math.hypot(Math.max(b.x - (a.x + a.w), 0, a.x - (b.x + b.w)), Math.max(b.y - (a.y + a.h), 0, a.y - (b.y + b.h)));
const inside = (r: Rect, p: Vec): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
/** Decor buildings keep at least this far from every other site of the map. */
const CLEAR = 64;

describe('decor buildings (CAF, POULET CROUSTI, CHÂTEAU, SAUNA)', () => {
  test('four decor fronts on existing free buildings, their door on the street below the front', () => {
    expect(DISTRICT.decor.map((d) => [d.id, d.sign])).toEqual([
      ['caf', 'CAF'],
      ['pouletCrousti', 'POULET CROUSTI'],
      ['chateau', 'CHÂTEAU'],
      ['sauna', 'SAUNA'],
    ]);
    expect(DISTRICT.decor[0]!.footprint).toEqual(R(26, 4, 7, 5));
    expect(DISTRICT.decor[0]!.door).toEqual(C(29, 9));
    expect(DISTRICT.decor[1]!.footprint).toEqual(R(38, 16, 6, 6));
    expect(DISTRICT.decor[1]!.door).toEqual(C(41, 22));
    expect(DISTRICT.decor[2]!.footprint).toEqual(R(27, 14, 6, 4));
    expect(DISTRICT.decor[2]!.door).toEqual(C(30, 18));
    expect(DISTRICT.decor[3]!.footprint).toEqual(R(31, 29, 4, 3));
    expect(DISTRICT.decor[3]!.door).toEqual(C(33, 32));
    for (const d of DISTRICT.decor) {
      expect(DISTRICT.buildings).toContainEqual(d.footprint);
      const f = d.footprint;
      // the door tile sits on the row just below the front, within the front's width
      expect(d.door.y).toBe(f.y + f.h + T / 2);
      expect(d.door.x).toBeGreaterThan(f.x);
      expect(d.door.x).toBeLessThan(f.x + f.w);
    }
  });

  test('they are never targets: no target, school, prison or monument on them, so no casse, fire or health bar', () => {
    const ids = new Set<string>(DISTRICT.targets.map((t) => t.id));
    for (const d of DISTRICT.decor) {
      expect(ids.has(d.id)).toBe(false);
      for (const t of DISTRICT.targets) expect(rectGap(t.footprint, d.footprint)).toBeGreaterThan(0);
      expect(rectGap(DISTRICT.school.footprint, d.footprint)).toBeGreaterThan(0);
      expect(rectGap(DISTRICT.monument.plinth, d.footprint)).toBeGreaterThan(0);
    }
  });

  test('solid like any other building: every footprint tile and pixel blocks movement', () => {
    for (const d of DISTRICT.decor) {
      const f = d.footprint;
      for (let ty = f.y / T; ty < (f.y + f.h) / T; ty++)
        for (let tx = f.x / T; tx < (f.x + f.w) / T; tx++) expect(grid.isSolid(tx, ty)).toBe(true);
      expect(grid.isSolidPx({ x: f.x + f.w / 2, y: f.y + f.h - 1 })).toBe(true);
    }
  });

  test('doors are walkable and reachable from Paul’s spawn and every hostile spawn', () => {
    for (const d of DISTRICT.decor) {
      expect(grid.isSolidPx(d.door)).toBe(false);
      expect(grid.circleBlocked(d.door, 7)).toBe(false);
      const ff = new FlowField(grid);
      ff.rebuild(d.door);
      for (const p of [DISTRICT.playerSpawn, ...DISTRICT.hostileSpawns]) expect(ff.stepsAt(p)).toBeGreaterThanOrEqual(0);
    }
  });

  test(`at least ${CLEAR} px from every spawn, station, rescue site, kit site, guard post and target`, () => {
    const points = [
      DISTRICT.playerSpawn,
      ...DISTRICT.hostileSpawns,
      ...DISTRICT.stations,
      ...DISTRICT.rescueSites,
      ...DISTRICT.kitSites,
      ...PRISON_POSTS,
      ...DISTRICT.monument.attackPoints,
      ...DISTRICT.targets.flatMap((t) => [...t.attackPoints, t.door]),
    ];
    const z = DISTRICT.monument.zone;
    for (const d of DISTRICT.decor) {
      for (const p of points) expect(rectDist(d.footprint, p)).toBeGreaterThanOrEqual(CLEAR);
      for (const t of DISTRICT.targets) expect(rectGap(t.footprint, d.footprint)).toBeGreaterThanOrEqual(CLEAR);
      for (const gr of DISTRICT.peacefulGroups) expect(rectGap(gr.area, d.footprint)).toBeGreaterThanOrEqual(CLEAR);
      expect(rectDist(d.footprint, z)).toBeGreaterThan(z.r);
      // the two decor fronts do not share a block either
      for (const o of DISTRICT.decor) if (o !== d) expect(rectGap(o.footprint, d.footprint)).toBeGreaterThanOrEqual(CLEAR);
    }
  });

  test('over ten rounds no attack targets a decor building and no rioter ever stands inside one', () => {
    const sim = new Sim(7, { invulnerable: true });
    const decorIds = new Set<string>(DISTRICT.decor.map((d) => d.id));
    const attacked = new Set<string>();
    for (let i = 0; i < 60 * 900 && sim.director.round < 10; i++) {
      sim.step(autopilot(sim, { koAfterSec: 6 }));
      if (i % 15 !== 0) continue;
      for (const a of sim.attacks) attacked.add(a.target);
      for (const h of sim.horde.list) for (const d of DISTRICT.decor) expect(inside(d.footprint, h.pos)).toBe(false);
    }
    expect(sim.director.round).toBeGreaterThanOrEqual(10);
    expect(attacked.size).toBeGreaterThan(3);
    for (const id of attacked) expect(decorIds.has(id)).toBe(false);
  }, 60_000);
});
