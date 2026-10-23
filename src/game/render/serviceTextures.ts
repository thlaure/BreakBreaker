import Phaser from 'phaser';
import type { FighterRole } from '../../sim/allies';
import { ALLY_LOOKS, OFFICER_FRAMES, officerTexture, type AllyLook, type CapShape } from './serviceMath';

const OUTLINE = 0x14121c;

type Fill = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;

/** Caps by shape (CapShape): the police képi; the guard's beret, slouched back with a badge at the front. Drawn at `ox` on the 22-px frame. */
const CAP_DRAW: Readonly<Record<CapShape, (r: Fill, look: AllyLook, ox: number, oy: number) => void>> = {
  kepi: (r, look, ox, oy) => {
    r(OUTLINE, ox + 3, oy, 8, 5);
    r(look.capColor, ox + 4, oy + 1, 6, 2);
    r(look.band, ox + 4, oy + 3, 6, 1);
    r(OUTLINE, ox + 8, oy + 4, 4, 1); // visor, facing east
    r(0xffd23f, ox + 6, oy + 1, 2, 1); // badge
  },
  beret: (r, look, ox, oy) => {
    r(OUTLINE, ox + 1, oy + 1, 10, 4);
    r(OUTLINE, ox + 2, oy, 7, 1);
    r(look.capColor, ox + 2, oy + 2, 8, 2);
    r(look.capColor, ox + 3, oy + 1, 5, 1);
    r(0xffffff, ox + 3, oy + 1, 2, 1, 0.35); // sheen on the felt
    r(OUTLINE, ox + 3, oy + 4, 8, 1); // headband
    r(look.band, ox + 8, oy + 2, 2, 2); // badge at the front
  },
};

/**
 * Runtime textures of the emergency services: the fire truck (`truck_<east|south|north>_<0|1>`, two siren-light frames;
 * west = east flipped), officers per role (`ally_<role>_<frame>`, 22 × 22 logical, facing east), the stun star and the
 * hit spark.
 */
