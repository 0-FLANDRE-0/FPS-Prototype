import{Vector3,Quaternion,Euler}from'three';
import{createSoldierRig}from'./soldier-rig.js';
import{EnemyCombatPose}from'./enemy-combat-pose.js';
import{ENEMY_ANIMATIONS}from'./generated/enemy-animations.js';
import{FootContactTracker}from'./foot-contact.js';
import{gaitClipRate}from'./gait.js';
import data from'../assets/sounds/prepared/locomotion.json' with{type:'json'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
import{LOCOMOTION}from'./locomotion-tuning.js';
export{LOCOMOTION}from'./locomotion-tuning.js';
export class PlayerLocomotion{
 constructor(nativeClips){this.rig=createSoldierRig();this.pose=new EnemyCombatPose(this.rig,nativeClips,ENEMY_ANIMATIONS);this.contact=new FootContactTracker();this.actor={id:'P01',at:[0,0,0],yaw:Math.PI};this.pose.movementBlend=(speed,angle,crouched)=>this.blend(speed,angle,crouched);this.reset();}
 reset(){this.pose.sample('standing',0);this.rig.root.position.set(0,0,0);this.contact.reset();this.phase=0;this.priorPhase=null;this.frame={phaseRad:0,weight:0,position:new Vector3(),rotation:new Euler(),contacts:[]};}
 blend(speed,angle,crouched){
  const family=crouched?'walk crouching':this.sprinting?'run':'walk',rows=this.pose.directionClips(family).sort((a,b)=>Math.abs(wrap(a.angle-angle))-Math.abs(wrap(b.angle-angle))),a=rows[0],b=rows[1]||a,da=Math.abs(wrap(a.angle-angle)),db=Math.abs(wrap(b.angle-angle)),weight=da<1e-6?1:db/(da+db);this.pose.movement.family=family;
  return[a,b].map((row,i)=>({name:row.clip.name,weight:i?1-weight:weight,rate:gaitClipRate(row.clip,family,speed)})).filter(s=>s.weight>1e-6);
 }
 step({dt,time,feet,velocity,yaw,crouched,sprinting,ads,grounded,physics,deferContacts=false,gaitImpairment=null}){
  this.actor.at=feet.toArray();this.actor.yaw=yaw+Math.PI;this.sprinting=sprinting;const speed=Math.hypot(velocity.x,velocity.z),moving=speed>.08;
  this.pose.updateFrame({dt,time,actor:this.actor,velocity,intent:{move:moving,aim:ads,crouch:crouched,state:moving?'enter':'aim'},crouched,gaitImpairment});
  const states=[...this.pose.clipStates.values()],dominant=states.filter(s=>/^(walk|run) /.test(s.name)).sort((a,b)=>b.weight-a.weight)[0];
  if(dominant){const phase=(dominant.phaseS/this.pose.pack.clips.get(dominant.name).duration)%1;if(this.priorPhase!=null)this.phase+=wrap((phase-this.priorPhase)*Math.PI*2);else this.phase=phase*Math.PI*2;this.priorPhase=phase;}
  const reference=new Vector3(),q=new Quaternion(0,0,0,0);let total=0;
  for(const s of states){const r=data.clips[s.name];if(!r||s.weight<1e-6)continue;reference.addScaledVector(new Vector3(...r.meanHead),s.weight);const a=r.meanChestQuaternion;q.set(q.x+a[0]*s.weight,q.y+a[1]*s.weight,q.z+a[2]*s.weight,q.w+a[3]*s.weight);total+=s.weight;}
  if(total)reference.divideScalar(total);else reference.copy(this.rig.byName.get('head').getWorldPosition(new Vector3()));
  const position=this.rig.byName.get('head').getWorldPosition(new Vector3()).sub(reference),rotation=new Euler().setFromQuaternion(q.lengthSq()>1e-8?q.normalize().invert().multiply(this.rig.byName.get('chest').getWorldQuaternion(new Quaternion())):new Quaternion(),'YXZ');
  // Convert the model's forward +Z to the FPS camera's forward -Z.
  position.x=-position.x;position.z=-position.z;rotation.x=-rotation.x;rotation.z=-rotation.z;
  for(const key of['x','y','z']){position[key]=clamp(position[key],-LOCOMOTION.translationLimitM,LOCOMOTION.translationLimitM);rotation[key]=clamp(rotation[key],-LOCOMOTION.rotationLimitRad,LOCOMOTION.rotationLimitRad);}
  const weight=1-Math.exp(-speed/1.5),contacts=deferContacts?[]:this.contact.sample({rig:this.rig,actor:this.actor,physics,time,moving,grounded,velocity});
  this.frame={phaseRad:this.phase,weight,position,rotation,contacts,grounded,speed,sprinting,crouched};this.contactInput={physics,time,moving,grounded,velocity};return this.frame;
 }
 sampleContacts(yaw){this.actor.yaw=yaw+Math.PI;this.frame.contacts=this.contact.sample({rig:this.rig,actor:this.actor,...this.contactInput});return this.frame.contacts;}
 snapshot(){return{source:'Mixamo soldier full-body FK',phaseRad:this.phase,clipStates:[...this.pose.clipStates.values()].map(s=>({...s})),motion:{position:this.frame.position.toArray(),rotation:[this.frame.rotation.x,this.frame.rotation.y,this.frame.rotation.z],weight:this.frame.weight},contacts:this.contact.snapshot()};}
 dispose(){this.pose.dispose();this.rig.dispose();}
}
