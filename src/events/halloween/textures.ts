import type Phaser from 'phaser';

export const ORB_TEXTURE = 'hw_orb';
export const SKULL_FLAG_TEXTURE = 'hw_skull_flag';
/** `hw_head_0..2` (smile, grimace, surprised) and `hw_head_back` (seen from behind). */
export const pumpkinHeadTexture = (face: 0 | 1 | 2 | 'back'): string => `hw_head_${face}`;

const INK = 0x14121c;
type R = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;

/** Draws on a throwaway Graphics and bakes the result into texture `key`. */
function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (r: R) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  paint((c, x, y, rw, rh, a = 1) => void g.fillStyle(c, a).fillRect(x, y, rw, rh));
  g.generateTexture(key, w, h);
  g.destroy();
}

/** The spell orb the zombie casters throw instead of a rock: a glowing green ball with a bright core and two sparks (12 × 12). */
function orb(r: R): void {
  r(0x7dff5a, 1, 1, 10, 10, 0.25);
  r(INK, 3, 2, 6, 8);
  r(INK, 2, 3, 8, 6);
  r(0x3fbf3a, 3, 3, 6, 6);
  r(0x7dff5a, 3, 3, 5, 5);
  r(0xe8ffb0, 4, 4, 3, 3);
  r(0xffffff, 5, 5, 1, 1);
  r(0xb45cff, 0, 5, 2, 1);
  r(0xb45cff, 10, 6, 2, 1);
  r(0xb45cff, 5, 0, 1, 2);
}

/** A plain black flag with a white skull, like a pirate flag (16 × 12, the size of the `flags` frames). */
function skullFlag(r: R): void {
  r(0x2a2630, 0, 0, 16, 12);
  r(INK, 0, 0, 16, 1);
  r(INK, 0, 11, 16, 1);
  r(0xf4f0e8, 4, 2, 8, 6);
  r(0xf4f0e8, 5, 8, 6, 2);
  r(INK, 5, 4, 2, 2);
  r(INK, 9, 4, 2, 2);
  r(INK, 7, 6, 2, 1);
  r(INK, 6, 9, 1, 1);
  r(INK, 8, 9, 1, 1);
}

const GLOW = 0xffe066;

/** A jack-o'-lantern head (14 × 13): orange lobes with ridges, a green stem and a lit face (none from behind). */
function pumpkinHead(face: 0 | 1 | 2 | 'back'): (r: R) => void {
  return (r) => {
    r(INK, 2, 2, 10, 11);
    r(INK, 0, 4, 14, 7);
    r(0xc2570f, 1, 3, 12, 9);
    r(0xf28a1e, 2, 3, 10, 9);
    r(0xffb347, 3, 4, 3, 2);
    r(0xc2570f, 4, 3, 1, 9);
    r(0xc2570f, 9, 3, 1, 9);
    r(INK, 5, 0, 4, 3);
    r(0x4a8f2a, 6, 1, 2, 2);
    if (face === 'back') return;
    if (face === 0) {
      r(GLOW, 3, 5, 2, 2);
      r(GLOW, 9, 5, 2, 2);
      r(GLOW, 3, 9, 8, 1);
      r(GLOW, 4, 8, 1, 1);
      r(GLOW, 6, 8, 1, 1);
      r(GLOW, 8, 8, 1, 1);
    } else if (face === 1) {
      r(GLOW, 3, 6, 3, 1);
      r(GLOW, 4, 5, 2, 1);
      r(GLOW, 8, 6, 3, 1);
      r(GLOW, 8, 5, 2, 1);
      r(GLOW, 3, 9, 8, 1);
      r(GLOW, 4, 10, 1, 1);
      r(GLOW, 6, 10, 1, 1);
      r(GLOW, 8, 10, 1, 1);
    } else {
      r(GLOW, 3, 5, 3, 3);
      r(GLOW, 8, 5, 3, 3);
      r(INK, 4, 6, 1, 1);
      r(INK, 9, 6, 1, 1);
      r(GLOW, 5, 9, 4, 3);
    }
  };
}

/** Bakes every texture of the Halloween event once (before the world starts). */
export function bakeEventTextures(scene: Phaser.Scene): void {
  bake(scene, ORB_TEXTURE, 12, 12, orb);
  bake(scene, SKULL_FLAG_TEXTURE, 16, 12, skullFlag);
  for (const face of [0, 1, 2, 'back'] as const) bake(scene, pumpkinHeadTexture(face), 14, 13, pumpkinHead(face));
}
