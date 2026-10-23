/**
 * The two language flags of the selector, original pixel art as pure data: a 16x11 grid of palette letters per flag.
 * Rendered as inline SVG (crisp pixels, no asset file) on the static landing pages and in the game's pause menu.
 */
export type FlagId = 'fr' | 'us';

export interface PixelFlag {
  /** Letter -> colour (#rrggbb). */
  readonly palette: Readonly<Record<string, string>>;
  /** FLAG_H rows of FLAG_W letters. */
  readonly rows: readonly string[];
}

export const FLAG_W = 16;
export const FLAG_H = 11;

const tricolour = 'BBBBBWWWWWWRRRRR';

export const FLAGS: Readonly<Record<FlagId, PixelFlag>> = {
  // French tricolour: blue, white, red vertical bands (5, 6, 5 pixels).
  fr: {
    palette: { B: '#0055a4', W: '#ffffff', R: '#ef4135' },
    rows: Array.from({ length: FLAG_H }, () => tricolour),
  },
  // American flag, simplified: 11 stripes (red top and bottom) and a blue canton with a pattern of white star pixels.
  us: {
    palette: { B: '#3c3b6e', W: '#ffffff', R: '#b22234' },
    rows: [
      'BBBBBBBRRRRRRRRR',
      'BWBWBWBWWWWWWWWW',
      'BBWBWBBRRRRRRRRR',
      'BWBWBWBWWWWWWWWW',
      'BBBBBBBRRRRRRRRR',
      'WWWWWWWWWWWWWWWW',
      'RRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWW',
      'RRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWW',
      'RRRRRRRRRRRRRRRR',
    ],
  },
};

/** The flag as an inline SVG string: one rect per horizontal run of a colour, crisp edges, decorative (aria-hidden). */
export function flagSvg(id: FlagId, scale = 2): string {
  const { palette, rows } = FLAGS[id];
  const rects: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x]!;
      let end = x + 1;
      while (row[end] === c) end++;
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[c]}"/>`);
      x = end;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FLAG_W} ${FLAG_H}" width="${FLAG_W * scale}" height="${FLAG_H * scale}" ` +
    `shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects.join('')}</svg>`
  );
}
