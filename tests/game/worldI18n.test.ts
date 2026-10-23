import { afterEach, describe, expect, test } from 'vitest';
import { catalog, setLocale, t, type Locale } from '../../src/content/i18n';
import { ACTION_WORDS, firstRuinHelp, repairingVerb } from '../../src/game/render/actionHintMath';
import { dominoWord } from '../../src/game/render/fallMath';
import { localeBound } from '../../src/game/render/localeText';
import { jailedText, releasedText } from '../../src/game/render/prisonMath';
import { calledText, refusalText } from '../../src/game/render/serviceMath';

afterEach(() => setLocale('fr'));

/** Roof sign plates: the most characters (monospace 10 px, ~6 px each) that fit beside the plate's icon. */
const SIGN_MAX: Record<string, number> = {
  'world.sign.school': 10,
  'world.sign.shop': 13,
  'world.sign.nursery': 15,
  'world.sign.townHall': 12,
  'world.sign.library': 14,
  'world.sign.church': 10,
  'world.sign.prison': 12,
};

describe('place names on the buildings', () => {
  test('every sign has its American name and fits its plate in both languages', () => {
    for (const l of ['fr', 'en'] as Locale[])
      for (const [k, max] of Object.entries(SIGN_MAX)) expect([...catalog(l)[k]!].length, `${l} ${k}`).toBeLessThanOrEqual(max);
    expect(['school', 'shop', 'nursery', 'townHall', 'library', 'church', 'prison'].map((k) => catalog('en')[`world.sign.${k}`])).toEqual([
      'SCHOOL',
      'MICRO RETRO',
      'NURSERY SCHOOL',
      'TOWN HALL',
      'LIBRARY',
      'CHURCH',
      'JAIL',
    ]);
  });

  test('the sauna board fits (8 px monospace, 5 px a character, 124 px board)', () => {
    expect(catalog('fr')['world.sign.saunaBoard']).toBe('Sauna – Ne pas déranger');
    expect(catalog('en')['world.sign.saunaBoard']).toBe('Sauna – Do not disturb');
    for (const l of ['fr', 'en'] as Locale[]) expect(catalog(l)['world.sign.saunaBoard']!.length * 5).toBeLessThanOrEqual(124);
  });
});

describe('world texts follow the locale', () => {
  test('action hints, the repair verb and the first-ruin help', () => {
    setLocale('en');
    expect(ACTION_WORDS.repair.verb).toBe('Repair');
    expect(ACTION_WORDS.callFire.button).toBe('Call');
    expect(ACTION_WORDS.needToolbox.button).toBeNull();
    expect(repairingVerb()).toBe('Repairing…');
    expect(firstRuinHelp(false)).toContain('press F');
    setLocale('fr');
    expect(ACTION_WORDS.repair.verb).toBe('Réparer');
    expect(repairingVerb()).toBe('Réparation…');
  });

  test('booth lines, prison counters and the domino pop', () => {
    setLocale('en');
    expect(refusalText('noCalls')).toBe('No calls left');
    expect(calledText('police')).toBe('Police on the way!');
    expect(jailedText(3)).toBe('Ringleaders jailed: 3');
    expect([1, 2].map(releasedText)).toEqual(['1 ringleader released', '2 ringleaders released']);
    expect(dominoWord(2)).toBe('DOMINO ×3!');
    setLocale('fr');
    expect(calledText('fire')).toBe('Pompiers en route !');
    expect([1, 2].map(releasedText)).toEqual(['1 Caïd libéré', '2 Caïds libérés']);
  });
});

describe('localeBound: a text object redrawn on a language switch', () => {
  function fakeText(): {
    text: string;
    active: boolean;
    setText(s: string): unknown;
    once(e: string, fn: () => void): unknown;
    destroy(): void;
  } {
    let onDestroy: (() => void) | null = null;
    return {
      text: '',
      active: true,
      setText(s: string) {
        this.text = s;
        return this;
      },
      once(e: string, fn: () => void) {
        if (e === 'destroy') onDestroy = fn;
        return this;
      },
      destroy() {
        this.active = false;
        onDestroy?.();
      },
    };
  }

  test('sets the text now and again on every setLocale; stops once destroyed', () => {
    const o = fakeText();
    localeBound(o, () => t('world.sign.townHall'));
    expect(o.text).toBe('MAIRIE');
    setLocale('en');
    expect(o.text).toBe('TOWN HALL');
    o.destroy();
    setLocale('fr');
    expect(o.text).toBe('TOWN HALL');
  });
});
