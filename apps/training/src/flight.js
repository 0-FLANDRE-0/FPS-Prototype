import {SCAR_DATA} from './scar-data.js';
import {g7DecelerationMps2} from './g7-drag.js';
import {Vector3} from 'three';
import {CATALOG} from './catalog.js';
import {getVelocityDragClass} from './generated/legacy-flight.js';
import {RETENTION_BY_CALIBER} from './generated/flight-tuning.js';
// Spatial simulation controls; retention values themselves come from original CQB.
export const FLIGHT_RULE_ID='cqb-retention-quadratic-gravity-v1';
export const FLIGHT_LIMITS=Object.freeze({gravity:9.81,maxStepS:1/120,maxChordM:4,maxSteps:2048,maxTimeS:12,maxDistanceM:620});
export function flightProfile(ammo,{gravity=FLIGHT_LIMITS.gravity,drag=true,retentionByCaliber=RETENTION_BY_CALIBER}={}){
 const dragClass=getVelocityDragClass(ammo),legacyRetention=CATALOG.DRAG_RETENTION_PER_100M[dragClass]||.93;
 const is556=/^5\.56[×x]45(?:mm)?$/i.test(ammo?.caliber||'');
 // Preserve the existing class ratios, while leaving every legacy declaration
 // and non-5.56 retention values identical. W1 adds G7 only for M80/M993.
 // An empty retention map selects the original 5.56 retention for QA.
 const retentionPer100M=is556&&retentionByCaliber['5.56x45mm']!=null
   ?retentionByCaliber['5.56x45mm']*legacyRetention/CATALOG.DRAG_RETENTION_PER_100M.rifle_light:legacyRetention;
 return {...(SCAR_DATA.g7BC[ammo?.id]&&drag?{g7BC:SCAR_DATA.g7BC[ammo.id]}:{}),dragClass,retentionPer100M,gravity,dragK:drag?-Math.log(retentionPer100M)/100:0};
}
// RK4 for dx/dt=v, dv/dt=g-k|v|v. In zero gravity this reproduces
// original v(distance)=v0*retention^(distance/100), without applying it twice.
export function advanceFlight(position,velocity,dt,profile){
 const a=v=>profile.g7BC?v.clone().multiplyScalar(-g7DecelerationMps2(v.length(),profile.g7BC)/Math.max(1e-12,v.length())).add(new Vector3(0,-profile.gravity,0)):v.clone().multiplyScalar(-profile.dragK*v.length()).add(new Vector3(0,-profile.gravity,0));
 const a1=a(velocity),v2=velocity.clone().addScaledVector(a1,dt/2),a2=a(v2),v3=velocity.clone().addScaledVector(a2,dt/2),a3=a(v3),v4=velocity.clone().addScaledVector(a3,dt),a4=a(v4);
 return {position:position.clone().addScaledVector(velocity,dt/6).addScaledVector(v2,dt/3).addScaledVector(v3,dt/3).addScaledVector(v4,dt/6),velocity:velocity.clone().addScaledVector(a1,dt/6).addScaledVector(a2,dt/3).addScaledVector(a3,dt/3).addScaledVector(a4,dt/6)};
}
export function flightChord(position,direction,speed,remaining,profile){
 const cap=Math.min(FLIGHT_LIMITS.maxChordM,remaining),velocity=direction.clone().multiplyScalar(speed);
 let dt=Math.min(FLIGHT_LIMITS.maxStepS,cap/Math.max(1,speed)),next,delta;
 for(let i=0;i<6;i++){
  next=advanceFlight(position,velocity,dt,profile);delta=next.position.clone().sub(position);
  if(delta.length()<=cap&&remaining>=FLIGHT_LIMITS.maxChordM||Math.abs(delta.length()-cap)<1e-10||dt===FLIGHT_LIMITS.maxStepS&&delta.length()<cap)break;
  dt=Math.min(FLIGHT_LIMITS.maxStepS,dt*cap/Math.max(1e-12,delta.length()));
 }
 // Re-evaluate after the last time adjustment; clipping position alone would
 // violate the vacuum gravity/time relation at the distance limit.
 next=advanceFlight(position,velocity,dt,profile);delta=next.position.clone().sub(position);
 return {...next,dt,initialVelocity:velocity,direction:delta.clone().normalize(),length:delta.length(),end:next.position};
}
