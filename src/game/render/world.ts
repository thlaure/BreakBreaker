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

/** Static district: ground tilemap, building fronts, roofs, trees. */
export class WorldView {
  readonly width = N * T;
  readonly height = N * T;
  private readonly roofs: Roof[] = [];
  /** Parts of each target building (school, shop) by building index, for its ruin look. */
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
    const wall = school ? TILE.city.wallRed : i % 2 === 0 ? TILE.city.wallGrey : TILE.city.wallRed;
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
