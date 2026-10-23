import { getLocale, type Locale } from './i18n/locale';

/**
 * The five Caïd looks (render only, no gameplay difference): INVENTED « leader / tribune » types of an agitation
 * movement, gently caricatured through their clothes, their prop and their pompous lines, never through their body.
 * None stands for a real person; no real name (person or party), no religious sign, no real flag. Each slogan ≤ 40
 * characters (tests/content/caids.test.ts). The look of a Caïd is caidSkinOf(lifeId) (src/game/render/caidSkin.ts).
 * Names and slogans exist in each language (CAID_LINES, same slogan count per look); the English ones are adapted,
 * mocking the same agitation rhetoric for an American ear.
 */
export type CaidProp = 'megaphone' | 'banner' | 'briefcase' | 'whistle' | 'posters';

export interface CaidLook {
  name: string;
  /** What he or she carries (drawn by render/caidProps.ts). */
  prop: CaidProp;
  /** Speech-bubble lines, shown now and then while he or she stands. */
  slogans: readonly string[];
}

export const CAID_SKINS: readonly CaidLook[] = [
  {
    name: 'Le tribun',
    prop: 'megaphone',
    slogans: [
      'Le Grand Soir, c’est ce soir !',
      'Camarades ! Je n’ai pas fini !',
      'Mobilisation générale… après la sieste !',
      'Plus fort ! Le mégaphone est éteint ?',
    ],
  },
  {
    name: 'La cheffe de cortège',
    prop: 'banner',
    slogans: [
      'Derrière la banderole !',
      'On ne double pas la cheffe !',
      'Le cortège, c’est par ici ! Ou par là.',
      'Serrez les rangs ! Pas trop, j’étouffe.',
    ],
  },
  {
    name: 'Le camarade en costume',
    prop: 'briefcase',
    slogans: [
      'Je vais en référer au comité !',
      'Motion adoptée à l’unanimité de moi !',
      'Point 47 de l’ordre du jour : l’émeute',
      'Je convoque une sous-commission !',
    ],
  },
  {
    name: 'Le vieux briscard',
    prop: 'whistle',
    slogans: [
      'Moi, en 68…',
      'De mon temps, les pavés pesaient plus !',
      'J’ai fait toutes les manifs. Toutes !',
      'Les jeunes, ça ne sait plus siffler !',
    ],
  },
  {
    name: 'Le jeune agitateur',
    prop: 'posters',
    slogans: [
      'Tout est à nous !',
      'J’ai collé 300 affiches. Et ma main.',
      'C’est pas une émeute, c’est un live !',
      'Révolution à 18 h, j’ai cours à 20 h !',
    ],
  },
];

/** What a look says, in one language. */
export type CaidLines = Pick<CaidLook, 'name' | 'slogans'>;

const CAID_LINES_EN: readonly CaidLines[] = [
  {
    name: 'The Orator',
    slogans: [
      'The revolution starts tonight! Ish.',
      'Comrades! I’m not done talking!',
      'General strike… right after my nap!',
      'LOUDER! Is this megaphone even on?',
    ],
  },
  {
    name: 'The March Captain',
    slogans: [
      'Everybody behind the banner!',
      'Nobody passes the captain!',
      'The march goes this way! Or that way.',
      'Close ranks! Not so close, I’m choking!',
    ],
  },
  {
    name: 'The Comrade in a Suit',
    slogans: [
      'I shall refer this to the committee!',
      'Motion passed, unanimously, by me!',
      'Item 47 on the agenda: the riot',
      'I move to form a subcommittee!',
    ],
  },
  {
    name: 'The Old-Timer',
    slogans: [
      'Back in ’68…',
      'In my day, bricks were heavier!',
      'I’ve been to every march. EVERY one!',
      'Kids these days can’t even whistle!',
    ],
  },
  {
    name: 'The Young Firebrand',
    slogans: [
      'It all belongs to us!',
      'I put up 300 posters. And my hand.',
      'It’s not a riot, it’s a livestream!',
      'Revolution at 6, I have class at 8!',
    ],
  },
];

/** Names and slogans of the five looks, by language (French = CAID_SKINS, unchanged). */
export const CAID_LINES: Readonly<Record<Locale, readonly CaidLines[]>> = { fr: CAID_SKINS, en: CAID_LINES_EN };

/** The five looks' lines in `l` (the current language by default). */
export function caidLinesFor(l: Locale = getLocale()): readonly CaidLines[] {
  return CAID_LINES[l];
}
