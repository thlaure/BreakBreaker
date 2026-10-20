import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import type { SpawnRequest } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { moveCircle } from '../../src/sim/map/collide';
import { Monument, MonumentIncident, inZone, occupierCount } from '../../src/sim/monument';
import { createPlayer } from '../../src/sim/player';
import { Rules } from '../../src/sim/rules';
import { Sim } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';
import { IDLE, autopilot } from './autopilot';

const DT = CONFIG.step;
const M = DISTRICT.monument;
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
/** A walkable point inside the capture zone, south of the plinth. */
const IN_ZONE = { x: 1088, y: 784 };
const OUT_ZONE = { x: 1088, y: 900 };

/** An occupation whose occupiers appear at once on the plinth's attack points (state left to the test). */
function occupation(count = 6) {
  const horde = new Horde();
  const rules = new Rules();
  const monument = new Monument();
  let i = 0;
  const spawner = {
    request: (reqs: SpawnRequest[]) => {
      for (const r of reqs)
        horde.spawn({ variant: r.variant, role: r.role, pos: M.attackPoints[i++ % M.attackPoints.length]!, incidentId: r.incidentId, site: r.site, round: r.round });
    },
  };
  const inc = new MonumentIncident('monument#1', 4, count, spawner);
  expect(inc.start(monument)).toBe(true);
  const ctx = { horde, rules, monument };
  const run = (sec: number): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let k = 0; k < Math.round(sec / DT); k++) ev.push(...inc.step(DT, ctx));
    return ev;
  };
  const at = (n: number): void => {
    horde.list.forEach((h, k) => (h.state = k < n ? 'degrade' : 'approach'));
  };
  return { horde, rules, monument, inc, run, at };
}

describe('monument map', () => {
  const grid = new Grid(DISTRICT);
  test('plinth, zone and mast match the plan; the plinth is solid and blocks movement and sight', () => {
    expect(M.plinth).toEqual({ x: 33 * 32, y: 21 * 32, w: 64, h: 64 });
    expect(M.zone).toEqual({ x: 1088, y: 704, r: 112 });
    expect(M.mast).toEqual({ x: 1088, y: 672 });
    expect(grid.isSolidPx({ x: 1088, y: 704 })).toBe(true);
    expect(grid.isSolid(33, 21)).toBe(true);
    expect(grid.lineClear({ x: 1020, y: 704 }, { x: 1160, y: 704 })).toBe(false);
    let p = { x: 1020, y: 704 };
    for (let i = 0; i < 100; i++) p = moveCircle(grid, p, { x: 3, y: 0 }, 7);
    expect(p.x).toBeLessThan(M.plinth.x);
  });

  test('the plinth overlaps no building, prop, station, peaceful group, trunk or kit site', () => {
    const P = M.plinth;
    const hit = (r: { x: number; y: number; w: number; h: number }): boolean =>
      P.x < r.x + r.w && P.x + P.w > r.x && P.y < r.y + r.h && P.y + P.h > r.y;
    for (const b of DISTRICT.buildings) expect(hit(b)).toBe(false);
    for (const t of DISTRICT.targets) expect(hit(t.footprint)).toBe(false);
    expect(hit(DISTRICT.peacefulGroup.area)).toBe(false);
    for (const s of [...DISTRICT.stations, ...DISTRICT.kitSites, ...DISTRICT.rescueSites, DISTRICT.playerSpawn])
      expect(Math.hypot(s.x - M.zone.x, s.y - M.zone.y)).toBeGreaterThan(M.zone.r);
    for (const c of DISTRICT.trunks) expect(hit({ x: c.x - c.r, y: c.y - c.r, w: 2 * c.r, h: 2 * c.r })).toBe(false);
  });

  test('attack points, the zone edge and the zone around the plinth are walkable and reachable from the spawn and the edges', () => {
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    const z = M.zone;
    // east, south and north edges (the west edge tile holds a tree trunk)
    const edge = [0, 1, 3].map((k) => ({ x: z.x + Math.cos((k * Math.PI) / 2) * (z.r - 8), y: z.y + Math.sin((k * Math.PI) / 2) * (z.r - 8) }));
    for (const p of [...M.attackPoints, ...edge, IN_ZONE]) {
      expect(grid.circleBlocked(p, CONFIG.hostile.radius)).toBe(false);
      expect(ff.stepsAt(p)).toBeGreaterThanOrEqual(0);
    }
    expect(M.attackPoints.every(inZone)).toBe(true);
    expect(inZone(IN_ZONE)).toBe(true);
    expect(inZone(OUT_ZONE)).toBe(false);
    const fromEdge = new FlowField(grid);
    fromEdge.rebuild(M.attackPoints[0]!);
    for (const s of DISTRICT.hostileSpawns) expect(fromEdge.stepsAt(s)).toBeGreaterThanOrEqual(0);
  });
});

