import { getLocale, type Locale } from './i18n/locale';

/**
 * What the fictional President shouts from the château balcony, one list per language (in-game text): short, widely
 * known public phrases and invented pompous, tearful or furious lines. Never a real name (person or party), never an
 * attribution, nothing aimed at a group of people. Each line ≤ 60 characters (tests/content/quotes.test.ts). The
 * English list is adapted, not translated: other pompous and absurd lines for an American ear, quoting no one.
 */
export const QUOTES: readonly string[] = [
  'C’est de la poudre de perlimpinpin !',
  'Abracadabrantesque !',
  'Moi, président de la République…',
  'On est en guerre !',
  'Les ennuis, ça vole toujours en escadrille.',
  'Je vous ai compris !',
  'L’État, c’est moi !',
  'Après moi, le déluge !',
  'Qu’ils mangent de la brioche !',
  'Le changement, c’est maintenant !',
  'Mes chers compatriotes…',
  'Vive la République ! Et vive moi !',
  'Je suis ému… tellement ému… snif !',
  'Qui a cassé ma jolie fontaine ?!',
  'Je convoque une commission, tout de suite !',
  'Rendez-moi mon balcon !',
  'Pas de panique, j’ai un plan… je crois.',
  'J’en appelle au calme… et au goûter !',
  'Le cap est fixé ! Enfin, à peu près.',
  'Je prends mes responsabilités… un peu.',
  'Ce n’est pas une crise, c’est une opportunité !',
  'Mon mouchoir ! Où est mon mouchoir ?',
  'J’ai fait une promesse, je la tiendrai… un jour.',
  'Il faut savoir terminer une grève !',
  'Nous allons réformer la réforme !',
  'Je ne lâcherai rien ! Sauf mon micro.',
];

export const QUOTES_EN: readonly string[] = [
  'This is pure snake oil and moonbeams!',
  'Preposterous! Pre-pos-ter-ous!',
  'As President of this great nation…',
  'We are at war! With the pigeons, mostly.',
  'Trouble always flies in V formation.',
  'I hear you! I just don’t listen.',
  'I am the government! The whole thing!',
  'After me? More of me!',
  'Free corn dogs for everyone! Next year.',
  'Change is coming! Any minute now!',
  'My fellow citizens… and their dogs…',
  'Long live the Republic! And long live me!',
  'I am so moved… so very moved… sniff!',
  'Who broke my beautiful fountain?!',
  'I am forming a task force. Right now!',
  'Give me back my balcony!',
  'Nobody panic, I have a plan… I think.',
  'I call for calm… and for snacks!',
  'We have a clear course! Roughly. Ish.',
  'I take full responsibility… partially.',
  'This is not a crisis, it is an opportunity!',
  'My hanky! Where is my hanky?',
  'I made a promise and I will keep it… someday.',
  'I hereby veto this riot!',
  'We will reform the reform of the reform!',
  'I will never back down! Except from the mic.',
];

export const QUOTES_BY_LOCALE: Readonly<Record<Locale, readonly string[]>> = { fr: QUOTES, en: QUOTES_EN };

/** The President's lines in `l` (the current language by default). */
export function quotesFor(l: Locale = getLocale()): readonly string[] {
  return QUOTES_BY_LOCALE[l];
}
