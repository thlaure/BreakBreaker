import Phaser from 'phaser';
import type { Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { POPUP_CAP, POPUP_INK, popupLayout, popupPose, popupStyle } from './scorePopupMath';

const FONT = '"Press Start 2P", ui-monospace, monospace';

interface Popup {
  text: Phaser.GameObjects.Text;
  /** Scene time (ms) the popup starts (spawn time + its batch stagger). */
  start: number;
  /** Spawn order (the oldest is dropped at the cap). */
  born: number;
  x: number;
  y: number;
  /** Sideways nudge of its rank in the batch (scaled with the zoom like the text). */
  dx: number;
  magnitude: number;
  alive: boolean;
}

/**
 * Floating score popups: « +N » (green) / « -N » (red) pixel texts rising from where points were won or lost, one per
 * ScoreChanged event. A pool of POPUP_CAP texts (the oldest is reused past the cap); each dies on its own timer
 * (cosmetic: pause does not freeze them). Whole-pixel positions; the text, its rise and its sideways nudge are scaled
 * for the camera zoom like the bubbles (×2 at zoom 1), so they look the same on screen at zoom 1 and 2. Depth above
 * everything in the world, below the offscreen indicators.
 */
export class ScorePopups {
  private readonly pool: Popup[] = [];
  private spawned = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reducedMotion: boolean,
  ) {
    for (let i = 0; i < POPUP_CAP; i++) {
      const text = scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: '8px', color: '#fff', stroke: POPUP_INK, strokeThickness: 2 })
        .setShadow(0, 1, POPUP_INK, 0, true, true)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.popup)
        .setVisible(false);
      this.pool.push({ text, start: 0, born: -1, x: 0, y: 0, dx: 0, magnitude: 0, alive: false });
    }
  }

  /** One batch of score changes (a frame's ScoreChanged events, in order): staggered and spread sideways. */
  spawn(batch: readonly { points: number; pos: Vec }[], nowMs: number): void {
    batch.forEach((e, rank) => {
      const p = this.free();
      const style = popupStyle(e.points);
      const { delayMs, dx } = popupLayout(rank);
      p.text.setText(style.text).setColor(style.color).setFontSize(style.size);
      p.text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      p.start = nowMs + delayMs;
      p.born = this.spawned++;
      p.x = e.pos.x;
      p.dx = dx;
      // from the top of a body / a door (feet or door point → a little above)
      p.y = Math.round(e.pos.y - 16);
      p.magnitude = Math.abs(e.points);
      p.alive = true;
      p.text.setVisible(false);
    });
  }

  update(nowMs: number): void {
    const k = Math.max(1, Math.round(2 / (this.scene.cameras.main.zoom || 1)));
    for (const p of this.pool) {
      if (!p.alive) continue;
      const pose = popupPose(nowMs - p.start, p.magnitude, this.reducedMotion);
      if (pose.done) {
        p.alive = false;
        p.text.setVisible(false);
        continue;
      }
      p.text
        .setVisible(pose.alpha > 0)
        .setPosition(Math.round(p.x + p.dx * k), p.y + pose.dy * k)
        .setScale(k * pose.scale)
        .setAlpha(pose.alpha);
    }
  }

  /** A free popup, else the oldest alive one (hard cap). */
  private free(): Popup {
    let oldest = this.pool[0]!;
    for (const p of this.pool) {
      if (!p.alive) return p;
      if (p.born < oldest.born) oldest = p;
    }
    return oldest;
  }
}
