// Builds the site icons from Paul's sprite (public/assets/chars/paul.png, facing south): his head on a navy tile with
// a yellow pixel border, drawn on a 30x30 art grid and scaled by whole numbers (crisp pixels).
//   public/favicon.png          32x32 (the art at 1x, 1 px transparent margin)
//   public/apple-touch-icon.png 180x180 (the art at 6x, opaque: iOS masks the corners itself)
// Deterministic, no network. Usage: npm run favicon
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheet = PNG.sync.read(fs.readFileSync(path.join(root, 'public/assets/chars/paul.png')));

const FRAME = 64;
const SOUTH_ROW = 2; // layout.json: walk row "s"; column 0 = idle frame
const HEAD = { x: 20, y: 14, size: 24 }; // head + hair inside the 64x64 frame (sprite spans x 17..46, y 14..61)
const ART = 30;
const NAVY = [0x14, 0x12, 0x1c, 255];
const YELLOW = [0xff, 0xd1, 0x66, 255];

/** The 30x30 art grid as RGBA (corner pixels cut when `roundCorners`). */
function art(roundCorners) {
  const px = new Uint8Array(ART * ART * 4);
  const set = (x, y, c) => px.set(c, (y * ART + x) * 4);
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      const edge = x === 0 || y === 0 || x === ART - 1 || y === ART - 1;
      const corner = (x === 0 || x === ART - 1) && (y === 0 || y === ART - 1);
      if (roundCorners && corner) set(x, y, [0, 0, 0, 0]);
      else set(x, y, edge ? YELLOW : NAVY);
    }
  }
  // Paul's head, composited over the tile
  const off = (ART - HEAD.size) / 2;
  for (let y = 0; y < HEAD.size; y++) {
    for (let x = 0; x < HEAD.size; x++) {
      const sx = HEAD.x + x;
      const sy = SOUTH_ROW * FRAME + HEAD.y + y;
      const i = (sy * sheet.width + sx) * 4;
      const a = sheet.data[i + 3] / 255;
      if (a === 0) continue;
      const j = ((off + y) * ART + off + x) * 4;
      for (let k = 0; k < 3; k++) px[j + k] = Math.round(sheet.data[i + k] * a + px[j + k] * (1 - a));
      px[j + 3] = 255;
    }
  }
  return px;
}

/** Scales the art by `k` (nearest) onto a `size`x`size` canvas, centred. */
function render(px, k, size) {
  const png = new PNG({ width: size, height: size });
  const pad = Math.floor((size - ART * k) / 2);
  for (let y = 0; y < ART * k; y++) {
    for (let x = 0; x < ART * k; x++) {
      const si = (Math.floor(y / k) * ART + Math.floor(x / k)) * 4;
      png.data.set(px.subarray(si, si + 4), ((pad + y) * size + pad + x) * 4);
    }
  }
  return PNG.sync.write(png);
}

fs.writeFileSync(path.join(root, 'public/favicon.png'), render(art(true), 1, 32));
fs.writeFileSync(path.join(root, 'public/apple-touch-icon.png'), render(art(false), 6, 180));
console.log('favicon.png 32x32, apple-touch-icon.png 180x180');
