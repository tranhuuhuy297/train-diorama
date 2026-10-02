// Build-free static server: no bundler, refuses dotfiles and the modules folder.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4317);
const HOST = process.env.HOST ?? '127.0.0.1';
const MODULES_DIRECTORY = 'node_modules';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function contentTypeFor(path) {
  return MIME_TYPES[extname(path)] ?? 'application/octet-stream';
}

// A blocked segment keeps the runtime build-free and refuses dotfiles.
function hasBlockedSegment(pathname) {
  return pathname.split('/').some(segment => segment.startsWith('.') || segment === MODULES_DIRECTORY);
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}

async function resolveFile(pathname) {
  let file = resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return { status: 403 };
  if (hasBlockedSegment(pathname)) return { status: 404 };
  try {
    let stats = await stat(file);
    if (stats.isDirectory()) {
      file = resolve(file, 'index.html');
      stats = await stat(file);
    }
    return { status: 200, file, size: stats.size };
  } catch {
    return { status: 404 };
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    send(res, 400, 'Bad Request');
    return;
  }
  if (pathname.includes('\0')) {
    send(res, 400, 'Bad Request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const resolved = await resolveFile(pathname);
  if (resolved.status === 403) {
    send(res, 403, 'Forbidden');
    return;
  }
  if (resolved.status === 404) {
    send(res, 404, 'Not Found');
    return;
  }

  const contentType = contentTypeFor(resolved.file);
  res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': resolved.size, 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  // A read error after the stat (EACCES, file removed) would otherwise crash the process
  // via an unhandled stream 'error' once headers are already sent.
  const body = createReadStream(resolved.file);
  body.on('error', () => res.destroy());
  body.pipe(res);
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
