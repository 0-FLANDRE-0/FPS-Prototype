import {createMedicalRSlots,MEDICAL_R_VALUES} from './medical-r.js';
// R2 game simplifications. Percent anchors follow Pulse's dog hemorrhage
// validation trend; neither this curve nor these delays are human thresholds.
export const MEDICAL_R2_VALUES=Object.freeze({
  preloadKnots:[[0,1],[.20,.90],[.35,.35],[.45,.35],[.46,.05],[1,.05]],
  collapseStart:.45,collapseEnd:.46,collapsedSystolicBP:35,collapsedVolumeRatio:.60,
  minorFractureReductionMax:.04,apneaOxygenFollowS:45,lowerCervicalArmCap:.35,
});
export function preloadTargetR2(volumeRatio){
  const x=Math.max(0,1-volumeRatio),knots=MEDICAL_R2_VALUES.preloadKnots;
  for(let i=1;i<knots.length;i++)if(x<=knots[i][0]){const[a,p]=knots[i-1],[b,q]=knots[i];return p+(q-p)*(x-a)/(b-a);}
  return knots.at(-1)[1];
}
export function circulatingReserveR2(volumeRatio){const k=MEDICAL_R2_VALUES;return Math.max(0,Math.min(1,(k.collapseEnd-(1-volumeRatio))/(k.collapseEnd-k.collapseStart)));}
const hits=w=>w?.bodyTrajectory?.internalGeometry?.internalHits||[];
export function applySpinalFunctionR2(unit){
  const m=unit.medical;if(!m)return null;
  const cords=(m.wounds||[]).flatMap(hits).filter(h=>h.organ==='spinal_cord');
  if(!cords.length)return null;
  const upper=cords.some(h=>h.cordRegion==='A'),lowerCervical=cords.some(h=>h.cordRegion==='B'&&h.domain==='neck');
  m.spinalCordInjury={region:upper?'A':'B',lowerCervical,structures:[...new Set(cords.map(h=>h.id))],source:'actual occupied internal intersection; two-region game simplification'};
  for(const k of ['leftLeg','rightLeg'])m.bodyParts[k].functionRatio=0;
  if(upper){for(const k of ['leftArm','rightArm'])m.bodyParts[k].functionRatio=0;m.breathingEfficiency=0;}
  else if(lowerCervical)for(const k of ['leftArm','rightArm'])m.bodyParts[k].functionRatio=Math.min(m.bodyParts[k].functionRatio,MEDICAL_R2_VALUES.lowerCervicalArmCap);
  return m.spinalCordInjury;
}
export function createMedicalR2Slots(original){
  const r=createMedicalRSlots(original);
  function buildBodyTrajectoryContext(unit,ev,penState){
    const bt=r.buildBodyTrajectoryContext(unit,ev,penState),actual=bt.internalGeometry.internalHits;
    bt.normalizedMedicalAddress={...bt.normalizedMedicalAddress,airwayRisk:actual.some(h=>h.organ==='airway')};
    for(const candidate of bt.candidateMap)if(candidate.id==='airway_candidate')candidate.type='airway';
    bt.organCandidateHints=actual.filter(h=>h.kind==='organ'&&h.organ!=='esophagus').map(h=>h.identifier);
    for(const row of bt.internalInputMapping){const h=actual.find(h=>h.id===row.id);if(h?.organ==='esophagus')row.input='record only; no injury/physiology input';if(h?.organ==='spinal_cord')row.input='actual cord region → limb function; A breathing zero + delayed oxygen';if(h?.organ==='airway')row.input='original airwayRisk + airway_candidate; no new respiratory constants';}
    return bt;
  }
  function buildConfirmedInjuryModel(...args){const result=r.buildConfirmedInjuryModel(...args);result.confirmed=result.confirmed.filter(id=>id!=='esophagus_record_only');result.confidence=result.confirmed.length?1:0;return result;}
  function finalizeBleedingProfileWithEvidence(w){
    original.finalizeBleedingProfileWithEvidence(w);const bp=w.bleedingProfile;if(!bp||bp.bleedingType==='none')return;
    const actual=hits(w),ve=w.vascularEvidence||{},vein=(ve.vesselKinds||[]).length>0&&!ve.vesselKinds.includes('artery');
    // Airway/cord/esophagus geometry is not a persistent hemorrhage source.
    const bleedingOrgan=actual.some(h=>['liver','spleen','kidney','lung','heart_hook_only','bowel'].includes(h.organ));
    let floor=null,rule='original organ/major source';
    if(!bp.majorVesselLocked&&ve.vesselClass==='named_branch'){floor=vein?MEDICAL_R_VALUES.branchVeinFloor:MEDICAL_R_VALUES.branchArteryFloor;rule='R actual named branch';}
    else if(!bp.majorVesselLocked&&!bleedingOrgan&&!actual.some(h=>h.kind==='vessel')){
      const fractured=w.fractureEvidence?.occurred,bone=actual.find(h=>h.id===w.fractureEvidence?.geometryBoneId);
      const largeFracture=fractured&&['pelvis','femur'].includes(bone?.identifier);
      floor=largeFracture?MEDICAL_R_VALUES.fractureFloor:fractured?0:MEDICAL_R_VALUES.muscleFloor;
      rule=largeFracture?'pelvis/femur fracture retained floor':fractured?'other fracture → zero, slower reduction':'wall/muscle only, external/internal same rule';
      if(fractured&&!largeFracture)bp.selfReductionRate=Math.min(bp.selfReductionRate||MEDICAL_R2_VALUES.minorFractureReductionMax,MEDICAL_R2_VALUES.minorFractureReductionMax);
    }
    if(floor!==null){bp.naturalReductionTargetExternal=bp.sustainedExternal*floor;bp.naturalReductionTargetInternal=bp.sustainedInternal*floor;bp.selfReductionRate=Math.min(bp.selfReductionRate||MEDICAL_R_VALUES.naturalReductionMax,MEDICAL_R_VALUES.naturalReductionMax);}
    bp.rNaturalReduction={floor,source:'R/R2 game tuning; original initial/sustained unchanged',rule};
  }
  return {...r,updateMedicalBleedingWoundBased:original.updateMedicalBleedingWoundBasedR2,buildBodyTrajectoryContext,buildConfirmedInjuryModel,finalizeBleedingProfileWithEvidence};
}
