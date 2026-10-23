import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT, type Rect } from '../../sim/map/district';
import type { RoofPart } from './decor';
import { DEPTH } from './depth';
import { FACADE_H } from './geometry';
import type { BuildingPart, WorldView } from './world';

const T = CONFIG.tile;

/** Storefront colours of the retro video-game shop (original pixel art). */
export const SHOP = {
  outline: 0x14121c,
  plate: 0x2a1f3d,
  neon: 0x3fc6e0,
  text: '#ffd23f',
  awning: [0xff4f6d, 0xffd23f, 0x3fc6e0, 0x7a5cff],
  window: 0xffd27a,
  door: 0x2a2f4a,
  glass: 0x6fa8c8,
} as const;

/** Nursery school colours: a peach wall, toy-block trim, bright window frames. */
const NURSERY = {
  paint: 0xffd9a0,
  blocks: [0xff4f6d, 0xffd23f, 0x3fc6e0, 0x5ee07a, 0x7a5cff],
  frames: [0x3fc6e0, 0xff4f6d, 0x5ee07a, 0xffd23f],
  glass: 0xbfe8ff,
} as const;
/** Town hall colours: pale stone, blue glass, dark oak. */
const TOWN = { stone: 0xe8e0cc, stoneLo: 0xb8ad94, glass: 0x4a6a9a, wood: 0x6a3f22, woodHi: 0x8a5a34 } as const;
/** Library colours: lamp-lit windows, green door. */
export const LIBRARY = { light: 0xffd27a, door: 0x2a5a3a } as const;

/** Left edge (px) of the door tile of the building target of `kind` on `b` (its front centre when unknown). */
export function buildingDoorX(b: Rect, kind: string): number {
  const d = DISTRICT.targets.find((t) => t.kind === kind)?.door;
  return d ? Math.floor(d.x / T) * T : b.x + Math.floor(b.w / 2 / T) * T;
}

/**
 * The retro video-game shop: lit shop windows with game boxes on shelves, a glazed door under a striped awning, and a
 * « MICRO RÉTRO » sign plate with a pixel joystick on the front edge of the roof (it fades with the roof, `roofParts`).
 */
export function buildShopFront(s: Phaser.Scene, b: Rect, roofParts: RoofPart[]): BuildingPart[] {
  const front = b.y + b.h;
  const top = front - FACADE_H;
  const g = s.add.graphics().setDepth(front + 0.02);
  const r = (c: number, x: number, y: number, w: number, h: number, a = 1): void => {
    g.fillStyle(c, a).fillRect(x, y, w, h);
  };
  // shop windows (left, wide; right, narrow): dark frame, warm light, shelves of little game boxes
  const boxes = [0xff4f6d, 0x3fc6e0, 0x7a5cff, 0x5ee07a, 0xffd23f];
  const windows: [number, number][] = [
    [b.x + 6, 52],
    [b.x + 102, 20],
  ];
  for (const [x, w] of windows) {
    r(SHOP.outline, x - 2, top + 6, w + 4, 22);
    r(SHOP.window, x, top + 8, w, 18);
    for (let row = 0; row < 2; row++) {
      r(0x8a5a3a, x, top + 16 + row * 8, w, 2);
      for (let k = 0; k * 6 + 4 <= w; k++) r(boxes[(k + row * 2) % boxes.length]!, x + 2 + k * 6, top + 10 + row * 8, 4, 6);
    }
  }
  // door under the awning (door tile)
  const dx = b.x + 70;
  r(SHOP.outline, dx - 2, top + 8, 24, 24);
  r(SHOP.door, dx, top + 10, 20, 22);
  r(SHOP.glass, dx + 2, top + 12, 16, 10);
  r(0xffd23f, dx + 15, top + 24, 2, 2);
  // striped awning, scalloped edge
  const ax = b.x + 62;
  const aw = 36;
  r(SHOP.outline, ax - 2, top + 0, aw + 4, 8);
  for (let k = 0; k * 4 < aw; k++) {
    const c = SHOP.awning[k % SHOP.awning.length]!;
    r(c, ax + k * 4, top + 2, 4, 4);
    if (k % 2 === 0) r(c, ax + k * 4, top + 6, 4, 2);
  }
  // warm light spilling from the windows onto the sidewalk
  const glow = s.add
    .ellipse(b.x + b.w / 2, front + 6, b.w - 8, 14, SHOP.window, 0.12)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH.decal + 1)
    .setName('glow');

  // sign plate on the front edge of the roof: pixel joystick + « MICRO RÉTRO »
  const cx = b.x + b.w / 2;
  const cy = top - 10;
  const pw = 100;
  const plate = s.add.graphics();
  const p = (c: number, x: number, y: number, w: number, h: number): void => {
    plate.fillStyle(c, 1).fillRect(x, y, w, h);
  };
  p(SHOP.outline, -pw / 2 - 2, -10, pw + 4, 20);
  p(SHOP.neon, -pw / 2, -8, pw, 16);
  p(SHOP.plate, -pw / 2 + 2, -6, pw - 4, 12);
  // joystick: base, stick, ball, button
  const jx = -pw / 2 + 6;
  p(SHOP.outline, jx, 0, 12, 5);
  p(0x6d6a72, jx + 1, 1, 10, 3);
  p(0xd8d4cc, jx + 5, -4, 2, 5);
  p(0xff4f6d, jx + 4, -6, 4, 3);
  p(0xffd23f, jx + 9, -1, 2, 1);
  const text = s.add.text(8, 0, 'MICRO RÉTRO', { fontFamily: 'monospace', fontSize: '10px', color: SHOP.text }).setOrigin(0.5);
  const sign = s.add.container(cx, cy, [plate, text]).setDepth(DEPTH.roof + 0.5);
  roofParts.push(sign);
  return [g, glow, plate, text];
}

