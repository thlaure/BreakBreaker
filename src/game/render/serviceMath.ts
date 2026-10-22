import type { FighterRole } from '../../sim/allies';
import type { ServiceKind, ServiceRefusal, Vec } from '../../sim/types';

/** The short line shown under a booth when a call is refused (nothing spent). */
export const REFUSAL_TEXT: Readonly<Record<ServiceRefusal, string>> = {
  noFire: 'Aucun feu à éteindre',
  fewRioters: 'Pas assez de casseurs',
  noCalls: 'Plus d’appels',
  busy: 'Déjà en route',
  ruined: 'Cabine hors service',
};

/** The line shown under a booth when a call goes through. */
export const CALLED_TEXT: Readonly<Record<ServiceKind, string>> = {
  fire: 'Pompiers en route !',
  police: 'Police en route !',
};

/** How long a booth's line stays, and its fade at the end (ms). */
export const BOOTH_TEXT_MS = 1800;
export const BOOTH_TEXT_FADE_MS = 400;

/** Alpha of a booth line `age` ms after it was shown (1, then a linear fade over the last BOOTH_TEXT_FADE_MS; 0 after). */
export function boothTextAlpha(age: number): number {
  if (age < 0 || age >= BOOTH_TEXT_MS) return 0;
  const left = BOOTH_TEXT_MS - age;
  return left >= BOOTH_TEXT_FADE_MS ? 1 : left / BOOTH_TEXT_FADE_MS;
}

/** The blinking « ! » over a booth whose call would be useful: on for the first half of every BLINK_MS. */
export const BLINK_MS = 500;
export function blinkOn(nowMs: number): boolean {
  return Math.floor(nowMs / (BLINK_MS / 2)) % 2 === 0;
}

/** Which way a vehicle is drawn: side view (flipped for the west), front (driving south) or back (driving north). */
export type Facing = 'east' | 'west' | 'south' | 'north';

/** Facing from a frame's movement; below `still` px it keeps the previous one. */
export function facingOf(delta: Vec, prev: Facing, still = 0.05): Facing {
  const ax = Math.abs(delta.x);
  const ay = Math.abs(delta.y);
  if (ax < still && ay < still) return prev;
  if (ax >= ay) return delta.x < 0 ? 'west' : 'east';
  return delta.y < 0 ? 'north' : 'south';
}

/** Siren light frame (0 / 1), swapping every SIREN_MS. */
export const SIREN_MS = 160;
export function sirenFrame(nowMs: number): 0 | 1 {
  return Math.floor(nowMs / SIREN_MS) % 2 === 0 ? 0 : 1;
}

/** The cap an officer wears: the police képi, the prison guard's beret. */
export type CapShape = 'kepi' | 'beret';

/** How a foot ally reads on screen, by role (uniform colours, cap, what it holds). */
export interface AllyLook {
  uniform: number;
  uniformHi: number;
  uniformLo: number;
  trousers: number;
  cap: CapShape;
  capColor: number;
  /** Cap band / badge colour. */
  band: number;
  /** Baton colour; null = bare hands (a raised fist on the strike frame). */
  baton: number | null;
  /** Shoulder boards colour (null = none). */
  shoulder: number | null;
  /** The ring of keys hanging at the belt (null = none). */
  keys: number | null;
}

/**
 * One look per foot role (Record over FighterRole: a new role does not compile without its look). 'police' = blue
 * uniform, navy trousers, a blue képi with a white band and a black baton. 'guard' (the prison's) = a dark-grey
 * uniform with silver shoulder boards, black trousers, a burgundy beret with a silver badge, bare hands (their blows
 * take 1 hp) and a ring of gold keys at the belt: never mistaken for the blue police.
 */
export const ALLY_LOOKS: Readonly<Record<FighterRole, AllyLook>> = {
  police: {
    uniform: 0x3b6fd2,
    uniformHi: 0x7aa8f2,
    uniformLo: 0x2a4f9c,
    trousers: 0x1f2a4a,
    cap: 'kepi',
    capColor: 0x24346a,
    band: 0xf4f4f0,
    baton: 0x14121c,
    shoulder: null,
    keys: null,
  },
  guard: {
    uniform: 0x585e68,
    uniformHi: 0x7c828c,
    uniformLo: 0x3c4048,
    trousers: 0x1c1e24,
    cap: 'beret',
    capColor: 0x8a2433,
    band: 0xd8dce4,
    baton: null,
    shoulder: 0xb8bcc4,
    keys: 0xffd23f,
  },
};

/** Officer frames, by name: two walk steps, the baton raised (strike windup), lying knocked out. */
export const OFFICER_FRAMES = ['walk0', 'walk1', 'strike', 'down'] as const;
export type OfficerFrame = (typeof OFFICER_FRAMES)[number];

export function officerTexture(role: FighterRole, frame: OfficerFrame): string {
  return `ally_${role}_${frame}`;
}

/** Walk step (ms per frame) while moving; standing still shows walk0. */
export const STEP_MS = 140;

/** The frame of an officer from its sim state and whether it moved this frame. */
export function officerFrame(state: 'run' | 'strike' | 'down', moving: boolean, nowMs: number): OfficerFrame {
  if (state === 'down') return 'down';
  if (state === 'strike') return 'strike';
  if (!moving) return 'walk0';
  return Math.floor(nowMs / STEP_MS) % 2 === 0 ? 'walk0' : 'walk1';
}

/**
 * The sim sends no HitConfirmed for an officer's blow: a strike ending (state 'strike' → anything else) with a rioter
 * still within `range` px is drawn as a hit on the nearest such rioter. Returns its position, or null (a miss).
 */
export function strikeLanded(prev: string | undefined, now: string, at: Vec, rioters: readonly { pos: Vec; state: string }[], range: number): Vec | null {
  if (prev !== 'strike' || now === 'strike') return null;
  let best: Vec | null = null;
  let bestD = range;
  for (const h of rioters) {
    const d = Math.hypot(h.pos.x - at.x, h.pos.y - at.y);
    if (d <= bestD) {
      best = h.pos;
      bestD = d;
    }
  }
  return best;
}

/** A point of a water jet from `from` to `to` at `t` in [0, 1]: a straight line raised by an arc of `lift` px. */
export function jetPoint(from: Vec, to: Vec, t: number, lift: number): Vec {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t) };
}
