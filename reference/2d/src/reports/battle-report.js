// 2A-3.5: AAR / battleReport — 사후강평 데이터 기록
//   전투 중 사격/명중/피격/사살/의료/장비를 기록. 전투 종료 후 사후강평에 표시.
//   기존 _impactLog(미니로그)와 별개. 판정/밸런스/medical 계산은 변경 없음.
// =============================================================
function aarInit() {
  if (typeof GAME === 'undefined') return;
  GAME.battleReport = {
    active: true,
    battleId: (GAME._battleSeq = (GAME._battleSeq || 0) + 1),
    startTime: GAME.gameTime || 0,
    endTime: null, duration: 0, result: null,
    unitsInitial: {}, unitsFinal: {},
    unitStats: {},
    shotLog: [], impactLog: [], killLog: [], medicalLog: [], armorLog: [],
    hitMarkers: [],
    finalMedical: {}, finalArmor: {},
    summary: {},
  };
  for (const u of (typeof UNITS !== 'undefined' ? UNITS : [])) {
    GAME.battleReport.unitsInitial[u.id] = aarLoadoutSnapshot(u);
    aarUnitStats(u.id);
    u._aarDeathRecorded = false;
    u._aarLastHit = null;
  }
}
function aarActive() { return typeof GAME !== 'undefined' && GAME.battleReport && GAME.battleReport.active; }
function aarUnitStats(id) {
  if (!aarActive()) return null;
  const br = GAME.battleReport;
  if (!br.unitStats[id]) br.unitStats[id] = {
    shotsFired:0, shotsHit:0, shotsMissed:0, ammoUsedById:{}, hitsByAmmoId:{},
    kills:0, receivedHits:0, receivedPenetrations:0, receivedStopped:0, receivedRicochets:0,
    hitsByPart:{}, hitsByCoverageZone:{}, hitsByArmorResult:{},
  };
  return br.unitStats[id];
}
function aarMedicalSnapshot(u) {
  const m = u && u.medical;
  if (!m) return null;
  const bp = {};
  for (const k in m.bodyParts) {
    const p = m.bodyParts[k];
    bp[k] = {
      hp: Math.round(p.hp), maxHp: p.maxHp, functionRatio: +(p.functionRatio||0).toFixed(2),
      externalBleedRate: +(p.externalBleedRate||0).toFixed(1), internalBleedRate: +(p.internalBleedRate||0).toFixed(1),
      fracture: !!p.fracture, disabled: !!p.disabled,
      tourniquetApplied: !!p.tourniquetApplied, bandageApplied: !!p.bandageApplied,
      splinted: !!p.splinted, chestSealed: !!p.chestSealed,
    };
    // [B-STAGE 12.2] 부위 파괴 근거 snapshot (source-of-truth는 medical.partDestruction)
    const _pd = m.partDestruction && m.partDestruction[k];
    if (_pd) {
      bp[k].partDestruction = {
        state: _pd.state,
        cumulativeTraumaScore: +(_pd.cumulativeTraumaScore || 0).toFixed(3),
        acuteTraumaScore: +(_pd.acuteTraumaScore || 0).toFixed(3),
        dominantClusterKey: _pd.dominantClusterKey || null,
        dominantClusterScore: +(_pd.dominantClusterScore || 0).toFixed(3),
        dominantClusterState: _pd.dominantClusterState || null,
        distributedClusterCount: _pd.distributedClusterCount || 0,
        localConcentrationRatio: +(_pd.localConcentrationRatio || 0).toFixed(3),
        worstFractureType: _pd.worstFractureType || 'none',
        functionalCap: _pd.functionalCap != null ? _pd.functionalCap : 1,
        disabled: !!p.disabled,
        functionalLossReason: _pd.functionalLossReason || null,
        evidenceTier: _pd.evidenceTier || 'minor',
        evidenceTags: (_pd.evidenceTags || []).slice(),
        gateReasons: (_pd.gateReasons || []).slice(),
      };
    }
  }
  // 처치 카운트
  let tq=0,bd=0,sp=0,cs=0;
  for (const k in bp) { if(bp[k].tourniquetApplied)tq++; if(bp[k].bandageApplied)bd++; if(bp[k].splinted)sp++; if(bp[k].chestSealed)cs++; }
  // HOTFIX 2-3: wounds compact snapshot (전투 종료 봉인 기록 — 표시/분석 전용, source-of-truth 아님)
  let woundsSnap = null;
  if (Array.isArray(m.wounds)) {
    woundsSnap = m.wounds.map(w => {
      const ts = w.treatmentState || {};
      const cim = w.confirmedInjuryModel || {};
      return {
        woundId: w.id, partKey: w.partKey || null, location: w.location || null,
        uiLabel: (w.uiLabels && w.uiLabels.combinedLabel) || w.displayName || null,
        bleedingClass: w.bleedingClass || (w.bleedingProfile && w.bleedingProfile.bleedingType) || null,
        internalBleedingCategory: w.internalBleedingCategory || null,
        fieldControllability: w.fieldControllability || null,
        confirmedInjuries: (w.confirmedInjuries && w.confirmedInjuries.slice()) || (cim.confirmed && cim.confirmed.slice()) || [],
        probableInjuries: (w.probableInjuries && w.probableInjuries.slice()) || (cim.probable && cim.probable.slice()) || [],
        candidateInjuries: (w.candidateInjuries && w.candidateInjuries.slice()) || [],
        treatmentState: { sequenceStage: ts.sequenceStage || null, tourniquetApplied: !!ts.tourniquetApplied, hemostaticApplied: !!ts.hemostaticApplied, packed: !!ts.packed, pressureBandaged: !!ts.pressureBandaged, bandageApplied: !!ts.bandageApplied, bandaged: !!ts.bandaged, chestSealed: !!ts.chestSealed, needleDecompressed: !!ts.needleDecompressed, pelvicBound: !!ts.pelvicBound, bloodPackGiven: !!ts.bloodPackGiven, ivGiven: !!ts.ivGiven, comboEffects: ts.comboEffects ? JSON.parse(JSON.stringify(ts.comboEffects)) : null },
        sequenceStage: ts.sequenceStage || null,
        recurrenceRisk: (ts.recurrenceRisk != null) ? +ts.recurrenceRisk.toFixed(2) : null,
        bodyTrajectoryLabel: (w.bodyTrajectory && (w.bodyTrajectory.pathLabel || w.bodyTrajectory.label)) || null,
        treatmentIndicationTags: (w.treatmentIndicationTags && w.treatmentIndicationTags.slice()) || [],
        surgeryRequiredCandidate: !!w.surgeryRequiredCandidate,
        transfusionRequiredCandidate: !!w.transfusionRequiredCandidate,
        vascularControlRequiredCandidate: !!w.vascularControlRequiredCandidate,
        // ORGANIC-BLEED-1 Phase3 §10: evidence 최소 기록 (표시/분석 전용)
        vascularEvidence: w.vascularEvidence ? { level: w.vascularEvidence.level, vesselClass: w.vascularEvidence.vesselClass, riskPercent: w.vascularEvidence.riskPercent, majorVessel: w.vascularEvidence.majorVessel } : null,
        fractureEvidence: w.fractureEvidence ? { occurred: w.fractureEvidence.occurred, fractureType: w.fractureEvidence.fractureType, boneZone: w.fractureEvidence.boneZone, boneRisk: w.fractureEvidence.boneRisk } : null,
        bleedDynamics: w.bleedingProfile ? { initialExternal: w.bleedingProfile.initialExternal, sustainedExternal: w.bleedingProfile.sustainedExternal, currentExternal: w.bleedingProfile.currentExternal, naturalReductionTargetExternal: w.bleedingProfile.naturalReductionTargetExternal, majorVesselLocked: !!w.bleedingProfile.majorVesselLocked } : null,
        partDestructionEvidence: w.partDestructionEvidence || null,
        partDestructionStateAfter: (w.partDestructionEvidence && w.partDestructionEvidence.partDestructionStateAfter) || null,
      };
    });
  }
  return {
    bodyParts: bp,
    wounds: woundsSnap,
    bodyHpTotal: Math.round(m.bodyHpTotal), bodyHpMax: m.bodyHpMax,
    bloodMl: Math.round(m.bloodMl), bloodMax: m.bloodMax,
    externalBleedRate: +(m.externalBleedRate||0).toFixed(1), internalBleedRate: +(m.internalBleedRate||0).toFixed(1),
    pain: Math.round(m.pain), shock: Math.round(m.shock), consciousness: Math.round(m.consciousness),
    heartRate: Math.round(m.heartRate), systolicBP: Math.round(m.systolicBP), diastolicBP: Math.round(m.diastolicBP),
    breathingEfficiency: Math.round(m.breathingEfficiency),
    lifeStatus: Math.round(m.lifeStatus), combatEffectiveness: Math.round(m.combatEffectiveness),
    isDead: !!m.isDead, isDowned: !!m.isDowned, isUnconscious: !!m.isUnconscious,
    deathReason: m.deathReason || null, downReason: m.downReason || null,
    treatments: { tourniquet:tq, bandage:bd, splint:sp, chestSeal:cs },
    // SHOTGUN-PHYS-CLUSTER-1 Phase4 §19: woundCluster 요약 (개별 wound snapshot은 유지)
    woundClusters: (m.woundClusters && Object.keys(m.woundClusters).length) ? Object.values(m.woundClusters).map(c => ({
      id: c.id, type: c.type, partKey: c.partKey, addressClusterKey: c.addressClusterKey,
      woundCount: c.woundCount, sourceWoundIds: c.sourceWoundIds.slice(), clusterSeverity: c.clusterSeverity,
      aggregateBleeding: c.aggregateBleeding, recommendedBandageUnits: c.recommendedBandageUnits, hemostaticUnits: c.hemostaticUnits,
      maxVascularEvidenceLevel: c.maxVascularEvidenceLevel, hasMajorVesselLocked: c.hasMajorVesselLocked, hasFracture: c.hasFracture,
      treatmentsApplied: c.treatmentClusterState,
      contributesToPartDestruction: !!(m.partDestruction && m.partDestruction[c.partKey] && m.partDestruction[c.partKey].sourceClusterIds.indexOf(c.id) >= 0),
      partDestructionStateAfter: (m.partDestruction && m.partDestruction[c.partKey] && m.partDestruction[c.partKey].state) || null,
    })) : null,
    // PART-DESTRUCTION-1 Phase8 §16: 부위파괴 판정 스냅샷
    partDestruction: (m.partDestruction) ? Object.keys(m.partDestruction).reduce((acc, k) => {
      const p = m.partDestruction[k];
      if (p && p.state && p.state !== 'intact') acc[k] = {
        partKey: p.partKey, state: p.state, cumulativeTraumaScore: p.cumulativeTraumaScore, functionalCap: p.functionalCap,
        sourceWoundIds: p.sourceWoundIds.slice(), sourceClusterIds: p.sourceClusterIds.slice(),
        destructionRisk: +(p.destructionRisk || 0).toFixed(3), traumaticLossRisk: +(p.traumaticLossRisk || 0).toFixed(3), evidenceTags: p.evidenceTags.slice(),
      };
      return acc;
    }, {}) : null,
  };
}
function aarArmorSnapshot(u) {
  const out = {};
  if (!u || !u.armorDurability) return out;
  for (const k in u.armorDurability) {
    const d = u.armorDurability[k];
    // SIDE-AAR-ARMOR-DAMAGE-MAP §3: localZones + 보조 손상값 보존 (읽기전용 AAR 표시용)
    out[k] = {
      current: Math.round(d.current || 0), max: Math.round(d.max || 0),
      ratio: d.max ? +(d.current / d.max).toFixed(3) : null,
      material: d.material, durabilityMaterial: d.durabilityMaterial || d.material, sourceId: d.sourceId || null,
      localZones: d.localZones ? JSON.parse(JSON.stringify(d.localZones)) : null,
      spallRisk: d.spallRisk || 0, coatingDamage: d.coatingDamage || 0, visibilityDamage: d.visibilityDamage || 0,
      backfaceDeformationAccum: d.backfaceDeformationAccum || 0, lastBackfaceDeformation: d.lastBackfaceDeformation || 0,
    };
  }
  return out;
}
function aarLoadoutSnapshot(u) {
  return {
    id:u.id, name:u.name, team:u.team, callsign:u.callsign,
    weaponId:u.weaponId, ammoId:u.ammoId,
    bodyArmorId:u.bodyArmorId, helmetId:u.helmetId,
    frontPlateId:u.frontPlateId, backPlateId:u.backPlateId, sidePlateId:u.sidePlateId,
    groinGuardId:u.groinGuardId, shoulderGuardId:u.shoulderGuardId, neckGuardId:u.neckGuardId,
    visorId:u.visorId, slaapId:u.slaapId,
    magAmmo:u.magAmmo, reserveAmmo:u.reserveAmmo,
    medical: aarMedicalSnapshot(u),
    armor: aarArmorSnapshot(u),
  };
}
// 사격 1발 — 발사
function aarShotFired(shooter, weapon) {
  const st = aarUnitStats(shooter.id); if (!st) return;
  st.shotsFired++;
  const aid = (weapon && weapon.ammoId) || shooter.ammoId || 'unknown';
  st.ammoUsedById[aid] = (st.ammoUsedById[aid]||0) + 1;
}
// 사격 1발 — 유닛 명중
function aarShotHit(shooter, weapon) {
  const st = aarUnitStats(shooter.id); if (!st) return;
  st.shotsHit++;
  const aid = (weapon && weapon.ammoId) || shooter.ammoId || 'unknown';
  st.hitsByAmmoId[aid] = (st.hitsByAmmoId[aid]||0) + 1;
}
// 피격 이벤트 (recordImpactEvent에서 호출)
function aarRecordImpact(shooter, target, ia, ex) {
  if (!aarActive()) return;
  const br = GAME.battleReport;
  const eventId = (GAME._impactLogSeq || 0);
  const _ar = _resolveAarArmorResult(ia, ex);
  const _ahr = (ex && ex.armorHitResult) || null;
  const ev = {
    eventId, time: GAME.gameTime || 0,
    shooterId: shooter ? shooter.id : null,
    targetId: target ? target.id : null,
    sourceType: (ex && ex.sourceType) || 'bullet',
    weaponName: ex && ex.weaponName, ammoId: ex && ex.ammoId,
    hitPart: ia.hitPart, impactSide: ia.impactSide || ia.side || (ex && ex.impactSide) || null,
    coverageZone: ia.coverageZone, armorLayer: ia.armorLayer,
    armorResult: _ar.armorResult, penetrationResult: _ar.penetrationResult,
    // SIDE-ARMOR-2D: coverage 메타 보존
    armorHitResult: _ahr,
    selectedLayerType: (ex && ex.selectedLayerType) || (_ahr && _ahr.selectedLayerType) || null,
    coverageSource: (ex && ex.coverageSource) || (_ahr && _ahr.coverageSource) || null,
    durabilityOwnerId: (ex && ex.durabilityOwnerId) || (_ahr && _ahr.durabilityOwnerId) || null,
    backerInfo: (ex && ex.backerInfo) || null,
    bodyTrajectory: (ex && ex.bodyTrajectory) || null,
    bodyTrajectoryLabel: (ex && ex.bodyTrajectoryLabel) || null,
    impactAddressFull: (ia && ia.fullAddress) || (_ahr && _ahr.impactAddress && _ahr.impactAddress.fullAddress) || null,
    aarLabel: ia.aarLabel, debugLabel: ia.debugLabel,
    impactAddress: ia,
    damageSummary: ex && ex.damageSummary,
    medicalSummaryAfter: ex && ex.medicalSummaryAfter,
    // SIDE-AAR-ARMOR-DAMAGE-MAP §2.5: 방어구 손상 정보 (ex/ia fallback)
    armorDamageInfo: (ex && ex.armorDamageInfo) || (ia && ia.armorDamageInfo) || null,
    armorDamageInfos: (ex && ex.armorDamageInfos) || (ia && ia.armorDamageInfos) || null,
  };
  br.impactLog.push(ev);
  if (br.impactLog.length > 400) br.impactLog.shift();
  // 피격 marker (주소 기반 근사 위치, eventId로 고정)
  const mk = aarBuildMarker(ev);
  if (mk) br.hitMarkers.push(mk);
  // 표적 통계
  const st = aarUnitStats(target ? target.id : null);
  if (st) {
    st.receivedHits++;
    const pen = (ia.penetrationResult === 'penetrated' || ia.armorResult === 'penetrated');
    const ric = (ia.penetrationResult === 'ricocheted' || ia.armorResult === 'deflected');
    if (ric) st.receivedRicochets++;
    else if (pen) st.receivedPenetrations++;
    else st.receivedStopped++;
    if (ia.hitPart) st.hitsByPart[ia.hitPart] = (st.hitsByPart[ia.hitPart]||0)+1;
    if (ia.coverageZone) st.hitsByCoverageZone[ia.coverageZone] = (st.hitsByCoverageZone[ia.coverageZone]||0)+1;
    // SIDE-AAR-ARMOR-2C §10: coverage-aware는 인체주소/방호접촉/레이어 통계를 분리 저장
    const slt = ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null;
    if (ia.fullAddress || slt) {
      if (!st.hitsByBodyAddressZone) st.hitsByBodyAddressZone = {};
      if (!st.hitsBySelectedLayerType) st.hitsBySelectedLayerType = {};
      const bz = ia.zone ? (ia.hitPart + '.' + ia.zone) : (ia.hitPart || 'unknown');
      st.hitsByBodyAddressZone[bz] = (st.hitsByBodyAddressZone[bz]||0)+1;
      if (slt) st.hitsBySelectedLayerType[slt] = (st.hitsBySelectedLayerType[slt]||0)+1;
    }
    const arKey = ric ? 'ricocheted' : (pen ? 'penetrated' : 'stopped');
    st.hitsByArmorResult[arKey] = (st.hitsByArmorResult[arKey]||0)+1;
  }
  // 사살 추적용 — 표적에 마지막 피격 기록
  if (target) target._aarLastHit = { shooterId: shooter?shooter.id:null, time: GAME.gameTime||0,
    impactAddress: ia, sourceType: ev.sourceType, ammoId: ev.ammoId, weaponName: ev.weaponName,
    armorDamageInfo: ev.armorDamageInfo || null, armorDamageInfos: ev.armorDamageInfos || null };
}
// 사살/사망 스캔 (checkWinLoss에서 매 tick 호출)
function aarScanDeaths() {
  if (!aarActive()) return;
  const br = GAME.battleReport;
  for (const u of UNITS) {
    const elim = u.isDead || (u.isDowned && !u.conscious);
    if (!elim || u._aarDeathRecorded) continue;
    u._aarDeathRecorded = true;
    const lh = u._aarLastHit;
    const dr = (u.medical && u.medical.deathReason) || null;
    // cause 판정
    let cause = 'unknown', killerId = null;
    if (lh && (GAME.gameTime - lh.time) < 8.0) {
      cause = lh.sourceType || 'bullet'; killerId = lh.shooterId;
    }
    if (dr === 'bleeding' || dr === 'exsanguination') { cause = 'bleeding'; if (!lh || (GAME.gameTime-lh.time)>=8.0) killerId = lh ? lh.shooterId : null; }
    else if (dr === 'shock') { cause = 'shock'; }
    const killer = killerId != null ? UNITS.find(x=>x.id===killerId) : null;
    br.killLog.push({
      time: GAME.gameTime||0,
      killerId, victimId: u.id,
      killerTeam: killer?killer.team:null, victimTeam: u.team,
      weaponName: lh?lh.weaponName:null, ammoId: lh?lh.ammoId:null,
      cause, hitPart: lh?lh.impactAddress.hitPart:null,
      impactAddress: lh?lh.impactAddress:null,
      victimMedical: aarMedicalSnapshot(u),
      isDead: u.isDead, downedUnconscious: (u.isDowned && !u.conscious),
    });
    if (killer && killerId !== u.id) {
      const ks = aarUnitStats(killerId);
      if (ks) ks.kills++;
    }
    // 의료 로그 — 무력화/사망 시점 상태 기록
    const fmStatus = u.isDead ? '사망' : (u.isDowned && !u.conscious) ? '의식불명' : '전투불능';
    const causeKor = { bullet:'총상', fragment:'파편', frag:'파편', blast:'폭압', bleeding:'출혈', shock:'쇼크', unknown:'불명' }[cause] || cause;
    aarMedicalLog(u.id, `${fmStatus} — ${causeKor}${dr?(' / '+dr):''}`);
  }
}
// 의료 로그 (선택적, 주요 변화)
function aarMedicalLog(unitId, label, fields) {
  if (!aarActive()) return;
  const entry = { time: GAME.gameTime||0, unitId, label };
  if (fields && typeof fields === 'object') Object.assign(entry, fields);   // HOTFIX 2-4: 구조화 필드 (action/tier/consumed/combo/recurrence/blocked 등)
  GAME.battleReport.medicalLog.push(entry);
  if (GAME.battleReport.medicalLog.length > 200) GAME.battleReport.medicalLog.shift();
}
// 장비 손상 로그 (durability 변화)
function aarArmorLog(unitId, slotKey, before, after, sourceId) {
  if (!aarActive()) return;
  GAME.battleReport.armorLog.push({ time: GAME.gameTime||0, unitId, slotKey, before:Math.round(before), after:Math.round(after), sourceId });
  if (GAME.battleReport.armorLog.length > 300) GAME.battleReport.armorLog.shift();
}

