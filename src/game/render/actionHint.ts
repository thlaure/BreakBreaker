import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import type { TargetId } from '../../sim/types';
import { ACTION_WORDS, REPAIRING_VERB, alarmPeriodMs, arrowToward, hintAnchor, steppedPulse } from './actionHintMath';
import { DEPTH } from './depth';

const FONT = '"Press Start 2P", ui-monospace, monospace';
const INK = 0x14121c;
const GOLD = 0xffd166;
const PAPER = 0xfff7e0;
const RED = 0xff3b30;
const KEY = 14;
const PAD = 5;
const GAP = 5;
const H = 22;
const TAIL = 5;
/** Paul's mid-body height above his feet, px: where the toolbox arrow circles. */
const BODY_Y = 22;
const ARROW_R = 30;

/** A 9×9 pixel wrench (gold, ink outline) for the ruins waiting for a repair. */
const WRENCH = ['..KKK....', '.KYYK....', 'KYK.K....', 'KYYKKK...', '.KKYYYK..', '...KYYYK.', '....KYYYK', '.....KYYK', '......KK.'];

export function makeActionHintTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('wrench')) return;
  const g = scene.make.graphics({}, false);
  WRENCH.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === 'K') g.fillStyle(INK, 1).fillRect(x, y, 1, 1);
      else if (c === 'Y') g.fillStyle(GOLD, 1).fillRect(x, y, 1, 1);
    }
  });
  g.generateTexture('wrench', WRENCH[0]!.length, WRENCH.length);
  g.destroy();
}

function touchMode(): boolean {
  return typeof document !== 'undefined' && !!document.getElementById('touch-ui')?.classList.contains('visible');
}

/**
 * The in-world action prompt (Snapshot.actionHint): a pixel bubble above the target with a « F » keycap and the verb
 * (« F · Réparer », « F · Appeler les pompiers »…; touch: the verb alone, the Agir button pulses), a ring filling round
 * the keycap during the repair, « Il faut une caisse à outils » with a toolbox icon and an arrow around Paul toward the
 * nearest toolbox on the ground. Also: a pulsing wrench over every ruin while Paul carries a toolbox, and a red flash
 * plus a pulsing ring at the door of every place under attack (faster as its health falls). Steady under reduced motion.
 */
