import { CONFIG } from './config';
import { moveCircle } from './map/collide';
import type { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist, norm, sub } from './math';
import type { HostileView, Player } from './player';
import type { Rocks } from './projectiles';
import { SpatialHash } from './spatial';
import type { Role, SimEvent, TargetId, Variant, Vec } from './types';

export interface Hostile {
  lifeId: number;
  variant: Variant;
  role: Role;
  pos: Vec;
  hp: number;
  maxHp: number;
  state: 'approach' | 'windup' | 'recover' | 'degrade' | 'threaten' | 'ko';
  stateUntil: number;
  nextAttackAt: number;
  incidentId: string | null;
  /** 'facade' = its site (degraders hit it, Molotovs throw at it). */
  target: 'player' | 'facade' | 'victim';
  /** Target a degrader or Molotov goes for (kept after it turns on Paul). */
  site: TargetId | null;
  /** Round this rioter belongs to (null = outside any round's roster). */
  round: number | null;
}

/** A target site as the horde sees it: where to stand, where bottles land, whether it still stands. */
export interface HordeSite {
  points: Vec[];
  door: Vec;
  standing: boolean;
  field: FlowField;
}

export interface HordeCtx {
  player: Player;
  grid: Grid;
  fields: { player: FlowField; victim: FlowField | null };
  rocks: Rocks;
  sites: Partial<Record<TargetId, HordeSite>>;
  victimPos: Vec | null;
  pressure: number;
}

/** Per-hostile AI bookkeeping kept out of the public Hostile shape. */
interface Aux {
  windKind: 'contact' | 'throw' | 'molotov' | null;
  throwTo: Vec | null;
  /** Index of the site attack point this degrader / Molotov goes for. */
  pointIdx: number | null;
  progressPos: Vec;
  progressAt: number;
  /** Until this time, steer by flow field even when a straight line looks clear (set when stuck). */
  fieldUntil: number;
}

const R = CONFIG.hostile.radius;
const STRIKE_REACH = 20;
const HIT_REACH = 24;
const STOP_DIST = 16;
const THROW_MIN = 160;
const THROW_MAX = 300;
const THROW_FALLBACK = 80;
const NEAR_GOAL = 24;
const FIELD_REBUILD_SEC = 0.25;
const STUCK_PX = 8;
const STUCK_SEC = 2;
/** Blocked by neighbours this close to the goal means queuing, not stuck. */
const QUEUE_DIST = 64;
const MAX_KO_BODIES = 16;
const THROW_POSTPONE = 0.25;
const EPS = 1e-9;
const ZERO: Vec = { x: 0, y: 0 };

const isZero = (v: Vec): boolean => v.x === 0 && v.y === 0;

export class Horde {
  list: Hostile[] = [];
  private aux = new Map<number, Aux>();
  private nextLifeId = 1;
  private koOrder: number[] = [];
  /** Last rebuild time per field: 'player', 'victim' and one key per site. */
  private lastRebuild = new Map<string, number>();
  private hash = new SpatialHash<{ id: number; pos: Vec }>(32);
  // per-step scratch
  private wc = 0;
  private wt = 0;
  private limit = 2;
  private damage: number = CONFIG.hostile.contactDamage;

  spawn(opts: {
    variant: Variant;
    role: Role;
    pos: Vec;
    maxHp?: number;
    incidentId?: string;
    target?: Hostile['target'];
    site?: TargetId;
    round?: number;
  }): Hostile | null {
    if (this.active().length >= CONFIG.caps.hostiles) return null;
    const maxHp = opts.maxHp ?? CONFIG.hostile.baseHp;
    const defTarget: Hostile['target'] =
      opts.role === 'degrader' || opts.role === 'molotov' ? 'facade' : opts.role === 'aggressor' ? 'victim' : 'player';
    const h: Hostile = {
      lifeId: this.nextLifeId++,
      variant: opts.variant,
      role: opts.role,
      pos: { ...opts.pos },
      hp: maxHp,
      maxHp,
      state: 'approach',
      stateUntil: 0,
      nextAttackAt: 0,
      incidentId: opts.incidentId ?? null,
      target: opts.target ?? defTarget,
      site: opts.site ?? null,
      round: opts.round ?? null,
    };
    this.list.push(h);
    this.aux.set(h.lifeId, {
      windKind: null,
      throwTo: null,
      pointIdx: null,
      progressPos: { ...h.pos },
      progressAt: -Infinity,
      fieldUntil: -Infinity,
    });
    return h;
  }

