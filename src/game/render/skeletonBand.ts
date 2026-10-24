import Phaser from 'phaser';
import { t } from '../../content/i18n';
import { STAGE_LYRIC_COUNT, stageLyricKey } from '../../content/stage';
import type { DecorAnim, Paint, RoofPart } from './decor';
import { presidentRng } from './presidentMath';
import { SpeechBubble } from './speechBubble';
import { BACKDROP_H, STAGE, STAGE_DEPTH, type StageFront } from './stageFront';
import { headBang, initSinger, lightPulse, stepSinger, swayOffset, type SingerState } from './stageMath';

const INK = 0x14121c;
const BONE = 0xeee8d8;
const BONE_LO = 0xb8b0a0;
const JEANS = 0x2a2e44;
const JACKET = 0x24222a;
const JACKET_HI = 0x3e3a48;
const STUD = 0xc8ccd4;
const WOOD = 0xb07a40;
const SHADES = 0x0c0c12;

/** Which instrument a skeleton plays. */
type Role = 'singer' | 'guitar' | 'bass' | 'drums';

/**
 * One invented musician: a role, a spot on the boards (local px from the floor area's top-left, feet), a bandana colour
 * (none: bare skull), sunglasses or not, the instrument colour. Generic rock outfits only: black jacket with studs, dark
 * jeans, boots; nothing written anywhere, no real musician's look.
 */
interface Member {
  role: Role;
  x: number;
  y: number;
  bandana: number | null;
  shades: boolean;
  colour: number;
}

/** Floor-local spots of the five skeletons: the drummer behind the kit, three players, the singer at the front. */
function lineUp(w: number): Member[] {
  return [
    { role: 'drums', x: w / 2, y: BACKDROP_H + 20, bandana: 0xe8762a, shades: false, colour: 0 },
    { role: 'guitar', x: 52, y: 108, bandana: 0x8a3ac8, shades: false, colour: 0xc8343c },
    { role: 'guitar', x: w - 88, y: 94, bandana: null, shades: true, colour: 0xe8e4dc },
    { role: 'bass', x: w - 50, y: 110, bandana: 0x2e6ad8, shades: true, colour: 0x2a4a8a },
    { role: 'singer', x: w / 2, y: 134, bandana: 0xc8343c, shades: true, colour: 0 },
  ];
}

/** Boots, ripped jeans, a studded belt, the open black jacket over the rib cage, a bony neck (feet at 0,0). */
function body(p: Paint): void {
  p(0x000000, -7, -1, 14, 2, 0.3);
  p(INK, -6, -3, 5, 3);
  p(INK, 1, -3, 5, 3);
  p(STUD, -5, -2, 1, 1);
  p(STUD, 4, -2, 1, 1);
  p(INK, -5, -13, 4, 10);
  p(INK, 1, -13, 4, 10);
  p(JEANS, -4, -12, 2, 9);
  p(JEANS, 2, -12, 2, 9);
  p(BONE, -4, -8, 2, 1); // a ripped knee
  p(INK, -6, -15, 12, 3);
  for (const x of [-4, -1, 2]) p(STUD, x, -14, 1, 1);
  p(INK, -7, -26, 14, 12);
  p(JACKET, -6, -25, 12, 10);
  p(BONE, -2, -25, 4, 10); // the rib cage in the open jacket
  for (const y of [-23, -21, -19]) p(INK, -2, y, 4, 1);
  p(BONE_LO, 0, -25, 1, 10);
  p(JACKET_HI, -3, -25, 1, 8); // lapels
  p(JACKET_HI, 2, -25, 1, 8);
  for (const x of [-6, -4, 3, 5]) p(STUD, x, -25, 1, 1); // studded shoulders
  p(BONE, -1, -28, 2, 3);
}

/** A sleeve hanging down on side `s` (-1 west, +1 east) with a bony hand. */
function armDown(p: Paint, s: -1 | 1): void {
  const x = s < 0 ? -9 : 6;
  p(INK, x, -25, 3, 10);
  p(JACKET, x + 1, -24, 1, 8);
  p(BONE, x, -15, 2, 2);
}

