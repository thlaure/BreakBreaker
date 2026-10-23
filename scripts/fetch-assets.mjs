// Downloads pinned asset sources into assets-source/ (git-ignored).
// Usage: node scripts/fetch-assets.mjs [--update-lock]  (--update-lock records missing sha256 values)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets-source');
const lockPath = path.join(root, 'scripts/assets.lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const updateLock = process.argv.includes('--update-lock');
fs.mkdirSync(src, { recursive: true });

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'inherit' });

// --- LPC generator repo at pinned commit
const lpcDir = path.join(src, 'lpc');
if (!fs.existsSync(path.join(lpcDir, '.git'))) {
  git(['clone', '--depth', '1', lock.lpc.repo, lpcDir]);
}
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: lpcDir }).toString().trim();
if (head !== lock.lpc.commit) {
  git(['fetch', '--depth', '1', 'origin', lock.lpc.commit], lpcDir);
  git(['checkout', '--quiet', lock.lpc.commit], lpcDir);
}
if (!fs.existsSync(path.join(lpcDir, 'CREDITS.csv'))) throw new Error('LPC CREDITS.csv missing');
console.log('lpc @', lock.lpc.commit);

// --- zip archives
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
let changed = false;
for (const [name, a] of Object.entries(lock.archives)) {
  const zipPath = path.join(src, `${name}.zip`);
  const dir = path.join(src, name);
  let buf = fs.existsSync(zipPath) ? fs.readFileSync(zipPath) : null;
  if (!buf || (a.sha256 && sha(buf) !== a.sha256)) {
    console.log('downloading', a.url);
    const res = await fetch(a.url, { headers: { 'user-agent': 'breakbreaker-asset-fetch' } });
    if (!res.ok) throw new Error(`${a.url}: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(zipPath, buf);
  }
  const digest = sha(buf);
  if (!a.sha256) {
    if (!updateLock) throw new Error(`${name}: no sha256 in lock (run with --update-lock)`);
    a.sha256 = digest;
    changed = true;
  } else if (digest !== a.sha256) {
    throw new Error(`${name}: sha256 mismatch (${digest} != ${a.sha256})`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  new AdmZip(buf).extractAllTo(dir, true);
  // License check: CC0 text must be present in the archive for Kenney packs;
  // OpenGameArt packs are CC0 per the page (recorded in lock) and any bundled license file must agree.
  const lic = fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => /licen[cs]e|readme|credits/i.test(String(f)) && /\.(txt|md)$/i.test(String(f)));
  const text = lic.map((f) => fs.readFileSync(path.join(dir, String(f)), 'utf8')).join('\n');
  const cc0 = /CC0|Creative Commons Zero|public domain/i.test(text);
  if (name.startsWith('kenney-') && !cc0) throw new Error(`${name}: license file does not state CC0`);
  console.log(name, digest.slice(0, 12), cc0 ? 'CC0 confirmed in archive' : 'license per source page: ' + a.license);
}
if (changed) fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
