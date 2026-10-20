import Phaser from 'phaser';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import { CharView, FEET_ORIGIN_Y, idleFrame } from './actors';
import { DEPTH } from './depth';

const SIGN_COLORS = [0xf4ecd8, 0xe8f1f8, 0xf8efc8];

/** Peaceful protesters: calm idle, a light sign above each, one blue neutral icon above the group. */
export class GroupView {
  private readonly members: { sprite: Phaser.GameObjects.Sprite; sign: Phaser.GameObjects.Container; baseY: number }[] = [];

  constructor(scene: Phaser.Scene) {
    const { area, members } = DISTRICT.peacefulGroup;
    members.forEach((m, i) => {
      const sheet = `protester_${(i % 4) + 1}`;
      const sprite = scene.add
        .sprite(m.x, m.y, sheet, idleFrame(sheet, 's'))
        .setOrigin(0.5, FEET_ORIGIN_Y)
        .setDepth(m.y);
      const stick = scene.add.rectangle(0, 0, 1, 14, 0x6b5440).setOrigin(0.5, 0);
      const board = scene.add
        .rectangle(0, 0, 16, 10, SIGN_COLORS[i % SIGN_COLORS.length]!)
        .setStrokeStyle(1, 0x3a3546)
        .setOrigin(0.5, 1);
      const sign = scene.add.container(m.x + 7, m.y - 48, [stick, board]).setDepth(m.y + 0.1);
      this.members.push({ sprite, sign, baseY: m.y });
    });
    // blue neutral marker (a calm "i"), never a threat colour
    const icon = scene.add.graphics().setDepth(DEPTH.overlay);
    const cx = area.x + area.w / 2;
    const cy = area.y - 44;
    icon.fillStyle(0x2f6fd6, 1).fillCircle(cx, cy, 7);
    icon.lineStyle(1, 0xffffff, 1).strokeCircle(cx, cy, 7);
    icon.fillStyle(0xffffff, 1).fillRect(cx - 1, cy - 1, 2, 5).fillRect(cx - 1, cy - 4, 2, 2);
  }

  /** Gentle breathing bob, out of phase per member. */
  update(timeMs: number): void {
    this.members.forEach((m, i) => {
      const bob = Math.sin(timeMs / 700 + i * 1.3) > 0.6 ? -1 : 0;
      m.sprite.y = m.baseY + bob;
      m.sign.y = m.baseY - 48 + bob;
    });
  }
}

/** Pixel font of the bubbles (loaded by BootScene before the world starts), with a monospace fallback. */
const BUBBLE_FONT = '"Press Start 2P", ui-monospace, monospace';
const BUBBLE_INK = 0x14121c;
const BUBBLE_PAD = 3;
/** Tail tip of the bubble, above the victim's feet. */
const BUBBLE_Y = -46;
const BOB_MS = 250;

type BubbleKind = 'help' | 'thanks';
const BUBBLES: Record<BubbleKind, { text: string; color: string }> = {
  help: { text: 'À L’AIDE !', color: '#c4372b' },
  thanks: { text: 'MERCI !', color: '#1b7a35' }, // >= 5:1 on the white bubble
};

/**
 * Pixel speech bubble (white, 1 px dark border, stepped tail pointing down) whose origin is the tail tip.
 * Every coordinate is a whole pixel so it stays crisp under the integer camera zoom.
 */
