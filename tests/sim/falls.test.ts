import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { pickFall, WTF_KINDS, type FallSource } from '../../src/sim/falls';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import type { Fall, InputFrame, Role, SimEvent, Vec, WeaponKind } from '../../src/sim/types';
import { WEAPONS } from '../../src/sim/weapons';
import { IDLE } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const OPEN: Vec = { x: 656, y: 720 };
const STRIKE = input({ strike: true });
const EAST: Vec = { x: 1, y: 0 };

/** A rand that replays `values` in a loop. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

/** Paul on open ground facing east; the fall stream replaced by `fallRand` (when given). */
function setup(opts: { held?: WeaponKind; fallRand?: () => number; seed?: number } = {}): Sim {
  const sim = new Sim(opts.seed ?? 3, { invulnerable: true });
  sim.player.pos = { ...OPEN };
  sim.player.facing = { ...EAST };
  if (opts.held) sim.weapons.held = { kind: opts.held, uses: WEAPONS[opts.held].uses };
  if (opts.fallRand) Object.assign(sim, { fallRand: opts.fallRand });
  return sim;
}

function rioter(sim: Sim, pos: Vec, role: Role = 'contact', maxHp?: number) {
  const h = sim.horde.spawn(maxHp === undefined ? { variant: 'classic', role, pos } : { variant: 'classic', role, pos, maxHp })!;
  h.nextAttackAt = 1e9;
  return h;
}

function settle(sim: Sim, first: SimEvent[] = [], steps = 90): SimEvent[] {
  const ev = [...first];
  for (let i = 0; i < steps; i++) ev.push(...sim.step(IDLE));
  return ev;
}

/** No WTF (first draw above wtfChance), hands variant from the third draw. */
const PLAIN = (variant = 0.2) => seq(0.5, 0.5, variant);
/** WTF on every KO, sub-kind `WTF_KINDS[k]`. */
const WTF = (k: number) => seq(0.01, (k + 0.5) / WTF_KINDS.length, 0.5);

describe('pickFall (pure)', () => {
  const base = { boss: false, launched: false, dir: EAST };
  const cases: [FallSource, Fall['kind']][] = [
    ['marteau', 'pancake'],
    ['panneau', 'flyspin'],
    ['baton', 'flyspin'],
    ['gant', 'bounce'],
    ['flashball', 'backflip'],
    ['rock', 'wobble'],
    ['furie', 'flyspin'],
    ['beam', 'flyspin'],
    ['knocked', 'knocked'],
  ];
  test.each(cases)('%s → %s', (source, kind) => {
    expect(pickFall(source, base, PLAIN())).toEqual({ kind, wtf: false, dir: EAST });
  });

  test('hands: crumple or spin by the variant draw', () => {
    expect(pickFall('hands', base, PLAIN(0.2)).kind).toBe('crumple');
    expect(pickFall('hands', base, PLAIN(0.8)).kind).toBe('spin');
  });

  test('always 3 draws, whatever the branch', () => {
    for (const [source, opts] of [
      ['hands', base],
      ['knocked', base],
      ['hands', { ...base, boss: true }],
      ['furie', { ...base, launched: true }],
    ] as const) {
      for (const r of [PLAIN(), WTF(0)]) {
        let n = 0;
        pickFall(source, opts, () => (n++, r()));
        expect(n).toBe(3);
      }
    }
  });

  test('WTF: replaces the kind with the sub-kind pick; never on the Caïd, a launch or a knocked body', () => {
    WTF_KINDS.forEach((k, i) => expect(pickFall('marteau', base, WTF(i))).toEqual({ kind: k, wtf: true, dir: EAST }));
    expect(pickFall('marteau', { ...base, boss: true }, WTF(0))).toEqual({ kind: 'crumple', wtf: false, dir: EAST });
    expect(pickFall('furie', { ...base, launched: true }, WTF(0))).toEqual({ kind: 'flyspin', wtf: false, dir: EAST });
    expect(pickFall('knocked', base, WTF(4))).toEqual({ kind: 'knocked', wtf: false, dir: EAST });
  });

  test('the WTF rate is about 1 in 10 (CONFIG.falls.wtfChance)', () => {
    expect(CONFIG.falls.wtfChance).toBe(0.1);
    const r = rng(2026);
    const N = 20000;
    let wtf = 0;
    const kinds = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const f = pickFall('hands', base, r);
      if (f.wtf) {
        wtf += 1;
        kinds.set(f.kind, (kinds.get(f.kind) ?? 0) + 1);
      }
    }
    expect(wtf / N).toBeGreaterThan(0.09);
    expect(wtf / N).toBeLessThan(0.11);
    for (const k of WTF_KINDS) expect(kinds.get(k)! / wtf).toBeGreaterThan(0.15);
  });
});

