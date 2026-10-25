import{BufferGeometry,BufferAttribute,SkinnedMesh,Matrix4,SphereGeometry,CylinderGeometry,MeshStandardMaterial,DoubleSide}from'three';
import{HEAD_VISUAL_LAYOUT}from'./equipment-head-layout.js';
const collarTriangles=new Set(HEAD_VISUAL_LAYOUT.collarTriangles);
const collarHeight=p=>HEAD_VISUAL_LAYOUT.rim.centerY+HEAD_VISUAL_LAYOUT.rim.sideRiseM*(p.x/HEAD_VISUAL_LAYOUT.rim.halfWidthM)**2;
const splitCache=new WeakMap();
function dominant(geometry,rig,v){const ids=geometry.attributes.skinIndex,w=geometry.attributes.skinWeight;let at=0;for(let j=1;j<4;j++)if(w.getComponent(v,j)>w.getComponent(v,at))at=j;return rig.bones[ids.getComponent(v,at)].name;}
export function equipmentTrianglePart(name,bones,triangle,point=null){
 name=name.replace(/^Soldier/,'');
 // Despite the generic material name, this primitive contains both eyeballs
 // and their wet edge surfaces. The goggle lens is in the Head primitive.
 if(name==='material')return'body';
 if(name==='Head'){
  if(collarTriangles.has(triangle))return point&&point.y>collarHeight(point)?'body':'rig';
  if(HEAD_VISUAL_LAYOUT.bodyRanges.some(([a,b])=>triangle>=a&&triangle<=b))return'body';
  return'helmet';
 }
 if(name==='Vest')return bones.filter(b=>/Leg|Foot|KneeCover/.test(b)).length>=2?'body':'rig';
 if(name==='Equipment')return bones.filter(b=>b==='pelvis').length>=2?'belt':'rig';
 return'body';
}
// Cut only the reviewed collar surface. Both complementary polygons use identical
// edge points/UVs/weights, keeping the face covering and its smooth collar rim.
// Skin UV islands are assigned to the body before this path and never become gear.
function headGeometries(source,rig){
 const g=source.geometry,idx=g.index,parts=new Map(),attrs=g.attributes;
 if(attrs.position.count!==HEAD_VISUAL_LAYOUT.headVertices||idx.count/3!==HEAD_VISUAL_LAYOUT.headTriangles)throw Error('Review changed soldier Head visual topology');
 const at=v=>Object.fromEntries(Object.entries(attrs).map(([key,a])=>[key,Array.from({length:a.itemSize},(_,i)=>a.getComponent(v,i))]));
 const point=v=>({x:v.position[0],y:v.position[1],z:v.position[2]});
 const side=v=>point(v).y-collarHeight(point(v));
 function mix(a,b,t){
  const result={};for(const[key,x]of Object.entries(a))if(key!=='skinIndex'&&key!=='skinWeight')result[key]=x.map((v,i)=>v+(b[key][i]-v)*t);
  const weights=new Map();for(const[v,f]of[[a,1-t],[b,t]])for(let i=0;i<4;i++)weights.set(v.skinIndex[i],(weights.get(v.skinIndex[i])||0)+v.skinWeight[i]*f);
  const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,x)=>n+x[1],0);result.skinIndex=Array(4).fill(0);result.skinWeight=Array(4).fill(0);top.forEach(([id,w],i)=>{result.skinIndex[i]=id;result.skinWeight[i]=w/sum;});
  for(const key of['normal','tangent'])if(result[key]){const length=Math.hypot(...result[key].slice(0,3));if(length)for(let i=0;i<3;i++)result[key][i]/=length;}
  return result;
 }
 function emit(part,polygon){
  if(!parts.has(part))parts.set(part,Object.fromEntries(Object.keys(attrs).map(k=>[k,[]])));const values=parts.get(part);
  for(let i=1;i+1<polygon.length;i++){
   const tri=[polygon[0],polygon[i],polygon[i+1]],a=tri[0].position,b=tri[1].position,c=tri[2].position,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);if(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])<1e-12)continue;
   for(const v of tri)for(const[key,value]of Object.entries(v))values[key].push(...value);
  }
 }
 for(let i=0;i<idx.count;i+=3){const vertices=[0,1,2].map(j=>at(idx.getX(i+j))),triangle=i/3;
  if(!collarTriangles.has(triangle)){emit(equipmentTrianglePart('Head',[],triangle),vertices);continue;}
  for(const part of['rig','body']){const polygon=[],inside=v=>part==='rig'?side(v)<=0:side(v)>=0;for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3],inA=inside(a),inB=inside(b);if(inA)polygon.push(a);if(inA!==inB){let lo=0,hi=1;for(let k=0;k<45;k++){const t=(lo+hi)/2;if(inside(mix(a,b,t))===inA)lo=t;else hi=t;}polygon.push(mix(a,b,(lo+hi)/2));}}emit(part,polygon);}
 }
 return[...parts].map(([part,values])=>{const geometry=new BufferGeometry();for(const[key,array]of Object.entries(values)){const attribute=attrs[key];geometry.setAttribute(key,new BufferAttribute(new attribute.array.constructor(array),attribute.itemSize,attribute.normalized));}geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));geometry.computeBoundingSphere();return{part,geometry};});
}
function geometries(source,rig){
 let cached=splitCache.get(source.geometry);if(cached)return cached;
 if(source.name.replace(/^Soldier/,'')==='Head'){cached=headGeometries(source,rig);splitCache.set(source.geometry,cached);return cached;}
 const g=source.geometry,idx=g.index,parts=new Map(),n=idx?idx.count:g.attributes.position.count;
 for(let i=0;i<n;i+=3){const vertices=[0,1,2].map(j=>idx?idx.getX(i+j):i+j),part=equipmentTrianglePart(source.name,vertices.map(v=>dominant(g,rig,v)),i/3,{x:vertices.reduce((n,v)=>n+g.attributes.position.getX(v),0)/3,y:vertices.reduce((n,v)=>n+g.attributes.position.getY(v),0)/3,z:vertices.reduce((n,v)=>n+g.attributes.position.getZ(v),0)/3});if(!parts.has(part))parts.set(part,[]);parts.get(part).push(...vertices);}
 cached=[...parts].map(([part,indices])=>{const geometry=new BufferGeometry();for(const[key,value]of Object.entries(g.attributes))geometry.setAttribute(key,value);geometry.setIndex(indices);geometry.computeBoundingSphere();return{part,geometry};});splitCache.set(g,cached);return cached;
}
function balaclava(rig){
 const g=new SphereGeometry(1,28,18),p=g.attributes.position,head=rig.bones.findIndex(b=>b.name==='head'),indices=[],ids=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
 for(let i=0;i<p.count;i++){p.setXYZ(i,p.getX(i)*.085,p.getY(i)*.124+1.663,p.getZ(i)*.095+.065);ids[i*4]=head;weights[i*4]=1;}
 // Authored eye opening leaves existing source face pieces visible; scalp is closed.
 for(let i=0;i<g.index.count;i+=3){const v=[0,1,2].map(j=>g.index.getX(i+j)),y=v.reduce((n,k)=>n+p.getY(k),0)/3,z=v.reduce((n,k)=>n+p.getZ(k),0)/3;if(y>1.61&&y<1.70&&z>.123)continue;indices.push(...v);}
 g.setIndex(indices);g.setAttribute('skinIndex',new BufferAttribute(ids,4));g.setAttribute('skinWeight',new BufferAttribute(weights,4));g.computeVertexNormals();
 const material=new MeshStandardMaterial({color:0x24282a,roughness:.96,side:DoubleSide});const mesh=new SkinnedMesh(g,material);mesh.name='AuthoredBalaclava';mesh.bindMode='detached';mesh.bind(rig.skeleton,new Matrix4());mesh.frustumCulled=false;mesh.userData.m6Authored=true;return mesh;
}
export function createEquipmentMeshes(sources,rig,group){
 const parts={helmet:[],rig:[],belt:[],body:[]},rows=[];
 for(const source of sources)for(const{part,geometry}of geometries(source,rig)){
  const mesh=new SkinnedMesh(geometry,source.material);mesh.name=source.name+':'+part;mesh.bindMode='detached';mesh.bind(rig.skeleton,new Matrix4());mesh.frustumCulled=false;mesh.userData.m6Part=part;mesh.userData.m6FullGeometry=geometry;group.add(mesh);parts[part].push(mesh);rows.push({source:source.name,part,triangles:geometry.index.count/3});
 }
 const cover=balaclava(rig);
 const ng=new CylinderGeometry(.061,.052,.14,24,2,true),np=ng.attributes.position,ni=new Uint16Array(np.count*4),nw=new Float32Array(np.count*4),neckIndex=rig.bones.findIndex(b=>b.name==='neck');for(let i=0;i<np.count;i++){const y=np.getY(i)+1.54,u=(y-1.47)/.14;np.setXYZ(i,np.getX(i),y,np.getZ(i)+u*.045);ni[i*4]=neckIndex;nw[i*4]=1;}ng.setAttribute('skinIndex',new BufferAttribute(ni,4));ng.setAttribute('skinWeight',new BufferAttribute(nw,4));const neck=new SkinnedMesh(ng,cover.material);neck.name='AuthoredBalaclavaNeck';neck.bindMode='detached';neck.bind(rig.skeleton,new Matrix4());neck.frustumCulled=false;neck.userData.m6Authored=true;neck.userData.m6Part='body';group.add(neck);parts.body.push(neck);cover.userData.m6Part='body';group.add(cover);parts.body.push(cover);
 function setWorn({helmet=true,rig:hasRig=true,belt=true}={}){for(const part of['helmet','rig','belt'])for(const mesh of parts[part])mesh.visible=part==='helmet'?helmet:part==='rig'?hasRig:belt;cover.visible=!helmet;neck.visible=!hasRig;for(const mesh of parts.body)if(mesh.name.includes('TorsoUnderlayer:'))mesh.visible=!hasRig;}
 setWorn();return{parts,rows,cover,setWorn,dispose(){cover.geometry.dispose();cover.material.dispose();}};
}
