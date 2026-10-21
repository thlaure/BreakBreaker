import type { Vec } from './types';

/** One applied score change and where it happened (null = unknown: the Sim uses Paul's position). */
export interface ScoreEntry {
  points: number;
  at: Vec | null;
}

export interface SessionStats {
  schoolsSaved: number;
  schoolsLost: number;
  rescuesOk: number;
  rescuesFailed: number;
  /** Every target (school included) saved / destroyed, and ruins repaired. */
  targetsSaved: number;
  targetsLost: number;
  repairs: number;
  /** Monument: occupations defended, French flags lost to a swap, flags captured back. */
  monumentsDefended: number;
  flagsLost: number;
  flagsCaptured: number;
  roundsCompleted: number;
  /** Rounds completed with every objective succeeded (bonus). */
  roundsPerfect: number;
  healsUsed: number;
  rocksPicked: number;
  rocksReturned: number;
  rocksHit: number;
  activeSeconds: number;
}

function emptyStats(): SessionStats {
  return {
    schoolsSaved: 0,
    schoolsLost: 0,
    rescuesOk: 0,
    rescuesFailed: 0,
    targetsSaved: 0,
    targetsLost: 0,
    repairs: 0,
    monumentsDefended: 0,
    flagsLost: 0,
    flagsCaptured: 0,
    roundsCompleted: 0,
    roundsPerfect: 0,
    healsUsed: 0,
    rocksPicked: 0,
    rocksReturned: 0,
    rocksHit: 0,
    activeSeconds: 0,
  };
}

/** Dedup memories keep only the most recent entries; older ids/keys are evicted FIFO. */
const DEDUP_WINDOW = 256;

/**
 * Scoring and KO registry for a session.
 * Every rioter KO scores exactly +1 regardless of variant; `kos` is the neutral count.
 * Occurrence bonuses are deduplicated by key. After `end()`, nothing changes.
 * Every applied, non-zero change is also queued with its position (`at`) for the floating score popups; the Sim
 * drains the queue after each step (see `drain`).
 */
export class Rules {
  score = 0;
  kos = 0;
  stats: SessionStats = emptyStats();
  ended = false;
  endCause: 'ko' | 'quit' | null = null;

  // Sets iterate in insertion order, so the first element is the oldest entry.
  private readonly koLifeIds = new Set<number>();
  private readonly awardedKeys = new Set<string>();
  private outbox: ScoreEntry[] = [];

  /** Returns false if this life was already counted or the session ended. `at` = where the rioter was KO'd. */
  onKnockout(actorLifeId: number, at?: Vec): boolean {
    if (this.ended || this.koLifeIds.has(actorLifeId)) return false;
    remember(this.koLifeIds, actorLifeId);
    this.score += 1;
    this.kos += 1;
    this.queue(1, at);
    return true;
  }

  /**
   * Returns false if the points are not finite, this key was already awarded, or the session ended. `at` = where the
   * points were won or lost (a target's door, the victim, the monument…).
   */
  award(occurrenceKey: string, points: number, at?: Vec): boolean {
    if (this.ended || !Number.isFinite(points) || this.awardedKeys.has(occurrenceKey)) return false;
    remember(this.awardedKeys, occurrenceKey);
    this.score += points;
    this.queue(points, at);
    return true;
  }

  /** The score changes applied since the last drain, in order; empties the queue. */
  drain(): ScoreEntry[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  private queue(points: number, at: Vec | undefined): void {
    if (points !== 0) this.outbox.push({ points, at: at ? { x: at.x, y: at.y } : null });
  }

  /** The first call wins; later calls do not change endCause. */
  end(cause: 'ko' | 'quit'): void {
    if (this.endCause === null) this.endCause = cause;
    this.ended = true;
  }

  /** Current sizes of the bounded dedup memories (for tests and diagnostics). */
  dedupSize(): { kos: number; awards: number } {
    return { kos: this.koLifeIds.size, awards: this.awardedKeys.size };
  }
}

function remember<T>(set: Set<T>, value: T): void {
  set.add(value);
  if (set.size > DEDUP_WINDOW) {
    const oldest = set.values().next().value as T;
    set.delete(oldest);
  }
}
