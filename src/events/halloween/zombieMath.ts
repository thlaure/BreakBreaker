import type { Role } from '../../sim/types';

/**
 * The rioter sheets that have a zombie twin (same layout, built by `npm run assets` from the LPC zombie body and head,
 * public/assets/events/halloween/): each zombie is a character of its own (green skin, glowing yellow eyes, torn hoodies,
 * flashy hair or a hood), not a repaint.
 */
export const ZOMBIE_BASES: readonly string[] = [
  'rioter_classic_a',
  'rioter_classic_b',
  'rioter_palestinian_a',
  'rioter_palestinian_b',
  'rioter_antifa_a',
  'rioter_antifa_b',
  'rioter_runner_a',
  'rioter_runner_b',
];

/** The two hooded spellcaster zombies (robes, spellcast animation on the attack rows): the rock throwers' zombie form. */
export const CASTER_SHEETS: readonly string[] = ['zombie_caster_a', 'zombie_caster_b'];

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

/** The texture key of the zombie twin of `base`. */
export function zombieSheetKey(base: string): string {
  return `zombie_${base}`;
}

/** Every extra sheet the event needs, to load at boot (only while the event is on). */
export function zombieSheetKeys(): string[] {
  return [...ZOMBIE_BASES.map(zombieSheetKey), ...CASTER_SHEETS];
}

/**
 * The sheet a rioter wears under the Halloween event: a zombie twin when he is a zombie (a hooded spellcaster when he
 * throws rocks), else `sheet` unchanged.
 */
export function zombieSheetFor(sheet: string, role: Role, lifeId: number): string {
  if (!isZombie(role, lifeId) || !ZOMBIE_BASES.includes(sheet)) return sheet;
  if (role === 'thrower') return CASTER_SHEETS[Math.abs(lifeId) % CASTER_SHEETS.length]!;
  return zombieSheetKey(sheet);
}
