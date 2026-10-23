import { CONFIG } from './config';
import type { Horde } from './hostiles';
import { DISTRICT, targetDoor } from './map/district';
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
  /** Agir (F / touch Agir) was pressed this step: a rising edge (the Sim turns the held key into it). */
  act: boolean;
}

const EPS = 1e-9;

/**
 * Toolboxes: up to CONFIG.kit.maxGround lie on the ground, Paul carries at most one (walk over it to take it).
 * Next to a ruin or a burning target with a toolbox and no hostile close, pressing Agir (F / touch Agir) starts the
 * repair (a ruin is rebuilt, a fire is put out; either way the target is back to full health); it then
 * completes after CONFIG.kit.repairSec without holding the key. Moving away from the door, a hostile coming close or a
 * KO resets the progress and the start (a new press is needed).
 */
export class Toolboxes {
  ground: { id: number; pos: Vec }[] = [];
  carried = false;
  /** Seconds of repair done so far (0..repairSec). */
  progress = 0;
  repairing: TargetId | null = null;
  /** Agir was pressed while the repair could start: it now progresses on its own. */
  started = false;
  /** Last step: a toolbox carried, a target to repair in range, no hostile close (Agir would start the repair). */
  ready = false;
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

  /**
   * The target needing the toolbox whose door is within applyRange of Paul: a ruin (nearest first), else a burning
   * target (nearest first); null if none.
   */
  repairTarget(player: Vec, targets: Targets): TargetId | null {
    let best: TargetId | null = null;
    let bestRank = Infinity;
    for (const def of DISTRICT.targets) {
      const s = targets.get(def.id);
      const ruined = s.state === 'ruined';
      if (!ruined && !s.burning) continue;
      const d = dist(player, def.door);
      if (d > CONFIG.kit.applyRange) continue;
      // ruins first: their rank stays below any burning target's
      const rank = d + (ruined ? 0 : 1e6);
      if (rank < bestRank) {
        best = def.id;
        bestRank = rank;
      }
    }
    return best;
  }

  /**
   * The target a fresh Agir press would start repairing now (a toolbox carried, a target in reach, no hostile within
   * safetyRadius), or null: what the Sim weighs against the phone booths for the press.
   */
  startable(player: Vec, horde: Horde, targets: Targets): TargetId | null {
    if (!this.carried) return null;
    const target = this.repairTarget(player, targets);
    if (target === null) return null;
    return horde.active().some((h) => dist(h.pos, player) <= CONFIG.kit.safetyRadius) ? null : target;
  }

  step(dt: number, ctx: ToolboxCtx): { events: SimEvent[]; message: ToolboxMessage } {
    const events: SimEvent[] = [];
    const { player, horde, targets, rules } = ctx;
    this.ready = false;
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

    if (this.repairing !== target) this.reset();
    this.repairing = target;
    this.ready = true;
    if (!this.started && !ctx.act) return { events, message: null };
    this.started = true;
    this.progress += dt;
    if (this.progress + EPS >= CONFIG.kit.repairSec) {
      this.carried = false;
      const n = (this.repairCount.get(target) ?? 0) + 1;
      this.repairCount.set(target, n);
      const kind = DISTRICT.targets.find((d) => d.id === target)!.kind;
      if (targets.get(target).state === 'ruined') {
        const lost = targets.repair(target);
        const key = lost !== null ? `${lost}:repaired` : `${target}:repaired#${n}`;
        rules.award(key, CONFIG.casse.scores[kind][2], targetDoor(target));
        events.push({ type: 'TargetRepaired', target, incidentId: lost ?? key });
      } else {
        const fire = targets.extinguish(target);
        const key = fire !== null ? `${fire}:extinguished` : `${target}:extinguished#${n}`;
        rules.award(key, CONFIG.casse.scores[kind][2], targetDoor(target));
        events.push({ type: 'FireOut', target });
        events.push({ type: 'TargetRepaired', target, incidentId: fire ?? key });
      }
      this.reset();
    }
    return { events, message: null };
  }

  private reset(): void {
    this.progress = 0;
    this.repairing = null;
    this.started = false;
  }
}
