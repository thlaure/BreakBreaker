// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { createKeyboard } from '../../src/game/input/keyboard';
import { createTouch } from '../../src/game/input/touch';
import { guardLifecycle, merge } from '../../src/game/input/merge';

beforeAll(() => {
  if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
    class PE extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = PE;
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PE;
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

function key(type: 'keydown' | 'keyup', code: string): KeyboardEvent {
  const e = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

function setupKeyboard(onPause = vi.fn()) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const kb = createKeyboard(window, canvas, (x, y) => ({ x, y }), () => ({ x: 0, y: 0 }), { onPause });
  return { kb, canvas, onPause };
}

function ptr(el: EventTarget, type: string, id: number, x = 0, y = 0, pointerType = 'touch', button = 0): void {
  el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType, button, bubbles: true, cancelable: true }));
}

function setupTouch(onPause = vi.fn()) {
  document.body.innerHTML = `<div id="touch-ui">
    <div data-zone="stick"><div data-knob></div></div>
    <button data-action="strike">Frapper</button>
    <button data-action="throw">Renvoyer</button>
    <button data-action="act">Agir</button>
    <button data-action="pause">Pause</button></div>`;
  const root = document.getElementById('touch-ui') as HTMLElement;
  const touch = createTouch(root, { onPause });
  const q = (s: string) => root.querySelector(s) as HTMLElement;
  return { touch, root, stick: q('[data-zone=stick]'), strike: q('[data-action=strike]'), rock: q('[data-action=throw]'), act: q('[data-action=act]'), pause: q('[data-action=pause]'), onPause };
}

describe('keyboard', () => {
  test('diagonal keys produce normalized move', () => {
    const { kb } = setupKeyboard();
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    const m = kb.read().move!;
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(1, 6);
    expect(m.x).toBeGreaterThan(0);
    expect(m.y).toBeLessThan(0);
    kb.dispose?.();
  });

  test('physical codes: AZERTY Z (code KeyW) moves up', () => {
    const { kb } = setupKeyboard();
    key('keydown', 'KeyW');
    expect(kb.read().move).toEqual({ x: 0, y: -1 });
    key('keyup', 'KeyW');
    key('keydown', 'ArrowLeft');
    expect(kb.read().move).toEqual({ x: -1, y: 0 });
    kb.dispose?.();
  });

  test('strike press is edge-triggered', () => {
    const { kb } = setupKeyboard();
    key('keydown', 'Space');
    expect(kb.read().strike).toBe(true);
    expect(kb.read().strike).toBe(false);
    kb.dispose?.();
  });

  test('merged source delivers a press to exactly one read', () => {
    const { kb } = setupKeyboard();
    const src = merge(kb);
    key('keydown', 'KeyE');
    expect(src().throwRock).toBe(true);
    expect(src().throwRock).toBe(false);
    kb.dispose?.();
  });

  test('blur releases all held inputs (RC-40)', () => {
    const { kb } = setupKeyboard();
    key('keydown', 'KeyD');
    key('keydown', 'ShiftLeft');
    key('keydown', 'KeyF');
    expect(kb.read().run).toBe(true);
    window.dispatchEvent(new Event('blur'));
    const f = kb.read();
    expect(f.move).toEqual({ x: 0, y: 0 });
    expect(f.run).toBe(false);
    expect(f.act).toBe(false);
    kb.dispose?.();
  });

  test('Space and arrows are default-prevented; contextmenu prevented on canvas', () => {
    const { kb, canvas } = setupKeyboard();
    expect(key('keydown', 'Space').defaultPrevented).toBe(true);
    expect(key('keydown', 'ArrowUp').defaultPrevented).toBe(true);
    const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(cm);
    expect(cm.defaultPrevented).toBe(true);
    kb.dispose?.();
  });

  test('mouse: aim after move, null after 2 s, buttons strike/throw, Escape pauses', () => {
    let t = 1000;
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const onPause = vi.fn();
    const kb = createKeyboard(window, canvas, (x, y) => ({ x, y }), () => ({ x: 0, y: 0 }), { onPause, now: () => t });
    expect(kb.read().aim).toBeNull();
    ptr(canvas, 'pointermove', 1, 30, 40, 'mouse');
    const a = kb.read().aim!;
    expect(a.x).toBeCloseTo(0.6);
    expect(a.y).toBeCloseTo(0.8);
    t += 2500;
    expect(kb.read().aim).toBeNull();
    ptr(canvas, 'pointerdown', 1, 30, 40, 'mouse', 0);
    expect(kb.read().strike).toBe(true);
    expect(kb.read().aim).not.toBeNull();
    ptr(canvas, 'pointerdown', 1, 30, 40, 'mouse', 2);
    expect(kb.read().throwRock).toBe(true);
    key('keydown', 'Escape');
    expect(onPause).toHaveBeenCalledTimes(1);
    kb.dispose?.();
  });
});