/** A guitar (or a longer-necked bass) slung across the body, the neck rising west, the strumming hand on it. */
function instrument(p: Paint, colour: number, neck: number): void {
  p(INK, -1, -20, 10, 8);
  p(colour, 0, -19, 8, 6);
  p(INK, 3, -17, 3, 1);
  p(INK, 2, -15, 4, 1);
  for (let k = 0; k < neck; k++) {
    p(INK, -2 - 2 * k, -21 - k, 3, 2);
    p(WOOD, -2 - 2 * k, -21 - k, 2, 1);
  }
  p(INK, -3 - 2 * neck, -22 - neck, 3, 3); // headstock
  // the fretting arm along the neck, the strumming hand on the body
  p(INK, -9, -25, 3, 6);
  p(JACKET, -8, -24, 1, 4);
  p(BONE, -10, -20, 2, 2);
  p(INK, 6, -25, 3, 7);
  p(JACKET, 7, -24, 1, 5);
  p(BONE, 5, -17, 2, 2);
}

/** Drumsticks raised in both bony hands. */
function sticks(p: Paint): void {
  for (const s of [-1, 1] as const) {
    const x = s < 0 ? -10 : 7;
    p(INK, x, -29, 3, 6);
    p(JACKET, x + 1, -28, 1, 4);
    p(BONE, x, -31, 2, 2);
    p(WOOD, s < 0 ? x - 2 : x + 2, -36, 1, 6);
  }
}

/** A mic stand in front of the singer, east of him, his bony hand gripping it; the other arm hangs down. */
function micStand(p: Paint): void {
  armDown(p, -1);
  p(INK, 5, -1, 7, 1);
  p(STAGE.steelLo, 8, -28, 1, 27);
  p(STAGE.steel, 4, -29, 5, 1);
  p(INK, 2, -31, 3, 3);
  p(STUD, 2, -31, 1, 1);
  p(INK, 6, -25, 3, 7);
  p(JACKET, 7, -24, 1, 5);
  p(BONE, 7, -19, 2, 2);
}

/** The skull (it head-bangs on its own): sockets, a nose hole, teeth, an optional bandana and sunglasses. */
function skull(p: Paint, m: Member): void {
  p(INK, -5, -37, 10, 10);
  p(BONE, -4, -36, 8, 8);
  p(BONE_LO, -4, -30, 8, 1);
  p(INK, -3, -33, 2, 2);
  p(INK, 1, -33, 2, 2);
  p(INK, 0, -31, 1, 1);
  p(INK, -2, -29, 4, 1);
  p(BONE, -1, -29, 1, 1);
  p(BONE, 1, -29, 1, 1);
  if (m.shades) {
    p(SHADES, -4, -34, 8, 3);
    p(0x5a7ac8, -3, -34, 1, 1);
    p(0x5a7ac8, 2, -34, 1, 1);
  }
  if (m.bandana !== null) {
    p(m.bandana, -4, -36, 8, 2);
    p(m.bandana, 4, -35, 2, 1);
    p(m.bandana, 5, -34, 1, 2);
    p(0xffffff, -2, -36, 1, 1, 0.5);
  }
}

/** A Graphics and its painter. */
function graphics(s: Phaser.Scene): { g: Phaser.GameObjects.Graphics; p: Paint } {
  const g = s.add.graphics();
  return { g, p: (c, x, y, w, h, a = 1) => void g.fillStyle(c, a).fillRect(x, y, w, h) };
}

/** A drawn skeleton: its container (sways), its skull (head-bangs), its spot. */
interface Shown {
  root: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Graphics;
  x: number;
}

