import type Phaser from 'phaser';
import { CAID_PAINTS, FRAME, paintCaidSheet } from './caidPaint';
import { caidSheetKey, type CaidSkin } from './caidSkin';

/**
 * Builds the five Caïd sheets `caid_0..caid_4` at boot from the loaded LPC sheets (same 64-px layout, so CharView, the
 * jail van and the prison yard play them like any character sheet): the base sheet copied to a canvas, painted
 * (caidPaint.ts), added as a sprite sheet. Must run before createCharAnims (which picks up the `caid_` keys).
 */
export function makeCaidSheets(scene: Phaser.Scene): void {
  CAID_PAINTS.forEach((paint, i) => {
    const key = caidSheetKey(i as CaidSkin);
    if (scene.textures.exists(key) || !scene.textures.exists(paint.base)) return;
    const src = scene.textures.get(paint.base).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    paintCaidSheet(img.data, canvas.width, canvas.height, paint);
    ctx.putImageData(img, 0, 0);
    // Phaser takes a canvas as a sheet source like an image
    scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, { frameWidth: FRAME, frameHeight: FRAME });
  });
}
