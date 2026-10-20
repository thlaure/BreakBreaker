import Phaser from 'phaser';
import { MOLOTOV_FLIGHT_SEC, type Snapshot, type Telegraph } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { DEPTH } from './depth';

type RockSnap = Snapshot['rocks'][number];
const ARC_PX = 12;

/** Rocks: ground shadow + shape lifted by sin(πt)·12 while flying; white outline + slow bob once recoverable. */
export class RockLayer {
  private readonly views = new Map<number, { shadow: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Image }>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** `progress` gives the flight fraction t∈[0,1] of a flying rock (visual only). */
  update(rocks: Snapshot['rocks'], progress: (id: number) => number, timeMs: number): void {
    const seen = new Set<number>();
    for (const r of rocks) {
      seen.add(r.id);
      let v = this.views.get(r.id);
      if (!v) {
        v = {
          shadow: this.scene.add.ellipse(0, 0, 10, 4, 0x000000, 0.35).setDepth(DEPTH.decal + 3),
          body: this.scene.add.image(0, 0, `rock_${r.kind}`),
        };
        this.views.set(r.id, v);
      }
      this.place(v, r, progress, timeMs);
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      v.shadow.destroy();
      v.body.destroy();
      this.views.delete(id);
    }
  }

  private place(
    v: { shadow: Phaser.GameObjects.Ellipse; body: Phaser.GameObjects.Image },
    r: RockSnap,
    progress: (id: number) => number,
    timeMs: number,
  ): void {
    if (r.state === 'LandedRecoverable') {
      const bob = Math.sin(timeMs / 450 + r.id) * 1.5 - 2;
      v.body.setTexture(`rock_${r.kind}_o`).setPosition(r.pos.x, r.pos.y + bob).setDepth(r.pos.y);
      v.shadow.setPosition(r.pos.x, r.pos.y + 2).setScale(1);
      return;
    }
    const h = Math.sin(Math.PI * Math.min(1, Math.max(0, progress(r.id)))) * ARC_PX;
    v.body.setTexture(`rock_${r.kind}`).setPosition(r.pos.x, r.pos.y - h).setDepth(r.pos.y).setAngle(timeMs / 3);
    v.shadow.setPosition(r.pos.x, r.pos.y).setScale(1 - h / (ARC_PX * 2.5));
  }
}

/**
 * Thrower telegraphs: red dashed line from→to and a ground ring at `to`, plus a red arrow at the screen edge
 * pointing at windups whose thrower is off screen. A telegraph whose thrower is already KO is hidden
 * (matched by position, the sim keeps it until `until`).
 */
export class TelegraphLayer {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly line: Phaser.GameObjects.Graphics;
  private readonly edge: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.ring = scene.add.graphics().setDepth(DEPTH.decal + 2);
    this.line = scene.add.graphics().setDepth(DEPTH.overlay);
    this.edge = scene.add.graphics().setDepth(DEPTH.edge);
  }

  update(snap: Snapshot, view: Phaser.Geom.Rectangle, timeMs: number): void {
    this.ring.clear();
    this.line.clear();
    this.edge.clear();
    const live = visibleTelegraphs(snap);
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(timeMs / 90));
    for (const t of live) {
      dashed(this.line, t.from, t.to, 0xff3b30, pulse);
      this.ring.lineStyle(2, 0xff3b30, pulse).strokeEllipse(t.to.x, t.to.y, 26, 13);
      this.ring.fillStyle(0xff3b30, 0.18 * pulse).fillEllipse(t.to.x, t.to.y, 26, 13);
      if (!view.contains(t.from.x, t.from.y)) this.arrow(t.from, view);
    }
  }

  private arrow(target: Vec, view: Phaser.Geom.Rectangle): void {
    const m = 12;
    const cx = view.centerX;
    const cy = view.centerY;
    const x = Phaser.Math.Clamp(target.x, view.x + m, view.right - m);
    const y = Phaser.Math.Clamp(target.y, view.y + m, view.bottom - m);
    const a = Math.atan2(target.y - cy, target.x - cx);
    const pt = (r: number, da: number): [number, number] => [x + Math.cos(a + da) * r, y + Math.sin(a + da) * r];
    const [x1, y1] = pt(8, 0);
    const [x2, y2] = pt(6, 2.4);
    const [x3, y3] = pt(6, -2.4);
    this.edge.fillStyle(0xff3b30, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
    this.edge.lineStyle(1, 0xffffff, 0.9).strokeTriangle(x1, y1, x2, y2, x3, y3);
  }
}