// === 피격 marker 위치 (주소 기반 근사, eventId로 고정 pseudo-random) ===
function _aarSeed(n) { const x = Math.sin((n+1) * 49.317) * 43758.5453; return x - Math.floor(x); }
function aarBuildMarker(ev) {
  const ia = ev.impactAddress; if (!ia) return null;
  // AAR-MARKER-LIMB-FIX-1: hitPart가 'right_leg'(snake) 형태로 오는 경우가 있어 limb 분기('rightLeg')를 못 타고
  //   몸통 fallback(y≈42~50, 흉부 높이)으로 떨어지던 버그 수정. 여기서 camelCase로 정규화한다.
  const _rawHp = ia.hitPart;
  const hp = (typeof resolveBodyPartKey === 'function' && typeof _rawHp === 'string' && /_/.test(_rawHp))
    ? resolveBodyPartKey(_rawHp, null) : _rawHp;
  let aspect = (ia.impactSide === 'left' || ia.impactSide === 'right') ? 'side'
             : (ia.impactSide === 'rear' ? 'rear' : (ia.impactSide === 'front' ? 'front' : 'front'));
  // view: 머리=head (얼굴/두개골만), 목·그 외=torso
  const isHead = (hp === 'head' || hp === 'face' || (typeof hp==='string' && hp.indexOf('head')===0));
  const view = isHead ? 'head' : 'torso';
  const j1 = (_aarSeed(ev.eventId*2)-0.5), j2 = (_aarSeed(ev.eventId*2+1)-0.5);
  // 2A-6.4-AAR: 좌우 판정 (arm/leg/측면)
  const isLeft = (hp === 'leftArm' || hp === 'leftLeg') ? true
               : (hp === 'rightArm' || hp === 'rightLeg') ? false
               : (ia.impactSide === 'left') ? true
               : (ia.impactSide === 'right') ? false : (j1 < 0);
  let x=50, y=45;
  const cz = ia.coverageZone;
  if (isHead) {
    // head SVG 100x60
    if (cz === 'eyeGlass' || cz === 'visionSlitGlass' || cz === 'glassVisor' || cz === 'ballisticGlass') { x=50+j1*16; y=34+j2*6; }
    else if (cz === 'titaniumFacePlate' || cz === 'steelFacePlate' || cz === 'metalFacePlate' || cz === 'faceShieldHard') { x=50+j1*18; y=40+j2*8; }
    else if (cz === 'faceExposed' || cz === 'faceSoft' || hp === 'face') {
      const fl = ia.faceLocation;
      if (fl === 'eyes' || fl === 'brow') { x=50+j1*14; y=33+j2*4; }
      else if (fl === 'nose') { x=50+j1*6; y=40+j2*3; }
      else if (fl === 'mouth' || fl === 'jaw' || fl === 'lowerFace') { x=50+j1*10; y=48+j2*5; }
      else if (fl === 'cheekLeft') { x=38+j1*5; y=42+j2*5; }
      else if (fl === 'cheekRight') { x=62+j1*5; y=42+j2*5; }
      else { x=50+j1*16; y=40+j2*8; }
    }
    else if (cz === 'helmetShell' || cz === 'helmetLiner') {
      const hz = ia.helmetZone;
      if (hz === 'helmetSideFront'||hz==='helmetSideCenter'||hz==='helmetSideRear') { aspect='side'; x=(hz==='helmetSideRear'?64:(hz==='helmetSideFront'?34:48))+j1*6; y=22+j2*8; }
      else if (hz === 'helmetRearCenter'||hz==='helmetRearLower') { aspect='rear'; x=50+j1*18; y=(hz==='helmetRearLower'?28:20)+j2*6; }
      else if (hz === 'helmetTop') { x=50+j1*16; y=12+j2*4; }
      else { x=50+j1*22; y=16+j2*8; }
    } else { x=50+j1*20; y=20+j2*10; }
  } else {
    // ===== torso SVG 100x100. 우선순위: accessory → limb/anatomical → neck → coverage/edge/soft/exposed → side → hitPart =====
    const armX = isLeft ? 13 : 87;      // 전면 view 팔 x
    const legX = isLeft ? 41 : 59;      // 전면 view 다리 x
    const acc = ia.accessoryType, accZ = ia.accessoryLocation;
    // --- 1) 추가보호대 세부존 ---
    if (isBodyGuardAccessory(acc) && accZ) {
      if (acc === 'groin') {
        if (accZ === 'groin' || accZ === 'groinAdjacent' || accZ === 'pelvisGroinAdjacent') { x=50+j1*8; y=90+j2*3; }
        else if (accZ === 'pelvisAdjacent') { x=50+j1*12; y=83+j2*3; }
        else if (accZ === 'lowerAbdomenFront' || accZ === 'lowerAbdomenCenter') { x=50+j1*12; y=83+j2*3; }
        else if (accZ === 'lowerAbdomenAdjacent') { x=50+j1*16; y=84+j2*3; }
        else if (accZ === 'upperInnerThighProximal') { x=(isLeft?45:55)+j1*3; y=92+j2*2; }
        else if (accZ === 'sideAbdomen') { x=(j1<0?30:70)+j1*4; y=80+j2*4; }
        else { x=50+j1*12; y=86+j2*4; }
      } else if (acc === 'shoulder') {
        if (accZ === 'shoulderCap' || accZ === 'shoulderJoint') { x=(isLeft?26:74)+j1*4; y=27+j2*3; }
        else if (accZ === 'deltoid') { x=(isLeft?22:78)+j1*4; y=31+j2*3; }
        else if (accZ === 'upperArmProximal') { x=(isLeft?18:82)+j1*4; y=35+j2*3; }
        else if (accZ === 'axillaAdjacent') { x=(isLeft?30:70)+j1*3; y=33+j2*3; }
        else { x=(isLeft?24:76)+j1*4; y=29+j2*3; }
      } else { // neck / 6b23_builtin_neck
        if (accZ === 'collarLine') { x=50+j1*10; y=19+j2*2; }
        else if (accZ === 'throatAdjacent') { x=50+j1*5; y=15+j2*2; }
        else if (accZ === 'lowerNeck') { x=50+j1*8; y=17+j2*2; }
        else if (accZ === 'rearNeck') { aspect='rear'; x=50+j1*8; y=15+j2*2; }
        else { x=50+j1*8; y=16+j2*3; }
      }
    }
    // --- 2) 사지 세부 (limbLocation) ---
    else if (hp === 'leftArm' || hp === 'rightArm') {
      // AAR-MARKER-LIMB-FIX-1 / ANATOMY-AUDIT-1: limbLocation이 비면 zone에서 유도. 어깨~손 순서대로 y 증가.
      const _z = String(ia.limbLocation || ia.zone || ia.subZone || '').toLowerCase();
      const ll = /axilla|armpit/.test(_z) ? 'axilla'
               : /elbow/.test(_z) ? 'elbowJoint'
               : /forearm|radius|ulna|wrist/.test(_z) ? 'forearm'
               : /hand|finger/.test(_z) ? 'hand'
               : /shoulder|deltoid/.test(_z) ? 'shoulder'
               : /proximal/.test(_z) ? 'upperArmProximal'
               : /upper_arm|upperarm|humerus|bicep|tricep/.test(_z) ? 'upperArm'
               : (ia.limbLocation || null);
      if (ll === 'shoulder') { x=armX+(isLeft?5:-5)+j1*3; y=31+j2*3; }        // 어깨/삼각근
      else if (ll === 'axilla') { x=armX+(isLeft?7:-7)+j1*3; y=36+j2*2; }     // 겨드랑이 (어깨 바로 아래, 몸통 쪽)
      else if (ll === 'upperArmProximal') { x=armX+(isLeft?3:-3)+j1*3; y=40+j2*3; }
      else if (ll === 'upperArm') { x=armX+j1*4; y=48+j2*5; }                 // 상완
      else if (ll === 'elbowJoint') { x=armX+j1*3; y=61+j2*3; }               // 팔꿈치
      else if (ll === 'forearm' || ll === 'forearmDistal') { x=armX+j1*4; y=71+j2*5; }   // 전완
      else if (ll === 'hand') { x=armX+j1*3; y=80+j2*2; }                     // 손
      else { x=armX+j1*5; y=52+j2*14; }   // 기본 팔
    }
    else if (hp === 'leftLeg' || hp === 'rightLeg') {
      // 하지 y 80~100 (복부/골반보다 확실히 아래). zone에서 세부 위치 유도.
      const _z = String(ia.limbLocation || ia.zone || ia.subZone || '').toLowerCase();
      const ll = /femoral_triangle|groin|inguinal/.test(_z) ? 'femoralTriangle'
               : /knee|patella/.test(_z) ? 'kneeJoint'
               : /shin|tibia|fibula|calf|lower_leg|lowerleg/.test(_z) ? 'lowerLeg'
               : /foot|ankle|toe/.test(_z) ? 'foot'
               : /upper_thigh|proximal|hip|inner/.test(_z) ? 'thighProximal'
               : /thigh|femur|quad|hamstring/.test(_z) ? 'thigh'
               : (ia.limbLocation || null);
      if (ll === 'femoralTriangle') { x=legX+(isLeft?3:-3)+j1*2; y=82+j2*1.2; }   // 대퇴삼각 — 다리 최상단
      else if (ll === 'thighProximal' || ll === 'innerThigh' || ll === 'upperInnerThighProximal') { x=legX+(isLeft?2:-2)+j1*3; y=84+j2*2; }
      else if (ll === 'thigh') { x=legX+j1*4; y=88+j2*3; }                    // 허벅지
      else if (ll === 'kneeJoint') { x=legX+j1*3; y=93+j2*1.5; }              // 무릎
      else if (ll === 'lowerLeg' || ll === 'lowerLegDistal') { x=legX+j1*4; y=97+j2*2; }   // 정강이
      else if (ll === 'foot') { x=legX+j1*3; y=100+j2*0.8; }                  // 발
      else { x=legX+j1*5; y=89+j2*7; }    // 기본 다리
    }
    // --- 3) 목 / 접합부 (neckLocation / anatomicalZone) ---
    else if (hp === 'neck' || hp === 'neck_soft') {
      const nl = ia.neckLocation;
      if (nl === 'throat' || nl === 'frontNeck') { x=50+j1*6; y=15+j2*2; }
      else if (nl === 'lowerNeck') { x=50+j1*7; y=18+j2*2; }
      else if (nl === 'sideNeckLeft') { x=43+j1*3; y=16+j2*2; }
      else if (nl === 'sideNeckRight') { x=57+j1*3; y=16+j2*2; }
      else if (nl === 'rearNeck') { aspect='rear'; x=50+j1*7; y=15+j2*2; }
      else { x=50+j1*9; y=16+j2*3; }
    }
    // --- 3.5) SIDE-ARMOR-2D: coverage-aware 주소 (fullAddress + zone/selectedLayerType) ---
    else if (ia.fullAddress && (ia.zone || ev.selectedLayerType) && (hp === 'abdomen' || hp === 'chest')) {
      const slt = ev.selectedLayerType || '';
      const z = ia.zone, sz = ia.subZone, sideHit = (ia.impactSide === 'left' || ia.impactSide === 'right' || ia.impactSide === 'side');
      // PLATE-MARKER-ALIGN-1: 실제 방호 판정(coverageZone/coverageSource)에 마커를 맞춘다.
      //   6B23 frontSet 도형: 가슴판 y24~55(x30~70), 복부판 y57~74(x41~59), 하부 소프트 apron y72~89
      const _cz = ia.coverageZone || (ev.coverageZone || '');
      const _csrc = ia.coverageSource || ev.coverageSource || '';
      const _hardPlateHit = (_cz === 'plateCore' || _cz === 'plateEdge')
        || /front_hard_plate|frontset_abdomen/.test(String(slt) + ' ' + String(_csrc));
      const _plateEdge = (_cz === 'plateEdge');
      const _frontPlateLowerEdge = /front_plate_lower_edge/.test(String(_csrc) + ' ' + String(ev.coverageSource || ''));
      // SIDE-AAR-MARKER-ANATOMY-1: 새 흉부 세부존(쇄골/쇄골상부/목빗/겨드랑이/측흉부)을 해부학적 높이로 배치 (side_core/side plate보다 먼저)
      if (hp === 'chest' && (z === 'axilla_gap' || sz === 'axilla_gap' || z === 'axilla')) {
        aspect = 'side'; x = (isLeft ? 26 : 74) + j1*4; y = 33+j2*4;                    // 겨드랑이 틈 (어깨 아래 측면)
      } else if (hp === 'chest' && (z === 'supraclavicular' || sz === 'supraclavicular')) {
        x = 50 + j1*8; y = 21+j2*2;                                                     // 쇄골 상부 (목 바로 아래)
      } else if (hp === 'chest' && (z === 'clavicle' || sz === 'clavicle')) {
        x = 50 + (/left/.test(String(sz))? -9 : /right/.test(String(sz))? 9 : j1*11); y = 24+j2*2;   // 쇄골
      } else if (hp === 'chest' && (z === 'collar_line_left' || z === 'collar_line_right' || z === 'collar_line')) {
        x = 50 + (z === 'collar_line_left' ? -9 : z === 'collar_line_right' ? 9 : j1*10); y = 23+j2*2; // 목빗선
      } else if (hp === 'chest' && (z === 'upper_lateral' || sz === 'upper_lateral')) {
        aspect = 'side'; x = (isLeft ? 22 : 78) + j1*4; y = 38+j2*5;                    // 상부 측흉부
      } else if (hp === 'chest' && (z === 'lower_lateral' || sz === 'lower_lateral')) {
        aspect = 'side'; x = (isLeft ? 24 : 76) + j1*4; y = 50+j2*5;                    // 하부 측흉부
      } else if (hp === 'chest' && (z === 'mid' || z === 'upper' || z === 'lower') && !sideHit) {
        // AAR-MARKER-ANATOMY-AUDIT-1: 흉부 정면 상/중/하 — 쇄골(24) 아래부터 명치(56)까지 균등 분포
        x = 50+j1*18; y = (z === 'upper' ? 33 : z === 'lower' ? 52 : 43)+j2*4;
      } else if (slt === 'side_hard_plate' || slt === 'side_soft' || z === 'side_core' || (hp === 'chest' && sideHit)) {
        aspect = 'side'; x = 50+j1*14; y = (hp === 'chest') ? 43+j2*9 : 65+j2*8;   // 측면판/측면 소프트
      } else if (z === 'groin' || sz === 'groin' || slt === 'groin_protector' || slt === 'built_in_groin_adjacent_soft') {
        // 서혜부: 하드 플레이트가 막았다면 복부판 하단 안쪽(y≤74), 아니면 판 아래 소프트/노출 구간
        if (_hardPlateHit) { x = 50+j1*7; y = 72.5+j2*1.5; }
        else { x = 50+j1*7; y = 77.5+j2*1.5; }                                        // 서혜부 (다리 시작보다 확실히 위)
      } else if (sz === 'groin_adjacent') {
        // 서혜부 인접: 복부 플레이트가 덮는 높이면 판 안(하단), 아니면 판 아래
        if (_hardPlateHit) { x = 50+j1*7; y = 71.5+j2*1.5; }
        else { x = 50+j1*10; y = 76+j2*1.5; }
      } else if (hp === 'abdomen' && (z === 'kidney_left' || z === 'kidney_right' || sz === 'kidney_left' || sz === 'kidney_right')) {
        aspect = 'rear'; x = 50 + (/kidney_left/.test(z+' '+sz) ? -12 : 12) + j1*3; y = 63+j2*3;   // 후복부 신장 (좌/우)
      } else if (hp === 'abdomen' && (z === 'pelvis_rear')) {
        aspect = 'rear'; x = 50+j1*14; y = 75+j2*2;                                   // 후복부 골반후면
      } else if (hp === 'abdomen' && (z === 'upper_flank' || sz === 'upper_flank')) {
        aspect = 'side'; x = (isLeft ? 24 : 76) + j1*5; y = 61+j2*3;                  // 상부 옆구리
      } else if (hp === 'abdomen' && (z === 'lower_flank' || sz === 'lower_flank')) {
        aspect = 'side'; x = (isLeft ? 26 : 74) + j1*5; y = 70+j2*3;                  // 하부 옆구리
      } else if (hp === 'abdomen' && sideHit) {
        aspect = 'side'; x = 44+j1*10; y = 66+j2*7;                                   // 복부 측면
      } else if (z === 'pelvis' || sz === 'pelvis_upper') {
        // PLATE-MARKER-ALIGN-1: 골반이 하드 플레이트 판정이면 복부판(y57~74) 하단 안쪽, 아니면 판 아래(소프트 apron 구간)
        if (_hardPlateHit) { x = 50+j1*7; y = 71+j2*2; }                             // 복부 플레이트 하단부
        else { x = 50+j1*12; y = 76+j2*2; }                                           // 골반 상부 (판 아래)
      } else if (hp === 'abdomen' && (z === 'lower' || ((slt === 'built_in_lower_front_soft' || slt === 'frontset_abdomen_hard') && z !== 'upper' && z !== 'mid'))) {
        // 하복부: 복부 플레이트(41~59 × 57~74) 판정이면 그 안쪽, 소프트/노출이면 판 아래
        if (_hardPlateHit) { x = 50+j1*7; y = (_plateEdge ? 72 : 68)+j2*2; }          // 복부 플레이트 내부 (edge면 하단쪽)
        else { x = 50+j1*15; y = 74+j2*3; }                                           // 하복부 노출 (판 아래)
      } else if (hp === 'abdomen' && z === 'mid') {
        if (_hardPlateHit) { x = 50+j1*7; y = 64+j2*3; }                              // 복부 플레이트 중앙
        else { x = 50+j1*16; y = 67+j2*3; }
      } else if (hp === 'abdomen') {
        // 상복부: 가슴판 하단 엣지에만 스치는 판정(front_plate_lower_edge)이면 가슴판(24~55) 하단부에 찍는다.
        if (_frontPlateLowerEdge) { x = 50+j1*13; y = 53+j2*2; }                      // 가슴 플레이트 하단 엣지
        else if (_hardPlateHit) { x = 50+j1*7; y = 59+j2*2; }                         // 복부 플레이트 상단 (frontset)
        else { x = 50+j1*16; y = 61+j2*3; }                                           // 상복부 노출/소프트
      } else {
        x = 50+j1*20; y = 42+j2*12;                                                   // 흉부 전면
      }
    }
    // --- 4) 측면 플레이트 — side view 우선 ---
    else if (ia.plateLocation === 'sidePlate' || cz === 'sidePlate' || cz === 'sidePlateEdge' || cz === 'sidePlateCore') {
      aspect = 'side';
      x = 50+j1*14; y = 50+j2*12;        // 측면 view 측면판 중앙
    }
    // --- 5) 복부 측면 / 옆구리 — front center 금지, 측면 또는 외곽 ---
    else if (hp === 'abdomen' && (ia.impactSide === 'left' || ia.impactSide === 'right' || ia.impactSide === 'side')) {
      aspect = 'side';
      x = 44+j1*10; y = 64+j2*8;          // 측면 view 복부 (전방=좌측)
    }
    // --- 6) 플레이트 중심/엣지 (실제 플레이트 있을 때만 plateCore) ---
    else if (cz === 'plateCore') {
      if (hp === 'abdomen') { x=50+j1*14; y=65+j2*7; }
      else { x=50+j1*22; y=42+j2*15; }
    }
    else if (cz === 'plateEdge') {
      const el = ia.edgeLocation;
      if (hp === 'abdomen') {
        if (el === 'lowerEdge') { x=50+j1*16; y=73+j2*2; }
        else if (el === 'leftSideEdge') { x=42+j1*2; y=65+j2*7; }
        else if (el === 'rightSideEdge') { x=58+j1*2; y=65+j2*7; }
        else { x=50+j1*16; y=58+j2*2; }
      }
      else if (el === 'upperShoulderEdge') { x=(j1<0?34:66)+j1*6; y=27+j2*3; }
      else if (el === 'lowerEdge') { x=50+j1*28; y=54+j2*2; }
      else if (el === 'leftSideEdge') { x=31+j1*3; y=42+j2*13; }
      else if (el === 'rightSideEdge') { x=69+j1*3; y=42+j2*13; }
      else if (el === 'topFlatEdge' || el === 'upperEdge') { x=50+j1*28; y=26+j2*3; }
      else { x=50+j1*30; y=28+j2*5; }
    }
    // --- 6b) 실제 플레이트 없는 하드 근사 (IOTV 복부 등) ---
    else if (cz === 'rearLowerHardApprox') { aspect='rear'; x=50+j1*20; y=72+j2*8; }
    else if (cz === 'lowerHardApprox') { x=50+j1*22; y=80+j2*7; }
    else if (cz === 'softOnly' || cz === 'softInsert') {
      if (hp === 'abdomen') { x=50+j1*24; y=80+j2*8; }
      else {
        const sl = ia.softLocation;
        if (sl === 'softUpper' || sl === 'shoulderCoverage' || sl === 'sideWrapUpper') { x = (j2<0 ? 30 : 70) + j1*8; y = 22+Math.abs(j2)*4; }
        else if (sl === 'softLateral' || sl === 'softFlank' || sl === 'sideWrapCenter' || sl === 'sideWrapFrontEdge' || sl === 'sideWrapRearEdge') { x = (j1<0 ? 25 : 75) + j1*4; y = 42+j2*14; }
        else if (sl === 'softLower') { x = 50+j1*24; y = 60+j2*4; }
        else if (sl === 'softRearUpper'||sl==='softRearCenter'||sl==='softRearLower') { aspect='rear'; x=50+j1*22; y=(sl==='softRearLower'?70:(sl==='softRearUpper'?34:50))+j2*8; }
        else { x = (j2<0 ? 32 : 68) + j1*10; y = 23+Math.abs(j2)*4; }
      }
    }
    else if (cz === 'unprotectedGap') {
      const xl = ia.exposedLocation;
      if (xl === 'axillaGap'||xl==='armShoulderGap') { x=(isLeft?24:76)+j1*4; y=32+j2*6; }
      else if (xl === 'flankGap'||xl==='flankExposed') { x=(j1<0?22:78)+j1*4; y=62+j2*8; }
      else if (xl === 'lowerAbdomenExposed'||xl==='lowerGap') { x=50+j1*20; y=82+j2*7; }
      else if (xl === 'pelvisGroinAdjacent') { x=50+j1*16; y=89+j2*4; }
      else if (xl === 'upperLateralGap') { x=(j1<0?26:74)+j1*4; y=25+j2*4; }
      else if (xl === 'neckAdjacent') { x=50+j1*10; y=19+j2*3; }
      else { x=50+j1*30; y=(hp==='abdomen'?80:55)+j2*16; }
    }
    else if (hp === 'abdomen') { x=50+j1*24; y=72+j2*10; }
    else { x=50+j1*26; y=45+j2*18; }
  }
  // 2A-6.4-AAR: viewBox 범위 clamp + NaN 방어
  const maxY = isHead ? 60 : 100;
  if (!isFinite(x)) x = 50; if (!isFinite(y)) y = 45;
  x = Math.max(2, Math.min(98, x));
  y = Math.max(2, Math.min(maxY-2, y));
  const pen = (ev.penetrationResult === 'penetrated' || ev.armorResult === 'penetrated' || ia.penetrationResult === 'penetrated' || ia.armorResult === 'penetrated');
  const ric = (ev.penetrationResult === 'ricocheted' || ev.armorResult === 'deflected' || ia.penetrationResult === 'ricocheted' || ia.armorResult === 'deflected');
  const crack = !!(ia.crackHint && ia.crackHint.eligible);
  const st = ev.sourceType || 'bullet';
  const source = (st === 'frag' || st === 'fragment' || st === 'blast' || st === 'shrapnel') ? 'frag' : 'bullet';
  return {
    eventId: ev.eventId, targetId: ev.targetId, view, aspect,
    x:+x.toFixed(1), y:+y.toFixed(1),
    kind: ric ? 'ricochet' : (crack ? 'crack' : (pen ? 'penetrated' : 'stopped')),
    source,
    approx: true,
  };
}

