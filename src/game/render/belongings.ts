import type { Snapshot } from '../../sim/sim';

type Rescue = NonNullable<Snapshot['rescue']>;
type ItemState = Rescue['items'][number]['state'];

/** What the victim shouts when one of its belongings was just taken (ids from RESCUE_ITEMS). */
export const ITEM_SHOUTS: Readonly<Record<string, string>> = {
  handbag: 'MON SAC !',
  hat: 'MON CHAPEAU !',
  cane: 'MA CANNE !',
  backpack: 'MON SAC À DOS !',
  scarf: 'MON ÉCHARPE !',
  cap: 'MA CASQUETTE !',
};

/** How long the « MON SAC ! » shout and the « MERCI ! » for a belonging handed back stay up. */
export const SHOUT_MS = 2000;
export const THANKS_MS = 2000;

export type VictimBubble = 'help' | 'thanks' | `shout:${string}` | null;

const OUT: ReadonlySet<ItemState> = new Set<ItemState>(['carried-by-thief', 'dropped', 'carried']);

/**
 * The victim's mood, from snapshot changes only (render side, no sim events): a belonging just stolen → its shout for
 * SHOUT_MS; one handed back → « MERCI ! » for THANKS_MS. Keyed on the rescue id: a new rescue starts afresh.
 */
export class VictimMood {
  private key = '';
  private readonly prev = new Map<string, ItemState>();
  private shoutItem: string | null = null;
  private shoutUntil = -Infinity;
  private thanksUntil = -Infinity;

  /** Call once per frame with the current rescue; returns the bubble to show. */
  update(rescue: Rescue, timeMs: number): VictimBubble {
    if (rescue.id !== this.key) {
      this.key = rescue.id;
      this.prev.clear();
      this.shoutItem = null;
      this.shoutUntil = -Infinity;
      this.thanksUntil = -Infinity;
    }
    for (const it of rescue.items) {
      const before = this.prev.get(it.id);
      if (before !== undefined && before !== it.state) {
        if (it.state === 'carried-by-thief') {
          this.shoutItem = it.id;
          this.shoutUntil = timeMs + SHOUT_MS;
        } else if (it.state === 'returned') this.thanksUntil = timeMs + THANKS_MS;
      }
      this.prev.set(it.id, it.state);
    }
    const shout = this.shoutItem !== null && timeMs < this.shoutUntil ? (`shout:${this.shoutItem}` as const) : null;
    const thanks = timeMs < this.thanksUntil;
    if (rescue.stage === 'threat') {
      if (shout && (!thanks || this.shoutUntil >= this.thanksUntil)) return shout;
      return thanks ? 'thanks' : 'help';
    }
    if (rescue.stage === 'secured') {
      if (thanks || rescue.returnLeft === null) return 'thanks';
      // waiting for its belongings: it keeps asking for the first one still out
      const missing = rescue.items.find((it) => OUT.has(it.state));
      return missing ? `shout:${missing.id}` : 'thanks';
    }
    return rescue.stage === 'completed' ? 'thanks' : null;
  }
}
