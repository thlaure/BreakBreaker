import { catalog, type Key } from './i18n';
import { getLocale, type Locale } from './i18n/locale';

/** How many lines the skeleton singer has (catalog keys `content.stage.lyric1` … `lyric6`, same in both languages). */
export const STAGE_LYRIC_COUNT = 6;

/** The catalog key of the singer's line `k` (0-based). */
export function stageLyricKey(k: number): Key {
  return `content.stage.lyric${k + 1}` as Key;
}

/**
 * The skeleton singer's lines in `l` (the current language by default), in order: short original lines about being fed
 * up, invented for the game (never taken from a song).
 */
export function stageLyricsFor(l: Locale = getLocale()): readonly string[] {
  const cat = catalog(l);
  return Array.from({ length: STAGE_LYRIC_COUNT }, (_, k) => cat[stageLyricKey(k)]!);
}