function recordImpactEvent(shooter, target, impactAddress, extra) {
  // (정의는 아래에 이어짐 — 플레이스홀더 방지용 선행 선언 없음)
  return _recordImpactEvent_impl(shooter, target, impactAddress, extra);
}
function aarFinalize(result) {
  if (!aarActive() || GAME.battleReport.finalized) return;
  const br = GAME.battleReport;
  aarScanDeaths();
  br.result = result;
  br.endTime = GAME.gameTime || 0;
  br.duration = Math.max(0, br.endTime - br.startTime);
  for (const u of UNITS) {
    br.unitsFinal[u.id] = aarLoadoutSnapshot(u);
    br.finalMedical[u.id] = aarMedicalSnapshot(u);
    br.finalArmor[u.id] = aarArmorSnapshot(u);
  }
  br.summary = aarBuildSummary();
  br.finalized = true;
  // 사후강평 표시
  if (typeof showAarOverlay === 'function') showAarOverlay();
}
function aarBuildSummary() {
  const br = GAME.battleReport;
  const s = {
    totalShots:0, totalHits:0, hitRate:0,
    totalImpacts: br.impactLog.length,
    penetrations:0, stopped:0, ricochets:0, gaps:0,
    friendDead:0, friendDown:0, friendAlive:0,
    enemyDead:0, enemyDown:0, enemyAlive:0,
    hitsByPart:{}, ammoUsage:{}, coverageZoneStats:{},
    topKiller:null, topVictim:null, mostHitPart:null, topAmmo:null,
  };
  for (const id in br.unitStats) {
    const st = br.unitStats[id];
    s.totalShots += st.shotsFired; s.totalHits += st.shotsHit;
    for (const a in st.ammoUsedById) { s.ammoUsage[a] = (s.ammoUsage[a]||0) + st.ammoUsedById[a]; }
  }
  s.hitRate = s.totalShots > 0 ? Math.round(s.totalHits/s.totalShots*100) : 0;
  for (const ev of br.impactLog) {
    const pen = (ev.penetrationResult==='penetrated'||ev.armorResult==='penetrated');
    const ric = (ev.penetrationResult==='ricocheted'||ev.armorResult==='deflected');
    if (ric) s.ricochets++; else if (pen) s.penetrations++; else s.stopped++;
    if (ev.coverageZone==='unprotectedGap') s.gaps++;
    if (ev.hitPart) s.hitsByPart[ev.hitPart]=(s.hitsByPart[ev.hitPart]||0)+1;
    if (ev.coverageZone) s.coverageZoneStats[ev.coverageZone]=(s.coverageZoneStats[ev.coverageZone]||0)+1;
  }
  for (const u of UNITS) {
    const elim = u.isDead || (u.isDowned && !u.conscious);
    const downOnly = (u.isDowned && u.conscious);
    if (u.team === 'friend') { if (u.isDead) s.friendDead++; else if (elim||downOnly) s.friendDown++; else s.friendAlive++; }
    else { if (u.isDead) s.enemyDead++; else if (elim||downOnly) s.enemyDown++; else s.enemyAlive++; }
  }
  // top killer / victim
  let maxK=-1, maxV=-1;
  for (const id in br.unitStats) {
    const st = br.unitStats[id];
    if (st.kills > maxK) { maxK = st.kills; s.topKiller = {id:+id, kills:st.kills}; }
    if (st.receivedHits > maxV) { maxV = st.receivedHits; s.topVictim = {id:+id, hits:st.receivedHits}; }
  }
  if (maxK <= 0) s.topKiller = null;
  // most hit part / top ammo
  let mp=null,mpv=-1; for (const k in s.hitsByPart) if (s.hitsByPart[k]>mpv){mpv=s.hitsByPart[k];mp=k;} s.mostHitPart=mp;
  let ta=null,tav=-1; for (const k in s.ammoUsage) if (s.ammoUsage[k]>tav){tav=s.ammoUsage[k];ta=k;} s.topAmmo=ta;
  return s;
}
// AAR 확인 후 초기화 — 다음 전투 준비
function aarReset() {
  // 미니로그도 초기화
  GAME._impactLog = [];
  GAME._impactLogSeq = 0;
  // battleReport 제거
  GAME.battleReport = null;
  // 유닛 장구류 내구도 + 의료 복구
  for (const u of UNITS) {
    if (typeof rebuildArmorDurability === 'function') rebuildArmorDurability(u);
    u._aarDeathRecorded = false; u._aarLastHit = null;
  }
  // 실제 유닛/상태 초기화는 기존 reset 흐름(returnToLoadout/setupGame)에 위임
}

