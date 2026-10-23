import { describe, expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { DISTRICT } from '../../src/sim/map/district';
import { Sim } from '../../src/sim/sim';
import type { InputFrame, TargetId } from '../../src/sim/types';

const door = (id: TargetId) => DISTRICT.targets.find((d) => d.id === id)!.door;
const idle: InputFrame = {
  move: { x: 0, y: 0 },
  aim: null,
  run: false,
  strike: false,
  chargeHeld: false,
  throwRock: false,
  act: false,
  furie: false,
};

/** A sim past the school cinematic gate: round 1's school attack is not started at t = 0, so steps run normally. */
function sim(): Sim {
  return new Sim(7);
}

describe('Snapshot.actionHint (what a fresh Agir press would do, by the sim’s own rules)', () => {
  test('nothing around: null', () => {
    expect(sim().snapshot().actionHint).toBeNull();
  });

  test('a ruin in reach with a toolbox, no rioter close: repair at its door', () => {
    const s = sim();
    s.targets.ruin('busStop', 'x');
    s.toolboxes.carried = true;
    s.player.pos = { x: door('busStop').x, y: door('busStop').y + 20 };
    expect(s.snapshot().actionHint).toEqual({ kind: 'repair', target: 'busStop', at: door('busStop'), toolbox: null });
  });

  test('a burning target in reach with a toolbox: extinguish', () => {
    const s = sim();
    s.targets.ignite('busStop', 'x');
    s.toolboxes.carried = true;
    s.player.pos = { x: door('busStop').x, y: door('busStop').y + 20 };
    expect(s.snapshot().actionHint?.kind).toBe('extinguish');
  });

  test('a rioter close: no actionable hint (the press would do nothing)', () => {
    const s = sim();
    s.targets.ruin('busStop', 'x');
    s.toolboxes.carried = true;
    const p = { x: door('busStop').x, y: door('busStop').y + 20 };
    s.player.pos = p;
    s.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + 20, y: p.y } });
    expect(s.snapshot().actionHint).toBeNull();
  });

  test('a ruin in reach without a toolbox: needToolbox, pointing at the nearest toolbox on the ground', () => {
    const s = sim();
    s.targets.ruin('busStop', 'x');
    const p = { x: door('busStop').x, y: door('busStop').y + 20 };
    s.player.pos = p;
    const [a, b] = DISTRICT.kitSites;
    s.toolboxes.place([a!, b!], { x: -9999, y: -9999 });
    const near = [a!, b!].sort((u, v) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y))[0]!;
    expect(s.snapshot().actionHint).toEqual({ kind: 'needToolbox', target: 'busStop', at: door('busStop'), toolbox: near });
  });

  test('needToolbox with no toolbox on the ground: toolbox null', () => {
    const s = sim();
    s.targets.ruin('busStop', 'x');
    s.player.pos = { x: door('busStop').x, y: door('busStop').y + 20 };
    expect(s.snapshot().actionHint).toEqual({ kind: 'needToolbox', target: 'busStop', at: door('busStop'), toolbox: null });
  });

  test('in front of the red booth with a fire burning: callFire; with nothing burning (refused): null', () => {
    const s = sim();
    s.player.pos = { x: door('boothRed').x, y: door('boothRed').y + 32 };
    expect(s.snapshot().actionHint).toBeNull();
    s.targets.ignite('school', 'x');
    expect(s.snapshot().actionHint).toEqual({ kind: 'callFire', target: 'boothRed', at: door('boothRed'), toolbox: null });
  });

  test('the hint is what the press does: a callFire hint, pressed, calls the fire truck', () => {
    const s = sim();
    s.player.pos = { x: door('boothRed').x, y: door('boothRed').y + 32 };
    s.targets.ignite('school', 'x');
    expect(s.snapshot().actionHint?.kind).toBe('callFire');
    const ev = s.step({ ...idle, act: true });
    expect(ev.some((e) => e.type === 'ServiceCalled' && e.kind === 'fire')).toBe(true);
  });

  test('the hint is what the press does: a repair hint, pressed, starts the repair (progress, ring)', () => {
    const s = sim();
    s.targets.ruin('busStop', 'x');
    s.toolboxes.carried = true;
    s.player.pos = { x: door('busStop').x, y: door('busStop').y + 20 };
    s.step({ ...idle, act: true });
    const snap = s.snapshot();
    expect(snap.actionHint?.kind).toBe('repair');
    expect(snap.toolboxes.started).toBe(true);
    expect(snap.toolboxes.progress).toBeGreaterThan(0);
    expect(snap.toolboxes.progress).toBeLessThan(CONFIG.kit.repairSec);
  });

  test('ended session: null', () => {
    const s = sim();
    s.targets.ruin('busStop', 'x');
    s.player.pos = { x: door('busStop').x, y: door('busStop').y + 20 };
    s.quit();
    expect(s.snapshot().actionHint).toBeNull();
  });
});
