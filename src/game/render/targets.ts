import Phaser from 'phaser';
import { DISTRICT, type Rect, type TargetDef } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { SimEvent, TargetId, Vec } from '../../sim/types';
import { FLAG } from '../assets';
import { schoolFlagShown } from './targetMath';
import { DEPTH } from './depth';
import { FACADE_H, buildingIndex, type BuildingPart, type WorldView } from './world';

type TargetSnap = Snapshot['targets'][number];
type BuildingParts = WorldView['buildingParts'];

const OUTLINE = 0x14121c;
/** Props are drawn from 1-px logical textures scaled ×2, like the city tiles. */
const PX = 2;
type PropKind = 'car' | 'busStop' | 'kiosk' | 'booth';
/** World px a prop texture rises above its footprint (it is anchored on the footprint's bottom edge). */
export const PROP_RISE: Record<PropKind, number> = { car: 10, busStop: 16, kiosk: 16, booth: 24 };
/** The look of a prop target: cars, the bus shelter, the newspaper kiosk and the phone booths. */
function propKind(kind: TargetDef['kind']): PropKind {
  return kind === 'busStop' || kind === 'kiosk' || kind === 'booth' ? kind : 'car';
}
/** Phone booth textures by target: intact, ruined; `booth_spent` (grey) once its calls are used up. */
const BOOTH_TEXTURES: Readonly<Partial<Record<TargetId, { intact: string; ruined: string }>>> = {
  boothRed: { intact: 'booth_red', ruined: 'booth_red_broken' },
  boothBlue: { intact: 'booth_blue', ruined: 'booth_blue_broken' },
};
export const BOOTH_SPENT = 'booth_spent';
const FLASH_MS = 120;
/** Extra flare of a target already burning hit by another bottle. */
const FLARE_MS = 350;
/** Hp bar: white flash on a hp drop, at most once per this many ms (fire and degraders drain every step). */
const BAR_FLASH_MS = 90;
const BAR_FLASH_EVERY_MS = 450;
/** The light "lost hp" trail catches up with the bar at this fraction of max hp per second. */
const TRAIL_PER_SEC = 0.3;

/**
 * Runtime prop textures (1 px logical, drawn ×2): `car_a` / `car_b` (3/4 side-view compact, red / blue) and `car_burnt`,
 * `busstop` / `busstop_broken`, `kiosk` / `kiosk_broken` (green newspaper stand), `booth_red` / `booth_blue` /
 * `booth_spent` and their `_broken` wrecks (phone booths), plus the `toolbox` pickup, the
 * Molotov `bottle`, its `flame` and the `bang` mark.
 */
