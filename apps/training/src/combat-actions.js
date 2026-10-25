import {Vector3,Quaternion} from 'three';
import {COMBAT} from './combat-config.js';
import {traceShot} from './ballistics.js';
import {shotBallistics} from './catalog.js';
import {shooterPhysics} from './combat-physics.js';
import {FPS_HANDLING} from './handling-animation.js';
import {readMedicalFeedback,feedbackVision,convertedAI} from './medical-feedback.js';
export function moveCombatActor(actor,index,dt,speedMultiplier=1){
 const goal=COMBAT.route[index];if(!goal)return{index,arrived:true,velocity:new Vector3()};const delta=new Vector3(...goal).sub(new Vector3(...actor.at)),length=delta.length(),speed=COMBAT.walkSpeedMps*speedMultiplier,distance=Math.min(length,speed*dt),velocity=delta.clone().normalize().multiplyScalar(speed);
 if(length>1e-6){actor.at=new Vector3(...actor.at).addScaledVector(delta,distance/length).toArray();actor.yaw=Math.atan2(delta.x,delta.z);}
 return{index:length<=distance+1e-6?index+1:index,arrived:index>=COMBAT.route.length-1&&length<=distance+1e-6,velocity};
}
export function aimErrorDeg(medical,elapsed,behavior=null){
 const input=behavior?null:readMedicalFeedback(medical),b=behavior||convertedAI(input,feedbackVision(input,0));
 return b.aimFloorDeg+(b.aimStartDeg-b.aimFloorDeg)*Math.exp(-b.aimConvergencePerS*Math.max(0,elapsed));
}
export const COMBAT_RELOAD_S=FPS_HANDLING.ak74m.emptyReload.duration;
export function fireCombatActor({physics,actor,pose,shotId,random,errorDeg,time,velocity}){
 const ballistics=shotBallistics(COMBAT.ammoId,'ak74m'),spread=errorDeg*Math.PI/180,azimuth=random()*Math.PI*2,radius=Math.sqrt(random())*spread;
 const up=new Vector3(0,1,0),right=pose.direction.clone().cross(up).normalize(),direction=pose.direction.clone().applyAxisAngle(right,Math.sin(azimuth)*radius).applyAxisAngle(up,Math.cos(azimuth)*radius).normalize();
 const scope=shooterPhysics(physics,actor.id);if(scope.muzzleBlocked(pose.stockContact,pose.origin,pose.direction))return null;const trace=traceShot(scope,pose.origin,direction,ballistics,{shotId,simulateFlight:true,bodyModel:'s2'});
 return{shotId,time,ammoId:COMBAT.ammoId,ballistics,origin:pose.origin.clone(),breech:pose.breech.clone(),direction,rotation:pose.rotation.clone(),shooterVelocity:velocity.clone(),trace,hit:trace.hit};
}
