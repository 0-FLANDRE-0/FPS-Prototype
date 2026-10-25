import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {Inventory} from '../apps/training/src/inventory.js';
import {CATALOG,shotBallistics} from '../apps/training/src/catalog.js';
import {computeProjectileKinetics} from '../apps/training/src/generated/catalog.js';
import {DEBUG_WEAPON,debugShotBallistics,debugRecoilBallistics,debugZeroingPreset,validDebugVelocity} from '../apps/training/src/debug-weapon.js';
import {AimState} from '../apps/training/src/aim.js';
import {zeroingPreset,zeroingDirection} from '../apps/training/src/zeroing.js';
import {sightGeometry} from '../apps/training/src/sight-geometry.js';
import {weaponMarkers} from '../apps/training/src/weapon-data.js';
import {traceShot} from '../apps/training/src/ballistics.js';

function finishSwitch(inv,slot){assert.equal(inv.switchWeapon(slot),true);for(let i=0;i<240&&inv.action;i++)inv.step(1/60);assert.equal(inv.action,null);}

test('debug slot is isolated from ordinary items, equip/storage and ammunition conservation',()=>{
  const ordinary=new Inventory(),inv=new Inventory({includeDebug:true,nativeHandling:true});
  assert.equal(ordinary.switchWeapon(2),false);assert.deepEqual(inv.snapshot(),ordinary.snapshot());
  const before=structuredClone([...inv.items.values()]),rounds=inv.roundCounts();
  finishSwitch(inv,2);assert.equal(inv.isDebugWeapon,true);assert.equal(inv.weapon.definitionId,'ak74m');
  assert.equal(inv.items.has(DEBUG_WEAPON.instanceId),false);assert.equal(inv.loadedRounds,Infinity);
  assert.equal(inv.unequip(),false);assert.equal(inv.move(DEBUG_WEAPON.instanceId,'bag',0,0),false);assert.equal(inv.equip(DEBUG_WEAPON.instanceId),false);
  assert.equal(inv.beginReload(),false);assert.equal(inv.rack(),false);assert.equal(inv.magazine,null);
  assert.equal(inv.selectDebugAmmo('762x54r_7n37_bs'),true);
  for(let i=0;i<500;i++)assert.equal(inv.fire(),'762x54r_7n37_bs');
  assert.equal(inv.weapon.chamber,'762x54r_7n37_bs');assert.deepEqual(inv.spent,{});assert.deepEqual(inv.roundCounts(),rounds);
  finishSwitch(inv,0);assert.deepEqual([...inv.items.values()],before);assert.deepEqual(inv.snapshot().initialByAmmo,ordinary.snapshot().initialByAmmo);
});

test('all 114 registry cartridges use their unchanged registry muzzle speed and projectile mass',()=>{
  const ids=Object.keys(CATALOG.AMMO_REGISTRY);assert.equal(ids.length,114);
  for(const ammoId of ids){
    const b=debugShotBallistics({ammoId}),expected=computeProjectileKinetics(CATALOG.AMMO_PRESETS[ammoId],CATALOG.AMMO_VELOCITY[ammoId],CATALOG.AMMO_VELOCITY[ammoId]);
    assert.equal(b.muzzleVelocityMps,CATALOG.AMMO_VELOCITY[ammoId],ammoId);assert.equal(b.projectileMassKg,expected.massKg,ammoId);assert.equal(b.projectileCount,expected.projectileCount,ammoId);
    assert.equal(b.muzzleEnergyJ,.5*b.projectileMassKg*b.muzzleVelocityMps**2*b.projectileCount,ammoId);
    assert.equal(debugZeroingPreset({ammoId,autoZero:false}),zeroingPreset('ak74m'));
  }
  assert.deepEqual(debugRecoilBallistics(),shotBallistics('545_ps_gs','ak74m'));
});

