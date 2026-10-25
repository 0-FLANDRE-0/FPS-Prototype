// PRECARDIAC-1 §3: 부목 상태 part-level 판정 — 전역 splintApplied 의존 축소.
//   medical 유닛: bodyParts[camel].splinted ∨ bodyPartTreatments[snake].splint.active 기준.
//   medical 없는 legacy 유닛만 전역 splintApplied fallback.
function isPartSplinted(target, part) {
  if (!target) return false;
  const med = target.medical;
  if (med) {
    const camel = ({ left_arm:'leftArm', right_arm:'rightArm', left_leg:'leftLeg', right_leg:'rightLeg' })[part] || part;
    if (med.bodyParts && med.bodyParts[camel] && med.bodyParts[camel].splinted) return true;
    const bpt = med.bodyPartTreatments && med.bodyPartTreatments[part];
    if (bpt && bpt.splint && bpt.splint.active) return true;
    return false;
  }
  return !!target.splintApplied;
}
function getAvailableTreatmentsForPart(target, part) {
  const out = [];
  // 붕대: 모든 부위
  out.push('bandage');
  // 지혈대: 사지만
  if (isLimbPart(part)) out.push('tourniquet');
  // 부목: 사지만
  if (isLimbPart(part)) out.push('splint');
  // 체스트 씰: 가슴
  if (part === 'chest') out.push('chestseal');
  // 쇼크 관리: 모든 부위 (보조 처치)
  out.push('shockcare');
  return out;
}

// 전신 처치 — 부위와 무관 (진통제, 지혈대 해제 등)
function getGlobalTreatments(target) {
  const out = ['painkiller'];
  if (target && target.tourniquetActive) out.push('remove_tourniquet');
  return out;
}

// part key 정규화 — legacy snake_case → medical camelCase
function _legacyPartToMedical(part) {
  // PART-KEY-CANONICAL-1: 변환 책임을 canonical 모듈로 위임. 좌우 미확정('arms'/'legs')과 unknown은 원본 유지(기존 동작).
  if (part === 'arms' || part === 'legs' || part === 'arm' || part === 'leg') return part;
  const c = normalizeAnatomicalPartKey(part, { ctx: '_legacyPartToMedical' });
  return (c && _CANON_TO_STORAGE[c]) || part;
}

// 부위별 출혈 여부 — medical 우선
function isPartBleeding(target, part) {
  if (!target) return false;
  // medical 우선
  if (target.medical) {
    const k = _legacyPartToMedical(part);
    if (target.medical.bodyParts[k]) {
      return target.medical.bodyParts[k].externalBleedRate > 0.5
          || target.medical.bodyParts[k].internalBleedRate > 0.5;
    }
    // legacy 통합 키
    if (part === 'arms') return target.medical.bodyParts.leftArm.externalBleedRate > 0.5
                              || target.medical.bodyParts.rightArm.externalBleedRate > 0.5;
    if (part === 'legs') return target.medical.bodyParts.leftLeg.externalBleedRate > 0.5
                              || target.medical.bodyParts.rightLeg.externalBleedRate > 0.5;
    return false;
  }
  // legacy fallback
  if (target.bleeding === 'none') return false;
  const loc = target.bleedingLoc;
  if (!loc) return false;
  if (loc === part) return true;
  if (loc === 'arms' && (part === 'left_arm' || part === 'right_arm')) return true;
  if (loc === 'legs' && (part === 'left_leg' || part === 'right_leg')) return true;
  return false;
}

// 부위별 골절 여부 — medical 우선
function isPartFractured(target, part) {
  if (!target) return false;
  if (target.medical) {
    const k = _legacyPartToMedical(part);
    if (target.medical.bodyParts[k]) {
      return !!target.medical.bodyParts[k].fracture;
    }
    if (part === 'arms') return target.medical.bodyParts.leftArm.fracture || target.medical.bodyParts.rightArm.fracture;
    if (part === 'legs') return target.medical.bodyParts.leftLeg.fracture || target.medical.bodyParts.rightLeg.fracture;
    return false;
  }
  // legacy
  if (target.fracture === 'none' || !target.fracture) return false;
  const f = target.fracture;
  if (f === part) return true;
  if (f === 'arm' && (part === 'left_arm' || part === 'right_arm' || part === 'arms')) return true;
  if (f === 'leg' && (part === 'left_leg' || part === 'right_leg' || part === 'legs')) return true;
  if (f === 'multiple') return isLimbPart(part);
  return false;
}

// 부위별 HP — medical 우선
function getPartHp(target, part) {
  if (!target) return 100;
  if (target.medical) {
    const k = _legacyPartToMedical(part);
    if (target.medical.bodyParts[k]) return target.medical.bodyParts[k].hp;
    if (part === 'arms') return Math.min(target.medical.bodyParts.leftArm.hp, target.medical.bodyParts.rightArm.hp);
    if (part === 'legs') return Math.min(target.medical.bodyParts.leftLeg.hp, target.medical.bodyParts.rightLeg.hp);
    return 100;
  }
  // legacy
  if (!target.bodyHp) return 100;
  const hp = target.bodyHp;
  if (hp[part] != null) return hp[part];
  if (part === 'arms') return Math.min(hp.left_arm != null ? hp.left_arm : 100, hp.right_arm != null ? hp.right_arm : 100);
  if (part === 'legs') return hp.legs != null ? hp.legs : 100;
  return 100;
}

// 부위별 추천 처치 — heavy bleeding > chest wound > fracture > shock > pain
function getRecommendedTreatment(target, part) {
  if (!target) return null;
  const bleeding = isPartBleeding(target, part) ? target.bleeding : 'none';
  const fractured = isPartFractured(target, part);
  const heavyOrCrit = (bleeding === 'heavy' || bleeding === 'critical');

  // 1) Heavy bleeding 우선
  if (heavyOrCrit) {
    // 사지면 지혈대 우선 (이미 적용된 경우 붕대)
    if (isLimbPart(part)) {
      if (!target.tourniquetActive) return 'tourniquet';
      return 'bandage';
    }
    // 몸통/머리/목: 붕대 또는 체스트 씰
    if (part === 'chest' && !target.chestSealApplied && target.chestPenetrating) return 'chestseal';
    return 'bandage';
  }

  // 2) Light bleeding
  if (bleeding === 'light') return 'bandage';

  // 3) 흉부 관통상 + 체스트 씰 미적용
  if (part === 'chest' && target.chestPenetrating && !target.chestSealApplied) return 'chestseal';

  // 4) 사지 골절 + 부목 미적용
  if (fractured && isLimbPart(part) && !isPartSplinted(target, part)) return 'splint';   // FIELD-STAB-1 Cleanup B: part-level

  // 5) unconscious / shock 높음 → 쇼크 관리
  if (target.isDowned && !target.conscious && !target.shockCareApplied) return 'shockcare';

  // 6) 비사지 골절 (흉부/복부) — 쇼크 관리 / 진통제
  if (fractured && !isLimbPart(part)) {
    if (!target.shockCareApplied) return 'shockcare';
  }

  return null;
}

// 전신 처치 추천 — 진통제 / 지혈대 해제
function getRecommendedGlobalTreatment(target) {
  if (!target) return null;
  // 출혈이 통제됐고 지혈대가 오래 적용됐으면 해제 추천
  if (target.tourniquetActive) {
    const heavyBleeding = (target.bleeding === 'heavy' || target.bleeding === 'critical');
    const tqApplied = target.tourniquetAppliedAt || 0;
    const tqDuration = (GAME.gameTime || 0) - tqApplied;
    // 출혈 통제됨 + 60초+ 경과 → 해제 추천
    if (!heavyBleeding && tqDuration > 60) return 'remove_tourniquet';
  }
  // high pain — heavy bleeding 없을 때만
  const heavyBleeding = (target.bleeding === 'heavy' || target.bleeding === 'critical');
  if (target.pain >= 60 && !heavyBleeding
      && (target.painkillerCooldown || 0) <= 0
      && (target.analgesiaLevel || 0) < 85) {
    return 'painkiller';
  }
  return null;
}

function startTreatment(treater, target, type, opts) {
  if (!treater || !target) return false;
  if (target.isDead) return false;
  if (target.beingTreatedBy != null) return false;
  if (treater.treatmentTimer > 0) return false;
  // SIDE-METRIC-SCALE-1: 처치 거리 2m (PX_PER_M 기준)
  const d = Math.hypot(treater.x - target.x, treater.y - target.y);
  const isSelf = (treater.id === target.id);
  const TREATMENT_RANGE_PX = mToPx(2.0);
  if (!isSelf && d > TREATMENT_RANGE_PX) return false;
  // SIDE-MED-2C §3: under_fire에서는 지혈대/즉각 지혈/해제만 허용 (긴 처치 제한)
  try {
    const phase = getTcccCarePhase(target, treater, null);
    if (phase === 'under_fire' && !isTreatmentAllowedInPhase(type, phase)) {
      if (typeof log === 'function') log(`[${target.name}] 전투 중 — ${type} 처치 제한 (엄폐/후송 우선)`, 'warn');
      return false;
    }
  } catch (e) {}
  // 자가 처치 제약
  if (isSelf) {
    if (type === 'shockcare') return false;
    if (type === 'splint')    return false;
    if (areArmsFunctionallyCritical(target) && type !== 'painkiller') return false;
  }
  // HOTFIX 1-2: 시작 시점 자원 게이트 — 버튼 disabled / 완료 소모와 동일 기준. 부상자 IFAK(target).
  try {
    const _w2 = (opts && (opts.woundId || opts.location || opts.groupId)) ? _selectTreatWound(target.medical, opts.location ? resolveBodyPartKey(opts.location, null) : null, opts.woundId) : null;
    if (type === 'circulation_support') { if (!resolveCirculationResource(target, _w2)) { if (typeof log === 'function') log(`[${target.name}] 순환보조 자원 없음 (혈액팩/수액)`, 'warn'); return false; } }
    else if (type === 'airway_support') { if (!resolveAirwayResource(target, _w2).length) { if (typeof log === 'function') log(`[${target.name}] 기도보조 자원 없음 (기도확보/산소)`, 'warn'); return false; } }
    else { const _rk2 = TREATMENT_RESOURCE_MAP[type]; if (_rk2 && getMedicalResourceCount(target, _rk2) <= 0) { if (typeof log === 'function') log(`[${target.name}] ${_rk2} 없음 — ${type} 불가`, 'warn'); return false; } }
  } catch (e) {}
  // 적용 가능성 — 부위 제한 (location 옵션 우선, 없으면 fallback)
  const loc = (opts && opts.location) || null;
  if (type === 'tourniquet') {
    // 사지 전용
    if (loc) {
      if (loc !== 'left_arm' && loc !== 'right_arm' && loc !== 'left_leg' && loc !== 'right_leg') return false;
    } else {
      if (target.bleedingLoc !== 'arms' && target.bleedingLoc !== 'legs') return false;
    }
  }
  if (type === 'splint') {
    // 사지 골절 전용 — 흉부/머리/복부/목 골절에는 부목 불가
    // TRAUMA-REFINE-1 §6: medical bodyParts fracture도 인정 (legacy unit.fracture 미동기 갭 보완)
    const _locFx = !!(loc && typeof isPartFractured === 'function' && isPartFractured(target, loc));
    const _anyMedFx = !!(target.medical && target.medical.bodyParts &&
      ['leftArm','rightArm','leftLeg','rightLeg'].some(k => target.medical.bodyParts[k] && target.medical.bodyParts[k].fracture));
    if (target.fracture === 'none' && !_locFx && !_anyMedFx) return false;
    if (loc) {
      if (loc !== 'left_arm' && loc !== 'right_arm' && loc !== 'left_leg' && loc !== 'right_leg') return false;
      if (!_locFx && target.fracture === 'none') return false;   // 선택 부위에 골절 없음
      if (typeof isPartSplinted === 'function' && isPartSplinted(target, loc)) return false;   // 이 부위 이미 고정
    } else {
      if (target.fracture === 'chest' || target.fracture === 'head' || target.fracture === 'abdomen' || target.fracture === 'neck') return false;
    }
  }
  if (type === 'chestseal') {
    if (loc && loc !== 'chest') return false;
  }
  if (type === 'painkiller') {
    // cooldown 체크 — 너무 잦은 재투여 차단
    if (target.painkillerCooldown && target.painkillerCooldown > 0) return false;
    // 최대 게이지 이상이면 차단
    if ((target.analgesiaLevel || 0) >= 85) return false;
  }
  if (type === 'remove_tourniquet') {
    if (!target.tourniquetActive) return false;
  }
  // === FIELD-STAB-1 §7: field stabilization action 검증 — phase 게이트 + candidate 조건 ===
  if (FIELD_STAB_ACTIONS && FIELD_STAB_ACTIONS.indexOf(type) >= 0) {
    let phase2 = 'tactical_field_care';
    try { phase2 = getTcccCarePhase(target, treater, null); } catch (e) {}
    if (!isFieldStabAllowedInPhase(type, phase2)) {
      if (typeof log === 'function') log(`[${target.name}] ${type} — 현재 단계(${phase2})에서 제한`, 'warn');
      return false;
    }
    const fs = ensureFieldStabilizationModel(target);
    if (type === 'airway_support' && !(fs.airwaySupport.candidate)) return false;
    if (type === 'chest_relief' && !(fs.chestRelief.candidate)) return false;
    if (type === 'pelvic_binder' && !(fs.pelvicControl.candidate)) return false;
    if (type === 'junctional_control' && !(fs.junctionalControl.candidate)) return false;
    if (type === 'circulation_support' && !(fs.circulationSupport.candidate)) return false;
    // mark_evac은 항상 허용
    if (isSelf && (type === 'circulation_support' || type === 'chest_relief')) return false;   // 자가 제한
  }
  const dur = getTreatmentDuration(type, isSelf, target, treater);
  if (dur <= 0) return false;
  // 2B-0-FINAL §16: 클러스터 일괄 처치 — 개수에 따라 완만히 증가 (21배가 아니라 넓은 표면 드레싱)
  let finalDur = dur;
  if (opts && opts.groupId && opts.clusterCount) finalDur = dur * (1 + Math.min(20, opts.clusterCount) * 0.045);
  // HOTFIX §5: 처치 품질의 timeMultiplier 반영 (숙련/스트레스/이동/거리) — 0.6~2.0 범위
  try {
    if (typeof getTreatmentQuality === 'function') {
      const _pk = (opts && opts.location) ? resolveBodyPartKey(opts.location, null) : null;
      let _w = (opts && (opts.woundId || _pk || opts.groupId)) ? _selectTreatWound(target.medical, _pk, opts && opts.woundId) : null;
      if (!_w && target.medical && target.medical._currentEventWound) _w = target.medical._currentEventWound;
      const _tq = getTreatmentQuality(treater, target, _w, type);
      finalDur = finalDur * Math.max(0.6, Math.min(2.0, _tq.timeMultiplier || 1));
    }
  } catch (e) {}
  treater.treatmentTimer = finalDur;
  treater.treatmentTotal = finalDur;
  treater.treatmentType  = type;
  treater.treatmentLocation = loc;
  treater.treatmentWoundId = (opts && opts.woundId) || null;   // 2B-0: 선택 wound 처치
  treater.treatmentGroupId = (opts && opts.groupId) || null;    // 2B-0-FINAL: 클러스터 일괄 처치
  treater.treatingTarget = target.id;
  target.beingTreatedBy  = treater.id;
  // 처치 중 이동/사격 중단
  treater.movePath = [];
  treater.shotQueue = null;
  const typeKor = { painkiller:'진통제', tourniquet:'지혈대', remove_tourniquet:'지혈대 해제',
                    bandage:'붕대', splint:'부목',
                    shockcare:'쇼크 관리', chestseal:'체스트 씰',
                    airway_support:'기도 보조', chest_relief:'흉부 압력 완화', pelvic_binder:'골반 고정',
                    junctional_control:'junctional 출혈 제어', circulation_support:'순환 보조', mark_evac:'후송 표시' }[type] || type;
  log(`[${treater.name}] ${target.name === treater.name ? '자가' : `→ ${target.name}`} ${typeKor} 처치 시작`, 'info');
  return true;
}

