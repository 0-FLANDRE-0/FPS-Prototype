// SHOTGUN-MED-NORM-1 §14: 같은 산탄 volley 펠릿 wound들의 총 외출혈에 aggregate soft ceiling.
//   펠릿은 개별 wound 유지. 근육 다중 puncture가 1200ml/s 되는 것 방지. major vessel confirmed는 완전 차단하지 않음.
//   idempotent — 항상 _preShotgunGroupExternal(원본) 기준으로 재-scale (중복 누적 방지).
function normalizeShotgunPelletGroupBleeding(unit, pelletGroupId) {
  if (!unit || !unit.medical || !unit.medical.wounds || !pelletGroupId) return;
  const group = unit.medical.wounds.filter(w => w && w.pelletGroupId === pelletGroupId && w.bleedingProfile);
  if (group.length <= 1) return;
  const ammoId = group[0].shotgunAmmoId || group[0].ammoId || '';
  const isFlechette = /flechette/.test(ammoId);
  const isBuckshot = /buck/.test(ammoId);
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  let bestLevel = 'none', confirmedMajor = false, probableMajor = false;
  for (const w of group) {
    const ve = w.vascularEvidence || {};
    if ((RANK[ve.level] || 0) > (RANK[bestLevel] || 0)) bestLevel = ve.level || bestLevel;
    if (ve.level === 'confirmed' && ve.vesselClass === 'major_named') confirmedMajor = true;
    if (ve.level === 'probable' && ve.vesselClass === 'major_named') probableMajor = true;
  }
  let sustainedCeiling, initialCeiling;
  if (isFlechette) {
    sustainedCeiling = confirmedMajor ? 30 : probableMajor ? 16 : bestLevel === 'candidate' ? 8 : 5.5;
    initialCeiling   = confirmedMajor ? 45 : probableMajor ? 26 : bestLevel === 'candidate' ? 16 : 10;
  } else if (isBuckshot) {
    sustainedCeiling = confirmedMajor ? 38 : probableMajor ? 22 : bestLevel === 'candidate' ? 14 : 10;
    initialCeiling   = confirmedMajor ? 55 : probableMajor ? 34 : bestLevel === 'candidate' ? 30 : 22;
  } else {
    return;   // buckshot/flechette 외 산탄은 governor 미적용
  }
  // idempotent: 원본값을 최초 1회만 저장, 이후 항상 원본 기준 재-scale
  for (const w of group) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    if (!bp._preShotgunGroupExternal) {
      bp._preShotgunGroupExternal = {
        sustainedExternal: bp.sustainedExternal || 0,
        initialExternal: (bp.initialExternal != null ? bp.initialExternal : (bp.currentExternal || 0)),
        currentExternal: bp.currentExternal || 0,
        naturalReductionTargetExternal: (bp.naturalReductionTargetExternal != null ? bp.naturalReductionTargetExternal : null),
      };
    }
  }
  const sumSustained = group.reduce((s, w) => s + Math.max(0, w.bleedingProfile._preShotgunGroupExternal.sustainedExternal || 0), 0);
  const sumInitial   = group.reduce((s, w) => s + Math.max(0, w.bleedingProfile._preShotgunGroupExternal.initialExternal || 0), 0);
  const sustainedScale = sumSustained > sustainedCeiling ? sustainedCeiling / Math.max(0.01, sumSustained) : 1;
  const initialScale   = sumInitial   > initialCeiling   ? initialCeiling   / Math.max(0.01, sumInitial)   : 1;
  for (const w of group) {
    const bp = w.bleedingProfile;
    if (!bp) continue;
    const orig = bp._preShotgunGroupExternal;
    // major vessel confirmed + locked wound은 완전히 죽이지 않음 (scale 하한 0.75)
    const sScale = (confirmedMajor && bp.majorVesselLocked) ? Math.max(sustainedScale, 0.75) : sustainedScale;
    const iScale = (confirmedMajor && bp.majorVesselLocked) ? Math.max(initialScale, 0.75)   : initialScale;
    bp.sustainedExternal = +(Math.max(0, orig.sustainedExternal) * sScale).toFixed(2);
    bp.initialExternal   = +(Math.max(0, orig.initialExternal)   * iScale).toFixed(2);
    bp.currentExternal   = +(Math.max(0, orig.currentExternal)   * iScale).toFixed(2);
    if (orig.naturalReductionTargetExternal != null) {
      bp.naturalReductionTargetExternal = +(orig.naturalReductionTargetExternal * sScale).toFixed(2);
    }
    bp.shotgunGroupScale = { sustainedScale:+sScale.toFixed(3), initialScale:+iScale.toFixed(3),
      groupSustainedCeiling:sustainedCeiling, groupInitialCeiling:initialCeiling };
  }
}

// SHOTGUN-PHYS-CLUSTER-1 Phase3 §7: 같은 volley 펠릿들의 즉시 shock/pain 총량 soft ceiling (출혈 governor와 별개).
//   major vessel confirmed / CNS / heart / severe thoracic는 높은 ceiling 허용. 단순 사지 다중 명중은 낮게.
//   중복 적용 방지: m._shotgunPhysiologyGroups[gid].applied
function normalizeShotgunPelletGroupPhysiology(unit, pelletGroupId) {
  if (!unit || !unit.medical || !unit.medical.wounds || !pelletGroupId) return;
  const m = unit.medical;
  const group = unit.medical.wounds.filter(w => w && w.pelletGroupId === pelletGroupId && w.immediatePhysiology);
  if (group.length <= 1) return;
  const ammoId = group[0].shotgunAmmoId || group[0].ammoId || '';
  const isFlechette = /flechette/.test(ammoId);
  const isBuckshot = /buck/.test(ammoId);
  if (!isFlechette && !isBuckshot) return;
  m._shotgunPhysiologyGroups = m._shotgunPhysiologyGroups || {};
  const prev = m._shotgunPhysiologyGroups[pelletGroupId];

  let torsoHits = 0, limbHits = 0, headNeckHits = 0;
  let maxVascularLevel = 'none', majorConfirmed = false, thoracicCritical = false, cnsCritical = false;
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  for (const w of group) {
    const part = (w.partKey || (w.immediatePhysiology && w.immediatePhysiology.partKey) || '').toLowerCase();
    if (/chest|abdomen/.test(part)) torsoHits++;
    else if (/head|neck/.test(part)) headNeckHits++;
    else limbHits++;
    const ve = w.vascularEvidence || {};
    if ((RANK[ve.level] || 0) > (RANK[maxVascularLevel] || 0)) maxVascularLevel = ve.level || maxVascularLevel;
    if (ve.level === 'confirmed' && ve.vesselClass === 'major_named') majorConfirmed = true;
    const cim = w.confirmedInjuryModel || {};
    const confirmed = (cim.confirmed || []).concat(cim.physiologic || []);
    if (confirmed.some(x => /heart|lung_major|tension|massive_hemothorax|thoracic_catastrophic/.test(String(x)))) thoracicCritical = true;
    if (confirmed.some(x => /brain|spinal|cranial|cns/.test(String(x)))) cnsCritical = true;
  }
  let shockCeiling, painCeiling;
  if (isFlechette) {
    if (cnsCritical || thoracicCritical || majorConfirmed) shockCeiling = 75;
    else if (torsoHits >= 6) shockCeiling = 38;
    else shockCeiling = 22;
    painCeiling = torsoHits >= 6 ? 45 : 30;
  } else {   // buckshot
    if (cnsCritical || thoracicCritical || majorConfirmed) shockCeiling = 95;
    else if (torsoHits >= 5) shockCeiling = 75;
    else if (torsoHits >= 2) shockCeiling = 55;
    else shockCeiling = 38;
    painCeiling = torsoHits >= 5 ? 80 : 55;
  }
  // [IMPACT-A Phase2] 산탄 cluster governor — acute load(stopping)와 pain만 상한한다.
  //   physiological shock(m.shock)는 직접 더하거나 빼지 않는다 — 다수 pellet이 급성 stopping/pain을 무한 누적하지 않도록만 제한.
  const sumAcuteLoad = group.reduce((s, w) => s + Math.max(0, (w.immediatePhysiology && w.immediatePhysiology.acuteResponseLoad) || 0), 0);
  const sumPain  = group.reduce((s, w) => s + Math.max(0, (w.immediatePhysiology && w.immediatePhysiology.painAdd) || 0), 0);
  // pain delta 기반 idempotency (volley 끝 호출로 정확히 수렴). m.shock는 건드리지 않음.
  const preCallPain = m.pain;
  const targetPainReduce  = Math.max(0, sumPain - painCeiling);
  const alreadyPain  = (prev && prev.painReduced) || 0;
  const dPain  = targetPainReduce - alreadyPain;
  if (dPain > 0)  m.pain = Math.max(Math.min(painCeiling, preCallPain), m.pain - dPain);
  // acute load 상한 (stopping governor용 — combatState/stagger 소비)
  const acuteLoadCeiling = shockCeiling;   // 동일 부위가중 상한 재사용 (acute 부하 기준)
  m._acuteResponseLoad = Math.min(m._acuteResponseLoad || 0, acuteLoadCeiling);
  m._shotgunPhysiologyGroups[pelletGroupId] = {
    applied:true, ammoId, pelletHits:group.length, torsoHits, limbHits, headNeckHits,
    sumAcuteLoad:+sumAcuteLoad.toFixed(2), sumPain:+sumPain.toFixed(2), acuteLoadCeiling, painCeiling,
    shockReduced:0, painReduced:+targetPainReduce.toFixed(2),   // shockReduced=0 (physiological shock 미조작)
  };
  if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(unit);
  if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(unit);
}

