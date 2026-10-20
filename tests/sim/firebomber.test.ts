import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde, type HordeCtx } from '../../src/sim/hostiles';
import { lineup } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer, type Player } from '../../src/sim/player';
import { Rocks } from '../../src/sim/projectiles';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, Role, SimEvent } from '../../src/sim/types';
import { autopilot } from './autopilot';

const grid = new Grid(DISTRICT);
const DT = 1 / 60;
const FB = CONFIG.firebomber;
const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false };
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);

const mkCtx = (player: Player, over: Partial<HordeCtx> = {}): HordeCtx => ({
  player,
  grid,
  fields: { player: new FlowField(grid), victim: null },
  rocks: new Rocks(grid),
  sites: {},
  victimPos: null,
  pressure: 1,
  ...over,
});

/** Steps the horde `sec` seconds from `t0`, returning [time, event] pairs. */
function stepHorde(horde: Horde, ctx: HordeCtx, t0: number, sec: number, each?: (now: number) => void) {
  const out: { now: number; e: SimEvent }[] = [];
  let now = t0;
  for (let i = 0; i < Math.round(sec / DT); i++) {
    now = t0 + (i + 1) * DT;
    each?.(now);
    for (const e of horde.step(DT, now, ctx)) out.push({ now, e });
  }
  return out;
}

