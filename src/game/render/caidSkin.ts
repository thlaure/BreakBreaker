import { caidLinesFor } from '../../content/caids';
import type { Locale } from '../../content/i18n/locale';

/** One of the five Caïd looks (index in CAID_SKINS). */
export type CaidSkin = 0 | 1 | 2 | 3 | 4;
export const CAID_SKIN_COUNT = 5;

/**
 * The look of the Caïd with entity id `id` (his lifeId): a pure integer hash, no Math.random, no sim rng, so the same
 * Caïd keeps his look on the street, in the jail van and in the prison yard (the inmate keeps his lifeId).
 */
export function caidSkinOf(id: number): CaidSkin {
  let h = Math.imul((id | 0) ^ 0x2545f491, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % CAID_SKIN_COUNT) as CaidSkin;
}

/** The character sheet of a look, built at boot (render/caidSheets.ts) with the LPC layout. */
export function caidSheetKey(skin: CaidSkin): string {
  return `caid_${skin}`;
}

/** Between two slogans of a standing Caïd (render-side rng `r` in [0, 1)). */
export const CAID_BUBBLE_MIN_MS = 10_000;
export const CAID_BUBBLE_MAX_MS = 18_000;
/** How long a slogan stays up. */
export const CAID_BUBBLE_SHOW_MS = 2800;

export function caidBubbleGap(r: number): number {
  const k = Math.max(0, Math.min(1, r));
  return Math.round(CAID_BUBBLE_MIN_MS + k * (CAID_BUBBLE_MAX_MS - CAID_BUBBLE_MIN_MS));
}

/** A slogan of the look `skin` picked by `r` in [0, 1), in `l` (the current language by default). */
export function caidSlogan(skin: CaidSkin, r: number, l?: Locale): string {
  const lines = caidLinesFor(l)[skin]!.slogans;
  const i = Math.max(0, Math.min(lines.length - 1, Math.floor(r * lines.length)));
  return lines[i]!;
}
