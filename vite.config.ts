import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { CONTROLS, SATIRE_NOTICE } from './src/content/controls';
import { CONFIG } from './src/sim/config';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

interface Release {
  version: string;
  date: string;
  notes: string[];
}

/** Reads CHANGELOG.md: `## <version> - <date>` headings, each followed by `- ` bullets. */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  for (const line of md.split('\n')) {
    const head = /^## (\S+) - (\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (head?.[1] && head[2]) releases.push({ version: head[1], date: head[2], notes: [] });
    else if (line.startsWith('- ')) releases.at(-1)?.notes.push(line.slice(2).trim());
  }
  return releases;
}

const frDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const TEASER_NOTES = 3;

function changelogFills(): Record<string, string> {
  const releases = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
  const latest = releases[0];
  const list = (notes: string[]) => notes.map((n) => `<li>${esc(n)}</li>`).join('');
  return {
    '<!--teaser-->': latest
      ? `<h2 class="news-title">Nouveautés <span>${esc(latest.version)}</span></h2><ul>${list(latest.notes.slice(0, TEASER_NOTES))}</ul>`
      : '',
    '<!--changelog-->': releases
      .map(
        (r) =>
          `<section class="release"><h3>${esc(r.version)} <time datetime="${r.date}">${esc(frDate(r.date))}</time></h3><ul>${list(r.notes)}</ul></section>`,
      )
      .join('\n        '),
  };
}

/** Inlines the shared controls/notice/version into the landing page only (no client JS). The rules live in the game. */
function landingContent(): Plugin {
  const fills: Record<string, string> = {
    '<!--controls-->': CONTROLS.map(
      (c) => `<tr><th scope="row">${esc(c.action)}</th><td>${esc(c.keyboard)}</td><td>${esc(c.touch)}</td></tr>`,
    ).join('\n            '),
    '<!--notice-->': esc(SATIRE_NOTICE),
    '<!--version-->': esc(CONFIG.appVersion),
    ...changelogFills(),
  };
  return {
    name: 'landing-content',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path !== '/index.html') return html;
        return Object.entries(fills).reduce((h, [k, v]) => h.split(k).join(v), html);
      },
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; CI sets BASE_PATH=/BreakBreaker/. Local dev and tests use '/'.
  base: process.env.BASE_PATH ?? '/',
  plugins: [landingContent()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', jouer: 'jouer/index.html' },
    },
  },
});
