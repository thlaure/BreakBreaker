import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Horde } from '../../src/sim/hostiles';
import { RescueIncident } from '../../src/sim/incidents/rescue';
import { DISTRICT } from '../../src/sim/map/district';
import { Grid } from '../../src/sim/map/grid';
import { dist } from '../../src/sim/math';
import { createPlayer, sweep } from '../../src/sim/player';
import { Rocks } from '../../src/sim/projectiles';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import type { SimEvent, Vec } from '../../src/sim/types';

const DT = 1 / 60;
const grid = new Grid(DISTRICT);
const site = DISTRICT.rescueSites[0]!;
const paulAway: Vec = { x: site.x + 400, y: site.y };

function setup(seed = 1, playerPos: Vec = paulAway) {
  const horde = new Horde();
  const rules = new Rules();
  const player = createPlayer(playerPos);
  const inc = new RescueIncident('rescue#1');
  inc.start(horde, site, rng(seed), playerPos, grid);
  const run = (sec: number): SimEvent[] => {
    const ev: SimEvent[] = [];
    for (let i = 0; i < Math.round(sec / DT); i++) ev.push(...inc.step(DT, { horde, rules, player }));
    return ev;
  };
  const mine = () => horde.list.filter((h) => h.incidentId === inc.id);
  const koAll = () => mine().forEach((h) => horde.applyHit(h.lifeId, 9999));
  return { horde, rules, player, inc, run, mine, koAll };
}

test('start spawns 2-4 aggressors >= 160 px from Paul', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { mine, inc } = setup(seed);
    expect(mine().length).toBeGreaterThanOrEqual(2);
    expect(mine().length).toBeLessThanOrEqual(4);
    for (const h of mine()) {
      expect(h.role).toBe('aggressor');
      expect(h.target).toBe('victim');
      expect(dist(h.pos, paulAway)).toBeGreaterThanOrEqual(160);
      expect(grid.circleBlocked(h.pos, CONFIG.hostile.radius)).toBe(false);
    }
    expect(inc.victimPos).toEqual(site);
    expect(inc.remaining).toBe(CONFIG.rescue.threatSeconds);
  }
});

test('distress only decreases while an aggressor threatens (RC-64)', () => {
  const { inc, run, mine } = setup();
  const ev = run(3);
  expect(inc.remaining).toBe(25);
  expect(ev.filter((e) => e.type === 'RescueStarted')).toHaveLength(1);
  mine()[0]!.state = 'threaten';
  run(2);
  expect(inc.remaining).toBeCloseTo(23, 1);
  mine().forEach((h) => (h.state = 'approach'));
  run(2);
  expect(inc.remaining).toBeCloseTo(23, 1);
});

test('RescueStarted is emitted once with the victim position, kind, wave and total', () => {
  const { inc, run, mine } = setup();
  inc.wave = 2;
  const ev = run(3).filter((e) => e.type === 'RescueStarted');
  expect(inc.total).toBe(mine().length);
  expect(ev).toEqual([{ type: 'RescueStarted', incidentId: 'rescue#1', pos: site, kind: inc.kind, wave: 2, total: inc.total }]);
  expect(['groupHarassed', 'elderlyRobbed']).toContain(inc.kind);
});

test('all aggressors KO secures, then completes by itself after thanksSec: +6 once, no key (RC-65)', () => {
  const { inc, run, mine, koAll, rules } = setup();
  mine().forEach((h) => (h.state = 'threaten'));
  run(2);
  koAll();
  const before = rules.score;
  const ev = run(DT);
  expect(inc.stage).toBe('secured');
  expect(ev.filter((e) => e.type === 'RescueSecured')).toHaveLength(1);
  const rem = inc.remaining;
  // Paul is far away and presses nothing: still completes, but not before thanksSec
  const early = run(CONFIG.rescue.thanksSec - 0.1);
  expect(inc.stage).toBe('secured');
  expect(inc.remaining).toBe(rem);
  expect(early.some((e) => e.type === 'RescueCompleted')).toBe(false);
  expect(rules.score).toBe(before);
  const ev2 = run(0.2);
  expect(inc.stage).toBe('completed');
  expect(ev2.filter((e) => e.type === 'RescueCompleted')).toHaveLength(1);
  expect(rules.score).toBe(before + CONFIG.rescue.bonus);
  const after = run(3);
  expect(after.filter((e) => e.type === 'RescueCompleted')).toHaveLength(0);
  expect(rules.score).toBe(before + CONFIG.rescue.bonus);
});

