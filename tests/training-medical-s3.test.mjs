import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {ensureMedicalV2,createMedicalV2Slots} from '../apps/training/src/medical-v2.js';
import {createLegacyMedical} from '../apps/training/src/generated/legacy-medical.js';
import {CATALOG} from '../apps/training/src/catalog.js';
import {BODY_PART_MAX_HP_S3,MEDICAL_S3_VALUES,physicalBodyHpDamageS3,installMedicalS3Adapter} from '../apps/training/src/medical-s3-effects.js';
import {renderMedicalPanel} from '../apps/training/src/medical-panel.js';

const C=MEDICAL_S3_VALUES.effectiveVolumeToHp;
function channel(damage=12,m=.25){return {ruleId:'wound-channel-s2',volumes:{effectiveM3:damage/C*1e-6},damageMultiplier:m,
  energyLostJ:100,boneEnergyLostJ:0,boneHits:[],concussionRisk:0,organs:[],stateOut:{massKg:.004,yawRad:0}};}
function event({ammoId='556_m855',part='left_arm',damage=12,rawDamage=20,tissueDamageMul=1,m=.25,armorResult='penetrated',withChannel=true}={}){
  return {sourceType:'bullet',hitPart:part,isLeft:part.startsWith('left'),rawDamage,
    tissueDamage:rawDamage*tissueDamageMul*m,penetration:40,armorResult,ammoId,weaponId:'m4a1',hitZone:part,
    ammoMedicalProfile:{tissueDamageMul},impactAddress:{region:part,side:'rear',zone:'forearm',fullAddress:'rear.'+part},
    trainingMetadata:{internalGeometry:{internalHits:[],nearMisses:[]},woundChannel:withChannel?channel(damage,m):null}};
}
function unadaptedReference(){
  let seed=0x6d656469;
  const legacy=createLegacyMedical(CATALOG,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},()=>({candidate:'none',rearArmorResult:'no_rear_armor',penAfter:0,armorValue:0}));
  legacy.installMedicalSlots(createMedicalV2Slots);
  const actor=legacy.makeUnit({team:'enemy',name:'H01',x:0,y:0,loadout:{},bodyArmorId:'none',helmetId:'none',frontPlateId:'none',backPlateId:'none'});
  ensureMedicalV2(actor);legacy.ensureMedicalExtensions(actor);legacy.recalcMedicalSummary(actor);legacy.syncLegacyCombatState(actor);
  return {legacy,actor};
}
test('S3 user structural maxima and aliases apply to every v2 actor and survive tick, reset and summary, while explicit legacy retains original HP',()=>{
  for(const targetId of['H01','E01','P01']){
    const med=new TrainingMedical({targetId}),u=med.actor,m=u.medical;
    const maxima=()=>Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.maxHp]));
    assert.deepEqual(maxima(),BODY_PART_MAX_HP_S3);assert.equal(m.bodyHpMax,955);assert.equal(m.bodyHpTotal,955);
    for(const[key,value]of Object.entries({head:85,neck:60,chest:240,abdomen:180,arms:75,legs:120,left_arm:75,right_arm:75,left_leg:120,right_leg:120}))assert.equal(u.bodyHpMax[key],value);
    m.bodyParts.leftArm.hp-=7;med.tick(1/60,1/60);med.legacy.recalcMedicalSummary(u);med.legacy.syncLegacyCombatState(u);
    assert.deepEqual(maxima(),BODY_PART_MAX_HP_S3);assert.equal(m.bodyHpMax,955);assert.equal(m.bodyHpTotal,948);assert.equal(u.bodyHp.left_arm,68);
    med.reset();assert.equal(med.actor.medical.bodyHpTotal,955);assert.equal(med.actor.medical.bodyParts.neck.hp,60);
  }
  const legacy=new TrainingMedical({medicalModel:'legacy'}).actor.medical;
  assert.deepEqual(Object.fromEntries(Object.entries(legacy.bodyParts).map(([k,p])=>[k,p.maxHp])),{head:35,neck:25,chest:85,abdomen:70,leftArm:60,rightArm:60,leftLeg:65,rightLeg:65});
  assert.equal(legacy.bodyHpMax,465);assert.equal(legacy.bodyHpRuleId,undefined);
});
test('S3 physical HP depends only on this occupied part effective volume and common C, independently of registry compatibility damage, tissue multiplier and m',()=>{
  for(const ammoId of['556_m855','556_m193','545_ps_gs','545_bs_gs'])for(const [rawDamage,tissueDamageMul,m]of[[1,.2,.1],[90,1.7,3]]){
    const med=new TrainingMedical(),ev=event({ammoId,rawDamage,tissueDamageMul,m}),before=structuredClone(ev.trainingMetadata.woundChannel);
    med.legacy.applyDamageEvent(med.actor,ev);
    assert.equal(med.actor.medical.bodyParts.leftArm.hp,63);
    const log=med.actor.medical._lastDamageEvent;assert.equal(log.bodyHpDamage,12);assert.equal(log.bodyDmg,rawDamage*tissueDamageMul*m);
    assert.equal(log.bodyHpCalibration.appliedDamage,12);assert.equal(log.bodyHpRuleId,'body-hp-s3b');
    assert.deepEqual(ev.trainingMetadata.woundChannel,before);assert.equal(med.actor.medical.wounds.at(-1).bodyHpDamage.damage,12);
    assert.deepEqual(Object.getOwnPropertyDescriptor(med.actor.medical.bodyParts.leftArm,'hp'),{value:63,writable:true,enumerable:true,configurable:true});
  }
  const c=channel();c.volumes.effectiveM3=25e-6;
  assert.equal(physicalBodyHpDamageS3('545_ps_gs',c).damage,25*C);
});
test('S3 HP adapter leaves immediate bleeding, pain, acute response, organ severity and wound physiology inputs at their retained values',()=>{
  const adapted=new TrainingMedical(),reference=unadaptedReference(),a=event({damage:12,rawDamage:40,tissueDamageMul:1.35,m:.7}),b=structuredClone(a);
  adapted.legacy.applyDamageEvent(adapted.actor,a);reference.legacy.applyDamageEvent(reference.actor,b);
  const am=adapted.actor.medical,bm=reference.actor.medical;
  for(const key of['bloodMl','externalBleedRate','internalBleedRate','pain','acutePain','painFloor','shock','consciousness','breathingEfficiency','_acuteResponse','stressResponse'])assert.deepEqual(am[key],bm[key],key);
  const aw=am.wounds[0],bw=bm.wounds[0];
  for(const key of['bodyTrajectory','bleedingProfile','physiologicInjuries','physiologicEffectProfile','s1OrganDamage','s2StructuralTrauma','immediatePhysiology'])assert.deepEqual(aw[key],bw[key],key);
  assert.equal(am.bodyParts.leftArm.hp,63);assert.equal(bm.bodyParts.leftArm.hp,75-40*1.35*.7);
});
test('non-5.56/5.45 retains v40 per-segment damage amount and explicit legacy never installs the physical adapter',()=>{
  for(const ammoId of['762x39_ps','9mm_jhp','127x99_m33_ball']){
    const med=new TrainingMedical(),ev=event({ammoId,rawDamage:13,tissueDamageMul:1.3,m:.4});
    med.legacy.applyDamageEvent(med.actor,ev);assert.equal(med.actor.medical.bodyParts.leftArm.hp,75-13*1.3*.4);
    assert.equal(med.actor.medical._lastDamageEvent.bodyHpRuleId,undefined);assert.equal(physicalBodyHpDamageS3(ammoId,channel()),null);
  }
  const legacy=new TrainingMedical({medicalModel:'legacy'}),ev=event({rawDamage:13,tissueDamageMul:1.3,m:.4});legacy.legacy.applyDamageEvent(legacy.actor,ev);
  assert.equal(legacy.actor.medical.bodyParts.leftArm.hp,60-13*1.3*.4);assert.equal(legacy.actor.medical._lastDamageEvent.bodyHpRuleId,undefined);
});
test('all calibrated v2 body and armor entry paths prohibit compatibility HP fallback when physical tissue volume is absent',()=>{
  for(const armorResult of['penetrated','stopped','absorbed','deflected','ricocheted']){
    const med=new TrainingMedical(),ev=event({withChannel:false,armorResult,rawDamage:90});ev.bluntTrauma=20;
    med.legacy.applyDamageEvent(med.actor,ev);assert.equal(med.actor.medical.bodyParts.leftArm.hp,75);
    assert.equal(med.actor.medical._lastDamageEvent.bodyHpDamage,0);assert.ok(med.actor.medical.pain>0);
    assert.equal(ev.trainingMetadata.bodyHpDamage.status,armorResult==='penetrated'?'physical-channel-unavailable':'no-tissue-volume-armor-stop');
  }
  const med=new TrainingMedical(),ev=event({withChannel:false});ev.trainingMetadata.ruleId='body-exit-sqrt-pen-ratio-v1';med.legacy.applyDamageEvent(med.actor,ev);
  assert.equal(ev.trainingMetadata.bodyHpDamage.status,'explicit-legacy-body-trace');assert.equal(med.actor.medical.bodyParts.leftArm.hp,75);
  const reference=unadaptedReference(),adapted=new TrainingMedical(),ctx={bodyPart:'chest',location:'chest',isLeft:null,penetrated:false,blockMaterial:'aramid'},
    weapon={id:'ak74',_ammo:CATALOG.AMMO_PRESETS['556_m855'],ammoId:'556_m855'};
  adapted.legacy.applyOutcome(adapted.actor,adapted.legacy.OUTCOME.BLOCK,structuredClone(weapon),structuredClone(ctx));
  reference.legacy.applyOutcome(reference.actor,reference.legacy.OUTCOME.BLOCK,structuredClone(weapon),structuredClone(ctx));
  assert.equal(adapted.actor.medical.bodyParts.chest.hp,240);assert.ok(reference.actor.medical.bodyParts.chest.hp<240);
  assert.equal(adapted.actor.medical._lastDamageEvent.bodyHpCalibration.status,'no-tissue-volume-armor-stop');
  for(const key of['pain','externalBleedRate','internalBleedRate','_acuteResponse'])assert.deepEqual(adapted.actor.medical[key],reference.actor.medical[key],key);
});
test('calibrated ammunition fragment/spall compatibility events preserve wound physiology without adding another no-channel HP debit',()=>{
  const med=new TrainingMedical(),reference=unadaptedReference(),ev=event({withChannel:false,rawDamage:4});ev.sourceType='frag';
  med.legacy.applyDamageEvent(med.actor,structuredClone(ev));reference.legacy.applyDamageEvent(reference.actor,structuredClone(ev));
  const a=med.actor.medical,b=reference.actor.medical;
  assert.equal(a.bodyParts.leftArm.hp,75);assert.ok(b.bodyParts.leftArm.hp<75);assert.equal(a._lastDamageEvent.bodyHpCalibration.status,'physical-channel-unavailable');
  for(const key of['pain','_acuteResponse','externalBleedRate','internalBleedRate'])assert.deepEqual(a[key],b[key],key);
  assert.deepEqual(a.wounds[0].bleedingProfile,b.wounds[0].bleedingProfile);
  // The current extracted applyOutcome has one lexical bullet call and no
  // spall recursion. Exercise its boundary against multiple internal writes
  // too, without pretending those writes are an existing production feature.
  const fake={OUTCOME:{BLOCK:'BLOCK'},applyDamageEvent(){},applyOutcome(u){u.medical.bodyParts.leftArm.hp-=2;u.medical.bodyParts.leftArm.hp-=3;u.medical.bodyParts.rightArm.hp-=4;}},
    closed=new TrainingMedical();installMedicalS3Adapter(fake);
  fake.applyOutcome(closed.actor,'BLOCK',{ammoId:'556_m855'},{penetrated:false});
  assert.equal(closed.actor.medical.bodyParts.leftArm.hp,75);assert.equal(closed.actor.medical.bodyParts.rightArm.hp,75);
});
test('S3 records nominal volume damage separately from clamped HP loss and preserves chest and limb zero meanings with S3b abdomen pain',()=>{
  for(const[part,key,max]of[['left_arm','leftArm',75],['left_leg','leftLeg',120],['chest','chest',240],['abdomen','abdomen',180]]){
    const med=new TrainingMedical(),ev=event({part,damage:max+25,rawDamage:1});med.legacy.applyDamageEvent(med.actor,ev);const m=med.actor.medical;
    assert.equal(m.bodyParts[key].hp,0);assert.ok(Math.abs(m._lastDamageEvent.bodyHpDamage-(max+25))<1e-10);assert.equal(m._lastDamageEvent.bodyHpCalibration.appliedDamage,max);
    if(/Arm|Leg/.test(key)){assert.equal(m.bodyParts[key].functionRatio,0);assert.equal(m.cardiacArrest,false);assert.equal(m.isDead,false);}
    else if(key==='abdomen'){assert.equal(m.cardiacArrest,false);assert.equal(m.bodyParts.abdomen.structuralState,'abdomen_destroyed');assert.ok(m.painFloor>=95);}
    else{assert.equal(m.cardiacArrest,true);assert.equal(m.arrestReason,'torso_destroyed');assert.equal(m.isDead,false);}
  }
  const med=new TrainingMedical();med.actor.medical.bodyParts.head.hp=0;med.legacy.recalcMedicalSummary(med.actor);med.legacy.syncLegacyCombatState(med.actor);
  assert.equal(med.actor.isDead,false);assert.equal(med.actor.medical.cardiacArrest,false);assert.equal(med.actor.medical.structuralTrauma.headStructureDestroyed,true);
});
test('the adapter restores ordinary HP properties if the retained damage function throws',()=>{
  const med=new TrainingMedical(),part=med.actor.medical.bodyParts.leftArm,
    fake={OUTCOME:{BLOCK:'BLOCK'},applyDamageEvent(u){u.medical.bodyParts.leftArm.hp-=4;throw Error('controlled damage exception');},applyOutcome(){}};
  installMedicalS3Adapter(fake);assert.throws(()=>fake.applyDamageEvent(med.actor,event()),/controlled damage exception/);
  assert.deepEqual(Object.getOwnPropertyDescriptor(part,'hp'),{value:63,writable:true,enumerable:true,configurable:true});
});
test('medical panel reads every new HP maximum and labels calibrated physical HP separately from the uncalibrated path',()=>{
  class Element{constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.dataset={};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}}
  const saved=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const med=new TrainingMedical(),container=new Element('div');renderMedicalPanel(med,container);
    const all=node=>[node.textContent,...node.children.flatMap(all)],texts=all(container);
    for(const hp of[85,60,240,180,75,120])assert.ok(texts.includes(`${hp.toFixed(1)}/${hp}`));
    assert.ok(texts.some(t=>t.includes('유효 손상량 × 공통 C')));assert.ok(texts.some(t=>t.includes('미보정(v40 식)')));
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
