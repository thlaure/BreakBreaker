import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { ImmediateSpawner } from '../../src/sim/entry';
import { Horde, type HordeCtx } from '../../src/sim/hostiles';
import { SchoolIncident } from '../../src/sim/incidents/school';
import { TargetAttack, lineup, type AttackComposition } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer } from '../../src/sim/player';
import { Rocks } from '../../src/sim/projectiles';
import { Rules } from '../../src/sim/rules';
import { Targets } from '../../src/sim/targets';
import type { SimEvent, TargetId, Vec } from '../../src/sim/types';

const DT = 1 / 60;
const grid = new Grid(DISTRICT);
const def = (id: TargetId) => DISTRICT.targets.find((t) => t.id === id)!;

/** Horde + one attack, Molotovs routed to it; Paul stands far from the targets. */
function world(target: TargetId, comp: AttackComposition, opts: { spawn?: Vec; school?: boolean } = {}) {
  const horde = new Horde();
  const rules = new Rules();
  const targets = new Targets();
  const spawner = new ImmediateSpawner(horde, () => [opts.spawn ?? { x: 560, y: 520 }]);
  const spec = { id: `${target}#1`, target, comp, round: 1 };
  const attack = opts.school ? new SchoolIncident(targets, spawner, { comp }) : new TargetAttack(spec, targets, spawner);
  const player = createPlayer({ x: 1200, y: 1300 });
  const fields = new Map(DISTRICT.targets.map((t) => [t.id, new FlowField(grid)]));
  const ctx = (): HordeCtx => ({
    player,
    grid,
    fields: { player: new FlowField(grid), victim: null },
    rocks: new Rocks(grid),
    sites: Object.fromEntries(
      DISTRICT.targets.map((t) => [
        t.id,
        { points: t.attackPoints, door: t.door, standing: targets.standing(t.id), field: fields.get(t.id)! },
      ]),
    ),
    victimPos: null,
    pressure: 1,
  });
  let now = 0;
  /** Full loop: horde moves, Molotovs routed, attack steps. */
  const run = (sec: number): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec / DT); i++) {
      now += DT;
      for (const e of horde.step(DT, now, ctx())) {
        ev.push(e);
        if (e.type === 'MolotovThrown') ev.push(...attack.onMolotov(e, { horde, rules }));
      }
      spawner.step();
      ev.push(...attack.step(DT, { horde, rules }));
    }
    return ev;
  };
  /** Only the attack steps (hostile states stay as the test sets them). */
  const tick = (sec: number): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec / DT); i++) ev.push(...attack.step(DT, { horde, rules }));
    return ev;
  };
  const mine = () => horde.list.filter((h) => h.incidentId === attack.id);
  /** A bottle lands on the attacked target's door. */
  const bottle = (): SimEvent[] =>
    attack.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: def(target).door, target }, { horde, rules });
  const koAll = () => mine().forEach((h) => horde.applyHit(h.lifeId, 99));
  return { horde, rules, targets, attack, player, ctx, run, tick, mine, koAll, bottle, now: () => now };
}

const only = (role: 'molotov' | 'degrader', n = 1): AttackComposition => ({
  firstLine: Array.from({ length: n }, () => ({ variant: 'classic' as const, role })),
  reinforcements: [],
});

test('a molotov walks to the car, winds up 1.5 s, emits MolotovThrown at the car door, then chases Paul', () => {
  const w = world('car1', only('molotov'));
  expect(w.attack.start()).toBe(true);
  expect(w.attack.stage).toBe('attack');
  const [h] = w.mine();
  expect(h).toMatchObject({ role: 'molotov', site: 'car1', round: 1, target: 'facade' });
  let t0 = -1;
  let thrown: Extract<SimEvent, { type: 'MolotovThrown' }> | null = null;
  let ignited = false;
  for (let i = 0; i < 600 && !thrown; i++) {
    for (const e of w.run(DT)) {
      if (e.type === 'MolotovThrown') thrown = e;
      if (e.type === 'TargetIgnited') ignited = true;
    }
    if (t0 < 0 && h!.state === 'windup') {
      t0 = w.now();
      const near = Math.min(...def('car1').attackPoints.map((p) => Math.hypot(p.x - h!.pos.x, p.y - h!.pos.y)));
      expect(near).toBeLessThanOrEqual(CONFIG.molotov.range);
    }
  }
  expect(t0).toBeGreaterThan(0.1); // it had to walk first
  expect(thrown).not.toBeNull();
  expect(w.now() - t0).toBeCloseTo(CONFIG.molotov.windup, 1);
  expect(thrown!.to).toEqual(def('car1').door);
  expect(thrown!.target).toBe('car1');
  expect(ignited).toBe(true);
  expect(w.targets.get('car1').burning).toBe(true);
  expect(h!.target).toBe('player');
  const before = Math.hypot(h!.pos.x - w.player.pos.x, h!.pos.y - w.player.pos.y);
  w.run(1);
  expect(Math.hypot(h!.pos.x - w.player.pos.x, h!.pos.y - w.player.pos.y)).toBeLessThan(before - 50);
});

