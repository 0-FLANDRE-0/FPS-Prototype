// M4-only arms/animations; retain the existing M4A1 gameplay and gun geometry.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {readGLB} from './training-soldier-skin.mjs';
import {rigOnly,packGLB,compactAccessors} from './training-fps-model.mjs';
import {compressGLB,WEBP_POLICY} from './training-webp.mjs';
import {M4_ATTACHMENTS} from '../apps/training/src/weapon-data.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function generateM4Arms(){
 const source=await readFile('apps/training/assets/source/animated_fps_m4a4.glb'),sourceSHA256=hash(source);
 assert.equal(sourceSHA256,'0e0a35ce7405386725486159ec0b216fa94630523f8381f083c40b46a254faa0');
 const generatorSHA256=hash(Buffer.concat([await readFile(new URL(import.meta.url)),Buffer.from(JSON.stringify(WEBP_POLICY)),Buffer.from(JSON.stringify(M4_ATTACHMENTS))]));
 const cached=JSON.parse(await readFile('dist/training-m4-arms-info.json','utf8').catch(()=>'{}'));
 if(cached.generatorSHA256===generatorSHA256&&cached.sourceSHA256===sourceSHA256){const glb=await readFile('dist/m4-arms-webp.glb').catch(()=>null);if(glb&&hash(glb)===cached.texture.sha256)return{glb,meta:cached};}
 const gltf=await rigOnly(source),scene=gltf.scene,mixer=new T.AnimationMixer(scene),shot=gltf.animations.find(a=>a.name.endsWith('|Shoot'));
 const action=mixer.clipAction(shot);action.play();mixer.setTime(0);scene.updateMatrixWorld(true);
 // Only the rifle's orientation is needed. The supplied gun geometry has an
 // export scale/offset mismatch and is deliberately excluded from the derivative.
 const gun=scene.getObjectByName('Object_130'),points=Array.from({length:gun.geometry.attributes.position.count},(_,i)=>gun.getVertexPosition(i,new T.Vector3()).applyMatrix4(gun.matrixWorld));
 const mean=points.reduce((v,p)=>v.add(p),new T.Vector3()).divideScalar(points.length),cov=Array(9).fill(0);
 for(const p of points){const v=p.clone().sub(mean).toArray();for(let i=0;i<3;i++)for(let j=0;j<3;j++)cov[i*3+j]+=v[i]*v[j];}
 let forward=new T.Vector3(0,0,1);for(let i=0;i<40;i++){const v=forward.toArray();forward.set(...[0,1,2].map(row=>cov[row*3]*v[0]+cov[row*3+1]*v[1]+cov[row*3+2]*v[2])).normalize();}
 if(forward.z<0)forward.negate();
 const right=new T.Vector3().crossVectors(forward,new T.Vector3(0,1,0)).normalize(),up=new T.Vector3().crossVectors(right,forward).normalize();
 const rotation=new T.Matrix4().makeBasis(right,up,forward.clone().negate()).invert(),nativeGrip=scene.getObjectByName('HandR_06').getWorldPosition(new T.Vector3()).applyMatrix4(rotation);
 const normalization=new T.Matrix4().makeTranslation(...new T.Vector3(...M4_ATTACHMENTS.rightGrip).sub(nativeGrip).toArray()).multiply(rotation);
 const {g,binary}=readGLB(source),keep=new Set([0,1,2,3,6,7,122,124,126,128,...g.skins[0].joints]),index=new Map();
 g.nodes.forEach((n,i)=>{if(keep.has(i))index.set(i,index.size);});
 g.nodes=g.nodes.filter((n,i)=>keep.has(i)).map(n=>({...n,...(n.children?{children:n.children.filter(i=>index.has(i)).map(i=>index.get(i))}:{}),...(n.mesh!==undefined?{mesh:n.mesh}:{})}));
 for(const skin of g.skins){skin.joints=skin.joints.map(i=>index.get(i));skin.skeleton=index.get(skin.skeleton);}
 for(const a of g.animations){a.channels=a.channels.filter(c=>index.has(c.target.node));const samplerIndices=[...new Set(a.channels.map(c=>c.sampler))],map=new Map(samplerIndices.map((v,i)=>[v,i]));a.samplers=samplerIndices.map(i=>a.samplers[i]);for(const c of a.channels){c.target.node=index.get(c.target.node);c.sampler=map.get(c.sampler);}}
 g.meshes=g.meshes.slice(0,4);g.materials=g.materials.slice(0,3);g.images=g.images.slice(0,6);g.textures=g.textures.slice(0,6);
 const used=new Set();for(const m of g.meshes)for(const p of m.primitives){used.add(p.indices);for(const i of Object.values(p.attributes))used.add(i);}for(const skin of g.skins)used.add(skin.inverseBindMatrices);for(const a of g.animations)for(const s of a.samplers){used.add(s.input);used.add(s.output);}
 const accessorIndices=[...used].sort((a,b)=>a-b),remap=new Map(accessorIndices.map((v,i)=>[v,i]));g.accessors=accessorIndices.map(i=>g.accessors[i]);
 for(const m of g.meshes)for(const p of m.primitives){p.indices=remap.get(p.indices);for(const k of Object.keys(p.attributes))p.attributes[k]=remap.get(p.attributes[k]);}for(const skin of g.skins)skin.inverseBindMatrices=remap.get(skin.inverseBindMatrices);for(const a of g.animations)for(const s of a.samplers){s.input=remap.get(s.input);s.output=remap.get(s.output);}
 const wrapper=g.nodes.length;g.nodes.push({name:'M4_Arms_Meter_Frame',matrix:normalization.toArray(),children:[index.get(0)]});g.scenes=[{name:'Training_M4_Arms',nodes:[wrapper]}];g.scene=0;delete g.cameras;
 g.asset.extras={...g.asset.extras,changes:'Arms/hand meshes and four original clips retained; gun/display/camera nodes and unused accessors removed; canonical meter frame; image-only WebP conversion.',training:{normalization:normalization.toArray(),rightGrip:M4_ATTACHMENTS.rightGrip}};
 const compact=compactAccessors(g,binary),prepared=packGLB(g,compact.binary);await writeFile('dist/m4-arms-training.glb',prepared);
 const optimized=await compressGLB(prepared,{name:'m4-arms',output:'dist/m4-arms-webp.glb'});
 const clips=g.animations.map(a=>({name:a.name.split('|')[1],duration:Math.max(...a.samplers.map(s=>g.accessors[s.input].max[0]))}));
 const meta={generatorSHA256,sourceBytes:source.length,sourceSHA256,sourceCredits:g.asset.extras,preparedBytes:prepared.length,preparedSHA256:hash(prepared),meshCount:4,triangles:g.meshes.reduce((n,m)=>n+m.primitives.reduce((sum,p)=>sum+g.accessors[p.indices].count/3,0),0),skinJoints:113,clips,normalization:normalization.toArray(),sourceBarrelDirection:forward.toArray(),gunExcluded:true,existingM4A1Geometry:true,losslessPacking:compact.proof,texture:optimized.meta};
 await writeFile('dist/training-m4-arms-info.json',JSON.stringify(meta,null,2)+'\n');return{glb:optimized.glb,meta};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const r=await generateM4Arms();console.log(JSON.stringify({bytes:r.glb.length,triangles:r.meta.triangles,clips:r.meta.clips,packing:r.meta.losslessPacking},null,2));}
