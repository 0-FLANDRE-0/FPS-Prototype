import{SCAR_ZEROING}from'./generated/scar-zeroing.js';
import { Vector3 } from 'three';
import { ZEROING_TABLE } from './generated/zeroing.js';

export function zeroingPreset(weaponId, optic = null) {
  if(weaponId==='scar_h')return SCAR_ZEROING[optic?.id||'iron'];
  return ZEROING_TABLE[optic?.id || weaponId] || null;
}
// Fixed hardware elevation, including hip fire. No view/recoil mutation and no
// model-alignment angle added here. Undefined θ preserves an unverified weapon.
export function zeroingDirection(sightAxis, rotation, thetaRad) {
  if (thetaRad === undefined) return new Vector3(0,0,-1).applyQuaternion(rotation);
  return sightAxis.clone().applyAxisAngle(new Vector3(1,0,0),thetaRad).applyQuaternion(rotation).normalize();
}
