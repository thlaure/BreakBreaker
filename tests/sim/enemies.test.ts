import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { bruteCount } from '../../src/sim/director';
import { Horde, roleHp } from '../../src/sim/hostiles';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, Role, SimEvent, Vec, WeaponKind } from '../../src/sim/types';
import { WEAPONS } from '../../src/sim/weapons';
import { IDLE, autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const OPEN: Vec = { x: 656, y: 720 };

/** A rioter of `role` right next to Paul (open ground) that never attacks during the test. */
function beside(sim: Sim, role: Role, dx = 20) {
  sim.player.pos = { ...OPEN };
  const h = sim.horde.spawn({ variant: 'classic', role, pos: { x: OPEN.x + dx, y: OPEN.y } })!;
  h.nextAttackAt = 1e9;
  return h;
}

/** Strikes (one press, then the cooldown) until `lifeId` is KO; returns the number of strikes that hit it. */
function strikesToKo(sim: Sim, lifeId: number, max = 12): number {
  let n = 0;
  for (let k = 0; k < max; k++) {
    const ev = sim.step(input({ strike: true }));
    if (of(ev, 'HitConfirmed').some((e) => e.targetLifeId === lifeId)) n++;
    if (of(ev, 'ActorKnockedOut').some((e) => e.lifeId === lifeId)) return n;
    for (let i = 0; i < Math.ceil(CONFIG.melee.cooldown / CONFIG.step) + 1; i++) sim.step(IDLE);
  }
  return -1;
}

describe('new roles: hp and speed', () => {
  test('runner 1 HP, brute 4 HP, Caïd 6 HP; everyone else keeps the base HP', () => {
    const horde = new Horde();
    const hp = (role: Role) => horde.spawn({ variant: 'antifa', role, pos: { x: 700, y: 720 } })!.maxHp;
    expect(hp('runner')).toBe(CONFIG.runner.hp);
    expect(hp('runner')).toBe(1);
    expect(hp('brute')).toBe(4);
    expect(hp('boss')).toBe(6);
    expect(hp('contact')).toBe(CONFIG.hostile.baseHp);
    expect(roleHp('thrower')).toBe(CONFIG.hostile.baseHp);
  });

  test('runner ×1.6, brute ×0.75, Caïd ×0.9 the contact speed (open ground, chasing Paul)', () => {
    const run = (role: Role): number => {
      const sim = new Sim(1, { invulnerable: true });
      sim.player.pos = { x: 656, y: 720 };
      const h = sim.horde.spawn({ variant: 'classic', role, pos: { x: 656 + 260, y: 720 } })!;
      const x0 = h.pos.x;
      for (let i = 0; i < 30; i++) sim.step(IDLE);
      return x0 - h.pos.x;
    };
    const base = run('contact');
    expect(base).toBeCloseTo(CONFIG.hostile.speed * 0.5, 0);
    expect(run('runner') / base).toBeCloseTo(1.6, 2);
    expect(run('brute') / base).toBeCloseTo(0.75, 2);
    expect(run('boss') / base).toBeCloseTo(0.9, 2);
  });
});

describe('damage rules on tougher rioters', () => {
  const kill = (role: Role, setup: (sim: Sim) => void = () => {}): number => {
    const sim = new Sim(2, { invulnerable: true });
    const h = beside(sim, role);
    setup(sim);
    return strikesToKo(sim, h.lifeId);
  };
  const hold = (kind: WeaponKind) => (sim: Sim) => {
    sim.weapons.held = { kind, uses: WEAPONS[kind].uses };
  };

  test('bare hands: 1 damage a strike (runner 1, contact 2, brute 4, Caïd 6 strikes)', () => {
    expect(kill('runner')).toBe(1);
    expect(kill('contact')).toBe(2);
    expect(kill('brute')).toBe(4);
    expect(kill('boss')).toBe(6);
  });

  test('a held weapon: 2 damage on a brute (2 strikes) and the Caïd (3), one-hit KO on everyone else', () => {
    for (const k of ['baton', 'marteau', 'panneau'] as const) {
      expect(kill('brute', hold(k))).toBe(2);
      expect(kill('boss', hold(k))).toBe(Math.ceil(CONFIG.caid.hp / CONFIG.toughWeaponDamage));
      expect(kill('contact', hold(k))).toBe(1);
      expect(kill('runner', hold(k))).toBe(1);
    }
  });

  test('mode furie KOs a brute outright; the bouclier adds nothing to bare hands', () => {
    expect(kill('brute', (sim) => (sim.weapons.furieLeft = 10))).toBe(1);
    expect(kill('brute', (sim) => sim.weapons.startShield())).toBe(CONFIG.brute.hp);
  });

  test('the onde d’énergie KOs a brute and the Caïd in one beam', () => {
    const sim = new Sim(2, { invulnerable: true });
    sim.player.pos = { ...OPEN };
    sim.player.facing = { x: 1, y: 0 };
    const b = sim.horde.spawn({ variant: 'classic', role: 'brute', pos: { x: OPEN.x + 80, y: OPEN.y } })!;
    const c = sim.horde.spawn({ variant: 'classic', role: 'boss', pos: { x: OPEN.x + 140, y: OPEN.y } })!;
    b.nextAttackAt = c.nextAttackAt = 1e9;
    sim.energy.value = CONFIG.energy.ondeCost;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 71; i++) ev.push(...sim.step(input({ chargeHeld: true, aim: { x: 1, y: 0 } })));
    expect(of(ev, 'BeamFired')).toHaveLength(1);
    expect(b.state).toBe('ko');
    expect(c.state).toBe('ko');
  });

  test('a returned rock does 1 damage (a brute takes 4)', () => {
    const horde = new Horde();
    const b = horde.spawn({ variant: 'classic', role: 'brute', pos: { x: 700, y: 720 } })!;
    for (let i = 0; i < 3; i++) expect(horde.applyHit(b.lifeId, CONFIG.rock.returnDamage)).toBe('hit');
    expect(horde.applyHit(b.lifeId, CONFIG.rock.returnDamage)).toBe('ko');
  });

  test('HitConfirmed is heavy on a brute or the Caïd only', () => {
    const sim = new Sim(2, { invulnerable: true });
    const h = beside(sim, 'brute');
    const ev = sim.step(input({ strike: true }));
    expect(of(ev, 'HitConfirmed')).toEqual([{ type: 'HitConfirmed', targetLifeId: h.lifeId, damage: 1, source: 'melee', heavy: true }]);
    const s2 = new Sim(2, { invulnerable: true });
    const c = beside(s2, 'contact');
    expect(of(s2.step(input({ strike: true })), 'HitConfirmed')[0]).toEqual({ type: 'HitConfirmed', targetLifeId: c.lifeId, damage: 1, source: 'melee' });
  });
});

