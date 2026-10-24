import Phaser from 'phaser';
import type { Dir } from '../assets';
import type { Snapshot } from '../../sim/sim';
import type { Fall, Launch, Vec } from '../../sim/types';
import { CharView, FEET_ORIGIN_Y, dirOf, idleFrame, koFrame, windupFrame } from './charView';
import { DEPTH } from './depth';
import {
  CAN_ROWS,
  CAN_SCALE,
  LEGS_ORIGIN_Y,
  LEGS_ROW,
  LEGS_TUCK,
  MAX_FALLS,
  SPIN_LIFT,
  SPIN_ORIGIN_Y,
  TRAIL_MS,
  type Falling,
  type Flight,
  type LaunchCtx,
} from './fallKit';
import { FALL_SPECS, fallPose, fallTravel, pickWord } from './fallMath';
import { edgeExit, landingDistance, launchPose, satelliteDelay, satellitePose } from './furieMath';
import { RifleProp } from './guns';
import { CaidLookView } from './caidProps';
import { caidSkinOf } from './caidSkin';
import { BottleProp, RoleBadge } from './rioterProps';
import { flagFor, themedSheet } from '../../events';
import { SKULL_FLAG_TEXTURE } from '../../events/halloween/textures';
import { DUST_MS, badgeOf, rioterSheet, roleScale } from './roleLook';
import { MAX_SATELLITES } from './satellite';

type HostileSnap = Snapshot['hostiles'][number];

/** The rioter's sheet: his variant's, or under an event its themed twin when that one was loaded. */
function sheetOf(scene: Phaser.Scene, h: HostileSnap): string {
  const plain = rioterSheet(h.variant, h.role, h.lifeId);
  const themed = themedSheet(plain, h.role, h.lifeId);
  return scene.textures.exists(themed) ? themed : plain;
}

/**
 * Rioter: sheet by variant (_a/_b by lifeId parity), optional flag prop above the shoulder, Molotov bottle; a Caïd wears
 * one of the five leader looks (caidSkin.ts) with its prop and slogans (CaidLookView), never a flag. A body
 * launched in mode furie flies off spinning (ease-out travel, arc, squash, star/dust trail) above everything, then
 * lies where it landed (inside the world, never in a wall) like any KO body. A body « satellisé » by the onde d’énergie
 * is shot into the sky along the beam (ease-in, spinning, shrinking, star trail, never clamped to the map), twinkles
 * where it vanishes (if on screen) and is destroyed: no body left lying.
 */
export class HostileView {
  readonly view: CharView;
  private readonly flag: Phaser.GameObjects.Image | null;
  private readonly pole: Phaser.GameObjects.Rectangle | null;
  private readonly bottle: BottleProp | null;
  /** A shooter's cartoon rifle (and its « ! » while aiming). */
  private readonly rifle: RifleProp | null;
  private flight: Flight | null = null;
  private falling: Falling | null = null;
  /** Lying offset (px) left by a fall's travel, kept while the body lies. */
  private restX = 0;
  private restY = 0;
  /** Satellite gone: the sprites are destroyed, nothing more is drawn. */
  private gone = false;
  /** The satellite counter this body takes a slot of while it flies (released when it vanishes or is removed). */
  private slot: { flying: number } | null = null;
  /** Satellite: last drawn point (edge crossing) and whether its one twinkle was shown. */
  private lastPt: Vec | null = null;
  private twinkled = false;
  /** Sprite scale of the role (brute ×1.25, Caïd ×1.5). */
  private readonly size: number;
  private readonly role: RoleBadge | null;
  /** The Caïd's look: his prop and his slogans (null for every other role). */
  private readonly caid: CaidLookView | null;
  private lastDust = 0;

