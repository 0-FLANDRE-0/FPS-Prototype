// 3b. HIT CHANCE — 거리/조준안정도/자세/숙련도 보정
// =============================================================
//
// aimQuality: 0~1 사이의 조준 안정도. aimTimer를 비선형 변환한 값.
//   aimTimer 0초  → 0.00
//   aimTimer 0.3초 → ~0.59
//   aimTimer 0.6초 → ~0.83
//   aimTimer 1.0초 → ~0.95
//   aimTimer 1.5초 → ~0.99
function computeAimQuality(shooter) {
  const t = shooter.aimTimer || 0;
  let q = 1 - Math.exp(-3 * t);
  // 팔 손상 페널티 — bodyHp.arms 낮으면 조준 안정도 저하
  const armsMul = getArmsImpairment(shooter);
  q *= armsMul;
  // 고통 페널티
  q *= getPainAimMul(shooter);
  // stopping 직후 더 큰 페널티 (짧은 순간)
  if (shooter.stoppingTimer > 0) q *= 0.55;
  // 섬광 — 눈이 멀면 조준이 성립하지 않는다
  if (typeof isFlashBlinded === 'function' && isFlashBlinded(shooter)) q *= 0.15;
  return q;
}

// 거리 구간별 명중률 곱 — 무기.range를 기준으로 정규화하지 않고
// 절대 거리(픽셀)로 정의: CQB 환경에 맞춰 조정.
//   0   ~ 60  : 1.30 (초근거리 보너스)
//   60  ~ 150 : 1.30 → 1.10 (근거리)
//   150 ~ 250 : 1.10 → 1.00 (표준)
//   250 ~ end : 1.00 → 0.45 (중장거리)
function distanceFactor(distance, weapon) {
  const rngPx = (weapon && weapon.range) || mToPx(110);
  // SIDE-METRIC-SCALE-1: m 기준 곡선 (px 하드코딩 제거). PX_PER_M 변경과 무관하게 실제 미터 거리로 작동.
  //   0~3 m   : ×1.30 — 초근접
  //   3~8 m   : 1.30 → 1.15
  //   8~15 m  : 1.15 → 1.00
  //   15~30 m : 1.00 → 0.70  중거리, 점점 어려워짐
  //   30~50 m : 0.70 → 0.45  장거리 큰 페널티
  //   50 m ~ rng : 0.45 → 0.25
  const m = pxToM(distance);
  if (m <= 3)  return 1.30;
  if (m <= 8)  { const t = (m - 3) / 5;   return 1.30 + (1.15 - 1.30) * t; }
  if (m <= 15) { const t = (m - 8) / 7;   return 1.15 + (1.00 - 1.15) * t; }
  if (m <= 30) { const t = (m - 15) / 15; return 1.00 + (0.70 - 1.00) * t; }
  if (m <= 50) { const t = (m - 30) / 20; return 0.70 + (0.45 - 0.70) * t; }
  const rngM = pxToM(rngPx);
  const denom = Math.max(10, rngM - 50);
  const t = Math.min(1, (m - 50) / denom);
  return 0.45 + (0.25 - 0.45) * t;
}

