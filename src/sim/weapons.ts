import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Player } from './player';
import type { SimEvent, Vec } from './types';

export type WeaponKind = 'baton' | 'marteau' | 'panneau';

/** Melee weapons found in the street. Every one KOs a rioter in one hit; reach and strikes differ. */
export const WEAPONS: Readonly<Record<WeaponKind, { label: string; range: number; uses: number }>> = {
  baton: { label: 'Bâton', range: 72, uses: 15 },
  marteau: { label: 'Marteau', range: 64, uses: 8 },
  panneau: { label: 'Panneau', range: 96, uses: 10 },
};
const KINDS = Object.keys(WEAPONS) as WeaponKind[];

export interface GroundWeapon {
  id: number;
  kind: WeaponKind;
  pos: Vec;
}

export interface HeldWeapon {
  kind: WeaponKind;
  uses: number;
}

/**
 * Random weapon pickups. A weapon appears every CONFIG.weapons.spawnEvery seconds (random within the range) on a
 * free spot away from Paul, up to maxGround at once. Walking over one takes it (replacing the current weapon).
 * A strike that hits at least one rioter uses one strike; at 0 the weapon breaks and Paul fights bare-handed.
 */
export class Weapons {
  ground: GroundWeapon[] = [];
  held: HeldWeapon | null = null;
  private nextSpawnAt: number;
  private nextId = 1;

  constructor(
    private readonly grid: Grid,
    private readonly rand: () => number,
  ) {
    this.nextSpawnAt = CONFIG.weapons.firstSpawn;
  }

  /** Reach of Paul's strike with the current weapon (bare hands otherwise). */
  range(): number {
    return this.held ? WEAPONS[this.held.kind].range : CONFIG.melee.range;
  }

  step(dt: number, now: number, player: Player): SimEvent[] {
    void dt;
    const ev: SimEvent[] = [];
    const taken = this.ground.find((g) => dist(g.pos, player.pos) <= CONFIG.weapons.pickupRadius);
    if (taken && !player.ko) {
      this.ground = this.ground.filter((g) => g !== taken);
      this.held = { kind: taken.kind, uses: WEAPONS[taken.kind].uses };
      ev.push({ type: 'WeaponPickedUp', kind: taken.kind });
    }
    if (now >= this.nextSpawnAt) {
      const [lo, hi] = CONFIG.weapons.spawnEvery;
      this.nextSpawnAt = now + lo + this.rand() * (hi - lo);
      if (this.ground.length < CONFIG.weapons.maxGround) {
        const pos = this.freeSpot(player.pos);
        if (pos) {
          const kind = KINDS[Math.floor(this.rand() * KINDS.length)]!;
          const w = { id: this.nextId++, kind, pos };
          this.ground.push(w);
          ev.push({ type: 'WeaponSpawned', kind, pos: { ...pos } });
        }
      }
    }
    return ev;
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
