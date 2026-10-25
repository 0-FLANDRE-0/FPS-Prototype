import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {BODY_PROFILE} from '../apps/training/src/human-targets.js';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {CATALOG} from '../apps/training/src/catalog.js';
import {computeProjectileKinetics} from '../apps/training/src/generated/catalog.js';
import {MEDICAL_S2_VALUES,structuralWoundS2,createMedicalS2Slots,refreshStructuralStateS2,structuralArrestReasonS2} from '../apps/training/src/medical-s2-effects.js';
import {applyWoundChannelEffectsS1,cavityNeuroTargetS1} from '../apps/training/src/medical-s1-effects.js';
const advance=(med,seconds,start=0)=>{for(let i=1;i<=seconds*60;i++)med.tick(1/60,start+i/60);};
const bone={id:'left-humerus',identifier:'humerus',kind:'bone',traversedLengthM:.02,intervals:[[0,.02]],entryDepthM:0,exitDepthM:.02};
function wound({partKey='leftArm',energy=200,boneEnergy=0,hits=[],risk=0}={}){
  return {id:1,partKey,bodyTrajectory:{internalGeometry:{internalHits:hits,nearMisses:[]},woundChannel:{ruleId:'wound-channel-s2',energyLostJ:energy,boneEnergyLostJ:boneEnergy,boneHits:hits.map(h=>({...h,energyLostJ:boneEnergy})),concussionRisk:risk,organs:[]}}};
}
function event({part='left_arm',damage=1,energy=200,boneEnergy=0,hits=[]}={}){
  const w=wound({partKey:part,energy,boneEnergy,hits});
  return {sourceType:'bullet',hitPart:part,isLeft:true,rawDamage:damage,tissueDamage:damage,penetration:40,armorResult:'penetrated',ammoId:'556_m855',weaponId:'m4a1',hitZone:part,impactAddress:{region:part,side:'rear',zone:'forearm',fullAddress:'rear.'+part},trainingMetadata:{internalGeometry:w.bodyTrajectory.internalGeometry,woundChannel:w.bodyTrajectory.woundChannel}};
}
test('S2 HP exhaustion is structural: head survives without CNS geometry, chest arrests immediately (S3b abdomen excluded) and dies only after the retained 300 seconds',()=>{
  const head=new TrainingMedical();head.actor.medical.bodyParts.head.hp=0;head.legacy.recalcMedicalSummary(head.actor);head.legacy.syncLegacyCombatState(head.actor);
  assert.equal(head.actor.isDead,false);assert.equal(head.actor.medical.cardiacArrest,false);assert.equal(head.actor.medical.lifeStatus,100);assert.equal(head.actor.medical.structuralTrauma.headStructureDestroyed,true);
  assert.equal(head.actor.medical.bodyParts.head.structuralState,'head_structure_destroyed');assert.equal(head.actor.medical.deathReason,null);
  for(const key of['chest']){
    const med=new TrainingMedical(),m=med.actor.medical;m.bodyParts[key].hp=0;med.legacy.recalcMedicalSummary(med.actor);med.legacy.syncLegacyCombatState(med.actor);
    assert.equal(m.cardiacArrest,true);assert.equal(m.arrestReason,'torso_destroyed');assert.equal(m.isDead,false);assert.deepEqual(m.structuralTrauma.torsoDestroyed,[key]);
    advance(med,299);assert.equal(m.isDead,false);advance(med,1,299);assert.equal(m.isDead,true);assert.equal(m.deathReason,'torso_destroyed');
  }
});
test('S2 depleted limbs lose only their own structural function and neck retains its previous life cap',()=>{
  for(const key of['leftArm','rightArm','leftLeg','rightLeg']){
    const med=new TrainingMedical(),m=med.actor.medical;m.bodyParts[key].hp=0;med.legacy.recalcMedicalSummary(med.actor);med.legacy.syncLegacyCombatState(med.actor);advance(med,1);
    assert.equal(m.bodyParts[key].functionRatio,0);assert.equal(m.bodyParts[key].structuralState,'unusable');assert.equal(m.isDead,false);assert.equal(m.cardiacArrest,false);assert.equal(m.consciousness,100);assert.equal(m.lifeStatus,100);
  }
  const med=new TrainingMedical(),m=med.actor.medical;m.bodyParts.neck.hp=0;med.legacy.recalcMedicalSummary(med.actor);med.legacy.syncLegacyCombatState(med.actor);
  assert.equal(m.lifeStatus,5);assert.equal(m.cardiacArrest,false);assert.equal(m.isDead,false);assert.equal(structuralArrestReasonS2(m),null);
});
test('S2 comminution requires one positive actual bone chord and the single-hit bone-energy threshold; cavity-only and repeated subthreshold hits do not qualify',()=>{
  for(const sample of[wound({boneEnergy:249.99,hits:[bone]}),wound({boneEnergy:300,hits:[]}),wound({boneEnergy:300,hits:[{...bone,traversedLengthM:0}]})])assert.equal(structuralWoundS2(sample).comminuted,false);
  assert.equal(structuralWoundS2(wound({boneEnergy:250,hits:[bone]})).comminuted,true);
  const med=new TrainingMedical();for(let i=0;i<12;i++)med.legacy.applyDamageEvent(med.actor,event({boneEnergy:200,hits:[bone]}));
  assert.equal(med.actor.medical.bodyParts.leftArm.s2Comminuted,undefined);assert.equal(med.actor.medical.bodyParts.leftArm.s2Amputated,undefined);
  assert.ok(med.actor.medical.wounds.every(w=>w.s2StructuralTrauma.boneEnergyJ===200&&w.s2StructuralTrauma.comminuted===false));
});
test('energy-qualified comminution uses original fracture bleeding and remains disabled through original function refresh',()=>{
  const med=new TrainingMedical();med.legacy.applyDamageEvent(med.actor,event({energy:500,boneEnergy:250,hits:[bone]}));const m=med.actor.medical,w=m.wounds[0],p=m.bodyParts.leftArm;
  assert.equal(w.fractureEvidence.occurred,true);assert.equal(w.fractureEvidence.fractureType,'comminuted');assert.equal(w.fractureEvidence.geometryBoneId,bone.id);assert.equal(w.fractureEvidence.bleedBonusMul,1.55);
  assert.equal(p.structuralState,'comminuted');assert.equal(p.irreversibleWithoutTreatment,true);assert.equal(p.functionRatio,0);advance(med,1);assert.equal(p.functionRatio,0);assert.equal(m.isDead,false);
  assert.equal(w.bleedingProfile._finalizationCount,1);assert.deepEqual(med.validate(),[]);
});
test('S2 single-hit amputation routes modeled severance into the existing major-vessel path, without fabricating direct anatomy intersections',()=>{
  const med=new TrainingMedical();med.legacy.applyDamageEvent(med.actor,event({energy:8000}));const m=med.actor.medical,w=m.wounds[0],p=m.bodyParts.leftArm;
  assert.equal(p.structuralState,'amputated');assert.equal(p.functionRatio,0);assert.equal(p.amputated,true);assert.equal(w.vascularEvidence.vesselClass,'major_named');assert.equal(w.vascularEvidence.level,'confirmed');assert.equal(w.bleedingProfile.majorVesselLocked,true);
  assert.ok(w.vascularEvidence.s2AmputationSeverance);assert.deepEqual(w.bodyTrajectory.internalGeometry.internalHits,[]);assert.deepEqual(med.validate(),[]);
  const low=new TrainingMedical();for(let i=0;i<20;i++)low.legacy.applyDamageEvent(low.actor,event({energy:7999}));
  assert.equal(low.actor.medical.bodyParts.leftArm.s2Amputated,undefined);assert.ok(low.actor.medical.wounds.every(w=>!w.s2StructuralTrauma.amputated));
});
test('comminution also disables a non-limb structural part immediately while an intact brain retains control of survival',()=>{
  const med=new TrainingMedical(),skull={...bone,id:'skull',identifier:'skull'};
  med.legacy.applyDamageEvent(med.actor,event({part:'head',energy:500,boneEnergy:250,hits:[skull]}));
  const m=med.actor.medical;assert.equal(m.bodyParts.head.structuralState,'comminuted');assert.equal(m.bodyParts.head.functionRatio,0);assert.equal(m.bodyParts.head.disabled,true);
  assert.equal(m.brainInjury,null);assert.equal(m.isDead,false);assert.equal(m.cardiacArrest,false);assert.equal(m.isUnconscious,false);
});
test('the amputation energy threshold exceeds the entire registry non-12.7 projectile energy, even if all entry energy is deposited in one limb',()=>{
  const rows=Object.values(CATALOG.AMMO_PRESETS).map(ammo=>{const v=CATALOG.AMMO_VELOCITY[ammo.id],k=computeProjectileKinetics(ammo,v,v);return {id:ammo.id,caliber:ammo.caliber,energyJ:.5*k.massKg*v*v};});
  const ordinary=rows.filter(r=>!r.caliber.startsWith('12.7'));assert.equal(ordinary.length,102);assert.ok(ordinary.every(r=>r.energyJ<MEDICAL_S2_VALUES.amputationLimbEnergyJ));
  const max=ordinary.reduce((a,b)=>a.energyJ>b.energyJ?a:b);assert.equal(max.id,'338lm_tacx');assert.ok(Math.abs(max.energyJ-7287.32)<1e-8);
  assert.ok(rows.filter(r=>/^127x(99|108)/.test(r.id)).every(r=>r.energyJ>MEDICAL_S2_VALUES.amputationLimbEnergyJ));
});
test('S2 outside-bone CNS exposure only records concussion risk; penetrated enclosures and direct S0-compatible CNS injuries remain available',()=>{
  const organ=(id,direct,enclosurePenetrated)=>({id,organ:id,kind:'organ',severity:1,volumeM3:.001,effectiveVolumeM3:.001,direct,enclosurePenetrated});
  const w=wound({partKey:'head',risk:.8});w.bodyTrajectory.woundChannel.organs=[organ('brain',false,false),organ('brainstem',false,false)];
  applyWoundChannelEffectsS1(w,w.bodyTrajectory);assert.deepEqual(w.physiologicInjuries,[]);assert.equal(w.concussionRisk,.8);assert.equal(w.concussionPhysiologyApplied,false);assert.equal(cavityNeuroTargetS1({wounds:[w]}).targetCap,100);
  w.bodyTrajectory.woundChannel.organs=[organ('brain',false,true)];applyWoundChannelEffectsS1(w,w.bodyTrajectory);assert.equal(cavityNeuroTargetS1({wounds:[w]}).targetCap,0);
  w.bodyTrajectory.woundChannel.organs=[organ('brainstem',true,false)];applyWoundChannelEffectsS1(w,w.bodyTrajectory);assert.equal(w.physiologicInjuries[0].type,'brain_tissue_disruption');
});
test('retained cumulative amputation labels do not bypass the S2 single-hit gate',()=>{
  const med=new TrainingMedical(),m=med.actor.medical,w=wound({energy:200}),pd=m.partDestruction.leftArm;
  Object.assign(pd,{state:'traumatic_amputation',functionalCap:0});w.partDestructionEvidence={partDestructionStateAfter:'traumatic_amputation'};
  const adapter=createMedicalS2Slots({reinforceVascularEvidenceWithPartDestruction:()=>null},{});adapter.reinforceVascularEvidenceWithPartDestruction(med.actor,w);
  assert.equal(pd.state,'destroyed');assert.equal(w.partDestructionEvidence.partDestructionStateAfter,'destroyed');assert.equal(m.bodyParts.leftArm.s2Amputated,undefined);assert.equal(w.s2StructuralTrauma.amputated,false);
  refreshStructuralStateS2(med.actor);assert.equal(m.concussionRisk,0);
});

