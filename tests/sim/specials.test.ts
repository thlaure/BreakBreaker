import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { FirePatches } from '../../src/sim/firepatch';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer, type HostileView } from '../../src/sim/player';
import { Rocks, type RockCtx } from '../../src/sim/projectiles';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import { beam } from '../../src/sim/specials';
import type { InputFrame, SimEvent, Vec } from '../../src/sim/types';
import { heldOf, isSpecial, spawnSpecials, WEAPONS, Weapons } from '../../src/sim/weapons';
import { autopilot } from './autopilot';

const grid = new Grid(DISTRICT);
const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: false };
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const STEPS = (sec: number): number => Math.round(sec / CONFIG.step);
const DT = CONFIG.step;
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const view = (lifeId: number, pos: Vec): HostileView => ({ lifeId, pos, r: CONFIG.hostile.radius, active: true });
const at = (deg: number, d: number, from: Vec): Vec => ({
  x: from.x + Math.cos((deg * Math.PI) / 180) * d,
  y: from.y + Math.sin((deg * Math.PI) / 180) * d,
});

/** A rioter that stays put and never attacks during the test. */
function calm(sim: Sim, pos: Vec) {
  const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos })!;
  h.nextAttackAt = 1e9;
  return h;
}

/* ------------------------------------------------------------------ bouclier ------------------------------------------------------------------ */

