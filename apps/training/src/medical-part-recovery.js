import {BANDAGE} from './medical-bandage.js';
export function startPartRecovery(m,partKey,time){
  const p=m.bodyParts[partKey];if(!p||p.hp<=0||p.s2Amputated||p.amputated)return;
  const states=m.partRecovery??={};
  states[partKey]={ruleId:BANDAGE.ruleId,active:true,startedAtS:time,lastHp:p.hp,
    woundCount:m.wounds.filter(w=>w.partKey===partKey).length,recoveredHp:0,reason:null};
}
export function stepPartRecovery(unit,dt,time){
  const m=unit.medical;if(!m.partRecovery||unit.isDead||m.isDead||m.cardiacArrest||m.isUnconscious)return;
  for(const [key,r] of Object.entries(m.partRecovery)){
    if(!r.active)continue;const p=m.bodyParts[key];
    if(p.hp<=0||p.s2Amputated||p.amputated){r.active=false;r.reason='구조 복구 필요';continue;}
    if(m.wounds.filter(w=>w.partKey===key).length!==r.woundCount||p.hp<r.lastHp-1e-9){r.active=false;r.reason='새 피격';continue;}
    const elapsed=Math.max(0,time-Math.max(time-dt,r.startedAtS)),missing=Math.max(0,p.maxHp-p.hp);
    const gain=Math.min(missing,elapsed*Math.max(BANDAGE.recoveryMinimumHpPerS,BANDAGE.recoveryHpPerS*missing/Math.max(1,p.maxHp)));
    p.hp=gain>=missing?p.maxHp:p.hp+gain;r.lastHp=p.hp;r.recoveredHp+=gain;
    if(p.hp===p.maxHp){r.active=false;r.completedAtS=time;r.reason='회복 완료';}
  }
}
