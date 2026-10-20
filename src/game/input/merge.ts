import type { InputFrame, Vec } from '../../sim/types';

export interface InputSource {
  /** Current state. Edge-triggered fields (strike, throwRock) are consumed: true for exactly one read. */
  read(): Partial<InputFrame>;
  releaseAll(): void;
  dispose?(): void;
}

/** Combines sources into one frame getter. Call it ONCE per sim step so edge presses reach exactly one step. */
export function merge(...sources: InputSource[]): () => InputFrame {
  return () => {
    let mx = 0;
    let my = 0;
    let aim: Vec | null = null;
    let run = false;
    let strike = false;
    let throwRock = false;
    let act = false;
    for (const s of sources) {
      const f = s.read();
      if (f.move) {
        mx += f.move.x;
        my += f.move.y;
      }
      if (aim === null && f.aim) aim = f.aim;
      run ||= !!f.run;
      strike ||= !!f.strike;
      throwRock ||= !!f.throwRock;
      act ||= !!f.act;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    return { move: { x: mx, y: my }, aim, run, strike, throwRock, act };
  };
}

/** blur / page hidden / pointercancel: release every source and pause (never auto-resumes). */
export function guardLifecycle(target: Window, sources: InputSource[], onPause: () => void): () => void {
  const stop = (): void => {
    for (const s of sources) s.releaseAll();
    onPause();
  };
  const vis = (): void => {
    if (document.visibilityState === 'hidden') stop();
  };
  target.addEventListener('blur', stop);
  target.addEventListener('pointercancel', stop);
  document.addEventListener('visibilitychange', vis);
  return () => {
    target.removeEventListener('blur', stop);
    target.removeEventListener('pointercancel', stop);
    document.removeEventListener('visibilitychange', vis);
  };
}
