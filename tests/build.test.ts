import { execSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, rmSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';

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
