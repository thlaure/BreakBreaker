import { describe, expect, test } from 'vitest';
import { paintZombie } from '../../src/events/halloween/zombiePaint';

const F = 64;
const W = F;
const H = F * 8;
const OUTLINE = [16, 16, 16];
const HAIR = [85, 51, 17];
const SKIN = [224, 160, 112];
const SHIRT = [200, 40, 40];

/** Eight identical frames (the layout's walk and slash rows): an outlined head (hair on top, skin below) and a shirt. */
function sheet(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (row: number, x: number, y: number, c: number[]): void => {
    const i = ((row * F + y) * W + x) * 4;
    px.set([c[0]!, c[1]!, c[2]!, 255], i);
  };
  for (let row = 0; row < 8; row++) {
    for (let x = 26; x < 38; x++) {
      put(row, x, 20, OUTLINE);
      for (let y = 21; y < 25; y++) put(row, x, y, HAIR);
      for (let y = 25; y < 36; y++) put(row, x, y, SKIN);
      for (let y = 36; y < 50; y++) put(row, x, y, SHIRT);
    }
  }
  return px;
}

const at = (px: Uint8ClampedArray, row: number, x: number, y: number): number[] => {
  const i = ((row * F + y) * W + x) * 4;
  return [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
};

describe('zombie paint', () => {
  test('skin turns grey-green, hair takes the flashy colour, clothes and outline stay', () => {
    const px = sheet();
    paintZombie(px, W, H, { hair: 0x3fa7ff, hat: 'none' });
    const skin = at(px, 2, 32, 30);
    expect(skin[1]).toBeGreaterThan(skin[0]!);
    expect(skin[1]).toBeGreaterThan(skin[2]!);
    const hair = at(px, 2, 32, 22);
    expect(hair[2]).toBeGreaterThan(hair[0]!);
    expect(at(px, 2, 32, 40)).toEqual([...SHIRT, 255]);
    expect(at(px, 2, 32, 20)).toEqual([...OUTLINE, 255]);
  });

  test('no hat leaves the empty pixels above the head empty, a cone fills some of them on every walk and slash row', () => {
    const bare = sheet();
    paintZombie(bare, W, H, { hair: 0x3fa7ff, hat: 'none' });
    const coned = sheet();
    paintZombie(coned, W, H, { hair: 0x3fa7ff, hat: 'cone' });
    for (let row = 0; row < 8; row++) {
      expect(at(bare, row, 32, 15)[3]).toBe(0);
      expect(at(coned, row, 32, 15)[3]).toBe(255);
    }
  });

  test('the transparent rest of the sheet stays transparent', () => {
    const px = sheet();
    paintZombie(px, W, H, { hair: 0xff5fc8, hat: 'bucket' });
    expect(at(px, 2, 2, 2)[3]).toBe(0);
    expect(at(px, 2, 60, 60)[3]).toBe(0);
  });
});
