// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getLocale, initLocale, onLocaleChange, setLocale } from '../../src/content/i18n/locale';
import { createLangSwitch } from '../../src/game/hud/langSwitch';

describe('createLangSwitch (pause menu flags)', () => {
  beforeEach(() => {
    localStorage.clear();
    initLocale('');
  });
  afterEach(() => {
    document.body.replaceChildren();
    setLocale('fr');
  });

  const buttons = (el: HTMLElement) => [...el.querySelectorAll('button')];

  test('two real buttons, French and English, each with a flag and a label', () => {
    const el = createLangSwitch();
    const [fr, en] = buttons(el);
    expect(buttons(el).length).toBe(2);
    expect(fr!.type).toBe('button');
    expect(fr!.dataset.lang).toBe('fr');
    expect(en!.dataset.lang).toBe('en');
    expect(fr!.getAttribute('aria-label')).toMatch(/Français/);
    expect(en!.getAttribute('aria-label')).toMatch(/English/);
    expect(fr!.querySelector('svg')).not.toBeNull();
    expect(en!.querySelector('svg')).not.toBeNull();
    // touch target of at least 44 px
    expect(parseInt(fr!.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(fr!.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  test('the current language is marked aria-current, the other is not', () => {
    const el = createLangSwitch();
    const [fr, en] = buttons(el);
    expect(fr!.getAttribute('aria-current')).toBe('true');
    expect(en!.hasAttribute('aria-current')).toBe(false);
  });

  test('clicking a flag calls setLocale and moves aria-current', () => {
    const el = createLangSwitch();
    document.body.append(el);
    const [fr, en] = buttons(el);
    en!.click();
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(en!.getAttribute('aria-current')).toBe('true');
    expect(fr!.hasAttribute('aria-current')).toBe(false);
    // labels follow the language
    expect(el.getAttribute('aria-label')).toBe('Language');
  });

  test('clicking goes through setLocale (listeners are told, the choice is saved)', () => {
    const seen = vi.fn();
    const off = onLocaleChange(seen);
    const el = createLangSwitch();
    buttons(el)[1]!.click();
    off();
    expect(seen).toHaveBeenCalledWith('en');
    expect(localStorage.getItem('bb:locale')).toBe('en');
  });

  test('a detached switch stops listening (no leak when the pause panel is rebuilt)', () => {
    const el = createLangSwitch();
    document.body.append(el);
    el.remove();
    setLocale('en');
    // still painted for French: it no longer follows changes once removed
    expect(buttons(el)[0]!.getAttribute('aria-current')).toBe('true');
  });
});
