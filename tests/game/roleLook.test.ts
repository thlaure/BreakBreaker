import { describe, expect, test } from 'vitest';
import { badgeOf, hpBarShown, hpFill, rioterSheet, roleScale } from '../../src/game/render/roleLook';
import { CHAR_SHEETS } from '../../src/game/assets';

describe('role looks', () => {
  test('runners wear the hooded runner sheets; everyone else keeps the variant sheet (a/b by lifeId parity)', () => {
    expect(rioterSheet('antifa', 'runner', 2)).toBe('rioter_runner_a');
    expect(rioterSheet('classic', 'runner', 3)).toBe('rioter_runner_b');
    expect(rioterSheet('palestinian', 'brute', 4)).toBe('rioter_palestinian_a');
    expect(rioterSheet('classic', 'boss', 5)).toBe('rioter_classic_b');
    for (const s of ['rioter_runner_a', 'rioter_runner_b']) expect(CHAR_SHEETS as readonly string[]).toContain(s);
  });

  test('brute ×1.25 with a helmet, Caïd ×1.5 with a crown, others plain', () => {
    expect([roleScale('contact'), roleScale('runner'), roleScale('brute'), roleScale('boss')]).toEqual([1, 1, 1.25, 1.5]);
    expect([badgeOf('contact'), badgeOf('runner'), badgeOf('brute'), badgeOf('boss')]).toEqual([null, null, 'badge_helmet', 'badge_crown']);
  });

  test('HP bar: the Caïd always, a brute once damaged, never a KO body nor another role', () => {
    expect(hpBarShown({ role: 'boss', hp: 6, maxHp: 6, state: 'approach' })).toBe(true);
    expect(hpBarShown({ role: 'boss', hp: 0, maxHp: 6, state: 'ko' })).toBe(false);
    expect(hpBarShown({ role: 'brute', hp: 4, maxHp: 4, state: 'approach' })).toBe(false);
    expect(hpBarShown({ role: 'brute', hp: 3, maxHp: 4, state: 'windup' })).toBe(true);
    expect(hpBarShown({ role: 'contact', hp: 1, maxHp: 2, state: 'approach' })).toBe(false);
    expect([hpFill(6, 6, 18), hpFill(3, 6, 18), hpFill(1, 6, 18), hpFill(0, 6, 18)]).toEqual([18, 9, 3, 0]);
  });
});
