import Phaser from 'phaser';
import type { Snapshot } from '../../sim/sim';
import type { Fall, Launch, Vec } from '../../sim/types';
import { DEPTH } from './depth';
import { CAN_POOL, CAN_SCALE, makeFallTextures, type LaunchCtx } from './fallKit';
import { newFallPose } from './fallMath';
import { HostileView } from './hostileView';
import { Twinkles } from './satellite';

/**
 * Keeps one HostileView per lifeId in the snapshot; `launch` sends a KO body flying (mode furie, beam, gant), `fall`
 * plays its ActorKnockedOut.fall.
 */
export class HostileLayer {
  private readonly views = new Map<number, HostileView>();
  /** Bodies the jail van loaded (lifeIds): not drawn while the sim still lists them. */
  private readonly carried = new Set<number>();
  private readonly ctx: LaunchCtx;

  private readonly twinkles: Twinkles;

  constructor(
    private readonly scene: Phaser.Scene,
    opts: {
      world: { width: number; height: number };
      blocked: (p: Vec) => boolean;
      reducedMotion?: boolean;
      pow?: (x: number, y: number, nowMs: number, word: string, big?: boolean) => void;
    } = {
      world: { width: Infinity, height: Infinity },
      blocked: () => false,
    },
  ) {
    makeFallTextures(scene);
    const cans: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < CAN_POOL; i++)
      cans.push(scene.add.image(0, 0, 'trash_can').setOrigin(0.5, 1).setScale(CAN_SCALE).setVisible(false));
    const trail = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 260, max: 520 },
        speed: { min: 6, max: 30 },
        scale: { start: 1.5, end: 0 },
        tint: [0xffffff, 0xfff3a0, 0xffd23a, 0xcfc6b4],
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.foliage + 1.5);
    this.twinkles = new Twinkles(scene);
    const dust = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 220, max: 380 },
        speed: { min: 4, max: 14 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.6, end: 0.4 },
        tint: [0xcfc6b4, 0xb8ad97, 0xe6dfcf],
        alpha: { start: 0.7, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.decal + 1);
    this.ctx = {
      dust,
      trail,
      world: opts.world,
      blocked: opts.blocked,
      twinkles: this.twinkles,
      view: () => scene.cameras.main.worldView,
      zoom: () => scene.cameras.main.zoom || 1,
      satellites: { flying: 0 },
      reducedMotion: opts.reducedMotion ?? false,
      falls: { active: 0 },
      cans,
      pow: opts.pow ?? (() => {}),
      pose: newFallPose(),
    };
  }

  /**
   * The body of `lifeId` (knocked out at `from`) flies along the launch: a tumble for furieMath.LAUNCH_MS, a satellite
   * for SATELLITE_MS (then gone).
   */
  launch(lifeId: number, from: Vec, launch: Launch, nowMs: number, index = 0, boing = false): void {
    this.views.get(lifeId)?.launch(from, launch, nowMs, this.ctx, index, boing);
  }

  /** The body of `lifeId` (knocked out at `from`) plays `fall` (see fallMath). */
  fall(lifeId: number, from: Vec, fall: Fall, nowMs: number): void {
    this.views.get(lifeId)?.fall(from, fall, nowMs, this.ctx);
  }

  /** Bodies playing a fall right now (debug / tests). */
  get fallsActive(): number {
    return this.ctx.falls.active;
  }

  /**
   * Where the body of `lifeId` is drawn right now (after a fall's travel or a furie flight), or null when it has no
   * view (never drawn, satellite gone, carried off).
   */
  bodyPos(lifeId: number): Vec | null {
    const v = this.views.get(lifeId);
    if (!v || v.removed) return null;
    return { x: v.view.sprite.x, y: v.view.sprite.y };
  }

  /**
   * The jail van loads the body of `lifeId`: its view is destroyed now and never drawn again, even while the sim still
   * lists the KO body (it takes it off the map CONFIG.prison.pickupSec after the KO).
   */
  carry(lifeId: number): void {
    this.carried.add(lifeId);
    const v = this.views.get(lifeId);
    if (v) {
      v.destroy(this.ctx);
      this.views.delete(lifeId);
    }
  }

  update(list: Snapshot['hostiles'], nowMs: number): void {
    const seen = new Set<number>();
    for (const h of list) {
      seen.add(h.lifeId);
      if (this.carried.has(h.lifeId)) continue;
      let view = this.views.get(h.lifeId);
      if (!view) {
        view = new HostileView(this.scene, h);
        this.views.set(h.lifeId, view);
      }
      view.update(h, nowMs, this.ctx);
    }
    this.twinkles.update(nowMs);
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.destroy(this.ctx);
      this.views.delete(id);
    }
    for (const id of this.carried) if (!seen.has(id)) this.carried.delete(id);
  }

  flash(lifeId: number, nowMs: number): void {
    const v = this.views.get(lifeId);
    if (v && !v.removed) v.view.flash(nowMs);
  }
}
