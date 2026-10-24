import { describe, expect, test } from 'vitest';
import { offLayers } from '../../src/game/perfSwitches';

describe('?off= layer switches', () => {
  test('lists the layers the page asked to switch off, ignoring unknown names and blanks', () => {
    expect(offLayers('?perf&off=hud,graphics')).toEqual(['hud', 'graphics']);
    expect(offLayers('?off=particles, texts ,nonsense,,hud')).toEqual(['particles', 'texts', 'hud']);
  });

  test('nothing is switched off by default, or without ?perf-style diagnostics', () => {
    expect(offLayers('')).toEqual([]);
    expect(offLayers('?perf')).toEqual([]);
    expect(offLayers('?off=')).toEqual([]);
  });

  test('a layer named twice is listed once', () => {
    expect(offLayers('?off=hud,hud')).toEqual(['hud']);
  });
});
