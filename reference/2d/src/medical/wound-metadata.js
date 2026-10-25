// 2B-0: WOUND SYSTEM — 상처 단위 레이어 (기존 medical 위에 얹음)
//   woundDescriptor / woundSize(동적) / bleedingProfile / fieldCare / treatmentProfile / treatmentState
//   탄종별 고정표 금지 — ammo 수치 + 피격/방호 결과로 동적 산정.
// =============================================================
let _WOUND_ID_SEQ = 1;
const WOUND_SIZE_LABEL_KO = { micro:'초소형', small:'소형', medium:'중형', large:'대형', massive:'초대형' };
const WOUND_TYPE_LABEL_KO = {
  none:'상처 없음', blunt_trauma:'둔상', bruise:'타박상', abrasion:'찰과상',
  shallow_fragment:'얕은 파편상', deep_fragment:'깊은 파편상',
  penetrating_gunshot:'관통 총상', perforating_gunshot:'관통 총상',
  cavity_wound:'체강 관통상', junctional_wound:'접합부 출혈상',
  blunt_trauma_armor:'방탄 둔상', blast_or_crush:'폭압/압궤상',
};
const FIELD_CARE_LABEL_KO = { treatable:'현장처치 가능', controllable:'응급 억제 가능', limited:'현장처치 제한', field_unmanageable:'현장처치 불가' };
const BLEED_TYPE_LABEL_KO = { none:'출혈 없음', external:'외부출혈', internal:'내부출혈 의심', cavity:'체강출혈', junctional:'접합부 출혈', mixed:'복합출혈' };
const _JUNCTIONAL_HINT = ['axilla','shoulderRoot','shoulder_root','groinHip','groin','inguinal','lowerNeck','neckBase','neck_base','armpit'];
const _VESSEL_CRIT_HINT = ['carotid','neckFront','neck_front','throat','heart','aorta','femoralArtery','femoral'];

// SHOTGUN-MED-NORM-1 §8: 의료용 투사체 메타 — 12ga shell 구경과 실제 펠릿/dart 직경을 분리 (탄도 무관, wound size 전용).
function getMedicalProjectileMeta(ammo, ev) {
  const id = (ammo && ammo.id) || (ev && ev.ammoId) || '';
  const pj = (ammo && ammo.projectile) || {};
  const pelletCount = (ammo && ammo.pelletCount) || pj.pelletCount || 1;
  const projectileType = (ammo && ammo.projectileType) || pj.projectileType || null;
  const patternType = (ammo && ammo.patternType) || pj.patternType || null;
  const isShotgunPellet = pelletCount > 1 && projectileType === 'pellet';
  const isFlechette = /flechette/.test(id) || patternType === 'flechette_cluster' || pj.medicalProjectileClass === 'flechette_dart';
  const isBuckshot = /buck/.test(id) || pj.medicalProjectileClass === 'buckshot_pellet';
  if (isShotgunPellet && isFlechette) {
    return { isShotgunPellet:true, isFlechette:true, isBuckshot:false,
      effectiveDiameterMm: pj.effectiveDiameterMm || 1.5, medicalScalar: pj.pelletMedicalScalar || 0.22,
      projectileSizeClass:'sabot_subcaliber', maxEntryClass:'micro', maxInternalClass:'small', maxExitClass:'small' };
  }
  if (isShotgunPellet && isBuckshot) {
    return { isShotgunPellet:true, isFlechette:false, isBuckshot:true,
      effectiveDiameterMm: pj.effectiveDiameterMm || 8.4, medicalScalar: pj.pelletMedicalScalar || 0.55,
      projectileSizeClass:'pellet', maxEntryClass:'small', maxInternalClass:'medium', maxExitClass:'small' };
  }
  return { isShotgunPellet:false, isFlechette:false, isBuckshot:false,
    effectiveDiameterMm: null, medicalScalar:1.0, projectileSizeClass:null,
    maxEntryClass:null, maxInternalClass:null, maxExitClass:null };
}
// SHOTGUN-MED-NORM-1 §10: wound size class 상한 clamp
const _WOUND_CLASS_ORDER = ['micro','small','medium','large','massive'];
function clampWoundClass(cls, maxCls) {
  if (!cls || !maxCls) return cls;
  const ci = _WOUND_CLASS_ORDER.indexOf(cls), mi = _WOUND_CLASS_ORDER.indexOf(maxCls);
  if (ci < 0 || mi < 0) return cls;
  return _WOUND_CLASS_ORDER[Math.min(ci, mi)];
}

// SHOTGUN-PHYS-CLUSTER-1 Phase2 §3: 즉시 생리반응(bodyDmg/pain/shock/stress/stopping)용 scalar (지속출혈/방호/관통과 별개).
function getShotgunPelletAcutePhysiologyMeta(ev, ammo) {
  const pm = getMedicalProjectileMeta(ammo, ev);
  if (!pm || !pm.isShotgunPellet) {
    return { isShotgunPellet:false, bodyDmgMul:1.0, shockMul:1.0, painMul:1.0, stressMul:1.0, stoppingMul:1.0 };
  }
  if (pm.isFlechette) {
    return { isShotgunPellet:true, isFlechette:true, isBuckshot:false,
      bodyDmgMul:0.25, shockMul:0.20, painMul:0.35, stressMul:0.30, stoppingMul:0.30,
      groupShockCeilingLimb:18, groupShockCeilingTorso:35, groupShockCeilingCritical:65,
      groupPainCeilingLimb:25, groupPainCeilingTorso:45 };
  }
  if (pm.isBuckshot) {
    return { isShotgunPellet:true, isFlechette:false, isBuckshot:true,
      bodyDmgMul:0.60, shockMul:0.55, painMul:0.70, stressMul:0.70, stoppingMul:0.75,
      groupShockCeilingLimb:35, groupShockCeilingTorso:70, groupShockCeilingCritical:90,
      groupPainCeilingLimb:45, groupPainCeilingTorso:75 };
  }
  return { isShotgunPellet:false, bodyDmgMul:1.0, shockMul:1.0, painMul:1.0, stressMul:1.0, stoppingMul:1.0 };
}

