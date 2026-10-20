// Composites LPC character sheets from assets-source/lpc using scripts/lpc-recipes.json,
// writes public/assets/chars/*.png + layout.json, and generates public/CREDITS.md
// (from scripts/credits-template.md). Exits non-zero if a used layer has no credit row.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lpc = path.join(root, 'assets-source/lpc');
const sheets = path.join(lpc, 'spritesheets');
const outDir = path.join(root, 'public/assets/chars');
const recipes = JSON.parse(fs.readFileSync(path.join(root, 'scripts/lpc-recipes.json'), 'utf8'));

const FRAME = 64;
const COLS = 9;
// Source animation files (one PNG per animation, 64x64 frames, rows n,w,s,e except hurt).
// Output sheet layout is ours: walk rows 0-3, slash rows 4-7, hurt row 8.
const ANIMS = [
  { name: 'walk', rows: 4, frames: 9, outRow: 0 },
  { name: 'slash', rows: 4, frames: 6, outRow: 4 },
  { name: 'hurt', rows: 1, frames: 6, outRow: 8 },
];
const ROW_ORDER = ['n', 'w', 's', 'e'];

const PALETTE_FILES = {
  skin: ['palette_definitions/body/body_ulpc.json', 'light'],
  hair: ['palette_definitions/hair/hair_ulpc.json', 'orange'],
  cloth: ['palette_definitions/cloth/cloth_ulpc.json', 'white'],
};
const palettes = {};
for (const [mat, [file, base]] of Object.entries(PALETTE_FILES)) {
  palettes[mat] = { data: JSON.parse(fs.readFileSync(path.join(lpc, file), 'utf8')), base };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const key = (r, g, b) => (r << 16) | (g << 8) | b;

function recolorMap(material, name, custom) {
  if (custom) return new Map(Object.entries(custom).map(([f, t]) => [key(...hex(f)), hex(t)]));
  const p = palettes[material];
  if (!p) throw new Error(`unknown material ${material}`);
  const from = p.data[p.base];
  const to = p.data[name];
  if (!to) throw new Error(`unknown ${material} palette ${name}`);
  const m = new Map();
  from.forEach((c, i) => m.set(key(...hex(c)), hex(to[Math.min(i, to.length - 1)])));
  return m;
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

// Minimal RFC4180 CSV parser (quoted fields, doubled quotes, newlines inside quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const csvRows = parseCsv(fs.readFileSync(path.join(lpc, 'CREDITS.csv'), 'utf8'));
const header = csvRows.shift().map((h) => h.trim());
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const credits = new Map();
for (const r of csvRows) credits.set(r[col.filename].trim(), r);

const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const usedCredits = new Map(); // layer dir -> { authors:Set, licenses:Set, urls:Set, notes:Set }
const missing = [];

function useCredit(layerPath, file) {
  const rel = `${layerPath}/${file}`;
  const row = credits.get(rel);
  if (!row) { missing.push(rel); return; }
  let e = usedCredits.get(layerPath);
  if (!e) usedCredits.set(layerPath, (e = { authors: new Set(), licenses: new Set(), urls: new Set(), notes: new Set() }));
  split(row[col.authors]).forEach((a) => e.authors.add(a));
  split(row[col.licenses]).forEach((a) => e.licenses.add(a));
  split(row[col.urls]).forEach((a) => e.urls.add(a));
  if (row[col.notes].trim()) e.notes.add(row[col.notes].trim());
}

function blit(dst, dstW, src, sx, sy, w, h, dx, dy) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((sy + y) * src.width + sx + x) * 4;
      const a = src.data[si + 3];
      if (!a) continue;
      const di = ((dy + y) * dstW + dx + x) * 4;
      const sr = src.data[si], sg = src.data[si + 1], sb = src.data[si + 2];
      const da = dst[di + 3];
      if (a === 255 || !da) { dst[di] = sr; dst[di + 1] = sg; dst[di + 2] = sb; dst[di + 3] = a; continue; }
      const oa = a + da * (255 - a) / 255;
      dst[di] = (sr * a + dst[di] * da * (255 - a) / 255) / oa;
      dst[di + 1] = (sg * a + dst[di + 1] * da * (255 - a) / 255) / oa;
      dst[di + 2] = (sb * a + dst[di + 2] * da * (255 - a) / 255) / oa;
      dst[di + 3] = oa;
    }
  }
}

