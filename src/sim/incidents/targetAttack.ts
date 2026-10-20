import { CONFIG } from '../config';
import type { SpawnRequest, Spawner } from '../entry';
import type { Horde } from '../hostiles';
import { DISTRICT } from '../map/district';
import type { Rules } from '../rules';
import type { Targets } from '../targets';
import type { CasseKind, Role, SimEvent, TargetId, Variant } from '../types';

export type AttackStage = 'idle' | 'attack' | 'cinematic' | 'reinforcements' | 'fireOut' | 'saved' | 'destroyed';

/** Rioters of one attack: the first line at start, the reinforcements after the cinematic (round-1 school only). */
export interface AttackComposition {
  firstLine: SpawnRequest[];
  reinforcements: SpawnRequest[];
}

export interface AttackCtx {
  horde: Horde;
  rules: Rules;
}

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];

/**
 * Who attacks a target of `kind` in `round` at `pressure`. Requests carry `round`; the attack stamps its own
 * `incidentId` and `site` when it requests them (a car lineup fits either car). Variants cycle over the whole list.
 */
export function lineup(kind: CasseKind, round: number, pressure: number): AttackComposition {
  let first: Role[];
  let reinf: Role[] = [];
  if (kind === 'school' && round === 1) {
    first = ['molotov', 'degrader', 'degrader'];
    reinf = [...Array<Role>(4).fill('degrader'), ...Array<Role>(3).fill('contact')];
  } else if (kind === 'school') {
    first = ['molotov', 'degrader', 'degrader', 'contact'];
    const extra = Math.min(6, 2 + Math.floor(pressure / 3));
    for (let i = 0; i < extra; i++) first.push(i % 2 === 0 ? 'degrader' : 'contact');
  } else {
    first = ['molotov', 'degrader', 'degrader', 'contact'];
    const extra = Math.min(3, Math.floor(pressure / 4));
    for (let i = 0; i < extra; i++) first.push('contact');
  }
  let v = 0;
  const req = (role: Role): SpawnRequest => ({ variant: VARIANTS[v++ % VARIANTS.length]!, role, round });
  const firstLine = first.map(req);
  return { firstLine, reinforcements: reinf.map(req) };
}

function kindOf(target: TargetId): CasseKind {
  const def = DISTRICT.targets.find((t) => t.id === target);
  if (!def) throw new Error(`unknown target ${target}`);
  return def.kind;
}

/**
 * An attack on one target. Its Molotov sets the target on fire (`onMolotov`); fire and its degraders drain the
 * target's hp each step. hp 0 → destroyed (ruin, loss points). Every rioter of the attack KO'd → the fire dies
 * out `fireOutSec` later → saved (bonus). With reinforcements, the first line's fall opens a cinematic first.
 */
export class TargetAttack {
  readonly id: string;
  readonly target: TargetId;
  readonly kind: CasseKind;
  readonly round: number;
  stage: AttackStage = 'idle';

  private readonly comp: AttackComposition;
  /** Rioters requested from the spawner so far. */
  private requested = 0;
  /** Every rioter of this attack seen on the map (pruned KO bodies stay counted here). */
  private readonly seen = new Set<number>();
  private timer = 0;
  private threatened = false;

  constructor(
    spec: { id: string; target: TargetId; comp: AttackComposition; round: number },
    protected readonly targets: Targets,
    private readonly spawner: Spawner,
  ) {
    this.id = spec.id;
    this.target = spec.target;
    this.kind = kindOf(spec.target);
    this.round = spec.round;
    this.comp = spec.comp;
  }

  total(): number {
    return this.comp.firstLine.length + this.comp.reinforcements.length;
  }

  /** Requests the first line. False (and stays idle) on a ruined target. */
  start(): boolean {
    if (this.stage !== 'idle' || !this.targets.standing(this.target)) return false;
    this.stage = 'attack';
    this.send(this.comp.firstLine);
    return true;
  }

