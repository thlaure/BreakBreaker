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

  /** Maps sim events to sounds (a thrown enemy rock sounds when it actually spawns: EnemyRockThrown). */
  onEvents(events: SimEvent[]): void {
    let chimed = false;
    for (const e of events) {
      switch (e.type) {
        case 'HitConfirmed':
          this.play(`hit${1 + Math.floor(Math.random() * 3)}` as Sfx);
          break;
        case 'EnemyRockThrown':
        case 'ProjectileReturned':
          this.play('throw');
          break;
        case 'ProjectileLanded':
        case 'WeaponBroken':
          this.play('land');
          break;
        case 'ProjectilePickedUp':
        case 'WeaponPickedUp':
        case 'ToolboxPickedUp':
        case 'HealCompleted':
          this.play('pickup');
          break;
        case 'MolotovThrown':
          this.whoosh();
          break;
        case 'TargetSaved':
        case 'TargetRepaired':
        case 'RoundCompleted':
          // one chime per batch: a target saved by the round's last KO lands with RoundCompleted
          if (!chimed) this.chime();
          chimed = true;
          break;
        case 'PlayerDamaged':
          this.play('hurt');
          break;
        // alarm = fire: it marks the bottle setting a target on fire (not the attack start nor the first hp lost, so
        // it is not used up before the fire); the fire loop then follows burning targets (threatLevel, every frame)
        case 'TargetIgnited':
        case 'RescueStarted':
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
