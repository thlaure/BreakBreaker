import { CONFIG } from '../config';
import type { Horde } from '../hostiles';
import type { Rules } from '../rules';
import type { Role, SimEvent, Variant, Vec } from '../types';

export type SchoolStage = 'idle' | 'firstLine' | 'cinematic' | 'reinforcements' | 'saved' | 'destroyed';

export interface SchoolCtx {
  horde: Horde;
  rules: Rules;
  playerInZone: boolean;
  spawns: Vec[];
}

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];
const REINFORCEMENT_ROLES: Role[] = [
  ...Array<Role>(4).fill('degrader'),
  ...Array<Role>(2).fill('contact'),
  ...Array<Role>(2).fill('thrower'),
];

interface Pending {
  variant: Variant;
  role: Role;
}

/**
 * School incident. The reserve is the single source of truth for the countdown: it only decreases while at least
 * one hostile of this incident is degrading the facade, at 1 s/s regardless of how many. Paul's presence is irrelevant.
 */
export class SchoolIncident {
  readonly id = 'school#1';
  stage: SchoolStage = 'idle';
  remaining: number = CONFIG.school.threatSeconds;

  private ids = new Set<number>();
  private pending: Pending[] = [];
  private cinematicLeft = 0;
  private spawnCursor = 0;
  private started = false;
  private wasDecreasing = false;

  integrity(): number {
    return (100 * this.remaining) / CONFIG.school.threatSeconds;
  }

  status(): 'en cours' | 'interrompu' | 'renforts' | 'perdu' | 'sauvé' {
    if (this.stage === 'destroyed') return 'perdu';
    if (this.stage === 'saved') return 'sauvé';
    if (this.stage === 'cinematic') return 'renforts';
    return this.wasDecreasing ? 'en cours' : 'interrompu';
  }

  suspended(): boolean {
    return this.stage === 'cinematic';
  }

  /** Ends the cinematic early: the next step spawns the reinforcements (once). No-op in any other stage. */
  skipCinematic(): void {
    if (this.stage === 'cinematic') this.cinematicLeft = 0;
  }

  start(horde: Horde, spawns: Vec[]): void {
    if (this.stage !== 'idle') return;
    this.stage = 'firstLine';
    const n = CONFIG.school.firstLine;
    for (let i = 0; i < n; i++) this.pending.push({ variant: VARIANTS[i % VARIANTS.length]!, role: 'degrader' });
    this.trySpawn(horde, spawns);
  }

  step(dt: number, ctx: SchoolCtx): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.stage === 'idle' || this.stage === 'saved' || this.stage === 'destroyed') return events;
    this.trySpawn(ctx.horde, ctx.spawns);

    if (this.stage === 'cinematic') {
      this.wasDecreasing = false;
      this.cinematicLeft -= dt;
      if (this.cinematicLeft <= 0) {
        this.stage = 'reinforcements';
        for (let i = 0; i < CONFIG.school.reinforcements; i++)
          this.pending.push({ variant: VARIANTS[i % VARIANTS.length]!, role: REINFORCEMENT_ROLES[i]! });
        this.trySpawn(ctx.horde, ctx.spawns);
      }
      return events;
    }

    const decreasing = this.isDegrading(ctx.horde);
    if (decreasing) {
      if (!this.started) {
        this.started = true;
        events.push({ type: 'BuildingThreatStarted', incidentId: this.id });
      }
      this.remaining = Math.max(0, this.remaining - dt);
    }

    if (this.remaining <= 0) {
      this.stage = 'destroyed';
      this.wasDecreasing = false;
      this.pending = [];
      ctx.rules.award(`${this.id}:lost`, CONFIG.school.lossPenalty);
      events.push({ type: 'BuildingDestroyed', incidentId: this.id });
      return events;
    }

    if (this.pending.length === 0 && this.allKo(ctx.horde)) {
      if (this.stage === 'firstLine') {
        this.stage = 'cinematic';
        this.cinematicLeft = CONFIG.school.cinematicSec;
        this.wasDecreasing = false;
        return events;
      }
      this.stage = 'saved';
      this.wasDecreasing = false;
      ctx.rules.award(`${this.id}:saved`, CONFIG.school.saveBonus);
      events.push({ type: 'SchoolRestored', incidentId: this.id });
      return events;
    }

    if (this.wasDecreasing && !decreasing) events.push({ type: 'BuildingThreatPaused', incidentId: this.id });
    this.wasDecreasing = decreasing;
    return events;
  }

  private isDegrading(horde: Horde): boolean {
    return horde.list.some((h) => h.incidentId === this.id && h.state === 'degrade');
  }

  /** A hostile evicted from the list (old KO bodies are pruned) counts as KO. */
  private allKo(horde: Horde): boolean {
    const alive = new Set<number>();
    for (const h of horde.list) if (h.state !== 'ko') alive.add(h.lifeId);
    for (const id of this.ids) if (alive.has(id)) return false;
    return true;
  }

  /** Spawn pending hostiles round-robin over the spawn points; under the cap they stay pending and retry. */
  private trySpawn(horde: Horde, spawns: Vec[]): void {
    if (spawns.length === 0) return;
    while (this.pending.length > 0) {
      const p = this.pending[0]!;
      const pos = spawns[this.spawnCursor % spawns.length]!;
      const h = horde.spawn({ variant: p.variant, role: p.role, pos, incidentId: this.id });
      if (!h) return;
      this.ids.add(h.lifeId);
      this.spawnCursor++;
      this.pending.shift();
    }
  }
}
