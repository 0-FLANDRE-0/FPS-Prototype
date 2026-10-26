import{CATALOG}from'./catalog.js';
import{PLATE_SLOTS,plateFits}from'./plate-shapes.js';
import{careTiming}from'./medical-care-state.js';
export const PLATE_ACTION_SECONDS={worn:5,off:3};
export const plateMount=owner=>{const m=/^plate:(.+):(front|rear|left|right)$/.exec(owner);return m?{rigId:m[1],slot:m[2]}:null;};
export const mountedOwner=(rigId,slot)=>'plate:'+rigId+':'+slot;
export function makePlate(instanceId,definitionId,owner){const p=CATALOG.PLATE_REGISTRY[definitionId];if(!p||p.plate.isNone)throw Error('Invalid physical plate');return{instanceId,kind:'armorPlate',definitionId,owner,condition:{current:p.durability.maxDurability,max:p.durability.maxDurability,material:p.armor.material,sourceId:p.id,localZones:{}},damageHistory:[]};}
export function installInitialPlates(inv,rig,front='plate_granit_br4',prefix=rig.instanceId){rig.armorId??='armor_6b45_basic_test';rig.plateSlots={};for(const slot of PLATE_SLOTS){const def=slot==='front'||slot==='rear'?front:'plate_granit_side',id=prefix+':plate-'+slot,item=makePlate(id,def,mountedOwner(rig.instanceId,slot));inv.items.set(id,item);rig.plateSlots[slot]=id;}}
export function initPlayerPlates(inv){if(!inv.includePlates)return;installInitialPlates(inv,inv.items.get('gear-rig'));}
export function plateParent(inv,owner){const at=plateMount(owner);return at?inv.items.get(at.rigId):null;}
export const rigWorn=rig=>rig?.owner==='equipment:rig'||/^actor:.+:rig$/.test(rig?.owner||'');
export function plateAccess(inv,owner){const at=plateMount(owner);return at?!!plateParent(inv,owner)&&inv.canAccess(plateParent(inv,owner).owner):null;}
export function plateMove(inv,id,destination){
 if(inv.action)return inv.fail();if(inv.canEquipmentAct?.()===false)return inv.fail('현재 상태에서는 장비를 다룰 수 없습니다.');
 const item=inv.items.get(id),from=plateMount(item?.owner||''),to=plateMount(destination?.owner||'');if(item?.kind!=='armorPlate'||!inv.canAccess(item.owner))return inv.fail('접근 가능한 판을 선택하세요.');
 if(!from&&!to&&destination.owner!=='world')return inv.move(id,destination.owner,destination.cell.x,destination.cell.y);
 for(const at of[from,to].filter(Boolean)){const rig=inv.items.get(at.rigId);if(!rig||!inv.canAccess(rig.owner))return inv.fail('접근할 수 없는 방탄복입니다.');if(rigWorn(rig)&&at.slot==='rear')return inv.fail('뒤판: 리그를 벗어야 함');}
 if(to){const rig=inv.items.get(to.rigId),reason=plateFits(item.definitionId,rig.armorId||'armor_6b45_basic_test',to.slot);if(reason)return inv.fail(reason);if(rig.plateSlots?.[to.slot])return inv.fail('플레이트 자리를 먼저 비우세요.');}
 else if(destination.owner!=='world'){if(!inv.canAccess(destination.owner))return inv.fail(destination.owner==='bag'?'배낭을 먼저 여세요.':'수납 위치에 접근할 수 없습니다.');if(!inv.canPlace(destination.owner,item,destination.cell))return inv.fail('판을 넣을 빈칸이 없습니다.');}
 const medical=inv.getEquipmentMedical?.(),timing=medical?careTiming(medical,'bandage','chest',inv.getEquipmentFeedback?.()||{}):{allowed:true,multiplier:1};if(!timing.allowed)return inv.fail(timing.reason||'사용 가능한 손이 없습니다.');
 const worn=[from,to].some(at=>at&&rigWorn(inv.items.get(at.rigId))),duration=PLATE_ACTION_SECONDS[worn?'worn':'off']*timing.multiplier;
 inv.action={kind:'gear-plate',phase:to?'플레이트 넣기':'플레이트 빼기',itemId:id,fromOwner:item.owner,destination:structuredClone(destination),elapsed:0,duration,multiplier:timing.multiplier};inv.onEquipmentAction?.();return inv.changed();
}
export function stepPlateAction(inv,dt){const a=inv.action;if(a?.kind!=='gear-plate')return undefined;const item=inv.items.get(a.itemId);if(!item||item.owner!==a.fromOwner||!inv.canAccess(item.owner)){inv.cancel();return null;}a.elapsed=Math.min(a.duration,a.elapsed+dt);if(a.elapsed<a.duration-1e-8)return null;const dest=a.destination,to=plateMount(dest.owner),from=plateMount(item.owner);if(to&&inv.items.get(to.rigId)?.plateSlots?.[to.slot]||!to&&dest.owner!=='world'&&!inv.canPlace(dest.owner,item,dest.cell)){inv.action=null;return inv.fail('교체 중 목적지 상태가 바뀌었습니다.');}if(dest.owner==='world'&&inv.onWorldDrop?.(item)===false){inv.action=null;return inv.fail('바닥에 놓을 수 없습니다.');}
 if(item.owner.startsWith('ground:')&&dest.owner!=='world')inv.onWorldPickup?.(item.instanceId);if(from)delete inv.items.get(from.rigId).plateSlots[from.slot];if(to){const rig=inv.items.get(to.rigId);rig.plateSlots??={};rig.plateSlots[to.slot]=item.instanceId;}item.owner=dest.owner==='world'?'ground:'+item.instanceId:dest.owner;if(dest.cell)item.cell={...dest.cell};else delete item.cell;item.claimed=true;inv.action=null;inv.onEquipmentChanged?.();inv.changed();return'gear-plate';}
