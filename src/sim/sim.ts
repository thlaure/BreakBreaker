import { agirAtBooth, syncServices } from './agir';
import { Allies } from './allies';
import { Bullets } from './bullets';
import { CONFIG } from './config';
import { Director, spawnPoints } from './director';
import { Energy } from './energy';
import { EntryQueue, type Spawner } from './entry';
import { FieldHeals } from './fieldHeals';
import { FirePatches } from './firepatch';
import { Stations, type StationMessage } from './healing';
import { Hits, scoreEvents, tally } from './hits';
import { Horde, type HordeCtx } from './hostiles';
import type { RescueIncident } from './incidents/rescue';
import { SchoolIncident } from './incidents/school';
import type { TargetAttack } from './incidents/targetAttack';
import { moveCircle } from './map/collide';
import { DISTRICT, type Rect } from './map/district';
import { FlowField } from './map/flowfield';
import { Grid } from './map/grid';
import { len, norm, sub, v } from './math';
import { Monument, MonumentIncident } from './monument';
import { createPlayer, damagePlayer, stepPlayer, type Player } from './player';
import { PlayerCombat } from './playerCombat';
import { Rocks, type RockCtx } from './projectiles';
import { Prison } from './prison';
import { rng } from './rng';
import { Toolboxes, type ToolboxMessage } from './repair';
import { Rules } from './rules';
import { Services } from './services';
import { buildSnapshot, type Snapshot, type Telegraph } from './snapshot';
import { Targets } from './targets';
import type { InputFrame, SimEvent, TargetId, Vec } from './types';
import { Weapons } from './weapons';

export type { ActionHint, ActionHintKind } from './agir';
export type { Snapshot, Telegraph } from './snapshot';

/** How long a thrown bottle is drawn in flight (render only; the fire starts on the throw). */
export const MOLOTOV_FLIGHT_SEC = 0.6;

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
  const hit = clip(-dx, a.x - r.x) && clip(dx, r.x + r.w - a.x) && clip(-dy, a.y - r.y) && clip(dy, r.y + r.h - a.y);
  return hit ? t0 : null;
}

