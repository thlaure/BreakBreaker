/**
 * Build-time generation of the static landing pages (one per language) from the shared `index.html` template and the
 * catalogs. Used by the `landing-content` plugin in vite.config.ts; runs in Node, ships no code to the browser.
 *
 * Template slots: `<!--t:landing.key-->` (catalog text, escaped), `<!--lang-->`, `<!--root-->` (relative path to the
 * site root: '' or '../'), `<!--alternates-->` (hreflang links), `<!--flags-->` (language selector), `<!--controls-->`,
 * `<!--notice-->`, `<!--version-->`, `<!--teaser-->`, `<!--changelog-->`, `<!--note-->` (« (in French) » outside fr).
 */
import { controlsFor as controlRowsFor, satireNoticeFor, type ControlRow } from '../content/controls';
import { catalog, translate, type Locale } from '../content/i18n';
import { flagSvg, type FlagId } from './flags';

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Where each landing page lives, relative to the site root. */
export const LANDING_PATHS: Readonly<Record<Locale, string>> = { fr: '', en: 'en/' };
const FLAG_OF: Readonly<Record<Locale, FlagId>> = { fr: 'fr', en: 'us' };

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

const frDate = (iso: string): string =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const TEASER_NOTES = 3;

export interface LandingControls {
  rows: readonly ControlRow[];
  notice: string;
}

/** The controls table and satire notice of a landing page: the same per-locale texts as the game. */
export function controlsFor(l: Locale): LandingControls {
  return { rows: controlRowsFor(l), notice: satireNoticeFor(l) };
}

export interface LandingContext {
  version: string;
  /** CHANGELOG.md source (French; shown as is on every page). */
  changelog: string;
}

function flags(l: Locale, root: string, tr: (k: string) => string): string {
  const link = (to: Locale, label: string): string => {
    const current = to === l ? ' aria-current="page"' : '';
    const href = to === l ? './' : `${root}${LANDING_PATHS[to]}` || './';
    return `<a class="flag" href="${href}" hreflang="${to}" aria-label="${esc(label)}"${current}>${flagSvg(FLAG_OF[to])}</a>`;
  };
  return `<nav class="langs" aria-label="${esc(tr('landing.langNav'))}">${link('fr', tr('landing.flagFr'))}${link('en', tr('landing.flagEn'))}</nav>`;
}

function alternates(l: Locale, root: string): string {
  const href = (to: Locale): string => (to === l ? './' : `${root}${LANDING_PATHS[to]}` || './');
  return [
    `<link rel="alternate" hreflang="fr" href="${href('fr')}" vite-ignore />`,
    `<link rel="alternate" hreflang="en" href="${href('en')}" vite-ignore />`,
    `<link rel="alternate" hreflang="x-default" href="${href('fr')}" vite-ignore />`,
  ].join('\n    ');
}

function changelogFills(l: Locale, md: string, tr: (k: string) => string): Record<string, string> {
  const releases = parseChangelog(md);
  const latest = releases[0];
  const frLang = l === 'fr' ? '' : ' lang="fr"';
  const note = l === 'fr' ? '' : ` ${esc(tr('landing.inFrench'))}`;
  const list = (notes: string[], attr = ''): string => `<ul${attr}>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
  return {
    '<!--note-->': note,
    '<!--teaser-->': latest
      ? `<h2 class="news-title">${esc(tr('landing.news'))} <span>${esc(latest.version)}</span>${note}</h2>${list(latest.notes.slice(0, TEASER_NOTES), frLang)}`
      : '',
    '<!--changelog-->': releases
      .map(
        (r) =>
          `<section class="release"><h3>${esc(r.version)} <time datetime="${r.date}">${esc(frDate(r.date))}</time></h3>${list(r.notes)}</section>`,
      )
      .join('\n        '),
    '<!--frlang-->': frLang,
  };
}

/** The landing page of `l`: every slot of `template` filled. Throws on an unknown slot or key (caught at build time). */
export function renderLanding(template: string, l: Locale, ctx: LandingContext): string {
  const cat = catalog(l);
  const tr = (k: string): string => {
    if (!(k in cat)) throw new Error(`landing: unknown catalog key ${k}`);
    return translate(cat, l, k);
  };
  const root = LANDING_PATHS[l] === '' ? '' : '../';
  const { rows, notice } = controlsFor(l);
  const fills: Record<string, string> = {
    '<!--lang-->': l,
    '<!--root-->': root,
    '<!--alternates-->': alternates(l, root),
    '<!--flags-->': flags(l, root, tr),
    '<!--controls-->': rows
      .map((c) => `<tr><th scope="row">${esc(c.action)}</th><td>${esc(c.keyboard)}</td><td>${esc(c.touch)}</td></tr>`)
      .join('\n            '),
    '<!--notice-->': esc(notice),
    '<!--version-->': esc(ctx.version),
    ...changelogFills(l, ctx.changelog, tr),
  };
  const html = template
    .replace(/<!--t:([\w.]+)-->/g, (_, k: string) => esc(tr(k)))
    .replace(/<!--[\w]+-->/g, (slot) => {
      const v = fills[slot];
      if (v === undefined) throw new Error(`landing: unknown slot ${slot}`);
      return v;
    });
  return html;
}
