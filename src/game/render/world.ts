import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { DISTRICT, type Rect } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { FLAG, TILE } from '../assets';
import { DEPTH, inRect } from './depth';

const T = CONFIG.tile;
const N = DISTRICT.tiles;
/** Height of a building's front wall, drawn at the bottom of its footprint. */
const FACADE_H = 32;
/** Roofs overhang the street behind the building so actors there are hidden (and the roof fades). */
const ROOF_OVERHANG = 24;
const ROOF_FADED = 0.35;

interface Roof {
  rect: Rect;
  parts: { setAlpha(a: number): unknown }[];
}

/** Static district: ground tilemap, building fronts, roofs, trees. */
export class WorldView {
  readonly width = N * T;
  readonly height = N * T;
  private readonly roofs: Roof[] = [];
  readonly schoolParts: (Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.buildGround();
    DISTRICT.buildings.forEach((b, i) => this.buildBuilding(b, i));
    this.buildTrees();
  }

  /** Fades the roof whose rect contains Paul's feet. */
  update(feet: Vec): void {
    for (const r of this.roofs) {
      const a = inRect(feet, r.rect) ? ROOF_FADED : 1;
      for (const p of r.parts) p.setAlpha(a);
    }
  }

  private buildGround(): void {
    const near = (tx: number, ty: number, r: Rect, pad: number): boolean =>
      tx >= r.x / T - pad && tx < (r.x + r.w) / T + pad && ty >= r.y / T - pad && ty < (r.y + r.h) / T + pad;
    const data: number[][] = [];
    for (let ty = 0; ty < N; ty++) {
      const row: number[] = [];
      for (let tx = 0; tx < N; tx++) {
        const paved =
          DISTRICT.buildings.some((b) => near(tx, ty, b, 1)) ||
          near(tx, ty, DISTRICT.peacefulGroup.area, 1) ||
          DISTRICT.trunks.some((c) => Math.abs(c.x / T - 0.5 - tx) <= 1 && Math.abs(c.y / T - 0.5 - ty) <= 1);
        row.push(paved ? TILE.streets.sidewalk : TILE.streets.road);
      }
      data.push(row);
    }
    const map = this.scene.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const tiles = map.addTilesetImage('streets', 'streets', T, T, 0, 0);
    if (!tiles) throw new Error('streets tileset missing');
    map.createLayer(0, tiles, 0, 0)?.setDepth(DEPTH.ground);
  }

  private buildBuilding(b: Rect, i: number): void {
    const s = this.scene;
    const school = i === 0;
    const wall = school ? TILE.city.wallRed : i % 2 === 0 ? TILE.city.wallGrey : TILE.city.wallRed;
    const front = b.y + b.h;
    const facade = s.add
      .tileSprite(b.x, front - FACADE_H, b.w / 2, FACADE_H / 2, 'city', wall)
      .setOrigin(0)
      .setScale(2)
      .setDepth(front);
    const base = s.add.rectangle(b.x, front - 3, b.w, 3, 0x1d1a24, 0.9).setOrigin(0).setDepth(front + 0.01);

    const rect: Rect = { x: b.x, y: b.y - ROOF_OVERHANG, w: b.w, h: b.h - FACADE_H + ROOF_OVERHANG };
    const roofFrame = school ? TILE.city.roofs[0] : TILE.city.roofs[1 + (i % 3)]!;
    const roof = s.add
      .tileSprite(rect.x, rect.y, rect.w / 2, rect.h / 2, 'city', roofFrame)
      .setOrigin(0)
      .setScale(2)
      .setDepth(DEPTH.roof);
    const eave = s.add.rectangle(rect.x, rect.y + rect.h - 4, rect.w, 4, 0x000000, 0.35).setOrigin(0).setDepth(DEPTH.roof);
    const parts: Roof['parts'] = [roof, eave];
    if (school) {
      const sign = s.add
        .text(b.x + b.w / 2, front - FACADE_H / 2, 'ÉCOLE', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#1d1a24',
          backgroundColor: '#f4ecd8',
          padding: { left: 3, right: 3, top: 3, bottom: 1 },
        })
        .setOrigin(0.5)
        .setDepth(front + 0.02);
      this.schoolParts.push(facade, roof, base, sign);
    }
    this.roofs.push({ rect, parts });
  }

  private buildTrees(): void {
    for (const t of DISTRICT.trunks) {
      const footY = t.y + 6;
      this.scene.add.ellipse(t.x, footY, 18, 6, 0x000000, 0.25).setDepth(DEPTH.decal);
      this.scene.add.image(t.x, footY, 'city', TILE.city.treeTrunk).setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.decal + 1);
      this.scene.add
        .image(t.x, footY - 32, 'city', TILE.city.treeTop)
        .setOrigin(0.5, 1)
        .setScale(2)
        .setDepth(DEPTH.foliage);
    }
  }
}