describe('monument occupation', () => {
  test('occupiers: 6 the first time, then min(8, 5 + floor(round / 3)); variants mixed round-robin, degraders bound to the monument', () => {
    expect(occupierCount(1, 4)).toBe(6);
    expect(occupierCount(2, 6)).toBe(7);
    expect(occupierCount(3, 8)).toBe(7);
    expect(occupierCount(4, 9)).toBe(8);
    expect(occupierCount(5, 30)).toBe(8);
    const { horde } = occupation(6);
    expect(horde.list.map((h) => h.variant)).toEqual(['classic', 'palestinian', 'antifa', 'classic', 'palestinian', 'antifa']);
    expect(horde.list.every((h) => h.role === 'degrader' && h.site === 'monument' && h.round === 4 && h.incidentId === 'monument#1')).toBe(true);
  });

  test('one occupier at the plinth swaps the flag after 4 s: FlagSwapped, −3 once, settled', () => {
    const o = occupation();
    o.at(1);
    expect(o.run(3.9)).toEqual([]);
    expect(o.monument.flag).toBe('french');
    const ev = o.run(0.2);
    expect(ev).toEqual([{ type: 'FlagSwapped', incidentId: 'monument#1', pos: M.mast }]);
    expect(o.monument).toMatchObject({ flag: 'palestinian', swaps: 1 });
    expect(o.rules.score).toBe(CONFIG.monument.scores.lost);
    expect(o.inc.stage).toBe('swapped');
    expect(o.inc.settled()).toBe(true);
    expect(o.inc.urgent()).toBe(false);
    // settled but still live: its occupiers hold the plinth until KO'd
    expect(o.inc.live(o.horde)).toBe(true);
    expect(o.run(10)).toEqual([]);
    expect(o.rules.score).toBe(CONFIG.monument.scores.lost);
  });

  test('three occupiers swap three times faster; a fourth one counts no more', () => {
    for (const n of [3, 5]) {
      const o = occupation();
      o.at(n);
      expect(o.run(4 / 3 - 0.05)).toEqual([]);
      expect(of(o.run(0.1), 'FlagSwapped')).toHaveLength(1);
    }
    const o = occupation();
    o.at(2);
    expect(o.run(1.95)).toEqual([]);
    expect(of(o.run(0.1), 'FlagSwapped')).toHaveLength(1);
  });

  test('nobody at the plinth: no swap; the timer is kept while they walk', () => {
    const o = occupation();
    o.at(0);
    expect(o.run(20)).toEqual([]);
    o.at(1);
    o.run(2);
    o.at(0);
    o.run(10);
    expect(o.inc.swapTimer).toBeCloseTo(2, 5);
    expect(o.monument.flag).toBe('french');
  });

  test('every occupier KO before the swap: defended, +4 once, MonumentDefended, the flag stays French', () => {
    const o = occupation();
    o.at(2);
    o.run(1);
    for (const h of o.horde.list) o.horde.applyHit(h.lifeId, 99);
    expect(o.run(1)).toEqual([{ type: 'MonumentDefended', incidentId: 'monument#1' }]);
    expect(o.rules.score).toBe(CONFIG.monument.scores.defended);
    expect(o.inc.stage).toBe('defended');
    expect(o.monument.flag).toBe('french');
    expect(o.run(5)).toEqual([]);
    expect(o.rules.score).toBe(CONFIG.monument.scores.defended);
  });

  test('no occupation starts while the flag is Palestinian', () => {
    const m = new Monument();
    m.swap('monument#0');
    const inc = new MonumentIncident('monument#2', 5, 6, { request: () => expect.unreachable() });
    expect(inc.start(m)).toBe(false);
    expect(inc.stage).toBe('idle');
  });
});

