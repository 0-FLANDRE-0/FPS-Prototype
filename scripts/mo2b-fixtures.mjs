import{TrainingMedical}from'../apps/training/src/medical.js';
import{MO2}from'../apps/training/src/medical-mo2-policy.js';
import{freezeReferenceFlow}from'../apps/training/src/medical-reference-flow.js';
import{prepareCareFlows,treatmentControlFactor,woundFlow,selectMovementEvent}from'../apps/training/src/medical-hemostasis.js';
import{setCareTime}from'../apps/training/src/medical-care-state.js';
export function pressureFixture(referenceExternal=100){
 const bridge=new TrainingMedical(),m=bridge.actor.medical,w={id:'test-wound',partKey:'leftArm',care:{ruleId:MO2.ruleId}},s={id:'test-source',vesselKind:'artery',destination:'external',injuryType:'partial_laceration',woundIds:[w.id],rawFlowMlPerS:referenceExternal,flowMlPerS:referenceExternal,lesions:[{woundId:w.id,baseAreaMm2:10,currentAreaMm2:10}]};m.wounds=[w];m.bleedSources=[s];freezeReferenceFlow(w,{external:referenceExternal});
 return{bridge,m,w,s,flow(time,current=referenceExternal){s.rawFlowMlPerS=current;setCareTime(m,time);prepareCareFlows(m,200,5000,0);s.flowMlPerS=s.rawFlowMlPerS*treatmentControlFactor(m,s);return woundFlow(m,w);}};
}
export function sampleMovement(running,policy=MO2.movement,{seedBase=0x740000,trials=500,seconds=30}={}){
 let seepTrials=0,reopenTrials=0,eventSeep=0;const samples=[];
 for(let j=1;j<=trials;j++){
  let seed=seedBase+j,seen=false,reopened=false;const care={seepUntilS:0},events=[],random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<seconds*60;i++){const time=i/60,kind=selectMovementEvent(care,time,1/60,running,random,policy);if(!kind)continue;events.push({kind,time});if(kind==='reopen'){reopened=true;break;}seen=true;eventSeep++;care.seepUntilS=time+policy.seepSeconds;}
  seepTrials+=seen;reopenTrials+=reopened;if(j<4)samples.push(events);
 }
 return{trials,seconds,seepTrials,reopenTrials,eventSeep,seepTrialRate:seepTrials/trials,reopenTrialRate:reopenTrials/trials,samples};
}
