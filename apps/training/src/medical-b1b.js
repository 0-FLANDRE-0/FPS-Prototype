// B1b changes only 3D bleeding and arrest labels. See the source/tuning ledger.
export const MEDICAL_B1B_VALUES=Object.freeze({
  ruleId:'bleed-sources-b1b',organFlowFractions:Object.freeze({liver:.25,spleen:.048,kidney:.10}),
  organSeverityGain:3,smallOrganSeverityThreshold:.10,smallOrganClosureTauS:180,
  arrestHemorrhageLossFraction:.40,arrestContributorThreshold:.10,arrestMixedScoreGap:.10,arrestOxygenContributorThreshold:.40,
  automatic2DPort:false,reversePortCandidate:true,
});
export function parenchymalFractionB1b(severity){return Math.max(0,Math.min(1,severity*MEDICAL_B1B_VALUES.organSeverityGain));}
// Read-only attribution at the already-decided transition. No trigger, timer,
// pressure, oxygen or pump equation is evaluated differently by this function.
export function arrestAttributionB1b(m,trigger){
  const k=MEDICAL_B1B_VALUES,bloodLossFraction=Math.max(0,1-m.bloodMl/m.bloodMax),
    pumpLoss=Math.max(0,1-(m.heartInjury?.pumpFunction??1)),
    respiratoryLoss=Math.max(0,1-m.breathingEfficiency/100),oxygenDelivery=m.hemodynamics.oxygenDelivery;
  let primary=trigger;
  if(['hemorrhagic_shock','hypoxia','respiratory_failure'].includes(trigger)){
    if(bloodLossFraction>=k.arrestHemorrhageLossFraction)primary='hemorrhagic_shock';
    else if(oxygenDelivery<k.arrestOxygenContributorThreshold&&(pumpLoss>=k.arrestContributorThreshold||respiratoryLoss>=k.arrestContributorThreshold)){
      primary=pumpLoss>=k.arrestContributorThreshold&&respiratoryLoss>=k.arrestContributorThreshold&&Math.abs(pumpLoss-respiratoryLoss)<=k.arrestMixedScoreGap?'mixed_cardiorespiratory_failure':pumpLoss>respiratoryLoss?'cardiac_pump_failure':'respiratory_failure';
    }else primary=bloodLossFraction>0?'mixed_circulatory_failure':'hypoxia';
  }
  return {primary,trigger,ruleId:k.ruleId,bloodLossFraction,pumpLoss,respiratoryLoss,oxygenDelivery,
    scoresAreTuning:true,changesPhysiology:false};
}
