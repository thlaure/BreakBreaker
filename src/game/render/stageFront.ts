import Phaser from 'phaser';
import { t } from '../../content/i18n';
import { CONFIG } from '../../sim/config';
import type { DecorDef } from '../../sim/map/district';
import type { Vec } from '../../sim/types';
import type { FrontKit, Paint, RoofPart } from './decor';
import { DEPTH } from './depth';
import { FACADE_H, ROOF_OVERHANG } from './geometry';
import { localeBound } from './localeText';

const T = CONFIG.tile;
const OUTLINE = 0x14121c;

/** Stage colours: dark boards, worn wood, black gear, steel truss, warm footlights. */
export const STAGE = {
  plank: 0x6a4428,
  plankHi: 0x845a34,
  plankLo: 0x4a2c18,
  skirt: 0x1d1a24,
  skirtHi: 0x2e2a38,
  gear: 0x1a1820,
  gearHi: 0x3a3644,
  grille: 0x2a2732,
  steel: 0x8a909a,
  steelLo: 0x5a5e68,
  warm: 0xffd27a,
  curtain: 0x2a1830,
  curtainHi: 0x3c2444,
  banner: 0x8a1f2c,
  bannerHi: 0xc8343c,
  bannerLo: 0x5a1420,
  gold: 0xe8b84a,
} as const;

/** Colours of the four lamps on the light rig (magenta, cyan, amber, green), west to east. */
const LAMPS = [0xff4fd8, 0x4fe8ff, 0xffb02e, 0x6aff6a] as const;

/**
 * Depths of the stage layers (all fade with the roof): the floor and backdrop, the light pools on the floor, the gear at
 * the back, the musicians, the drum kit in front of the drummer, then the light rig on top.
 */
export const STAGE_DEPTH = {
  floor: DEPTH.roof + 0.1,
  pools: DEPTH.roof + 0.15,
  gear: DEPTH.roof + 0.2,
  back: DEPTH.roof + 0.25,
  kit: DEPTH.roof + 0.3,
  band: DEPTH.roof + 0.35,
  rig: DEPTH.roof + 0.45,
} as const;

/** A coloured light pool on the boards; its fill alpha pulses (SkeletonBand). */
export interface StageLight {
  pool: Phaser.GameObjects.Ellipse;
  colour: number;
}

/** What the stage front hands to the band: the floor's top-left corner (world px), its size, and the light pools. */
export interface StageFront {
  origin: Vec;
  w: number;
  h: number;
  lights: StageLight[];
}

/** Depth of the backdrop (local px from the top of the floor area): the band stands below it. */
export const BACKDROP_H = 44;

/** A Graphics at `depth` placed at (x, y), pushed among the roof parts (it fades with the roof), and its painter. */
export function roofLayer(s: Phaser.Scene, roofParts: RoofPart[], x: number, y: number, depth: number): Paint {
  const gr = s.add.graphics();
  roofParts.push(s.add.container(x, y, [gr]).setDepth(depth));
  return (c, px, py, w, h, a = 1) => {
    gr.fillStyle(c, a).fillRect(px, py, w, h);
  };
}

/** The boards and the backdrop: a dark curtain, a banner with a plain diamond pattern (no word, no logo). */
function floorAndBackdrop(p: Paint, w: number, h: number): void {
  // boards, running east-west, staggered joints, a lit front edge
  for (let y = BACKDROP_H, k = 0; y < h; y += 6, k++) {
    p(k % 2 ? STAGE.plank : STAGE.plankHi, 0, y, w, 6);
    p(STAGE.plankLo, 0, y + 5, w, 1);
    for (let x = (k % 3) * 22 + 10; x < w; x += 64) p(STAGE.plankLo, x, y, 1, 5);
  }
  p(STAGE.gold, 0, h - 3, w, 1, 0.7);
  p(OUTLINE, 0, h - 2, w, 2);
  // the back curtain with folds
  p(STAGE.curtain, 0, 0, w, BACKDROP_H);
  for (let x = 4; x < w; x += 10) p(STAGE.curtainHi, x, 0, 3, BACKDROP_H);
  p(OUTLINE, 0, BACKDROP_H - 2, w, 2);
  // the banner hung across the curtain: red cloth, gold hem, a row of plain diamonds
  const bx = 40;
  const bw = w - 80;
  p(OUTLINE, bx - 1, 9, bw + 2, 24);
  p(STAGE.banner, bx, 10, bw, 22);
  p(STAGE.bannerLo, bx, 28, bw, 4);
  p(STAGE.gold, bx, 10, bw, 1);
  p(STAGE.gold, bx, 31, bw, 1);
  for (let x = bx + 10; x + 8 <= bx + bw - 6; x += 16) {
    p(STAGE.bannerHi, x + 3, 14, 2, 1);
    p(STAGE.bannerHi, x + 2, 15, 4, 1);
    p(STAGE.bannerHi, x + 1, 16, 6, 4);
    p(STAGE.bannerHi, x + 2, 20, 4, 1);
    p(STAGE.bannerHi, x + 3, 21, 2, 1);
    p(STAGE.gold, x + 3, 17, 2, 2);
  }
  // the ropes holding it
  p(STAGE.steelLo, bx + 6, 0, 1, 10);
  p(STAGE.steelLo, bx + bw - 7, 0, 1, 10);
}

