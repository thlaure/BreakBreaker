import { CONFIG } from './config';
import { moveCircle } from './map/collide';
import type { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist, norm, sub } from './math';
import type { HostileView, Player } from './player';
import type { Bullets } from './bullets';
import type { Rocks } from './projectiles';
import { brawl, contact, firebomber, shooter, thrower, type Scratch } from './hostileAttacks';
import { roleHp, roleSpeedMul } from './hostileRoles';
import {
  EPS,
  NEAR_GOAL,
  R,
  ZERO,
  crowded,
  degrader,
  isZero,
  separation,
  siteOf,
  sitePoint,
  steer,
  trackProgress,
  type Aux,
} from './hostileSteer';
import { SpatialHash } from './spatial';
import type { Role, SimEvent, SiteId, TargetId, Variant, Vec } from './types';

export { KO_DAMAGE, caidHp, damageOn, isTough, roleHp, roleKnockback, roleSpeedMul } from './hostileRoles';
export type { DamageSource } from './hostileRoles';

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
  site: SiteId | null;
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

/**
 * An ally on the map as the horde sees it (the fire truck, a police officer): rioters after Paul may fight it instead.
 * `r` = its body for the blows' reach (Paul's radius = the usual reach).
 */
export interface AllyTarget {
  id: number;
  pos: Vec;
  r: number;
}

export interface HordeCtx {
  player: Player;
  grid: Grid;
  fields: { player: FlowField; victim: FlowField | null };
  rocks: Rocks;
  /** Where shooters' bullets go (absent: shooters aim but fire nothing). */
  bullets?: Bullets;
  sites: Partial<Record<SiteId, HordeSite>>;
  victimPos: Vec | null;
  pressure: number;
  /**
   * The allies standing on the map and how a rioter's blow reaches one (`hit` takes `amount` off its hp). Absent or
   * empty: every rioter after Paul goes for Paul.
   */
  allies?: { list: readonly AllyTarget[]; hit(id: number, amount: number): void };
}

const FIELD_REBUILD_SEC = 0.25;
const MAX_KO_BODIES = 16;
/** Extra windup per Molotov of the same site already winding up: their bottles never leave on the same step. */
const MOLOTOV_STAGGER = 0.25;

export class Horde {
  list: Hostile[] = [];
  private aux = new Map<number, Aux>();
  private nextLifeId = 1;
  private koOrder: number[] = [];
  /** Last rebuild time per field: 'player', 'victim' and one key per site. */
  private lastRebuild = new Map<string, number>();
  private hash = new SpatialHash<{ id: number; pos: Vec }>(32);
  // per-step scratch
  private readonly s: Scratch = { wc: 0, wt: 0, limit: 2, damage: CONFIG.hostile.contactDamage };
  /** At most CONFIG.hostile.fewLeft hostiles active this step: rioters long at their post go for Paul. */
  private few = false;

