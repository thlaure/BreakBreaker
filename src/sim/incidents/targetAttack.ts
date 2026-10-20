import { CONFIG } from '../config';
import type { SpawnRequest, Spawner } from '../entry';
import type { Horde } from '../hostiles';
import { DISTRICT } from '../map/district';
import type { Rules } from '../rules';
import type { Targets } from '../targets';
import type { CasseKind, Role, SimEvent, TargetId, Variant } from '../types';

/**
 * `smoulder`: every rioter KO but the target still burns; the attack is settled for the round, the fire keeps eating hp
 * (CONFIG.target.smoulderDps) until a toolbox puts it out (→ saved) or the target falls (→ destroyed).
 */
export type AttackStage = 'idle' | 'attack' | 'cinematic' | 'reinforcements' | 'smoulder' | 'saved' | 'destroyed';

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

/** Molotov throwers of an attack in `round`: min(4, 1 + floor(round / 2)), at most 2 on a prop (car, bus stop). */
export function molotovCount(kind: CasseKind, round: number): number {
  return Math.min(kind === 'school' ? 4 : 2, 1 + Math.floor(round / 2));
}

/**
 * Who attacks a target of `kind` in `round` at `pressure`. Requests carry `round`; the attack stamps its own
 * `incidentId` and `site` when it requests them (a car lineup fits either car). Variants cycle over the whole list.
 * Molotov throwers come on top of the rest of the lineup, at the head of the first line; the round-1 school keeps one
 * in its first line and sends a second one with its reinforcements, after the cinematic. From round CONFIG.firebomber.fromRound the last Molotov is marked
 * `afterThrow: 'firebomber'` (it throws at Paul after its bottle hit the site).
 */
export function lineup(kind: CasseKind, round: number, pressure: number): AttackComposition {
  let first: Role[];
  let reinf: Role[] = [];
  if (kind === 'school' && round === 1) {
    first = ['molotov', 'degrader', 'degrader'];
    reinf = ['molotov', ...Array<Role>(4).fill('degrader'), ...Array<Role>(3).fill('contact')];
  } else {
    first = [...Array<Role>(molotovCount(kind, round)).fill('molotov'), 'degrader', 'degrader', 'contact'];
    if (kind === 'school') {
      const extra = Math.min(6, 2 + Math.floor(pressure / 3));
      for (let i = 0; i < extra; i++) first.push(i % 2 === 0 ? 'degrader' : 'contact');
    } else {
      const extra = Math.min(3, Math.floor(pressure / 4));
      for (let i = 0; i < extra; i++) first.push('contact');
    }
  }
  let v = 0;
  const req = (role: Role): SpawnRequest => ({ variant: VARIANTS[v++ % VARIANTS.length]!, role, round });
  const firstLine = first.map(req);
  const reinforcements = reinf.map(req);
  if (round >= CONFIG.firebomber.fromRound) {
    // the attack's last Molotov throws at Paul after its bottle hit the site
    const last = [...firstLine, ...reinforcements].filter((r) => r.role === 'molotov').pop();
    if (last) last.afterThrow = 'firebomber';
  }
  return { firstLine, reinforcements };
}

function kindOf(target: TargetId): CasseKind {
  const def = DISTRICT.targets.find((t) => t.id === target);
  if (!def) throw new Error(`unknown target ${target}`);
  return def.kind;
}