test('a molotov KO during its windup throws nothing and the car never burns', () => {
  const w = world('car1', only('molotov'));
  w.attack.start();
  const [h] = w.mine();
  for (let i = 0; i < 600 && h!.state !== 'windup'; i++) w.run(DT);
  expect(h!.state).toBe('windup');
  w.run(1);
  w.horde.applyHit(h!.lifeId, 99);
  const ev = w.run(3);
  expect(ev.filter((e) => e.type === 'MolotovThrown' || e.type === 'TargetIgnited')).toEqual([]);
  expect(w.targets.get('car1').burning).toBe(false);
  expect(w.targets.get('car1').hp).toBe(def('car1').maxHp);
});

test('burning school with 3 degraders loses (2 + 3 × 1.2) hp per second; a 5th degrader adds nothing over 4', () => {
  const w = world('school', only('degrader', 5));
  w.attack.start();
  expect(w.bottle()).toEqual([
    // the fire is what the HUD announces: the event carries the kind, the door and the round
    { type: 'TargetIgnited', target: 'school', incidentId: 'school#1', kind: 'school', pos: def('school').door, round: 1 },
  ]);
  // a second bottle on a burning target ignites nothing (no new banner / alarm) but deals its burst damage
  expect(w.bottle()).toEqual([]);
  expect(w.targets.get('school').hp).toBe(100 - CONFIG.molotov.burstDamage);
  w.targets.get('school').hp = 100;
  w.mine()
    .slice(0, 3)
    .forEach((h) => (h.state = 'degrade'));
  w.tick(1);
  expect(w.targets.get('school').hp).toBeCloseTo(100 - (CONFIG.target.fireDps + 3 * CONFIG.target.degradeDps), 6);
  w.mine().forEach((h) => (h.state = 'degrade'));
  const hp = w.targets.get('school').hp;
  w.tick(1);
  expect(hp - w.targets.get('school').hp).toBeCloseTo(CONFIG.target.fireDps + 4 * CONFIG.target.degradeDps, 6);
});

test('a degrader of a ruined site retargets Paul', () => {
  const w = world('car1', only('degrader'));
  w.attack.start();
  const [h] = w.mine();
  for (let i = 0; i < 600 && h!.state !== 'degrade'; i++) w.run(DT);
  expect(h!.state).toBe('degrade');
  w.targets.ruin('car1', 'other#1');
  w.horde.step(DT, w.now() + DT, w.ctx());
  expect(h!.target).toBe('player');
  expect(h!.state).not.toBe('degrade');
  // a site absent from the ctx is treated the same way
  const g = w.horde.spawn({ variant: 'classic', role: 'degrader', pos: { x: 560, y: 520 }, site: 'busStop' })!;
  const ctx = w.ctx();
  delete ctx.sites.busStop;
  w.horde.step(DT, w.now() + 2 * DT, ctx);
  expect(g.target).toBe('player');
});

test('all attackers KO, nothing burning: saved +8 at once, TargetSaved and SchoolRestored', () => {
  const comp = lineup('school', 2, 0);
  expect(comp.reinforcements).toEqual([]);
  const w = world('school', comp, { school: true });
  w.attack.start();
  w.koAll();
  const ev = w.tick(DT);
  expect(w.attack.stage).toBe('saved');
  expect(w.attack.resolved()).toBe(true);
  expect(w.attack.settled()).toBe(true);
  expect(w.rules.score).toBe(CONFIG.casse.scores.school[0]);
  expect(ev.map((e) => e.type)).toEqual(['TargetSaved', 'SchoolRestored']);
  expect(ev).toContainEqual({ type: 'TargetSaved', incidentId: 'school#1', target: 'school' });
  w.tick(2);
  expect(w.rules.score).toBe(8);
  expect((w.attack as SchoolIncident).status()).toBe('saved');
});

