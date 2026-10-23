import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * The simulation emits ids, never player-facing text (the HUD and the render translate them with t()). This scans
 * every string literal of src/sim (comments stripped) for what looks like a phrase or a label.
 */
const SIM = path.resolve(__dirname, '../../src/sim');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/**
 * The string literals of a TypeScript source: comments skipped, template placeholders dropped, and the developer
 * messages of `new Error(…)` left out.
 */
export function literals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      if (i < 0) break;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') {
          s += src[j + 1] ?? '';
          j += 2;
        } else s += src[j++];
      }
      if (!/Error\(\s*$/.test(src.slice(Math.max(0, i - 12), i))) out.push(c === '`' ? s.replace(/\$\{[^}]*\}/g, '') : s);
      i = j + 1;
    } else i++;
  }
  return out;
}

const ACCENT = /[À-ÿœŒ«»’]/;
/** Ids of the sim that look like a capitalised word (event and state names). */
const ALLOWED = new Set<string>(['Removed']);

export function looksLikeText(s: string): boolean {
  if (ACCENT.test(s)) return true;
  // several words with a letter: a phrase ('en feu', 'Caisse à outils requise'); template ids have no space
  if (/\s/.test(s.trim()) && /[a-zA-Z]{2,}/.test(s)) return true;
  // a capitalised word ('Marteau') or a sign in capitals ('CAF')
  if ((/^[A-Z][a-z]+$/.test(s) || /^[A-Z]{2,}$/.test(s)) && !ALLOWED.has(s)) return true;
  return false;
}

describe('the simulation carries no phrase', () => {
  test('the detector', () => {
    expect(literals("const a = 'x'; // 'Épuisé'\n/* 'en feu' */ const b = `y${1}`;")).toEqual(['x', 'y']);
    expect(literals('throw new Error(`unknown target ${id}`); f(`round#${s.round + 1}:fill`)')).toEqual(['round#:fill']);
    for (const s of ['Épuisé', 'en feu', 'Marteau', 'CAF', 'POULET CROUSTI']) expect(looksLikeText(s), s).toBe(true);
    for (const s of ['toolboxRequired', 'burning', 'round#:bonus', 'boothRed', '1.0.0']) expect(looksLikeText(s), s).toBe(false);
  });

  test('no string literal of src/sim looks like player-facing text', () => {
    const offenders: string[] = [];
    for (const f of files(SIM)) {
      for (const s of literals(fs.readFileSync(f, 'utf8'))) {
        if (looksLikeText(s)) offenders.push(`${path.relative(SIM, f)}: '${s}'`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
