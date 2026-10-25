import {Quaternion,Vector3} from 'three';
// All values below are game tuning. No manufacturer/clinical motion source.
export const LEAN=Object.freeze({pivotStandM:1,headTravelStandM:.25,rollRad:12*Math.PI/180,response:Math.log(10)/.25,
 headRadiusM:.12,clearanceM:.02,muzzleRadiusM:.03,speedMultiplier:.6,swayMultiplier:1.2});
export class LeanIntent{
 constructor(){this.mode='hold';this.clear();}
 clear(){this.held=new Map();this.toggled=0;}
 setMode(mode){const next=mode==='toggle'?'toggle':'hold';if(next!==this.mode){this.clear();this.mode=next;}}
 press(owner,side){if(this.held.has(owner))return;this.held.set(owner,side);if(this.mode==='toggle')this.toggled=this.toggled===side?0:side;}
 release(owner){this.held.delete(owner);}
 get requested(){return this.mode==='toggle'?this.toggled:([...this.held.values()].at(-1)||0);}
}
export function leanPose(value,viewHeight,yaw){
 const ratio=viewHeight/1.43,rollRad=-value*LEAN.rollRad,pivotM=LEAN.pivotStandM*ratio;
 const headOffset=new Vector3(value*LEAN.headTravelStandM*ratio,(viewHeight-pivotM)*(Math.cos(rollRad)-1),0)
   .applyAxisAngle(new Vector3(0,1,0),yaw);
 const yawRotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
 const rotation=yawRotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),rollRad)).multiply(yawRotation.clone().invert());
 return {value,headOffset,rotation,rollRad,pivotM};
}
export function leanPoint(point,eye,pose){return point.clone().sub(eye).applyQuaternion(pose.rotation).add(eye).add(pose.headOffset);}
export class LeanState{
 constructor(){this.reset();}
 reset(){this.value=this.previous=this.requested=0;this.pose=leanPose(0,1.43,0);this.collision={headRequestedM:0,headHitDistanceM:null,headAllowedM:0,limitedDistanceM:0,muzzleHitDistanceM:null,muzzleRecessM:0,headHitId:null,muzzleHitId:null};}
 step(dt,{requested=0,sprint=false,viewHeight,yaw,physics,aim}){
  this.previous=this.value;this.requested=sprint?0:Math.max(-1,Math.min(1,requested));
  let desired=sprint?0:this.value+(this.requested-this.value)*(1-Math.exp(-LEAN.response*dt));
  if(Math.abs(desired)<1e-6)desired=0;
  const probe=desired===0?0:Math.sign(desired)*(Math.abs(this.requested)||Math.abs(desired));
  const wanted=leanPose(probe,viewHeight,yaw);
  const c={headRequestedM:wanted.headOffset.length(),headHitDistanceM:null,headAllowedM:wanted.headOffset.length(),limitedDistanceM:0,muzzleHitDistanceM:null,muzzleRecessM:0,headHitId:null,muzzleHitId:null};
  let value=probe;
  // Recast after reductions because the vertical head arc is nonlinear.
  // Collision restrictions apply immediately, never eased through.
  for(let i=0;i<8&&value!==0;i++){
   const p=leanPose(value,viewHeight,yaw),head=aim.eye.clone().add(p.headOffset);
   const h=physics.sweepSphere(aim.eye,head,LEAN.headRadiusM);
   let fraction=1;
   if(h){
    const allowed=Math.max(0,h.distance-LEAN.clearanceM);fraction=Math.min(fraction,allowed/Math.max(1e-12,p.headOffset.length()));
    c.headHitDistanceM=h.distance;c.headAllowedM=allowed;c.headHitId=h.id;
   }
   if(fraction>=1)break;value*=Math.max(0,Math.min(1,fraction));if(Math.abs(value)<1e-6)value=0;
  }
  c.limitedDistanceM=Math.max(0,c.headRequestedM-leanPose(value,viewHeight,yaw).headOffset.length());
  value=Math.sign(desired)*Math.min(Math.abs(desired),Math.abs(value));
  this.value=value;this.pose=leanPose(value,viewHeight,yaw);this.collision=c;
  if(c.limitedDistanceM>0&&Math.sign(this.previous)===Math.sign(value)&&Math.abs(this.previous)>Math.abs(value))this.previous=value;
  if(sprint)this.previous=0;
 }
 restrictWeapon(physics,aim){
  // A blocked neutral muzzle may already be beyond legacy cover. Sweep from
  // the safe leaned shoulder, rather than locking head movement at that muzzle.
  // Retract the weapon until its final muzzle stays on the player's side.
  const start=aim.eye.clone().add(new Vector3(0,-.07,0).applyQuaternion(this.pose.rotation)),delta=aim.muzzle.clone().sub(start),length=delta.length();
  const hit=physics.sweepSphere(start,aim.muzzle,LEAN.muzzleRadiusM);this.collision.muzzleRecessM=0;
  if(!hit)return false;
  const allowed=Math.max(0,hit.distance-LEAN.clearanceM),recess=Math.max(0,length-allowed);
  aim.translateWeapon(delta.normalize().multiplyScalar(-recess),this.pose);
  this.collision.muzzleHitDistanceM=hit.distance;this.collision.muzzleHitId=hit.id;this.collision.muzzleRecessM=recess;return recess>0;
 }
 renderPose(alpha,viewHeight,yaw){return leanPose(this.previous+(this.value-this.previous)*alpha,viewHeight,yaw);}
 snapshot(){return {lean:this.value,requested:this.requested,headOffset:this.pose.headOffset.toArray(),rollRad:this.pose.rollRad,rollDeg:this.pose.rollRad*180/Math.PI,pivotHeightM:this.pose.pivotM,collision:{...this.collision},playerHitVolumes:false};}
}
