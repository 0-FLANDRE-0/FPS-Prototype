import{infectionModifiers}from'./medical-infection.js';
import{lungDamage}from'./medical-lungs.js';
// D2: independent 3D activity state. Never adds fields to retained medical records.
// Numeric mappings are game tuning; provenance: docs/medical-d2-ledger.json.
export const D2=Object.freeze({ruleId:'medical-activity-d2-v55',equipmentMassKg:13.7,
 sprintSeconds:32,legRecoveryS:24,walkingRecoveryS:70,sprintRestart:.25,
 shoulderTorqueNm:40,armRecoveryS:32,crouchArmLoad:.88,
 enduranceCurve:[[.15,600],[.2,300],[.3,110],[.4,55],[.5,30],[1,1]],
 exerciseHrBpm:95,hrRiseTauS:18,hrRecoveryTauS:45,exercisePreloadGain:.25,exerciseContractilityGain:.32,oxygenExtractionGain:.75,
 oxygenDemandGain:1.8,organRedistributionGain:4,muscleFlowGain:2,
 concussionGain:1.6,concussionRiskPower:.5,concussionTauS:120,concussionRiseTauS:.6,
 concussionHandlingLoss:.32,concussionHearingDb:8,concussionTinnitusGain:.0025,
 reversePortCandidate:true,automatic2DPort:false});