function cancelTreatment(treater, reason) {
  if (treater.treatmentTimer <= 0) return;
  const tgtId = treater.treatingTarget;
  if (tgtId != null) {
    const tgt = unitById(tgtId);
    if (tgt && tgt.beingTreatedBy === treater.id) tgt.beingTreatedBy = null;
  }
  log(`[${treater.name}] 처치 ${reason || '중단'}`, 'warn');
  treater.treatmentTimer = 0;
  treater.treatmentTotal = 0;
  treater.treatmentType = null;
  treater.treatingTarget = null;
}

// 2B-0: wound/부위 처치 적용 — completeTreatment에서 라우팅
function _selectTreatWound(med, partKey, woundId) {
  if (woundId) { const w = med.wounds.find(x => x.id === woundId); if (w) return w; }
  if (partKey) {
    const bleeding = med.wounds.filter(w => w.partKey === partKey && w.bleedingProfile && w.bleedingProfile.bleedingType !== 'none');
    if (bleeding.length) return sortWoundsByUrgency(bleeding)[0];
    const any = med.wounds.filter(w => w.partKey === partKey);
    if (any.length) return sortWoundsByUrgency(any)[0];
  }
  const bleed = med.wounds.filter(w => w.bleedingProfile && w.bleedingProfile.bleedingType !== 'none');
  if (bleed.length) return sortWoundsByUrgency(bleed)[0];
  return med.wounds.length ? sortWoundsByUrgency(med.wounds)[0] : null;
}
// 2B-0-FINAL §8~10: 압박붕대 즉시/목표 multiplier 결정
function _pressureInitialMul(w) {
  const bt = w.bleedingProfile.bleedingType, sz = w.woundSize.sizeClass;
  if (bt === 'junctional') return 0.45;                       // 접합부 — 즉시 감소 제한적
  if (sz === 'massive' || sz === 'large') return 0.18;        // 80% 수준
  return 0.12;                                                 // 88% 수준
}
function _pressureTargetMul(w) {
  const bt = w.bleedingProfile.bleedingType, sz = w.woundSize.sizeClass, fc = w.fieldCare.fieldCareClass;
  if (bt === 'junctional') return 0.35;                        // 20~50% 잔여
  if (fc === 'field_unmanageable' || fc === 'limited') return 0.18;
  if (sz === 'massive') return 0.18;                           // 10~25%
  if (sz === 'large') return 0.10;                             // 5~15%
  if (sz === 'medium') return 0.03;                            // 0~5%
  return 0.0;                                                   // micro/small → 0 근접
}
function _applyPressureBandageToWound(w, now, treater) {
  const ts = w.treatmentState;
  // [HOTFIX 마감] 압박붕대 = 외부출혈 압박. bandaged는 출혈 엔진(extMul 0.30 경로) 호환용으로만 유지하고
  //   bandageApplied(일반 붕대 "마감/고정 완료" 마커)는 세팅하지 않는다 → 압박 후에도 일반 붕대 마감이 가능.
  ts.pressureBandaged = true; ts.bandaged = true;
  ts.pressureBandageAppliedAt = now;
  ts.pressureBandageInitialMul = _pressureInitialMul(w);
  ts.pressureBandageTargetMul = _pressureTargetMul(w);
  ts.pressureBandageStabilization = 0;
  ts.treatmentQuality = Math.max(ts.treatmentQuality || 0, 0.7);
  ts.lastTreatedAt = now; ts.treatedBy = treater ? treater.id : null;
}
// ===================== SIDE-MEDICAL-FIELDCARE-RESOURCE-1 =====================
// 현장 처치 자원 계층 + 처치 추천 + 콤보 효과 + 처치 품질. (수술/완전지혈/AED/CPR 없음 — 표식/시간벌기/안정화만)
let _lastTreatmentBlock = null;   // HOTFIX: core가 차단한 처치 정보 (wrapper가 legacy fallback 차단 + AAR 기록)
const MEDICAL_RESOURCE_DEFAULTS = {
  bandage:4, pressure_bandage:2, hemostatic_gauze:2, wound_packing:1, tourniquet:2, chest_seal:2,
  decompression_needle:1, airway_basic:1, oxygen:1, pelvic_binder:1, iv_fluid:1, blood_pack:0, analgesic:2, splint:1
};
// 처치 type(내부) → 자원 key 매핑
const TREATMENT_RESOURCE_MAP = {
  bandage:'bandage', pressure_bandage:'pressure_bandage', hemostatic:'hemostatic_gauze', packing:'wound_packing',
  tourniquet:'tourniquet', chestseal:'chest_seal', needle_decompression:'decompression_needle', decompression:'decompression_needle',
  airway:'airway_basic', airway_basic:'airway_basic', oxygen:'oxygen', pelvic_binder:'pelvic_binder',
  iv_fluid:'iv_fluid', blood_pack:'blood_pack', painkiller:'analgesic', analgesic:'analgesic', splint:'splint',
  junctional_pressure:'pressure_bandage', abdominal_dressing:'bandage',
  // FIELD_STAB_ACTIONS 이름 매핑
  airway_support:'airway_basic', chest_relief:'decompression_needle', circulation_support:'iv_fluid'
};
function initMedicalResources(unit) {
  if (!unit) return;
  if (!unit.medicalResources) unit.medicalResources = Object.assign({}, MEDICAL_RESOURCE_DEFAULTS);
}
function getMedicalResourceCount(unit, key) {
  if (!unit || !unit.medicalResources || !key) return 0;
  return unit.medicalResources[key] || 0;
}
function hasMedicalResourceForTreatment(unit, type) {
  const key = TREATMENT_RESOURCE_MAP[type];
  if (!key) return true;                          // 자원 매핑 없는 처치(제거 등)는 항상 허용
  return getMedicalResourceCount(unit, key) > 0;
}
// 대형 PHASE 5: 자원 N개 원자 소모 — 부족하면 아무것도 소모하지 않는다 (부분 적용 금지).
function consumeMedicalResourceUnits(unit, key, n) {
  if (!key || !unit || !unit.medicalResources) return { consumed:false, key, remaining:0 };
  const have = unit.medicalResources[key] || 0;
  if (have < n) return { consumed:false, key, remaining:have, required:n, insufficient:true };
  unit.medicalResources[key] = have - n;
  return { consumed:true, key, remaining:unit.medicalResources[key], used:n };
}
// 대형 PHASE 5: cluster 처치 자원 필요량 — "아직 처치 안 된 eligible 상처"만으로 산정 (이중 지출 금지, 수치식은 기존 표면적 비용 그대로).
function computeClusterTreatmentResourceCost(cl, actionType, eligibleWounds) {
  if (!cl || !eligibleWounds || !eligibleWounds.length) return 0;
  const base = computeWoundClusterTreatmentCost(cl, eligibleWounds);
  const act = (typeof _TREATMENT_ACTION_ALIAS !== 'undefined' && _TREATMENT_ACTION_ALIAS[actionType]) || actionType;
  if (act === 'hemostatic') return Math.max(1, Math.ceil(base * 0.5));
  return Math.max(1, base);
}
// ════════════════════════════════════════════════════════════════════════════
// 대형 PHASE 5 — cluster 일괄 처치 단일 경로.
//   ① 대상: cluster의 "미처치 + 표면 접근 가능(external) + 적응증 있는" 상처만.
//   ② 자원: 필요 유닛(잔여 기준) 게이트 → 부족 시 시작 불가 (반쯤 처치 상태 금지) → 성공 시 원자 소모.
//   ③ cavity/내부출혈 상처는 절대 대상 아님. chest_seal/needle/splint 등 특수 처치는 cluster 적용 금지(개별만).
// ════════════════════════════════════════════════════════════════════════════
// [대형 HOTFIX] 일반 붕대 = 마감/고정 전용 applicator. 압박붕대 전용 상태(pressureBandaged / 압박 배율 / 압박 안정화)를
//   생성하지 않는다. 출혈 엔진은 (bandaged && !packEff && !hemoEff)만 완만한 마감 감소(0.30)를 적용한다.
function _applyPlainBandageToWound(w, now, treater) {
  const ts = w.treatmentState || (w.treatmentState = {});
  ts.bandaged = true; ts.bandageApplied = true;
  ts.lastTreatedAt = now; ts.treatedBy = treater ? treater.id : null;
  ts.treatmentQuality = Math.max(ts.treatmentQuality || 0, 0.6);
}
// 클러스터 처치 구조화 오류 로깅 (조용히 삼키지 않음). strict에서 실패로 드러남.
function _clusterTreatmentError(stage, info, err) {
  const rec = Object.assign({ pipeline:'clusterTreatment', stage, error: err && (err.message || String(err)), t: (typeof GAME !== 'undefined' && GAME.gameTime) || 0 }, info || {});
  if (typeof GAME !== 'undefined') {
    GAME._clusterTreatmentErrors = GAME._clusterTreatmentErrors || [];
    if (GAME._clusterTreatmentErrors.length < 200) GAME._clusterTreatmentErrors.push(rec);
    if (GAME.debugStrictPipeline) { const e2 = new Error('CLUSTER_TREATMENT_ERROR [' + stage + '] ' + rec.error); e2._clusterTreatment = rec; throw e2; }
  }
  return rec;
}
// ════════════════════════════════════════════════════════════════════════════
// [대형 HOTFIX] cluster 일괄 처치 — 원자적. cluster-capable action은 pressure_bandage / bandage 뿐.
//   ① eligible = 미처치 + 표면(비 cavity/internal) + 적응증. action별 applicator 분리(압박 vs 마감).
//   ② 비용/자원은 실제 eligible만 기준. 부족하면 시작 자체 불가 (child/자원 무변화).
//   ③ 전부-성공 또는 전부-무효: 각 child wound.treatmentState 스냅샷 → 적용 → (오류 시 스냅샷 복원 + 무소모).
//   ④ 의료효과 SoT는 child wound. cluster.treatmentClusterState는 물리적 드레싱 이력(요약)이며 refresh가 파생 재계산.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// [HOTFIX 마감] action별 cluster treatment plan — UI와 실행이 동일 계획을 공유하는 단일 source.
//   같은 함수가 "표시용 계획"과 "실행용 대상"을 모두 만든다 → UI 대상/자원/시간 = 실제 실행 결과.
//   pressure_bandage 와 bandage 는 eligibility·자원이 다르므로 반드시 action을 받아 분기한다.
// ════════════════════════════════════════════════════════════════════════════
function buildClusterTreatmentPlan(med, clusterId, actionType) {
  const cl = med && med.woundClusters && med.woundClusters[clusterId];
  if (!cl) return { ok:false, reason:'no_cluster', eligible:[], eligibleCount:0, alreadyCount:0, excludedCount:0, required:0 };
  const act = (typeof _TREATMENT_ACTION_ALIAS !== 'undefined' && _TREATMENT_ACTION_ALIAS[actionType]) || actionType;
  if (act !== 'pressure_bandage' && act !== 'bandage') return { ok:false, reason:'action_not_cluster_capable', action:act, eligible:[], eligibleCount:0, alreadyCount:0, excludedCount:0, required:0 };
  const isPressure = (act === 'pressure_bandage');
  const ws = getClusterWounds(med, cl.partKey, clusterId);
  const eligible = [], excluded = [];
  let already = 0;
  for (const w of ws) {
    const ts = w.treatmentState || {}, tp = w.treatmentProfile || {}, bp = w.bleedingProfile || {};
    if (bp.bleedingType === 'cavity' || bp.bleedingType === 'internal') { excluded.push({ w, why:'internal' }); continue; }
    if (isPressure) {
      if (ts.pressureBandaged) { already++; continue; }
      if (!tp.pressureBandageEligible) { excluded.push({ w, why:'not_pressure_eligible' }); continue; }
      eligible.push(w);
    } else {
      if (ts.bandageApplied) { already++; continue; }                              // 일반 붕대 완료마커 기준(압박의 bandaged와 분리)
      const controlled = !!(ts.pressureBandaged || ts.hemostaticApplied || ts.packed || ts.tourniquetApplied);
      const eff = (w._effExternal != null) ? w._effExternal : (bp.currentExternal || 0);
      const minor = (bp.bleedingType === 'none' || bp.bleedingType === 'oozing' || eff <= 8);
      if (!controlled && !minor) { excluded.push({ w, why:'uncontrolled_severe' }); continue; }   // 선행 지혈 필요
      if (!(tp.bandageEligible || minor)) { excluded.push({ w, why:'not_bandage_eligible' }); continue; }
      eligible.push(w);
    }
  }
  const resKey = TREATMENT_RESOURCE_MAP[actionType] || TREATMENT_RESOURCE_MAP[act] || (isPressure ? 'pressure_bandage' : 'bandage');
  const required = eligible.length ? computeClusterTreatmentResourceCost(cl, act, eligible) : 0;
  return { ok:true, action:act, isPressure, cl, wounds:ws, eligible, eligibleCount:eligible.length,
    alreadyCount:already, excluded, excludedCount:excluded.length, resKey, required };
}
// ════════════════════════════════════════════════════════════════════════════
// [HOTFIX 마감] cluster 일괄 처치 — 완전 원자성(자원 포함 rollback) + 개별 처치와 동일한 공통 후처리.
//   ① plan(action별) → eligible/자원/필요량 (UI와 동일 함수).
//   ② 스냅샷: child treatmentState + bodyPart.bandageApplied + cluster state + 자원 수량.
//   ③ 각 child에 applicator + _postWoundTreatmentSync(sequence/combo) — 개별 처치와 동일 의미.
//   ④ 자원은 최종 commit 시점에 1회 차감. 어느 단계든 오류 → 스냅샷 전량 복원(자원 포함) + structured 기록 + 성공 로그 금지.
//   ⑤ 반환에 appliedWoundIds 포함 → 호출부가 cluster AAR record 1건으로 남긴다.
//   opts._forceErrorAfterConsume: 테스트 전용 — 자원 소비 이후 후처리 단계 강제 오류(원자성 검증).
// ════════════════════════════════════════════════════════════════════════════
function applyTreatmentToCluster(tgt, med, clusterId, actionType, treater, opts) {
  const cl = med && med.woundClusters && med.woundClusters[clusterId];
  if (!cl) return { ok:false, reason:'no_cluster' };
  const plan = buildClusterTreatmentPlan(med, clusterId, actionType);
  if (!plan.ok) return { ok:false, reason: plan.reason, action: plan.action };
  if (!plan.eligibleCount) return { ok:false, reason:'no_eligible', alreadyCount: plan.alreadyCount, excludedCount: plan.excludedCount };
  const { act, isPressure, eligible, resKey, required } = { act: plan.action, isPressure: plan.isPressure, eligible: plan.eligible, resKey: plan.resKey, required: plan.required };
  const have = getMedicalResourceCount(tgt, resKey);
  if (resKey && have < required) return { ok:false, reason:'insufficient', resKey, required, have };
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  // ── 스냅샷 (자원 수량 포함) ──
  // [CLOSURE 목표C] 스냅샷 — treatmentState + wound-level 파생 캐시(_comboRecurrenceRisk)까지 포함해 의료적 무흔적 보장.
  const snapshots = eligible.map(w => ({
    w,
    ts: JSON.parse(JSON.stringify(w.treatmentState || {})),
    hadComboRecur: ('_comboRecurrenceRisk' in w),
    comboRecur: w._comboRecurrenceRisk,
  }));
  const partBandageBefore = (med.bodyParts && med.bodyParts[cl.partKey]) ? !!med.bodyParts[cl.partKey].bandageApplied : null;
  const clStateBefore = cl.treatmentClusterState ? JSON.parse(JSON.stringify(cl.treatmentClusterState)) : null;
  const resBefore = (resKey && tgt.medicalResources) ? (tgt.medicalResources[resKey] || 0) : null;
  let applied = 0, consumed = false;
  const rollback = () => {
    let ok = true;
    try {
      for (const snap of snapshots) {
        snap.w.treatmentState = snap.ts;
        if (snap.hadComboRecur) snap.w._comboRecurrenceRisk = snap.comboRecur; else delete snap.w._comboRecurrenceRisk;   // wound-level 캐시 복구
      }
      if (partBandageBefore !== null && med.bodyParts && med.bodyParts[cl.partKey]) med.bodyParts[cl.partKey].bandageApplied = partBandageBefore;
      if (clStateBefore !== null) cl.treatmentClusterState = clStateBefore; else delete cl.treatmentClusterState;
      if (consumed && resKey && resBefore !== null && tgt.medicalResources) tgt.medicalResources[resKey] = resBefore;   // 자원 복구
      if (typeof refreshWoundCluster === 'function') refreshWoundCluster(tgt, clusterId);   // canonical 재계산으로 derived summary 원복
    } catch (e2) { ok = false; }
    return ok;
  };
  try {
    const appliedWoundIds = [];
    for (const w of eligible) {
      if (isPressure) _applyPressureBandageToWound(w, now, treater);
      else _applyPlainBandageToWound(w, now, treater);
      w.treatmentState.lastTreatedAt = now;
      _postWoundTreatmentSync(w, med, act);   // 개별 처치와 동일한 sequence/combo 후처리 (오류 시 throw → rollback)
      // [CLOSURE 목표B] 실제 후처리 단계 오류 주입 훅(테스트) — 자원 소비 이전이므로 부분 적용도 남으면 안 됨.
      if (opts && opts._forceErrorInPostSync) throw new Error('forced post-sync error (test)');
      appliedWoundIds.push(w.id);
      applied++;
    }
    // 자원 최종 commit (1회). 실패 시 예외 → rollback.
    if (resKey) {
      const cons = consumeMedicalResourceUnits(tgt, resKey, required);
      if (!cons.consumed) throw new Error('resource consume failed at commit: ' + resKey + ' need ' + required);
      consumed = true;
    }
    if (opts && opts._forceErrorAfterConsume) throw new Error('forced post-consume error (test)');   // 원자성 검증 훅
    // cluster 요약(물리적 드레싱 이력)만 기록 — 의료효과 SoT는 child. refresh가 파생상태 재계산.
    if (med.bodyParts && med.bodyParts[cl.partKey]) med.bodyParts[cl.partKey].bandageApplied = true;
    cl.treatmentClusterState = cl.treatmentClusterState || {};
    if (isPressure) cl.treatmentClusterState.pressureApplied = true;
    else cl.treatmentClusterState.plainBandaged = true;
    cl.treatmentClusterState.lastTreatmentTime = now;
    cl.treatmentClusterState.lastDressingAction = act;
    // 물리적 드레싱 이력(요약) — 의료효과와 분리. AAR/디버깅에서 "묶음 1회 + child ID 목록" 확인용.
    cl.treatmentClusterState.lastDressingWoundIds = appliedWoundIds.slice();
    cl.treatmentClusterState.dressingCount = (cl.treatmentClusterState.dressingCount || 0) + 1;
    cl.treatmentClusterState.treatmentQuality = Math.max(cl.treatmentClusterState.treatmentQuality || 0, (treater && treater.medicSkill) ? Math.min(0.9, 0.5 + treater.medicSkill * 0.4) : 0.6);
    refreshWoundCluster(tgt, clusterId);
    return { ok:true, applied, required, used: required, resKey, remaining: (tgt.medicalResources ? tgt.medicalResources[resKey] : null), clusterId, action: act, appliedWoundIds };
  } catch (e) {
    const rolledBack = rollback();
    _clusterTreatmentError('apply', { unitId: tgt && tgt.id, treaterId: treater && treater.id, partKey: cl.partKey, clusterId, action: act, appliedBeforeFail: applied, consumed, rolledBack }, e);
    return { ok:false, reason:'error', error: e && e.message, rolledBack, clusterId };
  }
}
// 처치 성공/부분성공 시 자원 소모. 실패해도 소모 정책은 호출부에서 결정.
function consumeMedicalResourceForTreatment(unit, type) {
  const key = TREATMENT_RESOURCE_MAP[type];
  if (!key || !unit || !unit.medicalResources) return { consumed:false, key:null, remaining:0 };
  if ((unit.medicalResources[key] || 0) <= 0) return { consumed:false, key, remaining:0, empty:true };
  unit.medicalResources[key] = Math.max(0, (unit.medicalResources[key] || 0) - 1);
  return { consumed:true, key, remaining:unit.medicalResources[key] };
}

