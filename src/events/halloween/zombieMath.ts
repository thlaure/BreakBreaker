import type { Role } from '../../sim/types';

/** A hat a zombie wears over his hair (cartoon style: a road cone or a bucket), or none. */
export type ZombieHat = 'none' | 'cone' | 'bucket';

/** One zombie look: the rioter sheet it is painted from, its flashy hair colour (0xrrggbb) and its hat. */
export interface ZombieLook {
  base: string;
  hair: number;
  hat: ZombieHat;
}

/**
 * The eight zombie looks, one per rioter sheet (a / b by lifeId parity already varies them): grey-green skin and hair in
 * blue, pink, violet, turquoise or yellow, some with a road cone or a bucket on the head.
 */
export const ZOMBIE_LOOKS: readonly ZombieLook[] = [
  { base: 'rioter_classic_a', hair: 0x3fa7ff, hat: 'none' },
  { base: 'rioter_classic_b', hair: 0xff5fc8, hat: 'cone' },
  { base: 'rioter_palestinian_a', hair: 0xa65cff, hat: 'none' },
  { base: 'rioter_palestinian_b', hair: 0x3fe0c8, hat: 'bucket' },
  { base: 'rioter_antifa_a', hair: 0xffd23f, hat: 'none' },
  { base: 'rioter_antifa_b', hair: 0xff5fc8, hat: 'bucket' },
  { base: 'rioter_runner_a', hair: 0x3fa7ff, hat: 'cone' },
  { base: 'rioter_runner_b', hair: 0xa65cff, hat: 'none' },
];

/** Share of rioters (percent) who are zombies. */
const ZOMBIE_PERCENT = 50;

/** The Caïd never; the others by a pure integer hash of their lifeId (no Math.random, no sim rng). */
export function isZombie(role: Role, lifeId: number): boolean {
  if (role === 'boss') return false;
  let h = Math.imul((lifeId | 0) ^ 0x1b873593, 0xcc9e2d51);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) % 100 < ZOMBIE_PERCENT;
}

/** The texture key of the zombie painted from `base`. */
export function zombieSheetKey(base: string): string {
  return `zombie_${base}`;
}

/** The sheet a rioter wears under the Halloween event: the zombie one when he is a zombie, else `sheet` unchanged. */
export function zombieSheetFor(sheet: string, role: Role, lifeId: number): string {
  if (!isZombie(role, lifeId) || !ZOMBIE_LOOKS.some((l) => l.base === sheet)) return sheet;
  return zombieSheetKey(sheet);
}
