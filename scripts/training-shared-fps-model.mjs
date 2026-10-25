import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateFPS,packGLB,compactAccessors} from './training-fps-model.mjs';
import {generateM4Arms} from './training-m4-arms-model.mjs';
import {readGLB} from './training-soldier-skin.mjs';
import {compactAnimationKeys,pruneAccessors} from './training-animation-compact.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function generateSharedFPS(){
 const ak=await generateFPS(),m4=await generateM4Arms(),signature=hash(Buffer.concat([await readFile(new URL(import.meta.url)),await readFile(new URL('./training-animation-compact.mjs',import.meta.url)),ak.glb,m4.glb]));
 const cached=JSON.parse(await readFile('dist/training-shared-fps-info.json','utf8').catch(()=>'{}'));
 if(cached.signature===signature){const gun=await readFile('dist/ak74m-driver-webp.glb').catch(()=>null),arms=await readFile('dist/shared-arms-webp.glb').catch(()=>null);if(gun&&arms&&hash(gun)===cached.gun.sha256&&hash(arms)===cached.arms.sha256)return{gun,arms,meta:cached,akSource:ak.meta,m4Source:m4.meta};}
 const optimize=(bytes,stripArms)=>{const {g,binary}=readGLB(bytes);if(stripArms){
  g.meshes=g.meshes.slice(1);for(const n of g.nodes)if(n.mesh!==undefined){if(n.mesh===0){delete n.mesh;delete n.skin;}else n.mesh--;}
  g.materials=g.materials.slice(1);for(const m of g.meshes)for(const p of m.primitives)p.material=0;
  const textureOffset=3;g.images=g.images.slice(textureOffset);g.textures=g.textures.slice(textureOffset);for(const t of g.textures){if(t.source!==undefined)t.source-=textureOffset;if(t.extensions?.EXT_texture_webp)t.extensions.EXT_texture_webp.source-=textureOffset;}
  const remap=o=>{if(!o||typeof o!=='object')return;for(const [k,v]of Object.entries(o)){if(k.endsWith('Texture')&&v?.index!==undefined)v.index-=textureOffset;else remap(v);}};g.materials.forEach(remap);
  g.animations=g.animations.filter(a=>!a.name.endsWith('Reload_var2'));
 }
 const reduced=compactAnimationKeys(g,binary);pruneAccessors(g);const packed=compactAccessors(g,reduced.binary),glb=packGLB(g,packed.binary);return{glb,meta:{bytes:glb.length,sha256:hash(glb),meshCount:g.meshes.length,triangles:g.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+g.accessors[p.indices].count/3,0),0),clips:g.animations.map(a=>({name:a.name,duration:Math.max(...a.samplers.map(s=>g.accessors[s.input].max[0]))})),animation:reduced.proof,packing:packed.proof,sourceDerivativeSHA256:hash(bytes)}};};
 const gun=optimize(ak.glb,true),arms=optimize(m4.glb,false),meta={signature,commonArms:'M4 four meshes / connected 113-joint skeleton shared by both weapons',oldEmbeddedBytes:ak.glb.length+m4.glb.length,newEmbeddedBytes:gun.glb.length+arms.glb.length,gun:gun.meta,arms:arms.meta,akArmMeshAndTexturesRemoved:true,unusedAKReloadVar2Removed:true,originalUploadsPreserved:true};
 await writeFile('dist/ak74m-driver-webp.glb',gun.glb);await writeFile('dist/shared-arms-webp.glb',arms.glb);await writeFile('dist/training-shared-fps-info.json',JSON.stringify(meta,null,2)+'\n');return{gun:gun.glb,arms:arms.glb,meta,akSource:ak.meta,m4Source:m4.meta};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const r=await generateSharedFPS();console.log(JSON.stringify(r.meta,null,2));}
