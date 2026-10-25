// Fixed anatomical rays for S3. Discovery uses geometry only, before any C fit.
// All replayed rays use production RK4/traceShot/body/medical with no invented
// anatomy, HP, tissue volume, projectile state or organ result.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Vector3} from 'three';
import {s0Context} from './training-s0-fixtures.mjs';

export const S3_BASELINE='3614b8100c8c41df7de009bacef643f08f5e6b90';
export const S3_NEW_HP=Object.freeze({head:85,neck:60,chest:240,abdomen:180,leftArm:75,rightArm:75,leftLeg:120,rightLeg:120});
export const S3_GOALS=Object.freeze({head:[1,2],chest:[4,6],abdomen:[2,3],arm:[3,5],leg:[2,3]});
export const S3_CALIBRATION_AMMO='556_m855';
export const S3_FIXTURE_PATH='tests/fixtures/imported/checks-s3b-v42/fixtures.json';
export const categoryForPart=part=>/Arm$/.test(part)?'arm':/Leg$/.test(part)?'leg':part;
export const loadS3Fixtures=async(root=process.cwd())=>JSON.parse(await readFile(resolve(root,S3_FIXTURE_PATH),'utf8'));
export async function s3Context(directory=process.cwd()){
 const c=await s0Context(directory),load=name=>import(pathToFileURL(resolve(directory,'apps/training/src/'+name+'.js')));
 const [{flightProfile,advanceFlight},{CATALOG},{debugShotBallistics}]=await Promise.all([load('flight'),load('catalog'),load('debug-weapon')]);
 c.fireS3=function({fixture,ammoId='556_m855',distanceM=5,shotId=1001,random=()=>.001,isolateAnatomy=true}={}){
  const target=new Vector3(...fixture.target),direction=new Vector3(...fixture.direction).normalize();
  const weaponId=ammoId.startsWith('545_')?'ak74m':ammoId.startsWith('556_')?'m4a1':'debug-ak';
  assert.ok(weaponId!=='debug-ak'||ammoId==='762x39_ps','Only the requested uncalibrated PS comparison uses debug registry velocity');
  const ballistics=weaponId==='debug-ak'?debugShotBallistics({ammoId}):c.shotBallistics(ammoId,weaponId),origin=target.clone().addScaledVector(direction,-distanceM),profile=flightProfile(CATALOG.AMMO_PRESETS[ammoId]);
  let pos=new Vector3(),velocity=direction.clone().multiplyScalar(ballistics.muzzleVelocityMps),along=0;
  while(along<distanceM-1e-8){const dt=Math.min(1/120,(distanceM-along)/Math.max(1,velocity.dot(direction))),next=advanceFlight(pos,velocity,dt,profile);pos=next.position;velocity=next.velocity;along=pos.dot(direction);}
  origin.y=target.y-pos.y;const query=Object.create(c.physics);
  if(isolateAnatomy){const fixed=new Set([...c.physics.surface].filter(([,s])=>!['human','armor-sensor'].includes(s.kind)).map(([h])=>h));query.contact=(o,d,n,excluded=new Set(),opts)=>c.physics.contact(o,d,n,new Set([...excluded,...fixed]),opts);}
  const trace=c.traceShot(query,origin,direction,ballistics,{shotId,random,simulateFlight:true,maxDistance:distanceM+3});
  const event={shotId,time:0,origin,direction,ballistics,ammoId,trace};c.enemy.record(event);return event;
 };
 return c;
}
export function partEvidence(event,partKey){
 const parts=event.trace.bodyHits.flatMap((b,bodyIndex)=>b.parts.map((p,partIndex)=>({bodyIndex,partIndex,...p}))).filter(p=>p.bodyPart===partKey);
 const directHits=event.trace.bodyHits.flatMap(b=>b.internalHits||[]).filter(h=>h.bodyPart===partKey||h.part===partKey||parts.some(p=>(p.woundChannel?.organs||[]).some(o=>o.id===h.id&&o.actualIntersection)));
 return {partKey,parts:parts.map(p=>({bodyIndex:p.bodyIndex,partIndex:p.partIndex,bodyPart:p.bodyPart,shapeIds:p.shapeIds,address:p.address,lengthM:p.lengthM,
  velocityInMps:p.velocityInMps,velocityOutMps:p.velocityOutMps,massInKg:p.massInKg,massOutKg:p.massOutKg,damageIn:p.damageIn,penIn:p.penIn,
  effectiveVolumeCm3:(p.woundChannel?.volumes.effectiveM3??0)*1e6,channel:p.woundChannel})),
  effectiveVolumeCm3:parts.reduce((n,p)=>n+(p.woundChannel?.volumes.effectiveM3??0)*1e6,0),
  directHits:directHits.map(h=>({id:h.id,kind:h.kind,domain:h.domain,vesselKind:h.vesselKind,intervals:h.intervals})),
  allDirectHits:event.trace.bodyHits.flatMap(b=>b.internalHits||[]).map(h=>({id:h.id,kind:h.kind,domain:h.domain,vesselKind:h.vesselKind,intervals:h.intervals})),
  cavityEffects:parts.flatMap(p=>(p.woundChannel?.organs||[]).map(o=>({id:o.id,kind:o.kind,direct:o.direct,actualIntersection:o.actualIntersection,
   effectiveVolumeCm3:o.effectiveVolumeM3*1e6,severity:o.severity}))),
  bodyPartOrder:event.trace.bodyHits.flatMap(b=>b.parts.map(p=>p.bodyPart)),
  actualOrigin:event.origin.toArray(),actualDirection:event.direction.toArray(),muzzleVelocityMps:event.ballistics.muzzleVelocityMps};
}
export function calibrationObjective(rays,C){
 // Equal category weight; rays within each category share its weight equally.
 // Continuous HP/damage is log-compared with the interval whose CEILING
 // gives the allowed integer shot counts. Zero loss anywhere inside; this
 // avoids choosing an arbitrary central goal or a head overkill penalty.
 const byCategory=new Map();for(const r of rays){const values=byCategory.get(r.category)||[];values.push(r);byCategory.set(r.category,values);}
 let loss=0;for(const[category,items]of byCategory){const[lo,hi]=S3_GOALS[category],lower=Math.max(0,lo-1+1e-10);let categoryLoss=0;
  for(const r of items){const n=S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*C),delta=lower>0&&n<lower?Math.log(n/lower):n>hi?Math.log(n/hi):0;categoryLoss+=delta*delta;}
  loss+=categoryLoss/items.length;
 }return loss/byCategory.size;
}
export function fitCommonC(rays){
 assert.equal(new Set(rays.map(r=>r.category)).size,5);assert.ok(rays.every(r=>r.effectiveVolumeCm3>0));
 // The piecewise quadratic is convex in log(C), so ternary search has one
 // global minimum or a flat minimizing interval. No part-specific coefficient.
 let lo=Math.log(1e-5),hi=Math.log(1e3);for(let i=0;i<220;i++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(calibrationObjective(rays,Math.exp(a))<=calibrationObjective(rays,Math.exp(b)))hi=b;else lo=a;}
 const C=Math.exp((lo+hi)/2);return {C,objective:calibrationObjective(rays,C),definition:'Mean over5partcategories of the within-category mean squared log distance of continuous HP/(effectiveCm3*C) outside (minimumIntegerShots-1,maximumIntegerShots]. Eachcategory equalweight; eachfixedray within category equalweight; zero penalty inside the interval giving the requested CEIL(HP/damage) counts. Lower open boundary represented by+1e-10; head1-2 has no overkill penalty.',
  bounds:[1e-5,1e3],iterations:220};
}
export function commonCSolverProof(rays,C){
 const minimumInclusive=Math.max(...rays.map(r=>S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*S3_GOALS[r.category][1]))),maximumExclusive=Math.min(...rays.map(r=>{const lo=S3_GOALS[r.category][0];return lo>1?S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*(lo-1)):Infinity;}));
 if(minimumInclusive<maximumExclusive){assert.ok(C>=minimumInclusive-1e-14&&C<maximumExclusive);assert.ok(calibrationObjective(rays,C)<1e-20);return {method:'Same S3 equal-category log-distance objective and220-step ternary solver. S3b targets have a zero-loss interval; the solver deterministically chooses its lower boundary, not a unique optimum.',minimumInclusive,maximumExclusive,chosenC:C,objectiveAtChosen:calibrationObjective(rays,C),allRayCountsInTarget:rays.every(r=>{const n=Math.ceil(S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*C)-1e-12),g=S3_GOALS[r.category];return n>=g[0]&&n<=g[1];})};}
 const counts=new Map();for(const r of rays)counts.set(r.category,(counts.get(r.category)||0)+1);
 const categories=counts.size,active=[],t=Math.log(C);let weightedBoundary=0,activeWeight=0,derivative=0;
 for(const r of rays){const[lo,hi]=S3_GOALS[r.category],lower=lo-1+1e-10,n=S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*C),weight=1/categories/counts.get(r.category);
  const bound=n>hi?hi:n<lower?lower:null;if(bound===null)continue;
  const logBoundary=Math.log(S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*bound));
  active.push({name:r.name,category:r.category,side:n>hi?'too-many-hp-shots':'too-few-hp-shots',weight,logBoundary});weightedBoundary+=weight*logBoundary;activeWeight+=weight;derivative+=2*weight*(t-logBoundary);
 }
 const analyticC=Math.exp(weightedBoundary/activeWeight),neighbors=[-.1,-.01,-1e-4,1e-4,.01,.1].map(logOffset=>({logOffset,C:C*Math.exp(logOffset),objective:calibrationObjective(rays,C*Math.exp(logOffset))}));
 const analyticActiveStable=active.every(a=>{const r=rays.find(r=>r.name===a.name),[lo,hi]=S3_GOALS[r.category],n=S3_NEW_HP[r.partKey]/(r.effectiveVolumeCm3*analyticC);return a.side==='too-many-hp-shots'?n>hi:n<lo-1+1e-10;});
 assert.ok(activeWeight>0&&analyticActiveStable);assert.ok(Math.abs(Math.log(C/analyticC))<1e-8);assert.ok(neighbors.every(n=>n.objective>calibrationObjective(rays,C)));
 return {method:'Independent analytic optimum in log(C): on the active interval the objective is a positive-curvature quadratic; its minimum is the weighted mean of active log boundaries. Global convexity follows from squared distance to each log interval. This proves a unique real-number optimum; floating-point objective comparisons have a narrow rounding plateau.',
  active,activeWeight,curvaturePerLogCSquared:2*activeWeight,derivativeAtInstalledFit:derivative,analyticC,analyticActiveStable,
  chosenMinusAnalyticC:C-analyticC,relativeChosenMinusAnalyticC:C/analyticC-1,objectiveAtChosen:calibrationObjective(rays,C),objectiveAtAnalytic:calibrationObjective(rays,analyticC),neighbors};
}
