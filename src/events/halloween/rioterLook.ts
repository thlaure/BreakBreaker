import type { Role } from '../../sim/types';
import { CAID_SKIN_COUNT, caidSheetKey, type CaidSkin } from '../../game/render/caidSkin';
import { ZOMBIE_BASES, isZombie } from './zombieMath';

/** A pure integer hash of a lifeId with a salt (no Math.random, no sim rng): each rule has its own, so they do not correlate. */
function hash(id: number, salt: number): number {
  let h = Math.imul((id | 0) ^ salt, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Percent of ordinary rioters, and of Caïds, who wear a pumpkin head (zombies never: their look is enough). */
const PUMPKIN_PERCENT = 25;
const CAID_PUMPKIN_PERCENT = 33;

/** Whether this rioter has a jack-o'-lantern for a head instead of his own (the Caïd keeps his body, scarf and crown). */
export function hasPumpkinHead(role: Role, lifeId: number): boolean {
  if (isZombie(role, lifeId)) return false;
  return hash(lifeId, 0x5bd1e995) % 100 < (role === 'boss' ? CAID_PUMPKIN_PERCENT : PUMPKIN_PERCENT);
}

/** The sheets that have a pumpkin-headed twin: the eight rioter sheets and the five Caïd looks. */
export const PUMPKIN_SOURCES: readonly string[] = [
  ...ZOMBIE_BASES,
  ...Array.from({ length: CAID_SKIN_COUNT }, (_, i) => caidSheetKey(i as CaidSkin)),
];

/** The texture key of the pumpkin-headed twin of `source`. */
export function pumpkinSheetKey(source: string): string {
  return `pumpkin_${source}`;
}

/** The face (0 smile, 1 grimace, 2 surprised) painted on the twin of `source`: it varies from sheet to sheet. */
export function pumpkinFaceOf(source: string): number {
  return Math.max(0, PUMPKIN_SOURCES.indexOf(source)) % 3;
}

/** The sheet of a rioter who has a pumpkin for a head (the twin of `sheet`), else `sheet` unchanged. */
export function pumpkinSheetFor(sheet: string, role: Role, lifeId: number): string {
  return hasPumpkinHead(role, lifeId) && PUMPKIN_SOURCES.includes(sheet) ? pumpkinSheetKey(sheet) : sheet;
}

/** The flag a rioter carries under the event. */
export type FlagKind = 'variant' | 'skull' | 'none';

/** Share (percent) of zombies who carry the black skull flag. */
const SKULL_FLAG_PERCENT = 33;

/**
 * The flag of a rioter while the event is on: zombies never carry their variant's flag; some carry a plain black flag with a
 * skull (a pirate flag, nothing else), the rest none; everyone else keeps his variant flag; the Caïd carries none.
 */
export function flagKind(role: Role, lifeId: number): FlagKind {
  if (role === 'boss') return 'none';
  if (!isZombie(role, lifeId)) return 'variant';
  return hash(lifeId, 0x165667b1) % 100 < SKULL_FLAG_PERCENT ? 'skull' : 'none';
}
