import Phaser from 'phaser';

const OUTLINE = 0x14121c;

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
    for (const [x0, k0] of [
      [3, 0],
      [22, 3],
    ] as const) {
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
