import { describe, expect, test } from 'vitest';
import { FLAGS, FLAG_H, FLAG_W, flagSvg, type FlagId } from '../../src/site/flags';

const IDS: readonly FlagId[] = ['fr', 'us'];

describe('pixel flags', () => {
  for (const id of IDS) {
    test(`${id}: a ${FLAG_W}x${FLAG_H} grid whose every cell is in the palette`, () => {
      const f = FLAGS[id];
      expect(FLAG_W).toBe(16);
      expect(FLAG_H).toBe(11);
      expect(f.rows.length).toBe(FLAG_H);
      for (const row of f.rows) {
        expect(row.length).toBe(FLAG_W);
        for (const c of row) expect(f.palette[c], `${id}: "${c}" not in the palette`).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    test(`${id}: every palette colour is used`, () => {
      const f = FLAGS[id];
      const used = new Set(f.rows.join(''));
      for (const c of Object.keys(f.palette)) expect(used.has(c), `${id}: "${c}" unused`).toBe(true);
    });

    test(`${id}: renders as a crisp inline SVG of the grid size, decorative`, () => {
      const svg = flagSvg(id);
      expect(svg).toMatch(new RegExp(`^<svg [^>]*viewBox="0 0 ${FLAG_W} ${FLAG_H}"`));
      expect(svg).toMatch(/shape-rendering="crispEdges"/);
      expect(svg).toMatch(/aria-hidden="true"/);
      expect(svg).not.toMatch(/<script|<image|href=/);
      // every colour of the palette is drawn
      for (const col of Object.values(FLAGS[id].palette)) expect(svg).toContain(`fill="${col}"`);
    });
  }

  test('the French tricolour: blue, white, red vertical bands', () => {
    const f = FLAGS.fr;
    const colourAt = (x: number, y: number) => f.palette[f.rows[y]![x]!];
    for (let y = 0; y < FLAG_H; y++) {
      expect(colourAt(0, y)).toBe(colourAt(0, 0));
      expect(colourAt(8, y)).toBe('#ffffff');
      expect(colourAt(15, y)).toBe(colourAt(15, 0));
    }
    expect(new Set([colourAt(0, 0), colourAt(8, 0), colourAt(15, 0)]).size).toBe(3);
  });

  test('the American flag: alternating stripes and a starred canton top-left', () => {
    const f = FLAGS.us;
    const colourAt = (x: number, y: number) => f.palette[f.rows[y]![x]!];
    // stripes on the right side alternate red / white, red on the top and bottom rows
    for (let y = 0; y < FLAG_H; y++) expect(colourAt(15, y)).toBe(y % 2 === 0 ? colourAt(15, 0) : '#ffffff');
    expect(colourAt(15, FLAG_H - 1)).toBe(colourAt(15, 0));
    // the canton holds white stars on blue
    const canton = f.rows.slice(0, 5).map((r) => r.slice(0, 7));
    const cols = new Set(
      canton
        .join('')
        .split('')
        .map((c) => f.palette[c]),
    );
    expect(cols.has('#ffffff')).toBe(true);
    expect(colourAt(0, 0)).not.toBe(colourAt(15, 0));
  });

  test('the two flags differ', () => {
    expect(flagSvg('fr')).not.toBe(flagSvg('us'));
    expect(FLAGS.fr.rows.join('')).not.toBe(FLAGS.us.rows.join(''));
  });
});
