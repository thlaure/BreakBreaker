/**
 * Pure helpers of the President on the château balcony (render only, never the simulation's rng): moods, timings,
 * quote draws, agitation near Paul and the small pose animation. No Phaser import here.
 */
import { quotesFor } from '../../content/quotes';

/** The four moods he loops through: arms up and waving, crying, angry with a fist, calm. */
export type Mood = 'arms' | 'cry' | 'angry' | 'calm';
export const MOODS: readonly Mood[] = ['arms', 'cry', 'angry', 'calm'];

/** How long a quote bubble stays up (ms). */
export const QUOTE_SHOW_MS = 4500;
/** The first quote comes this soon after the President appears (ms). */
const FIRST_QUOTE_MS = 1500;
/** Paul within 6 tiles (px) of the balcony makes him more agitated. */
export const AGITATION_RADIUS = 192;

/** A small seeded generator for the President alone (mulberry32), values in [0, 1). */
export function presidentRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole index in [0, n) from a rng value, safe at the edges of [0, 1). */
function index(rand: () => number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(rand() * n)));
}

/** A different mood than `current`, uniformly among the three others. */
export function nextMood(rand: () => number, current: Mood): Mood {
  const others = MOODS.filter((m) => m !== current);
  return others[index(rand, others.length)]!;
}

/** How long a mood lasts (ms), in [3000, 6000]. */
export function moodHoldMs(rand: () => number): number {
  return 3000 + Math.floor(rand() * 3001);
}

/** Delay between two quote bubbles (ms), in [8000, 14000]. */
export function quoteDelayMs(rand: () => number): number {
  return 8000 + Math.floor(rand() * 6001);
}

/**
 * A quote from `quotes` (the current language's dictionary by default), never `last` again (any line when `last` is
 * not in the list).
 */
export function pickQuote(rand: () => number, last: string | null, quotes: readonly string[] = quotesFor()): string {
  const pool = last === null ? quotes : quotes.filter((q) => q !== last);
  return pool[index(rand, pool.length)]!;
}

/** Animation strength from Paul's distance to the balcony (px): 1 from 6 tiles away, up to 2 right under it. */
export function agitation(distPx: number): number {
  if (!(distPx < AGITATION_RADIUS)) return 1;
  return 1 + (1 - Math.max(0, distPx) / AGITATION_RADIUS);
}

/** Which of the two frames of the current pose shows (waving arms, falling tears, shaking fist); 0 under reduced motion. */
export function poseFrame(timeMs: number, agit: number, reducedMotion: boolean): 0 | 1 {
  if (reducedMotion) return 0;
  return Math.floor((timeMs * agit) / 380) % 2 === 0 ? 0 : 1;
}

/** Vertical bob (whole px, ≤ 0): calm breathes, the others hop, higher and faster when agitated; none under reduced motion. */
export function presidentBob(timeMs: number, mood: Mood, agit: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (mood === 'calm') return Math.sin(timeMs / 900) > 0.6 ? -1 : 0;
  const hop = Math.abs(Math.sin((timeMs * agit) / 160));
  return -Math.round(hop * (mood === 'cry' ? 1 : agit));
}

/** The President's changing state: his mood, the quote in his bubble, and when each changes next. */
export interface PresidentState {
  mood: Mood;
  moodUntil: number;
  quote: string | null;
  quoteUntil: number;
  nextQuoteAt: number;
  last: string | null;
}

export function initPresident(rand: () => number, nowMs: number): PresidentState {
  return {
    mood: MOODS[index(rand, MOODS.length)]!,
    moodUntil: nowMs + moodHoldMs(rand),
    quote: null,
    quoteUntil: 0,
    nextQuoteAt: nowMs + FIRST_QUOTE_MS,
    last: null,
  };
}

/**
 * Advance to `nowMs`: a new mood once the hold runs out (never under reduced motion: the pose stays frozen), the bubble
 * hidden after QUOTE_SHOW_MS and a new quote every quoteDelayMs. After a long pause (off-screen) the next change is
 * scheduled from now, never replayed. A quote not in the current language's dictionary (the player switched language)
 * is hidden at once.
 */
export function stepPresident(s: PresidentState, rand: () => number, nowMs: number, reducedMotion: boolean): void {
  if (!reducedMotion && nowMs >= s.moodUntil) {
    s.mood = nextMood(rand, s.mood);
    s.moodUntil = nowMs + moodHoldMs(rand);
  }
  // after a language switch, the bubble of the other language goes at once (the next quote comes in the new one)
  if (s.quote !== null && (nowMs >= s.quoteUntil || !quotesFor().includes(s.quote))) s.quote = null;
  if (s.quote === null && nowMs >= s.nextQuoteAt) {
    s.quote = pickQuote(rand, s.last);
    s.last = s.quote;
    s.quoteUntil = nowMs + QUOTE_SHOW_MS;
    s.nextQuoteAt = nowMs + quoteDelayMs(rand);
  }
}
