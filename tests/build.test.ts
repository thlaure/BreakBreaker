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

test('preview image has width, height and alt and is <= 250 KB', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  const img = html.match(/<img[^>]*>/)?.[0] ?? '';
  expect(img).toMatch(/width="\d+"/);
  expect(img).toMatch(/height="\d+"/);
  expect(img).toMatch(/alt="[^"]{10,}"/);
  const src = img.match(/src="([^"]+)"/)?.[1] ?? '';
  expect(statSync(out(src)).size).toBeLessThanOrEqual(250 * 1024);
});

test('landing renders every rule and control from the shared content module', () => {
  const text = decode(readFileSync(out('index.html'), 'utf8'));
  for (const r of RULES) expect(text).toContain(r);
  expect(text).toContain(SATIRE_NOTICE);
  for (const c of CONTROLS) {
    expect(text).toContain(c.action);
    expect(text).toContain(c.keyboard);
    expect(text).toContain(c.touch);
  }
  expect(text).toContain('slice-0.1.0');
});

test('landing never says OQTF or gratuit', () => {
  const html = readFileSync(out('index.html'), 'utf8');
  expect(html).not.toMatch(/OQTF|gratuit/i);
});
