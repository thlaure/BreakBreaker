import type { BeatKind } from './directorPlan';
import type { EntryQueue, Spawner } from './entry';
import type { Stations } from './healing';
import type { Horde } from './hostiles';
import type { RescueIncident } from './incidents/rescue';
import type { SchoolIncident } from './incidents/school';
import type { TargetAttack } from './incidents/targetAttack';
import type { Grid } from './map/grid';
import type { Monument, MonumentIncident } from './monument';
import type { Player } from './player';
import type { Toolboxes } from './repair';
import type { Rules } from './rules';
import type { Targets } from './targets';
import type { Weapons } from './weapons';

export interface RoundSummary {
  index: number;
  kos: number;
  objectives: { kind: BeatKind; result: 'réussi' | 'perdu' }[];
  /** Score earned during the round, bonus included. */
  points: number;
  bonus: boolean;
}

/** What the director reads and drives on the Sim (kept as an interface to avoid an import cycle). */
export interface DirectorHost {
  readonly player: Player;
  readonly horde: Horde;
  readonly rules: Rules;
  readonly grid: Grid;
  readonly rand: () => number;
  readonly targets: Targets;
  readonly queue: EntryQueue;
  /** Puts objective rioters at the front of the entry queue. */
  readonly objectiveSpawner: Spawner;
  readonly stations: Stations;
  readonly toolboxes: Toolboxes;
  readonly weapons: Weapons;
  /** Every target attack of the session still worth stepping, smouldering ones included (the director prunes resolved ones). */
  readonly attacks: TargetAttack[];
  school: SchoolIncident;
  rescue: RescueIncident | null;
  /** The equestrian monument's flag and capture (lasting state). */
  readonly monument: Monument;
  /** Monument occupations of the session still worth stepping (the director prunes finished ones at round start). */
  readonly occupations: MonumentIncident[];
}

/** One incident of a round: prepared at round start (its rioters count in the total), launched by its beat. */
export interface Objective {
  kind: BeatKind;
  attack: TargetAttack | null;
  rescue: RescueIncident | null;
  occupation?: MonumentIncident | null;
  /** Rioters it brings. */
  count: number;
  launched: boolean;
  /** Its target was gone at launch time: its rioters joined the fill instead. */
  dropped: boolean;
}

/** Every launched, unsettled objective is in its timed wind-down with no rioter left (a victim thanking Paul). */
export function windingDown(objectives: readonly Objective[]): boolean {
  let open = 0;
  for (const o of objectives) {
    if (settled(o)) continue;
    open++;
    if (o.attack || o.occupation || o.rescue!.stage !== 'secured') return false;
  }
  return open > 0;
}

/** Over for this round: an attack saved, destroyed or smouldering (its fire outlives the round), a rescue resolved. */
export function settled(o: Objective): boolean {
  if (o.dropped) return true;
  if (o.attack) return o.attack.settled();
  if (o.occupation) return o.occupation.settled();
  const st = o.rescue!.stage;
  return st === 'completed' || st === 'failed';
}

/** A smouldering target still stands: réussi (until it burns down). */
export function succeeded(o: Objective): boolean {
  if (o.occupation) return o.occupation.stage === 'defended';
  return o.attack ? o.attack.stage === 'saved' || o.attack.stage === 'smoulder' : o.rescue!.stage === 'completed';
}

export function urgent(host: Pick<DirectorHost, 'rescue' | 'attacks' | 'occupations'>): number {
  let n = host.rescue?.stage === 'threat' ? 1 : 0;
  for (const a of host.attacks) if (a.urgent()) n++;
  for (const m of host.occupations) if (m.urgent()) n++;
  return n;
}
