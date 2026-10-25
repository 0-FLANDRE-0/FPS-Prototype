// B1c organ aggregation. Flow ceiling is the user's game design, not clinical data.
export const MEDICAL_B1C_VALUES=Object.freeze({
 ruleId:'bleed-sources-b1c',parenchymalMaxPerfusionFraction:2/3,
 portalPressureMmHg:8,hepaticPressureMmHg:5,
 hepaticReferenceOutputFraction:.25,portalReferenceOutputFraction:.20,
 organBedReferenceOutputFraction:.2,automatic2DPort:false,reversePortCandidate:true,
});
const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
export function unionSeverityB1c(values){let intact=1;for(const x of values)intact*=1-clamp(x);return 1-intact;}
export function updateParenchymalB1c(s,dt,cardiacOutputMlS,{smallOrganSeverityThreshold,smallOrganClosureTauS}){
 s.ageS=(s.ageS||0)+dt;s.severity=unionSeverityB1c(s.lesions.map(l=>l.severity));
 s.naturalClosureAllowed=s.severity<=smallOrganSeverityThreshold;
 for(const l of s.lesions){l.ageS+=dt;l.closureFactor??=1;if(s.naturalClosureAllowed)l.closureFactor*=Math.exp(-dt/smallOrganClosureTauS);}
 s.effectiveSeverity=unionSeverityB1c(s.lesions.map(l=>l.severity*l.closureFactor));
 s.closureFactor=s.severity>0?s.effectiveSeverity/s.severity:1;
 s.damageFraction=MEDICAL_B1C_VALUES.parenchymalMaxPerfusionFraction*s.effectiveSeverity;
 s.organPerfusionMlPerS=cardiacOutputMlS*s.organFlowFraction;
 s.organFlowCeilingMlPerS=s.organPerfusionMlPerS*MEDICAL_B1C_VALUES.parenchymalMaxPerfusionFraction;
 s.rawFlowMlPerS=s.organPerfusionMlPerS*s.damageFraction;
}
