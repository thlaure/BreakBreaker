import { CONFIG } from './config';
import { Director, spawnPoints, type RoundPhase, type RoundSummary } from './director';
import { EntryQueue, type Spawner } from './entry';
import { FirePatches } from './firepatch';
import { Stations, type StationMessage } from './healing';
import { Horde, isTough, type Hostile, type HordeCtx } from './hostiles';
import type { ItemState, RescueIncident, RescueKind, RescueStage } from './incidents/rescue';
import { SchoolIncident, type SchoolStage } from './incidents/school';
import type { TargetAttack } from './incidents/targetAttack';
import { moveCircle } from './map/collide';
import { DISTRICT, type Rect } from './map/district';
import { FlowField } from './map/flowfield';
import { Grid } from './map/grid';
import { len, norm, sub } from './math';
import { Monument, MonumentIncident, type MonumentStage } from './monument';
import { createPlayer, damagePlayer, stepPlayer, sweep, type Player } from './player';
import { Rocks, type RockCtx, type RockState } from './projectiles';
import { rng } from './rng';
import { Toolboxes, type ToolboxMessage } from './repair';
import { Rules, type SessionStats } from './rules';
import { beam } from './specials';
import { Targets } from './targets';
import type { CasseKind, InputFrame, Launch, MonumentFlag, Role, SimEvent, TargetId, Variant, Vec } from './types';
import { Weapons, type HeldKind, type PickupKind } from './weapons';

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
    /** Starting HP (bars: a brute once damaged, the Caïd always). */
    maxHp: number;
    /** Winding up a blow, a throw or a Molotov. */
    windup: boolean;
    /** Holding up a lit bottle (a Molotov or firebomber windup; not a firebomber's melee blow). */
    bottleUp: boolean;
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
  /** Bottles in flight toward a target (render only). */
  molotovs: Telegraph[];
  /** Firebombers' bottles in flight toward where Paul stood (`until` = landing). */
  firebombs: Telegraph[];
  /** Ground fire left by firebombs (Paul only); `secondsLeft` until it goes out. */
  firePatches: { id: number; pos: Vec; r: number; secondsLeft: number }[];
  /** The latest school attack; `integrity` = school hp in percent. */
  school: { stage: SchoolStage; integrity: number; status: ReturnType<SchoolIncident['status']> };
  /**
   * The latest rescue. `items`: the victim's belongings (`pos` = the victim, its thief, the ground or Paul);
   * `returnLeft`: seconds left of the wait for them while secured (null when not waiting).
   */
  rescue: {
    id: string;
    stage: RescueStage;
    remaining: number;
    victimPos: Vec;
    kind: RescueKind;
    items: { id: string; name: string; state: ItemState; pos: Vec }[];
    returnLeft: number | null;
  } | null;
  /** Belongings of the rescue victim Paul carries. */
  carriedItems: number;
  stations: { id: string; pos: Vec; charged: boolean }[];
  stationMessage: StationMessage;
  /**
   * Weapon in Paul's hands (null = bare hands): strikes left (regular weapons), beams left (kamehame), or the bouclier's
   * `secondsLeft` (its `uses` is 0).
   */
  weapon: { kind: HeldKind; uses: number; secondsLeft?: number } | null;
  /** Onde d’énergie charging: `progress` in [0, 1] of CONFIG.kamehame.chargeSec; null when not charging. */
  charge: { progress: number } | null;
  /** `expiresAt` = sim time a special drop vanishes (null = never); `kind: 'furie'` = the mode furie power-up. */
  weaponsOnGround: { id: number; kind: PickupKind; pos: Vec; expiresAt: number | null }[];
  /** Mode furie on (seconds left), or null. */
  furie: { secondsLeft: number } | null;
  /**
   * The equestrian monument: its flag; `occupation` = the latest occupation's stage and swap timer (null before the
   * first); capture the flag (`capture` seconds of `captureSec`, Paul `inZone`, `contested` by a hostile inside).
   */
  monument: {
    flag: MonumentFlag;
    capture: number;
    captureSec: number;
    inZone: boolean;
    contested: boolean;
    swaps: number;
    occupation: { id: string; stage: MonumentStage; swap: number; swapSec: number } | null;
    mast: Vec;
    zone: { x: number; y: number; r: number };
  };
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
 * Step order: player move → sweep/return → hostiles → queue entries → rocks → damage → fire patches → KO check → Molotovs routed to
 * the attack on their target → attacks → rescue → toolboxes → heals → weapons (pickups, furie timer) → director.
 * Mode furie (CONFIG.furie) changes the player move, the strike and the damage taken; a KO ends it.
 * Held specials: the bouclier is a protection bubble (rocks and firebombs blocked from any side) and bashes on a strike; the onde d'énergie (kamehame)
 * charges while Frapper is held (Paul frozen), fires a beam at CONFIG.kamehame.chargeSec, and is cancelled by a release,
 * damage, the weapon lost or a KO.
 * While the school cinematic is running, only its timer advances. Agir (`input.act`, held) counts only on its rising
 * edge: holding F while walking into range, or while a hostile moves away, never starts a toolbox repair.
 * Every score change of the step (Rules' outbox, KOs included) ends the step's events as one ScoreChanged each.
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
  readonly firePatches = new FirePatches();
  /** The equestrian monument's flag and capture the flag (persists across rounds). */
  readonly monument = new Monument();
  /** Monument occupations still holding the plinth (pruned by the director at round start). */
  readonly occupations: MonumentIncident[] = [];
  /** The latest occupation (HUD), kept after it ends. */
  private lastOccupation: MonumentIncident | null = null;
  readonly director = new Director();
  readonly weapons: Weapons;
  readonly rand: () => number;
  /** Own stream for the cosmetic furie launches, so they never shift any other random sequence. */
  private readonly launchRand: () => number;
  rescue: RescueIncident | null = null;
  now = 0;
  paused = false;

  private readonly invulnerable: boolean;
  private readonly fields: { player: FlowField; victim: FlowField };
  /** One flow field per target, used while an attack on it is live. */
  private readonly siteFields = new Map<TargetId, FlowField>();
  private readonly monumentField: FlowField;
  private telegraphs: Telegraph[] = [];
  private molotovs: Telegraph[] = [];
  private facings = new Map<number, Vec>();
  private stationMessage: StationMessage = null;
  private toolboxMessage: ToolboxMessage = null;
  private koReported = false;
  /** Onde d'énergie charge under way: seconds held so far. */
  private charge: { t: number } | null = null;
  /** Caïds whose KO was already rewarded (bonus + weapon drop). */
  private readonly caidsDown = new Set<number>();
  /** Agir (F / touch Agir) was down on the previous step: the toolbox only reacts to a fresh press (rising edge). */
  private prevAct = false;

  constructor(seed: number, opts: { invulnerable?: boolean } = {}) {
    this.rand = rng(seed);
    // Separate stream so weapon spawns never shift the director's random sequence.
    this.weapons = new Weapons(this.grid, rng((seed ^ 0x9e3779b9) >>> 0));
    this.launchRand = rng((seed ^ 0x85ebca6b) >>> 0);
    this.invulnerable = opts.invulnerable ?? false;
    this.fields = { player: new FlowField(this.grid), victim: new FlowField(this.grid) };
    for (const t of DISTRICT.targets) this.siteFields.set(t.id, new FlowField(this.grid));
    this.monumentField = new FlowField(this.grid);
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
    // Agir is a press, not a hold: only its rising edge counts (tracked on every step the sim sees, paused ones included)
    const actPressed = input.act && !this.prevAct;
    this.prevAct = input.act;
    if (this.paused || this.rules.ended) return [];
    const dt = CONFIG.step;
    const ev: SimEvent[] = [];
    this.rules.stats.activeSeconds += dt;
    if (this.school.suspended()) {
      ev.push(...this.school.step(dt, this.attackCtx()));
      this.tally(ev);
      this.scoreEvents(ev);
      return ev;
    }
    this.now += dt;
    const now = this.now;
    const p = this.player;

    const furie = this.weapons.furie();
    // charging the onde d'énergie: movement ignored (aim still turns Paul)
    const frozen = this.charge !== null;
    stepPlayer(p, frozen ? { ...input, move: { x: 0, y: 0 } } : input, dt, now, this.grid, furie ? CONFIG.furie.speedMul : 1);
    if (this.charge !== null || this.weapons.held?.kind === 'kamehame') this.stepCharge(input, dt, ev);
    else if (input.strike) {
      // Bare hands: 1 damage. A regular weapon: KO in one hit, but CONFIG.toughWeaponDamage on a brute or the Caïd.
      // Mode furie: KO in one hit, more targets, the weapon is not used, every KO is launched. Bouclier: a bash
      // (one-hit KO, knockback, no charge used).
      const bash = this.weapons.held?.kind === 'bouclier';
      const maxTargets = furie ? CONFIG.furie.maxTargets : CONFIG.melee.maxTargets;
      const { hits } = sweep(p, now, this.horde.views(), this.grid, this.weapons.range(), maxTargets);
      for (const id of hits) {
        const tough = this.tough(id);
        const damage = furie ? CONFIG.furie.damage : bash ? WEAPON_DAMAGE : this.weapons.held ? (tough ? CONFIG.toughWeaponDamage : WEAPON_DAMAGE) : 1;
        ev.push(tough ? { type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee', heavy: true } : { type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee' });
        this.hit(id, damage, ev, furie);
        if (bash) this.knockback(id);
      }
      if (!furie) ev.push(...this.weapons.onSwing(hits.length));
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
    for (const h of this.queue.step(dt, this.horde, spawnPoints(p.pos)))
      if (h.role === 'boss') ev.push({ type: 'CaidArrived', lifeId: h.lifeId, pos: v(h.pos), round: h.round ?? this.director.round });
    const rockEv = this.rocks.step(dt, now, this.rockCtx(victimPos));

    // damage, hits and rock bookkeeping
    const hpBefore = p.hp;
    const molotovs: Extract<SimEvent, { type: 'MolotovThrown' }>[] = [];
    for (const e of [...hordeEv, ...rockEv]) {
      if (e.type === 'PlayerDamaged') {
        const amount = this.weapons.furie() ? e.amount * CONFIG.furie.damageTakenMul : e.amount;
        if (!this.invulnerable && damagePlayer(p, amount, now)) {
          ev.push({ ...e, amount });
          // a brute's or the Caïd's blow: Paul is pushed through the player move (solids block it)
          if (e.push && !p.ko) p.pos = moveCircle(this.grid, p.pos, e.push, CONFIG.player.radius);
        }
        continue;
      }
      ev.push(e);
      if (e.type === 'MolotovThrown') molotovs.push(e);
      else if (e.type === 'FirebombThrown') this.firePatches.throwBottle(e.from, e.to, e.until);
      else if (e.type === 'EnemyThrowStarted') this.telegraphs.push({ from: v(e.from), to: v(e.to), until: e.until });
      else if (e.type === 'ProjectilePickedUp') this.rules.stats.rocksPicked += 1;
      else if (e.type === 'ProjectileReturned') this.rules.stats.rocksReturned += 1;
      else if (e.type === 'HitConfirmed' && e.source === 'rock') {
        this.rules.stats.rocksHit += 1;
        this.hit(e.targetLifeId, e.damage, ev);
      }
    }
    // ground fire: Paul only, through the same damage path (invulnerability frames, mode furie)
    ev.push(
      ...this.firePatches.step(now, this.grid, p.pos, (amount) => {
        const a = this.weapons.furie() ? amount * CONFIG.furie.damageTakenMul : amount;
        if (this.invulnerable || !damagePlayer(p, a, now)) return false;
        ev.push({ type: 'PlayerDamaged', amount: a });
        return true;
      }, this.shield()),
    );
    // taking damage (or a KO) cancels the charge: nothing used
    if (this.charge !== null && (p.hp < hpBefore || p.ko)) this.cancelCharge(ev);
    this.telegraphs = this.telegraphs.filter((t) => t.until > now);
    this.molotovs = this.molotovs.filter((t) => t.until > now);

    if (p.ko) {
      ev.push(...this.weapons.endFurie());
      if (!this.koReported) {
        this.koReported = true;
        ev.push({ type: 'PlayerKnockedOut' });
      }
      this.rules.end('ko');
      this.scoreEvents(ev);
      return ev;
    }

    for (const e of molotovs) {
      this.molotovs.push({ from: v(e.from), to: v(e.to), until: now + MOLOTOV_FLIGHT_SEC });
      // at most one live attack per target: the bottle belongs to it
      const owner = this.attacks.find((a) => a.target === e.target && !a.resolved());
      if (owner) ev.push(...owner.onMolotov(e, this.attackCtx()));
    }
    for (const a of this.attacks) ev.push(...a.step(dt, this.attackCtx()));
    for (const m of this.occupations) {
      ev.push(...m.step(dt, { horde: this.horde, rules: this.rules, monument: this.monument }));
      this.lastOccupation = m;
    }
    // capture the flag: any time the flag is Palestinian, breather included
    ev.push(...this.monument.step(dt, { player: p, horde: this.horde, rules: this.rules }));
    if (this.rescue) ev.push(...this.rescue.step(dt, { horde: this.horde, rules: this.rules, player: p, spawner: this.objectiveSpawner }));

    const kit = this.toolboxes.step(dt, { player: p, horde: this.horde, targets: this.targets, rules: this.rules, act: actPressed });
    ev.push(...kit.events);
    this.toolboxMessage = kit.message;
    const heal = this.stations.step({ player: p, rules: this.rules });
    ev.push(...heal.events);
    this.stationMessage = heal.message;
    ev.push(...this.weapons.step(dt, now, p, this.director.round));
    // a Caïd knocked out by any path (rocks, the beam, a test's direct hit) gets his bonus and drop before the round closes
    for (const h of this.horde.list) if (h.role === 'boss' && h.state === 'ko') this.caidDown(h, ev);

    ev.push(...this.director.step(dt, this));
    this.tally(ev);
    this.scoreEvents(ev);
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
        maxHp: h.maxHp,
        windup: h.state === 'windup',
        bottleUp: h.state === 'windup' && this.horde.bottleUp(h.lifeId),
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
      firebombs: this.firePatches.flying().map((b) => ({ from: v(b.from), to: v(b.to), until: b.landAt })),
      firePatches: this.firePatches.view(this.now),
      school: {
        stage: this.school.stage,
        integrity: this.school.integrity(),
        status: this.school.status(),
      },
      rescue: r
        ? {
            id: r.id,
            stage: r.stage,
            remaining: r.remaining,
            victimPos: v(r.victimPos),
            kind: r.kind,
            items: r.items.map((it) => ({ id: it.id, name: it.name, state: it.state, pos: v(it.pos) })),
            returnLeft: r.returnLeft,
          }
        : null,
      carriedItems: r ? r.carried : 0,
      stations: this.stations.list.map((s) => ({ id: s.id, pos: v(s.pos), charged: s.charged })),
      stationMessage: this.stationMessage,
      weapon: this.weapons.held ? { ...this.weapons.held } : null,
      charge: this.charge ? { progress: Math.min(1, this.charge.t / CONFIG.kamehame.chargeSec) } : null,
      weaponsOnGround: this.weapons.ground.map((w) => ({ id: w.id, kind: w.kind, pos: v(w.pos), expiresAt: w.expiresAt })),
      furie: this.weapons.furie() ? { secondsLeft: this.weapons.furieLeft } : null,
      monument: this.monumentView(),
      stats: { ...this.rules.stats },
    };
  }

  private monumentView(): Snapshot['monument'] {
    const m = this.monument;
    const o = this.occupations[this.occupations.length - 1] ?? this.lastOccupation;
    const z = DISTRICT.monument.zone;
    return {
      flag: m.flag,
      capture: m.progress,
      captureSec: CONFIG.monument.captureSec,
      inZone: m.paulInZone,
      contested: m.contested,
      swaps: m.swaps,
      occupation: o ? { id: o.id, stage: o.stage, swap: o.swapTimer, swapSec: CONFIG.monument.swapSec } : null,
      mast: v(DISTRICT.monument.mast),
      zone: { x: z.x, y: z.y, r: z.r },
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
    // the plinth, while an occupation's rioters hold it (after a swap too, until they are all KO'd)
    if (this.occupations.some((m) => m.live(this.horde)))
      out.monument = {
        points: DISTRICT.monument.attackPoints,
        door: DISTRICT.monument.mast,
        standing: true,
        field: this.monumentField,
      };
    return out;
  }

  private attackCtx() {
    return { horde: this.horde, rules: this.rules };
  }

  private rockCtx(victimPos: Vec | null): RockCtx {
    const area = DISTRICT.peacefulGroup.area;
    const p = this.player;
    return {
      player: {
        pos: p.pos,
        r: CONFIG.player.radius,
        invulnerable: this.invulnerable || p.ko || this.now < p.invulnUntil,
        shield: this.shield(),
      },
      hostiles: this.horde.views(),
      groupBlocks: (a, b) => segmentRectEntry(a, b, area),
      victimPos,
    };
  }

  /** Paul holds the bouclier: its bubble blocks every rock and firebomb that would hit him, from any side. */
  private shield(): boolean {
    return this.weapons.held?.kind === 'bouclier' && !this.player.ko;
  }

  /**
   * The onde d'énergie (kamehame held): a Frapper press starts the charge (BeamCharging); while Frapper stays held it
   * grows, and at CONFIG.kamehame.chargeSec the beam fires on its own. Released, or the weapon gone: cancelled.
   */
  private stepCharge(input: InputFrame, dt: number, ev: SimEvent[]): void {
    const p = this.player;
    const armed = this.weapons.held?.kind === 'kamehame' && !p.ko;
    if (this.charge === null) {
      if (armed && input.strike) {
        this.charge = { t: 0 };
        ev.push({ type: 'BeamCharging' });
      }
      return;
    }
    if (!armed || !input.strikeHeld) {
      this.cancelCharge(ev);
      return;
    }
    this.charge.t += dt;
    if (this.charge.t + 1e-9 < CONFIG.kamehame.chargeSec) return;
    this.charge = null;
    this.fireBeam(ev);
  }

  private cancelCharge(ev: SimEvent[]): void {
    this.charge = null;
    ev.push({ type: 'BeamCancelled' });
  }

  /** The beam along Paul's facing: every rioter on it is KO'd (+1 each) and launched along the beam; one use. */
  private fireBeam(ev: SimEvent[]): void {
    const p = this.player;
    const dir = norm(p.facing);
    const shot = beam(p.pos, dir, this.horde.views(), this.grid);
    const damage = WEAPON_DAMAGE;
    let kos = 0;
    for (const id of shot.lifeIds) {
      ev.push({ type: 'HitConfirmed', targetLifeId: id, damage, source: 'beam' });
      if (this.hit(id, damage, ev, dir)) kos += 1;
    }
    ev.push({ type: 'BeamFired', from: v(p.pos), to: v(shot.to), kos });
    ev.push(...this.weapons.onBeam());
  }

  /** A bouclier bash pushes the KO'd body CONFIG.bouclier.knockback px away from Paul (never into a wall). */
  private knockback(lifeId: number): void {
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    if (!h || h.state !== 'ko') return;
    const away = sub(h.pos, this.player.pos);
    const d = len(away) > 1e-6 ? norm(away) : this.player.facing;
    const k = CONFIG.bouclier.knockback;
    h.pos = moveCircle(this.grid, h.pos, { x: d.x * k, y: d.y * k }, CONFIG.hostile.radius);
  }

  /**
   * Every 'ko' from applyHit scores +1 (deduped by Rules) and emits ActorKnockedOut; `launched` (Paul's strike in mode
   * furie: true; the onde d'énergie: its direction) adds the cosmetic launch payload. True on a KO.
   */
  private hit(lifeId: number, dmg: number, ev: SimEvent[], launched: boolean | Vec = false): boolean {
    if (this.horde.applyHit(lifeId, dmg) !== 'ko') return false;
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    this.rules.onKnockout(lifeId, h?.pos);
    if (h?.role === 'boss') this.caidDown(h, ev);
    const along = typeof launched === 'object' ? launched : undefined;
    ev.push(h && launched ? { type: 'ActorKnockedOut', lifeId, launch: this.launch(h.pos, along) } : { type: 'ActorKnockedOut', lifeId });
    return true;
  }

  /**
   * Flight of a body knocked out at `at`: mode furie = a 'tumble' away from Paul (his facing when on top of him); onde
   * d'énergie = a 'satellite' along `along` (the beam), with the kamehame power/spin ranges. Turned by a jitter; always 4
   * draws from the launch stream.
   */
  private launch(at: Vec, along?: Vec): Launch {
    const launchJitter = along ? CONFIG.kamehame.satelliteJitter : CONFIG.furie.launchJitter;
    const launchPower = along ? CONFIG.kamehame.satellitePower : CONFIG.furie.launchPower;
    const launchSpin = along ? CONFIG.kamehame.satelliteSpin : CONFIG.furie.launchSpin;
    const r = this.launchRand;
    const jitter = (r() * 2 - 1) * launchJitter;
    const power = launchPower[0] + r() * (launchPower[1] - launchPower[0]);
    const turns = launchSpin[0] + r() * (launchSpin[1] - launchSpin[0]);
    const sign = r() < 0.5 ? -1 : 1;
    const away = sub(at, this.player.pos);
    const base = along ?? (len(away) > 1e-6 ? norm(away) : this.player.facing);
    const a = Math.atan2(base.y, base.x) + jitter;
    return { dir: { x: Math.cos(a), y: Math.sin(a) }, power, spin: sign * turns, kind: along ? 'satellite' : 'tumble' };
  }

  /** A brute or the Caïd (heavier hits, CONFIG.toughWeaponDamage from a held weapon). */
  private tough(lifeId: number): boolean {
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    return h !== undefined && isTough(h.role);
  }

  /**
   * « Le Caïd » KO'd (once per life): +CONFIG.caid.bonus with the occurrence key `caid#<round>` at his position (the
   * KO's +1 is scored as for anyone), and a regular weapon dropped where he fell (WeaponSpawned, no indicator).
   */
  private caidDown(h: Hostile, ev: SimEvent[]): void {
    if (this.caidsDown.has(h.lifeId)) return;
    this.caidsDown.add(h.lifeId);
    this.rules.award(`caid#${h.round ?? this.director.round}`, CONFIG.caid.bonus, h.pos);
    const w = this.weapons.dropAt(h.pos);
    ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: v(w.pos) });
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

  /** One ScoreChanged per score change applied since the last step, where it happened (else at Paul). */
  private scoreEvents(ev: SimEvent[]): void {
    for (const e of this.rules.drain()) ev.push({ type: 'ScoreChanged', points: e.points, pos: e.at ?? v(this.player.pos) });
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
      else if (e.type === 'ItemReturned') s.itemsReturned += 1;
      else if (e.type === 'FlagCaptured') s.flagsCaptured += 1;
      else if (e.type === 'FlagSwapped') s.flagsLost += 1;
      else if (e.type === 'MonumentDefended') s.monumentsDefended += 1;
    }
  }
}
