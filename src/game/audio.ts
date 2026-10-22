import type { Snapshot } from '../sim/sim';
import type { SimEvent } from '../sim/types';
import { SFX } from './assets';

export type Sfx = (typeof SFX)[number];

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
/** Level of the mode furie hum on the sfx bus. */
const HUM_GAIN = 0.12;

/**
 * Fire loop level for a frame: 0 when no target is attacked or burning, else 0.35..1 following the lowest health among
 * them (a fire still going out after its attack keeps the loop at its floor).
 */
export function threatLevel(s: Snapshot): number {
  if (s.ended) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const t of s.targets) if (t.state === 'attacked' || t.burning) min = Math.min(min, t.hp / t.maxHp);
  return min === Number.POSITIVE_INFINITY ? 0 : 0.35 + 0.65 * (1 - Math.max(0, Math.min(1, min)));
}

/**
 * Raw WebAudio. The AudioContext is created only by `unlock()` (called from the Commencer click).
 * Any failure leaves the game silent but running. Groups: sfx and ambience gains feed a master gain (mute).
 */
/** Playback rate of the heavier hits (brute, Caïd). */
export const HEAVY_RATE = 0.7;

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
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** Fire loop volume follows the threat (see `threatLevel`): 0..1 of FIRE_MAX. */
  setThreat(level: number): void {
    this.threat = Math.max(0, Math.min(1, level));
    if (this.fireGain && this.ctx) this.fireGain.gain.setTargetAtTime(this.threat * FIRE_MAX, this.ctx.currentTime, 0.15);
  }

  /** Called on Commencer / Reprendre / Rejouer only (never automatically on visibilitychange). */
  resume(): void {
    void this.ctx?.resume().catch(() => undefined);
  }

  /** Called whenever an overlay pauses the sim (pause menu, summary) and when the page is hidden. */
  suspend(): void {
    void this.ctx?.suspend().catch(() => undefined);
  }

  play(key: Sfx, delaySec = 0, rate = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(key);
    if (!ctx || !this.sfxBus || !buf || this.voices >= MAX_VOICES) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
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
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(880, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
      g.gain.setValueAtTime(0.5, t + 0.11);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.13);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.25);
      return osc;
    });
  }

  /**
   * Energy gauge reached a threshold: a soft sine ping (988 Hz, 0.25 s) when the onde becomes available, a brighter
   * triangle arpeggio (784 → 1175 → 1568 Hz) when it is full (furie available).
   */
  energyReady(level: 'onde' | 'furie'): void {
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      if (level === 'onde') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(988, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(784, t);
        osc.frequency.setValueAtTime(1175, t + 0.08);
        osc.frequency.setValueAtTime(1568, t + 0.16);
        g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
        g.gain.setValueAtTime(0.45, t + 0.22);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      }
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.42);
      return osc;
    });
  }

  /** Furie / Onde refused (too little energy): a dull 0.08 s low square « tock » (220 → 110 Hz, low-passed). */
  tock(): void {
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.07);
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.09);
      return osc;
    });
  }

  /** A shooter's bullet: a tiny cartoon « pop » (0.06 s noise click through a band-pass, quiet: bursts of 3). */
  pop(): void {
    this.voice((ctx, out, t) => {
      const len = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(bp).connect(g).connect(out);
      src.start(t);
      return src;
    });
  }

  /** Flashball shot: a low « thump » (sine 150 → 55 Hz, 0.16 s) with a soft click on top. */
  thump(): void {
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.15);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.17);
      return osc;
    });
  }

  /** The glove lands: a springy « boing » (triangle wobbling 220 ↔ 330 Hz at 18 Hz, falling, 0.3 s). */
  boing(): void {
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.28);
      lfo.frequency.value = 18;
      depth.gain.value = 60;
      lfo.connect(depth).connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g).connect(out);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 0.31);
      lfo.stop(t + 0.31);
      return osc;
    });
  }

  /** Mode furie on: a 0.5 s square sweep rising 196 → 1046 Hz with a bright tail (power-up). */
  powerUp(): void {
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(196, t);
      osc.frequency.exponentialRampToValueAtTime(1046, t + 0.45);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, t);
      lp.frequency.exponentialRampToValueAtTime(4000, t + 0.45);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
      g.gain.setValueAtTime(0.3, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.56);
      return osc;
    });
  }

  /** Mode furie over: a 0.4 s triangle falling 660 → 140 Hz. */
  powerDown(): void {
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.38);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.41);
      return osc;
    });
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
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(HUM_GAIN, t + 0.3);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const depth = ctx.createGain();
      depth.gain.value = HUM_GAIN * 0.4;
      lfo.connect(depth).connect(gain.gain);
      osc.connect(lp).connect(gain).connect(this.sfxBus);
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
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.9);
      osc.connect(gain).connect(this.sfxBus);
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
    this.voice((ctx, out, t) => {
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.33);
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(2200, t);
      bp.frequency.exponentialRampToValueAtTime(600, t + 0.33);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(bp).connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.36);
      return osc;
    });
  }

  /** Bouclier block: a short metallic clank (two detuned squares through a high band-pass, 0.18 s). */
  clank(): void {
    this.voice((ctx, out, t) => {
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      a.type = 'square';
      b.type = 'square';
      a.frequency.value = 820;
      b.frequency.value = 1235;
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      bp.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      a.connect(bp);
      b.connect(bp);
      bp.connect(g).connect(out);
      a.start(t);
      b.start(t);
      a.stop(t + 0.19);
      b.stop(t + 0.19);
      return a;
    });
  }

  /** Thrown Molotov: a 0.35 s noise burst through a band-pass sweeping down (whoosh). */
  whoosh(): void {
    this.voice((ctx, out, t) => {
      const len = Math.floor(ctx.sampleRate * 0.35);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(2400, t);
      bp.frequency.exponentialRampToValueAtTime(400, t + 0.33);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      src.connect(bp).connect(g).connect(out);
      src.start(t);
      return src;
    });
  }

  /**
   * A call answered: a two-tone siren on the sfx bus. Fire truck: the French « pin-pon » (triangle 435 / 580 Hz,
   * 0.32 s per note, 4 notes); police: a quicker, higher pair (square 660 / 880 Hz through a low-pass, 0.18 s, 6 notes).
   */
  siren(kind: 'fire' | 'police'): void {
    this.voice((ctx, out, t) => {
      const [lo, hi, note, notes, type] = kind === 'fire' ? [435, 580, 0.32, 4, 'triangle' as const] : [660, 880, 0.18, 6, 'square' as const];
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = type;
      for (let i = 0; i < notes; i++) osc.frequency.setValueAtTime(i % 2 === 0 ? hi : lo, t + i * note);
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      const end = t + notes * note;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
      g.gain.setValueAtTime(0.28, end - 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t);
      osc.stop(end + 0.01);
      return osc;
    });
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