/**
 * An attack on one target. Its Molotov sets the target on fire (`onMolotov`); fire and its degraders drain the
 * target's hp each step. hp 0 → destroyed (ruin, loss points). Every rioter of the attack KO'd → saved (bonus) when
 * nothing burns; otherwise it smoulders: the fire never goes out by itself, it keeps eating hp until a toolbox puts it
 * out (saved, no bonus here: the toolbox scores) or the target falls (destroyed). With reinforcements, the first line's
 * fall opens a cinematic first.
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

  /**
   * A bottle landed on a target while it is being attacked: sets it on fire, or, already burning, takes
   * CONFIG.molotov.burstDamage hp off it (ruin path as for the fire).
   */
  onMolotov(e: Extract<SimEvent, { type: 'MolotovThrown' }>, ctx: AttackCtx): SimEvent[] {
    if (e.target !== this.target || !this.urgent()) return [];
    if (this.targets.get(this.target).burning) {
      // already on fire: no new ignition (no banner, no alarm) but the bottle still hurts
      const ev: SimEvent[] = [];
      if (this.targets.damage(this.target, CONFIG.molotov.burstDamage)) this.destroy(ctx, ev);
      return ev;
    }
    if (!this.targets.ignite(this.target, this.id)) return [];
    const door = DISTRICT.targets.find((t) => t.id === this.target)!.door;
    return [{ type: 'TargetIgnited', target: this.target, incidentId: this.id, kind: this.kind, pos: { ...door }, round: this.round }];
  }

  step(dt: number, ctx: AttackCtx): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.stage === 'idle' || this.resolved()) return ev;
    this.track(ctx.horde);
    if (!this.targets.standing(this.target)) {
      // ruined by another source: this attack is lost too, but the ruin and its penalty were already counted
      this.lose();
      return ev;
    }

    if (this.stage === 'cinematic') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.stage = 'reinforcements';
        this.send(this.comp.reinforcements);
        this.track(ctx.horde);
      }
      return ev;
    }

    const st = this.targets.get(this.target);
    if (this.stage === 'smoulder') {
      if (!st.burning) {
        // put out by a toolbox (which scored it): saved, for the stats only
        this.stage = 'saved';
        ev.push({ type: 'TargetSaved', incidentId: this.id, target: this.target });
        ev.push(...this.onSaved());
        return ev;
      }
      if (this.targets.damage(this.target, CONFIG.target.smoulderDps * dt)) this.destroy(ctx, ev);
      return ev;
    }

    const degraders = ctx.horde.list.filter((h) => h.incidentId === this.id && h.state === 'degrade').length;
    const dps =
      (st.burning ? CONFIG.target.fireDps : 0) + Math.min(CONFIG.target.maxDegraders, degraders) * CONFIG.target.degradeDps;
    if (dps > 0 && !this.threatened) {
      // first hp lost: the alarm cue (audio) for this incident
      this.threatened = true;
      ev.push({ type: 'BuildingThreatStarted', incidentId: this.id });
    }
    if (dps > 0 && this.targets.damage(this.target, dps * dt)) {
      this.destroy(ctx, ev);
      return ev;
    }

    if (!this.requiredActive(ctx.horde)) {
      if (this.stage === 'attack' && this.comp.reinforcements.length > 0) {
        this.stage = 'cinematic';
        this.timer = CONFIG.school.cinematicSec;
      } else if (st.burning) this.stage = 'smoulder';
      else {
        this.stage = 'saved';
        ctx.rules.award(`${this.id}:saved`, CONFIG.casse.scores[this.kind][0]);
        ev.push({ type: 'TargetSaved', incidentId: this.id, target: this.target });
        ev.push(...this.onSaved());
      }
    }
    return ev;
  }

  /** hp 0 (fire, degraders or a bottle burst): ruin, loss points once. */
  private destroy(ctx: AttackCtx, ev: SimEvent[]): void {
    this.targets.ruin(this.target, this.id);
    this.lose();
    ctx.rules.award(`${this.id}:lost`, CONFIG.casse.scores[this.kind][1]);
    ev.push({ type: 'BuildingDestroyed', incidentId: this.id, target: this.target });
  }

  urgent(): boolean {
    return this.stage === 'attack' || this.stage === 'cinematic' || this.stage === 'reinforcements';
  }

  /** Over for good: saved or destroyed. */
  resolved(): boolean {
    return this.stage === 'saved' || this.stage === 'destroyed';
  }

  /** Over for its round: resolved, or smouldering (its rioters are all KO, its fire still burns). */
  settled(): boolean {
    return this.resolved() || this.stage === 'smoulder';
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

  /**
   * Destroyed. Reinforcements not sent yet are sent now: they count in the round total (§9.1), and with no site
   * left they go for Paul.
   */
  private lose(): void {
    if (this.stage === 'attack' || this.stage === 'cinematic') this.send(this.comp.reinforcements);
    this.stage = 'destroyed';
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
