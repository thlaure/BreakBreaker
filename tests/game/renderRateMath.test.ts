import { describe, expect, it } from 'vitest';
import { IDLE_FPS, fpsLimitFor } from '../../src/game/renderRateMath';

describe('fpsLimitFor', () => {
  it('runs unlimited (the display rate) while the game is being played', () => {
    expect(fpsLimitFor(false)).toBe(0);
  });

  it('drops to a low fixed rate while an overlay pauses the sim', () => {
    expect(fpsLimitFor(true)).toBe(IDLE_FPS);
  });

  it('keeps the idle rate high enough to feel instant on resume and on a resize', () => {
    expect(IDLE_FPS).toBeGreaterThanOrEqual(10);
    expect(IDLE_FPS).toBeLessThan(60);
  });
});