describe('capture the flag', () => {
  function ctf() {
    const monument = new Monument();
    const rules = new Rules();
    const horde = new Horde();
    const player = createPlayer(IN_ZONE);
    const run = (sec: number): SimEvent[] => {
      const ev: SimEvent[] = [];
      for (let k = 0; k < Math.round(sec / DT); k++) ev.push(...monument.step(DT, { player, horde, rules }));
      return ev;
    };
    return { monument, rules, horde, player, run };
  }

  test('nothing to capture while the flag is French', () => {
    const c = ctf();
    expect(c.run(10)).toEqual([]);
    expect(c.monument.progress).toBe(0);
    expect(c.rules.score).toBe(0);
  });

  test('Paul in the zone with no hostile inside: 8 s → French flag, +10 once, FlagCaptured', () => {
    const c = ctf();
    c.monument.swap('monument#1');
    expect(c.run(7.9)).toEqual([]);
    expect(c.monument.progress).toBeCloseTo(7.9, 5);
    expect(c.monument.paulInZone).toBe(true);
    expect(c.run(0.2)).toEqual([{ type: 'FlagCaptured', swap: 1, pos: M.mast }]);
    expect(c.monument).toMatchObject({ flag: 'french', progress: 0 });
    expect(c.rules.score).toBe(CONFIG.monument.scores.captured);
    expect(c.run(10)).toEqual([]);
    expect(c.rules.score).toBe(CONFIG.monument.scores.captured);
  });

  test('leaving the zone or a hostile inside pauses the capture, progress kept (contested); a KO body does not contest', () => {
    const c = ctf();
    c.monument.swap('monument#1');
    c.run(3);
    c.player.pos = { ...OUT_ZONE };
    c.run(5);
    expect(c.monument.progress).toBeCloseTo(3, 5);
    expect(c.monument.paulInZone).toBe(false);
    c.player.pos = { ...IN_ZONE };
    const h = c.horde.spawn({ variant: 'antifa', role: 'contact', pos: M.attackPoints[0]! })!;
    c.run(5);
    expect(c.monument.progress).toBeCloseTo(3, 5);
    expect(c.monument.contested).toBe(true);
    // a hostile outside the zone does not contest
    h.pos = { ...OUT_ZONE };
    c.run(1);
    expect(c.monument.contested).toBe(false);
    expect(c.monument.progress).toBeCloseTo(4, 5);
    h.pos = { ...M.attackPoints[0]! };
    c.horde.applyHit(h.lifeId, 99);
    expect(of(c.run(4.1), 'FlagCaptured')).toHaveLength(1);
  });

  test('two swap / capture cycles award both captures (unique keys) and both swaps', () => {
    const c = ctf();
    for (const n of [1, 2]) {
      c.monument.swap(`monument#${n}`);
      expect(c.run(8.1)).toEqual([{ type: 'FlagCaptured', swap: n, pos: M.mast }]);
    }
    expect(c.monument.swaps).toBe(2);
    expect(c.rules.score).toBe(2 * CONFIG.monument.scores.captured);
  });
});

