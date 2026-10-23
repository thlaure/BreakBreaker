import Phaser from 'phaser';
import type { Rect } from '../../sim/map/district';
import { SHOP, buildingDoorX } from './buildingFronts';
import type { Paint, RoofPart } from './decor';
import { DEPTH } from './depth';
import { FACADE_H, ROOF_OVERHANG } from './geometry';
import type { BuildingPart, WorldView } from './world';

/** Church colours: warm limestone, blue-grey slate, oak door, bright stained glass. */
const CHURCH = {
  stone: 0xdcd2bc,
  stoneHi: 0xeee6d4,
  stoneLo: 0xa89c84,
  slate: 0x3e4a5c,
  slateHi: 0x5a6a80,
  slateLo: 0x2a3240,
  lead: 0x6d7480,
  oak: 0x5a3418,
  oakHi: 0x7a4a24,
  iron: 0x2a2630,
  bronze: 0xc89a3a,
  bronzeLo: 0x8a6420,
  glass: [0xd23b3b, 0x3b5fd2, 0xffd23f, 0x3f9a5a, 0x7a5cff],
} as const;

/** Tower size (px): width, shaft height above the front wall, spire height. */
const TOWER = { w: 34, shaft: 70, spire: 44 } as const;

/** A lancet stained-glass window (12 × 22 px, `x` its left edge, `y` its top): stone frame, pointed head, coloured panes. */
function lancet(r: Paint, x: number, y: number, k: number): void {
  r(SHOP.outline, x - 1, y + 2, 14, 21);
  r(SHOP.outline, x + 2, y, 8, 2);
  r(CHURCH.stoneHi, x, y + 3, 12, 19);
  r(CHURCH.stoneHi, x + 3, y + 1, 6, 2);
  r(CHURCH.iron, x + 2, y + 4, 8, 17);
  r(CHURCH.iron, x + 4, y + 2, 4, 2);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 2; col++) r(CHURCH.glass[(row + col * 2 + k) % CHURCH.glass.length]!, x + 3 + col * 4, y + 5 + row * 4, 3, 3);
  r(CHURCH.glass[(k + 2) % CHURCH.glass.length]!, x + 5, y + 3, 2, 1);
  r(0xffffff, x + 3, y + 5, 1, 2, 0.6);
}

/**
 * The church (« Église »): limestone courses with buttresses, three lancet stained-glass windows, an arched oak door
 * with iron hinges up a stone step, a slate nave roof, a porch bell tower over the door (belfry with its bell, a round
 * window, a slate spire, a weathercock), and an « ÉGLISE » plate on the roof edge. Ruined (TargetView): the tower and
 * the windows swap for their wrecked art (parts named 'intact' / 'ruin'), the rest dims like any ruin.
 */