// Controlled completed traces exercise the production recorder across separate
// body paths. Their physical channels are immutable inputs to this medical QA.
function splitTrace(segments,{shotId=901}={}){
  const ammoId='127x99_m33_ball',massKg=.0428,muzzleVelocityMps=890;
  let remainingJ=.5*massKg*muzzleVelocityMps**2;
  const bodyHits=segments.map(({targetId='H01',partKey='leftArm',energyJ,boneEnergyJ=0,m=.2},index)=>{
    const shape=BODY_PROFILE.find(s=>s.part===partKey),address={targetId,shapeId:shape.id,bodyPart:partKey,hitPart:partKey,side:'front',region:'limb',zone:'forearm',subZone:null,fullAddress:'front.limb.'+partKey+'.forearm'},
      velocityInMps=Math.sqrt(2*remainingJ/massKg),velocityOutMps=Math.sqrt(2*Math.max(0,remainingJ-energyJ)/massKg),
      hits=boneEnergyJ?[{...bone,id:index?'left-radius':'left-humerus',identifier:index?'radius_ulna':'humerus'}]:[],
      channel={ruleId:'wound-channel-s2',bodyPart:partKey,entryVelocityMps:velocityInMps,exitVelocityMps:velocityOutMps,energyLostJ:energyJ,boneEnergyLostJ:boneEnergyJ,
        boneHits:hits.map(h=>({...h,energyLostJ:boneEnergyJ})),concussionRisk:0,organs:[],damageMultiplier:m,stateOut:{massKg,yawRad:0}},
      part={bodyPart:partKey,address,lengthM:.05,entryDistance:0,exitDistance:.05,velocityInMps,velocityOutMps,massInKg:massKg,massOutKg:massKg,energyShareJ:energyJ,
        damageIn:1,penIn:40,depth:'body_through_and_through',exitWound:true,woundChannel:channel};
    remainingJ-=energyJ;
    return {targetId,parts:[part],distance:1+index*.2,entryDistance:0,exitDistance:.05,pathLengthM:.05,point:[0,0,-index*.2],incomingDirection:[0,0,-1],
      ruleId:'body-channel-s2',bodyEntered:true,before:{stability:1,velocityMps:velocityInMps},internalHits:hits,nearMisses:[]};
  });
  return {shotId,time:1,origin:new Vector3(0,0,1),direction:new Vector3(0,0,-1),ammoId,ballistics:{muzzleVelocityMps,weaponId:'ak74m'},trace:{bodyHits,armorResults:[]}};
}
test('one projectile sums disjoint same-limb channels for amputation exactly once while each segment keeps its own m and HP damage',()=>{
  const med=new TrainingMedical(),shot=splitTrace([{energyJ:5000,m:.2},{energyJ:4000,m:.7},{energyJ:100,m:.4}]),before=structuredClone(shot.trace),hp=med.actor.medical.bodyParts.leftArm.hp,
    tissueMul=med.legacy.getAmmoMedicalProfile(CATALOG.AMMO_PRESETS[shot.ammoId]).tissueDamageMul||1,records=med.record(shot),m=med.actor.medical;
  assert.equal(m.bodyParts.leftArm.amputated,true);assert.deepEqual(records.map(r=>r.structuralHit.energyLostJ),[5000,9000,9100]);
  assert.deepEqual(records.map(r=>r.structuralHit.amputationThresholdCrossed),[false,true,false]);
  assert.equal(m.wounds.filter(w=>w.vascularEvidence.s2AmputationSeverance).length,1);
  assert.deepEqual(m.wounds.map(w=>w.s2StructuralTrauma.amputated),[false,true,false]);
  assert.deepEqual(records.map(r=>r.woundChannel.damageMultiplier),[.2,.7,.4]);assert.ok(Math.abs(hp-m.bodyParts.leftArm.hp-(.2+.7+.4)*tissueMul)<1e-10);
  assert.deepEqual(shot.trace,before,'clinical prefix metadata must not mutate authoritative physical channels');assert.deepEqual(med.validate(),[]);
  const once=med.snapshot();assert.deepEqual(med.record(shot),[]);assert.deepEqual(med.snapshot(),once,'duplicate-shot guard precedes all event-local structural accumulation');
});
test('separate projectile events cannot combine subthreshold limb or bone energies',()=>{
  const med=new TrainingMedical();med.record(splitTrace([{energyJ:5000,boneEnergyJ:150}],{shotId:911}));med.record(splitTrace([{energyJ:4000,boneEnergyJ:120}],{shotId:912}));
  const m=med.actor.medical;assert.equal(m.bodyParts.leftArm.s2Amputated,undefined);assert.equal(m.bodyParts.leftArm.s2Comminuted,undefined);
  assert.deepEqual(m.wounds.map(w=>w.bodyTrajectory.structuralHit.segmentCount),[1,1]);
  assert.deepEqual(m.wounds.map(w=>w.bodyTrajectory.structuralHit.boneEnergyLostJ),[150,120]);assert.deepEqual(med.validate(),[]);
});
test('one projectile sums bone energies across disjoint same-limb chords and upgrades only the crossing fracture',()=>{
  const med=new TrainingMedical();med.record(splitTrace([{energyJ:500,boneEnergyJ:150},{energyJ:500,boneEnergyJ:120},{energyJ:100,boneEnergyJ:20}],{shotId:921}));
  const m=med.actor.medical;assert.equal(m.bodyParts.leftArm.s2Comminuted,true);assert.equal(m.bodyParts.leftArm.functionRatio,0);
  assert.deepEqual(m.wounds.map(w=>w.bodyTrajectory.structuralHit.boneEnergyLostJ),[150,270,290]);
  assert.deepEqual(m.wounds.map(w=>w.s2StructuralTrauma.comminuted),[false,true,false]);
  const upgraded=m.wounds.filter(w=>w.fractureEvidence.s2Comminution);assert.equal(upgraded.length,1);assert.equal(upgraded[0].fractureEvidence.s2Comminution.energyJ,270);assert.equal(upgraded[0].fractureEvidence.s2Comminution.localEnergyJ,120);
  assert.deepEqual(med.validate(),[]);
});
test('the same projectile cannot combine structural energy across different targets or canonical limbs',()=>{
  const shot=splitTrace([{targetId:'H01',energyJ:5000,boneEnergyJ:150},{targetId:'T02',energyJ:4000,boneEnergyJ:120}],{shotId:931});
  for(const targetId of['H01','T02']){
    const med=new TrainingMedical({targetId});const records=med.record(shot),m=med.actor.medical;
    assert.equal(records.length,1);assert.equal(records[0].structuralHit.segmentCount,1);assert.equal(m.bodyParts.leftArm.s2Amputated,undefined);assert.equal(m.bodyParts.leftArm.s2Comminuted,undefined);assert.deepEqual(med.validate(),[]);
  }
  const med=new TrainingMedical();med.record(splitTrace([{energyJ:5000,boneEnergyJ:150},{partKey:'rightArm',energyJ:4000,boneEnergyJ:120}],{shotId:932}));
  for(const partKey of['leftArm','rightArm']){assert.equal(med.actor.medical.bodyParts[partKey].s2Amputated,undefined);assert.equal(med.actor.medical.bodyParts[partKey].s2Comminuted,undefined);}
  assert.deepEqual(med.validate(),[]);
});
