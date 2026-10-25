import {relaxSoldierHands,prepareSoldierAKGrips} from './soldier-grip.js';
import {AnimationMixer,Quaternion,Vector3,Euler} from 'three';
import {actorRotation} from './human-targets.js';
import {solveArm,setWorldPosition} from './arm-ik.js';
const V=a=>new Vector3(...a),Q=()=>new Quaternion();
export const PLAYER_BODY_LAYER=4;
// Eye landmark is a geometric marker in the existing masked-face eye band.
export const SOLDIER_EYE_LOCAL=Object.freeze([0,.057,.065]);
export class CombatPose{
 constructor(rig,clips){this.rig=rig;this.mixer=new AnimationMixer(rig.root);this.actions=Object.fromEntries(clips.map(c=>[c.name,this.mixer.clipAction(c)]));this.rest=rig.bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));this.clip='standing';this.handErrors={};this.history=[];prepareSoldierAKGrips(rig);this.sample('crouch',0);this.crouchGoal=rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));this.mixer.stopAllAction();for(const {b,p,q}of this.rest){b.position.copy(p);b.quaternion.copy(q);}rig.root.updateMatrixWorld(true);this.clip='standing';}
 sample(name,time=0){
  this.mixer.stopAllAction();for(const {b,p,q}of this.rest){b.position.copy(p);b.quaternion.copy(q);b.scale.set(1,1,1);}
  this.clip=name;const a=this.actions[name];a.play();a.time=name==='walk'?time%a.getClip().duration:0;a.setEffectiveWeight(1);this.mixer.update(0);this.rig.root.updateMatrixWorld(true);
 }
 distributeAim(yaw,pitch){for(const[name,y,p]of [['pelvis',.1,0],['spine',.3,.35],['chest',.4,.4],['neck',.2,.25]])this.rig.byName.get(name).quaternion.premultiply(Q().setFromEuler(new Euler(-pitch*p,yaw*y,0,'YXZ')));this.rig.root.updateMatrixWorld(true);}
 eye(actor){return V(SOLDIER_EYE_LOCAL).applyMatrix4(this.rig.byName.get('head').matrixWorld).applyQuaternion(actorRotation(actor)).add(V(actor.at));}
 point(actor,name){return this.rig.byName.get(name).getWorldPosition(new Vector3()).applyQuaternion(actorRotation(actor)).add(V(actor.at));}
 arm(side,goal,pole,shoulder=null,orientation=null){
  const s=side==='L'?'left':'right',r=this.rig,upper=r.byName.get(s+'UpperArm'),fore=r.byName.get(s+'Forearm'),hand=r.byName.get(s+'Hand');
  if(shoulder)setWorldPosition(upper,shoulder);
  const before=upper.getWorldPosition(new Vector3()),length=before.distanceTo(fore.getWorldPosition(new Vector3()))+fore.getWorldPosition(new Vector3()).distanceTo(hand.getWorldPosition(new Vector3())),distance=before.distanceTo(goal);
  // Native FPS shoulders use a slightly different segment length. Shift the
  // proximal adapter only when necessary; never move the requested wrist.
  const correction=Math.max(0,distance-length+.002);if(correction)setWorldPosition(upper,before.addScaledVector(goal.clone().sub(before).normalize(),correction));
  solveArm(upper,fore,hand,goal,pole);
  if(orientation)hand.quaternion.copy(hand.parent.getWorldQuaternion(Q()).invert().multiply(orientation));
  r.root.updateMatrixWorld(true);this.handErrors[side]={distanceM:hand.getWorldPosition(new Vector3()).distanceTo(goal),proximalCorrectionM:correction};
 }
 player({actor,feet,camera,aim,lean,handRows,time,crouched=false,locomotion=null}){
  actor.at=feet.toArray();actor.yaw=aim.viewYaw+Math.PI;const rotation=actorRotation(actor),inverse=rotation.clone().invert();
  if(locomotion){this.clip=locomotion.pose.clip;this.rig.root.position.copy(locomotion.rig.root.position);for(let i=0;i<this.rig.bones.length;i++){this.rig.bones[i].position.copy(locomotion.rig.bones[i].position);this.rig.bones[i].quaternion.copy(locomotion.rig.bones[i].quaternion);this.rig.bones[i].scale.set(1,1,1);}this.rig.root.updateMatrixWorld(true);}else this.sample(crouched?'crouch':aim.ads>.5?'aim':'standing',time);
  this.distributeAim(0,aim.viewPitch);
  const localLean=inverse.clone().multiply(lean.rotation).multiply(rotation);this.rig.byName.get('pelvis').quaternion.premultiply(localLean);this.rig.root.updateMatrixWorld(true);
  const goal=camera.position.clone().sub(feet).applyQuaternion(inverse),eye=V(SOLDIER_EYE_LOCAL).applyMatrix4(this.rig.byName.get('head').matrixWorld);
  this.rig.root.position.add(goal.clone().sub(eye));this.rig.root.updateMatrixWorld(true);
  // The FPS eye height is lower than this 1.8m source soldier. Fit the
  // pelvis only when a moving ankle exceeds anatomical reach, then solve the
  // spine/chest chain back to the fixed eye. Never scale or stretch a limb.
  if(locomotion){
   const pelvis=this.rig.byName.get('pelvis'),head=this.rig.byName.get('head'),headQ=head.getWorldQuaternion(Q()),headGoal=goal.clone().sub(V(SOLDIER_EYE_LOCAL).applyQuaternion(headQ));let fitted=false;
   for(let i=0;i<24;i++){let correction=0;for(const side of['left','right']){const upper=this.rig.byName.get(side+'UpperLeg'),lower=this.rig.byName.get(side+'LowerLeg'),foot=this.rig.byName.get(side+'Foot'),start=upper.getWorldPosition(new Vector3()),end=foot.getWorldPosition(new Vector3()),length=start.distanceTo(lower.getWorldPosition(new Vector3()))+lower.getWorldPosition(new Vector3()).distanceTo(end),target=locomotion.rig.byName.get(side+'Foot').getWorldPosition(new Vector3()),delta=target.clone().sub(start),distance=delta.length();if(distance>length*.985){correction=Math.max(correction,distance-length*.985);setWorldPosition(pelvis,pelvis.getWorldPosition(new Vector3()).addScaledVector(delta,(distance-length*.985)/distance));fitted=true;}}
    const spine=this.rig.byName.get('spine'),chest=this.rig.byName.get('chest'),start=spine.getWorldPosition(new Vector3()),middle=chest.getWorldPosition(new Vector3()),reach=start.distanceTo(middle)+middle.distanceTo(head.getWorldPosition(new Vector3())),delta=headGoal.clone().sub(start),distance=delta.length();if(distance>reach*.985){correction=Math.max(correction,distance-reach*.985);setWorldPosition(pelvis,pelvis.getWorldPosition(new Vector3()).addScaledVector(delta,(distance-reach*.985)/distance));fitted=true;}if(correction<1e-6)break;
   }
   if(fitted){const spine=this.rig.byName.get('spine'),chest=this.rig.byName.get('chest');this.headFit=solveArm(spine,chest,head,headGoal,chest.getWorldPosition(new Vector3()).add(new Vector3(0,0,.3)));head.quaternion.copy(head.parent.getWorldQuaternion(Q()).invert().multiply(headQ));this.rig.root.updateMatrixWorld(true);}
  }
  // Pin the original ankle landmarks at the floor while the torso leans.
  for(const side of ['left','right']){const rest=this.rest.find(x=>x.b.name===side+'Foot');const baseline=side==='left'?[.183,.17,-.015]:[-.183,.17,-.015];
   const source=locomotion?.rig,goal=source?source.byName.get(side+'Foot').getWorldPosition(new Vector3()):V(baseline),pole=source?source.byName.get(side+'LowerLeg').getWorldPosition(new Vector3()):V([side==='left'?.25:-.25,.45,.65]);
   const leg=solveArm(this.rig.byName.get(side+'UpperLeg'),this.rig.byName.get(side+'LowerLeg'),rest.b,goal,pole);this.legErrors??={};this.legErrors[side]={...leg,goal:goal.toArray(),errorM:rest.b.getWorldPosition(new Vector3()).distanceTo(goal)};if(source)rest.b.quaternion.copy(rest.b.parent.getWorldQuaternion(Q()).invert().multiply(source.byName.get(side+'Foot').getWorldQuaternion(Q())));}
  for(const row of handRows){const toLocal=p=>p.clone().sub(feet).applyQuaternion(inverse),goal=toLocal(row.hand.getWorldPosition(new Vector3())),shoulder=toLocal(row.upper.getWorldPosition(new Vector3())),pole=toLocal(row.fore.getWorldPosition(new Vector3()));
   const orientation=inverse.clone().multiply(row.hand.getWorldQuaternion(Q()));this.arm(row.side,goal,pole,null,orientation);}
  relaxSoldierHands(this.rig);this.rig.root.updateMatrixWorld(true);this.rig.skeleton.update();this.eyeErrorM=this.eye(actor).distanceTo(camera.position);this.remember(actor,time);
 }
 remember(actor,time){
  if(this.history.at(-1)?.time===time)return;
  this.history.push({time,bones:this.rig.bones.map(b=>({name:b.name,p:this.point(actor,b.name),q:actorRotation(actor).multiply(b.getWorldQuaternion(Q()))}))});if(this.history.length>2)this.history.shift();
 }
 velocities(){const [a,b]=this.history;if(!a||!b||b.time<=a.time)return new Map();const dt=b.time-a.time;return new Map(b.bones.map((row,i)=>{const prior=a.bones[i],dq=row.q.clone().multiply(prior.q.clone().invert()).normalize();if(dq.w<0)dq.set(-dq.x,-dq.y,-dq.z,-dq.w);const angle=2*Math.acos(Math.min(1,dq.w)),s=Math.sqrt(Math.max(0,1-dq.w*dq.w)),omega=s>1e-7?new Vector3(dq.x,dq.y,dq.z).multiplyScalar(angle/(s*dt)):new Vector3();return[row.name,{linear:row.p.clone().sub(prior.p).divideScalar(dt),angular:omega}];}));}
 releaseGrip(){relaxSoldierHands(this.rig);this.fingersFixed=true;this.fingerGrip=null;}
 snapshot(){return{fingerGrip:this.fingerGrip??null,fingersFixed:this.fingersFixed??false,clip:this.clip,eyeErrorM:this.eyeErrorM??null,handErrors:structuredClone(this.handErrors),legErrors:structuredClone(this.legErrors||{}),rootOffset:this.rig.root.position.toArray(),historyTicks:this.history.length};}
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.rig.root);}
}
