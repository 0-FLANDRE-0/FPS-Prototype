import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';import {TrainingMedical} from '../apps/training/src/medical.js';
import {medicalAddressTable,mapMedicalAddress} from '../apps/training/src/medical-address.js';
import {extractMedical} from '../scripts/training-medical.mjs';import {createPhysics} from '../apps/training/src/physics.js';
import {traceShot} from '../apps/training/src/ballistics.js';import {shotBallistics} from '../apps/training/src/catalog.js';
const origin=(x,y)=>new Vector3(17+x,y,0),direction=new Vector3(0,0,-1);
async function shot(x,y,id='556_m855',random=()=>.001){const p=await createPhysics();const ballistics=shotBallistics(id),o=origin(x,y);
 const trace=traceShot(p,o,direction,ballistics,{random});return {p,event:{shotId:1,time:1,origin:o,direction,ammoId:id,ballistics,trace}};}
test('medical extracted dependency closure records exact original declaration hashes and excludes duplicate impact/armor engines',async()=>{
 const r=await extractMedical();assert.equal(await readFile(new URL('../apps/training/src/generated/legacy-medical.js',import.meta.url),'utf8'),r.source);
 const names=r.sources.flatMap(s=>s.declarations.map(d=>d.name));
 for(const n of ['applyDamageEvent','makeUnit','createMedical','tickMedical','processWoundEvent','validatePartDestructionFoundation'])assert.ok(names.includes(n));
 for(const n of ['resolveImpact','resolveRearArmorInteraction','rollPenetration','applyArmorDurabilityDamage'])assert.ok(!names.includes(n));
 for(const s of r.sources)for(const d of s.declarations)assert.match(d.sha256,/^[a-f0-9]{64}$/);
});
test('every 21 body mesh / side / detailed zone maps to canonical medical keys; direct neck avoids location-to-head alias',()=>{
 const m=new TrainingMedical(),table=medicalAddressTable();assert.equal(table.length,21);
 for(const row of table)for(const a of row.mappings){const normalized=m.legacy.normalizeMedicalImpactAddress(a.impactAddress,{hitPart:a.hitPart});assert.ok(normalized.medicalZone);}
 const neck=mapMedicalAddress({shapeId:'neck',bodyPart:'neck',hitPart:'neck',side:'front',region:'neck',zone:'throat_lower'});
 assert.equal(neck.hitPart,'neck');assert.equal(neck.impactAddress.fullAddress,'front.neck.neck.neck_base');
});
test('skin traversals produce one canonical event and wound per part, with original validators clean',async()=>{
 for(const [x,y,id]of [[.445,1.10,'556_m855'],[0,1.51,'556_m855'],[0,1.11,'556_m855'],[0,1.65,'556_m855']]){
  const {p,event}=await shot(x,y,id);try{const m=new TrainingMedical(),traceBefore=JSON.stringify(event.trace),armor=p.armorCondition.snapshot();
   const records=m.record(event,p).filter(r=>r.skinContact),parts=event.trace.bodyHits.flatMap(h=>h.parts);
   assert.equal(records.length,parts.length);assert.equal(m.actor.medical.wounds.length,parts.length);
   assert.equal(records[0].partKey,y===1.51?'neck':y===1.65?'head':parts[0].bodyPart);
   for(const r of records){assert.ok(r.woundId);assert.ok(r.bleedGrade);}
   assert.deepEqual(m.validate(),[]);assert.equal(JSON.stringify(event.trace),traceBefore);assert.deepEqual(p.armorCondition.snapshot(),armor);
   assert.deepEqual(m.record(event,p),[]);assert.deepEqual(m.validate(),[]);
  }finally{p.dispose();}
 }
});
test('armor stopped uses original blunt path with zero skin wounds and no armor wear reroll',async()=>{
 const {p,event}=await shot(0,1.335,'556_m855',()=>.999);try{const m=new TrainingMedical(),armor=p.armorCondition.snapshot();
  const r=m.record(event,p);assert.equal(r.filter(e=>e.skinContact).length,0);assert.equal(m.actor.medical.wounds.length,0);
  assert.equal(r[0].label,'피부 미접촉');assert.equal(m.actor.medical._lastDamageEvent.armorResult,'stopped');assert.ok(m.actor.medical.pain>0);
  assert.deepEqual(p.armorCondition.snapshot(),armor);assert.deepEqual(m.validate(),[]);
 }finally{p.dispose();}
});
test('60 seconds of fixed medical ticks changes blood/consciousness, pause freezes, reset exactly restores original initial state and repeats deterministically',async()=>{
 const {p,event}=await shot(.445,1.10);try{
  const m=new TrainingMedical(),initial=m.snapshot();m.record(event,p);const hit=m.snapshot();
  for(let i=1;i<=3600;i++)m.tick(1/60,1+i/60);const after=m.snapshot();
  assert.ok(after.medical.bloodMl<hit.medical.bloodMl);assert.ok(Number.isFinite(after.medical.consciousness));
  assert.ok(after.timeline.length>=60);assert.ok(after.timeline.every(row=>Number.isFinite(row.consciousness)));
  assert.deepEqual(after.errors,[]);for(let i=0;i<600;i++)m.tick(1/60,62+i/60,false);assert.deepEqual(m.snapshot(),after);
  assert.equal(m.actor.medical.resources?.aed||0,0);assert.equal(m.actor.medical.resources?.cpr||0,0);
  m.reset();assert.deepEqual(m.snapshot(),initial);m.record(event,p);for(let i=1;i<=3600;i++)m.tick(1/60,1+i/60);assert.deepEqual(m.snapshot(),after);
 }finally{p.dispose();}
});
