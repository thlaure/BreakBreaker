import { CONFIG } from './config';
import { pickFall, type FallSource } from './falls';
import { damageOn, isTough, KO_DAMAGE, type DamageSource, type Hostile } from './hostiles';
import { dist, len, norm, sub, v } from './math';
import type { Rules } from './rules';
import type { Sim } from './sim';
import type { Launch, SimEvent, Vec } from './types';

/** Hit and KO resolution on rioters: damage by role, KO scoring and energy, falls, launches, dominoes, the Caïd's reward. */
export class Hits {
  /** Caïds whose KO was already rewarded (bonus + weapon drop). */
  private readonly caidsDown = new Set<number>();

  constructor(
    private readonly sim: Sim,
    /** The Sim's launch stream (cosmetic furie, gant and beam launches). */
    private readonly launchRand: () => number,
    /** The Sim's fall stream (3 draws per KO). */
    private readonly fallRand: () => number,
  ) {}

  /**
   * An officer's baton blow from `from`: a weapon hit (KO but for a brute or the Caïd, damageOn; a prison guard's is a
   * bare-hands hit, `source` 'hands', so guards alone do not make the prison untouchable), the KO scored +1 by
   * Rules like any (a Caïd's bonus too), falling away from the officer; it never fills the energy gauge.
   */
  policeStrike(lifeId: number, from: Vec, ev: SimEvent[], source: DamageSource = 'weapon'): void {
    const h = this.sim.horde.list.find((x) => x.lifeId === lifeId);
    if (!h || h.state === 'ko') return;
    const away = sub(h.pos, from);
    this.hit(lifeId, this.damageTo(lifeId, source), ev, 'baton', undefined, len(away) > 1e-6 ? norm(away) : undefined, false);
  }

  /**
   * Every 'ko' from applyHit scores +1 (deduped by Rules) and emits ActorKnockedOut with its fall (pickFall by `source`,
   * along the launch, else `dir`, else away from Paul). Mode furie, the gant and the beam (`along` = its direction) add
   * the cosmetic launch payload. A KO Rules counts fills the energy gauge, except in mode furie and for the beam's KOs
   * (no chain refills). A WTF 'domino' then knocks its neighbours down (dominoVictims) through this same path, as
   * 'knocked' (which never chains); none: 'faceplant'. True on a KO.
   */
  hit(lifeId: number, dmg: number, ev: SimEvent[], source: FallSource, along?: Vec, dir?: Vec, energy = true): boolean {
    const sim = this.sim;
    if (sim.horde.applyHit(lifeId, dmg) !== 'ko') return false;
    const h = sim.horde.list.find((x) => x.lifeId === lifeId);
    const counted = sim.rules.onKnockout(lifeId, h?.pos);
    if (counted && h && energy && !sim.weapons.furie() && source !== 'beam') ev.push(...sim.energy.gain(h.role));
    if (h?.role === 'boss') this.caidDown(h, ev);
    const launched = source === 'furie' || source === 'gant' || source === 'beam';
    const launch = h && launched ? this.launch(h.pos, along, source === 'gant') : undefined;
    const away = h ? sub(h.pos, sim.player.pos) : { x: 0, y: 0 };
    const fallDir = launch?.dir ?? dir ?? (len(away) > 1e-6 ? norm(away) : norm(sim.player.facing));
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
    for (const h of this.sim.horde.list) {
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
    const away = sub(at, this.sim.player.pos);
    const base = along ?? (len(away) > 1e-6 ? norm(away) : this.sim.player.facing);
    const a = Math.atan2(base.y, base.x) + jitter;
    return { dir: { x: Math.cos(a), y: Math.sin(a) }, power, spin: sign * turns, kind: along ? 'satellite' : 'tumble' };
  }

  /** Damage rioter `lifeId` takes from `source` (damageOn by its role; `fallback` when it is gone). */
  damageTo(lifeId: number, source: DamageSource, fallback = KO_DAMAGE): number {
    const h = this.sim.horde.list.find((x) => x.lifeId === lifeId);
    return h ? damageOn(h.role, source) : fallback;
  }

  /** A brute or the Caïd (heavier hits, CONFIG.toughWeaponDamage from a held weapon). */
  tough(lifeId: number): boolean {
    const h = this.sim.horde.list.find((x) => x.lifeId === lifeId);
    return h !== undefined && isTough(h.role);
  }

  /**
   * « Le Caïd » KO'd (once per life): +CONFIG.caid.bonus with the occurrence key `caid#<round>` at his position (the
   * KO's +1 is scored as for anyone), and CONFIG.caid.dropShare of the time a regular weapon dropped where he fell
   * (WeaponSpawned, no indicator; none while a weapon lies within CONFIG.weapons.clearRadius px of Paul); jailed while
   * the prison stands (CaidJailed).
   */
  caidDown(h: Hostile, ev: SimEvent[]): void {
    const sim = this.sim;
    if (this.caidsDown.has(h.lifeId)) return;
    this.caidsDown.add(h.lifeId);
    sim.rules.award(`caid#${h.round ?? sim.director.round}`, CONFIG.caid.bonus, h.pos);
    const w = sim.weapons.dropAt(h.pos, sim.player.pos);
    if (w) ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: v(w.pos) });
    // the jail van takes him to the prison, while it stands
    ev.push(...sim.prison.jail(h, sim.targets, sim.director.round));
  }
}

/** One ScoreChanged per score change applied since the last step, where it happened (else at Paul). */
export function scoreEvents(rules: Rules, paul: Vec, ev: SimEvent[]): void {
  for (const e of rules.drain()) ev.push({ type: 'ScoreChanged', points: e.points, pos: e.at ?? v(paul) });
}

/** Incident outcomes feed the session stats (Rules does not track them itself). */
export function tally(rules: Rules, ev: SimEvent[]): void {
  const s = rules.stats;
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
