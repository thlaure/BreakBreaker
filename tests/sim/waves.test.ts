import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { NEXT_WAVE_AT, WAVE_SPAWN_INTERVAL, waveSize } from '../../src/sim/director';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, SimEvent, Vec } from '../../src/sim/types';

const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false };
const SCHOOL_TOTAL = CONFIG.school.firstLine + CONFIG.school.reinforcements;

/** KO every active rioter through the sim's scoring path. */
function koAll(sim: Sim): void {
  for (const h of sim.horde.active()) if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId);
}

describe('wave numbering and objectives', () => {
  test('wave is 1 from the very start; objective is 0 during the intro', () => {
    const sim = new Sim(3, { invulnerable: true });
    let s = sim.snapshot();
    expect(s.wave).toBe(1);
    expect(s.waveTotal).toBe(0);
    expect(s.waveKos).toBe(0);
    for (let i = 0; i < 60; i++) sim.step(IDLE);
    s = sim.snapshot();
    expect(s.phase).toBe('intro');
    expect(s.wave).toBe(1);
    expect(s.waveTotal).toBe(0);
  });

  test('school = wave 1 (11), rescue = wave 2 (its aggressors), then fill waves 3, 4 … with waveSize totals', () => {
    const sim = new Sim(7, { invulnerable: true });
    const events: SimEvent[] = [];
    const seen: { phase: string; wave: number; total: number }[] = [];
    for (let i = 0; i < 60 * 240 && sim.director.wave < 5; i++) {
      koAll(sim);
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      events.push(...sim.step(IDLE));
      const s = sim.snapshot();
      expect(s.wave).toBeGreaterThanOrEqual(1);
      const last = seen[seen.length - 1];
      if (!last || last.wave !== s.wave || last.phase !== s.phase) seen.push({ phase: s.phase, wave: s.wave, total: s.waveTotal });
      expect(s.waveKos).toBeGreaterThanOrEqual(0);
      expect(s.waveKos).toBeLessThanOrEqual(s.waveTotal);
    }
    const school = events.filter((e) => e.type === 'SchoolStarted');
    expect(school).toHaveLength(1);
    expect(school[0]).toMatchObject({ wave: 1, total: SCHOOL_TOTAL });
    const rescue = events.filter((e) => e.type === 'RescueStarted');
    expect(rescue).toHaveLength(1);
    expect(rescue[0]).toMatchObject({ wave: 2, total: sim.rescue!.total });
    expect(sim.rescue!.total).toBeGreaterThanOrEqual(CONFIG.rescue.aggressors[0]);
    const waves = events.filter((e): e is Extract<SimEvent, { type: 'WaveAnnounced' }> => e.type === 'WaveAnnounced');
    expect(waves.map((e) => e.index)).toEqual([3, 4, 5]);
    expect(waves.map((e) => e.total)).toEqual([waveSize(1), waveSize(2), waveSize(3)]);
    expect(seen.find((x) => x.phase === 'school')).toMatchObject({ wave: 1, total: SCHOOL_TOTAL });
    expect(seen.find((x) => x.phase === 'rescue')).toMatchObject({ wave: 2, total: sim.rescue!.total });
    expect(seen.find((x) => x.wave === 3)).toMatchObject({ phase: 'waves', total: waveSize(1) });
    // the fill-wave counter drives pressure exactly as before (wave 3 = first fill wave)
    expect(sim.director.fillWaves).toBe(3);
  });

  test('waveKos counts KOs since the wave started, clamped to the total', () => {
    const sim = new Sim(11, { invulnerable: true });
    while (sim.director.phase === 'intro') sim.step(IDLE);
    expect(sim.snapshot()).toMatchObject({ wave: 1, waveTotal: SCHOOL_TOTAL, waveKos: 0 });
    const first = sim.horde.active()[0]!;
    sim.horde.applyHit(first.lifeId, 99);
    sim.rules.onKnockout(first.lifeId);
    expect(sim.snapshot().waveKos).toBe(1);
    sim.rules.kos += 50; // e.g. extra KOs (patrols) never push K above T
    expect(sim.snapshot().waveKos).toBe(SCHOOL_TOTAL);
  });

  test('a new wave starts its KO counter at 0', () => {
    const sim = new Sim(5, { invulnerable: true });
    for (let i = 0; i < 60 * 240 && sim.director.wave < 3; i++) {
      koAll(sim);
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      sim.step(IDLE);
    }
    expect(sim.snapshot()).toMatchObject({ wave: 3, waveTotal: waveSize(1), waveKos: 0 });
  });
});

describe('steady flow (no holes)', () => {
  test('the next wave starts as soon as the queue is empty and <= NEXT_WAVE_AT rioters remain; first rioter enters at once', () => {
    const sim = new Sim(3, { invulnerable: true });
    for (let i = 0; i < 60 * 240 && sim.director.phase !== 'waves'; i++) {
      koAll(sim);
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      sim.step(IDLE);
    }
    const first = sim.director.wave;
    // let the whole wave enter (idle Paul), then clear it
    for (let i = 0; i < 60 * 40 && sim.director.wave === first; i++) sim.step(IDLE);
    expect(sim.director.wave).toBe(first); // > NEXT_WAVE_AT still active → no new wave yet
    koAll(sim);
    const cleared = sim.now;
    while (sim.horde.active().length === 0 && sim.now < cleared + 10) sim.step(IDLE);
    expect(sim.director.wave).toBe(first + 1);
    expect(sim.now - cleared).toBeLessThanOrEqual(WAVE_SPAWN_INTERVAL + CONFIG.step + 1e-9);
    expect(NEXT_WAVE_AT).toBe(3);
  });

  test('a 5-minute bot run never goes more than 3 s without an active rioter after the intro', () => {
    const sim = new Sim(9, { invulnerable: true });
    let empty = 0;
    let worst = 0;
    const toward = (a: Vec, b: Vec): Vec => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    };
    for (let i = 0; i < 60 * 300; i++) {
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      const act = sim.horde.active();
      let target: Vec | null = null;
      let best = Infinity;
      for (const h of act) {
        const d = Math.hypot(h.pos.x - sim.player.pos.x, h.pos.y - sim.player.pos.y);
        if (d < best) {
          best = d;
          target = h.pos;
        }
      }
      const move = target && best > 20 ? toward(sim.player.pos, target) : { x: 0, y: 0 };
      const before = sim.now;
      sim.step({ ...IDLE, move, aim: target ? toward(sim.player.pos, target) : null, run: true, strike: i % 10 === 0 });
      if (sim.director.phase === 'intro') continue;
      if (sim.horde.active().length === 0) empty += sim.now - before;
      else empty = 0;
      worst = Math.max(worst, empty);
    }
    expect(sim.rules.kos).toBeGreaterThan(10);
    expect(sim.director.wave).toBeGreaterThanOrEqual(2);
    expect(worst).toBeLessThanOrEqual(3);
  });
});