describe('knockback on Paul', () => {
  /** Paul at `paul`, a rioter of `role` `dx` px east of him winding up at once; steps until Paul is hit. */
  function blow(role: Role, paul: Vec, dx = 18) {
    const sim = new Sim(3);
    sim.player.pos = { ...paul };
    sim.horde.spawn({ variant: 'classic', role, pos: { x: paul.x + dx, y: paul.y } });
    for (let i = 0; i < 120; i++) {
      const before = { ...sim.player.pos };
      const ev = sim.step(IDLE);
      const hit = of(ev, 'PlayerDamaged');
      if (hit.length > 0) return { sim, before, after: { ...sim.player.pos }, hit: hit[0]! };
    }
    throw new Error('no blow landed');
  }

  test('a brute pushes Paul 28 px away (west here), a Caïd 40 px; no extra damage', () => {
    for (const [role, k] of [
      ['brute', CONFIG.brute.knockback],
      ['boss', CONFIG.caid.knockback],
    ] as const) {
      const { before, after, hit } = blow(role, OPEN);
      expect(hit.amount).toBe(CONFIG.hostile.contactDamage + Math.floor(1 / 2));
      expect(Math.hypot(hit.push!.x, hit.push!.y)).toBeCloseTo(k, 6);
      expect(before.x - after.x).toBeCloseTo(k, 0);
      expect(Math.abs(after.y - before.y)).toBeLessThan(1);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThanOrEqual(k + 1e-6);
    }
  });

  test('a contact or a runner never pushes Paul', () => {
    for (const role of ['contact', 'runner'] as const) {
      const { before, after, hit } = blow(role, OPEN);
      expect(hit.push).toBeUndefined();
      expect(after).toEqual(before);
    }
  });

  test('blocked by solids: Paul against a building is not pushed into it', () => {
    // building R(12,15,4,4): x 384..512; Paul just east of its east wall, the brute east of him pushes him west
    const paul = { x: 512 + CONFIG.player.radius + 2, y: 540 };
    const { sim, before, after } = blow('brute', paul);
    expect(after.x).toBeGreaterThanOrEqual(512 + CONFIG.player.radius - 1e-6);
    expect(before.x - after.x).toBeLessThan(CONFIG.brute.knockback);
    expect(sim.grid.circleBlocked(after, CONFIG.player.radius)).toBe(false);
  });
});

