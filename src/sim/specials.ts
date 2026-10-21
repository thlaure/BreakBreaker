import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { norm } from './math';
import type { HostileView } from './player';
import type { Vec } from './types';

/** Sample step (px) of the beam's solid check. */
const BEAM_SAMPLE_PX = 4;

/** Squared distance from p to segment a→b. */
function segDist2(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const u = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  const qx = a.x + dx * u - p.x;
  const qy = a.y + dy * u - p.y;
  return qx * qx + qy * qy;
}

/**
 * The onde d’énergie from `from` along `dir`: CONFIG.kamehame.length px, truncated at the first solid sample (buildings,
 * props, trunks, the monument plinth and the peaceful group are all solid in the grid). Every active hostile within
 * halfWidth + its radius of the truncated segment is hit, nearest first.
 */
export function beam(from: Vec, dir: Vec, targets: readonly HostileView[], grid: Grid): { to: Vec; lifeIds: number[] } {
  const d = norm(dir);
  const { length, halfWidth } = CONFIG.kamehame;
  let to = { ...from };
  const n = Math.ceil(length / BEAM_SAMPLE_PX);
  for (let i = 1; i <= n; i++) {
    const s = Math.min(length, i * BEAM_SAMPLE_PX);
    const p = { x: from.x + d.x * s, y: from.y + d.y * s };
    if (grid.isSolidPx(p)) break;
    to = p;
  }
  const lifeIds = targets
    .filter((t) => t.active && segDist2(t.pos, from, to) <= (halfWidth + t.r) ** 2)
    .map((t) => ({ id: t.lifeId, d: (t.pos.x - from.x) * d.x + (t.pos.y - from.y) * d.y, r: t.r }))
    // nothing behind Paul
    .filter((t) => t.d > -t.r)
    .sort((a, b) => a.d - b.d || a.id - b.id)
    .map((t) => t.id);
  return { to, lifeIds };
}
