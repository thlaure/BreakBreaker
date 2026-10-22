import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT, type Rect } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { TILE } from '../assets';
import { DEPTH, inRect } from './depth';

const T = CONFIG.tile;
const N = DISTRICT.tiles;
/** Height of a building's front wall, drawn at the bottom of its footprint. */
export const FACADE_H = 32;
/** Roofs overhang the street behind the building so actors there are hidden (and the roof fades). */
const ROOF_OVERHANG = 24;
const ROOF_FADED = 0.35;

interface Roof {
  rect: Rect;
  parts: { setAlpha(a: number): unknown }[];
}

/**
 * A building part a target view dims or tints when the building is ruined: tile sprites are tinted, texts and pixel
 * art (graphics) fade, a `glow` (a lit window) goes dark; other rectangles stay.
 */
export type BuildingPart =
  | Phaser.GameObjects.TileSprite
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Ellipse;

/** Index in DISTRICT.buildings of the building under a footprint (-1 when none: a prop). */
export function buildingIndex(f: Rect): number {
  return DISTRICT.buildings.findIndex((b) => b.x === f.x && b.y === f.y && b.w === f.w && b.h === f.h);
}

/** Storefront colours of the retro video-game shop (original pixel art). */
const SHOP = {
  outline: 0x14121c,
  plate: 0x2a1f3d,
  neon: 0x3fc6e0,
  text: '#ffd23f',
  awning: [0xff4f6d, 0xffd23f, 0x3fc6e0, 0x7a5cff],
  window: 0xffd27a,
  door: 0x2a2f4a,
  glass: 0x6fa8c8,
} as const;

