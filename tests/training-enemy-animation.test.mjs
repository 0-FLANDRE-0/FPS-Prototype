import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {rigOnly} from '../scripts/training-fps-model.mjs';
import {createSoldierRig} from '../apps/training/src/soldier-rig.js';
import {EnemyCombatPose,ENEMY_ANIMATION_TUNING} from '../apps/training/src/enemy-combat-pose.js';
import {CombatPose} from '../apps/training/src/combat-pose.js';
import {ENEMY_ANIMATIONS} from '../apps/training/src/generated/enemy-animations.js';
import {SOLDIER_AK_GRIP} from '../apps/training/src/soldier-grip.js';
import {aimCombatAK,alignCombatShotVisual} from '../apps/training/src/combat-weapon.js';
import {FPS_HANDLING} from '../apps/training/src/handling-animation.js';
const source=await rigOnly(await readFile('dist/soldier-fingers.glb'));
function fixture(){const rig=createSoldierRig(),pose=new EnemyCombatPose(rig,source.animations,ENEMY_ANIMATIONS);return{rig,pose,dispose(){pose.dispose();rig.dispose();}};}
const actor={at:[0,0,0],yaw:0},frame={dt:1/60,actor,velocity:new Vector3(),intent:{state:'aim',move:false,aim:true},rounds:30};
test('enemy aliases use distinct retargeted clips while native player controller keeps its original four clips',()=>{
 const f=fixture(),nativeRig=createSoldierRig(),native=new CombatPose(nativeRig,source.animations);
 try{f.pose.sample('standing');const head=f.pose.point(actor,'head').y;f.pose.sample('crouch');assert.ok(f.pose.point(actor,'head').y<head-.2);assert.equal(f.pose.snapshot().activeClips[0].name,'idle crouching');assert.equal(f.pose.snapshot().clip,'crouch');assert.equal(native.enemyAnimation,undefined);assert.deepEqual(Object.keys(native.actions).sort(),['aim','crouch','standing','walk']);assert.equal(f.rig.bones.length,54);assert.ok(ENEMY_ANIMATIONS.clips.every(c=>c.tracks.every(t=>!/(Thumb|Index|Middle|Ring|Pinky)/.test(t.name))));}finally{f.dispose();native.dispose();nativeRig.dispose();}
});
test('enemy movement blends body-relative directions and advances at measured source speed with a finite crossfade',()=>{
 const f=fixture();try{const v=new Vector3(1,0,1).normalize().multiplyScalar(1.4);
  for(let i=1;i<=13;i++)f.pose.updateFrame({...frame,time:i/60,velocity:v,intent:{state:'enter',move:true,aim:false}});
  let s=f.pose.snapshot();assert.equal(s.clip,'walk');assert.equal(s.movement.family,'walk');assert.ok(s.activeClips.some(c=>c.name==='walk forward left'));assert.ok(s.activeClips.every(c=>c.rate>=.7&&c.rate<=1.4));assert.ok(s.activeClips.filter(c=>c.weight>1e-6).every(c=>c.name!=='idle'));
  f.pose.updateFrame({...frame,time:14/60,velocity:new Vector3(0,0,4),intent:{state:'enter',move:true,aim:false}});assert.equal(f.pose.snapshot().movement.family,'run');
  const turned={...actor,yaw:Math.PI/2};for(let i=0;i<13;i++)f.pose.updateFrame({...frame,time:1+i/60,actor:turned,velocity:new Vector3(1.4,0,0),intent:{state:'enter',move:true,aim:false}});s=f.pose.snapshot();assert.ok(Math.abs(s.movement.localAngleRad)<1e-8);assert.ok(s.activeClips.some(c=>c.name==='walk forward'));assert.equal(ENEMY_ANIMATION_TUNING.transitionS,.2);
 }finally{f.dispose();}
});
test('reload playback fits unchanged empty and tactical AK durations and releases left IK only during reload',()=>{
 for(const rounds of [0,12]){const f=fixture();try{const duration=rounds?FPS_HANDLING.ak74m.reload.duration:FPS_HANDLING.ak74m.emptyReload.duration;
  f.pose.updateFrame({...frame,time:0,rounds,intent:{state:'reload',aim:false}});f.pose.updateFrame({...frame,time:duration/2,rounds,intent:{state:'reload',aim:false}});const s=f.pose.snapshot(),a=s.activeClips.find(c=>c.name==='reload_stand');assert.equal(s.reload.durationS,duration);assert.equal(s.reload.leftIKReleased,true);assert.ok(Math.abs(a.phaseS-ENEMY_ANIMATIONS.metadata.reload_stand.duration/2)<1e-6);
  f.pose.updateFrame({...frame,time:duration,rounds:30});assert.equal(f.pose.reload.active,false);assert.equal(f.pose.reload.leftIKReleased,false);
 }finally{f.dispose();}}
});
test('single-shot authored overlay changes upper-body rotations without modifying leg or finger tracks',()=>{
 const f=fixture();try{f.pose.sample('aim',.2);const before=f.rig.bones.map(b=>b.quaternion.clone());f.pose.notifyFire(0);f.pose.time=.1;f.pose.evaluate();assert.ok(['spine','chest','rightUpperArm'].some(n=>f.rig.byName.get(n).quaternion.angleTo(before[f.rig.bones.findIndex(b=>b.name===n)])>1e-4));for(let i=0;i<f.rig.bones.length;i++)if(i>=24||/Leg|Foot|Toes/.test(f.rig.bones[i].name))assert.ok(f.rig.bones[i].quaternion.angleTo(before[i])<1e-7);}finally{f.dispose();}
});
test('moving collapse stream preserves exact mixed pose and advances the same retargeted clip; stationary pose stays fixed',()=>{
 const f=fixture();try{f.pose.sample('walk',.3);f.pose.distributeAim(.1,.1);const initial=f.rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),stream=f.pose.captureCollapseStream(),zero=stream.advance(0);assert.equal(stream.moving,true);for(let i=0;i<54;i++){assert.ok(zero[i].p.distanceTo(initial[i].p)<1e-12);assert.ok(zero[i].q.angleTo(initial[i].q)<1e-7);}const next=stream.advance(.1);assert.ok(next.some((b,i)=>b.q.angleTo(initial[i].q)>.001));f.pose.sample('aim',.2);const staticStream=f.pose.captureCollapseStream(),a=staticStream.advance(0),b=staticStream.advance(1);assert.equal(staticStream.moving,false);assert.deepEqual(a.map(r=>r.q.toArray()),b.map(r=>r.q.toArray()));}finally{f.dispose();}
});
test('enemy upper-body aims toward real target rays and realized-shot alignment preserves muzzle pivot and event data',()=>{
 const f=fixture(),mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial()),asset={gripPose:SOLDIER_AK_GRIP};try{
  for(const target of [new Vector3(0,1.4,100),new Vector3(30,10,50),new Vector3(-20,-5,50)]){f.pose.sample('aim',.2);const s=aimCombatAK(actor,f.pose,asset,mesh,{target});assert.ok(s.nominalAimTargetErrorDeg<2);assert.ok(s.visualAimTargetErrorDeg<2);assert.ok(s.rightHandMountErrorM<1e-6);assert.ok(s.leftHandGuardErrorM<.03);
   const event={origin:s.origin.clone(),direction:s.direction.clone().applyAxisAngle(new Vector3(0,1,0),.12),trace:{untouched:true}},before=JSON.stringify(event),result=alignCombatShotVisual(actor,f.pose,asset,mesh,event);assert.equal(JSON.stringify(event),before);assert.ok(result.realizedAngleDeg<1e-5);assert.ok(result.muzzlePivotErrorM<1e-6);assert.ok(result.rightHandMountErrorM<.03);assert.ok(result.leftHandGuardErrorM<.03);assert.ok(result.intentionalAIErrorDeg>2);
  }
 }finally{f.dispose();mesh.geometry.dispose();mesh.material.dispose();}
});

test('entering a new movement direction preserves dominant outgoing normalized cycle phase',()=>{const f=fixture();try{f.pose.sample('walk',.37);const before=f.pose.snapshot().activeClips[0],oldDuration=ENEMY_ANIMATIONS.metadata[before.name].duration;f.pose.updateFrame({...frame,time:.5,walkSeconds:20,velocity:new Vector3(1.4,0,0),intent:{state:'enter',move:true}});const next=f.pose.snapshot().activeClips.find(s=>s.name==='walk left'),newDuration=ENEMY_ANIMATIONS.metadata[next.name].duration;assert.ok(Math.abs((next.phaseS-next.rate/60)/newDuration-before.phaseS/oldDuration)<1e-10,'wall-clock walkSeconds must not reset the incoming gait phase');}finally{f.dispose();}});
