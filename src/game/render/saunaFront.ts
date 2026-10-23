import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import type { DecorDef } from '../../sim/map/district';
import type { DecorAnim, FrontKit, Paint, RoofPart } from './decor';
import { DEPTH } from './depth';
import { FACADE_H, ROOF_OVERHANG } from './geometry';
import { SAUNA_SIGN, lanternGlow, silhouetteDrift, steamSpec } from './squareMath';

const T = CONFIG.tile;
const OUTLINE = 0x14121c;

/** Sauna colours: warm pine planks, dark knots, steam, lantern light. */
const SAUNA = {
  pine: 0xb07a40,
  pineHi: 0xc8925a,
  pineLo: 0x8a5a2e,
  dark: 0x5a3418,
  shingle: 0x7a4a26,
  shingleHi: 0x96602e,
  steam: 0xeef4f6,
  inside: 0xb06a3a,
  figure: 0x4a2618,
  light: 0xffd27a,
  iron: 0x2a2630,
} as const;

/** A Graphics at `depth` and its painter. */
function layer(s: Phaser.Scene, depth: number): { gr: Phaser.GameObjects.Graphics; p: Paint } {
  const gr = s.add.graphics().setDepth(depth);
  return {
    gr,
    p: (c, x, y, w, h, a = 1) => {
      gr.fillStyle(c, a).fillRect(x, y, w, h);
    },
  };
}

/**
 * One blurry silhouette behind the steamed glass (local px, feet of the bust at 0,0): a soft head and shoulders, no
 * face, a towel over the shoulders, and props and plain outfit only (no exaggerated features): 0 a red cap and a long red tie, 1 a judo belt and a hockey stick, 2 a plain dark turban and a grey beard.
 */
function silhouette(p: Paint, k: number): void {
  const f = SAUNA.figure;
  // soft edges: a faint wider halo under the solid shape
  p(f, -4, -14, 8, 6, 0.3);
  p(f, -6, -9, 12, 9, 0.3);
  p(f, -3, -13, 6, 5, 0.85); // head
  p(f, -5, -7, 10, 7, 0.85); // shoulders
  p(0xf4f4f0, -5, -7, 10, 2, 0.7); // towel
  if (k === 0) {
    // a red baseball cap and a very long red tie over the towel
    p(0xc0392b, -5, -17, 10, 4, 0.9);
    p(0xc0392b, -9, -14, 5, 1, 0.9); // the peak
    p(0xc0392b, -1, -7, 2, 9, 0.9);
    p(0x8e1f16, -1, 1, 2, 1, 0.9);
  } else if (k === 1) {
    // a black judo belt around the towel and an ice-hockey stick leaning on the bench
    p(0x1a1a1a, -5, -3, 10, 2, 0.95);
    p(0x1a1a1a, -1, -1, 2, 4, 0.95);
    p(0x8a6a3a, 7, -12, 1, 12, 0.9);
    p(0x8a6a3a, 7, 0, 4, 1, 0.9);
  } else {
    // a plain dark turban and a grey beard, drawn without exaggeration (no symbol, no extra gag)
    p(0x2b2b33, -5, -18, 10, 5, 0.95);
    p(0x3b3b46, -4, -17, 8, 1, 0.8);
    p(0xb8b8b8, -3, -9, 6, 3, 0.9);
  }
}

/**
 * The sauna (decor): a warm pine-plank front with a steamed window showing three blurry silhouettes (told apart
 * by props only), a plank door with a fogged porthole and a towel on its hook, a lantern with a flickering
 * glow, a stack of firewood, a shingle roof with a stove pipe puffing steam (none under reduced motion), and the board
 * « Sauna – Ne pas déranger » on the roof edge.
 */
