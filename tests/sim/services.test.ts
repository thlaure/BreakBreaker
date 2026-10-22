import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { casseOpen, roundPlan } from '../../src/sim/director';
import { ImmediateSpawner } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import { TargetAttack, lineup, molotovCount } from '../../src/sim/incidents/targetAttack';
import { DISTRICT } from '../../src/sim/map/district';
import { FlowField } from '../../src/sim/map/flowfield';
import { Grid } from '../../src/sim/map/grid';
import { rng } from '../../src/sim/rng';
import { Rules } from '../../src/sim/rules';
import { BOOTH_OF, Services, type CallCtx } from '../../src/sim/services';
import { Sim } from '../../src/sim/sim';
import { Targets } from '../../src/sim/targets';
import type { InputFrame, SimEvent, TargetId, Vec } from '../../src/sim/types';
import { autopilot } from './autopilot';

const C = (tx: number, ty: number): Vec => ({ x: tx * 32 + 16, y: ty * 32 + 16 });
const R = (tx: number, ty: number, tw: number, th: number) => ({ x: tx * 32, y: ty * 32, w: tw * 32, h: th * 32 });
const def = (id: TargetId) => DISTRICT.targets.find((t) => t.id === id)!;
const IDLE: InputFrame = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: false };
const PRESS: InputFrame = { ...IDLE, act: true };
const BOOTHS = ['boothRed', 'boothBlue'] as const;
type Ev<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;
const of = <T extends SimEvent['type']>(ev: SimEvent[], type: T): Ev<T>[] => ev.filter((e): e is Ev<T> => e.type === type);
const hyp = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** A sim with Paul at `pos`, invulnerable; `press()` = one fresh Agir press (an idle step first, then the press). */
function simAt(pos: Vec, seed = 7) {
  const sim = new Sim(seed, { invulnerable: true });
  sim.player.pos = { ...pos };
  const press = (): SimEvent[] => [...sim.step(IDLE), ...sim.step(PRESS)];
  return { sim, press };
}

/** `n` active rioters parked far from Paul (they never strike). */
function crowd(sim: Sim, n: number): void {
  for (let i = 0; i < n; i++) {
    const h = sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: 1300 + (i % 4) * 20, y: 1300 + Math.floor(i / 4) * 20 } })!;
    h.nextAttackAt = 1e9;
  }
}

/** The help called is off the map again (the truck gone, the police group gone): the next call is not 'busy'. */
function gone(sim: Sim): void {
  sim.allies.truck = null;
  sim.allies.policeUntil = null;
  sim.allies.fighters.length = 0;
  sim.step(IDLE);
}

