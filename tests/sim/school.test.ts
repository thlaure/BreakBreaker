import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde } from '../../src/sim/hostiles';
import { SchoolIncident } from '../../src/sim/incidents/school';
import { DISTRICT } from '../../src/sim/map/district';
import { Rules } from '../../src/sim/rules';
import type { SimEvent } from '../../src/sim/types';

const DT = 1 / 60;
const spawns = DISTRICT.hostileSpawns;

function setup() {
  const horde = new Horde();
  const rules = new Rules();
  const inc = new SchoolIncident();
  inc.start(horde, spawns);
  const run = (sec: number, playerInZone = false): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec / DT); i++) ev.push(...inc.step(DT, { horde, rules, playerInZone, spawns }));
    return ev;
  };
  const mine = () => horde.list.filter((h) => h.incidentId === inc.id);
  const degradeAll = () => mine().forEach((h) => h.state !== 'ko' && (h.state = 'degrade'));
  const koAll = () => mine().forEach((h) => horde.applyHit(h.lifeId, 9999));
  return { horde, rules, inc, run, mine, degradeAll, koAll };
}

test('reserve not consumed while rioters walk (RC-52)', () => {
  const { inc, run } = setup();
  expect(inc.stage).toBe('firstLine');
  const ev = run(5);
  expect(inc.remaining).toBe(CONFIG.school.threatSeconds);
  expect(inc.status()).toBe('interrompu');
  expect(ev).toEqual([]);
});

test('reserve decreases 1 s/s while degrading, pauses when interrupted (RC-53)', () => {
  const { inc, run, mine, degradeAll } = setup();
  expect(mine().length).toBe(3);
  degradeAll();
  const ev = run(2);
  expect(inc.remaining).toBeCloseTo(28, 1);
  expect(inc.status()).toBe('en cours');
  expect(ev.filter((e) => e.type === 'BuildingThreatStarted')).toHaveLength(1);
  mine().forEach((h) => (h.state = 'approach'));
  const ev2 = run(2);
  expect(inc.remaining).toBeCloseTo(28, 1);
  expect(ev2.filter((e) => e.type === 'BuildingThreatPaused')).toHaveLength(1);
  expect(inc.status()).toBe('interrompu');
});

test('integrity derives from reserve', () => {
  const { inc } = setup();
  inc.remaining = 15;
  expect(inc.integrity()).toBe(50);
});

test('first line KO -> cinematic 3 s -> exactly 8 reinforcements, skipping does not double (RC-27)', () => {
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
  expect(active).toHaveLength(8);
  const count = (r: string) => active.filter((h) => h.role === r).length;
  expect([count('degrader'), count('contact'), count('thrower')]).toEqual([4, 2, 2]);
});

test('spawn cap keeps reinforcements pending, never dropped', () => {
  const { inc, run, horde, koAll } = setup();
  koAll();
  for (let i = 0; i < CONFIG.caps.hostiles - 2; i++) horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 10, y: 10 } });
  run(3.5);
  expect(horde.active().filter((h) => h.incidentId === inc.id)).toHaveLength(2);
  horde.active().filter((h) => h.incidentId === null).forEach((h) => horde.applyHit(h.lifeId, 9999));
  run(1);
  expect(horde.active().filter((h) => h.incidentId === inc.id)).toHaveLength(8);
});

test('saved: +8 once, stage saved (RC-28)', () => {
  const { inc, run, rules, koAll, mine } = setup();
  koAll();
  run(3.5);
  run(1);
  expect(mine().filter((h) => h.state !== 'ko')).toHaveLength(8);
  koAll();
  const ev = run(2);
  expect(inc.stage).toBe('saved');
  expect(inc.status()).toBe('sauvé');
  expect(rules.score).toBe(8);
  expect(ev.filter((e) => e.type === 'SchoolRestored')).toHaveLength(1);
  run(2);
  expect(rules.score).toBe(8);
});

test('destroyed: -3 once, stays destroyed, no late wave (RC-29)', () => {
  const { inc, run, rules, horde, degradeAll, koAll } = setup();
  inc.remaining = 1;
  degradeAll();
  const ev = run(1.5);
  expect(inc.stage).toBe('destroyed');
  expect(inc.status()).toBe('perdu');
  expect(rules.score).toBe(-3);
  expect(ev.filter((e) => e.type === 'BuildingDestroyed')).toHaveLength(1);
  koAll();
  run(5);
  expect(inc.stage).toBe('destroyed');
  expect(rules.score).toBe(-3);
  expect(horde.list.filter((h) => h.incidentId === inc.id)).toHaveLength(3);
});

test('leaving/re-entering zone keeps same id and reserve (RC-26, RC-54)', () => {
  const { inc, run, degradeAll } = setup();
  degradeAll();
  run(1, true);
  const r = inc.remaining;
  run(2, false);
  const r2 = inc.remaining;
  expect(r2).toBeCloseTo(r - 2, 1);
  run(0, true);
  expect(inc.id).toBe('school#1');
  expect(inc.stage).toBe('firstLine');
});
