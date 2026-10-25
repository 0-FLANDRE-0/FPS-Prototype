import test from'node:test';import assert from'node:assert/strict';
import{computeWoundChannel,gelatinProfile,woundProfile,WOUND_S1_VALUES}from'../apps/training/src/wound-channel.js';
import{CATALOG}from'../apps/training/src/catalog.js';import{s0Context}from'../scripts/training-s0-fixtures.mjs';import{Vector3}from'three';import{readFile}from'node:fs/promises';
// S3 keeps M855 as original yaw-only; use the original fragment type for fragmentation invariants.
const shot={ammoId:'556_m193',entryVelocityMps:879,massKg:.00356,lengthM:.3,bodyPart:'leftLeg'};
test('authoritative wound curve conserves projectile/fragment energy and mass while slowing without RNG or mutation',()=>{
 const input=structuredClone(shot),a=computeWoundChannel(input),b=computeWoundChannel(input);assert.deepEqual(input,shot);assert.deepEqual(a,b);assert.ok(a.fragmentation);assert.ok(a.steps.every(s=>s.velocityOutMps<=s.velocityInMps&&s.velocityOutMps>=0));
 for(const s of a.steps)assert.ok(Math.abs(s.massKg+s.fragmentMassKg-shot.massKg)<1e-12);
 const remaining=.5*a.stateOut.massKg*a.predictedExitVelocityMps**2+a.stateOut.fragmentEnergyJ;assert.ok(Math.abs(.5*shot.massKg*shot.entryVelocityMps**2-a.energyLostJ-remaining)<1e-7);assert.equal(a.geometryQueriesPerStep,0);
});
test('yaw and fragmentation require occupied depth and the tuned entry-speed threshold',()=>{
 const short=computeWoundChannel({...shot,lengthM:.06}),low=computeWoundChannel({...shot,entryVelocityMps:700,lengthM:.6}),high=computeWoundChannel({...shot,lengthM:.6});
 assert.equal(short.fragmentation,false);assert.equal(low.fragmentation,false);assert.equal(high.fragmentation,true);assert.ok(short.damageMultiplier<high.damageMultiplier);assert.ok(low.volumes.fragmentM3===0&&high.volumes.fragmentM3>0);assert.equal(high.fragmentationThresholdMps,780);
});
test('tissue coefficients affect only temporary-cavity damage; permanent and fragment injury retain coefficient1',()=>{
 const geometry={id:'tissue',kind:'organ',identifier:'x',volumeM3:.001,surfaceDistanceM:0,closestDepthM:.15,cavityIntervals:[[0,.3]]},hit={id:'tissue',traversedLengthM:.3,intervals:[[0,.3]]};
 const a=computeWoundChannel({...shot,internalHits:[hit],cavityCandidates:[{...geometry,organ:'lung'}]}),b=computeWoundChannel({...shot,internalHits:[hit],cavityCandidates:[{...geometry,organ:'liver'}]});
 assert.equal(a.organs[0].permanentVolumeM3,b.organs[0].permanentVolumeM3);assert.equal(a.organs[0].fragmentVolumeM3,b.organs[0].fragmentVolumeM3);assert.ok(a.organs[0].effectiveVolumeM3<b.organs[0].effectiveVolumeM3);
 for(const r of[a,b]){const o=r.organs[0];assert.ok(Math.abs(o.effectiveVolumeM3-o.permanentVolumeM3-o.fragmentVolumeM3-o.coefficient*o.temporaryVolumeM3)<1e-12);assert.ok(Math.abs(o.severity-Math.min(1,o.effectiveVolumeM3/o.volumeM3*WOUND_S1_VALUES.organSeverityGain))<1e-12);}
});
test('cached cavity-only organs receive separate damage without adding a direct intersection or a bone fracture',()=>{
 const candidates=[{id:'near-liver',kind:'organ',organ:'liver',volumeM3:.001,surfaceDistanceM:.01,closestDepthM:.09,cavityIntervals:[[0,.24]]},{id:'bone',kind:'bone',volumeM3:.001,surfaceDistanceM:0,closestDepthM:.1,cavityIntervals:[[0,.24]]}],copy=structuredClone(candidates),a=computeWoundChannel({ammoId:'545_ps_gs',entryVelocityMps:890,massKg:.00343,lengthM:.24,bodyPart:'abdomen',cavityCandidates:candidates});
 assert.deepEqual(candidates,copy);assert.ok(a.organs.some(o=>o.id==='near-liver'&&!o.direct&&o.severity>0));assert.equal(a.organs.some(o=>o.kind==='bone'),false);
});
test('Fackler primary gelatin dimensions are fitted within source readout uncertainty; pistol has no invented source table',()=>{
 const targets={ak74:[.52,.1,.145,.02],m193:[.36,.185,.14,.02],ak47:[.74,.41,.14,.03],m80:[.64,.28,.185,.02]};
 for(const[id,[depth,peak,diam,error]]of Object.entries(targets)){const r=gelatinProfile(id);assert.ok(Math.abs(r.predictedPenetrationM-depth)<=.006);assert.ok(Math.abs(r.maximumTemporaryDepthM-peak)<=error);assert.ok(Math.abs(r.maximumTemporaryDiameterM-diam)<1e-9);}
 assert.equal(gelatinProfile('pistol').sourceReadout,null);
});
test('all existing registry cartridges have explicit borrowed/source mappings without changing original damage or HP tables',()=>{for(const id of Object.keys(CATALOG.AMMO_PRESETS)){const p=woundProfile(id);assert.ok(p.profileId&&p.diameterM>0&&p.mappingClassification);assert.equal(p.ammoId,id);}assert.throws(()=>woundProfile('invented_ammo'));assert.equal(woundProfile('300blk_fmj_147').profileId,'ak47');});
test('multi-part real shots reuse each authoritative channel with actual slowed entry speed, yaw and clipped stop length',async()=>{
 const fixtures=JSON.parse(await readFile('tests/fixtures/imported/checks-s0-v38/fixtures.json')),f=fixtures.find(f=>f.name==='liver'&&f.pose==='standing'),c=await s0Context();try{
  c.reset();const e=c.fire({target:new Vector3(...f.target),direction:new Vector3(...f.direction),isolateAnatomy:true,shotId:1001}),parts=e.trace.bodyHits.flatMap(b=>b.parts),records=c.enemy.medical.events.filter(r=>r.woundChannel);assert.ok(parts.length>1);assert.equal(parts.length,records.length);
  for(let i=0;i<parts.length;i++){const p=parts[i],r=records[i],w=r.woundChannel;assert.deepEqual(w,p.woundChannel);assert.equal(w.entryVelocityMps,p.velocityInMps);assert.ok(Math.abs(w.traversedLengthM-p.lengthM)<1e-9);assert.ok(w.lengthM>=p.lengthM-1e-9);assert.equal(w.exitVelocityMps,p.velocityOutMps);assert.ok(w.damageMultiplier>=.1&&w.damageMultiplier<=1);if(i){assert.ok(p.velocityInMps<=parts[i-1].velocityOutMps+1e-9);assert.ok(w.stateOut.occupiedDepthM>records[i-1].woundChannel.stateOut.occupiedDepthM);} }
 }finally{c.dispose();}
});
test('actual armor residual speed enters the channel and neither residual breakup nor stability becomes initial tissue yaw',async()=>{const c=await s0Context();try{c.reset({armor:true});const e=c.fire({target:c.center('brain'),isolateAnatomy:true}),body=e.trace.bodyHits[0],r=c.enemy.medical.events.find(r=>r.woundChannel);assert.ok(e.trace.armorResults.some(a=>a.outcome==='penetrated'));assert.ok(r.entryVelocityMps<e.ballistics.muzzleVelocityMps);assert.equal(r.woundChannel.entryVelocityMps,body.parts[0].velocityInMps);assert.equal(r.woundChannel.initialYawRad,0);assert.equal(r.woundChannel.armorDeformationApplied,false);assert.equal(r.woundChannel.armorYawApplied,false);assert.equal(body.velocityOutMps,body.after.velocityMps);}finally{c.dispose();}});
