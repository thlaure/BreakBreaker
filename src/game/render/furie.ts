import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import { DEPTH } from './depth';
import { auraAlpha } from './furieMath';

const INK = 0x14121c;

/** Polygon points from flat [x0, y0, x1, y1, …] (texture building only). */
function poly(xy: number[]): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push(new Phaser.Math.Vector2(xy[i]!, xy[i + 1]!));
  return out;
}

/** Spiky closed outline around (cx, cy): `n` points alternating long/short, flames longer on the top half. */
function spikes(cx: number, cy: number, rx: number, ry: number, n: number, inner: number, up: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    let r = i % 2 === 0 ? 1 : inner;
    if (Math.sin(a) < 0) r *= 1 + up * -Math.sin(a);
    pts.push(new Phaser.Math.Vector2(Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r)));
  }
  return pts;
}

/**
 * Runtime textures of the mode furie (original pixel art, no image files): `furie_aura` (spiky yellow-white glow drawn
 * additively behind Paul), `weapon_furie` (the pickup: a glowing orb with a lightning bolt) and `pow_burst` (the comic
 * burst behind « POW ! » / « BOUM ! »).
 */
export function makeFurieTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('furie_aura')) return;
  const g = scene.make.graphics({}, false);
  // aura: three nested spiky flames, 40×60, feet at the bottom centre
  g.fillStyle(0xffc21a, 0.55).fillPoints(spikes(20, 38, 17, 20, 18, 0.7, 0.55), true);
  g.fillStyle(0xffe066, 0.6).fillPoints(spikes(20, 39, 13, 16, 14, 0.75, 0.5), true);
  g.fillStyle(0xfff6d0, 0.7).fillPoints(spikes(20, 40, 8, 11, 10, 0.8, 0.4), true);
  g.generateTexture('furie_aura', 40, 60);
  g.clear();
  // pickup orb 18×20: dark outline, yellow body, white core, bolt
  g.fillStyle(INK, 1).fillCircle(9, 10, 9);
  g.fillStyle(0xffc21a, 1).fillCircle(9, 10, 8);
  g.fillStyle(0xffe066, 1).fillCircle(9, 9, 6);
  g.fillStyle(0xfff6d0, 1).fillCircle(7, 7, 2);
  g.fillStyle(INK, 1).fillPoints(poly([10, 3, 5, 11, 9, 11, 7, 17, 13, 8, 9, 8, 11, 3]), true);
  g.fillStyle(0xffffff, 1).fillPoints(poly([10, 5, 7, 10, 10, 10, 9, 14, 12, 9, 10, 9]), true);
  g.generateTexture('weapon_furie', 18, 20);
  g.clear();
  // comic burst 40×24
  g.fillStyle(INK, 1).fillPoints(spikes(20, 12, 20, 12, 16, 0.62, 0), true);
  g.fillStyle(0xffd23a, 1).fillPoints(spikes(20, 12, 17, 10, 16, 0.62, 0), true);
  g.fillStyle(0xfff6d0, 1).fillPoints(spikes(20, 12, 10, 6, 12, 0.75, 0), true);
  g.generateTexture('pow_burst', 40, 24);
  g.destroy();
}

/**
 * Paul's mode furie look: an additive spiky aura behind him (two layers pulsing out of phase), flame-like pixel sparks
 * rising from his body, a thin timer ring at his feet and, in the last 2 s, a fading blink. Built once, reused; no
 * per-frame allocation.
 */
export class FurieAura {
  private readonly outer: Phaser.GameObjects.Image;
  private readonly inner: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private on = false;

  constructor(scene: Phaser.Scene) {
    this.outer = scene.add.image(0, 0, 'furie_aura').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.inner = scene.add.image(0, 0, 'furie_aura').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.ring = scene.add.graphics().setVisible(false);
    this.sparks = scene.add.particles(0, 0, 'px', {
      lifespan: { min: 320, max: 620 },
      speedY: { min: -80, max: -35 },
      speedX: { min: -14, max: 14 },
      x: { min: -9, max: 9 },
      y: { min: -14, max: 14 },
      scale: { start: 2, end: 0.5 },
      tint: [0xffffff, 0xfff3a0, 0xffd23a, 0xffa82e],
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
      quantity: 1,
      emitting: false,
    });
  }

