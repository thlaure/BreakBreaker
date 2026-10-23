import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, TargetId, Vec } from '../../sim/types';
import type { FighterRole } from '../../sim/allies';
import { DEPTH } from './depth';
import {
  ALLY_LOOKS,
  OFFICER_FRAMES,
  facingOf,
  jetPoint,
  officerFrame,
  officerTexture,
  sirenFrame,
  strikeLanded,
  type AllyLook,
  type CapShape,
  type Facing,
  type OfficerFrame,
} from './serviceMath';
import { HpBar } from './targets';
import { hpSegmentFills, hpSegments } from './roleLook';

const OUTLINE = 0x14121c;
/** Logical pixels drawn ×2, like the props. */
const PX = 2;
const FADE_MS = 350;
const STAR_COUNT = 3;
/** Droplets in flight along one water jet. */
const JET_DROPS = 16;
const JET_MS = 420;

type Fill = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;

/** Caps by shape (CapShape): the police képi; the guard's beret, slouched back with a badge at the front. Drawn at `ox` on the 22-px frame. */
const CAP_DRAW: Readonly<Record<CapShape, (r: Fill, look: AllyLook, ox: number, oy: number) => void>> = {
  kepi: (r, look, ox, oy) => {
    r(OUTLINE, ox + 3, oy, 8, 5);
    r(look.capColor, ox + 4, oy + 1, 6, 2);
    r(look.band, ox + 4, oy + 3, 6, 1);
    r(OUTLINE, ox + 8, oy + 4, 4, 1); // visor, facing east
    r(0xffd23f, ox + 6, oy + 1, 2, 1); // badge
  },
  beret: (r, look, ox, oy) => {
    r(OUTLINE, ox + 1, oy + 1, 10, 4);
    r(OUTLINE, ox + 2, oy, 7, 1);
    r(look.capColor, ox + 2, oy + 2, 8, 2);
    r(look.capColor, ox + 3, oy + 1, 5, 1);
    r(0xffffff, ox + 3, oy + 1, 2, 1, 0.35); // sheen on the felt
    r(OUTLINE, ox + 3, oy + 4, 8, 1); // headband
    r(look.band, ox + 8, oy + 2, 2, 2); // badge at the front
  },
};

/**
 * Runtime textures of the emergency services: the fire truck (`truck_<east|south|north>_<0|1>`, two siren-light frames;
 * west = east flipped), officers per role (`ally_<role>_<frame>`, 22 × 22 logical, facing east), the stun star and the
 * hit spark.
 */
