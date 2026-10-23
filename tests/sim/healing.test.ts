import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Stations } from '../../src/sim/healing';
import { createPlayer, damagePlayer } from '../../src/sim/player';
import { Rules } from '../../src/sim/rules';

const POS = { x: 100, y: 100 };

function setup(hp = 50) {
  const stations = new Stations([POS, { x: 500, y: 500 }]);
  const player = createPlayer({ x: 110, y: 100 });
  player.hp = hp;
  const rules = new Rules();
  const step = () => stations.step({ player, rules });
  return { stations, player, rules, step };
}

describe('heal stations (walk-over)', () => {
  test('stepping onto a charged station heals +25 at once, capped at 100, once (RC-36)', () => {
    const { stations, player, rules, step } = setup(90);
    expect(step().events).toEqual([{ type: 'HealCompleted' }]);
    expect(player.hp).toBe(100);
    expect(stations.list[0]!.charged).toBe(false);
    expect(rules.stats.healsUsed).toBe(1);
    expect(rules.score).toBe(0);
    // once only: staying on it does nothing more, and it reads 'spent'
    const r = step();
    expect(r.events).toEqual([]);
    expect(r.message).toBe('spent');
    expect(rules.stats.healsUsed).toBe(1);

    const b = setup(40);
    b.step();
    expect(b.player.hp).toBe(40 + CONFIG.heal.amount);
  });

  test('no key press needed: passing by within range is enough', () => {
    const { player, step } = setup(50);
    player.pos = { x: 100 + 27, y: 100 };
    step();
    expect(player.hp).toBe(75);
  });

  test('full health consumes nothing (RC-38)', () => {
    const { stations, player, rules, step } = setup(100);
    for (let i = 0; i < 30; i++) {
      const r = step();
      expect(r.events).toEqual([]);
      expect(r.message).toBe('fullHealth');
    }
    expect(stations.list[0]!.charged).toBe(true);
    expect(player.hp).toBe(100);
    expect(rules.stats.healsUsed).toBe(0);
  });

  test('a KO Paul is not revived by a station (RC-41)', () => {
    const { stations, player, rules, step } = setup(3);
    expect(damagePlayer(player, 5, 10)).toBe(true);
    expect(player.ko).toBe(true);
    expect(step().events).toEqual([]);
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
    expect(stations.list[0]!.charged).toBe(true);
  });
});

describe('station recharge', () => {
  test('recharge restores used stations', () => {
    const { stations, step } = setup(50);
    step();
    expect(stations.list[0]!.charged).toBe(false);
    stations.recharge();
    expect(stations.list.every((s) => s.charged)).toBe(true);
  });
});
