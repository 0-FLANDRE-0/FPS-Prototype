import {prepareLifecycle,activateLifecycle,updateLifecycle,freezeRagdoll,wakeFrozenRagdoll} from './ragdoll-lifecycle.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion,Euler,Matrix4} from 'three';
import {actorRotation} from './human-targets.js';
import {RAGDOLL_SEGMENTS,SEGMENT_MASS_FRACTIONS,JOINT_ROM_DEG,RAGDOLL_TUNING} from './ragdoll-data.js';
import {createSoldierRig} from './soldier-rig.js';
import {activateMuscles,controlMuscles} from './strength-ragdoll.js';
import {MUSCLE} from './muscle-data.js';
import {combatMassLedger} from './combat-mass.js';
import {RAGDOLL_STABILITY,stabilizeRagdollInertia} from './ragdoll-stability.js';
import {updateRagdollSettling,wakeRagdollSettling} from './ragdoll-settling.js';
const V=p=>new Vector3(p.x,p.y,p.z),Q=p=>new Quaternion(p.x,p.y,p.z,p.w),rad=d=>d*Math.PI/180;
const volume=(r,length)=>Math.PI*r*r*length+4/3*Math.PI*r**3;
function definition(name){
 if(name==='head')return{type:'head-neck-fixed',ranges:[]};
 if(name==='spine'||name==='chest'){const r=JOINT_ROM_DEG.torso;return{type:'torso',ranges:[[-r.extension/2,r.flexion/2],[0,0],[-r.lateral/2,r.lateral/2]]};}
 if(name==='neck'){const r=JOINT_ROM_DEG.neck;return{type:'neck',ranges:[[-r.flexion,r.extension],[-r.rotation,r.rotation],[-r.lateral,r.lateral]]};}
 if(name.endsWith('Forearm'))return{type:'elbow',hinge:true,max:JOINT_ROM_DEG.elbow.flexion};
 if(name.endsWith('LowerLeg'))return{type:'knee',hinge:true,max:JOINT_ROM_DEG.knee.flexion};
 if(name.endsWith('UpperArm')||name.endsWith('UpperLeg')){
  const shoulder=name.endsWith('UpperArm'),r=JOINT_ROM_DEG[shoulder?'shoulder':'hip'],left=name.startsWith('left');
  return{type:shoulder?'shoulder':'hip',ranges:[[-r.flexion,r.extension],[-r.internalRotation,r.externalRotation],left?[-r.adduction,r.abduction]:[-r.abduction,r.adduction]]};
 }
 if(name.endsWith('Hand')){const r=JOINT_ROM_DEG.wrist;return{type:'wrist',ranges:[[-r.flexion,r.extension],[0,0],[-r.radial,r.ulnar]]};}
 const r=JOINT_ROM_DEG.ankle;return{type:'ankle',ranges:[[-r.dorsiflexion,r.plantarflexion],[0,0],[-r.inversion,r.eversion]]};
}

