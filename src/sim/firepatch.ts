import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { SimEvent, Vec } from './types';

/** A firebomb in flight toward `to`; it lands at sim time `landAt`. */
export interface Firebomb {
  from: Vec;
  to: Vec;
  landAt: number;
}

export interface FirePatch {
  id: number;
  pos: Vec;
  /** Sim time the patch goes out. */
  until: number;
}

const EPS = 1e-9;
/** Free-point search when a bottle lands in a solid: rings every `RING_PX` up to `SEARCH_PX`, `ANGLES` per ring. */
const RING_PX = 4;
const SEARCH_PX = 48;
const ANGLES = 16;

/**
 * Firebombs in flight and the ground fire they leave (CONFIG.firePatch). A bottle lands at its scheduled time; in a
 * solid it lights the nearest free point (none within 48 px: no patch). A patch burns `lifeSec` from its landing time;
 * a new one beyond `maxAlive` pushes the oldest out. Paul standing inside (centre within `radius`) is hurt every
 * `tickSec`: `hurt` applies the damage through the normal path and says whether it landed (a refused hit, e.g.
 * invulnerability frames, is retried next step). Only Paul is concerned: rioters and targets never.
 */
export class FirePatches {
  list: FirePatch[] = [];
  private bombs: Firebomb[] = [];
  private nextId = 1;
  private tickAt = -Infinity;

  throwBottle(from: Vec, to: Vec, landAt: number): void {
    this.bombs.push({ from: { ...from }, to: { ...to }, landAt });
  }

  flying(): readonly Firebomb[] {
    return this.bombs;
  }

  step(now: number, grid: Grid, player: Vec, hurt: (amount: number) => boolean): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.bombs.length > 0) {
      const landed = this.bombs.filter((b) => b.landAt <= now + EPS);
      if (landed.length > 0) this.bombs = this.bombs.filter((b) => b.landAt > now + EPS);
      for (const b of landed) {
        const pos = freePoint(grid, b.to);
        if (!pos) continue;
        const p: FirePatch = { id: this.nextId++, pos, until: b.landAt + CONFIG.firePatch.lifeSec };
        this.list.push(p);
        if (this.list.length > CONFIG.firePatch.maxAlive) this.list.shift();
        ev.push({ type: 'FirePatchStarted', id: p.id, pos: { ...pos } });
      }
    }
    if (this.list.length === 0) return ev;
    this.list = this.list.filter((p) => p.until > now + EPS);
    const r = CONFIG.firePatch.radius;
    if (now >= this.tickAt - EPS && this.list.some((p) => dist(p.pos, player) <= r) && hurt(CONFIG.firePatch.damage))
      this.tickAt = now + CONFIG.firePatch.tickSec;
    return ev;
  }

  /** Plain render data. */
  view(now: number): { id: number; pos: Vec; r: number; secondsLeft: number }[] {
    return this.list.map((p) => ({ id: p.id, pos: { ...p.pos }, r: CONFIG.firePatch.radius, secondsLeft: Math.max(0, p.until - now) }));
  }
}

/** `p` itself when free, else the nearest free point found on rings around it (fixed angle order), else null. */
function freePoint(grid: Grid, p: Vec): Vec | null {
  if (!grid.isSolidPx(p)) return { ...p };
  for (let d = RING_PX; d <= SEARCH_PX; d += RING_PX) {
    for (let k = 0; k < ANGLES; k++) {
      const a = (k / ANGLES) * Math.PI * 2;
      const q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
      if (!grid.isSolidPx(q)) return q;
    }
  }
  return null;
}
