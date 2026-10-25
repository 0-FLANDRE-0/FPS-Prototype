// PART-DESTRUCTION-1 Phase2~7 — 부위 상태/누적외상/기능상한 판정층
//   개별 wound / bodyPart.hp / bleedingProfile은 삭제하지 않는다. partDestruction은 판정/표시층.
// ============================================================
function ensurePartDestructionModel(unit) {
  if (!unit || !unit.medical) return null;
  const m = unit.medical;
  if (!m.partDestruction) m.partDestruction = _makeAllPartDestruction();
  else for (const k of BODY_PART_KEYS) { if (!m.partDestruction[k]) m.partDestruction[k] = makeDefaultPartDestruction(k); }
  return m.partDestruction;
}
function getPartDestruction(unit, partKey) {
  const pd = ensurePartDestructionModel(unit);
  if (!pd || !partKey) return null;
  if (!pd[partKey]) pd[partKey] = makeDefaultPartDestruction(partKey);
  return pd[partKey];
}
// Phase3 §5: 단발 wound의 외상 contribution
function computePartDestructionContribution(wound, ev, ctx) {
  const ws = wound.woundSize || {};
  const fe = wound.fractureEvidence || {};
  const bt = wound.bodyTrajectory || {};
  const bodyDmg = Math.max(0, ctx.bodyDmg || 0);
  const part = ctx.bodyPart || {};
  const partMax = Math.max(1, part.maxHp || 60);
  // [B-STAGE 7.2] 한 탄의 에너지가 body damage/상처/exit/골절/탄체에서 무제한 중복 가산되지 않도록
  //   하위 점수 그룹(연부조직 / 골 / 탄체·발원)별 soft ceiling을 둔다. 전체를 하나의 hard clamp로 누르지 않는다.
  let tissue = 0;
  tissue += Math.min(0.25, (bodyDmg / partMax) * 0.55);
  const sizeClass = ws.sizeClass || 'small';
  if (sizeClass === 'micro') tissue += 0.005;
  else if (sizeClass === 'small') tissue += 0.025;
  else if (sizeClass === 'medium') tissue += 0.07;
  else if (sizeClass === 'large') tissue += 0.16;
  else if (sizeClass === 'massive') tissue += 0.32;
  const exitPresent = ws.exitWoundPresent || wound.exitWoundPresent || (bt && bt.exitWound);
  const exitClass = ws.exitSizeClass || wound.exitSizeClass || (bt && bt.exitSizeClass);
  if (exitPresent) tissue += 0.04;
  if (exitClass === 'large') tissue += 0.08;
  if (exitClass === 'massive') tissue += 0.16;
  tissue += Math.min(0.12, (ws.fragmentationScore || 0) * 0.08);
  tissue += Math.min(0.10, (ws.expansionScore || 0) * 0.06);
  const TISSUE_CEILING = 0.45;
  tissue = Math.min(TISSUE_CEILING, tissue);

  let bone = 0;
  if (fe.occurred) {
    const ft = fe.fractureType || 'simple';
    if (ft === 'hairline') bone += 0.025;
    else if (ft === 'simple') bone += 0.06;
    else if (ft === 'displaced') bone += 0.12;
    else if (ft === 'comminuted') bone += 0.22;
    else if (ft === 'shattered') bone += 0.35;
  }
  bone = Math.min(0.35, bone);

  let projMod = 0;
  const proj = (bt.projectileSizeClass || '') + '';
  if (proj === 'shotgun_slug' || /slug/.test(proj)) projMod += 0.14;
  if (proj === 'anti_material' || /anti_material|127|50bmg/.test(proj)) projMod += 0.28;
  if (proj === 'large_bore' || /large_bore/.test(proj)) projMod += 0.12;
  // source 문자열 단독 가산은 실제 파괴 규모(큰 상처)가 동반될 때만 (작은 파편 자동 가산 금지)
  if (/blast|frag/.test(ctx.sourceType || '') && (sizeClass === 'large' || sizeClass === 'massive')) projMod += 0.08;
  projMod = Math.min(0.30, projMod);

  return Math.max(0, Math.min(1.2, tissue + bone + projMod));
}
// Phase3 §6: 산탄/플레셰트 과누적 방지 scalar
function _shotgunDestructionContributionMul(ammoId, isFlechette, isBuckshot) {
  if (isFlechette) return 0.28;
  if (isBuckshot) return 0.55;
  return 1.0;
}
// Phase7 §13: localCluster 누적 상태
function _localClusterState(score) {
  return score >= 0.75 ? 'catastrophic' : score >= 0.45 ? 'severe' : score >= 0.20 ? 'moderate' : 'minor';
}
// Phase2/3/7: wound에서 partDestruction 갱신
// PART-DESTRUCTION-POST-WOUND-SYNC-1 §4: partDestruction 최종 갱신 이후 vascularEvidence 보강 (confirmed 금지, probable까지만)
function reinforceVascularEvidenceWithPartDestruction(unit, w) {
  if (!unit || !unit.medical || !w || !w.vascularEvidence) return w && w.vascularEvidence;
  const pd = unit.medical.partDestruction && unit.medical.partDestruction[w.partKey];
  if (!pd) return w.vascularEvidence;
  const ve = w.vascularEvidence;
  const RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  const fl = pd._flags || {};
  const bump = (target) => { if ((RANK[ve.level] || 0) < (RANK[target] || 0) && (RANK[target] || 0) <= RANK.probable) ve.level = target; };
  if (pd.state === 'mangled' && fl.vesselAdjacent && fl.deepTrajectory && ve.level === 'candidate') bump('probable');
  if (pd.state === 'destroyed' && fl.vesselAdjacent && (fl.worstFx === 'comminuted' || fl.worstFx === 'shattered')) bump('probable');
  if (pd.state === 'traumatic_amputation' && fl.isLimb && !fl.distalCluster) {
    bump('probable');
    if (ve.level === 'probable' && (ve.vesselClass === 'none' || ve.vesselClass == null || ve.vesselClass === 'capillary_muscle' || ve.vesselClass === 'small_branch')) ve.vesselClass = 'major_named';
  }
  if (pd.evidenceTags && pd.evidenceTags.length) {
    ve.evidenceTags = ve.evidenceTags || [];
    for (const t of pd.evidenceTags) if (ve.evidenceTags.indexOf(t) < 0) ve.evidenceTags.push(t);
  }
  return ve;
}

