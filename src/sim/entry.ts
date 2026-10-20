import { CONFIG } from './config';
import type { Horde, Hostile } from './hostiles';
import type { Role, TargetId, Variant, Vec } from './types';

export interface SpawnRequest {
  variant: Variant;
  role: Role;
  incidentId?: string;
  site?: TargetId;
  round?: number;
  /** A Molotov turning into this role after its throw at its site (the attack's last one, from round 3). */
  afterThrow?: 'firebomber';
}

/** `front` jumps the line; `interval` paces the batch; `firstDelay` overrides the wait before its first rioter. */
export interface RequestOpts {
  front?: boolean;
  interval?: number;
  firstDelay?: number;
}

/** Where incidents and the director send the rioters they want on the map. */
export interface Spawner {
  request(reqs: SpawnRequest[], opts?: RequestOpts): void;
}

export interface EntryCfg {
  firstDelay: number;
  interval: number;
  gate: number;
}

interface Batch {
  reqs: SpawnRequest[];
  front: boolean;
  interval: number;
  /** Seconds until this batch may let its next rioter in (counts down from the request on). */
  wait: number;
}

const EPS = 1e-9;

function spawnAt(horde: Horde, r: SpawnRequest, pos: Vec): Hostile | null {
  return horde.spawn({ variant: r.variant, role: r.role, pos, incidentId: r.incidentId, site: r.site, round: r.round, afterThrow: r.afterThrow });
}

/**
 * The line of rioters waiting to enter the map. Only the head batch lets rioters in: its first one `firstDelay`
 * after the request, then one every `interval` (the next batch keeps that pace), and only while fewer than `gate`
 * hostiles are active. A rioter refused by the 40 cap stays at the head and retries next step. `front` batches go
 * before every non-front batch.
 */
export class EntryQueue implements Spawner {
  private batches: Batch[] = [];
  private cursor = 0;

  constructor(private readonly cfg: EntryCfg = CONFIG.round) {}

  get length(): number {
    let n = 0;
    for (const b of this.batches) n += b.reqs.length;
    return n;
  }

  pendingForRound(round: number): number {
    let n = 0;
    for (const b of this.batches) for (const r of b.reqs) if (r.round === round) n++;
    return n;
  }

  clear(): void {
    this.batches = [];
  }

  request(reqs: SpawnRequest[], opts: RequestOpts = {}): void {
    if (reqs.length === 0) return;
    const b: Batch = {
      reqs: reqs.map((r) => ({ ...r })),
      front: opts.front ?? false,
      interval: opts.interval ?? this.cfg.interval,
      wait: opts.firstDelay ?? this.cfg.firstDelay,
    };
    if (!b.front) {
      this.batches.push(b);
      return;
    }
    const i = this.batches.findIndex((x) => !x.front);
    if (i < 0) this.batches.push(b);
    else this.batches.splice(i, 0, b);
  }

  /** Lets at most one rioter in, round-robin over `points`; returns the hostiles that entered. */
  step(dt: number, horde: Horde, points: Vec[]): Hostile[] {
    for (const b of this.batches) b.wait -= dt;
    const head = this.batches[0];
    if (!head || points.length === 0 || head.wait > EPS) return [];
    if (horde.active().length >= this.cfg.gate) return [];
    const h = spawnAt(horde, head.reqs[0]!, points[this.cursor % points.length]!);
    if (!h) return [];
    this.cursor++;
    head.reqs.shift();
    head.wait = head.interval;
    if (head.reqs.length === 0) {
      this.batches.shift();
      // keep the pace across batches: the next one never enters sooner than one interval later
      const next = this.batches[0];
      if (next) next.wait = Math.max(next.wait, head.interval);
    }
    return [h];
  }
}

/**
 * Spawns every request at once, round-robin over the spawn points it reads when spawning; requests refused by
 * the 40 cap stay pending and are retried by `step()`. The slice-1 loop and unit tests use it.
 */
export class ImmediateSpawner implements Spawner {
  private pending: SpawnRequest[] = [];
  private cursor = 0;

  constructor(
    private readonly horde: Horde,
    private readonly points: () => Vec[],
  ) {}

  get length(): number {
    return this.pending.length;
  }

  request(reqs: SpawnRequest[]): void {
    this.pending.push(...reqs.map((r) => ({ ...r })));
    this.step();
  }

  step(): Hostile[] {
    const out: Hostile[] = [];
    const pts = this.points();
    if (pts.length === 0) return out;
    while (this.pending.length > 0) {
      const h = spawnAt(this.horde, this.pending[0]!, pts[this.cursor % pts.length]!);
      if (!h) break;
      out.push(h);
      this.cursor++;
      this.pending.shift();
    }
    return out;
  }
}
