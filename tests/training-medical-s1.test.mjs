import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {s0Context} from '../scripts/training-s0-fixtures.mjs';
import {applyWoundChannelEffectsS1,cavityNeuroTargetS1,aortaFlowS1,createMedicalS1Slots,MEDICAL_S1_PHYSIOLOGY_VALUES} from '../apps/training/src/medical-s1-effects.js';
import {criticalAnatomyS0,applyCardiacPumpS0} from '../apps/training/src/medical-s0.js';
const organ=(id,organ,severity,direct=true,extra={})=>({id,organ,kind:'organ',identifier:id,direct,volumeM3:.001,effectiveVolumeM3:.001*severity/4,severity,...extra});
const wound=organs=>({id:1,partKey:'chest',bodyTrajectory:{woundChannel:{organs},internalGeometry:{internalHits:[],nearMisses:[]}},physiologicInjuries:[{type:'lung_injury',severity:1,effects:{breathingDrain:.1}}]});
test('S1 organ volume severity changes both retained injury severity and effective physiology, without fabricating direct geometry',()=>{
 const low=wound([organ('left-lung','lung',.1)]),high=wound([organ('left-lung','lung',.8)]);
 for(const w of [low,high])applyWoundChannelEffectsS1(w,w.bodyTrajectory);
 assert.equal(low.physiologicInjuries[0].type,'lung_injury');assert.equal(low.physiologicInjuries[0].severity,.1);
 assert.equal(low.physiologicEffectProfile.breathingDrain,0);assert.equal(high.physiologicEffectProfile.breathingDrain,0);
 assert.equal(low.physiologicEffectProfile.oxygenDrain,0);assert.equal(high.physiologicEffectProfile.oxygenDrain,0);
 assert.deepEqual(low.bodyTrajectory.internalGeometry.internalHits,[]);
 assert.equal(low.organInjuryModel.injuries[0].severity,.1);
 const snapshot=structuredClone(low);applyWoundChannelEffectsS1(low,low.bodyTrajectory);assert.deepEqual(low,snapshot);
});
test('TC-only organ and vessel damage has separate evidence and enters existing respiratory and vascular paths',()=>{
 const w=wound([organ('right-lung','lung',.4,false),organ('thoracic-aorta','vessel',.3,false,{kind:'vessel',identifier:'aorta_vessel_injury',vesselKind:'artery'})]);
 const r={buildVascularEvidence:()=>({level:'none',vesselClass:'none',vesselKinds:[]})},original={buildVascularEvidence:view=>({level:'confirmed',vesselClass:'major_named',confirmedVessels:view.confirmedInjuries})};
 applyWoundChannelEffectsS1(w,w.bodyTrajectory);const evidence=createMedicalS1Slots(r,original).buildVascularEvidence(w);
 assert.equal(w.chestTraumaModel,undefined);assert.ok(w.physiologicEffectProfile.internalBleedBoost>0);
 assert.deepEqual(evidence.cavityDamage,['aorta_vessel_injury']);assert.deepEqual(evidence.vesselKinds,['artery']);
 assert.equal(w.s1CavityInjuries.length,2);assert.ok(w.s1CavityInjuries.every(i=>!i.confirmed));assert.deepEqual(w.bodyTrajectory.internalGeometry.internalHits,[]);
});
test('TC-only CNS exposure is a continuous consciousness input and does not become a direct brainstem or spinal collapse',()=>{
 const w=wound([organ('brain','brain',.4,false),organ('upper-cord','spinal_cord',.9,false),organ('brainstem','brainstem',.2,false)]);
 w.partKey='head';applyWoundChannelEffectsS1(w,w.bodyTrajectory);
 const m={wounds:[w],bodyParts:{},consciousness:100,consciousnessTarget:100};criticalAnatomyS0({medical:m});
 assert.equal(m.brainInjury,null);assert.equal(m.consciousness,100);assert.equal(m.cardiacArrest,undefined);
 assert.equal(cavityNeuroTargetS1(m).targetCap,60);assert.equal(w.physiologicInjuries.find(i=>i.organ==='spinal_cord').recordOnly,true);
});
test('S1 heart pump uses effective organ severity and an eight-second cerebral reserve while compatibility has no fabricated volume',()=>{
 const w=wound([organ('heart','heart_hook_only',.9,false)]),unit={medical:{wounds:[w],bodyParts:{},breathingEfficiency:100,hemodynamics:{cardiacOutputMul:1,strokeVolumeMul:1,pulsePressure:40,map:93}}};
 criticalAnatomyS0(unit);assert.ok(Math.abs(unit.medical.heartInjury.pumpFunction-.109)<1e-12);assert.equal(unit.medical.heartInjury.reserveTauS,8);assert.equal(unit.medical.brainInjury,null);
 applyCardiacPumpS0(unit,1/60);assert.ok(unit.medical.hemodynamics.map<11);assert.ok(unit.medical.hemodynamics.cerebralReserveMap>92);assert.equal(unit.medical.heartInjury.hits[0].direct,false);
 const untouched={physiologicInjuries:[{severity:.7}]};assert.equal(applyWoundChannelEffectsS1(untouched,{}),false);assert.deepEqual(untouched.physiologicInjuries,[{severity:.7}]);
});
test('aorta opening uses fitted vessel diameter, has a cardiac-flow cap, and does not replace femoral finalization',()=>{
 const small=aortaFlowS1(.2,.012),large=aortaFlowS1(.2,.024);assert.ok(Math.abs(large.orificeMlS/small.orificeMlS-4)<1e-12);assert.ok(aortaFlowS1(1,.05).sourceFlowMlS<=MEDICAL_S1_PHYSIOLOGY_VALUES.restingCardiacOutputMlMin/60*MEDICAL_S1_PHYSIOLOGY_VALUES.aortaFlowReserve);
 const r={finalizeBleedingProfileWithEvidence:w=>{w.bleedingProfile={currentInternal:10,currentExternal:5,sustainedInternal:10};}},adapter=createMedicalS1Slots(r,{}),f=wound([organ('femoral','vessel',1,true,{kind:'vessel',identifier:'femoral_vessel_injury'})]);f.s1OrganDamage=f.bodyTrajectory.woundChannel.organs;
 adapter.finalizeBleedingProfileWithEvidence(f);assert.deepEqual(f.bleedingProfile,{currentInternal:10,currentExternal:5,sustainedInternal:10});
 const a=wound([organ('aorta','vessel',1,true,{kind:'vessel',identifier:'aorta_vessel_injury',diameterM:.024,diameterSource:'test collider'})]);a.s1OrganDamage=a.bodyTrajectory.woundChannel.organs;adapter.finalizeBleedingProfileWithEvidence(a);
 assert.equal(a.bleedingProfile.s1AortaFlow.diameterM,.024);assert.equal(a.bleedingProfile.s1AortaFlow.diameterSource,'test collider');assert.equal(a.bleedingProfile.majorVesselLocked,true);
});
test('real standing heart tracks for 7N6 and M855 use measured volume severity and incapacitate within the S1 seven-to-fifteen-second window',async()=>{
 const fixtures=JSON.parse(await readFile(new URL('./fixtures/imported/checks-s0-v38/fixtures.json',import.meta.url))),fixture=fixtures.find(f=>f.name==='heart'&&f.pose==='standing'),c=await s0Context();
 try{for(const ammoId of['545_ps_gs','556_m855']){
  c.reset();c.fire({target:new Vector3(...fixture.target),direction:new Vector3(...fixture.direction),shotId:1001,ammoId});const m=c.enemy.medical.actor.medical,
    cardiac=m.wounds.flatMap(w=>w.s1OrganDamage||[]).find(o=>o.id==='heart'&&o.direct);
  assert.ok(cardiac);assert.ok(cardiac.severity>0&&cardiac.severity<=1);assert.equal(m.consciousness,100);assert.equal(m.isDowned,false);assert.equal(m.heartInjury.reserveTauS,8);
  let down=null,uc=null;for(let i=1;i<=900;i++){c.enemy.medical.tick(1/60,i/60);if(m.isDowned)down??=i/60;if(m.isUnconscious)uc??=i/60;}
  assert.ok(down>=7&&down<=15,`${ammoId} down ${down}`);assert.ok(uc>=7&&uc<=15,`${ammoId} unconscious ${uc}`);assert.deepEqual(c.enemy.medical.validate(),[]);
 }}finally{c.dispose();}
});
test('B1 direct aorta and femoral sources remain fatal untreated with output caps and the retained300second arrest-to-death delay',async()=>{
 const fixtures=JSON.parse(await readFile(new URL('./fixtures/imported/checks-s0-v38/fixtures.json',import.meta.url))),c=await s0Context();
 try{for(const name of['aorta','femoral-artery'])for(const ammoId of['545_ps_gs','556_m855']){
  const fixture=fixtures.find(f=>f.name===name&&f.pose==='standing');c.reset();c.fire({target:new Vector3(...fixture.target),direction:new Vector3(...fixture.direction),shotId:1001,ammoId});const m=c.enemy.medical.actor.medical;
  let uc=null,arrest=null,death=null;for(let i=1;i<=900*60;i++){c.enemy.medical.tick(1/60,i/60);if(m.isUnconscious)uc??=i/60;if(m.cardiacArrest)arrest??=i/60;if(m.isDead){death=i/60;break;}}
  assert.ok(death!==null&&death<=900,`${name} ${ammoId} death ${death}`);assert.ok(Math.abs(death-arrest-300)<.02);
  // B1 replaces S1 bleeding. The original ~30s clinical target is still
  // scored independently, including misses, in the240case B1 report.
  assert.ok(uc!==null);assert.equal(m.bleedingModel.ruleId,'bleed-sources-mo3');
  assert.ok(m.bleedingModel.totalFlowMlPerS<=m.bleedingModel.cardiacOutputMlPerS+1e-8);
  assert.ok(m.bleedSources.some(s=>s.id==='vessel/'+(name==='aorta'?'thoracic-aorta':'left-femoral')));
  assert.deepEqual(c.enemy.medical.validate(),[]);
 }}finally{c.dispose();}
});
