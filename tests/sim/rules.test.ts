import { expect, test } from 'vitest';
import { Rules } from '../../src/sim/rules';

test('every variant scores +1 at KO, counted once (RC-08, equal scoring)', () => {
  const r = new Rules();
  expect(r.onKnockout(1)).toBe(true);
  expect(r.onKnockout(1)).toBe(false);
  r.onKnockout(2);
  expect(r.score).toBe(2);
  expect(r.kos).toBe(2);
});

test('occurrence bonuses are awarded once per key', () => {
  const r = new Rules();
  r.award('school#1:saved', 8);
  r.award('school#1:saved', 8);
  expect(r.score).toBe(8);
});

test('no gains after session end', () => {
  const r = new Rules();
  r.end('ko');
  expect(r.onKnockout(5)).toBe(false);
  expect(r.award('x', 6)).toBe(false);
  expect(r.score).toBe(0);
  expect(r.kos).toBe(0);
});

test('stats start at zero and ended starts false', () => {
  const r = new Rules();
  expect(r.ended).toBe(false);
  expect(r.stats).toEqual({
    schoolsSaved: 0,
    schoolsLost: 0,
    rescuesOk: 0,
    rescuesFailed: 0,
    healsUsed: 0,
    rocksPicked: 0,
    rocksReturned: 0,
    rocksHit: 0,
    activeSeconds: 0,
  });
});

test('negative awards are allowed and deduped by key', () => {
  const r = new Rules();
  expect(r.award('school#2:lost', -3)).toBe(true);
  expect(r.award('school#2:lost', -3)).toBe(false);
  expect(r.score).toBe(-3);
});

test('onKnockout increments score and kos together', () => {
  const r = new Rules();
  r.award('bonus', 5);
  r.onKnockout(9);
  expect(r.score).toBe(6);
  expect(r.kos).toBe(1);
});

test('end is idempotent with respect to ended flag and reports ko or quit', () => {
  const r = new Rules();
  r.end('quit');
  expect(r.ended).toBe(true);
  r.end('ko');
  expect(r.ended).toBe(true);
});
