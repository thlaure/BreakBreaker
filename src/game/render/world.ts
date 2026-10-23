import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT, type Rect } from '../../sim/map/district';
import type { Vec } from '../../sim/types';
import { TILE } from '../assets';
import { SHOP, buildLibraryFront, buildNurseryFront, buildShopFront, buildTownHallFront } from './buildingFronts';
import { buildChurchFront } from './churchFront';
import { buildCafFront, buildPouletFront, type DecorAnim, type Paint } from './decor';
import { DEPTH, inRect } from './depth';
import { FACADE_H, ROOF_OVERHANG } from './geometry';
import { buildPrisonFront } from './prisonFront';

// Moved out of this file; re-exported so importers keep working.
export { FACADE_H, ROOF_OVERHANG };
export { PRISON, PRISON_TOWER } from './prisonFront';
export { FieldHealView, StationsView, ToolboxView } from './pickups';
export { makeRockTextures, makeTextures } from './textures';

const T = CONFIG.tile;
const N = DISTRICT.tiles;
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

/** Static district: ground tilemap, building fronts, roofs, trees. */
export class WorldView {
  readonly width = N * T;
  readonly height = N * T;
  private readonly roofs: Roof[] = [];
  /** Parts of each target building (school, shop, nursery, town hall, library) by building index, for its ruin look. */
  readonly buildingParts = new Map<number, BuildingPart[]>();
  /** Animated bits of the decor fronts (CAF queue, POULET CROUSTI sign). */
  private readonly decor: DecorAnim[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reducedMotion = false,
  ) {
    this.buildGround();
    DISTRICT.buildings.forEach((b, i) => this.buildBuilding(b, i));
    this.buildTrees();
  }

  /** Fades the roof / tree canopy whose rect contains Paul's feet; steps the decor fronts' idle animation. */
  update(feet: Vec, timeMs = 0): void {
    for (const d of this.decor) d.update(timeMs);
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
          DISTRICT.peacefulGroups.some((g) => near(tx, ty, g.area, 1)) ||
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
    // brick for the school and the library, stone for the town hall and the church, a painted wall for the nursery
    const wall =
      school || kind === 'library'
        ? TILE.city.wallRed
        : kind === 'townHall' || kind === 'nursery' || kind === 'prison' || kind === 'church'
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
    const base = s.add
      .rectangle(b.x, front - 3, b.w, 3, 0x1d1a24, 0.9)
      .setOrigin(0)
      .setDepth(front + 0.01);

    const rect: Rect = { x: b.x, y: b.y - ROOF_OVERHANG, w: b.w, h: b.h - FACADE_H + ROOF_OVERHANG };
    const roofFrame = school ? TILE.city.roofs[0] : TILE.city.roofs[1 + (i % 3)]!;
    const roof = s.add
      .tileSprite(rect.x, rect.y, rect.w / 2, rect.h / 2, 'city', roofFrame)
      .setOrigin(0)
      .setScale(2)
      .setDepth(DEPTH.roof);
    const eave = s.add
      .rectangle(rect.x, rect.y + rect.h - 4, rect.w, 4, 0x000000, 0.35)
      .setOrigin(0)
      .setDepth(DEPTH.roof);
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
    } else if (kind === 'shop') this.buildingParts.set(i, [facade, roof, base, ...buildShopFront(s, b, parts)]);
    else if (kind === 'nursery') this.buildingParts.set(i, [facade, roof, base, ...buildNurseryFront(this, b, parts)]);
    else if (kind === 'townHall') this.buildingParts.set(i, [facade, roof, base, ...buildTownHallFront(this, b, parts)]);
    else if (kind === 'library') this.buildingParts.set(i, [facade, roof, base, ...buildLibraryFront(this, b, parts)]);
    else if (kind === 'church') this.buildingParts.set(i, [facade, roof, base, ...buildChurchFront(this, s, b, parts)]);
    else if (kind === 'prison') this.buildingParts.set(i, [facade, roof, base, ...buildPrisonFront(this, s, b, parts)]);
    else {
      // decor fronts: never targets, so not in buildingParts (no ruin look)
      const decor = DISTRICT.decor.find((d) => buildingIndex(d.footprint) === i);
      if (decor?.id === 'caf') this.decor.push(buildCafFront(this, s, decor, parts, this.reducedMotion));
      else if (decor?.id === 'pouletCrousti') this.decor.push(buildPouletFront(this, s, decor, parts, this.reducedMotion));
    }
    this.roofs.push({ rect, parts });
  }

  /** Pixel-art graphics on a building's front wall (depth just above the wall) and its `r(colour, x, y, w, h)` painter. */
  frontPainter(b: Rect): { g: Phaser.GameObjects.Graphics; r: Paint; top: number; front: number } {
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
  roofSign(
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
  windowGlow(b: Rect, colour: number, alpha: number): Phaser.GameObjects.Ellipse {
    return this.scene.add
      .ellipse(b.x + b.w / 2, b.y + b.h + 6, b.w - 8, 14, colour, alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.decal + 1)
      .setName('glow');
  }

  /**
   * Trees: the trunk tile is depth-sorted at its foot y (actors north of it pass behind), the foliage sits
   * above actors. Both fade like roofs while Paul's feet are inside the canopy rect, so Paul stays visible.
   */
  private buildTrees(): void {
    for (const t of DISTRICT.trunks) {
      const footY = t.y + 6;
      this.scene.add.ellipse(t.x, footY, 18, 6, 0x000000, 0.25).setDepth(DEPTH.decal);
      const trunk = this.scene.add.image(t.x, footY, 'city', TILE.city.treeTrunk).setOrigin(0.5, 1).setScale(2).setDepth(footY);
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
