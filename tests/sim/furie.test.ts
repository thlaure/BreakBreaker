import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer } from '../../src/sim/player';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, SimEvent, Vec } from '../../src/sim/types';
import { WEAPONS, Weapons } from '../../src/sim/weapons';
import { autopilot } from './autopilot';

const grid = new Grid(DISTRICT);
const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: false };
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const STEPS = (sec: number): number => Math.round(sec / CONFIG.step);
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);

/** Fills the energy gauge and presses Furie (R): the mode is on. */
function pickFurie(sim: Sim): SimEvent[] {
  sim.energy.value = CONFIG.energy.max;
  return sim.step(input({ furie: true }));
}

describe('mode furie from the energy gauge', () => {
  test('Furie with a full gauge activates the mode for 12 s and keeps the held weapon', () => {
    const sim = new Sim(5);
    sim.weapons.held = { kind: 'baton', uses: 7 };
    const ev = pickFurie(sim);
    expect(ev).toContainEqual({ type: 'FurieStarted', secondsLeft: CONFIG.furie.durationSec });
    expect(of(ev, 'WeaponPickedUp')).toEqual([]);
    expect(sim.weapons.held).toEqual({ kind: 'baton', uses: 7 });
    const s = sim.snapshot();
    expect(s.furie!.secondsLeft).toBeCloseTo(CONFIG.furie.durationSec - CONFIG.step, 6);
    expect(s.weapon).toEqual({ kind: 'baton', uses: 7 });
  });

  test('the timer runs out after 12 s (FurieEnded)', () => {
    const sim = new Sim(5);
    const all: SimEvent[] = [...pickFurie(sim)];
    for (let i = 0; i < STEPS(6); i++) all.push(...sim.step(IDLE));
    expect(sim.snapshot().furie!.secondsLeft).toBeCloseTo(CONFIG.furie.durationSec - 6 - CONFIG.step, 3);
    for (let i = 0; i < STEPS(CONFIG.furie.durationSec - 6) - 3; i++) all.push(...sim.step(IDLE));
    expect(sim.snapshot().furie).not.toBeNull();
    expect(of(all, 'FurieEnded')).toEqual([]);
    for (let i = 0; i < 3; i++) all.push(...sim.step(IDLE));
    expect(sim.snapshot().furie).toBeNull();
    expect(of(all, 'FurieEnded')).toHaveLength(1);
  });

  test('pause freezes the timer', () => {
    const sim = new Sim(5);
    pickFurie(sim);
    const left = sim.snapshot().furie!.secondsLeft;
    sim.pause();
    for (let i = 0; i < STEPS(20); i++) expect(sim.step(IDLE)).toEqual([]);
    expect(sim.snapshot().furie!.secondsLeft).toBe(left);
    sim.resume();
    sim.step(IDLE);
    expect(sim.snapshot().furie!.secondsLeft).toBeLessThan(left);
  });

  test('a KO ends the mode at once (FurieEnded before PlayerKnockedOut)', () => {
    const sim = new Sim(5);
    pickFurie(sim);
    sim.player.hp = 1;
    const p = sim.player.pos;
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 14, y: p.y } })!;
    h.state = 'windup';
    h.stateUntil = 0;
    h.nextAttackAt = 99;
    const ev = sim.step(IDLE);
    const types = ev.map((e) => e.type);
    expect(types).toContain('FurieEnded');
    expect(types.indexOf('FurieEnded')).toBeLessThan(types.indexOf('PlayerKnockedOut'));
    expect(sim.snapshot().furie).toBeNull();
  });

  test('Rejouer (a new session) starts without furie', () => {
    const sim = new Sim(5);
    pickFurie(sim);
    expect(sim.snapshot().furie).not.toBeNull();
    expect(new Sim(5).snapshot().furie).toBeNull();
  });
});

