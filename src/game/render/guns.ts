import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { bulletDash, gloveActive, gloveExtent, riflePose, springPoints } from './gunMath';

type HostileSnap = Snapshot['hostiles'][number];

const PAL: Record<string, number> = {
  K: 0x14121c,
  G: 0x3a3448,
  D: 0x5b6472,
  S: 0xb8c0cc,
  W: 0xf4f1e8,
  R: 0xd23b3b,
  H: 0xff7a6e,
  O: 0xff9a2e,
  Y: 0xffd166,
  B: 0x6b4423,
};

/** Cartoon AK (pointing right, 16×6): dark wooden stock, grey body, curved magazine. */
const RIFLE = [
  '..............K.',
  'KKKKKKKKKKKKKKKK',
  'KBBBKGGGGGGGGGGK',
  'KBBKKGKGKKKKKKKK',
  'KBK.KGKKGK......',
  'KK...KK.KK......',
];
/** The boxing glove at the end of its spring (pointing right, 10×8): white cuff, red glove. */
const FIST = ['..KKKKK...', '.KRRRRRK..', 'KWKRHHRRK.', 'KWKRHRRRRK', 'KWKRRRRRRK', 'KWKRRRRRK.', '.KKRRRRK..', '...KKKK...'];
/** Pickup: the glove on its coiled spring and base (12×15). */
const GANT = [
  '..KKKKKK....',
  '.KRRHHRRK...',
  'KRRHRRRRRK..',
  'KRRRRRRRRKK.',
  'KRRRRRRRKRK.',
  'KRRRRRRRKRK.',
  '.KRRRRRRRK..',
  '..KWWWWWK...',
  '..KKKKKKK...',
  '....KSK.....',
  '...KSK......',
  '....KSK.....',
  '...KSK......',
  '..KDDDDK....',
  '..KKKKKK....',
];
/** Pickup: the chunky cartoon flashball launcher (18×9), orange muzzle. */
const FLASHBALL = [
  'KKKKKKKKKKKKKKKKK.',
  'KGGGGGGGGGGGGGOOK.',
  'KGDDDDDDDDDDDGOYK.',
  'KGGGGGGGGGGGGGOOK.',
  'KKKKGGKKKKKKKKKKK.',
  '...KGGK...........',
  '...KGGK...........',
  '..KGGGK...........',
  '..KKKKK...........',
];

/**
 * Runtime pixel textures of phase B's guns: `rifle` (a shooter's), `glove_fist` (the punch), and the pickups
 * `weapon_gant` / `weapon_flashball` (also drawn in Paul's hand).
 */
export function makeGunTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('rifle')) return;
  const g = scene.make.graphics({}, false);
  for (const [key, rows] of [
    ['rifle', RIFLE],
    ['glove_fist', FIST],
    ['weapon_gant', GANT],
    ['weapon_flashball', FLASHBALL],
  ] as const) {
    g.clear();
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = PAL[row[x]!];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      }
    });
    g.generateTexture(key, rows[0]!.length, rows.length);
  }
  g.destroy();
}

/**
 * A shooter's cartoon rifle: lowered at its side, raised along its aim line while it aims or fires (with the « ! » over
 * its head); hidden on a KO body. No blood, no casings.
 */
export class RifleProp {
  private readonly rifle: Phaser.GameObjects.Image;
  private readonly bang: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.rifle = scene.add.image(0, 0, 'rifle').setOrigin(0.3, 0.5);
    this.bang = scene.add.image(0, 0, 'bang').setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.overlay);
  }

  update(h: HostileSnap, depth: number, nowMs: number): void {
    const ko = h.state === 'ko';
    this.rifle.setVisible(!ko);
    this.bang.setVisible(!ko && h.aiming);
    if (ko) return;
    const pose = riflePose(h.facing, h.aiming);
    const x = Math.round(h.pos.x + pose.side * (h.aiming ? 4 : 7));
    const y = Math.round(h.pos.y - (h.aiming ? 22 : 16));
    this.rifle
      .setPosition(x, y)
      .setAngle(pose.angle)
      .setFlipY(pose.flipY)
      .setDepth(depth + (h.facing.y < 0 ? -0.04 : 0.04));
    if (h.aiming) this.bang.setPosition(Math.round(h.pos.x), Math.round(h.pos.y - 66 - 2 * Math.abs(Math.sin(nowMs / 110))));
  }

  destroy(): void {
    this.rifle.destroy();
    this.bang.destroy();
  }
}

/**
 * Bullets in flight as small yellow dashes along their direction, flashball shots as orange balls with a short trail;
 * a yellow muzzle puff where a bullet / shot leaves the barrel and a spark where one stops against a wall.
 */
