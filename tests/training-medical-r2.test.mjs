import test from 'node:test';import assert from 'node:assert/strict';
import {TrainingMedical} from '../apps/training/src/medical.js';
const advance=(med,seconds)=>{for(let i=1;i<=seconds*60;i++)med.tick(1/60,i/60);};
const event=(part,hits)=>({sourceType:'bullet',hitPart:part,isLeft:true,rawDamage:8,penetration:40,armorResult:'penetrated',ammoId:'556_m855',weaponId:'m4a1',hitZone:part,impactAddress:{region:part,side:'rear',zone:part==='neck'?'nape':'forearm',fullAddress:'rear.'+part},trainingMetadata:{internalGeometry:{internalHits:hits,nearMisses:[]}}});
test('upper cord disables limbs immediately, preserves traumatic HP and delays unconsciousness before respiratory arrest',()=>{
 const med=new TrainingMedical();med.seed=1;med.legacy.applyDamageEvent(med.actor,event('neck',[{id:'upper-cord',identifier:'cervical_spine_candidate',kind:'organ',organ:'spinal_cord',cordRegion:'A',domain:'neck',candidate:'cervical_spine_candidate'}]));
 const m=med.actor.medical,hp=Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.hp]));assert.equal(m.downReason,'spinal_cord_injury');assert.equal(m.isUnconscious,false);assert.equal(m.breathingEfficiency,0);
 let unconscious,arrest;for(let i=1;i<=12000;i++){med.tick(1/60,i/60);if(m.isUnconscious)unconscious??=i/60;if(m.cardiacArrest)arrest??=i/60;}
 assert.ok(unconscious>=20&&unconscious<=150);assert.ok(arrest>unconscious);assert.equal(m.arrestReason,'respiratory_failure');assert.deepEqual(Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.hp])),hp);
});
test('lower cord stays down through original function recomputation while conscious arms can shoot and crawl',()=>{
 const med=new TrainingMedical();med.legacy.applyDamageEvent(med.actor,event('abdomen',[{id:'lumbar-cord',identifier:'cervical_spine_candidate',kind:'organ',organ:'spinal_cord',cordRegion:'B',domain:'abdomen',candidate:'cervical_spine_candidate'}]));advance(med,60);
 const m=med.actor.medical;assert.equal(m.downReason,'spinal_cord_injury');assert.equal(m.bodyParts.leftLeg.functionRatio,0);assert.equal(m.bodyParts.rightLeg.functionRatio,0);assert.ok(m.consciousness>=80);assert.equal(m.canShoot,true);assert.equal(m.canCrawl,true);assert.equal(m.canWalk,false);
});
test('minor fractures use the original fracture roll and close naturally; femur/pelvis retain their floor',()=>{
 for(const [identifier,part]of [['spine','neck'],['humerus','left_arm'],['radius_ulna','left_arm'],['tibia_fibula','left_leg'],['clavicle','chest'],['skull','head'],['femur','left_leg'],['pelvis','abdomen']]){
  const med=new TrainingMedical();med.seed=1;med.legacy.applyDamageEvent(med.actor,event(part,[{id:identifier,identifier,kind:'bone'}]));const w=med.actor.medical.wounds[0];assert.equal(w.fractureEvidence.occurred,true,identifier+' actual original RNG');
  if(['femur','pelvis'].includes(identifier)){assert.ok(w.bleedingProfile.naturalReductionTargetExternal>0||w.bleedingProfile.naturalReductionTargetInternal>0);continue;}
  advance(med,1800);assert.ok(med.actor.medical.externalBleedRate+med.actor.medical.internalBleedRate<=.2,identifier+' bleeding closure');assert.equal(w.bleedingProfile._finalizationCount,1);
 }
});