export function makeTargetTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('car_a')) return;
  const g = scene.make.graphics({}, false);
  const r = (c: number, x: number, y: number, w: number, h: number, a = 1): void => {
    g.fillStyle(c, a).fillRect(x, y, w, h);
  };

  // car: chunky 3/4 side view facing east (roof, windows, body, big wheels), like the buildings' 3/4 view
  const car = (key: string, c: { body: number; hi: number; shade: number; roof: number } | null): void => {
    g.clear();
    const burnt = c === null;
    const body = c?.body ?? 0x3a3438;
    const hi = c?.hi ?? 0x55505a;
    const shade = c?.shade ?? 0x262228;
    const roof = c?.roof ?? 0x4a4448;
    const glass = burnt ? 0x1d1a24 : 0x9fd8ef;
    // silhouette
    r(OUTLINE, 8, 2, 16, 2);
    r(OUTLINE, 7, 4, 18, 1);
    r(OUTLINE, 6, 5, 20, 4);
    r(OUTLINE, 1, 8, 30, 10);
    r(OUTLINE, 0, 9, 32, 8);
    // roof seen from above, then the side windows split by the pillar
    r(roof, 9, 3, 14, 1);
    r(roof, 8, 4, 16, 1);
    r(glass, 8, 5, 7, 1);
    r(glass, 7, 6, 8, 3);
    r(glass, 17, 5, 6, 1);
    r(glass, 17, 6, 7, 3);
    // body
    r(body, 1, 9, 30, 8);
    r(hi, 1, 9, 30, 1);
    r(shade, 1, 15, 30, 2);
    r(OUTLINE, 16, 10, 1, 5); // door seam
    r(hi, 12, 11, 2, 1); // door handle
    // wheels (bare rims once burnt)
    for (const wx of [4, 20]) {
      r(OUTLINE, wx + 1, 13, 6, 7);
      r(OUTLINE, wx, 14, 8, 5);
      if (!burnt) {
        r(0x1d1a24, wx + 2, 14, 4, 5);
        r(0x1d1a24, wx + 1, 15, 6, 3);
      }
      r(0x9aa0aa, wx + 3, 15, 2, 2);
    }
    if (burnt) {
      r(0x9fd8ef, 21, 8, 1, 1); // last shard of windshield
      r(0x8a4a2b, 10, 11, 3, 2); // rust
      r(0x8a4a2b, 24, 10, 2, 2);
      r(0x8a4a2b, 13, 4, 2, 1);
      r(0xff7a1f, 18, 12, 1, 1); // embers
      r(0xffb03a, 4, 11, 1, 1);
    } else {
      r(0xe6f7ff, 18, 6, 1, 2); // glints
      r(0xe6f7ff, 8, 6, 1, 1);
      r(0xffe066, 30, 10, 1, 2); // headlight
      r(0xff3b30, 1, 10, 1, 2); // tail light
      r(0x9aa0aa, 0, 14, 2, 1); // bumpers
      r(0x9aa0aa, 30, 14, 2, 1);
    }
    g.generateTexture(key, 32, 20);
  };
  car('car_a', { body: 0xd23b3b, hi: 0xf27a6a, shade: 0x9c2a2a, roof: 0xe85a4c });
  car('car_b', { body: 0x3b7fd2, hi: 0x7ab4f2, shade: 0x2a5a9c, roof: 0x5a9ae8 });
  car('car_burnt', null);

  // bus shelter, front view: roof, glass back wall with a poster, bench, two posts
  const shelter = (key: string, broken: boolean): void => {
    g.clear();
    // glass panels (left 12, middle 7) and the poster (5)
    if (!broken) {
      r(0x8fcfe8, 3, 5, 12, 11, 0.85);
      r(0x8fcfe8, 16, 5, 7, 11, 0.85);
      for (let i = 0; i < 5; i++) {
        r(0xe6f7ff, 4 + i, 14 - i, 1, 1);
        r(0xe6f7ff, 9 + i, 11 - i, 1, 1);
        r(0xe6f7ff, 17 + i, 13 - i, 1, 1);
      }
      r(0xffd23f, 24, 5, 5, 11);
      r(0xd23b3b, 25, 7, 3, 3);
      r(OUTLINE, 25, 12, 3, 1);
      r(OUTLINE, 25, 14, 2, 1);
    } else {
      // jagged remnants stuck in the frame
      r(0x8fcfe8, 3, 5, 4, 1);
      r(0x8fcfe8, 3, 6, 3, 1);
      r(0x8fcfe8, 3, 7, 2, 1);
      r(0x8fcfe8, 3, 8, 1, 2);
      r(0x8fcfe8, 11, 15, 4, 1);
      r(0x8fcfe8, 13, 14, 2, 1);
      r(0x8fcfe8, 14, 13, 1, 1);
      r(0x8fcfe8, 16, 5, 2, 3);
      r(0x8fcfe8, 16, 8, 1, 2);
      r(0x8fcfe8, 19, 15, 4, 1);
      r(0x8fcfe8, 21, 14, 2, 1);
      r(0xe6f7ff, 4, 5, 1, 1);
      r(0xe6f7ff, 16, 5, 1, 1);
      // torn, faded poster
      r(0xc8a830, 24, 5, 5, 6);
      r(0xc8a830, 24, 11, 3, 1);
      r(0xc8a830, 24, 12, 1, 1);
      r(0x9a3a32, 25, 7, 3, 3);
    }
    // frame
    r(OUTLINE, 2, 4, 28, 1);
    r(OUTLINE, 2, 16, 28, 1);
    r(OUTLINE, 2, 4, 1, 13);
    r(OUTLINE, 15, 4, 1, 13);
    r(OUTLINE, 23, 4, 1, 13);
    r(OUTLINE, 29, 4, 1, 13);
    // bench
    r(OUTLINE, 5, 16, 22, 4);
    r(broken ? 0x8a5a2b : 0xb07a43, 6, 17, 20, 2);
    r(broken ? 0xa06a3a : 0xd9a066, 6, 17, 20, 1);
    r(OUTLINE, 7, 20, 2, 2);
    r(OUTLINE, 23, 20, 2, 2);
    // posts
    r(OUTLINE, 0, 3, 3, 20);
    r(OUTLINE, 29, 3, 3, 20);
    r(0x9aa0aa, 1, 4, 1, 18);
    r(0x9aa0aa, 30, 4, 1, 18);
    // roof (dented and sagging on the right once smashed)
    if (!broken) {
      r(OUTLINE, 0, 0, 32, 5);
      r(0x3a8e6a, 1, 1, 30, 3);
      r(0x6ac89a, 1, 1, 30, 1);
      r(0x2a6a4e, 1, 3, 30, 1);
    } else {
      r(OUTLINE, 0, 0, 20, 5);
      r(0x2f6e54, 1, 1, 18, 3);
      r(0x4f9a76, 1, 1, 18, 1);
      r(OUTLINE, 19, 2, 13, 5);
      r(0x2f6e54, 20, 3, 11, 3);
      r(0x4f9a76, 20, 3, 4, 1);
      r(OUTLINE, 9, 1, 1, 2); // crack
    }
    g.generateTexture(key, 32, 24);
  };
  shelter('busstop', false);
  shelter('busstop_broken', true);

  // newspaper kiosk, front view: striped green / white awning, green booth, magazines on the racks, a newspaper
  // headline board, the vendor's hatch; once ransacked: torn awning, empty racks, papers strewn, scorched panels
  const kiosk = (key: string, broken: boolean): void => {
    g.clear();
    const green = broken ? 0x2a4a3a : 0x2f8a4a;
    const greenHi = broken ? 0x3a5a48 : 0x5ec07a;
    const greenLo = broken ? 0x1d3328 : 0x1f6a36;
    // booth body
    r(OUTLINE, 1, 5, 30, 19);
    r(green, 2, 6, 28, 17);
    r(greenHi, 2, 6, 28, 1);
    r(greenLo, 2, 21, 28, 2);
    // vendor's hatch (middle) with the counter
    r(OUTLINE, 11, 7, 10, 9);
    r(broken ? 0x1d1a24 : 0xffd27a, 12, 8, 8, 7);
    r(OUTLINE, 10, 15, 12, 2);
    r(broken ? 0x6a4a2b : 0xb07a43, 11, 15, 10, 1);
    if (!broken) {
      r(0x8a5a3a, 13, 11, 6, 1); // shelf inside
      r(0xf4ecd8, 14, 9, 2, 2); // vendor's paper stack
    }
    // side racks of magazines (left and right of the hatch)
    const mags = [0xff4f6d, 0xffd23f, 0x3fc6e0, 0xf4ecd8, 0x7a5cff, 0xff8a3a];
    for (const [x0, k0] of [[3, 0], [22, 3]] as const) {
      for (let row = 0; row < 2; row++) {
        r(OUTLINE, x0, 9 + row * 6, 7, 1);
        for (let k = 0; k < 3; k++) {
          if (broken && (k + row + k0) % 3 !== 0) continue; // racks mostly empty
          const c = mags[(k + row * 2 + k0) % mags.length]!;
          r(c, x0 + k * 2 + (k > 0 ? 1 : 0), 6 + row * 6, 2, 3);
          r(OUTLINE, x0 + k * 2 + (k > 0 ? 1 : 0), 7 + row * 6, 2, 1, 0.35);
        }
      }
    }
    // headline board on the front (white sheet, black lines)
    r(OUTLINE, 12, 17, 8, 6);
    r(broken ? 0xa8a08a : 0xf4f4f0, 13, 18, 6, 4);
    r(OUTLINE, 14, 19, 4, 1);
    r(OUTLINE, 14, 21, 3, 1);
    // awning
    if (!broken) {
      r(OUTLINE, 0, 0, 32, 6);
      for (let k = 0; k < 8; k++) {
        const c = k % 2 === 0 ? 0x2f8a4a : 0xf4f4f0;
        r(c, 1 + k * 4, 1, k === 7 ? 2 : 4, 3);
        r(c, 1 + k * 4, 4, k === 7 ? 2 : 4, k % 2 === 0 ? 2 : 1); // scalloped edge
      }
      r(0xe6f7ff, 2, 1, 4, 1); // sheen
    } else {
      // torn: left half sagging, strips hanging
      r(OUTLINE, 0, 1, 18, 5);
      for (let k = 0; k < 4; k++) r(k % 2 === 0 ? 0x2a6a3e : 0xb8b4a8, 1 + k * 4, 2, 4, 3);
      r(OUTLINE, 18, 3, 14, 3);
      r(0x2a6a3e, 19, 4, 4, 1);
      r(0xb8b4a8, 23, 4, 4, 1);
      r(0xb8b4a8, 24, 5, 1, 3); // hanging strip
      r(0x2a6a3e, 28, 5, 1, 4);
      // soot and papers strewn on the ground line
      r(0x14121c, 4, 12, 4, 3, 0.6);
      r(0x14121c, 24, 16, 5, 3, 0.6);
      r(0xf4ecd8, 0, 22, 3, 2);
      r(0xf4ecd8, 27, 23, 4, 1);
      r(0xff4f6d, 6, 23, 2, 1);
      r(0xff7a1f, 16, 9, 1, 1); // embers
    }
    g.generateTexture(key, 32, 24);
  };
  kiosk('kiosk', false);
  kiosk('kiosk_broken', true);

  // phone booth, front view (16 × 28): a coloured cabin with a sign band and a lamp on the roof, glass door with the
  // handset on the back wall; wrecked: smashed panes, sign hanging, door off its hinge, scorch marks
  const booth = (key: string, c: { body: number; hi: number; lo: number }, broken: boolean): void => {
    g.clear();
    const glass = broken ? 0x1d1a24 : 0x9fd8ef;
    // cabin
    r(OUTLINE, 0, 3, 16, 25);
    r(c.body, 1, 4, 14, 23);
    r(c.hi, 1, 4, 1, 23);
    r(c.lo, 14, 4, 1, 23);
    // roof cap and lamp
    r(OUTLINE, 1, 1, 14, 3);
    r(c.hi, 2, 2, 12, 1);
    r(OUTLINE, 6, 0, 4, 2);
    r(broken ? 0x6d6a72 : 0xfff6d0, 7, 0, 2, 1);
    // sign band « TEL » (white strip, dark marks)
    if (!broken) {
      r(0xf4f4f0, 2, 5, 12, 3);
      r(OUTLINE, 4, 6, 2, 1);
      r(OUTLINE, 7, 6, 2, 1);
      r(OUTLINE, 10, 6, 2, 1);
    } else {
      r(0xb8b4a8, 2, 6, 7, 2); // half the sign hangs crooked
      r(0xb8b4a8, 9, 7, 4, 1);
      r(OUTLINE, 4, 7, 2, 1);
    }
    // door: glass panes split by a bar, the handset and its box seen through
    r(OUTLINE, 2, 9, 12, 16);
    r(glass, 3, 10, 10, 14);
    r(OUTLINE, 3, 16, 10, 1);
    if (!broken) {
      r(0x3a3438, 9, 11, 3, 4); // phone box
      r(0x14121c, 10, 12, 1, 2); // handset
      r(0xe6f7ff, 4, 11, 1, 3); // glints
      r(0xe6f7ff, 5, 10, 1, 1);
      r(0xe6f7ff, 4, 18, 1, 2);
      r(c.hi, 3, 20, 1, 1); // door handle
    } else {
      // shards left in the frame
      r(0x8fcfe8, 3, 10, 3, 1);
      r(0x8fcfe8, 3, 11, 2, 1);
      r(0x8fcfe8, 3, 12, 1, 2);
      r(0x8fcfe8, 10, 23, 3, 1);
      r(0x8fcfe8, 12, 21, 1, 2);
      r(0x8fcfe8, 9, 17, 2, 1);
      r(0x3a3438, 9, 12, 3, 2); // phone box, handset ripped off
      r(OUTLINE, 10, 14, 1, 4); // the dangling cord
      r(0x14121c, 1, 12, 3, 5, 0.6); // soot
      r(0x14121c, 11, 4, 4, 6, 0.6);
      r(0xff7a1f, 5, 24, 1, 1); // embers
    }
    // base
    r(OUTLINE, 0, 25, 16, 3);
    r(c.lo, 1, 26, 14, 1);
    g.generateTexture(key, 16, 28);
  };
  booth('booth_red', { body: 0xd23b3b, hi: 0xf27a6a, lo: 0x9c2a2a }, false);
  booth('booth_blue', { body: 0x3b6fd2, hi: 0x7aa8f2, lo: 0x2a4f9c }, false);
  booth('booth_spent', { body: 0x8a8690, hi: 0xaeaab4, lo: 0x625e68 }, false);
  booth('booth_red_broken', { body: 0x6e2a2a, hi: 0x8a3a36, lo: 0x4a1c1c }, true);
  booth('booth_blue_broken', { body: 0x2a3e6e, hi: 0x3a548a, lo: 0x1c2a4a }, true);

  // toolbox: red-orange case, grey handle, yellow latch
  g.clear();
  r(OUTLINE, 3, 0, 6, 3);
  r(OUTLINE, 0, 2, 12, 8);
  r(0x9aa0aa, 4, 1, 4, 1);
  r(0x9aa0aa, 4, 2, 1, 1);
  r(0x9aa0aa, 7, 2, 1, 1);
  r(0xe8562a, 1, 3, 10, 6);
  r(0xff8a4a, 1, 3, 10, 1);
  r(0xa83a1a, 1, 5, 10, 1);
  r(0xb43e1e, 1, 8, 10, 1);
  r(0xffd23f, 5, 5, 2, 2);
  g.generateTexture('toolbox', 12, 10);

  // Molotov bottle: cloth rag, green neck, amber-filled glass
  g.clear();
  r(OUTLINE, 1, 0, 4, 5);
  r(OUTLINE, 0, 4, 6, 7);
  r(0xf0e2c0, 2, 1, 2, 2);
  r(0x2f8a4a, 2, 3, 2, 2);
  r(0x3eaa5c, 1, 5, 4, 5);
  r(0xe08a2e, 1, 7, 4, 3);
  r(0xa8f0b8, 1, 6, 1, 2);
  g.generateTexture('bottle', 6, 11);

  // flame: orange teardrop, yellow heart, pale core
  g.clear();
  r(0xff7a1f, 2, 0, 2, 2);
  r(0xff7a1f, 1, 2, 4, 2);
  r(0xff7a1f, 0, 4, 6, 3);
  r(0xff7a1f, 1, 7, 4, 1);
  r(0xffe066, 2, 3, 2, 2);
  r(0xffe066, 1, 5, 4, 2);
  r(0xfff6d0, 2, 5, 2, 2);
  g.generateTexture('flame', 6, 8);

  // "!" warning mark
  g.clear();
  r(OUTLINE, 0, 0, 4, 7);
  r(OUTLINE, 0, 8, 4, 3);
  r(0xffd23f, 1, 1, 2, 5);
  r(0xffd23f, 1, 9, 2, 1);
  g.generateTexture('bang', 4, 11);
  g.destroy();
}