/** An amp stack (local px, top-left at 0,0, 28 × 30): two cabinets with grilles, a head with knobs on top. */
function ampStack(p: Paint): void {
  p(0x000000, 2, 28, 28, 3, 0.3);
  p(OUTLINE, 0, 0, 28, 30);
  p(STAGE.gear, 1, 1, 26, 8); // head
  for (let k = 0; k < 5; k++) p(STAGE.gold, 4 + k * 4, 4, 2, 2);
  p(0xff3a3a, 23, 3, 2, 2); // power light
  for (const y of [10, 20]) {
    p(STAGE.gearHi, 1, y, 26, 9);
    p(STAGE.grille, 3, y + 1, 22, 7);
    for (let x = 4; x < 25; x += 3) p(STAGE.gear, x, y + 1, 1, 7);
  }
}

/** The drum kit (local px, centred on x 0, floor line at y 0): a plain bass drum, two toms, a snare, cymbals. */
export function drumKit(p: Paint): void {
  p(0x000000, -20, -2, 40, 3, 0.3);
  // cymbal stands and cymbals
  for (const x of [-18, 17]) p(STAGE.steelLo, x, -26, 1, 24);
  p(OUTLINE, -24, -28, 13, 3);
  p(STAGE.gold, -23, -27, 11, 1);
  p(OUTLINE, 11, -30, 13, 3);
  p(STAGE.gold, 12, -29, 11, 1);
  // toms on the bass drum, a snare on the left
  p(OUTLINE, -11, -21, 9, 6);
  p(STAGE.banner, -10, -20, 7, 4);
  p(0xf4f0e8, -10, -20, 7, 1);
  p(OUTLINE, 2, -21, 9, 6);
  p(STAGE.banner, 3, -20, 7, 4);
  p(0xf4f0e8, 3, -20, 7, 1);
  p(OUTLINE, -17, -13, 9, 6);
  p(STAGE.steel, -16, -12, 7, 4);
  p(0xf4f0e8, -16, -12, 7, 1);
  // the bass drum: a plain head (no name, no logo), a dark-red shell rim
  p(OUTLINE, -9, -17, 18, 17);
  p(STAGE.banner, -8, -16, 16, 15);
  p(0xf4f0e8, -6, -14, 12, 11);
  p(0xd8d0c0, -6, -5, 12, 2);
  p(STAGE.steel, -9, -9, 1, 2);
  p(STAGE.steel, 8, -9, 1, 2);
}

/** The light rig across the top: a steel truss on two posts, four lamp cans pointing down. */
function lightRig(p: Paint, w: number): void {
  for (const x of [2, w - 6]) {
    p(OUTLINE, x - 1, 0, 6, BACKDROP_H + 4);
    p(STAGE.steel, x, 0, 4, BACKDROP_H + 4);
  }
  p(OUTLINE, 0, -2, w, 8);
  p(STAGE.steel, 1, -1, w - 2, 1);
  p(STAGE.steel, 1, 4, w - 2, 1);
  for (let x = 1; x < w - 6; x += 6) {
    p(STAGE.steelLo, x, 0, 1, 4);
    p(STAGE.steelLo, x + 1, 1, 1, 1);
    p(STAGE.steelLo, x + 2, 2, 1, 1);
    p(STAGE.steelLo, x + 3, 3, 1, 1);
  }
  LAMPS.forEach((c, k) => {
    const x = Math.round(((k + 1) * w) / (LAMPS.length + 1)) - 4;
    p(OUTLINE, x, 5, 8, 8);
    p(STAGE.gear, x + 1, 6, 6, 5);
    p(c, x + 1, 11, 6, 2);
  });
}

/**
 * The stage (decor, never a target): raised boards behind a dark skirt lit by a row of footlights, a few wooden steps
 * at the door, the « SCÈNE » plate on the skirt (sign.stage); on the boards a curtain with a plain banner, two amp
 * stacks, a drum riser with its kit, a steel light rig with four coloured lamps and their light pools on the floor.
 * Everything above the front wall fades with the roof. Returns the floor area for the band.
 */
