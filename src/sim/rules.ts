export interface SessionStats {
  schoolsSaved: number;
  schoolsLost: number;
  rescuesOk: number;
  rescuesFailed: number;
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

  /** Returns false if this life was already counted or the session ended. */
  onKnockout(actorLifeId: number): boolean {
    if (this.ended || this.koLifeIds.has(actorLifeId)) return false;
    remember(this.koLifeIds, actorLifeId);
    this.score += 1;
    this.kos += 1;
    return true;
  }

  /** Returns false if the points are not finite, this key was already awarded, or the session ended. */
  award(occurrenceKey: string, points: number): boolean {
    if (this.ended || !Number.isFinite(points) || this.awardedKeys.has(occurrenceKey)) return false;
    remember(this.awardedKeys, occurrenceKey);
    this.score += points;
    return true;
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
