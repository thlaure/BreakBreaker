import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { casseOpen, roundPlan } from '../../src/sim/director';
import { ImmediateSpawner } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import { TargetAttack, lineup, molotovCount } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer } from '../../src/sim/player';
import { Toolboxes } from '../../src/sim/repair';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import { Targets } from '../../src/sim/targets';
import type { CasseKind, SimEvent, TargetId } from '../../src/sim/types';

const DT = 1 / 60;
const C = (tx: number, ty: number) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
const R = (tx: number, ty: number, tw: number, th: number) => ({ x: tx * 32, y: ty * 32, w: tw * 32, h: th * 32 });
const def = (id: TargetId) => DISTRICT.targets.find((t) => t.id === id)!;

/** The Phase C places: id, kind, building index (null for the kiosk prop), opening round, hp, scores. */
const PLACES = [
  { id: 'nursery', building: 9, from: 5, hp: 100, scores: [8, -3, 5] },
  { id: 'kiosk', building: null, from: 5, hp: 60, scores: [4, -2, 3] },
  { id: 'townHall', building: 1, from: 7, hp: 100, scores: [8, -3, 5] },
  { id: 'library', building: 10, from: 9, hp: 100, scores: [8, -3, 5] },
] as const;

describe('the Phase C places (nursery, kiosk, town hall, library)', () => {
  test('each one exists with its kind, health and footprint (buildings on an existing building, the kiosk a prop)', () => {
    for (const p of PLACES) {
      const d = def(p.id);
      expect(d).toMatchObject({ kind: p.id, maxHp: p.hp, prop: p.building === null });
      if (p.building !== null) expect(d.footprint).toEqual(DISTRICT.buildings[p.building]);
    }
    expect(def('nursery').attackPoints).toEqual([C(7, 36), C(8, 36), C(10, 36), C(11, 36)]);
    expect(def('nursery').door).toEqual(C(9, 36));
    expect(def('townHall').attackPoints).toEqual([C(16, 7), C(17, 7), C(19, 7), C(20, 7)]);
    expect(def('townHall').door).toEqual(C(18, 7));
    expect(def('library').attackPoints).toEqual([C(24, 43), C(25, 43), C(27, 43), C(28, 43)]);
    expect(def('library').door).toEqual(C(26, 43));
    expect(def('kiosk').footprint).toEqual(R(34, 40, 2, 1));
    expect(def('kiosk').attackPoints).toEqual([C(33, 40), C(36, 40), C(34, 41), C(35, 41)]);
  });

  test('every building target is attacked from the street just below its front wall (the side the renderer draws)', () => {
    for (const d of DISTRICT.targets.filter((t) => !t.prop)) {
      const row = d.footprint.y + d.footprint.h + 16;
      for (const q of [d.door, ...d.attackPoints]) {
        expect(q.y).toBe(row);
        expect(q.x).toBeGreaterThan(d.footprint.x);
        expect(q.x).toBeLessThan(d.footprint.x + d.footprint.w);
      }
    }
  });

  test('attack points (and building doors) are walkable and reachable from the spawn', () => {
    const grid = new Grid(DISTRICT);
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    for (const p of PLACES) {
      const d = def(p.id);
      for (const q of [...d.attackPoints, ...(d.prop ? [] : [d.door])]) {
        expect(grid.isSolidPx(q)).toBe(false);
        expect(grid.circleBlocked(q, CONFIG.hostile.radius)).toBe(false);
        expect(ff.stepsAt(q)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('the kiosk is solid and keeps a free tile all around it (no passage cut)', () => {
    const grid = new Grid(DISTRICT);
    expect(grid.isSolid(34, 40)).toBe(true);
    expect(grid.isSolid(35, 40)).toBe(true);
    for (let tx = 33; tx <= 36; tx++) for (let ty = 39; ty <= 41; ty++) if (ty !== 40 || tx === 33 || tx === 36) expect(grid.isSolid(tx, ty)).toBe(false);
    // away from spawns, stations and the peaceful group
    const f = def('kiosk').footprint;
    const centre = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
    for (const q of [...DISTRICT.hostileSpawns, ...DISTRICT.stations]) expect(Math.hypot(q.x - centre.x, q.y - centre.y)).toBeGreaterThan(160);
    const g = DISTRICT.peacefulGroup.area;
    expect(Math.hypot(g.x - centre.x, g.y - centre.y)).toBeGreaterThan(320);
  });

  test('scores [saved, lost, repaired] and opening rounds from the spec', () => {
    for (const p of PLACES) {
      expect(CONFIG.casse.scores[p.id]).toEqual(p.scores);
      expect(CONFIG.casse.fromRound[p.id]).toBe(p.from);
    }
  });

  test('lineups: the three buildings take school-like Molotovs and pressure extras, the kiosk at most 2 Molotovs', () => {
    for (const k of ['nursery', 'townHall', 'library'] as const) {
      expect(molotovCount(k, 12)).toBe(4);
      expect(lineup(k, 4, 99).firstLine).toHaveLength(3 + 3 + 6);
    }
    expect(molotovCount('kiosk', 12)).toBe(2);
    expect(lineup('kiosk', 6, 99).firstLine.map((r) => r.role)).toEqual(lineup('busStop', 6, 99).firstLine.map((r) => r.role));
  });

  test('casseOpen: a kind is open only from its round', () => {
    for (const p of PLACES) {
      expect(casseOpen(p.id, p.from - 1)).toBe(false);
      expect(casseOpen(p.id, p.from)).toBe(true);
      expect(casseOpen(p.id, p.from + 3)).toBe(true);
    }
    for (const k of ['car', 'busStop', 'shop', 'school'] as const) expect(casseOpen(k, 2)).toBe(true);
  });

  for (const p of PLACES) {
    test(`${p.id}: bottle → fire → KO → toolbox puts it out (+${p.scores[2]}); a second attack ruins it (${p.scores[1]}), repaired for +${p.scores[2]}`, () => {
      const id = p.id;
      const horde = new Horde();
      const rules = new Rules();
      const targets = new Targets();
      const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
      const ctx = { horde, rules };
      const attack = new TargetAttack({ id: `${id}#1`, target: id, comp: lineup(id, p.from, 0), round: p.from }, targets, spawner);
      expect(attack.start()).toBe(true);
      spawner.step();
      const door = def(id).door;
      expect(attack.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: door, target: id }, ctx)).toEqual([
        { type: 'TargetIgnited', target: id, incidentId: `${id}#1`, kind: id, pos: door, round: p.from },
      ]);
      for (const h of horde.list) if (h.incidentId === `${id}#1`) horde.applyHit(h.lifeId, 99);
      attack.step(DT, ctx);
      expect(attack.stage).toBe('smoulder');
      const kit = new Toolboxes();
      kit.carried = true;
      const player = createPlayer({ ...door });
      const kitEv: SimEvent[] = [];
      for (let i = 0; i < Math.round(CONFIG.kit.repairSec / DT) + 1; i++)
        kitEv.push(...kit.step(DT, { player, horde: new Horde(), targets, rules, act: i === 0 }).events);
      expect(kitEv).toEqual([
        { type: 'FireOut', target: id },
        { type: 'TargetRepaired', target: id, incidentId: `${id}#1` },
      ]);
      expect(targets.get(id)).toMatchObject({ hp: p.hp, burning: false, state: 'intact' });
      expect(rules.score).toBe(p.scores[2]);

      const a2 = new TargetAttack({ id: `${id}#2`, target: id, comp: lineup(id, p.from, 0), round: p.from }, targets, spawner);
      a2.start();
      spawner.step();
      targets.get(id).hp = 0.01;
      a2.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: door, target: id }, ctx);
      expect(a2.step(DT, ctx)).toContainEqual({ type: 'BuildingDestroyed', incidentId: `${id}#2`, target: id });
      a2.step(1, ctx);
      expect(rules.score).toBe(p.scores[2] + p.scores[1]);
      expect(targets.standing(id)).toBe(false);
      kit.carried = true;
      const rep: SimEvent[] = [];
      for (let i = 0; i < Math.round(CONFIG.kit.repairSec / DT) + 1; i++)
        rep.push(...kit.step(DT, { player, horde: new Horde(), targets, rules, act: i === 0 }).events);
      expect(rep).toEqual([{ type: 'TargetRepaired', target: id, incidentId: `${id}#2` }]);
      expect(rules.score).toBe(2 * p.scores[2] + p.scores[1]);
      expect(targets.get(id)).toMatchObject({ hp: p.hp, state: 'intact' });
    });

    test(`${p.id}: a saved attack (nothing burning) scores +${p.scores[0]} once`, () => {
      const horde = new Horde();
      const rules = new Rules();
      const targets = new Targets();
      const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
      const attack = new TargetAttack({ id: `${p.id}#1`, target: p.id, comp: lineup(p.id, p.from, 0), round: p.from }, targets, spawner);
      attack.start();
      spawner.step();
      for (const h of horde.list) horde.applyHit(h.lifeId, 99);
      expect(attack.step(DT, { horde, rules })).toEqual([{ type: 'TargetSaved', incidentId: `${p.id}#1`, target: p.id }]);
      attack.step(1, { horde, rules });
      expect(rules.score).toBe(p.scores[0]);
    });
  }
});

describe('the Phase C places in the round plan', () => {
  const headlines = (round: number, n = 600, last: CasseKind | null = null): Set<string> => {
    const t = new Targets();
    const seen = new Set<string>();
    // from round 5 the first beat holds two casses: every kind attacked at the round start counts
    for (let s = 1; s <= n; s++) for (const k of roundPlan(round, rng(s), t, last).beats[0]!) seen.add(k);
    return seen;
  };

  test('a place is never drawn before its round, then is part of the draw', () => {
    expect([...headlines(2)].sort()).toEqual(['busStop', 'car', 'school', 'shop']);
    // the phone booths from round 3 (spec §7.5)
    expect([...headlines(3)].sort()).toEqual(['booth', 'busStop', 'car', 'school', 'shop']);
    // the prison from round 4
    expect([...headlines(4)].sort()).toEqual(['booth', 'busStop', 'car', 'prison', 'school', 'shop']);
    // round 5: its two new places come first, together
    expect([...headlines(5)].sort()).toEqual(['kiosk', 'nursery']);
    expect([...headlines(6)].sort()).toEqual(['booth', 'busStop', 'car', 'kiosk', 'nursery', 'prison', 'school', 'shop']);
    expect([...headlines(7)].sort()).toEqual(['booth', 'busStop', 'car', 'kiosk', 'nursery', 'prison', 'school', 'shop', 'townHall']);
    expect([...headlines(8)].sort()).toEqual(['booth', 'busStop', 'car', 'kiosk', 'nursery', 'prison', 'school', 'shop', 'townHall']);
    expect([...headlines(9)].sort()).toEqual(['booth', 'busStop', 'car', 'kiosk', 'library', 'nursery', 'prison', 'school', 'shop', 'townHall']);
  });

  test('round 10: weights 2 each, 1 for last round’s headline', () => {
    const t = new Targets();
    const n: Record<string, number> = {};
    const N = 3000;
    for (let s = 1; s <= N; s++) {
      const h = roundPlan(10, rng(s), t, 'library').headline;
      n[h] = (n[h] ?? 0) + 1;
    }
    // 10 kinds: 1 / 19 ≈ 5.3 %, the others 2 / 19 ≈ 10.5 %
    expect(n.library! / N).toBeLessThan(0.075);
    for (const k of ['school', 'car', 'busStop', 'shop', 'nursery', 'kiosk', 'townHall', 'booth', 'prison']) expect(n[k]! / N).toBeGreaterThan(0.085);
  });

  test('the draw stays seeded: same seed, same plan', () => {
    for (let s = 1; s <= 40; s++) {
      const a = roundPlan(5 + (s % 6), rng(s), new Targets(), 'car');
      const b = roundPlan(5 + (s % 6), rng(s), new Targets(), 'car');
      expect(a).toEqual(b);
    }
  });

  test('a ruined place is never drawn', () => {
    const t = new Targets();
    for (const p of PLACES) t.ruin(p.id, `${p.id}#x`);
    t.ruin('boothRed', 'boothRed#x');
    t.ruin('boothBlue', 'boothBlue#x');
    t.ruin('prison', 'prison#x');
    for (let s = 1; s <= 80; s++) expect(['school', 'car', 'busStop', 'shop']).toContain(roundPlan(9, rng(s), t).headline);
  });
});
