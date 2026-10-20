import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Player } from './player';
import type { SimEvent, Vec } from './types';

export type WeaponKind = 'baton' | 'marteau' | 'panneau';
/** What can lie on the ground: a weapon, or the mode furie power-up (activates at once, keeps the held weapon). */
export type PickupKind = WeaponKind | 'furie';

/** Melee weapons found in the street. Every one KOs a rioter in one hit; reach and strikes differ. */
export const WEAPONS: Readonly<Record<WeaponKind, { label: string; range: number; uses: number }>> = {
  baton: { label: 'Bâton', range: 72, uses: 15 },
  marteau: { label: 'Marteau', range: 64, uses: 8 },
  panneau: { label: 'Panneau', range: 96, uses: 10 },
};
const KINDS = Object.keys(WEAPONS) as WeaponKind[];

export interface GroundWeapon {
  id: number;
  kind: PickupKind;
  pos: Vec;
  /** Sim time at which an unclaimed special drop vanishes; null for the timed street spawns. */
  expiresAt: number | null;
}

export interface HeldWeapon {
  kind: WeaponKind;
  uses: number;
}

/**
 * Random weapon pickups. A weapon appears every CONFIG.weapons.spawnEvery seconds (random within the range) on a
 * free spot away from Paul, up to maxGround at once. Walking over one takes it (replacing the current weapon).
 * A strike that hits at least one rioter uses one strike; at 0 the weapon breaks and Paul fights bare-handed.
 * A furie pickup does not replace the weapon: it switches the mode furie on for CONFIG.furie.durationSec (reset by a
 * second one); the timer runs with the sim steps (frozen while paused) and `endFurie` cuts it short (Paul KO).
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

  /** Reach of Paul's strike with the current weapon (bare hands otherwise), ×CONFIG.furie.reachMul in furie. */
  range(): number {
    const base = this.held ? WEAPONS[this.held.kind].range : CONFIG.melee.range;
    return this.furie() ? base * CONFIG.furie.reachMul : base;
  }

  /** Ends the mode furie at once (Paul KO); FurieEnded when it was on. */
  endFurie(): SimEvent[] {
    if (!this.furie()) return [];
    this.furieLeft = 0;
    return [{ type: 'FurieEnded' }];
  }

  /** `round` gates the furie among the timed spawns (CONFIG.furie.spawnFromRound). */
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
    this.ground = this.ground.filter((g) => g.expiresAt === null || now < g.expiresAt);
    const taken = this.ground.find((g) => dist(g.pos, player.pos) <= CONFIG.weapons.pickupRadius);
    if (taken && !player.ko) {
      this.ground = this.ground.filter((g) => g !== taken);
      if (taken.kind === 'furie') {
        this.furieLeft = CONFIG.furie.durationSec;
        ev.push({ type: 'FurieStarted', secondsLeft: this.furieLeft });
      } else {
        this.held = { kind: taken.kind, uses: WEAPONS[taken.kind].uses };
        ev.push({ type: 'WeaponPickedUp', kind: taken.kind });
      }
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
   * Kind of a timed spawn from one draw `r` in [0,1): a weapon (uniform), or from CONFIG.furie.spawnFromRound a furie
   * when r < spawnShare (the rest of the range is rescaled over the weapons; still one draw, so the stream is unchanged).
   */
  private timedKind(r: number, round: number): PickupKind {
    const { spawnFromRound, spawnShare } = CONFIG.furie;
    if (round < spawnFromRound) return KINDS[Math.floor(r * KINDS.length)]!;
    if (r < spawnShare) return 'furie';
    const u = (r - spawnShare) / (1 - spawnShare);
    return KINDS[Math.min(KINDS.length - 1, Math.floor(u * KINDS.length))]!;
  }

  /**
   * Special drop (round twist / round end): a random weapon (or the given kind, e.g. a furie) 160–480 px from Paul
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

  /** Call after each swing with the number of rioters hit. */
  onSwing(hits: number): SimEvent[] {
    if (!this.held || hits === 0) return [];
    this.held.uses -= 1;
    if (this.held.uses > 0) return [];
    const kind = this.held.kind;
    this.held = null;
    return [{ type: 'WeaponBroken', kind }];
  }

  /** A random walkable tile centre between minDist and maxDist from Paul, outside the peaceful group. */
  private freeSpot(from: Vec): Vec | null {
    const { minDist, maxDist } = CONFIG.weapons;
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
