import type { Vec } from '../types';
import { norm, sub } from '../math';
import type { Grid } from './grid';

const NEIGH: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** BFS distance field over 8-neighbour tiles (no corner cutting). */
export class FlowField {
  private readonly n: number;
  private readonly dist: Int32Array;
  private target: Vec = { x: 0, y: 0 };
  private targetTile = -1;

  constructor(private readonly grid: Grid) {
    this.n = grid.tiles;
    this.dist = new Int32Array(this.n * this.n).fill(-1);
  }

  private tileOf(p: Vec): [number, number] {
    return [Math.floor(p.x / this.grid.tile), Math.floor(p.y / this.grid.tile)];
  }

  /** Callers throttle to ~0.25 s per target; same-tile rebuilds are skipped. */
  rebuild(target: Vec): void {
    const [tx, ty] = this.tileOf(target);
    const idx = ty * this.n + tx;
    this.target = { x: target.x, y: target.y };
    if (idx === this.targetTile) return;
    this.targetTile = idx;
    this.dist.fill(-1);
    if (this.grid.isSolid(tx, ty)) return;
    const queue: number[] = [idx];
    this.dist[idx] = 0;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head] as number;
      const cx = cur % this.n;
      const cy = (cur - cx) / this.n;
      for (const [dx, dy] of NEIGH) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (this.grid.isSolid(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (this.grid.isSolid(cx + dx, cy) || this.grid.isSolid(cx, cy + dy))) continue;
        const ni = ny * this.n + nx;
        if (this.dist[ni] !== -1) continue;
        this.dist[ni] = (this.dist[cur] ?? 0) + 1;
        queue.push(ni);
      }
    }
  }

  /** Unit direction of travel toward the target; zero if unreachable or already at the target tile. */
  dirAt(p: Vec): Vec {
    const [tx, ty] = this.tileOf(p);
    if (tx < 0 || ty < 0 || tx >= this.n || ty >= this.n) return { x: 0, y: 0 };
    const here = this.dist[ty * this.n + tx] ?? -1;
    if (here < 0) return { x: 0, y: 0 };
    if (here === 0) return norm(sub(this.target, p));
    let best = here;
    let bx = 0;
    let by = 0;
    for (const [dx, dy] of NEIGH) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= this.n || ny >= this.n) continue;
      const d = this.dist[ny * this.n + nx] ?? -1;
      if (d < 0 || d >= best) continue;
      if (dx !== 0 && dy !== 0 && (this.grid.isSolid(tx + dx, ty) || this.grid.isSolid(tx, ty + dy))) continue;
      best = d;
      bx = dx;
      by = dy;
    }
    const s = this.grid.tile;
    return norm(sub({ x: (tx + bx + 0.5) * s, y: (ty + by + 0.5) * s }, p));
  }
}
