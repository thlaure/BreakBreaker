import { describe, expect, test } from 'vitest';
import { QUOTES } from '../../src/content/quotes';
import {
  AGITATION_RADIUS,
  MOODS,
  agitation,
  initPresident,
  moodHoldMs,
  nextMood,
  pickQuote,
  poseFrame,
  presidentBob,
  presidentRng,
  quoteDelayMs,
  stepPresident,
  type Mood,
} from '../../src/game/render/presidentMath';

describe('the President on the balcony', () => {
  test('the render-side rng is seeded and stays in [0, 1)', () => {
    const a = presidentRng(42);
    const b = presidentRng(42);
    for (let i = 0; i < 500; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('nextMood never returns the current mood and reaches every other one', () => {
    const rand = presidentRng(7);
    for (const cur of MOODS) {
      const seen = new Set<Mood>();
      for (let i = 0; i < 200; i++) {
        const m = nextMood(rand, cur);
        expect(m).not.toBe(cur);
        expect(MOODS).toContain(m);
        seen.add(m);
      }
      expect(seen.size).toBe(MOODS.length - 1);
    }
    // the edges of the rng range
    for (const cur of MOODS) {
      expect(nextMood(() => 0, cur)).not.toBe(cur);
      expect(nextMood(() => 0.999999, cur)).not.toBe(cur);
    }
  });

  test('moodHoldMs in [3000, 6000]', () => {
    const rand = presidentRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = moodHoldMs(rand);
      expect(v).toBeGreaterThanOrEqual(3000);
      expect(v).toBeLessThanOrEqual(6000);
    }
    expect(moodHoldMs(() => 0)).toBe(3000);
    expect(moodHoldMs(() => 0.999999)).toBeLessThanOrEqual(6000);
  });

  test('quoteDelayMs in [8000, 14000]', () => {
    const rand = presidentRng(5);
    for (let i = 0; i < 1000; i++) {
      const v = quoteDelayMs(rand);
      expect(v).toBeGreaterThanOrEqual(8000);
      expect(v).toBeLessThanOrEqual(14000);
    }
    expect(quoteDelayMs(() => 0)).toBe(8000);
  });

  test('pickQuote never repeats last and covers the whole list over many draws', () => {
    const rand = presidentRng(11);
    const seen = new Set<string>();
    let last: string | null = null;
    for (let i = 0; i < 3000; i++) {
      const q = pickQuote(rand, last);
      expect(QUOTES).toContain(q);
      expect(q).not.toBe(last);
      seen.add(q);
      last = q;
    }
    expect(seen.size).toBe(QUOTES.length);
    // rng edges, and a `last` that is not in the list
    expect(pickQuote(() => 0.999999, QUOTES[QUOTES.length - 1]!)).not.toBe(QUOTES[QUOTES.length - 1]);
    expect(pickQuote(() => 0, QUOTES[0]!)).not.toBe(QUOTES[0]);
    expect(QUOTES).toContain(pickQuote(() => 0.5, 'pas une citation'));
  });

  test('agitation is stronger when Paul is within 6 tiles of the balcony', () => {
    expect(AGITATION_RADIUS).toBe(192);
    expect(agitation(0)).toBeGreaterThan(agitation(191));
    expect(agitation(100)).toBeGreaterThan(agitation(400));
    expect(agitation(192)).toBe(1);
    expect(agitation(1000)).toBe(1);
    expect(agitation(Infinity)).toBe(1);
    expect(agitation(0)).toBeLessThanOrEqual(2);
    for (let d = 0; d < 192; d += 16) expect(agitation(d)).toBeGreaterThan(1);
  });

  test('pose frame and bob: animated, faster and higher when agitated, frozen under reduced motion', () => {
    const frames = (agit: number): number => {
      let flips = 0;
      for (let t = 0, prev = poseFrame(0, agit, false); t < 10000; t += 20) {
        const f = poseFrame(t, agit, false);
        if (f !== prev) flips++;
        prev = f;
      }
      return flips;
    };
    expect(frames(2)).toBeGreaterThan(frames(1));
    const peak = (agit: number): number => {
      let m = 0;
      for (let t = 0; t < 5000; t += 10) m = Math.min(m, presidentBob(t, 'arms', agit, false));
      return m;
    };
    expect(peak(2)).toBeLessThan(peak(1));
    for (let t = 0; t < 5000; t += 37) {
      expect(poseFrame(t, 2, true)).toBe(0);
      for (const m of MOODS) {
        expect(presidentBob(t, m, 2, true)).toBe(0);
        expect(Number.isInteger(presidentBob(t, m, 1.37, false))).toBe(true);
      }
    }
  });

  test('stepPresident changes mood on time, shows a quote every 8–14 s, and freezes the mood under reduced motion', () => {
    const rand = presidentRng(1);
    const s = initPresident(rand, 0);
    let moodChanges = 0;
    let quotes = 0;
    let shownMs = 0;
    let prevMood = s.mood;
    let prevQuote: string | null = null;
    for (let t = 0; t <= 120000; t += 50) {
      stepPresident(s, rand, t, false);
      if (s.mood !== prevMood) moodChanges++;
      if (s.quote !== null && s.quote !== prevQuote) {
        quotes++;
        expect(s.quote).not.toBe(prevQuote);
      }
      if (s.quote !== null) shownMs += 50;
      prevMood = s.mood;
      prevQuote = s.quote ?? prevQuote;
    }
    expect(moodChanges).toBeGreaterThanOrEqual(120 / 6 - 1);
    expect(moodChanges).toBeLessThanOrEqual(120 / 3 + 1);
    expect(quotes).toBeGreaterThanOrEqual(8);
    expect(quotes).toBeLessThanOrEqual(16);
    expect(shownMs).toBeGreaterThan(0);

    const frozen = initPresident(presidentRng(2), 0);
    const mood = frozen.mood;
    let bubbles = 0;
    for (let t = 0; t <= 60000; t += 100) {
      stepPresident(frozen, rand, t, true);
      expect(frozen.mood).toBe(mood);
      if (frozen.quote) bubbles++;
    }
    expect(bubbles).toBeGreaterThan(0);
  });

  test('after a long pause (off-screen) the next change is scheduled from now, not replayed', () => {
    const rand = presidentRng(9);
    const s = initPresident(rand, 0);
    stepPresident(s, rand, 1_000_000, false);
    expect(s.moodUntil).toBeGreaterThanOrEqual(1_003_000);
    expect(s.nextQuoteAt).toBeGreaterThanOrEqual(1_008_000);
  });
});
