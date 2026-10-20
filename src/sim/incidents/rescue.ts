import { CONFIG } from '../config';
import type { Horde } from '../hostiles';
import type { Grid } from '../map/grid';
import { dist } from '../math';
import type { Player } from '../player';
import type { Rules } from '../rules';
import type { SimEvent, Variant, Vec } from '../types';

export type RescueKind = 'groupHarassed' | 'elderlyRobbed';
export type RescueStage = 'threat' | 'secured' | 'completed' | 'failed';

export interface RescueCtx {
  horde: Horde;
  rules: Rules;
  player: Player;
}

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];
const SPAWN_MIN_FROM_PLAYER = 160;
const OFFSET_MIN = 48;
const OFFSET_MAX = 80;
const ATTEMPTS = 16;

/**
 * Rescue incident: aggressors threaten a victim at `victimPos`. The distress reserve only drains while an aggressor
 * is threatening. Knocking them all out secures the victim (reserve frozen); CONFIG.rescue.thanksSec later the rescue
 * completes by itself (+bonus once) — no key, no range, no hold.
 * The victim is not a Hostile, so it is never part of Horde.views() and cannot be hit by sweeps or rocks.
 */
export class RescueIncident {
  kind: RescueKind = 'groupHarassed';
  victimPos: Vec = { x: 0, y: 0 };
  stage: RescueStage = 'threat';
  remaining: number = CONFIG.rescue.threatSeconds;
  /** Seconds since the victim was secured (the "MERCI !" beat before completion). */
  thanks = 0;

  private ids = new Set<number>();
  private pending = 0;
  private announced = false;
  private rand: () => number = Math.random;
  private grid: Grid | null = null;

  constructor(readonly id: string) {}

  start(horde: Horde, site: Vec, rand: () => number, playerPos: Vec, grid: Grid): void {
    this.rand = rand;
    this.grid = grid;
    this.victimPos = { ...site };
    this.kind = rand() < 0.5 ? 'groupHarassed' : 'elderlyRobbed';
    const [lo, hi] = CONFIG.rescue.aggressors;
    this.pending = lo + Math.floor(rand() * (hi - lo + 1));
    this.trySpawn(horde, playerPos);
  }

  step(dt: number, ctx: RescueCtx): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.stage === 'completed' || this.stage === 'failed') return events;
    if (!this.announced) {
      this.announced = true;
      events.push({ type: 'RescueStarted', incidentId: this.id, pos: { ...this.victimPos }, kind: this.kind });
    }

    if (this.stage === 'threat') {
      this.trySpawn(ctx.horde, ctx.player.pos);
      if (this.threatening(ctx.horde)) this.remaining = Math.max(0, this.remaining - dt);

      if (this.remaining <= 0) {
        this.stage = 'failed';
        this.pending = 0;
        for (const h of ctx.horde.list) {
          if (!this.ids.has(h.lifeId) || h.state === 'ko') continue;
          h.role = 'contact';
          h.target = 'player';
          h.incidentId = null;
        }
        events.push({ type: 'RescueFailed', incidentId: this.id });
        return events;
      }
      if (this.pending === 0 && this.allKo(ctx.horde)) {
        this.stage = 'secured';
        this.thanks = 0;
        events.push({ type: 'RescueSecured', incidentId: this.id });
      }
      return events;
    }

    // secured: the victim thanks Paul, then the rescue completes by itself
    this.thanks += dt;
    if (this.thanks >= CONFIG.rescue.thanksSec - 1e-9) {
      this.stage = 'completed';
      ctx.rules.award(`${this.id}:ok`, CONFIG.rescue.bonus);
      events.push({ type: 'RescueCompleted', incidentId: this.id });
    }
    return events;
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