/** Telegraphs still pending and whose thrower has not been knocked out. */
export function visibleTelegraphs(snap: Snapshot): Telegraph[] {
  const kos = snap.hostiles.filter((h) => h.state === 'ko');
  return snap.telegraphs.filter(
    (t) => t.until > snap.now && !kos.some((h) => Math.abs(h.pos.x - t.from.x) < 1 && Math.abs(h.pos.y - t.from.y) < 1),
  );
}

function dashed(g: Phaser.GameObjects.Graphics, a: Vec, b: Vec, color: number, alpha: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  g.lineStyle(2, color, alpha);
  for (let s = 0; s < len; s += 10) {
    const e = Math.min(len, s + 6);
    g.lineBetween(a.x + ux * s, a.y + uy * s, a.x + ux * e, a.y + uy * e);
  }
}

interface Flight {
  from: Vec;
  to: Vec;
  until: number;
  seen: number;
  bottle: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
}

/**
 * Molotov bottles in flight (`snapshot.molotovs`): spinning lit bottle on an arc from → to over the flight, ground
 * shadow, then a flame burst where it lands. Bottle sprites are pooled.
 */
export class MolotovFx {
  private readonly flights: Flight[] = [];
  private readonly pool: Flight[] = [];
  private readonly burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly puff: Phaser.GameObjects.Particles.ParticleEmitter;
  private frame = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.burst = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 300, max: 650 },
        speed: { min: 40, max: 140 },
        angle: { min: 190, max: 350 },
        gravityY: 120,
        scale: { start: 4, end: 0.5 },
        tint: [0xfff6d0, 0xffe066, 0xff9a2e, 0xff5a1f],
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.roof + 3);
    this.puff = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 600, max: 1000 },
        speed: { min: 10, max: 40 },
        angle: { min: 200, max: 340 },
        scale: { start: 3, end: 8 },
        tint: [0x2e2b33, 0x4a4650],
        alpha: { start: 0.6, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
  }

  /** `now` = sim time (s), `timeMs` = render clock. */
  update(list: Snapshot['molotovs'], now: number, timeMs: number): void {
    const frame = ++this.frame;
    for (const m of list) {
      let f = this.flights.find((x) => x.until === m.until && x.to.x === m.to.x && x.to.y === m.to.y);
      if (!f) {
        f = this.acquire(m);
        this.flights.push(f);
      }
      f.seen = frame;
      this.place(f, now, timeMs);
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i]!;
      if (f.seen === frame) continue;
      this.burst.emitParticleAt(f.to.x, f.to.y - 6, 28);
      this.puff.emitParticleAt(f.to.x, f.to.y - 10, 8);
      f.bottle.setVisible(false);
      f.flame.setVisible(false);
      f.shadow.setVisible(false);
      this.flights.splice(i, 1);
      this.pool.push(f);
    }
  }

  private acquire(m: Telegraph): Flight {
    const f =
      this.pool.pop() ??
      ({
        bottle: this.scene.add.image(0, 0, 'bottle').setScale(2).setDepth(DEPTH.foliage + 1),
        flame: this.scene.add
          .image(0, 0, 'flame')
          .setOrigin(0.5, 1)
          .setScale(2)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.foliage + 1.1),
        shadow: this.scene.add.ellipse(0, 0, 12, 5, 0x000000, 0.35).setDepth(DEPTH.decal + 3),
      } as Flight);
    f.from = m.from;
    f.to = m.to;
    f.until = m.until;
    f.bottle.setVisible(true);
    f.flame.setVisible(true);
    f.shadow.setVisible(true);
    return f;
  }

  private place(f: Flight, now: number, timeMs: number): void {
    const t = Math.min(1, Math.max(0, 1 - (f.until - now) / MOLOTOV_FLIGHT_SEC));
    const x = f.from.x + (f.to.x - f.from.x) * t;
    const y = f.from.y + (f.to.y - f.from.y) * t;
    const peak = Math.min(48, 20 + 0.15 * Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y));
    // leaves the raised hand (~40 px up) and lands on the door
    const h = Math.sin(Math.PI * t) * peak + 40 * (1 - t);
    f.bottle.setPosition(Math.round(x), Math.round(y - h)).setAngle(t * 720);
    f.flame
      .setPosition(Math.round(x), Math.round(y - h) - 6)
      .setFlipX(Math.floor(timeMs / 70) % 2 === 0);
    f.shadow.setPosition(Math.round(x), Math.round(y)).setScale(1 - h / 120);
  }
}
