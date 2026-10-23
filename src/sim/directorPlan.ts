import { CONFIG } from './config';
import { DISTRICT } from './map/district';
import { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Targets } from './targets';
import type { CasseKind, TargetId, Vec } from './types';

export type RoundPhase = 'intro' | 'play' | 'breather';
export type BeatKind = CasseKind | 'rescue' | 'monument';
export type Twist = 'weaponDrop' | 'secondUrgency';

/**
 * What a round brings: its headline, its beats (each beat = incidents started together) and its twists, fired together
 * at half the roster in this order (none in round 1; a weapon drop from round 2; plus a second urgency on odd rounds
 * from round 3).
 */
export interface RoundPlan {
  headline: BeatKind;
  beats: BeatKind[][];
  twists: Twist[];
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
const CASSE_KINDS: CasseKind[] = [
  'school',
  'car',
  'busStop',
  'shop',
  'nursery',
  'kiosk',
  'townHall',
  'library',
  'booth',
  'prison',
  'church',
];
export const TARGETS_OF: Readonly<Record<CasseKind, TargetId[]>> = {
  school: ['school'],
  car: ['car1', 'car2'],
  busStop: ['busStop'],
  shop: ['shop'],
  nursery: ['nursery'],
  kiosk: ['kiosk'],
  townHall: ['townHall'],
  library: ['library'],
  booth: ['boothRed', 'boothBlue'],
  prison: ['prison'],
  church: ['church'],
};

/** A kind of casse can be attacked in `round` (CONFIG.casse.fromRound: the phone booths and the church from 3, the prison from 4, the nursery and the kiosk from 5, the town hall from 7, the library from 9). */
export function casseOpen(kind: CasseKind, round: number): boolean {
  return round >= CONFIG.casse.fromRound[kind];
}

/** Brutes in a round's fill (CONFIG.brute.counts): none before round 4, 1, 2 from round 6, 3 from round 8. */
export function bruteCount(round: number): number {
  let n = 0;
  for (const [from, count] of CONFIG.brute.counts) if (round >= from) n = count;
  return n;
}

/** Shooters in a round's fill (CONFIG.shooter.counts): none before round 6, 1 in rounds 6–7, 2 in rounds 8–9, 3 from round 10, ≤ maxPerRound. */
export function shooterCount(round: number): number {
  let n = 0;
  for (const [from, count] of CONFIG.shooter.counts) if (round >= from) n = count;
  return Math.min(CONFIG.shooter.maxPerRound, n);
}

/** Rises one step every 2 rounds and every 30 session KOs, capped. */
export function pressure(round: number, kos: number): number {
  return Math.min(CONFIG.pressureMax, 1 + Math.floor(round / 2) + Math.floor(kos / 30));
}

/** Round roster before objectives: 10, 14, 18, 22, then +4 per round, capped at 40. */
export function tableTotal(round: number): number {
  const t: readonly number[] = CONFIG.round.totals;
  return t[round - 1] ?? Math.min(CONFIG.round.maxTotal, t[t.length - 1]! + CONFIG.round.growth * (round - t.length));
}

/**
 * Fill rioters a round keeps at least from TWO_URGENCIES_FROM (when two attacks would leave less, the roster grows,
 * past CONFIG.round.maxTotal if need be, like an objective-heavy roster): the round's runner pack (as roundFill sizes it) plus the smallest rest whose contact slots
 * (after the rock throwers and firebombers fillGroups hands out) hold the Caïd, the brutes and the shooters.
 */
export function fillReserve(round: number): number {
  const [lo, hi] = CONFIG.runner.pack;
  const pack = round >= CONFIG.runner.fromRound ? Math.min(hi, lo + (round % (hi - lo + 1))) : 0;
  const need = (round >= CONFIG.caid.fromRound ? 1 : 0) + bruteCount(round) + shooterCount(round);
  const share = round >= 2 ? THROWER_SHARE : 0;
  const fb = CONFIG.firebomber;
  for (let n = need; ; n++) {
    const firebombers = round >= fb.fromRound ? Math.min(fb.maxPerRound, Math.floor((n + fb.fillEvery / 2) / fb.fillEvery)) : 0;
    if (n - Math.floor(n * share) - firebombers >= need) return pack + n;
  }
}

/** Urgent incidents allowed at once: 1 in rounds 1–2, then 2. */
export function urgentCap(round: number): number {
  return round < 3 ? 1 : 2;
}

/** What the monument allows when a round is planned: its flag, and whether last round's second beat was the monument. */
export interface MonumentPlan {
  french: boolean;
  lastWasMonument: boolean;
}

/** From this round, two places are attacked at once from the round start (the first beat holds two casses). */
export const TWO_URGENCIES_FROM = 5;

/**
 * The round catalogue. r1: the school (tutorial: first Molotov, cinematic, reinforcements) then rescue. From r2 the
 * headline casse is a seeded random draw among every kind open this round (casseOpen: school, shop, car, bus stop from
 * r2, the phone booths and the church from r3, nursery and kiosk from r5, town hall from r7, library from r9) with a free target (standing, not burning), weight
 * 2, or 1 if it was in `last` round's first beat (it may repeat, rarely; nothing is forced). From round
 * TWO_URGENCIES_FROM the first beat holds two casses on distinct targets, started together: the kinds opening this very
 * round first (round 5 nursery then kiosk, round 7 the town hall, round 9 the library), then the same weighted draw
 * (another kind when one has a free target, else a second target of the same kind: the two cars); a single free target
 * → a single casse. Second beat: the rescue; from round CONFIG.monument.fromRound the monument occupation instead when
 * the flag is French and last round's second beat was not the monument (they alternate; never while the flag is
 * Palestinian). Twists: from round 2 always a weapon drop (from round 3 a bouclier half the time; otherwise a regular
 * weapon one time in two, else nothing; never a bouclier in round 2), and on odd rounds from r3 a second urgency as
 * well (when the urgency cap allows: never a third while two run). No free target → the second beat alone (its kind is
 * the headline).
 */
export function roundPlan(
  round: number,
  rand: () => number,
  targets: Targets,
  last: CasseKind | readonly CasseKind[] | null = null,
  monument: MonumentPlan | null = null,
  isFree: (id: TargetId) => boolean = (id) => targets.standing(id) && !targets.get(id).burning,
): RoundPlan {
  const lastKinds: readonly CasseKind[] =
    last === null ? [] : typeof last === 'string' ? [last as CasseKind] : (last as readonly CasseKind[]);
  // a kind is drawn only with a free target (the director's free(): standing, not burning, no unresolved attack)
  const freeTargets = (k: CasseKind): number => TARGETS_OF[k].filter(isFree).length;
  const picks: CasseKind[] = [];
  if (round === 1) {
    if (freeTargets('school') > 0) picks.push('school');
  } else {
    const want = round >= TWO_URGENCIES_FROM ? 2 : 1;
    for (let n = 0; n < want; n++) {
      const room = (k: CasseKind): boolean => casseOpen(k, round) && freeTargets(k) > picks.filter((p) => p === k).length;
      let kinds = CASSE_KINDS.filter((k) => room(k) && !picks.includes(k));
      if (kinds.length === 0) kinds = CASSE_KINDS.filter(room);
      if (kinds.length === 0) break;
      const fresh = want > 1 ? kinds.find((k) => CONFIG.casse.fromRound[k] === round) : undefined;
      if (fresh) {
        picks.push(fresh);
        continue;
      }
      const weights = kinds.map((k) => (lastKinds.includes(k) ? 1 : 2));
      let r = rand() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < kinds.length; i++) {
        r -= weights[i]!;
        if (r < 0 || i === kinds.length - 1) {
          picks.push(kinds[i]!);
          break;
        }
      }
    }
  }
  const twists: Twist[] = round === 1 ? [] : round >= 3 && round % 2 === 1 ? ['weaponDrop', 'secondUrgency'] : ['weaponDrop'];
  const second: BeatKind =
    monument && round >= CONFIG.monument.fromRound && monument.french && !monument.lastWasMonument ? 'monument' : 'rescue';
  return { headline: picks[0] ?? second, beats: picks.length > 0 ? [picks, [second]] : [[second]], twists };
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
