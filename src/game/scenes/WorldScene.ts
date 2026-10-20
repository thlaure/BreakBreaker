import Phaser from 'phaser';
import { FixedClock } from '../../sim/clock';
import { CONFIG } from '../../sim/config';
import { Sim, type Snapshot } from '../../sim/sim';
import type { InputFrame, SimEvent } from '../../sim/types';
import { createDevKeyboard } from '../input/devKeyboard';
import { HostileLayer, PaulView } from '../render/actors';
import { GroupView, VictimView } from '../render/crowd';
import { RockLayer, TelegraphLayer } from '../render/fx';
import { SchoolView, StationsView, WorldView, makeRockTextures, makeTextures } from '../render/world';

const HIT_STOP_MS = 60;
const SHAKE_MS = 120;
const SHAKE_PX = 2;
const BASE_W = 640;
const BASE_H = 360;

export function integerZoom(width: number, height: number): number {
  const [bw, bh] = height > width ? [BASE_H, BASE_W] : [BASE_W, BASE_H];
  return Math.max(1, Math.floor(Math.min(width / bw, height / bh)));
}

/**
 * Drives the fixed-step Sim and draws it from `sim.snapshot()` each frame.
 * Emits `hud` (Snapshot) and `sim-events` (SimEvent[]) on `this.events` every frame for HUD / audio.
 */
export class WorldScene extends Phaser.Scene {
  sim!: Sim;
  private clock!: FixedClock;
  private input$: () => InputFrame = () => ({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false });
  private disposeKeyboard: (() => void) | null = null;

  private world!: WorldView;
  private school!: SchoolView;
  private stations!: StationsView;
  private group!: GroupView;
  private victim!: VictimView;
  private paul!: PaulView;
  private hostiles!: HostileLayer;
  private rocks!: RockLayer;
  private telegraphs!: TelegraphLayer;

  private hitStopUntil = 0;
  private struck = false;
  private lastVisual = 0;

  constructor() {
    super('world');
  }

  /** Replaces the input source (Task 13: keyboard + touch). The temporary dev keyboard is disposed. */
  setInputSource(fn: () => InputFrame): void {
    this.disposeKeyboard?.();
    this.disposeKeyboard = null;
    this.input$ = fn;
  }

  create(data?: { seed?: number }): void {
    this.sim = new Sim(data?.seed ?? Date.now() >>> 0);
    this.clock = new FixedClock(CONFIG.step, CONFIG.maxCatchUpSteps);
    this.hitStopUntil = 0;
    this.struck = false;
    this.lastVisual = 0;

    const dev = createDevKeyboard();
    this.input$ = dev.read;
    this.disposeKeyboard = dev.dispose;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposeKeyboard?.();
      this.disposeKeyboard = null;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    });

    makeTextures(this);
    makeRockTextures(this);
    this.world = new WorldView(this);
    this.school = new SchoolView(this, this.world.schoolParts);
    this.stations = new StationsView(this);
    this.group = new GroupView(this);
    this.victim = new VictimView(this);
    this.hostiles = new HostileLayer(this);
    this.rocks = new RockLayer(this);
    this.telegraphs = new TelegraphLayer(this);
    const snap = this.sim.snapshot();
    this.paul = new PaulView(this, snap.player.pos);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.width, this.world.height);
    cam.startFollow(this.paul.sprite, true);
    cam.setDeadzone(24, 16);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.render(snap, 0, 16);
  }

  /**
   * Crisp pixels: the canvas fills the window 1:1 (Scale.RESIZE) and only the camera zooms, by an integer:
   * landscape max(1, floor(min(w/640, h/360))), portrait max(1, floor(min(w/360, h/640))).
   * The visible world area varies with the window; sprites never get a fractional scale.
   */
  private applyZoom(): void {
    const { width, height } = this.scale.gameSize;
    const cam = this.cameras.main;
    cam.setSize(width, height);
    cam.setZoom(integerZoom(width, height));
  }

  update(time: number, delta: number): void {
    const steps = this.clock.advance(delta / 1000);
    const events: SimEvent[] = [];
    for (let i = 0; i < steps; i++) events.push(...this.sim.step(this.readInput()));
    const snap = this.sim.snapshot();
    this.react(events, time);
    if (time >= this.hitStopUntil) {
      this.render(snap, time, time - this.lastVisual);
      this.lastVisual = time;
    }
    this.events.emit('hud', snap);
    this.events.emit('sim-events', events);
  }

  private readInput(): InputFrame {
    const f = this.input$();
    if (f.strike) this.struck = true;
    return f;
  }

  private react(events: SimEvent[], time: number): void {
    for (const e of events) {
      if (e.type === 'HitConfirmed') {
        this.hostiles.flash(e.targetLifeId, time);
        this.hitStopUntil = Math.max(this.hitStopUntil, time + HIT_STOP_MS);
      } else if (e.type === 'PlayerDamaged') {
        const cam = this.cameras.main;
        cam.shake(SHAKE_MS, new Phaser.Math.Vector2(SHAKE_PX / cam.width, SHAKE_PX / cam.height), true);
      }
    }
  }

  private render(snap: Snapshot, time: number, dtMs: number): void {
    const flying = new Map(this.sim.rocks.flying().map((r) => [r.id, r.t]));
    this.paul.update(snap.player, this.struck, time, dtMs);
    this.struck = false;
    this.hostiles.update(snap.hostiles, time);
    this.rocks.update(snap.rocks, (id) => flying.get(id) ?? 0, time);
    this.telegraphs.update(snap, this.cameras.main.worldView, time);
    this.group.update(time);
    this.victim.update(snap.rescue, time);
    this.school.update(snap.school.stage);
    this.stations.update(snap.stations);
    this.world.update(snap.player.pos);
  }
}
