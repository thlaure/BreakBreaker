import { CONFIG } from './config';
import type { EntryQueue, SpawnRequest, Spawner } from './entry';
import type { Stations } from './healing';
import type { Horde } from './hostiles';
import { RescueIncident } from './incidents/rescue';
import { SchoolIncident } from './incidents/school';
import { TargetAttack, lineup } from './incidents/targetAttack';
import { DISTRICT } from './map/district';
import { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Player } from './player';
import type { Toolboxes } from './repair';
import type { Rules } from './rules';
import type { Targets } from './targets';
import type { CasseKind, Role, SimEvent, TargetId, Variant, Vec } from './types';
import type { Weapons } from './weapons';

export type RoundPhase = 'intro' | 'play' | 'breather';
export type BeatKind = CasseKind | 'rescue';
export type Twist = 'weaponDrop' | 'secondUrgency';

/** What a round brings: its headline, its beats (each beat = incidents started together) and its twist. */
export interface RoundPlan {
  headline: BeatKind;
  beats: BeatKind[][];
  twist: Twist | null;
}

export interface RoundSummary {
  index: number;
  kos: number;
  objectives: { kind: BeatKind; result: 'réussi' | 'perdu' }[];
  /** Score earned during the round, bonus included. */
  points: number;
  bonus: boolean;
}

/** What the director reads and drives on the Sim (kept as an interface to avoid an import cycle). */
export interface DirectorHost {
  readonly player: Player;
  readonly horde: Horde;
  readonly rules: Rules;
  readonly grid: Grid;
  readonly rand: () => number;
  readonly targets: Targets;
  readonly queue: EntryQueue;
  /** Puts objective rioters at the front of the entry queue. */
  readonly objectiveSpawner: Spawner;
  readonly stations: Stations;
  readonly toolboxes: Toolboxes;
  readonly weapons: Weapons;
  /** Every target attack of the session still worth stepping, smouldering ones included (the director prunes resolved ones). */
  readonly attacks: TargetAttack[];
  school: SchoolIncident;
  rescue: RescueIncident | null;
}

export const SPAWN_MIN_DIST = 320;
export const RESCUE_PATH_MIN = 300;
export const RESCUE_PATH_MAX = 900;
/** RC-94 flow keeper: this long with no active hostile and nothing queued → someone enters at once. */
export const FLOW_KEEPER_SEC = 1.5;
/** Share of rock throwers in a round's fill, from round 2 (round 1 teaches the fight first). */
export const THROWER_SHARE = 0.2;
/** Aggressors of every rescue from round 2 (round 1 keeps the random CONFIG.rescue.aggressors range). */
export const RESCUE_COUNT = 3;
const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];
const CASSE_KINDS: CasseKind[] = ['school', 'car', 'busStop'];
const TARGETS_OF: Readonly<Record<CasseKind, TargetId[]>> = { school: ['school'], car: ['car1', 'car2'], busStop: ['busStop'] };
const EPS = 1e-9;

/** Rises one step every 2 rounds and every 30 session KOs, capped. */
export function pressure(round: number, kos: number): number {
  return Math.min(CONFIG.pressureMax, 1 + Math.floor(round / 2) + Math.floor(kos / 30));
}

/** Round roster before objectives: 10, 14, 18, 22, then +4 per round, capped at 40. */
export function tableTotal(round: number): number {
  const t: readonly number[] = CONFIG.round.totals;
  return t[round - 1] ?? Math.min(CONFIG.round.maxTotal, t[t.length - 1]! + CONFIG.round.growth * (round - t.length));
}

/** Urgent incidents allowed at once: 1 in rounds 1–2, then 2. */
export function urgentCap(round: number): number {
  return round < 3 ? 1 : 2;
}

/**
 * The Phase A catalogue. r1: school then rescue. r2: car or bus stop (among intact ones) then rescue, weapon-drop twist.
 * r3+: one intact kind (weight 2, or 1 if it was `last` round's headline) then rescue; twist secondUrgency on odd
 * rounds, weaponDrop on even ones (a mode furie pickup from round CONFIG.furie.dropFromRound). A casse beat with no intact target is dropped (its rioters go to the fill).
 */
