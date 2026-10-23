import { describe, expect, test } from 'vitest';
import { presidentRng } from '../../src/game/render/presidentMath';
import {
  LYRIC_SHOW_MS,
  headBang,
  initSinger,
  lightPulse,
  lyricDelayMs,
  pickLyric,
  stepSinger,
  swayOffset,
} from '../../src/game/render/stageMath';

describe('the singer’s lyrics', () => {
  test('the next lyric comes 6 to 11 s later, at both ends of the rng', () => {
    expect(lyricDelayMs(() => 0)).toBe(6000);
    expect(lyricDelayMs(() => 0.999999)).toBe(11000);
    const rand = presidentRng(3);
    for (let i = 0; i < 500; i++) {
      const d = lyricDelayMs(rand);
      expect(d).toBeGreaterThanOrEqual(6000);
      expect(d).toBeLessThanOrEqual(11000);
      expect(Number.isInteger(d)).toBe(true);
    }
  });

  test('pickLyric never repeats the last line and reaches every other one', () => {
    const rand = presidentRng(9);
    for (let last = 0; last < 6; last++) {
      const seen = new Set<number>();
      for (let i = 0; i < 300; i++) {
        const k = pickLyric(rand, last, 6);
        expect(k).not.toBe(last);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(6);
        seen.add(k);
      }
      expect(seen.size).toBe(5);
    }
  });

  test('pickLyric with no last line can pick any line, safe at the rng edges', () => {
    expect(pickLyric(() => 0, null, 6)).toBe(0);
    expect(pickLyric(() => 0.999999, null, 6)).toBe(5);
    expect(pickLyric(() => 0.999999, 5, 6)).toBe(4);
    expect(pickLyric(() => 0, 0, 6)).toBe(1);
  });

  test('the singer shows a line, hides it after LYRIC_SHOW_MS, then sings another one', () => {
    const rand = presidentRng(1);
    const s = initSinger(1000);
    expect(s.lyric).toBeNull();
    stepSinger(s, rand, 1000, 6);
    expect(s.lyric).toBeNull();
    stepSinger(s, rand, s.nextAt, 6);
    const first = s.lyric;
    expect(first).not.toBeNull();
    expect(s.until - s.nextAt).toBeLessThan(0); // the next line comes after this one is gone
    stepSinger(s, rand, s.until - 1, 6);
    expect(s.lyric).toBe(first);
    stepSinger(s, rand, s.until, 6);
    expect(s.lyric).toBeNull();
    stepSinger(s, rand, s.nextAt, 6);
    expect(s.lyric).not.toBeNull();
    expect(s.lyric).not.toBe(first);
    expect(LYRIC_SHOW_MS).toBeLessThan(6000);
  });

  test('after a long pause off-screen, the next line is scheduled from now', () => {
    const rand = presidentRng(2);
    const s = initSinger(0);
    stepSinger(s, rand, 1_000_000, 6);
    expect(s.lyric).not.toBeNull();
    expect(s.nextAt).toBeGreaterThan(1_000_000);
  });
});

describe('the band’s small moves', () => {
  test('sway, head-bang and light pulse are steady under reduced motion', () => {
    for (const ms of [0, 123, 4567, 98765])
      for (let k = 0; k < 5; k++) {
        expect(swayOffset(ms, k, true)).toBe(0);
        expect(headBang(ms, k, true)).toBe(0);
        expect(lightPulse(ms, k, true)).toBe(lightPulse(0, k, true));
      }
  });

  test('sway is a whole pixel within ±1, the head-bang a whole pixel in [0, 2]', () => {
    const sways = new Set<number>();
    const bangs = new Set<number>();
    for (let ms = 0; ms < 10000; ms += 37)
      for (let k = 0; k < 5; k++) {
        const s = swayOffset(ms, k, false);
        const b = headBang(ms, k, false);
        expect(Number.isInteger(s)).toBe(true);
        expect(Math.abs(s)).toBeLessThanOrEqual(1);
        expect(Number.isInteger(b)).toBe(true);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(2);
        sways.add(s);
        bangs.add(b);
      }
    expect(sways.size).toBeGreaterThan(1);
    expect(bangs.size).toBeGreaterThan(1);
  });

  test('the light pulse stays a soft alpha in [0.12, 0.4]', () => {
    for (let ms = 0; ms < 20000; ms += 53)
      for (let k = 0; k < 4; k++)
        for (const reduced of [false, true]) {
          const a = lightPulse(ms, k, reduced);
          expect(a).toBeGreaterThanOrEqual(0.12);
          expect(a).toBeLessThanOrEqual(0.4);
        }
  });
});