describe('bouclier: blocking', () => {
  const paul: Vec = { x: 656, y: 720 };
  const R = CONFIG.player.radius;
  const ctx = (shield: boolean, over: Partial<RockCtx['player']> = {}): RockCtx => ({
    player: { pos: paul, r: R, invulnerable: false, shield, ...over },
    hostiles: [],
    groupBlocks: () => null,
    victimPos: null,
  });
  /** A rock thrown at Paul from `deg` (direction from Paul toward the thrower), 120 px away. */
  const throwAt = (deg: number, c: RockCtx): SimEvent[] => {
    const rocks = new Rocks(grid);
    const from = at(deg, 120, paul);
    const to = at(deg + 180, 60, paul);
    rocks.spawnEnemy(from, to, 0);
    const ev: SimEvent[] = [];
    for (let i = 0, now = 0; i < 120; i++) ev.push(...rocks.step(DT, (now += DT), c));
    return ev;
  };

  test('a bubble: a rock is blocked from the front, the sides and behind (any facing): no damage, recoverable rock, ShieldBlocked', () => {
    for (const deg of [0, 45, 90, 135, 180, -135, -90, -45]) {
      const ev = throwAt(deg, ctx(true));
      expect(of(ev, 'ShieldBlocked'), `deg ${deg}`).toHaveLength(1);
      expect(of(ev, 'PlayerDamaged'), `deg ${deg}`).toEqual([]);
    }
    // without the bubble the same rocks hurt
    for (const deg of [0, 90, 180]) expect(of(throwAt(deg, ctx(false)), 'PlayerDamaged')).toHaveLength(1);
  });

  test('a blocked rock lands recoverable at the hit point (on Paul: picked up at once)', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(at(180, 120, paul), at(0, 60, paul), 0);
    const ev: SimEvent[] = [];
    for (let i = 0, now = 0; i < 120; i++) ev.push(...rocks.step(DT, (now += DT), ctx(true, { pos: { ...paul } })));
    expect(of(ev, 'PlayerDamaged')).toEqual([]);
    const blocked = of(ev, 'ShieldBlocked');
    expect(blocked).toHaveLength(1);
    expect(Math.hypot(blocked[0]!.pos.x - paul.x, blocked[0]!.pos.y - paul.y)).toBeLessThanOrEqual(R + 1e-6);
    expect(of(ev, 'ProjectileLanded')).toHaveLength(1);
    expect(rocks.ground().length + rocks.carried).toBe(1);
  });

  test('a rock that would miss Paul is not stopped by the bubble', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy({ x: paul.x + 120, y: paul.y + 30 }, { x: paul.x - 60, y: paul.y + 30 }, 0);
    const ev: SimEvent[] = [];
    for (let i = 0, now = 0; i < 120; i++) ev.push(...rocks.step(DT, (now += DT), ctx(true)));
    expect(of(ev, 'ShieldBlocked')).toEqual([]);
    expect(of(ev, 'PlayerDamaged')).toEqual([]);
  });

  test('a firebomb landing on Paul fizzles from any side (no patch); one landing away still lights its patch', () => {
    const hurt = (): boolean => true;
    for (const deg of [0, 90, 180, -90]) {
      const f = new FirePatches();
      f.throwBottle(at(deg, 150, paul), { ...paul }, 0.5);
      const ev = f.step(0.6, grid, paul, hurt, true);
      expect(of(ev, 'ShieldBlocked'), `deg ${deg}`).toHaveLength(1);
      // the block is reported on Paul's rim, toward the thrower
      const b = of(ev, 'ShieldBlocked')[0]!.pos;
      expect(Math.hypot(b.x - paul.x, b.y - paul.y)).toBeCloseTo(R, 6);
      expect(of(ev, 'FirePatchStarted')).toEqual([]);
      expect(f.list).toHaveLength(0);
    }
    const away = new FirePatches();
    away.throwBottle(at(0, 150, paul), at(0, 80, paul), 0.5);
    const ev2 = away.step(0.6, grid, paul, hurt, true);
    expect(of(ev2, 'ShieldBlocked')).toEqual([]);
    expect(of(ev2, 'FirePatchStarted')).toHaveLength(1);
  });

  test('fire patches on the ground and contact blows are not blocked', () => {
    const sim = new Sim(5);
    sim.weapons.startShield();
    const p = sim.player.pos;
    sim.player.facing = { x: 1, y: 0 };
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 14, y: p.y } })!;
    h.state = 'windup';
    h.stateUntil = 0;
    h.nextAttackAt = 99;
    expect(of(sim.step(IDLE), 'PlayerDamaged')).toHaveLength(1);

    const s2 = new Sim(5);
    s2.weapons.startShield();
    s2.firePatches.list.push({ id: 1, pos: { ...s2.player.pos }, until: 99 });
    expect(of(s2.step(IDLE), 'PlayerDamaged')).toHaveLength(1);
  });

  test('in the Sim, rocks thrown at Paul from in front, the side and behind are all blocked by the bubble', () => {
    for (const [dx, dy] of [[100, 0], [0, 100], [-100, 0]] as const) {
      const sim = new Sim(5);
      sim.weapons.startShield();
      sim.player.facing = { x: 1, y: 0 };
      const p = sim.player.pos;
      sim.rocks.spawnEnemy({ x: p.x + dx, y: p.y + dy }, { x: p.x - dx * 0.6, y: p.y - dy * 0.6 }, 0);
      const ev: SimEvent[] = [];
      for (let i = 0; i < 60; i++) ev.push(...sim.step(IDLE));
      expect(of(ev, 'ShieldBlocked'), `${dx},${dy}`).toHaveLength(1);
      expect(of(ev, 'PlayerDamaged')).toEqual([]);
      expect(sim.player.hp).toBe(CONFIG.player.maxHp);
    }
  });

  test('the bubble is deterministic: same seed, same blocks', () => {
    const run = () => {
      const sim = new Sim(9, { invulnerable: false });
      sim.weapons.startShield();
      const p = { ...sim.player.pos };
      const out: SimEvent[] = [];
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        sim.rocks.spawnEnemy({ x: p.x + Math.cos(a) * 90, y: p.y + Math.sin(a) * 90 }, { x: p.x - Math.cos(a) * 40, y: p.y - Math.sin(a) * 40 }, 0);
      }
      for (let i = 0; i < 90; i++) out.push(...sim.step(IDLE));
      return of(out, 'ShieldBlocked');
    };
    const a = run();
    expect(a).toHaveLength(4);
    expect(run()).toEqual(a);
  });
});