export function makeServiceTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('truck_east_0')) return;
  const g = scene.make.graphics({}, false);
  const r: Fill = (c, x, y, w, h, a = 1) => {
    g.fillStyle(c, a).fillRect(x, y, w, h);
  };
  const RED = 0xd8312a;
  const RED_HI = 0xf2675a;
  const RED_LO = 0x9a2020;
  const GLASS = 0x9fd8ef;
  const lamp = (on: boolean): number => (on ? 0x8adcff : 0x24407a);
  const wheel = (x: number, y: number): void => {
    r(OUTLINE, x + 1, y, 6, 8);
    r(OUTLINE, x, y + 1, 8, 6);
    r(0x1d1a24, x + 1, y + 1, 6, 6);
    r(0x9aa0aa, x + 3, y + 3, 2, 2);
  };

  for (const f of [0, 1] as const) {
    // side view facing east (40 × 24): long red body, white stripe, ladder on the roof, cab at the front, blue lights
    g.clear();
    r(OUTLINE, 0, 4, 40, 16);
    r(RED, 1, 5, 27, 14);
    r(RED_HI, 1, 5, 27, 1);
    r(RED_LO, 1, 17, 27, 2);
    r(0xf4f4f0, 1, 12, 38, 2); // stripe
    for (let k = 0; k < 3; k++) {
      r(RED_LO, 3 + k * 8, 7, 7, 4); // locker doors
      r(RED_HI, 3 + k * 8, 7, 7, 1);
    }
    // ladder
    r(OUTLINE, 2, 1, 26, 4);
    r(0xb8bcc4, 3, 2, 24, 1);
    for (let k = 0; k < 7; k++) r(0xb8bcc4, 4 + k * 3, 3, 1, 1);
    // cab
    r(OUTLINE, 28, 2, 12, 18);
    r(RED, 29, 3, 10, 16);
    r(RED_HI, 29, 3, 10, 1);
    r(GLASS, 32, 5, 7, 5);
    r(0xe6f7ff, 33, 5, 2, 1);
    r(OUTLINE, 31, 5, 1, 9); // door seam
    r(0xffe066, 38, 15, 2, 2); // headlight
    r(0x9aa0aa, 38, 18, 2, 1); // bumper
    // light bar on the cab roof
    r(OUTLINE, 30, 0, 9, 3);
    r(lamp(f === 0), 31, 1, 3, 1);
    r(lamp(f === 1), 35, 1, 3, 1);
    wheel(5, 16);
    wheel(30, 16);
    wheel(16, 16);
    g.generateTexture(`truck_east_${f}`, 40, 24);

    // front view, driving south (24 × 28): cab face, windshield, grille, headlights, lights, ladder tip above
    g.clear();
    r(OUTLINE, 1, 4, 22, 22);
    r(RED, 2, 5, 20, 20);
    r(RED_HI, 2, 5, 20, 1);
    r(OUTLINE, 3, 0, 18, 5);
    r(lamp(f === 0), 4, 1, 6, 2);
    r(lamp(f === 1), 14, 1, 6, 2);
    r(0xf4f4f0, 10, 1, 4, 2);
    r(GLASS, 4, 7, 16, 6);
    r(0xe6f7ff, 5, 7, 3, 1);
    r(OUTLINE, 11, 7, 2, 6);
    r(0xf4f4f0, 2, 15, 20, 2);
    r(0x3a3438, 7, 18, 10, 4); // grille
    for (let k = 0; k < 4; k++) r(0x6d6a72, 8 + k * 2, 19, 1, 2);
    r(0xffe066, 3, 18, 3, 3);
    r(0xffe066, 18, 18, 3, 3);
    r(0x9aa0aa, 1, 23, 22, 2);
    r(OUTLINE, 2, 25, 5, 3);
    r(OUTLINE, 17, 25, 5, 3);
    g.generateTexture(`truck_south_${f}`, 24, 28);

    // back view, driving north (24 × 28): rear roller door, ladder ends, tail lights, lights on the far roof
    g.clear();
    r(OUTLINE, 1, 4, 22, 22);
    r(RED, 2, 5, 20, 20);
    r(OUTLINE, 3, 0, 18, 5);
    r(lamp(f === 1), 4, 1, 6, 2);
    r(lamp(f === 0), 14, 1, 6, 2);
    r(0xb8bcc4, 6, 3, 2, 12); // ladder rails
    r(0xb8bcc4, 16, 3, 2, 12);
    for (let k = 0; k < 4; k++) r(0xb8bcc4, 8, 4 + k * 3, 8, 1);
    r(RED_LO, 4, 15, 16, 7); // roller door
    for (let k = 0; k < 3; k++) r(RED, 4, 16 + k * 2, 16, 1);
    r(0xf4f4f0, 2, 13, 20, 1);
    r(0xff3b30, 2, 21, 2, 3);
    r(0xff3b30, 20, 21, 2, 3);
    r(OUTLINE, 2, 25, 5, 3);
    r(OUTLINE, 17, 25, 5, 3);
    g.generateTexture(`truck_north_${f}`, 24, 28);
  }

  // foot allies, one set per role (ALLY_LOOKS), 22 × 22 frames, figure centred, facing east
  const SKIN = 0xf2c29a;
  for (const [role, look] of Object.entries(ALLY_LOOKS) as [FighterRole, AllyLook][]) {
    for (const frame of OFFICER_FRAMES) {
      g.clear();
      if (frame === 'down') {
        // lying on the back, head west, cap fallen beside him
        r(OUTLINE, 1, 14, 20, 7);
        r(SKIN, 2, 15, 4, 4);
        r(OUTLINE, 4, 16, 1, 1);
        r(look.uniform, 6, 15, 8, 5);
        r(look.uniformHi, 6, 15, 8, 1);
        r(OUTLINE, 6, 18, 8, 1); // belt
        r(look.trousers, 14, 15, 6, 5);
        r(OUTLINE, 19, 14, 2, 3); // shoes up
        r(OUTLINE, 0, 10, 6, 4);
        r(look.capColor, 1, 11, 4, 2);
        r(look.band, 1, 12, 4, 1);
        if (look.baton !== null) r(look.baton, 13, 21, 8, 1);
        if (look.keys !== null) r(look.keys, 12, 19, 2, 2);
        g.generateTexture(officerTexture(role, frame), 22, 22);
        continue;
      }
      const ox = 4;
      const step = frame === 'walk1' ? 1 : 0;
      // legs (a step apart on walk1) and shoes
      r(OUTLINE, ox + 3, 14, 8, 7);
      r(look.trousers, ox + 4, 14, 2, 6 - step);
      r(look.trousers, ox + 8, 14, 2, 6 - (1 - step));
      r(OUTLINE, ox + 3 + step, 20 - step, 4, 2);
      r(OUTLINE, ox + 7 - step, 20 - (1 - step), 5, 2);
      // torso, belt, badge
      r(OUTLINE, ox + 2, 8, 10, 7);
      r(look.uniform, ox + 3, 9, 8, 5);
      r(look.uniformHi, ox + 3, 9, 8, 1);
      r(look.uniformLo, ox + 3, 13, 8, 1);
      r(OUTLINE, ox + 3, 13, 8, 1);
      r(0xffd23f, ox + 8, 10, 1, 1);
      if (look.shoulder !== null) {
        r(look.shoulder, ox + 3, 9, 2, 1); // shoulder boards
        r(look.shoulder, ox + 9, 9, 2, 1);
      }
      if (look.keys !== null) {
        r(look.keys, ox + 4, 14, 2, 2); // key ring at the belt
        r(OUTLINE, ox + 5, 15, 1, 1);
      }
      // head
      r(OUTLINE, ox + 3, 3, 8, 6);
      r(SKIN, ox + 4, 4, 6, 4);
      r(OUTLINE, ox + 8, 5, 1, 1); // eye
      r(0xd88a6a, ox + 9, 7, 1, 1); // nose / cheek
      CAP_DRAW[look.cap](r, look, ox, 0);
      if (frame === 'strike') {
        // baton raised high behind the head, arm up
        r(OUTLINE, ox + 10, 3, 3, 7);
        r(look.uniform, ox + 11, 4, 1, 5);
        if (look.baton !== null) {
          r(SKIN, ox + 11, 3, 1, 1);
          r(look.baton, ox + 9, 0, 2, 4);
          r(look.baton, ox + 11, 0, 4, 2);
        } else {
          // bare hands: a raised fist
          r(OUTLINE, ox + 10, 0, 4, 4);
          r(SKIN, ox + 11, 1, 2, 2);
        }
      } else {
        // arm swinging, baton hanging from the hand
        const sw = frame === 'walk1' ? 1 : 0;
        r(OUTLINE, ox + 10, 9, 3, 5);
        r(look.uniform, ox + 11, 9, 1, 4);
        r(SKIN, ox + 11, 13 - sw, 1, 1);
        if (look.baton !== null) r(look.baton, ox + 12, 12 - sw, 1, 6);
      }
      g.generateTexture(officerTexture(role, frame), 22, 22);
    }
  }

  // stun star (5 × 5) and the baton's hit spark (9 × 9)
  g.clear();
  r(0xffe066, 2, 0, 1, 5);
  r(0xffe066, 0, 2, 5, 1);
  r(0xfff6d0, 1, 1, 3, 3);
  r(0xffe066, 2, 2, 1, 1);
  g.generateTexture('stun_star', 5, 5);
  g.clear();
  r(0xffffff, 4, 0, 1, 9);
  r(0xffffff, 0, 4, 9, 1);
  r(0xffe066, 1, 1, 1, 1);
  r(0xffe066, 7, 1, 1, 1);
  r(0xffe066, 1, 7, 1, 1);
  r(0xffe066, 7, 7, 1, 1);
  r(0xffe066, 3, 3, 3, 3);
  r(0xffffff, 4, 4, 1, 1);
  g.generateTexture('hit_spark', 9, 9);
  g.destroy();
}

