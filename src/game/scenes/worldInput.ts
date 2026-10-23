import type Phaser from 'phaser';
import type { InputFrame, Vec } from '../../sim/types';
import { createKeyboard } from '../input/keyboard';
import { guardLifecycle, merge, type InputSource } from '../input/merge';
import { createTouch } from '../input/touch';

/** What the built-in input needs from the WorldScene. */
export interface WorldInputHooks {
  playerPos: () => Vec;
  togglePause: () => void;
  openPause: () => void;
  skipCinematic: () => void;
}

/** The built-in keyboard + touch sources, merged, and how to dispose of them. */
export interface WorldInput {
  sources: InputSource[];
  input: () => InputFrame;
  dispose: () => void;
}

/** Keyboard + touch (when the touch UI is there), the lifecycle guard, and the tap that skips the school cinematic. */
export function createWorldInput(canvas: HTMLCanvasElement, cam: Phaser.Cameras.Scene2D.Camera, hooks: WorldInputHooks): WorldInput {
  const sources: InputSource[] = [
    createKeyboard(
      window,
      canvas,
      (x, y) => {
        const p = cam.getWorldPoint(x, y);
        return { x: p.x, y: p.y };
      },
      () => hooks.playerPos(),
      { onPause: () => hooks.togglePause() },
    ),
  ];
  const touchRoot = document.getElementById('touch-ui');
  if (touchRoot) sources.push(createTouch(touchRoot, { onPause: () => hooks.togglePause() }));
  const offGuard = guardLifecycle(window, sources, () => hooks.openPause());
  // touch: a tap anywhere skips the school cinematic (keyboard/mouse go through the input frame)
  const onTap = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    if (e.target instanceof Element && e.target.closest('[data-action=pause]')) return;
    hooks.skipCinematic();
  };
  window.addEventListener('pointerdown', onTap, true);
  return {
    sources,
    input: merge(...sources),
    dispose: () => {
      window.removeEventListener('pointerdown', onTap, true);
      offGuard();
      for (const s of sources) {
        s.releaseAll();
        s.dispose?.();
      }
    },
  };
}
