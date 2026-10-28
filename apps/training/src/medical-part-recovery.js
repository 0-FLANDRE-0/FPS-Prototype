import{infectionModifiers}from'./medical-infection.js';
import{bleedingWounds}from'./medical-bleeding-wounds.js';
import{MO2}from'./medical-mo2-policy.js';
import{woundComplete,woundFlow}from'./medical-hemostasis.js';
import{tourniquetOn}from'./medical-tourniquet.js';
export function startPartRecovery(m,partKey,time){
 const p=m.bodyParts[partKey];if(!p||p.hp<=0||p.s2Amputated||p.amputated)return;
 const states=m.partRecovery??={};states[partKey]??={ruleId:MO2.ruleId,active:false,startedAtS:time,lastHp:p.hp,recoveredHp:0,reason:'모든 상처 처치 대기'};
}
// Called after the current tick's bleeding allocation, before ordinary part
// function/summary recomputation. No care => no state additions or arithmetic.
export function stepPartRecovery(unit,dt,time){
 const m=unit.medical;if(!m.partRecovery&&!bleedingWounds(m).some(w=>w.care))return;
 for(const w of bleedingWounds(m))if(w.care)startPartRecovery(m,w.partKey,time);
 for(const[key,r]of Object.entries(m.partRecovery||{})){
  const p=m.bodyParts[key],wounds=bleedingWounds(m).filter(w=>w.partKey===key),ready=!(unit.isDead||m.isDead||m.cardiacArrest||m.isUnconscious||p.hp<=0||p.s2Amputated||p.amputated)&&!tourniquetOn(m,key)&&wounds.every(w=>woundComplete(m,w));
  if(!ready){r.active=false;r.reason=tourniquetOn(m,key)?'지혈대 착용':wounds.some(w=>woundFlow(m,w).status==='샘')?'샘':wounds.some(w=>w.care?.reopened)?'재출혈':'모든 상처 처치 대기';r.lastHp=p.hp;continue;}
  if(p.hp>=p.maxHp){r.active=false;r.reason='회복 완료';r.lastHp=p.hp;continue;}
  if(!r.active){r.active=true;r.startedAtS=time;r.reason=null;}
  const elapsed=Math.max(0,time-Math.max(time-dt,r.startedAtS)),missing=p.maxHp-p.hp,gain=Math.min(missing,elapsed*Math.max(MO2.recoveryMinimumHpPerS,MO2.recoveryHpPerS*missing/Math.max(1,p.maxHp))*infectionModifiers(m).recoveryFactor);
  p.hp=gain>=missing?p.maxHp:p.hp+gain;r.lastHp=p.hp;r.recoveredHp+=gain;
  if(p.hp===p.maxHp){r.active=false;r.completedAtS=time;r.reason='회복 완료';}
 }
}
