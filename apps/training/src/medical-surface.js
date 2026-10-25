// Presentation records only. Never insert geometry into retained wound metadata
// or consume medical/gameplay RNG. Reset keys are medical bridge instances.
import{Vector3}from'three';
import{actorRotation,resolveBodyAddress}from'./human-targets.js';
import{solidMeshIntervals}from'./armor-geometry.js';
export const MEDICAL_SURFACE=Object.freeze({ruleId:'medical-surface-m1-v57',probeM:.003,surfaceToleranceM:.001,grazeMaxPathM:.04,grazeMaxDepthM:.004,grazeMaxNormalDot:.35,classification:'기존 충돌 결과 기록 / 스침 분류 튜닝'});
const records=new WeakMap();
export const clearMedicalSurfaces=bridge=>records.delete(bridge);
export const medicalSurfaces=bridge=>[...(records.get(bridge)?.values()||[])];
function surfaceAt(point,incoming,sensors,exit){
 const dir=incoming.clone().multiplyScalar(exit?-1:1),origin=point.clone().addScaledVector(dir,-MEDICAL_SURFACE.probeM);let best=null;
 for(const s of sensors){const inverse=s.pose.rotation.clone().invert(),local=origin.clone().sub(s.pose.position).applyQuaternion(inverse),d=dir.clone().applyQuaternion(inverse);
  for(const hit of solidMeshIntervals(s.triangles,local,d,MEDICAL_SURFACE.probeM*2)){
   const error=Math.abs(hit.entry-MEDICAL_SURFACE.probeM);if(hit.normal.lengthSq()===0||error>MEDICAL_SURFACE.surfaceToleranceM||best&&error>=best.error)continue;
   best={error,sensor:s,normal:hit.normal.clone().applyQuaternion(s.pose.rotation)};
  }
 }
 return best;
}
function describe(actor,rig,point,hit){
 if(!hit)return null;
 const normal=hit.normal,shape=hit.sensor.shape,a=resolveBodyAddress(actor,shape,point,normal.clone().negate(),rig),inverse=actorRotation(actor).invert(),bindNormal=normal.clone().applyQuaternion(inverse);
 if(rig&&shape.bone)bindNormal.transformDirection(rig.delta(shape.bone).invert());
 return{worldPoint:point.toArray(),worldNormal:normal.toArray(),bindActorPoint:a.localPoint,bindNormal:bindNormal.toArray(),face:bindNormal.z>=0?'front':'back',address:a};
}
export function recordMedicalSurface(bridge,wound,{body,part,physics,event}){
 const actor=physics?.internalActors?.get(bridge.targetId),rig=physics?.humanRigs?.get(bridge.targetId);if(!actor||!part.shapeIds?.length||!body.point||!body.incomingDirection)return;
 const sensors=physics.humanSensors.filter(s=>s.actor.id===bridge.targetId&&part.shapeIds.includes(s.shape.id)),direction=new Vector3(...body.incomingDirection),origin=new Vector3(...body.point),entryPoint=origin.clone().addScaledVector(direction,part.entryDistance-body.entryDistance),exitPoint=origin.clone().addScaledVector(direction,part.exitDistance-body.entryDistance);
 const first=surfaceAt(entryPoint,direction,sensors,false),last=part.exitWound?surfaceAt(exitPoint,direction,sensors,true):null,entry=describe(actor,rig,entryPoint,first),exit=describe(actor,rig,exitPoint,last);
 let depthM=null;
 if(entry&&part.lengthM<=MEDICAL_SURFACE.grazeMaxPathM&&Math.abs(direction.dot(first.normal))<=MEDICAL_SURFACE.grazeMaxNormalDot){
  depthM=0;for(const t of[.25,.5,.75]){const world=entryPoint.clone().lerp(exitPoint,t);let nearest=Infinity;
   for(const s of sensors){const local=world.clone().sub(s.pose.position).applyQuaternion(s.pose.rotation.clone().invert()),closest=new Vector3();for(const{triangle}of s.triangles){triangle.closestPointToPoint(local,closest);nearest=Math.min(nearest,closest.distanceTo(local));}}
   depthM=Math.max(depthM,nearest);
  }
 }
 const graze=depthM!==null&&depthM<=MEDICAL_SURFACE.grazeMaxDepthM;
 const row={woundId:wound.id,shotId:event.shotId,partKey:part.bodyPart,entry,exit,pathLengthM:part.lengthM,skinDepthM:depthM,type:graze?'graze':part.exitWound?'through':(part.woundChannel?.stopped||body.retained)?'retained':'other',physicalExit:!!part.exitWound,surfaceIncomplete:!entry||!!part.exitWound&&!exit,provenance:'completed trace part endpoints + existing fitted closed-mesh normals; unposed with rig.delta inverse'};
 if(!records.has(bridge))records.set(bridge,new Map());records.get(bridge).set(wound.id,freeze(row));return row;
}

function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
