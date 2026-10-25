import{freezeMesh}from'./equipment-world.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {Box3,Vector3,Quaternion,Group} from 'three';
import {WEAPONS} from './weapon-data.js';
const V=v=>new Vector3(v.x,v.y,v.z),Q=q=>new Quaternion(q.x,q.y,q.z,q.w);
export const PLAYER_DROP=Object.freeze({bodyCollisionGraceS:.20});
export class PlayerWeaponDrop{
 constructor(scene,physics,weapon,ak){
  Object.assign(this,{scene,physics,weapon});this.rows=new Map();this.active=null;
  const source=weapon.rig.getObjectByName('M4A1'),m4=source.clone(true),pairs=[];
  function match(a,b){pairs.push({source:a,clone:b});for(let i=0;i<a.children.length;i++)match(a.children[i],b.children[i]);}match(source,m4);
  const scar=new Group();weapon.rig.updateMatrixWorld(true);for(const m of weapon.fps.scar?.meshes||[])if(m.visible)scar.add(freezeMesh(m,{relative:weapon.rig.matrixWorld.clone().invert()}));
  for(const [id,mesh]of [['m4a1',m4],['ak74m',ak.mesh()],...(weapon.fps.scar?[['scar_h',scar]]:[])]){
   const root=new Group();root.add(mesh);root.updateMatrixWorld(true);const bounds=id==='ak74m'?ak.bounds.clone():new Box3().setFromObject(root),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3()),body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setLinearDamping(.25).setAngularDamping(.6).setCcdEnabled(true));
   const collider=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setTranslation(...center.toArray()).setMass(WEAPONS[id].physical.weightKg).setSensor(true).setCollisionGroups(0).setFriction(.8).setRestitution(.08),body);
   physics.surface.set(collider.handle,{id:'P01:dropped-'+id,kind:'human-movement'});body.recomputeMassPropertiesFromColliders();root.visible=false;root.name='Player dropped '+id;scene.add(root);this.rows.set(id,{mesh:root,body,collider,size,center,pairs:id==='m4a1'?pairs:[]});
  }
 }
 drop(player,inventory){
  if(this.active||!inventory?.weapon)return false;const row=this.rows.get(inventory.weapon.definitionId);if(!row)return false;
  if(inventory.weapon.definitionId==='scar_h')for(const m of row.mesh.children[0].children)if(/76251_ar10/.test(m.name))m.visible=Boolean(inventory.magazine)&&(/20rnd_\(/.test(m.name)===Boolean(inventory.magazine.rounds.length));
  for(const {source,clone}of row.pairs){clone.position.copy(source.position);clone.quaternion.copy(source.quaternion);clone.scale.copy(source.scale);clone.matrix.copy(source.matrix);clone.visible=source.visible;}
  const rig=this.weapon.rig,scale=rig.scale.x;row.mesh.position.copy(rig.position);row.mesh.quaternion.copy(rig.quaternion);row.mesh.scale.setScalar(scale);row.mesh.visible=true;
  row.body.setTranslation(rig.position,true);row.body.setRotation(rig.quaternion,true);row.collider.setShape(new RAPIER.Cuboid(row.size.x*scale/2,row.size.y*scale/2,row.size.z*scale/2));row.collider.setTranslationWrtParent(row.center.clone().multiplyScalar(scale));row.collider.setMass(inventory.weaponWeightKg);row.body.recomputeMassPropertiesFromColliders();row.collider.setSensor(false);row.collider.setCollisionGroups((32<<16)|1);row.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);row.ageS=0;
  const motion=player.pose.velocities().get('rightHand')||{linear:new Vector3(),angular:new Vector3()},hand=player.pose.point(player.actor,'rightHand'),com=V(row.body.worldCom());row.body.setLinvel(motion.linear.clone().add(motion.angular.clone().cross(com.sub(hand))),true);row.body.setAngvel(motion.angular,true);row.massKg=inventory.weaponWeightKg;this.active=row;this.sync();return true;
 }
 sync(dt=0){const r=this.active;if(!r)return;r.ageS+=dt;if(r.ageS>=PLAYER_DROP.bodyCollisionGraceS)r.collider.setCollisionGroups(0xffffffff);if(r.body.isSleeping())return;r.mesh.position.copy(V(r.body.translation()));r.mesh.quaternion.copy(Q(r.body.rotation()));r.mesh.updateMatrixWorld(true);}
 snapshot(){const r=this.active;return r?{weaponId:[...this.rows].find(([,v])=>v===r)[0],massKg:r.massKg,position:V(r.body.translation()).toArray(),rotation:Q(r.body.rotation()).toArray(),sleeping:r.body.isSleeping()}:null;}
 dispose(){for(const r of this.rows.values()){this.physics.surface.delete(r.collider.handle);this.physics.world.removeRigidBody(r.body);r.mesh.removeFromParent();}this.rows.clear();}
}
