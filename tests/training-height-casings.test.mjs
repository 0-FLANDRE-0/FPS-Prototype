import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Scene,BoxGeometry,MeshBasicMaterial,Vector3,Quaternion,Euler} from 'three';
import {AimState} from '../apps/training/src/aim.js';
import {AIM_DEFAULTS} from '../apps/training/src/settings.js';
import {createPhysics} from '../apps/training/src/physics.js';
import {TrainingFX} from '../apps/training/src/fx.js';
import {STEP} from '../apps/training/src/config.js';
const controls={feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads:false,reloading:false,blocked:false};
test('AK hip front sight matches M4 height across weapon sizes and fades out for centered ADS',()=>{
 for(const weaponSize of [100,115,155]){
  const m4=new AimState({...AIM_DEFAULTS,breath:0,weaponSize}),ak=new AimState({...AIM_DEFAULTS,breath:0,weaponSize});ak.setWeapon('ak74m');
  for(let i=0;i<180;i++){m4.step(STEP,controls);ak.step(STEP,controls);}
  assert.ok(Math.abs(m4.frontSight.y-ak.frontSight.y)<.002,'similar physical hip sight heights');
  for(let i=0;i<240;i++)ak.step(STEP,{...controls,ads:true});
  assert.ok(Math.abs(ak.sight.x-ak.eye.x)<1e-7);assert.ok(Math.abs(ak.sight.y-ak.eye.y)<1e-7);
 }
});
test('actual movement velocity follows collision-resolved motion, not wall input, ground stick or stance height',async()=>{
 const p=await createPhysics();try{
  const frame={move:{x:0,y:0},crouch:false,sprint:false};for(let i=0;i<60;i++)p.step(frame,0);
  // Rapier ground-contact jitter stays below 1 cm/s, unlike the -0.8 m/s controller stick.
  assert.ok(Math.abs(p.movementVelocity.y)<.01);assert.ok(p.velocity.y<-.5);
  // A stance change can settle the 3 mm controller skin; capsule-center changes
  // (tens of m/s at one tick) must not become translational velocity.
  for(const crouch of [true,false]){p.step({...frame,crouch},0);assert.ok(Math.abs(p.movementVelocity.y)<.25);}
  for(let i=0;i<450;i++){const before=p.feet.clone();p.step({...frame,move:{x:0,y:-1}},0);assert.ok(p.movementVelocity.distanceTo(p.feet.clone().sub(before).divideScalar(STEP))<1e-5);}
  assert.ok(Math.abs(p.movementVelocity.z)<.01);assert.ok(p.velocity.z<-1.5,'input still requests the new walk speed against cover');
  p.reset();assert.equal(p.movementVelocity.length(),0);
  p.body.setTranslation({x:0,y:3,z:5},true);p.body.setNextKinematicTranslation({x:0,y:3,z:5});p.grounded=false;p.sync();p.step(frame,0);assert.ok(p.movementVelocity.y<-.1,'airborne downward motion is inherited');
 }finally{p.dispose();}
});
test('released casings add world shooter velocity to rotated gun ejection and then move independently',()=>{
 const geometry=new BoxGeometry(.01,.02,.01),material=new MeshBasicMaterial(),fx=new TrainingFX(new Scene(),{geometry,material});fx.sound=false;
 for(const angles of [[0,0,0],[.6,1.2,.4]])for(const own of [[0,0,0],[2.7,0,-1.4],[0,-3,0]]){
  const rotation=new Quaternion().setFromEuler(new Euler(...angles,'YXZ')),shooterVelocity=new Vector3(...own),event={origin:new Vector3(0,5,0),breech:new Vector3(0,5,0),rotation,shooterVelocity};
  const expected=new Vector3(1.9,1.6,0).applyQuaternion(rotation).add(shooterVelocity),unchanged=shooterVelocity.clone();fx.shot(event);const casing=fx.pool[(fx.nextCasing-1)%fx.pool.length];
  assert.ok(casing.velocity.distanceTo(expected)<1e-12);assert.ok(shooterVelocity.distanceTo(unchanged)<1e-12);
  shooterVelocity.set(99,99,99);assert.ok(casing.velocity.distanceTo(expected)<1e-12,'no live player-velocity reference');
  const origin=casing.mesh.position.clone();fx.update(.1);expected.y-=9.81*.1;assert.ok(casing.mesh.position.distanceTo(origin.addScaledVector(expected,.1))<1e-12);
  fx.reset();
 }
 geometry.dispose();material.dispose();fx.trajectories.dispose();
});
