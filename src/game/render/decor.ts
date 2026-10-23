import Phaser from 'phaser';
import type { DecorDef, Rect } from '../../sim/map/district';
import { CONFIG } from '../../sim/config';
import { DEPTH } from './depth';
import { queueBob, queueSlots, signGlow, smokeSpec } from './decorMath';
import { FACADE_H } from './geometry';

const T = CONFIG.tile;
const OUTLINE = 0x14121c;
/** Roofs overhang the street behind the building (as WorldView's). */
const ROOF_OVERHANG = 24;

/** Fills a pixel rect (colour, x, y, w, h, alpha). */
export type Paint = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;
/** Something that fades with its roof while Paul's feet are under it. */
export type RoofPart = { setAlpha(a: number): unknown };

/** What a decor front borrows from WorldView: its front-wall painter, roof sign plate and sidewalk glow. */
export interface FrontKit {
  frontPainter(b: Rect): { g: Phaser.GameObjects.Graphics; r: Paint; top: number; front: number };
  roofSign(
    b: Rect,
    roofParts: RoofPart[],
    o: { w: number; rim: number; plate: number; label: string; color: string; textX: number; icon: (p: Paint) => void },
  ): unknown[];
  windowGlow(b: Rect, colour: number, alpha: number): Phaser.GameObjects.Ellipse;
}

/** The animated bits of a decor front (queue bob, sign pulse), stepped by WorldView.update. */
export interface DecorAnim {
  update(timeMs: number): void;
}

/** CAF colours: sober pale stone, aluminium frames, cool glass, a slate-blue sign. */
const CAF = {
  stone: 0xe4dccb,
  stoneHi: 0xf2ece0,
  stoneLo: 0xb8ad94,
  alu: 0xc8ccd4,
  aluLo: 0x8a909a,
  glass: 0x8fb4c8,
  glassHi: 0xd8ecf4,
  inside: 0x5a6e80,
  plate: 0x2f4a6a,
} as const;

/** POULET CROUSTI colours: tomato red, mustard yellow, warm lit inside, crispy golden chicken. */
const POULET = {
  red: 0xd8342c,
  redLo: 0x9a2420,
  yellow: 0xffc21f,
  yellowHi: 0xffe27a,
  light: 0xffd27a,
  steel: 0xc8ccd4,
  steelLo: 0x7c818a,
  crust: 0xc8742a,
  crustHi: 0xe8a04a,
  crustLo: 0x8a4a1a,
  bone: 0xf4ecd8,
  boneLo: 0xc8bea8,
} as const;

/** A queued person's look: skin, hair, top, trousers, shoes; `kid` is shorter. */
interface Look {
  skin: number;
  hair: number;
  top: number;
  legs: number;
  shoes: number;
  kid?: boolean;
  extra?: 'bag' | 'phone' | 'cane' | 'cap';
}
const LOOKS: Look[] = [
  { skin: 0xf0c8a0, hair: 0x3a2418, top: 0x3a6aa8, legs: 0x2a2f4a, shoes: 0x14121c, extra: 'bag' },
  { skin: 0x8a5a3a, hair: 0x14121c, top: 0xd87a3a, legs: 0x4a4650, shoes: 0x3a2418, extra: 'phone' },
  { skin: 0xf4d8b8, hair: 0xd8d4cc, top: 0x6a8a5a, legs: 0x5a4a3a, shoes: 0x14121c, extra: 'cane' },
  { skin: 0xc89870, hair: 0x6a3f22, top: 0xd8b84a, legs: 0x3a5a8a, shoes: 0xf4f4f0, kid: true, extra: 'cap' },
  { skin: 0xe0b088, hair: 0x8a5a34, top: 0x8a3a5a, legs: 0x2a2f4a, shoes: 0x14121c },
];

/**
 * A queued pixel person standing on the foot of the wall (feet at `y`, centred on `x`), side view facing `dir`
 * (-1 west, +1 east), drawn in its own Graphics so it can bob.
 */
