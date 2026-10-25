import{corpseAccess}from'./corpse-inventory.js';
import{plateMount,plateParent,plateAccess,plateMove,stepPlateAction}from'./plate-inventory.js';
import{EQUIPMENT,gearDefinition,pocketInfo,pocketOwners}from'./equipment-data.js';
import{initEquipment,equipmentRootParent,equipmentLayout,equipmentAccess,reachableMedical,weightOf,carriedMass,reloadStorage,storageCell,closeBackpack,beginBackpack,dropItem,pickupItem,wearGear,stepEquipment,isCarriedRoot}from'./equipment-inventory.js';
import{syncMedicalUses}from'./medical-care-modes.js';
import{IFAK,MEDIC_POUCH,MEDIC_SUPPORT,INITIAL_MEDIC_SUPPORT,MEDICAL_SUPPLIES,INITIAL_IFAK_CONTENTS,medicalDefinition}from'./medical-supplies.js';
import { CATALOG, MAGAZINE, AK_MAGAZINE, SCAR_MAGAZINE, magazineDefinition, compatibleAmmo, shotBallistics } from './catalog.js';
import { WEAPONS, SWITCH_LOWER_S, DRAW_S } from './weapon-data.js';
import {FPS_HANDLING,reloadAnimation} from './handling-animation.js';
import {DEBUG_WEAPON,debugShotBallistics,debugZeroingPreset,validDebugVelocity} from './debug-weapon.js';
import {VUDU,XPS3,ACOG,opticDefinition} from './optic-data.js';

export const AMMO_MAX_STACK = 60;
export const CRATE_OWNER = 'container:ammo-crate';
export const GRID_LAYOUTS = Object.freeze({ bag: Object.freeze({ cols: 6, rows: 5 }),
  [CRATE_OWNER]: Object.freeze({ cols: 6, rows: 6 }) });