export function roundPlan(round: number, rand: () => number, targets: Targets, last: CasseKind | null = null): RoundPlan {
  // a burning target (fire not put out yet) is not attacked again
  const intact = (k: CasseKind): boolean => TARGETS_OF[k].some((id) => targets.standing(id) && !targets.get(id).burning);
  let first: CasseKind | null = null;
  if (round === 1) first = intact('school') ? 'school' : null;
  else {
    const kinds = (round === 2 ? (['car', 'busStop'] as CasseKind[]) : CASSE_KINDS).filter(intact);
    const weights = kinds.map((k) => (round >= 3 && k === last ? 1 : 2));
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < kinds.length && first === null; i++) {
      r -= weights[i]!;
      if (r < 0 || i === kinds.length - 1) first = kinds[i]!;
    }
  }
  const twist: Twist | null = round === 1 ? null : round >= 3 && round % 2 === 1 ? 'secondUrgency' : 'weaponDrop';
  return { headline: first ?? 'rescue', beats: first ? [[first], ['rescue']] : [['rescue']], twist };
}

/** Newcomers enter by the nearest this many eligible edge points (so they arrive closer to Paul). */
export const SPAWN_NEAREST = 3;

/**
 * Edge spawn points >= 320 px from Paul, nearest first, at most the 3 nearest (the entry line cycles over them);
 * if none qualifies, the farthest one.
 */
export function spawnPoints(playerPos: Vec): Vec[] {
  const all = DISTRICT.hostileSpawns;
  const far = all
    .map((p) => ({ p, d: dist(p, playerPos) }))
    .filter((x) => x.d >= SPAWN_MIN_DIST)
    .sort((a, b) => a.d - b.d)
    .slice(0, SPAWN_NEAREST)
    .map((x) => x.p);
  if (far.length > 0) return far;
  let best = all[0]!;
  for (const p of all) if (dist(p, playerPos) > dist(best, playerPos)) best = p;
  return [best];
}

/**
 * Rescue site whose path distance from Paul (BFS steps × tile) is within 300–900 px, chosen with `rand` among
 * qualifying sites; otherwise the closest one above 300 px; otherwise the farthest reachable (or the first).
 */
export function chooseRescueSite(grid: Grid, playerPos: Vec, rand: () => number): Vec {
  const field = new FlowField(grid);
  field.rebuild(playerPos);
  const sites = DISTRICT.rescueSites.map((p) => {
    const steps = field.stepsAt(p);
    return { p, d: steps < 0 ? Infinity : steps * grid.tile };
  });
  const ok = sites.filter((s) => s.d >= RESCUE_PATH_MIN && s.d <= RESCUE_PATH_MAX);
  if (ok.length > 0) return ok[Math.floor(rand() * ok.length) % ok.length]!.p;
  const above = sites.filter((s) => s.d > RESCUE_PATH_MIN && s.d !== Infinity).sort((a, b) => a.d - b.d);
  if (above.length > 0) return above[0]!.p;
  const reachable = sites.filter((s) => s.d !== Infinity).sort((a, b) => b.d - a.d);
  return (reachable[0] ?? sites[0]!).p;
}

/** One incident of a round: prepared at round start (its rioters count in the total), launched by its beat. */
interface Objective {
  kind: BeatKind;
  attack: TargetAttack | null;
  rescue: RescueIncident | null;
  /** Rioters it brings. */
  count: number;
  launched: boolean;
  /** Its target was gone at launch time: its rioters joined the fill instead. */
  dropped: boolean;
}

/** A group of fill rioters, tagged with its own incident id so the director knows when it is entirely down. */
interface FillGroup {
  id: string;
  reqs: SpawnRequest[];
  climax: boolean;
  seen: Set<number>;
}

/**
 * Session sequencing in rounds (manches). Intro 4 s → round 1. A round: plan → RoundStarted → beat 0 at once,
 * each later beat once the previous one is settled and the urgency cap allows; the fill comes in groups (the last
 * one is the climax), group n+1 only once group n is down; the twist fires once at half the roster; the flow keeper
 * lets someone in after 1.5 s with nobody around (RC-94). Round over (all beats settled, nothing of the round queued
 * or standing) → bonus, rewards, 6 s breather with no entry, next round.
 */
