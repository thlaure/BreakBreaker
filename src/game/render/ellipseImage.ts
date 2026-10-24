import Phaser from 'phaser';

/**
 * A flat ellipse (a shadow, a glow) as an image. A Phaser Ellipse shape is tessellated and re-submitted vertex by vertex
 * on every frame; an image is one quad. The ellipse is baked once per size, colour and alpha into a canvas texture (a
 * hard edge, crisp pixels, exactly like the shape) and shared by every image of the same look. Position, depth, scale,
 * visibility and blend mode work as on the shape; its colour and alpha are fixed by the arguments.
 */
export function ellipseImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha: number,
): Phaser.GameObjects.Image {
  const rw = Math.max(1, Math.round(w));
  const rh = Math.max(1, Math.round(h));
  const key = `ellipse_${rw}x${rh}_${color.toString(16)}_${alpha}`;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = rw;
    canvas.height = rh;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = `rgb(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255})`;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(rw / 2, rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return scene.add.image(x, y, key);
}
