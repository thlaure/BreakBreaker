import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import type { DecorDef } from '../../sim/map/district';
import type { Vec } from '../../sim/types';
import type { FrontKit, Paint, RoofPart } from './decor';
import { DEPTH } from './depth';
import { FACADE_H, ROOF_OVERHANG } from './geometry';
import { BALCONY_HALF_W, chateauBalcony } from './squareMath';

const T = CONFIG.tile;
const OUTLINE = 0x14121c;

/** Château colours: pale ashlar, blue slate, oak gate, iron. */
const CHATEAU = {
  stone: 0xd2c8b4,
  stoneHi: 0xe8e0cc,
  stoneLo: 0x9a907c,
  slate: 0x3a4a66,
  slateHi: 0x566a8c,
  slateLo: 0x26324a,
  glass: 0x4a6a9a,
  glassHi: 0xbfe0f4,
  oak: 0x5a3418,
  oakHi: 0x7a4a24,
  iron: 0x2a2630,
  gold: 0xffd23f,
  curtain: 0xa82a3a,
} as const;

/** Corner tower width (px) and how far it sticks out past the footprint's side. */
const TOWER_W = 30;
const TOWER_OUT = 6;

/**
 * Draw depths around the balcony, so a figure (Task 4's President) can stand between the French window behind it and
 * the balustrade in front of it.
 */
export const BALCONY_DEPTH = { window: DEPTH.roof + 0.42, figure: DEPTH.roof + 0.45, rail: DEPTH.roof + 0.48 } as const;

/** What the château front hands back: the centre of its balcony floor (world px). */
export interface ChateauFront {
  balcony: Vec;
}

/** A Graphics at `depth` placed at (x, y), pushed among the roof parts (it fades with the roof), and its painter. */
function roofLayer(s: Phaser.Scene, roofParts: RoofPart[], x: number, y: number, depth: number): Paint {
  const gr = s.add.graphics();
  roofParts.push(s.add.container(x, y, [gr]).setDepth(depth));
  return (c, px, py, w, h, a = 1) => {
    gr.fillStyle(c, a).fillRect(px, py, w, h);
  };
}

/**
 * The château (decor, never attacked, no label): an ashlar front with mullioned windows and an arched oak gate studded
 * with iron, two round corner towers (arrow slits, battlements, pointed slate caps, the French flag on the west one), a
 * slate mansard roof with dormers behind a battlemented parapet, and a stone balcony over the gate facing the square,
 * with a curtained French window. Everything above the front wall fades with the roof. Returns the balcony anchor.
 */
