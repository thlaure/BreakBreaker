import type { Allies, FighterState } from './allies';
import { CONFIG } from './config';
import { caidHp, type Horde, type Hostile } from './hostiles';
import { moveCircle } from './map/collide';
import { targetDoor } from './map/district';
import type { Grid } from './map/grid';
import type { Targets } from './targets';
import type { SimEvent, Variant, Vec } from './types';

const T = 32;
const C = (tx: number, ty: number): Vec => ({ x: tx * T + T / 2, y: ty * T + T / 2 });

/**
 * The guards' posts around the prison (building 11, door C(41, 42)): both sides of the block and the street in front,
 * each within CONFIG.prison.postRadius of the door, off its attack points.
 */
export const PRISON_POSTS: readonly Vec[] = [C(37, 40), C(38, 43), C(41, 43), C(44, 43), C(44, 40)];

/** A guard's hp in `round`: a Caïd's for that round (caidHp), at least CONFIG.caid.hp (14). */
export function guardHp(round: number): number {
  return Math.max(CONFIG.caid.hp, caidHp(round));
}

/**
 * A Caïd in the cells: `id` a stable inmate id (never reused in a session), `variant` his look on the map (kept on
 * breakout), `round` the round he was jailed in.
 */
export interface PrisonInmate {
  id: number;
  variant: Variant;
  round: number;
}

/** What the render and the HUD read (Snapshot.prison). */
export interface PrisonView {
  /** Caïds in the cells (always inmates.length). */
  jailed: number;
  /** Who is in the cells, in jail order (a copy). */
  inmates: PrisonInmate[];
  /** The guards on the map, by post (a guard carried off after its KO is missing until it comes back). */
  guards: { id: number; pos: Vec; hp: number; maxHp: number; state: FighterState }[];
  standing: boolean;
}

/** What the prison reads on the Sim each step. */
export interface PrisonCtx {
  targets: Targets;
  horde: Horde;
  dt: number;
  /** The director's roster grows by `n` (Director.extend); returns the round to tag the released Caïds with. */
  extend(n: number, ev: SimEvent[]): number;
}

/** Released Caïds fan out at the door: this many per row, this many px apart. */
const FAN_ROW = 5;
const FAN = 12;

/**
 * The prison (target 'prison'): its cells and its guards.
 * Jail: a Caïd knocked out while the prison stands is jailed (CaidJailed; the Sim's KO path, +1 and the Caïd's bonus as
 * before); none while it is ruined. Breakout: the step it falls (by any path), every jailed Caïd comes out at once at
 * its door (PrisonBreakout) with the variant he had with the hp of a Caïd of the round he joins, added to that round's roster (Director.extend);
 * one the hostile cap refuses comes out on a later step (already counted). A rebuilt prison starts empty: the released
 * Caïds stay free (a later KO jails them again).
 * Inmates: each jailed Caïd keeps an identity (PrisonInmate: id, variant, round jailed) for the render's cells. Van: his
 * KO body is carried off (taken out of the horde) CONFIG.prison.pickupSec s after the KO, even if the prison falls
 * meanwhile (he was jailed: the breakout releases him at the door, not where he fell).
 * Guards: CONFIG.prison.guards fighters of role 'guard' (Allies' foot brain) held to PRISON_POSTS with
 * CONFIG.prison.postRadius, guardHp of the round; their blows are bare-hands hits (the Sim's policeStrike). At each round's end (the breather), while the prison stands, a missing
 * or knocked-out guard comes back at its post (GuardsBack) and every guard gets the coming round's hp; a ruined prison
 * gets none back.
 */
export class Prison {
  /** The jailed Caïds, in jail order. */
  private readonly cells: PrisonInmate[] = [];
  private nextInmate = 1;
  /** KO bodies of jailed Caïds the van has not carried off yet: lifeId and seconds left. */
  private readonly vans: { lifeId: number; left: number }[] = [];
  /** The guard (fighter id) holding each post of PRISON_POSTS. */
  private readonly slots: number[];
  private wasStanding = true;
  /** Released Caïds not on the map yet (hostile cap): their look and the round they belong to. */
  private readonly pending: { variant: Variant; round: number }[] = [];

