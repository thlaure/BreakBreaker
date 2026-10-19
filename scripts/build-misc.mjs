// Builds non-character assets from assets-source: streets atlas, tile copies, sound picks, flag sprite.
// Imported by build-lpc.mjs (so `npm run assets` does everything).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets-source');
const out = path.join(root, 'public/assets');
for (const d of ['tiles', 'sfx', 'props']) fs.mkdirSync(path.join(out, d), { recursive: true });

// --- tiles: Kenney packed tilemaps (no margin/spacing), 16 px
fs.copyFileSync(path.join(src, 'kenney-rpg-urban/Tilemap/tilemap_packed.png'), path.join(out, 'tiles/urban.png'));
fs.copyFileSync(path.join(src, 'kenney-roguelike-city/Tilemap/tilemap_packed.png'), path.join(out, 'tiles/city.png'));

// --- tiles: LPC Modern Streets atlas, 32 px, 10 columns. Pieces stacked on a 32-px grid.
const T = path.join(src, 'lpc-modern-streets/terrains');
const pieces = [
  ['sidewalk_terrain.png', 0, 0],
  ['traffic_markings.png', 0, 7],
  ['cracked_road.png', 0, 14],
  ['base_road_tile.png', 0, 17],
  ['manhole_and_cover.png', 1, 17],
  ['rain_gutter_terrain.png', 0, 18],
];
const atlas = new PNG({ width: 320, height: 25 * 32 });
for (const [f, tx, ty] of pieces) {
  const p = PNG.sync.read(fs.readFileSync(path.join(T, f)));
  PNG.bitblt(p, atlas, 0, 0, p.width, p.height, tx * 32, ty * 32);
}
fs.writeFileSync(path.join(out, 'tiles/streets.png'), PNG.sync.write(atlas));

// --- sfx picks (all CC0 Kenney)
const IMP = 'kenney-impact-sounds/Audio';
const RPG = 'kenney-rpg-audio/Audio';
const sfx = {
  'hit1.ogg': `${IMP}/impactPunch_medium_000.ogg`,
  'hit2.ogg': `${IMP}/impactPunch_medium_001.ogg`,
  'hit3.ogg': `${IMP}/impactPunch_medium_002.ogg`,
  'throw.ogg': `${RPG}/cloth3.ogg`,
  'land.ogg': `${IMP}/impactSoft_heavy_000.ogg`,
  'pickup.ogg': `${RPG}/handleCoins.ogg`,
  'hurt.ogg': `${IMP}/impactPunch_heavy_000.ogg`,
  'fire_loop.ogg': `${RPG}/cloth4.ogg`, // no crackle in the packs; closest loopable rustle
  'alarm.ogg': `${IMP}/impactBell_heavy_000.ogg`,
  'ui_click.ogg': `${RPG}/metalClick.ogg`,
};
for (const [dst, rel] of Object.entries(sfx)) {
  const from = path.join(src, rel);
  if (!fs.existsSync(from)) throw new Error(`missing sound ${rel}`);
  fs.copyFileSync(from, path.join(out, 'sfx', dst));
}

// --- flags: 3 frames of 16x12 side by side, drawn in code
const FW = 16, FH = 12;
const flags = new PNG({ width: FW * 3, height: FH });
const px = (f, x, y, c) => {
  if (x < 0 || y < 0 || x >= FW || y >= FH) return;
  const i = (y * flags.width + f * FW + x) * 4;
  flags.data[i] = c[0]; flags.data[i + 1] = c[1]; flags.data[i + 2] = c[2]; flags.data[i + 3] = 255;
};
const rect = (f, x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(f, x, y, c); };
const BLUE = [0, 35, 149], WHITE = [250, 250, 250], RED = [237, 41, 57], BLACK = [20, 20, 20], GREEN = [0, 122, 61];
// 0: French tricolour
rect(0, 0, 0, 5, FH, BLUE); rect(0, 5, 0, 6, FH, WHITE); rect(0, 11, 0, 5, FH, RED);
// 1: Palestinian
rect(1, 0, 0, FW, 4, BLACK); rect(1, 0, 4, FW, 4, WHITE); rect(1, 0, 8, FW, 4, GREEN);
for (let y = 0; y < FH; y++) { const w = Math.round(6 * (1 - Math.abs(y - 5.5) / 6)); rect(1, 0, y, w, 1, RED); }
// 2: Antifa-style mark: red and black flag shapes inside a circle on white
rect(2, 0, 0, FW, FH, WHITE);
const cx = 7.5, cy = 5.5, R = 5;
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
  const d = Math.hypot(x - cx, y - cy);
  if (d <= R && d > R - 0.9) px(2, x, y, BLACK);
}
rect(2, 5, 3, 3, 3, RED); rect(2, 8, 6, 3, 3, BLACK); // two flag shapes
// 1-px darker outline on every frame
for (let f = 0; f < 3; f++) {
  for (let x = 0; x < FW; x++) for (const y of [0, FH - 1]) {
    const i = (y * flags.width + f * FW + x) * 4;
    for (let k = 0; k < 3; k++) flags.data[i + k] = Math.round(flags.data[i + k] * 0.35);
  }
  for (let y = 0; y < FH; y++) for (const x of [0, FW - 1]) {
    const i = (y * flags.width + f * FW + x) * 4;
    for (let k = 0; k < 3; k++) flags.data[i + k] = Math.round(flags.data[i + k] * 0.35);
  }
}
fs.writeFileSync(path.join(out, 'props/flags.png'), PNG.sync.write(flags));
console.log('misc assets built');