// ════════════════════════════════════════════════════════════════════════════
// [0.39.2 Fix3] Canonical projectile diameter (mm) — 단일 source-of-truth.
//   점으로 시작하는 인치식 caliber('.300 BLK','.338 Lapua')를 parseFloat로 mm 취급하면 0.3mm가 되는 버그 제거.
//   fallback: 1) 명시 필드(projectileDiameterMm / projectile.diameterMm / projectile.effectiveDiameterMm)
//             2) caliber 문자열 → mm 변환표  3) metric 문자열 parser  4) 기본 7mm
//   impact packet / entry wound / permanent cavity / big-caliber / heavy-slow / AAR가 전부 이 값을 사용.
// ════════════════════════════════════════════════════════════════════════════
const _CALIBER_MM_TABLE = [
  // 인치식(점 시작) — 실제 탄자 직경(mm)
  [/^\.?300\s*(blk|blackout|whisper|aac)/i, 7.62],
  [/^\.?308/i, 7.82], [/7\.62\s*[x×]\s*51/i, 7.82], [/^\.?30-?06/i, 7.82], [/7\.62\s*[x×]\s*63/i, 7.82],
  [/^\.?338\s*(lapua|norma|lm)/i, 8.59], [/8\.6\s*[x×]/i, 8.59],
  [/^\.?300\s*(win|wm|prc|norma)/i, 7.82],
  [/^\.?223/i, 5.70], [/5\.56\s*[x×]/i, 5.70],
  [/^\.?556/i, 5.70],
  [/^\.?277|6\.8\s*[x×]/i, 7.00],
  [/^\.?45\s*acp/i, 11.5], [/^\.?40\s*s&?w/i, 10.2], [/^\.?357/i, 9.07], [/^\.?38\s/i, 9.07],
  [/^\.?50\s*(bmg|cal)/i, 12.95], [/12\.7\s*[x×]\s*99/i, 12.95], [/12\.7\s*[x×]\s*108/i, 12.98], [/12\.7\s*[x×]\s*55/i, 12.95],
  [/9\s*[x×]\s*19/i, 9.01], [/9\s*[x×]\s*21/i, 9.01], [/9\s*[x×]\s*39/i, 9.25],
  [/7\.62\s*[x×]\s*39/i, 7.85], [/7\.62\s*[x×]\s*54/i, 7.92],
  [/5\.45\s*[x×]/i, 5.60], [/5\.7\s*[x×]|5\.7\s*mm/i, 5.70], [/4\.6\s*[x×]/i, 4.65],
  [/9\.3\s*[x×]/i, 9.30], [/9\.5\s*[x×]/i, 9.50],
];
function _caliberStringToMm(caliberStr) {
  if (!caliberStr) return null;
  const s = String(caliberStr).trim();
  for (const [re, mm] of _CALIBER_MM_TABLE) { if (re.test(s)) return mm; }
  // metric 'A.Bx...mm' 또는 'A.Bmm' — 첫 토큰이 mm 구경 (점으로 시작하지 않을 때만 parseFloat 신뢰)
  if (!/^\s*\./.test(s)) {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:[x×]|mm|ga|$)/i);
    if (m) { const v = parseFloat(m[1]); if (!isNaN(v) && v >= 3 && v <= 30) return v; }
  }
  return null;   // 변환 실패 — 소비자가 기본값 결정
}
function getProjectileDiameterMm(ammo) {
  if (!ammo) return 7;
  // 1) 명시 필드 우선 (canonical)
  if (typeof ammo.projectileDiameterMm === 'number' && ammo.projectileDiameterMm > 0) return ammo.projectileDiameterMm;
  const pj = ammo.projectile;
  if (pj) {
    if (typeof pj.diameterMm === 'number' && pj.diameterMm > 0) return pj.diameterMm;
    if (typeof pj.effectiveDiameterMm === 'number' && pj.effectiveDiameterMm > 0) return pj.effectiveDiameterMm;
  }
  // 2) caliber 문자열 → mm 변환표
  const fromTable = _caliberStringToMm(ammo.caliber);
  if (fromTable != null) return fromTable;
  // 3) 기존 parser (metric만 안전) 4) 기본
  const legacy = parseFloat(String(ammo.caliber || ''));
  if (!isNaN(legacy) && legacy >= 3 && legacy <= 30) return legacy;   // 3mm 미만은 인치식 오파싱으로 간주, 배제
  return 7;
}
function _caliberMm(ammo) {
  // [0.39.2 Fix3] canonical 경로로 위임 — 점 시작 인치식 오파싱 방지
  return getProjectileDiameterMm(ammo);
}
function _woundSizeClassFromScore(s) {
  if (s < 14) return 'micro';
  if (s < 30) return 'small';
  if (s < 52) return 'medium';
  if (s < 78) return 'large';
  return 'massive';
}
function _zoneIsJunctional(zone) {
  if (!zone) return false;
  const z = String(zone).toLowerCase();
  return _JUNCTIONAL_HINT.some(h => z.indexOf(h.toLowerCase()) >= 0);
}
function _zoneIsVesselCritical(zone, partKey) {
  if (zone) { const z = String(zone).toLowerCase(); if (_VESSEL_CRIT_HINT.some(h => z.indexOf(h.toLowerCase()) >= 0)) return true; }
  return false;
}

