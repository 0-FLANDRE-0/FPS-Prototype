// 2. HIT TABLES & OUTCOMES
// =============================================================
const HIT_LOC_TABLES = {
  // head_skull은 상부 / head_temporal은 측두부·관자놀이·귀 주변
  //   정면에서는 head_temporal 비중 매우 낮음 (정면에서 측면이 잘 안 보임)
  //   측면에서는 head_temporal 비중 크게 증가 (aspect 보정에서 처리)
  //   2A 밸런스: 가슴(플레이트)을 주 명중부위로. 복부/머리/다리는 보조.
  standing: { head_skull:0.045, head_temporal:0.018, head_face:0.017, neck:0.010, chest:0.49, abdomen:0.18, arms:0.13, legs:0.110 },
  moving:   { head_skull:0.040, head_temporal:0.016, head_face:0.015, neck:0.009, chest:0.44, abdomen:0.19, arms:0.15, legs:0.140 },
  crouched: { head_skull:0.058, head_temporal:0.023, head_face:0.023, neck:0.012, chest:0.475, abdomen:0.15, arms:0.12, legs:0.139 },
  cover:    { head_skull:0.100, head_temporal:0.040, head_face:0.040, neck:0.020, chest:0.60, abdomen:0.10, arms:0.090, legs:0.010 },
  pinned:   { head_skull:0.038, head_temporal:0.015, head_face:0.015, neck:0.008, chest:0.26, abdomen:0.16, arms:0.28, legs:0.214 },
  prone:    { head_skull:0.060, head_temporal:0.024, head_face:0.014, neck:0.008, chest:0.23, abdomen:0.13, arms:0.27, legs:0.244 },
};
const LOC_KOR = {
  head_skull:'두개부', head_temporal:'측두부', head_face:'얼굴', neck:'목',
  chest:'가슴', abdomen:'복부', arms:'팔', legs:'다리',
  left_arm:'왼팔', right_arm:'오른팔', left_leg:'왼다리', right_leg:'오른다리',
};
// SIDE-HITLOC-COVER-EXPOSURE-1: half-cover 통과 노출 컨텍스트 (resolveImpact가 설정, 피격부위/세부주소 picker가 읽음)
let _hitCoverExposure = null;
// SIDE-HITLOC-COVER-EXPOSURE-1A: ray가 지나온 half-cover의 exit point → 실제 targetHitPoint 거리로 노출 밴드 산출
//   (cover 중심점/표적 중심점/entry 기준 금지 — exit→hitPoint만 사용)
function _computeRayCoverExposure(ray) {
  if (!ray || !ray.passedHalfCovers || !ray.passedHalfCovers.length) return null;
  const hx = ray.x, hy = ray.y;   // 실제 탄-유닛 hitbox 교점
  const PX_M = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 20;
  // targetHitPoint에 가장 가까운(=마지막 통과) half-cover의 exit point 선택
  let best = null, bestD = Infinity;
  for (const c of ray.passedHalfCovers) {
    const d = Math.hypot(c.exitX - hx, c.exitY - hy);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return null;
  const distM = bestD / PX_M;
  return { band: _coverExposureBand(distM), distM, obj: best.obj, outcome: best.outcome, kind: 'over' };
}
// SIDE-HITLOC-COVER-INTERACTION-1B: half-cover를 관통한 탄의 exit→실제 targetHitPoint 거리 (over와 반대 성향 보정용)
function _computeRayCoverPenetrationExposure(ray) {
  if (!ray || !ray.penetratedHalfCovers || !ray.penetratedHalfCovers.length) return null;
  const hx = ray.x, hy = ray.y;
  const PX_M = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 20;
  let best = null, bestD = Infinity;
  for (const c of ray.penetratedHalfCovers) {
    const d = Math.hypot(c.exitX - hx, c.exitY - hy);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return null;
  const distM = bestD / PX_M;
  const stability = (best.after && best.after.stability != null) ? best.after.stability : 1.0;
  return { band: _coverExposureBand(distM), distM, obj: best.obj, outcome: best.outcome, kind: 'penetrated', stability };
}
function _coverExposureBand(distM) {
  if (distM < 0.6) return 'contact';   // 밀착
  if (distM < 1.5) return 'near';      // 가까움
  if (distM < 3.0) return 'mid';       // 중거리
  return 'far';                        // 엄폐 효과 약화
}
const OUTCOME = {
  MISS:'miss', NEAR:'near', BLOCK:'block',
  LIGHT:'light', SERIOUS:'serious', DOWN:'down', KILL:'kill'
};
const OUTCOME_KOR = {
  miss:'빗나감', near:'근접탄', block:'방호 차단',
  light:'경상', serious:'중상', down:'전투불능', kill:'사망'
};

// =============================================================
// 부위별 체력제 (1차) + woundSeverity
// =============================================================
//   - hitLocation(머리/얼굴/목 등 세분)을 5개 큰 부위(BODY_PART)로 매핑
//   - applyOutcome에서 결정한 OUTCOME을 woundSeverity로 변환 후 bodyHp에 반영
//   - 일부는 전체 hp에도 흘러간다 (부위별 비율)
//   - updateCombatState가 최종 유닛 상태를 결정 (active/wounded/downed/dead)
const BODY_PARTS = ['head', 'chest', 'abdomen', 'arms', 'legs'];
const BODY_PART_KOR = { head:'머리', neck:'목', chest:'가슴', abdomen:'복부',
                        arms:'팔', legs:'다리',
                        left_arm:'왼팔', right_arm:'오른팔', left_leg:'왼다리', right_leg:'오른다리' };
function locationToBodyPart(loc) {
  if (loc === 'head_skull' || loc === 'head_temporal' || loc === 'head_face' || loc === 'neck') return 'head';
  if (loc === 'chest')    return 'chest';
  if (loc === 'abdomen')  return 'abdomen';
  if (loc === 'arms' || loc === 'left_arm' || loc === 'right_arm') return 'arms';
  if (loc === 'legs' || loc === 'left_leg' || loc === 'right_leg') return 'legs';
  return 'chest';
}

// woundSeverity — 부위 손상의 정도 (graze/light/serious/critical)
//   OUTCOME에서 변환되지만, 팔/다리는 KILL이 와도 critical로만 처리해서
//   "팔 사망"같은 표현이 나오지 않게 한다.
const SEVERITY = { GRAZE:'graze', LIGHT:'light', SERIOUS:'serious', CRITICAL:'critical' };
const SEVERITY_KOR = { graze:'스침', light:'경상', serious:'중상', critical:'치명상' };
function outcomeToSeverity(outcome, bodyPart) {
  if (outcome === OUTCOME.MISS || outcome === OUTCOME.NEAR) return null;
  if (outcome === OUTCOME.BLOCK)   return SEVERITY.GRAZE;
  if (outcome === OUTCOME.LIGHT)   return SEVERITY.LIGHT;
  if (outcome === OUTCOME.SERIOUS) return SEVERITY.SERIOUS;
  // DOWN/KILL — 머리/가슴/복부에서는 치명, 팔/다리는 한 단계 낮춤
  if (outcome === OUTCOME.KILL) {
    if (bodyPart === 'arms' || bodyPart === 'legs') return SEVERITY.SERIOUS;
    return SEVERITY.CRITICAL;
  }
  if (outcome === OUTCOME.DOWN) {
    if (bodyPart === 'arms' || bodyPart === 'legs') return SEVERITY.SERIOUS;
    return SEVERITY.CRITICAL;
  }
  return SEVERITY.LIGHT;
}

// 부위별 bodyHp 손상량 (severity → 0~100 중 깎이는 값)
function severityToBodyDamage(sev) {
  switch (sev) {
    case SEVERITY.GRAZE:    return 4;
    case SEVERITY.LIGHT:    return 14;
    case SEVERITY.SERIOUS:  return 38;
    case SEVERITY.CRITICAL: return 80;
  }
  return 0;
}

// 부위별 → 전체 hp로 흘러가는 비율
//   머리/가슴이 가장 높고, 팔/다리는 낮음 (팔다리 피격이 즉사로 직결되지 않게)
const BODY_HP_BLEED = {
  head: 1.20, chest: 1.10, abdomen: 0.85, arms: 0.30, legs: 0.40,
};

// updateCombatState — 부위 bodyHp + 전체 hp 기반으로 유닛 상태 결정
//   active   : 큰 손상 없음
//   wounded  : 어느 부위든 serious 이상 손상이 있음
//   downed   : 쓰러짐. dead 아님. 의식 여부에 따라 행동 제한
//   dead     : 사망 — 머리 또는 가슴 치명, 또는 hp <= 0
function updateCombatState(unit) {
  if (unit.isDead) return null;
  // === 새 medical system이 있으면 그쪽이 사망/다운 판정 ===
  //   syncLegacyCombatState가 unit.isDead/isDowned/combatState/conscious 모두 갱신함
  if (unit.medical) {
    const prev = unit.combatState;
    if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(unit);
    if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(unit);
    return (prev !== unit.combatState) ? unit.combatState : null;
  }
  // === Legacy fallback (medical 없는 유닛 — 예: 사격장 패시브) ===
  const prev = unit.combatState;
  let newState = prev;
  if (!unit.bodyHp) return null;
  if (unit.bodyHp.head <= 25 || unit.bodyHp.chest <= 25 || unit.hp <= 0) {
    newState = 'dead';
  } else if (unit.bodyHp.abdomen <= 25 || unit.hp <= 25) {
    newState = 'downed';
  } else if (unit.bodyHp.arms <= 30 || unit.bodyHp.legs <= 30 ||
             unit.bodyHp.chest <= 60 || unit.bodyHp.abdomen <= 60 ||
             unit.hp <= 60) {
    newState = 'wounded';
  }
  unit.combatState = newState;
  if (newState === 'dead') {
    unit.isDead = true; unit.isDowned = false; unit.conscious = false;
    unit.alive = false; unit.hp = 0; unit.canBeDragged = false;
    unit.shotQueue = null; unit.movePath = []; unit.aiIntent = 'none';
  } else if (newState === 'downed' && !unit.isDowned) {
    unit.isDowned = true; unit.canBeDragged = true; unit.downedTime = 0;
    const head = unit.bodyHp.head, chest = unit.bodyHp.chest, abd = unit.bodyHp.abdomen;
    const pain = unit.pain || 0;
    let unconsciousProb = 0.20;
    if (head <= 50)  unconsciousProb += 0.30;
    if (chest <= 50) unconsciousProb += 0.20;
    if (abd <= 30)   unconsciousProb += 0.15;
    if (pain >= 80)  unconsciousProb += 0.25;
    else if (pain >= 60) unconsciousProb += 0.10;
    unit.conscious = (Math.random() >= Math.min(0.90, unconsciousProb));
    unit.shotQueue = null; unit.movePath = []; unit.aiIntent = 'none';
    unit.stance = 'prone'; unit.alive = true;
  }
  return (prev !== newState) ? newState : null;
}

// 유닛이 전투에 참가 가능한 상태인지 (active/wounded만)
function isCombatActive(u) {
  return u && !u.isDead && !u.isDowned;
}

// 부위 손상에 따른 사격/이동 페널티
//   arms 손상 → 명중률/조준속도 페널티
//   legs 손상 → 이동속도 페널티
//   좌우 팔 분리 — right_arm은 사격에 더 큰 영향 (오른손잡이 가정)
function _armImpairmentFromHp(hp) {
  if (hp >= 80) return 1.0;
  if (hp >= 50) return 0.92;
  if (hp >= 30) return 0.78;
  if (hp >= 10) return 0.60;
  return 0.45;
}
function getArmsImpairment(unit) {
  // medical 있으면 weaponHandlingMul 또는 직접 계산 (중복 방지 — calculateHitChance에서 medical.aimMul 적용)
  if (unit && unit.medical) return 1.0;
  if (!unit.bodyHp) return 1.0;
  const leftHp  = unit.bodyHp.left_arm;
  const rightHp = unit.bodyHp.right_arm;
  if (leftHp != null && rightHp != null) {
    const leftMul  = _armImpairmentFromHp(leftHp);
    const rightMul = _armImpairmentFromHp(rightHp);
    return rightMul * 0.65 + leftMul * 0.35;
  }
  return _armImpairmentFromHp(unit.bodyHp.arms);
}

// SIDE-WEAPON-INJURY-HANDLING-1A: 팔 기능이 치명적으로 낮은지만 판단 (medical.canShoot 비참조).
//   무기 사용 가능 여부의 최종 판단은 isWeaponSlotUsable(unit, slot)이 담당.
function areArmsFunctionallyCritical(unit) {
  if (!unit) return false;
  if (unit.medical || (typeof getArmFunction === 'function' && unit.bodyHp)) {
    const r = (typeof getArmFunction === 'function') ? getArmFunction(unit, 'right') : 1.0;
    const l = (typeof getArmFunction === 'function') ? getArmFunction(unit, 'left') : 1.0;
    if (r <= 0.20 && l <= 0.55) return true;   // 주손 치명 + 보조손 저하
    if (r <= 0.12 && l <= 0.12) return true;   // 양손 기능상실
    return false;
  }
  if (!unit.bodyHp) return false;
  const left = unit.bodyHp.left_arm, right = unit.bodyHp.right_arm;
  if (left != null && right != null) {
    if (right <= 30 && left <= 55) return true;
    if (left <= 30 && right <= 30) return true;
    return false;
  }
  return (unit.bodyHp.arms != null && unit.bodyHp.arms <= 30);
}
function getLegsImpairment(unit) {
  // medical 있으면 medical.moveMul이 종합 처리 (중복 방지)
  if (unit && unit.medical) return 1.0;
  if (!unit.bodyHp) return 1.0;
  const hp = unit.bodyHp.legs;
  if (hp >= 80) return 1.0;
  if (hp >= 50) return 0.85;
  if (hp >= 30) return 0.65;
  if (hp >= 10) return 0.40;
  return 0.20;
}

// 부위 상태 라벨 — UI용
function getBodyPartStatus(hp) {
  if (hp >= 90) return { label:'정상', cls:'bp-ok' };
  if (hp >= 70) return { label:'경상', cls:'bp-light' };
  if (hp >= 40) return { label:'중상', cls:'bp-serious' };
  if (hp >= 10) return { label:'치명', cls:'bp-critical' };
  return { label:'기능상실', cls:'bp-dead' };
}


// ============================================================
// SIDE-WEAPON-INJURY-HANDLING-1: 팔 부상/의식/쓰러짐 → 주무기·보조무기 운용 차등
//   의료 수치는 읽기만 함 (변경 금지). 건강한 유닛은 모든 배율 1.0 (회귀 없음).
// ============================================================
// 팔 기능 0..1 (side: 'right'=주 사용 팔 / 'left'=보조 팔)
function getArmFunction(unit, side) {
  if (!unit) return 1.0;
  const medKey = side === 'left' ? 'leftArm' : 'rightArm';
  const hpKey = side === 'left' ? 'left_arm' : 'right_arm';
  if (unit.medical && unit.medical.bodyParts && unit.medical.bodyParts[medKey]) {
    const p = unit.medical.bodyParts[medKey];
    let f = (p.functionRatio != null) ? p.functionRatio : (p.maxHp ? p.hp / p.maxHp : 1);
    if (p.disabled) f = Math.min(f, 0.05);
    if (p.fracture && !p.splinted) f *= 0.6;
    if ((p.externalBleedRate || 0) > 2) f *= 0.85;
    const lp = p.pain || 0; if (lp > 0) f *= 1 - Math.min(0.30, lp / 100 * 0.30);
    return Math.max(0, Math.min(1, f));
  }
  if (unit.bodyHp) {
    const hp = unit.bodyHp[hpKey] != null ? unit.bodyHp[hpKey] : unit.bodyHp.arms;
    if (hp == null) return 1.0;
    let f = Math.max(0, Math.min(1, hp / 100));
    if ((unit.fracture === 'arm' || unit.fracture === 'multiple') && !unit.splintApplied) f *= 0.6;
    return f;
  }
  return 1.0;
}
// 의식 수준 'alert'|'dazed'|'shock'|'semi'|'unconscious'
function getConsciousnessLevel(unit) {
  if (!unit) return 'alert';
  if (unit.medical) {
    const m = unit.medical;
    if (m.isDead) return 'unconscious';
    const c = m.consciousness != null ? m.consciousness : 100;
    if (m.isUnconscious || c < 20) return 'unconscious';
    if (c < 45) return 'semi';
    const shock = m.shock || 0;
    const pain = (m.stressResponse && m.stressResponse.perceivedPain != null) ? m.stressResponse.perceivedPain : (m.pain || 0);
    if (shock >= 60 || pain >= 70 || c < 70) return 'shock';
    if (shock >= 30 || pain >= 45 || c < 90) return 'dazed';
    return 'alert';
  }
  if (unit.isDead) return 'unconscious';
  if (unit.isDowned && !unit.conscious) return 'unconscious';
  const pain = unit.pain || 0;
  if (pain >= 70) return 'shock';
  if (pain >= 45) return 'dazed';
  return 'alert';
}
// 의식 수준별 사격 보정 (주무기가 더 민감)
const CONSCIOUSNESS_FIRE_MODIFIER = {
  alert:       { primaryMul:1.00, secondaryMul:1.00, reactionMul:1.00 },
  dazed:       { primaryMul:0.90, secondaryMul:0.94, reactionMul:0.88 },
  shock:       { primaryMul:0.74, secondaryMul:0.83, reactionMul:0.72 },
  semi:        { primaryMul:0.45, secondaryMul:0.63, reactionMul:0.55 },
  unconscious: { primaryMul:0.00, secondaryMul:0.00, reactionMul:0.00 },
};
// 무기 분류별 양손 의존 (rifle/carbine/dmr/shotgun 큼, smg/pdw 중간, pistol 낮음)
function getWeaponClassHandling(weaponClass) {
  const T = {
    rifle:   { twoHand:1.00, supportImportance:1.00, dominantReq:1.00 },
    carbine: { twoHand:1.00, supportImportance:1.00, dominantReq:1.00 },
    dmr:     { twoHand:1.00, supportImportance:1.00, dominantReq:1.00 },
    shotgun: { twoHand:1.00, supportImportance:1.00, dominantReq:1.00 },
    lmg:     { twoHand:1.10, supportImportance:1.10, dominantReq:1.00 },
    smg:     { twoHand:0.80, supportImportance:0.72, dominantReq:0.95 },
    pdw:     { twoHand:0.80, supportImportance:0.72, dominantReq:0.95 },
    pistol:  { twoHand:0.30, supportImportance:0.22, dominantReq:0.90 },
  };
  return T[weaponClass] || T.rifle;
}
function getWeaponClassForSlot(unit, slot) {
  const ws = unit.weaponState;
  let wId = ws ? ((slot === 'secondary') ? ws.secondaryWeaponId : ws.primaryWeaponId) : unit.weaponId;
  const reg = (typeof WEAPON_REGISTRY !== 'undefined') ? WEAPON_REGISTRY[wId] : null;
  if (reg && reg.physical && reg.physical.weaponClass) return reg.physical.weaponClass;
  const w = (typeof WEAPONS !== 'undefined') ? WEAPONS[wId] : null;
  if (w && w.weaponClass) return w.weaponClass;
  if (w && w.type === 'pistol') return 'pistol';
  return (slot === 'secondary') ? 'pistol' : 'rifle';
}
function getWeaponLimbState(unit) {
  const rightFn = getArmFunction(unit, 'right');
  const leftFn = getArmFunction(unit, 'left');
  const level = getConsciousnessLevel(unit);
  return { rightFn, leftFn, dominantFn: rightFn, supportFn: leftFn,
    consciousnessLevel: level, conscious: level !== 'unconscious', downed: !!unit.isDowned };
}
// 슬롯 운용 가능 여부 — 최종 판정 (medical.canShoot에 의존하지 않음)
function isWeaponSlotUsable(unit, slot) {
  if (!unit || unit.isDead) return false;
  const st = getWeaponLimbState(unit);
  if (st.consciousnessLevel === 'unconscious') return false;
  // 양팔 모두 기능상실 → 모든 무기 불가
  if (st.dominantFn <= 0.12 && st.supportFn <= 0.12) return false;
  const wc = getWeaponClassHandling(getWeaponClassForSlot(unit, slot));
  if (wc.twoHand >= 0.8) {   // 주무기(양손) — 엄격
    if (st.dominantFn <= 0.20) return false;
    if (st.supportFn <= 0.12 && st.dominantFn <= 0.55) return false;
    if ((st.dominantFn + st.supportFn) / 2 <= 0.22) return false;
  } else {                   // 보조무기(한 손) — 관대 (오른팔 상실 시 왼손 비주손 사격 허용)
    if (st.dominantFn <= 0.05 && st.supportFn <= 0.20) return false;
  }
  return true;
}
function isPrimaryWeaponUsable(unit) { return isWeaponSlotUsable(unit, 'primary'); }
// 슬롯별 부상 운용 보정 (건강하면 모두 1.0)
function getWeaponHandlingInjuryModifier(unit, slot) {
  const out = { usable:true, accuracyMul:1.0, aimTimeMul:1.0, recoilMul:1.0, burstMul:1.0, reactionMul:1.0, reloadMul:1.0, switchMul:1.0, reason:null, recommendSecondary:false };
  if (!unit) return out;
  const st = getWeaponLimbState(unit);
  const wc = getWeaponClassHandling(getWeaponClassForSlot(unit, slot));
  const isPrimary = (slot === 'primary');
  const cm = CONSCIOUSNESS_FIRE_MODIFIER[st.consciousnessLevel] || CONSCIOUSNESS_FIRE_MODIFIER.alert;
  let acc = isPrimary ? cm.primaryMul : cm.secondaryMul;
  let react = cm.reactionMul;
  const supportLack = (1 - st.supportFn) * wc.supportImportance;
  const dominantLack = (1 - st.dominantFn) * wc.dominantReq;
  let armPenalty, offHand = false;
  if (isPrimary) {
    armPenalty = (supportLack * 0.55 + dominantLack * 0.55) * wc.twoHand;   // 양손 민감
  } else {
    // 보조무기: dominant(주손) 위주. 주손 상실 시 비주손 사격 = 큰 패널티 (twoHand로 축소하지 않음)
    armPenalty = dominantLack * 0.65 + supportLack * 0.10;
    if (st.dominantFn <= 0.20 && st.supportFn > 0.40) offHand = true;   // 비주손 사격
  }
  acc *= Math.max(0.12, 1 - armPenalty);
  let recoil = 1 + armPenalty * (isPrimary ? 1.1 : 0.7);
  let burst = 1 + armPenalty * (isPrimary ? 0.9 : 0.5);
  let aimT = 1 + armPenalty * (isPrimary ? 0.8 : 0.7) + (1 - react) * 0.6;
  react = react * Math.max(0.4, 1 - armPenalty * (isPrimary ? 0.5 : 0.3));
  let reload = Math.max(0.35, 1 - (dominantLack * (isPrimary ? 0.4 : 0.5) + supportLack * 0.3));
  if (offHand) { aimT *= 1.5; reload = Math.min(reload, 0.45); }   // 비주손: 조준/재장전/전환 매우 느림
  if (st.downed) {   // 쓰러짐 — 주무기 크게, 보조무기 작게
    acc *= isPrimary ? 0.70 : 0.85;
    recoil *= isPrimary ? 1.30 : 1.12;
    aimT *= isPrimary ? 1.40 : 1.15;
    reload *= isPrimary ? 0.75 : 0.88;
  }
  out.accuracyMul = Math.max(0.05, Math.min(1.0, acc));
  out.recoilMul = Math.max(1.0, recoil);
  out.burstMul = Math.max(1.0, burst);
  out.aimTimeMul = Math.max(1.0, aimT);
  out.reactionMul = Math.max(0.30, Math.min(1.20, react));
  out.reloadMul = Math.max(0.35, Math.min(1.0, reload));
  out.switchMul = offHand ? 1.6 : 1.0;   // 비주손은 무기 전환도 느림
  out.offHand = offHand;
  out.usable = isWeaponSlotUsable(unit, slot);
  if (isPrimary && !out.usable) { out.reason = (st.dominantFn <= 0.20) ? '오른팔 부상으로 주무기 운용 불가' : '팔 부상으로 주무기 운용 불가'; out.recommendSecondary = true; }
  else if (isPrimary && out.accuracyMul < 0.6) { out.reason = '팔 부상으로 주무기 불안정'; out.recommendSecondary = true; }
  else if (!isPrimary && offHand) { out.reason = '비주손 사격 — 명중·조준 저하'; }
  return out;
}
// 강제 보조무기 전환 / 무장 운용 불가 플래그 (tick에서 호출)
function updateInjuryWeaponHandling(unit, dt) {
  const ws = unit.weaponState;
  if (!ws || unit.isDead) return;
  const level = getConsciousnessLevel(unit);
  if (level === 'unconscious') {   // 의식불명/사망만 절대 중단 (예약탄도 중단)
    unit._injuryWeaponDisabled = false; unit._injuryForcedSwitch = false;
    if (unit.shotQueue) unit.shotQueue = null;
    return;
  }
  if (ws.switching) return;   // 이미 전환 중이면 타이머 유지 (재시작 금지)
  if (ws.activeSlot === 'primary' && !isWeaponSlotUsable(unit, 'primary')) {
    const hasSecondary = ws.secondaryWeaponId && (ws.primaryWeaponId !== ws.secondaryWeaponId);
    if (hasSecondary && isWeaponSlotUsable(unit, 'secondary')) {
      const mul = unit.isDowned ? 2.6 : 1.9;   // 부상 강제전환은 일반보다 느림 (downed면 더)
      if (typeof startWeaponSwitch === 'function' && startWeaponSwitch(unit, 'secondary', mul)) {
        unit._injuryForcedSwitch = true; unit._injuryWeaponDisabled = false;
        unit.shotQueue = null;   // 강제전환 시작 — 남은 예약탄 중단
        if (typeof log === 'function' && unit.team === 'friend') log(`[${unit.name}] 주무기 운용 불가 — 보조무기 강제 전환`, 'warn');
      }
    } else {
      unit._injuryWeaponDisabled = true;   // 보조무기 없음/불가 → 무장 운용 불가
      if (unit.shotQueue) unit.shotQueue = null;
    }
  } else {
    unit._injuryWeaponDisabled = false;
    if (ws.activeSlot === 'secondary') unit._injuryForcedSwitch = false;
  }
}
// 무기 부상 상태 라벨 (UI)
function getWeaponInjuryStatus(unit) {
  if (!unit || !unit.weaponState) return null;
  const level = getConsciousnessLevel(unit);
  if (level === 'unconscious') return { label:'의식 불명 — 사격 불가', color:'#ff6060', canFire:false };
  if (unit._injuryWeaponDisabled) return { label:'무장 운용 불가 (보조무기 없음)', color:'#ff6060', canFire:false };
  const ws = unit.weaponState;
  if (ws.switching && unit._injuryForcedSwitch) return { label:'팔 부상으로 보조무기 전환 중', color:'#ffb060', canFire:false };
  const slot = ws.activeSlot;
  const mod = getWeaponHandlingInjuryModifier(unit, slot);
  if (!mod.usable) {
    if (slot === 'primary') return { label:'주무기 사용 불가 — 보조무기 권장', color:'#ff6060', canFire:false, recommendSecondary:true };
    return { label:'무장 운용 불가', color:'#ff6060', canFire:false };
  }
  const parts = [];
  if (level === 'semi') parts.push('의식 저하로 반응 지연');
  else if (level === 'shock') parts.push('쇼크 · 조준 불안정');
  else if (level === 'dazed') parts.push('의식 혼미');
  if (unit.isDowned) parts.push('쓰러진 자세로 조준 불안정');
  if (mod.offHand) parts.push('비주손 사격');
  if (mod.accuracyMul < 0.55) parts.push(slot === 'primary' ? '팔 부상 · 주무기 불안정' : '팔 부상 · 명중 저하');
  else if (mod.accuracyMul < 0.80) parts.push('팔 부상으로 명중률 저하');
  if (mod.recommendSecondary && slot === 'primary') parts.push('보조무기 권장');
  if (!parts.length) return { label: slot === 'secondary' ? '보조무기 운용' : '주무기 운용 가능', color:'#80c080', canFire:true };
  return { label: parts.join(' · '), color: mod.accuracyMul < 0.55 ? '#ff9a3a' : '#ffd479', canFire:true, recommendSecondary: mod.recommendSecondary };
}

// =============================================================
// EQUIPMENT WEIGHT — 장비 무게 (kg) 시스템 1차
// =============================================================
//   현재 1차에서는 weapon + bodyArmor + helmet 무게 합산.
//   추후 plate 분리 시 frontPlateId / rearPlateId / sidePlateId가 추가되면
//   getEquipmentWeightKg가 자동으로 합산하도록 미리 처리.
function getEquipmentWeightKg(unit) {
  let kg = 0;
  if (unit.weaponId    && WEAPONS[unit.weaponId])             kg += WEAPONS[unit.weaponId].weightKg || 0;
  if (unit.bodyArmorId && BODY_ARMOR_PRESETS[unit.bodyArmorId]) kg += BODY_ARMOR_PRESETS[unit.bodyArmorId].weightKg || 0;
  if (unit.helmetId    && HELMET_PRESETS[unit.helmetId])      kg += HELMET_PRESETS[unit.helmetId].weightKg || 0;
  if (unit.frontPlateId && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[unit.frontPlateId])
    kg += PLATE_PRESETS[unit.frontPlateId].weightKg || 0;
  if (unit.backPlateId  && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[unit.backPlateId])
    kg += PLATE_PRESETS[unit.backPlateId].weightKg || 0;
  if (unit.sidePlateId  && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[unit.sidePlateId])
    kg += PLATE_PRESETS[unit.sidePlateId].weightKg || 0;
  // 추가 보호구 무게
  if (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') {
    for (const idKey of ['groinGuardId','shoulderGuardId','neckGuardId','visorId','slaapId']) {
      const id = unit[idKey];
      if (id && PROTECTION_ACCESSORY_PRESETS[id]) kg += PROTECTION_ACCESSORY_PRESETS[id].weightKg || 0;
    }
  }
  return kg;
}

// 무게 등급 — light / standard / heavy / overloaded
function getLoadClass(kg) {
  if (kg < 8)  return 'light';
  if (kg < 13) return 'standard';
  if (kg < 18) return 'heavy';
  return 'overloaded';
}
function getLoadClassKor(c) {
  return { light:'경량', standard:'표준', heavy:'중량', overloaded:'과적' }[c] || c;
}

// updateUnitWeight — 유닛에 loadWeightKg / loadClass 캐시
function updateUnitWeight(unit) {
  unit.loadWeightKg = getEquipmentWeightKg(unit);
  unit.loadClass = getLoadClass(unit.loadWeightKg);
}

// crawl 이동 속도 — downed + conscious 상태에서만 적용
//   일반 이동속도의 10~20% 수준. legs/pain 추가 감소.
function getCrawlSpeedMul(unit) {
  if (!unit.isDowned || !unit.conscious) return 0;
  let mul = 0.18;  // 기본 18%
  // legs 손상 추가 감소
  if (unit.bodyHp) {
    if (unit.bodyHp.legs <= 30) mul *= 0.4;
    else if (unit.bodyHp.legs <= 60) mul *= 0.7;
  }
  // pain 영향
  if (unit.pain >= 80) mul *= 0.5;
  else if (unit.pain >= 60) mul *= 0.75;
  return Math.max(0.04, mul);
}

// 페널티 계수 — light=1.0 기준, 등급별 곱연산
//   이동속도 / 조준속도 / 회전(handling) / 이동중 spread
function getLoadMoveMul(unit) {
  switch (unit.loadClass) {
    case 'light':      return 1.00;
    case 'standard':   return 0.95;
    case 'heavy':      return 0.88;
    case 'overloaded': return 0.80;
  }
  return 1.0;
}
function getLoadAimMul(unit) {
  switch (unit.loadClass) {
    case 'light':      return 1.00;
    case 'standard':   return 0.96;
    case 'heavy':      return 0.90;
    case 'overloaded': return 0.84;
  }
  return 1.0;
}
function getLoadHandlingMul(unit) {
  switch (unit.loadClass) {
    case 'light':      return 1.00;
    case 'standard':   return 0.96;
    case 'heavy':      return 0.92;
    case 'overloaded': return 0.85;
  }
  return 1.0;
}
function getLoadMovingSpreadMul(unit) {
  // 이동 중 사격 탄퍼짐 — overloaded일수록 큼 (1.0이 기본, 클수록 페널티)
  switch (unit.loadClass) {
    case 'light':      return 1.00;
    case 'standard':   return 1.05;
    case 'heavy':      return 1.15;
    case 'overloaded': return 1.30;
  }
  return 1.0;
}

// =============================================================
// PAIN / STOPPING POWER — 저지력/고통 헬퍼
// =============================================================
//   pain:          0~100 누적, 시간에 따라 감소
//   stoppingTimer: 피격 직후 짧게 동작 방해 (초)
//   pain 단계: 0~30 약, 30~60 중, 60~80 강, 80+ 거의 활동 불가
function getPainTier(p) {
  if (p < 30) return 0;
  if (p < 60) return 1;
  if (p < 80) return 2;
  return 3;
}
function getPainLabel(p) {
  const t = getPainTier(p);
  return ['낮음', '중간', '높음', '극심'][t];
}
// 페널티 계수 — medical 있으면 medical.aimMul 사용 (중복 적용 방지)
function getPainAimMul(unit) {
  if (unit && unit.medical) return 1.0;   // medical.aimMul이 종합 처리
  const p = (unit && unit.pain) || 0;
  return Math.max(0.50, 1.0 - p * 0.005);
}
function getPainMoveMul(unit) {
  if (unit && unit.medical) return 1.0;   // medical.moveMul이 종합 처리
  const p = (unit && unit.pain) || 0;
  return Math.max(0.55, 1.0 - p * 0.0045);
}
function getPainReactionMul(unit) {
  if (unit && unit.medical) return 1.0;   // medical.reactionMul이 종합 처리
  const p = (unit && unit.pain) || 0;
  return Math.max(0.55, 1.0 - p * 0.0045);
}
// stopping 적용 — 피격 시 호출
function applyStopping(target, stoppingPower, weapon, opts) {
  // [0.39.1 Fix1] medical 유닛은 acute response가 stopping/aim/shotQueue를 이미 적용 → 중복 방지 위해 skip.
  if (opts && opts.skipIfAcute) return { finalStop: 0, stoppedFire: !!target._lastStoppedFire, skipped: true };
  // stoppingPower의 의미: 1.0이 표준. 0.4~1.4 범위.
  // 적용량은 부위/관통/방호 결과에 따라 ctx에서 계수가 추가로 곱해진다.
  const sevMul = (opts && opts.severityMul) || 1.0;
  // 숙련도가 높으면 stopping에 덜 흔들림
  const reaction = (target.skill && target.skill.reaction) || 1.0;
  const stoppingResist = Math.max(0.6, reaction);
  const finalStop = stoppingPower * sevMul / stoppingResist;
  // stoppingTimer — 보통 0.15~0.6초
  const dur = Math.min(0.7, 0.15 + finalStop * 0.20);
  target.stoppingTimer = Math.max(target.stoppingTimer || 0, dur);
  // 진행 중인 사격 묶음 중단 — 강한 stopping이면 높은 확률로 끊음
  let stoppedFire = false;
  if (target.shotQueue) {
    const breakProb = Math.max(0, Math.min(0.95, finalStop * 0.7));
    if (Math.random() < breakProb) {
      target.shotQueue = null;
      stoppedFire = true;
    }
  }
  // aimTimer 감소 — 흔들림
  target.aimTimer = Math.max(0, (target.aimTimer || 0) - finalStop * 0.35);
  return { finalStop, stoppedFire };
}
// pain 누적
function addPain(target, amount) {
  if (amount <= 0) return;
  // 진통 효과 게이지에 따라 pain 증가율 감소 (analgesia 0~85 → mul 1.0~0.30)
  if (target.painkillerActive && target.analgesiaLevel > 0) {
    const gainMul = Math.max(0.30, 1.0 - target.analgesiaLevel / 120);
    amount *= gainMul;
  }
  // medical 있으면 medical.pain에 적용 (단일 출처) — syncLegacyCombatState가 unit.pain 갱신
  if (target.medical) {
    target.medical.pain = Math.min(100, target.medical.pain + amount);
    // 즉시 sync
    target.pain = target.medical.pain;
  } else {
    target.pain = Math.min(100, (target.pain || 0) + amount);
  }
}

// =============================================================
