/**
 * Pure helpers of the rock stage (render only, never the simulation's rng): when the skeleton singer sings, which line,
 * and the band's small moves (sway, head-bang, light pulse). No Phaser import here.
 */

/** How long a lyric bubble stays up (ms). */
export const LYRIC_SHOW_MS = 3500;
/** The first line comes this soon after the stage comes into view (ms). */
const FIRST_LYRIC_MS = 1200;

/** A whole index in [0, n) from a rng value, safe at the edges of [0, 1). */
function index(rand: () => number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(rand() * n)));
}

/** Delay between two lyric bubbles (ms), in [6000, 11000]. */
export function lyricDelayMs(rand: () => number): number {
  return 6000 + Math.min(5000, Math.floor(rand() * 5001));
}

/** A line index in [0, count), never `last` again (any line when `last` is null). */
export function pickLyric(rand: () => number, last: number | null, count: number): number {
  if (last === null || count < 2) return index(rand, count);
  const k = index(rand, count - 1);
  return k >= last ? k + 1 : k;
}

/** The singer's changing state: the line in the bubble (an index, so a language switch redraws it), and its timings. */
export interface SingerState {
  lyric: number | null;
  until: number;
  nextAt: number;
  last: number | null;
}

export function initSinger(nowMs: number): SingerState {
  return { lyric: null, until: 0, nextAt: nowMs + FIRST_LYRIC_MS, last: null };
}

/**
 * Advance to `nowMs`: the bubble is hidden after LYRIC_SHOW_MS, and a new line comes every lyricDelayMs, scheduled
 * from now (after a long pause off-screen nothing is replayed).
 */
export function stepSinger(s: SingerState, rand: () => number, nowMs: number, count: number): void {
  if (s.lyric !== null && nowMs >= s.until) s.lyric = null;
  if (s.lyric === null && nowMs >= s.nextAt) {
    s.lyric = pickLyric(rand, s.last, count);
    s.last = s.lyric;
    s.until = nowMs + LYRIC_SHOW_MS;
    s.nextAt = nowMs + LYRIC_SHOW_MS + lyricDelayMs(rand);
  }
}

/** Beat length of the band's moves (ms). */
const BEAT_MS = 460;

/** Sideways sway of musician `k` (whole px in [-1, 1]), each a little out of step; 0 under reduced motion. */
export function swayOffset(timeMs: number, k: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.round(Math.sin((timeMs / (BEAT_MS * 2)) * Math.PI + k * 1.3));
}

/** A tiny head-bang of musician `k` (whole px down, in [0, 2]) on the beat; 0 under reduced motion. */
export function headBang(timeMs: number, k: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const phase = ((timeMs + k * 115) % BEAT_MS) / BEAT_MS;
  return phase < 0.2 ? 2 : phase < 0.4 ? 1 : 0;
}

/** Alpha of stage light `k`: a soft pulse in [0.12, 0.4], each light out of step; steady 0.26 under reduced motion. */
export function lightPulse(timeMs: number, k: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.26;
  return 0.26 + 0.14 * Math.sin(timeMs / 700 + k * 1.7);
}
