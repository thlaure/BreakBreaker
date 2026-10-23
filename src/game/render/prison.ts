import Phaser from 'phaser';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { PrisonInmate } from '../../sim/prison';
import type { SimEvent, Vec } from '../../sim/types';
import { FEET_ORIGIN_Y, idleFrame, walkKey } from './actors';
import { DEPTH, inRect } from './depth';
import {
  INMATE_SCALE,
  INMATE_SLOTS,
  YARD,
  escapeProgress,
  extraText,
  inmateLayout,
  inmatePose,
  inmateTextureKey,
  jailedText,
  shownJailed,
  sweepAngle,
} from './prisonMath';
import { CROWN_SINK, HEAD_TOP, JailVans, type PrisonBodies } from './prisonVans';
import { rioterSheet } from './roleLook';
import { jetPoint } from './serviceMath';
import { FACADE_H, PRISON, PRISON_TOWER, ROOF_OVERHANG } from './world';

export { makePrisonTextures } from './prisonTextures';
export type { PrisonBodies } from './prisonVans';

const OUTLINE = 0x14121c;
const POP_MS = 220;
/** The searchlight's cone: length (px) and half-angle (radians). */
const BEAM_LEN = 150;
const BEAM_HALF = 0.17;

/** The roof's alpha while Paul's feet are under it (as WorldView's roofs). */
const ROOF_FADED = 0.35;

/** One yard slot: the inmate's sprite and crown (pooled, INMATE_SLOTS of them). */
interface Slot {
  sprite: Phaser.GameObjects.Sprite;
  crown: Phaser.GameObjects.Image;
  /** The inmate id drawn in it (-1: empty). */
  id: number;
  key: string;
}

/** The breakout: the yard's inmates running to the gate. */
interface Escape {
  start: number;
  who: { sprite: Phaser.GameObjects.Sprite; crown: Phaser.GameObjects.Image; from: Vec }[];
}

/**
 * The prison's own layer (its building, fire and ruin are the generic TargetView): the « Caïds enfermés : N » counter
 * on its roof, the watchtower's sweeping searchlight while it stands, the jail van on each CaidJailed (it pulls up by
 * the KO'd Caïd's body, which it loads (the lying sprite is hidden, never left behind), then drops him at the gate; the
 * counter goes up when he is in), the exercise yard in the roof's middle where the inmates stand (Snapshot.prison
 * .inmates: up to INMATE_SLOTS Caïd sprites with their crown, idling behind dark bars, « +N » beyond; their texture is
 * prisonMath.inmateTextureKey, the skin hook), and the breakout (PrisonBreakout: the yard's inmates run to the gate,
 * dust, steel bits, « ÉVASION ! »; the bars hang broken while the prison is a ruin).
 */
export class PrisonLayer {
  private readonly counter: Phaser.GameObjects.Text;
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly vans: JailVans;
  private readonly door: Vec;
  private readonly lamp: Vec;
  /** The prison footprint's top-left (the yard's origin) and the roof rect (it fades with Paul under it). */
  private readonly origin: Vec;
  private readonly roofRect: { x: number; y: number; w: number; h: number };
  private readonly yard: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly brokenBars: Phaser.GameObjects.Graphics;
  private readonly extra: Phaser.GameObjects.Text;
  private readonly slots: Slot[] = [];
  private escape: Escape | null = null;
  private shown = -1;
  private popAt = -Infinity;

