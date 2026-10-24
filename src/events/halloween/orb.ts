import type Phaser from 'phaser';

export const ORB_TEXTURE = 'hw_orb';

/** The spell orb the zombie casters throw instead of a rock: a glowing green ball with a bright core and two sparks (12 × 12). */
export function bakeOrb(scene: Phaser.Scene): void {
  if (scene.textures.exists(ORB_TEXTURE)) return;
  const g = scene.make.graphics({}, false);
  const r = (c: number, x: number, y: number, w: number, h: number, a = 1): void => void g.fillStyle(c, a).fillRect(x, y, w, h);
  r(0x7dff5a, 1, 1, 10, 10, 0.25);
  r(0x14121c, 3, 2, 6, 8);
  r(0x14121c, 2, 3, 8, 6);
  r(0x3fbf3a, 3, 3, 6, 6);
  r(0x7dff5a, 3, 3, 5, 5);
  r(0xe8ffb0, 4, 4, 3, 3);
  r(0xffffff, 5, 5, 1, 1);
  r(0xb45cff, 0, 5, 2, 1);
  r(0xb45cff, 10, 6, 2, 1);
  r(0xb45cff, 5, 0, 1, 2);
  g.generateTexture(ORB_TEXTURE, 12, 12);
  g.destroy();
}
