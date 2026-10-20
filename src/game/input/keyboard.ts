import type { Vec } from '../../sim/types';
import type { InputSource } from './merge';

const MOUSE_AIM_MS = 2000;

export interface KeyboardOptions {
  onPause?: () => void;
  now?: () => number;
}

/** Keyboard + mouse. Uses `event.code` so QWERTY WASD and AZERTY ZQSD are the same physical keys. */
export function createKeyboard(
  target: Window,
  canvas: HTMLCanvasElement,
  worldFromScreen: (x: number, y: number) => Vec,
  playerPos: () => Vec,
  opts: KeyboardOptions = {},
): InputSource {
  const now = opts.now ?? ((): number => performance.now());
  const held = new Set<string>();
  let strike = false;
  let throwRock = false;
  let mouseUntil = -Infinity;
  let mouse: { x: number; y: number } | null = null;

  const keydown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Space') strike = true;
      else if (e.code === 'KeyE') throwRock = true;
      else if (e.code === 'Escape') opts.onPause?.();
    }
    held.add(e.code);
  };
  const keyup = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const local = (e: MouseEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pmove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    mouse = local(e);
    mouseUntil = now() + MOUSE_AIM_MS;
  };
  const pdown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    mouse = local(e);
    mouseUntil = now() + MOUSE_AIM_MS;
    if (e.button === 0) strike = true;
    else if (e.button === 2) throwRock = true;
  };
  const ctx = (e: Event): void => e.preventDefault();
  const release = (): void => {
    held.clear();
    strike = false;
    throwRock = false;
  };

  target.addEventListener('keydown', keydown);
  target.addEventListener('keyup', keyup);
  target.addEventListener('blur', release);
  canvas.addEventListener('pointermove', pmove);
  canvas.addEventListener('pointerdown', pdown);
  canvas.addEventListener('contextmenu', ctx);

  const any = (...codes: string[]): boolean => codes.some((c) => held.has(c));

  return {
    read() {
      let x = (any('KeyD', 'ArrowRight') ? 1 : 0) - (any('KeyA', 'ArrowLeft') ? 1 : 0);
      let y = (any('KeyS', 'ArrowDown') ? 1 : 0) - (any('KeyW', 'ArrowUp') ? 1 : 0);
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      let aim: Vec | null = null;
      if (mouse && now() <= mouseUntil) {
        const w = worldFromScreen(mouse.x, mouse.y);
        const p = playerPos();
        const dx = w.x - p.x;
        const dy = w.y - p.y;
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) aim = { x: dx / len, y: dy / len };
      }
      const frame = {
        move: { x, y },
        aim,
        run: any('ShiftLeft', 'ShiftRight'),
        strike,
        throwRock,
        act: held.has('KeyF'),
      };
      strike = false;
      throwRock = false;
      return frame;
    },
    releaseAll: release,
    dispose() {
      target.removeEventListener('keydown', keydown);
      target.removeEventListener('keyup', keyup);
      target.removeEventListener('blur', release);
      canvas.removeEventListener('pointermove', pmove);
      canvas.removeEventListener('pointerdown', pdown);
      canvas.removeEventListener('contextmenu', ctx);
    },
  };
}
