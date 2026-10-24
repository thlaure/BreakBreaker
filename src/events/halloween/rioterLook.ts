import type { Role } from '../../sim/types';
import { isZombie } from './zombieMath';

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

/** Whether this rioter has a jack-o'-lantern for a head (the Caïd keeps his body, scarf and crown). */
export function hasPumpkinHead(role: Role, lifeId: number): boolean {
  if (isZombie(role, lifeId)) return false;
  return hash(lifeId, 0x5bd1e995) % 100 < (role === 'boss' ? CAID_PUMPKIN_PERCENT : PUMPKIN_PERCENT);
}

/** The pumpkin's face: 0 smile, 1 grimace, 2 surprised. */
export function pumpkinFace(lifeId: number): 0 | 1 | 2 {
  return (hash(lifeId, 0x27d4eb2f) % 3) as 0 | 1 | 2;
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
