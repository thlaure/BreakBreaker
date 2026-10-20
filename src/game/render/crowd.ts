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

/** Rescue victim: elder at victimPos; yellow "!" while threatened; walks away and fades once the rescue ends. */
export class VictimView {
  private view: CharView | null = null;
  private readonly alert: Phaser.GameObjects.Container;
  private leaving = false;
  private key = '';

  constructor(private readonly scene: Phaser.Scene) {
    const g = scene.add.graphics();
    g.fillStyle(0xffd23f, 1).fillTriangle(0, -10, 8, 5, -8, 5);
    g.lineStyle(1, 0x3a2a00, 1).strokeTriangle(0, -10, 8, 5, -8, 5);
    g.fillStyle(0x3a2a00, 1).fillRect(-1, -5, 2, 6).fillRect(-1, 2, 2, 2);
    this.alert = scene.add.container(0, 0, [g]).setDepth(DEPTH.overlay).setVisible(false);
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
    const threat = rescue.stage === 'threat';
    this.alert.setVisible(threat);
    if (threat) {
      const pulse = 1 + 0.12 * Math.sin(timeMs / 120);
      this.alert.setPosition(rescue.victimPos.x, rescue.victimPos.y - 66).setScale(pulse);
    }
  }

  private clear(): void {
    if (this.view) this.scene.tweens.killTweensOf(this.view.sprite);
    this.view?.destroy();
    this.view = null;
    this.alert.setVisible(false);
  }
}
