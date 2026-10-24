import type Phaser from 'phaser';
import { paintZombie } from './zombiePaint';
import { ZOMBIE_LOOKS, zombieSheetKey } from './zombieMath';

const FRAME = 64;

/**
 * Builds the eight zombie sheets `zombie_<base>` at boot from the loaded rioter sheets (same 64-px layout, so CharView
 * plays them like any character sheet): the base sheet copied to a canvas, painted (zombiePaint.ts), added as a sprite
 * sheet. Only runs while the Halloween event is on; must run before createCharAnims (which picks up the `zombie_` keys).
 */
export function makeZombieSheets(scene: Phaser.Scene): void {
  for (const look of ZOMBIE_LOOKS) {
    const key = zombieSheetKey(look.base);
    if (scene.textures.exists(key) || !scene.textures.exists(look.base)) continue;
    const src = scene.textures.get(look.base).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    paintZombie(img.data, canvas.width, canvas.height, look);
    ctx.putImageData(img, 0, 0);
    scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, { frameWidth: FRAME, frameHeight: FRAME });
  }
}
