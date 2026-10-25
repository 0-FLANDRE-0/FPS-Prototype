
// 2A-6.3: 추가 보호대 세부 방호범위 + 바이저 effective FOV + 6B23 예외 검증
function validateAccessoryCoverage(rep) {
  rep = rep || _mkValidationReport();
  const ACC = (typeof _ACCESSORY_COVERAGE !== 'undefined') ? _ACCESSORY_COVERAGE : null;
  if (!ACC) { rep.warn('accCov', '_ACCESSORY_COVERAGE 미정의'); return rep; }
  const has = (arr, x) => Array.isArray(arr) && arr.indexOf(x) >= 0;
  // shoulder
  const sh = ACC.shoulder || {};
  for (const t of ['shoulderJoint','upperArmProximal','shoulderCap']) if (!has(sh.targets, t)) rep.warn('accCov', `shoulderGuard: 보호 대상에 ${t} 없음`);
  for (const x of ['forearm','elbowJoint','hand','wrist']) if (has(sh.targets, x)) rep.error('accCov', `shoulderGuard: ${x}를 보호 대상으로 가짐 (금지)`);
  if (!(sh.coverProb && sh.coverProb.rear <= 0.1)) rep.warn('accCov', `shoulderGuard: 후면 coverProb가 너무 높음 (${sh.coverProb && sh.coverProb.rear})`);
  // groin
  const gr = ACC.groin || {};
  for (const t of ['groinAdjacent','pelvisGroinAdjacent','lowerAbdomenFront']) if (!has(gr.targets, t)) rep.warn('accCov', `groinGuard: 보호 대상에 ${t} 없음`);
  for (const x of ['upperAbdomen','abdomen_side','flank','thigh','knee']) if (has(gr.targets, x)) rep.error('accCov', `groinGuard: ${x}를 보호 대상으로 가짐 (금지)`);
  if (!(gr.coverProb && (gr.coverProb.side || 0) <= 0.0 && (gr.coverProb.rear || 0) <= 0.0)) rep.warn('accCov', `groinGuard: side/rear coverProb가 0이 아님`);
  // neck
  const nk = ACC.neck || {};
  for (const t of ['lowerNeck','collarLine','neckAdjacent']) if (!has(nk.targets, t)) rep.warn('accCov', `neckGuard: 보호 대상에 ${t} 없음`);
  for (const x of ['head','face','chest']) if (has(nk.targets, x)) rep.error('accCov', `neckGuard: ${x}를 보호 대상으로 가짐 (금지)`);
  // 2A-6.4-AAR: zoneDist 구조 검증 — 확률 0~1, 금지부위가 prob>0으로 들어있지 않은지
  for (const type of ['shoulder','groin','neck']) {
    const prof = ACC[type]; if (!prof || !prof.zoneDist) continue;
    for (const asp in prof.zoneDist) {
      for (const d of prof.zoneDist[asp]) {
        if (!(d.prob >= 0 && d.prob <= 1)) rep.error('accCov', `${type}.zoneDist.${asp}: ${d.zone} prob ${d.prob} 범위(0~1) 벗어남`);
        if (!(d.w >= 0)) rep.error('accCov', `${type}.zoneDist.${asp}: ${d.zone} weight 음수`);
        if (d.prob > 0 && has(prof.excludes, d.zone)) rep.error('accCov', `${type}.zoneDist.${asp}: 금지부위 ${d.zone}가 prob>0 (누수)`);
      }
    }
  }
  // shoulder 금지부위가 zoneDist에서 prob>0이면 누수
  for (const x of ['forearm','elbowJoint','elbow','hand','wrist','upperArmDistal','upperArmLower']) {
    if (sh.zoneDist) for (const asp in sh.zoneDist) for (const d of sh.zoneDist[asp]) if (d.zone===x && d.prob>0) rep.error('accCov', `shoulderGuard zoneDist: ${x} prob>0 (팔꿈치/전완/손 누수 금지)`);
  }
  // groin 금지부위 누수
  for (const x of ['upperAbdomen','chest','thigh','thighLateral','thighRear','knee','calf','foot']) {
    if (gr.zoneDist) for (const asp in gr.zoneDist) for (const d of gr.zoneDist[asp]) if (d.zone===x && d.prob>0) rep.error('accCov', `groinGuard zoneDist: ${x} prob>0 (상복부/가슴/일반다리 누수 금지)`);
  }
  // isAccessoryAllowedForImpact 존재 확인
  if (typeof isAccessoryAllowedForImpact !== 'function') rep.warn('accCov', 'isAccessoryAllowedForImpact 미정의');
  // 본체 neck/arms 정리 + 6B23 예외
  if (typeof BODY_ARMOR_PRESETS !== 'undefined') {
    for (const id in BODY_ARMOR_PRESETS) {
      const cov = BODY_ARMOR_PRESETS[id].coverage || {};
      const armsSoft = cov.arms ? (cov.arms.softP || 0) : 0;
      const armsHard = cov.arms ? (cov.arms.hardP || 0) : 0;
      if (armsSoft > 0.02 || armsHard > 0.02) rep.warn('accCov', `${id}: 본체 arms 기본 방호 잔존 (softP ${armsSoft})`);
      const neckSoft = cov.neck ? (cov.neck.softP || 0) : 0;
      if (id === 'armor_6b23_test') {
        if (neckSoft <= 0) rep.error('accCov', `6B23: 기본 neck 방호가 제거됨 (예외 유지 필요)`);
        // 2A-6.4: 6B23 기본 목보호가 과하지 않고(별도 neckGuard급 X), head/face/chest로 확장되지 않는지
        const neckSoftArmor = cov.neck && cov.neck.soft ? (cov.neck.soft.smallArmor||0) : 0;
        if (neckSoftArmor > 28) rep.warn('accCov', `6B23: 기본 neck softArmor ${neckSoftArmor} 과도 (별도 neckGuard급 32+ 금지, 22~25 권장)`);
        if (neckSoft > 0.30) rep.warn('accCov', `6B23: 기본 neck softP ${neckSoft} 과도 (0.18~0.25 권장)`);
        // head/face/chest로 확장 금지 — 본체 coverage엔 head/face 슬롯이 없어야 정상
        if (cov.head || cov.face) rep.error('accCov', `6B23: 기본 목 방호가 head/face로 확장됨 (금지)`);
      } else {
        if (neckSoft > 0.02) rep.warn('accCov', `${id}: 본체 neck 기본 방호 잔존 (softP ${neckSoft}) — 일반 방탄복은 neckGuard 전담`);
      }
      // 2A-6.4: legs fallback 방호 제거 확인 (groinGuard만 upperInnerThighProximal 일부 보호)
      const legsSoft = cov.legs ? (cov.legs.softP || 0) : 0;
      const legsHard = cov.legs ? (cov.legs.hardP || 0) : 0;
      const legsArmor = cov.legs && cov.legs.soft ? (cov.legs.soft.smallArmor||0) : 0;
      if (legsSoft > 0.02 || legsHard > 0.02 || legsArmor > 2) rep.warn('accCov', `${id}: 본체 legs fallback 방호 잔존 (softP ${legsSoft}/armor ${legsArmor}) — 제거 필요`);
    }
    // Police Vest noPlateSlots 유지 확인
    const pv = BODY_ARMOR_PRESETS['police_vest'];
    if (pv && pv.noPlateSlots === undefined && pv.noPlateSlot === undefined) rep.info('accCov', 'police_vest: noPlateSlots 정보 확인 권장');
  }
  // visor effective FOV 구조
  if (typeof getEffectiveViewArc !== 'function') rep.error('accCov', 'getEffectiveViewArc 미정의 (visor FOV 반영 불가)');
  return rep;
}

