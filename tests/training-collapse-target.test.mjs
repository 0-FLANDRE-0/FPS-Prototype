import {RG1} from '../apps/training/src/ragdoll-lifecycle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import R from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {createSoldierRig} from '../apps/training/src/soldier-rig.js';
import {CombatPose} from '../apps/training/src/combat-pose.js';
import {CombatRagdoll} from '../apps/training/src/combat-ragdoll.js';
import {COMBAT_BOXES} from '../apps/training/src/combat-config.js';
import {createCollapseAnimationTarget} from '../apps/training/src/collapse-target-playback.js';
import {activateMuscles,controlMuscles} from '../apps/training/src/strength-ragdoll.js';
import {rigOnly} from '../scripts/training-fps-model.mjs';
const plain=rig=>rig.bones.map(b=>({p:b.position.toArray(),q:b.quaternion.toArray()}));

test('stationary collapse freezes the exact displayed mixed pose, including aim/IK offsets',()=>{
 const rig=createSoldierRig(),goal=createSoldierRig();rig.setPose('aim');rig.root.position.y=.027;rig.byName.get('chest').quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.17));rig.byName.get('leftHand').position.z+=.008;
 const initial=plain(rig),target=createCollapseAnimationTarget(rig,{moving:false,clipName:'reload_stand + aim',advance(){throw new Error('A stationary collapse cannot advance the clip');}});
 target.write(goal,0);assert.deepEqual(plain(goal),initial);
 rig.setPose('crouch');for(const dt of [1/60,.2,1]){target.write(goal,dt);assert.deepEqual(plain(goal),initial);}assert.equal(target.snapshot().elapsedS,0);rig.dispose();goal.dispose();
});

test('moving collapse preserves the captured blend, clip phase and original playback rate',()=>{
 const rig=createSoldierRig(),goal=createSoldierRig(),weights=[.65,.35],rate=1.17,phase=.43,rest=rig.bones.map(b=>({position:b.position.clone(),quaternion:b.quaternion.clone()}));let time=phase;
 const sample=()=>rest.map((b,i)=>({p:b.position.clone().add(new Vector3(0,i===1?Math.sin(time*rate)*.015:0,0)),q:b.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),(weights[0]*Math.sin(time*rate)+weights[1]*Math.cos(time*rate))*(i===14?.3:i===3?.07:0)))}));
 const initialRows=sample();for(let i=0;i<rig.bones.length;i++){rig.bones[i].position.copy(initialRows[i].p);rig.bones[i].quaternion.copy(initialRows[i].q);}const initial=plain(rig),calls=[],stream={moving:true,clipName:'walk forward .65 + walk right .35',advance(dt){calls.push(dt);time+=dt;return sample();}},target=createCollapseAnimationTarget(rig,stream);
 target.write(goal,0);assert.deepEqual(plain(goal),initial);assert.deepEqual(calls,[]);
 target.write(goal,1/60);assert.equal(time,phase+1/60);assert.deepEqual(plain(goal),sample().map(b=>({p:b.p.toArray(),q:b.q.toArray()})));assert.equal(calls[0],1/60);assert.equal(rate,1.17);assert.deepEqual(weights,[.65,.35]);assert.equal(target.snapshot().elapsedS,1/60);rig.dispose();goal.dispose();
});

test('a full-body animation stream keeps the two-tick handoff and released finger pose without changing physical overlays',async()=>{
 await R.init();const source=await rigOnly(await readFile('dist/soldier-fingers.glb')),world=new R.World({x:0,y:-9.81,z:0}),physics={world,surface:new Map()},rig=createSoldierRig(),targetRig=createSoldierRig(),pose=new CombatPose(rig,source.animations),target=new CombatPose(targetRig,source.animations),actor={id:'STREAM',at:[100,0,0],yaw:0},registered={actor,rig,sync(){},disableMovement(){}};
 world.createCollider(R.ColliderDesc.cuboid(5,.2,5).setTranslation(100,-.2,0));pose.sample('standing');const r=new CombatRagdoll(physics,registered,pose);
 try{
  pose.sample('walk',.3);pose.remember(actor,-1/60);actor.at[2]+=1.4/60;pose.sample('walk',.3+1/60);pose.remember(actor,0);target.sample('walk',.3+1/60);
  const expected=pose.velocities(),captured=rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));let phase=0;
  const stream={moving:true,clipName:'walk right + walk backward',advance(dt){phase+=dt;return captured.map((b,i)=>({p:b.p.clone(),q:b.q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),i===3||i>=24?phase:.0))}));}};
  activateMuscles(r,target,{clip:'walk',velocity:new Vector3(0,0,1.4),animationStream:stream});
  for(const body of r.start){assert.deepEqual(body.linearAtBone,expected.get(body.bone).linear.toArray());assert.deepEqual(body.angular,expected.get(body.bone).angular.toArray());}
  r.animationTarget.write(r.reflexRig,0);assert.deepEqual(plain(r.reflexRig),captured.map(b=>({p:b.p.toArray(),q:b.q.toArray()})),'the first goal is the displayed pose before Rapier float32 handoff');pose.releaseGrip();target.releaseGrip();const fingers=plain(rig).slice(24);
  const unit={medical:{isUnconscious:true,consciousness:5,bodyParts:{}}};controlMuscles(r,1/60,0,unit);
  assert.equal(phase,1/60);assert.deepEqual(plain(r.reflexRig).slice(24),fingers,'the animation provider cannot animate released finger joints');assert.ok(r.reflexRig.byName.get('chest').quaternion.angleTo(captured[3].q)>0,'full upper-body stream and unchanged physical tip are both applied');
  for(let i=1;i<40;i++)controlMuscles(r,1/60,i/60,unit);assert.equal(r.mode,'passive');const stopped=phase;controlMuscles(r,1/60,1,unit);assert.equal(phase,stopped,'all animation goals stop when the original muscle envelope ends');
 }finally{r.dispose();pose.dispose();target.dispose();rig.dispose();targetRig.dispose();world.free();}
});

