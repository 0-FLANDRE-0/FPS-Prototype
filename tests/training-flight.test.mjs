import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {Vector3,Scene,Matrix4} from 'three';
import {CATALOG,compatibleAmmo,shotBallistics} from '../apps/training/src/catalog.js';
import {getVelocityDragClass,getDistanceVelocityRetention} from '../apps/training/src/generated/legacy-flight.js';
import {extractFlight} from '../scripts/training-flight.mjs';
import {flightProfile,advanceFlight,FLIGHT_LIMITS} from '../apps/training/src/flight.js';
import {traceShot} from '../apps/training/src/ballistics.js';
import {createPhysics} from '../apps/training/src/physics.js';
import {LONG_RANGE,BOXES} from '../apps/training/src/config.js';
import {TrainingTrajectories,TRAJECTORY_SEGMENTS_PER_SHOT,TRAJECTORY_SHOTS,displaySegments} from '../apps/training/src/trajectories.js';
const open={contact:()=>null,bodyPaths:()=>[],armorContacts:()=>[]},forward=new Vector3(0,0,-1);
test('flight extraction and all M4/AK drag classes/retentions match the untouched original VM',async()=>{
 const r=await extractFlight();assert.equal(await readFile('apps/training/src/generated/legacy-flight.js','utf8'),r.source);
 const c=createContext({console:{log(){},warn(){}}}),manifest=JSON.parse(await readFile('reference/2d/src/manifest.json','utf8'));
 for(const{path}of manifest.scripts){runInContext(await readFile('reference/2d/'+path,'utf8'),c,{timeout:5000});if(path==='src/data/ammunition-registry.js')break;}
 for(const ammo of [...compatibleAmmo(),...compatibleAmmo('ak74m')].map(id=>CATALOG.AMMO_PRESETS[id]).concat([null,{caliber:'7.62x39'},{energyClass:'pistol_ap'},{velocityDragClass:'unknown'}]))for(const distance of [0,1,100,500]){
  c.fixture={ammo,distance};assert.equal(getVelocityDragClass(ammo),runInContext('getVelocityDragClass(fixture.ammo)',c));assert.equal(getDistanceVelocityRetention(ammo,distance),runInContext('getDistanceVelocityRetention(fixture.ammo,fixture.distance)',c));
 }
});
test('vacuum follows gravity/time; quadratic drag reproduces selected 3D retention and lowers mechanical energy',()=>{
 const b=shotBallistics('556_m855'),origin=new Vector3(0,100,0),vacuum=traceShot(open,origin,forward,b,{simulateFlight:true,maxDistance:500,flightOptions:{drag:false}}),last=vacuum.segments.at(-1),t=vacuum.flight.timeS;
 assert.ok(Math.abs(last.to[1]-(100-.5*9.81*t*t))<1e-9);assert.ok(Math.abs(last.to[2]+b.muzzleVelocityMps*t)<1e-8);
 const drag=traceShot(open,origin,forward,b,{simulateFlight:true,maxDistance:500,flightOptions:{gravity:0}}),v=b.muzzleVelocityMps*flightProfile(CATALOG.AMMO_PRESETS[b.ammoId]).retentionPer100M**5;
 assert.ok(Math.abs(drag.residual.velocityMps-v)<1e-6);assert.ok(drag.flight.timeS>t);
 const profile=flightProfile(CATALOG.AMMO_PRESETS[b.ammoId]);let p=origin.clone(),velocity=forward.clone().multiplyScalar(b.muzzleVelocityMps),energy=.5*velocity.lengthSq()+9.81*p.y;
 for(let i=0;i<180;i++){const next=advanceFlight(p,velocity,FLIGHT_LIMITS.maxStepS,profile),e=.5*next.velocity.lengthSq()+9.81*next.position.y;assert.ok(e<energy);p=next.position;velocity=next.velocity;energy=e;}
 const both=traceShot(open,origin,forward,b,{simulateFlight:true,maxDistance:500});assert.ok(both.segments.at(-1).to[1]<last.to[1]);assert.ok(both.flight.samples<200);
});
test('flight sweeps actual thin plates and continues original penetration, stability and ricochet with slower arrival speeds',async()=>{
 const p=await createPhysics();try{
  const b=shotBallistics('556_m855');for(const x of [11.5,14,16.5,19,29]){const t=traceShot(p,new Vector3(x,1.5,-8),forward,b,{simulateFlight:true,random:()=>.5,maxDistance:620});assert.equal(t.hit.kind,'target');assert.ok(t.events.every(e=>e.outcome==='penetrated'));assert.ok(t.events[0].before.velocityMps<b.muzzleVelocityMps);assert.ok(t.segments.some(s=>s.state==='penetrated'&&s.medium==='air'));assert.ok(t.residual.stability<1);if(x===19)assert.ok(t.events[0].pathLenM<.0016,'1.5mm steel swept, not tunneled');if(x===29){assert.equal(t.events.length,3);assert.ok(t.events[1].before.velocityMps<t.events[0].after.velocityMps);}}
  const rolls=[.999,0,.5],t=traceShot(p,new Vector3(23.2,1.5,-15.94),new Vector3(1,0,-.1).normalize(),b,{simulateFlight:true,maxDistance:620,random:()=>rolls.shift()??.5});assert.equal(t.events[0].outcome,'ricochet');assert.equal(t.segments.find(s=>s.state==='ricochet'&&s.medium==='air').velocityFromMps,t.events[0].after.velocityMps);assert.ok(t.flight.timeS>0);assert.ok(t.residual.velocityMps<b.muzzleVelocityMps);
 }finally{p.dispose();}
});
test('long range has real 100–500m targets, clear firing paths, gravity misses, compensated hits and floor/backstop collision',async()=>{
 const p=await createPhysics();try{
  const b=shotBallistics('556_m855');for(const lane of LONG_RANGE.lanes){assert.equal(lane.firingZ-lane.z,lane.distanceM);const origin=new Vector3(lane.x,1.5,lane.firingZ),dir=new Vector3(0,.000012*lane.distanceM,-1).normalize();const t=traceShot(p,origin,dir,b,{simulateFlight:true,maxDistance:620});assert.equal(t.hit.id,lane.id);assert.ok(t.flight.distanceM>lane.distanceM-.06);assert.ok(t.residual.velocityMps<b.muzzleVelocityMps);assert.equal(t.events.length,0);}
  const miss=traceShot(p,new Vector3(54,1.5,3),forward,b,{simulateFlight:true,maxDistance:620,random:()=>.999});assert.equal(miss.hit.id,'long-floor');assert.ok(miss.hit.distance<500);assert.ok(Math.abs(miss.hit.point.y)<1e-6);
  const stop=traceShot(p,new Vector3(56,4,3),forward,b,{simulateFlight:true,maxDistance:620,flightOptions:{gravity:0}});assert.equal(stop.hit.id,'long-backstop');assert.equal(stop.events[0].outcome,'stopped');
  p.relocate(LONG_RANGE.spawn);for(let i=0;i<330;i++)p.step({move:{x:0,y:-1},crouch:false,sprint:false},0);assert.ok(p.feet.z<-2);assert.ok(Math.abs(p.feet.y)<.03);assert.ok(p.grounded);
  p.relocate({x:29,z:3});for(let i=0;i<330;i++)p.step({move:{x:1,y:0},crouch:false,sprint:false},0);assert.ok(p.feet.x>35,'walk through sector 02/03 passage');
  assert.ok(BOXES.find(b=>b.id==='long-backstop').penetrable===false);
 }finally{p.dispose();}
});
test('curved arrival retains plate/backer/body/rear ordering and actual medical energy inputs without reviving residual speed',async()=>{
 const p=await createPhysics();try{
  const b=shotBallistics('556_m995_ap'),t=traceShot(p,new Vector3(17,1.335,0),forward,b,{simulateFlight:true,maxDistance:620,random:()=>.001});
  assert.equal(t.armorResults[0].kind,'plate');assert.equal(t.armorResults[1].kind,'soft');assert.equal(t.bodyHits.length,1);
  const body=t.bodyHits[0];assert.equal(body.outcome,'body_through_and_through');assert.ok(body.before.velocityMps<t.armorResults[1].after.velocityMps);assert.ok(body.velocityOutMps<body.velocityInMps);assert.ok(body.energyDepositedJ>0);assert.ok(Math.abs(body.energyInJ-body.energyOutJ-body.energyDepositedJ)<1e-6);
  assert.ok(t.armorContacts.find(c=>c.slot==='rear').distance>body.distance);
  for(const r of t.armorResults)assert.ok(r.after.velocityMps<=r.before.velocityMps);
 }finally{p.dispose();}
});
test('long curved trajectory display remains bounded, retains endpoints/colors/material chords, and cannot alter collisions',()=>{
 const seg=[];let z=0;for(const state of ['initial','penetrated','ricochet']){for(let i=0;i<600;i++){seg.push({from:[0,2-z*z*.00001,z],to:[0,2-(z-1)**2*.00001,z-1],state,medium:'air'});z--;}seg.push({from:[0,0,z],to:[0,0,z-.02],state,medium:'barrier'});z-=.02;}
 const untouched=JSON.stringify(seg),sampled=displaySegments(seg);assert.ok(sampled.length<=TRAJECTORY_SEGMENTS_PER_SHOT);assert.deepEqual(sampled[0].from,seg[0].from);assert.deepEqual(sampled.at(-1).to,seg.at(-1).to);assert.equal(sampled.filter(s=>s.medium==='barrier').length,3);assert.deepEqual(new Set(sampled.map(s=>s.state)),new Set(['initial','penetrated','ricochet']));
 const display=new TrainingTrajectories(new Scene());display.setEnabled(true);for(let i=0;i<TRAJECTORY_SHOTS+5;i++)display.shot({shotId:i,trace:{segments:seg}});assert.equal(display.shots.length,TRAJECTORY_SHOTS);assert.equal(display.mesh.count,sampled.length*TRAJECTORY_SHOTS);assert.equal(JSON.stringify(seg),untouched);display.dispose();
});
test('enabled trajectory instances render every actual curved flight chord, instead of joining muzzle to impact with one line',()=>{
 const trace=traceShot(open,new Vector3(0,100,0),forward,shotBallistics('556_m855'),{simulateFlight:true,maxDistance:500}),display=new TrainingTrajectories(new Scene());
 const original=JSON.stringify(trace);display.setEnabled(true);display.shot({shotId:1,trace});assert.equal(display.mesh.count,trace.segments.length);assert.ok(display.mesh.count>100);
 const first=new Vector3(...trace.segments[0].from),last=new Vector3(...trace.segments.at(-1).to),axis=last.clone().sub(first).normalize();let curveDeviation=0;
 for(const [i,segment]of trace.segments.entries()){
  const matrix=new Matrix4();display.mesh.getMatrixAt(i,matrix);assert.ok(new Vector3(0,-.5,0).applyMatrix4(matrix).distanceTo(new Vector3(...segment.from))<.0001);assert.ok(new Vector3(0,.5,0).applyMatrix4(matrix).distanceTo(new Vector3(...segment.to))<.0001);
  const offset=new Vector3(...segment.to).sub(first);curveDeviation=Math.max(curveDeviation,offset.addScaledVector(axis,-offset.dot(axis)).length());
 }
 assert.ok(curveDeviation>.4,'physical bow relative to a straight muzzle/impact line');assert.equal(JSON.stringify(trace),original);display.dispose();
});