// 관통 상태 — armorResult + impactAddress(residualKind/overmatch) + frag 기반
// 2B-0-FINAL §3: residualThreatPacket 참조 정규화 — 저장 위치가 달라도 안정적으로 읽음
function _normalizeResidualThreat(ev) {
  const ia = (ev && ev.impactAddress) || {};
  const ipkt = (ev && ev.impactPacket) || null;   // [0.39.1 Fix3] canonical impact packet 최우선
  const pkt = (ev && ev.residualThreatPacket) || ia.residualThreatPacket || (ev && ev.backerResult && ev.backerResult.residualThreatPacket) || null;
  const src = pkt || ia || {};
  const num = (v, d) => (typeof v === 'number' && !isNaN(v)) ? v : d;
  // [0.39.2 Fix2] residualPen 의미 보존: null/undefined/NaN=누락(fallback 허용), 0=실제 잔여 0(fallback 금지).
  //   Number.isFinite로 "값이 존재하는가"를 판별 — impactPacket이 명시적 0을 주면 그 0을 그대로 사용.
  const _finite = (v) => (typeof v === 'number' && Number.isFinite(v));
  const _rpRaw = (ipkt && _finite(ipkt.residualPen)) ? ipkt.residualPen
               : (_finite(src.residualPen)) ? src.residualPen
               : (_finite(ia.residualPen)) ? ia.residualPen
               : null;   // null = 데이터 누락 (소비자가 fallback 결정)
  const _rp = _rpRaw;   // 명시적 0 보존, 누락은 null
  const _om = (ipkt && typeof ipkt.overmatchMargin === 'number') ? ipkt.overmatchMargin : num(src.overmatchMargin, num(ia.overmatchMargin, 0));
  const _ri = (ipkt && typeof ipkt.residualIntegrity === 'number') ? ipkt.residualIntegrity : num(src.residualIntegrity, num(ia.residualIntegrity, 0.5));
  const _cd = (ipkt && typeof ipkt.continuationDepth === 'number') ? ipkt.continuationDepth : 0;
  return {
    residualPen: _rp,                              // null=누락, 0 이상=실제값
    residualPenPresent: (_rpRaw !== null),         // fallback 판단용 명시 플래그
    overmatchMargin: _om,
    residualIntegrity: _ri,
    continuationDepth: _cd,
    residualKind: (ipkt && ipkt.residualKind) || src.residualKind || ia.residualKind || null,
  };
}

function deriveWoundPenetrationState(ev) {
  const ar = ev.armorResult;
  if (ar === 'stopped' || ar === 'absorbed') return 'stopped_blunt';
  const rt = _normalizeResidualThreat(ev);
  // 2B-0-FINAL §1: 파편 분류 — 관통 파편은 fragmentPenetrated 누락이어도 관통 처리
  if (ev.sourceType === 'frag') {
    if (ar === 'penetrated') return (rt.residualPen > 12 || rt.overmatchMargin >= 6) ? 'deep' : 'shallow';
    if (ar === 'partial') return (ev.fragmentPenetrated || ev._shallowPenetration) ? 'shallow' : 'stopped_blunt';
    return ev.fragmentPenetrated ? 'shallow' : 'stopped_blunt';   // stopped — 막힌 파편
  }
  if (ar === 'penetrated') {
    const rk = rt.residualKind;
    if (!rk) return 'penetrating';        // 무방호/소프트 관통 — 하드플레이트 overmatch 정보 없음 → 전층 관통
    const om = rt.overmatchMargin;
    if (rk === 'intact_penetrator' && om >= 8) return 'through_and_through';
    if (om >= 10) return 'penetrating';
    if (om >= 3) return 'deep';
    return 'shallow';
  }
  return 'none';
}

// 상처 유형 — 출혈 wound 생성 조건(§17) 포함
function classifyWoundType(ev, penState) {
  const ar = ev.armorResult;
  const src = ev.sourceType;
  const stopped = (ar === 'stopped' || ar === 'absorbed');
  if (src === 'blast') return 'blast_or_crush';
  if (stopped) {
    // 비관통 — 둔상/타박/찰과만 (출혈 wound 아님)
    const blunt = ev.bluntTrauma || 0;
    if (blunt > 14) return 'blunt_trauma';
    if (blunt > 4) return 'bruise';
    return 'abrasion';
  }
  if (src === 'frag') {
    // 2B-0-FINAL §1: 관통 파편 = penetrated 또는 fragmentPenetrated 또는 partial+침투 → 파편상. 그 외(막힌 파편) → 타박.
    const penetrated = (ar === 'penetrated') || ev.fragmentPenetrated || (ar === 'partial' && (ev.fragmentPenetrated || ev._shallowPenetration));
    if (!penetrated) return 'bruise';      // 막힌 파편 — 출혈 아님
    return (penState === 'deep' || penState === 'penetrating' || penState === 'through_and_through') ? 'deep_fragment' : 'shallow_fragment';
  }
  // bullet penetrated
  if (penState === 'through_and_through') return 'perforating_gunshot';
  if (penState === 'penetrating' || penState === 'deep') {
    if (ev.partKey === 'chest' || ev.partKey === 'abdomen') return 'cavity_wound';
    if (_zoneIsJunctional(ev.anatomicalZone)) return 'junctional_wound';
    return 'penetrating_gunshot';
  }
  return 'penetrating_gunshot';
}

