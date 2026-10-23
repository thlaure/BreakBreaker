/**
 * Pure pixel painting of a Caïd look over an LPC character sheet (RGBA bytes, no Phaser): an exact colour swap of the
 * clothes (recolor) and small garments painted frame by frame on the walk and slash rows, following the body's bob (the
 * head top's offset from the standing frame of the same facing). Only opaque, non-outline pixels are painted, so the
 * silhouette and its dark outline never change: clothes and props, never the body.
 */
export interface CaidPaint {
  /** The LPC sheet the look starts from. */
  base: string;
  /** Exact colour swaps (0xrrggbb → 0xrrggbb) over the whole sheet. */
  recolor?: Readonly<Record<number, number>>;
  /** A scarf around the neck (and its end on the chest, seen from the front). */
  scarf?: number;
  /** A white shirt collar and a tie (seen from the front). */
  tie?: number;
  /** An armband on one sleeve. */
  armband?: number;
  /** A whistle on a cord (seen from the front). */
  whistle?: boolean;
  /** A patch on a worn coat (seen from the front). */
  patch?: number;
}

export const FRAME = 64;
/** Walk rows n, w, s, e then slash rows n, w, s, e (layout.json); the hurt row is left alone. */
const PAINT_ROWS = 8;
const DIRS = ['n', 'w', 's', 'e'] as const;
type Dir = (typeof DIRS)[number];
/** Neck row (scarf, collar) of a standing LPC body, px from the frame top. */
export const NECK_Y = 34;
/** Darker than this (sum of r, g, b) is the outline: never painted. */
const OUTLINE_SUM = 90;

const shade = (c: number, k: number): number =>
  (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

class Sheet {
  constructor(
    readonly px: Uint8ClampedArray,
    readonly w: number,
    readonly h: number,
  ) {}
  private at(x: number, y: number): number {
    return (y * this.w + x) * 4;
  }
  opaque(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[this.at(x, y) + 3]! >= 128;
  }
  /** Paints (x, y) if it is an opaque, non-outline pixel (`any`: outline too). */
  paint(x: number, y: number, c: number, any = false): void {
    if (!this.opaque(x, y)) return;
    const i = this.at(x, y);
    if (!any && this.px[i]! + this.px[i + 1]! + this.px[i + 2]! < OUTLINE_SUM) return;
    this.px[i] = (c >> 16) & 255;
    this.px[i + 1] = (c >> 8) & 255;
    this.px[i + 2] = c & 255;
  }
  /** First opaque row of the frame at (fx, fy), -1 if empty. */
  top(fx: number, fy: number): number {
    for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) if (this.opaque(fx + x, fy + y)) return y;
    return -1;
  }
  /** Middle of the opaque span of frame row `y` (frame px), FRAME / 2 if empty. */
  mid(fx: number, fy: number, y: number): number {
    let a = -1;
    let b = -1;
    for (let x = 0; x < FRAME; x++) {
      if (!this.opaque(fx + x, fy + y)) continue;
      if (a < 0) a = x;
      b = x;
    }
    return a < 0 ? FRAME / 2 : Math.floor((a + b + 1) / 2);
  }
  /** Leftmost / rightmost opaque x of frame row `y`. */
  edge(fx: number, fy: number, y: number, right: boolean): number {
    for (let i = 0; i < FRAME; i++) {
      const x = right ? FRAME - 1 - i : i;
      if (this.opaque(fx + x, fy + y)) return x;
    }
    return -1;
  }
}

/** Swaps the exact colours of `map` over every opaque pixel. */
export function recolor(px: Uint8ClampedArray, map: Readonly<Record<number, number>>): void {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const to = map[(px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!];
    if (to === undefined) continue;
    px[i] = (to >> 16) & 255;
    px[i + 1] = (to >> 8) & 255;
    px[i + 2] = to & 255;
  }
}

/** Paints look `p` over the sheet `px` (`w`×`h` RGBA, LPC layout, 64-px frames) in place. */
export function paintCaidSheet(px: Uint8ClampedArray, w: number, h: number, p: CaidPaint): void {
  if (p.recolor) recolor(px, p.recolor);
  const s = new Sheet(px, w, h);
  const cols = Math.floor(w / FRAME);
  const idleTop = DIRS.map((_, r) => s.top(0, r * FRAME));
  for (let row = 0; row < PAINT_ROWS && (row + 1) * FRAME <= h; row++) {
    const dir = DIRS[row % 4]!;
    for (let col = 0; col < cols; col++) {
      const fx = col * FRAME;
      const fy = row * FRAME;
      const top = s.top(fx, fy);
      if (top < 0 || idleTop[row % 4]! < 0) continue;
      const bob = top - idleTop[row % 4]!;
      paintFrame(s, fx, fy, NECK_Y + bob, dir, p);
    }
  }
}