export function buildChurchFront(kit: WorldView, s: Phaser.Scene, b: Rect, roofParts: RoofPart[]): BuildingPart[] {
  const { g, r, top, front } = kit.frontPainter(b);
  const door = buildingDoorX(b, 'church');
  // limestone courses, staggered joints, a plinth
  r(CHURCH.stone, b.x, top, b.w, FACADE_H - 3, 0.92);
  for (let k = 0; k < 3; k++) {
    const y = top + 5 + k * 8;
    r(CHURCH.stoneLo, b.x, y, b.w, 1, 0.5);
    for (let x = b.x + 4 + (k % 2) * 6; x < b.x + b.w; x += 12) r(CHURCH.stoneLo, x, y + 1, 1, 7, 0.3);
  }
  r(CHURCH.stoneHi, b.x, top, b.w, 2);
  r(CHURCH.stoneLo, b.x, front - 6, b.w, 3, 0.85);
  // buttresses at both ends and either side of the door
  for (const x of [b.x, door - 4, door + 32, b.x + b.w - 6]) {
    r(SHOP.outline, x, top + 2, 6, FACADE_H - 5, 0.4);
    r(CHURCH.stoneHi, x + 1, top + 2, 4, FACADE_H - 5);
    r(CHURCH.stoneLo, x + 4, top + 2, 1, FACADE_H - 5);
    r(CHURCH.stoneLo, x, top + 14, 6, 1);
  }
  // stained-glass windows between the buttresses, the door tile left free
  const windows = [b.x + 14, b.x + 38, door + 44, door + 68].filter(
    (x) => x >= b.x + 8 && x + 13 <= b.x + b.w - 6 && (x + 13 < door - 4 || x > door + 38),
  );
  windows.forEach((x, k) => lancet(r, x, top + 5, k));
  // arched oak door, iron hinges, a stone step
  r(SHOP.outline, door + 6, top + 6, 20, 25);
  r(SHOP.outline, door + 9, top + 3, 14, 3);
  r(CHURCH.oak, door + 7, top + 7, 18, 24);
  r(CHURCH.oak, door + 10, top + 4, 12, 3);
  for (let x = door + 9; x < door + 24; x += 3) r(CHURCH.oakHi, x, top + 7, 1, 24, 0.6);
  r(SHOP.outline, door + 16, top + 5, 1, 26);
  for (const y of [top + 11, top + 22]) {
    r(CHURCH.iron, door + 8, y, 7, 2);
    r(CHURCH.iron, door + 18, y, 7, 2);
  }
  r(CHURCH.bronze, door + 14, top + 17, 1, 2);
  r(CHURCH.bronze, door + 18, top + 17, 1, 2);
  r(CHURCH.stoneHi, door + 3, front - 5, 26, 2);
  r(CHURCH.stoneLo, door + 3, front - 3, 26, 1);
  const glow = kit.windowGlow(b, 0xffd27a, 0.07);

  // ruined front: the stained glass smashed (dark holes with shards), the door hanging, cracks
  const wreck = s.add
    .graphics()
    .setDepth(front + 0.03)
    .setName('ruin')
    .setVisible(false);
  const w: Paint = (c, x, y, ww, h, a = 1) => {
    wreck.fillStyle(c, a).fillRect(x, y, ww, h);
  };
  for (const x of windows) {
    w(0x0c0b10, x + 2, top + 9, 8, 17);
    w(CHURCH.glass[0], x + 2, top + 22, 3, 2);
    w(CHURCH.glass[1], x + 7, top + 12, 2, 3);
    w(CHURCH.glass[2], x + 3, top + 10, 2, 2);
  }
  w(0x0c0b10, door + 7, top + 7, 18, 24);
  for (let k = 0; k < 6; k++) w(CHURCH.oak, door + 17 + k, top + 9 + k * 3, 6, 4);
  for (const [x, y] of [
    [b.x + 8, top + 3],
    [b.x + b.w - 20, top + 6],
  ] as const)
    for (let k = 0; k < 5; k++) w(SHOP.outline, x + (k % 2) + Math.floor(k / 2), y + k * 3, 1, 3);

  // the slate nave roof over the tiles (fades with the roof): two pitches, a lead ridge, rows of scalloped slates
  const nave = s.add.graphics();
  const q: Paint = (c, x, y, ww, h, a = 1) => {
    nave.fillStyle(c, a).fillRect(x, y, ww, h);
  };
  const rh = b.h - FACADE_H + ROOF_OVERHANG;
  const half = b.w / 2;
  q(CHURCH.slateHi, 0, 0, half, rh);
  q(CHURCH.slate, half, 0, half, rh);
  for (let y = 4, k = 0; y < rh - 2; y += 6, k++)
    for (let x = (k % 2) * 4; x + 7 <= b.w; x += 8) {
      q(x < half ? CHURCH.slate : CHURCH.slateLo, x, y, 6, 1);
      q(x < half ? CHURCH.slate : CHURCH.slateLo, x + 6, y - 3, 1, 3, 0.7);
    }
  q(CHURCH.lead, half - 2, 0, 4, rh);
  q(CHURCH.slateLo, 0, rh - 4, b.w, 4);
  const naveBox = s.add.container(b.x, b.y - ROOF_OVERHANG, [nave]).setDepth(DEPTH.roof + 0.1);
  roofParts.push(naveBox);

  const sign = kit.roofSign(b, roofParts, {
    w: 80,
    rim: CHURCH.stoneHi,
    plate: CHURCH.slateLo,
    label: 'ÉGLISE',
    color: '#f4ecd8',
    textX: 8,
    icon: (p) => {
      // a little bronze bell
      const ix = -34;
      p(SHOP.outline, ix, -6, 10, 11);
      p(CHURCH.bronze, ix + 1, -5, 8, 8);
      p(CHURCH.bronzeLo, ix + 6, -5, 3, 8);
      p(CHURCH.bronze, ix - 1, 2, 12, 2);
      p(SHOP.outline, ix + 4, 4, 2, 2);
    },
  });

  // the porch bell tower over the door (fades with the roof), and its ruin
  const tower = s.add.graphics().setName('intact');
  buildTower(tower);
  const stump = s.add.graphics().setName('ruin').setVisible(false);
  buildStump(stump);
  const towerBox = s.add.container(door + 16 - TOWER.w / 2, top, [tower, stump]).setDepth(DEPTH.roof + 0.4);
  roofParts.push(towerBox);
  return [g, glow, wreck, nave, ...sign, tower, stump];
}

