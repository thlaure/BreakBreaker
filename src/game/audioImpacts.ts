/**
 * Synthesised impact one-shots of GameAudio (jittered by the pitch factor `k`, plus the Molotov whoosh). Each builds
 * one voice on `out` starting at `t` and returns the source node whose end frees the voice.
 */

/** Furie / Onde refused (too little energy): a dull 0.08 s low square « tock » (220 → 110 Hz, low-passed; jittered). */
export function tockVoice(ctx: AudioContext, out: AudioNode, t: number, k: number): AudioScheduledSourceNode {
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(220 * k, t);
  osc.frequency.exponentialRampToValueAtTime(110 * k, t + 0.07);
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(lp).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.09);
  return osc;
}

/** A shooter's bullet: a tiny cartoon « pop » (0.06 s noise click through a band-pass, quiet: bursts of 3; jittered). */
export function popVoice(ctx: AudioContext, out: AudioNode, t: number, k: number): AudioScheduledSourceNode {
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500 * k;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  return src;
}

/** Flashball shot: a low « thump » (sine 150 → 55 Hz, 0.16 s; jittered). */
export function thumpVoice(ctx: AudioContext, out: AudioNode, t: number, k: number): AudioScheduledSourceNode {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 * k, t);
  osc.frequency.exponentialRampToValueAtTime(55 * k, t + 0.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.17);
  return osc;
}

/** The glove lands: a springy « boing » (triangle wobbling 220 ↔ 330 Hz at 18 Hz, falling, 0.3 s; jittered). */
export function boingVoice(ctx: AudioContext, out: AudioNode, t: number, k: number): AudioScheduledSourceNode {
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(330 * k, t);
  osc.frequency.exponentialRampToValueAtTime(180 * k, t + 0.28);
  lfo.frequency.value = 18;
  depth.gain.value = 60 * k;
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
}

/** Bouclier block: a short metallic clank (two detuned squares through a high band-pass, 0.18 s; jittered). */
export function clankVoice(ctx: AudioContext, out: AudioNode, t: number, k: number): AudioScheduledSourceNode {
  const a = ctx.createOscillator();
  const b = ctx.createOscillator();
  const bp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  a.type = 'square';
  b.type = 'square';
  a.frequency.value = 820 * k;
  b.frequency.value = 1235 * k;
  bp.type = 'bandpass';
  bp.frequency.value = 2400 * k;
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
}

/** Thrown Molotov: a 0.35 s noise burst through a band-pass sweeping down (whoosh). */
export function whooshVoice(ctx: AudioContext, out: AudioNode, t: number): AudioScheduledSourceNode {
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
}
