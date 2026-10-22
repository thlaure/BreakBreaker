import type { Fall, FallKind, HeldKind } from '../../sim/types';

/**
 * Pure maths of the KO falls (render only): per-kind timing and travel, the pose of a falling body at a given time, the
 * onomatopoeia words, the camera shake and the hit-stop. No Phaser, no allocation in fallPose (it writes into `out`).
 */

export interface FallSpec {
  /** Duration (ms) at full motion. */
  ms: number;
  /** Nominal travel (px) along fall.dir; the view clamps it to free ground (landingDistance). */
  travel: number;
  /** Progress (0..1) at which the body hits the ground (dust burst), or -1 for none. */
  impact: number;
}

export const FALL_SPECS: Readonly<Record<FallKind, FallSpec>> = {
  crumple: { ms: 420, travel: 0, impact: 0.4 },
  spin: { ms: 520, travel: 0, impact: 1 },
  flyspin: { ms: 650, travel: 70, impact: 1 },
  pancake: { ms: 850, travel: 0, impact: 0 },
  // the gant plays its launch flight; this is only the fallback when no launch came with it
  bounce: { ms: 420, travel: 0, impact: 0.4 },
  backflip: { ms: 650, travel: 40, impact: 1 },
  wobble: { ms: 1000, travel: 0, impact: 1 },
  tripleflip: { ms: 1100, travel: 60, impact: 1 },
  helicopter: { ms: 1200, travel: 0, impact: 1 },
  faceplant: { ms: 950, travel: 90, impact: 0.15 },
  trashcan: { ms: 2200, travel: 0, impact: -1 },
  domino: { ms: 850, travel: 80, impact: 1 },
  knocked: { ms: 650, travel: 0, impact: 1 },
};

/** Under prefers-reduced-motion every fall is this much shorter (and loses its spins, hops and wobbles). */
export const REDUCED_FALL_SCALE = 0.6;
/** A domino victim stays up this long before it topples. */
export const KNOCKED_DELAY_MS = 150;
/** Pancake: how long the body stays flat before it pops back. */
export const PANCAKE_FLAT_MS = 500;
/** Trash can phases (fractions of the fall): the dive, then legs out of the can, then the can fades. */
export const TRASH_DIVE = 0.12;
export const TRASH_LEGS_END = 0.82;
/** Hop heights (px). */
export const HELICOPTER_RISE_PX = 60;
export const TRIPLEFLIP_ARC_PX = 60;

export function fallMs(kind: FallKind, reduced: boolean): number {
  const ms = FALL_SPECS[kind].ms;
  return reduced ? Math.round(ms * REDUCED_FALL_SCALE) : ms;
}

export interface FallPose {
  /** Ground offset (px) from the KO point. */
  dx: number;
  dy: number;
  /** Height above the ground (px). */
  lift: number;
  /** Degrees. */
  angle: number;
  scaleX: number;
  scaleY: number;
  /** Which frame to show: standing (idle) or lying (KO). */
  frame: 'stand' | 'ko';
  /** Rotation / squash pivot: the feet or the middle of the body. */
  origin: 'feet' | 'mid';
  /** Trash can: only the legs show, upside down, out of the can. */
  legs: boolean;
  /** Trash can alpha (0 = no can). */
  can: number;
  /** Dust trail under the body (faceplant slide). */
  trail: boolean;
  /** 0..1 progress (1 = done: lie still). */
  t: number;
}