function person(scene: Phaser.Scene, x: number, y: number, look: Look, dir: 1 | -1, depth: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const r: Paint = (c, px, py, w, h, a = 1) => {
    g.fillStyle(c, a).fillRect(px, py, w, h);
  };
  // mirror a rect given from the west-facing left edge `dx` (relative to x)
  const m = (c: number, dx: number, dy: number, w: number, h: number, a = 1): void =>
    r(c, dir === -1 ? x + dx : x - dx - w, y + dy, w, h, a);
  const s = look.kid ? 6 : 0; // a kid is 6 px shorter (shorter legs and torso)
  // shadow
  r(0x000000, x - 5, y - 1, 10, 2, 0.25);
  // legs and shoes
  m(OUTLINE, -3, -9 + s / 2, 7, 9 - s / 2);
  m(look.legs, -2, -9 + s / 2, 5, 8 - s / 2);
  m(OUTLINE, 0, -6 + s / 2, 1, 5 - s / 2);
  m(look.shoes, -3, -1, 3, 1);
  m(look.shoes, 0, -1, 3, 1);
  // torso and arm
  const ty = -18 + s;
  m(OUTLINE, -4, ty, 9, 10 - s / 2);
  m(look.top, -3, ty + 1, 7, 8 - s / 2);
  m(0x000000, 0, ty + 2, 2, 6 - s / 2, 0.3); // arm in shade
  // head: face toward `dir`, hair at the back
  const hy = ty - 8;
  m(OUTLINE, -3, hy, 7, 8);
  m(look.skin, -2, hy + 1, 5, 6);
  m(look.hair, -2, hy + 1, 5, 2);
  m(look.hair, 1, hy + 1, 2, 4);
  m(OUTLINE, -2, hy + 3, 1, 1); // eye
  if (look.extra === 'cap') {
    m(0xd23b3b, -2, hy, 5, 2);
    m(0xd23b3b, -4, hy + 1, 2, 1); // visor
  } else if (look.extra === 'bag') {
    m(OUTLINE, 2, ty + 3, 5, 6);
    m(0x8a5a3a, 3, ty + 4, 3, 4);
  } else if (look.extra === 'phone') {
    m(OUTLINE, -5, ty + 2, 3, 4);
    m(0x9fe8ff, -4, ty + 3, 1, 2);
  } else if (look.extra === 'cane') {
    m(0x6a3f22, -5, ty + 4, 1, 18 - s - 4);
    m(0x6a3f22, -5, ty + 3, 2, 1);
  }
  return g;
}

/** A row of queued people facing the door, bobbing gently (still under reduced motion). */
function queue(scene: Phaser.Scene, xs: number[], y: number, dir: 1 | -1, depth: number, reduced: boolean): DecorAnim {
  const people = xs.map((x, k) => person(scene, x, y, LOOKS[k % LOOKS.length]!, dir, depth + k * 0.001));
  return {
    update(timeMs) {
      people.forEach((g, k) => g.setY(queueBob(timeMs, k, reduced)));
    },
  };
}

/** Left edge (px) of a decor's door tile. */
const doorX = (d: DecorDef): number => Math.floor(d.door.x / T) * T;

/**
 * « CAF »: a sober pale-stone office front (ashlar joints, cornice), two small frosted windows, a wide glazed counter
 * window with a clerk behind the hygiaphone and a stone ledge, an aluminium glass door, a notice board, a small queue
 * of people waiting outside along the wall, and a slate-blue « CAF » plate with a folder icon on the roof edge.
 */
