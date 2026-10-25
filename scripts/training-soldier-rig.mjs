import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { Matrix4, Matrix3, Vector3, Box3, Triangle, Ray } from 'three';
import { SOLDIER_BONES, BODY_BONES, bodyWeights, packedWeights, createSoldierRig, TARGET_POSES } from '../apps/training/src/soldier-rig.js';
import { extractHeadMesh } from './training-head-mesh.mjs';
import { ARMOR_MESH_REGIONS } from '../apps/training/src/generated/armor-mesh.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const sourceHash='f38f736aa92ca01564cbc3d6526655fc639677eedd2e0b7f939eb4ca3e0d978a';
const boundsOf=vertices=>{const b=new Box3();for(let i=0;i<vertices.length;i+=3)b.expandByPoint(new Vector3().fromArray(vertices,i));return {min:b.min.toArray(),max:b.max.toArray()};};
export async function soldierSource() {
  const bytes=await readFile(resolve(root,'apps/training/assets/soldier-character.glb'));
  if(sha256(bytes)!==sourceHash)throw new Error('Review authored rig against the changed soldier asset');
  const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length),bounds=new Box3(),meshes=[];
  const accessor=id=>{const a=g.accessors[id],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],w={5126:4,5125:4,5123:2}[a.componentType],fn={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE'}[a.componentType];
    if(!n||!w)throw new Error('Unsupported soldier accessor');return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>binary[fn]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*w)+j*w)));};
  function walk(id,parent=new Matrix4()){const node=g.nodes[id];if(node.translation||node.rotation||node.scale||node.skin!==undefined)throw new Error('Review soldier transforms');
    const matrix=parent.clone().multiply(node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4());
    if(node.mesh!==undefined)for(const p of g.meshes[node.mesh].primitives){const positions=accessor(p.attributes.POSITION).map(v=>new Vector3(...v).applyMatrix4(matrix));positions.forEach(v=>bounds.expandByPoint(v));
      meshes.push({primitive:p,material:g.materials[p.material].name,positions,normals:accessor(p.attributes.NORMAL).map(v=>new Vector3(...v).applyMatrix3(new Matrix3().getNormalMatrix(matrix)).normalize()),indices:accessor(p.indices).flat()});}
    for(const c of node.children||[])walk(c,matrix);}
  g.scenes[g.scene||0].nodes.forEach(id=>walk(id));const center=bounds.getCenter(new Vector3()),scale=1.8/bounds.getSize(new Vector3()).y;
  for(const m of meshes)m.positions.forEach(v=>v.set((v.x-center.x)*scale,(v.y-bounds.min.y)*scale,(v.z-center.z)*scale));
  return {g,binary,meshes,scale,bounds};
}
function components(mesh) {
  const n=mesh.indices.length/3,parent=Array.from({length:n},(_,i)=>i),refs=new Map();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<n;i++)for(const v of mesh.indices.slice(i*3,i*3+3)){const key=mesh.positions[v].toArray().map(x=>Math.round(x*1e6)).join(',');if(refs.has(key))parent[find(i)]=find(refs.get(key));else refs.set(key,i);}
  const groups=new Map();for(let i=0;i<n;i++){const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}return [...groups.values()].sort((a,b)=>a[0]-b[0]);
}
function recenterSections(centers,axis,triangles,maxRadius) {
  return centers.map(center=>{
    const points=[];
    for(const t of triangles){const vs=[t.a,t.b,t.c];for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3],da=a.clone().sub(center).dot(axis),db=b.clone().sub(center).dot(axis);
      if(da*db<0){const p=a.clone().lerp(b,da/(da-db));if(p.distanceTo(center)<maxRadius)points.push(p);}}}
    if(points.length<6)return center;
    const mean=points.reduce((v,p)=>v.add(p),new Vector3()).multiplyScalar(1/points.length),shift=mean.sub(center);shift.addScaledVector(axis,-shift.dot(axis));
    return center.clone().add(shift.clampLength(0,maxRadius*.45));
  });
}
function ringMesh(centers,radialU,radialV,radii,triangles=[],sourceIds=[],limit=.15,segments=20) {
  const vertices=[],indices=[],samples=[];
  for(let i=0;i<centers.length;i++)for(let j=0;j<segments;j++){
    const angle=j/segments*Math.PI*2,d=radialU.clone().multiplyScalar(Math.cos(angle)).addScaledVector(radialV,Math.sin(angle)).normalize(),ray=new Ray(centers[i],d),hit=new Vector3();let distance=Infinity,id=null;
    for(let k=0;k<triangles.length;k++){const t=triangles[k];if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)){const r=hit.distanceTo(centers[i]);if(r>.003&&r<limit&&r<distance){distance=r;id=sourceIds[k];}}}
    if(id===null)distance=1/Math.hypot(Math.cos(angle)/radii[i][0],Math.sin(angle)/radii[i][1]);
    vertices.push(...centers[i].clone().addScaledVector(d,distance).toArray());samples.push(id);
  }
  for(let i=0;i<centers.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments;indices.push(a,b,b+segments,a,b+segments,a+segments);}
  const bottom=vertices.length/3;vertices.push(...centers[0].toArray());const top=vertices.length/3;vertices.push(...centers.at(-1).toArray());
  for(let j=0;j<segments;j++){const k=(j+1)%segments;indices.push(bottom,k,j,top,(centers.length-1)*segments+j,(centers.length-1)*segments+k);}
  // Basis winding is established independently of source face orientation.
  let volume=0;for(let i=0;i<indices.length;i+=3){const[a,b,c]=indices.slice(i,i+3).map(v=>new Vector3().fromArray(vertices,v*3));volume+=a.dot(b.cross(c))/6;}if(volume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  return {vertices,indices,bounds:boundsOf(vertices),closed:true,fitting:{segments,rings:centers.length,sourceTrianglePerSample:samples,sourceSamples:samples.filter(i=>i!==null).length,authoredSamples:samples.filter(i=>i===null).length,authoredCaps:true}};
}
function sourceHull(mesh,select) {
  const sourceVertexIds=mesh.positions.flatMap((p,i)=>select(p)?[i]:[]),points=sourceVertexIds.map(i=>mesh.positions[i].clone());
  if(points.length<12)throw new Error('Insufficient source hull samples');
  const hull=new ConvexHull().setFromPoints(points),used=[],lookup=new Map(),indices=[];
  for(const face of hull.faces){let edge=face.edge;const ids=[];do{const point=edge.head().point;if(!lookup.has(point)){lookup.set(point,used.length);used.push(point);}ids.push(lookup.get(point));edge=edge.next;}while(edge!==face.edge);indices.push(...ids);}
  const vertices=used.flatMap(p=>p.toArray());return {vertices,indices,bounds:boundsOf(vertices),closed:true,
    provenance:'source-vertex-convex-hull',sourceMaterial:'Body',fitting:{sourceVertexIds:used.map(p=>sourceVertexIds[points.indexOf(p)]),sourceSamples:used.length,authoredSamples:0,selection:'reviewed wrist/ankle cut; hull bridges finger gaps and cloth folds'}};
}
function bodyRegions(body,head) {
  const all=Array.from({length:body.indices.length/3},(_,i)=>new Triangle(...body.indices.slice(i*3,i*3+3).map(v=>body.positions[v]))),groups=components(body);
  const armLeft=groups.find(ids=>ids[0]===0),armRight=groups.find(ids=>ids[0]===1599),pants=groups.find(ids=>ids[0]===2138);
  if(!armLeft||!armRight||!pants)throw new Error('Review Body component selection');
  const regions={head:{...head,bone:'head',at:[0,1.67,.07],part:'head',sourceMaterial:'Head'}};
  const vertical=(id,part,levels,x,z,rx,rz,source=[],provenance='authored-hidden-body')=>{const mesh=ringMesh(levels.map(y=>new Vector3(x,y,z)),new Vector3(1,0,0),new Vector3(0,0,1),levels.map((_,i)=>[Array.isArray(rx)?rx[i]:rx,Array.isArray(rz)?rz[i]:rz]),source.map(i=>all[i]),source,.20);
    regions[id]={...mesh,bone:BODY_BONES[id],at:[x,(levels[0]+levels.at(-1))/2,z],part,provenance,sourceMaterial:source.length?'Body':null};};
  vertical('neck','neck',[1.445,1.48,1.505,1.54,1.575,1.61],0,0,.054,.058);
  vertical('chest','chest',[1.19,1.23,1.30,1.37,1.43,1.46],0,0,[.16,.18,.18,.17,.15,.12],[.105,.112,.115,.112,.105,.085]);
  vertical('abdomen','abdomen',[.99,1.03,1.08,1.135,1.19],0,0,[.155,.156,.156,.16,.16],.105);
  vertical('pelvis','abdomen',[.84,.88,.92,.96,1.00],0,0,.17,.11,pants,'source-fitted-pants-with-authored-joint-caps');
  for(const [side,s,arm]of[['left',1,armLeft],['right',-1,armRight]]){
    const limb=(suffix,part,a,b,radius,ids,limit=.14)=>{const from=new Vector3(...a),to=new Vector3(...b),axis=to.clone().sub(from).normalize();
      const u=new Vector3(0,0,1).cross(axis).normalize(),v=axis.clone().cross(u).normalize(),centers=Array.from({length:9},(_,i)=>from.clone().lerp(to,i/8));
      const sections=recenterSections(centers,axis,ids.map(i=>all[i]),limit);
      const mesh=ringMesh(sections,u,v,sections.map(()=>[radius,radius]),ids.map(i=>all[i]),ids,limit);
      regions[`${side}-${suffix}`]={...mesh,bone:BODY_BONES[`${side}-${suffix}`],at:[0,1,2].map(axis=>mesh.vertices.filter((_,i)=>i%3===axis).reduce((a,b)=>a+b,0)/(mesh.vertices.length/3)),part,provenance:'source-fitted-cloth-with-authored-joint-caps',sourceMaterial:'Body'};};
    limb('upper-arm',`${side}Arm`,[s*.17,1.46,0],[s*.395,1.205,.02],.067,arm);
    limb('forearm',`${side}Arm`,[s*.383,1.217,.02],[s*.553,1.021,.025],.047,arm,.09);
    const wrist=new Vector3(s*.524,1.0,.017),forearmAxis=wrist.clone().sub(new Vector3(s*.370,1.205,.012)).normalize();
    const hand=sourceHull(body,p=>p.x*s>.45&&p.clone().sub(wrist).dot(forearmAxis)>-.008);regions[`${side}-hand`]={...hand,bone:BODY_BONES[`${side}-hand`],at:[0,1,2].map(axis=>hand.vertices.filter((_,i)=>i%3===axis).reduce((a,b)=>a+b,0)/(hand.vertices.length/3)),part:`${side}Arm`};
    limb('thigh',`${side}Leg`,[s*.09,.867,0],[s*.145,.517,-.005],.08,pants,.15);
    limb('lower-leg',`${side}Leg`,[s*.141,.53,-.005],[s*.185,.225,-.015],.061,pants,.115);
    const foot=sourceHull(body,p=>p.x*s>.10&&p.x*s<.30&&p.y<.235);
    regions[`${side}-foot`]={...foot,bone:BODY_BONES[`${side}-foot`],at:[0,1,2].map(axis=>foot.vertices.filter((_,i)=>i%3===axis).reduce((a,b)=>a+b,0)/(foot.vertices.length/3)),part:`${side}Leg`};
    for(const[joint,bone,part,radius]of[['elbow',`${side}Forearm`,`${side}Arm`,.045],['knee',`${side}LowerLeg`,`${side}Leg`,.052]]){
      const center=new Vector3(...SOLDIER_BONES.find(b=>b.name===bone).at),levels=Array.from({length:9},(_,i)=>-radius+i/8*radius*2);
      const m=ringMesh(levels.map(y=>center.clone().add(new Vector3(0,y,0))),new Vector3(1,0,0),new Vector3(0,0,1),levels.map(y=>{const r=Math.max(.0001,Math.sqrt(Math.max(0,radius*radius-y*y)));return [r,r];}));
      regions[`${side}-${joint}`]={...m,bone,at:center.toArray(),part,joint:true,provenance:'authored-joint-gap-cover',sourceMaterial:null};
    }
  }
  return {regions,groups};
}
export async function generateSoldierRig({headMesh=null}={}) {
  const head=headMesh||await extractHeadMesh();
  const source=await soldierSource(),{g,binary,meshes}=source,body=meshes.find(m=>m.material==='Body'),{regions,groups}=bodyRegions(body,head.body);
  const armVertices=new Set(groups.filter(ids=>[0,1599].includes(ids[0])).flatMap(ids=>ids.flatMap(i=>body.indices.slice(i*3,i*3+3))));
  const collarVertices=new Set(head.body.fitting.excludedCollarSourceTriangleIds.flatMap(i=>meshes.find(m=>m.material==='Head').indices.slice(i*3,i*3+3)));
  const vestAssignment=new Map();for(const[slot,region]of Object.entries(ARMOR_MESH_REGIONS))for(const v of region.sourceVertexIds)vestAssignment.set(v,slot==='groin'?'pelvis':slot==='shoulder-left'?'leftUpperArm':slot==='shoulder-right'?'rightUpperArm':'chest');
  const parts=[Buffer.from(binary)],append=(values,type,componentType=5126)=>{const count=values.length/{SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type],typed=componentType===5123?new Uint16Array(values):new Float32Array(values),data=Buffer.from(typed.buffer);let offset=parts.reduce((n,b)=>n+b.length,0);const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}parts.push(data);
    const view=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});const a={bufferView:view,componentType,count,type};if(type==='SCALAR'){a.min=[Math.min(...values)];a.max=[Math.max(...values)];}if(type==='VEC3'){a.min=[0,1,2].map(i=>Math.min(...values.filter((_,j)=>j%3===i)));a.max=[0,1,2].map(i=>Math.max(...values.filter((_,j)=>j%3===i)));}g.accessors.push(a);return g.accessors.length-1;};
  g.nodes=[];g.meshes=[];const meshNodes=[],weightProof=[];
  for(const m of meshes){const joints=[],weights=[],influenceCounts={};
    m.positions.forEach((p,i)=>{let influence;if(m.material==='Body')influence=bodyWeights(p,armVertices.has(i)||Math.abs(p.x)>.32&&p.y>.885?'arm':'leg');
      else if(m.material==='Head')influence=[[collarVertices.has(i)?'chest':p.y<1.56?'neck':'head',1]];
      else if(m.material==='material')influence=[['head',1]];
      else if(m.material==='Vest')influence=[[vestAssignment.get(i)||'chest',1]];
      else influence=[[p.y<1.08?'pelvis':'chest',1]];
      const packed=packedWeights(influence);joints.push(...packed.ids);weights.push(...packed.weights);for(const[name]of influence)influenceCounts[name]=(influenceCounts[name]||0)+1;});
    const primitive={...m.primitive,attributes:{...m.primitive.attributes,POSITION:append(m.positions.flatMap(p=>p.toArray()),'VEC3'),NORMAL:append(m.normals.flatMap(p=>p.toArray()),'VEC3'),JOINTS_0:append(joints,'VEC4',5123),WEIGHTS_0:append(weights,'VEC4')}};
    const mesh=g.meshes.length;g.meshes.push({name:m.material,primitives:[primitive]});meshNodes.push(g.nodes.length);g.nodes.push({name:`Soldier:${m.material}`,mesh,skin:0});weightProof.push({material:m.material,vertices:m.positions.length,influenceCounts});
  }
  const boneNodes=SOLDIER_BONES.map((d,i)=>meshNodes.length+i);
  for(const d of SOLDIER_BONES){const at=new Vector3(...d.at);if(d.parent)at.sub(new Vector3(...SOLDIER_BONES.find(p=>p.name===d.parent).at));g.nodes.push({name:d.name,translation:at.toArray(),children:SOLDIER_BONES.flatMap((b,i)=>b.parent===d.name?[boneNodes[i]]:[])});}
  g.skins=[{name:'CQB authored humanoid',joints:boneNodes,skeleton:boneNodes[0],inverseBindMatrices:append(SOLDIER_BONES.flatMap(d=>new Matrix4().makeTranslation(...d.at).invert().toArray()),'MAT4')}];
  g.scenes=[{name:'CQB Soldier 1.8m',nodes:[...meshNodes,boneNodes[0]]}];g.scene=0;g.animations=[];
  const rig=createSoldierRig({fingers:false});for(const name of Object.keys(TARGET_POSES).filter(n=>n!=='rest')){const duration=name==='walk'?1.2:1,steps=name==='walk'?24:1,frames=Array.from({length:steps+1},(_,i)=>i*duration/steps),poses=frames.map(t=>{rig.setPose(name,t);return rig.bones.map(b=>({position:b.position.toArray(),rotation:b.quaternion.toArray()}));}),time=append(frames,'SCALAR'),samplers=[],channels=[];
    for(let i=0;i<SOLDIER_BONES.length;i++)for(const[path,key,type]of[['rotation','rotation','VEC4'],['translation','position','VEC3']]){const sampler=samplers.length;samplers.push({input:time,output:append(poses.flatMap(p=>p[i][key]),type),interpolation:'LINEAR'});channels.push({sampler,target:{node:boneNodes[i],path}});}g.animations.push({name,samplers,channels});}rig.dispose();
  const bin=Buffer.concat(parts);g.buffers=[{byteLength:bin.length}];g.asset.generator='CQB deterministic authored rig v9; original texture/index/UV bytes preserved';
  const js=Buffer.from(JSON.stringify(g)),jpad=Buffer.alloc((4-js.length%4)%4,32),bpad=Buffer.alloc((4-bin.length%4)%4),jsonChunk=Buffer.concat([js,jpad]),binChunk=Buffer.concat([bin,bpad]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binChunk.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binChunk.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,jsonChunk,binHeader,binChunk]),meta={version:'soldier-rig-v9',sourceSha256:sourceHash,preparedSha256:sha256(glb),preparedBytes:glb.length,bones:SOLDIER_BONES.length,clips:g.animations.map(a=>a.name),normalization:{heightM:1.8,scale:source.scale},weightProof,bodySource:{material:'Body',triangles:body.indices.length/3,selectedComponents:[0,1599,2138],provenance:'source-fitted-clothing-limbs; authored-hidden-torso; joint caps authored',bodyRegions:21,coreRegions:17,jointCovers:4}};
  const output=resolve(root,'apps/training/src/generated/body-mesh.js'),text='// Generated by scripts/training-soldier-rig.mjs; source-fitted cloth is not internal anatomy.\n'+`export const BODY_MESH_SOURCE = ${JSON.stringify(meta)};\nexport const BODY_MESH_REGIONS = ${JSON.stringify(regions)};\n`;
  await mkdir(resolve(root,'dist'),{recursive:true});await writeFile(resolve(root,'dist/soldier-rigged.glb'),glb);if(await readFile(output,'utf8').catch(()=>'')!==text)await writeFile(output,text);
  return {glb,meta,regions};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await generateSoldierRig();console.log(r.meta);}