test('all attackers KO while burning: it smoulders (settled, not urgent, not resolved), losing 0.7 hp/s with no award, until put out', () => {
  expect(CONFIG.target.smoulderDps).toBe(0.7);
  const w = world('school', lineup('school', 2, 0), { school: true });
  w.attack.start();
  w.bottle();
  w.koAll();
  const ev0 = w.tick(DT);
  expect(w.attack.stage).toBe('smoulder');
  expect(w.attack.settled()).toBe(true);
  expect(w.attack.resolved()).toBe(false);
  expect(w.attack.urgent()).toBe(false);
  // no fire out, no saved: only the first-hp-lost cue of this attack
  expect(ev0).toEqual([{ type: 'BuildingThreatStarted', incidentId: 'school#1' }]);
  const hp = w.targets.get('school').hp;
  const ev = w.tick(10);
  // the fire does not go out by itself
  expect(ev).toEqual([]);
  expect(w.targets.get('school').burning).toBe(true);
  expect(w.targets.get('school').hp).toBeCloseTo(hp - 10 * CONFIG.target.smoulderDps, 6);
  expect(w.rules.score).toBe(0);
  expect((w.attack as SchoolIncident).status()).toBe('burning');
  // a toolbox puts it out: saved silently (no award here), TargetSaved / SchoolRestored for the stats
  expect(w.targets.extinguish('school')).toBe('school#1');
  const after = w.targets.get('school').hp;
  const ev2 = w.tick(DT);
  expect(w.attack.stage).toBe('saved');
  expect(ev2.map((e) => e.type)).toEqual(['TargetSaved', 'SchoolRestored']);
  expect(w.rules.score).toBe(0);
  w.tick(2);
  expect(w.targets.get('school').hp).toBe(after);
  expect((w.attack as SchoolIncident).status()).toBe('saved');
});

test('a smouldering target burnt down to 0: ruined once, −3 once, BuildingDestroyed, destroyed', () => {
  const w = world('car1', only('molotov'));
  w.attack.start();
  w.bottle();
  w.koAll();
  w.tick(DT);
  expect(w.attack.stage).toBe('smoulder');
  w.targets.get('car1').hp = 1;
  const ev = w.tick(1 / CONFIG.target.smoulderDps + 0.1);
  expect(w.attack.stage).toBe('destroyed');
  expect(w.targets.get('car1')).toMatchObject({ state: 'ruined', burning: false, lostIncidentId: 'car1#1' });
  expect(ev).toEqual([{ type: 'BuildingDestroyed', incidentId: 'car1#1', target: 'car1' }]);
  expect(w.rules.score).toBe(CONFIG.casse.scores.car[1]);
  expect(w.tick(3)).toEqual([]);
  expect(w.rules.score).toBe(CONFIG.casse.scores.car[1]);
});

test('hp 0: destroyed, target ruined, −3 once, BuildingDestroyed carries the target; start() on a ruin returns false', () => {
  const w = world('school', lineup('school', 1, 0), { school: true });
  w.attack.start();
  w.bottle();
  w.targets.get('school').hp = 1;
  const ev = w.tick(1);
  expect(w.attack.stage).toBe('destroyed');
  expect(w.targets.standing('school')).toBe(false);
  expect(w.targets.get('school').lostIncidentId).toBe('school#1');
  expect(w.rules.score).toBe(-3);
  expect(ev.filter((e) => e.type === 'BuildingDestroyed')).toEqual([
    { type: 'BuildingDestroyed', incidentId: 'school#1', target: 'school' },
  ]);
  expect((w.attack as SchoolIncident).status()).toBe('lost');
  w.koAll();
  w.tick(3);
  expect(w.attack.stage).toBe('destroyed');
  expect(w.rules.score).toBe(-3);
  const again = new TargetAttack(
    { id: 'school#2', target: 'school', comp: lineup('school', 2, 0), round: 2 },
    w.targets,
    new ImmediateSpawner(w.horde, () => [{ x: 560, y: 520 }]),
  );
  expect(again.start()).toBe(false);
  expect(again.stage).toBe('idle');
  expect(w.horde.list.filter((h) => h.incidentId === 'school#2')).toEqual([]);
});

