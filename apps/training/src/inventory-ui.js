import{PlateWindows}from'./plate-windows.js';
import{plateMount,mountedOwner}from'./plate-inventory.js';
import{plateFits}from'./plate-shapes.js';
import{EquipmentStorageUI}from'./equipment-storage-ui.js';
import{gearDefinition}from'./equipment-data.js';
import{reloadStorage}from'./equipment-inventory.js';
import{installTouchControls}from'./ui-touch.js';
import{MedicalContainerWindows}from'./inventory-windows.js';
import{EquipmentUI}from'./equipment-ui.js';
import{medicalDefinition,isMedicalItem,MEDICAL_ITEMS}from'./medical-supplies.js';
import { CATALOG,ammoName,magazineDefinition } from './catalog.js';
import { WEAPONS } from './weapon-data.js';
import { GRID_LAYOUTS, CRATE_OWNER, itemSize, AMMO_MAX_STACK } from './inventory.js';
import {opticDefinition} from './optic-data.js';
const $ = id => document.getElementById(id);
const phases = { remove: '탄창 분리', insert: '탄창 삽입', chamber: '약실 장전', ready: '견착', pack: '탄약 삽입', unpack: '탄약 꺼내기', 'optic-install':'조준경 장착', 'optic-remove':'조준경 분리' };
const medicalIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="8" width="48" height="48" rx="8"/><path d="M25 17h14v8h8v14h-8v8H25v-8h-8V25h8Z"/></svg>';
const icons = {
  optic:'<svg viewBox="0 0 64 100" aria-hidden="true"><path d="M19 7h26v23l-5 5v36l5 5v16H19V76l5-5V35l-5-5z"/><path d="M18 10h28M23 42h18M23 52h18M18 86h28M16 39h8v15h-8M40 61h10v12H40"/></svg>',
  ammo: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M15 41V16l5-12 5 12v25zm19 0V16l5-12 5 12v25z"/><path d="M13 35h14M32 35h14"/></svg>',
  magazine: '<svg viewBox="0 0 40 70" aria-hidden="true"><path d="M9 5h22v30l-5 30H6l4-30z"/><path d="M14 13h11M14 21h11M14 29h11M14 38l-3 19M21 38l-3 19"/></svg>',
  weapon: '<svg viewBox="0 0 180 60" aria-hidden="true"><path d="M5 26l30-4 5-8h15l3 6h59l4 4h37v7h-42l-2 7H72l4 16H63l-7-16H41l-9-7-27 9z"/><path d="M83 38v13h16l4-13M125 19v-8h4v11M50 19v-8h8"/></svg>' };
const gearIcons={helmet:'<svg viewBox="0 0 80 64" aria-hidden="true"><path d="M8 39Q7 8 37 8Q65 8 68 39L74 45H42L38 54H22L18 41Z"/></svg>',rig:'<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M15 8H27L32 22H48L53 8H65L71 69H9Z"/><path d="M20 32H60V60H20Z"/></svg>',belt:'<svg viewBox="0 0 80 40" aria-hidden="true"><path d="M5 12H75V28H5Z"/><path d="M32 9H49V31H32Z"/></svg>',backpack:'<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M18 14Q16 5 32 5Q48 5 46 14L53 25V73H11V25Z"/><path d="M16 44H48V65H16Z"/></svg>'};
const itemName = item => item?.kind==='armorPlate'?CATALOG.PLATE_REGISTRY[item.definitionId].display.shortName:gearDefinition(item)?.name|| medicalDefinition(item)?.name|| (item.kind === 'optic' ? opticDefinition(item).name : item.kind === 'ammo' ? ammoName(item.definitionId) : item.kind === 'magazine' ? magazineDefinition(item).name : WEAPONS[item.definitionId].display.name);

