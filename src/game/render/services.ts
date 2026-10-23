import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { strikeLanded } from './serviceMath';
import { OfficerView, TruckView, type OfficerSnap } from './serviceViews';

export { makeServiceTextures } from './serviceTextures';

/** Logical pixels drawn ×2, like the props. */
const PX = 2;

/**
 * The emergency services on the map (Snapshot.allies): the fire truck and its water, the police officers and the
 * prison's guards (Snapshot.prison.guards; role looks, a bar for the guards' several hp), a spark when a blow lands (the sim sends no HitConfirmed for it), smoke when the truck is destroyed.
 */
export class ServicesLayer {
  private readonly truck: TruckView;
  private readonly officers = new Map<number, OfficerView>();
  private readonly sparks: { img: Phaser.GameObjects.Image; born: number }[] = [];
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkNext = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly pow: (x: number, y: number, nowMs: number) => void,
  ) {
    this.truck = new TruckView(scene);
    for (let i = 0; i < 6; i++)
      this.sparks.push({ img: scene.add.image(0, 0, 'hit_spark').setScale(PX).setDepth(DEPTH.overlay).setVisible(false), born: -Infinity });
    this.smoke = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 1200, max: 2200 },
        speedY: { min: -50, max: -20 },
        speedX: { min: -20, max: 20 },
        scale: { start: 4, end: 12 },
        tint: [0x2e2b33, 0x4a4650, 0x6d6a72],
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
    this.debris = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 60, max: 160 },
        angle: { min: 200, max: 340 },
        gravityY: 240,
        scale: { start: 2, end: 1 },
        tint: [0xd8312a, 0x9aa0aa, 0xff9a2e, 0x14121c],
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
  }

  update(s: Snapshot, nowMs: number, dtMs: number): void {
    this.truck.update(s.ended ? null : s.allies.truck, s, nowMs, dtMs);
    const seen = new Set<number>();
    // the police group's officers and the prison's guards (same foot brain, their own look); a guard's blow lands like
    // an officer's (spark + « PAF ! »)
    const guards = s.prison.guards.map((g): OfficerSnap => ({ ...g, role: 'guard' }));
    for (const o of [...s.allies.police, ...guards]) {
      seen.add(o.id);
      let v = this.officers.get(o.id);
      if (!v) {
        v = new OfficerView(this.scene, o);
        this.officers.set(o.id, v);
      }
      const at = strikeLanded(v.prevState, o.state, o.pos, s.hostiles, CONFIG.services.police.hitRange + 4);
      if (at) this.hit(at, nowMs);
      v.prevState = o.state;
      v.update(o, nowMs);
    }
    for (const [id, v] of this.officers) {
      if (seen.has(id)) continue;
      if (!v.fade(nowMs)) {
        v.destroy();
        this.officers.delete(id);
      }
    }
    for (const sp of this.sparks) {
      const age = nowMs - sp.born;
      if (!sp.img.visible) continue;
      if (age > 220) sp.img.setVisible(false);
      else sp.img.setScale(PX * (age < 80 ? 1 + age / 80 : 2 - (age - 80) / 140)).setAlpha(age < 120 ? 1 : 1 - (age - 120) / 100);
    }
  }

  onEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'TruckDestroyed') {
        this.truck.vanish();
        this.smoke.emitParticleAt(e.pos.x, e.pos.y - 10, 24);
        this.debris.emitParticleAt(e.pos.x, e.pos.y - 10, 20);
      }
    }
  }

  /** The baton lands: a white-yellow spark on the rioter and a small « PAF ! ». */
  private hit(at: Vec, nowMs: number): void {
    const sp = this.sparks[this.sparkNext++ % this.sparks.length]!;
    sp.born = nowMs;
    sp.img
      .setPosition(Math.round(at.x), Math.round(at.y - 24))
      .setVisible(true)
      .setAlpha(1)
      .setScale(PX);
    this.pow(at.x, at.y, nowMs);
  }
}
