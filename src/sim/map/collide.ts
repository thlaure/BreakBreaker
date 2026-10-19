import type { Vec } from '../types';
import type { Grid } from './grid';

const MAX_STEP = 4;

/** Axis-separated slide. Never ends overlapping solid (if it starts free). */
export function moveCircle(grid: Grid, pos: Vec, delta: Vec, r: number): Vec {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / MAX_STEP));
  const sx = delta.x / n;
  const sy = delta.y / n;
  let p = { x: pos.x, y: pos.y };
  for (let i = 0; i < n; i++) {
    const tx = { x: p.x + sx, y: p.y };
    if (!grid.circleBlocked(tx, r)) p = tx;
    const ty = { x: p.x, y: p.y + sy };
    if (!grid.circleBlocked(ty, r)) p = ty;
  }
  return p;
}
