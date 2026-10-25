import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assemble } from '../reference/2d/tools/build.mjs';
import { startDevServer } from '../reference/2d/tools/dev.mjs';

test('development serves the assembled standalone document and the preserved baseline', async (t) => {
  const server = await startDevServer({ port: 0 });
  t.after(() => new Promise((done) => server.close(done)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const assembled = await assemble();
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), assembled.html);
  const baseline = await fetch(`${base}/CQB_Tactical.html`);
  assert.equal(await baseline.text(), assembled.html);
  const head = await fetch(base, { method: 'HEAD' });
  assert.equal(await head.text(), '');
  assert.equal(Number(head.headers.get('content-length')), Buffer.byteLength(assembled.html));
});

test('development endpoint exposes no arbitrary project files or writes', async (t) => {
  const server = await startDevServer({ port: 0 });
  t.after(() => new Promise((done) => server.close(done)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/.git/config`)).status, 404);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});
