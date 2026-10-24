import type Phaser from 'phaser';
import { paintPumpkinHeads } from './pumpkinPaint';
import { PUMPKIN_SOURCES, pumpkinFaceOf, pumpkinSheetKey } from './rioterLook';

const FRAME = 64;

/**
 * Builds the pumpkin-headed twin of every rioter and Caïd sheet at boot (`pumpkin_<sheet>`): the loaded or painted sheet
 * copied to a canvas, its heads replaced by pumpkins (pumpkinPaint.ts), added as a sprite sheet with the same 64-px
 * layout. Only runs while the Halloween event is on; must run after makeCaidSheets and before createCharAnims.
 */
export function makePumpkinSheets(scene: Phaser.Scene): void {
  for (const source of PUMPKIN_SOURCES) {
    const key = pumpkinSheetKey(source);
    if (scene.textures.exists(key) || !scene.textures.exists(source)) continue;
    const src = scene.textures.get(source).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    paintPumpkinHeads(img.data, canvas.width, canvas.height, pumpkinFaceOf(source));
    ctx.putImageData(img, 0, 0);
    scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, { frameWidth: FRAME, frameHeight: FRAME });
  }
}