  /** A bottle landed on a target: sets this attack's target on fire while it is being attacked. */
  onMolotov(e: Extract<SimEvent, { type: 'MolotovThrown' }>): SimEvent[] {
    if (e.target !== this.target || !this.urgent()) return [];
    return this.targets.ignite(this.target) ? [{ type: 'TargetIgnited', target: this.target }] : [];
  }

  step(dt: number, ctx: AttackCtx): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.stage === 'idle' || this.resolved()) return ev;
    this.track(ctx.horde);

    if (this.stage === 'cinematic') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.stage = 'reinforcements';
        this.send(this.comp.reinforcements);
        this.track(ctx.horde);
      }
      return ev;
    }

    if (this.stage === 'fireOut') {
      // the defence is over: the dying fire no longer costs hp
      this.timer -= dt;
      if (this.timer > 1e-9) return ev;
      this.targets.extinguish(this.target);
      this.stage = 'saved';
      ev.push({ type: 'FireOut', target: this.target });
      ctx.rules.award(`${this.id}:saved`, CONFIG.casse.scores[this.kind][0]);
      ev.push({ type: 'TargetSaved', incidentId: this.id, target: this.target });
      ev.push(...this.onSaved());
      return ev;
    }

    const st = this.targets.get(this.target);
    const degraders = ctx.horde.list.filter((h) => h.incidentId === this.id && h.state === 'degrade').length;
    const dps =
      (st.burning ? CONFIG.target.fireDps : 0) + Math.min(CONFIG.target.maxDegraders, degraders) * CONFIG.target.degradeDps;
    if (dps > 0 && !this.threatened) {
      // first hp lost: the alarm cue (audio) for this incident
      this.threatened = true;
      ev.push({ type: 'BuildingThreatStarted', incidentId: this.id });
    }
    if (dps > 0 && this.targets.damage(this.target, dps * dt)) {
      // rioters still to come stay in the round: with no site left they go for Paul
      this.targets.ruin(this.target, this.id);
      this.stage = 'destroyed';
      ctx.rules.award(`${this.id}:lost`, CONFIG.casse.scores[this.kind][1]);
      ev.push({ type: 'BuildingDestroyed', incidentId: this.id, target: this.target });
      return ev;
    }

    if (!this.requiredActive(ctx.horde)) {
      if (this.stage === 'attack' && this.comp.reinforcements.length > 0) {
        this.stage = 'cinematic';
        this.timer = CONFIG.school.cinematicSec;
      } else {
        this.stage = 'fireOut';
        this.timer = CONFIG.target.fireOutSec;
      }
    }
    return ev;
  }

  urgent(): boolean {
    return this.stage === 'attack' || this.stage === 'cinematic' || this.stage === 'reinforcements';
  }

  resolved(): boolean {
    return this.stage === 'saved' || this.stage === 'destroyed';
  }

  /** True while a rioter of this attack is still to enter or standing (pruned KO bodies count as KO). */
  requiredActive(horde: Horde): boolean {
    this.track(horde);
    if (this.seen.size < this.requested) return true;
    return horde.list.some((h) => h.incidentId === this.id && h.state !== 'ko');
  }

  /** Ends the cinematic: the next step requests the reinforcements. */
  protected skip(): void {
    if (this.stage === 'cinematic') this.timer = 0;
  }

  /** Extra events on success (the school adds `SchoolRestored`). */
  protected onSaved(): SimEvent[] {
    return [];
  }

  private send(reqs: SpawnRequest[]): void {
    if (reqs.length === 0) return;
    this.requested += reqs.length;
    this.spawner.request(reqs.map((r) => ({ ...r, incidentId: this.id, site: this.target, round: this.round })));
  }

  private track(horde: Horde): void {
    for (const h of horde.list) if (h.incidentId === this.id) this.seen.add(h.lifeId);
  }
}
