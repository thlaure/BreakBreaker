import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
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

/** Dev-only: lets the gameplay page save a canvas capture as the landing preview image. */
function savePreview(): Plugin {
  return {
    name: 'save-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-preview', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (d) => (body += d));
        req.on('end', () => {
          const m = body.match(/^data:image\/webp;base64,(.+)$/);
          if (!m) {
            res.statusCode = 400;
            res.end('expected image/webp data URL');
            return;
          }
          const buf = Buffer.from(m[1] ?? "", 'base64');
          writeFileSync('public/preview.webp', buf);
          res.end(String(buf.length));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [landingContent(), savePreview()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', jouer: 'jouer/index.html' },
    },
  },
});
