import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { ImmediateSpawner } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import { SchoolIncident } from '../../src/sim/incidents/school';
import { lineup } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { Rules } from '../../src/sim/rules';
import { Targets } from '../../src/sim/targets';
import type { SimEvent } from '../../src/sim/types';

const DT = 1 / 60;
const spawns = DISTRICT.hostileSpawns;
const R1 = lineup('school', 1, 0);

function setup() {
  const horde = new Horde();
  const rules = new Rules();
  const targets = new Targets();
  const spawner = new ImmediateSpawner(horde, () => spawns);
  const inc = new SchoolIncident(targets, spawner);
  inc.start();
  const run = (sec: number): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec / DT); i++) {
      spawner.step();
      ev.push(...inc.step(DT, { horde, rules }));
    }
    return ev;
  };
  const hp = () => targets.get('school').hp;
  const mine = () => horde.list.filter((h) => h.incidentId === inc.id);
  const degraders = () => mine().filter((h) => h.role === 'degrader' && h.state !== 'ko');
  const degradeAll = () => degraders().forEach((h) => (h.state = 'degrade'));
  const koAll = () => mine().forEach((h) => horde.applyHit(h.lifeId, 9999));
  return { horde, rules, targets, inc, run, hp, mine, degradeAll, koAll };
}

test('no hp lost while rioters walk and nothing burns (RC-52)', () => {
  const { inc, run, hp } = setup();
  expect(inc.stage).toBe('attack');
  const ev = run(5);
  expect(hp()).toBe(100);
  expect(inc.status()).toBe('attaquée');
  expect(ev).toEqual([]);
});

test('hp drains while degrading and stops when they stop (RC-53)', () => {
  const { inc, run, hp, mine, degradeAll } = setup();
  expect(mine()).toHaveLength(3);
  degradeAll();
  const ev = run(2);
  expect(hp()).toBeCloseTo(100 - 2 * 2 * CONFIG.target.degradeDps, 6);
  expect(ev.filter((e) => e.type === 'BuildingThreatStarted')).toHaveLength(1);
  mine().forEach((h) => (h.state = 'approach'));
  const before = hp();
  const ev2 = run(2);
  expect(hp()).toBe(before);
  expect(ev2).toEqual([]);
});

test('integrity is the school hp in percent; status follows the fire', () => {
  const { inc, targets } = setup();
  targets.get('school').hp = 50;
  expect(inc.integrity()).toBe(50);
  targets.ignite('school', inc.id);
  expect(inc.status()).toBe('en feu');
});

test('first line KO -> cinematic 3 s -> exactly the 7 reinforcements, skipping does not double (RC-27)', () => {
  const { inc, run, horde, koAll, mine } = setup();
  expect(new Set(mine().map((h) => h.variant)).size).toBe(3);
  koAll();
  run(DT);
  expect(inc.stage).toBe('cinematic');
  expect(inc.suspended()).toBe(true);
  run(2.5);
  expect(inc.stage).toBe('cinematic');
  expect(horde.list.filter((h) => h.incidentId === inc.id && h.state !== 'ko')).toHaveLength(0);
  run(1);
  expect(inc.stage).toBe('reinforcements');
  expect(inc.suspended()).toBe(false);
  run(2);
  const active = horde.active().filter((h) => h.incidentId === inc.id);
  expect(active).toHaveLength(R1.reinforcements.length);
  const count = (r: string) => active.filter((h) => h.role === r).length;
  expect([count('degrader'), count('contact')]).toEqual([4, 3]);
});

test('spawn cap keeps reinforcements pending, never dropped', () => {
  const { inc, run, horde, koAll } = setup();
  koAll();
  for (let i = 0; i < CONFIG.caps.hostiles - 2; i++) horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 10, y: 10 } });
  run(3.5);
  expect(horde.active().filter((h) => h.incidentId === inc.id)).toHaveLength(2);
  expect(inc.requiredActive(horde)).toBe(true);
  horde.active().filter((h) => h.incidentId === null).forEach((h) => horde.applyHit(h.lifeId, 9999));
  // the pending ones are not KO: the school is not saved meanwhile
  horde.active().filter((h) => h.incidentId === inc.id).forEach((h) => horde.applyHit(h.lifeId, 9999));
  run(DT);
  expect(inc.stage).toBe('reinforcements');
  run(1);
  expect(horde.active().filter((h) => h.incidentId === inc.id)).toHaveLength(R1.reinforcements.length - 2);
});

test('saved: +8 once, stage saved at once when no fire burns (RC-28)', () => {
  const { inc, run, rules, koAll, mine } = setup();
  koAll();
  run(3.5);
  run(1);
  expect(mine().filter((h) => h.state !== 'ko')).toHaveLength(R1.reinforcements.length);
  koAll();
  const ev = run(2);
  expect(inc.stage).toBe('saved');
  expect(inc.status()).toBe('sauvée');
  expect(rules.score).toBe(CONFIG.casse.scores.school[0]);
  expect(ev.filter((e) => e.type === 'SchoolRestored')).toHaveLength(1);
  run(2);
  expect(rules.score).toBe(8);
});

test('destroyed: -3 once, stays destroyed; unsent reinforcements come once, at the ruin (RC-29, §9.1)', () => {
  const { inc, run, rules, horde, targets, degradeAll, koAll } = setup();
  targets.get('school').hp = 1;
  degradeAll();
  const ev = run(1.5);
  expect(inc.stage).toBe('destroyed');
  expect(inc.status()).toBe('perdue');
  expect(rules.score).toBe(CONFIG.casse.scores.school[1]);
  expect(ev.filter((e) => e.type === 'BuildingDestroyed')).toHaveLength(1);
  koAll();
  run(5);
  expect(inc.stage).toBe('destroyed');
  expect(rules.score).toBe(-3);
  // they count in the round total: sent once when the school falls (no site left: they go for Paul)
  expect(horde.list.filter((h) => h.incidentId === inc.id)).toHaveLength(R1.firstLine.length + R1.reinforcements.length);
});

test('status reads "renforts" during the cinematic', () => {
  const { inc, run, koAll } = setup();
  koAll();
  run(DT);
  expect(inc.stage).toBe('cinematic');
  expect(inc.status()).toBe('renforts');
});

test('skipCinematic spawns the reinforcements exactly once on the next step', () => {
  const { inc, run, horde, koAll } = setup();
  const reinforcements = () => horde.list.filter((h) => h.incidentId === inc.id && h.state !== 'ko');
  inc.skipCinematic(); // attack: no-op
  run(DT);
  expect(inc.stage).toBe('attack');
  koAll();
  run(DT);
  expect(inc.stage).toBe('cinematic');
  inc.skipCinematic();
  inc.skipCinematic();
  expect(inc.stage).toBe('cinematic');
  run(DT);
  expect(inc.stage).toBe('reinforcements');
  expect(reinforcements()).toHaveLength(R1.reinforcements.length);
  inc.skipCinematic(); // reinforcements: no-op
  run(1);
  expect(inc.stage).toBe('reinforcements');
  expect(reinforcements()).toHaveLength(R1.reinforcements.length);
});
