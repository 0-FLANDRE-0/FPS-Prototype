// PHASE 3-D: draft에서 계산한 fractureEvidence를 commit된 wound → bodyPart에 반영 (adapter 사용)
function applyFractureEvidenceToBodyPart(unit, w) {
  const fe = w && w.fractureEvidence;
  if (!fe || !fe.occurred) return;
  const _p = getMedicalBodyPart(unit && unit.medical, w.partKey);
  if (!_p) return;
  if (!_p.fracture) _p.fracture = true;
  _p.fractureType = fe.fractureType;
  _p.boneZone = fe.boneZone;
  recomputeBodyPartFunctionRatio(_p, unit.medical.partDestruction && unit.medical.partDestruction[w.partKey]);
}
// ════════════════════════════════════════════════════════════════════════════
// 대형 PHASE 3 — canonical wound orchestrator. 외부 호출자는 이 진입점만 사용한다.
//   A입력정규화 → B draft → C commit → D골절동기화 → E cluster → F partDestruction
//   → G vascular보강 → H bleeding 단일 finalize → I 후속모델 → J shotgun governor
//   → K cluster refresh → L prune/정리 → M invariant(strict)
// ════════════════════════════════════════════════════════════════════════════
function processWoundEvent(unit, ev) {
  if (!unit || !unit.medical) return null;
  const m = unit.medical;
  if (!m.wounds) m.wounds = [];
  // A. 입력 정규화 + 중복 event guard
  if (ev && ev._woundEventProcessed) return ev._woundEventProcessedWound || null;
  const ctx = {
    eventId: (ev && ev.eventId != null) ? ev.eventId : ((typeof GAME !== 'undefined') ? (GAME._woundEventSeq = (GAME._woundEventSeq || 0) + 1) : null),
    unitId: unit.id, stage: 'A_normalize',
    canonicalPartKey: normalizeAnatomicalPartKey(ev && ev.partKey, { ctx: 'processWoundEvent' }),
    partKey: ev && ev.partKey, pelletGroupId: (ev && ev.pelletGroupId) || null,
    woundId: null, clusterId: null,
  };
  // B. 순수 wound draft (unit 상태 변경 없음)
  ctx.stage = 'B_draft';
  const w = buildWoundDescriptor(unit, ev);
  if (!w) return null;
  ctx.woundId = w.id;
  // C. 단일 commit
  ctx.stage = 'C_commit';
  if (w.id != null && m.wounds.some(x => x && x.id === w.id)) {
    _woundPipelineError('C_commit', ctx, new Error('duplicate wound commit: ' + w.id));
    return w;
  }
  m.wounds.push(w);
  if (ev) { ev._woundEventProcessed = true; ev._woundEventProcessedWound = w; }
  try {
    // D. 골절 → bodyPart 동기화 (기능률 갱신 포함)
    ctx.stage = 'D_fracture_sync';
    applyFractureEvidenceToBodyPart(unit, w);
    // E. treatment cluster 연결
    ctx.stage = 'E_cluster_assign';
    const cluster = assignWoundToTreatmentCluster(unit, w, ev);
    if (cluster) { w.treatmentClusterId = cluster.id; ctx.clusterId = cluster.id; }
    // F. 누적외상 / partDestruction (wound + cluster 등록 이후에만)
    ctx.stage = 'F_partDestruction';
    const _seed = w._pendingPartDestructionCtx || {};
    const bodyDmgForDestruction = Number.isFinite(_seed.bodyDmg) ? _seed.bodyDmg
      : ((ev && ev._immediatePhysiology && Number.isFinite(ev._immediatePhysiology.bodyDmg)) ? ev._immediatePhysiology.bodyDmg : 0);
    w.partDestructionEvidence = updatePartDestructionFromWound(unit, w, ev, {
      bodyDmg: bodyDmgForDestruction, partKey: w.partKey, bodyPart: getMedicalBodyPart(m, w.partKey),
      pelletGroupId: w.pelletGroupId || null, shotgunPellet: !!w.shotgunPellet, sourceType: w.sourceType, armorResult: w.armorResult,
    });
    // G. vascular evidence 최종 보강 (fracture/partDestruction만으로 confirmed 금지 — helper 원칙)
    ctx.stage = 'G_vascular_final';
    reinforceVascularEvidenceWithPartDestruction(unit, w);
    // H. bleeding 단일 finalization
    ctx.stage = 'H_bleeding_finalize';
    if (w.bleedingProfile) finalizeBleedingProfileWithEvidence(w);
    // I. 후속 의료 모델 — 최종 evidence 기준 fieldCare / treatmentProfile / tissue 동기화
    ctx.stage = 'I_post_models';
    if (w.bleedingProfile) {
      w.bleedingProfile.tourniquetEligible = w.bleedingProfile.tourniquetEligible && (w.bleedingProfile.bleedingType === 'external' || w.bleedingProfile.bleedingType === 'junctional');
      if (typeof computeFieldCare === 'function') {
        const _fc = computeFieldCare(ev, w.woundType, w.woundSize, w.bleedingProfile);
        w.fieldCare = { fieldCareClass: _fc };
        if (typeof computeTreatmentProfile === 'function') w.treatmentProfile = computeTreatmentProfile(ev, w.woundType, w.bleedingProfile, _fc);
      }
    }
    if (w.tissueProfile) {
      w.tissueProfile.vesselRisk = w.bleedingProfile ? w.bleedingProfile.vesselRisk : w.tissueProfile.vesselRisk;
      w.tissueProfile.boneRisk = (w.fractureEvidence && w.fractureEvidence.occurred) ? 1 : w.tissueProfile.boneRisk;
    }
    // J. shotgun group governor (idempotent, finalize 이후 — 과거 결과 위 반복 곱셈 금지)
    ctx.stage = 'J_shotgun_governor';
    if (w.pelletGroupId) { normalizeShotgunPelletGroupBleeding(unit, w.pelletGroupId); normalizeShotgunPelletGroupPhysiology(unit, w.pelletGroupId); }
    // K. woundCluster 최종 refresh
    ctx.stage = 'K_cluster_refresh';
    if (w.treatmentClusterId && typeof refreshWoundCluster === 'function') refreshWoundCluster(unit, w.treatmentClusterId);
  } catch (e) {
    if (!e || !e._pipeline) _woundPipelineError(ctx.stage, ctx, e);
    _markMedicalInconsistent(unit, ctx.stage, { woundId: w.id, clusterId: ctx.clusterId, eventId: ctx.eventId, error: e && e.message });
    if (typeof GAME !== 'undefined' && GAME.debugStrictPipeline) throw e;
  }
  // L. pruning + 참조 정리 (모든 계산과 cluster refresh 이후 마지막)
  try {
    ctx.stage = 'L_prune';
    const removedWoundIds = _pruneWoundsWithRemovedIds(m.wounds, 60, w && w.id);
    if (removedWoundIds && removedWoundIds.length) cleanupPrunedWoundReferences(unit, removedWoundIds);
  } catch (e) {
    if (!e || !e._pipeline) _woundPipelineError('L_prune', ctx, e);
    _markMedicalInconsistent(unit, 'L_prune', { error: e && e.message });
    if (typeof GAME !== 'undefined' && GAME.debugStrictPipeline) throw e;
  }
  // M. invariant 검증 (debug/strict)
  if (typeof GAME !== 'undefined' && GAME.debugStrictPipeline) { ctx.stage = 'M_invariants'; validateWoundPipelineInvariants(unit); }
  return w;
}
// canonical alias — 기존 호출자 호환. PRODUCTION WOUND PATH 진입점은 processWoundEvent.
function recordWoundFromDamageEvent(unit, ev) { return processWoundEvent(unit, ev); }
// 제거된 wound id 목록을 반환하는 prune (protectId는 이번 tick 새 wound — 절대 제거 안 함)
function _pruneWoundsWithRemovedIds(arr, cap, protectId) {
  const removed = [];
  while (arr.length > cap) {
    let removeIdx = -1, worstScore = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const w = arr[i];
      if (protectId != null && w && w.id === protectId) continue;   // 새 wound 보호
      const bp = w.bleedingProfile || {};
      // 낮을수록 먼저 제거 (경미/안정/무출혈 우선). 치명·미처치 출혈은 보존.
      let score = 0;
      score += (bp.currentExternal || 0) * 2 + (bp.currentInternal || 0) * 2.5;
      score += (bp.sustainedExternal || 0) * 1.5;
      if (bp.majorVesselLocked) score += 100;
      if (w.severity) score += (w.severity || 0) * 0.2;
      const st = w.treatmentState || {};
      const untreated = !(st.bandaged || st.packed || st.tourniquetApplied || st.hemostaticApplied);
      if (untreated && (bp.currentExternal || 0) > 0) score += 30;   // 미처치 출혈 보존
      const pds = w.partDestructionEvidence && w.partDestructionEvidence.partDestructionStateAfter;
      if (pds && pds !== 'intact' && pds !== 'damaged') score += 40;   // 부위파괴 근거 wound 보존
      if (score < worstScore) { worstScore = score; removeIdx = i; }
    }
    if (removeIdx < 0) break;   // 모두 보호됨
    const rem = arr.splice(removeIdx, 1)[0];
    if (rem && rem.id != null) removed.push(rem.id);
  }
  return removed;
}
// prune로 제거된 wound id를 cluster / partDestruction 참조에서 정리
function cleanupPrunedWoundReferences(unit, removedIds) {
  if (!unit || !unit.medical || !removedIds || !removedIds.length) return;
  const m = unit.medical;
  const rmSet = new Set(removedIds);
  const touchedClusters = new Set();
  const touchedParts = new Set();
  // woundClusters.sourceWoundIds
  if (m.woundClusters) {
    for (const cid in m.woundClusters) {
      const cl = m.woundClusters[cid];
      if (!cl || !cl.sourceWoundIds) continue;
      const before = cl.sourceWoundIds.length;
      cl.sourceWoundIds = cl.sourceWoundIds.filter(id => !rmSet.has(id));
      if (cl.sourceWoundIds.length !== before) touchedClusters.add(cid);
    }
  }
  // partDestruction.sourceWoundIds + localClusters[*].woundIds
  if (m.partDestruction) {
    for (const pk in m.partDestruction) {
      const pd = m.partDestruction[pk];
      if (!pd) continue;
      let touched = false;
      if (pd.sourceWoundIds) {
        const before = pd.sourceWoundIds.length;
        pd.sourceWoundIds = pd.sourceWoundIds.filter(id => !rmSet.has(id));
        if (pd.sourceWoundIds.length !== before) touched = true;
      }
      if (pd.localClusters) {
        for (const lk in pd.localClusters) {
          const lc = pd.localClusters[lk];
          if (lc && lc.woundIds) {
            const before = lc.woundIds.length;
            lc.woundIds = lc.woundIds.filter(id => !rmSet.has(id));
            if (lc.woundIds.length !== before) touched = true;
          }
        }
      }
      if (touched) touchedParts.add(pk);
    }
  }
  // 참조 정리된 cluster / part 재계산
  for (const cid of touchedClusters) { if (typeof refreshWoundCluster === 'function') refreshWoundCluster(unit, cid); }
  for (const pk of touchedParts) {
    if (typeof refreshPartDestructionState === 'function') refreshPartDestructionState(unit, pk, {});
    if (typeof applyPartDestructionEffects === 'function') applyPartDestructionEffects(unit, pk);
  }
  // 대형 PHASE 3-L: 빈 active cluster 삭제 + 관련 참조(_activeGen/partDestruction.sourceClusterIds/localCluster.clusterIds) 정리.
  //   pruning은 기록 압축 — cumulativeTraumaScore/partDestruction state/functionalCap은 유지된다.
  const deletedClusters = [];
  if (m.woundClusters) for (const cid of Object.keys(m.woundClusters)) {
    const cl = m.woundClusters[cid];
    if (cl && (!cl.sourceWoundIds || cl.sourceWoundIds.length === 0)) { deletedClusters.push(cid); delete m.woundClusters[cid]; }
  }
  if (deletedClusters.length) {
    const dset = new Set(deletedClusters);
    if (m._activeWoundClusterGen) for (const base of Object.keys(m._activeWoundClusterGen)) { if (dset.has(m._activeWoundClusterGen[base])) delete m._activeWoundClusterGen[base]; }
    if (m.partDestruction) for (const pk in m.partDestruction) {
      const pd = m.partDestruction[pk]; if (!pd) continue;
      if (pd.sourceClusterIds) pd.sourceClusterIds = pd.sourceClusterIds.filter(id => !dset.has(id));
      if (pd.localClusters) for (const lk in pd.localClusters) { const lc = pd.localClusters[lk]; if (lc && lc.clusterIds) lc.clusterIds = lc.clusterIds.filter(id => !dset.has(id)); }
    }
  }
}
// 상한 초과 시 경미/안정/무출혈 wound 우선 제거 (치명/미처치 출혈/현장처치 제한 wound는 보존)
function _pruneWounds(arr, cap) {
  while (arr.length > cap) {
    let removeIdx = -1, worstScore = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const w = arr[i];
      const bp = w.bleedingProfile || {};
      const ts = w.treatmentState || {};
      const treated = ts.pressureBandaged || ts.packed || ts.hemostaticApplied || ts.chestSealed || ts.stabilized;
      const noBleed = (bp.bleedingType === 'none') || ((w._effExternal != null ? w._effExternal : bp.currentExternal) < 0.4);
      const minor = (w.woundSize && (w.woundSize.sizeClass === 'micro' || w.woundSize.sizeClass === 'small'));
      const protectedW = (bp.bleedingType === 'cavity' || bp.bleedingType === 'junctional' ||
                          (w.fieldCare && (w.fieldCare.fieldCareClass === 'field_unmanageable' || w.fieldCare.fieldCareClass === 'limited')) ||
                          (w.woundSize && (w.woundSize.sizeClass === 'large' || w.woundSize.sizeClass === 'massive')));
      // 제거 우선순위 점수 — 낮을수록 먼저 제거
      let sc = 0;
      if (protectedW) sc += 10000;        // 보호 — 거의 제거 안 함
      if (treated) sc -= 50;
      if (noBleed) sc -= 40;
      if (minor) sc -= 30;
      sc += (bp.currentExternal || 0) * 5; // 출혈 클수록 보존
      sc += (w.createdAt || 0) * 0.001;    // 오래된 것 약간 우선 제거
      if (sc < worstScore) { worstScore = sc; removeIdx = i; }
    }
    if (removeIdx < 0) removeIdx = 0;
    arr.splice(removeIdx, 1);
  }
}

