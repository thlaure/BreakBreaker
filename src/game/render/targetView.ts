import Phaser from 'phaser';
import type { Rect, TargetDef } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { TargetId } from '../../sim/types';
import { FLAG } from '../assets';
import { schoolFlagShown } from './targetMath';
import { DEPTH } from './depth';
import { PROP_RISE, type PropKind } from './geometry';
import { HpBar } from './targetHpBar';
import { FACADE_H, type BuildingPart } from './world';

type TargetSnap = Snapshot['targets'][number];

/** Props are drawn from 1-px logical textures scaled ×2, like the city tiles. */
const PX = 2;
/** The look of a prop target: cars, the bus shelter, the newspaper kiosk and the phone booths. */
function propKind(kind: TargetDef['kind']): PropKind {
  return kind === 'busStop' || kind === 'kiosk' || kind === 'booth' ? kind : 'car';
}
/** Phone booth textures by target: intact, ruined; `booth_spent` (grey) once its calls are used up. */
export const BOOTH_TEXTURES: Readonly<Partial<Record<TargetId, { intact: string; ruined: string }>>> = {
  boothRed: { intact: 'booth_red', ruined: 'booth_red_broken' },
  boothBlue: { intact: 'booth_blue', ruined: 'booth_blue_broken' },
};
const FLASH_MS = 120;
/** Extra flare of a target already burning hit by another bottle. */
const FLARE_MS = 350;

/**
 * One destructible target: hp bar, fire + smoke while `burning`, ruin (scorched, debris, smoke wisps) while ruined,
 * back to normal once repaired. A building (school, retro video-game shop, nursery, town hall, library, prison) dims its
 * own parts when ruined (parts named 'intact' hide, parts named 'ruin' show), and the
 * school flies the French flag while it stands and is not on fire (schoolFlagShown); props
 * (cars, bus shelter, newspaper kiosk) are drawn on their solid footprint and swap to a wreck texture.
 */
export class TargetView {
  private readonly fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly glow: Phaser.GameObjects.Ellipse;
  private readonly debris: Phaser.GameObjects.Graphics;
  private readonly bar: HpBar;
  private readonly sprite: Phaser.GameObjects.Image | null = null;
  private readonly mast: Phaser.GameObjects.Container | null = null;
  private readonly smokeFreq: { burning: number; wisps: number };
  private textures: { intact: string; ruined: string } | null = null;
  private burning = false;

  /** Whether the flames are currently shown. */
  get isBurning(): boolean {
    return this.burning;
  }
  private ruined = false;
  private flashUntil = 0;
  /** Render time until which an extra bottle's flare brightens the glow (0 = none). */
  private flareUntil = 0;
  readonly zone: Phaser.Geom.Rectangle;

