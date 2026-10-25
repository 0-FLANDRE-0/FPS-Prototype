import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3, Matrix4, Triangle, Quaternion, Scene } from 'three';
import { generateSoldierRig, soldierSource } from '../scripts/training-soldier-rig.mjs';
import { BODY_MESH_REGIONS, BODY_MESH_SOURCE } from '../apps/training/src/generated/body-mesh.js';
import { SOLDIER_BONES, createSoldierRig, TARGET_POSES } from '../apps/training/src/soldier-rig.js';
import { BODY_PROFILE, HUMAN_TARGETS, shapePose, resolveBodyAddress, worldPoint, actorRotation, bodyMesh } from '../apps/training/src/human-targets.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { createArmorRegions } from '../apps/training/src/armor-model.js';
import { ARMOR_PROFILE, armorPose } from '../apps/training/src/armor-targets.js';
import { traceShot as traceWithProtection } from '../apps/training/src/ballistics.js';
import { shotBallistics } from '../apps/training/src/catalog.js';
import { cleanSettings } from '../apps/training/src/settings.js';
function parse(bytes){const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 const access=id=>{const a=g.accessors[id],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],w={5126:4,5125:4,5123:2}[a.componentType],fn={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE'}[a.componentType];
  return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*w)+j*w)));};return {g,bin,access};}
// Historical spatial fixtures: exercise geometry without the new protection execution.
const traceShot = (p,o,d,b,options={}) => traceWithProtection(p,o,d,b,{...options,geometryOnly:true});

const point=(m,i)=>new Vector3().fromArray(m.vertices,i*3);

test('derived GLB has a valid 24-joint skin and native clips, preserving source topology, UVs and image bytes',async()=>{
 const prepared=await generateSoldierRig(),again=await generateSoldierRig();assert.deepEqual(prepared.glb,again.glb);assert.deepEqual(prepared.regions,BODY_MESH_REGIONS);assert.deepEqual(prepared.meta,BODY_MESH_SOURCE);
 const original=parse(await readFile(new URL('../apps/training/assets/soldier-character.glb',import.meta.url))),rigged=parse(prepared.glb),source=await soldierSource();
 assert.equal(createHash('sha256').update(prepared.glb).digest('hex'),BODY_MESH_SOURCE.preparedSha256);assert.equal(rigged.g.skins[0].joints.length,24);assert.deepEqual(rigged.g.animations.map(a=>a.name),['standing','aim','crouch','walk']);assert.deepEqual(rigged.g.materials,original.g.materials);
 for(let i=0;i<original.g.images.length;i++){const a=original.g.bufferViews[original.g.images[i].bufferView],b=rigged.g.bufferViews[rigged.g.images[i].bufferView];assert.deepEqual(original.bin.subarray(a.byteOffset,a.byteOffset+a.byteLength),rigged.bin.subarray(b.byteOffset,b.byteOffset+b.byteLength));}
 const originalPrimitives=original.g.meshes.flatMap(m=>m.primitives),inverse=rigged.access(rigged.g.skins[0].inverseBindMatrices);
 for(let i=0;i<rigged.g.meshes.length;i++){const p=rigged.g.meshes[i].primitives[0],o=originalPrimitives[i];assert.deepEqual(rigged.access(p.indices),original.access(o.indices));assert.deepEqual(rigged.access(p.attributes.TEXCOORD_0),original.access(o.attributes.TEXCOORD_0));
  const positions=rigged.access(p.attributes.POSITION),joints=rigged.access(p.attributes.JOINTS_0),weights=rigged.access(p.attributes.WEIGHTS_0);
  for(let v=0;v<positions.length;v++){assert.ok(new Vector3(...positions[v]).distanceTo(source.meshes[i].positions[v])<1e-7);assert.ok(Math.abs(weights[v].reduce((a,b)=>a+b,0)-1)<1e-6);
   const skinned=new Vector3();for(let k=0;k<4;k++){assert.ok(joints[v][k]>=0&&joints[v][k]<SOLDIER_BONES.length);assert.ok(weights[v][k]>=0&&weights[v][k]<=1);
    const transform=new Matrix4().makeTranslation(...SOLDIER_BONES[joints[v][k]].at).multiply(new Matrix4().fromArray(inverse[joints[v][k]]));skinned.addScaledVector(new Vector3(...positions[v]).applyMatrix4(transform),weights[v][k]);}
   assert.ok(skinned.distanceTo(new Vector3(...positions[v]))<1e-6);
  }
 }
 for(const clip of rigged.g.animations)for(const channel of clip.channels){const sampler=clip.samplers[channel.sampler],times=rigged.access(sampler.input).flat();assert.ok(times.every((t,i)=>i===0||t>times[i-1]));assert.ok(rigged.g.skins[0].joints.includes(channel.target.node));
  if(channel.target.path==='rotation')for(const q of rigged.access(sampler.output))assert.ok(Math.abs(new Quaternion(...q).length()-1)<1e-6);}
});