describe('the phone booths (targets)', () => {
  test('two 60 hp prop booths side by side, kind booth, on the centre-west plaza', () => {
    expect(def('boothRed')).toMatchObject({ kind: 'booth', prop: true, maxHp: 60, footprint: R(4, 22, 1, 1) });
    expect(def('boothBlue')).toMatchObject({ kind: 'booth', prop: true, maxHp: 60, footprint: R(5, 22, 1, 1) });
    expect(BOOTH_OF).toEqual({ fire: 'boothRed', police: 'boothBlue' });
    expect(new Targets().get('boothRed')).toMatchObject({ hp: 60, maxHp: 60, state: 'intact', burning: false });
  });

  test('solid, a free tile all around the island, attack points walkable and reachable, the street row in front within call range', () => {
    const grid = new Grid(DISTRICT);
    const ff = new FlowField(grid);
    ff.rebuild(DISTRICT.playerSpawn);
    expect(grid.isSolid(4, 22)).toBe(true);
    expect(grid.isSolid(5, 22)).toBe(true);
    for (let tx = 3; tx <= 6; tx++) for (let ty = 21; ty <= 23; ty++) if (ty !== 22 || tx === 3 || tx === 6) expect(grid.isSolid(tx, ty)).toBe(false);
    for (const id of BOOTHS) {
      const d = def(id);
      expect(d.attackPoints.length).toBeGreaterThanOrEqual(3);
      for (const q of d.attackPoints) {
        expect(grid.isSolidPx(q)).toBe(false);
        expect(grid.circleBlocked(q, CONFIG.hostile.radius)).toBe(false);
        expect(ff.stepsAt(q)).toBeGreaterThanOrEqual(0);
      }
    }
    // Paul on the street row in front of a booth is within the call range of its door
    for (const [id, front] of [['boothRed', C(4, 23)], ['boothBlue', C(5, 23)]] as const) {
      expect(ff.stepsAt(front)).toBeGreaterThanOrEqual(0);
      expect(hyp(front, def(id).door)).toBeLessThanOrEqual(CONFIG.services.callRange);
    }
  });

  test('away from the spawns, stations, rescue sites and the peaceful group', () => {
    const centre = { x: 5 * 32, y: 22 * 32 + 16 };
    for (const q of [...DISTRICT.hostileSpawns, ...DISTRICT.stations, ...DISTRICT.rescueSites, DISTRICT.playerSpawn])
      expect(hyp(q, centre)).toBeGreaterThan(160);
    const g = DISTRICT.peacefulGroup.area;
    expect(hyp(g, centre)).toBeGreaterThan(320);
  });

  test('scores +4 / −2 / +3 like a prop, open from round 3, at most 2 Molotovs, prop lineup', () => {
    expect(CONFIG.casse.scores.booth).toEqual([4, -2, 3]);
    expect(CONFIG.casse.fromRound.booth).toBe(3);
    expect(casseOpen('booth', 2)).toBe(false);
    expect(casseOpen('booth', 3)).toBe(true);
    expect(molotovCount('booth', 12)).toBe(2);
    expect(lineup('booth', 6, 99).firstLine.map((r) => r.role)).toEqual(lineup('kiosk', 6, 99).firstLine.map((r) => r.role));
  });

  test('never drawn before round 3; from round 3 drawn when only the booths are free, the second booth too from round 5', () => {
    const t = new Targets();
    const onlyBooths = (id: TargetId) => id === 'boothRed' || id === 'boothBlue';
    for (let s = 1; s <= 40; s++) {
      expect(roundPlan(2, rng(s), t, null, null, onlyBooths).beats).toEqual([['rescue']]);
      expect(roundPlan(3, rng(s), t, null, null, onlyBooths).beats[0]).toEqual(['booth']);
      expect(roundPlan(6, rng(s), t, null, null, onlyBooths).beats[0]).toEqual(['booth', 'booth']);
    }
    // in a normal draw it shows up from round 3, never before
    const seen = new Set<string>();
    for (let s = 1; s <= 300; s++) {
      expect(roundPlan(2, rng(s), t).beats[0]).not.toContain('booth');
      for (const k of roundPlan(3 + (s % 2), rng(s), t).beats[0]!) seen.add(k);
    }
    expect(seen.has('booth')).toBe(true);
  });

  test('in played sessions, no booth attacked or burning before round 3; from round 3 the booths get attacked', () => {
    let boothAttacks = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Sim(seed, { invulnerable: true });
      for (let i = 0; i < 60 * 1500 && sim.director.round < 5; i++) {
        sim.step(autopilot(sim, { koAfterSec: 1 }));
        const booth = sim.attacks.some((a) => a.target === 'boothRed' || a.target === 'boothBlue');
        if (sim.director.round < 3) {
          expect(booth).toBe(false);
          expect(sim.targets.get('boothRed').burning || sim.targets.get('boothBlue').burning).toBe(false);
        } else if (booth) {
          boothAttacks++;
          break;
        }
      }
    }
    expect(boothAttacks).toBeGreaterThan(0);
  }, 60_000);

  test('attack: bottle → fire → saved (+4); a second attack ruins it (−2); repaired for +3', () => {
    const horde = new Horde();
    const rules = new Rules();
    const targets = new Targets();
    const spawner = new ImmediateSpawner(horde, () => [{ x: 560, y: 520 }]);
    const ctx = { horde, rules };
    const a = new TargetAttack({ id: 'boothRed#1', target: 'boothRed', comp: lineup('booth', 3, 0), round: 3 }, targets, spawner);
    expect(a.start()).toBe(true);
    spawner.step();
    for (const h of horde.list) horde.applyHit(h.lifeId, 99);
    a.step(1 / 60, ctx);
    a.step(1, ctx);
    expect(rules.score).toBe(4);
    const a2 = new TargetAttack({ id: 'boothRed#2', target: 'boothRed', comp: lineup('booth', 3, 0), round: 3 }, targets, spawner);
    a2.start();
    spawner.step();
    targets.get('boothRed').hp = 0.01;
    a2.onMolotov({ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: def('boothRed').door, target: 'boothRed' }, ctx);
    expect(a2.step(1 / 60, ctx)).toContainEqual({ type: 'BuildingDestroyed', incidentId: 'boothRed#2', target: 'boothRed' });
    a2.step(1, ctx);
    expect(rules.score).toBe(4 - 2);
    expect(targets.standing('boothRed')).toBe(false);
  });
});