test('manual speed overrides are finite and bounded, clear to registry speed, and reject atomically',()=>{
  const inv=new Inventory({includeDebug:true});assert.equal(inv.setDebugVelocity('123.456'),true);assert.equal(inv.debugState.muzzleVelocityMps,123.456);
  for(const invalid of [0,-1,5001,NaN,Infinity,'no']){assert.throws(()=>validDebugVelocity(invalid));const before=inv.debugState;assert.equal(inv.setDebugVelocity(invalid),false);assert.equal(inv.debugState,before);}
  assert.equal(inv.setDebugVelocity(''),true);assert.equal(inv.debugState.velocityOverrideMps,null);assert.equal(inv.debugState.muzzleVelocityMps,CATALOG.AMMO_VELOCITY['545_ps_gs']);
  const before=inv.debugState;assert.equal(inv.selectDebugAmmo('invented-round'),false);assert.equal(inv.debugState,before);
});

test('selected-ammo automatic zero reaches the original AK 100 m +24 cm plane using production trace',()=>{
  const g=sightGeometry('ak74m'),origin=new Vector3(...weaponMarkers('ak74m').muzzle).sub(g.rear).applyQuaternion(g.visualAlignment);
  const plane={bodyPaths:()=>[],armorContacts:()=>[],contact:(o,d,max)=>{const distance=(-100-o.z)/d.z;return distance>=0&&distance<=max?{id:'debug-zero-plane',kind:'target',distance,point:o.clone().addScaledVector(d,distance),normal:new Vector3(0,0,1)}:null;}};
  for(const [ammoId,velocityOverrideMps]of [...Object.keys(CATALOG.AMMO_REGISTRY).map(id=>[id,null]),['556_m855',700]]){
    const state={ammoId,velocityOverrideMps,autoZero:true},p=debugZeroingPreset(state),b=debugShotBallistics(state);
    assert.equal(p.distanceM,100);assert.equal(p.offsetM,.24);assert.equal(p.referenceAmmoId,ammoId);
    const direction=zeroingDirection(g.sightAxis,g.visualAlignment,p.thetaRad),trace=traceShot(plane,origin,direction,b,{simulateFlight:true,maxDistance:620});
    assert.equal(trace.hit?.id,'debug-zero-plane',ammoId);assert.ok(Math.abs(trace.hit.point.y-.24)<.0001,ammoId+': '+trace.hit.point.y);
    assert.equal(debugZeroingPreset(state),p);
  }
});

test('unreachable slow automatic zero is reported without inventing an angle or changing existing settings',()=>{
  const inv=new Inventory({includeDebug:true});assert.equal(inv.setDebugVelocity(1),true);assert.equal(inv.setDebugAutoZero(true),false);assert.match(inv.lastError,/도달|비행 한계/);
  assert.equal(inv.debugState.autoZero,false);assert.equal(inv.debugState.zeroing,zeroingPreset('ak74m'));
  inv.reset();assert.equal(inv.setDebugAutoZero(true),true);const before=inv.debugState;
  assert.equal(inv.setDebugVelocity(1),false);assert.equal(inv.debugState,before);
});

test('debug aim elevation does not change the pose, hip/ADS geometry, or the ordinary zeroing table',()=>{
  const aim=new AimState();aim.setWeapon('ak74m');aim.position.set(1,2,3);aim.muzzle.set(4,5,6);aim.quaternion=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.3);
  const base=aim.shotPose(),muzzle=aim.muzzle.clone(),rotation=aim.quaternion.clone(),preset=zeroingPreset('ak74m');
  const p=debugZeroingPreset({ammoId:'9mm_115gr',autoZero:true});aim.zeroingOverride=p;
  assert.ok(aim.shotPose().direction.distanceTo(base.direction)>.001);assert.deepEqual(aim.muzzle,muzzle);assert.deepEqual(aim.quaternion,rotation);assert.equal(zeroingPreset('ak74m'),preset);
  aim.zeroingOverride=null;assert.deepEqual(aim.shotPose(),base);aim.reset();assert.equal(aim.zeroingOverride,null);
});
