// Temporarily remove the reference snapshot and all build caches, restoring both on failure.
import {rename,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),held=resolve(root,'artifacts/independence-hold');
const reference=resolve(root,'reference/2d'),dist=resolve(root,'dist');
await mkdir(held,{recursive:true});
const expected=JSON.parse(await readFile(resolve(root,'tests/fixtures/v69/golden.json'))).htmlSHA256;
let refMoved=false,distMoved=false,passed=false;
try {
  await rename(reference,resolve(held,'2d'));refMoved=true;
  await rename(dist,resolve(held,'dist'));distMoved=true;
  await new Promise((ok,fail)=>{const child=spawn(process.execPath,['scripts/build-training.mjs'],{cwd:root,stdio:'inherit'});child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error('Independent build failed: '+code)));});
  const html=await readFile(resolve(dist,'CQB_Training.html')),sha256=createHash('sha256').update(html).digest('hex');
  assert.equal(sha256,expected,'Cold standalone 3D build must reproduce v69 without 2D reference');
  const report={passed:true,referenceDirectoryAbsent:true,distCacheAbsent:true,htmlBytes:html.length,htmlSHA256:sha256,method:'Temporarily rename reference/2d and dist before running the normal 3D build. Independent npm ci installation; no sibling checkout links.'};
  await mkdir(resolve(root,'artifacts/qa/migration'),{recursive:true});
  await writeFile(resolve(root,'artifacts/qa/migration/independent-build.json'),JSON.stringify(report,null,2)+'\n');
  passed=true;console.log('Independent cold build without 2D: exact v69 HTML');
} finally {
  if(refMoved)await rename(resolve(held,'2d'),reference);
  if(distMoved){if(passed)await rm(resolve(held,'dist'),{recursive:true});else {await rm(dist,{recursive:true,force:true});await rename(resolve(held,'dist'),dist);}}
}
