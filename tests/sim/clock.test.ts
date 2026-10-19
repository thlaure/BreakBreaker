import { expect, test } from 'vitest';
import { FixedClock } from '../../src/sim/clock';

test('clock yields whole steps and keeps remainder', () => {
  const c = new FixedClock(1 / 60, 5);
  expect(c.advance((1 / 60) * 2.5)).toBe(2);
  expect(c.advance((1 / 60) * 0.5)).toBe(1);
});
test('clock caps catch-up after a long frame and drops the excess', () => {
  const c = new FixedClock(1 / 60, 5);
  expect(c.advance(3)).toBe(5);
  expect(c.advance(0)).toBe(0);
});
test('paused clock yields no steps and no active time', () => {
  const c = new FixedClock(1 / 60, 5);
  c.paused = true;
  expect(c.advance(1)).toBe(0);
  expect(c.activeTime).toBe(0);
});
test('activeTime accumulates stepped simulated seconds', () => {
  const c = new FixedClock(1 / 60, 5);
  c.advance(3);
  expect(c.activeTime).toBeCloseTo(5 / 60, 9);
});
