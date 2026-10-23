import { describe, expect, test } from 'vitest';
import { CONTROLS, SATIRE_NOTICE } from '../../src/content/controls';
import { controlsFor, renderLanding } from '../../src/site/landingContent';

const TEMPLATE = `<html lang="<!--lang-->"><a href="<!--root-->play/?go&amp;lang=<!--lang-->"><!--t:landing.play--></a><!--flags--><!--alternates--><!--notice--></html>`;
const CTX = { version: '9.9.9', changelog: '## 9.9.9 - 2026-10-23\n- Une note\n' };

describe('controlsFor (landing adapter)', () => {
  test('fr is the shared French table and notice', () => {
    expect(controlsFor('fr').rows).toEqual(CONTROLS);
    expect(controlsFor('fr').notice).toBe(SATIRE_NOTICE);
  });

  test('en has the same rows, all filled, without French letters', () => {
    const en = controlsFor('en');
    expect(en.rows.length).toBe(CONTROLS.length);
    for (const r of en.rows) for (const v of [r.action, r.keyboard, r.touch]) expect(v.trim()).not.toBe('');
    expect(JSON.stringify(en)).not.toMatch(/[àâçéèêëîïôûùœ’]/i);
    // the safety wording is kept: fiction and satire
    expect(en.notice).toMatch(/satirical/);
    expect(en.notice).toMatch(/fiction/);
  });
});

describe('renderLanding', () => {
  test('fr page: root-relative links, lang fr, French Play', () => {
    const html = renderLanding(TEMPLATE, 'fr', CTX);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('href="play/?go&amp;lang=fr">Jouer</a>');
    expect(html).not.toMatch(/<!--/);
  });

  test('en page: one level down, lang en, English Play', () => {
    const html = renderLanding(TEMPLATE, 'en', CTX);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('href="../play/?go&amp;lang=en">Play</a>');
    expect(html).toMatch(/<link rel="alternate" hreflang="fr" href="\.\.\/"/);
    expect(html).toMatch(/<link rel="alternate" hreflang="en" href="\.\/"/);
  });

  test('the flags: two links, the active one aria-current, each with hreflang', () => {
    const html = renderLanding(TEMPLATE, 'en', CTX);
    const links = [...html.matchAll(/<a class="flag[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(links.length).toBe(2);
    expect(links[0]).toMatch(/hreflang="fr"/);
    expect(links[0]).toMatch(/href="\.\.\/"/);
    expect(links[0]).not.toMatch(/aria-current/);
    expect(links[1]).toMatch(/hreflang="en"/);
    expect(links[1]).toMatch(/aria-current="page"/);
  });
});
