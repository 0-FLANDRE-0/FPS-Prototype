// R adapters feed the original wound pipeline; no independent bleeding engine.
export const MEDICAL_R_VALUES=Object.freeze({muscleFloor:.001,fractureFloor:.20,branchArteryFloor:.35,branchVeinFloor:.15,naturalReductionMax:.08,venousFlow:.55,venousPressureWeight:.35,fatigueDeficitStart:.40,fatigueDeficitSpan:.60});
const K=MEDICAL_R_VALUES,clamp=x=>Math.max(0,Math.min(1,x));
const geometry=bt=>bt?.internalGeometry||{internalHits:[],nearMisses:[],source:'no occupied body segment'};
const vessels=bt=>geometry(bt).internalHits.filter(h=>h.kind==='vessel');
export function createMedicalRSlots(original){
 function buildBodyTrajectoryContext(unit,ev,penState){
  const bt=original.buildBodyTrajectoryContext(unit,ev,penState);
  bt.internalGeometry=structuredClone(ev.trainingMetadata?.internalGeometry||geometry());
  const hits=geometry(bt).internalHits;
  bt.candidateMap=[...new Map(hits.filter(h=>h.candidate).map(h=>[h.candidate,{id:h.candidate,type:h.kind==='vessel'?'vessel':'organ',confidence:'high',severityHint:'high',reason:'actual sphere-swept internal intersection'}])).values()];
  bt.organCandidateHints=hits.filter(h=>h.kind==='organ').map(h=>h.identifier);
  bt.vesselCandidateHints=vessels(bt).map(h=>h.identifier);bt.majorVesselCandidate=vessels(bt).some(h=>/femoral|brachial|axillary|subclavian|iliac|carotid|aorta/.test(h.identifier));
  bt.internalInputMapping=hits.map(h=>({id:h.id,identifier:h.identifier,kind:h.kind,vesselKind:h.vesselKind,candidate:h.candidate,entryDepthM:h.entryDepthM,traversedLengthM:h.traversedLengthM,input:h.kind==='bone'?'fracture roll eligibility':h.kind==='vessel'?'confirmedInjuries → original vascularEvidence':h.candidate?'candidateMap → original organ/physiology rules':'geometry only; original physiology has no matching type'}));
  return bt;
 }
 function buildOrganInjuryModel(bt,ibm,hitPart){
  const result=original.buildOrganInjuryModel(bt,ibm,hitPart);
  // Geometry supplies certainty; original energy/depth/severity/effects remain.
  for(const injury of result.injuries)if(!injury.monitorOnly){injury.status='confirmed_limited';injury.confirmed=true;injury.confirmedBy='actual_internal_intersection';}
  result.confirmedCount=result.injuries.filter(i=>i.confirmed).length;result.suspectedCount=0;return result;
 }
 function buildChestTraumaModel(bt,ibm,hitPart,woundSize){
  const result=original.buildChestTraumaModel(bt,ibm,hitPart,woundSize);if(!result)return result;
  if(!geometry(bt).internalHits.some(h=>h.organ==='lung')){result.lungInjuryCandidate=false;result.lungInjuryStatus='none';result.pneumothoraxRisk=0;result.hemothoraxRisk=0;}
  return result;
 }
 function buildConfirmedInjuryModel(w,bt,cm,med){
  const result=original.buildConfirmedInjuryModel(w,bt,cm,med);
  result.confirmed=[...new Set(geometry(bt).internalHits.filter(h=>h.kind!=='bone').map(h=>h.identifier))];result.probable=[];result.candidates=[];result.confidence=result.confirmed.length?1:0;result.reasonTags=['actual_internal_intersection'];return result;
 }
 function buildVascularEvidence(w){
  // Stop original risk-percent fallback; classes still use original regexes.
  const view={...w,bleedingProfile:{...w.bleedingProfile,vesselRisk:0},confirmedInjuries:vessels(w.bodyTrajectory).map(h=>h.identifier),probableInjuries:[],candidateInjuries:[],vesselCandidateHints:[],majorVesselCandidate:false};
  if(!view.confirmedInjuries.length)view.physiologicInjuries=[];
  const result=original.buildVascularEvidence(view);result.vesselKinds=[...new Set(vessels(w.bodyTrajectory).map(h=>h.vesselKind))];return result;
 }
 function buildFractureEvidence(unit,ev,woundSize,bt,med){
  const bone=geometry(bt).internalHits.find(h=>h.kind==='bone');
  // Clearing non-geometric zones makes original riskMul=0 and consumes no RNG.
  const actual={...ev,partKey:bone?ev.partKey:'none',anatomicalZone:bone?.identifier||'',impactAddress:{...ev.impactAddress,fullAddress:''}};
  const result=original.buildFractureEvidence(unit,actual,woundSize,{...bt,hitZone:''},{...med,medicalZone:''});
  result.geometryBoneId=bone?.id||null;return result;
 }
 function reinforceVascularEvidenceWithPartDestruction(unit,w){return w.vascularEvidence;}
 function finalizeBleedingProfileWithEvidence(w){
  original.finalizeBleedingProfileWithEvidence(w);const bp=w.bleedingProfile;if(!bp||bp.bleedingType==='none')return;
  const ve=w.vascularEvidence,kinds=ve?.vesselKinds||[],vein=kinds.length>0&&!kinds.includes('artery');
  let floor=null;
  if(!bp.majorVesselLocked&&ve.vesselClass==='named_branch')floor=vein?K.branchVeinFloor:K.branchArteryFloor;
  else if(!bp.majorVesselLocked&&['none','capillary_muscle','small_branch'].includes(ve.vesselClass)&&!geometry(w.bodyTrajectory).internalHits.some(h=>h.kind==='organ'))floor=w.fractureEvidence?.occurred?K.fractureFloor:K.muscleFloor;
  if(floor!==null){bp.naturalReductionTargetExternal=bp.sustainedExternal*floor;bp.naturalReductionTargetInternal=bp.sustainedInternal*floor;bp.selfReductionRate=Math.min(bp.selfReductionRate||K.naturalReductionMax,K.naturalReductionMax);}
  bp.rNaturalReduction={floor,source:'R game tuning; original initial/sustained unchanged'};
 }
 function buildBleedingPulseModel(unit,w,bp,extMul){
  const raw=original.getOriginalBleedingPulseTerms(unit,w,bp,extMul);const pulse=w.bleedingPulseModel,MAP=unit.medical.hemodynamics?.map??93,kinds=w.vascularEvidence?.vesselKinds||[];
  const artery=kinds.includes('artery'),vein=kinds.length>0&&!artery;
  const ratio=Math.max(0,MAP/93),pressure=artery?ratio:1-K.venousPressureWeight+K.venousPressureWeight*ratio;
  const flow=vein?K.venousFlow:1;
  pulse.originalPressureModifier=pulse.pressureModifier;pulse.pressureModifier=pressure;pulse.vesselKind=artery?'artery':vein?'vein':'capillary_muscle';pulse.vesselFlowModifier=flow;pulse.pressureRule='MAP/93 artery; .65+.35*MAP/93 vein/muscle';
  // Recompute rather than dividing a clamped original pulse: pressure appears once.
  return {extPulse:pressure*raw.pulseModifier*raw.vascularToneModifier*flow,intPulse:pressure*(bp.bleedingType==='cavity'?1:1+raw.pulsePressureInfluence*.5)*flow};
 }
 return {buildBodyTrajectoryContext,buildOrganInjuryModel,buildChestTraumaModel,buildConfirmedInjuryModel,buildVascularEvidence,buildFractureEvidence,reinforceVascularEvidenceWithPartDestruction,finalizeBleedingProfileWithEvidence,buildBleedingPulseModel};
}
