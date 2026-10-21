import { CONFIG } from '../config';
import type { Horde } from '../hostiles';
import type { Spawner } from '../entry';
import type { Grid } from '../map/grid';
import { dist } from '../math';
import type { Player } from '../player';
import type { Rules } from '../rules';
import type { SimEvent, Variant, Vec } from '../types';

export type RescueKind = 'groupHarassed' | 'elderlyRobbed';
export type RescueStage = 'threat' | 'secured' | 'completed' | 'failed';
export type ItemState = 'held' | 'carried-by-thief' | 'dropped' | 'carried' | 'returned' | 'lost';

/**
 * The victim's belongings, by kind (ordinary things only; stolen in this order). `id` keys the bonus and the render
 * icon; `name` is what the HUD and the bubbles say.
 */
export const RESCUE_ITEMS: Readonly<Record<RescueKind, readonly { id: string; name: string }[]>> = {
  elderlyRobbed: [
    { id: 'handbag', name: 'sac à main' },
    { id: 'hat', name: 'chapeau' },
    { id: 'cane', name: 'canne' },
  ],
  groupHarassed: [
    { id: 'backpack', name: 'sac à dos' },
    { id: 'scarf', name: 'écharpe' },
    { id: 'cap', name: 'casquette' },
  ],
};

/** One belonging of the victim. `pos`: where it is (the victim, its thief, the ground, Paul). */
export interface RescueItem {
  id: string;
  name: string;
  state: ItemState;
  pos: Vec;
  /** lifeId of the rioter carrying it ('carried-by-thief'), else null. */
  thief: number | null;
}

export interface RescueCtx {
  horde: Horde;
  rules: Rules;
  player: Player;
  /** Where aggressors still waiting to spawn go when the rescue fails (they still count in the round). */
  spawner?: Spawner;
}

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];
const SPAWN_MIN_FROM_PLAYER = 160;
const OFFSET_MIN = 48;
const OFFSET_MAX = 80;
const ATTEMPTS = 16;
const EPS = 1e-9;
/** Free-point search for a dropped belonging: rings every 8 px up to 96 px, 16 angles. */
const RING_PX = 8;
const SEARCH_PX = 96;
const ANGLES = 16;

/**
 * Rescue incident: aggressors threaten a victim at `victimPos`. The distress reserve only drains while an aggressor
 * is threatening. Knocking them all out secures the victim (reserve frozen); CONFIG.rescue.thanksSec later the rescue
 * completes by itself (+bonus once) — no key, no range, no hold.
 * Belongings: at each CONFIG.rescue.theftAt share of the reserve left, the nearest active aggressor steals the next
 * belonging (only if one is alive). A thief KO drops it on the nearest free point; Paul walks over it to carry it and
 * hands every carried one back near the victim (+itemBonus each, once). Secured with belongings still out, the victim
 * waits up to returnSec for them before the thanks beat; whatever is still out then (or on failure) is lost.
 * The victim is not a Hostile, so it is never part of Horde.views() and cannot be hit by sweeps or rocks.
 */
export class RescueIncident {
  kind: RescueKind = 'groupHarassed';
  victimPos: Vec = { x: 0, y: 0 };
  stage: RescueStage = 'threat';
  remaining: number = CONFIG.rescue.threatSeconds;
  /** Seconds since the victim was secured (the "MERCI !" beat before completion). */
  thanks = 0;
  /** Round number shown in RescueStarted (set by the director). */
  wave = 0;
  /** Objective shown in RescueStarted (the director sets the round total); null = its own aggressors. */
  shownTotal: number | null = null;
  /** Round its aggressors belong to (null = outside any round's roster). */
  round: number | null = null;

  /** The victim's belongings (set by start()). */
  items: RescueItem[] = [];
  /** Seconds left of the wait for the belongings while secured, or null (not waiting). */
  returnLeft: number | null = null;

  private ids = new Set<number>();
  /** Theft thresholds already passed (CONFIG.rescue.theftAt). */
  private thefts = 0;
  private pending = 0;
  private announced = false;
  private rand: () => number = Math.random;
  private grid: Grid | null = null;

  constructor(readonly id: string) {}

  /** Rioters to knock out in this rescue: aggressors already spawned plus those still waiting to spawn. */
  get total(): number {
    return this.ids.size + this.pending;
  }

