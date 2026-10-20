import { execSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, rmSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { beforeAll, expect, test } from 'vitest';
import { CONTROLS, RULES, SATIRE_NOTICE } from '../src/content/controls';

beforeAll(() => {
  rmSync('dist', { recursive: true, force: true });
  execSync('npx vite build', { stdio: 'pipe' });
}, 120_000);

test('two entry points are emitted', () => {
  expect(existsSync('dist/index.html')).toBe(true);
  expect(existsSync('dist/jouer/index.html')).toBe(true);
});

test('landing pulls no game code', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  expect(html).not.toMatch(/phaser|<script/i);
});

test('no three.js anywhere in build', () => {
  const all = globSync('dist/**/*.js').map((f) => readFileSync(f, 'utf8')).join('');
  expect(all).not.toMatch(/THREE\.|three\.module/);
});

const decode = (s: string) =>
  s.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('landing has one h1, a real /jouer/ link and no script', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  expect(html.match(/<h1/g)?.length).toBe(1);
  expect(html).toMatch(/href="\/jouer\/"/);
  expect(html).not.toMatch(/<script/);
});

test('landing own HTML + CSS <= 300 KB gzipped', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  const css = hrefs.map((h) => readFileSync('dist' + h, 'utf8')).join('');
  expect(gzipSync(html + css).length).toBeLessThanOrEqual(300 * 1024);
});

test('preview image has width, height and alt and is <= 250 KB', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const img = html.match(/<img[^>]*>/)?.[0] ?? '';
  expect(img).toMatch(/width="\d+"/);
  expect(img).toMatch(/height="\d+"/);
  expect(img).toMatch(/alt="[^"]{10,}"/);
  const src = img.match(/src="([^"]+)"/)?.[1] ?? '';
  expect(statSync('dist' + src).size).toBeLessThanOrEqual(250 * 1024);
});

test('landing renders every rule and control from the shared content module', () => {
  const text = decode(readFileSync('dist/index.html', 'utf8'));
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
  const html = readFileSync('dist/index.html', 'utf8');
  expect(html).not.toMatch(/OQTF|gratuit/i);
});
