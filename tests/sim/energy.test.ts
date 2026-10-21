import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Energy, energyGain } from '../../src/sim/energy';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, Role, SimEvent, Vec } from '../../src/sim/types';
import { heldOf } from '../../src/sim/weapons';
import { autopilot, IDLE } from './autopilot';

const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const STEPS = (sec: number): number => Math.round(sec / CONFIG.step);
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const E = CONFIG.energy;

/** A rioter of `role` that stays put and never attacks during the test. */
function calm(sim: Sim, pos: Vec, role: Role = 'contact') {
  const h = sim.horde.spawn({ variant: 'classic', role, pos })!;
  h.nextAttackAt = 1e9;
  return h;
}

/** One strike at a rioter of `role` 30 px to Paul's right with a one-hit weapon (the bouclier bash). */
function bashKo(sim: Sim, role: Role = 'contact'): SimEvent[] {
  // past the melee cooldown of an earlier strike
  for (let i = 0; i < STEPS(CONFIG.melee.cooldown) + 1; i++) sim.step(IDLE);
  sim.weapons.held = heldOf('bouclier');
  const p = sim.player.pos;
  const h = calm(sim, { x: p.x + 30, y: p.y }, role);
  const ev = sim.step(input({ strike: true }));
  expect(h.state).toBe('ko');
  sim.weapons.held = null;
  return ev;
}

/** Charges the onde from a standing start (C pressed then held) until it fires or `sec` s pass. */
function charge(sim: Sim, sec: number): SimEvent[] {
  const all: SimEvent[] = [];
  all.push(...sim.step(input({ chargeHeld: true })));
  for (let i = 0; i < STEPS(sec); i++) all.push(...sim.step(input({ chargeHeld: true })));
  return all;
}

describe('energy gauge: filling', () => {
  test('gain per role: +4 a rioter, +8 a brute, +20 Le Caïd', () => {
    expect(energyGain('contact')).toBe(4);
    expect(energyGain('runner')).toBe(4);
    expect(energyGain('thrower')).toBe(4);
    expect(energyGain('brute')).toBe(8);
    expect(energyGain('boss')).toBe(20);
  });

  test('a new session starts empty; the snapshot shows the gauge and its ready flags', () => {
    const s = new Sim(5).snapshot();
    expect(s.energy).toEqual({ value: 0, max: 100, ready: { onde: false, furie: false } });
  });

  test('a melee KO fills +4; a brute +8; Le Caïd +20 (with a weapon hit counted once)', () => {
    const sim = new Sim(5);
    bashKo(sim);
    expect(sim.energy.value).toBe(4);
    bashKo(sim, 'brute');
    expect(sim.energy.value).toBe(12);
    bashKo(sim, 'boss');
    expect(sim.energy.value).toBe(32);
    expect(sim.snapshot().energy.value).toBe(32);
  });

  test('a bare-handed KO and a returned rock KO fill it too', () => {
    const sim = new Sim(5);
    const p = sim.player.pos;
    const h = calm(sim, { x: p.x + 30, y: p.y });
    h.hp = 1;
    sim.step(input({ strike: true }));
    expect(h.state).toBe('ko');
    expect(sim.energy.value).toBe(4);

    const rock = new Sim(5);
    const q = rock.player.pos;
    const r = calm(rock, { x: q.x + 80, y: q.y });
    r.hp = 1;
    rock.rocks.carried = 1;
    rock.step(input({ throwRock: true, aim: { x: 1, y: 0 } }));
    for (let i = 0; i < 30; i++) rock.step(IDLE);
    expect(r.state).toBe('ko');
    expect(rock.energy.value).toBe(4);
  });

  test('a melee hit that does not KO gives nothing', () => {
    const sim = new Sim(5);
    const p = sim.player.pos;
    const h = calm(sim, { x: p.x + 30, y: p.y });
    h.hp = 3;
    sim.step(input({ strike: true }));
    expect(h.state).not.toBe('ko');
    expect(sim.energy.value).toBe(0);
  });

  test('no gain while the mode furie is on', () => {
    const sim = new Sim(5);
    sim.weapons.furieLeft = 5;
    const p = sim.player.pos;
    calm(sim, { x: p.x + 30, y: p.y });
    calm(sim, { x: p.x - 30, y: p.y });
    expect(of(sim.step(input({ strike: true })), 'ActorKnockedOut')).toHaveLength(2);
    expect(sim.energy.value).toBe(0);
  });

  test('capped at 100', () => {
    const sim = new Sim(5);
    sim.energy.value = 98;
    bashKo(sim, 'boss');
    expect(sim.energy.value).toBe(100);
  });

  test('EnergyReady once per threshold crossing: onde at 50, furie at 100', () => {
    const sim = new Sim(5);
    sim.energy.value = 44;
    expect(of(bashKo(sim), 'EnergyReady')).toEqual([]);
    expect(sim.energy.value).toBe(48);
    expect(of(bashKo(sim), 'EnergyReady')).toEqual([{ type: 'EnergyReady', level: 'onde' }]);
    expect(sim.snapshot().energy.ready).toEqual({ onde: true, furie: false });
    expect(of(bashKo(sim), 'EnergyReady')).toEqual([]);
    sim.energy.value = 96;
    expect(of(bashKo(sim), 'EnergyReady')).toEqual([{ type: 'EnergyReady', level: 'furie' }]);
    expect(sim.snapshot().energy.ready).toEqual({ onde: true, furie: true });
    // already full: nothing more
    expect(of(bashKo(sim), 'EnergyReady')).toEqual([]);
    // a Caïd KO from 40 crosses 50 once; from 90 it fills the gauge (capped) and announces the furie only
    const e = new Energy();
    e.value = 40;
    expect(e.gain('boss')).toEqual([{ type: 'EnergyReady', level: 'onde' }]);
    e.value = 90;
    expect(e.gain('boss')).toEqual([{ type: 'EnergyReady', level: 'furie' }]);
    expect(e.value).toBe(100);
  });

  test('re-armed after spending under the threshold', () => {
    const e = new Energy();
    e.value = 48;
    expect(e.gain('contact')).toHaveLength(1);
    expect(e.spend(CONFIG.energy.ondeCost)).toBe(true);
    expect(e.value).toBe(2);
    e.value = 48;
    expect(e.gain('contact')).toEqual([{ type: 'EnergyReady', level: 'onde' }]);
    expect(e.spend(80)).toBe(false);
    expect(e.value).toBe(52);
  });

  test('kept across rounds; a new session (Rejouer) starts at 0', () => {
    const sim = new Sim(3, { invulnerable: true });
    sim.energy.value = 37;
    let rounds = 0;
    for (let i = 0; i < 60 * 600 && sim.director.round < 3; i++) {
      const ev = sim.step(autopilot(sim));
      if (ev.some((e) => e.type === 'RoundStarted')) rounds++;
    }
    expect(sim.director.round).toBe(3);
    expect(rounds).toBeGreaterThanOrEqual(2);
    // the autopilot's KOs bypass the strike: the gauge only keeps what it had
    expect(sim.energy.value).toBe(37);
    expect(new Sim(3).energy.value).toBe(0);
  });

  test('no passive decay', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.energy.value = 60;
    for (let i = 0; i < STEPS(30); i++) sim.step(IDLE);
    expect(sim.energy.value).toBe(60);
  });
});

