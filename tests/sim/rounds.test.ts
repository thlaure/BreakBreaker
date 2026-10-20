import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { pressure, roundPlan, tableTotal, urgentCap } from '../../src/sim/director';
import { lineup } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { rng } from '../../src/sim/rng';
import { Sim } from '../../src/sim/sim';
import { Targets } from '../../src/sim/targets';
import type { SimEvent } from '../../src/sim/types';
import { IDLE, autopilot } from './autopilot';

type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const SCHOOL_R1 = lineup('school', 1, 0);
const SCHOOL_TOTAL = SCHOOL_R1.firstLine.length + SCHOOL_R1.reinforcements.length;

/** Steps with the autopilot until `until` holds (checked after each step) or `maxSec` of sim time. */
function drive(sim: Sim, until: (ev: SimEvent[]) => boolean, opts: { koAfterSec?: number; maxSec?: number } = {}): SimEvent[] {
  const all: SimEvent[] = [];
  const steps = Math.round((opts.maxSec ?? 600) / CONFIG.step);
  for (let i = 0; i < steps; i++) {
    const ev = sim.step(autopilot(sim, opts));
    all.push(...ev);
    if (until(ev)) return all;
  }
  throw new Error('drive: condition never met');
}
const roundStarted = (n: number) => (ev: SimEvent[]) => ev.some((e) => e.type === 'RoundStarted' && e.index === n);
const roundCompleted = (n: number) => (ev: SimEvent[]) => ev.some((e) => e.type === 'RoundCompleted' && e.index === n);
const urgent = (sim: Sim): number =>
  sim.attacks.filter((a) => a.urgent()).length + (sim.rescue?.stage === 'threat' ? 1 : 0);

describe('round catalogue', () => {
  test('totals, urgency cap and pressure', () => {
    expect([1, 2, 3, 4, 5, 6, 10, 20].map(tableTotal)).toEqual([10, 14, 18, 22, 26, 30, 40, 40]);
    expect([1, 2, 3, 4].map(urgentCap)).toEqual([1, 1, 2, 2]);
    expect(pressure(1, 0)).toBe(1);
    expect(pressure(2, 29)).toBe(2);
    expect(pressure(3, 30)).toBe(3);
    expect(pressure(50, 500)).toBe(CONFIG.pressureMax);
  });

  test('round 1 = school then rescue; round 2 = car or bus stop then rescue + weapon drop; then alternating twists', () => {
    const t = new Targets();
    expect(roundPlan(1, rng(1), t)).toEqual({ headline: 'school', beats: [['school'], ['rescue']], twist: null });
    const kinds = new Set<string>();
    for (let s = 1; s <= 30; s++) {
      const p = roundPlan(2, rng(s), t);
      expect(['car', 'busStop']).toContain(p.headline);
      expect(p.beats).toEqual([[p.headline], ['rescue']]);
      expect(p.twist).toBe('weaponDrop');
      kinds.add(p.headline);
    }
    expect(kinds.size).toBe(2);
    for (let r = 3; r <= 8; r++) {
      const p = roundPlan(r, rng(r), t);
      expect(p.beats).toHaveLength(2);
      expect(p.beats[1]).toEqual(['rescue']);
      expect(p.twist).toBe(r % 2 === 1 ? 'secondUrgency' : 'weaponDrop');
    }
  });

  test('a kind used last round is drawn half as often from round 3', () => {
    const t = new Targets();
    const n = { school: 0, car: 0, busStop: 0 } as Record<string, number>;
    for (let s = 1; s <= 600; s++) n[roundPlan(3, rng(s), t, 'school').headline]! += 1;
    // weights 1 / 2 / 2 → school ≈ 20 %
    expect(n.school! / 600).toBeGreaterThan(0.12);
    expect(n.school! / 600).toBeLessThan(0.28);
  });
});