describe('bouclier: protection only, on top of the held weapon', () => {
  test('the bouclier has no bash tunables any more', () => {
    expect(Object.keys(CONFIG.bouclier).sort()).toEqual(['dropFromRound', 'dropShare', 'durationSec', 'spawnFromRound', 'spawnShare']);
  });

  test('pickup starts the 20 s protection timer and keeps the held weapon and its uses; WeaponPickedUp', () => {
    const w = new Weapons(grid, rng(1));
    const paul = createPlayer({ x: 656, y: 720 });
    w.held = { kind: 'baton', uses: 7 };
    w.ground.push({ id: 1, kind: 'bouclier', pos: { x: 660, y: 720 }, expiresAt: null });
    expect(w.step(DT, 0, paul)).toContainEqual({ type: 'WeaponPickedUp', kind: 'bouclier' });
    expect(w.held).toEqual({ kind: 'baton', uses: 7 });
    expect(w.shieldLeft).toBe(CONFIG.bouclier.durationSec);
    expect(w.shield()).toBe(true);
  });

  test('bare hands stay bare hands with the bouclier on', () => {
    const w = new Weapons(grid, rng(1));
    const paul = createPlayer({ x: 656, y: 720 });
    w.ground.push({ id: 1, kind: 'bouclier', pos: { x: 660, y: 720 }, expiresAt: null });
    w.step(DT, 0, paul);
    expect(w.held).toBeNull();
    expect(w.range()).toBe(CONFIG.melee.range);
  });

  test('a regular weapon picked up while the bouclier is on replaces the weapon, the protection goes on', () => {
    const w = new Weapons(grid, rng(1));
    const paul = createPlayer({ x: 656, y: 720 });
    w.startShield();
    w.step(5, 5, paul);
    w.ground.push({ id: 2, kind: 'panneau', pos: { x: 660, y: 720 }, expiresAt: null });
    w.step(DT, 5 + DT, paul);
    expect(w.held).toEqual({ kind: 'panneau', uses: WEAPONS.panneau.uses });
    expect(w.shieldLeft).toBeCloseTo(CONFIG.bouclier.durationSec - 5 - DT, 6);
  });

  test('a second bouclier resets the timer to 20 s', () => {
    const w = new Weapons(grid, rng(1));
    const paul = createPlayer({ x: 656, y: 720 });
    w.startShield();
    w.step(12, 12, paul);
    expect(w.shieldLeft).toBeCloseTo(CONFIG.bouclier.durationSec - 12, 6);
    w.ground.push({ id: 3, kind: 'bouclier', pos: { x: 660, y: 720 }, expiresAt: null });
    w.step(DT, 12 + DT, paul);
    expect(w.shieldLeft).toBeCloseTo(CONFIG.bouclier.durationSec, 6);
  });

  test('no bash: Frapper with the bouclier is Paul’s normal strike (bare hands: 1 damage, no knockback, bare-hands reach)', () => {
    const sim = new Sim(5);
    sim.weapons.startShield();
    const p = { ...sim.player.pos };
    const h = calm(sim, { x: p.x + 40, y: p.y });
    const before = { ...h.pos };
    const ev = sim.step(input({ strike: true }));
    expect(of(ev, 'HitConfirmed')).toEqual([{ type: 'HitConfirmed', targetLifeId: h.lifeId, damage: 1, source: 'melee' }]);
    expect(h.state).not.toBe('ko');
    expect(h.hp).toBe(h.maxHp - 1);
    // not pushed away (it may only have stepped toward Paul)
    expect(h.pos.x).toBeLessThanOrEqual(before.x + 1e-9);
    // out of bare-hands reach (the old 64 px bash reach): no hit
    const s2 = new Sim(5);
    s2.weapons.startShield();
    const q = s2.player.pos;
    const far = calm(s2, { x: q.x + CONFIG.melee.range + CONFIG.hostile.radius + 2, y: q.y });
    expect(of(s2.step(input({ strike: true })), 'HitConfirmed')).toEqual([]);
    expect(far.hp).toBe(far.maxHp);
  });

  test('with a held weapon and the bouclier, a strike is the weapon’s strike: one-hit KO at its reach, one use spent, no knockback', () => {
    const sim = new Sim(5);
    sim.weapons.held = { kind: 'baton', uses: 5 };
    sim.weapons.startShield();
    const p = { ...sim.player.pos };
    const h = calm(sim, { x: p.x + WEAPONS.baton.range - 2, y: p.y });
    const before = { ...h.pos };
    sim.step(input({ strike: true }));
    expect(h.state).toBe('ko');
    expect(h.pos).toEqual(before);
    expect(sim.weapons.held).toEqual({ kind: 'baton', uses: 4 });
    expect(sim.weapons.shield()).toBe(true);
    expect(sim.snapshot().weapon).toEqual({ kind: 'baton', uses: 4 });
    expect(sim.snapshot().shield).not.toBeNull();
  });

  test('the flashball still shoots with the bouclier on', () => {
    const sim = new Sim(5);
    sim.weapons.held = { kind: 'flashball', uses: 6 };
    sim.weapons.startShield();
    const ev = sim.step(input({ strike: true, aim: { x: 1, y: 0 } }));
    expect(of(ev, 'FlashballFired')).toHaveLength(1);
    expect(sim.weapons.held?.uses).toBe(5);
  });

  test('expires after 20 s of active time (ShieldEnded), the held weapon stays; pause freezes it; snapshot shield', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.weapons.held = { kind: 'marteau', uses: 3 };
    sim.weapons.startShield();
    const all: SimEvent[] = [];
    for (let i = 0; i < STEPS(10); i++) all.push(...sim.step(IDLE));
    const left = sim.snapshot().shield!.secondsLeft;
    expect(left).toBeCloseTo(CONFIG.bouclier.durationSec - 10, 3);
    sim.pause();
    for (let i = 0; i < STEPS(30); i++) sim.step(IDLE);
    expect(sim.snapshot().shield!.secondsLeft).toBe(left);
    sim.resume();
    for (let i = 0; i < STEPS(10) - 2; i++) all.push(...sim.step(IDLE));
    expect(sim.weapons.shield()).toBe(true);
    for (let i = 0; i < 4; i++) all.push(...sim.step(IDLE));
    expect(sim.weapons.shield()).toBe(false);
    expect(sim.snapshot().shield).toBeNull();
    expect(of(all, 'ShieldEnded')).toHaveLength(1);
    expect(of(all, 'WeaponBroken')).toEqual([]);
    expect(sim.weapons.held).toEqual({ kind: 'marteau', uses: 3 });
  });

  test('ends when Paul is KO’d', () => {
    const sim = new Sim(5);
    sim.weapons.startShield();
    sim.player.hp = 1;
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: sim.player.pos.x + 14, y: sim.player.pos.y } })!;
    h.state = 'windup';
    h.stateUntil = 0;
    h.nextAttackAt = 99;
    const ev = sim.step(IDLE);
    expect(sim.player.ko).toBe(true);
    expect(of(ev, 'ShieldEnded')).toHaveLength(1);
    expect(sim.weapons.shield()).toBe(false);
    expect(sim.snapshot().shield).toBeNull();
  });
});