/** Fills a pixel rect (colour, x, y, w, h, alpha). */
type Paint = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;

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
const LIBRARY = { light: 0xffd27a, door: 0x2a5a3a } as const;
/** Prison colours: cold concrete, steel, dark cells behind the bars. */
const PRISON = {
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

/** Left edge (px) of the door tile of the building target of `kind` on `b` (its front centre when unknown). */
function buildingDoorX(b: Rect, kind: string): number {
  const d = DISTRICT.targets.find((t) => t.kind === kind)?.door;
  return d ? Math.floor(d.x / T) * T : b.x + Math.floor(b.w / 2 / T) * T;
}

/** Static district: ground tilemap, building fronts, roofs, trees. */
export class WorldView {
  readonly width = N * T;
  readonly height = N * T;
  private readonly roofs: Roof[] = [];
  /** Parts of each target building (school, shop, nursery, town hall, library) by building index, for its ruin look. */
  readonly buildingParts = new Map<number, BuildingPart[]>();

  constructor(private readonly scene: Phaser.Scene) {
    this.buildGround();
    DISTRICT.buildings.forEach((b, i) => this.buildBuilding(b, i));
    this.buildTrees();
  }

  /** Fades the roof / tree canopy whose rect contains Paul's feet. */
  update(feet: Vec): void {
    for (const r of this.roofs) {
      const a = inRect(feet, r.rect) ? ROOF_FADED : 1;
      for (const p of r.parts) p.setAlpha(a);
    }
  }

  private buildGround(): void {
    const near = (tx: number, ty: number, r: Rect, pad: number): boolean =>
      tx >= r.x / T - pad && tx < (r.x + r.w) / T + pad && ty >= r.y / T - pad && ty < (r.y + r.h) / T + pad;
    const data: number[][] = [];
    for (let ty = 0; ty < N; ty++) {
      const row: number[] = [];
      for (let tx = 0; tx < N; tx++) {
        const paved =
          DISTRICT.buildings.some((b) => near(tx, ty, b, 1)) ||
          near(tx, ty, DISTRICT.peacefulGroup.area, 1) ||
          DISTRICT.trunks.some((c) => Math.abs(c.x / T - 0.5 - tx) <= 1 && Math.abs(c.y / T - 0.5 - ty) <= 1);
        row.push(paved ? TILE.streets.sidewalk : TILE.streets.road);
      }
      data.push(row);
    }
    const map = this.scene.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const tiles = map.addTilesetImage('streets', 'streets', T, T, 0, 0);
    if (!tiles) throw new Error('streets tileset missing');
    map.createLayer(0, tiles, 0, 0)?.setDepth(DEPTH.ground);
  }

  private buildBuilding(b: Rect, i: number): void {
    const s = this.scene;
    const kind = DISTRICT.targets.find((t) => !t.prop && buildingIndex(t.footprint) === i)?.kind;
    const school = kind === 'school';
    // brick for the school and the library, stone for the town hall, a painted wall for the nursery
    const wall =
      school || kind === 'library'
        ? TILE.city.wallRed
        : kind === 'townHall' || kind === 'nursery' || kind === 'prison'
          ? TILE.city.wallGrey
          : i % 2 === 0
            ? TILE.city.wallGrey
            : TILE.city.wallRed;
    const front = b.y + b.h;
    const facade = s.add
      .tileSprite(b.x, front - FACADE_H, b.w / 2, FACADE_H / 2, 'city', wall)
      .setOrigin(0)
      .setScale(2)
      .setDepth(front);
    const base = s.add.rectangle(b.x, front - 3, b.w, 3, 0x1d1a24, 0.9).setOrigin(0).setDepth(front + 0.01);

    const rect: Rect = { x: b.x, y: b.y - ROOF_OVERHANG, w: b.w, h: b.h - FACADE_H + ROOF_OVERHANG };
    const roofFrame = school ? TILE.city.roofs[0] : TILE.city.roofs[1 + (i % 3)]!;
    const roof = s.add
      .tileSprite(rect.x, rect.y, rect.w / 2, rect.h / 2, 'city', roofFrame)
      .setOrigin(0)
      .setScale(2)
      .setDepth(DEPTH.roof);
    const eave = s.add.rectangle(rect.x, rect.y + rect.h - 4, rect.w, 4, 0x000000, 0.35).setOrigin(0).setDepth(DEPTH.roof);
    const parts: Roof['parts'] = [roof, eave];
    if (school) {
      const sign = s.add
        .text(b.x + b.w / 2, front - FACADE_H / 2, 'ÉCOLE', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#1d1a24',
          backgroundColor: '#f4ecd8',
          padding: { left: 3, right: 3, top: 3, bottom: 1 },
        })
        .setOrigin(0.5)
        .setDepth(front + 0.02);
      this.buildingParts.set(i, [facade, roof, base, sign]);
    } else if (kind === 'shop') this.buildingParts.set(i, [facade, roof, base, ...this.buildShopFront(b, parts)]);
    else if (kind === 'nursery') this.buildingParts.set(i, [facade, roof, base, ...this.buildNurseryFront(b, parts)]);
    else if (kind === 'townHall') this.buildingParts.set(i, [facade, roof, base, ...this.buildTownHallFront(b, parts)]);
    else if (kind === 'library') this.buildingParts.set(i, [facade, roof, base, ...this.buildLibraryFront(b, parts)]);
    else if (kind === 'prison') this.buildingParts.set(i, [facade, roof, base, ...this.buildPrisonFront(b, parts)]);
    this.roofs.push({ rect, parts });
  }

  /**
   * The retro video-game shop: lit shop windows with game boxes on shelves, a glazed door under a striped awning, and a
   * « JEUX RÉTRO » sign plate with a pixel joystick on the front edge of the roof (it fades with the roof, `roofParts`).
   */
  private buildShopFront(b: Rect, roofParts: Roof['parts']): BuildingPart[] {
    const s = this.scene;
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

    // sign plate on the front edge of the roof: pixel joystick + « JEUX RÉTRO »
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
    const text = s.add
      .text(8, 0, 'JEUX RÉTRO', { fontFamily: 'monospace', fontSize: '10px', color: SHOP.text })
      .setOrigin(0.5);
    const sign = s.add.container(cx, cy, [plate, text]).setDepth(DEPTH.roof + 0.5);
    roofParts.push(sign);
    return [g, glow, plate, text];
  }

  /** Pixel-art graphics on a building's front wall (depth just above the wall) and its `r(colour, x, y, w, h)` painter. */
  private frontPainter(b: Rect): { g: Phaser.GameObjects.Graphics; r: Paint; top: number; front: number } {
    const front = b.y + b.h;
    const g = this.scene.add.graphics().setDepth(front + 0.02);
    const r: Paint = (c, x, y, w, h, a = 1) => {
      g.fillStyle(c, a).fillRect(x, y, w, h);
    };
    return { g, r, top: front - FACADE_H, front };
  }

  /**
   * A sign plate on the front edge of a building's roof (it fades with the roof): an outlined plate of `w` px, a
   * pixel icon drawn by `icon` (plate-local coordinates, the plate centred on 0,0) and a label. Returns its parts.
   */
  private roofSign(
    b: Rect,
    roofParts: Roof['parts'],
    o: { w: number; rim: number; plate: number; label: string; color: string; textX: number; icon: (p: Paint) => void },
  ): BuildingPart[] {
    const s = this.scene;
    const plate = s.add.graphics();
    const p: Paint = (c, x, y, w, h, a = 1) => {
      plate.fillStyle(c, a).fillRect(x, y, w, h);
    };
    p(SHOP.outline, -o.w / 2 - 2, -10, o.w + 4, 20);
    p(o.rim, -o.w / 2, -8, o.w, 16);
    p(o.plate, -o.w / 2 + 2, -6, o.w - 4, 12);
    o.icon(p);
    const text = s.add.text(o.textX, 0, o.label, { fontFamily: 'monospace', fontSize: '10px', color: o.color }).setOrigin(0.5);
    const sign = s.add.container(b.x + b.w / 2, b.y + b.h - FACADE_H - 10, [plate, text]).setDepth(DEPTH.roof + 0.5);
    roofParts.push(sign);
    return [plate, text];
  }

  /** Warm light spilling from lit windows onto the sidewalk (goes dark on a ruin: named 'glow'). */
  private windowGlow(b: Rect, colour: number, alpha: number): Phaser.GameObjects.Ellipse {
    return this.scene.add
      .ellipse(b.x + b.w / 2, b.y + b.h + 6, b.w - 8, 14, colour, alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.decal + 1)
      .setName('glow');
  }

  /**
   * The nursery school (« École maternelle »): a painted, colourful low front with toy-block trim, round-cornered
   * windows in bright frames with children's drawings, a yellow door with a porthole, a white picket fence along the
   * wall, and a « MATERNELLE » sign with a smiling sun and three balloons on the roof edge.
   */
  private buildNurseryFront(b: Rect, roofParts: Roof['parts']): BuildingPart[] {
    const { g, r, top } = this.frontPainter(b);
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
    for (const [x0, x1] of [[b.x + 2, door], [door + 32, b.x + b.w - 2]] as const) {
      r(SHOP.outline, x0, top + 24, x1 - x0, 3);
      r(0xf4f4f0, x0, top + 25, x1 - x0, 1);
    }
    const glow = this.windowGlow(b, NURSERY.glass, 0.08);
    const sign = this.roofSign(b, roofParts, {
      w: 120,
      rim: 0xff4f6d,
      plate: 0xfff3d6,
      label: 'MATERNELLE',
      color: '#2a5aa8',
      textX: 4,
      icon: (p) => {
        // smiling sun on the left
        const sx = -52;
        for (const [dx, dy] of [[3, -7], [3, 6], [-3, 0], [10, 0], [-2, -6], [9, -6], [-2, 5], [9, 5]] as const)
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
  private buildTownHallFront(b: Rect, roofParts: Roof['parts']): BuildingPart[] {
    const { g, r, top, front } = this.frontPainter(b);
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
    const sign = this.roofSign(b, roofParts, {
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
  private buildLibraryFront(b: Rect, roofParts: Roof['parts']): BuildingPart[] {
    const { g, r, top } = this.frontPainter(b);
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
    const glow = this.windowGlow(b, LIBRARY.light, 0.1);
    const sign = this.roofSign(b, roofParts, {
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

  /**
   * The prison: a grey concrete wall under a coping of barbed wire, small barred cell windows, a riveted steel gate with
   * a barred hatch under a lamp, a « PRISON » sign with a barred window on the roof edge, and on the roof's front-left
   * corner a watchtower (concrete shaft, glazed cabin, searchlight) flying the French flag. Ruined (TargetView): the
   * parts named 'intact' (the tower) hide and the ones named 'ruin' show (the tower's stump, the gate burst open, bent
   * bars), the rest dims like any ruin.
   */
  private buildPrisonFront(b: Rect, roofParts: Roof['parts']): BuildingPart[] {
    const s = this.scene;
    const { g, r, top, front } = this.frontPainter(b);
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
    const windows = [b.x + 14, b.x + 42, b.x + 70, door + 40, door + 68].filter((x) => x + 14 <= b.x + b.w - 2 && (x + 12 <= door || x >= door + 32));
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
    const glow = this.windowGlow(b, 0xe6f7ff, 0.07);
    // ruined front: the gate burst open (the right leaf hanging), bars bent out of two windows, cracks
    const wreck = s.add.graphics().setDepth(front + 0.03).setName('ruin').setVisible(false);
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
    for (const [x, y] of [[b.x + 30, top + 4], [b.x + 130, top + 2], [b.x + 170, top + 10]] as const)
      for (let k = 0; k < 5; k++) w(SHOP.outline, x + (k % 2) + Math.floor(k / 2), y + k * 3, 1, 3);

    // a flat concrete roof over the tiles: slab seams, vents, a barred skylight over the cells (it fades with the roof)
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
    for (const [x, y] of [[132, 18], [160, 62], [140, 110]] as const) {
      q(SHOP.outline, x, y, 12, 10);
      q(PRISON.steelHi, x + 1, y + 1, 10, 8);
      q(PRISON.steel, x + 1, y + 6, 10, 3);
    }
    q(SHOP.outline, 64, 40, 52, 28);
    q(PRISON.cell, 66, 42, 48, 24);
    q(0x8fcfe8, 66, 42, 48, 24, 0.25);
    for (let x = 70; x < 114; x += 6) q(PRISON.bars, x, 42, 2, 24);
    const slabBox = s.add.container(b.x, ry, [slab]).setDepth(DEPTH.roof + 0.1);
    roofParts.push(slabBox);

    // roof sign: a barred window and « PRISON »
    const sign = this.roofSign(b, roofParts, {
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
    for (const [x, y, ww] of [[4, -26, 5], [10, -24, 4], [15, -28, 6]] as const) {
      u(SHOP.outline, x, y, ww, -y - 20);
      u(0x4a4650, x + 1, y + 1, ww - 2, -y - 21);
    }
    for (const [x, y] of [[26, -6], [32, -3], [-6, -4], [38, -8]] as const) {
      u(SHOP.outline, x, y, 6, 4);
      u(0x6d6a72, x + 1, y + 1, 4, 2);
    }
    u(0xd8d4cc, 24, -14, 22, 2); // the mast lying on the roof
    const towerBox = s.add.container(b.x + PRISON_TOWER.dx, top, [tower, stump]).setDepth(DEPTH.roof + 0.4);
    roofParts.push(towerBox);
    return [g, glow, wreck, slab, ...sign, tower, stump];
  }

  /**
   * Trees: the trunk tile is depth-sorted at its foot y (actors north of it pass behind), the foliage sits
   * above actors. Both fade like roofs while Paul's feet are inside the canopy rect, so Paul stays visible.
   */
  private buildTrees(): void {
    for (const t of DISTRICT.trunks) {
      const footY = t.y + 6;
      this.scene.add.ellipse(t.x, footY, 18, 6, 0x000000, 0.25).setDepth(DEPTH.decal);
      const trunk = this.scene.add
        .image(t.x, footY, 'city', TILE.city.treeTrunk)
        .setOrigin(0.5, 1)
        .setScale(2)
        .setDepth(footY);
      const foliage = this.scene.add
        .image(t.x, footY - 32, 'city', TILE.city.treeTop)
        .setOrigin(0.5, 1)
        .setScale(2)
        .setDepth(DEPTH.foliage);
      // canopy = foliage tile + upper part of the trunk tile (feet behind the trunk base stay sorted, not faded)
      const rect: Rect = { x: t.x - 16, y: footY - 96, w: 32, h: 96 - 8 };
      this.roofs.push({ rect, parts: [trunk, foliage] });
    }
  }
}

/** Heal stations: green cross + "Soins"; greyed once used (walking onto a charged one heals). */
export class StationsView {
  private readonly items: { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse }[] =
    [];

  constructor(scene: Phaser.Scene) {
    for (const pos of DISTRICT.stations) {
      const icon = scene.add.image(pos.x, pos.y, 'station').setDepth(pos.y);
      const label = scene.add
        .text(pos.x, pos.y + 12, 'Soins', { fontFamily: 'monospace', fontSize: '9px', color: '#e8ffe8', stroke: '#14121c', strokeThickness: 2 })
        .setOrigin(0.5, 0)
        .setDepth(pos.y + 0.1);
      const glow = scene.add.ellipse(pos.x, pos.y + 8, 30, 12, 0x5ee07a, 0.3).setDepth(pos.y - 1);
      this.items.push({ icon, label, glow });
    }
  }

  update(list: Snapshot['stations'], nowMs: number): void {
    list.forEach((st, i) => {
      const it = this.items[i];
      if (!it) return;
      it.icon.setTint(st.charged ? 0xffffff : 0x6a6a6a).setAlpha(st.charged ? 1 : 0.7);
      // Charged kits float and pulse so they read as pickups; used ones sit still.
      const phase = nowMs / 1000 + i;
      const bob = st.charged ? Math.round(2 * Math.sin(phase * 3)) : 0;
      it.icon.setY(st.pos.y - bob).setScale(st.charged ? 1 + 0.08 * (0.5 + 0.5 * Math.sin(phase * 4)) : 1);
      it.glow.setVisible(st.charged).setAlpha(0.15 + 0.3 * (0.5 + 0.5 * Math.sin(phase * 4)));
      it.label.setAlpha(st.charged ? 1 : 0.5);
    });
  }
}

/** A field heal blinks during its last seconds on the ground (faster in the very last one), like the special drops. */
const FIELD_HEAL_BLINK_SEC = 3;

/**
 * Small field heals: the station's heal kit at a smaller size, bobbing over a green glow, with a « +10 » tag; it
 * blinks during its last FIELD_HEAL_BLINK_SEC s on the ground.
 */
export class FieldHealView {
  private readonly items = new Map<
    number,
    { icon: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse }
  >();

  constructor(private readonly scene: Phaser.Scene) {}

  update(list: Snapshot['fieldHeals'], nowMs: number, simNow: number): void {
    const seen = new Set<number>();
    for (const h of list) {
      seen.add(h.id);
      let it = this.items.get(h.id);
      if (!it) {
        const glow = this.scene.add.ellipse(h.pos.x, h.pos.y + 6, 20, 8, 0x5ee07a, 0.3).setDepth(h.pos.y - 1);
        const icon = this.scene.add.image(h.pos.x, h.pos.y, 'station').setScale(0.625).setDepth(h.pos.y);
        const tag = this.scene.add
          .text(h.pos.x, h.pos.y - 10, `+${CONFIG.fieldHeal.amount}`, {
            fontFamily: 'monospace',
            fontSize: '8px',
            color: '#7bd88f',
            stroke: '#14121c',
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(h.pos.y + 0.1);
        it = { icon, tag, glow };
        this.items.set(h.id, it);
      }
      const phase = nowMs / 1000 + h.id;
      const bob = Math.round(2 * Math.sin(phase * 3));
      const pulse = 0.5 + 0.5 * Math.sin(phase * 4);
      it.icon.setY(h.pos.y - 2 - bob);
      it.tag.setY(h.pos.y - 10 - bob);
      it.glow.setAlpha(0.15 + 0.3 * pulse);
      const left = h.expiresAt - simNow;
      const off = left < FIELD_HEAL_BLINK_SEC && Math.floor(nowMs / (left < 1 ? 70 : 140)) % 2 === 0;
      it.icon.setAlpha(off ? 0.2 : 1);
      it.tag.setAlpha(off ? 0.2 : 1);
      if (off) it.glow.setAlpha(0.05);
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      it.icon.destroy();
      it.tag.destroy();
      it.glow.destroy();
      this.items.delete(id);
    }
  }
}

const TOOLBOX_POP_MS = 250;
/** Repair ring around Paul's body (radius, centre height above his feet). */
const RING_R = 20;
const RING_LIFT = 22;

/**
 * Toolboxes: ground pickups that float and pulse like the heal kits, a toolbox icon over Paul while he carries one,
 * and a ring around him that fills while he repairs a ruin (`progress / repairSec`).
 */
export class ToolboxView {
  private readonly items = new Map<
    number,
    { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse }
  >();
  private readonly carried: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private ringDrawn = false;
  private popUntil = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.carried = scene.add.image(0, 0, 'toolbox').setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.overlay - 1).setVisible(false);
    this.ring = scene.add.graphics().setDepth(DEPTH.overlay - 2);
  }

  /** Little scale pop of the carried icon on pickup. */
  picked(nowMs: number): void {
    this.popUntil = nowMs + TOOLBOX_POP_MS;
  }

  update(tb: Snapshot['toolboxes'], player: Snapshot['player'], nowMs: number): void {
    const seen = new Set<number>();
    for (const g of tb.ground) {
      seen.add(g.id);
      let it = this.items.get(g.id);
      if (!it) {
        const s = this.scene;
        it = {
          glow: s.add.ellipse(g.pos.x, g.pos.y + 9, 30, 12, 0xff8a3a, 0.3).setDepth(g.pos.y - 1),
          icon: s.add.image(g.pos.x, g.pos.y, 'toolbox').setScale(2).setDepth(g.pos.y),
          label: s.add
            .text(g.pos.x, g.pos.y + 13, 'Outils', {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#ffe2c8',
              stroke: '#14121c',
              strokeThickness: 2,
            })
            .setOrigin(0.5, 0)
            .setDepth(g.pos.y + 0.1),
        };
        this.items.set(g.id, it);
      }
      // same float / pulse as the heal kits
      const phase = nowMs / 1000 + g.id;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 4);
      it.icon.setY(g.pos.y - Math.round(2 * Math.sin(phase * 3))).setScale(2 * (1 + 0.08 * pulse));
      it.glow.setAlpha(0.15 + 0.3 * pulse);
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      it.icon.destroy();
      it.label.destroy();
      it.glow.destroy();
      this.items.delete(id);
    }

    const show = tb.carried && !player.ko;
    this.carried.setVisible(show);
    if (show) {
      const pop = nowMs < this.popUntil ? (this.popUntil - nowMs) / TOOLBOX_POP_MS : 0;
      const bob = Math.round(1.5 * Math.sin(nowMs / 220));
      this.carried.setPosition(Math.round(player.pos.x), Math.round(player.pos.y) - 56 - bob).setScale(2 + pop);
    }

    const frac = Math.min(1, tb.progress / CONFIG.kit.repairSec);
    if (frac <= 0 || player.ko) {
      if (this.ringDrawn) this.ring.clear();
      this.ringDrawn = false;
      return;
    }
    this.ringDrawn = true;
    const x = Math.round(player.pos.x);
    const y = Math.round(player.pos.y) - RING_LIFT;
    const start = -Math.PI / 2;
    this.ring
      .clear()
      .lineStyle(6, 0x14121c, 0.7)
      .strokeCircle(x, y, RING_R)
      .lineStyle(4, 0xffb03a, 1)
      .beginPath()
      .arc(x, y, RING_R, start, start + frac * Math.PI * 2)
      .strokePath();
  }
}

/** Small runtime textures (particles, rocks, station icon) – no extra image files needed. */
export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('px')) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
  g.generateTexture('px', 2, 2);
  g.clear();
  // station: white plate with green cross
  g.fillStyle(0x14121c, 1).fillRoundedRect(0, 0, 20, 20, 4);
  g.fillStyle(0xf4f4f0, 1).fillRoundedRect(1, 1, 18, 18, 3);
  g.fillStyle(0x23a84a, 1).fillRect(8, 4, 4, 12).fillRect(4, 8, 12, 4);
  g.generateTexture('station', 20, 20);
  g.destroy();
}

const ROCK_SHAPES: Record<'caillou' | 'pave' | 'brique', { w: number; h: number; color: number; round: boolean }> = {
  caillou: { w: 8, h: 7, color: 0x9a948c, round: true },
  pave: { w: 8, h: 8, color: 0x7d8290, round: false },
  brique: { w: 12, h: 6, color: 0xa4553a, round: false },
};

/** `rock_<kind>` (flying) and `rock_<kind>_o` (on the ground, 1-px white outline). */
export function makeRockTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('rock_caillou')) return;
  const g = scene.make.graphics({}, false);
  for (const [kind, s] of Object.entries(ROCK_SHAPES)) {
    for (const outlined of [false, true]) {
      g.clear();
      const o = outlined ? 1 : 0;
      const shape = (x: number, y: number, w: number, h: number): void => {
        if (s.round) g.fillEllipse(x + w / 2, y + h / 2, w, h);
        else g.fillRect(x, y, w, h);
      };
      if (outlined) {
        g.fillStyle(0xffffff, 1);
        shape(0, 0, s.w + 2, s.h + 2);
      }
      g.fillStyle(s.color, 1);
      shape(o, o, s.w, s.h);
      g.fillStyle(0x000000, 0.25).fillRect(o, o + s.h - 1, s.w, 1);
      g.generateTexture(`rock_${kind}${outlined ? '_o' : ''}`, s.w + 2 * o, s.h + 2 * o);
    }
  }
  g.destroy();
}
