// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { loadPrefs, loadRecord, saveRecord, savePrefs } from '../../src/game/storage';

const KO_KEY = `bb:${CONFIG.rulesVersion}:record`;
const QUIT_KEY = `bb:${CONFIG.rulesVersion}:record-quit`;

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => localStorage.clear());
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
});

describe('storage', () => {
  test('storage throws -> game data falls back, no exception (RC-43)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(loadRecord()).toBeNull();
    expect(() => saveRecord(5, 'ko')).not.toThrow();
    expect(loadPrefs()).toEqual({ muted: false, runToggle: false });
    expect(() => savePrefs({ muted: true, runToggle: true })).not.toThrow();
  });

  test('invalid saved JSON returns defaults', () => {
    localStorage.setItem(KO_KEY, '{nope');
    localStorage.setItem('bb:prefs', '{nope');
    expect(loadRecord()).toBeNull();
    expect(loadPrefs()).toEqual({ muted: false, runToggle: false });
    localStorage.setItem(KO_KEY, '"abc"');
    localStorage.setItem('bb:prefs', '{"muted":"yes","runToggle":3}');
    expect(loadRecord()).toBeNull();
    expect(loadPrefs()).toEqual({ muted: false, runToggle: false });
  });

  test('quit record kept apart from KO record', () => {
    saveRecord(10, 'ko');
    saveRecord(25, 'quit');
    expect(loadRecord('ko')).toBe(10);
    expect(loadRecord('quit')).toBe(25);
    expect(localStorage.getItem(KO_KEY)).toBe('10');
    expect(localStorage.getItem(QUIT_KEY)).toBe('25');
  });

  test('record only improves; prefs round-trip', () => {
    saveRecord(10, 'ko');
    saveRecord(4, 'ko');
    expect(loadRecord()).toBe(10);
    savePrefs({ muted: true, runToggle: false });
    expect(loadPrefs()).toEqual({ muted: true, runToggle: false });
  });
});
