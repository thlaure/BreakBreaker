import { CONTROLS, INTRO_ACTIONS, INTRO_GOAL } from '../../content/controls';
import { el } from './hudDom';

/**
 * Builds the « Comment jouer » veil and arms its dismiss listeners (capture on window). The first real key or tap calls
 * `close` then `onDismiss`; `cleanup` removes the listeners.
 */
export function openIntro(touch: boolean, onDismiss: () => void, close: () => void): { veil: HTMLElement; cleanup: () => void } {
  const card = el('div', 'bb-intro');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Comment jouer');
  card.append(el('b', 'title', 'Comment jouer'), el('p', 'goal', INTRO_GOAL));
  const list = el('dl', 'keys');
  for (const name of INTRO_ACTIONS) {
    const row = CONTROLS.find((c) => c.action === name);
    if (!row) continue;
    list.append(el('dt', '', name), el('dd', '', touch ? row.touch : row.keyboard));
  }
  const go = el('p', 'go', touch ? 'Touche l’écran pour commencer' : 'Appuie sur une touche pour commencer');
  card.append(list, go);
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
  return { veil, cleanup };
}
