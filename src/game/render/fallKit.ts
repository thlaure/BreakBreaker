import Phaser from 'phaser';
import type { Fall, Launch, Vec } from '../../sim/types';
import { FEET_ORIGIN_Y } from './charView';
import type { FallPose } from './fallMath';
import type { Twinkles } from './satellite';

/** A body knocked out in mode furie: where it was hit, its launch, how far it travels, when it took off. */
export interface Flight {
  from: Vec;
  launch: Launch;
  dist: number;
  start: number;
  landed: boolean;
  /** The gant's « BOING ! » when the body lands (bounce fall). */
  boing: boolean;
}

/** A body falling per its ActorKnockedOut.fall (not launched): where, how far it travels, when, its fx flags. */
export interface Falling {
  fall: Fall;
  from: Vec;
  dist: number;
  start: number;
  impacted: boolean;
  /** Last dust-trail puff (faceplant). */
  lastTrail: number;
  /** The pooled trash can (trashcan fall), or null. */
  can: Phaser.GameObjects.Image | null;
}

/** At most this many bodies play a fall at once; the next ones just lie down (still KO frame). */
export const MAX_FALLS = 8;
/** Trash cans in the pool (a trashcan fall over the pool falls without a can: plain crumple look). */
export const CAN_POOL = 3;
export const CAN_SCALE = 2;
/** Trash can: 12×14 pixel rows (lid, ribbed body). */
export const CAN_ROWS = [
  '...KKKKKK...',
  '.KKLLLLLLKK.',
  'KLLWLLLLLLLK',
  'KKKKKKKKKKKK',
  '.KGWGgGGgGK.',
  '.KGWGgGGgGK.',
  '.KGWGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KGGGgGGgGK.',
  '.KgGGgGGggK.',
  '.KggggggggK.',
  '..KKKKKKKK..',
];
const CAN_PAL: Record<string, number> = { K: 0x14121c, L: 0xa9b3bd, W: 0xe6edf2, G: 0x7c8894, g: 0x5a6570 };
/** Trash can: frame row where the legs start (hips) in an LPC frame; only rows below it show, upside down. */
export const LEGS_ROW = 44;
export const LEGS_ORIGIN_Y = LEGS_ROW / 64;
/** How deep (px) the legs sink under the can rim. */
export const LEGS_TUCK = 3;
export const TRAIL_MS = 40;

/** Sprite origin (y) while airborne: the body spins around its middle, not its feet. */
export const SPIN_ORIGIN_Y = 0.6;
export const SPIN_LIFT = Math.round((FEET_ORIGIN_Y - SPIN_ORIGIN_Y) * 64);

/**
 * What a HostileView needs for a launched body: the shared trail emitter, the landing check (tumble), the twinkle pool
 * and the camera view (satellite), the satellites in flight (capped) and reduced motion.
 */
export interface LaunchCtx {
  trail: Phaser.GameObjects.Particles.ParticleEmitter;
  world: { width: number; height: number };
  blocked: (p: Vec) => boolean;
  twinkles: Twinkles;
  view: () => Phaser.Geom.Rectangle;
  zoom: () => number;
  satellites: { flying: number };
  reducedMotion: boolean;
  /** Bodies playing a fall right now (capped at MAX_FALLS). */
  falls: { active: number };
  /** Free trash cans (pool). */
  cans: Phaser.GameObjects.Image[];
  /** An onomatopoeia bubble (`big` for the WTF words). */
  pow: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void;
  /** Shared pose scratch (no per-frame allocation). */
  pose: FallPose;
  /** Runner dust puffs at the feet (shared emitter). */
  dust: Phaser.GameObjects.Particles.ParticleEmitter;
}

/** `trash_can` texture (pixel rows drawn at runtime, no image file). */
export function makeFallTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('trash_can')) return;
  const g = scene.make.graphics({}, false);
  CAN_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = CAN_PAL[row[x]!];
      if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
    }
  });
  g.generateTexture('trash_can', CAN_ROWS[0]!.length, CAN_ROWS.length);
  g.destroy();
}
