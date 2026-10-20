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
}

/** Health, fire and ruin state of every destructible target (school, cars, bus stop). */
export class Targets {
  private readonly st = new Map<TargetId, TargetState>();

  constructor(defs: readonly TargetDef[] = DISTRICT.targets) {
    for (const d of defs)
      this.st.set(d.id, { hp: d.maxHp, maxHp: d.maxHp, burning: false, state: 'intact', lostIncidentId: null });
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

  /** False if already burning or ruined. */
  ignite(id: TargetId): boolean {
    const s = this.get(id);
    if (s.burning || s.state === 'ruined') return false;
    s.burning = true;
    return true;
  }

  extinguish(id: TargetId): void {
    this.get(id).burning = false;
  }

  ruin(id: TargetId, incidentId: string): void {
    const s = this.get(id);
    s.hp = 0;
    s.burning = false;
    s.state = 'ruined';
    s.lostIncidentId = incidentId;
  }

  /** Returns the lost incident id (once) and restores hp to repairPct of max; null if not ruined. */
  repair(id: TargetId): string | null {
    const s = this.get(id);
    if (s.state !== 'ruined') return null;
    const lost = s.lostIncidentId;
    s.state = 'intact';
    s.lostIncidentId = null;
    s.hp = Math.round(s.maxHp * CONFIG.target.repairPct);
    return lost;
  }

  /** End of round: intact targets back to max hp. */
  refill(): void {
    for (const s of this.st.values()) if (s.state === 'intact') s.hp = s.maxHp;
  }

  standing(id: TargetId): boolean {
    return this.get(id).state === 'intact';
  }

  intact(): TargetId[] {
    return [...this.st.keys()].filter((id) => this.standing(id));
  }
}