// 동적 woundSize — 탄종 고정표 금지. ammo 수치 + 피격/방호 결과 기반.
function computeWoundSize(ammo, ev, penState) {
  // SIDE-AMMO-1B-HOTFIX-5: 외부 12.7 micro fragment는 ammo.damage(본탄 160+)를 쓰지 않고 fragment 값으로만 산정 + sizeClass clamp
  if (ev.sourceType === 'frag' && ev.isFragment === true && !ev.internalBurst) {
    const ORDER = ['micro','small','medium','large','massive'];
    const capTo = (a, b) => ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];
    const fs = ev.fragmentSize || 'small';
    const wd = ev.fragmentWoundDepth || 'shallow_fragment';
    const rawD = (ev.rawDamage != null ? ev.rawDamage : (ev.tissueDamage != null ? ev.tissueDamage : 5));
    const sizeCapBySize = (fs === 'large') ? 'large' : (fs === 'medium') ? 'medium' : 'small';
    let sizeCapByDepth;
    switch (wd) {
      case 'abrasion': case 'bruise': case 'superficial_fragment': case 'blunt_trauma_armor': sizeCapByDepth = 'small'; break;
      case 'shallow_fragment': sizeCapByDepth = 'medium'; break;
      case 'light_deep_fragment': sizeCapByDepth = (fs === 'large') ? 'large' : 'medium'; break;
      case 'deep_fragment': case 'penetrating_fragment': sizeCapByDepth = (fs === 'large') ? 'large' : 'medium'; break;
      default: sizeCapByDepth = 'small';
    }
    let baseClass = rawD >= 14 ? 'large' : rawD >= 7 ? 'medium' : rawD >= 3 ? 'small' : 'micro';
    let sizeClass = capTo(capTo(baseClass, sizeCapBySize), sizeCapByDepth);
    if (sizeClass === 'massive') sizeClass = 'large';   // external micro fragment massive 금지
    const score = sizeClass === 'large' ? 56 : sizeClass === 'medium' ? 36 : sizeClass === 'small' ? 18 : 7;
    const clusterEligible = (sizeClass === 'micro' || sizeClass === 'small' || sizeClass === 'medium') && /abrasion|bruise|superficial_fragment|shallow_fragment|light_deep_fragment/.test(wd);
    return {
      sizeClass, sizeScore: score,
      entrySizeClass: capTo(sizeClass, 'small'), entrySizeScore: +(score * 0.5).toFixed(1),
      internalSizeClass: sizeClass, internalSizeScore: +(score * 0.6).toFixed(1),
      channelScale: 0.5, penetrationDepthScore: 12,
      expansionScore: 0.3, fragmentationScore: 1,
      residualThreatScore: 0, boneRiskHint: 0,
      tissueDamageMul: +(0.7 + score / 80).toFixed(2),
      bleedingMul: +(0.6 + score / 70).toFixed(2),
      painMul: +(0.7 + score / 90).toFixed(2),
      uiLabel: WOUND_SIZE_LABEL_KO[sizeClass],
      microFragment: true, microFragmentClusterEligible: clusterEligible,
      fragmentSizeTier: fs, fragmentWoundDepthTier: wd,
    };
  }
  const ia = ev.impactAddress || {};
  const rt = _normalizeResidualThreat(ev);          // §3: 안정적 참조
  const prof = ev.ammoMedicalProfile || {};          // §4: 의료 성향 보조값
  const tdm = (typeof prof.tissueDamageMul === 'number' && !isNaN(prof.tissueDamageMul)) ? prof.tissueDamageMul : 1.0;
  const bsm = (typeof prof.bleedSeverityMul === 'number' && !isNaN(prof.bleedSeverityMul)) ? prof.bleedSeverityMul : 1.0;
  const stopped = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed');
  // SHOTGUN-MED-NORM-1 §9: 산탄 펠릿은 shell 구경(12ga) 대신 실제 펠릿/dart 직경으로 wound size 계산.
  const pelletMeta = getMedicalProjectileMeta(ammo, ev);
  const calMm = pelletMeta.effectiveDiameterMm || _caliberMm(ammo);
  const pen = (ammo && ammo.penetration) || 0;
  // ammo 내재 데미지를 주 동인으로. 단, fragment(내부burst 포함)는 본탄 damage가 아니라 fragment 값 사용
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: bullet/penetrated 계열은 세부주소 woundMul 적용 (frag/산탄 중복 감쇠 금지)
  const _hapWoundMul = (ev.sourceType === 'frag' && ev.isFragment === true) ? 1.0 : ((ev.hitAddressWoundMul != null) ? ev.hitAddressWoundMul : 1.0);
  const dmg = ((ev.sourceType === 'frag' && ev.isFragment === true)
    ? (ev.rawDamage != null ? ev.rawDamage : (ev.tissueDamage != null ? ev.tissueDamage : 0))
    : Math.max((ammo && ammo.damage) || 0, (ev.rawDamage != null ? ev.rawDamage : 0))) * _hapWoundMul;
  const vel = (ammo && ammo.velocity) || 700;
  const beh = (ammo && ammo.barrierBehavior) || 'normal';
  // ════════════════════════════════════════════════════════════════════════════
  // [IMPACT-A Phase3] Kinetic Wound Size — canonical impact packet의 "실제" 충돌 kinetics 사용.
  //   ammo.velocity(프리셋 muzzle)가 아니라 impactVelocityMps(거리/장벽 감쇠 후)를 wound geometry에 반영.
  //   packet 없으면 kineticFallback=true → 기존 프리셋 vel로 legacy 계산 (AAR/debug 구분).
  //   에너지 double counting 금지: entry는 구경 지배, temporary cavity만 impact energy 사용(포화 곡선).
  // ════════════════════════════════════════════════════════════════════════════
  const _pkt = ev.impactPacket || null;
  const _hasKin = !!(_pkt && _pkt.kineticBasis && _pkt.impactVelocityMps != null && _pkt.impactVelocityMps > 0);
  const _kineticFallback = !_hasKin;
  // 실제 충돌속도/에너지/운동량 (packet 우선, 없으면 프리셋 fallback)
  const impactVel = _hasKin ? _pkt.impactVelocityMps : vel;
  const impactE = _hasKin ? (_pkt.impactEnergyJ || 0) : null;
  const energyRatioK = _hasKin ? (_pkt.energyRatio != null ? _pkt.energyRatio : 1) : 1;
  const impactMom = _hasKin ? (_pkt.impactMomentumNs || 0) : null;
  const projIntegrity = (_pkt && _pkt.residualIntegrity != null) ? _pkt.residualIntegrity : null;
  // 에너지 포화 곡선 — 절대에너지의 선형 증가 금지. temporary cavity 발현도만 완만히 반영.
  //   0J→0, ~1500J→~0.7, ~3500J→~1.0 (고에너지 소총탄이 자동 massive 되지 않도록).
  const _energySat = (impactE != null) ? Math.min(1.0, 1 - Math.exp(-impactE / 1400)) : null;
  // 운동량 보조 — 저속 중량탄(slug)이 낮은 velocity만으로 과소평가되지 않도록.
  const _momentumAssist = (impactMom != null) ? Math.min(1.0, impactMom / 12) : null;
  // [0.39.3 A-Closure] canonical projectile profile — apLike/heavySlow/fragLike를 단일 source에서 읽음.
  //   slow_penetrator 계열·sabot·armor_piercing override 전부 apLike로 인식 (exact 문자열 3개 비교 폐기).
  const _profile = getCanonicalProjectileProfile(ammo);
  const apLike = _profile.apLike;
  const fragLike = _profile.fragmentingLike || _profile.expandingLike;
  const residualPen = rt.residualPen;
  const residualPenPresent = !!rt.residualPenPresent;   // [0.39.2 Fix2] 명시적 0 vs 누락 구분
  const om = rt.overmatchMargin;
  const integrity = rt.residualIntegrity;

  // 입구 — 구경 지배, 확장(HP)↑, AP narrow
  let entry = calMm * 3.2;
  if (fragLike) entry *= 1.25;
  if (apLike) entry *= 0.72;
  if (ev.sourceType === 'frag') entry = 18 + dmg * 0.4;
  if (ev.sourceType === 'blast') entry = 40 + dmg * 0.3;
  // 내부 — [IMPACT-A Phase3] permanent cavity(구경/crush/파편) + temporary cavity(실제 impact energy) 분리.
  //   permanent: 유효직경·확장·파편·잔여관통 지배 (에너지 아님). temporary: 실제 impact energy 포화 곡선.
  //   기존 damage 기반 항은 rawDamage 호환 입력으로만 (energy와 중복 곱 금지).
  let internal = dmg * 0.45 + pen * 0.25;   // rawDamage/pen 호환 기반 (velocity 항 제거 — 아래 kinetic으로 대체)
  // permanent cavity 성분 — 구경·확장·파편·잔여관통 (에너지 비의존)
  let permanentCavity = calMm * 1.1 + (residualPen != null ? residualPen : 0) * 0.4;
  if (fragLike) permanentCavity *= 1.18;
  if (apLike) permanentCavity *= 0.82;   // AP: 좁은 permanent cavity
  // temporary cavity 성분 — 실제 impact energy 포화 (fallback: 프리셋 vel 기반 legacy 근사)
  // [0.39.3 A-Closure] 중량 아음속 판정 — canonical profile.heavySlow만 사용 (ID 정규식 재추측 폐기).
  //   'heavy'만 momentum crush 보조. pdw_light/standard/armor_piercing은 보너스 없음. slug는 별도 분기.
  const _subClass = _profile.subsonicClass;
  const _isSlug = /slug/i.test((_pkt && _pkt.projectileClass) || '') || /slug/i.test((ammo && ammo.id) || '');
  const _heavySlow = _profile.heavySlow;
  let temporaryCavity;
  if (_hasKin && _energySat != null) {
    // energy 포화 × terminal 발현 조건. 저속 권총탄은 낮은 energySat로 자동 억제.
    let termMul = 1.0;
    if (fragLike) termMul = 1.15;          // 파편/확장: temporary cavity 발현↑
    else if (apLike) termMul = 0.55;       // AP: 조직 통과, temporary cavity 작음 (좁고 깊음)
    if (_heavySlow) termMul = Math.min(termMul, 0.7);   // 중량 아음속: temporary cavity 과장 금지
    temporaryCavity = _energySat * 55 * termMul;
    // 운동량 보조 — 중량/저속탄: 낮은 velocity지만 momentum으로 permanent crush 보강 (temporary 과장 아님)
    if (_momentumAssist != null && _heavySlow) {
      permanentCavity += _momentumAssist * 14;   // permanent cavity/관통 과소평가 방지
    } else if (_momentumAssist != null && _isSlug) {
      permanentCavity += _momentumAssist * 12;
    }
  } else {
    // legacy fallback — 기존 프리셋 vel 공식 유지 (kineticFallback=true로 표시됨)
    temporaryCavity = Math.max(0, vel - 600) * 0.10;
  }
  internal += permanentCavity * 0.5 + temporaryCavity * 0.5;
  if (fragLike) internal *= 1.18;
  if (apLike) internal *= 0.92;
  if (ev.sourceType === 'blast') internal = 45 + dmg * 0.4;
  // §4: tissueDamageMul 보조 반영 (AP 낮음→좁고 깊음 유지, HP/deform 높음→내부↑) — 보수적 clamp
  const tdmMul = Math.max(0.82, Math.min(1.28, 0.9 + (tdm - 1) * 0.45));
  internal *= tdmMul;
  // SIDE-AMMO-1B §3-8: sabot 관통자는 wound channel이 좁다 (관통은 높아도 공동은 작음)
  const _sab = (typeof _sabotInfo === 'function') ? _sabotInfo(ammo) : null;
  if (_sab) { entry *= _sab.woundChannelMul; internal *= (0.5 + 0.5 * _sab.woundChannelMul); }
  // 깊이/채널 — [0.39.1 Fix3] residual threat 중심. 우선순위: residualPen > integrity > continuation > kinetics > ammo.penetration(fallback).
  //   같은 탄약이라도 실제 잔여위협(residualPen/integrity)이 낮아지면 깊이도 감소한다.
  let channel;
  if (_hasKin && residualPenPresent) {
    // [0.39.2 Fix2] residualPen이 명시적으로 존재(0 포함) → ammo.penetration fallback 금지. 실제 잔여값 지배.
    const _rpBase = Math.max(0, residualPen);   // 0이면 0 그대로 (프리셋 부활 없음)
    channel = Math.min(1.7, 0.30 + _rpBase * 0.022 + om * 0.015);
    // continuation depth(관통 지속) 보강, integrity 저하 시 감쇠
    if (rt.continuationDepth) channel = Math.min(1.8, channel + Math.min(0.3, rt.continuationDepth * 0.02));
    if (integrity != null && integrity < 0.6) channel *= (0.5 + integrity * 0.7);   // 발사체 파손/변형 → 얕아짐
    // momentum 보조 — 중량 저속탄이 residual만으로 과소평가되지 않게 소폭 하한 보정 (단, 잔여 0이면 하한도 낮게)
    if (_momentumAssist != null && _momentumAssist > 0.5 && _rpBase > 0) channel = Math.max(channel, 0.55 + _momentumAssist * 0.35);
  } else {
    // legacy fallback — residualPen 데이터 누락(null) 시에만 ammo.penetration 기준선 사용
    channel = Math.min(1.6, 0.4 + pen * 0.02 + om * 0.02);
  }
  // SHOTGUN-MED-NORM-1 §9: 산탄 펠릿 의료 보정 (slug 미적용 — isShotgunPellet일 때만)
  if (pelletMeta.isShotgunPellet) {
    entry *= Math.sqrt(pelletMeta.medicalScalar);
    internal *= pelletMeta.medicalScalar;
    if (pelletMeta.isFlechette) {
      // flechette: 좁고 깊은 puncture. 공동/사출구 과장 금지.
      entry *= 0.75; internal *= 0.65; channel = Math.min(channel, 0.95);
    }
    if (pelletMeta.isBuckshot) {
      // buckshot: 둥근 납 펠릿. 근거리 위험하나 소총탄급 cavity 아님.
      channel = Math.min(channel, 1.05);
    }
  }
  if (apLike) channel = Math.min(1.7, channel + 0.2);    // 좁고 깊음
  // 방호 감쇠
  if (stopped) { entry *= 0.18; internal *= 0.10; channel *= 0.4; }
  else if (penState === 'shallow') { entry *= 0.62; internal *= 0.45; }
  else if (penState === 'deep') { entry *= 0.85; internal *= 0.78; }

  let entryScore = Math.max(0, entry);
  let internalScore = Math.max(0, internal * channel);
  let sizeScore = entryScore * 0.4 + internalScore * 0.6;

  // 등급
  const bigCaliber = calMm >= 10;
  const blast = ev.sourceType === 'blast';
  const canMassive = bigCaliber || blast || (sizeScore >= 92);   // frag(내부burst 포함)는 massive 금지
  let sizeClass = _woundSizeClassFromScore(sizeScore);
  if (sizeClass === 'massive' && !canMassive) sizeClass = 'large';
  if (stopped && (sizeClass === 'large' || sizeClass === 'massive')) sizeClass = 'small';
  if (stopped && sizeClass === 'medium') sizeClass = 'small';
  let entrySizeClass = _woundSizeClassFromScore(entryScore);
  let internalSizeClass = _woundSizeClassFromScore(internalScore);
  if (stopped) { if (entrySizeClass === 'large' || entrySizeClass === 'massive') entrySizeClass = 'small'; if (internalSizeClass !== 'micro') internalSizeClass = 'small'; }
  // AP는 입구 작게, massive 금지(대구경/폭발 제외)
  if (apLike && !bigCaliber && (entrySizeClass === 'large' || entrySizeClass === 'massive')) entrySizeClass = 'medium';

  // §4: bleedSeverityMul → bleedingMul 보조 (clamp)
  const bsmMul = Math.max(0.8, Math.min(1.35, bsm));
  const fcChance = (typeof prof.fractureChance === 'number') ? prof.fractureChance : 0;
  let expansionScore = fragLike ? 1 : (apLike ? 0 : 0.5);
  let fragmentationScore = fragLike ? 1 : (integrity < 0.4 ? 0.6 : 0.2);
  // SHOTGUN-MED-NORM-1 §10: 산탄 펠릿 wound size class 상한 clamp (slug 미적용)
  if (pelletMeta.isShotgunPellet) {
    sizeClass = clampWoundClass(sizeClass, pelletMeta.maxInternalClass);
    entrySizeClass = clampWoundClass(entrySizeClass, pelletMeta.maxEntryClass);
    internalSizeClass = clampWoundClass(internalSizeClass, pelletMeta.maxInternalClass);
    if (pelletMeta.isFlechette) {
      sizeClass = clampWoundClass(sizeClass, 'small');
      entrySizeClass = clampWoundClass(entrySizeClass, 'micro');
      internalSizeClass = clampWoundClass(internalSizeClass, 'small');
      fragmentationScore = Math.min(fragmentationScore, 0.1);
      expansionScore = 0;
    }
  }
  return {
    sizeClass, sizeScore: +sizeScore.toFixed(1),
    entrySizeClass, entrySizeScore: +entryScore.toFixed(1),
    internalSizeClass, internalSizeScore: +internalScore.toFixed(1),
    channelScale: +channel.toFixed(2),
    penetrationDepthScore: +(channel * 50).toFixed(1),
    expansionScore,
    fragmentationScore,
    residualThreatScore: +((residualPen != null ? residualPen : 0)).toFixed(1),
    boneRiskHint: +Math.min(1, fcChance).toFixed(2),
    tissueDamageMul: +(0.7 + internalScore / 70).toFixed(2),
    bleedingMul: +((0.6 + sizeScore / 60) * bsmMul).toFixed(2),
    painMul: +(0.7 + sizeScore / 80).toFixed(2),
    uiLabel: WOUND_SIZE_LABEL_KO[sizeClass],
    // [IMPACT-A Phase3] additive kinetic 출력 (기존 소비자 비파괴 — 추가 필드)
    permanentCavityScore: +Math.max(0, permanentCavity).toFixed(1),
    temporaryCavityScore: +Math.max(0, temporaryCavity).toFixed(1),
    kineticBasis: _hasKin,
    kineticFallback: _kineticFallback,
    impactVelocityMps: _hasKin ? +impactVel.toFixed(1) : null,
    impactEnergyJ: (impactE != null) ? +impactE.toFixed(1) : null,
    impactMomentumNs: (impactMom != null) ? +impactMom.toFixed(3) : null,
    energyRatio: _hasKin ? +energyRatioK.toFixed(4) : null,
    momentumRatio: (_pkt && _pkt.momentumRatio != null) ? _pkt.momentumRatio : null,
    projectileIntegrity: (projIntegrity != null) ? +projIntegrity.toFixed(3) : null,
    // [0.39.3 A-Closure] canonical profile 추적 (additive, AAR/debug)
    subsonicClass: _profile.subsonicClass,
    terminalBehaviorClass: _profile.terminalBehaviorClass,
    apLike: _profile.apLike,
    heavySlow: _profile.heavySlow,
    profileFallbackUsed: _profile.fallbackUsed,
    profileFallbackReasons: _profile.fallbackReasons,
  };
}