  /** `sprite` = Paul's body sprite (position and depth to follow). */
  update(furie: Snapshot['furie'], sprite: Phaser.GameObjects.Sprite, nowMs: number): void {
    const on = furie !== null;
    if (on !== this.on) {
      this.on = on;
      this.outer.setVisible(on);
      this.inner.setVisible(on);
      this.ring.setVisible(on);
      if (on) this.sparks.start();
      else this.sparks.stop();
    }
    if (!furie) return;
    const a = auraAlpha(furie.secondsLeft, nowMs);
    const x = Math.round(sprite.x);
    const y = Math.round(sprite.y);
    const d = sprite.depth;
    const p1 = Math.sin(nowMs / 85);
    const p2 = Math.sin(nowMs / 85 + 2.1);
    this.outer.setPosition(x, y + 5).setScale(1.25 + 0.08 * p1, 1.15 + 0.1 * p1).setAlpha(0.9 * a).setDepth(d - 0.03);
    this.inner
      .setPosition(x, y + 3)
      .setScale(0.8 + 0.05 * p2, 0.82 + 0.06 * p2)
      .setFlipX(Math.floor(nowMs / 120) % 2 === 0)
      .setAlpha(0.9 * a)
      .setDepth(d - 0.025);
    this.sparks.setPosition(x, y - 18).setDepth(d + 0.05);
    this.sparks.setAlpha(a);
    // timer ring: an ellipse arc at the feet, shrinking with the time left
    const frac = Math.max(0, Math.min(1, furie.secondsLeft / CONFIG.furie.durationSec));
    const start = -Math.PI / 2;
    this.ring
      .clear()
      .setPosition(x, y + 1)
      .setScale(1, 0.45)
      .setDepth(DEPTH.decal + 4)
      .lineStyle(2, 0xffe066, 0.85 * a)
      .beginPath()
      .arc(0, 0, 15, start, start + Math.PI * 2 * frac, false)
      .strokePath();
  }

  destroy(): void {
    this.outer.destroy();
    this.inner.destroy();
    this.ring.destroy();
    this.sparks.destroy();
  }
}

const POW_MS = 450;
const POW_POOL = 8;
const POW_WORDS = ['POW !', 'BOUM !'] as const;

interface Pow {
  root: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  word: string;
  born: number;
  x: number;
  y: number;
}

/** Short pixel « POW ! » / « BOUM ! » bursts on rioters hit during the mode furie (a pool of POW_POOL, oldest reused). */
export class PowBubbles {
  private readonly pool: Pow[] = [];
  private count = 0;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < POW_POOL; i++) {
      const burst = scene.add.image(0, 0, 'pow_burst');
      const text = scene.add
        .text(0, 0, '', { fontFamily: '"Press Start 2P", ui-monospace, monospace', fontSize: '8px', color: '#c4372b' })
        .setOrigin(0.5, 0.5);
      const root = scene.add.container(0, 0, [burst, text]).setDepth(DEPTH.overlay - 1).setVisible(false);
      this.pool.push({ root, text, word: '', born: -Infinity, x: 0, y: 0 });
    }
  }

  spawn(x: number, y: number, nowMs: number): void {
    let p = this.pool[0]!;
    for (const q of this.pool) if (q.born < p.born) p = q;
    const word = POW_WORDS[this.count++ % POW_WORDS.length]!;
    if (word !== p.word) {
      p.word = word;
      p.text.setText(word);
      p.text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    p.born = nowMs;
    p.x = Math.round(x + ((this.count * 7) % 13) - 6);
    p.y = Math.round(y - 40);
    p.root.setVisible(true);
  }

  update(nowMs: number): void {
    for (const p of this.pool) {
      if (!p.root.visible) continue;
      const age = nowMs - p.born;
      if (age >= POW_MS) {
        p.root.setVisible(false);
        continue;
      }
      // pops in (overshoot), holds, rises a little
      const s = age < 90 ? 0.5 + (age / 90) * 0.7 : age < 150 ? 1.2 - ((age - 90) / 60) * 0.2 : 1;
      p.root
        .setPosition(p.x, p.y - Math.round(age / 40))
        .setScale(Math.round(s * 4) / 4)
        .setAlpha(age > POW_MS - 100 ? (POW_MS - age) / 100 : 1);
    }
  }
}