export class Director {
  round = 1;
  phase: RoundPhase = 'intro';
  breatherLeft = 0;
  /** Rioters in the current round's roster (0 during the intro). */
  total = 0;
  lastSummary: RoundSummary | null = null;
  plan: RoundPlan | null = null;
  private timer = 0;
  private idle = 0;
  private beats: Objective[][] = [];
  /** Index of the next beat to launch. */
  private beat = 0;
  /** Every launched objective of the round, in launch order (the summary lists them). */
  private objectives: Objective[] = [];
  private fill: FillGroup[] = [];
  /** Index of the next fill group to queue. */
  private nextFill = 0;
  private twistDone = false;
  /** Round-tagged hostiles seen on the map this round (pruned KO bodies stay counted). */
  private readonly roster = new Set<number>();
  private scoreAtStart = 0;
  private lastHeadline: CasseKind | null = null;
  private readonly counters: Record<BeatKind, number> = { school: 0, car: 0, busStop: 0, rescue: 0 };
  private variantCursor = 0;
  /** Fill firebombers handed out this round (CONFIG.firebomber.maxPerRound at most). */
  private firebombers = 0;

  /** Pressure for the current round and session KOs. */
  pressure(kos: number): number {
    return pressure(this.round, kos);
  }

  /**
   * KOs of hostiles tagged with the current round, clamped to [0, total]; patrols never count. A pure read: the roster
   * is fed every director step, so the result never depends on how often it is called.
   */
  roundKos(host: Pick<DirectorHost, 'horde'>): number {
    if (this.phase === 'intro') return 0;
    let alive = 0;
    for (const h of host.horde.list) if (h.round === this.round && h.state !== 'ko' && this.roster.has(h.lifeId)) alive++;
    return Math.min(this.total, Math.max(0, this.roster.size - alive));
  }

  /** Records every round-tagged hostile on the map (called each step, after this step's spawns). */
  private track(host: DirectorHost): void {
    for (const h of host.horde.list) if (h.round === this.round) this.roster.add(h.lifeId);
  }