/** Bubble text colour (the dark ink of the shared bubble) and wrap width. */
const BUBBLE_COLOR = '#14121c';
const BUBBLE_WRAP = 120;
/** Tail tip of the singer's bubble above his feet (px): just over his skull. */
const BUBBLE_Y = -40;
/** Margin (px) around the stage area within which the band runs; off the camera view, nothing is drawn or stepped. */
const CULL_PAD = 60;

/**
 * The skeleton rock band on the stage (render only, its own seeded rng): a drummer behind the kit, two guitarists, a
 * bassist and the singer at the front with his mic stand, swaying gently with a tiny head-bang on the beat, under
 * coloured light pools that pulse softly. The singer sings a catalog line in the shared SpeechBubble every 6–11 s,
 * clamped to the screen and redrawn in the new language on a switch. Reduced motion: frozen poses, steady lights, the
 * bubbles still come. Off the camera view nothing is drawn or stepped.
 */
export class SkeletonBand implements DecorAnim {
  private readonly shown: Shown[] = [];
  private readonly bubble: SpeechBubble;
  private readonly rand: () => number;
  private readonly cull: Phaser.Geom.Rectangle;
  private readonly singerAt: { x: number; y: number };
  private singer: SingerState | null = null;
  private visible = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stage: StageFront,
    roofParts: RoofPart[],
    private readonly reducedMotion: boolean,
    seed: number,
  ) {
    this.rand = presidentRng(seed);
    const { origin } = stage;
    const members = lineUp(stage.w);
    for (const m of members) {
      const { g: bodyG, p } = graphics(scene);
      body(p);
      if (m.role === 'drums') sticks(p);
      else if (m.role === 'guitar') instrument(p, m.colour, 5);
      else if (m.role === 'bass') instrument(p, m.colour, 7);
      else if (m.role === 'singer') micStand(p);
      const { g: head, p: hp } = graphics(scene);
      skull(hp, m);
      const x = origin.x + m.x;
      const depth = m.role === 'drums' ? STAGE_DEPTH.back : STAGE_DEPTH.band + m.y / 10000;
      const root = scene.add
        .container(x, origin.y + m.y, [bodyG, head])
        .setDepth(depth)
        .setName('dynamic');
      roofParts.push(root);
      this.shown.push({ root, head, x });
    }
    const singer = members.find((m) => m.role === 'singer')!;
    this.singerAt = { x: origin.x + singer.x, y: origin.y + singer.y };
    this.bubble = new SpeechBubble(scene);
    this.cull = new Phaser.Geom.Rectangle(origin.x - CULL_PAD, origin.y - CULL_PAD, stage.w + 2 * CULL_PAD, stage.h + 2 * CULL_PAD);
  }

  update(timeMs: number): void {
    if (!Phaser.Geom.Rectangle.Overlaps(this.scene.cameras.main.worldView, this.cull)) {
      if (this.visible) {
        for (const m of this.shown) m.root.setVisible(false);
        this.bubble.say(null);
        this.visible = false;
      }
      return;
    }
    if (!this.visible) {
      for (const m of this.shown) m.root.setVisible(true);
      this.visible = true;
    }
    this.shown.forEach((m, k) => {
      m.root.setX(m.x + swayOffset(timeMs, k, this.reducedMotion));
      m.head.setY(headBang(timeMs, k, this.reducedMotion));
    });
    this.stage.lights.forEach((l, k) => l.pool.setFillStyle(l.colour, lightPulse(timeMs, k, this.reducedMotion)));

    this.singer ??= initSinger(timeMs);
    const s = this.singer;
    stepSinger(s, this.rand, timeMs, STAGE_LYRIC_COUNT);
    // the line is an index: read in the current language every frame, so a language switch redraws it at once
    this.bubble.say(s.lyric === null ? null : { text: t(stageLyricKey(s.lyric)), color: BUBBLE_COLOR, wrapPx: BUBBLE_WRAP });
    if (s.lyric !== null) {
      const singer = this.shown[this.shown.length - 1]!;
      this.bubble.place(singer.root.x, this.singerAt.y + BUBBLE_Y + singer.head.y);
    }
  }
}
