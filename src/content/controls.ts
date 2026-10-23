import { catalog, getLocale, translate, type Key, type Locale } from './i18n';

/**
 * Rules and controls shown on the start screen and in the pause help, in both languages (catalog `hud.control.*`,
 * `hud.rule.*`). The `…For(locale)` functions read a given language (the current one by default); the constants are
 * the French texts, kept for the landing page build and the French tests.
 */

export interface ControlRow {
  action: string;
  keyboard: string;
  touch: string;
}

const CONTROL_IDS = ['move', 'strike', 'throw', 'run', 'onde', 'furie', 'repair', 'pause'] as const;
type ControlId = (typeof CONTROL_IDS)[number];
/** Keys written the same in every language (no catalog entry). */
const SAME_KEYS: Readonly<Partial<Record<ControlId, string>>> = { repair: 'F' };
/** The actions listed on the card shown when the game launches. */
const INTRO_IDS: readonly ControlId[] = ['move', 'strike', 'throw', 'run'];
const RULE_KEYS = ['hud.rule.1', 'hud.rule.2', 'hud.rule.3', 'hud.rule.4', 'hud.rule.5', 'hud.rule.6', 'hud.rule.7'] as const;

function text(l: Locale, key: Key): string {
  return translate(catalog(l), l, key);
}

export function controlsFor(l: Locale = getLocale()): readonly ControlRow[] {
  return CONTROL_IDS.map((id) => ({
    action: text(l, `hud.control.${id}.action`),
    keyboard: SAME_KEYS[id] ?? text(l, `hud.control.${id as Exclude<ControlId, 'repair'>}.keyboard`),
    touch: text(l, `hud.control.${id}.touch`),
  }));
}

export function rulesFor(l: Locale = getLocale()): readonly string[] {
  return RULE_KEYS.map((k) => text(l, k));
}

export function satireNoticeFor(l: Locale = getLocale()): string {
  return text(l, 'hud.notice');
}

/** One-line goal on the card shown when the game launches. */
export function introGoalFor(l: Locale = getLocale()): string {
  return text(l, 'hud.introGoal');
}

/** Names (in `controlsFor(l)`) of the actions listed on the launch card. */
export function introActionsFor(l: Locale = getLocale()): readonly string[] {
  return INTRO_IDS.map((id) => text(l, `hud.control.${id}.action`));
}

export const RULES: readonly string[] = rulesFor('fr');
export const SATIRE_NOTICE = satireNoticeFor('fr');
export const CONTROLS: readonly ControlRow[] = controlsFor('fr');
export const INTRO_GOAL = introGoalFor('fr');
export const INTRO_ACTIONS: readonly string[] = introActionsFor('fr');
