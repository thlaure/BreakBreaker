import { describe, expect, test } from 'vitest';
import { activeEventId } from '../../src/events/schedule';

const day = (m: number, d: number): Date => new Date(2026, m - 1, d, 12);

describe('event schedule', () => {
  test('Halloween runs from 24 October to 2 November, both included', () => {
    expect(activeEventId(day(10, 23), '')).toBeNull();
    expect(activeEventId(day(10, 24), '')).toBe('halloween');
    expect(activeEventId(day(10, 31), '')).toBe('halloween');
    expect(activeEventId(day(11, 2), '')).toBe('halloween');
    expect(activeEventId(day(11, 3), '')).toBeNull();
    expect(activeEventId(day(6, 15), '')).toBeNull();
  });

  test('the window is the same every year', () => {
    expect(activeEventId(new Date(2031, 9, 28), '')).toBe('halloween');
  });

  test('?event=halloween forces it on, ?event=none forces it off', () => {
    expect(activeEventId(day(6, 15), '?event=halloween')).toBe('halloween');
    expect(activeEventId(day(10, 31), '?go&event=none')).toBeNull();
  });

  test('an unknown ?event= value is ignored', () => {
    expect(activeEventId(day(10, 31), '?event=xmas')).toBe('halloween');
    expect(activeEventId(day(6, 15), '?event=xmas')).toBeNull();
  });
});
