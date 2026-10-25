import{BANDAGE,isNewBandage,bandageTiming,bandageRemainingWork,commitBandage,medicalReserved}from'./medical-bandage.js';
import{startPartRecovery}from'./medical-part-recovery.js';
import{M4C,advanceGauze,careRemainingSeconds}from'./medical-care-m4c-policy.js';
import{M4B,M4B_KINDS}from'./medical-care-m4b-policy.js';
import{bindCareInventory,finishDrugOrBlood,stopMouth,disconnectBlood,drugSnapshot}from'./medical-care-drugs.js';
import{careProfile,careDuration,validCareMode,consumeMedicalUse,M4_VALUES,syncMedicalUses}from'./medical-care-modes.js';
import{chestOpenings,chestSides,needleSite,finishNeedle}from'./medical-care-chest.js';
import{CARE,careTiming,limbChain,limbPointAtDistance,regionPosition,treatments,activeTreatment}from'./medical-care-state.js';
import{medicalSurfaces}from'./medical-surface.js';
import{MEDICAL_SUPPLIES}from'./medical-supplies.js';
export{CARE,careTiming,treatments,activeTreatment}from'./medical-care-state.js';
export class SelfCare{
 constructor({inventory,getMedical,getFeedback=()=>({}),getMode=()=>inventory.treatmentMode||'reality',onStart=()=>{},onChange=()=>{},notify=()=>{}}){Object.assign(this,{inventory,getMedical,getFeedback,getMode,onStart,onChange,notify});this.serial=0;this.lastError='';}
 get m(){const m=this.getMedical().actor.medical;if(this.boundMedical&&this.boundMedical!==m)for(const t of this.boundMedical.appliedTreatments||[])if(this.inventory.medicalReservations?.get(t.itemInstanceId)===t)this.inventory.medicalReservations.delete(t.itemInstanceId);this.boundMedical=m;bindCareInventory(m,this.inventory);return m;}
 get mode(){return validCareMode(this.getMode());}
 setMode(mode){syncMedicalUses(this.inventory,mode);this.onChange();}
 get needsSimulation(){return!!this.active||(!this.m.isDead&&!this.m.isUnconscious&&!this.m.cardiacArrest&&Object.values(this.m.partRecovery||{}).some(r=>r.active))||this.list.some(t=>['txa','foam','seal','needle',...M4B_KINDS].includes(t.kind));}
 get active(){return activeTreatment(this.m);}
 get list(){return treatments(this.m);}
 fail(message){this.lastError=message;this.notify(message);return false;}
 preview(itemId,target){
  const inv=this.inventory,item=inv.items.get(itemId),m=this.m;if(item?.kind!=='medicalSupply'||!['cat','bandage','gauze','seal','needle','txa','foam',...M4B_KINDS].includes(item.definitionId))return{allowed:false,reason:'기도 처치는 후속 M5에서 지원합니다.'};
  if(!inv.reachableMedical(item)||item.remaining<=0)return{allowed:false,reason:'내 가방이나 열린 IFAK의 새 물품을 선택하세요.'};if(inv.action)return{allowed:false,reason:'총기 동작을 마치거나 취소하세요.'};if(this.active)return{allowed:false,reason:'한 번에 처치 하나만 할 수 있습니다.'};
  if(medicalReserved(inv,itemId))return{allowed:false,reason:'이미 사용 중인 물품입니다.'};
  const kind=item.definitionId,wound=target?.woundId?m.wounds.find(w=>w.id===target.woundId):null,partKey=wound?.partKey||target?.partKey,timing=kind==='bandage'?bandageTiming(m):careTiming(m,kind,partKey,this.getFeedback(),this.mode);if(!timing.allowed)return timing;
  if(M4B_KINDS.includes(kind)){
   if(kind==='otfc'&&this.list.some(t=>t.kind==='otfc'&&t.inMouth))return{allowed:false,reason:'OTFC는 한 번에 하나만 물 수 있습니다.'};
   if(kind==='otfc'&&this.list.some(t=>t.kind==='otfc'&&t.itemInstanceId===itemId))return{allowed:false,reason:'처치 내역의 다시 물기를 사용하세요.'};
   if(kind==='blood'&&this.list.some(t=>t.kind==='blood'&&(t.connected||t.status==='active')))return{allowed:false,reason:'한 번에 수혈 하나만 연결할 수 있습니다.'};
   return{allowed:true,kind,partKey:partKey||'abdomen',timing,target:{kind:'systemic',partKey:partKey||'abdomen'}};
  }
  if(kind==='txa'||kind==='foam'){
   if(this.list.some(t=>t.kind===kind))return{allowed:false,reason:'이 환자에게 이미 사용한 1회용 처치입니다.'};
   if(kind==='foam'&&partKey!=='abdomen')return{allowed:false,reason:'복부 폼은 복부에만 사용합니다.'};
   return{allowed:true,kind,partKey:kind==='foam'?'abdomen':partKey||'abdomen',timing,target:{kind:'systemic',partKey:kind==='foam'?'abdomen':partKey||'abdomen'}};
  }
  if(kind==='seal'){
   if(!wound?.chestTraumaModel?.openChestWound)return{allowed:false,reason:'열린 가슴 상처의 피부 구멍을 선택하세요.'};
   const possibilities=chestSides(wound).flatMap(side=>chestOpenings(this.getMedical(),side)),hole=target.hole,side=target.side||(hole?possibilities.find(h=>h.woundId===wound.id&&h.hole===hole)?.side:null)||chestSides(wound)[0],openings=chestOpenings(this.getMedical(),side);
   if(!hole)return{allowed:true,needsHole:true,kind,partKey,timing,holes:possibilities.filter(h=>h.woundId===wound.id),side};
   const opening=openings.find(h=>h.woundId===wound.id&&h.hole===hole);if(!opening)return{allowed:false,reason:'확인된 피부 구멍이 아닙니다.'};
   if(this.list.some(t=>t.kind==='seal'&&t.target.woundId===wound.id&&t.target.hole===hole))return{allowed:false,reason:'이 구멍에 이미 씰을 사용했습니다.'};
   if(opening.face==='back'&&this.mode!=='game'){const k=this.mode==='reality'?M4B.backSealRealityMultiplier:M4_VALUES.backSealMultiplier;timing.multiplier*=k;timing.estimatedSeconds*=k;}
   return{allowed:true,kind,partKey,timing,target:{kind:'hole',partKey,woundId:wound.id,hole,side,face:opening.face,sideOpenings:openings}};
  }
  if(kind==='needle'){
   if(partKey!=='chest')return{allowed:false,reason:'왼쪽 또는 오른쪽 가슴을 선택하세요.'};
   const side=target.side;if(!['left','right'].includes(side))return{allowed:true,needsSide:true,kind,partKey,timing};
   if(this.mode!=='game'&&!target.site&&!target.point)return{allowed:true,needsNeedlePosition:true,kind,partKey,timing,side};
   const site=this.mode==='game'?'lateral':this.mode==='reality'?needleSite(target.point):['anterior','lateral'].includes(target.site)?target.site:null;
   if(this.mode==='realistic'&&!site)return{allowed:false,reason:'표시된 두 위치 중 하나를 선택하세요.'};
   if(this.mode==='reality'&&(!target.point||![target.point.x,target.point.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1)))return{allowed:false,reason:'가슴 그림 안의 점을 선택하세요.'};
   return{allowed:true,kind,partKey,timing,target:{kind:'chest',partKey,side,site,point:target.point||null}};
  }
  if(kind==='cat'){
   if(!/(Arm|Leg)$/.test(partKey||''))return{allowed:false,reason:'지혈대는 팔다리에만 감을 수 있습니다.'};
   const region=target.region||(partKey.endsWith('Arm')?'upperArm':'upperLeg');if(!regionPosition(partKey,region)||partKey.endsWith('Arm')!==/Arm|forearm/.test(region))return{allowed:false,reason:'해당 팔다리의 위·아래 구역을 선택하세요.'};
   const mode=target.mode||null;if(!mode)return{allowed:true,needsPosition:true,kind,partKey,region,woundId:wound?.id||null,timing};
   if(mode==='above'&&!wound)return{allowed:false,reason:'상처 위 위치는 해당 상처 마커나 상처 행을 먼저 선택하세요.'};
   const skin=medicalSurfaces(this.getMedical()).find(s=>s.woundId===wound?.id),address=wound?.bodyTrajectory?.entryAddress,reference=skin?.entry?.bindActorPoint?{partKey,bindActorPoint:skin.entry.bindActorPoint,bone:address?.bone}:address?{partKey,bone:address.bone,bindActorPoint:address.localPoint}:regionPosition(partKey,region),p=limbChain(reference);
   if(mode!=='high'&&mode!=='above')return{allowed:false,reason:'감는 위치를 선택하세요.'};if(mode==='above'&&!p)return{allowed:false,reason:'상처의 체인 위치를 확인할 수 없습니다.'};
   let pathDistanceM=mode==='high'?.015:Math.max(.015,p.pathDistanceM-CARE.aboveWoundM),chainOrder=mode==='high'?0:p.chainOrder;
   // A second CAT is immediately proximal on the same limb (no world-height test).
   const previous=this.list.filter(t=>t.kind==='cat'&&t.target.partKey===partKey&&Math.abs(t.target.pathDistanceM-pathDistanceM)<.035).at(-1);if(previous)pathDistanceM=Math.max(.005,previous.target.pathDistanceM-.025);
   return{allowed:true,kind,partKey,timing,target:{kind:'limb',partKey,region,mode,woundId:wound?.id||null,pathDistanceM,chainOrder,bindActorPoint:limbPointAtDistance(partKey,pathDistanceM),proximalPoint:regionPosition(partKey,partKey.endsWith('Arm')?'upperArm':'upperLeg'),reference:p,classification:'original bind-chain projection;65mm proximal tuning, not world y'}};
  }
  if(!wound)return{allowed:false,reason:'물품을 사용할 상처 입구나 상처 행을 선택하세요.'};const surface=medicalSurfaces(this.getMedical()).find(s=>s.woundId===wound.id);if(!surface?.entry)return{allowed:false,reason:'밖으로 열린 피부 통로를 확인할 수 없습니다.'};
  const linked=(m.bleedSources||[]).filter(s=>s.woundIds.includes(wound.id)),external=linked.some(s=>s.destination==='external'||s.destination==='limb_compartment'||s.injuryType==='ooze'&&s.ooze.external>0);if(!external)return{allowed:false,reason:'몸통 안 출혈에는 효과 없음. 열린 겉 출혈원이 필요합니다.'};
  if(kind==='bandage'&&bandageRemainingWork(m,wound)<=1e-9)return{allowed:false,reason:'이 상처의 겉 지혈은 완료됐습니다. 다른 상처를 선택하세요.'};
  return{allowed:true,kind,partKey,timing,target:{kind:'wound',partKey,woundId:wound.id}};
 }
 request(itemId,target){
  const p=this.preview(itemId,target);if(!p.allowed)return this.fail(p.reason);if(p.needsPosition||p.needsHole||p.needsSide||p.needsNeedlePosition)return this.fail('처치 위치를 선택하세요.');const inv=this.inventory,item=inv.items.get(itemId),id='care-'+(++this.serial)+'-'+itemId,record={id,kind:p.kind,itemInstanceId:itemId,target:p.target,workS:0,progress:0,status:'active',stage:p.kind==='gauze'?'packing':'applying',startedAtS:this.getMedical().time,appliedAtS:null,interruptedAtS:null,interruptionReason:null,timing:p.timing,setupRemainingS:0,weaponAtStart:inv.primaryId,originalOwner:item.owner,originalCell:{...item.cell},remainingSeconds:p.timing.estimatedSeconds};
  // Validation above has no inventory side effects. Commit ownership and state once.
  if(p.kind!=='bandage'&&inv.includeEquipment&&inv.rootOwner(item)==='bag'&&!inv.backpackOpen){record.backpackAccessRemainingS=inv.backpackSeconds;record.remainingSeconds+=record.backpackAccessRemainingS;}
  if(p.kind!=='bandage'&&(this.mode!=='reality'||!['cat','bandage','gauze'].includes(p.kind)))record.treatmentMode=this.mode;
  if(p.kind==='bandage'){record.ruleId=BANDAGE.ruleId;record.reservedRemaining=item.remaining;record.requiredWork=bandageRemainingWork(this.m,this.m.wounds.find(w=>w.id===p.target.woundId));inv.medicalReservations??=new Map();inv.medicalReservations.set(itemId,record);}
  else if(p.kind==='cat'||p.kind==='otfc'){item.owner='treatment:'+id;delete item.cell;}else if(p.kind!=='otfc')consumeMedicalUse(inv,item);(this.m.appliedTreatments??=[]).push(record);inv.changed();this.lastError='';this.onStart(record);this.onChange();return true;
 }
 interrupt(reason='취소'){const t=this.active;if(!t)return false;t.status='interrupted';t.interruptedAtS=this.getMedical().time;t.interruptionReason=reason;if(isNewBandage(t))this.inventory.medicalReservations?.delete(t.itemInstanceId);this.onChange();return true;}
 resume(id){const candidate=this.list.find(t=>t.id===id);if(isNewBandage(candidate))return this.restartBandage(candidate);const t=this.list.find(t=>t.id===id);if(!t||t.status!=='interrupted')return this.fail('중단된 처치를 선택하세요.');if(this.active||this.inventory.action)return this.fail('진행 중인 동작을 먼저 마치세요.');const timing=careTiming(this.m,t.kind,t.target.partKey,this.getFeedback(),t.treatmentMode||'reality');if(!timing.allowed)return this.fail(timing.reason||'수혈 연결에는 두 손이 필요합니다.');if(t.kind==='seal'&&t.target.face==='back'&&t.treatmentMode!=='game'){const k=t.treatmentMode==='reality'?M4B.backSealRealityMultiplier:M4_VALUES.backSealMultiplier;timing.multiplier*=k;timing.estimatedSeconds*=k;}t.weaponAtStart=this.inventory.primaryId;t.timing=timing;t.setupRemainingS=CARE.resumeSetupSeconds;t.status='active';t.remainingSeconds=(t.kind==='gauze'?careRemainingSeconds(t.workS,careProfile(t.treatmentMode||'reality',CARE),timing.multiplier):(careDuration(t.kind,t.target.partKey,careProfile(t.treatmentMode||'reality',CARE),t.treatmentMode||'reality')-t.workS)*timing.multiplier)+t.setupRemainingS+(t.backpackAccessRemainingS||0);this.onStart(t);this.onChange();return true;}
 remove(id){const t=this.list.find(t=>t.id===id);if(!t)return false;if(isNewBandage(t)){if(t.status==='completed')return this.fail('완료된 지혈 진행은 되돌릴 수 없습니다.');this.inventory.medicalReservations?.delete(t.itemInstanceId);t.status='removed';this.onChange();return true;}const ability=careTiming(this.m,t.kind,t.target.partKey,this.getFeedback(),t.treatmentMode||'reality');if(!ability.allowed)return this.fail(ability.reason);const inv=this.inventory,item=inv.items.get(t.itemInstanceId);if(t.kind==='cat'&&(!item||item.owner!=='treatment:'+t.id))return this.fail('처치 물품의 소유 상태를 확인하세요.');if(['txa','foam',...M4B_KINDS].includes(t.kind)&&t.status==='completed')return this.fail('투여한 약물·폼은 회수하거나 제거할 수 없습니다.');
  if(t.kind==='cat'){
   let owner=t.originalOwner,cell=null;const parent=owner.startsWith('container:')?inv.items.get(owner.slice(10)):null;if(owner==='bag'||parent?.kind==='medicalContainer'&&(inv.includeEquipment?inv.reachableMedical(parent):inv.rootOwner(parent)==='bag'))cell=inv.canPlace(owner,item,t.originalCell)?t.originalCell:inv.findCell(owner,item);if(!cell){owner='bag';cell=inv.findCell(owner,item);}if(!cell)return this.fail('회수할 빈칸이 없습니다. 지혈대를 유지합니다. 가방이나 원래 IFAK에 한 칸을 비우세요.');if(inv.includeEquipment&&owner==='bag'&&!inv.backpackOpen)return this.fail('배낭을 연 뒤 지혈대를 회수하세요.');item.owner=owner;item.cell={...cell};item.remaining=1;
  }
  if(t.kind!=='cat'&&item?.owner==='treatment:'+t.id)inv.items.delete(item.instanceId);
  t.status='removed';t.removedAtS=this.getMedical().time;inv.changed();this.onChange();return true;
 }
 step(dt){const t=this.active;if(!t)return;if(isNewBandage(t))return this.stepBandage(t,dt);if(this.inventory.action||this.inventory.primaryId!==t.weaponAtStart){this.interrupt('총기 동작');return;}const timing=careTiming(this.m,t.kind,t.target.partKey,this.getFeedback(),t.treatmentMode||'reality');if(!timing.allowed){this.interrupt(timing.reason||'수혈 연결에는 두 손이 필요합니다.');return;}let remaining=dt;if(t.backpackAccessRemainingS>0){const d=Math.min(remaining,t.backpackAccessRemainingS);t.backpackAccessRemainingS-=d;remaining-=d;if(t.backpackAccessRemainingS<=1e-9){t.backpackAccessRemainingS=0;this.inventory.backpackOpen=true;this.inventory.changed();}}if(t.setupRemainingS>0){const d=Math.min(remaining,t.setupRemainingS);t.setupRemainingS-=d;remaining-=d;}const mode=t.treatmentMode||'reality',profile=careProfile(mode,CARE),duration=careDuration(t.kind,t.target.partKey,profile,mode);
  if(t.kind==='gauze')advanceGauze(t,remaining,profile,timing.hands);else t.workS=Math.min(duration,t.workS+remaining/t.timing.multiplier);t.progress=t.workS/duration;t.stage=t.kind==='gauze'?(t.workS<profile.gauzePackingSeconds?'packing':'pressing'):'applying';t.remainingSeconds=(t.kind==='gauze'?careRemainingSeconds(t.workS,profile,t.timing.multiplier):(duration-t.workS)*t.timing.multiplier)+t.setupRemainingS+(t.backpackAccessRemainingS||0);
  if(t.progress>=1){t.status='completed';t.stage='completed';t.appliedAtS=this.getMedical().time;t.remainingSeconds=0;if(M4B_KINDS.includes(t.kind))finishDrugOrBlood(this.getMedical(),t,this.inventory);if(t.kind==='needle')finishNeedle(this.getMedical(),t);if(t.kind==='txa'){const first=Math.min(...this.m.wounds.map(w=>w.createdAt??w.time??w.trainingMetadata?.time??this.getMedical().time));t.effectEligible=Number.isFinite(first)&&this.getMedical().time-first<=M4_VALUES.txaWindowS;}this.onChange();}
 }
 restartBandage(t){
  if(t.status!=='interrupted')return this.fail('중단된 붕대를 선택하세요.');
  const p=this.preview(t.itemInstanceId,t.target);if(!p.allowed)return this.fail(p.reason);
  const item=this.inventory.items.get(t.itemInstanceId);Object.assign(t,{workS:0,progress:0,status:'active',stage:'applying',timing:p.timing,startedAtS:this.getMedical().time,remainingSeconds:BANDAGE.seconds,weaponAtStart:this.inventory.primaryId,originalOwner:item.owner,originalCell:{...item.cell},reservedRemaining:item.remaining});
  this.inventory.medicalReservations??=new Map();this.inventory.medicalReservations.set(item.instanceId,t);this.onStart(t);this.onChange();return true;
 }
 stepBandage(t,dt){
  const inv=this.inventory,item=inv.items.get(t.itemInstanceId),w=this.m.wounds.find(w=>w.id===t.target.woundId),ability=bandageTiming(this.m);
  if(inv.action||inv.primaryId!==t.weaponAtStart)return this.interrupt('총기 동작');
  if(!ability.allowed)return this.interrupt(ability.reason);
  if(!w||w.partKey!==t.target.partKey)return this.interrupt('대상 상처 없음');
  if(inv.medicalReservations?.get(t.itemInstanceId)!==t||!item||item.remaining<=0||item.remaining!==t.reservedRemaining||item.owner!==t.originalOwner||!inv.reachableMedical(item))return this.interrupt('예약 물품을 사용할 수 없습니다.');
  const before=t.workS,advance=Math.max(0,Math.min(dt,BANDAGE.seconds-before));t.workS+=advance;if(t.workS>BANDAGE.seconds-1e-9)t.workS=BANDAGE.seconds;t.progress=t.workS/BANDAGE.seconds;t.remainingSeconds=BANDAGE.seconds-t.workS;
  if(t.workS<BANDAGE.seconds)return;
  const time=this.getMedical().time+advance,result=commitBandage(this.m,w,item,time);
  Object.assign(t,{status:'completed',stage:'completed',appliedAtS:time,remainingSeconds:0,consumedUnits:result.used,hemostasisProgress:result.progress});
  inv.medicalReservations.delete(item.instanceId);if(!item.remaining)inv.items.delete(item.instanceId);
  if(result.used>0)startPartRecovery(this.m,w.partKey,time);
  inv.changed();this.onChange();
 }
 stopOTFC(){const ok=stopMouth(this.m);this.onChange();return ok;}
 disconnectBlood(){const ok=disconnectBlood(this.m);this.onChange();return ok;}
 reconnect(id){const t=this.list.find(t=>t.id===id);if(!t||!['otfc','blood'].includes(t.kind)||t.status!=='completed')return this.fail('사용한 OTFC 또는 수혈 팩을 선택하세요.');if(this.active||this.inventory.action)return this.fail('진행 중인 동작을 먼저 마치세요.');if(t.kind==='otfc'&&(t.absorbed>=1||this.list.some(x=>x.kind==='otfc'&&x.inMouth)))return this.fail('남은 OTFC가 없거나 다른 OTFC를 물고 있습니다.');if(t.kind==='blood'&&(t.remainingMl<=0||this.list.some(x=>x.kind==='blood'&&x.connected)))return this.fail('남은 혈액이 없거나 다른 수혈이 연결되어 있습니다.');const timing=careTiming(this.m,t.kind,t.target.partKey,this.getFeedback(),t.treatmentMode||'reality');if(!timing.allowed)return this.fail(timing.reason||'수혈 연결에는 두 손이 필요합니다.');t.status='active';t.workS=t.progress=0;t.setupRemainingS=0;t.timing=timing;t.remainingSeconds=timing.estimatedSeconds;t.weaponAtStart=this.inventory.primaryId;this.onStart(t);this.onChange();return true;}
 snapshot(){return{ruleId:M4C.ruleId,mode:this.mode,activeId:this.active?.id||null,treatments:structuredClone(this.list),drugs:drugSnapshot(this.m),lastError:this.lastError};}
}
