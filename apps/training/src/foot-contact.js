import{Vector3}from'three';
import RAPIER from'@dimforge/rapier3d-compat';
import{actorRotation}from'./human-targets.js';
import data from'../assets/sounds/prepared/locomotion.json' with{type:'json'};
// Tuning: contact 12mm, lift hysteresis 25mm; actual immutable boot sole FK.
export const FOOT_CONTACT=Object.freeze({touchM:.012,liftM:.025,maxPenetrationM:.025,supportMaxMps:-.02});
export function groundAt(physics,point){
 const ray=new RAPIER.Ray({x:point.x,y:point.y+.15,z:point.z},{x:0,y:-1,z:0});
 const hit=physics.world.castRayAndGetNormal(ray,.9,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,physics.collider,physics.body,c=>['floor','wall','barrier','crate','cover','loot'].includes(physics.surface.get(c.handle)?.kind));
 if(!hit||hit.normal.y<.6)return null;return{point:new Vector3(point.x,point.y+.15-hit.timeOfImpact,point.z),id:physics.surface.get(hit.collider.handle)?.id,surface:physics.surface.get(hit.collider.handle),clearanceM:hit.timeOfImpact-.15};
}
export class FootContactTracker{
 constructor(){this.reset();}
 reset(){this.feet={};this.events=[];this.contacts=0;this.samples={};}
 sample({rig,actor,physics,time,moving=true,grounded=true,velocity=null}){
  const events=[],rotation=actorRotation(actor),at=new Vector3(...actor.at);
  for(const side of['left','right']){
   const bone=rig.byName.get(side+'Foot');let point=null;
   for(const p of data.solePoints[side]){const v=new Vector3(...p).applyMatrix4(bone.matrixWorld).applyQuaternion(rotation).add(at);if(!point||v.y<point.y)point=v;}
   const ground=groundAt(physics,point),clearance=ground?.clearanceM??Infinity,previous=this.feet[side],touch=!!ground&&clearance<=FOOT_CONTACT.touchM&&clearance>=-FOOT_CONTACT.maxPenetrationM;
   const armed=(previous?.armed??false)||clearance>=FOOT_CONTACT.liftM,relativeAnkle=bone.getWorldPosition(new Vector3()).applyQuaternion(rotation),dt=previous?time-previous.time:0,travel=velocity?.clone().setY(0).normalize(),supportVelocityMps=previous&&dt>0&&travel?relativeAnkle.clone().sub(previous.relativeAnkle).divideScalar(dt).dot(travel):0;
   const supporting=supportVelocityMps<=FOOT_CONTACT.supportMaxMps;
   // No cadence/minimum-height approximation: emit only a lifted sole returning
   // to the collision surface. Standing initialization cannot emit a step.
   let contacted=false;if(previous&&armed&&touch&&grounded&&moving&&supporting){const e={side,bone:side+'Foot',time,position:ground.point.toArray(),anklePosition:relativeAnkle.clone().add(at).toArray(),solePosition:point.toArray(),clearanceM:clearance,supportVelocityMps,colliderId:ground.id};contacted=true;events.push(e);this.events.push(e);this.contacts++;}
   this.feet[side]={armed:contacted?false:armed,clearanceM:clearance,relativeAnkle,time};this.samples[side]={solePosition:point.toArray(),clearanceM:Number.isFinite(clearance)?clearance:null,grounded:touch,colliderId:ground?.id||null};
  }
  if(this.events.length>120)this.events.splice(0,this.events.length-120);return events;
 }
 snapshot(){return{contacts:this.contacts,feet:structuredClone(this.samples),recent:structuredClone(this.events)};}
}
