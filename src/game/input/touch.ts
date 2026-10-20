import type { Vec } from '../../sim/types';
import type { InputSource } from './merge';

const STICK_RADIUS = 56;
const DEAD_ZONE = 0.2;
const RUN_AT = 0.9;
const AIM_DRAG_MIN = 12;

export interface TouchOptions {
  onPause?: () => void;
}

interface Tracked {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

/**
 * Touch controls over the HTML in `root` (#touch-ui): `[data-zone=stick]` (dynamic-origin joystick),
 * `[data-action=strike|throw|act|pause]` buttons. Each control tracks its own pointerId.
 */
export function createTouch(root: HTMLElement, opts: TouchOptions = {}): InputSource {
  const q = (s: string): HTMLElement | null => root.querySelector<HTMLElement>(s);
  const zone = q('[data-zone=stick]');
  const knob = q('[data-knob]');
  const btn = (a: string): HTMLElement | null => q(`[data-action=${a}]`);

  let stick: Tracked | null = null;
  let actId: number | null = null;
  let rock: Tracked | null = null;
  let strike = false;
  let throwRock = false;
  let aimed = false; // rock drag exceeded the minimum
  let pendingAim: Vec | null = null; // aim delivered with the release throw
  let lastAim: Vec | null = null;

  const show = (): void => {
    root.classList.add('visible', 'touched');
  };
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) show();

  const stickVec = (): Vec => {
    if (!stick) return { x: 0, y: 0 };
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const len = Math.hypot(dx, dy);
    const mag = Math.min(1, len / STICK_RADIUS);
    if (mag < DEAD_ZONE) return { x: 0, y: 0 };
    return { x: (dx / len) * mag, y: (dy / len) * mag };
  };
  const rockAim = (): Vec | null => {
    if (!rock) return null;
    const dx = rock.x - rock.ox;
    const dy = rock.y - rock.oy;
    const len = Math.hypot(dx, dy);
    return len >= AIM_DRAG_MIN ? { x: dx / len, y: dy / len } : null;
  };
  const drawKnob = (): void => {
    if (!zone || !knob) return;
    if (!stick) {
      knob.style.display = 'none';
      return;
    }
    const r = zone.getBoundingClientRect();
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / STICK_RADIUS);
    knob.style.display = 'block';
    knob.style.left = `${stick.ox - r.left + (dx / len) * k * STICK_RADIUS}px`;
    knob.style.top = `${stick.oy - r.top + (dy / len) * k * STICK_RADIUS}px`;
  };

  const down = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') show();
    const t = e.target as Element | null;
    if (!t) return;
    const strikeEl = btn('strike');
    const throwEl = btn('throw');
    const actEl = btn('act');
    const pauseEl = btn('pause');
    if (strikeEl?.contains(t)) strike = true;
    else if (throwEl?.contains(t)) {
      if (!rock) {
        rock = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        aimed = false;
      }
    } else if (actEl?.contains(t)) {
      if (actId === null) actId = e.pointerId;
    } else if (pauseEl?.contains(t)) opts.onPause?.();
    else if (zone?.contains(t)) {
      if (e.pointerType === 'mouse') return;
      if (!stick) {
        stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        drawKnob();
      }
    } else return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is optional */
    }
  };
  const move = (e: PointerEvent): void => {
    if (stick && e.pointerId === stick.id) {
      stick.x = e.clientX;
      stick.y = e.clientY;
      drawKnob();
    }
    if (rock && e.pointerId === rock.id) {
      rock.x = e.clientX;
      rock.y = e.clientY;
      if (rockAim()) aimed = true;
    }
  };
  const end = (e: PointerEvent, cancelled: boolean): void => {
    if (stick && e.pointerId === stick.id) {
      stick = null;
      drawKnob();
    }
    if (actId === e.pointerId) actId = null;
    if (rock && e.pointerId === rock.id) {
      const a = rockAim();
      if (a) lastAim = a;
      if (!cancelled) {
        pendingAim = a ?? lastAim;
        throwRock = true;
      }
      rock = null;
      aimed = false;
    }
  };
  const up = (e: PointerEvent): void => end(e, false);
  const cancel = (e: PointerEvent): void => end(e, true);
  const releaseAll = (): void => {
    stick = null;
    actId = null;
    rock = null;
    strike = false;
    throwRock = false;
    aimed = false;
    pendingAim = null;
    drawKnob();
  };

  const seen = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') show();
  };
  root.addEventListener('pointerdown', down);
  const w = root.ownerDocument.defaultView ?? window;
  w.addEventListener('pointermove', move);
  w.addEventListener('pointerup', up);
  w.addEventListener('pointercancel', cancel);
  w.addEventListener('pointerdown', seen, true);
  const ctx = (e: Event): void => e.preventDefault();
  root.addEventListener('contextmenu', ctx);

  drawKnob();

  return {
    read() {
      const m = stickVec();
      const dragAim = rock && aimed ? rockAim() : null;
      const aim = dragAim ?? pendingAim;
      const frame = {
        move: m,
        aim,
        run: Math.hypot(m.x, m.y) > RUN_AT,
        strike,
        throwRock,
        act: actId !== null,
      };
      if (dragAim) lastAim = dragAim;
      strike = false;
      throwRock = false;
      pendingAim = null;
      return frame;
    },
    releaseAll,
    dispose() {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('contextmenu', ctx);
      w.removeEventListener('pointermove', move);
      w.removeEventListener('pointerup', up);
      w.removeEventListener('pointercancel', cancel);
      w.removeEventListener('pointerdown', seen, true);
    },
  };
}
