import Phaser from 'phaser';
import { CAID_SKINS, type CaidProp } from '../../content/caids';
import type { Snapshot } from '../../sim/sim';
import { CAID_BUBBLE_SHOW_MS, caidBubbleGap, caidSlogan, type CaidSkin } from './caidSkin';
import { SpeechBubble } from './speechBubble';

type HostileSnap = Snapshot['hostiles'][number];

const PAL: Record<string, number> = {
  K: 0x14121c,
  W: 0xf4f1e8,
  C: 0xefe6cf,
  c: 0xc9bd9c,
  R: 0xd23b3b,
  r: 0x9e2a2a,
  g: 0xc9ced6,
  G: 0x8a94a3,
  B: 0x6b4a2f,
  b: 0x8c6a46,
  // the tribun's raised fist: his skin tone (protester_1) and his dark jacket sleeve
  S: 0xba8454,
  s: 0x936849,
  D: 0x38352f,
  // the banderole's pole
  P: 0x5a4632,
  p: 0x7a5f45,
};

/** Megaphone (pointing east): grey handle, white cone, red rim. */
const MEGAPHONE = [
  '........KK',
  '......KKRK',
  '....KKWWRK',
  'KKKKWWWWRK',
  'KggKWWWWRK',
  'KKKKWWWWRK',
  '..K.KKWWRK',
  '..K...KKRK',
  '..KK....KK',
];
/** The tribun's raised fist (sleeve below). */
const FIST = ['.KKKK.', 'KSSSSK', 'KSsSsK', 'KSSSSK', '.KDDK.', ...Array.from({ length: 8 }, () => 'KDDDDK'), '.KKKK.'];
/** A generic banderole: cream cloth, red hems and red scribbles (no word, no emblem). */
const CLOTH = [
  'KKKKKKKKKKKKKKKKKK',
  'KRRRRRRRRRRRRRRRRK',
  'KCCCCCCCCCCCCCCCCK',
  'KCRRCCRRRCCRRCCRCK',
  'KCCCCCCCCCCCCCCCCK',
  'KCRRRCCRRCCRRRCCCK',
  'KCCCCCCCCCCCCCCCCK',
  'KRRRRRRRRRRRRRRRRK',
  'KKKKKKKKKKKKKKKKKK',
];
/** Pole length below the cloth (px). */
const POLE_BELOW = 22;
/** The banderole on its 2-px pole (pole on the left, cloth to the right; the hand holds the pole's foot). */
export const BANNER = [...CLOTH.map((r) => `Pp${r}`), ...Array.from({ length: POLE_BELOW }, () => `Pp${'.'.repeat(CLOTH[0]!.length)}`)];
/** A roll of posters (red band). */
const POSTERS = ['.KKKKKKKKKKKK.', 'KCCCCRRCCCCCCK', 'KCCCCRRCCCCCcK', 'KcccCRRCcccccK', '.KKKKKKKKKKKK.'];

/** 3×5 glyphs of the briefcase label (É has its accent on the label's top row). */
const GLYPHS: Record<string, string[]> = {
  C: ['.##', '#..', '#..', '#..', '.##'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
};

/** A brown briefcase with a cream label « COMITÉ » (27×15). */
export function briefcaseRows(): string[] {
  const word = ['C', 'O', 'M', 'I', 'T', 'E'];
  const w = 2 + 2 + word.length * 4 - 1 + 2;
  const rows: string[][] = [];
  const line = (ch: string): string[] => Array.from({ length: w }, (_, x) => (x === 0 || x === w - 1 ? 'K' : ch));
  const handle = Array.from({ length: w }, (_, x) => (Math.abs(x - (w - 1) / 2) <= 4 ? 'K' : '.'));
  const handleIn = handle.map((c, x) => (c === 'K' && Math.abs(x - (w - 1) / 2) <= 2 ? '.' : c));
  rows.push(
    handle,
    handleIn,
    Array.from({ length: w }, () => 'K'),
    line('b'),
  );
  for (let y = 0; y < 7; y++) {
    const r = line('B');
    for (let x = 2; x < w - 2; x++) r[x] = 'C';
    rows.push(r);
  }
  // the accent of the É, then the letters, on the label (rows 4..10)
  const ex = 3 + 5 * 4;
  rows[4]![ex + 1] = 'K';
  rows[4]![ex + 2] = 'K';
  word.forEach((ch, i) => {
    GLYPHS[ch]!.forEach((g, gy) => {
      for (let gx = 0; gx < 3; gx++) if (g[gx] === '#') rows[5 + gy]![3 + i * 4 + gx] = 'K';
    });
  });
  rows.push(
    line('B'),
    line('b'),
    Array.from({ length: w }, () => 'K'),
  );
  return rows.map((r) => r.join(''));
}

/** `caid_megaphone`, `caid_fist`, `caid_banner`, `caid_briefcase`, `caid_posters` (pixel rows drawn at runtime). */
export function makeCaidPropTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('caid_megaphone')) return;
  const g = scene.make.graphics({}, false);
  for (const [key, rows] of [
    ['caid_megaphone', MEGAPHONE],
    ['caid_fist', FIST],
    ['caid_banner', BANNER],
    ['caid_briefcase', briefcaseRows()],
    ['caid_posters', POSTERS],
  ] as const) {
    g.clear();
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = PAL[row[x]!];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      }
    });
    g.generateTexture(key, rows[0]!.length, rows.length);
  }
  g.destroy();
}

