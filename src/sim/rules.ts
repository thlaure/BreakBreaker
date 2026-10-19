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

  private readonly koLifeIds = new Set<number>();
  private readonly awardedKeys = new Set<string>();

  /** Returns false if this life was already counted or the session ended. */
  onKnockout(actorLifeId: number): boolean {
    if (this.ended || this.koLifeIds.has(actorLifeId)) return false;
    this.koLifeIds.add(actorLifeId);
    this.score += 1;
    this.kos += 1;
    return true;
  }

  /** Returns false if this key was already awarded or the session ended. */
  award(occurrenceKey: string, points: number): boolean {
    if (this.ended || this.awardedKeys.has(occurrenceKey)) return false;
    this.awardedKeys.add(occurrenceKey);
    this.score += points;
    return true;
  }

  end(cause: 'ko' | 'quit'): void {
    void cause;
    this.ended = true;
  }
}