/** The standing bell tower, tower-local px (x 0..TOWER.w, its base y 0 on the front wall top, rising to negative y). */
function buildTower(gr: Phaser.GameObjects.Graphics): void {
  const t: Paint = (c, x, y, w, h, a = 1) => {
    gr.fillStyle(c, a).fillRect(x, y, w, h);
  };
  const { w, shaft, spire } = TOWER;
  // shaft in limestone, corner quoins, a round window
  t(SHOP.outline, -1, -shaft, w + 2, shaft);
  t(CHURCH.stone, 0, -shaft + 1, w, shaft - 1);
  t(CHURCH.stoneLo, w - 6, -shaft + 1, 6, shaft - 1, 0.6);
  for (let y = -shaft + 4; y < 0; y += 8) {
    t(CHURCH.stoneHi, 0, y, 4, 4);
    t(CHURCH.stoneLo, w - 4, y + 4, 4, 4);
  }
  t(SHOP.outline, w / 2 - 6, -24, 12, 12);
  t(CHURCH.stoneHi, w / 2 - 5, -23, 10, 10);
  t(CHURCH.glass[1], w / 2 - 4, -22, 8, 8);
  t(CHURCH.glass[0], w / 2 - 1, -22, 2, 8);
  t(CHURCH.glass[0], w / 2 - 4, -19, 8, 2);
  t(CHURCH.glass[2], w / 2 - 1, -19, 2, 2);
  // belfry: two arched openings, the bell in the dark, louvres
  t(CHURCH.stoneLo, 0, -shaft + 30, w, 2);
  for (const ox of [5, w / 2 + 2]) {
    t(SHOP.outline, ox - 1, -shaft + 8, 12, 20);
    t(0x1d1a24, ox, -shaft + 10, 10, 18);
    t(0x1d1a24, ox + 2, -shaft + 9, 6, 1);
    for (let y = -shaft + 20; y < -shaft + 28; y += 3) t(CHURCH.oak, ox, y, 10, 1);
  }
  const bx = w / 2 - 6;
  t(CHURCH.bronzeLo, bx + 2, -shaft + 11, 8, 2);
  t(CHURCH.bronze, bx + 1, -shaft + 13, 10, 6);
  t(CHURCH.bronze, bx, -shaft + 18, 12, 2);
  t(CHURCH.bronzeLo, bx + 8, -shaft + 13, 3, 6);
  t(CHURCH.stoneHi, -2, -shaft, w + 4, 3); // cornice
  // slate spire: stepped pyramid, a ridge highlight
  for (let k = 0; k < spire; k += 2) {
    const inset = Math.round((k / spire) * (w / 2 - 1));
    t(SHOP.outline, inset - 1, -shaft - k - 2, w - inset * 2 + 2, 2);
    t(k % 4 === 0 ? CHURCH.slate : CHURCH.slateHi, inset, -shaft - k - 2, w - inset * 2, 2);
  }
  t(CHURCH.slateHi, w / 2 - 1, -shaft - spire, 1, spire, 0.7);
  // the weathercock on its rod
  const cx = w / 2;
  const cy = -shaft - spire;
  t(CHURCH.iron, cx - 1, cy - 12, 2, 12);
  t(CHURCH.iron, cx - 4, cy - 7, 8, 1);
  t(CHURCH.bronze, cx - 3, cy - 18, 7, 4); // body
  t(CHURCH.bronze, cx + 3, cy - 21, 2, 4); // head
  t(0xd23b3b, cx + 4, cy - 22, 1, 1); // comb
  t(CHURCH.bronze, cx + 5, cy - 20, 1, 1); // beak
  t(CHURCH.bronze, cx - 5, cy - 21, 2, 5); // tail
  t(CHURCH.bronzeLo, cx - 2, cy - 15, 5, 1);
}

/** The bell tower once ruined: a jagged stump, the bell fallen on the roof, slates scattered. */
function buildStump(gr: Phaser.GameObjects.Graphics): void {
  const u: Paint = (c, x, y, w, h, a = 1) => {
    gr.fillStyle(c, a).fillRect(x, y, w, h);
  };
  const { w } = TOWER;
  u(SHOP.outline, -1, -30, w + 2, 30);
  u(0x6a645a, 0, -29, w, 29);
  for (const [x, y, ww] of [
    [0, -38, 7],
    [9, -34, 6],
    [18, -42, 8],
    [27, -35, 7],
  ] as const) {
    u(SHOP.outline, x, y, ww, -y - 28);
    u(0x6a645a, x + 1, y + 1, ww - 2, -y - 29);
  }
  u(0x0c0b10, w / 2 - 5, -24, 10, 10);
  u(CHURCH.bronzeLo, w + 6, -10, 12, 7); // the bell on its side
  u(CHURCH.bronze, w + 7, -9, 9, 5);
  for (const [x, y] of [
    [-12, -8],
    [-6, -3],
    [w + 22, -5],
    [w + 2, -2],
  ] as const) {
    u(SHOP.outline, x, y, 6, 3);
    u(CHURCH.slate, x + 1, y + 1, 4, 1);
  }
}