test('round-1 school: 3 first-line (1 Molotov), cinematic, 8 reinforcements (the second Molotov among them)', () => {
  const comp = lineup('school', 1, 0);
  expect(comp.firstLine.map((r) => r.role)).toEqual(['molotov', 'degrader', 'degrader']);
  expect(comp.reinforcements.map((r) => r.role)).toEqual(['molotov', ...Array(4).fill('degrader'), ...Array(3).fill('contact')]);
  const w = world('school', comp, { school: true });
  const school = w.attack as SchoolIncident;
  expect(school.total()).toBe(comp.firstLine.length + comp.reinforcements.length);
  school.start();
  expect(w.mine()).toHaveLength(3);
  expect(new Set(w.mine().map((h) => h.variant)).size).toBe(3);
  expect(w.mine().every((h) => h.site === 'school' && h.round === 1)).toBe(true);
  expect(school.requiredActive(w.horde)).toBe(true);
  w.koAll();
  w.tick(DT);
  expect(school.stage).toBe('cinematic');
  expect(school.suspended()).toBe(true);
  expect(school.status()).toBe('reinforcements');
  w.tick(CONFIG.school.cinematicSec - 0.5);
  expect(school.stage).toBe('cinematic');
  school.skipCinematic();
  school.skipCinematic();
  w.tick(DT);
  expect(school.stage).toBe('reinforcements');
  expect(w.mine().filter((h) => h.state !== 'ko')).toHaveLength(comp.reinforcements.length);
  w.tick(1);
  expect(w.mine().filter((h) => h.state !== 'ko')).toHaveLength(comp.reinforcements.length);
});

test('Molotov throwers per attack: min(4, 1 + floor(round / 2)), props capped at 2, extra rioters in the first line', () => {
  const molotovs = (c: AttackComposition) => [...c.firstLine, ...c.reinforcements].filter((r) => r.role === 'molotov').length;
  expect([2, 3, 4, 5, 6, 7, 12].map((r) => molotovs(lineup('school', r, 0)))).toEqual([2, 2, 3, 3, 4, 4, 4]);
  for (const kind of ['car', 'busStop'] as const)
    expect([1, 2, 3, 4, 6, 12].map((r) => molotovs(lineup(kind, r, 0)))).toEqual([1, 2, 2, 2, 2, 2]);
  // round 1: one bottle in the first line, the second comes with the reinforcements (after the cinematic)
  expect(lineup('school', 1, 0).firstLine.filter((r) => r.role === 'molotov')).toHaveLength(1);
  expect(lineup('school', 1, 0).reinforcements.filter((r) => r.role === 'molotov')).toHaveLength(1);
  // extra, not replacing: the rest of the lineup is unchanged
  for (const [kind, r] of [
    ['school', 4],
    ['car', 5],
    ['busStop', 2],
  ] as const) {
    const c = lineup(kind, r, 6);
    expect(c.firstLine.filter((x) => x.role !== 'molotov')).toHaveLength(c.firstLine.length - molotovs(c));
    expect(c.firstLine.slice(0, molotovs(c)).every((x) => x.role === 'molotov')).toBe(true);
  }
});

test('lineup: later school and car compositions follow pressure; variants round-robin', () => {
  const s = lineup('school', 3, 6);
  expect(s.reinforcements).toEqual([]);
  expect(s.firstLine.map((r) => r.role)).toEqual([
    'molotov',
    'molotov',
    'degrader',
    'degrader',
    'contact',
    'degrader',
    'contact',
    'degrader',
    'contact',
  ]);
  expect(lineup('school', 3, 99).firstLine).toHaveLength(2 + 3 + 6);
  expect(s.firstLine.map((r) => r.variant).slice(0, 4)).toEqual(['classic', 'palestinian', 'antifa', 'classic']);
  expect(s.firstLine.every((r) => r.round === 3)).toBe(true);
  expect(lineup('car', 2, 3).firstLine.map((r) => r.role)).toEqual(['molotov', 'molotov', 'degrader', 'degrader', 'contact']);
  expect(lineup('busStop', 2, 8).firstLine.map((r) => r.role)).toEqual([
    'molotov',
    'molotov',
    'degrader',
    'degrader',
    'contact',
    'contact',
    'contact',
  ]);
  expect(lineup('car', 2, 99).firstLine).toHaveLength(2 + 3 + 3);
});

test('a target ruined by another source while urgent: destroyed once, no second ruin or penalty, never saved', () => {
  const w = world('car1', only('degrader', 2));
  w.attack.start();
  w.tick(0.1);
  expect(w.attack.urgent()).toBe(true);
  // ruined elsewhere (e.g. another attack): this attack must not ruin it again, nor lose points, nor save it
  w.targets.ruin('car1', 'other#1');
  const ev = w.tick(0.1);
  expect(w.attack.stage).toBe('destroyed');
  expect(ev).toEqual([]);
  expect(w.rules.score).toBe(0);
  expect(w.targets.get('car1').lostIncidentId).toBe('other#1');
  w.koAll();
  expect(w.tick(3)).toEqual([]);
  expect(w.attack.stage).toBe('destroyed');
  expect(w.rules.score).toBe(0);
});

