import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  CASTER_SHEETS,
  ZOMBIE_BASES,
  isZombie,
  zombieSheetFor,
  zombieSheetKey,
  zombieSheetKeys,
} from '../../src/events/halloween/zombieMath';

const ids = Array.from({ length: 60 }, (_, i) => i);

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

  test('a zombie wears the twin of his base sheet, a plain rioter keeps his', () => {
    for (const base of ZOMBIE_BASES) {
      const z = ids.find((i) => isZombie('contact', i))!;
      expect(zombieSheetFor(base, 'contact', z)).toBe(zombieSheetKey(base));
      const calm = ids.find((i) => !isZombie('contact', i))!;
      expect(zombieSheetFor(base, 'contact', calm)).toBe(base);
    }
    expect(zombieSheetFor('caid_2', 'boss', 3)).toBe('caid_2');
  });

  test('a zombie rock thrower is a hooded caster, both casters show up, and no other role is one', () => {
    const seen = new Set<string>();
    for (const i of ids.filter((k) => isZombie('thrower', k))) {
      const s = zombieSheetFor('rioter_classic_a', 'thrower', i);
      expect(CASTER_SHEETS).toContain(s);
      seen.add(s);
    }
    expect(seen.size).toBe(CASTER_SHEETS.length);
    for (const role of ['contact', 'runner', 'brute', 'shooter', 'molotov'] as const) {
      for (const i of ids.filter((k) => isZombie(role, k)))
        expect(CASTER_SHEETS).not.toContain(zombieSheetFor('rioter_classic_a', role, i));
    }
  });

  test('every sheet the event loads exists on disk, with no duplicates', () => {
    const keys = zombieSheetKeys();
    expect(keys).toHaveLength(ZOMBIE_BASES.length + CASTER_SHEETS.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(existsSync(`public/assets/events/halloween/${k}.png`), k).toBe(true);
  });
});
