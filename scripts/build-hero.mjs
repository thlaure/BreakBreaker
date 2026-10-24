// Composes the landing hero (src/site/hero.png) from the game's own tiles and LPC sheets, at native game-pixel
// size: the page scales it up with `image-rendering: pixelated`. Runtime-drawn textures (rocks, road
// sign, fire, smoke) are reproduced with plain pixel drawing, matching src/game/render/*.ts.
// Deterministic: fixed-seed RNG, no browser, no network. No flags, no photograph. Usage: npm run hero
// With --halloween (npm run hero:halloween) the same scene becomes the Halloween event's hero (src/events/halloween/hero.png):
// zombie rioters painted like the game's, a night grade, pennants, pumpkins, ghosts and bats.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { paintZombie } from '../src/events/halloween/zombiePaint.ts';
import { applyHalloween } from './hero-halloween.mjs';
import { ZOMBIE_LOOKS } from '../src/events/halloween/zombieMath.ts';

const HALLOWEEN = process.argv.includes('--halloween');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 480;
const H = 270;

// ---------- deterministic RNG ----------
let seed = 0x0b5eed;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- canvas ----------
const buf = new Float32Array(W * H * 3); // linear 0..255 RGB, opaque
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

function blend(x, y, rgb, a = 1) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) buf[i + k] = buf[i + k] * (1 - a) + rgb[k] * a;
}
function add(x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) buf[i + k] = Math.min(255, buf[i + k] + rgb[k] * a);
}
function rect(x, y, w, h, color, a = 1) {
  const c = hex(color);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) blend(xx, yy, c, a);
}
function ellipse(cx, cy, w, h, color, a = 1) {
  const c = hex(color);
  const rx = w / 2;
  const ry = h / 2;
  for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
    for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
      const dx = (xx + 0.5 - cx) / rx;
      const dy = (yy + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) blend(xx, yy, c, a);
    }
}

// ---------- sprite sheets ----------
const load = (rel) => PNG.sync.read(fs.readFileSync(path.join(root, rel)));
const sheets = {};
const sheet = (name, rel) => (sheets[name] ??= paintedForEvent(name, load(rel)));
/** Under --halloween every rioter sheet is painted as its zombie look (the same paint as the game's). */
function paintedForEvent(name, img) {
  const look = HALLOWEEN ? ZOMBIE_LOOKS.find((l) => l.base === name) : undefined;
  if (look) paintZombie(img.data, img.width, img.height, look);
  return img;
}

/** Copies a (sx,sy,w,h) region of a sheet to (dx,dy), scaled by an integer factor, alpha-blended. */
function blit(img, sx, sy, w, h, dx, dy, scale = 1, alpha = 1) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((sy + y) * img.width + (sx + x)) * 4;
      const a = (img.data[i + 3] / 255) * alpha;
      if (a <= 0) continue;
      const c = [img.data[i], img.data[i + 1], img.data[i + 2]];
      for (let oy = 0; oy < scale; oy++) for (let ox = 0; ox < scale; ox++) blend(dx + x * scale + ox, dy + y * scale + oy, c, a);
    }
}
/** 16-px Kenney city tile, drawn ×2 like the game (TILE.city). */
const city = (frame, dx, dy) =>
  blit(sheet('city', 'public/assets/tiles/city.png'), (frame % 37) * 16, Math.floor(frame / 37) * 16, 16, 16, dx, dy, 2);
/** 32-px LPC streets tile (TILE.streets). */
const street = (frame, dx, dy) =>
  blit(sheet('streets', 'public/assets/tiles/streets.png'), (frame % 10) * 32, Math.floor(frame / 10) * 32, 32, 32, dx, dy);

const LAYOUT = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/chars/layout.json'), 'utf8'));
const FEET_Y = 58; // FEET_ORIGIN_Y = 58/64 in actors.ts
/** LPC character at its feet position. `row`/`col` per layout.json. */
function char(name, row, col, fx, fy) {
  const img = sheet(name, `public/assets/chars/${name}.png`);
  const f = LAYOUT.frame;
  blit(img, col * f, row * f, f, f, fx - f / 2, fy - FEET_Y);
}
const WALK = LAYOUT.anims.walk.rows;
const SLASH = LAYOUT.anims.slash.rows;

