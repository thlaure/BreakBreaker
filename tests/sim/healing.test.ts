import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Stations } from '../../src/sim/healing';
import { createPlayer, damagePlayer } from '../../src/sim/player';
import { Rules } from '../../src/sim/rules';

const POS = { x: 100, y: 100 };
const DT = 0.1;

function setup(hp = 50) {
  const stations = new Stations([POS, { x: 500, y: 500 }]);
  const player = createPlayer({ x: 110, y: 100 });
  player.hp = hp;
  const rules = new Rules();
  const step = (o: Partial<{ actHeld: boolean; moved: boolean; damagedThisStep: boolean }> = {}, dt = DT) =>
    stations.step(dt, { player, actHeld: true, moved: false, damagedThisStep: false, rules, ...o });
  return { stations, player, rules, step };
}

describe('heal stations', () => {
  test('charged station heals +25 capped at 100, once (RC-36)', () => {
    const { stations, player, rules, step } = setup(90);
    let events: unknown[] = [];
    for (let i = 0; i < 14; i++) expect(step().events).toEqual([]);
    events = step().events;
    expect(events).toEqual([{ type: 'HealCompleted' }]);
    expect(player.hp).toBe(100);
    expect(stations.list[0]!.charged).toBe(false);
    expect(rules.stats.healsUsed).toBe(1);
    expect(rules.score).toBe(0);
    // once only: hold again, nothing more, and message is Épuisé
    const r = step();
    expect(r.events).toEqual([]);
    expect(r.message).toBe('Épuisé');
    expect(rules.stats.healsUsed).toBe(1);

    const b = setup(40);
    for (let i = 0; i < 15; i++) b.step();
    expect(b.player.hp).toBe(40 + CONFIG.heal.amount);
  });

  test('interrupted heal gives nothing and keeps charge (RC-37)', () => {
    for (const interrupt of [{ moved: true }, { damagedThisStep: true }, { actHeld: false }]) {
      const { stations, player, rules, step } = setup(50);
      for (let i = 0; i < 10; i++) step();
      expect(stations.list[0]!.progress).toBeGreaterThan(0);
      const r = step(interrupt);
      expect(r.events).toEqual([{ type: 'HealInterrupted' }]);
      expect(stations.list[0]!.progress).toBe(0);
      expect(stations.list[0]!.charged).toBe(true);
      expect(player.hp).toBe(50);
      expect(rules.stats.healsUsed).toBe(0);
      // releasing again with no progress emits nothing
      expect(step(interrupt).events).toEqual([]);
    }
  });

  test('full health consumes nothing (RC-38)', () => {
    const { stations, player, rules, step } = setup(100);
    for (let i = 0; i < 30; i++) {
      const r = step();
      expect(r.events).toEqual([]);
      expect(r.message).toBe('Santé au maximum');
    }
    expect(stations.list[0]!.charged).toBe(true);
    expect(stations.list[0]!.progress).toBe(0);
    expect(player.hp).toBe(100);
    expect(rules.stats.healsUsed).toBe(0);
  });

  test('heal completing on the KO step does not revive (RC-41)', () => {
    const { stations, player, rules, step } = setup(3);
    for (let i = 0; i < 14; i++) step();
    expect(stations.list[0]!.progress).toBeCloseTo(1.4);
    expect(damagePlayer(player, 5, 10)).toBe(true);
    expect(player.ko).toBe(true);
    const r = step({ damagedThisStep: true });
    expect(r.events).toEqual([]);
    expect(player.hp).toBe(0);
    expect(stations.list[0]!.charged).toBe(true);
    expect(rules.stats.healsUsed).toBe(0);
  });

  test('out of range does nothing; ended rules do nothing', () => {
    const { stations, player, rules, step } = setup(50);
    player.pos = { x: 300, y: 300 };
    expect(step()).toEqual({ events: [], message: null });
    player.pos = { x: 110, y: 100 };
    rules.end('quit');
    expect(step()).toEqual({ events: [], message: null });
    expect(stations.list[0]!.progress).toBe(0);
  });
});
