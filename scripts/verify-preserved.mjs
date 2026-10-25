import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('docs/migration-v69/preserved-files.json'));
for(const f of manifest.files) {
  const bytes=await readFile(f.path);
  assert.equal(bytes.length,f.bytes,f.path+' size');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path+' SHA-256');
}
await mkdir('artifacts/qa/migration',{recursive:true});
await writeFile('artifacts/qa/migration/preserved.json',JSON.stringify({passed:true,sourceCommit:manifest.sourceCommit,files:manifest.files.length},null,2)+'\n');
console.log(`Preserved ${manifest.files.length} runtime, asset and reference files exactly`);