/* ------------------------------------------------------------------ kamehame ------------------------------------------------------------------ */

describe('onde d’énergie: beam geometry', () => {
  test('KOs every rioter within halfWidth + r of the line, not beyond its length or behind Paul', () => {
    const from = { x: 656, y: 720 };
    const t = [
      view(1, { x: 700, y: 720 }),
      view(2, { x: 800, y: 720 + CONFIG.kamehame.halfWidth + CONFIG.hostile.radius - 1 }),
      view(3, { x: 850, y: 720 + CONFIG.kamehame.halfWidth + CONFIG.hostile.radius + 2 }),
      view(4, { x: 600, y: 720 }),
      view(5, { x: 760, y: 714 }),
    ];
    const shot = beam(from, { x: 1, y: 0 }, t, grid);
    expect(shot.lifeIds).toEqual([1, 5, 2]);
  });

  test('stops at the first solid: a building, a prop (car) and the peaceful group', () => {
    // building: from the spawn, the first solid to the right is within the beam's length
    const from = { ...DISTRICT.playerSpawn };
    let wall = 0;
    while (!grid.isSolidPx({ x: from.x + wall, y: from.y })) wall += 1;
    expect(wall).toBeLessThan(CONFIG.kamehame.length);
    const b = beam(from, { x: 1, y: 0 }, [view(1, { x: from.x + wall - 30, y: from.y }), view(2, { x: from.x + wall + 40, y: from.y })], grid);
    expect(b.lifeIds).toEqual([1]);
    expect(b.to.x).toBeLessThan(from.x + wall);

    // prop: car1's footprint
    const car = DISTRICT.targets.find((x) => x.id === 'car1')!.footprint;
    const below = { x: car.x + car.w / 2, y: car.y + car.h + 60 };
    expect(grid.isSolidPx(below)).toBe(false);
    const c = beam(below, { x: 0, y: -1 }, [view(3, { x: below.x, y: car.y - 30 })], grid);
    expect(c.lifeIds).toEqual([]);
    expect(c.to.y).toBeGreaterThanOrEqual(car.y + car.h);

    // the peaceful group stops it and is never hit
    const g = DISTRICT.peacefulGroup.area;
    const left = { x: g.x - 60, y: g.y + g.h / 2 };
    expect(grid.isSolidPx(left)).toBe(false);
    const d = beam(left, { x: 1, y: 0 }, [view(4, { x: g.x + g.w + 30, y: left.y })], grid);
    expect(d.lifeIds).toEqual([]);
    expect(d.to.x).toBeLessThan(g.x);
  });
});

