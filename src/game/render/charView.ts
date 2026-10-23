import Phaser from 'phaser';
import type { CharLayout, CharSheet, Dir } from '../assets';
import type { Vec } from '../../sim/types';

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

  constructor(
    scene: Phaser.Scene,
    readonly sheet: string,
    pos: Vec,
  ) {
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
