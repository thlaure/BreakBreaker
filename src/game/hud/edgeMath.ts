import { CONFIG } from '../../sim/config';
import type { Vec } from '../../sim/types';

/** Distance in metres (1 tile = 32 px = 1 m), rounded. */
export function meters(from: Vec, to: Vec): number {
  return Math.round(Math.hypot(to.x - from.x, to.y - from.y) / CONFIG.tile);
}

export function formatMeters(from: Vec, to: Vec): string {
  return `${meters(from, to)} m`;
}

/** Screen angle in whole degrees (0 = right, 90 = down) from `from` toward `to`. */
export function bearingDeg(from: Vec, to: Vec): number {
  return Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Targets closer than this to the screen border count as off-screen (they would sit under the indicator). */
export const ONSCREEN_MARGIN = 16;
const GAP = 4;

/**
 * Centre of an edge indicator of half-size `half` for a target at screen point `t`, or null when the target is on
 * screen. The point lies on the ray from the screen centre toward the target, clamped `pad` px inside the edges, then
 * moved out of every `avoid` box (HUD panel, Commandes button, touch controls) by the smallest in-bounds shift.
 */
export function edgePosition(t: Vec, view: { width: number; height: number }, half: Vec, pad: number, avoid: Box[] = []): Vec | null {
  const { width: w, height: h } = view;
  const m = ONSCREEN_MARGIN;
  if (t.x >= m && t.x <= w - m && t.y >= m && t.y <= h - m) return null;
  const minX = Math.min(w / 2, half.x + pad);
  const maxX = Math.max(w / 2, w - half.x - pad);
  const minY = Math.min(h / 2, half.y + pad);
  const maxY = Math.max(h / 2, h - half.y - pad);
  const cx = w / 2;
  const cy = h / 2;
  const dx = t.x - cx;
  const dy = t.y - cy;
  const kx = dx === 0 ? Infinity : (dx > 0 ? maxX - cx : cx - minX) / Math.abs(dx);
  const ky = dy === 0 ? Infinity : (dy > 0 ? maxY - cy : cy - minY) / Math.abs(dy);
  const k = Math.min(kx, ky);
  let p = { x: cx + dx * k, y: cy + dy * k };
  for (const b of avoid) {
    const l = b.left - half.x - GAP;
    const r = b.right + half.x + GAP;
    const tp = b.top - half.y - GAP;
    const bt = b.bottom + half.y + GAP;
    if (p.x <= l || p.x >= r || p.y <= tp || p.y >= bt) continue;
    const moves: Vec[] = [
      { x: p.x, y: bt },
      { x: p.x, y: tp },
      { x: r, y: p.y },
      { x: l, y: p.y },
    ].filter((q) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY);
    if (moves.length === 0) continue;
    moves.sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y));
    p = moves[0]!;
  }
  return { x: Math.round(p.x), y: Math.round(p.y) };
}
