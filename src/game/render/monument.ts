import Phaser from 'phaser';
import { DISTRICT } from '../../sim/map/district';
import type { Snapshot } from '../../sim/sim';
import type { MonumentFlag, SimEvent } from '../../sim/types';
import { DEPTH } from './depth';

const OUTLINE = 0x14121c;
/** Drawn from 1-px logical textures scaled ×2, like the props. */
const PX = 2;
/** Statue texture: plinth + horse + rider + flagpole, logical px. */
const W = 32;
const H = 60;
/** Flag cloth (logical px) and its frame (one extra row for the wave). */
const FW = 12;
const FH = 9;
const WAVE_FRAMES = 3;
const WAVE_MS = 160;
/** The flag drops, then the other one rises (whole swap). */
const SWAP_MS = 500;
/** Hoist (top-left of the cloth) in statue logical px: just right of the pole, near its top. */
const HOIST = { x: 20, y: 1 };
const DROP = 24;

type Snap = Snapshot['monument'];

/**
 * Runtime textures: `statue` (stone plinth with a blank bronze plaque, a dark bronze horse and its rider holding a
 * flagpole; original art) and the waving cloths `mflag_french_0..2` (tricolour #0055a4 / white / #ef4135) and
 * `mflag_palestinian_0..2` (black / white / green stripes, red triangle at the hoist). Cosmetic only.
 */
export function makeMonumentTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('statue')) return;
  const g = scene.make.graphics({}, false);
  const r = (c: number, x: number, y: number, w: number, h: number): void => {
    g.fillStyle(c, 1).fillRect(x, y, w, h);
  };

  // --- plinth: top face, cornice, front face, plaque
  r(OUTLINE, 0, 37, 32, 23);
  r(0xc9c1b0, 1, 38, 30, 5); // top face
  r(0xe0d9ca, 1, 38, 30, 1);
  r(OUTLINE, 0, 43, 32, 1);
  r(0xb3ab9a, 1, 44, 30, 2); // cornice
  r(0x8f887a, 1, 46, 30, 1);
  r(0xa49c8c, 2, 47, 28, 12); // front face
  r(0x8f887a, 2, 57, 28, 2);
  r(0xb8b0a0, 2, 47, 1, 12);
  r(0x6e685c, 29, 47, 1, 12);
  r(OUTLINE, 10, 49, 12, 6); // plaque (blank)
  r(0x8a6a3a, 11, 50, 10, 4);
  r(0xb08a4e, 11, 50, 10, 1);
  // stone joints
  r(0x8f887a, 6, 52, 3, 1);
  r(0x8f887a, 24, 51, 3, 1);

  // --- horse (dark bronze, facing east), standing on the plinth top
  const B = 0x4a3a28;
  const BH = 0x6e5838;
  const BS = 0x2e2418;
  // legs
  for (const lx of [8, 11, 19, 22]) {
    r(OUTLINE, lx - 1, 29, 4, 11);
    r(B, lx, 30, 2, 9);
    r(BS, lx, 38, 2, 1);
  }
  // tail
  r(OUTLINE, 3, 22, 4, 10);
  r(BS, 4, 23, 2, 8);
  // body
  r(OUTLINE, 6, 21, 19, 10);
  r(B, 7, 22, 17, 8);
  r(BH, 7, 22, 17, 2);
  r(BS, 7, 28, 17, 2);
  // neck and head (raised)
  r(OUTLINE, 20, 14, 6, 9);
  r(B, 21, 15, 4, 7);
  r(BH, 21, 15, 1, 6);
  r(OUTLINE, 23, 12, 7, 6);
  r(B, 24, 13, 5, 4);
  r(BH, 24, 13, 5, 1);
  r(OUTLINE, 23, 11, 2, 2); // ear
  r(BS, 28, 15, 1, 1); // nostril
  r(OUTLINE, 22, 14, 1, 1); // mane notch

  // --- rider: leg along the flank, torso, head with a cap, arm up holding the pole
  r(OUTLINE, 13, 13, 6, 13);
  r(B, 14, 14, 4, 11);
  r(BH, 14, 14, 1, 10);
  r(B, 15, 25, 2, 4); // leg
  r(OUTLINE, 14, 29, 4, 1); // boot
  r(OUTLINE, 13, 8, 6, 6); // head
  r(B, 14, 9, 4, 4);
  r(BH, 14, 9, 4, 1);
  r(OUTLINE, 12, 7, 8, 2); // cap brim
  r(BS, 13, 6, 6, 1);
  r(OUTLINE, 17, 11, 3, 6); // raised arm
  r(B, 18, 12, 1, 4);
  // flagpole (light metal) with a gilded finial
  r(0x9aa0aa, 19, 1, 1, 15);
  r(0xd8dce4, 19, 1, 1, 6);
  r(0xffd166, 18, 0, 3, 1);
  g.generateTexture('statue', W, H);

  // --- flags, 3 wave frames each
  const cloth = (flag: MonumentFlag, frame: number): void => {
    g.clear();
    for (let c = 0; c < FW; c++) {
      // the hoist column stays put; the fly ripples by one pixel
      const dy = c < 2 ? 0 : Math.round((Math.sin((c / FW) * Math.PI * 2 - (frame * Math.PI * 2) / WAVE_FRAMES) + 1) / 2);
      for (let row = 0; row < FH; row++) {
        let col: number;
        if (flag === 'french') col = c < 4 ? 0x0055a4 : c < 8 ? 0xffffff : 0xef4135;
        else {
          col = row < 3 ? 0x101010 : row < 6 ? 0xffffff : 0x149954;
          // red triangle at the hoist, apex at mid-height
          if (c <= 4 - Math.abs(row - 4)) col = 0xe4312b;
        }
        // a darker fold every other column for a cloth feel
        if (c > 1 && (c + frame) % 4 === 0) col = Phaser.Display.Color.ValueToColor(col).darken(12).color;
        r(col, c, row + dy, 1, 1);
      }
    }
    g.generateTexture(`mflag_${flag}_${frame}`, FW, FH + 1);
  };
  for (const f of ['french', 'palestinian'] as const) for (let k = 0; k < WAVE_FRAMES; k++) cloth(f, k);
  g.destroy();
}

