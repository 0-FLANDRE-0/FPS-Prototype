import {Vector3,Matrix4} from 'three';
import PROFILE from './internal-profile.json' with {type:'json'};
import {BODY_MESH_REGIONS} from './generated/body-mesh.js';
import {actorRotation} from './human-targets.js';
import {meshTriangles,solidMeshIntervals} from './armor-geometry.js';
export const INTERNAL_PROFILE=PROFILE;
// Read-only S1 envelope. The wound model clamps temporary/fragment radii to
// this value; one body query caches the whole depth interval for later 1D use.
export const INTERNAL_CAVITY_RADIUS_MAX_M=.15;
const V=a=>new Vector3(...a),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const eps=1e-9;
const boneMatrix=(rig,name)=>rig.byName.get(name).matrixWorld;
const insideDirection=new Vector3(.317,.531,.786).normalize();
function inside(triangles,point){return solidMeshIntervals(triangles,point,insideDirection,10).some(p=>p.startsInside);}
function pointBoundaryDistance(triangles,point){const target=new Vector3();return Math.min(...triangles.map(({triangle})=>point.distanceTo(triangle.closestPointToPoint(point,target))));}
function segmentSegmentDistance(a,b,c,d){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),den=A*C-B*B;
 let s=den>eps?clamp((B*E-C*D)/den):0,t=clamp((B*s+E)/Math.max(eps,C));s=clamp((B*t-D)/Math.max(eps,A));t=clamp((B*s+E)/Math.max(eps,C));
 return a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t));
}
function segmentBoundaryDistance(triangles,a,b){
 const direction=b.clone().sub(a),length=direction.length();if(length<eps)return pointBoundaryDistance(triangles,a);
 if(solidMeshIntervals(triangles,a,direction.clone().normalize(),length).some(p=>!p.completeExit&&p.startsInside&&Math.abs(p.exit-length)<1e-7)===false)return 0;
 let min=Math.min(pointBoundaryDistance(triangles,a),pointBoundaryDistance(triangles,b));
 for(const {triangle}of triangles)for(const [c,d]of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]])min=Math.min(min,segmentSegmentDistance(a,b,c,d));
 return min;
}
function domainFrame(rig,region){
 const bone=rig.byName.get(region.bone),i=rig.bones.indexOf(bone),bind=rig.skeleton.boneInverses[i].clone().invert(),inverse=bind.clone().invert();
 const vertices=region.vertices.map((_,i)=>i%3?null:new Vector3().fromArray(region.vertices,i).applyMatrix4(inverse)).filter(Boolean);
 const limb=/UpperArm|Forearm|UpperLeg|LowerLeg/.test(region.bone);
 const child=bone.children.find(b=>b.isBone&&!/KneeCover/.test(b.name));
 const axis=limb&&child?child.position.clone().normalize():new Vector3(0,1,0);
 const front=new Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize(),lateral=new Vector3().crossVectors(axis,front).normalize();
 const ts=vertices.map(v=>v.dot(axis)),min=Math.min(...ts),span=Math.max(...ts)-min;
 const triangles=meshTriangles(new Float32Array(vertices.flatMap(v=>v.toArray())),new Uint32Array(region.indices));
 function section(t){
  const offset=min+span*t,points=[];
  for(const {triangle}of triangles)for(const [a,b]of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]]){
   const da=a.dot(axis)-offset,db=b.dot(axis)-offset;
   if(da*db<0||Math.abs(da)<eps){const p=a.clone().lerp(b,Math.abs(da)<eps?0:da/(da-db));points.push(p);}
  }
  if(!points.length)throw Error('Missing body cross-section '+region.id+' '+t);
  // Section bounds initialize the center; fitting uses exact triangle distances.
  const xs=points.map(p=>p.dot(lateral)),zs=points.map(p=>p.dot(front));
  const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
  return {center:axis.clone().multiplyScalar(offset).addScaledVector(lateral,x).addScaledVector(front,z),rx:(Math.max(...xs)-Math.min(...xs))/2,rz:(Math.max(...zs)-Math.min(...zs))/2};
 }
 const point=([x,t,z])=>{
  const s=section(t),center=s.center.clone();
  if(!inside(triangles,center)){
   const candidates=[];for(let a=-.8;a<=.8;a+=.2)for(let b=-.8;b<=.8;b+=.2){const p=center.clone().addScaledVector(lateral,a*s.rx).addScaledVector(front,b*s.rz);if(inside(triangles,p))candidates.push(p);}
   candidates.sort((a,b)=>a.distanceToSquared(center)-b.distanceToSquared(center));if(!candidates.length)throw Error('No internal section '+region.id+' '+t);center.copy(candidates[0]);
  }
  const offset=lateral.clone().multiplyScalar(x*s.rx).addScaledVector(front,z*s.rz);
  let ratio=1;while(ratio>1e-6&&!inside(triangles,center.clone().addScaledVector(offset,ratio)))ratio*=.8;
  return center.addScaledVector(offset,ratio);
 };
 return {bone:region.bone,bind,inverse,axis,lateral,front,min,span,triangles,section,point,boneLength:child?.position.length()||span};
}
// Measurement only: rest mesh vertices + bind matrices, independent of H01 at/yaw.
export function buildInternalAnatomy(rig,{regions=BODY_MESH_REGIONS,profile=PROFILE}={}){
 const domains=new Map();
 for(const shape of profile.shapes)if(!domains.has(shape.domain))domains.set(shape.domain,domainFrame(rig,{...regions[shape.domain],id:shape.domain}));
 const shapes=profile.shapes.map(d=>{
  const f=domains.get(d.domain),axes=[f.lateral,f.axis,f.front];
  if(d.type==='capsuleChain'){
   // Subdivide normalized paths so curved fitted limbs are followed without
   // bridging their concavities. This is measured adaptation, not H01 offsets.
   const path=d.points.slice(1).flatMap((p,i)=>Array.from({length:12},(_,j)=>d.points[i].map((v,k)=>v+(p[k]-v)*j/12))).concat([d.points.at(-1)]);
   const segments=[];
   function fitSegment(pa,pb,depth=0){
    const a=f.point(pa),b=f.point(pb),sa=f.section(pa[1]),sb=f.section(pb[1]);
    const wanted=Math.min(sa.rx,sa.rz,sb.rx,sb.rz)*d.radiusRatio;
    if(!inside(f.triangles,a)||!inside(f.triangles,b))throw Error('Outside internal centerline '+d.id);
    const clearance=segmentBoundaryDistance(f.triangles,a,b);
    const radius=Math.min(wanted,clearance*.96);
    if(radius<=0&&depth<10){const middle=pa.map((v,i)=>(v+pb[i])/2);fitSegment(pa,middle,depth+1);fitSegment(middle,pb,depth+1);return;}
    if(radius<=0)throw Error('Outside internal path '+d.id);
    segments.push({a:a.toArray(),b:b.toArray(),radius,fitRatio:radius/wanted});
   }
   for(let i=1;i<path.length;i++)fitSegment(path[i-1],path[i]);
   return {...d,segments};
  }
  const center=f.point(d.center),s=f.section(d.center[1]),radii=[s.rx*d.radii[0],f.span*d.radii[1],s.rz*d.radii[2]];
  // The ellipsoid stays inside an inscribed sphere at its measured center.
  // This conservative bound works for concave fitted surfaces as well.
  const fit=inside(f.triangles,center)?Math.min(1,pointBoundaryDistance(f.triangles,center)/Math.max(...radii)):0;
  if(fit<=0)throw Error('Outside internal organ '+d.id);
  return {...d,center:center.toArray(),axes:axes.map(a=>a.toArray()),radii:radii.map(r=>r*Math.min(1,fit*.96)),fitRatio:Math.min(1,fit*.96)};
 });
 return {rig,profile,shapes,domains,measurements:[...domains].map(([domain,f])=>({domain,bone:f.bone,boneLength:f.boneLength,span:f.span,sections:[.15,.5,.85].map(t=>({t,...f.section(t),center:f.section(t).center.toArray()}))}))};
}
export function internalWorldShapes(anatomy,actor){
 const rotation=actorRotation(actor),translation=new Matrix4().makeRotationFromQuaternion(rotation).setPosition(V(actor.at));
 return anatomy.shapes.map(s=>{const matrix=translation.clone().multiply(boneMatrix(anatomy.rig,s.bone));
  return s.type==='capsuleChain'?{...s,segments:s.segments.map(seg=>({...seg,a:V(seg.a).applyMatrix4(matrix).toArray(),b:V(seg.b).applyMatrix4(matrix).toArray()}))}
   :{...s,center:V(s.center).applyMatrix4(matrix).toArray(),axes:s.axes.map(a=>V(a).transformDirection(matrix).toArray())};
 });
}
// Private pose cache: compare actual matrices, not render time or an assumed
// frame ID. A second synchronous shot shares the pose; any animation, IK,
// ragdoll or actor translation change invalidates it immediately.
const poseQueries=new WeakMap();
function internalQueryShapes(anatomy,actor){
 let cached=poseQueries.get(anatomy),valid=cached&&cached.actor===actor&&cached.source===anatomy.shapes&&cached.yaw===actor.yaw&&cached.at.every((v,i)=>v===actor.at[i]);
 if(valid)for(const [bone,values]of cached.matrices){const e=boneMatrix(anatomy.rig,bone).elements;for(let i=0;i<16;i++)if(e[i]!==values[i]){valid=false;break;}if(!valid)break;}
 if(valid)return cached.queries;
 if(!cached||cached.source!==anatomy.shapes){
  const world=internalWorldShapes(anatomy,actor),queries=world.map(s=>({shape:s,bounds:new Array(6),distances:(s.type==='capsuleChain'?s.segments:[s]).map(p=>({distance:primitiveDistance(s,p),bounds:new Array(6)}))}));
  cached={source:anatomy.shapes,at:[],matrices:[...new Set(anatomy.shapes.map(s=>s.bone))].map(bone=>[bone,new Array(16)]),queries,matrix:new Matrix4(),translation:new Matrix4(),vector:new Vector3()};poseQueries.set(anatomy,cached);
 }
 const translation=cached.translation.makeRotationFromQuaternion(actorRotation(actor)).setPosition(cached.vector.fromArray(actor.at)),v=cached.vector;
 for(let qi=0;qi<cached.queries.length;qi++){
  const query=cached.queries[qi],s=anatomy.shapes[qi],world=query.shape,matrix=cached.matrix.copy(translation).multiply(boneMatrix(anatomy.rig,s.bone)),bounds=query.bounds;
  for(let i=0;i<3;i++){bounds[i]=Infinity;bounds[i+3]=-Infinity;}
  if(s.type==='capsuleChain')for(let pi=0;pi<s.segments.length;pi++){
   const local=s.segments[pi],p=world.segments[pi],compiled=query.distances[pi];v.fromArray(local.a).applyMatrix4(matrix).toArray(p.a);v.fromArray(local.b).applyMatrix4(matrix).toArray(p.b);
   for(let i=0;i<3;i++){const lo=Math.min(p.a[i],p.b[i])-p.radius,hi=Math.max(p.a[i],p.b[i])+p.radius;compiled.bounds[i]=lo;compiled.bounds[i+3]=hi;bounds[i]=Math.min(bounds[i],lo);bounds[i+3]=Math.max(bounds[i+3],hi);}compiled.distance.update();
  }else{
   v.fromArray(s.center).applyMatrix4(matrix).toArray(world.center);for(let i=0;i<s.axes.length;i++)v.fromArray(s.axes[i]).transformDirection(matrix).toArray(world.axes[i]);
   const radius=Math.max(...s.radii)*(1+1e-12);for(let i=0;i<3;i++){bounds[i]=world.center[i]-radius;bounds[i+3]=world.center[i]+radius;query.distances[0].bounds[i]=bounds[i];query.distances[0].bounds[i+3]=bounds[i+3];}query.distances[0].distance.update();
  }
 }
 cached.actor=actor;cached.yaw=actor.yaw;for(let i=0;i<3;i++)cached.at[i]=actor.at[i];for(const[bone,values]of cached.matrices){const e=boneMatrix(anatomy.rig,bone).elements;for(let i=0;i<16;i++)values[i]=e[i];}return cached.queries;
}

