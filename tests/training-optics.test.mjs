import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Inventory,CRATE_OWNER,itemSize,GRID_LAYOUTS} from '../apps/training/src/inventory.js';
import {VUDU} from '../apps/training/src/optic-data.js';
import {shotBallistics} from '../apps/training/src/catalog.js';
import {recoilImpulse} from '../apps/training/src/recoil.js';
const id='optic-vudu-01',advance=(inv,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)inv.step(1/60);};
function invariant(inv){
 const optic=inv.items.get(id);assert.equal([...inv.items.values()].filter(i=>i.definitionId===VUDU.id).length,1);
 for(const weapon of [...inv.items.values()].filter(i=>i.kind==='weapon'))if(weapon.opticId){assert.equal(weapon.definitionId,'m4a1');assert.equal(weapon.opticId,id);assert.equal(optic.owner,'weapon:'+weapon.instanceId);assert.equal(optic.cell,undefined);}
 if(optic.owner.startsWith('weapon:'))assert.equal(inv.items.get(optic.owner.slice(7)).opticId,id);
 for(const owner of Object.keys(GRID_LAYOUTS)){const seen=new Set();for(const item of inv.items.values())if(item.owner===owner){assert.ok(item.cell);const {w,h}=itemSize(item);for(let y=item.cell.y;y<item.cell.y+h;y++)for(let x=item.cell.x;x<item.cell.x+w;x++){assert.ok(x<GRID_LAYOUTS[owner].cols&&y<GRID_LAYOUTS[owner].rows);assert.ok(!seen.has(`${x},${y}`));seen.add(`${x},${y}`);}}}
 assert.equal(inv.totalRounds()+Object.values(inv.spent).reduce((a,b)=>a+b,0),inv.initialRounds);
}
function mount(inv){inv.openContainer(CRATE_OWNER);assert.equal(inv.installOptic(id),true);advance(inv,VUDU.installSeconds);invariant(inv);}
function fillBag(inv){for(let y=0;y<5;y++)for(let x=0;x<6;x++){const item={instanceId:`filler-${x}-${y}`,kind:'ammo',definitionId:'556_m855',count:0,owner:'bag',cell:{x,y}};if(inv.canPlace('bag',item,item.cell))inv.items.set(item.instanceId,item);}}

