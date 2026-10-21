import { describe, expect, test } from 'vitest';
import { Bullets, type BulletCtx } from '../../src/sim/bullets';
import { CONFIG } from '../../src/sim/config';
import { shooterCount } from '../../src/sim/director';
import { roleHp } from '../../src/sim/hostiles';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { norm, sub } from '../../src/sim/math';
import { segmentRectEntry, Sim } from '../../src/sim/sim';
import type { InputFrame, SimEvent, Vec } from '../../src/sim/types';
import { IDLE, autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const OPEN: Vec = { x: 656, y: 720 };
const grid = new Grid(DISTRICT);

/** Paul on open ground and a shooter `dx` px east of him (clear line), before the first round starts. */
function duel(dx = 260, seed = 1) {
  const sim = new Sim(seed);
  sim.player.pos = { ...OPEN };
  const h = sim.horde.spawn({ variant: 'palestinian', role: 'shooter', pos: { x: OPEN.x + dx, y: OPEN.y } })!;
  return { sim, h };
}

/** Steps until `pred` holds on a step's events; returns the events up to and including that step. */
function until(sim: Sim, pred: (ev: SimEvent[]) => boolean, max = 600, frame: () => InputFrame = () => IDLE): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < max; i++) {
    const ev = sim.step(frame());
    all.push(...ev);
    if (pred(ev)) return all;
  }
  throw new Error('never happened');
}

describe('shooters in the round composition', () => {
  test('none before round 6, 1 in rounds 6–7, 2 from round 8, never more than 3', () => {
    expect([1, 2, 3, 4, 5].map(shooterCount)).toEqual([0, 0, 0, 0, 0]);
    expect([6, 7].map(shooterCount)).toEqual([1, 1]);
    for (let r = 8; r <= 40; r++) {
      expect(shooterCount(r)).toBe(2);
      expect(shooterCount(r)).toBeLessThanOrEqual(CONFIG.shooter.maxPerRound);
    }
    expect(roleHp('shooter')).toBe(3);
  });

  test('a real session: each round brings shooterCount shooters, from the fill (the climax group), and closes at K = T', () => {
    const sim = new Sim(5, { invulnerable: true });
    const seen = new Map<number, { round: number | null; role: string; group: string | null }>();
    const done: { kos: number; total: number }[] = [];
    for (let i = 0; i < 60 * 60 * 40 && done.length < 9; i++) {
      const ev = sim.step(autopilot(sim));
      for (const h of sim.horde.list) if (!seen.has(h.lifeId)) seen.set(h.lifeId, { round: h.round, role: h.role, group: h.incidentId });
      if (ev.some((e) => e.type === 'RoundCompleted')) done.push({ kos: sim.director.lastSummary!.kos, total: sim.director.total });
    }
    expect(done).toHaveLength(9);
    for (const d of done) expect(d.kos).toBe(d.total);
    for (let r = 1; r <= 9; r++) {
      const shooters = [...seen.values()].filter((s) => s.round === r && s.role === 'shooter');
      expect(shooters.length, `round ${r}`).toBe(shooterCount(r));
      for (const s of shooters) expect(s.group ?? '').toMatch(new RegExp(`^round#${r}:fill#`));
    }
  });
});

