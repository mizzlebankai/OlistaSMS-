const http = require('http');
const fs = require('fs');
const path = require('path');
const { deleteAuthUser } = require('./server-auth-delete');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;
const MAX_API_BODY_BYTES = 16 * 1024;

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

  // Explicit request to OLISTAR
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

  // Check in OLISTAR (ROOT)
  let rootTarget = path.join(ROOT, normalized);
  try {
    if (fs.existsSync(rootTarget)) {
      if (fs.statSync(rootTarget).isDirectory()) {
        rootTarget = path.join(rootTarget, 'login.html');
      }
      return { filePath: rootTarget, reqPath };
    }
  } catch (_) {}

  return { filePath: rootTarget, reqPath };
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/delete-auth-user') {
    let body = '';
    let bodyBytes = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_API_BODY_BYTES) {
        rejected = true;
        return;
      }
      if (!rejected) body += chunk;
    });
    req.on('end', async () => {
      if (rejected) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Request is too large.' }));
        return;
      }
      try {
        const result = await deleteAuthUser({
          uid: JSON.parse(body || '{}').uid,
          idToken: String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error.statusCode || 500, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify({ error: error.message || 'Unable to delete Auth account.' }));
      }
    });
    return;
  }

  const { filePath, reqPath } = resolveFilePath(req.url);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
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
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self' https://www.gstatic.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https://placehold.co https://*.googleusercontent.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdn.jsdelivr.net https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com; frame-src https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
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
