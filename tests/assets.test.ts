import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const pub = path.resolve(__dirname, '../public');
const assets = path.join(pub, 'assets');
const recipes = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/lpc-recipes.json'), 'utf8')) as Record<
  string,
  { layers: { path: string }[] }
>;
const chars = [
  'paul',
  'rioter_classic_a',
  'rioter_classic_b',
  'rioter_palestinian_a',
  'rioter_palestinian_b',
  'rioter_antifa_a',
  'rioter_antifa_b',
  'rioter_runner_a',
  'rioter_runner_b',
  'protester_1',
  'protester_2',
  'protester_3',
  'protester_4',
  'elder_1',
  'elder_2',
];
const sfx = ['hit1', 'hit2', 'hit3', 'throw', 'land', 'pickup', 'hurt', 'fire_loop', 'alarm', 'ui_click'];
const png = (rel: string) => PNG.sync.read(fs.readFileSync(path.join(assets, rel)));

function dirSize(dir: string): number {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    const p = path.join(dir, e.name);
    return n + (e.isDirectory() ? dirSize(p) : fs.statSync(p).size);
  }, 0);
}

describe('assets', () => {
  it('has every expected file', () => {
    const files = [
      ...chars.map((c) => `chars/${c}.png`),
      'chars/layout.json',
      'tiles/streets.png',
      'tiles/urban.png',
      'tiles/city.png',
      'tiles/README.md',
      'props/flags.png',
      ...sfx.map((s) => `sfx/${s}.ogg`),
    ];
    for (const f of files) expect(fs.existsSync(path.join(assets, f)), f).toBe(true);
    expect(fs.existsSync(path.join(pub, 'CREDITS.md'))).toBe(true);
  });

  it('has one recipe per character', () => {
    expect(Object.keys(recipes).sort()).toEqual([...chars].sort());
  });

  it('layout.json matches sheet heights', () => {
    const layout = JSON.parse(fs.readFileSync(path.join(assets, 'chars/layout.json'), 'utf8'));
    expect(layout.frame).toBe(64);
    let maxRow = 0;
    let maxFrames = 0;
    for (const a of Object.values(layout.anims) as { rows?: Record<string, number>; row?: number; frames: number }[]) {
      const rows = a.rows ? Object.values(a.rows) : [a.row as number];
      maxRow = Math.max(maxRow, ...rows);
      maxFrames = Math.max(maxFrames, a.frames);
    }
    for (const c of chars) {
      const p = png(`chars/${c}.png`);
      expect(p.height, c).toBeGreaterThanOrEqual((maxRow + 1) * 64);
      expect(p.width, c).toBeGreaterThanOrEqual(maxFrames * 64);
    }
  });

  it('flags.png is 48x12', () => {
    const p = png('props/flags.png');
    expect([p.width, p.height]).toEqual([48, 12]);
  });

  it('CREDITS.md has non-empty sections and credits every character layer', () => {
    const md = fs.readFileSync(path.join(pub, 'CREDITS.md'), 'utf8');
    expect(md).toMatch(/^# Crédits/m);
    const sections = Object.fromEntries(md.split(/^## /m).slice(1).map((s) => [(s.split('\n')[0] ?? '').trim(), s]));
    for (const h of ['Personnages', 'Décors', 'Sons', 'Code']) {
      const sec = sections[h] ?? '';
      expect(sec.split('\n').slice(1).join('').trim().length, h).toBeGreaterThan(20);
    }
    const layers = new Set(Object.values(recipes).flatMap((r) => r.layers.map((l) => l.path)));
    for (const l of layers) expect(md, l).toContain(`\`${l}\``);
  });

  it('public/assets is at most 8 MB', () => {
    expect(dirSize(assets)).toBeLessThanOrEqual(8 * 1024 * 1024);
  });
});