const states=new WeakMap(),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),follow=(a,b,dt,tau)=>b+(a-b)*Math.exp(-dt/tau);
export const activityFor=m=>m?states.get(m):null;
export function exerciseIntensity(speedMps,equipmentMassKg=D2.equipmentMassKg){
 const speed=Math.max(0,Number(speedMps)||0);if(speed<.05)return 0;
 const base=speed<=1.6?.18*speed/1.6:.18+.82*(speed-1.6)/(4.5-1.6);
 return clamp(base*(1+.01*(Math.max(0,equipmentMassKg)-D2.equipmentMassKg)));
}
export function armEnduranceSeconds(mvc){
 const rows=D2.enduranceCurve,x=clamp(mvc,.15,1);
 for(let i=1;i<rows.length;i++)if(x<=rows[i][0]){const[a,t]=rows[i-1],[b,u]=rows[i];return Math.exp(Math.log(t)+(Math.log(u)-Math.log(t))*(x-a)/(b-a));}
 return 1;
}
export function weaponArmLoad({weaponId='m4a1',weaponMassKg=3.1,attachmentMassKg=0,crouched=false}={}){
 // Masses are original registry inputs; lever arms/torque are authored tuning.
 const bare=Math.max(0,weaponMassKg-attachmentMassKg),lever=weaponId==='ak74m'?.34:.31;
 const torqueNm=9.81*(bare*lever+Math.max(0,attachmentMassKg)*.27);
 const mvc=torqueNm/D2.shoulderTorqueNm*(crouched?D2.crouchArmLoad:1);
 return{weaponMassKg,attachmentMassKg,leverM:lever,torqueNm,mvc,enduranceS:armEnduranceSeconds(mvc)};
}
function reserve(m,keys){
 const p=m?.bodyParts||{},mask=1-(m?.stressResponse?.painMasking||0),fn=Math.min(...keys.map(k=>p[k]?.functionRatio??1)),pain=Math.max(...keys.map(k=>(p[k]?.pain||0)*mask))/100;
 const blood=clamp((m?.bloodMl??5000)/(m?.bloodMax??5000)),oxygen=clamp(m?.hemodynamics?.oxygenDelivery??1);
 return clamp(fn*(1-.45*pain)*blood*oxygen,0,1);
}
export class MedicalActivity{
 constructor(m){this.m=m;states.set(m,this);this.controls={};this.leg=this.arm=1;this.legMax=this.armMax=1;this.sprintLocked=false;this.intensity=this.hrExtra=this.hrApplied=0;this.concussionDose=this.concussionSeverity=this.focusDelay=0;this.concussionInputs=[];this.woundsSeen=new Set();this.time=0;this.lastYaw=this.lastPitch=this.lastDepth=null;this.armLoad=weaponArmLoad();}
 setInput(values={}){this.controls={...this.controls,...values};}
 addConcussion(risk,{source='skull-cavity',time=this.time}={}){
  risk=clamp(Number(risk)||0);if(!risk)return;
  this.concussionDose=clamp(this.concussionDose+risk**D2.concussionRiskPower*D2.concussionGain,0,3);
  this.concussionInputs.push({source,time,risk,dose:this.concussionDose});if(this.concussionInputs.length>64)this.concussionInputs.shift();
 }
 recordWounds(){for(const w of this.m.wounds||[])if(!this.woundsSeen.has(w.id)){this.woundsSeen.add(w.id);const channel=w.bodyTrajectory?.woundChannel,cranial=(channel?.organs||[]).filter(o=>['brain','brainstem'].includes(o.organ)),risk=cranial.length?Math.max(0,...cranial.map(o=>o.concussionRisk||0)):w.partKey==='head'?(w.concussionRisk||channel?.concussionRisk||0):0;this.addConcussion(risk,{source:'S2/skull-cavity/'+w.id});}}
 step(dt,time){
  this.time=time;const c=this.controls,m=this.m,incapacitated=m.isUnconscious||m.isDead||m.cardiacArrest||m.isDowned;
  this.recordWounds();this.concussionDose*=Math.exp(-dt/D2.concussionTauS);
  this.concussionSeverity=follow(this.concussionSeverity,clamp(this.concussionDose),dt,D2.concussionRiseTauS);
  const speed=incapacitated?0:Math.max(0,c.speedMps||0),gear=c.equipmentMassKg??D2.equipmentMassKg;
  this.intensity=exerciseIntensity(speed,gear);
  this.hrExtra=follow(this.hrExtra,D2.exerciseHrBpm*this.intensity,dt,this.intensity*D2.exerciseHrBpm>this.hrExtra?D2.hrRiseTauS:D2.hrRecoveryTauS);
  if(this.hrExtra<1e-8&&!this.intensity)this.hrExtra=0;
  this.lungs=lungDamage(m);this.legMax=reserve(m,['leftLeg','rightLeg'])*this.lungs.factor*infectionModifiers(m).staminaFactor;this.armMax=reserve(m,['leftArm','rightArm']);
  const gearFactor=1+Math.max(0,gear-D2.equipmentMassKg)/40;
  if(c.sprinting&&speed>.25&&!incapacitated)this.leg=Math.max(0,Math.min(this.leg,this.legMax)-dt*gearFactor/D2.sprintSeconds);
  else this.leg=Math.min(this.legMax,this.leg+dt*this.legMax*(speed>.1?1/D2.walkingRecoveryS:1/D2.legRecoveryS));
  if(this.leg<=1e-8)this.sprintLocked=true;
  if(this.sprintLocked&&this.legMax>0&&this.leg>=this.legMax*D2.sprintRestart)this.sprintLocked=false;
  this.armLoad=weaponArmLoad(c);
  if(c.ads&&!incapacitated)this.arm=Math.max(0,Math.min(this.arm,this.armMax)-dt/this.armLoad.enduranceS/Math.max(.05,this.armMax));
  else this.arm=Math.min(this.armMax,this.arm+dt*this.armMax/D2.armRecoveryS);
  const yaw=c.yaw??this.lastYaw,pitch=c.pitch??this.lastPitch,depth=Math.max(.2,c.focusDepthM??this.lastDepth??30);
  let focus=0;if(this.lastYaw!==null){const turn=Math.hypot(Math.atan2(Math.sin(yaw-this.lastYaw),Math.cos(yaw-this.lastYaw)),pitch-this.lastPitch)/Math.max(dt,1e-6),accommodation=Math.abs(Math.log(depth/this.lastDepth));focus=clamp(turn/3+accommodation*.8)*this.concussionSeverity;}
  this.focusDelay=Math.max(focus,this.focusDelay*Math.exp(-dt/.65));this.lastYaw=yaw??0;this.lastPitch=pitch??0;this.lastDepth=depth;
 }
 feedback(){const s=this.concussionSeverity,fatigue=clamp((.65-this.arm/Math.max(.05,this.armMax))/.65);
  return{concussionSeverity:s,concussionBlur:s*(.35+.12*Math.sin(this.time*.63))+.5*this.focusDelay,concussionBloom:.3*s,concussionTinnitusGain:D2.concussionTinnitusGain*s,concussionHandlingRate:1-D2.concussionHandlingLoss*s,concussionHearingDb:D2.concussionHearingDb*s,armFatigue:fatigue,legFatigue:1-this.leg/Math.max(.05,this.legMax),exerciseIntensity:this.intensity,sprintAllowed:!this.sprintLocked&&this.leg>0};}
 snapshot(){return{ruleId:D2.ruleId,time:this.time,leg:this.leg,legMax:this.legMax,lungs:this.lungs||lungDamage(this.m),...(this.m.infection?{infection:infectionModifiers(this.m)}:{}),arm:this.arm,armMax:this.armMax,sprintLocked:this.sprintLocked,intensity:this.intensity,hrExtra:this.hrExtra,hrApplied:this.hrApplied,exercise:this.exercise?{...this.exercise}:null,armLoad:{...this.armLoad},concussion:{dose:this.concussionDose,severity:this.concussionSeverity,focusDelay:this.focusDelay,inputs:this.concussionInputs.map(x=>({...x}))},...this.feedback()};}
}
// Run retained pathology HR/SV calculation with only its own HR. The exercise
// component is added independently and never bypasses arrest or pump loss.
export function exerciseHemodynamics(m,dt,original){
 const a=activityFor(m);if(!a||(!a.intensity&&!a.hrExtra&&!a.hrApplied)){if(a)a.exercise=null;original();return;}
 const hr=m.heartRate;m.heartRate=Math.max(0,hr-a.hrApplied);try{original();}finally{m.heartRate=hr;}
 const h=m.hemodynamics,i=a.intensity,p=clamp(h.preload),capacity=p**4*(h.circulatingReserve??1),baseCO=h.cardiacOutputMul,baseSV=h.strokeVolumeMul;
 const preloadMul=1+D2.exercisePreloadGain*i*capacity,contractilityMul=1+D2.exerciseContractilityGain*i*capacity,sv=baseSV*preloadMul*contractilityMul,extra=sv*(a.hrApplied/75)*capacity;
 h.strokeVolumeMul=sv;h.cardiacOutputMul=baseCO+(sv-baseSV)+extra;
 h.map+=20*i*capacity;h.pulsePressure=clamp(sv*40,0,80);
 const supply=h.oxygenDelivery*(baseCO>0?h.cardiacOutputMul/baseCO:1)*(1+D2.oxygenExtractionGain*i*capacity),demand=1+D2.oxygenDemandGain*i;
 h.tissuePerfusion=clamp((h.map/93+h.cardiacOutputMul)/2,0,1.2);
 h.oxygenDelivery=clamp(supply/demand,0,1.2);h.oxygenDebt=h.oxygenDelivery<.6;h.poorPerfusion=h.tissuePerfusion<.6;h.preArrestRisk||=h.oxygenDelivery<.4;
 a.exercise={baseCO,baseSV,preload:p,exercisePreload:p*preloadMul,exerciseContractility:h.contractility*contractilityMul,preloadMul,contractilityMul,capacity,oxygenSupply:supply,oxygenDemand:demand,supplyDemandRatio:h.oxygenDelivery,intensity:i};
}
export function exerciseVitals(m,original){
 const a=activityFor(m);if(!a||(!a.hrExtra&&!a.hrApplied)){original();return;}
 m.heartRate=Math.max(0,m.heartRate-a.hrApplied);
 // The retained agonal HR gate describes failed oxygen supply to the heart,
 // not whole-body exercise demand. Consciousness/vision still read the ratio.
 const h=m.hemodynamics,ratio=h.oxygenDelivery,supply=clamp(a.exercise?.oxygenSupply??ratio,0,1.2);
 h.oxygenDelivery=supply;try{original();}finally{h.oxygenDelivery=ratio;}
 // Preserve terminal supply-driven bradycardia rather than inventing it from
 // increased muscle demand alone. Original arrest and pump loss still win.
 const terminal=supply<.28||(m.lifeStatus<15&&supply<.4)||(h.decompensatingShock&&h.compensationExhaustion>.7&&supply<.5);
 a.hrApplied=terminal||m.cardiacArrest||m.isDead?0:Math.min(a.hrExtra,190-m.heartRate);m.heartRate+=a.hrApplied;
}
export function exerciseAfterPump(m,previousReserveOxygen,dt){
 const a=activityFor(m);if(!a?.exercise||!m.heartInjury||m.cardiacArrest)return;
 const h=m.hemodynamics,follow=1-Math.exp(-dt/(m.heartInjury.reserveTauS||4));
 a.exercise.oxygenSupply=h.oxygenDelivery;h.oxygenDelivery/=a.exercise.oxygenDemand;
 h.cerebralReserveOxygen=(previousReserveOxygen??1)+(h.oxygenDelivery-(previousReserveOxygen??1))*follow;
 a.exercise.supplyDemandRatio=h.oxygenDelivery;h.oxygenDebt=h.oxygenDelivery<.6;h.preArrestRisk||=h.oxygenDelivery<.4;
}
export function exerciseBleedingFactor(m,source){
 const i=activityFor(m)?.intensity||0;if(!i)return 1;
 if((source.injuryType==='parenchymal'||source.organBed)&&/liver|spleen|kidney|hepatic|portal/.test(source.id))return 1/(1+D2.organRedistributionGain*i);
 if(source.injuryType==='ooze'&&/Arm|Leg/.test(source.position?.partKey||''))return 1+D2.muscleFlowGain*i;
 return 1;
}
