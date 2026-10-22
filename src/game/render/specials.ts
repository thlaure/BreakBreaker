import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import {
  BUBBLE_LIFT,
  HIGHLIGHT_ARC,
  bubbleAlpha,
  bubbleRadius,
  highlightAngle,
  popRing,
  rimPoint,
  rippleRing,
} from './bubbleMath';
import { CHARGE_RING_Y, chargeRing } from './chargeMath';
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
const BLOCK_MS = 220;
export const BEAM_MS = 250;
/** Bubble palette: light blue / white soap film. */
const FILM = 0xbfe6ff;
const FILM_EDGE = 0x8fd3ff;
const RIM = 0xeaf8ff;
const SHINE = 0xffffff;
/** Rim flash after a hit (ms). */
const HIT_FLASH_MS = 140;

/**
 * Runtime texture of the special pickup: `weapon_bouclier` (a round blue/steel shield with a highlight; once picked
 * up it becomes the protection bubble, BubbleView).
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
  g.destroy();
}

/** Where a beam / charge glow is drawn: Paul's hands, a little in front along his facing. */
export function handsPos(pos: Vec, facing: Vec): Vec {
  return { x: Math.round(pos.x + facing.x * 6), y: Math.round(pos.y - HANDS_Y + facing.y * 4) };
}

/**
 * The bouclier as a protection bubble around Paul: a translucent soap-bubble sphere (radius ≈ BUBBLE_R, light blue and
 * white film, a soft additive glow, a thin 1-px lighter rim, a highlight arc slowly circling, a gentle ±1 px pulse),
 * drawn above Paul and below his health bar. A hit (ShieldBlocked) flashes the rim and leaves a ripple ring where it
 * struck; in its last BUBBLE_FLICKER_SEC it fades and flickers faster and faster, then pops (a quick expanding ring and
 * a few droplets). prefers-reduced-motion: no pulse, no flicker, fixed highlight. Two Graphics reused every frame (no
 * allocation per frame); whole-pixel positions.
 */
export class BubbleView {
  private readonly film: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private held = false;
  private readonly center = { x: 0, y: 0 };
  private popAt = -Infinity;
  private readonly pop = { x: 0, y: 0, depth: 0 };
  private flashUntil = 0;
  private readonly ripples: { x: number; y: number; born: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly reducedMotion = false,
  ) {
    this.film = scene.add.graphics().setVisible(false);
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  /**
   * Something hit the bubble: `hit` is the sim's block position, `feet` Paul's. Returns the rim point where it shows
   * (for the sparks), and starts a ripple there.
   */
  hit(feet: Vec, hit: Vec, nowMs: number): Vec {
    const at = this.held ? rimPoint(this.center, feet, hit, bubbleRadius(nowMs, this.reducedMotion)) : { x: Math.round(hit.x), y: Math.round(hit.y) };
    if (this.ripples.length >= 4) this.ripples.shift();
    this.ripples.push({ x: at.x, y: at.y, born: nowMs });
    this.flashUntil = nowMs + HIT_FLASH_MS;
    return at;
  }

  update(shield: Snapshot['shield'], player: Snapshot['player'], body: Phaser.GameObjects.Sprite, nowMs: number): void {
    const on = shield !== null && !player.ko;
    if (this.held && !on && !player.ko) {
      // expired: pop where it was
      this.popAt = nowMs;
      this.pop.x = this.center.x;
      this.pop.y = this.center.y;
      this.pop.depth = this.film.depth;
    }
    this.held = on;
    const f = this.film;
    const g = this.glow;
    f.clear();
    g.clear();
    let any = false;
    const depth = body.depth + 0.15;
    if (on) {
      any = true;
      this.center.x = Math.round(body.x);
      this.center.y = Math.round(body.y - BUBBLE_LIFT);
      const { x, y } = this.center;
      const r = bubbleRadius(nowMs, this.reducedMotion);
      const a = bubbleAlpha(shield!.secondsLeft, nowMs, this.reducedMotion);
      const flash = nowMs < this.flashUntil ? 1 : 0;
      // film: faint fill, a slightly denser edge band, the 1-px lighter rim
      f.fillStyle(FILM, 0.1 * a).fillCircle(x, y, r);
      f.lineStyle(2, FILM_EDGE, (0.22 + 0.3 * flash) * a).strokeCircle(x, y, r - 1);
      f.lineStyle(1, RIM, (0.65 + 0.35 * flash) * a).strokeCircle(x, y, r);
      // soft glow (additive) and the moving highlight arc with a small specular dot
      g.fillStyle(FILM_EDGE, 0.08 * a).fillCircle(x, y, r + 2);
      const h = highlightAngle(nowMs, this.reducedMotion);
      g.lineStyle(2, SHINE, 0.55 * a);
      g.beginPath();
      g.arc(x, y, r - 4, h, h + HIGHLIGHT_ARC, false);
      g.strokePath();
      const sx = Math.round(x + Math.cos(h + HIGHLIGHT_ARC / 2) * (r * 0.55));
      const sy = Math.round(y + Math.sin(h + HIGHLIGHT_ARC / 2) * (r * 0.55));
      g.fillStyle(SHINE, 0.7 * a).fillRect(sx - 1, sy - 1, 2, 2);
    }
    // ripples where something struck (they outlive the bubble by a few ms)
    let keep = 0;
    for (const rp of this.ripples) {
      const ring = rippleRing(nowMs - rp.born);
      if (!ring) continue;
      this.ripples[keep++] = rp;
      any = true;
      g.lineStyle(1, RIM, ring.alpha).strokeCircle(rp.x, rp.y, ring.r);
    }
    this.ripples.length = keep;
    // pop: a quick expanding ring and eight droplets flying out
    const ring = popRing(nowMs - this.popAt);
    if (ring) {
      any = true;
      g.lineStyle(1, RIM, ring.alpha).strokeCircle(this.pop.x, this.pop.y, ring.r);
      g.fillStyle(SHINE, ring.alpha);
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        g.fillRect(Math.round(this.pop.x + Math.cos(ang) * (ring.r + 3)), Math.round(this.pop.y + Math.sin(ang) * (ring.r + 3)), 1, 1);
      }
    }
    f.setVisible(on).setDepth(depth);
    g.setVisible(any).setDepth(on ? depth + 0.01 : this.pop.depth + 0.01);
  }