describe('Services.tryCall', () => {
  const ok: CallCtx = { burning: 1, activeHostiles: 8, boothStanding: true, busy: false };

  test('3 fire calls and 3 police calls; a call is spent only when accepted', () => {
    const s = new Services();
    expect(CONFIG.services.calls).toBe(3);
    expect(s.calls).toEqual({ fire: 3, police: 3 });
    expect(s.tryCall('fire', { ...ok, burning: 0 })).toEqual({ ok: false, reason: 'noFire' });
    expect(s.tryCall('police', { ...ok, activeHostiles: 7 })).toEqual({ ok: false, reason: 'fewRioters' });
    expect(s.calls).toEqual({ fire: 3, police: 3 });
    for (let i = 0; i < 3; i++) expect(s.tryCall('fire', ok)).toEqual({ ok: true });
    expect(s.calls).toEqual({ fire: 0, police: 3 });
    expect(s.tryCall('fire', ok)).toEqual({ ok: false, reason: 'noCalls' });
    expect(s.tryCall('police', ok)).toEqual({ ok: true });
    expect(s.calls).toEqual({ fire: 0, police: 2 });
  });

  test('busy (the previous truck or police still on the map) is refused without spending a call', () => {
    const s = new Services();
    expect(s.tryCall('police', { ...ok, busy: true })).toEqual({ ok: false, reason: 'busy' });
    expect(s.tryCall('fire', { ...ok, busy: true })).toEqual({ ok: false, reason: 'busy' });
    expect(s.calls).toEqual({ fire: 3, police: 3 });
  });

  test('a ruined booth refuses first; no calls left beats busy and the need', () => {
    const s = new Services();
    expect(s.tryCall('fire', { burning: 0, activeHostiles: 0, boothStanding: false, busy: true })).toEqual({ ok: false, reason: 'ruined' });
    s.calls.fire = 0;
    expect(s.tryCall('fire', { burning: 0, activeHostiles: 0, boothStanding: true, busy: true })).toEqual({ ok: false, reason: 'noCalls' });
    expect(s.tryCall('police', { burning: 0, activeHostiles: 0, boothStanding: true, busy: true })).toEqual({ ok: false, reason: 'busy' });
    expect(s.check('police', ok)).toEqual({ ok: true });
    expect(s.calls.police).toBe(3);
  });
});

