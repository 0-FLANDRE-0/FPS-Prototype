import{initPlayerPlates,plateMount}from'./plate-inventory.js';
import{EQUIPMENT,gearDefinition,pocketInfo,pocketOwners}from'./equipment-data.js';
import{CATALOG,shotBallistics,compatibleAmmo}from'./catalog.js';import{WEAPONS}from'./weapon-data.js';import{opticDefinition}from'./optic-data.js';import{medicalDefinition}from'./medical-supplies.js';
export const isCarriedRoot=root=>root==='bag'||root.startsWith('equipment:')||root.startsWith('hand:')||root.startsWith('treatment:');
export function initEquipment(inv){
 inv.gearSlots={};inv.backpackOpen=false;inv.nearbyIds=new Set();inv.groundRigOpen=false;
 for(const[slot,d]of Object.entries(EQUIPMENT.gear)){inv.items.set(d.id,{instanceId:d.id,kind:'gear',definitionId:slot,owner:'equipment:'+slot});inv.gearSlots[slot]=d.id;}
 initPlayerPlates(inv);
 const before={rounds:inv.roundCounts(),items:inv.items.size,massKg:worldMass(inv)};
 const assign=(id,owner)=>{const item=inv.items.get(id);if(!item)return;const cell=inv.findCell(owner,item);if(!cell)throw Error('M6 initial pocket does not fit '+id);item.owner=owner;item.cell=cell;};
 for(let i=2;i<=5;i++)assign('mag-0'+i,'rig:pouch-'+(i+2));
 assign('ifak-01','rig:pouch-8');assign('ak-mag-02','belt:pouch-2');assign('ak-mag-03','belt:pouch-3');
 inv.initialEquipmentPlacement={before,after:{rounds:inv.roundCounts(),items:inv.items.size,massKg:worldMass(inv)},crateAKMagazineMovedToBelt:'ak-mag-03'};
}
export function equipmentRootParent(inv,owner){const p=pocketInfo(owner);return p?inv.items.get(p.gearId):null;}
export function equipmentLayout(owner){const p=pocketInfo(owner);return p?{cols:p.w,rows:p.h}:null;}
export function equipmentAccess(inv,owner){
 if(owner==='bag')return inv.backpackOpen;
 const p=pocketInfo(owner);if(p){const gear=equipmentRootParent(inv,owner);return gear?.owner==='equipment:'+p.slot||gear?.owner.startsWith('ground:')&&inv.nearbyIds.has(gear.instanceId)&&inv.groundRigOpen||gear?.owner.startsWith('actor:')&&inv.corpseController?.accessible(gear.owner.split(':')[1]);}
 if(owner.startsWith('ground:'))return inv.nearbyIds.has(owner.slice(7));
 if(owner.startsWith('equipment:')||owner.startsWith('weapon:'))return true;
 return null;
}
export function reachableMedical(inv,item){
 if(!isCarriedRoot(inv.rootOwner(item)))return false;
 if(item.owner.startsWith('container:'))return inv.openMedicalContainers.has(item.owner);
 return true;
}
export function weightOf(inv,item,seen=new Set()){
 if(seen.has(item.instanceId))throw Error('순환 소유 구조');seen.add(item.instanceId);
 const def=medicalDefinition(item),gear=gearDefinition(item),bullet=id=>(CATALOG.AMMO_REGISTRY[id]?.projectile.massG||0)/1000*EQUIPMENT.cartridgeToProjectileMass;
 let mass=def?.weightKg||gear?.weightKg||0;if(gear&&item.definitionId==='rig'&&inv.includePlates)mass-=5.4;if(item.kind==='armorPlate')mass=CATALOG.PLATE_REGISTRY[item.definitionId].physical.weightKg;
 if(item.definitionId==='blood')mass=Math.max(0,mass-.5)+(item.remainingMl??500)/1000;
 if(item.definitionId==='otfc'&&item.remainingFraction!=null)mass*=item.remainingFraction;
 if(item.kind==='weapon')mass=shotBallistics(compatibleAmmo(item.definitionId)[0],item.definitionId).weaponMassKg+(item.chamber?bullet(item.chamber):0);
 else if(item.kind==='magazine')mass=(EQUIPMENT.emptyMagazineKg[item.definitionId]||.15)+item.rounds.reduce((n,id)=>n+bullet(id),0);
 else if(item.kind==='ammo')mass=bullet(item.definitionId)*item.count;
 else if(item.kind==='optic')mass=opticDefinition(item)?.weightKg||0;
 for(const child of inv.items.values())if(child.owner==='weapon:'+item.instanceId||child.owner==='container:'+item.instanceId||gear&&pocketInfo(child.owner)?.gearId===item.instanceId||gear&&plateMount(child.owner)?.rigId===item.instanceId||gear&&item.definitionId==='backpack'&&child.owner==='bag')mass+=weightOf(inv,child,seen);
 return mass;
}
export function carriedMass(inv){
 let sum=0;for(const item of inv.items.values())if(item.owner.startsWith('equipment:')||item.owner.startsWith('hand:')||item.owner.startsWith('treatment:'))sum+=weightOf(inv,item);
 return sum;
}
export function reloadStorage(inv,item,{ignoreAccess=false}={}){const p=pocketInfo(item?.owner||'');return!!p&&inv.gearSlots[p.slot]===p.gearId&&inv.items.get(inv.gearSlots[p.slot])?.owner==='equipment:'+p.slot&&(ignoreAccess||inv.canAccess(item.owner));}
export function storageCell(inv,item,{readyOnly=false}={}){
 for(const slot of['rig','belt'])if(inv.gearSlots[slot])for(const owner of pocketOwners(slot,inv.gearSlots[slot])){const cell=inv.findCell(owner,item);if(cell)return{owner,cell};}
 if(!readyOnly){const cell=inv.findCell('bag',item);if(cell)return{owner:'bag',cell};}return null;
}
export function closeBackpack(inv){inv.backpackOpen=false;for(const owner of [...inv.openMedicalContainers]){const p=inv.items.get(owner.slice(10));if(p&&inv.rootOwner(p)==='bag')inv.openMedicalContainers.delete(owner);}if(inv.action?.kind==='backpack-open')inv.cancel();inv.changed();}
export function beginBackpack(inv,after=null){if(inv.canEquipmentAct?.()===false)return inv.fail('현재 상태에서는 장비를 다룰 수 없습니다.');if(inv.action)return inv.fail();if(inv.backpackOpen)return true;inv.action={kind:'backpack-open',phase:'배낭 열기',elapsed:0,duration:EQUIPMENT.backpackSeconds[inv.treatmentMode],after};inv.onEquipmentAction?.();return inv.changed();}
export function dropItem(inv,id){
 if(inv.canEquipmentAct?.()===false)return inv.fail('현재 상태에서는 장비를 다룰 수 없습니다.');
 if(inv.action)return inv.fail();const item=inv.items.get(id);if(item?.kind==='armorPlate')return inv.movePlate(id,{owner:'world'});if(item?.owner.startsWith('actor:'))return inv.corpseController?.strip(id)||false;if(!item||!['gear','weapon','magazine'].includes(item.kind)||item.debugOnly)return inv.fail('이 물품은 떨굴 수 없습니다.');
 if(item.kind==='gear'){if(!['helmet','rig'].includes(item.definitionId))return inv.fail('벨트·배낭 벗기는 후속 단계입니다.');if(item.owner==='bag'){if(!inv.backpackOpen)return beginBackpack(inv,{kind:'drop',id});return commitDrop(inv,item);}if(item.owner!=='equipment:'+item.definitionId)return inv.fail('장착한 장비를 선택하세요.');inv.action={kind:'gear-remove',phase:'장비 벗기',itemId:id,elapsed:0,duration:EQUIPMENT.gearSeconds[inv.treatmentMode]};inv.onEquipmentAction?.();return inv.changed();}
 if(!isCarriedRoot(inv.rootOwner(item)))return inv.fail('휴대한 물품을 선택하세요.');
 return commitDrop(inv,item);
}
function commitDrop(inv,item){
 if(inv.onWorldDrop?.(item)===false)return inv.fail('바닥 물체를 만들 수 없습니다.');
 if(item.kind==='gear'){inv.gearSlots[item.definitionId]=null;for(const owner of[...inv.openMedicalContainers]){const p=inv.items.get(owner.slice(10));if(p&&inv.rootOwner(p)==='equipment:'+item.definitionId)inv.openMedicalContainers.delete(owner);}}
 if(item.owner.startsWith('weapon:')){const gun=inv.items.get(item.owner.slice(7));if(gun?.magazineId===item.instanceId)gun.magazineId=null;}
 if(item.instanceId===inv.primaryId){inv.primaryId=null;const next=inv.weaponSlots.map(id=>inv.resolveWeapon(id)).find(g=>g&&!g.debugOnly&&g.instanceId!==item.instanceId&&g.owner.startsWith('equipment:'));if(next){next.owner='equipment:primary';inv.primaryId=next.instanceId;}}
 item.owner='ground:'+item.instanceId;delete item.cell;inv.onEquipmentChanged?.();return inv.changed();
}
export function pickupItem(inv,id,{wear=false,destination=null}={}){
 if(inv.canEquipmentAct?.()===false)return inv.fail('현재 상태에서는 장비를 다룰 수 없습니다.');
 if(inv.action)return inv.fail();const item=inv.items.get(id);if(!item?.owner.startsWith('ground:')||!inv.nearbyIds.has(id))return inv.fail('가까운 바닥 물건을 선택하세요.');
 if(item.kind==='gear'&&!destination){
  const slot=item.definitionId;if(!['helmet','rig'].includes(slot)||inv.gearSlots[slot])return inv.fail('장착 칸을 먼저 비우세요.');
  inv.action={kind:'gear-equip',phase:'장비 입기',itemId:id,elapsed:0,duration:EQUIPMENT.gearSeconds[inv.treatmentMode]};inv.onEquipmentAction?.();return inv.changed();
 }
 if(item.kind==='gear'&&destination?.owner!=='bag')return inv.fail('헬멧·리그는 장착하거나 배낭에 보관하세요.');
 let place=destination;
 let weaponSlot=null;if(item.kind==='weapon'&&!place){const existing=inv.weaponSlots.indexOf(id),free=inv.weaponSlots.slice(0,2).findIndex(key=>{const w=inv.items.get(key);return!w?.owner.startsWith('equipment:');});weaponSlot=existing>=0&&existing<2?existing:free>=0?free:null;if(weaponSlot!==null)place={owner:inv.primaryId?'equipment:secondary':'equipment:primary',cell:null};}
 place??=storageCell(inv,item);if(!place||place.cell&&!inv.canPlace(place.owner,item,place.cell))return inv.fail('물품을 넣을 빈 자리가 없습니다.');
 if(place.owner==='bag'&&!inv.backpackOpen)return beginBackpack(inv,{kind:'pickup',id,destination:place});
 inv.onWorldPickup?.(id);if(weaponSlot!==null&&place.owner.startsWith('equipment:'))inv.weaponSlots[weaponSlot]=id;item.claimed=true;item.owner=place.owner;if(place.cell)item.cell={...place.cell};else{delete item.cell;if(!inv.primaryId)inv.primaryId=id;}inv.onEquipmentChanged?.();return inv.changed();
}
export function stepEquipment(inv,dt){
 const a=inv.action;if(!['gear-remove','gear-equip','backpack-open'].includes(a?.kind))return undefined;
 a.elapsed=Math.min(a.duration,a.elapsed+dt);if(a.elapsed<a.duration-1e-8)return null;
 inv.action=null;
 if(a.kind==='backpack-open'){inv.backpackOpen=true;inv.changed();if(a.after?.kind==='pickup')pickupItem(inv,a.after.id,{destination:a.after.destination});else if(a.after?.kind==='remove-magazine')inv.removeMagazine({x:a.after.x,y:a.after.y});else if(a.after?.kind==='optic-remove')inv.removeOptic({x:a.after.x,y:a.after.y});else if(a.after?.kind==='unequip')inv.unequip(a.after.x==null?null:{x:a.after.x,y:a.after.y});else if(a.after?.kind==='equip')inv.equip(a.after.id);else if(a.after?.kind==='wear-gear')wearGear(inv,a.after.id);else if(a.after?.kind==='drop')dropItem(inv,a.after.id);else if(a.after?.kind==='move')inv.move(a.after.id,'bag',a.after.x,a.after.y);return a.kind;}
 const item=inv.items.get(a.itemId);if(!item)return null;
 if(a.kind==='gear-remove')commitDrop(inv,item);
 else{if(item.owner.startsWith('ground:')){if(!inv.nearbyIds.has(item.instanceId))return inv.fail('장비에서 멀어졌습니다.');inv.onWorldPickup?.(item.instanceId);}else if(item.owner!=='bag'||!inv.backpackOpen)return inv.fail('배낭을 열고 장비를 선택하세요.');delete item.cell;item.claimed=true;item.owner='equipment:'+item.definitionId;inv.gearSlots[item.definitionId]=item.instanceId;inv.groundRigOpen=false;inv.onEquipmentChanged?.();inv.changed();}
 return a.kind;
}

export function worldMass(inv){return [...inv.items.values()].filter(i=>i.owner.startsWith('equipment:')||i.owner.startsWith('actor:')||i.owner==='container:ammo-crate'||i.owner.startsWith('ground:')||i.owner.startsWith('treatment:')||i.owner.startsWith('hand:')).reduce((n,i)=>n+weightOf(inv,i),0);}

export function wearGear(inv,id){const item=inv.items.get(id);if(!item||item.kind!=='gear'||!['helmet','rig'].includes(item.definitionId)||inv.gearSlots[item.definitionId])return inv.fail('빈 장착 칸에 맞는 장비를 선택하세요.');if(item.owner.startsWith('ground:'))return pickupItem(inv,id,{wear:true});if(item.owner!=='bag')return inv.fail('배낭이나 바닥의 장비를 선택하세요.');if(!inv.backpackOpen)return beginBackpack(inv,{kind:'wear-gear',id});if(inv.action||inv.canEquipmentAct?.()===false)return inv.fail();inv.action={kind:'gear-equip',phase:'장비 입기',itemId:id,elapsed:0,duration:EQUIPMENT.gearSeconds[inv.treatmentMode]};inv.onEquipmentAction?.();return inv.changed();}
