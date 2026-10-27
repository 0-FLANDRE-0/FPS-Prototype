import test from 'node:test';import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {registerBleedingWoundB1,updateBleedingB1} from '../apps/training/src/medical-b1.js';
import {MEDICAL_B1B_VALUES as K,arrestAttributionB1b} from '../apps/training/src/medical-b1b.js';
const wound=(id,organ,severity)=>({id,partKey:'abdomen',s1OrganDamage:[{id:organ,organ:organ.includes('kidney')?'kidney':organ,kind:'organ',direct:true,effectiveVolumeM3:1e-5,severity}],bodyTrajectory:{}});
test('B1c organ sources preserve B1b flow fractions, cavity routing and small-injury closure',()=>{
 const med=new TrainingMedical(),m=med.actor.medical;
 for(const w of [wound('a','liver',.2),wound('b','liver',.05),wound('c','left-kidney',.2),wound('d','right-kidney',.2),wound('e','spleen',.2)]){m.wounds.push(w);registerBleedingWoundB1(m,w);}
 updateBleedingB1(med.actor,0);const a=m.bleedSources[0];assert.equal(a.injuryType,'parenchymal');assert.ok(Math.abs(a.flowMlPerS-87.5*K.organFlowFractions.liver*(2/3)*.24)<1e-12);assert.equal(a.partKey,'abdomen');assert.ok(m.bleedSources.slice(1,3).every(s=>s.partKey==='abdomen'&&s.destination===undefined));assert.equal(m.bleedSources.length,4);
 m.hemodynamics.cardiacOutputMul=.5;updateBleedingB1(med.actor,180);assert.ok(Math.abs(a.flowMlPerS-43.75*.25*(2/3)*.24)<1e-12);assert.equal(a.closureFactor,1);assert.equal(a.orificeAreaMm2,null);
});
test('B1b other organ beds retain their original venous cap and natural closure',()=>{
 const med=new TrainingMedical(),m=med.actor.medical;m.wounds.push(wound('a','bowel',.9));updateBleedingB1(med.actor,0);const s=m.bleedSources[0],initial=s.orificeAreaMm2;assert.equal(s.id,'organ-bed/bowel');assert.equal(s.vesselKind,'vein');updateBleedingB1(med.actor,45);assert.ok(s.orificeAreaMm2<initial);assert.ok(s.rawFlowMlPerS<=s.vesselCapMlPerS);
});
test('B1b arrest attribution reads pump, blood, respiration and oxygen without mutating physiology',()=>{
 const med=new TrainingMedical(),m=med.actor.medical;m.bloodMl=m.bloodMax*.65;m.heartInjury={pumpFunction:.4};m.breathingEfficiency=90;m.hemodynamics.oxygenDelivery=.2;const before=structuredClone(m),a=arrestAttributionB1b(m,'hemorrhagic_shock');assert.equal(a.primary,'cardiac_pump_failure');assert.equal(a.trigger,'hemorrhagic_shock');assert.equal(a.oxygenDelivery,.2);assert.deepEqual(m,before);
 m.heartInjury.pumpFunction=1;m.breathingEfficiency=40;assert.equal(arrestAttributionB1b(m,'hemorrhagic_shock').primary,'respiratory_failure');m.bloodMl=m.bloodMax*.5;assert.equal(arrestAttributionB1b(m,'hemorrhagic_shock').primary,'hemorrhagic_shock');assert.equal(arrestAttributionB1b(m,'torso_destroyed').primary,'torso_destroyed');
});