describe('onde d’énergie: charge and fire (Sim)', () => {
  const HOLD = input({ chargeHeld: true });
  const PRESS = HOLD;

  /** Paul facing right with a full energy gauge (two beams). */
  function armed(seed = 5): Sim {
    const sim = new Sim(seed);
    sim.energy.value = CONFIG.energy.max;
    sim.player.facing = { x: 1, y: 0 };
    return sim;
  }

  test('held 1 s: BeamCharging, then the beam fires on its own and KOs a whole line (+1 each, launched along it)', () => {
    const sim = armed();
    const p = { ...sim.player.pos };
    const all: SimEvent[] = [];
    all.push(...sim.step(PRESS));
    expect(of(all, 'BeamCharging')).toHaveLength(1);
    expect(sim.snapshot().charge).toEqual({ progress: 0 });
    for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec) - 1; i++) all.push(...sim.step(HOLD));
    expect(of(all, 'BeamFired')).toEqual([]);
    expect(sim.snapshot().charge!.progress).toBeGreaterThan(0.95);
    // three rioters lined up in front, one behind
    const line = [60, 120, 180].map((dx) => calm(sim, { x: p.x + dx, y: p.y }));
    const behind = calm(sim, { x: p.x - 60, y: p.y });
    const ev = sim.step(HOLD);
    const fired = of(ev, 'BeamFired');
    expect(fired).toHaveLength(1);
    expect(fired[0]!.kos).toBe(3);
    expect(fired[0]!.from).toEqual(p);
    for (const h of line) expect(h.state).toBe('ko');
    expect(behind.state).not.toBe('ko');
    expect(sim.rules.kos).toBe(3);
    expect(sim.rules.score).toBe(3);
    for (const k of of(ev, 'ActorKnockedOut')) {
      expect(k.launch).toBeDefined();
      expect(k.launch!.dir.x).toBeGreaterThan(Math.cos(CONFIG.kamehame.satelliteJitter) - 1e-6);
      expect(k.launch!.kind).toBe('satellite');
    }
    expect(sim.energy.value).toBe(CONFIG.energy.max - CONFIG.energy.ondeCost);
    expect(sim.snapshot().charge).toBeNull();
    // still held: no new charge until the next press
    expect(of(sim.step(HOLD), 'BeamCharging')).toEqual([]);
  });

  test('released at 0.9 s: cancelled, nothing used, movement free again', () => {
    const sim = armed();
    const all: SimEvent[] = [sim.step(PRESS)].flat();
    for (let i = 0; i < STEPS(0.9) - 1; i++) all.push(...sim.step(HOLD));
    all.push(...sim.step(IDLE));
    expect(of(all, 'BeamCancelled')).toHaveLength(1);
    expect(of(all, 'BeamFired')).toEqual([]);
    expect(sim.energy.value).toBe(CONFIG.energy.max);
    const x = sim.player.pos.x;
    sim.step(input({ move: { x: 1, y: 0 } }));
    expect(sim.player.pos.x).toBeGreaterThan(x);
  });

  test('Paul cannot move while charging (aim still turns him)', () => {
    const sim = armed();
    sim.step(PRESS);
    const before = { ...sim.player.pos };
    for (let i = 0; i < 20; i++) sim.step(input({ chargeHeld: true, move: { x: 0, y: 1 }, run: true, aim: { x: 0, y: -1 } }));
    expect(sim.player.pos).toEqual(before);
    expect(sim.player.facing).toEqual({ x: 0, y: -1 });
  });

  test('taking damage cancels the charge (nothing used)', () => {
    const sim = armed();
    sim.step(PRESS);
    sim.step(HOLD);
    const p = sim.player.pos;
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x - 14, y: p.y } })!;
    h.state = 'windup';
    h.stateUntil = 0;
    h.nextAttackAt = 99;
    const ev = sim.step(HOLD);
    expect(of(ev, 'PlayerDamaged')).toHaveLength(1);
    expect(of(ev, 'BeamCancelled')).toHaveLength(1);
    expect(sim.snapshot().charge).toBeNull();
    for (let i = 0; i < STEPS(1.2); i++) expect(of(sim.step(HOLD), 'BeamFired')).toEqual([]);
    expect(sim.energy.value).toBe(CONFIG.energy.max);
  });

  test('a beam with no target still costs its energy; no weapon is involved', () => {
    const sim = armed();
    sim.weapons.held = heldOf('baton');
    const all: SimEvent[] = [];
    for (let shot = 0; shot < 2; shot++) {
      all.push(...sim.step(PRESS));
      for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec); i++) all.push(...sim.step(HOLD));
      all.push(...sim.step(IDLE));
    }
    expect(of(all, 'BeamFired').map((e) => e.kos)).toEqual([0, 0]);
    expect(sim.energy.value).toBe(0);
    expect(sim.weapons.held).toEqual(heldOf('baton'));
    expect(of(all, 'WeaponBroken')).toEqual([]);
  });

  test('the beam stops at a building and never reaches rioters behind the peaceful group', () => {
    const sim = armed();
    const g = DISTRICT.peacefulGroup.area;
    sim.player.pos = { x: g.x - 60, y: g.y + g.h / 2 };
    sim.step(PRESS);
    for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec) - 1; i++) sim.step(HOLD);
    const hidden = calm(sim, { x: g.x + g.w + 30, y: g.y + g.h / 2 });
    const ev = sim.step(HOLD);
    expect(of(ev, 'BeamFired')[0]!.to.x).toBeLessThan(g.x);
    expect(hidden.state).not.toBe('ko');
  });

  test('pause freezes the charge', () => {
    const sim = armed();
    sim.step(PRESS);
    for (let i = 0; i < 30; i++) sim.step(HOLD);
    const prog = sim.snapshot().charge!.progress;
    sim.pause();
    for (let i = 0; i < 120; i++) expect(sim.step(HOLD)).toEqual([]);
    expect(sim.snapshot().charge!.progress).toBe(prog);
    sim.resume();
    sim.step(HOLD);
    expect(sim.snapshot().charge!.progress).toBeGreaterThan(prog);
  });

  test('no melee swing on the step a charge starts nor while it grows', () => {
    const sim = armed();
    const p = sim.player.pos;
    const h = calm(sim, { x: p.x + 20, y: p.y });
    expect(of(sim.step(input({ chargeHeld: true, strike: true })), 'HitConfirmed')).toEqual([]);
    expect(of(sim.step(input({ chargeHeld: true, strike: true })), 'HitConfirmed')).toEqual([]);
    expect(h.state).not.toBe('ko');
  });
});