  /** `count` fixes the number of aggressors (default: random within CONFIG.rescue.aggressors); `round` tags them. */
  start(
    horde: Horde,
    site: Vec,
    rand: () => number,
    playerPos: Vec,
    grid: Grid,
    opts: { count?: number; round?: number } = {},
  ): void {
    this.rand = rand;
    this.grid = grid;
    this.victimPos = { ...site };
    this.round = opts.round ?? null;
    this.kind = rand() < 0.5 ? 'groupHarassed' : 'elderlyRobbed';
    this.items = RESCUE_ITEMS[this.kind].slice(0, CONFIG.rescue.itemCount).map((it) => ({
      id: it.id,
      name: it.name,
      state: 'held' as ItemState,
      pos: { ...site },
      thief: null,
    }));
    const [lo, hi] = CONFIG.rescue.aggressors;
    this.pending = opts.count ?? lo + Math.floor(rand() * (hi - lo + 1));
    this.trySpawn(horde, playerPos);
  }

  step(dt: number, ctx: RescueCtx): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.stage === 'completed' || this.stage === 'failed') return events;
    if (!this.announced) {
      this.announced = true;
      events.push({
        type: 'RescueStarted',
        incidentId: this.id,
        pos: { ...this.victimPos },
        kind: this.kind,
        wave: this.wave,
        total: this.shownTotal ?? this.total,
      });
    }

    if (this.stage === 'threat') {
      this.trySpawn(ctx.horde, ctx.player.pos);
      if (this.threatening(ctx.horde)) this.remaining = Math.max(0, this.remaining - dt);

      if (this.remaining <= 0) {
        this.stage = 'failed';
        this.loseOutstanding();
        // aggressors still to spawn are in the round total: they enter from the edges and go for Paul
        const left = Array.from({ length: this.pending }, (_, i) => ({
          variant: VARIANTS[(this.ids.size + i) % VARIANTS.length]!,
          role: 'contact' as const,
          round: this.round ?? undefined,
        }));
        this.pending = 0;
        ctx.spawner?.request(left);
        for (const h of ctx.horde.list) {
          if (!this.ids.has(h.lifeId) || h.state === 'ko') continue;
          h.role = 'contact';
          h.target = 'player';
          h.incidentId = null;
        }
        events.push({ type: 'RescueFailed', incidentId: this.id });
        return events;
      }
      this.steal(ctx.horde, events);
      this.followThieves(ctx.horde, events);
      this.handOver(ctx, events);
      if (this.pending === 0 && this.allKo(ctx.horde)) {
        this.stage = 'secured';
        this.thanks = 0;
        this.returnLeft = this.outstanding() > 0 ? CONFIG.rescue.returnSec : null;
        events.push({ type: 'RescueSecured', incidentId: this.id });
      }
      return events;
    }

    // secured: the victim waits for its belongings (if any is still out), thanks Paul, then the rescue completes
    this.followThieves(ctx.horde, events);
    this.handOver(ctx, events);
    if (this.returnLeft !== null) {
      if (this.outstanding() === 0) this.returnLeft = null;
      else {
        this.returnLeft = Math.max(0, this.returnLeft - dt);
        if (this.returnLeft > EPS) return events;
        this.returnLeft = null;
        this.loseOutstanding();
      }
    }
    this.thanks += dt;
    if (this.thanks >= CONFIG.rescue.thanksSec - EPS) {
      this.stage = 'completed';
      this.loseOutstanding();
      ctx.rules.award(`${this.id}:ok`, CONFIG.rescue.bonus, this.victimPos);
      events.push({ type: 'RescueCompleted', incidentId: this.id });
    }
    return events;
  }

  /** Belongings Paul carries. */
  get carried(): number {
    return this.items.reduce((n, it) => n + (it.state === 'carried' ? 1 : 0), 0);
  }

  /** Belongings taken and not back yet (with a thief, on the ground or carried by Paul). */
  outstanding(): number {
    let n = 0;
    for (const it of this.items) if (it.state === 'carried-by-thief' || it.state === 'dropped' || it.state === 'carried') n++;
    return n;
  }

  /** Each theft threshold passed steals the next belonging, if an aggressor of this rescue is alive. */
  private steal(horde: Horde, events: SimEvent[]): void {
    const at = CONFIG.rescue.theftAt;
    while (this.thefts < at.length && this.remaining <= at[this.thefts]! * CONFIG.rescue.threatSeconds + EPS) {
      this.thefts++;
      const item = this.items.find((it) => it.state === 'held');
      if (!item) continue;
      let thief: (typeof horde.list)[number] | null = null;
      let best = Infinity;
      for (const h of horde.list) {
        if (!this.ids.has(h.lifeId) || h.state === 'ko') continue;
        const d = dist(h.pos, this.victimPos);
        if (d < best) {
          best = d;
          thief = h;
        }
      }
      if (!thief) continue;
      item.state = 'carried-by-thief';
      item.thief = thief.lifeId;
      item.pos = { ...thief.pos };
      events.push({ type: 'ItemStolen', rescueId: this.id, item: item.id, thiefLifeId: thief.lifeId });
    }
  }

  /** A belonging follows its thief; a thief KO'd (or pruned) drops it on the nearest free point. */
  private followThieves(horde: Horde, events: SimEvent[]): void {
    for (const it of this.items) {
      if (it.state !== 'carried-by-thief') continue;
      const h = horde.list.find((x) => x.lifeId === it.thief);
      if (h) it.pos = { ...h.pos };
      if (h && h.state !== 'ko') continue;
      it.state = 'dropped';
      it.thief = null;
      it.pos = this.freePoint(it.pos);
      events.push({ type: 'ItemDropped', rescueId: this.id, item: it.id, pos: { ...it.pos } });
    }
  }

  /** Paul picks up what lies within pickupRadius, then hands every carried belonging back within returnRadius. */
  private handOver(ctx: RescueCtx, events: SimEvent[]): void {
    const p = ctx.player.pos;
    for (const it of this.items) {
      if (it.state !== 'dropped' || dist(it.pos, p) > CONFIG.rescue.pickupRadius) continue;
      if (this.carried >= CONFIG.rescue.itemCount) break;
      it.state = 'carried';
      events.push({ type: 'ItemPickedUp', rescueId: this.id, item: it.id });
    }
    for (const it of this.items) if (it.state === 'carried') it.pos = { ...p };
    if (dist(p, this.victimPos) > CONFIG.rescue.returnRadius) return;
    for (const it of this.items) {
      if (it.state !== 'carried') continue;
      it.state = 'returned';
      it.pos = { ...this.victimPos };
      ctx.rules.award(`${this.id}:item:${it.id}`, CONFIG.rescue.itemBonus, this.victimPos);
      events.push({ type: 'ItemReturned', rescueId: this.id, item: it.id });
    }
  }

  /** Whatever was taken and is not back is gone for good. */
  private loseOutstanding(): void {
    for (const it of this.items) {
      if (it.state !== 'carried-by-thief' && it.state !== 'dropped' && it.state !== 'carried') continue;
      it.state = 'lost';
      it.thief = null;
    }
  }

  /** `p` when a belonging can lie there, else the nearest free point on rings around it (fixed angle order). */
  private freePoint(p: Vec): Vec {
    const g = this.grid;
    const r = CONFIG.player.radius;
    if (!g || !g.circleBlocked(p, r)) return { ...p };
    for (let d = RING_PX; d <= SEARCH_PX; d += RING_PX) {
      for (let k = 0; k < ANGLES; k++) {
        const a = (k / ANGLES) * Math.PI * 2;
        const q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
        if (!g.circleBlocked(q, r)) return q;
      }
    }
    return { ...this.victimPos };
  }

  private threatening(horde: Horde): boolean {
    return horde.list.some((h) => this.ids.has(h.lifeId) && h.state === 'threaten');
  }

  /** A hostile evicted from the list (old KO bodies are pruned) counts as KO. */
  private allKo(horde: Horde): boolean {
    const alive = new Set<number>();
    for (const h of horde.list) if (h.state !== 'ko') alive.add(h.lifeId);
    for (const id of this.ids) if (alive.has(id)) return false;
    return true;
  }

  /** Spawn around the site on walkable points >= 160 px from Paul. Failures (cap, no valid point) stay pending. */
  private trySpawn(horde: Horde, playerPos: Vec): void {
    while (this.pending > 0) {
      const pos = this.pickPoint(playerPos);
      if (!pos) return;
      const h = horde.spawn({
        variant: VARIANTS[this.ids.size % VARIANTS.length]!,
        role: 'aggressor',
        pos,
        incidentId: this.id,
        target: 'victim',
        round: this.round ?? undefined,
      });
      if (!h) return;
      this.ids.add(h.lifeId);
      this.pending--;
    }
  }

  private pickPoint(playerPos: Vec): Vec | null {
    for (let i = 0; i < ATTEMPTS; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = OFFSET_MIN + this.rand() * (OFFSET_MAX - OFFSET_MIN);
      const p = { x: this.victimPos.x + Math.cos(a) * r, y: this.victimPos.y + Math.sin(a) * r };
      if (dist(p, playerPos) < SPAWN_MIN_FROM_PLAYER) continue;
      if (this.grid && this.grid.circleBlocked(p, CONFIG.hostile.radius)) continue;
      return p;
    }
    return null;
  }
}
