import {Matrix4,Quaternion,Vector3} from 'three';
import {actorRotation} from './human-targets.js';
import {reachableHandGoal,solveArm} from './arm-ik.js';
import {SOLDIER_FINGERS} from './generated/soldier-fingers.js';

// Protective arm reach is game tuning. It never adds an impulse, a root force,
// a balancing step or a finger motor. A real floor contact starts the fade.
export const BRACE_TUNING=Object.freeze({
 fadeS:.45,movingPredictionS:.12,offsetEpsilonM:.025,velocityEpsilonMps:.03,reachAheadM:.30,
 handSeparationM:.36,contactDistanceM:.003,
 motors:{shoulder:[180,28,110],elbow:[140,24,90],wrist:[35,8,22]},
});
const runtime=new WeakMap(),V=p=>new Vector3(p.x,p.y,p.z),Q=p=>new Quaternion(p.x,p.y,p.z,p.w),UP=new Vector3(0,1,0);
const armBone=name=>/UpperArm|Forearm|Hand/.test(name);
function massCenter(r,property){
 const sum=new Vector3();let mass=0;
 for(const p of r.parts.values()){sum.addScaledVector(V(p.body[property]()),p.mass);mass+=p.mass;}
 return mass?sum.divideScalar(mass):sum;
}
export function fallDirection(r,context={}){
 const center=massCenter(r,'worldCom'),base=new Vector3();let feet=0;
 for(const side of ['left','right']){const p=r.parts.get(side+'Foot');if(p){base.add(V(p.body.worldCom()));feet++;}}
 if(feet)base.divideScalar(feet);else base.copy(center);
 const offset=center.clone().sub(base);offset.y=0;
 const velocity=massCenter(r,'linvel');velocity.y=0;
 const predicted=offset.clone(),moving=context.clip==='walk'&&velocity.length()>.08;
 if(moving)predicted.addScaledVector(velocity,BRACE_TUNING.movingPredictionS);
 let direction=predicted.clone(),source=moving?'initial-predicted-com-offset':'initial-com-offset';
 if(direction.length()<BRACE_TUNING.offsetEpsilonM){direction=velocity.clone();source='initial-com-velocity';}
 if(direction.length()<BRACE_TUNING.velocityEpsilonMps&&source==='initial-com-velocity'){direction.set(0,0,0);source='no-horizontal-cue';}else direction.normalize();
 return{direction,source,center,base,offset,predicted,velocity};
}
function floorColliders(r){
 const handles=[];r.physics.world.forEachCollider(c=>handles.push(c.handle));
 return handles.map(h=>r.physics.world.getCollider(h)).filter(c=>{
  const surface=r.physics.surface?.get(c.handle);if(surface?.kind==='floor'||surface?.kind==='ground')return true;
  // The isolated prewarm/test world may omit surface metadata. Only a broad,
  // thin, static box is accepted there; registered walls are never floors.
  if(surface||c.isSensor()||c.parent()?.isDynamic())return false;
  const h=c.halfExtents?.();return h&&h.y<=.3&&h.x>=1&&h.z>=1;
 });
}
export function createFallBrace(r,context={}){
 const d=fallDirection(r,context),floors=floorColliders(r),state={
  enabled:false,eligible:null,direction:d.direction.toArray(),directionSource:d.source,
  initialCOM:d.center.toArray(),footBase:d.base.toArray(),initialCOMOffset:d.offset.toArray(),predictedCOMOffset:d.predicted.toArray(),initialCOMVelocity:d.velocity.toArray(),movingPredictionS:context.clip==='walk'?BRACE_TUNING.movingPredictionS:0,
  startS:context.time??null,elapsedS:0,firstHandContactS:null,headContactS:null,
  contactByHand:{left:null,right:null},fadeS:BRACE_TUNING.fadeS,fadeProgress:0,
  armStrength:{left:0,right:0},done:false,cancelReason:null,retention:'awaiting-medical',goals:{},
 };
 r.brace=state;
 runtime.set(r,{floors,direction:d.direction,bodyGoals:new Map(),anchors:new Map(),saved:[],palmRest:Object.fromEntries(SOLDIER_FINGERS.hands.map(h=>[h.side,new Quaternion(...h.palmRestQ)]))});
 return state;
}
function floorContact(part,floors){
 if(!part)return null;
 for(const floor of floors){const hit=part.collider.contactCollider(floor,BRACE_TUNING.contactDistanceM);
  if(hit&&hit.distance<=BRACE_TUNING.contactDistanceM&&Math.abs(hit.normal1.y)>.5)return{distance:hit.distance,point:V(hit.point1).toArray(),floorHandle:floor.handle};
 }
 return null;
}
export function updateFallBrace(r,medical,dt,time){
 const state=r.brace||createFallBrace(r,{time}),cache=runtime.get(r);state.elapsedS+=dt;
 if(state.startS==null)state.startS=time-dt;
 if(state.eligible==null){state.eligible=!!(!medical.unconscious&&!medical.dead&&medical.collapse);state.enabled=state.eligible;state.retention=state.enabled?'until-hand-floor-contact':'disabled';}
 const head=floorContact(r.parts.get('head'),cache.floors);if(head&&state.headContactS==null)state.headContactS=state.elapsedS;
 if(!state.enabled)return false;
 if(medical.unconscious||medical.dead){state.done=true;state.armStrength={left:0,right:0};state.retention='cancelled';state.cancelReason=medical.dead?'death-or-arrest':'unconscious';return false;}
 if(state.done)return false;
 for(const side of ['left','right']){
  const contact=floorContact(r.parts.get(side+'Hand'),cache.floors);
  if(contact&&state.contactByHand[side]==null){state.contactByHand[side]={timeS:state.elapsedS,...contact};cache.anchors.set(side,V(r.parts.get(side+'Hand').body.translation()));if(state.firstHandContactS==null)state.firstHandContactS=state.elapsedS;}
 }
 const age=state.firstHandContactS==null?0:Math.max(0,state.elapsedS-state.firstHandContactS);
 state.fadeProgress=state.firstHandContactS==null?0:age>=state.fadeS-1e-9?1:age/state.fadeS;
 const strength=Math.max(0,medical.consciousness)*(1-state.fadeProgress);
 for(const side of ['left','right'])state.armStrength[side]=strength*medical.arms[side];
 state.done=state.fadeProgress>=1||(!state.armStrength.left&&!state.armStrength.right);
 state.retention=state.done?'released':state.firstHandContactS==null?'until-hand-floor-contact':'contact-fade';
 return !state.done;
}

