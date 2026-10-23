/** Render rate while an overlay (pause, controls, end summary, intro card) pauses the sim: the scene is frozen behind it. */
export const IDLE_FPS = 15;

/** Phaser fps limit for the current sim state: 0 = unlimited (the display rate). */
export function fpsLimitFor(paused: boolean): number {
  return paused ? IDLE_FPS : 0;
}
