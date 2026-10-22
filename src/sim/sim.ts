import { Allies, type AlliesView } from './allies';
import { Bullets } from './bullets';
import { CONFIG } from './config';
import { Director, spawnPoints, type RoundPhase, type RoundSummary } from './director';
import { Energy } from './energy';
import { pickFall, type FallSource } from './falls';
import { EntryQueue, type Spawner } from './entry';
import { FieldHeals } from './fieldHeals';
import { FirePatches } from './firepatch';
import { Stations, type StationMessage } from './healing';
import { damageOn, Horde, isTough, KO_DAMAGE, type DamageSource, type Hostile, type HordeCtx } from './hostiles';
import type { ItemState, RescueIncident, RescueKind, RescueStage } from './incidents/rescue';
import { SchoolIncident, type SchoolStage } from './incidents/school';
import type { TargetAttack } from './incidents/targetAttack';
import { moveCircle } from './map/collide';
import { DISTRICT, type Rect } from './map/district';
import { FlowField } from './map/flowfield';
import { Grid } from './map/grid';
import { dist, inArc, len, norm, segmentCircleHit, sub } from './math';
import { Monument, MonumentIncident, type MonumentStage } from './monument';
import { createPlayer, damagePlayer, readyStrike, stepPlayer, sweep, type Player } from './player';
import { Rocks, type RockCtx, type RockState } from './projectiles';
import { Prison, type PrisonView } from './prison';
import { rng } from './rng';
import { Toolboxes, type ToolboxMessage } from './repair';
import { Rules, type SessionStats } from './rules';
import { BOOTH_OF, Services, type CallCtx } from './services';
import { beam } from './specials';
import { Targets } from './targets';
import type { CasseKind, InputFrame, Launch, MonumentFlag, Role, ServiceKind, SimEvent, TargetId, Variant, Vec } from './types';
import { WEAPONS, Weapons, type HeldKind, type PickupKind } from './weapons';

/** How long a thrown bottle is drawn in flight (render only; the fire starts on the throw). */
export const MOLOTOV_FLIGHT_SEC = 0.6;

/** What a fresh Agir press does (or what it lacks) right now: the in-world prompt above `at` (a target's door). */
export type ActionHintKind = 'repair' | 'extinguish' | 'callFire' | 'callPolice' | 'needToolbox';
export interface ActionHint {
  kind: ActionHintKind;
  target: TargetId;
  at: Vec;
  /** needToolbox: the nearest toolbox on the ground (null when none, or for the other kinds). */
  toolbox: Vec | null;
}

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
    /** A shooter aiming or firing its burst (raised rifle, « ! »). */
    aiming: boolean;
  }[];
  rocks: { id: number; state: RockState; owner: 'enemy' | 'player'; kind: 'caillou' | 'pave' | 'brique'; pos: Vec }[];
  telegraphs: Telegraph[];
  /** Shooters' aim lines (from the shooter to where Paul stood at aim start) while they aim; gone at a KO. */
  aims: Telegraph[];
  /** Shooters' bullets in flight (`dir` unit). */
  bullets: { id: number; pos: Vec; dir: Vec }[];
  /** Paul's flashball shots in flight (`dir` unit). */
  flashballs: { id: number; pos: Vec; dir: Vec }[];
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
  /** Small field heals on the ground; `expiresAt` = sim time it vanishes (the render blinks its last seconds). */
  fieldHeals: { id: number; pos: Vec; expiresAt: number }[];
  /** Weapon in Paul's hands (null = bare hands) and its strikes left. */
  weapon: { kind: HeldKind; uses: number } | null;
  /** The bouclier's protection bubble on top of the held weapon (seconds left), or null. */
  shield: { secondsLeft: number } | null;
  /** Onde d’énergie charging: `progress` in [0, 1] of CONFIG.kamehame.chargeSec; null when not charging. */
  charge: { progress: number } | null;
  /** `expiresAt` = sim time a special drop vanishes (null = never). */
  weaponsOnGround: { id: number; kind: PickupKind; pos: Vec; expiresAt: number | null }[];
  /** Mode furie on (seconds left), or null. */
  furie: { secondsLeft: number } | null;
  /**
   * The energy gauge (0..max, kept across rounds): `ready.onde` = the onde d’énergie can be charged (>= ondeCost),
   * `ready.furie` = the mode furie can start (full).
   */
  energy: { value: number; max: number; ready: { onde: boolean; furie: boolean } };
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
  /**
   * Emergency calls left (3 + 3 per session) and `hint`: a call of that kind would be accepted right now (booth
   * standing, a call left, no help of that kind on the map, a fire burning / enough rioters).
   */
  services: { calls: { fire: number; police: number }; hint: { fire: boolean; police: boolean } };
  /**
   * The emergency services on the map: the fire truck (null when none; `target` = the fire it drives to or sprays) and
   * the police officers (`down` = knocked out, carried off a few seconds later).
   */
  allies: AlliesView;
  /** The prison: Caïds jailed, its guards (by post), whether it stands. */
  prison: PrisonView;
  /**
   * What a fresh Agir press would do now, by the same rules as the press itself (Sim.agirChoice): a repair or an
   * extinguish that would start, a booth call that would be accepted; or `needToolbox` next to a ruin or a fire without
   * a toolbox. Null otherwise (nothing in reach, a rioter too close, a call that would be refused, cinematic, KO, end).
   */
  actionHint: ActionHint | null;
}

