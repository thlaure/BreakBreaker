import { describe, expect, test } from 'vitest';
import { FixedClock } from '../../src/sim/clock';
import { CONFIG } from '../../src/sim/config';
import { pressure } from '../../src/sim/director';
import { DISTRICT } from '../../src/sim/map/district';
import { dist } from '../../src/sim/math';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, SimEvent } from '../../src/sim/types';

const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false };
const input = (o: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE, ...o });
const STRIKE_RANGE = CONFIG.melee.range + CONFIG.hostile.radius;

/** Deterministic scripted input for frame i. */
function scripted(i: number): InputFrame {
  const phase = Math.floor(i / 120) % 4;
  const dirs = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  return input({
    move: dirs[phase]!,
    run: i % 240 < 60,
    strike: i % 20 === 0,
    throwRock: i % 50 === 0,
    act: i % 300 > 200,
  });
}

describe('Sim facade', () => {
  test('pressure formula and caps', () => {
    expect(pressure(0, 0)).toBe(1);
    expect(pressure(3, 24)).toBe(2);
    expect(pressure(50, 500)).toBe(12);
    expect(pressure(0, 29)).toBe(1);
    expect(pressure(0, 30)).toBe(2);
  });

  test('scripted bot survives intro: school incident starts within 6 s, no hostile in strike range before 4 s', () => {
    const sim = new Sim(1);
    const steps4 = Math.round(4 / CONFIG.step) - 1;
    for (let i = 0; i < steps4; i++) {
      sim.step(scripted(i));
      const s = sim.snapshot();
      for (const h of s.hostiles) expect(dist(h.pos, s.player.pos)).toBeGreaterThan(STRIKE_RANGE);
      expect(s.school.stage).toBe('idle');
      expect(s.player.ko).toBe(false);
    }
    let started = -1;
    for (let i = steps4; i < Math.round(6 / CONFIG.step); i++) {
      sim.step(scripted(i));
      if (started < 0 && sim.snapshot().school.stage !== 'idle') started = i;
    }
    expect(started).toBeGreaterThan(0);
    const s = sim.snapshot();
    expect(s.hostiles.filter((h) => h.role === 'degrader')).toHaveLength(CONFIG.school.firstLine);
    expect(s.objective).toEqual(DISTRICT.school.door);
    expect(sim.director.phase).toBe('school');
    // spawned at edge points >= 320 px from Paul
    expect(s.hp).toBe(CONFIG.player.maxHp);
  });

  test('director sequences school -> breather -> rescue -> waves with announcements', () => {
    const sim = new Sim(7, { invulnerable: true });
    const events: SimEvent[] = [];
    const phases: string[] = [];
    let rescueDist = -1;
    for (let i = 0; i < 60 * 60 && sim.director.wave < 3; i++) {
      for (const h of sim.horde.active()) {
        const r = sim.horde.applyHit(h.lifeId, 99);
        if (r === 'ko') sim.rules.onKnockout(h.lifeId);
      }
      events.push(...sim.step(IDLE));
      const p = sim.director.phase;
      if (phases[phases.length - 1] !== p) phases.push(p);
      if (p === 'rescue' && rescueDist < 0) rescueDist = dist(sim.snapshot().rescue!.victimPos, sim.player.pos);
    }
    expect(phases).toEqual(['intro', 'school', 'breather', 'rescue', 'waves']);
    expect(events.some((e) => e.type === 'SchoolRestored')).toBe(true);
    expect(events.some((e) => e.type === 'RescueStarted')).toBe(true);
    expect(events.filter((e) => e.type === 'WaveAnnounced').map((e) => (e as { index: number }).index)).toEqual([
      1, 2, 3,
    ]);
    expect(rescueDist).toBeGreaterThan(0);
    expect(sim.rules.stats.schoolsSaved).toBe(1);
  });

  test('hostile count stays bounded over 30 waves, well past the size cap (RC-50)', () => {
    const sim = new Sim(42, { invulnerable: true });
    let maxActive = 0;
    let maxList = 0;
    let maxFlying = 0;
    let maxGround = 0;
    const variants = new Set<string>();
    const roles = new Set<string>();
    let i = 0;
    for (; i < 60 * 1500 && sim.director.wave < 30; i++) {
      // auto-KO helper: every 0.5 s knock out every active hostile but the two newest
      if (i % 30 === 0) {
        const act = sim.horde.active();
        for (const h of act.slice(0, Math.max(0, act.length - 2))) sim.horde.applyHit(h.lifeId, 99);
      }
      sim.step(scripted(i));
      const s = sim.snapshot();
      const active = s.hostiles.filter((h) => h.state !== 'ko').length;
      maxActive = Math.max(maxActive, active);
      maxList = Math.max(maxList, s.hostiles.length);
      maxFlying = Math.max(maxFlying, s.rocks.filter((r) => r.state === 'EnemyFlying' || r.state === 'PlayerFlying').length);
      maxGround = Math.max(maxGround, s.rocks.filter((r) => r.state === 'LandedRecoverable').length);
      for (const h of s.hostiles) {
        variants.add(h.variant);
        roles.add(h.role);
      }
    }
    expect(sim.director.wave).toBeGreaterThanOrEqual(30);
    expect(maxActive).toBeLessThanOrEqual(CONFIG.caps.hostiles);
    expect(maxActive).toBeGreaterThan(4);
    expect(maxList).toBeLessThanOrEqual(CONFIG.caps.hostiles + 16);
    expect(maxFlying).toBeLessThanOrEqual(CONFIG.rock.maxFlying);
    expect(maxGround).toBeLessThanOrEqual(CONFIG.rock.maxGround);
    expect(sim.snapshot().telegraphs.length).toBeLessThanOrEqual(CONFIG.caps.hostiles);
    expect([...variants].sort()).toEqual(['antifa', 'classic', 'palestinian']);
    expect(roles.has('thrower')).toBe(true);
    expect(roles.has('contact')).toBe(true);
    expect(sim.snapshot().ended).toBe(false);
  });

  test('KO ends session; later steps award nothing (RC-41)', () => {
    const sim = new Sim(5);
    sim.player.hp = 3;
    const p = sim.player.pos;
    sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 14, y: p.y } });
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 && !sim.rules.ended; i++) events.push(...sim.step(IDLE));
    expect(events.some((e) => e.type === 'PlayerDamaged')).toBe(true);
    expect(events.filter((e) => e.type === 'PlayerKnockedOut')).toHaveLength(1);
    expect(sim.rules.ended).toBe(true);
    expect(sim.rules.endCause).toBe('ko');
    const s0 = sim.snapshot();
    expect(s0.ended).toBe(true);
    expect(s0.hp).toBe(0);
    const score = sim.rules.score;
    for (let i = 0; i < 600; i++) expect(sim.step(scripted(i))).toEqual([]);
    expect(sim.rules.score).toBe(score);
    expect(sim.snapshot()).toEqual(s0);
    sim.quit();
    expect(sim.rules.endCause).toBe('ko');
  });

  test('station touched on the KO step does not revive Paul (RC-41)', () => {
    const run = (withAttacker: boolean) => {
      const sim = new Sim(9);
      const st = DISTRICT.stations[0]!;
      sim.player.pos = { ...st };
      sim.player.hp = 4;
      if (withAttacker) {
        const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: st.x + 14, y: st.y } })!;
        h.state = 'windup';
        h.stateUntil = 0; // the blow lands on the very first step
        h.nextAttackAt = 99;
      }
      const events: SimEvent[][] = [sim.step(input())];
      return { sim, events };
    };
    const ctrl = run(false);
    expect(ctrl.events[0]).toContainEqual({ type: 'HealCompleted' });
    expect(ctrl.sim.player.hp).toBe(4 + CONFIG.heal.amount);

    const { sim, events } = run(true);
    const last = events[events.length - 1]!;
    expect(last).toContainEqual({ type: 'PlayerKnockedOut' });
    expect(last.some((e) => e.type === 'HealCompleted')).toBe(false);
    expect(sim.player.hp).toBe(0);
    expect(sim.player.ko).toBe(true);
    expect(sim.rules.stats.healsUsed).toBe(0);
    expect(sim.snapshot().stations[0]!.charged).toBe(true);
  });

  test('melee KO scores +1 and emits ActorKnockedOut', () => {
    const sim = new Sim(11);
    const p = sim.player.pos;
    const h = sim.horde.spawn({ variant: 'antifa', role: 'contact', pos: { x: p.x + 20, y: p.y }, maxHp: 1 })!;
    const ev = sim.step(input({ aim: { x: 1, y: 0 }, strike: true }));
    expect(ev).toContainEqual({ type: 'HitConfirmed', targetLifeId: h.lifeId, damage: 1, source: 'melee' });
    expect(ev).toContainEqual({ type: 'ActorKnockedOut', lifeId: h.lifeId });
    expect(sim.rules.score).toBe(1);
    expect(sim.rules.kos).toBe(1);
  });

  test('rock pickup, return and hit update stats and score', () => {
    const sim = new Sim(13);
    sim.rocks.carried = 1;
    const p = sim.player.pos;
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 120, y: p.y }, maxHp: 1 })!;
    const all: SimEvent[] = [];
    all.push(...sim.step(input({ aim: { x: 1, y: 0 }, throwRock: true })));
    for (let i = 0; i < 30; i++) all.push(...sim.step(IDLE));
    expect(all).toContainEqual({ type: 'ActorKnockedOut', lifeId: h.lifeId });
    expect(sim.rules.stats.rocksHit).toBe(1);
    expect(sim.rules.stats.rocksReturned).toBe(1);
    expect(sim.rules.score).toBe(1);
  });

  test('determinism: same seed + same inputs => same snapshot after 3000 steps', () => {
    const a = new Sim(1234);
    const b = new Sim(1234);
    for (let i = 0; i < 3000; i++) {
      a.step(scripted(i));
      b.step(scripted(i));
    }
    const sa = a.snapshot();
    expect(sa).toEqual(b.snapshot());
    expect(JSON.parse(JSON.stringify(sa))).toEqual(sa); // plain data
    expect(sa.now).toBeGreaterThan(0);
  });

  test('pause freezes everything (RC-40, RC-67)', () => {
    const sim = new Sim(77);
    for (let i = 0; i < 60 * 6; i++) sim.step(scripted(i));
    sim.pause();
    const before = sim.snapshot();
    expect(before.paused).toBe(true);
    const clock = new FixedClock(CONFIG.step, CONFIG.maxCatchUpSteps);
    let ran = 0;
    for (let f = 0; f < 600; f++) {
      const n = clock.advance(1 / 60);
      for (let k = 0; k < n; k++) {
        ran++;
        expect(sim.step(scripted(f))).toEqual([]);
      }
    }
    expect(ran).toBeGreaterThan(500);
    expect(sim.snapshot()).toEqual(before);
    sim.resume();
    sim.step(IDLE);
    expect(sim.snapshot().now).toBeGreaterThan(before.now);
  });

  test('quit ends with cause quit and freezes', () => {
    const sim = new Sim(2);
    sim.step(IDLE);
    sim.quit();
    const s = sim.snapshot();
    expect(s.ended).toBe(true);
    expect(s.endCause).toBe('quit');
    expect(sim.step(scripted(0))).toEqual([]);
    expect(sim.snapshot()).toEqual(s);
  });

  test('school cinematic freezes player, horde and director timers', () => {
    const sim = new Sim(21, { invulnerable: true });
    let i = 0;
    for (; i < 60 * 30 && sim.school.stage !== 'cinematic'; i++) {
      for (const h of sim.horde.active()) sim.horde.applyHit(h.lifeId, 99);
      sim.step(IDLE);
    }
    expect(sim.school.stage).toBe('cinematic');
    const before = sim.snapshot();
    sim.step(input({ move: { x: 1, y: 0 } }));
    const after = sim.snapshot();
    expect(after.player.pos).toEqual(before.player.pos);
    expect(after.now).toBe(before.now);
  });
  test('skipCinematic ends the cinematic: next step spawns 8 reinforcements once; no-op otherwise', () => {
    const sim = new Sim(21, { invulnerable: true });
    sim.skipCinematic(); // intro: no-op
    expect(sim.school.stage).toBe('idle');
    let i = 0;
    for (; i < 60 * 30 && sim.school.stage !== 'cinematic'; i++) {
      for (const h of sim.horde.active()) sim.horde.applyHit(h.lifeId, 99);
      sim.step(IDLE);
    }
    expect(sim.school.stage).toBe('cinematic');
    expect(sim.snapshot().school.status).toBe('renforts');
    sim.skipCinematic();
    sim.skipCinematic();
    sim.step(IDLE);
    expect(sim.school.stage).toBe('reinforcements');
    const count = () => sim.horde.active().filter((h) => h.incidentId === sim.school.id).length;
    expect(count()).toBe(CONFIG.school.reinforcements);
    sim.skipCinematic();
    for (let k = 0; k < 30; k++) sim.step(IDLE);
    expect(count()).toBe(CONFIG.school.reinforcements);
  });

  test('EnemyRockThrown is emitted once per enemy rock actually spawned, deterministically', () => {
    const run = () => {
      const sim = new Sim(7, { invulnerable: true });
      const thrown: number[] = [];
      for (let i = 0; i < 60 * 30 && sim.school.stage !== 'cinematic'; i++) {
        for (const h of sim.horde.active()) sim.horde.applyHit(h.lifeId, 99);
        sim.step(IDLE);
      }
      sim.skipCinematic(); // reinforcements include 2 throwers
      for (let i = 0; i < 60 * 30; i++)
        for (const e of sim.step(IDLE)) if (e.type === 'EnemyRockThrown') thrown.push(e.rockId);
      return thrown;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(0);
    expect(new Set(a).size).toBe(a.length);
    expect(run()).toEqual(a);
  });
});
