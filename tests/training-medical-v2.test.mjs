import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {createMedicalV2Slots,consciousnessTargetV2,shockTargetV2,MEDICAL_V2_VALUES as K} from '../apps/training/src/medical-v2.js';
const advance=(m,n,start=0)=>{for(let i=1;i<=n;i++)m.tick(1/60,(start+i)/60);};
test('v2 is default, legacy is selectable and reset retains mode without stale physiology',()=>{
 const m=new TrainingMedical();assert.equal(m.medicalModel,'v2');assert.equal(m.actor.medical.cardiacArrest,false);
 m.setMedicalModel('legacy');assert.equal(m.actor.medical.medicalModel,undefined);m.reset();assert.equal(m.medicalModel,'legacy');
 assert.throws(()=>m.setMedicalModel('other'));m.setMedicalModel('v2');assert.equal(m.actor.medical.painFloor,0);
});
test('ischemia lowers function through a separate load and never changes trauma HP or prelabels death',()=>{
 const m=new TrainingMedical(),p=m.actor.medical.bodyParts,initial=structuredClone(p);m.actor.medical.bloodMl=3100;advance(m,600);
 for(const[k,v]of Object.entries(p)){assert.equal(v.hp,initial[k].hp);assert.ok(v.ischemicLoad>0);assert.ok(v.functionRatio<initial[k].functionRatio);}
 assert.equal(m.actor.medical.deathReason,null);assert.equal(m.actor.isDead,false);
});
test('S2 head HP is structural even without localized geometry; destroyed neck retains life cap without prelabel or summary death',()=>{
 const m=new TrainingMedical();m.actor.medical.bodyParts.neck.hp=0;m.legacy.recalcMedicalSummary(m.actor);m.legacy.syncLegacyCombatState(m.actor);
 assert.equal(m.actor.medical.lifeStatus,5);assert.equal(m.actor.isDead,false);assert.equal(m.actor.medical.deathReason,null);assert.ok(m.actor.medical.downReason);
 m.actor.medical.bodyParts.head.hp=0;m.legacy.recalcMedicalSummary(m.actor);m.legacy.syncLegacyCombatState(m.actor);
 assert.equal(m.actor.isDead,false);assert.equal(m.actor.medical.deathReason,null);assert.equal(m.actor.medical.cardiacArrest,false);
 assert.equal(m.actor.medical.structuralTrauma.headStructureDestroyed,true);assert.equal(m.actor.medical.lifeStatus,5);
});
test('exsanguination enters arrest with unconsciousness, zero circulation, then dies only after 300 continuous seconds',()=>{
 const m=new TrainingMedical();m.actor.medical.bloodMl=1100;advance(m,1);const s=m.actor.medical;
 assert.equal(s.cardiacArrest,true);assert.equal(s.arrestReason,'exsanguination');assert.equal(s.isDead,false);assert.equal(s.isUnconscious,true);assert.equal(s.deathReason,null);
 assert.equal(s.arrestDetails.contributingFactors.bloodMl,1100);
 advance(m,600,1);assert.equal(s.consciousness,0);assert.equal(s.stressResponse.perceivedPain,0);
 advance(m,17399,601);assert.equal(s.isDead,false);advance(m,1,18000);assert.equal(s.isDead,true);assert.equal(s.deathReason,'exsanguination');
 for(const k of ['heartRate','systolicBP','diastolicBP'])assert.equal(s[k],0);
 for(const k of ['map','tissuePerfusion','oxygenDelivery'])assert.equal(s.hemodynamics[k],0);
});
test('acute pain decays to a live-part floor, new original pain increment recharges acute component, unconsciousness hides perceived pain only',()=>{
 const m=new TrainingMedical(),s=m.actor.medical;s.bodyParts.leftArm.pain=30;s.bodyParts.rightLeg.pain=20;s.pain=80;advance(m,3600);
 assert.equal(s.acutePain,0);assert.equal(s.painFloor,33);assert.equal(s.pain,33);assert.ok(s.stressResponse.perceivedPain>0);
 s.pain+=10;advance(m,1,3600);assert.ok(Math.abs(s.acutePain-9.975)<1e-9);
 s.cardiacArrest=true;s._arrestConsciousness=19;advance(m,1,3601);assert.equal(s.stressResponse.perceivedPain,0);assert.equal(s.pain,33);
});
test('shock targets use the same continuous inputs across injury addresses, and curve inputs produce bounded smooth values',()=>{
 const a=new TrainingMedical().actor.medical,b=structuredClone(a);a.hemodynamics.volumeRatio=b.hemodynamics.volumeRatio=.7;
 b.bodyParts.leftArm.hp=5;assert.deepEqual(shockTargetV2(a),shockTargetV2(b));assert.ok(shockTargetV2(a).target>0);
 const values=[];for(let map=20;map<=100;map+=.1){a.hemodynamics.map=map;const c=consciousnessTargetV2(a);assert.ok(c.target>=0&&c.target<=100);values.push(c.target);}
 for(let i=1;i<values.length;i++)assert.ok(Math.abs(values[i]-values[i-1])<1);
 assert.equal(K.ARREST_TO_DEATH_S,300);
});
test('legacy remains byte-equivalent for P2 reference inputs',async()=>{
 const {readFile}=await import('node:fs/promises');const {medicalObservation}=await import('../apps/training/src/medical.js');
 const cases=JSON.parse(await readFile(new URL('./fixtures/imported/checks-q0/inputs.json',import.meta.url)));
 for(const c of cases){const m=new TrainingMedical({medicalModel:'legacy'});m.actor=structuredClone(c.actor);m.seed=c.seed;
  const expected=JSON.parse(await readFile(new URL('./fixtures/imported/checks-p3/'+c.fixture.name+'.json',import.meta.url)));
  assert.deepEqual(medicalObservation(m.actor,0),expected.rows[0]);for(let i=1;i<=18000;i++){m.tick(1/60,(c.tick+i)/60);if(i%60===0)assert.deepEqual(medicalObservation(m.actor,i/60),expected.rows[i/60]);}
 }
});
test('sustained oxygen/peri-arrest holds reset on interrupted exposure and capture the actual arrest cause',()=>{
 const m=new TrainingMedical(),u=m.actor,s=u.medical;
 const slots=createMedicalV2Slots({updateVitalsFromHemodynamics(){}});
 s.hemodynamics.oxygenDelivery=.2;
 for(let i=0;i<19;i++)slots.updateVitalsFromHemodynamics(u,1);
 assert.equal(s.cardiacArrest,false);s.hemodynamics.oxygenDelivery=1;slots.updateVitalsFromHemodynamics(u,1);assert.equal(s.lowOxygenElapsedS,0);
 s._heartRateState='peri_arrest';for(let i=0;i<14;i++)slots.updateVitalsFromHemodynamics(u,1);assert.equal(s.cardiacArrest,false);
 s._heartRateState='alert';slots.updateVitalsFromHemodynamics(u,1);assert.equal(s.periArrestElapsedS,0);
 s.hemodynamics.oxygenDelivery=.2;for(let i=0;i<20;i++)slots.updateVitalsFromHemodynamics(u,1);
 assert.equal(s.cardiacArrest,true);assert.equal(s.arrestReason,'hypoxia');assert.equal(s.arrestDetails.contributingFactors.oxygenDelivery,.2);
});
test('B1 arrest has zero output and therefore zero effective flow, preserving wound sources and remaining blood',()=>{
 const m=new TrainingMedical(),s=m.actor.medical;s.cardiacArrest=true;s.bloodMl=.01;
 s.wounds=[{id:'w1',partKey:'leftArm',bleedingProfile:{bleedingType:'external',currentExternal:10,currentInternal:5},_effExternal:10,_effInternal:5,bleedingPulseModel:{effectiveExternalAfterClamp:10,effectiveInternalAfterClamp:5}}];
 const slots=createMedicalV2Slots({updateMedicalBleeding(u,dt){u.medical.externalBleedRate=10;u.medical.internalBleedRate=5;u.medical.bloodMl=Math.max(0,u.medical.bloodMl-15*dt);}});
 const source=structuredClone(s.wounds[0].bleedingProfile);slots.updateMedicalBleeding(m.actor,1/60);
 assert.equal(s.externalBleedRate,0);assert.equal(s.internalBleedRate,0);assert.equal(s.bloodMl,.01);
 assert.equal(s.wounds[0]._effExternal,0);assert.equal(s.wounds[0]._effInternal,0);assert.deepEqual(s.wounds[0].bleedingProfile,source);
});
test('unconscious perceived pain is zero before the original vital function consumes it, while raw pain persists',()=>{
 const m=new TrainingMedical(),s=m.actor.medical;s.isUnconscious=true;s.pain=40;s.stressResponse.perceivedPain=25;
 let read;const slots=createMedicalV2Slots({updateVitalsFromHemodynamics(u){read=u.medical.stressResponse.perceivedPain;}});
 slots.updateVitalsFromHemodynamics(m.actor,1/60);assert.equal(read,0);assert.equal(s.pain,40);
});
