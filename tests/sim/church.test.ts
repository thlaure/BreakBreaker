import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { TWO_URGENCIES_FROM, casseOpen, roundPlan, urgentCap } from '../../src/sim/director';
import { ImmediateSpawner } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import { TargetAttack, lineup, molotovCount } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { createPlayer } from '../../src/sim/player';
import { Toolboxes } from '../../src/sim/repair';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import { Sim } from '../../src/sim/sim';
import { Targets } from '../../src/sim/targets';
import type { CasseKind, SimEvent } from '../../src/sim/types';
import { autopilot } from './autopilot';

const DT = 1 / 60;
const C = (tx: number, ty: number) => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
const church = () => DISTRICT.targets.find((t) => t.id === 'church')!;
const repair = (kit: Toolboxes, player: ReturnType<typeof createPlayer>, targets: Targets, rules: Rules): SimEvent[] => {
  const ev: SimEvent[] = [];
  kit.carried = true;
  for (let i = 0; i < Math.round(CONFIG.kit.repairSec / DT) + 1; i++)
    ev.push(...kit.step(DT, { player, horde: new Horde(), targets, rules, act: i === 0 }).events);
  return ev;
};

describe('the church (a building to defend on the main square)', () => {
  test('has 150 hp on building slot 6, its door and four attack points on the street in front', () => {
    expect(CONFIG.church.hp).toBe(150);
    expect(CONFIG.church.fromRound).toBe(3);
    const d = church();
    expect(d).toMatchObject({ kind: 'church', prop: false, maxHp: 150 });
    expect(d.footprint).toEqual(DISTRICT.buildings[6]);
    expect(d.door).toEqual(C(27, 30));
    expect(d.attackPoints).toEqual([C(25, 30), C(26, 30), C(27, 30), C(28, 30)]);
    expect(new Targets().get('church')).toMatchObject({ hp: 150, maxHp: 150, state: 'intact', burning: false });
  });

  test('its door and attack points are walkable and reachable from every hostile spawn and from Paul', () => {
    const grid = new Grid(DISTRICT);
    const d = church();
    for (const from of [DISTRICT.playerSpawn, ...DISTRICT.hostileSpawns]) {
      const ff = new FlowField(grid);
      ff.rebuild(from);
      for (const q of [d.door, ...d.attackPoints]) {
        expect(grid.isSolidPx(q)).toBe(false);
        expect(grid.circleBlocked(q, CONFIG.hostile.radius)).toBe(false);
        expect(ff.stepsAt(q)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('scores like a big building (+8 saved, −3 lost, +5 repaired) and takes building-sized lineups', () => {
    expect(CONFIG.casse.scores.church).toEqual([8, -3, 5]);
    expect(CONFIG.casse.fromRound.church).toBe(CONFIG.church.fromRound);
    expect(molotovCount('church', 12)).toBe(4);
    expect(lineup('church', 4, 99).firstLine).toHaveLength(3 + 3 + 6);
  });

  test('never drawn before round 3, then part of the draw', () => {
    expect(casseOpen('church', 2)).toBe(false);
    expect(casseOpen('church', 3)).toBe(true);
    const seen = (round: number) => {
      const t = new Targets();
      const s = new Set<string>();
      for (let i = 1; i <= 600; i++) for (const k of roundPlan(round, rng(i), t).beats[0]!) s.add(k);
      return s;
    };
    expect(seen(2).has('church')).toBe(false);
    for (const r of [3, 4, 6, 10]) expect(seen(r).has('church')).toBe(true);
  });

  test('bottle → fire → KO → toolbox puts it out (+5); a second attack ruins it (−3); rebuilt to 60 % (+5)', () => {
    const horde = new Horde();
    const rules = new Rules();
    const targets = new Targets();
    const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
    const ctx = { horde, rules };
    const door = church().door;
    const attack = new TargetAttack({ id: 'church#1', target: 'church', comp: lineup('church', 3, 0), round: 3 }, targets, spawner);
    expect(attack.start()).toBe(true);
    spawner.step();
    expect(attack.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: door, target: 'church' }, ctx)).toEqual([
      { type: 'TargetIgnited', target: 'church', incidentId: 'church#1', kind: 'church', pos: door, round: 3 },
    ]);
    for (const h of horde.list) if (h.incidentId === 'church#1') horde.applyHit(h.lifeId, 99);
    attack.step(DT, ctx);
    expect(attack.stage).toBe('smoulder');
    const kit = new Toolboxes();
    const player = createPlayer({ ...door });
    expect(repair(kit, player, targets, rules)).toEqual([
      { type: 'FireOut', target: 'church' },
      { type: 'TargetRepaired', target: 'church', incidentId: 'church#1' },
    ]);
    expect(rules.score).toBe(5);

    const a2 = new TargetAttack({ id: 'church#2', target: 'church', comp: lineup('church', 3, 0), round: 3 }, targets, spawner);
    a2.start();
    spawner.step();
    targets.get('church').hp = 0.01;
    a2.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: door, target: 'church' }, ctx);
    expect(a2.step(DT, ctx)).toContainEqual({ type: 'BuildingDestroyed', incidentId: 'church#2', target: 'church' });
    a2.step(1, ctx);
    expect(rules.score).toBe(5 - 3);
    expect(targets.standing('church')).toBe(false);
    expect(repair(kit, player, targets, rules)).toEqual([{ type: 'TargetRepaired', target: 'church', incidentId: 'church#2' }]);
    expect(rules.score).toBe(5 - 3 + 5);
    expect(targets.get('church')).toMatchObject({ hp: 90, maxHp: 150, state: 'intact' });
  });

  test('a saved attack (nothing burning) scores +8 once', () => {
    const horde = new Horde();
    const rules = new Rules();
    const targets = new Targets();
    const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
    const attack = new TargetAttack({ id: 'church#1', target: 'church', comp: lineup('church', 3, 0), round: 3 }, targets, spawner);
    attack.start();
    spawner.step();
    for (const h of horde.list) horde.applyHit(h.lifeId, 99);
    expect(attack.step(DT, { horde, rules })).toEqual([{ type: 'TargetSaved', incidentId: 'church#1', target: 'church' }]);
    attack.step(1, { horde, rules });
    expect(rules.score).toBe(8);
  });

  test('a ruined church takes nothing else down: every other target stands, the draw goes on without it', () => {
    const t = new Targets();
    t.ruin('church', 'church#x');
    for (const d of DISTRICT.targets) if (d.id !== 'church') expect(t.get(d.id)).toMatchObject({ hp: d.maxHp, state: 'intact' });
    const fresh = new Targets();
    for (let s = 1; s <= 200; s++) {
      for (const r of [3, 6, 10]) {
        const p = roundPlan(r, rng(s), t);
        expect(p.beats[0]).not.toContain('church');
        expect(p.beats[0]).toHaveLength(r >= TWO_URGENCIES_FROM ? 2 : 1);
        for (const k of p.beats[0]!) expect(casseOpen(k as CasseKind, r)).toBe(true);
      }
    }
    // the church burning with two other places down: the plan never stacks it on top
    fresh.ignite('church', 'church#y');
    fresh.ignite('townHall', 'townHall#y');
    for (let s = 1; s <= 100; s++) expect(roundPlan(9, rng(s), fresh).beats[0]).not.toContain('church');
  });
});

describe('the church in ten-round bot sessions', () => {
  test('attacked sometimes from round 3, never before; never more than two urgent places at once', () => {
    const rounds: number[] = [];
    for (const seed of [1, 2, 3, 4]) {
      const sim = new Sim(seed, { invulnerable: true });
      for (let i = 0; i < 60 * 3600 && sim.director.round <= 10; i++) {
        const ev = sim.step(autopilot(sim, { koAfterSec: 1 }));
        for (const e of ev) if (e.type === 'CasseStarted' && e.target === 'church') rounds.push(e.round);
        const urgent =
          sim.attacks.filter((a) => a.urgent()).length +
          (sim.rescue?.stage === 'threat' ? 1 : 0) +
          sim.occupations.filter((m) => m.urgent()).length;
        expect(urgent).toBeLessThanOrEqual(urgentCap(sim.director.round));
      }
      expect(sim.director.round).toBeGreaterThan(10);
    }
    expect(rounds.length).toBeGreaterThan(0);
    for (const r of rounds) expect(r).toBeGreaterThanOrEqual(3);
    console.info(`church attacks over 4 ten-round sessions: ${rounds.length} (rounds ${rounds.join(', ')})`);
  });
});
