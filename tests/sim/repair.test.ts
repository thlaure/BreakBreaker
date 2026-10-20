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
  const step = () => kit.step(DT, { player, horde, targets, rules });
  const run = (sec: number) => {
    const events = [];
    for (let i = 0; i < Math.round(sec / DT); i++) events.push(...step().events);
    return events;
  };
  return { kit, targets, player, rules, horde, step, run };
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

  test('2 s next to the ruined school with no rioter near: repaired to 60 hp, toolbox used, +5, the -3 stays', () => {
    const { kit, targets, player, rules, run } = setup('school');
    rules.award('school-i1:lost', -3);
    kit.carried = true;
    player.pos = { x: door('school').x + 30, y: door('school').y };
    const ev = run(2);
    expect(ev).toEqual([{ type: 'TargetRepaired', target: 'school', incidentId: 'school-i1' }]);
    expect(targets.get('school').hp).toBe(60);
    expect(targets.standing('school')).toBe(true);
    expect(kit.carried).toBe(false);
    expect(rules.score).toBe(2);
    expect(kit.repairing).toBeNull();
  });

  test('a burnt car repairs for +3', () => {
    const { kit, player, rules, run } = setup('car1');
    kit.carried = true;
    player.pos = { ...door('car1') };
    run(2);
    expect(rules.score).toBe(3);
  });

  test('a ruin never lost through an incident still awards uniquely per repair', () => {
    const { kit, targets, player, rules, run } = setup('car1');
    kit.carried = true;
    player.pos = { ...door('car1') };
    run(2);
    targets.ruin('car1', 'i2');
    targets.get('car1').lostIncidentId = null;
    kit.carried = true;
    run(2);
    expect(rules.score).toBe(6);
  });

  test('progress is exposed while repairing, and shuffling inside the range keeps it', () => {
    const { kit, player, step } = setup('school');
    kit.carried = true;
    player.pos = { x: door('school').x + 10, y: door('school').y };
    for (let i = 0; i < 30; i++) step();
    expect(kit.repairing).toBe('school');
    expect(kit.progress).toBeCloseTo(0.5, 5);
    player.pos = { x: door('school').x - 40, y: door('school').y };
    step();
    expect(kit.progress).toBeCloseTo(0.5 + DT, 5);
  });

  test('a hostile within 64 px or leaving range resets progress and consumes nothing', () => {
    const { kit, targets, player, horde, step, run } = setup('school');
    kit.carried = true;
    player.pos = { x: door('school').x + 30, y: door('school').y };
    run(1);
    expect(kit.progress).toBeGreaterThan(0.9);
    horde.spawn({ variant: 'classic', role: 'contact', pos: { x: player.pos.x + 50, y: player.pos.y } });
    const r = step();
    expect(r.message).toBe('Abords non sécurisés');
    expect(kit.progress).toBe(0);
    expect(kit.carried).toBe(true);
    expect(targets.get('school').state).toBe('ruined');
    horde.list.length = 0;
    run(1);
    expect(kit.progress).toBeGreaterThan(0.9);
    player.pos = { x: door('school').x + CONFIG.kit.applyRange + 5, y: door('school').y };
    expect(step().message).toBeNull();
    expect(kit.progress).toBe(0);
    expect(kit.carried).toBe(true);
  });

  test('without a toolbox near a ruin: Caisse à outils requise, nothing repaired', () => {
    const { targets, player, step, run } = setup('school');
    player.pos = { ...door('school') };
    expect(step().message).toBe('Caisse à outils requise');
    run(3);
    expect(targets.get('school').state).toBe('ruined');
  });

  test('Paul KO on the completing step: no repair', () => {
    const { kit, targets, player, rules, step, run } = setup('school');
    kit.carried = true;
    player.pos = { ...door('school') };
    run(2 - DT); // the next step would complete
    player.ko = true;
    expect(step().events).toEqual([]);
    expect(targets.get('school').state).toBe('ruined');
    expect(kit.carried).toBe(true);
    expect(rules.score).toBe(0);
  });

  test('next to an intact target nothing happens', () => {
    const { kit, player, step, run } = setup(null);
    kit.carried = true;
    player.pos = { ...door('school') };
    expect(step()).toEqual({ events: [], message: null });
    expect(run(3)).toEqual([]);
    expect(kit.carried).toBe(true);
  });
});
