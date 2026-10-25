import test from 'node:test';
import assert from 'node:assert/strict';
import {medicalMuscleStrength,MUSCLE,followGeneralStrength} from '../apps/training/src/muscle-data.js';
import {TrainingMedical} from '../apps/training/src/medical.js';
test('medical muscle adapter is read-only, preserves conscious torso on spinal B and separates limbs',()=>{
 const unit=new TrainingMedical().actor,before=structuredClone(unit),healthy=medicalMuscleStrength(unit);assert.equal(healthy.general,1);assert.deepEqual(unit,before);
 unit.medical.spinalCordInjury={region:'B'};unit.medical.bodyParts.leftLeg.functionRatio=unit.medical.bodyParts.rightLeg.functionRatio=0;
 const spinal=medicalMuscleStrength(unit);assert.equal(spinal.support,0);assert.equal(spinal.general,1);assert.equal(spinal.collapse,true);assert.equal(spinal.arms.left,1);
 delete unit.medical.spinalCordInjury;unit.medical.bodyParts.leftLeg.functionRatio=unit.medical.bodyParts.rightLeg.functionRatio=1;unit.medical.bodyParts.rightArm.functionRatio=.2;
 assert.equal(medicalMuscleStrength(unit).arms.right,.2);unit.medical.pain=100;unit.medical.hemodynamics.map=30;unit.medical.consciousness=25;
 const weak=medicalMuscleStrength(unit);assert.ok(weak.general>=MUSCLE.minAwakeStrength);assert.equal(weak.collapse,false);
 unit.medical.isUnconscious=true;assert.equal(medicalMuscleStrength(unit).general,0);unit.medical.cardiacArrest=true;assert.equal(medicalMuscleStrength(unit).dead,true);
});
test('collapse fade reaches zero in the configured interval; leg failure also becomes passive',()=>{
 for(const [unconscious,duration]of [[true,.45],[false,.40]])for(const initial of [1,.62]){
  const state={strength:initial},m={dead:false,unconscious,collapse:true,general:unconscious?0:1};
  const ticks=Math.round(duration*60);
  for(let i=0;i<ticks-1;i++)state.strength=followGeneralStrength(state,m,1/60);
  assert.ok(state.strength>0);state.strength=followGeneralStrength(state,m,1/60);
  assert.ok(state.strength<1e-12);assert.equal(state.collapseDurationS,duration);
  assert.equal(followGeneralStrength(state,{dead:false,unconscious:false,collapse:false,general:1},1/60),0,'recovered medical values cannot reactivate a fallen controller');
 }
 assert.equal(followGeneralStrength({strength:1},{dead:true},1/60),0);
 assert.ok(MUSCLE.consciousnessFadeS>=.3&&MUSCLE.consciousnessFadeS<=.6);
 assert.ok(MUSCLE.legCollapseFadeS>=.2&&MUSCLE.legCollapseFadeS<=.4);
});

test('walking collapse keeps animation phase and velocity, then disables every motor without an anchor or recovery',async()=>{
 const {readFile}=await import('node:fs/promises'),{Vector3}=await import('three'),{rigOnly}=await import('../scripts/training-fps-model.mjs'),{createPhysics}=await import('../apps/training/src/physics.js'),{createSoldierRig}=await import('../apps/training/src/soldier-rig.js'),{CombatPose}=await import('../apps/training/src/combat-pose.js'),{CombatRagdoll}=await import('../apps/training/src/combat-ragdoll.js'),{registerCombatBody}=await import('../apps/training/src/combat-physics.js'),{activateMuscles,controlMuscles}=await import('../apps/training/src/strength-ragdoll.js');
 const source=await rigOnly(await readFile('dist/soldier-fingers.glb')),physics=await createPhysics({humanTargets:[]}),rig=createSoldierRig(),targetRig=createSoldierRig(),pose=new CombatPose(rig,source.animations),target=new CombatPose(targetRig,source.animations),actor={id:'COLLAPSE',at:[100,0,0],yaw:0},registered=registerCombatBody(physics,actor,rig);
 pose.sample('walk',.30);pose.remember(actor,0);const rag=new CombatRagdoll(physics,registered,pose);
 actor.at[2]+=1.4/60;pose.sample('walk',.30+1/60);pose.remember(actor,1/60);const expectedVelocities=pose.velocities();
 try{
  assert.equal(rag.supportBody,undefined);assert.equal(rag.supportJoint,undefined);
  activateMuscles(rag,target,{clip:'walk',walkSeconds:.30+1/60,velocity:new Vector3(0,0,1.4)});
  assert.equal(rag.collapse.moving,true);assert.equal(rag.collapse.walkRate,1);
  for(const part of rag.parts.values()){const v=part.body.velocityAtPoint(part.body.translation());assert.ok(new Vector3(v.x,v.y,v.z).distanceTo(expectedVelocities.get(part.bone).linear)<1e-5);}
  const unit={medical:{isUnconscious:true,consciousness:0,bodyParts:{}}};
  controlMuscles(rag,1/60,1/60,unit);assert.ok(Math.abs(rag.collapse.walkPhaseS-(.30+2/60))<1e-12);assert.ok(rag.joints.some(j=>j.controls.some(c=>c.strength>0)));
  assert.equal(rag.brace.enabled,false);assert.ok(rag.joints.filter(j=>/UpperArm|Forearm|Hand/.test(j.childBone)).every(j=>j.controls.every(c=>c.strength===0)),'unconscious arms never retain an aiming/crouch target');
  for(let i=1;i<30;i++)controlMuscles(rag,1/60,(i+1)/60,unit);
  assert.equal(rag.mode,'passive');assert.equal(rag.strength,0);assert.equal(rag.collapse.goalsActive,false);
  for(const joint of rag.joints)for(const c of joint.controls){assert.equal(c.strength,0);assert.equal(c.kp,0);assert.equal(c.kd,0);assert.equal(c.maxForce,0);}
  const phase=rag.collapse.walkPhaseS;controlMuscles(rag,1,2,{medical:{consciousness:100,bodyParts:{}}});assert.equal(rag.collapse.walkPhaseS,phase);assert.equal(rag.mode,'passive');assert.ok([...rag.parts.values()].every(p=>p.body.isDynamic()));
 }finally{rag.dispose();registered.dispose();pose.dispose();target.dispose();rig.dispose();targetRig.dispose();physics.dispose();}
});
