import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { SprintIntent, SPRINT, canSprint } from '../apps/training/src/sprint.js';
import { AimState } from '../apps/training/src/aim.js';
import { AIM_DEFAULTS } from '../apps/training/src/settings.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { rigOnly } from '../scripts/training-fps-model.mjs';
import { createRunPose } from '../apps/training/src/fps-run-pose.js';

test('joystick sprint enters only far forward, has hysteresis and releases on lower/side/back input', () => {
  const s=new SprintIntent(), keys=new Set();
  s.updateStick(-.96);assert.equal(s.requested(keys),false);
  s.updateStick(-1);assert.equal(s.requested(keys),true);
  for(const y of [-.95,-.90,-.83]){s.updateStick(y);assert.equal(s.automatic,true);}
  for(const y of [-.81,0,.9]){s.updateStick(y);assert.equal(s.automatic,false);}
  s.updateStick(-1);s.updateStick(0);assert.equal(s.requested(keys),false);
});
test('button can cancel an automatic sprint until the stick leaves its upper zone; Shift and clear are independent', () => {
  const s=new SprintIntent(),keys=new Set();s.updateStick(-1);s.toggle();
  for(let i=0;i<10;i++){s.updateStick(-1);assert.equal(s.requested(keys),false);}
  s.updateStick(-.6);s.updateStick(-1);assert.equal(s.automatic,true);
  s.toggle();s.toggle();assert.equal(s.toggled,true);s.updateStick(0);assert.equal(s.requested(keys),true);
  s.clear();assert.equal(s.requested(keys),false);
  s.toggle();s.toggle();s.updateStick(-1);assert.equal(s.automatic,true,'a keyboard/button sprint cancellation must not suppress a new joystick gesture');s.clear();
  for(const key of ['ShiftLeft','ShiftRight']){keys.add(key);assert.equal(s.requested(keys),true);keys.delete(key);}
});
test('sprint requires forward movement and yields to ADS, firing, crouch and handling', () => {
  const f={move:{x:0,y:-1},sprint:true};assert.equal(canSprint(f),true);
  assert.equal(canSprint({...f,move:{x:1,y:-1}}),true);
  for(const move of [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:-.1}])assert.equal(canSprint({...f,move}),false);
  for(const key of ['ads','firing','firePressed','crouch'])assert.equal(canSprint({...f,[key]:true}),false);
  assert.equal(canSprint(f,{busy:true}),false);assert.equal(canSprint(f,{crouched:true}),false);
});
test('collision movement reaches sprint speed without diagonal gain and keeps crouch/ADS walking speeds',async()=>{
  const p=await createPhysics();try{
    for(const row of [{move:{x:0,y:-1},sprint:false,expected:1.6},{move:{x:0,y:-1},sprint:true,expected:SPRINT.speedMps},{move:{x:1,y:-1},sprint:true,expected:SPRINT.speedMps},{move:{x:0,y:-1},sprint:true,ads:true,expected:1.6},{move:{x:0,y:-1},sprint:true,crouch:true,expected:.85}]){
      p.stance(false);p.relocate({x:40,z:-40});let speed;for(let i=0;i<90;i++)speed=p.step(row,0);
      assert.ok(Math.abs(speed-row.expected)<.02,JSON.stringify(row)+' actual '+speed);assert.equal(p.sprinting,row.expected===SPRINT.speedMps);
    }
  }finally{p.dispose();}
});
test('native Run retarget is repeatable, leaves its source bones alone and returns both rifles to prior aim',async()=>{
  const gltf=await rigOnly(await readFile('dist/ak74m-driver-webp.glb')),before=gltf.scene.children.map(n=>n.matrixWorld.toArray()),run=createRunPose(gltf);
  assert.equal(run.sourceClip,'Rig|AK_Run');assert.ok(run.duration>.3&&run.duration<.5);
  for(const phase of [0,.25,.5,.75]){const a=run.sample(phase),b=run.sample(phase);assert.deepEqual(a,b);assert.ok(a.quaternion.angleTo(run.sample(phase+.25).quaternion)>.001);}
  assert.deepEqual(gltf.scene.children.map(n=>n.matrixWorld.toArray()),before);
  for(const id of ['m4a1','ak74m']){
    const settings={...AIM_DEFAULTS,breath:0,walkSway:0},a=new AimState(settings),b=new AimState(settings);a.setWeapon(id);b.setWeapon(id);
    const f={feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads:false,reloading:false,blocked:false};
    for(let i=0;i<45;i++){a.step(1/60,{...f,sprint:true,runPose:run});b.step(1/60,f);}
    assert.ok(a.sprintPose>.99);assert.ok(a.quaternion.angleTo(b.quaternion)>.25,'native Run adapted to low ready');
    assert.ok(a.muzzle.y<b.muzzle.y,'running leaves the forward view clear');
    assert.ok(a.stockContact.distanceTo(b.stockContact)<.02,'butt pad stays at shoulder');
    assert.deepEqual([a.viewYaw,a.viewPitch],[b.viewYaw,b.viewPitch]);
    for(let i=0;i<90;i++){a.step(1/60,{...f,runPose:run});b.step(1/60,f);}
    assert.equal(a.sprintPose,0);assert.deepEqual(a.muzzle,b.muzzle);assert.deepEqual(a.quaternion,b.quaternion);
  }
});
