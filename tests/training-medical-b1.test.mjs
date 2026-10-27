import test from 'node:test';import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {MEDICAL_B1_VALUES as K,registerBleedingWoundB1,updateBleedingB1,vesselOpeningB1} from '../apps/training/src/medical-b1.js';
const wound=(id,hits,partKey='leftLeg',radius=.003)=>({id,partKey,s1OrganDamage:hits,bodyTrajectory:{entryAddress:{bone:'leftUpperLeg',localPoint:[.09,.8,0],actorLocalPoint:[.09,.8,0],localIncomingDirection:[0,0,-1]},woundChannel:{steps:[{depthM:0,dxM:.1,permanentRadiusM:radius}]}},bleedingProfile:{bleedingType:'external',initialExternal:.5,initialInternal:0,sustainedExternal:.5,selfReductionRate:.08}});
const vessel=(id='left-femoral',direct=true)=>({id,kind:'vessel',identifier:'femoral_vessel_injury',vesselKind:'artery',bone:'leftUpperLeg',domain:'leftLeg',diameterM:.008,centerlineDistanceM:0,closestDepthM:.05,permanentVolumeM3:direct?1e-7:0,direct,severity:.8});
test('B1 repeated injury has one source per vessel, distinct wound ooze and stable bone/proximal addresses; cavity-only blood vessels are contusions only',()=>{
 const med=new TrainingMedical(),m=med.actor.medical;for(const id of ['a','b']){const w=wound(id,[vessel(),{...vessel('left-femoral-vein',false),vesselKind:'vein'}]);m.wounds.push(w);registerBleedingWoundB1(m,w);}
 assert.equal(m.bleedSources.filter(s=>s.id.startsWith('vessel/')).length,1);assert.equal(m.bleedSources.filter(s=>s.injuryType==='ooze').length,2);assert.equal(m.vesselContusions.length,2);
 const s=m.bleedSources[0];assert.deepEqual(s.woundIds,['a','b']);assert.equal(s.lesions.length,2);assert.equal(s.controlClass,undefined);assert.equal(s.position.proximalPoint.bone,'leftUpperLeg');assert.ok(s.position.boneLocalPoint.every(Number.isFinite));
 registerBleedingWoundB1(m,m.wounds[0]);assert.equal(s.lesions.length,2);
});
test('B1 orifice SI conversion, vessel cap, proportional global output cap and cumulative blood conservation',()=>{
 const med=new TrainingMedical(),m=med.actor.medical;for(let i=0;i<25;i++)m.wounds.push(wound('w'+i,[vessel('vessel'+i)],'leftLeg',.006));
 updateBleedingB1(med.actor,0);m.hemodynamics.cardiacOutputMul=.2;const before=m.bloodMl;updateBleedingB1(med.actor,.1);
 assert.ok(m.bleedingModel.globalScale<1);const cap=K.restingCardiacOutputMlMin/60*.2;
 assert.ok(Math.abs(m.bleedingModel.totalFlowMlPerS-cap)<1e-10);
 for(const s of m.bleedSources){assert.equal(s.controlFactor,1);assert.ok(Math.abs(s.flowMlPerS-s.rawFlowMlPerS*m.bleedingModel.globalScale)<1e-10);if(s.injuryType!=='ooze'){const expected=K.dischargeCoefficient*s.orificeAreaMm2*Math.sqrt(2*93*K.mmHgToPa/K.bloodDensityKgM3);assert.ok(Math.abs(s.orificeFlowMlPerS-expected)<1e-8);assert.ok(s.rawFlowMlPerS<=s.vesselCapMlPerS);}}
 const pool=m.bloodLossMl,sum=m.bleedSources.reduce((a,b)=>a+b.cumulativeMl,0);assert.ok(Math.abs(before-m.bloodMl-pool)<1e-8);assert.ok(Math.abs(pool-sum)<1e-8);
 m.cardiacArrest=true;const blood=m.bloodMl;updateBleedingB1(med.actor,10);assert.equal(m.bloodMl,blood);assert.equal(m.bleedingModel.totalFlowMlPerS,0);
});
test('B1 major partial artery remains open; complete transection retracts to a nonzero floor; small veins close faster at low MAP',()=>{
 const area=(radius,id,kind='artery',map=93)=>{const med=new TrainingMedical(),m=med.actor.medical;m.wounds.push(wound('w',[{...vessel(id),vesselKind:kind}],'leftLeg',radius));m.hemodynamics.map=map;updateBleedingB1(med.actor,0);const s=m.bleedSources[0],before=s.orificeAreaMm2;for(let i=0;i<600;i++)updateBleedingB1(med.actor,1);return {s,ratio:s.orificeAreaMm2/before};};
 assert.equal(area(.002,'left-femoral').ratio,1);const full=area(.008,'left-femoral');assert.equal(full.s.injuryType,'complete_transection');assert.ok(Math.abs(full.ratio-K.majorTransectionAreaFloor)<1e-8);
 const a=area(.002,'small-branch'),v=area(.002,'small-vein','vein'),low=area(.002,'small-vein','vein',30);assert.ok(v.ratio<a.ratio&&low.ratio<v.ratio);
});


test('B1 retains existing S2 modeled amputation severance as explicit estimated source without claiming direct geometry',()=>{
 const med=new TrainingMedical(),m=med.actor.medical,w=wound('w',[]);w.vascularEvidence={s2AmputationSeverance:{identifier:'femoral_vessel_injury'}};m.wounds.push(w);updateBleedingB1(med.actor,0);const s=m.bleedSources.find(s=>s.id==='modeled-severance/leftLeg');assert.ok(s);assert.equal(s.injuryType,'complete_transection');assert.match(s.evidence,/not a fabricated/);assert.ok(s.flowMlPerS>0);
});



test('B1 low-MAP clotting accumulates in time and an instantaneous pressure recovery never reopens a closed branch',()=>{
 const med=new TrainingMedical(),m=med.actor.medical,w=wound('branch',[{...vessel('small-branch'),diameterM:.004}]);m.wounds.push(w);updateBleedingB1(med.actor,0);const s=m.bleedSources[0],base=s.orificeAreaMm2;m.hemodynamics.map=30;updateBleedingB1(med.actor,30);const closed=s.orificeAreaMm2;assert.ok(closed<base);m.hemodynamics.map=120;updateBleedingB1(med.actor,0);assert.equal(s.orificeAreaMm2,closed);updateBleedingB1(med.actor,1);assert.ok(s.orificeAreaMm2<closed);
});