  applyHit(lifeId: number, dmg: number): 'hit' | 'ko' | 'ignored' {
    const h = this.list.find((x) => x.lifeId === lifeId);
    if (!h || h.state === 'ko') return 'ignored';
    h.hp = Math.max(0, h.hp - dmg);
    if (h.hp > 0) return 'hit';
    h.state = 'ko';
    const a = this.aux.get(lifeId);
    if (a) a.windKind = null;
    this.koOrder.push(lifeId);
    while (this.koOrder.length > MAX_KO_BODIES) {
      const old = this.koOrder.shift()!;
      this.list = this.list.filter((x) => x.lifeId !== old);
      this.aux.delete(old);
    }
    return 'ko';
  }

  /** Removes the active hostiles matching `pred` from the map (they leave: no KO, no score); returns how many. */
  dismiss(pred: (h: Hostile) => boolean): number {
    const gone = this.list.filter((h) => h.state !== 'ko' && pred(h));
    if (gone.length === 0) return 0;
    const ids = new Set(gone.map((h) => h.lifeId));
    this.list = this.list.filter((h) => !ids.has(h.lifeId));
    for (const id of ids) this.aux.delete(id);
    return gone.length;
  }

    active(): Hostile[] {
    return this.list.filter((h) => h.state !== 'ko');
  }

  /** Targets for the melee sweep / rock ctx (KO bodies are inactive). */
  views(): HostileView[] {
    return this.list.map((h) => ({ lifeId: h.lifeId, pos: h.pos, r: R, active: h.state !== 'ko' }));
  }

  step(dt: number, now: number, ctx: HordeCtx): SimEvent[] {
    const events: SimEvent[] = [];
    const act = this.active();
    this.limit = Math.min(4, 2 + Math.floor(ctx.pressure / 4));
    this.damage = Math.min(12, CONFIG.hostile.contactDamage + Math.floor(ctx.pressure / 2));
    this.wc = 0;
    this.wt = 0;
    for (const h of act) {
      if (h.state !== 'windup') continue;
      const k = this.auxOf(h).windKind;
      if (k === 'throw') this.wt++;
      else if (k === 'contact') this.wc++;
    }

    this.rebuild('player', ctx.fields.player, ctx.player.pos, now);
    for (const [id, s] of Object.entries(ctx.sites)) {
      const p0 = s?.points[0];
      if (s && p0 && s.standing) this.rebuild(`site:${id}`, s.field, p0, now);
    }
    if (ctx.fields.victim && ctx.victimPos) this.rebuild('victim', ctx.fields.victim, ctx.victimPos, now);

    this.hash.clear();
    for (const h of act) this.hash.insert({ id: h.lifeId, pos: h.pos });

    for (const h of act) {
      const a = this.auxOf(h);
      if (h.state === 'recover' && now >= h.stateUntil) h.state = 'approach';
      const want = this.behave(h, a, now, ctx, events);
      const delta = this.separation(h, ctx.player.pos);
      if (!isZero(want)) {
        delta.x += want.x * CONFIG.hostile.speed * dt;
        delta.y += want.y * CONFIG.hostile.speed * dt;
      }
      if (!isZero(delta)) h.pos = moveCircle(ctx.grid, h.pos, delta, R);
      this.trackProgress(h, a, !isZero(want), this.crowded(h), now, ctx);
    }
    return events;
  }

  private auxOf(h: Hostile): Aux {
    return this.aux.get(h.lifeId)!;
  }

  /** FlowField does not throttle itself: rebuild each field at most every 0.25 s of sim time. */
  private rebuild(key: string, field: FlowField, target: Vec, now: number): void {
    if (now - (this.lastRebuild.get(key) ?? -Infinity) < FIELD_REBUILD_SEC - EPS) return;
    this.lastRebuild.set(key, now);
    field.rebuild(target);
  }

