import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Player } from './player';
import type { HeldKind, PickupKind, SimEvent, SpecialKind, Vec, WeaponKind } from './types';

export type { HeldKind, PickupKind, SpecialKind, WeaponKind } from './types';

/** How a weapon strikes: a swing all around Paul, a straight punch (gant), an aimed shot (flashball). */
export type StrikeMode = 'swing' | 'punch' | 'shot';

/**
 * Regular weapons found in the street. Every one KOs a rioter in one hit (CONFIG.toughWeaponDamage on a brute or the
 * Caïd); reach, strikes and how they strike differ. `range`: the swing's reach, the punch's length, the shot's assist
 * range. `fromRound`: first round of the street pool it joins.
 */
export const WEAPONS: Readonly<Record<WeaponKind, { label: string; range: number; uses: number; strike: StrikeMode; fromRound: number }>> = {
  baton: { label: 'Bâton', range: 72, uses: 15, strike: 'swing', fromRound: 1 },
  marteau: { label: 'Marteau', range: 64, uses: 8, strike: 'swing', fromRound: 1 },
  panneau: { label: 'Panneau', range: 96, uses: 10, strike: 'swing', fromRound: 1 },
  gant: { label: 'Gant de boxe', range: CONFIG.gant.reach, uses: 6, strike: 'punch', fromRound: CONFIG.gant.fromRound },
  flashball: { label: 'Flashball', range: CONFIG.flashball.assistRange, uses: 6, strike: 'shot', fromRound: CONFIG.flashball.fromRound },
};
const ALL_KINDS = Object.keys(WEAPONS) as WeaponKind[];
/** The swung weapons of the start (the drops: twist, round end, the Caïd's). */
const KINDS = ALL_KINDS.filter((k) => WEAPONS[k].fromRound <= 1);

/** Regular weapons of the timed street spawns at `round` (the gant from round 3, the flashball from round 5). */
export function streetKinds(round: number): WeaponKind[] {
  return ALL_KINDS.filter((k) => round >= WEAPONS[k].fromRound);
}

/** Player-facing names of everything Paul can hold. */
export const HELD_LABELS: Readonly<Record<HeldKind, string>> = {
  baton: WEAPONS.baton.label,
  marteau: WEAPONS.marteau.label,
  panneau: WEAPONS.panneau.label,
  gant: WEAPONS.gant.label,
  flashball: WEAPONS.flashball.label,
  bouclier: 'Bouclier',
};

/** The special pickups (only the bouclier: the mode furie and the onde d’énergie come from the energy gauge). */
export const SPECIALS: readonly SpecialKind[] = ['bouclier'];

export function isSpecial(kind: PickupKind): kind is SpecialKind {
  return kind === 'bouclier';
}

/** Specials a timed street spawn can be (CONFIG.<kind>.spawnFromRound), each with weight CONFIG.<kind>.spawnShare. */
export function spawnSpecials(round: number): SpecialKind[] {
  return SPECIALS.filter((k) => round >= CONFIG[k].spawnFromRound);
}

export interface GroundWeapon {
  id: number;
  kind: PickupKind;
  pos: Vec;
  /** Sim time at which an unclaimed special drop vanishes; null for the timed street spawns. */
  expiresAt: number | null;
}

/** `uses` = strikes left (regular weapons); 0 for the bouclier, which has `secondsLeft` instead. */
export interface HeldWeapon {
  kind: HeldKind;
  uses: number;
  secondsLeft?: number;
}

/** A freshly picked held weapon of `kind`. */
export function heldOf(kind: HeldKind): HeldWeapon {
  if (kind === 'bouclier') return { kind, uses: 0, secondsLeft: CONFIG.bouclier.durationSec };
  return { kind, uses: WEAPONS[kind].uses };
}

/**
 * Random weapon pickups. A weapon appears every CONFIG.weapons.spawnEvery seconds (random within the range) on a
 * free spot away from Paul, up to maxGround at once. Walking over one takes it (replacing the current weapon).
 * A strike that hits at least one rioter uses one strike; at 0 the weapon breaks and Paul fights bare-handed.
 * The mode furie (`startFurie`, from the energy gauge) does not touch the weapon: it lasts CONFIG.furie.durationSec;
 * the timer runs with the sim steps (frozen while paused) and `endFurie` cuts it short (Paul KO).
 * The bouclier is held like a weapon and breaks after CONFIG.bouclier.durationSec of steps.
 */
