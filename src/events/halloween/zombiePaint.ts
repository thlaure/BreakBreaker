import type { ZombieHat } from './zombieMath';

/**
 * Pure pixel painting of a zombie over a rioter's LPC sheet (RGBA bytes, no Phaser, 64-px frames): the skin colours of the
 * face become grey-green, the hair colours become the flashy `hair` colour (both keep their shading), and a road cone or
 * a bucket may sit on the head, frame by frame on the walk and slash rows. Clothes and the dark outline never change.
 */
export interface ZombiePaint {
  hair: number;
  hat: ZombieHat;
}

const FRAME = 64;
/** Walk rows n, w, s, e then slash rows n, w, s, e (layout.json); the hurt row is left as it is. */
const PAINT_ROWS = 8;
/** Darker than this (sum of r, g, b) is the outline. */
const OUTLINE_SUM = 90;
/** The zombies' skin: a pale grey-green. */
const SKIN = 0x9cc58a;

const lum = (c: number): number => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/** `target` shaded like `c` is shaded against `ref` (a darker source colour gives a darker result). */
function shadeLike(target: number, c: number, ref: number): number {
  const k = lum(ref) > 0 ? lum(c) / lum(ref) : 1;
  return (clamp(((target >> 16) & 255) * k) << 16) | (clamp(((target >> 8) & 255) * k) << 8) | clamp((target & 255) * k);
}

/** Colours that cover at least this share of a sampled region count as part of it (skin, hair). */
const MIN_SHARE = 0.2;

/** The (at most three) opaque non-outline colours covering a good share of a pixel region, most used first, as 0xrrggbb. */
function topColours(
  px: Uint8ClampedArray,
  w: number,
  fx: number,
  fy: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  skip: Set<number>,
): number[] {
  const count = new Map<number, number>();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = ((fy + y) * w + fx + x) * 4;
      if (px[i + 3]! < 128 || px[i]! + px[i + 1]! + px[i + 2]! < OUTLINE_SUM) continue;
      const c = (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!;
      if (!skip.has(c)) count.set(c, (count.get(c) ?? 0) + 1);
    }
  const total = [...count.values()].reduce((a, b) => a + b, 0);
  return [...count.entries()]
    .filter(([, n]) => n >= total * MIN_SHARE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);
}

function firstOpaqueRow(px: Uint8ClampedArray, w: number, fx: number, fy: number): number {
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) if (px[((fy + y) * w + fx + x) * 4 + 3]! >= 128) return y;
  return -1;
}

/** Middle of the opaque span of frame row `y`, or 32 when the row is empty. */
function midOfRow(px: Uint8ClampedArray, w: number, fx: number, fy: number, y: number): number {
  let a = -1;
  let b = -1;
  for (let x = 0; x < FRAME; x++)
    if (px[((fy + y) * w + fx + x) * 4 + 3]! >= 128) {
      if (a < 0) a = x;
      b = x;
    }
  return a < 0 ? FRAME / 2 : Math.floor((a + b + 1) / 2);
}

function swap(px: Uint8ClampedArray, map: Map<number, number>): void {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const to = map.get((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
    if (to === undefined) continue;
    px[i] = (to >> 16) & 255;
    px[i + 1] = (to >> 8) & 255;
    px[i + 2] = to & 255;
  }
}

/** Sets a pixel opaque, even on a transparent one (hats sit above the head). */
function put(px: Uint8ClampedArray, w: number, h: number, x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  px[i] = (c >> 16) & 255;
  px[i + 1] = (c >> 8) & 255;
  px[i + 2] = c & 255;
  px[i + 3] = 255;
}

const INK = 0x1a1822;

/** A road cone on the head: orange with a white band, a dark outline and a wide base (head top at `top`, middle at `cx`). */
function cone(px: Uint8ClampedArray, w: number, h: number, fx: number, fy: number, cx: number, top: number): void {
  const rows = [2, 2, 4, 4, 6, 6, 8, 8];
  rows.forEach((n, k) => {
    const y = fy + top - rows.length + k + 2;
    for (let x = -n / 2 - 1; x < n / 2 + 1; x++) {
      const edge = x < -n / 2 || x >= n / 2;
      put(px, w, h, fx + cx + x, y, edge ? INK : k === 3 || k === 4 ? 0xf4f0e8 : 0xf2802a);
    }
  });
  for (let x = -6; x < 6; x++) put(px, w, h, fx + cx + x, fy + top + 2, INK);
}

/** A bucket on the head: grey with a rim, a darker side and a dark outline. */
function bucket(px: Uint8ClampedArray, w: number, h: number, fx: number, fy: number, cx: number, top: number): void {
  for (let y = 0; y < 7; y++) {
    const half = 4 + (y > 1 ? 1 : 0);
    for (let x = -half - 1; x <= half; x++) {
      const edge = x < -half || x === half || y === 0 || y === 6;
      put(px, w, h, fx + cx + x, fy + top - 5 + y, edge ? INK : x > 1 ? 0x5a5e68 : y === 1 ? 0xc8ccd4 : 0x8a909a);
    }
  }
}

/** Paints `p` over the sheet `px` (`w`×`h` RGBA, LPC layout, 64-px frames) in place. */
export function paintZombie(px: Uint8ClampedArray, w: number, h: number, p: ZombiePaint): void {
  const front = 2 * FRAME; // the standing frame facing south: walk row 2, column 0
  const top = firstOpaqueRow(px, w, 0, front);
  if (top >= 0) {
    const cx = midOfRow(px, w, 0, front, top + 6);
    const skin = topColours(px, w, 0, front, cx - 5, cx + 5, top + 11, top + 16, new Set());
    const hair = topColours(px, w, 0, front, cx - 7, cx + 7, top + 1, top + 4, new Set(skin));
    const map = new Map<number, number>();
    for (const c of skin) map.set(c, shadeLike(SKIN, c, skin[0]!));
    for (const c of hair) map.set(c, shadeLike(p.hair, c, hair[0]!));
    swap(px, map);
  }
  if (p.hat === 'none') return;
  const cols = Math.floor(w / FRAME);
  for (let row = 0; row < PAINT_ROWS && (row + 1) * FRAME <= h; row++)
    for (let col = 0; col < cols; col++) {
      const fx = col * FRAME;
      const fy = row * FRAME;
      const t = firstOpaqueRow(px, w, fx, fy);
      if (t < 0) continue;
      const cx = midOfRow(px, w, fx, fy, t + 6);
      (p.hat === 'cone' ? cone : bucket)(px, w, h, fx, fy, cx, t);
    }
}
