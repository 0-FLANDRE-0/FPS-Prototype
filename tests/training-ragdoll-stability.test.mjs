import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Quaternion,Euler} from 'three';
import {RAGDOLL_STABILITY,stabilizeRagdollInertia} from '../apps/training/src/ragdoll-stability.js';

test('distal inertia regularization preserves actual mass and COM while reducing torque response',async()=>{
 await R.init();const world=new R.World({x:0,y:0,z:0}),body=world.createRigidBody(R.RigidBodyDesc.dynamic().setRotation(new Quaternion().setFromEuler(new Euler(.2,.4,.7)))),shapeQ=new Quaternion().setFromEuler(new Euler(.6,.3,-.4));
 const collider=world.createCollider(R.ColliderDesc.capsule(.05,.035).setMass(.48).setTranslation(.1,.2,.3).setRotation(shapeQ),body);body.recomputeMassPropertiesFromColliders();
 try{
  const mass=body.mass(),com=body.localCom(),torque={x:1,y:.2,z:-.3};body.applyTorqueImpulse(torque,true);const before=body.angvel(),speedBefore=Math.hypot(before.x,before.y,before.z);body.setAngvel({x:0,y:0,z:0},true);
  const rows=stabilizeRagdollInertia(new Map([['leftHand',{bone:'leftHand',body,collider}]]));
  assert.equal(rows.length,1);assert.equal(rows[0].additionalMassKg,0);assert.equal(body.mass(),mass);assert.deepEqual(body.localCom(),com);
  const afterInertia=body.principalInertia();for(const axis of ['x','y','z'])assert.ok(afterInertia[axis]>=RAGDOLL_STABILITY.handInertiaFloorKgM2-1e-8);
  body.applyTorqueImpulse(torque,true);const after=body.angvel();assert.ok(Math.hypot(after.x,after.y,after.z)<speedBefore/2);
 }finally{world.free();}
});

test('inertia regularization leaves untargeted torso mass properties unchanged',async()=>{
 await R.init();const world=new R.World({x:0,y:0,z:0}),body=world.createRigidBody(R.RigidBodyDesc.dynamic());world.createCollider(R.ColliderDesc.capsule(.1,.13).setMass(28.43),body);body.recomputeMassPropertiesFromColliders();
 try{const before={mass:body.mass(),I:body.principalInertia(),center:body.localCom()};assert.deepEqual(stabilizeRagdollInertia(new Map([['chest',{bone:'chest',body}]])),[]);assert.deepEqual({mass:body.mass(),I:body.principalInertia(),center:body.localCom()},before);}finally{world.free();}
});