/**
 * The nursery school (« École maternelle »): a painted, colourful low front with toy-block trim, round-cornered
 * windows in bright frames with children's drawings, a yellow door with a porthole, a white picket fence along the
 * wall, and a « MATERNELLE » sign with a smiling sun and three balloons on the roof edge.
 */
export function buildNurseryFront(kit: WorldView, b: Rect, roofParts: RoofPart[]): BuildingPart[] {
  const { g, r, top } = kit.frontPainter(b);
  const door = buildingDoorX(b, 'nursery');
  // painted wall over the tiles, toy-block trim along the top
  r(NURSERY.paint, b.x, top, b.w, FACADE_H - 3, 0.55);
  for (let k = 0; k * 8 < b.w; k++) r(NURSERY.blocks[k % NURSERY.blocks.length]!, b.x + k * 8, top, 8, 4);
  r(SHOP.outline, b.x, top + 4, b.w, 1, 0.6);
  // windows in bright frames, two on each side of the door
  const xs = [b.x + 10, b.x + 50, door + 40, door + 80].filter((x) => x + 26 <= b.x + b.w - 4);
  xs.forEach((x, k) => {
    r(SHOP.outline, x - 1, top + 7, 26, 15);
    r(NURSERY.frames[k % NURSERY.frames.length]!, x, top + 8, 24, 13);
    r(NURSERY.glass, x + 2, top + 10, 20, 9);
    r(0xffffff, x + 11, top + 10, 2, 9); // mullion
    // a child's drawing taped on the glass: a sun or a little house
    if (k % 2 === 0) {
      r(0xffd23f, x + 4, top + 12, 4, 4);
      r(0xff8a3a, x + 5, top + 11, 2, 1);
    } else {
      r(0xff4f6d, x + 15, top + 12, 5, 2);
      r(0xf4ecd8, x + 16, top + 14, 3, 3);
    }
  });
  // yellow door with a porthole
  r(SHOP.outline, door + 2, top + 7, 28, 25);
  r(0xffc21f, door + 4, top + 9, 24, 23);
  r(SHOP.outline, door + 11, top + 12, 10, 8);
  r(NURSERY.glass, door + 12, top + 13, 8, 6);
  r(0xff4f6d, door + 23, top + 21, 2, 2);
  // white picket fence along the wall, open in front of the door
  for (let x = b.x + 2; x + 4 <= b.x + b.w; x += 6) {
    if (x + 4 > door && x < door + 32) continue;
    r(SHOP.outline, x, top + 20, 4, 11);
    r(0xf4f4f0, x + 1, top + 21, 2, 9);
  }
  for (const [x0, x1] of [
    [b.x + 2, door],
    [door + 32, b.x + b.w - 2],
  ] as const) {
    r(SHOP.outline, x0, top + 24, x1 - x0, 3);
    r(0xf4f4f0, x0, top + 25, x1 - x0, 1);
  }
  const glow = kit.windowGlow(b, NURSERY.glass, 0.08);
  const sign = kit.roofSign(b, roofParts, {
    w: 120,
    rim: 0xff4f6d,
    plate: 0xfff3d6,
    label: 'MATERNELLE',
    color: '#2a5aa8',
    textX: 4,
    icon: (p) => {
      // smiling sun on the left
      const sx = -52;
      for (const [dx, dy] of [
        [3, -7],
        [3, 6],
        [-3, 0],
        [10, 0],
        [-2, -6],
        [9, -6],
        [-2, 5],
        [9, 5],
      ] as const)
        p(0xff8a3a, sx + dx, dy, 2, 1); // rays
      p(0xff8a3a, sx - 1, -5, 10, 10);
      p(0xffd23f, sx, -4, 8, 8);
      p(SHOP.outline, sx + 2, -2, 1, 1);
      p(SHOP.outline, sx + 5, -2, 1, 1);
      p(SHOP.outline, sx + 2, 1, 4, 1);
      // three balloons on strings above the right end of the plate
      const balloons: [number, number, number][] = [
        [42, -26, 0xff4f6d],
        [50, -30, 0x3fc6e0],
        [57, -24, 0x5ee07a],
      ];
      for (const [x, y, c] of balloons) {
        p(SHOP.outline, x - 1, y - 1, 8, 10);
        p(c, x, y, 6, 8);
        p(0xffffff, x + 1, y + 1, 2, 2);
        p(0xd8d4cc, x + 3, y + 9, 1, -y - 9 - 8);
      }
    },
  });
  return [g, glow, ...sign];
}

