import { describe, expect, test } from 'vitest';
import {
  FALL_SPECS,
  HELICOPTER_RISE_PX,
  KNOCKED_DELAY_MS,
  PANCAKE_FLAT_MS,
  REDUCED_FALL_SCALE,
  SHAKE_BIG,
  SHAKE_MEDIUM,
  SHAKE_SMALL,
  TRASH_DIVE,
  TRASH_LEGS_END,
  WORDS,
  dominoWord,
  fallMs,
  fallPose,
  fallTravel,
  hitShake,
  hitStopMs,
  hitWordKind,
  koShake,
  koWordKind,
  newFallPose,
  pickWord,
} from '../../src/game/render/fallMath';
import type { Fall, FallKind } from '../../src/sim/types';

const KINDS = Object.keys(FALL_SPECS) as FallKind[];
const fall = (kind: FallKind, wtf = false, dir = { x: 1, y: 0 }): Fall => ({ kind, wtf, dir });
const pose = (f: Fall, ms: number, reduced = false, dist = fallTravel(f.kind)) => fallPose(f, dist, ms, reduced, newFallPose());

describe('fall poses', () => {
  test('every fall ends lying still at the end of its travel', () => {
    for (const kind of KINDS) {
      const p = pose(fall(kind), fallMs(kind, false) + 1);
      expect(p.t).toBe(1);
      expect(p.frame).toBe('ko');
      expect(p.angle).toBe(0);
      expect(p.lift).toBe(0);
      expect(p.scaleX).toBe(1);
      expect(p.scaleY).toBe(1);
      expect(p.legs).toBe(false);
      expect(p.can).toBe(0);
      if (kind !== 'trashcan') expect(p.dx).toBeCloseTo(FALL_SPECS[kind].travel, 6);
    }
  });

  test('the travel follows fall.dir and the given (clamped) distance', () => {
    const p = pose(fall('faceplant', true, { x: 0, y: -1 }), 5000, false, 30);
    expect(p.dx).toBeCloseTo(0, 6);
    expect(p.dy).toBeCloseTo(-30, 6);
    expect(fallTravel('flyspin')).toBe(70);
    expect(fallTravel('faceplant')).toBe(90);
    expect(fallTravel('crumple')).toBe(0);
  });

  test('flyspin: hops away spinning 1.5 turns; tripleflip: 3 turns in a high arc', () => {
    const f = fall('flyspin');
    const mid = pose(f, FALL_SPECS.flyspin.ms / 2);
    expect(mid.lift).toBeGreaterThan(15);
    expect(mid.dx).toBeGreaterThan(35);
    expect(pose(f, FALL_SPECS.flyspin.ms - 1).angle).toBeCloseTo(540, -1);
    const left = pose(fall('flyspin', false, { x: -1, y: 0 }), FALL_SPECS.flyspin.ms - 1);
    expect(left.angle).toBeLessThan(-500);
    expect(pose(fall('tripleflip', true), FALL_SPECS.tripleflip.ms - 1).angle).toBeCloseTo(1080, -1);
    expect(pose(fall('tripleflip', true), FALL_SPECS.tripleflip.ms / 2).lift).toBeGreaterThan(55);
  });

  test('pancake: flat (×1.5, ×0.15) for PANCAKE_FLAT_MS, then pops back with an overshoot', () => {
    const p = pose(fall('pancake'), 100);
    expect(p).toMatchObject({ scaleX: 1.5, scaleY: 0.15, origin: 'feet' });
    expect(pose(fall('pancake'), PANCAKE_FLAT_MS - 1).scaleY).toBe(0.15);
    const pop = pose(fall('pancake'), PANCAKE_FLAT_MS + (FALL_SPECS.pancake.ms - PANCAKE_FLAT_MS) * 0.4);
    expect(pop.scaleY).toBeGreaterThan(1.1);
    expect(pop.frame).toBe('ko');
  });

  test('helicopter: straight up ~60 px spinning fast, then drops', () => {
    const f = fall('helicopter', true);
    const top = pose(f, FALL_SPECS.helicopter.ms * 0.6);
    expect(top.lift).toBeCloseTo(HELICOPTER_RISE_PX, 6);
    expect(top.dx).toBe(0);
    expect(Math.abs(top.angle)).toBeGreaterThan(720);
    expect(pose(f, FALL_SPECS.helicopter.ms * 0.99).lift).toBeLessThan(5);
  });

  test('faceplant: a hop, then a slide with a dust trail', () => {
    const f = fall('faceplant', true);
    expect(pose(f, FALL_SPECS.faceplant.ms * 0.07).trail).toBe(false);
    const slide = pose(f, FALL_SPECS.faceplant.ms * 0.5);
    expect(slide.trail).toBe(true);
    expect(slide.dx).toBeGreaterThan(40);
  });

  test('trashcan: the can appears, only the legs stick out (upside down) ~1.5 s, then the can fades', () => {
    const f = fall('trashcan', true);
    const ms = FALL_SPECS.trashcan.ms;
    expect(pose(f, ms * TRASH_DIVE * 0.5).can).toBeCloseTo(0.5, 6);
    const legs = pose(f, ms * 0.5);
    expect(legs).toMatchObject({ legs: true, can: 1, frame: 'stand' });
    expect(Math.abs(legs.angle - 180)).toBeLessThan(10);
    expect((TRASH_LEGS_END - TRASH_DIVE) * ms).toBeGreaterThanOrEqual(1400);
    const fade = pose(f, ms * (TRASH_LEGS_END + (1 - TRASH_LEGS_END) / 2));
    expect(fade.legs).toBe(false);
    expect(fade.can).toBeCloseTo(0.5, 6);
  });

  test('wobble: decaying side wobbles standing, then a topple', () => {
    const f = fall('wobble');
    const ms = FALL_SPECS.wobble.ms;
    const early = Math.max(...[0.02, 0.04, 0.06, 0.08].map((k) => Math.abs(pose(f, ms * k).angle)));
    const late = Math.max(...[0.5, 0.52, 0.54, 0.56, 0.58].map((k) => Math.abs(pose(f, ms * k).angle)));
    expect(early).toBeGreaterThan(late);
    expect(pose(f, ms * 0.99).angle).toBeGreaterThan(80);
    expect(pose(f, ms * 0.5).frame).toBe('stand');
  });

  test('knocked: stays up KNOCKED_DELAY_MS, then topples', () => {
    const f = fall('knocked');
    expect(pose(f, KNOCKED_DELAY_MS - 10).angle).toBe(0);
    expect(pose(f, FALL_SPECS.knocked.ms - 5).angle).toBeGreaterThan(80);
  });

  test('reduced motion: shorter, no spin and no hop', () => {
    expect(fallMs('tripleflip', true)).toBe(Math.round(FALL_SPECS.tripleflip.ms * REDUCED_FALL_SCALE));
    for (const kind of KINDS) {
      for (const k of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const p = pose(fall(kind, true), fallMs(kind, true) * k, true);
        expect(p.lift).toBe(0);
        if (!p.legs) expect(Math.abs(p.angle)).toBe(0);
      }
    }
  });

  test('fallPose writes into `out` and returns it', () => {
    const out = newFallPose();
    expect(fallPose(fall('spin'), 0, 100, false, out)).toBe(out);
  });
});