export class Weapons {
  ground: GroundWeapon[] = [];
  held: HeldWeapon | null = null;
  /** Seconds of mode furie left (0 = off). */
  furieLeft = 0;
  private nextSpawnAt: number;
  private nextId = 1;
  /** Sim time of the last step (special drops are stamped with it). */
  private now = 0;

  constructor(
    private readonly grid: Grid,
    private readonly rand: () => number,
  ) {
    this.nextSpawnAt = CONFIG.weapons.firstSpawn;
  }

  /** The mode furie is on. */
  furie(): boolean {
    return this.furieLeft > 0;
  }

  /**
   * Reach of Paul's strike with the current weapon (bare hands otherwise; the bouclier's bash), ×CONFIG.furie.reachMul
   * in furie.
   */
  range(): number {
    const k = this.held?.kind;
    // the gant and the flashball do not swing: in mode furie they strike like bare hands (×reachMul)
    const base =
      k === undefined ? CONFIG.melee.range : k === 'bouclier' ? CONFIG.bouclier.bashRange : WEAPONS[k].strike === 'swing' ? WEAPONS[k].range : CONFIG.melee.range;
    return this.furie() ? base * CONFIG.furie.reachMul : base;
  }

  /** Starts the mode furie for CONFIG.furie.durationSec (FurieStarted). */
  startFurie(): SimEvent[] {
    this.furieLeft = CONFIG.furie.durationSec;
    return [{ type: 'FurieStarted', secondsLeft: this.furieLeft }];
  }

  /** Ends the mode furie at once (Paul KO); FurieEnded when it was on. */
  endFurie(): SimEvent[] {
    if (!this.furie()) return [];
    this.furieLeft = 0;
    return [{ type: 'FurieEnded' }];
  }

  /** `round` gates the bouclier among the timed spawns (CONFIG.bouclier.spawnFromRound). */
  step(dt: number, now: number, player: Player, round = 1): SimEvent[] {
    this.now = now;
    const ev: SimEvent[] = [];
    if (this.furieLeft > 0) {
      this.furieLeft = Math.max(0, this.furieLeft - dt);
      if (this.furieLeft <= 1e-9) {
        this.furieLeft = 0;
        ev.push({ type: 'FurieEnded' });
      }
    }
    const h = this.held;
    if (h?.kind === 'bouclier' && h.secondsLeft !== undefined) {
      h.secondsLeft = Math.max(0, h.secondsLeft - dt);
      if (h.secondsLeft <= 1e-9) {
        this.held = null;
        ev.push({ type: 'WeaponBroken', kind: 'bouclier' });
      }
    }
    this.ground = this.ground.filter((g) => g.expiresAt === null || now < g.expiresAt);
    const taken = this.ground.find((g) => dist(g.pos, player.pos) <= CONFIG.weapons.pickupRadius);
    if (taken && !player.ko) {
      this.ground = this.ground.filter((g) => g !== taken);
      this.held = heldOf(taken.kind);
      ev.push({ type: 'WeaponPickedUp', kind: taken.kind });
    }
    if (now >= this.nextSpawnAt) {
      const [lo, hi] = CONFIG.weapons.spawnEvery;
      this.nextSpawnAt = now + lo + this.rand() * (hi - lo);
      if (this.ground.length < CONFIG.weapons.maxGround) {
        const pos = this.freeSpot(player.pos);
        if (pos) {
          const kind = this.timedKind(this.rand(), round);
          const w = { id: this.nextId++, kind, pos, expiresAt: null };
          this.ground.push(w);
          ev.push({ type: 'WeaponSpawned', kind, pos: { ...pos } });
        }
      }
    }
    return ev;
  }

  /**
   * Kind of a timed spawn from one draw `r` in [0,1): a weapon of the round's street pool (uniform), or each special unlocked at `round`
   * (CONFIG.<kind>.spawnFromRound) with probability CONFIG.<kind>.spawnShare (the rest of the range is rescaled over the
   * weapons; still one draw, so the stream is unchanged).
   */
  private timedKind(r: number, round: number): PickupKind {
    let lo = 0;
    for (const k of spawnSpecials(round)) {
      const hi = lo + CONFIG[k].spawnShare;
      if (r < hi) return k;
      lo = hi;
    }
    const u = (r - lo) / (1 - lo);
    const kinds = streetKinds(round);
    return kinds[Math.min(kinds.length - 1, Math.floor(u * kinds.length))]!;
  }

