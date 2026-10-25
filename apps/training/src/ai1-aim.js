import {Vector3,Quaternion} from 'three';
import {AimState} from './aim.js';
import {AIM_DEFAULTS} from './settings.js';
import {FIRE_STYLES,wrap,clamp} from './ai1-config.js';
const gaussian=random=>Math.max(-3,Math.min(3,Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random())));
export function fittsTime(angle,width,skill){return(.10+.085*Math.log2(1+Math.abs(angle)/Math.max(.003,width)))/skill.turn;}
export class AI1Aim{
 constructor(random,skill,yaw=0){this.random=random;this.skill=skill;this.shared=new AimState({...AIM_DEFAULTS});this.shared.setWeapon('ak74m');this.yaw=yaw+Math.PI;this.pitch=-.3;this.yawVelocity=this.pitchVelocity=0;this.shared.intentYaw=this.shared.aimYaw=this.yaw;this.shared.intentPitch=this.shared.aimPitch=this.pitch;this.perception=new Vector3();this.suppression=0;this.errors={};}
 suppress(noise){if(noise.type==='crack')this.suppression=clamp(this.suppression+.65*(1-this.skill.suppressionResistance));}
 step(dt,{time,eye,muzzle=null,observation,style='ads',aiming=false,actorYaw=0,speed=0,crouched=false,supported=false,medicalFeedback=null,ballistics}){
  this.suppression*=Math.exp(-dt*1.3);
  let target=observation?.point?.clone()||null;const s=FIRE_STYLES[style];let uncertainty=0,leadM=0,mt=.3;
  if(target&&observation.part!=='noise'){
   const distance=target.distanceTo(eye);uncertainty=this.skill.perceptionM*(1+distance/20)*(1+(observation.motion||0)*.2)/Math.sqrt(Math.max(.1,observation.exposure??observation.confidence))*s.uncertainty*(1+this.suppression*3);
   if(this.sampleTime!==observation.time){this.sampleTime=observation.time;this.perception.set(gaussian(this.random)*uncertainty,gaussian(this.random)*uncertainty*.65,0);}
   target.add(this.perception);const lead=observation.velocity?.clone().multiplyScalar(distance/ballistics.muzzleVelocityMps*this.skill.lead)||new Vector3();leadM=lead.length();target.add(lead);
  }
  this.target=target;let targetYaw=actorYaw+Math.PI,targetPitch=-.45;
  if(target){const d=target.clone().sub(muzzle||eye);targetYaw=Math.atan2(-d.x,-d.z);targetPitch=Math.atan2(d.y,Math.hypot(d.x,d.z));mt=fittsTime(wrap(targetYaw-this.yaw),observation.angularWidthRad??.02,this.skill);}
  const omega=Math.min(22,4.6/Math.max(.15,mt)),damping=this.skill.overshoot;
  this.yawVelocity+=(omega**2*wrap(targetYaw-this.yaw)-2*damping*omega*this.yawVelocity)*dt;this.pitchVelocity+=(omega**2*(targetPitch-this.pitch)-2*damping*omega*this.pitchVelocity)*dt;
  this.yaw+=clamp(this.yawVelocity,-5,5)*dt;this.pitch=clamp(this.pitch+clamp(this.pitchVelocity,-4,4)*dt,-1.1,1.1);
  const a=this.shared;a.intentYaw=this.yaw;a.intentPitch=this.pitch;
  // Manual recovery uses the same player compensation interface and never
  // changes impulse magnitude, integration or projectile direction after firing.
  if(a.recoilState.sinceShot>.14){const gain=1-Math.exp(-dt*this.skill.recovery);a.recoilState.compensate(-a.recoilState.pitch*gain,'pitch');a.recoilState.compensate(-a.recoilState.yaw*gain,'yaw');}
  a.step(dt,{feet:new Vector3(),viewHeight:eye.y,time,speed,ads:aiming&&s.ads,reloading:false,blocked:false,crouched,swayMultiplier:(supported?.4:crouched?.7:1)*(1+this.suppression),medicalFeedback});
  this.rotation=a.quaternion.clone();this.errors={perceptionM:this.perception.length(),uncertaintyM:uncertainty,leadM,leadFraction:this.skill.lead,turnTimeS:mt,motorErrorDeg:Math.hypot(wrap(targetYaw-this.yaw),targetPitch-this.pitch)*180/Math.PI,swayDeg:Math.hypot(a.weaponYaw-a.aimYaw-a.recoilState.yaw,a.weaponPitch-a.aimPitch-a.recoilState.pitch)*180/Math.PI,recoilPitchRad:a.recoilState.pitch,suppression:this.suppression,medicalAngles:medicalFeedback?.angles||null,dispersion:'same as player: no separate 3D MOA draw'};return this.rotation;
 }
 onShot(ballistics,shotId,stance){return this.shared.onShot(ballistics,shotId,stance);}
 snapshot(){return{target:this.target?.toArray()||null,rotation:this.rotation?.toArray()||null,errors:{...this.errors},recoil:this.shared.recoilState.snapshot()};}
}