export function makeServiceTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('truck_east_0')) return;
  const g = scene.make.graphics({}, false);
  const r: Fill = (c, x, y, w, h, a = 1) => {
    g.fillStyle(c, a).fillRect(x, y, w, h);
  };
  const RED = 0xd8312a;
  const RED_HI = 0xf2675a;
  const RED_LO = 0x9a2020;
  const GLASS = 0x9fd8ef;
  const lamp = (on: boolean): number => (on ? 0x8adcff : 0x24407a);
  const wheel = (x: number, y: number): void => {
    r(OUTLINE, x + 1, y, 6, 8);
    r(OUTLINE, x, y + 1, 8, 6);
    r(0x1d1a24, x + 1, y + 1, 6, 6);
    r(0x9aa0aa, x + 3, y + 3, 2, 2);
  };

  for (const f of [0, 1] as const) {
    // side view facing east (40 × 24): long red body, white stripe, ladder on the roof, cab at the front, blue lights
    g.clear();
    r(OUTLINE, 0, 4, 40, 16);
    r(RED, 1, 5, 27, 14);
    r(RED_HI, 1, 5, 27, 1);
    r(RED_LO, 1, 17, 27, 2);
    r(0xf4f4f0, 1, 12, 38, 2); // stripe
    for (let k = 0; k < 3; k++) {
      r(RED_LO, 3 + k * 8, 7, 7, 4); // locker doors
      r(RED_HI, 3 + k * 8, 7, 7, 1);
    }
    // ladder
    r(OUTLINE, 2, 1, 26, 4);
    r(0xb8bcc4, 3, 2, 24, 1);
    for (let k = 0; k < 7; k++) r(0xb8bcc4, 4 + k * 3, 3, 1, 1);
    // cab
    r(OUTLINE, 28, 2, 12, 18);
    r(RED, 29, 3, 10, 16);
    r(RED_HI, 29, 3, 10, 1);
    r(GLASS, 32, 5, 7, 5);
    r(0xe6f7ff, 33, 5, 2, 1);
    r(OUTLINE, 31, 5, 1, 9); // door seam
    r(0xffe066, 38, 15, 2, 2); // headlight
    r(0x9aa0aa, 38, 18, 2, 1); // bumper
    // light bar on the cab roof
    r(OUTLINE, 30, 0, 9, 3);
    r(lamp(f === 0), 31, 1, 3, 1);
    r(lamp(f === 1), 35, 1, 3, 1);
    wheel(5, 16);
    wheel(30, 16);
    wheel(16, 16);
    g.generateTexture(`truck_east_${f}`, 40, 24);

    // front view, driving south (24 × 28): cab face, windshield, grille, headlights, lights, ladder tip above
    g.clear();
    r(OUTLINE, 1, 4, 22, 22);
    r(RED, 2, 5, 20, 20);
    r(RED_HI, 2, 5, 20, 1);
    r(OUTLINE, 3, 0, 18, 5);
    r(lamp(f === 0), 4, 1, 6, 2);
    r(lamp(f === 1), 14, 1, 6, 2);
    r(0xf4f4f0, 10, 1, 4, 2);
    r(GLASS, 4, 7, 16, 6);
    r(0xe6f7ff, 5, 7, 3, 1);
    r(OUTLINE, 11, 7, 2, 6);
    r(0xf4f4f0, 2, 15, 20, 2);
    r(0x3a3438, 7, 18, 10, 4); // grille
    for (let k = 0; k < 4; k++) r(0x6d6a72, 8 + k * 2, 19, 1, 2);
    r(0xffe066, 3, 18, 3, 3);
    r(0xffe066, 18, 18, 3, 3);
    r(0x9aa0aa, 1, 23, 22, 2);
    r(OUTLINE, 2, 25, 5, 3);
    r(OUTLINE, 17, 25, 5, 3);
    g.generateTexture(`truck_south_${f}`, 24, 28);

    // back view, driving north (24 × 28): rear roller door, ladder ends, tail lights, lights on the far roof
    g.clear();
    r(OUTLINE, 1, 4, 22, 22);
    r(RED, 2, 5, 20, 20);
    r(OUTLINE, 3, 0, 18, 5);
    r(lamp(f === 1), 4, 1, 6, 2);
    r(lamp(f === 0), 14, 1, 6, 2);
    r(0xb8bcc4, 6, 3, 2, 12); // ladder rails
    r(0xb8bcc4, 16, 3, 2, 12);
    for (let k = 0; k < 4; k++) r(0xb8bcc4, 8, 4 + k * 3, 8, 1);
    r(RED_LO, 4, 15, 16, 7); // roller door
    for (let k = 0; k < 3; k++) r(RED, 4, 16 + k * 2, 16, 1);
    r(0xf4f4f0, 2, 13, 20, 1);
    r(0xff3b30, 2, 21, 2, 3);
    r(0xff3b30, 20, 21, 2, 3);
    r(OUTLINE, 2, 25, 5, 3);
    r(OUTLINE, 17, 25, 5, 3);
    g.generateTexture(`truck_north_${f}`, 24, 28);
  }

  // foot allies, one set per role (ALLY_LOOKS), 22 × 22 frames, figure centred, facing east
  const SKIN = 0xf2c29a;
  for (const [role, look] of Object.entries(ALLY_LOOKS) as [FighterRole, AllyLook][]) {
    for (const frame of OFFICER_FRAMES) {
      g.clear();
      if (frame === 'down') {
        // lying on the back, head west, cap fallen beside him
        r(OUTLINE, 1, 14, 20, 7);
        r(SKIN, 2, 15, 4, 4);
        r(OUTLINE, 4, 16, 1, 1);
        r(look.uniform, 6, 15, 8, 5);
        r(look.uniformHi, 6, 15, 8, 1);
        r(OUTLINE, 6, 18, 8, 1); // belt
        r(look.trousers, 14, 15, 6, 5);
        r(OUTLINE, 19, 14, 2, 3); // shoes up
        r(OUTLINE, 0, 10, 6, 4);
        r(look.capColor, 1, 11, 4, 2);
        r(look.band, 1, 12, 4, 1);
        if (look.baton !== null) r(look.baton, 13, 21, 8, 1);
        if (look.keys !== null) r(look.keys, 12, 19, 2, 2);
        g.generateTexture(officerTexture(role, frame), 22, 22);
        continue;
      }
      const ox = 4;
      const step = frame === 'walk1' ? 1 : 0;
      // legs (a step apart on walk1) and shoes
      r(OUTLINE, ox + 3, 14, 8, 7);
      r(look.trousers, ox + 4, 14, 2, 6 - step);
      r(look.trousers, ox + 8, 14, 2, 6 - (1 - step));
      r(OUTLINE, ox + 3 + step, 20 - step, 4, 2);
      r(OUTLINE, ox + 7 - step, 20 - (1 - step), 5, 2);
      // torso, belt, badge
      r(OUTLINE, ox + 2, 8, 10, 7);
      r(look.uniform, ox + 3, 9, 8, 5);
      r(look.uniformHi, ox + 3, 9, 8, 1);
      r(look.uniformLo, ox + 3, 13, 8, 1);
      r(OUTLINE, ox + 3, 13, 8, 1);
      r(0xffd23f, ox + 8, 10, 1, 1);
      if (look.shoulder !== null) {
        r(look.shoulder, ox + 3, 9, 2, 1); // shoulder boards
        r(look.shoulder, ox + 9, 9, 2, 1);
      }
      if (look.keys !== null) {
        r(look.keys, ox + 4, 14, 2, 2); // key ring at the belt
        r(OUTLINE, ox + 5, 15, 1, 1);
      }
      // head
      r(OUTLINE, ox + 3, 3, 8, 6);
      r(SKIN, ox + 4, 4, 6, 4);
      r(OUTLINE, ox + 8, 5, 1, 1); // eye
      r(0xd88a6a, ox + 9, 7, 1, 1); // nose / cheek
      CAP_DRAW[look.cap](r, look, ox, 0);
      if (frame === 'strike') {
        // baton raised high behind the head, arm up
        r(OUTLINE, ox + 10, 3, 3, 7);
        r(look.uniform, ox + 11, 4, 1, 5);
        if (look.baton !== null) {
          r(SKIN, ox + 11, 3, 1, 1);
          r(look.baton, ox + 9, 0, 2, 4);
          r(look.baton, ox + 11, 0, 4, 2);
        } else {
          // bare hands: a raised fist
          r(OUTLINE, ox + 10, 0, 4, 4);
          r(SKIN, ox + 11, 1, 2, 2);
        }
      } else {
        // arm swinging, baton hanging from the hand
        const sw = frame === 'walk1' ? 1 : 0;
        r(OUTLINE, ox + 10, 9, 3, 5);
        r(look.uniform, ox + 11, 9, 1, 4);
        r(SKIN, ox + 11, 13 - sw, 1, 1);
        if (look.baton !== null) r(look.baton, ox + 12, 12 - sw, 1, 6);
      }
      g.generateTexture(officerTexture(role, frame), 22, 22);
    }
  }

  // stun star (5 × 5) and the baton's hit spark (9 × 9)
  g.clear();
  r(0xffe066, 2, 0, 1, 5);
  r(0xffe066, 0, 2, 5, 1);
  r(0xfff6d0, 1, 1, 3, 3);
  r(0xffe066, 2, 2, 1, 1);
  g.generateTexture('stun_star', 5, 5);
  g.clear();
  r(0xffffff, 4, 0, 1, 9);
  r(0xffffff, 0, 4, 9, 1);
  r(0xffe066, 1, 1, 1, 1);
  r(0xffe066, 7, 1, 1, 1);
  r(0xffe066, 1, 7, 1, 1);
  r(0xffe066, 7, 7, 1, 1);
  r(0xffe066, 3, 3, 3, 3);
  r(0xffffff, 4, 4, 1, 1);
  g.generateTexture('hit_spark', 9, 9);
  g.destroy();
}
