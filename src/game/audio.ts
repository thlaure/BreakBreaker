import type { SimEvent } from '../sim/types';
import { BASE, SFX } from './assets';

type Sfx = (typeof SFX)[number];

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
  private nowSim = 0;
  private unlocking: Promise<void> | null = null;

  constructor(muted = false) {
    this.muted = muted;
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Creates the context inside a user gesture, then loads the buffers. Never throws. */
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
        try {
          const res = await fetch(`${BASE}sfx/${key}.ogg`);
          if (!res.ok) return;
          this.buffers.set(key, await ctx.decodeAudioData(await res.arrayBuffer()));
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

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** Fire loop volume follows the school threat: 0 when not threatened, 0..1 of FIRE_MAX otherwise. */
  setThreat(level: number): void {
    this.threat = Math.max(0, Math.min(1, level));
    if (this.fireGain && this.ctx) this.fireGain.gain.setTargetAtTime(this.threat * FIRE_MAX, this.ctx.currentTime, 0.15);
  }

  /** Called on Reprendre only (never automatically on visibilitychange). */
  resume(): void {
    void this.ctx?.resume().catch(() => undefined);
  }

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

  /** Maps sim events to sounds. `nowSim` is the sim clock at the end of the frame, for delayed sounds. */
  onEvents(events: SimEvent[], nowSim: number): void {
    this.nowSim = nowSim;
    for (const e of events) {
      switch (e.type) {
        case 'HitConfirmed':
          this.play(`hit${1 + Math.floor(Math.random() * 3)}` as Sfx);
          break;
        case 'EnemyThrowStarted':
          this.play('throw', e.until - this.nowSim);
          break;
        case 'ProjectileReturned':
          this.play('throw');
          break;
        case 'ProjectileLanded':
          this.play('land');
          break;
        case 'ProjectilePickedUp':
          this.play('pickup');
          break;
        case 'PlayerDamaged':
          this.play('hurt');
          break;
        case 'BuildingThreatStarted':
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
