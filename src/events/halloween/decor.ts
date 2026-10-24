import Phaser from 'phaser';
import type { DecorAnim } from '../../game/render/decor';
import { DEPTH } from '../../game/render/depth';
import { FACADE_H } from '../../game/render/geometry';
import { DISTRICT } from '../../sim/map/district';
import { BAT_COUNT, GHOST_SPOTS, batPos, ghostBob, pumpkinSpots } from './decorMath';

const INK = 0x14121c;
/** Fanion colours of the garlands: orange, violet, pink, green (cheerful, no symbol). */
const FLAGS = [0xf28a1e, 0x9b5cff, 0xff5fc8, 0x6adf4a] as const;
/** Tints of the ghosts: white, pink, sky blue, mint. */
const GHOST_TINTS = [0xffffff, 0xffc2ee, 0xb8e4ff, 0xc4ffd8] as const;

/** Draws `paint` on a fresh Graphics and bakes it into texture `key` (w × h px). */
function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (r: (c: number, x: number, y: number, w: number, h: number, a?: number) => void) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  paint((c, x, y, rw, rh, a = 1) => void g.fillStyle(c, a).fillRect(x, y, rw, rh));
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A grinning jack-o'-lantern: orange lobes with ridges, a green stem, a glowing yellow face (16 × 14). */
function pumpkin(scene: Phaser.Scene): void {
  bake(scene, 'hw_pumpkin', 16, 14, (r) => {
    r(INK, 2, 3, 12, 11);
    r(INK, 0, 5, 16, 7);
    r(0xc2570f, 1, 4, 14, 9);
    r(0xf28a1e, 2, 4, 12, 9);
    r(0xffb347, 3, 5, 3, 2);
    r(0xc2570f, 5, 4, 1, 9);
    r(0xc2570f, 10, 4, 1, 9);
    r(INK, 6, 0, 4, 3);
    r(0x4a8f2a, 7, 1, 2, 2);
    // face: two triangle eyes and a wide zig-zag grin, glowing
    r(0xffe066, 4, 6, 2, 2);
    r(0xffe066, 10, 6, 2, 2);
    r(0xffe066, 4, 10, 8, 1);
    r(0xffe066, 5, 9, 1, 1);
    r(0xffe066, 7, 9, 1, 1);
    r(0xffe066, 9, 9, 1, 1);
    r(INK, 7, 7, 2, 1);
  });
}

/** A friendly ghost (white, tinted per spot): round head, big black eyes, a smile, a wavy hem (14 × 18). */
function ghost(scene: Phaser.Scene): void {
  bake(scene, 'hw_ghost', 14, 18, (r) => {
    r(INK, 3, 0, 8, 1);
    r(INK, 1, 1, 12, 2);
    r(INK, 0, 3, 14, 12);
    r(0xffffff, 2, 1, 10, 2);
    r(0xffffff, 1, 3, 12, 11);
    r(0xdcd8ee, 9, 4, 3, 10);
    r(INK, 3, 5, 2, 3);
    r(INK, 8, 5, 2, 3);
    r(INK, 5, 10, 4, 1);
    r(INK, 4, 9, 1, 1);
    r(INK, 9, 9, 1, 1);
    for (const x of [0, 4, 8]) {
      r(INK, x, 15, 3, 3);
      r(0xffffff, x + 1, 14, 1, 3);
    }
    r(0xffffff, 1, 14, 12, 1);
  });
}

/** A bat, wings up (frame 0) or down (frame 1) (11 × 6). */
function bats(scene: Phaser.Scene): void {
  for (const up of [true, false])
    bake(scene, up ? 'hw_bat0' : 'hw_bat1', 11, 6, (r) => {
      r(0x3a2a52, 4, 2, 3, 3);
      r(0x3a2a52, 4, 1, 1, 1);
      r(0x3a2a52, 6, 1, 1, 1);
      r(0xff5fc8, 4, 3, 1, 1);
      r(0xff5fc8, 6, 3, 1, 1);
      for (const s of [0, 1]) {
        const x = s ? 7 : 0;
        const y = up ? 0 : 2;
        r(0x3a2a52, x, y, 4, 2);
        r(0x3a2a52, x + (s ? 0 : 1), y + 2, 3, 2);
        r(0x5a3e7a, x + 1, y, 2, 1);
      }
    });
}

/** A garland of pennants along the top of a building's front wall (drawn once, over the wall). */
function garlands(scene: Phaser.Scene): void {
  DISTRICT.buildings.forEach((b, i) => {
    const front = b.y + b.h;
    const y0 = front - FACADE_H + 2;
    const g = scene.add.graphics().setDepth(front + 0.05);
    const n = Math.floor(b.w / 8);
    g.fillStyle(INK, 1).fillRect(b.x, y0, b.w, 1);
    for (let k = 0; k < n; k++) {
      const x = b.x + k * 8 + 1;
      const sag = Math.round(2 * Math.sin((k / Math.max(1, n - 1)) * Math.PI));
      g.fillStyle(FLAGS[(k + i) % FLAGS.length]!, 1);
      g.fillRect(x, y0 + 1 + sag, 6, 2);
      g.fillRect(x + 1, y0 + 3 + sag, 4, 2);
      g.fillRect(x + 2, y0 + 5 + sag, 2, 1);
    }
  });
}

/**
 * The Halloween decoration laid over the map (render only: nothing here is solid or touches the simulation): pennant
 * garlands on every front wall, two grinning pumpkins in front of each building, four friendly ghosts floating on the
 * square and six bats circling. Under reduced motion the ghosts stay still and the bats hang.
 */
export function buildHalloweenDecor(scene: Phaser.Scene, reducedMotion: boolean): DecorAnim[] {
  pumpkin(scene);
  ghost(scene);
  bats(scene);
  garlands(scene);
  for (const s of pumpkinSpots(DISTRICT.buildings)) scene.add.image(s.x, s.y, 'hw_pumpkin').setOrigin(0.5, 1).setDepth(s.y);
  const ghosts = GHOST_SPOTS.map((s, k) =>
    scene.add
      .image(s.x, s.y, 'hw_ghost')
      .setOrigin(0.5, 1)
      .setTint(GHOST_TINTS[k % GHOST_TINTS.length]!)
      .setAlpha(0.9)
      .setDepth(DEPTH.foliage + 0.2),
  );
  const flyers = Array.from({ length: BAT_COUNT }, () => scene.add.image(0, 0, 'hw_bat0').setDepth(DEPTH.foliage + 0.3));
  const place = (timeMs: number): void => {
    ghosts.forEach((gh, k) => gh.setY(GHOST_SPOTS[k]!.y + ghostBob(timeMs, k, reducedMotion)));
    flyers.forEach((b, k) => {
      const p = batPos(timeMs, k, reducedMotion);
      const wing = reducedMotion || Math.floor(timeMs / 140 + k) % 2 === 0 ? 'hw_bat0' : 'hw_bat1';
      b.setPosition(p.x, p.y);
      if (b.texture.key !== wing) b.setTexture(wing);
    });
  };
  place(0);
  return [{ update: place }];
}
