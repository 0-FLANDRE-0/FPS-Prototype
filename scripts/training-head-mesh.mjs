import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Box3, Matrix4, Vector3, Triangle, Ray } from 'three';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceSha256 = 'f38f736aa92ca01564cbc3d6526655fc639677eedd2e0b7f939eb4ca3e0d978a';
const boundsOf = vertices => {
  const b = new Box3(); for (let i=0;i<vertices.length;i+=3) b.expandByPoint(new Vector3().fromArray(vertices,i));
  return { min:b.min.toArray(),max:b.max.toArray() };
};
export async function extractHeadMesh() {
  const bytes=await readFile(resolve(root,'apps/training/assets/soldier-character.glb'));
  if(createHash('sha256').update(bytes).digest('hex')!==sourceSha256)throw new Error('Review head/helmet selection for the changed soldier asset');
  const length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length)),binary=28+length;
  const accessor=id=>{const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3}[a.type],w={5126:4,5125:4,5123:2}[a.componentType],fn={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE'}[a.componentType];
    if(!n||!w)throw new Error('Unsupported soldier accessor');
    return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>bytes[fn](binary+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*w)+j*w)));};
  const bounds=new Box3(),meshes=[];
  const walk=(id,parent=new Matrix4())=>{const node=gltf.nodes[id];
    if(node.translation||node.rotation||node.scale||node.skin!==undefined)throw new Error('Review soldier transforms');
    const matrix=parent.clone().multiply(node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4());
    if(node.mesh!==undefined)for(const primitive of gltf.meshes[node.mesh].primitives){const positions=accessor(primitive.attributes.POSITION).map(p=>new Vector3(...p).applyMatrix4(matrix));positions.forEach(p=>bounds.expandByPoint(p));meshes.push({material:gltf.materials[primitive.material].name,positions,indices:accessor(primitive.indices).flat()});}
    for(const child of node.children||[])walk(child,matrix);};
  gltf.scenes[gltf.scene||0].nodes.forEach(id=>walk(id));
  const center=bounds.getCenter(new Vector3()),scale=1.8/bounds.getSize(new Vector3()).y;
  const head=meshes.find(m=>m.material==='Head');if(!head||head.indices.length!==5600*3)throw new Error('Review Head primitive');
  const positions=head.positions.map(p=>new Vector3((p.x-center.x)*scale,(p.y-bounds.min.y)*scale,(p.z-center.z)*scale));
  const triangles=Array.from({length:head.indices.length/3},(_,i)=>new Triangle(...head.indices.slice(i*3,i*3+3).map(v=>positions[v])));
  const normals=triangles.map(t=>t.getNormal(new Vector3()));
  const region=ids=>{const sourceVertexIds=[...new Set(ids.flatMap(i=>head.indices.slice(i*3,i*3+3)))].sort((a,b)=>a-b),map=new Map(sourceVertexIds.map((v,i)=>[v,i]));
    const vertices=sourceVertexIds.flatMap(i=>positions[i].toArray()),indices=ids.flatMap(i=>head.indices.slice(i*3,i*3+3).map(v=>map.get(v)));
    return {vertices,indices,sourceVertexIds,sourceTriangleIds:ids,bounds:boundsOf(vertices)};};
  // Reviewed shell faces only. Goggles, straps, buckles and balaclava are excluded.
  const helmet=region(Array.from({length:466},(_,i)=>i));
  // Follow the actual front collar surface, which shares the Head primitive with
  // skin/clothing. Flood its connected folded surface, then trim at reviewed rim
  // landmarks. Trimming interpolates ON source faces; no floating authored panel.
  const adjacent=triangles.map(()=>[]),edges=new Map(),key=p=>p.toArray().map(x=>Math.round(x*1e6)).join(',');
  triangles.forEach((t,i)=>{const vs=[t.a,t.b,t.c];for(let j=0;j<3;j++){const k=[key(vs[j]),key(vs[(j+1)%3])].sort().join(':');if(edges.has(k)){const other=edges.get(k);adjacent[i].push(other);adjacent[other].push(i);}else edges.set(k,i);}});
  const ids=new Set([2611]),queue=[2611];
  while(queue.length){const i=queue.shift();for(const j of adjacent[i])if(!ids.has(j)&&normals[i].dot(normals[j])>Math.cos(40*Math.PI/180)){
    const t=triangles[j];if(Math.max(t.a.y,t.b.y,t.c.y)>1.60||t.getMidpoint(new Vector3()).z<.015)continue;ids.add(j);queue.push(j);}}
  const roof=p=>p.y-(1.535+.038*(p.x/.116)**2);
  const vertices=[],indices=[],sourceTriangleIds=[];
  for(const id of [...ids].sort((a,b)=>a-b)){
    const t=triangles[id],polygon=[t.a,t.b,t.c],clipped=[];
    for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=roof(a)<=0,insideB=roof(b)<=0;
      if(insideA)clipped.push(a.clone());if(insideA!==insideB){let lo=0,hi=1;for(let k=0;k<45;k++){const mid=(lo+hi)/2,p=a.clone().lerp(b,mid);if((roof(p)<=0)===insideA)lo=mid;else hi=mid;}clipped.push(a.clone().lerp(b,(lo+hi)/2));}}
    for(let i=1;i<clipped.length-1;i++){if(new Triangle(clipped[0],clipped[i],clipped[i+1]).getArea()<1e-12)continue;const n=vertices.length/3;vertices.push(...clipped[0].toArray(),...clipped[i].toArray(),...clipped[i+1].toArray());indices.push(n,n+1,n+2);sourceTriangleIds.push(id);}
  }
  const frontNeck={vertices,indices,sourceTriangleIds,bounds:boundsOf(vertices),provenance:'source-face-trimmed-front-collar',
    selection:{seedTriangle:2611,creaseLimitDeg:40,rimCenterY:1.535,rimSideRiseM:.038,rimHalfWidthM:.116},surfaceOnly:true};
  // The asset has no complete bare scalp beneath its helmet. A closed anatomical
  // proxy samples reviewed face/jaw/nape surfaces radially; hidden cranial samples
  // use an authored ellipsoid constrained inside the visible helmet. This is NOT
  // a skull/tissue thickness model and equipment faces never become body samples.
  const anatomicalIds=[...Array.from({length:568},(_,i)=>2462+i),...Array.from({length:280},(_,i)=>2070+i),
    ...Array.from({length:118},(_,i)=>3970+i),...Array.from({length:142},(_,i)=>4628+i)]
    // Exclude the WHOLE connected collar before its armor-coverage rim trim.
    // A height-only guard allowed the collar's upper folds to become head skin.
    .filter(i=>!ids.has(i)&&triangles[i].getMidpoint(new Vector3()).y>=1.555);
  const levels=[1.555,1.56,1.57,1.58,1.595,1.61,1.625,1.64,1.65,1.66,1.67,1.68,1.69,1.70,1.715,1.73,1.745,1.76,1.77,1.775],segments=48;
  const bodyVertices=[],bodyIndices=[],samples=[];
  for(const y of levels)for(let j=0;j<segments;j++){
    const angle=j/segments*Math.PI*2,origin=new Vector3(0,y,.07),direction=new Vector3(Math.cos(angle),0,Math.sin(angle)),ray=new Ray(origin,direction),point=new Vector3();
    let r=0,sourceId=null;for(const id of anatomicalIds){if(!ray.intersectTriangle(triangles[id].a,triangles[id].b,triangles[id].c,false,point))continue;
      if(point.z>.02&&roof(point)<.006)continue;
      const distance=point.distanceTo(origin);if(distance>r&&distance<.16){r=distance;sourceId=id;}}
    if(sourceId===null){const vertical=Math.sqrt(Math.max(.001,1-((y-1.66)/.117)**2));r=vertical/Math.hypot(direction.x/.083,direction.z/.093);
      for(let id=0;id<466;id++)if(ray.intersectTriangle(triangles[id].a,triangles[id].b,triangles[id].c,false,point)){const shell=point.distanceTo(origin);if(shell>.015)r=Math.min(r,shell-.008);}}
    r=Math.max(.0025,r);bodyVertices.push(...origin.addScaledVector(direction,r).toArray());samples.push(sourceId);
  }
  const quad=(a,b,c,d)=>bodyIndices.push(a,b,c,a,c,d);
  for(let i=0;i<levels.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments;quad(a,a+segments,b+segments,b);}
  const bottom=bodyVertices.length/3;bodyVertices.push(0,levels[0],.07);const top=bodyVertices.length/3;bodyVertices.push(0,levels.at(-1),.07);
  for(let j=0;j<segments;j++){const next=(j+1)%segments;bodyIndices.push(bottom,j,next,top,(levels.length-1)*segments+next,(levels.length-1)*segments+j);}
  const body={vertices:bodyVertices,indices:bodyIndices,bounds:boundsOf(bodyVertices),closed:true,provenance:'mesh-fitted-face-jaw-with-authored-hidden-cranium',
    fitting:{centerZ:.07,segments,levels,sourceTrianglePerSample:samples,sourceSamples:samples.filter(x=>x!==null).length,authoredSamples:samples.filter(x=>x===null).length,
      excludedCollarSourceTriangleIds:[...ids].sort((a,b)=>a-b),authoredCollarCoveredJaw:true,
      hiddenCranium:{centerY:1.66,radiusY:.117,radiusX:.083,radiusZ:.093,helmetClearanceM:.008},anatomicalSourceRanges:[[2462,3029],[2070,2349],[3970,4087],[4628,4769]]}};
  const source={asset:'soldier-character.glb',material:'Head',sha256:sourceSha256,sourceTriangles:5600,normalization:{heightM:1.8,scale,rawBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},
    helmetTriangleRange:[0,465],helmetIdentity:'unconfirmed; geometry only; no ballistic rating inferred from appearance'};
  return {source,body,helmet,frontNeck};
}
export async function generateHeadMesh(){const r=await extractHeadMesh(),path=resolve(root,'apps/training/src/generated/head-mesh.js');const source='// Generated by scripts/training-head-mesh.mjs from the hash-pinned soldier asset.\n'+
  `export const HEAD_MESH_SOURCE = ${JSON.stringify(r.source)};\nexport const HEAD_COLLISION_MESH = ${JSON.stringify(r.body)};\nexport const HELMET_COLLISION_MESH = ${JSON.stringify(r.helmet)};\nexport const FRONT_NECK_MESH = ${JSON.stringify(r.frontNeck)};\n`;
  await mkdir(resolve(path,'..'),{recursive:true});if(await readFile(path,'utf8').catch(()=>'')!==source)await writeFile(path,source);return r;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await generateHeadMesh();console.log({headTriangles:r.body.indices.length/3,helmetTriangles:r.helmet.indices.length/3,frontNeckTriangles:r.frontNeck.indices.length/3,sourceSamples:r.body.fitting.sourceSamples});}
