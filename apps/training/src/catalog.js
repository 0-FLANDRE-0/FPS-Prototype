import{referenceMuzzleVelocity}from'./g7-drag.js';
import { ORIGINAL_TABLES, TRAINING_PROFILES, AK_PROFILES, SCAR_PROFILES, TRAINING_BUILD, SOURCE_HASHES, computeProjectileKinetics } from './generated/catalog.js';
import {SCAR_DATA} from './scar-data.js';
import { AK74M,SCAR_H } from './weapon-data.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const CATALOG = freeze(ORIGINAL_TABLES);
export const M4_BUILD = freeze(TRAINING_BUILD);
freeze(TRAINING_PROFILES); freeze(SOURCE_HASHES);
export const MAGAZINE = freeze({ id: 'stanag_556_30', kind: 'magazine', name: 'STANAG 30발 탄창', capacity: CATALOG.WEAPON_REGISTRY.m4a1.reload.magazineSize,
  caliber: '5.56x45mm', weaponIds: ['m4a1', 'm16a2', 'm249'], allowedAmmoIds: CATALOG.WEAPON_REGISTRY.m4a1.ammo.allowedAmmoIds });
export const AK_MAGAZINE = freeze({id:'ak_545_30',kind:'magazine',name:'AK 5.45 30발 탄창',capacity:30,caliber:'5.45x39mm',weaponIds:['ak74m'],allowedAmmoIds:AK74M.ammo.allowedAmmoIds});
export const SCAR_MAGAZINE=freeze({id:'scar_762_20',kind:'magazine',name:'SCAR-H 7.62 20발 탄창',capacity:20,caliber:'7.62x51mm',weaponIds:['scar_h'],allowedAmmoIds:SCAR_H.ammo.allowedAmmoIds});
export const magazineDefinition = item => item?.definitionId===SCAR_MAGAZINE.id?SCAR_MAGAZINE:item?.definitionId === AK_MAGAZINE.id ? AK_MAGAZINE : MAGAZINE;
export const compatibleAmmo = (weaponId='m4a1') => weaponId==='scar_h'?SCAR_MAGAZINE.allowedAmmoIds:weaponId==='ak74m'?AK_MAGAZINE.allowedAmmoIds:MAGAZINE.allowedAmmoIds;
export const ammoName = id => CATALOG.AMMO_REGISTRY[id]?.display.shortName || CATALOG.AMMO_PRESETS[id]?.name || id;
export function catalogCounts() {
  return Object.fromEntries(Object.entries(CATALOG).filter(([key]) => key.endsWith('REGISTRY')).map(([key, value]) => [key, Object.keys(value).length]));
}
const scarBallisticsCache=new Map();
export function shotBallistics(ammoId, weaponId='m4a1') {
  if(weaponId==='scar_h'&&scarBallisticsCache.has(ammoId))return scarBallisticsCache.get(ammoId);
  const ammo = CATALOG.AMMO_PRESETS[ammoId], profile = (weaponId==='scar_h'?SCAR_PROFILES:weaponId==='ak74m'?AK_PROFILES:TRAINING_PROFILES)[ammoId];
  if (!ammo || !profile) throw new Error('Unsupported cartridge: ' + ammoId);
  let muzzleVelocityMps = CATALOG.AMMO_VELOCITY[ammoId] * profile.velocityMul;
  if(weaponId==='scar_h'){const distance=SCAR_DATA.referenceRangeByAmmo[ammoId]||0,retention=CATALOG.DRAG_RETENTION_PER_100M[ammo.velocityDragClass]||.95;muzzleVelocityMps=referenceMuzzleVelocity(SCAR_DATA.sourceVelocityMps[ammoId],distance,SCAR_DATA.g7BC[ammoId],retention)*SCAR_DATA.barrelRatio;}
  const kinetics = computeProjectileKinetics(ammo, muzzleVelocityMps, muzzleVelocityMps);
  if (!kinetics.hasKinetics) throw new Error('Projectile mass missing: ' + ammoId);
  // Original helper retains its rounded reporting interface. The recoil impulse uses full precision.
  const result=Object.freeze({ ammoId, weaponId, projectileMassKg: kinetics.massKg, projectileCount: kinetics.projectileCount,
    muzzleVelocityMps, projectileMomentumNs: kinetics.massKg * muzzleVelocityMps * kinetics.projectileCount,
    muzzleEnergyJ: 0.5 * kinetics.massKg * muzzleVelocityMps ** 2 * kinetics.projectileCount,
    weaponMassKg: weaponId==='scar_h'?SCAR_H.physical.weightKg:weaponId==='ak74m'?AK74M.physical.weightKg:profile.weightKg, kinetics });if(weaponId==='scar_h')scarBallisticsCache.set(ammoId,result);return result;
}
