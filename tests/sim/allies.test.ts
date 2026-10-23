import { describe, expect, test, vi } from 'vitest';
import { Allies } from '../../src/sim/allies';
import { Horde, type HordeCtx } from '../../src/sim/hostiles';
import { FlowField } from '../../src/sim/map/flowfield';
import { createPlayer } from '../../src/sim/player';
import { Rocks } from '../../src/sim/projectiles';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, SimEvent, TargetId, Vec } from '../../src/sim/types';

const C = (tx: number, ty: number): Vec => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
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
const door = (id: TargetId) => DISTRICT.targets.find((t) => t.id === id)!.door;
const RED_FRONT = C(4, 23);
const BLUE_FRONT = C(5, 23);

/**
 * A quiet sim (the director silenced: no round, no rioter walks in) with Paul invulnerable at `pos`. `press()` = one
 * fresh Agir press; `run(n, until?)` steps idle up to n seconds and returns every event.
 */
function quiet(pos: Vec = RED_FRONT, seed = 7) {
  const sim = new Sim(seed, { invulnerable: true });
  vi.spyOn(sim.director, 'step').mockReturnValue([]);
  sim.player.pos = { ...pos };
  const press = (): SimEvent[] => [...sim.step(IDLE), ...sim.step(PRESS)];
  const run = (sec: number, until?: (ev: SimEvent[]) => boolean): SimEvent[] => {
    const all: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec * 60); i++) {
      const ev = sim.step(IDLE);
      all.push(...ev);
      if (until?.(ev)) break;
    }
    return all;
  };
  return { sim, press, run };
}

/** `n` active contact rioters around `at` that never strike. */
function crowd(sim: Sim, n: number, at: Vec): void {
  for (let i = 0; i < n; i++) {
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: at.x + (i % 4) * 16, y: at.y + Math.floor(i / 4) * 16 } })!;
    h.nextAttackAt = 1e9;
  }
}

