import test from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {s0Context} from '../scripts/training-s0-fixtures.mjs';
import {criticalAnatomyS0,geometricHeadS0} from '../apps/training/src/medical-s0.js';
const advance=(c,s)=>{for(let i=1;i<=Math.round(s*60);i++)c.enemy.medical.tick(1/60,i/60);};
test('actual 7N6 through 6B47 into brain disables consciousness despite surviving traumatic head HP; reset clears injury',async()=>{
 const c=await s0Context();try{c.reset({armor:true});const e=c.fire({target:c.center('brain')}),m=c.enemy.medical.actor.medical;
 assert.ok(e.trace.bodyHits.flatMap(b=>b.internalHits).some(h=>h.id==='brain'&&h.traversedLengthM>0));assert.ok(m.bodyParts.head.hp>0);assert.equal(m.consciousness,0);assert.equal(m.consciousnessTarget,0);assert.equal(m.downReason,'brain_injury');assert.equal(m.isDead,false);assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).unconscious,true);assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).collapse,true);
 advance(c,60);assert.equal(m.consciousness,0);assert.equal(m.deathReason,null);assert.deepEqual(c.enemy.medical.validate(),[]);c.reset();assert.equal(c.enemy.medical.actor.medical.brainInjury,null);assert.equal(c.enemy.medical.actor.medical.consciousness,100);
 }finally{c.dispose();}
});
test('actual brainstem intersection causes immediate apnea/arrest and uses the retained 300 second death transition',async()=>{
 const c=await s0Context();try{c.reset();const e=c.fire({target:c.center('brainstem')}),m=c.enemy.medical.actor.medical;
 assert.ok(e.trace.bodyHits.flatMap(b=>b.internalHits).some(h=>h.id==='brainstem'));assert.equal(m.consciousness,0);assert.equal(m.breathingEfficiency,0);assert.equal(m.hemodynamics.cardiacOutputMul,0);assert.equal(m.arrestReason,'brainstem_injury');assert.equal(m.isDead,false);advance(c,299);assert.equal(m.isDead,false);for(let i=0;i<60;i++)c.enemy.medical.tick(1/60,299+(i+1)/60);assert.equal(m.isDead,true);assert.equal(m.deathReason,'brainstem_injury');
 }finally{c.dispose();}
});
test('actual heart chord lowers pump/MAP while initially conscious, then cerebral reserve and existing curve reach unconsciousness within 15s',async()=>{
 const c=await s0Context();try{c.reset();const e=c.fire({target:c.center('heart')}),m=c.enemy.medical.actor.medical;assert.ok(e.trace.bodyHits.flatMap(b=>b.internalHits).some(h=>h.id==='heart'));assert.ok(m.heartInjury.pumpFunction<.05);assert.equal(m.consciousness,100);assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).collapse,false);
 let unconscious=null;for(let i=1;i<=900;i++){c.enemy.medical.tick(1/60,i/60);if(m.isUnconscious)unconscious??=i/60;if(i===2){assert.ok(m.hemodynamics.cardiacOutputMul<.1);assert.ok(m.hemodynamics.map<10);assert.ok(m.consciousness>90);assert.equal(m.canWalk,true);assert.equal(m.isDowned,false);}}
 assert.ok(unconscious>=2&&unconscious<=15);assert.equal(m.arrestReason,'cardiac_pump_failure');assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).collapse,true);assert.deepEqual(c.enemy.medical.validate(),[]);
 }finally{c.dispose();}
});
test('localized jaw wound without brain intersection may exhaust aggregate head HP without immediate unconsciousness or death',async()=>{
 const c=await s0Context();try{c.reset();const a=c.physics.internalAnatomies.get('S01'),f=a.domains.get('head'),target=f.point([0,.12,.7]).applyMatrix4(a.rig.byName.get('head').matrixWorld).add(new Vector3(...c.enemy.actor.at)),e=c.fire({target}),m=c.enemy.medical.actor.medical;
 assert.ok(e.trace.bodyHits.some(h=>h.parts.some(p=>p.bodyPart==='head')));assert.ok(!e.trace.bodyHits.flatMap(b=>b.internalHits).some(h=>['brain','brainstem'].includes(h.organ)));assert.equal(m.brainInjury,null);assert.equal(m.isDead,false);assert.equal(m.isUnconscious,false);assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).collapse,false);assert.deepEqual(c.enemy.medical.validate(),[]);
 }finally{c.dispose();}
});
test('confirmed geometric femur fracture loses weight support with consciousness and shooting retained',async()=>{
 const c=await s0Context();try{c.reset();const e=c.fire({target:c.center('left-femur'),shotId:1001}),m=c.enemy.medical.actor.medical;
 assert.ok(e.trace.bodyHits.flatMap(b=>b.internalHits).some(h=>h.id==='left-femur'));assert.ok(m.wounds.some(w=>w.fractureEvidence?.occurred));assert.equal(m.bodyParts.leftLeg.functionRatio,0);assert.equal(m.downReason,'weight_bearing_fracture');assert.equal(m.isUnconscious,false);assert.equal(m.canShoot,true);assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).collapse,true);
 }finally{c.dispose();}
});
test('zero-length brain surface evidence and nearby shapes cannot create a CNS or heart injury',()=>{
 const unit={medical:{wounds:[{partKey:'head',bodyTrajectory:{internalGeometry:{source:'no occupied body segment',internalHits:[{id:'brain',organ:'brain',traversedLengthM:0}],nearMisses:[{id:'brainstem',organ:'brainstem'}]}}}],bodyParts:{},consciousness:100}};
 criticalAnatomyS0(unit);assert.equal(unit.medical.brainInjury,null);assert.equal(unit.medical.heartInjury,null);assert.equal(unit.medical.consciousness,100);assert.equal(geometricHeadS0(unit.medical),false);
});

test('real femur plus heart wounds cannot regain walking through the cardiac action reserve',async()=>{
 const c=await s0Context();try{c.reset();c.fire({target:c.center('left-femur'),shotId:1001});c.fire({target:c.center('heart'),shotId:1002});advance(c,1);const m=c.enemy.medical.actor.medical;assert.ok(m.heartInjury&&m.weightBearingFracture);assert.equal(m.bodyParts.leftLeg.functionRatio,0);assert.equal(m.canWalk,false);assert.equal(c.medicalMuscleStrength(c.enemy.medical.actor).collapse,true);assert.ok(m.consciousness>30);
 }finally{c.dispose();}
});