/** Bubble tail tip above the feet: over the crown and the HP bar of a ×1.5 Caïd. */
const BUBBLE_LIFT = 92;
/** A Caïd's slogans: ink text, red border; long lines wrap to two (about 20 characters each). */
const SLOGAN_COLOR = '#14121c';
const SLOGAN_BORDER = 0xd23b3b;
const SLOGAN_WRAP_PX = 168;

/**
 * A Caïd's look on the street (render only): his prop (megaphone, banderole, briefcase, roll of posters; the briscard's
 * whistle is painted on his sheet) and, now and then while he stands on screen, one of his slogans in a speech bubble;
 * the tribun raises the megaphone and a fist while he speaks. Everything hides on a KO body.
 */
export class CaidLookView {
  private readonly prop: Phaser.GameObjects.Image | null;
  private readonly fist: Phaser.GameObjects.Image | null;
  private readonly bubble: SpeechBubble;
  private readonly kind: CaidProp;
  private nextAt = -1;
  private until = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly skin: CaidSkin,
    private readonly size: number,
    private readonly rng: () => number = Math.random,
  ) {
    makeCaidPropTextures(scene);
    this.kind = CAID_SKINS[skin]!.prop;
    const key = this.kind === 'whistle' ? null : `caid_${this.kind}`;
    this.prop = key ? scene.add.image(0, 0, key).setScale(this.kind === 'briefcase' ? 1 : size) : null;
    this.fist = this.kind === 'megaphone' ? scene.add.image(0, 0, 'caid_fist').setOrigin(0.5, 1).setScale(size) : null;
    this.bubble = new SpeechBubble(scene);
  }

  update(h: HostileSnap, sprite: Phaser.GameObjects.Sprite, nowMs: number): void {
    const up = h.state !== 'ko' && sprite.visible;
    const speaking = this.voice(h, sprite, nowMs, up);
    this.prop?.setVisible(up);
    this.fist?.setVisible(up && speaking);
    if (!up) return;
    const s = this.size;
    const side = h.facing.x < -0.1 ? -1 : 1;
    const back = h.facing.y < -0.5;
    const d = sprite.depth + (back ? -0.04 : 0.04);
    const x = Math.round(sprite.x);
    const y = Math.round(sprite.y);
    const p = this.prop;
    if (!p) return;
    p.setFlipX(side < 0).setDepth(d);
    if (this.kind === 'megaphone') {
      // raised to the mouth while he speaks, else held down at his side
      p.setOrigin(side < 0 ? 1 : 0, 0.5);
      if (speaking) p.setPosition(x + side * Math.round(6 * s), y - Math.round(29 * s)).setAngle(side * -10);
      else p.setPosition(x + side * Math.round(9 * s), y - Math.round(17 * s)).setAngle(side * 60);
      // the other arm raised from the shoulder, fist up
      this.fist?.setPosition(x - side * Math.round(10 * s), y - Math.round(25 * s)).setDepth(d);
    } else if (this.kind === 'banner') {
      // held up on the side away from the facing (like the rioters' flags), the cloth further out
      const away = side > 0 ? -1 : 1;
      const w = BANNER[0]!.length;
      p.setFlipX(away < 0)
        .setOrigin(away < 0 ? (w - 1) / w : 1 / w, 1)
        .setPosition(x + away * Math.round(10 * s), y - Math.round(12 * s))
        .setAngle(0);
    } else if (this.kind === 'briefcase') {
      p.setOrigin(0.5, 0)
        .setFlipX(false)
        .setPosition(x + side * Math.round(11 * s), y - Math.round(17 * s))
        .setAngle(0);
    } else {
      // posters: under the arm, along the body
      p.setOrigin(0.5, 0.5)
        .setPosition(x + side * Math.round(9 * s), y - Math.round(19 * s))
        .setAngle(side * -20);
    }
  }

  /** The slogan timer: true while a slogan is shown. Never shown off screen or on a KO body (it waits). */
  private voice(h: HostileSnap, sprite: Phaser.GameObjects.Sprite, nowMs: number, up: boolean): boolean {
    if (this.nextAt < 0) this.nextAt = nowMs + 1500 + Math.round(this.rng() * 2500);
    const cam = sprite.scene.cameras.main;
    const view = cam.worldView;
    const onScreen = sprite.x >= view.x && sprite.x <= view.right && sprite.y - BUBBLE_LIFT >= view.y && sprite.y <= view.bottom;
    if (!up || !onScreen) {
      if (this.until > nowMs) this.until = nowMs;
      this.bubble.say(null);
      if (nowMs >= this.nextAt) this.nextAt = nowMs + 1000;
      return false;
    }
    if (nowMs >= this.nextAt && nowMs >= this.until) {
      this.until = nowMs + CAID_BUBBLE_SHOW_MS;
      this.nextAt = this.until + caidBubbleGap(this.rng());
      this.bubble.say({ text: caidSlogan(this.skin, this.rng()), color: SLOGAN_COLOR, border: SLOGAN_BORDER, wrapPx: SLOGAN_WRAP_PX });
    }
    if (nowMs >= this.until) {
      this.bubble.say(null);
      return false;
    }
    this.bubble.place(sprite.x, sprite.y - BUBBLE_LIFT);
    return h.state !== 'ko';
  }

  destroy(): void {
    this.prop?.destroy();
    this.fist?.destroy();
    this.bubble.destroy();
  }
}