export function buildStageFront(kit: FrontKit, s: Phaser.Scene, d: DecorDef, roofParts: RoofPart[]): StageFront {
  const b = d.footprint;
  const { r, top, front } = kit.frontPainter(b);
  const door = Math.floor(d.door.x / T) * T;
  // the skirt: black cloth over the platform's front, a wooden lip on top
  r(STAGE.skirt, b.x, top, b.w, FACADE_H - 3);
  for (let x = b.x + 3; x < b.x + b.w; x += 8) r(STAGE.skirtHi, x, top + 5, 2, FACADE_H - 9);
  r(OUTLINE, b.x, top, b.w, 1);
  r(STAGE.plankHi, b.x, top + 1, b.w, 3);
  r(STAGE.plankLo, b.x, top + 4, b.w, 1);
  // a row of footlights along the lip (warm lamps, a faint glow above each)
  for (let x = b.x + 10; x + 6 <= b.x + b.w - 6; x += 24) {
    if (x + 6 > door && x < door + T) continue;
    r(OUTLINE, x - 1, top + 5, 8, 4);
    r(STAGE.warm, x, top + 6, 6, 2);
    r(STAGE.warm, x - 2, top + 2, 10, 3, 0.25);
  }
  // wooden steps up to the stage at the door
  for (let k = 0; k < 4; k++) {
    const y = front - 6 - k * 7;
    r(OUTLINE, door + 3 + k, y - 1, T - 6 - 2 * k, 7);
    r(k % 2 ? STAGE.plank : STAGE.plankHi, door + 4 + k, y, T - 8 - 2 * k, 5);
  }
  // the plate on the skirt, west of the steps: the catalog's stage sign
  const plateW = 64;
  const px = b.x + Math.floor((door - b.x) / 2) - plateW / 2;
  r(OUTLINE, px - 1, top + 11, plateW + 2, 15);
  r(STAGE.gold, px, top + 12, plateW, 13);
  r(STAGE.banner, px + 1, top + 13, plateW - 2, 11);
  localeBound(
    s.add
      .text(px + plateW / 2, top + 19, '', { fontFamily: 'monospace', fontSize: '10px', color: '#fff2c8' })
      .setOrigin(0.5)
      .setDepth(front + 0.03),
    () => t('sign.stage'),
  );
  // a small speaker on the skirt east of the steps
  const sx = door + T + Math.floor((b.x + b.w - door - T) / 2) - 12;
  r(OUTLINE, sx - 1, top + 9, 26, 18);
  r(STAGE.gear, sx, top + 10, 24, 16);
  r(STAGE.grille, sx + 2, top + 12, 20, 12);
  for (let x = sx + 3; x < sx + 22; x += 3) r(STAGE.gear, x, top + 12, 1, 12);
  kit.windowGlow(b, STAGE.warm, 0.1);

  // the boards, the backdrop, the gear and the rig above the front wall (they fade with the roof)
  const ox = b.x;
  const oy = b.y - ROOF_OVERHANG;
  const w = b.w;
  const h = b.h - FACADE_H + ROOF_OVERHANG;
  floorAndBackdrop(roofLayer(s, roofParts, ox, oy, STAGE_DEPTH.floor), w, h);
  for (const x of [10, w - 38]) ampStack(roofLayer(s, roofParts, ox + x, oy + BACKDROP_H - 8, STAGE_DEPTH.gear));
  // the drum riser at the back, centred
  const riser = roofLayer(s, roofParts, ox + w / 2, oy + BACKDROP_H, STAGE_DEPTH.gear);
  riser(OUTLINE, -36, 0, 72, 22);
  riser(STAGE.plankLo, -35, 0, 70, 21);
  riser(STAGE.plank, -35, 0, 70, 2);
  riser(STAGE.skirt, -35, 16, 70, 5);
  drumKit(roofLayer(s, roofParts, ox + w / 2, oy + BACKDROP_H + 26, STAGE_DEPTH.kit));
  lightRig(roofLayer(s, roofParts, ox, oy, STAGE_DEPTH.rig), w);

  // the light pools on the boards (additive), under each lamp, their alpha pulsed by the band's update
  const lights: StageLight[] = LAMPS.map((colour, k) => {
    const x = ox + Math.round(((k + 1) * w) / (LAMPS.length + 1));
    const pool = s.add
      .ellipse(x, oy + BACKDROP_H + 44 + (k % 2) * 14, 64, 30, colour, 0.26)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(STAGE_DEPTH.pools);
    roofParts.push(pool);
    return { pool, colour };
  });
  return { origin: { x: ox, y: oy }, w, h, lights };
}
