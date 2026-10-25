import {SOLDIER_AK_GRIP,applySoldierAKGrip} from './soldier-grip.js';
import {BufferAttribute,BufferGeometry,Mesh,Box3,Vector3,Quaternion,Matrix4} from 'three';
import {AK_MARKERS,STOCK_CONTACTS} from './weapon-data.js';
import {zeroingDirection,zeroingPreset} from './zeroing.js';
import {sightGeometry} from './sight-geometry.js';
import {actorRotation} from './human-targets.js';
import {rotateWorld} from './arm-ik.js';
export function combatAKSource(weapon){
 weapon.rig.updateMatrixWorld(true);const source=weapon.fps.gun;source.skeleton.update();
 const geometry=source.geometry.clone(),p=geometry.attributes.position,values=new Float32Array(p.count*3),inverse=weapon.rig.matrixWorld.clone().invert();
 for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i);source.applyBoneTransform(i,v);v.applyMatrix4(source.matrixWorld).applyMatrix4(inverse);v.toArray(values,i*3);}
 geometry.setAttribute('position',new BufferAttribute(values,3));geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();geometry.computeBoundingBox();
 return {geometry,material:source.material,grips:Object.fromEntries(Object.entries(weapon.fps.grips).map(([s,p])=>[s,p.clone()])),bounds:geometry.boundingBox.clone(),sourceMesh:source.name,gripPose:SOLDIER_AK_GRIP,
  mesh(){const m=new Mesh(geometry,source.material);m.name='Enemy AK-74M / gun only';m.frustumCulled=false;return m;}};
}
export function aimCombatAK(actor,pose,asset,mesh,{target,lowered=false,recoil=0,shotAge=100}){
 if(pose.enemyAnimation)return aimEnemyCombatAK(actor,pose,asset,mesh,{target,lowered,recoil,shotAge});
 if(!lowered){pose.rig.byName.get('chest').quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-.45));pose.rig.root.updateMatrixWorld(true);}
 const rotation=actorRotation(actor),inverse=rotation.clone().invert(),localTarget=target.clone().sub(new Vector3(...actor.at)).applyQuaternion(inverse);
 // Butt pad at the right shoulder; local marker and grip values are inherited
 // measurements. Shoulder offset is authored stance tuning.
 const shoulder=pose.rig.byName.get('rightUpperArm').getWorldPosition(new Vector3()),stock=shoulder.clone().add(new Vector3(.02,.10,.06).applyQuaternion(pose.rig.byName.get('chest').getWorldQuaternion(new Quaternion()))),dir=localTarget.clone().sub(stock).normalize(),q=new Quaternion(),p=new Vector3();
 if(lowered)dir.set(0,-.55,.84).normalize();
 for(let i=0;i<5;i++){q.setFromRotationMatrix(new Matrix4().lookAt(new Vector3(),dir,new Vector3(0,1,0)));p.copy(stock).sub(new Vector3(...STOCK_CONTACTS.ak74m).applyQuaternion(q));if(!lowered)dir.copy(localTarget).sub(new Vector3(...AK_MARKERS.muzzle).applyQuaternion(q).add(p)).normalize();}
 if(recoil){q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-recoil));p.copy(stock).sub(new Vector3(...STOCK_CONTACTS.ak74m).applyQuaternion(q));}
 const contacts=asset.gripPose?Object.fromEntries(Object.entries(asset.gripPose.hands).map(([s,h])=>[s,{p:new Vector3(...h.wrist),q:new Quaternion(...h.wristQuaternion)}])):null,grips=contacts?{R:contacts.R.p,L:contacts.L.p}:asset.grips;
 const rightGoal=grips.R.clone().applyQuaternion(q).add(p),handFrame=q.clone().multiply(contacts?.R.q||new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI));
 pose.arm('R',rightGoal,new Vector3(-.7,1.04,.15),null,handFrame);
 // A fixed grip-to-wrist transform makes the right hand the weapon mount.
 // The model's skeleton stays actor-local (detached skinning), so this matrix
 // attachment is evaluated instead of parenting world-space scene bones.
 // Body-first mount: IK does not move the rifle away from its shoulder.
 pose.arm('L',grips.L.clone().applyQuaternion(q).add(p),new Vector3(.65,1.04,.15),null,contacts?q.clone().multiply(contacts.L.q):null);
 if(contacts)pose.fingerGrip={source:'common AK Idle / TriggerOnly',R:applySoldierAKGrip(pose.rig,'R',shotAge),L:applySoldierAKGrip(pose.rig,'L',shotAge)};
 if(!lowered){const head=pose.rig.byName.get('head'),neck=pose.rig.byName.get('neck');neck.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.55));head.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-.35));pose.rig.root.updateMatrixWorld(true);const eyeLocal=new Vector3(0,.057,.065),sightEye=new Vector3(...AK_MARKERS.sight).addScaledVector(sightGeometry('ak74m').sightAxis,-(STOCK_CONTACTS.ak74m[2]-.12-AK_MARKERS.sight[2])).applyQuaternion(q).add(p),actualEye=eyeLocal.applyMatrix4(head.matrixWorld),correction=sightEye.sub(actualEye);head.position.add(correction.applyQuaternion(head.parent.getWorldQuaternion(new Quaternion()).invert()));head.updateMatrixWorld(true);}
 pose.rig.root.updateMatrixWorld(true);pose.rig.skeleton.update();mesh.position.copy(p.clone().applyQuaternion(rotation).add(new Vector3(...actor.at)));mesh.quaternion.copy(rotation.multiply(q));mesh.userData.handAttachedBone='body shoulder';mesh.updateMatrixWorld(true);
 return {origin:new Vector3(...AK_MARKERS.muzzle).applyQuaternion(mesh.quaternion).add(mesh.position),breech:new Vector3(...AK_MARKERS.breech).applyQuaternion(mesh.quaternion).add(mesh.position),
  direction:zeroingDirection(sightGeometry('ak74m').sightAxis,mesh.quaternion,zeroingPreset('ak74m').thetaRad),rotation:mesh.quaternion.clone(),stockContact:new Vector3(...STOCK_CONTACTS.ak74m).applyQuaternion(mesh.quaternion).add(mesh.position)};
}

