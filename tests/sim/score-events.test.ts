import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT, targetDoor } from '../../src/sim/map/district';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, SimEvent, TargetId, Vec } from '../../src/sim/types';
import { IDLE, autopilot } from './autopilot';

type ScoreChanged = Extract<SimEvent, { type: 'ScoreChanged' }>;
const scores = (ev: SimEvent[]): ScoreChanged[] => ev.filter((e): e is ScoreChanged => e.type === 'ScoreChanged');
const kindOf = (id: TargetId) => DISTRICT.targets.find((t) => t.id === id)!.kind;
const at = (p: Vec): Vec => ({ x: p.x, y: p.y });

describe('ScoreChanged events (floating score popups)', () => {
  test('a melee KO emits ScoreChanged +1 at the rioter', () => {
    const sim = new Sim(11);
    const p = sim.player.pos;
    const h = sim.horde.spawn({ variant: 'antifa', role: 'contact', pos: { x: p.x + 20, y: p.y }, maxHp: 1 })!;
    const ev = sim.step({ ...IDLE, aim: { x: 1, y: 0 }, strike: true } satisfies InputFrame);
    expect(scores(ev)).toEqual([{ type: 'ScoreChanged', points: 1, pos: at(h.pos) }]);
    // nothing scored: nothing emitted
    expect(scores(sim.step(IDLE))).toEqual([]);
  });

  test('a change without a position shows at Paul', () => {
    const sim = new Sim(5);
    sim.rules.award('test:bonus', 3);
    const ev = sim.step(IDLE);
    expect(scores(ev)).toContainEqual({ type: 'ScoreChanged', points: 3, pos: at(sim.player.pos) });
  });

  /**
   * Autopilot session over rounds 1–4: every outcome event of a step has its ScoreChanged in the same step, at the
   * right place, and the ScoreChanged points sum to the final score.
   */
  function session(seed: number, koAfterSec: number) {
    const sim = new Sim(seed, { invulnerable: true });
    const seen = { saved: 0, lost: 0, rescue: 0, bonus: 0, ko: 0 };
    let sum = 0;
    const all: SimEvent[] = [];
    for (let i = 0; i < 60 * 1800 && sim.director.round <= 4; i++) {
      const ev = sim.step(autopilot(sim, { koAfterSec }));
      all.push(...ev);
      const sc = scores(ev);
      for (const s of sc) sum += s.points;
      const has = (points: number, pos: Vec) => sc.some((s) => s.points === points && s.pos.x === pos.x && s.pos.y === pos.y);
      for (const e of ev) {
        if (e.type === 'TargetSaved') {
          expect(has(CONFIG.casse.scores[kindOf(e.target)][0], targetDoor(e.target))).toBe(true);
          seen.saved++;
        } else if (e.type === 'BuildingDestroyed') {
          expect(has(CONFIG.casse.scores[kindOf(e.target)][1], targetDoor(e.target))).toBe(true);
          seen.lost++;
        } else if (e.type === 'RescueCompleted') {
          expect(has(CONFIG.rescue.bonus, sim.rescue!.victimPos)).toBe(true);
          seen.rescue++;
        } else if (e.type === 'RoundCompleted' && e.bonus) {
          expect(has(CONFIG.round.bonus, sim.player.pos)).toBe(true);
          seen.bonus++;
        }
      }
      seen.ko += sc.filter((s) => s.points === 1).length;
    }
    expect(sim.director.round).toBe(5);
    expect(sum).toBe(sim.rules.score);
    for (const s of scores(all)) expect(s.points).not.toBe(0);
    return { seen, all, score: sim.rules.score };
  }

  test.each([
    [1, 0],
    [2, 0],
    [1, 20],
    [3, 20],
  ])('seed %i, KO after %i s: outcomes score where they happen and ScoreChanged sums to the score', (seed, koAfterSec) => {
    const { seen } = session(seed, koAfterSec);
    expect(seen.ko).toBeGreaterThan(0);
    expect(seen.saved + seen.lost + seen.rescue).toBeGreaterThan(0);
  });

  test('both gains and losses happen over the seeds (saved, destroyed, rescue, round bonus)', () => {
    const fast = session(1, 0).seen;
    const slow = session(3, 20).seen;
    expect(fast.saved).toBeGreaterThan(0);
    expect(fast.rescue).toBeGreaterThan(0);
    expect(fast.bonus).toBeGreaterThan(0);
    expect(slow.lost).toBeGreaterThan(0);
  });

  test('deterministic per seed', () => {
    expect(scores(session(2, 5).all)).toEqual(scores(session(2, 5).all));
  });

  test('a returned belonging emits +itemBonus at the victim; rescue completion +bonus at the victim', () => {
    const sim = new Sim(7, { invulnerable: true });
    const events: SimEvent[][] = [];
    let threatAt: number | null = null;
    for (let i = 0; i < 60 * 240 && sim.rules.stats.roundsCompleted === 0; i++) {
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      const r = sim.rescue;
      if (r?.stage === 'threat' && threatAt === null) threatAt = sim.now;
      const hold = r?.stage === 'threat' && sim.now - threatAt! < 16;
      if (!hold) for (const h of sim.horde.active()) if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId, h.pos);
      if (r?.stage === 'secured') {
        const lying = r.items.find((it) => it.state === 'dropped');
        sim.player.pos = lying ? { ...lying.pos } : { ...r.victimPos };
      }
      events.push(sim.step(IDLE));
    }
    const victim = at(sim.rescue!.victimPos);
    let returned = 0;
    let completed = 0;
    for (const ev of events) {
      const sc = scores(ev);
      const n = ev.filter((e) => e.type === 'ItemReturned').length;
      returned += n;
      expect(sc.filter((s) => s.points === CONFIG.rescue.itemBonus && s.pos.x === victim.x && s.pos.y === victim.y)).toHaveLength(n);
      if (ev.some((e) => e.type === 'RescueCompleted')) {
        completed++;
        expect(sc).toContainEqual({ type: 'ScoreChanged', points: CONFIG.rescue.bonus, pos: victim });
      }
    }
    expect(returned).toBeGreaterThan(0);
    expect(completed).toBe(1);
  });

  test('a repair (or an extinguished fire) scores at the target door', () => {
    const sim = new Sim(4, { invulnerable: true });
    sim.rules.award('school-x:lost', -3);
    sim.targets.ruin('car1', 'car1-x');
    sim.toolboxes.carried = true;
    sim.player.pos = targetDoor('car1');
    // clear the street so the repair is safe
    for (const h of sim.horde.list) h.state = 'ko';
    const all: SimEvent[] = [];
    for (let i = 0; i < 60 * (CONFIG.kit.repairSec + 1); i++) {
      for (const h of sim.horde.active()) if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId, h.pos);
      sim.player.pos = targetDoor('car1');
      all.push(...sim.step({ ...IDLE, act: true }));
    }
    expect(all.some((e) => e.type === 'TargetRepaired' && e.target === 'car1')).toBe(true);
    expect(scores(all)).toContainEqual({ type: 'ScoreChanged', points: CONFIG.casse.scores.car[2], pos: targetDoor('car1') });
  });
});
