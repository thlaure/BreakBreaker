import Phaser from 'phaser';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import { CharView, FEET_ORIGIN_Y, idleFrame } from './actors';
import { ITEM_SHOUTS, VictimMood } from './belongings';
import { DEPTH } from './depth';

const SIGN_COLORS = [0xf4ecd8, 0xe8f1f8, 0xf8efc8];

/** What the peaceful group grumbles about (never aimed at anyone in particular): one line at a time, in turn. */
const GRUMBLES = ['ÇA SUFFIT !', 'ON EN A MARRE !', 'ARRÊTEZ ÇA !', 'STOP À LA CASSE !', 'C’EST HONTEUX !'] as const;
/** A line is shown for GRUMBLE_SHOW_MS out of every GRUMBLE_PERIOD_MS. */
const GRUMBLE_PERIOD_MS = 4200;
const GRUMBLE_SHOW_MS = 2800;
/** Tail tip of the group's bubble: above the blue marker. */
const GROUP_BUBBLE_Y = -56;

/** Peaceful protesters: calm idle, a light sign above each, one blue neutral icon above the group, and a cross bubble. */
export class GroupView {
  private readonly members: { sprite: Phaser.GameObjects.Sprite; sign: Phaser.GameObjects.Container; baseY: number }[] = [];
  private readonly bubble: Bubble;
  private readonly bubbleX: number;
  private readonly bubbleY: number;

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
    this.bubble = new Bubble(scene);
    this.bubbleX = cx;
    this.bubbleY = area.y + GROUP_BUBBLE_Y;
  }

  /** Gentle breathing bob, out of phase per member. */
  update(timeMs: number): void {
    this.members.forEach((m, i) => {
      const bob = Math.sin(timeMs / 700 + i * 1.3) > 0.6 ? -1 : 0;
      m.sprite.y = m.baseY + bob;
      m.sign.y = m.baseY - 48 + bob;
    });
    // an unhappy bubble above the group, a new line every period, with a small angry shake
    const phase = timeMs % GRUMBLE_PERIOD_MS;
    if (phase >= GRUMBLE_SHOW_MS) {
      this.bubble.set(null);
      return;
    }
    this.bubble.set(`grumble${Math.floor(timeMs / GRUMBLE_PERIOD_MS) % GRUMBLES.length}` as BubbleKind);
    const shake = Math.floor(timeMs / 110) % 2 === 0 ? 0 : -1;
    this.bubble.place(this.bubbleX + (shake ? 1 : 0), this.bubbleY + shake);
  }
}

/** Pixel font of the bubbles (loaded by BootScene before the world starts), with a monospace fallback. */
const BUBBLE_FONT = '"Press Start 2P", ui-monospace, monospace';
const BUBBLE_INK = 0x14121c;
const BUBBLE_PAD = 3;
/** Tail tip of the bubble, above the victim's feet. */
const BUBBLE_Y = -46;
const BOB_MS = 250;

/** `shout:<item id>`: the victim cries for a stolen belonging (« MON SAC ! »), red like the call for help. */
type BubbleKind = 'help' | 'thanks' | `grumble${0 | 1 | 2 | 3 | 4}` | `shout:${string}`;
type FixedBubble = Exclude<BubbleKind, `shout:${string}`>;
const BUBBLES: Record<FixedBubble, { text: string; color: string; border?: number }> = {
  help: { text: 'À L’AIDE !', color: '#c4372b' },
  thanks: { text: 'MERCI !', color: '#1b7a35' }, // >= 5:1 on the white bubble
  // the group is unhappy: dark red text and a red border (>= 5:1 on the white bubble)
  grumble0: { text: GRUMBLES[0], color: '#a3231a', border: 0xc4372b },
  grumble1: { text: GRUMBLES[1], color: '#a3231a', border: 0xc4372b },
  grumble2: { text: GRUMBLES[2], color: '#a3231a', border: 0xc4372b },
  grumble3: { text: GRUMBLES[3], color: '#a3231a', border: 0xc4372b },
  grumble4: { text: GRUMBLES[4], color: '#a3231a', border: 0xc4372b },
};

function bubbleSpec(kind: BubbleKind): { text: string; color: string; border?: number } {
  if (kind.startsWith('shout:')) return { text: ITEM_SHOUTS[kind.slice(6)] ?? BUBBLES.help.text, color: BUBBLES.help.color };
  return BUBBLES[kind as FixedBubble];
}

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
    const b = bubbleSpec(kind);
    this.text.setText(b.text).setColor(b.color);
    this.text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const tw = Math.ceil(this.text.width);
    const th = Math.ceil(this.text.height);
    const bw = tw + 2 * BUBBLE_PAD;
    const bh = th + 2 * BUBBLE_PAD;
    const left = -Math.floor(bw / 2);
    const top = -(bh + 4);
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
    const scale = Math.max(1, Math.round(2 / (this.root.scene.cameras.main.zoom || 1)));
    this.root.setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setScale(scale);
  }
}

/**
 * Rescue victim: elder at victimPos with a pixel speech bubble — « À L’AIDE ! » (red, stepped bob) while threatened,
 * « MON SAC ! » (the belonging's name, red) for a moment after a theft and while it waits for its belongings,
 * « MERCI ! » (green) for a belonging handed back and once safe, until they have walked away. Failed: no bubble, the
 * victim retreats. Never an enemy marker on the victim. Keyed on the rescue id (never reuses a previous victim).
 */
export class VictimView {
  private view: CharView | null = null;
  private readonly bubble: Bubble;
  private readonly mood = new VictimMood();
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
    // one view per rescue: a new rescue (even at the same site as the last one) never reuses the previous, faded victim
    const key = rescue.id;
    if (this.view && key !== this.key) this.clear();
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
    const kind = this.mood.update(rescue, timeMs);
    if (rescue.stage === 'threat' && kind) {
      this.bubble.set(kind);
      const bob = Math.floor(timeMs / BOB_MS) % 2 === 0 ? 0 : -2;
      this.bubble.place(rescue.victimPos.x, rescue.victimPos.y + BUBBLE_Y + bob);
    } else if (rescue.stage === 'secured' && kind) {
      this.bubble.set(kind);
      this.bubble.place(v.sprite.x, rescue.victimPos.y + BUBBLE_Y);
    } else if (rescue.stage === 'completed' && v.sprite.visible && v.sprite.alpha > 0.05) {
      this.bubble.set('thanks');
      this.bubble.place(v.sprite.x, rescue.victimPos.y + BUBBLE_Y, v.sprite.alpha);
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
