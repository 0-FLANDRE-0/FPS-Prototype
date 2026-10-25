import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {rigOnly} from '../scripts/training-fps-model.mjs';
import {createPhysics} from '../apps/training/src/physics.js';
import {createSoldierRig} from '../apps/training/src/soldier-rig.js';
import {CombatPose} from '../apps/training/src/combat-pose.js';
import {CombatRagdoll} from '../apps/training/src/combat-ragdoll.js';
import {registerCombatBody} from '../apps/training/src/combat-physics.js';
import {RAGDOLL_SETTLING} from '../apps/training/src/ragdoll-settling.js';

test('a real settled ragdoll restores saved damping before its first hit impulse and stays awake during cooldown',async()=>{
 const source=await rigOnly(await readFile('dist/soldier-fingers.glb')),physics=await createPhysics({humanTargets:[]}),rig=createSoldierRig(),pose=new CombatPose(rig,source.animations),actor={id:'SETTLING',at:[100,0,0],yaw:.2},registered=registerCombatBody(physics,actor,rig);
 physics.world.createCollider(R.ColliderDesc.cuboid(4,.2,4).setTranslation(100,-.2,0).setFriction(1.1));
 pose.sample('walk',.3);pose.remember(actor,0);const rag=new CombatRagdoll(physics,registered,pose);
 try{
  actor.at[2]+=.02;pose.sample('walk',.3+1/60);pose.remember(actor,1/60);rag.activate();
  // Real Rapier gravity, contacts and joint constraints settle all 17 bodies;
  // no test code sets their poses, velocities, damping or sleeping flags.
  for(let i=0;i<1200&&!rag.sleeping;i++){physics.world.step();rag.sync();}
  assert.equal(rag.sleeping,true);assert.equal(rag.parts.size,17);
  const state=rag.settling;assert.ok(state.baseDamping instanceof Map,'the physical lying/contact phase saved its ordinary damping');assert.equal(state.dampingRaised,true);
  const chest=rag.parts.get('chest'),saved=new Map(state.baseDamping),impulse=new Vector3(.2,0,0),point=chest.body.worldCom();
  let observedBeforeImpulse=false;const apply=chest.body.applyImpulseAtPoint.bind(chest.body);
  chest.body.applyImpulseAtPoint=(...args)=>{
   for(const [name,base]of saved){const body=rag.parts.get(name).body;assert.equal(body.linearDamping(),base.linear);assert.equal(body.angularDamping(),base.angular);assert.equal(body.isSleeping(),false);}
   observedBeforeImpulse=true;return apply(...args);
  };
  rag.impulse('chest',impulse,point);
  assert.equal(observedBeforeImpulse,true,'ordinary damping is restored before applying the actual impulse');
  assert.equal(rag.sleeping,false);assert.ok(Math.hypot(...Object.values(chest.body.linvel()))>0,'real Rapier velocity retains the hit momentum');
  assert.equal(state.dampingRaised,false);assert.equal(state.residualDampingRaised,false);assert.equal(state.wakeCooldownS,RAGDOLL_SETTLING.wakeCooldownS);
  physics.world.step();rag.sync();
  assert.ok(state.wakeCooldownS>0);assert.equal(state.dampingRaised,false,'the final settling viscosity cannot reappear on the first post-hit step');
  assert.equal(rag.sleeping,false);assert.ok(Math.hypot(...Object.values(chest.body.linvel()))>0);
  for(const [name,base]of saved){const body=rag.parts.get(name).body;assert.equal(body.linearDamping(),base.linear);assert.equal(body.angularDamping(),base.angular);}
 }finally{rag.dispose();registered.dispose();pose.dispose();rig.dispose();physics.dispose();}
});