export class InventoryUI {
  constructor(inventory, { onToggle, onChange, toast,getDebug=()=>false }) {
    this.inventory = inventory; this.open = false; this.revision = -1; this.selectedId = null; this.container = null;
    this.notice = ''; this.noticeUntil = 0;
    this.onToggle = onToggle; this.onChange = onChange; this.toast = toast; this.gesture = null; this.chooseMagazine = false;
    this.getDebug=getDebug;this.windows=new MedicalContainerWindows(this);this.plates=new PlateWindows(this);this.equipment=new EquipmentUI(this);this.storage=inventory.includeEquipment?new EquipmentStorageUI(this):null;
    const screen = $('inventoryScreen');this.touchControls=installTouchControls(screen);
    screen.addEventListener('pointerdown', event => this.down(event));
    screen.addEventListener('pointermove', event => this.motion(event));
    screen.addEventListener('pointerup', event => this.up(event));
    for (const type of ['pointercancel', 'lostpointercapture']) screen.addEventListener(type, event => {
      if (this.gesture?.pointerId === event.pointerId) this.endGesture();
    });
    screen.addEventListener('click', event => {
      if (this.suppressClick) {
        this.suppressClick = false;
        // A drag may produce no synthetic grid click. Do not swallow the next
        // independent tab/summary/control activation when that happens.
        if(event.target.closest('[data-item],[data-cell],[data-equipment]')){event.preventDefault();return;}
      }
      // Keyboard-activated grid buttons share the same command path.
      if (event.detail === 0 && !event.pointerType) this.activate(event.target.closest('[data-item],[data-cell],[data-equipment]'));
    });
    screen.addEventListener('contextmenu', event => {
      const target = event.target.closest('[data-item],[data-equipment]');
      if (target) { event.preventDefault(); this.showMenu(target.dataset.item || inventory.primaryId); }
    });
    $('closeInventory').addEventListener('click', event => this.toggle(false,null,{returnPointer:true,event}));
    $('equipmentSecondary').addEventListener('click',()=>this.run(()=>inventory.switchWeapon(inventory.primaryId===inventory.weaponSlots[0]?1:0)));
    $('clearSelection').addEventListener('click', () => { this.selectedId = null; this.chooseMagazine = false; this.hideMenu(); this.refresh(); });
    $('selectedItemMenu').addEventListener('click', () => this.showMenu(this.selectedId));
    $('closeItemMenu').addEventListener('click', () => this.hideMenu());
    $('insertMagazine').addEventListener('click', () => {
      this.chooseMagazine = true; this.selectedId = null; this.hideMenu(); this.refresh();
    });
    $('removeMagazine').addEventListener('click', () => this.run(() => inventory.removeMagazine()));
    $('rackWeapon').addEventListener('click', () => this.run(() => inventory.rack()));
    $('equipWeapon').addEventListener('click', () => this.run(() => inventory.weapon ? inventory.unequip() : inventory.equip('weapon-01')));
    $('unpackMagazine').addEventListener('click', () => { const id = this.menuId; this.run(() => inventory.unpack(id)); });
    $('installOptic').addEventListener('click',()=>{const id=this.menuId;this.run(()=>inventory.installOptic(id));});
    $('removeOptic').addEventListener('click',()=>this.run(()=>inventory.removeOptic()));
    $('cancelAction').addEventListener('click', () => this.run(() => inventory.cancel()));
    window.addEventListener('keydown', event => {
      if (this.open && !event.repeat && ['Escape', 'Tab', 'KeyI'].includes(event.code)) {
        event.preventDefault(); event.stopImmediatePropagation(); this.toggle(false,null,{returnPointer:event.code!=='Escape',event});
      }
    });
  }
  run(action) {
    this.hideMenu(); const ok = action();
    if (ok) { this.selectedId = null; this.chooseMagazine = false; this.notice = ''; this.onChange(); }
    else { this.notice = this.inventory.lastError || '현재 상태에서는 할 수 없습니다.'; this.noticeUntil = performance.now() + 2400; this.toast(this.notice); }
    this.refresh(); return ok;
  }
  toggle(open = !this.open, container = null,options={}) {
    this.touchControls.clear();this.onBeforeToggle?.(open);
    this.endGesture(); this.open = open; this.container = open ? container : null;
    this.inventory.openContainer(this.container); this.selectedId = null; this.chooseMagazine = false; this.hideMenu();
    this.notice = '';
    $('inventoryScreen').hidden = !open; this.onToggle(open,options);
    if(!open&&this.inventory.includeEquipment)this.inventory.closeBackpack();
    if (open) this.refresh(); else if ($('inventoryScreen').contains(document.activeElement)) document.activeElement.blur();
  }
  refresh() { this.revision = -1; this.update(); }
  down(event) {
    if (event.button !== 0 || this.gesture) return;
    const target = event.target.closest('[data-item],[data-cell],[data-equipment]'); if (!target) return;
    event.preventDefault();
    const id = target.dataset.item, selected = id && id === this.selectedId;
    const draggable = id && !this.inventory.action && (event.pointerType === 'mouse' || selected);
    const rect = target.getBoundingClientRect(), item = this.inventory.items.get(id), size = item ? itemSize(item) : { w: 1, h: 1 };
    // Equipped cards are compact; their spatial grab anchor starts at the top-left cell.
    const equipped = target.closest('[data-equipment],[data-gear-slot]');
    this.gesture = { pointerId: event.pointerId, target, id, draggable, dragging: false, x: event.clientX, y: event.clientY,
      grabX: equipped ? 0 : Math.min(size.w - 1, Math.floor((event.clientX - rect.x) / (rect.width / size.w))),
      grabY: equipped ? 0 : Math.min(size.h - 1, Math.floor((event.clientY - rect.y) / (rect.height / size.h))),
      offsetX: event.clientX - rect.x, offsetY: event.clientY - rect.y };
    target.setPointerCapture(event.pointerId);
  }
  motion(event) {
    const g = this.gesture; if (!g || g.pointerId !== event.pointerId || !g.draggable) return;
    event.preventDefault();
    if (!g.dragging && Math.hypot(event.clientX - g.x, event.clientY - g.y) >= 7) {
      g.dragging = true;this.lastTap=null; this.selectedId = g.id; this.hideMenu();
      const ghost = g.target.cloneNode(true); ghost.removeAttribute('id'); ghost.removeAttribute('data-item');
      ghost.className = 'grid-item drag-ghost'; ghost.style.width = g.target.offsetWidth + 'px'; ghost.style.height = g.target.offsetHeight + 'px';
      document.body.append(ghost); g.ghost = ghost; g.target.classList.add('drag-source');
    }
    if (!g.dragging) return;
    g.ghost.style.left = event.clientX - g.offsetX + 'px'; g.ghost.style.top = event.clientY - g.offsetY + 'px';
    this.preview(this.destination(event.clientX, event.clientY, g));
  }
  destination(x, y, gesture = null) {
    const element = document.elementFromPoint(x, y); if (!element || !$('inventoryScreen').contains(element)) return null;
    const plateSlot=element.closest('[data-plate-slot]');if(plateSlot)return{kind:'plate-slot',slot:plateSlot.dataset.plateSlot,rigId:plateSlot.dataset.plateRigId,target:plateSlot};
    const gearSlot=element.closest('[data-gear-slot]');if(gearSlot)return{kind:'gear-slot',slot:gearSlot.dataset.gearSlot,target:gearSlot};if(element.closest('[data-world-drop-zone]')&&!element.closest('.inventory-grid'))return{kind:'world-drop',target:element.closest('[data-world-drop-zone]')};
    const careTarget=this.careUI?.destination(element);if(careTarget)return careTarget;
    const target = element.closest('[data-item],[data-cell],[data-equipment]');
    const equipment = element.closest('[data-equipment]');
    if (equipment) return { kind: equipment.dataset.equipment==='optic'?'optic':'equipment', target: equipment, id: this.inventory.primaryId,weaponId:equipment.dataset.weaponId||null };
    const grid = element.closest('.inventory-grid'); if (!grid || grid.hidden) return null;
    const rect = grid.getBoundingClientRect(), layout = this.inventory.layout(grid.dataset.owner);
    const cellX = Math.floor((x - rect.x) / (rect.width / layout.cols)), cellY = Math.floor((y - rect.y) / (rect.height / layout.rows));
    if (cellX < 0 || cellY < 0 || cellX >= layout.cols || cellY >= layout.rows) return null;
    return { kind: 'grid', owner: grid.dataset.owner, x: cellX - (gesture?.grabX || 0), y: cellY - (gesture?.grabY || 0),
      id: target?.dataset.item, target: target || grid, grid };
  }
  validDrop(item, dest) {
    const inv = this.inventory, target = inv.items.get(dest?.id);
    if(dest?.kind==='plate-slot'){const rig=inv.items.get(dest.rigId);return item?.kind==='armorPlate'&&!!rig&&!rig.plateSlots?.[dest.slot]&&!plateFits(item.definitionId,rig.armorId||'armor_6b45_basic_test',dest.slot);}
    if(inv.includePlates&&item?.kind==='armorPlate'&&dest?.kind==='world-drop')return true;
    if(inv.includeEquipment&&dest?.kind==='world-drop')return!!item&&['weapon','magazine'].includes(item.kind)||item?.kind==='gear'&&['helmet','rig'].includes(item.definitionId);
    if(inv.includeEquipment&&dest?.kind==='gear-slot')return item?.kind==='gear'&&item.definitionId===dest.slot&&!inv.gearSlots[dest.slot]&&(item.owner.startsWith('ground:')?inv.nearbyIds.has(item.instanceId):inv.canAccess(item.owner));
    if(dest?.kind==='care')return this.careUI.valid(item?.instanceId,dest.careTarget);
    if(dest?.weaponId&&dest.weaponId!==inv.primaryId)return false;
    if (!dest || !item || inv.action) return false;
    if (inv.isDebugWeapon && (dest.kind === 'equipment' || dest.kind === 'optic')) return false;
    if(dest.kind==='optic'||dest.kind==='equipment'&&item.kind==='optic')return item.kind==='optic'&&inv.canAccess(item.owner)&&!inv.optic&&opticDefinition(item).weaponIds.includes(inv.weapon?.definitionId);
    if (dest.kind === 'equipment') return item.kind === 'weapon' ? !inv.weapon && item.owner === 'bag' : item.kind === 'magazine' && (inv.includeEquipment?reloadStorage(inv,item):item.owner === 'bag') && Boolean(inv.weapon);
    if (item.kind === 'ammo' && target?.kind === 'magazine') return (inv.includeEquipment?inv.canAccess(target.owner):target.owner === 'bag') && target.rounds.length < 30 && item.count > 0;
    if (item.owner.startsWith('weapon:')) return item.kind==='optic'?inv.canAccess(dest.owner)&&inv.canPlace(dest.owner,item,dest):(inv.includeEquipment?inv.canAccess(dest.owner)&&inv.canPlace(dest.owner,item,dest):dest.owner === 'bag' && inv.canPlace('bag', item, dest));
    if (item.owner === 'equipment:primary') return dest.owner === 'bag' && inv.canPlace('bag', item, dest);
    if (item.kind === 'ammo' && target?.kind === 'ammo' && item !== target && item.definitionId === target.definitionId) return target.count < AMMO_MAX_STACK;
    return inv.canPlace(dest.owner, item, dest);
  }
  preview(dest) {
    this.clearPreview(); const item = this.inventory.items.get(this.gesture.id), valid = this.validDrop(item, dest);
    if (!dest) return;
    if (dest.kind==='plate-slot'||dest.kind==='world-drop'||dest.kind==='gear-slot'||dest.kind === 'care'||dest.kind === 'equipment' || dest.kind==='optic' || (item?.kind === 'ammo' && this.inventory.items.get(dest.id)?.kind === 'magazine')) dest.target.classList.add(valid ? 'drop-valid' : 'drop-invalid');
    else if (item) {
      const size = itemSize(item);
      for (const cell of dest.grid.querySelectorAll('[data-cell]')) {
        const x = +cell.dataset.x, y = +cell.dataset.y;
        if (x >= dest.x && x < dest.x + size.w && y >= dest.y && y < dest.y + size.h) cell.classList.add(valid ? 'drop-valid' : 'drop-invalid');
      }
    }
  }
  clearPreview() { $('inventoryScreen').querySelectorAll('.drop-valid,.drop-invalid').forEach(e => e.classList.remove('drop-valid', 'drop-invalid')); }
  up(event) {
    const g = this.gesture; if (!g || g.pointerId !== event.pointerId) return;
    event.preventDefault(); const dest = g.dragging ? this.destination(event.clientX, event.clientY, g) : null;
    this.suppressClick = true; this.endGesture(false);
    if (g.dragging) { if (dest) this.drop(g.id, dest); else this.refresh(); }
    else this.activate(g.target);
  }

