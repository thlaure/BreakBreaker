import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde } from '../../src/sim/hostiles';
import { RESCUE_ITEMS, RescueIncident } from '../../src/sim/incidents/rescue';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { dist } from '../../src/sim/math';
import { createPlayer } from '../../src/sim/player';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import { Sim } from '../../src/sim/sim';
import type { SimEvent, Vec } from '../../src/sim/types';
import { IDLE } from './autopilot';

const DT = 1 / 60;
const grid = new Grid(DISTRICT);
const site = DISTRICT.rescueSites[0]!;
const paulAway: Vec = { x: site.x + 400, y: site.y };
const R = CONFIG.rescue;

function setup(seed = 1, rules = new Rules(), id = 'rescue#1') {
  const horde = new Horde();
  const player = createPlayer(paulAway);
  const inc = new RescueIncident(id);
  inc.start(horde, site, rng(seed), paulAway, grid, { count: 3 });
  const step = (): SimEvent[] => inc.step(DT, { horde, rules, player });
  const run = (sec: number): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec / DT); i++) ev.push(...step());
    return ev;
  };
  const mine = () => horde.list.filter((h) => h.incidentId === inc.id);
  const threaten = () => mine().forEach((h) => h.state !== 'ko' && (h.state = 'threaten'));
  const koAll = () => mine().forEach((h) => horde.applyHit(h.lifeId, 9999));
  const of = (ev: SimEvent[], type: SimEvent['type']) => ev.filter((e) => e.type === type);
  const state = (i: number) => inc.items[i]!.state;
  return { horde, rules, player, inc, step, run, mine, threaten, koAll, of, state };
}