describe('shooter AI: aim, burst, reload', () => {
  test('aims 0.8 s at where Paul stands (aim line, « ! »), then 3 bullets 0.12 s apart along that fixed line', () => {
    const { sim, h } = duel();
    const ev = until(sim, (e) => of(e, 'ShooterAimStarted').length > 0);
    const aim = of(ev, 'ShooterAimStarted')[0]!;
    expect(aim.lifeId).toBe(h.lifeId);
    expect(aim.to).toEqual(OPEN);
    expect(aim.until).toBeCloseTo(sim.now + CONFIG.shooter.aimSec, 6);
    const snap = sim.snapshot();
    expect(snap.aims).toEqual([{ from: aim.from, to: aim.to, until: aim.until }]);
    expect(snap.hostiles.find((x) => x.lifeId === h.lifeId)).toMatchObject({ aiming: true, windup: true });
    // the rifle points along the aim line (render reads the facing)
    expect(snap.hostiles.find((x) => x.lifeId === h.lifeId)!.facing).toEqual({ x: -1, y: 0 });
    const start = sim.now;
    // Paul walks off the line (north); the shooter keeps the line it aimed
    const fired: { at: number; id: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const e = sim.step(input({ move: { x: 0, y: -1 } }));
      for (const b of of(e, 'BulletFired')) fired.push({ at: sim.now - start, id: b.id });
    }
    expect(fired).toHaveLength(3);
    expect(fired[0]!.at).toBeCloseTo(CONFIG.shooter.aimSec, 1);
    expect(fired[1]!.at - fired[0]!.at).toBeCloseTo(CONFIG.shooter.burstGap, 1);
    expect(fired[2]!.at - fired[1]!.at).toBeCloseTo(CONFIG.shooter.burstGap, 1);
    const dir = norm(sub(aim.to, aim.from));
    for (const b of sim.snapshot().bullets) {
      expect(b.dir.x).toBeCloseTo(dir.x, 6);
      expect(b.dir.y).toBeCloseTo(dir.y, 6);
      // on the aimed line
      expect(b.pos.y).toBeCloseTo(aim.from.y, 3);
    }
  });

  test('dodged: Paul moving off the line takes no damage', () => {
    const { sim } = duel();
    until(sim, (e) => of(e, 'ShooterAimStarted').length > 0);
    let damage = 0;
    // 2 s of running north, then stand still: the burst flies past where he was
    for (let i = 0; i < 100; i++) damage += of(sim.step(input({ move: { x: 0, y: -1 }, run: i < 40 })), 'PlayerDamaged').length;
    expect(damage).toBe(0);
    expect(sim.player.hp).toBe(CONFIG.player.maxHp);
  });

  test('standing on the line: 8 damage, once (the invulnerability frames let the next two bullets through)', () => {
    const { sim } = duel();
    until(sim, (e) => of(e, 'ShooterAimStarted').length > 0);
    const hits: Ev<'PlayerDamaged'>[] = [];
    for (let i = 0; i < 120; i++) hits.push(...of(sim.step(IDLE), 'PlayerDamaged'));
    expect(hits).toEqual([{ type: 'PlayerDamaged', amount: CONFIG.bullet.damage }]);
    expect(sim.player.hp).toBe(CONFIG.player.maxHp - CONFIG.bullet.damage);
    // passed through Paul: still flying west of him
    expect(sim.snapshot().bullets.some((b) => b.pos.x < OPEN.x)).toBe(true);
  });

  test('mode furie halves a bullet (normal damage path)', () => {
    const { sim } = duel();
    sim.weapons.startFurie();
    until(sim, (e) => of(e, 'ShooterAimStarted').length > 0);
    const hits: Ev<'PlayerDamaged'>[] = [];
    for (let i = 0; i < 120; i++) hits.push(...of(sim.step(IDLE), 'PlayerDamaged'));
    expect(hits).toEqual([{ type: 'PlayerDamaged', amount: CONFIG.bullet.damage * CONFIG.furie.damageTakenMul }]);
  });

  test('reloads 3 s before the next aim', () => {
    const { sim } = duel();
    const starts: number[] = [];
    for (let i = 0; i < 60 * 9; i++) if (of(sim.step(input({ move: { x: 0, y: i % 120 < 60 ? -1 : 1 } })), 'ShooterAimStarted').length) starts.push(sim.now);
    expect(starts.length).toBeGreaterThanOrEqual(2);
    const cycle = CONFIG.shooter.aimSec + (CONFIG.shooter.burst - 1) * CONFIG.shooter.burstGap + CONFIG.shooter.reloadSec;
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(cycle - 0.02);
  });

  test('keeps 220–300 px: walks in from afar, backs off when too close; within 100 px it fights as a contact', () => {
    const far = duel(-420);
    for (let i = 0; i < 90; i++) far.sim.step(IDLE);
    const d1 = OPEN.x - far.h.pos.x;
    expect(d1).toBeLessThanOrEqual(CONFIG.shooter.keepMax + 2);
    expect(d1).toBeGreaterThanOrEqual(CONFIG.shooter.keepMin - 2);

    const near = duel(160);
    const x0 = near.h.pos.x;
    near.sim.step(IDLE);
    expect(near.h.pos.x).toBeGreaterThan(x0);

    const close = duel(40);
    const ev = until(close.sim, (e) => of(e, 'PlayerDamaged').length > 0, 200);
    expect(of(ev, 'ShooterAimStarted')).toEqual([]);
    expect(of(ev, 'PlayerDamaged')[0]!.amount).toBeGreaterThan(0);
  });

  test('KO while aiming: no bullet, the aim line is gone', () => {
    const { sim, h } = duel();
    until(sim, (e) => of(e, 'ShooterAimStarted').length > 0);
    sim.horde.applyHit(h.lifeId, 99);
    let fired = 0;
    for (let i = 0; i < 90; i++) fired += of(sim.step(IDLE), 'BulletFired').length;
    expect(fired).toBe(0);
    expect(sim.snapshot().aims).toEqual([]);
  });

  test('3 HP: a regular weapon KOs it in one hit, bare hands in three', () => {
    const one = duel(20);
    one.h.nextAttackAt = 1e9;
    one.sim.weapons.held = { kind: 'baton', uses: 15 };
    one.sim.step(input({ strike: true }));
    expect(one.h.state).toBe('ko');
    const bare = duel(20);
    bare.h.nextAttackAt = 1e9;
    let n = 0;
    for (let k = 0; k < 5 && bare.h.state !== 'ko'; k++) {
      bare.sim.step(input({ strike: true }));
      n++;
      for (let i = 0; i < 30; i++) bare.sim.step(IDLE);
    }
    expect(n).toBe(3);
  });

  test('deterministic per seed', () => {
    const run = () => {
      const { sim } = duel(280, 7);
      const out: SimEvent[] = [];
      for (let i = 0; i < 60 * 8; i++) out.push(...sim.step(input({ move: { x: Math.sin(i / 30), y: Math.cos(i / 45) } })));
      return JSON.stringify(out);
    };
    expect(run()).toBe(run());
  });
});