// === UI 라벨 (render 시점 최신 상태 기반) ===
function _bleedLabelKo(wound) {
  const bp = wound.bleedingProfile;
  if (!bp || bp.bleedingType === 'none') return '출혈 없음';
  const ts = wound.treatmentState || {};
  // 지혈대 억제 우선
  if (wound._tourniquetSuppressed) return '지혈대 억제';
  // 압박붕대 안정화 상태
  if (ts.pressureBandaged) {
    const eff = (wound._effExternal != null) ? wound._effExternal : bp.currentExternal;
    const stab = ts.pressureBandageStabilization || 0;
    if (bp.bleedingType === 'cavity') return '체강출혈(외부 억제)';
    if (eff < 0.4) return '출혈 거의 중단';
    if (bp.bleedingType === 'junctional' || wound.woundSize.sizeClass === 'large' || wound.woundSize.sizeClass === 'massive') {
      return stab > 0.6 ? '잔여 출혈 지속 / 후속 처치 필요' : '출혈 크게 억제';
    }
    if (stab < 0.35) return '출혈 크게 억제';
    return '출혈 감소 중';
  }
  const ext = (wound._effExternal != null) ? wound._effExternal : (bp.currentExternal || 0);
  if (bp.bleedingType === 'cavity') return '체강출혈';
  if (bp.bleedingType === 'junctional') return '접합부 출혈';
  if (bp.bleedingType === 'internal') return '내부출혈 의심';
  if (ext > 18) return '치명적 출혈';
  if (ext > 8) return '출혈 중';
  if (ext > 0.5) return '약한 출혈';
  return '출혈 없음';
}
function _treatLabelKo(wound) {
  const ts = wound.treatmentState || {};
  if (wound._tourniquetSuppressed && !ts.pressureBandaged && !ts.packed && !ts.hemostaticApplied) return '지혈대 억제 / 추가처치 필요';
  // SIDE-MED-2C-HOTFIX-1 §10: 적용된 처치 조합 표시 (placeholder 문구 제거)
  const applied = [];
  if (ts.packed) applied.push('패킹');
  if (ts.hemostaticApplied) applied.push('지혈거즈');
  if (ts.junctionalPressureApplied) applied.push('접합부압박');
  if (ts.pressureBandaged) applied.push('압박붕대');
  if (ts.chestSealed) applied.push('체스트씰');
  if (ts.abdominalDressed) applied.push('복부드레싱');
  if (applied.length >= 3) return '복합 처치';
  if (applied.length) return applied.join('+');
  if (ts.bandaged) return '붕대됨';
  if (ts.stabilized) return '안정';
  if (wound.bleedingProfile && wound.bleedingProfile.bleedingType === 'none') return '안정';
  return '미처치';
}
function buildWoundUiLabels(wound) {
  const sizeLabel = WOUND_SIZE_LABEL_KO[wound.woundSize.sizeClass] || '소형';
  const typeLabel = WOUND_TYPE_LABEL_KO[wound.woundType] || '상처';
  // HOTFIX-2 §4: 입구 / 내부 / 사출구 채널 라벨
  const ws = wound.woundSize || {};
  const SZ = (c) => WOUND_SIZE_LABEL_KO[c] || (c ? c : '—');
  const entryKo = SZ(ws.entrySizeClass || ws.sizeClass);
  const internalKo = SZ(ws.internalSizeClass || ws.sizeClass);
  let exitKo;
  if (wound.exitWoundPresent && wound.exitSizeClass) exitKo = SZ(wound.exitSizeClass);
  else if (wound.bodyTrajectory && wound.bodyTrajectory.retainedProjectile) exitKo = '체내 잔류';
  else exitKo = '없음';
  const channelLabel = `${entryKo} / ${internalKo} / ${exitKo}`;
  return {
    sizeLabel, typeLabel,
    combinedLabel: `${sizeLabel} / ${typeLabel}`,
    channelLabel,
    locationLabel: woundLocationLabelKo(wound),
    bleedingLabel: _bleedLabelKo(wound),
    treatmentLabel: _treatLabelKo(wound),
    fieldCareLabel: FIELD_CARE_LABEL_KO[wound.fieldCare.fieldCareClass] || '현장처치 가능',
    severityLabel: sizeLabel,
  };
}
function woundLocationLabelKo(wound) {
  const partKo = (typeof BODY_PART_KOR !== 'undefined' && BODY_PART_KOR[_medicalPartToLegacy(wound.partKey)]) || _woundPartKo(wound.partKey);
  const z = wound.location || wound.anatomicalZone;
  return z ? `${partKo}` : partKo;
}
function _woundPartKo(pk) {
  return ({ head:'머리', neck:'목', chest:'가슴', abdomen:'복부', leftArm:'좌상지', rightArm:'우상지', leftLeg:'좌하지', rightLeg:'우하지' })[pk] || pk;
}
function _medicalPartToLegacy(pk) {
  return ({ leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' })[pk] || pk;
}

// === 부위 전체 처치 (bodyPartTreatments) ===
function ensureBodyPartTreatments(m) {
  if (!m.bodyPartTreatments) m.bodyPartTreatments = {};
  return m.bodyPartTreatments;
}
function getBodyPartTreatment(m, partKey) {
  ensureBodyPartTreatments(m);
  if (!m.bodyPartTreatments[partKey]) m.bodyPartTreatments[partKey] = { tourniquet:null, splint:null, pelvicBinder:null };
  return m.bodyPartTreatments[partKey];
}

// === wound 기반 출혈 재계산 (§12) ===
// === CARDIAC-1R §8/§9: 박동성 출혈 modifier — bleedingProfile은 source-of-truth, 이건 effective rate 보정자 ===
//   외부출혈은 MAP/pulsePressure/heartRate/혈관수축에 제한적으로 유동. 체강 내부는 MAP 영향만(현장처치 무관).
//   chestseal/abdominal_dressing은 internalBleedRate를 절대 줄이지 않는다.
function buildBleedingPulseModel(unit, w, bp, extMul) {
  const m = unit.medical, hd = m.hemodynamics || {};
  const MAP = (hd.map != null) ? hd.map : 75, PP = (hd.pulsePressure != null) ? hd.pulsePressure : 40, HR = m.heartRate || 75;
  const vtone = (hd.vascularTone != null) ? hd.vascularTone : 1.0;
  const isJunctional = bp.bleedingType === 'junctional';
  const isCavity = bp.bleedingType === 'cavity';
  let majorVessel = false, arterial = false;
  const oim = w.organInjuryModel;
  if (oim && oim.injuries) for (const inj of oim.injuries) {
    if (/vessel|carotid_jugular/.test(inj.organ) && (inj.bleedRisk === 'high' || inj.bleedRisk === 'massive')) {
      if (inj.bleedRisk === 'massive') majorVessel = true;
      arterial = true;
    }
  }
  if (bp.tourniquetEligible && (bp.vesselRisk || 0) > 0.4) arterial = true;
  // §8.3 heartRate 영향 — 성격별 상한 clamp (soft 8%/venous-limb 12%/arterial·junctional 20%/major 25%)
  const hrCap = majorVessel ? 0.25 : (arterial || isJunctional) ? 0.20 : bp.tourniquetEligible ? 0.12 : 0.08;
  const hrNorm = clamp01((HR - 75) / 95);
  const heartRateInfluence = hrNorm * hrCap;
  // §8.2 pulsePressure 영향 — arterial/junctional 큼, venous/soft 작음
  const ppNorm = clamp01((PP - 40) / 40);
  const ppCap = (majorVessel || arterial || isJunctional) ? 0.18 : 0.05;
  const pulsePressureInfluence = ppNorm * ppCap;
  // §8.1 MAP 보정 — 높으면 분출↑, 낮으면 분출↓(상태는 나쁨, 치료 아님)
  const pressureModifier = clampMed(1 + ((MAP - 75) / 75) * 0.25, 0.6, 1.25);
  // §8.4 혈관수축 — 말초 external 일부 감소, cavity/major vessel은 큰 효과 없음
  let vascularToneModifier = 1.0;
  if (!isCavity && !majorVessel) vascularToneModifier = clampMed(1 - Math.max(0, vtone - 1.0) * 0.25, 0.8, 1.0);
  const pulseModifier = 1 + heartRateInfluence + pulsePressureInfluence;
  const extPulse = clampMed(pressureModifier * pulseModifier * vascularToneModifier, 0.5, 1.6);
  const intPulse = isCavity ? clampMed(pressureModifier, 0.7, 1.2) : clampMed(pressureModifier * (1 + pulsePressureInfluence * 0.5), 0.7, 1.3);
  const tags = [];
  if (arterial) tags.push('arterial_pulse');
  if (isJunctional) tags.push('junctional_pulse');
  if (heartRateInfluence > 0.1) tags.push('tachy_bleed');
  if (MAP < 60) tags.push('low_map_low_flow');
  if (vascularToneModifier < 0.95) tags.push('vasoconstriction_partial');
  if (isCavity) tags.push('cavity_uncontrolled');
  if (extMul != null && extMul <= 0.2 && bp.tourniquetEligible) tags.push('tourniquet_control');
  else if (extMul != null && extMul <= 0.35) tags.push('packing_control');
  const hcm = w.hemorrhageControlModel;
  if (hcm && (hcm.treatmentEffectLimit === 'not_field_controllable' || hcm.hemorrhageType === 'cavity_internal')) tags.push('field_care_limited');
  w.bleedingPulseModel = {
    pressureModifier: +pressureModifier.toFixed(3), pulseModifier: +pulseModifier.toFixed(3),
    vascularToneModifier: +vascularToneModifier.toFixed(3), heartRateInfluence: +heartRateInfluence.toFixed(3),
    pulsePressureInfluence: +pulsePressureInfluence.toFixed(3), treatmentSuppression: extMul != null ? +(1 - extMul).toFixed(3) : 0,
    tags,
  };
  return { extPulse, intPulse };
}
function updateMedicalBleedingWoundBased(unit, dt) {
  const m = unit.medical;
  ensureBodyPartTreatments(m);
  // 부위별 합산
  const partExt = {}, partInt = {};
  for (const k of BODY_PART_KEYS) { partExt[k] = 0; partInt[k] = 0; }
  for (const w of m.wounds) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    const pk = w.partKey;
    const ts = w.treatmentState || {};
    // ORGANIC-BLEED-1 Phase1 §6: 자연 지혈 — 대혈관/major organ confirmed(majorVesselLocked)가 아니면 sustained/naturalReductionTarget 쪽으로 서서히 감소.
    //   자연 감소는 완치가 아님(wound 유지, 재출혈 위험 유지). 움직임/shock/낮은 처치품질은 감소를 늦추거나 멈춤.
    const _locked = !!bp.majorVesselLocked;
    const _moving = !!(unit.isMoving || unit.beingDragged || unit._draggeeId);
    if (!_locked) {
      const _targetExt = (bp.naturalReductionTargetExternal != null) ? bp.naturalReductionTargetExternal
                       : (bp.sustainedExternal != null ? bp.sustainedExternal : bp.currentExternal);
      const _targetInt = (bp.naturalReductionTargetInternal != null) ? bp.naturalReductionTargetInternal
                       : (bp.sustainedInternal != null ? bp.sustainedInternal : bp.currentInternal);
      let _rate = (bp.selfReductionRate != null ? bp.selfReductionRate : 0.2);
      if (_moving) _rate *= 0.35;                                  // 움직임 → 감소 둔화
      if (m.shockState === 'decompensated' || (m.map != null && m.map < 55)) _rate *= 0.5;   // shock → 둔화
      // external: target 쪽으로 접근 (초과분만)
      if (bp.currentExternal != null && bp.currentExternal > _targetExt) {
        bp.currentExternal = Math.max(_targetExt, bp.currentExternal - _rate * dt);
      }
      // internal: cavity major는 위 target이 sustained라 거의 안 내려감. 그 외는 완만히.
      if (bp.currentInternal != null && bp.currentInternal > _targetInt) {
        const _intRate = _rate * 0.6;
        bp.currentInternal = Math.max(_targetInt, bp.currentInternal - _intRate * dt);
      }
    } else {
      // majorVesselLocked — 자연 감소 거의 없음 (아주 약한 clot만, external 극소량)
      if (bp.currentExternal != null && bp.bleedingType === 'external' && bp.currentExternal > (bp.sustainedExternal || 0)) {
        bp.currentExternal = Math.max(bp.sustainedExternal || 0, bp.currentExternal - 0.03 * dt);
      }
    }
    // legacy 미세 출혈 자연 지혈 (evidence 없는 아주 작은 외출혈)
    if (bp.currentExternal > 0 && bp.currentExternal < 2.0 && bp.naturalReductionTargetExternal == null) {
      bp.currentExternal = Math.max(0, bp.currentExternal - 0.02 * dt);
    }
    // === SIDE-MED-2C §25: 처치 modifier (외출혈) — 조합 보너스 포함, 체강 내부출혈은 현장처치로 감소 금지 ===
    let extMul = 1.0;
    const bleedT = bp.bleedingType;
    const isCavityBleed = (bleedT === 'cavity');
    const isJunctional = (bleedT === 'junctional');
    // hemostatic — external/muscle/junctional 접근 가능 성분 감소 (cavity 본체엔 외부 성분만)
    const hemoEff = ts.hemostaticApplied && (ts.hemostaticEffective !== false);
    // packing — junctional/deep muscle channel
    const packEff = ts.packed && (ts.packingEffective !== false);
    if (packEff && hemoEff) extMul *= 0.09;            // 조합: 패킹+지혈거즈 최강
    else if (packEff) extMul *= 0.14;
    else if (hemoEff) extMul *= 0.20;
    // pressure bandage — 단독/조합. packed/hemostatic 이후 추가 안정화
    if (ts.pressureBandaged) {
      ts.pressureBandageStabilization = Math.min(1, (ts.pressureBandageStabilization || 0) + dt * 0.06);
      const initMul = (ts.pressureBandageInitialMul != null) ? ts.pressureBandageInitialMul : 0.15;
      const tgtMul = (ts.pressureBandageTargetMul != null) ? ts.pressureBandageTargetMul : 0.03;
      const stab = ts.pressureBandageStabilization;
      let pbMul = (initMul + (tgtMul - initMul) * stab);
      if (packEff || hemoEff) pbMul *= 0.6;            // 조합 시 추가 감소
      if (isJunctional) pbMul = Math.min(1, pbMul * 1.8);   // 접합부 단독 효과 제한
      extMul *= pbMul;
    }
    else if (ts.bandaged && !packEff && !hemoEff) extMul *= 0.30;
    // junctional pressure — 접합부 외부 성분 일시 감소 (quality/유지 반영, 단독 완전정지 금지)
    if (ts.junctionalPressureApplied && isJunctional) {
      const jq = ts.junctionalPressureQuality || 0.6;
      const jpMul = ts.junctionalPressureMaintained ? (0.45 - jq * 0.2) : (0.7 - jq * 0.1);
      extMul *= Math.max(0.3, jpMul);                  // 단독으론 30% 바닥 (잔여 유지)
    }
    // abdominal dressing — external oozing 소폭만 (내부 무효)
    if (ts.abdominalDressed) extMul *= 0.85;
    // 부위 전체 지혈대 — limb external/muscle 강하게, junctional/cavity 제한/무효
    const bpt = m.bodyPartTreatments[pk];
    let tqSup = false;
    if (bpt && bpt.tourniquet) {
      const tq = bpt.tourniquet;
      if (bp.tourniquetEligible) {
        const eff = (tq.quality === 'good') ? 0.90 : (tq.quality === 'poor') ? 0.62 : 0.85;
        extMul *= (1 - eff);
        tqSup = true;
      } else if (isJunctional) {
        extMul *= 0.85;   // 접합부 — 지혈대 효과 낮음
      }
      // cavity/torso는 지혈대 무효 (multiplier 미적용)
    }
    w._tourniquetSuppressed = tqSup;
    // severe/critical / field_unmanageable wound는 잔여 출혈 바닥 유지 (완전 0 금지)
    const ibmW = w.internalBleedingModel;
    const hcm = w.hemorrhageControlModel;
    let extFloorMul = 0;
    if (hcm && (hcm.treatmentEffectLimit === 'partial_control_only')) extFloorMul = 0.12;
    else if (hcm && hcm.treatmentEffectLimit === 'temporary_stabilization') extFloorMul = 0.18;
    else if (hcm && hcm.treatmentEffectLimit === 'not_field_controllable') extFloorMul = 0.3;
    if (extFloorMul > 0) extMul = Math.max(extMul, extFloorMul);
    let effExt = bp.currentExternal * extMul;
    // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §8: confirmed_physiologic 외부 대혈관/장기 → external 가중 (처치 비례 감소 유지, clamp)
    {
      const pep = w.physiologicEffectProfile;
      if (pep && ((pep.externalBleedBoost || 0) > 0 || (pep.majorVesselMul || 1) > 1)) {
        let physExtMul = 1 + (pep.externalBleedBoost || 0) + Math.max(0, (pep.majorVesselMul || 1) - 1) * 0.6;
        effExt *= Math.min(2.4, physExtMul);
      }
    }
    let effInt = bp.currentInternal;
    // === PRECARDIAC-1 §4.1/§6: 장기/혈관 후보·혈흉 위험 기반 내부출혈 진행 보정 ===
    //   확정 파열이 아니라 "위험 보정"이다. bleedingProfile 원본은 불변, 합산 clamp ×1.35.
    //   처치는 이 값을 절대 줄이지 못한다 (위험 증가 전용 — cavity field-care 불변 원칙과 별개 축).
    if (effInt > 0) {
      let intRiskMul = 1.0;
      const oimW = w.organInjuryModel;
      if (oimW && oimW.injuries) {
        for (const inj of oimW.injuries) {
          const solid = (inj.organ === 'liver' || inj.organ === 'spleen' || inj.organ === 'kidney' || inj.organ === 'retroperitoneal_bleed' || inj.organ === 'pelvic_bleed');
          const vessel = /vessel|carotid_jugular/.test(inj.organ);
          if (!(solid || vessel)) continue;
          if (!(inj.bleedRisk === 'high' || inj.bleedRisk === 'massive')) continue;
          if (inj.status === 'confirmed_limited') intRiskMul *= 1.18;        // §6.1: confirmed_limited만 조금 더
          else if (inj.status === 'likely') intRiskMul *= 1.10;
          else if (inj.status === 'suspected' && vessel) intRiskMul *= 1.05; // 혈관 의심은 소폭
        }
      }
      const ctmW = w.chestTraumaModel;
      if (ctmW && (ctmW.hemothoraxRisk || 0) >= 0.45) intRiskMul *= 1.08;    // §7: 혈흉 — internal 약하게
      // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §8: confirmed_physiologic internal 가중 (중복 clamp — major/organ이면 상한 상향)
      let intCap = 1.35, physIntMul = 1.0;
      const pep = w.physiologicEffectProfile;
      if (pep) {
        physIntMul = 1 + (pep.internalBleedBoost || 0) + Math.max(0, (pep.majorVesselMul || 1) - 1) * 0.4;
        const hasMajorOrOrgan = (w.physiologicInjuries || []).some(i => i.confirmedLevel === 'confirmed_physiologic' && (i.type === 'major_vessel_injury' || i.type === 'solid_organ_injury'));
        if (hasMajorOrOrgan) intCap = ((pep.majorVesselMul || 1) > 1.5) ? 2.0 : 1.7;
      }
      effInt *= Math.min(intCap, intRiskMul * physIntMul);
    }
    // === CARDIAC-1R §8: 박동성 보정 — effective rate에 MAP/HR/pulsePressure/혈관수축 제한 반영 ===
    const _beforeExt = effExt, _beforeInt = effInt;
    const pulse = buildBleedingPulseModel(unit, w, bp, extMul);
    effExt *= pulse.extPulse;
    effInt *= pulse.intPulse;   // cavity는 MAP 영향만 — 현장처치로는 불변(extMul/effInt 분리), chestseal/abdominal 무관
    // FIELD-STAB-1 §10/§11: pelvic_binder / junctional_control → 해당 wound EXTERNAL bleed만 제한적 완화.
    //   internal cavity bleed(effInt)는 절대 줄이지 않는다 (source-of-truth / 후송·수술 필요).
    const _fsm = unit.medical.fieldStabilizationModel;
    if (_fsm) {
      if (_fsm.pelvicControl && _fsm.pelvicControl.active && _woundIsPelvicRegion(w)) effExt *= _fsm.pelvicControl.pelvicBleedModifier;
      if (_fsm.junctionalControl && _fsm.junctionalControl.active && _woundIsJunctionalRegion(w)) effExt *= (1 - _fsm.junctionalControl.pulseSuppression);
      // RESIDUAL HOTFIX 4: pelvic_binder → pelvic_internal의 pulse amplification만 매우 약하게(≤~8%) 완화.
      //   effInt 기저는 직접 줄이지 않음(내부출혈 source 유지) · definitiveCare/surgery/vascular markers 불변 · 출혈 제거 아님(악화만 약하게 늦춤).
      if (_fsm.pelvicControl && _fsm.pelvicControl.active && (w.internalBleedingCategory === 'pelvic_internal') && _woundIsPelvicRegion(w)) {
        const _ip = pulse.intPulse;
        if (_ip > 1.0) { effInt *= ((1 + (_ip - 1) * 0.92) / _ip); }   // 박동 증폭 초과분의 ~8%만 완화
      }
    }
    if (w.bleedingPulseModel) {
      w.bleedingPulseModel.effectiveExternalBeforeClamp = +_beforeExt.toFixed(3);
      w.bleedingPulseModel.effectiveInternalBeforeClamp = +_beforeInt.toFixed(3);
      w.bleedingPulseModel.effectiveExternalAfterClamp = +Math.max(0, effExt).toFixed(3);
      w.bleedingPulseModel.effectiveInternalAfterClamp = +Math.max(0, effInt).toFixed(3);
    }
    // SIDE-MED-2C §25: 체강 내부출혈(effInt)은 현장처치(hemostatic/packing/pressure/abdominal/chestseal)로 감소시키지 않는다 — source-of-truth/수술·후송 필요.
    //   (이전의 packed+cavity 내부 감소는 directive 위반이므로 제거)
    w._effExternal = +Math.max(0, effExt).toFixed(3);     // §2: UI 라벨이 최신 effective rate 참조
    w._effInternal = +Math.max(0, effInt).toFixed(3);
    w._extMul = +extMul.toFixed(3);
    partExt[pk] = (partExt[pk] || 0) + Math.max(0, effExt);
    partInt[pk] = (partInt[pk] || 0) + Math.max(0, effInt);
  }
  let totalExt = 0, totalInt = 0;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (!p) continue;
    p.externalBleedRate = +(partExt[k] || 0).toFixed(3);
    p.internalBleedRate = +(partInt[k] || 0).toFixed(3);
    // legacy 호환 — bandage/tourniquet boolean 동기화
    const bpt = m.bodyPartTreatments[k];
    p.tourniquetApplied = !!(bpt && bpt.tourniquet);
    totalExt += p.externalBleedRate;
    totalInt += p.internalBleedRate;
  }
  if (isNaN(totalExt)) totalExt = 0; if (isNaN(totalInt)) totalInt = 0;
  m.externalBleedRate = Math.max(0, totalExt);
  m.internalBleedRate = Math.max(0, totalInt);
  const totalBleed = m.externalBleedRate + m.internalBleedRate;
  if (totalBleed > 0) m.bloodMl = Math.max(0, m.bloodMl - totalBleed * dt);
}