function buildWoundDescriptor(unit, ev) {
  const ammo = (ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null;
  const penState = deriveWoundPenetrationState(ev);
  const woundType = classifyWoundType(ev, penState);
  // 경미한 둔상/찰과는 의미있는 경우만 기록 (abrasion + 매우 약함 → debug hint only)
  const stopped = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed');
  const blunt = ev.bluntTrauma || 0;
  if (stopped && woundType === 'abrasion' && blunt < 2) return null;        // 무의미 — debug hint only
  const woundSize = computeWoundSize(ammo, ev, penState);
  let bleeding = computeBleedingProfile(ammo, ev, woundType, woundSize, penState);
  // §17 안전장치 — 출혈 조건 미충족이면 외출혈 wound 금지
  if (!_woundShouldBleed(ev, penState)) {
    bleeding = { bleedingType:'none', baseExternal:0, baseInternal:0, currentExternal:0, currentInternal:0, rebleedRisk:0, tourniquetEligible:false, vesselRisk:0 };
  }
  const fieldCare = computeFieldCare(ev, woundType, woundSize, bleeding);
  const treatmentProfile = computeTreatmentProfile(ev, woundType, bleeding, fieldCare);
  const ia = ev.impactAddress || {};
  const w = {
    id: 'w' + (_WOUND_ID_SEQ++),
    createdAt: (typeof GAME !== 'undefined' && GAME.gameTime) || 0,
    bodyPart: ev.partKey, partKey: ev.partKey,
    location: ev.hitZone || null, anatomicalZone: ev.anatomicalZone || (ia.anatomicalZone) || null,
    impactAddress: ia,
    sourceType: ev.sourceType, ammoId: ev.ammoId || null, weaponId: ev.weaponId || null,
    armorResult: ev.armorResult, protectionLayer: ia.protectionLayer || ia.armorLayer || null,
    // SIDE-ARMOR-2C §5: coverage 추적 (AAR/wound detail)
    impactAddressFull: ia.fullAddress || null,
    coverageSource: ev.coverageSource || (ev.armorHitResult && ev.armorHitResult.coverageSource) || null,
    selectedLayerType: ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null,
    durabilityOwnerId: ev.durabilityOwnerId || (ev.armorHitResult && ev.armorHitResult.durabilityOwnerId) || null,
    woundType, penetrationState: penState,
    woundMechanism: ev.sourceType, woundChannel: woundSize.channelScale,
    // SHOTGUN-MED-NORM-1 §13: 산탄 pellet 그룹 메타 (aggregate governor용)
    shotgunPellet: !!ev.shotgunPellet, pelletGroupId: ev.pelletGroupId || null, pelletIndex: ev.pelletIndex,
    pelletCount: ev.pelletCount, shotgunAmmoId: ev.shotgunAmmoId || ev.ammoId || null, shotgunPatternType: ev.shotgunPatternType || null,
    immediatePhysiology: ev._immediatePhysiology || null,
    severity: woundSize.sizeScore,
    woundSize, fieldCare: { fieldCareClass: fieldCare },
    bleedingProfile: bleeding,
    tissueProfile: { tissueDamageMul: woundSize.tissueDamageMul, vesselRisk: bleeding.vesselRisk, boneRisk: ev._fracture ? 1 : 0, organCandidates: ev.organCandidates || [] },
    painProfile: { painMul: woundSize.painMul },
    treatmentProfile,
    treatmentState: { bandaged:false, pressureBandaged:false, hemostaticApplied:false, packed:false, chestSealed:false, stabilized:false, treatmentQuality:0, lastTreatedAt:null, treatedBy:null,
      pressureBandageAppliedAt:null, pressureBandageInitialMul:null, pressureBandageTargetMul:null, pressureBandageStabilization:0 },
  };
  // SIDE-MED-2B-1A: bodyTrajectory scaffold 연결 (요약 + 출혈분류 + 후보 hint, 기존 수치 불변)
  try {
    const bt = buildBodyTrajectoryContext(unit, ev, penState);
    w.bodyTrajectory = bt;
    w.bleedingClass = bt.bleedingClass;
    w.bodyTrajectoryLabel = bodyTrajectorySummaryLabel(bt);
    w.organCandidateHints = bt.organCandidateHints;
    w.vesselCandidateHints = bt.vesselCandidateHints;
    w.majorVesselCandidate = bt.majorVesselCandidate;
    // SIDE-MED-2B-1A: 정밀 후보 지도 + 처치 적응증 태그 (candidate 단계 — UI/AAR/다음 처치 패치가 읽음)
    w.candidateMap = bt.candidateMap || [];
    w.treatmentIndicationTags = bt.treatmentIndicationTags || [];
    // SIDE-MEDICAL-TRAUMA-BRIDGE-1 §9: 결정형 의료주소 표준 필드 저장 (기존 필드 유지, 추가만)
    const _med = bt.normalizedMedicalAddress || (ia && ia.medical) || null;
    if (_med) {
      w.normalizedMedicalAddress = _med;
      w.medicalZone = _med.medicalZone; w.vascularRegion = _med.vascularRegion; w.organRegion = _med.organRegion;
      w.cavityRegion = _med.cavityRegion; w.junctionalRegion = _med.junctionalRegion; w.headFaceRegion = _med.headFaceRegion;
      w.airwayRisk = _med.airwayRisk; w.neuroRisk = _med.neuroRisk;
    }
    const _tags = w.treatmentIndicationTags || [];
    w.evacuationPriorityCandidate = _tags.indexOf('evacuationPriority') >= 0 || _tags.indexOf('evacuationPriorityCandidate') >= 0;
    w.surgeryRequiredCandidate = _tags.indexOf('surgeryRequiredCandidate') >= 0;
    w.transfusionRequiredCandidate = _tags.indexOf('transfusionRequiredCandidate') >= 0;
    // HOTFIX-2 §3: 사출구 크기 (의료 UI 입구/내부/사출구 표시용)
    w.exitWoundPresent = bt.exitWoundPresent;
    w.exitSizeClass = bt.exitSizeClass;
    w.exitWoundLabel = bt.exitWoundLabel;
    if (w.woundSize) { w.woundSize.exitSizeClass = bt.exitSizeClass; w.woundSize.exitSizeScore = bt.exitSizeScore; w.woundSize.exitWoundPresent = bt.exitWoundPresent; }
    // SIDE-MED-BALLISTIC-2C-1 §15: entry/rear 메타 + 요약 연결 (다음 의료 패치가 읽음)
    w.entryArmorContext = bt.entryArmorContext || null;
    w.rearArmorInteraction = bt.rearArmorInteraction || null;
    w.entryArmorSummary = entryArmorSummaryLabel(bt);
    w.rearArmorSummary = rearArmorSummaryLabel(bt);
    w.continuationSummary = continuationSummaryLabel(bt);
  } catch (e) { w.bodyTrajectory = null; }
  // SIDE-MED-2B-1B §3/§6: Internal Bleeding Severity Model 생성 + severity 기반 보수 보정 (clamp 필수, source-of-truth 유지)
  try {
    const bt = w.bodyTrajectory;
    if (bt && w.bleedingProfile && bt.internalScores) {
      const ibm = buildInternalBleedingModel(bt, bt.bleedingClass, bt.hitPart || w.partKey);
      w.internalBleedingModel = ibm;
      // §7: severity 기반 처치 적응증 태그 보강 (기존 태그에 추가만)
      const tagSet = new Set(w.treatmentIndicationTags || []);
      if (ibm.surgeryRequiredCandidate) tagSet.add('surgeryRequiredCandidate');
      if (ibm.evacuationPriority === 'high' || ibm.evacuationPriority === 'urgent') tagSet.add('evacuationPriority');
      if (ibm.fieldCareLimit === 'limited') tagSet.add('fieldCareLimited');
      if (ibm.fieldCareLimit === 'unmanageable') tagSet.add('fieldCareUnmanageable');
      w.treatmentIndicationTags = Array.from(tagSet);

      // §6 bleedingProfile 보수 보정 — severity별 internal multiplier (clamp). 기존 bleedingSeverityScore mul도 유지.
      const bp = w.bleedingProfile;
      const sev = bt.internalScores.bleedingSeverityScore;     // 0.1~1.2
      const baseMul = Math.max(0.7, Math.min(1.4, 0.7 + sev * 0.6));
      // severity → internal 보정 배율 (low≈1, moderate 1.05~1.15, severe 1.15~1.30, critical 1.35~1.45)
      const sevIntMul = ({ none: 1.0, low: 1.0, moderate: 1.12, severe: 1.25, critical: 1.4 })[ibm.severity] || 1.0;
      if (bp.bleedingType !== 'none') {
        if (bp.currentExternal != null) bp.currentExternal = +(bp.currentExternal * baseMul).toFixed(2);
        if (bp.baseExternal != null) bp.baseExternal = +(bp.baseExternal * baseMul).toFixed(2);
        // 내부출혈은 cavity/major_vessel_candidate sourceType일 때만 severity 가중 (사지/표층 제외). 반드시 clamp.
        if ((ibm.sourceType === 'cavity' || ibm.sourceType === 'major_vessel_candidate') && bp.currentInternal != null) {
          bp.currentInternal = +Math.min(bp.currentInternal * 1.6, bp.currentInternal * sevIntMul).toFixed(2);
          if (bp.baseInternal != null) bp.baseInternal = +Math.min(bp.baseInternal * 1.6, bp.baseInternal * sevIntMul).toFixed(2);
        }
        // junctional은 external 소폭 가중 (접근 가능한 출혈)
        else if (ibm.sourceType === 'junctional' && bp.currentExternal != null) {
          bp.currentExternal = +(bp.currentExternal * Math.min(1.2, sevIntMul)).toFixed(2);
        }
      }
    }
  } catch (e) {}
  // SIDE-MED-2C: 추가 외상 모델 생성 (null-safe). 모두 candidate/risk 단계 — confirmed 남발 금지.
  try {
    const bt = w.bodyTrajectory;
    if (bt) {
      const ibm = w.internalBleedingModel || null;
      const hp = bt.hitPart || w.partKey;
      w.chestTraumaModel = buildChestTraumaModel(bt, ibm, hp, w.woundSize);
      w.openTorsoModel = buildOpenTorsoModel(bt, ibm, hp, w.woundSize);
      w.organInjuryModel = buildOrganInjuryModel(bt, ibm, hp);
      w.hemorrhageControlModel = buildHemorrhageControlModel(bt, ibm, w.bleedingProfile, hp, w.woundSize);
      // §16/§14 태그 보강: open chest/abd → chestSeal/abdominalDressing candidate
      const tagSet = new Set(w.treatmentIndicationTags || []);
      if (w.chestTraumaModel && w.chestTraumaModel.openChestWound) tagSet.add('chestSealCandidate');
      if (w.openTorsoModel && w.openTorsoModel.abdominalDressingCandidate) tagSet.add('abdominalDressingCandidate');
      if (w.organInjuryModel && w.organInjuryModel.surgeryRequiredCandidate) tagSet.add('surgeryRequiredCandidate');
      w.treatmentIndicationTags = Array.from(tagSet);
    }
  } catch (e) {}
  // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1: confirmed_physiologic 레이어 (1회 계산, tick은 읽기 전용)
  try {
    const bt = w.bodyTrajectory;
    const pim = buildPhysiologicInjuryModel(w, bt, unit);
    w.physiologicInjuryModel = pim;
    w.physiologicInjuries = pim.physiologicInjuries;
    w.physiologicSeverity = pim.physiologicSeverity;
    w.physiologicTags = pim.physiologicTags;
    w.physiologicEffectProfile = pim.physiologicEffectProfile;
    if (pim.physiologicTags && pim.physiologicTags.length) {
      const tagSet = new Set(w.treatmentIndicationTags || []);
      for (const t of pim.physiologicTags) tagSet.add(t);
      if (pim.physiologicInjuries.some(i => i.type === 'major_vessel_injury' || i.type === 'solid_organ_injury')) tagSet.add('surgeryRequiredCandidate');
      w.treatmentIndicationTags = Array.from(tagSet);
    }
  } catch (e) { w.physiologicInjuries = []; w.physiologicEffectProfile = null; }
  // === SIDE-MEDICAL-ORGAN-BLEEDING-1 §1-§8: 확정/강한의심 손상 모델 + 내부출혈 분류 + 처치태그 + 저장 ===
  try {
    const bt = w.bodyTrajectory;
    const med = w.normalizedMedicalAddress || (w.impactAddress && w.impactAddress.medical) || null;
    const cim = buildConfirmedInjuryModel(w, bt, w.candidateMap, med);
    w.confirmedInjuryModel = cim;
    w.confirmedInjuries = cim.confirmed;
    w.probableInjuries = cim.probable;
    w.candidateInjuries = cim.candidates;
    // §6 내부출혈 분류
    const ibc = classifyInternalBleedingCategory(cim, med, bt, w.internalBleedingModel, w.bleedingClass);
    w.internalBleedingCategory = ibc.category;
    w.fieldControllability = ibc.fieldControllability;
    if (w.internalBleedingModel) { w.internalBleedingModel.category = ibc.category; w.internalBleedingModel.fieldControllability = ibc.fieldControllability; w.internalBleedingModel.categoryNote = ibc.note; }
    // §7 treatmentIndicationTags 보강 (표시/후송 판단용 — 실제 회복 로직 없음)
    const tagSet = new Set(w.treatmentIndicationTags || []);
    if (cim.confirmed.length) tagSet.add('confirmedInjury');
    if (cim.probable.some(i => /organ|lung|kidney|solid_organ|hollow_viscus|heart/.test(i))) tagSet.add('probableOrganInjury');
    if (cim.probable.concat(cim.confirmed).some(i => /vessel|subclavian|axillary|femoral|iliac|thoracic_vessel|abdominal_internal/.test(i))) tagSet.add('probableMajorVesselInjury');
    if (ibc.category === 'thoracic_internal') tagSet.add('thoracicInternalBleed');
    if (ibc.category === 'abdominal_internal') tagSet.add('abdominalInternalBleed');
    if (ibc.category === 'retroperitoneal_internal') tagSet.add('retroperitonealBleed');
    if (ibc.category === 'pelvic_internal') tagSet.add('pelvicInternalBleed');
    if (ibc.category === 'junctional_limited_control') tagSet.add('junctionalHemorrhage');
    if (ibc.category === 'airway_compromise' || cim.probable.indexOf('airway_compromise_probable') >= 0) tagSet.add('airwayCompromise');
    if (ibc.category === 'cranial_neuro' || cim.probable.some(i => /tbi|skull/.test(i))) tagSet.add('neuroTraumaCandidate');
    // 후송/수술/수혈/혈관통제 표식 (표시 전용)
    if (cim.confirmed.length || cim.severity === 'severe' || cim.severity === 'critical' || /internal|junctional|neuro|airway/.test(ibc.category)) tagSet.add('definitiveCareRequired');
    if (cim.confirmed.some(i => /lung|heart|open_chest/.test(i)) || cim.probable.some(i => /organ|vessel|solid_organ|hollow_viscus|abdominal_internal|hemothorax/.test(i))) tagSet.add('surgeryRequiredCandidate');
    if (cim.severity === 'severe' || cim.severity === 'critical' || /internal/.test(ibc.category) || tagSet.has('probableMajorVesselInjury')) tagSet.add('transfusionRequiredCandidate');
    if (tagSet.has('probableMajorVesselInjury') || /junctional|pelvic|thoracic|abdominal|retroperitoneal/.test(ibc.category)) tagSet.add('vascularControlRequiredCandidate');
    w.treatmentIndicationTags = Array.from(tagSet);
    // §8 저장 필드 (표시 전용 — 실제 회복 로직 없음)
    w.definitiveCareReasonTags = cim.reasonTags;
    w.surgeryRequiredCandidate = tagSet.has('surgeryRequiredCandidate');
    w.transfusionRequiredCandidate = tagSet.has('transfusionRequiredCandidate');
    w.vascularControlRequiredCandidate = tagSet.has('vascularControlRequiredCandidate');
  } catch (e) { w.confirmedInjuryModel = null; w.confirmedInjuries = []; w.probableInjuries = []; }
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: 감쇠 프로파일 기록 (UI/AAR/debug용 — 원본 추적 보존)
  w.damageAttenuationProfile = ev.hitAddressDamageProfile || (ia.hitAddressDamageProfile) || null;
  w.originalRawDamage = (ev.originalRawDamage != null) ? ev.originalRawDamage : (ev.rawDamage != null ? ev.rawDamage : null);
  w.effectiveRawDamage = (ev.effectiveRawDamage != null) ? ev.effectiveRawDamage : (ev.rawDamage != null ? ev.rawDamage : null);
  if (w.woundSize && w.damageAttenuationProfile) w.woundSize.damageAttenuationMul = w.damageAttenuationProfile.woundMul;
  // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 파편 에너지/질량 메타 보존 (AAR/의료 UI/debug)
  if (ev.fragmentEnergyMeta || ev.fragmentEnergyJ != null) {
    const fm = ev.fragmentEnergyMeta || {};
    w.fragmentEnergyMeta = ev.fragmentEnergyMeta || null;
    w.fragmentMassG = (ev.fragmentMassG != null) ? ev.fragmentMassG : (fm.fragmentMassG != null ? fm.fragmentMassG : null);
    w.fragmentVelocityMps = (ev.fragmentVelocityMps != null) ? ev.fragmentVelocityMps : (fm.fragmentVelocityMps != null ? fm.fragmentVelocityMps : null);
    w.fragmentEnergyJ = (ev.fragmentEnergyJ != null) ? ev.fragmentEnergyJ : (fm.fragmentEnergyJ != null ? fm.fragmentEnergyJ : null);
    w.fragmentEnergyClass = (ev.fragmentEnergyClass != null) ? ev.fragmentEnergyClass : (fm.fragmentEnergyClass != null ? fm.fragmentEnergyClass : null);
    w.fragmentSource = fm.fragmentSource || ev.fragmentSource || null;
    w.fragmentContext = fm.fragmentContext || ev.fragmentContext || null;
    w.fragmentTier = fm.fragmentTier || null;
    w.spallClass = ev.spallClass || fm.spallClass || null;
    w.parentAmmoId = fm.parentAmmoId || ev.ammoId || null;
    w.sourceMassBudgetG = fm.sourceMassBudgetG != null ? fm.sourceMassBudgetG : null;
    w.sourceGeneratedMassTotalG = fm.sourceGeneratedMassTotalG != null ? fm.sourceGeneratedMassTotalG : null;
    w.energyBasedDamage = fm.energyBasedDamage != null ? fm.energyBasedDamage : null;
    w.energyBasedPenetration = fm.energyBasedPenetration != null ? fm.energyBasedPenetration : null;
    w.equivalentDamage = fm.equivalentDamage != null ? fm.equivalentDamage : null;
    w.equivalentPenetration = fm.equivalentPenetration != null ? fm.equivalentPenetration : null;
    w.fragmentEnergyDamageBridge = !!fm.fragmentEnergyDamageBridge;
    // SIDE-FRAGMENT-CLUSTER-TRAIT-MATERIAL-SPALL-1: 파편 성격 계수 + 스폴 재질 보존
    w.fragmentShapeFactor = (fm.fragmentShapeFactor != null) ? fm.fragmentShapeFactor : (ev.fragmentShapeFactor != null ? ev.fragmentShapeFactor : null);
    w.fragmentStabilityFactor = (fm.fragmentStabilityFactor != null) ? fm.fragmentStabilityFactor : (ev.fragmentStabilityFactor != null ? ev.fragmentStabilityFactor : null);
    w.fragmentSharpness = (fm.fragmentSharpness != null) ? fm.fragmentSharpness : (ev.fragmentSharpness != null ? ev.fragmentSharpness : null);
    w.fragmentDragFactor = (fm.fragmentDragFactor != null) ? fm.fragmentDragFactor : (ev.fragmentDragFactor != null ? ev.fragmentDragFactor : null);
    w.fragmentTumblingChance = (fm.fragmentTumblingChance != null) ? fm.fragmentTumblingChance : (ev.fragmentTumblingChance != null ? ev.fragmentTumblingChance : null);
    w.spallMaterialType = fm.spallMaterialType || ev.spallMaterialType || null;
  }
  // === ORGANIC-BLEED-1 Phase 1/2: vascularEvidence + fractureEvidence + bleedingProfile finalize ===
  //   (모든 후보/probable/confirmed/trajectory/medicalAddress 계산 이후 — evidence gate 적용)
  try {
    const _med = w.normalizedMedicalAddress || (w.impactAddress && w.impactAddress.medical) || null;
    w.fractureEvidence = buildFractureEvidence(unit, ev, w.woundSize, w.bodyTrajectory, _med);
    // 골절 → wound + bodyParts fracture 반영 (기존 UI/기능저하 호환)
    if (w.fractureEvidence.occurred) {
      w._fracture = true;
      if (w.tissueProfile) w.tissueProfile.boneRisk = 1;
      // PHASE 3-B: draft는 unit 상태를 변경하지 않는다 — bodyPart 골절 반영은 commit 후 D단계(applyFractureEvidenceToBodyPart).
      // 부위별 특수 (rib→흉부 내부/hemothorax, jaw→airway, pelvic→pelvic, skull→tbi) — 태그/후보만, confirmed 아님
      const _fz = w.fractureEvidence.boneZone;
      const tagSet = new Set(w.treatmentIndicationTags || []);
      if (_fz === 'rib') tagSet.add('thoracicInternalRiskCandidate');
      if (_fz === 'jaw') { w.airwayRisk = (w.airwayRisk === true) ? true : (w.airwayRisk || 'possible'); }
      if (_fz === 'pelvis') tagSet.add('pelvicInternalRiskCandidate');
      if (_fz === 'skull') tagSet.add('neuroTraumaCandidate');
      w.treatmentIndicationTags = Array.from(tagSet);
    }
    // 골절 vascularRiskBonus → bleedingProfile.vesselRisk 소폭 상승 (candidate 승격 근거)
    if (w.fractureEvidence.occurred && w.bleedingProfile && w.fractureEvidence.vascularRiskBonus > 0) {
      w.bleedingProfile.vesselRisk = Math.min(1, (w.bleedingProfile.vesselRisk || 0) + w.fractureEvidence.vascularRiskBonus);
    }
    // PART-DESTRUCTION-POST-WOUND-SYNC-1 §1: buildWoundDescriptor에서는 partDestruction 최종 갱신하지 않고 seed만 저장.
    //   (wound가 unit.medical.wounds에 push되기 전이라 large/massive/shattered/cluster가 판정에 안 잡힘 → recordWoundFromDamageEvent에서 최종 갱신)
    w._pendingPartDestructionCtx = {
      bodyDmg: (ev._immediatePhysiology && Number.isFinite(ev._immediatePhysiology.bodyDmg)) ? ev._immediatePhysiology.bodyDmg : 0,
      partKey: w.partKey, pelletGroupId: w.pelletGroupId || null, shotgunPellet: !!w.shotgunPellet,
      sourceType: w.sourceType, armorResult: w.armorResult,
    };
    // vascularEvidence — 골절 반영된 vesselRisk 이후 계산 (partDestruction 보강은 recordWound 이후)
    w.vascularEvidence = buildVascularEvidence(w);
    // §8 승격: fracture(comminuted/shattered) + vessel-adjacent + deep → candidate→probable
    const fe = w.fractureEvidence;
    if (fe.occurred && (fe.fractureType === 'comminuted' || fe.fractureType === 'shattered')) {
      const ve = w.vascularEvidence;
      const deep = !!(w.bodyTrajectory && (w.bodyTrajectory.penetrationState === 'through_and_through' || w.bodyTrajectory.penetrationState === 'deep'));
      const vesselAdjacent = _VESSEL_NAMED_RE.test(((w.normalizedMedicalAddress && w.normalizedMedicalAddress.vascularRegion) || '') + ' ' + (w.anatomicalZone || ''));
      if (ve.level === 'candidate' && vesselAdjacent && deep) {
        ve.level = 'probable'; ve.evidenceStrength = Math.max(ve.evidenceStrength, 0.55);
        ve.source = 'fracture_adjacent'; ve.evidenceTags.push('fracture_vessel_promoted');
        // ORGANIC-BLEED-CLEANUP-1 §4: 승격 시 배열/vesselClass 보강 (confirmed로는 올리지 않음)
        if (ve.vesselClass === 'none' || ve.vesselClass === 'capillary_muscle') ve.vesselClass = 'small_branch';
        else if (ve.vesselClass === 'small_branch') ve.vesselClass = 'named_branch';
        if (!ve.probableVessels) ve.probableVessels = [];
        if (!ve.probableVessels.some(v => /vessel/.test(v))) ve.probableVessels.push('vessel_injury_probable');
        if (w.probableInjuries && !w.probableInjuries.some(i => /vessel/.test(i))) w.probableInjuries.push('vessel_injury_probable');
      }
    }
    // PHASE 3-B: bleeding finalize/fieldCare/treatmentProfile/tissue 동기화는 commit 후 H/I단계에서 1회 수행 (이중 finalize 제거).
  } catch (e) {
    _woundPipelineError('B_draft', { eventId: ev && ev.eventId, unitId: unit && unit.id, woundId: w && w.id, partKey: w && w.partKey }, e);
    if (!w.vascularEvidence) w.vascularEvidence = { level: 'none', vesselClass: 'none', riskPercent: 0, majorVessel: false };
    if (!w.fractureEvidence) w.fractureEvidence = { occurred: false };
  }
  w.uiLabels = buildWoundUiLabels(w);
  return w;
}

// ============================================================
// SHOTGUN-PHYS-CLUSTER-1 Phase4 — woundCluster (처치/UI 묶음. 개별 wound는 source-of-truth로 유지)
// ============================================================
// §12: 주소를 처치 묶음 단위로 정규화
function normalizeWoundAddressCluster(partKey, addr) {
  const pk = (partKey || '').toLowerCase();
  const a = (typeof addr === 'string' ? addr : (addr && (addr.fullAddress || addr.vascularRegion || addr.medicalZone || addr.anatomicalZone || addr.zone)) || '').toLowerCase();
  const s = pk + ' ' + a;
  if (/groin|inguinal|junction/.test(s)) return 'groin_junctional';
  if (/axilla|armpit|shoulder_root|shoulderroot|supraclavic/.test(s)) return 'axilla_shoulder_gap';
  if (/neck|throat|cervical/.test(s)) return 'neck';
  if (/skull|cranial|crown|occipital|temporal|forehead/.test(s)) return 'head_cranial';
  if (/head|face|jaw|mouth|nose|cheek/.test(s)) return 'head_face';
  if (/sternum|xiphoid/.test(s)) return 'sternum_center';
  if (/chest|thorax|rib/.test(s)) { if (/left/.test(s)) return 'chest_left'; if (/right/.test(s)) return 'chest_right'; return 'chest_center'; }
  if (/abdomen|belly|stomach|flank/.test(s)) return /upper|epigast/.test(s) ? 'abdomen_upper' : 'abdomen_lower';
  if (/forearm|radius|ulna/.test(s)) return 'forearm';
  if (/hand|wrist/.test(s)) return 'hand_wrist';
  if (/upper_arm|humerus|arm/.test(s) && /arm/.test(pk)) return 'upper_arm';
  if (/thigh|femur/.test(s)) return 'thigh';
  if (/shin|tibia|fibula|lower_leg|calf/.test(s)) return 'lower_leg';
  if (/foot|ankle/.test(s)) return 'foot_ankle';
  // fallback — partKey 기반 generic
  return pk || 'generic';
}
// §12: cluster id 생성
function getWoundClusterKey(unit, wound, ev) {
  const partKey = wound.partKey || ev.hitPart || 'unknown';
  const addr = wound.normalizedMedicalAddress || wound.impactAddress || ev.impactAddress || 'generic';
  const addressClusterKey = normalizeWoundAddressCluster(partKey, addr);
  const uid = (unit && unit.id) || 'unit';
  const gid = wound.pelletGroupId || ev.pelletGroupId;
  // 산탄: 같은 volley + 같은 partKey면 하나의 cluster (미세주소 노이즈로 갈라지지 않게 — 전완 다중천공 = cluster 1개)
  if (gid) return ['cluster', 'shotgun', uid, gid, partKey].join('_');
  return ['cluster', 'area', uid, partKey, addressClusterKey].join('_');
}
// §15: 처치 표면 비용 (붕대/소모품 단위)
function computeWoundClusterTreatmentCost(cluster, wounds) {
  let cost = 1;
  const count = wounds.length;
  const isFlechette = cluster.type === 'flechette_pattern';
  const isShotgun = cluster.type === 'shotgun_pattern';
  const isJunctional = /groin|axilla|neck|supraclavic/.test(cluster.addressClusterKey || '');
  let severeCount = 0, largeCount = 0, majorLocked = false;
  for (const w of wounds) {
    const ws = w.woundSize || {}, bp = w.bleedingProfile || {}, ve = w.vascularEvidence || {};
    if (/large|massive/.test(ws.sizeClass || '')) largeCount++;
    if ((bp.currentExternal || 0) >= 8 || (bp.sustainedExternal || 0) >= 8) severeCount++;
    if (bp.majorVesselLocked || ve.level === 'confirmed') majorLocked = true;
  }
  if (isFlechette) { cost = 1; if (count > 10) cost += 1; if (severeCount >= 2) cost += 1; }
  else if (isShotgun) { cost = 1; if (count >= 4) cost += 1; if (count >= 7) cost += 1; if (largeCount > 0) cost += 1; }
  else { cost = Math.max(1, Math.ceil(count * 0.65)); }
  if (isJunctional) cost += 1;
  if (majorLocked) cost += 1;
  return Math.max(1, Math.min(5, cost));
}
// §16: wound를 cluster에 배정/갱신
// WOUND-CLUSTER-REFRESH-1 §1: cluster 집계 재계산을 별도 helper로 분리 (wound.bleedingProfile ↔ cluster 동기화).
function refreshWoundCluster(unit, clusterId) {
  if (!unit || !unit.medical || !unit.medical.woundClusters || !clusterId) return null;
  const m = unit.medical;
  const cl = m.woundClusters[clusterId];
  if (!cl) return null;
  const wounds = (cl.sourceWoundIds || []).map(id => m.wounds.find(w => w && w.id === id)).filter(Boolean);
  cl.woundCount = wounds.length;
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  const agg = { currentExternal:0, currentInternal:0, sustainedExternal:0, sustainedInternal:0, initialExternal:0, initialInternal:0 };
  let maxVL = 'none', majorLocked = false, hasFx = false; const fxTypes = new Set();
  for (const w of wounds) {
    const bp = w.bleedingProfile || {}, ve = w.vascularEvidence || {};
    agg.currentExternal += Math.max(0, bp.currentExternal || 0);
    agg.currentInternal += Math.max(0, bp.currentInternal || 0);
    agg.sustainedExternal += Math.max(0, bp.sustainedExternal || 0);
    agg.sustainedInternal += Math.max(0, bp.sustainedInternal || 0);
    agg.initialExternal += Math.max(0, bp.initialExternal || 0);
    agg.initialInternal += Math.max(0, bp.initialInternal || 0);
    if ((RANK[ve.level] || 0) > (RANK[maxVL] || 0)) maxVL = ve.level || maxVL;
    if (bp.majorVesselLocked || (ve.level === 'confirmed' && ve.vesselClass === 'major_named')) majorLocked = true;
    if (w.fractureEvidence && w.fractureEvidence.occurred) { hasFx = true; if (w.fractureEvidence.fractureType) fxTypes.add(w.fractureEvidence.fractureType); }
  }
  for (const k of Object.keys(agg)) agg[k] = +agg[k].toFixed(2);
  cl.aggregateBleeding = agg;
  cl.maxVascularEvidenceLevel = maxVL;
  cl.hasMajorVesselLocked = majorLocked;
  cl.hasFracture = hasFx; cl.fractureTypes = Array.from(fxTypes);
  cl.clusterSeverity = majorLocked ? 'critical' : (agg.sustainedExternal >= 12 || agg.currentExternal >= 20) ? 'severe'
                     : (agg.sustainedExternal >= 5 || agg.currentExternal >= 8) ? 'moderate' : 'minor';
  cl.treatmentSurfaceCost = computeWoundClusterTreatmentCost(cl, wounds);
  cl.recommendedBandageUnits = cl.treatmentSurfaceCost;
  cl.hemostaticUnits = (/groin|axilla|neck/.test(cl.addressClusterKey || '') || majorLocked || maxVL === 'probable' || maxVL === 'confirmed')
    ? Math.max(1, Math.ceil(cl.treatmentSurfaceCost * 0.5)) : 0;
  // ── 대형 PHASE 4: cluster 집계 처치상태는 "개별 wound.treatmentState에서 파생되는 캐시"다. ──
  //   cluster 단독 상태 변경 금지 — 처치는 항상 개별 wound에 적용 후 여기서 재도출된다.
  const tcs = cl.treatmentClusterState = cl.treatmentClusterState || {};
  let _treated = 0, _pressure = 0, _packed = 0, _needs = 0, _activeBleed = 0;
  const _eligibleRemaining = [];
  // [HOTFIX 마감] 처치 종류를 분리 집계 — 압박(외부출혈 통제) vs 일반 붕대 마감 vs 지혈거즈 vs 패킹.
  let _pressureCtl = 0, _plainBandaged = 0, _hemostatic = 0;
  for (const w of wounds) {
    const ts = w.treatmentState || {};
    const bp2 = w.bleedingProfile || {};
    const tp = w.treatmentProfile || {};
    const eff = (w._effExternal != null) ? w._effExternal : (bp2.currentExternal || 0);
    const done = !!(ts.pressureBandaged || ts.bandageApplied || ts.packed || ts.hemostaticApplied);
    if (done) _treated++;
    if (ts.pressureBandaged) _pressureCtl++;          // 압박붕대 = 외부출혈 압박 통제
    if (ts.bandageApplied) _plainBandaged++;          // 일반 붕대 = 마감/고정 (압박의 호환 bandaged와 분리)
    if (ts.hemostaticApplied) _hemostatic++;
    if (ts.packed) _packed++;
    if (eff > 0.5) _activeBleed++;
    const cavityOnly = (bp2.bleedingType === 'cavity' || bp2.bleedingType === 'internal');
    if (!done && !cavityOnly && (tp.pressureBandageEligible || tp.bandageEligible)) { _needs++; _eligibleRemaining.push(w); }
  }
  tcs.treatedCount = _treated;
  tcs.untreatedEligible = _needs;
  tcs.activeBleedingCount = _activeBleed;
  // summary 분리 카운트 (child 실제 상태와 일치)
  tcs.pressureControlledCount = _pressureCtl;
  tcs.plainBandagedCount = _plainBandaged;
  tcs.hemostaticCount = _hemostatic;
  tcs.packedCount = _packed;
  // derived state — 압박/패킹/지혈은 "통제", 일반 붕대만 있으면 "secured(마감)". 일반붕대 단독 → pressure_controlled 금지.
  const _controlled = (_pressureCtl > 0 || _packed > 0 || _hemostatic > 0);
  tcs.derivedState = (tcs.reopened && _needs > 0) ? 'reopened'
    : (_treated === 0 && _needs > 0) ? 'untreated'
    : (_treated > 0 && _needs > 0) ? 'partially_treated'
    : (_controlled && _activeBleed > 0) ? 'rebleeding'
    : (_packed > 0) ? 'packed'
    : (_pressureCtl > 0) ? 'pressure_controlled'
    : (_plainBandaged > 0) ? 'secured'                        // 일반 붕대만 → 마감(secured), 압박통제 아님
    : (_activeBleed === 0) ? 'secured' : 'untreated';
  if (_needs === 0 && _activeBleed === 0 && tcs.reopened) tcs.reopened = false;   // 재처치 완료 시 reopen 해제
  // 남은 필요 처치량 — "미처치 eligible" 기준으로만 재계산 (이미 처치된 상처에 이중 지출 금지)
  cl.remainingBandageUnits = _eligibleRemaining.length ? computeWoundClusterTreatmentCost(cl, _eligibleRemaining) : 0;
  return cl;
}
// WOUND-CLUSTER-REFRESH-1 §3: volley 최종 governor 이후 그룹 cluster들을 최신화
function refreshShotgunPelletGroupClusters(unit, pelletGroupId) {
  if (!unit || !unit.medical || !unit.medical.wounds || !unit.medical.woundClusters) return;
  const ids = new Set();
  for (const w of unit.medical.wounds) {
    if (w && w.pelletGroupId === pelletGroupId && w.treatmentClusterId) ids.add(w.treatmentClusterId);
  }
  for (const cid of ids) refreshWoundCluster(unit, cid);
}

function assignWoundToTreatmentCluster(unit, w, ev) {
  if (!unit || !unit.medical || !w) return null;
  const m = unit.medical;
  if (!m.woundClusters) m.woundClusters = {};
  const clusterId = getWoundClusterKey(unit, w, ev);
  const partKey = w.partKey || ev.hitPart || 'unknown';
  const addressClusterKey = normalizeWoundAddressCluster(partKey, w.normalizedMedicalAddress || w.impactAddress || ev.impactAddress || 'generic');
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const gid = w.pelletGroupId || ev.pelletGroupId || null;
  const ammoId = w.shotgunAmmoId || w.ammoId || ev.ammoId || null;
  const isFlechette = /flechette/.test(ammoId || '');
  const isBuckshot = /buck/.test(ammoId || '');
  // SAME-AREA-CLUSTER-ACTIVE-GEN-1: 비산탄 same-area cluster는 active generation을 추적해 8s window 내 후속 피격이
  //   방금 만든 세대(_g1)에 합류하게 한다. base clusterId만 보면 _g2/_g3가 매번 생기던 문제 수정.
  //   산탄(pelletGroupId 있음)은 기존 pelletGroupId 기준 그대로.
  let _effClusterId = clusterId;
  if (!gid) {
    const WINDOW_S = 8;
    m._activeWoundClusterGen = m._activeWoundClusterGen || {};
    const isClusterClosedForMerge = (cl2) => {
      if (!cl2) return false;
      const ts = cl2.treatmentClusterState || {};
      return !!(ts.packed || ts.tourniquetApplied || ts.closed) || cl2.clusterSeverity === 'critical';
    };
    const activeId = m._activeWoundClusterGen[clusterId];
    const active = activeId ? m.woundClusters[activeId] : null;
    if (active) {
      const stale = (active.lastHitTime != null) && ((now - active.lastHitTime) > WINDOW_S);
      const closed = isClusterClosedForMerge(active);
      if (!stale && !closed) {
        _effClusterId = active.id;
      } else {
        m._woundClusterGen = m._woundClusterGen || {};
        m._woundClusterGen[clusterId] = (m._woundClusterGen[clusterId] || 0) + 1;
        _effClusterId = clusterId + '_g' + m._woundClusterGen[clusterId];
        m._activeWoundClusterGen[clusterId] = _effClusterId;
      }
    } else {
      const base = m.woundClusters[clusterId];
      if (base) {
        const stale = (base.lastHitTime != null) && ((now - base.lastHitTime) > WINDOW_S);
        const closed = isClusterClosedForMerge(base);
        if (!stale && !closed) {
          _effClusterId = base.id;
          m._activeWoundClusterGen[clusterId] = base.id;
        } else {
          m._woundClusterGen = m._woundClusterGen || {};
          m._woundClusterGen[clusterId] = (m._woundClusterGen[clusterId] || 0) + 1;
          _effClusterId = clusterId + '_g' + m._woundClusterGen[clusterId];
          m._activeWoundClusterGen[clusterId] = _effClusterId;
        }
      } else {
        _effClusterId = clusterId;
        m._activeWoundClusterGen[clusterId] = _effClusterId;
      }
    }
  }
  let cl = m.woundClusters[_effClusterId];
  // WOUND-CLUSTER-REFRESH-1 §5: 이미 치료된 cluster에 나중에 새 wound(다른 volley/시점) → reopen/rebleed.
  //   같은 shotgun volley의 순차 펠릿(같은 gid)은 reopen 아님.
  const wasExisting = !!cl;
  const wasTreated = cl && cl.treatmentClusterState &&
    (cl.treatmentClusterState.bandaged || cl.treatmentClusterState.pressureApplied || cl.treatmentClusterState.packed);
  const sameVolley = gid && cl && cl.pelletGroupId === gid;
  if (wasExisting && wasTreated && !sameVolley && cl.lastHitTime != null && (now - cl.lastHitTime) > 0.25) {
    cl.treatmentClusterState.reopened = true;
    cl.treatmentClusterState.rebleedAfterTreatment = true;
    cl.treatmentClusterState.bandaged = false;
    cl.treatmentClusterState.pressureApplied = false;
    cl.notes = cl.notes || [];
    cl.notes.push('new_wound_reopened_cluster');
  }
  if (!cl) {
    let type = 'single';
    // 대형 PHASE 5: slug는 단일 발사체 — 펠릿 패턴 cluster에서 제외 (governor 제외 규칙과 일치)
    if (gid) type = isFlechette ? 'flechette_pattern' : (/slug/.test(ammoId || '') ? 'single' : 'shotgun_pattern');
    else if (/groin|axilla|neck/.test(addressClusterKey)) type = 'junctional_cluster';
    cl = m.woundClusters[_effClusterId] = {
      id: _effClusterId, type, partKey, normalizedAddress: (w.normalizedMedicalAddress && (w.normalizedMedicalAddress.fullAddress || w.normalizedMedicalAddress)) || null,
      addressClusterKey, sourceWoundIds: [], pelletGroupId: gid, shotgunAmmoId: ammoId, pelletCount: w.pelletCount || 0, woundCount: 0,
      firstHitTime: now, lastHitTime: now, clusterSeverity: 'minor',
      aggregateBleeding: { currentExternal:0, currentInternal:0, sustainedExternal:0, sustainedInternal:0, initialExternal:0, initialInternal:0 },
      maxVascularEvidenceLevel: 'none', hasMajorVesselLocked: false, hasFracture: false, fractureTypes: [],
      treatmentSurfaceCost: 1, recommendedBandageUnits: 1, hemostaticUnits: 0,
      treatmentClusterState: { bandaged:false, pressureApplied:false, packed:false, tourniquetApplied:false, lastTreatmentTime:0, treatmentQuality:0 },
      notes: [],
    };
  }
  // same_area_multi_hit 승격 (비산탄 + 같은 부위 반복)
  if (!gid && cl.type === 'single' && cl.sourceWoundIds.length >= 1) cl.type = 'same_area_multi_hit';
  if (cl.sourceWoundIds.indexOf(w.id) < 0) cl.sourceWoundIds.push(w.id);
  cl.lastHitTime = now;
  cl.pelletCount = Math.max(cl.pelletCount || 0, w.pelletCount || 0);
  w.treatmentClusterId = cl.id;
  return refreshWoundCluster(unit, cl.id);
}

// ════════════════════════════════════════════════════════════════════════════
// 대형 PHASE 6 — 구조화 오류 + invariant (핵심 파이프라인 빈 catch 금지)
// ════════════════════════════════════════════════════════════════════════════
function _woundPipelineError(stage, info, err) {
  const rec = Object.assign({ pipeline:'wound', stage, error: err && (err.message || String(err)), t: (typeof GAME !== 'undefined' && GAME.gameTime) || 0 }, info || {});
  if (typeof GAME !== 'undefined') {
    GAME._pipelineErrors = GAME._pipelineErrors || [];
    if (GAME._pipelineErrors.length < 300) GAME._pipelineErrors.push(rec);
    if (GAME.debugStrictPipeline) { const e2 = new Error('WOUND_PIPELINE_ERROR [' + stage + '] ' + rec.error); e2._pipeline = rec; throw e2; }
  }
  return rec;
}
function _markMedicalInconsistent(unit, stage, info) {
  if (!unit || !unit.medical) return;
  unit.medical._inconsistent = unit.medical._inconsistent || [];
  if (unit.medical._inconsistent.length < 50) unit.medical._inconsistent.push(Object.assign({ stage, t: (typeof GAME !== 'undefined' && GAME.gameTime) || 0 }, info || {}));
}
// wound/cluster/partDestruction invariant — debug/strict에서 파이프라인 종료 후 검사
function validateWoundPipelineInvariants(unit, opts) {
  const errs = [];
  const m = unit && unit.medical; if (!m) return errs;
  const push = (k, msg) => errs.push({ k, msg });
  const ids = new Set();
  for (const w of (m.wounds || [])) {
    if (!w) continue;
    if (ids.has(w.id)) push('wound', '중복 wound id: ' + w.id);
    ids.add(w.id);
    if (w.partKey && !_STORAGE_TO_CANON[w.partKey]) push('partKey', '비정규 wound.partKey: ' + w.partKey);
    if (w.treatmentClusterId && !(m.woundClusters && m.woundClusters[w.treatmentClusterId])) push('cluster', 'wound가 없는 cluster 참조: ' + w.treatmentClusterId);
    if (w.bleedingProfile && (w.bleedingProfile._finalizationCount || 0) > 1) push('bleeding', 'finalization ' + w.bleedingProfile._finalizationCount + '회: ' + w.id);
    if (w.bleedingProfile && (w.bleedingProfile._finalizationCount || 0) === 0) push('bleeding', 'finalize 미실행: ' + w.id);
  }
  for (const cid in (m.woundClusters || {})) {
    const c = m.woundClusters[cid]; if (!c) continue;
    const resolved = (c.sourceWoundIds || []).map(id => (m.wounds || []).find(x => x && x.id === id)).filter(Boolean);
    if ((c.sourceWoundIds || []).length !== resolved.length) push('cluster', 'dangling sourceWoundIds: ' + cid);
    if (c.woundCount !== resolved.length) push('cluster', 'woundCount 불일치: ' + cid + ' ' + c.woundCount + '!=' + resolved.length);
    if (resolved.length === 0) push('cluster', '빈 active cluster: ' + cid);
    for (const w of resolved) if (w.partKey !== c.partKey) push('cluster', 'cluster/부위 불일치: ' + cid + ' ' + w.partKey + '!=' + c.partKey);
    if (c.pelletGroupId) for (const w of resolved) if (w.pelletGroupId !== c.pelletGroupId) push('cluster', 'pelletGroupId 불일치: ' + cid);
  }
  if (m.partDestruction) for (const pk in m.partDestruction) {
    const pd = m.partDestruction[pk]; if (!pd) continue;
    for (const id of (pd.sourceWoundIds || [])) if (!ids.has(id)) push('partDestruction', 'dangling wound ref: ' + pk + '/' + id);
    for (const cid of (pd.sourceClusterIds || [])) if (!(m.woundClusters && m.woundClusters[cid])) push('partDestruction', 'dangling cluster ref: ' + pk + '/' + cid);
  }
  if (errs.length && typeof GAME !== 'undefined' && GAME.debugStrictPipeline && !(opts && opts.noThrow)) {
    const e = new Error('WOUND_INVARIANT_FAIL: ' + errs.map(x => x.k + ':' + x.msg).slice(0, 5).join(' | ')); e._invariants = errs; throw e;
  }
  return errs;
}