export function itemSize(item) { if(item.kind==='armorPlate')return CATALOG.PLATE_REGISTRY[item.definitionId].plate.slotType==='side'?{w:1,h:2}:{w:2,h:2};return gearDefinition(item)?{...gearDefinition(item).size}:medicalDefinition(item)?{...medicalDefinition(item).size}:item.kind === 'optic' ? {...opticDefinition(item).size} : item.kind === 'magazine' ? { w: 1, h: 2 } : item.kind === 'weapon' ? { w: 4, h: 2 } : { w: 1, h: 1 }; }
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// One instance, one owner. Cell coordinates exist only inside spatial containers.
// Timed actions reserve storage before they start; cancellation keeps committed transfers.
export class Inventory {
  constructor({includeSCAR=false,primaryWeaponId="m4a1",includePlates=false,includeEquipment=false,includeAK=true,nativeHandling=false,includeDebug=false,includeMedical=false,includeAbdominal=false,includeMedic=false,treatmentMode='reality'}={}) { this.includeSCAR=includeSCAR;this.primaryWeaponId=primaryWeaponId;this.includePlates=includePlates;this.includeEquipment=includeEquipment;this.includeMedic=includeMedic;this.includeAbdominal=includeAbdominal;this.treatmentMode=treatmentMode;this.includeMedical=includeMedical;this.includeAK=includeAK;this.nativeHandling=nativeHandling;this.includeDebug=includeDebug; this.reset(); }
  reset() {
    this.medicalStock=new Map();this.openMedicalContainers=new Set();this.items = new Map(); this.primaryId = 'weapon-01'; this.weaponSlots = ['weapon-01','weapon-02']; this.action = null; this.spent = {};
    this.accessibleContainer = null; this.serial = 0; this.lastError = '';
    this.debugStateCache=null;this.debugStateKey='';
    this.debugWeapon=this.includeDebug?{instanceId:DEBUG_WEAPON.instanceId,kind:'weapon',definitionId:'ak74m',debugOnly:true,owner:'debug:slot3',magazineId:null,chamber:DEBUG_WEAPON.defaultAmmoId,boltLocked:false,fireMode:'full',velocityOverrideMps:null,autoZero:false}:null;
    if(this.debugWeapon)this.weaponSlots.push(DEBUG_WEAPON.instanceId);
    this.items.set('weapon-01', { instanceId: 'weapon-01', kind: 'weapon', definitionId: 'm4a1', owner: 'equipment:primary',
      magazineId: 'mag-01', chamber: '556_m855', boltLocked: false, fireMode: 'full' });
    for (let i = 1; i <= 5; i++) {
      const ammoId = ['556_m855', '556_m193', '556_mk262_mod1'][i - 1];
      const item = { instanceId: `mag-0${i}`, kind: 'magazine', definitionId: MAGAZINE.id,
        owner: i === 1 ? 'weapon:weapon-01' : 'bag', rounds: Array(i === 1 ? 29 : i <= 3 ? 30 : 0).fill(ammoId) };
      if (i > 1) item.cell = this.findCell('bag', item);
      this.items.set(item.instanceId, item);
    }
    for (const id of compatibleAmmo()) for (const owner of ['bag', CRATE_OWNER]) {
      const item = { instanceId: (owner === 'bag' ? 'ammo:' : 'crate:') + id, kind: 'ammo', definitionId: id, owner, count: AMMO_MAX_STACK };
      item.cell = this.findCell(owner, item); this.items.set(item.instanceId, item);
    }
    if(this.includeAK){
    this.items.set('weapon-02',{instanceId:'weapon-02',kind:'weapon',definitionId:'ak74m',owner:'equipment:secondary',magazineId:'ak-mag-01',chamber:'545_ps_gs',boltLocked:false,fireMode:'full'});
    for(let i=1;i<=3;i++){
      const item={instanceId:`ak-mag-0${i}`,kind:'magazine',definitionId:AK_MAGAZINE.id,owner:i===1?'weapon:weapon-02':i===2?'bag':CRATE_OWNER,rounds:Array(i===1?29:30).fill('545_ps_gs')};
      if(i>1)item.cell=this.findCell(item.owner,item);this.items.set(item.instanceId,item);
    }
    for(const id of compatibleAmmo('ak74m')){const item={instanceId:'crate:'+id,kind:'ammo',definitionId:id,owner:CRATE_OWNER,count:AMMO_MAX_STACK};item.cell=this.findCell(CRATE_OWNER,item);this.items.set(item.instanceId,item);}
    }
    const optic={instanceId:'optic-vudu-01',kind:'optic',definitionId:VUDU.id,owner:CRATE_OWNER};
    optic.cell=this.canPlace(CRATE_OWNER,optic,{x:5,y:4})?{x:5,y:4}:this.findCell(CRATE_OWNER,optic);this.items.set(optic.instanceId,optic);
    for(const [id,def]of [['optic-xps3-01',XPS3],['optic-acog-01',ACOG]]){const item={instanceId:id,kind:'optic',definitionId:def.id,owner:CRATE_OWNER};item.cell=this.findCell(CRATE_OWNER,item);if(item.cell)this.items.set(id,item);}
    if(this.includeMedical){
      const kit={instanceId:'ifak-01',kind:'medicalContainer',definitionId:IFAK.id,owner:'bag'};kit.cell=this.findCell('bag',kit);if(!kit.cell)throw Error('Initial IFAK does not fit');this.items.set(kit.instanceId,kit);
      for(const[id,x,y]of INITIAL_IFAK_CONTENTS){const def=MEDICAL_SUPPLIES[id],instanceId='medical:'+id+(this.items.has('medical:'+id)?'-2':''),item={instanceId,kind:'medicalSupply',definitionId:id,owner:'container:'+kit.instanceId,cell:{x,y},remaining:def.units};if(!this.canPlace(item.owner,item,item.cell))throw Error('Initial IFAK supply does not fit: '+id);this.items.set(item.instanceId,item);}
    }
    if(this.includeMedical&&this.includeAbdominal){const kit={instanceId:'medic-pouch-01',kind:'medicalContainer',definitionId:MEDIC_POUCH.id,owner:'bag'};kit.cell=this.findCell('bag',kit);if(!kit.cell)throw Error('Abdominal pouch does not fit');this.items.set(kit.instanceId,kit);for(const[id,x]of[['txa',0],['foam',1]]){const item={instanceId:'medical:'+id,kind:'medicalSupply',definitionId:id,owner:'container:'+kit.instanceId,cell:{x,y:0},remaining:1};this.items.set(item.instanceId,item);}}
    if(this.includeMedical&&this.includeMedic){const kit={instanceId:'medic-support-01',kind:'medicalContainer',definitionId:MEDIC_SUPPORT.id,owner:'bag'};kit.cell=this.findCell('bag',kit);if(!kit.cell)throw Error('Medic support pouch does not fit');this.items.set(kit.instanceId,kit);for(const[id,x,y]of INITIAL_MEDIC_SUPPORT){const instanceId='medical:'+id+(this.items.has('medical:'+id)?'-2':''),item={instanceId,kind:'medicalSupply',definitionId:id,owner:'container:'+kit.instanceId,cell:{x,y},remaining:1};this.items.set(instanceId,item);}}
    if(this.includeSCAR){
      for(let i=0;i<3;i++){const item={instanceId:'scar-crate-mag-'+i,kind:'magazine',definitionId:SCAR_MAGAZINE.id,owner:CRATE_OWNER,rounds:Array(i<2?20:0).fill('762_m80')};item.cell=this.findCell(CRATE_OWNER,item);if(!item.cell)throw Error('SCAR magazine crate capacity');this.items.set(item.instanceId,item);}
      for(const id of compatibleAmmo('scar_h')){const item={instanceId:'crate:'+id,kind:'ammo',definitionId:id,owner:CRATE_OWNER,count:AMMO_MAX_STACK};item.cell=this.findCell(CRATE_OWNER,item);if(!item.cell)throw Error('SCAR ammo crate capacity');this.items.set(item.instanceId,item);}
      if(this.primaryWeaponId==='scar_h'){const w=this.items.get('weapon-01');w.definitionId='scar_h';w.chamber='762_m80';for(let i=1;i<=5;i++){const mag=this.items.get('mag-0'+i);mag.definitionId=SCAR_MAGAZINE.id;mag.rounds=Array(i===1?19:i<=3?20:0).fill(['762_m80','762_m80','762_m80a1'][i-1]);}}
    }
    if(this.includeMedical)syncMedicalUses(this,this.treatmentMode);
    if(this.includeEquipment)initEquipment(this);
    this.initialRounds = this.totalRounds(); this.initialByAmmo = this.roundCounts();
    this.selectedMagazineId = 'mag-02'; this.revision = (this.revision || 0) + 1;
  }
  fail(message = '진행 중인 동작을 먼저 마치거나 취소하세요.') { this.lastError = message; return false; }
  changed() { this.lastError = ''; this.revision++; return true; }
  get weapon() { return this.primaryId ? this.resolveWeapon(this.primaryId) : null; }
  resolveWeapon(id){return id===DEBUG_WEAPON.instanceId?this.debugWeapon:this.items.get(id);}
  get isDebugWeapon(){return Boolean(this.weapon?.debugOnly);}
  get debugState(){const w=this.debugWeapon;if(!w)return null;const key=[this.isDebugWeapon,w.chamber,w.velocityOverrideMps,w.autoZero].join(':');if(key!==this.debugStateKey){const state={active:this.isDebugWeapon,ammoId:w.chamber,velocityOverrideMps:w.velocityOverrideMps,autoZero:w.autoZero};this.debugStateCache=Object.freeze({...state,muzzleVelocityMps:debugShotBallistics(state).muzzleVelocityMps,zeroing:debugZeroingPreset(state),classification:DEBUG_WEAPON.classification});this.debugStateKey=key;}return this.debugStateCache;}
  updateDebugSettings(changes){
    if(!this.debugWeapon)return this.fail('디버그 총기를 사용할 수 없습니다.');
    const state={ammoId:this.debugWeapon.chamber,velocityOverrideMps:this.debugWeapon.velocityOverrideMps,autoZero:this.debugWeapon.autoZero,...changes};
    try{state.velocityOverrideMps=validDebugVelocity(state.velocityOverrideMps);debugShotBallistics(state);debugZeroingPreset(state);}catch(error){return this.fail(error.message);}
    Object.assign(this.debugWeapon,{chamber:state.ammoId,velocityOverrideMps:state.velocityOverrideMps,autoZero:Boolean(state.autoZero)});return this.changed();
  }
  selectDebugAmmo(ammoId){return this.updateDebugSettings({ammoId});}
  setDebugVelocity(velocityOverrideMps){return this.updateDebugSettings({velocityOverrideMps});}
  setDebugAutoZero(autoZero){return this.updateDebugSettings({autoZero:Boolean(autoZero)});}
  get magazine() { return this.weapon?.magazineId ? this.items.get(this.weapon.magazineId) : null; }
  get optic() { return this.weapon?.opticId ? this.items.get(this.weapon.opticId) : null; }
  get attachmentWeightKg() { return opticDefinition(this.optic)?.weightKg || 0; }
  get backpackSeconds(){return EQUIPMENT.backpackSeconds[this.treatmentMode];}
  get weaponWeightKg() { if(this.includeEquipment&&this.weapon&&!this.isDebugWeapon)return weightOf(this,this.weapon);return this.weapon ? shotBallistics(compatibleAmmo(this.weapon.definitionId)[0],this.weapon.definitionId).weaponMassKg+this.attachmentWeightKg : 0; }
  get loadedRounds() { if(this.isDebugWeapon)return Infinity; return (this.magazine?.rounds.length || 0) + (this.weapon?.chamber ? 1 : 0); }
  get reserveRounds() {
    if(this.isDebugWeapon)return Infinity;
    if(!this.weapon)return this.carriedRounds();
    const allowed=new Set(compatibleAmmo(this.weapon.definitionId));let count=0;
    for(const item of this.items.values())if(this.includeEquipment?isCarriedRoot(this.rootOwner(item)):!this.rootOwner(item).startsWith('container:')){
      if(item.kind==='ammo'&&allowed.has(item.definitionId))count+=item.count;
      else if(item.kind==='magazine')count+=item.rounds.filter(id=>allowed.has(id)).length;
      else if(item.kind==='weapon'&&allowed.has(item.chamber))count++;
    }
    return count-this.loadedRounds;
  }
  switchWeapon(slot) {
    const next=this.resolveWeapon(this.weaponSlots[slot]);
    if(!next||(!next.debugOnly&&!next.owner.startsWith('equipment:'))||next.instanceId===this.primaryId||this.action?.kind==='switch')return false;
    if(this.action)this.cancel();
    const lowerDuration=this.nativeHandling?FPS_HANDLING[this.weapon?.definitionId]?.hide.duration??SWITCH_LOWER_S:SWITCH_LOWER_S,drawDuration=this.nativeHandling?FPS_HANDLING[next.definitionId]?.draw.duration??DRAW_S:DRAW_S;
    this.action={kind:'switch',weaponId:this.primaryId,targetWeaponId:next.instanceId,elapsed:0,duration:lowerDuration+drawDuration,lowerDuration,drawDuration,switched:false,phase:'lower'};
    return this.changed();
  }
  rounds(item) { return item.kind === 'ammo' ? item.count : item.kind === 'magazine' ? item.rounds.length : item.chamber ? 1 : 0; }
  totalRounds() { return [...this.items.values()].reduce((n, item) => n + this.rounds(item), 0); }
  carriedRounds() { return [...this.items.values()].filter(item => this.includeEquipment?isCarriedRoot(this.rootOwner(item)):!this.rootOwner(item).startsWith('container:')).reduce((n, item) => n + this.rounds(item), 0); }
  rootOwner(item){
    const seen=new Set();let node=item;
    while(node){if(seen.has(node.instanceId))throw Error('순환 소유 구조');seen.add(node.instanceId);const owner=node.owner;
      if(this.includePlates&&plateMount(owner)){node=plateParent(this,owner);if(!node)throw Error('사라진 플레이트 부모');continue;}
      if(this.includeEquipment&&pocketInfo(owner)){node=equipmentRootParent(this,owner);if(!node)throw Error('사라진 장비 소유자');continue;}
      if(owner===CRATE_OWNER||!owner.startsWith('weapon:')&&!owner.startsWith('container:'))return owner;
      const id=owner.slice(owner.indexOf(':')+1),parent=this.items.get(id);if(!parent)throw Error('사라진 부모 참조: '+id);if(owner.startsWith('weapon:')&&parent.kind!=='weapon'||owner.startsWith('container:')&&parent.kind!=='medicalContainer')throw Error('유효하지 않은 부모 종류');node=parent;
    }throw Error('소유자 없는 아이템');
  }
  layout(owner){if(this.includeSCAR&&owner===CRATE_OWNER)return{cols:6,rows:10};if(this.includeEquipment&&equipmentLayout(owner))return equipmentLayout(owner);if(GRID_LAYOUTS[owner])return GRID_LAYOUTS[owner];const p=owner.startsWith('container:')?this.items.get(owner.slice(10)):null;return p?.kind==='medicalContainer'?medicalDefinition(p).grid:null;}
  setMedicalContainerOpen(id,open=true){const item=this.items.get(id),owner='container:'+id;if(!open){this.openMedicalContainers.delete(owner);return true;}if(item?.kind!=='medicalContainer'||!this.canAccess(item.owner))return this.fail('내 가방의 의료 파우치를 여세요.');this.openMedicalContainers.add(owner);return this.changed();}
  itemWeightKg(item,seen=new Set()){
    if(this.includeEquipment)return weightOf(this,item,seen);
    if(seen.has(item.instanceId))throw Error('순환 소유 구조');seen.add(item.instanceId);const def=medicalDefinition(item);let mass=def?.weightKg||0;
    if(item.kind==='medicalContainer')for(const child of this.items.values())if(child.owner==='container:'+item.instanceId)mass+=this.itemWeightKg(child,seen);
    return mass;
  }
  get medicalWeightKg(){if(this.includeEquipment)return [...this.items.values()].filter(i=>medicalDefinition(i)&&!i.owner.startsWith('container:')&&isCarriedRoot(this.rootOwner(i))).reduce((n,i)=>n+weightOf(this,i),0);return [...this.items.values()].filter(i=>medicalDefinition(i)&&(i.owner==='bag'||i.owner.startsWith('treatment:'))).reduce((n,i)=>n+this.itemWeightKg(i),0);}
  ownershipErrors(){const errors=[];if(this.includeEquipment)for(const w of this.items.values())if(w.kind==='weapon')for(const key of['magazineId','opticId'])if(w[key]&&this.items.get(w[key])?.owner!=='weapon:'+w.instanceId)errors.push(w.instanceId+': '+key+' 소유 불일치');for(const i of this.items.values())try{this.rootOwner(i);if(i.owner.startsWith('container:')&&i.owner!==CRATE_OWNER){const p=this.items.get(i.owner.slice(10));if(p?.kind!=='medicalContainer'||i.kind!=='medicalSupply')errors.push(i.instanceId+': 잘못된 수납');}}catch(e){errors.push(i.instanceId+': '+e.message);}return errors;}

