import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {actorRotation} from './human-targets.js';
import {PLAYER_BODY_LAYER} from './combat-pose.js';
export const PLAYER_FALL=Object.freeze({cameraRadiusM:.035,cameraClearanceM:.008,minimumInterfaceS:1.8,maximumInterfaceS:4.5,supportedS:.20,passiveAngularDamping:3,passiveLinearDamping:2});
const V=v=>new Vector3(v.x,v.y,v.z),Q=q=>new Quaternion(q.x,q.y,q.z,q.w);

// Only first-person rendering omits the wearer's face/helmet. Original GLB,
// shared NPC geometry, head hit shapes and protection are never modified.
export function maskPlayerHead(group,rig){
 const hidden=new Set(rig.bones.map((b,i)=>/^(head|neck)$/.test(b.name)?i:-1).filter(i=>i>=0)),owned=[],rows=[];
 group.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const original=mesh.geometry,index=original.index,skin=original.attributes.skinIndex,weights=original.attributes.skinWeight,keep=[];
  const headWeight=v=>{let sum=0;for(let j=0;j<4;j++)if(hidden.has(skin.getComponent(v,j)))sum+=weights.getComponent(v,j);return sum;};
  const count=index?index.count:original.attributes.position.count;
  for(let i=0;i<count;i+=3){const tri=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(!tri.some(v=>headWeight(v)>.45))keep.push(...tri);}
  if(keep.length===count)return;
  const geometry=original.clone();geometry.setIndex(keep);mesh.geometry=geometry;owned.push({mesh,original,geometry});rows.push({mesh:mesh.name,originalTriangles:count/3,firstPersonTriangles:keep.length/3});
 });
 return{rows,dispose(){for(const {mesh,original,geometry}of owned){mesh.geometry=original;geometry.dispose();}}};
}

// Continue the actual locomotion blend while retaining the proxy's eye/hand/leg
// corrections at the handoff. This is an animation target, not another skeleton
// driving the visible body after activation.
export function playerCollapseStream(player,locomotion){
 const source=locomotion.pose.captureCollapseStream(),initial=locomotion.rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),corrections=player.rig.bones.map((b,i)=>({p:b.position.clone().sub(initial[i].p),q:initial[i].q.clone().invert().multiply(b.quaternion)}));
 return{moving:source.moving,clipName:source.clipName,advance(dt){return source.advance(dt).map((r,i)=>({p:r.p.clone().add(corrections[i].p),q:r.q.clone().multiply(corrections[i].q)}));}};
}

export class PlayerFallView{
 constructor(player,physics,camera){
  this.player=player;this.physics=physics;this.elapsedS=0;this.supportedS=0;this.interfaceReady=false;this.constraintM=0;
  const head=this.head();this.eyeLocal=camera.position.clone().sub(head.position).applyQuaternion(head.rotation.clone().invert());this.lookLocal=head.rotation.clone().invert().multiply(camera.quaternion);
  this.previous={position:camera.position.clone(),rotation:camera.quaternion.clone()};this.current={position:camera.position.clone(),rotation:camera.quaternion.clone()};
  this.initialEye=camera.position.toArray();this.initialRotation=camera.quaternion.toArray();this.capture(0);
 }
 head(){const p=this.player,bone=p.rig.byName.get('head');return{position:p.pose.point(p.actor,'head'),rotation:actorRotation(p.actor).multiply(bone.getWorldQuaternion(new Quaternion()))};}
 cast(from,to){
  const delta=to.clone().sub(from),length=delta.length();if(length<1e-8)return null;
  const {world,surface}=this.physics,id=this.player.actor.id,hit=world.castShape(from,{x:0,y:0,z:0,w:1},delta.divideScalar(length),new RAPIER.Ball(PLAYER_FALL.cameraRadiusM),0,length,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.physics.collider,this.physics.body,c=>{const owner=surface.get(c.handle)?.id;return owner!==id&&!owner?.startsWith(id+':dropped-');});
  return hit?{distance:Math.max(0,hit.time_of_impact-PLAYER_FALL.cameraClearanceM),length}:null;
 }
 capture(dt){
  this.elapsedS+=dt;this.previous.position.copy(this.current.position);this.previous.rotation.copy(this.current.rotation);
  const head=this.head(),eye=this.eyeLocal.clone().applyQuaternion(head.rotation).add(head.position),origin=V(this.player.ragdoll.parts.get('head').body.worldCom()),occlusion=this.cast(origin,eye);
  this.constraintM=0;if(occlusion){const goal=eye.clone().sub(origin).normalize().multiplyScalar(Math.min(occlusion.length,occlusion.distance)).add(origin);this.constraintM=eye.distanceTo(goal);eye.copy(goal);}
  const sweep=this.cast(this.previous.position,eye);if(sweep){const goal=eye.clone().sub(this.previous.position).normalize().multiplyScalar(Math.min(sweep.length,sweep.distance)).add(this.previous.position);this.constraintM=Math.max(this.constraintM,eye.distanceTo(goal));eye.copy(goal);}
  this.current.position.copy(eye);this.current.rotation.copy(head.rotation).multiply(this.lookLocal);
  const r=this.player.ragdoll,pelvis=r.parts.get('pelvis').body.translation(),chest=r.parts.get('chest').body.translation(),neck=r.parts.get('neck').body.translation(),headP=r.parts.get('head').body.translation();
  const handles=[];for(const name of ['pelvis','spine','chest','head'])this.physics.world.contactPairsWith(r.parts.get(name).collider,c=>handles.push(c.handle));
  const contacts=handles.filter(h=>{const c=this.physics.world.getCollider(h);return c&&!c.isSensor()&&!c.parent()?.isDynamic();});
  const torso=new Vector3(neck.x-pelvis.x,neck.y-pelvis.y,neck.z-pelvis.z),lying=Math.abs(torso.y)/Math.max(1e-6,torso.length())<.65&&headP.y<.75&&chest.y<.65;
  this.supportedS=lying&&contacts.length?this.supportedS+dt:0;
  this.interfaceReady=this.elapsedS>=PLAYER_FALL.minimumInterfaceS&&this.supportedS>=PLAYER_FALL.supportedS||this.elapsedS>=PLAYER_FALL.maximumInterfaceS;
  this.lying=lying;this.supported=contacts.length>0;
 }
 apply(camera,alpha){camera.position.lerpVectors(this.previous.position,this.current.position,alpha);camera.quaternion.slerpQuaternions(this.previous.rotation,this.current.rotation,alpha);camera.layers.enable(PLAYER_BODY_LAYER);}
 snapshot(){return{elapsedS:this.elapsedS,interfaceReady:this.interfaceReady,lying:this.lying,supported:this.supported,supportedS:this.supportedS,eyeLocal:this.eyeLocal.toArray(),lookLocal:this.lookLocal.toArray(),previousEye:this.previous.position.toArray(),eye:this.current.position.toArray(),rotation:this.current.rotation.toArray(),initialEye:this.initialEye,initialRotation:this.initialRotation,collisionRestrictionM:this.constraintM};}
}