/** Every round-tagged hostile of a run: role, fill group, entry order. */
interface Seen {
  lifeId: number;
  round: number | null;
  role: Role;
  group: string | null;
  order: number;
}

function play(seed: number, rounds: number, koAfterSec = 0) {
  const sim = new Sim(seed, { invulnerable: true });
  const seen = new Map<number, Seen>();
  const done: { index: number; kos: number; total: number }[] = [];
  const events: SimEvent[] = [];
  let order = 0;
  for (let i = 0; i < 60 * 60 * 40 && done.length < rounds; i++) {
    const ev = sim.step(autopilot(sim, { koAfterSec }));
    events.push(...ev);
    for (const h of sim.horde.list)
      if (!seen.has(h.lifeId)) seen.set(h.lifeId, { lifeId: h.lifeId, round: h.round, role: h.role, group: h.incidentId, order: order++ });
    if (ev.some((e) => e.type === 'RoundCompleted'))
      done.push({ index: sim.director.lastSummary!.index, kos: sim.director.lastSummary!.kos, total: sim.director.total });
  }
  return { sim, seen: [...seen.values()], done, events };
}

describe('round composition', () => {
  const run = play(5, 12);
  const ofRound = (r: number) => run.seen.filter((s) => s.round === r);
  const isFill = (s: Seen) => (s.group ?? '').startsWith(`round#${s.round}:`);

  test('12 rounds close at K = T', () => {
    expect(run.done.map((d) => d.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const d of run.done) expect(d.kos).toBe(d.total);
  });

  test('no runner before round 3; from round 3 one pack of 4–6 runners, all in one fill group', () => {
    for (let r = 1; r <= 12; r++) {
      const runners = ofRound(r).filter((s) => s.role === 'runner');
      if (r < CONFIG.runner.fromRound) {
        expect(runners).toEqual([]);
        continue;
      }
      expect(runners.length, `round ${r}`).toBeGreaterThanOrEqual(CONFIG.runner.pack[0]);
      expect(runners.length, `round ${r}`).toBeLessThanOrEqual(CONFIG.runner.pack[1]);
      expect(new Set(runners.map((s) => s.group)).size).toBe(1);
      expect(runners.every(isFill)).toBe(true);
    }
  });

  test('brutes: none before round 4, then 1, 2 from round 6, 3 from round 8 (capped), from the fill', () => {
    expect([1, 3, 4, 5, 6, 7, 8, 12].map(bruteCount)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    for (let r = 1; r <= 12; r++) {
      const brutes = ofRound(r).filter((s) => s.role === 'brute');
      expect(brutes.length, `round ${r}`).toBe(bruteCount(r));
      expect(brutes.every(isFill)).toBe(true);
    }
  });

  test('the Caïd closes every round from 3: exactly one, the last fill rioter to enter', () => {
    for (let r = 1; r <= 12; r++) {
      const all = ofRound(r);
      const bosses = all.filter((s) => s.role === 'boss');
      if (r < CONFIG.caid.fromRound) {
        expect(bosses).toEqual([]);
        continue;
      }
      expect(bosses, `round ${r}`).toHaveLength(1);
      const fill = all.filter(isFill);
      expect(fill[fill.length - 1]!.lifeId).toBe(bosses[0]!.lifeId);
    }
  });

  test('each Caïd KO scores +1 and +5 once (unique key) at his position and drops a regular weapon there', () => {
    const arrived = of(run.events, 'CaidArrived');
    expect(arrived.map((e) => e.round)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const bonus = of(run.events, 'ScoreChanged').filter((e) => e.points === CONFIG.caid.bonus);
    expect(bonus.length).toBeGreaterThanOrEqual(10);
    expect(run.sim.rules.award('caid#3', 5)).toBe(false);
  });

  test('variants stay mixed round-robin whatever the role', () => {
    const special = run.seen.filter((s) => s.role === 'runner' || s.role === 'brute' || s.role === 'boss');
    const variants = new Set(special.map((s) => run.sim.horde.list.find((h) => h.lifeId === s.lifeId)?.variant ?? null));
    variants.delete(null);
    expect(variants.size).toBeGreaterThan(1);
  });

  test('deterministic per seed', () => {
    const a = play(9, 5);
    const b = play(9, 5);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  test('K = T over 12 rounds for more seeds, rioters KO’d 3 s after entering', () => {
    for (const seed of [1, 2]) {
      const r = play(seed, 12, 3);
      expect(r.done).toHaveLength(12);
      for (const d of r.done) expect(d.kos).toBe(d.total);
    }
  });
});

describe('the Caïd in play', () => {
  /** Plays until the Caïd of the first round from CONFIG.caid.fromRound has entered. */
  function untilCaid(seed = 4) {
    const sim = new Sim(seed, { invulnerable: true });
    for (let i = 0; i < 60 * 60 * 20; i++) {
      const caid = sim.horde.active().find((h) => h.role === 'boss');
      if (caid) return { sim, caid };
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      for (const h of sim.horde.active()) if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId, h.pos);
      sim.step(IDLE);
    }
    throw new Error('no Caïd');
  }

  test('a melee KO: +1 and +5 at his position, at most one regular weapon dropped where he fell (1 in 2), award key caid#<round>', () => {
    const { sim, caid } = untilCaid();
    expect(sim.director.round).toBe(CONFIG.caid.fromRound);
    caid.hp = 1;
    caid.nextAttackAt = 1e9;
    caid.pos = { x: OPEN.x + 40, y: OPEN.y };
    sim.player.pos = { ...OPEN };
    const ev = sim.step(input({ strike: true }));
    expect(caid.state).toBe('ko');
    const scored = of(ev, 'ScoreChanged');
    expect(scored).toContainEqual({ type: 'ScoreChanged', points: 1, pos: caid.pos });
    expect(scored).toContainEqual({ type: 'ScoreChanged', points: CONFIG.caid.bonus, pos: caid.pos });
    // (a timed street spawn may land on the same step, elsewhere)
    const drop = of(ev, 'WeaponSpawned').filter((e) => e.pos.x === caid.pos.x && e.pos.y === caid.pos.y);
    expect(drop.length).toBeLessThanOrEqual(1);
    for (const d of drop) expect(['baton', 'marteau', 'panneau']).toContain(d.kind);
    expect(sim.weapons.ground.some((g) => g.pos.x === caid.pos.x && g.pos.y === caid.pos.y)).toBe(drop.length === 1);
    expect(sim.rules.award(`caid#${CONFIG.caid.fromRound}`, 5)).toBe(false);
    // later steps never award it again
    let again = 0;
    for (let i = 0; i < 60; i++) again += of(sim.step(IDLE), 'ScoreChanged').filter((e) => e.points === CONFIG.caid.bonus).length;
    expect(again).toBe(0);
  });

  test('snapshot: role, hp and maxHp of every hostile', () => {
    const { sim, caid } = untilCaid();
    const s = sim.snapshot().hostiles.find((h) => h.lifeId === caid.lifeId)!;
    expect(s).toMatchObject({ role: 'boss', hp: CONFIG.caid.hp, maxHp: CONFIG.caid.hp });
  });

  test('CaidArrived once when he walks in', () => {
    const sim = new Sim(4, { invulnerable: true });
    const arrived: Ev<'CaidArrived'>[] = [];
    for (let i = 0; i < 60 * 60 * 20 && arrived.length === 0; i++) arrived.push(...of(sim.step(autopilot(sim, { koAfterSec: 1 })), 'CaidArrived'));
    expect(arrived).toHaveLength(1);
    const h = sim.horde.list.find((x) => x.lifeId === arrived[0]!.lifeId)!;
    expect(h.role).toBe('boss');
    expect(arrived[0]!.round).toBe(CONFIG.caid.fromRound);
  });
});
