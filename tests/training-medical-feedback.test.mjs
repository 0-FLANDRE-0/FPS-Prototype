import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {MedicalFeedback,readMedicalFeedback,feedbackVision,convertedAI} from '../apps/training/src/medical-feedback.js';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {AimState} from '../apps/training/src/aim.js';
import {AIM_DEFAULTS,AIM_PRESETS,cleanSettings} from '../apps/training/src/settings.js';
import {CombatDecision} from '../apps/training/src/combat-decision.js';
import {newHearing,hearingPresentation,combinedHearingPresentation,hearNoise} from '../apps/training/src/sound-hearing.js';
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
test('D1 is read-only and every healthy/calm actuator and visual effect is neutral',()=>{
 const med=new TrainingMedical(),original=structuredClone(med.actor.medical),f=new MedicalFeedback();freeze(med.actor.medical);
 for(let i=0;i<600;i++){const r=f.step(1/60,i/60,med.actor.medical,{crouched:i<300});assert.equal(r.active,false);assert.deepEqual(r.angles,{yaw:0,pitch:0,roll:0});for(const k of['moveRate','handlingRate','reloadRate','stanceRate'])assert.equal(r[k],1);assert.equal(r.vision.eyelid,0);assert.equal(r.vision.drive,0);assert.equal(r.auditoryExclusionDb,0);}
 assert.deepEqual(med.actor.medical,original);
});
test('perceived masking drives limb symptoms, and S3b abdomen floor reaches breathing without new collapse',()=>{
 const m=new TrainingMedical().actor.medical;m.pain=95;m.abdomenPainFloor=95;m.stressResponse.perceivedPain=19;m.stressResponse.painMasking=.8;m.bodyParts.leftLeg.pain=95;
 let r=readMedicalFeedback(m);assert.ok(Math.abs(r.parts.abdomen.pain-19)<1e-12);assert.equal(r.sprintAllowed,true);assert.ok(r.thoraxPain>0);
 m.stressResponse.painMasking=0;m.stressResponse.perceivedPain=95;r=readMedicalFeedback(m);assert.equal(r.sprintAllowed,false);assert.equal(r.painStage,4);assert.ok(r.moveRate<=.35&&r.reloadRate<=.35);assert.equal(m.isUnconscious,false);assert.equal(m.isDead,false);
});
test('medical rifle shake survives steady/weaponMotion zero, and reactionMul never delays player look',()=>{
 const m=new TrainingMedical().actor.medical;m.stressResponse.adrenaline=1;delete m.aimMul;const f=new MedicalFeedback(),r=f.step(1/60,.137,m),rows=[];
 for(const preset of Object.values(AIM_PRESETS))for(const weaponMotion of[0,160]){const a=new AimState({...AIM_DEFAULTS,...preset,weaponMotion,breath:0,walkSway:0});a.step(1/60,{feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads:false,reloading:false,blocked:false,medicalFeedback:r});rows.push(a.shotPose().direction.toArray());}
 for(const row of rows)assert.deepEqual(row,rows[0]);assert.ok(Math.hypot(rows[0][0],rows[0][1])>.001);
 const a=new AimState({...AIM_DEFAULTS}),b=new AimState({...AIM_DEFAULTS});a.look(17,8,false);b.look(17,8,false);assert.equal(a.intentYaw,b.intentYaw);assert.equal(a.intentPitch,b.intentPitch);
 assert.equal(cleanSettings({medicalEffects:-3}).medicalEffects,0);assert.equal(cleanSettings({medicalEffects:130}).medicalEffects,100);assert.equal(cleanSettings({}).medicalEffects,100);
});
test('orthostatic and low-perfusion visuals never modify medical consciousness or down flags',()=>{
 const m=new TrainingMedical().actor.medical;m.bloodMl=m.bloodMax*.65;m.hemodynamics.map=65;const original=structuredClone(m),f=new MedicalFeedback();f.step(1/60,0,m,{crouched:true});f.step(1/60,1,m,{crouched:false});let peak=0;
 for(let i=1;i<=1800;i++){const r=f.step(1/60,1+i/60,m);peak=Math.max(peak,r.vision.orthostatic);}assert.ok(peak>0);assert.equal(f.output.vision.orthostatic,0);assert.deepEqual(m,original);
 const low={...readMedicalFeedback(m),bloodLoss:.5,visionDrive:1,consciousness:40};assert.equal(feedbackVision(low,4).stage,'blackout');assert.equal(m.isUnconscious,false);
});
test('AI medical multipliers slow behavior and moderate adrenaline improves reaction with original RNG sequence',()=>{
 const m=new TrainingMedical().actor.medical,base=readMedicalFeedback(m),a=convertedAI(base,feedbackVision(base,0));m.reactionMul=1.06;const fast=readMedicalFeedback(m),b=convertedAI(fast,feedbackVision(fast,0));assert.ok(b.reactionS[0]<a.reactionS[0]);
 m.aimMul=.4;m.reloadMul=.5;m.moveMul=.5;m.weaponHandlingMul=.5;const hurt=readMedicalFeedback(m),c=convertedAI(hurt,feedbackVision(hurt,0));assert.ok(c.aimFloorDeg>a.aimFloorDeg&&c.aimConvergencePerS<a.aimConvergencePerS&&c.walkSpeedMps<a.walkSpeedMps&&c.shotIntervalS[0]>a.shotIntervalS[0]);
 const d=new CombatDecision(()=>.5),target={part:'chest',point:new Vector3(1,1,1)};d.step({time:0,senses:{target},arrived:false,rounds:30,medical:m,down:false,reloadDurationS:4,behavior:c});assert.equal(d.state,'reaction');assert.ok(d.reaction>0);
});
test('auditory exclusion combines the stronger effect without multiplying hearing loss or changing tinnitus',()=>{
 const h=newHearing();h.loss=.4;const clinical=structuredClone(h),p=hearingPresentation(h),r=combinedHearingPresentation(h,{auditoryExclusionDb:12});
 assert.equal(r.gain,10**(-12/20));assert.equal(r.lowpassHz,2500);assert.equal(r.tinnitusGain,p.tinnitusGain);assert.deepEqual(h,clinical);assert.deepEqual(combinedHearingPresentation(h,{auditoryExclusionDb:0}),p);
 h.loss=.99;assert.equal(combinedHearingPresentation(h,{auditoryExclusionDb:12}).lowpassHz,hearingPresentation(h).lowpassHz);
 const event={type:'footstep_walk'},physical={levelDb:70,dominant:'direct',components:[],apparentPosition:[0,0,0]},medical={pain:95};h.loss=.4;
 const raw=hearNoise(event,physical,h,medical,()=>.5),masked=hearNoise(event,physical,h,medical,()=>.5,{auditoryExclusionDb:12,perceivedPain:20});
 assert.equal(masked.thresholdDb-raw.thresholdDb,2);assert.ok(masked.probability>raw.probability); // Masking removes the old pain>60 penalty.
});
