import { CONFIG } from './config';
import { THROWER_SHARE, bruteCount, shooterCount } from './directorPlan';
import type { SpawnRequest } from './entry';
import type { Role, Variant } from './types';

/** A group of fill rioters, tagged with its own incident id so the director knows when it is entirely down. */
export interface FillGroup {
  id: string;
  reqs: SpawnRequest[];
  climax: boolean;
  /** A runner pack: it enters in a tight bunch (CONFIG.round.climaxInterval apart). */
  pack: boolean;
  seen: Set<number>;
}

/** What the fill builders read and update on the director: its round, its fill so far, its firebomber tally, its variant cycle. */
export interface FillState {
  readonly round: number;
  readonly fill: FillGroup[];
  firebombers: number;
  readonly variant: () => Variant;
}

/**
 * Splits `n` fill rioters into groups of about groupSize (bigger ones last: the last group is the climax). Roles:
 * rock throwers (THROWER_SHARE, from round 2), and from CONFIG.firebomber.fromRound firebombers: the round's fill
 * slot 4, 12, 20… (1 in `fillEvery`, rounded: at least 1 once the fill has 4) unless that slot throws rocks, then the
 * next contact slot; at most `maxPerRound` per round.
 */
export function fillGroups(s: FillState, n: number, prefix = `round#${s.round}:fill`): FillGroup[] {
  if (n <= 0) return [];
  const groups = Math.ceil(n / CONFIG.round.groupSize);
  const base = Math.floor(n / groups);
  const extra = n - base * groups;
  const share = s.round >= 2 ? THROWER_SHARE : 0;
  // the runner pack is not part of the fill the throwers and firebombers are drawn over
  const first = s.fill.reduce((m, g) => m + (g.pack ? 0 : g.reqs.length), 0);
  const out: FillGroup[] = [];
  const fb = CONFIG.firebomber;
  const fbWanted = s.round >= fb.fromRound ? Math.min(fb.maxPerRound, Math.floor((first + n + fb.fillEvery / 2) / fb.fillEvery)) : 0;
  let owed = 0;
  let i = first;
  for (let g = 0; g < groups; g++) {
    const size = base + (g >= groups - extra ? 1 : 0);
    const reqs: SpawnRequest[] = [];
    for (let k = 0; k < size; k++, i++) {
      // floor((i+1)·s) > floor(i·s) marks exactly floor(n·s) throwers, spread through the fill
      let role: Role = Math.floor((i + 1) * share) > Math.floor(i * share) ? 'thrower' : 'contact';
      if (fbWanted > 0 && i % fb.fillEvery === fb.fillEvery / 2 - 1) owed++;
      if (role === 'contact' && owed > 0 && s.firebombers < fbWanted) {
        role = 'firebomber';
        owed--;
        s.firebombers++;
      }
      reqs.push({ variant: s.variant(), role, round: s.round, incidentId: `${prefix}#${s.fill.length + g + 1}` });
    }
    out.push({ id: reqs[0]!.incidentId!, reqs, climax: false, pack: false, seen: new Set() });
  }
  out[out.length - 1]!.climax = true;
  if (s.fill.length > 0) for (const g of s.fill) g.climax = false;
  return out;
}

/**
 * The round's fill (`n` rioters, the roster never changes). From CONFIG.runner.fromRound a runner pack is carved out
 * first: 4 + (round mod 3) runners (4–6; fewer extra when the rest of the fill would lack room for the Caïd and the
 * brutes; none when the fill has less than 4 + the Caïd), one group of its own, the round's second fill group when
 * the rest makes two groups or more (else the first). The rest is split by fillGroups (throwers and firebombers are
 * drawn over it), then dressed: the Caïd and the brutes (see `dress`).
 */
export function roundFill(s: FillState, n: number): FillGroup[] {
  const [lo, hi] = CONFIG.runner.pack;
  const boss = s.round >= CONFIG.caid.fromRound ? 1 : 0;
  let p = 0;
  if (s.round >= CONFIG.runner.fromRound && n >= lo + boss) {
    const room = boss + bruteCount(s.round);
    p = Math.min(hi, lo + (s.round % (hi - lo + 1)));
    if (n - p < room) p = Math.max(lo, n - room);
  }
  const rest = fillGroups(s, n - p);
  if (p > 0) {
    const reqs: SpawnRequest[] = [];
    for (let k = 0; k < p; k++) reqs.push({ variant: s.variant(), role: 'runner', round: s.round });
    const pack: FillGroup = { id: '', reqs, climax: rest.length === 0, pack: true, seen: new Set() };
    rest.splice(rest.length >= 2 ? 1 : 0, 0, pack);
    // group ids follow the entry order
    rest.forEach((g, i) => {
      g.id = `round#${s.round}:fill#${i + 1}`;
      for (const q of g.reqs) q.incidentId = g.id;
    });
  }
  dress(rest, s.round);
  return rest;
}

/**
 * From CONFIG.caid.fromRound the Caïd is the very last fill rioter; bruteCount brutes take contact slots, one per group
 * from the last group back (never in the pack); then shooterCount shooters take contact slots of the last group (the
 * climax), earlier groups when it has none left. A rock thrower or firebomber on the Caïd's slot trades its role with
 * a contact slot elsewhere, so their counts never change.
 */
export function dress(groups: FillGroup[], round: number): void {
  const last = groups[groups.length - 1];
  if (!last) return;
  if (round >= CONFIG.caid.fromRound) {
    const boss = last.reqs[last.reqs.length - 1]!;
    if (boss.role !== 'contact') {
      const spare = groups.flatMap((g) => g.reqs).find((r) => r.role === 'contact' && r !== boss);
      if (spare) spare.role = boss.role;
    }
    boss.role = 'boss';
  }
  let brutes = bruteCount(round);
  while (brutes > 0) {
    let placed = false;
    for (let gi = groups.length - 1; gi >= 0 && brutes > 0; gi--) {
      const q = groups[gi]!.reqs.find((r) => r.role === 'contact');
      if (!q) continue;
      q.role = 'brute';
      brutes--;
      placed = true;
    }
    if (!placed) break;
  }
  let shooters = shooterCount(round);
  for (let gi = groups.length - 1; gi >= 0 && shooters > 0; gi--)
    for (const q of groups[gi]!.reqs) {
      if (shooters === 0) break;
      if (q.role !== 'contact') continue;
      q.role = 'shooter';
      shooters--;
    }
}

/** Fill groups added later (an objective dropped): the Caïd's role moves to the new last fill slot, so he still closes. */
export function caidLast(fill: FillGroup[], nextFill: number): void {
  const last = fill[fill.length - 1];
  if (!last) return;
  for (let gi = nextFill; gi < fill.length - 1; gi++) {
    const g = fill[gi]!;
    const q = g.reqs.find((r) => r.role === 'boss');
    if (!q) continue;
    const tail = last.reqs[last.reqs.length - 1]!;
    q.role = tail.role;
    tail.role = 'boss';
  }
}
