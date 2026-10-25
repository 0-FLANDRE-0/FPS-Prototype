import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assemble, build, projectPath } from '../reference/2d/tools/build.mjs';
import { verifyBaseline } from '../reference/2d/tools/verify-baseline.mjs';

async function fixture(t, script = 'const value = "$&";\nfunction later() { return value; }\n') {
  const root = await mkdtemp(resolve(tmpdir(), 'cqb-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src'));
  const manifest = { schemaVersion: 1, template: 'src/index.template.html', styles: ['src/app.css'], scripts: [{ path: 'src/one.js' }] };
  await writeFile(resolve(root, 'src/manifest.json'), JSON.stringify(manifest));
  await writeFile(resolve(root, 'src/index.template.html'), '<style>/* @cqb:styles */</style><script>/* @cqb:scripts */</script>');
  await writeFile(resolve(root, 'src/app.css'), 'body { color: red; }\n');
  await writeFile(resolve(root, 'src/one.js'), script);
  return { root, manifest, script };
}

test('current extraction reproduces all original HTML bytes', async () => {
  const result = await verifyBaseline();
  assert.equal(result.gitBlob, 'ff20dc25c9835698c7a90653014d0fe0d51eda30');
  assert.equal(result.bytes, 3641864);
});

test('sources assemble deterministically as a single classic script', async () => {
  const first = await assemble();
  const second = await assemble();
  assert.equal(first.html, second.html);
  assert.equal(first.info.htmlSha256, second.info.htmlSha256);
  assert.equal((first.html.match(/<script>/g) || []).length, 1);
  assert.equal((first.html.match(/<style>/g) || []).length, 1);
  assert.ok(first.manifest.scripts.some((part) => part.path === 'src/input/pointer.js'));
  assert.ok(first.info.sources.every((source) => source.generatedEndLine >= source.generatedStartLine));
});

test('build works without reading the original HTML and keeps literal replacement tokens', async (t) => {
  const { root, script } = await fixture(t);
  const result = await build({ root });
  assert.equal(result.script, script);
  assert.equal(await readFile(result.output, 'utf8'), `<style>body { color: red; }\n</style><script>${script}</script>`);
});

test('missing or repeated template markers fail before output', async (t) => {
  const { root } = await fixture(t);
  const template = resolve(root, 'src/index.template.html');
  await writeFile(template, '<style>/* @cqb:styles */</style>');
  await assert.rejects(assemble({ root }), /exactly one/);
  await writeFile(template, '/* @cqb:styles *//* @cqb:styles *//* @cqb:scripts */');
  await assert.rejects(assemble({ root }), /exactly one/);
});

test('duplicate and escaping manifest paths are rejected', async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.scripts.push(manifest.scripts[0]);
  await writeFile(resolve(root, 'src/manifest.json'), JSON.stringify(manifest));
  await assert.rejects(assemble({ root }), /Duplicate/);
  assert.throws(() => projectPath(root, '../outside.js'), /escapes/);
});

test('invalid fragment syntax and closing script tags fail visibly', async (t) => {
  const { root } = await fixture(t, 'function incomplete( {');
  await assert.rejects(assemble({ root }), SyntaxError);
  await writeFile(resolve(root, 'src/one.js'), 'const closing = "</script>";');
  await assert.rejects(assemble({ root }), /closing inline HTML tag/);
});
