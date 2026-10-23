// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { GameAudio, HEAVY_RATE, PITCH_JITTER, isImpactSfx, pitchJitter } from '../../src/game/audio';
import type { SimEvent } from '../../src/sim/types';

/** A minimal fake AudioContext: records every buffer source's playbackRate and every oscillator's first frequency. */
function fakeAudio(muted = false) {
  const rates: { key: string; rate: number }[] = [];
  const freqs: number[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(function (this: { value: number }, v: number) {
      if (this.value === 0) this.value = v;
    }),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => ({ connect: vi.fn((n: unknown) => n), disconnect: vi.fn() });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createBufferSource: () => {
      const s = { ...node(), buffer: null as unknown, playbackRate: param(), start: vi.fn(), stop: vi.fn(), onended: null };
      queueMicrotask(() => rates.push({ key: (s.buffer as { key: string } | null)?.key ?? 'noise', rate: s.playbackRate.value }));
      return s;
    },
    createOscillator: () => {
      const o = { ...node(), type: 'sine', frequency: param(), start: vi.fn(), stop: vi.fn(), onended: null };
      queueMicrotask(() => freqs.push(o.frequency.value));
      return o;
    },
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  const a = new GameAudio(muted);
  const raw = a as unknown as { ctx: unknown; sfxBus: unknown; buffers: Map<string, unknown> };
  raw.ctx = ctx;
  raw.sfxBus = node();
  for (const k of ['hit1', 'hit2', 'hit3', 'hurt', 'land', 'alarm', 'throw', 'pickup']) raw.buffers.set(k, { key: k });
  return { a, rates, freqs };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe('impact sounds: a slight random pitch on every hit (render only)', () => {
  test('pitchJitter maps one draw in [0, 1) to a rate factor within ±6 %', () => {
    expect(PITCH_JITTER).toBe(0.06);
    expect(pitchJitter(0)).toBeCloseTo(0.94, 9);
    expect(pitchJitter(0.5)).toBeCloseTo(1, 9);
    expect(pitchJitter(0.999999)).toBeCloseTo(1.06, 5);
  });

  test('only the hit / hurt / thud samples are impacts (not the alarm, throw or pickup)', () => {
    for (const k of ['hit1', 'hit2', 'hit3', 'hurt', 'land'] as const) expect(isImpactSfx(k)).toBe(true);
    for (const k of ['alarm', 'throw', 'pickup', 'fire_loop'] as const) expect(isImpactSfx(k)).toBe(false);
  });

  test('hits vary their playback rate within ±6 % around 1 (heavy around HEAVY_RATE); the alarm never does', async () => {
    const { a, rates } = fakeAudio();
    const hit = (heavy: boolean): SimEvent => ({ type: 'HitConfirmed', lifeId: 1, heavy }) as unknown as SimEvent;
    for (let i = 0; i < 6; i++) a.onEvents([hit(false)]);
    a.onEvents([hit(true)]);
    a.onEvents([{ type: 'CaidArrived' } as unknown as SimEvent]);
    await flush();
    const hits = rates.filter((r) => r.key.startsWith('hit'));
    expect(hits).toHaveLength(7);
    for (const r of hits.slice(0, 6)) {
      expect(r.rate).toBeGreaterThanOrEqual(1 - PITCH_JITTER - 1e-9);
      expect(r.rate).toBeLessThanOrEqual(1 + PITCH_JITTER + 1e-9);
    }
    expect(new Set(hits.slice(0, 6).map((r) => r.rate)).size).toBeGreaterThan(1);
    expect(Math.abs(hits[6]!.rate / HEAVY_RATE - 1)).toBeLessThanOrEqual(PITCH_JITTER + 1e-9);
    expect(rates.filter((r) => r.key === 'alarm').map((r) => r.rate)).toEqual([1]);
  });

  test('synthesised impacts (tock, pop, thump, boing, clank) are pitched too; the siren is not', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { a, freqs } = fakeAudio();
    a.tock();
    a.thump();
    a.siren('fire');
    await flush();
    expect(freqs[0]).toBeCloseTo(220 * 0.94, 6);
    expect(freqs[1]).toBeCloseTo(150 * 0.94, 6);
    expect(freqs[2]).toBe(580);
  });

  test('no audio (locked context) or muted: no jitter is drawn at all', () => {
    const rnd = vi.spyOn(Math, 'random');
    const silent = new GameAudio();
    silent.play('hit1');
    silent.tock();
    expect(rnd).not.toHaveBeenCalled();
    const { a } = fakeAudio(true);
    a.play('land');
    a.tock();
    expect(rnd).not.toHaveBeenCalled();
  });
});
