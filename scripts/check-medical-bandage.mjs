import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {s0Context} from './training-s0-fixtures.mjs';
import {Inventory} from '../apps/training/src/inventory.js';
import {SelfCare} from '../apps/training/src/medical-care.js';
import {BANDAGE,bandageRequiredWork,bandageProgress} from '../apps/training/src/medical-bandage.js';
const out='artifacts/qa/medical-overhaul-1';await mkdir(out,{recursive:true});
const c=await s0Context(),f=JSON.parse(await readFile('tests/fixtures/imported/checks-s0-v38/fixtures.json')).find(r=>r.name==='arm-muscle'&&r.pose==='standing'),rows=[],timing=[];
try{
 for(const ammoId of ['545_ps_gs','556_m855'])for(const resource of [100,3]){
  c.reset();const event=c.fire({target:new Vector3(...f.target),direction:new Vector3(...f.direction),ammoId,shotId:97000,isolateAnatomy:true}),bridge=c.enemy.medical,m=bridge.actor.medical;
  bridge.tick(1/60,1/60);
  const inventory=new Inventory({includeMedical:true}),care=new SelfCare({inventory,getMedical:()=>bridge,getFeedback:()=>({amplitudes:{tremor:1}})});inventory.setMedicalContainerOpen('ifak-01');
  const item=inventory.items.get('medical:bandage'),w=m.wounds.find(w=>w.partKey==='leftArm'),p=m.bodyParts[w.partKey];item.remaining=resource;
  for(const mode of ['game','realistic','reality'])for(const condition of ['healthy','near-zero-function','one-crushed-arm','pain-and-tremor']){
   const saved=[m.bodyParts.rightArm.functionRatio,m.bodyParts.rightArm.s2Comminuted,m.pain,m.stressResponse.perceivedPain];
   inventory.treatmentMode=mode;
   if(condition==='near-zero-function')m.bodyParts.rightArm.functionRatio=.001;
   if(condition==='one-crushed-arm')m.bodyParts.rightArm.s2Comminuted=true;
   if(condition==='pain-and-tremor')m.pain=m.stressResponse.perceivedPain=99;
   const seconds=care.preview(item.instanceId,{woundId:w.id}).timing.estimatedSeconds;assert.equal(seconds,4);if(rows.length===0)timing.push({mode,condition,seconds});
   [m.bodyParts.rightArm.functionRatio,m.bodyParts.rightArm.s2Comminuted,m.pain,m.stressResponse.perceivedPain]=saved;
  }
  const initial={hp:p.hp,maxHp:p.maxHp,bloodMl:m.bloodMl,externalFlowMlPerS:m.externalBleedRate,internalFlowMlPerS:m.internalBleedRate,requiredWork:bandageRequiredWork(m,w)};
  assert.ok(care.request(item.instanceId,{woundId:w.id}));const started=bridge.time;
  for(let i=0;i<300&&care.active;i++){care.step(1/60);bridge.tick(1/60,bridge.time+1/60);}
  const t=care.list[0];assert.equal(t.status,'completed');assert.ok(Math.abs(t.appliedAtS-started-4)<1e-8);assert.equal(p.hp,initial.hp);
  const completed={timeS:t.appliedAtS,used:t.consumedUnits,remaining:item.remaining,hemostasisProgress:bandageProgress(w),externalFlowMlPerS:m.externalBleedRate,internalFlowMlPerS:m.internalBleedRate,hp:p.hp,bloodMl:m.bloodMl};
  for(let i=0;i<20000&&m.partRecovery[w.partKey].active;i++)bridge.tick(1/60,bridge.time+1/60);
  assert.equal(p.hp,p.maxHp);assert.equal(p.maxHp,initial.maxHp);assert.ok(m.bloodMl<=initial.bloodMl);
  rows.push({ammoId,fixture:f.name,resource,initial,completed,final:{hp:p.hp,maxHp:p.maxHp,bloodMl:m.bloodMl,recoveryAfterCompletionS:bridge.time-t.appliedAtS,remainingFunction:p.functionRatio,destructionFunctionalCap:p.destructionFunctionalCap},directHits:w.s1OrganDamage?.filter(h=>h.direct).map(h=>h.id),cavityHits:w.s1OrganDamage?.filter(h=>!h.direct).map(h=>h.id),projectileVelocityOut:event.trace.residual.velocityMps});
 }
 await writeFile(out+'/clinical.json',JSON.stringify({passed:true,policy:BANDAGE,method:'Actual S0 arm-muscle rays, original fixed1/60 medical tick; real healthy injury cases separate from explicitly altered timing-only conditions.',timing,rows},null,2)+'\n');
 console.log('Bandage clinical table passed:4 real hits,12 timing conditions; exact part maximum without added blood');
}finally{c.dispose();}
