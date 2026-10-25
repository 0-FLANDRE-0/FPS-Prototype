import {MedicalFeedback} from './medical-feedback.js';
import {Vector3} from 'three';
import {createSoldierRig} from './soldier-rig.js';
import {actorRotation} from './human-targets.js';
import {loadHumanTargets} from './human-model.js';
import {createArmorRegions} from './armor-model.js';
import {createInternalRegions} from './internal-model.js';
import {TrainingMedical} from './medical.js';
import {registerCombatBody} from './combat-physics.js';
import {CombatPose,PLAYER_BODY_LAYER} from './combat-pose.js';
import {EnemyCombatPose} from './enemy-combat-pose.js';
import {ENEMY_ANIMATIONS} from './generated/enemy-animations.js';
import {medicalMuscleStrength} from './muscle-data.js';
import {activateMuscles,controlMuscles} from './strength-ragdoll.js';
import {CombatRagdoll} from './combat-ragdoll.js';
import {maskPlayerHead} from './player-fall.js';
export async function createCombatActor({scene,physics,source,id,at,yaw=0,player=false}){
 const actor={id,label:player?'플레이어':'AK-74M 적',at:[...at],yaw},rig=createSoldierRig(),registered=registerCombatBody(physics,actor,rig,{movement:!player});
 const rigs=new Map([[id,rig]]),visual=await loadHumanTargets(scene,{rigs,targets:[actor],source,labels:false}),armor=createArmorRegions(scene,{rigs,targets:[actor]});
 visual.diagnostic.name=id+':BodyHitRegions';visual.skeletons.name=id+':SoldierSkeleton';const row=visual.actors.get(id);if(player)row.group.traverse(n=>n.layers.set(PLAYER_BODY_LAYER));
 const scoped={internalActors:new Map([[id,actor]]),internalAnatomies:new Map([[id,physics.internalAnatomies.get(id)]])},internals=createInternalRegions(scene,scoped);internals.root.name=id+':InternalRegions';
 const medical=new TrainingMedical({medicalModel:'v2',targetId:id,team:player?'friendly':'enemy'}),feedback=new MedicalFeedback(),pose=player?new CombatPose(rig,source.animations):new EnemyCombatPose(rig,source.animations,ENEMY_ANIMATIONS);Object.defineProperty(rig,'pose',{get:()=>preparedRagdoll?.active?preparedRagdoll.mode:pose.clip,configurable:true});let ragdoll=null,preparedRagdoll=null;const targetRig=createSoldierRig(),targetPose=player?new CombatPose(targetRig,source.animations):new EnemyCombatPose(targetRig,source.animations,ENEMY_ANIMATIONS),headMask=player?maskPlayerHead(row.group,rig):null;
 medical.feedback=feedback;
 function copyPose(from,to){to.root.position.copy(from.root.position);for(let i=0;i<to.bones.length;i++){to.bones[i].position.copy(from.bones[i].position);to.bones[i].quaternion.copy(from.bones[i].quaternion);}to.root.updateMatrixWorld(true);to.skeleton.update();}
 function muscles(time,context={}){
  if(!medicalMuscleStrength(medical.actor).collapse)return null;
  const r=prepareRagdoll();if(!r.active){copyPose(rig,targetRig);activateMuscles(r,targetPose,{...context,time});ragdoll=r;}return r;
 }
 function control(dt,time){if(preparedRagdoll?.active&&!preparedRagdoll.frozen)controlMuscles(preparedRagdoll,dt,time,medical.actor);}
 function syncMuscles(){if(preparedRagdoll?.active){if(preparedRagdoll.sync(false))sync();}else if(targetRig){copyPose(targetRig,rig);pose.clip=targetPose.clip;pose.adoptAnimationState?.(targetPose);sync();preparedRagdoll?.follow();}}

 function sync(){row.group.position.fromArray(actor.at);row.group.quaternion.copy(actorRotation(actor));row.group.updateMatrixWorld(true);row.joints.position.fromArray(actor.at);row.joints.quaternion.copy(actorRotation(actor));registered.sync();visual.syncPose();armor.syncPose();internals.syncPose();}
 function debug(settings){visual.setRegionsVisible(settings.hitRegions);visual.setSkeletonVisible(settings.skeletonRegions);armor.setVisible(settings.softArmorRegions&&actor.equipmentWorn?.rig!==false,settings.plateRegions&&actor.equipmentWorn?.rig!==false,settings.helmetRegions&&actor.equipmentWorn?.helmet!==false);internals.setVisible(settings.internalRegions);}
 function record(event){const records=medical.record(event,physics);internals.highlight({...event.trace,bodyHits:event.trace.bodyHits.filter(b=>b.targetId===id)},records);return records;}
 function down(){const m=medical.actor.medical;return medical.actor.isDead||m.isDead||m.isUnconscious||m.isDowned||m.cardiacArrest||m.canWalk===false;}
 // Read the fitted heart center through its current bone, including ragdoll.
 const heartShape=physics.internalAnatomies.get(id).shapes.find(s=>s.id==='heart');
 function visionEyeHeight(){const heart=new Vector3(...heartShape.center).applyMatrix4(rig.byName.get(heartShape.bone).matrixWorld).applyQuaternion(actorRotation(actor)).add(new Vector3(...actor.at));return pose.eye(actor).y-heart.y;}
 function prepareRagdoll(){if(!preparedRagdoll)preparedRagdoll=new CombatRagdoll(physics,registered,pose);return preparedRagdoll;}
 function fall(){if(ragdoll)return false;pose.releaseGrip();ragdoll=prepareRagdoll();return ragdoll.activate();}
 function updateRagdoll(){if(ragdoll&&ragdoll.sync(false))sync();}
 return{actor,rig,pose,targetPose,feedback,copyPose,muscles,control,syncMuscles,registered,visual,armor,internals,medical,sync,debug,record,down,visionEyeHeight,prepareRagdoll,followRagdoll:()=>preparedRagdoll?.follow(),fall,updateRagdoll,get ragdoll(){return preparedRagdoll?.active?preparedRagdoll:ragdoll;},
  landmarks:()=>({head:pose.eye(actor),chest:registered.body.find(s=>s.shape.id==='chest').pose.position.clone(),pelvis:registered.body.find(s=>s.shape.id==='pelvis').pose.position.clone()}),
  snapshot:()=>({actor:structuredClone(actor),pose:pose.snapshot(),rig:{...rig.snapshot(),pose:rig.pose},medical:medical.snapshot(),feedback:feedback.snapshot(),armorCondition:registered.condition.snapshot(),ragdoll:ragdoll?.snapshot()||null,muscles:preparedRagdoll?.snapshot()||null,preparedRagdoll:!ragdoll?preparedRagdoll?.snapshot()||null:null,bodyLayer:player?PLAYER_BODY_LAYER:0,collapseAnimation:preparedRagdoll?.animationTarget?.snapshot()||null}),
  headMask:headMask?.rows||null,dispose(){headMask?.dispose();targetPose?.dispose();targetRig?.dispose();preparedRagdoll?.dispose();registered.dispose();visual.dispose();armor.dispose();internals.dispose();pose.dispose();rig.dispose();}};
}