describe('mode furie effects', () => {
  test('Paul moves ×1.35 faster, walking and running', () => {
    for (const run of [false, true]) {
      const a = new Sim(5);
      const b = new Sim(5);
      pickFurie(b);
      a.player.pos = { ...b.player.pos };
      const from = { ...a.player.pos };
      a.step(input({ move: { x: 1, y: 0 }, run }));
      b.step(input({ move: { x: 1, y: 0 }, run }));
      const base = (run ? CONFIG.player.run : CONFIG.player.walk) * CONFIG.step;
      expect(a.player.pos.x - from.x).toBeCloseTo(base, 6);
      expect(b.player.pos.x - from.x).toBeCloseTo(base * CONFIG.furie.speedMul, 6);
    }
  });

  test('reach ×1.5 bare-handed and with a weapon', () => {
    const w = new Weapons(grid, rng(1));
    expect(w.range()).toBe(CONFIG.melee.range);
    w.furieLeft = 5;
    expect(w.range()).toBeCloseTo(CONFIG.melee.range * CONFIG.furie.reachMul, 6);
    w.held = { kind: 'panneau', uses: 3 };
    expect(w.range()).toBeCloseTo(WEAPONS.panneau.range * CONFIG.furie.reachMul, 6);
  });

  test('bare hands: one strike KOs up to 8 rioters at the longer reach, without a weapon', () => {
    const sim = new Sim(5);
    pickFurie(sim);
    const p = sim.player.pos;
    const reach = CONFIG.melee.range * CONFIG.furie.reachMul - 4;
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach } });
      if (h) {
        h.nextAttackAt = 99;
        ids.push(h.lifeId);
      }
    }
    const reachable = sim.horde.views().filter((v) => grid.lineClear(p, v.pos)).length;
    const ev = sim.step(input({ strike: true }));
    const kos = of(ev, 'ActorKnockedOut');
    expect(kos).toHaveLength(Math.min(CONFIG.furie.maxTargets, reachable));
    expect(kos.length).toBeGreaterThan(CONFIG.melee.maxTargets);
    for (const e of of(ev, 'HitConfirmed')) expect(e.damage).toBe(CONFIG.furie.damage);
    expect(sim.rules.kos).toBe(kos.length);
    expect(sim.rules.score).toBe(kos.length);
  });

  test('a strike in furie does not use the weapon', () => {
    const sim = new Sim(5);
    sim.weapons.held = { kind: 'marteau', uses: 1 };
    pickFurie(sim);
    const p = sim.player.pos;
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 30, y: p.y } })!;
    h.nextAttackAt = 99;
    const ev = sim.step(input({ strike: true }));
    expect(h.state).toBe('ko');
    expect(of(ev, 'WeaponBroken')).toEqual([]);
    expect(sim.weapons.held).toEqual({ kind: 'marteau', uses: 1 });
  });

  test('incoming damage is halved', () => {
    const blow = (furie: boolean) => {
      const sim = new Sim(9);
      if (furie) pickFurie(sim);
      const p = sim.player.pos;
      const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 14, y: p.y } })!;
      h.state = 'windup';
      h.stateUntil = 0;
      h.nextAttackAt = 99;
      const ev = sim.step(IDLE);
      return { dmg: of(ev, 'PlayerDamaged'), hp: sim.player.hp };
    };
    const off = blow(false);
    const on = blow(true);
    expect(off.dmg).toHaveLength(1);
    expect(on.dmg).toEqual([{ type: 'PlayerDamaged', amount: off.dmg[0]!.amount * CONFIG.furie.damageTakenMul }]);
    expect(CONFIG.player.maxHp - on.hp).toBeCloseTo((CONFIG.player.maxHp - off.hp) * CONFIG.furie.damageTakenMul, 6);
  });
});

