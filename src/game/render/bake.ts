import Phaser from 'phaser';
import { fillRects } from './bakeMath';

/** A drawing larger than this (px²) is not baked: it would cost more texture memory than it saves. */
const MAX_AREA = 768 * 1024;
let counter = 0;

/**
 * Freezes a static Graphics into one image: Phaser replays a Graphics' whole command list every frame (thousands of
 * rectangles for a building front), while an image is a single quad. Only drawings made of fill styles and rectangles are
 * baked, by replaying them on a canvas (exact, crisp pixels); depth, alpha, blend mode, visibility and container are kept,
 * the Graphics is destroyed. Returns the image, or null (the Graphics is left untouched) when it cannot or should not be baked.
 * Call it only once the drawing is finished: nothing drawn afterwards would show.
 */
export function bakeGraphics(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): Phaser.GameObjects.Image | null {
  const d = fillRects(g.commandBuffer);
  if (!d) return null;
  const x0 = Math.floor(d.minX);
  const y0 = Math.floor(d.minY);
  const w = Math.ceil(d.maxX) - x0;
  const h = Math.ceil(d.maxY) - y0;
  if (w <= 0 || h <= 0 || w * h > MAX_AREA) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (const r of d.rects) {
    ctx.fillStyle = `rgba(${(r.color >> 16) & 255},${(r.color >> 8) & 255},${r.color & 255},${r.alpha})`;
    ctx.fillRect(r.x - x0, r.y - y0, r.w, r.h);
  }
  const key = `baked_${counter++}`;
  scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const image = scene.add
    .image(g.x + x0, g.y + y0, key)
    .setOrigin(0)
    .setDepth(g.depth)
    .setAlpha(g.alpha)
    .setBlendMode(g.blendMode)
    .setVisible(g.visible);
  const parent = g.parentContainer;
  if (parent) {
    parent.addAt(image, parent.getIndex(g));
    parent.remove(g);
  }
  g.destroy();
  return image;
}