// SIDE-ARMOR-2D: AAR 결과 fallback — event/extra → impactAddress → armorHitResult → damageSummary.penetrated
function _resolveAarArmorResult(ia, ex) {
  ex = ex || {}; ia = ia || {};
  const ahr = ex.armorHitResult || null;
  let armorResult = ex.armorResult || ia.armorResult || (ahr && ahr.armorResult) || null;
  let penetrationResult = ex.penetrationResult || ia.penetrationResult || (ahr && ahr.penetrationResult) || null;
  const penFlag = ex.damageSummary && ex.damageSummary.penetrated;
  if (!armorResult && !penetrationResult) {
    if (penFlag === true) { armorResult = 'penetrated'; penetrationResult = 'penetrated'; }
    else if (penFlag === false) { armorResult = 'stopped'; }
  }
  if (penFlag === true && !penetrationResult) penetrationResult = 'penetrated';
  return { armorResult, penetrationResult };
}
function _recordImpactEvent_impl(shooter, target, impactAddress, extra) {
  if (typeof GAME === 'undefined') return;
  if (!GAME._impactLog) GAME._impactLog = [];
  const ex = extra || {};
  const _ar = _resolveAarArmorResult(impactAddress, ex);
  // impactAddress에 결과 동기화 (누락 보강 — 표시 일관성)
  if (impactAddress && !impactAddress.armorResult && _ar.armorResult) impactAddress.armorResult = _ar.armorResult;
  if (impactAddress && !impactAddress.penetrationResult && _ar.penetrationResult) impactAddress.penetrationResult = _ar.penetrationResult;
  GAME._impactLog.push({
    eventId: (GAME._impactLogSeq = (GAME._impactLogSeq || 0) + 1),
    time: GAME.gameTime || 0,
    shooterId: shooter ? shooter.id : null,
    targetId: target ? target.id : null,
    sourceType: ex.sourceType || 'bullet',
    hitPart: impactAddress.hitPart,
    impactAddress,
    armorResult: _ar.armorResult,
    penetration: _ar.penetrationResult,
    damageSummary: ex.damageSummary || null,
    medicalSummaryAfter: ex.medicalSummaryAfter || null,
    // SIDE-AAR-ARMOR-DAMAGE-MAP §2.4: 방어구 손상 정보 보존 (ex/impactAddress fallback, null guard)
    armorDamageInfo: ex.armorDamageInfo || (impactAddress && impactAddress.armorDamageInfo) || null,
    armorDamageInfos: ex.armorDamageInfos || (impactAddress && impactAddress.armorDamageInfos) || null,
  });
  // 최근 60개만 유지
  if (GAME._impactLog.length > 60) GAME._impactLog.shift();
  // 2A-3.5: AAR 전체 로그에도 기록
  aarRecordImpact(shooter, target, impactAddress, ex);
}

