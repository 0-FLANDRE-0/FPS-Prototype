import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {BRACE_TUNING,fallDirection,createFallBrace,updateFallBrace} from '../apps/training/src/fall-brace.js';
function fixture({offset=[0,0,.10],velocity=[0,0,0]}={}){
 const contact={left:false,right:false,head:false},parts=new Map(),floor={handle:1},world={forEachCollider:f=>f(floor),getCollider:()=>floor};
 for(const [name,mass,point]of [['chest',80,[offset[0],1,offset[2]]],['leftFoot',0,[-.1,0,0]],['rightFoot',0,[.1,0,0]],['leftHand',0,[.3,.8,.2]],['rightHand',0,[-.3,.8,.2]],['head',0,[0,1.6,.1]]]){
  const side=name==='head'?'head':name.startsWith('left')?'left':'right';
  parts.set(name,{bone:name,mass,body:{worldCom:()=>new Vector3(...point),linvel:()=>new Vector3(...velocity),translation:()=>new Vector3(...point)},collider:{contactCollider:()=>contact[side]?{distance:.002,normal1:{x:0,y:1,z:0},point1:{x:0,y:0,z:0}}:null}});
 }
 return{parts,physics:{world,surface:new Map([[1,{kind:'floor'}]])},contact};
}
const awake={dead:false,unconscious:false,collapse:true,consciousness:.8,arms:{left:1,right:.5}};
test('protective reach follows initial COM tipping or a short moving COM prediction, never actor facing',()=>{
 const standing=fallDirection(fixture({offset:[.1,0,0],velocity:[0,0,-1]}),{clip:'aim'});assert.deepEqual(standing.direction.toArray(),[1,0,0]);
 const neutral=fallDirection(fixture({offset:[0,0,0],velocity:[0,0,-1]}),{clip:'aim'});assert.deepEqual(neutral.direction.toArray(),[0,0,-1]);assert.equal(neutral.source,'initial-com-velocity');
 const walk=fallDirection(fixture({offset:[0,0,-.05],velocity:[0,0,1.4]}),{clip:'walk'});assert.ok(walk.direction.distanceTo(new Vector3(0,0,1))<1e-12);assert.equal(walk.source,'initial-predicted-com-offset');
 const symmetric=fallDirection(fixture({offset:[0,0,0]}));assert.deepEqual(symmetric.direction.toArray(),[0,0,0]);
});
test('conscious arms hold until actual hand-floor contact, then release over the configured fade',()=>{
 const r=fixture();createFallBrace(r,{time:0});
 for(let i=0;i<120;i++)assert.equal(updateFallBrace(r,awake,1/60,i/60),true);
 assert.deepEqual(r.brace.armStrength,{left:.8,right:.4});assert.equal(r.brace.firstHandContactS,null);assert.equal(r.brace.done,false);
 r.contact.left=true;updateFallBrace(r,awake,1/60,2);const first=r.brace.firstHandContactS;assert.ok(first>=2);assert.ok(r.brace.armStrength.left>0);
 for(let i=0;i<26;i++)updateFallBrace(r,awake,1/60,2+(i+1)/60);
 assert.ok(r.brace.armStrength.left>0);assert.equal(r.brace.done,false);
 updateFallBrace(r,awake,1/60,2.45);assert.ok(r.brace.armStrength.left<1e-12);assert.equal(r.brace.done,true);assert.equal(r.brace.retention,'released');
 assert.equal(BRACE_TUNING.fadeS,.45);assert.ok(BRACE_TUNING.fadeS>=.3&&BRACE_TUNING.fadeS<=.6);assert.doesNotThrow(()=>JSON.stringify(r.brace));
});
test('unconscious and dead falls never brace, and later unconsciousness cancels a conscious reach',()=>{
 for(const medical of [{...awake,unconscious:true},{...awake,dead:true}]){const r=fixture();createFallBrace(r);assert.equal(updateFallBrace(r,medical,1/60,0),false);assert.equal(r.brace.enabled,false);assert.deepEqual(r.brace.armStrength,{left:0,right:0});}
 const r=fixture();createFallBrace(r);updateFallBrace(r,awake,1/60,0);assert.equal(r.brace.enabled,true);assert.equal(updateFallBrace(r,{...awake,unconscious:true},1/60,1/60),false);assert.deepEqual(r.brace.armStrength,{left:0,right:0});assert.equal(r.brace.cancelReason,'unconscious');
});
test('conscious native aim fall plants a physical hand before the head and releases all motors after contact fade',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:RAPIER}=await import('@dimforge/rapier3d-compat'),{rigOnly}=await import('../scripts/training-fps-model.mjs'),{createPhysics}=await import('../apps/training/src/physics.js'),{createSoldierRig}=await import('../apps/training/src/soldier-rig.js'),{CombatPose}=await import('../apps/training/src/combat-pose.js'),{CombatRagdoll}=await import('../apps/training/src/combat-ragdoll.js'),{registerCombatBody}=await import('../apps/training/src/combat-physics.js'),{activateMuscles,controlMuscles}=await import('../apps/training/src/strength-ragdoll.js');
 const source=await rigOnly(await readFile('dist/soldier-fingers.glb')),physics=await createPhysics({humanTargets:[]}),rig=createSoldierRig(),targetRig=createSoldierRig(),pose=new CombatPose(rig,source.animations),target=new CombatPose(targetRig,source.animations),actor={id:'BRACE',at:[100,0,0],yaw:0},registered=registerCombatBody(physics,actor,rig),floor=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(4,.2,4).setTranslation(100,-.2,0));physics.surface.set(floor.handle,{kind:'floor'});
 pose.sample('aim',0);pose.remember(actor,0);pose.remember(actor,1/60);const r=new CombatRagdoll(physics,registered,pose),fingers=rig.bones.slice(24).map(b=>b.quaternion.toArray());
 try{
  activateMuscles(r,target,{clip:'aim',velocity:new Vector3(),time:0});const unit={medical:{consciousness:100,isUnconscious:false,spinalCordInjury:{region:'B'},bodyParts:{}}};let retainedAfterLegFade=false;
  for(let i=0;i<360;i++){controlMuscles(r,1/60,(i+1)/60,unit);if(r.strength===0&&!r.brace.done&&r.joints.some(j=>/Arm|Hand/.test(j.childBone)&&j.controls.some(c=>c.strength>0)))retainedAfterLegFade=true;physics.world.step();r.sync(false);}
  assert.equal(retainedAfterLegFade,true);assert.ok(r.brace.firstHandContactS>0);assert.ok(r.brace.headContactS==null||r.brace.firstHandContactS<r.brace.headContactS);assert.equal(r.brace.done,true);assert.equal(r.mode,'passive');
  assert.deepEqual(rig.bones.slice(24).map(b=>b.quaternion.toArray()),fingers);assert.equal(r.supportBody,undefined);assert.equal(r.supportJoint,undefined);
  assert.ok(r.joints.every(j=>j.controls.every(c=>c.strength===0&&c.maxForce===0)));
 }finally{r.dispose();registered.dispose();pose.dispose();target.dispose();rig.dispose();targetRig.dispose();physics.dispose();}
});