// HOTFIX §1: 추천/버튼/자원/실행/AAR이 같은 key를 보도록 정규화. (자원명 계열 → 실행 액션 계열)
const _TREATMENT_ACTION_ALIAS = {
  hemostatic_gauze:'hemostatic', hemostatic:'hemostatic',
  wound_packing:'packing', packing:'packing',
  pressure_bandage:'pressure_bandage', bandage:'bandage', tourniquet:'tourniquet', splint:'splint',
  chest_seal:'chestseal', chestseal:'chestseal',
  decompression_needle:'chest_relief', needle_decompression:'chest_relief', decompression:'chest_relief', chest_relief:'chest_relief',
  airway_basic:'airway_support', airway:'airway_support', oxygen:'airway_support', airway_support:'airway_support',
  pelvic_binder:'pelvic_binder',
  iv_fluid:'circulation_support', blood_pack:'circulation_support', circulation_support:'circulation_support',
  junctional_pressure:'junctional_control', junctional_control:'junctional_control', abdominal_dressing:'abdominal_dressing',
  evacuation:'mark_evac', mark_evac:'mark_evac'
};
// HOTFIX §7: circulation_support / airway_support가 내부에서 실제 자원 자동 선택
function resolveCirculationResource(target, wound) {
  const bp = getMedicalResourceCount(target, 'blood_pack');
  const iv = getMedicalResourceCount(target, 'iv_fluid');
  const med = target && target.medical;
  const needTransfuse = !!(wound && (wound.transfusionRequiredCandidate)) || (med && med.evacuationModel && med.evacuationModel.transfusionRequired)
    || (med && (med.hypovolemia === 'severe' || med.hypovolemia === 'critical')) || (med && med.bloodMl != null && med.bloodMl < 3500);
  if (bp > 0 && needTransfuse) return 'blood_pack';
  if (iv > 0) return 'iv_fluid';
  if (bp > 0) return 'blood_pack';
  return null;
}
function resolveAirwayResource(target, wound) {
  const ab = getMedicalResourceCount(target, 'airway_basic');
  const ox = getMedicalResourceCount(target, 'oxygen');
  const med = target && target.medical;
  const lowO2 = !!(med && (med.oxygenDelivery != null && med.oxygenDelivery < 0.85)) || (wound && wound.partKey === 'chest');
  const list = [];
  if (ab > 0) list.push('airway_basic');
  if (ox > 0 && (lowO2 || ab <= 0)) list.push('oxygen');
  return list;   // 소모할 자원 목록 (기도확보 + 필요시 산소)
}
function normalizeTreatmentActionKey(actionKey) {
  return _TREATMENT_ACTION_ALIAS[actionKey] || actionKey;
}
// HOTFIX §3: 이미 적용된 처치 판정 (재출혈 활성 시 재적용 허용)
function isTreatmentAlreadyApplied(wound, actionKey) {
  if (!wound) return false;
  const ts = wound.treatmentState || {};
  const a = normalizeTreatmentActionKey(actionKey);
  // 재출혈/재악화 활성이면 재적용 허용 (완료로 안 봄)
  if (ts.recurrenceActive) return false;
  switch (a) {
    case 'tourniquet': return !!ts.tourniquetApplied;
    case 'hemostatic': return !!ts.hemostaticApplied;
    case 'packing': return !!ts.packed;
    case 'pressure_bandage': return !!ts.pressureBandaged;
    case 'bandage': return !!ts.bandageApplied;   // [CLOSURE 목표A] 일반 붕대 완료 = bandageApplied 단독 (bandaged=압박 호환 / secured=전체 단계 → 완료판정에 미사용)
    case 'chestseal': return !!ts.chestSealed;
    case 'chest_relief': return !!ts.needleDecompressed;
    case 'airway_support': return !!ts.airwaySupported;
    case 'pelvic_binder': return !!ts.pelvicBound;
    case 'circulation_support': return !!(ts.ivGiven || ts.bloodPackGiven);
    case 'junctional_pressure': case 'junctional_control': return !!ts.junctionalPressureApplied;
    default: return false;
  }
}
// HOTFIX2 §7: plan에서 정규화 기준으로 action의 tier 조회
function getTreatmentTierFromPlan(plan, action) {
  if (!plan) return 'none';
  const n = normalizeTreatmentActionKey(action);
  const inN = (arr) => (arr || []).some(a => normalizeTreatmentActionKey(a) === n);
  if (inN(plan.completed)) return 'completed';
  if (inN(plan.primary)) return 'primary';
  if (inN(plan.followUps)) return 'followUp';
  if (inN(plan.optional)) return 'optional';
  if (inN(plan.notRecommended)) return 'notRecommended';
  return 'none';
}
// HOTFIX2 §2: 선택 wound의 처치 계획
function getSelectedWoundTreatmentPlan(target, treater, selectedPart, selectedWoundId) {
  try {
    const med = target && target.medical; if (!med) return null;
    const pk = selectedPart ? resolveBodyPartKey(selectedPart, null) : null;
    const w = _selectTreatWound(med, pk, selectedWoundId);
    if (!w) return { plan:null, wound:null };
    return { plan: buildTreatmentRecommendationPlan(target, w, treater), wound: w };
  } catch (e) { return null; }
}
// HOTFIX2 §3/§12: 부위/안정화 버튼 action → plan tier (버튼 action은 정규화 계열과 매핑)
function getPlanTierForButton(plan, buttonType) {
  if (!plan) return 'none';
  const n = normalizeTreatmentActionKey(buttonType);   // chest_relief/airway_support/circulation_support/mark_evac/tourniquet 등
  const inN = (arr) => (arr || []).some(a => normalizeTreatmentActionKey(a) === n);
  if (inN(plan.completed)) return 'completed';
  if (inN(plan.primary)) return 'primary';
  if (inN(plan.followUps)) return 'followUp';
  if (inN(plan.optional)) return 'optional';
  if (inN(plan.notRecommended)) return 'notRecommended';
  return 'none';
}