describe('rescue belongings (« objets volés à rendre »)', () => {
  test('the victim carries 3 ordinary belongings, by kind, all held at start', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { inc } = setup(seed);
      expect(inc.items.map((i) => i.id)).toEqual(RESCUE_ITEMS[inc.kind].map((i) => i.id));
      expect(inc.items).toHaveLength(R.itemCount);
      for (const it of inc.items) expect(it.state).toBe('held');
    }
    expect(RESCUE_ITEMS.elderlyRobbed.map((i) => i.name)).toEqual(['sac à main', 'chapeau', 'canne']);
    expect(RESCUE_ITEMS.groupHarassed.map((i) => i.name)).toEqual(['sac à dos', 'écharpe', 'casquette']);
  });

  test('thefts at 75 / 50 / 25 % of the reserve, by the nearest active aggressor, which carries it', () => {
    const { inc, run, threaten, of, mine } = setup();
    threaten();
    // 25 % of 25 s = 6.25 s per theft
    expect(of(run(6.2), 'ItemStolen')).toHaveLength(0);
    const ev = run(0.1);
    const stolen = of(ev, 'ItemStolen');
    expect(stolen).toHaveLength(1);
    const nearest = [...mine()].sort((a, b) => dist(a.pos, site) - dist(b.pos, site))[0]!;
    expect(stolen[0]).toEqual({ type: 'ItemStolen', rescueId: 'rescue#1', item: inc.items[0]!.id, thiefLifeId: nearest.lifeId });
    expect(inc.items[0]!.state).toBe('carried-by-thief');
    expect(inc.items[0]!.pos).toEqual(nearest.pos);
    nearest.pos = { x: nearest.pos.x + 5, y: nearest.pos.y };
    run(DT);
    expect(inc.items[0]!.pos).toEqual(nearest.pos); // follows its thief
    expect(of(run(6.25), 'ItemStolen')).toHaveLength(1);
    expect(of(run(6.25), 'ItemStolen')).toHaveLength(1);
    expect(inc.items.every((i) => i.state === 'carried-by-thief')).toBe(true);
    expect(of(run(5), 'ItemStolen')).toHaveLength(0); // only 3
  });

  test('aggressors KO before a threshold: that belonging is never stolen', () => {
    const { inc, run, threaten, koAll, of, rules } = setup();
    threaten();
    run(5);
    koAll();
    const ev = run(5);
    expect(of(ev, 'ItemStolen')).toHaveLength(0);
    expect(inc.items.every((i) => i.state === 'held')).toBe(true);
    expect(inc.stage).toBe('completed'); // nothing to wait for: the usual 1.5 s beat
    expect(inc.returnLeft).toBeNull();
    expect(rules.score).toBe(R.bonus);
  });

  test('no theft once every aggressor is KO (secured); a thief KO drops it on a free point', () => {
    const { inc, run, threaten, koAll, of, horde, mine } = setup();
    threaten();
    run(6.3);
    const thief = mine().find((h) => h.lifeId === inc.items[0]!.thief)!;
    // the thief stands in a building wall: the belonging lands on the nearest free point
    const b = DISTRICT.buildings[0]!;
    thief.pos = { x: b.x + b.w / 2, y: b.y + 2 };
    horde.applyHit(thief.lifeId, 9999);
    const ev = run(DT);
    const dropped = of(ev, 'ItemDropped');
    expect(dropped).toHaveLength(1);
    expect(inc.items[0]!.state).toBe('dropped');
    expect(grid.circleBlocked(inc.items[0]!.pos, CONFIG.player.radius)).toBe(false);
    expect(dropped[0]).toEqual({ type: 'ItemDropped', rescueId: 'rescue#1', item: inc.items[0]!.id, pos: inc.items[0]!.pos });
    koAll();
    run(DT);
    expect(inc.stage).toBe('secured');
    expect(of(run(10), 'ItemStolen')).toHaveLength(0);
    expect(inc.items[1]!.state).toBe('held');
  });

  test('pickup within 20 px only; carry up to 3; return within 48 px: +2 each once, all at once', () => {
    const { inc, run, threaten, koAll, of, player, rules, state } = setup();
    threaten();
    run(19);
    koAll();
    run(DT);
    expect(inc.stage).toBe('secured');
    expect(inc.items.every((i) => i.state === 'dropped')).toBe(true);
    // spread them out (one thief may have carried all three)
    inc.items.forEach((it, i) => (it.pos = { x: site.x + 100 + 60 * i, y: site.y }));
    const it0 = inc.items[0]!;
    player.pos = { x: it0.pos.x + R.pickupRadius + 1, y: it0.pos.y };
    expect(of(run(DT), 'ItemPickedUp')).toHaveLength(0);
    player.pos = { x: it0.pos.x + R.pickupRadius - 1, y: it0.pos.y };
    expect(of(run(DT), 'ItemPickedUp')).toEqual([{ type: 'ItemPickedUp', rescueId: 'rescue#1', item: it0.id }]);
    expect(state(0)).toBe('carried');
    for (const it of inc.items.slice(1)) {
      player.pos = { ...it.pos };
      run(DT);
    }
    expect(inc.carried).toBe(3);
    // just outside the return radius: nothing handed back
    player.pos = { x: site.x + R.returnRadius + 2, y: site.y };
    run(DT);
    expect(inc.carried).toBe(3);
    const before = rules.score;
    player.pos = { x: site.x + R.returnRadius - 1, y: site.y };
    const ev = run(DT);
    expect(of(ev, 'ItemReturned')).toHaveLength(3);
    expect(rules.score).toBe(before + 3 * R.itemBonus);
    expect(inc.items.every((i) => i.state === 'returned')).toBe(true);
    expect(inc.returnLeft).toBeNull();
    // all back → the thanks beat starts at once
    run(R.thanksSec - 0.05);
    expect(inc.stage).toBe('secured');
    run(0.1);
    expect(inc.stage).toBe('completed');
    expect(rules.score).toBe(before + 3 * R.itemBonus + R.bonus);
    run(3);
    expect(rules.score).toBe(before + 3 * R.itemBonus + R.bonus);
  });

  test('secured with belongings out: waits returnSec, then the thanks beat; unreturned ones are lost (+6 once)', () => {
    const { inc, run, threaten, koAll, rules } = setup();
    threaten();
    run(13);
    koAll();
    run(DT);
    expect(inc.stage).toBe('secured');
    expect(inc.returnLeft).toBeCloseTo(R.returnSec, 5);
    run(R.returnSec - 0.1);
    expect(inc.stage).toBe('secured');
    expect(inc.returnLeft!).toBeGreaterThan(0);
    expect(rules.score).toBe(0);
    run(0.2);
    expect(inc.returnLeft).toBeNull();
    expect(inc.items.filter((i) => i.state === 'lost')).toHaveLength(2);
    expect(inc.items[2]!.state).toBe('held');
    run(R.thanksSec);
    expect(inc.stage).toBe('completed');
    expect(rules.score).toBe(R.bonus);
    run(3);
    expect(rules.score).toBe(R.bonus);
  });

  test('rescue failure: stolen, dropped and carried belongings are lost', () => {
    const { inc, run, threaten, horde, mine, player, of } = setup();
    threaten();
    run(13);
    // KO one thief: its belonging lies on the ground; Paul takes it but never brings it back
    const t0 = mine().find((h) => h.lifeId === inc.items[0]!.thief)!;
    horde.applyHit(t0.lifeId, 9999);
    run(DT);
    player.pos = { ...inc.items[0]!.pos };
    run(DT);
    expect(inc.items[0]!.state).toBe('carried');
    player.pos = { ...paulAway };
    threaten();
    const ev = run(15);
    expect(inc.stage).toBe('failed');
    expect(of(ev, 'ItemReturned')).toHaveLength(0);
    for (const it of inc.items) expect(it.state).toBe('lost');
    expect(inc.carried).toBe(0);
  });

  test('bonus keys are unique per rescue: two rescues, same belongings, both pay', () => {
    const rules = new Rules();
    for (const id of ['rescue#1', 'rescue#2']) {
      const { inc, run, threaten, koAll, player } = setup(1, rules, id);
      threaten();
      run(6.3);
      koAll();
      run(DT);
      player.pos = { ...inc.items[0]!.pos };
      run(DT);
      player.pos = { ...site };
      run(DT);
      expect(inc.items[0]!.state).toBe('returned');
      run(R.thanksSec + 0.1);
      expect(inc.stage).toBe('completed');
    }
    expect(rules.score).toBe(2 * (R.itemBonus + R.bonus));
  });
});