// The ejection-port marker is off the bore axis. The imported gun's physical
// barrel runs along local -Z; sight/zeroing corrections remain in shotPose only.
const ENEMY_BORE_AXIS=new Vector3(0,0,-1);
function enemyContacts(asset){return Object.fromEntries(Object.entries(asset.gripPose.hands).map(([side,h])=>[side,{p:new Vector3(...h.wrist),q:new Quaternion(...h.wristQuaternion)}]));}
function enemyGripCorrection(pose,contacts){
 if(pose.weaponGripCorrection)return;
 const wrist=pose.referenceBoneQuaternion('aim','rightHand'),neutral=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(),new Vector3(0,0,1),new Vector3(0,1,0)));
 // One-time rest-orientation calibration; playback state is never sampled or
 // reset here, and the common AK finger/wrist marker remains unchanged.
 pose.weaponGripCorrection=wrist.invert().multiply(neutral).multiply(contacts.R.q);
}
function enemyMount(actor,pose,contacts){
 const hand=pose.rig.byName.get('rightHand'),q=hand.getWorldQuaternion(new Quaternion()).multiply(contacts.R.q.clone().invert()),p=hand.getWorldPosition(new Vector3()).sub(contacts.R.p.clone().applyQuaternion(q));return{q,p};
}
function enemyWorldPose(actor,mesh){return{origin:new Vector3(...AK_MARKERS.muzzle).applyQuaternion(mesh.quaternion).add(mesh.position),breech:new Vector3(...AK_MARKERS.breech).applyQuaternion(mesh.quaternion).add(mesh.position),direction:zeroingDirection(sightGeometry('ak74m').sightAxis,mesh.quaternion,zeroingPreset('ak74m').thetaRad),rotation:mesh.quaternion.clone(),stockContact:new Vector3(...STOCK_CONTACTS.ak74m).applyQuaternion(mesh.quaternion).add(mesh.position)};}
function applyEnemyFixedGrip(pose,shotAge){pose.fingerGrip={source:'common AK Idle / TriggerOnly',R:applySoldierAKGrip(pose.rig,'R',shotAge),L:applySoldierAKGrip(pose.rig,'L',shotAge)};}
function finishEnemyMount(actor,pose,asset,mesh,{p,q,contacts,shotAge}){
 if(!pose.reload.active)pose.arm('L',contacts.L.p.clone().applyQuaternion(q).add(p),new Vector3(.65,1.04,.15),null,q.clone().multiply(contacts.L.q));
 applyEnemyFixedGrip(pose,shotAge);pose.rig.root.updateMatrixWorld(true);pose.rig.skeleton.update();const rotation=actorRotation(actor);mesh.position.copy(p.clone().applyQuaternion(rotation).add(new Vector3(...actor.at)));mesh.quaternion.copy(rotation.multiply(q));mesh.userData.handAttachedBone='rightHand';mesh.updateMatrixWorld(true);
 const result=enemyWorldPose(actor,mesh),rightActual=pose.point(actor,'rightHand'),leftActual=pose.point(actor,'leftHand'),rightGoal=contacts.R.p.clone().applyQuaternion(mesh.quaternion).add(mesh.position),leftGoal=contacts.L.p.clone().applyQuaternion(mesh.quaternion).add(mesh.position),barrel=ENEMY_BORE_AXIS.clone().applyQuaternion(mesh.quaternion),metrics={boreAxisSource:'imported gun local -Z; breech is ejection-port marker',leftHandGuardMetricSource:'left wrist to existing common AK handguard wrist marker; not glove-skin/mesh separation',rightHandMountMetricSource:'right wrist to existing common AK pistol-grip wrist marker',muzzleAngleDeg:barrel.angleTo(result.direction)*180/Math.PI,leftHandGuardErrorM:leftActual.distanceTo(leftGoal),rightHandMountErrorM:rightActual.distanceTo(rightGoal),leftIKReleased:!!pose.reload.active};
 pose.weaponMetrics=metrics;mesh.userData.animationMetrics={...metrics};return{...result,...metrics};
}
function aimEnemyCombatAK(actor,pose,asset,mesh,{target,lowered=false,recoil=0,shotAge=100}){
 const contacts=enemyContacts(asset);enemyGripCorrection(pose,contacts);pose.rig.byName.get('rightHand').quaternion.multiply(pose.weaponGripCorrection);pose.rig.root.updateMatrixWorld(true);
 const rotation=actorRotation(actor),localTarget=target.clone().sub(new Vector3(...actor.at)).applyQuaternion(rotation.clone().invert());
 if(!lowered&&!pose.reload.active){
  // Correct upper-body aim while keeping the rifle's mount on the animated
  // right wrist. The original shot origin and zeroing calculation are below.
  for(let i=0;i<5;i++){const mount=enemyMount(actor,pose,contacts),muzzle=new Vector3(...AK_MARKERS.muzzle).applyQuaternion(mount.q).add(mount.p),from=ENEMY_BORE_AXIS.clone().applyQuaternion(mount.q),to=localTarget.clone().sub(muzzle).normalize(),correction=new Quaternion().setFromUnitVectors(from,to);rotateWorld(pose.rig.byName.get('spine'),new Quaternion().slerp(correction,.35));rotateWorld(pose.rig.byName.get('chest'),new Quaternion().slerp(correction,.65));}
 }
 if(recoil&&!pose.reload.active)rotateWorld(pose.rig.byName.get('chest'),new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-recoil));
 const result=finishEnemyMount(actor,pose,asset,mesh,{...enemyMount(actor,pose,contacts),contacts,shotAge}),toward=target.clone().sub(result.origin).normalize(),aimMetrics={...pose.weaponMetrics,nominalAimTargetErrorDeg:result.direction.angleTo(toward)*180/Math.PI,visualAimTargetErrorDeg:ENEMY_BORE_AXIS.clone().applyQuaternion(mesh.quaternion).angleTo(toward)*180/Math.PI};pose.weaponMetrics=aimMetrics;mesh.userData.animationMetrics={...aimMetrics};return{...result,...aimMetrics};
}
export function alignCombatShotVisual(actor,pose,asset,mesh,event,{shotAge=0}={}){
 if(!pose.enemyAnimation)return{aligned:false};
 const contacts=enemyContacts(asset),priorMetrics=pose.weaponMetrics?{...pose.weaponMetrics}:{},priorNominal=enemyWorldPose(actor,mesh).direction,priorDirection=ENEMY_BORE_AXIS.clone().applyQuaternion(mesh.quaternion),delta=new Quaternion().setFromUnitVectors(priorDirection,event.direction),worldQ=delta.multiply(mesh.quaternion.clone()),worldP=event.origin.clone().sub(new Vector3(...AK_MARKERS.muzzle).applyQuaternion(worldQ)),inverse=actorRotation(actor).invert(),q=inverse.clone().multiply(worldQ),p=worldP.clone().sub(new Vector3(...actor.at)).applyQuaternion(inverse),rightGoal=contacts.R.p.clone().applyQuaternion(q).add(p);
 pose.arm('R',rightGoal,new Vector3(-.7,1.04,.15),null,q.clone().multiply(contacts.R.q));
 const result=finishEnemyMount(actor,pose,asset,mesh,{p,q,contacts,shotAge}),actual=ENEMY_BORE_AXIS.clone().applyQuaternion(mesh.quaternion),metrics={...priorMetrics,...pose.weaponMetrics,intentionalAIErrorDeg:priorNominal.angleTo(event.direction)*180/Math.PI,realizedAngleDeg:actual.angleTo(event.direction)*180/Math.PI,preAlignmentRealizedDiffDeg:priorDirection.angleTo(event.direction)*180/Math.PI,muzzlePivotErrorM:result.origin.distanceTo(event.origin),visualOnly:true};
 pose.weaponMetrics=metrics;mesh.userData.animationMetrics={...metrics};return{aligned:true,...metrics};
}
