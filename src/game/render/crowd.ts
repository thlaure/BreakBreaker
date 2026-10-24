import Phaser from 'phaser';
import { t } from '../../content/i18n';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import { CharView, FEET_ORIGIN_Y, idleFrame } from './actors';
import { VictimMood, itemShout } from './belongings';
import { DEPTH } from './depth';
import { SpeechBubble as Bubble, type BubbleSpec } from './speechBubble';
import { rectImage } from './flatImages';

const SIGN_COLORS = [0xf4ecd8, 0xe8f1f8, 0xf8efc8];

/**
 * What the peaceful group grumbles about (never aimed at anyone in particular): one line at a time, in turn (catalog
 * keys `content.grumble.0..4`, read in the current language at each frame).
 */
const GRUMBLE_COUNT = 5;
/** A line is shown for GRUMBLE_SHOW_MS out of every GRUMBLE_PERIOD_MS. */
const GRUMBLE_PERIOD_MS = 4200;
const GRUMBLE_SHOW_MS = 2800;
/** Tail tip of the group's bubble: above the blue marker. */
const GROUP_BUBBLE_Y = -56;

/** Peaceful protesters: calm idle, a light sign above each, one blue neutral icon above each group, and a cross bubble. */
export class GroupView {
  private readonly members: { sprite: Phaser.GameObjects.Sprite; sign: Phaser.GameObjects.Container; baseY: number }[] = [];
  private readonly bubbles: { bubble: Bubble; x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene) {
    for (const { area, members } of DISTRICT.peacefulGroups) {
      members.forEach((m, i) => {
        const sheet = `protester_${(i % 4) + 1}`;
        const sprite = scene.add.sprite(m.x, m.y, sheet, idleFrame(sheet, 's')).setOrigin(0.5, FEET_ORIGIN_Y).setDepth(m.y);
        const stick = rectImage(scene, 0, 0, 1, 14, 0x6b5440).setOrigin(0.5, 0);
        // the board's 1-px outline is a slightly larger dark rectangle under it
        const edge = rectImage(scene, 0, 0, 18, 12, 0x3a3546).setOrigin(0.5, 1);
        const board = rectImage(scene, 0, -1, 16, 10, SIGN_COLORS[i % SIGN_COLORS.length]!).setOrigin(0.5, 1);
        const sign = scene.add.container(m.x + 7, m.y - 48, [stick, edge, board]).setDepth(m.y + 0.1);
        this.members.push({ sprite, sign, baseY: m.y });
      });
      // blue neutral marker (a calm "i"), never a threat colour
      const icon = scene.add.graphics().setDepth(DEPTH.overlay);
      const cx = area.x + area.w / 2;
      const cy = area.y - 44;
      icon.fillStyle(0x2f6fd6, 1).fillCircle(cx, cy, 7);
      icon.lineStyle(1, 0xffffff, 1).strokeCircle(cx, cy, 7);
      icon
        .fillStyle(0xffffff, 1)
        .fillRect(cx - 1, cy - 1, 2, 5)
        .fillRect(cx - 1, cy - 4, 2, 2);
      this.bubbles.push({ bubble: new Bubble(scene), x: cx, y: area.y + GROUP_BUBBLE_Y });
    }
  }

  /** Gentle breathing bob, out of phase per member. */
  update(timeMs: number): void {
    this.members.forEach((m, i) => {
      const bob = Math.sin(timeMs / 700 + i * 1.3) > 0.6 ? -1 : 0;
      m.sprite.y = m.baseY + bob;
      m.sign.y = m.baseY - 48 + bob;
    });
    // an unhappy bubble above each group, a new line every period, with a small angry shake; the groups take turns
    // (a third of a period apart) and never say the same line at once
    const shake = Math.floor(timeMs / 110) % 2 === 0 ? 0 : -1;
    this.bubbles.forEach((b, gi) => {
      const t = timeMs + (gi * GRUMBLE_PERIOD_MS) / this.bubbles.length;
      if (t % GRUMBLE_PERIOD_MS >= GRUMBLE_SHOW_MS) {
        b.bubble.say(null);
        return;
      }
      b.bubble.say(bubbleSpec(`grumble${(Math.floor(t / GRUMBLE_PERIOD_MS) + gi) % GRUMBLE_COUNT}` as BubbleKind));
      b.bubble.place(b.x + (shake ? 1 : 0), b.y + shake);
    });
  }
}

/** Tail tip of the bubble, above the victim's feet. */
const BUBBLE_Y = -46;
const BOB_MS = 250;

/** `shout:<item id>`: the victim cries for a stolen belonging (« MON SAC ! »), red like the call for help. */
type BubbleKind = 'help' | 'thanks' | `grumble${0 | 1 | 2 | 3 | 4}` | `shout:${string}`;
const HELP_COLOR = '#c4372b';
/** The group is unhappy: dark red text and a red border (>= 5:1 on the white bubble). */
const GRUMBLE_STYLE = { color: '#a3231a', border: 0xc4372b } as const;

/** The bubble of `kind`, its text in the current language (a locale switch shows at the next frame). */
function bubbleSpec(kind: BubbleKind): BubbleSpec {
  if (kind === 'help') return { text: t('content.bubble.help'), color: HELP_COLOR };
  if (kind === 'thanks') return { text: t('content.bubble.thanks'), color: '#1b7a35' }; // >= 5:1 on the white bubble
  if (kind.startsWith('shout:')) return { text: itemShout(kind.slice(6)) ?? t('content.bubble.help'), color: HELP_COLOR };
  return { text: t(`content.grumble.${kind.slice(7) as `${0 | 1 | 2 | 3 | 4}`}`), ...GRUMBLE_STYLE };
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
      this.bubble.say(bubbleSpec(kind));
      const bob = Math.floor(timeMs / BOB_MS) % 2 === 0 ? 0 : -2;
      this.bubble.place(rescue.victimPos.x, rescue.victimPos.y + BUBBLE_Y + bob);
    } else if (rescue.stage === 'secured' && kind) {
      this.bubble.say(bubbleSpec(kind));
      this.bubble.place(v.sprite.x, rescue.victimPos.y + BUBBLE_Y);
    } else if (rescue.stage === 'completed' && v.sprite.visible && v.sprite.alpha > 0.05) {
      this.bubble.say(bubbleSpec('thanks'));
      this.bubble.place(v.sprite.x, rescue.victimPos.y + BUBBLE_Y, v.sprite.alpha);
    } else {
      this.bubble.say(null);
    }
  }

  private clear(): void {
    if (this.view) this.scene.tweens.killTweensOf(this.view.sprite);
    this.view?.destroy();
    this.view = null;
    this.bubble.say(null);
  }
}
