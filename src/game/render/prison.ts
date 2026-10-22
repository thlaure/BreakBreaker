import Phaser from 'phaser';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import {
  HOP_END,
  VAN_PICKUP_DELAY_MS,
  VAN_RUN_MS,
  VAN_TRANSFER_MS,
  hopProgress,
  jailedText,
  shownJailed,
  sweepAngle,
  vanPose,
} from './prisonMath';
import { jetPoint, sirenFrame } from './serviceMath';
import { FACADE_H, PRISON_TOWER } from './world';

const OUTLINE = 0x14121c;
/** Logical pixels drawn ×2, like the props. */
const PX = 2;
const POP_MS = 220;
/** The searchlight's cone: length (px) and half-angle (radians). */
const BEAM_LEN = 150;
const BEAM_HALF = 0.17;

type Fill = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;

/** The jail van (`jail_van_<0|1>`, two flashing-light frames): side view facing east, 36 × 20 logical, west = flipped. */
export function makePrisonTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('jail_van_0')) return;
  const g = scene.make.graphics({}, false);
  const r: Fill = (c, x, y, w, h, a = 1) => {
    g.fillStyle(c, a).fillRect(x, y, w, h);
  };
  for (const f of [0, 1] as const) {
    g.clear();
    // white box body, a steel band, the cab at the front (east)
    r(OUTLINE, 0, 3, 36, 14);
    r(0xe8e8ec, 1, 4, 34, 12);
    r(0xffffff, 1, 4, 34, 1);
    r(0xb8bcc4, 1, 14, 34, 2);
    r(0x3a3f48, 1, 10, 34, 2);
    r(OUTLINE, 26, 4, 1, 10); // cab seam
    r(0x9fd8ef, 28, 5, 6, 4); // windshield
    r(0xe6f7ff, 29, 5, 2, 1);
    r(OUTLINE, 3, 4, 1, 10); // rear door seam
    // barred little windows of the cells in the back
    for (const x of [6, 15]) {
      r(OUTLINE, x, 5, 8, 4);
      r(0x1d2230, x + 1, 6, 6, 2);
      r(0xc8ccd4, x + 2, 6, 1, 2);
      r(0xc8ccd4, x + 5, 6, 1, 2);
    }
    // light bar on the roof (blue lights, flashing in turn)
    r(OUTLINE, 20, 0, 9, 4);
    r(f === 0 ? 0x8adcff : 0x24407a, 21, 1, 3, 2);
    r(f === 1 ? 0x8adcff : 0x24407a, 25, 1, 3, 2);
    r(0xffe066, 34, 12, 2, 2); // headlight
    r(0xff3b30, 0, 12, 1, 2); // tail light
    for (const wx of [4, 25]) {
      r(OUTLINE, wx + 1, 14, 6, 6);
      r(OUTLINE, wx, 15, 8, 4);
      r(0x1d1a24, wx + 2, 15, 4, 4);
      r(0x9aa0aa, wx + 3, 16, 2, 2);
    }
    g.generateTexture(`jail_van_${f}`, 36, 20);
  }
  g.destroy();
}

/** One trip of the jail van: a pickup by a KO'd Caïd, or the drop-off at the prison gate. */
interface Run {
  kind: 'pickup' | 'drop';
  start: number;
  /** Where the van stops (its wheels). */
  at: Vec;
  dir: 1 | -1;
  /** The Caïd's hop: from → to (the body into the van's back, or the van's back to the gate). */
  from: Vec;
  to: Vec;
  van: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  crown: Phaser.GameObjects.Image;
  /** Drop-off: the Caïd passed the gate (the counter counts him). */
  inside: boolean;
}

/**
 * The prison's own layer (its building, fire and ruin are the generic TargetView): the « Caïds enfermés : N » counter
 * on its roof, the watchtower's sweeping searchlight while it stands, the jail van on each CaidJailed (it pulls up by
 * the KO'd Caïd, who hops in with his crown, then drops him at the gate; the counter goes up when he is in), and the
 * breakout burst (PrisonBreakout: dust, steel bits, « ÉVASION ! »).
 */