/**
 * The town hall (« Mairie »): pale stone pilasters, tall arched windows, a wooden double door up two steps, and on
 * the roof edge a « MAIRIE » pediment with a round clock and the French flag on its mast.
 */
export function buildTownHallFront(kit: WorldView, b: Rect, roofParts: RoofPart[]): BuildingPart[] {
  const { g, r, top, front } = kit.frontPainter(b);
  const door = buildingDoorX(b, 'townHall');
  // cornice and plinth in pale stone
  r(TOWN.stone, b.x, top, b.w, 3);
  r(TOWN.stoneLo, b.x, top + 3, b.w, 1);
  // pilasters every 32 px (not over the door), windows between them
  for (let x = b.x; x < b.x + b.w; x += 32) {
    if (x !== door) {
      r(SHOP.outline, x + 9, top + 7, 14, 21);
      r(0xf4ecd8, x + 10, top + 8, 12, 19);
      r(TOWN.glass, x + 11, top + 10, 10, 16);
      r(TOWN.glass, x + 12, top + 9, 8, 1); // arched head
      r(0xf4ecd8, x + 15, top + 10, 2, 16); // mullion
      r(0xf4ecd8, x + 11, top + 17, 10, 1); // transom
      r(0xe6f7ff, x + 12, top + 11, 2, 3); // glint
    }
    r(SHOP.outline, x, top + 4, 1, FACADE_H - 7, 0.5);
    r(TOWN.stone, x + 1, top + 4, 5, FACADE_H - 7);
    r(TOWN.stoneLo, x + 5, top + 4, 1, FACADE_H - 7);
    r(TOWN.stone, x, top + 4, 7, 2); // capital
  }
  // arched wooden double door, two steps
  r(SHOP.outline, door + 6, top + 6, 20, 24);
  r(TOWN.wood, door + 7, top + 8, 18, 22);
  r(TOWN.wood, door + 9, top + 7, 14, 1);
  r(SHOP.outline, door + 16, top + 8, 1, 22);
  r(TOWN.woodHi, door + 9, top + 11, 5, 7);
  r(TOWN.woodHi, door + 18, top + 11, 5, 7);
  r(0xffd23f, door + 14, top + 20, 1, 2);
  r(0xffd23f, door + 18, top + 20, 1, 2);
  r(TOWN.stone, door + 2, front - 5, 28, 2);
  r(TOWN.stoneLo, door + 2, front - 3, 28, 1);
  r(TOWN.stone, door + 4, front - 7, 24, 2);
  const sign = kit.roofSign(b, roofParts, {
    w: 84,
    rim: TOWN.stone,
    plate: 0x2a3a6a,
    label: 'MAIRIE',
    color: '#f4ecd8',
    textX: 0,
    icon: (p) => {
      // pediment over the plate, the clock in its middle
      for (let k = 0; k < 4; k++) p(TOWN.stone, -24 + k * 4, -14 - k * 2, 48 - k * 8, 2);
      p(SHOP.outline, -9, -30, 18, 18);
      p(0xd8a83a, -8, -29, 16, 16);
      p(0xffffff, -6, -27, 12, 12);
      p(SHOP.outline, 0, -26, 1, 5); // minute hand (12)
      p(SHOP.outline, 0, -22, 4, 1); // hour hand (3)
      p(SHOP.outline, -1, -22, 2, 2);
      // the French flag on a mast at the right end of the plate
      const fx = 44;
      p(0xd8d4cc, fx, -34, 2, 26);
      p(SHOP.outline, fx + 2, -34, 15, 10);
      p(0x2a4fb0, fx + 2, -33, 5, 8);
      p(0xffffff, fx + 7, -33, 5, 8);
      p(0xe0313c, fx + 12, -33, 5, 8);
    },
  });
  return [g, ...sign];
}