describe('rounds in the sim', () => {
  test('round is 1 from the start; intro 4 s; round 1 = school then rescue, RoundStarted {1, total: 10 + rescue}', () => {
    const sim = new Sim(3, { invulnerable: true });
    expect(sim.snapshot()).toMatchObject({ round: 1, roundPhase: 'intro', roundTotal: 0, roundKos: 0, lastSummary: null });
    const intro = Math.round(CONFIG.round.introSec / CONFIG.step);
    for (let i = 0; i < intro - 1; i++) expect(of(sim.step(IDLE), 'RoundStarted')).toEqual([]);
    expect(sim.snapshot().roundPhase).toBe('intro');
    const ev = sim.step(IDLE);
    const [rs] = of(ev, 'RoundStarted');
    expect(rs).toMatchObject({ index: 1, headline: 'school' });
    expect(of(ev, 'SchoolStarted')).toEqual([
      { type: 'SchoolStarted', incidentId: 'school#1', pos: DISTRICT.school.door, wave: 1, total: rs!.total },
    ]);
    expect(sim.snapshot()).toMatchObject({ round: 1, roundPhase: 'play', roundTotal: rs!.total, roundKos: 0 });
    const rest = drive(sim, (e) => e.some((x) => x.type === 'RescueStarted'));
    expect(sim.school.stage).toBe('saved');
    const [rescue] = of(rest, 'RescueStarted');
    expect(rs!.total).toBe(SCHOOL_TOTAL + sim.rescue!.total);
    expect(sim.rescue!.total).toBeGreaterThanOrEqual(CONFIG.rescue.aggressors[0]);
    expect(sim.rescue!.total).toBeLessThanOrEqual(CONFIG.rescue.aggressors[1]);
    expect(rescue).toMatchObject({ incidentId: 'rescue#1', wave: 1, total: rs!.total });
    expect(of(rest, 'RoundStarted')).toEqual([]);
  });

  test('round 2 headline is car or busStop and its twist drops a weapon at half the roster', () => {
    const sim = new Sim(5, { invulnerable: true });
    const ev = drive(sim, roundStarted(2));
    const [rs] = of(ev, 'RoundStarted').filter((e) => e.index === 2);
    expect(['car', 'busStop']).toContain(rs!.headline);
    const [casse] = of(ev, 'CasseStarted');
    expect(casse).toMatchObject({ kind: rs!.headline, round: 2, total: rs!.total });
    expect(rs!.total).toBe(tableTotal(2));
    let twists: Ev<'TwistStarted'>[] = [];
    for (let i = 0; i < 60 * 300 && sim.director.round === 2 && sim.director.phase === 'play'; i++) {
      const before = sim.director.roundKos(sim);
      const e = sim.step(autopilot(sim));
      const t = of(e, 'TwistStarted');
      if (t.length > 0) {
        expect(before).toBeLessThan(Math.ceil(CONFIG.round.twistAt * rs!.total));
        expect(sim.director.roundKos(sim)).toBeGreaterThanOrEqual(Math.ceil(CONFIG.round.twistAt * rs!.total));
        const w = sim.snapshot().weaponsOnGround.find((g) => g.pos.x === t[0]!.pos!.x && g.pos.y === t[0]!.pos!.y);
        expect(w).toBeDefined();
        const d = Math.hypot(w!.pos.x - sim.player.pos.x, w!.pos.y - sim.player.pos.y);
        expect(d).toBeGreaterThanOrEqual(CONFIG.weapons.minDist - 32);
        expect(d).toBeLessThanOrEqual(CONFIG.weapons.maxDist + 32);
      }
      twists = [...twists, ...t];
    }
    expect(twists).toHaveLength(1);
    expect(twists[0]!.kind).toBe('weaponDrop');
  });

  test('round 3 secondUrgency starts a second attack and raises the total (RoundTotalChanged)', () => {
    const sim = new Sim(8, { invulnerable: true });
    const ev = drive(sim, roundStarted(3));
    const [rs] = of(ev, 'RoundStarted').filter((e) => e.index === 3);
    expect(sim.director.plan!.twist).toBe('secondUrgency');
    const before = new Set(sim.attacks.filter((a) => a.round === 3).map((a) => a.target));
    const rest = drive(sim, (e) => e.some((x) => x.type === 'TwistStarted'));
    const [tw] = of(rest, 'TwistStarted');
    expect(tw!.kind).toBe('secondUrgency');
    const extra = sim.attacks.filter((a) => a.round === 3 && !before.has(a.target));
    expect(extra).toHaveLength(1);
    expect(extra[0]!.urgent()).toBe(true);
    const [changed] = of(rest, 'RoundTotalChanged');
    expect(changed).toEqual({ type: 'RoundTotalChanged', index: 3, total: rs!.total + extra[0]!.total() });
    expect(sim.snapshot().roundTotal).toBe(changed!.total);
    const started = [...of(rest, 'CasseStarted'), ...of(rest, 'SchoolStarted')];
    expect(started.map((e) => e.incidentId)).toContain(extra[0]!.id);
    const done = drive(sim, roundCompleted(3));
    expect(sim.snapshot().roundKos).toBe(changed!.total);
    expect(of(done, 'RoundCompleted')).toHaveLength(1);
  });

  test('the second urgency goes for a target not attacked yet this round whenever one is free (seeds 1-12, rounds 3 and 5)', () => {
    let mattered = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const sim = new Sim(seed, { invulnerable: true });
      for (let i = 0; i < 60 * 1200 && sim.director.round <= 5; i++) {
        const ev = sim.step(autopilot(sim));
        if (!ev.some((e) => e.type === 'TwistStarted' && e.kind === 'secondUrgency')) continue;
        const r = sim.director.round;
        const extra = sim.attacks[sim.attacks.length - 1]!;
        const earlier = new Set(sim.attacks.filter((a) => a.round === r && a !== extra).map((a) => a.target));
        const free = DISTRICT.targets.filter(
          (t) => sim.targets.standing(t.id) && !sim.attacks.some((a) => a !== extra && a.target === t.id && !a.resolved()),
        );
        if (free.some((t) => earlier.has(t.id))) mattered++;
        if (free.some((t) => t.id !== extra.target && !earlier.has(t.id))) expect(earlier.has(extra.target)).toBe(false);
      }
    }
    // some twists had an already-attacked target free again: the rule was actually exercised
    expect(mattered).toBeGreaterThan(0);
  });

  test('never more than 1 urgent incident in rounds 1-2 and 2 from round 3', () => {
    const sim = new Sim(13, { invulnerable: true });
    let peak = 0;
    for (let i = 0; i < 60 * 1200 && sim.director.round <= 6; i++) {
      sim.step(autopilot(sim, { koAfterSec: 15 }));
      const n = urgent(sim);
      expect(n).toBeLessThanOrEqual(urgentCap(sim.director.round));
      peak = Math.max(peak, n);
    }
    expect(sim.director.round).toBe(7);
    expect(peak).toBeGreaterThanOrEqual(1);
  });

  test('toolboxes are placed at round start as well (round 1 has two on the ground, none within 64 px of Paul)', () => {
    const sim = new Sim(3, { invulnerable: true });
    expect(sim.toolboxes.ground).toHaveLength(0);
    const ev = drive(sim, roundStarted(1));
    expect(of(ev, 'ToolboxSpawned')).toHaveLength(CONFIG.kit.maxGround);
    expect(sim.toolboxes.ground).toHaveLength(CONFIG.kit.maxGround);
    for (const g of sim.toolboxes.ground)
      expect(Math.hypot(g.pos.x - sim.player.pos.x, g.pos.y - sim.player.pos.y)).toBeGreaterThanOrEqual(CONFIG.kit.minPlaceFromPlayer);
  });

  test('breather: 6 s with no entry after the whole roster is KO; stations recharged; toolboxes refilled to 2; RoundCompleted bonus only if all objectives succeeded', () => {
    const sim = new Sim(3, { invulnerable: true });
    sim.stations.list[0]!.charged = false;
    const before = sim.rules.score;
    const kos0 = sim.rules.kos;
    const ev = drive(sim, roundCompleted(1));
    const last = ev.slice(ev.findIndex((e) => e.type === 'RoundCompleted'));
    expect(of(last, 'RoundCompleted')).toEqual([{ type: 'RoundCompleted', index: 1, bonus: true }]);
    expect(last.some((e) => e.type === 'StationsRecharged')).toBe(true);
    expect(sim.stations.list.every((s) => s.charged)).toBe(true);
    expect(sim.toolboxes.ground).toHaveLength(CONFIG.kit.maxGround);
    const s = sim.snapshot();
    expect(s.roundPhase).toBe('breather');
    expect(s.breatherLeft).toBeCloseTo(CONFIG.round.breatherSec, 6);
    expect(s.lastSummary).toEqual({
      index: 1,
      kos: s.roundTotal,
      objectives: [
        { kind: 'school', result: 'réussi' },
        { kind: 'rescue', result: 'réussi' },
      ],
      points: sim.rules.score - before,
      bonus: true,
    });
    // every KO +1 (flow-keeper patrols included), school saved, rescue, round bonus
    expect(sim.rules.score - before).toBe(sim.rules.kos - kos0 + 8 + CONFIG.rescue.bonus + CONFIG.round.bonus);
    expect(sim.horde.active()).toHaveLength(0);
    const lastId = Math.max(0, ...sim.horde.list.map((h) => h.lifeId));
    const breather = Math.round(CONFIG.round.breatherSec / CONFIG.step);
    for (let i = 0; i < breather - 1; i++) {
      expect(of(sim.step(IDLE), 'RoundStarted')).toEqual([]);
      expect(sim.horde.list.every((h) => h.lifeId <= lastId)).toBe(true);
    }
    expect(sim.snapshot().breatherLeft).toBeGreaterThan(0);
    expect(of(sim.step(IDLE), 'RoundStarted')).toHaveLength(1);
    expect(sim.snapshot()).toMatchObject({ round: 2, roundPhase: 'play', roundKos: 0 });
    expect(sim.rules.stats).toMatchObject({ roundsCompleted: 1, roundsPerfect: 1, targetsSaved: 1, schoolsSaved: 1 });
  });

  test('the breather is a real rest: nobody on the map from the round end to the next round (seeds 1-6, KO after 0/2/6 s)', () => {
    for (let seed = 1; seed <= 6; seed++)
      for (const koAfterSec of [0, 2, 6]) {
        const sim = new Sim(seed, { invulnerable: true });
        drive(sim, roundCompleted(1), { koAfterSec });
        expect(sim.horde.active(), `seed ${seed} ko ${koAfterSec}`).toHaveLength(0);
        while (sim.director.phase === 'breather') {
          sim.step(IDLE);
          if (sim.director.phase === 'breather') expect(sim.horde.active(), `seed ${seed} ko ${koAfterSec}`).toHaveLength(0);
        }
        expect(sim.director.round).toBe(2);
      }
  });

  test('a patrol standing at the round end leaves the map', () => {
    const sim = new Sim(2, { invulnerable: true });
    drive(sim, () => sim.rescue?.stage === 'secured');
    const patrol = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { ...DISTRICT.hostileSpawns[0]! } })!;
    const kos = sim.rules.kos;
    for (let i = 0; i < 60 * 5 && sim.director.phase === 'play'; i++) sim.step(IDLE);
    expect(sim.director.phase).toBe('breather');
    expect(sim.horde.list.some((h) => h.lifeId === patrol.lifeId)).toBe(false);
    expect(sim.rules.kos).toBe(kos); // leaving is not a KO
  });

  test('round KOs do not depend on how often the snapshot is read; an all-KO round ends at K = T', () => {
    const run = (snap: boolean) => {
      const sim = new Sim(21, { invulnerable: true });
      const out: { index: number; kos: number; total: number }[] = [];
      for (let i = 0; i < 60 * 1200 && out.length < 8; i++) {
        const ev = sim.step(autopilot(sim));
        if (snap) sim.snapshot();
        if (ev.some((e) => e.type === 'RoundCompleted'))
          out.push({ index: sim.director.lastSummary!.index, kos: sim.director.lastSummary!.kos, total: sim.director.total });
      }
      return out;
    };
    const headless = run(false);
    expect(headless.map((r) => r.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(run(true)).toEqual(headless);
    for (const r of headless) expect(r.kos).toBe(r.total);
  });

  test('a lost school: RoundCompleted without bonus, objective « perdu », session goes on', () => {
    const sim = new Sim(3, { invulnerable: true });
    drive(sim, (e) => e.some((x) => x.type === 'SchoolStarted'));
    sim.targets.get('school').hp = 3;
    const lost = drive(sim, (e) => e.some((x) => x.type === 'BuildingDestroyed'), { koAfterSec: 30 });
    expect(of(lost, 'BuildingDestroyed')[0]).toMatchObject({ target: 'school' });
    const ev = drive(sim, roundCompleted(1));
    expect(of(ev, 'RoundCompleted')).toEqual([{ type: 'RoundCompleted', index: 1, bonus: false }]);
    expect(sim.director.lastSummary!.objectives[0]).toEqual({ kind: 'school', result: 'perdu' });
    expect(sim.rules.stats).toMatchObject({ targetsLost: 1, schoolsLost: 1, roundsCompleted: 1, roundsPerfect: 0 });
    // the reinforcements never sent before the ruin still play out: the breather starts at K = T (§9.1)
    expect(sim.director.lastSummary!.kos).toBe(sim.director.total);
    drive(sim, roundStarted(2));
    expect(sim.rules.ended).toBe(false);
  });

  test('a school ruined before its reinforcements (seed 7, KO after 45 s): they still come, round ends at K = T', () => {
    const sim = new Sim(7, { invulnerable: true });
    const ev = drive(sim, roundCompleted(1), { koAfterSec: 45 });
    expect(of(ev, 'BuildingDestroyed')[0]).toMatchObject({ target: 'school' });
    expect(sim.director.lastSummary!.kos).toBe(sim.director.total);
  });

  test('a failed rescue with aggressors still to spawn: they come anyway, round ends at K = T', () => {
    const sim = new Sim(3, { invulnerable: true });
    // the school is saved the very step its last rioter falls, and the rescue starts at once: keep its last rioters
    // standing (everyone else is knocked out) until they are all on the map
    drive(sim, () => sim.school.stage === 'reinforcements');
    const mine = () => sim.horde.active().filter((h) => h.incidentId === sim.school.id);
    for (let i = 0; i < 60 * 30 && mine().length < SCHOOL_R1.reinforcements.length; i++) {
      for (const h of sim.horde.active()) if (h.incidentId !== sim.school.id && sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId);
      sim.step(IDLE);
    }
    expect(mine()).toHaveLength(SCHOOL_R1.reinforcements.length);
    for (const h of mine()) if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId);
    // the map is full of patrols when the rescue starts: only one aggressor fits, the others stay pending
    const far = DISTRICT.hostileSpawns;
    for (let i = 0; sim.horde.active().length < CONFIG.caps.hostiles - 1; i++)
      sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { ...far[i % far.length]! } });
    for (let i = 0; i < 60 * 30 && !sim.rescue; i++) sim.step(IDLE);
    expect(sim.school.stage).toBe('saved');
    const r = sim.rescue!;
    expect(sim.horde.list.filter((h) => h.incidentId === r.id)).toHaveLength(1);
    expect(r.total).toBeGreaterThan(1);
    r.remaining = 0;
    const failed = sim.step(IDLE);
    expect(of(failed, 'RescueFailed')).toHaveLength(1);
    sim.horde.dismiss((h) => h.round === null);
    drive(sim, roundCompleted(1));
    expect(sim.director.lastSummary!.objectives[1]).toEqual({ kind: 'rescue', result: 'perdu' });
    expect(sim.director.lastSummary!.kos).toBe(sim.director.total);
  });

  test('K counts only round-tagged KOs, never exceeds T; patrols do not count', () => {
    const sim = new Sim(4, { invulnerable: true });
    drive(sim, roundStarted(1));
    const patrol = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { ...DISTRICT.hostileSpawns[0]! } })!;
    expect(patrol.round).toBeNull();
    sim.horde.applyHit(patrol.lifeId, 99);
    sim.rules.onKnockout(patrol.lifeId);
    expect(sim.snapshot().roundKos).toBe(0);
    let maxK = 0;
    for (let i = 0; i < 60 * 600 && sim.director.round < 4; i++) {
      sim.step(autopilot(sim, { koAfterSec: 1 }));
      const s = sim.snapshot();
      expect(s.roundKos).toBeGreaterThanOrEqual(0);
      expect(s.roundKos).toBeLessThanOrEqual(s.roundTotal);
      if (s.roundPhase === 'breather') expect(s.roundKos).toBe(s.roundTotal);
      maxK = Math.max(maxK, s.roundKos);
    }
    expect(maxK).toBeGreaterThan(10);
    expect(sim.rules.kos).toBeGreaterThan(maxK);
  });

  test('a queued rioter refused by the 40 cap keeps the round open; pruned KO bodies do not', () => {
    const sim = new Sim(6, { invulnerable: true });
    drive(sim, () => sim.rescue?.stage === 'secured');
    // the horde is full of patrols and one rioter of the round still waits in the queue
    const far = DISTRICT.hostileSpawns;
    for (let i = 0; sim.horde.active().length < CONFIG.caps.hostiles; i++)
      sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { ...far[i % far.length]! } });
    sim.queue.request([{ variant: 'antifa', role: 'contact', round: 1 }]);
    const ev: SimEvent[] = [];
    for (let i = 0; i < 60 * 10; i++) ev.push(...sim.step(IDLE));
    expect(sim.rescue!.stage).toBe('completed');
    expect(of(ev, 'RoundCompleted')).toEqual([]);
    expect(sim.queue.pendingForRound(1)).toBe(1);
    expect(sim.director.phase).toBe('play');
    drive(sim, roundCompleted(1));
    // round 3 kills more than 16 of its rioters: their pruned bodies never hold it open
    drive(sim, roundStarted(3));
    drive(sim, roundCompleted(3));
    expect(sim.director.total).toBeGreaterThan(16);
    expect(sim.snapshot().roundKos).toBe(sim.director.total);
  });

  test('a ruined target is never drawn again until repaired; its planned rioters join the fill', () => {
    const t = new Targets();
    for (const id of ['car1', 'car2', 'busStop'] as const) t.ruin(id, `${id}#x`);
    expect(roundPlan(2, rng(1), t)).toEqual({ headline: 'rescue', beats: [['rescue']], twist: 'weaponDrop' });
    for (let s = 1; s <= 40; s++) expect(roundPlan(3 + (s % 5), rng(s), t).beats[0]).toEqual(['school']);
    t.ruin('school', 'school#x');
    expect(roundPlan(4, rng(1), t).beats).toEqual([['rescue']]);
    t.repair('car2');
    expect(roundPlan(2, rng(1), t).beats[0]).toEqual(['car']);

    const sim = new Sim(7, { invulnerable: true });
    drive(sim, roundCompleted(1));
    for (const id of ['car1', 'car2', 'busStop'] as const) sim.targets.ruin(id, `${id}#x`);
    const ev = drive(sim, roundCompleted(2));
    const [rs] = of(ev, 'RoundStarted');
    expect(rs).toMatchObject({ index: 2, headline: 'rescue', total: tableTotal(2) });
    expect(of(ev, 'CasseStarted')).toEqual([]);
    expect(sim.director.lastSummary).toMatchObject({ index: 2, kos: tableTotal(2), objectives: [{ kind: 'rescue', result: 'réussi' }] });
    // fill = total − rescue aggressors, every one of them knocked out
    const fill = sim.horde.list.filter((h) => h.round === 2 && h.role !== 'aggressor').length;
    expect(fill).toBeGreaterThan(0);
  });

  test('steady flow: autopilot {koAfterSec: 2} over 5 rounds never leaves > 3 s without an active rioter outside intro, cinematic and breather', () => {
    const sim = new Sim(9, { invulnerable: true });
    let empty = 0;
    let worst = 0;
    for (let i = 0; i < 60 * 1500 && sim.director.round <= 5; i++) {
      sim.step(autopilot(sim, { koAfterSec: 2 }));
      if (sim.director.phase !== 'play' || sim.school.suspended()) {
        empty = 0;
        continue;
      }
      if (sim.horde.active().length === 0) empty += CONFIG.step;
      else empty = 0;
      worst = Math.max(worst, empty);
    }
    expect(sim.director.round).toBe(6);
    expect(worst).toBeLessThanOrEqual(3);
  });

  test('HP, score, rocks, held weapon and toolbox carry over between rounds; a lost target never ends the session', () => {
    const sim = new Sim(10, { invulnerable: true });
    drive(sim, roundCompleted(1));
    sim.player.hp = 40;
    sim.rocks.carried = 2;
    sim.weapons.held = { kind: 'baton', uses: 5 };
    sim.toolboxes.carried = true;
    sim.targets.ruin('car1', 'car1#x');
    const score = sim.rules.score;
    while (sim.director.round === 1) sim.step(IDLE);
    expect(sim.director.round).toBe(2);
    expect(sim.player.hp).toBe(40);
    expect(sim.rocks.carried).toBe(2);
    expect(sim.weapons.held).toEqual({ kind: 'baton', uses: 5 });
    expect(sim.toolboxes.carried).toBe(true);
    expect(sim.rules.score).toBe(score);
    expect(sim.rules.ended).toBe(false);
    expect(sim.snapshot().targets.find((t) => t.id === 'car1')).toMatchObject({ state: 'ruined', hp: 0, prop: true });
  });

  test('determinism over 4 rounds with autopilot; hostile count never exceeds 40 over 20 rounds', () => {
    const run = () => {
      const sim = new Sim(99, { invulnerable: true });
      const ev = drive(sim, roundStarted(5), { koAfterSec: 3 });
      return { ev, snap: sim.snapshot() };
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(JSON.parse(JSON.stringify(a.snap))).toEqual(a.snap);

    const sim = new Sim(21, { invulnerable: true });
    let peak = 0;
    for (let i = 0; i < 60 * 3600 && sim.director.round <= 20; i++) {
      sim.step(autopilot(sim));
      peak = Math.max(peak, sim.horde.active().length);
      expect(sim.horde.active().length).toBeLessThanOrEqual(CONFIG.caps.hostiles);
    }
    expect(sim.director.round).toBe(21);
    expect(sim.rules.stats.roundsCompleted).toBe(20);
    expect(peak).toBeGreaterThan(0);
  });
});

