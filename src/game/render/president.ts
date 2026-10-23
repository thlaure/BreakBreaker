import Phaser from 'phaser';
import type { Vec } from '../../sim/types';
import { clampBubbleX } from './bubbleClamp';
import { BALCONY_DEPTH } from './chateauFront';
import type { Paint, RoofPart } from './decor';
import { DEPTH } from './depth';
import {
  MOODS,
  agitation,
  initPresident,
  poseFrame,
  presidentBob,
  presidentRng,
  stepPresident,
  type Mood,
  type PresidentState,
} from './presidentMath';

const INK = 0x14121c;
/** A generic fictional President: navy suit, white shirt, red tie, plain short hair. No real model. */
const LOOK = {
  suit: 0x2a4a9a,
  suitLo: 0x1c3070,
  suitHi: 0x4062b8,
  shirt: 0xf4f4f0,
  tie: 0xc4372b,
  skin: 0xe8b890,
  skinLo: 0xc89470,
  flushed: 0xe88a6a,
  hair: 0x6a5f55,
  tear: 0x6ac8ff,
} as const;

/** Pixel font of the bubbles (as the crowd's), with a monospace fallback. */
const BUBBLE_FONT = '"Press Start 2P", ui-monospace, monospace';
const BUBBLE_PAD = 3;
/** The bubble wraps its quote at this width (px, before scaling). */
const BUBBLE_WRAP = 132;
/** Tail tip of the bubble above the balcony floor (px): just over his head. */
const BUBBLE_Y = -42;
/** Area (relative to the balcony floor) holding the figure and its bubble; off the camera view, nothing runs. */
const CULL = { x: -110, y: -150, w: 220, h: 170 } as const;

/** Head, shirt, tie and jacket; `face` is the skin of the face (flushed when angry). */
function body(p: Paint, face: number): void {
  p(INK, -7, -23, 14, 23);
  p(LOOK.suit, -6, -22, 12, 22);
  p(LOOK.suitLo, -6, -22, 2, 22);
  p(LOOK.suitHi, 4, -22, 1, 22);
  p(LOOK.shirt, -2, -22, 4, 4);
  p(LOOK.shirt, -1, -18, 2, 2);
  p(LOOK.tie, -1, -21, 2, 8);
  p(LOOK.tie, 0, -13, 1, 1);
  p(LOOK.skinLo, -1, -24, 2, 2); // neck
  p(INK, -5, -33, 10, 10);
  p(face, -4, -32, 8, 9);
  p(face, -5, -29, 1, 2); // ears
  p(face, 4, -29, 1, 2);
  p(LOOK.hair, -4, -33, 8, 2); // plain short hair
  p(LOOK.hair, -5, -32, 1, 2);
  p(LOOK.hair, 4, -32, 1, 2);
}

/** An arm hanging down on side `s` (-1 west, +1 east). */
function armDown(p: Paint, s: -1 | 1): void {
  const x = s < 0 ? -9 : 7;
  p(INK, x - 1, -22, 4, 12);
  p(LOOK.suit, x, -21, 2, 10);
}

/** An arm raised in a V on side `s`, `spread` px outward per step, with an open hand at the top. */
function armUp(p: Paint, s: -1 | 1, spread: number): void {
  for (let k = 0; k < 4; k++) {
    const x = s < 0 ? -8 - Math.round(k * spread) : 6 + Math.round(k * spread);
    p(INK, x - 1, -24 - k * 3, 4, 5);
    p(LOOK.suit, x, -23 - k * 3, 2, 4);
  }
  const hx = s < 0 ? -9 - Math.round(4 * spread) : 6 + Math.round(4 * spread);
  p(INK, hx - 1, -38, 5, 5);
  p(LOOK.skin, hx, -37, 3, 3);
}