export class BulletLayer {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly puff: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly spark: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.overlay - 2);
    this.puff = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 90, max: 180 },
        speed: { min: 10, max: 40 },
        scale: { start: 2, end: 0.4 },
        tint: [0xfff6d0, 0xffe066, 0xffd166],
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.overlay - 1);
    this.spark = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 120, max: 260 },
        speed: { min: 30, max: 90 },
        scale: { start: 1.2, end: 0.2 },
        tint: [0xffffff, 0xffe066, 0xcfc6b4],
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.overlay - 1);
  }

  /** Muzzle puffs and impact sparks of a frame's events (`snap` = this frame's snapshot, for the new bullets). */
  onEvents(events: readonly SimEvent[], snap: Snapshot): void {
    for (const e of events) {
      if (e.type === 'BulletFired') {
        const b = snap.bullets.find((x) => x.id === e.id);
        if (b) this.puff.emitParticleAt(b.pos.x, b.pos.y - 16, 4);
      } else if (e.type === 'FlashballFired') this.puff.emitParticleAt(e.from.x + e.dir.x * 12, e.from.y - 14 + e.dir.y * 12, 6);
      else if (e.type === 'BulletImpact') this.spark.emitParticleAt(e.pos.x, e.pos.y - 12, 5);
    }
  }

  update(snap: Snapshot): void {
    const g = this.g.clear();
    // drawn at chest height (the sim position is on the ground line)
    const lift = 16;
    for (const b of snap.bullets) {
      const { tail, head } = bulletDash(b.pos, b.dir);
      g.lineStyle(2, 0xffd166, 1).lineBetween(Math.round(tail.x), Math.round(tail.y - lift), Math.round(head.x), Math.round(head.y - lift));
      g.fillStyle(0xfff6d0, 1).fillRect(Math.round(head.x) - 1, Math.round(head.y - lift) - 1, 2, 2);
    }
    for (const f of snap.flashballs) {
      const x = Math.round(f.pos.x);
      const y = Math.round(f.pos.y - 14);
      g.lineStyle(2, 0xff9a2e, 0.45).lineBetween(Math.round(x - f.dir.x * 10), Math.round(y - f.dir.y * 10), x, y);
      g.fillStyle(0x14121c, 1).fillCircle(x, y, 4);
      g.fillStyle(0xff9a2e, 1).fillCircle(x, y, 3);
      g.fillStyle(0xfff6d0, 1).fillRect(x - 1, y - 2, 2, 1);
    }
  }
}

interface Punch {
  from: Vec;
  to: Vec;
  born: number;
  spring: Phaser.GameObjects.Graphics;
  fist: Phaser.GameObjects.Image;
}

const PUNCH_POOL = 3;
/** Glove drawn at Paul's hand height. */
const HAND_LIFT = 14;

/**
 * The spring-loaded glove: on GlovePunched the glove shoots out to the rioter hit (or its reach) on a zigzag spring
 * (gunMath.gloveExtent: GLOVE_OUT_MS out with an overshoot, then back), from a pool of PUNCH_POOL.
 */
export class GloveFx {
  private readonly pool: Punch[] = [];

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < PUNCH_POOL; i++)
      this.pool.push({
        from: { x: 0, y: 0 },
        to: { x: 0, y: 0 },
        born: -Infinity,
        spring: scene.add.graphics().setVisible(false),
        fist: scene.add.image(0, 0, 'glove_fist').setVisible(false),
      });
  }

  punch(from: Vec, to: Vec, nowMs: number): void {
    let p = this.pool[0]!;
    for (const q of this.pool) if (q.born < p.born) p = q;
    p.from = { ...from };
    p.to = { ...to };
    p.born = nowMs;
  }

  update(nowMs: number): void {
    for (const p of this.pool) {
      const age = nowMs - p.born;
      if (!gloveActive(age)) {
        p.spring.setVisible(false);
        p.fist.setVisible(false);
        continue;
      }
      const k = gloveExtent(age);
      const a = { x: p.from.x, y: p.from.y - HAND_LIFT };
      const b = { x: p.from.x + (p.to.x - p.from.x) * k, y: p.from.y - HAND_LIFT + (p.to.y - p.from.y) * k };
      const pts = springPoints(a, b, 5, 3);
      const depth = Math.max(p.from.y, b.y + HAND_LIFT) + 0.5;
      p.spring.clear().setVisible(true).setDepth(depth).lineStyle(1, 0xb8c0cc, 1);
      p.spring.beginPath();
      p.spring.moveTo(pts[0]!.x, pts[0]!.y);
      for (const q of pts.slice(1)) p.spring.lineTo(q.x, q.y);
      p.spring.strokePath();
      const ang = (Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x) * 180) / Math.PI;
      p.fist
        .setVisible(true)
        .setPosition(Math.round(b.x), Math.round(b.y))
        .setAngle(ang)
        .setFlipY(p.to.x < p.from.x)
        .setDepth(depth + 0.01);
    }
  }
}
