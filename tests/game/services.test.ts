import { describe, expect, test } from 'vitest';
import { contextPrompt } from '../../src/game/hud/format';
import {
  ALLY_LOOKS,
  BOOTH_TEXT_FADE_MS,
  BOOTH_TEXT_MS,
  REFUSAL_TEXT,
  blinkOn,
  boothTextAlpha,
  facingOf,
  jetPoint,
  officerFrame,
  officerTexture,
  sirenFrame,
  strikeLanded,
} from '../../src/game/render/serviceMath';
import { DISTRICT } from '../../src/sim/map/district';
import { Sim, type Snapshot } from '../../src/sim/sim';

const door = (id: string) => DISTRICT.targets.find((t) => t.id === id)!.door;

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}

describe('booth texts', () => {
  test('every refusal has its line under the booth', () => {
    expect(REFUSAL_TEXT).toEqual({
      noFire: 'Aucun feu à éteindre',
      fewRioters: 'Pas assez de casseurs',
      noCalls: 'Plus d’appels',
      busy: 'Déjà en route',
      ruined: 'Cabine hors service',
    });
  });

  test('a line stays fully shown, then fades out over its last ms', () => {
    expect(boothTextAlpha(-1)).toBe(0);
    expect(boothTextAlpha(0)).toBe(1);
    expect(boothTextAlpha(BOOTH_TEXT_MS - BOOTH_TEXT_FADE_MS)).toBe(1);
    expect(boothTextAlpha(BOOTH_TEXT_MS - BOOTH_TEXT_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(boothTextAlpha(BOOTH_TEXT_MS)).toBe(0);
  });

  test('the « ! » blinks', () => {
    expect(blinkOn(0)).toBe(true);
    expect(blinkOn(300)).toBe(false);
    expect(blinkOn(500)).toBe(true);
  });
});

describe('truck and officers', () => {
  test('facing follows the main axis of movement, keeps the last one when still', () => {
    expect(facingOf({ x: 2, y: 1 }, 'north')).toBe('east');
    expect(facingOf({ x: -2, y: 1 }, 'north')).toBe('west');
    expect(facingOf({ x: 0.5, y: 3 }, 'east')).toBe('south');
    expect(facingOf({ x: 0, y: -3 }, 'east')).toBe('north');
    expect(facingOf({ x: 0, y: 0 }, 'west')).toBe('west');
  });

  test('siren lights swap frames', () => {
    expect(sirenFrame(0)).toBe(0);
    expect(sirenFrame(170)).toBe(1);
  });

  test('officer look and frames are role driven', () => {
    expect(ALLY_LOOKS.police.cap).toBe('kepi');
    expect(officerTexture('police', 'strike')).toBe('ally_police_strike');
    expect(officerFrame('down', true, 0)).toBe('down');
    expect(officerFrame('strike', false, 0)).toBe('strike');
    expect(officerFrame('run', false, 999)).toBe('walk0');
    expect(officerFrame('run', true, 0)).toBe('walk0');
    expect(officerFrame('run', true, 150)).toBe('walk1');
  });

  test('a strike ending next to a rioter is drawn as a hit on the nearest one; a miss or a strike going on is not', () => {
    const at = { x: 100, y: 100 };
    const near = { pos: { x: 120, y: 100 }, state: 'ko' };
    const nearer = { pos: { x: 110, y: 100 }, state: 'chase' };
    const far = { pos: { x: 200, y: 100 }, state: 'chase' };
    expect(strikeLanded('strike', 'run', at, [near, nearer, far], 30)).toEqual(nearer.pos);
    expect(strikeLanded('strike', 'run', at, [far], 30)).toBeNull();
    expect(strikeLanded('strike', 'strike', at, [nearer], 30)).toBeNull();
    expect(strikeLanded('run', 'run', at, [nearer], 30)).toBeNull();
    expect(strikeLanded(undefined, 'run', at, [nearer], 30)).toBeNull();
  });

  test('a water jet arcs between nozzle and door', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    expect(jetPoint(a, b, 0, 20)).toEqual(a);
    expect(jetPoint(a, b, 1, 20)).toEqual(b);
    expect(jetPoint(a, b, 0.5, 20)).toEqual({ x: 50, y: -20 });
  });

  test('the snapshot gives each officer its role', () => {
    const sim = new Sim(3);
    sim.allies.addFighter('police', { ...door('boothRed') }, { hp: 1 });
    expect(sim.snapshot().allies.police.map((o) => o.role)).toEqual(['police']);
  });
});

describe('contextPrompt: booths', () => {
  const front = { x: door('boothRed').x, y: door('boothRed').y + 32 };

  test('in front of the red booth: call the fire truck (touch: Agir labelled « Appeler »)', () => {
    const s = snap((x) => {
      x.player.pos = { ...front };
    });
    expect(contextPrompt(s)).toEqual({ text: 'F — Appeler les pompiers', label: 'Appeler' });
    expect(contextPrompt(s, true)).toEqual({ text: 'Appeler les pompiers', label: 'Appeler' });
  });

  test('in front of the blue booth: call the police', () => {
    const s = snap((x) => {
      x.player.pos = { x: door('boothBlue').x, y: door('boothBlue').y + 32 };
    });
    expect(contextPrompt(s)).toEqual({ text: 'F — Appeler la police', label: 'Appeler' });
  });

  test('out of reach: no prompt', () => {
    const s = snap((x) => {
      x.player.pos = { x: front.x, y: front.y + 20 };
    });
    expect(contextPrompt(s)).toBeNull();
  });

  test('a ruined booth: informational « Cabine hors service »', () => {
    const s = snap((x) => {
      x.player.pos = { ...front };
      x.targets.find((t) => t.id === 'boothRed')!.state = 'ruined';
    });
    expect(contextPrompt(s)).toEqual({ text: 'Cabine hors service', label: null });
  });

  test('a repair at the same door wins the tie', () => {
    const s = snap((x) => {
      x.player.pos = { ...front };
      x.toolboxes.carried = true;
      x.toolboxes.repairTarget = 'boothRed';
      x.toolboxes.canRepair = true;
      x.toolboxes.repairKind = 'fire';
    });
    expect(contextPrompt(s)).toEqual({ text: 'F — Éteindre le feu', label: 'Éteindre' });
  });
});
