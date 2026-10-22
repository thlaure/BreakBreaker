import Phaser from 'phaser';
import type { CharLayout, CharSheet, Dir } from '../assets';
import type { Snapshot } from '../../sim/sim';
import type { Fall, Launch, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { FALL_SPECS, fallPose, fallTravel, newFallPose, pickWord, type FallPose } from './fallMath';
import { edgeExit, landingDistance, launchPose, satelliteDelay, satellitePose } from './furieMath';
import { MAX_SATELLITES, Twinkles } from './satellite';
import { RifleProp } from './guns';
import { DUST_MS, badgeOf, hpBarShown, hpFill, hpSegmentFills, hpSegments, rioterSheet, roleScale } from './roleLook';

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

const BADGE_PAL: Record<string, number> = { K: 0x14121c, S: 0x8a94a3, W: 0xd6dde6, D: 0x5b6472, Y: 0xffd166, O: 0xe0902a, R: 0xd23b3b };
/** Brute: a dark steel helmet (18×6). */
const HELMET = ['....KKKKKKKKKK....', '..KKSSWWSSSSSSKK..', '.KSSWWSSSSSSSSDSK.', '.KSSSSSSSSSSSDDSK.', 'KDDDDDDDDDDDDDDDDK', 'KKKKKKKKKKKKKKKKKK'];
/** Caïd: a gold crown with red jewels (14×8). */
const CROWN = ['K....K..K....K', 'KY..KYKKYK..YK', 'KYYKYYYYYYKYYK', 'KYYYYYYYYYYYYK', 'KYYRYYYYYYRYYK', 'KYYYYYRRYYYYYK', 'KOOOOOOOOOOOOK', 'KKKKKKKKKKKKKK'];

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
class RoleBadge {
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

/** A body knocked out in mode furie: where it was hit, its launch, how far it travels, when it took off. */
interface Flight {
  from: Vec;
  launch: Launch;
  dist: number;
  start: number;
  landed: boolean;
  /** The gant's « BOING ! » when the body lands (bounce fall). */
  boing: boolean;
}

/** A body falling per its ActorKnockedOut.fall (not launched): where, how far it travels, when, its fx flags. */
interface Falling {
  fall: Fall;
  from: Vec;
  dist: number;
  start: number;
  impacted: boolean;
  /** Last dust-trail puff (faceplant). */
  lastTrail: number;
  /** The pooled trash can (trashcan fall), or null. */
  can: Phaser.GameObjects.Image | null;
}

/** At most this many bodies play a fall at once; the next ones just lie down (still KO frame). */
export const MAX_FALLS = 8;
/** Trash cans in the pool (a trashcan fall over the pool falls without a can: plain crumple look). */
const CAN_POOL = 3;
const CAN_SCALE = 2;
/** Trash can: 12×14 pixel rows (lid, ribbed body). */
const CAN_ROWS = [
  '...KKKKKK...',
  '.KKLLLLLLKK.',
  'KLLWLLLLLLLK',
  'KKKKKKKKKKKK',
  '.KGWGgGGgGK.',
  '.KGWGgGGgGK.',
  '.KGWGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KgGGgGGggK.',
  '.KggggggggK.',
  '..KKKKKKKK..',
];
const CAN_PAL: Record<string, number> = { K: 0x14121c, L: 0xa9b3bd, W: 0xe6edf2, G: 0x7c8894, g: 0x5a6570 };
/** Trash can: frame row where the legs start (hips) in an LPC frame; only rows below it show, upside down. */
const LEGS_ROW = 44;
const LEGS_ORIGIN_Y = LEGS_ROW / 64;
/** How deep (px) the legs sink under the can rim. */
const LEGS_TUCK = 3;
const TRAIL_MS = 40;

/** Sprite origin (y) while airborne: the body spins around its middle, not its feet. */
const SPIN_ORIGIN_Y = 0.6;
const SPIN_LIFT = Math.round((FEET_ORIGIN_Y - SPIN_ORIGIN_Y) * 64);

/**
 * What a HostileView needs for a launched body: the shared trail emitter, the landing check (tumble), the twinkle pool
 * and the camera view (satellite), the satellites in flight (capped) and reduced motion.
 */
export interface LaunchCtx {
  trail: Phaser.GameObjects.Particles.ParticleEmitter;
  world: { width: number; height: number };
  blocked: (p: Vec) => boolean;
  twinkles: Twinkles;
  view: () => Phaser.Geom.Rectangle;
  zoom: () => number;
  satellites: { flying: number };
  reducedMotion: boolean;
  /** Bodies playing a fall right now (capped at MAX_FALLS). */
  falls: { active: number };
  /** Free trash cans (pool). */
  cans: Phaser.GameObjects.Image[];
  /** An onomatopoeia bubble (`big` for the WTF words). */
  pow: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void;
  /** Shared pose scratch (no per-frame allocation). */
  pose: FallPose;
  /** Runner dust puffs at the feet (shared emitter). */
  dust: Phaser.GameObjects.Particles.ParticleEmitter;
}

/**
 * Rioter: sheet by variant (_a/_b by lifeId parity), optional flag prop above the shoulder, Molotov bottle. A body
 * launched in mode furie flies off spinning (ease-out travel, arc, squash, star/dust trail) above everything, then
 * lies where it landed (inside the world, never in a wall) like any KO body. A body « satellisé » by the onde d’énergie
 * is shot into the sky along the beam (ease-in, spinning, shrinking, star trail, never clamped to the map), twinkles
 * where it vanishes (if on screen) and is destroyed: no body left lying.
 */
class HostileView {
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
  private lastDust = 0;

  constructor(scene: Phaser.Scene, h: HostileSnap) {
    this.view = new CharView(scene, rioterSheet(h.variant, h.role, h.lifeId), h.pos);
    this.size = roleScale(h.role);
    this.view.sprite.setScale(this.size);
    this.role = badgeOf(h.role) ? new RoleBadge(scene, h.role, this.size) : null;
    const flagFrame = h.variant === 'palestinian' ? 1 : h.variant === 'antifa' ? 2 : -1;
    this.flag = flagFrame >= 0 ? scene.add.image(0, 0, 'flags', flagFrame).setOrigin(0, 1) : null;
    this.pole = flagFrame >= 0 ? scene.add.rectangle(0, 0, 1, 22, 0x5a4632).setOrigin(0.5, 1) : null;
    this.bottle = h.role === 'molotov' || h.role === 'firebomber' ? new BottleProp(scene) : null;
    this.rifle = h.role === 'shooter' ? new RifleProp(scene) : null;
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
      s.setPosition(Math.round(h.pos.x + this.restX), Math.round(h.pos.y + this.restY)).setAlpha(0.6).setDepth(h.pos.y + this.restY - 8);
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
      this.flag.setPosition(px, py - 10).setFlipX(dir === 'e').setOrigin(dir === 'e' ? 1 : 0, 1).setDepth(s.depth + 0.03);
    }
    this.bottle?.update(h, s.depth, nowMs);
    this.rifle?.update(h, s.depth, nowMs);
    this.role?.update(h, s);
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
      s.setOrigin(0.5, FEET_ORIGIN_Y).setAngle(0).setScale(this.size).setPosition(Math.round(gx), Math.round(gy)).setAlpha(0.6).setDepth(gy - 8);
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
    s.setOrigin(0.5, FEET_ORIGIN_Y).setAngle(0).setScale(this.size).setPosition(Math.round(pose.x), Math.round(pose.y)).setAlpha(0.6).setDepth(pose.y - 8);
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
  }
}

/** `trash_can` texture (pixel rows drawn at runtime, no image file). */
export function makeFallTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('trash_can')) return;
  const g = scene.make.graphics({}, false);
  CAN_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = CAN_PAL[row[x]!];
      if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
    }
  });
  g.generateTexture('trash_can', CAN_ROWS[0]!.length, CAN_ROWS.length);
  g.destroy();
}