// Each joint owns a stable motor interface for the later muscle stage. This
// pinned Rapier0.21 generic-joint API exposes limits/motors through rawSet;
// all axes have zero force and zero stiffness/damping in AI-1.
export class PassiveJoint{
 constructor(joint,kind,limits){this.joint=joint;this.kind=kind;this.limits=limits;this.controls=[];
  for(const l of limits){joint.rawSet.jointSetLimits(joint.handle,l.axis,l.minRad,l.maxRad);this.setPD(l.axis,0,{kp:0,kd:0,maxForce:0,strength:0});}}
 setPD(axis,targetRad,{kp=0,kd=0,maxForce=0,strength=0}={}){
  const limit=this.limits.find(l=>l.axis===axis);if(!limit)return;
  this.joint.rawSet.jointConfigureMotorPosition(this.joint.handle,axis,targetRad-limit.referenceRad,kp*strength,kd*strength);
  this.joint.rawSet.jointSetMotorMaxForce(this.joint.handle,axis,maxForce*strength);
  let control=this.controls.find(c=>c.axis===axis);if(!control){control={axis};this.controls.push(control);}Object.assign(control,{targetRad,kp,kd,maxForce,strength});
 }
 snapshot(){return{kind:this.kind,parentBone:this.parentBone,childBone:this.childBone,limits:this.limits.map(l=>({...l,enabled:this.joint.rawSet.jointLimitsEnabled(this.joint.handle,l.axis),actualMinRad:this.joint.rawSet.jointLimitsMin(this.joint.handle,l.axis),actualMaxRad:this.joint.rawSet.jointLimitsMax(this.joint.handle,l.axis)})),controls:this.controls};}
}
export class CombatRagdoll{
 constructor(physics,registered,pose,{massKg=RAGDOLL_TUNING.bodyMassKg}={}){
  this.physics=physics;this.registered=registered;this.actor=registered.actor;this.rig=registered.rig;this.parts=new Map();this.joints=[];this.start=[];this.massLedger=combatMassLedger(massKg);this.pose=pose;this.active=false;this.syncCount=0;this.skippedSleeping=0;this.reflexRig=createSoldierRig();
  const rotation=actorRotation(this.actor);
  const rows=RAGDOLL_SEGMENTS.map(d=>{const p=pose.point(this.actor,d.bone),end=d.end?pose.point(this.actor,d.end):new Vector3(...d.offset).applyQuaternion(this.rig.byName.get(d.bone).getWorldQuaternion(new Quaternion())).applyQuaternion(rotation).add(p);return{...d,p,delta:end.sub(p),referenceQ:rotation.clone().multiply(this.rig.byName.get(d.bone).getWorldQuaternion(new Quaternion()))};});
  const headVolume=rows.filter(r=>r.massKey==='head_neck').reduce((s,r)=>s+volume(r.radius,r.delta.length()),0);
  for(const r of rows){
   const fraction=SEGMENT_MASS_FRACTIONS[r.massKey]*(r.massKey==='head_neck'?volume(r.radius,r.delta.length())/headVolume:1),anatomicMass=massKg*fraction,equipmentMass=this.massLedger.equipmentByBone[r.bone]||0,mass=anatomicMass+equipmentMass;
   const body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...r.p.toArray()).setLinearDamping(RAGDOLL_TUNING.linearDamping).setAngularDamping(RAGDOLL_TUNING.angularDamping).setAdditionalSolverIterations(MUSCLE.passiveSolverIterations).setCcdEnabled(true).setCanSleep(true));
   const shapeQ=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),r.delta.clone().normalize()),center=r.delta.clone().multiplyScalar(.5);
   const collider=physics.world.createCollider(RAPIER.ColliderDesc.capsule(r.delta.length()/2,r.radius).setTranslation(...center.toArray()).setRotation(shapeQ).setMass(mass).setContactSkin(RAGDOLL_TUNING.contactSkinM).setFriction(RAGDOLL_TUNING.friction).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setRestitution(0).setCollisionGroups(0).setSensor(true),body);
   physics.surface.set(collider.handle,{id:this.actor.id,kind:'human-movement',ragdoll:true});body.recomputeMassPropertiesFromColliders();
   this.parts.set(r.bone,{...r,body,collider,mass,anatomicMass,equipmentMass,fraction,center});
  }
  this.stability={solverIterations:RAGDOLL_STABILITY.solverIterations,inertia:stabilizeRagdollInertia(this.parts)};
  this.configureJoints(true);this.massKg=[...this.parts.values()].reduce((s,r)=>s+r.mass,0);this.start=[];this.follow();prepareLifecycle(this);

 }
 configureJoints(create=false){
  const rotation=actorRotation(this.actor);
  for(const r of this.parts.values()){
   let parent=this.rig.byName.get(r.bone).parent;while(parent&&!this.parts.has(parent.name))parent=parent.parent;if(!parent)continue;
   const a=this.parts.get(parent.name),parentQ=rotation.clone().multiply(parent.getWorldQuaternion(new Quaternion())),childQ=rotation.clone().multiply(this.rig.byName.get(r.bone).getWorldQuaternion(new Quaternion())),
    actualDelta=r.delta.clone().applyQuaternion(Q(r.body.rotation())),d=definition(r.bone);let axis=new Vector3(1,0,0).applyQuaternion(parentQ),references=[0,0,0],frame=parentQ.clone();
   if(d.hinge){
    const upper=r.p.clone().sub(a.p).normalize(),lower=actualDelta.clone().normalize(),cross=upper.clone().cross(lower);
    if(d.type==='knee')axis.set(1,0,0).applyQuaternion(parentQ);else if(cross.lengthSq()>1e-8)axis.copy(cross.normalize());
    const flexion=d.type==='knee'?Math.max(0,Math.atan2(axis.dot(cross),upper.dot(lower))):Math.acos(Math.max(-1,Math.min(1,upper.dot(lower))));references=[flexion,0,0];d.ranges=[[0,d.max]];
    // Preserve the parent's full basis, including roll, around the hinge axis.
    let up=new Vector3(0,1,0).applyQuaternion(parentQ);up.addScaledVector(axis,-up.dot(axis));
    if(up.lengthSq()<1e-8){up.set(0,0,1).applyQuaternion(parentQ);up.addScaledVector(axis,-up.dot(axis));}
    up.normalize();frame.setFromRotationMatrix(new Matrix4().makeBasis(axis,up,new Vector3().crossVectors(axis,up)));
   }else if(d.type==='shoulder'||d.type==='hip'){
    const dir=actualDelta.clone().applyQuaternion(parentQ.clone().invert()).normalize();references=[-Math.atan2(dir.z,-dir.y),0,Math.atan2(dir.x,-dir.y)];
   }else{
    const e=new Euler().setFromQuaternion(parentQ.clone().invert().multiply(childQ),'YXZ');references=[e.x,e.y,e.z];
   }
   const mask=d.ranges.length===0?63:d.hinge?7|16|32:d.ranges.reduce((mask,[min,max],i)=>mask|(min===max?8<<i:0),7);
   const old=this.joints.find(j=>j.childBone===r.bone),joint=create?this.physics.world.createImpulseJoint(RAPIER.JointData.generic(r.p.clone().sub(a.p),{x:0,y:0,z:0},axis,mask),a.body,r.body,true):old.joint;joint.setContactsEnabled(false);
   const qa=Q(a.body.rotation()).invert(),qb=Q(r.body.rotation()).invert();joint.setLocalFrame1(r.p.clone().sub(a.p).applyQuaternion(qa),qa.multiply(frame));joint.setLocalFrame2({x:0,y:0,z:0},qb.multiply(frame));
   const limits=d.ranges.map(([min,max],i)=>({axis:3+i,anatomicalMinDeg:min,anatomicalMaxDeg:max,measuredReferenceRad:references[i],referenceRad:min===0&&max===0?0:Math.max(rad(min),Math.min(rad(max),references[i])),minRad:rad(min)-(min===0&&max===0?0:Math.max(rad(min),Math.min(rad(max),references[i]))),maxRad:rad(max)-(min===0&&max===0?0:Math.max(rad(min),Math.min(rad(max),references[i])))}));
   if(create){const passive=new PassiveJoint(joint,d.type,limits);passive.parentBone=parent.name;passive.childBone=r.bone;this.joints.push(passive);}else{old.limits=limits;for(const l of limits){joint.rawSet.jointSetLimits(joint.handle,l.axis,l.minRad,l.maxRad);old.setPD(l.axis,0);}}
  }

 }
 // Inactive capsules are query-invisible (groups 0) and follow the animated
 // bone origins and rotations. They never replace the existing hit sensors.
 follow(){if(this.active)return;const rotation=actorRotation(this.actor);
  for(const p of this.parts.values()){const at=this.pose.point(this.actor,p.bone),q=rotation.clone().multiply(this.rig.byName.get(p.bone).getWorldQuaternion(new Quaternion())).multiply(p.referenceQ.clone().invert());p.body.setNextKinematicTranslation(at);p.body.setNextKinematicRotation(q);}
 }
 activate(){if(this.active)return false;activateLifecycle(this);this.active=true;this.mode='passive';this.registered.disableMovement();this.start=[];
  const rotation=actorRotation(this.actor),velocities=this.pose.velocities();
  // Capture joint neutral frames at transition, preserving the prepared body
  // frames. No body/collider/joint is created and the same v32 velocities apply.
  for(const p of this.parts.values()){
   p.p=this.pose.point(this.actor,p.bone);const boneQ=rotation.clone().multiply(this.rig.byName.get(p.bone).getWorldQuaternion(new Quaternion())),bodyQ=boneQ.clone().multiply(p.referenceQ.clone().invert());
   p.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);p.body.setAdditionalSolverIterations(this.stability.solverIterations);p.body.setTranslation(p.p,true);p.body.setRotation(bodyQ,true);
   // Keep each prebuilt collider's local frame, shape and mass properties.
   // Rebuilding 17 shapes/inertias invalidates Rapier caches on the fall tick.
   p.collider.setSensor(false);p.collider.setCollisionGroups((2<<16)|1);
   const velocity=velocities.get(p.bone)||{linear:new Vector3(),angular:new Vector3()},com=V(p.body.worldCom()).sub(p.p),centerVelocity=velocity.linear.clone().add(velocity.angular.clone().cross(com));p.sourceVelocity=velocity;
   p.body.setLinvel(centerVelocity,true);p.body.setAngvel(velocity.angular,true);
   this.start.push({bone:p.bone,massKg:p.mass,anatomicMassKg:p.anatomicMass,equipmentMassKg:p.equipmentMass,position:p.p.toArray(),rotation:boneQ.toArray(),linearAtBone:velocity.linear.toArray(),angular:velocity.angular.toArray(),linearAtCOM:centerVelocity.toArray()});
  }
  this.configureJoints();this.sync();return true;
 }
 freeze(reason){return freezeRagdoll(this,reason);}
 get sleeping(){if(this.frozen)return true;if(!this.active)return false;for(const p of this.parts.values())if(!p.body.isSleeping())return false;return true;}
 sync(sensors=true){
  if(!this.active||this.frozen&&!this.finalSyncPending)return false;if(!this.frozen)updateLifecycle(this,this.physics.world.timestep);if(!this.frozen)updateRagdollSettling(this,this.physics.world.timestep);if(this.sleeping&&!this.finalSyncPending){this.skippedSleeping++;return false;}this.finalSyncPending=false;this.syncCount++;
  const inverse=actorRotation(this.actor).invert(),origin=new Vector3(...this.actor.at);
  for(const bone of this.rig.bones){const part=this.parts.get(bone.name);if(!part)continue;
   const p=V(part.body.translation()).sub(origin).applyQuaternion(inverse),q=inverse.clone().multiply(Q(part.body.rotation()).multiply(part.referenceQ));
   bone.parent.updateMatrixWorld(true);bone.position.copy(bone.parent.worldToLocal(p));bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));bone.updateMatrixWorld(true);
  }
  this.rig.skeleton.update();this.actor.ballisticCenter=V(this.parts.get('pelvis').body.translation()).toArray();if(sensors)this.registered.sync();return true;
 }
 impulse(bone,impulse,point){wakeFrozenRagdoll(this);wakeRagdollSettling(this);for(const p of this.parts.values())p.body.wakeUp();(this.parts.get(bone)||this.parts.get('chest')).body.applyImpulseAtPoint(impulse,point,true);}
 snapshot(){return{active:this.active,frozen:!!this.frozen,lifecycle:{...this.lifecycle},prepared:true,sleeping:this.sleeping,syncCount:this.syncCount,skippedSleeping:this.skippedSleeping,massKg:this.massKg,massLedger:this.massLedger,strength:this.strength||0,mode:this.mode||'kinematic',medicalStrength:this.medicalStrength||null,stability:this.stability,settling:this.settling?{...this.settling,baseDamping:undefined}:null,brace:this.brace?{...this.brace}:null,collapse:this.collapse?{...this.collapse}:null,bodies:this.parts.size,joints:this.joints.map(j=>j.snapshot()),handoff:this.start,
  segments:[...this.parts.values()].map(p=>({bone:p.bone,massKg:p.mass,enabled:p.body.isEnabled(),ccd:p.body.isCcdEnabled(),additionalSolverIterations:p.body.additionalSolverIterations(),position:V(p.body.translation()).toArray(),rotation:Q(p.body.rotation()).toArray(),linear:V(p.body.linvel()).toArray(),angular:V(p.body.angvel()).toArray(),sleeping:p.body.isSleeping()}))};}
 dispose(){this.physics.ragdolls?.delete(this);this.reflexRig.dispose();for(const j of this.joints)this.physics.world.removeImpulseJoint(j.joint,true);for(const p of this.parts.values()){this.physics.surface.delete(p.collider.handle);this.physics.world.removeRigidBody(p.body);}this.parts.clear();}
}