describe('belongings in the full sim', () => {
  /**
   * KOs every hostile at once, except while a rescue is threatened for less than `rescueSec` s: then nobody is KO'd,
   * and two patrols (outside the round roster) stand in a far corner so more than CONFIG.hostile.fewLeft rioters are
   * active and the aggressors stay on the victim. Once the rescue is secured, Paul teleports onto each dropped
   * belonging, then to the victim (`fetch`).
   */
  function play(seed: number, rescueSec: number, fetch: boolean) {
    const sim = new Sim(seed, { invulnerable: true });
    const events: SimEvent[] = [];
    let threatAt: number | null = null;
    let sawWait = false;
    for (let i = 0; i < 60 * 240 && sim.rules.stats.roundsCompleted === 0; i++) {
      if (sim.school.stage === 'cinematic') sim.skipCinematic();
      const r = sim.rescue;
      if (r?.stage === 'threat' && threatAt === null) {
        threatAt = sim.now;
        for (let k = 0; k < 2; k++) sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 80 + 30 * k, y: 80 } });
      }
      const hold = r?.stage === 'threat' && sim.now - threatAt! < rescueSec;
      if (!hold)
        for (const h of sim.horde.active()) if (sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId);
      if (fetch && r?.stage === 'secured') {
        const lying = r.items.find((it) => it.state === 'dropped');
        sim.player.pos = lying ? { ...lying.pos } : { ...r.victimPos };
      }
      if (sim.snapshot().rescue?.returnLeft != null) sawWait = true;
      events.push(...sim.step(IDLE));
    }
    return { sim, events, sawWait };
  }

  test('round 1 closes with K === T; returned belongings pay +2 each; deterministic per seed', () => {
    const a = play(7, 16, true);
    const stolen = a.events.filter((e) => e.type === 'ItemStolen');
    const back = a.events.filter((e) => e.type === 'ItemReturned');
    expect(stolen.length).toBeGreaterThan(0);
    expect(back).toHaveLength(stolen.length);
    expect(a.sim.rules.stats.rescuesOk).toBe(1);
    const done = a.events.find((e) => e.type === 'RoundCompleted');
    expect(done).toBeDefined();
    expect(a.sim.snapshot().lastSummary!.kos).toBe(a.sim.director.total);
    const b = play(7, 16, true);
    expect(b.events).toEqual(a.events);
    expect(b.sim.snapshot()).toEqual(a.sim.snapshot());
  });

  test('belongings left on the ground: the secured rescue waits, then completes; the round still closes', () => {
    const { sim, events, sawWait } = play(7, 16, false);
    expect(sawWait).toBe(true);
    expect(events.filter((e) => e.type === 'ItemReturned')).toHaveLength(0);
    expect(sim.rules.stats.rescuesOk).toBe(1);
    expect(events.some((e) => e.type === 'RoundCompleted')).toBe(true);
    expect(sim.rescue!.items.every((i) => i.state === 'held' || i.state === 'lost')).toBe(true);
  });

  test('snapshot: rescue items, returnLeft and carriedItems are plain data; pause freezes them', () => {
    const sim = new Sim(3, { invulnerable: true });
    expect(sim.snapshot().carriedItems).toBe(0);
    const inc = new RescueIncident('rescue#9');
    inc.start(sim.horde, site, rng(2), paulAway, sim.grid, { count: 2 });
    sim.rescue = inc;
    for (const h of sim.horde.list) if (h.incidentId === inc.id) h.state = 'threaten';
    // drive the rescue directly so the horde AI does not move its aggressors
    for (let i = 0; i < 60 * 7; i++) inc.step(DT, { horde: sim.horde, rules: sim.rules, player: sim.player });
    sim.pause();
    const s = sim.snapshot();
    expect(s.rescue!.items).toHaveLength(3);
    expect(Object.keys(s.rescue!.items[0]!).sort()).toEqual(['id', 'name', 'pos', 'state']);
    expect(s.rescue!.items[0]!.state).toBe('carried-by-thief');
    expect(s.rescue!.returnLeft).toBeNull();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    for (let i = 0; i < 120; i++) expect(sim.step(IDLE)).toEqual([]);
    expect(sim.snapshot()).toEqual(s);
  });
});