// =============================================================
// 2A-6.2: 바이저 시야 패널티 + 분리 내구도/상태 시스템 (모든 visor 공통)
//   - glass condition: clean → scratched → cracked → shattered (시야 악화)
//   - K6-3: glass(시야) + titanium faceplate(방호 변형) 분리
//   - 시야 modifier는 탐지/반응/목표획득에만 곱/덧셈으로 얹음
// =============================================================
const VISOR_GLASS_CONDITION_STEPS = ['clean','scratched','cracked','shattered'];
const VISOR_FACEPLATE_CONDITION_STEPS = ['intact','dented','damaged','compromised'];
// glass 상태별 추가 시야 패널티 (기본 vision에 누적)
const VISOR_GLASS_CONDITION_VISION = {
  clean:     { fovMulAdd:0.00, peripheralMulAdd:0.00, targetAcquireTimeAdd:0.00, reactionDelayAdd:0.00, lowLightPenaltyAdd:0.00, closeAwarenessMulAdd:0.00 },
  scratched: { fovMulAdd:-0.03, peripheralMulAdd:-0.03, targetAcquireTimeAdd:0.04, reactionDelayAdd:0.02, lowLightPenaltyAdd:0.05, closeAwarenessMulAdd:-0.03 },
  cracked:   { fovMulAdd:-0.10, peripheralMulAdd:-0.10, targetAcquireTimeAdd:0.10, reactionDelayAdd:0.05, lowLightPenaltyAdd:0.12, closeAwarenessMulAdd:-0.08 },
  shattered: { fovMulAdd:-0.22, peripheralMulAdd:-0.20, targetAcquireTimeAdd:0.25, reactionDelayAdd:0.10, lowLightPenaltyAdd:0.20, closeAwarenessMulAdd:-0.20 },
};
// glass durability 비율 → condition
function _glassConditionFromRatio(ratio) {
  if (ratio > 0.75) return 'clean';
  if (ratio > 0.45) return 'scratched';
  if (ratio > 0.0)  return 'cracked';
  return 'shattered';
}
// faceplate durability 비율 → condition
function _facePlateConditionFromRatio(ratio) {
  if (ratio > 0.75) return 'intact';
  if (ratio > 0.45) return 'dented';
  if (ratio > 0.0)  return 'damaged';
  return 'compromised';
}
// 유닛 바이저 상태 초기화 (장착 visor 기준)
function initUnitVisorState(unit) {
  unit.visorState = null;
  if (!unit || !unit.visorId) return;
  const v = (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') ? PROTECTION_ACCESSORY_PRESETS[unit.visorId] : null;
  if (!v || v.isNone || v.accessoryType !== 'visor') return;
  const spec = v.visorDurabilitySpec || {};
  const hasGlass = (spec.glassMaxDurability != null) || !!v.visorHitTable || (v.material === 'pe');
  const glassMax = spec.glassMaxDurability != null ? spec.glassMaxDurability : (v.maxDurability || 22);   // SIDE-ARMOR-DURABILITY-REALISM-1 §17: visor glass 16~24
  const st = {
    visorId: unit.visorId,
    hasGlass: hasGlass,
    glassMaxDurability: glassMax,
    glassDurability: glassMax,
    glassCondition: 'clean',
    glassHit: false,
  };
  // K6-3 등 titanium faceplate 분리
  if (spec.facePlateMaxDurability != null || (v.visorHitTable && v.visorHitTable.some(z=>z.id==='titanium'))) {
    st.hasFacePlate = true;
    st.facePlateMaxDurability = spec.facePlateMaxDurability != null ? spec.facePlateMaxDurability : 42;
    st.facePlateDurability = st.facePlateMaxDurability;
    st.facePlateCondition = 'intact';
    st.facePlateHit = false;
  }
  unit.visorState = st;
}
// 바이저 zone 피격 처리 — glass면 시야/유리내구도, titanium이면 faceplate 변형/방호내구도
//   zoneId: 'glass' | 'titanium' | null(기본 glass)
function applyVisorZoneHit(unit, zoneId, penAmount) {
  if (!unit || !unit.visorState) return;
  const st = unit.visorState;
  const zone = (zoneId === 'titanium') ? 'titanium' : 'glass';
  const dmg = Math.max(2, Math.round((penAmount != null ? penAmount : 8)));
  if (zone === 'titanium' && st.hasFacePlate) {
    st.facePlateHit = true;
    st.facePlateDurability = Math.max(0, st.facePlateDurability - dmg);
    st.facePlateCondition = _facePlateConditionFromRatio(st.facePlateDurability / st.facePlateMaxDurability);
  } else if (st.hasGlass) {
    st.glassHit = true;
    st.glassDurability = Math.max(0, st.glassDurability - dmg);
    st.glassCondition = _glassConditionFromRatio(st.glassDurability / st.glassMaxDurability);
  }
}
// visor 기본 시야 modifier (장착만으로 적용)
function getVisorVisionModifier(unit) {
  const base = { fovMul:1.0, peripheralMul:1.0, targetAcquireTimeAdd:0.0, reactionDelayAdd:0.0, lowLightPenalty:0.0, closeAwarenessMul:1.0 };
  if (!unit || !unit.visorId) return base;
  const v = (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') ? PROTECTION_ACCESSORY_PRESETS[unit.visorId] : null;
  if (!v || v.isNone || v.accessoryType !== 'visor' || !v.vision) return base;
  const vis = v.vision;
  return {
    fovMul: vis.fovMul != null ? vis.fovMul : 1.0,
    peripheralMul: vis.peripheralMul != null ? vis.peripheralMul : 1.0,
    targetAcquireTimeAdd: vis.targetAcquireTimeAdd || 0.0,
    reactionDelayAdd: vis.reactionDelayAdd || 0.0,
    lowLightPenalty: vis.lowLightPenalty || 0.0,
    closeAwarenessMul: vis.closeAwarenessMul != null ? vis.closeAwarenessMul : 1.0,
  };
}
// glass condition으로 인한 추가 시야 modifier
function getVisorConditionModifier(unit) {
  const z = { fovMulAdd:0, peripheralMulAdd:0, targetAcquireTimeAdd:0, reactionDelayAdd:0, lowLightPenaltyAdd:0, closeAwarenessMulAdd:0 };
  if (!unit || !unit.visorState || !unit.visorState.hasGlass) return z;
  const c = unit.visorState.glassCondition || 'clean';
  return VISOR_GLASS_CONDITION_VISION[c] || z;
}
// 최종 시야 modifier (기본 visor + glass condition 합성)
function getUnitVisionModifiers(unit) {
  const base = getVisorVisionModifier(unit);
  const cond = getVisorConditionModifier(unit);
  const clamp01 = (x) => Math.max(0.05, Math.min(1.0, x));
  return {
    fovMul: clamp01(base.fovMul + cond.fovMulAdd),
    peripheralMul: clamp01(base.peripheralMul + cond.peripheralMulAdd),
    targetAcquireTimeAdd: Math.max(0, base.targetAcquireTimeAdd + cond.targetAcquireTimeAdd),
    reactionDelayAdd: Math.max(0, base.reactionDelayAdd + cond.reactionDelayAdd),
    lowLightPenalty: Math.max(0, base.lowLightPenalty + cond.lowLightPenaltyAdd),
    closeAwarenessMul: clamp01(base.closeAwarenessMul + cond.closeAwarenessMulAdd),
  };
}
if (typeof window !== 'undefined') {
  window.getUnitVisionModifiers = getUnitVisionModifiers;
  window.applyVisorZoneHit = applyVisorZoneHit;
}
// 시야 modifier → 조준/목표획득 속도 배율 (≤1.0). no_visor면 1.0.
function getVisorAimMul(unit) {
  if (!unit || !unit.visorId) return 1.0;
  const m = getUnitVisionModifiers(unit);
  // fovMul 기반 + targetAcquire 지연 반영 (부드럽게)
  let mul = m.fovMul - m.targetAcquireTimeAdd * 0.4;
  return Math.max(0.4, Math.min(1.0, mul));
}
// 시야 modifier → 탐지 신뢰도 배율 (주변시/근거리 인지)
function getVisorDetectionMul(unit) {
  if (!unit || !unit.visorId) return 1.0;
  const m = getUnitVisionModifiers(unit);
  return Math.max(0.4, Math.min(1.0, (m.peripheralMul * 0.6 + m.closeAwarenessMul * 0.4)));
}
// 2A-6.3: 실제 시야각/시야거리에 바이저 vision 반영
//   effective viewArc = unit.viewArc * fovMul (좌우 시야 좁아짐, glass 상태 누적 반영)
function getEffectiveViewArc(unit) {
  if (!unit) return Math.PI;
  const base = (unit.viewArc != null) ? unit.viewArc : Math.PI;
  if (!unit.visorId) return base;
  const m = getUnitVisionModifiers(unit);
  return base * (m.fovMul != null ? m.fovMul : 1.0);
}
// effective 시야거리 — 저조도 패널티를 약하게 반영 (peripheral 기반). 기본은 변화 없음.
function getEffectiveVisionRange(unit) {
  const base = (unit && unit.sightRange != null) ? unit.sightRange : mToPx(24);   // SIDE-METRIC-SCALE-1: legacy 480px=24m
  if (!unit || !unit.visorId) return base;
  const m = getUnitVisionModifiers(unit);
  // lowLightPenalty/peripheral을 약하게 반영 (최대 ~15% 감소)
  const mul = Math.max(0.80, 1.0 - (m.lowLightPenalty || 0) * 0.5);
  return base * mul;
}

function getAccessoryWeight(unit) {
  let kg = 0;
  const ids = [unit.groinGuardId, unit.shoulderGuardId, unit.neckGuardId, unit.visorId, unit.slaapId];
  for (const id of ids) {
    if (id && PROTECTION_ACCESSORY_PRESETS[id]) kg += PROTECTION_ACCESSORY_PRESETS[id].weightKg || 0;
  }
  return kg;
}

// accessory가 특정 부위/aspect에 적용되는지
//   - groin: abdomen_front (하부) — 1차에선 abdomen_front softP/Armor 보정
//   - shoulder: arms (양쪽)
//   - neck: neck
//   - visor: head_face
//   - slaap: head_skull front aspect만
// =============================================================
// 2A-6.3: 추가 보호대 세부 방호범위 정의
//   shoulderGuard: 어깨관절/삼각근/상완 근위부/겨드랑이 인접 (전완/팔꿈치/손 X, 후면 거의 X)
//   groinGuard: 낭심/서혜부/정면 하복부 일부/대퇴 내측 근위부 (측복부/flank/일반 대퇴 X, side/rear X)
//   neckGuard: 하부 목/쇄골선/목 인접 (head/face/chest X)
// =============================================================
const _ACCESSORY_COVERAGE = {
  shoulder: {
    coverProb: { front: 0.42, side: 0.45, left: 0.45, right: 0.45, rear: 0.05, default: 0.40 },
    targets: ['shoulderJoint','shoulderCap','upperArmProximal','axillaAdjacent','deltoid'],
    excludes: ['forearm','elbowJoint','elbow','hand','wrist','upperArmDistal','upperArmLower','lowerArm'],
    // 2A-6.4-AAR: 어깨/상완부 상단만. 피격 방향별 서브존 분포 + 존별 확률.
    zoneDist: {
      front: [ {zone:'shoulderCap',w:0.28,prob:0.80},{zone:'shoulderJoint',w:0.24,prob:0.78},{zone:'deltoid',w:0.20,prob:0.62},{zone:'upperArmProximal',w:0.16,prob:0.45},{zone:'axillaAdjacent',w:0.06,prob:0.30},{zone:'upperArmDistal',w:0.06,prob:0.0} ],
      side:  [ {zone:'shoulderCap',w:0.30,prob:0.78},{zone:'shoulderJoint',w:0.24,prob:0.74},{zone:'deltoid',w:0.22,prob:0.60},{zone:'upperArmProximal',w:0.16,prob:0.42},{zone:'upperArmDistal',w:0.08,prob:0.0} ],
      rear:  [ {zone:'shoulderCap',w:0.30,prob:0.18},{zone:'upperArmProximal',w:0.30,prob:0.10},{zone:'upperArmDistal',w:0.40,prob:0.0} ],
    },
  },
  groin: {
    coverProb: { front: 0.42, side: 0.0, left: 0.0, right: 0.0, rear: 0.0, default: 0.0 },
    targets: ['groinAdjacent','pelvisGroinAdjacent','lowerAbdomenFront','lowerAbdomenExposed','upperInnerThighProximal'],
    excludes: ['upperAbdomen','upperAbdomenFront','abdomen_side','flank','thigh','thighLateral','thighRear','knee','calf','lowerLeg','ankle','foot','hipJoint','chest'],
    // 2A-6.4-AAR: 전면 하단 패널 — 하복부/골반/낭심/상부내측대퇴 광범위, upper/flank 금지.
    zoneDist: {
      front: [
        {zone:'groin',w:0.16,prob:0.90},
        {zone:'lowerAbdomenFront',w:0.16,prob:0.80},
        {zone:'lowerAbdomenCenter',w:0.15,prob:0.78},
        {zone:'lowerAbdomenAdjacent',w:0.12,prob:0.75},
        {zone:'pelvisAdjacent',w:0.12,prob:0.85},
        {zone:'pelvisGroinAdjacent',w:0.09,prob:0.85},
        {zone:'upperInnerThighProximal',w:0.06,prob:0.45},
        {zone:'sideAbdomen',w:0.06,prob:0.18},
        {zone:'upperAbdomen',w:0.08,prob:0.0},
      ],
      // 측면/후면: 패널이 옆으로 살짝 걸치는 정도만 낮게
      side: [ {zone:'sideAbdomen',w:0.5,prob:0.18},{zone:'flank',w:0.5,prob:0.0} ],
    },
    genericFallback: 0.40,   // 세부주소 불명확한 generic abdomen front
  },
  neck: {
    coverProb: { front: 0.55, side: 0.45, left: 0.45, right: 0.45, rear: 0.35, default: 0.45 },
    targets: ['lowerNeck','collarLine','neckAdjacent','throatAdjacent'],
    excludes: ['head','face','chest','skull','jaw'],
    // 2A-6.4-AAR: 목 하단/쇄골선/기도 인접만. head/face/chest 금지, rearNeck 과보호 금지.
    zoneDist: {
      front: [ {zone:'lowerNeck',w:0.34,prob:0.80},{zone:'collarLine',w:0.30,prob:0.72},{zone:'throatAdjacent',w:0.22,prob:0.62},{zone:'neckAdjacent',w:0.14,prob:0.50} ],
      side:  [ {zone:'lowerNeck',w:0.40,prob:0.66},{zone:'neckAdjacent',w:0.34,prob:0.52},{zone:'collarLine',w:0.26,prob:0.48} ],
      rear:  [ {zone:'rearNeck',w:0.60,prob:0.30},{zone:'lowerNeck',w:0.40,prob:0.34} ],
    },
  },
};
// 2A-6.4-AAR: 추가보호대가 해당 세부 피격주소를 보호할 수 있는지 최종 확인 (보호 불가면 취소).
function isAccessoryAllowedForImpact(accessoryType, zone) {
  const prof = (typeof _ACCESSORY_COVERAGE !== 'undefined') ? _ACCESSORY_COVERAGE[accessoryType] : null;
  if (!prof || !zone) return true;
  if (prof.excludes && prof.excludes.indexOf(zone) >= 0) return false;
  return true;
}
// 가중 분포에서 서브존 1개 sample (MSV는 확률 0.85배)
function _sampleAccessoryZone(prof, asp, msvMul) {
  const dist = prof.zoneDist && (prof.zoneDist[asp] || prof.zoneDist[(asp==='left'||asp==='right')?'side':asp] || prof.zoneDist.front);
  if (!dist || !dist.length) return null;
  let total = 0; for (const d of dist) total += d.w;
  let r = Math.random() * total;
  let picked = dist[dist.length-1];
  for (const d of dist) { if (r < d.w) { picked = d; break; } r -= d.w; }
  const prob = Math.max(0, Math.min(1, picked.prob * (msvMul || 1.0)));
  return { zone: picked.zone, prob };
}
// 2A-6.3 마감: 추가 보호대(shoulder/groin/neck) 적용 판정은 피격 1회 단위로 계산한다.
//   getProtectionProfile 캐시에는 base armor + plate(deterministic)만 남기고,
//   확률적 coverProb / 서브존 sample은 rollProtection에서 매 피격마다 이 함수로 처리한다.
//   visor/SLAAP는 기존처럼 getAccessoriesForSlot(캐시 경로)에서 유지.
function rollBodyAccessoriesForSlot(unit, location, aspect) {
  const list = [];
  const ACC = (typeof _ACCESSORY_COVERAGE !== 'undefined') ? _ACCESSORY_COVERAGE : null;
  function pushAccGated(a, type, asp) {
    if (!a || a.isNone) return;
    const prof = ACC && ACC[type];
    if (!prof) { list.push(a); return; }
    // MSV 계열 추가보호대는 확률 0.85배 (가볍고 좁은 패널)
    const msvMul = (a.id && /^msv_/.test(a.id)) ? 0.85 : 1.0;
    // 2A-6.4-AAR: 서브존 분포가 있으면 zone별 확률로 판정 (없으면 기존 coverProb 방식)
    if (prof.zoneDist) {
      const samp = _sampleAccessoryZone(prof, asp, msvMul);
      if (!samp) return;
      if (samp.prob <= 0) return;
      if (Math.random() >= samp.prob) return;        // 해당 서브존 밖/미보호
      if (!isAccessoryAllowedForImpact(type, samp.zone)) return;   // 금지 부위면 취소
      list.push(Object.assign({}, a, { _coverageAddr: samp.zone, _accType: type, _accId: a.id }));
      return;
    }
    const cp0 = (prof.coverProb && prof.coverProb[asp] != null) ? prof.coverProb[asp] : (prof.coverProb && prof.coverProb.default != null ? prof.coverProb.default : 1.0);
    const cp = cp0 * msvMul;
    if (cp <= 0) return;                        // 후면 등 비보호 방향
    if (Math.random() >= cp) return;            // 서브존 밖(전완/측복부 등) 피격 → 보호 안 됨
    const targets = prof.targets || [];
    const addr = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
    if (!isAccessoryAllowedForImpact(type, addr)) return;
    list.push(Object.assign({}, a, { _coverageAddr: addr, _accType: type, _accId: a.id }));
  }
  // location 정규화 (left_arm/right_arm → arms)
  const loc = (location === 'left_arm' || location === 'right_arm') ? 'arms' : location;
  if (loc === 'abdomen' && aspect === 'front' && unit.groinGuardId) {
    pushAccGated(PROTECTION_ACCESSORY_PRESETS[unit.groinGuardId], 'groin', 'front');
  } else if (loc === 'abdomen' && (aspect === 'side' || aspect === 'left' || aspect === 'right') && unit.groinGuardId) {
    // 측복부: 패널이 옆으로 살짝 걸치는 정도만 (매우 낮음)
    pushAccGated(PROTECTION_ACCESSORY_PRESETS[unit.groinGuardId], 'groin', 'side');
  }
  if (loc === 'arms' && unit.shoulderGuardId) {
    pushAccGated(PROTECTION_ACCESSORY_PRESETS[unit.shoulderGuardId], 'shoulder', aspect || 'front');
  }
  if (loc === 'neck' && unit.neckGuardId) {
    pushAccGated(PROTECTION_ACCESSORY_PRESETS[unit.neckGuardId], 'neck', aspect || 'front');
  }
  return list;
}
function getAccessoriesForSlot(unit, location, aspect) {
  const list = [];
  // 2A-6.3 마감: shoulder/groin/neck는 캐시 경로에서 제외 (rollBodyAccessoriesForSlot에서 피격마다 계산).
  //   여기서는 visor/SLAAP만 처리 (헬멧 악세사리 레지스트리 기반, 기존 유지).
  if (location === 'head_face' && unit.visorId) {
    const a = PROTECTION_ACCESSORY_PRESETS[unit.visorId];
    if (a && !a.isNone) {
      // K6-3 등 다영역 바이저 — 가중치로 영역 sample
      if (a.visorHitTable && a.visorHitTable.length > 0) {
        //   누적 가중치 방식: r이 각 zone의 weight 안에 들면 그 zone 선택
        let r = Math.random();
        let picked = a.visorHitTable[a.visorHitTable.length - 1];  // fallback: 마지막 zone
        for (const z of a.visorHitTable) {
          if (r < z.weight) { picked = z; break; }
          r -= z.weight;
        }
        // 영역을 단일 hard accessory로 wrap
        //   계산용 material(picked.material, 예: 'pe')은 유지.
        //   표시/주소용 정보(zone id/label/displayMaterial)는 별도로 보존.
        const isGlassZone = (picked.id === 'glass' || /glass|visor/i.test(picked.id) || /유리/.test(picked.label || ''));
        list.push({
          ...a,
          material: picked.material,
          // ARMOR-HOTFIX-1 §4: durability 계산은 zone 전용 재질 (glass는 glass 곡선/반응)
          durabilityMaterial: picked.durabilityMaterial || (isGlassZone ? 'glass' : picked.material),
          armorValue: picked.armorValue,
          armorType: 'hard',
          bluntMul: picked.bluntMul,
          _zoneLabel: picked.label,
          _visorZoneId: picked.id,
          _visorDisplayMaterial: isGlassZone ? 'glass' : (picked.material === 'titanium' ? 'titanium' : picked.material),
        });
      } else {
        list.push(a);
      }
    }
  }
  if (location === 'head_skull' && aspect === 'front' && unit.slaapId) {
    const a = PROTECTION_ACCESSORY_PRESETS[unit.slaapId];
    if (a && !a.isNone) list.push(a);
  }
  return list;
}

// 합성 — protection slot + accessory들
//   soft accessory는 softP 끌어올림 + softArmor max
//   hard accessory는 hardP 끌어올림 + hardArmor max (slot에 hard 없으면 추가)
function compositeSlotWithAccessories(slot, accessories) {
  if (!accessories || accessories.length === 0) return slot;
  let hardP = slot.hardP || 0;
  let softP = slot.softP || 0;
  let noneP = slot.noneP != null ? slot.noneP : 1.0 - hardP - softP;
  let hardArmor = slot.hard && slot.hard.smallArmor ? slot.hard.smallArmor : 0;
  let softArmor = slot.soft && slot.soft.smallArmor ? slot.soft.smallArmor : 0;
  let hardMat = (slot.hard && slot.hard.material) || 'composite';
  let softMat = (slot.soft && slot.soft.material) || 'aramid';
  let backer = !!slot.softBacker;

  for (const a of accessories) {
    if (a.armorType === 'soft') {
      // softP 보강 (최대 1.0 - hardP, 0.15 정도 끌어올림)
      const addSoft = Math.min(0.30, (a.armorValue || 0) / 100);
      softP = Math.min(1.0 - hardP, softP + addSoft);
      noneP = Math.max(0, 1.0 - hardP - softP);
      softArmor = Math.max(softArmor, a.armorValue || 0);
      softMat = a.material || softMat;
    } else if (a.armorType === 'hard' || a.armorType === 'mixed') {
      // 바이저(visor): 안면을 거의 전부 덮음 — hardP를 높게(~0.90), 턱/하악만 노출
      if (a.accessoryType === 'visor') {
        hardP = Math.min(0.90, Math.max(hardP, 0.90));   // 안면 ~90% 차폐
        softP = 0;
        noneP = Math.max(0, 1.0 - hardP);                 // 나머지 ~10% = 턱/하악 노출
        const hv = (a.armorValue || 0) || (a.visorHitTable ? Math.max(...a.visorHitTable.map(z=>z.armorValue||0)) : 0);
        if (hv > hardArmor) { hardArmor = hv; hardMat = a.material || hardMat; }
        backer = false;
      } else {
        const addHard = Math.min(0.35, (a.armorValue || 0) / 80);
        hardP = Math.min(1.0, hardP + addHard);
        if (hardP + softP > 1.0) softP = Math.max(0, 1.0 - hardP);
        noneP = Math.max(0, 1.0 - hardP - softP);
        if ((a.armorValue || 0) > hardArmor) {
          hardArmor = a.armorValue || 0;
          hardMat = a.material || hardMat;
        }
        backer = true;
      }
    }
  }
  const composited = P(hardP, softP, noneP, hardArmor, softArmor, backer, hardMat, softMat);
  // === 2A-1: visor zone 정보 보존 (계산용 material과 별개로 표시/주소용) ===
  for (const a of accessories) {
    if (a._visorZoneId) {
      composited._visorZoneId = a._visorZoneId;
      composited._visorZoneLabel = a._zoneLabel;
      composited._visorDisplayMaterial = a._visorDisplayMaterial;
      // PRETRAUMA-STAB-1 §4.1: zone 전용 durability 재질을 slot 끝까지 보존 (실전 경로 — mixed는 계산 재질 금지)
      if (a.durabilityMaterial) { composited._zoneDurabilityMaterial = a.durabilityMaterial; composited.durabilityMaterial = a.durabilityMaterial; }
    }
    // 2A-6.3: accessory 세부 방호 주소 보존 (AAR/impactAddress 라벨용)
    if (a._coverageAddr || a._accType) {
      composited._accCoverageAddr = a._coverageAddr;
      composited._accType = a._accType;
      composited._accId = a._accId;
    }
  }
  return composited;
}

// =============================================================