  /**
   * Special drop (round twist / round end): a random weapon (or the given kind, e.g. a bouclier) 160–480 px from Paul
   * right now, outside the timer and the ground cap; it vanishes after CONFIG.weapons.dropLifetime s if nobody takes
   * it. Null when no free spot was found.
   */
  dropSpecial(player: Vec, kindOverride?: PickupKind): GroundWeapon | null {
    const pos = this.freeSpot(player);
    if (!pos) return null;
    const kind = kindOverride ?? KINDS[Math.floor(this.rand() * KINDS.length)]!;
    const w: GroundWeapon = { id: this.nextId++, kind, pos, expiresAt: this.now + CONFIG.weapons.dropLifetime };
    this.ground.push(w);
    return w;
  }

  /**
   * A regular weapon (picked with this stream) dropped exactly at `pos` (where the Caïd fell), outside the timer and the
   * ground cap; it vanishes after CONFIG.weapons.dropLifetime s like the other drops.
   */
  dropAt(pos: Vec): GroundWeapon {
    const kind = KINDS[Math.min(KINDS.length - 1, Math.floor(this.rand() * KINDS.length))]!;
    const w: GroundWeapon = { id: this.nextId++, kind, pos: { ...pos }, expiresAt: this.now + CONFIG.weapons.dropLifetime };
    this.ground.push(w);
    return w;
  }

  /**
   * The round twist's weapon drop: from CONFIG.bouclier.dropFromRound a bouclier with probability
   * CONFIG.bouclier.dropShare (one draw of this stream), a regular weapon otherwise (and always before).
   * `special` = 'bouclier' when it is one (null for a regular weapon).
   */
  dropTwist(player: Vec, round: number): { drop: GroundWeapon | null; special: SpecialKind | null } {
    if (round < CONFIG.bouclier.dropFromRound || this.rand() >= CONFIG.bouclier.dropShare)
      return { drop: this.dropSpecial(player), special: null };
    return { drop: this.dropSpecial(player, 'bouclier'), special: 'bouclier' };
  }

  /**
   * A weapon of `kind` dropped `min`–`max` px from Paul (the flashball of the first shooter), outside the timer and the
   * ground cap; it never expires. Null when no free spot was found.
   */
  dropNear(player: Vec, kind: PickupKind, min: number, max: number): GroundWeapon | null {
    const pos = this.freeSpot(player, min, max);
    if (!pos) return null;
    const w: GroundWeapon = { id: this.nextId++, kind, pos, expiresAt: null };
    this.ground.push(w);
    return w;
  }

  /** A flashball shot fired: one shot used whether it hits or not; at 0 it breaks (WeaponBroken). */
  onShot(): SimEvent[] {
    if (!this.held || this.held.kind === 'bouclier') return [];
    return this.onSwing(1);
  }

  /** Call after each swing with the number of rioters hit (regular weapons only: the specials have no strike count). */
  onSwing(hits: number): SimEvent[] {
    if (!this.held || hits === 0 || this.held.kind === 'bouclier') return [];
    this.held.uses -= 1;
    if (this.held.uses > 0) return [];
    const kind = this.held.kind;
    this.held = null;
    return [{ type: 'WeaponBroken', kind }];
  }

  /** A random walkable tile centre between minDist and maxDist from Paul (default CONFIG.weapons), outside the peaceful group. */
  private freeSpot(from: Vec, minDist: number = CONFIG.weapons.minDist, maxDist: number = CONFIG.weapons.maxDist): Vec | null {
    const t = this.grid.tile;
    for (let i = 0; i < 40; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = minDist + this.rand() * (maxDist - minDist);
      const tx = Math.floor((from.x + Math.cos(a) * r) / t);
      const ty = Math.floor((from.y + Math.sin(a) * r) / t);
      const p = { x: tx * t + t / 2, y: ty * t + t / 2 };
      if (!this.grid.circleBlocked(p, 10) && !this.grid.isGroup(p)) return p;
    }
    return null;
  }
}
