import { describe, expect, test } from 'vitest';
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
    itemsReturned: 0,
    targetsSaved: 0,
    targetsLost: 0,
    repairs: 0,
    monumentsDefended: 0,
    flagsLost: 0,
    flagsCaptured: 0,
    roundsCompleted: 0,
    roundsPerfect: 0,
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

test('endCause starts null and the first end() wins', () => {
  const r = new Rules();
  expect(r.endCause).toBeNull();
  r.end('quit');
  expect(r.ended).toBe(true);
  expect(r.endCause).toBe('quit');
  r.end('ko');
  expect(r.ended).toBe(true);
  expect(r.endCause).toBe('quit');
});

test('endCause records ko when the first end is a KO', () => {
  const r = new Rules();
  r.end('ko');
  r.end('quit');
  expect(r.endCause).toBe('ko');
});

test('non-finite award points are ignored and do not consume the key', () => {
  const r = new Rules();
  expect(r.award('nan', Number.NaN)).toBe(false);
  expect(r.award('inf', Number.POSITIVE_INFINITY)).toBe(false);
  expect(r.award('inf', Number.NEGATIVE_INFINITY)).toBe(false);
  expect(r.score).toBe(0);
  expect(r.award('nan', 4)).toBe(true);
  expect(r.score).toBe(4);
});

test('dedup memory stays bounded to 256 entries over 1000 distinct KOs', () => {
  const r = new Rules();
  for (let i = 0; i < 1000; i++) expect(r.onKnockout(i)).toBe(true);
  expect(r.score).toBe(1000);
  expect(r.kos).toBe(1000);
  const sizes = r.dedupSize();
  expect(sizes.kos).toBeLessThanOrEqual(256);
  expect(sizes.awards).toBeLessThanOrEqual(256);
  expect(r.onKnockout(999)).toBe(false);
  expect(r.score).toBe(1000);
});

test('award dedup memory stays bounded to 256 entries over 1000 distinct keys', () => {
  const r = new Rules();
  for (let i = 0; i < 1000; i++) expect(r.award(`k${i}`, 1)).toBe(true);
  expect(r.score).toBe(1000);
  expect(r.dedupSize().awards).toBeLessThanOrEqual(256);
  expect(r.award('k999', 1)).toBe(false);
  expect(r.score).toBe(1000);
});

describe('score outbox (floating popups)', () => {
  test('an applied KO and an applied award each queue { points, at } with their position', () => {
    const r = new Rules();
    r.onKnockout(1, { x: 10, y: 20 });
    r.award('school#1:saved', 8, { x: 30, y: 40 });
    r.award('school#1:lost', -3);
    expect(r.drain()).toEqual([
      { points: 1, at: { x: 10, y: 20 } },
      { points: 8, at: { x: 30, y: 40 } },
      { points: -3, at: null },
    ]);
  });

  test('the position is copied (later mutation of the source does not move the entry)', () => {
    const r = new Rules();
    const p = { x: 1, y: 2 };
    r.onKnockout(1, p);
    p.x = 99;
    expect(r.drain()[0]!.at).toEqual({ x: 1, y: 2 });
  });

  test('drain empties the outbox', () => {
    const r = new Rules();
    r.onKnockout(1, { x: 0, y: 0 });
    expect(r.drain()).toHaveLength(1);
    expect(r.drain()).toEqual([]);
  });

  test('duplicates, an already-counted KO, zero points, non-finite points and an ended session queue nothing', () => {
    const r = new Rules();
    r.onKnockout(1, { x: 0, y: 0 });
    r.award('k', 4, { x: 0, y: 0 });
    r.drain();
    expect(r.onKnockout(1, { x: 0, y: 0 })).toBe(false);
    expect(r.award('k', 4, { x: 0, y: 0 })).toBe(false);
    r.award('zero', 0, { x: 0, y: 0 });
    r.award('nan', Number.NaN, { x: 0, y: 0 });
    expect(r.drain()).toEqual([]);
    r.end('quit');
    expect(r.onKnockout(2, { x: 0, y: 0 })).toBe(false);
    expect(r.award('after', 5, { x: 0, y: 0 })).toBe(false);
    expect(r.drain()).toEqual([]);
  });

  test('the outbox sums to the score', () => {
    const r = new Rules();
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      r.onKnockout(i, { x: i, y: 0 });
      r.award(`a${i % 7}`, (i % 5) - 2, { x: 0, y: i });
      for (const e of r.drain()) sum += e.points;
    }
    expect(sum).toBe(r.score);
  });
});
