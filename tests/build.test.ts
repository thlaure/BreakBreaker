import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CONTROLS, RULES, SATIRE_NOTICE } from '../src/content/controls';

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

test('two entry points are emitted', () => {
  expect(existsSync(out('index.html'))).toBe(true);
  expect(existsSync(out('jouer/index.html'))).toBe(true);
});

test('landing pulls no game code', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  expect(html).not.toMatch(/phaser|<script/i);
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
  s.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('landing has one h1, a real relative jouer/ link and no script', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  expect(html.match(/<h1/g)?.length).toBe(1);
  expect(html).toMatch(/href="jouer\/\?go"/); // relative (works under a sub-path); starts the game at once
  expect(html).not.toMatch(/<a [^>]*href="\/(?!\/)/); // no root-absolute <a> links: the site may be served under /<repo>/
  expect(html).not.toMatch(/<script/);
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
  expect(html.match(/class="[^"]*btn-primary[^"]*"[^>]*href="jouer\/\?go"/g)?.length).toBe(1);
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
  expect(text).toContain('1.0.0');
});

test('landing never says OQTF or gratuit', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  expect(html).not.toMatch(/OQTF|gratuit/i);
});

/** The landing's built CSS (all stylesheets linked from index.html). */
const landingCss = (): string => {
  const html = readFileSync(out('index.html'), 'utf8');
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((m) => readFileSync(out(m[1] ?? ''), 'utf8'))
    .join('');
};
/** Files referenced by `url(...)` in the landing CSS, resolved inside the build dir (base is '/'). */
const cssUrls = (re: RegExp): string[] =>
  [...landingCss().matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map((m) => m[1] ?? '')
    .filter((u) => re.test(u))
    .map((u) => out(u.replace(/^\//, '')));

test('landing hero: pixel-art PNG referenced from the CSS, <= 250 KB', () => {
  const files = cssUrls(/hero[^/]*\.png$/);
  expect(files.length).toBe(1);
  expect(statSync(files[0]!).size).toBeLessThanOrEqual(250 * 1024);
  expect(landingCss()).toMatch(/image-rendering:\s*pixelated/);
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
  for (const page of ['index.html', 'jouer/index.html']) {
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
  expect(html).not.toMatch(/<script/);
});
