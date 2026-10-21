import { CONFIG } from './config';
import { moveCircle } from './map/collide';
import type { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist, norm, sub } from './math';
import type { HostileView, Player } from './player';
import type { Bullets } from './bullets';
import type { Rocks } from './projectiles';
import { SpatialHash } from './spatial';
import type { Role, SimEvent, SiteId, TargetId, Variant, Vec } from './types';

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
}

/** Per-hostile AI bookkeeping kept out of the public Hostile shape. */
interface Aux {
  /**
   * 'bottle' = a firebomber's Molotov aimed at Paul (counts in the throw windup cap like a rock); 'aim' / 'burst' = a
   * shooter aiming, then firing its burst (no windup cap: shooters are few).
   */
  windKind: 'contact' | 'throw' | 'molotov' | 'bottle' | 'aim' | 'burst' | null;
  /** Shooter: the fixed line of the current aim (from its position at aim start toward where Paul stood). */
  aimFrom: Vec | null;
  /** Shooter: bullets left in the burst and when the next one leaves. */
  shotsLeft: number;
  nextShotAt: number;
  /** A Molotov marked so turns into this role once its bottle hit its site (then it goes for Paul). */
  afterThrow: 'firebomber' | null;
  throwTo: Vec | null;
  /** Index of the site attack point this degrader / Molotov goes for. */
  pointIdx: number | null;
  progressPos: Vec;
  progressAt: number;
  /** Until this time, steer by flow field even when a straight line looks clear (set when stuck). */
  fieldUntil: number;
  /** Post a site-bound rioter returns to after engaging Paul (null = none, or it left it for good). */
  home: 'facade' | 'victim' | null;
  /** Sim time it first reached its post (degrading its site / threatening its victim), null before. */
  postAt: number | null;
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
/** Extra windup per Molotov of the same site already winding up: their bottles never leave on the same step. */
const MOLOTOV_STAGGER = 0.25;
const EPS = 1e-9;
const ZERO: Vec = { x: 0, y: 0 };

const isZero = (v: Vec): boolean => v.x === 0 && v.y === 0;

/** Starting HP of a rioter of `role`: runner, brute and Caïd have their own (CONFIG.runner / brute / caid). */
export function roleHp(role: Role): number {
  if (role === 'runner') return CONFIG.runner.hp;
  if (role === 'brute') return CONFIG.brute.hp;
  if (role === 'boss') return CONFIG.caid.hp;
  if (role === 'shooter') return CONFIG.shooter.hp;
  return CONFIG.hostile.baseHp;
}

/** Speed factor of `role` over CONFIG.hostile.speed. */
export function roleSpeedMul(role: Role): number {
  if (role === 'runner') return CONFIG.runner.speedMul;
  if (role === 'brute') return CONFIG.brute.speedMul;
  if (role === 'boss') return CONFIG.caid.speedMul;
  return 1;
}

/** Px a landed blow of `role` pushes Paul (0 = none). */
export function roleKnockback(role: Role): number {
  return role === 'brute' ? CONFIG.brute.knockback : role === 'boss' ? CONFIG.caid.knockback : 0;
}

/** A brute or the Caïd: a held weapon's strike does CONFIG.toughWeaponDamage instead of a one-hit KO. */
export function isTough(role: Role): boolean {
  return role === 'brute' || role === 'boss';
}

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
    const maxHp = opts.maxHp ?? roleHp(opts.role);
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
    this.few = act.length <= CONFIG.hostile.fewLeft;
    for (const h of act) {
      if (h.state !== 'windup') continue;
      const k = this.auxOf(h).windKind;
      if (k === 'throw' || k === 'bottle') this.wt++;
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
      if (a.postAt === null && (h.state === 'degrade' || h.state === 'threaten')) a.postAt = now;
      const delta = this.separation(h, ctx.player.pos);
      if (!isZero(want)) {
        const speed = CONFIG.hostile.speed * roleSpeedMul(h.role);
        delta.x += want.x * speed * dt;
        delta.y += want.y * speed * dt;
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
    this.engage(h, a, now, ctx);
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
    if (h.role === 'firebomber') return this.firebomber(h, a, now, ctx, ev);
    if (h.role === 'shooter') return this.shooter(h, a, now, ctx, ev);
    return this.contact(h, a, now, ctx, ev);
  }

  /**
   * Draws a site-bound rioter (degrader, victim aggressor) to Paul: it fights him (target 'player', as a contact) while
   * he is within aggroRadius with a clear line, until he is beyond aggroRelease; then it goes back to its post. With
   * few hostiles left, a degrader at its post for more than postSec leaves it for good; a victim aggressor never does
   * (it keeps robbing the victim until Paul comes close). A Molotov (or a rioter turned contact) is never concerned.
   */
  private engage(h: Hostile, a: Aux, now: number, ctx: HordeCtx): void {
    if (a.home === null || (h.role !== 'degrader' && h.role !== 'aggressor')) return;
    const lost = a.home === 'facade' ? !this.siteOf(h, ctx) : !ctx.victimPos;
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
      // a contact windup in progress is dropped: it goes back to its post
      if (h.state === 'windup' && a.windKind === 'contact') {
        a.windKind = null;
        this.wc--;
        h.state = 'approach';
      }
    }
  }

