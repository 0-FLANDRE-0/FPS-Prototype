// S1 is a 3D adapter. Original 2D declarations and legacy mode remain intact.
// These response gains are GAME TUNING, not measured clinical thresholds.
export const MEDICAL_S1_PHYSIOLOGY_VALUES=Object.freeze({
  heartCerebralReserveTauS:8,heartDirectPumpSensitivityGain:3,
  cavityBrainTargetLoss:1,
  aortaDiameterM:.025,bloodDensityKgM3:1060,orificeDischargeCoefficient:.62,
  referenceMapMmHg:93,mmHgToPa:133.322,
  restingCardiacOutputMlMin:5250,aortaFlowReserve:1.7,
  aortaOpeningAreaFractionAtFullSeverity:1,
  aortaInternalSeedFraction:.5,
  lung:{breathingDrain:.10,oxygenDrain:.06,pneumothoraxBoost:.15,hemothoraxBoost:.15,internalBleedBoost:.10},
  solid:{internalBleedBoost:.16,shockBoost:.08},
  vessel:{majorVesselGain:1.2,shockBoost:.14,preArrestBoost:.10,internalBleedBoost:.28,externalBleedBoost:.24},
  hollow:{internalBleedBoost:.04,shockBoost:.04},
  airway:{breathingDrain:.15,oxygenDrain:.08},
  cardiac:{rhythmRiskBoost:.40,perfusingRhythmPenalty:.12},
});
const K=MEDICAL_S1_PHYSIOLOGY_VALUES,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const aggregateCaps={breathingDrain:.25,oxygenDrain:.18,pneumothoraxBoost:.40,hemothoraxBoost:.40,internalBleedBoost:.50,externalBleedBoost:.40,majorVesselMul:2.6,shockBoost:.30,preArrestBoost:.30,rhythmRiskBoost:.60,perfusingRhythmPenalty:.30};
const organAlias=o=>o==='heart_hook_only'?'heart':o;
const vesselOrgan=o=>/aorta|thoracic/.test(o.identifier||'')?'thoracic_vessel':/femoral/.test(o.identifier||'')?'femoral_vessel':/carotid|jugular/.test(o.identifier||'')?'carotid_jugular':/iliac/.test(o.identifier||'')?'iliac_vessel':/axillary|brachial|subclavian/.test(o.identifier||'')?'axillary_vessel':'abdominal_vessel';
function effectFor(o){
  const s=clamp(o.severity||0),organ=organAlias(o.organ),scale=profile=>Object.fromEntries(Object.entries(profile).map(([k,v])=>[k,v*s]));
  if(o.kind==='vessel'){
    const internal=/aorta|thoracic|iliac|abdominal|mesenteric/.test(o.identifier||'');
    return {type:'major_vessel_injury',organ:vesselOrgan(o),effects:{majorVesselMul:1+K.vessel.majorVesselGain*s,shockBoost:K.vessel.shockBoost*s,preArrestBoost:K.vessel.preArrestBoost*s,[internal?'internalBleedBoost':'externalBleedBoost']:(internal?K.vessel.internalBleedBoost:K.vessel.externalBleedBoost)*s}};
  }
  if(organ==='lung')return {type:'lung_injury',organ,effects:scale(K.lung)};
  if(['liver','spleen','kidney'].includes(organ))return {type:'solid_organ_injury',organ,effects:scale(K.solid)};
  if(['bowel','stomach','bladder'].includes(organ))return {type:'hollow_viscus_injury',organ,effects:scale(K.hollow)};
  if(organ==='airway')return {type:'airway_injury',organ,effects:scale(K.airway)};
  if(organ==='heart')return {type:'cardiac_rhythm_risk',organ,effects:scale(K.cardiac)};
  if(['brain','brainstem'].includes(organ))return {type:o.direct?'brain_tissue_disruption':'brain_cavity_injury',organ,effects:{}};
  if(organ==='spinal_cord')return {type:'spinal_cavity_exposure',organ,effects:{},recordOnly:true};
  return {type:'soft_tissue_organ_injury',organ,effects:{},recordOnly:true};
}
export function applyWoundChannelEffectsS1(w,bt,{vesselContusionsOnly=false}={}){
  const channel=bt?.woundChannel;if(!channel)return false;
  const protectedCns=o=>['brain','brainstem','spinal_cord'].includes(o.organ);
  // S2 outside-enclosure exposure is a concussion-risk record, not an occult
  // brain/cord injury. Direct S0 intersections and penetrated enclosures retain
  // their existing physiology; the channel keeps all raw overlap diagnostics.
  const organs=(channel.organs||[]).filter(o=>o.kind!=='bone'&&o.effectiveVolumeM3>0&&!(channel.ruleId==='wound-channel-s2'&&protectedCns(o)&&!o.direct&&!o.enclosurePenetrated)),injuries=[];
  if(channel.ruleId==='wound-channel-s2'){w.concussionRisk=clamp(Number(channel.concussionRisk)||0);w.concussionPhysiologyApplied=false;}
  for(const o of organs){if(vesselContusionsOnly&&o.kind==='vessel'&&!o.direct)continue;const response=effectFor(o);injuries.push({id:o.id+'_s1',...response,severity:clamp(o.severity||0),source:'S1 effective organ damage volume / original shape volume',confirmed:!!o.direct,confirmedLevel:o.direct?'confirmed_physiologic':'modeled_cavity_damage',geometryId:o.id,direct:!!o.direct,effectiveVolumeM3:o.effectiveVolumeM3,organVolumeM3:o.volumeM3,
    evidence:o.direct?'actual occupied internal intersection':'temporary/fragment cavity overlap; no direct internal intersection'});}
  const profile=Object.fromEntries(Object.keys(aggregateCaps).map(k=>[k,k==='majorVesselMul'?1:0]));
  for(const injury of injuries)for(const[k,v]of Object.entries(injury.effects)){if(k==='majorVesselMul')profile[k]=Math.max(profile[k],v);else profile[k]+=v;}
  for(const k of Object.keys(profile))profile[k]=Math.min(aggregateCaps[k],profile[k]);
  w.s1OrganDamage=organs.map(o=>({...o}));
  w.physiologicInjuries=injuries;w.physiologicSeverity=injuries.length?injuries.reduce((s,i)=>s+i.severity,0)/injuries.length:0;
  w.physiologicTags=[...new Set(injuries.map(i=>'S1-'+i.type))];w.physiologicEffectProfile=profile;
  w.physiologicInjuryModel={physiologicInjuries:injuries,physiologicSeverity:w.physiologicSeverity,physiologicTags:w.physiologicTags,physiologicEffectProfile:profile,source:'S1 cavity volume adapter'};
  w.organInjuryModel={...(w.organInjuryModel||{}),injuries:organs.filter(o=>!vesselContusionsOnly||o.kind!=='vessel'||o.direct).map(o=>({organ:o.kind==='vessel'?vesselOrgan(o):o.organ,geometryId:o.id,severity:o.severity,injuryScore:100*o.severity,status:o.direct?'confirmed_limited':'modeled_cavity_damage',confirmed:!!o.direct,confirmedBy:o.direct?'actual_internal_intersection':'S1 modeled cavity overlap',monitorOnly:false,bleedRisk:o.severity>.7?'high':o.severity>.25?'moderate':'low',functionLoss:o.severity,priorityScore:100*o.severity,sourceRegion:w.partKey})),source:'S1 effective organ damage volume'};
  // A lung reached only by the cavity needs a real respiratory response too.
  // Its modeled overlap remains distinct from the unchanged direct-hit list.
  const lungs=organs.filter(o=>o.organ==='lung'),lungSeverity=Math.max(0,...lungs.map(o=>o.severity));
  if(lungs.length){const c=w.chestTraumaModel||{};w.chestTraumaModel={...c,lungInjuryCandidate:true,lungInjuryStatus:lungSeverity>.7?'likely':'suspected',pneumothoraxRisk:clamp(lungSeverity*.45),hemothoraxRisk:clamp(lungSeverity*.50),s1VolumeSeverity:lungSeverity,s1CavityOnly:!lungs.some(o=>o.direct)};}
  w.s1CavityInjuries=injuries.filter(i=>!i.direct);
  return true;
}
export function cavityNeuroTargetS1(m){
  const severity=Math.max(0,...(m.wounds||[]).flatMap(w=>w.s1CavityInjuries||[]).filter(i=>i.type==='brain_cavity_injury').map(i=>i.severity));
  return {severity,targetCap:100*(1-clamp(severity*K.cavityBrainTargetLoss)),source:'S1 modeled cavity damage; continuous target only, no direct CNS shortcut'};
}
export function aortaFlowS1(severity,diameterM=K.aortaDiameterM){
  const openingAreaM2=Math.PI*(diameterM/2)**2*K.aortaOpeningAreaFractionAtFullSeverity*clamp(severity),
    orificeMlS=K.orificeDischargeCoefficient*openingAreaM2*Math.sqrt(2*K.referenceMapMmHg*K.mmHgToPa/K.bloodDensityKgM3)*1e6,
    flowCapMlS=K.restingCardiacOutputMlMin/60*K.aortaFlowReserve;
  return {diameterM,openingAreaM2,orificeMlS,flowCapMlS,sourceFlowMlS:Math.min(orificeMlS,flowCapMlS),severity};
}
export function createMedicalS1Slots(r,original,{vesselContusionsOnly=false}={}){
  function buildBodyTrajectoryContext(unit,ev,penState){const bt=r.buildBodyTrajectoryContext(unit,ev,penState);if(ev.trainingMetadata?.woundChannel)bt.woundChannel=structuredClone(ev.trainingMetadata.woundChannel);return bt;}
  function buildConfirmedInjuryModel(w,bt,...args){const result=r.buildConfirmedInjuryModel(w,bt,...args);if(applyWoundChannelEffectsS1(w,bt,{vesselContusionsOnly})){result.reasonTags.push('S1_effective_organ_damage_volume');result.cavityDamage=(w.s1CavityInjuries||[]).map(i=>({geometryId:i.geometryId,type:i.type,severity:i.severity,evidence:i.evidence}));}return result;}
  function buildVascularEvidence(w){
    const result=r.buildVascularEvidence(w),cavity=(w.s1OrganDamage||[]).filter(o=>o.kind==='vessel'&&!o.direct&&o.severity>0);
    if(cavity.length&&!vesselContusionsOnly){const identifiers=cavity.map(o=>o.identifier),view={...w,confirmedInjuries:identifiers,probableInjuries:[],candidateInjuries:[],vesselCandidateHints:[],majorVesselCandidate:false,bleedingProfile:{...w.bleedingProfile,vesselRisk:0},physiologicInjuries:[]},modeled=original.buildVascularEvidence(view);
      const order={none:0,risk_only:1,candidate:2,probable:3,confirmed:4};if((order[modeled.level]||0)>(order[result.level]||0)||modeled.vesselClass==='major_named'&&result.vesselClass!=='major_named')Object.assign(result,modeled);
      result.cavityDamage=identifiers;result.cavityDamageSource='S1 positive modeled cavity volume, not direct geometry';result.vesselKinds=[...new Set([...(result.vesselKinds||[]),...cavity.map(o=>o.vesselKind).filter(Boolean)])];
    }return result;
  }
  function finalizeBleedingProfileWithEvidence(w){
    r.finalizeBleedingProfileWithEvidence(w);
    const aorta=(w.s1OrganDamage||[]).filter(o=>o.kind==='vessel'&&/aorta/.test(o.identifier||'')),bp=w.bleedingProfile;
    if(vesselContusionsOnly||!aorta.length||!bp)return;
    const largest=aorta.reduce((a,b)=>a.severity>b.severity?a:b),flow=aortaFlowS1(largest.severity,largest.diameterM),seed=flow.sourceFlowMlS*K.aortaInternalSeedFraction;
    bp.initialInternal=bp.sustainedInternal=bp.baseInternal=bp.currentInternal=bp.naturalReductionTargetInternal=seed;
    bp.bleedingType='cavity';bp.majorVesselLocked=true;bp.selfReductionRate=0;bp.clottingFactor=0;
    bp.s1AortaFlow={...flow,diameterSource:largest.diameterSource||'fallback game tuning, not measured human lumen',seedMlS:seed,classification:'tuning: orifice model, assumed opening fraction and compensatory flow cap; existing MAP pulse retained'};
    if(w.bleedPotential){w.bleedPotential.initialSpikeInternal=seed;w.bleedPotential.sustainedInternalRaw=seed;}
  }
  return {...r,buildBodyTrajectoryContext,buildConfirmedInjuryModel,buildVascularEvidence,finalizeBleedingProfileWithEvidence};
}
