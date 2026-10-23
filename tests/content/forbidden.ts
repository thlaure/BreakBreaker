/**
 * Shared content checks (AGENTS.md content rules), applied to the French and the English lines alike: no real person or
 * party named, no party initials, no religious word.
 */

/** Real people (politicians, heads of state, agitators) and parties: never a substring of a lower-cased line. */
export const FORBIDDEN_NAMES = [
  'macron',
  'sarkozy',
  'hollande',
  'chirac',
  'royal',
  'trump',
  'poutine',
  'putin',
  'khamenei',
  'lepen',
  'le pen',
  'mélenchon',
  'melenchon',
  'zemmour',
  'hassan',
  'bagayoko',
  'boyard',
  // American politicians and parties (the English lines)
  'biden',
  'obama',
  'clinton',
  'kamala',
  'reagan',
  'nixon',
  'kennedy',
  'pelosi',
  'sanders',
  'desantis',
  'democrat',
  'republican',
];

/** Party initials: whole words only (« rn » is inside many French words). */
export const FORBIDDEN_WORDS = ['lfi', 'rn', 'gop', 'maga', 'dnc', 'rnc', 'aoc'];

/** Religious words, French and English: never a substring (long ones) nor a whole word (all). */
export const RELIGIOUS = [
  'islam',
  'musulman',
  'muslim',
  'allah',
  'dieu',
  'coran',
  'koran',
  'quran',
  'croix',
  'église',
  'eglise',
  'church',
  'jésus',
  'jesus',
  'christ',
  'bible',
  'imam',
  'curé',
  'priest',
  'rabbin',
  'rabbi',
  'mosquée',
  'mosque',
];
/** Short religious words checked as whole words only (« god » is in no ordinary word here, but « cross » is in « crosswalk »). */
export const RELIGIOUS_WORDS = ['god', 'pray', 'cross', 'amen'];

const lower = (s: string): string => s.toLocaleLowerCase('fr');
export const words = (s: string): string[] => lower(s).split(/[^a-zàâäçéèêëîïôöùûüœæ0-9]+/u);

/** The first rule a line breaks (a short reason), or null when it is clean. */
export function contentViolation(line: string): string | null {
  const t = lower(line);
  for (const f of FORBIDDEN_NAMES) if (t.includes(f)) return `names ${f}`;
  for (const r of RELIGIOUS) if (t.includes(r)) return `religious word ${r}`;
  const w = words(line);
  for (const f of [...FORBIDDEN_WORDS, ...RELIGIOUS_WORDS]) if (w.includes(f)) return `word ${f}`;
  return null;
}
