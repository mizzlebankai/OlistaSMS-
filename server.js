const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;
const WEB_ROOT = path.resolve(__dirname, '..', 'olistar-school-web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function resolveFilePath(reqUrl) {
  let reqPath = decodeURIComponent(reqUrl.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/login.html';

  let normalized = path.normalize(reqPath).replace(/^[\\\/]+/, '').replace(/^(\.\.[\/\\])+/, '');

  // 1. Explicit request to olistar-school-web
  if (/^olistar-school-web([\\\/]|$)/i.test(normalized)) {
    let rel = normalized.replace(/^olistar-school-web[\\\/]?/i, '');
    if (!rel) rel = 'index.html';
    let target = path.join(WEB_ROOT, rel);
    try {
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        target = path.join(target, 'index.html');
      }
    } catch (_) {}
    return { filePath: target, reqPath };
  }

  // 2. Explicit request to OLISTAR
  if (/^olistar([\\\/]|$)/i.test(normalized)) {
    let rel = normalized.replace(/^olistar[\\\/]?/i, '');
    if (!rel) rel = 'login.html';
    let target = path.join(ROOT, rel);
    try {
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        target = path.join(target, 'login.html');
      }
    } catch (_) {}
    return { filePath: target, reqPath };
  }

  // 3. Check in OLISTAR (ROOT) first
  let rootTarget = path.join(ROOT, normalized);
  try {
    if (fs.existsSync(rootTarget)) {
      if (fs.statSync(rootTarget).isDirectory()) {
        rootTarget = path.join(rootTarget, 'login.html');
      }
      return { filePath: rootTarget, reqPath };
    }
  } catch (_) {}

  // 4. Fallback check in olistar-school-web (WEB_ROOT)
  let webTarget = path.join(WEB_ROOT, normalized);
  try {
    if (fs.existsSync(webTarget)) {
      if (fs.statSync(webTarget).isDirectory()) {
        webTarget = path.join(webTarget, 'index.html');
      }
      return { filePath: webTarget, reqPath };
    }
  } catch (_) {}

  return { filePath: rootTarget, reqPath };
}

const server = http.createServer((req, res) => {
  const { filePath, reqPath } = resolveFilePath(req.url);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

function startServer(port) {
  server.removeAllListeners('error');
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log('==============================================');
    console.log('  Olistar School Portal Server Running');
    console.log(`  Local: http://localhost:${port}/login.html`);
    console.log(`  Local: http://127.0.0.1:${port}/login.html`);
    console.log('==============================================');
  });
}

startServer(PORT);
