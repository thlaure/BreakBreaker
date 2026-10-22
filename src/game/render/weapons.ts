import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import { isSpecial, type HeldKind } from '../../sim/weapons';
import { makeGunTextures } from './guns';
import { pickupBlinkOff } from './pickupBlink';

/** Strike spin duration (ms) of the weapon in Paul's hands — matches the circular strike. */
const SPIN_MS = 220;

/**
 * `weapon_<kind>` textures drawn at runtime: stick, hammer, road sign (no image files needed); the glove, the flashball
 * and the shooters' rifle come from render/guns.ts.
 */
export function makeWeaponTextures(scene: Phaser.Scene): void {
  makeGunTextures(scene);
  if (scene.textures.exists('weapon_baton')) return;
  const g = scene.make.graphics({}, false);
  const outline = 0x14121c;
  // baton: brown stick, 4×20
  g.fillStyle(outline, 1).fillRect(0, 0, 6, 22);
  g.fillStyle(0x8a5a2b, 1).fillRect(1, 1, 4, 20);
  g.fillStyle(0xb07a43, 1).fillRect(1, 1, 1, 20);
  g.generateTexture('weapon_baton', 6, 22);
  g.clear();
  // marteau: wooden handle + grey head
  g.fillStyle(outline, 1).fillRect(5, 4, 4, 16).fillRect(0, 0, 14, 7);
  g.fillStyle(0x8a5a2b, 1).fillRect(6, 6, 2, 13);
  g.fillStyle(0x9aa0aa, 1).fillRect(1, 1, 12, 5);
  g.fillStyle(0xd6dae0, 1).fillRect(1, 1, 12, 1);
  g.generateTexture('weapon_marteau', 14, 20);
  g.clear();
  // panneau: grey pole + red round sign with a white bar ("sens interdit")
  g.fillStyle(outline, 1).fillRect(6, 10, 4, 18).fillCircle(8, 8, 8);
  g.fillStyle(0x9aa0aa, 1).fillRect(7, 12, 2, 15);
  g.fillStyle(0xd23b3b, 1).fillCircle(8, 8, 7);
  g.fillStyle(0xffffff, 1).fillRect(3, 7, 10, 3);
  g.generateTexture('weapon_panneau', 16, 28);
  g.destroy();
}

/** Additive glow under a special pickup. */
const SPECIAL_GLOW: Readonly<Record<string, number>> = { bouclier: 0x7bb4ff };

/**
 * Weapons lying in the street: bob, gentle sway and a pulsing glow so they read as pickups. The special pickup (the
 * bouclier, see render/specials.ts) floats higher, pulses in size and has a bigger additive glow in its own colour.
 */
export class WeaponLayer {
  private readonly items = new Map<number, { glow: Phaser.GameObjects.Ellipse; sprite: Phaser.GameObjects.Image }>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** A weapon with an expiry (every street spawn and drop) blinks during its last PICKUP_BLINK_SEC. */
  update(list: Snapshot['weaponsOnGround'], nowMs: number, simNow: number): void {
    const seen = new Set<number>();
    for (const w of list) {
      seen.add(w.id);
      let it = this.items.get(w.id);
      if (!it) {
        const special = isSpecial(w.kind);
        const glow = this.scene.add
          .ellipse(w.pos.x, w.pos.y + 6, special ? 34 : 26, special ? 14 : 10, special ? SPECIAL_GLOW[w.kind]! : 0xffe066, 0.35)
          .setDepth(w.pos.y - 1);
        if (special) glow.setBlendMode(Phaser.BlendModes.ADD);
        const sprite = this.scene.add.image(w.pos.x, w.pos.y, `weapon_${w.kind}`).setOrigin(0.5, 1).setDepth(w.pos.y);
        it = { glow, sprite };
        this.items.set(w.id, it);
      }
      const phase = nowMs / 1000 + w.id;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 4);
      if (isSpecial(w.kind)) {
        it.sprite.setY(w.pos.y - Math.round(5 + 3 * Math.sin(phase * 3)));
        it.sprite.setAngle(0).setScale(Math.round((1 + 0.15 * pulse) * 8) / 8);
        it.glow.setAlpha(0.35 + 0.45 * pulse).setScale(0.85 + 0.35 * pulse);
      } else {
        it.sprite.setY(w.pos.y + 4 - Math.round(2 + 2 * Math.sin(phase * 3)));
        it.sprite.setAngle(Math.sin(phase * 2) * 12);
        it.glow.setAlpha(0.2 + 0.35 * pulse).setScale(0.9 + 0.2 * pulse);
      }
      const off = pickupBlinkOff(w.expiresAt, simNow, nowMs);
      it.sprite.setAlpha(off ? 0.2 : 1);
      if (off) it.glow.setAlpha(0.05);
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      it.glow.destroy();
      it.sprite.destroy();
      this.items.delete(id);
    }
  }
}

/**
 * The weapon in Paul's hand: carried at his side, spins once around him on each strike. The bouclier is not held: its
 * protection is drawn by BubbleView (a bubble around him, on top of the held weapon).
 */
export class HeldWeaponView {
  private readonly sprite: Phaser.GameObjects.Image;
  private kind: HeldKind | null = null;
  private spinUntil = 0;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, 'weapon_baton').setOrigin(0.5, 0.9).setVisible(false);
  }

  update(weapon: Snapshot['weapon'], player: Snapshot['player'], struck: boolean, nowMs: number): void {
    if (!weapon || player.ko) {
      this.sprite.setVisible(false);
      this.kind = null;
      return;
    }
    if (weapon.kind !== this.kind) {
      this.kind = weapon.kind;
      this.sprite.setTexture(`weapon_${weapon.kind}`);
    }
    const side = player.facing.x < 0 ? -1 : 1;
    // the flashball is held pointing where Paul aims; the gant waits at his side (render/guns.ts draws the punch)
    if (weapon.kind === 'flashball' || weapon.kind === 'gant') {
      const aim = weapon.kind === 'flashball';
      this.sprite
        .setVisible(true)
        .setOrigin(0.3, 0.5)
        .setPosition(Math.round(player.pos.x + side * (aim ? 6 : 9)), Math.round(player.pos.y - (aim ? 16 : 12)))
        .setAngle(aim ? (Math.atan2(player.facing.y, player.facing.x) * 180) / Math.PI : 0)
        .setFlipY(aim && side < 0)
        .setFlipX(!aim && side < 0)
        .setScale(1)
        .setDepth(player.pos.y + (player.facing.y < 0 ? -0.5 : 0.5));
      return;
    }
    this.sprite.setOrigin(0.5, 0.9).setFlipX(false).setFlipY(false);
    if (struck) this.spinUntil = nowMs + SPIN_MS;
    let angle = side * 35;
    if (nowMs < this.spinUntil) angle += (1 - (this.spinUntil - nowMs) / SPIN_MS) * 360 * side;
    this.sprite
      .setVisible(true)
      .setPosition(Math.round(player.pos.x + side * 9), Math.round(player.pos.y - 14))
      .setAngle(angle)
      .setScale(1)
      .setDepth(player.pos.y + (player.facing.y < 0 ? -0.5 : 0.5));
  }
}