/** Pixel hp bar: hidden at full hp when not attacked; green > 50 %, yellow > 25 %, red; white flash on damage. */
export class HpBar {
  private readonly g: Phaser.GameObjects.Graphics;
  private last = -1;
  private trail = 1;
  private flashUntil = 0;
  private nextFlashAt = 0;
  private drawnKey = -1;

  constructor(scene: Phaser.Scene, cx: number, top: number, private readonly w: number, private readonly h: number) {
    this.g = scene.add
      .graphics()
      .setPosition(Math.round(cx - w / 2), Math.round(top))
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
  }

  /** Moves the bar (a moving ally's): centred on `cx`, top at `top`, on whole pixels. */
  moveTo(cx: number, top: number): void {
    this.g.setPosition(Math.round(cx - this.w / 2), Math.round(top));
  }

  update(frac: number, visible: boolean, nowMs: number, dtMs: number): void {
    if (!visible) {
      this.g.setVisible(false);
      this.last = frac;
      this.trail = frac;
      return;
    }
    if (this.last >= 0 && frac < this.last - 1e-6 && nowMs >= this.nextFlashAt) {
      this.flashUntil = nowMs + BAR_FLASH_MS;
      this.nextFlashAt = nowMs + BAR_FLASH_EVERY_MS;
    }
    this.last = frac;
    this.trail = this.trail <= frac ? frac : Math.max(frac, this.trail - (dtMs / 1000) * TRAIL_PER_SEC);
    const flash = nowMs < this.flashUntil;
    const inner = this.w - 4;
    // whole 2-px steps so the bar stays on the pixel grid
    const fill = Math.ceil((frac * inner) / PX) * PX;
    const trail = Math.ceil((this.trail * inner) / PX) * PX;
    const tier = frac > 0.5 ? 0 : frac > 0.25 ? 1 : 2;
    const key = ((fill * 1000 + trail) * 4 + tier) * 2 + (flash ? 1 : 0);
    this.g.setVisible(true);
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    const [main, hi] = flash ? [0xffffff, 0xffffff] : BAR_COLORS[tier]!;
    const ih = this.h - 4;
    this.g
      .clear()
      .fillStyle(OUTLINE, 1)
      .fillRect(0, 0, this.w, this.h)
      .fillStyle(0x3a3438, 1)
      .fillRect(2, 2, inner, ih)
      .fillStyle(0xf4ecd8, 0.85)
      .fillRect(2, 2, trail, ih)
      .fillStyle(main, 1)
      .fillRect(2, 2, fill, ih)
      .fillStyle(hi, 1)
      .fillRect(2, 2, fill, PX);
  }
}

const BAR_COLORS: [number, number][] = [
  [0x3fc65e, 0xa8f5b8],
  [0xffc21f, 0xfff08a],
  [0xff3b30, 0xff9a90],
];

/**
 * One destructible target: hp bar, fire + smoke while `burning`, ruin (scorched, debris, smoke wisps) while ruined,
 * back to normal once repaired. A building (school, retro video-game shop, nursery, town hall, library) dims its own parts when ruined, and the
 * school flies the French flag while it stands and is not on fire (schoolFlagShown); props
 * (cars, bus shelter, newspaper kiosk) are drawn on their solid footprint and swap to a wreck texture.
 */
class TargetView {
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
      this.mast = scene.add.container(mx, my, [pole, flag]).setDepth(DEPTH.roof + 3).setVisible(false);
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
      if (p instanceof Phaser.GameObjects.TileSprite) {
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
