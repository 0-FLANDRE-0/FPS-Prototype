import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {actorRotation} from './human-targets.js';
import {MUSCLE,medicalMuscleStrength,followGeneralStrength} from './muscle-data.js';
import {BRACE_TUNING,createFallBrace,updateFallBrace,applyFallBraceGoals,braceBodyGoal} from './fall-brace.js';
const Q=p=>new Quaternion(p.x,p.y,p.z,p.w);
const legBone=name=>/UpperLeg|LowerLeg|Foot|Toe/.test(name);

// Called only after the medical adapter reports collapse. The prebuilt bodies
// retain their per-bone linear/angular velocity; no standing dynamic mode exists.
export function activateMuscles(r,targetPose,context={}){
 if(r.active)return false;
 const velocity=context.velocity||r.pose.velocities().get('pelvis')?.linear||new Vector3(),speed=Math.hypot(velocity.x||0,velocity.z||0),clip=context.clip||r.pose.clip,
  phase=context.walkSeconds??targetPose.actions?.walk?.time??0;
 r.collapse={clip,moving:clip==='walk'&&speed>MUSCLE.movingThresholdMps,speedMps:speed,velocity:[velocity.x||0,velocity.y||0,velocity.z||0],walkPhaseS:phase,walkRate:speed/MUSCLE.walkReferenceMps,elapsedS:0,goalsActive:true,reason:null,durationS:null};
 r.collapsePose=r.rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
 r.targetPose=targetPose;r.strength=1;r.collapseElapsedS=0;r.collapseDurationS=null;r.collapseStartStrength=1;
 r.activate();createFallBrace(r,context);
 for(const p of r.parts.values()){
  p.body.setAngularDamping(MUSCLE.activeAngularDamping);p.body.setLinearDamping(MUSCLE.activeLinearDamping);p.body.setAdditionalSolverIterations(r.stability?.solverIterations??MUSCLE.activeSolverIterations);
  if(p.bone.endsWith('Foot'))p.collider.setFriction(MUSCLE.footFriction);
  const arm=/Arm|Hand/.test(p.bone),leg=/Leg|Foot/.test(p.bone),head=/^(head|neck)$/.test(p.bone),membership=arm?8:leg?4:head?16:2,filter=arm?5:leg?31:head?5:7;
  p.collider.setCollisionGroups((membership<<16)|filter);
 }
 r.mode='strength';return true;
}

function finishMuscles(r){
 r.mode='passive';r.strength=0;r.collapse.goalsActive=false;
 for(const j of r.joints)for(const l of j.limits)j.setPD(l.axis,l.referenceRad);
 for(const p of r.parts.values()){p.body.setAngularDamping(MUSCLE.passiveAngularDamping);p.body.setLinearDamping(MUSCLE.passiveLinearDamping);p.body.setAdditionalSolverIterations(r.stability?.solverIterations??MUSCLE.passiveSolverIterations);}
}