/** One frame of a mood (local px, feet at the balcony floor centre 0,0). */
function drawPose(p: Paint, mood: Mood, frame: 0 | 1): void {
  if (mood === 'arms') {
    // both arms up, waving: wide, then nearly straight
    body(p, LOOK.skin);
    armUp(p, -1, frame ? 0.5 : 1.25);
    armUp(p, 1, frame ? 1.25 : 0.5);
    p(INK, -2, -29, 1, 1);
    p(INK, 1, -29, 1, 1);
    p(INK, -1, -27, 2, 2); // shouting « oh ! »
  } else if (mood === 'cry') {
    // a handkerchief at the eyes, mouth down, tears dripping
    body(p, LOOK.skin);
    armDown(p, 1);
    p(INK, -9, -23, 4, 7);
    p(LOOK.suit, -8, -22, 2, 5);
    p(INK, -7, -29, 4, 8);
    p(LOOK.suit, -6, -28, 2, 6);
    p(INK, -7, -32, 5, 5);
    p(0xffffff, -6, -31, 3, 3); // handkerchief
    p(INK, 1, -29, 2, 1); // eye shut
    p(INK, -2, -26, 4, 1);
    p(INK, -3, -25, 1, 1);
    p(INK, 2, -25, 1, 1);
    p(LOOK.tear, 2, frame ? -26 : -28, 1, 2);
    p(LOOK.tear, 3, frame ? -22 : -24, 1, 1);
    p(LOOK.tear, -4, frame ? -24 : -26, 1, 1);
  } else if (mood === 'angry') {
    // flushed, frowning, a fist shaking over his head, the other hand on the hip
    body(p, LOOK.flushed);
    const dy = frame ? -2 : 0;
    p(INK, 6, -27 + dy, 4, 7);
    p(LOOK.suit, 7, -26 + dy, 2, 5);
    p(INK, 7, -33 + dy, 4, 7);
    p(LOOK.suit, 8, -32 + dy, 2, 5);
    p(INK, 6, -37 + dy, 6, 5);
    p(LOOK.skin, 7, -36 + dy, 4, 3); // fist
    p(INK, -10, -21, 4, 7);
    p(LOOK.suit, -9, -20, 2, 5);
    p(INK, -3, -31, 1, 1); // brows slanted down to the nose
    p(INK, -2, -30, 1, 1);
    p(INK, 2, -31, 1, 1);
    p(INK, 1, -30, 1, 1);
    p(INK, -2, -29, 1, 1);
    p(INK, 1, -29, 1, 1);
    p(INK, -2, -26, 4, 2);
    p(0xffffff, -1, -26, 2, 1); // gritted teeth
    p(LOOK.tie, -10, -36 - (frame ? 1 : 0), 1, 3); // a red anger mark
    p(LOOK.tie, -11, -35 - (frame ? 1 : 0), 3, 1);
  } else {
    // calm: arms down, a contented smile
    body(p, LOOK.skin);
    armDown(p, -1);
    armDown(p, 1);
    p(INK, -2, -29, 1, 1);
    p(INK, 1, -29, 1, 1);
    p(INK, -2, -26, 4, 1);
    p(INK, -3, -27, 1, 1);
    p(INK, 2, -27, 1, 1);
  }
}

