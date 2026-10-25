import test from 'node:test';import assert from 'node:assert/strict';
import {SOUND,NOISE_TYPE_PROFILE,airAbsorptionDbM,massLawLossDb,propagateSound,energyDb,machCrack,roomAcoustics} from '../apps/training/src/sound-acoustics.js';
import {SOUND_ROOMS as rooms,SOUND_PORTALS as portals,SOUND_WALLS as walls}from'../apps/training/src/sound-world.js';
import {newHearing,tickHearing,exposeHearing,hearNoise,hearingPresentation}from'../apps/training/src/sound-hearing.js';
const event=(position,type='gunshot')=>({type,position,...NOISE_TYPE_PROFILE[type]});
test('SND1 ISO9613-1 independently tabulated bands / inverse-square / energy add / mass-law ordering',()=>{
 assert.ok(Math.abs(airAbsorptionDbM(1000)-.004664731873821475)<1e-14);assert.ok(Math.abs(airAbsorptionDbM(4000)-.029665528426392616)<1e-14);
 const outdoors={rooms:[rooms.at(-1)],portals:[],walls:[]},a=propagateSound(event([0,1,0]),[10,1,0],outdoors),b=propagateSound(event([0,1,0]),[20,1,0],outdoors);assert.ok(a.levelDb-b.levelDb>6.0205);assert.ok(Math.abs(energyDb([60,60])-63.0102999566)<1e-9);
 for(const f of SOUND.bandsHz){assert.ok(massLawLossDb('concrete',.3,f)>massLawLossDb('wood',.018,f));assert.ok(massLawLossDb('drywall',.025,f)>massLawLossDb('wood',.018,f));}
});
test('SND1 same-ray walls, reciprocal valid portal chain and source/receiver indoor reverb',()=>{
 const world={rooms,portals,walls},a=[74,1.5,-3],b=[74,1.5,4],ab=propagateSound(event(a),b,world),ba=propagateSound(event(b),a,world);assert.ok(Math.abs(ab.levelDb-ba.levelDb)<1e-12);assert.equal(ab.dominant,'portal');assert.deepEqual(ab.apparentPosition,portals[0].center);assert.equal(ab.components.length,1);
 const outside=[76,1.5,-10],r=propagateSound(event(a),outside,world),rev=propagateSound(event(outside),a,world);assert.ok(Math.abs(r.levelDb-rev.levelDb)<1e-9);assert.ok(r.components.find(c=>c.kind==='portal').portals.length>=3);assert.ok(r.exposureDb>r.levelDb);assert.ok(roomAcoustics(rooms[0]).uncappedRT60S[0]>0);
});
test('SND1 synthetic acoustic door monotonic 0..1 and closed exactly equals mass-law wall, without ballistic doors',()=>{
 const rr=[{id:'a',boxes:[{min:[-3,0,-2],max:[0,3,2]}]},{id:'b',boxes:[{min:[0,0,-2],max:[3,3,2]}]}],door={id:'door',roomA:'a',roomB:'b',center:[0,1.5,0],normal:[1,0,0],width:2,height:3,kind:'door',closedMaterial:'wood',thicknessM:.04};let last=-Infinity;
 for(let i=0;i<=20;i++){const r=propagateSound(event([-2,1.5,0]),[2,1.5,0],{rooms:rr,portals:[{...door,openness:i/20}],walls:[]});assert.ok(r.levelDb>=last-1e-10);last=r.levelDb;if(i===0){const equivalent=propagateSound(event([-2,1.5,0]),[2,1.5,0],{rooms:rr,portals:[],walls:[{id:'panel',material:'wood',nominalThicknessM:.04,at:[0,1.5,0],size:[.04,3,2]}]});assert.ok(Math.abs(r.levelDb-equivalent.levelDb)<1e-10);}}
});
test('SND1 Mach cone comes from local trajectory before muzzle boom, none for subsonic / after projectile stops',()=>{
 const segment=v=>[{medium:'air',from:[0,1,0],to:[350,1,0],velocityFromMps:v,velocityMps:v,timeStartS:0,timeEndS:350/v}],listener=[300,1,2],r=machCrack(segment(879),listener);assert.ok(r&&r.arrivalTimeS<Math.hypot(300,2)/343);assert.ok(Math.abs(r.machAngleDeg-Math.asin(343/879)*180/Math.PI)<1e-10);assert.ok(r.direction[0]<0&&r.direction[2]<0);assert.equal(machCrack(segment(300),listener),null);assert.equal(machCrack([{...segment(879)[0],medium:'body'}],listener),null);assert.equal(machCrack([{...segment(879)[0],to:[100,1,0]}],listener),null);
});
test('SND1 hearing retains 2D suppression/pain/deafness, masking and deterministic position error; dose recovers',()=>{
 const e=event([0,1,0],'footstep_walk'),p=propagateSound(e,[2,1,0],{rooms:[rooms.at(-1)],portals:[],walls:[]}),h=newHearing(),r=hearNoise(e,p,h,{},()=>0),injured=hearNoise(e,p,h,{suppression:80,pain:80},()=>0);assert.ok(r.heard);assert.ok(Math.abs(injured.probability-r.probability*.7*.75)<1e-12);assert.ok(r.positionErrorM>0);
 h.loss=.8;const deaf=hearNoise(e,p,h,{},()=>0);assert.ok(deaf.probability<=r.probability*.12);h.maskDb=100;assert.equal(hearNoise(e,p,h,{},()=>0).heard,false);const healthy=newHearing(),gun=event([0,1,0]);exposeHearing(healthy,gun,propagateSound(gun,[1,1,0],{rooms:[rooms.at(-1)],portals:[],walls:[]}));const peak=healthy.loss;tickHearing(healthy,60);assert.ok(healthy.loss<peak*.2);
});

