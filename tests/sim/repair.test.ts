import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde } from '../../src/sim/hostiles';
import { DISTRICT } from '../../src/sim/map/district';
import { createPlayer } from '../../src/sim/player';
import { Toolboxes } from '../../src/sim/repair';
import { Rules } from '../../src/sim/rules';
import { Targets } from '../../src/sim/targets';
import type { TargetId } from '../../src/sim/types';

const DT = 1 / 60;
const door = (id: TargetId) => DISTRICT.targets.find((d) => d.id === id)!.door;
const FAR = { x: 1000, y: 1000 };

function setup(ruin: TargetId | null = 'school') {
  const kit = new Toolboxes();
  const targets = new Targets();
  if (ruin) targets.ruin(ruin, `${ruin}-i1`);
  const player = createPlayer(FAR);
  const rules = new Rules();
  const horde = new Horde();
  /** One step; `act` = the Agir key (F / touch Agir) pressed on it. */
  const step = (act = false) => kit.step(DT, { player, horde, targets, rules, act });
  /** Steps for `sec` without touching the key. */
  const run = (sec: number) => {
    const events = [];
    for (let i = 0; i < Math.round(sec / DT); i++) events.push(...step().events);
    return events;
  };
  /** Presses Agir once (one step), then lets go for the rest of `sec`. */
  const press = (sec = DT) => [...step(true).events, ...run(sec - DT)];
  return { kit, targets, player, rules, horde, step, run, press };
}

