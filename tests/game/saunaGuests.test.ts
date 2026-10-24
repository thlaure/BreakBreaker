import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SAUNA_GUESTS } from '../../src/game/render/saunaGuests';

describe('sauna guests', () => {
  test('three guests, each on a different map character sheet that exists on disk', () => {
    expect(SAUNA_GUESTS).toHaveLength(3);
    expect(new Set(SAUNA_GUESTS.map((g) => g.sheet)).size).toBe(3);
    for (const g of SAUNA_GUESTS) {
      expect(g.sheet).toMatch(/^(protester|elder)_\d$/);
      expect(existsSync(`public/assets/chars/${g.sheet}.png`)).toBe(true);
    }
  });

  test('guests are told apart by props only, none of them religious or physical', () => {
    expect(SAUNA_GUESTS.map((g) => g.prop)).toEqual(['capTie', 'judoBelt', 'feltHat']);
  });
});