type TruckSnap = NonNullable<Snapshot['allies']['truck']>;
type OfficerSnap = Snapshot['allies']['police'][number];

/** The fire truck: sprite by facing with flashing lights, hp bar, water jets to every burning door in reach while parked. */
class TruckView {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bar: HpBar;
  private readonly jets: Phaser.GameObjects.Graphics;
  private facing: Facing = 'east';
  private last: Vec | null = null;
  private gone = true;
  private fadeFrom = 0;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 0, 60, 14, 0x000000, 0.25).setDepth(DEPTH.decal).setVisible(false);
    this.sprite = scene.add.image(0, 0, 'truck_east_0').setOrigin(0.5, 1).setScale(PX).setVisible(false);
    this.bar = new HpBar(scene, 0, 0, 36, 8);
    this.jets = scene.add.graphics().setDepth(DEPTH.roof + 3);
  }

  /** Destroyed: gone at once (the layer's smoke takes its place), no fade. */
  vanish(): void {
    this.gone = true;
    this.fadeFrom = -Infinity;
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
  }

  update(t: TruckSnap | null, s: Snapshot, nowMs: number, dtMs: number): void {
    this.jets.clear();
    if (!t) {
      this.bar.update(1, false, nowMs, dtMs);
      if (!this.gone) {
        this.gone = true;
        this.fadeFrom = nowMs;
      }
      const a = 1 - (nowMs - this.fadeFrom) / FADE_MS;
      this.sprite.setVisible(a > 0).setAlpha(Math.max(0, a));
      this.shadow.setVisible(a > 0);
      this.last = null;
      return;
    }
    if (this.gone) {
      this.gone = false;
      this.sprite.setAlpha(1);
    }
    const d = this.last ? { x: t.pos.x - this.last.x, y: t.pos.y - this.last.y } : { x: 0, y: 0 };
    this.last = { ...t.pos };
    this.facing = facingOf(d, this.facing);
    const dir = this.facing === 'west' ? 'east' : this.facing;
    const y = Math.round(t.pos.y + 10);
    this.sprite
      .setTexture(`truck_${dir}_${sirenFrame(nowMs)}`)
      .setFlipX(this.facing === 'west')
      .setPosition(Math.round(t.pos.x), y)
      .setDepth(y)
      .setVisible(true);
    this.shadow
      .setPosition(t.pos.x, y - 2)
      .setSize(dir === 'east' ? 72 : 44, 14)
      .setVisible(true);
    const h = this.sprite.displayHeight;
    this.bar.moveTo(t.pos.x, y - h - 12);
    this.bar.update(t.hp / t.maxHp, t.hp < t.maxHp, nowMs, dtMs);
    if (t.state === 'spraying') this.spray(t, s, nowMs, y - h + 8);
  }

  /** A jet from the roof nozzle to every burning door within sprayRadius: droplets along an arc, a splash at the end. */
  private spray(t: TruckSnap, s: Snapshot, nowMs: number, nozzleY: number): void {
    const reach = CONFIG.services.truck.sprayRadius;
    for (const tg of s.targets) {
      if (!tg.burning) continue;
      const door = DOORS.get(tg.id);
      if (!door || Math.hypot(door.x - t.pos.x, door.y - t.pos.y) > reach + 1e-6) continue;
      // the nozzle on the roof end facing the fire; the jet lands on the flames, above the door
      const from = { x: t.pos.x + Math.sign(door.x - t.pos.x) * 14, y: nozzleY };
      const to = { x: door.x, y: door.y - 22 };
      const lift = 16 + Math.min(24, Math.hypot(to.x - from.x, to.y - from.y) / 3);
      for (let i = 0; i < JET_DROPS; i++) {
        const k = (nowMs / JET_MS + i / JET_DROPS) % 1;
        const p = jetPoint(from, to, k, lift);
        const x = Math.round(p.x / PX) * PX;
        const y = Math.round(p.y / PX) * PX;
        const big = i % 2 === 0;
        this.jets.fillStyle(0x1f5ab0, 1).fillRect(x, y + PX, PX * 2, PX);
        this.jets.fillStyle(i % 3 === 0 ? 0xffffff : 0x6ac8ff, 1).fillRect(x, y, PX * (big ? 2 : 1) + (big ? 0 : PX), PX);
      }
      // splash on the flames: flickering white drops and a little mist
      this.jets.fillStyle(0xe6f7ff, 0.35).fillEllipse(to.x, to.y + 2, 18, 8);
      for (let i = 0; i < 6; i++) {
        const a = nowMs / 80 + i * 1.3;
        this.jets
          .fillStyle(0xffffff, 0.9)
          .fillRect(Math.round(to.x + Math.cos(a) * 9), Math.round(to.y - Math.abs(Math.sin(a)) * 8), PX, PX);
      }
    }
  }
}