describe('calling from a booth in the sim (Agir)', () => {
  test('a new Sim has 3 + 3 calls and no hint', () => {
    const s = new Sim(1).snapshot();
    expect(s.services).toEqual({ calls: { fire: 3, police: 3 }, hint: { fire: false, police: false } });
  });

  test('red booth: a fire burns → ServiceCalled fire, one call spent; nothing burns → ServiceRefused noFire', () => {
    const { sim, press } = simAt(C(4, 23));
    expect(of(press(), 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'fire', reason: 'noFire' }]);
    expect(sim.services.calls.fire).toBe(3);
    sim.targets.ignite('car2', 'car2#x');
    expect(sim.snapshot().services.hint).toEqual({ fire: true, police: false });
    const ev = press();
    expect(of(ev, 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'fire' }]);
    expect(of(ev, 'ServiceRefused')).toEqual([]);
    expect(sim.snapshot().services.calls).toEqual({ fire: 2, police: 3 });
  });

  test('blue booth: fewer than 8 active rioters → fewRioters; 8 → ServiceCalled police', () => {
    const { sim, press } = simAt(C(5, 23));
    crowd(sim, 7);
    expect(of(press(), 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'police', reason: 'fewRioters' }]);
    crowd(sim, 1);
    expect(sim.snapshot().services.hint.police).toBe(true);
    expect(of(press(), 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'police' }]);
    expect(sim.services.calls).toEqual({ fire: 3, police: 2 });
  });

  test('Agir is a press: holding it does not call again; out of range (> 40 px) nothing happens', () => {
    const { sim } = simAt(C(4, 23));
    sim.targets.ignite('car2', 'car2#x');
    const ev: SimEvent[] = [];
    for (let i = 0; i < 120; i++) ev.push(...sim.step(PRESS));
    expect(of(ev, 'ServiceCalled')).toHaveLength(1);
    sim.player.pos = { x: def('boothRed').door.x, y: def('boothRed').door.y + CONFIG.services.callRange + 8 };
    expect([...sim.step(IDLE), ...sim.step(PRESS)].filter((e) => e.type === 'ServiceCalled' || e.type === 'ServiceRefused')).toEqual([]);
  });

  test('three calls then « no calls »; a new Sim starts again from 3 + 3', () => {
    const { sim, press } = simAt(C(4, 23));
    sim.targets.ignite('car2', 'car2#x');
    for (let i = 0; i < 3; i++) {
      expect(of(press(), 'ServiceCalled')).toHaveLength(1);
      gone(sim);
    }
    expect(of(press(), 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'fire', reason: 'noCalls' }]);
    expect(sim.snapshot().services.hint.fire).toBe(false);
    expect(new Sim(7).services.calls).toEqual({ fire: 3, police: 3 });
  });

  test('Paul between both doors (a tie) calls the red booth; nearer the blue one, the blue one', () => {
    const { sim, press } = simAt({ x: 5 * 32, y: 23 * 32 + 16 });
    sim.targets.ignite('car2', 'car2#x');
    crowd(sim, 8);
    expect(hyp(sim.player.pos, def('boothRed').door)).toBeCloseTo(hyp(sim.player.pos, def('boothBlue').door), 9);
    expect(of(press(), 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'fire' }]);
    sim.player.pos = { x: 5 * 32 + 4, y: 23 * 32 + 16 };
    expect(of(press(), 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'police' }]);
  });

  test('a repair that can start at the same distance wins over the booth (tie: repair > red > blue)', () => {
    const { sim, press } = simAt(C(4, 23));
    sim.targets.ignite('boothRed', 'boothRed#x');
    sim.toolboxes.carried = true;
    const ev = press();
    expect(of(ev, 'ServiceCalled')).toEqual([]);
    expect(of(ev, 'ServiceRefused')).toEqual([]);
    expect(sim.toolboxes.started).toBe(true);
  });

  test('without a toolbox the same press goes to the booth (the burning booth itself is a fire to put out)', () => {
    const { sim, press } = simAt(C(4, 23));
    sim.targets.ignite('boothRed', 'boothRed#x');
    expect(of(press(), 'ServiceCalled')).toEqual([{ type: 'ServiceCalled', kind: 'fire' }]);
    expect(sim.toolboxes.started).toBe(false);
  });

  test('the nearest wins: the blue booth nearer than a repairable red booth gets the press', () => {
    const { sim, press } = simAt(C(5, 23));
    sim.targets.ruin('boothRed', 'boothRed#x');
    sim.toolboxes.carried = true;
    expect(sim.snapshot().toolboxes.repairTarget).toBe('boothRed');
    const ev = press();
    expect(of(ev, 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'police', reason: 'fewRioters' }]);
    expect(sim.toolboxes.started).toBe(false);
  });

  test('a ruined booth refuses (no call spent); repaired, it calls again with the uses it had left', () => {
    const { sim, press } = simAt(C(4, 23));
    sim.targets.ignite('car2', 'car2#x');
    expect(of(press(), 'ServiceCalled')).toHaveLength(1);
    sim.targets.ruin('boothRed', 'boothRed#x');
    expect(of(press(), 'ServiceRefused')).toEqual([{ type: 'ServiceRefused', kind: 'fire', reason: 'ruined' }]);
    expect(sim.snapshot().services).toMatchObject({ calls: { fire: 2 }, hint: { fire: false } });
    sim.targets.repair('boothRed');
    gone(sim);
    sim.step(IDLE);
    expect(sim.snapshot().services.hint.fire).toBe(true);
    expect(of(press(), 'ServiceCalled')).toHaveLength(1);
    expect(sim.services.calls.fire).toBe(1);
  });
});