/**
 * The library (« Bibliothèque »): brick front with tall arched windows showing lit bookshelves, a green door under a
 * fanlight, and a « BIBLIOTHÈQUE » sign with an open book on the roof edge.
 */
export function buildLibraryFront(kit: WorldView, b: Rect, roofParts: RoofPart[]): BuildingPart[] {
  const { g, r, top } = kit.frontPainter(b);
  const door = buildingDoorX(b, 'library');
  r(0xd8cbb0, b.x, top, b.w, 3); // stone string course
  // tall windows (two per tile, the door tile left free): lit shelves of book spines
  const spines = [0xd23b3b, 0x3b7fd2, 0x3f9a5a, 0xffd23f, 0x7a5cff, 0xe08a2e];
  let k = 0;
  for (let x = b.x + 3; x + 12 <= b.x + b.w - 2; x += 16) {
    if (x + 12 > door && x < door + 32) continue;
    r(SHOP.outline, x - 1, top + 4, 14, 25);
    r(0xd8cbb0, x, top + 5, 12, 23);
    r(LIBRARY.light, x + 2, top + 7, 8, 20);
    r(LIBRARY.light, x + 3, top + 6, 6, 1); // arched head
    for (let row = 0; row < 3; row++) {
      const y = top + 9 + row * 6;
      for (let s = 0; s < 4; s++) r(spines[(s + row + k) % spines.length]!, x + 2 + s * 2, y, 2, 4);
      r(0x8a5a3a, x + 2, y + 4, 8, 1);
    }
    r(0xd8cbb0, x + 5, top + 7, 2, 20, 0.6); // mullion
    k++;
  }
  // green door under a fanlight
  r(SHOP.outline, door + 5, top + 4, 22, 28);
  r(LIBRARY.light, door + 7, top + 6, 18, 5);
  r(SHOP.outline, door + 11, top + 6, 1, 5);
  r(SHOP.outline, door + 16, top + 6, 1, 5);
  r(SHOP.outline, door + 21, top + 6, 1, 5);
  r(LIBRARY.door, door + 7, top + 12, 18, 20);
  r(0x3f7a52, door + 9, top + 14, 6, 6);
  r(0x3f7a52, door + 17, top + 14, 6, 6);
  r(0xffd23f, door + 15, top + 23, 2, 2);
  const glow = kit.windowGlow(b, LIBRARY.light, 0.1);
  const sign = kit.roofSign(b, roofParts, {
    w: 116,
    rim: 0x8a5a3a,
    plate: 0x3a2418,
    label: 'BIBLIOTHÈQUE',
    color: '#f4ecd8',
    textX: 8,
    icon: (p) => {
      // open book: two white pages in a red cover, lines of text
      const bx = -54;
      p(SHOP.outline, bx - 1, -6, 18, 12);
      p(0xd23b3b, bx, -5, 16, 10);
      p(0xf4f4f0, bx + 1, -5, 6, 8);
      p(0xf4f4f0, bx + 9, -5, 6, 8);
      p(SHOP.outline, bx + 7, -5, 2, 9);
      for (let l = 0; l < 3; l++) {
        p(0x6d6a72, bx + 2, -3 + l * 2, 4, 1);
        p(0x6d6a72, bx + 10, -3 + l * 2, 4, 1);
      }
    },
  });
  return [g, glow, ...sign];
}