describe('falls on every KO', () => {
  test('bare hands: crumple / spin, dir away from Paul', () => {
    for (const [variant, kind] of [
      [0.2, 'crumple'],
      [0.8, 'spin'],
    ] as const) {
      const sim = setup({ fallRand: PLAIN(variant) });
      const h = rioter(sim, { x: OPEN.x + 20, y: OPEN.y }, 'contact', 1);
      const ko = of(sim.step(STRIKE), 'ActorKnockedOut');
      expect(ko).toEqual([{ type: 'ActorKnockedOut', lifeId: h.lifeId, fall: { kind, wtf: false, dir: EAST } }]);
    }
  });

  test.each([
    ['marteau', 'pancake'],
    ['panneau', 'flyspin'],
    ['baton', 'flyspin'],
  ] as const)('held %s → %s', (held, kind) => {
    const sim = setup({ held, fallRand: PLAIN() });
    rioter(sim, { x: OPEN.x + 20, y: OPEN.y });
    const [ko] = of(sim.step(STRIKE), 'ActorKnockedOut');
    expect(ko!.fall).toEqual({ kind, wtf: false, dir: EAST });
  });

  test('gant → bounce (the launch is kept, never WTF)', () => {
    const sim = setup({ held: 'gant', fallRand: WTF(4) });
    rioter(sim, { x: OPEN.x + 120, y: OPEN.y });
    const [ko] = of(sim.step(STRIKE), 'ActorKnockedOut');
    expect(ko!.launch?.kind).toBe('tumble');
    expect(ko!.fall).toMatchObject({ kind: 'bounce', wtf: false });
    expect(ko!.fall.dir).toEqual(ko!.launch!.dir);
  });

  test('flashball → backflip', () => {
    const sim = setup({ held: 'flashball', fallRand: PLAIN() });
    rioter(sim, { x: OPEN.x + 120, y: OPEN.y });
    const [ko] = of(settle(sim, sim.step(input({ strike: true, aim: EAST }))), 'ActorKnockedOut');
    expect(ko!.fall.kind).toBe('backflip');
    expect(ko!.fall.dir.x).toBeCloseTo(1, 6);
  });

  test('a returned rock → wobble', () => {
    const sim = setup({ fallRand: PLAIN() });
    sim.rocks.carried = 1;
    rioter(sim, { x: OPEN.x + 120, y: OPEN.y }, 'contact', 1);
    const [ko] = of(settle(sim, sim.step(input({ throwRock: true, aim: EAST })), 30), 'ActorKnockedOut');
    expect(ko!.fall.kind).toBe('wobble');
  });

  test('mode furie and the beam: flyspin, wtf false, launch kept', () => {
    const sim = setup({ fallRand: WTF(4) });
    sim.energy.value = CONFIG.energy.max;
    sim.step(input({ furie: true }));
    rioter(sim, { x: OPEN.x + 20, y: OPEN.y });
    const [ko] = of(sim.step(STRIKE), 'ActorKnockedOut');
    expect(ko!.launch).toBeDefined();
    expect(ko!.fall).toMatchObject({ kind: 'flyspin', wtf: false });
  });

  test('the Caïd: always crumple, never WTF', () => {
    const sim = setup({ held: 'marteau', fallRand: WTF(4) });
    const boss = rioter(sim, { x: OPEN.x + 20, y: OPEN.y }, 'boss', 1);
    rioter(sim, { x: OPEN.x + 90, y: OPEN.y });
    const ev = sim.step(STRIKE);
    const [ko] = of(ev, 'ActorKnockedOut');
    expect(ko!.lifeId).toBe(boss.lifeId);
    expect(ko!.fall).toEqual({ kind: 'crumple', wtf: false, dir: EAST });
    expect(of(ev, 'DominoTriggered')).toEqual([]);
  });
});