// bleedingProfile — 혈관/장기 후보, zone, penState가 size보다 중요
// [심층의료 계약면 §9.3] bleedingProfile = wound 단위 ongoing 출혈의 source-of-truth.
//   bodyParts bleedRate는 wound 합산 표시/legacy fallback일 뿐 — wound 값을 절대 덮어쓰지 않는다.
//   현장처치는 external/muscle/junctional 일부만 제어, cavity internal은 surgery/evac 후보로 유지.
function computeBleedingProfile(ammo, ev, woundType, woundSize, penState) {
  const partKey = ev.partKey;
  const zone = ev.anatomicalZone;
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const isCavityPart = (partKey === 'chest' || partKey === 'abdomen');
  const junctional = _zoneIsJunctional(zone);
  const vesselCrit = _zoneIsVesselCritical(zone, partKey);
  // 비출혈 유형
  if (woundType === 'bruise' || woundType === 'abrasion' || woundType === 'blunt_trauma' || woundType === 'blunt_trauma_armor' || woundType === 'none') {
    return { bleedingType:'none', baseExternal:0, baseInternal:0, currentExternal:0, currentInternal:0, rebleedRisk:0, tourniquetEligible:false, vesselRisk:0 };
  }
  const bmul = (woundSize && woundSize.bleedingMul) || 1.0;
  // 기본 출혈량 (severity → ml/s 근사)
  let baseRate = (ev.bleedRisk || 0) * 18 + (woundSize ? woundSize.sizeScore * 0.18 : 4);
  baseRate *= bmul;
  if (woundSize && woundSize.sizeClass === 'micro') baseRate = Math.min(baseRate, 0.8);
  baseRate = Math.max(0, baseRate);
  let bleedingType = 'external', ext = baseRate, intl = 0, tourniquetEligible = false, rebleed = 0.3;
  let vesselRisk = (ev.bleedRisk || 0);
  if (vesselCrit) vesselRisk = Math.max(vesselRisk, 0.9);

  if (junctional) {
    bleedingType = 'junctional';
    ext = baseRate * 1.1; tourniquetEligible = false; rebleed = 0.5;
  } else if (isCavityPart && (woundType === 'cavity_wound' || penState === 'penetrating' || penState === 'through_and_through' || penState === 'deep')) {
    bleedingType = 'cavity';
    ext = baseRate * 0.25; intl = baseRate * 1.1; tourniquetEligible = false; rebleed = 0.4;
  } else if (isCavityPart) {
    bleedingType = 'mixed';
    ext = baseRate * 0.4; intl = baseRate * 0.7; tourniquetEligible = false; rebleed = 0.35;
  } else if (isLimb) {
    bleedingType = 'external';
    ext = baseRate; tourniquetEligible = true; rebleed = 0.45;
  } else if (partKey === 'neck') {
    bleedingType = vesselCrit ? 'junctional' : 'external';
    ext = baseRate; tourniquetEligible = false; rebleed = 0.6;
  } else if (partKey === 'head') {
    bleedingType = 'external'; ext = baseRate * 0.7; intl = baseRate * 0.3; tourniquetEligible = false;
  }
  // AP narrow지만 vesselRisk 높으면 치명
  if (vesselRisk > 0.7) { ext *= 1.2; intl *= 1.2; }
  return {
    bleedingType, baseExternal:+ext.toFixed(2), baseInternal:+intl.toFixed(2),
    currentExternal:+ext.toFixed(2), currentInternal:+intl.toFixed(2),
    rebleedRisk:+rebleed.toFixed(2), tourniquetEligible, vesselRisk:+vesselRisk.toFixed(2),
  };
}

