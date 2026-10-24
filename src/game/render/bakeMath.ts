/** Pure parsing of a Phaser Graphics command buffer, to bake a static drawing into a texture (no Phaser import here). */

/**
 * Phaser's command codes for the commands the static painters use (`GameObjects.Graphics.Commands`). Every Graphics starts
 * with one LINE_STYLE: it only matters to stroke commands, which are refused, so it is skipped.
 */
const FILL_RECT = 3;
const LINE_STYLE = 6;
const FILL_STYLE = 7;

export interface BakedRect {
  color: number;
  alpha: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BakedDrawing {
  rects: BakedRect[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The filled rectangles of a Graphics command buffer in drawing order, with their colour and alpha, and the bounds of all
 * of them. Null when there is nothing to draw, or when the buffer holds anything but fill styles and rectangles (strokes,
 * paths, transforms: such a drawing is not baked), or is cut short.
 */
export function fillRects(buffer: readonly number[]): BakedDrawing | null {
  const rects: BakedRect[] = [];
  let color = 0xffffff;
  let alpha = 1;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < buffer.length;) {
    const code = buffer[i]!;
    if (code === FILL_STYLE) {
      if (i + 2 >= buffer.length) return null;
      color = buffer[i + 1]!;
      alpha = buffer[i + 2]!;
      i += 3;
    } else if (code === LINE_STYLE) {
      if (i + 3 >= buffer.length) return null;
      i += 4;
    } else if (code === FILL_RECT) {
      if (i + 4 >= buffer.length) return null;
      const x = buffer[i + 1]!;
      const y = buffer[i + 2]!;
      const w = buffer[i + 3]!;
      const h = buffer[i + 4]!;
      rects.push({ color, alpha, x, y, w, h });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
      i += 5;
    } else return null;
  }
  return rects.length === 0 ? null : { rects, minX, minY, maxX, maxY };
}
