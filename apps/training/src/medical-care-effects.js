import{completedGauzeCoefficient}from'./medical-care-m4c-policy.js';
import{movementBleedFactor}from'./medical-care-movement.js';
import{CARE,treatmentProfile,treatments,matchesTourniquet,carePlans,oozeSplits}from'./medical-care-state.js';
import{systemicCareFactor}from'./medical-care-systemic.js';
import{limbRouteFractions}from'./medical-routing.js';
const lerp=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
export function treatmentControlFactor(m,s){
 const ts=treatments(m);if(!ts.length){carePlans.get(m)?.delete(s.id);return movementBleedFactor(m,s);}
 let rows=limbRouteFractions(m,s);if(!rows){const lesions=s.lesions?.length?s.lesions:[{woundId:s.woundIds[0],position:s.position,currentAreaMm2:1}],total=lesions.reduce((n,l)=>n+(l.currentAreaMm2??l.severity*l.closureFactor??1),0);rows=lesions.map(l=>({woundId:l.woundId,position:l.position||s.position,share:(l.currentAreaMm2??l.severity*l.closureFactor??1)/Math.max(1e-30,total),internalFraction:s.destination==='external'?0:s.injuryType==='ooze'?1-(oozeSplits.get(m)?.get(s.id)?.externalFraction??0):1}));}
 let factor=0;const segments=[];
 for(const r of rows){const distal=ts.filter(t=>!['intra_thoracic','intra_abdominal','junctional'].includes(s.controlClass)&&t.kind==='cat'&&t.progress>0&&matchesTourniquet(t,r.position)),full=distal.some(t=>t.status==='completed'),wound=ts.filter(t=>t.kind!=='cat'&&t.target.woundId===r.woundId&&t.progress>0);let all=1,external=1;
  if(full)all=Math.min(...distal.filter(t=>t.status==='completed').map(t=>treatmentProfile(t).catResidual));else for(const t of distal){const p=treatmentProfile(t);all*=s.vesselKind==='vein'?lerp(1,p.looseVeinFactor,t.progress):s.vesselKind==='artery'?1+p.looseArteryGain*t.progress:1;}
  const kind=s.vesselKind==='artery'?'artery':s.vesselKind==='vein'?'vein':'capillary';
  for(const t of(full?[]:wound)){const p=treatmentProfile(t);if(t.kind==='bandage')external*=lerp(1,p.bandage[kind],t.progress*(t.status==='completed'?1:.45));else if(t.kind==='gauze'){const coefficient=t.status==='completed'?completedGauzeCoefficient(t,p.gauze[kind],p.gauzePressureSeconds):t.status==='active'&&t.workS>=p.gauzePackingSeconds?p.manualPressure[kind]:1-p.interruptedGauzeGain*t.progress;if(s.destination==='limb_compartment'&&r.internalFraction<1&&!['intra_thoracic','intra_abdominal'].includes(s.controlClass))all*=coefficient;else external*=coefficient;}}
  if(!full){const movement=movementBleedFactor(m,s);if(movement!==1)all*=movement;}
  const systemic=systemicCareFactor(m,s);if(systemic!==1)all*=systemic;
  const internal=r.internalFraction,coefficient=all*(internal+(1-internal)*external);factor+=r.share*coefficient;segments.push({...r,coefficient,shareAfter:r.share*coefficient,internalFractionAfter:coefficient>0?all*internal/coefficient:internal,allFactor:all,externalFactor:external});
 }
 if(segments.every(r=>r.coefficient===1)){carePlans.get(m)?.delete(s.id);return 1;}
 if(!carePlans.has(m))carePlans.set(m,new Map());carePlans.get(m).set(s.id,{factor,segments});return factor;
}