test('a ruin from another source during the smoulder is neither awarded nor penalised again', () => {
  const w = world('car1', only('degrader', 1));
  w.attack.start();
  w.tick(0.1);
  w.bottle();
  w.koAll();
  w.tick(0.1);
  expect(w.attack.stage).toBe('smoulder');
  w.targets.ruin('car1', 'other#1');
  expect(w.tick(3)).toEqual([]);
  expect(w.attack.stage).toBe('destroyed');
  expect(w.rules.score).toBe(0);
});

test('a bottle on an already burning target: burst of 8 hp, no TargetIgnited; a burst at low hp ruins once, −3 once', () => {
  expect(CONFIG.molotov.burstDamage).toBe(8);
  const w = world('school', only('degrader', 2));
  w.attack.start();
  expect(w.bottle().map((e) => e.type)).toEqual(['TargetIgnited']);
  expect(w.bottle()).toEqual([]);
  expect(w.bottle()).toEqual([]);
  expect(w.targets.get('school')).toMatchObject({ hp: 100 - 2 * 8, burning: true });
  w.targets.get('school').hp = 5;
  expect(w.bottle()).toEqual([{ type: 'BuildingDestroyed', incidentId: 'school#1', target: 'school' }]);
  expect(w.attack.stage).toBe('destroyed');
  expect(w.targets.get('school')).toMatchObject({ state: 'ruined', lostIncidentId: 'school#1' });
  expect(w.rules.score).toBe(CONFIG.casse.scores.school[1]);
  // a resolved attack takes no more bottles; no second ruin or penalty
  expect(w.bottle()).toEqual([]);
  expect(w.tick(1)).toEqual([]);
  expect(w.rules.score).toBe(CONFIG.casse.scores.school[1]);
});

test('three Molotovs on one building: each throws on its own windup (staggered), 3 bottles, one ignition, two bursts', () => {
  const w = world('school', only('molotov', 3));
  w.attack.start();
  const throws: number[] = [];
  const ev: SimEvent[] = [];
  for (let i = 0; i < 60 * 30 && throws.length < 3; i++) {
    for (const e of w.run(DT)) {
      ev.push(e);
      if (e.type === 'MolotovThrown') throws.push(w.now());
    }
  }
  expect(throws).toHaveLength(3);
  // never two bottles in the same step
  expect(new Set(throws.map((t) => Math.round(t * 60))).size).toBe(3);
  expect(ev.filter((e) => e.type === 'TargetIgnited')).toHaveLength(1);
  // the fire burns meanwhile: the bursts are the hp lost beyond it
  const hp = w.targets.get('school').hp;
  const burning = ev.findIndex((e) => e.type === 'TargetIgnited');
  expect(burning).toBeGreaterThanOrEqual(0);
  expect(hp).toBeLessThanOrEqual(100 - 2 * CONFIG.molotov.burstDamage);
  expect(w.mine().every((h) => h.target === 'player')).toBe(true);
});

test('Paul close by does not divert Molotovs before their throw (several on one site)', () => {
  const w = world('car1', only('molotov', 3), { spawn: { x: 528, y: 464 } });
  w.attack.start();
  let thrown = 0;
  for (let i = 0; i < 60 * 30 && thrown < 3; i++) {
    const [h] = w.mine();
    w.player.pos = { x: h!.pos.x + 50, y: h!.pos.y };
    for (const e of w.run(DT)) if (e.type === 'MolotovThrown') thrown++;
    // only a Molotov that has thrown turns on Paul
    expect(w.mine().filter((m) => m.target === 'player').length).toBeLessThanOrEqual(thrown);
  }
  expect(thrown).toBe(3);
});

test('Molotovs winding up together on one site are staggered: their bottles leave at least 0.25 s apart', () => {
  // spawned already in range of the school, side by side: they would all start their windup on the same step
  const w = world('school', only('molotov', 3), {
    spawn: { x: def('school').attackPoints[1]!.x, y: def('school').attackPoints[1]!.y + 40 },
  });
  w.attack.start();
  const throws: number[] = [];
  for (let i = 0; i < 60 * 10 && throws.length < 3; i++) for (const e of w.run(DT)) if (e.type === 'MolotovThrown') throws.push(w.now());
  expect(throws).toHaveLength(3);
  for (let k = 1; k < 3; k++) expect(throws[k]! - throws[k - 1]!).toBeGreaterThanOrEqual(0.25 - 1e-6);
});