// ---------- tiny bitmap font (signs and labels) ----------
const GLYPHS = {
  É: ['...#.', '..#..', '#####', '#....', '####.', '#....', '#....', '#####'],
  E: ['.....', '#####', '#....', '####.', '#....', '#....', '#....', '#####'],
  C: ['.....', '.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  O: ['.....', '.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  L: ['.....', '#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  S: ['.....', '.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  o: ['....', '....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  i: ['...', '.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  n: ['....', '....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  s: ['....', '....', '....', '.###', '#...', '.##.', '...#', '###.'],
};
function textWidth(s) {
  return [...s].reduce((w, ch) => w + GLYPHS[ch][0].length + 1, -1);
}
function text(s, x, y, color, outline) {
  const draw = (ox, oy, c) => {
    let cx = x;
    for (const ch of s) {
      const g = GLYPHS[ch];
      g.forEach((row, ry) => [...row].forEach((p, rx) => p === '#' && blend(cx + rx + ox, y + ry + oy, hex(c))));
      cx += g[0].length + 1;
    }
  };
  if (outline !== undefined)
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      draw(ox, oy, outline);
  draw(0, 0, color);
}

// ---------- scene ----------
const T = 32;
const FACADE_H = 32;
const ROOF_OVERHANG = 24;
const SIDEWALK_ROWS = 4; // y < 128 is paved (buildings line the top of the street)

// ground: sidewalk next to the buildings, asphalt elsewhere (world.ts buildGround)
for (let ty = 0; ty * T < H; ty++) for (let tx = 0; tx * T < W; tx++) street(ty < SIDEWALK_ROWS ? 11 : 170, tx * T, ty * T);
// gutter line where the sidewalk meets the road
rect(0, SIDEWALK_ROWS * T, W, 1, 0x1d1a24, 0.55);

/** Building like WorldView.buildBuilding: front wall at the bottom of the footprint, roof overhanging behind. */
function building(b, wall, roofFrame) {
  const front = b.y + b.h;
  for (let y = front - FACADE_H; y < front; y += 32) for (let x = b.x; x < b.x + b.w; x += 32) city(wall, x, y);
  rect(b.x, front - 3, b.w, 3, 0x1d1a24, 0.9);
  const r = { x: b.x, y: b.y - ROOF_OVERHANG, w: b.w, h: b.h - FACADE_H + ROOF_OVERHANG };
  for (let y = r.y + r.h - 32; y > r.y - 32; y -= 32) for (let x = r.x; x < r.x + r.w; x += 32) city(roofFrame, x, y);
  rect(r.x, r.y + r.h - 4, r.w, 4, 0x000000, 0.35);
  return front;
}
const school = { x: 144, y: -8, w: 192, h: 104 };
const schoolFront = building(school, 186, 38); // red brick, red roof (TILE.city.wallRed / roofs[0])
building({ x: 368, y: -8, w: 160, h: 96 }, 5 * 37 + 9, 62); // grey brick, tan roof

// ÉCOLE sign on the school front (world.ts: dark text on #f4ecd8)
{
  const s = 'ÉCOLE';
  const tw = textWidth(s);
  const sx = school.x + school.w / 2 - Math.ceil(tw / 2) - 3;
  const sy = schoolFront - FACADE_H / 2 - 7;
  rect(sx - 1, sy - 1, tw + 8, 14, 0x1d1a24);
  rect(sx, sy, tw + 6, 12, 0xf4ecd8);
  text(s, sx + 3, sy + 2, 0x1d1a24);
}

// trees (world.ts buildTrees): shadow, trunk tile, foliage tile above
const trees = [
  { x: 64, y: 118 },
  { x: 352, y: 116 },
];
const treeTrunk = 11 * 37 + 31;
const treeTop = 10 * 37 + 31;
for (const t of trees) {
  ellipse(t.x, t.y, 18, 6, 0x000000, 0.25);
  city(treeTrunk, t.x - 16, t.y - 32);
}

// peaceful group (crowd.ts GroupView): calm, facing south, blank light signs on sticks, blue "i" marker
const SIGN_COLORS = [0xf4ecd8, 0xe8f1f8, 0xf8efc8];
const group = [
  { x: 392, y: 116 },
  { x: 414, y: 122 },
  { x: 437, y: 114 },
  { x: 460, y: 121 },
];
group.forEach((m, i) => {
  char(`protester_${i + 1}`, WALK.s, 0, m.x, m.y);
  const px = m.x + 7;
  const py = m.y - 48;
  rect(px, py, 1, 14, 0x6b5440);
  rect(px - 8, py - 10, 16, 10, 0x3a3546);
  rect(px - 7, py - 9, 14, 8, SIGN_COLORS[i % SIGN_COLORS.length]);
});
{
  const cx = 426;
  const cy = 40;
  ellipse(cx, cy, 16, 16, 0xffffff);
  ellipse(cx, cy, 14, 14, 0x2f6fd6);
  rect(cx - 1, cy - 1, 2, 5, 0xffffff);
  rect(cx - 1, cy - 4, 2, 2, 0xffffff);
}

// road sign weapon (weapons.ts 'weapon_panneau') on the ground: yellow pickup glow, slight sway
const sign = { x: 262, y: 236 };
ellipse(sign.x, sign.y + 6, 26, 10, 0xffe066, 0.35);
{
  const sw = 16;
  const sh = 28;
  const spr = new Array(sw * sh).fill(null);
  const put = (x, y, c) => x >= 0 && y >= 0 && x < sw && y < sh && (spr[y * sw + x] = c);
  const fr = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, c);
  };
  const fc = (cx, cy, r, c) => {
    for (let yy = 0; yy < sh; yy++)
      for (let xx = 0; xx < sw; xx++) if ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r) put(xx, yy, c);
  };
  fr(6, 10, 4, 18, 0x14121c);
  fc(8, 8, 8, 0x14121c);
  fr(7, 12, 2, 15, 0x9aa0aa);
  fc(8, 8, 7, 0xd23b3b);
  fr(3, 7, 10, 3, 0xffffff);
  // rotate around the bottom-centre origin (nearest neighbour), like Phaser setAngle on an origin (0.5, 1) image
  const ang = (-14 * Math.PI) / 180;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const ox = sign.x;
  const oy = sign.y + 1;
  for (let y = -40; y <= 4; y++)
    for (let x = -24; x <= 24; x++) {
      const u = cos * x + sin * y + sw / 2;
      const v = -sin * x + cos * y + sh;
      const iu = Math.floor(u);
      const iv = Math.floor(v);
      if (iu < 0 || iv < 0 || iu >= sw || iv >= sh) continue;
      const c = spr[iv * sw + iu];
      if (c !== null) blend(ox + x, oy + y, hex(c));
    }
}

// rock shadows on the ground (fx.ts: 10×4 black ellipse, smaller while the rock is high)
const rocks = [
  { kind: 'caillou', x: 314, y: 168, lift: 13 },
  { kind: 'brique', x: 300, y: 200, lift: 10 },
];
for (const r of rocks) ellipse(r.x, r.y, 10 * (1 - r.lift / 30), 4 * (1 - r.lift / 30), 0x000000, 0.35);

// actors, back to front (depth = feet y)
const actors = [
  { name: 'rioter_classic_a', row: SLASH.w, col: 3, x: 436, y: 172 }, // throwing
  { name: 'rioter_classic_b', row: SLASH.w, col: 4, x: 346, y: 178 }, // mid-strike, arm raised
  { name: 'paul', row: WALK.e, col: 0, x: 266, y: 186 },
  { name: 'rioter_classic_a', row: WALK.w, col: 3, x: 390, y: 212 },
  { name: 'rioter_classic_b', row: WALK.w, col: 6, x: 456, y: 236 },
  { name: 'rioter_classic_a', row: SLASH.n, col: 4, x: 350, y: 246 }, // coming up from the bottom, arm raised
  { name: 'rioter_classic_b', row: WALK.n, col: 2, x: 420, y: 282 },
].sort((a, b) => a.y - b.y);
for (const a of actors) char(a.name, a.row, a.col, a.x, a.y);

// flying rocks (makeRockTextures shapes), lifted above their shadows
const ROCK = { caillou: { w: 8, h: 7, c: 0x9a948c, round: true }, brique: { w: 12, h: 6, c: 0xa4553a, round: false } };
for (const r of rocks) {
  const s = ROCK[r.kind];
  const x = Math.round(r.x - s.w / 2);
  const y = Math.round(r.y - r.lift - s.h / 2);
  if (s.round) ellipse(x + s.w / 2, y + s.h / 2, s.w, s.h, s.c);
  else rect(x, y, s.w, s.h, s.c);
  rect(x + (s.round ? 1 : 0), y + s.h - 1, s.w - (s.round ? 2 : 0), 1, 0x000000, 0.25);
  // short motion trail towards the thrower
  for (let k = 1; k <= 3; k++) rect(x + s.w + k * 3, y + Math.floor(s.h / 2) - k + 1, 2, 1, 0xd6d0c4, 0.45 - k * 0.12);
}

// foliage sits above actors
for (const t of trees) city(treeTop, t.x - 16, t.y - 64);

// ---------- night grade: cool and darken everything, then light it with the fire ----------
const FIRE = { x: 240, y: 52 };
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    buf[i] *= 0.62;
    buf[i + 1] *= 0.64;
    buf[i + 2] *= 0.82;
    const d = Math.hypot((x - FIRE.x) / 1.15, y - FIRE.y);
    const glow = Math.max(0, 1 - d / 210) ** 2;
    add(x, y, [255, 128, 48], glow * 0.42);
  }