describe('energy gauge: Furie (R)', () => {
  test('a full gauge: R spends all of it and starts the mode furie', () => {
    const sim = new Sim(5);
    sim.energy.value = 100;
    sim.weapons.held = { kind: 'baton', uses: 7 };
    const ev = sim.step(input({ furie: true }));
    expect(of(ev, 'FurieStarted')).toEqual([{ type: 'FurieStarted', secondsLeft: CONFIG.furie.durationSec }]);
    expect(sim.energy.value).toBe(0);
    expect(sim.snapshot().furie!.secondsLeft).toBeCloseTo(CONFIG.furie.durationSec - CONFIG.step, 6);
    expect(sim.snapshot().energy.ready).toEqual({ onde: false, furie: false });
    expect(sim.weapons.held).toEqual({ kind: 'baton', uses: 7 });
  });

  test('less than full: refused (EnergyRefused need 100), nothing spent, no furie', () => {
    const sim = new Sim(5);
    sim.energy.value = 96;
    const ev = sim.step(input({ furie: true }));
    expect(of(ev, 'EnergyRefused')).toEqual([{ type: 'EnergyRefused', need: 100 }]);
    expect(of(ev, 'FurieStarted')).toEqual([]);
    expect(sim.energy.value).toBe(96);
    expect(sim.snapshot().furie).toBeNull();
  });

  test('ignored while the mode furie is on, while paused and when Paul is KO', () => {
    const on = new Sim(5);
    on.energy.value = 100;
    on.step(input({ furie: true }));
    on.energy.value = 100;
    const again = on.step(input({ furie: true }));
    expect(of(again, 'FurieStarted')).toEqual([]);
    expect(of(again, 'EnergyRefused')).toEqual([]);
    expect(on.energy.value).toBe(100);

    const paused = new Sim(5);
    paused.energy.value = 100;
    paused.pause();
    expect(paused.step(input({ furie: true }))).toEqual([]);
    expect(paused.energy.value).toBe(100);

    const ko = new Sim(5);
    ko.energy.value = 100;
    ko.player.ko = true;
    ko.player.hp = 0;
    expect(of(ko.step(input({ furie: true })), 'FurieStarted')).toEqual([]);
    expect(ko.energy.value).toBe(100);
  });

  test('starting the furie cancels a charge under way at no onde cost', () => {
    const sim = new Sim(5);
    sim.energy.value = 100;
    sim.step(input({ chargeHeld: true }));
    expect(sim.snapshot().charge).not.toBeNull();
    const ev = sim.step(input({ chargeHeld: true, furie: true }));
    expect(of(ev, 'BeamCancelled')).toHaveLength(1);
    expect(of(ev, 'FurieStarted')).toHaveLength(1);
    expect(sim.snapshot().charge).toBeNull();
    expect(sim.energy.value).toBe(0);
  });

  test('the gauge does not fill during the mode, and fills again once it is over', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.energy.value = 100;
    sim.step(input({ furie: true }));
    bashKo(sim);
    expect(sim.energy.value).toBe(0);
    for (let i = 0; i < STEPS(CONFIG.furie.durationSec) + 2; i++) sim.step(IDLE);
    expect(sim.snapshot().furie).toBeNull();
    bashKo(sim);
    expect(sim.energy.value).toBe(4);
  });
});

