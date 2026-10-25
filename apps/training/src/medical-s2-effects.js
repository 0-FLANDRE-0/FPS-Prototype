// S2 3D structural semantics. Values are game tuning, not injury thresholds.
// Original HP/damage registries and all retained 2D declarations stay intact.
export const MEDICAL_S2_VALUES=Object.freeze({
  comminutionBoneEnergyJ:250,
  amputationLimbEnergyJ:8000,
  amputationBasis:'single projectile event in one target and canonical limb, summed across its disjoint channels; never across events',
  concussionPhysiologyApplied:false,
});
const K=MEDICAL_S2_VALUES,limbs=new Set(['leftArm','rightArm','leftLeg','rightLeg']),clamp=x=>Math.max(0,Math.min(1,x));
const channel=w=>w?.bodyTrajectory?.woundChannel;
const s2=c=>c?.ruleId==='wound-channel-s2';
const bones=bt=>(bt?.internalGeometry?.internalHits||[]).filter(h=>h.kind==='bone'&&h.traversedLengthM>0);
// The caller creates this map inside one TrainingMedical.record(event). It is
// never retained on the actor, so neither another projectile nor another actor
// can contribute to a structural threshold. Physical channels stay untouched.
export function advanceStructuralHitS2(prefixes,{shotId,targetId,partKey,channel:c}){
  if(!s2(c))return null;
  const key=JSON.stringify([shotId,targetId,partKey]),previous=prefixes.get(key),
    energyBeforeJ=previous?.energyLostJ||0,boneEnergyBeforeJ=previous?.boneEnergyLostJ||0,
    energyLostJ=energyBeforeJ+Math.max(0,Number(c.energyLostJ)||0),
    boneEnergyLostJ=boneEnergyBeforeJ+Math.max(0,Number(c.boneEnergyLostJ)||0),
    segmentCount=(previous?.segmentCount||0)+1;
  const hit={ruleId:'structural-hit-s2',shotId,targetId,partKey,segmentCount,
    energyBeforeJ,energyLostJ,boneEnergyBeforeJ,boneEnergyLostJ,
    amputationThresholdCrossed:limbs.has(partKey)&&energyBeforeJ<K.amputationLimbEnergyJ&&energyLostJ>=K.amputationLimbEnergyJ,
    comminutionThresholdCrossed:boneEnergyBeforeJ<K.comminutionBoneEnergyJ&&boneEnergyLostJ>=K.comminutionBoneEnergyJ};
  prefixes.set(key,hit);return hit;
}
export function structuralWoundS2(w){
  const c=channel(w);if(!s2(c))return null;
  const actual=bones(w.bodyTrajectory),boneIds=new Set(actual.map(h=>h.id)),boneHits=(c.boneHits||[]).filter(h=>boneIds.has(h.id)),
    input=w.bodyTrajectory.structuralHit,hit=input?.ruleId==='structural-hit-s2'&&input.partKey===w.partKey?input:null,
    localBoneEnergyJ=Math.max(0,Number(c.boneEnergyLostJ)||0),localLimbEnergyJ=limbs.has(w.partKey)?Math.max(0,Number(c.energyLostJ)||0):0,
    boneEnergyJ=hit?hit.boneEnergyLostJ:localBoneEnergyJ,limbEnergyJ=limbs.has(w.partKey)?(hit?hit.energyLostJ:localLimbEnergyJ):0;
  return {ruleId:'medical-s2',singleHit:true,limbEnergyJ,boneEnergyJ,localLimbEnergyJ,localBoneEnergyJ,
    structuralHit:hit?{...hit}:null,
    boneHits:boneHits.map(h=>({...h})),actualBoneIds:[...boneIds],
    comminuted:actual.length>0&&(hit?hit.comminutionThresholdCrossed:boneEnergyJ>=K.comminutionBoneEnergyJ),
    amputated:limbs.has(w.partKey)&&(hit?hit.amputationThresholdCrossed:limbEnergyJ>=K.amputationLimbEnergyJ),
    comminutionThresholdJ:K.comminutionBoneEnergyJ,amputationThresholdJ:K.amputationLimbEnergyJ,
    concussionRisk:clamp(Number(c.concussionRisk)||0),concussionPhysiologyApplied:false,
    classification:'tuning: energy gates; no visual mesh separation'};
}
function suppressCumulativeAmputation(m,w){
  const p=m.bodyParts[w.partKey],pd=m.partDestruction?.[w.partKey];if(!pd)return;
  // Legacy destruction scores remain available for comparison. Their repeated-
  // hit loss labels cannot authorize S2's single-hit energy-based amputation.
  if(['partial_traumatic_loss','traumatic_amputation'].includes(pd.state)){
    w.s2LegacyDestructionOverride={state:pd.state,reason:'S2 requires single-hit energy; cumulative scores are not amputation evidence'};
    pd.state='destroyed';pd.functionalCap=0;pd.disabledByDestruction=true;pd.traumaticLossRisk=0;
    pd.functionalLossReason='structural_destruction';pd.s2LossLabelSuppressed=true;
    if(w.partDestructionEvidence)w.partDestructionEvidence.partDestructionStateAfter='destroyed';
    p.destructionState='destroyed';p.destructionFunctionalCap=0;p.traumaticLossRisk=0;p.functionRatio=0;p.disabled=true;
  }
}
export function applyStructuralWoundS2(unit,w){
  const m=unit.medical,p=m.bodyParts[w.partKey];if(!p)return null;
  suppressCumulativeAmputation(m,w);
  const trauma=structuralWoundS2(w);if(!trauma)return null;
  w.s2StructuralTrauma=trauma;w.concussionRisk=trauma.concussionRisk;
  if(trauma.comminuted){p.s2Comminuted=true;p.boneState='comminuted';p.irreversibleWithoutTreatment=true;}
  if(trauma.amputated){p.s2Amputated=true;p.amputated=true;p.irreversibleWithoutTreatment=true;}
  refreshStructuralStateS2(unit);return trauma;
}
export function refreshStructuralStateS2(unit){
  const m=unit.medical;if(!m)return null;
  const summary=m.structuralTrauma??={ruleId:'medical-s2',parts:{},headStructureDestroyed:false,torsoDestroyed:[],concussionRisk:0,concussionPhysiologyApplied:false,
    neckRule:'retained v2: HP 0 caps lifeStatus at 5; no new direct arrest/death shortcut'},parts=summary.parts;
  for(const[k,p]of Object.entries(m.bodyParts)){
    const depleted=p.hp<=0,isLimb=limbs.has(k);
    // S3b records abdominal HP exhaustion even alongside a comminuted bone.
    // Existing boneState, irreversible flags and function loss stay intact.
    p.structuralState=k==='abdomen'&&depleted?'abdomen_destroyed':p.s2Amputated?'amputated':p.s2Comminuted?'comminuted':depleted?(isLimb?'unusable':k==='head'?'head_structure_destroyed':k==='neck'?'neck_hp_depleted':'torso_destroyed'):'intact';
    p.structuralFunctionDisabled=!!p.s2Comminuted||!!p.s2Amputated||(isLimb&&depleted);
    if(p.structuralFunctionDisabled){p.functionRatio=0;p.disabled=true;}
    const row=parts[k]??={};row.state=p.structuralState;row.hpDepleted=depleted;row.functionDisabled=p.structuralFunctionDisabled;
    if(p.irreversibleWithoutTreatment)row.irreversibleWithoutTreatment=true;
  }
  if(m._s2ConcussionWoundCount!==(m.wounds||[]).length){
    m.concussionRisk=Math.max(0,...(m.wounds||[]).map(w=>s2(channel(w))?clamp(Number(channel(w).concussionRisk)||0):0));m._s2ConcussionWoundCount=(m.wounds||[]).length;
  }
  summary.headStructureDestroyed=m.bodyParts.head.hp<=0;summary.torsoDestroyed.length=0;
  // S3b replaces only abdominal HP exhaustion; chest keeps S2 arrest.
  if(m.bodyParts.chest.hp<=0)summary.torsoDestroyed.push('chest');
  summary.abdomenDestroyed=m.bodyParts.abdomen.hp<=0;
  summary.abdomenRuleId='abdomen-hp-s3b';
  summary.concussionRisk=m.concussionRisk||0;
  if(['leftLeg','rightLeg'].some(k=>m.bodyParts[k].structuralFunctionDisabled)){m.canWalk=false;m.canMove=!!m.canCrawl;}
  return summary;
}
// Kept pure so offline QA can compare a documented counterfactual with only
// this HP gate disabled by an in-memory module hook. No gameplay toggle exists.
export function structuralArrestReasonS2(m){
  return m.bodyParts.chest.hp<=0?'torso_destroyed':null;
}
export function createMedicalS2Slots(r,original){
  function buildBodyTrajectoryContext(unit,ev,penState){
    const bt=r.buildBodyTrajectoryContext(unit,ev,penState);
    if(ev.trainingMetadata?.structuralHit)bt.structuralHit=structuredClone(ev.trainingMetadata.structuralHit);
    return bt;
  }
  function buildFractureEvidence(unit,ev,woundSize,bt,med){
    const result=r.buildFractureEvidence(unit,ev,woundSize,bt,med),c=bt?.woundChannel,actual=bones(bt),trauma=structuralWoundS2({partKey:ev.partKey,bodyTrajectory:bt});
    if(trauma?.comminuted){
      // The new energy stage still requires the original positive geometric
      // bone intersection. Cavity proximity never qualifies for fracture.
      const worst=(c.boneHits||[]).filter(h=>actual.some(a=>a.id===h.id)).sort((a,b)=>b.energyLostJ-a.energyLostJ)[0],bone=actual.find(h=>h.id===worst?.id)||actual[0];
      Object.assign(result,{occurred:true,fractureType:'comminuted',geometryBoneId:bone.id,
        boneFragmentSeverity:.6,vascularRiskBonus:.18,bleedBonusMul:1.55,
        s2Comminution:{energyJ:trauma.boneEnergyJ,localEnergyJ:trauma.localBoneEnergyJ,thresholdJ:K.comminutionBoneEnergyJ,singleHit:true,classification:'tuning'},
        evidenceTags:[...(result.evidenceTags||[]),'S2_single_hit_bone_energy_comminution']});
    }
    return result;
  }
  function buildVascularEvidence(w){
    const result=r.buildVascularEvidence(w),trauma=structuralWoundS2(w);if(!trauma?.amputated)return result;
    const identifier=/Arm$/.test(w.partKey)?'brachial_vessel_injury':'femoral_vessel_injury',view={...w,
      confirmedInjuries:[...(w.confirmedInjuries||[]),identifier],probableInjuries:[],candidateInjuries:[],vesselCandidateHints:[],majorVesselCandidate:false,
      bleedingProfile:{...w.bleedingProfile,vesselRisk:0}};
    const severed=original.buildVascularEvidence(view);
    Object.assign(result,severed,{vesselKinds:[...new Set([...(result.vesselKinds||[]),'artery'])],
      source:'S2 energy-qualified amputation: modeled vessel severance routed through original major-vessel bleeding',
      s2AmputationSeverance:{identifier,singleHitEnergyJ:trauma.limbEnergyJ,thresholdJ:K.amputationLimbEnergyJ,
        evidence:'structural limb loss; not a fabricated projectile/internal-shape intersection'}});
    return result;
  }
  function reinforceVascularEvidenceWithPartDestruction(unit,w){
    applyStructuralWoundS2(unit,w);return r.reinforceVascularEvidenceWithPartDestruction(unit,w);
  }
  return {...r,buildBodyTrajectoryContext,buildFractureEvidence,buildVascularEvidence,reinforceVascularEvidenceWithPartDestruction};
}