  step(dt: number, host: DirectorHost): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.phase === 'intro') {
      this.timer += dt;
      if (this.timer >= CONFIG.round.introSec - EPS) this.startRound(host, ev);
    } else if (this.phase === 'breather') {
      this.breatherLeft = Math.max(0, this.breatherLeft - dt);
      if (this.breatherLeft <= EPS) {
        this.round += 1;
        this.startRound(host, ev);
      }
    } else this.play(dt, host, ev);
    return ev;
  }

  private startRound(host: DirectorHost, ev: SimEvent[]): void {
    this.phase = 'play';
    this.breatherLeft = 0;
    this.idle = 0;
    this.beat = 0;
    this.objectives = [];
    this.twistDone = false;
    this.roster.clear();
    this.firebombers = 0;
    this.scoreAtStart = host.rules.score;
    const keep = host.attacks.filter((a) => !a.resolved());
    host.attacks.splice(0, host.attacks.length, ...keep);
    // toolboxes at round start as well as at round end (round 1 has some too)
    ev.push(...host.toolboxes.place(DISTRICT.kitSites, host.player.pos));

    const plan = roundPlan(this.round, host.rand, host.targets, this.lastHeadline);
    this.plan = plan;
    this.lastHeadline = plan.headline === 'rescue' ? null : plan.headline;
    const p = this.pressure(host.rules.kos);
    const reserved = new Set<TargetId>();
    this.beats = plan.beats.map((kinds) =>
      kinds.flatMap((k) => {
        const o = this.prepare(k, host, p, reserved);
        return o ? [o] : [];
      }),
    );
    const objective = this.beats.reduce((n, b) => n + b.reduce((m, o) => m + o.count, 0), 0);
    this.total = Math.max(tableTotal(this.round), objective);
    this.fill = [];
    this.fill = this.fillGroups(this.total - objective);
    this.nextFill = 0;
    ev.push({ type: 'RoundStarted', index: this.round, total: this.total, headline: plan.headline });
    if (this.fill.length > 0) this.queueFill(host, false);
    this.launchBeats(host, ev);
    this.track(host);
  }

  private play(dt: number, host: DirectorHost, ev: SimEvent[]): void {
    this.launchBeats(host, ev);
    this.track(host);
    this.advanceFill(host);
    if (!this.twistDone && this.plan?.twist && this.roundKos(host) >= Math.ceil(CONFIG.round.twistAt * this.total))
      this.twist(this.plan.twist, host, ev);
    if (this.complete(host)) {
      this.finish(host, ev);
      return;
    }
    // flow keeper (RC-94): nobody on the map and nobody waiting → someone enters at once. Not while every open
    // objective is only winding down (fire dying out, victim thanking Paul): the next beat or the breather is seconds away.
    if (host.horde.active().length > 0 || host.queue.length > 0 || this.windingDown()) {
      this.idle = 0;
      return;
    }
    this.idle += dt;
    if (this.idle < FLOW_KEEPER_SEC - EPS) return;
    this.idle = 0;
    if (this.nextFill < this.fill.length) this.queueFill(host, true);
    else host.queue.request([{ variant: this.variant(), role: 'contact' }], { firstDelay: 0 });
  }

  /** The incident behind a beat kind, not started yet; null when no free intact target is left for it. */
  private prepare(kind: BeatKind, host: DirectorHost, p: number, reserved: Set<TargetId>): Objective | null {
    if (kind === 'rescue') {
      const [lo, hi] = CONFIG.rescue.aggressors;
      // round 1 keeps the random 2–4 of slice 1 (drawn here so the round total is known up front)
      const count = this.round === 1 ? lo + Math.floor(host.rand() * (hi - lo + 1)) : RESCUE_COUNT;
      const rescue = new RescueIncident(`rescue#${++this.counters.rescue}`);
      return { kind, attack: null, rescue, count, launched: false, dropped: false };
    }
    const target = TARGETS_OF[kind].find((id) => this.free(id, host) && !reserved.has(id));
    if (!target) return null;
    reserved.add(target);
    const attack = this.attackOn(kind, target, host, p);
    return { kind, attack, rescue: null, count: attack.total(), launched: false, dropped: false };
  }

  private attackOn(kind: CasseKind, target: TargetId, host: DirectorHost, p: number): TargetAttack {
    if (kind === 'school' && this.round === 1 && host.school.stage === 'idle' && this.counters.school === 0) {
      this.counters.school = 1;
      return host.school;
    }
    const id = `${kind}#${++this.counters[kind]}`;
    const comp = lineup(kind, this.round, p);
    if (kind === 'school') return new SchoolIncident(host.targets, host.objectiveSpawner, { id, round: this.round, comp });
    return new TargetAttack({ id, target, comp, round: this.round }, host.targets, host.objectiveSpawner);
  }

  /** Intact, not burning and not under an unresolved attack (at most one live attack per target). */
  private free(id: TargetId, host: DirectorHost): boolean {
    return (
      host.targets.standing(id) &&
      !host.targets.get(id).burning &&
      !host.attacks.some((a) => a.target === id && !a.resolved())
    );
  }

  /** Launches every beat whose predecessor is settled, while the urgency cap allows. */
  private launchBeats(host: DirectorHost, ev: SimEvent[]): void {
    while (this.beat < this.beats.length) {
      const items = this.beats[this.beat]!;
      if (this.beat > 0) {
        if (!this.beats[this.beat - 1]!.every((o) => this.settled(o))) return;
        if (this.urgent(host) + items.length > urgentCap(this.round)) return;
      }
      for (const o of items) this.launch(o, host, ev);
      this.beat += 1;
    }
  }

  private launch(o: Objective, host: DirectorHost, ev: SimEvent[]): void {
    o.launched = true;
    if (o.rescue) {
      const r = o.rescue;
      const site = chooseRescueSite(host.grid, host.player.pos, host.rand);
      r.start(host.horde, site, host.rand, host.player.pos, host.grid, { count: o.count, round: this.round });
      r.wave = this.round;
      // the round total when the rescue starts (a later second urgency does not update its announcement)
      r.shownTotal = this.total;
      host.rescue = r;
      this.objectives.push(o);
      return;
    }
    const a = o.attack!;
    if (!this.free(a.target, host) || !a.start()) {
      // its target fell meanwhile: the planned rioters come as fill instead
      o.dropped = true;
      this.fill.push(...this.fillGroups(o.count, `round#${this.round}:${a.id}`));
      return;
    }
    host.attacks.push(a);
    this.objectives.push(o);
    const door = { ...DISTRICT.targets.find((t) => t.id === a.target)!.door };
    if (a instanceof SchoolIncident) {
      host.school = a;
      ev.push({ type: 'SchoolStarted', incidentId: a.id, pos: door, wave: this.round, total: this.total });
    } else
      ev.push({ type: 'CasseStarted', incidentId: a.id, kind: a.kind, target: a.target, pos: door, round: this.round, total: this.total });
  }

  /** Every launched, unsettled objective is in its timed wind-down with no rioter left (a victim thanking Paul). */
  private windingDown(): boolean {
    let open = 0;
    for (const o of this.objectives) {
      if (this.settled(o)) continue;
      open++;
      if (o.attack || o.rescue!.stage !== 'secured') return false;
    }
    return open > 0;
  }

  /** Over for this round: an attack saved, destroyed or smouldering (its fire outlives the round), a rescue resolved. */
  private settled(o: Objective): boolean {
    if (o.dropped) return true;
    if (o.attack) return o.attack.settled();
    const st = o.rescue!.stage;
    return st === 'completed' || st === 'failed';
  }

  /** A smouldering target still stands: réussi (until it burns down). */
  private succeeded(o: Objective): boolean {
    return o.attack ? o.attack.stage === 'saved' || o.attack.stage === 'smoulder' : o.rescue!.stage === 'completed';
  }

  private urgent(host: DirectorHost): number {
    let n = host.rescue?.stage === 'threat' ? 1 : 0;
    for (const a of host.attacks) if (a.urgent()) n++;
    return n;
  }

  /**
   * Splits `n` fill rioters into groups of about groupSize (bigger ones last: the last group is the climax). Roles:
   * rock throwers (THROWER_SHARE, from round 2), and from CONFIG.firebomber.fromRound firebombers: the round's fill
   * slot 4, 12, 20… (1 in `fillEvery`, rounded: at least 1 once the fill has 4) unless that slot throws rocks, then the
   * next contact slot; at most `maxPerRound` per round.
   */
  private fillGroups(n: number, prefix = `round#${this.round}:fill`): FillGroup[] {
    if (n <= 0) return [];
    const groups = Math.ceil(n / CONFIG.round.groupSize);
    const base = Math.floor(n / groups);
    const extra = n - base * groups;
    const share = this.round >= 2 ? THROWER_SHARE : 0;
    const first = this.fill.reduce((m, g) => m + g.reqs.length, 0);
    const out: FillGroup[] = [];
    const fb = CONFIG.firebomber;
    const fbWanted =
      this.round >= fb.fromRound ? Math.min(fb.maxPerRound, Math.floor((first + n + fb.fillEvery / 2) / fb.fillEvery)) : 0;
    let owed = 0;
    let i = first;
    for (let g = 0; g < groups; g++) {
      const size = base + (g >= groups - extra ? 1 : 0);
      const reqs: SpawnRequest[] = [];
      for (let k = 0; k < size; k++, i++) {
        // floor((i+1)·s) > floor(i·s) marks exactly floor(n·s) throwers, spread through the fill
        let role: Role = Math.floor((i + 1) * share) > Math.floor(i * share) ? 'thrower' : 'contact';
        if (fbWanted > 0 && i % fb.fillEvery === fb.fillEvery / 2 - 1) owed++;
        if (role === 'contact' && owed > 0 && this.firebombers < fbWanted) {
          role = 'firebomber';
          owed--;
          this.firebombers++;
        }
        reqs.push({ variant: this.variant(), role, round: this.round, incidentId: `${prefix}#${this.fill.length + g + 1}` });
      }
      out.push({ id: reqs[0]!.incidentId!, reqs, climax: false, seen: new Set() });
    }
    out[out.length - 1]!.climax = true;
    if (this.fill.length > 0) for (const g of this.fill) g.climax = false;
    return out;
  }

  private queueFill(host: DirectorHost, now: boolean): void {
    const g = this.fill[this.nextFill++]!;
    const interval = g.climax ? CONFIG.round.climaxInterval : CONFIG.round.interval;
    host.queue.request(g.reqs, { interval, firstDelay: now ? 0 : undefined });
  }

  /** Fill group n+1 is queued only once group n has entirely entered and is down. */
  private advanceFill(host: DirectorHost): void {
    if (this.nextFill >= this.fill.length) return;
    const g = this.fill[this.nextFill - 1];
    if (g) {
      let alive = false;
      for (const h of host.horde.list) {
        if (h.incidentId !== g.id) continue;
        g.seen.add(h.lifeId);
        if (h.state !== 'ko') alive = true;
      }
      if (alive || g.seen.size < g.reqs.length) return;
    }
    this.queueFill(host, false);
  }

  private twist(kind: Twist, host: DirectorHost, ev: SimEvent[]): void {
    this.twistDone = true;
    if (kind === 'secondUrgency' && this.urgent(host) < urgentCap(this.round)) {
      const reserved = new Set<TargetId>();
      for (const b of this.beats) for (const o of b) if (o.attack && !o.launched) reserved.add(o.attack.target);
      const open = DISTRICT.targets.filter((t) => this.free(t.id, host) && !reserved.has(t.id));
      // variety: a target already attacked this round only when no other one is free
      const attacked = new Set(this.objectives.flatMap((o) => (o.attack ? [o.attack.target] : [])));
      const fresh = open.filter((t) => !attacked.has(t.id));
      const free = fresh.length > 0 ? fresh : open;
      if (free.length > 0) {
        const def = free[Math.floor(host.rand() * free.length) % free.length]!;
        const attack = this.attackOn(def.kind, def.id, host, this.pressure(host.rules.kos));
        const o: Objective = { kind: def.kind, attack, rescue: null, count: attack.total(), launched: false, dropped: false };
        this.total += o.count;
        ev.push({ type: 'TwistStarted', kind, pos: { ...def.door } });
        ev.push({ type: 'RoundTotalChanged', index: this.round, total: this.total });
        this.launch(o, host, ev);
        return;
      }
    }
    // weapon drop (also the fallback when no second urgency fits); a mode furie pickup from round dropFromRound
    const furie = this.round >= CONFIG.furie.dropFromRound;
    const w = host.weapons.dropSpecial(host.player.pos, furie ? 'furie' : undefined);
    const pos = w ? { ...w.pos } : null;
    ev.push(furie ? { type: 'TwistStarted', kind: 'weaponDrop', pos, furie: true } : { type: 'TwistStarted', kind: 'weaponDrop', pos });
    if (w) ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: { ...w.pos } });
  }

  /** Every beat settled, nothing of the round still to queue, queued or standing. */
  private complete(host: DirectorHost): boolean {
    if (this.beat < this.beats.length || this.nextFill < this.fill.length) return false;
    if (!this.objectives.every((o) => this.settled(o))) return false;
    if (host.queue.pendingForRound(this.round) > 0) return false;
    return !host.horde.list.some((h) => h.round === this.round && h.state !== 'ko');
  }

  private finish(host: DirectorHost, ev: SimEvent[]): void {
    const objectives = this.objectives.map((o) => ({
      kind: o.kind,
      result: this.succeeded(o) ? ('réussi' as const) : ('perdu' as const),
    }));
    const bonus = objectives.every((o) => o.result === 'réussi');
    if (bonus) host.rules.award(`round#${this.round}:bonus`, CONFIG.round.bonus);
    ev.push({ type: 'RoundCompleted', index: this.round, bonus });
    host.stations.recharge();
    ev.push({ type: 'StationsRecharged' });
    host.targets.refill();
    ev.push(...host.toolboxes.place(DISTRICT.kitSites, host.player.pos));
    const w = host.weapons.dropSpecial(host.player.pos);
    if (w) ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: { ...w.pos } });
    this.lastSummary = {
      index: this.round,
      kos: this.roundKos(host),
      objectives,
      points: host.rules.score - this.scoreAtStart,
      bonus,
    };
    // the breather is a real rest: patrols still waiting never enter, those on the map leave
    host.queue.clear();
    host.horde.dismiss((h) => h.round === null);
    this.phase = 'breather';
    this.breatherLeft = CONFIG.round.breatherSec;
  }

  private variant(): Variant {
    return VARIANTS[this.variantCursor++ % VARIANTS.length]!;
  }
}