describe('the fire truck', () => {
  test('a fire call brings the truck in from one of the rioters’ entry points; busy until it leaves, a refused call spends nothing', () => {
    const { sim, press } = quiet();
    sim.targets.ignite('car1', 'test#1');
    const ev = press();
    expect(of(ev, 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'fire' }]);
    const arrived = of(ev, 'TruckArrived');
    expect(arrived).toHaveLength(1);
    expect(DISTRICT.hostileSpawns).toContainEqual(arrived[0]!.from);
    expect(sim.services.active.fire).toBe(true);
    const s = sim.snapshot().allies.truck!;
    expect(s).toMatchObject({ hp: CONFIG.services.truck.hp, maxHp: CONFIG.services.truck.hp, state: 'arriving' });
    expect(sim.snapshot().services.hint.fire).toBe(false);
    // a second call while it is on the map: refused, nothing spent
    const again = press();
    expect(of(again, 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'fire', reason: 'busy' }]);
    expect(sim.services.calls.fire).toBe(CONFIG.services.calls - 1);
    expect(of(again, 'TruckArrived')).toHaveLength(0);
  });

  test('drives to the burning target, puts it out without refilling its hp, scores as Paul’s extinguish, then leaves', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'car1#3');
    sim.targets.get('car1').hp = 25;
    press();
    const score0 = sim.rules.score;
    const ev = run(40, (e) => of(e, 'TruckLeft').length > 0);
    expect(of(ev, 'TruckSprayed')).toContainEqual({ type: 'TruckSprayed', target: 'car1' });
    expect(of(ev, 'FireOut')).toEqual([{ type: 'FireOut', target: 'car1' }]);
    // no repair: no TargetRepaired, the hp left are kept
    expect(of(ev, 'TargetRepaired')).toHaveLength(0);
    expect(sim.targets.get('car1')).toMatchObject({ burning: false, hp: 25, state: 'intact' });
    expect(sim.rules.score - score0).toBe(CONFIG.casse.scores.car[2]);
    expect(of(ev, 'ScoreChanged')).toEqual([{ type: 'ScoreChanged', points: CONFIG.casse.scores.car[2], pos: door('car1') }]);
    // it left by an edge: off the map, no longer busy
    expect(of(ev, 'TruckLeft')).toHaveLength(1);
    expect(sim.snapshot().allies.truck).toBeNull();
    expect(sim.services.active.fire).toBe(false);
  });

  test('the same fire put out again cannot score twice (key shared with the toolbox)', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'car1#3');
    sim.rules.award('car1#3:extinguished', CONFIG.casse.scores.car[2]);
    const score0 = sim.rules.score;
    press();
    run(40, (e) => of(e, 'FireOut').length > 0);
    expect(sim.targets.get('car1').burning).toBe(false);
    expect(sim.rules.score).toBe(score0);
  });

  test('goes to the nearest burning target by the street graph first', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'a#1');
    sim.targets.ignite('car2', 'b#1');
    press();
    const truck = sim.allies.truck!;
    const first = truck.target;
    expect(first === 'car1' || first === 'car2').toBe(true);
    // the other target is not nearer by path from where the truck came in
    const steps = (id: TargetId) => sim.allies.pathSteps(truck.pos, id);
    expect(steps(first!)).toBeLessThanOrEqual(steps(first === 'car1' ? 'car2' : 'car1'));
    const ev = run(60, (e) => of(e, 'TruckLeft').length > 0);
    expect(of(ev, 'FireOut').map((e) => e.target)).toEqual([first, first === 'car1' ? 'car2' : 'car1']);
  });

  test('puts out adjacent fires at once from one parking spot (the two booths)', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('boothRed', 'r#1');
    sim.targets.ignite('boothBlue', 'b#1');
    press();
    const ev = run(40, (e) => of(e, 'FireOut').length > 0);
    const more = run(1);
    const outs = [...of(ev, 'FireOut'), ...of(more, 'FireOut')].map((e) => e.target).sort();
    expect(outs).toEqual(['boothBlue', 'boothRed']);
    // both on the same step: one parked spray reaches both doors
    expect(of(ev, 'FireOut')).toHaveLength(2);
    const sprayed = of(ev, 'TruckSprayed')
      .map((e) => e.target)
      .sort();
    expect(sprayed).toEqual(['boothBlue', 'boothRed']);
  });

  test('nothing burning any more when it gets there: it leaves at once, no points', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'c#1');
    press();
    run(1);
    // Paul's toolbox (here: by hand) puts it out first
    sim.targets.extinguish('car1');
    const score0 = sim.rules.score;
    run(1 / 60);
    expect(sim.allies.truck!.state).toBe('leaving');
    expect(sim.allies.truck!.target).toBeNull();
    const ev = run(40, (e) => of(e, 'TruckLeft').length > 0);
    expect(of(ev, 'TruckSprayed')).toHaveLength(0);
    expect(of(ev, 'TruckLeft')).toHaveLength(1);
    expect(sim.rules.score).toBe(score0);
  });

  test('a target ruined on the way: no crash, it picks the next fire or leaves', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'c#1');
    sim.targets.ignite('car2', 'd#1');
    press();
    const first = sim.allies.truck!.target!;
    run(0.5);
    sim.targets.ruin(first, 'c#1');
    run(1 / 60);
    const other = first === 'car1' ? 'car2' : 'car1';
    expect(sim.allies.truck!.target).toBe(other);
    sim.targets.ruin(other, 'd#1');
    run(1 / 60);
    expect(sim.allies.truck!.state).toBe('leaving');
  });

  test('at most CONFIG.services.truck.maxStaySec on the map: then it leaves, even with fires left', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'c#1');
    press();
    run(1);
    expect(CONFIG.services.truck.maxStaySec).toBe(60);
    sim.allies.truck!.elapsed = CONFIG.services.truck.maxStaySec;
    run(1 / 60);
    expect(sim.allies.truck!.state).toBe('leaving');
    expect(sim.targets.get('car1').burning).toBe(true);
  });

  test('destroyed by rioters: TruckDestroyed, the call stays spent, nothing put out afterward, a new call is possible', () => {
    const { sim, press, run } = quiet();
    sim.targets.ignite('car1', 'c#1');
    press();
    // parked and spraying (a fire takes 1 / sprayRate s), then rioters around it, Paul far away: they go for the truck
    run(40, (e) => of(e, 'TruckSprayed').length > 0);
    const truck = sim.allies.truck!;
    expect(truck.state).toBe('spraying');
    truck.hp = 6;
    for (let i = 0; i < 3; i++)
      sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: truck.pos.x + 6 + i * 3, y: truck.pos.y } });
    const ev = run(1 / CONFIG.services.truck.sprayRate - 0.1, (e) => of(e, 'TruckDestroyed').length > 0);
    expect(of(ev, 'TruckDestroyed')).toHaveLength(1);
    expect(sim.allies.truck).toBeNull();
    expect(sim.snapshot().allies.truck).toBeNull();
    expect(sim.services.active.fire).toBe(false);
    expect(sim.services.calls.fire).toBe(CONFIG.services.calls - 1);
    expect(sim.player.hp).toBe(CONFIG.player.maxHp);
    const later = run(5);
    expect(of(later, 'FireOut')).toHaveLength(0);
    expect(sim.targets.get('car1').burning).toBe(true);
    // the rioters turn back to Paul; a new call is accepted (busy is over)
    sim.horde.dismiss(() => true);
    const again = press();
    expect(of(again, 'ServiceCalled')).toHaveLength(1);
    expect(sim.services.calls.fire).toBe(CONFIG.services.calls - 2);
  });
});

