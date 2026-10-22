import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { roundPlan } from '../../src/sim/director';
import { ImmediateSpawner } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import { TargetAttack, lineup, molotovCount, type AttackComposition } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer } from '../../src/sim/player';
import { Toolboxes } from '../../src/sim/repair';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import { Targets } from '../../src/sim/targets';
import type { CasseKind, SimEvent } from '../../src/sim/types';

const DT = 1 / 60;
const shop = () => DISTRICT.targets.find((t) => t.id === 'shop')!;

describe('the retro video-game shop (target « shop »)', () => {
  test('it sits on building 5 R(12,15,4,4): a 100 hp building with 3 attack points and a door on its front row', () => {
    const d = shop();
    expect(d).toMatchObject({ kind: 'shop', prop: false, maxHp: 100 });
    expect(d.footprint).toEqual(DISTRICT.buildings[5]);
    const C = (tx: number, ty: number) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
    expect(d.attackPoints).toEqual([C(12, 19), C(13, 19), C(15, 19)]);
    expect(d.door).toEqual(C(14, 19));
  });

  test('its attack points and door are walkable and reachable from the spawn', () => {
    const grid = new Grid(DISTRICT);
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    for (const p of [...shop().attackPoints, shop().door]) {
      expect(grid.isSolidPx(p)).toBe(false);
      expect(grid.circleBlocked(p, CONFIG.hostile.radius)).toBe(false);
      expect(ff.stepsAt(p)).toBeGreaterThanOrEqual(0);
    }
  });

  test('lineup: min(4, 1 + floor(round / 2)) Molotovs (a building, not a prop), then 2 degraders, a contact and the school-like pressure extras', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 12].map((r) => molotovCount('shop', r))).toEqual([1, 2, 2, 3, 3, 4, 4, 4]);
    expect(lineup('shop', 2, 0).firstLine.map((r) => r.role)).toEqual([
      'molotov', 'molotov', 'degrader', 'degrader', 'contact', 'degrader', 'contact',
    ]);
    expect(lineup('shop', 2, 0).reinforcements).toEqual([]);
    expect(lineup('shop', 6, 6).firstLine.map((r) => r.role)).toEqual([
      'molotov', 'molotov', 'molotov', 'molotov', 'degrader', 'degrader', 'contact', 'degrader', 'contact', 'degrader', 'contact',
    ]);
    expect(lineup('shop', 4, 99).firstLine).toHaveLength(3 + 3 + 6);
    // variants always round-robin, never one designated variant
    expect(lineup('shop', 2, 0).firstLine.map((r) => r.variant).slice(0, 3)).toEqual(['classic', 'palestinian', 'antifa']);
  });

  test('scores [saved, lost, repaired] = [6, −2, 4]', () => {
    expect(CONFIG.casse.scores.shop).toEqual([6, -2, 4]);
  });

  test('attack → bottle ignites → every rioter KO → smoulder → toolbox puts it out (100 hp, +4); a ruin repairs for +4 too; keys unique', () => {
    const horde = new Horde();
    const rules = new Rules();
    const targets = new Targets();
    const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
    const comp: AttackComposition = lineup('shop', 2, 0);
    const attack = new TargetAttack({ id: 'shop#1', target: 'shop', comp, round: 2 }, targets, spawner);
    const ctx = { horde, rules };
    expect(attack.start()).toBe(true);
    spawner.step();
    const ignite = attack.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: shop().door, target: 'shop' }, ctx);
    expect(ignite).toEqual([
      { type: 'TargetIgnited', target: 'shop', incidentId: 'shop#1', kind: 'shop', pos: shop().door, round: 2 },
    ]);
    for (const h of horde.list) if (h.incidentId === 'shop#1') horde.applyHit(h.lifeId, 99);
    attack.step(DT, ctx);
    expect(attack.stage).toBe('smoulder');
    expect(rules.score).toBe(0);
    const hp = targets.get('shop').hp;
    for (let i = 0; i < 60; i++) attack.step(DT, ctx);
    expect(targets.get('shop').hp).toBeCloseTo(hp - CONFIG.target.smoulderDps, 6);

    const kit = new Toolboxes();
    kit.carried = true;
    const player = createPlayer({ ...shop().door });
    const kitEv: SimEvent[] = [];
    for (let i = 0; i < Math.round(CONFIG.kit.repairSec / DT) + 1; i++)
      kitEv.push(...kit.step(DT, { player, horde: new Horde(), targets, rules, act: i === 0 }).events);
    expect(kitEv).toEqual([
      { type: 'FireOut', target: 'shop' },
      { type: 'TargetRepaired', target: 'shop', incidentId: 'shop#1' },
    ]);
    expect(targets.get('shop')).toMatchObject({ hp: 100, burning: false, state: 'intact' });
    expect(rules.score).toBe(4);
    const ev = attack.step(DT, ctx);
    expect(attack.stage).toBe('saved');
    expect(ev.map((e) => e.type)).toEqual(['TargetSaved']);
    expect(rules.score).toBe(4);

    // a second attack burns it down: −2 once; the repair of the ruin scores +4 under its own key
    const a2 = new TargetAttack({ id: 'shop#2', target: 'shop', comp: lineup('shop', 4, 0), round: 4 }, targets, spawner);
    a2.start();
    spawner.step();
    targets.get('shop').hp = 0.01;
    a2.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: shop().door, target: 'shop' }, ctx);
    expect(a2.step(DT, ctx)).toContainEqual({ type: 'BuildingDestroyed', incidentId: 'shop#2', target: 'shop' });
    a2.step(1, ctx);
    expect(rules.score).toBe(2);
    kit.carried = true;
    const rep: SimEvent[] = [];
    for (let i = 0; i < Math.round(CONFIG.kit.repairSec / DT) + 1; i++)
      rep.push(...kit.step(DT, { player, horde: new Horde(), targets, rules, act: i === 0 }).events);
    expect(rep).toEqual([{ type: 'TargetRepaired', target: 'shop', incidentId: 'shop#2' }]);
    expect(rules.score).toBe(6);
    expect(targets.get('shop')).toMatchObject({ hp: 100, state: 'intact' });
  });

  test('a saved shop (nothing burning) scores +6 once', () => {
    const horde = new Horde();
    const rules = new Rules();
    const targets = new Targets();
    const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
    const attack = new TargetAttack({ id: 'shop#1', target: 'shop', comp: lineup('shop', 2, 0), round: 2 }, targets, spawner);
    attack.start();
    spawner.step();
    for (const h of horde.list) horde.applyHit(h.lifeId, 99);
    expect(attack.step(DT, { horde, rules })).toEqual([{ type: 'TargetSaved', incidentId: 'shop#1', target: 'shop' }]);
    attack.step(1, { horde, rules });
    expect(rules.score).toBe(6);
  });
});