  endGesture(refresh = true) {
    const g = this.gesture; if (!g) return;
    this.gesture = null; g.ghost?.remove(); g.target.classList.remove('drag-source'); this.clearPreview();
    if (g.target.hasPointerCapture(g.pointerId)) g.target.releasePointerCapture(g.pointerId);
    if (refresh) this.refresh();
  }
  activate(target) {
    if (!target) return;
    const inv = this.inventory, id = target.dataset.item, item = inv.items.get(id), selected = inv.items.get(this.selectedId);
    if(inv.includeEquipment&&item?.kind==='gear'){const now=performance.now();if(item.definitionId==='rig'&&this.lastTap?.id===id&&now-this.lastTap.time<=MEDICAL_ITEMS.doubleTapMs){this.lastTap=null;this.plates.open(id);}else this.lastTap={id,time:now};this.selectedId=id;this.hideMenu();this.refresh();return;}
    const plateSlot=target.closest('[data-plate-slot]');if(plateSlot&&selected?.kind==='armorPlate'&&!id){this.drop(selected.instanceId,{kind:'plate-slot',rigId:plateSlot.dataset.plateRigId,slot:plateSlot.dataset.plateSlot});return;}
    const gearSlot=target.closest('[data-gear-slot]');if(inv.includeEquipment&&gearSlot&&selected?.kind==='gear'){this.drop(selected.instanceId,{kind:'gear-slot',slot:gearSlot.dataset.gearSlot});return;}
    if(item?.kind==='armorPlate'){this.selectedId=this.selectedId===id?null:id;this.hideMenu();this.refresh();return;}
    if(isMedicalItem(item)){
      if(item.kind==='medicalContainer'){const now=performance.now();if(this.lastTap?.id===id&&now-this.lastTap.time<=MEDICAL_ITEMS.doubleTapMs){this.lastTap=null;this.selectedId=null;this.windows.open(id);this.refresh();return;}this.lastTap={id,time:now};}else this.lastTap=null;
      // Medical items have no combine/use action in M2. Tap inspects; empty-cell
      // placement and held dragging still use the original shared drop path.
      this.selectedId=this.selectedId===id?null:id;this.hideMenu();this.refresh();return;
    }else this.lastTap=null;
    if (this.chooseMagazine && item?.kind === 'magazine') { this.run(() => inv.beginReload(id)); return; }
    // Only a completed tap/click toggles selection; a second held press can still drag.
    if (item && id === this.selectedId) { this.selectedId = null; this.hideMenu(); this.refresh(); return; }
    const equipment = target.closest('[data-equipment]');
    if (equipment) {
      if (inv.isDebugWeapon) return;
      if(equipment.dataset.equipment==='optic'){
        if(selected?.kind==='optic'&&selected.instanceId!==id)this.drop(selected.instanceId,{kind:'optic'});
        else if(item?.kind==='optic'){this.selectedId=id;this.hideMenu();this.refresh();}
        return;
      }
      if (item?.kind === 'magazine' && item.owner.startsWith('weapon:')) { this.selectedId = id; this.hideMenu(); this.refresh(); return; }
      if (selected && (selected.kind === 'optic'||(selected.kind === 'magazine' || selected.kind === 'weapon') && selected.owner === 'bag')) this.drop(selected.instanceId, { kind: 'equipment' });
      else if (inv.weapon) { this.selectedId = inv.primaryId; this.hideMenu(); this.refresh(); }
      return;
    }
    if (selected && id !== selected.instanceId && (target.dataset.cell || item)) {
      const cell = item?.cell || { x: +target.dataset.x, y: +target.dataset.y };
      this.drop(selected.instanceId, { kind: 'grid', owner: item?.owner || target.closest('.inventory-grid').dataset.owner, ...cell, id }); return;
    }
    if (item) {
      this.selectedId = id; this.hideMenu(); if (item.kind === 'magazine') inv.selectMagazine(id);
      this.refresh();
    }
  }
  drop(id, dest) {
    if(dest.kind==='care'){this.careUI.choose(id,dest.careTarget);this.refresh();return;}
    const inv = this.inventory, item = inv.items.get(id), target = inv.items.get(dest.id); if (!item) { this.refresh(); return; }
    this.run(() => {
      if(inv.includePlates&&dest.kind==='plate-slot')return inv.movePlate(id,{owner:mountedOwner(dest.rigId,dest.slot)});
      if(inv.includePlates&&item.kind==='armorPlate'&&(plateMount(item.owner)||dest.kind==='world-drop'))return inv.movePlate(id,{owner:dest.kind==='world-drop'?'world':dest.owner,cell:dest.kind==='grid'?{x:dest.x,y:dest.y}:undefined});
      if(inv.includeEquipment&&dest.kind==='world-drop')return inv.dropItem(id);
      if(inv.includeEquipment&&dest.kind==='gear-slot')return item.definitionId===dest.slot?inv.wearGear(id):false;
      if(inv.includeEquipment&&item.owner.startsWith('ground:')&&item.kind==='gear'&&dest.kind!=='grid')return inv.fail('장비 칸이나 배낭으로 옮기세요.');
      if(inv.includeEquipment&&item.owner.startsWith('ground:'))return inv.pickupItem(id,{destination:dest.kind==='grid'?{owner:dest.owner,cell:{x:dest.x,y:dest.y}}:null});
      if(inv.includeEquipment&&dest.owner==='bag'&&!inv.backpackOpen)return inv.openBackpack({kind:item.owner.startsWith('weapon:')?(item.kind==='optic'?'optic-remove':'remove-magazine'):item.owner==='equipment:primary'?'unequip':'move',id,x:dest.x,y:dest.y});
      if (inv.isDebugWeapon && (dest.kind === 'equipment' || dest.kind === 'optic')) return inv.fail('디버그 3번 슬롯은 일반 장비를 장착할 수 없습니다.');
      if(dest.kind==='optic'||dest.kind==='equipment'&&item.kind==='optic')return inv.installOptic(id);
      if (dest.kind === 'equipment') return item.kind === 'magazine' ? inv.beginReload(id) : item.kind === 'weapon' ? inv.equip(id) : inv.fail('총 또는 탄창을 주무기 슬롯으로 옮기세요.');
      if (item.kind === 'ammo' && target?.kind === 'magazine') return inv.pack(target.instanceId, id);
      if (item.owner === 'equipment:primary') return dest.owner === 'bag' ? inv.unequip({ x: dest.x, y: dest.y }) : inv.fail('총은 내 가방에 보관하세요.');
      if (item.owner.startsWith('weapon:')) return item.kind==='optic' ? inv.removeOptic({x:dest.x,y:dest.y},dest.owner) : (dest.owner==='bag'||inv.includeEquipment) ? inv.removeMagazine({ x: dest.x, y: dest.y },dest.owner) : inv.fail('분리할 탄창을 내 가방으로 옮기세요.');
      return inv.move(id, dest.owner, dest.x, dest.y);
    });
  }
  hideMenu() { $('itemMenu').hidden = true; this.menuId = null; }
  showMenu(id) {
    const item = this.inventory.items.get(id); if (!item || item.kind==='armorPlate'||item.kind==='gear'||item.kind === 'ammo' || isMedicalItem(item)) return;
    this.menuId = id; $('itemMenuTitle').textContent = itemName(item); $('itemMenu').hidden = false;
    const gun = item.kind === 'weapon', installed = gun && item.owner === 'equipment:primary', busy = Boolean(this.inventory.action);
    for (const key of ['insertMagazine', 'removeMagazine', 'rackWeapon', 'equipWeapon']) $(key).hidden = !gun;
    $('unpackMagazine').hidden = item.kind !== 'magazine'; $('unpackMagazine').disabled = busy || item.owner !== 'bag' || !item.rounds?.length;
    $('insertMagazine').disabled = busy || !installed; $('removeMagazine').disabled = busy || !installed || !this.inventory.magazine;
    $('rackWeapon').disabled = busy || !installed; $('equipWeapon').disabled = busy;
    $('equipWeapon').textContent = installed ? '총을 가방에 넣기' : '주무기 장착';
    const mounted=item.kind==='optic'&&item.owner.startsWith('weapon:');
    $('installOptic').hidden=item.kind!=='optic'||mounted;
    $('installOptic').disabled=busy||this.inventory.isDebugWeapon||!this.inventory.weapon||!this.inventory.canAccess(item.owner)||Boolean(this.inventory.optic);
    $('removeOptic').hidden=!(mounted||installed&&this.inventory.optic);
    $('removeOptic').disabled=busy;
  }
  makeItem(item) {
    const node = document.createElement('button'); node.type = 'button'; node.dataset.item = item.instanceId; node.dataset.kind = item.kind;
    node.className = 'grid-item'+(isMedicalItem(item)?' medical-item':'') + (item.instanceId === this.selectedId ? ' selected' : ''); node.setAttribute('aria-pressed', String(item.instanceId === this.selectedId));
    const count = item.kind==='armorPlate'?item.condition.current.toFixed(1)+'/'+item.condition.max:item.kind==='gear'?(this.inventory.itemWeightKg(item)).toFixed(2)+'kg':item.kind==='medicalContainer'? (this.inventory.itemWeightKg(item)*1000).toFixed(0)+'g':item.kind==='medicalSupply'?(item.remainingFraction!==undefined?Math.ceil(item.remainingFraction*100)+'%':item.remaining+'/'+(item.maximumUses??medicalDefinition(item).units)):item.kind === 'optic' ? `${itemSize(item).w} × ${itemSize(item).h}` : item.kind === 'ammo' ? item.count + '/60' : item.kind === 'magazine' ? item.rounds.length + '/30' : WEAPONS[item.definitionId].ammo.caliber;
    node.setAttribute('aria-label', `${itemName(item)} ${count}`);
    node.innerHTML = `${item.kind==='armorPlate'?gearIcons.rig:item.kind==='gear'?gearIcons[item.definitionId]:icons[item.kind]||medicalIcon}<span class="item-name"></span><span class="item-count"></span>`;
    node.querySelector('.item-name').textContent = medicalDefinition(item)?.shortName||itemName(item); node.querySelector('.item-count').textContent = count;
    node.title = item.kind === 'magazine' ? (item.rounds[0] ? ammoName(item.rounds[0]) : '빈 탄창') : itemName(item);
    return node;
  }
  renderGrid(element, owner) {
    const grid = this.inventory.layout(owner), nodes = [];
    element.style.setProperty('--cols', grid.cols); element.style.setProperty('--rows', grid.rows);
    for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'grid-cell'; cell.dataset.cell = 'true'; cell.dataset.x = x; cell.dataset.y = y;
      cell.setAttribute('aria-label', `빈 칸 ${x + 1}, ${y + 1}`); cell.style.gridColumn = x + 1; cell.style.gridRow = y + 1; nodes.push(cell);
    }
    for (const item of this.inventory.items.values()) if (item.owner === owner && item.cell) {
      const node = this.makeItem(item), size = itemSize(item); node.style.gridColumn = `${item.cell.x + 1} / span ${size.w}`; node.style.gridRow = `${item.cell.y + 1} / span ${size.h}`; nodes.push(node);
    }
    for (const r of this.inventory.action?.reservations || []) if (r.owner === owner) {
      const placeholder = document.createElement('div'); placeholder.className = 'grid-reservation'; placeholder.textContent = this.inventory.action.kind==='optic-remove'?'분리 중':'장전 중';
      placeholder.style.gridColumn = `${r.cell.x + 1} / span ${r.w}`; placeholder.style.gridRow = `${r.cell.y + 1} / span ${r.h}`; nodes.push(placeholder);
    }
    element.replaceChildren(...nodes);
  }
  update() {
    if (!this.open) return;
    const inv = this.inventory, a = inv.action;
    $('inventoryAction').hidden = !a; $('actionLabel').textContent = a ? `${phases[a.phase]||a.phase}${a.transferred !== undefined ? ` ${a.transferred}/${a.rounds}` : ''}` : '';
    $('actionFill').style.width = a ? `${a.elapsed / a.duration * 100}%` : '0';
    const selected = inv.items.get(this.selectedId), notice = this.notice && performance.now() < this.noticeUntil;
    $('selectionHint').textContent = notice ? this.notice : this.chooseMagazine ? '장착할 리그·벨트 탄창을 선택하세요.' : selected ? `${itemName(selected)} · 다시 누르면 해제 / 누른 채 끌어 이동` : '터치: 선택 후 다시 눌러 끌기 · PC: 좌클릭 드래그 / 총 우클릭';
    $('selectedItemMenu').hidden = !selected || selected.kind === 'ammo'||selected.kind==='armorPlate'||isMedicalItem(selected);
    if(isMedicalItem(selected)){const def=medicalDefinition(selected);$('selectionHint').textContent=def.name+' · '+def.description+(def.target?' 대상: '+def.target:' · 두 번 눌러 열기')+' · '+(this.inventory.itemWeightKg(selected)*1000).toFixed(1)+'g'+(selected.kind==='medicalSupply'?' · 남은 '+selected.remaining+'/'+(selected.maximumUses??def.units):'');}
    this.windows.update(false);this.plates.update();this.equipment.update();this.storage?.update();this.corpse?.update();
    $('selectionHint').classList.toggle('inventory-error', Boolean(notice));
    if (this.gesture || this.revision === inv.revision) return;
    this.revision = inv.revision; if (!inv.items.has(this.selectedId)) this.selectedId = null;
    this.renderGrid($('playerGrid'), 'bag'); $('containerGrid').hidden = !this.container; $('containerHint').hidden = Boolean(this.container);
    $('containerTitle').textContent = this.container ? '탄약상자' : '주변 보관함';
    $('containerCount').textContent = this.container ? '탄약 · Vudu · 6 × 6' : '';
    if (this.container) this.renderGrid($('containerGrid'), CRATE_OWNER);
    const equipment = $('equipmentSlot'); equipment.replaceChildren();
    if (inv.isDebugWeapon) {
      const title = document.createElement('strong'); title.className = 'debug-equipment-label'; title.textContent = '3 · 디버그 AK'; equipment.append(title);
      const detail = document.createElement('span'); detail.className = 'equipment-detail'; detail.textContent = '디버그 전용 · 일반 장비 아님 · ∞ 무한 탄창'; equipment.append(detail);
    } else if (inv.weapon) {
      const node = this.makeItem(inv.weapon); node.classList.add('equipped-gun'); equipment.append(node);
      const detail = document.createElement('span'); detail.className = 'equipment-detail';
      detail.textContent = `약실 ${inv.weapon.chamber ? '1 · ' + ammoName(inv.weapon.chamber) : '비어 있음'} / 탄창 ${inv.magazine?.rounds.length || 0}`; equipment.append(detail);
      if (inv.magazine) { const mag = this.makeItem(inv.magazine); mag.classList.add('mounted-magazine'); equipment.append(mag); }
    } else { equipment.textContent = '주무기 슬롯 · 가방의 총을 여기로 옮기세요'; }
    const opticSlot=$('opticSlot');opticSlot.replaceChildren();
    if(inv.isDebugWeapon){const empty=document.createElement('button');empty.type='button';empty.disabled=true;empty.textContent='디버그 · 장착 불가';opticSlot.append(empty);}
    else if(inv.optic){const card=this.makeItem(inv.optic);card.classList.add('mounted-optic');opticSlot.append(card);}
    else{const empty=document.createElement('button');empty.type='button';empty.dataset.equipment='optic';empty.textContent=inv.weapon?.definitionId==='ak74m'?'AK · 미지원':'조준경 · 비어 있음';empty.setAttribute('aria-label',inv.weapon?.definitionId==='ak74m'?'AK 조준경 장착 미지원':'M4 조준경 장착 슬롯 · 비어 있음');opticSlot.append(empty);}
    $('equipmentWeight').textContent=inv.isDebugWeapon?'디버그 전용 3번 슬롯 · 휴대 장비 무게에 포함하지 않음':inv.weapon?`총 ${inv.weaponWeightKg.toFixed(2)} kg${inv.optic?' · Vudu 장착':''}`:'';
    $('inventoryTotal').textContent = `보유 ${inv.carriedRounds()}발`;
    this.windows.update(true);this.equipment.update();this.storage?.update();
    if (this.menuId) this.showMenu(this.menuId);
  }
}