describe('rioters’ choice of foe', () => {
  test('a rioter after Paul goes for the truck when it is nearer and within 160 px; beyond, Paul', () => {
    const { sim, press } = quiet();
    sim.targets.ignite('car1', 'c#1');
    press();
    const truck = sim.allies.truck!;
    expect(CONFIG.services.hostileTargetRadius).toBe(160);
    const pos = (h: { pos: Vec }) => ({ ...h.pos });
    // put the truck on an open street far from Paul
    truck.pos = C(20, 22);
    truck.state = 'leaving';
    const near = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: truck.pos.x + 100, y: truck.pos.y } })!;
    const far = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: truck.pos.x, y: truck.pos.y - 200 } })!;
    near.nextAttackAt = far.nextAttackAt = 1e9;
    const truckAt = pos(truck);
    const n0 = pos(near);
    const f0 = pos(far);
    // freeze the truck for the check
    vi.spyOn(sim.allies, 'step').mockReturnValue([]);
    for (let i = 0; i < 20; i++) sim.step(IDLE);
    expect(hyp(near.pos, truckAt)).toBeLessThan(hyp(n0, truckAt));
    // the far one walks toward Paul (west), not toward the truck
    expect(hyp(far.pos, sim.player.pos)).toBeLessThan(hyp(f0, sim.player.pos));
  });

  test('a degrader bound to its place keeps degrading next to an officer (allies never pull it off)', () => {
    const grid = new Grid(DISTRICT);
    const horde = new Horde();
    const player = createPlayer(C(40, 40));
    const def = DISTRICT.targets.find((t) => t.id === 'car1')!;
    const field = new FlowField(grid);
    const pt = def.attackPoints[0]!;
    const h = horde.spawn({ variant: 'classic', role: 'degrader', pos: { ...pt }, site: 'car1' })!;
    const hit = vi.fn();
    const ctx: HordeCtx = {
      player,
      grid,
      fields: { player: new FlowField(grid), victim: null },
      rocks: new Rocks(grid),
      sites: { car1: { points: def.attackPoints, door: def.door, standing: true, field } },
      victimPos: null,
      pressure: 0,
      allies: { list: [{ id: 1, pos: { x: pt.x, y: pt.y + 20 }, r: 7 }], hit },
    };
    for (let i = 0; i < 120; i++) horde.step(1 / 60, i / 60, ctx);
    expect(h.target).toBe('facade');
    expect(h.state).toBe('degrade');
    expect(hit).not.toHaveBeenCalled();
  });
});

