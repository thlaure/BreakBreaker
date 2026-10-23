import { t } from '../../src/content/i18n';
import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { dist } from '../../src/sim/math';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, Role, SimEvent, Vec, WeaponKind } from '../../src/sim/types';
import { WEAPONS, Weapons, streetKinds } from '../../src/sim/weapons';
import { IDLE, autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const OPEN: Vec = { x: 656, y: 720 };
const grid = new Grid(DISTRICT);
const STRIKE = input({ strike: true });

/** Paul on open ground facing east, holding `kind` (full uses). */
function armed(kind: WeaponKind, seed = 3): Sim {
  const sim = new Sim(seed, { invulnerable: true });
  sim.player.pos = { ...OPEN };
  sim.player.facing = { x: 1, y: 0 };
  sim.weapons.held = { kind, uses: WEAPONS[kind].uses };
  return sim;
}

/** A rioter of `role` at `pos` that never attacks nor moves away during the test. */
function rioter(sim: Sim, pos: Vec, role: Role = 'contact') {
  const h = sim.horde.spawn({ variant: 'classic', role, pos })!;
  h.nextAttackAt = 1e9;
  return h;
}

/** Steps (idle) until no flashball shot is in flight; returns the events. */
function settle(sim: Sim, first: SimEvent[] = []): SimEvent[] {
  const ev = [...first];
  for (let i = 0; i < 120 && sim.bullets.player().length > 0; i++) ev.push(...sim.step(IDLE));
  return ev;
}

const at = (angleDeg: number, r: number): Vec => ({
  x: OPEN.x + Math.cos((angleDeg * Math.PI) / 180) * r,
  y: OPEN.y + Math.sin((angleDeg * Math.PI) / 180) * r,
});

describe('weapons table', () => {
  test('gant de boxe 6 uses, flashball 6 shots; HUD labels', () => {
    expect(WEAPONS.gant).toMatchObject({ uses: 6, strike: 'punch', range: 160 });
    expect(WEAPONS.flashball).toMatchObject({ uses: 6, strike: 'shot' });
    expect(t('held.gant')).toBe('Gant de boxe');
    expect(t('held.flashball')).toBe('Flashball');
  });

  test('street pool: the gant from round 3, the flashball from round 5', () => {
    expect(streetKinds(1)).toEqual(['baton', 'marteau', 'panneau']);
    expect(streetKinds(3)).toEqual(['baton', 'marteau', 'panneau', 'gant']);
    expect(streetKinds(5)).toEqual(['baton', 'marteau', 'panneau', 'gant', 'flashball']);
    const seen = (round: number): Set<string> => {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        const w = new Weapons(grid, rng(seed));
        const paul = { pos: { ...OPEN }, facing: { x: 1, y: 0 }, hp: 100, invulnUntil: 0, strikeReadyAt: 0, swingId: 0, ko: false };
        for (let t = 0; t < 400; t += 1) {
          for (const e of w.step(1, t, paul, round)) if (e.type === 'WeaponSpawned') kinds.add(e.kind);
          w.ground = [];
        }
      }
      return kinds;
    };
    expect(seen(2).has('gant')).toBe(false);
    expect(seen(2).has('flashball')).toBe(false);
    expect(seen(3).has('gant')).toBe(true);
    expect(seen(4).has('flashball')).toBe(false);
    expect(seen(5).has('flashball')).toBe(true);
  });
});

