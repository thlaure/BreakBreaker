import { describe, expect, test, vi } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { casseOpen, roundPlan } from '../../src/sim/director';
import { caidHp } from '../../src/sim/hostiles';
import { molotovCount } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { guardHp, PRISON_POSTS } from '../../src/sim/prison';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import { Targets } from '../../src/sim/targets';
import type { InputFrame, SimEvent, TargetId, Variant, Vec } from '../../src/sim/types';

const C = (tx: number, ty: number): Vec => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
const R = (tx: number, ty: number, tw: number, th: number) => ({ x: tx * 32, y: ty * 32, w: tw * 32, h: th * 32 });
const IDLE: InputFrame = {
  move: { x: 0, y: 0 },
  aim: null,
  run: false,
  strike: false,
  chargeHeld: false,
  throwRock: false,
  act: false,
  furie: false,
};
const PRESS: InputFrame = { ...IDLE, act: true };
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const hyp = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const prisonDef = () => DISTRICT.targets.find((t) => t.id === 'prison')!;
const DOOR = () => prisonDef().door;
/** Far from the prison (north-west), where Paul waits in the quiet sims. */
const AWAY = C(8, 12);

/** A sim with the director silenced (no round, no rioter walks in), Paul invulnerable at `pos`; `run` steps idle. */
function quiet(pos: Vec = AWAY, seed = 7) {
  const sim = new Sim(seed, { invulnerable: true });
  const director = vi.spyOn(sim.director, 'step').mockReturnValue([]);
  sim.player.pos = { ...pos };
  const run = (sec: number, until?: (ev: SimEvent[]) => boolean): SimEvent[] => {
    const all: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec * 60); i++) {
      const ev = sim.step(IDLE);
      all.push(...ev);
      if (until?.(ev)) break;
    }
    return all;
  };
  return { sim, run, director };
}

/** A Caïd of round `round` knocked out on the spot (far from the prison): the KO path of the next step. */
function koCaid(sim: Sim, round = 5, at: Vec = AWAY, variant: Variant = 'antifa'): SimEvent[] {
  const h = sim.horde.spawn({ variant, role: 'boss', pos: at, round })!;
  sim.horde.applyHit(h.lifeId, 999);
  return sim.step(IDLE);
}

const guards = (sim: Sim) => sim.snapshot().prison.guards;

