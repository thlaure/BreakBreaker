/**
 * Pure pixel painting of a jack-o'-lantern head over an LPC character sheet (RGBA bytes, no Phaser, 64-px frames): on every
 * walk and slash frame the head is erased and a pumpkin of the same size is drawn in its place, following the body's bob,
 * so the character really has a pumpkin for a head (not a mask on top of one). The body below the neck is never touched.
 */
const FRAME = 64;
/** Walk rows n, w, s, e then slash rows n, w, s, e (layout.json); the hurt row is left as it is. */
const PAINT_ROWS = 8;
/** The pumpkin: as wide and as tall as the LPC head it replaces. */
const PW = 22;
const PH = 18;
const HALF = PW / 2;
/** Columns on each side of the head's middle that the erased area covers: a little wider than the pumpkin, so no hair or hood strand is left. */
const ERASE_HALF = 14;
/** Rows (0 = n, 4 = n slash) seen from behind: no face. */
const BACK_ROWS = new Set([0, 4]);

const INK = 0x14121c;
const ORANGE = 0xf28a1e;
const ORANGE_HI = 0xffb347;
const ORANGE_LO = 0xc2570f;
const STEM = 0x4a8f2a;
const GLOW = 0xffe066;

type Cells = Map<number, number>;
const cell = (x: number, y: number): number => y * PW + x;

/** The pumpkin without a face: outline, lobes with ridges, a stem on top. */
function body(): Cells {
  const cells: Cells = new Map();
  const cx = (PW - 1) / 2;
  const cy = 10.2;
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const dx = (x - cx) / 10.8;
      const dy = (y - cy) / 7.9;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c = d > 0.8 ? INK : ORANGE;
      if (c !== INK) {
        if (x > cx + 4) c = ORANGE_LO;
        else if (dx < -0.35 && dy < -0.1) c = ORANGE_HI;
        if (x === 7 || x === 14 || x === 11 || x === 10) c = ORANGE_LO; // the ridges
      }
      cells.set(cell(x, y), c);
    }
  for (const [x, y] of [
    [10, 0],
    [11, 0],
    [10, 1],
    [11, 1],
    [11, 2],
  ] as const)
    cells.set(cell(x, y), y === 2 ? INK : STEM);
  cells.set(cell(9, 1), INK);
  cells.set(cell(12, 1), INK);
  return cells;
}

/** The lit face: 0 smile, 1 grimace, 2 surprised. */
function face(cells: Cells, kind: number): void {
  const lit = (x: number, y: number, w = 1, h = 1): void => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.set(cell(x + i, y + j), GLOW);
  };
  if (kind === 0) {
    lit(5, 7, 3, 1);
    lit(5, 8, 4, 2);
    lit(14, 7, 3, 1);
    lit(13, 8, 4, 2);
    lit(4, 12, 14, 1);
    lit(4, 11, 2, 1);
    lit(16, 11, 2, 1);
    lit(5, 13, 12, 1);
    for (const x of [8, 11, 14]) cells.set(cell(x, 13), INK);
  } else if (kind === 1) {
    lit(4, 8, 5, 2);
    lit(6, 7, 3, 1);
    lit(13, 8, 5, 2);
    lit(13, 7, 3, 1);
    lit(5, 12, 12, 1);
    lit(5, 13, 12, 1);
    lit(6, 14, 2, 1);
    lit(10, 14, 2, 1);
    lit(14, 14, 2, 1);
    for (const x of [8, 12]) cells.set(cell(x, 13), INK);
  } else {
    lit(5, 7, 4, 4);
    lit(13, 7, 4, 4);
    cells.set(cell(7, 9), INK);
    cells.set(cell(14, 9), INK);
    lit(8, 12, 6, 4);
    cells.set(cell(10, 13), INK);
    cells.set(cell(11, 13), INK);
  }
}

/** First opaque row of the frame at (fx, fy) among the columns `x0..x1`, -1 if none. */
function headTop(px: Uint8ClampedArray, w: number, fx: number, fy: number, x0: number, x1: number): number {
  for (let y = 0; y < FRAME; y++) for (let x = x0; x <= x1; x++) if (px[((fy + y) * w + fx + x) * 4 + 3]! >= 128) return y;
  return -1;
}

/** Middle column of the opaque span of frame row `y`, 32 when the row is empty. */
function middle(px: Uint8ClampedArray, w: number, fx: number, fy: number, y: number): number {
  let a = -1;
  let b = -1;
  for (let x = 0; x < FRAME; x++)
    if (px[((fy + y) * w + fx + x) * 4 + 3]! >= 128) {
      if (a < 0) a = x;
      b = x;
    }
  return a < 0 ? FRAME / 2 : Math.floor((a + b + 1) / 2);
}

/** Replaces the head of every walk and slash frame of the sheet `px` (`w`×`h` RGBA, LPC layout) with a pumpkin, in place; `faceKind` 0..2. */
export function paintPumpkinHeads(px: Uint8ClampedArray, w: number, h: number, faceKind: number): void {
  const withFace = body();
  face(withFace, faceKind);
  const back = body();
  const cols = Math.floor(w / FRAME);
  for (let row = 0; row < PAINT_ROWS && (row + 1) * FRAME <= h; row++) {
    const cells = BACK_ROWS.has(row) ? back : withFace;
    for (let col = 0; col < cols; col++) {
      const fx = col * FRAME;
      const fy = row * FRAME;
      const probe = headTop(px, w, fx, fy, 0, FRAME - 1);
      if (probe < 0) continue;
      const cx = middle(px, w, fx, fy, probe + 6);
      const top = headTop(px, w, fx, fy, cx - ERASE_HALF, cx + ERASE_HALF - 1);
      if (top < 0) continue;
      for (let y = top; y < top + PH && y < FRAME; y++)
        for (let x = Math.max(0, cx - ERASE_HALF); x < Math.min(FRAME, cx + ERASE_HALF); x++) px[((fy + y) * w + fx + x) * 4 + 3] = 0;
      for (const [k, color] of cells) {
        const x = cx - HALF + (k % PW);
        const y = top + Math.floor(k / PW);
        if (x < 0 || x >= FRAME || y >= FRAME) continue;
        const i = ((fy + y) * w + fx + x) * 4;
        px[i] = (color >> 16) & 255;
        px[i + 1] = (color >> 8) & 255;
        px[i + 2] = color & 255;
        px[i + 3] = 255;
      }
    }
  }
}