  constructor(scene: Phaser.Scene, h: HostileSnap) {
    this.view = new CharView(scene, sheetOf(scene, h), h.pos);
    this.size = roleScale(h.role);
    this.view.sprite.setScale(this.size);
    this.role = badgeOf(h.role) ? new RoleBadge(scene, h.role, this.size) : null;
    // the Caïd carries his look's prop, never a flag
    const kind = flagFor(h.role, h.lifeId);
    const flagFrame = kind !== 'variant' ? -1 : h.variant === 'palestinian' ? 1 : h.variant === 'antifa' ? 2 : -1;
    this.flag =
      kind === 'skull'
        ? scene.add.image(0, 0, SKULL_FLAG_TEXTURE).setOrigin(0, 1)
        : flagFrame >= 0
          ? scene.add.image(0, 0, 'flags', flagFrame).setOrigin(0, 1)
          : null;
    this.pole = this.flag ? scene.add.rectangle(0, 0, 1, 22, 0x5a4632).setOrigin(0.5, 1) : null;
    this.bottle = h.role === 'molotov' || h.role === 'firebomber' ? new BottleProp(scene) : null;
    this.rifle = h.role === 'shooter' ? new RifleProp(scene) : null;
    this.caid = h.role === 'boss' ? new CaidLookView(scene, caidSkinOf(h.lifeId), this.size) : null;
  }

  /** `index` = rank of this body among the satellites of one beam (take-off stagger, see satelliteDelay). */
  launch(from: Vec, launch: Launch, nowMs: number, ctx: LaunchCtx, index = 0, boing = false): void {
    if (this.gone || this.flight || this.falling) return;
    if (launch.kind === 'satellite') {
      // over the cap: no flight, it vanishes at once with its twinkle
      if (ctx.satellites.flying >= MAX_SATELLITES) {
        this.vanish(from.x, from.y - 20, nowMs, ctx);
        return;
      }
      ctx.satellites.flying += 1;
      this.slot = ctx.satellites;
      this.flight = { from: { ...from }, launch, dist: launch.power, start: nowMs + satelliteDelay(index), landed: false, boing: false };
      return;
    }
    const dist = landingDistance(from, launch, ctx.world, ctx.blocked);
    this.flight = { from: { ...from }, launch, dist, start: nowMs, landed: false, boing };
  }

  /**
   * Plays `fall` from `from` (a KO without launch). Over MAX_FALLS bodies falling at once, the body just lies down. The
   * travel is clamped to free ground inside the world (landingDistance), the body never lies in a wall.
   */
  fall(from: Vec, fall: Fall, nowMs: number, ctx: LaunchCtx): void {
    if (this.gone || this.flight || this.falling) return;
    if (ctx.falls.active >= MAX_FALLS) return;
    ctx.falls.active += 1;
    const travel = fallTravel(fall.kind);
    const dist = travel > 0 ? landingDistance(from, { dir: fall.dir, power: travel, spin: 0 }, ctx.world, ctx.blocked) : 0;
    const can = fall.kind === 'trashcan' ? (ctx.cans.pop() ?? null) : null;
    // no can left: the dive still plays, the legs phase reads as a lying body
    this.falling = { fall, from: { ...from }, dist, start: nowMs, impacted: false, lastTrail: 0, can };
  }

  /** Ends the fall: frees its slot and its can. */
  private endFall(ctx: LaunchCtx): void {
    const f = this.falling;
    if (!f) return;
    this.falling = null;
    ctx.falls.active = Math.max(0, ctx.falls.active - 1);
    if (f.can) {
      f.can.setVisible(false);
      ctx.cans.push(f.can);
    }
    this.view.sprite.setCrop();
  }

  get removed(): boolean {
    return this.gone;
  }

