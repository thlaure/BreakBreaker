import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import {
  NEXT_WAVE_AT,
  WAVE_ACTIVE_CAP,
  WAVE_SPAWN_INTERVAL,
  pressure,
  waveSize,
} from '../../src/sim/director';
import { Sim } from '../../src/sim/sim';
import type { InputFrame } from '../../src/sim/types';

const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false };

/** Runs the intro, school and rescue with instant KOs until the first wave starts. */
function toWaves(seed = 3): Sim {
  const sim = new Sim(seed, { invulnerable: true });
  for (let i = 0; i < 60 * 120 && sim.director.phase !== 'waves'; i++) {
    for (const h of sim.horde.active()) sim.horde.applyHit(h.lifeId, 99);
    sim.step(IDLE);
  }
  expect(sim.director.phase).toBe('waves');
  return sim;
}

describe('wave balancing', () => {
  test('waves grow slowly: 5, 7, 9 … capped at 18', () => {
    expect(waveSize(1)).toBe(5);
    expect(waveSize(2)).toBe(7);
    expect(waveSize(3)).toBe(9);
    expect(waveSize(20)).toBe(18);
  });

  test('pressure rises slowly with waves and KOs', () => {
    expect(pressure(0, 0)).toBe(1);
    expect(pressure(1, 29)).toBe(1);
    expect(pressure(2, 0)).toBe(2);
    expect(pressure(3, 30)).toBe(3);
    expect(pressure(50, 500)).toBe(CONFIG.pressureMax);
  });

  test('rioters of a wave enter one by one, never more than the active cap', () => {
    const sim = toWaves();
    sim.rules.kos = 500; // even at max pressure
    let prev = sim.horde.active().length;
    let maxActive = 0;
    for (let i = 0; i < 60 * 60; i++) {
      sim.step(IDLE);
      const n = sim.horde.active().length;
      expect(n - prev).toBeLessThanOrEqual(1); // never a burst
      prev = n;
      maxActive = Math.max(maxActive, n);
    }
    expect(maxActive).toBeLessThanOrEqual(WAVE_ACTIVE_CAP);
    expect(maxActive).toBeGreaterThan(4);
  });

  test('entries are spaced by the spawn interval', () => {
    const sim = toWaves();
    const times: number[] = [];
    let prev = sim.horde.active().length;
    for (let i = 0; i < 60 * 20; i++) {
      sim.step(IDLE);
      const n = sim.horde.active().length;
      if (n > prev) times.push(sim.now);
      prev = n;
    }
    for (let k = 1; k < times.length; k++) expect(times[k]! - times[k - 1]!).toBeGreaterThanOrEqual(WAVE_SPAWN_INTERVAL - 1e-6);
  });

  test('no rest: the next wave follows a cleared wave and its first rioter enters at once', () => {
    const sim = toWaves();
    const first = sim.director.wave;
    // let the whole wave enter, then clear it
    for (let i = 0; i < 60 * 40; i++) sim.step(IDLE);
    for (const h of sim.horde.active()) sim.horde.applyHit(h.lifeId, 99);
    const cleared = sim.now;
    while (sim.horde.active().length === 0 && sim.now < cleared + 30) sim.step(IDLE);
    expect(sim.director.wave).toBe(first + 1);
    expect(sim.now - cleared).toBeLessThanOrEqual(WAVE_SPAWN_INTERVAL + CONFIG.step + 1e-9);
    expect(NEXT_WAVE_AT).toBeLessThanOrEqual(3);
  });

  test('the first fill wave (wave 3) has no rock throwers', () => {
    const sim = toWaves();
    expect(sim.director.wave).toBe(3);
    expect(sim.director.fillWaves).toBe(1);
    for (let i = 0; i < 60 * 15; i++) sim.step(IDLE);
    expect(sim.horde.active().some((h) => h.role === 'thrower')).toBe(false);
  });
});
