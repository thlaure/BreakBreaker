import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import { DEPTH } from './depth';
import { pickupBlinkOff } from './pickupBlink';

/** Heal stations: green cross + "Soins"; greyed once used (walking onto a charged one heals). */
export class StationsView {
  private readonly items: { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse }[] = [];

  constructor(scene: Phaser.Scene) {
    for (const pos of DISTRICT.stations) {
      const icon = scene.add.image(pos.x, pos.y, 'station').setDepth(pos.y);
      const label = scene.add
        .text(pos.x, pos.y + 12, 'Soins', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#e8ffe8',
          stroke: '#14121c',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0)
        .setDepth(pos.y + 0.1);
      const glow = scene.add.ellipse(pos.x, pos.y + 8, 30, 12, 0x5ee07a, 0.3).setDepth(pos.y - 1);
      this.items.push({ icon, label, glow });
    }
  }

  update(list: Snapshot['stations'], nowMs: number): void {
    list.forEach((st, i) => {
      const it = this.items[i];
      if (!it) return;
      it.icon.setTint(st.charged ? 0xffffff : 0x6a6a6a).setAlpha(st.charged ? 1 : 0.7);
      // Charged kits float and pulse so they read as pickups; used ones sit still.
      const phase = nowMs / 1000 + i;
      const bob = st.charged ? Math.round(2 * Math.sin(phase * 3)) : 0;
      it.icon.setY(st.pos.y - bob).setScale(st.charged ? 1 + 0.08 * (0.5 + 0.5 * Math.sin(phase * 4)) : 1);
      it.glow.setVisible(st.charged).setAlpha(0.15 + 0.3 * (0.5 + 0.5 * Math.sin(phase * 4)));
      it.label.setAlpha(st.charged ? 1 : 0.5);
    });
  }
}

/**
 * Small field heals: the station's heal kit at a smaller size, bobbing over a green glow, with a « +10 » tag; it
 * blinks during its last PICKUP_BLINK_SEC s on the ground (pickupBlinkOff, like the weapons).
 */
export class FieldHealView {
  private readonly items = new Map<
    number,
    { icon: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse }
  >();

  constructor(private readonly scene: Phaser.Scene) {}

  update(list: Snapshot['fieldHeals'], nowMs: number, simNow: number): void {
    const seen = new Set<number>();
    for (const h of list) {
      seen.add(h.id);
      let it = this.items.get(h.id);
      if (!it) {
        const glow = this.scene.add.ellipse(h.pos.x, h.pos.y + 6, 20, 8, 0x5ee07a, 0.3).setDepth(h.pos.y - 1);
        const icon = this.scene.add.image(h.pos.x, h.pos.y, 'station').setScale(0.625).setDepth(h.pos.y);
        const tag = this.scene.add
          .text(h.pos.x, h.pos.y - 10, `+${CONFIG.fieldHeal.amount}`, {
            fontFamily: 'monospace',
            fontSize: '8px',
            color: '#7bd88f',
            stroke: '#14121c',
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(h.pos.y + 0.1);
        it = { icon, tag, glow };
        this.items.set(h.id, it);
      }
      const phase = nowMs / 1000 + h.id;
      const bob = Math.round(2 * Math.sin(phase * 3));
      const pulse = 0.5 + 0.5 * Math.sin(phase * 4);
      it.icon.setY(h.pos.y - 2 - bob);
      it.tag.setY(h.pos.y - 10 - bob);
      it.glow.setAlpha(0.15 + 0.3 * pulse);
      const off = pickupBlinkOff(h.expiresAt, simNow, nowMs);
      it.icon.setAlpha(off ? 0.2 : 1);
      it.tag.setAlpha(off ? 0.2 : 1);
      if (off) it.glow.setAlpha(0.05);
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      it.icon.destroy();
      it.tag.destroy();
      it.glow.destroy();
      this.items.delete(id);
    }
  }
}

const TOOLBOX_POP_MS = 250;
/** Repair ring around Paul's body (radius, centre height above his feet). */
const RING_R = 20;
const RING_LIFT = 22;

/**
 * Toolboxes: ground pickups that float and pulse like the heal kits, a toolbox icon over Paul while he carries one,
 * and a ring around him that fills while he repairs a ruin (`progress / repairSec`).
 */
export class ToolboxView {
  private readonly items = new Map<
    number,
    { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse }
  >();
  private readonly carried: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private ringDrawn = false;
  private popUntil = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.carried = scene.add
      .image(0, 0, 'toolbox')
      .setOrigin(0.5, 1)
      .setScale(2)
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
    this.ring = scene.add.graphics().setDepth(DEPTH.overlay - 2);
  }

  /** Little scale pop of the carried icon on pickup. */
  picked(nowMs: number): void {
    this.popUntil = nowMs + TOOLBOX_POP_MS;
  }

  update(tb: Snapshot['toolboxes'], player: Snapshot['player'], nowMs: number): void {
    const seen = new Set<number>();
    for (const g of tb.ground) {
      seen.add(g.id);
      let it = this.items.get(g.id);
      if (!it) {
        const s = this.scene;
        it = {
          glow: s.add.ellipse(g.pos.x, g.pos.y + 9, 30, 12, 0xff8a3a, 0.3).setDepth(g.pos.y - 1),
          icon: s.add.image(g.pos.x, g.pos.y, 'toolbox').setScale(2).setDepth(g.pos.y),
          label: s.add
            .text(g.pos.x, g.pos.y + 13, 'Outils', {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#ffe2c8',
              stroke: '#14121c',
              strokeThickness: 2,
            })
            .setOrigin(0.5, 0)
            .setDepth(g.pos.y + 0.1),
        };
        this.items.set(g.id, it);
      }
      // same float / pulse as the heal kits
      const phase = nowMs / 1000 + g.id;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 4);
      it.icon.setY(g.pos.y - Math.round(2 * Math.sin(phase * 3))).setScale(2 * (1 + 0.08 * pulse));
      it.glow.setAlpha(0.15 + 0.3 * pulse);
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      it.icon.destroy();
      it.label.destroy();
      it.glow.destroy();
      this.items.delete(id);
    }

    const show = tb.carried && !player.ko;
    this.carried.setVisible(show);
    if (show) {
      const pop = nowMs < this.popUntil ? (this.popUntil - nowMs) / TOOLBOX_POP_MS : 0;
      const bob = Math.round(1.5 * Math.sin(nowMs / 220));
      this.carried.setPosition(Math.round(player.pos.x), Math.round(player.pos.y) - 56 - bob).setScale(2 + pop);
    }

    const frac = Math.min(1, tb.progress / CONFIG.kit.repairSec);
    if (frac <= 0 || player.ko) {
      if (this.ringDrawn) this.ring.clear();
      this.ringDrawn = false;
      return;
    }
    this.ringDrawn = true;
    const x = Math.round(player.pos.x);
    const y = Math.round(player.pos.y) - RING_LIFT;
    const start = -Math.PI / 2;
    this.ring
      .clear()
      .lineStyle(6, 0x14121c, 0.7)
      .strokeCircle(x, y, RING_R)
      .lineStyle(4, 0xffb03a, 1)
      .beginPath()
      .arc(x, y, RING_R, start, start + frac * Math.PI * 2)
      .strokePath();
  }
}
