import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {MEDICAL_S3B_VALUES} from '../apps/training/src/medical-s3b-effects.js';
import {CATALOG} from '../apps/training/src/catalog.js';
import {S3_TERMINAL_SETTINGS} from '../apps/training/src/wound-s3-types.js';
import {computeWoundChannel} from '../apps/training/src/wound-channel.js';
import {DAMAGE_INDICES_S3} from '../apps/training/src/damage-index-s3.js';

test('S3b abdomen HP0 stays alive without structural arrest, keeps a persistent floor and retains masking and indirect physiology',()=>{
  const med=new TrainingMedical(),m=med.actor.medical;
  m.bodyParts.abdomen.hp=0;
  med.legacy.recalcMedicalSummary(med.actor);med.legacy.syncLegacyCombatState(med.actor);
  assert.equal(m.bodyParts.abdomen.structuralState,'abdomen_destroyed');
  assert.equal(m.structuralTrauma.abdomenDestroyed,true);assert.deepEqual(m.structuralTrauma.torsoDestroyed,[]);
  for(let i=0;i<7200;i++){
    med.tick(1/60,i/60);assert.equal(m.cardiacArrest,false);assert.equal(m.isDead,false);
    assert.equal(m.abdomenPainFloor,MEDICAL_S3B_VALUES.abdomenDestroyedPainFloor);
    assert.ok(m.painFloor>=95&&m.pain>=m.painFloor);assert.ok(m.stressResponse.painMasking<=.85);
    assert.ok(Math.abs(m.stressResponse.perceivedPain-m.pain*(1-m.stressResponse.painMasking))<1e-8);
  }
  assert.ok(m.stressResponse.injuryDrive>0);assert.ok(m.stressResponse.adrenaline>0);assert.ok(m.heartRate>0);
  assert.deepEqual(med.validate(),[]);
  med.reset();assert.equal(med.actor.medical.abdomenPainFloor,0);assert.equal(med.actor.medical.bodyParts.abdomen.hp,180);
});

test('S3b leaves original M855 registry yaw760 while its explicit3D override uses shared M193 defaults and threshold',()=>{
  const a=S3_TERMINAL_SETTINGS['556_m855'],b=S3_TERMINAL_SETTINGS['556_m193'];
  assert.equal(CATALOG.AMMO_TERMINAL_EFFECT['556_m855'].type,'yaw');assert.equal(a.originalTerminalEffect.type,'yaw');
  assert.equal(a.type,'fragment');assert.equal(a.thresholdVelocity,760);assert.equal(a.grade,'family');assert.equal(a.typeDefaults,b.typeDefaults);
  for(const speed of[759.999,760,760.001]){
    const c=computeWoundChannel({ammoId:'556_m855',entryVelocityMps:speed,massKg:.00402,lengthM:.5,bodyPart:'chest'});
    assert.equal(c.fragmentation,speed>=760);assert.equal(c.s3Terminal.type,'fragment');
  }
});

test('S3b abdomen HP0 keeps its exhaustion label alongside existing bone comminution evidence',()=>{
  const med=new TrainingMedical(),m=med.actor.medical,p=m.bodyParts.abdomen;
  p.hp=0;p.s2Comminuted=true;p.boneState='comminuted';p.irreversibleWithoutTreatment=true;
  med.legacy.recalcMedicalSummary(med.actor);med.legacy.syncLegacyCombatState(med.actor);
  assert.equal(p.structuralState,'abdomen_destroyed');assert.equal(p.boneState,'comminuted');
  assert.equal(p.irreversibleWithoutTreatment,true);assert.equal(p.functionRatio,0);
  assert.equal(m.structuralTrauma.abdomenDestroyed,true);assert.equal(m.cardiacArrest,false);assert.ok(m.painFloor>=95);
});

test('S3b early10cm column uses each actual muscle channel and the shared M85510m30cm denominator',()=>{
  const reference=DAMAGE_INDICES_S3['556_m855'].near.effectiveVolumeCm3;
  for(const[id,r]of Object.entries(DAMAGE_INDICES_S3)){
    const c=computeWoundChannel({ammoId:id,entryVelocityMps:r.near.entryVelocityMps,massKg:CATALOG.AMMO_REGISTRY[id].projectile.massG/1000,lengthM:.1,bodyPart:'chest'});
    assert.equal(r.early.effectiveVolumeCm3,c.volumes.effectiveM3*1e6);assert.equal(r.early.index,c.volumes.effectiveM3*1e6/reference*100);
    assert.ok(r.early.effectiveVolumeCm3<=r.near.effectiveVolumeCm3+1e-8);
  }
  for(const[id,normal]of[['556_hp','556_m855'],['545_hp','545_ps_gs'],['545_sp','545_ps_gs']])assert.ok(DAMAGE_INDICES_S3[id].early.index>DAMAGE_INDICES_S3[normal].early.index);
});
