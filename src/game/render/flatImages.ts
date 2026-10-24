import Phaser from 'phaser';

/**
 * A flat rectangle as an image: the shared 2×2 white `px` texture stretched and tinted. A Phaser Rectangle shape has its
 * own render pipeline, and every switch between a shape and the images around it breaks the draw batch; an image batches
 * with every other image. Position, origin, depth, alpha, visibility and tint work as on the shape (origin 0.5 by default,
 * like the shape); the fill colour is the tint.
 */
export function rectImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, 'px').setDisplaySize(w, h).setTint(color).setAlpha(alpha);
}

/**
 * One tile of a sprite sheet repeated over a `w` × `h` px area, drawn once on a canvas and shared as an image (origin 0,
 * named `tiles`): a TileSprite is its own render pipeline too and was redrawn on every frame. `scale` is the size of one
 * source pixel (the game draws its 16-px city tiles at 2).
 */
export function tiledImage(
  scene: Phaser.Scene,
  sheet: string,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
): Phaser.GameObjects.Image {
  const key = `tiled_${sheet}_${frame}_${w}x${h}_${scale}`;
  if (!scene.textures.exists(key)) {
    const f = scene.textures.getFrame(sheet, frame);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const src = f?.source.image as CanvasImageSource | undefined;
    if (ctx && f && src) {
      ctx.imageSmoothingEnabled = false;
      const tw = f.cutWidth * scale;
      const th = f.cutHeight * scale;
      for (let ty = 0; ty < h; ty += th)
        for (let tx = 0; tx < w; tx += tw) ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, tx, ty, tw, th);
    }
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return scene.add.image(x, y, key).setOrigin(0).setName('tiles');
}
