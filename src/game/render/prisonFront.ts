import Phaser from 'phaser';
import type { Rect } from '../../sim/map/district';
import { LIBRARY, SHOP, buildingDoorX } from './buildingFronts';
import type { Paint, RoofPart } from './decor';
import { DEPTH } from './depth';
import { FACADE_H, ROOF_OVERHANG } from './geometry';
import type { BuildingPart, WorldView } from './world';

/** Prison colours: cold concrete, steel, dark cells behind the bars. */
export const PRISON = {
  concrete: 0x7c818a,
  concreteHi: 0xa8adb6,
  concreteLo: 0x5a5e66,
  steel: 0x3a3f48,
  steelHi: 0x5c626c,
  bars: 0xc8ccd4,
  cell: 0x1d2230,
  lamp: 0xfff6d0,
} as const;
/** Where the prison's watchtower stands on its roof (left front corner) and its searchlight, from the building's x / front-wall top. */
export const PRISON_TOWER = { dx: 6, lampDx: 23, lampDy: -72 } as const;

/**
 * The prison: a grey concrete wall under a coping of barbed wire, small barred cell windows, a riveted steel gate with
 * a barred hatch under a lamp, roof vents around the exercise yard (drawn by PrisonLayer), a « PRISON » sign with a
 * barred window on the roof edge, and on the roof's front-left
 * corner a watchtower (concrete shaft, glazed cabin, searchlight) flying the French flag. Ruined (TargetView): the
 * parts named 'intact' (the tower) hide and the ones named 'ruin' show (the tower's stump, the gate burst open, bent
 * bars), the rest dims like any ruin.
 */