function canReach(bounds,entry,direction,length,padding){
 let lo=0,hi=length;padding+=1e-7;
 for(let i=0;i<3;i++){const axis=i===0?'x':i===1?'y':'z',o=entry[axis],d=direction[axis],a=bounds[i]-padding,b=bounds[i+3]+padding;
  if(d===0){if(o<a||o>b)return false;continue;}
  const t0=(a-o)/d,t1=(b-o)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
 }return true;
}
// Same operations, summation order and 52 bisections as ellipsoidDistance.
// Hoist immutable coordinates and squared radii, and reuse scratch vectors.
function primitiveDistance(s,p){
 const point=new Vector3(),delta=new Vector3();
 if(s.type==='capsuleChain'){
  const a=V(p.a),ab=V(p.b).sub(a),closest=new Vector3();let den=Math.max(eps,ab.lengthSq());
  const distance=(entry,direction,t)=>{point.copy(entry).addScaledVector(direction,t);const u=clamp(delta.copy(point).sub(a).dot(ab)/den);return point.distanceTo(closest.copy(a).addScaledVector(ab,u));};
  distance.update=()=>{a.fromArray(p.a);ab.fromArray(p.b).sub(a);den=Math.max(eps,ab.lengthSq());};return distance;
 }
 const center=V(s.center),axes=s.axes.map(V),r=s.radii,r0=r[0],r1=r[1],r2=r[2],q0=r0**2,q1=r1**2,q2=r2**2;
 let x0,x1,x2,w0,w1,w2;const equation=l=>((0+(w0/(l+q0))**2)+(w1/(l+q1))**2)+(w2/(l+q2))**2-1;
 const distance=(entry,direction,t)=>{
  point.copy(entry).addScaledVector(direction,t);delta.copy(point).sub(center);x0=delta.dot(axes[0]);x1=delta.dot(axes[1]);x2=delta.dot(axes[2]);w0=r0*x0;w1=r1*x1;w2=r2*x2;
  if(((0+(x0/r0)**2)+(x1/r1)**2)+(x2/r2)**2<=1)return 0;
  let lo=0,hi=1;while(equation(hi)>0)hi*=2;
  for(let i=0;i<52;i++){const mid=(lo+hi)/2;if(equation(mid)>0)lo=mid;else hi=mid;}
  const l=(lo+hi)/2;return Math.sqrt(((0+(x0-x0*q0/(l+q0))**2)+(x1-x1*q1/(l+q1))**2)+(x2-x2*q2/(l+q2))**2);
 };
 distance.update=()=>{center.fromArray(s.center);for(let i=0;i<axes.length;i++)axes[i].fromArray(s.axes[i]);};return distance;
}
function pointSegmentDistance(point,a,b){const ab=b.clone().sub(a),t=clamp(point.clone().sub(a).dot(ab)/Math.max(eps,ab.lengthSq()));return point.distanceTo(a.clone().addScaledVector(ab,t));}
// Euclidean distance to the solid ellipsoid; positive Lagrange multiplier
// gives the actual sphere-swept boundary rather than inflated semiaxes.
function ellipsoidDistance(point,s){
 const delta=point.clone().sub(V(s.center)),x=s.axes.map(a=>delta.dot(V(a))),r=s.radii;
 if(x.reduce((sum,v,i)=>sum+(v/r[i])**2,0)<=1)return 0;
 const equation=l=>x.reduce((sum,v,i)=>sum+(r[i]*v/(l+r[i]**2))**2,0)-1;
 let lo=0,hi=1;while(equation(hi)>0)hi*=2;
 for(let i=0;i<52;i++){const mid=(lo+hi)/2;if(equation(mid)>0)lo=mid;else hi=mid;}
 const l=(lo+hi)/2;return Math.sqrt(x.reduce((sum,v,i)=>sum+(v-v*r[i]**2/(l+r[i]**2))**2,0));
}
// Convex distance on a segment. Root bisection retains entry/exit for grazing
// contacts and for starts/ends inside a shape, clipped to real occupied tissue.
function intervalAtMinimum(distance,length,radius,closest,min){
 let lo,hi;if(min>radius+1e-10)return {closest,min,interval:null};
 let entry=0,exit=length;
 if(distance(0)>radius){lo=0;hi=closest;for(let i=0;i<48;i++){const m=(lo+hi)/2;if(distance(m)>radius)lo=m;else hi=m;}entry=(lo+hi)/2;}
 if(distance(length)>radius){lo=closest;hi=length;for(let i=0;i<48;i++){const m=(lo+hi)/2;if(distance(m)>radius)hi=m;else lo=m;}exit=(lo+hi)/2;}
 return {closest,min,interval:[entry,exit]};
}
function intervalByDistance(distance,length,radius){
 let lo=0,hi=length;for(let i=0;i<60;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(distance(a)<distance(b))hi=b;else lo=a;}
 const closest=(lo+hi)/2,min=distance(closest);return intervalAtMinimum(distance,length,radius,closest,min);
}
function mergeIntervals(intervals){const result=[];for(const p of intervals.sort((a,b)=>a[0]-b[0])){const last=result.at(-1);if(last&&p[0]<=last[1]+1e-8)last[1]=Math.max(last[1],p[1]);else result.push([...p]);}return result;}
function cavityVolume(shape){
 if(shape.type!=='capsuleChain')return {volumeM3:4/3*Math.PI*shape.radii.reduce((a,b)=>a*b,1),volumeMethod:'ellipsoid 4πabc/3'};
 // Connected, densely fitted chain: sum cylinder volumes and one pair of end
 // caps. Unlike a sum of whole capsules, this does not count a sphere at every
 // subdivision. Bends, varying radii and overlapping branches remain an
 // explicit union approximation, not a mesh measurement of organ volume.
 const radius=Math.max(...shape.segments.map(s=>s.radius));
 return {volumeM3:shape.segments.reduce((sum,s)=>sum+Math.PI*s.radius**2*V(s.a).distanceTo(V(s.b)),0)+4/3*Math.PI*radius**3,volumeMethod:'capsule-chain tube union approximation: Σπr²L + 4πrMax³/3',
  ...(shape.kind==='vessel'?{diameterM:radius*2,diameterSource:'fitted original anatomical collider; game tuning, not measured human vessel lumen'}:{})};
}
const ENCLOSURE_BONES=Object.freeze({brain:['skull'],brainstem:['skull'],'cervical-upper-spinal-cord':['cervical-spine'],'cervical-lower-spinal-cord':['cervical-spine'],'thoracic-spinal-cord':['thoracic-spine'],'lumbar-spinal-cord':['lumbar-spine']});
function subtractIntervals(source,holes){
 let result=source.map(p=>[...p]);
 for(const [a,b]of holes){const next=[];for(const [lo,hi]of result){if(b<=lo||a>=hi)next.push([lo,hi]);else{if(a>lo)next.push([lo,a]);if(b<hi)next.push([b,hi]);}}result=next;}
 return result;
}
// Existing bone colliders are solid diagnostic envelopes. S2 resistance uses
// their occupied intervals minus directly intersected enclosed neural tissue;
// this avoids treating the brain/cord interior as a solid slab of cortical bone.
// Original internalHits (including original fracture evidence) stay unchanged.
export function tissueIntervalsFromGeometry(internalHits){
 return internalHits.flatMap(h=>{
  if(h.kind==='bone'){
   const holes=internalHits.filter(p=>(ENCLOSURE_BONES[p.id]||[]).includes(h.id)).flatMap(p=>p.intervals||[]);
   const intervals=subtractIntervals(h.intervals||[],mergeIntervals(holes));
   return intervals.length?[{id:h.id,identifier:h.identifier,kind:'bone',boneType:'cortical',intervals,source:'original fitted bone collider; enclosed neural intervals subtracted; uniform cortical approximation'}]:[];
  }
  if(h.organ==='lung')return [{id:h.id,identifier:h.identifier,kind:'lung',intervals:h.intervals.map(p=>[...p]),source:'original fitted lung collider'}];
  return [];
 });
}
export function intersectInternalBody(anatomy,actor,body,bulletRadiusM){
 const direction=V(body.incomingDirection),entry=V(body.point),hits=[],near=[],cavity=[];
 if(!body.bodyEntered)return {internalHits:[],nearMisses:[],cavityCandidates:[],tissueIntervals:[],enclosureHits:[]};
 const length=Math.max(0,body.exitDistance-body.entryDistance),world=internalQueryShapes(anatomy,actor);
 for(const query of world){
  const s=query.shape,padding=s.kind==='bone'?bulletRadiusM:Math.max(INTERNAL_CAVITY_RADIUS_MAX_M,bulletRadiusM+anatomy.profile.nearMissM);
  if(!canReach(query.bounds,entry,direction,length,padding))continue;
  const intervals=[],cavityIntervals=[];let min=Infinity,closest=0,centerline=Infinity;
  const primitives=s.type==='capsuleChain'?s.segments:[s];
  for(let pi=0;pi<primitives.length;pi++){
   const p=primitives[pi],compiled=query.distances[pi];
   if(!canReach(compiled.bounds,entry,direction,length,padding))continue;
   const primitive=compiled.distance,distance=t=>primitive(entry,direction,t);
   const expanded=bulletRadiusM+(s.type==='capsuleChain'?p.radius:0),result=intervalByDistance(distance,length,expanded);
   const gap=Math.max(0,result.min-expanded);
   if(gap<min){min=gap;closest=result.closest;centerline=result.min;}
   if(result.interval)intervals.push(result.interval);
   if(s.kind!=='bone'){
    const cavityRadius=INTERNAL_CAVITY_RADIUS_MAX_M+(s.type==='capsuleChain'?p.radius:0);
    // Reuse the exact same closest-point search. No second world-shape query
    // and no new geometry work per wound-curve cell is needed.
    const expandedInterval=intervalAtMinimum(distance,length,cavityRadius,result.closest,result.min).interval;
    if(expandedInterval)cavityIntervals.push(expandedInterval);
   }
  }
  const merged=mergeIntervals(intervals),record={id:s.id,kind:s.kind,identifier:s.identifier,bone:s.bone,domain:s.domain,vesselKind:s.vesselKind||null,organ:s.organ||null,cordRegion:s.cordRegion||null,candidate:s.candidate||(s.kind==='organ'&&/_candidate$/.test(s.identifier)?s.identifier:null),centerlineDistanceM:s.type==='capsuleChain'?centerline:pointSegmentDistance(V(s.center),entry,entry.clone().addScaledVector(direction,length)),distanceM:min,closestDepthM:closest,bulletRadiusM};
  if(merged.length)hits.push({...record,entryDepthM:merged[0][0],exitDepthM:merged.at(-1)[1],traversedLengthM:merged.reduce((n,[a,b])=>n+b-a,0),intervals:merged});
  else if(s.kind!=='bone'&&min<=anatomy.profile.nearMissM)near.push(record);
  if(cavityIntervals.length)cavity.push({...record,...cavityVolume(s),enclosureBoneIds:ENCLOSURE_BONES[s.id]||[],surfaceDistanceM:min+bulletRadiusM,actualIntersection:merged.length>0,
   cavityRadiusMaxM:INTERNAL_CAVITY_RADIUS_MAX_M,cavityIntervals:mergeIntervals(cavityIntervals)});
 }
 return {internalHits:hits.sort((a,b)=>a.entryDepthM-b.entryDepthM||a.id.localeCompare(b.id)),nearMisses:near.sort((a,b)=>a.distanceM-b.distanceM),cavityCandidates:cavity.sort((a,b)=>a.closestDepthM-b.closestDepthM||a.id.localeCompare(b.id)),
  tissueIntervals:tissueIntervalsFromGeometry(hits),enclosureHits:hits.filter(h=>h.kind==='bone').map(h=>({id:h.id,kind:h.kind,identifier:h.identifier,intervals:h.intervals.map(p=>[...p])}))};
}
export function validateInternalContainment(anatomy,{actor=null}={}){
 const failures=[];
 const shapes=actor?internalWorldShapes(anatomy,actor):anatomy.shapes;
 for(const s of shapes){let f=anatomy.domains.get(s.domain);
  if(actor){const matrix=new Matrix4().makeRotationFromQuaternion(actorRotation(actor)).setPosition(V(actor.at)).multiply(boneMatrix(anatomy.rig,s.bone));f={...f,triangles:f.triangles.map(t=>{const triangle=t.triangle.clone();for(const p of [triangle.a,triangle.b,triangle.c])p.applyMatrix4(matrix);return {triangle,normal:triangle.getNormal(new Vector3())};})};}
  if(s.type==='capsuleChain')for(const seg of s.segments){const a=V(seg.a),b=V(seg.b);if(!inside(f.triangles,a)||!inside(f.triangles,b)||segmentBoundaryDistance(f.triangles,a,b)+1e-8<seg.radius)failures.push({id:s.id,type:'capsule boundary'});}
  else if(!inside(f.triangles,V(s.center))||pointBoundaryDistance(f.triangles,V(s.center))+1e-8<Math.max(...s.radii))failures.push({id:s.id,type:'ellipsoid bound'});
 }
 return failures;
}
