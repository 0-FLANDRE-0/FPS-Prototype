import{stepPartRecovery}from'./medical-part-recovery.js';
import{careTime}from'./medical-care-state.js';
import {exerciseHemodynamics,exerciseVitals,exerciseAfterPump} from './medical-d2.js';
import {arrestAttributionB1b} from './medical-b1b.js';
import {ensureBleedingB1,updateBleedingB1,applyHemothoraxB1} from './medical-b1.js';
import {criticalAnatomyS0,applyCardiacPumpS0,localizedHeadLifeS0,MEDICAL_S0_VALUES} from './medical-s0.js';
import {createMedicalR2Slots,applySpinalFunctionR2,MEDICAL_R2_VALUES} from './medical-r2.js';
import {createMedicalS1Slots,cavityNeuroTargetS1} from './medical-s1-effects.js';
import {createMedicalS2Slots,refreshStructuralStateS2,structuralArrestReasonS2} from './medical-s2-effects.js';
import {initializeMedicalHpS3} from './medical-s3-effects.js';
import {abdomenPainFloorS3b} from './medical-s3b-effects.js';
// Independent 3D physiology slots. Retained 2D declarations are source/legacy
// fallbacks; explicit Q/R/R2/S0 changes are recorded in the medical ledgers.
export const MEDICAL_V2_RULE_ID = 'medical-v2-b1c';
export const MEDICAL_V2_VALUES = Object.freeze({
  ARREST_TO_DEATH_S: 300, PERI_ARREST_HOLD_S: 15,
  OXYGEN_ARREST_THRESHOLD: .25, OXYGEN_ARREST_HOLD_S: 20,
  ARREST_CONSCIOUSNESS_ZERO_S: 10, ARREST_BLEED_MUL: .05,
  MAP_AUTOREG_LOWER: 60, MAP_ZERO: 20, MAP_REFERENCE: 93, MAP_ABOVE_LOWER_PENALTY: .08, CONSCIOUSNESS_TARGET_SLEW_PER_S: 60,
  OXYGEN_ZERO: .15, OXYGEN_FULL: .95, BREATHING_PENALTY: 15, DECOMPENSATION_PENALTY: 10,
  SHOCK_VOLUME_WEIGHT: 45, SHOCK_PERFUSION_WEIGHT: 35, SHOCK_EXHAUSTION_WEIGHT: 20,
  SHOCK_COMPENSATED_WEIGHT: 15, SHOCK_DECOMPENSATED_WEIGHT: 25, SHOCK_FOLLOW: .6,
  PAIN_OTHER_PART_WEIGHT: .15, ISCHEMIC_FUNCTION_MIN: .05,
});
export const DOWN_REASON_PRIORITY = Object.freeze(['brain_injury','weight_bearing_fracture','spinal_cord_injury','leg_function_loss','low_consciousness','hypotension','shock','critical_status','incapacitated','blood_loss']);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const K=MEDICAL_V2_VALUES;
export function ensureMedicalV2(unit){
  const m=unit.medical;if(!m)return;
  m.medicalModel='v2';ensureBleedingB1(m);
  initializeMedicalHpS3(unit);
  m.cardiacArrest??=false;m.arrestReason??=null;m.arrestDetails??=null;
  m.arrestElapsedS??=0;m.periArrestElapsedS??=0;m.lowOxygenElapsedS??=0;
  m.acutePain??=m.pain;m.painFloor??=0;m._v2PainWritten??=m.pain;
  m.downReasonDetails??=null;m.traumaticCriticalParts??=[];
  for(const p of Object.values(m.bodyParts))p.ischemicLoad??=0;
}
function painComponents(unit,dt){
  const m=unit.medical;
  // Original damage code still raises m.pain; capture its positive increment.
  m.acutePain=clamp(m.acutePain+Math.max(0,m.pain-m._v2PainWritten)-1.5*dt,0,100);
  const pains=Object.values(m.bodyParts).filter(p=>p.hp>0).map(p=>p.pain||0);
  // S3b: depleted abdomen remains a persistent Q5-a component. Keep the
  // original max + other-part weighting and the existing 0.85 masking cap.
  m.abdomenPainFloor=abdomenPainFloorS3b(m);
  if(m.abdomenPainFloor)pains.push(m.abdomenPainFloor);
  const largest=Math.max(0,...pains),sum=pains.reduce((a,b)=>a+b,0);
  m.painFloor=clamp(largest+K.PAIN_OTHER_PART_WEIGHT*(sum-largest),0,100);
  m.pain=Math.max(m.acutePain,m.painFloor);m._v2PainWritten=m.pain;
  m.stressResponse.perceivedPain=m.isUnconscious||m.cardiacArrest?0:m.pain*(1-m.stressResponse.painMasking);
}
export function consciousnessTargetV2(m){
  const hd=m.hemodynamics,map=m.heartInjury?(hd.cerebralReserveMap??hd.map):hd.map,o2=m.heartInjury?(hd.cerebralReserveOxygen??hd.oxygenDelivery):hd.oxygenDelivery;
  const mapFactor=map>=K.MAP_AUTOREG_LOWER
    ?1-K.MAP_ABOVE_LOWER_PENALTY*clamp((K.MAP_REFERENCE-map)/(K.MAP_REFERENCE-K.MAP_AUTOREG_LOWER))
    :(1-K.MAP_ABOVE_LOWER_PENALTY)*smooth((map-K.MAP_ZERO)/(K.MAP_AUTOREG_LOWER-K.MAP_ZERO));
  const oxygenFactor=smooth((o2-K.OXYGEN_ZERO)/(K.OXYGEN_FULL-K.OXYGEN_ZERO));
  const respiratoryPenalty=K.BREATHING_PENALTY*smooth((100-m.breathingEfficiency)/100);
  // Continuous proxies of the original boolean decompensation conditions.
  const decompensation=decompensatedDrive(m);
  const cavityNeuro=cavityNeuroTargetS1(m);
  return {mapFactor,oxygenFactor,respiratoryPenalty,decompensation,cavityNeuro,
    target:m.brainInjury?0:Math.min(cavityNeuro.targetCap,clamp(100*Math.min(mapFactor,oxygenFactor)-respiratoryPenalty-K.DECOMPENSATION_PENALTY*decompensation,0,100))};
}
function decompensatedDrive(m){const h=m.hemodynamics;return Math.max(
  smooth((.7-h.volumeRatio)/.2)*smooth((95-m.systolicBP)/25)*smooth(h.compensationLoad/.5),
  smooth(h.compensationExhaustion/.7)*smooth((100-m.systolicBP)/30));}
