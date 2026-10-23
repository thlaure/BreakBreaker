import { afterEach, describe, expect, test } from 'vitest';
import { CAID_LINES, CAID_SKINS, caidLinesFor } from '../../src/content/caids';
import { catalog, setLocale, type Locale } from '../../src/content/i18n';
import { QUOTES, QUOTES_BY_LOCALE, quotesFor } from '../../src/content/quotes';
import { stageLyricsFor } from '../../src/content/stage';
import { RESCUE_ITEMS } from '../../src/sim/incidents/rescue';
import { itemShout } from '../../src/game/render/belongings';
import { caidSlogan } from '../../src/game/render/caidSkin';
import { WORDS, WORDS_BY_LOCALE, pickWord } from '../../src/game/render/fallMath';
import { initPresident, pickQuote, stepPresident } from '../../src/game/render/presidentMath';
import { contentViolation } from './forbidden';

const LOCALES: readonly Locale[] = ['fr', 'en'];
const len = (s: string): number => [...s].length;
/** The catalog entries of `l` whose key starts with `prefix`, in key order. */
const entries = (l: Locale, prefix: string): string[] =>
  Object.keys(catalog(l))
    .filter((k) => k.startsWith(prefix))
    .sort()
    .map((k) => catalog(l)[k]!);

afterEach(() => setLocale('fr'));

describe('content lists exist in both languages, same counts', () => {
  test('President quotes: same count, 20–30, ≤ 60 characters, distinct', () => {
    expect(QUOTES_BY_LOCALE.en).toHaveLength(QUOTES_BY_LOCALE.fr.length);
    for (const l of LOCALES) {
      const list = quotesFor(l);
      expect(list.length).toBeGreaterThanOrEqual(20);
      expect(list.length).toBeLessThanOrEqual(30);
      for (const q of list) {
        expect(q.trim(), l).not.toBe('');
        expect(len(q), q).toBeLessThanOrEqual(60);
      }
      expect(new Set(list).size).toBe(list.length);
    }
  });

  test('Caïd looks: five per language, same slogan count per look, ≤ 40 characters', () => {
    for (const l of LOCALES) expect(caidLinesFor(l)).toHaveLength(5);
    CAID_LINES.fr.forEach((fr, i) => {
      const en = CAID_LINES.en[i]!;
      expect(en.slogans.length, `look ${i}`).toBe(fr.slogans.length);
      expect(en.name).not.toBe(fr.name);
      for (const line of [...fr.slogans, ...en.slogans]) {
        expect(line.trim()).not.toBe('');
        expect(len(line), line).toBeLessThanOrEqual(40);
      }
      expect(new Set(en.slogans).size).toBe(en.slogans.length);
    });
  });

  test('crowd grumbles: five per language, short shouts', () => {
    for (const l of LOCALES) {
      const list = entries(l, 'content.grumble.');
      expect(list).toHaveLength(5);
      for (const g of list) expect(len(g), g).toBeLessThanOrEqual(20);
    }
  });

  test('victim shouts: one per belonging in both languages, short', () => {
    for (const l of LOCALES) {
      setLocale(l);
      for (const list of Object.values(RESCUE_ITEMS))
        for (const it of list) {
          const s = itemShout(it.id);
          expect(s, `${l} ${it.id}`).toBeTruthy();
          expect(len(s ?? ''), s ?? '').toBeLessThanOrEqual(20);
        }
    }
  });

  test('stage lyrics: six per language, ≤ 30 characters, distinct, clean, English written for English', () => {
    for (const l of LOCALES) {
      const list = stageLyricsFor(l);
      expect(list, l).toHaveLength(6);
      for (const line of list) {
        expect(line.trim(), l).not.toBe('');
        expect(len(line), line).toBeLessThanOrEqual(30);
        expect(contentViolation(line), line).toBeNull();
      }
      expect(new Set(list).size).toBe(list.length);
    }
    const fr = new Set(stageLyricsFor('fr'));
    for (const line of stageLyricsFor('en')) expect(fr.has(line), line).toBe(false);
  });

  test('stage lyrics follow the current locale by default', () => {
    setLocale('en');
    expect(stageLyricsFor()).toEqual(stageLyricsFor('en'));
    setLocale('fr');
    expect(stageLyricsFor()).toEqual(stageLyricsFor('fr'));
  });

  test('onomatopoeias: same kinds and counts in both languages', () => {
    expect(Object.keys(WORDS_BY_LOCALE.en).sort()).toEqual(Object.keys(WORDS_BY_LOCALE.fr).sort());
    for (const [kind, fr] of Object.entries(WORDS_BY_LOCALE.fr)) {
      const en = WORDS_BY_LOCALE.en[kind as keyof typeof WORDS]!;
      expect(en.length, kind).toBe(fr.length);
      for (const w of [...fr, ...en]) expect(len(w), w).toBeLessThanOrEqual(12);
    }
  });
});