// === wound 목록 정렬 (§18) ===
function _woundUrgency(w) {
  const bp = w.bleedingProfile || {};
  let s = 0;
  if (bp.bleedingType === 'cavity' || bp.bleedingType === 'junctional') s += 1000;
  const eff = (w._effExternal != null) ? w._effExternal : (bp.currentExternal || 0);
  if (eff > 18) s += 900;
  if (w.fieldCare && w.fieldCare.fieldCareClass === 'field_unmanageable') s += 800;
  if (w.woundSize && w.woundSize.sizeClass === 'massive') s += 400;
  if (w._tourniquetSuppressed && !(w.treatmentState && w.treatmentState.pressureBandaged)) s += 300;
  if (w.woundSize && w.woundSize.sizeClass === 'large') s += 200;
  if (w.woundSize && w.woundSize.sizeClass === 'medium') s += 100;
  const ts = w.treatmentState || {};
  const treated = ts.pressureBandaged || ts.packed || ts.hemostaticApplied || ts.chestSealed || ts.stabilized;
  if (!treated && bp.bleedingType !== 'none') s += 60;
  if (w.woundType === 'bruise' || w.woundType === 'abrasion' || (w.woundSize && w.woundSize.sizeClass === 'micro')) s -= 50;
  s += eff;
  return s;
}
function sortWoundsByUrgency(wounds) {
  return wounds.slice().sort((a, b) => _woundUrgency(b) - _woundUrgency(a));
}
function getPartWounds(unit, partKey) {
  if (!unit.medical || !unit.medical.wounds) return [];
  return unit.medical.wounds.filter(w => w.partKey === partKey);
}

