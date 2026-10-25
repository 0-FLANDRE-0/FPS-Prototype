import {Vector3,Quaternion,Matrix4} from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {AK_MARKERS,STOCK_CONTACTS} from './weapon-data.js';
import {actorRotation} from './human-targets.js';
import {SOLDIER_EYE_LOCAL} from './combat-pose.js';
import {rotateWorld,solveArm} from './arm-ik.js';
import {applySoldierAKGrip} from './soldier-grip.js';
import {sightGeometry} from './sight-geometry.js';
import {zeroingDirection,zeroingPreset} from './zeroing.js';
import {shotBallistics} from './catalog.js';
import {shooterPhysics} from './combat-physics.js';
import {traceShot} from './ballistics.js';
import {LONG_RANGE} from './config.js';
const V=a=>new Vector3(...a),UP=new Vector3(0,1,0),ZERO=new Vector3();
export function applyAILean(pose,value,{actor=null,physics=null}={}){
 const requested=value;let collision=null;if(!value)return{requested,value:0,collision:null};const r=pose.rig,feet=['left','right'].map(s=>({s,p:r.byName.get(s+'Foot').getWorldPosition(new Vector3())}));
 if(actor&&physics){const pivot=r.byName.get('pelvis').getWorldPosition(new Vector3()),head=r.byName.get('head').getWorldPosition(new Vector3()),bodyQ=actorRotation(actor),start=head.clone().applyQuaternion(bodyQ).add(V(actor.at)),end=head.clone().sub(pivot).applyAxisAngle(V([0,0,1]),value*12*Math.PI/180).add(pivot).applyQuaternion(bodyQ).add(V(actor.at)),delta=end.sub(start),length=delta.length();if(length>1e-8){const hit=physics.world.castShape(start,new Quaternion(),delta.divideScalar(length),new RAPIER.Ball(.12),0,length,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,physics.collider,physics.body,c=>physics.surface.get(c.handle)?.id!==actor.id);if(hit){value*=Math.max(0,Math.min(1,(hit.time_of_impact-.02)/length));collision={distanceM:hit.time_of_impact,id:physics.surface.get(hit.collider.handle)?.id};}}}
 const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),value*12*Math.PI/180);rotateWorld(r.byName.get('pelvis'),q);r.root.updateMatrixWorld(true);
 for(const{s,p}of feet)solveArm(r.byName.get(s+'UpperLeg'),r.byName.get(s+'LowerLeg'),r.byName.get(s+'Foot'),p,p.clone().add(new Vector3(0,.4,.5)));r.root.updateMatrixWorld(true);return{requested,value,collision};
}
// Body first -> butt pocket -> gun attitude -> both arm IK. Hands never drive
// weapon placement. These pocket/ready offsets are authored stance tuning.
export function mountAI1AK(actor,pose,asset,mesh,{rotation,style='ads',lowered=false,lean=0,shotAge=100}){
 const bodyQ=actorRotation(actor),inverse=bodyQ.clone().invert(),chestQ=pose.rig.byName.get('chest').getWorldQuaternion(new Quaternion()),shoulder=pose.rig.byName.get('rightClavicle').getWorldPosition(new Vector3()),pocket=shoulder.clone().add(V([.045,.09,.075]).applyQuaternion(chestQ));
 let q=inverse.clone().multiply(rotation),stock=pocket.clone();
 if(lowered){const d=V([0,-.5,.866]);q.setFromRotationMatrix(new Matrix4().lookAt(ZERO,d,UP));}
 else if(style==='hip')stock.add(V([.01,-.23,.03]).applyQuaternion(chestQ));
 if(lean)q.premultiply(new Quaternion().setFromAxisAngle(V([0,0,1]),lean*12*Math.PI/180));
 const p=stock.clone().sub(V(STOCK_CONTACTS.ak74m).applyQuaternion(q)),geometry=sightGeometry('ak74m');
 // Rotate the existing neck, without translating/scaling head or torso. Choose
 // the reachable eye point on the sight line (sphere/line intersection).
 if(style==='ads'&&!lowered){const neck=pose.rig.byName.get('neck'),head=pose.rig.byName.get('head'),n=neck.getWorldPosition(new Vector3()),eye=V(SOLDIER_EYE_LOCAL).applyMatrix4(head.matrixWorld),line=geometry.rear.clone().applyQuaternion(q).add(p),axis=geometry.sightAxis.clone().applyQuaternion(q),r=eye.distanceTo(n),closest=line.clone().addScaledVector(axis,n.clone().sub(line).dot(axis)),d2=closest.distanceToSquared(n);let goal=closest;
  if(d2<=r*r){const h=Math.sqrt(Math.max(0,r*r-d2)),a=closest.clone().addScaledVector(axis,h),b=closest.clone().addScaledVector(axis,-h);goal=a.distanceTo(eye)<b.distanceTo(eye)?a:b;}
  const turn=new Quaternion().setFromUnitVectors(eye.clone().sub(n).normalize(),goal.clone().sub(n).normalize());rotateWorld(neck,turn);pose.rig.root.updateMatrixWorld(true);
 }
 const hands=asset.gripPose.hands;
 for(const side of ['R','L']){if(side==='L'&&pose.reload?.active)continue;const h=hands[side],goal=V(h.wrist).applyQuaternion(q).add(p);pose.arm(side,goal,V([side==='R'?-.65:.65,1.05,.2]),null,q.clone().multiply(new Quaternion(...h.wristQuaternion)));}
 pose.fingerGrip={source:'common AK Idle / TriggerOnly',R:applySoldierAKGrip(pose.rig,'R',shotAge),L:applySoldierAKGrip(pose.rig,'L',shotAge)};pose.rig.root.updateMatrixWorld(true);pose.rig.skeleton.update();mesh.position.copy(p.applyQuaternion(bodyQ).add(V(actor.at)));mesh.quaternion.copy(bodyQ.multiply(q));mesh.updateMatrixWorld(true);mesh.userData.handAttachedBone='body shoulder pocket';
 const world=v=>V(v).applyQuaternion(mesh.quaternion).add(mesh.position),origin=world(AK_MARKERS.muzzle),stockContact=world(STOCK_CONTACTS.ak74m),line=world(AK_MARKERS.sight),axis=geometry.sightAxis.clone().applyQuaternion(mesh.quaternion),eye=pose.eye(actor),eyeLineDistanceM=eye.clone().sub(line).cross(axis).length(),pocketWorld=pocket.applyQuaternion(actorRotation(actor)).add(V(actor.at));
 const metrics={mount:'body first; shoulder pocket before IK',style,stockPocketDistanceM:stockContact.distanceTo(pocketWorld),eyeLineDistanceM,eyeReliefM:line.clone().sub(eye).dot(axis),rightHandMountErrorM:pose.handErrors.R?.distanceM??null,leftHandGuardErrorM:pose.handErrors.L?.distanceM??null,leftIKReleased:!!pose.reload?.active,lean};pose.weaponMetrics=metrics;
 return{origin,breech:world(AK_MARKERS.breech),direction:zeroingDirection(geometry.sightAxis,mesh.quaternion,zeroingPreset('ak74m').thetaRad),rotation:mesh.quaternion.clone(),stockContact,...metrics};
}
export function fireAI1({physics,actor,pose,shotId,time,velocity}){
 const scope=shooterPhysics(physics,actor.id),ballistics=shotBallistics('545_ps_gs','ak74m');if(scope.muzzleBlocked(pose.stockContact,pose.origin,pose.direction))return null;
 // Same as main.fire: physical shotPose direction goes directly into traceShot.
 const trace=traceShot(scope,pose.origin,pose.direction,ballistics,{shotId,simulateFlight:true,bodyModel:'s2',maxDistance:LONG_RANGE.maxShotDistance});return{shotId,time,ammoId:'545_ps_gs',ballistics,origin:pose.origin.clone(),breech:pose.breech.clone(),direction:pose.direction.clone(),rotation:pose.rotation.clone(),shooterVelocity:velocity.clone(),trace,hit:trace.hit};
}
