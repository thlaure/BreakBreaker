import Phaser from 'phaser';
import { DEPTH } from './depth';

/** At most this many bodies « satellisés » fly at once; beyond, a body vanishes at once with its twinkle. */
export const MAX_SATELLITES = 16;
const POOL = 8;
const TWINKLE_MS = 520;
/** Every other twinkle shows a tiny « PING ! » bubble. */
const PING_EVERY = 2;

/** 7×7 pixel star « ✦ » (`twinkle`), drawn at runtime. */
export function makeTwinkleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('twinkle')) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xfff7e0, 1).fillRect(3, 0, 1, 7).fillRect(0, 3, 7, 1);
  g.fillStyle(0xffffff, 1).fillRect(2, 2, 3, 3);
  g.fillStyle(0x8fd3ff, 1).fillRect(3, 3, 1, 1);
  g.generateTexture('twinkle', 7, 7);
  g.destroy();
}

interface Twinkle {
  star: Phaser.GameObjects.Image;
  ping: Phaser.GameObjects.Text;
  born: number;
  /** Zoom compensation at spawn time. */
  k: number;
}

/**
 * Where a satellite vanishes: a pixel star twinkle (scale pop then shrink, quarter turns) and, every other time, a tiny
 * « PING ! » pixel bubble. A pool of POOL, the oldest reused; nothing is allocated per twinkle.
 */
export class Twinkles {
  private readonly pool: Twinkle[] = [];
  private count = 0;

  constructor(scene: Phaser.Scene) {
    makeTwinkleTexture(scene);
    for (let i = 0; i < POOL; i++) {
      const star = scene.add
        .image(0, 0, 'twinkle')
        .setDepth(DEPTH.overlay + 2)
        .setVisible(false);
      const ping = scene.add
        .text(0, 0, 'PING !', {
          fontFamily: '"Press Start 2P", ui-monospace, monospace',
          fontSize: '6px',
          color: '#fff7e0',
          backgroundColor: '#14121c',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.overlay + 2)
        .setVisible(false);
      ping.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.pool.push({ star, ping, born: -Infinity, k: 1 });
    }
  }

  spawn(x: number, y: number, nowMs: number): void {
    let tw = this.pool[0]!;
    for (const q of this.pool) if (q.born < tw.born) tw = q;
    tw.born = nowMs;
    // scaled for the camera zoom like the other bubbles (×2 at zoom 1)
    const zoom = tw.star.scene.cameras.main.zoom || 1;
    tw.k = Math.max(1, Math.round(2 / zoom));
    tw.star.setPosition(Math.round(x), Math.round(y)).setVisible(true);
    tw.ping
      .setPosition(Math.round(x), Math.round(y) - 6 * tw.k)
      .setScale(tw.k)
      .setVisible(this.count++ % PING_EVERY === 0);
  }

  update(nowMs: number): void {
    for (const tw of this.pool) {
      if (!tw.star.visible) continue;
      const age = nowMs - tw.born;
      if (age >= TWINKLE_MS) {
        tw.star.setVisible(false);
        tw.ping.setVisible(false);
        continue;
      }
      const t = age / TWINKLE_MS;
      // pops to ×3, then shrinks to nothing, by whole steps; quarter turns keep the pixels crisp
      const s = t < 0.2 ? 1 + 10 * t : 3 * (1 - (t - 0.2) / 0.8);
      tw.star.setScale(tw.k * Math.max(0.25, Math.round(s * 2) / 2)).setAngle(Math.floor(age / 90) % 2 === 0 ? 0 : 90);
      tw.ping.setAlpha(t > 0.7 ? (1 - t) / 0.3 : 1);
    }
  }

  destroy(): void {
    for (const tw of this.pool) {
      tw.star.destroy();
      tw.ping.destroy();
    }
  }
}
