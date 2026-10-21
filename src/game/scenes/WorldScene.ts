import Phaser from 'phaser';
import { FixedClock } from '../../sim/clock';
import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import { Sim, type Snapshot } from '../../sim/sim';
import { stressTarget, stressTick } from '../debug';
import type { InputFrame, SimEvent } from '../../sim/types';
import { GameUi } from '../hud/ui';
import type { CameraView } from '../hud/hud';
import { createKeyboard } from '../input/keyboard';
import { guardLifecycle, merge, type InputSource } from '../input/merge';
import { createTouch } from '../input/touch';
import { Grid } from '../../sim/map/grid';
import { HostileLayer, PaulView } from '../render/actors';
import { PaulHealthBar } from '../render/healthBar';
import { FurieAura, PowBubbles, makeFurieTextures } from '../render/furie';
import { GroupView, VictimView } from '../render/crowd';
import { FirePatchLayer, MolotovFx, RockLayer, TelegraphLayer } from '../render/fx';
import { MonumentView, makeMonumentTextures } from '../render/monument';
import { TargetsLayer, makeTargetTextures } from '../render/targets';
import { StationsView, ToolboxView, WorldView, makeRockTextures, makeTextures } from '../render/world';
import { HeldWeaponView, WeaponLayer, makeWeaponTextures } from '../render/weapons';
import { ItemLayer, makeItemTextures } from '../render/items';
import { ShieldView, SpecialFx, makeSpecialTextures } from '../render/specials';
import { ScorePopups } from '../render/scorePopups';