describe('energy gauge: Onde (C held)', () => {
  test('below 50: refused (EnergyRefused need 50), no charge; a strike still swings', () => {
    const sim = new Sim(5);
    sim.energy.value = 48;
    const p = sim.player.pos;
    const h = calm(sim, { x: p.x + 30, y: p.y });
    h.hp = 1;
    const ev = sim.step(input({ chargeHeld: true, strike: true }));
    expect(of(ev, 'EnergyRefused')).toEqual([{ type: 'EnergyRefused', need: 50 }]);
    expect(of(ev, 'BeamCharging')).toEqual([]);
    expect(sim.snapshot().charge).toBeNull();
    expect(h.state).toBe('ko');
    // held on: refused only once (rising edge)
    expect(of(sim.step(input({ chargeHeld: true })), 'EnergyRefused')).toEqual([]);
  });

  test('released before 1 s: cancelled, nothing spent', () => {
    const sim = new Sim(5);
    sim.energy.value = 60;
    const all = charge(sim, 0.9);
    all.push(...sim.step(IDLE));
    expect(of(all, 'BeamCharging')).toHaveLength(1);
    expect(of(all, 'BeamCancelled')).toHaveLength(1);
    expect(of(all, 'BeamFired')).toEqual([]);
    expect(sim.energy.value).toBe(60);
  });

  test('fires at 1 s and spends 50; its own KOs give no energy', () => {
    const sim = new Sim(5);
    sim.energy.value = 70;
    sim.player.facing = { x: 1, y: 0 };
    const p = { ...sim.player.pos };
    const all: SimEvent[] = [];
    all.push(...sim.step(input({ chargeHeld: true })));
    for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec) - 1; i++) all.push(...sim.step(input({ chargeHeld: true })));
    expect(sim.energy.value).toBe(70);
    const line = [60, 120].map((dx) => calm(sim, { x: p.x + dx, y: p.y }));
    all.push(...sim.step(input({ chargeHeld: true })));
    expect(of(all, 'BeamFired')).toHaveLength(1);
    for (const h of line) expect(h.state).toBe('ko');
    expect(sim.rules.kos).toBe(2);
    expect(sim.energy.value).toBe(20);
    expect(of(all, 'EnergyReady')).toEqual([]);
  });

  test('two beams from a full gauge, then refused', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.energy.value = 100;
    const all: SimEvent[] = [];
    for (let k = 0; k < 3; k++) {
      all.push(...charge(sim, CONFIG.kamehame.chargeSec));
      all.push(...sim.step(IDLE));
    }
    expect(of(all, 'BeamFired')).toHaveLength(2);
    expect(of(all, 'EnergyRefused')).toEqual([{ type: 'EnergyRefused', need: 50 }]);
    expect(sim.energy.value).toBe(0);
  });

  test('works while the mode furie is on', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.weapons.furieLeft = 10;
    sim.energy.value = 50;
    const all = charge(sim, CONFIG.kamehame.chargeSec);
    expect(of(all, 'BeamFired')).toHaveLength(1);
    expect(sim.energy.value).toBe(0);
    expect(sim.snapshot().furie).not.toBeNull();
  });

  test('works with the bouclier held (no weapon slot involved)', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.weapons.held = heldOf('bouclier');
    sim.energy.value = 50;
    expect(of(charge(sim, CONFIG.kamehame.chargeSec), 'BeamFired')).toHaveLength(1);
    expect(sim.weapons.held?.kind).toBe('bouclier');
  });

  test('determinism: same seed and inputs, same gauge and events', () => {
    const run = () => {
      const sim = new Sim(11);
      const out: SimEvent[] = [];
      for (let k = 0; k < 14; k++) out.push(...bashKo(sim));
      out.push(...charge(sim, CONFIG.kamehame.chargeSec));
      return { out, v: sim.energy.value };
    };
    const a = run();
    expect(a.v).toBe(14 * 4 - 50);
    expect(run()).toEqual(a);
  });
});
