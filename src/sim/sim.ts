import { CONFIG } from './config';
import { Director, spawnPoints, type RoundPhase, type RoundSummary } from './director';
import { EntryQueue, type Spawner } from './entry';
import { Stations, type StationMessage } from './healing';
import { Horde, type Hostile, type HordeCtx } from './hostiles';
import type { RescueIncident, RescueKind, RescueStage } from './incidents/rescue';
import { SchoolIncident, type SchoolStage } from './incidents/school';
import type { TargetAttack } from './incidents/targetAttack';
import { DISTRICT, type Rect } from './map/district';
import { FlowField } from './map/flowfield';
import { Grid } from './map/grid';
import { len, norm, sub } from './math';
import { createPlayer, damagePlayer, stepPlayer, sweep, type Player } from './player';
import { Rocks, type RockCtx, type RockState } from './projectiles';
import { rng } from './rng';
import { Toolboxes, type ToolboxMessage } from './repair';
import { Rules, type SessionStats } from './rules';
import { Targets } from './targets';
import type { CasseKind, InputFrame, Role, SimEvent, TargetId, Variant, Vec } from './types';
import { Weapons, type WeaponKind } from './weapons';

/** Damage of a weapon strike: enough to KO any rioter (spec: weapons are one-hit KO). */
const WEAPON_DAMAGE = 99;
/** How long a thrown bottle is drawn in flight (render only; the fire starts on the throw). */
export const MOLOTOV_FLIGHT_SEC = 0.6;

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
  /** Current round (1-based, 1 from the start). */
  round: number;
  roundPhase: RoundPhase;
  /** Rioters in the current round's roster (0 during the intro). */
  roundTotal: number;
  /** Round-tagged rioters knocked out this round, clamped to [0, roundTotal]. */
  roundKos: number;
  /** Seconds of breather left (0 outside the breather). */
  breatherLeft: number;
  lastSummary: RoundSummary | null;
  player: { pos: Vec; facing: Vec; ko: boolean; invulnerable: boolean };
  hp: number;
  hpMax: number;
  carried: number;
  score: number;
  kos: number;
  hostiles: {
    lifeId: number;
    pos: Vec;
    facing: Vec;
    state: Hostile['state'];
    variant: Variant;
    role: Role;
    hp: number;
    /** Winding up a blow, a throw or a Molotov. */
    windup: boolean;
  }[];
  rocks: { id: number; state: RockState; owner: 'enemy' | 'player'; kind: 'caillou' | 'pave' | 'brique'; pos: Vec }[];
  telegraphs: Telegraph[];
  group: { area: Rect; members: Vec[] };
  victim: Vec | null;
  /** `attacked` = an urgent attack on it; `burning` = on fire with no urgent attack (smouldering until put out). */
  targets: {
    id: TargetId;
    kind: CasseKind;
    hp: number;
    maxHp: number;
    burning: boolean;
    state: 'intact' | 'attacked' | 'burning' | 'ruined';
    door: Vec;
    footprint: Rect;
    prop: boolean;
  }[];
  toolboxes: {
    ground: { id: number; pos: Vec }[];
    carried: boolean;
    /** Seconds of repair done (0..CONFIG.kit.repairSec). */
    progress: number;
    message: ToolboxMessage;
    /** The ruin within reach of Paul, if any. */
    repairTarget: TargetId | null;
    /** A toolbox carried, a target to repair in reach, no hostile close: Agir (F) would start the repair. */
    canRepair: boolean;
    /** What the repair in reach would do: rebuild a ruin, or put out a fire; null with nothing in reach. */
    repairKind: 'ruin' | 'fire' | null;
    /** Agir was pressed: the repair progresses on its own. */
    started: boolean;
  };
  /** Bottles in flight (render only). */
  molotovs: Telegraph[];
  /** The latest school attack; `integrity` = school hp in percent. */
  school: { stage: SchoolStage; integrity: number; status: ReturnType<SchoolIncident['status']> };
  rescue: { stage: RescueStage; remaining: number; victimPos: Vec; kind: RescueKind } | null;
  stations: { id: string; pos: Vec; charged: boolean }[];
  stationMessage: StationMessage;
  /** Weapon in Paul's hands (null = bare hands) and strikes left. */
  weapon: { kind: WeaponKind; uses: number } | null;
  /** `expiresAt` = sim time a special drop vanishes (null = never). */
  weaponsOnGround: { id: number; kind: WeaponKind; pos: Vec; expiresAt: number | null }[];
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
 * Step order: player move → sweep/return → hostiles → queue entries → rocks → damage → KO check → Molotovs routed to
 * the attack on their target → attacks → rescue → toolboxes → heals → weapons → director.
 * While the school cinematic is running, only its timer advances.
 */