/**
 * The equestrian monument: statue on its plinth, the waving flag (swap: the old one drops, the other rises), the
 * ground ring of the capture zone (neutral while French; red while Palestinian, hatched when contested, with an arc
 * filling as the capture progresses) and a sparkle on capture.
 */
export class MonumentView {
  private readonly flagImg: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly hoist: { x: number; y: number };
  private shown: MonumentFlag = 'french';
  /** Flag being raised by a swap, and when the swap began (render ms). */
  private swapTo: MonumentFlag | null = null;
  private swapAt = 0;
  private ringKey = '';

  constructor(scene: Phaser.Scene) {
    const P = DISTRICT.monument.plinth;
    const bottom = P.y + P.h;
    const left = P.x + P.w / 2 - (W * PX) / 2;
    const top = bottom - H * PX;
    this.ring = scene.add.graphics().setDepth(DEPTH.decal + 2);
    scene.add.ellipse(P.x + P.w / 2, bottom - 2, P.w + 10, 14, 0x000000, 0.28).setDepth(DEPTH.decal);
    scene.add.image(left, top, 'statue').setOrigin(0, 0).setScale(PX).setDepth(bottom);
    this.hoist = { x: left + HOIST.x * PX, y: top + HOIST.y * PX };
    this.flagImg = scene.add
      .image(this.hoist.x, this.hoist.y, 'mflag_french_0')
      .setOrigin(0, 0)
      .setScale(PX)
      .setDepth(bottom + 0.1);
    this.sparkle = scene.add
      .particles(0, 0, 'px', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 50, max: 140 },
        angle: { min: 200, max: 340 },
        gravityY: 200,
        scale: { start: 2, end: 0 },
        tint: [0x0055a4, 0xffffff, 0xef4135, 0xffe066],
        emitting: false,
      })
      .setDepth(DEPTH.roof + 3);
  }

  update(m: Snap, nowMs: number): void {
    if (m.flag !== this.shown && this.swapTo !== m.flag) {
      this.swapTo = m.flag;
      this.swapAt = nowMs;
    }
    const frame = Math.floor(nowMs / WAVE_MS) % WAVE_FRAMES;
    let flag = this.shown;
    let drop = 0;
    let alpha = 1;
    if (this.swapTo) {
      const t = Math.min(1, (nowMs - this.swapAt) / SWAP_MS);
      if (t < 0.5) {
        // the flag slides down the pole and fades
        drop = DROP * (t / 0.5);
        alpha = 1 - t / 0.5;
      } else {
        // the other one rises
        flag = this.swapTo;
        drop = DROP * (1 - (t - 0.5) / 0.5);
        alpha = (t - 0.5) / 0.5;
      }
      if (t >= 1) {
        this.shown = this.swapTo;
        this.swapTo = null;
        flag = this.shown;
        drop = 0;
        alpha = 1;
      }
    }
    this.flagImg
      .setTexture(`mflag_${flag}_${frame}`)
      .setPosition(this.hoist.x, Math.round(this.hoist.y + drop))
      .setAlpha(alpha);
    this.drawRing(m, nowMs);
  }

  onEvent(e: SimEvent): void {
    if (e.type === 'FlagCaptured') this.sparkle.emitParticleAt(this.hoist.x + (FW * PX) / 2, this.hoist.y + 8, 36);
  }

  private drawRing(m: Snap, nowMs: number): void {
    const z = m.zone;
    const lost = m.flag === 'palestinian';
    const frac = lost ? m.capture / m.captureSec : 0;
    // contested hatching crawls slowly; everything else is static (redrawn only when it changes)
    const crawl = lost && m.contested ? Math.floor(nowMs / 200) % 4 : 0;
    const key = `${lost ? 1 : 0}:${m.contested ? 1 : 0}:${Math.round(frac * 60)}:${crawl}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    const g = this.ring.clear();
    if (!lost) {
      // neutral: a faint paved circle
      g.lineStyle(2, 0xf4ecd8, 0.18).strokeCircle(z.x, z.y, z.r);
      return;
    }
    g.fillStyle(0xc4372b, 0.07).fillCircle(z.x, z.y, z.r);
    g.lineStyle(2, 0xc4372b, 0.6).strokeCircle(z.x, z.y, z.r);
    if (m.contested) {
      // red hatch marks around the band
      g.lineStyle(2, 0xff5a3c, 0.75);
      const n = 36;
      for (let k = 0; k < n; k++) {
        const a = ((k + crawl / 4) / n) * Math.PI * 2;
        const x0 = z.x + Math.cos(a) * (z.r - 8);
        const y0 = z.y + Math.sin(a) * (z.r - 8);
        const a1 = a + 0.06;
        g.lineBetween(x0, y0, z.x + Math.cos(a1) * (z.r + 2), z.y + Math.sin(a1) * (z.r + 2));
      }
    }
    if (frac > 0) {
      // capture arc from the top, clockwise, in the tricolour's blue and white
      const start = -Math.PI / 2;
      g.lineStyle(6, 0x0f1630, 0.5)
        .beginPath()
        .arc(z.x, z.y, z.r - 4, start, start + frac * Math.PI * 2)
        .strokePath();
      g.lineStyle(4, 0x5a9cff, 0.95)
        .beginPath()
        .arc(z.x, z.y, z.r - 4, start, start + frac * Math.PI * 2)
        .strokePath();
      g.lineStyle(2, 0xffffff, 0.9)
        .beginPath()
        .arc(z.x, z.y, z.r - 4, start, start + frac * Math.PI * 2)
        .strokePath();
    }
  }
}