function updatePartDestructionFromWound(unit, wound, ev, ctx) {
  if (!unit || !unit.medical || !wound) return null;
  const partKey = ctx.partKey || wound.partKey;
  if (!partKey) return null;
  const pd = getPartDestruction(unit, partKey);
  // PART-DESTRUCTION-POST-WOUND-SYNC-1 §3: 이미 contribution 반영된 wound면 재가산 없이 final refresh만 (중복 방지)
  if (pd && pd.sourceWoundIds && pd.sourceWoundIds.indexOf(wound.id) >= 0) {
    refreshPartDestructionState(unit, partKey, { wound, ev, ctx });
    applyPartDestructionEffects(unit, partKey);
    return { contribution: 0, partDestructionContribution: 0, alreadyApplied: true, cumulativeTraumaScore: pd.cumulativeTraumaScore,
      partDestructionStateBefore: pd.state, partDestructionStateAfter: pd.state, localClusterKey: null, localClusterState: null,
      dominantClusterKey: pd.dominantClusterKey || null, dominantClusterState: pd.dominantClusterState || null,
      dominantClusterScore: pd.dominantClusterScore || 0, evidenceTier: pd.evidenceTier || 'minor',
      destructionTags: pd.evidenceTags ? pd.evidenceTags.slice() : [], gateReasons: (pd.gateReasons || []).slice() };
  }
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const partDestructionStateBefore = pd.state;   // [B-STAGE 12.1] AAR 판정 기록용
  const ammoId = wound.shotgunAmmoId || wound.ammoId || ev.ammoId || '';
  const isFlechette = /flechette/.test(ammoId);
  const isBuckshot = /buck/.test(ammoId);
  const gid = ctx.pelletGroupId || wound.pelletGroupId || null;

  let contribution = computePartDestructionContribution(wound, ev, ctx);
  // 산탄 단발 보정
  if (ctx.shotgunPellet || wound.shotgunPellet) contribution *= _shotgunDestructionContributionMul(ammoId, isFlechette, isBuckshot);

  // localCluster 누적 (addressClusterKey 단위)
  const addressClusterKey = (typeof normalizeWoundAddressCluster === 'function')
    ? normalizeWoundAddressCluster(partKey, wound.normalizedMedicalAddress || wound.impactAddress || ev.impactAddress || 'generic')
    : partKey;
  if (!pd.localClusters[addressClusterKey]) pd.localClusters[addressClusterKey] = { traumaScore: 0, woundIds: [], clusterIds: [], lastHitTime: now, state: 'minor', hits: 0, highEnergyHits: 0, largeWoundCount: 0 };
  const lc = pd.localClusters[addressClusterKey];
  if (lc.hits == null) { lc.hits = (lc.woundIds || []).length; lc.highEnergyHits = 0; lc.largeWoundCount = 0; }   // 구버전 저장 호환
  if (lc.woundIds.indexOf(wound.id) < 0) lc.woundIds.push(wound.id);
  if (wound.treatmentClusterId && lc.clusterIds.indexOf(wound.treatmentClusterId) < 0) lc.clusterIds.push(wound.treatmentClusterId);

  // 산탄 group destruction soft ceiling (같은 partKey + 같은 gid)
  if (gid && (isFlechette || isBuckshot)) {
    pd._shotgunGroupContrib = pd._shotgunGroupContrib || {};
    const gkey = gid;
    const prev = pd._shotgunGroupContrib[gkey] || 0;
    const isLimb = _LIMB_PART_KEYS.indexOf(partKey) >= 0;
    let ceiling;
    if (isFlechette) ceiling = isLimb ? 0.24 : 0.32;
    else ceiling = isLimb ? 0.48 : 0.65;
    // major vessel confirmed / shattered fracture는 ceiling 완화
    const ve = wound.vascularEvidence || {}; const fe = wound.fractureEvidence || {};
    if ((ve.level === 'confirmed' && ve.vesselClass === 'major_named') || fe.fractureType === 'shattered') ceiling *= 1.4;
    const room = Math.max(0, ceiling - prev);
    contribution = Math.min(contribution, room);
    pd._shotgunGroupContrib[gkey] = prev + contribution;
  }

  lc.traumaScore = +(lc.traumaScore + contribution).toFixed(3);
  lc.lastHitTime = now;
  lc.state = _localClusterState(lc.traumaScore);
  // [B-STAGE] 반복 고에너지 타격 / 같은 cluster 대형 상처 누적 — 극단 상태 게이트 입력
  lc.hits = (lc.hits || 0) + 1;
  if (contribution >= 0.30 && !(ctx.shotgunPellet || wound.shotgunPellet)) lc.highEnergyHits = (lc.highEnergyHits || 0) + 1;
  { const _wsz = (wound.woundSize || {}).sizeClass; if (_wsz === 'large' || _wsz === 'massive') lc.largeWoundCount = (lc.largeWoundCount || 0) + 1; }

  // 누적/급성 외상 갱신
  pd.acuteTraumaScore = +contribution.toFixed(3);
  pd.cumulativeTraumaScore = +(pd.cumulativeTraumaScore + contribution).toFixed(3);
  pd.traumaScore = pd.cumulativeTraumaScore;
  if (pd.sourceWoundIds.indexOf(wound.id) < 0) pd.sourceWoundIds.push(wound.id);
  if (wound.treatmentClusterId && pd.sourceClusterIds.indexOf(wound.treatmentClusterId) < 0) pd.sourceClusterIds.push(wound.treatmentClusterId);
  if (contribution >= 0.16) pd.lastMajorHitAt = now;
  pd.lastUpdatedAt = now;

  // 상태/효과 갱신
  refreshPartDestructionState(unit, partKey, { wound, ev, ctx });
  applyPartDestructionEffects(unit, partKey);

  // wound snapshot (source-of-truth 아님)
  const snap = {
    contribution: +contribution.toFixed(3),
    partDestructionContribution: +contribution.toFixed(3),
    cumulativeTraumaScore: pd.cumulativeTraumaScore,
    partDestructionStateBefore,
    partDestructionStateAfter: pd.state,
    localClusterKey: addressClusterKey,
    localClusterState: lc.state,
    dominantClusterKey: pd.dominantClusterKey || null,
    dominantClusterState: pd.dominantClusterState || null,
    dominantClusterScore: pd.dominantClusterScore || 0,
    evidenceTier: pd.evidenceTier || 'minor',
    destructionTags: pd.evidenceTags.slice(),
    gateReasons: (pd.gateReasons || []).slice(),
  };
  return snap;
}
// ════════════════════════════════════════════════════════════════════════════
// [B-STAGE PART DESTRUCTION] 증거 기반 부위 파괴 — 단일 evidence 모델 + 상태 rank.
//   극단 상태(mangled 이상)는 단일 score/HP 임계가 아니라 dominant local cluster 집중도,
//   골절 등급, 상처 크기, 실제 파괴성 탄체/폭발 증거의 조합으로만 승격한다.
// ════════════════════════════════════════════════════════════════════════════
const PD_STATE_RANK_LIMB = { intact:0, damaged:1, impaired:2, mangled:3, destroyed:4, partial_traumatic_loss:5, traumatic_amputation:6 };
const PD_STATE_RANK_NON_LIMB = { intact:0, damaged:1, impaired:2, mangled:3, destroyed:4, catastrophic_non_limb:5 };
const PD_LIMB_ONLY_STATES = ['partial_traumatic_loss', 'traumatic_amputation'];
const PD_NON_LIMB_ONLY_STATES = ['catastrophic_non_limb'];
const PD_DISABLED_STATES = ['destroyed', 'partial_traumatic_loss', 'traumatic_amputation', 'catastrophic_non_limb'];
const PD_ALL_STATES = ['intact','damaged','impaired','mangled','destroyed','partial_traumatic_loss','traumatic_amputation','catastrophic_non_limb'];
function getPartDestructionStateRank(state, isLimb) {
  const table = isLimb ? PD_STATE_RANK_LIMB : PD_STATE_RANK_NON_LIMB;
  const r = table[state];
  return (r == null) ? 0 : r;
}
// dominant cluster 주소 분류 — 아무 wound 하나가 아니라 dominant cluster key로만 판정
const PD_DISTAL_CLUSTER_RE   = /^(hand_wrist|foot_ankle|forearm|lower_leg)$/;
const PD_PROXIMAL_CLUSTER_RE = /^(upper_arm|thigh|groin_junctional|axilla_shoulder_gap)$/;
const PD_FX_RANK = { none:0, hairline:1, simple:2, displaced:3, comminuted:4, shattered:5 };
// 탄체 파괴 등급 — 이름이 아니라 실제 terminal 결과와 함께 사용된다
function _pdProjectileEvidenceClass(w) {
  const bt = w.bodyTrajectory || {};
  const proj = ((bt.projectileSizeClass || '') + '').toLowerCase();
  const ammoId = ((w.ammoId || '') + '').toLowerCase();
  if (/anti_material/.test(proj) || /^127x(99|108)/.test(ammoId) || /50bmg/.test(ammoId)) return 'anti_material';
  if (/slug/.test(proj) || /slug/.test(ammoId)) return 'slug';
  if (/large_bore/.test(proj)) return 'large_bore';
  if (w.shotgunPellet) return 'pellet';
  if ((w.sourceType || '') === 'frag') return 'fragment';
  if ((w.sourceType || '') === 'blast') return 'blast';
  return 'standard';
}
function buildPartDestructionEvidence(unit, partKey, pd) {
  const m = (unit && unit.medical) || {};
  const part = (m.bodyParts && m.bodyParts[partKey]) || {};
  const isLimb = _LIMB_PART_KEYS.indexOf(partKey) >= 0;
  const hpRatio = (part.maxHp > 0) ? Math.max(0, Math.min(1, part.hp / part.maxHp)) : 1;
  const cumulativeTraumaScore = pd.cumulativeTraumaScore || 0;
  const wounds = (m.wounds || []).filter(w => w && w.partKey === partKey && pd.sourceWoundIds.indexOf(w.id) >= 0);

  // ── dominant cluster: traumaScore 최대. 동점 → 최근 hit time → wound count → 안정 key 순 (랜덤 금지) ──
  let dominantClusterKey = null, dom = null;
  const clusterKeys = Object.keys(pd.localClusters || {}).sort();
  for (const k of clusterKeys) {
    const c = pd.localClusters[k]; if (!c) continue;
    if (!dom) { dom = c; dominantClusterKey = k; continue; }
    const a = c.traumaScore || 0, b = dom.traumaScore || 0;
    let better = false;
    if (a > b) better = true;
    else if (a === b) {
      const at = c.lastHitTime || 0, bt2 = dom.lastHitTime || 0;
      if (at > bt2) better = true;
      else if (at === bt2) {
        const aw = (c.woundIds || []).length, bw = (dom.woundIds || []).length;
        if (aw > bw) better = true;   // 이후 동점이면 이미 정렬된 key 순서가 유지된다
      }
    }
    if (better) { dom = c; dominantClusterKey = k; }
  }
  const dominantClusterScore = dom ? +(dom.traumaScore || 0).toFixed(3) : 0;
  const dominantClusterState = dom ? (dom.state || 'minor') : 'none';
  const dominantClusterWoundCount = dom ? (dom.woundIds || []).length : 0;
  const dominantClusterHits = dom ? (dom.hits || dominantClusterWoundCount) : 0;
  const dominantClusterHighEnergyHits = dom ? (dom.highEnergyHits || 0) : 0;
  const dominantClusterLargeWoundCount = dom ? (dom.largeWoundCount || 0) : 0;
  const distributedClusterCount = clusterKeys.filter(k => (pd.localClusters[k].traumaScore || 0) > 0.02).length;
  const localConcentrationRatio = cumulativeTraumaScore > 0.0001
    ? Math.max(0, Math.min(1, dominantClusterScore / cumulativeTraumaScore)) : 0;
  const dominantClusterIsDistal   = !!(dominantClusterKey && PD_DISTAL_CLUSTER_RE.test(dominantClusterKey));
  const dominantClusterIsProximal = !!(dominantClusterKey && PD_PROXIMAL_CLUSTER_RE.test(dominantClusterKey));

  // ── wound 파생 증거 (부위 전체) + dominant cluster 한정 증거 ──
  const domWoundIds = dom ? (dom.woundIds || []) : [];
  let worstFractureType = 'none', hasLargeWound = false, hasMassiveWound = false, hasLargeExit = false, hasMassiveExit = false;
  let deepTrajectoryCount = 0, throughAndThroughCount = 0, vesselAdjacent = false, vascularEvidenceLevel = 'none';
  let catastrophicProjectileEvidence = false, blastDestructionEvidence = false, largeFragmentEvidence = false;
  let domWorstFractureType = 'none', domHasLarge = false, domHasMassive = false, domCatastrophicSource = false;
  const VE_RANK = { none:0, risk_only:1, candidate:2, probable:3, confirmed:4 };
  const projectileEvidenceClasses = {};
  let severeWoundCount = 0;
  for (const w of wounds) {
    const fe = w.fractureEvidence || {}, ws = w.woundSize || {}, bt = w.bodyTrajectory || {}, ve = w.vascularEvidence || {};
    const inDom = domWoundIds.indexOf(w.id) >= 0;
    const pcls = _pdProjectileEvidenceClass(w);
    projectileEvidenceClasses[pcls] = (projectileEvidenceClasses[pcls] || 0) + 1;
    // 펠릿 단발 골절은 상태 승격 근거로 쓰지 않는다 (기존 규칙 유지)
    const fxCounts = fe.occurred && !w.shotgunPellet;
    if (fxCounts && (PD_FX_RANK[fe.fractureType] || 0) > (PD_FX_RANK[worstFractureType] || 0)) worstFractureType = fe.fractureType;
    if (fxCounts && inDom && (PD_FX_RANK[fe.fractureType] || 0) > (PD_FX_RANK[domWorstFractureType] || 0)) domWorstFractureType = fe.fractureType;
    const big = (ws.sizeClass === 'large' || ws.sizeClass === 'massive');
    const huge = (ws.sizeClass === 'massive');
    if (ws.sizeClass === 'large') hasLargeWound = true;
    if (huge) hasMassiveWound = true;
    if (ws.exitSizeClass === 'large') hasLargeExit = true;
    if (ws.exitSizeClass === 'massive') hasMassiveExit = true;
    if (inDom && big) domHasLarge = true;
    if (inDom && huge) domHasMassive = true;
    const deep = (bt.woundDepthClass === 'deep' || bt.deepTissueReached || bt.penetrationState === 'deep');
    if (deep) deepTrajectoryCount++;
    if (bt.bodyThroughAndThrough || bt.targetThroughAndThrough) throughAndThroughCount++;
    const bp = w.bleedingProfile || {};
    if ((bp.sustainedExternal || 0) >= 8 || big) severeWoundCount++;
    if ((VE_RANK[ve.level] || 0) > (VE_RANK[vascularEvidenceLevel] || 0)) vascularEvidenceLevel = ve.level || 'none';
    if (_VESSEL_NAMED_RE.test((((w.normalizedMedicalAddress && w.normalizedMedicalAddress.vascularRegion) || '') + ' ' + (w.anatomicalZone || '')))) vesselAdjacent = true;
    // ── 실제 파괴 증거만 catastrophic으로 인정 (source 문자열·탄약 이름 단독 금지) ──
    let woundCatastrophic = false;
    if (pcls === 'anti_material' && big && (deep || bt.bodyThroughAndThrough)) woundCatastrophic = true;
    else if (pcls === 'slug' && huge) woundCatastrophic = true;
    else if (pcls === 'large_bore' && huge && deep) woundCatastrophic = true;
    if (pcls === 'fragment' && big && deep) { largeFragmentEvidence = true; woundCatastrophic = true; }
    if (pcls === 'blast' && (huge || (big && (fe.fractureType === 'shattered' || fe.fractureType === 'comminuted')))) { blastDestructionEvidence = true; woundCatastrophic = true; }
    if (woundCatastrophic) { catastrophicProjectileEvidence = true; if (inDom) domCatastrophicSource = true; }
  }
  const comminutedEvidence = (PD_FX_RANK[worstFractureType] >= PD_FX_RANK.comminuted);
  const shatteredEvidence  = (worstFractureType === 'shattered');
  const domComminuted = (PD_FX_RANK[domWorstFractureType] >= PD_FX_RANK.comminuted);
  const domShattered  = (domWorstFractureType === 'shattered');

  // ── evidence tier ──
  let evidenceTier = 'minor';
  if (dominantClusterState === 'moderate' || hasLargeWound || (PD_FX_RANK[worstFractureType] >= PD_FX_RANK.displaced)) evidenceTier = 'moderate';
  if (dominantClusterState === 'severe' || comminutedEvidence || (hasLargeWound && hasLargeExit)) evidenceTier = 'severe';
  if (dominantClusterState === 'catastrophic' || shatteredEvidence || catastrophicProjectileEvidence || hasMassiveWound) evidenceTier = 'catastrophic';

  const evidenceTags = [];
  if (dominantClusterKey) evidenceTags.push('dominant:' + dominantClusterKey + ':' + dominantClusterState);
  if (comminutedEvidence) evidenceTags.push('fx_' + worstFractureType);
  if (hasMassiveWound) evidenceTags.push('massive_wound');
  else if (hasLargeWound) evidenceTags.push('large_wound');
  if (catastrophicProjectileEvidence) evidenceTags.push('catastrophic_projectile');
  if (blastDestructionEvidence) evidenceTags.push('blast_destruction');
  if (largeFragmentEvidence) evidenceTags.push('large_fragment');
  if (localConcentrationRatio >= 0.6) evidenceTags.push('concentrated'); else if (distributedClusterCount >= 2) evidenceTags.push('distributed');

  return {
    partKey, isLimb, hpRatio: +hpRatio.toFixed(3),
    woundCount: wounds.length, severeWoundCount,
    acuteTraumaScore: pd.acuteTraumaScore || 0, cumulativeTraumaScore,
    dominantClusterKey, dominantClusterScore, dominantClusterState, dominantClusterWoundCount,
    dominantClusterHits, dominantClusterHighEnergyHits, dominantClusterLargeWoundCount,
    dominantClusterIsDistal, dominantClusterIsProximal,
    distributedClusterCount, localConcentrationRatio: +localConcentrationRatio.toFixed(3),
    worstFractureType, worstFractureRank: PD_FX_RANK[worstFractureType] || 0,
    comminutedEvidence, shatteredEvidence,
    dominantWorstFractureType: domWorstFractureType, dominantComminuted: domComminuted, dominantShattered: domShattered,
    dominantHasLargeWound: domHasLarge, dominantHasMassiveWound: domHasMassive, dominantCatastrophicSource: domCatastrophicSource,
    hasLargeWound, hasMassiveWound, hasLargeExit, hasMassiveExit,
    deepTrajectoryCount, throughAndThroughCount,
    projectileEvidenceClasses, catastrophicProjectileEvidence, blastDestructionEvidence, largeFragmentEvidence,
    vesselAdjacent, vascularEvidenceLevel,
    evidenceTier, evidenceTags, gateReasons: [],
  };
}
// [B-STAGE] 상태 판정 — 단일 지점 확정. 모든 게이트는 buildPartDestructionEvidence 결과만 소비한다.
function refreshPartDestructionState(unit, partKey, extra) {
  const pd = getPartDestruction(unit, partKey);
  if (!pd) return null;
  const m = unit.medical;
  const part = (m.bodyParts && m.bodyParts[partKey]) || {};
  const ev = buildPartDestructionEvidence(unit, partKey, pd);
  pd.evidence = ev;
  const isLimb = ev.isLimb, hpRatio = ev.hpRatio, cts = ev.cumulativeTraumaScore;
  const isTorsoVital = (partKey === 'chest' || partKey === 'abdomen');
  const isHeadNeck = (partKey === 'head' || partKey === 'neck');
  const gate = [];

  // ── 일반 상태: 누적 외상 + HP + 골절 (기존 의미 유지) ──
  let state = 'intact';
  if (!(cts < 0.10 && hpRatio > 0.85)) state = 'damaged';
  if (cts >= 0.28 || hpRatio <= 0.40 || ev.worstFractureRank >= PD_FX_RANK.displaced
      || ev.dominantClusterState === 'moderate' || ev.dominantClusterState === 'severe' || ev.dominantClusterState === 'catastrophic') {
    state = 'impaired'; gate.push('impaired:trauma_or_fracture_or_cluster');
  }

  // ── mangled: 국소 구조 증거 필수 (단발 연부조직 관통으로 진입 금지) ──
  const mangledEvidence =
       ev.dominantClusterState === 'catastrophic'
    || ev.dominantComminuted || ev.dominantShattered
    || ev.dominantClusterLargeWoundCount >= 2
    || ev.dominantClusterHighEnergyHits >= 2
    || (ev.catastrophicProjectileEvidence && (ev.hasLargeWound || ev.hasMassiveWound));
  const mangledSupport = (cts >= 0.50 || hpRatio <= 0.22);
  if (mangledEvidence && mangledSupport) { state = 'mangled'; gate.push('mangled:local_structural_evidence'); }

  // ── destroyed: 구조적 파괴 증거 필수. HP 0은 기능상실이지 자동 구조파괴가 아니다 ──
  const destroyedEvidence =
       ev.dominantClusterState === 'catastrophic'
    || (ev.shatteredEvidence && (ev.hasLargeWound || ev.hasMassiveWound))
    || ev.dominantClusterHighEnergyHits >= 3
    || (ev.catastrophicProjectileEvidence && (ev.hasMassiveWound || (ev.hasLargeWound && ev.comminutedEvidence)));
  const destroyedSupport = (cts >= 0.82 || hpRatio <= 0.05);
  if (destroyedEvidence && destroyedSupport) { state = 'destroyed'; gate.push('destroyed:structural_collapse'); }

  // HP 소진은 기능상실만 표시 (라벨 승격 금지)
  const disabledByHp = (part.hp != null && part.hp <= 0);
  if (disabledByHp && state !== 'destroyed') gate.push('hp_depleted:functional_loss_only');

  // ── 사지 전용 극단 상태 — dominant cluster 집중 + 파괴 증거 필수, 분산 총합 금지 ──
  if (isLimb) {
    const concentrated = ev.localConcentrationRatio >= 0.6;
    const strongSource = ev.dominantCatastrophicSource || ev.dominantShattered;
    if (state === 'destroyed' && concentrated && ev.dominantClusterIsDistal
        && ev.dominantClusterState === 'catastrophic' && cts >= 0.95
        && (ev.hasLargeWound || ev.hasMassiveWound || ev.shatteredEvidence || ev.catastrophicProjectileEvidence)) {
      state = 'partial_traumatic_loss'; gate.push('partial_loss:distal_catastrophic_cluster');
    }
    // [8.7] "매우 높은 local destruction" — dominant cluster의 실제 국소 파괴량이 기준.
    //   단일 직격만으로는 도달하지 않고, 같은 지점의 파괴가 실제로 누적되어야 승격한다.
    const PD_AMPUTATION_LOCAL_DESTRUCTION = 1.70;
    if (concentrated && ev.dominantClusterState === 'catastrophic'
        && ev.dominantClusterScore >= PD_AMPUTATION_LOCAL_DESTRUCTION && cts >= 1.20
        && (strongSource || (ev.shatteredEvidence && ev.hasMassiveWound))) {
      state = 'traumatic_amputation'; gate.push('amputation:catastrophic_local_destruction');
    }
  } else {
    // 비사지: limb-only 상태 사용 금지 → catastrophic_non_limb
    // [8.8] 점수 누적만으로는 부족 — massive disruption / catastrophic source / shattered / 반복 고에너지 국소 붕괴 필요
    const nonLimbStructural = ev.hasMassiveWound || ev.catastrophicProjectileEvidence || ev.shatteredEvidence
      || (ev.dominantClusterState === 'catastrophic' && ev.dominantClusterHighEnergyHits >= 2);
    if (state === 'destroyed' && (isTorsoVital || isHeadNeck) && nonLimbStructural && cts >= 0.90) {
      state = 'catastrophic_non_limb'; gate.push('catastrophic_non_limb:critical_structure');
    }
  }

  // ── 단조성: 임무 중 상태는 역행하지 않는다 (처치로 하락 금지) ──
  const prevState = pd.state || 'intact';
  if (getPartDestructionStateRank(prevState, isLimb) > getPartDestructionStateRank(state, isLimb)) {
    gate.push('monotonic:kept_' + prevState);
    state = prevState;
  }

  pd.state = state;
  pd.functionalCap = PART_DESTRUCTION_FUNCTIONAL_CAP[state] != null ? PART_DESTRUCTION_FUNCTIONAL_CAP[state] : 1.0;
  pd.destructionRisk = Math.max(0, Math.min(1, cts / 0.82));
  pd.traumaticLossRisk = isLimb ? Math.max(0, Math.min(1, (cts - 0.6) / 0.6)) : 0;
  // additive 기능상실 사유 (기존 저장구조 비파괴)
  pd.disabledByHp = disabledByHp;
  pd.disabledByDestruction = PD_DISABLED_STATES.indexOf(state) >= 0;
  pd.functionalLossReason = pd.disabledByDestruction ? 'structural_destruction' : (disabledByHp ? 'hp_depleted' : null);

  const tags = ev.evidenceTags.slice();
  if (state !== 'intact') tags.push('part_' + state);
  const bleedBonusByState = { intact:1.0, damaged:1.03, impaired:1.10, mangled:1.32, destroyed:1.50, partial_traumatic_loss:1.55, traumatic_amputation:1.65, catastrophic_non_limb:1.45 };
  pd.bleedBonusMul = bleedBonusByState[state] || 1.0;
  // 혈관 위험 보정 — confirmed 승격은 금지, proximal dominant cluster에서만 강한 보정
  let vBonus = 0;
  if (state === 'mangled' && ev.vesselAdjacent && ev.deepTrajectoryCount > 0) { vBonus = 0.10; tags.push('mangled_vessel_adjacent'); }
  if (state === 'destroyed' && ev.vesselAdjacent && ev.comminutedEvidence) { vBonus = 0.15; tags.push('part_destruction_vascular_risk'); }
  if (state === 'partial_traumatic_loss' && isLimb && ev.dominantClusterIsProximal) { vBonus = 0.15; tags.push('traumatic_loss_vessel_candidate'); }
  if (state === 'traumatic_amputation' && isLimb && ev.dominantClusterIsProximal) { vBonus = 0.20; tags.push('proximal_limb_major_vessel_probable'); }
  pd.vascularRiskBonus = vBonus;
  pd.evidenceTags = tags;
  pd.evidenceTier = ev.evidenceTier;
  pd.gateReasons = gate;
  ev.gateReasons = gate;
  pd.dominantClusterKey = ev.dominantClusterKey;
  pd.dominantClusterScore = ev.dominantClusterScore;
  pd.dominantClusterState = ev.dominantClusterState;
  pd.distributedClusterCount = ev.distributedClusterCount;
  pd.localConcentrationRatio = ev.localConcentrationRatio;
  pd.worstFractureType = ev.worstFractureType;
  // legacy _flags 유지 (기존 consumer 호환) — dominant cluster 기준으로 정정
  pd._flags = { worstFx: ev.worstFractureType, hasLarge: ev.hasLargeWound, hasMassive: ev.hasMassiveWound,
    catastrophicEvidence: ev.catastrophicProjectileEvidence, distalCluster: ev.dominantClusterIsDistal,
    proximalCluster: ev.dominantClusterIsProximal, majorVesselConfirmed: (ev.vascularEvidenceLevel === 'confirmed'),
    deepTrajectory: ev.deepTrajectoryCount > 0, vesselAdjacent: ev.vesselAdjacent, isLimb, severeWoundCount: ev.severeWoundCount };
  return pd;
}
// Phase5 §9: bodyPart에 destruction 효과 복사
function applyPartDestructionEffects(unit, partKey) {
  const pd = getPartDestruction(unit, partKey);
  if (!pd) return;
  const part = unit.medical.bodyParts && unit.medical.bodyParts[partKey];
  if (!part) return;
  part.destructionState = pd.state;
  part.destructionFunctionalCap = pd.functionalCap;
  part.destructionRisk = pd.destructionRisk;
  part.traumaticLossRisk = pd.traumaticLossRisk;
  // [B-STAGE 10.2] disabled 계약 — destroyed / partial_traumatic_loss / traumatic_amputation / catastrophic_non_limb
  part.destructionDisabledReason = pd.functionalLossReason || null;
  if (PD_DISABLED_STATES.indexOf(pd.state) >= 0) part.disabled = true;
  recomputeBodyPartFunctionRatio(part, pd);
}