/** Every target's door, for the jets. */
const DOORS = new Map<TargetId, Vec>(DISTRICT.targets.map((t) => [t.id, t.door]));

/** Segmented bar of a foot ally with several hp (a prison guard): the Caïd's bar (one segment per 2 hp), in green. */
const SEG_W = 2;
const SEG_H = 4;
const SEG_FILL = 0x5ee07a;
const SEG_TRACK = 0x3a3448;

class SegBar {
  readonly g: Phaser.GameObjects.Graphics;
  private drawn = -1;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add
      .graphics()
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
  }

  update(hp: number, maxHp: number, cx: number, top: number, visible: boolean): void {
    this.g.setVisible(visible);
    if (!visible) return;
    const n = hpSegments(maxHp);
    const w = n * (SEG_W + 1) + 1;
    this.g.setPosition(Math.round(cx - w / 2), Math.round(top));
    const key = hp * 1000 + maxHp;
    if (key === this.drawn) return;
    this.drawn = key;
    this.g.clear().fillStyle(OUTLINE, 1).fillRect(0, 0, w, SEG_H);
    const fills = hpSegmentFills(hp, maxHp, SEG_W);
    for (let i = 0; i < n; i++) {
      const sx = 1 + i * (SEG_W + 1);
      this.g.fillStyle(SEG_TRACK, 1).fillRect(sx, 1, SEG_W, SEG_H - 2);
      if (fills[i]! > 0) this.g.fillStyle(SEG_FILL, 1).fillRect(sx, 1, fills[i]!, SEG_H - 2);
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}

/**
 * One officer: role look, walk / strike / down frames, stun stars while down; an ally with several hp (a prison guard:
 * a Caïd's hp) always shows a segmented bar like the Caïd's while up.
 */
class OfficerView {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly bar: SegBar;
  private last: Vec;
  private flip = false;
  prevState: string | undefined;
  goneAt: number | null = null;

  constructor(scene: Phaser.Scene, o: OfficerSnap) {
    this.sprite = scene.add.image(o.pos.x, o.pos.y, officerTexture(o.role, 'walk0')).setOrigin(0.5, 1).setScale(PX);
    for (let i = 0; i < STAR_COUNT; i++) this.stars.push(scene.add.image(0, 0, 'stun_star').setScale(PX).setVisible(false));
    this.bar = new SegBar(scene);
    this.last = { ...o.pos };
  }

  update(o: OfficerSnap, nowMs: number): void {
    const dx = o.pos.x - this.last.x;
    const moving = Math.hypot(dx, o.pos.y - this.last.y) > 0.05;
    if (Math.abs(dx) > 0.05) this.flip = dx < 0;
    this.last = { ...o.pos };
    const frame: OfficerFrame = officerFrame(o.state, moving, nowMs);
    const x = Math.round(o.pos.x);
    const y = Math.round(o.pos.y + 6);
    this.sprite.setTexture(officerTexture(o.role, frame)).setFlipX(this.flip).setPosition(x, y).setDepth(y).setAlpha(1);
    const down = o.state === 'down';
    this.stars.forEach((s, i) => {
      const a = nowMs / 220 + (i * Math.PI * 2) / STAR_COUNT;
      s.setVisible(down)
        .setPosition(Math.round(x - 10 + Math.cos(a) * 10), Math.round(y - 18 + Math.sin(a) * 3))
        .setDepth(y + 0.1);
    });
    this.bar.update(o.hp, o.maxHp, x, y - 50, !down && o.maxHp > 1);
  }

  fade(nowMs: number): boolean {
    this.goneAt ??= nowMs;
    const a = 1 - (nowMs - this.goneAt) / FADE_MS;
    this.sprite.setAlpha(Math.max(0, a));
    for (const s of this.stars) s.setAlpha(Math.max(0, a));
    this.bar.update(0, 1, 0, 0, false);
    return a > 0;
  }

  destroy(): void {
    this.sprite.destroy();
    for (const s of this.stars) s.destroy();
    this.bar.destroy();
  }
}

/**
 * The emergency services on the map (Snapshot.allies): the fire truck and its water, the police officers and the
 * prison's guards (Snapshot.prison.guards; role looks, a bar for the guards' several hp), a spark when a blow lands (the sim sends no HitConfirmed for it), smoke when the truck is destroyed.
 */
export class ServicesLayer {
  private readonly truck: TruckView;
  private readonly officers = new Map<number, OfficerView>();
  private readonly sparks: { img: Phaser.GameObjects.Image; born: number }[] = [];
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkNext = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly pow: (x: number, y: number, nowMs: number) => void,
  ) {
    this.truck = new TruckView(scene);
    for (let i = 0; i < 6; i++)
      this.sparks.push({ img: scene.add.image(0, 0, 'hit_spark').setScale(PX).setDepth(DEPTH.overlay).setVisible(false), born: -Infinity });
    this.smoke = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 1200, max: 2200 },
        speedY: { min: -50, max: -20 },
        speedX: { min: -20, max: 20 },
        scale: { start: 4, end: 12 },
        tint: [0x2e2b33, 0x4a4650, 0x6d6a72],
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
    this.debris = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 60, max: 160 },
        angle: { min: 200, max: 340 },
        gravityY: 240,
        scale: { start: 2, end: 1 },
        tint: [0xd8312a, 0x9aa0aa, 0xff9a2e, 0x14121c],
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
  }

  update(s: Snapshot, nowMs: number, dtMs: number): void {
    this.truck.update(s.ended ? null : s.allies.truck, s, nowMs, dtMs);
    const seen = new Set<number>();
    // the police group's officers and the prison's guards (same foot brain, their own look); a guard's blow lands like
    // an officer's (spark + « PAF ! »)
    const guards = s.prison.guards.map((g): OfficerSnap => ({ ...g, role: 'guard' }));
    for (const o of [...s.allies.police, ...guards]) {
      seen.add(o.id);
      let v = this.officers.get(o.id);
      if (!v) {
        v = new OfficerView(this.scene, o);
        this.officers.set(o.id, v);
      }
      const at = strikeLanded(v.prevState, o.state, o.pos, s.hostiles, CONFIG.services.police.hitRange + 4);
      if (at) this.hit(at, nowMs);
      v.prevState = o.state;
      v.update(o, nowMs);
    }
    for (const [id, v] of this.officers) {
      if (seen.has(id)) continue;
      if (!v.fade(nowMs)) {
        v.destroy();
        this.officers.delete(id);
      }
    }
    for (const sp of this.sparks) {
      const age = nowMs - sp.born;
      if (!sp.img.visible) continue;
      if (age > 220) sp.img.setVisible(false);
      else sp.img.setScale(PX * (age < 80 ? 1 + age / 80 : 2 - (age - 80) / 140)).setAlpha(age < 120 ? 1 : 1 - (age - 120) / 100);
    }
  }

  onEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'TruckDestroyed') {
        this.truck.vanish();
        this.smoke.emitParticleAt(e.pos.x, e.pos.y - 10, 24);
        this.debris.emitParticleAt(e.pos.x, e.pos.y - 10, 20);
      }
    }
  }

  /** The baton lands: a white-yellow spark on the rioter and a small « PAF ! ». */
  private hit(at: Vec, nowMs: number): void {
    const sp = this.sparks[this.sparkNext++ % this.sparks.length]!;
    sp.born = nowMs;
    sp.img
      .setPosition(Math.round(at.x), Math.round(at.y - 24))
      .setVisible(true)
      .setAlpha(1)
      .setScale(PX);
    this.pow(at.x, at.y, nowMs);
  }
}
