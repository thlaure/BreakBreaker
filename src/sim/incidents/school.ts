import type { Spawner } from '../entry';
import type { Targets } from '../targets';
import type { SimEvent } from '../types';
import { TargetAttack, lineup, type AttackComposition, type AttackStage } from './targetAttack';

export type SchoolStage = AttackStage;

/**
 * The school attack: a TargetAttack on 'school' whose round-1 lineup opens a reinforcement cinematic once the first
 * line is down (Paul may skip it). Health replaces the old reserve countdown; Paul's position is irrelevant.
 */
export class SchoolIncident extends TargetAttack {
  constructor(targets: Targets, spawner: Spawner, spec: { id?: string; round?: number; comp?: AttackComposition } = {}) {
    const round = spec.round ?? 1;
    super({ id: spec.id ?? 'school#1', target: 'school', comp: spec.comp ?? lineup('school', round, 0), round }, targets, spawner);
  }

  /** School health in percent. */
  integrity(): number {
    const s = this.targets.get('school');
    return (100 * s.hp) / s.maxHp;
  }

  status(): 'en feu' | 'attaquée' | 'renforts' | 'perdue' | 'sauvée' {
    if (this.stage === 'destroyed') return 'perdue';
    if (this.stage === 'saved') return 'sauvée';
    if (this.stage === 'cinematic') return 'renforts';
    return this.targets.get('school').burning ? 'en feu' : 'attaquée';
  }

  suspended(): boolean {
    return this.stage === 'cinematic';
  }

  /** Ends the cinematic early: the next step requests the reinforcements (once). No-op in any other stage. */
  skipCinematic(): void {
    if (this.stage === 'cinematic') this.skip();
  }

  protected override onSaved(): SimEvent[] {
    return [{ type: 'SchoolRestored', incidentId: this.id }];
  }
}
