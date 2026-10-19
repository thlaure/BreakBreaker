import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
http.createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
    const data = await readFile(path === root ? root + '/index.html' : path);
    res.writeHead(200, {'Content-Type': types[extname(path)] || 'text/html; charset=utf-8', 'Cache-Control':'no-cache'}); res.end(data);
  } catch { res.writeHead(404); res.end('Introuvable'); }
}).listen(53827, '127.0.0.1', () => console.log('BreakBreaker local: http://127.0.0.1:53827'));
