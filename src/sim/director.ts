import { CONFIG } from './config';
import { caidLast, fillGroups, roundFill, type FillGroup, type FillState } from './directorFill';
import {
  FLOW_KEEPER_SEC,
  RESCUE_COUNT,
  TARGETS_OF,
  TWO_URGENCIES_FROM,
  casseOpen,
  chooseRescueSite,
  fillReserve,
  pressure,
  roundPlan,
  tableTotal,
  urgentCap,
  type BeatKind,
  type RoundPhase,
  type RoundPlan,
} from './directorPlan';
import { settled, succeeded, urgent, windingDown, type DirectorHost, type Objective, type RoundSummary } from './directorObjectives';
import { RescueIncident, drawRescueKind } from './incidents/rescue';
import { SchoolIncident } from './incidents/school';
import { TargetAttack, lineup } from './incidents/targetAttack';
import { DISTRICT } from './map/district';
import { MonumentIncident, occupierCount } from './monument';
import type { CasseKind, SimEvent, TargetId, Variant } from './types';

export {
  FLOW_KEEPER_SEC,
  RESCUE_COUNT,
  RESCUE_PATH_MAX,
  RESCUE_PATH_MIN,
  SPAWN_MIN_DIST,
  SPAWN_NEAREST,
  THROWER_SHARE,
  TWO_URGENCIES_FROM,
  bruteCount,
  casseOpen,
  chooseRescueSite,
  fillReserve,
  pressure,
  roundPlan,
  shooterCount,
  spawnPoints,
  tableTotal,
  urgentCap,
} from './directorPlan';
export type { DirectorHost, RoundSummary } from './directorObjectives';
export type { BeatKind, MonumentPlan, RoundPhase, RoundPlan, Twist } from './directorPlan';

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];
const EPS = 1e-9;

