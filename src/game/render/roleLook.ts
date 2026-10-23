import type { Role, Variant } from '../../sim/types';
import { caidSheetKey, caidSkinOf } from './caidSkin';

/**
 * How a rioter's role reads on screen (pure, no Phaser): runners wear the light hooded LPC sheets (`rioter_runner_a/b`,
 * the variant still shows through the flag prop), brutes keep their variant's sheet, drawn bigger with a helmet badge
 * and an HP bar once damaged; the Caïd wears one of the five leader looks (`caid_<caidSkinOf(lifeId)>`, whatever his
 * variant, no flag), drawn ×1.5 with a crown and his HP bar always.
 */
export function rioterSheet(variant: Variant, role: Role, lifeId: number): string {
  if (role === 'boss') return caidSheetKey(caidSkinOf(lifeId));
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

/** HP a segment of the Caïd's HP bar stands for, and the most segments it shows. */
export const HP_PER_SEGMENT = 2;
export const MAX_SEGMENTS = 13;

/** Segments of the Caïd's HP bar for `maxHp`: one per HP_PER_SEGMENT HP, 1..MAX_SEGMENTS. */
export function hpSegments(maxHp: number): number {
  return Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(maxHp / HP_PER_SEGMENT)));
}

/** Filled pixels of each segment (`segW` px wide) of the Caïd's HP bar, left to right; at least 1 px while hp > 0. */
export function hpSegmentFills(hp: number, maxHp: number, segW: number): number[] {
  const n = hpSegments(maxHp);
  const per = Math.max(HP_PER_SEGMENT, maxHp / n);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = Math.max(0, Math.min(1, (hp - i * per) / per));
    out.push(f <= 0 ? 0 : Math.max(1, Math.round(f * segW)));
  }
  return out;
}

/** Runner dust puffs: one every DUST_MS of running (render only). */
export const DUST_MS = 90;
