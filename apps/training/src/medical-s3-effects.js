import {isS3CalibratedAmmo} from './wound-s3-types.js';

// S3: user-designed structural HP applies to 3D medical v2 only. The retained
// generated declarations and original 2D HP/damage registries are unchanged.
export const BODY_PART_MAX_HP_S3=Object.freeze({
  head:85,neck:60,chest:240,abdomen:180,leftArm:75,rightArm:75,leftLeg:120,rightLeg:120,
});
const TOTAL_HP=Object.values(BODY_PART_MAX_HP_S3).reduce((n,hp)=>n+hp,0);
export const MEDICAL_S3_VALUES=Object.freeze({
  bodyHpRuleId:'body-hp-s3b',
  bodyPartMaxHp:BODY_PART_MAX_HP_S3,totalBodyHp:TOTAL_HP,
  effectiveVolumeToHp:0.09174725695886135,
  calibrationStatus:'fixed-global-fit',
  calibrationReference:'M855, 5 m, no armor; 21 representative paths; equal part-category and path weights',
  effectiveVolumeUnit:'cm3',
  hpClassification:'user-design',
  coefficientClassification:'tuning: one global M855 representative-path fit',
});
const storageAliases={head:'head',neck:'neck',chest:'chest',thorax:'chest',abdomen:'abdomen',abd:'abdomen',
  left_arm:'leftArm',leftarm:'leftArm',arm_left:'leftArm',right_arm:'rightArm',rightarm:'rightArm',arm_right:'rightArm',
  left_leg:'leftLeg',leftleg:'leftLeg',leg_left:'leftLeg',right_leg:'rightLeg',rightleg:'rightLeg',leg_right:'rightLeg'};