let solverReady=false;
// Warm the first dynamic solver/CCD/contact/JIT paths in an isolated world.
// This never advances the live game, its medical clocks or its collision query.
export function prepareRagdollSolver(sourcePose,actor){
 if(solverReady)return;const world=new RAPIER.World({x:0,y:-9.81,z:0}),rig=createSoldierRig();
 for(const b of rig.bones){const source=sourcePose.rig.byName.get(b.name);if(source){b.position.copy(source.position);b.quaternion.copy(source.quaternion);}}rig.root.updateMatrixWorld(true);
 const pose={rig,point:(a,name)=>rig.byName.get(name).getWorldPosition(new Vector3()).applyQuaternion(actorRotation(a)).add(new Vector3(...a.at)),velocities:()=>new Map()},physics={world,surface:new Map()},registered={actor:{...actor,at:[...actor.at]},rig,disableMovement(){},sync(){}};
 world.createCollider(RAPIER.ColliderDesc.cuboid(4,.2,4).setTranslation(actor.at[0],-.2,actor.at[2]).setFriction(1.1));const r=new CombatRagdoll(physics,registered,pose);r.activate();
 for(let i=0;i<180;i++){world.step();r.sync();}
 // Exercise the post-collapse motor path before combat. Healthy standing is
 // deliberately never switched to dynamics by the production actor adapter.
 r.active=false;activateMuscles(r,pose,{clip:'standing'});
 const unit={medical:{consciousness:0,isUnconscious:true,pain:0,bodyParts:{},hemodynamics:{map:93}}};
 for(let i=0;i<60;i++){controlMuscles(r,1/60,i/60,unit);world.step();r.sync();}
 r.dispose();world.free();rig.dispose();solverReady=true;
}
