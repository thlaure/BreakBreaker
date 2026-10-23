import Phaser from 'phaser';
import { DEPTH } from './depth';

const OUTLINE = 0x14121c;
/** Props are drawn from 1-px logical textures scaled ×2, like the city tiles. */
const PX = 2;
/** Hp bar: white flash on a hp drop, at most once per this many ms (fire and degraders drain every step). */
const BAR_FLASH_MS = 90;
const BAR_FLASH_EVERY_MS = 450;
/** The light "lost hp" trail catches up with the bar at this fraction of max hp per second. */
const TRAIL_PER_SEC = 0.3;

/** Pixel hp bar: hidden at full hp when not attacked; green > 50 %, yellow > 25 %, red; white flash on damage. */
export class HpBar {
  private readonly g: Phaser.GameObjects.Graphics;
  private last = -1;
  private trail = 1;
  private flashUntil = 0;
  private nextFlashAt = 0;
  private drawnKey = -1;

  constructor(
    scene: Phaser.Scene,
    cx: number,
    top: number,
    private readonly w: number,
    private readonly h: number,
  ) {
    this.g = scene.add
      .graphics()
      .setPosition(Math.round(cx - w / 2), Math.round(top))
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
  }

  /** Moves the bar (a moving ally's): centred on `cx`, top at `top`, on whole pixels. */
  moveTo(cx: number, top: number): void {
    this.g.setPosition(Math.round(cx - this.w / 2), Math.round(top));
  }

  update(frac: number, visible: boolean, nowMs: number, dtMs: number): void {
    if (!visible) {
      this.g.setVisible(false);
      this.last = frac;
      this.trail = frac;
      return;
    }
    if (this.last >= 0 && frac < this.last - 1e-6 && nowMs >= this.nextFlashAt) {
      this.flashUntil = nowMs + BAR_FLASH_MS;
      this.nextFlashAt = nowMs + BAR_FLASH_EVERY_MS;
    }
    this.last = frac;
    this.trail = this.trail <= frac ? frac : Math.max(frac, this.trail - (dtMs / 1000) * TRAIL_PER_SEC);
    const flash = nowMs < this.flashUntil;
    const inner = this.w - 4;
    // whole 2-px steps so the bar stays on the pixel grid
    const fill = Math.ceil((frac * inner) / PX) * PX;
    const trail = Math.ceil((this.trail * inner) / PX) * PX;
    const tier = frac > 0.5 ? 0 : frac > 0.25 ? 1 : 2;
    const key = ((fill * 1000 + trail) * 4 + tier) * 2 + (flash ? 1 : 0);
    this.g.setVisible(true);
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    const [main, hi] = flash ? [0xffffff, 0xffffff] : BAR_COLORS[tier]!;
    const ih = this.h - 4;
    this.g
      .clear()
      .fillStyle(OUTLINE, 1)
      .fillRect(0, 0, this.w, this.h)
      .fillStyle(0x3a3438, 1)
      .fillRect(2, 2, inner, ih)
      .fillStyle(0xf4ecd8, 0.85)
      .fillRect(2, 2, trail, ih)
      .fillStyle(main, 1)
      .fillRect(2, 2, fill, ih)
      .fillStyle(hi, 1)
      .fillRect(2, 2, fill, PX);
  }
}

const BAR_COLORS: [number, number][] = [
  [0x3fc65e, 0xa8f5b8],
  [0xffc21f, 0xfff08a],
  [0xff3b30, 0xff9a90],
];
