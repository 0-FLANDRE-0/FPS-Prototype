// Golden values are recorded once from the original v69 checkout, never from this project.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Vector3} from 'three';
const root=resolve(import.meta.dirname,'..'), record=process.argv.includes('--record');
const calculationsOnly=process.argv.includes('--calculations-only');
const sourceRoot=record?resolve(process.env.FPS_BASELINE_ROOT||''):root;
if(record)assert.ok(process.env.FPS_BASELINE_ROOT&&sourceRoot!==root,'Recording requires a separate original v69 checkout');
const sha=x=>createHash('sha256').update(x).digest('hex'), hash=x=>sha(JSON.stringify(x));
const {s0Context}=await import(pathToFileURL(resolve(sourceRoot,'scripts/training-s0-fixtures.mjs')));
const c=await s0Context(sourceRoot), result={s0:[],single:[],channels:[],gelatin:[]};
try {
  const fixtures=JSON.parse(await readFile(resolve(root,'tests/fixtures/imported/checks-s0-v38/fixtures.json')));
  for(const f of fixtures)for(const ammoId of ['545_ps_gs','556_m855'])for(const distance of [5,50])for(const armor of [false,true]) {
    c.reset({pose:f.pose,armor});
    const e=c.fire({target:new Vector3(...f.target),direction:new Vector3(...f.direction),distance,ammoId,shotId:1001,random:()=>f.randomValue??.001,isolateAnatomy:true});
    result.s0.push({name:f.name,ammoId,distance,armor,sha256:hash({trace:e.trace,medical:c.enemy.medical.snapshot()})});
  }
  const single=JSON.parse(await readFile(resolve(root,'tests/fixtures/v69/single-fixtures.json'))).rows;
  for(const f of single) {
    c.reset();const e=c.fire({target:new Vector3(...f.target),direction:new Vector3(...f.direction),ammoId:f.ammoId,shotId:1001,random:()=>.001,isolateAnatomy:true});
    result.single.push({name:f.name,ammoId:f.ammoId,sha256:hash({trace:e.trace,medical:c.enemy.medical.snapshot()})});
  }
  const wound=await import(pathToFileURL(resolve(sourceRoot,'apps/training/src/wound-channel.js')));
  const {CATALOG}=await import(pathToFileURL(resolve(sourceRoot,'apps/training/src/catalog.js')));
  for(const [id,ammo] of Object.entries(CATALOG.AMMO_REGISTRY))for(const speed of [400,700,ammo.ballistic.velocity]) {
    const input={ammoId:id,entryVelocityMps:speed,massKg:ammo.projectile.massG/1000,lengthM:.13,bodyPart:'leftArm',tissueIntervals:[{id:'bone',kind:'bone',intervals:[[.045,.052]]}]};
    const first=wound.computeWoundChannel(input),second=wound.computeWoundChannel({...input,lengthM:.3,bodyPart:'chest',entryVelocityMps:first.exitVelocityMps,stateIn:first.stateOut,tissueIntervals:[{id:'lung',kind:'lung',intervals:[[.02,.17]]}]});
    result.channels.push({ammoId:id,speed,armSHA256:hash(first),residualChestSHA256:hash(second)});
  }
  for(const id of Object.keys(wound.WOUND_PROFILES))result.gelatin.push({id,sha256:hash(wound.gelatinProfile(id))});
  result.htmlSHA256=sha(await readFile(resolve(sourceRoot,'dist/CQB_Training.html')));
  assert.equal(result.s0.length,240);assert.equal(result.single.length,28);assert.equal(result.channels.length*2,684);assert.equal(result.gelatin.length,5);
  const golden=resolve(root,'tests/fixtures/v69/golden.json');
  if(record)await writeFile(golden,JSON.stringify({source:'0-FLANDRE-0/CQB-HTML',commit:'e46c309c9181f9093efd91798f569074047ad40a',...result},null,2)+'\n');
  else {
    const {source,commit,...expected}=JSON.parse(await readFile(golden));
    if(calculationsOnly){delete result.htmlSHA256;delete expected.htmlSHA256;}
    assert.deepEqual(result,expected,'v69 unrounded JSON hashes and production HTML must be identical');
    await mkdir(resolve(root,'artifacts/qa/migration'),{recursive:true});
    await writeFile(resolve(root,'artifacts/qa/migration/identity.json'),JSON.stringify({passed:true,source,commit,s0:240,single:28,channels:684,gelatin:5,htmlCompared:!calculationsOnly,htmlSHA256:result.htmlSHA256},null,2)+'\n');
  }
  console.log(`${record?'Recorded':'Verified'} v69: 240 S0, 28 single shots, 684 channels, 5 gelatin references ${calculationsOnly?'(HTML difference intentionally excluded)':'and exact production HTML'}`);
} finally {c.dispose();}
