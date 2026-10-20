import { describe, expect, test } from 'vitest';
import { Targets } from '../../src/sim/targets';

describe('Targets', () => {
  test('damage lowers hp; reaching 0 ruins once and returns true only that time', () => {
    const t = new Targets();
    expect(t.damage('car1', 20)).toBe(false);
    expect(t.get('car1').hp).toBe(40);
    expect(t.damage('car1', 50)).toBe(true);
    expect(t.get('car1').hp).toBe(0);
    t.ruin('car1', 'i1');
    expect(t.damage('car1', 5)).toBe(false);
    expect(t.standing('car1')).toBe(false);
    expect(t.intact()).not.toContain('car1');
  });
  test('ignite twice returns false the second time; a ruin cannot ignite', () => {
    const t = new Targets();
    expect(t.ignite('car2')).toBe(true);
    expect(t.ignite('car2')).toBe(false);
    t.extinguish('car2');
    expect(t.get('car2').burning).toBe(false);
    t.ruin('busStop', 'i2');
    expect(t.ignite('busStop')).toBe(false);
  });
  test('repair returns the lost incident id once and restores 60 % of max hp (60 for school, 36 for a car)', () => {
    const t = new Targets();
    t.ruin('school', 'sch');
    t.ruin('car1', 'c1');
    expect(t.repair('school')).toBe('sch');
    expect(t.repair('school')).toBeNull();
    expect(t.get('school').hp).toBe(60);
    expect(t.repair('car1')).toBe('c1');
    expect(t.get('car1').hp).toBe(36);
    expect(t.standing('car1')).toBe(true);
  });
  test('refill brings intact targets back to max, leaves ruins at 0', () => {
    const t = new Targets();
    t.damage('school', 70);
    t.ruin('car2', 'c2');
    t.refill();
    expect(t.get('school').hp).toBe(100);
    expect(t.get('car2').hp).toBe(0);
    expect(t.get('car2').state).toBe('ruined');
  });
});
