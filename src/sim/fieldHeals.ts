import { CONFIG } from './config';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Player } from './player';
import type { Rules } from './rules';
import type { SimEvent, Vec } from './types';

/** A small heal lying on the ground; `expiresAt` = sim time it vanishes. */
export interface FieldHeal {
  id: number;
  pos: Vec;
  expiresAt: number;
}

export interface FieldHealCtx {
  player: Player;
  rules: Rules;
}

/**
 * Small field heals (§12.5, CONFIG.fieldHeal). `count()` is fed the eligible KOs (round-roster KOs); every
 * CONFIG.fieldHeal.every of them a +amount heal drops near Paul (not on him, away from walls, clear line). At most
 * maxGround lie on the ground; at the cap one heal at most waits and the counter keeps its remainder (it is capped at
 * 2 × every − 1, so freeing places never releases a hidden pile). Walking over one takes it unless Paul is at full
 * health; it vanishes after lifeSec. Draws come from its own stream, so they never shift any other random sequence.
 */
export class FieldHeals {
  ground: FieldHeal[] = [];
  private kos = 0;
  private nextId = 1;

  constructor(
    private readonly grid: Grid,
    private readonly rand: () => number,
  ) {}

  /** `n` more eligible KOs. */
  count(n: number): void {
    if (n > 0) this.kos += n;
  }

  /** Eligible KOs not turned into a heal yet (tests, diagnostics). */
  pending(): number {
    return this.kos;
  }

  step(now: number, ctx: FieldHealCtx): SimEvent[] {
    const ev: SimEvent[] = [];
    const F = CONFIG.fieldHeal;
    const { player, rules } = ctx;
    this.ground = this.ground.filter((h) => now < h.expiresAt);
    if (!player.ko && !rules.ended && player.hp < CONFIG.player.maxHp) {
      const taken = this.ground.find((h) => dist(h.pos, player.pos) <= F.pickupRadius);
      if (taken) {
        this.ground = this.ground.filter((h) => h !== taken);
        const before = player.hp;
        player.hp = Math.min(CONFIG.player.maxHp, player.hp + F.amount);
        ev.push({ type: 'SmallHealPicked', id: taken.id, amount: player.hp - before });
      }
    }
    if (rules.ended) return ev;
    while (this.kos >= F.every && this.ground.length < F.maxGround) {
      const pos = this.spot(player.pos);
      if (!pos) break;
      this.kos -= F.every;
      const h: FieldHeal = { id: this.nextId++, pos, expiresAt: now + F.lifeSec };
      this.ground.push(h);
      ev.push({ type: 'SmallHealDropped', id: h.id, pos: { ...pos } });
    }
    // full ground: one heal waits at most, plus the tranche under way
    this.kos = Math.min(this.kos, F.every * 2 - 1);
    return ev;
  }

  /**
   * A walkable tile centre minDist–maxDist px from Paul, wallClear px from any solid, outside the peaceful group, with a
   * clear line from Paul and not on another heal; null after 40 tries.
   */
  private spot(from: Vec): Vec | null {
    const F = CONFIG.fieldHeal;
    const t = this.grid.tile;
    for (let i = 0; i < 40; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = F.minDist + this.rand() * (F.maxDist - F.minDist);
      const p = { x: Math.floor((from.x + Math.cos(a) * r) / t) * t + t / 2, y: Math.floor((from.y + Math.sin(a) * r) / t) * t + t / 2 };
      const d = dist(p, from);
      if (d < F.minDist || d <= F.pickupRadius) continue;
      if (this.grid.circleBlocked(p, F.wallClear) || this.grid.isGroup(p) || !this.grid.lineClear(from, p)) continue;
      if (this.ground.some((h) => dist(h.pos, p) < t)) continue;
      return p;
    }
    return null;
  }
}