describe('firebomber AI', () => {
  test('telegraphs a 1.2 s windup aimed at Paul, then throws a bottle at where he stood (EnemyThrowStarted → FirebombThrown)', () => {
    const player = createPlayer({ x: 656, y: 720 });
    const ctx = mkCtx(player);
    const horde = new Horde();
    horde.spawn({ variant: 'palestinian', role: 'firebomber', pos: { x: 856, y: 720 } });
    let started: { now: number; e: Ev<'EnemyThrowStarted'> } | null = null;
    const evs = stepHorde(horde, ctx, 0, 3, (now) => {
      // Paul walks off once the windup started: the bottle still goes where he stood
      if (started && now > started.now) player.pos = { x: 656, y: 720 + (now - started.now) * 150 };
    });
    for (const x of evs) if (!started && x.e.type === 'EnemyThrowStarted') started = { now: x.now, e: x.e };
    expect(started).not.toBeNull();
    expect(started!.e.to).toEqual({ x: 656, y: 720 });
    expect(started!.e.until).toBeCloseTo(started!.now + FB.windup, 6);
    const thrown = evs.filter((x) => x.e.type === 'FirebombThrown');
    expect(thrown).toHaveLength(1);
    const t = thrown[0]!;
    expect(t.now - started!.now).toBeCloseTo(FB.windup, 6);
    const e = t.e as Ev<'FirebombThrown'>;
    expect(e.to).toEqual({ x: 656, y: 720 });
    expect(e.until).toBeCloseTo(t.now + FB.flightSec, 6);
    expect(evs.some((x) => x.e.type === 'EnemyRockThrown' || x.e.type === 'MolotovThrown')).toBe(false);
  });

  test('throws every 5 s; knocked out during the windup it throws nothing', () => {
    const player = createPlayer({ x: 656, y: 720 });
    const ctx = mkCtx(player);
    const horde = new Horde();
    horde.spawn({ variant: 'antifa', role: 'firebomber', pos: { x: 856, y: 720 } });
    const evs = stepHorde(horde, ctx, 0, 11.5);
    const starts = evs.filter((x) => x.e.type === 'EnemyThrowStarted').map((x) => x.now);
    expect(starts.length).toBe(3);
    for (let k = 1; k < starts.length; k++) expect(starts[k]! - starts[k - 1]!).toBeCloseTo(FB.throwInterval, 6);

    const h2 = new Horde();
    const fb = h2.spawn({ variant: 'classic', role: 'firebomber', pos: { x: 856, y: 720 } })!;
    let ko = false;
    const evs2 = stepHorde(h2, mkCtx(createPlayer({ x: 656, y: 720 })), 0, 4, () => {
      if (!ko && fb.state === 'windup') {
        ko = true;
        h2.applyHit(fb.lifeId, 99);
      }
    });
    expect(ko).toBe(true);
    expect(evs2.some((x) => x.e.type === 'FirebombThrown')).toBe(false);
  });

  test('Paul within 100 px: it fights as a contact rioter (no bottle)', () => {
    const player = createPlayer({ x: 656, y: 720 });
    const ctx = mkCtx(player);
    const horde = new Horde();
    horde.spawn({ variant: 'classic', role: 'firebomber', pos: { x: 716, y: 720 } });
    const evs = stepHorde(horde, ctx, 0, 4);
    expect(evs.some((x) => x.e.type === 'PlayerDamaged')).toBe(true);
    expect(evs.some((x) => x.e.type === 'FirebombThrown' || x.e.type === 'EnemyThrowStarted')).toBe(false);
  });

  test('keeps 140–260 px from Paul: walks in from afar, backs off when too close', () => {
    const player = createPlayer({ x: 656, y: 720 });
    const ctx = mkCtx(player);
    const far = new Horde();
    expect(grid.lineClear({ x: 656, y: 720 }, { x: 956, y: 720 })).toBe(true);
    const a = far.spawn({ variant: 'classic', role: 'firebomber', pos: { x: 956, y: 720 } })!;
    stepHorde(far, ctx, 0, 4);
    const da = Math.hypot(a.pos.x - 656, a.pos.y - 720);
    expect(da).toBeLessThanOrEqual(FB.keepMax + 1);
    expect(da).toBeGreaterThanOrEqual(FB.keepMin - 1);
    const near = new Horde();
    const b = near.spawn({ variant: 'classic', role: 'firebomber', pos: { x: 776, y: 720 } })!;
    b.nextAttackAt = 99;
    stepHorde(near, ctx, 0, 1);
    expect(Math.hypot(b.pos.x - 656, b.pos.y - 720)).toBeGreaterThanOrEqual(FB.keepMin - 1);
  });

  test('bottle windups count in the throw windup cap (rock throwers included)', () => {
    const player = createPlayer({ x: 656, y: 720 });
    const ctx = mkCtx(player);
    const horde = new Horde();
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      const role: Role = k % 2 === 0 ? 'firebomber' : 'thrower';
      horde.spawn({ variant: 'classic', role, pos: { x: 656 + Math.cos(ang) * 200, y: 720 + Math.sin(ang) * 200 } });
    }
    let max = 0;
    stepHorde(horde, ctx, 0, 6, () => {
      max = Math.max(max, horde.list.filter((h) => h.state === 'windup').length);
    });
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(2);
  });

  test('a Molotov marked afterThrow turns firebomber once its bottle hit the site; an unmarked one stays a Molotov', () => {
    const site = (): NonNullable<HordeCtx['sites']['school']> => ({
      points: DISTRICT.school.facadePoints,
      door: DISTRICT.school.door,
      standing: true,
      field: new FlowField(grid),
    });
    for (const marked of [true, false]) {
      const player = createPlayer({ x: 100, y: 100 });
      const ctx = mkCtx(player, { sites: { school: site() } });
      const horde = new Horde();
      const p0 = DISTRICT.school.facadePoints[0]!;
      const h = horde.spawn({
        variant: 'antifa',
        role: 'molotov',
        pos: { x: p0.x, y: p0.y + 40 },
        site: 'school',
        ...(marked ? { afterThrow: 'firebomber' as const } : {}),
      })!;
      const evs = stepHorde(horde, ctx, 0, 3);
      expect(evs.filter((x) => x.e.type === 'MolotovThrown')).toHaveLength(1);
      expect(h.role).toBe(marked ? 'firebomber' : 'molotov');
      expect(h.target).toBe('player');
    }
  });
});