const HIT_STOP_MS = 60;
const SHAKE_MS = 120;
const SHAKE_PX = 2;
/** Tiny shake on a strike that hits in mode furie (none under prefers-reduced-motion). */
const FURIE_SHAKE_MS = 90;
const FURIE_SHAKE_PX = 1.5;
/** Small shake when the onde d’énergie fires (none under prefers-reduced-motion). */
const BEAM_SHAKE_MS = 160;
const BEAM_SHAKE_PX = 2;
const BASE_W = 640;
const BASE_H = 360;
const PAN_IN_MS = 700;
const PAN_OUT_MS = 500;

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
  private stress = 0;
  private stressState = { n: 0 };
  private clock!: FixedClock;
  private input$: () => InputFrame = () => ({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, strikeHeld: false, throwRock: false, act: false });
  private disposeInput: (() => void) | null = null;
  private ui: GameUi | null = null;
  private sources: InputSource[] = [];
  private playerPos = { x: 0, y: 0 };

  private world!: WorldView;
  private targetViews!: TargetsLayer;
  private monument!: MonumentView;
  private toolboxes!: ToolboxView;
  private molotovFx!: MolotovFx;
  /** Firebombers' bottles flying at where Paul stood, and the fire they leave. */
  private firebombFx!: MolotovFx;
  private firePatches!: FirePatchLayer;
  private stations!: StationsView;
  private group!: GroupView;
  private victim!: VictimView;
  private items!: ItemLayer;
  private paul!: PaulView;
  /** Paul's pixel health bar over his head. */
  private healthBar!: PaulHealthBar;
  private hostiles!: HostileLayer;
  private rocks!: RockLayer;
  private weaponsOnGround!: WeaponLayer;
  private heldWeapon!: HeldWeaponView;
  private telegraphs!: TelegraphLayer;
  private furieAura!: FurieAura;
  private pows!: PowBubbles;
  /** The bouclier held in front of Paul. */
  private shield!: ShieldView;
  /** Onde d’énergie charge glow and beam, shield block sparks. */
  private specialFx!: SpecialFx;
  /** Floating « +N » / « −N » score popups where points were won or lost. */
  private scorePopups!: ScorePopups;
  private reducedMotion = false;

  private hitStopUntil = 0;
  private struck = false;
  private lastVisual = 0;
  /** Camera is showing the school door for the cinematic (follow suspended). */
  private cinematicCam = false;
  private prevAct = false;

  constructor() {
    super('world');
  }

  /** Replaces the input source (tests / alternative devices). Built-in keyboard + touch are disposed. */
  setInputSource(fn: () => InputFrame): void {
    this.disposeInput?.();
    this.disposeInput = null;
    this.input$ = fn;
  }

  /** Releases every held game input (called by the UI when an overlay opens or the session ends). */
  releaseInputs(): void {
    for (const src of this.sources) src.releaseAll();
  }

  cameraView(): CameraView {
    const cam = this.cameras.main;
    return { x: cam.worldView.x, y: cam.worldView.y, zoom: cam.zoom, width: cam.width, height: cam.height };
  }

  /** Rejouer: fresh scene (new Sim), already running. Audio and prefs live outside the scene. */
  restart(): void {
    this.scene.restart({ autostart: true });
  }

  private setupInput(): void {
    const cam = this.cameras.main;
    const sources: InputSource[] = [
      createKeyboard(
        window,
        this.game.canvas,
        (x, y) => {
          const p = cam.getWorldPoint(x, y);
          return { x: p.x, y: p.y };
        },
        () => this.playerPos,
        { onPause: () => this.ui?.togglePause() },
      ),
    ];
    const touchRoot = document.getElementById('touch-ui');
    if (touchRoot) sources.push(createTouch(touchRoot, { onPause: () => this.ui?.togglePause() }));
    const offGuard = guardLifecycle(window, sources, () => this.ui?.openPause());
    // touch: a tap anywhere skips the school cinematic (keyboard/mouse go through the input frame)
    const onTap = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse') return;
      if (e.target instanceof Element && e.target.closest('[data-action=pause]')) return;
      this.trySkipCinematic();
    };
    window.addEventListener('pointerdown', onTap, true);
    this.sources = sources;
    this.input$ = merge(...sources);
    this.disposeInput = () => {
      window.removeEventListener('pointerdown', onTap, true);
      offGuard();
      for (const s of sources) {
        s.releaseAll();
        s.dispose?.();
      }
    };
  }

  create(data?: { seed?: number; autostart?: boolean }): void {
    this.stress = import.meta.env.DEV ? stressTarget() : 0;
    this.sim = new Sim(data?.seed ?? Date.now() >>> 0, { invulnerable: this.stress > 0 });
    this.clock = new FixedClock(CONFIG.step, CONFIG.maxCatchUpSteps);
    this.hitStopUntil = 0;
    this.struck = false;
    this.lastVisual = 0;
    this.cinematicCam = false;
    this.prevAct = false;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ui?.destroy();
      this.ui = null;
      this.disposeInput?.();
      this.disposeInput = null;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    });

    makeTextures(this);
    makeRockTextures(this);
    makeWeaponTextures(this);
    makeItemTextures(this);
    makeTargetTextures(this);
    makeFurieTextures(this);
    makeSpecialTextures(this);
    makeMonumentTextures(this);
    this.reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.world = new WorldView(this);
    this.targetViews = new TargetsLayer(this, this.world.buildingParts);
    this.monument = new MonumentView(this);
    this.stations = new StationsView(this);
    this.group = new GroupView(this);
    this.victim = new VictimView(this);
    this.items = new ItemLayer(this);
    // static map data only (no sim state): where a launched body may land
    const grid = new Grid(DISTRICT);
    this.hostiles = new HostileLayer(this, {
      world: { width: this.world.width, height: this.world.height },
      blocked: (p) => grid.circleBlocked(p, 6) || grid.isGroup(p),
      reducedMotion: this.reducedMotion,
    });
    this.rocks = new RockLayer(this);
    this.weaponsOnGround = new WeaponLayer(this);
    this.telegraphs = new TelegraphLayer(this);
    this.molotovFx = new MolotovFx(this);
    this.firePatches = new FirePatchLayer(this);
    this.firebombFx = new MolotovFx(this, CONFIG.firebomber.flightSec);
    const snap = this.sim.snapshot();
    this.playerPos = { ...snap.player.pos };
    this.furieAura = new FurieAura(this);
    this.paul = new PaulView(this, snap.player.pos);
    this.healthBar = new PaulHealthBar(this, this.reducedMotion);
    this.pows = new PowBubbles(this);
    this.heldWeapon = new HeldWeaponView(this);
    this.shield = new ShieldView(this);
    this.specialFx = new SpecialFx(this);
    this.scorePopups = new ScorePopups(this, this.reducedMotion);
    this.toolboxes = new ToolboxView(this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.width, this.world.height);
    cam.startFollow(this.paul.sprite, true);
    cam.setDeadzone(24, 16);
    this.applyZoom();
    this.setupInput();
    // Coming from the landing's "Jouer" (/jouer/?go): start at once, no start screen.
    const fromLanding = new URLSearchParams(location.search).has('go');
    this.ui = new GameUi(this, data?.autostart ?? fromLanding);
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
    for (let i = 0; i < steps; i++) {
      if (import.meta.env.DEV && this.stress > 0) stressTick(this.sim, this.stress, this.stressState);
      const f = this.readInput();
      // F (rising edge) or Espace / clic (strike) skips the school cinematic
      if ((f.act && !this.prevAct) || f.strike) this.trySkipCinematic();
      this.prevAct = f.act;
      events.push(...this.sim.step(f));
    }
    const snap = this.sim.snapshot();
    this.cinematicCamera(snap);
    this.playerPos = snap.player.pos;
    this.react(events, time, snap);
    // cosmetic, on their own timer (not frozen by the hit-stop or the pause)
    this.scorePopups.update(time);
    if (time >= this.hitStopUntil) {
      this.render(snap, time, time - this.lastVisual);
      this.lastVisual = time;
    }
    this.events.emit('hud', snap);
    this.events.emit('sim-events', events);
  }

  /** Only while the cinematic runs and no overlay pauses the sim. */
  private trySkipCinematic(): void {
    if (this.sim.paused || this.sim.school.stage !== 'cinematic') return;
    this.sim.skipCinematic();
  }

  /** Cinematic: smooth pan to the school door; when it ends, pan back to Paul and follow him again. */
  private cinematicCamera(snap: Snapshot): void {
    const cam = this.cameras.main;
    const on = snap.school.stage === 'cinematic' && !snap.ended;
    if (on === this.cinematicCam) return;
    this.cinematicCam = on;
    if (on) {
      cam.stopFollow();
      cam.pan(DISTRICT.school.door.x, DISTRICT.school.door.y, PAN_IN_MS, 'Sine.easeInOut', true);
      return;
    }
    const target = this.paul.sprite;
    cam.pan(target.x, target.y, PAN_OUT_MS, 'Sine.easeInOut', true, (_c: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress >= 1 && !this.cinematicCam) cam.startFollow(this.paul.sprite, true);
    });
  }

  private readInput(): InputFrame {
    const f = this.input$();
    if (f.strike) this.struck = true;
    return f;
  }

  private react(events: SimEvent[], time: number, snap: Snapshot): void {
    let furieHit = false;
    /** Rank of each body satellised by this batch's beam (take-off stagger). */
    let satellites = 0;
    const scored: Extract<SimEvent, { type: 'ScoreChanged' }>[] = [];
    for (const e of events) {
      if (e.type === 'ScoreChanged') scored.push(e);
      else if (e.type === 'HitConfirmed') {
        this.hostiles.flash(e.targetLifeId, time);
        this.hitStopUntil = Math.max(this.hitStopUntil, time + HIT_STOP_MS);
        if (snap.furie && e.source === 'melee') {
          furieHit = true;
          const h = snap.hostiles.find((x) => x.lifeId === e.targetLifeId);
          if (h) this.pows.spawn(h.pos.x, h.pos.y, time);
        }
      } else if (e.type === 'ActorKnockedOut' && e.launch) {
        const h = snap.hostiles.find((x) => x.lifeId === e.lifeId);
        const index = e.launch.kind === 'satellite' ? satellites++ : 0;
        if (h) this.hostiles.launch(e.lifeId, h.pos, e.launch, time, index);
      } else if (e.type === 'PlayerDamaged') {
        const cam = this.cameras.main;
        cam.shake(SHAKE_MS, new Phaser.Math.Vector2(SHAKE_PX / cam.width, SHAKE_PX / cam.height), true);
      } else if (e.type === 'ShieldBlocked') {
        this.specialFx.block(e.pos, time);
      } else if (e.type === 'BeamFired') {
        this.specialFx.fire(e.from, e.to, snap.player.facing, time);
        if (!this.reducedMotion) {
          const cam = this.cameras.main;
          cam.shake(BEAM_SHAKE_MS, new Phaser.Math.Vector2(BEAM_SHAKE_PX / cam.width, BEAM_SHAKE_PX / cam.height), false);
        }
      } else if (e.type === 'ToolboxPickedUp') {
        this.toolboxes.picked(time);
      } else if (e.type === 'FlagCaptured') {
        this.monument.onEvent(e);
      } else if (e.type === 'FireOut' || e.type === 'BuildingDestroyed' || e.type === 'TargetRepaired') {
        this.targetViews.onEvent(e, time);
      }
    }
    if (scored.length > 0) this.scorePopups.spawn(scored, time);
    if (furieHit && !this.reducedMotion) {
      const cam = this.cameras.main;
      cam.shake(FURIE_SHAKE_MS, new Phaser.Math.Vector2(FURIE_SHAKE_PX / cam.width, FURIE_SHAKE_PX / cam.height), false);
    }
  }

  private render(snap: Snapshot, time: number, dtMs: number): void {
    const flying = new Map(this.sim.rocks.flying().map((r) => [r.id, r.t]));
    // a Frapper press with the onde d’énergie starts a charge, not a swing
    if (snap.weapon?.kind === 'kamehame' || snap.charge) this.struck = false;
    this.paul.update(snap.player, this.struck, time, dtMs, snap.furie !== null);
    this.healthBar.update(snap, this.paul.sprite, time);
    this.furieAura.update(snap.ended ? null : snap.furie, this.paul.sprite, time);
    this.pows.update(time);
    this.heldWeapon.update(snap.weapon, snap.player, this.struck, time);
    this.shield.update(snap.weapon, snap.player, this.paul.sprite, time);
    this.specialFx.update(snap.ended ? null : snap.charge, snap.player, this.paul.sprite, time);
    this.struck = false;
    this.weaponsOnGround.update(snap.weaponsOnGround, time, snap.now);
    this.hostiles.update(snap.hostiles, time);
    this.rocks.update(snap.rocks, (id) => flying.get(id) ?? 0, time);
    this.telegraphs.update(snap, this.cameras.main.worldView, time);
    this.group.update(time);
    this.victim.update(snap.rescue, time);
    this.items.update(snap.rescue, snap.player, time);
    this.targetViews.update(snap, time, dtMs);
    this.monument.update(snap.monument, time);
    this.molotovFx.update(snap.molotovs, snap.now, time);
    this.firePatches.update(snap.firePatches, time);
    this.firebombFx.update(snap.firebombs, snap.now, time);
    this.toolboxes.update(snap.toolboxes, snap.player, time);
    this.stations.update(snap.stations, time);
    this.world.update(snap.player.pos);
  }
}
