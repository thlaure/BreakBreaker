import Phaser from 'phaser';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, TargetId, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { PROP_RISE } from './geometry';
import { BOOTH_TEXTURES, TargetView } from './targetView';
import { buildingIndex, type WorldView } from './world';

export { makeTargetTextures } from './targetTextures';
export { HpBar } from './targetHpBar';

type BuildingParts = WorldView['buildingParts'];

export { PROP_RISE };
export const BOOTH_SPENT = 'booth_spent';

/** Every target's view plus the one-shot bursts of their events (fire out, collapse, repair). */
export class TargetsLayer {
  private readonly views = new Map<TargetId, TargetView>();
  /** Bottles seen in flight, by key, with where they land. */
  private readonly inFlight = new Map<string, Vec>();
  private readonly sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly steam: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, buildingParts: BuildingParts) {
    for (const def of DISTRICT.targets) {
      const parts = def.prop ? [] : (buildingParts.get(buildingIndex(def.footprint)) ?? []);
      this.views.set(def.id, new TargetView(scene, def, parts));
    }
    this.sparkle = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 500, max: 800 },
        speed: { min: 60, max: 150 },
        angle: { min: 200, max: 340 },
        gravityY: 220,
        scale: { start: 2, end: 0 },
        tint: [0xffe066, 0xffffff, 0x5ee07a],
        emitting: false,
      })
      .setDepth(DEPTH.roof + 3);
    this.dust = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 700, max: 1200 },
        speed: { min: 20, max: 80 },
        angle: { min: 180, max: 360 },
        scale: { start: 3, end: 8 },
        tint: [0x6d6a72, 0x5b4a3e, 0x8a8490],
        alpha: { start: 0.75, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
    this.steam = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 700, max: 1100 },
        speedY: { min: -60, max: -25 },
        speedX: { min: -25, max: 25 },
        scale: { start: 3, end: 8 },
        tint: [0xe8e8f0, 0xb8b8c4],
        alpha: { start: 0.7, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
  }

  update(snap: Snapshot, nowMs: number, dtMs: number): void {
    // a bottle that just landed on a target already shown burning flares it (the sim took its burst damage)
    const flying = new Set<string>();
    for (const m of snap.molotovs) flying.add(`${m.until}@${m.to.x},${m.to.y}`);
    for (const [key, to] of this.inFlight) {
      if (flying.has(key)) continue;
      this.inFlight.delete(key);
      for (const v of this.views.values()) if (v.def.door.x === to.x && v.def.door.y === to.y && v.isBurning) v.flare(nowMs);
    }
    for (const m of snap.molotovs) this.inFlight.set(`${m.until}@${m.to.x},${m.to.y}`, m.to);
    for (const t of snap.targets) {
      const v = this.views.get(t.id);
      if (!v) continue;
      // the sim ignites on the throw; a new fire waits for the bottle to land on the door (an existing one keeps going)
      const door = v.def.door;
      const held = !v.isBurning && snap.molotovs.some((m) => m.to.x === door.x && m.to.y === door.y);
      v.update(t, t.burning && !held, nowMs, dtMs);
    }
  }

  /** A prop's standing look (the booths' grey once spent): see TargetView.setIntact. */
  setIntact(id: TargetId, key: string): void {
    this.views.get(id)?.setIntact(key);
  }

  /** The standing texture a booth starts with (its colour). */
  static boothIntact(id: TargetId): string {
    return BOOTH_TEXTURES[id]?.intact ?? 'booth_red';
  }

  onEvent(e: SimEvent, nowMs: number): void {
    if (e.type === 'FireOut') {
      const z = this.views.get(e.target)?.zone;
      if (z) for (let k = 0; k < 3; k++) this.steam.emitParticleAt(z.x + (z.width * (k + 0.5)) / 3, z.centerY, 6);
    } else if (e.type === 'BuildingDestroyed') {
      const f = this.views.get(e.target)?.def.footprint;
      if (f) for (let k = 0; k < 5; k++) this.dust.emitParticleAt(f.x + (f.w * (k + 0.5)) / 5, f.y + f.h - 4, 6);
    } else if (e.type === 'TargetRepaired') {
      const v = this.views.get(e.target);
      if (!v) return;
      this.sparkle.emitParticleAt(v.def.door.x, v.def.door.y - 8, 28);
      v.flash(nowMs);
    }
  }
}