// --- §12 처치 품질 ---
function getTreatmentQuality(treater, target, wound, action) {
  const reasonTags = [];
  let quality = 0.7, timeMultiplier = 1.0, failureRisk = 0.08;
  const skill = (treater && (treater.medicalSkill != null ? treater.medicalSkill : (treater.medic ? 0.85 : 0.6))) || (treater ? 0.6 : 0.5);
  quality = 0.35 + 0.55 * Math.max(0, Math.min(1, skill));
  if (!treater) { quality = 0.5; reasonTags.push('self_or_no_treater'); }
  const cons = treater && treater.medical ? (treater.medical.consciousness != null ? treater.medical.consciousness : 100) : 100;
  if (cons < 60) { quality *= 0.75; failureRisk += 0.1; reasonTags.push('treater_impaired'); }
  const stress = (treater && (treater.suppression || treater.stress || treater.panic)) || 0;
  if (stress > 0.5) { quality *= 0.8; timeMultiplier *= 1.25; failureRisk += 0.08; reasonTags.push('under_stress'); }
  if (treater && target && treater.id !== target.id && treater.x != null && target.x != null) {
    const dx = treater.x - target.x, dy = (treater.y||0) - (target.y||0); const distPx = Math.sqrt(dx*dx+dy*dy);
    const distM = pxToM(distPx);   // SIDE-METRIC-SCALE-1: PX_PER_M 기준 (처치범위 2m)
    if (distM > 2.2) { quality *= 0.85; timeMultiplier *= 1.15; reasonTags.push('reaching_distance'); }
  }
  if ((treater && treater.isMoving) || (target && target.isMoving)) { quality *= 0.7; failureRisk += 0.12; timeMultiplier *= 1.2; reasonTags.push('movement_during_care'); }
  // 적응증 일치 (HOTFIX2 §8: 정규화 기준 비교 — chest_relief/airway_support/circulation_support 오분류 방지)
  const plan = (wound && typeof buildTreatmentRecommendationPlan === 'function') ? buildTreatmentRecommendationPlan(target, wound, treater) : null;
  let indicationMultiplier = 0.7;
  if (plan) {
    const nA = normalizeTreatmentActionKey(action);
    const nL = (arr) => (arr || []).map(normalizeTreatmentActionKey);
    if (nL(plan.primary).indexOf(nA) >= 0) { indicationMultiplier = 1.0; reasonTags.push('correct_indication'); }
    else if (nL(plan.followUps).indexOf(nA) >= 0) { indicationMultiplier = 0.85; reasonTags.push('followup_indication'); }
    else if (nL(plan.optional).indexOf(nA) >= 0) { indicationMultiplier = 0.55; reasonTags.push('optional_indication'); }
    else if (nL(plan.notRecommended).indexOf(nA) >= 0) { indicationMultiplier = 0.15; failureRisk += 0.05; reasonTags.push('poor_indication'); }
  }
  quality = Math.max(0.05, Math.min(1, quality));
  return { quality, timeMultiplier, failureRisk: Math.min(0.6, failureRisk), indicationMultiplier, reasonTags };
}

// --- §2 처치 추천 계획 ---
// 액션 토큰(추천용): tourniquet, hemostatic, packing, pressure_bandage, bandage, splint, junctional_pressure,
//   chestseal, needle_decompression, airway, oxygen, pelvic_binder, iv_fluid, blood_pack, evacuation
function _woundBleedingActive(w) {
  const bp = w.bleedingProfile || {};
  return bp.bleedingType && bp.bleedingType !== 'none';
}
function buildTreatmentRecommendationPlan(target, wound, treater) {
  const out = { primary:[], followUps:[], optional:[], notRecommended:[], rationaleTags:[], sequenceStage:'initial' };
  if (!wound) return out;
  const pk = wound.partKey || '';
  const tags = wound.treatmentIndicationTags || [];
  const cat = wound.internalBleedingCategory || '';
  const med = wound.normalizedMedicalAddress || (wound.bodyTrajectory && wound.bodyTrajectory.normalizedMedicalAddress) || null;
  const mz = (med && med.medicalZone) || '';
  const ts = wound.treatmentState || {};
  const stage = ts.sequenceStage || 'none';
  const bleeding = _woundBleedingActive(wound);
  const bp = wound.bleedingProfile || {};
  const isLimb = (pk === 'leftArm' || pk === 'rightArm' || pk === 'leftLeg' || pk === 'rightLeg');
  const isJunctional = (cat === 'junctional_limited_control') || tags.indexOf('junctionalHemorrhage') >= 0 || tags.indexOf('junctionalControlCandidate') >= 0
    || mz === 'groin_junctional' || mz === 'femoral_triangle' || mz === 'axilla' || mz === 'supraclavicular';
  const isChestOpen = (wound.confirmedInjuries || []).indexOf('open_chest_wound_confirmed') >= 0 || tags.indexOf('chestSealCandidate') >= 0 || (wound.chestTraumaModel && wound.chestTraumaModel.openChestWound);
  const tensionRisk = tags.indexOf('chestReliefCandidate') >= 0 || (wound.chestTraumaModel && wound.chestTraumaModel.tensionRisk);
  const airwayRisk = (cat === 'airway_compromise') || tags.indexOf('airwayCompromise') >= 0 || (med && med.airwayRisk === true) || /jaw|mouth/.test(mz);   // CLEANUP HOTFIX 3: possible 제외
  const pelvicInternal = (cat === 'pelvic_internal') || tags.indexOf('pelvicInternalBleed') >= 0 || tags.indexOf('pelvicControlCandidate') >= 0;
  const cavityInternal = (cat === 'thoracic_internal' || cat === 'abdominal_internal' || cat === 'retroperitoneal_internal');
  const hasFracture = (wound.fractureModel && wound.fractureModel.fractured) || /fracture|bone/.test((wound.confirmedInjuries||[]).concat(wound.probableInjuries||[]).join(' '));
  const R = (arr, v) => { if (arr.indexOf(v) < 0) arr.push(v); };

  // ===== 우선순위 분기 (상호배타 아님, 첫 매칭 그룹이 primary를 결정) =====
  // §6: 접합부(axilla/supraclavicular 포함)는 흉강위험이 있어도 junctional 우선 — cat이 이미 그렇게 분류됨.
  const junctionalAuthoritative = (cat === 'junctional_limited_control');
  if (airwayRisk) {
    out.rationaleTags.push('airway_priority');
    if (stage === 'none' || stage === 'airway_supported') { R(out.primary, 'airway'); R(out.optional, 'oxygen'); }
    R(out.followUps, 'evacuation'); R(out.optional, 'oxygen');
    out.notRecommended.push('tourniquet');
    out.sequenceStage = (stage === 'airway_supported') ? 'evac_required' : 'initial';
  } else if (junctionalAuthoritative || (isJunctional && !isChestOpen && !pelvicInternal)) {
    out.rationaleTags.push('junctional_hemorrhage');
    // 접합부: 지혈거즈/패킹 우선, 지혈대는 비추천/제한
    if (stage === 'none') { R(out.primary, 'hemostatic'); R(out.followUps, 'packing'); }
    else if (stage === 'hemostatic_applied') { R(out.primary, 'packing'); R(out.followUps, 'pressure_bandage'); }
    else if (stage === 'packed') { R(out.primary, 'pressure_bandage'); R(out.followUps, 'junctional_pressure'); }
    else { R(out.followUps, 'junctional_pressure'); R(out.followUps, 'evacuation'); }
    R(out.followUps, 'junctional_pressure'); R(out.optional, 'bandage'); R(out.followUps, 'evacuation');
    out.notRecommended.push('tourniquet');   // 접합부엔 지혈대 기본 비추천 (제한적)
    out.rationaleTags.push('tourniquet_not_first_line_junctional');
    out.sequenceStage = (stage === 'secured' || stage === 'compressed') ? 'evac_required' : (stage === 'none' ? 'initial' : 'controlled');
  } else if (isChestOpen) {
    out.rationaleTags.push('open_chest');
    if (stage === 'none' || stage === 'chest_sealed') R(out.primary, 'chestseal');
    // HOTFIX2 §4: 감압침은 tensionRisk가 있을 때만 추천 (chest_sealed 단독으로 승격 금지)
    if (tensionRisk) { if (stage === 'chest_sealed' || stage === 'none') R(out.followUps, 'needle_decompression'); }
    else { R(out.followUps, 'evacuation'); R(out.optional, 'oxygen'); }   // tension 없으면 산소/후송 쪽
    R(out.optional, 'oxygen'); R(out.followUps, 'evacuation');
    out.notRecommended.push('tourniquet');
    out.sequenceStage = (stage === 'chest_sealed' || stage === 'decompressed') ? 'secured' : 'initial';
  } else if (pelvicInternal) {
    out.rationaleTags.push('pelvic_internal');
    if (stage === 'none') R(out.primary, 'pelvic_binder'); else R(out.followUps, 'pelvic_binder');
    if (getMedicalResourceCount(target, 'blood_pack') > 0) R(out.followUps, 'blood_pack'); else R(out.optional, 'iv_fluid');
    R(out.followUps, 'evacuation');
    out.notRecommended.push('tourniquet'); out.notRecommended.push('packing');
    out.sequenceStage = (stage === 'pelvic_bound' || stage === 'circulation_supported') ? 'evac_required' : 'initial';
  } else if (cavityInternal) {
    out.rationaleTags.push('cavity_internal_no_field_control');
    R(out.primary, 'evacuation');
    if (getMedicalResourceCount(target, 'blood_pack') > 0) R(out.followUps, 'blood_pack'); else R(out.optional, 'iv_fluid');
    out.notRecommended.push('packing'); out.notRecommended.push('hemostatic'); out.notRecommended.push('tourniquet'); out.notRecommended.push('chestseal');
    out.sequenceStage = 'evac_required';
  } else if (isLimb && bleeding && (bp.bleedingType === 'arterial' || bp.bleedingType === 'venous' || bp.severity === 'severe' || bp.severity === 'massive' || tags.indexOf('tourniquetCandidate') >= 0)) {
    out.rationaleTags.push('limb_severe_bleed');
    // 사지 대량출혈: 지혈대 1순위
    if (stage === 'none') { R(out.primary, 'tourniquet'); }
    else if (stage === 'tourniquet_applied') { if (bleeding) { R(out.primary, 'hemostatic'); R(out.followUps, 'pressure_bandage'); } else R(out.followUps, 'pressure_bandage'); }
    else if (stage === 'hemostatic_applied') { R(out.primary, 'pressure_bandage'); }
    else { R(out.followUps, 'bandage'); }
    R(out.followUps, 'pressure_bandage'); R(out.optional, 'bandage');
    if (hasFracture) R(out.followUps, 'splint');
    out.sequenceStage = (stage === 'bandaged' || stage === 'secured') ? 'secured' : (stage === 'none' ? 'initial' : 'controlled');
  } else if (bleeding) {
    out.rationaleTags.push('external_bleed');
    if (bp.severity === 'severe' || bp.severity === 'massive') { if (stage === 'none') R(out.primary, 'hemostatic'); R(out.followUps, 'pressure_bandage'); }
    else { if (stage === 'none') R(out.primary, 'pressure_bandage'); }
    R(out.followUps, 'pressure_bandage'); R(out.optional, 'bandage');
    if (hasFracture) R(out.followUps, 'splint');
    out.sequenceStage = (stage === 'bandaged' || stage === 'compressed' || stage === 'secured') ? 'secured' : 'initial';
  } else {
    out.rationaleTags.push('no_active_bleed');
    if (hasFracture) R(out.primary, 'splint');
    R(out.optional, 'bandage');
    out.sequenceStage = 'controlled';
  }
  // definitive care 필요하면 evacuation을 항상 후속에
  if (tags.indexOf('definitiveCareRequired') >= 0 || tags.indexOf('surgeryRequiredCandidate') >= 0) { R(out.followUps, 'evacuation'); out.rationaleTags.push('definitive_care_required'); }
  // HOTFIX §3: 이미 적용된 처치를 primary/followUps/optional에서 제거 → completed로 분리. primary가 비면 followUp 승격.
  out.completed = [];
  const _notDone = (a) => { if (a === 'evacuation') return true; if (isTreatmentAlreadyApplied(wound, a)) { if (out.completed.indexOf(a) < 0) out.completed.push(a); return false; } return true; };
  out.primary = out.primary.filter(_notDone);
  out.followUps = out.followUps.filter(_notDone);
  out.optional = out.optional.filter(_notDone);
  // HOTFIX2 §2/§3: 적용된 주요 처치는 completed에 포함 (버튼 [완료] 표시 + tier 조회용)
  ['tourniquet','hemostatic','packing','pressure_bandage','bandage','chestseal','chest_relief','airway_support','pelvic_binder','circulation_support'].forEach(a => { if (isTreatmentAlreadyApplied(wound, a) && out.completed.indexOf(a) < 0) out.completed.push(a); });
  if (!out.primary.length && out.followUps.length) { out.primary.push(out.followUps.shift()); }
  return out;
}

