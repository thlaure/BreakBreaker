import { CONFIG } from './config';
import { Director, spawnPoints, type DirectorPhase } from './director';
import { Stations, type StationMessage } from './healing';
import { Horde, type Hostile } from './hostiles';
import type { RescueIncident, RescueKind, RescueStage } from './incidents/rescue';
import { SchoolIncident, type SchoolStage } from './incidents/school';
import { DISTRICT, type Rect } from './map/district';
import { FlowField } from './map/flowfield';
import { Grid } from './map/grid';
import { dist, len, norm, sub } from './math';
import { createPlayer, damagePlayer, stepPlayer, sweep, type Player } from './player';
import { Rocks, type RockCtx, type RockState } from './projectiles';
import { rng } from './rng';
import { Rules, type SessionStats } from './rules';
import type { InputFrame, Role, SimEvent, Variant, Vec } from './types';
import { Weapons, type WeaponKind } from './weapons';

/** Damage of a weapon strike: enough to KO any rioter (spec: weapons are one-hit KO). */
const WEAPON_DAMAGE = 99;

export interface Telegraph {
  from: Vec;
  to: Vec;
  until: number;
}

/** Plain, readonly render data (no class instances, no functions). */
export interface Snapshot {
  now: number;
  paused: boolean;
  ended: boolean;
  endCause: 'ko' | 'quit' | null;
  phase: DirectorPhase;
  wave: number;
  player: { pos: Vec; facing: Vec; ko: boolean; invulnerable: boolean };
  hp: number;
  hpMax: number;
  carried: number;
  score: number;
  kos: number;
  hostiles: { lifeId: number; pos: Vec; facing: Vec; state: Hostile['state']; variant: Variant; role: Role; hp: number }[];
  rocks: { id: number; state: RockState; owner: 'enemy' | 'player'; kind: 'caillou' | 'pave' | 'brique'; pos: Vec }[];
  telegraphs: Telegraph[];
  group: { area: Rect; members: Vec[] };
  victim: Vec | null;
  school: { stage: SchoolStage; integrity: number; remaining: number; status: ReturnType<SchoolIncident['status']> };
  rescue: { stage: RescueStage; remaining: number; victimPos: Vec; kind: RescueKind } | null;
  stations: { id: string; pos: Vec; charged: boolean }[];
  stationMessage: StationMessage;
  /** Weapon in Paul's hands (null = bare hands) and strikes left. */
  weapon: { kind: WeaponKind; uses: number } | null;
  weaponsOnGround: { id: number; kind: WeaponKind; pos: Vec }[];
  objective: Vec | null;
  stats: SessionStats;
}

const v = (p: Vec): Vec => ({ x: p.x, y: p.y });

/** Liang–Barsky: t in [0,1] at which segment a→b first enters rect r, or null. */
export function segmentRectEntry(a: Vec, b: Vec, r: Rect): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  const hit =
    clip(-dx, a.x - r.x) && clip(dx, r.x + r.w - a.x) && clip(-dy, a.y - r.y) && clip(dy, r.y + r.h - a.y);
  return hit ? t0 : null;
}

/**
 * Deterministic session facade driven one fixed step at a time by the Phaser layer.
 * Step order: player move → sweep/return → hostiles → rocks → damage → KO check → incidents → heals → director.
 * While the school cinematic is running, only its timer advances.
 */
export class Sim {
  readonly rules = new Rules();
  readonly grid = new Grid(DISTRICT);
  readonly player: Player = createPlayer(DISTRICT.playerSpawn);
  readonly horde = new Horde();
  readonly rocks = new Rocks(this.grid);
  readonly school = new SchoolIncident();
  readonly stations = new Stations(DISTRICT.stations);
  readonly director = new Director();
  readonly weapons: Weapons;
  readonly rand: () => number;
  rescue: RescueIncident | null = null;
  now = 0;
  paused = false;

  private readonly invulnerable: boolean;
  private readonly fields: { player: FlowField; school: FlowField; victim: FlowField };
  private telegraphs: Telegraph[] = [];
  private facings = new Map<number, Vec>();
  private stationMessage: StationMessage = null;
  private koReported = false;

