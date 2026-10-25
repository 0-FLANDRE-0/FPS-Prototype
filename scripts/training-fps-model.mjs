// W: source-preserving, meter-scaled FPS derivative. No gameplay authority.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readGLB} from './training-soldier-skin.mjs';
import {compressGLB,WEBP_POLICY} from './training-webp.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export function packGLB(g,binary){let j=Buffer.from(JSON.stringify(g));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const b=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]),h=Buffer.alloc(20),c=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+b.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);c.writeUInt32LE(b.length,0);c.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,c,b]);}
export async function rigOnly(bytes){const {g,binary}=readGLB(bytes);for(const m of g.meshes)for(const p of m.primitives)delete p.material;delete g.materials;delete g.images;delete g.textures;delete g.extensionsUsed;delete g.extensionsRequired;g.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');globalThis.ProgressEvent??=class{};return new GLTFLoader().parseAsync(JSON.stringify(g),'');}
// Lossless accessor packing: repeated clip times/constants share the same bytes.
// No decimation, quantization, resampling or material changes.
export function compactAccessors(g,binary){
 const oldViews=g.bufferViews,views=[],chunks=[],shared=new Map();let offset=0;
 const widths={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 const tight=a=>{assert.ok(!a.sparse);const view=oldViews[a.bufferView],width=widths[a.componentType]*counts[a.type],stride=view.byteStride||width,out=Buffer.alloc(width*a.count),start=(view.byteOffset||0)+(a.byteOffset||0);assert.ok(width);for(let i=0;i<a.count;i++)binary.copy(out,i*width,start+i*stride,start+i*stride+width);return out;};
 const originals=g.accessors.map(tight);
 const add=(bytes,target)=>{const key=(target||0)+':'+hash(bytes);if(shared.has(key))return shared.get(key);const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const index=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);offset+=bytes.length;shared.set(key,index);return index;};
 g.accessors.forEach((a,i)=>{a.bufferView=add(originals[i],oldViews[a.bufferView].target);delete a.byteOffset;});
 for(const image of g.images){const v=oldViews[image.bufferView];image.bufferView=add(binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}
 g.bufferViews=views;g.buffers=[{byteLength:offset}];const packed=Buffer.concat(chunks);
 // Verify every accessor byte, including all keys, skin weights and indices.
 g.accessors.forEach((a,i)=>{const v=views[a.bufferView];assert.deepEqual(packed.subarray(v.byteOffset,v.byteOffset+v.byteLength),originals[i]);});
 return{binary:packed,proof:{accessors:originals.length,everyAccessorBytesExact:true,sourceBinaryBytes:binary.length,packedBinaryBytes:packed.length,savedBytes:binary.length-packed.length,uniqueViews:views.length}};
}
export async function generateFPS(){
 const source=await readFile(new URL('apps/training/assets/source/fps_ak-74m_animations.glb',root));assert.equal(hash(source),'8eeb18cbe047e8cbbe24084828f39ba625a6f3c1a1062a37d7a978e8cd7d0533');
 const generatorSHA256=hash(Buffer.concat([await readFile(new URL(import.meta.url)),Buffer.from(JSON.stringify(WEBP_POLICY))]));
 const cached=JSON.parse(await readFile(new URL('dist/training-fps-info.json',root),'utf8').catch(()=>'{}'));
 if(cached.generatorSHA256===generatorSHA256&&cached.sourceSHA256===hash(source)){
   const glb=await readFile(new URL('dist/fps-ak74m-webp.glb',root)).catch(()=>null),prepared=await readFile(new URL('dist/fps-ak74m-training.glb',root)).catch(()=>null);
   if(glb&&prepared&&hash(glb)===cached.texture.sha256&&hash(prepared)===cached.preparedSHA256)return{glb,meta:cached};
 }
 const gltf=await rigOnly(source),scene=gltf.scene,mixer=new T.AnimationMixer(scene);mixer.clipAction(gltf.animations.find(c=>c.name.endsWith('Idle'))).play();mixer.setTime(0);scene.updateMatrixWorld(true);
 const rifle=scene.getObjectByName('Rif_059'),gun=scene.getObjectByName('Object_97');
 // Rifle bone local +Y is the barrel; canonical barrel is -Z.
 const orientation=new T.Matrix4().makeRotationY(Math.PI).multiply(new T.Matrix4().makeRotationX(-Math.PI/2)).multiply(rifle.matrixWorld.clone().invert());
 const vertices=Array.from({length:gun.geometry.attributes.position.count},(_,i)=>gun.getVertexPosition(i,new T.Vector3()).applyMatrix4(gun.matrixWorld).applyMatrix4(orientation));
 const box=new T.Box3().setFromPoints(vertices),length=box.max.z-box.min.z,scale=.943/length;
 const normalization=new T.Matrix4().makeScale(scale,scale,scale).multiply(orientation);
 const {g,binary,access}=readGLB(source),remove=new Set([4,5,6,10,96,98,100,101]),index=new Map();g.nodes.forEach((n,i)=>{if(!remove.has(i))index.set(i,index.size)});
 g.nodes=g.nodes.filter((_,i)=>!remove.has(i)).map(n=>({...n,...(n.children?{children:n.children.filter(i=>index.has(i)).map(i=>index.get(i))}:{})}));
 for(const s of g.skins){s.joints=s.joints.map(i=>index.get(i));s.skeleton=index.get(s.skeleton);}for(const a of g.animations){a.channels=a.channels.filter(c=>index.has(c.target.node));for(const c of a.channels)c.target.node=index.get(c.target.node);}
 const oldRoots=g.scenes[g.scene||0].nodes.map(i=>index.get(i)),wrapper=g.nodes.length;g.nodes.push({name:'FPS_Meter_Frame',matrix:normalization.toArray(),children:oldRoots});g.scenes=[{name:'Training_FPS',nodes:[wrapper]}];g.scene=0;delete g.cameras;
 await writeFile(new URL('dist/fps-gun-points.json',root),JSON.stringify(vertices.map(p=>p.clone().multiplyScalar(scale).toArray())));
 const normalizedVertices=vertices.map(p=>p.clone().multiplyScalar(scale)),bounds=new T.Box3().setFromPoints(normalizedVertices);
 const grip=side=>scene.getObjectByName(`Hand_${side}_${side==='R'?'037':'016'}`).getWorldPosition(new T.Vector3()).applyMatrix4(normalization).toArray();
 const head=scene.getObjectByName('Head_Cam_014').getWorldPosition(new T.Vector3()).applyMatrix4(normalization).toArray();
 const clips=g.animations.map(a=>({name:a.name.split('AK_')[1],duration:Math.max(...a.samplers.map(s=>g.accessors[s.input].max[0]))}));
 g.asset.extras={...g.asset.extras,changes:'Removed camera/display-only nodes; meter/axis normalization; authored attachment markers; textures converted separately to WebP; source preserved.',training:{normalization:normalization.toArray(),scale,sourceAxisLengthM:length,targetLengthM:.943,gripR:grip('R'),gripL:grip('L'),headRest:head}};
 const compact=compactAccessors(g,binary),prepared=packGLB(g,compact.binary);await mkdir(new URL('dist/',root),{recursive:true});await writeFile(new URL('dist/fps-ak74m-training.glb',root),prepared);
 const optimized=await compressGLB(prepared,{name:'fps-ak',output:new URL('dist/fps-ak74m-webp.glb',root)});
 const meta={generatorSHA256,losslessPacking:compact.proof,sourceBytes:source.length,sourceSHA256:hash(source),preparedBytes:prepared.length,preparedSHA256:hash(prepared),removedNodes:[...remove],triangles:40023,skinJoints:85,clips,scale,sourceAxisLengthM:length,targetLengthM:.943,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},gripR:grip('R'),gripL:grip('L'),headRest:head,normalization:normalization.toArray(),texture:optimized.meta};
 await writeFile(new URL('dist/training-fps-info.json',root),JSON.stringify(meta,null,2)+'\n');return {glb:optimized.glb,meta};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const r=await generateFPS();console.log(JSON.stringify({...r.meta,texture:{bytes:r.glb.length,rows:r.meta.texture.rows.map(({index,width,height,originalBytes,outputBytes,lossless,ssim})=>({index,width,height,originalBytes,outputBytes,lossless,ssim}))}},null,2));}
