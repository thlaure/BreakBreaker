import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
// @ts-expect-error plain .mjs script without types
import { encodeIndexed } from '../scripts/optimize-png.mjs';

function image(w: number, h: number, colors: number): PNG {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    const c = i % colors;
    png.data.set([c % 256, Math.floor(c / 256), (c * 7) % 256, c % 2 ? 255 : 0], i * 4);
  }
  return png;
}

describe('optimize-png', () => {
  it('keeps every pixel, alpha included, when it writes an indexed PNG', () => {
    const src = image(24, 17, 40);
    const out = PNG.sync.read(encodeIndexed(src) as Buffer);
    expect(out.width).toBe(24);
    expect(out.height).toBe(17);
    expect(out.data.equals(src.data)).toBe(true);
  });

  it('gives up above 256 colors', () => {
    expect(encodeIndexed(image(32, 32, 300))).toBeNull();
  });

  it('ships every game PNG as an indexed PNG', () => {
    const files = globSync('public/assets/**/*.png');
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) expect(readFileSync(f)[25], f).toBe(3); // IHDR color type 3 = indexed
  });
});