describe('onomatopoeias', () => {
  test('a KO word by fall: SPLOTCH pancake, BOING glove, PIOU flashball, TOC rock, BONK stick, POW/PAF hands, WTF', () => {
    expect(koWordKind(fall('pancake'), false)).toBe('pancake');
    expect(koWordKind(fall('bounce'), true)).toBe('glove');
    expect(koWordKind(fall('backflip'), false)).toBe('flashball');
    expect(koWordKind(fall('wobble'), false)).toBe('rock');
    expect(koWordKind(fall('flyspin'), false)).toBe('stick');
    expect(koWordKind(fall('flyspin'), true)).toBeNull();
    expect(koWordKind(fall('crumple'), false)).toBe('hands');
    expect(koWordKind(fall('spin'), false)).toBe('hands');
    expect(koWordKind(fall('trashcan', true), false)).toBe('wtf');
    expect(koWordKind(fall('knocked'), false)).toBeNull();
  });

  test('a hit word by source', () => {
    expect(hitWordKind('melee', null)).toBe('hands');
    expect(hitWordKind('melee', 'panneau')).toBe('stick');
    expect(hitWordKind('rock', null)).toBe('rock');
    expect(hitWordKind('flashball', 'flashball')).toBe('flashball');
    expect(hitWordKind('beam', null)).toBeNull();
    expect(hitWordKind('gant', 'gant')).toBeNull();
  });

  test('two words per kind (WTF has four), picked by r', () => {
    expect(pickWord('hands', 0)).toBe('POW !');
    expect(pickWord('hands', 0.99)).toBe('PAF !');
    expect(pickWord('hands', 1)).toBe('PAF !');
    expect(pickWord('pancake', 0)).toBe('SPLOTCH !');
    expect(WORDS.wtf).toContain('WTF !?');
    expect(new Set([0, 0.3, 0.6, 0.9].map((r) => pickWord('wtf', r))).size).toBe(4);
    expect(dominoWord(2)).toBe('DOMINO ×3 !');
  });
});

describe('juice', () => {
  test('shake: small for hands, medium for weapons, big for WTF and the Caïd; none under reduced motion', () => {
    expect(hitShake('melee', null, false)).toBe(SHAKE_SMALL);
    expect(hitShake('melee', 'baton', false)).toBe(SHAKE_MEDIUM);
    expect(hitShake('rock', null, false)).toBe(SHAKE_MEDIUM);
    expect(hitShake('melee', 'baton', true)).toBeNull();
    expect(koShake(fall('domino', true), false, false)).toBe(SHAKE_BIG);
    expect(koShake(fall('crumple'), true, false)).toBe(SHAKE_BIG);
    expect(koShake(fall('crumple'), false, false)).toBeNull();
    expect(koShake(fall('domino', true), false, true)).toBeNull();
  });

  test('hit-stop: doubled on a WTF KO, halved under reduced motion', () => {
    expect(hitStopMs(60, false, false)).toBe(60);
    expect(hitStopMs(60, true, false)).toBe(120);
    expect(hitStopMs(60, false, true)).toBe(30);
    expect(hitStopMs(60, true, true)).toBe(60);
  });
});
