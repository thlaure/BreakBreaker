import { describe, expect, test } from 'vitest';
import { schoolFlagShown } from '../../src/game/render/targetMath';
import { Sim } from '../../src/sim/sim';

const school = (sim: Sim) => sim.snapshot().targets.find((t) => t.id === 'school')!;

describe('school flag (derived from the school target, not from the incident stage)', () => {
  test('pure helper: standing and not on fire → flag; burning, ruined or another target → none', () => {
    expect(schoolFlagShown({ id: 'school', state: 'intact' }, false)).toBe(true);
    expect(schoolFlagShown({ id: 'school', state: 'attacked' }, false)).toBe(true);
    expect(schoolFlagShown({ id: 'school', state: 'attacked' }, true)).toBe(false);
    expect(schoolFlagShown({ id: 'school', state: 'burning' }, true)).toBe(false);
    expect(schoolFlagShown({ id: 'school', state: 'ruined' }, false)).toBe(false);
    expect(schoolFlagShown({ id: 'shop', state: 'intact' }, false)).toBe(false);
  });

  test('a ruined school has none; once repaired its flag is back although its incident stays destroyed', () => {
    const sim = new Sim(1);
    expect(schoolFlagShown(school(sim), school(sim).burning)).toBe(true);
    sim.targets.ignite('school', 'school#1');
    expect(schoolFlagShown(school(sim), school(sim).burning)).toBe(false);
    sim.targets.ruin('school', 'school#1');
    expect(school(sim).state).toBe('ruined');
    expect(schoolFlagShown(school(sim), school(sim).burning)).toBe(false);
    sim.targets.repair('school');
    expect(sim.snapshot().school.stage).not.toBe('saved');
    expect(schoolFlagShown(school(sim), school(sim).burning)).toBe(true);
  });

  test('a fire put out gives the flag back', () => {
    const sim = new Sim(1);
    sim.targets.ignite('school', 'school#1');
    expect(schoolFlagShown(school(sim), school(sim).burning)).toBe(false);
    sim.targets.extinguish('school');
    expect(schoolFlagShown(school(sim), school(sim).burning)).toBe(true);
  });
});