describe('snapshot', () => {
  test('targets, toolboxes, molotovs and hostile windups are plain render data', () => {
    const sim = new Sim(2, { invulnerable: true });
    drive(sim, roundStarted(1));
    let s = sim.snapshot();
    expect(s.targets.map((t) => t.id)).toEqual(DISTRICT.targets.map((t) => t.id));
    expect(s.targets.find((t) => t.id === 'school')).toMatchObject({ kind: 'school', state: 'attacked', hp: 100, maxHp: 100, prop: false, burning: false });
    expect(s.targets.find((t) => t.id === 'busStop')).toMatchObject({ state: 'intact', maxHp: 60, prop: true });
    // toolboxes are placed at round start too (round 1 has some)
    expect(s.toolboxes).toMatchObject({ carried: false, progress: 0, message: null, repairTarget: null, canRepair: false, repairKind: null, started: false });
    expect(s.toolboxes.ground).toHaveLength(CONFIG.kit.maxGround);
    expect(s.molotovs).toEqual([]);
    let thrown: Ev<'MolotovThrown'> | null = null;
    for (let i = 0; i < 60 * 40 && !thrown; i++) {
      [thrown = null] = of(sim.step(IDLE), 'MolotovThrown');
      s = sim.snapshot();
      for (const h of s.hostiles) expect(h.windup).toBe(h.state === 'windup');
    }
    expect(thrown).not.toBeNull();
    expect(s.molotovs).toEqual([{ from: thrown!.from, to: thrown!.to, until: expect.closeTo(sim.now + 0.6, 6) }]);
    expect(s.targets.find((t) => t.id === 'school')!.burning).toBe(true);
    for (let i = 0; i < 40; i++) sim.step(IDLE);
    expect(sim.snapshot().molotovs).toEqual([]);
  });
});

