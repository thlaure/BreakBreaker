import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { DEPTH } from './depth';

const INK = 0x14121c;
/** Shield / beam palette (original pixel art, no franchise art). */
const STEEL = 0xa9b6c8;
const STEEL_LIGHT = 0xe4ecf5;
const BLUE = 0x3b6fd8;
const BLUE_DARK = 0x24468f;
const ENERGY = 0x8fd3ff;
const ENERGY_CORE = 0xf2fbff;

/** Height of Paul's hands above his feet (sprite origin), px. */
export const HANDS_Y = 16;
/** The held shield sits this far in front of Paul. */
const SHIELD_REACH = 8;
/** The held shield fades and blinks during its last seconds. */
export const SHIELD_BLINK_SEC = 3;
const BLOCK_MS = 220;
export const BEAM_MS = 250;

/**
 * Runtime textures of the two special weapons: `weapon_bouclier` (pickup and held: a round blue/steel shield with a
 * highlight) and `weapon_kamehame` (pickup: a glowing blue orb with a spark).
 */
export function makeSpecialTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('weapon_bouclier')) return;
  const g = scene.make.graphics({}, false);
  // shield 18×20: ink rim, blue ring, steel face, white highlight, central boss
  g.fillStyle(INK, 1).fillCircle(9, 10, 9);
  g.fillStyle(BLUE_DARK, 1).fillCircle(9, 10, 8);
  g.fillStyle(BLUE, 1).fillCircle(9, 10, 7);
  g.fillStyle(STEEL, 1).fillCircle(9, 10, 5);
  g.fillStyle(STEEL_LIGHT, 1).fillRect(5, 5, 3, 2).fillRect(4, 7, 2, 2);
  g.fillStyle(INK, 1).fillRect(8, 9, 2, 2);
  g.generateTexture('weapon_bouclier', 18, 20);
  g.clear();
  // energy orb 18×20: ink rim, blue shell, light-blue body, white core, a spark on the top right
  g.fillStyle(INK, 1).fillCircle(8, 11, 8);
  g.fillStyle(BLUE, 1).fillCircle(8, 11, 7);
  g.fillStyle(ENERGY, 1).fillCircle(8, 11, 5);
  g.fillStyle(ENERGY_CORE, 1).fillCircle(7, 10, 2);
  g.fillStyle(ENERGY_CORE, 1).fillRect(15, 0, 1, 5).fillRect(13, 2, 5, 1);
  g.generateTexture('weapon_kamehame', 18, 20);
  g.destroy();
}

/** Alpha of the held shield: full, then a fading blink in the last SHIELD_BLINK_SEC (pure, for tests). */
export function shieldAlpha(secondsLeft: number, nowMs: number): number {
  if (secondsLeft >= SHIELD_BLINK_SEC) return 1;
  const fade = 0.55 + 0.45 * Math.max(0, secondsLeft / SHIELD_BLINK_SEC);
  const off = Math.floor(nowMs / (secondsLeft < 1 ? 70 : 140)) % 2 === 0;
  return off ? fade * 0.35 : fade;
}

/** Where a beam / charge glow is drawn: Paul's hands, a little in front along his facing. */
export function handsPos(pos: Vec, facing: Vec): Vec {
  return { x: Math.round(pos.x + facing.x * 6), y: Math.round(pos.y - HANDS_Y + facing.y * 4) };
}

/**
 * The bouclier in Paul's hands: held in front along his facing, drawn above him when he faces down or sideways and
 * behind him when he faces up; fades and blinks in its last seconds. Hidden without a shield or while KO.
 */
export class ShieldView {
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, 'weapon_bouclier').setOrigin(0.5, 0.5).setVisible(false);
  }

  update(weapon: Snapshot['weapon'], player: Snapshot['player'], body: Phaser.GameObjects.Sprite, nowMs: number): void {
    if (weapon?.kind !== 'bouclier' || player.ko) {
      this.sprite.setVisible(false);
      return;
    }
    const f = player.facing;
    const up = f.y < -0.5;
    this.sprite
      .setVisible(true)
      .setPosition(Math.round(body.x + f.x * SHIELD_REACH), Math.round(body.y - 14 + f.y * 4))
      .setFlipX(f.x < 0)
      .setScale(up ? 0.9 : 1)
      .setAlpha(shieldAlpha(weapon.secondsLeft ?? 0, nowMs))
      .setDepth(body.depth + (up ? -0.1 : 0.1));
  }
}

interface Block {
  x: number;
  y: number;
  born: number;
}

/**
 * Onde d’énergie and bouclier effects: the charge glow growing in Paul's hands (additive blue-white disc and a thin
 * ring), the beam (~BEAM_MS, pixel-stepped widths, additive glow, flicker) and, on a shield block, a spark burst and a
 * short expanding ring.
 */
