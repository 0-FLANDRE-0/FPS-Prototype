import test from'node:test';import assert from'node:assert/strict';
import{MedicalFeedback}from'../apps/training/src/medical-feedback.js';
import{TrainingMedical}from'../apps/training/src/medical.js';
const setup=()=>{const m=new TrainingMedical().actor.medical;m.hemodynamics.map=60;m.hemodynamics.tissuePerfusion=.55;m.hemodynamics.oxygenDelivery=.5;return m;};
test('movement near retinal thresholds cannot switch the screen dimmer on each IK height discontinuity',()=>{
 const m=setup(),f=new MedicalFeedback(),before=JSON.stringify(m),rows=[];
 for(let i=0;i<600;i++){const o=f.step(1/60,i/60,m,{eyeHeightM:i%2?.293:.263}).vision;rows.push(o);}
 const tail=rows.slice(300),variation=k=>Math.max(...tail.slice(1).map((r,i)=>Math.abs(r[k]-tail[i][k]))),raw=tail.map(r=>r.retina);
 assert.ok(Math.max(...raw.slice(1).map((r,i)=>Math.abs(r.blackout-raw[i].blackout)))>.1);
 assert.ok(variation('blackout')<.01);assert.ok(variation('tunnel')<.01);assert.equal(JSON.stringify(m),before);
});
test('brief exercise oxygen fluctuations are smoothed but sustained impairment still reaches the original dimming target',()=>{
 const m=setup(),f=new MedicalFeedback();m.hemodynamics.map=93;m.hemodynamics.tissuePerfusion=1;
 for(let i=0;i<300;i++)f.step(1/60,i/60,m,{eyeHeightM:.3});
 m.hemodynamics.oxygenDelivery=.25;const first=f.step(1/60,5,m,{eyeHeightM:.3}).vision;
 assert.ok(first.blackout<.1);assert.ok(first.retina.blackout>.9);
 for(let i=1;i<=300;i++)f.step(1/60,5+i/60,m,{eyeHeightM:.3});
 assert.equal(f.output.vision.blackout,f.output.vision.retina.blackout);
 m.hemodynamics.oxygenDelivery=1;f.step(1/60,10.1,m,{eyeHeightM:.3});assert.ok(f.output.vision.blackout>.8);
 for(let i=1;i<=600;i++)f.step(1/60,10.1+i/60,m,{eyeHeightM:.3});assert.equal(f.output.vision.blackout,0);
});
test('blood-volume dimming and real unconsciousness bypass the retinal transition',()=>{
 const m=setup(),f=new MedicalFeedback();m.hemodynamics.map=93;m.hemodynamics.oxygenDelivery=1;m.hemodynamics.tissuePerfusion=1;f.step(1/60,0,m);
 m.bloodMl=m.bloodMax*.5;let v=f.step(1/60,1/60,m).vision;assert.equal(v.blackout,1);assert.equal(v.volumeBlackout,1);
 m.isUnconscious=true;v=f.step(1/60,2/60,m).vision;assert.equal(v.unconscious,true);
});
test('retinal presentation resets on timeline rewind and preserves the signed hydrostatic calculation',()=>{
 const m=setup(),f=new MedicalFeedback();for(let i=0;i<60;i++)f.step(1/60,i/60,m,{eyeHeightM:.35});
 m.hemodynamics.map=93;m.hemodynamics.oxygenDelivery=1;m.hemodynamics.tissuePerfusion=1;
 const v=f.step(1/60,0,m,{eyeHeightM:-.1}).vision;assert.equal(v.blackout,0);assert.equal(v.tunnel,0);assert.ok(v.retina.eyeMAP>93);
});
test('sampling feedback never changes exercise physiology or AI visibility',()=>{
 const a=new TrainingMedical(),b=new TrainingMedical(),f=new MedicalFeedback();for(const x of[a,b]){x.actor.medical.bloodMl=3800;x.activity.setInput({speedMps:1.6});}
 for(let i=1;i<=600;i++){a.tick(1/60,i/60);b.tick(1/60,i/60);f.step(1/60,i/60,b.actor.medical,{eyeHeightM:i%2?.25:.35});assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));}
 const ai=f.output.ai;const g=new MedicalFeedback();g.step(1/60,10,b.actor.medical,{eyeHeightM:0});assert.equal(ai.visionDetection,g.output.ai.visionDetection);assert.equal(ai.visionDistanceM,g.output.ai.visionDistanceM);assert.equal(ai.visionFovDeg,g.output.ai.visionFovDeg);
});
