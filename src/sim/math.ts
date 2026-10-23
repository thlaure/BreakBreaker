import type { Vec } from './types';

export const len = (v: Vec): number => Math.hypot(v.x, v.y);
export const norm = (v: Vec): Vec => {
  const l = len(v);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
export const dist = (a: Vec, b: Vec): number => len(sub(a, b));
/** A fresh copy of `p` (events and snapshots never share the sim's own vectors). */
export const v = (p: Vec): Vec => ({ x: p.x, y: p.y });

/** True if target is within range of origin and within ±arcDeg/2 of facing. */
export function inArc(origin: Vec, facing: Vec, target: Vec, range: number, arcDeg: number): boolean {
  const d = sub(target, origin);
  const l = len(d);
  if (l > range) return false;
  if (l === 0) return true;
  const f = norm(facing);
  const cos = (d.x * f.x + d.y * f.y) / l;
  return cos >= Math.cos((arcDeg / 2) * (Math.PI / 180)) - 1e-9;
}

/** First contact t in [0,1] of segment a→b with circle (c, r); null if none. */
export function segmentCircleHit(a: Vec, b: Vec, c: Vec, r: number): number | null {
  const d = sub(b, a);
  const f = sub(a, c);
  const qa = d.x * d.x + d.y * d.y;
  const qc = f.x * f.x + f.y * f.y - r * r;
  if (qc <= 0) return 0; // starts inside
  if (qa === 0) return null;
  const qb = 2 * (f.x * d.x + f.y * d.y);
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return null;
  const t = (-qb - Math.sqrt(disc)) / (2 * qa);
  return t >= 0 && t <= 1 ? t : null;
}
