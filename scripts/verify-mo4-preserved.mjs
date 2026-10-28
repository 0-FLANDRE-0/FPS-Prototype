import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('docs/mo4-preserved-files.json'));
for(const f of manifest.files){const b=await readFile(f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256,f.path);}
const out='artifacts/qa/mo4';await mkdir(out,{recursive:true});
const report={passed:true,baseline:manifest.baseline,count:manifest.files.length,files:manifest.files.map(({path,sha256})=>({path,sha256})),intentionalModifiedPaths:manifest.intentionalModifiedPaths,method:'Committed MO3 SHA256 manifest; no historical checkout, sibling repo or 2D extraction needed.'};
await writeFile(out+'/preserved.json',JSON.stringify(report,null,2)+'\n');console.log('MO4 preserved runtime/assets/reference:',report.count);
