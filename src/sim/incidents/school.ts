import type { Spawner } from '../entry';
import type { Targets } from '../targets';
import type { SimEvent } from '../types';
import { TargetAttack, lineup, type AttackComposition, type AttackStage } from './targetAttack';

export type SchoolStage = AttackStage;
/** The school card's status (an id: src/content/i18n `school.*` reads it). */
export type SchoolStatus = 'burning' | 'attacked' | 'reinforcements' | 'lost' | 'saved';

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

  /** The school's status id (src/content/i18n `school.*` reads it). */
  status(): SchoolStatus {
    if (this.stage === 'destroyed') return 'lost';
    if (this.stage === 'saved') return 'saved';
    if (this.stage === 'cinematic') return 'reinforcements';
    return this.targets.get('school').burning ? 'burning' : 'attacked';
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
