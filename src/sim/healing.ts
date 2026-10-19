import { CONFIG } from './config';
import { dist } from './math';
import type { Player } from './player';
import type { Rules } from './rules';
import type { SimEvent, Vec } from './types';

/** Interaction radius (px) around a station. */
const STATION_RADIUS = 28;
const EPS = 1e-9;

export interface Station {
  id: string;
  pos: Vec;
  charged: boolean;
  progress: number;
}

export interface StationCtx {
  player: Player;
  actHeld: boolean;
  moved: boolean;
  damagedThisStep: boolean;
  rules: Rules;
}

export type StationMessage = 'Santé au maximum' | 'Épuisé' | null;

/**
 * Heal stations: hold `act` for CONFIG.heal.interactSec near a charged station to heal.
 * Called after hits/damage and the KO check in Sim.step; skipped entirely when the player is KO.
 * Charges do not regenerate in this slice.
 */
export class Stations {
  list: Station[];

  constructor(positions: Vec[]) {
    this.list = positions.map((pos, i) => ({ id: `station#${i}`, pos: { ...pos }, charged: true, progress: 0 }));
  }

  step(dt: number, ctx: StationCtx): { events: SimEvent[]; message: StationMessage } {
    const events: SimEvent[] = [];
    const { player, rules } = ctx;
    if (player.ko || rules.ended) return { events, message: null };

    const inRange = this.list.filter((s) => dist(player.pos, s.pos) <= STATION_RADIUS);
    let active: Station | null = null;
    let best = Infinity;
    for (const s of inRange) {
      const d = dist(player.pos, s.pos);
      if (s.charged && d < best) {
        best = d;
        active = s;
      }
    }

    const full = player.hp >= CONFIG.player.maxHp;
    const holding = ctx.actHeld && !ctx.moved && !ctx.damagedThisStep;
    const progressing = active !== null && !full && holding;

    // Any station with progress that is not progressing this step gets reset.
    let interrupted = false;
    for (const s of this.list) {
      if (s.progress > 0 && !(progressing && s === active)) {
        s.progress = 0;
        interrupted = true;
      }
    }
    if (interrupted) events.push({ type: 'HealInterrupted' });

    if (progressing && active) {
      active.progress += dt;
      if (active.progress >= CONFIG.heal.interactSec - EPS) {
        player.hp = Math.min(CONFIG.player.maxHp, player.hp + CONFIG.heal.amount);
        active.charged = false;
        active.progress = 0;
        rules.stats.healsUsed += 1;
        events.push({ type: 'HealCompleted' });
      }
    }

    let message: StationMessage = null;
    if (active) {
      if (full) message = 'Santé au maximum';
    } else if (inRange.length > 0) {
      message = 'Épuisé';
    }
    return { events, message };
  }
}
