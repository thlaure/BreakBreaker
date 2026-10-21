import type { Role, Variant } from '../../sim/types';

/**
 * How a rioter's role reads on screen (pure, no Phaser): runners wear the light hooded LPC sheets (`rioter_runner_a/b`,
 * the variant still shows through the flag prop), brutes and the Caïd keep their variant's sheet, drawn bigger with a
 * helmet / a crown badge and an HP bar (the Caïd always, a brute once damaged).
 */
export function rioterSheet(variant: Variant, role: Role, lifeId: number): string {
  const ab = lifeId % 2 === 0 ? 'a' : 'b';
  return role === 'runner' ? `rioter_runner_${ab}` : `rioter_${variant}_${ab}`;
}

/** Sprite scale of a role: brute ×1.25, Caïd ×1.5, everyone else ×1. */
export function roleScale(role: Role): number {
  return role === 'brute' ? 1.25 : role === 'boss' ? 1.5 : 1;
}

/** Badge texture drawn on a role's head (null: none). */
export function badgeOf(role: Role): 'badge_helmet' | 'badge_crown' | null {
  return role === 'brute' ? 'badge_helmet' : role === 'boss' ? 'badge_crown' : null;
}

/** HP bar over a rioter: the Caïd always while standing, a brute once damaged; never on a KO body. */
export function hpBarShown(h: { role: Role; hp: number; maxHp: number; state: string }): boolean {
  if (h.state === 'ko') return false;
  return h.role === 'boss' || (h.role === 'brute' && h.hp < h.maxHp);
}

/** Filled inner pixels of a rioter HP bar `inner` px wide (at least 1 while hp > 0). */
export function hpFill(hp: number, maxHp: number, inner: number): number {
  if (hp <= 0 || maxHp <= 0) return 0;
  return Math.max(1, Math.min(inner, Math.round((inner * hp) / maxHp)));
}

/** Runner dust puffs: one every DUST_MS of running (render only). */
export const DUST_MS = 90;