describe('content rules in both languages', () => {
  const lines = (l: Locale): string[] => [
    ...quotesFor(l),
    ...caidLinesFor(l).flatMap((c) => [c.name, ...c.slogans]),
    ...entries(l, 'content.'),
  ];

  for (const l of LOCALES) {
    test(`${l}: no real name, no party, no religious word`, () => {
      for (const line of lines(l)) expect(contentViolation(line), line).toBeNull();
    });
  }

  test('the English lines are written for English, not copied from the French', () => {
    const fr = new Set(lines('fr'));
    for (const line of lines('en')) expect(fr.has(line), line).toBe(false);
  });
});

describe('the French lists are unchanged', () => {
  test('President quotes', () => {
    expect(quotesFor('fr')).toBe(QUOTES);
    expect(QUOTES).toHaveLength(26);
    expect(QUOTES[0]).toBe('C’est de la poudre de perlimpinpin !');
    expect(QUOTES[13]).toBe('Qui a cassé ma jolie fontaine ?!');
    expect(QUOTES[25]).toBe('Je ne lâcherai rien ! Sauf mon micro.');
  });

  test('Caïd names and slogans', () => {
    expect(CAID_SKINS.map((s) => s.name)).toEqual([
      'Le tribun',
      'La cheffe de cortège',
      'Le camarade en costume',
      'Le vieux briscard',
      'Le jeune agitateur',
    ]);
    expect(CAID_SKINS.map((s) => s.prop)).toEqual(['megaphone', 'banner', 'briefcase', 'whistle', 'posters']);
    expect(CAID_SKINS[0]!.slogans).toEqual([
      'Le Grand Soir, c’est ce soir !',
      'Camarades ! Je n’ai pas fini !',
      'Mobilisation générale… après la sieste !',
      'Plus fort ! Le mégaphone est éteint ?',
    ]);
    expect(CAID_SKINS[4]!.slogans[3]).toBe('Révolution à 18 h, j’ai cours à 20 h !');
    CAID_SKINS.forEach((s, i) => expect(caidLinesFor('fr')[i]!.slogans).toEqual(s.slogans));
  });

  test('crowd grumbles, cries and shouts', () => {
    expect(entries('fr', 'content.grumble.')).toEqual([
      'ÇA SUFFIT !',
      'ON EN A MARRE !',
      'ARRÊTEZ ÇA !',
      'STOP À LA CASSE !',
      'C’EST HONTEUX !',
    ]);
    expect(catalog('fr')['content.bubble.help']).toBe('À L’AIDE !');
    expect(catalog('fr')['content.bubble.thanks']).toBe('MERCI !');
    expect(entries('fr', 'content.shout.').sort()).toEqual(
      ['MON SAC !', 'MON CHAPEAU !', 'MA CANNE !', 'MON SAC À DOS !', 'MON ÉCHARPE !', 'MA CASQUETTE !'].sort(),
    );
  });

  test('onomatopoeias', () => {
    expect(WORDS_BY_LOCALE.fr).toBe(WORDS);
    expect(WORDS.hands).toEqual(['POW !', 'PAF !']);
    expect(WORDS.wtf).toEqual(['WTF !?', 'OUPS !', 'WOUAAH !', 'NOOON !']);
  });
});

describe('the helpers follow the current locale', () => {
  test('quotes, slogans, words and shouts read the locale at call time', () => {
    setLocale('en');
    expect(QUOTES_BY_LOCALE.en).toContain(pickQuote(() => 0.5, null));
    expect(CAID_LINES.en[2]!.slogans).toContain(caidSlogan(2, 0.4));
    expect(WORDS_BY_LOCALE.en.hands).toContain(pickWord('hands', 0));
    expect(itemShout('handbag')).toBe(catalog('en')['content.shout.handbag']);
    setLocale('fr');
    expect(QUOTES).toContain(pickQuote(() => 0.5, null));
    expect(CAID_SKINS[2]!.slogans).toContain(caidSlogan(2, 0.4));
    expect(pickWord('hands', 0)).toBe('POW !');
    expect(itemShout('handbag')).toBe('MON SAC !');
  });

  test('an unknown belonging id has no shout', () => {
    expect(itemShout('nope')).toBeNull();
  });
});

describe('the President after a language switch', () => {
  test('a French quote on show is hidden at the next step once English is chosen', () => {
    const s = initPresident(() => 0.1, 0);
    stepPresident(s, () => 0.1, 2000, false);
    expect(QUOTES).toContain(s.quote);
    setLocale('en');
    stepPresident(s, () => 0.1, 2100, false);
    expect(s.quote).toBeNull();
  });
});
