import {AnimationClip,Quaternion,Vector3} from 'three';
import {CombatPose} from './combat-pose.js';
import {actorRotation} from './human-targets.js';
import {reachableHandGoal,solveArm} from './arm-ik.js';
import {FPS_HANDLING} from './handling-animation.js';
import {GAIT,gaitClipRate} from './gait.js';

// Source motion is Mixamo; transition/rate/aim blending are game tuning.
export const ENEMY_ANIMATION_TUNING=Object.freeze({transitionS:.20,gait:GAIT,movingThresholdMps:.08,turnThresholdRadps:.6,fireOverlayWeight:1});
const preparedPacks=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),Q=()=>new Quaternion();
const upperBone=name=>/^(spine|chest|neck|head|leftClavicle|rightClavicle|leftUpperArm|rightUpperArm|leftForearm|rightForearm|leftHand|rightHand)$/.test(name);
const directions={forward:0,'forward left':Math.PI/4,left:Math.PI/2,'backward left':Math.PI*3/4,backward:Math.PI,'backward right':-Math.PI*3/4,right:-Math.PI/2,'forward right':-Math.PI/4};
function preparePack(data){
 if(preparedPacks.has(data.clips))return preparedPacks.get(data.clips);
 const clips=new Map(),metadata=data.metadata||data.meta||{};
 for(const input of data.clips){const clip=input instanceof AnimationClip?input:AnimationClip.parse(input),tracks=clip.tracks.map(t=>{const at=t.name.lastIndexOf('.');return{bone:t.name.slice(0,at),property:t.name.slice(at+1),interpolant:t.createInterpolant()};});clips.set(clip.name,{name:clip.name,duration:clip.duration,tracks,metadata:metadata[clip.name]||{}});}
 const pack={clips,metadata};preparedPacks.set(data.clips,pack);return pack;
}
function poseRows(rest){return rest.map(({p,q})=>({p:p.clone(),q:q.clone()}));}
function copyRows(source,target){for(let i=0;i<target.length;i++){target[i].p.copy(source[i].p);target[i].q.copy(source[i].q);}return target;}
function writeRows(rows,rig){for(let i=0;i<rig.bones.length;i++){rig.bones[i].position.copy(rows[i].p);rig.bones[i].quaternion.copy(rows[i].q);rig.bones[i].scale.set(1,1,1);}rig.root.updateMatrixWorld(true);}
function evaluateClip(clip,time,rest,index,result){
 copyRows(rest,result);const loop=clip.metadata.loop!==false,phase=loop?((time%clip.duration)+clip.duration)%clip.duration:clamp(time,0,clip.duration);
 for(const t of clip.tracks){const i=index.get(t.bone);if(i==null||i>=24)continue;const a=t.interpolant.evaluate(phase);if(t.property==='quaternion')result[i].q.fromArray(a).normalize();else if(t.property==='position')result[i].p.fromArray(a);}
 if(clip.metadata.rootYawDeltaRad&&/turn 90/.test(clip.name)){const i=index.get('pelvis');if(i!=null)result[i].q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-clip.metadata.rootYawDeltaRad*clamp(phase/clip.duration,0,1)));}
 return result;
}
function rawBlend(pack,states,rest,index,result,scratch){
 copyRows(rest,result);let total=0;
 for(const s of states){if(s.weight<1e-7)continue;const clip=pack.clips.get(s.name);if(!clip)continue;evaluateClip(clip,s.phaseS,rest,index,scratch);const weight=s.weight/(total+s.weight);
  for(let i=0;i<24;i++){if(total===0){result[i].p.copy(scratch[i].p);result[i].q.copy(scratch[i].q);}else{result[i].p.lerp(scratch[i].p,weight);result[i].q.slerp(scratch[i].q,weight);}}total+=s.weight;
 }
 return result;
}
export class EnemyCombatPose extends CombatPose{
 constructor(rig,nativeClips,{clips,metadata,meta}={}){
  super(rig,nativeClips);if(!clips?.length)throw new Error('Preconverted enemy animation clips are missing');
  this.enemyAnimation=true;this.pack=preparePack({clips,metadata:metadata||meta});this.index=new Map(rig.bones.map((b,i)=>[b.name,i]));this.rawPose=poseRows(this.rest);this.scratchPose=poseRows(this.rest);this.clipStates=new Map();this.time=0;this.lastFrameTime=null;this.movement={moving:false,speedMps:0,localAngleRad:0,family:null};this.reload={active:false,leftIKReleased:false};this.lastFireTime=-Infinity;this.firing=false;this.lastYaw=null;this.sample('standing',0);
 }
 hasClip(name){return this.pack.clips.has(name);}
 referenceBoneQuaternion(clipName,boneName){const saved=this.rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),rows=poseRows(this.rest);evaluateClip(this.pack.clips.get(this.canonical(clipName)),0,this.rest,this.index,rows);writeRows(rows,this.rig);const result=this.rig.byName.get(boneName).getWorldQuaternion(Q());writeRows(saved,this.rig);return result;}
 canonical(name){const aliases={standing:'idle',aim:'idle aiming',crouch:'idle crouching',walk:'walk forward'};return this.hasClip(aliases[name]||name)?aliases[name]||name:this.hasClip('idle')?'idle':this.pack.clips.keys().next().value;}
 sample(name,time=0){
  // CombatPose's constructor samples its native crouch before the enemy pack is
  // installed. The player locomotion sampler also reuses this motion pack.
  if(!this.pack)return super.sample(name,time);
  const canonical=this.canonical(name),moving=/^(walk|run|sprint) /.test(canonical),clip=this.pack.clips.get(canonical),speed=moving?1.4:0,rate=moving?gaitClipRate(clip,canonical.startsWith('walk crouching')?'walk crouching':canonical.startsWith('walk')?'walk':'run',speed):1;
  this.clipStates.clear();this.clipStates.set(canonical,{name:canonical,weight:1,phaseS:time,rate,sourceSpeedMps:clip.metadata.sourceSpeedMps??null});this.clip=['standing','aim','crouch','walk'].includes(name)?name:moving?'walk':name;this.time=time;this.lastFrameTime=null;this.movement={moving,speedMps:speed,localAngleRad:clip.metadata.movementAngleRad??0,family:moving?canonical.startsWith('walk crouching')?'walk crouching':canonical.split(' ')[0]:null};this.reload={active:/^reload_/.test(canonical),leftIKReleased:/^reload_/.test(canonical),clip:/^reload_/.test(canonical)?canonical:null,elapsedS:time,durationS:clip.duration,startS:time,manualSample:true};this.evaluate();return this;
 }
 directionClips(family){return [...this.pack.clips.values()].filter(c=>c.name.startsWith(family+' ')&&Object.hasOwn(directions,c.name.slice(family.length+1))).map(c=>({clip:c,angle:c.metadata.movementAngleRad??directions[c.name.slice(family.length+1)]}));}
 movementBlend(speed,angle,crouched){
  const family=crouched?'walk crouching':speed>=GAIT.runThresholdMps?'run':'walk';
  const rows=this.directionClips(family).sort((a,b)=>Math.abs(wrap(a.angle-angle))-Math.abs(wrap(b.angle-angle)));if(!rows.length)return[{name:this.canonical('walk'),weight:1,rate:1}];
  const a=rows[0],b=rows[1]||a,da=Math.abs(wrap(a.angle-angle)),db=Math.abs(wrap(b.angle-angle)),wa=da<1e-6||a===b?1:db/(da+db),result=[{name:a.clip.name,weight:wa,rate:gaitClipRate(a.clip,family,speed)}];
  if(wa<1)result.push({name:b.clip.name,weight:1-wa,rate:gaitClipRate(b.clip,family,speed)});this.movement.family=family;return result;
 }
 updateFrame({dt=1/60,time=this.time+dt,actor={yaw:0},velocity=new Vector3(),intent={},walkSeconds,rounds=30,reloadDurationS,crouched:frameCrouched=false,gaitImpairment=null}={}){
  this.time=time;const local=velocity.clone().applyQuaternion(actorRotation(actor).invert()),speed=Math.hypot(local.x,local.z),moving=!!intent.move&&speed>ENEMY_ANIMATION_TUNING.movingThresholdMps,crouched=!!(intent.crouch||intent.crouched||frameCrouched),angle=Math.atan2(local.x,local.z),reloading=intent.state==='reload',previousReload=this.reload.active;
  this.movement={...this.movement,moving,speedMps:speed,localAngleRad:angle};let desired;
  if(reloading){if(!previousReload||this.reload.manualSample)this.reload={active:true,leftIKReleased:true,clip:crouched?'reload_kneel':'reload_stand',startS:time,elapsedS:0,durationS:reloadDurationS??(rounds?FPS_HANDLING.ak74m.reload.duration:FPS_HANDLING.ak74m.emptyReload.duration)};if(intent.reloadProgress!=null)this.reload.durationS=reloadDurationS;this.reload.elapsedS=intent.reloadProgress!=null?intent.reloadProgress*this.reload.durationS:Math.max(0,time-this.reload.startS);const name=this.canonical(this.reload.clip),clip=this.pack.clips.get(name);desired=[{name,weight:1,rate:clip.duration/this.reload.durationS,phaseS:this.reload.elapsedS*clip.duration/this.reload.durationS}];}
  else{
   this.reload={active:false,leftIKReleased:false};const yawRate=this.lastYaw==null?0:wrap(actor.yaw-this.lastYaw)/Math.max(1e-6,dt),turnName=(crouched?'crouching ':'')+'turn 90 '+(yawRate<0?'left':'right');
   if(moving)desired=this.movementBlend(speed,angle,crouched);
   else if(Math.abs(yawRate)>.6&&intent.state!=='fire'&&this.hasClip(turnName))desired=[{name:turnName,weight:1,rate:1}];
   else desired=[{name:this.canonical(crouched?(intent.aim?'idle crouching aiming':'idle crouching'):intent.aim?'idle aiming':'idle'),weight:1,rate:1}];
  }
  const targetKey=desired.map(s=>s.name).sort().join('|'),changed=targetKey!==this.blendTargetKey;this.blendTargetKey=targetKey;
  if(changed){this.transitionStart=new Map([...this.clipStates].map(([n,s])=>[n,s.weight]));this.transitionElapsedS=0;}
  this.transitionElapsedS=Math.min(ENEMY_ANIMATION_TUNING.transitionS,(this.transitionElapsedS??ENEMY_ANIMATION_TUNING.transitionS)+dt);const blend=this.transitionElapsedS/ENEMY_ANIMATION_TUNING.transitionS;
  const outgoingMovement=[...this.clipStates.values()].filter(s=>/^(walk|run|sprint) /.test(s.name)).sort((a,b)=>b.weight-a.weight)[0],cyclePhase=outgoingMovement?((outgoingMovement.phaseS/this.pack.clips.get(outgoingMovement.name).duration)%1+1)%1:null;
  for(const d of desired){let state=this.clipStates.get(d.name);if(!state){const duration=this.pack.clips.get(d.name).duration,phaseS=d.phaseS??(moving&&cyclePhase!=null?cyclePhase*duration:moving&&walkSeconds!=null?Math.max(0,walkSeconds-dt)*d.rate:0);state={...d,weight:0,phaseS};this.clipStates.set(d.name,state);}state.rate=d.rate;state.sourceSpeedMps=this.pack.clips.get(d.name).metadata.sourceSpeedMps??null;if(d.phaseS!=null)state.phaseS=d.phaseS;}
  for(const [name,s]of this.clipStates){const d=desired.find(x=>x.name===name),start=this.transitionStart?.get(name)??(changed?0:s.weight),goal=d?.weight||0;s.weight=blend>=1?goal:start+(goal-start)*blend;if(d?.phaseS==null){const asymmetry=gaitImpairment?(gaitImpairment.left-gaitImpairment.right)*.25:0,limp=moving&&asymmetry?1+asymmetry*Math.sin(s.phaseS/this.pack.clips.get(name).duration*Math.PI*2):1;s.phaseS+=dt*s.rate*limp;}if(s.weight<1e-7&&!d)this.clipStates.delete(name);}
  this.lastYaw=actor.yaw;this.clip=moving?'walk':crouched?'crouch':intent.aim?'aim':'standing';this.lastFrameTime=time;this.evaluate();return this;
 }
 sampleState(state,options={}){
  if(this.hasClip(state)&&!['idle','idle aiming','idle crouching','idle crouching aiming'].includes(state))return this.sample(state,options.time||0);
  const intent={state:state==='reload'?'reload':state==='fire'?'fire':state==='walk'?'enter':'aim',move:state==='walk',aim:['aim','fire','idle aiming','idle crouching aiming'].includes(state),crouch:/crouch/.test(state),...options.intent};
  return this.updateFrame({...options,intent});
 }
 evaluate(){
  rawBlend(this.pack,[...this.clipStates.values()],this.rest,this.index,this.rawPose,this.scratchPose);
  const fire=this.pack.clips.get('fire_single_stand'),age=this.time-this.lastFireTime;
  if(fire&&age>=0&&age<fire.duration){const base=poseRows(this.rest);evaluateClip(fire,0,this.rest,this.index,base);evaluateClip(fire,age,this.rest,this.index,this.scratchPose);const envelope=Math.sin(Math.PI*age/fire.duration)*ENEMY_ANIMATION_TUNING.fireOverlayWeight;
   for(let i=0;i<24;i++)if(upperBone(this.rig.bones[i].name)){const delta=base[i].q.clone().invert().multiply(this.scratchPose[i].q);this.rawPose[i].q.multiply(Q().slerp(delta,envelope));}
  }
  writeRows(this.rawPose,this.rig);this.rig.skeleton.update();
 }
 notifyFire(time){this.lastFireTime=time;this.firing=true;}
 arm(side,goal,pole,shoulder=null,orientation=null){const prefix=side==='L'?'left':'right',upper=this.rig.byName.get(prefix+'UpperArm'),fore=this.rig.byName.get(prefix+'Forearm'),hand=this.rig.byName.get(prefix+'Hand'),reachable=reachableHandGoal(upper,fore,hand,goal);solveArm(upper,fore,hand,reachable,pole);if(orientation)hand.quaternion.copy(hand.parent.getWorldQuaternion(Q()).invert().multiply(orientation));this.rig.root.updateMatrixWorld(true);this.handErrors[side]={distanceM:hand.getWorldPosition(new Vector3()).distanceTo(goal),proximalCorrectionM:0,unreachableM:reachable.distanceTo(goal)};}
 remember(actor,time){if(this.history.at(-1)?.time===time)this.history.pop();super.remember(actor,time);}
 adoptAnimationState(source){this.clip=source.clip;this.movement={...source.movement};this.reload={...source.reload};this.time=source.time;this.lastFireTime=source.lastFireTime;this.clipStates=new Map([...source.clipStates].map(([n,s])=>[n,{...s}]));this.handErrors=structuredClone(source.handErrors);this.weaponMetrics=source.weaponMetrics?structuredClone(source.weaponMetrics):null;this.fingerGrip=source.fingerGrip;this.fingersFixed=source.fingersFixed;}
 captureCollapseStream(){
  const states=[...this.clipStates.values()].map(s=>({...s})),moving=this.movement.moving,actual=this.rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),base=poseRows(this.rest),scratch=poseRows(this.rest),out=poseRows(this.rest);rawBlend(this.pack,states,this.rest,this.index,base,scratch);
  const corrections=actual.map((row,i)=>({p:row.p.clone().sub(base[i].p),q:base[i].q.clone().invert().multiply(row.q)})),pack=this.pack,rest=this.rest,index=this.index;
  return{moving,clipName:states.map(s=>s.name).join(' + '),advance(dt){if(!moving)return actual;for(const s of states)s.phaseS+=dt*s.rate;rawBlend(pack,states,rest,index,out,scratch);for(let i=0;i<out.length;i++){out[i].p.add(corrections[i].p);out[i].q.multiply(corrections[i].q);}return out;}};
 }
 snapshot(){return{...super.snapshot(),enemyAnimation:true,source:'Adobe Mixamo / preconverted',activeClips:[...this.clipStates.values()].map(s=>({...s})),movement:{...this.movement},transitionS:ENEMY_ANIMATION_TUNING.transitionS,reload:{...this.reload},fireOverlayActive:this.time-this.lastFireTime>=0&&this.time-this.lastFireTime<(this.pack.clips.get('fire_single_stand')?.duration||0),weaponMetrics:this.weaponMetrics?structuredClone(this.weaponMetrics):null};}
}
