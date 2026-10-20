import type { InputFrame } from '../../sim/types';

/**
 * Temporary keyboard source for play-testing (Task 13 replaces it via WorldScene.setInputSource).
 * Uses `event.code` so WASD (QWERTY) and ZQSD (AZERTY) are the same physical keys. Arrows also move.
 * Space = strike, E = throw, F = act (held), Shift = run. Strike/throw are latched until read once.
 */
export function createDevKeyboard(target: Window = window): { read: () => InputFrame; dispose: () => void } {
  const held = new Set<string>();
  let strike = false;
  let throwRock = false;

  const down = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Space') strike = true;
      if (e.code === 'KeyE') throwRock = true;
    }
    held.add(e.code);
  };
  const up = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const release = (): void => held.clear();

  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', release);

  const any = (...codes: string[]): boolean => codes.some((c) => held.has(c));

  return {
    read(): InputFrame {
      const x = (any('KeyD', 'ArrowRight') ? 1 : 0) - (any('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (any('KeyS', 'ArrowDown') ? 1 : 0) - (any('KeyW', 'ArrowUp') ? 1 : 0);
      const frame: InputFrame = {
        move: { x, y },
        aim: null,
        run: any('ShiftLeft', 'ShiftRight'),
        strike,
        throwRock,
        act: held.has('KeyF'),
      };
      strike = false;
      throwRock = false;
      return frame;
    },
    dispose(): void {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', release);
    },
  };
}
