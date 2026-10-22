import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { caidHp, damageOn, Horde, roleHp } from '../../src/sim/hostiles';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, Role, SimEvent, Vec, WeaponKind } from '../../src/sim/types';
import { WEAPONS } from '../../src/sim/weapons';
import { IDLE, autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const OPEN: Vec = { x: 656, y: 720 };
const COOLDOWN = Math.ceil(CONFIG.melee.cooldown / CONFIG.step) + 1;

/** A rioter of `role` (Caïd of `round`) next to Paul on open ground, never attacking. */
function beside(sim: Sim, role: Role, dx = 20, round?: number) {
  sim.player.pos = { ...OPEN };
  const h = sim.horde.spawn({ variant: 'classic', role, pos: { x: OPEN.x + dx, y: OPEN.y }, round })!;
  h.nextAttackAt = 1e9;
  return h;
}

/** Strikes until `lifeId` is KO; the number of strikes that hit it (-1: never KO'd within `max`). */
function strikesToKo(sim: Sim, lifeId: number, max = 40): number {
  let n = 0;
  for (let k = 0; k < max; k++) {
    const ev = sim.step(input({ strike: true }));
    if (of(ev, 'HitConfirmed').some((e) => e.targetLifeId === lifeId)) n++;
    if (of(ev, 'ActorKnockedOut').some((e) => e.lifeId === lifeId)) return n;
    for (let i = 0; i < COOLDOWN; i++) sim.step(IDLE);
    // keep him next to Paul
    const h = sim.horde.list.find((x) => x.lifeId === lifeId)!;
    h.pos = { x: OPEN.x + 20, y: OPEN.y };
    sim.player.pos = { ...OPEN };
  }
  return -1;
}

describe('Le Caïd: HP grows with the round', () => {
  test('hp = 14 + floor((round − 3) / 2) × 2, capped at 26', () => {
    expect(caidHp(3)).toBe(14);
    expect(caidHp(4)).toBe(14);
    expect(caidHp(5)).toBe(16);
    expect(caidHp(6)).toBe(16);
    expect(caidHp(7)).toBe(18);
    expect(caidHp(13)).toBe(24);
    expect(caidHp(15)).toBe(26);
    expect(caidHp(40)).toBe(26);
    for (let r = 3; r <= 30; r++) expect(caidHp(r)).toBe(Math.min(26, 14 + Math.floor((r - 3) / 2) * 2));
  });

  test('a Caïd spawned for round N has caidHp(N); without a round, the round-3 value; roleHp(boss, N) agrees', () => {
    const horde = new Horde();
    for (const r of [3, 5, 9, 20]) {
      const h = horde.spawn({ variant: 'classic', role: 'boss', pos: { x: 700, y: 720 }, round: r })!;
      expect(h.maxHp).toBe(caidHp(r));
      expect(h.hp).toBe(caidHp(r));
      expect(roleHp('boss', r)).toBe(caidHp(r));
    }
    expect(horde.spawn({ variant: 'classic', role: 'boss', pos: { x: 700, y: 720 } })!.maxHp).toBe(14);
    // brutes and the others do not depend on the round
    expect(roleHp('brute', 9)).toBe(CONFIG.brute.hp);
    expect(roleHp('contact', 9)).toBe(CONFIG.hostile.baseHp);
  });

  test('in play: the Caïd of rounds 3, 5 and 7 walks in with 14, 16 and 18 HP', () => {
    const sim = new Sim(4, { invulnerable: true });
    const seen = new Map<number, number>();
    for (let i = 0; i < 60 * 60 * 40 && sim.director.round <= 7; i++) {
      for (const e of of(sim.step(autopilot(sim, { koAfterSec: 0.5 })), 'CaidArrived')) {
        const h = sim.horde.list.find((x) => x.lifeId === e.lifeId)!;
        seen.set(e.round, h.maxHp);
      }
    }
    expect(seen.get(3)).toBe(14);
    expect(seen.get(5)).toBe(16);
    expect(seen.get(7)).toBe(18);
  });
});

describe('Le Caïd: damage he takes per source', () => {
  test('the damage table', () => {
    expect(CONFIG.caid.damageFrom).toEqual({ hands: 1, weapon: 2, rock: 1, furie: 5, beam: 10, bubble: 0 });
    for (const s of ['hands', 'weapon', 'rock', 'furie', 'beam', 'bubble'] as const) expect(damageOn('boss', s)).toBe(CONFIG.caid.damageFrom[s]);
  });

  test('brutes and everyone else keep their rules (brute: hands 1, weapons 2, rock 1, furie / beam KO)', () => {
    expect(damageOn('brute', 'hands')).toBe(1);
    expect(damageOn('brute', 'weapon')).toBe(CONFIG.toughWeaponDamage);
    expect(damageOn('brute', 'rock')).toBe(CONFIG.rock.returnDamage);
    expect(damageOn('brute', 'furie')).toBeGreaterThanOrEqual(CONFIG.brute.hp);
    expect(damageOn('brute', 'beam')).toBeGreaterThanOrEqual(CONFIG.brute.hp);
    expect(damageOn('contact', 'weapon')).toBeGreaterThanOrEqual(CONFIG.hostile.baseHp);
    expect(damageOn('contact', 'hands')).toBe(1);
  });

  test('bare hands: 1 a strike (14 strikes at round 3)', () => {
    const sim = new Sim(2, { invulnerable: true });
    const c = beside(sim, 'boss', 20, 3);
    expect(strikesToKo(sim, c.lifeId)).toBe(14);
  });

  test('a held swung weapon: 2 a strike — 7 strikes at round 3, 8 at round 5', () => {
    for (const k of ['baton', 'marteau', 'panneau'] as WeaponKind[]) {
      for (const [round, n] of [[3, 7], [5, 8]] as const) {
        const sim = new Sim(2, { invulnerable: true });
        sim.weapons.held = { kind: k, uses: 99 };
        const c = beside(sim, 'boss', 20, round);
        const ev = sim.step(input({ strike: true }));
        expect(of(ev, 'HitConfirmed')[0]).toEqual({ type: 'HitConfirmed', targetLifeId: c.lifeId, damage: 2, source: 'melee', heavy: true });
        for (let i = 0; i < COOLDOWN; i++) sim.step(IDLE);
        expect(strikesToKo(sim, c.lifeId) + 1).toBe(n);
      }
    }
    expect(WEAPONS.baton.uses).toBeGreaterThanOrEqual(7);
  });

  test('mode furie: 5 a hit — 3 hits at round 3', () => {
    const sim = new Sim(2, { invulnerable: true });
    sim.weapons.furieLeft = 60;
    const c = beside(sim, 'boss', 20, 3);
    const ev = sim.step(input({ strike: true }));
    expect(of(ev, 'HitConfirmed')[0]).toEqual({ type: 'HitConfirmed', targetLifeId: c.lifeId, damage: 5, source: 'melee', heavy: true });
    expect(c.hp).toBe(14 - 5);
    for (let i = 0; i < COOLDOWN; i++) sim.step(IDLE);
    expect(strikesToKo(sim, c.lifeId) + 1).toBe(3);
  });

  test('the onde d’énergie: 10 a beam — 2 beams at round 3; a brute on the same line is still KO’d by the first', () => {
    const sim = new Sim(2, { invulnerable: true });
    sim.player.pos = { ...OPEN };
    sim.player.facing = { x: 1, y: 0 };
    const b = sim.horde.spawn({ variant: 'classic', role: 'brute', pos: { x: OPEN.x + 80, y: OPEN.y } })!;
    const c = sim.horde.spawn({ variant: 'classic', role: 'boss', pos: { x: OPEN.x + 140, y: OPEN.y }, round: 3 })!;
    b.nextAttackAt = c.nextAttackAt = 1e9;
    const fire = (): SimEvent[] => {
      sim.energy.value = CONFIG.energy.ondeCost;
      const ev: SimEvent[] = [];
      for (let i = 0; i < 71; i++) ev.push(...sim.step(input({ chargeHeld: true, aim: { x: 1, y: 0 } })));
      ev.push(...sim.step(IDLE));
      c.pos = { x: OPEN.x + 140, y: OPEN.y };
      sim.player.pos = { ...OPEN };
      return ev;
    };
    const first = fire();
    expect(of(first, 'BeamFired')).toHaveLength(1);
    expect(b.state).toBe('ko');
    expect(c.state).not.toBe('ko');
    expect(c.hp).toBe(14 - 10);
    expect(of(first, 'HitConfirmed').find((e) => e.targetLifeId === c.lifeId)).toMatchObject({ damage: 10, source: 'beam' });
    fire();
    expect(c.state).toBe('ko');
  });

  test('the flashball and the gant: 2 a hit', () => {
    for (const kind of ['flashball', 'gant'] as const) {
      const sim = new Sim(2, { invulnerable: true });
      sim.weapons.held = { kind, uses: 6 };
      sim.player.facing = { x: 1, y: 0 };
      const c = beside(sim, 'boss', 60, 3);
      const ev: SimEvent[] = [];
      ev.push(...sim.step(input({ strike: true, aim: { x: 1, y: 0 } })));
      for (let i = 0; i < 30; i++) ev.push(...sim.step(IDLE));
      expect(c.hp).toBe(14 - 2);
      expect(of(ev, 'HitConfirmed').find((e) => e.targetLifeId === c.lifeId)).toMatchObject({ damage: 2, heavy: true });
    }
  });

  test('a returned rock: 1', () => {
    const sim = new Sim(2, { invulnerable: true });
    const c = beside(sim, 'boss', 120, 3);
    sim.rocks.carried = 1;
    const ev: SimEvent[] = [];
    ev.push(...sim.step(input({ throwRock: true, aim: { x: 1, y: 0 } })));
    for (let i = 0; i < 60; i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'HitConfirmed').find((e) => e.targetLifeId === c.lifeId)).toMatchObject({ damage: 1, source: 'rock' });
    expect(c.hp).toBe(13);
  });

  test('the bouclier’s bubble does nothing to him', () => {
    const sim = new Sim(2, { invulnerable: true });
    sim.weapons.startShield();
    const c = beside(sim, 'boss', 10, 3);
    for (let i = 0; i < 120; i++) sim.step(IDLE);
    expect(c.hp).toBe(14);
  });
});

