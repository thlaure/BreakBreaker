import { cadence, summarize, trimWindow } from './perfMath';

/** Frames kept for the readout (about two seconds at 60 Hz) and key presses kept for the latency line. */
const FRAME_WINDOW = 120;
const PRESS_WINDOW = 20;
const REFRESH_MS = 500;

/** Whether the page asked for the meter (`?perf`). */
export function perfRequested(search: string): boolean {
  return new URLSearchParams(search).has('perf');
}

/**
 * The `?perf` meter: a small readout in a corner of the real game, for finding why it feels laggy on a given machine
 * without opening the developer tools. It shows the frame rate and frame time (average, 95th percentile, worst), how many
 * frames ran no sim step or several (a hitch each), and the time from a key press (or click) to the start of the frame
 * that applied it (the screen shows it about one more display refresh later). Costs nothing unless `?perf` is in the URL.
 */
export class PerfMeter {
  private readonly el: HTMLDivElement;
  private readonly frames: number[] = [];
  private readonly steps: number[] = [];
  private readonly latencies: number[] = [];
  private pending: number[] = [];
  private last = 0;
  private shownAt = 0;
  private readonly press = (e: Event): void => {
    if (!(e instanceof KeyboardEvent) || !e.repeat) this.pending.push(e.timeStamp);
  };

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:4px;bottom:4px;z-index:99999;padding:3px 6px;font:11px/1.35 ui-monospace,Menlo,monospace;color:#7dff7d;background:rgba(0,0,0,0.7);pointer-events:none;white-space:pre';
    this.el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.el);
    window.addEventListener('keydown', this.press, true);
    window.addEventListener('pointerdown', this.press, true);
  }

  /** Call once per scene update, at its start: `steps` = sim steps run this frame. */
  frame(now: number, steps: number): void {
    if (this.last > 0) {
      this.frames.push(now - this.last);
      this.steps.push(steps);
      trimWindow(this.frames, FRAME_WINDOW);
      trimWindow(this.steps, FRAME_WINDOW);
    }
    this.last = now;
    // a press is applied by the first frame that steps the sim after it
    if (steps > 0 && this.pending.length > 0) {
      const rest: number[] = [];
      for (const t of this.pending) {
        if (t <= now) this.latencies.push(now - t);
        else rest.push(t);
      }
      this.pending = rest;
      trimWindow(this.latencies, PRESS_WINDOW);
    }
    if (now - this.shownAt >= REFRESH_MS) {
      this.shownAt = now;
      this.show();
    }
  }

  private show(): void {
    const f = summarize(this.frames);
    const l = summarize(this.latencies);
    const c = cadence(this.steps);
    const fps = f.avg > 0 ? Math.round(1000 / f.avg) : 0;
    this.el.textContent =
      `${fps} fps  frame ${f.avg.toFixed(1)} / p95 ${f.p95.toFixed(1)} / max ${f.max.toFixed(0)} ms\n` +
      `0 pas ${c.none} %  2+ pas ${c.multi} %\n` +
      `touche → image  moy ${l.avg.toFixed(0)} / max ${l.max.toFixed(0)} ms  (n=${this.latencies.length})`;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.press, true);
    window.removeEventListener('pointerdown', this.press, true);
    this.el.remove();
  }
}