// === 2B-0-FINAL §12~17: 작은 파편상 클러스터링 ===
// SIDE-FRAGMENT-WOUND-CLUSTER-ADDRESS-1: 파편상 세부위치 클러스터 키 (우선순위 fallback)
// SIDE-FRAGMENT-CLUSTER-TRAIT-MATERIAL-SPALL-1: 정규화 (유사 세부위치 통합 — thigh 변형 → thigh 등)
function _normalizeWoundAddressClusterKey(key, w) {
  if (!key) return (w && w.partKey) || 'na';
  const k = key.toString();
  const kl = k.toLowerCase();
  if (/thigh/.test(kl)) return 'thigh';
  if (/upperarm/.test(kl)) return 'upper_arm';
  if (/forearm/.test(kl)) return 'forearm';
  if (/lowerleg|shin|calf/.test(kl)) return 'lower_leg';
  if (/foot|ankle/.test(kl)) return 'foot_ankle';
  if (/hand|wrist|palm/.test(kl)) return 'hand_wrist';
  if (/axilla|shouldergap|armshouldergap/.test(kl)) return 'axilla_shoulder_gap';
  if (/groin|inguinal|femoraltriangle|femoral/.test(kl)) return 'groin_junctional';
  if (/lateralthorax|sidewrap|sideedge|lateralgap|flank/.test(kl)) return 'lateral_thorax';
  if (/neck|throat/.test(kl)) return 'neck';
  if (/face|jaw|cheek|eye|orbital|nasal|brow|mouth|nose/.test(kl)) return 'face';
  if (/knee/.test(kl)) return 'knee';
  if (/elbow/.test(kl)) return 'elbow';
  if (/shoulder/.test(kl)) return 'shoulder';
  if (/skull|cranial|temporal|parietal|occipital|frontal/.test(kl)) return 'skull';
  return k;
}
function _woundAddressClusterKey(w) {
  const ia = w.impactAddress || {};
  const raw = ia.limbLocation || ia.subZone || ia.softLocation || ia.edgeLocation || ia.exposedLocation || ia.coverageZone || ia.zone || ia.anatomicalZone || w.partKey || 'na';
  return _normalizeWoundAddressClusterKey(raw, w);
}
const _NORM_ADDR_KO = { thigh:'허벅지', upper_arm:'상완', forearm:'전완', lower_leg:'하퇴', foot_ankle:'발/발목', hand_wrist:'손/손목',
  lateral_thorax:'측흉부', axilla_shoulder_gap:'겨드랑이/어깨', groin_junctional:'서혜부', neck:'경부', face:'안면', knee:'무릎', shoulder:'어깨', elbow:'팔꿈치', skull:'두개부' };
