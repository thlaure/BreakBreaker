import { defineConfig, type Plugin } from 'vite';
import { CONTROLS, RULES, SATIRE_NOTICE } from './src/content/controls';
import { CONFIG } from './src/sim/config';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Inlines the shared rules/controls/notice/version into the landing page only (no client JS). */
function landingContent(): Plugin {
  const fills: Record<string, string> = {
    '<!--rules-->': RULES.map((r) => `<li>${esc(r)}</li>`).join('\n          '),
    '<!--controls-->': CONTROLS.map(
      (c) =>
        `<tr><th scope="row">${esc(c.action)}</th><td>${esc(c.keyboard)}</td><td>${esc(c.touch)}</td></tr>`,
    ).join('\n            '),
    '<!--notice-->': esc(SATIRE_NOTICE),
    '<!--version-->': esc(CONFIG.rulesVersion),
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
  plugins: [landingContent()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', jouer: 'jouer/index.html' },
    },
  },
});