  spawn(opts: {
    variant: Variant;
    role: Role;
    pos: Vec;
    maxHp?: number;
    incidentId?: string;
    target?: Hostile['target'];
    site?: SiteId;
    round?: number;
    afterThrow?: 'firebomber';
  }): Hostile | null {
    if (this.active().length >= CONFIG.caps.hostiles) return null;
    const maxHp = opts.maxHp ?? roleHp(opts.role, opts.round ?? null);
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
      foe: null,
      afterThrow: opts.afterThrow ?? null,
      throwTo: null,
      aimFrom: null,
      shotsLeft: 0,
      nextShotAt: 0,
      pointIdx: null,
      progressPos: { ...h.pos },
      progressAt: -Infinity,
      fieldUntil: -Infinity,
      home: (opts.role === 'degrader' || opts.role === 'aggressor') && h.target !== 'player' ? h.target : null,
      postAt: null,
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

  /** Takes a KO body off the map (the jail van carried it away); false if `lifeId` is not a KO body here. */
  removeBody(lifeId: number): boolean {
    const h = this.list.find((x) => x.lifeId === lifeId);
    if (!h || h.state !== 'ko') return false;
    this.list = this.list.filter((x) => x.lifeId !== lifeId);
    this.koOrder = this.koOrder.filter((id) => id !== lifeId);
    this.aux.delete(lifeId);
    return true;
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
    this.s.limit = Math.min(4, 2 + Math.floor(ctx.pressure / 4));
    this.s.damage = Math.min(12, CONFIG.hostile.contactDamage + Math.floor(ctx.pressure / 2));
    this.s.wc = 0;
    this.s.wt = 0;
    this.few = act.length <= CONFIG.hostile.fewLeft;
    for (const h of act) {
      if (h.state !== 'windup') continue;
      const k = this.auxOf(h).windKind;
      if (k === 'throw' || k === 'bottle') this.s.wt++;
      else if (k === 'contact') this.s.wc++;
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
      if (a.postAt === null && (h.state === 'degrade' || h.state === 'threaten')) a.postAt = now;
      const delta = separation(this.hash, h, ctx.player.pos);
      if (!isZero(want)) {
        const speed = CONFIG.hostile.speed * roleSpeedMul(h.role);
        delta.x += want.x * speed * dt;
        delta.y += want.y * speed * dt;
      }
      if (!isZero(delta)) h.pos = moveCircle(ctx.grid, h.pos, delta, R);
      trackProgress(h, a, !isZero(want), crowded(this.hash, h), now, ctx);
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
    this.engage(h, a, now, ctx);
    if (h.target === 'facade' && !siteOf(h, ctx)) h.target = 'player';
    if (h.target === 'victim' && !ctx.victimPos) h.target = 'player';
    if (h.target === 'player' && (h.state === 'degrade' || h.state === 'threaten')) h.state = 'approach';
    if (h.target === 'player' && a.windKind === 'molotov') {
      // its site fell during the windup: the bottle is never thrown
      a.windKind = null;
      h.state = 'approach';
    }

    if (h.target === 'facade') {
      const site = siteOf(h, ctx)!;
      return h.role === 'molotov' ? this.molotov(h, a, site, now, ctx, ev) : degrader(h, a, site, now, ctx);
    }
    if (h.target === 'victim') {
      const goal = ctx.victimPos!;
      if (dist(h.pos, goal) <= NEAR_GOAL) {
        h.state = 'threaten';
        return ZERO;
      }
      if (h.state === 'threaten') h.state = 'approach';
      return steer(h, a, goal, ctx.fields.victim, now, ctx);
    }
    const foe = this.foeOf(h, a, ctx);
    if (foe) return brawl(this.s, h, a, foe, now, ctx);
    if (h.role === 'thrower') return thrower(this.s, h, a, now, ctx, ev);
    if (h.role === 'firebomber') return firebomber(this.s, h, a, now, ctx, ev);
    if (h.role === 'shooter') return shooter(this.s, h, a, now, ctx, ev);
    return contact(this.s, h, a, now, ctx, ev);
  }

  /**
   * Draws a site-bound rioter (degrader, victim aggressor) to Paul: it fights him (target 'player', as a contact) while
   * he is within aggroRadius with a clear line, until he is beyond aggroRelease; then it goes back to its post. With
   * few hostiles left, a degrader at its post for more than postSec leaves it for good; a victim aggressor never does
   * (it keeps robbing the victim until Paul comes close). A Molotov (or a rioter turned contact) is never concerned.
   */
  private engage(h: Hostile, a: Aux, now: number, ctx: HordeCtx): void {
    if (a.home === null || (h.role !== 'degrader' && h.role !== 'aggressor')) return;
    const lost = a.home === 'facade' ? !siteOf(h, ctx) : !ctx.victimPos;
    const pulled = h.role === 'degrader' && this.few && a.postAt !== null && now - a.postAt > CONFIG.hostile.postSec + EPS;
    if (lost || pulled) {
      a.home = null;
      h.target = 'player';
      return;
    }
    const p = ctx.player;
    const d = dist(h.pos, p.pos);
    if (h.target !== 'player') {
      if (d <= CONFIG.hostile.aggroRadius && !p.ko && ctx.grid.lineClear(h.pos, p.pos)) h.target = 'player';
    } else if (d > CONFIG.hostile.aggroRelease) {
      h.target = a.home;
      // a contact windup (at Paul or at an ally) in progress is dropped: it goes back to its post
      if (h.state === 'windup' && (a.windKind === 'contact' || a.windKind === 'brawl')) {
        if (a.windKind === 'contact') this.s.wc--;
        a.windKind = null;
        a.foe = null;
        h.state = 'approach';
      }
    }
  }

  /**
   * The ally a rioter after Paul fights instead of him (CONFIG.services.hostileTargetRadius): the nearest of Paul and
   * the allies within that radius with a clear line (ties: Paul); null = Paul. Never while another windup (a throw, a
   * bottle, an aim, a blow at Paul) runs; during a blow at an ally, that ally (gone: the blow is dropped, Paul again).
   */
  private foeOf(h: Hostile, a: Aux, ctx: HordeCtx): AllyTarget | null {
    const list = ctx.allies?.list ?? [];
    if (h.state === 'windup') {
      if (a.windKind !== 'brawl') return null;
      const foe = list.find((x) => x.id === a.foe);
      if (foe) return foe;
      a.windKind = null;
      a.foe = null;
      h.state = 'approach';
      return null;
    }
    if (list.length === 0) return null;
    const p = ctx.player;
    let bestD = p.ko ? Infinity : dist(h.pos, p.pos);
    let best: AllyTarget | null = null;
    for (const x of list) {
      const d = dist(h.pos, x.pos);
      if (d > CONFIG.services.hostileTargetRadius || d >= bestD) continue;
      if (!ctx.grid.lineClear(h.pos, x.pos)) continue;
      best = x;
      bestD = d;
    }
    return best;
  }

  /** Unit direction of a shooter's current aim line (aiming or firing), else null. */
  aimLine(lifeId: number): Vec | null {
    const a = this.aux.get(lifeId);
    if (!a || (a.windKind !== 'aim' && a.windKind !== 'burst') || !a.aimFrom || !a.throwTo) return null;
    const d = norm(sub(a.throwTo, a.aimFrom));
    return d.x === 0 && d.y === 0 ? null : d;
  }

  /** A shooter aiming or firing its burst right now (render: raised rifle and "!"). */
  aiming(lifeId: number): boolean {
    const k = this.aux.get(lifeId)?.windKind;
    return k === 'aim' || k === 'burst';
  }

  /** A Molotov or firebomber holding up a lit bottle right now (render: raised bottle and "!"). */
  bottleUp(lifeId: number): boolean {
    const k = this.aux.get(lifeId)?.windKind;
    return k === 'molotov' || k === 'bottle';
  }

  /**
   * Walks to its site; within range of an attack point with a clear line, winds up (bottle raised), then throws at
   * the door and turns on Paul as a contact (or as a firebomber when marked `afterThrow`). A KO during the windup throws nothing (KO hostiles are not stepped).
   */
  private molotov(h: Hostile, a: Aux, site: HordeSite, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    if (h.state === 'windup' && a.windKind === 'molotov') {
      if (now < h.stateUntil - EPS) return ZERO;
      a.windKind = null;
      h.state = 'approach';
      h.target = 'player';
      // the attack's last Molotov (from CONFIG.firebomber.fromRound) keeps throwing, at Paul now
      if (a.afterThrow) h.role = a.afterThrow;
      ev.push({ type: 'MolotovThrown', from: { ...h.pos }, to: { ...site.door }, target: h.site as TargetId });
      return ZERO;
    }
    const goal = sitePoint(h, a, site.points);
    if (dist(h.pos, goal) <= CONFIG.molotov.range && ctx.grid.lineClear(h.pos, goal)) {
      // the n-th of a site's Molotovs raising a bottle at once holds it n × MOLOTOV_STAGGER longer (no windup cap applies)
      let latest = now + CONFIG.molotov.windup - MOLOTOV_STAGGER;
      for (const o of this.list)
        if (o !== h && o.site === h.site && o.state === 'windup' && this.auxOf(o).windKind === 'molotov')
          latest = Math.max(latest, o.stateUntil);
      h.state = 'windup';
      h.stateUntil = Math.max(now + CONFIG.molotov.windup, latest + MOLOTOV_STAGGER);
      a.windKind = 'molotov';
      return ZERO;
    }
    return steer(h, a, goal, site.field, now, ctx);
  }
}
