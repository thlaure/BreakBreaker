// The Halloween night grade and decorations of the landing hero (called by build-hero.mjs --halloween). Pixel drawing
// only, matching the game's hw_* textures (src/events/halloween/decor.ts); `d` carries the canvas helpers of build-hero.mjs.

export function applyHalloween(d) {
  const { W, H, buf, rect, ellipse, hex } = d;
  /** A grinning jack-o'-lantern at (x, y) = its feet (the game's hw_pumpkin, 16 × 14). */
  function pumpkin(x, y) {
    const r = (c, dx, dy, w, h) => rect(x - 8 + dx, y - 14 + dy, w, h, c);
    r(0x14121c, 2, 3, 12, 11);
    r(0x14121c, 0, 5, 16, 7);
    r(0xc2570f, 1, 4, 14, 9);
    r(0xf28a1e, 2, 4, 12, 9);
    r(0xffb347, 3, 5, 3, 2);
    r(0xc2570f, 5, 4, 1, 9);
    r(0xc2570f, 10, 4, 1, 9);
    r(0x14121c, 6, 0, 4, 3);
    r(0x4a8f2a, 7, 1, 2, 2);
    for (const [dx, dy, w, h] of [
      [4, 6, 2, 2],
      [10, 6, 2, 2],
      [4, 10, 8, 1],
      [5, 9, 1, 1],
      [7, 9, 1, 1],
      [9, 9, 1, 1],
    ])
      r(0xffe066, dx, dy, w, h);
    ellipse(x, y - 7, 34, 20, 0xffb02e, 0.1);
  }
  /** A friendly ghost at (x, y) = its feet, tinted (the game's hw_ghost, 14 × 18). */
  function ghost(x, y, tint) {
    const t = hex(tint);
    const r = (c, dx, dy, w, h, a = 0.92) => rect(x - 7 + dx, y - 18 + dy, w, h, c, a);
    const body = [Math.round(255 * (t[0] / 255)), Math.round(255 * (t[1] / 255)), Math.round(255 * (t[2] / 255))];
    const white = (body[0] << 16) | (body[1] << 8) | body[2];
    r(0x14121c, 3, 0, 8, 1);
    r(0x14121c, 1, 1, 12, 2);
    r(0x14121c, 0, 3, 14, 12);
    r(white, 2, 1, 10, 2);
    r(white, 1, 3, 12, 11);
    r(0x14121c, 3, 5, 2, 3);
    r(0x14121c, 8, 5, 2, 3);
    r(0x14121c, 5, 10, 4, 1);
    r(0x14121c, 4, 9, 1, 1);
    r(0x14121c, 9, 9, 1, 1);
    for (const dx of [0, 4, 8]) {
      r(0x14121c, dx, 15, 3, 3);
      r(white, dx + 1, 14, 1, 3);
    }
    ellipse(x, y - 9, 30, 26, white, 0.08);
  }
  /** A bat, wings up or down (the game's hw_bat0 / hw_bat1, 11 × 6), centred on (x, y). */
  function bat(x, y, up) {
    const r = (c, dx, dy, w, h) => rect(x - 5 + dx, y - 3 + dy, w, h, c);
    r(0x3a2a52, 4, 2, 3, 3);
    r(0x3a2a52, 4, 1, 1, 1);
    r(0x3a2a52, 6, 1, 1, 1);
    r(0xff5fc8, 4, 3, 1, 1);
    r(0xff5fc8, 6, 3, 1, 1);
    for (const side of [0, 1]) {
      const dx = side ? 7 : 0;
      const dy = up ? 0 : 2;
      r(0x3a2a52, dx, dy, 4, 2);
      r(0x3a2a52, dx + (side ? 0 : 1), dy + 2, 3, 2);
      r(0x5a3e7a, dx + 1, dy, 2, 1);
    }
  }
  // night: cool violet over everything except the flames and the warm lights
  for (let p = 0; p < W * H; p++) {
    const [r, g, b] = [buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]];
    if (r > 180 && r - b > 80) continue;
    buf[p * 3] = r * 0.74;
    buf[p * 3 + 1] = g * 0.66;
    buf[p * 3 + 2] = Math.min(255, b * 0.95 + 14);
  }
  // a string of pennants across the top, sagging in the middle
  const FLAGS = [0xf28a1e, 0x9b5cff, 0xff5fc8, 0x6adf4a];
  for (let x = 0; x < W; x += 8) {
    const sag = Math.round(8 * Math.sin((x / W) * Math.PI));
    const c = FLAGS[(x / 8) % FLAGS.length];
    rect(x, 4 + sag, 8, 1, 0x14121c);
    rect(x + 1, 5 + sag, 6, 3, c);
    rect(x + 2, 8 + sag, 4, 2, c);
    rect(x + 3, 10 + sag, 2, 1, c);
  }
  for (const [x, y] of [
    [26, 126],
    [110, 126],
    [318, 128],
    [352, 128],
    [468, 129],
  ])
    pumpkin(x, y);
  pumpkin(62, 262);
  pumpkin(176, 258);
  ghost(150, 200, 0xffffff);
  ghost(228, 52, 0xffc2ee);
  ghost(440, 40, 0xb8e4ff);
  [
    [60, 36, true],
    [196, 20, false],
    [300, 30, true],
    [380, 22, false],
    [20, 150, false],
    [470, 120, true],
  ].forEach(([x, y, up]) => bat(x, y, up));
}