test('SND1 auditory watch never fires without vision, visual evidence wins and expired noise resumes entry',async()=>{
 const {CombatDecision}=await import('../apps/training/src/combat-decision.js'),{Vector3}=await import('three');const d=new CombatDecision(()=>.5),base={time:0,arrived:false,rounds:30,medical:{},down:false,reloadDurationS:3};const quiet=d.step({...base,senses:{target:null}});assert.equal(quiet.move,true);
 const heard=d.step({...base,time:1,senses:{target:null,noise:{point:new Vector3(1,1,1)}}});assert.equal(heard.state,'watch');assert.equal(heard.target.part,'noise');assert.equal(heard.fire,false);assert.equal(heard.move,false);
 const expired=d.step({...base,time:10,senses:{target:null}});assert.equal(expired.state,'enter');assert.equal(expired.move,true);
 const seen=d.step({...base,time:11,senses:{target:{part:'chest',point:new Vector3(2,1,2)},noise:{point:new Vector3(9,1,9)}}});assert.equal(seen.state,'reaction');assert.equal(seen.target.part,'chest');
});

test('SND1 portal center paths cannot silently cut through a thin plywood obstacle',()=>{
 const rr=[{id:'a',boxes:[{min:[-3,0,-2],max:[0,3,2]}]},{id:'b',boxes:[{min:[0,0,-2],max:[3,3,2]}]}],p={id:'opening',roomA:'a',roomB:'b',center:[0,1.5,0],normal:[1,0,0],width:2,height:3,kind:'opening',openness:1},w={id:'plywood',material:'wood',nominalThicknessM:.018,at:[-1,1.5,0],size:[.018,3,2]};const r=propagateSound(event([-2,1.5,0]),[2,1.5,0],{rooms:rr,portals:[p],walls:[w]});assert.equal(r.components.length,1);assert.equal(r.components[0].kind,'wall');assert.equal(r.components[0].wallHits[0].id,'plywood');
});

test('v47 one close indoor shot has no tinnitus or abrupt strong muffling; sustained fire builds and recovers',()=>{
 const h=newHearing(),gun=event([0,1,0]),physical={exposureDb:164};
 exposeHearing(h,gun,physical);const first=hearingPresentation(h);
 assert.equal(first.tinnitusGain,0);assert.ok(h.loss<.07);assert.ok(first.lowpassHz>18000&&first.gain>.95);
 for(let i=1;i<20;i++){tickHearing(h,.1);exposeHearing(h,gun,physical);}
 const burst=hearingPresentation(h);assert.ok(burst.tinnitusGain>0&&burst.tinnitusGain<=.004);assert.ok(h.loss>.5);
 tickHearing(h,60);assert.equal(hearingPresentation(h).tinnitusGain,0);assert.ok(h.loss<.06);
});

test('v47 longer playback decay does not count as a longer physical impulse; footsteps never add hearing dose',()=>{
 const gun=event([0,1,0]),physical={exposureDb:160},h=newHearing();
 exposeHearing(h,event([0,1,0],'footstep_run'),physical);assert.equal(h.dose,0);
 exposeHearing(h,gun,physical);assert.ok(Math.abs(h.dose-.00025*100*(.125/.12))<1e-14);
 const before=h.dose;tickHearing(h,.1);assert.ok(h.dose<before);
});