// --- §4~§8 처치 콤보 효과 ---
// 콤보는 external/junctional/pulse 성분에만. 체강 내부출혈엔 직접 적용 금지.
function applyTreatmentComboEffects(wound, medical, action) {
  if (!wound) return null;
  // [CLOSURE 목표B 검증] 실제 후처리 함수 내부 오류 주입 훅 — 빈 catch 삼킴이 없음을 증명(테스트 전용).
  if (typeof GAME !== 'undefined' && GAME._testForceComboError) throw new Error('forced combo-effect error (test)');
  const ts = wound.treatmentState || (wound.treatmentState = {});
  const ce = ts.comboEffects || (ts.comboEffects = { hemorrhageControlBonus:0, recurrenceRiskReduction:0, stabilityBonus:0, lastCombo:null, comboTags:[] });
  const cat = wound.internalBleedingCategory || '';
  const cavityInternal = (cat === 'thoracic_internal' || cat === 'abdominal_internal' || cat === 'retroperitoneal_internal' || cat === 'pelvic_internal');
  const has = (f) => !!ts[f];
  const tags = new Set(ce.comboTags);
  let recurrenceRisk = ts.recurrenceRisk != null ? ts.recurrenceRisk : 0.6;

  // 사지/외부 지혈대 콤보 — HOTFIX 1-5: 같은 partKey에 적용된 지혈대만 인정 (다른 팔/다리 지혈대 제외)
  const pk = wound.partKey || '';
  const samePartTourniquet = has('tourniquetApplied') || wound._tourniquetOnPart
    || !!(medical && medical.bodyPartTreatments && medical.bodyPartTreatments[pk] && medical.bodyPartTreatments[pk].tourniquet)
    || !!(medical && medical.bodyParts && medical.bodyParts[pk] && medical.bodyParts[pk].tourniquetApplied);
  const tourniquet = samePartTourniquet;
  if (tourniquet && has('pressureBandaged')) {
    ce.hemorrhageControlBonus = Math.max(ce.hemorrhageControlBonus, 0.12);
    ce.recurrenceRiskReduction = Math.max(ce.recurrenceRiskReduction, 0.4); recurrenceRisk = Math.min(recurrenceRisk, 0.25);
    ce.stabilityBonus = Math.max(ce.stabilityBonus, 0.15); tags.add('tourniquet+pressure'); ce.lastCombo = 'tourniquet+pressure';
    if (has('hemostaticApplied')) { ce.hemorrhageControlBonus = Math.max(ce.hemorrhageControlBonus, 0.2); recurrenceRisk = Math.min(recurrenceRisk, 0.15); tags.add('tourniquet+hemostatic+pressure'); ce.lastCombo = 'tourniquet+hemostatic+pressure'; }
  }
  // 접합부 콤보: hemostatic + packing + pressure
  if (has('hemostaticApplied') && has('packed')) {
    ce.hemorrhageControlBonus = Math.max(ce.hemorrhageControlBonus, 0.15);
    ce.recurrenceRiskReduction = Math.max(ce.recurrenceRiskReduction, 0.3); recurrenceRisk = Math.min(recurrenceRisk, 0.35);
    tags.add('hemostatic+packing'); ce.lastCombo = 'hemostatic+packing';
    if (has('pressureBandaged') || has('junctionalPressureApplied')) {
      ce.hemorrhageControlBonus = Math.max(ce.hemorrhageControlBonus, 0.25);
      ce.stabilityBonus = Math.max(ce.stabilityBonus, 0.2); recurrenceRisk = Math.min(recurrenceRisk, 0.2);
      tags.add('hemostatic+packing+pressure'); ce.lastCombo = 'hemostatic+packing+pressure';
    }
  } else if (has('packed') && (has('pressureBandaged') || has('junctionalPressureApplied'))) {
    // hemostatic 없이 packing+pressure — 효과 낮음
    ce.hemorrhageControlBonus = Math.max(ce.hemorrhageControlBonus, 0.1);
    ce.recurrenceRiskReduction = Math.max(ce.recurrenceRiskReduction, 0.15); recurrenceRisk = Math.min(recurrenceRisk, 0.4);
    tags.add('packing+pressure'); ce.lastCombo = 'packing+pressure';
  } else if (has('hemostaticApplied') && !has('packed') && !has('pressureBandaged')) {
    tags.add('hemostatic_alone'); recurrenceRisk = Math.max(recurrenceRisk, 0.55);   // 단독 — 재출혈 위험 유지
  }
  // 흉부: chest_seal + decompression
  if (has('chestSealed') && has('needleDecompressed')) {
    ce.stabilityBonus = Math.max(ce.stabilityBonus, 0.15); ce.recurrenceRiskReduction = Math.max(ce.recurrenceRiskReduction, 0.2);
    tags.add('chestseal+decompression'); ce.lastCombo = 'chestseal+decompression';
  }
  // 골반: pelvic_binder + blood/iv — 시간벌기만
  if (has('pelvicBound') && (has('bloodPackGiven') || has('ivGiven'))) { tags.add('pelvic+circulation_timebuy'); ce.lastCombo = 'pelvic+circulation_timebuy'; }

  // 체강 내부출혈엔 콤보 보너스가 출혈 자체를 없애지 않음 (표식/시간벌기만)
  if (cavityInternal) { ce.hemorrhageControlBonus = 0; ce.comboAppliesToCavity = false; tags.add('cavity_no_direct_control'); }

  ce.comboTags = Array.from(tags);
  ts.recurrenceRisk = recurrenceRisk;
  wound._comboRecurrenceRisk = recurrenceRisk;
  return ce;
}

// [HOTFIX 마감] 처치 후 wound 공통 후처리 — sequence stage + combo effect + recurrence risk.
//   개별 처치와 cluster 처치가 동일 경로를 공유해 wound별 의료 의미가 일치하도록 한다.
//   (자원 소비 / 로그 / AAR commit / UI 갱신은 호출부가 담당 — 이 함수는 wound 상태만 만진다.)
function _postWoundTreatmentSync(wound, medical, action) {
  if (!wound) return;
  // [CLOSURE 목표B] 후처리 오류를 빈 catch로 삼키지 않는다 — 호출부(cluster/개별)의 원자성 경로가 rollback하도록 전파.
  updateWoundSequenceStage(wound, action);
  applyTreatmentComboEffects(wound, medical, action);
}
// --- §3 처치 단계 갱신 ---
function updateWoundSequenceStage(wound, action) {
  const ts = wound.treatmentState || (wound.treatmentState = {});
  const map = { tourniquet:'tourniquet_applied', hemostatic:'hemostatic_applied', packing:'packed',
    pressure_bandage:'compressed', junctional_pressure:'compressed', bandage:'bandaged', chestseal:'chest_sealed',
    needle_decompression:'decompressed', decompression:'decompressed', chest_relief:'decompressed',
    airway:'airway_supported', airway_basic:'airway_supported', airway_support:'airway_supported', oxygen:'airway_supported',
    pelvic_binder:'pelvic_bound', iv_fluid:'circulation_supported', blood_pack:'circulation_supported',
    circulation_support:'circulation_supported', mark_evac:'evac_required' };
  const stage = map[action];
  if (stage) ts.sequenceStage = stage;
  // "secured" 승격: 지혈 후속 고정까지 끝나면
  if ((ts.pressureBandaged || ts.bandaged) && (ts.hemostaticApplied || ts.packed || ts.tourniquetApplied)) ts.sequenceStage = 'secured';
  return ts.sequenceStage;
}
// =================== /SIDE-MEDICAL-FIELDCARE-RESOURCE-1 ===================

