import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3, Triangle, Scene } from 'three';
import { extractHeadMesh } from '../scripts/training-head-mesh.mjs';
import { HEAD_MESH_SOURCE, HEAD_COLLISION_MESH as head, HELMET_COLLISION_MESH as helmet, FRONT_NECK_MESH as neck } from '../apps/training/src/generated/head-mesh.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { BODY_PROFILE, HUMAN_TARGETS, actorRotation, worldPoint, bodyMesh, shapePose } from '../apps/training/src/human-targets.js';
import { ARMOR_PROFILE, armorVertices, armorIndices } from '../apps/training/src/armor-targets.js';
import { createArmorRegions } from '../apps/training/src/armor-model.js';
import { traceShot as traceWithProtection } from '../apps/training/src/ballistics.js';
import { shotBallistics } from '../apps/training/src/catalog.js';
import { cleanSettings } from '../apps/training/src/settings.js';

// Geometry-only queries retain the pinned anatomical boundary fixtures.
const traceShot=(p,o,d,b,options={})=>traceWithProtection(p,o,d,b,{...options,geometryOnly:true});
async function originalTriangles() {
  const b=await readFile(new URL('../apps/training/assets/soldier-character.glb',import.meta.url));
  assert.equal(createHash('sha256').update(b).digest('hex'),HEAD_MESH_SOURCE.sha256);
  const length=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+length)),binary=28+length;
  const primitive=g.meshes.flatMap(m=>m.primitives).find(p=>g.materials[p.material].name==='Head');
  const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView],ind=g.accessors[primitive.indices],iv=g.bufferViews[ind.bufferView];
  const scale=1.8/(10-.0027000000700351957);
  const vertex=id=>{const p=binary+v.byteOffset+(a.byteOffset||0)+id*(v.byteStride||12);return new Vector3((b.readFloatLE(p)+.00129997730255)*scale,(b.readFloatLE(p+8)-.0027000000700351957)*scale,(-b.readFloatLE(p+4)+.0404999852180473)*scale);};
  return Array.from({length:ind.count/3},(_,i)=>new Triangle(...[0,1,2].map(j=>vertex(b.readUInt32LE(binary+(iv.byteOffset||0)+(ind.byteOffset||0)+(i*3+j)*4)))));
}
const vector=(mesh,id)=>new Vector3().fromArray(mesh.vertices,id*3);
const fire=(p,point,direction=new Vector3(0,0,-1))=>traceShot(p,point,direction,shotBallistics('556_m855'),{shotId:71});

test('pinned head extraction reproduces the asset and helmet is the actual shell, excluding goggles and straps',async()=>{
  const r=await extractHeadMesh();assert.deepEqual(r,{source:HEAD_MESH_SOURCE,body:head,helmet,frontNeck:neck});
  const original=await originalTriangles();assert.equal(helmet.indices.length/3,466);
  for(let i=0;i<466;i++){const t=original[helmet.sourceTriangleIds[i]];for(let j=0;j<3;j++)assert.ok(vector(helmet,helmet.indices[i*3+j]).distanceTo([t.a,t.b,t.c][j])<1e-9);}
  assert.equal(ARMOR_PROFILE.helmet.identity,'user-selected-6b47');assert.equal(ARMOR_PROFILE.helmet.itemId,'helmet_6b47_test');
});

test('front neck follows original Head faces, retains its curved source contour and adds no artificial cap',async()=>{
  const original=await originalTriangles();assert.equal(neck.provenance,'source-face-trimmed-front-collar');assert.ok(neck.indices.length/3>100);
  const edges=new Map();
  for(let i=0;i<neck.indices.length;i+=3){const t=original[neck.sourceTriangleIds[i/3]];
    for(let j=0;j<3;j++){const p=vector(neck,neck.indices[i+j]);assert.ok(t.closestPointToPoint(p,new Vector3()).distanceTo(p)<1e-9);
      assert.ok(p.y<=1.535+.038*(p.x/.116)**2+1e-10);const q=vector(neck,neck.indices[i+(j+1)%3]);
      const key=[p.toArray().map(x=>Math.round(x*1e7)).join(','),q.toArray().map(x=>Math.round(x*1e7)).join(',')].sort().join(':');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].some(n=>n===1),'The surface stays open; it is not a filled hull');
  assert.ok(neck.bounds.max[0]-neck.bounds.min[0]>.22);assert.ok(neck.bounds.max[1]-neck.bounds.min[1]>.13);
  assert.equal(ARMOR_PROFILE.shapes.find(s=>s.id==='soft-neck-front').thickness,null);
});