describe('the shop in the round plan', () => {
  test('from round 2 the shop is one of the randomly drawn headlines (never forced)', () => {
    const t = new Targets();
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) seen.add(roundPlan(2 + (s % 3), rng(s), t, 'car').headline);
    // rounds 2-4: the phone booths join the draw from round 3
    expect([...seen].sort()).toEqual(['booth', 'busStop', 'car', 'school', 'shop']);
  });

  test('round 4+: the last headline is drawn half as often (weights 1 / 2 / 2 / 2)', () => {
    const t = new Targets();
    const n: Record<string, number> = {};
    for (let s = 1; s <= 1400; s++) {
      const h = roundPlan(4, rng(s), t, 'shop').headline;
      n[h] = (n[h] ?? 0) + 1;
    }
    // 1 / 7 ≈ 14 %, the others 2 / 7 ≈ 29 %
    expect(n.shop! / 1400).toBeGreaterThan(0.09);
    expect(n.shop! / 1400).toBeLessThan(0.2);
    for (const k of ['school', 'car', 'busStop']) expect(n[k]! / 1400).toBeGreaterThan(0.22);
  });

  test('a ruined or burning shop is never drawn', () => {
    const t = new Targets();
    t.ruin('shop', 'shop#x');
    for (let s = 1; s <= 60; s++) expect(roundPlan(2 + (s % 5), rng(s), t).headline).not.toBe('shop');
    t.repair('shop');
    t.ignite('shop', 'shop#y');
    for (let s = 1; s <= 60; s++) expect(roundPlan(2 + (s % 5), rng(s), t).headline).not.toBe('shop');
  });
});
