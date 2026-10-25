// Z attachment stage: keep source geometry; derive a canonical 270 mm optic.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {readGLB} from './training-soldier-skin.mjs';
import {rigOnly,packGLB,compactAccessors} from './training-fps-model.mjs';
import {compressGLB,WEBP_POLICY} from './training-webp.mjs';
import {VUDU} from '../apps/training/src/optic-data.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function generateVudu(){
 const source=await readFile('apps/training/assets/source/eotech_vudu_1-6x24.glb'),sourceSHA256=hash(source);
 assert.equal(sourceSHA256,'13b3ce147e1a7891367035b2a3ea4f78fecac997ff2bb1b53beb08cd13640e09');
 const signature=hash(Buffer.concat([await readFile(new URL(import.meta.url)),Buffer.from(JSON.stringify(VUDU)),Buffer.from(JSON.stringify(WEBP_POLICY)),await readFile(new URL('./training-webp.mjs',import.meta.url))]));
 const cached=JSON.parse(await readFile('dist/training-vudu-info.json','utf8').catch(()=>'{}'));
 if(cached.signature===signature&&cached.sourceSHA256===sourceSHA256){const glb=await readFile('dist/vudu-webp.glb').catch(()=>null);if(glb&&hash(glb)===cached.texture.sha256)return{glb,meta:cached};}
 await mkdir('dist',{recursive:true});const scene=(await rigOnly(source)).scene;scene.updateMatrixWorld(true);
 const points=name=>{const node=scene.getObjectByName(name);return Array.from({length:node.geometry.attributes.position.count},(_,i)=>node.getVertexPosition(i,new T.Vector3()).applyMatrix4(node.matrixWorld));};
 const body=points('Scope_low_Scope_0'),mount=points('Mount_low_Mount_0'),glass=points('Glass_low_Glass_0'),bounds=new T.Box3().setFromPoints(body),mountBounds=new T.Box3().setFromPoints(mount);
 // Native +Z is the large eye-facing lens; -Z is the 24mm objective.
 const length=bounds.max.z-bounds.min.z,scale=VUDU.lengthM/length,ocularZ=Math.max(...glass.map(v=>v.z)),objectiveZ=Math.min(...glass.map(v=>v.z));
 const center=new T.Box3().setFromPoints(glass).getCenter(new T.Vector3());
 const normalization=new T.Matrix4().makeScale(scale,scale,scale).multiply(new T.Matrix4().makeTranslation(-center.x,-mountBounds.min.y,-ocularZ));
 const normal=p=>p.clone().applyMatrix4(normalization),ocular=normal(new T.Vector3(center.x,center.y,ocularZ)),objective=normal(new T.Vector3(center.x,center.y,objectiveZ));
 const {g,binary}=readGLB(source),roots=g.scenes[g.scene||0].nodes,wrapper=g.nodes.length;
 g.nodes.push({name:'Vudu_Meter_Frame',matrix:normalization.toArray(),children:roots});g.scenes=[{name:'Training_Vudu',nodes:[wrapper]}];g.scene=0;
 const markers={ocular:ocular.toArray(),objective:objective.toArray(),opticalAxis:[0,0,-1],mountBottom:[0,0,0]};
 for(const [name,position]of Object.entries(markers))if(name!=='opticalAxis'){const id=g.nodes.length;g.nodes.push({name:'Vudu_'+name,translation:position});g.scenes[0].nodes.push(id);}
 const compact=compactAccessors(g,binary),prepared=packGLB(g,compact.binary);await writeFile('dist/vudu-training.glb',prepared);
 const optimized=await compressGLB(prepared,{name:'vudu',output:'dist/vudu-webp.glb',losslessMaterialMaps:true});
 // Cross a straight tube section, rather than relying on vertices exactly at a
 // particular station. The source cylinder spans long faces between rings.
 const tubePoints=[],tubeZ=-.19,bodyMesh=scene.getObjectByName('Scope_low_Scope_0'),normalized=body.map(normal),indices=bodyMesh.geometry.index;
 for(let i=0;i<indices.count;i+=3)for(let e=0;e<3;e++){const a=normalized[indices.getX(i+e)],b=normalized[indices.getX(i+(e+1)%3)];if((a.z-tubeZ)*(b.z-tubeZ)<0)tubePoints.push(a.clone().lerp(b,(tubeZ-a.z)/(b.z-a.z)));}
 assert.ok(tubePoints.length>20);const tubeBox=new T.Box3().setFromPoints(tubePoints);
 const meta={signature,sourceBytes:source.length,sourceSHA256,credits:g.asset.extras,triangles:g.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+g.accessors[p.indices].count/3,0),0),meshCount:3,scale,sourceBodyLength:length,lengthM:VUDU.lengthM,normalization:normalization.toArray(),markers,bounds:{min:normal(bounds.min).toArray(),max:normal(bounds.max).toArray()},mountBounds:{min:normal(mountBounds.min).toArray(),max:normal(mountBounds.max).toArray()},tubeDiameterMeasuredM:tubeBox.max.x-tubeBox.min.x,objectiveGlassDiameterM:(Math.max(...glass.filter(v=>Math.abs(v.z-objectiveZ)<.001).map(v=>v.x))-Math.min(...glass.filter(v=>Math.abs(v.z-objectiveZ)<.001).map(v=>v.x)))*scale,packing:compact.proof,texture:optimized.meta,geometryUnchanged:true,reticleInSource:false,manufacturer:{url:VUDU.manufacturer,checked:'2026-10-11',lengthM:.270,weightKg:.570,tubeDiameterM:.030,objectiveDiameterM:.024},stage:'inventory attachment and visible model; zeroing/PiP/reticle deferred'};
 await writeFile('dist/training-vudu-info.json',JSON.stringify(meta,null,2)+'\n');return{glb:optimized.glb,meta};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const r=await generateVudu();console.log(JSON.stringify({bytes:r.glb.length,meshCount:r.meta.meshCount,triangles:r.meta.triangles,markers:r.meta.markers,mountBounds:r.meta.mountBounds,tubeDiameterMeasuredM:r.meta.tubeDiameterMeasuredM,objectiveGlassDiameterM:r.meta.objectiveGlassDiameterM}));}
