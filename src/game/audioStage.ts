import { RIFF_STEP_SEC, RIFF_STEPS, driveCurve, midiHz, stageVolume, type RiffStep } from './stageMusicMath';

/** Bus level at full volume: kept low so sound effects stay clear over the band. */
export const STAGE_MAX_GAIN = 0.16;
/** How far ahead of the audio clock steps are scheduled (frames call `setProximity`, so no timer is needed). */
const LOOKAHEAD_SEC = 0.2;
/** Smoothing time constant of volume changes. */
const VOLUME_TAU = 0.25;

interface Session {
  bus: GainNode;
  voices: Set<AudioScheduledSourceNode[]>;
  ended: boolean;
}

/**
 * The stage band's loop (render only): saturated guitar (sawtooth power chords through a tanh waveshaper and a
 * low-pass), bass and noise drums, synthesised and scheduled step by step on the WebAudio clock a short window ahead.
 * Lives under GameAudio's master gain (mute) and its context (suspend / resume pause it). At volume 0, muted or when
 * told null, nothing is scheduled and every node is released once its last note ends.
 */
export class StageRiff {
  private session: Session | null = null;
  private nextTime = 0;
  private step = 0;
  private noise: AudioBuffer | null = null;
  private curve: Float32Array<ArrayBuffer> | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private muted = false,
  ) {}

  get playing(): boolean {
    return this.session !== null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }

  /** Distance from Paul to the stage in px, or null (game over, paused): sets the volume and keeps the loop fed. */
  setProximity(distPx: number | null): void {
    const vol = distPx === null || this.muted ? 0 : stageVolume(distPx);
    if (vol <= 0) {
      this.stop();
      return;
    }
    try {
      const s = this.session ?? this.start();
      s.bus.gain.setTargetAtTime(STAGE_MAX_GAIN * vol, this.ctx.currentTime, VOLUME_TAU);
      this.pump(s);
    } catch {
      /* silent */
    }
  }

  /** Fades out, cuts every scheduled note and frees the graph. */
  stop(): void {
    const s = this.session;
    this.session = null;
    if (!s) return;
    s.ended = true;
    try {
      const t = this.ctx.currentTime;
      s.bus.gain.cancelScheduledValues(t);
      s.bus.gain.setTargetAtTime(0, t, 0.03);
      for (const srcs of s.voices) for (const src of srcs) src.stop(t + 0.15);
    } catch {
      /* silent */
    }
    if (s.voices.size === 0) s.bus.disconnect();
  }

  private start(): Session {
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0, this.ctx.currentTime);
    bus.connect(this.out);
    this.nextTime = this.ctx.currentTime + 0.05;
    this.step = 0;
    this.session = { bus, voices: new Set(), ended: false };
    return this.session;
  }

  /** Schedules every step that starts within the lookahead window (none while the clock is frozen by a suspend). */
  private pump(s: Session): void {
    const now = this.ctx.currentTime;
    // a stalled frame: skip the missed steps rather than burst them
    if (this.nextTime < now) this.nextTime = now + 0.02;
    while (this.nextTime < now + LOOKAHEAD_SEC) {
      this.playStep(s, RIFF_STEPS[this.step]!, this.nextTime);
      this.nextTime += RIFF_STEP_SEC;
      this.step = (this.step + 1) % RIFF_STEPS.length;
    }
  }

  private playStep(s: Session, st: RiffStep, t: number): void {
    if (st.guitar !== null) this.guitar(s, st.guitar, st.mute, t);
    if (st.bass !== null) this.bass(s, st.bass, st.mute, t);
    if (st.kick) this.kick(s, t);
    if (st.snare) this.noiseHit(s, t, 'bandpass', 1800, 0.5, 0.13);
    if (st.hat) this.noiseHit(s, t, 'highpass', 7000, 0.12, 0.035);
  }

  /** Starts the sources at `t`, stops them at `end`; the first one's end disconnects the voice and forgets it. */
  private track(s: Session, srcs: AudioScheduledSourceNode[], nodes: AudioNode[], t: number, end: number): void {
    s.voices.add(srcs);
    srcs[0]!.onended = (): void => {
      for (const n of srcs) n.disconnect();
      for (const n of nodes) n.disconnect();
      s.voices.delete(srcs);
      if (s.ended && s.voices.size === 0) s.bus.disconnect();
    };
    for (const src of srcs) {
      src.start(t);
      src.stop(end);
    }
  }

  /** Percussive envelope: 4 ms attack to `peak`, exponential decay over `dur`. */
  private env(t: number, peak: number, dur: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  /** Power chord (root + fifth, two detuned sawtooths) → waveshaper → low-pass (darker when palm-muted). */
  private guitar(s: Session, note: number, mute: boolean, t: number): void {
    const dur = mute ? 0.09 : 0.19;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.curve ??= driveCurve(1024, 6);
    shaper.oversample = '2x';
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = mute ? 900 : 2600;
    lp.Q.value = 0.9;
    const g = this.env(t, mute ? 0.4 : 0.5, dur);
    const oscs = [note, note + 7].map((n, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiHz(n);
      o.detune.value = i === 0 ? -6 : 6;
      o.connect(shaper);
      return o;
    });
    shaper.connect(lp).connect(g).connect(s.bus);
    this.track(s, oscs, [shaper, lp, g], t, t + dur + 0.02);
  }

  private bass(s: Session, note: number, mute: boolean, t: number): void {
    const dur = mute ? 0.1 : 0.2;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midiHz(note);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.env(t, 0.55, dur);
    o.connect(lp).connect(g).connect(s.bus);
    this.track(s, [o], [lp, g], t, t + dur + 0.02);
  }

  /** Sine dropping 140 → 45 Hz. */
  private kick(s: Session, t: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.env(t, 0.9, 0.16);
    o.connect(g).connect(s.bus);
    this.track(s, [o], [g], t, t + 0.18);
  }

  /** Snare (band-passed) or hi-hat (high-passed) from the shared noise buffer. */
  private noiseHit(s: Session, t: number, type: BiquadFilterType, freq: number, peak: number, dur: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.env(t, peak, dur);
    src.connect(f).connect(g).connect(s.bus);
    this.track(s, [src], [f, g], t, t + dur + 0.02);
  }

  /** 0.25 s of white noise, built once (render only: Math.random, never the sim's stream). */
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const len = Math.floor(this.ctx.sampleRate * 0.25);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }
}