  constructor(
    scene: Phaser.Scene,
    private readonly pow: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void,
    private readonly reducedMotion: boolean,
    bodies: PrisonBodies = { bodyPos: () => null, carry: () => {} },
  ) {
    const def = DISTRICT.targets.find((t) => t.id === 'prison')!;
    const f = def.footprint;
    const top = f.y + f.h - FACADE_H;
    this.door = { ...def.door };
    this.vans = new JailVans(scene, pow, bodies, this.door);
    this.origin = { x: f.x, y: f.y };
    this.roofRect = { x: f.x, y: f.y - ROOF_OVERHANG, w: f.w, h: f.h - FACADE_H + ROOF_OVERHANG };
    this.yard = scene.add.graphics().setDepth(DEPTH.roof + 0.15);
    this.bars = scene.add.graphics().setDepth(DEPTH.roof + 0.25);
    this.brokenBars = scene.add
      .graphics()
      .setDepth(DEPTH.roof + 0.25)
      .setVisible(false);
    this.drawYard();
    for (let i = 0; i < INMATE_SLOTS; i++) {
      const sprite = scene.add.sprite(0, 0, 'rioter_classic_a', 0).setOrigin(0.5, FEET_ORIGIN_Y).setScale(INMATE_SCALE).setVisible(false);
      const crown = scene.add.image(0, 0, 'badge_crown').setOrigin(0.5, 1).setScale(INMATE_SCALE).setVisible(false);
      this.slots.push({ sprite, crown, id: -1, key: '' });
    }
    this.extra = scene.add
      .text(f.x + YARD.x + YARD.w + 5, f.y + YARD.y + 36, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffd23f',
        backgroundColor: '#14121c',
        padding: { left: 3, right: 3, top: 2, bottom: 1 },
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.roof + 0.27)
      .setVisible(false);
    this.lamp = { x: f.x + PRISON_TOWER.dx + PRISON_TOWER.lampDx, y: top + PRISON_TOWER.lampDy };
    this.counter = scene.add
      .text(f.x + f.w / 2, top - 34, jailedText(0), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffd23f',
        backgroundColor: '#14121c',
        padding: { left: 4, right: 4, top: 3, bottom: 2 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.roof + 0.6);
    this.beam = scene.add
      .graphics()
      .setDepth(DEPTH.roof + 0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.burst = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 600, max: 1100 },
        speed: { min: 50, max: 170 },
        angle: { min: 200, max: 340 },
        gravityY: 200,
        scale: { start: 3, end: 1 },
        tint: [0x6d6a72, 0xc8ccd4, 0x3a3f48, 0xffd23f],
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
  }

  update(s: Snapshot, nowMs: number): void {
    const p = s.prison;
    // the run list changes below; count the Caïds still riding first
    const riding = this.vans.update(nowMs);
    const n = shownJailed(p.jailed, riding);
    if (n !== this.shown) {
      if (this.shown >= 0 && n > this.shown) this.popAt = nowMs;
      this.shown = n;
      this.counter.setText(jailedText(n));
    }
    const pop = this.reducedMotion ? 0 : Math.max(0, 1 - (nowMs - this.popAt) / POP_MS);
    this.counter.setVisible(p.standing).setScale(1 + 0.3 * pop);
    this.counter.setColor(pop > 0 ? '#ffffff' : '#ffd23f');
    this.drawBeam(p.standing && !s.ended, nowMs);
    const alpha = inRect(s.player.pos, this.roofRect) ? ROOF_FADED : 1;
    this.yard.setAlpha(alpha * (p.standing ? 1 : 0.6));
    this.bars.setVisible(p.standing).setAlpha(alpha);
    this.brokenBars.setVisible(!p.standing).setAlpha(alpha * 0.6);
    // the sim empties the cells on the breakout (the inmates run out then): the yard follows the list alone
    this.drawInmates(p.inmates.slice(0, n), alpha, nowMs);
  }

  /** The yard's inmates (the first `inmates`, the ones inside: not those still riding a van), or their run-out. */
  private drawInmates(inmates: readonly PrisonInmate[], alpha: number, nowMs: number): void {
    if (this.escape) {
      if (this.drawEscape(this.escape, alpha, nowMs)) return;
      this.escape = null;
    }
    const { slots, extra } = inmateLayout(inmates.length);
    this.slots.forEach((slot, i) => {
      const at = slots[i];
      const who = inmates[i];
      if (!at || !who) {
        slot.id = -1;
        slot.sprite.setVisible(false);
        slot.crown.setVisible(false);
        return;
      }
      const key = inmateTextureKey(who);
      if (slot.key !== key) {
        slot.key = key;
        slot.sprite.setTexture(key);
      }
      slot.id = who.id;
      const pose = inmatePose(nowMs, who.id, this.reducedMotion);
      const x = Math.round(this.origin.x + at.x);
      const y = Math.round(this.origin.y + at.y);
      // back row behind the front row, all under the bars
      const depth = DEPTH.roof + 0.2 + at.y * 1e-4;
      slot.sprite.anims.stop();
      slot.sprite
        .setFrame(idleFrame(key, pose.dir))
        .setPosition(x, y + pose.bob)
        .setDepth(depth)
        .setAlpha(alpha)
        .setVisible(true);
      this.placeCrown(slot.crown, x, y + pose.bob, depth, alpha);
    });
    this.extra.setVisible(extra > 0).setAlpha(alpha);
    if (extra > 0) this.extra.setText(extraText(extra));
  }

  private placeCrown(crown: Phaser.GameObjects.Image, x: number, y: number, depth: number, alpha: number): void {
    const top = Math.round(y - HEAD_TOP * INMATE_SCALE + CROWN_SINK * INMATE_SCALE);
    crown
      .setPosition(x, top)
      .setDepth(depth + 0.00001)
      .setAlpha(alpha)
      .setVisible(true);
  }

  /** The breakout run-out: each inmate dashes from his slot to the gate and fades; false once over. */
  private drawEscape(e: Escape, alpha: number, nowMs: number): boolean {
    const k = escapeProgress(nowMs - e.start);
    if (k >= 1) {
      for (const w of e.who) {
        w.sprite.anims.stop();
        w.sprite.setVisible(false);
        w.crown.setVisible(false);
      }
      for (const slot of this.slots) slot.id = -1;
      this.extra.setVisible(false);
      return false;
    }
    const to = { x: this.door.x, y: this.door.y - 6 };
    for (const w of e.who) {
      const p = jetPoint(w.from, to, k, 24);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      w.sprite
        .setPosition(x, y)
        .setAlpha(alpha * (1 - k * k))
        .setDepth(DEPTH.roof + 0.26);
      w.crown.setAlpha(alpha * (1 - k * k));
      this.placeCrown(w.crown, x, y, DEPTH.roof + 0.26, alpha * (1 - k * k));
    }
    this.extra.setVisible(false);
    return true;
  }

  onEvents(events: readonly SimEvent[], s: Snapshot, nowMs: number): void {
    // the batch's jailed Caïds are the newest inmates, in jail order
    const jailed = events.filter((e) => e.type === 'CaidJailed').length;
    const fresh = s.prison.inmates.slice(Math.max(0, s.prison.inmates.length - jailed));
    let k = 0;
    for (const e of events) {
      if (e.type === 'CaidJailed') {
        const h = s.hostiles.find((x) => x.lifeId === e.lifeId);
        const inmate = fresh[k++];
        const street = h ? rioterSheet(h.variant, 'boss', h.lifeId) : inmate ? inmateTextureKey(inmate) : 'rioter_classic_a';
        this.vans.jail(h ? h.pos : this.door, h ? h.lifeId : null, street, inmate ? inmateTextureKey(inmate) : street, nowMs);
      } else if (e.type === 'PrisonBreakout') {
        this.vans.clear();
        this.startEscape(nowMs);
        this.burst.emitParticleAt(e.pos.x, e.pos.y - 16, 36);
        this.pow(e.pos.x, e.pos.y - 30, nowMs, 'ÉVASION !', true);
      }
    }
  }

  /** The yard's shown inmates run out to the gate (the sim's released Caïds appear there). */
  private startEscape(nowMs: number): void {
    const who = this.slots
      .filter((sl) => sl.id >= 0 && sl.sprite.visible)
      .map((sl) => ({ sprite: sl.sprite, crown: sl.crown, from: { x: sl.sprite.x, y: sl.sprite.y } }));
    if (who.length === 0 || this.reducedMotion) {
      for (const sl of this.slots) {
        sl.id = -1;
        sl.sprite.setVisible(false);
        sl.crown.setVisible(false);
      }
      return;
    }
    for (const w of who) {
      const key = w.sprite.texture.key;
      w.sprite.anims.play({ key: walkKey(key, 's'), repeat: -1, frameRate: 16 }, true);
    }
    this.escape = { start: nowMs, who };
  }

  /**
   * The exercise yard (footprint-local YARD): a sunken concrete court on the roof with a back wall face, worn court
   * lines and a drain; in front of it the dark bars of its cage (a rail top and middle) and, for the ruin, the same bars
   * bent and torn open.
   */
  private drawYard(): void {
    const ox = this.origin.x + YARD.x;
    const oy = this.origin.y + YARD.y;
    const { w, h } = YARD;
    const g = this.yard;
    const r = (c: number, x: number, y: number, ww: number, hh: number, a = 1): void => {
      g.fillStyle(c, a).fillRect(ox + x, oy + y, ww, hh);
    };
    r(OUTLINE, -3, -3, w + 6, h + 6);
    r(PRISON.concreteHi, -2, -2, w + 4, 1);
    r(0x3b3f47, 0, 0, w, h);
    // the back wall's face (the court is sunken), a darker band at its foot
    r(PRISON.concreteLo, 0, 0, w, 14);
    r(PRISON.concrete, 0, 0, w, 2);
    for (let x = 12; x < w; x += 16) r(0x4a4e56, x, 2, 1, 12);
    r(0x2a2d34, 0, 14, w, 2);
    // worn court lines and a drain
    r(0x8d929b, 6, 62, w - 12, 1, 0.45);
    r(0x8d929b, w / 2, 18, 1, h - 22, 0.3);
    r(OUTLINE, w / 2 - 4, h - 10, 8, 4);
    for (let x = 0; x < 8; x += 2) r(0x5a5e66, w / 2 - 4 + x, h - 9, 1, 2);
    // the cage bars in front of the inmates
    const bar = (gr: Phaser.GameObjects.Graphics, x: number, y: number, ww: number, hh: number, c = 0x14121c, a = 0.9): void => {
      gr.fillStyle(c, a).fillRect(ox + x, oy + y, ww, hh);
    };
    for (let x = 3; x < w - 1; x += 7) {
      bar(this.bars, x, 6, 2, h - 6);
      bar(this.bars, x, 6, 1, h - 6, 0x6d727c, 0.8);
    }
    for (const y of [6, 60]) {
      bar(this.bars, 0, y, w, 3);
      bar(this.bars, 0, y, w, 1, 0x6d727c, 0.8);
    }
    bar(this.bars, 0, h - 3, w, 3);
    // ruined: torn open in the middle, the rest bent
    for (let x = 3; x < w - 1; x += 7) {
      if (x > w / 2 - 22 && x < w / 2 + 18) continue;
      const bend = x < w / 2 ? -1 : 1;
      bar(this.brokenBars, x, 30, 2, h - 30);
      for (let k = 0; k < 4; k++) bar(this.brokenBars, x + bend * k, 30 - k * 6, 2, 6);
    }
    bar(this.brokenBars, 0, h - 3, w, 3);
    bar(this.brokenBars, w / 2 - 30, 60, 10, 3);
    bar(this.brokenBars, w / 2 + 22, 58, 12, 3);
  }

  /** The searchlight's pale cone sweeping the street in front of the prison (still under prefers-reduced-motion). */
  private drawBeam(on: boolean, nowMs: number): void {
    this.beam.clear();
    if (!on) return;
    const a = this.reducedMotion ? Math.PI * 0.43 : sweepAngle(nowMs);
    const { x, y } = this.lamp;
    const p1 = { x: x + Math.cos(a - BEAM_HALF) * BEAM_LEN, y: y + Math.sin(a - BEAM_HALF) * BEAM_LEN };
    const p2 = { x: x + Math.cos(a + BEAM_HALF) * BEAM_LEN, y: y + Math.sin(a + BEAM_HALF) * BEAM_LEN };
    this.beam.fillStyle(0xfff6d0, 0.1).fillTriangle(x, y, p1.x, p1.y, p2.x, p2.y);
    this.beam.fillStyle(0xfff6d0, 0.12).fillEllipse((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 44, 18);
  }
}
