import type { Vec } from '../types';
import type { Circle, District, Rect } from './district';

const inRect = (p: Vec, r: Rect): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const circleHitsRect = (p: Vec, rad: number, r: Rect): boolean => {
  const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 < rad * rad;
};
const circleHitsCircle = (p: Vec, rad: number, c: Circle): boolean =>
  (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < (rad + c.r) ** 2;

/** Tile grid over the district. Buildings, trunks and the peaceful group are solid. */
export class Grid {
  readonly tiles: number;
  readonly tile: number;
  readonly size: number;
  private readonly solid: Uint8Array;

  constructor(private readonly d: District, tile = 32) {
    this.tiles = d.tiles;
    this.tile = tile;
    this.size = d.tiles * tile;
    this.solid = new Uint8Array(this.tiles * this.tiles);
    for (let ty = 0; ty < this.tiles; ty++) {
      for (let tx = 0; tx < this.tiles; tx++) {
        const x0 = tx * tile;
        const y0 = ty * tile;
        const t: Rect = { x: x0, y: y0, w: tile, h: tile };
        let s = false;
        for (const b of d.buildings) if (overlap(t, b)) s = true;
        if (overlap(t, d.peacefulGroup.area)) s = true;
        // trunks mark their tile solid at tile resolution (coarse, for navigation)
        for (const c of d.trunks) if (inRect({ x: c.x, y: c.y }, t)) s = true;
        this.solid[ty * this.tiles + tx] = s ? 1 : 0;
      }
    }
  }

  /** Out-of-bounds counts as solid. */
  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.tiles || ty >= this.tiles) return true;
    return this.solid[ty * this.tiles + tx] === 1;
  }

  /** Exact (pixel) solidity of a point: map edge, buildings, trunk circles, group area. */
  isSolidPx(p: Vec): boolean {
    if (p.x < 0 || p.y < 0 || p.x >= this.size || p.y >= this.size) return true;
    for (const b of this.d.buildings) if (inRect(p, b)) return true;
    if (inRect(p, this.d.peacefulGroup.area)) return true;
    for (const c of this.d.trunks) if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < c.r * c.r) return true;
    return false;
  }

  isGroup(p: Vec): boolean {
    return inRect(p, this.d.peacefulGroup.area);
  }

  /** Does a circle of radius r centred at p overlap any solid? */
  circleBlocked(p: Vec, r: number): boolean {
    if (p.x - r < 0 || p.y - r < 0 || p.x + r > this.size || p.y + r > this.size) return true;
    for (const b of this.d.buildings) if (circleHitsRect(p, r, b)) return true;
    if (circleHitsRect(p, r, this.d.peacefulGroup.area)) return true;
    for (const c of this.d.trunks) if (circleHitsCircle(p, r, c)) return true;
    return false;
  }

  /** True if no solid lies on the segment a→b (sampled every ~4 px). */
  lineClear(a: Vec, b: Vec): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (this.isSolidPx({ x: a.x + dx * t, y: a.y + dy * t })) return false;
    }
    return true;
  }
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