export class ActionHintLayer {
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly key: Phaser.GameObjects.Text;
  private readonly verb: Phaser.GameObjects.Text;
  private readonly box: Phaser.GameObjects.Image;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly alarms: Phaser.GameObjects.Graphics;
  private readonly flashes: Phaser.GameObjects.Graphics;
  private readonly wrenches = new Map<TargetId, Phaser.GameObjects.Image>();
  private shownKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reducedMotion: boolean,
  ) {
    this.bg = scene.add.graphics();
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    this.key = scene.add.text(0, 0, 'F', { ...style, color: '#14121c' }).setOrigin(0.5, 0.5);
    this.verb = scene.add.text(0, 0, '', style).setOrigin(0, 0.5);
    this.box = scene.add.image(0, 0, 'toolbox').setOrigin(0.5, 0.5).setVisible(false);
    this.bubble = scene.add.container(0, 0, [this.bg, this.key, this.verb, this.box]).setDepth(DEPTH.popup - 2).setVisible(false);
    this.arrow = scene.add.graphics().setDepth(DEPTH.overlay + 1);
    this.alarms = scene.add.graphics().setDepth(DEPTH.decal + 2);
    this.flashes = scene.add.graphics().setDepth(DEPTH.roof + 5).setBlendMode(Phaser.BlendModes.ADD);
  }

  update(s: Snapshot, nowMs: number): void {
    const h = s.ended ? null : s.actionHint;
    this.updateBubble(s, nowMs);
    this.updateArrow(s, nowMs);
    this.updateWrenches(s, nowMs, h?.target ?? null);
    this.updateAlarms(s, nowMs);
  }

  private updateBubble(s: Snapshot, nowMs: number): void {
    const h = s.ended ? null : s.actionHint;
    const kit = s.toolboxes;
    const repairing = !s.ended && kit.started && kit.repairTarget !== null;
    const target = repairing ? kit.repairTarget : h?.target ?? null;
    if (target === null || s.player.ko) {
      this.bubble.setVisible(false);
      return;
    }
    const need = !repairing && h?.kind === 'needToolbox';
    const touch = touchMode();
    const showKey = !need && !touch;
    const text = repairing ? REPAIRING_VERB : ACTION_WORDS[h!.kind].verb;
    const layoutKey = `${text}|${showKey}|${need}`;
    if (layoutKey !== this.shownKey) {
      this.shownKey = layoutKey;
      this.verb.setText(text).setColor(need ? '#ffd166' : '#ffffff');
      this.verb.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.key.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const lead = showKey ? KEY + GAP : need ? 16 + GAP : 0;
    const w = PAD * 2 + lead + Math.ceil(this.verb.width);
    const x0 = -Math.round(w / 2);
    const y0 = -H - TAIL;
    const g = this.bg.clear();
    const edge = need ? GOLD : PAPER;
    // stepped pixel box: ink fill, a 2 px border, a hard drop shadow, a tail pointing down at the target
    g.fillStyle(0x000000, 0.6).fillRect(x0 + 2, y0 + 2, w, H);
    g.fillStyle(edge, 1).fillRect(x0, y0, w, H);
    g.fillStyle(INK, 1).fillRect(x0 + 2, y0 + 2, w - 4, H - 4);
    g.fillStyle(edge, 1).fillTriangle(-TAIL, -TAIL - 1, TAIL, -TAIL - 1, 0, 0);
    const cy = y0 + H / 2;
    let x = x0 + PAD;
    this.key.setVisible(showKey);
    this.box.setVisible(need);
    if (showKey) {
      const kx = x;
      const ky = Math.round(cy - KEY / 2);
      g.fillStyle(0x9a948c, 1).fillRect(kx, ky + 2, KEY, KEY - 1);
      g.fillStyle(PAPER, 1).fillRect(kx, ky, KEY, KEY - 2);
      this.key.setPosition(kx + KEY / 2 + 0.5, ky + (KEY - 2) / 2 + 0.5);
      if (repairing) {
        // the ring fills round the keycap over the 2 s repair
        const frac = Math.min(1, kit.progress / CONFIG.kit.repairSec);
        const start = -Math.PI / 2;
        g.lineStyle(3, INK, 0.8).strokeCircle(kx + KEY / 2, cy, KEY / 2 + 3);
        g.lineStyle(2, 0xffb03a, 1).beginPath().arc(kx + KEY / 2, cy, KEY / 2 + 3, start, start + frac * Math.PI * 2).strokePath();
      }
      x += KEY + GAP;
    } else if (need) {
      this.box.setPosition(x + 8, cy);
      x += 16 + GAP;
    } else if (repairing) {
      // touch: no keycap, a progress bar under the verb
      const frac = Math.min(1, kit.progress / CONFIG.kit.repairSec);
      g.fillStyle(0x4a4360, 1).fillRect(x0 + 4, y0 + H - 5, w - 8, 2);
      g.fillStyle(0xffb03a, 1).fillRect(x0 + 4, y0 + H - 5, Math.round((w - 8) * frac), 2);
    }
    this.verb.setPosition(x, cy + 0.5);
    const a = hintAnchor(target);
    const bob = this.reducedMotion ? 0 : Math.round(Math.sin(nowMs / 260));
    this.bubble.setPosition(a.x, a.y - bob).setVisible(true);
  }

  /** needToolbox: a gold arrow around Paul toward the nearest toolbox on the ground. */
  private updateArrow(s: Snapshot, nowMs: number): void {
    const g = this.arrow.clear();
    const h = s.actionHint;
    if (s.ended || s.player.ko || h?.kind !== 'needToolbox' || !h.toolbox) return;
    const from = { x: s.player.pos.x, y: s.player.pos.y - BODY_Y };
    const p = arrowToward(from, h.toolbox, ARROW_R + (this.reducedMotion ? 0 : Math.round(2 * steppedPulse(nowMs, 600))));
    if (!p) return;
    const c = Math.cos(p.angle);
    const sn = Math.sin(p.angle);
    const pt = (fx: number, fy: number) => ({ x: p.x + fx * c - fy * sn, y: p.y + fx * sn + fy * c });
    const tip = pt(10, 0);
    const l = pt(-7, -8);
    const r = pt(-7, 8);
    g.fillStyle(INK, 1).fillTriangle(tip.x + 1, tip.y + 1, l.x + 1, l.y + 1, r.x + 1, r.y + 1);
    g.fillStyle(GOLD, 1).fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
  }

  /** Paul carries a toolbox: a pulsing wrench over every ruin (not the one the bubble already names). */
  private updateWrenches(s: Snapshot, nowMs: number, bubbleOn: TargetId | null): void {
    const show = !s.ended && s.toolboxes.carried && !s.player.ko;
    const seen = new Set<TargetId>();
    if (show) {
      for (const t of s.targets) {
        if (t.state !== 'ruined' || t.id === bubbleOn) continue;
        seen.add(t.id);
        let w = this.wrenches.get(t.id);
        if (!w) {
          const a = hintAnchor(t.id);
          w = this.scene.add.image(a.x, a.y - 8, 'wrench').setOrigin(0.5, 1).setDepth(DEPTH.popup - 3);
          this.wrenches.set(t.id, w);
        }
        const k = steppedPulse(nowMs, 700, this.reducedMotion);
        w.setScale(this.reducedMotion ? 2 : 2 + Math.round(k)).setAlpha(0.7 + 0.3 * k);
      }
    }
    for (const [id, w] of this.wrenches) {
      if (seen.has(id)) continue;
      w.destroy();
      this.wrenches.delete(id);
    }
  }

  /** Every place under an urgent attack: a red flash over it and a pulsing ring at its door, faster as hp falls. */
  private updateAlarms(s: Snapshot, nowMs: number): void {
    const ring = this.alarms.clear();
    const flash = this.flashes.clear();
    if (s.ended) return;
    for (const t of s.targets) {
      if (t.state !== 'attacked') continue;
      const period = alarmPeriodMs(t.hp / t.maxHp);
      const k = steppedPulse(nowMs, period, this.reducedMotion);
      const d = t.door;
      const r = this.reducedMotion ? 26 : 20 + Math.round(10 * k);
      ring.lineStyle(3, INK, 0.5).strokeEllipse(d.x, d.y + 2, r * 2 + 2, r + 2);
      ring.lineStyle(2, RED, this.reducedMotion ? 0.7 : 0.4 + 0.5 * k).strokeEllipse(d.x, d.y, r * 2, r);
      const f = t.footprint;
      flash.fillStyle(RED, this.reducedMotion ? 0.12 : 0.28 * k).fillRect(f.x, f.y - 24, f.w, f.h + 24);
    }
  }
}
