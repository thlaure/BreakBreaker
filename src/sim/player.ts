import { CONFIG } from './config';
import { moveCircle } from './map/collide';
import type { Grid } from './map/grid';
import { dist, inArc, norm } from './math';
import type { InputFrame, Vec } from './types';

export interface Player {
  pos: Vec;
  facing: Vec;
  hp: number;
  invulnUntil: number;
  strikeReadyAt: number;
  swingId: number;
  ko: boolean;
}

/** What the melee sweep sees of a hostile (same shape as RockCtx hostiles). */
export interface HostileView {
  lifeId: number;
  pos: Vec;
  r: number;
  active: boolean;
}

export function createPlayer(pos: Vec): Player {
  return {
    pos: { ...pos },
    facing: { x: 0, y: 1 },
    hp: CONFIG.player.maxHp,
    invulnUntil: 0,
    strikeReadyAt: 0,
    swingId: 0,
    ko: false,
  };
}

/**
 * 8-direction move (normalised, so diagonals are not faster), `speedMul` × the walk/run speed (mode furie). Aim
 * overrides facing; else last non-zero move.
 */
export function stepPlayer(p: Player, input: InputFrame, dt: number, now: number, grid: Grid, speedMul = 1): void {
  void now;
  if (p.ko) return;
  const dir = norm(input.move);
  const moving = dir.x !== 0 || dir.y !== 0;
  if (moving) {
    const speed = (input.run ? CONFIG.player.run : CONFIG.player.walk) * speedMul;
    p.pos = moveCircle(grid, p.pos, { x: dir.x * speed * dt, y: dir.y * speed * dt }, CONFIG.player.radius);
  }
  const aim = input.aim ? norm(input.aim) : null;
  if (aim && (aim.x !== 0 || aim.y !== 0)) p.facing = aim;
  else if (moving) p.facing = dir;
}

/**
 * Melee swing. Within the cooldown the current swing is reported again with no hits (no repeat hits per swing).
 * Hits active hostiles all around Paul (CONFIG.melee.arcDeg = 360), nearest first, at most `maxTargets` (default
 * CONFIG.melee.maxTargets; more in mode furie), with a clear line
 * (grid.lineClear also treats the peaceful group as blocking).
 */
export function sweep(
  p: Player,
  now: number,
  targets: HostileView[],
  grid: Grid,
  range = CONFIG.melee.range,
  maxTargets: number = CONFIG.melee.maxTargets,
): { swingId: number; hits: number[] } {
  if (p.ko || now < p.strikeReadyAt) return { swingId: p.swingId, hits: [] };
  p.swingId += 1;
  p.strikeReadyAt = now + CONFIG.melee.cooldown;
  const { arcDeg } = CONFIG.melee;
  const hits = targets
    .filter((t) => t.active && inArc(p.pos, p.facing, t.pos, range + t.r, arcDeg) && grid.lineClear(p.pos, t.pos))
    .map((t) => ({ id: t.lifeId, d: dist(p.pos, t.pos) }))
    .sort((a, b) => a.d - b.d || a.id - b.id)
    .slice(0, maxTargets)
    .map((t) => t.id);
  // Circular swing: Paul turns toward the nearest rioter hit so the slash animation reads right.
  const nearest = hits.length > 0 ? targets.find((t) => t.lifeId === hits[0]) : undefined;
  if (nearest) {
    const d = norm({ x: nearest.pos.x - p.pos.x, y: nearest.pos.y - p.pos.y });
    if (d.x !== 0 || d.y !== 0) p.facing = d;
  }
  return { swingId: p.swingId, hits };
}

/** Applies damage unless KO or within the invulnerability window. Returns true if damage was applied. */
export function damagePlayer(p: Player, amount: number, now: number): boolean {
  if (p.ko || now < p.invulnUntil) return false;
  p.hp = Math.max(0, p.hp - amount);
  p.invulnUntil = now + CONFIG.player.invulnSec;
  if (p.hp <= 0) p.ko = true;
  return true;
}
