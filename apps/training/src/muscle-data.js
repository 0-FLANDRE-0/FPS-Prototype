import {BRACE_TUNING} from './fall-brace.js';
// R-2 trial. Every coefficient below is game tuning, not measured human torque.
export const MUSCLE = Object.freeze({
 consciousnessFadeS:.45, legCollapseFadeS:.40, stationaryReflexS:.22, unconsciousArmStrength:0,
 movingThresholdMps:.08, walkReferenceMps:1.4, brace:BRACE_TUNING,
 collapseSpineForwardRad:.18, collapseChestForwardRad:.12,
 painLoss:.12, mapLoss:.16, mapReference:93, mapLow:45, minAwakeStrength:.62,
 selfCollision:true, activeSolverIterations:12, passiveSolverIterations:12,
 activeAngularDamping:8, passiveAngularDamping:8, activeLinearDamping:2, passiveLinearDamping:4, footFriction:3, flinchRad:.075, flinchS:.2,
 motors:{torso:[600,100,200],neck:[90,25,40],shoulder:[90,16,65],elbow:[65,12,45],wrist:[12,4,12],hip:[450,75,220],knee:[400,70,220],ankle:[180,140,120]},
});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
// One-way post-collapse envelope. Recovery never changes a dynamic body back
// into animation. Arms/low MAP/pain alone cannot activate this controller.
export function followGeneralStrength(state,medical,dt){
 if(medical.dead){state.collapseElapsedS=state.collapseDurationS=0;return 0;}
 if(state.collapseDurationS==null&&!medical.unconscious&&!medical.collapse)return state.strength??1;
 if(state.collapseDurationS==null){
  state.collapseDurationS=medical.unconscious?MUSCLE.consciousnessFadeS:MUSCLE.legCollapseFadeS;
  state.collapseStartStrength=state.strength??1;state.collapseElapsedS=0;
 }
 state.collapseElapsedS=Math.min(state.collapseDurationS,(state.collapseElapsedS||0)+dt);
 return state.collapseStartStrength*Math.max(0,1-state.collapseElapsedS/state.collapseDurationS);
}
// Read only: no clinical slots, wounds or flags are written by this adapter.
export function medicalMuscleStrength(unit){
 const m=unit.medical,dead=!!(unit.isDead||m.isDead||m.cardiacArrest),unconscious=!!(dead||m.isUnconscious),
 consciousness=clamp((m.consciousness??100)/100),pain=clamp((m.stressResponse?.perceivedPain??m.pain??0)/100),map=m.hemodynamics?.map??93,
 awake=Math.max(MUSCLE.minAwakeStrength,consciousness*(1-MUSCLE.painLoss*pain-MUSCLE.mapLoss*clamp((MUSCLE.mapReference-map)/(MUSCLE.mapReference-MUSCLE.mapLow)))),
 general=unconscious?0:awake,part=k=>{const p=m.bodyParts?.[k];return p?.disabled||p?.hp===0||(p?.functionRatio??1)<=.12?0:clamp(p?.functionRatio??1);},
 spinal=!!m.spinalCordInjury,legs={left:spinal?0:part('leftLeg'),right:spinal?0:part('rightLeg')},arms={left:part('leftArm'),right:part('rightArm')};
 return{general,consciousness,pain,map,dead,unconscious,legs,arms,support:(legs.left+legs.right)/2,
  collapse:unconscious||legs.left===0||legs.right===0,reason:dead?'death-or-arrest':unconscious?'unconscious':spinal?'spinal-cord':legs.left===0||legs.right===0?'leg-function':null};
}