test('all body regions are closed and outward; source ring samples and hand/boot hull vertices stay on the source',async()=>{
 const source=await soldierSource(),body=source.meshes.find(m=>m.material==='Body'),triangles=Array.from({length:body.indices.length/3},(_,i)=>new Triangle(...body.indices.slice(i*3,i*3+3).map(v=>body.positions[v])));
 assert.equal(BODY_PROFILE.length,21);assert.equal(BODY_PROFILE.filter(s=>s.joint).length,4);
 for(const[id,m]of Object.entries(BODY_MESH_REGIONS)){let volume=0;const edges=new Map();
  for(let i=0;i<m.indices.length;i+=3){const vs=m.indices.slice(i,i+3),[a,b,c]=vs.map(v=>point(m,v));volume+=a.dot(b.clone().cross(c))/6;
   for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const e=edges.get(key)||{n:0,orientation:0};e.n++;e.orientation+=a<b?1:-1;edges.set(key,e);}}
  assert.ok(volume>0,id);for(const e of edges.values()){assert.equal(e.n,2,id);assert.equal(e.orientation,0,id);}
  if(m.sourceMaterial==='Body'){
   if(m.fitting.sourceVertexIds)for(const[v,i]of m.fitting.sourceVertexIds.map((v,i)=>[v,i]))assert.ok(point(m,i).distanceTo(body.positions[v])<1e-10,id);
   if(m.fitting.sourceTrianglePerSample)for(const[v,i]of m.fitting.sourceTrianglePerSample.map((v,i)=>[v,i]))if(v!==null)assert.ok(triangles[v].closestPointToPoint(point(m,i),new Vector3()).distanceTo(point(m,i))<1e-9,id);
  }
 }
 for(const side of['left','right']){const hand=BODY_MESH_REGIONS[`${side}-hand`],foot=BODY_MESH_REGIONS[`${side}-foot`];assert.equal(hand.fitting.authoredSamples,0);assert.equal(foot.fitting.authoredSamples,0);assert.ok(hand.bounds.min[1]<.90);assert.equal(foot.bounds.min[1],0);assert.ok(foot.bounds.max[2]>.21);}
 assert.equal(BODY_MESH_REGIONS.chest.provenance,'authored-hidden-body');
});

test('pose skeleton uses stable joints, keeps crouch ankles fixed and restores the exact bind pose',()=>{
 const rig=createSoldierRig(),rest=rig.snapshot();
 try{for(const pose of Object.keys(TARGET_POSES)){rig.setPose(pose,.3);for(const j of rig.snapshot().joints)assert.ok(j.position.concat(j.rotation).every(Number.isFinite));}
  rig.setPose('crouch');for(const side of['left','right']){assert.ok(rig.byName.get(`${side}Foot`).getWorldPosition(new Vector3()).distanceTo(new Vector3(...SOLDIER_BONES.find(b=>b.name===`${side}Foot`).at))<1e-9);}
  const crouchHeight=rig.byName.get('head').getWorldPosition(new Vector3()).y;assert.ok(crouchHeight<1.3);
  rig.setPose('aim');for(const[s,sign]of[['left',1],['right',-1]])assert.ok(rig.byName.get(`${s}Hand`).getWorldPosition(new Vector3()).distanceTo(new Vector3(sign*.095,1.31,.46))<1e-9);
  rig.setPose('rest');assert.deepEqual(rig.snapshot(),rest);
 }finally{rig.dispose();}
});

