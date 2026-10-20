import { CONFIG } from './config';
import type { SpawnRequest, Spawner } from './entry';
import type { Horde } from './hostiles';
import { DISTRICT } from './map/district';
import { dist } from './math';
import type { Player } from './player';
import type { Rules } from './rules';
import type { MonumentFlag, SimEvent, Variant, Vec } from './types';

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];
const EPS = 1e-9;

/** Occupiers of the session's `n`-th occupation (1-based) in `round`: 6 the first time, then min(8, 5 + floor(round / 3)). */
export function occupierCount(n: number, round: number): number {
  const m = CONFIG.monument;
  return n <= 1 ? m.firstOccupiers : Math.min(m.maxOccupiers, 5 + Math.floor(round / 3));
}

/** Inside the capture zone (distance to its centre <= its radius). */
export function inZone(p: Vec): boolean {
  const z = DISTRICT.monument.zone;
  return dist(p, z) <= z.r + EPS;
}

/**
 * The equestrian monument's lasting state (§11): which flag the rider holds, and the capture the flag. It starts
 * French; an occupation can swap it (`swap`). While the flag is Palestinian it stays so — across rounds and breathers,
 * like a ruin — until Paul captures it back: standing in the zone with no active hostile inside advances `progress`
 * (1 s/s) up to CONFIG.monument.captureSec; leaving the zone or a hostile inside pauses it (kept). Each capture
 * scores once per swap (`monument#<swap>:captured`). No hp, not a target.
 */
export class Monument {
  flag: MonumentFlag = 'french';
  /** Seconds of capture held (0..captureSec), kept while paused; back to 0 on a capture or a new swap. */
  progress = 0;
  /** Swaps so far in the session (the n-th swap's capture key uses n). */
  swaps = 0;
  /** Paul in the zone (only tracked while the flag is Palestinian). */
  paulInZone = false;
  /** Paul in the zone but a hostile inside too: the capture is paused (« zone contestée »). */
  contested = false;

  swap(incidentId: string): SimEvent {
    this.flag = 'palestinian';
    this.swaps += 1;
    this.progress = 0;
    return { type: 'FlagSwapped', incidentId, pos: { ...DISTRICT.monument.mast } };
  }

  step(dt: number, ctx: { player: Player; horde: Horde; rules: Rules }): SimEvent[] {
    if (this.flag !== 'palestinian') {
      this.paulInZone = false;
      this.contested = false;
      return [];
    }
    this.paulInZone = !ctx.player.ko && inZone(ctx.player.pos);
    this.contested = this.paulInZone && ctx.horde.list.some((h) => h.state !== 'ko' && inZone(h.pos));
    if (!this.paulInZone || this.contested) return [];
    this.progress = Math.min(CONFIG.monument.captureSec, this.progress + dt);
    if (this.progress < CONFIG.monument.captureSec - EPS) return [];
    this.flag = 'french';
    this.progress = 0;
    this.paulInZone = false;
    this.contested = false;
    ctx.rules.award(`monument#${this.swaps}:captured`, CONFIG.monument.scores.captured);
    return [{ type: 'FlagCaptured', swap: this.swaps, pos: { ...DISTRICT.monument.mast } }];
  }
}

export type MonumentStage = 'idle' | 'occupy' | 'swapped' | 'defended';

export interface MonumentCtx {
  horde: Horde;
  rules: Rules;
  monument: Monument;
}

/**
 * One occupation of the monument (`monument#n`): `count` occupiers (variants round-robin, role degrader, site
 * 'monument') enter through the objective spawner and walk to the plinth. While at least one stands at the plinth
 * (state 'degrade') the swap timer runs at 1 s/s per occupier (at most CONFIG.monument.swapCounted); at swapSec the flag
 * turns Palestinian (−3 once, `:lost`) and the occupation is settled for the round (its rioters still have to be
 * KO'd). Every occupier KO'd first → defended (+4 once, `:saved`).
 */
export class MonumentIncident {
  stage: MonumentStage = 'idle';
  /** Seconds of swap accumulated (0..swapSec). */
  swapTimer = 0;
  private readonly seen = new Set<number>();
  private requested = 0;

  constructor(
    readonly id: string,
    readonly round: number,
    readonly count: number,
    private readonly spawner: Spawner,
  ) {}

  total(): number {
    return this.count;
  }

  /** Sends the occupiers (front of the entry line). False when the flag is already Palestinian. */
  start(monument: Monument): boolean {
    if (this.stage !== 'idle' || monument.flag !== 'french') return false;
    this.stage = 'occupy';
    const reqs: SpawnRequest[] = Array.from({ length: this.count }, (_, i) => ({
      variant: VARIANTS[i % VARIANTS.length]!,
      role: 'degrader' as const,
      incidentId: this.id,
      site: 'monument' as const,
      round: this.round,
    }));
    this.requested = reqs.length;
    this.spawner.request(reqs);
    return true;
  }

  step(dt: number, ctx: MonumentCtx): SimEvent[] {
    if (this.stage !== 'occupy') return [];
    this.track(ctx.horde);
    let atPlinth = 0;
    for (const h of ctx.horde.list) if (h.incidentId === this.id && h.state === 'degrade') atPlinth++;
    if (atPlinth > 0) {
      this.swapTimer += dt * Math.min(CONFIG.monument.swapCounted, atPlinth);
      if (this.swapTimer >= CONFIG.monument.swapSec - EPS) {
        this.swapTimer = CONFIG.monument.swapSec;
        this.stage = 'swapped';
        ctx.rules.award(`${this.id}:lost`, CONFIG.monument.scores.lost);
        return [ctx.monument.swap(this.id)];
      }
      return [];
    }
    if (this.requiredActive(ctx.horde)) return [];
    this.stage = 'defended';
    ctx.rules.award(`${this.id}:saved`, CONFIG.monument.scores.defended);
    return [{ type: 'MonumentDefended', incidentId: this.id }];
  }

  /** The occupation is still urgent (occupiers on their way or at the plinth, flag still French). */
  urgent(): boolean {
    return this.stage === 'occupy';
  }

  /** Over for its round: defended or swapped (after a swap its rioters still count in the round). */
  settled(): boolean {
    return this.stage === 'defended' || this.stage === 'swapped';
  }

  /** Its occupiers still hold their site (the horde sees the plinth): until all are KO'd. */
  live(horde: Horde): boolean {
    return this.stage !== 'idle' && this.stage !== 'defended' && this.requiredActive(horde);
  }

  /** True while an occupier is still to enter or standing (pruned KO bodies count as KO). */
  requiredActive(horde: Horde): boolean {
    this.track(horde);
    if (this.seen.size < this.requested) return true;
    return horde.list.some((h) => h.incidentId === this.id && h.state !== 'ko');
  }

  private track(horde: Horde): void {
    for (const h of horde.list) if (h.incidentId === this.id) this.seen.add(h.lifeId);
  }
}
