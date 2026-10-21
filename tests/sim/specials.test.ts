import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { FirePatches } from '../../src/sim/firepatch';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer, type HostileView } from '../../src/sim/player';
import { Rocks, type RockCtx } from '../../src/sim/projectiles';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import { beam, shieldBlocks } from '../../src/sim/specials';
import type { InputFrame, SimEvent, Vec } from '../../src/sim/types';
import { dropSpecials, heldOf, isSpecial, spawnSpecials, Weapons } from '../../src/sim/weapons';
import { autopilot } from './autopilot';

const grid = new Grid(DISTRICT);
const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, strikeHeld: false, throwRock: false, act: false };
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
  const ctx = (shield: Vec | null, over: Partial<RockCtx['player']> = {}): RockCtx => ({
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

  test('the front cone is ±60° (frontDeg 120)', () => {
    const facing = { x: 1, y: 0 };
    // travel = flight direction; the rock comes from −travel
    expect(shieldBlocks(facing, { x: -1, y: 0 })).toBe(true);
    expect(shieldBlocks(facing, at(180 + 55, 1, { x: 0, y: 0 }))).toBe(true);
    expect(shieldBlocks(facing, at(180 + 70, 1, { x: 0, y: 0 }))).toBe(false);
    expect(shieldBlocks(facing, { x: 1, y: 0 })).toBe(false);
  });

  test('a front rock is blocked: no damage, recoverable rock at the hit point, ShieldBlocked', () => {
    const rocks = new Rocks(grid);
    rocks.spawnEnemy(at(0, 120, paul), at(180, 60, paul), 0);
    const ev: SimEvent[] = [];
    for (let i = 0, now = 0; i < 120; i++) ev.push(...rocks.step(DT, (now += DT), ctx({ x: 1, y: 0 }, { pos: { ...paul } })));
    expect(of(ev, 'PlayerDamaged')).toEqual([]);
    const blocked = of(ev, 'ShieldBlocked');
    expect(blocked).toHaveLength(1);
    expect(Math.hypot(blocked[0]!.pos.x - paul.x, blocked[0]!.pos.y - paul.y)).toBeLessThanOrEqual(R + 1e-6);
    // landed recoverable where it was stopped (Paul stands on it: it is picked up at once)
    expect(of(ev, 'ProjectileLanded')).toHaveLength(1);
    expect(rocks.ground().length + rocks.carried).toBe(1);
  });

  test('a rock from behind or 70° off the facing hurts', () => {
    for (const deg of [180, 70, -70]) {
      const ev = throwAt(deg, ctx({ x: 1, y: 0 }));
      expect(of(ev, 'ShieldBlocked'), String(deg)).toEqual([]);
      expect(of(ev, 'PlayerDamaged'), `deg ${deg}`).toHaveLength(1);
    }
    for (const deg of [0, 50, -50]) {
      const ev = throwAt(deg, ctx({ x: 1, y: 0 }));
      expect(of(ev, 'ShieldBlocked')).toHaveLength(1);
      expect(of(ev, 'PlayerDamaged')).toEqual([]);
    }
  });

  test('a front firebomb fizzles (no patch); one from behind lights its patch', () => {
    const front = new FirePatches();
    front.throwBottle(at(0, 150, paul), { ...paul }, 0.5);
    const hurt = (): boolean => true;
    const ev1 = front.step(0.6, grid, paul, hurt, { x: 1, y: 0 });
    expect(of(ev1, 'ShieldBlocked')).toHaveLength(1);
    expect(of(ev1, 'FirePatchStarted')).toEqual([]);
    expect(front.list).toHaveLength(0);

    const back = new FirePatches();
    back.throwBottle(at(180, 150, paul), { ...paul }, 0.5);
    const ev2 = back.step(0.6, grid, paul, hurt, { x: 1, y: 0 });
    expect(of(ev2, 'ShieldBlocked')).toEqual([]);
    expect(of(ev2, 'FirePatchStarted')).toHaveLength(1);
  });

  test('fire patches on the ground and contact blows are not blocked', () => {
    const sim = new Sim(5);
    sim.weapons.held = heldOf('bouclier');
    const p = sim.player.pos;
    sim.player.facing = { x: 1, y: 0 };
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 14, y: p.y } })!;
    h.state = 'windup';
    h.stateUntil = 0;
    h.nextAttackAt = 99;
    expect(of(sim.step(IDLE), 'PlayerDamaged')).toHaveLength(1);

    const s2 = new Sim(5);
    s2.weapons.held = heldOf('bouclier');
    s2.firePatches.list.push({ id: 1, pos: { ...s2.player.pos }, until: 99 });
    expect(of(s2.step(IDLE), 'PlayerDamaged')).toHaveLength(1);
  });

  test('in the Sim, a rock thrown at Paul’s shield is blocked', () => {
    const sim = new Sim(5);
    sim.weapons.held = heldOf('bouclier');
    sim.player.facing = { x: 1, y: 0 };
    const p = sim.player.pos;
    sim.rocks.spawnEnemy({ x: p.x + 100, y: p.y }, { x: p.x - 60, y: p.y }, 0);
    const ev: SimEvent[] = [];
    for (let i = 0; i < 60; i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'ShieldBlocked')).toHaveLength(1);
    expect(of(ev, 'PlayerDamaged')).toEqual([]);
    expect(sim.player.hp).toBe(CONFIG.player.maxHp);
  });
});