export class SpecialFx {
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly beamG: Phaser.GameObjects.Graphics;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private beam: { from: Vec; to: Vec; born: number } | null = null;
  private blocks: Block[] = [];

  constructor(scene: Phaser.Scene) {
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.beamG = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlay - 2).setVisible(false);
    this.rings = scene.add.graphics().setDepth(DEPTH.overlay - 2);
    this.sparks = scene.add.particles(0, 0, 'px', {
      lifespan: { min: 160, max: 320 },
      speed: { min: 60, max: 160 },
      scale: { start: 2, end: 0.5 },
      tint: [0xffffff, STEEL_LIGHT, ENERGY, 0xffe066],
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.sparks.setDepth(DEPTH.overlay - 1);
  }

  /** The bouclier stopped something at `pos`. */
  block(pos: Vec, nowMs: number): void {
    this.sparks.explode(10, pos.x, pos.y);
    this.blocks.push({ x: Math.round(pos.x), y: Math.round(pos.y), born: nowMs });
    if (this.blocks.length > 6) this.blocks.shift();
  }

  /** The beam fired from Paul (`from`) to `to` (sim positions, feet height). */
  fire(from: Vec, to: Vec, facing: Vec, nowMs: number): void {
    const h = handsPos(from, facing);
    this.beam = { from: h, to: { x: Math.round(to.x), y: Math.round(to.y - HANDS_Y) }, born: nowMs };
  }

  update(charge: Snapshot['charge'], player: Snapshot['player'], body: Phaser.GameObjects.Sprite, nowMs: number): void {
    this.drawCharge(charge, player, body, nowMs);
    this.drawBeam(nowMs);
    this.drawBlocks(nowMs);
  }

  private drawCharge(charge: Snapshot['charge'], player: Snapshot['player'], body: Phaser.GameObjects.Sprite, nowMs: number): void {
    const g = this.glow;
    if (!charge || player.ko) {
      g.setVisible(false);
      return;
    }
    const p = Math.max(0, Math.min(1, charge.progress));
    const h = handsPos({ x: body.x, y: body.y }, player.facing);
    const flick = Math.floor(nowMs / 60) % 2;
    const r = Math.round(2 + 6 * p) + flick;
    g.clear()
      .setVisible(true)
      .setDepth(body.depth + 0.2)
      .fillStyle(ENERGY, 0.35 + 0.3 * p)
      .fillCircle(h.x, h.y, r + 3)
      .fillStyle(ENERGY_CORE, 0.6 + 0.4 * p)
      .fillCircle(h.x, h.y, Math.max(1, r - 1))
      // thin ring closing in as the charge grows
      .lineStyle(1, ENERGY_CORE, 0.8)
      .strokeCircle(h.x, h.y, Math.round(18 - 10 * p));
  }

  private drawBeam(nowMs: number): void {
    const g = this.beamG;
    const b = this.beam;
    if (!b || nowMs - b.born >= BEAM_MS) {
      if (g.visible) g.clear().setVisible(false);
      this.beam = null;
      return;
    }
    const t = (nowMs - b.born) / BEAM_MS;
    // pixel-stepped: grows fast, then thins out; widths are whole pixels
    const w = Math.max(2, Math.round((t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75) * 14 / 2) * 2);
    const flick = Math.floor(nowMs / 40) % 2 === 0 ? 1 : 0.8;
    g.clear().setVisible(true);
    g.lineStyle(w + 8, BLUE, 0.35 * flick).lineBetween(b.from.x, b.from.y, b.to.x, b.to.y);
    g.lineStyle(w + 2, ENERGY, 0.75 * flick).lineBetween(b.from.x, b.from.y, b.to.x, b.to.y);
    g.lineStyle(Math.max(2, w - 4), ENERGY_CORE, 1).lineBetween(b.from.x, b.from.y, b.to.x, b.to.y);
    // flared muzzle and impact
    g.fillStyle(ENERGY_CORE, 0.9).fillCircle(b.from.x, b.from.y, Math.round(w / 2) + 3);
    g.fillStyle(ENERGY, 0.7).fillCircle(b.to.x, b.to.y, Math.round(w / 2) + 2);
  }

  private drawBlocks(nowMs: number): void {
    const g = this.rings;
    g.clear();
    this.blocks = this.blocks.filter((b) => nowMs - b.born < BLOCK_MS);
    for (const b of this.blocks) {
      const t = (nowMs - b.born) / BLOCK_MS;
      g.lineStyle(2, STEEL_LIGHT, 1 - t).strokeCircle(b.x, b.y, Math.round(4 + 10 * t));
    }
  }

  destroy(): void {
    this.glow.destroy();
    this.beamG.destroy();
    this.rings.destroy();
    this.sparks.destroy();
  }
}