// fieldCare — 크기와 분리. zone/장기/혈관 후보가 결정적.
function computeFieldCare(ev, woundType, woundSize, bleedingProfile) {
  // 비출혈 둔상/타박/찰과는 현장처치 가능
  if (woundType === 'bruise' || woundType === 'abrasion' || woundType === 'blunt_trauma' || woundType === 'blunt_trauma_armor' || woundType === 'none') return 'treatable';
  if (bleedingProfile && bleedingProfile.bleedingType === 'none' && woundType !== 'cavity_wound') return 'treatable';
  const partKey = ev.partKey;
  const zone = ev.anatomicalZone;
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const vesselCrit = _zoneIsVesselCritical(zone, partKey);
  const size = woundSize ? woundSize.sizeClass : 'small';
  // 목/심장/대혈관 후보 — 현장처치 불가
  if (vesselCrit || (partKey === 'neck' && bleedingProfile.bleedingType === 'junctional')) return 'field_unmanageable';
  if (partKey === 'neck' && (size === 'large' || size === 'massive')) return 'field_unmanageable';
  // 체강 출혈
  if (bleedingProfile.bleedingType === 'cavity') {
    if (size === 'massive') return 'field_unmanageable';
    if (size === 'large') return 'limited';
    return 'limited';
  }
  // 사지 초대형 — 지혈대로 응급 억제 가능
  if (isLimb) {
    if (size === 'massive') return 'controllable';
    return 'treatable';
  }
  // 접합부
  if (bleedingProfile.bleedingType === 'junctional') return (size === 'massive') ? 'field_unmanageable' : 'limited';
  // 복부/흉부 일반
  if (partKey === 'chest' || partKey === 'abdomen') return (size === 'massive') ? 'field_unmanageable' : 'limited';
  if (woundType === 'bruise' || woundType === 'abrasion' || woundType === 'blunt_trauma') return 'treatable';
  return 'treatable';
}