export class Sim {
  readonly rules = new Rules();
  readonly grid = new Grid(DISTRICT);
  readonly player: Player = createPlayer(DISTRICT.playerSpawn);
  readonly horde = new Horde();
  readonly rocks = new Rocks(this.grid);
  readonly targets = new Targets();
  /** Every rioter of a round walks in through this line, from the edge points away from Paul. */
  readonly queue = new EntryQueue();
  /** Objective rioters (target attacks) jump the line. */
  readonly objectiveSpawner: Spawner = { request: (reqs, o) => this.queue.request(reqs, { ...o, front: true }) };
  /**
   * Target attacks of the session (school included), smouldering ones too (stepped across rounds and the breather);
   * the director prunes resolved ones at each round start.
   */
  readonly attacks: TargetAttack[] = [];
  /** The latest school attack (round 1's from the start; later ones replace it). */
  school: SchoolIncident = new SchoolIncident(this.targets, this.objectiveSpawner);
  readonly stations = new Stations(DISTRICT.stations);
  readonly toolboxes = new Toolboxes();
  readonly director = new Director();
  readonly weapons: Weapons;
  readonly rand: () => number;
  rescue: RescueIncident | null = null;
  now = 0;
  paused = false;

  private readonly invulnerable: boolean;
  private readonly fields: { player: FlowField; victim: FlowField };
  /** One flow field per target, used while an attack on it is live. */
  private readonly siteFields = new Map<TargetId, FlowField>();
  private telegraphs: Telegraph[] = [];
  private molotovs: Telegraph[] = [];
  private facings = new Map<number, Vec>();
  private stationMessage: StationMessage = null;
  private toolboxMessage: ToolboxMessage = null;
  private koReported = false;

