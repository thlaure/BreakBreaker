import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CONTROLS, RULES, SATIRE_NOTICE } from '../src/content/controls';
import { catalog, type Locale } from '../src/content/i18n';
import { controlsFor } from '../src/site/landingContent';
import { CONFIG } from '../src/sim/config';

// Production build into a temp dir: vitest sets NODE_ENV=test, which would make Vite emit a dev bundle
// (import.meta.env.DEV = true). The repo's own dist/ is never touched.
const OUT = mkdtempSync(join(tmpdir(), 'breakbreaker-build-'));
const out = (p: string): string => join(OUT, p);
const allJs = (): string =>
  globSync('**/*.js', { cwd: OUT })
    .map((f) => readFileSync(out(f), 'utf8'))
    .join('\n');

beforeAll(() => {
  execFileSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir'], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  });
}, 120_000);

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/** The two static landing pages: French at the root, English one level down. */
const LANDINGS: readonly { locale: Locale; page: string; root: string }[] = [
  { locale: 'fr', page: 'index.html', root: '' },
  { locale: 'en', page: 'en/index.html', root: '../' },
];

test('the entry points are emitted: both landings and the game', () => {
  expect(existsSync(out('index.html'))).toBe(true);
  expect(existsSync(out('en/index.html'))).toBe(true);
  expect(existsSync(out('play/index.html'))).toBe(true);
});

test('landings pull no game code; their only script is the tiny inline event switch', () => {
  for (const { page } of LANDINGS) {
    const html = readFileSync(out(page), 'utf8');
    expect(html, page).not.toMatch(/phaser/i);
    expect(html, page).not.toMatch(/<script[^>]*\ssrc=/i);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts, page).toHaveLength(1);
    expect(scripts[0]![1]!.length, page).toBeLessThan(600);
    expect(scripts[0]![1], page).toContain('data-event');
  }
});

test('no three.js anywhere in build', () => {
  const all = allJs();
  expect(all.length).toBeGreaterThan(0);
  expect(all).not.toMatch(/THREE\.|three\.module|__THREE__/);
});