export function buildPrisonFront(kit: WorldView, s: Phaser.Scene, b: Rect, roofParts: RoofPart[]): BuildingPart[] {
  const { g, r, top, front } = kit.frontPainter(b);
  const door = buildingDoorX(b, 'prison');
  // concrete panels over the tiles, seams, coping with barbed wire
  r(PRISON.concrete, b.x, top, b.w, FACADE_H - 3, 0.75);
  for (let x = b.x + 24; x < b.x + b.w; x += 24) r(PRISON.concreteLo, x, top + 4, 1, FACADE_H - 7, 0.8);
  r(PRISON.concreteLo, b.x, top + 17, b.w, 1, 0.5);
  r(PRISON.concreteLo, b.x, top, b.w, 4);
  r(PRISON.concreteHi, b.x, top, b.w, 1);
  for (let x = b.x + 1; x + 4 <= b.x + b.w; x += 6) {
    // coils of wire along the coping: a loop, a barb
    r(PRISON.bars, x, top, 4, 1);
    r(PRISON.bars, x, top, 1, 3);
    r(PRISON.bars, x + 3, top, 1, 3);
    r(PRISON.bars, x + 1, top + 3, 2, 1);
    r(PRISON.bars, x + 5, top + 1, 1, 1);
  }
  // barred cell windows, a faint light inside, a sill under each
  const windows = [b.x + 14, b.x + 42, b.x + 70, door + 40, door + 68].filter(
    (x) => x + 14 <= b.x + b.w - 2 && (x + 12 <= door || x >= door + 32),
  );
  for (const x of windows) {
    r(SHOP.outline, x - 1, top + 7, 14, 12);
    r(PRISON.cell, x, top + 8, 12, 10);
    r(LIBRARY.light, x + 1, top + 14, 10, 4, 0.3);
    for (let k = 0; k < 4; k++) r(PRISON.bars, x + 1 + k * 3, top + 8, 1, 10);
    r(PRISON.concreteHi, x - 1, top + 19, 14, 1);
  }
  // the steel gate: riveted, a barred hatch, a lamp above
  r(SHOP.outline, door + 2, top + 4, 28, 28);
  r(PRISON.steel, door + 3, top + 5, 26, 27);
  r(PRISON.steelHi, door + 3, top + 5, 26, 1);
  r(SHOP.outline, door + 16, top + 5, 1, 27);
  for (let ry = top + 8; ry < front - 3; ry += 6) {
    r(PRISON.steelHi, door + 5, ry, 1, 1);
    r(PRISON.steelHi, door + 27, ry, 1, 1);
  }
  r(SHOP.outline, door + 9, top + 9, 14, 8);
  r(PRISON.cell, door + 10, top + 10, 12, 6);
  for (let k = 0; k < 4; k++) r(PRISON.bars, door + 11 + k * 3, top + 10, 1, 6);
  r(0xffd23f, door + 13, top + 22, 2, 2); // lock
  r(0xffd23f, door + 18, top + 22, 2, 2);
  r(SHOP.outline, door + 12, top - 1, 8, 4);
  r(PRISON.lamp, door + 13, top, 6, 2);
  const glow = kit.windowGlow(b, 0xe6f7ff, 0.07);
  // ruined front: the gate burst open (the right leaf hanging), bars bent out of two windows, cracks
  const wreck = s.add
    .graphics()
    .setDepth(front + 0.03)
    .setName('ruin')
    .setVisible(false);
  const w: Paint = (c, x, y, ww, h, a = 1) => {
    wreck.fillStyle(c, a).fillRect(x, y, ww, h);
  };
  w(0x0c0b10, door + 3, top + 5, 26, 27);
  w(PRISON.steel, door + 3, top + 5, 12, 27);
  for (let k = 0; k < 6; k++) w(PRISON.steel, door + 18 + k * 2, top + 10 + k * 3, 4, 6);
  for (const x of windows.slice(0, 2)) {
    w(PRISON.cell, x, top + 8, 12, 10);
    w(PRISON.bars, x + 1, top + 8, 1, 10);
    w(PRISON.bars, x + 5, top + 12, 1, 6);
    w(PRISON.bars, x + 6, top + 9, 3, 1);
    w(PRISON.bars, x + 9, top + 14, 3, 1);
  }
  for (const [x, y] of [
    [b.x + 30, top + 4],
    [b.x + 130, top + 2],
    [b.x + 170, top + 10],
  ] as const)
    for (let k = 0; k < 5; k++) w(SHOP.outline, x + (k % 2) + Math.floor(k / 2), y + k * 3, 1, 3);

  // a flat concrete roof over the tiles: slab seams, vents (it fades with the roof)
  const slab = s.add.graphics();
  const q: Paint = (c, x, y, ww, h, a = 1) => {
    slab.fillStyle(c, a).fillRect(x, y, ww, h);
  };
  const ry = b.y - ROOF_OVERHANG;
  const rh = b.h - FACADE_H + ROOF_OVERHANG;
  q(PRISON.concrete, 0, 0, b.w, rh, 0.85);
  q(PRISON.concreteHi, 0, 0, b.w, 2);
  q(PRISON.concreteLo, 0, rh - 6, b.w, 2);
  for (let x = 32; x < b.w; x += 32) q(PRISON.concreteLo, x, 2, 1, rh - 8, 0.6);
  for (let y = 40; y < rh - 8; y += 40) q(PRISON.concreteLo, 0, y, b.w, 1, 0.6);
  // vents clear of the exercise yard in the middle (PrisonLayer draws it and its inmates, prisonMath.YARD)
  for (const [x, y] of [
    [150, 16],
    [162, 62],
    [148, 112],
  ] as const) {
    q(SHOP.outline, x, y, 12, 10);
    q(PRISON.steelHi, x + 1, y + 1, 10, 8);
    q(PRISON.steel, x + 1, y + 6, 10, 3);
  }
  const slabBox = s.add.container(b.x, ry, [slab]).setDepth(DEPTH.roof + 0.1);
  roofParts.push(slabBox);

  // roof sign: a barred window and « PRISON »
  const sign = kit.roofSign(b, roofParts, {
    w: 96,
    rim: PRISON.concreteHi,
    plate: 0x2a2f3a,
    label: 'PRISON',
    color: '#f4ecd8',
    textX: 8,
    icon: (p) => {
      const ix = -42;
      p(SHOP.outline, ix - 1, -6, 14, 12);
      p(PRISON.cell, ix, -5, 12, 10);
      for (let k = 0; k < 4; k++) p(PRISON.bars, ix + 1 + k * 3, -5, 1, 10);
    },
  });

  // the watchtower on the roof's front-left corner, the flag on its cap (it fades with the roof)
  const tower = s.add.graphics().setName('intact');
  const t: Paint = (c, x, y, ww, h, a = 1) => {
    tower.fillStyle(c, a).fillRect(x, y, ww, h);
  };
  t(SHOP.outline, 4, -50, 18, 50);
  t(PRISON.concrete, 5, -49, 16, 49);
  t(PRISON.concreteLo, 16, -49, 5, 49);
  for (let y = -44; y < 0; y += 8) t(PRISON.concreteLo, 5, y, 11, 1, 0.7);
  t(SHOP.outline, 0, -66, 26, 18); // cabin
  t(PRISON.concreteHi, 1, -65, 24, 16);
  t(PRISON.cell, 3, -62, 20, 7);
  t(0x8fcfe8, 4, -61, 3, 2, 0.6);
  t(SHOP.outline, 9, -62, 1, 7);
  t(SHOP.outline, 16, -62, 1, 7);
  t(PRISON.concreteLo, 1, -53, 24, 2); // balcony rail
  t(SHOP.outline, -2, -72, 30, 6); // cap
  t(PRISON.steel, -1, -71, 28, 4);
  t(PRISON.steelHi, -1, -71, 28, 1);
  t(SHOP.outline, 20, -75, 7, 5); // searchlight
  t(PRISON.lamp, 21, -74, 5, 3);
  t(0xd8d4cc, 3, -98, 2, 26); // mast and the French flag
  t(SHOP.outline, 5, -98, 15, 10);
  t(0x2a4fb0, 5, -97, 5, 8);
  t(0xffffff, 10, -97, 5, 8);
  t(0xe0313c, 15, -97, 5, 8);
  // its ruin: a broken stump, rubble on the roof, the mast down
  const stump = s.add.graphics().setName('ruin').setVisible(false);
  const u: Paint = (c, x, y, ww, h, a = 1) => {
    stump.fillStyle(c, a).fillRect(x, y, ww, h);
  };
  u(SHOP.outline, 4, -22, 18, 22);
  u(0x4a4650, 5, -21, 16, 21);
  for (const [x, y, ww] of [
    [4, -26, 5],
    [10, -24, 4],
    [15, -28, 6],
  ] as const) {
    u(SHOP.outline, x, y, ww, -y - 20);
    u(0x4a4650, x + 1, y + 1, ww - 2, -y - 21);
  }
  for (const [x, y] of [
    [26, -6],
    [32, -3],
    [-6, -4],
    [38, -8],
  ] as const) {
    u(SHOP.outline, x, y, 6, 4);
    u(0x6d6a72, x + 1, y + 1, 4, 2);
  }
  u(0xd8d4cc, 24, -14, 22, 2); // the mast lying on the roof
  const towerBox = s.add.container(b.x + PRISON_TOWER.dx, top, [tower, stump]).setDepth(DEPTH.roof + 0.4);
  roofParts.push(towerBox);
  return [g, glow, wreck, slab, ...sign, tower, stump];
}