export function buildSaunaFront(kit: FrontKit, s: Phaser.Scene, d: DecorDef, roofParts: RoofPart[], reduced: boolean): DecorAnim {
  const b = d.footprint;
  const { r, top, front } = kit.frontPainter(b);
  const door = Math.floor(d.door.x / T) * T;
  // horizontal pine planks, corner posts
  for (let y = top, k = 0; y < front - 3; y += 4, k++) {
    r(k % 2 ? SAUNA.pine : SAUNA.pineHi, b.x, y, b.w, 4, 0.96);
    r(SAUNA.pineLo, b.x, y + 3, b.w, 1);
  }
  for (const [x, y] of [
    [b.x + 70, top + 6],
    [b.x + 100, top + 14],
    [b.x + 20, top + 27],
  ] as const)
    r(SAUNA.dark, x, y, 2, 1);
  r(SAUNA.dark, b.x, top, 3, FACADE_H - 3);
  r(SAUNA.dark, b.x + b.w - 3, top, 3, FACADE_H - 3);
  r(SAUNA.dark, b.x, top, b.w, 2);
  // the steamed window: a warm inside, a bench, the silhouettes, then the fog over them
  const wx = b.x + 8;
  const ww = Math.min(48, door - 6 - wx);
  r(OUTLINE, wx - 2, top + 4, ww + 4, 23);
  r(SAUNA.dark, wx - 1, top + 5, ww + 2, 21);
  r(SAUNA.inside, wx + 1, top + 7, ww - 2, 17);
  r(SAUNA.pineLo, wx + 1, top + 19, ww - 2, 2); // bench
  const people = [0, 1, 2].map((k) => {
    const { gr, p } = layer(s, front + 0.025);
    silhouette(p, k);
    gr.setPosition(wx + 9 + k * 14, top + 24);
    return gr;
  });
  const { p: fog } = layer(s, front + 0.03);
  fog(SAUNA.steam, wx + 1, top + 7, ww - 2, 17, 0.32);
  fog(SAUNA.steam, wx + 1, top + 7, ww - 2, 4, 0.25);
  for (const [x, h] of [
    [6, 10],
    [17, 7],
    [31, 12],
    [41, 6],
  ] as const)
    if (x < ww - 2) fog(SAUNA.inside, wx + x, top + 12, 1, h, 0.35); // drops running down
  fog(0xffffff, wx + 3, top + 8, 6, 2, 0.5);
  // plank door, a fogged porthole, a towel on its hook
  r(OUTLINE, door + 6, top + 4, 20, 28);
  r(SAUNA.pineLo, door + 7, top + 5, 18, 27);
  for (let x = door + 10; x < door + 25; x += 4) r(SAUNA.dark, x, top + 5, 1, 27, 0.6);
  r(OUTLINE, door + 12, top + 8, 8, 8);
  r(SAUNA.steam, door + 13, top + 9, 6, 6, 0.85);
  r(SAUNA.dark, door + 22, top + 18, 2, 2); // handle
  r(SAUNA.iron, door + 9, top + 18, 2, 1); // hook and towel
  r(0xf4f4f0, door + 8, top + 19, 5, 9);
  r(0x3fc6e0, door + 8, top + 25, 5, 1);
  r(SAUNA.pineHi, door + 3, front - 5, 26, 2); // step
  // the lantern east of the door, and its warm light
  const lx = door + 32;
  r(SAUNA.iron, lx - 1, top + 5, 6, 1);
  r(SAUNA.iron, lx + 1, top + 5, 1, 3);
  r(OUTLINE, lx - 2, top + 8, 7, 11);
  r(SAUNA.light, lx - 1, top + 10, 5, 7);
  r(0xfff6d0, lx, top + 12, 3, 3);
  r(SAUNA.iron, lx - 3, top + 8, 9, 2);
  const glow = s.add
    .ellipse(lx + 1, top + 14, 28, 22, SAUNA.light, lanternGlow(0, reduced))
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(front + 0.04);
  // a stack of firewood at the east end
  for (let row = 0; row < 3; row++)
    for (let x = lx + 8 + (row % 2) * 3; x + 6 <= b.x + b.w - 3; x += 7) {
      const y = front - 9 - row * 6;
      r(OUTLINE, x, y, 6, 6);
      r(SAUNA.pineHi, x + 1, y + 1, 4, 4);
      r(SAUNA.pineLo, x + 2, y + 2, 2, 2);
    }
  kit.windowGlow(b, SAUNA.light, 0.08);

  // shingle roof over the tiles and a stove pipe (they fade with the roof)
  const rh = b.h - FACADE_H + ROOF_OVERHANG;
  const roofG = s.add.graphics();
  const q: Paint = (c, x, y, w, h, a = 1) => {
    roofG.fillStyle(c, a).fillRect(x, y, w, h);
  };
  q(SAUNA.shingle, 0, 0, b.w, rh);
  for (let y = 2, k = 0; y < rh - 2; y += 5, k++)
    for (let x = (k % 2) * 4; x + 7 <= b.w; x += 8) {
      q(SAUNA.shingleHi, x, y, 7, 3);
      q(SAUNA.dark, x, y + 3, 7, 1, 0.6);
    }
  q(SAUNA.dark, 0, rh - 4, b.w, 4);
  const px = b.w - 34;
  q(OUTLINE, px - 1, 14, 10, 26);
  q(0x6d6a72, px, 15, 8, 25);
  q(0x8a8890, px, 15, 3, 25);
  q(OUTLINE, px - 3, 12, 14, 4);
  roofParts.push(s.add.container(b.x, b.y - ROOF_OVERHANG, [roofG]).setDepth(DEPTH.roof + 0.1));
  const spec = steamSpec(reduced);
  if (spec)
    s.add
      .particles(b.x + px + 4, b.y - ROOF_OVERHANG + 10, 'px', { ...spec, tint: [0xffffff, 0xeef4f6, 0xd8e4ea] })
      .setDepth(DEPTH.roof + 0.6);

  // the wooden board on the roof edge
  const board = s.add.graphics();
  const p: Paint = (c, x, y, w, h, a = 1) => {
    board.fillStyle(c, a).fillRect(x, y, w, h);
  };
  const bw = 124;
  p(OUTLINE, -bw / 2 - 2, -9, bw + 4, 18);
  p(SAUNA.dark, -bw / 2, -7, bw, 14);
  p(SAUNA.pineHi, -bw / 2 + 2, -5, bw - 4, 10);
  p(SAUNA.pine, -bw / 2 + 2, 2, bw - 4, 3);
  const text = s.add.text(0, 0, SAUNA_SIGN, { fontFamily: 'monospace', fontSize: '8px', color: '#3a1f0e' }).setOrigin(0.5);
  roofParts.push(s.add.container(b.x + b.w / 2, top - 9, [board, text]).setDepth(DEPTH.roof + 0.5));

  return {
    update(timeMs) {
      glow.setFillStyle(SAUNA.light, lanternGlow(timeMs, reduced));
      people.forEach((g, k) => g.setX(wx + 9 + k * 14 + silhouetteDrift(timeMs, k, reduced)));
    },
  };
}