describe('flashball', () => {
  test('a strike fires a shot along the mouse aim that KOs the first rioter (+1), not the one behind; one shot used', () => {
    const sim = armed('flashball');
    const a = rioter(sim, { x: OPEN.x + 200, y: OPEN.y });
    const b = rioter(sim, { x: OPEN.x + 260, y: OPEN.y });
    const ev = settle(sim, sim.step(input({ strike: true, aim: { x: 1, y: 0 } })));
    expect(of(ev, 'FlashballFired')).toHaveLength(1);
    expect(a.state).toBe('ko');
    expect(b.state).not.toBe('ko');
    expect(of(ev, 'HitConfirmed')).toEqual([{ type: 'HitConfirmed', targetLifeId: a.lifeId, damage: 99, source: 'flashball' }]);
    expect(of(ev, 'ScoreChanged').map((e) => e.points)).toEqual([1]);
    expect(sim.weapons.held).toEqual({ kind: 'flashball', uses: 5 });
  });

  test('420 px/s', () => {
    const sim = armed('flashball');
    sim.step(input({ strike: true, aim: { x: 0, y: -1 } }));
    const y0 = sim.bullets.player()[0]!.pos.y;
    for (let i = 0; i < 30; i++) sim.step(IDLE);
    expect(y0 - sim.bullets.player()[0]!.pos.y).toBeCloseTo(CONFIG.flashball.speed * 0.5, 0);
  });

  test('a miss uses the shot too; at 0 the flashball breaks', () => {
    const sim = armed('flashball');
    sim.weapons.held = { kind: 'flashball', uses: 2 };
    sim.step(input({ strike: true, aim: { x: 0, y: -1 } }));
    expect(sim.weapons.held).toEqual({ kind: 'flashball', uses: 1 });
    for (let i = 0; i < 30; i++) sim.step(IDLE);
    const ev = sim.step(input({ strike: true, aim: { x: 0, y: -1 } }));
    expect(of(ev, 'WeaponBroken')).toEqual([{ type: 'WeaponBroken', kind: 'flashball' }]);
    expect(sim.weapons.held).toBeNull();
  });

  test('the strike cooldown applies (no shot spam)', () => {
    const sim = armed('flashball');
    let fired = 0;
    for (let i = 0; i < 10; i++) fired += of(sim.step(STRIKE), 'FlashballFired').length;
    expect(fired).toBe(1);
  });

  test('aim assist without a mouse aim: snaps to the nearest rioter within ±12° and 320 px', () => {
    const sim = armed('flashball');
    const h = rioter(sim, at(10, 200));
    settle(sim, sim.step(STRIKE));
    expect(h.state).toBe('ko');

    const out = armed('flashball');
    const o = rioter(out, at(15, 200));
    settle(out, out.step(STRIKE));
    expect(o.state).not.toBe('ko');

    const far = armed('flashball');
    const f = rioter(far, at(8, 340));
    const ev = far.step(STRIKE);
    expect(of(ev, 'FlashballFired')[0]!.dir).toEqual({ x: 1, y: 0 });
    void f;

    // a mouse aim is never snapped
    const mouse = armed('flashball');
    const m = rioter(mouse, at(10, 200));
    settle(mouse, mouse.step(input({ strike: true, aim: { x: 1, y: 0 } })));
    expect(m.state).not.toBe('ko');
  });

  test('the assist picks the nearest of two in the cone', () => {
    const sim = armed('flashball');
    const near = rioter(sim, at(-6, 150));
    const far = rioter(sim, at(5, 250));
    settle(sim, sim.step(STRIKE));
    expect(near.state).toBe('ko');
    expect(far.state).not.toBe('ko');
  });

  test('B1 weapon rule: 2 damage to a brute or the Caïd', () => {
    for (const [role, hp] of [
      ['brute', CONFIG.brute.hp],
      ['boss', CONFIG.caid.hp],
    ] as const) {
      const sim = armed('flashball');
      const h = rioter(sim, { x: OPEN.x + 150, y: OPEN.y }, role);
      const ev = settle(sim, sim.step(input({ strike: true, aim: { x: 1, y: 0 } })));
      expect(h.hp).toBe(hp - CONFIG.toughWeaponDamage);
      expect(of(ev, 'HitConfirmed')[0]).toMatchObject({ source: 'flashball', heavy: true, damage: 2 });
    }
  });

  test('stopped by a building (BulletImpact) and the peaceful group (rioters behind are safe)', () => {
    const sim = armed('flashball');
    sim.player.pos = { ...DISTRICT.playerSpawn };
    let wall = 0;
    while (!grid.isSolidPx({ x: sim.player.pos.x + wall, y: sim.player.pos.y })) wall += 1;
    const ev = settle(sim, sim.step(input({ strike: true, aim: { x: 1, y: 0 } })));
    expect(of(ev, 'BulletImpact')).toHaveLength(1);
    expect(of(ev, 'BulletImpact')[0]!.owner).toBe('player');

    const g = DISTRICT.peacefulGroups[0]!.area;
    const s2 = armed('flashball');
    s2.player.pos = { x: g.x - 60, y: g.y + g.h / 2 };
    const behind = rioter(s2, { x: g.x + g.w + 30, y: g.y + g.h / 2 });
    const ev2 = settle(s2, s2.step(input({ strike: true, aim: { x: 1, y: 0 } })));
    expect(of(ev2, 'ProtectedGroupBlockedImpact')).toHaveLength(1);
    expect(behind.state).not.toBe('ko');
  });

  test('a flashball KO feeds the energy gauge like any weapon KO', () => {
    const sim = armed('flashball');
    rioter(sim, { x: OPEN.x + 100, y: OPEN.y });
    settle(sim, sim.step(input({ strike: true, aim: { x: 1, y: 0 } })));
    expect(sim.energy.value).toBe(CONFIG.energy.gain.rioter);
  });

  test('mode furie: the strike is the furie sweep (no shot, nothing used)', () => {
    const sim = armed('flashball');
    sim.weapons.startFurie();
    const h = rioter(sim, { x: OPEN.x + 30, y: OPEN.y });
    const ev = sim.step(STRIKE);
    expect(of(ev, 'FlashballFired')).toEqual([]);
    expect(h.state).toBe('ko');
    expect(sim.weapons.held!.uses).toBe(6);
  });
});

