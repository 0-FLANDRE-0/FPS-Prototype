import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3,Triangle } from 'three';
import { generateSoldierRig } from '../scripts/training-soldier-rig.mjs';
import { generateSoldierSkin,readGLB } from '../scripts/training-soldier-skin.mjs';
import { createSoldierRig } from '../apps/training/src/soldier-rig.js';
import { loadRigOnlyGLB,retargetMixamoIdle,debugRetargetPlayer } from '../apps/training/src/debug/retarget.js';
const prepare=async()=>{const native=await generateSoldierRig(),skin=await generateSoldierSkin(native.glb);return{native,skin,a:readGLB(native.glb),b:readGLB(skin.glb)};};
const posed=(p,j,w,rig)=>{const matrices=rig.bones.map(b=>rig.delta(b.name));return p.map((v,i)=>{const out=new Vector3();for(let k=0;k<4;k++)if(w[i][k])out.addScaledVector(new Vector3(...v).applyMatrix4(matrices[j[i][k]]),w[i][k]);return out;});};
test('visual repair preserves native v9 and original geometry/images, and mounts whole knee/shoulder equipment to the actual limb',async()=>{
 const{native,skin,a,b}=await prepare();assert.equal(native.meta.preparedSha256,'0ca0af733fd5c1bd6a601ce098ca7d3551442aa7605982c67819f5c71c4c6042');
 assert.deepEqual(b.g.skins,a.g.skins);assert.deepEqual(b.g.animations,a.g.animations);assert.deepEqual(b.g.materials,a.g.materials);assert.deepEqual(b.g.images,a.g.images);
 assert.deepEqual(b.binary.subarray(0,a.binary.length),a.binary);
 for(let i=0;i<5;i++){const p=a.g.meshes[i].primitives[0],q=b.g.meshes[i].primitives[0];for(const field of ['POSITION','NORMAL','TEXCOORD_0'])assert.deepEqual(b.access(q.attributes[field]),a.access(p.attributes[field]));assert.deepEqual(b.access(q.indices),a.access(p.indices));}
 const mounts=skin.meta.attachmentProof.filter(p=>p.material==='Vest'&&p.max[1]<.70);assert.equal(mounts.length,4);assert.equal(mounts.filter(p=>p.mode==='rigid').length,2);assert.equal(mounts.filter(p=>p.mode==='flexible-knee-wrap').length,2);
 assert.ok(mounts.filter(p=>p.mode==='rigid').every(p=>p.bone.endsWith('KneeCover')));
 const cloth=b.g.meshes.find(m=>m.name==='Body').primitives[0],clothJoints=b.access(cloth.attributes.JOINTS_0),clothWeights=b.access(cloth.attributes.WEIGHTS_0);assert.ok(skin.meta.clothKneeCoverRemovedVertices>0);
 assert.ok(clothJoints.every((row,i)=>row.every((id,k)=>clothWeights[i][k]===0||!b.g.nodes[b.g.skins[0].joints[id]].name.endsWith('KneeCover'))),'cloth must not inherit rigid pad rotation');
 const rig=createSoldierRig();try{
  for(const mount of skin.meta.attachmentProof.filter(p=>!p.mode||p.mode==='rigid')){const mesh=b.g.meshes.find(m=>m.name===mount.material).primitives[0],positions=b.access(mesh.attributes.POSITION),joints=b.access(mesh.attributes.JOINTS_0),weights=b.access(mesh.attributes.WEIGHTS_0);
   const ids=positions.flatMap((v,i)=>weights[i][0]===1&&rig.bones[joints[i][0]].name===mount.bone?[i]:[]);assert.ok(ids.length>=mount.vertices);
   for(const pose of ['standing','aim','crouch','walk']){rig.setPose(pose,.3);const transformed=posed(positions,joints,weights,rig);for(const i of ids)assert.ok(transformed[i].distanceTo(new Vector3(...positions[i]).applyMatrix4(rig.delta(mount.bone)))<1e-7);}
  }
 }finally{rig.dispose();}
});
test('authored inner uniform supplies the absent torso and keeps surface area through native poses and the full uploaded Idle',async()=>{
 const{b,skin}=await prepare();assert.equal(b.g.meshes.length,6);assert.equal(b.g.meshes[5].name,'TorsoUnderlayer');assert.equal(skin.meta.authoredTorso.provenance,'authored inner uniform surface; not original anatomy');
 const primitive=b.g.meshes[5].primitives[0],p=b.access(primitive.attributes.POSITION),j=b.access(primitive.attributes.JOINTS_0),w=b.access(primitive.attributes.WEIGHTS_0),ids=b.access(primitive.indices).flat(),rig=createSoldierRig();
 assert.ok(p.some(v=>v[1]>1.30&&Math.abs(v[0])>.14));
 const areas=[];for(let i=0;i<ids.length;i+=3)areas.push(new Triangle(...ids.slice(i,i+3).map(k=>new Vector3(...p[k]))).getArea());
 const check=label=>{const transformed=posed(p,j,w,rig);assert.ok(transformed.every(v=>v.toArray().every(Number.isFinite)));
  for(let i=0;i<ids.length;i+=3){const area=new Triangle(...ids.slice(i,i+3).map(k=>transformed[k])).getArea(),ratio=area/areas[i/3];assert.ok(ratio>.90&&ratio<1.10,`${label}: torso collapse/stretch ${ratio}`);}};
 try{for(const pose of ['rest','standing','aim','crouch','walk']){rig.setPose(pose,.3);check(pose);}
  const source=await loadRigOnlyGLB(await readFile(new URL('fixtures/models/military_tactical_suit_lowpolygameready.glb',import.meta.url))),result=retargetMixamoIdle(rig,source),player=debugRetargetPlayer(rig,result.clip);
  try{for(let t=0;t<result.clip.duration;t+=1/30){player.sample(t);check(`Idle ${t}`);}}finally{player.dispose();}
 }finally{rig.dispose();}
});