function finalizeBleedingProfileWithEvidence(w) {
  // PHASE 3-H invariant: wound별 finalization 횟수 추적 (논리적 1회)
  if (w && w.bleedingProfile) w.bleedingProfile._finalizationCount = (w.bleedingProfile._finalizationCount || 0) + 1;
  const bp = w.bleedingProfile;
  if (!bp || bp.bleedingType === 'none') return;
  const ve = w.vascularEvidence || { level: 'none', vesselClass: 'none', majorVessel: false };
  const fe = w.fractureEvidence || { occurred: false, bleedBonusMul: 1.0, boneFragmentSeverity: 0, fractureType: 'none' };
  const ws = w.woundSize || {};
  const sizeClass = ws.sizeClass || 'small';
  const bigExit = (ws.exitSizeClass === 'large' || ws.exitSizeClass === 'massive');
  const bigCavity = (sizeClass === 'large' || sizeClass === 'massive');
  const isCavity = (bp.bleedingType === 'cavity' || bp.bleedingType === 'mixed');
  const isJunctional = (bp.bleedingType === 'junctional');

  // seed 값 (computeBleedingProfile + 이후 severity 보정 결과)를 raw potential로 사용
  // PART-DESTRUCTION-POST-WOUND-SYNC-1 §5: finalize가 두 번 호출돼도 seed 증폭 누적 방지 — 최초 seed 보존 후 항상 원본 기준 재계산.
  if (bp._prePartDestructionFinalize == null) {
    bp._prePartDestructionFinalize = { currentExternal: Math.max(0, bp.currentExternal || 0), currentInternal: Math.max(0, bp.currentInternal || 0) };
  }
  const seedExt = Math.max(0, bp._prePartDestructionFinalize.currentExternal || 0);
  const seedInt = Math.max(0, bp._prePartDestructionFinalize.currentInternal || 0);
  const fragBonus = (ws.fragmentationScore ? ws.fragmentationScore * 0.15 : 0);
  const fractureBleedMul = fe.occurred ? fe.bleedBonusMul : 1.0;

  // bleedPotential 기록 (탄종/형상 차이 보존)
  w.bleedPotential = {
    tissueBleedPotential: +(seedExt * fractureBleedMul).toFixed(2),
    vascularBleedPotential: +(seedExt * ve.evidenceStrength).toFixed(2),
    cavityBleedPotential: +(seedInt * fractureBleedMul).toFixed(2),
    entrySeverity: +(ws.entrySizeScore || 0).toFixed(2), exitSeverity: +(ws.exitSizeScore || 0).toFixed(2),
    permanentCavitySeverity: +(ws.sizeScore || 0).toFixed(2), temporaryCavitySeverity: +(ws.tempCavityScore || 0).toFixed(2),
    fragmentationSeverity: +(ws.fragmentationScore || 0).toFixed(2), crushSeverity: 0,
    boneFragmentSeverity: fe.boneFragmentSeverity,
    initialSpikeExternal: 0, initialSpikeInternal: 0, sustainedExternalRaw: 0, sustainedInternalRaw: 0,
    evidenceLimited: (ve.level === 'none' || ve.level === 'risk_only' || ve.level === 'candidate'),
    notes: [],
  };

  // === soft ceiling (sustainedExternal 상한) — vascularEvidence + geometry ===
  let softCeiling;
  if (ve.level === 'confirmed' && ve.vesselClass === 'major_named') softCeiling = 30;
  else if (ve.level === 'probable' && ve.vesselClass === 'major_named') softCeiling = 15;
  else if (ve.level === 'probable' && ve.vesselClass === 'named_branch') softCeiling = 11.5;
  else if (ve.level === 'probable') softCeiling = 9;                        // small_branch probable
  else if (ve.level === 'candidate') softCeiling = (bigExit || bigCavity) ? 8.5 : 7;
  else if (ve.level === 'risk_only') softCeiling = 6.5;
  else softCeiling = 4.5;                                                    // soft tissue / muscle only
  // 골절 comminuted/shattered는 ceiling 소폭 상향
  if (fe.occurred && (fe.fractureType === 'comminuted' || fe.fractureType === 'shattered')) softCeiling += 1.5;

  const evidenceLeakFactor = ({ none: 0.10, risk_only: 0.12, candidate: 0.20, probable: 0.50, confirmed: 1.0 })[ve.level] != null
    ? ({ none: 0.10, risk_only: 0.12, candidate: 0.20, probable: 0.50, confirmed: 1.0 })[ve.level] : 0.10;

  // rawExternal = tissue + vascular + fracture + frag
  const rawExternal = (seedExt * fractureBleedMul) + (seedExt * ve.evidenceStrength * 0.6) + fragBonus;
  let sustainedExternal = rawExternal;
  if (rawExternal > softCeiling) sustainedExternal = softCeiling + (rawExternal - softCeiling) * evidenceLeakFactor;
  // cavity/junctional 흐름 특성 유지
  if (isCavity) sustainedExternal = Math.min(sustainedExternal, bp.currentExternal * 1.1 || sustainedExternal);

  // initial spike — geometry 주도(seed 자체). 증폭하지 않음: peak는 seed, sustained만 evidence로 낮춤.
  let initialExternal = Math.max(sustainedExternal, rawExternal);

  // internal (cavity)
  const rawInternal = seedInt * fractureBleedMul;
  let sustainedInternal = rawInternal;
  let internalCeiling;
  if (ve.level === 'confirmed') internalCeiling = 30;
  else if (ve.level === 'probable') internalCeiling = 16;
  else if (ve.level === 'candidate') internalCeiling = 10;
  else internalCeiling = isCavity ? 8 : 5;
  if (rawInternal > internalCeiling) sustainedInternal = internalCeiling + (rawInternal - internalCeiling) * evidenceLeakFactor;
  let initialInternal = Math.max(sustainedInternal, rawInternal);

  // majorVesselLocked — confirmed major, 또는 확정 major organ (physiologic)
  const physioMajor = (w.physiologicInjuries || []).some(i => i && (i.type === 'major_vessel_injury' || (i.type === 'solid_organ_injury' && i.severity === 'critical')));
  const majorVesselLocked = !!((ve.level === 'confirmed' && ve.vesselClass === 'major_named') || physioMajor);

  // PART-DESTRUCTION-1 Phase6 §11: sustained 증폭은 major vessel lock일 때만 (아니면 vascularEvidence 기반 그대로 — 절단이 자동 대량출혈 되지 않음)
  if (majorVesselLocked) {
    const pde = w.partDestructionEvidence;
    const st = (pde && pde.partDestructionStateAfter) || null;
    if (st && st !== 'intact' && st !== 'damaged') {
      const sustBonus = { impaired:1.05, mangled:1.20, destroyed:1.30, partial_traumatic_loss:1.35, traumatic_amputation:1.5, catastrophic_non_limb:1.3 };
      sustainedExternal *= (sustBonus[st] || 1.0);
    }
  }

  // 자연 감소 target — locked면 sustained 유지, 아니면 조금 더 낮게
  const nonLockedFloorMul = isCavity ? 0.6 : (isJunctional ? 0.7 : 0.55);
  const naturalReductionTargetExternal = majorVesselLocked ? sustainedExternal : Math.max(0, sustainedExternal * nonLockedFloorMul);
  const naturalReductionTargetInternal = majorVesselLocked ? sustainedInternal
    : (isCavity && (ve.level === 'probable' || ve.level === 'confirmed')) ? sustainedInternal : Math.max(0, sustainedInternal * 0.6);

  // 자연 감소 속도 — 큰 사출구/파편/골절/junctional/cavity는 느림
  let selfReductionRate = 0.25;   // ml/s per s 근사
  if (bigExit || bigCavity) selfReductionRate *= 0.6;
  if (fe.occurred && fe.boneFragmentSeverity > 0.4) selfReductionRate *= 0.6;
  if (isJunctional) selfReductionRate *= 0.7;
  if (isCavity) selfReductionRate *= 0.5;
  if (majorVesselLocked) selfReductionRate = 0;

  // PART-DESTRUCTION-1 Phase6 §11: partDestruction bleedBonus — initial은 상태별 증폭, sustained는 major vessel evidence로 제한.
  //   traumatic_amputation이라도 sustained 자동 30ml/s 금지 (majorVesselLocked / proximal evidence 있을 때만 sustained 증폭)
  {
    const pde = w.partDestructionEvidence;
    const st = (pde && pde.partDestructionStateAfter) || null;
    if (st && st !== 'intact' && st !== 'damaged') {
      const initBonus = { impaired:1.08, mangled:1.30, destroyed:1.50, partial_traumatic_loss:1.9, traumatic_amputation:2.4, catastrophic_non_limb:1.45 };
      initialExternal *= (initBonus[st] || 1.0);
    }
  }
  bp.initialExternal = +initialExternal.toFixed(2);
  bp.initialInternal = +initialInternal.toFixed(2);
  bp.sustainedExternal = +sustainedExternal.toFixed(2);
  bp.sustainedInternal = +sustainedInternal.toFixed(2);
  bp.baseExternal = bp.initialExternal;
  bp.baseInternal = bp.initialInternal;
  bp.currentExternal = bp.initialExternal;   // 시작은 initial spike
  bp.currentInternal = bp.initialInternal;
  bp.naturalReductionTargetExternal = +naturalReductionTargetExternal.toFixed(2);
  bp.naturalReductionTargetInternal = +naturalReductionTargetInternal.toFixed(2);
  bp.selfReductionRate = +selfReductionRate.toFixed(3);
  bp.clottingFactor = majorVesselLocked ? 0.0 : (isCavity ? 0.3 : 0.6);
  bp.majorVesselLocked = majorVesselLocked;
  bp.vesselRisk = bp.vesselRisk != null ? bp.vesselRisk : 0;
  bp.softCeiling = +softCeiling.toFixed(1);
  bp.evidenceLeakFactor = evidenceLeakFactor;
  bp.bleedDynamicsTags = (bp.bleedDynamicsTags || []).concat(ve.evidenceTags || []).concat(fe.occurred ? ['fracture_bleed'] : []);
  w.bleedPotential.initialSpikeExternal = bp.initialExternal;
  w.bleedPotential.initialSpikeInternal = bp.initialInternal;
  w.bleedPotential.sustainedExternalRaw = +sustainedExternal.toFixed(2);
  w.bleedPotential.sustainedInternalRaw = +sustainedInternal.toFixed(2);
}