export function buildCafFront(kit: FrontKit, scene: Phaser.Scene, d: DecorDef, roofParts: RoofPart[], reduced: boolean): DecorAnim {
  const b = d.footprint;
  const { r, top, front } = kit.frontPainter(b);
  const door = doorX(d);
  // pale stone over the tiles: courses and staggered joints, cornice and plinth
  r(CAF.stone, b.x, top, b.w, FACADE_H - 3, 0.92);
  for (let k = 0; k < 3; k++) {
    const y = top + 4 + k * 9;
    r(CAF.stoneLo, b.x, y, b.w, 1, 0.45);
    for (let x = b.x + (k % 2) * 8; x < b.x + b.w; x += 16) r(CAF.stoneLo, x, y + 1, 1, 8, 0.3);
  }
  r(CAF.stoneHi, b.x, top, b.w, 2);
  r(CAF.stoneLo, b.x, top + 2, b.w, 1);
  r(CAF.stoneLo, b.x, front - 6, b.w, 3, 0.8);
  // two small frosted windows on the left
  for (const x of [b.x + 8, b.x + 34]) {
    r(OUTLINE, x - 1, top + 6, 18, 15);
    r(CAF.alu, x, top + 7, 16, 13);
    r(CAF.glass, x + 1, top + 8, 14, 11);
    r(CAF.glassHi, x + 1, top + 8, 14, 3, 0.7);
    r(CAF.alu, x + 7, top + 8, 1, 11);
  }
  // the glazed counter window (« guichet ») between them and the door: a clerk, the hygiaphone, a stone ledge
  const gx = b.x + 60;
  const gw = door - 6 - gx;
  r(OUTLINE, gx - 1, top + 5, gw + 2, 21);
  r(CAF.alu, gx, top + 6, gw, 19);
  r(CAF.inside, gx + 2, top + 8, gw - 4, 15);
  r(0x46586a, gx + 2, top + 18, gw - 4, 5); // desk inside
  const cx = gx + Math.floor(gw / 2) - 4; // the clerk: head, shoulders, a file on the desk
  r(OUTLINE, cx, top + 9, 7, 7);
  r(0xe0b088, cx + 1, top + 10, 5, 5);
  r(0x3a2418, cx + 1, top + 10, 5, 2);
  r(0x2a3a5a, cx - 2, top + 15, 11, 4);
  r(0xf4f4f0, cx + 10, top + 17, 6, 2);
  r(CAF.glassHi, gx + 2, top + 8, gw - 4, 15, 0.22); // the pane over them
  r(CAF.glassHi, gx + 4, top + 9, 2, 8, 0.6);
  r(CAF.glassHi, gx + 8, top + 9, 1, 5, 0.6);
  r(CAF.aluLo, cx + 1, top + 13, 5, 1); // hygiaphone
  r(OUTLINE, gx - 3, top + 24, gw + 6, 4); // stone ledge
  r(CAF.stoneHi, gx - 2, top + 24, gw + 4, 2);
  r(0xf4f4f0, gx + 6, top + 22, 8, 2); // a form left on the ledge
  // aluminium glass door
  r(OUTLINE, door + 5, top + 4, 22, 28);
  r(CAF.alu, door + 6, top + 5, 20, 27);
  r(CAF.glass, door + 8, top + 7, 7, 24);
  r(CAF.glass, door + 17, top + 7, 7, 24);
  r(CAF.glassHi, door + 8, top + 7, 2, 10, 0.7);
  r(CAF.glassHi, door + 17, top + 7, 2, 10, 0.7);
  r(CAF.aluLo, door + 14, top + 17, 1, 5);
  r(CAF.aluLo, door + 17, top + 17, 1, 5);
  r(CAF.stoneHi, door + 2, front - 4, 28, 1); // threshold
  // a notice board at the right end
  const nx = b.x + b.w - 22;
  r(OUTLINE, nx - 1, top + 7, 16, 13);
  r(0x8a5a3a, nx, top + 8, 14, 11);
  r(0xf4f4f0, nx + 2, top + 9, 4, 5);
  r(0xffe27a, nx + 7, top + 10, 5, 4);
  r(0xbfe8ff, nx + 3, top + 15, 6, 3);
  kit.windowGlow(b, 0xe6f7ff, 0.05);
  kit.roofSign(b, roofParts, {
    w: 64,
    rim: CAF.stone,
    plate: CAF.plate,
    label: d.sign,
    color: '#f4ecd8',
    textX: 7,
    icon: (p) => {
      // a plain folder with a sheet sticking out
      const fx = -26;
      p(OUTLINE, fx - 1, -6, 14, 11);
      p(0xd8b84a, fx, -5, 12, 9);
      p(0xf4f4f0, fx + 2, -7, 8, 4);
      p(0xb8962e, fx, -5, 5, 1);
    },
  });
  // the queue along the wall east of the door, everyone facing the door
  const xs = queueSlots(door + 32, nx - 3, 5, 1, 2);
  return queue(scene, xs, front - 1, -1, front + 0.03, reduced);
}

