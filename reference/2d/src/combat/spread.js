// 3c. SHOT SPREAD & RAYCAST
// =============================================================
//
// raycast 기반 1차 명중 판정.
//   - calculateHitChance / aimQuality / 숙련도 / 제압 / 이동 상태를 모두
//     "탄퍼짐 각도(deg)"로 변환
//   - 발사 각도에 spread를 적용해 ray를 쏘고, 벽/유닛 중 가장 가까운 교차를 반환
//   - 유닛에 맞으면 기존 resolveImpact()로 부위/방호/관통/피해 처리
//   - 벽이 먼저 맞으면 miss + suppression
//   - 부위별 hitbox 없음 (1차 구현)

const DEFAULT_SPREAD = {
  spreadBaseDeg:        3.5,
  spreadMinDeg:         0.8,
  spreadMaxDeg:        12.0,
  spreadMovingMul:      2.0,
  spreadSuppressionMul: 2.4,
};
function getWeaponSpreadProfile(weapon) {
  return {
    base:        (weapon.spreadBaseDeg        != null) ? weapon.spreadBaseDeg        : DEFAULT_SPREAD.spreadBaseDeg,
    min:         (weapon.spreadMinDeg         != null) ? weapon.spreadMinDeg         : DEFAULT_SPREAD.spreadMinDeg,
    max:         (weapon.spreadMaxDeg         != null) ? weapon.spreadMaxDeg         : DEFAULT_SPREAD.spreadMaxDeg,
    movingMul:   (weapon.spreadMovingMul      != null) ? weapon.spreadMovingMul      : DEFAULT_SPREAD.spreadMovingMul,
    supMul:      (weapon.spreadSuppressionMul != null) ? weapon.spreadSuppressionMul : DEFAULT_SPREAD.spreadSuppressionMul,
  };
}

// =============================================================
// 이동사격 — 공짜도 아니고 불가능도 아니게
// =============================================================
//   기존 구조는 이동 페널티에 `&& !shooter.currentTarget`을 달아 두 극단만 만들었다(실측, 8m):
//     정지·표적 있음   명중 0.759 · 퍼짐 0.49°
//     이동·표적 있음   명중 0.759 · 퍼짐 0.49°   ← **페널티 0**. 달리면서 쏴도 서서 쏘는 것과 같다
//     이동·표적 없음   명중 0.417 · 퍼짐 1.17°   ← 명중 55% · 퍼짐 2.39배
//   "정지보다 불리하되 할 만한" 중간이 없었다. 그래서 게이트를 없애 **이동엔 항상 대가**를 붙이고,
//   크기는 대폭 낮춘다. 무기별 배수(1.35~3.0)는 버리지 않고 1 쪽으로 압축해
//   기관총이 권총보다 이동 중 나쁘다는 **순서는 유지**한다.
const USE_MOVING_FIRE = true;
function isMovingFireOn() {
  if (typeof GAME !== 'undefined' && GAME.movingFireOn != null) return !!GAME.movingFireOn;
  return USE_MOVING_FIRE;
}
const MOVEFIRE_SPREAD_SOFTEN = 0.30;   // 무기 배수를 1 쪽으로 압축: 2.0 → 1.30, 3.0 → 1.60
const MOVEFIRE_HIT_MUL       = 0.85;   // 기존 0.55
// 이 사수가 지금 이동 중 사격인가 — 한 곳에서만 판정한다(명중률과 퍼짐이 갈리면 안 된다)
function isFiringOnTheMove(shooter) {
  if (!shooter || !shooter.movePath || shooter.movePath.length === 0) return false;
  if (isMovingFireOn()) return true;                 // 표적 유무와 무관하게 대가가 있다
  return !shooter.currentTarget;                     // 스위치 OFF = 기존 동작 그대로
}
function movingSpreadMulFor(weaponMovingMul) {
  const m = (weaponMovingMul != null) ? weaponMovingMul : 2.0;
  return isMovingFireOn() ? (1 + (m - 1) * MOVEFIRE_SPREAD_SOFTEN) : m;
}
function movingHitMul() { return isMovingFireOn() ? MOVEFIRE_HIT_MUL : 0.55; }