  update(h: HostileSnap, nowMs: number, ctx: LaunchCtx): void {
    if (this.gone) return;
    if (h.state === 'ko' && this.flight?.launch.kind === 'satellite') {
      this.view.still(koFrame(this.view.sheet));
      this.view.tickFlash(nowMs);
      this.flag?.setVisible(false);
      this.pole?.setVisible(false);
      this.bottle?.update(h, this.view.sprite.depth, nowMs);
      this.rifle?.update(h, this.view.sprite.depth, nowMs);
      this.role?.update(h, this.view.sprite);
      this.caid?.update(h, this.view.sprite, nowMs);
      this.satellite(this.flight, nowMs, ctx);
      return;
    }
    const v = this.view;
    const moved = v.place(h.pos);
    const dir = dirOf(h.facing);
    const s = v.sprite;
    if (h.state === 'ko' && this.flight) {
      v.still(koFrame(v.sheet));
      this.fly(this.flight, nowMs, ctx);
    } else if (h.state === 'ko' && this.falling) {
      this.playFall(this.falling, dir, nowMs, ctx);
    } else if (h.state === 'ko') {
      v.still(koFrame(v.sheet));
      s.setPosition(Math.round(h.pos.x + this.restX), Math.round(h.pos.y + this.restY))
        .setAlpha(0.6)
        .setDepth(h.pos.y + this.restY - 8);
    } else {
      if (this.falling) this.endFall(ctx);
      this.restX = 0;
      this.restY = 0;
      s.setAlpha(1);
      if (h.state === 'windup') v.still(windupFrame(v.sheet, dir));
      else if (h.state === 'degrade' || h.state === 'threaten') v.slash(dir, true);
      else if (moved > 0.05) v.walk(dir, h.role === 'runner' ? 1.5 : 1);
      else v.still(idleFrame(v.sheet, dir));
      // a runner kicks up small dust puffs behind him while he runs
      if (h.role === 'runner' && moved > 0.5 && nowMs - this.lastDust >= DUST_MS) {
        this.lastDust = nowMs;
        ctx.dust.emitParticleAt(h.pos.x - h.facing.x * 6, h.pos.y - 1, 1);
      }
    }
    v.tickFlash(nowMs);
    if (this.flag && this.pole) {
      const ko = h.state === 'ko';
      this.flag.setVisible(!ko);
      this.pole.setVisible(!ko);
      // held over the shoulder on the side away from the facing
      const side = Math.round((dir === 'e' ? -9 : 9) * this.size);
      const px = h.pos.x + side;
      const py = h.pos.y - Math.round(26 * this.size);
      this.pole.setPosition(px, py).setDepth(s.depth + 0.02);
      this.flag
        .setPosition(px, py - 10)
        .setFlipX(dir === 'e')
        .setOrigin(dir === 'e' ? 1 : 0, 1)
        .setDepth(s.depth + 0.03);
    }
    this.bottle?.update(h, s.depth, nowMs);
    this.rifle?.update(h, s.depth, nowMs);
    this.role?.update(h, s);
    this.caid?.update(h, s, nowMs);
  }

  private playFall(f: Falling, dir: Dir, nowMs: number, ctx: LaunchCtx): void {
    const v = this.view;
    const s = v.sprite;
    const p = fallPose(f.fall, f.dist, nowMs - f.start, ctx.reducedMotion, ctx.pose);
    const gx = f.from.x + p.dx;
    const gy = f.from.y + p.dy;
    if (p.t >= 1) {
      this.restX = p.dx;
      this.restY = p.dy;
      this.endFall(ctx);
      v.still(koFrame(v.sheet));
      s.setOrigin(0.5, FEET_ORIGIN_Y)
        .setAngle(0)
        .setScale(this.size)
        .setPosition(Math.round(gx), Math.round(gy))
        .setAlpha(0.6)
        .setDepth(gy - 8);
      return;
    }
    v.still(p.frame === 'stand' ? idleFrame(v.sheet, dir) : koFrame(v.sheet));
    const spec = FALL_SPECS[f.fall.kind];
    if (!f.impacted && spec.impact >= 0 && p.t >= spec.impact) {
      f.impacted = true;
      ctx.dust.emitParticleAt(gx, gy - 2, ctx.reducedMotion ? 2 : 6);
    }
    if (p.trail && nowMs - f.lastTrail >= TRAIL_MS) {
      f.lastTrail = nowMs;
      ctx.dust.emitParticleAt(gx - f.fall.dir.x * 8, gy - 1, 1);
    }
    const x = gx;
    let y = gy - p.lift;
    if (p.legs && f.can) {
      // upside down, only the legs out of the can's rim
      const frameH = s.frame.height;
      s.setCrop(0, LEGS_ROW, s.frame.width, frameH - LEGS_ROW).setOrigin(0.5, LEGS_ORIGIN_Y);
      y = gy - CAN_ROWS.length * CAN_SCALE + LEGS_TUCK;
    } else {
      s.setCrop();
      if (p.legs) {
        // no can in the pool: lie down for the legs phase
        v.still(koFrame(v.sheet));
        p.angle = 0;
      }
      s.setOrigin(0.5, p.origin === 'mid' && !p.legs ? SPIN_ORIGIN_Y : FEET_ORIGIN_Y);
      if (p.origin === 'mid' && !p.legs) y -= SPIN_LIFT;
    }
    s.setPosition(Math.round(x), Math.round(y))
      .setAngle(p.angle)
      .setScale(p.scaleX * this.size, p.scaleY * this.size)
      .setAlpha(1)
      .setDepth(p.lift > 20 ? DEPTH.foliage + 2 : gy + 1);
    if (f.can) {
      f.can
        .setVisible(p.can > 0)
        .setAlpha(p.can)
        .setPosition(Math.round(f.from.x), Math.round(f.from.y))
        .setDepth(p.legs ? s.depth + 0.05 : gy + 0.5);
    }
  }