describe('the flashball guaranteed with the first shooter', () => {
  test('the first shooter to walk in drops a flashball 120–220 px from Paul (it lasts 60 s), once', () => {
    const sim = new Sim(2, { invulnerable: true });
    sim.player.pos = { ...OPEN };
    sim.queue.request([{ variant: 'classic', role: 'shooter' }], { firstDelay: 0 });
    const ev: SimEvent[] = [];
    for (let i = 0; i < 30; i++) ev.push(...sim.step(IDLE));
    const drop = of(ev, 'FlashballDropped');
    expect(drop).toHaveLength(1);
    expect(dist(drop[0]!.pos, OPEN)).toBeGreaterThanOrEqual(CONFIG.flashball.dropMin - 32);
    expect(dist(drop[0]!.pos, OPEN)).toBeLessThanOrEqual(CONFIG.flashball.dropMax + 32);
    expect(of(ev, 'WeaponSpawned')).toContainEqual({ type: 'WeaponSpawned', kind: 'flashball', pos: drop[0]!.pos });
    const fb = sim.snapshot().weaponsOnGround.find((w) => w.kind === 'flashball')!;
    expect(fb).toEqual({ id: expect.any(Number), kind: 'flashball', pos: drop[0]!.pos, expiresAt: expect.any(Number) });
    expect(fb.expiresAt! - sim.snapshot().now).toBeGreaterThan(CONFIG.weapons.groundLifetime - 1);
    expect(fb.expiresAt! - sim.snapshot().now).toBeLessThanOrEqual(CONFIG.weapons.groundLifetime);
    expect(grid.circleBlocked(drop[0]!.pos, 10)).toBe(false);

    sim.queue.request([{ variant: 'antifa', role: 'shooter' }], { firstDelay: 0 });
    const more: SimEvent[] = [];
    for (let i = 0; i < 60 * 3; i++) more.push(...sim.step(IDLE));
    expect(sim.horde.list.filter((h) => h.role === 'shooter')).toHaveLength(2);
    expect(of(more, 'FlashballDropped')).toEqual([]);
  });

  test('in a real session: one FlashballDropped, in round 6, when its first shooter enters', () => {
    const sim = new Sim(4, { invulnerable: true });
    const drops: number[] = [];
    let firstShooterRound = 0;
    for (let i = 0; i < 60 * 60 * 40 && sim.director.round < 9; i++) {
      for (const e of sim.step(autopilot(sim))) if (e.type === 'FlashballDropped') drops.push(sim.director.round);
      if (!firstShooterRound && sim.horde.list.some((h) => h.role === 'shooter')) firstShooterRound = sim.director.round;
    }
    expect(firstShooterRound).toBe(6);
    expect(drops).toEqual([6]);
  });
});