export function controlMuscles(r,dt,time,unit){
 if(!r.active)return;
 const m=medicalMuscleStrength(unit);r.medicalStrength=m;
 const bracing=updateFallBrace(r,m,dt,time);if(r.mode!=='strength')return;
 r.strength=followGeneralStrength(r,m,dt);r.collapse.elapsedS=r.collapseElapsedS;r.collapse.durationS=r.collapseDurationS;r.collapse.reason??=m.reason;
 // The leg/torso envelope still ends once. A conscious protective arm reach
 // alone may outlast it, until an actual hand-floor contact plus its fade.
 if(r.strength<=1e-6&&!bracing){finishMuscles(r);return;}
 const target=r.targetPose,rotation=actorRotation(r.actor),goalRig=r.reflexRig,progress=Math.min(1,r.collapseElapsedS/MUSCLE.stationaryReflexS);
 if(r.collapse.moving){
  r.collapse.walkPhaseS+=dt*r.collapse.walkRate;
  target.sample('walk',r.collapse.walkPhaseS);
 }
 goalRig.root.position.copy(target.rig.root.position);
 for(let i=0;i<goalRig.bones.length;i++){
  const b=goalRig.bones[i],base=r.collapsePose[i],c=target.crouchGoal?.[i];b.position.copy(base.p);b.quaternion.copy(base.q);
  if(r.collapse.moving&&legBone(b.name)){b.position.copy(target.rig.bones[i].position);b.quaternion.copy(target.rig.bones[i].quaternion);}
  else if(!r.collapse.moving&&c&&i<24){b.position.lerp(c.p,progress);b.quaternion.slerp(c.q,progress);}
  // Fingers stay fixed in the released posture and have no physical motors.
  if(i>=24){b.position.copy(r.rig.bones[i].position);b.quaternion.copy(r.rig.bones[i].quaternion);}
 }
 // A brief muscle target lets weight move forward before force disappears;
 // it is an anatomical joint rotation, never a pelvis anchor or added impulse.
 // It also prevents a passive hands/knees tripod from becoming the final pose.
 const tip=Math.min(1,r.collapseElapsedS/MUSCLE.stationaryReflexS);
 for(const [name,angle]of [['spine',MUSCLE.collapseSpineForwardRad],['chest',MUSCLE.collapseChestForwardRad]])goalRig.byName.get(name).quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),angle*tip));
 goalRig.root.updateMatrixWorld(true);
 if(bracing)applyFallBraceGoals(r,goalRig);
 const bodyQ=name=>rotation.clone().multiply(goalRig.byName.get(name).getWorldQuaternion(new Quaternion())).multiply(r.parts.get(name).referenceQ.clone().invert()),
  upperStrength=r.strength*(m.unconscious?1:m.general);
 for(const j of r.joints){
  // An unconscious fall has no protective arm reaction. Keeping the old
  // aim/crouch arm target during the leg fade can build a stable hand/knee tripod.
  const arm=/UpperArm|Forearm|Hand/.test(j.childBone),a=(bracing&&arm?braceBodyGoal(r,j.parentBone)||bodyQ(j.parentBone):bodyQ(j.parentBone)).clone().multiply(Q(j.joint.frameX1())),b=(bracing&&arm?braceBodyGoal(r,j.childBone)||bodyQ(j.childBone):bodyQ(j.childBone)).clone().multiply(Q(j.joint.frameX2())),relative=a.invert().multiply(b).normalize(),angles=[relative.x,relative.y,relative.z].map(value=>{const angle=2*Math.atan2(value,relative.w);return Math.atan2(Math.sin(angle),Math.cos(angle));}),side=j.childBone.startsWith('left')?'left':'right',
   S=legBone(j.childBone)?r.strength:arm?(m.unconscious?MUSCLE.unconsciousArmStrength:bracing?r.brace.armStrength[side]:upperStrength*m.arms[side]):upperStrength,c=(bracing&&arm?BRACE_TUNING.motors[j.kind]:null)||MUSCLE.motors[j.kind]||[0,0,0];
  const f=r.flinchEvent,age=f?time-f.time:100,flinch=f&&age<MUSCLE.flinchS&&j.childBone===(f.bone==='head'?'neck':f.bone)?MUSCLE.flinchRad*Math.sin(Math.PI*Math.max(0,age)/MUSCLE.flinchS):0;
  for(const l of j.limits){const locked=l.minRad===l.maxRad,desired=Math.max(l.minRad+(locked?0:.015),Math.min(l.maxRad-(locked?0:.015),angles[l.axis-3]+(l.axis===3?flinch:0)));j.joint.rawSet.jointConfigureMotorModel(j.joint.handle,l.axis,RAPIER.MotorModel.ForceBased);j.setPD(l.axis,desired+l.referenceRad,{kp:c[0],kd:c[1],maxForce:c[2],strength:locked?0:S});}
 }
}