test('Vudu starts as one 1×2 crate item, without changing either weapon loadout or ammo',()=>{
 const inv=new Inventory();assert.deepEqual(itemSize(inv.items.get(id)),{w:1,h:2});assert.equal(inv.items.get(id).owner,CRATE_OWNER);assert.equal(inv.optic,null);assert.equal(inv.weaponWeightKg,shotBallistics('556_m855').weaponMassKg);invariant(inv);
 assert.equal(inv.installOptic(id),false);inv.openContainer(CRATE_OWNER);const item=inv.items.get(id);assert.equal(inv.canPlace(CRATE_OWNER,item,{x:0,y:5}),false);
});
test('optic installation commits once at one second; actions/fire/storage changes are locked and cancellation is atomic',()=>{
 for(const time of [.1,.5,.98]){const inv=new Inventory();inv.openContainer(CRATE_OWNER);const before=structuredClone(inv.items.get(id));assert.equal(inv.installOptic(id),true);advance(inv,time);assert.equal(inv.optic,null);assert.equal(inv.fire(),null);assert.equal(inv.beginReload(),false);assert.equal(inv.installOptic(id),false);assert.equal(inv.move(id,'bag',5,3),false);inv.cancel();assert.deepEqual(inv.items.get(id),before);invariant(inv);}
 const inv=new Inventory();mount(inv);assert.equal(inv.action,null);assert.equal(inv.optic.instanceId,id);assert.ok(Math.abs(inv.weaponWeightKg-3.64)<1e-12);assert.equal(inv.attachmentWeightKg,.57);advance(inv,2);invariant(inv);assert.equal(inv.installOptic(id),false);
});
test('crate close interrupts external optic handling while a bag installation can continue',()=>{
 const inv=new Inventory();inv.openContainer(CRATE_OWNER);inv.installOptic(id);advance(inv,.5);inv.openContainer(null);assert.equal(inv.action,null);assert.equal(inv.items.get(id).owner,CRATE_OWNER);invariant(inv);
 inv.openContainer(CRATE_OWNER);const cell=inv.findCell('bag',inv.items.get(id));assert.equal(inv.move(id,'bag',cell.x,cell.y),true);inv.installOptic(id);inv.openContainer(null);assert.equal(inv.action.kind,'optic-install');advance(inv,1);assert.equal(inv.optic.instanceId,id);invariant(inv);
});
test('AK refuses Vudu, M4 attachment follows its weapon through switches and storage',()=>{
 const inv=new Inventory();mount(inv);inv.switchWeapon(1);advance(inv,2);assert.equal(inv.optic,null);assert.equal(inv.attachmentWeightKg,0);assert.equal(inv.items.get('weapon-01').opticId,id);assert.equal(inv.installOptic(id),false);assert.match(inv.lastError,/M4.*AK/);invariant(inv);
 inv.switchWeapon(0);advance(inv,2);assert.equal(inv.optic.instanceId,id);const spare=inv.items.get('ak-mag-02'),cell=inv.findCell(CRATE_OWNER,spare);assert.equal(inv.move(spare.instanceId,CRATE_OWNER,cell.x,cell.y),true);assert.equal(inv.unequip(),true);assert.equal(inv.rootOwner(inv.items.get(id)),'bag');assert.equal(inv.equip('weapon-01'),true);assert.equal(inv.optic.instanceId,id);invariant(inv);
});
test('removal requires a full 1×2 destination, reserves it, and returns the same item only at completion',()=>{
 const inv=new Inventory();mount(inv);fillBag(inv);assert.equal(inv.removeOptic(),false);assert.match(inv.lastError,/1 × 2/);inv.items.delete('filler-5-4');assert.equal(inv.removeOptic(),false);inv.items.delete('filler-5-3');assert.equal(inv.removeOptic(),true);assert.deepEqual(inv.action.cell,{x:5,y:3});assert.deepEqual(inv.action.reservations[0],{owner:'bag',cell:{x:5,y:3},w:1,h:2});advance(inv,.4);assert.equal(inv.optic.instanceId,id);inv.cancel();assert.equal(inv.optic.instanceId,id);invariant(inv);
 assert.equal(inv.removeOptic({x:5,y:3}),true);advance(inv,.8);assert.equal(inv.optic,null);assert.deepEqual(inv.items.get(id).cell,{x:5,y:3});assert.equal(inv.weaponWeightKg,3.07);invariant(inv);
});
test('weapon switching cancels unfinished attachment transfers; crate detach is cancelled on loss of access',()=>{
 const inv=new Inventory();inv.openContainer(CRATE_OWNER);inv.installOptic(id);advance(inv,.5);inv.switchWeapon(1);advance(inv,2);assert.equal(inv.items.get(id).owner,CRATE_OWNER);invariant(inv);
 inv.switchWeapon(0);advance(inv,2);mount(inv);const cell=inv.findCell(CRATE_OWNER,inv.optic);inv.removeOptic(cell,CRATE_OWNER);advance(inv,.4);inv.openContainer(null);assert.equal(inv.optic.instanceId,id);invariant(inv);
 inv.openContainer(CRATE_OWNER);assert.equal(inv.removeOptic(cell,CRATE_OWNER),true);advance(inv,.8);assert.equal(inv.items.get(id).owner,CRATE_OWNER);invariant(inv);
});
test('570g uses the existing recoil mass term only; projectile energy and angular recoil coefficients stay unchanged',()=>{
 const base=shotBallistics('556_m855'),withScope={...base,weaponMassKg:base.weaponMassKg+VUDU.weightKg},a=recoilImpulse(base,1),b=recoilImpulse(withScope,1);
 assert.equal(withScope.muzzleEnergyJ,base.muzzleEnergyJ);assert.equal(b.impulseNs,a.impulseNs);assert.equal(b.pitchVelocityRadS,a.pitchVelocityRadS);assert.equal(b.yawVelocityRadS,a.yawVelocityRadS);assert.ok(Math.abs(b.rearVelocityMps/a.rearVelocityMps-base.weaponMassKg/withScope.weaponMassKg)<1e-12);
});