describe('gant de boxe à ressort', () => {
  test('a straight punch of 160 px: KOs the first rioter on it, knocks it 32 px further, launches the body; one use', () => {
    const sim = armed('gant');
    const a = rioter(sim, { x: OPEN.x + 120, y: OPEN.y });
    const b = rioter(sim, { x: OPEN.x + 150, y: OPEN.y });
    const ev = sim.step(STRIKE);
    expect(a.state).toBe('ko');
    expect(b.state).not.toBe('ko');
    expect(a.pos.x).toBeCloseTo(OPEN.x + 120 + CONFIG.gant.knockback, 3);
    const ko = of(ev, 'ActorKnockedOut')[0]!;
    expect(ko.lifeId).toBe(a.lifeId);
    expect(ko.launch?.kind).toBe('tumble');
    expect(ko.launch!.power).toBeGreaterThanOrEqual(CONFIG.gant.launchPower[0]);
    expect(ko.launch!.power).toBeLessThanOrEqual(CONFIG.gant.launchPower[1]);
    expect(of(ev, 'GlovePunched')).toEqual([{ type: 'GlovePunched', from: OPEN, to: { x: OPEN.x + 120, y: OPEN.y }, lifeId: a.lifeId }]);
    expect(of(ev, 'HitConfirmed')[0]).toMatchObject({ source: 'gant', damage: 99 });
    expect(sim.weapons.held).toEqual({ kind: 'gant', uses: 5 });
    expect(of(ev, 'ScoreChanged').map((e) => e.points)).toEqual([1]);
  });

  test('beyond 160 px or off the line: a miss, which uses nothing', () => {
    const sim = armed('gant');
    const far = rioter(sim, { x: OPEN.x + 175, y: OPEN.y });
    const side = rioter(sim, { x: OPEN.x + 80, y: OPEN.y + 20 });
    const ev = sim.step(STRIKE);
    expect(far.state).not.toBe('ko');
    expect(side.state).not.toBe('ko');
    expect(of(ev, 'GlovePunched')[0]!.lifeId).toBeNull();
    expect(sim.weapons.held!.uses).toBe(6);
  });

  test('punches along the mouse aim', () => {
    const sim = armed('gant');
    const up = rioter(sim, { x: OPEN.x, y: OPEN.y - 100 });
    sim.step(input({ strike: true, aim: { x: 0, y: -1 } }));
    expect(up.state).toBe('ko');
  });

  test('stopped by a building and the peaceful group', () => {
    const sim = armed('gant');
    const spawn = DISTRICT.playerSpawn;
    let wall = 0;
    while (!grid.isSolidPx({ x: spawn.x + wall, y: spawn.y })) wall += 1;
    sim.player.pos = { x: spawn.x + wall - 100, y: spawn.y };
    const ev = sim.step(STRIKE);
    wall = 100;
    expect(of(ev, 'GlovePunched')[0]!.to.x).toBeLessThan(sim.player.pos.x + wall);

    const g = DISTRICT.peacefulGroups[0]!.area;
    const s2 = armed('gant');
    s2.player.pos = { x: g.x - 40, y: g.y + g.h / 2 };
    // the glove stops at the group's edge (it is wider than the reach: nobody behind it is ever in reach)
    expect(of(s2.step(STRIKE), 'GlovePunched')[0]!.to.x).toBeLessThanOrEqual(g.x);
  });

  test('B1 weapon rule: a brute takes 2 damage and is pushed back 32 px; the Caïd takes 2', () => {
    const sim = armed('gant');
    const br = rioter(sim, { x: OPEN.x + 60, y: OPEN.y }, 'brute');
    sim.step(STRIKE);
    expect(br.hp).toBe(CONFIG.brute.hp - 2);
    // pushed 32 px, then it walks back toward Paul for the rest of the step
    expect(br.pos.x).toBeGreaterThan(OPEN.x + 60 + CONFIG.gant.knockback - 3);
    const s2 = armed('gant');
    const boss = rioter(s2, { x: OPEN.x + 60, y: OPEN.y }, 'boss');
    s2.step(STRIKE);
    expect(boss.hp).toBe(CONFIG.caid.hp - 2);
  });

  test('breaks after its 6th hit', () => {
    const sim = armed('gant');
    sim.weapons.held = { kind: 'gant', uses: 1 };
    rioter(sim, { x: OPEN.x + 50, y: OPEN.y });
    const ev = sim.step(STRIKE);
    expect(of(ev, 'WeaponBroken')).toEqual([{ type: 'WeaponBroken', kind: 'gant' }]);
    expect(sim.weapons.held).toBeNull();
  });

  test('deterministic per seed (launch stream)', () => {
    const run = () => {
      const sim = armed('gant', 11);
      rioter(sim, { x: OPEN.x + 90, y: OPEN.y });
      return JSON.stringify(sim.step(STRIKE));
    };
    expect(run()).toBe(run());
  });
});