test('mesh-fitted head is closed and outward wound; observed anatomy and authored hidden scalp remain separate',async()=>{
  const edges=new Map();let volume=0;
  for(let i=0;i<head.indices.length;i+=3){const ids=head.indices.slice(i,i+3),[a,b,c]=ids.map(id=>vector(head,id));volume+=a.dot(b.clone().cross(c))/6;
    for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const e=edges.get(key)||{n:0,orientation:0};e.n++;e.orientation+=a<b?1:-1;edges.set(key,e);}}
  for(const e of edges.values()){assert.equal(e.n,2);assert.equal(e.orientation,0);}assert.ok(volume>0);
  assert.ok(head.fitting.sourceSamples>300);assert.ok(head.fitting.authoredSamples>0);
  const excluded=new Set(head.fitting.excludedCollarSourceTriangleIds);
  assert.equal(excluded.size,188);
  assert.ok(neck.sourceTriangleIds.every(id=>excluded.has(id)));
  assert.ok(head.fitting.sourceTrianglePerSample.every(id=>id===null||!excluded.has(id)), 'Collar upper folds cannot become head samples');
  const original=await originalTriangles();for(const[id,i]of head.fitting.sourceTrianglePerSample.map((id,i)=>[id,i]))if(id!==null){assert.ok(id>=466);assert.ok(original[id].closestPointToPoint(vector(head,i),new Vector3()).distanceTo(vector(head,i))<1e-9);}
  const shape=BODY_PROFILE.find(s=>s.id==='head'),data=bodyMesh(shape);assert.equal(shape.type,'trimesh');assert.equal(shape.closed,true);
  for(let i=0;i<data.vertices.length;i++)assert.ok(Math.abs(data.vertices[i]+shape.at[i%3]-head.vertices[i])<1e-8);
});

test('the head stays behind the upper collar contour; the jaw and eyes remain hittable',async()=>{
  const p=await createPhysics();
  try{
    const origin=new Vector3(17.09,1.57,0),direction=new Vector3(0,0,-1);
    // At this source collar fold the old head extended to Z=.06676. The body
    // must no longer be reached at that outer contour; it remains behind armor.
    assert.notEqual(p.contact(origin,direction,3.94)?.address?.shapeId,'head');
    const behind=fire(p,origin);assert.equal(behind.hit.address.shapeId,'head');
    assert.ok(behind.hit.address.localPoint[2]<.05);
    for(const y of[1.58,1.65])assert.equal(fire(p,new Vector3(17,y,0)).hit.address.shapeId,'head');
  }finally{p.dispose();}
});

test('real Rapier distinguishes exposed eyes/jaw, helmet-covered crown and helmet-only rim at rotated poses',async()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/3]){
    const actor={...HUMAN_TARGETS[0],at:[17,0,-4],yaw},p=await createPhysics({humanTargets:[actor]});
    try{
      const direction=new Vector3(0,0,-1).applyQuaternion(actorRotation(actor));
      for(const[y,zone,coverage]of[[1.65,'upper',false],[1.58,'lower',false],[1.75,'forehead',true]]){
        const t=fire(p,worldPoint(actor,[0,y,1]),direction);assert.equal(t.hit.address.shapeId,'head');assert.equal(t.hit.address.zone,zone);
        assert.equal(t.armorContacts.some(c=>c.kind==='helmet'),coverage);assert.equal(t.residual.barrierCount,0);assert.equal(t.residual.stability,1);}
      const rim=fire(p,worldPoint(actor,[.11,1.70,1]),direction);assert.notEqual(rim.hit?.kind,'human');assert.ok(rim.armorContacts.some(c=>c.kind==='helmet'));
    }finally{p.dispose();}
  }
});

test('head/helmet surfaces share diagnostic geometry and helmet observation adds no RNG, loss or body hit',async()=>{
  const p=await createPhysics(),plain=await createPhysics({armorProfile:null}),scene=new Scene(),view=createArmorRegions(scene);
  try{
    for(const[x,y]of[[0,1.65],[0,1.75],[.11,1.70]]){
      const run=p=>{let draws=0;const r=traceShot(p,new Vector3(17+x,y,0),new Vector3(0,0,-1),shotBallistics('556_m855'),{random:()=>{draws++;return .5;}});return {draws,...r};};
      const a=run(p),b=run(plain);assert.deepEqual(a.residual,b.residual);assert.equal(a.draws,b.draws);assert.equal(a.reason,b.reason);assert.equal(a.hit?.kind,b.hit?.kind);}
    const shape=BODY_PROFILE.find(s=>s.id==='head'),sensor=[...p.surface.entries()].find(([,s])=>s.kind==='human'&&s.shape.id==='head');
    assert.equal(p.world.getCollider(sensor[0]).shapeType(),6);assert.ok(p.world.getCollider(sensor[0]).isSensor());assert.ok(shapePose(HUMAN_TARGETS[0],shape).position.y>1.6);
    const s=ARMOR_PROFILE.shapes.find(s=>s.kind==='helmet'),mesh=scene.getObjectByName('helmetArmorRegions').children.find(m=>m.isMesh);
    assert.deepEqual(mesh.geometry.attributes.position.array,armorVertices(s));assert.deepEqual(mesh.geometry.index.array,armorIndices(s));
    view.setVisible(false,false,true);assert.equal(view.snapshot().helmetVisible,true);assert.equal(view.snapshot().softVisible,false);
    assert.equal(cleanSettings({helmetRegions:true}).helmetRegions,true);assert.equal(cleanSettings({helmetRegions:'true'}).helmetRegions,false);
    const meta=view.snapshot();meta.profile.helmet.skull.shellArmor=100;assert.equal(view.snapshot().profile.helmet.skull.shellArmor,23);
  }finally{view.dispose();p.dispose();plain.dispose();}
});
