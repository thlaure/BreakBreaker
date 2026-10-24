import { describe, expect, test } from 'vitest';
import { paintPumpkinHeads } from '../../src/events/halloween/pumpkinPaint';

const F = 64;
const W = F;
const H = F * 8;
const OUTLINE = [16, 16, 16];
const HAIR = [85, 51, 17];
const SKIN = [224, 160, 112];
const SHIRT = [200, 40, 40];
const GLOW = [255, 224, 102];

/** Eight identical frames (the layout's walk and slash rows): a 20-px outlined head (hair then skin) over a shirt. */
function sheet(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (row: number, x: number, y: number, c: number[]): void => {
    px.set([c[0]!, c[1]!, c[2]!, 255], ((row * F + y) * W + x) * 4);
  };
  for (let row = 0; row < 8; row++) {
    for (let x = 22; x < 42; x++) {
      put(row, x, 14, OUTLINE);
      for (let y = 15; y < 20; y++) put(row, x, y, HAIR);
      for (let y = 20; y < 32; y++) put(row, x, y, SKIN);
    }
    for (let x = 18; x < 46; x++) for (let y = 32; y < 50; y++) put(row, x, y, SHIRT);
  }
  return px;
}

const at = (px: Uint8ClampedArray, row: number, x: number, y: number): number[] => {
  const i = ((row * F + y) * W + x) * 4;
  return [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
};
const glowCount = (px: Uint8ClampedArray, row: number): number => {
  let n = 0;
  for (let y = 0; y < F; y++)
    for (let x = 0; x < F; x++) if (at(px, row, x, y).slice(0, 3).join() === GLOW.join() && at(px, row, x, y)[3] === 255) n++;
  return n;
};

describe('pumpkin heads', () => {
  test('the head is gone: no skin or hair left, the body below the neck is untouched', () => {
    const px = sheet();
    paintPumpkinHeads(px, W, H, 0);
    for (const row of [0, 2, 3, 4, 6]) {
      for (let y = 14; y < 32; y++)
        for (let x = 18; x < 46; x++) {
          const p = at(px, row, x, y);
          if (p[3] === 0) continue; // erased: its leftover colour is invisible
          expect(p.slice(0, 3).join(), `${row}:${x},${y}`).not.toBe(SKIN.join());
          expect(p.slice(0, 3).join(), `${row}:${x},${y}`).not.toBe(HAIR.join());
        }
      expect(at(px, row, 30, 40)).toEqual([...SHIRT, 255]);
    }
  });

  test('a pumpkin sits where the head was: orange, with an outline, on every walk and slash row', () => {
    const px = sheet();
    paintPumpkinHeads(px, W, H, 0);
    for (let row = 0; row < 8; row++) {
      const c = at(px, row, 32, 24);
      expect(c[3]).toBe(255);
      expect(c[0]).toBeGreaterThan(c[2]! + 80); // orange: red well above blue
    }
  });

  test('a lit face shows from the front, the sides and no face from behind (north rows 0 and 4)', () => {
    const px = sheet();
    paintPumpkinHeads(px, W, H, 0);
    for (const row of [1, 2, 3, 5, 6, 7]) expect(glowCount(px, row), `row ${row}`).toBeGreaterThan(8);
    for (const row of [0, 4]) expect(glowCount(px, row), `row ${row}`).toBe(0);
  });

  test('the three faces differ from one another', () => {
    const a = sheet();
    const b = sheet();
    const c = sheet();
    paintPumpkinHeads(a, W, H, 0);
    paintPumpkinHeads(b, W, H, 1);
    paintPumpkinHeads(c, W, H, 2);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(Buffer.from(b).equals(Buffer.from(c))).toBe(false);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });

  test('the empty rest of the sheet, and the hurt row, stay as they were', () => {
    const px = sheet();
    paintPumpkinHeads(px, W, H, 0);
    expect(at(px, 2, 2, 2)[3]).toBe(0);
    expect(at(px, 2, 60, 60)[3]).toBe(0);
  });
});
