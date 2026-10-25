import {Vector3} from 'three';
import {CATALOG,shotBallistics} from './catalog.js';
import {computeProjectileKinetics} from './generated/catalog.js';
import {AK74M,weaponMarkers} from './weapon-data.js';
import {zeroingPreset} from './zeroing.js';
import {sightGeometry} from './sight-geometry.js';
import {flightProfile,flightChord,FLIGHT_LIMITS} from './flight.js';

// A test instrument, not an additional equipment/weapon registry entry. The
// visible AK, handling, sound and recoil deliberately stay the ordinary AK.
export const DEBUG_WEAPON=Object.freeze({instanceId:'debug-weapon-03',slot:2,definitionId:'ak74m',
  defaultAmmoId:'545_ps_gs',velocityRangeMps:Object.freeze([1,5000]),
  classification:'튜닝 · 디버그용, 현실값 아님',autoZeroDefault:false});
const zeroCache=new Map();
export function validDebugVelocity(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<DEBUG_WEAPON.velocityRangeMps[0]||n>DEBUG_WEAPON.velocityRangeMps[1])throw new RangeError('총구 속도는 1–5000 m/s 또는 빈 값이어야 합니다.');
  return n;
}
export function debugShotBallistics({ammoId=DEBUG_WEAPON.defaultAmmoId,velocityOverrideMps=null}={}){
  const ammo=CATALOG.AMMO_PRESETS[ammoId];
  if(!CATALOG.AMMO_REGISTRY[ammoId]||!ammo)throw new Error('등록되지 않은 탄약입니다: '+ammoId);
  const muzzleVelocityMps=validDebugVelocity(velocityOverrideMps)??CATALOG.AMMO_VELOCITY[ammoId];
  const kinetics=computeProjectileKinetics(ammo,muzzleVelocityMps,muzzleVelocityMps);
  if(!kinetics.hasKinetics)throw new Error('등록 탄두 질량이 없습니다: '+ammoId);
  return Object.freeze({ammoId,weaponId:'ak74m',debugOnly:true,projectileMassKg:kinetics.massKg,projectileCount:kinetics.projectileCount,
    muzzleVelocityMps,projectileMomentumNs:kinetics.massKg*muzzleVelocityMps*kinetics.projectileCount,
    muzzleEnergyJ:.5*kinetics.massKg*muzzleVelocityMps**2*kinetics.projectileCount,weaponMassKg:AK74M.physical.weightKg,kinetics});
}
export const debugRecoilBallistics=()=>shotBallistics(DEBUG_WEAPON.defaultAmmoId,'ak74m');

// Same measured AK sight/muzzle geometry and production flight chords as v30.
// Only the selected ammunition and optional test speed change. A slow test shot
// may not reach the AK 100 m / +24 cm check plane within the flight limits.
export function debugZeroHeight(ammoId,velocityMps,thetaRad){
  const preset=zeroingPreset('ak74m'),g=sightGeometry('ak74m');
  const profile=flightProfile(CATALOG.AMMO_PRESETS[ammoId]);
  let p=new Vector3(...weaponMarkers('ak74m').muzzle).sub(g.rear).applyQuaternion(g.visualAlignment),
    dir=g.sightAxis.clone().applyAxisAngle(new Vector3(1,0,0),thetaRad).applyQuaternion(g.visualAlignment),speed=velocityMps,time=0;
  for(let i=0;i<FLIGHT_LIMITS.maxSteps;i++){
    const chord=flightChord(p,dir,speed,FLIGHT_LIMITS.maxChordM,profile);
    if(-chord.end.z>=preset.distanceM){const alpha=(-preset.distanceM-p.z)/(chord.end.z-p.z);return p.y+(chord.end.y-p.y)*alpha;}
    p=chord.end;dir=chord.velocity.clone().normalize();speed=chord.velocity.length();time+=chord.dt;
    if(time>=FLIGHT_LIMITS.maxTimeS||dir.z>=0||p.y< -1000)break;
  }
  return null;
}
export function debugZeroingPreset(state={}){
  const original=zeroingPreset('ak74m');
  if(!state.autoZero)return original;
  const ballistics=debugShotBallistics(state),key=ballistics.ammoId+':'+ballistics.muzzleVelocityMps;
  if(zeroCache.has(key))return zeroCache.get(key);
  let lo=-.03,hi=null,loError=debugZeroHeight(ballistics.ammoId,ballistics.muzzleVelocityMps,lo);
  if(loError!==null)loError-=original.offsetM;
  for(let candidate=.03;candidate<=1.251;candidate+=.05){
    const height=debugZeroHeight(ballistics.ammoId,ballistics.muzzleVelocityMps,candidate);
    if(height!==null&&height>=original.offsetM&&loError!==null&&loError<0){hi=candidate;break;}
    if(height!==null&&height<original.offsetM){lo=candidate;loError=height-original.offsetM;}
  }
  if(hi===null)throw new Error('이 속도는 비행 한계 안에서 AK 영점 조건에 도달하지 못합니다. 자동 영점을 끄고 시험하세요.');
  let thetaRad,residualM;
  for(let i=0;i<60;i++){
    thetaRad=(lo+hi)/2;const height=debugZeroHeight(ballistics.ammoId,ballistics.muzzleVelocityMps,thetaRad);
    if(height===null)throw new Error('자동 영점 계산이 비행 한계에 도달했습니다.');
    residualM=height-original.offsetM;if(Math.abs(residualM)<1e-8)break;
    if(residualM>0)hi=thetaRad;else lo=thetaRad;
  }
  const result=Object.freeze({...original,deviceId:'debug-ak74m-selected-ammo',referenceAmmoId:ballistics.ammoId,
    muzzleVelocityMps:ballistics.muzzleVelocityMps,thetaRad,residualMm:residualM*1000,debugOnly:true,classification:DEBUG_WEAPON.classification});
  if(zeroCache.size>=256)zeroCache.clear();zeroCache.set(key,result);return result;
}
