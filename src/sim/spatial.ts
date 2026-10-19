import type { Vec } from './types';

export class SpatialHash<T extends { id: number; pos: Vec }> {
  private cells = new Map<number, T[]>();
  constructor(private readonly cell: number) {}

  private key(cx: number, cy: number): number {
    return cx * 100003 + cy;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(e: T): void {
    const k = this.key(Math.floor(e.pos.x / this.cell), Math.floor(e.pos.y / this.cell));
    const a = this.cells.get(k);
    if (a) a.push(e);
    else this.cells.set(k, [e]);
  }

  /** Entities within distance r of p. */
  query(p: Vec, r: number): T[] {
    const out: T[] = [];
    const x0 = Math.floor((p.x - r) / this.cell);
    const x1 = Math.floor((p.x + r) / this.cell);
    const y0 = Math.floor((p.y - r) / this.cell);
    const y1 = Math.floor((p.y + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const a = this.cells.get(this.key(cx, cy));
        if (!a) continue;
        for (const e of a) if (Math.hypot(e.pos.x - p.x, e.pos.y - p.y) <= r) out.push(e);
      }
    return out;
  }
}