  private fly(f: Flight, nowMs: number, ctx: LaunchCtx): void {
    const s = this.view.sprite;
    const pose = launchPose(f.from, f.launch, f.dist, nowMs - f.start);
    if (pose.t < 1) {
      const y = Math.round(pose.y - pose.lift - SPIN_LIFT);
      s.setOrigin(0.5, SPIN_ORIGIN_Y)
        .setPosition(Math.round(pose.x), y)
        .setAngle(pose.angle)
        .setScale(pose.scaleX * this.size, pose.scaleY * this.size)
        .setAlpha(1)
        .setDepth(DEPTH.foliage + 2);
      if (Math.floor(nowMs / 32) % 2 === 0) ctx.trail.emitParticleAt(pose.x, y, 1);
      return;
    }
    if (!f.landed) {
      f.landed = true;
      ctx.trail.emitParticleAt(pose.x, pose.y - 4, 6);
      if (f.boing) ctx.pow(pose.x, pose.y, nowMs, pickWord('glove', Math.random()));
    }
    s.setOrigin(0.5, FEET_ORIGIN_Y)
      .setAngle(0)
      .setScale(this.size)
      .setPosition(Math.round(pose.x), Math.round(pose.y))
      .setAlpha(0.6)
      .setDepth(pose.y - 8);
  }

  private satellite(f: Flight, nowMs: number, ctx: LaunchCtx): void {
    const pose = satellitePose(f.from, f.launch, nowMs - f.start, ctx.reducedMotion);
    const x = Math.round(pose.x);
    const y = Math.round(pose.y - pose.lift - SPIN_LIFT);
    // the one twinkle: where it leaves the camera view (inset 8 screen px), else where it ends
    if (!this.twinkled && this.lastPt) {
      const cam = ctx.view();
      const exit = edgeExit(this.lastPt, { x, y }, cam, 8 / ctx.zoom());
      if (exit) {
        this.twinkled = true;
        ctx.twinkles.spawn(exit.x, exit.y, nowMs);
      }
    }
    this.lastPt = { x, y };
    if (pose.t >= 1) {
      this.vanish(x, y, nowMs, ctx);
      return;
    }
    this.view.sprite
      .setOrigin(0.5, SPIN_ORIGIN_Y)
      .setPosition(x, y)
      .setAngle(pose.angle)
      .setScale((Math.round(pose.scale * 8) / 8) * this.size)
      .setAlpha(1)
      .setDepth(DEPTH.overlay);
    if (Math.floor(nowMs / 40) % 2 === 0) ctx.trail.emitParticleAt(x, y, 1);
  }

  /** The satellite is gone: its twinkle where it vanished (unless already shown at the view edge), sprites destroyed. */
  private vanish(x: number, y: number, nowMs: number, ctx: LaunchCtx): void {
    if (!this.twinkled) {
      this.twinkled = true;
      const exit = edgeExit({ x, y }, { x, y }, ctx.view(), 8 / ctx.zoom());
      ctx.twinkles.spawn(exit?.x ?? x, exit?.y ?? y, nowMs);
    }
    this.destroy();
  }

  destroy(ctx?: LaunchCtx): void {
    if (this.gone) return;
    this.gone = true;
    if (ctx) this.endFall(ctx);
    if (this.slot) this.slot.flying = Math.max(0, this.slot.flying - 1);
    this.slot = null;
    this.view.destroy();
    this.flag?.destroy();
    this.pole?.destroy();
    this.bottle?.destroy();
    this.rifle?.destroy();
    this.role?.destroy();
    this.caid?.destroy();
  }
}
