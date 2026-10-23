import { CONFIG } from './config';
import { dist, norm, sub } from './math';
import type { AllyTarget, HordeCtx, Hostile } from './hostiles';
import { roleKnockback } from './hostileRoles';
import { EPS, ZERO, isZero, steer, type Aux } from './hostileSteer';
import type { SimEvent, Vec } from './types';

/** Per-step scratch of the horde: windups at Paul under way (contact / throw), their cap, the contact damage. */
export interface Scratch {
  wc: number;
  wt: number;
  limit: number;
  damage: number;
}

const STRIKE_REACH = 20;
const HIT_REACH = 24;
const STOP_DIST = 16;
const THROW_MIN = 160;
const THROW_MAX = 300;
const THROW_FALLBACK = 80;
const THROW_POSTPONE = 0.25;

/**
 * A rioter fighting an ally (the truck, an officer) in melee, whatever its role: it walks straight at it (the line is
 * clear), winds up CONFIG.hostile.windup within reach (its body `r` added) and its blow, still within reach, takes
 * the contact damage (the Caïd's × damageMul) off the ally's hp. No windup cap, no push.
 */
export function brawl(s: Scratch, h: Hostile, a: Aux, foe: AllyTarget, now: number, ctx: HordeCtx): Vec {
  const extra = Math.max(0, foe.r - CONFIG.player.radius);
  const d = dist(h.pos, foe.pos);
  if (h.state === 'windup') {
    if (now < h.stateUntil - EPS) return ZERO;
    if (d <= HIT_REACH + extra) ctx.allies!.hit(foe.id, blow(s, h));
    a.windKind = null;
    a.foe = null;
    h.state = 'recover';
    h.stateUntil = h.nextAttackAt;
    return ZERO;
  }
  if (h.state === 'approach' && d <= STRIKE_REACH + extra && now >= h.nextAttackAt - EPS) {
    h.state = 'windup';
    h.stateUntil = now + CONFIG.hostile.windup;
    h.nextAttackAt = now + CONFIG.hostile.attackInterval * (h.role === 'boss' ? CONFIG.caid.attackIntervalMul : 1);
    a.windKind = 'brawl';
    a.foe = foe.id;
    return ZERO;
  }
  if (d <= STOP_DIST + extra) return ZERO;
  return steer(h, a, foe.pos, null, now, ctx);
}

/** A landed blow's damage: the pressure's contact damage, the Caïd's × CONFIG.caid.damageMul (rounded). */
export function blow(s: Scratch, h: Hostile): number {
  return h.role === 'boss' ? Math.round(s.damage * CONFIG.caid.damageMul) : s.damage;
}

export function contact(s: Scratch, h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
  const p = ctx.player;
  const d = dist(h.pos, p.pos);
  if (h.state === 'windup') {
    if (now < h.stateUntil - EPS) return ZERO;
    if (d <= HIT_REACH && !p.ko) {
      // a brute or the Caïd also pushes Paul away (straight away from the rioter; its facing toward him when on top)
      const k = roleKnockback(h.role);
      const away = norm(sub(p.pos, h.pos));
      const dir = isZero(away) ? { x: 1, y: 0 } : away;
      // the Caïd hits harder (CONFIG.caid.damageMul, rounded)
      const amount = blow(s, h);
      ev.push(k > 0 ? { type: 'PlayerDamaged', amount, push: { x: dir.x * k, y: dir.y * k } } : { type: 'PlayerDamaged', amount });
    }
    a.windKind = null;
    s.wc--;
    h.state = 'recover';
    h.stateUntil = h.nextAttackAt;
    return ZERO;
  }
  if (h.state === 'approach' && d <= STRIKE_REACH && now >= h.nextAttackAt - EPS && s.wc < s.limit && !p.ko) {
    h.state = 'windup';
    h.stateUntil = now + CONFIG.hostile.windup;
    // the Caïd attacks more often (CONFIG.caid.attackIntervalMul)
    h.nextAttackAt = now + CONFIG.hostile.attackInterval * (h.role === 'boss' ? CONFIG.caid.attackIntervalMul : 1);
    a.windKind = 'contact';
    s.wc++;
    return ZERO;
  }
  if (d <= STOP_DIST) return ZERO;
  return steer(h, a, p.pos, ctx.fields.player, now, ctx);
}

export function thrower(s: Scratch, h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
  const p = ctx.player;
  if (h.state === 'windup' && a.windKind === 'throw') {
    if (now < h.stateUntil - EPS) return ZERO;
    a.windKind = null;
    s.wt--;
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
  if (d < THROW_FALLBACK || (h.state === 'windup' && a.windKind === 'contact')) return contact(s, h, a, now, ctx, ev);
  const clear = ctx.grid.lineClear(h.pos, p.pos);
  if (d > THROW_MAX || !clear) return steer(h, a, p.pos, ctx.fields.player, now, ctx);
  if (d < THROW_MIN) return norm(sub(h.pos, p.pos));
  if (h.state === 'approach' && now >= h.nextAttackAt - EPS && s.wt < s.limit && !p.ko) {
    const to = { ...p.pos };
    h.state = 'windup';
    h.stateUntil = now + Math.max(0.6, CONFIG.rock.windupMin);
    h.nextAttackAt = now + CONFIG.rock.throwInterval;
    a.windKind = 'throw';
    a.throwTo = to;
    s.wt++;
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
export function firebomber(s: Scratch, h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
  const p = ctx.player;
  const fb = CONFIG.firebomber;
  if (h.state === 'windup' && a.windKind === 'bottle') {
    if (now < h.stateUntil - EPS) return ZERO;
    a.windKind = null;
    s.wt--;
    ev.push({ type: 'FirebombThrown', from: { ...h.pos }, to: { ...a.throwTo! }, until: now + fb.flightSec });
    a.throwTo = null;
    h.state = 'recover';
    h.stateUntil = h.nextAttackAt;
    return ZERO;
  }
  const d = dist(h.pos, p.pos);
  if (d < fb.fallback || (h.state === 'windup' && a.windKind === 'contact')) return contact(s, h, a, now, ctx, ev);
  if (d > fb.keepMax || !ctx.grid.lineClear(h.pos, p.pos)) return steer(h, a, p.pos, ctx.fields.player, now, ctx);
  if (d < fb.keepMin) return norm(sub(h.pos, p.pos));
  if (h.state === 'approach' && now >= h.nextAttackAt - EPS && s.wt < s.limit && !p.ko) {
    const to = { ...p.pos };
    h.state = 'windup';
    h.stateUntil = now + fb.windup;
    h.nextAttackAt = now + fb.throwInterval;
    a.windKind = 'bottle';
    a.throwTo = to;
    s.wt++;
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
export function shooter(s: Scratch, h: Hostile, a: Aux, now: number, ctx: HordeCtx, ev: SimEvent[]): Vec {
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
  if (d < c.fallback || (h.state === 'windup' && a.windKind === 'contact')) return contact(s, h, a, now, ctx, ev);
  if (d > c.keepMax || !ctx.grid.lineClear(h.pos, p.pos)) return steer(h, a, p.pos, ctx.fields.player, now, ctx);
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
