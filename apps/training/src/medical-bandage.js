// Treatment 1 only. Game tuning; no projectile, anatomy or injury calculation here.
export const BANDAGE=Object.freeze({ruleId:'medical-overhaul-bandage-1',seconds:4,capacity:100,efficiency:1,
  baseWork:8,hpDamageWork:.6,openingAreaWork:.8,maxWork:400,
  recoveryHpPerS:3,recoveryMinimumHpPerS:.2,
  classification:'사용자 설계: 고정 시간·완료 시 소비·부분 지혈·점진 회복; 모든 수치는 게임 튜닝'});
export const isNewBandage=t=>t?.ruleId===BANDAGE.ruleId;
export function initBandageResource(item){
  if(item.resourceRuleId===BANDAGE.ruleId)return;
  item.resourceRuleId=BANDAGE.ruleId;item.remaining=BANDAGE.capacity;item.maximumUses=BANDAGE.capacity;
}
export function bandageProgress(w){const p=w?.bandageRepair;return p?Math.min(1,p.workDone/p.requiredWork):0;}
export function bandageRequiredWork(m,w){
  if(w.bandageRepair)return w.bandageRepair.requiredWork;
  const damage=Math.max(0,w.bodyHpDamage?.appliedDamage??w.bodyHpDamage?.damage??w.traumaDamage??0);
  let area=0;for(const s of m.bleedSources||[]){
    if(s.destination!=='external'&&s.destination!=='limb_compartment')continue;
    for(const l of s.lesions||[])if(l.woundId===w.id)area+=Math.max(0,l.baseAreaMm2||0);
  }
  return Math.min(BANDAGE.maxWork,BANDAGE.baseWork+damage*BANDAGE.hpDamageWork+area*BANDAGE.openingAreaWork);
}
export const bandageRemainingWork=(m,w)=>Math.max(0,bandageRequiredWork(m,w)-(w.bandageRepair?.workDone||0));
export function bandageTiming(m){
  if(m.isUnconscious||m.isDead||m.cardiacArrest)return{allowed:false,reason:'의식이 없어 자가 처치할 수 없습니다.'};
  const hands=['leftArm','rightArm'].filter(k=>!m.bodyParts[k].s2Comminuted&&!m.bodyParts[k].s2Amputated&&!m.bodyParts[k].amputated).length;
  if(!hands)return{allowed:false,reason:'사용 가능한 손이 없습니다.'};
  return{allowed:true,hands,multiplier:1,baseSeconds:BANDAGE.seconds,estimatedSeconds:BANDAGE.seconds,classification:BANDAGE.classification};
}
// Inventory owns the sole resource amount in item.remaining. The reservation
// contains only an action ID; no cloned stock balance can refill this product.
export function medicalReserved(inv,id){
  for(const [itemId,t] of inv.medicalReservations||[]){
    if(t.status!=='active'){inv.medicalReservations.delete(itemId);continue;}
    let item=inv.items.get(itemId);const seen=new Set();
    while(item&&!seen.has(item.instanceId)){if(item.instanceId===id)return true;seen.add(item.instanceId);item=item.owner?.startsWith('container:')?inv.items.get(item.owner.slice(10)):null;}
  }
  return false;
}
export function commitBandage(m,w,item,time){
  const requiredWork=bandageRequiredWork(m,w),need=bandageRemainingWork(m,w),used=Math.min(item.remaining,need/BANDAGE.efficiency);
  if(!(used>0))return{used:0,progress:bandageProgress(w)};
  item.remaining-=used;if(item.remaining<1e-9)item.remaining=0;
  const state=w.bandageRepair??={ruleId:BANDAGE.ruleId,requiredWork,workDone:0};
  state.workDone=Math.min(requiredWork,state.workDone+used*BANDAGE.efficiency);state.lastAppliedAtS=time;
  return{used,progress:bandageProgress(w)};
}
