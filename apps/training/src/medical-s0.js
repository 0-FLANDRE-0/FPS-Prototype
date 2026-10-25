// S0: independent 3D anatomy-driven physiology. No 2D source is modified.
// All coefficients below are GAME TUNING; source locations and candidate ports
// are recorded in docs/medical-s0-ledger.json, not claimed clinical constants.
import {MEDICAL_S1_PHYSIOLOGY_VALUES} from './medical-s1-effects.js';
export const MEDICAL_S0_VALUES=Object.freeze({heartReferenceChordM:.04,maximumPumpLoss:.99,heartCerebralReserveTauS:4,failedPumpThreshold:.05});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const hits=w=>(w?.bodyTrajectory?.internalGeometry?.internalHits||[]).filter(h=>h.traversedLengthM>0);
export function criticalAnatomyS0(unit){
 const m=unit.medical,wounds=m.wounds||[],brain=[],stem=[],hearts=[],femurs=[];
 let pump=1;
 for(const w of wounds){const actual=hits(w);w.s0InjuryModel={source:'actual positive internal intervals',injuries:actual.filter(h=>['brain','brainstem','heart_hook_only','heart'].includes(h.organ)).map(h=>({id:h.id,identifier:h.identifier,type:h.organ==='brain'?'brain_tissue_disruption':h.organ==='brainstem'?'brainstem_disruption':'cardiac_pump_loss',chordM:h.traversedLengthM}))};for(const h of actual){
  if(h.organ==='brain')brain.push(h);
  if(h.organ==='brainstem')stem.push(h);
  if((h.organ==='heart_hook_only'||h.organ==='heart')&&!w.bodyTrajectory.woundChannel){
   const severity=clamp(h.traversedLengthM/MEDICAL_S0_VALUES.heartReferenceChordM)*clamp(w.bodyTrajectory.residualEnergyFactor??1,.25,1),loss=MEDICAL_S0_VALUES.maximumPumpLoss*severity;
   hearts.push({id:h.id,woundId:w.id,chordM:h.traversedLengthM,severity,pumpLoss:loss});pump*=1-loss;
  }
  if(h.kind==='bone'&&h.identifier==='femur'&&w.fractureEvidence?.occurred&&w.fractureEvidence.geometryBoneId===h.id)femurs.push({id:h.id,partKey:w.partKey});
 }
 if(w.bodyTrajectory?.woundChannel)for(const o of w.bodyTrajectory.woundChannel.organs||[])if(['heart_hook_only','heart'].includes(o.organ)&&o.effectiveVolumeM3>0){
  const severity=clamp(o.severity||0),pumpSeverity=clamp(severity*(o.direct?MEDICAL_S1_PHYSIOLOGY_VALUES.heartDirectPumpSensitivityGain:1)),loss=MEDICAL_S0_VALUES.maximumPumpLoss*pumpSeverity;
  hearts.push({id:o.id,woundId:w.id,chordM:actual.find(h=>h.id===o.id)?.traversedLengthM||0,severity,pumpSeverity,pumpLoss:loss,effectiveVolumeM3:o.effectiveVolumeM3,organVolumeM3:o.volumeM3,direct:!!o.direct,ruleId:'medical-s1'});pump*=1-loss;
 }
 }
 m.brainInjury=brain.length||stem.length?{kind:stem.length?'brainstem':'cerebrum',structures:[...new Set([...brain,...stem].map(h=>h.id))],traversedLengthM:[...brain,...stem].reduce((s,h)=>s+h.traversedLengthM,0),source:'actual positive occupied-body internal intervals',ruleId:'medical-s0'}:null;
 m.heartInjury=hearts.length?{pumpFunction:clamp(pump),hits:hearts,reserveTauS:hearts.some(h=>h.ruleId==='medical-s1')?MEDICAL_S1_PHYSIOLOGY_VALUES.heartCerebralReserveTauS:MEDICAL_S0_VALUES.heartCerebralReserveTauS,source:hearts.some(h=>h.ruleId==='medical-s1')?'S1 effective cardiac volume / shape volume severity; mapping and reserve are tuning':'actual cardiac chords; length/energy mapping is tuning'}:null;
 m.weightBearingFracture=femurs.length?{structures:[...new Set(femurs.map(f=>f.id))],parts:[...new Set(femurs.map(f=>f.partKey))]}:null;
 for(const f of femurs){const part=m.bodyParts[f.partKey];if(part)part.functionRatio=0;}
 if(femurs.length){m.canWalk=false;m.canMove=!!m.canCrawl;}
 if(m.brainInjury){m.consciousness=m.consciousnessTarget=0;m.isUnconscious=true;m.canShoot=m.canWalk=m.canCrawl=m.canMove=false;}
 return {brain:m.brainInjury,heart:m.heartInjury,femur:m.weightBearingFracture};
}
export function geometricHeadS0(m){return (m.wounds||[]).some(w=>w.partKey==='head'&&w.bodyTrajectory?.internalGeometry?.source?.startsWith('completed 3D occupied body segment'));}
export function applyCardiacPumpS0(unit,dt){
 const m=unit.medical,h=m.hemodynamics,injury=m.heartInjury;if(!injury)return;
 const pump=injury.pumpFunction;
 h.pumpFunction=pump;h.cardiacOutputBeforePump=h.cardiacOutputMul;h.mapBeforePump=h.map;
 h.cardiacOutputMul*=pump;h.strokeVolumeMul*=pump;h.pulsePressure*=pump;
 // Resistance cannot sustain arterial pressure without pump flow.
 h.map*=pump;h.tissuePerfusion=clamp((h.map/93+h.cardiacOutputMul)/2,0,1.2);
 h.oxygenDelivery=clamp(h.tissuePerfusion*(m.breathingEfficiency/100)*.9,0,1.2);
 const follow=1-Math.exp(-dt/(injury.reserveTauS||MEDICAL_S0_VALUES.heartCerebralReserveTauS));
 h.cerebralReserveMap=(h.cerebralReserveMap??93)+(h.map-(h.cerebralReserveMap??93))*follow;
 h.cerebralReserveOxygen=(h.cerebralReserveOxygen??1)+(h.oxygenDelivery-(h.cerebralReserveOxygen??1))*follow;
 h.oxygenDebt=h.oxygenDelivery<.6;h.preArrestRisk||=h.oxygenDelivery<.4;
}
// Same life summary terms as the retained source, excluding its unconditional
// aggregate head-HP death shortcut for actually localized 3D head wounds.
export function localizedHeadLifeS0(m){const h=m.hemodynamics;let life=100-(1-m.bloodMl/m.bloodMax)*55;
 if(h.tissuePerfusion<.7)life-=(.7-h.tissuePerfusion)*50;
 if(h.oxygenDelivery<.6)life-=(.6-h.oxygenDelivery)*40;
 life-=m.shock*.30;if(m.systolicBP<90)life-=(90-m.systolicBP)*.25;
 if(m.breathingEfficiency<70)life-=(70-m.breathingEfficiency)*.4;
 if(m.consciousness<50)life-=(50-m.consciousness)*.35;
 if(m.bodyParts.neck.hp<=0)life=Math.min(life,5);
 if(m.bodyParts.chest.hp<=5)life-=30;if(m.bodyParts.abdomen.hp<=5)life-=20;
 return clamp(life,0,100);
}
