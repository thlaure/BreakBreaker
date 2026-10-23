import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { renderLanding } from './src/site/landingContent';
import { CONFIG } from './src/sim/config';

/** The English landing has no file of its own: it is the shared index.html template, rendered in English. */
const EN_PAGE = resolve('en/index.html');

/**
 * Generates the static landing pages from index.html and the catalogs (no client JS): `/` in French, `/en/` in English.
 * The controls, notice, version and changelog are inlined; the rules live in the game.
 */
function landingContent(): Plugin {
  const render = (html: string, path: string): string =>
    renderLanding(html, path === '/en/index.html' ? 'en' : 'fr', {
      version: CONFIG.appVersion,
      changelog: { fr: readFileSync('CHANGELOG.md', 'utf8'), en: readFileSync('CHANGELOG.en.md', 'utf8') },
    });
  return {
    name: 'landing-content',
    resolveId(id) {
      return resolve(id) === EN_PAGE ? EN_PAGE : null;
    },
    load(id) {
      return id === EN_PAGE ? readFileSync('index.html', 'utf8') : null;
    },
    // dev server: /en/ is served from the same template
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url !== `${server.config.base}en/` && url !== `${server.config.base}en/index.html`) return next();
        server
          .transformIndexHtml('/en/index.html', readFileSync('index.html', 'utf8'))
          .then((html) => res.setHeader('Content-Type', 'text/html').end(html))
          .catch(next);
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path !== '/index.html' && ctx.path !== '/en/index.html') return html;
        return render(html, ctx.path);
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
      input: { main: 'index.html', en: 'en/index.html', play: 'play/index.html' },
    },
  },
});
