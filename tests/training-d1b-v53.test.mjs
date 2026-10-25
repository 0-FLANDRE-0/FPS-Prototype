import test from'node:test';import assert from'node:assert/strict';
import{MedicalFeedback,readMedicalFeedback,feedbackVision,convertedAI}from'../apps/training/src/medical-feedback.js';import{TrainingMedical}from'../apps/training/src/medical.js';import{MedicalEyelids}from'../apps/training/src/medical-eyelids.js';import{retinalVision}from'../apps/training/src/retinal-vision.js';import{tremorSignal,breathWave,heartbeatWave}from'../apps/training/src/medical-waveforms.js';
test('D1b volume-only grayscale and max(volume, retinal perfusion) tunnel/blackout are read-only',()=>{
 const m=new TrainingMedical().actor.medical;m.hemodynamics.map=35;m.hemodynamics.tissuePerfusion=.1;m.hemodynamics.oxygenDelivery=.15;const before=structuredClone(m),r=new MedicalFeedback().step(1/60,0,m);assert.equal(r.vision.desaturation,0);assert.equal(r.vision.peripheralDark,0);assert.equal(r.vision.blackout,1);assert.equal(r.vision.blackoutDriver,'perfusion');assert.deepEqual(m,before);
 m.bloodMl=m.bloodMax*.5;const input=readMedicalFeedback(m),v=feedbackVision(input,0);assert.equal(v.blackout,Math.max(v.volumeBlackout,v.perfusionBlackout));assert.equal(v.tunnel,Math.max(v.volumeTunnel,v.perfusionTunnel));
});
test('D1b eye-heart hydrostatics follow orientation, not camera altitude or a fall boolean',()=>{
 const m=new TrainingMedical().actor.medical;m.hemodynamics.map=65;const i=readMedicalFeedback(m),standing=retinalVision(i,{eyeHeightM:.35}),lying=retinalVision(i,{eyeHeightM:0}),below=retinalVision(i,{eyeHeightM:-.1});assert.ok(Math.abs(standing.hydrostaticMmHg-27.3)<.1);assert.ok(standing.blackout>lying.blackout);assert.equal(lying.hydrostaticMmHg,0);assert.ok(below.eyeMAP>lying.eyeMAP);assert.equal(retinalVision(readMedicalFeedback(new TrainingMedical().actor.medical)).tunnel,0);
});
test('D1b slow decline has irregular asymmetric drowsy stages and closes at unconsciousness; acute decline stays open',()=>{
 const f=new MedicalFeedback(),m=new TrainingMedical().actor.medical,stages=new Set(),intervals=[];let previous=0;
 for(let n=0;n<90*60;n++){const t=n/60;m.consciousness=Math.max(25,100-t);const r=f.step(1/60,t,m).vision.eyelids;assert.equal(r.rapidDecline,false);if(r.stage)stages.add(r.stage);if(r.stage===1&&previous!==1)intervals.push(r.stageDurationS);previous=r.stage;}
 assert.deepEqual([...stages].sort(),[1,2,3,4,5,6]);assert.ok(new Set(intervals).size>1);m.isUnconscious=true;assert.equal(f.step(1/60,90,m).vision.eyelidDrowsy,1);
 const fast=new MedicalEyelids();for(let n=0;n<6*60;n++){const input={...readMedicalFeedback(null),consciousness:Math.max(0,100-n/60*20)};const r=fast.step(1/60,n/60,input,{isUnconscious:input.consciousness<20});if(n>120){assert.equal(r.rapidDecline,true);assert.equal(r.drowsy,0);}}
 const brain=new MedicalEyelids().step(1/60,0,{...readMedicalFeedback(null),consciousness:0},{isUnconscious:true,brainInjury:{kind:'brainstem'}});assert.equal(brain.drowsy,0);assert.equal(brain.rapidDecline,true);
});
test('D1b perceived pain gives a fast reflex and sustained squint, and masking reduces both',()=>{
 const m=new TrainingMedical().actor.medical,f=new MedicalFeedback();f.step(1/60,0,m);m.stressResponse.perceivedPain=95;let peak=0;for(let i=1;i<=60;i++){const r=f.step(1/60,i/60,m);peak=Math.max(peak,r.vision.eyelidPain);}assert.ok(peak>.9);assert.equal(f.output.vision.eyelids.painSustained,.65);assert.equal(f.output.vision.eyelidDrowsy,0);m.stressResponse.perceivedPain=19;for(let i=61;i<90;i++)f.step(1/60,i/60,m);assert.equal(f.output.vision.eyelidPain,0);
 const masked=new MedicalFeedback(),mm=new TrainingMedical().actor.medical;masked.step(1/60,0,mm);mm.stressResponse.perceivedPain=19;let maskedPeak=0;for(let i=1;i<=60;i++)maskedPeak=Math.max(maskedPeak,masked.step(1/60,i/60,mm).vision.eyelidPain);assert.ok(maskedPeak<peak*.5,'pain-rise saturation must not erase adrenaline masking');
});
test('D1b tremor is deterministic at all adrenaline levels, continuous below 0.7 and remains outside the hold servo',()=>{
 const make=a=>{const m=new TrainingMedical().actor.medical;m.stressResponse.adrenaline=a;return m;},zero=new MedicalFeedback(),a=new MedicalFeedback(),b=new MedicalFeedback();let energy=0;
 for(let n=0;n<1200;n++){const t=n/120,r=a.step(1/120,t,make(.3)),s=b.step(1/120,t,make(.3));assert.deepEqual(r.angles,s.angles);assert.deepEqual(zero.step(1/120,t,make(0)).angles,{yaw:0,pitch:0,roll:0});assert.ok(Math.abs(r.angles.yaw-r.aimHold.yaw-r.waves.tremor.yaw)<1e-15);energy+=r.waves.tremor.yaw**2;}assert.ok(energy>0);assert.deepEqual(tremorSignal(.123),tremorSignal(.123));
});
test('D1b asymmetric breath and brief heart pulses retain irregular but bounded physical inputs',()=>{
 assert.equal(breathWave(0),-1);assert.equal(breathWave(.38),1);assert.ok(Math.abs(breathWave(.19))<1e-10);assert.ok(Math.abs(heartbeatWave(.8))<.3);assert.ok(heartbeatWave(0)>3);const m=new TrainingMedical().actor.medical;m.breathingEfficiency=50;m.heartRate=180;delete m.aimMul;const f=new MedicalFeedback();for(let n=0;n<600;n++)f.step(1/60,n/60,m);assert.ok(f.output.waves.breath!==0);assert.ok(f.output.waves.heartbeat!==0);assert.ok(f.output.aimHold.pitch!==0);
});
test('D1b player retinal and eyelid presentation never changes v52 AI sight, hearing or handling mappings',()=>{
 const m=new TrainingMedical().actor.medical;m.hemodynamics.map=30;m.hemodynamics.oxygenDelivery=.1;const i=readMedicalFeedback(m),f=new MedicalFeedback().step(1/60,0,m),expected=convertedAI(i,{drive:i.visionDrive,tunnel:f.vision.volumeTunnel});assert.deepEqual(f.ai,expected);assert.equal(f.ai.visionFovDeg,120);assert.equal(f.auditoryExclusionDb,0);assert.equal(f.reloadRate,1);
});
