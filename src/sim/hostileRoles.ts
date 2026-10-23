import { CONFIG } from './config';
import type { Role } from './types';

/** Le Caïd's HP in `round` (CONFIG.caid: 14 at round 3, +2 every 2 rounds, at most 26). */
export function caidHp(round: number): number {
  const c = CONFIG.caid;
  return Math.min(c.hpMax, c.hp + Math.floor(Math.max(0, round - c.fromRound) / c.hpEvery) * c.hpStep);
}

/**
 * Starting HP of a rioter of `role`: runner, brute and Caïd have their own (CONFIG.runner / brute / caid; the Caïd's
 * grows with `round`, CONFIG.caid.fromRound when unknown).
 */
export function roleHp(role: Role, round: number | null = null): number {
  if (role === 'runner') return CONFIG.runner.hp;
  if (role === 'brute') return CONFIG.brute.hp;
  if (role === 'boss') return caidHp(round ?? CONFIG.caid.fromRound);
  if (role === 'shooter') return CONFIG.shooter.hp;
  return CONFIG.hostile.baseHp;
}

/** Speed factor of `role` over CONFIG.hostile.speed. */
export function roleSpeedMul(role: Role): number {
  if (role === 'runner') return CONFIG.runner.speedMul;
  if (role === 'brute') return CONFIG.brute.speedMul;
  if (role === 'boss') return CONFIG.caid.speedMul;
  return 1;
}

/** Px a landed blow of `role` pushes Paul (0 = none). */
export function roleKnockback(role: Role): number {
  return role === 'brute' ? CONFIG.brute.knockback : role === 'boss' ? CONFIG.caid.knockback : 0;
}

/** A brute or the Caïd: a held weapon's strike does CONFIG.toughWeaponDamage instead of a one-hit KO. */
export function isTough(role: Role): boolean {
  return role === 'brute' || role === 'boss';
}

/** What hurts a rioter: bare hands, a held weapon (swing, flashball shot, gant punch), a returned rock, a mode furie hit, the beam, the bubble. */
export type DamageSource = keyof typeof CONFIG.caid.damageFrom;

/** Enough to KO any rioter but the Caïd in one hit (weapons on ordinary rioters, mode furie, the beam). */
export const KO_DAMAGE = 99;

/**
 * Damage a rioter of `role` takes from `source`: the Caïd per CONFIG.caid.damageFrom; a brute 1 from bare hands,
 * CONFIG.toughWeaponDamage from a weapon, a returned rock's CONFIG.rock.returnDamage, KO from mode furie and the beam;
 * anyone else 1 from bare hands, a returned rock's damage, KO from the rest. Nobody is hurt by the bubble.
 */
export function damageOn(role: Role, source: DamageSource): number {
  if (role === 'boss') return CONFIG.caid.damageFrom[source];
  if (source === 'bubble') return 0;
  if (source === 'hands') return 1;
  if (source === 'rock') return CONFIG.rock.returnDamage;
  if (source === 'weapon' && role === 'brute') return CONFIG.toughWeaponDamage;
  if (source === 'furie') return CONFIG.furie.damage;
  return KO_DAMAGE;
}