describe('fire patches in the sim', () => {
  /** A fresh sim (intro: no rioter enters for 4 s) with one firebomber 200 px east of Paul. */
  function withFirebomber(seed = 3): Sim {
    const sim = new Sim(seed);
    const p = sim.player.pos;
    sim.horde.spawn({ variant: 'classic', role: 'firebomber', pos: { x: p.x + 200, y: p.y } });
    expect(grid.lineClear(p, { x: p.x + 200, y: p.y })).toBe(true);
    return sim;
  }

  test('Paul standing still: the bottle lands on him and the patch hurts him (4 hp) through PlayerDamaged', () => {
    const sim = withFirebomber();
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(2.6 / DT); i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'FirebombThrown')).toHaveLength(1);
    expect(of(ev, 'FirePatchStarted')).toHaveLength(1);
    const dmg = of(ev, 'PlayerDamaged');
    expect(dmg.length).toBeGreaterThan(0);
    expect(dmg.every((d) => d.amount === CONFIG.firePatch.damage)).toBe(true);
    expect(sim.player.hp).toBe(CONFIG.player.maxHp - dmg.length * CONFIG.firePatch.damage);
    const s = sim.snapshot();
    expect(s.firePatches).toHaveLength(1);
    expect(s.firePatches[0]!.r).toBe(CONFIG.firePatch.radius);
    expect(s.firePatches[0]!.secondsLeft).toBeGreaterThan(0);
  });

  test('Paul walking off during the windup: the bottle lands where he was, no damage', () => {
    const sim = withFirebomber();
    const ev: SimEvent[] = [];
    let away = false;
    for (let i = 0; i < Math.round(3 / DT); i++) {
      const e = sim.step(away ? { ...IDLE, move: { x: 0, y: 1 } } : IDLE);
      if (of(e, 'EnemyThrowStarted').length > 0) away = true;
      ev.push(...e);
    }
    expect(of(ev, 'FirePatchStarted')).toHaveLength(1);
    expect(of(ev, 'PlayerDamaged')).toEqual([]);
  });

  test('the bottle flight shows in the snapshot (firebombs), then the patch', () => {
    const sim = withFirebomber();
    let sawFlight = false;
    for (let i = 0; i < Math.round(2.2 / DT); i++) {
      sim.step(IDLE);
      const s = sim.snapshot();
      if (s.firebombs.length > 0) {
        sawFlight = true;
        expect(s.molotovs).toEqual([]);
      }
    }
    expect(sawFlight).toBe(true);
  });

  test('mode furie halves the patch damage', () => {
    const sim = withFirebomber();
    sim.weapons.ground.push({ id: 900, kind: 'furie', pos: { ...sim.player.pos }, expiresAt: null });
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(2.6 / DT); i++) ev.push(...sim.step(IDLE));
    const dmg = of(ev, 'PlayerDamaged');
    expect(dmg.length).toBeGreaterThan(0);
    expect(dmg.every((d) => d.amount === CONFIG.firePatch.damage * CONFIG.furie.damageTakenMul)).toBe(true);
  });

  test('pause freezes the patches', () => {
    const sim = withFirebomber();
    let s = sim.snapshot();
    for (let i = 0; i < Math.round(3 / DT) && s.firePatches.length === 0; i++) {
      sim.step(IDLE);
      s = sim.snapshot();
    }
    expect(s.firePatches).toHaveLength(1);
    const left = s.firePatches[0]!.secondsLeft;
    const hp = sim.player.hp;
    sim.pause();
    for (let i = 0; i < 300; i++) expect(sim.step(IDLE)).toEqual([]);
    expect(sim.snapshot().firePatches[0]!.secondsLeft).toBe(left);
    expect(sim.player.hp).toBe(hp);
  });

  test('rioters and targets are never hurt by a patch', () => {
    const sim = withFirebomber();
    const p = sim.player.pos;
    const other = sim.horde.spawn({ variant: 'antifa', role: 'contact', pos: { x: p.x, y: p.y + 60 } })!;
    other.nextAttackAt = 99;
    const hpBefore = DISTRICT.targets.map((t) => sim.targets.get(t.id).hp);
    for (let i = 0; i < Math.round(3 / DT); i++) sim.step(IDLE);
    expect(other.hp).toBe(other.maxHp);
    expect(DISTRICT.targets.map((t) => sim.targets.get(t.id).hp)).toEqual(hpBefore);
    expect(DISTRICT.targets.some((t) => sim.targets.get(t.id).burning)).toBe(false);
  });

  test('determinism: the same seed gives the same events with firebombers on the map', () => {
    const run = (): string => {
      const sim = withFirebomber(9);
      const p = sim.player.pos;
      sim.horde.spawn({ variant: 'antifa', role: 'firebomber', pos: { x: p.x - 200, y: p.y } });
      const out: SimEvent[] = [];
      for (let i = 0; i < 60 * 30; i++) out.push(...sim.step(i % 200 < 100 ? { ...IDLE, move: { x: 1, y: 0 } } : IDLE));
      return JSON.stringify(out) + JSON.stringify(sim.snapshot().firePatches);
    };
    expect(run()).toBe(run());
  });
});