function paintFrame(s: Sheet, fx: number, fy: number, neck: number, dir: Dir, p: CaidPaint): void {
  const cx = s.mid(fx, fy, neck - 10);
  const front = dir === 's';
  const put = (x: number, y: number, c: number, any = false): void => s.paint(fx + x, fy + y, c, any);
  if (p.patch !== undefined && front) {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(cx + 4 + x, neck + 8 + y, (x + y) % 2 ? p.patch : shade(p.patch, 0.8));
  }
  if (p.tie !== undefined && front) {
    // white collar opening, then the tie: a knot, a 2-px blade, a 1-px tip
    for (let y = 0; y < 4; y++) for (let x = -3 + Math.floor(y / 2); x <= 2 - Math.floor(y / 2); x++) put(cx + x, neck + 1 + y, 0xeeeeee);
    for (const x of [-1, 0]) put(cx + x, neck + 2, shade(p.tie, 0.8));
    for (let y = 3; y <= 10; y++) for (const x of [-1, 0]) put(cx + x, neck + y, x === 0 ? shade(p.tie, 0.8) : p.tie);
    put(cx - 1, neck + 11, shade(p.tie, 0.7));
  }
  if (p.scarf !== undefined) {
    // under the chin, over the collar
    for (let y = 1; y <= 3; y++) for (let x = -5; x <= 5; x++) put(cx + x, neck + y, y === 3 ? shade(p.scarf, 0.75) : p.scarf);
    if (front) for (let y = 4; y <= 8; y++) for (const x of [2, 3]) put(cx + x, neck + y, x === 3 ? shade(p.scarf, 0.75) : p.scarf);
    if (dir === 'e' || dir === 'w') for (let y = 3; y <= 6; y++) put(cx + (dir === 'e' ? -5 : 5), neck + y, p.scarf);
  }
  if (p.armband !== undefined) {
    const y0 = neck + 4;
    if (dir === 's' || dir === 'n') {
      const right = dir === 'n';
      const e = s.edge(fx, fy, y0, right);
      for (let y = 0; y < 2; y++) for (let i = 1; i <= 4; i++) put(right ? e - i : e + i, y0 + y, y ? shade(p.armband, 0.8) : p.armband);
    } else {
      for (let y = 0; y < 2; y++) for (let x = -2; x <= 2; x++) put(cx + x, y0 + y, y ? shade(p.armband, 0.8) : p.armband);
    }
  }
  if (p.whistle && front) {
    for (let i = 0; i < 3; i++) {
      put(cx - 3 + i, neck + 1 + i, 0xcfd3d8);
      put(cx + 2 - i, neck + 1 + i, 0xcfd3d8);
    }
    for (let x = -1; x <= 1; x++) {
      put(cx + x, neck + 4, 0xf1f4f6, true);
      put(cx + x, neck + 5, 0x8a93a0, true);
    }
  }
}

/** Generic red of the looks' scarf, tie and armband (no flag, no emblem). */
const RED = 0xd23b3b;

/**
 * The five looks' paint, by CaidSkin (content/caids.ts names them). Skin tones and builds come from the game's LPC
 * sheets as they are: one medium (tribun), two lighter (cheffe, briscard), two darker (camarade, jeune agitateur);
 * one woman (cheffe), and builds as the sheets have them.
 */
export const CAID_PAINTS: readonly CaidPaint[] = [
  // le tribun: a dark jacket over the orange shirt, a red scarf
  {
    base: 'protester_1',
    recolor: { 0xffa749: 0x5a5650, 0xef7e19: 0x46433e, 0xd75b1a: 0x38352f, 0x9c3f23: 0x2b2925, 0x5f1d1b: 0x1f1d1a },
    scarf: RED,
  },
  // la cheffe de cortège: the dark hood, a red armband
  { base: 'rioter_antifa_b', armband: RED },
  // le camarade en costume: a navy suit over the light shirt and the khaki trousers, a red tie
  {
    base: 'protester_3',
    recolor: {
      0xc6eefd: 0x3a4058,
      0xffffff: 0x4c5370,
      0x9fbbcb: 0x30354a,
      0x586b90: 0x22263a,
      0xcfc587: 0x4c5370,
      0xb7996a: 0x3a4058,
      0xb78c41: 0x30354a,
      0x986a20: 0x22263a,
      0x684415: 0x1a1d2c,
    },
    tie: 0xc4302b,
  },
  // le vieux briscard: his grey hair, a faded olive coat with a patch, a whistle
  {
    base: 'elder_1',
    recolor: { 0xcfc587: 0xa7a98c, 0xb7996a: 0x8f9277, 0xb78c41: 0x7b7f66, 0x986a20: 0x666a55, 0x684415: 0x4f5243 },
    whistle: true,
    patch: 0x9b7a4c,
  },
  // le jeune agitateur: a teal hoodie (no longer the runners' light grey)
  { base: 'rioter_runner_b', recolor: { 0xe5e6c7: 0x4c9f95, 0xb3afa1: 0x3b8077, 0x818b8b: 0x2c625b } },
];