function _addressClusterKeyLabel(key) {
  if (!key) return '';
  if (_NORM_ADDR_KO[key]) return _NORM_ADDR_KO[key];
  if (typeof IA_LABELS === 'undefined') return key;
  return (IA_LABELS.limbLocation && IA_LABELS.limbLocation[key]) || (IA_LABELS.softLocation && IA_LABELS.softLocation[key])
      || (IA_LABELS.edgeLocation && IA_LABELS.edgeLocation[key]) || (IA_LABELS.coverageZone && IA_LABELS.coverageZone[key])
      || (IA_LABELS.anatomicalZone && IA_LABELS.anatomicalZone[key]) || (IA_LABELS.exposedLocation && IA_LABELS.exposedLocation[key]) || key;
}
// 고위험 세부위치 — 클러스터에 숨기면 안 되는 부위 (목/머리/서혜/액와/대혈관 인접)
// [삭제됨 — 대형 PHASE 8] _woundClusterHighRisk: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.
// [삭제됨 — 대형 PHASE 8] _woundClusterEligible: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.
// [삭제됨 — 대형 PHASE 8] _woundClusterSig: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.
// 대형 PHASE 5: groupId는 실제 medical.woundClusters의 cluster id — signature 재계산 금지.
function getClusterWounds(med, partKey, clusterId) {
  if (!med || !med.wounds) return [];
  const cl = med.woundClusters && med.woundClusters[clusterId];
  if (!cl) return [];
  const set = new Set(cl.sourceWoundIds || []);
  return med.wounds.filter(w => w && set.has(w.id) && (!partKey || w.partKey === partKey));
}
function _clusterRepLabel(ws, cl) {
  if (cl && cl.type === 'shotgun_pattern') return `산탄 펠릿 군집 ×${ws.length}`;
  if (cl && cl.type === 'flechette_pattern') return `플레셰트 군집 ×${ws.length}`;
  const w0 = ws[0];
  const isMinor = (w0.woundType === 'abrasion' || w0.woundType === 'bruise' || w0.woundType === 'blunt_trauma');
  const kindLabel = (cl && cl.type === 'same_area_multi_hit' && !/frag|spall|debris/.test(w0.sourceType || '')) ? '동일부위 다발상'
                  : isMinor ? (WOUND_TYPE_LABEL_KO[w0.woundType] || '경상') : '파편상';
  let micro = 0, small = 0, medium = 0;
  for (const w of ws) { const s = (w.woundSize ? w.woundSize.sizeClass : 'small'); if (s === 'medium') medium++; else if (s === 'small') small++; else micro++; }
  const parts = [];
  if (medium) parts.push(`중형 ${medium}`);
  if (small) parts.push(`소형 ${small}`);
  if (micro) parts.push(`초소형 ${micro}`);
  return `${kindLabel} 군집 ×${ws.length}` + (parts.length ? ` (${parts.join('·')})` : '');
}
function _clusterBleedSummary(ws) {
  let bleedCount = 0, supp = 0, totalExt = 0, severe = 0;
  for (const w of ws) {
    const eff = (w._effExternal != null) ? w._effExternal : ((w.bleedingProfile || {}).currentExternal || 0);
    if (w._tourniquetSuppressed) supp++;
    if (eff > 0.5) { bleedCount++; totalExt += eff; }
    if (eff > 8) severe++;
  }
  let label;
  if (bleedCount === 0) label = '출혈 없음';
  else if (totalExt / Math.max(1, bleedCount) > 8) label = `출혈 중 ${bleedCount}건`;
  else label = `약한 출혈 ${bleedCount}건`;
  if (supp > 0) label += ' · 지혈대 억제 포함';
  return { label, bleedCount, totalExt: +totalExt.toFixed(2), severe };
}
function _clusterTreatSummary(ws) {
  let treated = 0;
  for (const w of ws) { const ts = w.treatmentState || {}; if (ts.pressureBandaged || ts.stabilized || ts.bandaged) treated++; }
  const elig = ws.filter(w => (w.treatmentProfile && w.treatmentProfile.pressureBandageEligible) && !((w.treatmentState || {}).pressureBandaged)).length;
  let label;
  if (treated === 0) label = elig > 0 ? '미처치 · 일괄 압박붕대 가능' : '미처치';
  else if (treated >= ws.length) label = '안정';
  else label = `일부 처치됨 (${treated}/${ws.length})` + (elig > 0 ? ' · 추가처치 필요' : '');
  return { label, treated, eligible: elig };
}
function _buildSingleRow(w) {
  w.uiLabels = buildWoundUiLabels(w);                  // §2: 최신화
  return { type:'single', woundId: w.id, wound: w, urgencyScore: _woundUrgency(w) };
}
function _buildClusterRow(clusterId, ws, cl) {
  const bs = _clusterBleedSummary(ws);
  const tr = _clusterTreatSummary(ws);
  // fieldCare 요약
  let fc = 'treatable';
  for (const w of ws) { if (((w.fieldCare || {}).fieldCareClass) === 'controllable') fc = 'controllable'; }
  // 클러스터 urgency = 최대 개별 urgency * 0.6 (개별 치명보다 아래)
  let maxU = 0; for (const w of ws) maxU = Math.max(maxU, _woundUrgency(w));
  const urgency = (bs.bleedCount > 0 ? 40 : 5) + Math.min(50, maxU * 0.3);
  // SIDE-FRAGMENT-WOUND-CLUSTER-ADDRESS-1: 크기 분포 + 최대 fragmentEnergyJ / equivalentDamage + 세부위치
  let micro = 0, small = 0, medium = 0, maxEnergy = 0, maxEqDmg = 0, maxSharp = 0; const _spMats = {};
  for (const w of ws) {
    const s = (w.woundSize ? w.woundSize.sizeClass : 'small');
    if (s === 'medium') medium++; else if (s === 'small') small++; else micro++;
    if (w.fragmentEnergyJ != null && w.fragmentEnergyJ > maxEnergy) maxEnergy = w.fragmentEnergyJ;
    if (w.equivalentDamage != null && w.equivalentDamage > maxEqDmg) maxEqDmg = w.equivalentDamage;
    if (w.fragmentSharpness != null && w.fragmentSharpness > maxSharp) maxSharp = w.fragmentSharpness;
    if (w.spallMaterialType) _spMats[w.spallMaterialType] = 1;
  }
  const addrKey = _woundAddressClusterKey(ws[0]);
  const addrLabel = _addressClusterKeyLabel(addrKey);
  const partLabel = (typeof BODY_PART_KOR !== 'undefined' && BODY_PART_KOR[_medicalPartToLegacy(ws[0].partKey)]) || _woundPartKo(ws[0].partKey);
  const locLabel = partLabel + (addrLabel && addrLabel !== partLabel && addrLabel !== addrKey ? ` ${addrLabel}` : '');
  const _tcs = (cl && cl.treatmentClusterState) || {};
  return {
    type:'cluster', groupId: clusterId, wounds: ws, count: ws.length,
    clusterType: (cl && cl.type) || 'same_area_multi_hit',
    clusterRef: cl || null,
    aggregateBleeding: (cl && cl.aggregateBleeding) || null,
    clusterSeverity: (cl && cl.clusterSeverity) || 'minor',
    maxVascularEvidenceLevel: (cl && cl.maxVascularEvidenceLevel) || 'none',
    hasFracture: !!(cl && cl.hasFracture), fractureTypes: (cl && cl.fractureTypes) || [],
    treatmentSurfaceCost: (cl && cl.treatmentSurfaceCost) || 1,
    recommendedBandageUnits: (cl && cl.recommendedBandageUnits) || 1,
    remainingBandageUnits: (cl && cl.remainingBandageUnits != null) ? cl.remainingBandageUnits : ((cl && cl.recommendedBandageUnits) || 1),
    hemostaticUnits: (cl && cl.hemostaticUnits) || 0,
    clusterTreatmentState: _tcs.derivedState || 'untreated',
    clusterReopened: !!_tcs.reopened,
    representativeLabel: _clusterRepLabel(ws, cl),
    representativeLocation: locLabel,
    addressClusterKey: addrKey, addressLabel: addrLabel,
    sizeBreakdown: { micro, small, medium },
    maxFragmentEnergyJ: maxEnergy > 0 ? +maxEnergy.toFixed(1) : null,
    maxEquivalentDamage: maxEqDmg > 0 ? +maxEqDmg.toFixed(1) : null,
    maxFragmentSharpness: maxSharp > 0 ? +maxSharp.toFixed(2) : null,
    spallMaterialTypes: Object.keys(_spMats),
    bleedingSummary: bs.label, totalExternal: bs.totalExt,
    treatmentSummary: tr.label, treatedCount: tr.treated, eligibleCount: tr.eligible,
    fieldCareSummary: FIELD_CARE_LABEL_KO[fc] || '현장처치 가능', fieldCareClass: fc,
    urgencyScore: urgency,
  };
}
// 대형 PHASE 5: displayRows는 medical.woundClusters(실제 membership)에서만 도출한다.
//   접힘 규칙 — shotgun/flechette_pattern: 항상 / same_area_multi_hit·junctional·파편계: 2건 이상 / 그 외(단발·slug 등): 개별.
//   모든 active wound는 정확히 한 번(single 또는 cluster 아래) 표현된다.
function buildWoundDisplayRows(target, partKey) {
  const med = target && target.medical;
  const all = getPartWounds(target, partKey);
  const rows = [];
  const used = new Set();
  const clusters = (med && med.woundClusters) || {};
  for (const cid of Object.keys(clusters)) {
    const cl = clusters[cid];
    if (!cl || cl.partKey !== partKey) continue;
    const ws = getClusterWounds(med, partKey, cid);
    if (!ws.length) continue;
    const fragish = ws.every(w => /frag|spall|debris|blast_fragment/.test(w.sourceType || ''));
    const collapse = (cl.type === 'shotgun_pattern' || cl.type === 'flechette_pattern')
                  || (ws.length >= 2 && (cl.type === 'same_area_multi_hit' || cl.type === 'junctional_cluster' || fragish));
    if (!collapse) continue;
    for (const w of ws) used.add(w.id);
    rows.push(_buildClusterRow(cid, ws, cl));
  }
  for (const w of all) { if (!used.has(w.id)) rows.push(_buildSingleRow(w)); }
  rows.sort((a, b) => b.urgencyScore - a.urgencyScore);
  return rows;
}
// 대형 PHASE 5 invariant: 모든 active wound가 rows에 정확히 1회 표현 + groupId는 실제 cluster id.
function validateWoundUiProjection(target) {
  const errs = [];
  const med = target && target.medical; if (!med) return errs;
  for (const pk of Object.keys(med.bodyParts || {})) {
    const rows = buildWoundDisplayRows(target, pk);
    const seen = new Map();
    for (const r of rows) {
      if (r.type === 'cluster') {
        if (!(med.woundClusters && med.woundClusters[r.groupId])) errs.push({ k:'ui', msg:'가짜 cluster id: ' + r.groupId });
        if (med.woundClusters && med.woundClusters[r.groupId] && med.woundClusters[r.groupId].woundCount !== r.count) errs.push({ k:'ui', msg:'child 수 불일치: ' + r.groupId });
        for (const w of r.wounds) seen.set(w.id, (seen.get(w.id) || 0) + 1);
      } else seen.set(r.woundId, (seen.get(r.woundId) || 0) + 1);
    }
    const partWounds = getPartWounds(target, pk);
    for (const w of partWounds) {
      const n = seen.get(w.id) || 0;
      if (n !== 1) errs.push({ k:'ui', msg:`wound ${w.id} ${pk} 표현 ${n}회 (정확히 1회여야)` });
    }
  }
  return errs;
}