/** A big golden drumstick lying on the roof (container-local px, about 46 × 26), the bone pointing east. */
function drumstick(p: Paint): void {
  // shadow on the roof, under the meat and the bone
  p(0x000000, 3, 24, 22, 3, 0.22);
  p(0x000000, 26, 16, 18, 2, 0.18);
  // meat: stepped oval, darker outline
  const rows: [number, number][] = [
    [6, 14],
    [3, 20],
    [1, 24],
    [0, 26],
    [0, 26],
    [0, 26],
    [1, 25],
    [2, 23],
    [4, 20],
    [7, 15],
  ];
  rows.forEach(([x, w], k) => {
    p(OUTLINE, x - 1, 2 + k * 2, w + 2, 2);
  });
  p(OUTLINE, 5, 0, 16, 2);
  p(OUTLINE, 6, 22, 16, 2);
  rows.forEach(([x, w], k) => {
    p(k < 3 ? POULET.crustHi : k > 7 ? POULET.crustLo : POULET.crust, x, 2 + k * 2, w, 2);
  });
  // crispy bits
  for (const [x, y] of [[6, 6], [12, 4], [18, 8], [9, 12], [16, 14], [5, 16], [21, 12], [13, 18]] as const) p(POULET.crustHi, x, y, 2, 1);
  for (const [x, y] of [[8, 9], [15, 10], [20, 17], [11, 15]] as const) p(POULET.crustLo, x, y, 1, 1);
  p(0xfff6d0, 6, 4, 4, 1, 0.8); // shine
  // the bone: shaft and two knobs
  p(OUTLINE, 24, 9, 16, 6);
  p(POULET.bone, 24, 10, 16, 4);
  p(POULET.boneLo, 24, 13, 16, 1);
  p(OUTLINE, 38, 5, 8, 7);
  p(OUTLINE, 38, 12, 8, 7);
  p(POULET.bone, 39, 6, 6, 5);
  p(POULET.bone, 39, 13, 6, 5);
  p(POULET.boneLo, 39, 17, 6, 1);
}

/**
 * « POULET CROUSTI »: a colourful fast-food front (tomato-red wall, mustard trim, a striped awning), a menu board, the
 * lit counter window with a cook at the fryer and a tray on the stainless counter, a red glass door, a seating window,
 * warm light on the sidewalk, a lit « POULET CROUSTI » sign on the roof edge (a soft pulse, steady under reduced
 * motion), a big pixel drumstick on the roof and fryer smoke rising from a chimney (none under reduced motion).
 */