  constructor(seed: number, opts: { invulnerable?: boolean } = {}) {
    this.rand = rng(seed);
    // Separate stream so weapon spawns never shift the director's random sequence.
    this.weapons = new Weapons(this.grid, rng((seed ^ 0x9e3779b9) >>> 0));
    this.invulnerable = opts.invulnerable ?? false;
    this.fields = { player: new FlowField(this.grid), school: new FlowField(this.grid), victim: new FlowField(this.grid) };
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Player skip (Agir / Espace / tap) of the school cinematic; no-op outside it. */
  skipCinematic(): void {
    this.school.skipCinematic();
  }

  quit(): void {
    this.rules.end('quit');
  }

  /** One fixed step of CONFIG.step seconds. No-op (returns []) while paused or after the session ended. */
  step(input: InputFrame): SimEvent[] {
    if (this.paused || this.rules.ended) return [];
    const dt = CONFIG.step;
    const ev: SimEvent[] = [];
    this.rules.stats.activeSeconds += dt;
    if (this.school.suspended()) {
      ev.push(...this.school.step(dt, this.schoolCtx()));
      this.tally(ev);
      return ev;
    }
    this.now += dt;
    const now = this.now;
    const p = this.player;

    stepPlayer(p, input, dt, now, this.grid);
    if (input.strike) {
      // Bare hands: 1 damage (2 hits to KO). Any weapon: KO in one hit.
      const damage = this.weapons.held ? WEAPON_DAMAGE : 1;
      const { hits } = sweep(p, now, this.horde.views(), this.grid, this.weapons.range());
      for (const id of hits) {
        ev.push({ type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee' });
        this.hit(id, damage, ev);
      }
      ev.push(...this.weapons.onSwing(hits.length));
    }
    if (input.throwRock) {
      const aim = input.aim && len(input.aim) > 0 ? input.aim : p.facing;
      this.rocks.returnRock(p.pos, aim, now);
    }

    const victimPos = this.rescue?.stage === 'threat' ? this.rescue.victimPos : null;
    const prev = new Map(this.horde.list.map((h) => [h.lifeId, v(h.pos)]));
    const hordeEv = this.horde.step(dt, now, {
      player: p,
      grid: this.grid,
      fields: { player: this.fields.player, school: this.fields.school, victim: victimPos ? this.fields.victim : null },
      rocks: this.rocks,
      facadePoints: DISTRICT.school.facadePoints,
      victimPos,
      schoolStanding: this.school.stage !== 'destroyed',
      pressure: this.director.pressure(this.rules.kos),
    });
    this.updateFacings(prev);
    const rockEv = this.rocks.step(dt, now, this.rockCtx(victimPos));

    // damage, hits and rock bookkeeping
    let damaged = false;
    for (const e of [...hordeEv, ...rockEv]) {
      if (e.type === 'PlayerDamaged') {
        if (!this.invulnerable && damagePlayer(p, e.amount, now)) {
          damaged = true;
          ev.push(e);
        }
        continue;
      }
      ev.push(e);
      if (e.type === 'EnemyThrowStarted') this.telegraphs.push({ from: v(e.from), to: v(e.to), until: e.until });
      else if (e.type === 'ProjectilePickedUp') this.rules.stats.rocksPicked += 1;
      else if (e.type === 'ProjectileReturned') this.rules.stats.rocksReturned += 1;
      else if (e.type === 'HitConfirmed' && e.source === 'rock') {
        this.rules.stats.rocksHit += 1;
        this.hit(e.targetLifeId, e.damage, ev);
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.until > now);

    if (p.ko) {
      if (!this.koReported) {
        this.koReported = true;
        ev.push({ type: 'PlayerKnockedOut' });
      }
      this.rules.end('ko');
      return ev;
    }

    ev.push(...this.school.step(dt, this.schoolCtx()));
    if (this.rescue)
      ev.push(
        ...this.rescue.step(dt, { horde: this.horde, rules: this.rules, player: p, actHeld: input.act, playerDamaged: damaged }),
      );

    const heal = this.stations.step({ player: p, rules: this.rules });
    ev.push(...heal.events);
    this.stationMessage = heal.message;
    ev.push(...this.weapons.step(dt, now, p));

    ev.push(...this.director.step(dt, this));
    this.tally(ev);
    return ev;
  }

  snapshot(): Snapshot {
    const p = this.player;
    const r = this.rescue;
    const victim = r && (r.stage === 'threat' || r.stage === 'secured') ? v(r.victimPos) : null;
    const schoolUrgent = this.school.stage === 'firstLine' || this.school.stage === 'reinforcements';
    return {
      now: this.now,
      paused: this.paused,
      ended: this.rules.ended,
      endCause: this.rules.endCause,
      phase: this.director.phase,
      wave: this.director.wave,
      player: { pos: v(p.pos), facing: v(p.facing), ko: p.ko, invulnerable: this.now < p.invulnUntil },
      hp: p.hp,
      hpMax: CONFIG.player.maxHp,
      carried: this.rocks.carried,
      score: this.rules.score,
      kos: this.rules.kos,
      hostiles: this.horde.list.map((h) => ({
        lifeId: h.lifeId,
        pos: v(h.pos),
        facing: v(this.facings.get(h.lifeId) ?? { x: 0, y: 1 }),
        state: h.state,
        variant: h.variant,
        role: h.role,
        hp: h.hp,
      })),
      rocks: [...this.rocks.flying(), ...this.rocks.ground()].map((k) => ({
        id: k.id,
        state: k.state,
        owner: k.owner,
        kind: k.kind,
        pos: v(k.pos),
      })),
      telegraphs: this.telegraphs.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
      group: { area: { ...DISTRICT.peacefulGroup.area }, members: DISTRICT.peacefulGroup.members.map(v) },
      victim,
      school: {
        stage: this.school.stage,
        integrity: this.school.integrity(),
        remaining: this.school.remaining,
        status: this.school.status(),
      },
      rescue: r ? { stage: r.stage, remaining: r.remaining, victimPos: v(r.victimPos), kind: r.kind } : null,
      stations: this.stations.list.map((s) => ({ id: s.id, pos: v(s.pos), charged: s.charged })),
      stationMessage: this.stationMessage,
      weapon: this.weapons.held ? { ...this.weapons.held } : null,
      weaponsOnGround: this.weapons.ground.map((w) => ({ id: w.id, kind: w.kind, pos: v(w.pos) })),
      objective: schoolUrgent ? v(DISTRICT.school.door) : victim,
      stats: { ...this.rules.stats },
    };
  }

  private schoolCtx() {
    const z = DISTRICT.school.zone;
    return {
      horde: this.horde,
      rules: this.rules,
      playerInZone: dist(this.player.pos, z) <= z.r,
      spawns: spawnPoints(this.player.pos),
    };
  }

  private rockCtx(victimPos: Vec | null): RockCtx {
    const area = DISTRICT.peacefulGroup.area;
    const p = this.player;
    return {
      player: { pos: p.pos, r: CONFIG.player.radius, invulnerable: this.invulnerable || p.ko || this.now < p.invulnUntil },
      hostiles: this.horde.views(),
      groupBlocks: (a, b) => segmentRectEntry(a, b, area),
      victimPos,
    };
  }

  /** Every 'ko' from applyHit scores +1 (deduped by Rules) and emits ActorKnockedOut. */
  private hit(lifeId: number, dmg: number, ev: SimEvent[]): void {
    if (this.horde.applyHit(lifeId, dmg) !== 'ko') return;
    this.rules.onKnockout(lifeId);
    ev.push({ type: 'ActorKnockedOut', lifeId });
  }

  /** Hostile facing = last movement direction, else toward Paul. */
  private updateFacings(prev: Map<number, Vec>): void {
    const next = new Map<number, Vec>();
    for (const h of this.horde.list) {
      const before = prev.get(h.lifeId);
      const moved = before ? sub(h.pos, before) : { x: 0, y: 0 };
      const old = this.facings.get(h.lifeId);
      if (len(moved) > 1e-6) next.set(h.lifeId, norm(moved));
      else if (old) next.set(h.lifeId, old);
      else next.set(h.lifeId, norm(sub(this.player.pos, h.pos)));
    }
    this.facings = next;
  }

  /** Incident outcomes feed the session stats (Rules does not track them itself). */
  private tally(ev: SimEvent[]): void {
    const s = this.rules.stats;
    for (const e of ev) {
      if (e.type === 'SchoolRestored') s.schoolsSaved += 1;
      else if (e.type === 'BuildingDestroyed') s.schoolsLost += 1;
      else if (e.type === 'RescueCompleted') s.rescuesOk += 1;
      else if (e.type === 'RescueFailed') s.rescuesFailed += 1;
    }
  }
}