  /** Returns the desired unit direction (or zero) and advances the hostile's state machine. */
  private behave(h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    if (h.target === 'facade' && !this.siteOf(h, ctx)) h.target = 'player';
    if (h.target === 'victim' && !ctx.victimPos) h.target = 'player';
    if (h.target === 'player' && (h.state === 'degrade' || h.state === 'threaten')) h.state = 'approach';
    if (h.target === 'player' && a.windKind === 'molotov') {
      // its site fell during the windup: the bottle is never thrown
      a.windKind = null;
      h.state = 'approach';
    }

    if (h.target === 'facade') {
      const site = this.siteOf(h, ctx)!;
      return h.role === 'molotov' ? this.molotov(h, a, site, now, ctx, ev) : this.degrader(h, a, site, now, ctx);
    }
    if (h.target === 'victim') {
      const goal = ctx.victimPos!;
      if (dist(h.pos, goal) <= NEAR_GOAL) {
        h.state = 'threaten';
        return ZERO;
      }
      if (h.state === 'threaten') h.state = 'approach';
      return this.steer(h, a, goal, ctx.fields.victim, now, ctx);
    }
    if (h.role === 'thrower') return this.thrower(h, a, now, ctx, ev);
    return this.contact(h, a, now, ctx, ev);
  }

  private contact(h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    const p = ctx.player;
    const d = dist(h.pos, p.pos);
    if (h.state === 'windup') {
      if (now < h.stateUntil - EPS) return ZERO;
      if (d <= HIT_REACH && !p.ko) ev.push({ type: 'PlayerDamaged', amount: this.damage });
      a.windKind = null;
      this.wc--;
      h.state = 'recover';
      h.stateUntil = h.nextAttackAt;
      return ZERO;
    }
    if (h.state === 'approach' && d <= STRIKE_REACH && now >= h.nextAttackAt - EPS && this.wc < this.limit && !p.ko) {
      h.state = 'windup';
      h.stateUntil = now + CONFIG.hostile.windup;
      h.nextAttackAt = now + CONFIG.hostile.attackInterval;
      a.windKind = 'contact';
      this.wc++;
      return ZERO;
    }
    if (d <= STOP_DIST) return ZERO;
    return this.steer(h, a, p.pos, ctx.fields.player, now, ctx);
  }

  private thrower(h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    const p = ctx.player;
    if (h.state === 'windup' && a.windKind === 'throw') {
      if (now < h.stateUntil - EPS) return ZERO;
      a.windKind = null;
      this.wt--;
      const rock = ctx.rocks.spawnEnemy(h.pos, a.throwTo!, now);
      a.throwTo = null;
      if (rock) {
        ev.push({ type: 'EnemyRockThrown', rockId: rock.id });
        h.state = 'recover';
        h.stateUntil = h.nextAttackAt;
      } else {
        // flying cap reached: cancel without consuming the throw, retry shortly
        h.state = 'approach';
        h.nextAttackAt = now + THROW_POSTPONE;
      }
      return ZERO;
    }
    const d = dist(h.pos, p.pos);
    if (d < THROW_FALLBACK || (h.state === 'windup' && a.windKind === 'contact')) return this.contact(h, a, now, ctx, ev);
    const clear = ctx.grid.lineClear(h.pos, p.pos);
    if (d > THROW_MAX || !clear) return this.steer(h, a, p.pos, ctx.fields.player, now, ctx);
    if (d < THROW_MIN) return norm(sub(h.pos, p.pos));
    if (h.state === 'approach' && now >= h.nextAttackAt - EPS && this.wt < this.limit && !p.ko) {
      const to = { ...p.pos };
      h.state = 'windup';
      h.stateUntil = now + Math.max(0.6, CONFIG.rock.windupMin);
      h.nextAttackAt = now + CONFIG.rock.throwInterval;
      a.windKind = 'throw';
      a.throwTo = to;
      this.wt++;
      ev.push({ type: 'EnemyThrowStarted', from: { ...h.pos }, to: { ...to }, until: h.stateUntil });
    }
    return ZERO;
  }

  /** The standing site a degrader / Molotov goes for, or null (missing or ruined → it turns on Paul). */
  private siteOf(h: Hostile, ctx: HordeCtx): HordeSite | null {
    const s = h.site ? ctx.sites[h.site] : undefined;
    return s && s.standing && s.points.length > 0 ? s : null;
  }

  /** The site attack point this hostile goes for: the nearest one at first, the next one when stuck. */
  private sitePoint(h: Hostile, a: Aux, pts: Vec[]): Vec {
    if (a.pointIdx === null) {
      let best = 0;
      for (let i = 1; i < pts.length; i++) if (dist(h.pos, pts[i]!) < dist(h.pos, pts[best]!)) best = i;
      a.pointIdx = best;
    }
    return pts[a.pointIdx % pts.length]!;
  }

  private degrader(h: Hostile, a: Aux, site: HordeSite, now: number, ctx: HordeCtx): Vec {
    const goal = this.sitePoint(h, a, site.points);
    if (dist(h.pos, goal) <= NEAR_GOAL) {
      h.state = 'degrade';
      return ZERO;
    }
    if (h.state === 'degrade') h.state = 'approach';
    return this.steer(h, a, goal, site.field, now, ctx);
  }

