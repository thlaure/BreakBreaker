import { describe, expect, test } from 'vitest';
import { ZOMBIE_LOOKS, isZombie, zombieSheetFor, zombieSheetKey } from '../../src/events/halloween/zombieMath';

describe('zombie choice', () => {
  test('the Caïd is never a zombie, about half of the others are', () => {
    let n = 0;
    for (let id = 0; id < 2000; id++) {
      expect(isZombie('boss', id)).toBe(false);
      if (isZombie('contact', id)) n++;
    }
    expect(n).toBeGreaterThan(800);
    expect(n).toBeLessThan(1200);
  });

  test('the same life always gets the same look', () => {
    for (let id = 0; id < 200; id++) expect(isZombie('runner', id)).toBe(isZombie('runner', id));
  });

  test('a zombie wears the sheet painted from its own base sheet, a plain rioter keeps his', () => {
    for (const { base } of ZOMBIE_LOOKS) {
      const id = Array.from({ length: 50 }, (_, i) => i).find((i) => isZombie('contact', i))!;
      expect(zombieSheetFor(base, 'contact', id)).toBe(zombieSheetKey(base));
      const calm = Array.from({ length: 50 }, (_, i) => i).find((i) => !isZombie('contact', i))!;
      expect(zombieSheetFor(base, 'contact', calm)).toBe(base);
    }
    expect(zombieSheetFor('caid_2', 'boss', 3)).toBe('caid_2');
  });

  test('eight looks, each with its own base sheet, all with flashy hair of distinct colours', () => {
    expect(ZOMBIE_LOOKS).toHaveLength(8);
    expect(new Set(ZOMBIE_LOOKS.map((l) => l.base)).size).toBe(8);
    expect(new Set(ZOMBIE_LOOKS.map((l) => l.hair)).size).toBeGreaterThanOrEqual(5);
  });
});
