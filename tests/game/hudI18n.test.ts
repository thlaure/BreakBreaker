// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  CONTROLS,
  INTRO_GOAL,
  RULES,
  SATIRE_NOTICE,
  controlsFor,
  introActionsFor,
  introGoalFor,
  rulesFor,
  satireNoticeFor,
} from '../../src/content/controls';
import { setLocale } from '../../src/content/i18n';
import { AlertBanner, GUIDE_LOOK, ROUND_HEADLINES, casseurs, incidentAlert } from '../../src/game/hud/alerts';
import { TARGET_NAMES, energyRefusedHint, formatSummary, hpLabel, roundPanel, waveLine, weaponValue } from '../../src/game/hud/format';
import { Hud } from '../../src/game/hud/hud';
import { Menus, type MenuActions } from '../../src/game/hud/menus';
import { Sim, type Snapshot } from '../../src/sim/sim';

const actions = (): MenuActions => ({
  start: vi.fn(),
  resume: vi.fn(),
  toggleSound: vi.fn(() => false),
  stopGame: vi.fn(),
  leave: vi.fn(),
  replay: vi.fn(),
  click: vi.fn(),
});

const snap = (patch: (s: Snapshot) => void = () => {}): Snapshot => {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
};

const labels = (hud: Hud): string[] => [...hud.root.querySelectorAll('.bb-stats .lbl')].map((e) => e.textContent ?? '');
const buttons = (menus: Menus): string[] => [...menus.root.querySelectorAll('button:not([data-lang])')].map((b) => b.textContent ?? '');

const huds: Hud[] = [];
const mkHud = (): Hud => {
  const h = new Hud(document.body, null);
  huds.push(h);
  return h;
};

beforeEach(() => {
  document.body.innerHTML = '';
  setLocale('fr');
});
afterEach(() => {
  for (const h of huds.splice(0)) h.destroy();
  setLocale('fr');
});

describe('HUD in English', () => {
  test('stat labels, the Controls button and the screen-reader health', () => {
    setLocale('en');
    const hud = mkHud();
    expect(labels(hud)).toEqual(['SCORE', 'NEUTRALIZED', 'ROUND', 'ROCKS', 'WEAPON', 'ENERGY', 'ITEMS']);
    expect(hud.root.querySelector('.bb-controls-btn')!.textContent).toBe('Controls');
    expect(hpLabel(85, 100)).toBe('Health 85 of 100');
  });

  test('the intro card « How to play »', () => {
    setLocale('en');
    const hud = mkHud();
    hud.showIntro(false);
    const card = hud.root.querySelector('.bb-intro')!;
    expect(card.getAttribute('aria-label')).toBe('How to play');
    expect(card.textContent).toContain('How to play');
    expect(card.textContent).toContain(introGoalFor('en'));
    expect(card.textContent).toContain('Press any key to start');
    for (const name of introActionsFor('en')) expect(card.textContent).toContain(name);
    expect(card.textContent).toContain('Move');
    hud.showIntro(true);
    expect(hud.root.querySelector('.bb-intro')!.textContent).toContain('Tap to start');
  });

  test('pause menu buttons and title', () => {
    setLocale('en');
    const menus = new Menus(document.body, actions(), false);
    menus.showPause();
    expect(menus.root.querySelector('h1')!.textContent).toBe('Paused');
    expect(buttons(menus)).toEqual(['Resume', 'Sound: on', 'Help', 'Credits', 'Back to the site', 'End the game']);
    expect(document.activeElement?.textContent).toBe('Resume');
    menus.destroy();
  });

  test('end screen', () => {
    setLocale('en');
    const menus = new Menus(document.body, actions(), false);
    const s = snap((x) => {
      x.score = 30;
      x.kos = 12;
      x.endCause = 'ko';
      x.stats.schoolsSaved = 1;
      x.stats.schoolsLost = 2;
    });
    menus.showSummary(formatSummary(s, 10));
    const text = menus.root.textContent ?? '';
    for (const w of ['Game summary', 'Knocked out', 'Neutralized rioters', 'Round reached', 'New record!', '1 saved · 2 lost'])
      expect(text).toContain(w);
    expect(buttons(menus)).toEqual(['Play again', 'Back to the site']);
    expect(
      formatSummary(
        snap((x) => (x.endCause = 'quit')),
        null,
      ).title,
    ).toBe('Game stopped by the player');
    menus.destroy();
  });

  test('alerts: incident, round start, headlines, guides', () => {
    setLocale('en');
    expect(incidentAlert('townHall', 3, 1)).toMatchObject({ title: 'TOWN HALL UNDER ATTACK!', meta: 'Round 3 · 1 rioter' });
    expect(incidentAlert('school', 2)).toMatchObject({ title: 'SCHOOL ON FIRE!', sub: 'Get to the school', meta: 'Round 2' });
    expect(incidentAlert('round', 3, 18, 'library')).toMatchObject({ title: 'ROUND 3!', sub: 'Library under threat · 18 rioters' });
    expect(ROUND_HEADLINES.townHall).toBe('Town Hall under threat');
    expect(TARGET_NAMES.townHall).toBe('Town Hall');
    expect(GUIDE_LOOK.ruin.label).toBe('REPAIR');
  });

  test('the banner element shows the English alert', () => {
    setLocale('en');
    const b = new AlertBanner(document.body);
    b.push({ id: 'r3', kind: 'round', pos: null, wave: 3, total: 9, headline: 'car' });
    expect(b.el.querySelector('.title')!.textContent).toBe('ROUND 3!');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Car under threat · 9 rioters');
    b.destroy();
  });

  test('plurals of rioters for 0, 1 and many in both languages', () => {
    expect([0, 1, 2, 15].map(casseurs)).toEqual(['0 casseur', '1 casseur', '2 casseurs', '15 casseurs']);
    setLocale('en');
    expect([0, 1, 2, 15].map(casseurs)).toEqual(['0 rioters', '1 rioter', '2 rioters', '15 rioters']);
  });

  test('round line, weapon, energy hint and the round panel', () => {
    setLocale('en');
    const s = snap((x) => {
      x.round = 3;
      x.roundKos = 4;
      x.roundTotal = 9;
    });
    expect(waveLine(s)).toBe('Round 3: 4/9 rioters');
    expect(weaponValue(s)).toBe('Bare hands');
    expect(energyRefusedHint()).toBe('Not enough energy');
    const p = roundPanel(
      snap((x) => {
        x.roundPhase = 'breather';
        x.breatherLeft = 4.2;
        x.lastSummary = { index: 2, kos: 7, objectives: [{ kind: 'townHall', result: 'won' }], points: 21, bonus: true };
      }),
    )!;
    expect(p).toMatchObject({ title: 'Round 2 complete', kos: 'Neutralized rioters: 7', heals: 'Health stations refilled' });
    expect(p.objectives[0]).toMatchObject({ name: 'Town Hall', result: 'success' });
    expect(p.countdown).toBe('Round 3 in 5…');
    expect(p.points).toBe('+21 points');
  });
});