// pickup glow reads as a light source
ellipse(sign.x, sign.y + 6, 22, 8, 0xffe066, 0.18);

// ---------- smoke (dithered pixel puffs drifting up-right) ----------
const SMOKE = [0x4a4650, 0x5a5560, 0x3c3842];
for (let k = 0; k < 34; k++) {
  const t = (k % 17) / 16;
  const cx = (k < 17 ? 192 : 282) + t * 170 + (rnd() - 0.5) * 50;
  const cy = 26 - t * 70 + (rnd() - 0.5) * 20;
  const r = 12 + t * 18 + rnd() * 8;
  const col = hex(SMOKE[k % SMOKE.length]);
  const a = 0.72 - t * 0.32;
  for (let y = Math.floor(cy - r); y <= cy + r; y += 2)
    for (let x = Math.floor(cx - r); x <= cx + r; x += 2) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1) continue;
      if (d > 0.78 && ((x >> 1) + (y >> 1)) % 2) continue; // dithered rim
      for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) blend(x + ox, y + oy, col, a);
    }
}

// ---------- flames (school fire, game tints 0xffe066 / 0xff9a2e / 0xff5a1f) on a 2-px grid ----------
const tongues = [];
for (let x = school.x + 10; x < school.x + school.w - 8; x += 6 + Math.floor(rnd() * 6)) {
  const front = rnd() < 0.72;
  tongues.push({
    cx: x,
    base: front ? 60 + Math.floor(rnd() * 5) : 30 + Math.floor(rnd() * 12),
    h: front ? 16 + rnd() * 24 : 10 + rnd() * 14,
    w: 14 + rnd() * 10,
    ph: rnd() * 6,
  });
}
// glowing bed of embers along the burning roof
for (const tg of tongues)
  for (let x = Math.floor(tg.cx - tg.w / 2); x < tg.cx + tg.w / 2; x += 2) {
    const y = tg.base - 2 + (Math.floor(rnd() * 3) - 1) * 2;
    for (let oy = 0; oy < 4; oy++) for (let ox = 0; ox < 2; ox++) blend(x + ox, y + oy, hex(oy < 2 ? 0xff5a1f : 0xc7361a), 0.9);
  }
