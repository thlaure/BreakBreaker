import Phaser from 'phaser';
import type { Vec } from '../../sim/types';
import { FEET_ORIGIN_Y, idleFrame, koFrame } from './actors';
import { DEPTH } from './depth';
import { HOP_END, HOP_START, VAN_PICKUP_DELAY_MS, VAN_RUN_MS, VAN_TRANSFER_MS, hopProgress, ridingCount, vanPose } from './prisonMath';
import { jetPoint, sirenFrame } from './serviceMath';

/** Logical pixels drawn ×2, like the props. */
const PX = 2;
/** Head top above the feet in an LPC frame at scale 1 (the crown sits on it, as on the street). */
export const HEAD_TOP = 44;
export const CROWN_SINK = 3;

/** What the prison needs from the hostile layer: where a KO body is drawn, and loading it into the van. */
export interface PrisonBodies {
  bodyPos(lifeId: number): Vec | null;
  carry(lifeId: number): void;
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
  /** The Caïd himself hopping with his crown (lying for the pickup, standing for the drop-off). */
  body: Phaser.GameObjects.Sprite;
  /** Pickup: the KO body's lifeId (null when it was not on the map), anchored at its drawn spot, loaded (hidden). */
  lifeId: number | null;
  anchored: boolean;
  loaded: boolean;
  /** Drop-off: the Caïd passed the gate (the counter counts him). */
  inside: boolean;
}

/** The jail van's trips (PrisonLayer's): pickups by the KO'd Caïds' bodies and drop-offs at the prison gate. */
export class JailVans {
  private readonly runs: Run[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly pow: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void,
    private readonly bodies: PrisonBodies,
    private readonly door: Vec,
  ) {}

  /** Draws every run at `nowMs`, dropping those over; returns how many Caïds still ride a van. */
  update(nowMs: number): number {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const run = this.runs[i]!;
      if (!this.drawRun(run, nowMs)) {
        this.destroyRun(run);
        this.runs.splice(i, 1);
      }
    }
    return ridingCount(this.runs);
  }

  /** Every run cut short (the breakout). */
  clear(): void {
    for (const run of this.runs) this.destroyRun(run);
    this.runs.length = 0;
  }

  /**
   * The van picks the Caïd up beside his body (`lifeId`'s, wherever it is drawn when the van comes; `street` its sheet)
   * and loads it, then drops him (`inmate` sheet) at the gate.
   */
  jail(at: Vec, lifeId: number | null, street: string, inmate: string, nowMs: number): void {
    const start = nowMs + VAN_PICKUP_DELAY_MS;
    const pickup = this.run('pickup', start, { x: 0, y: 0 }, 1, at, at, street);
    pickup.lifeId = lifeId;
    this.anchorPickup(pickup, at);
    this.runs.push(pickup);
    // drop-off: the van comes in from the east and stops west of the gate, facing west: its back (east end) at the gate
    const d = { x: this.door.x - 40, y: this.door.y + 8 };
    this.runs.push(
      this.run(
        'drop',
        start + VAN_RUN_MS + VAN_TRANSFER_MS,
        d,
        -1,
        { x: d.x + 28, y: d.y - 14 },
        { x: this.door.x, y: this.door.y - 22 },
        inmate,
      ),
    );
  }

  /** The pickup stops east of the body `at`, facing east: its back (west end) by the body, which hops in. */
  private anchorPickup(run: Run, at: Vec): void {
    run.at = { x: Math.round(at.x + 40), y: Math.round(at.y) };
    run.from = { x: at.x, y: at.y };
    run.to = { x: run.at.x - 28, y: run.at.y - 4 };
  }

  private run(kind: Run['kind'], start: number, at: Vec, dir: 1 | -1, from: Vec, to: Vec, sheet: string): Run {
    const s = this.scene;
    const shadow = s.add.ellipse(0, 0, 68, 12, 0x000000, 0.25).setDepth(DEPTH.decal).setVisible(false);
    const van = s.add
      .image(0, 0, 'jail_van_0')
      .setOrigin(0.5, 1)
      .setScale(PX)
      .setFlipX(dir < 0)
      .setVisible(false);
    const crown = s.add.image(0, 0, 'badge_crown').setOrigin(0.5, 1).setScale(1.5).setVisible(false);
    const frame = kind === 'pickup' ? koFrame(sheet) : idleFrame(sheet, 'n');
    const body = s.add.sprite(0, 0, sheet, frame).setOrigin(0.5, FEET_ORIGIN_Y).setScale(1.5).setVisible(false);
    return { kind, start, at, dir, from, to, van, shadow, crown, body, lifeId: null, anchored: false, loaded: false, inside: false };
  }

  /** Draws a run at `nowMs`; false once it is over. */
  private drawRun(run: Run, nowMs: number): boolean {
    const age = nowMs - run.start;
    if (age < 0) return true;
    if (run.kind === 'pickup' && !run.anchored) {
      // the van drives up to the body where it lies now (after its fall's travel or a furie flight)
      run.anchored = true;
      const at = run.lifeId !== null ? this.bodies.bodyPos(run.lifeId) : null;
      if (at) this.anchorPickup(run, at);
    }
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
    run.shadow
      .setPosition(x, y - 2)
      .setAlpha(pose.alpha)
      .setVisible(true);
    const k = hopProgress(pose.stage, pose.t);
    // the van loads the body: the lying sprite on the street goes the moment the hop starts, never left behind
    if (run.kind === 'pickup' && !run.loaded && (pose.stage === 'out' || (pose.stage === 'stop' && pose.t >= HOP_START))) this.load(run);
    // the Caïd hops along an arc with his crown during the stop; outside it he is hidden (on the street or in the van)
    const hopping = pose.stage === 'stop' && k > 0 && k < 1;
    if (hopping) {
      const c = jetPoint(run.from, run.to, k, 18);
      const bx = Math.round(c.x);
      const by = Math.round(c.y);
      // shrinking into the van's back / through the gate at the end
      const sc = 1.5 * (k > 0.7 ? 1 - ((k - 0.7) / 0.3) * 0.5 : 1);
      run.body
        .setPosition(bx, by)
        .setScale(sc)
        .setDepth(y + 1)
        .setVisible(true);
      run.crown
        .setPosition(bx, Math.round(by - (run.kind === 'pickup' ? 12 : HEAD_TOP - CROWN_SINK) * sc))
        .setScale(sc)
        .setDepth(y + 1.01)
        .setVisible(true);
    } else {
      run.body.setVisible(false);
      run.crown.setVisible(false);
    }
    if (run.kind === 'drop' && !run.inside && pose.stage !== 'in' && (pose.stage === 'out' || pose.t >= HOP_END)) {
      run.inside = true;
      this.pow(run.to.x, run.to.y - 6, nowMs, 'BOUCLÉ !');
    }
    return true;
  }

  /** The pickup van takes the body: it leaves the street now (the sim takes it off the map a little later). */
  private load(run: Run): void {
    run.loaded = true;
    if (run.lifeId !== null) this.bodies.carry(run.lifeId);
  }

  private destroyRun(run: Run): void {
    // a pickup cut short (breakout): the body goes all the same, he was jailed (the breakout frees him at the gate)
    if (run.kind === 'pickup' && !run.loaded) this.load(run);
    run.van.destroy();
    run.shadow.destroy();
    run.crown.destroy();
    run.body.destroy();
  }
}