export function buildChateauFront(kit: FrontKit, s: Phaser.Scene, d: DecorDef, roofParts: RoofPart[]): ChateauFront {
  const b = d.footprint;
  const { r, top, front } = kit.frontPainter(b);
  const door = Math.floor(d.door.x / T) * T;
  const balcony = chateauBalcony(b, door, T);
  // ashlar courses, a plinth, a moulded cornice
  r(CHATEAU.stone, b.x, top, b.w, FACADE_H - 3, 0.94);
  for (let k = 0; k < 3; k++) {
    const y = top + 5 + k * 8;
    r(CHATEAU.stoneLo, b.x, y, b.w, 1, 0.5);
    for (let x = b.x + (k % 2) * 8; x < b.x + b.w; x += 16) r(CHATEAU.stoneLo, x, y + 1, 1, 7, 0.35);
  }
  r(CHATEAU.stoneHi, b.x, top, b.w, 2);
  r(CHATEAU.stoneLo, b.x, top + 2, b.w, 1);
  r(CHATEAU.stoneLo, b.x, front - 6, b.w, 3, 0.85);
  // mullioned windows between the towers, the gate tile left free
  const inner = { x0: b.x + TOWER_W - TOWER_OUT + 4, x1: b.x + b.w - TOWER_W + TOWER_OUT - 4 };
  const windows = [b.x + 34, b.x + 62, door + 40, door + 68].filter(
    (x) => x >= inner.x0 && x + 16 <= inner.x1 && (x + 16 <= door || x >= door + T),
  );
  for (const x of windows) {
    r(OUTLINE, x - 1, top + 6, 18, 20);
    r(CHATEAU.stoneHi, x, top + 7, 16, 18);
    r(CHATEAU.glass, x + 2, top + 9, 12, 14);
    r(CHATEAU.stoneHi, x + 7, top + 9, 2, 14);
    r(CHATEAU.stoneHi, x + 2, top + 14, 12, 2);
    r(CHATEAU.glassHi, x + 3, top + 10, 2, 3, 0.7);
    r(CHATEAU.stoneLo, x - 2, top + 25, 20, 2);
  }
  // the arched oak gate studded with iron, a stone threshold
  r(OUTLINE, door + 4, top + 7, 24, 25);
  r(OUTLINE, door + 8, top + 5, 16, 2);
  r(CHATEAU.oak, door + 5, top + 8, 22, 24);
  r(CHATEAU.oak, door + 9, top + 6, 14, 2);
  for (let x = door + 7; x < door + 26; x += 3) r(CHATEAU.oakHi, x, top + 8, 1, 24, 0.5);
  r(OUTLINE, door + 16, top + 6, 1, 26);
  for (let y = top + 11; y < front - 3; y += 5) for (const x of [door + 8, door + 12, door + 20, door + 24]) r(CHATEAU.iron, x, y, 1, 1);
  r(CHATEAU.gold, door + 14, top + 20, 1, 2);
  r(CHATEAU.gold, door + 18, top + 20, 1, 2);
  r(CHATEAU.stoneHi, door + 2, front - 5, 28, 2);
  // stone brackets under the balcony slab, over the gate
  for (const x of [balcony.x - BALCONY_HALF_W + 4, balcony.x + BALCONY_HALF_W - 8]) {
    r(OUTLINE, x, top, 4, 5);
    r(CHATEAU.stoneHi, x + 1, top, 2, 4);
  }
  // the two round towers' lower shafts on the front wall
  for (const x of [b.x - TOWER_OUT, b.x + b.w - TOWER_W + TOWER_OUT]) {
    r(OUTLINE, x - 1, top - 1, TOWER_W + 2, FACADE_H + 1);
    shaft(r, x, top, FACADE_H);
    r(CHATEAU.stoneLo, x, front - 6, TOWER_W, 3);
    r(OUTLINE, x + TOWER_W / 2 - 1, top + 9, 2, 10); // arrow slit
  }

  roof(roofLayer(s, roofParts, b.x, b.y - ROOF_OVERHANG, DEPTH.roof + 0.1), b.w, b.h - FACADE_H + ROOF_OVERHANG, balcony.x - b.x);
  for (const [k, x] of [b.x - TOWER_OUT, b.x + b.w - TOWER_W + TOWER_OUT].entries())
    tower(roofLayer(s, roofParts, x, top, DEPTH.roof + 0.4), k === 0);
  frenchWindow(roofLayer(s, roofParts, balcony.x, balcony.y, BALCONY_DEPTH.window));
  balustrade(roofLayer(s, roofParts, balcony.x, balcony.y, BALCONY_DEPTH.rail));
  kit.windowGlow(b, 0xffd27a, 0.05);
  return { balcony };
}

/** A round tower's stone shaft, `h` px tall from `y` down: light on the west, shade on the east, courses. */
function shaft(r: Paint, x: number, y: number, h: number): void {
  r(CHATEAU.stone, x, y, TOWER_W, h);
  r(CHATEAU.stoneHi, x + 3, y, 6, h);
  r(CHATEAU.stoneLo, x + TOWER_W - 8, y, 8, h, 0.8);
  for (let k = 6; k < h; k += 8) r(CHATEAU.stoneLo, x, y + k, TOWER_W, 1, 0.45);
}

/** The roof (local px, `w` × `h`): slate mansard with a ridge, two dormers, two chimneys, a battlemented parapet open at the balcony. */
function roof(q: Paint, w: number, h: number, balconyX: number): void {
  q(CHATEAU.slateHi, 0, 0, w, h);
  q(CHATEAU.slate, 0, 0, w, Math.floor(h * 0.45));
  for (let y = 4, k = 0; y < h - 14; y += 6, k++)
    for (let x = (k % 2) * 5; x + 8 <= w; x += 10) q(y < h * 0.45 ? CHATEAU.slateLo : CHATEAU.slate, x, y, 8, 1, 0.8);
  q(CHATEAU.slateLo, 0, Math.floor(h * 0.45), w, 2); // break of the mansard
  q(0x7c8494, 0, 0, w, 3); // lead ridge
  for (const x of [26, w - 40]) {
    // chimneys
    q(OUTLINE, x - 1, 8, 14, 18);
    q(CHATEAU.stone, x, 9, 12, 17);
    q(CHATEAU.stoneLo, x + 8, 9, 4, 17);
    q(OUTLINE, x - 2, 6, 16, 3);
  }
  for (const x of [Math.floor(w * 0.28), Math.floor(w * 0.66)]) {
    if (Math.abs(x + 9 - balconyX) < BALCONY_HALF_W + 12) continue;
    // dormers on the lower slope
    q(OUTLINE, x - 1, h - 46, 20, 24);
    q(CHATEAU.stoneHi, x, h - 45, 18, 22);
    q(CHATEAU.glass, x + 4, h - 40, 10, 14);
    q(CHATEAU.stoneHi, x + 8, h - 40, 2, 14);
    q(OUTLINE, x - 3, h - 49, 24, 4);
    q(CHATEAU.slateLo, x - 2, h - 48, 22, 2);
  }
  // the parapet walk and its merlons along the front edge, open where the balcony juts out
  q(OUTLINE, 0, h - 9, w, 9);
  q(CHATEAU.stone, 0, h - 8, w, 7);
  q(CHATEAU.stoneHi, 0, h - 8, w, 1);
  for (let x = 2; x + 6 <= w; x += 11) {
    if (x + 6 > balconyX - BALCONY_HALF_W - 2 && x < balconyX + BALCONY_HALF_W + 2) continue;
    q(OUTLINE, x - 1, h - 16, 8, 8);
    q(CHATEAU.stone, x, h - 15, 6, 7);
    q(CHATEAU.stoneHi, x, h - 15, 2, 7);
  }
}

