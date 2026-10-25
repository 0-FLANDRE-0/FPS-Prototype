// 7. UNIT FACTORY
// =============================================================
const UNIT_RADIUS = 11;
const VIEW_ARC_FRIEND = (140 * Math.PI) / 180;
const FIRE_ARC_FRIEND = (100 * Math.PI) / 180;
const VIEW_ARC_ENEMY  = (130 * Math.PI) / 180;
const FIRE_ARC_ENEMY  = (95  * Math.PI) / 180;
// SIDE-METRIC-SCALE-1: 시야거리 m source-of-truth
const SIGHT_RANGE_M = 100;   // LOS 열려 있으면 사실상 맵 어디든 시야 (맵 대각선보다 큼)
const SIGHT_RANGE = mToPx(SIGHT_RANGE_M);

// =============================================================
// DISTANCE / METRIC SYSTEM  (SIDE-METRIC-SCALE-1)
//   PX_PER_M/M_PER_PX/pxToM/mToPx/fmtMeterFromPx는 스크립트 최상단에서 정의 (파스타임 사용 가능).
//   1 m = 32 px → UNIT_RADIUS 11px = 지름 22px ≈ 0.69m (사람 어깨폭)
//   기존 1600×960 맵 = 50×30 m 공간으로 재해석. 격자 1칸 = 5 m (160 px), 10 m마다 강조선.
// =============================================================
const GRID_M = 5;                     // 격자 1칸 = 5 m
const GRID_PX = mToPx(GRID_M);        // = 160 px
// legacy alias — 기존 호출부는 전부 px를 넘기므로 px 입력 유지 (m 입력은 fmtMeterM 사용)
function fmtMeter(px, decimals) { return fmtMeterFromPx(px, decimals); }
// 거리대 분류 — m 기준 (distanceFactor 변곡점과 동일 체계)
function distanceBand(px) {
  const m = pxToM(px);
  if (m <= 3)  return 'contact';   // ≤ 3 m  — 초근접
  if (m <= 8)  return 'close';     // ≤ 8 m  — 근접
  if (m <= 15) return 'short';     // ≤ 15 m — 근거리
  if (m <= 30) return 'medium';    // ≤ 30 m — 중거리
  return 'long';                   // > 30 m — 장거리
}
const DISTANCE_BAND_KOR = {
  contact:'초근접', close:'근접', short:'근거리', medium:'중거리', long:'장거리',
};
const DISTANCE_BAND_COLOR = {
  contact:'#ffb84d', close:'#ffd479', short:'#ffe066', medium:'#80c0ff', long:'#a890e0',
};
const ROTATE_SPEED = 4.0;

// =============================================================
// === MEDICAL SYSTEM (1단계: 부위 HP 465 + 혈액 5000ml + vitals + lifeStatus)
// =============================================================
//   설계 원칙:
//   - 모든 피해는 applyDamageEvent(unit, ev)를 통해 들어간다
//   - unit.hp 직접 감소 금지 (compatibility로만 유지)
//   - 좌우 사지 독립 부위 관리 (leftArm/rightArm/leftLeg/rightLeg)
//   - vitals (HR/BP/breathing/blood)이 lifeStatus를 계산
//   - summary multipliers (aimMul/moveMul/reactionMul/reloadMul)가 전투 성능에 연결
//   - legacy isDead/isDowned/conscious/combatState는 medical에서 sync

