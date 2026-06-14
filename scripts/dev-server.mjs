import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 5173);
const root = process.cwd();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function resolveRequestPath(pathname) {
  const appPath =
    pathname === '/chatgpt' || pathname === '/chatgpt/' || pathname === '/'
      ? '/index.html'
      : pathname.replace(/^\/chatgpt(?=\/)/, '');
  const decodedPath = decodeURIComponent(appPath);
  const filePath = resolve(root, `.${decodedPath}`);
  const relativePath = relative(root, filePath);
  const isAllowedAsset =
    relativePath === 'index.html' || relativePath === 'config.js' || relativePath.startsWith(`src${sep}`);

  if (relativePath.startsWith('..') || relativePath.includes(`..${sep}`) || !isAllowedAsset) {
    return null;
  }

  return filePath;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': types[extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AstranoV ChatGPT dev server running at http://localhost:${port}/chatgpt/`);
});