describe('who throws at Paul', () => {
  test('lineup: from round 3 the last Molotov of an attack turns firebomber after its throw; never in rounds 1–2', () => {
    for (const kind of ['school', 'car', 'busStop'] as const)
      for (let round = 1; round <= 8; round++) {
        const c = lineup(kind, round, 4);
        const all = [...c.firstLine, ...c.reinforcements];
        const marked = all.filter((r) => r.afterThrow === 'firebomber');
        const mol = all.filter((r) => r.role === 'molotov');
        if (round < FB.fromRound) expect(marked).toEqual([]);
        else {
          expect(marked).toHaveLength(1);
          expect(marked[0]).toBe(mol[mol.length - 1]);
        }
      }
  });

  test('fill: no firebomber in rounds 1–2; from round 3 at least 1 (fill >= 4), at most 3 per round; throwers unchanged', () => {
    const sim = new Sim(4, { invulnerable: true });
    const seen = new Map<number, { round: number | null; role: Role; fill: boolean }>();
    for (let i = 0; i < 60 * 900 && sim.director.round <= 6; i++) {
      sim.step(autopilot(sim));
      for (const h of sim.horde.list)
        if (!seen.has(h.lifeId))
          seen.set(h.lifeId, { round: h.round, role: h.role, fill: (h.incidentId ?? '').startsWith(`round#${h.round}:`) });
    }
    expect(sim.director.round).toBeGreaterThan(5);
    const all = [...seen.values()];
    for (const round of [1, 2]) expect(all.filter((r) => r.round === round && r.role === 'firebomber')).toEqual([]);
    for (const round of [3, 4, 5]) {
      const fill = all.filter((r) => r.round === round && r.fill);
      const fb = fill.filter((r) => r.role === 'firebomber').length;
      if (fill.length >= 4) expect(fb).toBeGreaterThanOrEqual(1);
      expect(fb).toBeLessThanOrEqual(FB.maxPerRound);
      expect(fb).toBe(Math.min(FB.maxPerRound, Math.floor((fill.length + FB.fillEvery / 2) / FB.fillEvery)));
      expect(all.filter((r) => r.round === round && r.role === 'firebomber').length).toBe(fb);
    }
  });
});

test('rounds still close at K = T when the Molotovs get to throw (some turn firebomber) and firebombers throw', () => {
  const sim = new Sim(11, { invulnerable: true });
  const out: { index: number; kos: number; total: number }[] = [];
  let converted = 0;
  let thrown = 0;
  const roles = new Map<number, Role>();
  for (let i = 0; i < 60 * 1500 && out.length < 5; i++) {
    const ev = sim.step(autopilot(sim, { koAfterSec: 9 }));
    for (const h of sim.horde.list) {
      const was = roles.get(h.lifeId);
      if (was === 'molotov' && h.role === 'firebomber') converted++;
      roles.set(h.lifeId, h.role);
    }
    thrown += of(ev, 'FirebombThrown').length;
    if (ev.some((e) => e.type === 'RoundCompleted'))
      out.push({ index: sim.director.lastSummary!.index, kos: sim.director.lastSummary!.kos, total: sim.director.total });
  }
  expect(out.map((r) => r.index)).toEqual([1, 2, 3, 4, 5]);
  for (const r of out) expect(r.kos).toBe(r.total);
  expect(converted).toBeGreaterThan(0);
  expect(thrown).toBeGreaterThan(0);
});