export class PrisonLayer {
  private readonly counter: Phaser.GameObjects.Text;
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly runs: Run[] = [];
  private readonly door: Vec;
  private readonly lamp: Vec;
  private shown = -1;
  private popAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly pow: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void,
    private readonly reducedMotion: boolean,
  ) {
    const def = DISTRICT.targets.find((t) => t.id === 'prison')!;
    const f = def.footprint;
    const top = f.y + f.h - FACADE_H;
    this.door = { ...def.door };
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
    this.beam = scene.add.graphics().setDepth(DEPTH.roof + 0.3).setBlendMode(Phaser.BlendModes.ADD);
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
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const run = this.runs[i]!;
      if (!this.drawRun(run, nowMs)) {
        this.destroyRun(run);
        this.runs.splice(i, 1);
      }
    }
    const riding = this.runs.filter((r) => r.kind === 'pickup' || !r.inside).length;
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
  }

  onEvents(events: readonly SimEvent[], s: Snapshot, nowMs: number): void {
    for (const e of events) {
      if (e.type === 'CaidJailed') {
        const h = s.hostiles.find((x) => x.lifeId === e.lifeId);
        this.jail(h ? h.pos : this.door, nowMs);
      } else if (e.type === 'PrisonBreakout') {
        for (const run of this.runs) this.destroyRun(run);
        this.runs.length = 0;
        this.burst.emitParticleAt(e.pos.x, e.pos.y - 16, 36);
        this.pow(e.pos.x, e.pos.y - 30, nowMs, 'ÉVASION !', true);
      }
    }
  }

  /** The van picks the Caïd up beside his body, then drops him at the gate. */
  private jail(at: Vec, nowMs: number): void {
    const start = nowMs + VAN_PICKUP_DELAY_MS;
    // pickup: the van stops east of the body, facing east: its back (west end) by the body
    const stop = { x: Math.round(at.x + 40), y: Math.round(at.y) };
    this.runs.push(this.run('pickup', start, stop, 1, { x: at.x, y: at.y - 10 }, { x: stop.x - 28, y: stop.y - 14 }));
    // drop-off: the van comes in from the east and stops west of the gate, facing west: its back (east end) at the gate
    const d = { x: this.door.x - 40, y: this.door.y + 8 };
    this.runs.push(this.run('drop', start + VAN_RUN_MS + VAN_TRANSFER_MS, d, -1, { x: d.x + 28, y: d.y - 14 }, { x: this.door.x, y: this.door.y - 22 }));
  }

  private run(kind: Run['kind'], start: number, at: Vec, dir: 1 | -1, from: Vec, to: Vec): Run {
    const s = this.scene;
    const shadow = s.add.ellipse(0, 0, 68, 12, 0x000000, 0.25).setDepth(DEPTH.decal).setVisible(false);
    const van = s.add.image(0, 0, 'jail_van_0').setOrigin(0.5, 1).setScale(PX).setFlipX(dir < 0).setVisible(false);
    const crown = s.add.image(0, 0, 'badge_crown').setOrigin(0.5, 1).setScale(1.5).setVisible(false);
    return { kind, start, at, dir, from, to, van, shadow, crown, inside: false };
  }

  /** Draws a run at `nowMs`; false once it is over. */
  private drawRun(run: Run, nowMs: number): boolean {
    const age = nowMs - run.start;
    if (age < 0) return true;
    const pose = vanPose(age, run.dir);
    if (!pose) return false;
    const x = Math.round(run.at.x + pose.dx);
    const y = Math.round(run.at.y + 10);
    run.van
      .setTexture(`jail_van_${sirenFrame(nowMs)}`)
      .setPosition(x, y)
      .setDepth(y)
      .setAlpha(pose.alpha)
      .setVisible(true);
    run.shadow.setPosition(x, y - 2).setAlpha(pose.alpha).setVisible(true);
    const k = hopProgress(pose.stage, pose.t);
    // the crown hops along an arc during the stop; outside it stays hidden (with the body or inside the van)
    const hopping = pose.stage === 'stop' && k > 0 && k < 1;
    if (hopping) {
      const c = jetPoint(run.from, run.to, k, 18);
      run.crown.setPosition(Math.round(c.x), Math.round(c.y)).setDepth(y + 1).setVisible(true);
    } else run.crown.setVisible(false);
    if (run.kind === 'drop' && !run.inside && pose.stage !== 'in' && (pose.stage === 'out' || pose.t >= HOP_END)) {
      run.inside = true;
      this.pow(run.to.x, run.to.y - 6, nowMs, 'BOUCLÉ !');
    }
    return true;
  }

  private destroyRun(run: Run): void {
    run.van.destroy();
    run.shadow.destroy();
    run.crown.destroy();
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