// 최종 탄퍼짐 각도 (degree, 절반각이 아닌 "허용 편차 폭")
function calculateShotSpread(shooter, target, weapon, distance) {
  const sp = getWeaponSpreadProfile(weapon);
  const aimQuality = shooter._lastAimQuality != null ? shooter._lastAimQuality : computeAimQuality(shooter);
  const skill = shooter.skill || { accuracy: 1.0, aimSpeed: 1.0 };

  // 베이스 → aimQuality에 따라 base에서 min으로 수렴
  let spread = sp.base + (sp.min - sp.base) * aimQuality;

  // 숙련도 — accuracy가 높을수록 탄퍼짐 감소
  const accBonus = (skill.accuracy || 1.0);
  spread *= (2.0 - accBonus);

  // 명중률 참고 — calculateHitChance가 매우 낮으면 추가 산포
  const hc = shooter._lastHitChance != null ? shooter._lastHitChance : 0.5;
  if (hc < 0.5) spread *= (1 + (0.5 - hc) * 0.6);

  // 이동 / 제압 / pinned
  if (isFiringOnTheMove(shooter)) {
    spread *= movingSpreadMulFor(sp.movingMul) * getLoadMovingSpreadMul(shooter);
  }
  if (shooter.suppression > 0) spread *= 1 + ((shooter.suppression / 100) * (sp.supMul - 1));
  if (shooter.pinned) spread *= 1.4;

  // 탄약 반동 — recoil이 양수면 spread 증가, 음수면 약간 감소
  // 첫 발 자체에 큰 영향을 주지는 않게 0.05 계수
  // weapon.recoil은 resolveAmmoForWeapon에서 weapon.recoilBase + ammo.recoil로 합산된 값
  const recoil = (weapon && weapon.recoil) || 0;
  spread *= Math.max(0.85, 1 + recoil * 0.05);

  // 탄약 정확도 (accuracyMul) — 1.10이면 spread 9%↓, 0.92면 spread 8%↑
  //   너무 강하지 않게 0.6 가중
  const accMul = (weapon && weapon.accuracyMul != null) ? weapon.accuracyMul : 1.0;
  spread *= 1 + (1 - accMul) * 0.6;

  // SIDE-WEAPON-INJURY-HANDLING-1: 팔 부상/쓰러짐 → 반동제어 악화 (주무기 큼, 보조무기 작음)
  if (typeof getWeaponHandlingInjuryModifier === 'function' && shooter.weaponState) {
    spread *= getWeaponHandlingInjuryModifier(shooter, shooter.weaponState.activeSlot).recoilMul;
  }
  // clamp
  spread = Math.max(sp.min, Math.min(sp.max, spread));
  shooter._lastSpreadDeg = spread;
  return spread;
}

// spread 범위 안에서 실제 편차 각도 (radians) — 가운데 비중을 약간 두기 위해 두 random 평균
function sampleSpreadAngle(spreadDeg) {
  const halfRad = spreadDeg * Math.PI / 180;
  const r = (Math.random() + Math.random()) / 2 - 0.5;  // -0.5 ~ 0.5, 종형
  return r * 2 * halfRad;   // -halfRad ~ +halfRad
}

// ray-circle 교차 — 가장 가까운 양의 t 반환, 없으면 Infinity
function intersectRayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy;
  const a = dx*dx + dy*dy;
  const b = 2 * (fx*dx + fy*dy);
  const c = fx*fx + fy*fy - r*r;
  const disc = b*b - 4*a*c;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2*a);
  const t2 = (-b + sq) / (2*a);
  if (t1 >= 0) return t1;
  if (t2 >= 0) return 0;   // 안에서 시작 — 즉시 hit
  return Infinity;
}

// 핵심 raycast — shooter가 (dx, dy) 방향으로 쏠 때 가장 가까운 벽/유닛 교차 반환.
//   반환:
//     { type: 'wall', dist, x, y }
//     { type: 'unit', dist, x, y, unit }
//     { type: 'none', dist: maxDist, x, y }
// =============================================================