const LAYERS = [
  { c: 0xa82a18, k: 1.0 },
  { c: 0xff5a1f, k: 0.86 },
  { c: 0xff9a2e, k: 0.64 },
  { c: 0xffe066, k: 0.4 },
  { c: 0xfff6c8, k: 0.18 },
];
/** Teardrop profile: widest a little above the base, pointed tip. */
const profile = (v) => (v < 0.22 ? 0.75 + (v / 0.22) * 0.25 : ((1 - v) / 0.78) ** 0.85);
for (const L of LAYERS)
  for (const tg of tongues) {
    const h = tg.h * (0.5 + 0.5 * L.k);
    for (let y = tg.base - Math.ceil(h); y <= tg.base; y += 2)
      for (let x = Math.floor(tg.cx - tg.w); x <= tg.cx + tg.w; x += 2) {
        const v = (tg.base - y) / h; // 0 at the base, 1 at the tip
        if (v < 0 || v > 1) continue;
        const bend = Math.sin(v * 2.4 + tg.ph) * v * 3; // tips lick sideways
        const u = Math.abs(x + 1 - tg.cx - bend) / (tg.w / 2);
        if (u <= L.k * profile(v)) for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) blend(x + ox, y + oy, hex(L.c));
      }
  }
// embers
for (let k = 0; k < 46; k++) {
  const x = Math.floor(school.x + 10 + rnd() * 230);
  const y = Math.floor(-4 + rnd() * 64);
  const c = hex([0xffe066, 0xff9a2e, 0xff5a1f][k % 3]);
  const s = rnd() < 0.3 ? 2 : 1;
  for (let oy = 0; oy < s; oy++) for (let ox = 0; ox < s; ox++) blend(x + ox, y + oy, c);
}
// warm light spilling on the facade and the street below the fire
for (let y = 56; y < 150; y++)
  for (let x = school.x - 20; x < school.x + school.w + 20; x++) {
    const d = Math.hypot((x - FIRE.x) / 2.2, (y - 64) / 1.2);
    add(x, y, [255, 150, 60], Math.max(0, 1 - d / 60) * 0.18);
  }

if (HALLOWEEN) applyHalloween({ W, H, buf, rect, ellipse, hex });

// ---------- write ----------
const png = new PNG({ width: W, height: H });
for (let p = 0; p < W * H; p++) {
  png.data[p * 4] = Math.round(Math.min(255, buf[p * 3]));
  png.data[p * 4 + 1] = Math.round(Math.min(255, buf[p * 3 + 1]));
  png.data[p * 4 + 2] = Math.round(Math.min(255, buf[p * 3 + 2]));
  png.data[p * 4 + 3] = 255;
}
const out = path.join(root, HALLOWEEN ? 'src/events/halloween/hero.png' : 'src/site/hero.png');
const data = PNG.sync.write(png, { colorType: 2, deflateLevel: 9 });
fs.writeFileSync(out, data);
console.log(`${path.relative(root, out)} ${W}×${H}, ${(data.length / 1024).toFixed(1)} KB`);
