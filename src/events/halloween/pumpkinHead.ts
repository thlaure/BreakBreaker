import Phaser from 'phaser';
import { dirOf } from '../../game/render/charView';
import type { Snapshot } from '../../sim/sim';
import { pumpkinFace } from './rioterLook';
import { pumpkinHeadTexture } from './textures';

type HostileSnap = Snapshot['hostiles'][number];

/** Feet-to-chin height of an LPC body at scale 1 (the head spans about 21 to 31 px above the feet): the pumpkin sits on it and covers the whole head. */
const NECK = 20;

/** A jack-o'-lantern head over a rioter or a Caïd (render only): a sprite following his sprite, from behind when he walks away. */
export class PumpkinHead {
  private readonly image: Phaser.GameObjects.Image;
  private readonly face: 0 | 1 | 2;

  constructor(
    scene: Phaser.Scene,
    lifeId: number,
    private readonly size: number,
  ) {
    this.face = pumpkinFace(lifeId);
    this.image = scene.add.image(0, 0, pumpkinHeadTexture(this.face)).setOrigin(0.5, 1).setScale(size);
  }

  update(h: HostileSnap, sprite: Phaser.GameObjects.Sprite): void {
    const shown = h.state !== 'ko' && sprite.visible;
    this.image.setVisible(shown);
    if (!shown) return;
    const key = pumpkinHeadTexture(dirOf(h.facing) === 'n' ? 'back' : this.face);
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setPosition(Math.round(sprite.x), Math.round(sprite.y - NECK * this.size)).setDepth(sprite.depth + 0.04);
  }

  destroy(): void {
    this.image.destroy();
  }
}