describe('touch', () => {
  test('joystick and button pointers are independent', () => {
    const { touch, stick, strike } = setupTouch();
    ptr(stick, 'pointerdown', 1, 100, 300);
    ptr(window, 'pointermove', 1, 130, 300);
    const before = touch.read().move!;
    expect(before.x).toBeGreaterThan(0.4);
    ptr(strike, 'pointerdown', 2, 500, 300);
    ptr(window, 'pointerup', 2, 500, 300);
    expect(touch.read().move).toEqual(before);
    expect(touch.read().strike).toBe(false);
  });

  test('Frapper tap is edge-triggered; joystick dead zone and run threshold', () => {
    const { touch, stick, strike } = setupTouch();
    ptr(strike, 'pointerdown', 5, 500, 300);
    expect(touch.read().strike).toBe(true);
    expect(touch.read().strike).toBe(false);
    ptr(stick, 'pointerdown', 1, 100, 300);
    ptr(window, 'pointermove', 1, 105, 300);
    expect(touch.read().move).toEqual({ x: 0, y: 0 });
    ptr(window, 'pointermove', 1, 100 + 40, 300);
    expect(touch.read().run).toBe(false);
    ptr(window, 'pointermove', 1, 100 + 200, 300);
    const f = touch.read();
    expect(f.run).toBe(true);
    expect(Math.hypot(f.move!.x, f.move!.y)).toBeCloseTo(1, 6);
    ptr(window, 'pointerup', 1, 300, 300);
    expect(touch.read().move).toEqual({ x: 0, y: 0 });
    expect(touch.read().run).toBe(false);
  });

  test('drag-aim from Renvoyer sets aim and throws on release', () => {
    const { touch, rock } = setupTouch();
    ptr(rock, 'pointerdown', 3, 500, 300);
    ptr(window, 'pointermove', 3, 500, 200);
    let f = touch.read();
    expect(f.aim!.y).toBeCloseTo(-1);
    expect(f.throwRock).toBe(false);
    ptr(window, 'pointerup', 3, 500, 200);
    f = touch.read();
    expect(f.throwRock).toBe(true);
    expect(f.aim!.y).toBeCloseTo(-1);
    f = touch.read();
    expect(f.throwRock).toBe(false);
    expect(f.aim).toBeNull();
  });

  test('Agir is held; Pause button calls onPause; touch shows UI', () => {
    const { touch, act, pause, onPause, root } = setupTouch();
    ptr(act, 'pointerdown', 4, 0, 0);
    expect(touch.read().act).toBe(true);
    ptr(window, 'pointerup', 4);
    expect(touch.read().act).toBe(false);
    ptr(pause, 'pointerdown', 6);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(root.classList.contains('visible')).toBe(true);
  });

  test('releaseAll + lifecycle guard pause on blur/hidden/pointercancel', () => {
    const { touch, act } = setupTouch();
    const { kb } = setupKeyboard();
    const pause = vi.fn();
    const off = guardLifecycle(window, [kb, touch], pause);
    ptr(act, 'pointerdown', 4);
    key('keydown', 'KeyD');
    window.dispatchEvent(new Event('blur'));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(touch.read().act).toBe(false);
    expect(kb.read().move).toEqual({ x: 0, y: 0 });
    ptr(window, 'pointercancel', 4);
    expect(pause).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pause).toHaveBeenCalledTimes(3);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    off();
  });
});

describe('touch fixes', () => {
  test('touch pointerdown on canvas shows UI when not coarse', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { root } = setupTouch();
    expect(root.classList.contains('visible')).toBe(false);
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    ptr(canvas, 'pointerdown', 9, 5, 5, 'touch');
    expect(root.classList.contains('visible')).toBe(true);
    vi.unstubAllGlobals();
  });

  test('mouse pointerdown in the stick zone does not start the joystick', () => {
    const { touch, stick } = setupTouch();
    ptr(stick, 'pointerdown', 1, 100, 300, 'mouse');
    ptr(window, 'pointermove', 1, 190, 300, 'mouse');
    expect(touch.read().move).toEqual({ x: 0, y: 0 });
  });

  test('second finger on Renvoyer keeps the first finger drag aim', () => {
    const { touch, rock } = setupTouch();
    ptr(rock, 'pointerdown', 3, 500, 300);
    ptr(window, 'pointermove', 3, 500, 200);
    ptr(rock, 'pointerdown', 4, 510, 310);
    expect(touch.read().aim!.y).toBeCloseTo(-1);
  });

  test('pointercancel never throws', () => {
    const { touch, rock } = setupTouch();
    ptr(rock, 'pointerdown', 3, 500, 300);
    ptr(window, 'pointermove', 3, 500, 200);
    ptr(window, 'pointercancel', 3, 500, 200);
    expect(touch.read().throwRock).toBe(false);
  });
});

describe('merge', () => {
  test('combines move (clamped), ORs booleans, first aim wins', () => {
    const a = { read: () => ({ move: { x: 1, y: 0 }, strike: true }), releaseAll() {} };
    const b = { read: () => ({ move: { x: 1, y: 1 }, aim: { x: 0, y: 1 }, run: true }), releaseAll() {} };
    const f = merge(a, b)();
    expect(Math.hypot(f.move.x, f.move.y)).toBeCloseTo(1, 6);
    expect(f.strike).toBe(true);
    expect(f.run).toBe(true);
    expect(f.throwRock).toBe(false);
    expect(f.aim).toEqual({ x: 0, y: 1 });
  });
});