describe('mode furie launches', () => {
  const brawl = (seed: number, furie: boolean) => {
    const sim = new Sim(seed);
    if (furie) pickFurie(sim);
    else sim.weapons.held = { kind: 'baton', uses: 15 };
    const p = sim.player.pos;
    const spots: Vec[] = [
      { x: p.x + 40, y: p.y },
      { x: p.x - 40, y: p.y },
      { x: p.x, y: p.y + 40 },
    ];
    for (const at of spots) sim.horde.spawn({ variant: 'classic', role: 'contact', pos: at })!.nextAttackAt = 99;
    const ev = sim.step(input({ strike: true }));
    return { sim, kos: of(ev, 'ActorKnockedOut') };
  };

  test('every KO by Paul’s strike in furie carries a launch away from Paul, in range', () => {
    const { sim, kos } = brawl(5, true);
    expect(kos).toHaveLength(3);
    for (const k of kos) {
      const l = k.launch!;
      expect(l).toBeDefined();
      expect(Math.hypot(l.dir.x, l.dir.y)).toBeCloseTo(1, 6);
      expect(l.power).toBeGreaterThanOrEqual(CONFIG.furie.launchPower[0]);
      expect(l.power).toBeLessThanOrEqual(CONFIG.furie.launchPower[1]);
      expect(Math.abs(l.spin)).toBeGreaterThanOrEqual(CONFIG.furie.launchSpin[0]);
      expect(Math.abs(l.spin)).toBeLessThanOrEqual(CONFIG.furie.launchSpin[1]);
      const h = sim.horde.list.find((x) => x.lifeId === k.lifeId)!;
      const away = { x: h.pos.x - sim.player.pos.x, y: h.pos.y - sim.player.pos.y };
      const cos = (away.x * l.dir.x + away.y * l.dir.y) / Math.hypot(away.x, away.y);
      expect(cos).toBeGreaterThan(Math.cos(CONFIG.furie.launchJitter) - 1e-6);
    }
  });

  test('deterministic (same seed → same launch); no launch outside furie; same KO count and score', () => {
    const a = brawl(5, true);
    const b = brawl(5, true);
    expect(a.kos).toEqual(b.kos);
    const c = brawl(6, true);
    expect(c.kos.map((k) => k.launch)).not.toEqual(a.kos.map((k) => k.launch));
    const plain = brawl(5, false);
    expect(plain.kos).toHaveLength(3);
    for (const k of plain.kos) expect(k.launch).toBeUndefined();
    expect(a.sim.rules.kos).toBe(plain.sim.rules.kos);
    expect(a.sim.rules.score).toBe(plain.sim.rules.score);
  });

  test('the launch stream does not shift the other random sequences', () => {
    const a = brawl(5, true).sim;
    const b = brawl(5, true).sim;
    b.step(IDLE);
    a.step(IDLE);
    expect(a.rand()).toBe(b.rand());
    const plain = new Sim(5);
    const fur = new Sim(5);
    pickFurie(fur);
    plain.step(IDLE);
    expect(fur.rand()).toBe(plain.rand());
  });
});

describe('no furie or onde pickup ever appears', () => {
  test('timed street spawns: only regular weapons and the bouclier, whatever the round', () => {
    const kinds = new Set<string>();
    for (const round of [1, 4, 6, 9, 12])
      for (let seed = 1; seed <= 30; seed++) {
        const w = new Weapons(grid, rng(seed));
        const paul = createPlayer({ ...DISTRICT.playerSpawn });
        for (let t = 0; t < 300; t += 1) {
          for (const e of w.step(1, t, paul, round)) if (e.type === 'WeaponSpawned') kinds.add(e.kind);
          w.ground.length = 0;
        }
      }
    expect([...kinds].sort()).toEqual([...Object.keys(WEAPONS), 'bouclier'].sort());
  });

  test('in sessions over several seeds and rounds: every pickup is a regular weapon or the bouclier; twists only announce the bouclier', () => {
    const allowed = new Set<string>([...Object.keys(WEAPONS), 'bouclier']);
    for (const seed of [3, 8, 21]) {
      const sim = new Sim(seed, { invulnerable: true });
      for (let i = 0; i < 60 * 1500 && sim.director.round <= 7; i++) {
        const ev = sim.step(autopilot(sim));
        for (const s of of(ev, 'WeaponSpawned')) expect(allowed.has(s.kind), s.kind).toBe(true);
        for (const t of of(ev, 'TwistStarted')) if (t.special !== undefined) expect(t.special).toBe('bouclier');
        for (const g of sim.weapons.ground) expect(allowed.has(g.kind)).toBe(true);
        expect(of(ev, 'FurieStarted')).toEqual([]);
      }
    }
  });
});
