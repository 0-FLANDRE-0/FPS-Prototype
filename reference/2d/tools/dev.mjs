import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, projectRoot } from './build.mjs';

export async function startDevServer({ root = projectRoot, host = '127.0.0.1', port = 5173 } = {}) {
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    try {
      let html;
      if (pathname === '/' || pathname === '/index.html' || pathname === '/dist/CQB_Tactical.html') {
        html = (await assemble({ root })).html;
      } else if (pathname === '/CQB_Tactical.html') {
        html = await readFile(resolve(root, 'CQB_Tactical.html'), 'utf8');
      } else if (pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      } else {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html),
      });
      response.end(request.method === 'HEAD' ? undefined : html);
    } catch (error) {
      console.error(`Request build failed: ${error.message}`);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Build failed. See the development terminal.');
    }
  });
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolveReady();
    });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let host = '127.0.0.1';
    let port = 5173;
    const args = process.argv.slice(2);
    while (args.length) {
      const option = args.shift();
      const value = args.shift();
      if (option === '--host' && value) host = value;
      else if (option === '--port' && value && /^\d+$/.test(value)) port = Number(value);
      else throw new Error('Usage: npm run dev -- [--host address] [--port number]');
    }
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
    const server = await startDevServer({ host, port });
    console.log(`CQB development server: http://${host}:${server.address().port}`);
    console.log('Reload after editing src/. Every request assembles the current sources.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  } catch (error) {
    console.error(`Development server failed: ${error.message}`);
    process.exitCode = 1;
  }
}