  /**
   * Walks to its site; within range of an attack point with a clear line, winds up (bottle raised), then throws at
   * the door and turns on Paul as a contact. A KO during the windup throws nothing (KO hostiles are not stepped).
   */
  private molotov(h: Hostile, a: Aux, site: HordeSite, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    if (h.state === 'windup' && a.windKind === 'molotov') {
      if (now < h.stateUntil - EPS) return ZERO;
      a.windKind = null;
      h.state = 'approach';
      h.target = 'player';
      ev.push({ type: 'MolotovThrown', from: { ...h.pos }, to: { ...site.door }, target: h.site! });
      return ZERO;
    }
    const goal = this.sitePoint(h, a, site.points);
    if (dist(h.pos, goal) <= CONFIG.molotov.range && ctx.grid.lineClear(h.pos, goal)) {
      h.state = 'windup';
      h.stateUntil = now + CONFIG.molotov.windup;
      a.windKind = 'molotov';
      return ZERO;
    }
    return this.steer(h, a, goal, site.field, now, ctx);
  }

  /** Straight line when clear (and not recovering from being stuck), else follow the flow field. */
  private steer(h: Hostile, a: Aux, goal: Vec, field: FlowField | null, now: number, ctx: HordeCtx): Vec {
    if (!field || (now >= a.fieldUntil && ctx.grid.lineClear(h.pos, goal))) return norm(sub(goal, h.pos));
    const dir = field.dirAt(h.pos);
    return isZero(dir) ? norm(sub(goal, h.pos)) : dir;
  }

  /** Push apart from overlapping active hostiles and out of Paul's body. */
  private separation(h: Hostile, player: Vec): Vec {
    const out = { x: 0, y: 0 };
    for (const n of this.hash.query(h.pos, 2 * R)) {
      if (n.id === h.lifeId) continue;
      const d = dist(h.pos, n.pos);
      const overlap = 2 * R - d;
      if (overlap <= 0) continue;
      const dir = d === 0 ? { x: h.lifeId < n.id ? -1 : 1, y: 0 } : norm(sub(h.pos, n.pos));
      out.x += dir.x * overlap * 0.5;
      out.y += dir.y * overlap * 0.5;
    }
    const dp = dist(h.pos, player);
    const minP = R + CONFIG.player.radius;
    if (dp < minP && dp > 0) {
      const dir = norm(sub(h.pos, player));
      out.x += dir.x * (minP - dp);
      out.y += dir.y * (minP - dp);
    }
    return out;
  }

  private crowded(h: Hostile): boolean {
    return this.hash.query(h.pos, 2 * R + 1).some((n) => n.id !== h.lifeId);
  }

  private goalOf(h: Hostile, a: Aux, ctx: HordeCtx): Vec | null {
    if (h.target === 'player') return ctx.player.pos;
    if (h.target === 'victim') return ctx.victimPos;
    const site = this.siteOf(h, ctx);
    return a.pointIdx === null || !site ? null : site.points[a.pointIdx % site.points.length]!;
  }

  /**
   * No progress > 8 px in 2 s while trying to move -> steer by flow field for 2 s and, for a degrader or Molotov,
   * try the next site attack point. A hostile held back by neighbours near its goal is queuing and is not treated as stuck.
   * The field rebuild throttle is never bypassed: the field is rebuilt on its normal 0.25 s cadence anyway.
   */
  private trackProgress(h: Hostile, a: Aux, moving: boolean, crowded: boolean, now: number, ctx: HordeCtx): void {
    const goal = this.goalOf(h, a, ctx);
    const queuing = crowded && goal !== null && dist(h.pos, goal) <= QUEUE_DIST;
    if (!moving || queuing || a.progressAt === -Infinity || dist(h.pos, a.progressPos) > STUCK_PX) {
      a.progressPos = { ...h.pos };
      a.progressAt = now;
      return;
    }
    if (now - a.progressAt <= STUCK_SEC) return;
    a.fieldUntil = now + STUCK_SEC;
    const site = h.target === 'facade' ? this.siteOf(h, ctx) : null;
    if (site && a.pointIdx !== null) a.pointIdx = (a.pointIdx + 1) % site.points.length;
    a.progressPos = { ...h.pos };
    a.progressAt = now;
  }
}
