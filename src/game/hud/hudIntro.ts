import { controlsFor, introActionsFor, introGoalFor } from '../../content/controls';
import { t } from '../../content/i18n';
import { el } from './hudDom';

/** Writes the « Comment jouer » card's texts in the current locale (called again when the language changes). */
function fillIntro(card: HTMLElement, touch: boolean): void {
  card.setAttribute('aria-label', t('hud.intro.title'));
  const controls = controlsFor();
  const list = el('dl', 'keys');
  for (const name of introActionsFor()) {
    const row = controls.find((c) => c.action === name);
    if (!row) continue;
    list.append(el('dt', '', name), el('dd', '', touch ? row.touch : row.keyboard));
  }
  const go = el('p', 'go', t(touch ? 'hud.intro.go.touch' : 'hud.intro.go.keys'));
  card.replaceChildren(el('b', 'title', t('hud.intro.title')), el('p', 'goal', introGoalFor()), list, go);
}

/**
 * Builds the « Comment jouer » veil and arms its dismiss listeners (capture on window). The first real key or tap calls
 * `close` then `onDismiss`; `cleanup` removes the listeners; `refresh` rewrites the texts (language change).
 */
export function openIntro(
  touch: boolean,
  onDismiss: () => void,
  close: () => void,
): { veil: HTMLElement; cleanup: () => void; refresh: () => void } {
  const card = el('div', 'bb-intro');
  card.setAttribute('role', 'dialog');
  fillIntro(card, touch);
  const veil = el('div', 'bb-intro-veil');
  veil.append(card);
  let done = false;
  const dismiss = (e: Event): void => {
    if (done) return;
    // a lone modifier (Maj, Ctrl…) is not "a key": wait for a real one
    if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
    done = true;
    // the key that starts the game must not also act in it
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
    onDismiss();
  };
  // capture on window: the key or tap never reaches the game controls underneath
  window.addEventListener('keydown', dismiss, true);
  window.addEventListener('pointerdown', dismiss, true);
  const cleanup = (): void => {
    window.removeEventListener('keydown', dismiss, true);
    window.removeEventListener('pointerdown', dismiss, true);
  };
  return { veil, cleanup, refresh: () => fillIntro(card, touch) };
}