describe('the police', () => {
  test('five officers come in when called with 8+ rioters, KO rioters (+1 each, no energy), then leave after 40 s', () => {
    const { sim, press, run } = quiet(BLUE_FRONT);
    crowd(sim, 10, C(20, 22));
    const ev0 = press();
    expect(of(ev0, 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'police' }]);
    const arrived = of(ev0, 'PoliceArrived');
    expect(arrived).toHaveLength(1);
    expect(arrived[0]!.count).toBe(5);
    expect(DISTRICT.hostileSpawns).toContainEqual(arrived[0]!.from);
    expect(sim.snapshot().allies.police).toHaveLength(5);
    expect(sim.services.active.police).toBe(true);
    expect(of(press(), 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'police', reason: 'busy' }]);
    const score0 = sim.rules.score;
    const kos0 = sim.rules.kos;
    const ev = run(CONFIG.services.police.staySec + 1, (e) => of(e, 'PoliceLeft').length > 0);
    const kos = sim.rules.kos - kos0;
    expect(kos).toBeGreaterThan(0);
    expect(sim.rules.score - score0).toBe(kos);
    expect(of(ev, 'ActorKnockedOut').length).toBe(kos);
    expect(sim.energy.value).toBe(0);
    expect(of(ev, 'PoliceLeft')).toHaveLength(1);
    expect(sim.snapshot().allies.police).toHaveLength(0);
    expect(sim.services.active.police).toBe(false);
  });

  test('stays CONFIG.services.police.staySec (40 s) when nobody knocks them out', () => {
    const { sim, press, run } = quiet(BLUE_FRONT);
    crowd(sim, 8, C(14, 44));
    press();
    const t0 = sim.now;
    // the rioters are KO'd quickly or not, the group stays its time
    const ev = run(CONFIG.services.police.staySec + 1, (e) => of(e, 'PoliceLeft').length > 0);
    expect(of(ev, 'PoliceLeft')).toHaveLength(1);
    expect(sim.now - t0).toBeGreaterThanOrEqual(CONFIG.services.police.staySec - 1e-6);
    expect(sim.now - t0).toBeLessThan(CONFIG.services.police.staySec + 0.1);
  });

  test('rioters knock officers out (PoliceDown); all down, the group is gone and police can be called again', () => {
    const { sim, press, run } = quiet(BLUE_FRONT);
    crowd(sim, 8, C(14, 44));
    press();
    // the officers (the prison guards are fighters too)
    const ids = sim.allies.fighters.filter((f) => f.role === 'police').map((f) => f.id);
    // every officer takes a blow (as from a rioter)
    const ev: SimEvent[] = [];
    for (const id of ids) ev.push(...sim.allies.damage(id, CONFIG.hostile.contactDamage));
    const downs = of(ev, 'PoliceDown').map((e) => e.id);
    expect(downs.sort()).toEqual([...ids].sort());
    expect(sim.snapshot().allies.police.every((p) => p.state === 'down')).toBe(true);
    const later = run(CONFIG.services.police.downSec + 0.5, (e) => of(e, 'PoliceLeft').length > 0);
    expect(of(later, 'PoliceLeft')).toHaveLength(1);
    expect(sim.services.active.police).toBe(false);
    expect(of(press(), 'ServiceCalled')).toHaveLength(1);
  });

  test('a rioter’s blow in play knocks an officer out', () => {
    const { sim, press, run } = quiet(BLUE_FRONT);
    crowd(sim, 8, C(14, 44));
    press();
    const o = sim.allies.fighters.find((f) => f.role === 'police')!;
    // brutes take two baton blows: they strike back
    for (let i = 0; i < 3; i++) sim.horde.spawn({ variant: 'classic', role: 'brute', pos: { x: o.pos.x + 12, y: o.pos.y + i * 6 } });
    const ev = run(10, (e) => of(e, 'PoliceDown').length > 0);
    expect(of(ev, 'PoliceDown').length).toBeGreaterThan(0);
    expect(sim.player.hp).toBe(CONFIG.player.maxHp);
  });

  test('an officer with a post only chases rioters within its radius and walks back to it', () => {
    const grid = new Grid(DISTRICT);
    const allies = new Allies(grid, rng(1));
    const post = { pos: C(20, 22), radius: 96 };
    const f = allies.addFighter('police', { ...post.pos }, { hp: 3, post });
    expect(f).toMatchObject({ role: 'police', hp: 3, maxHp: 3, post });
    const horde = new Horde();
    const outside = horde.spawn({ variant: 'classic', role: 'contact', pos: { x: post.pos.x + 200, y: post.pos.y } })!;
    outside.nextAttackAt = 1e9;
    const ctx = { horde, targets: null as never, rules: null as never, strike: () => {}, now: 0 };
    for (let i = 0; i < 60; i++) allies.step(1 / 60, { ...ctx, now: i / 60 });
    expect(hyp(f.pos, post.pos)).toBeLessThan(4);
    expect(f.quarry).toBeNull();
    f.pos = { x: post.pos.x + 40, y: post.pos.y };
    for (let i = 0; i < 60; i++) allies.step(1 / 60, { ...ctx, now: 1 + i / 60 });
    expect(hyp(f.pos, post.pos)).toBeLessThan(8);
  });
});

describe('determinism', () => {
  test('same seed and inputs: same arrival edges and outcomes', () => {
    const play = (seed: number) => {
      const { sim, press, run } = quiet(RED_FRONT, seed);
      sim.targets.ignite('car2', 'x#1');
      crowd(sim, 9, C(20, 22));
      const ev = [...press(), ...run(3)];
      sim.player.pos = { ...BLUE_FRONT };
      ev.push(...press(), ...run(20));
      return JSON.stringify({ ev, snap: sim.snapshot().allies, score: sim.rules.score });
    };
    expect(play(11)).toEqual(play(11));
    const edges = new Set<string>();
    for (let s = 1; s <= 12; s++) {
      const { sim, press } = quiet(RED_FRONT, s);
      sim.targets.ignite('car2', 'x#1');
      edges.add(JSON.stringify(of(press(), 'TruckArrived')[0]!.from));
    }
    expect(edges.size).toBeGreaterThan(1);
  });
});
