import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import { DEPTH } from './depth';
import { badgeOf, hpBarShown, hpFill, hpSegmentFills, hpSegments } from './roleLook';

type HostileSnap = Snapshot['hostiles'][number];

/**
 * Molotov rioter's bottle: held at his side, raised and lit (flickering flame + "!" over his head) while he holds a
 * bottle up (`bottleUp`), gone once thrown (a bottle windup that ends without a KO is the throw). A firebomber always
 * has a fresh one in hand (a Molotov that turned firebomber after its site throw picks one up again).
 */
export class BottleProp {
  private readonly bottle: Phaser.GameObjects.Image;
  private readonly flame: Phaser.GameObjects.Image;
  private readonly bang: Phaser.GameObjects.Image;
  private held = true;
  private wasWindup = false;

  constructor(scene: Phaser.Scene) {
    this.bottle = scene.add.image(0, 0, 'bottle').setOrigin(0.5, 1).setScale(2);
    this.flame = scene.add.image(0, 0, 'flame').setOrigin(0.5, 1).setScale(2).setBlendMode(Phaser.BlendModes.ADD);
    this.bang = scene.add.image(0, 0, 'bang').setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.overlay);
  }

  update(h: HostileSnap, depth: number, nowMs: number): void {
    const ko = h.state === 'ko';
    if (h.role === 'firebomber') this.held = true;
    else if (this.wasWindup && !h.bottleUp && !ko) this.held = false;
    this.wasWindup = h.bottleUp;
    const held = this.held && !ko;
    const lit = held && h.bottleUp;
    this.bottle.setVisible(held);
    this.flame.setVisible(lit);
    this.bang.setVisible(lit);
    if (!held) return;
    const side = h.facing.x < 0 ? -1 : 1;
    const d = depth + (h.facing.y < 0 ? -0.04 : 0.04);
    const x = Math.round(h.pos.x);
    const y = Math.round(h.pos.y);
    if (!lit) {
      this.bottle
        .setPosition(x + side * 9, y - 14)
        .setAngle(side * 15)
        .setDepth(d);
      return;
    }
    // raised beside the head, rag on fire
    const bx = x + side * 12;
    const by = y - 34;
    this.bottle
      .setPosition(bx, by)
      .setAngle(side * 20)
      .setDepth(d);
    const tick = Math.floor(nowMs / 70);
    this.flame
      .setPosition(bx + side * 7, by - 18)
      .setScale(2, tick % 3 === 0 ? 2.5 : 2)
      .setFlipX(tick % 2 === 0)
      .setAlpha(0.85 + 0.15 * (tick % 2))
      .setDepth(d + 0.01);
    this.bang.setPosition(x, y - 66 - Math.round(2 * Math.abs(Math.sin(nowMs / 110))));
  }

  destroy(): void {
    this.bottle.destroy();
    this.flame.destroy();
    this.bang.destroy();
  }
}

const BADGE_PAL: Record<string, number> = { K: 0x14121c, S: 0x8a94a3, W: 0xd6dde6, D: 0x5b6472, Y: 0xffd166, O: 0xe0902a, R: 0xd23b3b };
/** Brute: a dark steel helmet (18×6). */
const HELMET = [
  '....KKKKKKKKKK....',
  '..KKSSWWSSSSSSKK..',
  '.KSSWWSSSSSSSSDSK.',
  '.KSSSSSSSSSSSDDSK.',
  'KDDDDDDDDDDDDDDDDK',
  'KKKKKKKKKKKKKKKKKK',
];
/** Caïd: a gold crown with red jewels (14×8). */
const CROWN = [
  'K....K..K....K',
  'KY..KYKKYK..YK',
  'KYYKYYYYYYKYYK',
  'KYYYYYYYYYYYYK',
  'KYYRYYYYYYRYYK',
  'KYYYYYRRYYYYYK',
  'KOOOOOOOOOOOOK',
  'KKKKKKKKKKKKKK',
];

