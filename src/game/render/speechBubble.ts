import Phaser from 'phaser';
import { clampBubbleX } from './bubbleClamp';
import { DEPTH } from './depth';

/** Pixel font of the bubbles (loaded by BootScene before the world starts), with a monospace fallback. */
const BUBBLE_FONT = '"Press Start 2P", ui-monospace, monospace';
const BUBBLE_INK = 0x14121c;
const BUBBLE_PAD = 3;

/** What a bubble says: its text, the text colour and an optional border colour; `wrapPx` wraps longer lines. */
export interface BubbleSpec {
  text: string;
  color: string;
  border?: number;
  wrapPx?: number;
}

/**
 * Pixel speech bubble (white, 1 px dark border, stepped tail pointing down) whose origin is the tail tip.
 * Every coordinate is a whole pixel so it stays crisp under the integer camera zoom; kept inside the screen
 * horizontally (clampBubbleX).
 */
export class SpeechBubble {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private said = '';
  /** Half width of the drawn bubble (px, before scaling), for keeping it inside the screen. */
  private halfW = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', { fontFamily: BUBBLE_FONT, fontSize: '8px', color: '#000', align: 'center' });
    this.root = scene.add.container(0, 0, [this.g, this.text]).setDepth(DEPTH.overlay).setVisible(false);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** Shows `b` (null: hides the bubble); redrawn only when the text, colour or border changes. */
  say(b: BubbleSpec | null): void {
    const key = b ? `${b.text}\u0000${b.color}\u0000${b.border ?? ''}\u0000${b.wrapPx ?? ''}` : '';
    if (key === this.said) return;
    this.said = key;
    this.root.setVisible(b !== null);
    if (!b) return;
    this.text.setWordWrapWidth(b.wrapPx ?? null);
    this.text.setText(b.text).setColor(b.color);
    this.text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const tw = Math.ceil(this.text.width);
    const th = Math.ceil(this.text.height);
    const bw = tw + 2 * BUBBLE_PAD;
    const bh = th + 2 * BUBBLE_PAD;
    const left = -Math.floor(bw / 2);
    const top = -(bh + 4);
    this.halfW = Math.ceil(bw / 2) + 1;
    const g = this.g.clear();
    const ink = b.border ?? BUBBLE_INK;
    g.fillStyle(ink, 1).fillRect(left - 1, top - 1, bw + 2, bh + 2);
    g.fillStyle(0xffffff, 1).fillRect(left, top, bw, bh);
    // stepped tail: rows of 7/5/3/1 dark px with 5/3/1 white px inside
    for (let i = 0; i < 4; i++) {
      const dark = 7 - 2 * i;
      g.fillStyle(ink, 1).fillRect(-Math.floor(dark / 2), -4 + i, dark, 1);
      const white = dark - 2;
      if (white > 0) g.fillStyle(0xffffff, 1).fillRect(-Math.floor(white / 2), -4 + i, white, 1);
    }
    this.text.setPosition(left + BUBBLE_PAD, top + BUBBLE_PAD);
  }

  /** Whole-number scale keeps the bubble about 16 screen px tall at camera zoom 1 and 2 (crisp, readable). */
  place(x: number, y: number, alpha = 1): void {
    const cam = this.root.scene.cameras.main;
    const scale = Math.max(1, Math.round(2 / (cam.zoom || 1)));
    const cx = clampBubbleX(x, this.halfW * scale, cam.worldView.x, cam.worldView.right);
    this.root.setPosition(Math.round(cx), Math.round(y)).setAlpha(alpha).setScale(scale);
  }

  destroy(): void {
    this.root.destroy();
  }
}
