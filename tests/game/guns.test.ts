// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { weaponValue } from '../../src/game/hud/format';
import {
  AlertBanner,
  FLASHBALL_ALERT_MS,
  activeIncidents,
  alertFromEvent,
  flashballHintId,
  hintIds,
  incidentAlert,
  pixelSvg,
} from '../../src/game/hud/alerts';
import { GLOVE_BACK_MS, GLOVE_OUT_MS, bulletDash, gloveActive, gloveExtent, riflePose, springPoints } from '../../src/game/render/gunMath';
import { Sim, type Snapshot } from '../../src/sim/sim';

const snap = (edit: (s: Snapshot) => void = () => {}): Snapshot => {
  const s = new Sim(1).snapshot();
  edit(s);
  return s;
};

describe('the spring-loaded glove (render math)', () => {
  test('shoots out in 120 ms with a small overshoot, ends on its target, pulls back, then is gone', () => {
    expect(gloveExtent(0)).toBe(0);
    expect(gloveExtent(GLOVE_OUT_MS / 4)).toBeGreaterThan(0.5);
    let peak = 0;
    for (let t = 0; t < GLOVE_OUT_MS; t += 2) peak = Math.max(peak, gloveExtent(t));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.1);
    expect(gloveExtent(GLOVE_OUT_MS)).toBeCloseTo(1, 6);
    expect(gloveExtent(GLOVE_OUT_MS + GLOVE_BACK_MS / 2)).toBeLessThan(1);
    expect(gloveExtent(GLOVE_OUT_MS + GLOVE_BACK_MS)).toBe(0);
    expect(gloveActive(GLOVE_OUT_MS + GLOVE_BACK_MS - 1)).toBe(true);
    expect(gloveActive(GLOVE_OUT_MS + GLOVE_BACK_MS)).toBe(false);
  });

  test('the spring zigzags from the hand to the glove, in whole pixels', () => {
    const pts = springPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 5, 3);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 });
    expect(pts).toHaveLength(11);
    for (const p of pts) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(3);
    }
  });
});

describe('bullets and rifles (render math)', () => {
  test('a bullet is a short dash along its direction, its head ahead', () => {
    const d = bulletDash({ x: 10, y: 10 }, { x: 0, y: 1 });
    expect(d.tail.x).toBe(10);
    expect(d.head.y).toBeGreaterThan(d.tail.y);
  });

  test('the rifle is raised along the aim line when aiming, lowered at the side otherwise; never upside down', () => {
    expect(riflePose({ x: 1, y: 0 }, true)).toEqual({ angle: 0, flipY: false, side: 1 });
    const left = riflePose({ x: -1, y: 0 }, true);
    expect(left.angle).toBeCloseTo(180, 6);
    expect(left.flipY).toBe(true);
    expect(riflePose({ x: 1, y: 0 }, false).angle).toBe(30);
  });
});

describe('HUD', () => {
  test('ARME row: « Gant de boxe (6) », « Flashball (6) »', () => {
    expect(weaponValue(snap((s) => (s.weapon = { kind: 'gant', uses: 6 })))).toBe('Gant de boxe (6)');
    expect(weaponValue(snap((s) => (s.weapon = { kind: 'flashball', uses: 6 })))).toBe('Flashball (6)');
  });

  test('regular weapons (the gant and the flashball too) never get an edge indicator', () => {
    const s = snap((x) => {
      x.weaponsOnGround = [
        { id: 1, kind: 'gant', pos: { x: 100, y: 100 }, expiresAt: null },
        { id: 2, kind: 'flashball', pos: { x: 200, y: 100 }, expiresAt: null },
      ];
    });
    expect(activeIncidents(s)).toEqual([]);
    expect(hintIds(s)).toEqual([flashballHintId({ x: 200, y: 100 })]);
  });

  test('FlashballDropped: a short one-line positioned hint « FLASHBALL AU SOL », dropped once the flashball is taken', () => {
    const pos = { x: 300, y: 400 };
    const a = alertFromEvent({ type: 'FlashballDropped', pos })!;
    expect(a).toMatchObject({ kind: 'flashball', pos, incident: flashballHintId(pos) });
    const shown = incidentAlert('flashball');
    expect(shown).toMatchObject({ title: 'FLASHBALL AU SOL', sub: '', positioned: true, ms: FLASHBALL_ALERT_MS });
    expect(pixelSvg('flashball')).toContain('<svg');

    const parent = document.createElement('div');
    const banner = new AlertBanner(parent);
    banner.push(a);
    expect(parent.querySelector('.title')!.textContent).toBe('FLASHBALL AU SOL');
    expect((parent.querySelector('.sub') as HTMLElement).hidden).toBe(true);
    expect((parent.querySelector('.dir') as HTMLElement).hidden).toBe(false);
    banner.prune(new Set());
    // still on the ground
    banner.prune(new Set([flashballHintId(pos)]));
    expect(banner.shown).toBe(a);
    // picked up
    banner.prune(new Set());
    expect(banner.shown).toBeNull();
    banner.destroy();
  });
});

describe('audio', () => {
  test('shooter pop per bullet, flashball thump, glove boing on a hit (a miss only whooshes)', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const pop = vi.spyOn(a, 'pop');
    const thump = vi.spyOn(a, 'thump');
    const boing = vi.spyOn(a, 'boing');
    a.onEvents([
      { type: 'BulletFired', id: 1 },
      { type: 'BulletFired', id: 2 },
      { type: 'FlashballFired', id: 3, from: { x: 0, y: 0 }, dir: { x: 1, y: 0 } },
      { type: 'GlovePunched', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, lifeId: 4 },
      { type: 'GlovePunched', from: { x: 0, y: 0 }, to: { x: 160, y: 0 }, lifeId: null },
    ]);
    expect(pop).toHaveBeenCalledTimes(2);
    expect(thump).toHaveBeenCalledTimes(1);
    expect(boing).toHaveBeenCalledTimes(1);
  });
});