describe('onde d’énergie: satellisation (cosmetic launch payload)', () => {
  /** Charges and fires a beam through a line of `n` rioters; returns the KO events and the sim. */
  function shoot(seed: number, n = 4) {
    const sim = new Sim(seed);
    sim.energy.value = CONFIG.energy.ondeCost;
    sim.player.facing = { x: 1, y: 0 };
    const p = { ...sim.player.pos };
    sim.step(input({ chargeHeld: true }));
    for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec) - 1; i++) sim.step(input({ chargeHeld: true }));
    for (let i = 0; i < n; i++) calm(sim, { x: p.x + 40 + i * 50, y: p.y });
    const ev = sim.step(input({ chargeHeld: true }));
    return { sim, kos: of(ev, 'ActorKnockedOut') };
  }

  test('beam KOs are satellites: power 1100–1800 px, ±6–10 turns, along the beam; +1 each as usual', () => {
    const { sim, kos } = shoot(5);
    expect(kos).toHaveLength(4);
    for (const k of kos) {
      const l = k.launch!;
      expect(l.kind).toBe('satellite');
      expect(l.power).toBeGreaterThanOrEqual(CONFIG.kamehame.satellitePower[0]);
      expect(l.power).toBeLessThanOrEqual(CONFIG.kamehame.satellitePower[1]);
      expect(Math.abs(l.spin)).toBeGreaterThanOrEqual(CONFIG.kamehame.satelliteSpin[0]);
      expect(Math.abs(l.spin)).toBeLessThanOrEqual(CONFIG.kamehame.satelliteSpin[1]);
      expect(Math.hypot(l.dir.x, l.dir.y)).toBeCloseTo(1, 6);
      expect(l.dir.x).toBeGreaterThan(Math.cos(CONFIG.kamehame.satelliteJitter) - 1e-6);
    }
    expect(sim.rules.kos).toBe(4);
    expect(sim.rules.score).toBe(4);
  });

  test('deterministic per seed; different seeds differ', () => {
    expect(shoot(5).kos).toEqual(shoot(5).kos);
    expect(shoot(6).kos.map((k) => k.launch)).not.toEqual(shoot(5).kos.map((k) => k.launch));
  });

  test('furie strike KOs tumble; plain melee and rock KOs carry no launch', () => {
    const fur = new Sim(5);
    fur.weapons.furieLeft = 5;
    const p = fur.player.pos;
    calm(fur, { x: p.x + 30, y: p.y });
    const f = of(fur.step(input({ strike: true })), 'ActorKnockedOut');
    expect(f).toHaveLength(1);
    expect(f[0]!.launch!.kind).toBe('tumble');
    expect(f[0]!.launch!.power).toBeLessThanOrEqual(CONFIG.furie.launchPower[1]);

    const plain = new Sim(5);
    plain.weapons.held = heldOf('baton');
    calm(plain, { x: plain.player.pos.x + 30, y: plain.player.pos.y });
    const m = of(plain.step(input({ strike: true })), 'ActorKnockedOut');
    expect(m).toHaveLength(1);
    expect(m[0]!.launch).toBeUndefined();

    const rock = new Sim(5);
    const q = rock.player.pos;
    const h = calm(rock, { x: q.x + 80, y: q.y });
    h.hp = 1;
    rock.rocks.carried = 1;
    const all: SimEvent[] = [];
    all.push(...rock.step(input({ throwRock: true, aim: { x: 1, y: 0 } })));
    for (let i = 0; i < 30; i++) all.push(...rock.step(IDLE));
    const r = of(all, 'ActorKnockedOut');
    expect(r).toHaveLength(1);
    expect(r[0]!.launch).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ who drops them ------------------------------------------------------------------ */

describe('specials: the bouclier is the only special pickup', () => {
  test('isSpecial: only the bouclier', () => {
    expect(isSpecial('bouclier')).toBe(true);
    for (const k of Object.keys(WEAPONS)) expect(isSpecial(k as never)).toBe(false);
  });

  test('dropTwist: never a bouclier before round 3; from round 3 a seeded pick, about half boucliers; else a regular weapon or nothing', () => {
    for (const round of [1, 2]) {
      for (let seed = 1; seed <= 20; seed++) {
        const w = new Weapons(grid, rng(seed));
        const { drop, special } = w.dropTwist(DISTRICT.playerSpawn, round);
        expect(special).toBeNull();
        if (drop) expect(isSpecial(drop.kind)).toBe(false);
      }
    }
    for (const round of [3, 4, 5, 8]) {
      let shields = 0;
      const n = 200;
      for (let seed = 1; seed <= n; seed++) {
        const w = new Weapons(grid, rng(seed));
        const { drop, special } = w.dropTwist(DISTRICT.playerSpawn, round);
        if (drop) expect(drop.expiresAt).toBeCloseTo(CONFIG.weapons.dropLifetime, 6);
        if (special) {
          expect(special).toBe('bouclier');
          expect(drop!.kind).toBe('bouclier');
          shields++;
        } else if (drop) expect(Object.keys(WEAPONS)).toContain(drop.kind);
      }
      expect(shields / n).toBeGreaterThan(0.35);
      expect(shields / n).toBeLessThan(0.65);
    }
  });

  test('timed spawns: no bouclier before round 5; then about 1 in 6', () => {
    const share = (round: number) => {
      let shields = 0;
      let total = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const w = new Weapons(grid, rng(seed));
        const paul = createPlayer({ ...DISTRICT.playerSpawn });
        for (let t = 0; t < 400; t += 1) {
          for (const e of w.step(1, t, paul, round))
            if (e.type === 'WeaponSpawned') {
              total++;
              if (e.kind === 'bouclier') shields++;
            }
          w.ground.length = 0;
        }
      }
      return shields / total;
    };
    expect(share(4)).toBe(0);
    expect(spawnSpecials(4)).toEqual([]);
    expect(spawnSpecials(5)).toEqual(['bouclier']);
    const r7 = share(7);
    expect(r7).toBeGreaterThan(0.1);
    expect(r7).toBeLessThan(0.24);
  });

  test('in a session: a weapon-drop twist every round from 2; the special (bouclier only) matches the drop; deterministic', () => {
    const run = (seed: number) => {
      const sim = new Sim(seed, { invulnerable: true });
      const twists: { round: number; special: string | undefined; kind: string | undefined }[] = [];
      for (let i = 0; i < 60 * 1500 && sim.director.round <= 6; i++) {
        const ev = sim.step(autopilot(sim));
        const t = of(ev, 'TwistStarted').find((e) => e.kind === 'weaponDrop');
        if (!t) continue;
        const w = t.pos ? of(ev, 'WeaponSpawned').find((s) => s.pos.x === t.pos!.x && s.pos.y === t.pos!.y) : undefined;
        twists.push({ round: sim.director.round, special: t.special, kind: w?.kind });
      }
      return twists;
    };
    const seen = new Set<string | undefined>();
    for (const seed of [3, 4, 5, 6]) {
      const a = run(seed);
      expect(a.map((t) => t.round)).toEqual([2, 3, 4, 5, 6]);
      for (const t of a) {
        if (t.round < 3) expect(t.special).toBeUndefined();
        if (t.special) expect(t.special).toBe('bouclier');
        if (t.kind) expect(t.kind === 'bouclier').toBe(t.special === 'bouclier');
        if (t.round >= 3) seen.add(t.special);
      }
      if (seed === 3) expect(run(3)).toEqual(a);
    }
    // from round 3 both outcomes happen
    expect(seen.has('bouclier')).toBe(true);
    expect(seen.has(undefined)).toBe(true);
  });
});