  roundCounts() {
    const counts = {};
    for (const item of this.items.values()) {
      const ids = item.kind === 'ammo' ? Array(item.count).fill(item.definitionId) : item.kind === 'magazine' ? item.rounds : item.chamber ? [item.chamber] : [];
      for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }
  movePlate(id,destination){return plateMove(this,id,destination);}
  canAccess(owner){if(this.includePlates){const access=corpseAccess(this,owner);if(access!==null)return access;}if(this.includePlates){const access=plateAccess(this,owner);if(access!==null)return access;}if(this.includeEquipment){const access=equipmentAccess(this,owner);if(access!==null)return access;if(this.openMedicalContainers.has(owner)){const p=this.items.get(owner.slice(10));return!!p&&this.canAccess(p.owner);}if(owner.startsWith('container:')&&owner!==CRATE_OWNER)return false;}if(owner==='bag'||owner===this.accessibleContainer)return true;if(!this.openMedicalContainers.has(owner))return false;const parent=this.items.get(owner.slice(10));try{return parent?.kind==='medicalContainer'&&['bag',this.accessibleContainer].includes(this.rootOwner(parent));}catch{return false;}}
  openContainer(owner = null) {
    if (owner !== null && owner !== CRATE_OWNER) return this.fail('열 수 없는 보관함입니다.');
    if (owner !== this.accessibleContainer && this.action?.external) this.cancel();
    this.accessibleContainer = owner; return this.changed();
  }
  canPlace(owner, item, cell, ignoreId = item.instanceId, extra = []) {
    const grid = this.layout(owner), size = itemSize(item);
    if(this.includeEquipment&&item.kind==='gear'&&owner!=='bag')return false;
    if(owner!==CRATE_OWNER&&owner.startsWith('container:')){const parent=this.items.get(owner.slice(10));if(parent?.kind!=='medicalContainer'||item.kind!=='medicalSupply'||parent.instanceId===item.instanceId)return false;try{this.rootOwner(parent);}catch{return false;}}
    if (!grid || !cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x + size.w > grid.cols || cell.y + size.h > grid.rows) return false;
    const rect = { ...cell, ...size };
    const occupied = [...this.items.values()].filter(i => i.owner === owner && i.instanceId !== ignoreId && i.cell).map(i => ({ ...i.cell, ...itemSize(i) }));
    const reserved = [...(this.action?.reservations || []), ...extra].filter(r => r.owner === owner).map(r => ({ ...r.cell, w: r.w, h: r.h }));
    return [...occupied, ...reserved].every(other => !overlaps(rect, other));
  }
  findCell(owner, item, extra = []) {
    const grid = this.layout(owner); if (!grid) return null;
    for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) if (this.canPlace(owner, item, { x, y }, item.instanceId, extra)) return { x, y };
    return null;
  }
  move(id, owner, x, y) {
    if (this.action) return this.fail();
    const item = this.items.get(id), cell = { x, y };
    if(this.includeEquipment&&(item?.owner.startsWith('weapon:')||item?.kind==='weapon'&&item.owner.startsWith('equipment:')))return this.fail('장착 물품은 분리 동작으로 옮기세요.');
    if(this.includeEquipment&&item?.kind==='gear'&&(item.owner!=='bag'||owner!=='bag'))return this.fail('장비는 벗기거나 장착 칸으로 옮기세요.');
    if(owner!==CRATE_OWNER&&owner.startsWith('container:')&&item&&item.kind!=='medicalSupply')return this.fail('IFAK에는 의료 물품만 넣을 수 있습니다. 컨테이너 중첩은 금지됩니다.');
    if (!item || !this.canAccess(item.owner) || !this.canAccess(owner)) return this.fail('가까이에서 탄약상자를 여세요.');
    const target = [...this.items.values()].find(i => i.owner === owner && i.cell && overlaps({ x, y, w: 1, h: 1 }, { ...i.cell, ...itemSize(i) }));
    if (target?.instanceId === id && target.cell.x === x && target.cell.y === y) return true;
    if (item.kind === 'ammo' && target?.kind === 'ammo' && target.definitionId === item.definitionId && target !== item) {
      const amount = Math.min(item.count, AMMO_MAX_STACK - target.count);
      if (!amount) return this.fail('탄약은 한 칸에 최대 60발입니다.');
      item.count -= amount; target.count += amount; if (!item.count) this.items.delete(id); return this.changed();
    }
    if (!this.canPlace(owner, item, cell)) return this.fail('아이템 크기만큼 빈 칸을 확보하세요.');
    item.owner = owner; item.cell = cell;if(this.includePlates)item.claimed=true;return this.changed();
  }
  selectMagazine(id) {
    const item = this.items.get(id); if (item?.kind !== 'magazine' || (this.includeEquipment?!reloadStorage(this,item):item.owner !== 'bag')) return false;
    this.selectedMagazineId = id; return this.changed();
  }
  equip(id) {
    if(this.includeEquipment&&!this.backpackOpen&&this.items.get(id)?.owner==='bag')return this.openBackpack({kind:'equip',id});
    const item = this.items.get(id);
    if (this.action || this.primaryId || item?.kind !== 'weapon' || item.owner !== 'bag') return this.fail('가방의 총을 빈 주무기 슬롯에 장착하세요.');
    item.owner = 'equipment:primary'; delete item.cell; this.primaryId = id; return this.changed();
  }
  unequip(cell = null) {
    if(this.includeEquipment&&!this.backpackOpen)return this.openBackpack({kind:'unequip',x:cell?.x,y:cell?.y});
    if (this.isDebugWeapon) return this.fail('3번은 디버그 전용 슬롯이며 일반 장비로 이동할 수 없습니다.');
    if (this.action || !this.weapon) return this.fail();
    const gun = this.weapon; cell ||= this.findCell('bag', gun);
    if (!this.canPlace('bag', gun, cell)) return this.fail('총을 보관할 4 × 2칸을 비우세요.');
    gun.owner = 'bag'; gun.cell = cell; this.primaryId = null; return this.changed();
  }
  installOptic(id) {
    if(this.action)return this.fail();
    const gun=this.weapon,item=this.items.get(id),definition=opticDefinition(item);
    if(!gun)return this.fail('조준경을 달 총을 먼저 장착하세요.');
    if(!definition?.weaponIds.includes(gun.definitionId))return this.fail('이 조준경은 M4에만 장착할 수 있습니다. AK에는 별도 마운트가 필요합니다.');
    if(gun.opticId)return this.fail('먼저 장착된 조준경을 분리하세요.');
    if(item?.kind!=='optic'||!this.canAccess(item.owner))return this.fail('내 가방 또는 열린 탄약상자의 조준경을 선택하세요.');
    this.action={kind:'optic-install',phase:'optic-install',weaponId:gun.instanceId,itemId:id,elapsed:0,duration:definition.installSeconds,external:item.owner!== 'bag',reservations:[]};
    return this.changed();
  }
  removeOptic(cell=null,owner='bag') {
    if(this.action)return this.fail();
    const gun=this.weapon,item=this.optic;
    if(!item)return this.fail('장착된 조준경이 없습니다.');
    if(!this.canAccess(owner))return this.fail('가까이에서 탄약상자를 여세요.');
    cell ||= this.findCell(owner,item);
    if(!this.canPlace(owner,item,cell))return this.fail(`조준경을 보관할 ${itemSize(item).w} × ${itemSize(item).h}칸을 비우세요.`);
    this.action={kind:'optic-remove',phase:'optic-remove',weaponId:gun.instanceId,itemId:item.instanceId,destination:owner,cell:{...cell},elapsed:0,duration:opticDefinition(item).removeSeconds,external:owner!== 'bag',reservations:[{owner,cell:{...cell},...itemSize(item)}]};
    return this.changed();
  }
  beginReload(id) {
    if(this.isDebugWeapon)return this.fail('디버그 총기는 탄창과 장전이 필요 없습니다.');
    if (this.action || !this.weapon) return this.fail();
    // Automatic reload ignores UI selection: loaded first, then grid reading order.
    // An explicit drag/menu choice still uses exactly the requested bag magazine.
    const incoming = arguments.length ? this.items.get(id) : [...this.items.values()]
      .filter(item => item.kind === 'magazine' && (this.includeEquipment?reloadStorage(this,item)&&item.rounds.length>0:item.owner === 'bag') && magazineDefinition(item).weaponIds.includes(this.weapon.definitionId))
      .sort((a,b)=>this.includeEquipment?Number(a.owner.startsWith('belt:'))-Number(b.owner.startsWith('belt:'))||pocketInfo(a.owner).index-pocketInfo(b.owner).index||a.cell.y-b.cell.y||a.cell.x-b.cell.x:Number(!a.rounds.length)-Number(!b.rounds.length)||a.cell.y-b.cell.y||a.cell.x-b.cell.x)[0];
    if (arguments.length && (incoming?.kind !== 'magazine' || (this.includeEquipment?!reloadStorage(this,incoming):incoming.owner !== 'bag'))) return this.fail('장착할 탄창을 리그·벨트에 넣으세요.');
    if (!incoming || !magazineDefinition(incoming).weaponIds.includes(this.weapon.definitionId)) return this.fail('호환되는 탄창을 가방에 넣으세요.');
    const outgoing=this.magazine,incomingOwner=incoming.owner,outgoingOwner=this.includeEquipment?incomingOwner:'bag',outgoingCell=outgoing?(this.includeEquipment?{...incoming.cell}:this.findCell('bag',outgoing)):null;
    if (outgoing && !outgoingCell) return this.fail('기존 탄창을 보관할 2칸을 비우세요.');
    const origin = { ...incoming.cell }, empty = !this.weapon.chamber, swap = Boolean(outgoing);
    const definition = WEAPONS[this.weapon.definitionId];
    incoming.owner = 'hand:reload'; delete incoming.cell;
    const reservations = [{ owner: incomingOwner, cell: origin, w: 1, h: 2 }];
    if (outgoing) reservations.push({ owner: outgoingOwner, cell: outgoingCell, w: 1, h: 2 });
    this.action = { kind: swap ? 'reload' : 'insert', mode: !empty ? 'tactical' : this.weapon.boltLocked ? 'bolt-release' : 'charging',
      weaponId: this.weapon.instanceId, incomingId: incoming.instanceId, incomingCell: origin, incomingOwner,outgoingOwner, outgoingId: this.weapon.magazineId, outgoingCell, reservations,
      elapsed: 0, duration: (empty ? definition.reload.reloadTime : definition.reload.tacticalReloadTime) - (swap ? 0 : 0.6),
      removed: !swap, inserted: false, fed: false, phase: swap ? 'remove' : 'insert' };
    if(this.weapon.definitionId==='ak74m'){
      // Native Reload / Reload_full seat events, sampled at 60 Hz. Clip speed unchanged.
      this.action.removeAt=1.15;this.action.insertAt=swap?1.9:.75;
    }
    if(this.nativeHandling){const animation=reloadAnimation(this.weapon.definitionId,{empty,insertOnly:!swap});if(animation)Object.assign(this.action,{animation,duration:animation.duration,removeAt:animation.removeAt,insertAt:animation.insertAt,feedAt:animation.feedAt});}
    return this.changed();
  }
  removeMagazine(cell = null,owner='bag') {
    if (this.action || !this.magazine) return this.fail();
    if(this.includeEquipment&&!cell){const place=storageCell(this,this.magazine,{readyOnly:!this.backpackOpen});if(place){owner=place.owner;cell=place.cell;}}
    cell ||= this.findCell('bag', this.magazine);
    if(this.includeEquipment&&!this.canAccess(owner))return this.fail('탄창을 넣을 칸을 비우거나 배낭을 여세요.');
    if (!this.canPlace(owner, this.magazine, cell)) return this.fail('탄창을 보관할 2칸을 비우세요.');
    this.action = { kind: 'remove', weaponId: this.weapon.instanceId, outgoingId: this.weapon.magazineId, outgoingCell: cell,outgoingOwner:owner,
      reservations: [{ owner, cell, w: 1, h: 2 }], elapsed: 0, duration: 0.65, removed: false, phase: 'remove' };
    if(this.nativeHandling){const animation=reloadAnimation(this.weapon.definitionId,{removeOnly:true});if(animation)Object.assign(this.action,{animation,duration:animation.duration,removeAt:animation.removeAt});}return this.changed();
  }
  // Plan every return, including mixed magazines, before touching a live round.
  planReturns(ammoIds) {
    if(this.includeEquipment&&ammoIds.length&&!this.backpackOpen)return null;
    const stacks = [...this.items.values()].filter(i => i.kind === 'ammo' && i.owner === 'bag').map(i => ({ ...i }));
    const created = [], extra = [], plan = [];
    for (const id of ammoIds) {
      let stack = stacks.find(i => i.definitionId === id && i.count < AMMO_MAX_STACK);
      if (!stack) {
        stack = { instanceId: 'stack-' + ++this.serial, kind: 'ammo', definitionId: id, owner: 'bag', count: 0 };
        stack.cell = this.findCell('bag', stack, extra);
        if (!stack.cell) return null;
        extra.push({ owner: 'bag', cell: stack.cell, w: 1, h: 1 }); created.push(structuredClone(stack)); stacks.push(stack);
      }
      stack.count++; plan.push(stack.instanceId);
    }
    for (const stack of created) this.items.set(stack.instanceId, stack);
    return plan;
  }
  rack() {
    if(this.isDebugWeapon)return this.fail('디버그 총기는 탄창과 장전이 필요 없습니다.');
    if (this.action || !this.weapon) return this.fail();
    const returns = this.planReturns(this.weapon.chamber ? [this.weapon.chamber] : []);
    if (!returns) return this.fail('약실 탄을 보관할 빈 칸이 필요합니다.');
    this.action = { kind: 'rack', mode: 'charging', weaponId: this.weapon.instanceId, returns, elapsed: 0, duration: 1,
      ejected: false, fed: false, phase: 'chamber' }; return this.changed();
  }
  pack(magazineId, sourceId, amount = 30) {
    const mag = this.items.get(magazineId), stack = this.items.get(sourceId) || this.items.get('ammo:' + sourceId);
    if (this.action) return this.fail();
    const definition=magazineDefinition(mag);
    if (mag?.kind !== 'magazine' || (this.includeEquipment?!this.canAccess(mag.owner):mag.owner !== 'bag') || stack?.kind !== 'ammo' || !this.canAccess(stack.owner) || !definition.allowedAmmoIds.includes(stack.definitionId)) return this.fail('탄창과 호환되는 탄약을 선택하세요.');
    const rounds = Math.min(Math.max(0, Math.floor(amount)), definition.capacity - mag.rounds.length, stack.count);
    if (!rounds) return this.fail('탄창이 가득 찼거나 탄약이 없습니다.');
    this.action = { kind: 'pack', magazineId, sourceId: stack.instanceId, ammoId: stack.definitionId, external: stack.owner !== 'bag',
      rounds, transferred: 0, elapsed: 0, duration: rounds * 0.14, phase: 'pack' }; return this.changed();
  }
  unpack(magazineId) {
    const mag = this.items.get(magazineId);
    if (this.action || mag?.kind !== 'magazine' || (this.includeEquipment?!this.canAccess(mag.owner):mag.owner !== 'bag') || !mag.rounds.length) return this.fail('탄약이 있는 가방 탄창을 선택하세요.');
    const returns = this.planReturns(mag.rounds);
    if (!returns) return this.fail('꺼낸 탄약을 보관할 빈 칸이 필요합니다.');
    this.action = { kind: 'unpack', magazineId, returns, rounds: mag.rounds.length, transferred: 0, elapsed: 0,
      duration: mag.rounds.length * 0.1, phase: 'unpack' }; return this.changed();
  }
  feed(weapon) {
    if (weapon.chamber) return;
    const mag = this.items.get(weapon.magazineId);
    if (mag?.rounds.length) { weapon.chamber = mag.rounds.shift(); weapon.boltLocked = false; }
    else weapon.boltLocked = weapon.definitionId==='ak74m'?false:Boolean(mag);
  }
  cleanupEmpty() { for (const item of this.items.values()) if (item.kind === 'ammo' && !item.count) this.items.delete(item.instanceId); }
  cancel() {
    if (!this.action) return false;
    const incoming = this.items.get(this.action.incomingId);
    if(incoming?.owner==='hand:reload'){const a=this.action;if(this.includeEquipment&&a.removed&&a.outgoingId){const outgoing=this.items.get(a.outgoingId),weapon=this.items.get(a.weaponId);outgoing.owner='weapon:'+weapon.instanceId;delete outgoing.cell;weapon.magazineId=outgoing.instanceId;}incoming.owner=a.incomingOwner||'bag';incoming.cell={...a.incomingCell};}
    this.action = null; this.cleanupEmpty(); return this.changed();
  }
  step(dt) {
    if(this.corpseController){const result=this.corpseController.step(dt);if(result!==undefined)return result;}
    if(this.includePlates){const result=stepPlateAction(this,dt);if(result!==undefined)return result;}
    if(this.includeEquipment){const result=stepEquipment(this,dt);if(result!==undefined)return result;}
    const a = this.action; if (!a) return null;
    a.elapsed = Math.min(a.duration, a.elapsed + dt);
    const progress = a.elapsed / a.duration, weapon = this.resolveWeapon(a.weaponId);
    if(a.kind==='switch'){
      if(!a.switched&&a.elapsed>=(a.lowerDuration??SWITCH_LOWER_S)){const next=this.resolveWeapon(a.targetWeaponId);if(weapon&&!weapon.debugOnly)weapon.owner='equipment:secondary';if(!next.debugOnly)next.owner='equipment:primary';this.primaryId=next.instanceId;a.switched=true;a.phase='draw';this.revision++;}
    } else if(a.kind==='optic-install'||a.kind==='optic-remove'){
      // Atomic ownership transfer at completion. Cancelling retains the original
      // grid/weapon owner; the weapon switch path cancels before changing guns.
      if(a.elapsed>=a.duration-1e-8){const item=this.items.get(a.itemId);
        if(a.kind==='optic-install'){item.owner='weapon:'+weapon.instanceId;delete item.cell;weapon.opticId=item.instanceId;}
        else{item.owner=a.destination;item.cell={...a.cell};delete weapon.opticId;}
      }
    } else if (a.kind === 'pack' || a.kind === 'unpack') {
      const mag = this.items.get(a.magazineId), interval = a.kind === 'pack' ? 0.14 : 0.1;
      const due = Math.min(a.rounds, Math.floor((a.elapsed + 1e-8) / interval));
      while (a.transferred < due) {
        if (a.kind === 'pack') { const stack = this.items.get(a.sourceId); stack.count--; mag.rounds.unshift(a.ammoId); if (!stack.count) this.items.delete(stack.instanceId); }
        else { const id = mag.rounds.shift(), stack = this.items.get(a.returns[a.transferred]); if (stack.definitionId !== id) throw new Error('Return plan mismatch'); stack.count++; }
        a.transferred++; this.revision++;
      }
    } else if (a.kind === 'rack') {
      if (!a.ejected && progress >= 0.25) { if (weapon.chamber) this.items.get(a.returns[0]).count++; weapon.chamber = null; a.ejected = true; this.revision++; }
      if (!a.fed && progress >= 0.7) { this.feed(weapon); a.fed = true; this.revision++; }
    } else {
      if (!a.removed && (a.removeAt!=null?a.elapsed>=a.removeAt:progress >= (a.kind === 'remove' ? 0.6 : a.mode === 'tactical' ? 0.28 : 0.22))) {
        const outgoing = this.items.get(a.outgoingId); outgoing.owner = a.outgoingOwner||'bag'; outgoing.cell = a.outgoingCell;
        weapon.magazineId = null; a.removed = true; a.reservations = a.reservations.filter(r => r.cell !== a.outgoingCell); this.revision++;
      }
      if (a.kind !== 'remove') {
        if (!a.inserted && (a.insertAt!=null?a.elapsed>=Math.min(a.insertAt,a.duration):progress >= (a.kind === 'insert' ? 0.5 : a.mode === 'tactical' ? 0.62 : 0.58))) {
          const incoming = this.items.get(a.incomingId); incoming.owner = 'weapon:' + weapon.instanceId; weapon.magazineId = a.incomingId;
          a.inserted = true; a.reservations = []; this.revision++;
        }
        if (a.mode !== 'tactical' && !a.fed && (a.feedAt!=null?a.elapsed>=a.feedAt:progress >= 0.83)) { this.feed(weapon); a.fed = true; this.revision++; }
        a.phase = !a.removed ? 'remove' : !a.inserted ? 'insert' : a.mode !== 'tactical' && !a.fed ? 'chamber' : 'ready';
      }
    }
    if (a.elapsed >= a.duration - 1e-8) {
      this.action = null; this.cleanupEmpty(); if (a.outgoingId) this.selectedMagazineId = a.outgoingId;
      this.revision++; return a.kind;
    }
    return null;
  }
  fire() {
    if (this.includeEquipment&&this.backpackOpen||this.action || !this.weapon?.chamber || this.weapon.fireMode==='safe') return null;
    const ammoId = this.weapon.chamber; if(this.isDebugWeapon){this.revision++;return ammoId;} this.weapon.chamber = null; this.spent[ammoId] = (this.spent[ammoId] || 0) + 1;
    this.feed(this.weapon); this.revision++; return ammoId;
  }
  get carriedMassKg(){return this.includeEquipment?carriedMass(this):null;}
  get readyOwners(){return this.includeEquipment?['rig','belt'].flatMap(s=>this.gearSlots[s]?pocketOwners(s,this.gearSlots[s]):[]):['bag'];}
  openBackpack(after=null){return this.includeEquipment?beginBackpack(this,after):true;}
  closeBackpack(){if(this.includeEquipment)closeBackpack(this);}
  dropItem(id){return this.includeEquipment?dropItem(this,id):this.fail();}
  wearGear(id){return this.includeEquipment?wearGear(this,id):this.fail();}
  pickupItem(id,options){return this.includeEquipment?pickupItem(this,id,options):this.fail();}
  reachableMedical(item){return this.includeEquipment?reachableMedical(this,item):this.rootOwner(item)==='bag'&&this.canAccess(item.owner);}
  snapshot() {
    return { ...(this.includeEquipment?{equipment:{gearSlots:{...this.gearSlots},backpackOpen:this.backpackOpen,nearbyIds:[...this.nearbyIds],carriedMassKg:this.carriedMassKg,pockets:Object.fromEntries([...this.items.values()].filter(i=>i.kind==='gear'&&['rig','belt'].includes(i.definitionId)).flatMap(i=>pocketOwners(i.definitionId,i.instanceId)).map(o=>[o,this.layout(o)]))}}:{}),primaryId: this.primaryId, selectedMagazineId: this.selectedMagazineId, items: structuredClone([...this.items.values()]),
      action: this.action ? { ...structuredClone(this.action), progress: this.action.elapsed / this.action.duration } : null,
      grids: {...GRID_LAYOUTS,...(this.includeSCAR?{[CRATE_OWNER]:this.layout(CRATE_OWNER)}:{}),...Object.fromEntries([...this.items.values()].filter(i=>i.kind==='medicalContainer').map(i=>['container:'+i.instanceId,this.layout('container:'+i.instanceId)]))},medicalWeightKg:this.medicalWeightKg, maxAmmoStack: AMMO_MAX_STACK, accessibleContainer: this.accessibleContainer,
      loadedRounds: this.loadedRounds, reserveRounds: this.reserveRounds, carriedRounds: this.carriedRounds(), totalRounds: this.totalRounds(),
      initialRounds: this.initialRounds, initialByAmmo: { ...this.initialByAmmo }, spent: { ...this.spent }, opticId:this.weapon?.opticId||null,weaponWeightKg:this.weaponWeightKg,attachmentWeightKg:this.attachmentWeightKg };
  }
}
