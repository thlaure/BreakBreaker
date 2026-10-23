import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { norm, segmentCircleHit } from './math';
import type { HostileView } from './player';
import type { SimEvent, Vec } from './types';

/**
 * A straight-line projectile: a shooter's bullet (`enemy`) or a flashball shot (`player`). `dir` is a unit vector;
 * `speed` px/s; it is removed once it has flown `maxDist` px.
 */
export interface Bullet {
  id: number;
  owner: 'enemy' | 'player';
  pos: Vec;
  dir: Vec;
  speed: number;
  radius: number;
  flown: number;
  maxDist: number;
}

export interface BulletCtx {
  /** `invulnerable`: invulnerability frames (or KO): an enemy bullet flies through Paul. `shield`: the bouclier's bubble. */
  player: { pos: Vec; r: number; invulnerable: boolean; shield: boolean };
  hostiles: readonly HostileView[];
  /** t in [0,1] at which segment a→b first enters the peaceful group, or null. */
  groupBlocks(a: Vec, b: Vec): number | null;
  victimPos: Vec | null;
}

/** What one step of the projectiles did: events, and the rioters the flashball shots hit (the Sim applies the hits). */
export interface BulletStep {
  events: SimEvent[];
  hits: { lifeId: number; at: Vec }[];
}

const SAMPLE_PX = 2;
/** Body radius of the rescue victim (shots stop on it, never hurt it). */
const VICTIM_R = 8;

const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Bullets of the shooters and flashball shots. An enemy bullet (CONFIG.bullet) hurts only Paul (PlayerDamaged, through
 * the Sim's normal damage path) and flies through him during his invulnerability frames; the bouclier's bubble stops it
 * (ShieldBlocked). A flashball shot (CONFIG.flashball) stops on the first active rioter on its path (a hit for the Sim).
 * Both stop at solids (BulletImpact), the peaceful group and the victim (ProtectedGroupBlockedImpact), whichever comes
 * first along the step's segment; rioters never stop an enemy bullet. At most CONFIG.bullet.maxFlying enemy bullets.
 */
export class Bullets {
  private list: Bullet[] = [];
  private nextId = 1;

  constructor(private readonly grid: Grid) {}

  enemy(): Bullet[] {
    return this.list.filter((b) => b.owner === 'enemy');
  }

  player(): Bullet[] {
    return this.list.filter((b) => b.owner === 'player');
  }

  /** A shooter's bullet from `from` along `dir`; null when CONFIG.bullet.maxFlying are already in flight. */
  fire(from: Vec, dir: Vec): Bullet | null {
    if (this.enemy().length >= CONFIG.bullet.maxFlying) return null;
    const c = CONFIG.bullet;
    return this.make('enemy', from, dir, c.speed, c.radius, c.speed * c.lifeSec);
  }

  /** A flashball shot from `from` along `dir` (no cap: one per strike, the weapon has 6). */
  shoot(from: Vec, dir: Vec): Bullet {
    const c = CONFIG.flashball;
    return this.make('player', from, dir, c.speed, c.radius, c.range);
  }

  private make(owner: Bullet['owner'], from: Vec, dir: Vec, speed: number, radius: number, maxDist: number): Bullet {
    const d = norm(dir);
    const b: Bullet = {
      id: this.nextId++,
      owner,
      pos: { ...from },
      dir: d.x === 0 && d.y === 0 ? { x: 1, y: 0 } : d,
      speed,
      radius,
      flown: 0,
      maxDist,
    };
    this.list.push(b);
    return b;
  }

  step(dt: number, ctx: BulletCtx): BulletStep {
    const out: BulletStep = { events: [], hits: [] };
    const gone = new Set<Bullet>();
    for (const b of this.list) if (this.advance(b, dt, ctx, out)) gone.add(b);
    if (gone.size > 0) this.list = this.list.filter((b) => !gone.has(b));
    return out;
  }

  /** Moves one projectile; true when it is gone. */
  private advance(b: Bullet, dt: number, ctx: BulletCtx, out: BulletStep): boolean {
    const a = b.pos;
    const step = Math.min(b.speed * dt, b.maxDist - b.flown);
    const end = { x: a.x + b.dir.x * step, y: a.y + b.dir.y * step };
    // the nearest thing on the segment wins
    const st = this.solidHit(a, end);
    const gt = ctx.groupBlocks(a, end);
    const vt = ctx.victimPos ? segmentCircleHit(a, end, ctx.victimPos, VICTIM_R + b.radius) : null;
    const guarded = Math.min(gt ?? Infinity, vt ?? Infinity);
    let target: { t: number; lifeId?: number } | null = null;
    if (b.owner === 'enemy') {
      const p = ctx.player;
      const pt = p.invulnerable && !p.shield ? null : segmentCircleHit(a, end, p.pos, p.r + b.radius);
      if (pt !== null) target = { t: pt };
    } else {
      for (const h of ctx.hostiles) {
        if (!h.active) continue;
        const t = segmentCircleHit(a, end, h.pos, h.r + b.radius);
        if (t !== null && (!target || t < target.t || (t === target.t && h.lifeId < target.lifeId!))) target = { t, lifeId: h.lifeId };
      }
    }
    const tt = target?.t ?? Infinity;
    const first = Math.min(tt, guarded, st ?? Infinity);
    if (first === Infinity) {
      b.pos = end;
      b.flown += step;
      return b.flown >= b.maxDist - 1e-9;
    }
    const at = lerp(a, end, first);
    if (first === tt && target) {
      if (target.lifeId !== undefined) out.hits.push({ lifeId: target.lifeId, at });
      else if (ctx.player.shield) out.events.push({ type: 'ShieldBlocked', pos: at });
      else out.events.push({ type: 'PlayerDamaged', amount: CONFIG.bullet.damage });
    } else if (first === guarded) out.events.push({ type: 'ProtectedGroupBlockedImpact' });
    else out.events.push({ type: 'BulletImpact', pos: at, owner: b.owner });
    return true;
  }

  /** Fraction u in [0,1] of the first solid sample along a→b, or null (the peaceful group counts: see groupBlocks). */
  private solidHit(a: Vec, b: Vec): number | null {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_PX));
    for (let i = 1; i <= n; i++) if (this.grid.isSolidPx(lerp(a, b, i / n))) return i / n;
    return null;
  }
}
