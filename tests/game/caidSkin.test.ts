import { describe, expect, test } from 'vitest';
import { CAID_SKINS } from '../../src/content/caids';
import {
  CAID_BUBBLE_MAX_MS,
  CAID_BUBBLE_MIN_MS,
  CAID_SKIN_COUNT,
  caidBubbleGap,
  caidSheetKey,
  caidSkinOf,
  caidSlogan,
} from '../../src/game/render/caidSkin';
import { inmateTextureKey } from '../../src/game/render/prisonMath';
import { rioterSheet } from '../../src/game/render/roleLook';

describe('caidSkinOf: one of five looks per Caïd, deterministic', () => {
  test('always 0..4, stable across calls', () => {
    for (let id = -50; id < 2000; id++) {
      const s = caidSkinOf(id);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(CAID_SKIN_COUNT);
      expect(caidSkinOf(id)).toBe(s);
    }
  });

  test('all five looks show up, roughly evenly, over many ids', () => {
    const n = [0, 0, 0, 0, 0];
    for (let id = 0; id < 5000; id++) n[caidSkinOf(id)]! += 1;
    for (const c of n) expect(c).toBeGreaterThan(700);
  });

  test('all five show up over a few consecutive ids and over ids sharing a stride', () => {
    const seen = new Set<number>();
    for (let id = 1; id <= 20; id++) seen.add(caidSkinOf(id));
    expect(seen.size).toBe(5);
    const strided = new Set<number>();
    for (let k = 0; k < 40; k++) strided.add(caidSkinOf(10 * k + 3));
    expect(strided.size).toBe(5);
  });

  test('CAID_SKINS has one entry per look', () => {
    expect(CAID_SKINS).toHaveLength(CAID_SKIN_COUNT);
  });
});

describe('the same look on the street, in the van and in the yard', () => {
  test('a Caïd’s sheet is caid_<look of his lifeId>, whatever his variant', () => {
    for (const v of ['classic', 'palestinian', 'antifa'] as const) {
      for (const id of [1, 2, 7, 42]) expect(rioterSheet(v, 'boss', id)).toBe(caidSheetKey(caidSkinOf(id)));
    }
    expect(caidSheetKey(3)).toBe('caid_3');
  });

  test('an inmate is drawn with the sheet he had on the street (his lifeId)', () => {
    for (const lifeId of [3, 8, 19, 77]) {
      expect(inmateTextureKey({ id: 1, variant: 'antifa', lifeId })).toBe(rioterSheet('antifa', 'boss', lifeId));
    }
  });
});

describe('the Caïd’s speech bubbles', () => {
  test('a gap of 10–18 s between two slogans', () => {
    expect(CAID_BUBBLE_MIN_MS).toBe(10_000);
    expect(CAID_BUBBLE_MAX_MS).toBe(18_000);
    for (const r of [0, 0.25, 0.5, 0.999]) {
      const g = caidBubbleGap(r);
      expect(g).toBeGreaterThanOrEqual(CAID_BUBBLE_MIN_MS);
      expect(g).toBeLessThanOrEqual(CAID_BUBBLE_MAX_MS);
    }
  });

  test('a slogan of the look, any r in [0, 1)', () => {
    for (const s of [0, 1, 2, 3, 4] as const) {
      for (const r of [0, 0.3, 0.6, 0.9999]) expect(CAID_SKINS[s]!.slogans).toContain(caidSlogan(s, r));
    }
  });
});