test('posed body addresses use the inverse joint, rather than standing-world height thresholds',()=>{
 const actor={...HUMAN_TARGETS[0],yaw:Math.PI/3},shape=BODY_PROFILE.find(s=>s.id==='left-forearm'),rig=createSoldierRig(),local=new Vector3(.48,1.10,.025),incoming=new Vector3(0,0,-1);
 try{for(const pose of['standing','aim','crouch','walk']){rig.setPose(pose,.3);const matrix=rig.delta(shape.bone),p=worldPoint(actor,local.clone().applyMatrix4(matrix).toArray()),d=incoming.clone().transformDirection(matrix).applyQuaternion(actorRotation(actor));
   const address=resolveBodyAddress(actor,shape,p,d,rig);assert.equal(address.zone,'forearm');assert.equal(address.side,'front');assert.equal(address.bodyPart,'leftArm');assert.ok(new Vector3(...address.localPoint).distanceTo(local)<1e-9);assert.equal(address.pose,pose);}
 }finally{rig.dispose();}
});

test('Rapier observes the new pose immediately; every moving closed sensor shares render transforms',async()=>{
 const actor=HUMAN_TARGETS[0],p=await createPhysics(),rig=p.humanRigs.get(actor.id),view=createArmorRegions(new Scene(),{rigs:p.humanRigs});
 try{const hand=BODY_PROFILE.find(s=>s.id==='left-hand'),old=shapePose(actor,hand,rig).position;
  p.setHumanPose('standing');assert.notEqual(p.contact(old.clone().add(new Vector3(0,0,1)),new Vector3(0,0,-1),2)?.kind,'human');
  for(const pose of['rest','standing','aim','crouch','walk']){p.setHumanPose(pose,.3);view.syncPose();
   for(const sensor of p.humanSensors){const transform=shapePose(actor,sensor.shape,rig);assert.ok(new Vector3(...Object.values(sensor.collider.translation())).distanceTo(transform.position)<1e-6);
    const data=bodyMesh(sensor.shape);assert.equal(sensor.collider.isSensor(),true);assert.deepEqual(sensor.collider.vertices(),data.vertices);
    const excluded=new Set([...p.surface.keys()].filter(handle=>handle!==sensor.collider.handle)),direction=new Vector3(0,0,-1).applyQuaternion(transform.rotation),ray=transform.position.clone().addScaledVector(direction,-.6);
    const hit=p.contact(ray,direction,1.2,excluded);assert.equal(hit.address.shapeId,sensor.shape.id,pose+':'+sensor.shape.id);assert.equal(hit.address.bodyPart,sensor.shape.part);}
   for(const sensor of p.armorSensors){const transform=armorPose(actor,sensor.shape,rig);assert.ok(new Vector3(...Object.values(sensor.collider.translation())).distanceTo(transform.position)<1e-6);assert.ok(sensor.pose.position.distanceTo(transform.position)<1e-12);}
   for(const target of view.snapshot().targets)for(const shape of target.shapes){const definition=ARMOR_PROFILE.shapes.find(s=>s.id===shape.id),transform=armorPose(actor,definition,rig);assert.ok(new Vector3(...shape.position).distanceTo(transform.position)<1e-9);}
  }
 }finally{view.dispose();p.dispose();}
});

test('posed coverage is observational: original residuals, RNG and eight medical keys stay intact',async()=>{
 const p=await createPhysics(),plain=await createPhysics({armorProfile:null}),ammo=shotBallistics('556_m855');
 try{for(const pose of['rest','aim','crouch','walk']){p.setHumanPose(pose,.3);plain.setHumanPose(pose,.3);const chest=shapePose(HUMAN_TARGETS[0],BODY_PROFILE.find(s=>s.id==='chest'),p.humanRigs.get('H01'));
  const d=new Vector3(0,0,-1).applyQuaternion(chest.rotation),origin=chest.position.clone().addScaledVector(d,-2);const run=p=>{let draws=0;const shot=traceShot(p,origin,d,ammo,{random:()=>{draws++;return .5;}});return {...shot,draws};};
  const a=run(p),b=run(plain);assert.equal(a.hit.kind,'human');assert.deepEqual(a.residual,b.residual);assert.equal(a.draws,b.draws);assert.equal(a.residual.velocityMps,ammo.muzzleVelocityMps);assert.equal(a.events.length,0);}
 }finally{p.dispose();plain.dispose();}
 for(const targetPose of ['rest','standing','aim','crouch','walk','invalid'])assert.equal(cleanSettings({targetPose,skeletonRegions:true}).targetPose,'rest');
 assert.equal(cleanSettings({targetPose:'walk',skeletonRegions:true}).skeletonRegions,true);assert.equal(cleanSettings({skeletonRegions:'true'}).skeletonRegions,false);
});
