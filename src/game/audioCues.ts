/**
 * Synthesised tonal cues of GameAudio (exact pitch: chimes, energy, furie power-up / down, onde zap, sirens). Each
 * builds one voice on `out` starting at `t` and returns the source node whose end frees the voice.
 */

/** Bright two-note chime (sine 660 → 880 Hz, 120 ms each): a target saved or repaired, a round won. */
export function chimeVoice(ctx: AudioContext, out: AudioNode, t: number): AudioScheduledSourceNode {
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
}

/**
 * Energy gauge reached a threshold: a soft sine ping (988 Hz, 0.25 s) when the onde becomes available, a brighter
 * triangle arpeggio (784 → 1175 → 1568 Hz) when it is full (furie available).
 */
export function energyReadyVoice(ctx: AudioContext, out: AudioNode, t: number, level: 'onde' | 'furie'): AudioScheduledSourceNode {
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
}

/** Mode furie on: a 0.5 s square sweep rising 196 → 1046 Hz with a bright tail (power-up). */
export function powerUpVoice(ctx: AudioContext, out: AudioNode, t: number): AudioScheduledSourceNode {
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
}

/** Mode furie over: a 0.4 s triangle falling 660 → 140 Hz. */
export function powerDownVoice(ctx: AudioContext, out: AudioNode, t: number): AudioScheduledSourceNode {
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
}

/** Onde d’énergie fired: a 0.35 s bright sawtooth zap falling 1800 → 200 Hz with a noisy band-passed tail. */
export function zapVoice(ctx: AudioContext, out: AudioNode, t: number): AudioScheduledSourceNode {
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
}

/**
 * A call answered: a two-tone siren on the sfx bus. Fire truck: the French « pin-pon » (triangle 435 / 580 Hz,
 * 0.32 s per note, 4 notes); police: a quicker, higher pair (square 660 / 880 Hz through a low-pass, 0.18 s, 6 notes).
 */
export function sirenVoice(ctx: AudioContext, out: AudioNode, t: number, kind: 'fire' | 'police'): AudioScheduledSourceNode {
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
}