test('a toolbox repair in the sim: ready until Agir is pressed, then snapshot progress, TargetRepaired, stats.repairs', () => {
  const sim = new Sim(12, { invulnerable: true });
  const door = DISTRICT.targets.find((t) => t.id === 'busStop')!.door;
  sim.targets.ruin('busStop', 'busStop#x');
  sim.toolboxes.carried = true;
  sim.player.pos = { ...door };
  for (let i = 0; i < 30; i++) sim.step(IDLE);
  expect(sim.snapshot().toolboxes).toMatchObject({ carried: true, repairTarget: 'busStop', message: null, canRepair: true, repairKind: 'ruin', started: false, progress: 0 });
  // one press (F / touch Agir), then the key is released
  sim.step({ ...IDLE, act: true });
  expect(sim.snapshot().toolboxes).toMatchObject({ started: true, repairKind: 'ruin' });
  expect(sim.snapshot().toolboxes.progress).toBeGreaterThan(0);
  const ev: SimEvent[] = [];
  for (let i = 0; i < 60 * CONFIG.kit.repairSec; i++) ev.push(...sim.step(IDLE));
  expect(of(ev, 'TargetRepaired')).toHaveLength(1);
  expect(sim.rules.stats.repairs).toBe(1);
  expect(sim.snapshot().targets.find((t) => t.id === 'busStop')).toMatchObject({ state: 'intact', hp: 60 });
});