/** t in [0,1] at which segment a→b first enters any peaceful group's area, or null. */
export function groupsEntry(a: Vec, b: Vec): number | null {
  let first: number | null = null;
  for (const g of DISTRICT.peacefulGroups) {
    const t = segmentRectEntry(a, b, g.area);
    if (t !== null && (first === null || t < first)) first = t;
  }
  return first;
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
  /** Hit and KO resolution (draws from the launch and fall streams, the Caïds already rewarded). */
  private readonly hits: Hits;
  /** Paul's strike, bouclier, mode furie and onde d'énergie. */
  private readonly combat: PlayerCombat;
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
  private molotovs: Telegraph[] = [];
  private facings = new Map<number, Vec>();
  private stationMessage: StationMessage = null;
  private toolboxMessage: ToolboxMessage = null;
  private koReported = false;
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
    // read through the fields on every draw (a test may swap a stream after construction)
    this.hits = new Hits(
      this,
      () => this.launchRand(),
      () => this.fallRand(),
    );
    this.combat = new PlayerCombat(this, this.hits);
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
      tally(this.rules, ev);
      scoreEvents(this.rules, this.player.pos, ev);
      return ev;
    }
    this.now += dt;
    const now = this.now;
    const p = this.player;
    const combat = this.combat;

    if (input.furie) combat.activateFurie(ev);
    const furie = this.weapons.furie();
    // charging the onde d'énergie: movement ignored (aim still turns Paul)
    const frozen = combat.charge !== null;
    stepPlayer(p, frozen ? { ...input, move: { x: 0, y: 0 } } : input, dt, now, this.grid, furie ? CONFIG.furie.speedMul : 1);
    // no swing on the step a charge starts, while it grows, or the step it fires
    if (frozen) combat.stepCharge(dt, ev);
    else if (chargePressed) combat.startCharge(ev);
    const mode = combat.strikeMode(furie);
    if (!frozen && combat.charge === null && input.strike && mode === 'shot') combat.fireFlashball(input, now, ev);
    else if (!frozen && combat.charge === null && input.strike && mode === 'punch') combat.punch(now, ev);
    else if (!frozen && combat.charge === null && input.strike) combat.swing(furie, now, ev);
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
    syncServices(this);
    this.updateFacings(prev);
    for (const h of this.queue.step(dt, this.horde, spawnPoints(p.pos))) {
      if (h.role === 'boss') ev.push({ type: 'CaidArrived', lifeId: h.lifeId, pos: v(h.pos), round: h.round ?? this.director.round });
      else if (h.role === 'shooter' && !combat.flashballGiven) combat.giveFlashball(ev);
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
        const damage = this.hits.damageTo(e.targetLifeId, 'rock', e.damage);
        ev.push({ ...e, damage });
        this.rules.stats.rocksHit += 1;
        this.hits.hit(e.targetLifeId, damage, ev, 'rock');
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
      const tough = this.hits.tough(s.lifeId);
      const damage = this.hits.damageTo(s.lifeId, 'weapon');
      ev.push(
        tough
          ? { type: 'HitConfirmed', targetLifeId: s.lifeId, damage, source: 'flashball', heavy: true }
          : { type: 'HitConfirmed', targetLifeId: s.lifeId, damage, source: 'flashball' },
      );
      this.hits.hit(s.lifeId, damage, ev, 'flashball');
    }
    // ground fire: Paul only, through the same damage path (invulnerability frames, mode furie)
    ev.push(
      ...this.firePatches.step(
        now,
        this.grid,
        p.pos,
        (amount) => {
          const a = this.weapons.furie() ? amount * CONFIG.furie.damageTakenMul : amount;
          if (this.invulnerable || !damagePlayer(p, a, now)) return false;
          ev.push({ type: 'PlayerDamaged', amount: a });
          return true;
        },
        this.combat.shield(),
      ),
    );
    // a KO cancels the charge (nothing used); damage alone no longer does
    if (combat.charge !== null && p.ko) combat.cancelCharge(ev);
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
      scoreEvents(this.rules, this.player.pos, ev);
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
    const kitAct = actPressed && agirAtBooth(this, ev) === null;
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
        strike: (lifeId, from, role) => this.hits.policeStrike(lifeId, from, ev, role === 'guard' ? 'hands' : 'weapon'),
      }),
    );
    syncServices(this);
    // the prison fell this step (by any path): every jailed Caïd out at its door, in the roster
    ev.push(...this.prison.step({ targets: this.targets, horde: this.horde, dt, extend: (n, e) => this.director.extend(n, e) }));
    const heal = this.stations.step({ player: p, rules: this.rules });
    ev.push(...heal.events);
    this.stationMessage = heal.message;
    ev.push(...this.weapons.step(dt, now, p, this.director.round));
    // a Caïd knocked out by any path (rocks, the beam, a test's direct hit) gets his bonus and drop before the round closes
    for (const h of this.horde.list) if (h.role === 'boss' && h.state === 'ko') this.hits.caidDown(h, ev);

    const dirEv = this.director.step(dt, this);
    ev.push(...dirEv);
    // the round is over: the prison's guards come back (while it stands) with the coming round's hp
    if (dirEv.some((e) => e.type === 'RoundCompleted')) ev.push(...this.prison.onBreather(this.director.round, this.targets));
    this.feedFieldHeals();
    ev.push(...this.fieldHeals.step(now, { player: p, rules: this.rules }));
    tally(this.rules, ev);
    scoreEvents(this.rules, this.player.pos, ev);
    return ev;
  }

  snapshot(): Snapshot {
    return buildSnapshot(this, {
      facings: this.facings,
      telegraphs: this.telegraphs,
      aims: this.aims,
      molotovs: this.molotovs,
      toolboxMessage: this.toolboxMessage,
      stationMessage: this.stationMessage,
      charge: this.combat.charge,
      lastOccupation: this.lastOccupation,
    });
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
    const p = this.player;
    return {
      player: {
        pos: p.pos,
        r: CONFIG.player.radius,
        invulnerable: this.invulnerable || p.ko || this.now < p.invulnUntil,
        shield: this.combat.shield(),
      },
      hostiles: this.horde.views(),
      groupBlocks: groupsEntry,
      victimPos,
    };
  }

  private bulletCtx(victimPos: Vec | null) {
    const p = this.player;
    return {
      player: {
        pos: p.pos,
        r: CONFIG.player.radius,
        invulnerable: this.invulnerable || p.ko || this.now < p.invulnUntil,
        shield: this.combat.shield(),
      },
      hostiles: this.horde.views(),
      groupBlocks: groupsEntry,
      victimPos,
    };
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
}