describe('toolboxes', () => {
  test('place fills to 2 on free sites, never within 64 px of Paul, ids never reused', () => {
    const { kit } = setup();
    const sites = DISTRICT.kitSites;
    const near = { x: sites[0]!.x + 10, y: sites[0]!.y };
    const ev = kit.place(sites, near);
    expect(ev.map((e) => e.type)).toEqual(['ToolboxSpawned', 'ToolboxSpawned']);
    expect(kit.ground.map((g) => g.pos)).toEqual([sites[1], sites[2]]); // site 0 too close to Paul
    expect(kit.place(sites, near)).toEqual([]); // already full
    kit.ground.shift();
    const ev2 = kit.place(sites, near);
    expect(ev2).toHaveLength(1);
    expect(kit.ground.map((g) => g.id)).toEqual([2, 3]);
    expect(kit.ground.map((g) => g.pos)).toEqual([sites[2], sites[1]]); // the freed site is reused, ids are not
  });

  test('walk over a toolbox picks it up; carrying one leaves the next on the ground', () => {
    const { kit, player, step } = setup(null);
    const [a, b] = DISTRICT.kitSites;
    kit.place([a!, b!], FAR);
    player.pos = { ...a! };
    expect(step().events).toEqual([{ type: 'ToolboxPickedUp', id: 1 }]);
    expect(kit.carried).toBe(true);
    player.pos = { ...b! };
    expect(step().events).toEqual([]);
    expect(kit.ground).toHaveLength(1);
  });

  test('one press of Agir next to the ruined school, no rioter near: 2 s later (key released) repaired to 100 hp, toolbox used, +5, the -3 stays', () => {
    const { kit, targets, player, rules, press } = setup('school');
    rules.award('school-i1:lost', -3);
    kit.carried = true;
    player.pos = { x: door('school').x + 30, y: door('school').y };
    const ev = press(2);
    expect(ev).toEqual([{ type: 'TargetRepaired', target: 'school', incidentId: 'school-i1' }]);
    expect(targets.get('school').hp).toBe(100);
    expect(targets.standing('school')).toBe(true);
    expect(kit.carried).toBe(false);
    expect(rules.score).toBe(2);
    expect(kit.repairing).toBeNull();
    expect(kit.started).toBe(false);
  });

  test('without pressing Agir nothing happens: progress stays 0, ready to start', () => {
    const { kit, targets, player, step, run } = setup('school');
    kit.carried = true;
    player.pos = { ...door('school') };
    expect(step()).toEqual({ events: [], message: null });
    expect(run(5)).toEqual([]);
    expect(kit.progress).toBe(0);
    expect(kit.started).toBe(false);
    expect(kit.ready).toBe(true);
    expect(targets.get('school').state).toBe('ruined');
    expect(kit.carried).toBe(true);
  });

  test('a burnt car repairs for +3', () => {
    const { kit, player, rules, press } = setup('car1');
    kit.carried = true;
    player.pos = { ...door('car1') };
    press(2);
    expect(rules.score).toBe(3);
  });

  test('a ruin never lost through an incident still awards uniquely per repair', () => {
    const { kit, targets, player, rules, press } = setup('car1');
    kit.carried = true;
    player.pos = { ...door('car1') };
    press(2);
    targets.ruin('car1', 'i2');
    targets.get('car1').lostIncidentId = null;
    kit.carried = true;
    press(2);
    expect(rules.score).toBe(6);
  });

  test('progress is exposed while repairing, and shuffling inside the range keeps it', () => {
    const { kit, player, step, press } = setup('school');
    kit.carried = true;
    player.pos = { x: door('school').x + 10, y: door('school').y };
    press(30 * DT);
    expect(kit.started).toBe(true);
    expect(kit.repairing).toBe('school');
    expect(kit.progress).toBeCloseTo(0.5, 5);
    player.pos = { x: door('school').x - 40, y: door('school').y };
    step();
    expect(kit.progress).toBeCloseTo(0.5 + DT, 5);
  });

  test('a hostile within 64 px or leaving range resets progress and the start (a new press is needed), consumes nothing', () => {
    const { kit, targets, player, horde, step, run, press } = setup('school');
    kit.carried = true;
    player.pos = { x: door('school').x + 30, y: door('school').y };
    press(1);
    expect(kit.progress).toBeGreaterThan(0.9);
    horde.spawn({ variant: 'classic', role: 'contact', pos: { x: player.pos.x + 50, y: player.pos.y } });
    const r = step();
    expect(r.message).toBe('Abords non sécurisés');
    expect(kit.progress).toBe(0);
    expect(kit.started).toBe(false);
    expect(kit.ready).toBe(false);
    expect(kit.carried).toBe(true);
    expect(targets.get('school').state).toBe('ruined');
    horde.list.length = 0;
    // pressing while a hostile is close started nothing: once clear, it waits for a new press
    run(1);
    expect(kit.progress).toBe(0);
    press(1);
    expect(kit.progress).toBeGreaterThan(0.9);
    player.pos = { x: door('school').x + CONFIG.kit.applyRange + 5, y: door('school').y };
    expect(step().message).toBeNull();
    expect(kit.progress).toBe(0);
    expect(kit.started).toBe(false);
    expect(kit.carried).toBe(true);
    player.pos = { x: door('school').x + 30, y: door('school').y };
    run(3);
    expect(kit.progress).toBe(0);
    expect(targets.get('school').state).toBe('ruined');
  });

  test('pressing Agir with a hostile close or without a toolbox starts nothing', () => {
    const { kit, player, horde, step, run } = setup('school');
    player.pos = { ...door('school') };
    expect(step(true).message).toBe('Caisse à outils requise');
    kit.carried = true;
    const h = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: player.pos.x + 30, y: player.pos.y } })!;
    expect(step(true).message).toBe('Abords non sécurisés');
    horde.applyHit(h.lifeId, 99);
    run(1);
    expect(kit.started).toBe(false);
    expect(kit.progress).toBe(0);
  });

  test('without a toolbox near a ruin: Caisse à outils requise, nothing repaired', () => {
    const { targets, player, step, run } = setup('school');
    player.pos = { ...door('school') };
    expect(step().message).toBe('Caisse à outils requise');
    run(3);
    expect(targets.get('school').state).toBe('ruined');
  });

  test('Paul KO on the completing step: no repair', () => {
    const { kit, targets, player, rules, step, press } = setup('school');
    kit.carried = true;
    player.pos = { ...door('school') };
    press(2 - DT); // the next step would complete
    player.ko = true;
    expect(step().events).toEqual([]);
    expect(targets.get('school').state).toBe('ruined');
    expect(kit.carried).toBe(true);
    expect(rules.score).toBe(0);
    expect(kit.started).toBe(false);
  });

  test('a burning target needs the toolbox too: one press puts the fire out (health back to 100), FireOut + TargetRepaired, +5 once, toolbox used', () => {
    const { kit, targets, player, rules, step, run, press } = setup(null);
    targets.get('school').hp = 41;
    targets.ignite('school', 'school#2');
    player.pos = { ...door('school') };
    expect(kit.repairTarget(player.pos, targets)).toBe('school');
    expect(step(true).message).toBe('Caisse à outils requise');
    kit.carried = true;
    run(1);
    expect(kit.ready).toBe(true);
    expect(kit.progress).toBe(0);
    const ev = press(CONFIG.kit.repairSec);
    expect(ev).toEqual([
      { type: 'FireOut', target: 'school' },
      { type: 'TargetRepaired', target: 'school', incidentId: 'school#2' },
    ]);
    expect(targets.get('school')).toMatchObject({ burning: false, hp: 100, state: 'intact' });
    expect(kit.carried).toBe(false);
    expect(rules.score).toBe(CONFIG.casse.scores.school[2]);
    // nothing left to repair there
    kit.carried = true;
    expect(press(3)).toEqual([]);
    expect(rules.score).toBe(CONFIG.casse.scores.school[2]);
    expect(kit.carried).toBe(true);
  });

  test('a burning car is put out for +3, once per fire', () => {
    const { kit, targets, player, rules, press } = setup(null);
    targets.ignite('car1', 'car#1');
    kit.carried = true;
    player.pos = { ...door('car1') };
    press(CONFIG.kit.repairSec);
    expect(rules.score).toBe(CONFIG.casse.scores.car[2]);
    targets.ignite('car1', 'car#2');
    kit.carried = true;
    press(CONFIG.kit.repairSec);
    expect(rules.score).toBe(2 * CONFIG.casse.scores.car[2]);
  });

  test('next to an intact target nothing happens, even pressing Agir', () => {
    const { kit, player, step, run } = setup(null);
    kit.carried = true;
    player.pos = { ...door('school') };
    expect(step(true)).toEqual({ events: [], message: null });
    expect(kit.ready).toBe(false);
    expect(run(3)).toEqual([]);
    expect(kit.carried).toBe(true);
  });
});
