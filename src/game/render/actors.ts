import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { CharView, FEET_ORIGIN_Y, dirOf, idleFrame, koFrame } from './charView';

// Moved out of this file; re-exported so importers keep working.
export { CharView, FEET_ORIGIN_Y, createCharAnims, dirOf, idleFrame, koFrame, slashKey, walkKey, windupFrame } from './charView';
export { MAX_FALLS, makeFallTextures, type LaunchCtx } from './fallKit';
export { HostileLayer } from './hostiles';
export { makeRoleTextures } from './rioterProps';

const OUTLINE_OFFSETS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Warm multiply tint of Paul and gold outline while the mode furie is on. */
const FURIE_TINT = 0xffe2a0;
const FURIE_OUTLINE = 0xffe066;
const OUTLINE = 0xf4f1e8;

/**
 * Paul: CharView + a cheap 1-px light outline (four white-filled copies offset under the sprite); in mode furie the
 * sprite is tinted warm and the outline turns gold.
 */
export class PaulView {
  readonly view: CharView;
  private readonly outline: Phaser.GameObjects.Sprite[];
  private warm = false;

  constructor(scene: Phaser.Scene, pos: Vec) {
    this.view = new CharView(scene, 'paul', pos);
    this.outline = OUTLINE_OFFSETS.map(() =>
      scene.add
        .sprite(pos.x, pos.y, 'paul', 0)
        .setOrigin(0.5, FEET_ORIGIN_Y)
        .setTint(OUTLINE)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0.85),
    );
  }

  get sprite(): Phaser.GameObjects.Sprite {
    return this.view.sprite;
  }

  /** `dtMs` = time since the previous visual update (for the walk/run speed estimate); `furie` = mode furie on. */
  update(p: Snapshot['player'], strike: boolean, nowMs: number, dtMs: number, furie = false): void {
    const v = this.view;
    const warm = furie && !p.ko;
    if (warm !== this.warm) {
      this.warm = warm;
      if (warm) v.sprite.setTint(FURIE_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
      else v.sprite.clearTint();
      for (const o of this.outline) o.setTint(warm ? FURIE_OUTLINE : OUTLINE);
    }
    const speed = (v.place(p.pos) / Math.max(1, dtMs)) * 1000; // px/s
    const dir = dirOf(p.facing);
    if (p.ko) v.still(koFrame('paul'));
    else if (strike) v.slash(dir);
    else if (speed > 20) v.walk(dir, speed > 215 ? 1.4 : 1);
    else v.still(idleFrame('paul', dir));
    v.tickFlash(nowMs);
    // i-frames blink
    const blinkOff = p.invulnerable && !p.ko && Math.floor(nowMs / 80) % 2 === 0;
    v.sprite.setAlpha(blinkOff ? 0.45 : 1);
    const s = v.sprite;
    OUTLINE_OFFSETS.forEach(([dx, dy], i) => {
      const o = this.outline[i]!;
      // hidden on blink-off frames: a white silhouette under a translucent sprite reads as a ghost
      o.setPosition(s.x + dx, s.y + dy)
        .setDepth(s.depth - 0.01)
        .setFrame(s.frame.name)
        .setVisible(!blinkOff && !p.ko);
    });
  }
}
