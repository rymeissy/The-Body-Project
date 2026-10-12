/* Server statis sederhana untuk preview prototype.
   Jalankan:  node serve.js  [port]                                     */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let rel = url === '/' ? '/index.html' : url;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');

  const file = path.join(ROOT, rel);

  // Cegah path traversal di luar ROOT
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
         .end('404 Not Found: ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }).end(buf);
  });
}).listen(PORT, () => {
  console.log('Prototype berjalan di http://localhost:' + PORT);
});
