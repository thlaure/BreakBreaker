import type { SimEvent } from '../sim/types';
import { SFX } from './assets';
import { boingVoice, clankVoice, popVoice, thumpVoice, tockVoice, whooshVoice } from './audioImpacts';
import { chimeVoice, energyReadyVoice, powerDownVoice, powerUpVoice, sirenVoice, zapVoice } from './audioCues';
import { chargeHumNodes, furieHumNodes } from './audioHums';
import { StageRiff } from './audioStage';
import { HEAVY_RATE, isImpactSfx, pitchJitter, type Sfx } from './audioMath';

export { HEAVY_RATE, PITCH_JITTER, isImpactSfx, pitchJitter, threatLevel } from './audioMath';
export type { Sfx } from './audioMath';

/** Encoded sound files fetched once by BootScene (Phaser loader, binary); decoded by GameAudio at unlock. */
const encoded = new Map<Sfx, ArrayBuffer>();

/** Called by BootScene after loading: no network fetch happens in GameAudio. */
export function provideSfx(data: Iterable<[Sfx, ArrayBuffer]>): void {
  for (const [k, v] of data) encoded.set(k, v);
}

const MAX_VOICES = 8;
const SFX_GAIN = 0.7;
const AMBIENCE_GAIN = 0.5;
const FIRE_MAX = 0.6;

