import{referenceFlow}from'./medical-reference-flow.js';
import{MO2,GAUZE_KINDS,productRule,TEMPORARY_CARE}from'./medical-mo2-policy.js';
import{careTiming,treatments,activeTreatment,careTime}from'./medical-care-state.js';
import{bandageActive,gauzeComplete,remainingWork,ensureWoundWork,applyGauze}from'./medical-hemostasis.js';
import{tourniquetOn}from'./medical-tourniquet.js';
import{medicalReserved,releaseMedicalReservation}from'./medical-reservations.js';
import{startPartRecovery}from'./medical-part-recovery.js';
import{medicalSurfaces}from'./medical-surface.js';
import{bindCareInventory,finishDrugOrBlood,stopMouth,disconnectBlood,drugSnapshot}from'./medical-care-drugs.js';
import{M4B_KINDS}from'./medical-care-m4b-policy.js';
import{chestOpenings,chestSides,finishNeedle}from'./medical-care-chest.js';
export{CARE,careTiming,treatments,activeTreatment}from'./medical-care-state.js';
const modern=kind=>['bandage','cat',...GAUZE_KINDS].includes(kind);
export class SelfCare{
 constructor({inventory,getMedical,getFeedback=()=>({}),onStart=()=>{},onChange=()=>{},notify=()=>{}}){Object.assign(this,{inventory,getMedical,getFeedback,onStart,onChange,notify});this.serial=0;this.lastError='';}
 get m(){const m=this.getMedical().actor.medical;if(this.boundMedical&&this.boundMedical!==m)for(const t of this.boundMedical.appliedTreatments||[])releaseMedicalReservation(this.inventory,t);this.boundMedical=m;bindCareInventory(m,this.inventory);return m;}
 get active(){return activeTreatment(this.m);}get list(){return treatments(this.m);}
 get needsSimulation(){return!!this.active||this.list.some(t=>t.status==='completed')||Object.values(this.m.partRecovery||{}).some(r=>r.active);}
 fail(message){this.lastError=message;this.notify(message);return false;}
 preview(itemId,target={}){
  const inv=this.inventory,item=inv.items.get(itemId),m=this.m;
  if(!item||item.kind!=='medicalSupply'||item.definitionId==='npa')return{allowed:false,reason:'이 물품의 처치는 후속 단계입니다.'};
  if(!inv.reachableMedical(item)||!(item.remaining>0))return{allowed:false,reason:'접근 가능한 내 의료 물품을 선택하세요.'};
  if(this.active||inv.action)return{allowed:false,reason:'진행 중인 동작을 먼저 마치세요.'};
  if(medicalReserved(inv,itemId))return{allowed:false,reason:'다른 처치가 예약한 물품입니다.'};
  const kind=item.definitionId,w=target.woundId?m.wounds.find(w=>w.id===target.woundId):null,partKey=w?.partKey||target.partKey,timing=careTiming(m,kind);if(!timing.allowed)return timing;
  if(kind==='cat'){
   if(!/(Arm|Leg)$/.test(partKey||''))return{allowed:false,reason:'지혈대는 팔·다리에만 사용할 수 있습니다.'};
   if(tourniquetOn(m,partKey))return{allowed:false,reason:'한 사지에는 지혈대 하나만 장착합니다.'};
   return{allowed:true,kind,partKey,timing,target:{kind:'limb',partKey}};
  }
  if(kind==='bandage'||GAUZE_KINDS.includes(kind)){
   if(!w)return{allowed:false,reason:'상처 하나를 선택하세요.'};
   const linked=(m.bleedSources||[]).filter(s=>s.woundIds.includes(w.id)),surface=medicalSurfaces(this.getMedical()).find(s=>s.woundId===w.id);
   if(kind==='bandage'){
    if(bandageActive(w))return{allowed:false,reason:'이 상처에는 이미 붕대를 감았습니다.'};
    if(w.care?.components?.some(c=>c.workDone>0)&&!gauzeComplete(w))return{allowed:false,reason:'거즈류 처치를 완료한 뒤 붕대로 마무리하세요.'};
    if(!gauzeComplete(w)&&linked.length&&!surface?.entry)return{allowed:false,reason:'확인된 피부 입구가 필요합니다.'};
    if(!gauzeComplete(w)&&linked.length&&!linked.some(s=>s.destination==='external'||s.destination==='limb_compartment'||s.injuryType==='ooze'&&s.ooze.external>0))return{allowed:false,reason:'체강 출혈에는 붕대를 사용할 수 없습니다.'};
   }else{
    if(bandageActive(w))return{allowed:false,reason:'붕대를 먼저 풀어야 거즈류를 사용할 수 있습니다.'};
    if(kind==='gauze'&&partKey==='head')return{allowed:false,reason:'이 거즈는 팔다리·목·몸통 겉에 사용합니다.'};
    if(kind==='gauze'&&linked.length&&!surface?.entry)return{allowed:false,reason:'거즈를 넣을 피부 입구가 확인되지 않았습니다.'};
    if(remainingWork(m,w,kind)<=1e-9)return{allowed:false,reason:'이 제품의 범위에는 남은 처치 필요량이 없습니다. 체강에는 주입기·폼을 사용하세요.'};
   }
   return{allowed:true,kind,partKey,timing,target:{kind:'wound',partKey,woundId:w.id},grade:referenceFlow(w).total>MO2.bandageQ?'과다출혈':'일반 출혈'};
  }
  if(kind==='seal'){
   if(!w?.chestTraumaModel?.openChestWound)return{allowed:false,reason:'열린 가슴 상처를 선택하세요.'};const holes=chestSides(w).flatMap(side=>chestOpenings(this.getMedical(),side)).filter(h=>h.woundId===w.id);
   if(!target.hole)return{allowed:true,needsHole:true,kind,partKey,timing,holes};const hole=holes.find(h=>h.hole===target.hole&&(!target.side||h.side===target.side));if(!hole)return{allowed:false,reason:'확인된 구멍이 아닙니다.'};
   if(this.list.some(t=>t.kind==='seal'&&t.status==='completed'&&t.target.woundId===w.id&&t.target.hole===hole.hole))return{allowed:false,reason:'이미 씰을 붙인 구멍입니다.'};
   if(hole.face==='back'){timing.baseSeconds*=TEMPORARY_CARE.backSealMultiplier;timing.estimatedSeconds=timing.baseSeconds;}
   return{allowed:true,kind,partKey,timing,target:{kind:'hole',partKey,woundId:w.id,...hole,sideOpenings:holes}};
  }
  if(kind==='needle'){
   if(partKey!=='chest')return{allowed:false,reason:'가슴을 선택하세요.'};if(!['left','right'].includes(target.side))return{allowed:true,needsSide:true,kind,partKey,timing};if(!['anterior','lateral'].includes(target.site))return{allowed:true,needsNeedlePosition:true,kind,partKey,timing,side:target.side};
   return{allowed:true,kind,partKey,timing,target:{kind:'chest',partKey,side:target.side,site:target.site}};
  }
  if(kind==='txa'&&this.list.some(t=>t.kind==='txa'))return{allowed:false,reason:'이미 사용한 TXA입니다.'};
  if(kind==='otfc'&&this.list.some(t=>t.kind==='otfc'&&(t.inMouth||t.itemInstanceId===itemId)))return{allowed:false,reason:'기존 OTFC의 다시 물기를 사용하세요.'};
  if(kind==='blood'&&this.list.some(t=>t.kind==='blood'&&(t.connected||t.status==='active')))return{allowed:false,reason:'이미 수혈을 연결하고 있습니다.'};
  return{allowed:true,kind,partKey:partKey||'abdomen',timing,target:{kind:'systemic',partKey:partKey||'abdomen'}};
 }
 request(itemId,target){
  const p=this.preview(itemId,target);if(!p.allowed)return this.fail(p.reason);if(p.needsHole||p.needsSide||p.needsNeedlePosition)return this.fail('처치 위치를 선택하세요.');
  const inv=this.inventory,item=inv.items.get(itemId),id='care-'+(++this.serial)+'-'+itemId,t={id,kind:p.kind,ruleId:MO2.ruleId,itemInstanceId:itemId,target:p.target,status:'active',stage:'applying',workS:0,progress:0,startedAtS:this.getMedical().time,appliedAtS:null,timing:p.timing,duration:p.timing.estimatedSeconds,remainingSeconds:p.timing.estimatedSeconds,weaponAtStart:inv.primaryId,originalOwner:item.owner,originalCell:{...item.cell},backpackAccessRemainingS:inv.includeEquipment&&inv.rootOwner(item)==='bag'&&!inv.backpackOpen?TEMPORARY_CARE.backpackSeconds:0};t.remainingSeconds+=t.backpackAccessRemainingS;
  if(modern(t.kind)){inv.medicalReservations.set(itemId,t);t.reservedRemaining=item.remaining;if(GAUZE_KINDS.includes(t.kind))ensureWoundWork(this.m,this.m.wounds.find(w=>w.id===p.target.woundId));}
  else if(t.kind==='otfc'){item.owner='treatment:'+id;delete item.cell;}
  else{item.remaining--;t.consumedAtStart=true;if(!item.remaining)inv.items.delete(itemId);}
  (this.m.appliedTreatments??=[]).push(t);inv.changed();this.lastError='';this.onStart(t);this.onChange();return true;
 }
 interrupt(reason='취소'){const t=this.active;if(!t)return false;t.status='interrupted';t.interruptionReason=reason;t.interruptedAtS=this.getMedical().time;releaseMedicalReservation(this.inventory,t);this.onChange();return true;}
 resume(id){
  if(this.active||this.inventory.action)return this.fail('진행 중인 처치를 먼저 마치세요.');const t=this.list.find(t=>t.id===id);if(!t||t.status!=='interrupted')return this.fail('중단된 처치가 아닙니다.');
  if(['unwrap','cat-remove'].includes(t.kind))return this.fail('제거 동작을 다시 선택하세요.');
  if(modern(t.kind)){
   const p=this.preview(t.itemInstanceId,t.target);if(!p.allowed)return this.fail(p.reason);const item=this.inventory.items.get(t.itemInstanceId);t.workS=t.progress=0;t.duration=p.timing.estimatedSeconds;t.timing=p.timing;t.reservedRemaining=item.remaining;t.originalOwner=item.owner;this.inventory.medicalReservations.set(item.instanceId,t);
  }else if(!careTiming(this.m,t.kind).allowed)return this.fail('현재 자가 처치를 할 수 없습니다.');
  t.status='active';t.startedAtS=this.getMedical().time;t.remainingSeconds=t.duration-t.workS;t.weaponAtStart=this.inventory.primaryId;this.onStart(t);this.onChange();return true;
 }
 unwrap(woundId){
  if(this.active||this.inventory.action)return this.fail('진행 중인 처치를 먼저 마치세요.');const w=this.m.wounds.find(w=>w.id===woundId);if(!w||!bandageActive(w))return this.fail('풀 붕대가 없습니다.');if(!careTiming(this.m,'bandage').allowed)return this.fail('현재 자가 처치를 할 수 없습니다.');
  const t={id:'care-'+(++this.serial)+'-unwrap',kind:'unwrap',ruleId:MO2.ruleId,status:'active',stage:'applying',target:{partKey:w.partKey,woundId},originalBandageId:w.care.bandage.recordId,workS:0,progress:0,duration:MO2.unwrapSeconds,remainingSeconds:MO2.unwrapSeconds,startedAtS:this.getMedical().time,weaponAtStart:this.inventory.primaryId};this.m.appliedTreatments.push(t);this.onStart(t);this.onChange();return true;
 }
 returnPlace(t){const inv=this.inventory,item=inv.items.get(t.itemInstanceId);if(!item)return null;for(const owner of [t.originalOwner,'bag']){if(owner==='bag'&&inv.includeEquipment&&!inv.backpackOpen)continue;if(owner!=='bag'&&!inv.canAccess(owner))continue;const cell=inv.canPlace(owner,item,t.originalCell)?t.originalCell:inv.findCell(owner,item);if(cell)return{owner,cell};}return null;}
 remove(id){
  const t=this.list.find(t=>t.id===id);if(!t)return false;
  if(t.status==='active')return this.interrupt('기록 닫기');
  if(t.status==='interrupted'){releaseMedicalReservation(this.inventory,t);t.status='removed';this.onChange();return true;}
  if(t.kind==='cat'){
   if(this.active||this.inventory.action)return this.fail('진행 중인 처치를 먼저 마치세요.');if(!careTiming(this.m,'cat').allowed)return this.fail('현재 자가 처치를 할 수 없습니다.');if(!this.returnPlace(t))return this.fail('회수할 빈칸이 없습니다. 지혈대를 유지합니다.');
   const a={id:'care-'+(++this.serial)+'-cat-remove',kind:'cat-remove',ruleId:MO2.ruleId,itemInstanceId:t.itemInstanceId,priorId:t.id,target:{...t.target},status:'active',stage:'applying',workS:0,progress:0,duration:MO2.products.cat.removeSeconds,remainingSeconds:MO2.products.cat.removeSeconds,startedAtS:this.getMedical().time,weaponAtStart:this.inventory.primaryId};this.inventory.medicalReservations.set(a.itemInstanceId,a);this.m.appliedTreatments.push(a);this.onStart(a);this.onChange();return true;
  }
  if(t.kind==='bandage')return this.unwrap(t.target.woundId);
  if(GAUZE_KINDS.includes(t.kind)||['txa',...M4B_KINDS].includes(t.kind))return this.fail('완료된 처치 진행은 되돌릴 수 없습니다.');
  t.status='removed';this.onChange();return true;
 }
 step(dt){
  const t=this.active;if(!t)return;const inv=this.inventory,m=this.m,w=t.target.woundId?m.wounds.find(w=>w.id===t.target.woundId):null,item=inv.items.get(t.itemInstanceId);
  if(inv.action||inv.primaryId!==t.weaponAtStart)return this.interrupt('총기 동작');if(!careTiming(m,modern(t.kind)?t.kind:'bandage').allowed)return this.interrupt('사용 불가 상태');
  if(t.target.woundId&&!w)return this.interrupt('대상 상처 없음');
  if(modern(t.kind)&&(inv.medicalReservations.get(t.itemInstanceId)!==t||!item||item.remaining!==t.reservedRemaining||item.owner!==t.originalOwner||!inv.reachableMedical(item)))return this.interrupt('예약 물품을 사용할 수 없습니다.');
  if(t.kind==='cat-remove'&&(!item||inv.medicalReservations.get(t.itemInstanceId)!==t||item.owner!=='treatment:'+t.priorId))return this.interrupt('지혈대 소유 상태가 바뀌었습니다.');
  if(t.kind==='unwrap'&&(!bandageActive(w)||w.care.bandage.recordId!==t.originalBandageId))return this.interrupt('붕대 상태가 바뀌었습니다.');
  let accessSpent=0;if(t.backpackAccessRemainingS>0){const access=Math.min(Math.max(0,dt),t.backpackAccessRemainingS);t.backpackAccessRemainingS=Math.max(0,t.backpackAccessRemainingS-access);dt-=access;accessSpent=access;if(t.backpackAccessRemainingS<=1e-9){t.backpackAccessRemainingS=0;inv.backpackOpen=true;inv.changed();}t.remainingSeconds=t.duration-t.workS+t.backpackAccessRemainingS;if(dt<=0)return;}
  const advance=Math.max(0,Math.min(dt,t.duration-t.workS));t.workS+=advance;if(t.workS>=t.duration-1e-9)t.workS=t.duration;t.progress=t.workS/t.duration;t.remainingSeconds=t.duration-t.workS;if(t.workS<t.duration)return;
  const time=this.getMedical().time+accessSpent+advance;
  if(t.kind==='cat-remove'){
   const old=this.list.find(x=>x.id===t.priorId),dest=old&&this.returnPlace(old);if(!old||!dest)return this.interrupt('회수 공간이 없어 지혈대를 유지합니다.');item.owner=dest.owner;item.cell={...dest.cell};old.status='removed';old.removedAtS=time;
  }else if(t.kind==='unwrap'){
   w.care.bandage.active=false;w.care.unwrappedFraction=w.care.bandage.finishing?0:Math.min(1,MO2.bandageQ/Math.max(1e-30,referenceFlow(w).external))*MO2.unwrapRetainedBlock;const old=this.list.find(x=>x.id===t.originalBandageId);if(old){old.status='removed';old.removedAtS=time;}
  }else if(t.kind==='cat'){
   if(tourniquetOn(m,t.target.partKey))return this.interrupt('이미 지혈대가 장착돼 있습니다.');item.owner='treatment:'+t.id;delete item.cell;t.consumedUnits=0;
  }else if(t.kind==='bandage'){
   if(bandageActive(w)){t.consumedUnits=0;}else{item.remaining--;t.consumedUnits=1;w.care??={ruleId:MO2.ruleId};w.care.bandage={active:true,finishing:gauzeComplete(w),appliedAtS:time,recordId:t.id};w.care.unwrappedFraction=0;if(gauzeComplete(w))w.care.seepUntilS=0;}
  }else if(GAUZE_KINDS.includes(t.kind)){
   if(bandageActive(w))return this.interrupt('붕대를 먼저 풀어야 합니다.');t.consumedUnits=applyGauze(m,w,item,time);
  }else if(M4B_KINDS.includes(t.kind))finishDrugOrBlood(this.getMedical(),t,inv);
  else if(t.kind==='needle')finishNeedle(this.getMedical(),t);
  else if(t.kind==='txa'){const first=Math.min(...m.wounds.map(w=>w.createdAt??w.time??w.trainingMetadata?.time??this.getMedical().time));t.effectEligible=Number.isFinite(first)&&this.getMedical().time-first<=TEMPORARY_CARE.txaWindowS;}
  t.status='completed';t.stage='completed';t.appliedAtS=time;t.remainingSeconds=0;releaseMedicalReservation(inv,t);
  if(item&&item.remaining<=0)inv.items.delete(item.instanceId);if(w)startPartRecovery(m,w.partKey,time);inv.changed();this.onChange();
 }
 stopOTFC(){const ok=stopMouth(this.m);this.onChange();return ok;}
 disconnectBlood(){const ok=disconnectBlood(this.m);this.onChange();return ok;}
 reconnect(id){const t=this.list.find(t=>t.id===id);if(!t||!['otfc','blood'].includes(t.kind)||t.status!=='completed'||this.active||this.inventory.action)return this.fail('다시 연결할 처치를 선택하세요.');if(!careTiming(this.m,t.kind).allowed)return this.fail('현재 자가 처치를 할 수 없습니다.');if(t.kind==='otfc'&&(t.absorbed>=1||this.list.some(x=>x.kind==='otfc'&&x.inMouth)))return this.fail('사용 가능한 OTFC가 없습니다.');if(t.kind==='blood'&&(t.remainingMl<=0||this.list.some(x=>x.kind==='blood'&&x.connected)))return this.fail('수혈 팩을 연결할 수 없습니다.');t.workS=t.progress=0;t.status='active';t.remainingSeconds=t.duration;t.weaponAtStart=this.inventory.primaryId;this.onStart(t);this.onChange();return true;}
 snapshot(){return{ruleId:MO2.ruleId,activeId:this.active?.id||null,treatments:structuredClone(this.list),drugs:drugSnapshot(this.m),lastError:this.lastError};}
}