// Compute the arm goal from the CURRENT falling torso, then restore the other
// animation targets. Only rotations change; reach is bounded by the fixed bones.
export function applyFallBraceGoals(r,goalRig){
 const state=r.brace,cache=runtime.get(r);cache.bodyGoals.clear();
 if(!state?.enabled||state.done)return;
 const rotation=actorRotation(r.actor),inverse=rotation.clone().invert(),origin=new Vector3(...r.actor.at),direction=cache.direction,
  lateral=new Vector3(1,0,0).applyQuaternion(rotation),center=massCenter(r,'worldCom');
 cache.saved.length=goalRig.bones.length;
 for(let i=0;i<goalRig.bones.length;i++){
  const b=goalRig.bones[i],actual=r.rig.bones[i];let saved=cache.saved[i];if(!saved)saved=cache.saved[i]={p:new Vector3(),q:new Quaternion()};saved.p.copy(b.position);saved.q.copy(b.quaternion);b.position.copy(actual.position);b.quaternion.copy(actual.quaternion);
 }
 goalRig.root.updateMatrixWorld(true);
 for(const [side,sign]of [['left',1],['right',-1]]){
  const upper=goalRig.byName.get(side+'UpperArm'),lower=goalRig.byName.get(side+'Forearm'),hand=goalRig.byName.get(side+'Hand'),shoulder=upper.getWorldPosition(new Vector3()).applyQuaternion(rotation).add(origin),
   fingerDirection=direction.lengthSq()?direction.clone():lateral.clone().multiplyScalar(sign),normal=new Vector3(0,side==='left'?-1:1,0),across=new Vector3().crossVectors(fingerDirection,normal).normalize(),
   handWorldQ=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across,fingerDirection,normal)).multiply(cache.palmRest[side].clone().invert()),
   delta=new Vector3(0,-.09,.03).applyQuaternion(handWorldQ),floorY=cache.floors.length?Math.max(...cache.floors.map(f=>f.translation().y+(f.halfExtents?.()?.y||0))):r.actor.at[1],
   point=cache.anchors.get(side)?.clone()||center.clone().addScaledVector(direction,BRACE_TUNING.reachAheadM).addScaledVector(lateral,sign*BRACE_TUNING.handSeparationM/2);
  point.y=floorY+r.parts.get(side+'Hand').radius-Math.min(0,delta.y);
  const local=point.clone().sub(origin).applyQuaternion(inverse),pole=shoulder.clone().addScaledVector(lateral,sign*.28).addScaledVector(direction,-.15).addScaledVector(UP,-.2).sub(origin).applyQuaternion(inverse),reachable=reachableHandGoal(upper,lower,hand,local),result=solveArm(upper,lower,hand,reachable,pole);
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new Quaternion()).invert().multiply(inverse.clone().multiply(handWorldQ)));hand.updateMatrixWorld(true);
  state.goals[side]={world:point.toArray(),reachableWorld:hand.getWorldPosition(new Vector3()).applyQuaternion(rotation).add(origin).toArray(),unreachableM:Math.max(result.unreachableM,local.distanceTo(reachable)),palmNormal:[0,-1,0]};
  for(const name of [side+'UpperArm',side+'Forearm',side+'Hand'])cache.bodyGoals.set(name,rotation.clone().multiply(goalRig.byName.get(name).getWorldQuaternion(new Quaternion())).multiply(r.parts.get(name).referenceQ.clone().invert()));
 }
 // A shoulder motor is relative to the actual chest; elbow/wrist goals are
 // relative to the solved arm chain. Torso motors retain their own collapse goal.
 for(const j of r.joints)if(armBone(j.childBone)&&!cache.bodyGoals.has(j.parentBone))cache.bodyGoals.set(j.parentBone,Q(r.parts.get(j.parentBone).body.rotation()));
 for(let i=0;i<goalRig.bones.length;i++){goalRig.bones[i].position.copy(cache.saved[i].p);goalRig.bones[i].quaternion.copy(cache.saved[i].q);}goalRig.root.updateMatrixWorld(true);
}
export function braceBodyGoal(r,name){return runtime.get(r)?.bodyGoals.get(name);}
