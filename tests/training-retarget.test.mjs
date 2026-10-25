import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {Vector3} from 'three';
import {createPhysics} from '../apps/training/src/physics.js';import {BODY_PROFILE,bodyMesh,shapePose} from '../apps/training/src/human-targets.js';
import {armorPose} from '../apps/training/src/armor-targets.js';import {withDebugSoldier} from '../apps/training/src/debug/soldier.js';
import {loadRigOnlyGLB,retargetMixamoIdle,debugRetargetPlayer} from '../apps/training/src/debug/retarget.js';
test('provided Mixamo Idle retarget has stable v9 keys, finite samples, planted soles and synchronized body/armor; debug restores A',async()=>{
 const binary=await readFile(new URL('fixtures/models/military_tactical_suit_lowpolygameready.glb',import.meta.url));const source=await loadRigOnlyGLB(binary);
 assert.equal(source.skeleton.bones.length,88);assert.equal(source.clip.name,'Idle_Animation');assert.equal(source.originalChannelCount,265);
 assert.equal(source.originalTrackCount,260); // Five mesh morph channels are omitted by the rig-only loader.
 const p=await createPhysics();try{
  const initial=p.humanRigs.get('H01').snapshot();
  await withDebugSoldier(p,null,null,async({rig,sync})=>{
   const result=retargetMixamoIdle(rig,source);assert.equal(result.mapping.length,24);assert.equal(result.mapping.filter(r=>r.mixamo).length,21);
   assert.ok(result.mapping.some(r=>r.v9==='chest'&&r.sourceName.includes('Spine2')));
   assert.ok(!result.mapping.some(r=>r.mixamo==='mixamorig:Spine1'));
   const player=debugRetargetPlayer(rig,result.clip);try{
    for(let time=0;time<result.clip.duration;time+=1/30){player.sample(time);sync();
     for(const bone of rig.bones)assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
     for(const s of p.humanSensors){const pose=shapePose(s.actor,s.shape,rig);assert.ok(new Vector3(...Object.values(s.collider.translation())).distanceTo(pose.position)<1e-6);}
     for(const s of p.armorSensors){const pose=armorPose(s.actor,s.shape,rig);assert.ok(new Vector3(...Object.values(s.collider.translation())).distanceTo(pose.position)<1e-6);}
     for(const shape of BODY_PROFILE.filter(s=>s.id.endsWith('foot'))){const v=bodyMesh(shape).vertices;let bottom=Infinity;
      for(let i=0;i<v.length;i+=3)bottom=Math.min(bottom,new Vector3(v[i]+shape.at[0],v[i+1]+shape.at[1],v[i+2]+shape.at[2]).applyMatrix4(rig.delta(shape.bone)).y);
      assert.ok(Math.abs(bottom)<=.02,`sole ${bottom}`);
     }
    }
   }finally{player.dispose();}
  });assert.deepEqual(p.humanRigs.get('H01').snapshot(),initial);
 }finally{p.dispose();}
});