describe('the prison (target)', () => {
  test('a 400 hp building of kind prison on the free south-east block, door on the street in front', () => {
    const d = prisonDef();
    expect(d).toMatchObject({ kind: 'prison', prop: false, maxHp: 400, footprint: R(38, 36, 6, 6) });
    expect(DISTRICT.buildings).toContainEqual(R(38, 36, 6, 6));
    // no other target on that block
    for (const t of DISTRICT.targets) if (t.id !== 'prison') expect(t.footprint).not.toEqual(d.footprint);
    expect(d.footprint.x).toBeGreaterThan(24 * 32);
    expect(d.footprint.y).toBeGreaterThan(24 * 32);
    expect(d.door).toEqual(C(41, 42));
    expect(new Targets().get('prison')).toMatchObject({ hp: 400, maxHp: 400, state: 'intact' });
  });

  test('attack points and door walkable and reachable from Paul’s spawn and the rioters’ entry points', () => {
    const grid = new Grid(DISTRICT);
    const ff = new FlowField(grid);
    const d = prisonDef();
    for (const from of [DISTRICT.playerSpawn, ...DISTRICT.hostileSpawns]) {
      ff.rebuild(from);
      for (const q of [...d.attackPoints, d.door]) {
        expect(grid.circleBlocked(q, CONFIG.hostile.radius)).toBe(false);
        expect(ff.stepsAt(q)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(d.attackPoints.length).toBeGreaterThanOrEqual(3);
  });

  test('config, scores +8 / −3 / +5, open from round 4, a building’s Molotovs', () => {
    expect(CONFIG.prison).toMatchObject({ hp: 400, guards: 5, postRadius: 160, fromRound: 4 });
    expect(CONFIG.casse.scores.prison).toEqual([8, -3, 5]);
    expect(CONFIG.casse.fromRound.prison).toBe(4);
    expect(casseOpen('prison', 3)).toBe(false);
    expect(casseOpen('prison', 4)).toBe(true);
    expect(molotovCount('prison', 12)).toBe(molotovCount('library', 12));
  });

  test('in the draw only from round 4', () => {
    const t = new Targets();
    const onlyPrison = (id: TargetId) => id === 'prison';
    for (let s = 1; s <= 40; s++) {
      expect(roundPlan(3, rng(s), t, null, null, onlyPrison).beats).toEqual([['rescue']]);
      expect(roundPlan(4, rng(s), t, null, null, onlyPrison).beats[0]).toEqual(['prison']);
    }
    const seen = new Set<string>();
    for (let s = 1; s <= 300; s++) {
      expect(roundPlan(2, rng(s), t).beats[0]).not.toContain('prison');
      expect(roundPlan(3, rng(s), t).beats[0]).not.toContain('prison');
      for (const k of roundPlan(4 + (s % 3), rng(s), t).beats[0]!) seen.add(k);
    }
    expect(seen.has('prison')).toBe(true);
  });

  test('a prison attack can start in a played round 4+ (CasseStarted on the prison)', () => {
    const sim = new Sim(3, { invulnerable: true });
    // every other place unavailable: only the prison is free in the draw
    for (const t of DISTRICT.targets) if (t.id !== 'prison') sim.targets.ruin(t.id, `test:${t.id}`);
    sim.director.round = 4;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 6 * 60; i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'CasseStarted').map((e) => [e.kind, e.target])).toContainEqual(['prison', 'prison']);
  });
});

describe('the guards', () => {
  test('5 guards held to posts around the prison, a Caïd’s hp (min 14)', () => {
    expect(guardHp(1)).toBe(14);
    expect(guardHp(3)).toBe(14);
    expect(guardHp(9)).toBe(Math.max(14, caidHp(9)));
    expect(guardHp(30)).toBe(caidHp(30));
    const grid = new Grid(DISTRICT);
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    expect(PRISON_POSTS).toHaveLength(CONFIG.prison.guards);
    for (const p of PRISON_POSTS) {
      expect(grid.circleBlocked(p, CONFIG.hostile.radius)).toBe(false);
      expect(ff.stepsAt(p)).toBeGreaterThanOrEqual(0);
      expect(hyp(p, DOOR())).toBeLessThanOrEqual(CONFIG.prison.postRadius);
    }
    const sim = new Sim(1);
    const s = sim.snapshot().prison;
    expect(s).toMatchObject({ jailed: 0, standing: true });
    expect(s.guards).toHaveLength(5);
    for (const [i, g] of s.guards.entries()) {
      expect(g).toMatchObject({ hp: 14, maxHp: 14, state: 'run' });
      expect(g.pos).toEqual(PRISON_POSTS[i]);
    }
    // guards are not the booth police
    expect(sim.snapshot().allies.police).toHaveLength(0);
    expect(sim.allies.fighters.every((f) => f.role === 'guard')).toBe(true);
  });

  test('a guard KOs a rioter within its post radius (+1), without the energy gauge; its blows are bare-hands hits', () => {
    const { sim, run } = quiet();
    const post = PRISON_POSTS[2]!;
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: post.x + 60, y: post.y } })!;
    h.nextAttackAt = 1e9;
    const kos = sim.rules.kos;
    // the first blow takes 1 hp (bare hands), not the one-hit KO of the police baton
    run(6, () => h.hp < h.maxHp);
    expect(h.hp).toBe(h.maxHp - 1);
    expect(h.state).not.toBe('ko');
    const ev = run(6, (e) => of(e, 'ActorKnockedOut').length > 0);
    expect(of(ev, 'ActorKnockedOut').map((e) => e.lifeId)).toContain(h.lifeId);
    expect(sim.rules.kos).toBe(kos + 1);
    expect(sim.energy.value).toBe(0);
  });

  test('guards never chase a rioter beyond their post radius, never leave it', () => {
    // Paul and a rioter next to him, 200+ px from every post: the guards stay home
    const spot = C(30, 44);
    for (const p of PRISON_POSTS) expect(hyp(p, spot)).toBeGreaterThan(CONFIG.prison.postRadius + 32);
    const { sim } = quiet(spot);
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: spot.x + 16, y: spot.y } })!;
    h.nextAttackAt = 1e9;
    for (let i = 0; i < 10 * 60; i++) {
      sim.step(IDLE);
      for (const f of sim.allies.fighters) expect(hyp(f.pos, f.post!.pos)).toBeLessThanOrEqual(CONFIG.prison.postRadius + 1e-6);
    }
    expect(h.state).not.toBe('ko');
  });

  test('a guard brought to 0 hp is down (GuardDown), not PoliceDown', () => {
    const { sim, run } = quiet();
    const g = sim.allies.fighters[0]!;
    const ev = sim.allies.damage(g.id, 999);
    expect(ev).toEqual([{ type: 'GuardDown', id: g.id }]);
    expect(guards(sim)[0]!.state).toBe('down');
    run(CONFIG.services.police.downSec + 0.1);
    expect(guards(sim)).toHaveLength(4);
  });

  test('guards come back in the breather with the coming round’s hp; up ones healed', () => {
    const { sim, run, director } = quiet();
    sim.director.round = 6;
    const [a, b] = sim.allies.fighters;
    sim.allies.damage(a!.id, 999);
    sim.allies.damage(b!.id, 3);
    run(CONFIG.services.police.downSec + 0.1);
    expect(guards(sim)).toHaveLength(4);
    director.mockReturnValueOnce([{ type: 'RoundCompleted', index: 6, bonus: false }]);
    const ev = sim.step(IDLE);
    expect(of(ev, 'GuardsBack')).toHaveLength(1);
    const gs = guards(sim);
    expect(gs).toHaveLength(5);
    for (const g of gs) expect(g).toMatchObject({ hp: guardHp(7), maxHp: guardHp(7) });
    expect(gs.map((g) => g.pos)).toContainEqual(PRISON_POSTS[0]);
  });

  test('a guard KO’d then the prison ruined before the round ends does not come back', () => {
    const { sim, run, director } = quiet();
    sim.allies.damage(sim.allies.fighters[0]!.id, 999);
    run(CONFIG.services.police.downSec + 0.1);
    sim.targets.ruin('prison', 'test#1');
    sim.step(IDLE);
    director.mockReturnValueOnce([{ type: 'RoundCompleted', index: 4, bonus: false }]);
    const ev = sim.step(IDLE);
    expect(of(ev, 'GuardsBack')).toHaveLength(0);
    expect(guards(sim)).toHaveLength(4);
    expect(sim.snapshot().prison.standing).toBe(false);
  });

  test('no GuardsBack when no guard was missing', () => {
    const { sim, director } = quiet();
    director.mockReturnValueOnce([{ type: 'RoundCompleted', index: 2, bonus: true }]);
    expect(of(sim.step(IDLE), 'GuardsBack')).toHaveLength(0);
    expect(guards(sim)).toHaveLength(5);
  });
});