const BODY_PART_KEYS = ['head', 'neck', 'chest', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
// PART-DESTRUCTION-1 Phase1/5: 상태별 기능 상한
const PART_DESTRUCTION_FUNCTIONAL_CAP = {
  intact: 1.0, damaged: 0.85, impaired: 0.60, mangled: 0.20, destroyed: 0.0,
  partial_traumatic_loss: 0.05, traumatic_amputation: 0.0, catastrophic_non_limb: 0.10,
};
const _LIMB_PART_KEYS = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
function makeDefaultPartDestruction(partKey) {
  return {
    partKey,
    state: 'intact',
    traumaScore: 0, cumulativeTraumaScore: 0, acuteTraumaScore: 0,
    localClusters: {},
    destructionRisk: 0, traumaticLossRisk: 0,
    functionalCap: 1.0, bleedBonusMul: 1.0, vascularRiskBonus: 0,
    lastMajorHitAt: 0, lastUpdatedAt: 0,
    sourceWoundIds: [], sourceClusterIds: [],
    evidenceTags: [], notes: [],
  };
}
function _makeAllPartDestruction() {
  const o = {};
  for (const k of BODY_PART_KEYS) o[k] = makeDefaultPartDestruction(k);
  return o;
}
const BODY_PART_MAX_HP = {
  head: 35, neck: 25, chest: 85, abdomen: 70,
  leftArm: 60, rightArm: 60, leftLeg: 65, rightLeg: 65,
};
const BODY_HP_TOTAL_MAX = 465;
const BLOOD_MAX = 5000;

function createMedical() {
  const bodyParts = {};
  for (const k of BODY_PART_KEYS) {
    bodyParts[k] = {
      hp: BODY_PART_MAX_HP[k], maxHp: BODY_PART_MAX_HP[k],
      externalBleedRate: 0, internalBleedRate: 0,
      pain: 0, fracture: false, functionRatio: 1.0,
      tourniquetApplied: false, bandageApplied: false,
      chestSealed: false, splinted: false,
      treated: false, disabled: false,
    };
  }
  return {
    bodyParts,
    wounds: [],                 // 2B-0: 개별 상처 목록
    woundClusters: {},          // SHOTGUN-PHYS-CLUSTER-1 Phase4: 처치/UI 묶음 (개별 wound는 그대로 유지 — 의학적 진실)
    partDestruction: _makeAllPartDestruction(),   // PART-DESTRUCTION-1 Phase1: 부위 상태/누적외상/기능상한 판정층 (bodyPart.hp는 그대로 유지)
    bodyPartTreatments: {},     // 2B-0: 부위 전체 처치 (지혈대/부목/골반바인더)
    bodyHpTotal: BODY_HP_TOTAL_MAX, bodyHpMax: BODY_HP_TOTAL_MAX,
    bloodMl: BLOOD_MAX, bloodMax: BLOOD_MAX,
    externalBleedRate: 0, internalBleedRate: 0,
    pain: 0, shock: 0, consciousness: 100,
    heartRate: 75, systolicBP: 120, diastolicBP: 80,
    breathingEfficiency: 100,
    lifeStatus: 100, combatEffectiveness: 100,
    aimPerformance: 100, mobility: 100, reactionPerformance: 100,
    // summary multipliers (적용 측에서 곱해 사용)
    aimMul: 1.0, moveMul: 1.0, reactionMul: 1.0,
    reloadMul: 1.0, stanceChangeMul: 1.0, weaponHandlingMul: 1.0,
    // booleans
    isAlive: true, isDead: false, isDowned: false,
    isUnconscious: false, isCombatEffective: true,
    canWalk: true, canCrawl: true, canMove: true, canShoot: true,
    // diagnosis
    downReason: null, deathReason: null,
    statusTags: [],
    // legacy mapping support
    _lastVitalUpdate: 0,
    // === 1.5단계 전투 생리/보상 시스템 확장 ===
    stressResponse: {
      sympatheticTone: 0,      // 교감신경 활성 (0~1)
      adrenaline: 0,           // 아드레날린 (0~1) — 통증마스킹/반응성/HR↑
      combatArousal: 0,        // 전투흥분 (0~1)
      panic: 0,                // 공황 (0~1) — 손떨림/사격 부정확
      painMasking: 0,          // 통증 둔화 비율 (0~1) — perceivedPain 계산용
      perceivedPain: 0,        // 느끼는 통증 (pain * (1-painMasking))
      threatDrive: 0,          // 위협 자극
      injuryDrive: 0,          // 부상 자극
      suppressionDrive: 0,     // 제압 자극
      postCombatCrash: 0,      // 전투 후 crash 수치
      timeSinceLastThreat: 999,
      timeSinceLastDamage: 999,
    },
    hemodynamics: {
      volumeRatio: 1.0,           // bloodMl / bloodMax
      vascularTone: 1.0,           // 혈관수축 보조
      systemicVascularResistance: 1.0,
      preload: 1.0,                // 정맥환류
      contractility: 1.0,          // 심수축력
      strokeVolumeMul: 1.0,        // 1회 박출량
      cardiacOutputMul: 1.0,       // 심박출량 종합
      map: 93,                     // mean arterial pressure
      pulsePressure: 40,
      tissuePerfusion: 1.0,        // 조직 관류
      oxygenDelivery: 1.0,         // 산소 공급
      compensationLoad: 0,         // 현재 보상 부하 (0~1)
      compensationExhaustion: 0,   // 보상 피로 누적 (0~1)
      compensatedShock: false,
      decompensatingShock: false,
    },
    hormonalCompensation: {
      vasopressin: 0,         // ADH (0~1) — 느린 혈관수축 보조
      raasActivation: 0,      // RAAS 활성 (0~1)
      angiotensinTone: 0,     // angiotensin 톤
      aldosteroneEffect: 0,
      cortisolStress: 0,
    },
    // === 2.5단계 placeholder (현재 gameplay 미사용, ECG fallback용) ===
    cardiac: {
      rhythm: 'sinus',
      arrhythmiaRisk: 0,
      ischemiaRisk: 0,
      cardiacStrain: 0,
      rhythmInstability: 0,
    },
  };
}

// === 1.5단계 보간/감쇠 유틸 ===
//   target을 향해 rate(/s) 속도로 부드럽게 이동 — Math.sign 방식의 overshoot 방지
function approachValue(current, target, rateUp, rateDown, dt) {
  if (current == null || isNaN(current)) return target;
  const diff = target - current;
  if (Math.abs(diff) < 1e-6) return target;
  const rate = diff > 0 ? rateUp : rateDown;
  const step = Math.max(0, rate * dt);
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}
// FPS 독립적 감쇠 — tau(초)는 약 63% 감쇠하는 시간상수
function decayExp(value, dt, tau) {
  if (value == null || isNaN(value)) return 0;
  return value * Math.exp(-dt / Math.max(0.001, tau));
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clampMed(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 기존 유닛의 medical에 1.5단계 확장 객체가 없으면 보강 (legacy save / 이전 spawn 호환)
function ensureMedicalExtensions(unit) {
  if (!unit || !unit.medical) return;
  const m = unit.medical;
  if (!m.woundClusters) m.woundClusters = {};   // SHOTGUN-PHYS-CLUSTER-1 Phase4
  if (!m._activeWoundClusterGen) m._activeWoundClusterGen = {};   // SAME-AREA-CLUSTER-ACTIVE-GEN-1
  // [IMPACT-A Phase2] 급성 피격반응 필드 (physiological과 분리)
  if (m.impactKnockdownTimer == null) m.impactKnockdownTimer = 0;
  if (m.transientNeurologicDisruption == null) m.transientNeurologicDisruption = 0;
  if (m._acuteResponseLoad == null) m._acuteResponseLoad = 0;
  // PART-DESTRUCTION-1 Phase1-2: partDestruction 보장 (save/load·구버전 유닛)
  if (!m.partDestruction) m.partDestruction = _makeAllPartDestruction();
  else for (const k of BODY_PART_KEYS) { if (!m.partDestruction[k]) m.partDestruction[k] = makeDefaultPartDestruction(k); }
  if (!m.stressResponse) {
    m.stressResponse = {
      sympatheticTone: 0, adrenaline: 0, combatArousal: 0, panic: 0,
      painMasking: 0, perceivedPain: m.pain || 0,
      threatDrive: 0, injuryDrive: 0, suppressionDrive: 0,
      postCombatCrash: 0, timeSinceLastThreat: 999, timeSinceLastDamage: 999,
    };
  }
  if (!m.hemodynamics) {
    m.hemodynamics = {
      volumeRatio: m.bloodMl / m.bloodMax, vascularTone: 1.0,
      systemicVascularResistance: 1.0, preload: 1.0, contractility: 1.0,
      strokeVolumeMul: 1.0, cardiacOutputMul: 1.0, map: 93, pulsePressure: 40,
      tissuePerfusion: 1.0, oxygenDelivery: 1.0,
      compensationLoad: 0, compensationExhaustion: 0,
      compensatedShock: false, decompensatingShock: false,
    };
  }
  if (!m.hormonalCompensation) {
    m.hormonalCompensation = {
      vasopressin: 0, raasActivation: 0, angiotensinTone: 0,
      aldosteroneEffect: 0, cortisolStress: 0,
    };
  }
  if (!m.cardiac) {
    m.cardiac = { rhythm: 'sinus', arrhythmiaRisk: 0, ischemiaRisk: 0, cardiacStrain: 0, rhythmInstability: 0 };
  }
  if (!m.fieldStabilizationModel) ensureFieldStabilizationModel(unit);
}
// === FIELD-STAB-1 §6: field stabilization 모델 (원인 완화용 game modifier 컨테이너) ===
//   모든 값은 게임 추상 상태다. 실제 의료 절차/위치/방법 아님. bleedingProfile은 불변(modifier만).
function ensureFieldStabilizationModel(unit) {
  if (!unit || !unit.medical) return null;
  const m = unit.medical;
  if (!m.fieldStabilizationModel) {
    m.fieldStabilizationModel = {
      airwaySupport:    { candidate:false, active:false, applied:false, quality:0, effectStrength:0, oxygenDeliveryModifier:1.0, artifactReduction:0, breathingDisciplineSupport:0, obstructionRisk:0, startedAt:0, completedAt:0, recurrenceRisk:0, failureReason:null, tags:[] },
      chestRelief:      { candidate:false, active:false, applied:false, quality:0, effectStrength:0, tensionReliefModifier:1.0, breathingEfficiencyDrainModifier:1.0, oxygenDeliveryModifier:1.0, recurrenceRisk:0, startedAt:0, completedAt:0, failureReason:null, tags:[] },
      pelvicControl:    { candidate:false, active:false, applied:false, quality:0, effectStrength:0, pelvicBleedModifier:1.0, mobilityPenalty:0, evacuationPriorityBoost:0, recurrenceRisk:0, startedAt:0, completedAt:0, tags:[] },
      junctionalControl:{ candidate:false, active:false, applied:false, quality:0, effectStrength:0, pulseSuppression:0, recurrenceRisk:0, startedAt:0, completedAt:0, tags:[] },
      circulationSupport:{ candidate:false, active:false, available:false, fieldLimited:true, resourceRequired:true, effectStrength:0, mapSupportModifier:1.0, perfusionSupportModifier:1.0, transfusionRequired:false, definitiveCareRequired:false, startedAt:0, tags:[] },
      evacuationPriority:'none', definitiveCareRequired:false, lastUpdateTime:0,
    };
  }
  return m.fieldStabilizationModel;
}

// === 부위 매핑 (legacy hitPart → 새 medical part) ===
//   기존 코드의 hitPart: 'head', 'neck', 'chest', 'abdomen', 'arm_left', 'arm_right', 'leg_left', 'leg_right'
//   또는 'arms', 'legs' 등 통합형
// ════════════════════════════════════════════════════════════════════════════
// PART-KEY-CANONICAL-1 (대형 PHASE 1) — 신체 부위 key 정규화 단일 책임
//   canonical(주소/표시/AAR): snake — head neck chest abdomen left_arm right_arm left_leg right_leg
//   storage(medical.bodyParts/wound.partKey/partDestruction/cluster.partKey): camel (기존 저장구조 유지)
//   변환은 이 모듈만 담당. 새 로컬 변환표 금지. unknown → chest 자동 fallback 금지(경고+원본 보존, strict는 오류).
// ════════════════════════════════════════════════════════════════════════════
const CANONICAL_ANATOMICAL_KEYS = ['head','neck','chest','abdomen','left_arm','right_arm','left_leg','right_leg'];
const _CANON_TO_STORAGE = { head:'head', neck:'neck', chest:'chest', abdomen:'abdomen',
  left_arm:'leftArm', right_arm:'rightArm', left_leg:'leftLeg', right_leg:'rightLeg' };
const _STORAGE_TO_CANON = { head:'head', neck:'neck', chest:'chest', abdomen:'abdomen',
  leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' };
function _partKeyWarn(raw, ctx) {
  if (typeof GAME !== 'undefined') {
    GAME._partKeyWarnings = GAME._partKeyWarnings || [];
    if (GAME._partKeyWarnings.length < 200) GAME._partKeyWarnings.push({ raw: String(raw), ctx: ctx || null, t: (GAME.gameTime || 0) });
    if (GAME.debugStrictPipeline) throw new Error('UNKNOWN_PART_KEY: ' + raw + (ctx ? (' @' + ctx) : ''));
  }
}
// raw(어떤 표현이든) → canonical snake. 미확정 좌우는 meta.isLeft로 1회 확정 (재굴림 금지). unknown → null + 경고.
function normalizeAnatomicalPartKey(raw, meta) {
  if (raw == null) return null;
  if (_STORAGE_TO_CANON[raw]) return _STORAGE_TO_CANON[raw];   // storage camel 그대로 온 경우
  const p = String(raw).toLowerCase().trim();
  const M = { head:'head', neck:'neck', chest:'chest', thorax:'chest', abdomen:'abdomen', abd:'abdomen',
    left_arm:'left_arm', leftarm:'left_arm', arm_left:'left_arm',
    right_arm:'right_arm', rightarm:'right_arm', arm_right:'right_arm',
    left_leg:'left_leg', leftleg:'left_leg', leg_left:'left_leg',
    right_leg:'right_leg', rightleg:'right_leg', leg_right:'right_leg' };
  if (M[p]) return M[p];
  if (p === 'arms' || p === 'arm' || p === 'legs' || p === 'leg') {
    const isArm = (p[0] === 'a');
    let isLeft = (meta && meta.isLeft != null) ? !!meta.isLeft : null;
    if (isLeft == null && meta && typeof meta.rng === 'function') isLeft = meta.rng() < 0.5;   // 명시 rng로 1회만 결정
    if (isLeft == null) { _partKeyWarn(raw, (meta && meta.ctx) || 'ambiguous_side_unresolved'); return null; }
    return isArm ? (isLeft ? 'left_arm' : 'right_arm') : (isLeft ? 'left_leg' : 'right_leg');
  }
  _partKeyWarn(raw, meta && meta.ctx);
  return null;
}
function toMedicalBodyPartStorageKey(canonical) { return _CANON_TO_STORAGE[canonical] || null; }
function canonicalFromStorageKey(storageKey) { return _STORAGE_TO_CANON[storageKey] || normalizeAnatomicalPartKey(storageKey); }
// medical.bodyParts를 어떤 key 표현으로도 조회 (직접 문자열 조립 금지 — 이 adapter 사용)
function getMedicalBodyPart(medical, anyKey, meta) {
  if (!medical || !medical.bodyParts) return null;
  if (medical.bodyParts[anyKey]) return medical.bodyParts[anyKey];
  const c = normalizeAnatomicalPartKey(anyKey, meta);
  const sk = c && _CANON_TO_STORAGE[c];
  return sk ? (medical.bodyParts[sk] || null) : null;
}
// legacy wrapper — 반환은 storage(camel). unknown은 production에서 chest fallback(경고 기록), strict는 위에서 throw.
//   arms/legs + isLeft 미지정은 이전과 동일하게 1회 rng 결정 (RNG 스트림 소비 수 동일 유지).
function resolveBodyPartKey(hitPart, isLeft) {
  const c = normalizeAnatomicalPartKey(hitPart, { isLeft: (isLeft == null ? null : !!isLeft), rng: Math.random, ctx: 'resolveBodyPartKey' });
  if (c) return _CANON_TO_STORAGE[c];
  return 'chest';   // production fallback (경고는 normalize에서 기록됨)
}

// === 출혈 등급 → ml/s ===
function bleedRateForSeverity(sev) {
  // ORGANIC-BLEED-1 Phase0-2: legacy fallback(디버그/호환용). wound.bleedingProfile이 정상 생성되면 다음 tick부터 source-of-truth가 되어 이 값은 덮어써짐.
  //   wound 생성 실패 시에도 55/120 같은 대혈관급 값이 장시간 지속되지 않도록 즉시반응 수준으로 제한.
  switch (sev) {
    case 'micro':    return 1.0;
    case 'light':    return 5.0;
    case 'medium':   return 10.0;
    case 'severe':   return 16.0;
    case 'critical': return 22.0;
    default:         return 0;
  }
}

// === Central damage event handler ===
//   ev: {
//     sourceType: 'bullet' | 'frag' | 'blast' | 'blunt' | 'legacyExplosion',
//     hitPart, hitZone, isLeft, rawDamage, tissueDamage, penetration,
//     armorResult ('penetrated' | 'stopped' | 'absorbed'),
//     projectileEnergy, isFragment, fragmentSize, isBlast, blastType,
//     distance, direction, bleedRisk, shockRisk, painAmount, bluntTrauma,
//     terminalEffect, ammoMedicalProfile
//   }
// =============================================================