  private contact(h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    const p = ctx.player;
    const d = dist(h.pos, p.pos);
    if (h.state === 'windup') {
      if (now < h.stateUntil - EPS) return ZERO;
      if (d <= HIT_REACH && !p.ko) {
        // a brute or the Caïd also pushes Paul away (straight away from the rioter; its facing toward him when on top)
        const k = roleKnockback(h.role);
        const away = norm(sub(p.pos, h.pos));
        const dir = isZero(away) ? { x: 1, y: 0 } : away;
        ev.push(k > 0 ? { type: 'PlayerDamaged', amount: this.damage, push: { x: dir.x * k, y: dir.y * k } } : { type: 'PlayerDamaged', amount: this.damage });
      }
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

  /**
   * Like a rock thrower with a lit bottle (CONFIG.firebomber): keeps keepMin–keepMax px from Paul with a clear line,
   * winds up (EnemyThrowStarted, aimed at where Paul stands now) then throws (FirebombThrown, landing `flightSec`
   * later where he stood: a moving Paul dodges it). Paul within `fallback` px → a contact. KO'd during the windup:
   * nothing is thrown (KO hostiles are not stepped).
   */
  private firebomber(h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    const p = ctx.player;
    const fb = CONFIG.firebomber;
    if (h.state === 'windup' && a.windKind === 'bottle') {
      if (now < h.stateUntil - EPS) return ZERO;
      a.windKind = null;
      this.wt--;
      ev.push({ type: 'FirebombThrown', from: { ...h.pos }, to: { ...a.throwTo! }, until: now + fb.flightSec });
      a.throwTo = null;
      h.state = 'recover';
      h.stateUntil = h.nextAttackAt;
      return ZERO;
    }
    const d = dist(h.pos, p.pos);
    if (d < fb.fallback || (h.state === 'windup' && a.windKind === 'contact')) return this.contact(h, a, now, ctx, ev);
    if (d > fb.keepMax || !ctx.grid.lineClear(h.pos, p.pos)) return this.steer(h, a, p.pos, ctx.fields.player, now, ctx);
    if (d < fb.keepMin) return norm(sub(h.pos, p.pos));
    if (h.state === 'approach' && now >= h.nextAttackAt - EPS && this.wt < this.limit && !p.ko) {
      const to = { ...p.pos };
      h.state = 'windup';
      h.stateUntil = now + fb.windup;
      h.nextAttackAt = now + fb.throwInterval;
      a.windKind = 'bottle';
      a.throwTo = to;
      this.wt++;
      ev.push({ type: 'EnemyThrowStarted', from: { ...h.pos }, to: { ...to }, until: h.stateUntil });
    }
    return ZERO;
  }

  /**
   * Cartoon AK-47 (CONFIG.shooter): keeps keepMin–keepMax px from Paul with a clear line (else walks in, or backs off
   * when too close), aims aimSec at where Paul stands now (ShooterAimStarted: the red aim line), then fires `burst`
   * bullets burstGap s apart along that fixed line (BulletFired each; a moving Paul dodges), then reloads reloadSec.
   * Paul within `fallback` px → a contact. KO'd while aiming: nothing is fired (KO hostiles are not stepped).
   */
  private shooter(h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
    const p = ctx.player;
    const c = CONFIG.shooter;
    if (h.state === 'windup' && a.windKind === 'aim') {
      if (now < h.stateUntil - EPS) return ZERO;
      a.windKind = 'burst';
      a.shotsLeft = c.burst;
      a.nextShotAt = now;
    }
    if (h.state === 'windup' && a.windKind === 'burst') {
      if (now >= a.nextShotAt - EPS && a.shotsLeft > 0) {
        const from = a.aimFrom!;
        const b = ctx.bullets?.fire(from, sub(a.throwTo!, from));
        if (b) ev.push({ type: 'BulletFired', id: b.id });
        a.shotsLeft -= 1;
        a.nextShotAt = now + c.burstGap;
      }
      if (a.shotsLeft > 0) return ZERO;
      a.windKind = null;
      a.aimFrom = null;
      a.throwTo = null;
      h.state = 'recover';
      h.stateUntil = now + c.reloadSec;
      h.nextAttackAt = now + c.reloadSec;
      return ZERO;
    }
    const d = dist(h.pos, p.pos);
    if (d < c.fallback || (h.state === 'windup' && a.windKind === 'contact')) return this.contact(h, a, now, ctx, ev);
    if (d > c.keepMax || !ctx.grid.lineClear(h.pos, p.pos)) return this.steer(h, a, p.pos, ctx.fields.player, now, ctx);
    if (d < c.keepMin) return norm(sub(h.pos, p.pos));
    if (h.state === 'approach' && now >= h.nextAttackAt - EPS && !p.ko) {
      h.state = 'windup';
      h.stateUntil = now + c.aimSec;
      a.windKind = 'aim';
      a.aimFrom = { ...h.pos };
      a.throwTo = { ...p.pos };
      ev.push({ type: 'ShooterAimStarted', lifeId: h.lifeId, from: { ...h.pos }, to: { ...p.pos }, until: h.stateUntil });
    }
    return ZERO;
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
    const goal = this.sitePoint(h, a, site.points);
    if (dist(h.pos, goal) <= CONFIG.molotov.range && ctx.grid.lineClear(h.pos, goal)) {
      // the n-th of a site's Molotovs raising a bottle at once holds it n × MOLOTOV_STAGGER longer (no windup cap applies)
      let latest = now + CONFIG.molotov.windup - MOLOTOV_STAGGER;
      for (const o of this.list)
        if (o !== h && o.site === h.site && o.state === 'windup' && this.auxOf(o).windKind === 'molotov') latest = Math.max(latest, o.stateUntil);
      h.state = 'windup';
      h.stateUntil = Math.max(now + CONFIG.molotov.windup, latest + MOLOTOV_STAGGER);
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
