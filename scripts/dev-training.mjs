import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { buildTraining } from './build-training.mjs';
const result = await buildTraining();
const port = Number(process.env.CQB_TRAINING_PORT || 5174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CQB_TRAINING_PORT must be 1–65535');
const host = process.env.CQB_TRAINING_HOST || '127.0.0.1';
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (!['/', '/CQB_Training.html'].includes(request.url?.split('?')[0])) { response.writeHead(404); response.end(); return; }
  try {
    const html = await readFile(result.path);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch { response.writeHead(503); response.end('Run npm run build:training to restore the preview file.'); }
});
server.on('error', error => { console.error(`Cannot start training preview on ${host}:${port}: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Training preview: http://${host}:${port} (npm run build:training, then reload after source changes)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
