import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {LEAN,LeanIntent,LeanState,leanPose} from '../apps/training/src/lean.js';
import {AimState} from '../apps/training/src/aim.js';
import {AIM_DEFAULTS,cleanSettings} from '../apps/training/src/settings.js';
import {createPhysics} from '../apps/training/src/physics.js';
const frame={feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads:true,reloading:false,blocked:false};
test('lean hold ownership and toggle repeat/opposite rules are independent across keys and fingers',()=>{
 const i=new LeanIntent();i.press('KeyQ',-1);i.press('pointer:7',1);assert.equal(i.requested,1);i.release('pointer:7');assert.equal(i.requested,-1);i.release('KeyQ');assert.equal(i.requested,0);
 i.setMode('toggle');i.press('KeyQ',-1);i.press('KeyQ',-1);assert.equal(i.requested,-1);i.release('KeyQ');assert.equal(i.requested,-1);
 i.press('pointer:4',1);assert.equal(i.requested,1);i.release('pointer:4');i.press('pointer:4',1);assert.equal(i.requested,0);i.clear();assert.equal(i.requested,0);
 assert.equal(AIM_DEFAULTS.leanMode,'hold');assert.equal(cleanSettings({leanMode:'toggle'}).leanMode,'toggle');assert.equal(cleanSettings({leanMode:'invalid'}).leanMode,'hold');
});
test('lean reaches 90% in .25s, scales crouch and preserves local firing axis without cant compensation',()=>{
 const a=new AimState({...AIM_DEFAULTS,breath:0,walkSway:0}),l=new LeanState(),physics={sweepSphere:()=>null};
 for(let i=0;i<15;i++){a.step(1/60,frame);l.step(1/60,{requested:1,viewHeight:1.43,yaw:0,physics,aim:a});}
 assert.ok(Math.abs(l.value-.9)<1e-12);assert.ok(l.pose.headOffset.x<=.25);assert.ok(Math.abs(l.pose.rollRad)<=LEAN.rollRad);
 const before=a.shotPose().direction.clone(),m=a.muzzle.clone();a.applyLean(l.pose);assert.ok(a.shotPose().direction.distanceTo(before.applyQuaternion(l.pose.rotation))<1e-12);
 const angle=before.angleTo(a.frontSight.clone().sub(a.sight).normalize());assert.ok(Math.abs(a.shotPose().direction.angleTo(a.frontSight.clone().sub(a.sight).normalize())-angle)<1e-9);
 assert.ok(a.muzzle.distanceTo(m)>.1);assert.ok(Math.abs(leanPose(1,.98,0).headOffset.x/.25-.98/1.43)<1e-12);
 l.step(1/60,{requested:1,sprint:true,viewHeight:1.43,yaw:0,physics,aim:a});assert.equal(l.value,0);assert.equal(l.requested,0);
});
test('actual Rapier sphere sweeps limit both sides at standing/crouched walls and keep head/muzzle inside',async()=>{
 const p=await createPhysics();try{
  for(const [x,side,edge]of [[-8.5,-1,-8.775],[8.5,1,8.775]])for(const viewHeight of [1.43,.98]){
   p.stance(viewHeight<1);p.relocate({x,z:-1});
   const a=new AimState({...AIM_DEFAULTS,breath:0,walkSway:0}),l=new LeanState();
   for(let n=0;n<90;n++){a.step(1/60,{...frame,feet:p.feet,viewHeight,ads:false});l.step(1/60,{requested:side,viewHeight,yaw:0,physics:p,aim:a});a.applyLean(l.pose);l.restrictWeapon(p,a);}
   assert.ok(Math.abs(l.value)<1);assert.ok(l.collision.limitedDistanceM>0);
   assert.ok(side<0?a.eye.x-LEAN.headRadiusM>edge:a.eye.x+LEAN.headRadiusM<edge);
   assert.ok(side<0?a.muzzle.x>edge:a.muzzle.x<edge);
   assert.equal(p.ray(a.eye,new Vector3(side,0,0),LEAN.headRadiusM),null);
   assert.equal(p.sweepSphere(p.feet.clone().add(new Vector3(0,viewHeight,0)),a.eye,LEAN.headRadiusM),null);
  }
 }finally{p.dispose();}
});
test('a blocked neutral muzzle cannot lock peeking; shoulder sweep retracts the gun until its leaned path clears',async()=>{
 const p=await createPhysics();try{
  p.relocate({x:-2.6,z:-2.4});const a=new AimState({...AIM_DEFAULTS,breath:0,walkSway:0}),l=new LeanState();let blockedFrames=0;
  for(let n=0;n<180;n++){
   a.step(1/60,{...frame,feet:p.feet});l.step(1/60,{requested:1,viewHeight:1.43,yaw:0,physics:p,aim:a});a.applyLean(l.pose);
   if(l.restrictWeapon(p,a))blockedFrames++;
   assert.equal(p.ray(a.muzzle,new Vector3(1,0,0),.0001),null,'muzzle cannot begin inside cover');
  }
  assert.ok(blockedFrames>0);assert.ok(l.value>.999);assert.equal(l.collision.muzzleRecessM,0);
  assert.equal(p.muzzleBlocked(a.eye.clone().add(new Vector3(0,-.07,0).applyQuaternion(l.pose.rotation)),a.muzzle,a.barrelDirection),false);
 }finally{p.dispose();}
});