const SERVICE_KINDS: readonly ServiceKind[] = ['fire', 'police'];

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
 * Step order: player move → sweep/punch/shot/return → hostiles → queue entries (the first shooter brings a flashball)
 * → rocks → bullets → damage → fire patches → KO check → Molotovs routed to
 * the attack on their target → attacks → rescue → toolboxes → heals → weapons (pickups, furie timer) → director →
 * field heals (fed with the round KOs' growth: drops, pickups, expiry).
 * Energy gauge (CONFIG.energy): every KO counted by Rules fills it, except in mode furie and the beam's own KOs.
 * Furie (`input.furie`, full gauge) spends it all on the mode furie (CONFIG.furie: player move, strike and damage
 * taken; a KO ends it). Onde (`input.chargeHeld`, only its rising edge: one tap is enough, >= ondeCost) starts the
 * charge of the onde d'énergie (Paul frozen), which runs on its own whether the key stays down or not, fires a beam at
 * CONFIG.kamehame.chargeSec and spends ondeCost only then; only a mode furie started or Paul's KO cancels it, at no
 * cost (damage taken does not). Too little energy: EnergyRefused. The bouclier is a protection timer on top of the held
 * weapon (rocks, firebombs and bullets blocked from any side); it adds no damage and never changes the strike.
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
  /** Shooters' bullets and Paul's flashball shots. */
  readonly bullets = new Bullets(this.grid);
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
  /** Small field heals dropped near Paul every CONFIG.fieldHeal.every eligible KOs. */
  readonly fieldHeals: FieldHeals;
  readonly toolboxes = new Toolboxes();
  /** Phone booth calls (fire truck, police): counters and acceptance. */
  readonly services = new Services();
  /** The fire truck and the police group on the map (own random stream for their entry point). */
  readonly allies: Allies;
  /** The prison's cells (jailed Caïds, breakout) and its guards (allies of role 'guard'). */
  readonly prison: Prison;
  readonly firePatches = new FirePatches();
  /** The equestrian monument's flag and capture the flag (persists across rounds). */
  readonly monument = new Monument();
  /** Monument occupations still holding the plinth (pruned by the director at round start). */
  readonly occupations: MonumentIncident[] = [];
  /** The latest occupation (HUD), kept after it ends. */
  private lastOccupation: MonumentIncident | null = null;
  readonly director = new Director();
  readonly weapons: Weapons;
  /** The energy gauge: fed by KOs, spent by the mode furie and the onde d'énergie; kept across rounds. */
  readonly energy = new Energy();
  readonly rand: () => number;
  /** Own stream for the cosmetic furie launches, so they never shift any other random sequence. */
  private readonly launchRand: () => number;
  /** Own stream for the KO falls (3 draws per KO), so they never shift any other random sequence. */
  private readonly fallRand: () => number;
  rescue: RescueIncident | null = null;
  now = 0;
  paused = false;

  private readonly invulnerable: boolean;
  private readonly fields: { player: FlowField; victim: FlowField };
  /** One flow field per target, used while an attack on it is live. */
  private readonly siteFields = new Map<TargetId, FlowField>();
  private readonly monumentField: FlowField;
  private telegraphs: Telegraph[] = [];
  private aims: (Telegraph & { lifeId: number })[] = [];
  /** The flashball guaranteed with the session's first shooter was dropped. */
  private flashballGiven = false;
  private molotovs: Telegraph[] = [];
  private facings = new Map<number, Vec>();
  private stationMessage: StationMessage = null;
  private toolboxMessage: ToolboxMessage = null;
  private koReported = false;
  /** Onde d'énergie charge under way: seconds since the press (it runs on its own once started). */
  private charge: { t: number } | null = null;
  /** Caïds whose KO was already rewarded (bonus + weapon drop). */
  private readonly caidsDown = new Set<number>();
  /** Agir (F / touch Agir) was down on the previous step: the toolbox only reacts to a fresh press (rising edge). */
  private prevAct = false;
  /** Onde (C / touch Onde) was down on the previous step: a charge only starts on a fresh press. */
  private prevCharge = false;
  /** Round and round KOs last fed to the field heals. */
  private healRound = 0;
  private healKos = 0;

  constructor(seed: number, opts: { invulnerable?: boolean } = {}) {
    this.rand = rng(seed);
    // Separate stream so weapon spawns never shift the director's random sequence.
    this.weapons = new Weapons(this.grid, rng((seed ^ 0x9e3779b9) >>> 0));
    this.launchRand = rng((seed ^ 0x85ebca6b) >>> 0);
    this.fallRand = rng((seed ^ 0x9e3779b1) >>> 0);
    this.fieldHeals = new FieldHeals(this.grid, rng((seed ^ 0xc2b2ae35) >>> 0));
    this.allies = new Allies(this.grid, rng((seed ^ 0x27d4eb2f) >>> 0));
    this.prison = new Prison(this.allies, this.grid);
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
    const chargePressed = input.chargeHeld && !this.prevCharge;
    this.prevCharge = input.chargeHeld;
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

    if (input.furie) this.activateFurie(ev);
    const furie = this.weapons.furie();
    // charging the onde d'énergie: movement ignored (aim still turns Paul)
    const frozen = this.charge !== null;
    stepPlayer(p, frozen ? { ...input, move: { x: 0, y: 0 } } : input, dt, now, this.grid, furie ? CONFIG.furie.speedMul : 1);
    // no swing on the step a charge starts, while it grows, or the step it fires
    if (frozen) this.stepCharge(dt, ev);
    else if (chargePressed) this.startCharge(ev);
    const mode = this.strikeMode(furie);
    if (!frozen && this.charge === null && input.strike && mode === 'shot') this.fireFlashball(input, now, ev);
    else if (!frozen && this.charge === null && input.strike && mode === 'punch') this.punch(now, ev);
    else if (!frozen && this.charge === null && input.strike) {
      // Bare hands: 1 damage. A regular weapon: KO in one hit, but CONFIG.toughWeaponDamage on a brute or the Caïd.
      // Mode furie: KO in one hit (CONFIG.caid.damageFrom.furie on the Caïd), more targets, the weapon is not used,
      // every KO is launched. The bouclier changes nothing.
      const source: DamageSource = furie ? 'furie' : this.weapons.held ? 'weapon' : 'hands';
      const fall: FallSource = furie ? 'furie' : (this.weapons.held?.kind ?? 'hands');
      const maxTargets = furie ? CONFIG.furie.maxTargets : CONFIG.melee.maxTargets;
      const { hits } = sweep(p, now, this.horde.views(), this.grid, this.weapons.range(), maxTargets);
      for (const id of hits) {
        const tough = this.tough(id);
        const damage = this.damageTo(id, source);
        ev.push(tough ? { type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee', heavy: true } : { type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee' });
        this.hit(id, damage, ev, fall);
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
      bullets: this.bullets,
      sites: this.sites(),
      victimPos,
      pressure: this.director.pressure(this.rules.kos),
      allies: { list: this.allies.targetsFor(), hit: (id, amount) => ev.push(...this.allies.damage(id, amount)) },
    });
    this.syncServices();
    this.updateFacings(prev);
    for (const h of this.queue.step(dt, this.horde, spawnPoints(p.pos))) {
      if (h.role === 'boss') ev.push({ type: 'CaidArrived', lifeId: h.lifeId, pos: v(h.pos), round: h.round ?? this.director.round });
      else if (h.role === 'shooter' && !this.flashballGiven) this.giveFlashball(ev);
    }
    const rockEv = this.rocks.step(dt, now, this.rockCtx(victimPos));
    const shots = this.bullets.step(dt, this.bulletCtx(victimPos));

    // damage, hits and rock bookkeeping
    const molotovs: Extract<SimEvent, { type: 'MolotovThrown' }>[] = [];
    for (const e of [...hordeEv, ...rockEv, ...shots.events]) {
      if (e.type === 'PlayerDamaged') {
        const amount = this.weapons.furie() ? e.amount * CONFIG.furie.damageTakenMul : e.amount;
        if (!this.invulnerable && damagePlayer(p, amount, now)) {
          ev.push({ ...e, amount });
          // a brute's or the Caïd's blow: Paul is pushed through the player move (solids block it)
          if (e.push && !p.ko) p.pos = moveCircle(this.grid, p.pos, e.push, CONFIG.player.radius);
        }
        continue;
      }
      if (e.type === 'HitConfirmed' && e.source === 'rock') {
        // a returned rock: its damage per the target's role (CONFIG.caid.damageFrom.rock on the Caïd)
        const damage = this.damageTo(e.targetLifeId, 'rock', e.damage);
        ev.push({ ...e, damage });
        this.rules.stats.rocksHit += 1;
        this.hit(e.targetLifeId, damage, ev, 'rock');
        continue;
      }
      ev.push(e);
      if (e.type === 'MolotovThrown') molotovs.push(e);
      else if (e.type === 'FirebombThrown') this.firePatches.throwBottle(e.from, e.to, e.until);
      else if (e.type === 'EnemyThrowStarted') this.telegraphs.push({ from: v(e.from), to: v(e.to), until: e.until });
      else if (e.type === 'ShooterAimStarted') this.aims.push({ lifeId: e.lifeId, from: v(e.from), to: v(e.to), until: e.until });
      else if (e.type === 'ProjectilePickedUp') this.rules.stats.rocksPicked += 1;
      else if (e.type === 'ProjectileReturned') this.rules.stats.rocksReturned += 1;
    }
    // flashball shots: a weapon hit on the first rioter on their path
    for (const s of shots.hits) {
      const tough = this.tough(s.lifeId);
      const damage = this.damageTo(s.lifeId, 'weapon');
      ev.push(
        tough
          ? { type: 'HitConfirmed', targetLifeId: s.lifeId, damage, source: 'flashball', heavy: true }
          : { type: 'HitConfirmed', targetLifeId: s.lifeId, damage, source: 'flashball' },
      );
      this.hit(s.lifeId, damage, ev, 'flashball');
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
    // a KO cancels the charge (nothing used); damage alone no longer does
    if (this.charge !== null && p.ko) this.cancelCharge(ev);
    this.telegraphs = this.telegraphs.filter((t) => t.until > now);
    // an aim line goes with its shooter's KO
    this.aims = this.aims.filter((t) => t.until > now && this.horde.list.some((h) => h.lifeId === t.lifeId && h.state !== 'ko'));
    this.molotovs = this.molotovs.filter((t) => t.until > now);

    if (p.ko) {
      ev.push(...this.weapons.endFurie());
      ev.push(...this.weapons.endShield());
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

    // a fresh Agir press goes to the nearest of the startable repair and the booths in call range (ties: repair > red > blue)
    const kitAct = actPressed && this.agirAtBooth(ev) === null;
    const kit = this.toolboxes.step(dt, { player: p, horde: this.horde, targets: this.targets, rules: this.rules, act: kitAct });
    ev.push(...kit.events);
    this.toolboxMessage = kit.message;
    // the truck, the police and the prison guards: drive, spray, fight (their KOs score +1 like any KO, without energy)
    ev.push(
      ...this.allies.step(dt, {
        now,
        horde: this.horde,
        targets: this.targets,
        rules: this.rules,
        strike: (lifeId, from, role) => this.policeStrike(lifeId, from, ev, role === 'guard' ? 'hands' : 'weapon'),
      }),
    );
    this.syncServices();
    // the prison fell this step (by any path): every jailed Caïd out at its door, in the roster
    ev.push(...this.prison.step({ targets: this.targets, horde: this.horde, dt, extend: (n, e) => this.director.extend(n, e) }));
    const heal = this.stations.step({ player: p, rules: this.rules });
    ev.push(...heal.events);
    this.stationMessage = heal.message;
    ev.push(...this.weapons.step(dt, now, p, this.director.round));
    // a Caïd knocked out by any path (rocks, the beam, a test's direct hit) gets his bonus and drop before the round closes
    for (const h of this.horde.list) if (h.role === 'boss' && h.state === 'ko') this.caidDown(h, ev);

    const dirEv = this.director.step(dt, this);
    ev.push(...dirEv);
    // the round is over: the prison's guards come back (while it stands) with the coming round's hp
    if (dirEv.some((e) => e.type === 'RoundCompleted')) ev.push(...this.prison.onBreather(this.director.round, this.targets));
    this.feedFieldHeals();
    ev.push(...this.fieldHeals.step(now, { player: p, rules: this.rules }));
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
        aiming: h.state === 'windup' && this.horde.aiming(h.lifeId),
      })),
      rocks: [...this.rocks.flying(), ...this.rocks.ground()].map((k) => ({
        id: k.id,
        state: k.state,
        owner: k.owner,
        kind: k.kind,
        pos: v(k.pos),
      })),
      telegraphs: this.telegraphs.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
      aims: this.aims.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
      bullets: this.bullets.enemy().map((b) => ({ id: b.id, pos: v(b.pos), dir: v(b.dir) })),
      flashballs: this.bullets.player().map((b) => ({ id: b.id, pos: v(b.pos), dir: v(b.dir) })),
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
      fieldHeals: this.fieldHeals.ground.map((h) => ({ id: h.id, pos: v(h.pos), expiresAt: h.expiresAt })),
      weapon: this.weapons.held ? { kind: this.weapons.held.kind, uses: this.weapons.held.uses } : null,
      shield: this.weapons.shield() ? { secondsLeft: this.weapons.shieldLeft } : null,
      charge: this.charge ? { progress: Math.min(1, this.charge.t / CONFIG.kamehame.chargeSec) } : null,
      weaponsOnGround: this.weapons.ground.map((w) => ({ id: w.id, kind: w.kind, pos: v(w.pos), expiresAt: w.expiresAt })),
      furie: this.weapons.furie() ? { secondsLeft: this.weapons.furieLeft } : null,
      energy: { value: this.energy.value, max: CONFIG.energy.max, ready: this.energy.ready() },
      monument: this.monumentView(),
      stats: { ...this.rules.stats },
      allies: this.allies.view(),
      prison: this.prison.view(this.targets),
      services: {
        calls: { ...this.services.calls },
        hint: { fire: this.services.check('fire', this.callCtx('fire')).ok, police: this.services.check('police', this.callCtx('police')).ok },
      },
      actionHint: this.actionHint(),
    };
  }

  /** Snapshot.actionHint: the press's own choice (agirChoice), then the toolbox it lacks. */
  private actionHint(): ActionHint | null {
    if (this.rules.ended || this.player.ko || this.school.suspended()) return null;
    const p = this.player.pos;
    const doorOf = (id: TargetId): Vec => v(DISTRICT.targets.find((t) => t.id === id)!.door);
    const choice = this.agirChoice();
    if (choice?.kind === 'repair') {
      const kind = this.targets.get(choice.target).state === 'ruined' ? 'repair' : 'extinguish';
      return { kind, target: choice.target, at: doorOf(choice.target), toolbox: null };
    }
    if (choice?.kind === 'booth' && this.services.check(choice.service, this.callCtx(choice.service)).ok) {
      const target = BOOTH_OF[choice.service];
      return { kind: choice.service === 'fire' ? 'callFire' : 'callPolice', target, at: doorOf(target), toolbox: null };
    }
    if (this.toolboxes.carried) return null;
    const target = this.toolboxes.repairTarget(p, this.targets);
    if (target === null) return null;
    let toolbox: Vec | null = null;
    for (const g of this.toolboxes.ground) if (!toolbox || dist(p, g.pos) < dist(p, toolbox)) toolbox = g.pos;
    return { kind: 'needToolbox', target, at: doorOf(target), toolbox: toolbox ? v(toolbox) : null };
  }

  /** What a call of `kind` from its booth would weigh now. */
  private callCtx(kind: ServiceKind): CallCtx {
    let burning = 0;
    for (const t of DISTRICT.targets) if (this.targets.get(t.id).burning) burning++;
    return {
      burning,
      activeHostiles: this.horde.active().length,
      boothStanding: this.targets.standing(BOOTH_OF[kind]),
      // kept in step with the allies (syncServices)
      busy: this.services.active[kind],
    };
  }

  /**
   * What a fresh Agir press goes to: the nearest of a repair that would start (Toolboxes.startable, at its target's
   * door) and the booths whose door is within CONFIG.services.callRange of Paul; ties go to the repair, then red, then
   * blue. Null: nothing in reach.
   */
  private agirChoice(): { kind: 'booth'; service: ServiceKind } | { kind: 'repair'; target: TargetId } | null {
    const p = this.player.pos;
    const repair = this.toolboxes.startable(p, this.horde, this.targets);
    let best: ServiceKind | null = null;
    let bestD = repair === null ? Infinity : dist(p, DISTRICT.targets.find((t) => t.id === repair)!.door);
    for (const kind of SERVICE_KINDS) {
      const d = dist(p, DISTRICT.targets.find((t) => t.id === BOOTH_OF[kind])!.door);
      // strictly nearer by more than a rounding error: equal distances keep the earlier candidate
      if (d <= CONFIG.services.callRange && d < bestD - 1e-9) {
        best = kind;
        bestD = d;
      }
    }
    if (best !== null) return { kind: 'booth', service: best };
    return repair === null ? null : { kind: 'repair', target: repair };
  }

  /**
   * A fresh Agir press (agirChoice): a booth that wins makes the call (ServiceCalled, or ServiceRefused with the
   * reason) and returns its kind; null leaves the press to the toolbox.
   */
  private agirAtBooth(ev: SimEvent[]): ServiceKind | null {
    const choice = this.agirChoice();
    if (choice?.kind !== 'booth') return null;
    const best = choice.service;
    const r = this.services.tryCall(best, this.callCtx(best));
    if (r.ok) {
      ev.push({ type: 'ServiceCalled', kind: best });
      ev.push(...this.allies.call(best, this.now));
      this.syncServices();
    } else ev.push({ type: 'ServiceRefused', kind: best, reason: r.reason });
    return best;
  }

  /** Services.active follows the allies: a truck / a police group on the map makes a new call of that kind 'busy'. */
  private syncServices(): void {
    for (const kind of SERVICE_KINDS) this.services.active[kind] = this.allies.onMap(kind);
  }

  /**
   * An officer's baton blow from `from`: a weapon hit (KO but for a brute or the Caïd, damageOn; a prison guard's is a
   * bare-hands hit, `source` 'hands', so guards alone do not make the prison untouchable), the KO scored +1 by
   * Rules like any (a Caïd's bonus too), falling away from the officer; it never fills the energy gauge.
   */
  private policeStrike(lifeId: number, from: Vec, ev: SimEvent[], source: DamageSource = 'weapon'): void {
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    if (!h || h.state === 'ko') return;
    const away = sub(h.pos, from);
    this.hit(lifeId, this.damageTo(lifeId, source), ev, 'baton', undefined, len(away) > 1e-6 ? norm(away) : undefined, false);
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

  private bulletCtx(victimPos: Vec | null) {
    const p = this.player;
    const area = DISTRICT.peacefulGroup.area;
    return {
      player: { pos: p.pos, r: CONFIG.player.radius, invulnerable: this.invulnerable || p.ko || this.now < p.invulnUntil, shield: this.shield() },
      hostiles: this.horde.views(),
      groupBlocks: (a: Vec, b: Vec) => segmentRectEntry(a, b, area),
      victimPos,
    };
  }

  /** How Paul's strike works now: mode furie and bare hands swing, else the held weapon's own way. */
  private strikeMode(furie: boolean): 'swing' | 'punch' | 'shot' {
    const k = this.weapons.held?.kind;
    if (furie || k === undefined) return 'swing';
    return WEAPONS[k].strike;
  }

  /**
   * Flashball: one shot (strike cooldown as a swing) along the mouse aim; without one, along the facing snapped to the
   * nearest active rioter within ±assistDeg and assistRange with a clear line. The shot is used whether it hits or not.
   */
  private fireFlashball(input: InputFrame, now: number, ev: SimEvent[]): void {
    const p = this.player;
    if (!readyStrike(p, now)) return;
    let dir = norm(input.aim && len(input.aim) > 0 ? input.aim : p.facing);
    if (!input.aim || len(input.aim) === 0) {
      const c = CONFIG.flashball;
      let best: { pos: Vec; d: number; id: number } | null = null;
      for (const h of this.horde.list) {
        if (h.state === 'ko') continue;
        if (!inArc(p.pos, dir, h.pos, c.assistRange, c.assistDeg * 2) || !this.grid.lineClear(p.pos, h.pos)) continue;
        const d = dist(p.pos, h.pos);
        if (!best || d < best.d || (d === best.d && h.lifeId < best.id)) best = { pos: h.pos, d, id: h.lifeId };
      }
      if (best && best.d > 1e-6) dir = norm(sub(best.pos, p.pos));
    }
    p.facing = dir;
    const shot = this.bullets.shoot(p.pos, dir);
    ev.push({ type: 'FlashballFired', id: shot.id, from: v(p.pos), dir: v(dir) });
    ev.push(...this.weapons.onShot());
  }

  /**
   * Gant de boxe: a straight punch of CONFIG.gant.reach px along the facing (the aim), cut at the first solid (the
   * peaceful group included) or the victim. The first active rioter on it takes a weapon hit and is pushed
   * CONFIG.gant.knockback px along the punch (a KO body is launched); a use is spent only on a hit.
   */
  private punch(now: number, ev: SimEvent[]): void {
    const p = this.player;
    if (!readyStrike(p, now)) return;
    const dir = norm(p.facing);
    const reach = CONFIG.gant.reach;
    let to = { ...p.pos };
    for (let s = 2; s <= reach; s += 2) {
      const q = { x: p.pos.x + dir.x * s, y: p.pos.y + dir.y * s };
      if (this.grid.isSolidPx(q)) break;
      to = q;
    }
    const vp = this.rescue?.stage === 'threat' ? this.rescue.victimPos : null;
    const vt = vp ? segmentCircleHit(p.pos, to, vp, 8) : null;
    if (vt !== null) to = { x: p.pos.x + (to.x - p.pos.x) * vt, y: p.pos.y + (to.y - p.pos.y) * vt };
    let best: { id: number; t: number } | null = null;
    for (const h of this.horde.views()) {
      if (!h.active) continue;
      const t = segmentCircleHit(p.pos, to, h.pos, h.r);
      if (t !== null && (!best || t < best.t || (t === best.t && h.lifeId < best.id))) best = { id: h.lifeId, t };
    }
    if (!best) {
      ev.push({ type: 'GlovePunched', from: v(p.pos), to: v(to), lifeId: null });
      return;
    }
    const h = this.horde.list.find((x) => x.lifeId === best!.id)!;
    ev.push({ type: 'GlovePunched', from: v(p.pos), to: v(h.pos), lifeId: h.lifeId });
    const tough = isTough(h.role);
    const damage = damageOn(h.role, 'weapon');
    ev.push(
      tough
        ? { type: 'HitConfirmed', targetLifeId: h.lifeId, damage, source: 'gant', heavy: true }
        : { type: 'HitConfirmed', targetLifeId: h.lifeId, damage, source: 'gant' },
    );
    const k = CONFIG.gant.knockback;
    h.pos = moveCircle(this.grid, h.pos, { x: dir.x * k, y: dir.y * k }, CONFIG.hostile.radius);
    this.hit(h.lifeId, damage, ev, 'gant');
    ev.push(...this.weapons.onSwing(1));
  }

  /** The session's first shooter walked in: a flashball dropped CONFIG.flashball.dropMin–dropMax px from Paul (once). */
  private giveFlashball(ev: SimEvent[]): void {
    const c = CONFIG.flashball;
    const w = this.weapons.dropNear(this.player.pos, 'flashball', c.dropMin, c.dropMax);
    if (!w) return;
    this.flashballGiven = true;
    ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: v(w.pos) });
    ev.push({ type: 'FlashballDropped', pos: v(w.pos) });
  }

  /** The bouclier's protection is on: its bubble blocks every rock, firebomb and bullet that would hit Paul, from any side. */
  private shield(): boolean {
    return this.weapons.shield() && !this.player.ko;
  }

  /**
   * Furie pressed: with a full gauge (and Paul up, no mode furie already on) the whole gauge is spent and the mode
   * starts (a charge under way is cancelled at no cost); with less: EnergyRefused.
   */
  private activateFurie(ev: SimEvent[]): void {
    if (this.player.ko || this.weapons.furie()) return;
    const cost = CONFIG.energy.furieCost;
    if (!this.energy.spend(cost)) {
      ev.push({ type: 'EnergyRefused', need: cost });
      return;
    }
    if (this.charge !== null) this.cancelCharge(ev);
    ev.push(...this.weapons.startFurie());
  }

  /** Onde pressed: with at least ondeCost energy (and Paul up) the charge starts (BeamCharging); else EnergyRefused. */
  private startCharge(ev: SimEvent[]): void {
    if (this.player.ko) return;
    if (this.energy.value < CONFIG.energy.ondeCost) {
      ev.push({ type: 'EnergyRefused', need: CONFIG.energy.ondeCost });
      return;
    }
    this.charge = { t: 0 };
    ev.push({ type: 'BeamCharging' });
  }

  /**
   * The charge grows on its own (Onde need not stay held: releasing it changes nothing); at CONFIG.kamehame.chargeSec
   * the beam fires and the energy is spent then. Paul KO (or, defensively, the energy gone): cancelled, nothing spent.
   */
  private stepCharge(dt: number, ev: SimEvent[]): void {
    if (this.charge === null) return;
    if (this.player.ko) {
      this.cancelCharge(ev);
      return;
    }
    this.charge.t += dt;
    if (this.charge.t + 1e-9 < CONFIG.kamehame.chargeSec) return;
    if (!this.energy.spend(CONFIG.energy.ondeCost)) {
      this.cancelCharge(ev);
      return;
    }
    this.charge = null;
    this.fireBeam(ev);
  }

  private cancelCharge(ev: SimEvent[]): void {
    this.charge = null;
    ev.push({ type: 'BeamCancelled' });
  }

  /**
   * The beam along Paul's facing: every rioter on it is KO'd (+1 each, no energy) and launched along the beam; the Caïd
   * takes CONFIG.caid.damageFrom.beam.
   */
  private fireBeam(ev: SimEvent[]): void {
    const p = this.player;
    const dir = norm(p.facing);
    const shot = beam(p.pos, dir, this.horde.views(), this.grid);
    let kos = 0;
    for (const id of shot.lifeIds) {
      const damage = this.damageTo(id, 'beam');
      ev.push({ type: 'HitConfirmed', targetLifeId: id, damage, source: 'beam' });
      if (this.hit(id, damage, ev, 'beam', dir)) kos += 1;
    }
    ev.push({ type: 'BeamFired', from: v(p.pos), to: v(shot.to), kos });
  }

  /**
   * Every 'ko' from applyHit scores +1 (deduped by Rules) and emits ActorKnockedOut with its fall (pickFall by `source`,
   * along the launch, else `dir`, else away from Paul). Mode furie, the gant and the beam (`along` = its direction) add
   * the cosmetic launch payload. A KO Rules counts fills the energy gauge, except in mode furie and for the beam's KOs
   * (no chain refills). A WTF 'domino' then knocks its neighbours down (dominoVictims) through this same path, as
   * 'knocked' (which never chains); none: 'faceplant'. True on a KO.
   */
  private hit(lifeId: number, dmg: number, ev: SimEvent[], source: FallSource, along?: Vec, dir?: Vec, energy = true): boolean {
    if (this.horde.applyHit(lifeId, dmg) !== 'ko') return false;
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    const counted = this.rules.onKnockout(lifeId, h?.pos);
    if (counted && h && energy && !this.weapons.furie() && source !== 'beam') ev.push(...this.energy.gain(h.role));
    if (h?.role === 'boss') this.caidDown(h, ev);
    const launched = source === 'furie' || source === 'gant' || source === 'beam';
    const launch = h && launched ? this.launch(h.pos, along, source === 'gant') : undefined;
    const away = h ? sub(h.pos, this.player.pos) : { x: 0, y: 0 };
    const fallDir = launch?.dir ?? dir ?? (len(away) > 1e-6 ? norm(away) : norm(this.player.facing));
    let fall = pickFall(source, { boss: h?.role === 'boss', launched: launch !== undefined, dir: fallDir }, this.fallRand);
    const victims = fall.kind === 'domino' && h ? this.dominoVictims(h) : [];
    if (fall.kind === 'domino' && victims.length === 0) fall = { ...fall, kind: 'faceplant' };
    ev.push(launch ? { type: 'ActorKnockedOut', lifeId, launch, fall } : { type: 'ActorKnockedOut', lifeId, fall });
    if (victims.length > 0) {
      ev.push({ type: 'DominoTriggered', from: v(h!.pos), lifeIds: victims.map((x) => x.lifeId) });
      for (const x of victims) this.hit(x.lifeId, KO_DAMAGE, ev, 'knocked', undefined, fall.dir, energy);
    }
    return true;
  }

  /** Up to CONFIG.falls.dominoMax living non-boss rioters within CONFIG.falls.dominoRadius px of `body`, nearest first. */
  private dominoVictims(body: Hostile): Hostile[] {
    const { dominoRadius, dominoMax } = CONFIG.falls;
    const near: { h: Hostile; d: number }[] = [];
    for (const h of this.horde.list) {
      if (h === body || h.state === 'ko' || h.role === 'boss') continue;
      const d = dist(h.pos, body.pos);
      if (d <= dominoRadius) near.push({ h, d });
    }
    near.sort((a, b) => a.d - b.d || a.h.lifeId - b.h.lifeId);
    return near.slice(0, dominoMax).map((x) => x.h);
  }

  /**
   * Flight of a body knocked out at `at`: mode furie = a 'tumble' away from Paul (his facing when on top of him); the
   * gant = a shorter tumble (CONFIG.gant power/spin); onde d'énergie = a 'satellite' along `along` (the beam), with the
   * kamehame power/spin ranges. Turned by a jitter; always 4 draws from the launch stream.
   */
  private launch(at: Vec, along?: Vec, gant = false): Launch {
    const launchJitter = along ? CONFIG.kamehame.satelliteJitter : CONFIG.furie.launchJitter;
    const launchPower = along ? CONFIG.kamehame.satellitePower : gant ? CONFIG.gant.launchPower : CONFIG.furie.launchPower;
    const launchSpin = along ? CONFIG.kamehame.satelliteSpin : gant ? CONFIG.gant.launchSpin : CONFIG.furie.launchSpin;
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

  /** Damage rioter `lifeId` takes from `source` (damageOn by its role; `fallback` when it is gone). */
  private damageTo(lifeId: number, source: DamageSource, fallback = KO_DAMAGE): number {
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    return h ? damageOn(h.role, source) : fallback;
  }

  /** A brute or the Caïd (heavier hits, CONFIG.toughWeaponDamage from a held weapon). */
  private tough(lifeId: number): boolean {
    const h = this.horde.list.find((x) => x.lifeId === lifeId);
    return h !== undefined && isTough(h.role);
  }

  /**
   * « Le Caïd » KO'd (once per life): +CONFIG.caid.bonus with the occurrence key `caid#<round>` at his position (the
   * KO's +1 is scored as for anyone), and CONFIG.caid.dropShare of the time a regular weapon dropped where he fell
   * (WeaponSpawned, no indicator; none while a weapon lies within CONFIG.weapons.clearRadius px of Paul); jailed while
   * the prison stands (CaidJailed).
   */
  private caidDown(h: Hostile, ev: SimEvent[]): void {
    if (this.caidsDown.has(h.lifeId)) return;
    this.caidsDown.add(h.lifeId);
    this.rules.award(`caid#${h.round ?? this.director.round}`, CONFIG.caid.bonus, h.pos);
    const w = this.weapons.dropAt(h.pos, this.player.pos);
    if (w) ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: v(w.pos) });
    // the jail van takes him to the prison, while it stands
    ev.push(...this.prison.jail(h, this.targets, this.director.round));
  }

  /** Hostile facing = along its aim line while a shooter aims or fires, else last movement direction, else toward Paul. */
  private updateFacings(prev: Map<number, Vec>): void {
    const next = new Map<number, Vec>();
    for (const h of this.horde.list) {
      const aim = h.role === 'shooter' && h.state === 'windup' ? this.horde.aimLine(h.lifeId) : null;
      if (aim) {
        next.set(h.lifeId, aim);
        continue;
      }
      const before = prev.get(h.lifeId);
      const moved = before ? sub(h.pos, before) : { x: 0, y: 0 };
      const old = this.facings.get(h.lifeId);
      if (len(moved) > 1e-6) next.set(h.lifeId, norm(moved));
      else if (old) next.set(h.lifeId, old);
      else next.set(h.lifeId, norm(sub(this.player.pos, h.pos)));
    }
    this.facings = next;
  }

  /**
   * Eligible KOs for the field heals: the growth of the director's round KOs (round-roster rioters, domino victims
   * included, patrols never), measured once per step; a new round starts again from 0.
   */
  private feedFieldHeals(): void {
    const d = this.director;
    if (d.round !== this.healRound) {
      this.healRound = d.round;
      this.healKos = 0;
    }
    const k = d.roundKos(this);
    if (k > this.healKos) this.fieldHeals.count(k - this.healKos);
    this.healKos = k;
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