function resolveAmmoForWeapon(shooter, weapon) {
  if (!weapon) return weapon;
  // small/shotgun/기타 사격 무기 모두 통과 — 명시적 차단은 type이 빈 경우만
  if (weapon.type && weapon.type !== 'small' && weapon.type !== 'shotgun') return weapon;
  // 로드아웃 선택을 우선 — unit.ammoId가 weapon.ammoId보다 우선
  const ammoId = (shooter && shooter.ammoId) || weapon.ammoId;
  if (!ammoId) return weapon;
  const ammo = AMMO_PRESETS[ammoId];
  if (!ammo) return weapon;

  // 새 ammo 구조 — ammo.damage / suppression / recoil 중심
  // 기존 weapon.damage 는 fallback. ammo.damage가 있으면 damageScale을
  // ammo.damage / AMMO_DAMAGE_BASELINE 로 변환해 applyOutcome()의
  // 부위별 피해 비율을 자연스럽게 보정한다.
  const baseScale = (weapon.damageScale != null) ? weapon.damageScale : 1.0;
  let dmgScale = baseScale;
  if (ammo.damage != null) {
    dmgScale = baseScale * (ammo.damage / AMMO_DAMAGE_BASELINE);
  } else if (ammo.damageBonus != null) {
    // 구식 보너스 fallback
    dmgScale = baseScale * (1 + ammo.damageBonus * 0.04);
  }

  // 제압 — 기존 weapon.suppressionHit/Miss에 ammo.suppression을 더한다.
  // (구식 suppressionBonus와도 호환)
  const supExtra = (ammo.suppression != null) ? ammo.suppression
                 : (ammo.suppressionBonus != null) ? ammo.suppressionBonus : 0;

  return {
    ...weapon,
    // 관통력은 fabric 기준 베이스만 weapon.penetration에 넣어두고,
    // resolveImpact()에서 effectivePenetration(ammo, weapon, material)로 재계산한다.
    penetration:     ammo.penetration != null ? ammo.penetration : weapon.penetration,
    damage:          (ammo.damage != null) ? ammo.damage : weapon.damage,
    damageScale:     dmgScale,
    suppressionHit:  (weapon.suppressionHit  || 0) + supExtra,
    suppressionMiss: (weapon.suppressionMiss || 0) + (supExtra > 0 ? 1 : 0),
    // finalRecoil = 총기 자체 반동 + 탄약 반동
    recoil:          (weapon.recoilBase || 0) + (ammo.recoil || 0),
    // 탄약 정확도 (탄퍼짐에 영향) — 1.0 기본
    accuracyMul:     (ammo.accuracyMul != null) ? ammo.accuracyMul : 1.0,
    // 저지력/고통 계수 — applyOutcome에서 사용
    stoppingPower:   (ammo.stoppingPower != null) ? ammo.stoppingPower : 1.0,
    painMul:         (ammo.painMul       != null) ? ammo.painMul       : 1.0,
    ammoId, ammoName: ammo.name, ammoCaliber: ammo.caliber,
    _ammo: ammo,
  };
}
// =============================================================
