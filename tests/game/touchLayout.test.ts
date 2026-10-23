import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const html = readFileSync(new URL('../../play/index.html', import.meta.url), 'utf8');
const rule = (action: string): string => html.match(new RegExp(`#touch-ui \\[data-action="${action}"\\] \\{([^}]*)\\}`))?.[1] ?? '';

test('the 64 px « Renvoyer » button uses a smaller label so the word does not touch its round border (375 px check)', () => {
  // at the default 13 px bold the word measured 59 px wide inside a 60 px inner circle (real browser, mobile viewport)
  expect(rule('throw')).toMatch(/font-size: 11px/);
  expect(rule('throw')).toMatch(/width: 64px/);
});
