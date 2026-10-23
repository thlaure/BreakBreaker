import { CONFIG } from './config';
import { DISTRICT } from './map/district';
import { dist, v } from './math';
import { BOOTH_OF, type CallCtx } from './services';
import type { Sim } from './sim';
import type { ServiceKind, SimEvent, TargetId, Vec } from './types';

/** What a fresh Agir press does (or what it lacks) right now: the in-world prompt above `at` (a target's door). */
export type ActionHintKind = 'repair' | 'extinguish' | 'callFire' | 'callPolice' | 'needToolbox';
export interface ActionHint {
  kind: ActionHintKind;
  target: TargetId;
  at: Vec;
  /** needToolbox: the nearest toolbox on the ground (null when none, or for the other kinds). */
  toolbox: Vec | null;
}

const SERVICE_KINDS: readonly ServiceKind[] = ['fire', 'police'];

/** Snapshot.actionHint: the press's own choice (agirChoice), then the toolbox it lacks. */
export function actionHint(sim: Sim): ActionHint | null {
  if (sim.rules.ended || sim.player.ko || sim.school.suspended()) return null;
  const p = sim.player.pos;
  const doorOf = (id: TargetId): Vec => v(DISTRICT.targets.find((t) => t.id === id)!.door);
  const choice = agirChoice(sim);
  if (choice?.kind === 'repair') {
    const kind = sim.targets.get(choice.target).state === 'ruined' ? 'repair' : 'extinguish';
    return { kind, target: choice.target, at: doorOf(choice.target), toolbox: null };
  }
  if (choice?.kind === 'booth' && sim.services.check(choice.service, callCtx(sim, choice.service)).ok) {
    const target = BOOTH_OF[choice.service];
    return { kind: choice.service === 'fire' ? 'callFire' : 'callPolice', target, at: doorOf(target), toolbox: null };
  }
  if (sim.toolboxes.carried) return null;
  const target = sim.toolboxes.repairTarget(p, sim.targets);
  if (target === null) return null;
  let toolbox: Vec | null = null;
  for (const g of sim.toolboxes.ground) if (!toolbox || dist(p, g.pos) < dist(p, toolbox)) toolbox = g.pos;
  return { kind: 'needToolbox', target, at: doorOf(target), toolbox: toolbox ? v(toolbox) : null };
}

/** What a call of `kind` from its booth would weigh now. */
export function callCtx(sim: Sim, kind: ServiceKind): CallCtx {
  let burning = 0;
  for (const t of DISTRICT.targets) if (sim.targets.get(t.id).burning) burning++;
  return {
    burning,
    activeHostiles: sim.horde.active().length,
    boothStanding: sim.targets.standing(BOOTH_OF[kind]),
    // kept in step with the allies (syncServices)
    busy: sim.services.active[kind],
  };
}

/**
 * What a fresh Agir press goes to: the nearest of a repair that would start (Toolboxes.startable, at its target's
 * door) and the booths whose door is within CONFIG.services.callRange of Paul; ties go to the repair, then red, then
 * blue. Null: nothing in reach.
 */
function agirChoice(sim: Sim): { kind: 'booth'; service: ServiceKind } | { kind: 'repair'; target: TargetId } | null {
  const p = sim.player.pos;
  const repair = sim.toolboxes.startable(p, sim.horde, sim.targets);
  let best: ServiceKind | null = null;
  let bestD = repair === null ? Infinity : dist(p, DISTRICT.targets.find((t) => t.id === repair)!.door);
  for (const kind of SERVICE_KINDS) {
    const d = dist(p, DISTRICT.targets.find((t) => t.id === BOOTH_OF[kind])!.door);
    // strictly nearer by more than a rounding error: equal distances keep the earlier candidate
    if (d <= CONFIG.services.callRange && d < bestD - 1e-9) {
      best = kind;
      bestD = d;
    }
  }
  if (best !== null) return { kind: 'booth', service: best };
  return repair === null ? null : { kind: 'repair', target: repair };
}

/**
 * A fresh Agir press (agirChoice): a booth that wins makes the call (ServiceCalled, or ServiceRefused with the
 * reason) and returns its kind; null leaves the press to the toolbox.
 */
export function agirAtBooth(sim: Sim, ev: SimEvent[]): ServiceKind | null {
  const choice = agirChoice(sim);
  if (choice?.kind !== 'booth') return null;
  const best = choice.service;
  const r = sim.services.tryCall(best, callCtx(sim, best));
  if (r.ok) {
    ev.push({ type: 'ServiceCalled', kind: best });
    ev.push(...sim.allies.call(best, sim.now));
    syncServices(sim);
  } else ev.push({ type: 'ServiceRefused', kind: best, reason: r.reason });
  return best;
}

/** Services.active follows the allies: a truck / a police group on the map makes a new call of that kind 'busy'. */
export function syncServices(sim: Sim): void {
  for (const kind of SERVICE_KINDS) sim.services.active[kind] = sim.allies.onMap(kind);
}