describe('jail and breakout', () => {
  test('a Caïd KO’d while the prison stands is jailed (+5 bonus as before)', () => {
    const { sim } = quiet();
    const score = sim.rules.score;
    const ev = koCaid(sim);
    const jailed = of(ev, 'CaidJailed');
    expect(jailed).toHaveLength(1);
    expect(sim.snapshot().prison.jailed).toBe(1);
    // the direct hit skips the Sim's +1 path: only the Caïd's bonus, which jailing leaves as it was
    expect(sim.rules.score).toBe(score + CONFIG.caid.bonus);
    // once per life
    expect(of(sim.step(IDLE), 'CaidJailed')).toHaveLength(0);
    expect(sim.snapshot().prison.jailed).toBe(1);
  });

  test('a Caïd KO’d while the prison is ruined is not jailed', () => {
    const { sim } = quiet();
    sim.targets.ruin('prison', 'test#1');
    sim.step(IDLE);
    const ev = koCaid(sim);
    expect(of(ev, 'CaidJailed')).toHaveLength(0);
    expect(sim.snapshot().prison.jailed).toBe(0);
  });

  test('the prison destroyed with nobody jailed: nothing released, no crash', () => {
    const { sim, run } = quiet();
    sim.targets.ruin('prison', 'test#1');
    const ev = run(1);
    expect(of(ev, 'PrisonBreakout')).toHaveLength(0);
    expect(sim.horde.list.filter((h) => h.role === 'boss')).toHaveLength(0);
    expect(sim.snapshot().prison).toMatchObject({ jailed: 0, standing: false });
  });

  test('destroyed: every jailed Caïd out at the door with the round’s hp, added to the roster T (K <= T holds)', () => {
    const sim = new Sim(11, { invulnerable: true });
    sim.director.round = 6;
    // into round 6's play
    for (let i = 0; i < (CONFIG.round.introSec + 0.1) * 60; i++) sim.step(IDLE);
    expect(sim.director.phase).toBe('play');
    for (let i = 0; i < 3; i++) koCaid(sim, 6, C(8 + i, 12));
    expect(sim.snapshot().prison.jailed).toBe(3);
    const total = sim.snapshot().roundTotal;
    sim.targets.ruin('prison', 'test#1');
    const ev = sim.step(IDLE);
    const out = of(ev, 'PrisonBreakout');
    expect(out).toEqual([{ type: 'PrisonBreakout', count: 3, pos: DOOR() }]);
    expect(of(ev, 'RoundTotalChanged')).toContainEqual({ type: 'RoundTotalChanged', index: 6, total: total + 3 });
    const s = sim.snapshot();
    expect(s.roundTotal).toBe(total + 3);
    expect(s.prison.jailed).toBe(0);
    const freed = sim.horde.list.filter((h) => h.role === 'boss' && h.state !== 'ko');
    expect(freed).toHaveLength(3);
    for (const h of freed) {
      expect(h.round).toBe(6);
      expect(h.hp).toBe(caidHp(6));
      expect(hyp(h.pos, DOOR())).toBeLessThanOrEqual(32);
      expect(h.target).toBe('player');
    }
    // they count: KOs rise, never past T
    const k0 = sim.snapshot().roundKos;
    for (const h of freed) sim.horde.applyHit(h.lifeId, 999);
    sim.step(IDLE);
    const after = sim.snapshot();
    expect(after.roundKos).toBe(Math.min(after.roundTotal, k0 + 3));
    expect(after.roundKos).toBeLessThanOrEqual(after.roundTotal);
    // ruined: they are not jailed again
    expect(after.prison.jailed).toBe(0);
  });

  test('breakout during the breather: the Caïds belong to the next round and count in its roster', () => {
    const { sim, director } = quiet();
    sim.director.round = 5;
    sim.director.phase = 'breather';
    koCaid(sim);
    koCaid(sim);
    sim.targets.ruin('prison', 'test#1');
    const ev = sim.step(IDLE);
    expect(of(ev, 'PrisonBreakout')[0]!.count).toBe(2);
    const freed = sim.horde.list.filter((h) => h.role === 'boss' && h.state !== 'ko');
    expect(freed.map((h) => h.round)).toEqual([6, 6]);
    director.mockRestore();
    // the next round starts with them in its roster
    sim.director.breatherLeft = 0.001;
    const started = of(sim.step(IDLE), 'RoundStarted')[0]!;
    expect(started.index).toBe(6);
    expect(sim.director.total).toBe(started.total);
    expect(sim.snapshot().roundKos).toBe(0);
  });

  test('rebuilt by a toolbox at 60 % hp; the released Caïds stay free; jailing works again', () => {
    const { sim } = quiet();
    koCaid(sim);
    sim.targets.ruin('prison', 'test#1');
    sim.step(IDLE);
    const freed = sim.horde.list.filter((h) => h.role === 'boss' && h.state !== 'ko');
    expect(freed).toHaveLength(1);
    // keep the freed Caïd out of the toolbox's safety radius
    freed[0]!.pos = C(24, 44);
    freed[0]!.nextAttackAt = 1e9;
    sim.toolboxes.carried = true;
    sim.player.pos = { ...DOOR() };
    let ev = [...sim.step(IDLE), ...sim.step(PRESS)];
    for (let i = 0; i < (CONFIG.kit.repairSec + 0.2) * 60; i++) {
      freed[0]!.pos = C(24, 44);
      ev.push(...sim.step(IDLE));
    }
    expect(of(ev, 'TargetRepaired').map((e) => e.target)).toContain('prison');
    expect(sim.targets.get('prison')).toMatchObject({ state: 'intact', hp: 240 });
    expect(freed[0]!.state).not.toBe('ko');
    expect(sim.snapshot().prison).toMatchObject({ standing: true, jailed: 0 });
    ev = koCaid(sim);
    expect(of(ev, 'CaidJailed')).toHaveLength(1);
  });
});