  constructor(
    scene: Phaser.Scene,
    readonly def: TargetDef,
    private readonly parts: readonly BuildingPart[],
  ) {
    const f = def.footprint;
    const bottom = f.y + f.h;
    const cx = f.x + f.w / 2;
    const prop = def.prop;
    const big = !prop;
    if (prop) {
      const kind = propKind(def.kind);
      this.textures =
        kind === 'booth'
          ? { ...(BOOTH_TEXTURES[def.id] ?? { intact: 'booth_red', ruined: 'booth_red_broken' }) }
          : kind === 'busStop'
            ? { intact: 'busstop', ruined: 'busstop_broken' }
            : kind === 'kiosk'
              ? { intact: 'kiosk', ruined: 'kiosk_broken' }
              : { intact: def.id === 'car2' ? 'car_b' : 'car_a', ruined: 'car_burnt' };
      scene.add.ellipse(cx, bottom - 2, f.w + 6, 12, 0x000000, 0.25).setDepth(DEPTH.decal);
      this.sprite = scene.add
        .image(cx, bottom + (kind === 'car' ? 2 : 0), this.textures.intact)
        .setOrigin(0.5, 1)
        .setScale(PX)
        .setDepth(bottom);
      const rise = PROP_RISE[kind];
      // a booth is narrow: its flames fill its whole width
      const inset = kind === 'booth' ? 4 : 8;
      this.zone = new Phaser.Geom.Rectangle(f.x + inset, f.y - rise, f.w - inset * 2, f.h - 8 + rise);
    } else {
      this.zone = new Phaser.Geom.Rectangle(f.x + 16, bottom - FACADE_H - 40, f.w - 32, 40);
    }
    this.smokeFreq = big ? { burning: 70, wisps: 220 } : { burning: 110, wisps: 320 };
    const zone = { type: 'random', source: this.zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData;
    this.fire = scene.add
      .particles(0, 0, 'px', {
        emitZone: zone,
        lifespan: big ? { min: 400, max: 800 } : { min: 300, max: 600 },
        speedY: big ? { min: -80, max: -35 } : { min: -60, max: -25 },
        speedX: { min: -10, max: 10 },
        scale: { start: big ? 4 : 3, end: 0.5 },
        quantity: big ? 2 : 1,
        tint: [0xffe066, 0xff9a2e, 0xff5a1f],
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        frequency: big ? 20 : 30,
        emitting: false,
      })
      .setDepth(big ? DEPTH.roof + 2 : bottom + 0.5);
    this.smoke = scene.add
      .particles(0, 0, 'px', {
        emitZone: zone,
        lifespan: { min: 1400, max: 2400 },
        speedY: { min: -40, max: -20 },
        speedX: { min: -6, max: 14 },
        scale: { start: big ? 4 : 3, end: big ? 11 : 8 },
        tint: [0x2e2b33, 0x4a4650],
        alpha: { start: 0.6, end: 0 },
        frequency: this.smokeFreq.burning,
        emitting: false,
      })
      .setDepth(DEPTH.roof + 1);
    // warm light on the street in front of the flames
    this.glow = scene.add
      .ellipse(cx, bottom + 4, f.w * 0.9, big ? 26 : 18, 0xff9a2e, 0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.decal + 1)
      .setVisible(false);
    this.debris = scene.add
      .graphics()
      .setDepth(big ? bottom + 0.5 : DEPTH.decal + 1)
      .setVisible(false);
    this.drawDebris(f);
    if (def.kind === 'school') {
      // mast on the front edge of the roof, so it reads from the street in front of the school
      const mx = cx + 48;
      const my = bottom - FACADE_H - 2;
      const pole = scene.add.rectangle(0, 0, 2, 34, 0xd8d4cc).setOrigin(0.5, 1);
      const flag = scene.add.image(1, -34, 'flags', FLAG.fr).setOrigin(0, 0).setScale(1.5);
      this.mast = scene.add
        .container(mx, my, [pole, flag])
        .setDepth(DEPTH.roof + 3)
        .setVisible(false);
    }
    // a building's bar sits on the front of its roof, just above the flames, so it shows from the door
    const barTop = big ? bottom - FACADE_H - 56 : f.y - PROP_RISE[propKind(def.kind)] - 12;
    this.bar = big ? new HpBar(scene, cx, barTop, 64, 10) : new HpBar(scene, cx, barTop, 36, 8);
  }

  /** `burning` = the sim's flag, held back while the igniting bottle is still in the air. */
  update(t: TargetSnap, burning: boolean, nowMs: number, dtMs: number): void {
    const ruined = t.state === 'ruined';
    if (ruined !== this.ruined) this.setRuined(ruined);
    if (burning !== this.burning) {
      this.burning = burning;
      this.fire.emitting = burning;
      if (burning) this.fire.emitParticle(16); // whoosh
    }
    this.smoke.emitting = burning || ruined;
    this.smoke.frequency = burning ? this.smokeFreq.burning : this.smokeFreq.wisps;
    this.glow.setVisible(burning);
    if (burning) {
      const flare = this.flareUntil > nowMs ? (0.5 * (this.flareUntil - nowMs)) / FLARE_MS : 0;
      this.glow.setAlpha(Math.min(1, 0.18 + 0.12 * Math.abs(Math.sin(nowMs / 70) * Math.sin(nowMs / 113)) + flare));
    }
    this.mast?.setVisible(schoolFlagShown(t, burning));
    if (this.sprite && this.flashUntil > 0 && nowMs >= this.flashUntil) {
      this.flashUntil = 0;
      this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
    this.bar.update(t.hp / t.maxHp, !ruined && (t.hp < t.maxHp || t.state === 'attacked'), nowMs, dtMs);
  }

  /**
   * A further bottle landed on a target already in flames: a burst of extra flames and a bright glow for FLARE_MS,
   * on top of the running fire (which keeps going).
   */
  flare(nowMs: number): void {
    if (!this.burning) return;
    this.fire.emitParticle(this.def.prop ? 24 : 40);
    this.flareUntil = nowMs + FLARE_MS;
  }

  /** Swaps the standing look of a prop (a phone booth goes grey once its calls are spent); the wreck stays. */
  setIntact(key: string): void {
    if (!this.textures || this.textures.intact === key) return;
    this.textures.intact = key;
    if (!this.ruined) this.sprite?.setTexture(key);
  }

  /** Short white flash of the prop (repair). */
  flash(nowMs: number): void {
    if (!this.sprite) return;
    this.flashUntil = nowMs + FLASH_MS;
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  private setRuined(ruined: boolean): void {
    this.ruined = ruined;
    this.debris.setVisible(ruined);
    if (this.sprite && this.textures) this.sprite.setTexture(ruined ? this.textures.ruined : this.textures.intact);
    if (this.def.prop) return;
    for (const p of this.parts) {
      // a building's own ruin art (the prison's fallen watchtower, its gate burst open) swaps with its standing art
      if (p.name === 'intact') p.setVisible(!ruined);
      else if (p.name === 'ruin') p.setVisible(ruined);
      else if (p instanceof Phaser.GameObjects.TileSprite) {
        if (ruined) p.setTint(0x3a3438);
        else p.clearTint();
      } else if (p.name === 'glow') p.setVisible(!ruined);
      else if (p instanceof Phaser.GameObjects.Text || p instanceof Phaser.GameObjects.Graphics) p.setAlpha(ruined ? 0.45 : 1);
    }
  }

  /** Static ruin decals: rubble in front of a building, soot + glass / metal bits around a prop. */
  private drawDebris(f: Rect): void {
    const g = this.debris;
    let seed = 7 + f.x + f.y;
    const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (!this.def.prop) {
      for (let k = 0; k < 26; k++) {
        g.fillStyle(rnd() < 0.5 ? 0x5b4a3e : 0x6d6a72, 1);
        g.fillRect(f.x + rnd() * f.w, f.y + f.h + rnd() * 18 - 4, 3 + rnd() * 6, 2 + rnd() * 4);
      }
      return;
    }
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    g.fillStyle(0x14121c, 0.45).fillEllipse(cx, cy + 4, f.w + 28, f.h + 18);
    g.fillStyle(0x14121c, 0.3).fillEllipse(cx - 10, cy + 10, f.w * 0.6, f.h * 0.6);
    const bits =
      this.def.kind === 'busStop'
        ? [0x8fcfe8, 0xe6f7ff, 0x8fcfe8, 0x6d6a72]
        : this.def.kind === 'kiosk'
          ? [0xf4ecd8, 0xff4f6d, 0xf4ecd8, 0x2f8a4a] // newspapers and torn magazines
          : this.def.kind === 'booth'
            ? [0x8fcfe8, 0xe6f7ff, this.def.id === 'boothBlue' ? 0x3b6fd2 : 0xd23b3b, 0x3a3438] // glass, paint chips
            : [0x3a3438, 0x6d6a72, 0x8a4a2b, 0x9fd8ef];
    for (let k = 0; k < 18; k++) {
      const a = rnd() * Math.PI * 2;
      const d = 0.55 + rnd() * 0.35;
      const x = Math.round((cx + Math.cos(a) * (f.w / 2 + 10) * d) / PX) * PX;
      const y = Math.round((cy + 6 + Math.sin(a) * (f.h / 2 + 10) * d) / PX) * PX;
      g.fillStyle(bits[k % bits.length]!, 1).fillRect(x, y, PX * (1 + (k % 2)), PX);
    }
  }
}
