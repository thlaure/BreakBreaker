import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import { DEPTH } from './depth';

const OUTLINE = 0x14121c;
/** Icons are drawn 12×12 and shown at ×2 (crisp under the integer zoom). */
const SIZE = 12;
const SCALE = 2;
/** Height of the icon above a rioter's or Paul's feet. */
const HEAD_Y = 52;

type Painter = (g: Phaser.GameObjects.Graphics) => void;

/** Small original pixel icons of ordinary belongings (bag, hat, cane, glasses, scarf, cap, backpack). */
const ICONS: Record<string, Painter> = {
  handbag: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(3, 1, 6, 1).fillRect(2, 2, 1, 3).fillRect(9, 2, 1, 3).fillRect(1, 4, 10, 7);
    g.fillStyle(0xb0412e, 1).fillRect(2, 5, 8, 5);
    g.fillStyle(0xd2694f, 1).fillRect(2, 5, 8, 1);
    g.fillStyle(0xe8c25a, 1).fillRect(5, 6, 2, 1);
  },
  hat: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(3, 2, 6, 6).fillRect(0, 7, 12, 3);
    g.fillStyle(0x4a3b2c, 1).fillRect(4, 3, 4, 4).fillRect(1, 8, 10, 1);
    g.fillStyle(0x9a3030, 1).fillRect(4, 6, 4, 1);
  },
  cane: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(3, 0, 5, 3).fillRect(6, 2, 3, 10).fillRect(2, 2, 3, 3);
    g.fillStyle(0x8a5a2b, 1).fillRect(4, 1, 3, 1).fillRect(7, 2, 1, 9).fillRect(3, 3, 1, 1);
  },
  glasses: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(0, 4, 5, 4).fillRect(7, 4, 5, 4).fillRect(5, 5, 2, 1);
    g.fillStyle(0x9fd3f0, 1).fillRect(1, 5, 3, 2).fillRect(8, 5, 3, 2);
  },
  scarf: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(0, 2, 12, 4).fillRect(6, 5, 4, 7);
    g.fillStyle(0x2f8f6a, 1).fillRect(1, 3, 10, 2).fillRect(7, 5, 2, 6);
    g.fillStyle(0xf0e6c8, 1).fillRect(3, 3, 1, 2).fillRect(7, 8, 2, 1);
  },
  cap: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(2, 3, 7, 6).fillRect(6, 7, 6, 3);
    g.fillStyle(0x2f6fd6, 1).fillRect(3, 4, 5, 4).fillRect(7, 8, 4, 1);
    g.fillStyle(0xffffff, 1).fillRect(5, 4, 1, 1);
  },
  backpack: (g) => {
    g.fillStyle(OUTLINE, 1).fillRect(3, 0, 6, 2).fillRect(1, 1, 10, 11);
    g.fillStyle(0xd48a2a, 1).fillRect(2, 2, 8, 9);
    g.fillStyle(0xa86418, 1).fillRect(3, 7, 6, 3);
    g.fillStyle(0xf2c25a, 1).fillRect(2, 2, 8, 1);
  },
};

/** `item_<id>` textures drawn at runtime (no image files needed). */
export function makeItemTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('item_handbag')) return;
  const g = scene.make.graphics({}, false);
  for (const [id, paint] of Object.entries(ICONS)) {
    g.clear();
    paint(g);
    g.generateTexture(`item_${id}`, SIZE, SIZE);
  }
  g.destroy();
}

const texture = (id: string): string => (id in ICONS ? `item_${id}` : 'item_handbag');

interface Shown {
  glow: Phaser.GameObjects.Ellipse;
  icon: Phaser.GameObjects.Image;
}

/**
 * The rescue victim's belongings out in the street: above the thief's head while carried off, on the ground (float,
 * pulse and a soft glow: a pickup) once the thief is KO, and above Paul while he carries them back (with a count when
 * more than one). Keyed by rescue id + item id, so a new rescue never reuses the previous one's.
 */
export class ItemLayer {
  private readonly shown = new Map<string, Shown>();
  private readonly carried: Phaser.GameObjects.Image;
  private readonly count: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.carried = scene.add
      .image(0, 0, 'item_handbag')
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
    this.count = scene.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '9px', color: '#ffe066', stroke: '#14121c', strokeThickness: 2 })
      .setOrigin(0, 1)
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
  }

  update(rescue: Snapshot['rescue'], player: Snapshot['player'], nowMs: number): void {
    const seen = new Set<string>();
    const live = rescue && (rescue.stage === 'threat' || rescue.stage === 'secured');
    const carried: string[] = [];
    if (rescue && live) {
      rescue.items.forEach((it, i) => {
        if (it.state === 'carried') carried.push(it.id);
        if (it.state !== 'carried-by-thief' && it.state !== 'dropped') return;
        const key = `${rescue.id}:${it.id}`;
        seen.add(key);
        let s = this.shown.get(key);
        if (!s) {
          s = {
            glow: this.scene.add.ellipse(0, 0, 26, 10, 0xffe066, 0.3).setBlendMode(Phaser.BlendModes.ADD),
            icon: this.scene.add.image(0, 0, texture(it.id)).setOrigin(0.5, 1).setScale(SCALE),
          };
          this.shown.set(key, s);
        }
        const phase = nowMs / 1000 + i;
        const pulse = 0.5 + 0.5 * Math.sin(phase * 4);
        const x = Math.round(it.pos.x);
        if (it.state === 'carried-by-thief') {
          s.glow.setVisible(false);
          const bob = Math.round(Math.sin(phase * 5));
          s.icon
            .setPosition(x, Math.round(it.pos.y) - HEAD_Y - bob)
            .setScale(SCALE)
            .setDepth(DEPTH.overlay - 1);
        } else {
          s.glow
            .setVisible(true)
            .setPosition(x, Math.round(it.pos.y) + 4)
            .setDepth(it.pos.y - 1);
          s.glow.setAlpha(0.2 + 0.35 * pulse).setScale(0.9 + 0.25 * pulse);
          const lift = Math.round(4 + 2 * Math.sin(phase * 3));
          s.icon
            .setPosition(x, Math.round(it.pos.y) + 4 - lift)
            .setScale(Math.round(SCALE * (1 + 0.1 * pulse) * 8) / 8)
            .setDepth(it.pos.y);
        }
      });
    }
    for (const [key, s] of this.shown) {
      if (seen.has(key)) continue;
      s.glow.destroy();
      s.icon.destroy();
      this.shown.delete(key);
    }

    const show = carried.length > 0 && !player.ko;
    this.carried.setVisible(show);
    this.count.setVisible(show && carried.length > 1);
    if (!show) return;
    this.carried.setTexture(texture(carried[0]!));
    const bob = Math.round(1.5 * Math.sin(nowMs / 240));
    // beside the head, clear of a carried toolbox (drawn right above it)
    const x = Math.round(player.pos.x) - 18;
    const y = Math.round(player.pos.y) - HEAD_Y + 6 - bob;
    this.carried.setPosition(x, y);
    if (carried.length > 1) this.count.setText(`×${carried.length}`).setPosition(x + 10, y);
  }
}
