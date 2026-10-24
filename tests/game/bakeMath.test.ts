import { describe, expect, test } from 'vitest';
import { fillRects } from '../../src/game/render/bakeMath';

const FILL_RECT = 3;
const FILL_STYLE = 7;
const LINE_STYLE = 6;
const STROKE_PATH = 9;

describe('fillRects', () => {
  test('replays fill styles and rectangles with their colour and alpha, and gives the bounds', () => {
    const r = fillRects([FILL_STYLE, 0xff0000, 1, FILL_RECT, 10, 20, 5, 4, FILL_STYLE, 0x00ff00, 0.5, FILL_RECT, 30, 22, 2, 8]);
    expect(r).not.toBeNull();
    expect(r!.rects).toEqual([
      { color: 0xff0000, alpha: 1, x: 10, y: 20, w: 5, h: 4 },
      { color: 0x00ff00, alpha: 0.5, x: 30, y: 22, w: 2, h: 8 },
    ]);
    expect([r!.minX, r!.minY, r!.maxX, r!.maxY]).toEqual([10, 20, 32, 30]);
  });

  test("a rectangle drawn before any fill style uses Phaser's defaults (white, opaque)", () => {
    expect(fillRects([FILL_RECT, 0, 0, 2, 2])!.rects[0]).toMatchObject({ color: 0xffffff, alpha: 1 });
  });

  test('an empty buffer, or one with only styles, has nothing to bake', () => {
    expect(fillRects([])).toBeNull();
    expect(fillRects([FILL_STYLE, 0xff0000, 1])).toBeNull();
  });

  test('the line style every Graphics starts with is skipped', () => {
    const r = fillRects([LINE_STYLE, 1, 0xffffff, 1, FILL_STYLE, 0xff0000, 1, FILL_RECT, 0, 0, 2, 2]);
    expect(r!.rects).toHaveLength(1);
  });

  test('anything but fill styles and rectangles (strokes, paths, unknown codes) is left alone', () => {
    expect(fillRects([FILL_STYLE, 0xff0000, 1, FILL_RECT, 0, 0, 2, 2, STROKE_PATH])).toBeNull();
    expect(fillRects([99, 1, 2])).toBeNull();
  });

  test('a truncated buffer is refused rather than read past its end', () => {
    expect(fillRects([FILL_RECT, 1, 2])).toBeNull();
  });
});