/**
 * Keeps one HostileView per lifeId in the snapshot; `launch` sends a KO body flying (mode furie, beam, gant), `fall`
 * plays its ActorKnockedOut.fall.
 */
export class HostileLayer {
  private readonly views = new Map<number, HostileView>();
  /** Bodies the jail van loaded (lifeIds): not drawn while the sim still lists them. */
  private readonly carried = new Set<number>();
  private readonly ctx: LaunchCtx;

  private readonly twinkles: Twinkles;

  constructor(
    private readonly scene: Phaser.Scene,
    opts: {
      world: { width: number; height: number };
      blocked: (p: Vec) => boolean;
      reducedMotion?: boolean;
      pow?: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void;
    } = {
      world: { width: Infinity, height: Infinity },
      blocked: () => false,
    },
  ) {
    makeFallTextures(scene);
    const cans: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < CAN_POOL; i++) cans.push(scene.add.image(0, 0, 'trash_can').setOrigin(0.5, 1).setScale(CAN_SCALE).setVisible(false));
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
    this.twinkles = new Twinkles(scene);
    const dust = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 220, max: 380 },
        speed: { min: 4, max: 14 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.6, end: 0.4 },
        tint: [0xcfc6b4, 0xb8ad97, 0xe6dfcf],
        alpha: { start: 0.7, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.decal + 1);
    this.ctx = {
      dust,
      trail,
      world: opts.world,
      blocked: opts.blocked,
      twinkles: this.twinkles,
      view: () => scene.cameras.main.worldView,
      zoom: () => scene.cameras.main.zoom || 1,
      satellites: { flying: 0 },
      reducedMotion: opts.reducedMotion ?? false,
      falls: { active: 0 },
      cans,
      pow: opts.pow ?? (() => {}),
      pose: newFallPose(),
    };
  }

  /**
   * The body of `lifeId` (knocked out at `from`) flies along the launch: a tumble for furieMath.LAUNCH_MS, a satellite
   * for SATELLITE_MS (then gone).
   */
  launch(lifeId: number, from: Vec, launch: Launch, nowMs: number, index = 0, boing = false): void {
    this.views.get(lifeId)?.launch(from, launch, nowMs, this.ctx, index, boing);
  }

  /** The body of `lifeId` (knocked out at `from`) plays `fall` (see fallMath). */
  fall(lifeId: number, from: Vec, fall: Fall, nowMs: number): void {
    this.views.get(lifeId)?.fall(from, fall, nowMs, this.ctx);
  }

  /** Bodies playing a fall right now (debug / tests). */
  get fallsActive(): number {
    return this.ctx.falls.active;
  }

  /**
   * Where the body of `lifeId` is drawn right now (after a fall's travel or a furie flight), or null when it has no
   * view (never drawn, satellite gone, carried off).
   */
  bodyPos(lifeId: number): Vec | null {
    const v = this.views.get(lifeId);
    if (!v || v.removed) return null;
    return { x: v.view.sprite.x, y: v.view.sprite.y };
  }

  /**
   * The jail van loads the body of `lifeId`: its view is destroyed now and never drawn again, even while the sim still
   * lists the KO body (it takes it off the map CONFIG.prison.pickupSec after the KO).
   */
  carry(lifeId: number): void {
    this.carried.add(lifeId);
    const v = this.views.get(lifeId);
    if (v) {
      v.destroy(this.ctx);
      this.views.delete(lifeId);
    }
  }

  update(list: Snapshot['hostiles'], nowMs: number): void {
    const seen = new Set<number>();
    for (const h of list) {
      seen.add(h.lifeId);
      if (this.carried.has(h.lifeId)) continue;
      let view = this.views.get(h.lifeId);
      if (!view) {
        view = new HostileView(this.scene, h);
        this.views.set(h.lifeId, view);
      }
      view.update(h, nowMs, this.ctx);
    }
    this.twinkles.update(nowMs);
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.destroy(this.ctx);
      this.views.delete(id);
    }
    for (const id of this.carried) if (!seen.has(id)) this.carried.delete(id);
  }

  flash(lifeId: number, nowMs: number): void {
    const v = this.views.get(lifeId);
    if (v && !v.removed) v.view.flash(nowMs);
  }
}