describe('controls and notice', () => {
  test('French constants are the French catalog, English has the same rows', () => {
    expect(controlsFor('fr')).toEqual(CONTROLS);
    expect(rulesFor('fr')).toEqual(RULES);
    expect(satireNoticeFor('fr')).toBe(SATIRE_NOTICE);
    expect(introGoalFor('fr')).toBe(INTRO_GOAL);
    expect(controlsFor('en')).toHaveLength(CONTROLS.length);
    expect(rulesFor('en')).toHaveLength(RULES.length);
    expect(controlsFor('en')).toContainEqual({ action: 'Fury mode', keyboard: 'R (gauge full)', touch: 'Fury button' });
    for (const name of introActionsFor('en')) expect(controlsFor('en').some((c) => c.action === name)).toBe(true);
  });

  test('the English notice keeps the safety wording', () => {
    expect(satireNoticeFor('en')).toMatch(/satirical fiction/i);
  });

  test('English texts carry no French accents', () => {
    const all = [...controlsFor('en').flatMap((c) => [c.action, c.keyboard, c.touch]), ...rulesFor('en'), introGoalFor('en')];
    for (const s of all) expect(s, s).not.toMatch(/[àâçéèêëîïôûùüÿœ]/i);
  });
});

describe('switching locale re-renders open elements', () => {
  test('HUD labels, intro and pause menu follow setLocale without losing their state', () => {
    const hud = mkHud();
    const onDismiss = vi.fn();
    hud.showIntro(false, onDismiss);
    const act = actions();
    const menus = new Menus(document.body, act, true);
    menus.showPause();
    (menus.root.querySelectorAll('button')[2] as HTMLButtonElement).focus(); // Aide
    expect(labels(hud)[1]).toBe('NEUTRALISÉS');

    setLocale('en');
    expect(labels(hud)[1]).toBe('NEUTRALIZED');
    expect(hud.root.querySelector('.bb-controls-btn')!.textContent).toBe('Controls');
    expect(hud.root.querySelector('.bb-intro')!.textContent).toContain('How to play');
    expect(menus.open).toBe('pause');
    expect(buttons(menus)).toEqual(['Resume', 'Sound: off', 'Help', 'Credits', 'Back to the site', 'End the game']);
    expect(document.activeElement?.textContent).toBe('Help');

    setLocale('fr');
    expect(hud.root.querySelector('.bb-intro')!.textContent).toContain('Comment jouer');
    expect(buttons(menus)[0]).toBe('Reprendre');
    // the intro still waits for its key, once
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true, cancelable: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    menus.destroy();
  });

  test('the pause menu flag switches the language in place, focus kept on the flag', () => {
    const menus = new Menus(document.body, actions(), false);
    menus.showPause();
    const flag = menus.root.querySelector<HTMLButtonElement>('button[data-lang=en]')!;
    flag.focus();
    flag.click();
    expect(menus.open).toBe('pause');
    expect(buttons(menus)[0]).toBe('Resume');
    expect((document.activeElement as HTMLElement | null)?.dataset.lang).toBe('en');
    menus.destroy();
  });

  test('the summary is rebuilt in the new language', () => {
    const menus = new Menus(document.body, actions(), false);
    const s = snap((x) => (x.endCause = 'ko'));
    menus.showSummary(() => formatSummary(s, null));
    expect(menus.root.textContent).toContain('Casseurs neutralisés');
    setLocale('en');
    expect(menus.open).toBe('summary');
    expect(menus.root.textContent).toContain('Neutralized rioters');
    menus.destroy();
  });

  test('the alert on screen is repainted; a destroyed HUD or menu no longer listens', () => {
    const b = new AlertBanner(document.body);
    b.push({ id: 'r1', kind: 'round', pos: null, wave: 1, total: 2, headline: 'school' });
    expect(b.el.querySelector('.title')!.textContent).toBe('MANCHE 1 !');
    setLocale('en');
    expect(b.el.querySelector('.title')!.textContent).toBe('ROUND 1!');
    b.destroy();
    const hud = mkHud();
    const menus = new Menus(document.body, actions(), false);
    menus.showPause();
    hud.destroy();
    menus.destroy();
    expect(() => setLocale('fr')).not.toThrow();
    expect(document.querySelector('.bb-hud')).toBeNull();
  });
});
