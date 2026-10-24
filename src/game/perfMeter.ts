import Phaser from 'phaser';
import { cadence, summarize, trimWindow } from './perfMath';
import { LAYER_TYPES, offLayers } from './perfSwitches';

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
  /** Time spent in the game's own frame (update and render calls), apart from the browser's compositing. */
  private readonly work: number[] = [];
  /** Graphics-card time per frame (WebGL timer query, when the browser offers it). */
  private readonly gpu: number[] = [];
  private frameStart = 0;
  private pending: number[] = [];
  private last = 0;
  private shownAt = 0;
  private readonly press = (e: Event): void => {
    if (!(e instanceof KeyboardEvent) || !e.repeat) this.pending.push(e.timeStamp);
  };

  constructor(private readonly info: () => string = () => '') {
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
    this.frameStart = now;
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

  /** Call after the frame is drawn (Phaser's `postrender`): closes the frame's own work time. */
  frameEnd(now: number, gpuMs: number | null = null): void {
    if (this.frameStart > 0) {
      this.work.push(now - this.frameStart);
      trimWindow(this.work, FRAME_WINDOW);
    }
    if (gpuMs !== null) {
      this.gpu.push(gpuMs);
      trimWindow(this.gpu, FRAME_WINDOW);
    }
  }

  private show(): void {
    const f = summarize(this.frames);
    const l = summarize(this.latencies);
    const c = cadence(this.steps);
    const w = summarize(this.work);
    const gp = summarize(this.gpu);
    const gpuLine = this.gpu.length > 0 ? `  GPU moy ${gp.avg.toFixed(1)} / p95 ${gp.p95.toFixed(1)} ms` : '  GPU ?';
    const fps = f.avg > 0 ? Math.round(1000 / f.avg) : 0;
    this.el.textContent =
      `${fps} fps  frame ${f.avg.toFixed(1)} / p95 ${f.p95.toFixed(1)} / max ${f.max.toFixed(0)} ms\n` +
      `0 pas ${c.none} %  2+ pas ${c.multi} %\n` +
      `touche → image  moy ${l.avg.toFixed(0)} / max ${l.max.toFixed(0)} ms  (n=${this.latencies.length})\n` +
      `travail du jeu  moy ${w.avg.toFixed(1)} / p95 ${w.p95.toFixed(1)} ms${gpuLine}\n` +
      this.info();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.press, true);
    window.removeEventListener('pointerdown', this.press, true);
    this.el.remove();
  }
}

/** The meter for `scene`'s game when the URL has `?perf` (null otherwise): it closes each frame on Phaser's `postrender`. */
export function createPerfMeter(scene: Phaser.Scene): PerfMeter | null {
  if (!perfRequested(globalThis.location?.search ?? '')) return null;
  const game = scene.game;
  const info = (): string => `${scene.children.length} objets  ${game.canvas.width}×${game.canvas.height} @${window.devicePixelRatio}x`;
  const meter = new PerfMeter(info);
  const gpu = createGpuTimer(game);
  const off = offLayers(globalThis.location?.search ?? '');
  let lastSwitch = 0;
  const begin = (): void => gpu?.begin();
  const end = (): void => {
    gpu?.end();
    meter.frameEnd(performance.now(), gpu?.lastMs() ?? null);
    // `?off=`: re-applied about once a second, so objects created later are switched off too
    const now = performance.now();
    if (off.length > 0 && now - lastSwitch > 1000) {
      lastSwitch = now;
      switchOff(scene, off);
    }
  };
  game.events.on(Phaser.Core.Events.PRE_RENDER, begin);
  game.events.on(Phaser.Core.Events.POST_RENDER, end);
  const destroy = meter.destroy.bind(meter);
  meter.destroy = (): void => {
    game.events.off(Phaser.Core.Events.PRE_RENDER, begin);
    game.events.off(Phaser.Core.Events.POST_RENDER, end);
    destroy();
  };
  return meter;
}

/** A WebGL timer query around each frame (Chrome's EXT_disjoint_timer_query_webgl2); null when unavailable. */
function createGpuTimer(game: Phaser.Game): { begin(): void; end(): void; lastMs(): number | null } | null {
  const gl = (game.renderer as { gl?: WebGL2RenderingContext }).gl;
  const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2') as
    { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null | undefined;
  if (!gl || !ext) return null;
  const pending: WebGLQuery[] = [];
  let open: WebGLQuery | null = null;
  let last: number | null = null;
  return {
    begin() {
      if (open || pending.length > 6) return;
      open = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, open);
    },
    end() {
      if (open) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push(open);
        open = null;
      }
      const q = pending[0];
      if (q && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
        pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) last = Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6;
        gl.deleteQuery(q);
      }
    },
    lastMs: () => last,
  };
}

/** Hides every game object of the layers asked for with `?off=` (and the HUD overlay for `hud`). */
function switchOff(scene: Phaser.Scene, layers: readonly string[]): void {
  if (layers.includes('hud')) document.querySelectorAll<HTMLElement>('.bb-hud').forEach((e) => (e.style.display = 'none'));
  const types = new Set(layers.flatMap((l) => (l in LAYER_TYPES ? LAYER_TYPES[l as keyof typeof LAYER_TYPES] : [])));
  if (types.size === 0) return;
  for (const o of scene.children.list)
    if (types.has(o.type)) (o as Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }).setVisible(false);
}
