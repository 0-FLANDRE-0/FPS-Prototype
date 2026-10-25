// Generated from unchanged CQB declarations by scripts/training-flight.mjs.
import {CATALOG} from "../catalog.js";
const DRAG_RETENTION_PER_100M=CATALOG.DRAG_RETENTION_PER_100M;
export function getCaliberEnergyClass(ammo) {
  if (!ammo) return 'small_rifle';
  if (ammo.energyClass) return ammo.energyClass;
  const cal = (ammo.caliber || '').toLowerCase();
  if (cal.includes('9') || cal.includes('parabellum')) return 'pistol';
  if (cal.includes('5.56') || cal.includes('5.45')) return 'small_rifle';
  if (cal.includes('7.62×39') || cal.includes('7.62x39')) return 'intermediate_rifle';
  if (cal.includes('7.62×51') || cal.includes('7.62x51') || cal.includes('.308')) return 'full_power_rifle';
  return 'small_rifle';
}

// =============================================================
// 장벽 감쇠 보정 계수 — energyClass / barrierBehavior 기반
// =============================================================
//   낮을수록 감쇠 적음 (탄이 잘 유지), 높을수록 감쇠 큼.
export function getVelocityDragClass(ammo) {
  if (!ammo) return 'rifle_light';
  if (ammo.velocityDragClass) return ammo.velocityDragClass;
  const ec = getCaliberEnergyClass(ammo);
  if (ec === 'pistol') return 'pistol';
  if (ec === 'pistol_ap') return 'pistol_fast';
  if (ec === 'subsonic') return 'subsonic';
  if (ec === 'full_power_rifle') return 'rifle_heavy';
  if (ec === 'intermediate_rifle') return 'rifle_heavy';
  if (ec === 'shotgun') return 'shotgun';
  return 'rifle_light';
}
export function getDistanceVelocityRetention(ammo, distanceM) {
  const dragClass = getVelocityDragClass(ammo);
  const per100 = DRAG_RETENTION_PER_100M[dragClass] || 0.93;
  // 100m마다 per100 비율씩 곱함 — pow(per100, distance/100)
  return Math.pow(per100, distanceM / 100);
}

// =============================================================
// TERMINAL_EFFECTS — 탄종별 파쇄/yaw/확장 임계 + 효과
// =============================================================
//   thresholdVelocity 이상이면 ideal 종말효과,
//   이하면 tissue/bleed/shock 감소.