export function shockTargetV2(m){const h=m.hemodynamics;const terms={
  volume:K.SHOCK_VOLUME_WEIGHT*smooth((1-h.volumeRatio)/.6),
  perfusion:K.SHOCK_PERFUSION_WEIGHT*smooth((1-h.tissuePerfusion)/.7),
  exhaustion:K.SHOCK_EXHAUSTION_WEIGHT*h.compensationExhaustion,
  compensated:K.SHOCK_COMPENSATED_WEIGHT*smooth((.85-h.volumeRatio)/.15)*smooth((m.systolicBP-70)/20)*smooth(h.compensationLoad/.4),
  decompensated:K.SHOCK_DECOMPENSATED_WEIGHT*decompensatedDrive(m),
};return{terms,target:clamp(Object.values(terms).reduce((a,b)=>a+b,0),0,100)};}
function noCirculation(m){
  m.heartRate=m.systolicBP=m.diastolicBP=0;m._heartRateState='cardiac_arrest';
  m.hemodynamics.map=m.hemodynamics.tissuePerfusion=m.hemodynamics.oxygenDelivery=0;
  m.hemodynamics.cardiacOutputMul=m.hemodynamics.strokeVolumeMul=m.hemodynamics.pulsePressure=0;
  m.isUnconscious=true;m.isDowned=true;
  m.canShoot=m.canWalk=m.canCrawl=m.canMove=false;
  m.stressResponse.perceivedPain=0;
}
function enterArrest(m,reason){
  const h=m.hemodynamics;
  const attribution=arrestAttributionB1b(m,reason);reason=attribution.primary;
  m.cardiacArrest=true;m.arrestReason=reason;m.arrestElapsedS=0;
  m.arrestDetails={primary:reason,attribution,contributingFactors:{bloodLossPercent:(1-m.bloodMl/m.bloodMax)*100,
    pumpFunction:m.heartInjury?.pumpFunction??1,pumpLoss:attribution.pumpLoss,
    bloodMl:m.bloodMl,systolicBP:m.systolicBP,map:h.map,oxygenDelivery:h.oxygenDelivery,
    breathingEfficiency:m.breathingEfficiency,periArrestElapsedS:m.periArrestElapsedS,
    lowOxygenElapsedS:m.lowOxygenElapsedS,heartRateState:m._heartRateState,
    rhythmCandidate:m.cardiacRhythmModel?.rhythm||null}};
  m._arrestConsciousness=Math.min(19,m.consciousness);m.consciousness=m._arrestConsciousness;
  noCirculation(m);
}
export function createMedicalV2Slots(original){
  const downstream=createMedicalS2Slots(createMedicalS1Slots(createMedicalR2Slots(original),original,{vesselContusionsOnly:true}),original);
  const bleedOptions={pulseModel:typeof original.getOriginalBleedingPulseTerms==='function'?downstream.buildBleedingPulseModel:null};
  function critical(unit){
    const result=criticalAnatomyS0(unit);refreshStructuralStateS2(unit);
    if(result.brain?.kind==='brainstem'){const m=unit.medical;m.breathingEfficiency=0;if(!m.cardiacArrest)enterArrest(m,'brainstem_injury');m._arrestConsciousness=m.consciousness=0;}
    const structuralReason=structuralArrestReasonS2(unit.medical);
    if(structuralReason&&!unit.medical.cardiacArrest)enterArrest(unit.medical,structuralReason);
    return result;
  }
  function updateSystemicHypoxiaDamage(unit,dt){
    ensureMedicalV2(unit);const m=unit.medical;
    const rate=m.bloodMl>=3350?0:m.bloodMl<1800?8:m.bloodMl<2500?4.5:m.bloodMl<3000?2:.6;
    const multipliers={head:.85,neck:.90,chest:1.25,abdomen:1.45,leftArm:.45,rightArm:.45,leftLeg:.55,rightLeg:.55};
    for(const[k,p]of Object.entries(m.bodyParts)){
      if(p.hp>0)p.ischemicLoad+=rate*(multipliers[k]||1)*dt;
      original.recomputeBodyPartFunctionRatio(p);
      if(p.s2Comminuted||p.s2Amputated){p.functionRatio=0;p.disabled=true;}
      p.functionRatio*=clamp(1-p.ischemicLoad/Math.max(1,p.maxHp),K.ISCHEMIC_FUNCTION_MIN,1);
    }
    applySpinalFunctionR2(unit);critical(unit);
  }
  function updateMedicalBleeding(unit,dt){
    ensureMedicalV2(unit);updateBleedingB1(unit,dt,bleedOptions);stepPartRecovery(unit,dt,careTime(unit.medical));
  }
  function updateHemodynamics(unit,dt){
    applyHemothoraxB1(unit.medical);
    if(unit.medical.cardiacArrest){unit.medical.hemodynamics.volumeRatio=clamp(unit.medical.bloodMl/unit.medical.bloodMax,0,1.05);noCirculation(unit.medical);}
    else {
      const before=unit.medical.hemodynamics.oxygenDelivery,cord=applySpinalFunctionR2(unit);
      exerciseHemodynamics(unit.medical,dt,()=>original.updateHemodynamicsR2(unit,dt));
      critical(unit);const reserveOxygen=unit.medical.hemodynamics.cerebralReserveOxygen;applyCardiacPumpS0(unit,dt);exerciseAfterPump(unit.medical,reserveOxygen,dt);
      if(cord?.region==='A'){const h=unit.medical.hemodynamics;h.apneaOxygenTarget=h.oxygenDelivery;h.oxygenDelivery=h.apneaOxygenTarget+(before-h.apneaOxygenTarget)*Math.exp(-dt/MEDICAL_R2_VALUES.apneaOxygenFollowS);h.oxygenDebt=h.oxygenDelivery<.6;h.preArrestRisk=h.hypovolemiaSeverity==='critical'||h.oxygenDelivery<.4||(h.decompensatingShock&&h.compensationExhaustion>.7);}
    }
  }
  function updateVitalsFromHemodynamics(unit,dt){
    const m=unit.medical;
    if(m.cardiacArrest){m.arrestElapsedS+=dt;noCirculation(m);return;}
    // Original stress refresh runs before vitals. Hide perceived pain before
    // HR reads it as well, not only at the end of the physiology tick.
    if(m.isUnconscious)m.stressResponse.perceivedPain=0;
    exerciseVitals(m,()=>original.updateVitalsFromHemodynamics(unit,dt));
    applySpinalFunctionR2(unit);
    // R: volume-only risk + compensatory tachycardia is not failed circulation.
    const failedCirculation=m.hemodynamics.oxygenDelivery<.4||m.systolicBP<60;
    m.periArrestElapsedS=m._heartRateState==='peri_arrest'&&failedCirculation?m.periArrestElapsedS+dt:0;
    m.lowOxygenElapsedS=m.hemodynamics.oxygenDelivery<K.OXYGEN_ARREST_THRESHOLD?m.lowOxygenElapsedS+dt:0;
    let reason=null;
    if(m.heartInjury?.pumpFunction<=MEDICAL_S0_VALUES.failedPumpThreshold&&m.isUnconscious&&m.hemodynamics.oxygenDelivery<K.OXYGEN_ARREST_THRESHOLD)reason='cardiac_pump_failure';
    else if(m.bloodMl<1200)reason='exsanguination';
    else if(m.systolicBP<MEDICAL_R2_VALUES.collapsedSystolicBP&&m.hemodynamics.volumeRatio<MEDICAL_R2_VALUES.collapsedVolumeRatio)reason='hemorrhagic_shock';
    else if(m.periArrestElapsedS>=K.PERI_ARREST_HOLD_S||m.lowOxygenElapsedS>=K.OXYGEN_ARREST_HOLD_S){
      reason=m.spinalCordInjury?.region==='A'?'respiratory_failure':m.breathingEfficiency<35&&m.wounds.some(w=>w.chestTraumaModel&&(w.chestTraumaModel.openChestWound||w.chestTraumaModel.lungInjuryCandidate||w.chestTraumaModel.pneumothoraxRisk>0))?'respiratory_failure':
        m.hemodynamics.volumeRatio<.7?'hemorrhagic_shock':'hypoxia';
    }
    if(reason)enterArrest(m,reason);
  }
  function updatePainShockConsciousness(unit,dt){
    const m=unit.medical;ensureMedicalV2(unit);painComponents(unit,dt);
    const shock=shockTargetV2(m);m.shockTarget=shock.target;m.shockComponents=shock.terms;
    if(shock.target>m.shock)m.shock=Math.min(shock.target,m.shock+Math.min(2,(shock.target-m.shock)*K.SHOCK_FOLLOW)*dt);
    else if(m.bloodMl>3500&&m.externalBleedRate+m.internalBleedRate<5)m.shock=Math.max(shock.target,m.shock-.8*dt);
    const boost=Math.min(.30,original.aggregatePhysiologicEffectProfile(m).shockBoost)*3;
    m.shock=clamp(m.shock+boost*dt,0,100);m.shockBoostRate=boost;
    const curve=consciousnessTargetV2(m);m.consciousnessComponents=curve;
    if(m.cardiacArrest){
      // Keep the recorded target continuous while arrest forces incapacity.
      m.consciousnessTarget=Math.max(0,(m.consciousnessTarget??m.consciousness)-100*dt/K.ARREST_CONSCIOUSNESS_ZERO_S);
      m.consciousness=Math.max(0,m._arrestConsciousness*(1-m.arrestElapsedS/K.ARREST_CONSCIOUSNESS_ZERO_S));
      noCirculation(m);
    }else{
      const previous=m.consciousnessTarget??curve.target;
      m.consciousnessTarget=clamp(curve.target,previous-K.CONSCIOUSNESS_TARGET_SLEW_PER_S*dt,previous+K.CONSCIOUSNESS_TARGET_SLEW_PER_S*dt);
      m.consciousness+=(m.consciousnessTarget-m.consciousness)*Math.min(1,dt*(curve.target<m.consciousness?1.2:.3));
      m.isUnconscious=m.consciousness<20;
      if(m.isUnconscious)m.stressResponse.perceivedPain=0;
    }
    critical(unit);
  }
  function recalcMedicalSummary(unit){
    ensureMedicalV2(unit);const m=unit.medical,reason=m.isDead?m.deathReason:null;
    applySpinalFunctionR2(unit);
    critical(unit);
    const impact=m._s0ImpactContext;
    if(impact&&!impact.handled&&!m.brainInjury&&m.bodyParts.head.hp<=0){m.consciousness=Math.max(20,impact.consciousness-40);impact.handled=true;}
    painComponents(unit,0);original.recalcMedicalSummary(unit);
    if(m.bodyParts.head.hp<=0)m.lifeStatus=localizedHeadLifeS0(m); // S2: structural HP is never an automatic head fatality
    critical(unit);
    m.traumaticCriticalParts=['head','neck'].filter(k=>m.bodyParts[k].hp<=0);
    m.deathReason=reason;m.isAlive=!m.isDead;
    if(m.cardiacArrest)noCirculation(m);
  }
  function syncLegacyCombatState(unit){
    ensureMedicalV2(unit);const m=unit.medical;
    critical(unit);
    const dead=!!(m.isDead||(m.cardiacArrest&&m.arrestElapsedS+1e-9>=K.ARREST_TO_DEATH_S));
    const cardiacReserve=!!m.heartInjury&&!m.brainInjury&&!m.cardiacArrest&&m.consciousness>=30;
    const conditions={brain_injury:!!m.brainInjury,weight_bearing_fracture:!!m.weightBearingFracture,spinal_cord_injury:!!m.spinalCordInjury&&m.bodyParts.leftLeg.functionRatio===0&&m.bodyParts.rightLeg.functionRatio===0,leg_function_loss:['leftLeg','rightLeg'].some(k=>m.bodyParts[k].structuralFunctionDisabled),low_consciousness:m.consciousness<30,hypotension:!cardiacReserve&&m.systolicBP<70,shock:m.shock>85,
      critical_status:!cardiacReserve&&m.lifeStatus<25,incapacitated:!m.canMove&&!m.canShoot,blood_loss:m.bloodMl<2000};
    const reasons=DOWN_REASON_PRIORITY.filter(k=>conditions[k]);
    const downed=dead||m.cardiacArrest||reasons.length>0;
    const anatomicReason=conditions.brain_injury?'brain_injury':conditions.weight_bearing_fracture?'weight_bearing_fracture':conditions.spinal_cord_injury?'spinal_cord_injury':null;
    if(downed&&(!unit.isDowned||(anatomicReason&&m.downReason!==anatomicReason))){m.downReason=reasons[0]||(m.cardiacArrest?'low_consciousness':'incapacitated');
      m.downReasonDetails={primary:m.downReason,conditions,reasons:reasons.length?reasons:[m.downReason],
        values:{consciousness:m.consciousness,systolicBP:m.systolicBP,shock:m.shock,lifeStatus:m.lifeStatus,bloodMl:m.bloodMl,canMove:m.canMove,canShoot:m.canShoot}};
      if(unit.downedTime===0)unit.downedTime=.01;
    }
    if(dead&&!unit.isDead)m.deathReason=m.bodyParts.neck.hp<=0?'neck_destroyed':m.arrestReason;
    if(!dead)m.deathReason=null;
    refreshStructuralStateS2(unit);
    updateBleedingB1(unit,0,bleedOptions); // current MAP/CO display; never integrate blood twice
    unit.isDead=m.isDead=dead;unit.alive=m.isAlive=!dead;
    unit.isDowned=m.isDowned=downed;
    m.isUnconscious=dead||m.cardiacArrest||m.consciousness<20;unit.conscious=!m.isUnconscious;
    if(m.isUnconscious)m.stressResponse.perceivedPain=0;
    unit.canBeDragged=downed&&!dead;
    if(downed){unit.stance='prone';if(dead)unit.forcedProneTimer=9999;}
    unit.combatState=dead?'dead':m.cardiacArrest?'cardiac_arrest':downed?'downed':
      m.lifeStatus<70||m.bodyHpTotal<m.bodyHpMax*.85?'wounded':'active';
    if(dead||m.cardiacArrest){m.canMove=m.canWalk=m.canCrawl=m.canShoot=false;}
    m.isCombatEffective=!dead&&!m.cardiacArrest&&m.combatEffectiveness>30&&m.canShoot;
    unit.hp=Math.round(m.lifeStatus);unit.maxHp=100;unit.pain=m.pain;
    if(unit.bodyHp){for(const[a,b]of Object.entries({head:'head',neck:'neck',chest:'chest',abdomen:'abdomen',left_arm:'leftArm',right_arm:'rightArm',left_leg:'leftLeg',right_leg:'rightLeg'}))unit.bodyHp[a]=m.bodyParts[b].hp;
      unit.bodyHp.arms=(m.bodyParts.leftArm.hp+m.bodyParts.rightArm.hp)/2;unit.bodyHp.legs=(m.bodyParts.leftLeg.hp+m.bodyParts.rightLeg.hp)/2;}
    const arm=m.bodyParts.leftArm.fracture||m.bodyParts.rightArm.fracture,leg=m.bodyParts.leftLeg.fracture||m.bodyParts.rightLeg.fracture;
    unit.fracture=arm&&leg?'multiple':arm?'arm':leg?'leg':m.bodyParts.chest.fracture?'chest':'none';
    const total=m.externalBleedRate+m.internalBleedRate;unit.bleeding=total<.5?'none':total<8?'light':total<30?'heavy':'critical';
  }
  function updateMedicalPerformanceMultipliers(unit,dt){
    applySpinalFunctionR2(unit);critical(unit);original.updateMedicalPerformanceMultipliers(unit,dt);critical(unit);
    const m=unit.medical;if(m.heartInjury&&!m.brainInjury&&!m.weightBearingFracture&&!m.spinalCordInjury&&!m.cardiacArrest&&!m.isDead&&m.consciousness>=30){
      const legFn=(m.bodyParts.leftLeg.functionRatio+m.bodyParts.rightLeg.functionRatio)/2;
      m.canWalk=legFn>.30;m.canMove=m.canWalk||m.canCrawl;
    }
    refreshStructuralStateS2(unit);
  }
  return {...downstream,updateMedicalPerformanceMultipliers,updateSystemicHypoxiaDamage,updateMedicalBleeding,updateHemodynamics,updateVitalsFromHemodynamics,
    updatePainShockConsciousness,recalcMedicalSummary,syncLegacyCombatState};
}