/** A corner tower above the front wall (local px, its base y 0): shaft, battlemented crown, pointed slate cap, maybe the flag. */
function tower(t: Paint, flag: boolean): void {
  const w = TOWER_W;
  t(OUTLINE, -1, -56, w + 2, 56);
  shaft(t, 0, -55, 55);
  t(OUTLINE, w / 2 - 1, -40, 2, 9); // arrow slit
  // crown: a corbelled ring and merlons
  t(OUTLINE, -4, -64, w + 8, 9);
  t(CHATEAU.stoneLo, -3, -63, w + 6, 7);
  t(CHATEAU.stoneHi, -3, -63, w + 6, 2);
  for (let x = -3; x + 5 <= w + 3; x += 8) {
    t(OUTLINE, x - 1, -71, 7, 8);
    t(CHATEAU.stone, x, -70, 5, 7);
  }
  // pointed slate cap
  const capH = 34;
  for (let k = 0; k < capH; k += 2) {
    const inset = Math.round((k / capH) * (w / 2 + 1)) - 2;
    t(OUTLINE, inset - 1, -66 - k - 2, w - inset * 2 + 2, 2);
    t(k % 4 === 0 ? CHATEAU.slate : CHATEAU.slateHi, inset, -66 - k - 2, w - inset * 2, 2);
  }
  t(CHATEAU.gold, w / 2 - 1, -66 - capH - 6, 2, 6); // finial
  if (!flag) return;
  // the French flag on a mast from the cap's tip
  const fy = -66 - capH - 26;
  t(0xd8d4cc, w / 2 - 1, fy, 2, 22);
  t(OUTLINE, w / 2 + 1, fy, 16, 11);
  t(0x2a4fb0, w / 2 + 1, fy + 1, 5, 9);
  t(0xffffff, w / 2 + 6, fy + 1, 5, 9);
  t(0xe0313c, w / 2 + 11, fy + 1, 5, 9);
}

/** The curtained French window behind the balcony (local px, the balcony floor centre at 0,0). */
function frenchWindow(t: Paint): void {
  t(OUTLINE, -12, -34, 24, 34);
  t(CHATEAU.stoneHi, -11, -33, 22, 33);
  t(OUTLINE, -9, -30, 18, 30);
  t(0x1d2230, -8, -29, 16, 29);
  t(CHATEAU.curtain, -8, -29, 4, 29);
  t(CHATEAU.curtain, 4, -29, 4, 29);
  t(CHATEAU.gold, -8, -29, 16, 2);
  t(CHATEAU.glassHi, -3, -26, 2, 6, 0.5);
  t(CHATEAU.stoneLo, -12, -36, 24, 3); // lintel
}

/** The balcony slab and its balustrade in front of whoever stands there (local px, floor centre at 0,0). */
function balustrade(t: Paint): void {
  const w = BALCONY_HALF_W;
  t(OUTLINE, -w - 1, -1, w * 2 + 2, 6);
  t(CHATEAU.stoneHi, -w, 0, w * 2, 2);
  t(CHATEAU.stoneLo, -w, 2, w * 2, 2);
  for (let x = -w + 1; x < w - 1; x += 4) {
    t(OUTLINE, x, -9, 3, 9);
    t(CHATEAU.stone, x + 1, -8, 1, 8);
  }
  t(OUTLINE, -w - 1, -12, w * 2 + 2, 4);
  t(CHATEAU.stoneHi, -w, -11, w * 2, 2);
}
