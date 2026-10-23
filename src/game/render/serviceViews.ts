import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { TargetId, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { facingOf, jetPoint, officerFrame, officerTexture, sirenFrame, type Facing, type OfficerFrame } from './serviceMath';
import { HpBar } from './targetHpBar';
import { hpSegmentFills, hpSegments } from './roleLook';

const OUTLINE = 0x14121c;
/** Logical pixels drawn ×2, like the props. */
const PX = 2;
const FADE_MS = 350;
const STAR_COUNT = 3;
/** Droplets in flight along one water jet. */
const JET_DROPS = 16;
const JET_MS = 420;

type TruckSnap = NonNullable<Snapshot['allies']['truck']>;
export type OfficerSnap = Snapshot['allies']['police'][number];

/** The fire truck: sprite by facing with flashing lights, hp bar, water jets to every burning door in reach while parked. */
export class TruckView {
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
export class OfficerView {
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