function eventPartKey(ev){
  const key=ev.trainingMetadata?.bodyPart||ev.partKey||ev.hitPart;
  if(BODY_PART_MAX_HP_S3[key]!=null)return key;
  const lower=String(key||'').toLowerCase().trim();
  if(storageAliases[lower])return storageAliases[lower];
  // Production 3D addresses always carry an explicit side. Do not consume the
  // retained medical random stream to guess one for a malformed test event.
  if(ev.isLeft!=null&&['arm','arms','leg','legs'].includes(lower))return `${ev.isLeft?'left':'right'}${lower[0]==='a'?'Arm':'Leg'}`;
  return null;
}
export function initializeMedicalHpS3(unit){
  const m=unit.medical;if(!m||m.bodyHpRuleId===MEDICAL_S3_VALUES.bodyHpRuleId)return;
  for(const[key,maxHp]of Object.entries(BODY_PART_MAX_HP_S3)){
    const p=m.bodyParts[key],wasFull=p.hp===p.maxHp;
    p.maxHp=maxHp;p.hp=wasFull?maxHp:Math.max(0,Math.min(maxHp,p.hp));
  }
  m.bodyHpRuleId=MEDICAL_S3_VALUES.bodyHpRuleId;m.bodyHpMax=TOTAL_HP;
  m.bodyHpTotal=Object.values(m.bodyParts).reduce((n,p)=>n+p.hp,0);
  if(unit.bodyHpMax)Object.assign(unit.bodyHpMax,{head:85,neck:60,chest:240,abdomen:180,arms:75,legs:120,
    left_arm:75,right_arm:75,left_leg:120,right_leg:120});
}
export function physicalBodyHpDamageS3(ammoId,channel,{armorResult='penetrated',bodyRuleId=null}={}){
  if(!isS3CalibratedAmmo(ammoId))return null;
  const volume=channel?.volumes?.effectiveM3;
  const blocked=['stopped','absorbed','deflected','ricocheted'].includes(armorResult),
    available=!blocked&&channel?.ruleId==='wound-channel-s2'&&Number.isFinite(volume)&&volume>=0,
    effectiveVolumeCm3=available?volume*1e6:0;
  return {ruleId:MEDICAL_S3_VALUES.bodyHpRuleId,calibrated:true,physicalChannelAvailable:available,ammoId,effectiveVolumeCm3,
    status:blocked?'no-tissue-volume-armor-stop':available?'physical-volume':bodyRuleId==='body-exit-sqrt-pen-ratio-v1'?'explicit-legacy-body-trace':'physical-channel-unavailable',
    coefficientHpPerCm3:MEDICAL_S3_VALUES.effectiveVolumeToHp,damage:effectiveVolumeCm3*MEDICAL_S3_VALUES.effectiveVolumeToHp};
}
function withHpWriteOverride(unit,parts,hpDamage,action){
  const m=unit.medical,woundCount=m.wounds.length,overrides=parts.map(partKey=>{
    const part=m.bodyParts[partKey],descriptor=Object.getOwnPropertyDescriptor(part,'hp');
    if(!descriptor||!descriptor.configurable||!('value'in descriptor)||!descriptor.writable)throw Error('S3 requires a writable plain structural HP field');
    return {partKey,part,descriptor,hp:descriptor.value,before:descriptor.value,applied:false,actualDamage:0};
  });
  for(const state of overrides){const {part,descriptor}=state;
    // The retained function reuses bodyDmg for immediate bleeding, pain, acute
    // response, stress and wound compatibility fields. Change only the first
    // HP write; later HP/function/structural checks see final S3 HP immediately.
    Object.defineProperty(part,'hp',{configurable:true,enumerable:descriptor.enumerable,get(){return state.hp;},set(value){
      if(!state.applied){state.hp=Math.max(0,state.before-hpDamage.damage);state.actualDamage=state.before-state.hp;state.applied=true;}
      else state.hp=!hpDamage.physicalChannelAvailable?Math.max(state.hp,value):value;
    }});
  }
  let result;
  try{result=action();}finally{for(const s of overrides)Object.defineProperty(s.part,'hp',{...s.descriptor,value:s.hp});}
  const applied=overrides.find(s=>s.applied);
  if(applied){
    Object.assign(hpDamage,{partKey:applied.partKey,partHpBefore:applied.before,partHpAfter:applied.hp,appliedDamage:applied.actualDamage,
      compatibilityPhysiologyBodyDmg:m._lastDamageEvent?.bodyDmg??null});
    if(m._lastDamageEvent)Object.assign(m._lastDamageEvent,{bodyHpDamage:hpDamage.damage,bodyHpRuleId:hpDamage.ruleId,
      bodyHpCalibration:structuredClone(hpDamage),partHpAfter:applied.hp});
    if(m.wounds.length>woundCount)m.wounds.at(-1).bodyHpDamage=structuredClone(hpDamage);
  }
  return result;
}
export function installMedicalS3Adapter(legacy){
  const originalApply=legacy.applyDamageEvent,originalOutcome=legacy.applyOutcome;
  legacy.applyDamageEvent=function applyDamageEventS3(unit,ev){
    const m=unit?.medical,armorResult=ev?.armorResult||'penetrated',
      hpDamage=m?.medicalModel==='v2'&&['bullet','frag'].includes(ev?.sourceType||'bullet')
        ?physicalBodyHpDamageS3(ev.ammoId,ev.trainingMetadata?.woundChannel,{armorResult,bodyRuleId:ev.trainingMetadata?.ruleId}):null;
    if(!hpDamage||unit.isDead)return originalApply.call(this,unit,ev);
    const partKey=eventPartKey(ev),parts=partKey?[partKey]:Object.keys(m.bodyParts),
      result=withHpWriteOverride(unit,parts,hpDamage,()=>originalApply.call(this,unit,ev));
    if(ev.trainingMetadata)ev.trainingMetadata.bodyHpDamage=hpDamage;
    return result;
  };
  // applyOutcome invokes its lexical original applyDamageEvent. Cover that
  // entry boundary as well; training calls it for armor stops and ricochets.
  legacy.applyOutcome=function applyOutcomeS3(unit,outcome,weapon,ctx){
    const ammoId=weapon?._ammo?.id||weapon?.ammoId,
      armorResult=outcome===legacy.OUTCOME.BLOCK||ctx?.penetrated===false||ctx?.impactAddress?.ricochetHint?.ricocheted?'stopped':'penetrated',
      hpDamage=unit?.medical?.medicalModel==='v2'?physicalBodyHpDamageS3(ammoId,ctx?.trainingMetadata?.woundChannel,{armorResult,bodyRuleId:ctx?.trainingMetadata?.ruleId}):null;
    if(!hpDamage||unit.isDead)return originalOutcome.call(this,unit,outcome,weapon,ctx);
    const partKey=eventPartKey({hitPart:ctx?.bodyPart,isLeft:ctx?.isLeft}),parts=partKey?[partKey]:Object.keys(unit.medical.bodyParts);
    return withHpWriteOverride(unit,parts,hpDamage,()=>originalOutcome.call(this,unit,outcome,weapon,ctx));
  };
  return legacy;
}