describe('bouclier: bash, timer', () => {
  test('pickup holds the bouclier for 20 s; WeaponPickedUp', () => {
    const w = new Weapons(grid, rng(1));
    const paul = createPlayer({ x: 656, y: 720 });
    w.ground.push({ id: 1, kind: 'bouclier', pos: { x: 660, y: 720 }, expiresAt: null });
    expect(w.step(DT, 0, paul)).toContainEqual({ type: 'WeaponPickedUp', kind: 'bouclier' });
    expect(w.held).toEqual({ kind: 'bouclier', uses: 0, secondsLeft: CONFIG.bouclier.durationSec });
  });

  test('a bash KOs in one hit, knocks the body 24 px away and uses no charge', () => {
    const sim = new Sim(5);
    sim.weapons.held = heldOf('bouclier');
    const p = { ...sim.player.pos };
    const h = calm(sim, { x: p.x + 40, y: p.y });
    h.hp = h.maxHp = 5;
    const before = { ...h.pos };
    const ev = sim.step(input({ strike: true }));
    expect(h.state).toBe('ko');
    expect(of(ev, 'ActorKnockedOut')).toHaveLength(1);
    expect(h.pos.x - before.x).toBeCloseTo(CONFIG.bouclier.knockback, 0);
    expect(sim.rules.kos).toBe(1);
    expect(sim.weapons.held?.kind).toBe('bouclier');
    expect(of(ev, 'WeaponBroken')).toEqual([]);
  });

  test('bash reach is 64 px', () => {
    const sim = new Sim(5);
    sim.weapons.held = heldOf('bouclier');
    const p = sim.player.pos;
    const far = calm(sim, { x: p.x + CONFIG.bouclier.bashRange + CONFIG.hostile.radius + 6, y: p.y });
    sim.step(input({ strike: true }));
    expect(far.state).not.toBe('ko');
  });

  test('bash works in furie (more targets, launch)', () => {
    const sim = new Sim(5);
    sim.weapons.held = heldOf('bouclier');
    sim.weapons.furieLeft = 5;
    const p = sim.player.pos;
    for (let i = 0; i < 5; i++) calm(sim, at(i * 72, 40, p));
    const ev = sim.step(input({ strike: true }));
    const kos = of(ev, 'ActorKnockedOut');
    expect(kos.length).toBeGreaterThan(CONFIG.melee.maxTargets);
    for (const k of kos) expect(k.launch).toBeDefined();
    expect(sim.weapons.held?.kind).toBe('bouclier');
  });

  test('expires after 20 s of active time (WeaponBroken); pause freezes it', () => {
    const sim = new Sim(5, { invulnerable: true });
    sim.weapons.held = heldOf('bouclier');
    const all: SimEvent[] = [];
    for (let i = 0; i < STEPS(10); i++) all.push(...sim.step(IDLE));
    const left = sim.snapshot().weapon!.secondsLeft!;
    expect(left).toBeCloseTo(CONFIG.bouclier.durationSec - 10, 3);
    sim.pause();
    for (let i = 0; i < STEPS(30); i++) sim.step(IDLE);
    expect(sim.snapshot().weapon!.secondsLeft).toBe(left);
    sim.resume();
    for (let i = 0; i < STEPS(10) - 2; i++) all.push(...sim.step(IDLE));
    expect(sim.weapons.held?.kind).toBe('bouclier');
    for (let i = 0; i < 4; i++) all.push(...sim.step(IDLE));
    expect(sim.weapons.held).toBeNull();
    expect(all).toContainEqual({ type: 'WeaponBroken', kind: 'bouclier' });
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
  const HOLD = input({ strikeHeld: true });
  const PRESS = input({ strike: true, strikeHeld: true });

  function armed(seed = 5): Sim {
    const sim = new Sim(seed);
    sim.weapons.held = heldOf('kamehame');
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
    expect(sim.weapons.held).toEqual({ kind: 'kamehame', uses: CONFIG.kamehame.uses - 1 });
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
    expect(sim.weapons.held).toEqual({ kind: 'kamehame', uses: CONFIG.kamehame.uses });
    const x = sim.player.pos.x;
    sim.step(input({ move: { x: 1, y: 0 } }));
    expect(sim.player.pos.x).toBeGreaterThan(x);
  });

  test('Paul cannot move while charging (aim still turns him)', () => {
    const sim = armed();
    sim.step(PRESS);
    const before = { ...sim.player.pos };
    for (let i = 0; i < 20; i++) sim.step(input({ strikeHeld: true, move: { x: 0, y: 1 }, run: true, aim: { x: 0, y: -1 } }));
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
    expect(sim.weapons.held!.uses).toBe(CONFIG.kamehame.uses);
  });

  test('losing the weapon cancels the charge', () => {
    const sim = armed();
    sim.step(PRESS);
    sim.weapons.held = heldOf('baton');
    expect(of(sim.step(HOLD), 'BeamCancelled')).toHaveLength(1);
  });

  test('a beam with no target still uses one; the last use breaks the weapon', () => {
    const sim = armed();
    const all: SimEvent[] = [];
    for (let shot = 0; shot < CONFIG.kamehame.uses; shot++) {
      all.push(...sim.step(PRESS));
      for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec); i++) all.push(...sim.step(HOLD));
      all.push(...sim.step(IDLE));
    }
    expect(of(all, 'BeamFired').map((e) => e.kos)).toEqual([0, 0]);
    expect(sim.weapons.held).toBeNull();
    expect(all).toContainEqual({ type: 'WeaponBroken', kind: 'kamehame' });
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

  test('a strike with the kamehame does not swing (no melee hit while charging)', () => {
    const sim = armed();
    const p = sim.player.pos;
    const h = calm(sim, { x: p.x + 20, y: p.y });
    const ev = sim.step(PRESS);
    expect(of(ev, 'HitConfirmed')).toEqual([]);
    expect(h.state).not.toBe('ko');
  });
});

describe('onde d’énergie: satellisation (cosmetic launch payload)', () => {
  /** Charges and fires a beam through a line of `n` rioters; returns the KO events and the sim. */
  function shoot(seed: number, n = 4) {
    const sim = new Sim(seed);
    sim.weapons.held = heldOf('kamehame');
    sim.player.facing = { x: 1, y: 0 };
    const p = { ...sim.player.pos };
    sim.step(input({ strike: true, strikeHeld: true }));
    for (let i = 0; i < STEPS(CONFIG.kamehame.chargeSec) - 1; i++) sim.step(input({ strikeHeld: true }));
    for (let i = 0; i < n; i++) calm(sim, { x: p.x + 40 + i * 50, y: p.y });
    const ev = sim.step(input({ strikeHeld: true }));
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

describe('specials: unlocks and drops', () => {
  test('twist drop pools: none before round 3, bouclier from 3, furie from 4, kamehame from 5', () => {
    expect(dropSpecials(1)).toEqual([]);
    expect(dropSpecials(2)).toEqual([]);
    expect(dropSpecials(3)).toEqual(['bouclier']);
    expect(dropSpecials(4)).toEqual(['furie', 'bouclier']);
    expect(dropSpecials(5)).toEqual(['furie', 'bouclier', 'kamehame']);
    expect(isSpecial('bouclier') && isSpecial('kamehame') && isSpecial('furie')).toBe(true);
    expect(isSpecial('baton')).toBe(false);
  });

  test('dropTwist: a regular weapon before round 3, then only unlocked specials (all of them over many draws)', () => {
    for (const round of [1, 2]) {
      const w = new Weapons(grid, rng(round));
      const { drop, special } = w.dropTwist(DISTRICT.playerSpawn, round);
      expect(special).toBeNull();
      expect(isSpecial(drop!.kind)).toBe(false);
    }
    for (const round of [3, 4, 5, 8]) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        const w = new Weapons(grid, rng(seed));
        const { drop, special } = w.dropTwist(DISTRICT.playerSpawn, round);
        expect(drop!.kind).toBe(special);
        expect(drop!.expiresAt).toBeCloseTo(CONFIG.weapons.dropLifetime, 6);
        seen.add(special!);
      }
      expect([...seen].sort()).toEqual([...dropSpecials(round)].sort());
    }
  });

  test('timed spawns: no special before its spawn round; each unlocked one about 1 in 6', () => {
    const shares = (round: number) => {
      const n: Record<string, number> = {};
      let total = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const w = new Weapons(grid, rng(seed));
        const paul = createPlayer({ ...DISTRICT.playerSpawn });
        for (let t = 0; t < 400; t += 1) {
          for (const e of w.step(1, t, paul, round))
            if (e.type === 'WeaponSpawned') {
              total++;
              n[e.kind] = (n[e.kind] ?? 0) + 1;
            }
          w.ground.length = 0;
        }
      }
      return (k: string) => (n[k] ?? 0) / total;
    };
    const r4 = shares(4);
    for (const k of ['furie', 'bouclier', 'kamehame']) expect(r4(k)).toBe(0);
    expect(spawnSpecials(5)).toEqual(['bouclier']);
    const r7 = shares(7);
    for (const k of ['furie', 'bouclier', 'kamehame']) {
      expect(r7(k)).toBeGreaterThan(0.1);
      expect(r7(k)).toBeLessThan(0.24);
    }
  });

  test('in a session: twist drops are regular before round 3 and the announced special after; deterministic', () => {
    const run = () => {
      const sim = new Sim(3, { invulnerable: true });
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
    const a = run();
    expect(a.length).toBeGreaterThanOrEqual(2);
    for (const t of a) {
      if (t.round < 3) {
        expect(t.special).toBeUndefined();
        if (t.kind) expect(isSpecial(t.kind as never)).toBe(false);
      } else {
        expect(dropSpecials(t.round)).toContain(t.special);
        if (t.kind) expect(t.kind).toBe(t.special);
      }
    }
    expect(a.some((t) => t.round >= 3)).toBe(true);
    expect(run()).toEqual(a);
  });
});