  constructor(
    private readonly allies: Allies,
    private readonly grid: Grid,
  ) {
    this.slots = PRISON_POSTS.map((p) => this.station(p, guardHp(1)));
  }

  get jailed(): number {
    return this.cells.length;
  }

  /** A Caïd knocked out in `round` (the Sim calls this once per life): jailed while the prison stands. */
  jail(h: Hostile, targets: Targets, round: number): SimEvent[] {
    if (!targets.standing('prison')) return [];
    this.cells.push({ id: this.nextInmate++, variant: h.variant, round });
    this.vans.push({ lifeId: h.lifeId, left: CONFIG.prison.pickupSec });
    return [{ type: 'CaidJailed', lifeId: h.lifeId }];
  }

  /** Watches for the fall (breakout) and puts the released Caïds on the map. */
  step(ctx: PrisonCtx): SimEvent[] {
    const ev: SimEvent[] = [];
    // the van carries the bodies off
    for (let i = this.vans.length - 1; i >= 0; i--) {
      const v = this.vans[i]!;
      v.left -= ctx.dt;
      if (v.left > 1e-9) continue;
      ctx.horde.removeBody(v.lifeId);
      this.vans.splice(i, 1);
    }
    const standing = ctx.targets.standing('prison');
    if (this.wasStanding && !standing && this.cells.length > 0) {
      const n = this.cells.length;
      ev.push({ type: 'PrisonBreakout', count: n, pos: targetDoor('prison') });
      const round = ctx.extend(n, ev);
      for (const { variant } of this.cells) this.pending.push({ variant, round });
      this.cells.length = 0;
    }
    this.wasStanding = standing;
    if (this.pending.length > 0) this.release(ctx.horde);
    return ev;
  }

  /** The round `round` is over (breather): back to the posts and the coming round's hp, unless the prison is ruined. */
  onBreather(round: number, targets: Targets): SimEvent[] {
    if (!targets.standing('prison')) return [];
    const hp = guardHp(round + 1);
    let back = false;
    this.slots.forEach((id, i) => {
      const f = this.allies.fighters.find((x) => x.id === id);
      if (f && f.state !== 'down') {
        f.hp = hp;
        f.maxHp = hp;
        return;
      }
      if (f) this.allies.removeFighter(f.id);
      this.slots[i] = this.station(PRISON_POSTS[i]!, hp);
      back = true;
    });
    return back ? [{ type: 'GuardsBack' }] : [];
  }

  view(targets: Targets): PrisonView {
    const guards: PrisonView['guards'] = [];
    for (const id of this.slots) {
      const f = this.allies.fighters.find((x) => x.id === id);
      if (f) guards.push({ id: f.id, pos: { x: f.pos.x, y: f.pos.y }, hp: f.hp, maxHp: f.maxHp, state: f.state });
    }
    return { jailed: this.cells.length, inmates: this.cells.map((c) => ({ ...c })), guards, standing: targets.standing('prison') };
  }

  private station(post: Vec, hp: number): number {
    return this.allies.addFighter('guard', post, { hp, post: { pos: post, radius: CONFIG.prison.postRadius } }).id;
  }

  /** Released Caïds out at the door, fanned along the street, while the hostile cap lets them in. */
  private release(horde: Horde): void {
    const door = targetDoor('prison');
    let k = 0;
    while (this.pending.length > 0) {
      const { variant, round } = this.pending[0]!;
      const col = (k % FAN_ROW) - (FAN_ROW - 1) / 2;
      const row = Math.floor(k / FAN_ROW) % 2;
      const pos = moveCircle(this.grid, door, { x: col * FAN, y: row * FAN }, CONFIG.hostile.radius);
      if (!horde.spawn({ variant, role: 'boss', pos, round })) return;
      this.pending.shift();
      k++;
    }
  }
}
