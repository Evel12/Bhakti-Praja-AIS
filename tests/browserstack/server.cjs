const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../frontend/dist');
const port = Number(process.env.BS_APP_PORT || 4178);
const backendPort = Number(process.env.BS_BACKEND_PORT || 8086);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build the main frontend before starting browser tests.');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/') || url.pathname === '/up') {
    const upstream = http.request({ host: '127.0.0.1', port: backendPort, path: req.url, method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${backendPort}` } }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Isolated backend unavailable.'); });
    req.pipe(upstream); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (_) { res.writeHead(400); res.end(); return; }
  if (pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); res.end(); return; }
  let file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(pathname)) { res.writeHead(404); res.end(); return; }
    file = path.join(root, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log(`Isolated browser-test frontend: http://127.0.0.1:${port}`));
