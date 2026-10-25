import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {MedicalFeedback} from '../apps/training/src/medical-feedback.js';
import {D2,exerciseIntensity,weaponArmLoad,exerciseBleedingFactor} from '../apps/training/src/medical-d2.js';
import {combinedHearingPresentation,newHearing} from '../apps/training/src/sound-hearing.js';
import {healthColor,statusPosture} from '../apps/training/src/status-hud.js';
test('D2 zero exercise is a literal physiology no-op and activity does not enter medical records',()=>{
 const a=new TrainingMedical(),b=new TrainingMedical();b.activity.setInput({speedMps:0,sprinting:false,ads:false});
 for(let n=1;n<=600;n++){a.tick(1/60,n/60);b.tick(1/60,n/60);assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));}
 assert.equal(a.actor.medical.heartRate,75);assert.equal(a.actor.medical.hemodynamics.cardiacOutputMul,1);assert.equal(a.activity.exercise,null);
});
test('D2 concussion accumulates through one input, decays over minutes, reuses tinnitus and never changes consciousness',()=>{
 const b=new TrainingMedical(),f=new MedicalFeedback(),m=b.actor.medical;b.activity.addConcussion(.3);let early;
 for(let n=1;n<=600;n++){b.tick(1/60,n/60);early=f.step(1/60,n/60,m);}
 assert.ok(early.concussionSeverity>.4);assert.ok(early.vision.concussionBlur>0);assert.ok(early.handlingRate<1);assert.ok(early.ai.aimConvergencePerS<new MedicalFeedback().output.ai.aimConvergencePerS);assert.equal(m.consciousness,100);assert.equal(m.isUnconscious,false);assert.equal(m.isDowned,false);
 const tinnitus=combinedHearingPresentation(newHearing(),early).tinnitusGain;assert.ok(tinnitus>0);b.activity.addConcussion(.3,{source:'future-helmet-input'});b.activity.step(1,11);assert.ok(b.activity.concussionDose>.8);
 const dose=b.activity.concussionDose;b.activity.step(240,251);assert.ok(b.activity.concussionDose<dose*.14);
});
test('D2 sprint exhaustion holds a recovery hysteresis and injury reduces capacity and recovery',()=>{
 const b=new TrainingMedical(),a=b.activity;a.setInput({speedMps:4.5,sprinting:true});for(let n=1;n<=1921;n++)a.step(1/60,n/60);assert.equal(a.leg,0);assert.equal(a.sprintLocked,true);
 a.setInput({speedMps:0,sprinting:false});for(let n=0;n<300;n++)a.step(1/60,33+n/60);assert.equal(a.sprintLocked,true);for(let n=0;n<70;n++)a.step(1/60,39+n/60);assert.equal(a.sprintLocked,false);
 b.actor.medical.bodyParts.leftLeg.functionRatio=.7;b.actor.medical.bodyParts.leftLeg.pain=40;a.step(1/60,41);assert.ok(a.legMax<.7);assert.ok(a.leg<=a.legMax);assert.equal(exerciseIntensity(0),0);assert.ok(exerciseIntensity(4.5)>exerciseIntensity(1.4));
});
test('D2 arm endurance responds to source mass, optics, leverage, crouch and never releases ADS',()=>{
 const bare=weaponArmLoad({weaponMassKg:3.1}),optic=weaponArmLoad({weaponMassKg:3.67,attachmentMassKg:.57}),ak=weaponArmLoad({weaponId:'ak74m',weaponMassKg:3.6}),crouch=weaponArmLoad({weaponMassKg:3.1,crouched:true});
 assert.ok(optic.enduranceS<bare.enduranceS);assert.ok(ak.enduranceS<bare.enduranceS);assert.ok(crouch.enduranceS>bare.enduranceS);
 const b=new TrainingMedical(),f=new MedicalFeedback();b.activity.setInput({ads:true,weaponMassKg:3.6,weaponId:'ak74m'});const rms=[];
 for(let n=1;n<=180*60;n++){b.activity.step(1/60,n/60);const r=f.step(1/60,n/60,b.actor.medical);if(n>150*60)rms.push(r.angles.yaw*r.angles.yaw);}
 assert.equal(b.activity.arm,0);assert.equal(b.activity.controls.ads,true);assert.ok(Math.sqrt(rms.reduce((a,b)=>a+b)/rms.length)>.0005);assert.ok(f.output.aimHold.strength<1);
});
test('D2 healthy exercise raises cardiac output and preserves original HR ceiling; shock limits augmentation',()=>{
 const rest=new TrainingMedical(),run=new TrainingMedical(),shock=new TrainingMedical();run.activity.setInput({speedMps:4.5});shock.actor.medical.bloodMl=3000;shock.activity.setInput({speedMps:4.5});
 let shockMinimumOxygen=1;for(let n=1;n<=3600;n++){for(const b of[rest,run,shock])b.tick(1/60,n/60);shockMinimumOxygen=Math.min(shockMinimumOxygen,shock.actor.medical.hemodynamics.oxygenDelivery);}
 const a=run.actor.medical,z=rest.actor.medical;assert.ok(a.heartRate>=150&&a.heartRate<=190);assert.ok(a.hemodynamics.cardiacOutputMul>z.hemodynamics.cardiacOutputMul*3);assert.ok(a.hemodynamics.map>z.hemodynamics.map);assert.ok(a.consciousness>99);
 assert.ok(shock.activity.exercise.capacity<.04);assert.ok(shockMinimumOxygen<.4);assert.equal(rest.actor.medical.heartRate,75);
 const sr=new TrainingMedical(),ss=new TrainingMedical();for(const b of[sr,ss])b.actor.medical.bloodMl=3500;sr.activity.setInput({speedMps:4.5});for(let n=1;n<=60;n++){sr.tick(1/60,n/60);ss.tick(1/60,n/60);}assert.ok(sr.actor.medical.heartRate>ss.actor.medical.heartRate,'muscle oxygen demand alone must not trigger terminal HR slowdown');
 assert.equal(exerciseBleedingFactor(a,{injuryType:'partial_laceration',vesselKind:'artery',id:'vessel/femoral'}),1);
 assert.ok(exerciseBleedingFactor(a,{injuryType:'parenchymal',id:'organ/liver'})<.25);assert.ok(exerciseBleedingFactor(a,{injuryType:'ooze',position:{partKey:'leftArm'}})>1);
});
test('D2 HUD colors preserve destroyed outlines and all six posture choices',()=>{
 assert.equal(healthColor(1),healthColor(.75));assert.notEqual(healthColor(.74),healthColor(.75));assert.notEqual(healthColor(0),healthColor(.01));
 assert.deepEqual([{}, {speed:1}, {crouched:true}, {lean:-1}, {lean:1}, {sprinting:true}].map(statusPosture),['stand','walk','crouch','left','right','sprint']);assert.equal(D2.equipmentMassKg,13.7);
});
