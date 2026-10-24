/** Pure helpers of the `?perf` meter (no Phaser, no DOM). */

export interface Summary {
  avg: number;
  p95: number;
  max: number;
}

/** Average, 95th percentile and maximum of `values` (all zero when empty); the list is not reordered. */
export function summarize(values: readonly number[]): Summary {
  const n = values.length;
  if (n === 0) return { avg: 0, p95: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  return { avg: values.reduce((a, b) => a + b, 0) / n, p95: s[Math.min(n - 1, Math.floor(n * 0.95))]!, max: s[n - 1]! };
}

/** Drops the oldest values so at most `n` remain (in place). */
export function trimWindow(values: number[], n: number): void {
  if (values.length > n) values.splice(0, values.length - n);
}

/** Share (percent) of frames that ran no sim step, and of frames that ran two or more: both are visible hitches. */
export function cadence(stepsPerFrame: readonly number[]): { none: number; multi: number } {
  const n = stepsPerFrame.length;
  if (n === 0) return { none: 0, multi: 0 };
  return {
    none: Math.round((100 * stepsPerFrame.filter((s) => s === 0).length) / n),
    multi: Math.round((100 * stepsPerFrame.filter((s) => s > 1).length) / n),
  };
}