/** Pixel speech bubble (white, 1 px navy border, stepped tail pointing down), origin at the tail tip; wraps its quote. */
class QuoteBubble {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private quote: string | null = null;
  /** Half width of the drawn bubble (px, before scaling), for keeping it inside the screen. */
  private halfW = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', {
      fontFamily: BUBBLE_FONT,
      fontSize: '8px',
      color: '#1c3070',
      align: 'center',
      lineSpacing: 2,
      wordWrap: { width: BUBBLE_WRAP },
    });
    this.root = scene.add.container(0, 0, [this.g, this.text]).setDepth(DEPTH.overlay).setVisible(false);
  }

  set(quote: string | null): void {
    if (quote === this.quote) return;
    this.quote = quote;
    this.root.setVisible(quote !== null);
    if (quote === null) return;
    // French spacing: never wrap a lone « ! » or « ? » onto its own line
    this.text.setText(quote.replace(/ ([!?:;])/g, ' $1'));
    this.text.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const bw = Math.ceil(this.text.width) + 2 * BUBBLE_PAD;
    const bh = Math.ceil(this.text.height) + 2 * BUBBLE_PAD;
    const left = -Math.floor(bw / 2);
    const top = -(bh + 4);
    this.halfW = Math.ceil(bw / 2) + 1;
    const g = this.g.clear();
    g.fillStyle(LOOK.suitLo, 1).fillRect(left - 1, top - 1, bw + 2, bh + 2);
    g.fillStyle(0xffffff, 1).fillRect(left, top, bw, bh);
    for (let i = 0; i < 4; i++) {
      const dark = 7 - 2 * i;
      g.fillStyle(LOOK.suitLo, 1).fillRect(-Math.floor(dark / 2), -4 + i, dark, 1);
      const white = dark - 2;
      if (white > 0) g.fillStyle(0xffffff, 1).fillRect(-Math.floor(white / 2), -4 + i, white, 1);
    }
    this.text.setPosition(left + BUBBLE_PAD, top + BUBBLE_PAD);
  }

  /** Whole-number scale keeps the bubble crisp and readable at camera zoom 1 and 2 (as the crowd's). */
  place(x: number, y: number): void {
    const cam = this.root.scene.cameras.main;
    const scale = Math.max(1, Math.round(2 / (cam.zoom || 1)));
    const cx = clampBubbleX(x, this.halfW * scale, cam.worldView.x, cam.worldView.right);
    this.root.setPosition(Math.round(cx), Math.round(y)).setScale(scale);
  }
}

/**
 * The fictional President on the château balcony (render only): four moods in a loop (arms up waving, crying, angry,
 * calm), a quote bubble every 8–14 s from the dictionary, more agitated when Paul is within 6 tiles; drawn between the
 * French window and the balustrade. Nothing is drawn or stepped while the balcony is off the camera view. Reduced
 * motion: one frozen pose, the bubbles still come.
 */
export class PresidentView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frames = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly bubble: QuoteBubble;
  private readonly rand: () => number;
  private state: PresidentState | null = null;
  private shown: Phaser.GameObjects.Graphics | null = null;
  private readonly cull: Phaser.Geom.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly balcony: Vec,
    roofParts: RoofPart[],
    private readonly reducedMotion: boolean,
    seed: number,
  ) {
    this.rand = presidentRng(seed);
    const gs: Phaser.GameObjects.Graphics[] = [];
    for (const mood of MOODS)
      for (const frame of [0, 1] as const) {
        const g = scene.add.graphics().setVisible(false);
        drawPose((c, x, y, w, h, a = 1) => void g.fillStyle(c, a).fillRect(x, y, w, h), mood, frame);
        this.frames.set(`${mood}${frame}`, g);
        gs.push(g);
      }
    this.root = scene.add.container(balcony.x, balcony.y, gs).setDepth(BALCONY_DEPTH.figure).setVisible(false);
    roofParts.push(this.root); // fades with the château roof, like the balcony
    this.bubble = new QuoteBubble(scene);
    this.cull = new Phaser.Geom.Rectangle(balcony.x + CULL.x, balcony.y + CULL.y, CULL.w, CULL.h);
  }

  update(feet: Vec, timeMs: number): void {
    if (!Phaser.Geom.Rectangle.Overlaps(this.scene.cameras.main.worldView, this.cull)) {
      this.root.setVisible(false);
      this.bubble.set(null);
      return;
    }
    this.state ??= initPresident(this.rand, timeMs);
    const s = this.state;
    stepPresident(s, this.rand, timeMs, this.reducedMotion);
    const agit = agitation(Math.hypot(feet.x - this.balcony.x, feet.y - this.balcony.y));
    const frame = this.frames.get(`${s.mood}${poseFrame(timeMs, agit, this.reducedMotion)}`)!;
    if (frame !== this.shown) {
      this.shown?.setVisible(false);
      this.shown = frame.setVisible(true);
    }
    const bob = presidentBob(timeMs, s.mood, agit, this.reducedMotion);
    this.root.setVisible(true).setY(this.balcony.y + bob);
    this.bubble.set(s.quote);
    if (s.quote !== null) this.bubble.place(this.balcony.x, this.balcony.y + BUBBLE_Y + bob);
  }
}
