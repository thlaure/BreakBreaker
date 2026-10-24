import { describe, expect, test } from 'vitest';
import { flagKind, hasPumpkinHead, pumpkinFace } from '../../src/events/halloween/rioterLook';
import { isZombie } from '../../src/events/halloween/zombieMath';
import type { Role } from '../../src/sim/types';

const N = 4000;
const ids = Array.from({ length: N }, (_, i) => i);
const share = (n: number): number => n / N;

describe('pumpkin heads', () => {
  test('about one in four ordinary rioters, about one in three Caïds', () => {
    const plain = share(ids.filter((i) => !isZombie('contact', i) && hasPumpkinHead('contact', i)).length / 0.5);
    expect(plain).toBeGreaterThan(0.2);
    expect(plain).toBeLessThan(0.3);
    const caids = share(ids.filter((i) => hasPumpkinHead('boss', i)).length);
    expect(caids).toBeGreaterThan(0.28);
    expect(caids).toBeLessThan(0.38);
  });

  test('a zombie never has one (his own look is enough), whatever his role', () => {
    for (const role of ['contact', 'thrower', 'runner', 'brute', 'shooter', 'molotov'] as Role[])
      for (const i of ids) if (isZombie(role, i)) expect(hasPumpkinHead(role, i)).toBe(false);
  });

  test('the face is one of three, stable for a life, and all three show up', () => {
    const seen = new Set(ids.map((i) => pumpkinFace(i)));
    expect([...seen].sort()).toEqual([0, 1, 2]);
    for (const i of ids.slice(0, 50)) expect(pumpkinFace(i)).toBe(pumpkinFace(i));
  });
});

describe('zombie flags', () => {
  test('a zombie never carries a variant flag; about one in three carries the black skull flag', () => {
    const zs = ids.filter((i) => isZombie('contact', i));
    expect(zs.every((i) => flagKind('contact', i) !== 'variant')).toBe(true);
    const skull = zs.filter((i) => flagKind('contact', i) === 'skull').length / zs.length;
    expect(skull).toBeGreaterThan(0.28);
    expect(skull).toBeLessThan(0.38);
  });

  test('a non-zombie keeps his variant flag, the Caïd never has one', () => {
    for (const i of ids.filter((k) => !isZombie('contact', k)).slice(0, 200)) expect(flagKind('contact', i)).toBe('variant');
    for (const i of ids.slice(0, 200)) expect(flagKind('boss', i)).toBe('none');
  });
});
