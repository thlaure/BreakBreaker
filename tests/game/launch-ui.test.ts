// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CONTROLS, INTRO_ACTIONS, INTRO_GOAL, RULES } from '../../src/content/controls';
import { Hud } from '../../src/game/hud/hud';
import { Menus, type MenuActions } from '../../src/game/hud/menus';

const actions = (): MenuActions => ({
  start: vi.fn(),
  resume: vi.fn(),
  toggleSound: vi.fn(() => false),
  stopGame: vi.fn(),
  leave: vi.fn(),
  replay: vi.fn(),
  click: vi.fn(),
});

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('Commandes modal', () => {
  test('lists every key and the rules, and has a Fermer button', () => {
    const act = actions();
    const menus = new Menus(document.body, act, false);
    menus.showControls();
    expect(menus.open).toBe('controls');
    const text = menus.root.textContent ?? '';
    for (const c of CONTROLS) {
      expect(text).toContain(c.action);
      expect(text).toContain(c.keyboard);
    }
    for (const r of RULES) expect(text).toContain(r);
    const close = [...menus.root.querySelectorAll('button')].find((b) => b.textContent === 'Fermer');
    expect(close).toBeTruthy();
    expect(document.activeElement).toBe(close);
    close!.click();
    expect(act.resume).toHaveBeenCalledTimes(1);
  });

  test('Esc closes the modal straight back into the game', () => {
    const act = actions();
    const menus = new Menus(document.body, act, false);
    menus.showControls();
    menus.root.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    expect(act.resume).toHaveBeenCalledTimes(1);
  });
});

describe('HUD Commandes button', () => {
  test('is a real button that calls the handler', () => {
    const onControls = vi.fn();
    const hud = new Hud(document.body, null, { onControls });
    const btn = hud.root.querySelector<HTMLButtonElement>('.bb-controls-btn');
    expect(btn?.tagName).toBe('BUTTON');
    expect(btn?.textContent).toBe('Commandes');
    btn!.click();
    expect(onControls).toHaveBeenCalledTimes(1);
  });
});

describe('launch card', () => {
  // every Hud keeps its capture listeners on window until destroyed: never leak one into the next test
  const huds: Hud[] = [];
  const mk = (): Hud => {
    const h = new Hud(document.body, null);
    huds.push(h);
    return h;
  };
  afterEach(() => {
    for (const h of huds.splice(0)) h.destroy();
  });

  test('shows the goal and the main keys (keyboard)', () => {
    const hud = mk();
    hud.showIntro(false);
    const card = hud.root.querySelector('.bb-intro')!;
    expect(card.textContent).toContain(INTRO_GOAL);
    for (const name of INTRO_ACTIONS) {
      const row = CONTROLS.find((c) => c.action === name)!;
      expect(card.textContent).toContain(name);
      expect(card.textContent).toContain(row.keyboard);
    }
  });

  test('shows the touch controls on touch devices', () => {
    const hud = mk();
    hud.showIntro(true);
    const row = CONTROLS.find((c) => c.action === 'Frapper')!;
    expect(hud.root.querySelector('.bb-intro')!.textContent).toContain(row.touch);
  });

  test('blocks until a key: no timer, a lone modifier does not count, the key is swallowed, never stacks', () => {
    const hud = mk();
    const onDismiss = vi.fn();
    hud.showIntro(false, onDismiss);
    hud.showIntro(false, onDismiss);
    expect(hud.root.querySelectorAll('.bb-intro')).toHaveLength(1);
    expect(hud.root.querySelector('.bb-intro')!.textContent).toContain('Appuie sur une touche pour commencer');
    vi.advanceTimersByTime(120_000);
    expect(hud.root.querySelector('.bb-intro')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
    const reached = vi.fn();
    window.addEventListener('keydown', reached);
    const ev = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    window.removeEventListener('keydown', reached);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(reached).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);
    expect(hud.root.querySelector('.bb-intro')).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('a tap anywhere starts the game too, and the touch wording is shown', () => {
    const hud = mk();
    const onDismiss = vi.fn();
    hud.showIntro(true, onDismiss);
    expect(hud.root.querySelector('.bb-intro')!.textContent).toContain('Touche l’écran pour commencer');
    window.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(hud.root.querySelector('.bb-intro')).toBeNull();
  });

  test('destroy removes the card and its key listener', () => {
    const hud = mk();
    const onDismiss = vi.fn();
    hud.showIntro(false, onDismiss);
    hud.destroy();
    expect(document.querySelector('.bb-intro')).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