describe('a burning target stays so until put out (no fire going out by itself)', () => {
  /** Round 1 with the school set on fire by its Molotov, then every rioter KO: the round ends with the school smouldering. */
  function smouldering(seed = 3) {
    const sim = new Sim(seed, { invulnerable: true });
    // nobody is knocked out until the bottle is thrown
    drive(sim, (e) => e.some((x) => x.type === 'TargetIgnited'), { koAfterSec: 999 });
    const ev = drive(sim, roundCompleted(1));
    return { sim, ev };
  }

  test('attackers cleared while burning: smoulder, the round completes (réussi, bonus), hp keeps dropping at 0.7/s through the round end and the breather, no refill', () => {
    const { sim, ev } = smouldering();
    expect(sim.school.stage).toBe('smoulder');
    expect(of(ev, 'FireOut')).toEqual([]);
    expect(of(ev, 'SchoolRestored')).toEqual([]);
    expect(of(ev, 'RoundCompleted')).toEqual([{ type: 'RoundCompleted', index: 1, bonus: true }]);
    expect(sim.director.lastSummary!.objectives[0]).toEqual({ kind: 'school', result: 'réussi' });
    const school = sim.targets.get('school');
    expect(school.burning).toBe(true);
    expect(school.hp).toBeLessThan(school.maxHp); // not refilled at the round end
    expect(sim.snapshot().targets.find((t) => t.id === 'school')).toMatchObject({ state: 'burning', burning: true });
    const hp = school.hp;
    for (let i = 0; i < 120; i++) sim.step(IDLE);
    expect(sim.director.phase).toBe('breather');
    expect(school.hp).toBeCloseTo(hp - 2 * CONFIG.target.smoulderDps, 6);
    // through the breather into round 2: still burning, still in the attacks the sim steps
    drive(sim, roundStarted(2));
    expect(sim.attacks).toContain(sim.school);
    expect(school.burning).toBe(true);
    expect(school.hp).toBeLessThan(hp - 5 * CONFIG.target.smoulderDps);
  });

  test('put out with the toolbox (press F): saved, +5 once, fire out, hp unchanged afterwards', () => {
    const { sim } = smouldering();
    const door = DISTRICT.school.door;
    sim.toolboxes.carried = true;
    sim.player.pos = { ...door };
    sim.step(IDLE);
    expect(sim.snapshot().toolboxes).toMatchObject({ repairTarget: 'school', canRepair: true, repairKind: 'fire', started: false });
    const score = sim.rules.score;
    const ev = [...sim.step({ ...IDLE, act: true })];
    for (let i = 0; i < 60 * CONFIG.kit.repairSec; i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'FireOut')).toEqual([{ type: 'FireOut', target: 'school' }]);
    expect(of(ev, 'TargetRepaired')).toEqual([{ type: 'TargetRepaired', target: 'school', incidentId: 'school#1' }]);
    expect(of(ev, 'TargetSaved')).toHaveLength(1);
    expect(of(ev, 'SchoolRestored')).toHaveLength(1);
    expect(sim.rules.score - score).toBe(CONFIG.casse.scores.school[2]);
    expect(sim.school.stage).toBe('saved');
    const hp = sim.targets.get('school').hp;
    expect(sim.targets.get('school').burning).toBe(false);
    for (let i = 0; i < 120; i++) sim.step(IDLE);
    expect(sim.targets.get('school').hp).toBe(hp);
    expect(sim.rules.score - score).toBe(CONFIG.casse.scores.school[2]);
    expect(sim.rules.stats).toMatchObject({ repairs: 1, targetsSaved: 1, schoolsSaved: 1 });
  });

  test('a smouldering school burnt down: ruined once, −3 once, BuildingDestroyed', () => {
    const { sim } = smouldering();
    sim.targets.get('school').hp = 0.5;
    const score = sim.rules.score;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 120; i++) ev.push(...sim.step(IDLE));
    expect(of(ev, 'BuildingDestroyed')).toEqual([{ type: 'BuildingDestroyed', incidentId: 'school#1', target: 'school' }]);
    expect(sim.school.stage).toBe('destroyed');
    expect(sim.targets.get('school').state).toBe('ruined');
    expect(sim.rules.score - score).toBe(CONFIG.casse.scores.school[1]);
    expect(sim.rules.stats).toMatchObject({ targetsLost: 1, schoolsLost: 1 });
  });

  test('a burning target is never drawn for a new attack', () => {
    const t = new Targets();
    t.ignite('school', 'school#1');
    for (let s = 1; s <= 60; s++) expect(roundPlan(3 + (s % 5), rng(s), t).headline).not.toBe('school');
    t.ignite('car1', 'car#1');
    t.ignite('car2', 'car#2');
    for (let s = 1; s <= 30; s++) expect(roundPlan(2, rng(s), t).headline).toBe('busStop');
    // in the sim: the smouldering school is not attacked again while it burns (rounds 2-4)
    const { sim } = smouldering();
    for (let i = 0; i < 60 * 600 && sim.director.round <= 4 && sim.targets.get('school').burning; i++) {
      sim.step(autopilot(sim));
      expect(sim.attacks.filter((a) => a.target === 'school' && a !== sim.school && !a.resolved())).toEqual([]);
    }
  });
});