type SchoolStage = Snapshot['school']['stage'];

/** School incident visuals: fire + smoke while threatened, ruin + debris when destroyed, French flag when saved. */
export class SchoolView {
  private readonly fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Graphics;
  private readonly mast: Phaser.GameObjects.Container;
  private stage: SchoolStage | null = null;

  constructor(scene: Phaser.Scene, private readonly parts: WorldView['schoolParts']) {
    const f = DISTRICT.school.footprint;
    const zone = new Phaser.Geom.Rectangle(f.x + 16, f.y + f.h - FACADE_H - 40, f.w - 32, 40);
    this.fire = scene.add
      .particles(0, 0, 'px', {
        emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 400, max: 800 },
        speedY: { min: -80, max: -35 },
        speedX: { min: -10, max: 10 },
        scale: { start: 4, end: 0.5 },
        quantity: 2,
        tint: [0xffe066, 0xff9a2e, 0xff5a1f],
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        frequency: 20,
        emitting: false,
      })
      .setDepth(DEPTH.roof + 2);
    this.smoke = scene.add
      .particles(0, 0, 'px', {
        emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 1400, max: 2400 },
        speedY: { min: -40, max: -20 },
        speedX: { min: -6, max: 14 },
        scale: { start: 4, end: 11 },
        tint: [0x2e2b33, 0x4a4650],
        alpha: { start: 0.6, end: 0 },
        frequency: 70,
        emitting: false,
      })
      .setDepth(DEPTH.roof + 1);
    this.debris = scene.add.graphics().setDepth(f.y + f.h + 0.5).setVisible(false);
    let seed = 7;
    const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 26; k++) {
      this.debris.fillStyle(r() < 0.5 ? 0x5b4a3e : 0x6d6a72, 1);
      this.debris.fillRect(f.x + r() * f.w, f.y + f.h + r() * 18 - 4, 3 + r() * 6, 2 + r() * 4);
    }
    // mast on the front edge of the roof, so it reads from the street in front of the school
    const mx = f.x + f.w / 2 + 48;
    const my = f.y + f.h - FACADE_H - 2;
    const pole = scene.add.rectangle(0, 0, 2, 34, 0xd8d4cc).setOrigin(0.5, 1);
    const flag = scene.add.image(1, -34, 'flags', FLAG.fr).setOrigin(0, 0).setScale(1.5);
    this.mast = scene.add.container(mx, my, [pole, flag]).setDepth(DEPTH.roof + 3).setVisible(false);
  }

  update(stage: SchoolStage): void {
    if (stage === this.stage) return;
    this.stage = stage;
    const burning = stage === 'firstLine' || stage === 'cinematic' || stage === 'reinforcements';
    this.fire.emitting = burning;
    this.smoke.emitting = burning || stage === 'destroyed';
    if (stage === 'destroyed') {
      this.smoke.frequency = 220;
      for (const p of this.parts) {
        if (p instanceof Phaser.GameObjects.TileSprite) p.setTint(0x3a3438);
        else if (p instanceof Phaser.GameObjects.Text) p.setAlpha(0.45);
      }
      this.debris.setVisible(true);
    }
    this.mast.setVisible(stage === 'saved');
  }
}