// SIDE-MEDICAL-FIELDCARE-RESOURCE-1: 래퍼 — 자원 게이트 + 처치 후 sequenceStage/combo 후크. 실제 처치는 _core가 담당.
function applyWoundOrPartTreatment(tgt, med, type, treatLoc, partKey, woundId, treater, groupId) {
  const log3 = (msg, c) => { if (typeof log === 'function') log(msg, c); };
  // HOTFIX §7: circulation_support / airway_support는 실제 자원을 동적 선택
  let _dynResources = null;   // 실제 소모할 자원 key 목록
  const _selW = _selectTreatWound(med, partKey || (treatLoc ? resolveBodyPartKey(treatLoc, null) : null), woundId);
  // HOTFIX2 §7: 처치 전 plan/tier/재출혈위험 저장 (처치 후엔 completed로 빠져 tier가 바뀌므로)
  const _prePlan = _selW ? buildTreatmentRecommendationPlan(tgt, _selW, treater) : null;
  const _preTier = _prePlan ? getTreatmentTierFromPlan(_prePlan, type) : 'none';
  const _preRR = (_selW && _selW.treatmentState && _selW.treatmentState.recurrenceRisk != null) ? _selW.treatmentState.recurrenceRisk : null;
  const _preStage = (_selW && _selW.treatmentState && _selW.treatmentState.sequenceStage) || 'none';   // RESIDUAL HOTFIX 5
  if (type === 'circulation_support') {
    const r = resolveCirculationResource(tgt, _selW);
    if (!r) { log3(`[${tgt.name}] 자원 부족: 혈액팩/수액 없음 — 순환보조 불가`, 'warn'); return false; }
    _dynResources = [r];
  } else if (type === 'airway_support') {
    const list = resolveAirwayResource(tgt, _selW);
    if (!list.length) { log3(`[${tgt.name}] 자원 부족: 기도확보/산소 없음 — 기도보조 불가`, 'warn'); return false; }
    _dynResources = list;
  }
  // 대형 PHASE 5: cluster 일괄 처치는 cluster API 단일 경로 (필요 유닛 게이트 + 원자 소모 + 부분적용 금지).
  //   1자원-전체처치이던 구 §16 경로를 대체한다. 개별 wound 처치(woundId 지정)는 그대로 개별 1건만.
  if (groupId && (type === 'pressure_bandage' || type === 'bandage')) {
    const rc = applyTreatmentToCluster(tgt, med, groupId, type, treater);
    if (rc.ok) {
      const _kind = (rc.action === 'bandage') ? '묶음 붕대 마감' : '묶음 압박붕대';
      log3(`[${tgt.name}] ${_kind} ×${rc.applied} — 자원 ${rc.resKey} ${rc.used}개 소모 (잔여 ${rc.remaining})`, 'good');
      return true;
    }
    if (rc.reason === 'insufficient') { log3(`[${tgt.name}] 자원 부족: ${rc.resKey} 보유 ${rc.have} / 필요 ${rc.required} — 묶음 처치 시작 불가`, 'warn'); return false; }
    if (rc.reason === 'no_eligible') { log3(`[${tgt.name}] 묶음 처치 대상 없음 (전부 처치됨/체내출혈/미통제 중증)`, 'info'); return false; }
    if (rc.reason === 'error') { log3(`[${tgt.name}] 묶음 처치 실패 — 상태 ${rc.rolledBack ? '복구됨' : '복구 실패!'} (자원 미소모)`, 'warn'); return false; }
    return false;
  }
  // 자원 게이트 (제거/취소류는 매핑 없음 → 통과). 부상자 자신의 IFAK(tgt) 기준 — 후속 패치에서 메딕 가방 분리.
  const resKey = _dynResources ? _dynResources[0] : TREATMENT_RESOURCE_MAP[type];
  if (resKey && !_dynResources) {
    if (!hasMedicalResourceForTreatment(tgt, type)) {
      log3(`[${tgt.name}] 자원 부족: ${resKey} 없음 — ${type} 불가`, 'warn');
      return false;
    }
  }
  const ok = _applyWoundOrPartTreatmentCore(tgt, med, type, treatLoc, partKey, woundId, treater, groupId);
  if (ok) {
    if (_dynResources) { for (const rk of _dynResources) { if ((tgt.medicalResources && tgt.medicalResources[rk] || 0) > 0) tgt.medicalResources[rk] = Math.max(0, tgt.medicalResources[rk] - 1); } }
    else if (resKey) consumeMedicalResourceForTreatment(tgt, type);
  }
  // 처치 후: 선택 wound에 sequenceStage + combo 반영
  if (ok) {
    try {
      const pk2 = partKey || (treatLoc ? resolveBodyPartKey(treatLoc, null) : null);
      const w = _selectTreatWound(med, pk2, woundId);
      if (w) {
        // tourniquet은 part-level → wound에도 표식
        if (type === 'tourniquet') { w.treatmentState = w.treatmentState || {}; w.treatmentState.tourniquetApplied = true; w._tourniquetOnPart = true; }
        if (type === 'needle_decompression' || type === 'decompression' || type === 'chest_relief') { w.treatmentState = w.treatmentState || {}; w.treatmentState.needleDecompressed = true; }
        if (type === 'pelvic_binder') { w.treatmentState = w.treatmentState || {}; w.treatmentState.pelvicBound = true; }
        // HOTFIX2 §10: 동적 자원 기준으로 상태 기록 (type만으로 ivGiven 찍지 않음)
        w.treatmentState = w.treatmentState || {};
        if (_dynResources) {
          if (_dynResources.indexOf('blood_pack') >= 0) { w.treatmentState.bloodPackGiven = true; w.treatmentState.bloodGiven = true; }
          if (_dynResources.indexOf('iv_fluid') >= 0) { w.treatmentState.ivGiven = true; w.treatmentState.ivFluidGiven = true; }
          if (_dynResources.indexOf('airway_basic') >= 0) { w.treatmentState.airwaySupported = true; w.treatmentState.airwayBasicUsed = true; }
          if (_dynResources.indexOf('oxygen') >= 0) { w.treatmentState.oxygenGiven = true; w.treatmentState.oxygenSupported = true; }
        } else {
          if (type === 'blood_pack') { w.treatmentState.bloodPackGiven = true; w.treatmentState.bloodGiven = true; }
          if (type === 'iv_fluid') { w.treatmentState.ivGiven = true; w.treatmentState.ivFluidGiven = true; }
          if (type === 'airway' || type === 'airway_basic') { w.treatmentState.airwaySupported = true; }
        }
        updateWoundSequenceStage(w, type);
        applyTreatmentComboEffects(w, med, type);
        // HOTFIX 4-1/4-2: 최소·보수적 생리 보조 (원인 치료 아님 · 시간벌기 · markers 미제거).
        try {
          if (med) {
            if (_dynResources && _dynResources.indexOf('blood_pack') >= 0) {
              // 혈액팩: bloodMl 제한적 top-up (출혈 지속 시 곧 소실) + oxygenDelivery 소폭 보조. 출혈 source 미해결.
              const _bmax = med.bloodMax || med.bloodMl || 5000;
              med.bloodMl = Math.min(_bmax, (med.bloodMl || 0) + 400);
              if (med.hemodynamics) med.hemodynamics.oxygenDelivery = Math.min(1.0, (med.hemodynamics.oxygenDelivery != null ? med.hemodynamics.oxygenDelivery : 1.0) + 0.05);
              med._bloodPackAssistAt = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
            }
            if (_dynResources && _dynResources.indexOf('iv_fluid') >= 0) {
              // 수액: MAP/perfusion 보조 (혈액 대체 아님, oxygenDelivery 직접 회복 거의 없음). bloodMl 소폭만.
              const _bmax2 = med.bloodMax || med.bloodMl || 5000;
              med.bloodMl = Math.min(_bmax2, (med.bloodMl || 0) + 120);   // 용적 팽창 소폭 (희석)
              med._ivAssistUntil = ((typeof GAME !== 'undefined' && GAME.gameTime) || 0) + 30;
            }
            if (_dynResources && _dynResources.indexOf('oxygen') >= 0) {
              if (med.hemodynamics) med.hemodynamics.oxygenDelivery = Math.min(1.0, (med.hemodynamics.oxygenDelivery != null ? med.hemodynamics.oxygenDelivery : 1.0) + 0.04);
              med._oxygenAssistUntil = ((typeof GAME !== 'undefined' && GAME.gameTime) || 0) + 30;
            }
          }
        } catch (e) {}
        // === AAR 처치 기록 (HOTFIX2 §7: 처치 전 tier 기준) ===
        try {
          if (typeof aarMedicalLog === 'function') {
            const _tq = getTreatmentQuality(treater, tgt, w, type);
            const _KO = { tourniquet:'지혈대', pressure_bandage:'압박붕대', hemostatic:'지혈거즈', packing:'패킹', bandage:'붕대', splint:'부목', junctional_pressure:'접합부압박', chestseal:'체스트씰', needle_decompression:'감압침', airway_support:'기도확보', airway:'기도확보', oxygen:'산소', pelvic_binder:'골반바인더', iv_fluid:'수액', blood_pack:'수혈', circulation_support:'순환보조', chest_relief:'흉부감압', junctional_control:'접합부통제' };
            const _tierKO = { primary:'1순위 처치', followUp:'후속 처치', optional:'선택 처치', notRecommended:'비추천 처치', completed:'완료 처치', none:'처치' };
            const _isRec = _tierKO[_preTier] || '처치';
            const _ce = (w.treatmentState && w.treatmentState.comboEffects) || {};
            let _msg = `${_KO[type] || type} 적용 (${_isRec}, 품질 ${(_tq.quality*100).toFixed(0)}%`;
            if (_dynResources) _msg += `, ${_dynResources.map(r=>({blood_pack:'혈액팩',iv_fluid:'수액',airway_basic:'기도확보',oxygen:'산소'}[r]||r)).join('+')} 소모`;
            else if (resKey) _msg += `, ${resKey} 소모`;
            if (_ce.lastCombo) _msg += `, 콤보:${_ce.lastCombo}`;
            const _rr = w.treatmentState && w.treatmentState.recurrenceRisk;
            if (_preRR != null && _rr != null && _rr !== _preRR) _msg += `, 재출혈위험 ${(_preRR>=0.5?'높음':_preRR>=0.3?'중간':'낮음')}→${_rr >= 0.5 ? '높음' : _rr >= 0.3 ? '중간' : '낮음'}`;
            else if (_rr != null) _msg += `, 재출혈위험 ${_rr >= 0.5 ? '높음' : _rr >= 0.3 ? '중간' : '낮음'}`;
            const _cat = w.internalBleedingCategory || '';
            if (/internal|retroperitoneal/.test(_cat) && (type === 'chestseal' || type === 'packing' || type === 'hemostatic')) _msg += ' — 체강 내부출혈엔 효과 없음';
            if ((w.treatmentIndicationTags || []).indexOf('definitiveCareRequired') >= 0) _msg += ' / 후송 필요';
            _msg += ')';
            const _consumed = _dynResources ? _dynResources.slice() : (resKey ? [resKey] : []);
            aarMedicalLog(tgt.id, _msg, {
              action: type, normalizedAction: normalizeTreatmentActionKey(type), targetId: tgt.id, treaterId: treater && treater.id,
              partKey: w.partKey || null, woundId: w.id || null, woundGroupId: groupId || null,
              recommendationTier: _preTier, treatmentQuality: +(_tq.quality.toFixed(2)),
              consumedResourceKey: _consumed[0] || null, consumedResources: _consumed,
              comboTriggered: !!(_ce && _ce.lastCombo), comboName: (_ce && _ce.lastCombo) || null,
              recurrenceRiskBefore: _preRR, recurrenceRiskAfter: (w.treatmentState && w.treatmentState.recurrenceRisk != null ? w.treatmentState.recurrenceRisk : null),
              sequenceStageBefore: _preStage, sequenceStageAfter: (w.treatmentState && w.treatmentState.sequenceStage) || null,
              blocked: false, blockReason: null, success: true,
              noInternalBleedEffect: /internal|retroperitoneal/.test(w.internalBleedingCategory || ''),
              definitiveCareRequired: (w.treatmentIndicationTags || []).indexOf('definitiveCareRequired') >= 0
            });
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  // HOTFIX 1-1: bandage가 새 시스템에서 차단됐으면 legacy bandage로 흘리지 않음 (handled=true, 자원 미소모, 출혈 미감소)
  if (!ok && type === 'bandage' && _lastTreatmentBlock && _lastTreatmentBlock.blocked) {
    try {
      if (typeof aarMedicalLog === 'function') aarMedicalLog(tgt.id, `붕대 차단 — ${_lastTreatmentBlock.reason === 'inappropriate_bandage_for_severe_bleed' ? '심한 출혈엔 붕대 단독 불가 (선 지혈 필요)' : _lastTreatmentBlock.reason === 'already_secured' ? '이미 고정 완료' : '적용 대상 없음'}`, {
        action: 'bandage', normalizedAction: normalizeTreatmentActionKey('bandage'), targetId: tgt.id, treaterId: treater && treater.id,
        partKey: (_selW && _selW.partKey) || null, woundId: (_selW && _selW.id) || null, woundGroupId: groupId || null,
        recommendationTier: _preTier, consumedResourceKey: null, consumedResources: [],
        sequenceStageBefore: _preStage, sequenceStageAfter: _preStage,
        blocked: true, blockReason: _lastTreatmentBlock.reason, success: false,
        comboTriggered: false, recurrenceRiskBefore: _preRR, recurrenceRiskAfter: _preRR
      });
    } catch (e) {}
    _lastTreatmentBlock = null;
    return true;   // handled — legacy fallback 차단
  }
  // [대형 HOTFIX] SHOTGUN-PHYS-CLUSTER-1 §17 구형 cluster 전파 블록 제거됨.
  //   개별 wound 처치는 선택한 wound에만 남는다 (지혈거즈/패킹이 cluster 형제로 복사되던 버그 제거).
  //   cluster 전체 처치는 applyTreatmentToCluster 단일 경로만 사용. 지혈대는 part-level(bodyPartTreatments)에서
  //   updateMedicalBleedingWoundBased가 부위 내 모든 wound에 자동 반영하므로 wound 복사 루프가 불필요하다.
  //   직접 currentExternal *= 배율 감소도 금지 — 처치는 treatmentState만 바꾸고 출혈 엔진이 effExt를 재계산한다.
  if (ok && woundId != null) {
    // 개별 wound 처치 후 소속 cluster 요약만 최신화 (형제 wound 상태는 건드리지 않음).
    try {
      const pk3 = partKey || (treatLoc ? resolveBodyPartKey(treatLoc, null) : null);
      const tw = _selectTreatWound(med, pk3, woundId);
      const cid = tw && tw.treatmentClusterId;
      if (cid && med.woundClusters && med.woundClusters[cid] && typeof refreshWoundCluster === 'function') refreshWoundCluster(tgt, cid);
    } catch (e) { _woundPipelineError('individual_treat_cluster_refresh', { unitId: tgt && tgt.id, woundId, type }, e); }
  }
  return ok;
}

function _applyWoundOrPartTreatmentCore(tgt, med, type, treatLoc, partKey, woundId, treater, groupId) {
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const log2 = (msg, c) => { if (typeof log === 'function') log(msg, c); };
  partKey = partKey || (treatLoc ? resolveBodyPartKey(treatLoc, null) : null) || (typeof MEDIC_OVERLAY !== 'undefined' ? resolveBodyPartKey(MEDIC_OVERLAY.selectedPart, null) : null);
  // TRAUMA-REFINE-1 §6: splint는 part-level 본편 활성화 (아래 legacy 완료 로직 사용). bandage만 hook 유지.
  // HOTFIX §4: bandage = 마감/고정 처치. 적용 가능하면 secured/stability 효과 + 자원 소모, 불가하면 false(자원 미소모).
  if (type === 'bandage') {
    _lastTreatmentBlock = null;
    const w = _selectTreatWound(med, partKey, woundId);
    if (!w) { _lastTreatmentBlock = { blocked:true, reason:'no_wound' }; log2(`[${tgt.name}] 붕대 — 처치할 상처 없음`, 'info'); return false; }
    const ts = w.treatmentState || (w.treatmentState = {});
    const bp = w.bleedingProfile || {};
    const bt = bp.bleedingType || 'none';
    const sev = bp.severity || '';
    const stage = ts.sequenceStage || 'none';
    const afterControl = (stage === 'compressed' || stage === 'hemostatic_applied' || stage === 'packed' || stage === 'tourniquet_applied' || ts.pressureBandaged || ts.hemostaticApplied || ts.packed || ts.tourniquetApplied);
    const minorBleed = (bt === 'none' || bt === 'oozing' || sev === 'minor' || sev === 'moderate');
    // 심한/접합부/내부출혈 단독 마감 금지 — 선행 통제 없으면 불가
    if (!afterControl && !minorBleed) { _lastTreatmentBlock = { blocked:true, reason:'inappropriate_bandage_for_severe_bleed' }; log2(`[${tgt.name}] 붕대 — 심한 출혈은 먼저 지혈 필요 (붕대 단독 불가)`, 'warn'); return false; }
    if (ts.bandageApplied) { _lastTreatmentBlock = { blocked:true, reason:'already_bandaged' }; log2(`[${tgt.name}] 붕대 — 이미 마감 완료`, 'info'); return false; }   // [CLOSURE 목표A] bandageApplied 기준 (압박이 세팅한 bandaged/secured로 오차단 방지)
    ts.bandaged = true; ts.bandageApplied = true; ts.lastTreatedAt = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
    ts.treatmentQuality = Math.max(ts.treatmentQuality || 0, 0.6);
    if (partKey && med.bodyParts[partKey]) med.bodyParts[partKey].bandageApplied = true;
    const partial = !afterControl && minorBleed && bt !== 'none';   // 통제 전 minor면 부분 마감
    log2(`[${tgt.name}] ${w.uiLabels ? w.uiLabels.combinedLabel : '상처'} — 붕대 마감/고정 ${afterControl ? '(안정화)' : partial ? '(경미 출혈 부분 마감)' : '(고정)'}`, 'good');
    return true;
  }
  if (false) {
    log2(`[${tgt.name}] 일반 붕대 — 현재 단계 비활성 처치 (후속)`, 'info');
    return true;
  }
  // === FIELD-STAB-1: field stabilization action 완료 라우팅 ===
  if (typeof FIELD_STAB_ACTIONS !== 'undefined' && FIELD_STAB_ACTIONS.indexOf(type) >= 0) {
    return completeFieldStabilizationAction(treater, tgt, type, { partKey, woundId });
  }
  // SIDE-MED-2C §6/§7/§8/§15: hemostatic / packing / junctional_pressure / abdominal_dressing 본편화 (적응증 wound만, 상태만 기록 → 출혈계산이 읽음)
  if (type === 'hemostatic' || type === 'packing' || type === 'junctional_pressure' || type === 'abdominal_dressing') {
    const w = _selectTreatWound(med, partKey, woundId);
    if (!w) { log2(`[${tgt.name}] 처치할 상처 없음`, 'info'); return true; }
    const tags = w.treatmentIndicationTags || [];
    const bp = w.bleedingProfile || {};
    const isCavity = (bp.bleedingType === 'cavity');
    const ts = w.treatmentState;
    // HOTFIX §5: 실제 처치 품질 반영 (고정값 대체)
    const _tq = (typeof getTreatmentQuality === 'function') ? getTreatmentQuality(treater, tgt, w, type) : { quality: (treater ? 0.85 : 0.7), indicationMultiplier: 1 };
    const _qEff = Math.max(0.15, Math.min(1, _tq.quality * (_tq.indicationMultiplier != null ? _tq.indicationMultiplier : 1)));
    if (type === 'hemostatic') {
      // external/muscle/junctional/접근 가능 채널. cavity 본체엔 효과 없음(적용은 막지 않되 효과 제한).
      ts.hemostaticApplied = true; ts.hemostaticAppliedAt = now;
      ts.hemostaticQuality = _qEff;
      ts.hemostaticEffective = !isCavity;
      ts.hemostaticReason = isCavity ? 'cavity_internal_no_effect' : 'external/muscle/junctional';
      log2(`[${tgt.name}] ${w.uiLabels.combinedLabel} — 지혈거즈 ${isCavity ? '(체강 내부출혈엔 효과 없음 / 외부 성분만)' : '적용'}`, isCavity ? 'info' : 'good');
    } else if (type === 'packing') {
      if (bp.bleedingType === 'none') { log2(`[${tgt.name}] 패킹 적응증 아님`, 'info'); return true; }
      ts.packed = true; ts.packedAt = now; ts.packingQuality = _qEff;
      ts.packingEffective = !isCavity; ts.requiresPressureAfterPacking = true;
      log2(`[${tgt.name}] ${w.uiLabels.combinedLabel} — 상처 패킹 ${isCavity ? '(체강 내부출혈엔 효과 없음)' : '(압박 추가 권장)'}`, isCavity ? 'info' : 'good');
    } else if (type === 'junctional_pressure') {
      ts.junctionalPressureApplied = true; ts.junctionalPressureAppliedAt = now;
      ts.junctionalPressureQuality = _qEff; ts.junctionalPressureMaintained = true;
      log2(`[${tgt.name}] ${w.uiLabels.combinedLabel} — 접합부 압박 (유지 필요 / 단독 안정화 약함)`, 'good');
    } else if (type === 'abdominal_dressing') {
      ts.abdominalDressed = true; ts.abdominalDressingAppliedAt = now;
      ts.abdominalDressingEffective = true; ts.contaminationReduced = true;
      if (w.openTorsoModel && w.openTorsoModel.eviscerationRisk) ts.eviscerationStabilized = true;
      log2(`[${tgt.name}] ${w.uiLabels.combinedLabel} — 복부 대형 드레싱 (오염/노출 위험 감소 / 내부출혈 해결 아님)`, 'good');
    }
    ts.lastTreatedAt = now;
    ts.treatmentQuality = Math.max(ts.treatmentQuality || 0, 0.6);
    return true;
  }
  // (구 §16 클러스터 일괄 처치 블록 제거 — 대형 PHASE 5: entry에서 applyTreatmentToCluster 단일 경로로 위임됨)
  if (type === 'pressure_bandage' || type === 'chestseal') {
    const w = _selectTreatWound(med, partKey, woundId);
    if (!w) { log2(`[${tgt.name}] 처치할 상처 없음`, 'info'); return true; }
    if (type === 'pressure_bandage') {
      _applyPressureBandageToWound(w, now, treater);
      if (partKey && med.bodyParts[partKey]) med.bodyParts[partKey].bandageApplied = true;
      log2(`[${tgt.name}] ${w.uiLabels.combinedLabel} — 압박붕대 처치`, 'good');
    } else { // SIDE-MED-2C §12: chestseal 본편화 — open chest wound 안정화 (내부출혈/기흉 진행에만 영향, bleeding rate엔 미적용)
      if (w.partKey !== 'chest') { log2(`[${tgt.name}] 흉부밀봉은 흉부 상처에만`, 'warn'); return true; }
      const ctm = w.chestTraumaModel;
      w.treatmentState.chestSealed = true; w.treatmentState.chestSealAppliedAt = now;
      w.treatmentState.chestSealEffective = !!(ctm && ctm.openChestWound);
      w.treatmentState.chestSealFailureRisk = (w.woundSize && (w.woundSize.sizeClass === 'large' || w.woundSize.sizeClass === 'massive')) ? 0.3 : 0.1;
      w.treatmentState.chestSealReason = (ctm && ctm.openChestWound) ? 'open_chest_stabilized' : 'no_open_component';
      if (med.bodyParts.chest) med.bodyParts.chest.chestSealed = true;
      log2(`[${tgt.name}] 개방성 흉부상 안정화 — 공기 유입 위험 감소 (내부출혈엔 효과 없음)`, (ctm && ctm.openChestWound) ? 'good' : 'info');
    }
    return true;
  }
  if (type === 'tourniquet') {
    if (!partKey) return true;
    const bpt = getBodyPartTreatment(med, partKey);
    bpt.tourniquet = { quality:'good', appliedAt: now, by: treater ? treater.id : null };
    if (med.bodyParts[partKey]) med.bodyParts[partKey].tourniquetApplied = true;
    tgt.tourniquetActive = true; tgt.tourniquetLoc = treatLoc || tgt.bleedingLoc; tgt.tourniquetAppliedAt = now;
    if (med) med.pain = Math.min(100, med.pain + 8);
    log2(`[${tgt.name}] ${_woundPartKo(partKey)} 지혈대 — 출혈 억제 (상처 미처치 / 추가 처치 필요)`, 'good');
    return true;
  }
  if (type === 'remove_tourniquet') {
    let any = false;
    for (const k in (med.bodyPartTreatments || {})) {
      if (med.bodyPartTreatments[k].tourniquet) {
        med.bodyPartTreatments[k].tourniquet = null;
        if (med.bodyParts[k]) med.bodyParts[k].tourniquetApplied = false;
        any = true;
        for (const w of med.wounds) {
          if (w.partKey === k && w.bleedingProfile && w.bleedingProfile.tourniquetEligible) {
            const rb = w.bleedingProfile.rebleedRisk || 0;
            w.bleedingProfile.currentExternal = Math.max(w.bleedingProfile.currentExternal, w.bleedingProfile.baseExternal * (0.5 + rb * 0.5));
          }
        }
      }
    }
    tgt.tourniquetActive = false; tgt.tourniquetLoc = null;
    log2(`[${tgt.name}] 지혈대 해제${any ? ' — 재출혈 가능' : ' (적용 없음)'}`, any ? 'warn' : 'info');
    return true;
  }
  return false;   // painkiller / shockcare → 기존 legacy 처리
}


function completeTreatment(treater) {
  const tgtId = treater.treatingTarget;
  const tgt = tgtId != null ? unitById(tgtId) : null;
  if (!tgt) { treater.treatmentType = null; treater.treatingTarget = null; return; }
  const type = treater.treatmentType;
  const treatLoc = treater.treatmentLocation;   // 부위 (left_arm 등)
  // medical part key 매핑
  const partKey = treatLoc ? resolveBodyPartKey(treatLoc, null) : null;
  const med = tgt.medical;

  // === 2B-0: wound/부위 처치 라우팅 (wound 데이터 있을 때 우선) ===
  if (med && med.wounds) {
    const handled = applyWoundOrPartTreatment(tgt, med, type, treatLoc, partKey, treater.treatmentWoundId, treater, treater.treatmentGroupId);
    if (handled) {
      treater.treatmentTimer = 0; treater.treatmentTotal = 0;
      treater.treatmentType = null; treater.treatmentLocation = null; treater.treatmentWoundId = null; treater.treatmentGroupId = null;
      if (tgt.beingTreatedBy === treater.id) tgt.beingTreatedBy = null;
      if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(tgt);
      if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(tgt);
      if (typeof MEDIC_OVERLAY !== 'undefined' && MEDIC_OVERLAY.open && typeof renderMedicOverlay === 'function') renderMedicOverlay();
      return;
    }
  }

  if (type === 'painkiller') {
    tgt.painkillerDelay = 6;
    tgt.painkillerDoseCount = (tgt.painkillerDoseCount || 0) + 1;
    tgt.painkillerCooldown = 25;
    // medical pain 즉시 감소 (6초 후 추가 감소는 기존 painkillerActive에서)
    if (med) med.pain = Math.max(0, med.pain - 15);
    const stackMsg = tgt.painkillerDoseCount > 1 ? ` (${tgt.painkillerDoseCount}회차)` : '';
    log(`[${tgt.name}] 진통제 투여${stackMsg} — 효과 발동 대기`, 'good');
  } else if (type === 'tourniquet') {
    tgt.tourniquetActive = true;
    tgt.tourniquetLoc = treatLoc || tgt.bleedingLoc;
    tgt.tourniquetAppliedAt = GAME.gameTime || 0;
    // medical 부위 지혈대 적용 — externalBleedRate 즉시 0
    if (med && partKey && med.bodyParts[partKey]) {
      med.bodyParts[partKey].tourniquetApplied = true;
      med.bodyParts[partKey].externalBleedRate = 0;
    }
    if (med) med.pain = Math.min(100, med.pain + 8);
    log(`[${tgt.name}] 지혈대 적용 — 사지 출혈 통제`, 'good');
  } else if (type === 'remove_tourniquet') {
    const bld = tgt.bleeding;
    const wasActive = tgt.tourniquetActive;
    tgt.tourniquetActive = false;
    tgt.tourniquetLoc = null;
    tgt.tourniquetAppliedAt = 0;
    // medical 모든 사지 지혈대 해제 (간단히)
    if (med) {
      for (const k of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
        if (med.bodyParts[k]) {
          if (med.bodyParts[k].tourniquetApplied) {
            med.bodyParts[k].tourniquetApplied = false;
            // 재출혈 가능 (medium 수준)
            if (med.bodyParts[k].hp < med.bodyParts[k].maxHp * 0.7) {
              med.bodyParts[k].externalBleedRate += 15;
            }
          }
        }
      }
    }
    if (!wasActive) log(`[${tgt.name}] 지혈대 해제 (적용 없음)`, 'info');
    else if (bld === 'none') log(`[${tgt.name}] 지혈대 해제 — 출혈 없음, 안전`, 'good');
    else log(`[${tgt.name}] 지혈대 해제 — 재출혈 가능`, 'warn');
  } else if (type === 'bandage') {
    // medical 부위 붕대 — 1회성 효과 (즉시 외부출혈 감소)
    //   light/medium은 거의 정지, severe는 일부 완화
    if (med && partKey && med.bodyParts[partKey]) {
      const part = med.bodyParts[partKey];
      part.bandageApplied = true;
      const cur = part.externalBleedRate;
      if (cur < 8) {
        // light/medium — 거의 정지 (90% 감소)
        part.externalBleedRate = cur * 0.10;
      } else if (cur < 25) {
        // severe — 60% 감소 (붕대만으론 완전 정지 X, 안정화 중심)
        part.externalBleedRate = cur * 0.40;
      } else {
        // critical — 30% 감소 (지혈대나 고급 지혈제가 필요)
        part.externalBleedRate = cur * 0.70;
      }
    }
    // legacy 호환 — bleeding tag 한 단계 완화
    const ranks = ['none','light','heavy','critical'];
    const cur = ranks.indexOf(tgt.bleeding);
    if (cur > 0) {
      tgt.bleeding = ranks[cur - 1];
      if (cur - 1 === 0) { tgt.bleedingLoc = null; tgt.bleedingTime = 0; }
    }
    log(`[${tgt.name}] 붕대 적용 — 출혈 통제`, 'good');
  } else if (type === 'splint') {
    tgt.splintApplied = true;
    // medical fracture 처리 — TRAUMA-REFINE-1 §6: 골절 안정화/기능 일부 회복만. 출혈·내부출혈에는 절대 무효.
    if (med && partKey && med.bodyParts[partKey]) {
      const _sp = med.bodyParts[partKey];
      _sp.splinted = true;
      // PART-DESTRUCTION-1 Phase5 §10: 부목은 골절 안정화로 기능 일부 회복하되 destruction functionalCap을 넘지 못함.
      //   destroyed/traumatic_amputation/mangled 상태는 0.6으로 올리지 않는다.
      const _pd = med.partDestruction && med.partDestruction[partKey];
      const _cap = (_pd && _pd.functionalCap != null) ? _pd.functionalCap : (_sp.destructionFunctionalCap != null ? _sp.destructionFunctionalCap : 1.0);
      _sp.functionRatio = Math.min(_cap, Math.max(_sp.functionRatio, 0.6));
      recomputeBodyPartFunctionRatio(_sp, _pd);   // 상태 기반 상한 재적용 (mangled≤0.20 등)
    }
    // §7 작업 D: part-level 처치 상태 (wound treatmentState와 분리). 키는 출혈계산과 동일 체계(snake: left_leg 등).
    if (med) {
      const _pk = treatLoc || partKey;
      if (_pk) {
        med.bodyPartTreatments[_pk] = med.bodyPartTreatments[_pk] || {};
        med.bodyPartTreatments[_pk].splint = { active: true, appliedAt: (typeof GAME !== 'undefined' && GAME.gameTime) || 0, appliedBy: treater ? treater.id : null };
      }
    }
    log(`[${tgt.name}] 부목 적용 — 골절 안정화 · 이동/조준 패널티 완화 (출혈 치료 아님)`, 'good');
  } else if (type === 'chestseal') {
    // 흉부 씰 — 1회성: breathing 회복 + breathing 안정화 플래그
    //   internalBleedRate를 직접 멈추지 않음 (그것은 수혈/외과 영역)
    if (med && med.bodyParts.chest) {
      med.bodyParts.chest.chestSealed = true;
      med.breathingEfficiency = Math.min(100, med.breathingEfficiency + 25);
      // 흉부 추가 breathing 악화 일부 완화 — medical에 플래그
      med.chestStabilized = true;
    }
    log(`[${tgt.name}] 흉부 씰 적용 — 호흡 회복`, 'good');
  } else if (type === 'shockcare' || type === 'stabilizer') {
    tgt.stabilized = true;
    tgt.shockCareApplied = true;
    // medical shock 즉시 감소 + consciousness 회복
    if (med) {
      med.shock = Math.max(0, med.shock - 25);
      med.consciousness = Math.min(100, med.consciousness + 15);
      // 2A-6.4 마감: shockcare → stressResponse 약한 안정 효과 (출혈/혈액량/혈압은 직접 건드리지 않음)
      //   panic / postCombatCrash를 아주 약하게 완화 (보조 안정화). 매우 보수적.
      if (med.stressResponse) {
        med.stressResponse.panic = Math.max(0, med.stressResponse.panic - 0.10);
        med.stressResponse.postCombatCrash = Math.max(0, med.stressResponse.postCombatCrash - 0.08);
        med.stressResponse.sympatheticTone = Math.max(0, med.stressResponse.sympatheticTone - 0.05);
      }
    }
    log(`[${tgt.name}] 쇼크 관리 완료 — 악화 지연`, 'good');
    // 의식 회복 판정 — heavy bleeding 없고, head/chest 치명 아님
    if (!tgt.isDead && tgt.isDowned && !tgt.conscious) {
      const headCritical = (med && med.bodyParts.head.hp <= 5);
      const chestCritical = (med && med.bodyParts.chest.hp <= 5);
      const heavyBleeding = (tgt.bleeding === 'heavy' || tgt.bleeding === 'critical') && !tgt.tourniquetActive;
      const hpLow = (tgt.hp <= 20);
      let recoveryChance = 0.45;
      if (heavyBleeding) recoveryChance -= 0.30;
      if (headCritical)  recoveryChance -= 0.30;
      if (chestCritical) recoveryChance -= 0.20;
      if (hpLow)         recoveryChance -= 0.20;
      if (tgt.bleeding === 'none' || tgt.tourniquetActive) recoveryChance += 0.15;
      recoveryChance = Math.max(0.05, Math.min(0.85, recoveryChance));
      if (Math.random() < recoveryChance) {
        tgt.conscious = true;
        log(`[${tgt.name}] 의식 회복`, 'good');
      } else {
        log(`[${tgt.name}] 의식 회복 실패 — 상태 불안정`, 'warn');
      }
    }
  } else if (type === 'chestseal') {
    tgt.chestSealApplied = true;
    log(`[${tgt.name}] 체스트 씰 적용 — 흉부 상태 완화`, 'good');
  }
  if (tgt.beingTreatedBy === treater.id) tgt.beingTreatedBy = null;
  treater.treatmentTimer = 0;
  treater.treatmentTotal = 0;
  treater.treatmentType = null;
  treater.treatingTarget = null;
}

// === 끌고가기 ===
function startDragging(carrier, target) {
  if (!carrier || !target) return false;
  if (target.isDead) { log(`[${carrier.name}] 끌기 실패 — 사망자`, 'warn'); return false; }
  if (!target.isDowned) { log(`[${carrier.name}] 끌기 실패 — 대상이 쓰러져 있지 않음`, 'warn'); return false; }
  if (carrier.draggingTarget != null) { log(`[${carrier.name}] 이미 다른 대원 끌고 있음`, 'warn'); return false; }
  if (target.draggedBy != null) { log(`[${carrier.name}] ${target.name} 다른 대원이 끌고 있음`, 'warn'); return false; }
  const d = Math.hypot(carrier.x - target.x, carrier.y - target.y);
  if (pxToM(d) > 2.0) { log(`[${carrier.name}] 끌기 실패 — ${pxToM(d).toFixed(1)}m 접근 필요 (2m 이내)`, 'warn'); return false; }   // SIDE-METRIC-SCALE-1
  if (carrier.isDowned) { log(`[${carrier.name}] 끌기 실패 — 본인도 쓰러짐`, 'warn'); return false; }
  carrier.draggingTarget = target.id;
  target.draggedBy = carrier.id;
  // 진행 중 처치/사격 중단
  cancelTreatment(carrier, '끌기 시작');
  carrier.shotQueue = null;
  log(`[${carrier.name}] → ${target.name} 끌고가기 시작`, 'info');
  return true;
}

function stopDragging(carrier) {
  if (!carrier || carrier.draggingTarget == null) return;
  const tgt = unitById(carrier.draggingTarget);
  if (tgt && tgt.draggedBy === carrier.id) tgt.draggedBy = null;
  log(`[${carrier.name}] 끌기 중단`, 'info');
  carrier.draggingTarget = null;
}

// 일어나기 시도 — downed → wounded 전환
// =============================================================
// 보류 의료/끌기 — 범위 밖 클릭 시 자동 접근 후 실행
// =============================================================
function setPendingMedic(carrier, opts) {
  // opts: { type:'treat'|'drag', targetId, treatType?, location? }
  if (!carrier) return false;
  const target = unitById(opts.targetId);
  if (!target) return false;
  carrier.pendingMedic = Object.assign({}, opts);
  // 이동 명령 — 표적 근처로
  if (carrier.id !== target.id) {
    issueMoveOrder(carrier, target.x, target.y, { source: 'medical', actionType: 'medicApproach' });
  }
  const typeKor = opts.type === 'drag' ? '끌기'
                : { painkiller:'진통제', tourniquet:'지혈대', remove_tourniquet:'지혈대 해제',
                    bandage:'붕대', splint:'부목', shockcare:'쇼크 관리', chestseal:'체스트 씰' }[opts.treatType] || opts.treatType;
  log(`[${carrier.name}] ${target.name}에게 접근 → ${typeKor} 예약`, 'info');
  return true;
}

function clearPendingMedic(carrier, reason) {
  if (!carrier || !carrier.pendingMedic) return;
  if (reason) log(`[${carrier.name}] 의료 예약 취소 — ${reason}`, 'warn');
  carrier.pendingMedic = null;
}

function tickPendingMedic(carrier) {
  if (!carrier || !carrier.pendingMedic) return;
  if (!carrier.alive || carrier.isDowned) { clearPendingMedic(carrier, '처치자 무력화'); return; }
  if (carrier.treatmentTimer > 0) return;   // 이미 처치 중
  if (carrier.draggingTarget != null) return;
  const opts = carrier.pendingMedic;
  const target = unitById(opts.targetId);
  if (!target || target.isDead) { clearPendingMedic(carrier, '대상 사망 또는 소실'); return; }
  // 거리 체크
  const d = Math.hypot(carrier.x - target.x, carrier.y - target.y);
  if (pxToM(d) > 2.0) return;   // 아직 접근 중 — 다음 tick (SIDE-METRIC-SCALE-1: 2m)
  // 범위 내 도착 — 실행
  if (opts.type === 'drag') {
    if (startDragging(carrier, target)) {
      carrier.pendingMedic = null;
    } else {
      clearPendingMedic(carrier, '끌기 시작 실패');
    }
  } else if (opts.type === 'treat') {
    if (startTreatment(carrier, target, opts.treatType, { location: opts.location, woundId: opts.woundId, groupId: opts.groupId, clusterCount: opts.clusterCount })) {
      // 처치 시작됨 — 이동 명령 멈춤
      carrier.movePath = [];
      carrier.pendingMedic = null;
    } else {
      clearPendingMedic(carrier, '처치 시작 실패');
    }
  }
}

// 이동 명령 헬퍼 — pendingMedic 시 사용
// ════════════════════════════════════════════════════════════════════════════
