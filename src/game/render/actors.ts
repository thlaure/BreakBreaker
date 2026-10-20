import Phaser from 'phaser';
import type { CharLayout, CharSheet, Dir } from '../assets';
import type { Snapshot } from '../../sim/sim';
import type { Launch, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { landingDistance, launchPose } from './furieMath';

type HostileSnap = Snapshot['hostiles'][number];

let LAYOUT: CharLayout | null = null;
const COLS = new Map<string, number>();

/** Feet sit near the bottom of the 64-px LPC frame. */
export const FEET_ORIGIN_Y = 58 / 64;
const FLASH_MS = 80;

export function dirOf(v: Vec): Dir {
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'e' : 'w';
  return v.y < 0 ? 'n' : 's';
}

function layout(): CharLayout {
  if (!LAYOUT) throw new Error('createCharAnims() must run before character rendering');
  return LAYOUT;
}

function frameIndex(sheet: string, row: number, col: number): number {
  return row * (COLS.get(sheet) ?? 9) + col;
}

/** Standing frame (walk column 0) for a facing. */
export function idleFrame(sheet: string, dir: Dir): number {
  return frameIndex(sheet, layout().anims.walk.rows[dir], 0);
}
/** Arm raised (mid slash) – used for windups. */
export function windupFrame(sheet: string, dir: Dir): number {
  return frameIndex(sheet, layout().anims.slash.rows[dir], 2);
}
/** Lying down – last hurt frame. */
export function koFrame(sheet: string): number {
  const h = layout().anims.hurt;
  return frameIndex(sheet, h.row, h.frames - 1);
}
export const walkKey = (sheet: string, dir: Dir): string => `${sheet}:walk:${dir}`;
export const slashKey = (sheet: string, dir: Dir): string => `${sheet}:slash:${dir}`;

/** Builds walk (frames 1..n-1 looped), slash and hurt animations for every loaded character sheet. */
export function createCharAnims(scene: Phaser.Scene, l: CharLayout): void {
  LAYOUT = l;
  const sheets: CharSheet[] = [];
  for (const key of scene.textures.getTextureKeys()) {
    const src = scene.textures.get(key).getSourceImage() as { width: number; height: number };
    if (!/^(paul|rioter_|protester_|elder_)/.test(key)) continue;
    COLS.set(key, Math.floor(src.width / l.frame));
    sheets.push(key as CharSheet);
  }
  for (const sheet of sheets) {
    for (const dir of ['n', 'w', 's', 'e'] as const) {
      const wr = l.anims.walk.rows[dir];
      const sr = l.anims.slash.rows[dir];
      scene.anims.create({
        key: walkKey(sheet, dir),
        frames: scene.anims.generateFrameNumbers(sheet, {
          start: frameIndex(sheet, wr, 1),
          end: frameIndex(sheet, wr, l.anims.walk.frames - 1),
        }),
        frameRate: 12,
        repeat: -1,
      });
      scene.anims.create({
        key: slashKey(sheet, dir),
        frames: scene.anims.generateFrameNumbers(sheet, {
          start: frameIndex(sheet, sr, 0),
          end: frameIndex(sheet, sr, l.anims.slash.frames - 1),
        }),
        frameRate: 16,
        repeat: 0,
      });
    }
  }
}

/** One LPC character sprite with walk / slash / still-frame helpers and a short white hit flash. */
export class CharView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private last: Vec;
  private flashUntil = 0;
  private slashing = false;

  constructor(scene: Phaser.Scene, readonly sheet: string, pos: Vec) {
    this.sprite = scene.add.sprite(pos.x, pos.y, sheet, idleFrame(sheet, 's')).setOrigin(0.5, FEET_ORIGIN_Y);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => (this.slashing = false));
    this.last = { ...pos };
  }

  /** Moves to `pos`; returns the distance travelled since the previous call. */
  place(pos: Vec): number {
    const d = Math.hypot(pos.x - this.last.x, pos.y - this.last.y);
    this.sprite.setPosition(pos.x, pos.y).setDepth(pos.y);
    this.last = { ...pos };
    return d;
  }

  walk(dir: Dir, rate = 1): void {
    if (this.slashing) return;
    this.sprite.anims.play(walkKey(this.sheet, dir), true);
    this.sprite.anims.timeScale = rate;
  }

  still(frame: number): void {
    if (this.slashing) return;
    this.sprite.anims.stop();
    this.sprite.setFrame(frame);
  }

  slash(dir: Dir, loop = false): void {
    const key = slashKey(this.sheet, dir);
    if (loop) {
      if (this.sprite.anims.currentAnim?.key === key && this.sprite.anims.isPlaying) return;
      this.slashing = false;
      this.sprite.anims.play({ key, repeat: -1, frameRate: 8 }, false);
      return;
    }
    this.slashing = true;
    this.sprite.anims.timeScale = 1;
    this.sprite.anims.play(key, false);
  }

  flash(nowMs: number): void {
    this.flashUntil = nowMs + FLASH_MS;
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  /** Clears an expired flash; returns true while flashing. */
  tickFlash(nowMs: number): boolean {
    if (this.flashUntil === 0) return false;
    if (nowMs < this.flashUntil) return true;
    this.flashUntil = 0;
    this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    return false;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

const OUTLINE_OFFSETS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Warm multiply tint of Paul and gold outline while the mode furie is on. */
const FURIE_TINT = 0xffe2a0;
const FURIE_OUTLINE = 0xffe066;
const OUTLINE = 0xf4f1e8;

/**
 * Paul: CharView + a cheap 1-px light outline (four white-filled copies offset under the sprite); in mode furie the
 * sprite is tinted warm and the outline turns gold.
 */
export class PaulView {
  readonly view: CharView;
  private readonly outline: Phaser.GameObjects.Sprite[];
  private warm = false;

  constructor(scene: Phaser.Scene, pos: Vec) {
    this.view = new CharView(scene, 'paul', pos);
    this.outline = OUTLINE_OFFSETS.map(() =>
      scene.add
        .sprite(pos.x, pos.y, 'paul', 0)
        .setOrigin(0.5, FEET_ORIGIN_Y)
        .setTint(OUTLINE)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0.85),
    );
  }

  get sprite(): Phaser.GameObjects.Sprite {
    return this.view.sprite;
  }

  /** `dtMs` = time since the previous visual update (for the walk/run speed estimate); `furie` = mode furie on. */
  update(p: Snapshot['player'], strike: boolean, nowMs: number, dtMs: number, furie = false): void {
    const v = this.view;
    const warm = furie && !p.ko;
    if (warm !== this.warm) {
      this.warm = warm;
      if (warm) v.sprite.setTint(FURIE_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
      else v.sprite.clearTint();
      for (const o of this.outline) o.setTint(warm ? FURIE_OUTLINE : OUTLINE);
    }
    const speed = (v.place(p.pos) / Math.max(1, dtMs)) * 1000; // px/s
    const dir = dirOf(p.facing);
    if (p.ko) v.still(koFrame('paul'));
    else if (strike) v.slash(dir);
    else if (speed > 20) v.walk(dir, speed > 215 ? 1.4 : 1);
    else v.still(idleFrame('paul', dir));
    v.tickFlash(nowMs);
    // i-frames blink
    const blinkOff = p.invulnerable && !p.ko && Math.floor(nowMs / 80) % 2 === 0;
    v.sprite.setAlpha(blinkOff ? 0.45 : 1);
    const s = v.sprite;
    OUTLINE_OFFSETS.forEach(([dx, dy], i) => {
      const o = this.outline[i]!;
      // hidden on blink-off frames: a white silhouette under a translucent sprite reads as a ghost
      o.setPosition(s.x + dx, s.y + dy).setDepth(s.depth - 0.01).setFrame(s.frame.name).setVisible(!blinkOff && !p.ko);
    });
  }
}

/**
 * Molotov rioter's bottle: held at his side, raised and lit (flickering flame + "!" over his head) while he holds a
 * bottle up (`bottleUp`), gone once thrown (a bottle windup that ends without a KO is the throw). A firebomber always
 * has a fresh one in hand (a Molotov that turned firebomber after its site throw picks one up again).
 */
class BottleProp {
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
      this.bottle.setPosition(x + side * 9, y - 14).setAngle(side * 15).setDepth(d);
      return;
    }
    // raised beside the head, rag on fire
    const bx = x + side * 12;
    const by = y - 34;
    this.bottle.setPosition(bx, by).setAngle(side * 20).setDepth(d);
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

/** A body knocked out in mode furie: where it was hit, its launch, how far it travels, when it took off. */
interface Flight {
  from: Vec;
  launch: Launch;
  dist: number;
  start: number;
  landed: boolean;
}

/** Sprite origin (y) while airborne: the body spins around its middle, not its feet. */
const SPIN_ORIGIN_Y = 0.6;
const SPIN_LIFT = Math.round((FEET_ORIGIN_Y - SPIN_ORIGIN_Y) * 64);

/** What a HostileView needs for a launched body: the shared trail emitter and the landing check. */
export interface LaunchCtx {
  trail: Phaser.GameObjects.Particles.ParticleEmitter;
  world: { width: number; height: number };
  blocked: (p: Vec) => boolean;
}

/**
 * Rioter: sheet by variant (_a/_b by lifeId parity), optional flag prop above the shoulder, Molotov bottle. A body
 * launched in mode furie flies off spinning (ease-out travel, arc, squash, star/dust trail) above everything, then
 * lies where it landed (inside the world, never in a wall) like any KO body.
 */
class HostileView {
  readonly view: CharView;
  private readonly flag: Phaser.GameObjects.Image | null;
  private readonly pole: Phaser.GameObjects.Rectangle | null;
  private readonly bottle: BottleProp | null;
  private flight: Flight | null = null;

  constructor(scene: Phaser.Scene, h: HostileSnap) {
    const sheet = `rioter_${h.variant}_${h.lifeId % 2 === 0 ? 'a' : 'b'}`;
    this.view = new CharView(scene, sheet, h.pos);
    const flagFrame = h.variant === 'palestinian' ? 1 : h.variant === 'antifa' ? 2 : -1;
    this.flag = flagFrame >= 0 ? scene.add.image(0, 0, 'flags', flagFrame).setOrigin(0, 1) : null;
    this.pole = flagFrame >= 0 ? scene.add.rectangle(0, 0, 1, 22, 0x5a4632).setOrigin(0.5, 1) : null;
    this.bottle = h.role === 'molotov' || h.role === 'firebomber' ? new BottleProp(scene) : null;
  }

  launch(from: Vec, launch: Launch, nowMs: number, ctx: LaunchCtx): void {
    const dist = landingDistance(from, launch, ctx.world, ctx.blocked);
    this.flight = { from: { ...from }, launch, dist, start: nowMs, landed: false };
  }

  update(h: HostileSnap, nowMs: number, ctx: LaunchCtx): void {
    const v = this.view;
    const moved = v.place(h.pos);
    const dir = dirOf(h.facing);
    const s = v.sprite;
    if (h.state === 'ko' && this.flight) {
      v.still(koFrame(v.sheet));
      this.fly(this.flight, nowMs, ctx);
    } else if (h.state === 'ko') {
      v.still(koFrame(v.sheet));
      s.setAlpha(0.6).setDepth(h.pos.y - 8);
    } else {
      s.setAlpha(1);
      if (h.state === 'windup') v.still(windupFrame(v.sheet, dir));
      else if (h.state === 'degrade' || h.state === 'threaten') v.slash(dir, true);
      else if (moved > 0.05) v.walk(dir);
      else v.still(idleFrame(v.sheet, dir));
    }
    v.tickFlash(nowMs);
    if (this.flag && this.pole) {
      const ko = h.state === 'ko';
      this.flag.setVisible(!ko);
      this.pole.setVisible(!ko);
      // held over the shoulder on the side away from the facing
      const side = dir === 'e' ? -9 : 9;
      const px = h.pos.x + side;
      const py = h.pos.y - 26;
      this.pole.setPosition(px, py).setDepth(s.depth + 0.02);
      this.flag.setPosition(px, py - 10).setFlipX(dir === 'e').setOrigin(dir === 'e' ? 1 : 0, 1).setDepth(s.depth + 0.03);
    }
    this.bottle?.update(h, s.depth, nowMs);
  }

  private fly(f: Flight, nowMs: number, ctx: LaunchCtx): void {
    const s = this.view.sprite;
    const pose = launchPose(f.from, f.launch, f.dist, nowMs - f.start);
    if (pose.t < 1) {
      const y = Math.round(pose.y - pose.lift - SPIN_LIFT);
      s.setOrigin(0.5, SPIN_ORIGIN_Y)
        .setPosition(Math.round(pose.x), y)
        .setAngle(pose.angle)
        .setScale(pose.scaleX, pose.scaleY)
        .setAlpha(1)
        .setDepth(DEPTH.foliage + 2);
      if (Math.floor(nowMs / 32) % 2 === 0) ctx.trail.emitParticleAt(pose.x, y, 1);
      return;
    }
    if (!f.landed) {
      f.landed = true;
      ctx.trail.emitParticleAt(pose.x, pose.y - 4, 6);
    }
    s.setOrigin(0.5, FEET_ORIGIN_Y).setAngle(0).setScale(1).setPosition(Math.round(pose.x), Math.round(pose.y)).setAlpha(0.6).setDepth(pose.y - 8);
  }

  destroy(): void {
    this.view.destroy();
    this.flag?.destroy();
    this.pole?.destroy();
    this.bottle?.destroy();
  }
}

/** Keeps one HostileView per lifeId in the snapshot; `launch` sends a KO body flying (mode furie). */
export class HostileLayer {
  private readonly views = new Map<number, HostileView>();
  private readonly ctx: LaunchCtx;

  constructor(
    private readonly scene: Phaser.Scene,
    opts: { world: { width: number; height: number }; blocked: (p: Vec) => boolean } = {
      world: { width: Infinity, height: Infinity },
      blocked: () => false,
    },
  ) {
    const trail = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 260, max: 520 },
        speed: { min: 6, max: 30 },
        scale: { start: 1.5, end: 0 },
        tint: [0xffffff, 0xfff3a0, 0xffd23a, 0xcfc6b4],
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.foliage + 1.5);
    this.ctx = { trail, world: opts.world, blocked: opts.blocked };
  }

  /** The body of `lifeId` (knocked out at `from`) flies along the launch for furieMath.LAUNCH_MS. */
  launch(lifeId: number, from: Vec, launch: Launch, nowMs: number): void {
    this.views.get(lifeId)?.launch(from, launch, nowMs, this.ctx);
  }

  update(list: Snapshot['hostiles'], nowMs: number): void {
    const seen = new Set<number>();
    for (const h of list) {
      seen.add(h.lifeId);
      let view = this.views.get(h.lifeId);
      if (!view) {
        view = new HostileView(this.scene, h);
        this.views.set(h.lifeId, view);
      }
      view.update(h, nowMs, this.ctx);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.destroy();
      this.views.delete(id);
    }
  }

  flash(lifeId: number, nowMs: number): void {
    this.views.get(lifeId)?.view.flash(nowMs);
  }
}

