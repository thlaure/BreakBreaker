import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { TWO_URGENCIES_FROM, bruteCount, casseOpen, fillReserve, roundPlan, shooterCount, tableTotal, urgentCap } from '../../src/sim/director';
import { DISTRICT } from '../../src/sim/map/district';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import { Targets } from '../../src/sim/targets';
import type { CasseKind, SimEvent, TargetId } from '../../src/sim/types';
import { autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const kindOf = (id: TargetId): CasseKind => DISTRICT.targets.find((t) => t.id === id)!.kind;
const urgentAll = (sim: Sim): number =>
  sim.attacks.filter((a) => a.urgent()).length +
  (sim.rescue?.stage === 'threat' ? 1 : 0) +
  sim.occupations.filter((m) => m.urgent()).length;

describe('two urgencies at once from round 5 (plan)', () => {
  test('rounds 2-4 keep a single casse in the first beat; from round 5 two distinct places', () => {
    expect(TWO_URGENCIES_FROM).toBe(5);
    const t = new Targets();
    for (let s = 1; s <= 60; s++) {
      for (const r of [2, 3, 4]) expect(roundPlan(r, rng(s), t).beats[0]).toHaveLength(1);
      for (const r of [5, 6, 7, 8, 9, 10, 11]) {
        const p = roundPlan(r, rng(s), t, null);
        const first = p.beats[0]!;
        expect(first).toHaveLength(2);
        expect(new Set(first).size).toBe(2);
        expect(p.headline).toBe(first[0]);
        for (const k of first) expect(casseOpen(k as CasseKind, r)).toBe(true);
        expect(p.beats[1]).toEqual(['rescue']);
      }
    }
  });

  test('new-in-round kinds come first: round 5 nursery + kiosk, round 7 the town hall, round 9 the library', () => {
    const t = new Targets();
    for (let s = 1; s <= 60; s++) {
      expect(roundPlan(5, rng(s), t, ['shop']).beats[0]).toEqual(['nursery', 'kiosk']);
      const r7 = roundPlan(7, rng(s), t, ['nursery', 'kiosk']).beats[0]!;
      expect(r7[0]).toBe('townHall');
      expect(r7[1]).not.toBe('townHall');
      expect(roundPlan(9, rng(s), t, ['shop', 'car']).beats[0]![0]).toBe('library');
    }
  });

  test('the draw favours places absent from last round (weight 1 for the two of last round, 2 for the others)', () => {
    const t = new Targets();
    const n: Record<string, number> = {};
    const N = 3000;
    for (let s = 1; s <= N; s++) {
      const p = roundPlan(10, rng(s), t, ['school', 'shop']);
      for (const k of p.beats[0]!) n[k] = (n[k] ?? 0) + 1;
    }
    // 10 kinds (booths and prison included), two of them at half weight: each favoured kind appears far more often
    for (const k of ['car', 'busStop', 'nursery', 'kiosk', 'townHall', 'library', 'booth', 'prison']) expect(n[k]!).toBeGreaterThan(n.school! * 1.4);
    expect(n.shop!).toBeLessThan(n.car! / 1.4);
  });

  test('never a ruined or burning target, never the same target twice; one free target → one attack; none → the second beat alone', () => {
    const t = new Targets();
    for (const id of ['school', 'shop', 'nursery', 'kiosk', 'townHall', 'library', 'busStop', 'boothRed', 'boothBlue', 'prison'] as const) t.ruin(id, `${id}#x`);
    // only the two cars are free: car + car (two distinct targets)
    for (let s = 1; s <= 20; s++) expect(roundPlan(9, rng(s), t).beats[0]).toEqual(['car', 'car']);
    t.ignite('car1', 'car#x');
    for (let s = 1; s <= 20; s++) expect(roundPlan(9, rng(s), t).beats).toEqual([['car'], ['rescue']]);
    t.ruin('car2', 'car#y');
    expect(roundPlan(9, rng(1), t).beats).toEqual([['rescue']]);
  });

  test('twists unchanged: weapon drop every round, second urgency on odd rounds', () => {
    const t = new Targets();
    for (let r = 5; r <= 11; r++)
      expect(roundPlan(r, rng(r), t).twists).toEqual(r % 2 === 1 ? ['weaponDrop', 'secondUrgency'] : ['weaponDrop']);
  });

  test('same seed, same plan', () => {
    for (let s = 1; s <= 40; s++) {
      const r = 5 + (s % 7);
      expect(roundPlan(r, rng(s), new Targets(), ['car', 'shop'])).toEqual(roundPlan(r, rng(s), new Targets(), ['car', 'shop']));
    }
  });
});

describe('two urgencies at once from round 5 (sim)', () => {
  /** Plays seed `seed` up to the start of round `upTo + 1`, collecting each round's events. */
  function play(seed: number, upTo: number, koAfterSec = 1) {
    const sim = new Sim(seed, { invulnerable: true });
    const rounds = new Map<number, SimEvent[]>();
    /** Events of the step each round started on. */
    const opening = new Map<number, SimEvent[]>();
    let peak = 0;
    let maxK = 0;
    for (let i = 0; i < 60 * 3000 && sim.director.round <= upTo; i++) {
      const ev = sim.step(autopilot(sim, { koAfterSec }));
      const r = sim.director.round;
      if (!rounds.has(r)) rounds.set(r, []);
      rounds.get(r)!.push(...ev);
      if (ev.some((e) => e.type === 'RoundStarted')) opening.set(r, ev);
      const n = urgentAll(sim);
      expect(n).toBeLessThanOrEqual(urgentCap(r));
      peak = Math.max(peak, n);
      const s = sim.snapshot();
      expect(s.roundKos).toBeLessThanOrEqual(s.roundTotal);
      maxK = Math.max(maxK, s.roundKos);
      expect(sim.horde.active().length).toBeLessThanOrEqual(CONFIG.caps.hostiles);
    }
    return { sim, rounds, opening, peak };
  }

  test('rounds 5, 7 and 9 open with two attacks on distinct free targets at once; no third urgency from the twist', () => {
    for (const seed of [1, 4]) {
      const { sim, rounds, opening } = play(seed, 9);
      expect(sim.director.round).toBe(10);
      for (const r of [5, 6, 7, 8, 9]) {
        const ev = rounds.get(r)!;
        const [rs] = of(ev, 'RoundStarted');
        expect(rs).toBeDefined();
        // both attacks start on the round's first step (same tick as RoundStarted)
        const firstTick = opening.get(r)!;
        const targets = firstTick.flatMap((e): TargetId[] =>
          e.type === 'CasseStarted' && e.round === r ? [e.target] : e.type === 'SchoolStarted' && e.wave === r ? ['school'] : [],
        );
        expect(targets).toHaveLength(2);
        expect(new Set(targets).size).toBe(2);
        expect(rs!.headline).toBe(kindOf(targets[0]!));
        if (r === 5) expect(targets.map(kindOf).sort()).toEqual(['kiosk', 'nursery']);
        if (r === 7) expect(targets.map(kindOf)).toContain('townHall');
        if (r === 9) expect(targets.map(kindOf)).toContain('library');
        // the roster covers both attacks
        const objective = sim.attacks.filter((a) => a.round === r && targets.includes(a.target));
        expect(rs!.total).toBeGreaterThanOrEqual(Math.max(tableTotal(r), objective.reduce((n, a) => n + a.total(), 0)));
      }
    }
  });

  test('the twist second urgency is skipped while two urgencies run (no third urgency)', () => {
    for (const seed of [2, 3]) {
      const sim = new Sim(seed, { invulnerable: true });
      for (let i = 0; i < 60 * 3000 && sim.director.round < 5; i++) sim.step(autopilot(sim, { koAfterSec: 1 }));
      expect(sim.director.round).toBe(5);
      const opening = sim.attacks.filter((a) => a.round === 5);
      expect(opening).toHaveLength(2);
      // KO everyone but one contact of each opening attack: both stay urgent through the twist
      const keep = new Map<string, number>();
      let twist: Ev<'TwistStarted'>[] = [];
      for (let i = 0; i < 60 * 120 && twist.length === 0; i++) {
        for (const h of sim.horde.active()) {
          const a = opening.find((x) => x.id === h.incidentId);
          if (a && h.role === 'contact' && (keep.get(a.id) ?? h.lifeId) === h.lifeId) {
            keep.set(a.id, h.lifeId);
            continue;
          }
          if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId, h.pos);
        }
        twist = of(sim.step(autopilot(sim, { koAfterSec: 1e9 })), 'TwistStarted');
        expect(urgentAll(sim)).toBeLessThanOrEqual(2);
      }
      expect(opening.every((a) => a.urgent())).toBe(true);
      expect(twist.map((t) => t.kind)).toEqual(['weaponDrop']);
      expect(sim.attacks.filter((a) => a.round === 5)).toHaveLength(2);
    }
  });

  test('rounds 1-4 are unchanged: one casse first, the rescue / monument after', () => {
    const { opening } = play(6, 4);
    for (const r of [1, 2, 3, 4]) {
      const firstTick = opening.get(r)!;
      expect(of(firstTick, 'CasseStarted').length + of(firstTick, 'SchoolStarted').length).toBe(1);
    }
  });

  test('two attacks never eat the fill: the roster keeps room for the pack, the Caïd, the brutes and the shooters', () => {
    expect(fillReserve(6)).toBeGreaterThanOrEqual(CONFIG.runner.pack[0] + 1 + bruteCount(6) + shooterCount(6));
    const sim = new Sim(5, { invulnerable: true });
    const seen = new Map<number, { round: number | null; role: string }>();
    for (let i = 0; i < 60 * 3000 && sim.director.round <= 9; i++) {
      const ev = sim.step(autopilot(sim));
      for (const h of sim.horde.list) if (!seen.has(h.lifeId)) seen.set(h.lifeId, { round: h.round, role: h.role });
      const rs = of(ev, 'RoundStarted')[0];
      if (rs && rs.index >= TWO_URGENCIES_FROM) {
        const objective = sim.attacks.filter((a) => a.round === rs.index).reduce((n, a) => n + a.total(), 0);
        expect(rs.total).toBeGreaterThanOrEqual(objective + fillReserve(rs.index));
      }
    }
    for (let r = 5; r <= 9; r++) {
      const roles = [...seen.values()].filter((x) => x.round === r).map((x) => x.role);
      expect(roles.filter((x) => x === 'shooter').length, `round ${r}`).toBe(shooterCount(r));
      expect(roles.filter((x) => x === 'brute').length, `round ${r}`).toBe(bruteCount(r));
      expect(roles.filter((x) => x === 'boss').length, `round ${r}`).toBe(1);
      expect(roles.filter((x) => x === 'runner').length, `round ${r}`).toBeGreaterThanOrEqual(CONFIG.runner.pack[0]);
    }
  });

  test('a bot play-through reaches round 6+ without a stall, K ≤ T all along', () => {
    const { sim } = play(12, 6, 3);
    expect(sim.director.round).toBeGreaterThanOrEqual(7);
  });
});
