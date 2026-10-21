import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { dist, norm, segmentCircleHit } from './math';
import type { SimEvent, Vec } from './types';

export type RockState = 'EnemyFlying' | 'LandedRecoverable' | 'PlayerFlying' | 'Removed';

export interface Rock {
  id: number;
  lifeId: number;
  state: RockState;
  owner: 'enemy' | 'player';
  kind: 'caillou' | 'pave' | 'brique';
  pos: Vec;
  from: Vec;
  to: Vec;
  t: number;
  duration: number;
  landedAt: number;
}

export interface RockCtx {
  /** `shield` = Paul is inside the bouclier's bubble: every rock that would hit him is blocked, from any side. */
  player: { pos: Vec; r: number; invulnerable: boolean; shield?: boolean };
  hostiles: { lifeId: number; pos: Vec; r: number; active: boolean }[];
  /** t in [0,1] at which segment a->b first enters the peaceful group, or null. */
  groupBlocks(a: Vec, b: Vec): number | null;
  victimPos: Vec | null;
}

const KINDS = ['caillou', 'pave', 'brique'] as const;
const ENEMY_SPEED = 220;
const PLAYER_ROCK_SPEED = 900;
const RECYCLE_MIN_DIST = 64;
const SAMPLE_PX = 4;

const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export class Rocks {
  carried = 0;
  private rocks: Rock[] = [];
  private nextId = 1;
  private lastReturnAt = -Infinity;

  constructor(private readonly grid: Grid) {}

  flying(): Rock[] {
    return this.rocks.filter((r) => r.state === 'EnemyFlying' || r.state === 'PlayerFlying');
  }

  ground(): Rock[] {
    return this.rocks.filter((r) => r.state === 'LandedRecoverable');
  }

  private make(owner: 'enemy' | 'player', state: RockState, from: Vec, to: Vec, duration: number): Rock {
    const id = this.nextId++;
    const rock: Rock = {
      id,
      lifeId: id,
      state,
      owner,
      kind: KINDS[id % 3]!,
      pos: { ...from },
      from: { ...from },
      to: { ...to },
      t: 0,
      duration,
      landedAt: 0,
    };
    this.rocks.push(rock);
    return rock;
  }

  spawnEnemy(from: Vec, to: Vec, now: number): Rock | null {
    void now;
    if (this.flying().length >= CONFIG.rock.maxFlying) return null;
    const duration = Math.max(CONFIG.rock.flightMin, dist(from, to) / ENEMY_SPEED);
    return this.make('enemy', 'EnemyFlying', from, to, duration);
  }

  returnRock(from: Vec, dir: Vec, now: number): Rock | null {
    if (this.carried <= 0) return null;
    if (now - this.lastReturnAt < CONFIG.rock.returnCooldown) return null;
    const d = norm(dir);
    if (d.x === 0 && d.y === 0) return null;
    this.carried -= 1;
    this.lastReturnAt = now;
    const range = CONFIG.rock.returnRange;
    const to = { x: from.x + d.x * range, y: from.y + d.y * range };
    return this.make('player', 'PlayerFlying', from, to, range / PLAYER_ROCK_SPEED);
  }

  /** Fraction u in [0,1] of the first solid sample along a->b, or null. */
  private solidHit(a: Vec, b: Vec): number | null {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_PX));
    for (let i = 0; i <= n; i++) {
      if (this.grid.isSolidPx(lerp(a, b, i / n))) return i / n;
    }
    return null;
  }

  private landable(p: Vec): boolean {
    return !this.grid.isSolidPx(p) && !this.grid.isGroup(p);
  }

  private land(rock: Rock, p: Vec, now: number, ctx: RockCtx, events: SimEvent[]): void {
    rock.pos = { ...p };
    if (!this.landable(p)) {
      rock.state = 'Removed';
      return;
    }
    const ground = this.ground();
    if (ground.length >= CONFIG.rock.maxGround) {
      let oldest: Rock | null = null;
      for (const g of ground) {
        if (dist(g.pos, ctx.player.pos) <= RECYCLE_MIN_DIST) continue;
        if (!oldest || g.landedAt < oldest.landedAt || (g.landedAt === oldest.landedAt && g.id < oldest.id)) oldest = g;
      }
      if (!oldest) {
        rock.state = 'Removed';
        return;
      }
      oldest.state = 'Removed';
    }
    rock.state = 'LandedRecoverable';
    rock.landedAt = now;
    events.push({ type: 'ProjectileLanded', rockId: rock.id });
  }

  step(dt: number, now: number, ctx: RockCtx): SimEvent[] {
    const events: SimEvent[] = [];
    for (const rock of this.rocks) {
      if (rock.state === 'EnemyFlying') this.stepEnemy(rock, dt, now, ctx, events);
      else if (rock.state === 'PlayerFlying') this.stepPlayer(rock, dt, ctx, events);
    }
    for (const rock of this.rocks) {
      if (rock.state !== 'LandedRecoverable') continue;
      if (this.carried >= CONFIG.rock.maxCarried) break;
      if (dist(rock.pos, ctx.player.pos) <= CONFIG.rock.pickupRadius) {
        this.carried += 1;
        rock.state = 'Removed';
        events.push({ type: 'ProjectilePickedUp', rockId: rock.id });
      }
    }
    this.rocks = this.rocks.filter((r) => r.state !== 'Removed');
    return events;
  }

  private advance(rock: Rock, dt: number): { a: Vec; b: Vec; end: boolean } {
    const a = rock.pos;
    rock.t = Math.min(1, rock.t + dt / rock.duration);
    const b = lerp(rock.from, rock.to, rock.t);
    return { a: { ...a }, b, end: rock.t >= 1 };
  }

  private stepEnemy(rock: Rock, dt: number, now: number, ctx: RockCtx, events: SimEvent[]): void {
    const { a, b, end } = this.advance(rock, dt);
    const gt = ctx.groupBlocks(a, b);
    const st = this.solidHit(a, b);
    const obstacle = Math.min(gt ?? Infinity, st ?? Infinity);
    const blocks = ctx.player.shield === true;
    // a rock hits the bubble even during the invulnerability frames
    const pt = ctx.player.invulnerable && !blocks ? null : segmentCircleHit(a, b, ctx.player.pos, ctx.player.r);
    if (pt !== null && pt < obstacle && blocks) {
      // blocked by the bouclier: no damage, the rock drops at the hit point and can be picked up
      const at = lerp(a, b, pt);
      events.push({ type: 'ShieldBlocked', pos: { ...at } });
      this.land(rock, at, now, ctx, events);
      return;
    }
    if (pt !== null && pt < obstacle) {
      events.push({ type: 'PlayerDamaged', amount: CONFIG.rock.damage });
      this.land(rock, lerp(a, b, pt), now, ctx, events);
      return;
    }
    if (obstacle !== Infinity) {
      // stop and drop just before the obstacle; land() removes it if no free space
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const u = segLen === 0 ? 0 : Math.max(0, obstacle - (SAMPLE_PX + 1) / segLen);
      this.land(rock, lerp(a, b, u), now, ctx, events);
      return;
    }
    rock.pos = b;
    if (end) this.land(rock, b, now, ctx, events);
  }

  private stepPlayer(rock: Rock, dt: number, ctx: RockCtx, events: SimEvent[]): void {
    const { a, b, end } = this.advance(rock, dt);
    const gt = ctx.groupBlocks(a, b);
    const st = this.solidHit(a, b);
    const obstacle = Math.min(gt ?? Infinity, st ?? Infinity);
    let best: { lifeId: number; t: number } | null = null;
    for (const h of ctx.hostiles) {
      if (!h.active) continue;
      const t = segmentCircleHit(a, b, h.pos, h.r);
      if (t !== null && (!best || t < best.t)) best = { lifeId: h.lifeId, t };
    }
    if (best && best.t < obstacle) {
      events.push({ type: 'HitConfirmed', targetLifeId: best.lifeId, damage: CONFIG.rock.returnDamage, source: 'rock' });
      events.push({ type: 'ProjectileReturned', rockId: rock.id });
      rock.state = 'Removed';
      return;
    }
    if (obstacle !== Infinity) {
      if (gt !== null && gt <= (st ?? Infinity)) events.push({ type: 'ProtectedGroupBlockedImpact' });
      rock.state = 'Removed';
      return;
    }
    rock.pos = b;
    if (end) {
      events.push({ type: 'ProjectileReturned', rockId: rock.id });
      rock.state = 'Removed';
    }
  }
}
