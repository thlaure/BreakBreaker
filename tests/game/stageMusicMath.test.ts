// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { GameAudio } from '../../src/game/audio';
import { StageRiff } from '../../src/game/audioStage';
import {
  RIFF_STEPS,
  RIFF_STEP_SEC,
  RIFF_TEMPO_BPM,
  STAGE_CENTER,
  STAGE_FAR_PX,
  STAGE_NEAR_PX,
  riffLoopSec,
  riffSteps,
  stageDistance,
  stageVolume,
} from '../../src/game/stageMusicMath';
import { DISTRICT } from '../../src/sim/map/district';

describe('stage music: volume follows the distance to the stage', () => {
  test('silent from 12 tiles (384 px), full within 4 tiles (128 px)', () => {
    expect(STAGE_FAR_PX).toBe(384);
    expect(STAGE_NEAR_PX).toBe(128);
    for (const d of [384, 385, 500, 1e6, Number.POSITIVE_INFINITY]) expect(stageVolume(d)).toBe(0);
    for (const d of [128, 127, 64, 0]) expect(stageVolume(d)).toBe(1);
  });

  test('monotonic non-increasing and always within [0, 1]', () => {
    let prev = 1;
    for (let d = 0; d <= 450; d += 0.5) {
      const v = stageVolume(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      prev = v;
    }
    expect(stageVolume(256)).toBeGreaterThan(0);
    expect(stageVolume(256)).toBeLessThan(1);
  });

  test('negative or NaN input never yields NaN', () => {
    expect(stageVolume(-50)).toBe(1);
    expect(stageVolume(Number.NaN)).toBe(0);
    expect(stageVolume(Number.NEGATIVE_INFINITY)).toBe(1);
  });

  test('the stage centre is the centre of building 3 (R(36,3,8,5))', () => {
    const b = DISTRICT.buildings[3]!;
    expect(b).toEqual({ x: 36 * 32, y: 3 * 32, w: 8 * 32, h: 5 * 32 });
    expect(STAGE_CENTER).toEqual({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    expect(stageDistance(STAGE_CENTER)).toBe(0);
    expect(stageDistance({ x: STAGE_CENTER.x + 300, y: STAGE_CENTER.y + 400 })).toBeCloseTo(500, 9);
  });
});

describe('stage music: the riff loop data', () => {
  test('16 steps at about 150 bpm (sixteenth notes), loop = 16 steps', () => {
    expect(RIFF_STEPS).toHaveLength(16);
    expect(riffSteps()).toBe(RIFF_STEPS);
    expect(RIFF_TEMPO_BPM).toBeGreaterThanOrEqual(140);
    expect(RIFF_TEMPO_BPM).toBeLessThanOrEqual(160);
    expect(RIFF_STEP_SEC).toBeCloseTo(60 / RIFF_TEMPO_BPM / 4, 12);
    expect(riffLoopSec()).toBeCloseTo(16 * RIFF_STEP_SEC, 12);
  });

  test('notes stay in a sane low range (guitar E2..E4, bass an octave lower)', () => {
    for (const s of RIFF_STEPS) {
      if (s.guitar !== null) {
        expect(Number.isInteger(s.guitar)).toBe(true);
        expect(s.guitar).toBeGreaterThanOrEqual(40);
        expect(s.guitar).toBeLessThanOrEqual(64);
      }
      if (s.bass !== null) {
        expect(s.bass).toBeGreaterThanOrEqual(28);
        expect(s.bass).toBeLessThanOrEqual(52);
      }
    }
    expect(RIFF_STEPS.filter((s) => s.guitar !== null).length).toBeGreaterThanOrEqual(12);
  });

  test('a kick on the downbeat, a snare on the backbeat, the riff starts on E', () => {
    expect(RIFF_STEPS[0]!.kick).toBe(true);
    expect(RIFF_STEPS[0]!.guitar).toBe(40);
    expect(RIFF_STEPS[4]!.snare).toBe(true);
    expect(RIFF_STEPS[12]!.snare).toBe(true);
  });
});

/** A minimal fake AudioContext counting the sources it creates. */
function fakeCtx() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => ({ connect: vi.fn((n: unknown) => n), disconnect: vi.fn() });
  const sources: { stop: ReturnType<typeof vi.fn> }[] = [];
  const src = <T extends object>(extra: T) => {
    const s = { ...node(), ...extra, start: vi.fn(), stop: vi.fn(), onended: null };
    sources.push(s);
    return s;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createOscillator: () => src({ type: 'sine', frequency: param(), detune: param() }),
    createBufferSource: () => src({ buffer: null as unknown, playbackRate: param() }),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
    createWaveShaper: () => ({ ...node(), curve: null as unknown, oversample: 'none' }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    suspend: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, sources };
}

describe('stage music: StageRiff scheduling', () => {
  test('near the stage it schedules notes; null or volume 0 stops and frees everything', () => {
    const { ctx, sources } = fakeCtx();
    const riff = new StageRiff(ctx, ctx.destination);
    riff.setProximity(0);
    expect(riff.playing).toBe(true);
    const n = sources.length;
    expect(n).toBeGreaterThan(0);
    riff.setProximity(null);
    expect(riff.playing).toBe(false);
    for (const s of sources) expect(s.stop).toHaveBeenCalled();
    riff.setProximity(null);
    riff.setProximity(STAGE_FAR_PX + 10);
    expect(sources.length).toBe(n);
    riff.setProximity(100);
    expect(riff.playing).toBe(true);
    riff.setProximity(STAGE_FAR_PX);
    expect(riff.playing).toBe(false);
  });

  test('schedules only a short window ahead of the audio clock (nothing more while the clock is frozen)', () => {
    const { ctx, raw, sources } = fakeCtx();
    const riff = new StageRiff(ctx, ctx.destination);
    riff.setProximity(0);
    const n = sources.length;
    for (let i = 0; i < 10; i++) riff.setProximity(0);
    expect(sources.length).toBe(n);
    raw.currentTime = 1;
    riff.setProximity(0);
    expect(sources.length).toBeGreaterThan(n);
  });

  test('mute stops the loop; unmute lets it start again', () => {
    const { ctx, sources } = fakeCtx();
    const riff = new StageRiff(ctx, ctx.destination);
    riff.setMuted(true);
    riff.setProximity(0);
    expect(riff.playing).toBe(false);
    expect(sources).toHaveLength(0);
    riff.setMuted(false);
    riff.setProximity(0);
    expect(riff.playing).toBe(true);
    riff.setMuted(true);
    expect(riff.playing).toBe(false);
  });

  test('GameAudio: silent before unlock, delegates once unlocked, mute and reset stop the riff', () => {
    const locked = new GameAudio();
    expect(() => locked.setStageProximity(0)).not.toThrow();
    const { ctx, raw, sources } = fakeCtx();
    const a = new GameAudio();
    const inner = a as unknown as { ctx: unknown; master: unknown };
    inner.ctx = ctx;
    inner.master = raw.createGain();
    a.setStageProximity(0);
    expect(sources.length).toBeGreaterThan(0);
    const stage = (a as unknown as { stage: StageRiff }).stage;
    expect(stage.playing).toBe(true);
    a.setMuted(true);
    expect(stage.playing).toBe(false);
    a.setStageProximity(0);
    expect(stage.playing).toBe(false);
    a.setMuted(false);
    a.setStageProximity(0);
    expect(stage.playing).toBe(true);
    a.reset();
    expect(stage.playing).toBe(false);
  });
});