// 표적 자세별 순간 명중률 곱 — aimQuality에 따라 회복.
//   aimQuality 0   → 자세별 최저값
//   aimQuality 1   → 자세별 회복값 (cover만 약간 페널티 잔존)
// 자세별 순간 명중률 보정
//   target.proneTime이 함께 전달되면 downed/prone에 대해 시간에 따른 회복 적용:
//   쓰러진 직후엔 잘 안 맞지만, 같은 위치에 오래 누워있으면 사수가 위치를 파악해 명중률 회복.
//   crawl 이동 중이면 회복이 느려지고, unconscious는 더 빨라진다.
function stanceTransientFactor(stance, aimQuality, target) {
  const STANCE_RANGE = {
    standing: [0.95, 1.00],
    moving:   [0.55, 0.92],
    crouched: [0.55, 0.95],
    pinned:   [0.40, 0.92],
    cover:    [0.30, 0.85],
    prone:    [0.35, 0.85],   // 누워있으면 기본적으로 맞히기 어려움 (시간에 따라 회복)
  };
  const key = (stance === 'downed') ? 'prone' : stance;
  const r = STANCE_RANGE[key] || STANCE_RANGE.standing;
  const aq = Math.max(0, Math.min(1, aimQuality || 0));
  let base = r[0] + (r[1] - r[0]) * aq;
  // prone/downed 시간 기반 회복
  //   downedTime이 있으면 downedTime 사용 (downed/unconscious 표적)
  //   없으면 자발적 prone — proneTime 사용
  //   0~0.5s: 0.40배 — 급격한 자세 변화로 인지 미흡
  //   0.5~2s: 0.40 → 0.75 선형 증가
  //   2s+:    0.75 → 0.90 — 위치 파악됨, 그러나 작은 표적이라 1.0까진 X
  if (key === 'prone' && target) {
    let t = null;
    if (typeof target.downedTime === 'number' && target.downedTime > 0) {
      t = target.downedTime;
    } else if (typeof target.proneTime === 'number' && target.proneTime > 0) {
      t = target.proneTime;
    }
    if (t != null) {
      let timeMul;
      if (t < 0.5)      timeMul = 0.40;
      else if (t < 2.0) timeMul = 0.40 + (t - 0.5) / 1.5 * 0.35;     // 0.40 → 0.75
      else              timeMul = Math.min(0.90, 0.75 + (t - 2.0) * 0.05);
      // crawl 이동 중이면 회복 일부 늦어짐
      const isCrawling = target.movePath && target.movePath.length > 0;
      if (isCrawling) timeMul *= 0.85;
      // unconscious는 완전히 정적 — 시간이 지나면 standing 표적과 비슷해질 정도로 노출됨
      if (target.isDowned && !target.conscious && t >= 2.0) {
        timeMul = Math.min(0.95, timeMul + 0.10);
      }
      base *= timeMul;
    }
  }
  return base;
}

// 통합 명중률 계산
function calculateHitChance(shooter, target, weapon, distance) {
  const skill = shooter.skill || { accuracy: 1.0 };
  const aimQuality = computeAimQuality(shooter);

  let hit = weapon.accuracy;

  // 거리 보정
  const distFactor = distanceFactor(distance, weapon);
  hit *= distFactor;

  // 자세별 순간 명중률 (aimQuality + proneTime/downedTime 반영) — getEffectiveStance 사용
  const stance = (target && typeof getEffectiveStance === 'function') ? getEffectiveStance(target) : ((target && target.stance) || 'standing');
  hit *= stanceTransientFactor(stance, aimQuality, target);

  // 사수 숙련도
  hit *= (skill.accuracy || 1.0);

  // === Medical aimMul — 팔 손상/통증/쇼크/호흡/의식 종합 ===
  if (shooter.medical && shooter.medical.aimMul != null) {
    hit *= shooter.medical.aimMul;
  }
  // SIDE-WEAPON-INJURY-HANDLING-1: 슬롯별 부상 보정 (주무기 양손 민감 / 보조무기 완화)
  if (typeof getWeaponHandlingInjuryModifier === 'function' && shooter.weaponState) {
    hit *= getWeaponHandlingInjuryModifier(shooter, shooter.weaponState.activeSlot).accuracyMul;
  }

  // 제압 페널티 — sup 100일 때 -50%
  hit *= (1 - (shooter.suppression || 0) / 200);

  // pinned 페널티
  if (shooter.pinned) hit *= 0.5;

  // 이동 중 사격 (교전 시작 직후가 아닌 일반 이동) 페널티
  // currentTarget이 있다는 것은 이미 교전 진입한 상태 — 정지 후 사격이 기본
  // 사실 friend는 교전 시작 시 이동 중단되지만, 안전망으로 남겨둠
  if (isFiringOnTheMove(shooter)) {
    hit *= movingHitMul();
  }

  // 최종 clamp
  hit = Math.max(0.03, Math.min(0.97, hit));

  // 디버그 정보 저장
  shooter._lastAimQuality = aimQuality;
  shooter._lastHitChance = hit;
  shooter._lastDistanceFactor = distFactor;

  return hit;
}

// =============================================================
