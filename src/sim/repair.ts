import { CONFIG } from './config';
import type { Horde } from './hostiles';
import { DISTRICT } from './map/district';
import { dist } from './math';
import type { Player } from './player';
import type { Rules } from './rules';
import type { Targets } from './targets';
import type { SimEvent, TargetId, Vec } from './types';

export type ToolboxMessage = 'Caisse à outils requise' | 'Abords non sécurisés' | null;

export interface ToolboxCtx {
  player: Player;
  horde: Horde;
  targets: Targets;
  rules: Rules;
}

const EPS = 1e-9;

/**
 * Toolboxes: up to CONFIG.kit.maxGround lie on the ground, Paul carries at most one (walk over it to take it).
 * Standing next to a ruin with a toolbox and no hostile close repairs it by itself after CONFIG.kit.repairSec;
 * moving away from the door or a hostile coming close resets the progress. No key is involved.
 */
export class Toolboxes {
  ground: { id: number; pos: Vec }[] = [];
  carried = false;
  /** Seconds of repair done so far (0..repairSec). */
  progress = 0;
  repairing: TargetId | null = null;
  private nextId = 1;
  private readonly repairCount = new Map<TargetId, number>();

  /** Fills the ground up to maxGround on free sites at least minPlaceFromPlayer from Paul; sites come in walkable. */
  place(sites: Vec[], player: Vec): SimEvent[] {
    const events: SimEvent[] = [];
    for (const site of sites) {
      if (this.ground.length >= CONFIG.kit.maxGround) break;
      if (dist(site, player) < CONFIG.kit.minPlaceFromPlayer) continue;
      if (this.ground.some((g) => g.pos.x === site.x && g.pos.y === site.y)) continue;
      const id = this.nextId++;
      this.ground.push({ id, pos: { ...site } });
      events.push({ type: 'ToolboxSpawned', id, pos: { ...site } });
    }
    return events;
  }

  /** The ruined target whose door is within applyRange of Paul (nearest first), if any. */
  repairTarget(player: Vec, targets: Targets): TargetId | null {
    let best: TargetId | null = null;
    let bestD = Infinity;
    for (const def of DISTRICT.targets) {
      if (targets.get(def.id).state !== 'ruined') continue;
      const d = dist(player, def.door);
      if (d <= CONFIG.kit.applyRange && d < bestD) {
        best = def.id;
        bestD = d;
      }
    }
    return best;
  }

  step(dt: number, ctx: ToolboxCtx): { events: SimEvent[]; message: ToolboxMessage } {
    const events: SimEvent[] = [];
    const { player, horde, targets, rules } = ctx;
    if (player.ko || rules.ended) {
      this.reset();
      return { events, message: null };
    }

    if (!this.carried) {
      const taken = this.ground.find((g) => dist(g.pos, player.pos) <= CONFIG.kit.pickupRadius);
      if (taken) {
        this.ground = this.ground.filter((g) => g !== taken);
        this.carried = true;
        events.push({ type: 'ToolboxPickedUp', id: taken.id });
      }
    }

    const target = this.repairTarget(player.pos, targets);
    if (!target) {
      this.reset();
      return { events, message: null };
    }
    if (!this.carried) {
      this.reset();
      return { events, message: 'Caisse à outils requise' };
    }
    const hostile = horde.active().some((h) => dist(h.pos, player.pos) <= CONFIG.kit.safetyRadius);
    if (hostile) {
      this.reset();
      return { events, message: 'Abords non sécurisés' };
    }

    if (this.repairing !== target) this.progress = 0;
    this.repairing = target;
    this.progress += dt;
    if (this.progress + EPS >= CONFIG.kit.repairSec) {
      const lost = targets.repair(target);
      this.carried = false;
      const n = (this.repairCount.get(target) ?? 0) + 1;
      this.repairCount.set(target, n);
      const key = lost !== null ? `${lost}:repaired` : `${target}:repaired#${n}`;
      const kind = DISTRICT.targets.find((d) => d.id === target)!.kind;
      rules.award(key, CONFIG.casse.scores[kind][2]);
      events.push({ type: 'TargetRepaired', target, incidentId: lost ?? key });
      this.reset();
    }
    return { events, message: null };
  }

  private reset(): void {
    this.progress = 0;
    this.repairing = null;
  }
}