describe('bullets', () => {
  const ctx = (o: Partial<BulletCtx> = {}, player: Partial<BulletCtx['player']> = {}): BulletCtx => ({
    player: { pos: { x: -500, y: -500 }, r: CONFIG.player.radius, invulnerable: false, shield: false, ...player },
    hostiles: [],
    groupBlocks: (a, b) => segmentRectEntry(a, b, DISTRICT.peacefulGroup.area),
    victimPos: null,
    ...o,
  });
  const run = (b: Bullets, c: BulletCtx, steps = 200): SimEvent[] => {
    const out: SimEvent[] = [];
    for (let i = 0; i < steps; i++) out.push(...b.step(CONFIG.step, c).events);
    return out;
  };

  test('260 px/s; gone after 1.6 s of flight (416 px)', () => {
    const b = new Bullets(grid);
    const shot = b.fire(OPEN, { x: 0, y: -1 })!;
    b.step(1, ctx());
    expect(shot.pos.y).toBeCloseTo(OPEN.y - CONFIG.bullet.speed, 3);
    run(b, ctx(), 40);
    expect(b.enemy()).toEqual([]);
  });

  test('stopped by a building (BulletImpact) and by the peaceful group (ProtectedGroupBlockedImpact)', () => {
    const from = { ...DISTRICT.playerSpawn };
    let wall = 0;
    while (!grid.isSolidPx({ x: from.x + wall, y: from.y })) wall += 1;
    const b = new Bullets(grid);
    b.fire(from, { x: 1, y: 0 });
    const ev = run(b, ctx());
    const imp = of(ev, 'BulletImpact');
    expect(imp).toHaveLength(1);
    expect(imp[0]!.owner).toBe('enemy');
    expect(imp[0]!.pos.x).toBeLessThanOrEqual(from.x + wall + 1);
    expect(b.enemy()).toEqual([]);

    const g = DISTRICT.peacefulGroup.area;
    const left = { x: g.x - 60, y: g.y + g.h / 2 };
    const c = new Bullets(grid);
    c.fire(left, { x: 1, y: 0 });
    const ev2 = run(c, ctx());
    expect(of(ev2, 'ProtectedGroupBlockedImpact')).toHaveLength(1);
    expect(of(ev2, 'BulletImpact')).toEqual([]);
  });

  test('stopped by the victim, never hurting it', () => {
    const b = new Bullets(grid);
    b.fire(OPEN, { x: 1, y: 0 });
    const ev = run(b, ctx({ victimPos: { x: OPEN.x + 100, y: OPEN.y } }));
    expect(of(ev, 'ProtectedGroupBlockedImpact')).toHaveLength(1);
  });

  test('never hurts nor stops on rioters', () => {
    const b = new Bullets(grid);
    b.fire(OPEN, { x: 1, y: 0 });
    const res = b.step(0.5, ctx({ hostiles: [{ lifeId: 1, pos: { x: OPEN.x + 60, y: OPEN.y }, r: 7, active: true }] }));
    expect(res.hits).toEqual([]);
    expect(res.events).toEqual([]);
    expect(b.enemy()).toHaveLength(1);
  });

  test('the bouclier bubble blocks it (ShieldBlocked, gone), even during invulnerability frames', () => {
    for (const invulnerable of [false, true]) {
      const b = new Bullets(grid);
      b.fire(OPEN, { x: 1, y: 0 });
      const ev = run(b, ctx({}, { pos: { x: OPEN.x + 120, y: OPEN.y }, shield: true, invulnerable }));
      expect(of(ev, 'ShieldBlocked')).toHaveLength(1);
      expect(of(ev, 'PlayerDamaged')).toEqual([]);
      expect(b.enemy()).toEqual([]);
    }
  });

  test('in the Sim, Paul with the bouclier takes no bullet damage', () => {
    const { sim } = duel();
    sim.weapons.held = { kind: 'bouclier', uses: 0, secondsLeft: 20 };
    const ev = until(sim, (e) => of(e, 'ShooterAimStarted').length > 0);
    for (let i = 0; i < 150; i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'ShieldBlocked').length).toBe(3);
    expect(of(ev, 'PlayerDamaged')).toEqual([]);
  });

  test('at most 30 in flight', () => {
    const b = new Bullets(grid);
    for (let i = 0; i < CONFIG.bullet.maxFlying; i++) expect(b.fire(OPEN, { x: 0, y: -1 })).not.toBeNull();
    expect(b.fire(OPEN, { x: 0, y: -1 })).toBeNull();
    // flashball shots are not counted
    expect(b.shoot(OPEN, { x: 1, y: 0 })).not.toBeNull();
  });
});