export function newFallPose(): FallPose {
  return { dx: 0, dy: 0, lift: 0, angle: 0, scaleX: 1, scaleY: 1, frame: 'ko', origin: 'feet', legs: false, can: 0, trail: false, t: 0 };
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const easeIn = (t: number): number => t * t;
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * Pose of a body `ms` after its KO, falling per `fall` over `dist` px of travel (≤ FALL_SPECS travel), written into
 * `out` (returned). At t = 1 the pose is the lying KO body at the end of the travel. Reduced motion: shorter, no spin,
 * no hop, no wobble (the travel, the pancake and the trash can stay, they do not shake the screen).
 */
export function fallPose(fall: Fall, dist: number, ms: number, reduced: boolean, out: FallPose): FallPose {
  const kind = fall.kind;
  const dur = fallMs(kind, reduced);
  const t = clamp01(ms / dur);
  const side = fall.dir.x < 0 ? -1 : 1;
  const m = reduced ? 0 : 1;
  out.dx = 0;
  out.dy = 0;
  out.lift = 0;
  out.angle = 0;
  out.scaleX = 1;
  out.scaleY = 1;
  out.frame = 'ko';
  out.origin = 'feet';
  out.legs = false;
  out.can = 0;
  out.trail = false;
  out.t = t;
  let d = 0;
  if (t >= 1) {
    d = dist;
  } else {
    switch (kind) {
      case 'crumple':
      case 'bounce': {
        if (t < 0.4) {
          const u = t / 0.4;
          out.frame = 'stand';
          out.scaleY = 1 - 0.4 * u;
          out.scaleX = 1 + 0.25 * u;
        } else {
          const u = (t - 0.4) / 0.6;
          out.scaleY = 1 - 0.2 * (1 - u);
          out.scaleX = 1 + 0.15 * (1 - u);
        }
        break;
      }
      case 'spin':
        out.origin = 'mid';
        out.angle = m * side * 360 * easeOut(t);
        out.lift = m * Math.sin(Math.PI * t) * 6;
        break;
      case 'flyspin':
        out.origin = 'mid';
        d = dist * easeOut(t);
        out.lift = m * Math.sin(Math.PI * t) * 22;
        out.angle = m * side * 540 * easeOut(t);
        break;
      case 'pancake': {
        const flat = PANCAKE_FLAT_MS / FALL_SPECS.pancake.ms;
        if (t < flat) {
          out.frame = 'stand';
          out.scaleX = 1.5;
          out.scaleY = 0.15;
        } else {
          const u = (t - flat) / (1 - flat);
          out.scaleX = u < 0.4 ? 1.5 - 0.5 * (u / 0.4) : 1;
          out.scaleY = u < 0.4 ? 0.15 + (1.15 - 0.15) * (u / 0.4) : 1.15 - 0.15 * ((u - 0.4) / 0.6);
          out.lift = m * Math.sin(Math.PI * u) * 8;
        }
        break;
      }
      case 'backflip':
        out.origin = 'mid';
        d = dist * t;
        out.lift = m * Math.sin(Math.PI * t) * 26;
        // backwards: against the travel side
        out.angle = m * -side * 360 * easeInOut(t);
        break;
      case 'wobble':
        out.frame = 'stand';
        if (t < 0.7) {
          const u = t / 0.7;
          out.angle = m * side * 16 * Math.sin(u * 3 * 2 * Math.PI) * (1 - u);
        } else {
          out.angle = m * side * 90 * easeIn((t - 0.7) / 0.3);
        }
        break;
      case 'tripleflip':
        out.origin = 'mid';
        d = dist * easeOut(t);
        out.lift = m * Math.sin(Math.PI * t) * TRIPLEFLIP_ARC_PX;
        out.angle = m * side * 1080 * easeInOut(t);
        break;
      case 'helicopter':
        out.origin = 'mid';
        out.lift = m * HELICOPTER_RISE_PX * (t < 0.6 ? easeOut(t / 0.6) : 1 - easeIn((t - 0.6) / 0.4));
        out.angle = m * side * 1800 * t;
        break;
      case 'faceplant':
        if (t < 0.15) {
          out.lift = m * Math.sin((Math.PI * t) / 0.15) * 10;
        } else {
          const u = (t - 0.15) / 0.85;
          d = dist * easeOut(u);
          out.trail = u < 0.9;
          out.scaleY = 0.9;
        }
        break;
      case 'trashcan':
        if (t < TRASH_DIVE) {
          const u = t / TRASH_DIVE;
          out.origin = 'mid';
          out.lift = m * Math.sin(Math.PI * u) * 24;
          out.angle = m * side * 180 * u;
          out.can = u;
        } else if (t < TRASH_LEGS_END) {
          const u = (t - TRASH_DIVE) / (TRASH_LEGS_END - TRASH_DIVE);
          out.frame = 'stand';
          out.legs = true;
          out.can = 1;
          // the legs kick, less and less
          out.angle = 180 + m * 8 * Math.sin(u * 12 * Math.PI) * (1 - u);
        } else {
          const u = (t - TRASH_LEGS_END) / (1 - TRASH_LEGS_END);
          out.can = 1 - u;
          d = 0;
          out.dx = side * 14 * u;
        }
        break;
      case 'domino':
        out.origin = 'mid';
        d = dist * easeOut(t);
        out.lift = m * Math.sin(Math.PI * t) * 24;
        out.angle = m * side * 720 * easeOut(t);
        break;
      case 'knocked': {
        out.frame = 'stand';
        const delay = KNOCKED_DELAY_MS / FALL_SPECS.knocked.ms;
        if (t >= delay) out.angle = m * side * 90 * easeIn((t - delay) / (1 - delay));
        break;
      }
    }
  }
  out.dx += fall.dir.x * d;
  out.dy += fall.dir.y * d;
  // the trash can body lies beside the can once it is out
  if (kind === 'trashcan' && t >= 1) out.dx = side * 14;
  return out;
}

/** Travel (px) a fall wants along its dir (0 for falls in place). */
export function fallTravel(kind: FallKind): number {
  return FALL_SPECS[kind].travel;
}

/** Onomatopoeia of a KO or a hit: what source made it. */
export type WordKind = 'hands' | 'stick' | 'pancake' | 'glove' | 'flashball' | 'rock' | 'wtf';

export const WORDS: Readonly<Record<WordKind, readonly string[]>> = {
  hands: ['POW !', 'PAF !'],
  stick: ['BONK !', 'TCHAC !'],
  pancake: ['SPLOTCH !', 'SPLATCH !'],
  glove: ['BOING !', 'BOÏNG !'],
  flashball: ['PIOU !', 'PIOU PIOU !'],
  rock: ['TOC !', 'BLONK !'],
  wtf: ['WTF !?', 'OUPS !', 'WOUAAH !', 'NOOON !'],
};

/** Picks one word of `kind` with `r` in [0, 1). */
export function pickWord(kind: WordKind, r: number): string {
  const list = WORDS[kind];
  return list[Math.min(list.length - 1, Math.floor(Math.max(0, r) * list.length))]!;
}

/**
 * The word kind of a KO fall; null when the KO says nothing itself (a launched furie / beam body, a domino victim: the
 * « DOMINO ×N ! » pop speaks for it).
 */
export function koWordKind(fall: Fall, launched: boolean): WordKind | null {
  if (fall.wtf) return 'wtf';
  switch (fall.kind) {
    case 'knocked':
      return null;
    case 'pancake':
      return 'pancake';
    case 'bounce':
      return 'glove';
    case 'backflip':
      return 'flashball';
    case 'wobble':
      return 'rock';
    case 'flyspin':
      return launched ? null : 'stick';
    default:
      return 'hands';
  }
}

/** The word kind of a hit that did not KO; null for the beam (its own fx) and the gant (its punch says BOING). */
export function hitWordKind(source: 'melee' | 'rock' | 'beam' | 'gant' | 'flashball', held: HeldKind | null): WordKind | null {
  switch (source) {
    case 'melee':
      return held === null || held === 'gant' || held === 'flashball' ? 'hands' : 'stick';
    case 'rock':
      return 'rock';
    case 'flashball':
      return 'flashball';
    default:
      return null;
  }
}

/** « DOMINO ×N ! », N = the bodies that fell (the domino body and its victims). */
export function dominoWord(victims: number): string {
  return `DOMINO ×${victims + 1} !`;
}

export interface Shake {
  ms: number;
  px: number;
}

export const SHAKE_SMALL: Shake = { ms: 80, px: 1 };
export const SHAKE_MEDIUM: Shake = { ms: 110, px: 2 };
export const SHAKE_BIG: Shake = { ms: 240, px: 4 };

/** Shake of a hit: small for bare hands, medium for a weapon, a rock or a flashball; none for the beam / gant. */
export function hitShake(source: 'melee' | 'rock' | 'beam' | 'gant' | 'flashball', held: HeldKind | null, reduced: boolean): Shake | null {
  if (reduced) return null;
  if (source === 'melee') return held === null ? SHAKE_SMALL : SHAKE_MEDIUM;
  if (source === 'rock' || source === 'flashball') return SHAKE_MEDIUM;
  return null;
}

/** Shake of a KO: big for a WTF fall, a domino or the Caïd; none otherwise (the hit already shook). */
export function koShake(fall: Fall, boss: boolean, reduced: boolean): Shake | null {
  if (reduced) return null;
  return fall.wtf || boss ? SHAKE_BIG : null;
}

/** Freeze of a hit (ms): `base`, doubled on a WTF KO, halved under reduced motion. */
export function hitStopMs(base: number, wtf: boolean, reduced: boolean): number {
  const ms = wtf ? base * 2 : base;
  return reduced ? Math.round(ms / 2) : ms;
}
