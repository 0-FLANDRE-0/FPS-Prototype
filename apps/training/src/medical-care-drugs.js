import{M4B,DRUG_KINDS}from'./medical-care-m4b-policy.js';
import{treatments}from'./medical-care-state.js';
import{activityFor}from'./medical-d2.js';
const inventories=new WeakMap();
export const bindCareInventory=(m,inv)=>inventories.set(m,inv);
const states=new WeakMap(),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const drugState=m=>states.get(m)||null;
// Onset/plateau/offset are game curves, not predicted plasma concentrations.
export function doseCurve(age,onset,duration){if(age<=onset||age>=duration)return 0;const rise=Math.min(1,(age-onset)/Math.max(5,onset)),fall=Math.min(1,(duration-age)/Math.max(60,duration*.2));return rise*fall;}
export function infusionRate(m){const a=activityFor(m),speed=a?.intensity||0,movement=speed>=.7?'달리기':speed>0?'걷기':'정지',factor=movement==='달리기'?.5:movement==='걷기'?.85:1;return{mlPerS:500/M4B.profile.infuseS*factor,movement,factor};}
export function finishDrugOrBlood(bridge,t,inventory){
 if(t.kind==='otfc'){t.firstAtS??=bridge.time;t.absorbed??=0;t.pool??=0;t.bloodLevel??=0;t.inMouth=true;t.stopReason=null;}
 if(t.kind==='blood'){t.remainingMl??=500;t.infusedMl??=0;t.deliveredMl??=0;t.connected=true;t.downAtConnection=!!(bridge.actor.medical.isDowned||bridge.actor.medical.isUnconscious||bridge.actor.medical.cardiacArrest||bridge.careRagdoll);t.disconnectedReason=null;}
 if(t.kind==='pill'){for(const old of treatments(bridge.actor.medical))if(old!==t&&old.kind==='pill'&&old.status==='completed'){if(!old.superseded&&doseCurve(bridge.time-old.appliedAtS,M4B.profile.pillOnset,M4B.profile.pillS)>0)t.renewed=true;old.superseded=true;}}
 if(t.kind==='ketamine'){const old=treatments(bridge.actor.medical).filter(x=>x!==t&&x.kind==='ketamine'&&x.status==='completed');t.earlyRepeat=old.some(x=>bridge.time-x.appliedAtS<M4B.ketamineRepeatS);}
}
export function stopMouth(m,reason='직접 빼기'){const t=treatments(m).find(t=>t.kind==='otfc'&&t.inMouth);if(!t)return false;t.inMouth=false;t.stopReason=reason;return true;}
export function disconnectBlood(m,reason='직접 분리'){const t=treatments(m).find(t=>t.kind==='blood'&&t.connected);if(!t)return false;t.connected=false;t.disconnectedReason=reason;return true;}
export function stepDrugsAndBlood(bridge,dt){
 const m=bridge.actor.medical,ts=treatments(m).filter(t=>[...DRUG_KINDS,'blood'].includes(t.kind)&&t.status==='completed');if(!ts.length)return;
 const state=states.get(m)||{analgesia:0,drowsy:0,respiration:0,ketamine:0,otfc:0,curves:[]};states.set(m,state);let pill=0,otfc=0,ketamine=0,ketPeak=0;const curves=[];
 for(const t of ts){const p=M4B.profile,age=bridge.time-t.appliedAtS,gain=p.drugGain;
  if(t.kind==='blood'){
   if((m.isUnconscious||m.isDead||m.cardiacArrest||((m.isDowned||bridge.careRagdoll)&&!t.downAtConnection))&&t.connected){t.connected=false;t.disconnectedReason='쓰러짐 · 연결 빠짐';}
   if(t.connected&&!m.isDead){const rate=infusionRate(m),ml=Math.min(t.remainingMl,rate.mlPerS*dt),added=Math.min(ml,Math.max(0,m.bloodMax-m.bloodMl));m.bloodMl+=added;t.remainingMl=Math.max(0,t.remainingMl-ml);t.infusedMl+=ml;t.deliveredMl+=added;t.rate=rate;if(t.remainingMl<1e-8){t.remainingMl=0;t.connected=false;t.disconnectedReason='주입 완료';}}continue;
  }
  let level=0;
  if(t.kind==='pill'&&!t.superseded){level=t.renewed?clamp((p.pillS-age)/(p.pillS*.2)):doseCurve(age,p.pillOnset,p.pillS);pill=Math.max(pill,level*gain);}
  if(t.kind==='ketamine'){level=doseCurve(age,p.ketamineOnset,p.ketamineS);ketamine+=level*gain;ketPeak=Math.max(ketPeak,level*gain);}
  if(t.kind==='otfc'){
   if((m.consciousness<M4B.otfcDropConsciousness||m.isUnconscious||m.isDead||m.cardiacArrest)&&t.inMouth){t.inMouth=false;t.stopReason='의식 저하 · 자동 중단';t.automaticStopAtS=bridge.time;}
   let absorbed=0;if(t.inMouth){absorbed=Math.min(1-t.absorbed,dt/p.dissolveS);t.absorbed=Math.min(1,t.absorbed+absorbed);if(t.absorbed>=1-1e-10){t.absorbed=1;t.inMouth=false;t.stopReason='모두 녹음';}}
   // Two compartments; stopping the mouth stops input immediately, not elimination.
   t.pool=(t.pool+absorbed)*Math.exp(-dt/(p.otfcS*.45));const since=bridge.time-t.firstAtS;
   if(since>=p.otfcOnset)t.bloodLevel+=(t.pool-t.bloodLevel)*(1-Math.exp(-dt/Math.max(3,p.otfcOnset*.5)));
   const inv=inventories.get(m),item=inv?.items.get(t.itemInstanceId);if(item){item.remainingFraction=1-t.absorbed;if(t.absorbed>=1){item.remaining=0;inv.items.delete(item.instanceId);inv.changed();}}
   t.level=level=clamp(t.bloodLevel);otfc+=level*gain;
  }
  curves.push({id:t.id,kind:t.kind,ageS:age,level,gain,absorbed:t.absorbed??null,inMouth:t.inMouth??false,earlyRepeat:t.earlyRepeat||false});
 }
 const shock=clamp(Math.max((1-m.bloodMl/m.bloodMax)/.4,(70-(m.hemodynamics?.map??95))/40)),e=M4B.effects;
 Object.assign(state,{timeS:bridge.time,analgesia:clamp(pill*M4B.analgesia.pill+otfc*M4B.analgesia.otfc+(ketPeak+.25*(ketamine-ketPeak))*M4B.analgesia.ketamine,0,100),otfc,ketamine,shockMultiplier:1+shock*e.shockAmplification,drowsy:clamp(otfc*e.otfcDrowsy*(1+shock*e.shockAmplification)+ketamine*e.ketamineDrowsy,0,45),respiration:clamp(otfc*e.otfcRespiration*(1+shock*e.shockAmplification),0,.45),curves});
 bridge.actor.analgesiaLevel=state.analgesia;bridge.actor.painkillerActive=state.analgesia>0;
}
// Install on the 3D slot seam, after S3. No dose => original calls and bytes.
export function createDrugSlots(original){return{
 updateHemodynamics(unit,dt){const d=drugState(unit.medical);if(d?.respiration>0)unit.medical.breathingEfficiency=Math.min(unit.medical.breathingEfficiency,100*(1-d.respiration));return original.updateHemodynamics(unit,dt);},
 updatePainShockConsciousness(unit,dt){const m=unit.medical,d=drugState(m);if(!d)return original.updatePainShockConsciousness(unit,dt);
  if(d.consciousOffset)m.consciousness=clamp(m.consciousness+d.consciousOffset,0,100);original.updatePainShockConsciousness(unit,dt);const before=m.consciousness;if(!m.cardiacArrest&&!m.isDead)m.consciousness=clamp(before-d.drowsy,0,100);d.consciousOffset=before-m.consciousness;m.isUnconscious=m.cardiacArrest||m.isDead||m.consciousness<20;
 }
};}
export const drugSympathetic=m=>Math.min(.16,(drugState(m)?.ketamine||0)*M4B.effects.ketamineSympathetic);
export function drugPresentation(m,time){const d=drugState(m);if(!d)return null;const k=Math.min(1.5,d.ketamine),o=Math.min(1,d.otfc);return{drugDoubleCssPx:k*M4B.effects.ketamineDoubleCssPx,drugDizzyCssPx:[Math.sin(time*.7)*k*M4B.effects.ketamineDizzyCssPx,Math.cos(time*.51)*k],drugColor:k*M4B.effects.ketamineColor,drugBlur:o*.2,drugAudioRate:1-(1-M4B.effects.ketamineAudioRate)*Math.min(1,k)};}
export const drugSnapshot=m=>drugState(m)?structuredClone(drugState(m)):null;

export function careSafetyAfter(bridge){const m=bridge.actor.medical;for(const t of treatments(m)){if(t.kind==='otfc'&&t.inMouth&&(m.consciousness<M4B.otfcDropConsciousness||m.isUnconscious||m.isDead||m.cardiacArrest)){t.inMouth=false;t.stopReason='의식 저하 · 자동 중단';t.automaticStopAtS=bridge.time;}if(t.kind==='blood'&&t.connected&&(m.isUnconscious||m.isDead||m.cardiacArrest||((m.isDowned||bridge.careRagdoll)&&!t.downAtConnection))){t.connected=false;t.disconnectedReason='쓰러짐 · 연결 빠짐';}}}
