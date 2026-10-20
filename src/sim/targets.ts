import { CONFIG } from './config';
import { DISTRICT } from './map/district';
import type { TargetDef } from './map/district';
import type { TargetId } from './types';

export interface TargetState {
  hp: number;
  maxHp: number;
  burning: boolean;
  state: 'intact' | 'ruined';
  lostIncidentId: string | null;
  /** Incident whose Molotov set the current fire (null when not burning). */
  fireIncidentId: string | null;
}

/** Health, fire and ruin state of every destructible target (school, cars, bus stop). */
export class Targets {
  private readonly st = new Map<TargetId, TargetState>();

  constructor(defs: readonly TargetDef[] = DISTRICT.targets) {
    for (const d of defs)
      this.st.set(d.id, { hp: d.maxHp, maxHp: d.maxHp, burning: false, state: 'intact', lostIncidentId: null, fireIncidentId: null });
  }

  get(id: TargetId): TargetState {
    const s = this.st.get(id);
    if (!s) throw new Error(`unknown target ${id}`);
    return s;
  }

  /** Lowers hp; true only on the call that ruins the target. */
  damage(id: TargetId, hp: number): boolean {
    const s = this.get(id);
    if (s.state === 'ruined') return false;
    const was = s.hp;
    s.hp = Math.max(0, was - hp);
    return was > 0 && s.hp <= 0;
  }

  /** Sets the target on fire for `incidentId`; false if already burning or ruined. */
  ignite(id: TargetId, incidentId: string): boolean {
    const s = this.get(id);
    if (s.burning || s.state === 'ruined') return false;
    s.burning = true;
    s.fireIncidentId = incidentId;
    return true;
  }

  /** Puts the fire out and restores full health (a toolbox repair always does); returns the incident that set it (null if it was not burning). */
  extinguish(id: TargetId): string | null {
    const s = this.get(id);
    if (!s.burning) return null;
    const incident = s.fireIncidentId;
    s.hp = s.maxHp;
    s.burning = false;
    s.fireIncidentId = null;
    return incident;
  }

  ruin(id: TargetId, incidentId: string): void {
    const s = this.get(id);
    s.hp = 0;
    s.burning = false;
    s.fireIncidentId = null;
    s.state = 'ruined';
    s.lostIncidentId = incidentId;
  }

  /** Returns the lost incident id (once) and restores full health; null if not ruined. */
  repair(id: TargetId): string | null {
    const s = this.get(id);
    if (s.state !== 'ruined') return null;
    const lost = s.lostIncidentId;
    s.state = 'intact';
    s.lostIncidentId = null;
    s.hp = s.maxHp;
    return lost;
  }

  /** End of round: intact targets back to max hp; a burning one is never refilled (it burns until put out). */
  refill(): void {
    for (const s of this.st.values()) if (s.state === 'intact' && !s.burning) s.hp = s.maxHp;
  }

  standing(id: TargetId): boolean {
    return this.get(id).state === 'intact';
  }

  intact(): TargetId[] {
    return [...this.st.keys()].filter((id) => this.standing(id));
  }
}
