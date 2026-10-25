// New visual derivative. The v9 GLB, bones, clips and collision meshes stay intact.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { packedWeights,SOLDIER_BONES } from '../apps/training/src/soldier-rig.js';
export function readGLB(bytes) {
  const size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size);
  const access=id=>{const a=g.accessors[id],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],w={5121:1,5123:2,5125:4,5126:4}[a.componentType],fn={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
    if(!n||!w)throw Error('Unsupported visual skin accessor');
    return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>binary[fn]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*w)+j*w)));};
  return {g,binary,access};
}
function connectedParts(positions,indices) {
  const parent=positions.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},weld=new Map();
  for(let i=0;i<positions.length;i++){const key=positions[i].map(v=>Math.round(v*1e6)).join(',');if(weld.has(key))parent[find(i)]=find(weld.get(key));else weld.set(key,i);}
  for(let i=0;i<indices.length;i+=3)for(const j of [1,2])parent[find(indices[i+j])]=find(indices[i]);
  const groups=new Map();for(let i=0;i<indices.length;i+=3){const id=find(indices[i]);if(!groups.has(id))groups.set(id,{firstTriangle:i/3,vertices:new Set()});for(const v of indices.slice(i,i+3))groups.get(id).vertices.add(v);}
  return [...groups.values()].map(p=>({...p,vertices:[...p.vertices],min:[0,1,2].map(k=>Math.min(...[...p.vertices].map(i=>positions[i][k]))),max:[0,1,2].map(k=>Math.max(...[...p.vertices].map(i=>positions[i][k])))}));
}
function attachment(material,p) {
  const cx=(p.min[0]+p.max[0])/2,side=cx>0?'left':'right';
  if(material==='Vest') {
    if(p.max[1]<.70)return {bone:side+'KneeCover',mode:p.max[2]-p.min[2]>.10?'flexible-knee-wrap':'rigid',role:'knee shell or flexible wrap'};
    if(p.max[1]<1.12&&p.min[2]>.16)return {bone:'pelvis',role:'groin shield and hanger'};
    if(Math.abs(cx)>.20&&p.min[1]>1.24)return {bone:side+'UpperArm',mode:p.max[1]>1.45?'shoulder-anchor':'rigid',role:'shoulder shell with attached strap and buckle'};
    return {bone:'chest',role:'vest body and torso attachments'};
  }
  if(material==='Equipment')return {bone:p.max[1]<1.20?'pelvis':'chest',role:'rigid pouch with a single mount'};
  if(material==='Head'&&p.max[1]<1.50)return {bone:'chest',role:'back vest strap stored in Head material'};
  return null;
}
function legClothWeights(position) {
  const side=position[0]>0?'left':'right',a=new Vector3(...SOLDIER_BONES.find(b=>b.name===side+'UpperLeg').at),d=new Vector3(...SOLDIER_BONES.find(b=>b.name===side+'LowerLeg').at).sub(a);
  const along=new Vector3(...position).sub(a).dot(d)/d.lengthSq(),t=Math.max(0,Math.min(1,(along-.82)/.36)),s=t*t*(3-2*t);
  return [[side+'UpperLeg',1-s],[side+'LowerLeg',s]];
}
function torsoGeometry(uvPatch) {
  const rings=[[.975,.14,.08],[1.04,.15,.095],[1.12,.155,.10],[1.22,.155,.102],[1.32,.155,.10],[1.39,.15,.09],[1.44,.135,.08],[1.465,.095,.06],[1.50,.054,.049]],segments=32;
  const positions=[],normals=[],uvs=[],joints=[],weights=[],indices=[];
  for(const[y,rx,rz]of rings)for(let j=0;j<=segments;j++){
    const angle=j/segments*Math.PI*2,p=new Vector3(rx*Math.cos(angle),y,rz*Math.sin(angle));positions.push(...p.toArray());
    normals.push(...new Vector3(Math.cos(angle)/rx,0,Math.sin(angle)/rz).normalize().toArray());
    uvs.push(uvPatch[0]+j/segments*uvPatch[2],uvPatch[1]+(y-.975)/.525*uvPatch[3]);
    // A broad three-joint transition avoids a narrow waist band collapsing under
    // mixed rotations. Sleeves own the arm blend; arm lifts cannot crush the torso.
    const u=Math.max(0,Math.min(1,(y-.90)/.60));
    const influences=[['pelvis',(1-u)**2],['spine',2*u*(1-u)],['chest',u*u]];
    const packed=packedWeights(influences);joints.push(...packed.ids);weights.push(...packed.weights);
  }
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<segments;j++){
    const a=r*(segments+1)+j,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  return {positions,normals,uvs,joints,weights,indices};
}
export async function generateSoldierSkin(nativeBytes,{output=new URL('../dist/soldier-skinned.glb',import.meta.url)}={}) {
  const native=nativeBytes||await readFile(new URL('../dist/soldier-rigged.glb',import.meta.url)),{g,binary,access}=readGLB(native),parts=[binary],proof=[];let clothKneeCoverRemovedVertices=0;
  const append=(values,type,componentType=5126)=>{const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type],typed=componentType===5123?new Uint16Array(values):new Float32Array(values),data=Buffer.from(typed.buffer);let offset=parts.reduce((n,b)=>n+b.length,0);const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}parts.push(data);
    const bufferView=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});const a={bufferView,componentType,count:values.length/n,type};
    if(type==='VEC3'){a.min=[0,1,2].map(i=>Math.min(...values.filter((_,j)=>j%3===i)));a.max=[0,1,2].map(i=>Math.max(...values.filter((_,j)=>j%3===i)));}
    g.accessors.push(a);return g.accessors.length-1;};
  for(const m of g.meshes){const p=m.primitives[0],positions=access(p.attributes.POSITION),joints=access(p.attributes.JOINTS_0),weights=access(p.attributes.WEIGHTS_0);
    if(m.name==='Body')for(let i=0;i<positions.length;i++)if(joints[i].some((id,k)=>weights[i][k]>0&&SOLDIER_BONES[id].name.endsWith('KneeCover'))){
      // Cloth must bend with the leg, not with the separate rigid pad helper.
      const packed=packedWeights(legClothWeights(positions[i]));
      joints[i]=packed.ids;weights[i]=packed.weights;clothKneeCoverRemovedVertices++;
    }
    for(const part of connectedParts(positions,access(p.indices).flat())){const mount=attachment(m.name,part);if(!mount)continue;
      for(const i of part.vertices){let influences=[[mount.bone,1]];
        if(mount.mode==='flexible-knee-wrap')influences=legClothWeights(positions[i]);
        if(mount.mode==='shoulder-anchor'){const t=Math.max(0,Math.min(1,(Math.abs(positions[i][0])-.154)/.081)),s=t*t*(3-2*t);influences=[['chest',1-s],[mount.bone,s]];}
        const packed=packedWeights(influences);joints[i]=packed.ids;weights[i]=packed.weights;
      }
      proof.push({material:m.name,firstTriangle:part.firstTriangle,vertices:part.vertices.length,min:part.min,max:part.max,...mount});
    }
    if(['Body','Vest','Equipment','Head'].includes(m.name)){p.attributes.JOINTS_0=append(joints.flat(),'VEC4',5123);p.attributes.WEIGHTS_0=append(weights.flat(),'VEC4');}
  }
  // This source has sleeves and trousers but no continuous hidden shirt torso.
  // Add a clearly authored inner garment. This reviewed fabric rectangle in the
  // original Body atlas excludes skin, boots and UV-island borders. No new image.
  const body=g.meshes.find(m=>m.name==='Body').primitives[0],patch=[.10,.15,.10,.19];
  const t=torsoGeometry(patch),primitive={attributes:{POSITION:append(t.positions,'VEC3'),NORMAL:append(t.normals,'VEC3'),TEXCOORD_0:append(t.uvs,'VEC2'),JOINTS_0:append(t.joints,'VEC4',5123),WEIGHTS_0:append(t.weights,'VEC4')},indices:append(t.indices,'SCALAR',5123),material:body.material};
  const mesh=g.meshes.length;g.meshes.push({name:'TorsoUnderlayer',primitives:[primitive]});const node=g.nodes.length;g.nodes.push({name:'Soldier:TorsoUnderlayer',mesh,skin:0});g.scenes[g.scene].nodes.push(node);
  g.asset.generator='CQB visual skin repair v13; native v9 skeleton/clips/collision and original images/UV/topology retained; authored inner garment added';
  const bin=Buffer.concat(parts);g.buffers=[{byteLength:bin.length}];const js=Buffer.from(JSON.stringify(g)),j=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]),b=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]),header=Buffer.alloc(20),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(b.length,0);bh.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,j,bh,b]),meta={version:'soldier-skin-v13',nativeV9Sha256:createHash('sha256').update(native).digest('hex'),sha256:createHash('sha256').update(glb).digest('hex'),bytes:glb.length,attachmentProof:proof,
    originalPrimitives:5,renderPrimitives:6,clothKneeCoverRemovedVertices,authoredTorso:{vertices:t.positions.length/3,triangles:t.indices.length/3,uvPatch:patch,provenance:'authored inner uniform surface; not original anatomy'},bonesChanged:false,clipsChanged:false,collisionChanged:false};
  await writeFile(output,glb);return {glb,meta};
}
