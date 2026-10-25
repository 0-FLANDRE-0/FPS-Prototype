import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {resolveBodyChannel,clipInternalGeometry,BODY_CHANNEL_RULE_ID} from '../apps/training/src/body-channel.js';
import {tissueIntervalsFromGeometry} from '../apps/training/src/internal-anatomy.js';
import {resolveBodyPath,BODY_EXIT_RULE_ID} from '../apps/training/src/protection.js';
import {traceShot} from '../apps/training/src/ballistics.js';
import {CATALOG,shotBallistics} from '../apps/training/src/catalog.js';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} ≈ ${b}`);
function state(id='556_m855',velocity=879){const a=CATALOG.AMMO_PRESETS[id];return {pen:a.penetration,damage:a.damage,velocity,initialVelocity:velocity,stability:1,barrierCount:0,ammo:a};}
function path(parts,start=1,id='T'){
 let end=start;const cells=parts.map(([part,n])=>{const entry=end;end+=n;return {entry,exit:end,shape:{id:part,part},address:{bodyPart:part}};});
 return {actor:{id},entry:start,exit:end,completeExit:true,cells,point:new Vector3(0,0,start),normal:new Vector3(0,0,-1),direction:new Vector3(0,0,1),address:{bodyPart:parts[0][0]}};
}
test('S2 uses one authoritative channel state for successive parts and conserves primary plus fragment energy',()=>{
 // M193 retains the source fragmentation profile. S3b also uses the shared fragment defaults for M855.
 const s=state('556_m193'),r=resolveBodyChannel(path([['leftArm',.1],['chest',.15],['rightArm',.1]]),s);
 assert.equal(r.ruleId,BODY_CHANNEL_RULE_ID);assert.equal(r.parts.length,3);assert.equal(s.velocity,r.parts.at(-1).woundChannel.exitVelocityMps);
 for(const [i,p]of r.parts.entries()){
  close(p.projectileEnergyInJ+p.fragmentEnergyInJ,p.energyShareJ+p.projectileEnergyOutJ+p.fragmentEnergyOutJ);
  close(p.woundChannel.traversedLengthM,p.lengthM);assert.equal(p.velocityOutMps,p.woundChannel.exitVelocityMps);assert.equal(p.massOutKg,p.woundChannel.stateOut.massKg);
  if(i){const previous=r.parts[i-1];assert.equal(p.velocityInMps,previous.velocityOutMps);assert.equal(p.massInKg,previous.massOutKg);close(p.woundChannel.initialYawRad,previous.woundChannel.stateOut.yawRad);assert.equal(p.fragmentEnergyInJ,previous.fragmentEnergyOutJ);}
 }
 close(r.energyInJ,r.energyDepositedJ+r.energyOutJ);close(r.parts.reduce((n,p)=>n+p.energyShareJ,0),r.energyDepositedJ);assert.ok(s.massKg<r.massKg);assert.equal(r.energyAccountingComplete,true);
});
test('new stop depth clips cached actual hits and excludes unvisited body parts',()=>{
 const r=resolveBodyChannel(path([['chest',1],['rightArm',.1]]),state('556_m193'),{geometry:{internalHits:[{id:'late',intervals:[[.8,.9]],entryDepthM:.8,exitDepthM:.9,traversedLengthM:.1}],cavityCandidates:[{id:'late',kind:'organ',organ:'liver',volumeM3:.001,surfaceDistanceM:0,closestDepthM:.85,cavityIntervals:[[.8,.9]]}]}});
 assert.equal(r.retained,true);assert.equal(r.velocityOutMps,0);assert.equal(r.parts.length,1);assert.ok(r.stopDepthM>0&&r.stopDepthM<.8);assert.equal(r.internalHits.length,0);assert.equal(r.cavityCandidates.length,0);assert.equal(r.parts[0].woundChannel.stopped,true);close(r.energyInJ,r.energyDepositedJ);
});
test('tissue interval cache makes the original skull/spinal envelope hollow around actual neural intersections',()=>{
 const hits=[{id:'skull',kind:'bone',identifier:'skull',intervals:[[.01,.2]]},{id:'brain',kind:'organ',organ:'brain',intervals:[[.03,.17]]},{id:'cervical-spine',kind:'bone',identifier:'spine',intervals:[[.3,.34]]},{id:'cervical-upper-spinal-cord',kind:'organ',organ:'spinal_cord',intervals:[[.31,.33]]},{id:'left-lung',kind:'organ',organ:'lung',intervals:[[.4,.5]]}],copy=structuredClone(hits),cache=tissueIntervalsFromGeometry(hits);
 assert.deepEqual(hits,copy);assert.deepEqual(cache[0].intervals,[[.01,.03],[.17,.2]]);assert.deepEqual(cache[1].intervals,[[.3,.31],[.33,.34]]);assert.equal(cache[2].kind,'lung');assert.equal(cache[0].boneType,'cortical');
});
test('cached geometry clipping preserves original metadata while cutting only traversed intervals',()=>{
 const geometry={internalHits:[{id:'a',intervals:[[.01,.1],[.15,.3]],entryDepthM:.01,exitDepthM:.3,traversedLengthM:.24}],nearMisses:[{id:'in',closestDepthM:.02},{id:'out',closestDepthM:.4}],tissueIntervals:[{id:'a',kind:'bone',intervals:[[.15,.3]]}],enclosureHits:[{id:'a',kind:'bone',intervals:[[.15,.3]]}]},copy=structuredClone(geometry),r=clipInternalGeometry(geometry,.2);
 assert.deepEqual(geometry,copy);assert.deepEqual(r.internalHits[0].intervals,[[.01,.1],[.15,.2]]);close(r.internalHits[0].traversedLengthM,.14);assert.equal(r.nearMisses.length,1);assert.deepEqual(r.enclosureHits[0].intervals,[[.15,.2]]);
});
test('legacy resistance remains an explicit separate implementation without authoritative S2 channels',()=>{
 const legacy=resolveBodyPath(path([['chest',.24]]),state()),s2=resolveBodyChannel(path([['chest',.24]]),state());
 assert.equal(legacy.ruleId,BODY_EXIT_RULE_ID);assert.equal(legacy.parts[0].woundChannel,undefined);assert.equal(s2.ruleId,BODY_CHANNEL_RULE_ID);assert.notEqual(legacy.velocityOutMps,s2.velocityOutMps);
});
test('a second target receives residual main mass and speed without the previous target fragment cloud energy',()=>{
 let queries=0;const definitions=[{start:1,end:1.2,id:'A'},{start:2,end:2.06,id:'B'}];
 const physics={contact:()=>null,armorContacts:()=>[],describeBodyPath(){queries++;return {};},annotateInternal(){},bodyPaths(origin,direction,distance){return definitions.filter(d=>d.end>origin.z+1e-7&&d.start-origin.z<=distance).map(d=>{const entry=Math.max(0,d.start-origin.z),exit=d.end-origin.z,p=path([['chest',exit-entry]],entry,d.id);p.point=origin.clone().addScaledVector(direction,entry);return p;});}};
 const r=traceShot(physics,new Vector3(),new Vector3(0,0,1),shotBallistics('556_m193'),{maxDistance:3});
 assert.equal(r.bodyHits.length,2);assert.equal(queries,2);const [a,b]=r.bodyHits;assert.equal(b.massKg,a.massOutKg);assert.equal(b.velocityInMps,a.velocityOutMps);assert.equal(b.fragmentEnergyInJ,0);assert.ok(a.untracedFragmentEnergyJ>0);assert.ok(b.massKg<a.massKg);close(a.energyInJ,a.energyDepositedJ+a.energyOutJ);close(b.energyInJ,b.energyDepositedJ+b.energyOutJ);
});