describe('domino', () => {
  /** Body 50 px east of Paul (in strike range), neighbours out of the strike range (> 63 px from Paul). */
  function scene(fallRand: () => number) {
    const sim = setup({ held: 'marteau', fallRand });
    const body = rioter(sim, { x: OPEN.x + 50, y: OPEN.y });
    const near = rioter(sim, { x: OPEN.x + 80, y: OPEN.y }); // 30 px from the body
    const boss = rioter(sim, { x: OPEN.x + 75, y: OPEN.y + 20 }, 'boss'); // 32 px: never knocked
    const mid = rioter(sim, { x: OPEN.x + 95, y: OPEN.y }); // 45 px
    const third = rioter(sim, { x: OPEN.x + 104, y: OPEN.y }); // 54 px: a third one, over the cap of 2
    const far = rioter(sim, { x: OPEN.x + 120, y: OPEN.y }); // 70 px: out of reach
    return { sim, body, near, boss, mid, third, far };
  }

  test('the body knocks down the 2 nearest living non-boss rioters: +1 each, DominoTriggered, plain topple', () => {
    const { sim, body, near, boss, mid, third, far } = scene(WTF(4));
    const energy0 = sim.energy.value;
    const ev = sim.step(STRIKE);
    const kos = of(ev, 'ActorKnockedOut');
    expect(kos.map((k) => k.lifeId)).toEqual([body.lifeId, near.lifeId, mid.lifeId]);
    expect(kos[0]!.fall).toEqual({ kind: 'domino', wtf: true, dir: EAST });
    for (const k of kos.slice(1)) expect(k.fall).toEqual({ kind: 'knocked', wtf: false, dir: EAST });
    const i = ev.indexOf(kos[0]!);
    expect(ev[i + 1]).toEqual({ type: 'DominoTriggered', from: body.pos, lifeIds: [near.lifeId, mid.lifeId] });
    expect(near.state).toBe('ko');
    expect(mid.state).toBe('ko');
    for (const h of [boss, third, far]) expect(h.state).not.toBe('ko');
    expect(sim.rules.kos).toBe(3);
    expect(of(ev, 'ScoreChanged').map((e) => e.points)).toEqual([1, 1, 1]);
    expect(sim.energy.value).toBeGreaterThan(energy0);
  });

  test('energy: each knocked rioter fills the gauge like any KO', () => {
    const one = setup({ held: 'marteau', fallRand: PLAIN() });
    rioter(one, { x: OPEN.x + 50, y: OPEN.y });
    one.step(STRIKE);
    const perKo = one.energy.value;
    const { sim } = scene(WTF(4));
    sim.step(STRIKE);
    expect(sim.energy.value).toBeCloseTo(Math.min(CONFIG.energy.max, 3 * perKo), 6);
  });

  test('no chain: a knocked body never dominoes further', () => {
    // every draw says « domino », the victims' neighbours still stand
    const sim = setup({ held: 'marteau', fallRand: WTF(4) });
    const body = rioter(sim, { x: OPEN.x + 50, y: OPEN.y });
    const v1 = rioter(sim, { x: OPEN.x + 100, y: OPEN.y }); // 50 px from the body
    const beyond = rioter(sim, { x: OPEN.x + 140, y: OPEN.y }); // 40 px from v1, 90 from the body
    const ev = sim.step(STRIKE);
    expect(of(ev, 'ActorKnockedOut').map((k) => k.lifeId)).toEqual([body.lifeId, v1.lifeId]);
    expect(of(ev, 'DominoTriggered')).toHaveLength(1);
    expect(beyond.state).not.toBe('ko');
  });

  test('no neighbour: falls back to faceplant', () => {
    const sim = setup({ held: 'marteau', fallRand: WTF(4) });
    rioter(sim, { x: OPEN.x + 50, y: OPEN.y });
    rioter(sim, { x: OPEN.x + 50 + CONFIG.falls.dominoRadius + 10, y: OPEN.y });
    const ev = sim.step(STRIKE);
    expect(of(ev, 'ActorKnockedOut').map((k) => k.fall)).toEqual([{ kind: 'faceplant', wtf: true, dir: EAST }]);
    expect(of(ev, 'DominoTriggered')).toEqual([]);
    expect(sim.rules.kos).toBe(1);
  });
});

describe('determinism', () => {
  /** Waves of rioters around Paul, struck bare-handed and with a marteau; returns every KO event. */
  function run(seed: number): Ev<'ActorKnockedOut'>[] {
    const sim = new Sim(seed, { invulnerable: true });
    sim.player.pos = { ...OPEN };
    const out: Ev<'ActorKnockedOut'>[] = [];
    for (let wave = 0; wave < 60; wave++) {
      if (wave % 2 === 0) sim.weapons.held = { kind: 'marteau', uses: WEAPONS.marteau.uses };
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + wave;
        const pos = { x: OPEN.x + Math.cos(a) * (30 + 12 * k), y: OPEN.y + Math.sin(a) * (30 + 12 * k) };
        sim.horde.spawn({ variant: 'classic', role: 'contact', pos, maxHp: 1 }); // null at the cap
      }
      for (let i = 0; i < 30; i++) out.push(...of(sim.step(i === 0 ? STRIKE : IDLE), 'ActorKnockedOut'));
    }
    return out;
  }

  test('same seed and inputs → identical falls (and the domino with them)', () => {
    const a = run(77);
    const b = run(77);
    expect(a.length).toBeGreaterThan(60);
    expect(a).toEqual(b);
    expect(a.every((k) => k.fall !== undefined)).toBe(true);
  });
});