class Bubble {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private kind: BubbleKind | null = null;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', { fontFamily: BUBBLE_FONT, fontSize: '8px', color: '#000' });
    this.root = scene.add.container(0, 0, [this.g, this.text]).setDepth(DEPTH.overlay).setVisible(false);
  }

  set(kind: BubbleKind | null): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.root.setVisible(kind !== null);
    if (!kind) return;
    const b = BUBBLES[kind];
    this.text.setText(b.text).setColor(b.color);
    this.text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const tw = Math.ceil(this.text.width);
    const th = Math.ceil(this.text.height);
    const bw = tw + 2 * BUBBLE_PAD;
    const bh = th + 2 * BUBBLE_PAD;
    const left = -Math.floor(bw / 2);
    const top = -(bh + 4);
    const g = this.g.clear();
    g.fillStyle(BUBBLE_INK, 1).fillRect(left - 1, top - 1, bw + 2, bh + 2);
    g.fillStyle(0xffffff, 1).fillRect(left, top, bw, bh);
    // stepped tail: rows of 7/5/3/1 dark px with 5/3/1 white px inside
    for (let i = 0; i < 4; i++) {
      const dark = 7 - 2 * i;
      g.fillStyle(BUBBLE_INK, 1).fillRect(-Math.floor(dark / 2), -4 + i, dark, 1);
      const white = dark - 2;
      if (white > 0) g.fillStyle(0xffffff, 1).fillRect(-Math.floor(white / 2), -4 + i, white, 1);
    }
    this.text.setPosition(left + BUBBLE_PAD, top + BUBBLE_PAD);
  }

  /** Whole-number scale keeps the bubble about 16 screen px tall at camera zoom 1 and 2 (crisp, readable). */
  place(x: number, y: number, alpha = 1): void {
    const scale = Math.max(1, Math.round(2 / (this.root.scene.cameras.main.zoom || 1)));
    this.root.setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setScale(scale);
  }
}

/**
 * Rescue victim: elder at victimPos with a pixel speech bubble — « À L’AIDE ! » (red, stepped bob) while threatened,
 * « MERCI ! » (green) once safe, until they have walked away. Failed: no bubble, the victim retreats. Never an enemy
 * marker on the victim.
 */
export class VictimView {
  private view: CharView | null = null;
  private readonly bubble: Bubble;
  private leaving = false;
  private key = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.bubble = new Bubble(scene);
  }

  update(rescue: Snapshot['rescue'], timeMs: number): void {
    if (!rescue) {
      this.clear();
      return;
    }
    const key = `${rescue.victimPos.x},${rescue.victimPos.y}`;
    if (this.view && key !== this.key) this.clear(); // a new rescue elsewhere
    this.key = key;
    if (!this.view) {
      const sheet = rescue.kind === 'elderlyRobbed' ? 'elder_1' : 'elder_2';
      this.view = new CharView(this.scene, sheet, rescue.victimPos);
      this.leaving = false;
    }
    const v = this.view;
    if (rescue.stage === 'threat' || rescue.stage === 'secured') {
      v.place(rescue.victimPos);
      v.still(idleFrame(v.sheet, 's'));
    } else if (!this.leaving) {
      this.leaving = true; // failed: retreats; completed: leaves calmly. Never turned into an enemy.
      const awayX = rescue.victimPos.x + (rescue.stage === 'failed' ? -90 : 90);
      v.walk(awayX < rescue.victimPos.x ? 'w' : 'e', 0.7);
      this.scene.tweens.add({
        targets: v.sprite,
        x: awayX,
        alpha: 0,
        duration: 2200,
        onUpdate: () => v.sprite.setDepth(v.sprite.y),
        onComplete: () => v.sprite.setVisible(false),
      });
    }
    if (rescue.stage === 'threat') {
      this.bubble.set('help');
      const bob = Math.floor(timeMs / BOB_MS) % 2 === 0 ? 0 : -2;
      this.bubble.place(rescue.victimPos.x, rescue.victimPos.y + BUBBLE_Y + bob);
    } else if (rescue.stage === 'secured' || (rescue.stage === 'completed' && v.sprite.visible && v.sprite.alpha > 0.05)) {
      this.bubble.set('thanks');
      this.bubble.place(v.sprite.x, rescue.victimPos.y + BUBBLE_Y, rescue.stage === 'completed' ? v.sprite.alpha : 1);
    } else {
      this.bubble.set(null);
    }
  }

  private clear(): void {
    if (this.view) this.scene.tweens.killTweensOf(this.view.sprite);
    this.view?.destroy();
    this.view = null;
    this.bubble.set(null);
  }
}
