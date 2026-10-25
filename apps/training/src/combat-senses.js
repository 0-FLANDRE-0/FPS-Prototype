import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {actorRotation} from './human-targets.js';
import {COMBAT} from './combat-config.js';
// Interface: sample({actor,eye,targetPoints,physics}) -> visible[] + target.
// Only scene occluders hide the three actual proxy-body landmarks.
export function sampleCombatSenses({actor,eye,targetPoints,physics,behavior=null,random=null}){
 const forward=new Vector3(0,0,1).applyQuaternion(actorRotation(actor)),visible=[],rays=[];
 for(const [part,point]of Object.entries(targetPoints)){
  const delta=point.clone().sub(eye),distance=delta.length(),dir=delta.clone().normalize(),inFov=distance<=(behavior?.visionDistanceM??Infinity)&&dir.dot(forward)>=Math.cos((behavior?.visionFovDeg??COMBAT.visionFovDeg)*Math.PI/360);
  let hit=null;if(inFov)hit=physics.world.castRayAndGetNormal(new RAPIER.Ray(eye,dir),distance-.015,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,physics.collider,physics.body,c=>physics.surface.get(c.handle)?.kind!=='human-movement');
  const detected=(behavior?.visionDetection??1)>=1||!!random&&random()<behavior.visionDetection,clear=inFov&&!hit&&detected;rays.push({part,point:point.toArray(),inFov,clear,occluderId:hit?physics.surface.get(hit.collider.handle)?.id:null});if(clear)visible.push(part);
 }
 const part=visible.includes('chest')?'chest':visible.includes('head')?'head':visible[0];
 return{visible,rays,target:part?{part,point:targetPoints[part].clone()}:null};
}
