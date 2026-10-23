import { CONFIG } from './config';
import { dist } from './math';
import type { Player } from './player';
import type { Rules } from './rules';
import type { SimEvent, Vec } from './types';

/** Pick-up radius (px) around a station. */
const STATION_RADIUS = 28;

export interface Station {
  id: string;
  pos: Vec;
  charged: boolean;
}

export interface StationCtx {
  player: Player;
  rules: Rules;
}

/** What the HUD tells on a heal station (ids: the HUD translates them, src/content/i18n `station.*`). */
export type StationMessage = 'fullHealth' | 'spent' | null;

/**
 * Heal stations: walking onto a charged station heals at once (no key, no hold).
 * Called after hits/damage and the KO check in Sim.step; skipped entirely when the player is KO.
 * A station is only used when Paul is below max health. Charges come back only through `recharge()` (called between rounds).
 */
export class Stations {
  list: Station[];

  constructor(positions: Vec[]) {
    this.list = positions.map((pos, i) => ({ id: `station#${i}`, pos: { ...pos }, charged: true }));
  }

  /** Every station is usable again. */
  recharge(): void {
    for (const s of this.list) s.charged = true;
  }

  step(ctx: StationCtx): { events: SimEvent[]; message: StationMessage } {
    const events: SimEvent[] = [];
    const { player, rules } = ctx;
    if (player.ko || rules.ended) return { events, message: null };

    const inRange = this.list.filter((s) => dist(player.pos, s.pos) <= STATION_RADIUS);
    const charged = inRange.filter((s) => s.charged).sort((a, b) => dist(player.pos, a.pos) - dist(player.pos, b.pos))[0];
    if (!charged) return { events, message: inRange.length > 0 ? 'spent' : null };
    if (player.hp >= CONFIG.player.maxHp) return { events, message: 'fullHealth' };

    player.hp = Math.min(CONFIG.player.maxHp, player.hp + CONFIG.heal.amount);
    charged.charged = false;
    rules.stats.healsUsed += 1;
    events.push({ type: 'HealCompleted' });
    return { events, message: null };
  }
}