/** `badge_helmet` / `badge_crown` textures (pixel rows drawn at runtime, no image file). */
export function makeRoleTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('badge_helmet')) return;
  const g = scene.make.graphics({}, false);
  for (const [key, rows] of [
    ['badge_helmet', HELMET],
    ['badge_crown', CROWN],
  ] as const) {
    g.clear();
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = BADGE_PAL[row[x]!];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      }
    });
    g.generateTexture(key, rows[0]!.length, rows.length);
  }
  g.destroy();
}

/** Head top above the feet in an LPC frame at scale 1 (badges sit on it). */
const HEAD_TOP = 44;
const HP_W = 20;
const HP_H = 4;
const HP_INK = 0x14121c;
const HP_TRACK = 0x3a3448;
const HP_RED = 0xff5a4e;
/** The Caïd's segmented bar: SEG_W px per segment (2 HP), 1-px ink gaps. */
const SEG_W = 2;

/**
 * The role look of a brute or the Caïd: a helmet / crown badge on the head and a small red pixel HP bar over it (the
 * Caïd always, segmented one segment per 2 HP so his progress reads; a brute once damaged); hidden on a KO body.
 */
export class RoleBadge {
  private readonly badge: Phaser.GameObjects.Image | null;
  private readonly bar: Phaser.GameObjects.Graphics;
  private drawn = -1;

  constructor(
    scene: Phaser.Scene,
    role: HostileSnap['role'],
    private readonly size: number,
  ) {
    const key = badgeOf(role);
    this.badge = key ? scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(size) : null;
    this.bar = scene.add.graphics().setVisible(false);
  }

  update(h: HostileSnap, sprite: Phaser.GameObjects.Sprite): void {
    const ko = h.state === 'ko';
    const x = Math.round(sprite.x);
    const top = Math.round(sprite.y - HEAD_TOP * this.size);
    if (this.badge) {
      this.badge.setVisible(!ko && sprite.visible);
      // the helmet covers the top of the head, the crown sits on it
      const sink = this.badge.texture.key === 'badge_helmet' ? 4 : 3;
      this.badge.setPosition(x, top + Math.round(sink * this.size)).setDepth(sprite.depth + 0.05);
    }
    const shown = hpBarShown(h) && sprite.visible;
    this.bar.setVisible(shown);
    if (!shown) return;
    const lift = this.badge ? Math.round((this.badge.height + 2) * this.size) : 4;
    if (h.role === 'boss') {
      this.drawSegments(h, x, top - lift - HP_H);
      return;
    }
    this.bar.setPosition(x - HP_W / 2, top - lift - HP_H).setDepth(DEPTH.overlay);
    const fill = hpFill(h.hp, h.maxHp, HP_W - 2);
    if (fill === this.drawn) return;
    this.drawn = fill;
    this.bar.clear();
    this.bar.fillStyle(HP_INK, 1).fillRect(0, 0, HP_W, HP_H);
    this.bar.fillStyle(HP_TRACK, 1).fillRect(1, 1, HP_W - 2, HP_H - 2);
    if (fill > 0) this.bar.fillStyle(HP_RED, 1).fillRect(1, 1, fill, HP_H - 2);
  }

  /** The Caïd's bar: one SEG_W-px segment per 2 HP (at most 13) with 1-px ink ticks between them. */
  private drawSegments(h: HostileSnap, x: number, y: number): void {
    const n = hpSegments(h.maxHp);
    const w = n * (SEG_W + 1) + 1;
    this.bar.setPosition(x - Math.floor(w / 2), y).setDepth(DEPTH.overlay);
    const key = h.hp * 1000 + h.maxHp;
    if (key === this.drawn) return;
    this.drawn = key;
    this.bar.clear();
    this.bar.fillStyle(HP_INK, 1).fillRect(0, 0, w, HP_H);
    const fills = hpSegmentFills(h.hp, h.maxHp, SEG_W);
    for (let i = 0; i < n; i++) {
      const sx = 1 + i * (SEG_W + 1);
      this.bar.fillStyle(HP_TRACK, 1).fillRect(sx, 1, SEG_W, HP_H - 2);
      if (fills[i]! > 0) this.bar.fillStyle(HP_RED, 1).fillRect(sx, 1, fills[i]!, HP_H - 2);
    }
  }

  destroy(): void {
    this.badge?.destroy();
    this.bar.destroy();
  }
}