describe('the monument in the sim', () => {
  /** KOs every rioter at once but, during `round`, leaves the monument occupiers alone until the flag is swapped. */
  function bot(sim: Sim, round: number) {
    for (const h of sim.horde.active()) {
      const occupier = h.incidentId?.startsWith('monument#') && h.round === round && sim.monument.flag === 'french';
      if (!occupier && sim.horde.applyHit(h.lifeId, 99) === 'ko') sim.rules.onKnockout(h.lifeId);
    }
    if (sim.school.stage === 'cinematic') sim.skipCinematic();
    return IDLE;
  }
  function toRound(sim: Sim, n: number, step: () => SimEvent[] = () => sim.step(autopilot(sim))): SimEvent[] {
    const all: SimEvent[] = [];
    for (let i = 0; i < 60 * 900 && !(sim.director.round === n && sim.director.phase === 'play'); i++) all.push(...step());
    expect(sim.director).toMatchObject({ round: n, phase: 'play' });
    return all;
  }

  test('round 4 brings the monument occupation as second beat; all KO → defended, round réussi, K = T', () => {
    const sim = new Sim(11, { invulnerable: true });
    toRound(sim, 4);
    expect(sim.director.plan!.beats[1]).toEqual(['monument']);
    const ev: SimEvent[] = [];
    let kt = false;
    for (let i = 0; i < 60 * 300 && sim.director.round === 4; i++) {
      const e = sim.step(autopilot(sim));
      ev.push(...e);
      if (of(e, 'RoundCompleted').length > 0) kt = sim.director.roundKos(sim) === sim.director.total;
    }
    const [att] = of(ev, 'MonumentAttacked');
    expect(att).toMatchObject({ incidentId: 'monument#1', pos: M.mast, round: 4 });
    expect(of(ev, 'MonumentDefended')).toEqual([{ type: 'MonumentDefended', incidentId: 'monument#1' }]);
    expect(of(ev, 'FlagSwapped')).toEqual([]);
    expect(kt).toBe(true);
    expect(sim.director.lastSummary!.objectives.find((o) => o.kind === 'monument')).toEqual({ kind: 'monument', result: 'réussi' });
    expect(sim.snapshot().monument.flag).toBe('french');
  });

  test('occupiers reach the plinth and swap the flag; it stays Palestinian across rounds and breathers, no new occupation, until Paul captures it (breather included)', () => {
    const sim = new Sim(11, { invulnerable: true });
    toRound(sim, 4);
    const ev: SimEvent[] = [];
    let kt = false;
    for (let i = 0; i < 60 * 400 && sim.director.round === 4; i++) {
      const e = sim.step(bot(sim, 4));
      ev.push(...e);
      if (of(e, 'RoundCompleted').length > 0) kt = sim.director.roundKos(sim) === sim.director.total;
    }
    expect(of(ev, 'FlagSwapped')).toEqual([{ type: 'FlagSwapped', incidentId: 'monument#1', pos: M.mast }]);
    expect(kt).toBe(true);
    expect(sim.director.lastSummary!.objectives.find((o) => o.kind === 'monument')).toEqual({ kind: 'monument', result: 'perdu' });
    expect(sim.rules.stats.flagsLost).toBe(1);
    // rounds 5–7: still Palestinian, never a second occupation
    const later: SimEvent[] = [];
    for (let i = 0; i < 60 * 900 && sim.director.round <= 7; i++) {
      later.push(...sim.step(autopilot(sim)));
      expect(sim.monument.flag).toBe('palestinian');
      if (sim.director.plan) expect(sim.director.plan.beats.flat()).not.toContain('monument');
    }
    expect(of(later, 'MonumentAttacked')).toEqual([]);
    // capture during a breather
    for (let i = 0; i < 60 * 300 && sim.director.phase !== 'breather'; i++) sim.step(autopilot(sim));
    expect(sim.director.phase).toBe('breather');
    sim.player.pos = { ...IN_ZONE };
    const score = sim.rules.score;
    const cap: SimEvent[] = [];
    for (let i = 0; i < Math.round(CONFIG.round.breatherSec / DT) - 1; i++) cap.push(...sim.step(IDLE));
    expect(sim.director.phase).toBe('breather');
    expect(sim.snapshot().monument).toMatchObject({ flag: 'palestinian', inZone: true, contested: false });
    expect(sim.snapshot().monument.capture).toBeGreaterThan(5);
    for (let i = 0; i < 60 * 3; i++) cap.push(...sim.step(autopilot(sim)));
    expect(of(cap, 'FlagCaptured')).toEqual([{ type: 'FlagCaptured', swap: 1, pos: M.mast }]);
    expect(sim.rules.score - score).toBeGreaterThanOrEqual(CONFIG.monument.scores.captured);
    expect(sim.monument.flag).toBe('french');
    expect(sim.rules.stats.flagsCaptured).toBe(1);
  });

  test('deterministic: the same seed gives the same monument events', () => {
    const run = (): string => {
      const sim = new Sim(21, { invulnerable: true });
      const ev: SimEvent[] = [];
      for (let i = 0; i < 60 * 600 && sim.director.round <= 5; i++) ev.push(...sim.step(bot(sim, 4)));
      return JSON.stringify(ev.filter((e) => ['MonumentAttacked', 'FlagSwapped', 'MonumentDefended', 'RoundStarted'].includes(e.type)));
    };
    expect(run()).toBe(run());
  });
});