describe('Le Caïd: he hits harder', () => {
  /** Paul on open ground, a rioter of `role` 18 px east winding up at once; steps until Paul is hit. */
  function blow(role: Role) {
    const sim = new Sim(3);
    sim.player.pos = { ...OPEN };
    sim.horde.spawn({ variant: 'classic', role, pos: { x: OPEN.x + 18, y: OPEN.y }, round: 3 });
    for (let i = 0; i < 120; i++) {
      const before = { ...sim.player.pos };
      const hit = of(sim.step(IDLE), 'PlayerDamaged');
      if (hit.length > 0) return { sim, before, after: { ...sim.player.pos }, hit: hit[0]! };
    }
    throw new Error('no blow landed');
  }

  test('tunables: contact damage ×1.5, knockback 52 px, attack interval ×0.85, speed ×0.9', () => {
    expect(CONFIG.caid).toMatchObject({ damageMul: 1.5, knockback: 52, attackIntervalMul: 0.85, speedMul: 0.9 });
  });

  test('his blow does round(1.5 × the contact damage) and pushes Paul 52 px; a contact rioter does the base damage', () => {
    const base = blow('contact').hit.amount;
    const { hit, before, after } = blow('boss');
    expect(hit.amount).toBe(Math.round(base * 1.5));
    expect(Math.hypot(hit.push!.x, hit.push!.y)).toBeCloseTo(52, 6);
    expect(before.x - after.x).toBeCloseTo(52, 0);
  });

  test('he attacks every 0.85 × the contact interval', () => {
    const times = (role: Role): number[] => {
      const sim = new Sim(3, { invulnerable: true });
      sim.player.pos = { ...OPEN };
      const h = sim.horde.spawn({ variant: 'classic', role, pos: { x: OPEN.x + 18, y: OPEN.y }, round: 3 })!;
      const out: number[] = [];
      for (let i = 0; i < 60 * 8; i++) {
        const was = h.state;
        sim.step(IDLE);
        h.pos = { x: OPEN.x + 18, y: OPEN.y };
        sim.player.pos = { ...OPEN };
        if (was !== 'windup' && h.state === 'windup') out.push(sim.now);
      }
      return out;
    };
    const c = times('contact');
    const b = times('boss');
    expect(c[1]! - c[0]!).toBeCloseTo(CONFIG.hostile.attackInterval, 1);
    expect(b[1]! - b[0]!).toBeCloseTo(CONFIG.hostile.attackInterval * 0.85, 1);
  });
});

describe('Le Caïd: rewards, closing and determinism', () => {
  test('KO bonus +5 and energy +20 unchanged', () => {
    expect(CONFIG.caid.bonus).toBe(5);
    expect(CONFIG.energy.gain.boss).toBe(25);
  });

  test('sessions with the tougher Caïd: K === T at every round end, deterministic', () => {
    const run = (seed: number) => {
      const sim = new Sim(seed, { invulnerable: true });
      const out: string[] = [];
      for (let i = 0; i < 60 * 60 * 30 && sim.director.round <= 6; i++) {
        for (const r of of(sim.step(autopilot(sim, { koAfterSec: 1 })), 'RoundCompleted')) {
          expect(sim.director.roundKos(sim)).toBe(sim.director.total);
          out.push(`${r.index}@${sim.now.toFixed(3)}:${sim.rules.score}`);
        }
      }
      return out;
    };
    const a = run(6);
    expect(a.length).toBeGreaterThanOrEqual(6);
    expect(run(6)).toEqual(a);
  });
});