  destroy(): void {
    this.film.destroy();
    this.glow.destroy();
  }
}

interface Block {
  x: number;
  y: number;
  born: number;
}

/**
 * Onde d’énergie and bouclier effects: the charge glow growing in Paul's hands (additive blue-white disc), a
 * progress ring around Paul that closes clockwise from 12 o’clock over the charge (chargeRing), the beam (~BEAM_MS, pixel-stepped widths, additive glow, flicker) and, on a bubble block, a spark burst and a
 * short expanding ring at the rim point (BubbleView.hit).
 */
export class SpecialFx {
  private readonly glow: Phaser.GameObjects.Graphics;
  /** The charge's progress ring around Paul (normal blend so its dark track reads on any ground). */
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly beamG: Phaser.GameObjects.Graphics;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private beam: { from: Vec; to: Vec; born: number } | null = null;
  private blocks: Block[] = [];

  constructor(scene: Phaser.Scene) {
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.ring = scene.add.graphics().setVisible(false);
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

  /** The bouclier's bubble stopped something at `pos` (its rim point). */
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
      this.ring.setVisible(false);
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
      .fillCircle(h.x, h.y, Math.max(1, r - 1));
    // progress ring around Paul: dark track, light-blue arc closing clockwise, a bright head
    const arc = chargeRing(p);
    const cx = Math.round(body.x);
    const cy = Math.round(body.y - CHARGE_RING_Y);
    const ring = this.ring.clear().setVisible(true).setDepth(body.depth + 0.1);
    ring.lineStyle(4, INK, 0.6).strokeCircle(cx, cy, arc.radius);
    ring.lineStyle(1, ENERGY, 0.35).strokeCircle(cx, cy, arc.radius);
    if (p > 0) {
      ring.lineStyle(2, ENERGY, 1).beginPath().arc(cx, cy, arc.radius, arc.start, arc.end, false).strokePath();
      ring.fillStyle(ENERGY_CORE, 1).fillCircle(Math.round(cx + Math.cos(arc.end) * arc.radius), Math.round(cy + Math.sin(arc.end) * arc.radius), 2);
    }
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
    this.ring.destroy();
    this.beamG.destroy();
    this.rings.destroy();
    this.sparks.destroy();
  }
}