  constructor(seed: number, opts: { invulnerable?: boolean } = {}) {
    this.rand = rng(seed);
    // Separate stream so weapon spawns never shift the director's random sequence.
    this.weapons = new Weapons(this.grid, rng((seed ^ 0x9e3779b9) >>> 0));
    this.invulnerable = opts.invulnerable ?? false;
    this.fields = { player: new FlowField(this.grid), victim: new FlowField(this.grid) };
    for (const t of DISTRICT.targets) this.siteFields.set(t.id, new FlowField(this.grid));
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Player skip (F / Espace / tap) of the school cinematic; no-op outside it. */
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
      ev.push(...this.school.step(dt, this.attackCtx()));
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
      fields: { player: this.fields.player, victim: victimPos ? this.fields.victim : null },
      rocks: this.rocks,
      sites: this.sites(),
      victimPos,
      pressure: this.director.pressure(this.rules.kos),
    });
    this.updateFacings(prev);
    this.queue.step(dt, this.horde, spawnPoints(p.pos));
    const rockEv = this.rocks.step(dt, now, this.rockCtx(victimPos));

    // damage, hits and rock bookkeeping
    const molotovs: Extract<SimEvent, { type: 'MolotovThrown' }>[] = [];
    for (const e of [...hordeEv, ...rockEv]) {
      if (e.type === 'PlayerDamaged') {
        if (!this.invulnerable && damagePlayer(p, e.amount, now)) ev.push(e);
        continue;
      }
      ev.push(e);
      if (e.type === 'MolotovThrown') molotovs.push(e);
      else if (e.type === 'EnemyThrowStarted') this.telegraphs.push({ from: v(e.from), to: v(e.to), until: e.until });
      else if (e.type === 'ProjectilePickedUp') this.rules.stats.rocksPicked += 1;
      else if (e.type === 'ProjectileReturned') this.rules.stats.rocksReturned += 1;
      else if (e.type === 'HitConfirmed' && e.source === 'rock') {
        this.rules.stats.rocksHit += 1;
        this.hit(e.targetLifeId, e.damage, ev);
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.until > now);
    this.molotovs = this.molotovs.filter((t) => t.until > now);

    if (p.ko) {
      if (!this.koReported) {
        this.koReported = true;
        ev.push({ type: 'PlayerKnockedOut' });
      }
      this.rules.end('ko');
      return ev;
    }

    for (const e of molotovs) {
      this.molotovs.push({ from: v(e.from), to: v(e.to), until: now + MOLOTOV_FLIGHT_SEC });
      // at most one live attack per target: the bottle belongs to it
      const owner = this.attacks.find((a) => a.target === e.target && !a.resolved());
      if (owner) ev.push(...owner.onMolotov(e, this.attackCtx()));
    }
    for (const a of this.attacks) ev.push(...a.step(dt, this.attackCtx()));
    if (this.rescue) ev.push(...this.rescue.step(dt, { horde: this.horde, rules: this.rules, player: p, spawner: this.objectiveSpawner }));

    const kit = this.toolboxes.step(dt, { player: p, horde: this.horde, targets: this.targets, rules: this.rules, act: input.act });
    ev.push(...kit.events);
    this.toolboxMessage = kit.message;
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
    const d = this.director;
    const victim = r && (r.stage === 'threat' || r.stage === 'secured') ? v(r.victimPos) : null;
    return {
      now: this.now,
      paused: this.paused,
      ended: this.rules.ended,
      endCause: this.rules.endCause,
      round: d.round,
      roundPhase: d.phase,
      roundTotal: d.total,
      roundKos: d.roundKos(this),
      breatherLeft: d.breatherLeft,
      lastSummary: d.lastSummary
        ? { ...d.lastSummary, objectives: d.lastSummary.objectives.map((o) => ({ ...o })) }
        : null,
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
        windup: h.state === 'windup',
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
      targets: DISTRICT.targets.map((def) => {
        const t = this.targets.get(def.id);
        const attacked = this.attacks.some((a) => a.target === def.id && a.urgent());
        return {
          id: def.id,
          kind: def.kind,
          hp: t.hp,
          maxHp: t.maxHp,
          burning: t.burning,
          state: t.state === 'ruined' ? 'ruined' : attacked ? 'attacked' : t.burning ? 'burning' : 'intact',
          door: v(def.door),
          footprint: { ...def.footprint },
          prop: def.prop,
        };
      }),
      toolboxes: {
        ground: this.toolboxes.ground.map((g) => ({ id: g.id, pos: v(g.pos) })),
        carried: this.toolboxes.carried,
        progress: this.toolboxes.progress,
        message: this.toolboxMessage,
        ...this.repairView(),
      },
      molotovs: this.molotovs.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
      school: {
        stage: this.school.stage,
        integrity: this.school.integrity(),
        status: this.school.status(),
      },
      rescue: r ? { stage: r.stage, remaining: r.remaining, victimPos: v(r.victimPos), kind: r.kind } : null,
      stations: this.stations.list.map((s) => ({ id: s.id, pos: v(s.pos), charged: s.charged })),
      stationMessage: this.stationMessage,
      weapon: this.weapons.held ? { ...this.weapons.held } : null,
      weaponsOnGround: this.weapons.ground.map((w) => ({ id: w.id, kind: w.kind, pos: v(w.pos), expiresAt: w.expiresAt })),
      stats: { ...this.rules.stats },
    };
  }

  /** The toolbox repair in reach of Paul, as the HUD shows it. */
  private repairView(): Pick<Snapshot['toolboxes'], 'repairTarget' | 'canRepair' | 'repairKind' | 'started'> {
    const kit = this.toolboxes;
    const target = kit.repairTarget(this.player.pos, this.targets);
    const repairKind = target === null ? null : this.targets.get(target).state === 'ruined' ? 'ruin' : 'fire';
    return { repairTarget: target, canRepair: target !== null && kit.ready, repairKind, started: kit.started };
  }

  /** Horde sites: every target under a live (started, unsettled) attack; other targets cost no flow field. */
  private sites(): HordeCtx['sites'] {
    const out: HordeCtx['sites'] = {};
    for (const a of this.attacks) {
      if (a.stage === 'idle' || a.settled()) continue;
      const def = DISTRICT.targets.find((t) => t.id === a.target)!;
      out[a.target] = {
        points: def.attackPoints,
        door: def.door,
        standing: this.targets.standing(a.target),
        field: this.siteFields.get(a.target)!,
      };
    }
    return out;
  }

  private attackCtx() {
    return { horde: this.horde, rules: this.rules };
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
      else if (e.type === 'TargetSaved') s.targetsSaved += 1;
      else if (e.type === 'BuildingDestroyed') {
        s.targetsLost += 1;
        if (e.target === 'school') s.schoolsLost += 1;
      } else if (e.type === 'TargetRepaired') s.repairs += 1;
      else if (e.type === 'RoundCompleted') {
        s.roundsCompleted += 1;
        if (e.bonus) s.roundsPerfect += 1;
      } else if (e.type === 'RescueCompleted') s.rescuesOk += 1;
      else if (e.type === 'RescueFailed') s.rescuesFailed += 1;
    }
  }
}