test('production bundle: no dev handle, no stress mode, no cheat', () => {
  const all = allJs();
  expect(all).not.toContain('__game');
  expect(all).not.toMatch(/get\(\s*["'`]stress["'`]\s*\)/);
  expect(all).not.toMatch(/stressTick|stressTarget|topUp/);
});

const decode = (s: string) =>
  s
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

test('each landing: its lang, one h1, a relative play link carrying the language, no script', () => {
  for (const { locale, page, root } of LANDINGS) {
    const html = readFileSync(out(page), 'utf8');
    expect(html, page).toMatch(new RegExp(`<html lang="${locale}"`));
    expect(html.match(/<h1/g)?.length, page).toBe(1);
    // relative (works under a sub-path); starts the game at once, in this page's language (the game saves it)
    expect(html, page).toContain(`href="${root}play/?go&amp;lang=${locale}"`);
    expect(html, page).not.toMatch(/<a [^>]*href="\/(?!\/)/); // no root-absolute <a> links: the site may be served under /<repo>/
    expect(html, page).not.toMatch(/<script[^>]*\ssrc=/);
  }
});

test('each landing links both languages with hreflang (head alternates and the flag links)', () => {
  for (const { locale, page, root } of LANDINGS) {
    const html = readFileSync(out(page), 'utf8');
    const href = { fr: root === '' ? './' : root, en: root === '' ? 'en/' : './' };
    expect(html, page).toContain(`<link rel="alternate" hreflang="fr" href="${href.fr}"`);
    expect(html, page).toContain(`<link rel="alternate" hreflang="en" href="${href.en}"`);
    const flags = [...html.matchAll(/<a class="flag[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(flags.length, page).toBe(2);
    expect(flags[0], page).toContain(`href="${href.fr}"`);
    expect(flags[0], page).toContain('hreflang="fr"');
    expect(flags[1], page).toContain(`href="${href.en}"`);
    expect(flags[1], page).toContain('hreflang="en"');
    const current = flags.filter((f) => f.includes('aria-current="page"'));
    expect(current.length, page).toBe(1);
    expect(current[0], page).toContain(`hreflang="${locale}"`);
    expect(html, page).toMatch(/<svg [^>]*shape-rendering="crispEdges"/);
  }
});

/** Text of a landing (title and meta contents included), without the parts deliberately kept in French (lang="fr"). */
const pageText = (html: string): string =>
  decode(
    html
      .replace(/<(?!html\b)(\w+)\b[^>]*\slang="fr"[^>]*>[\s\S]*?<\/\1>/g, '')
      .replace(/<meta [^>]*content="([^"]*)"[^>]*>/g, '\n$1\n')
      .replace(/<[^>]+>/g, '\n'),
  );

test('no text of the other language leaks into a landing (scan against the catalogs and the controls)', () => {
  const fr = catalog('fr');
  const en = catalog('en');
  const landingKeys = Object.keys(fr).filter((k) => k.startsWith('landing.') && fr[k] !== en[k]);
  const strings = (c: ReturnType<typeof controlsFor>): string[] => [c.notice, ...c.rows.flatMap((r) => [r.action, r.keyboard, r.touch])];
  const own = { fr: strings(controlsFor('fr')), en: strings(controlsFor('en')) };
  const other = {
    fr: [...landingKeys.map((k) => en[k] ?? ''), ...own.en],
    en: [...landingKeys.map((k) => fr[k] ?? ''), ...own.fr],
  };
  for (const { locale, page } of LANDINGS) {
    const text = pageText(readFileSync(out(page), 'utf8'));
    // the scan sees the page's own texts (else it would prove nothing)
    expect(text, page).toContain(catalog(locale)['landing.tagline']);
    expect(text, page).toContain(controlsFor(locale).notice);
    for (const s of other[locale]) {
      if (s.length < 4 || own[locale].includes(s)) continue; // short keys (F, C, Maj) and shared words are not evidence
      expect(text, `${page}: "${s}"`).not.toContain(s);
    }
  }
  // outside its lang="fr" parts (the French flag's name), the English page has no French letter
  expect(pageText(readFileSync(out('en/index.html'), 'utf8'))).not.toMatch(/[àâçéèêëîïôûùœ]/i);
});

test('the English landing shares the built stylesheet of the French one', () => {
  const sheets = (page: string) =>
    [...readFileSync(out(page), 'utf8').matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  expect(sheets('en/index.html')).toEqual(sheets('index.html'));
  for (const h of sheets('en/index.html')) expect(existsSync(out(h ?? ''))).toBe(true);
});

test('the English page shows the English changelog, with no French marking', () => {
  const html = readFileSync(out('en/index.html'), 'utf8');
  const md = readFileSync('CHANGELOG.en.md', 'utf8');
  const latest = /^## (\S+) - /m.exec(md)?.[1];
  expect(html).toContain(`What’s new <span>${latest}</span>`);
  expect(html).toMatch(/popovertarget="changelog"[^>]*>Changelog</);
  expect(html).not.toContain('lang="fr"><li>');
  expect(html).not.toContain('(in French)');
  expect(html.match(/class="release"/g)?.length).toBe(md.match(/^## \S+ - /gm)?.length);
  expect(html).toContain('October 24, 2026');
});

test('CHANGELOG.en.md mirrors CHANGELOG.md: same versions, dates and number of points', () => {
  const shape = (f: string) =>
    readFileSync(f, 'utf8')
      .split(/^## /m)
      .slice(1)
      .map((b) => [b.split('\n')[0], b.split('\n').filter((l) => l.startsWith('- ')).length]);
  expect(shape('CHANGELOG.en.md')).toEqual(shape('CHANGELOG.md'));
});

test('landing own HTML + CSS <= 300 KB gzipped', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  const css = hrefs.map((h) => readFileSync(out(h ?? ''), 'utf8')).join('');
  expect(gzipSync(html + css).length).toBeLessThanOrEqual(300 * 1024);
});

test('landing is slim: one h1, one Jouer button, a Commandes button with its modal', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  expect(html).not.toMatch(/<img/); // the hero is a CSS background (pixel art from the game's assets), not an <img>
  expect(html.match(/class="[^"]*btn-primary[^"]*"[^>]*href="play\/\?go&amp;lang=fr"/g)?.length).toBe(1);
  expect(html).toMatch(/<button[^>]*popovertarget="commandes"[^>]*>Commandes</);
  expect(html).toMatch(/<div id="commandes" popover/);
  expect(html).toMatch(/popovertargetaction="hide"/);
});

test('landing shows the controls (modal) from the shared module but not the game rules', () => {
  const text = decode(readFileSync(out('index.html'), 'utf8'));
  expect(text).toContain(SATIRE_NOTICE);
  for (const c of CONTROLS) {
    expect(text).toContain(c.action);
    expect(text).toContain(c.keyboard);
    expect(text).toContain(c.touch);
  }
  for (const r of RULES) expect(text).not.toContain(r); // the instructions are shown in the game at launch
  expect(text).toContain(CONFIG.appVersion);
});

test('the English landing shows the English controls, notice and version', () => {
  const text = decode(readFileSync(out('en/index.html'), 'utf8'));
  const { rows, notice } = controlsFor('en');
  expect(text).toContain(notice);
  for (const c of rows) {
    expect(text).toContain(c.action);
    expect(text).toContain(c.keyboard);
    expect(text).toContain(c.touch);
  }
  expect(text).toContain(CONFIG.appVersion);
});

test('landing never says OQTF or gratuit', () => {
  for (const { page } of LANDINGS) {
    const html = readFileSync(out(page), 'utf8');
    expect(html, page).not.toMatch(/OQTF|gratuit|free to play/i);
  }
});

/** The landing's built CSS (all stylesheets linked from index.html). */
const landingCss = (): string => {
  const html = readFileSync(out('index.html'), 'utf8');
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => readFileSync(out(m[1] ?? ''), 'utf8')).join('');
};
/** Files referenced by `url(...)` in the landing CSS, resolved inside the build dir (base is '/'). */
const cssUrls = (re: RegExp): string[] =>
  [...landingCss().matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map((m) => m[1] ?? '')
    .filter((u) => re.test(u))
    .map((u) => out(u.replace(/^\//, '')));

test('landing heroes (base and Halloween): pixel-art PNGs referenced from the CSS, <= 250 KB each', () => {
  const files = cssUrls(/hero[^/]*\.png$/);
  expect(files.length).toBe(2);
  for (const f of files) expect(statSync(f).size).toBeLessThanOrEqual(250 * 1024);
  expect(landingCss()).toMatch(/image-rendering:\s*pixelated/);
});

test('the Halloween hero is only used under data-event, so no other day downloads it', () => {
  const css = landingCss();
  const rule = /([^{}]*)\{[^{}]*url\(\s*["']?[^"')]*hero[^"')]*\.png/g;
  const selectors = [...css.matchAll(rule)].map((m) => m[1]!.trim());
  expect(selectors).toHaveLength(2);
  expect(selectors.filter((sel) => sel.includes('data-event')).length).toBe(1);
});

test('landing pixel font (woff2/ttf) <= 100 KB', () => {
  const files = cssUrls(/\.(woff2|woff|ttf)$/);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect(statSync(f).size).toBeLessThanOrEqual(100 * 1024);
});

test('landing references no flag asset and no game atlas, engine or sound', () => {
  const all = readFileSync(out('index.html'), 'utf8') + landingCss();
  expect(all).not.toMatch(/flags\.png|assets\/props/);
  expect(all).not.toMatch(/assets\/(chars|tiles|sfx|audio)\/|\.(ogg|mp3|wav)\b|phaser/i);
});

test('src/site/hero.png is a native-size PNG (generated by npm run hero)', () => {
  const png = readFileSync('src/site/hero.png');
  expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  expect(w).toBeGreaterThanOrEqual(320);
  expect(w).toBeLessThanOrEqual(800);
  expect(h).toBeGreaterThanOrEqual(180);
  expect(h).toBeLessThanOrEqual(450);
});

const pngSize = (file: string): [number, number] => {
  const b = readFileSync(out(file));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('both pages declare the site icon (Paul pixel head) and the icon files ship in the build', () => {
  for (const page of ['index.html', 'en/index.html', 'play/index.html']) {
    const html = readFileSync(out(page), 'utf8');
    expect(html).toMatch(/<link rel="icon"[^>]*href="[^"]*favicon\.png"/);
    expect(html).toMatch(/<link rel="apple-touch-icon"[^>]*href="[^"]*apple-touch-icon\.png"/);
    expect(html).toMatch(/<meta name="theme-color"/);
  }
  expect(pngSize('favicon.png')).toEqual([32, 32]);
  expect(pngSize('apple-touch-icon.png')).toEqual([180, 180]);
});

test('landing inlines the latest CHANGELOG.md notes and a changelog dialog, still without script', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  const md = readFileSync('CHANGELOG.md', 'utf8');
  const latest = /^## (\S+) - /m.exec(md)?.[1];
  expect(latest).toBeTruthy();
  expect(html).toContain(`Nouveautés <span>${latest}</span>`);
  expect(html).toMatch(/id="changelog"[^>]*popover/);
  expect(html).toMatch(/popovertarget="changelog"[^>]*>Changelog</);
  expect(html.match(/class="release"/g)?.length).toBe(md.match(/^## \S+ - /gm)?.length);
  expect(html).not.toMatch(/<script[^>]*\ssrc=/);
});

test('the engine is its own chunk, apart from the game code', () => {
  const files = readdirSync(out('assets'));
  expect(files.some((f) => /^phaser-.*\.js$/.test(f))).toBe(true);
  expect(files.some((f) => /^play-.*\.js$/.test(f))).toBe(true);
});