fs.mkdirSync(outDir, { recursive: true });
const totalRows = ANIMS.reduce((n, a) => n + a.rows, 0);

for (const [name, recipe] of Object.entries(recipes)) {
  const out = new PNG({ width: COLS * FRAME, height: totalRows * FRAME });
  const layers = [...recipe.layers].sort((a, b) => a.z - b.z);
  for (const layer of layers) {
    const map = recolorMap(layer.material, layer.palette, layer.map);
    for (const anim of ANIMS) {
      const file = `${anim.name}.png`;
      // most layers are one sheet per animation; glasses & co. ship one sheet per colour: <path>/<anim>/<color>.png
      const abs = layer.color ? path.join(sheets, layer.path, anim.name, `${layer.color}.png`) : path.join(sheets, layer.path, file);
      if (!fs.existsSync(abs)) throw new Error(`${name}: missing layer file ${layer.path}/${file}`);
      useCredit(layer.path, file);
      const src = readPng(abs);
      if (src.width < anim.frames * FRAME || src.height < anim.rows * FRAME) {
        throw new Error(`${layer.path}/${file}: unexpected size ${src.width}x${src.height}`);
      }
      // recolor into a copy
      const rc = new PNG({ width: src.width, height: src.height });
      for (let i = 0; i < src.data.length; i += 4) {
        // optional clipY: drop pixels at/below this row of each 64-px frame (e.g. torso-only part of overalls)
        const fy = Math.floor(i / 4 / src.width) % FRAME;
        const a = layer.clipY !== undefined && fy >= layer.clipY ? 0 : src.data[i + 3];
        let r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
        const t = map.get(key(r, g, b));
        if (t) [r, g, b] = t;
        rc.data[i] = r; rc.data[i + 1] = g; rc.data[i + 2] = b; rc.data[i + 3] = a;
      }
      blit(out.data, out.width, rc, 0, 0, anim.frames * FRAME, anim.rows * FRAME, 0, anim.outRow * FRAME);
    }
  }
  fs.writeFileSync(path.join(outDir, `${name}.png`), PNG.sync.write(out));
  console.log('wrote', name);
}

if (missing.length) {
  console.error('No credit row for used layer files:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const layout = {
  frame: FRAME,
  anims: {
    walk: { rows: Object.fromEntries(ROW_ORDER.map((d, i) => [d, i])), frames: 9 },
    slash: { rows: Object.fromEntries(ROW_ORDER.map((d, i) => [d, 4 + i])), frames: 6 },
    hurt: { row: 8, frames: 6 },
  },
};
fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(layout, null, 2) + '\n');

// CREDITS.md
const entries = [...usedCredits.entries()].sort(([a], [b]) => a.localeCompare(b));
const lines = entries.map(([p, e]) => {
  const urls = [...e.urls].map((u) => `<${u}>`).join(', ');
  const note = e.notes.size ? ` Notes: ${[...e.notes].join('; ')}.` : '';
  return `- \`${p}\` — ${[...e.authors].join(', ')} — ${[...e.licenses].join(' / ')}. Sources: ${urls}.${note}`;
});
const tpl = fs.readFileSync(path.join(root, 'scripts/credits-template.md'), 'utf8');
if (!tpl.includes('{{LPC_CREDITS}}')) throw new Error('credits template lacks {{LPC_CREDITS}}');
fs.writeFileSync(path.join(root, 'public/CREDITS.md'), tpl.replace('{{LPC_CREDITS}}', lines.join('\n')));
console.log(`CREDITS.md: ${entries.length} layers credited`);
await import('./build-misc.mjs');
