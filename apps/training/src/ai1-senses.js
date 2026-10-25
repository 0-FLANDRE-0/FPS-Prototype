import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {actorRotation} from './human-targets.js';
import {AI1,clamp} from './ai1-config.js';
export const VISUAL_POINTS=Object.freeze([['head','head',.15],['chest','chest',.25],['pelvis','pelvis',.20],['leftArm','leftForearm',.075],['rightArm','rightForearm',.075],['leftLeg','leftLowerLeg',.10],['rightLeg','rightLowerLeg',.10],['leftFoot','leftFoot',.025],['rightFoot','rightFoot',.025]]);
export function sensoryPoints(body){return Object.fromEntries(VISUAL_POINTS.map(([part,bone])=>[part,part==='head'?body.pose.eye(body.actor):body.pose.point(body.actor,bone)]));}
// The ONLY module allowed to inspect current target geometry. The brain receives
// observations, never target actors / physics / hidden landmarks.
export class AI1Senses{
 constructor({phase=0}={}){this.nextSample=phase;this.gauge=0;this.lastSeen=null;this.previousVisible=null;this.samples=0;this.rayCount=0;this.rays=[];this.output={visible:[],exposure:0,target:null,memory:null,noise:null};}
 sample({time,actor,eye,targetPoints,physics,crouched=false,behavior={}}){
  if(time+1e-9<this.nextSample)return this.output;
  const dt=this.sampleTime==null?AI1.sensePeriodS:time-this.sampleTime;this.sampleTime=time;this.nextSample=time+AI1.sensePeriodS;this.samples++;
  const forward=new Vector3(0,0,1).applyQuaternion(actorRotation(actor)),visible=[],rays=[];let exposure=0;
  for(const [part,,weight]of VISUAL_POINTS.slice(0,AI1.maxRays)){const point=targetPoints[part];if(!point)continue;const delta=point.clone().sub(eye),distance=delta.length(),dir=delta.clone().normalize(),eccentricity=Math.acos(clamp(dir.dot(forward),-1,1)),inFov=eccentricity<=(behavior.visionFovDeg??AI1.fovDeg)*Math.PI/360&&distance<=(behavior.visionDistanceM??Infinity);let hit=null;
   if(inFov){this.rayCount++;hit=physics.world.castRayAndGetNormal(new RAPIER.Ray(eye,dir),Math.max(0,distance-.015),true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,physics.collider,physics.body,c=>physics.surface.get(c.handle)?.kind!=='human-movement');}
   const clear=inFov&&!hit;rays.push({part,point:point.toArray(),inFov,clear,occluderId:hit?physics.surface.get(hit.collider.handle)?.id:null,blockedDistanceM:hit?.timeOfImpact??null});if(clear){visible.push(part);exposure+=weight;}
  }
  let target=null,velocity=new Vector3(),distance=null,eccentricity=null,motion=0;
  if(visible.length){const part=visible.includes('chest')?'chest':visible.includes('pelvis')?'pelvis':visible.includes('head')?'head':visible[0],point=targetPoints[part].clone();distance=point.distanceTo(eye);eccentricity=point.clone().sub(eye).normalize().angleTo(forward);
   if(this.previousVisible?.part===part&&time-this.previousVisible.time<.25){velocity.copy(point).sub(this.previousVisible.point).divideScalar(time-this.previousVisible.time);if(velocity.length()>8)velocity.setLength(8);}motion=velocity.length();this.previousVisible={part,point:point.clone(),time};
   const rate=AI1.detectionRate*exposure**1.35*clamp(7/Math.max(1,distance),.25,2)*(1-.7*(eccentricity/(Math.PI/3))**1.5)*(1+Math.min(1,motion/3))*(crouched?.75:1)*(behavior.visionDetection??1);
   this.gauge=clamp(this.gauge+dt*rate);
   if(this.gauge>=1){target={part,point,velocity,time,confidence:exposure,exposure,distance,eccentricity,motion,angularWidthRad:2*Math.atan((part==='head'?.09:.22)/Math.max(.1,distance))};this.lastSeen={...target,point:point.clone(),velocity:velocity.clone()};}
  }else{this.gauge=clamp(this.gauge-dt*.45);this.previousVisible=null;}
  this.rays=rays;this.output={visible,exposure,gauge:this.gauge,target,memory:this.memory(time),noise:null,sampleTime:time,distance,eccentricity,motion,rayCount:this.rayCount,samples:this.samples};return this.output;
 }
 memory(time){if(!this.lastSeen)return null;const confidence=clamp(this.lastSeen.confidence-AI1.memoryDecayPerS*(time-this.lastSeen.time));return confidence>.02?{...this.lastSeen,confidence,point:this.lastSeen.point.clone(),velocity:this.lastSeen.velocity.clone()}:null;}
 snapshot(time){const serial=o=>o?{...o,point:o.point.toArray(),velocity:o.velocity?.toArray()}:null;return{...this.output,target:serial(this.output.target),memory:serial(this.memory(time)),rays:this.rays,gauge:this.gauge,nextSample:this.nextSample};}
}
