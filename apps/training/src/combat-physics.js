import RAPIER from '@dimforge/rapier3d-compat';
import {BODY_PROFILE,bodyMesh,shapePose} from './human-targets.js';
import {ARMOR_PROFILE,armorVertices,armorIndices,armorPose,armorOwnerId} from './armor-targets.js';
import {meshTriangles} from './armor-geometry.js';
import {buildInternalAnatomy} from './internal-anatomy.js';
import {ArmorCondition} from './protection.js';
import {Vector3} from 'three';

// Registration only. All shot queries and terminal equations remain the same
// TrainingPhysics / traceShot path used by H01.
export function registerCombatBody(physics,actor,rig,{movement=false}={}){
 const armor=[],body=[],colliders=[];
 physics.humanRigs.set(actor.id,rig);physics.internalActors.set(actor.id,actor);physics.internalAnatomies.set(actor.id,buildInternalAnatomy(rig));
 for(const shape of ARMOR_PROFILE.shapes){
  const pose=armorPose(actor,shape,rig),vertices=armorVertices(shape),indices=armorIndices(shape),collider=physics.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setTranslation(...pose.position.toArray()).setRotation(pose.rotation).setSensor(true).setActiveCollisionTypes(0));
  const row={id:actor.id,kind:'armor-sensor',actor,shape,ownerId:armorOwnerId(actor,shape),collider,pose,triangles:shape.kind==='plate'||shape.kind==='helmet'?meshTriangles(vertices,indices):null};armor.push(row);colliders.push(collider);physics.surface.set(collider.handle,row);
 }
 for(const shape of BODY_PROFILE){
  const pose=shapePose(actor,shape,rig),data=bodyMesh(shape),collider=physics.world.createCollider(RAPIER.ColliderDesc.trimesh(data.vertices,data.indices).setTranslation(...pose.position.toArray()).setRotation(pose.rotation).setSensor(true).setActiveCollisionTypes(0));
  const row={id:actor.id,kind:'human',actor,shape,collider,pose,triangles:meshTriangles(data.vertices,data.indices)};body.push(row);colliders.push(collider);physics.surface.set(collider.handle,row);
 }
 physics.armorSensors.push(...armor);physics.humanSensors.push(...body);
 const condition=new ArmorCondition(armor);
 // Own durability objects per actor; the existing resolver can see them in the
 // combined registry without sharing durability with another actor.
 Object.assign(physics.armorCondition.initial,condition.initial);Object.assign(physics.armorCondition.target.armorDurability,condition.target.armorDurability);
 let movementBody=null;
 if(movement){movementBody=physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(actor.at[0],actor.at[1]+.85,actor.at[2]));const collider=physics.world.createCollider(RAPIER.ColliderDesc.capsule(.62,.23),movementBody);physics.surface.set(collider.handle,{id:actor.id,kind:'human-movement'});colliders.push(collider);}
 function sync(){
  rig.root.updateMatrixWorld(true);rig.skeleton.update();
  for(const row of body){row.pose=shapePose(actor,row.shape,rig);row.collider.setTranslation(row.pose.position);row.collider.setRotation(row.pose.rotation);}
  for(const row of armor){row.pose=armorPose(actor,row.shape,rig);row.collider.setTranslation(row.pose.position);row.collider.setRotation(row.pose.rotation);}
  if(movementBody){const p={x:actor.at[0],y:actor.at[1]+.85,z:actor.at[2]};movementBody.setTranslation(p,true);movementBody.setNextKinematicTranslation(p);}
  physics.world.propagateModifiedBodyPositionsToColliders();
 }
 function disableMovement(){if(movementBody){const c=movementBody.collider(0);c.setSensor(true);c.setCollisionGroups(0);}}
 function enableMovement(){if(movementBody){const c=movementBody.collider(0);c.setSensor(false);c.setCollisionGroups(0xffffffff);}}
 function dispose(){if(movementBody){const c=movementBody.collider(0);physics.surface.delete(c.handle);physics.world.removeRigidBody(movementBody);movementBody=null;}for(const c of colliders){if(physics.world.getCollider(c.handle)){physics.surface.delete(c.handle);physics.world.removeCollider(c,true);}}
  physics.humanSensors=physics.humanSensors.filter(s=>s.actor.id!==actor.id);physics.armorSensors=physics.armorSensors.filter(s=>s.actor.id!==actor.id);
  for(const key of Object.keys(condition.initial)){delete physics.armorCondition.initial[key];delete physics.armorCondition.target.armorDurability[key];}
  physics.humanRigs.delete(actor.id);physics.internalActors.delete(actor.id);physics.internalAnatomies.delete(actor.id);
 }
 sync();return{actor,rig,armor,body,condition,sync,disableMovement,enableMovement,dispose};
}
export function shooterPhysics(physics,shooterId){
 const scoped=Object.create(physics);
 scoped.humanSensors=physics.humanSensors.filter(s=>s.actor.id!==shooterId&&s.actor.queryEnabled!==false);
 scoped.armorSensors=physics.armorSensors.filter(s=>s.actor.id!==shooterId&&s.actor.queryEnabled!==false);
 scoped.internalActors=new Map([...physics.internalActors].filter(([id,actor])=>id!==shooterId&&actor.queryEnabled!==false));
 scoped.ray=function(origin,direction,distance=50){
  const hit=this.world.castRayAndGetNormal(new RAPIER.Ray(origin,direction),distance,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.collider,this.body,
   c=>this.surface.get(c.handle)?.kind!=='world-loot'&&!(this.surface.get(c.handle)?.kind==='human-movement'&&this.surface.get(c.handle)?.id===shooterId));
  if(!hit)return null;const surface=this.surface.get(hit.collider.handle);return{...surface,distance:hit.timeOfImpact,point:origin.clone().addScaledVector(direction,hit.timeOfImpact),normal:new Vector3(hit.normal.x,hit.normal.y,hit.normal.z)};
 };
 return scoped;
}