/** Heal stations: green cross + "Soins"; greyed once used; progress ring while healing. */
export class StationsView {
  private readonly items: { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Graphics }[] =
    [];

  constructor(scene: Phaser.Scene) {
    for (const pos of DISTRICT.stations) {
      const icon = scene.add.image(pos.x, pos.y, 'station').setDepth(pos.y);
      const label = scene.add
        .text(pos.x, pos.y + 12, 'Soins', { fontFamily: 'monospace', fontSize: '9px', color: '#e8ffe8', stroke: '#14121c', strokeThickness: 2 })
        .setOrigin(0.5, 0)
        .setDepth(pos.y + 0.1);
      const ring = scene.add.graphics().setDepth(DEPTH.overlay);
      this.items.push({ icon, label, ring });
    }
  }

  update(list: Snapshot['stations']): void {
    list.forEach((st, i) => {
      const it = this.items[i];
      if (!it) return;
      it.icon.setTint(st.charged ? 0xffffff : 0x6a6a6a).setAlpha(st.charged ? 1 : 0.7);
      it.label.setAlpha(st.charged ? 1 : 0.5);
      it.ring.clear();
      if (st.progress > 0 && st.charged) {
        it.ring.lineStyle(2, 0x5ee07a, 1);
        it.ring.beginPath();
        it.ring.arc(st.pos.x, st.pos.y, 15, -Math.PI / 2, -Math.PI / 2 + st.progress * Math.PI * 2);
        it.ring.strokePath();
      }
    });
  }
}

/** Small runtime textures (particles, rocks, station icon) – no extra image files needed. */
export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('px')) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
  g.generateTexture('px', 2, 2);
  g.clear();
  // station: white plate with green cross
  g.fillStyle(0x14121c, 1).fillRoundedRect(0, 0, 20, 20, 4);
  g.fillStyle(0xf4f4f0, 1).fillRoundedRect(1, 1, 18, 18, 3);
  g.fillStyle(0x23a84a, 1).fillRect(8, 4, 4, 12).fillRect(4, 8, 12, 4);
  g.generateTexture('station', 20, 20);
  g.destroy();
}

const ROCK_SHAPES: Record<'caillou' | 'pave' | 'brique', { w: number; h: number; color: number; round: boolean }> = {
  caillou: { w: 8, h: 7, color: 0x9a948c, round: true },
  pave: { w: 8, h: 8, color: 0x7d8290, round: false },
  brique: { w: 12, h: 6, color: 0xa4553a, round: false },
};

/** `rock_<kind>` (flying) and `rock_<kind>_o` (on the ground, 1-px white outline). */
export function makeRockTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('rock_caillou')) return;
  const g = scene.make.graphics({}, false);
  for (const [kind, s] of Object.entries(ROCK_SHAPES)) {
    for (const outlined of [false, true]) {
      g.clear();
      const o = outlined ? 1 : 0;
      const shape = (x: number, y: number, w: number, h: number): void => {
        if (s.round) g.fillEllipse(x + w / 2, y + h / 2, w, h);
        else g.fillRect(x, y, w, h);
      };
      if (outlined) {
        g.fillStyle(0xffffff, 1);
        shape(0, 0, s.w + 2, s.h + 2);
      }
      g.fillStyle(s.color, 1);
      shape(o, o, s.w, s.h);
      g.fillStyle(0x000000, 0.25).fillRect(o, o + s.h - 1, s.w, 1);
      g.generateTexture(`rock_${kind}${outlined ? '_o' : ''}`, s.w + 2 * o, s.h + 2 * o);
    }
  }
  g.destroy();
}