async function oldController(){
 let source=readFileSync(new URL('./fixtures/history/422cbbc13a171e8a8a8b7f7449c505859022714a/strength-ragdoll.js',import.meta.url),'utf8'),base=pathToFileURL(resolve('apps/training/src/strength-ragdoll.js'));
 // RG1 intentionally changes only the solver schedule and frozen early-out.
 // Apply those same lifecycle adapters to the historical controller before
 // comparing its actual PD/brace/medical-derived targets against today's code.
 source=source.replace('if(!r.active)return;', 'if(!r.active||r.frozen)return;').replace('r.stability?.solverIterations??MUSCLE.passiveSolverIterations', 'r.lifecycle?.solverReduced?'+RG1.lateSolverIterations+':r.stability?.solverIterations??MUSCLE.passiveSolverIterations');
 const absolute=source.replace(/from '([^']+)'/g,(_all,spec)=>`from '${spec.startsWith('.')?new URL(spec,base).href:import.meta.resolve(spec)}'`);
 return import('data:text/javascript;base64,'+Buffer.from(absolute).toString('base64'));
}
function state(r){return{parts:[...r.parts.values()].map(p=>[p.body.translation(),p.body.rotation(),p.body.linvel(),p.body.angvel(),p.body.isSleeping()]),goals:plain(r.reflexRig),controls:r.joints.map(j=>j.controls),collapse:r.collapse,strength:r.strength,mode:r.mode};}

test('v36 PD and brace goals remain numerically identical under the same RG1 solver schedule and freeze guard',async()=>{
 await R.init();const old=await oldController(),source=await rigOnly(await readFile('dist/soldier-fingers.glb'));
 const cases=[['walking-unconscious','walk',true],['walking-legloss','walk',false],['doorway-unconscious','walk',true],['aiming-unconscious','aim',true],['crouching-unconscious','crouch',true],['walking-conscious-brace','walk',false,.75],['aiming-conscious-brace','aim',false,0]];
 for(const [name,clip,unconscious,startPhase=.3]of cases){
  function setup(){const world=new R.World({x:0,y:-9.81,z:0}),physics={world,surface:new Map()},rig=createSoldierRig(),targetRig=createSoldierRig(),pose=new CombatPose(rig,source.animations),target=new CombatPose(targetRig,source.animations),actor={id:'PARITY',at:name==='doorway-unconscious'?[77.15,0,-4.2]:[100,0,0],yaw:name==='doorway-unconscious'?-Math.PI/2:0},registered={actor,rig,sync(){},disableMovement(){}};if(name==='doorway-unconscious'){for(const box of COMBAT_BOXES){const collider=world.createCollider(R.ColliderDesc.cuboid(...box.size.map(v=>v/2)).setTranslation(...box.at).setFriction(1.1));physics.surface.set(collider.handle,{kind:box.kind,id:box.id});}}else{const floor=world.createCollider(R.ColliderDesc.cuboid(5,.2,5).setTranslation(100,-.2,0).setFriction(1.1));physics.surface.set(floor.handle,{kind:'floor'});}pose.sample('standing');const r=new CombatRagdoll(physics,registered,pose);pose.sample(clip,startPhase);pose.remember(actor,-1/60);if(clip==='walk'){actor.at[0]+=Math.sin(actor.yaw)*1.4/60;actor.at[2]+=Math.cos(actor.yaw)*1.4/60;}pose.sample(clip,startPhase+1/60);pose.remember(actor,0);target.sample(clip,startPhase+1/60);return{world,rig,targetRig,pose,target,r};}
  const a=setup(),b=setup(),velocity=new Vector3(Math.sin(a.r.actor.yaw),0,Math.cos(a.r.actor.yaw)).multiplyScalar(clip==='walk'?1.4:0),context={clip,velocity,walkSeconds:startPhase+1/60,time:0},unit={medical:{isUnconscious:unconscious,consciousness:unconscious?5:100,bodyParts:{},...(unconscious?{}:{spinalCordInjury:{region:'B'}})}};
  try{old.activateMuscles(a.r,a.target,context);activateMuscles(b.r,b.target,context);assert.equal(b.r.animationTarget,null);assert.deepEqual(b.r.start,a.r.start,'two-tick bone velocity handoff');a.pose.releaseGrip();b.pose.releaseGrip();a.target.releaseGrip();b.target.releaseGrip();
   for(let i=0;i<360;i++){old.controlMuscles(a.r,1/60,i/60,unit);controlMuscles(b.r,1/60,i/60,unit);a.world.step();b.world.step();a.r.sync(false);b.r.sync(false);assert.deepEqual(state(b.r),state(a.r),`${name} tick ${i}`);}
  }finally{for(const v of [a,b]){v.r.dispose();v.pose.dispose();v.target.dispose();v.rig.dispose();v.targetRig.dispose();v.world.free();}}
 }
});