export function buildPouletFront(kit: FrontKit, scene: Phaser.Scene, d: DecorDef, roofParts: RoofPart[], reduced: boolean): DecorAnim {
  const b = d.footprint;
  const { r, top, front } = kit.frontPainter(b);
  const door = doorX(d);
  // painted wall, mustard trim on top, a red-and-white tiled skirting
  r(POULET.red, b.x, top, b.w, FACADE_H - 3, 0.9);
  r(POULET.yellow, b.x, top, b.w, 3);
  r(POULET.yellowHi, b.x, top, b.w, 1);
  r(POULET.redLo, b.x, top + 3, b.w, 1);
  for (let x = b.x, k = 0; x < b.x + b.w; x += 4, k++) r(k % 2 ? 0xf4f4f0 : POULET.redLo, x, front - 6, 4, 3);
  // menu board on the left: dark slate, yellow lines, a drumstick, fries and a cup
  const mx = b.x + 6;
  r(OUTLINE, mx - 1, top + 6, 30, 20);
  r(0x2a1f1a, mx, top + 7, 28, 18);
  for (let k = 0; k < 3; k++) r(POULET.yellow, mx + 12, top + 10 + k * 5, 13, 1);
  r(POULET.crust, mx + 3, top + 9, 6, 4);
  r(POULET.bone, mx + 8, top + 10, 2, 2);
  r(POULET.red, mx + 3, top + 15, 5, 4);
  r(POULET.yellow, mx + 3, top + 14, 1, 1);
  r(POULET.yellow, mx + 5, top + 13, 1, 2);
  r(POULET.yellow, mx + 7, top + 14, 1, 1);
  r(0xf4f4f0, mx + 4, top + 20, 4, 4);
  r(POULET.red, mx + 6, top + 19, 1, 2);
  // the lit counter window: a cook in a white hat at the fryer, a tray, a cup and a bucket on the counter
  const wx = b.x + 40;
  const ww = door - 4 - wx;
  r(OUTLINE, wx - 1, top + 8, ww + 2, 18);
  r(POULET.light, wx, top + 9, ww, 16);
  r(0xe8b860, wx, top + 19, ww, 6); // back counter
  r(POULET.steelLo, wx + ww - 18, top + 15, 14, 5); // fryer
  r(POULET.steel, wx + ww - 17, top + 15, 12, 1);
  r(0xffe27a, wx + ww - 16, top + 13, 2, 2, 0.8);
  const kx = wx + ww - 30; // the cook
  r(OUTLINE, kx, top + 11, 7, 7);
  r(0xc89870, kx + 1, top + 12, 5, 5);
  r(0xf4f4f0, kx, top + 9, 7, 3);
  r(0xf4f4f0, kx - 1, top + 17, 9, 4);
  r(POULET.steel, wx - 3, top + 24, ww + 6, 3); // stainless counter
  r(POULET.steelLo, wx - 3, top + 26, ww + 6, 1);
  r(POULET.redLo, wx + 4, top + 22, 12, 2); // tray, a cup, a bucket
  r(POULET.crust, wx + 6, top + 21, 3, 1);
  r(0xf4f4f0, wx + 19, top + 19, 4, 5);
  r(POULET.red, wx + 19, top + 20, 4, 1);
  r(OUTLINE, wx + 26, top + 18, 7, 6);
  r(0xf4f4f0, wx + 27, top + 19, 5, 5);
  r(POULET.red, wx + 27, top + 20, 5, 1);
  r(POULET.red, wx + 27, top + 22, 5, 1);
  // striped awning over the counter, scalloped edge
  r(OUTLINE, wx - 3, top + 3, ww + 6, 6);
  for (let k = 0; k * 4 < ww + 4; k++) {
    const c = k % 2 ? 0xf4f4f0 : POULET.red;
    r(c, wx - 2 + k * 4, top + 4, 4, 4);
    if (k % 2 === 0) r(c, wx - 2 + k * 4, top + 8, 4, 1);
  }
  // red glass door with a push bar
  r(OUTLINE, door + 5, top + 5, 22, 27);
  r(POULET.red, door + 6, top + 6, 20, 26);
  r(0xbfe8ff, door + 9, top + 9, 14, 13);
  r(0xffffff, door + 10, top + 10, 3, 5, 0.7);
  r(POULET.yellow, door + 9, top + 23, 14, 2);
  // seating window on the right: a table and two stools, a poster of fries
  const sx = door + 36;
  const sw = b.x + b.w - 6 - sx;
  r(OUTLINE, sx - 1, top + 8, sw + 2, 18);
  r(POULET.light, sx, top + 9, sw, 16);
  r(POULET.red, sx + 4, top + 11, 9, 8); // poster
  r(POULET.yellow, sx + 6, top + 12, 1, 4);
  r(POULET.yellow, sx + 8, top + 11, 1, 5);
  r(POULET.yellow, sx + 10, top + 12, 1, 4);
  r(POULET.redLo, sx + 18, top + 18, 16, 2); // table
  r(POULET.steelLo, sx + 25, top + 20, 2, 5);
  r(POULET.yellow, sx + 14, top + 21, 4, 2);
  r(POULET.yellow, sx + 36, top + 21, 4, 2);
  r(0xffffff, sx + 2, top + 10, 2, 6, 0.5);
  kit.windowGlow(b, POULET.light, 0.14);

  // the lit sign on the roof edge, with a soft additive halo
  const signY = top - 10;
  const halo = scene.add
    .rectangle(b.x + b.w / 2, signY, 136, 30, POULET.yellow, signGlow(0, reduced))
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH.roof + 0.45);
  roofParts.push(halo);
  kit.roofSign(b, roofParts, {
    w: 120,
    rim: POULET.yellow,
    plate: POULET.red,
    label: d.sign,
    color: '#fff6d0',
    textX: 8,
    icon: (p) => {
      // a small drumstick
      const ix = -54;
      p(OUTLINE, ix - 1, -5, 10, 9);
      p(POULET.crust, ix, -4, 8, 7);
      p(POULET.crustHi, ix + 1, -4, 3, 2);
      p(POULET.bone, ix + 8, -1, 4, 2);
      p(POULET.bone, ix + 11, -2, 2, 4);
    },
  });

  // the roof: a big drumstick on a little stand, a chimney with fryer smoke
  const roofTop = b.y - ROOF_OVERHANG;
  const roofH = b.h - FACADE_H + ROOF_OVERHANG;
  const stick = scene.add.graphics();
  const q: Paint = (c, x, y, w, h, a = 1) => {
    stick.fillStyle(c, a).fillRect(x, y, w, h);
  };
  drumstick(q);
  // drawn ×2 like the props: a big drumstick (about 92 × 52 px) on the left of the roof
  const stickBox = scene.add
    .container(b.x + 20, roofTop + Math.floor(roofH / 2) - 52, [stick])
    .setScale(2)
    .setDepth(DEPTH.roof + 0.4);
  roofParts.push(stickBox);
  const chimney = scene.add.graphics();
  const c: Paint = (col, x, y, w, h, a = 1) => {
    chimney.fillStyle(col, a).fillRect(x, y, w, h);
  };
  c(0x000000, 2, 28, 14, 3, 0.25);
  c(OUTLINE, 0, 0, 14, 30);
  c(POULET.steel, 1, 1, 12, 29);
  c(POULET.steelLo, 9, 1, 4, 29);
  c(OUTLINE, -2, -4, 18, 5); // cap
  c(POULET.steelLo, -1, -3, 16, 3);
  c(0x2a2f3a, 2, 1, 10, 2);
  const chx = b.x + b.w - 46;
  const chy = roofTop + 34;
  const chimneyBox = scene.add.container(chx, chy, [chimney]).setDepth(DEPTH.roof + 0.4);
  roofParts.push(chimneyBox);
  const spec = smokeSpec(reduced);
  if (spec)
    scene.add
      .particles(chx + 7, chy - 4, 'px', {
        ...spec,
        tint: [0x9a968e, 0x7c7880, 0x6d6a72],
      })
      .setDepth(DEPTH.roof + 0.6);

  return {
    update(timeMs) {
      halo.setFillStyle(POULET.yellow, signGlow(timeMs, reduced));
    },
  };
}
