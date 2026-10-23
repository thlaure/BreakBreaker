import type { AlertIcon, GuideIcon } from './incidents';

/* ---------- pixel-art SVG icons (built in code, crisp edges, no external images) ---------- */

const PALETTE: Record<string, string> = {
  K: '#14121c',
  R: '#c4372b',
  O: '#ff7a2e',
  Y: '#ffd166',
  W: '#fff7e0',
  B: '#3b6fd8',
  S: '#a9b6c8',
  L: '#8fd3ff',
  C: 'currentColor',
};

type Sprite = AlertIcon | GuideIcon | 'arrow' | 'arrowDiag';

const SPRITES: Record<Sprite, string[]> = {
  flame: [
    '....K.....',
    '...KRK....',
    '...KRRK.K.',
    '..KRORK.KK',
    '.KROORRKRK',
    '.KROYORRRK',
    'KROYYYORRK',
    'KROYWYYORK',
    'KROYWWYORK',
    '.KROYYORK.',
    '..KKKKKK..',
  ],
  alert: [
    '....KK....',
    '...KYYK...',
    '...KYYK...',
    '..KYKKYK..',
    '..KYKKYK..',
    '.KYYKKYYK.',
    '.KYYKKYYK.',
    'KYYYYYYYYK',
    'KYYYKKYYYK',
    'KKKKKKKKKK',
  ],
  // a small horde: three hooded silhouettes, red/orange
  horde: [
    '....KK....',
    '...KRRK...',
    '.KKKRRKKK.',
    'KOOKRRKOOK',
    'KOOKKKKOOK',
    'KKKRRRRKKK',
    'KOKRRRRKOK',
    'KOKRRRRKOK',
    'KKKRKKRKKK',
    '..KK..KK..',
  ],
  // a cracked glass pane with shards falling off
  glass: [
    'KKKKKKKKKK',
    'KWWYKWWWWK',
    'KWWWKWWKWK',
    'KWYWWKKWWK',
    'KWWKKWKWYK',
    'KWKWWWWKWK',
    'KKKKKKKWKK',
    '.....K..W.',
    '..WK....K.',
    '.......WK.',
  ],
  // a lightning bolt: the mode furie
  bolt: ['....KKKK.', '...KYYK..', '..KYYK...', '.KYYKKKK.', 'KYYYYYYK.', 'KKKKYYK..', '...KYK...', '..KYK....', '.KWK.....', '.KK......'],
  // a neutral pennant on a pole (no national flag): the monument
  flag: [
    'KK........',
    'KWKKK.....',
    'KWKYYKK...',
    'KWKYYYYKK.',
    'KWKYYYYYYK',
    'KWKYYYYKK.',
    'KWKYYKK...',
    'KWKKK.....',
    'KWK.......',
    'KWK.......',
    'KKK.......',
  ],
  // a round blue/steel shield with a highlight: the bouclier to grab
  shield: [
    '..KKKKKK..',
    '.KBBBBBBK.',
    'KBWWBBBBBK',
    'KBWSSSSBBK',
    'KBSSSSSSBK',
    'KBSSSSSSBK',
    'KBBSSSSBBK',
    '.KBBSSBBK.',
    '..KBBBBK..',
    '...KBBK...',
    '....KK....',
  ],
  // a gold crown with a red jewel: « Le Caïd »
  crown: ['Y...Y...Y.', 'KY.KYK.YK.', 'KYYKYKYYK.', 'KYYYYYYYK.', 'KYYRYYRYK.', 'KYYYYYYYK.', 'KOOOOOOOK.', 'KKKKKKKKK.'],
  // prison bars bent apart: the breakout
  bars: [
    'KKKKKKKKKK',
    'KSKSK.KSKK',
    'KSKSK..KSK',
    'KSKK....SK',
    'KSK.....SK',
    'KSK.....SK',
    'KSKK...KSK',
    'KSKSK.KSKK',
    'KSKSK.KSKK',
    'KKKKKKKKKK',
  ],
  // the cartoon flashball launcher: grey body, orange muzzle
  flashball: [
    '..........',
    'KKKKKKKKK.',
    'KSSSSSSOOK',
    'KSKKKKSOYK',
    'KSSSSSSOOK',
    'KKKSSKKKK.',
    '..KSSK....',
    '..KSSK....',
    '.KSSSK....',
    '.KKKKK....',
  ],
  // a gold wrench: a ruin to repair
  wrench: [
    '..KKK.....',
    '.KYYK.....',
    'KYK.K.....',
    'KYYKKK....',
    '.KKYYYK...',
    '...KYYYK..',
    '....KYYYK.',
    '.....KYYYK',
    '......KYYK',
    '.......KK.',
  ],
  // a red toolbox with its handle: a toolbox on the ground
  toolbox: ['...KKKK...', '...K..K...', 'KKKKKKKKKK', 'KRRRRRRRRK', 'KRRRRRRRRK', 'KKKKYYKKKK', 'KRRRYYRRRK', 'KRRRRRRRRK', 'KKKKKKKKKK'],
  // points right (0°); rotated toward the target
  arrow: ['....C...', '....CC..', 'CCCCCCC.', 'CCCCCCCC', 'CCCCCCC.', '....CC..', '....C...'],
  // points down-right (45°)
  arrowDiag: ['CC......', 'CCC.....', '.CCC...C', '..CCC.CC', '...CCCCC', '....CCCC', '...CCCCC'],
};

/**
 * Pixel arrow toward `deg` (0 = right, 90 = down), snapped to 8 directions so the art is only ever turned by
 * multiples of 90° (stays crisp): a straight sprite for 0/90/180/270, a diagonal one for the others.
 */
export function arrowFor(deg: number): { sprite: 'arrow' | 'arrowDiag'; rot: number } {
  const q = (((Math.round(deg / 45) * 45) % 360) + 360) % 360;
  return q % 90 === 0 ? { sprite: 'arrow', rot: q } : { sprite: 'arrowDiag', rot: q - 45 };
}

/** Points the pixel arrow inside `el` toward `deg`; touches the DOM only when the direction changes. */
export function setArrow(el: HTMLElement, deg: number, scale = 2): void {
  const { sprite, rot } = arrowFor(deg);
  const key = `${sprite}:${rot}`;
  if (el.dataset.dir === key) return;
  if (!el.dataset.dir?.startsWith(`${sprite}:`)) el.innerHTML = pixelSvg(sprite, scale);
  el.dataset.dir = key;
  el.style.transform = rot ? `rotate(${rot}deg)` : '';
}

/** Inline SVG of a pixel sprite, `scale` CSS px per art pixel. */
export function pixelSvg(name: Sprite, scale = 2): string {
  const rows = SPRITES[name];
  const h = rows.length;
  const w = rows[0]!.length;
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = PALETTE[row[x]!];
      if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}
