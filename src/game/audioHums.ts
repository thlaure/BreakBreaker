/**
 * Node graphs of GameAudio's sustained hums (mode furie, onde d’énergie charge). Each builds and connects its nodes to
 * `out` from time `t`; GameAudio counts the voice, starts and stops them.
 */

/** Level of the mode furie hum on the sfx bus. */
const HUM_GAIN = 0.12;

/** Mode furie hum: sawtooth 55 Hz through a low-pass, slow tremolo (5 Hz LFO on the gain). */
export function furieHumNodes(ctx: AudioContext, out: AudioNode, t: number): { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } {
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
  osc.connect(lp).connect(gain).connect(out);
  return { osc, lfo, gain };
}

/** Onde d’énergie charge hum: triangle rising 110 → 440 Hz over 1 s, fading in. */
export function chargeHumNodes(ctx: AudioContext, out: AudioNode, t: number): { osc: OscillatorNode; gain: GainNode } {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 1);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.9);
  osc.connect(gain).connect(out);
  return { osc, gain };
}