// treatmentProfile — 가능 처치 + 부위 전체 처치 키
function computeTreatmentProfile(ev, woundType, bleedingProfile, fieldCare) {
  const partKey = ev.partKey;
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const junctional = (bleedingProfile.bleedingType === 'junctional');
  const cavity = (bleedingProfile.bleedingType === 'cavity');
  const internalOnly = (bleedingProfile.bleedingType === 'internal');
  const hasExt = (bleedingProfile.bleedingType !== 'none' && !cavity && !internalOnly);
  const isChest = (partKey === 'chest');
  const isPenetratingChest = isChest && (woundType === 'cavity_wound' || woundType === 'penetrating_gunshot' || woundType === 'perforating_gunshot');
  const recommended = [];
  const prof = {
    // 2B-0-FINAL §11: 활성 — pressureBandage / tourniquet / chestSeal(placeholder)
    pressureBandageEligible: hasExt || junctional,
    tourniquetEligible: isLimb && bleedingProfile.tourniquetEligible && !junctional,
    chestSealEligible: isPenetratingChest,
    // 후속용(현재 버튼 숨김) — 데이터 호환 유지
    bandageEligible: hasExt,
    hemostaticEligible: hasExt && (junctional || woundType === 'deep_fragment' || partKey === 'neck'),
    packingEligible: junctional || cavity || woundType === 'deep_fragment' || partKey === 'abdomen' || partKey === 'neck',
    splintRelevant: !!ev._fracture,
    pelvicBinderRelevant: (partKey === 'abdomen'),
    bodyPartTreatmentKey: partKey,
    treatmentPriority: 0,
    recommendedActions: recommended,
  };
  // 추천 — 압박붕대/지혈대/체스트씰 중심
  if (isLimb && prof.tourniquetEligible && bleedingProfile.currentExternal > 14) { recommended.push('tourniquet'); if (prof.pressureBandageEligible) recommended.push('pressure_bandage'); }
  else if (prof.pressureBandageEligible) recommended.push('pressure_bandage');
  if (prof.chestSealEligible) recommended.push('chestseal');   // placeholder (무조건 1순위는 아님)
  if (fieldCare === 'field_unmanageable') prof.treatmentPriority = 5;
  else if (cavity || junctional) prof.treatmentPriority = 4;
  else if (bleedingProfile.currentExternal > 12) prof.treatmentPriority = 3;
  else if (bleedingProfile.bleedingType !== 'none') prof.treatmentPriority = 2;
  return prof;
}

// 출혈 wound 생성 조건 (§17)
function _woundShouldBleed(ev, penState) {
  if (ev.armorResult === 'penetrated') return true;
  if (ev.wasPenetrated) return true;
  if (penState === 'shallow' || penState === 'deep' || penState === 'penetrating' || penState === 'through_and_through') return true;
  if (ev.sourceType === 'frag' && ev.fragmentPenetrated) return true;
  // 막힌 파편(stopped + !fragmentPenetrated) → 출혈 없음
  return false;
}

// woundDescriptor 생성 — null이면 wound 미기록 (경미)
// =============================================================