/**
 * Raw WebAudio. The AudioContext is created only by `unlock()` (called from the Commencer click).
 * Any failure leaves the game silent but running. Groups: sfx and ambience gains feed a master gain (mute).
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private buffers = new Map<Sfx, AudioBuffer>();
  private voices = 0;
  private muted = false;
  private threat = 0;
  private alarmed = new Set<string>();
  private unlocking: Promise<void> | null = null;
  /** Mode furie hum while on (one voice of the cap); null when off. */
  private hum: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  /** Onde d’énergie charge hum (rising, one voice of the cap); null when not charging. */
  private chargeHum: { osc: OscillatorNode; gain: GainNode } | null = null;
  /** The stage band's loop, built on first use once unlocked. */
  private stage: StageRiff | null = null;

  constructor(muted = false) {
    this.muted = muted;
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Creates the context inside a user gesture, then decodes the preloaded buffers. Never throws. */
  unlock(): Promise<void> {
    if (this.unlocking) return this.unlocking;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return Promise.resolve();
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = SFX_GAIN;
      this.sfxBus.connect(this.master);
      const ambience = ctx.createGain();
      ambience.gain.value = AMBIENCE_GAIN;
      ambience.connect(this.master);
      this.fireGain = ctx.createGain();
      this.fireGain.gain.value = 0;
      this.fireGain.connect(ambience);
      void ctx.resume().catch(() => undefined);
    } catch (err) {
      console.warn('Audio unavailable (game continues muted):', err);
      this.ctx = null;
      return Promise.resolve();
    }
    this.unlocking = this.loadAll().catch((err) => console.warn('Audio load failed:', err));
    return this.unlocking;
  }

  private async loadAll(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      SFX.map(async (key) => {
        const data = encoded.get(key);
        if (!data) return;
        try {
          // decodeAudioData detaches its input: decode a copy so the preloaded bytes stay usable.
          this.buffers.set(key, await ctx.decodeAudioData(data.slice(0)));
        } catch {
          /* one missing sound is not fatal */
        }
      }),
    );
    this.startFire();
  }

  private startFire(): void {
    const buf = this.buffers.get('fire_loop');
    if (!this.ctx || !this.fireGain || !buf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.fireGain);
      src.start();
    } catch {
      /* ignore */
    }
  }

  /** New run: forget per-run bookkeeping (alarm per incident id) and silence the fire loop. */
  reset(): void {
    this.alarmed.clear();
    this.setThreat(0);
    this.stopHum();
    this.stopCharge();
    this.stage?.stop();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.stage?.setMuted(muted);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** Fire loop volume follows the threat (see `threatLevel`): 0..1 of FIRE_MAX. */
  setThreat(level: number): void {
    this.threat = Math.max(0, Math.min(1, level));
    if (this.fireGain && this.ctx) this.fireGain.gain.setTargetAtTime(this.threat * FIRE_MAX, this.ctx.currentTime, 0.15);
  }

  /** Stage music: distance in px from Paul to the stage every frame, null when the game is over or paused (silent). */
  setStageProximity(dist: number | null): void {
    if (!this.ctx || !this.master) return;
    if (!this.stage) {
      if (dist === null) return;
      this.stage = new StageRiff(this.ctx, this.master, this.muted);
    }
    this.stage.setProximity(dist);
  }

  /** Called on Commencer / Reprendre / Rejouer only (never automatically on visibilitychange). */
  resume(): void {
    void this.ctx?.resume().catch(() => undefined);
  }

  /** Called whenever an overlay pauses the sim (pause menu, summary) and when the page is hidden. */
  suspend(): void {
    void this.ctx?.suspend().catch(() => undefined);
  }

  /** An impact sample (isImpactSfx) gets a random ±PITCH_JITTER on top of `rate` (only when it actually plays). */
  play(key: Sfx, delaySec = 0, rate = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(key);
    if (!ctx || !this.sfxBus || !buf || this.voices >= MAX_VOICES) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = isImpactSfx(key) ? rate * this.pitch() : rate;
      src.connect(this.sfxBus);
      this.voices += 1;
      src.onended = (): void => {
        this.voices -= 1;
        src.disconnect();
      };
      src.start(ctx.currentTime + Math.max(0, delaySec));
    } catch {
      /* silent */
    }
  }

  /** Random pitch factor of an impact (1 when muted: nothing is drawn); called only once a voice actually plays. */
  private pitch(): number {
    return this.muted ? 1 : pitchJitter(Math.random());
  }

  /** Short voice on the sfx bus (synthesised cues share the voice cap with the samples). */
  private voice(build: (ctx: AudioContext, out: AudioNode, t: number) => AudioScheduledSourceNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.voices >= MAX_VOICES) return;
    try {
      const src = build(ctx, this.sfxBus, ctx.currentTime);
      this.voices += 1;
      src.onended = (): void => {
        this.voices -= 1;
        src.disconnect();
      };
    } catch {
      /* silent */
    }
  }

  /** Bright two-note chime (sine 660 → 880 Hz, 120 ms each): a target saved or repaired, a round won. */
  chime(): void {
    this.voice(chimeVoice);
  }

  /**
   * Energy gauge reached a threshold: a soft sine ping (988 Hz, 0.25 s) when the onde becomes available, a brighter
   * triangle arpeggio (784 → 1175 → 1568 Hz) when it is full (furie available).
   */
  energyReady(level: 'onde' | 'furie'): void {
    this.voice((ctx, out, t) => energyReadyVoice(ctx, out, t, level));
  }

  /** Furie / Onde refused (too little energy): a dull 0.08 s low square « tock » (220 → 110 Hz, low-passed; jittered). */
  tock(): void {
    this.voice((ctx, out, t) => tockVoice(ctx, out, t, this.pitch()));
  }

  /** A shooter's bullet: a tiny cartoon « pop » (0.06 s noise click through a band-pass, quiet: bursts of 3; jittered). */
  pop(): void {
    this.voice((ctx, out, t) => popVoice(ctx, out, t, this.pitch()));
  }

  /** Flashball shot: a low « thump » (sine 150 → 55 Hz, 0.16 s; jittered). */
  thump(): void {
    this.voice((ctx, out, t) => thumpVoice(ctx, out, t, this.pitch()));
  }

  /** The glove lands: a springy « boing » (triangle wobbling 220 ↔ 330 Hz at 18 Hz, falling, 0.3 s; jittered). */
  boing(): void {
    this.voice((ctx, out, t) => boingVoice(ctx, out, t, this.pitch()));
  }

  /** Mode furie on: a 0.5 s square sweep rising 196 → 1046 Hz with a bright tail (power-up). */
  powerUp(): void {
    this.voice(powerUpVoice);
  }

  /** Mode furie over: a 0.4 s triangle falling 660 → 140 Hz. */
  powerDown(): void {
    this.voice(powerDownVoice);
  }

  /**
   * Low sustained hum while the mode furie is on (sawtooth 55 Hz through a low-pass, slow tremolo): takes one voice
   * of MAX_VOICES (skipped when none is free), goes through the master gain (mute), pauses with the context.
   */
  private startHum(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.hum || this.voices >= MAX_VOICES) return;
    try {
      const t = ctx.currentTime;
      const { osc, lfo, gain } = furieHumNodes(ctx, this.sfxBus, t);
      this.voices += 1;
      osc.onended = (): void => {
        this.voices -= 1;
        osc.disconnect();
        lfo.disconnect();
        gain.disconnect();
      };
      osc.start(t);
      lfo.start(t);
      this.hum = { osc, lfo, gain };
    } catch {
      /* silent */
    }
  }

  private stopHum(): void {
    const h = this.hum;
    const ctx = this.ctx;
    this.hum = null;
    if (!h || !ctx) return;
    try {
      const t = ctx.currentTime;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setTargetAtTime(0.0001, t, 0.05);
      h.osc.stop(t + 0.25);
      h.lfo.stop(t + 0.25);
    } catch {
      /* silent */
    }
  }

  /**
   * Onde d’énergie charge: a triangle hum rising 110 → 440 Hz over the charge time with a slight vibrato; one voice of
   * MAX_VOICES (skipped when none is free), stopped by `stopCharge` (fire, cancel, reset).
   */
  startCharge(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.chargeHum || this.voices >= MAX_VOICES) return;
    try {
      const t = ctx.currentTime;
      const { osc, gain } = chargeHumNodes(ctx, this.sfxBus, t);
      this.voices += 1;
      osc.onended = (): void => {
        this.voices -= 1;
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(t);
      osc.stop(t + 3);
      this.chargeHum = { osc, gain };
    } catch {
      /* silent */
    }
  }

  stopCharge(): void {
    const h = this.chargeHum;
    const ctx = this.ctx;
    this.chargeHum = null;
    if (!h || !ctx) return;
    try {
      const t = ctx.currentTime;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setTargetAtTime(0.0001, t, 0.03);
      h.osc.stop(t + 0.15);
    } catch {
      /* silent */
    }
  }

  /** Onde d’énergie fired: a 0.35 s bright sawtooth zap falling 1800 → 200 Hz with a noisy band-passed tail. */
  zap(): void {
    this.voice(zapVoice);
  }

  /** Bouclier block: a short metallic clank (two detuned squares through a high band-pass, 0.18 s; jittered). */
  clank(): void {
    this.voice((ctx, out, t) => clankVoice(ctx, out, t, this.pitch()));
  }

  /** Thrown Molotov: a 0.35 s noise burst through a band-pass sweeping down (whoosh). */
  whoosh(): void {
    this.voice(whooshVoice);
  }

  /**
   * A call answered: a two-tone siren on the sfx bus. Fire truck: the French « pin-pon » (triangle 435 / 580 Hz,
   * 0.32 s per note, 4 notes); police: a quicker, higher pair (square 660 / 880 Hz through a low-pass, 0.18 s, 6 notes).
   */
  siren(kind: 'fire' | 'police'): void {
    this.voice((ctx, out, t) => sirenVoice(ctx, out, t, kind));
  }

  /** Maps sim events to sounds (a thrown enemy rock sounds when it actually spawns: EnemyRockThrown). */
  onEvents(events: SimEvent[]): void {
    let chimed = false;
    for (const e of events) {
      switch (e.type) {
        case 'HitConfirmed':
          // a brute or the Caïd: the same impact, pitched down (heavier)
          this.play(`hit${1 + Math.floor(Math.random() * 3)}` as Sfx, 0, e.heavy ? HEAVY_RATE : 1);
          break;
        case 'EnemyRockThrown':
        case 'ProjectileReturned':
          this.play('throw');
          break;
        case 'ProjectileLanded':
        case 'WeaponBroken':
        case 'ShieldEnded':
        case 'FlagSwapped':
          this.play('land');
          break;
        case 'ProjectilePickedUp':
        case 'WeaponPickedUp':
        case 'ToolboxPickedUp':
        case 'ItemPickedUp':
        case 'HealCompleted':
        case 'SmallHealPicked':
          this.play('pickup');
          break;
        case 'MolotovThrown':
        case 'FirebombThrown':
          this.whoosh();
          break;
        case 'FurieStarted':
          this.powerUp();
          this.startHum();
          break;
        case 'FurieEnded':
          this.stopHum();
          this.powerDown();
          break;
        case 'BeamCharging':
          this.startCharge();
          break;
        case 'BeamCancelled':
          this.stopCharge();
          break;
        case 'BeamFired':
          this.stopCharge();
          this.zap();
          break;
        case 'ShieldBlocked':
          this.clank();
          break;
        case 'BulletFired':
          this.pop();
          break;
        case 'FlashballFired':
          this.thump();
          break;
        case 'GlovePunched':
          // the spring's « boing » on a hit; a punch in the air only whooshes
          if (e.lifeId !== null) this.boing();
          else this.play('throw');
          break;
        case 'EnergyReady':
          this.energyReady(e.level);
          break;
        case 'EnergyRefused':
        case 'ServiceRefused':
          this.tock();
          break;
        case 'ServiceCalled':
          this.siren(e.kind);
          break;
        case 'TruckDestroyed':
          this.play('land', 0, HEAVY_RATE);
          break;
        case 'CaidArrived':
          // his banner comes with the alarm, like any danger
          this.play('alarm');
          break;
        case 'CaidJailed':
          // the jail van's siren
          this.siren('police');
          break;
        case 'PrisonBreakout':
          // the wall gives way, the alarm rings
          this.play('land', 0, HEAVY_RATE);
          this.play('alarm');
          break;
        case 'TargetSaved':
        case 'TargetRepaired':
        case 'RoundCompleted':
        case 'MonumentDefended':
        case 'FlagCaptured':
        case 'ItemReturned':
          // one chime per batch: a target saved by the round's last KO lands with RoundCompleted
          if (!chimed) this.chime();
          chimed = true;
          break;
        case 'PlayerDamaged':
          // a brute's or the Caïd's push: a lower « hurt » plus a dull thud
          if (e.push) {
            this.play('hurt', 0, HEAVY_RATE);
            this.play('land', 0, HEAVY_RATE);
          } else this.play('hurt');
          break;
        // alarm = fire: it marks the bottle setting a target on fire (not the attack start nor the first hp lost, so
        // it is not used up before the fire); the fire loop then follows burning targets (threatLevel, every frame)
        case 'TargetIgnited':
        case 'RescueStarted':
        case 'MonumentAttacked':
          if (!this.alarmed.has(e.incidentId)) {
            this.alarmed.add(e.incidentId);
            this.play('alarm');
          }
          break;
        default:
      }
    }
  }
}