test('completes exactly thanksSec after securing', () => {
  const { inc, run, koAll } = setup();
  run(DT);
  koAll();
  run(DT); // secured on this step
  expect(inc.stage).toBe('secured');
  let steps = 0;
  while (inc.stage === 'secured' && steps < 1000) {
    run(DT);
    steps++;
  }
  expect(steps).toBe(Math.round(CONFIG.rescue.thanksSec / DT));
});

test('aggressors KO by a rock or a strike both count', () => {
  const { inc, run, mine, horde } = setup(4);
  run(DT);
  const [first, ...rest] = mine();
  // a returned rock does 1 damage per hit (2 hits), a weapon strike KOs in one
  horde.applyHit(first!.lifeId, CONFIG.rock.returnDamage);
  horde.applyHit(first!.lifeId, CONFIG.rock.returnDamage);
  for (const h of rest) horde.applyHit(h.lifeId, 99);
  run(DT);
  expect(inc.stage).toBe('secured');
  run(CONFIG.rescue.thanksSec + 0.05);
  expect(inc.stage).toBe('completed');
});

test('timeout: failed, no bonus, aggressors turn on Paul (RC-66)', () => {
  const { inc, run, mine, rules, horde } = setup();
  mine().forEach((h) => (h.state = 'threaten'));
  const ev = run(26);
  expect(inc.stage).toBe('failed');
  expect(inc.remaining).toBe(0);
  expect(ev.filter((e) => e.type === 'RescueFailed')).toHaveLength(1);
  expect(rules.score).toBe(0);
  for (const h of horde.active().filter((x) => x.lifeId)) {
    expect(h.role).toBe('contact');
    expect(h.target).toBe('player');
    expect(h.incidentId).toBeNull();
  }
  expect(horde.active().length).toBeGreaterThanOrEqual(2);
});

test('spawn blocked at the cap stays pending and retries', () => {
  const horde = new Horde();
  for (let i = 0; i < CONFIG.caps.hostiles; i++) horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 50, y: 50 } });
  const inc = new RescueIncident('rescue#2');
  inc.start(horde, site, rng(3), paulAway, grid);
  const player = createPlayer(paulAway);
  const rules = new Rules();
  inc.step(DT, { horde, rules, player });
  expect(horde.list.filter((h) => h.incidentId === 'rescue#2')).toHaveLength(0);
  expect(inc.stage).toBe('threat');
  horde.list.slice(0, 10).forEach((h) => horde.applyHit(h.lifeId, 9999));
  inc.step(DT, { horde, rules, player });
  expect(horde.list.filter((h) => h.incidentId === 'rescue#2').length).toBeGreaterThanOrEqual(2);
});

test("Paul's sweep and rocks never touch the victim (RC-63)", () => {
  const near = { x: site.x - 30, y: site.y };
  const { horde, rules, mine } = setup(2, near);
  const player = createPlayer(near);
  player.facing = { x: 1, y: 0 };
  // aggressors next to victim
  mine().forEach((h, i) => (h.pos = { x: site.x + 10 + i * 4, y: site.y + 10 }));
  const views = horde.views();
  const ids = new Set(horde.list.map((h) => h.lifeId));
  const score = rules.score;
  const res = sweep(player, 1, views, grid);
  for (const id of res.hits) expect(ids.has(id)).toBe(true);
  expect(views).toHaveLength(horde.list.length);
  // a rock through the victim position with no hostile in the way
  const rocks = new Rocks(grid);
  rocks.carried = 1;
  const rock = rocks.returnRock(near, { x: 1, y: 0 }, 1)!;
  expect(rock).toBeTruthy();
  horde.list.forEach((h) => (h.pos = { x: site.x, y: site.y + 200 }));
  let ev: SimEvent[] = [];
  for (let i = 0; i < 60; i++)
    ev.push(
      ...rocks.step(DT, 1 + i * DT, {
        player: { pos: near, r: 7, invulnerable: false },
        hostiles: horde.views(),
        groupBlocks: () => null,
        victimPos: site,
      }),
    );
  expect(ev.filter((e) => e.type === 'HitConfirmed')).toEqual([]);
  expect(rules.score).toBe(score);
});
