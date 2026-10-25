import{carePlans,oozeSplits}from'./medical-care-state.js';
// Distribution only. Source flow, compatibility rates and all clinical sums keep
// their v57 arithmetic/order. No pressure feedback into circulation or wounds.
export const LIMB_ROUTING=Object.freeze({ruleId:'limb-routing-m2-v58',throughInternal:.15,oneOpeningInternal:.6,pressureStart:.5,firmFullness:.75,capacitiesMl:Object.freeze({upperLeg:1250,lowerLeg:750,upperArm:500,forearm:250}),classification:'튜닝;골절 출혈량 참고 상한은 실제 구획 압력/용량 실측값이 아님'});
const tables=new WeakMap(),clamp=x=>Math.max(0,Math.min(1,x));
function table(m){if(!tables.has(m))tables.set(m,{openings:new Map(),compartments:new Map(),sources:new Map(),timeS:0});return tables.get(m);}
export function registerLimbOpening(m,w,surface){if(!surface?.entry||!/(Arm|Leg)$/.test(w.partKey))return;table(m).openings.set(w.id,{entry:true,exit:!!surface.exit,partKey:w.partKey});for(const s of m.bleedSources||[])if(s.woundIds.includes(w.id))routeLimbVolume(m,s,0);}
export function setLimbRoutingTime(m,timeS){table(m).timeS=timeS;}
export function clearLimbRouting(m){tables.delete(m);}
function compartment(t,position){const part=position?.partKey;if(!/(Arm|Leg)$/.test(part||''))return null;const bone=position?.bone||'',region=part.endsWith('Arm')?(/Forearm|Hand|Thumb|Index|Middle|Ring|Pinky/.test(bone)?'forearm':'upperArm'):(/LowerLeg|Foot|Toes/.test(bone)?'lowerLeg':'upperLeg'),id=(part.startsWith('left')?'left':'right')+'-'+region;
 if(!t.compartments.has(id))t.compartments.set(id,{id,partKey:part,region,capacityMl:LIMB_ROUTING.capacitiesMl[region],volumeMl:0,fullness:0,pressureProxy:0,capacityReachedAtS:null});return t.compartments.get(id);
}
export function limbRouteFractions(m,s){
 if(s.destination!=='limb_compartment'||!['artery','vein'].includes(s.vesselKind))return null;
 const t=table(m),total=(s.lesions||[]).reduce((n,l)=>n+l.currentAreaMm2,0);if(!(total>0))return null;
 return s.lesions.map(l=>{const c=compartment(t,l.position||s.position),opening=t.openings.get(l.woundId),opened=!!opening?.entry,base=opened?(opening.exit?LIMB_ROUTING.throughInternal:LIMB_ROUTING.oneOpeningInternal):1,full=c?clamp(c.volumeMl/c.capacityMl):0,pressure=opened?clamp((full-LIMB_ROUTING.pressureStart)/(1-LIMB_ROUTING.pressureStart)):0;return{woundId:l.woundId,position:l.position||s.position,share:l.currentAreaMm2/Math.max(1e-30,total),internalFraction:base*(1-pressure)};});
}
export function routeLimbVolume(m,s,volume){
 if(s.destination!=='limb_compartment'||!['artery','vein'].includes(s.vesselKind)){const split=oozeSplits.get(m)?.get(s.id);if(split&&s.destination!=='external'){const plan=carePlans.get(m)?.get(s.id),fraction=plan?1-plan.segments[0].internalFractionAfter:split.externalFraction;split.externalFlowMlPerS=s.flowMlPerS*fraction;split.externalMl+=volume*fraction;}m.bloodPoolsMl[s.destination]+=volume;return;}
 const t=table(m),lesions=s.lesions||[],total=lesions.reduce((n,l)=>n+l.currentAreaMm2,0);if(!lesions.length||total<=0){t.sources.delete(s.id);m.bloodPoolsMl[s.destination]+=volume;return;}const row={sourceId:s.id,flowMlPerS:s.flowMlPerS,externalFlowMlPerS:0,internalFlowMlPerS:0,externalMl:t.sources.get(s.id)?.externalMl||0,internalMl:t.sources.get(s.id)?.internalMl||0,segments:[]};
 for(const l of lesions){const plan=carePlans.get(m)?.get(s.id),controlled=plan?.segments.find(r=>r.woundId===l.woundId),share=controlled?controlled.shareAfter/Math.max(1e-30,plan.factor):l.currentAreaMm2/Math.max(1e-30,total),v=volume*share,opening=t.openings.get(l.woundId),c=compartment(t,l.position||s.position),opened=!!opening?.entry;
  // No verified skin opening: retain v57 destination. Do not invent a drain.
  const base=opened?(opening.exit?LIMB_ROUTING.throughInternal:LIMB_ROUTING.oneOpeningInternal):1,full=c?clamp(c.volumeMl/c.capacityMl):0,pressure=opened?clamp((full-LIMB_ROUTING.pressureStart)/(1-LIMB_ROUTING.pressureStart)):0,fraction=controlled?controlled.internalFractionAfter:base*(1-pressure),inside=opened&&c?Math.min(v*fraction,Math.max(0,c.capacityMl-c.volumeMl)):v,external=v-inside,rateInside=s.flowMlPerS*share*(v>0?inside/v:fraction),rateExternal=s.flowMlPerS*share-rateInside;
  if(c){c.volumeMl+=inside;c.fullness=clamp(c.volumeMl/c.capacityMl);c.pressureProxy=clamp((c.fullness-LIMB_ROUTING.pressureStart)/(1-LIMB_ROUTING.pressureStart));if(c.volumeMl>=c.capacityMl&&c.capacityReachedAtS===null)c.capacityReachedAtS=t.timeS;}
  m.bloodPoolsMl.limb_compartment+=inside;m.bloodPoolsMl.external+=external;row.externalFlowMlPerS+=rateExternal;row.internalFlowMlPerS+=rateInside;row.externalMl+=external;row.internalMl+=inside;row.segments.push({woundId:l.woundId,compartmentId:c?.id||null,verifiedOpenings:opened?(opening.exit?2:1):0,internalFraction:fraction,externalFlowMlPerS:rateExternal,internalFlowMlPerS:rateInside});
 }
 t.sources.set(s.id,row);
}
export function limbRoutingState(m){const t=tables.get(m);return{ruleId:LIMB_ROUTING.ruleId,compartments:t?[...t.compartments.values()].map(c=>({...c})):[],sources:t?[...t.sources.values()].map(s=>({...s,segments:s.segments.map(r=>({...r}))})):[]};}
export function observedExternalSources(m){const t=tables.get(m);return(m.bleedSources||[]).map(s=>{const r=t?.sources.get(s.id);return r?{...s,destination:'external',flowMlPerS:r.externalFlowMlPerS,cumulativeMl:r.externalMl}:oozeSplits.get(m)?.has(s.id)&&s.destination!=='external'?{...s,destination:'external',flowMlPerS:oozeSplits.get(m).get(s.id).externalFlowMlPerS,cumulativeMl:oozeSplits.get(m).get(s.id).externalMl}:s;});}
