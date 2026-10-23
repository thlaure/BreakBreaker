// Lossless size pass: rewrites every PNG under public/assets as an indexed (palette) PNG when it has at most 256 colors.
// Pixels are unchanged (tests/assets.test.ts checks the decoded pixels still match). Run by `npm run assets`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Indexed PNG bytes for a decoded RGBA image, or null when it has more than 256 colors. */
export function encodeIndexed(png) {
  const { width, height, data } = png;
  const index = new Map();
  const palette = [];
  const pixels = Buffer.alloc((width + 1) * height); // each row: filter byte 0, then one index per pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const key = data.readUInt32BE(o);
      let i = index.get(key);
      if (i === undefined) {
        if (palette.length === 256) return null;
        i = palette.length;
        index.set(key, i);
        palette.push(key);
      }
      pixels[y * (width + 1) + 1 + x] = i;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // indexed color
  const plte = Buffer.alloc(palette.length * 3);
  const trns = Buffer.alloc(palette.length);
  palette.forEach((c, i) => {
    plte[i * 3] = (c >>> 24) & 255;
    plte[i * 3 + 1] = (c >>> 16) & 255;
    plte[i * 3 + 2] = (c >>> 8) & 255;
    trns[i] = c & 255;
  });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', zlib.deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function* pngFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* pngFiles(p);
    else if (e.name.endsWith('.png')) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let before = 0;
  let after = 0;
  for (const file of pngFiles(path.join(root, 'public/assets'))) {
    const old = fs.readFileSync(file);
    const out = encodeIndexed(PNG.sync.read(old));
    before += old.length;
    if (out && out.length < old.length) {
      fs.writeFileSync(file, out);
      after += out.length;
    } else after += old.length;
  }
  console.log(`PNG assets: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
}