/**
 * Session sequencing in rounds (manches). Intro 4 s → round 1. A round: plan → RoundStarted → beat 0 at once,
 * each later beat once the previous one is settled and the urgency cap allows; the fill comes in groups (the last
 * one is the climax), group n+1 only once group n is down; the twists fire once at half the roster; the flow keeper
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
  /** The casses of last round's first beat (the draw favours the others). */
  private lastCasses: CasseKind[] = [];
  /** Last round's plan had the monument occupation (the monument and the rescue alternate). */
  private lastMonument = false;
  private readonly counters: Record<BeatKind, number> = {
    school: 0,
    car: 0,
    busStop: 0,
    shop: 0,
    nursery: 0,
    kiosk: 0,
    townHall: 0,
    library: 0,
    booth: 0,
    prison: 0,
    church: 0,
    rescue: 0,
    monument: 0,
  };
  private variantCursor = 0;
  /** Rioters added outside the plan while no round is played (a prison breakout in the breather): the next round's. */
  private extra = 0;
  /** Fill firebombers handed out this round (CONFIG.firebomber.maxPerRound at most). */
  private firebombers = 0;

  /** The round's fill groups in entry order (tests, diagnostics): size, runner pack, climax (the last one). */
  fillPlan(): { id: string; size: number; pack: boolean; climax: boolean }[] {
    return this.fill.map((g) => ({ id: g.id, size: g.reqs.length, pack: g.pack, climax: g.climax }));
  }

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

  /**
   * `n` rioters joining the roster outside the plan (the Caïds of a prison breakout); returns the round to tag them
   * with. While a round is played: its T grows at once (RoundTotalChanged). In the intro or the breather: they belong to
   * the round about to start and count in its T.
   */
  extend(n: number, ev: SimEvent[]): number {
    if (this.phase === 'play') {
      this.total += n;
      ev.push({ type: 'RoundTotalChanged', index: this.round, total: this.total });
      return this.round;
    }
    this.extra += n;
    return this.phase === 'breather' ? this.round + 1 : this.round;
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
    const occ = host.occupations.filter((o) => o.live(host.horde));
    host.occupations.splice(0, host.occupations.length, ...occ);
    // toolboxes at round start as well as at round end (round 1 has some too)
    ev.push(...host.toolboxes.place(DISTRICT.kitSites, host.player.pos));

    const plan = roundPlan(
      this.round,
      host.rand,
      host.targets,
      this.lastCasses,
      { french: host.monument.flag === 'french', lastWasMonument: this.lastMonument },
      (id) => this.free(id, host),
    );
    this.plan = plan;
    this.lastCasses = (plan.beats[0] ?? []).filter((k): k is CasseKind => k !== 'rescue' && k !== 'monument');
    this.lastMonument = plan.beats.some((b) => b.includes('monument'));
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
    // two attacks at once must not eat the fill its special rioters (runner pack, Caïd, brutes, shooters) live in
    if (this.round >= TWO_URGENCIES_FROM) this.total = Math.max(this.total, objective + fillReserve(this.round));
    this.fill = [];
    // no fill to close the round: the Caïd comes alone after the objectives, one more rioter in the roster
    if (this.total === objective && this.round >= CONFIG.caid.fromRound) this.total += 1;
    this.fill = this.roundFill(this.total - objective);
    // rioters already out for this round (a breakout in the breather) join its roster, not its fill
    this.total += this.extra;
    this.extra = 0;
    this.nextFill = 0;
    const headlineRescue = plan.headline === 'rescue' ? this.beats[0]?.find((o) => o.rescue)?.rescue : undefined;
    ev.push(
      headlineRescue
        ? { type: 'RoundStarted', index: this.round, total: this.total, headline: plan.headline, rescueKind: headlineRescue.kind }
        : { type: 'RoundStarted', index: this.round, total: this.total, headline: plan.headline },
    );
    if (this.fill.length > 0) this.queueFill(host, false);
    this.launchBeats(host, ev);
    this.track(host);
  }

  private play(dt: number, host: DirectorHost, ev: SimEvent[]): void {
    this.launchBeats(host, ev);
    this.track(host);
    this.advanceFill(host);
    if (
      !this.twistDone &&
      this.plan &&
      this.plan.twists.length > 0 &&
      this.roundKos(host) >= Math.ceil(CONFIG.round.twistAt * this.total)
    ) {
      this.twistDone = true;
      for (const t of this.plan.twists) {
        if (t === 'weaponDrop') this.weaponDrop(host, ev);
        else this.secondUrgency(host, ev);
      }
    }
    if (this.complete(host)) {
      this.finish(host, ev);
      return;
    }
    // flow keeper (RC-94): nobody on the map and nobody waiting → someone enters at once. Not while every open
    // objective is only winding down (fire dying out, victim thanking Paul): the next beat or the breather is seconds away.
    if (host.horde.active().length > 0 || host.queue.length > 0 || windingDown(this.objectives)) {
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
      // its variant too: a rescue headline names it (« Agression en cours » / « Vol en cours »)
      const rescue = new RescueIncident(`rescue#${++this.counters.rescue}`, drawRescueKind(host.rand));
      return { kind, attack: null, rescue, count, launched: false, dropped: false };
    }
    if (kind === 'monument') {
      const n = ++this.counters.monument;
      const occupation = new MonumentIncident(`monument#${n}`, this.round, occupierCount(n, this.round), host.objectiveSpawner);
      return { kind, attack: null, rescue: null, occupation, count: occupation.total(), launched: false, dropped: false };
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
    return host.targets.standing(id) && !host.targets.get(id).burning && !host.attacks.some((a) => a.target === id && !a.resolved());
  }

  /** Launches every beat whose predecessor is settled, while the urgency cap allows. */
  private launchBeats(host: DirectorHost, ev: SimEvent[]): void {
    while (this.beat < this.beats.length) {
      const items = this.beats[this.beat]!;
      if (this.beat > 0) {
        if (!this.beats[this.beat - 1]!.every((o) => settled(o))) return;
        if (urgent(host) + items.length > urgentCap(this.round)) return;
      }
      for (const o of items) this.launch(o, host, ev);
      this.beat += 1;
    }
  }

  private launch(o: Objective, host: DirectorHost, ev: SimEvent[]): void {
    o.launched = true;
    if (o.occupation) {
      const m = o.occupation;
      if (!m.start(host.monument)) {
        // the flag was swapped meanwhile: the planned occupiers come as fill instead
        o.dropped = true;
        this.fill.push(...this.fillGroups(o.count, `round#${this.round}:${m.id}`));
        this.caidLast();
        return;
      }
      host.occupations.push(m);
      this.objectives.push(o);
      const pos = { ...DISTRICT.monument.mast };
      ev.push({ type: 'MonumentAttacked', incidentId: m.id, pos, round: this.round, total: this.total });
      return;
    }
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
      this.caidLast();
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

  private fillState(): FillState {
    return { round: this.round, fill: this.fill, firebombers: this.firebombers, variant: () => this.variant() };
  }

  /** See fillGroups (directorFill): splits `n` fill rioters into groups, the last one the climax. */
  private fillGroups(n: number, prefix?: string): FillGroup[] {
    const s = this.fillState();
    const out = fillGroups(s, n, prefix);
    this.firebombers = s.firebombers;
    return out;
  }

  /** See roundFill (directorFill): the round's fill, runner pack carved out, then dressed. */
  private roundFill(n: number): FillGroup[] {
    const s = this.fillState();
    const out = roundFill(s, n);
    this.firebombers = s.firebombers;
    return out;
  }

  /** See caidLast (directorFill): the Caïd's role moves to the new last fill slot. */
  private caidLast(): void {
    caidLast(this.fill, this.nextFill);
  }

  private queueFill(host: DirectorHost, now: boolean): void {
    const g = this.fill[this.nextFill++]!;
    const interval = g.climax || g.pack ? CONFIG.round.climaxInterval : CONFIG.round.interval;
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

  /**
   * The second urgency (odd rounds from 3, with the weapon drop): another free target of a kind open this round attacked at once, when the urgency
   * cap allows and one is free (preferably one not attacked yet this round); otherwise nothing more happens.
   */
  private secondUrgency(host: DirectorHost, ev: SimEvent[]): void {
    if (urgent(host) >= urgentCap(this.round)) return;
    const reserved = new Set<TargetId>();
    for (const b of this.beats) for (const o of b) if (o.attack && !o.launched) reserved.add(o.attack.target);
    const open = DISTRICT.targets.filter((t) => casseOpen(t.kind, this.round) && this.free(t.id, host) && !reserved.has(t.id));
    // variety: a target already attacked this round only when no other one is free
    const attacked = new Set(this.objectives.flatMap((o) => (o.attack ? [o.attack.target] : [])));
    const fresh = open.filter((t) => !attacked.has(t.id));
    const free = fresh.length > 0 ? fresh : open;
    if (free.length === 0) return;
    const def = free[Math.floor(host.rand() * free.length) % free.length]!;
    const attack = this.attackOn(def.kind, def.id, host, this.pressure(host.rules.kos));
    const o: Objective = { kind: def.kind, attack, rescue: null, count: attack.total(), launched: false, dropped: false };
    this.total += o.count;
    ev.push({ type: 'TwistStarted', kind: 'secondUrgency', pos: { ...def.door } });
    ev.push({ type: 'RoundTotalChanged', index: this.round, total: this.total });
    this.launch(o, host, ev);
  }

  /**
   * The weapon drop (every round from 2): a bouclier (from CONFIG.bouclier.dropFromRound, CONFIG.bouclier.dropShare of
   * the time), else a regular weapon CONFIG.weapons.twistRegularShare of the time, else nothing (`pos` null; `special`
   * set only for the bouclier).
   */
  private weaponDrop(host: DirectorHost, ev: SimEvent[]): void {
    const { drop: w, special } = host.weapons.dropTwist(host.player.pos, this.round);
    const pos = w ? { ...w.pos } : null;
    ev.push(special ? { type: 'TwistStarted', kind: 'weaponDrop', pos, special } : { type: 'TwistStarted', kind: 'weaponDrop', pos });
    if (w) ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: { ...w.pos } });
  }

  /** Every beat settled, nothing of the round still to queue, queued or standing. */
  private complete(host: DirectorHost): boolean {
    if (this.beat < this.beats.length || this.nextFill < this.fill.length) return false;
    if (!this.objectives.every((o) => settled(o))) return false;
    if (host.queue.pendingForRound(this.round) > 0) return false;
    return !host.horde.list.some((h) => h.round === this.round && h.state !== 'ko');
  }

  private finish(host: DirectorHost, ev: SimEvent[]): void {
    const objectives = this.objectives.map((o) => ({
      kind: o.kind,
      result: succeeded(o) ? ('réussi' as const) : ('perdu' as const),
    }));
    const bonus = objectives.every((o) => o.result === 'réussi');
    if (bonus) host.rules.award(`round#${this.round}:bonus`, CONFIG.round.bonus, host.player.pos);
    ev.push({ type: 'RoundCompleted', index: this.round, bonus });
    host.stations.recharge();
    ev.push({ type: 'StationsRecharged' });
    host.targets.refill();
    ev.push(...host.toolboxes.place(DISTRICT.kitSites, host.player.pos));
    // the breather drop: every CONFIG.weapons.breatherEvery-th round only (even rounds)
    const w = this.round % CONFIG.weapons.breatherEvery === 0 ? host.weapons.dropSpecial(host.player.pos) : null;
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