describe('inmates (who is in the cells)', () => {
  test('each jailed Caïd is an inmate: a stable id, his variant on the map, the round he was jailed; jailed = their count', () => {
    const { sim } = quiet();
    sim.director.round = 6;
    expect(sim.snapshot().prison.inmates).toEqual([]);
    koCaid(sim, 6, C(8, 12), 'palestinian');
    sim.director.round = 7;
    koCaid(sim, 7, C(9, 12), 'classic');
    koCaid(sim, 7, C(10, 12), 'antifa');
    const p = sim.snapshot().prison;
    expect(p.inmates.map((i) => [i.variant, i.round])).toEqual([
      ['palestinian', 6],
      ['classic', 7],
      ['antifa', 7],
    ]);
    expect(p.jailed).toBe(p.inmates.length);
    const ids = p.inmates.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
    // stable: the same ids on later snapshots
    sim.step(IDLE);
    expect(sim.snapshot().prison.inmates.map((i) => i.id)).toEqual(ids);
    // the snapshot is a copy
    sim.snapshot().prison.inmates.pop();
    expect(sim.snapshot().prison.inmates).toHaveLength(3);
  });

  test('the jailed Caïd’s body is carried off by the van (gone from the horde after CONFIG.prison.pickupSec)', () => {
    const { sim, run } = quiet();
    koCaid(sim);
    const body = () => sim.horde.list.filter((h) => h.role === 'boss');
    // still lying there while the van drives up
    expect(body()).toHaveLength(1);
    run(CONFIG.prison.pickupSec - 0.1);
    expect(body()).toHaveLength(1);
    run(0.2);
    expect(body()).toHaveLength(0);
    expect(sim.snapshot().hostiles.some((h) => h.role === 'boss')).toBe(false);
    expect(sim.snapshot().prison.jailed).toBe(1);
  });

  test('a Caïd KO’d while the prison is ruined keeps lying there (no van)', () => {
    const { sim, run } = quiet();
    sim.targets.ruin('prison', 'test#1');
    sim.step(IDLE);
    koCaid(sim);
    run(CONFIG.prison.pickupSec + 0.5);
    expect(sim.horde.list.filter((h) => h.role === 'boss' && h.state === 'ko')).toHaveLength(1);
  });

  test('breakout: the released Caïds keep their variants; the cells empty', () => {
    const { sim } = quiet();
    koCaid(sim, 5, C(8, 12), 'palestinian');
    koCaid(sim, 5, C(9, 12), 'classic');
    koCaid(sim, 5, C(10, 12), 'palestinian');
    sim.targets.ruin('prison', 'test#1');
    sim.step(IDLE);
    const freed = sim.horde.list.filter((h) => h.role === 'boss' && h.state !== 'ko');
    expect(freed.map((h) => h.variant)).toEqual(['palestinian', 'classic', 'palestinian']);
    expect(sim.snapshot().prison).toMatchObject({ jailed: 0, inmates: [] });
  });

  test('inmate ids keep rising after a breakout and a rebuild (never reused)', () => {
    const { sim } = quiet();
    koCaid(sim);
    const first = sim.snapshot().prison.inmates[0]!.id;
    sim.targets.ruin('prison', 'test#1');
    sim.step(IDLE);
    sim.targets.repair('prison');
    sim.step(IDLE);
    koCaid(sim);
    expect(sim.snapshot().prison.inmates[0]!.id).toBeGreaterThan(first);
  });
});

describe('determinism', () => {
  test('same seed, same events and prison snapshot', () => {
    const play = (seed: number) => {
      const sim = new Sim(seed, { invulnerable: true });
      sim.director.round = 5;
      const ev: SimEvent[] = [];
      for (let i = 0; i < 40 * 60; i++) {
        if (i === 10 * 60) {
          koCaid(sim, 5);
          koCaid(sim, 5);
        }
        if (i === 20 * 60) sim.targets.ruin('prison', 'test#1');
        ev.push(...sim.step(IDLE));
      }
      return JSON.stringify({ ev, prison: sim.snapshot().prison, allies: sim.snapshot().allies });
    };
    expect(play(4)).toBe(play(4));
  });
});
