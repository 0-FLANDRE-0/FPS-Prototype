// Generated from unchanged CQB declarations; see scripts/training-protection.mjs.
export const LEGACY_PROTECTION_SOURCES = [{"path":"src/medical/wound-metadata.js","sha256":"78c275b1fae05d0f56b04d60a680ce8460ee21d1e460a9d1bf6ce292b54542c1","declarations":["_CALIBER_MM_TABLE","_caliberStringToMm","getProjectileDiameterMm"]},{"path":"src/combat/armor-durability.js","sha256":"432d05492fc34b41ac90b6a8a2eb6810583f9c3df21567d99f50a03305d1a853","declarations":["ARMOR_DURABILITY_CURVES","getDurabilityArmorMul","ARMOR_VALID_DUR_MATERIALS","normalizeDurabilityMaterial","SUBSONIC_CLASS_REGISTRY","getSubsonicClass","_apLikeFromBehavior","_isBarrierBlindBehavior","getCanonicalProjectileMassG","getCanonicalProjectileProfile","getArmorThreatClass","computeProjectileKinetics","resolveKineticPenetrationMul","ARMOR_MATERIAL_THREAT_RESPONSE","getAmmoArmorWearBase","getArmorMaterialThreatResponse","getPenetrationPressureFactor","getArmorHitResultFactor","getArmorVelocityFactor","ARMOR_LOCAL_SEVERITY","ARMOR_LOCAL_MIN_MUL","ARMOR_MATERIAL_DAMAGE_PROFILE","getArmorMaterialDamageProfile","_ensureLocalZones","ARMOR_ZONE_NEIGHBORS","applyArmorLocalZoneDamage","getArmorLocalZoneMul","ARMOR_DAMAGE_MODE_LABEL_KO","getArmorKineticWearFactor","resolveArmorDamageDistribution","resolveMaterialArmorDamageState","ARMOR_WEAR_TUNING_SCALE","getAmmoLocalSeverity","applyPenetrationLocalityRebalance","applyArmorGlobalDamageCaps","applyNeighborSplashRebalance","computeArmorDurabilityDamage","applyArmorWearMinimums"]},{"path":"src/combat/damage-outcomes.js","sha256":"0b41791a21bd809630e12d9d339edbd6a8ac635008c0a515ddcaf545af2fd191","declarations":["effectivePenetration"]},{"path":"src/combat/armor-resolution.js","sha256":"f5a4dc104a6c5d6b434a687030a3280e1dc875a4350268969f609c7271a385f7","declarations":["penetrationProbability","rollPenetration","getHelmetArmorPenalty","applyHelmetArmorPenalty","residualPenetrationAfterHard","_sabotInfo","_ammoBarrierInfo","buildResidualThreatAfterHard","canBackerAttemptStop","backerStopChanceGate","backerMitigationFactor","computeBackerResolution"]},{"path":"src/combat/impact-address.js","sha256":"3cb53d13f4175e78630dd3bffd1f5d67c8ca256ae70d03b496a9d1f0a6da2cc2","declarations":["HELMET_ZONE_CURVATURE","getMaterialRicochetMul","computeRicochetHint"]},{"path":"src/medical/body-trauma.js","sha256":"1fb2bfa93ce9328ad2d46fe3c309f4120e43e1aa024393541124a94c620dbcf1","declarations":["BODY_RESISTANCE","_bodyTerminalMods"],"bodyDepthBlockSha256":"b84cb65cfd58c29874e73ca0924d128256863e6bce73ce44629913ff36e3d158"}];
export function createLegacyProtection(random = globalThis.Math.random, { resolvedScale = true } = {}) {
const Math = Object.create(globalThis.Math); Math.random = random; const ARMOR_SCALE = resolvedScale ? 1 : 10;
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
const ARMOR_DURABILITY_CURVES = {
  steel:    [[1.00,1.00],[0.70,0.98],[0.50,0.93],[0.30,0.82],[0.15,0.60],[0.00,0.30]],
  ceramic:  [[1.00,1.00],[0.80,0.92],[0.60,0.80],[0.40,0.62],[0.20,0.38],[0.00,0.10]],
  titanium: [[1.00,1.00],[0.70,0.96],[0.50,0.88],[0.30,0.72],[0.15,0.55],[0.00,0.25]],
  pe:       [[1.00,1.00],[0.75,0.97],[0.50,0.88],[0.30,0.65],[0.15,0.35],[0.00,0.10]],
  aramid:   [[1.00,1.00],[0.75,0.94],[0.50,0.80],[0.30,0.58],[0.15,0.35],[0.00,0.12]],
  aluminum: [[1.00,1.00],[0.75,0.90],[0.50,0.72],[0.30,0.50],[0.15,0.30],[0.00,0.10]],
  composite:[[1.00,1.00],[0.75,0.95],[0.50,0.85],[0.30,0.68],[0.15,0.45],[0.00,0.15]],
  glass:    [[1.00,1.00],[0.75,0.85],[0.50,0.60],[0.30,0.35],[0.15,0.18],[0.00,0.03]],
  fabric:   [[1.00,1.00],[0.00,1.00]],   // 비방호 — 변화 없음
};
function getDurabilityArmorMul(material, ratio) {
  if (ratio == null || isNaN(ratio)) return 1.0;
  const r = Math.max(0, Math.min(1, ratio));
  const curve = ARMOR_DURABILITY_CURVES[material] || ARMOR_DURABILITY_CURVES.composite;
  // 키포인트가 높은 ratio → 낮은 ratio 순. 보간
  for (let i = 0; i < curve.length - 1; i++) {
    const [r0, m0] = curve[i], [r1, m1] = curve[i+1];
    if (r <= r0 && r >= r1) {
      const t = (r0 === r1) ? 0 : (r0 - r) / (r0 - r1);
      return m0 + (m1 - m0) * t;
    }
  }
  return curve[curve.length-1][1];
}

// =============================================================
// SIDE-ARMOR-DURABILITY-REALISM-1: 재질 반응형 장비 손상 공통 계산
// =============================================================
// ARMOR-HOTFIX-1 §5: 'mixed' 등 비정규 재질을 실제 곡선/반응표 재질로 정규화.
//   'mixed'는 표시/분류 전용 — 계산에는 zoneHint(선택 zone durabilityMaterial)를 우선,
//   없으면 보수적으로 더 약한 glass를 사용 (composite fallback 금지).
const ARMOR_VALID_DUR_MATERIALS = ['glass','titanium','ceramic','steel','pe','aramid','aluminum','composite','fabric'];
function normalizeDurabilityMaterial(material, zoneHint, fallback) {
  if (zoneHint && ARMOR_VALID_DUR_MATERIALS.includes(zoneHint)) return zoneHint;
  if (material === 'mixed') return (zoneHint && ARMOR_VALID_DUR_MATERIALS.includes(zoneHint)) ? zoneHint : 'glass';
  if (material && ARMOR_VALID_DUR_MATERIALS.includes(material)) return material;
  if (fallback && ARMOR_VALID_DUR_MATERIALS.includes(fallback)) return fallback;
  return 'composite';
}
// §6 탄 위협 분류 — caliber/penetration/barrierBehavior/pelletCount/id 기반
// ════════════════════════════════════════════════════════════════════════════
// [0.39.2 Fix4] Subsonic classification — 단일 canonical source-of-truth.
//   ID 정규식(subsonic/300/blk 등)으로 각 시스템이 재추측하지 않는다. 모든 소비자
//   (getArmorThreatClass / computeWoundSize heavy-slow / momentum assist / AAR)가 이 helper를 공유.
//   반환: 'none' | 'pdw_light' | 'standard' | 'heavy' | 'armor_piercing'
//   우선순위: 1) ammo.subsonicClass 인라인 필드 2) exact-ID registry 3) 'none'
// ════════════════════════════════════════════════════════════════════════════
const SUBSONIC_CLASS_REGISTRY = {
  // 경량 PDW 아음속 — heavy-slow 보조 금지, PDW penetrator 성격 유지
  '4.6_subsonic_sx': 'pdw_light',
  '5.7_sb193_subsonic': 'pdw_light',
  // 소구경 감속 아음속 — 중량탄 crush 보너스 금지
  '545_us_gs': 'standard',
  // 중량 아음속 — heavy-slow momentum 보조 허용, temporary cavity 제한
  '762x39_us': 'heavy',
  '9x21_7u4_subsonic': 'heavy',
  '9x39_sp5_7n8': 'heavy',
  '300blk_220_subsonic': 'heavy',
  '338lm_ucw_subsonic': 'heavy',
  '127x55_ps12': 'heavy',
  // 아음속 AP — 좁고 깊은 AP 성격, heavy ball crush 확대 금지
  '9x39_sp6_7n9': 'armor_piercing',
  '9x39_pab9': 'armor_piercing',
  '9x39_bp_7n12': 'armor_piercing',
  '127x55_ps12b': 'armor_piercing',
};
function getSubsonicClass(ammo) {
  if (!ammo) return 'none';
  // 1) 인라인 명시 필드 (registry override / future-proof)
  const inline = ammo.subsonicClass || (ammo.projectile && ammo.projectile.subsonicClass);
  if (inline === 'none' || inline === 'pdw_light' || inline === 'standard' || inline === 'heavy' || inline === 'armor_piercing') return inline;
  // 2) exact-ID registry (canonical source-of-truth)
  const id = ammo.id || '';
  if (Object.prototype.hasOwnProperty.call(SUBSONIC_CLASS_REGISTRY, id)) return SUBSONIC_CLASS_REGISTRY[id];
  // 3) 미분류 — none (ID 정규식 추측 없음). subsonic이지만 미등록이면 안전하게 none.
  return 'none';
}
// ════════════════════════════════════════════════════════════════════════════
// [0.39.3 A-Closure] Canonical Projectile Profile — physical / armorThreat / terminalBehavior /
//   subsonic behavior를 단일 읽기전용 profile로 통합. 모든 소비자(getArmorThreatClass wrapper,
//   computeWoundSize, terminal 선택, armor durability, impact packet, AAR)가 이 profile을 읽고
//   ID/caliber 정규식으로 재추측하지 않는다. legacy inference는 이 builder 내부에서만 fallback으로 사용.
// ════════════════════════════════════════════════════════════════════════════
// AP 성격 barrier behavior (좁고 깊음) — penetrator 계열 + sabot. [0.39.4] barrier_blind는 AP 아님(별도 속성).
function _apLikeFromBehavior(beh) {
  if (!beh) return false;
  const b = String(beh);
  return b === 'penetrator' || b === 'penetrator_unstable' || b === 'pistol_penetrator'
      || b === 'slow_penetrator' || b === 'slow_penetrator_unstable' || b === 'slow_penetrator_high'
      || b === 'slow_large_penetrator' || b === 'large_penetrator'
      || b === 'precision' || b === 'precision_heavy'
      || /sabot/.test(b) || /_api\b|heiap|_ap\b/.test(b);
}
// barrier-blind: 장애물 통과 후 안정적 terminal (AP와 무관). 독립 속성.
function _isBarrierBlindBehavior(beh) { return String(beh || '') === 'barrier_blind'; }
function getCanonicalProjectileMassG(ammo) {
  if (!ammo) return { massG: null, source: 'none' };
  if (ammo.projectile && typeof ammo.projectile.massG === 'number' && ammo.projectile.massG > 0) return { massG: ammo.projectile.massG, source: 'explicit_projectile' };
  if (typeof ammo.projectileMassG === 'number' && ammo.projectileMassG > 0) return { massG: ammo.projectileMassG, source: 'explicit_flat' };
  return { massG: null, source: 'missing' };
}
function getCanonicalProjectileProfile(ammo) {
  const fallbackReasons = [];
  if (!ammo) return { ammoId: null, massG: null, diameterMm: 7, energyClass: null, subsonicClass: 'none',
    armorThreatClass: 'pistol_fmj', terminalBehaviorClass: 'rifle_ball', apLike: false, fragmentingLike: false,
    expandingLike: false, heavySlow: false, physicalSource: 'none', classificationSource: 'none', fallbackUsed: true, fallbackReasons: ['no_ammo'] };
  const id = ammo.id || null;
  const beh = ammo.barrierBehavior || (ammo.armorInteraction && ammo.armorInteraction.barrierBehavior) || 'normal';
  const energyClass = ammo.energyClass || (ammo.energy && ammo.energy.class) || null;
  // physical
  const massR = getCanonicalProjectileMassG(ammo);
  if (massR.massG == null) fallbackReasons.push('mass_missing');
  const _diaExplicit = (ammo.projectile && ammo.projectile.diameterMm > 0) || ammo.projectileDiameterMm > 0
    || (ammo.projectile && ammo.projectile.effectiveDiameterMm > 0);
  const diameterMm = getProjectileDiameterMm(ammo);
  let physicalSource;
  if (_diaExplicit && massR.massG != null) physicalSource = 'explicit';
  else if (_caliberStringToMm(ammo.caliber) != null) { physicalSource = 'caliber_table'; if (!_diaExplicit) fallbackReasons.push('diameter_caliber_table'); }
  else { physicalSource = 'legacy_parser'; fallbackReasons.push('diameter_legacy_parser'); }
  // classification
  const subsonicClass = getSubsonicClass(ammo);
  const _subExplicit = !!(ammo.subsonicClass || (ammo.projectile && ammo.projectile.subsonicClass) || (id && Object.prototype.hasOwnProperty.call(SUBSONIC_CLASS_REGISTRY, id)));
  const classificationSource = _subExplicit ? 'registry' : ((energyClass === 'subsonic') ? 'inferred_subsonic' : 'non_subsonic');
  // [0.39.3] degraded fallback만 추적: subsonic인데 미분류 = 문제. non-subsonic의 none은 정상.
  const _degradedSubsonic = (energyClass === 'subsonic' && !_subExplicit);
  if (_degradedSubsonic) fallbackReasons.push('subsonic_unclassified');
  // terminal behavior class — subsonic 분류 우선, 그 외 behavior/energy 기반
  const isPellet = (ammo.pelletCount || 1) > 1;
  const isSlug = /slug/i.test(id || '') || /slug/i.test(String(ammo.caliber || ''));
  const fragmentingLike = (beh === 'fragment' || beh === 'fragment_heavy' || beh === 'frangible');
  const expandingLike = (beh === 'deform' || beh === 'deform_heavy');
  const apLike = _apLikeFromBehavior(beh) || subsonicClass === 'armor_piercing';
  const barrierBlind = _isBarrierBlindBehavior(beh);   // [0.39.4] barrier-blind는 AP와 독립 속성
  let terminalBehaviorClass;
  if (subsonicClass === 'pdw_light') terminalBehaviorClass = 'pdw_subsonic';
  else if (subsonicClass === 'standard') terminalBehaviorClass = 'subsonic_standard';
  else if (subsonicClass === 'armor_piercing') terminalBehaviorClass = 'subsonic_ap';
  else if (subsonicClass === 'heavy') terminalBehaviorClass = 'subsonic_heavy';
  else if (isPellet) terminalBehaviorClass = /flech/i.test(id || '') ? 'pellet' : 'pellet';
  else if (isSlug) terminalBehaviorClass = 'slug';
  else if (fragmentingLike) terminalBehaviorClass = 'fragmenting';
  else if (expandingLike) terminalBehaviorClass = 'expanding';
  else if (apLike) terminalBehaviorClass = 'rifle_ap';
  else if (barrierBlind) terminalBehaviorClass = expandingLike ? 'expanding' : 'rifle_ball';   // barrier-blind는 rifle_ap 아님
  else terminalBehaviorClass = 'rifle_ball';
  // heavy-slow: 오직 subsonicClass==='heavy'
  const heavySlow = (subsonicClass === 'heavy');
  // armor threat — 기존 canonical 로직 재사용 (이미 getSubsonicClass 반영됨)
  const armorThreatClass = getArmorThreatClass(ammo);
  return {
    ammoId: id, massG: massR.massG, diameterMm, energyClass, subsonicClass,
    armorThreatClass, terminalBehaviorClass, apLike, barrierBlind, fragmentingLike, expandingLike, heavySlow,
    physicalSource, classificationSource,
    // fallbackUsed는 "실제로 degraded된" 경로만: legacy parser diameter, mass 누락, subsonic 미분류.
    //   caliber 변환표(§3-1 우선순위 #3)는 정상 canonical source이므로 flag 아님 — reason에만 기록.
    fallbackUsed: (physicalSource === 'legacy_parser') || (massR.massG == null) || _degradedSubsonic,
    fallbackReasons,
  };
}
function getArmorThreatClass(ammo) {
  if (!ammo) return 'pistol_fmj';
  const id = (ammo.id || '').toLowerCase();
  const cal = (ammo.caliber || '').toLowerCase();
  const bb = ammo.barrierBehavior || 'normal';
  const pen = ammo.penetration || 0;
  // [0.39.2 Fix4] canonical 아음속 분류 — ID 정규식 오분류 교정 (pdw_light/AP가 subsonic_heavy로 새지 않게)
  const _subCls = getSubsonicClass(ammo);
  // [0.39.3 A-Closure] 아음속탄은 구경만으로 anti_material/high_power_ap가 되지 않는다(§5).
  //   실제 penetration + barrier behavior 기반 threat를 명시적으로 결정. (.338 UCW subsonic ≠ .338 AP threat)
  if (_subCls !== 'none') {
    const _apBeh = _apLikeFromBehavior(bb);
    if (_subCls === 'armor_piercing' || _apBeh) {
      // 아음속 AP — penetration 수준별 penetrator 등급 (anti_material은 실제 대물 관통력일 때만)
      if (pen >= 55) return 'high_power_ap';
      if (pen >= 40) return 'intermediate_penetrator';
      return 'pistol_penetrator';
    }
    // 아음속 heavy/standard/pdw_light — penetration 기반 (구경 무관)
    // [0.39.4] pdw_light은 pdw_penetrator(등록 class)로 — pdw_ball(미등록) 제거. PDW penetrator 성격 보존.
    if (_subCls === 'pdw_light') return 'pdw_penetrator';
    if (_subCls === 'standard') return (pen >= 30) ? 'small_rifle_fmj' : 'pistol_fmj';
    // heavy
    if (pen >= 42) return 'full_power_fmj';
    if (pen >= 30) return 'intermediate_fmj';
    return 'subsonic_heavy';
  }
  // SIDE-AMMO-KINETICS §7: sabot/slap/tungsten_ap 계열을 AP/penetrator로 명시 인식
  const apMark = /sabot|slap|tungsten_ap|sabot_penetrator|sabot_tungsten_ap/.test(bb) || /sabot|slap|tungsten_ap|m948|m903/.test(id);
  if ((ammo.pelletCount || 1) > 1) return /flech/.test(id) ? 'flechette' : 'shotgun_buck';
  if (/12ga|12 ga|20ga/.test(cal)) return 'shotgun_slug';
  if (/12\.7|14\.5|\.50|50bmg/.test(cal) || /^127x|^145x/.test(id)) return 'anti_material';
  if (/frangible/.test(bb) || /frangible|rip\b/.test(id)) return 'frangible';
  const isPistolCal = /9x19|9x18|9x21|45 ?acp|40 ?s&w|357|38 ?spe|10mm|5\.7x28|4\.6x30|22lr/.test(cal) || /^9mm|^45_|^40_|^357|^57x28|^46x30/.test(id);
  const isPDW = /5\.7x28|4\.6x30/.test(cal) || /57x28|46x30/.test(id);
  if (isPistolCal) {
    // [0.39.4] pdw_light은 pdw_penetrator(등록) 유지 — pdw_ball 제거, barrier_blind는 penetrator 아님
    if (_subCls === 'pdw_light') return 'pdw_penetrator';
    if (_subCls !== 'heavy' && /subsonic|147gr_sub/.test(id)) {
      // subsonic ID지만 heavy 미등록(standard/none) — subsonic_heavy 오분류 방지
      if (/penetrator/.test(bb)) return isPDW ? 'pdw_penetrator' : 'pistol_penetrator';
      if (/jhp|hollow|hst|gold_dot|rip/.test(id)) return 'pistol_jhp';
      return 'pistol_fmj';
    }
    if (/subsonic|147gr_sub/.test(id)) return 'subsonic_heavy';
    if (isPDW && /penetrator/.test(bb)) return 'pdw_penetrator';
    if (/penetrator/.test(bb) || /7n21|7n31|_ap\b/.test(id)) return 'pistol_penetrator';
    if (/jhp|hollow|hst|gold_dot|rip/.test(id)) return 'pistol_jhp';
    return 'pistol_fmj';
  }
  // [0.39.2 Fix4] 9x39 계열 — canonical AP 분류 우선 (pab9/bp_7n12가 subsonic_heavy로 새지 않게)
  if (/9x39/.test(cal) || /sp5|sp6/.test(id)) {
    if (_subCls === 'armor_piercing') return 'intermediate_penetrator';
    if (/sp6|ap/.test(id)) return 'intermediate_penetrator';
    return 'subsonic_heavy';   // sp5 등 heavy 아음속
  }
  const isSmall = /5\.56|5\.45|\.223/.test(cal) || /^556|^545|^223/.test(id);
  const isInter = /7\.62x39|300 ?blk/.test(cal) || /762x39|300blk/.test(id);
  const isFull = /7\.62x51|7\.62x54|\.308|\.30-06/.test(cal) || /762x51|762x54|^308/.test(id);
  const isHighAP = /\.338|lapua/.test(cal) || /^338/.test(id);
  const pene = /penetrator/.test(bb) || /m995|m993|7n39|7n24|m855a1|m61|b32|_ap\b|ap_/.test(id) || apMark;   // [0.39.4] barrier_blind 제외 (AP 아님)
  const frag = !pene && /m193|mk262|varmint|frag|sst/.test(id);
  // [0.39.4] barrier-blind 비AP탄은 높은 penetration(chamber pressure)만으로 high_power_ap/penetrator가 되지 않는다.
  const _bBlind = _isBarrierBlindBehavior(bb) && !pene && !apMark;
  if (isSmall) return pene ? 'small_rifle_penetrator' : (frag ? 'small_rifle_fragmenting' : 'small_rifle_fmj');
  if (isInter) return pene ? 'intermediate_penetrator' : 'intermediate_fmj';
  if (isFull) return pene ? 'full_power_penetrator' : 'full_power_fmj';
  if (isHighAP && !_bBlind) return 'high_power_ap';
  if (pen >= 60 && !_bBlind) return 'high_power_ap';
  if (pen >= 42) return (pene && !_bBlind) ? 'full_power_penetrator' : 'full_power_fmj';
  if (pen >= 30) return (pene && !_bBlind) ? 'small_rifle_penetrator' : 'small_rifle_fmj';
  return (pene && !_bBlind) ? 'pistol_penetrator' : 'pistol_fmj';
}
// =============================================================
// SIDE-AMMO-KINETICS §5/§7/§8: kinetic helpers — 거리 감쇠된 실제 충돌속도 + 탄/펠릿당 질량 → 에너지/운동량
// =============================================================
// ════════════════════════════════════════════════════════════════════════════
// [IMPACT-A Phase1] Canonical Impact Trauma Packet — resolveImpact의 실제(원본) kinetics를
//   의료 계층(computeWoundSize)까지 전달하는 단일 packet. AAR용 rounded impactKinetics와 분리 —
//   gameplay/의료 계산은 반드시 이 원본 packet을 읽고, 반올림된 AAR 복사본을 재사용하지 않는다.
//   kinetics 없으면 kineticFallback=true로 표시 → 소비자가 legacy 경로 사용 + AAR/debug 구분 가능.
// ════════════════════════════════════════════════════════════════════════════
function computeProjectileKinetics(ammo, impactVelocityMps, initialVelocityMps) {
  const massG = (ammo && ammo.projectileMassG != null) ? ammo.projectileMassG
              : (ammo && ammo.projectile && ammo.projectile.massG != null ? ammo.projectile.massG : null);
  const projectileCount = (ammo && ammo.pelletCount) || 1;
  const massBasis = projectileCount > 1 ? 'per_projectile' : 'single_projectile';
  const iv0 = Math.max(0, impactVelocityMps || 0);
  const nv0 = Math.max(1, initialVelocityMps || iv0 || 1);
  if (massG == null || !(massG > 0)) {
    return { hasKinetics:false, massG:null, massKg:null, projectileCount, massBasis,
             impactVelocityMps:iv0, initialVelocityMps:nv0,
             velocityRatio: Math.max(0, Math.min(1.2, iv0 / nv0)),
             impactEnergyJ:null, initialEnergyJ:null, energyRatio:null,
             impactMomentumNs:null, initialMomentumNs:null, momentumRatio:null,
             totalImpactEnergyJ:null, totalImpactMomentumNs:null };
  }
  const massKg = massG / 1000;
  const impactEnergyJ = 0.5 * massKg * iv0 * iv0;
  const initialEnergyJ = 0.5 * massKg * nv0 * nv0;
  const impactMomentumNs = massKg * iv0;
  const initialMomentumNs = massKg * nv0;
  return {
    hasKinetics:true, massG, massKg, projectileCount, massBasis,
    impactVelocityMps:iv0, initialVelocityMps:nv0,
    velocityRatio: nv0 > 0 ? iv0 / nv0 : 1,
    impactEnergyJ: +impactEnergyJ.toFixed(2), initialEnergyJ: +initialEnergyJ.toFixed(2),
    energyRatio: initialEnergyJ > 0 ? +(impactEnergyJ / initialEnergyJ).toFixed(4) : 1,
    impactMomentumNs: +impactMomentumNs.toFixed(3), initialMomentumNs: +initialMomentumNs.toFixed(3),
    momentumRatio: initialMomentumNs > 0 ? +(impactMomentumNs / initialMomentumNs).toFixed(4) : 1,
    totalImpactEnergyJ: +(impactEnergyJ * projectileCount).toFixed(2),
    totalImpactMomentumNs: +(impactMomentumNs * projectileCount).toFixed(3),
  };
}
// §7: kinetic 관통 보정 — penetration이 주인, 이건 "현재 충돌조건에서 발현도". point-blank≈1.0, 거리 감쇠 시 하락. 절대에너지로 저속중량탄 관통 부풀리지 않음.
function resolveKineticPenetrationMul(ammo, kin) {
  if (!kin || !kin.hasKinetics) {
    const vr = Math.max(0.1, Math.min(1.0, (kin && kin.velocityRatio) || 1));
    return +(0.55 + 0.45 * vr).toFixed(4);   // fallback: 기존 선형 공식
  }
  const tc = getArmorThreatClass(ammo);
  const er = Math.max(0, Math.min(1.2, kin.energyRatio));
  const vr = Math.max(0, Math.min(1.2, kin.velocityRatio));
  let lo, hi, blend, sens;
  if (/penetrator|high_power_ap|anti_material/.test(tc)) { lo=0.82; hi=1.16; blend=0.60*vr+0.40*er; sens=0.65; }  // 고속관통자 velocity 가중
  else if (/fmj|ball/.test(tc))                          { lo=0.88; hi=1.10; blend=0.45*vr+0.55*er; sens=0.55; }
  else if (/frag|jhp|expand|frangible/.test(tc))         { lo=0.92; hi=1.06; blend=0.40*vr+0.60*er; sens=0.45; }
  else if (/slug|subsonic_heavy/.test(tc))               { lo=0.95; hi=1.04; blend=0.50*vr+0.50*er; sens=0.30; }  // slug 관통 상승 억제
  else if (tc === 'shotgun_buck')                        { lo=0.90; hi=1.05; blend=0.50*vr+0.50*er; sens=0.40; }
  else if (tc === 'flechette')                           { lo=0.88; hi=1.10; blend=0.50*vr+0.50*er; sens=0.50; }
  else                                                   { lo=0.88; hi=1.10; blend=0.50*vr+0.50*er; sens=0.50; }
  let mul = 1.0 + sens * (blend - 1.0);   // point-blank(blend≈1) → ≈1.0
  return +Math.max(lo, Math.min(hi, mul)).toFixed(4);
}
// §8: kinetic 피해 보정 — damage가 주인, 약한 보정. terminalEffect와 중복 과보정 금지. point-blank≈1.0.
const ARMOR_MATERIAL_THREAT_RESPONSE = {
  ceramic:  { pistol_fmj:0.15, pistol_jhp:0.10, pistol_penetrator:0.35, pdw_penetrator:0.55, small_rifle_fmj:0.95, small_rifle_fragmenting:0.90, small_rifle_penetrator:1.25, intermediate_fmj:1.05, intermediate_penetrator:1.35, full_power_fmj:1.35, full_power_penetrator:1.65, high_power_ap:2.00, shotgun_slug:1.10, shotgun_buck:0.12, flechette:0.45, frangible:0.12, subsonic_heavy:0.20, anti_material:2.60 },
  steel:    { pistol_fmj:0.06, pistol_jhp:0.05, pistol_penetrator:0.18, pdw_penetrator:0.32, small_rifle_fmj:0.55, small_rifle_fragmenting:0.40, small_rifle_penetrator:0.85, intermediate_fmj:0.65, intermediate_penetrator:1.00, full_power_fmj:0.90, full_power_penetrator:1.25, high_power_ap:1.50, shotgun_slug:0.75, shotgun_buck:0.06, flechette:0.28, frangible:0.05, subsonic_heavy:0.25, anti_material:2.10 },
  titanium: { pistol_fmj:0.08, pistol_jhp:0.06, pistol_penetrator:0.18, pdw_penetrator:0.30, small_rifle_fmj:0.45, small_rifle_fragmenting:0.36, small_rifle_penetrator:0.75, intermediate_fmj:0.55, intermediate_penetrator:0.90, full_power_fmj:0.80, full_power_penetrator:1.15, high_power_ap:1.50, shotgun_slug:0.50, shotgun_buck:0.06, flechette:0.30, frangible:0.06, subsonic_heavy:0.20, anti_material:2.15 },
  pe:       { pistol_fmj:0.22, pistol_jhp:0.18, pistol_penetrator:0.35, pdw_penetrator:0.55, small_rifle_fmj:0.75, small_rifle_fragmenting:0.70, small_rifle_penetrator:1.05, intermediate_fmj:0.85, intermediate_penetrator:1.25, full_power_fmj:1.10, full_power_penetrator:1.45, high_power_ap:1.75, shotgun_slug:0.90, shotgun_buck:0.18, flechette:0.65, frangible:0.15, subsonic_heavy:0.35, anti_material:2.25 },
  aramid:   { pistol_fmj:0.75, pistol_jhp:0.85, pistol_penetrator:1.05, pdw_penetrator:1.20, small_rifle_fmj:1.25, small_rifle_fragmenting:1.35, small_rifle_penetrator:1.45, intermediate_fmj:1.35, intermediate_penetrator:1.60, full_power_fmj:1.55, full_power_penetrator:1.80, high_power_ap:2.00, shotgun_slug:1.25, shotgun_buck:0.55, flechette:1.00, frangible:0.45, subsonic_heavy:0.75, anti_material:2.20 },
  glass:    { pistol_fmj:1.05, pistol_jhp:1.15, pistol_penetrator:1.35, pdw_penetrator:1.45, small_rifle_fmj:1.55, small_rifle_fragmenting:1.65, small_rifle_penetrator:1.80, intermediate_fmj:1.65, intermediate_penetrator:1.90, full_power_fmj:2.00, full_power_penetrator:2.20, high_power_ap:2.40, shotgun_slug:1.80, shotgun_buck:0.75, flechette:1.35, frangible:0.65, subsonic_heavy:0.90, anti_material:2.80 },
  aluminum: { pistol_fmj:0.65, pistol_jhp:0.70, pistol_penetrator:0.95, pdw_penetrator:1.05, small_rifle_fmj:1.25, small_rifle_fragmenting:1.30, small_rifle_penetrator:1.50, intermediate_fmj:1.35, intermediate_penetrator:1.65, full_power_fmj:1.70, full_power_penetrator:2.00, high_power_ap:2.20, shotgun_slug:1.45, shotgun_buck:0.45, flechette:1.10, frangible:0.35, subsonic_heavy:0.70, anti_material:2.60 },
  composite:{ pistol_fmj:0.20, pistol_jhp:0.18, pistol_penetrator:0.40, pdw_penetrator:0.60, small_rifle_fmj:0.90, small_rifle_fragmenting:0.85, small_rifle_penetrator:1.15, intermediate_fmj:1.00, intermediate_penetrator:1.30, full_power_fmj:1.25, full_power_penetrator:1.55, high_power_ap:1.85, shotgun_slug:1.00, shotgun_buck:0.15, flechette:0.55, frangible:0.12, subsonic_heavy:0.28, anti_material:2.35 },
  fabric:   { pistol_fmj:0.35, pistol_jhp:0.40, pistol_penetrator:0.50, pdw_penetrator:0.60, small_rifle_fmj:0.80, small_rifle_fragmenting:0.90, small_rifle_penetrator:0.95, intermediate_fmj:0.90, intermediate_penetrator:1.05, full_power_fmj:1.10, full_power_penetrator:1.25, high_power_ap:1.40, shotgun_slug:0.90, shotgun_buck:0.45, flechette:0.80, frangible:0.35, subsonic_heavy:0.45, anti_material:1.60 },
};
function getAmmoArmorWearBase(ammo) {
  if (!ammo) return 0;
  const pct = (ammo.armorDamagePct != null) ? ammo.armorDamagePct : 25;
  return (ammo.damage || 30) * (pct / 100);
}
function getArmorMaterialThreatResponse(material, ammo, layerType) {
  const tbl = ARMOR_MATERIAL_THREAT_RESPONSE[material] || ARMOR_MATERIAL_THREAT_RESPONSE.composite;
  const tc = getArmorThreatClass(ammo);
  return { threatClass: tc, response: (tbl[tc] != null ? tbl[tc] : 0.6) };
}
// §14 관통압 계단 + near-overmatch (shotPenOverride: rear 등 잔여 관통력 전달용)
function getPenetrationPressureFactor(ammo, baseArmor, effectiveArmor, protection, penetrated, shotPenOverride) {
  const shotPen = (shotPenOverride != null) ? shotPenOverride
    : ((ammo && ammo.penetration) || 0) * ((ammo && ammo.barrierPenMul) || 1.0);
  const ref = Math.max(1, (effectiveArmor != null ? effectiveArmor : baseArmor) || 1);
  const r = shotPen / ref;
  let f;
  if (r < 0.25) f = 0.12;
  else if (r < 0.45) f = 0.25;
  else if (r < 0.70) f = 0.55;
  else if (r < 0.90) f = 0.85;
  else if (r < 1.10) f = 1.35;       // near-overmatch
  else if (r < 1.35) f = 1.65;
  else f = Math.min(2.30, 1.90 + (r - 1.35) * 0.3);
  if (penetrated) f = Math.max(f, 1.45);
  return { factor: f, pressureRatio: r, nearOvermatch: (!penetrated && r >= 0.90) };
}
// §15 결과별 배율
function getArmorHitResultFactor(resultKind, material, layerType) {
  if (resultKind === 'penetrated') {
    // SIDE-ARMOR-PENETRATION-LOCALITY §4: 관통 resultFactor 하향 (global 폭증 방지 — 관통은 local 중심)
    return ({ ceramic:1.55, glass:1.60, aramid:1.40, pe:1.45, aluminum:1.55, composite:1.50, steel:1.35, titanium:1.35, fabric:1.50 })[material] || 1.45;
  }
  if (resultKind === 'partial_or_backer_stopped') return 1.55;
  if (resultKind === 'ricochet') {
    return ({ steel:0.25, titanium:0.30, ceramic:0.70, glass:0.90 })[material] || 0.45;
  }
  // stopped
  if (/soft/.test(layerType || '')) {
    return ({ aramid:1.10, pe:0.95, fabric:0.40 })[material] || 0.90;
  }
  return ({ ceramic:1.10, glass:1.20, steel:0.62, titanium:0.62, pe:0.80, aramid:1.00, aluminum:0.95, composite:0.95 })[material] || 0.95;
}
// §16 속도 보정 (없으면 1.0)
function getArmorVelocityFactor(ammo, impactVelocity, initialVelocity) {
  if (!impactVelocity || !initialVelocity) return 1.0;
  const vr = Math.max(0, Math.min(1.2, impactVelocity / initialVelocity));
  let f = 0.85 + 0.30 * vr;
  const tc = getArmorThreatClass(ammo);
  if (/penetrator|high_power_ap|anti_material/.test(tc)) f = Math.max(1.0, f);
  if (tc === 'shotgun_buck') f *= 0.85;
  return f;
}
// §13 local zone — impactAddress.subZone → zone 키
const ARMOR_LOCAL_SEVERITY = { ceramic:0.75, glass:0.85, pe:0.45, aramid:0.48, steel:0.30, titanium:0.28, aluminum:0.62, composite:0.52, fabric:0.2 };
const ARMOR_LOCAL_MIN_MUL  = { ceramic:0.15, glass:0.05, pe:0.20, aramid:0.20, steel:0.45, titanium:0.40, aluminum:0.15, composite:0.20, fabric:0.6 };
// SIDE-AMMO-KINETICS §10: 재질별 손상 양상 보조 프로파일 (튜닝 계수 — 공학 물성치 아님). 기존 MATERIAL_PROPS/THREAT_RESPONSE/LOCAL_SEVERITY를 대체하지 않음.
const ARMOR_MATERIAL_DAMAGE_PROFILE = {
  steel:    { localSusceptibility:0.78, globalSusceptibility:0.22, residualLocalStrength:0.62, crackPropagation:0.04, plasticDeformation:0.95, perforationSensitivity:0.82, delamination:0.00, fiberFailure:0.00, spallFragmentRisk:0.78, backfaceDeformation:0.75, neighborDamageTransfer:0.05, multiHitVulnerability:0.62, edgeWeakness:0.30, notes:'강철은 전체가 쉽게 깨지는 재질이 아니라 국부 관통구/gouge/crater/dent/spall 중심.' },
  titanium: { localSusceptibility:0.65, globalSusceptibility:0.24, residualLocalStrength:0.68, crackPropagation:0.07, plasticDeformation:0.58, perforationSensitivity:0.75, delamination:0.00, fiberFailure:0.00, spallFragmentRisk:0.42, backfaceDeformation:0.58, neighborDamageTransfer:0.04, multiHitVulnerability:0.52, edgeWeakness:0.22, notes:'티타늄은 steel보다 spall/전체손상 낮고 국부 gouge/perforation 중심.' },
  aluminum: { localSusceptibility:0.95, globalSusceptibility:0.48, residualLocalStrength:0.40, crackPropagation:0.12, plasticDeformation:1.12, perforationSensitivity:0.88, delamination:0.00, fiberFailure:0.00, spallFragmentRisk:0.28, backfaceDeformation:1.05, neighborDamageTransfer:0.10, multiHitVulnerability:0.78, edgeWeakness:0.42, notes:'알루미늄은 dent/tearing/panel warp가 크고 반복피격 취약.' },
  ceramic:  { localSusceptibility:1.20, globalSusceptibility:0.65, residualLocalStrength:0.18, crackPropagation:1.00, plasticDeformation:0.05, perforationSensitivity:0.95, delamination:0.20, fiberFailure:0.00, spallFragmentRisk:0.68, backfaceDeformation:0.95, neighborDamageTransfer:0.40, multiHitVulnerability:1.10, edgeWeakness:0.70, notes:'세라믹은 파쇄/균열 전파. 관통은 전체 내구도보다 맞은 자리·주변 타일 파괴 중심(국부 재앙). 같은 부위 반복피격에 매우 취약.' },
  glass:    { localSusceptibility:1.08, globalSusceptibility:1.05, residualLocalStrength:0.12, crackPropagation:1.35, plasticDeformation:0.03, perforationSensitivity:0.78, delamination:0.95, fiberFailure:0.00, spallFragmentRisk:0.74, backfaceDeformation:0.85, neighborDamageTransfer:0.44, multiHitVulnerability:1.05, edgeWeakness:0.85, notes:'방탄유리/바이저는 spiderweb crack/laminate split/시야손상/edge crack 핵심.' },
  composite:{ localSusceptibility:0.82, globalSusceptibility:0.60, residualLocalStrength:0.34, crackPropagation:0.38, plasticDeformation:0.42, perforationSensitivity:0.72, delamination:0.92, fiberFailure:0.38, spallFragmentRisk:0.25, backfaceDeformation:0.78, neighborDamageTransfer:0.20, multiHitVulnerability:0.72, edgeWeakness:0.40, notes:'복합재는 층간박리/matrix cracking/local crush/구조피로 중요.' },
  pe:       { localSusceptibility:0.74, globalSusceptibility:0.52, residualLocalStrength:0.36, crackPropagation:0.08, plasticDeformation:0.82, perforationSensitivity:0.52, delamination:0.78, fiberFailure:0.58, spallFragmentRisk:0.05, backfaceDeformation:0.95, neighborDamageTransfer:0.16, multiHitVulnerability:0.62, edgeWeakness:0.35, notes:'UHMWPE는 압축/열·마찰/층간변형/후면변형 핵심. 깨짐 아님.' },
  aramid:   { localSusceptibility:0.86, globalSusceptibility:0.42, residualLocalStrength:0.26, crackPropagation:0.00, plasticDeformation:0.36, perforationSensitivity:0.28, delamination:0.35, fiberFailure:1.15, spallFragmentRisk:0.00, backfaceDeformation:1.18, neighborDamageTransfer:0.14, multiHitVulnerability:0.86, edgeWeakness:0.30, notes:'아라미드는 섬유 절단/늘어남/직조 벌어짐/후면변형·둔상 전달 중심. 하드플레이트 아님.' },
  fabric:   { localSusceptibility:0.35, globalSusceptibility:0.12, residualLocalStrength:0.10, crackPropagation:0.00, plasticDeformation:0.05, perforationSensitivity:0.15, delamination:0.05, fiberFailure:0.40, spallFragmentRisk:0.00, backfaceDeformation:1.00, neighborDamageTransfer:0.04, multiHitVulnerability:0.30, edgeWeakness:0.10, notes:'fabric은 실질 방탄재 아님. 외피 손상/찢김 표시용.' },
};
function getArmorMaterialDamageProfile(material) {
  return ARMOR_MATERIAL_DAMAGE_PROFILE[material] || ARMOR_MATERIAL_DAMAGE_PROFILE.composite;
}
function _ensureLocalZones(d) {
  if (!d.localZones) d.localZones = { center:0, edge:0, upper:0, lower:0, side:0, glass:0, frame:0, unknown:0 };
  return d.localZones;
}
// SIDE-AMMO-KINETICS §18: localZone 인접 관계 (neighborSplash 분산 대상)
const ARMOR_ZONE_NEIGHBORS = {
  center: ['upper', 'lower', 'side', 'edge'], upper: ['center', 'edge'], lower: ['center', 'edge'],
  side: ['center', 'edge'], edge: ['center'], glass: ['frame', 'edge'], frame: ['glass', 'edge'], unknown: [],
};
function applyArmorLocalZoneDamage(target, slotKey, zone, amount) {
  if (!target || !target.armorDurability || !slotKey || !zone) return;
  const d = target.armorDurability[slotKey];
  if (!d) return;
  const z = _ensureLocalZones(d);
  z[zone] = Math.min(100, (z[zone] || 0) + amount);
}
function getArmorLocalZoneMul(target, slotKey, zone) {
  if (!target || !target.armorDurability || !slotKey) return 1.0;
  const d = target.armorDurability[slotKey];
  if (!d || !d.localZones) return 1.0;
  const mat = d.durabilityMaterial || d.material || 'composite';
  const sev = ARMOR_LOCAL_SEVERITY[mat] != null ? ARMOR_LOCAL_SEVERITY[mat] : 0.5;
  const mn = ARMOR_LOCAL_MIN_MUL[mat] != null ? ARMOR_LOCAL_MIN_MUL[mat] : 0.2;
  const lr = Math.max(0, Math.min(1, (d.localZones[zone || 'unknown'] || 0) / 100));
  // SIDE-AMMO-KINETICS §17: residualLocalStrength 반영 — 높을수록(steel) 손상 누적에도 방호 유지, 낮을수록(ceramic/glass) 급락
  const prof = (typeof getArmorMaterialDamageProfile === 'function') ? getArmorMaterialDamageProfile(mat) : null;
  const resid = (prof && prof.residualLocalStrength != null) ? prof.residualLocalStrength : 0.4;
  const effSev = sev * (1.3 - 0.6 * resid);
  const floor = Math.max(0.03, mn * (0.5 + resid));
  return Math.max(floor, 1 - effSev * lr);
}
// SIDE-AMMO-KINETICS §23: damageMode 한국어 라벨
const ARMOR_DAMAGE_MODE_LABEL_KO = {
  steel_surface_scuff:'강철 표면 손상', steel_coating_damage:'강철 스폴 코팅 손상', steel_crater:'강철 탄착 크레이터', steel_gouge:'강철 국부 홈', steel_deep_dent:'강철판 깊은 찌그러짐', steel_backface_bulge:'강철판 후면 벌지', steel_plugged_hole:'강철판 국부 관통구', steel_perforation:'강철판 관통', steel_spall_risk:'강철 스폴 위험 증가', steel_edge_deformation:'강철 가장자리 변형', steel_structural_failure:'강철판 구조 파손',
  titanium_scuff:'티타늄 표면 손상', titanium_gouge:'티타늄 국부 홈', titanium_shallow_dent:'티타늄 얕은 변형', titanium_perforation:'티타늄 관통', titanium_edge_crack:'티타늄 가장자리 균열',
  aluminum_dent:'알루미늄 변형', aluminum_deep_dent:'알루미늄 깊은 변형', aluminum_tearing:'알루미늄 찢김', aluminum_panel_warp:'알루미늄 패널 뒤틀림', aluminum_perforation:'알루미늄 관통', aluminum_gouge:'알루미늄 국부 홈',
  ceramic_chip:'세라믹 치핑', ceramic_surface_crack:'세라믹 표면 균열', ceramic_radial_crack:'세라믹 방사형 균열', ceramic_cone_fracture:'세라믹 콘 균열', ceramic_tile_crush:'세라믹 타일 압쇄', ceramic_tile_shatter:'세라믹 타일 파쇄', ceramic_core_punch:'세라믹 코어 펀치 손상', ceramic_perforation:'세라믹 관통', ceramic_tile_crack:'세라믹 타일 균열',
  glass_scuff:'방탄유리 표면 손상', glass_spiderweb:'방탄유리 거미줄 균열', glass_radial_crack:'방탄유리 방사형 균열', glass_laminate_split:'방탄유리 적층 벌어짐', glass_bulge:'방탄유리 후면 팽창', glass_perforation:'방탄유리 관통', visor_frame_deformation:'바이저 프레임 변형',
  composite_scuff:'복합재 표면 손상', composite_local_crush:'복합재 국부 압괴', composite_matrix_crack:'복합재 매트릭스 균열', composite_delamination:'복합재 층간박리', composite_backface_bulge:'복합재 후면 변형', composite_perforation:'복합재 관통', composite_structural_fatigue:'복합재 구조 피로',
  pe_compression:'PE 압축 손상', pe_friction_scarring:'PE 마찰 손상', pe_heat_scarring:'PE 열 손상', pe_backface_bulge:'PE 후면 변형', pe_delamination:'PE 층간 변형', pe_penetrator_channel:'PE 관통자 채널', pe_perforation:'PE 관통',
  aramid_fiber_stretch:'아라미드 섬유 늘어남', aramid_fiber_cut:'아라미드 섬유 절단', aramid_weave_spread:'아라미드 직조 벌어짐', aramid_panel_deformation:'아라미드 패널 변형', aramid_backface_deformation:'아라미드 후면 변형', aramid_perforation:'아라미드 관통',
  fabric_scuff:'외피 표면 손상', fabric_tear:'외피 찢김', fabric_puncture:'외피 구멍',
};
// §9: kinetic 기반 방어구 마모 계수 (기존 getArmorVelocityFactor 형태 유지 — vr→energyRatio. point-blank≈1.15)
function getArmorKineticWearFactor(ammo, kin, threatClass, material, layerType) {
  if (!kin || !kin.hasKinetics) return getArmorVelocityFactor(ammo, kin && kin.impactVelocityMps, kin && kin.initialVelocityMps);
  const er = Math.max(0, Math.min(1.2, kin.energyRatio));
  let f = 0.85 + 0.30 * er;
  const tc = threatClass || getArmorThreatClass(ammo);
  if (/penetrator|high_power_ap|anti_material/.test(tc)) f = Math.max(1.0, f);
  if (tc === 'shotgun_buck') f *= 0.85;
  if (tc === 'flechette') f *= 0.80;
  if (/slug|subsonic_heavy/.test(tc)) f *= 1.08;   // momentum 둔상/dent 소폭 가산
  return +Math.max(0.5, Math.min(1.6, f)).toFixed(3);
}
// §15: local/global 분배 — 재질 global 성향 + 탄종 방향
function resolveArmorDamageDistribution(ammo, material, threatClass, kin, ctx) {
  const prof = getArmorMaterialDamageProfile(material);
  const tc = threatClass || getArmorThreatClass(ammo);
  const brittle = (material === 'ceramic' || material === 'glass');
  const isAP = /penetrator|high_power_ap|anti_material/.test(tc);
  const isBuck = tc === 'shotgun_buck', isFlech = tc === 'flechette', isSlug = /slug/.test(tc), isFMJ = /fmj|ball/.test(tc);
  let globalShare = Math.max(0.08, Math.min(0.92, prof.globalSusceptibility));
  let localFocus = 1.0, globalFocus = 1.0;
  if (isAP) { localFocus = 1.45; globalFocus = brittle ? 1.15 : 0.55; globalShare = brittle ? Math.min(0.85, globalShare) : Math.min(0.32, globalShare * 0.6); }
  else if (isBuck) { localFocus = 0.7; globalFocus = 0.45; globalShare = Math.min(globalShare, 0.30); }
  else if (isFlech) { localFocus = 0.85; globalFocus = 0.40; globalShare = Math.min(globalShare, 0.28); }
  else if (isSlug) { localFocus = 1.0; globalFocus = 1.15; globalShare = Math.min(0.78, globalShare * 1.15); }
  else if (isFMJ) { localFocus = 1.0; globalFocus = 1.0; }
  // SIDE-ARMOR-PENETRATION-LOCALITY §6: 관통 시 global 비중 축소 (local 중심 — 이미 낮으면 유지)
  const _penetrated = !!(ctx && ctx.penetrated) || (ctx && ctx.armorResult === 'penetrated');
  if (_penetrated) {
    const penGlobal = ({ ceramic:0.30, glass:0.40, steel:0.20, titanium:0.17, composite:0.32, pe:0.32, aramid:0.25, aluminum:0.32 })[material];
    if (penGlobal != null) globalShare = Math.min(globalShare, penGlobal);
  }
  const localShare = Math.max(0.08, Math.min(0.95, 1 - globalShare * 0.5));   // local은 항상 의미있게 (global과 독립 누적)
  const er = kin && kin.hasKinetics ? Math.max(0, Math.min(1.2, kin.energyRatio)) : 1;
  const mr = kin && kin.hasKinetics ? Math.max(0, Math.min(1.2, kin.momentumRatio)) : 1;
  return {
    localShare:+localShare.toFixed(3), globalShare:+globalShare.toFixed(3),
    localFocus:+localFocus.toFixed(3), globalFocus:+globalFocus.toFixed(3),
    energyLocalMul:+(0.85 + 0.30 * er).toFixed(3), energyGlobalMul:+(0.80 + 0.35 * er).toFixed(3),
    momentumGlobalMul: isSlug ? +(0.90 + 0.30 * mr).toFixed(3) : 1.0,
  };
}
// §14: 재질별 damageState 해석 (결과 해석층 — 관통 판정을 바꾸지 않음)
function resolveMaterialArmorDamageState(ctx, di) {
  const material = ctx.material, tc = ctx.threatClass;
  const pen = !!ctx.penetrated, stopped = !pen, nearOM = !!ctx.nearOvermatch, ricochet = ctx.ricochet || (ctx.armorResult === 'ricochet');
  const isAP = /penetrator|high_power_ap|anti_material/.test(tc), isBuck = tc === 'shotgun_buck', isFlech = tc === 'flechette', isSlug = /slug/.test(tc), isFMJ = /fmj|ball/.test(tc);
  const eJ = ctx.impactEnergyJ || 0, mNs = ctx.impactMomentumNs || 0;
  const edge = ctx.localZone === 'edge' || ctx.edgeHit;
  const prof = getArmorMaterialDamageProfile(material);
  const gA = (di && di.globalAmount) || 0, lA = (di && di.localAmount) || 0;
  let damageKind = 'surface_damage', damageMode = material + '_scuff', tags = [];
  let spallRiskDelta = 0, coatingDamageDelta = 0, neighborSplashAmount = 0, visibilityDamageDelta = 0, backfaceDeformationHint = 0;
  let residualStrengthHint = prof.residualLocalStrength;
  const spl = (a, b) => lA * (a + Math.random() * (b - a));
  switch (material) {
    case 'steel':
      damageKind = 'metal_deformation';
      if (pen) { damageMode = isAP ? 'steel_perforation' : 'steel_plugged_hole'; damageKind = 'metal_perforation'; }
      else if (isAP) damageMode = 'steel_gouge';
      else if (isSlug) damageMode = mNs > 8 ? 'steel_backface_bulge' : 'steel_deep_dent';
      else if (isFMJ && nearOM) damageMode = 'steel_crater';
      else if (isFMJ) damageMode = 'steel_deep_dent';
      else if (eJ < 200) damageMode = 'steel_surface_scuff';
      else damageMode = 'steel_crater';
      if (edge && mNs > 10) { damageMode = 'steel_edge_deformation'; tags.push('edge_hit'); }
      if ((stopped || ricochet) && (eJ > 400 || nearOM) && (isAP || isFMJ)) { spallRiskDelta = nearOM ? 0.06 : 0.03; coatingDamageDelta = gA * 1.5; tags.push('spall_risk'); }
      break;
    case 'titanium':
      damageKind = 'metal_deformation';
      if (pen) { damageMode = 'titanium_perforation'; damageKind = 'metal_perforation'; }
      else if (isAP) damageMode = 'titanium_gouge';
      else if (isSlug || isFMJ) damageMode = 'titanium_shallow_dent';
      else if (edge) damageMode = 'titanium_edge_crack';
      else damageMode = 'titanium_scuff';
      if ((stopped || ricochet) && (eJ > 400 || nearOM) && (isAP || isFMJ)) { spallRiskDelta = nearOM ? 0.03 : 0.015; coatingDamageDelta = gA * 1.2; tags.push('spall_risk'); }
      break;
    case 'aluminum':
      damageKind = 'metal_deformation';
      if (pen) { damageMode = isAP ? 'aluminum_perforation' : 'aluminum_tearing'; damageKind = 'metal_perforation'; }
      else if (isSlug) damageMode = 'aluminum_panel_warp';
      else if (isAP) damageMode = nearOM ? 'aluminum_tearing' : 'aluminum_gouge';   // §9.3: stopped AP는 perforation 아님
      else if (isFMJ) damageMode = 'aluminum_deep_dent';
      else damageMode = 'aluminum_dent';
      break;
    case 'ceramic':
      damageKind = pen ? 'brittle_shatter' : 'brittle_crack';
      if (pen && isAP) damageMode = 'ceramic_core_punch';
      else if (pen) damageMode = 'ceramic_perforation';
      else if (isAP) damageMode = 'ceramic_tile_shatter';
      else if (isSlug) damageMode = 'ceramic_radial_crack';
      else if (isFMJ && nearOM) damageMode = 'ceramic_cone_fracture';
      else if (isFMJ) damageMode = 'ceramic_radial_crack';
      else if (isBuck || isFlech) damageMode = 'ceramic_chip';
      else damageMode = 'ceramic_surface_crack';
      neighborSplashAmount = (isBuck || isFlech) ? spl(0.0, 0.03) : spl(0.05, 0.25) * (isSlug ? 1.1 : 1.0);
      tags.push('multi_hit_vulnerable');
      break;
    case 'glass':
      damageKind = 'glass_crack';
      if (pen) damageMode = 'glass_perforation';
      else if (edge) damageMode = 'glass_radial_crack';
      else if (isSlug || (isFMJ && nearOM)) damageMode = 'glass_bulge';
      else if (eJ < 150) damageMode = 'glass_scuff';
      else damageMode = 'glass_spiderweb';
      if (ctx.frameHit || edge) damageMode = pen ? 'visor_frame_deformation' : 'glass_laminate_split';
      visibilityDamageDelta = gA * (edge ? 1.5 : 1.0) + lA * 0.3;
      neighborSplashAmount = spl(0.10, 0.35);
      tags.push('visibility_loss');
      break;
    case 'composite':
      damageKind = 'delamination';
      if (pen) damageMode = 'composite_perforation';
      else if (isAP) damageMode = 'composite_perforation';
      else if (isSlug) { damageMode = 'composite_backface_bulge'; backfaceDeformationHint = mNs * 0.8; }
      else if (isFMJ) damageMode = 'composite_local_crush';
      else damageMode = 'composite_matrix_crack';
      neighborSplashAmount = spl(0.03, 0.12);
      break;
    case 'pe':
      damageKind = 'backface_deformation';
      if (pen) damageMode = 'pe_perforation';
      else if (isAP) damageMode = 'pe_penetrator_channel';
      else if (isSlug) { damageMode = 'pe_backface_bulge'; backfaceDeformationHint = mNs * 0.9; }
      else damageMode = 'pe_compression';
      neighborSplashAmount = spl(0.01, 0.08);
      break;
    case 'aramid':
      damageKind = 'fiber_failure';
      if (pen) damageMode = 'aramid_perforation';
      else if (isFlech) damageMode = 'aramid_fiber_cut';
      else if (isBuck) damageMode = 'aramid_weave_spread';
      else if (isSlug) { damageMode = 'aramid_backface_deformation'; backfaceDeformationHint = mNs * 1.0; }
      else if (/pistol/.test(tc)) { damageMode = 'aramid_backface_deformation'; backfaceDeformationHint = mNs * 0.7; }
      else damageMode = 'aramid_fiber_stretch';
      if (isBuck || isFlech) neighborSplashAmount = spl(0.01, 0.06);
      tags.push('fiber_weakening');
      break;
    case 'fabric':
      damageKind = 'fabric_damage';
      damageMode = pen ? 'fabric_puncture' : (eJ > 200 ? 'fabric_tear' : 'fabric_scuff');
      break;
  }
  if (backfaceDeformationHint === 0 && stopped && (isSlug || /full_power/.test(tc)) && (material === 'aramid' || material === 'pe' || material === 'composite' || material === 'glass')) backfaceDeformationHint = mNs * 0.6;
  if (lA > 0 && residualStrengthHint < 0.5) tags.push('local_weakening');
  return { damageKind, damageMode, stateTags: tags, spallRiskDelta: +spallRiskDelta.toFixed(3), coatingDamageDelta: +coatingDamageDelta.toFixed(2), neighborSplashAmount: +neighborSplashAmount.toFixed(2), visibilityDamageDelta: +visibilityDamageDelta.toFixed(2), backfaceDeformationHint: +backfaceDeformationHint.toFixed(2), residualStrengthHint, aarLabel: ARMOR_DAMAGE_MODE_LABEL_KO[damageMode] || damageMode };
}

// §4 공통 손상 계산 — 실제 전투 / 후면 방호 / Armor Analysis가 모두 이 함수를 사용
const ARMOR_WEAR_TUNING_SCALE = 0.25;
// ============================================================
// SIDE-ARMOR-PENETRATION-LOCALITY-1: 관통 손상 국부화 + global cap + 탄종 위력 차등
// ============================================================
// [추가지시] 탄종 위력 차등 — local 계열 출력 배율 (global은 cap으로 통제하되 local/neighbor/backface/spall/coating/visibility는 큰 탄이 더 받음)
function getAmmoLocalSeverity(threatClass) {
  const T = {
    pistol_fmj:0.70, pistol_jhp:0.70, pistol_penetrator:0.85, pdw_penetrator:1.05,
    subsonic_heavy:0.90, frangible:0.65, shotgun_buck:0.60, flechette:0.60,
    small_rifle_fmj:1.00, small_rifle_fragmenting:1.00, small_rifle_penetrator:1.35,
    intermediate_fmj:1.15, intermediate_penetrator:1.40,
    full_power_fmj:1.35, full_power_penetrator:1.60,
    shotgun_slug:1.45, high_power_ap:1.85, anti_material:2.05,
  };
  return T[threatClass] != null ? T[threatClass] : 1.0;
}
// §3/§8/§10: 관통 시 global↓ local↑ (맞은 자리 국부 재앙). info를 직접 보정 (관통 판정·damageMode 불변)
function applyPenetrationLocalityRebalance(info, ctx, material) {
  info.globalAmount *= 0.70;   // §10 관통 global 완화 (핵심 lever)
  // §8.1 재질별 local boost — 관통경로는 rf/localShare가 이미 local을 높이므로 boost는 보수적으로
  const boost = ({ ceramic:1.20, glass:1.20, steel:1.20, titanium:1.20, composite:1.18, pe:1.18, aramid:1.18, aluminum:1.20 })[material] || 1.15;
  info.localAmount *= boost;
  info.penetrationLocalityRebalance = true;
  info.localBoostApplied = true;
}
// §7/§8.2 + [추가지시] global cap(재질·결과·maxDur 비율) + local cap(재질·결과·탄종 severity)
function applyArmorGlobalDamageCaps(info, ctx, d, material, resultKind, threatClass, kin) {
  const maxDur = (d && d.max) || ctx.capMaxDurability || 50;
  const isAP = /high_power_ap|anti_material/.test(threatClass || '');
  const pen = (resultKind === 'penetrated'), partial = (resultKind === 'partial_or_backer_stopped');
  // global cap 비율 (§7.2)
  const GC = {
    ceramic:  { stopped:0.14, partial:0.22, penetrated:isAP?0.45:0.34 },
    steel:    { stopped:0.08, partial:0.13, penetrated:isAP?0.28:0.18 },
    titanium: { stopped:0.08, partial:0.12, penetrated:isAP?0.24:0.16 },
    aluminum: { stopped:0.18, partial:0.22, penetrated:0.28 },
    composite:{ stopped:0.20, partial:0.25, penetrated:0.30 },
    pe:       { stopped:0.18, partial:0.22, penetrated:0.28 },
    aramid:   { stopped:0.16, partial:0.20, penetrated:0.22 },
    glass:    { stopped:0.20, partial:0.30, penetrated:0.40 },
  }[material];
  const gBefore = info.globalAmount;
  if (GC) {
    const ratio = pen ? GC.penetrated : (partial ? GC.partial : GC.stopped);
    const cap = maxDur * ratio;
    if (info.globalAmount > cap) info.globalAmount = cap;
  }
  info.globalCapApplied = info.globalAmount < gBefore - 1e-6;
  info.cappedGlobalAmountBefore = +gBefore.toFixed(2);
  info.cappedGlobalAmountAfter = +info.globalAmount.toFixed(2);
  // local cap — 재질·결과·탄종 severity ([추가지시] 큰 탄일수록 local cap도 높음)
  const stoppedLocalCap = { ceramic:16, steel:14, titanium:14, aluminum:22, composite:22, pe:22, aramid:20, glass:30, fabric:20 }[material] || 22;
  let localCap;
  if (pen || partial) {
    const base = { ceramic:60, steel:40, titanium:40, aluminum:50, composite:55, pe:55, aramid:45, glass:70, fabric:30 }[material] || 50;  // small_rifle_fmj 기준
    const mx   = { ceramic:95, steel:80, titanium:60, aluminum:60, composite:62, pe:62, aramid:52, glass:78, fabric:38 }[material] || 60;  // penetrator/AP 상한
    const sev = getAmmoLocalSeverity(threatClass);
    const t = Math.max(0, Math.min(1, (sev - 1.0) / 0.8));   // sev 1.0→base, 1.8→mx
    localCap = base + (mx - base) * t;
    if (partial) localCap = (stoppedLocalCap + localCap) * 0.5;
  } else {
    localCap = stoppedLocalCap;
  }
  if (info.localAmount > localCap) info.localAmount = localCap;
  info.localCapValue = +localCap.toFixed(1);
}
// §9: ceramic/glass/composite/pe 주변 전파 — 최종 local 기준 재계산 (steel/titanium/aramid/aluminum은 ds 값 유지)
function applyNeighborSplashRebalance(info, material, resultKind) {
  const pen = (resultKind === 'penetrated');
  let ratio = null;
  if (material === 'ceramic') ratio = pen ? 0.24 : 0.14;
  else if (material === 'glass') ratio = pen ? 0.32 : 0.20;
  else if (material === 'composite' || material === 'pe') ratio = pen ? 0.17 : 0.10;
  if (ratio == null) return;
  info.neighborSplashAmount = +(info.localAmount * ratio).toFixed(2);
}
function computeArmorDurabilityDamage(ctx) {
  const ammo = ctx.ammo;
  // ARMOR-HOTFIX-1 §5: 'mixed' 차단 — zone durabilityMaterial 우선
  const material = normalizeDurabilityMaterial(ctx.durabilityMaterial || ctx.material, ctx.zoneDurabilityMaterial, 'composite');
  const wearBase = getAmmoArmorWearBase(ammo);
  const mr = getArmorMaterialThreatResponse(material, ammo, ctx.layerType);
  const resultKind = ctx.armorResult || (ctx.penetrated ? 'penetrated' : 'stopped');
  const pf = getPenetrationPressureFactor(ammo, ctx.baseArmor || 0, ctx.effectiveArmor, null, !!ctx.penetrated, ctx.shotPenOverride);
  const rf = getArmorHitResultFactor(resultKind, material, ctx.layerType);
  // SIDE-AMMO-KINETICS §9: kinetic wear factor (없으면 velocity fallback)
  const kin = ctx.kinetics || (ammo ? computeProjectileKinetics(ammo, ctx.impactVelocity, ctx.initialVelocity) : null);
  const kwf = getArmorKineticWearFactor(ammo, kin, mr.threatClass, material, ctx.layerType);
  const prof = getArmorMaterialDamageProfile(material);
  const dist = resolveArmorDamageDistribution(ammo, material, mr.threatClass, kin, ctx);
  let layerFactor = 1.0;
  if (/soft/.test(ctx.layerType || '')) layerFactor = 1.5;
  else if (/face_shield|visor|glass/.test(ctx.layerType || '')) layerFactor = 1.3;
  else if (/helmet/.test(ctx.layerType || '')) layerFactor = 1.1;
  const rearFactor = ctx.rearArmor ? 0.9 : 1.0;
  // §13 local 반복 — multiHitVulnerability 반영
  let localRepeatFactor = 1.0;
  if (!ctx.analysisMode && ctx.target && ctx.slotKey && ctx.localZone) {
    const d = ctx.target.armorDurability && ctx.target.armorDurability[ctx.slotKey];
    if (d && d.localZones) localRepeatFactor = 1 + (0.4 * prof.multiHitVulnerability) * Math.min(1, (d.localZones[ctx.localZone] || 0) / 100);
  }
  const edge = (ctx.localZone === 'edge') || ctx.edgeHit;
  let edgeFactor = 1.0;
  if (edge) {
    if (material === 'ceramic' || material === 'glass' || material === 'aluminum') edgeFactor = 1 + prof.edgeWeakness * 0.8;
    else if (material === 'steel' || material === 'titanium') edgeFactor = 1 + prof.edgeWeakness * 0.25;
    else edgeFactor = 1 + prof.edgeWeakness * 0.1;
  }
  // §13 globalSpreadFactor — 재질별 전파 (steel/titanium 강한 clamp)
  let globalSpreadFactor = 1.0;
  if (material === 'ceramic' || material === 'glass') globalSpreadFactor = 0.8 + prof.crackPropagation * 0.5;
  else if (material === 'composite' || material === 'pe') globalSpreadFactor = 0.85 + prof.delamination * 0.4;
  else if (material === 'aramid') globalSpreadFactor = 0.9 + prof.fiberFailure * 0.25;
  else if (material === 'aluminum') globalSpreadFactor = 0.9 + prof.plasticDeformation * 0.2;
  else if (material === 'steel') globalSpreadFactor = 0.85;
  else if (material === 'titanium') globalSpreadFactor = 0.75;
  // §12.4/12.5 buckshot/flechette hard plate clamp
  let buckClamp = 1.0;
  if ((mr.threatClass === 'shotgun_buck' || mr.threatClass === 'flechette') && /hard|plate|analysis_hard/.test(ctx.layerType || '') && (material === 'ceramic' || material === 'steel' || material === 'titanium' || material === 'composite' || material === 'pe' || material === 'aluminum' || material === 'glass')) buckClamp = (mr.threatClass === 'flechette') ? 0.35 : 0.5;
  // base wear (기존 magnitude 유지 — vf→kwf)
  const baseWear = wearBase * mr.response * pf.factor * rf * kwf * ARMOR_WEAR_TUNING_SCALE;
  // §13 GLOBAL — d.current 감소분 (재질 global 성향 중심)
  const GLOBAL_BOOST = 1.45;
  let globalAmount = baseWear * dist.globalShare * dist.globalFocus * dist.energyGlobalMul * dist.momentumGlobalMul * globalSpreadFactor * layerFactor * rearFactor * buckClamp * GLOBAL_BOOST;
  // §13 LOCAL — localZones 누적분 (0~100). LOCALITY-1: ACCEL 하향(목표 체감값 정렬), 관통 boost는 rebalance가 담당
  const LOCAL_ACCEL = 1.5;
  let localAmount = baseWear * dist.localShare * dist.localFocus * dist.energyLocalMul * prof.localSusceptibility * localRepeatFactor * edgeFactor * buckClamp * LOCAL_ACCEL;
  if (pf.nearOvermatch) localAmount *= 1.4;   // near-overmatch만 (penetrated는 applyPenetrationLocalityRebalance에서 boost)
  globalAmount = Math.max(0, globalAmount);
  localAmount = Math.max(0, Math.min(120, localAmount));   // 1차 안전 clamp (실제 cap은 applyArmorGlobalDamageCaps)
  // SIDE-AAR-DAMAGE-FIELD-RETUNE §8 + LOCALITY §11: 최소 손상선 (stopped 중심 + penetrated local floor). 순서 1→2
  { const _fl = applyArmorWearMinimums(globalAmount, localAmount, ctx, kin, material, mr.threatClass, pf, resultKind); globalAmount = _fl.globalAmount; localAmount = _fl.localAmount; }
  // §14 damageState 해석 (관통 판정 불변)
  const ds = resolveMaterialArmorDamageState({
    material, threatClass: mr.threatClass, ammo, armorResult: resultKind, penetrated: !!ctx.penetrated,
    stopped: !ctx.penetrated, ricochet: resultKind === 'ricochet', nearOvermatch: pf.nearOvermatch,
    pressureRatio: pf.pressureRatio, impactEnergyJ: kin && kin.impactEnergyJ, impactMomentumNs: kin && kin.impactMomentumNs,
    localZone: ctx.localZone, edgeHit: edge, frameHit: ctx.frameHit, layerType: ctx.layerType,
  }, { localAmount, globalAmount });
  // [추가지시] 탄종 위력 차등 — local 계열에 severity 배율 (완만 적용: 1+(sev-1)*0.6 — 차등 보존하되 과증폭 방지)
  const _sevRaw = getAmmoLocalSeverity(mr.threatClass);
  const _sev = 1 + (_sevRaw - 1) * 0.6;
  if (_sev !== 1.0) {
    localAmount *= _sev;
    ds.neighborSplashAmount *= _sev; ds.backfaceDeformationHint *= _sev;
    ds.spallRiskDelta *= _sev; ds.coatingDamageDelta *= _sev; ds.visibilityDamageDelta *= _sev;
  }
  // §10 spall/coating floor — steel/titanium stopped rifle (severity 적용 후 최소 보장)
  if ((material === 'steel' || material === 'titanium') && (resultKind === 'stopped' || resultKind === 'partial_or_backer_stopped')) {
    const _eJ = (kin && kin.impactEnergyJ) || 0;
    const _rifleish = /small_rifle|intermediate|full_power|high_power_ap|shotgun_slug|subsonic_heavy/.test(mr.threatClass) && !/pistol|buck|flech|frangible/.test(mr.threatClass);
    if (_rifleish && _eJ >= 450) {
      const sMul = material === 'titanium' ? 0.5 : 1.0;
      ds.coatingDamageDelta = +Math.max(ds.coatingDamageDelta, 0.15 * sMul).toFixed(2);
      ds.spallRiskDelta = +Math.max(ds.spallRiskDelta, 0.02 * sMul).toFixed(3);
      if (pf.nearOvermatch) { ds.coatingDamageDelta = +Math.max(ds.coatingDamageDelta, 0.35 * sMul).toFixed(2); ds.spallRiskDelta = +Math.max(ds.spallRiskDelta, 0.04 * sMul).toFixed(3); }
    }
  }
  // mutable info 구성 후 LOCALITY 파이프라인 (순서 3 rebalance → 4 cap → neighbor)
  const _capSlot = (!ctx.analysisMode && ctx.target && ctx.target.armorDurability && ctx.target.armorDurability[ctx.slotKey]) || null;
  const info = {
    amount: globalAmount, globalAmount, localAmount,
    material, materialProfileKey: material, threatClass: mr.threatClass, materialResponse: mr.response,
    damageKind: ds.damageKind, damageMode: ds.damageMode, stateTags: ds.stateTags,
    pressureFactor: pf.factor, pressureRatio: +pf.pressureRatio.toFixed(2), nearOvermatch: pf.nearOvermatch,
    resultFactor: rf, kineticWearFactor: kwf, velocityFactor: kwf, layerFactor, localRepeatFactor: +localRepeatFactor.toFixed(2),
    localShare: dist.localShare, globalShare: dist.globalShare,
    energyRatio: (kin && kin.energyRatio != null) ? kin.energyRatio : null, momentumRatio: (kin && kin.momentumRatio != null) ? kin.momentumRatio : null,
    spallRiskDelta: ds.spallRiskDelta, coatingDamageDelta: ds.coatingDamageDelta, neighborSplashAmount: ds.neighborSplashAmount,
    visibilityDamageDelta: ds.visibilityDamageDelta, backfaceDeformationHint: ds.backfaceDeformationHint, residualStrengthHint: ds.residualStrengthHint,
    localZone: ctx.localZone || null, aarLabel: ds.aarLabel, resultKind, penetrated: !!ctx.penetrated,
    localSeverity: +_sev.toFixed(2),
  };
  if (resultKind === 'penetrated') applyPenetrationLocalityRebalance(info, ctx, material);   // 순서 3
  applyArmorGlobalDamageCaps(info, ctx, _capSlot, material, resultKind, mr.threatClass, kin);  // 순서 4 (global+local cap)
  applyNeighborSplashRebalance(info, material, resultKind);                                     // neighbor 재계산 (최종 local 기준)
  // 반올림 마감
  info.globalAmount = +info.globalAmount.toFixed(3); info.amount = info.globalAmount;
  info.localAmount = +info.localAmount.toFixed(2);
  info.neighborSplashAmount = +Number(info.neighborSplashAmount || 0).toFixed(2);
  info.spallRiskDelta = +Number(info.spallRiskDelta || 0).toFixed(3);
  info.coatingDamageDelta = +Number(info.coatingDamageDelta || 0).toFixed(2);
  info.visibilityDamageDelta = +Number(info.visibilityDamageDelta || 0).toFixed(2);
  info.backfaceDeformationHint = +Number(info.backfaceDeformationHint || 0).toFixed(2);
  info.debugLabel = `${material} ${mr.threatClass} g${info.globalAmount.toFixed(1)} l${info.localAmount.toFixed(1)} ${ds.damageMode}${info.globalCapApplied ? ' [gcap]' : ''}${info.penetrationLocalityRebalance ? ' [pen-loc]' : ''}`;
  return info;
}
// SIDE-AAR-DAMAGE-FIELD-RETUNE §8: 최소 손상선 — 계산값이 너무 낮을 때 재질/탄종/결과별 global/local floor (hard/plate 한정, pistol/buck/flech 제외, soft 제외)
function applyArmorWearMinimums(globalAmount, localAmount, ctx, kin, material, threatClass, pf, resultKind) {
  const lt = ctx.layerType || '';
  if (!/hard|plate|helmet|face_shield|analysis_hard/.test(lt)) return { globalAmount, localAmount };
  const stopped = (resultKind === 'stopped' || resultKind === 'partial_or_backer_stopped');
  const penetrated = (resultKind === 'penetrated');
  const tc = threatClass;
  if (/pistol|frangible|shotgun_buck|flechette/.test(tc)) return { globalAmount, localAmount };   // pistol/buck/flech 제외
  const eJ = (kin && kin.impactEnergyJ) || 0, mNs = (kin && kin.impactMomentumNs) || 0;
  const nearOM = !!(pf && pf.nearOvermatch);
  const isAP = /penetrator|high_power_ap|anti_material/.test(tc);
  const G = v => { if (v > globalAmount) globalAmount = v; };
  const L = v => { if (v > localAmount) localAmount = v; };
  if (penetrated) {
    // SIDE-ARMOR-PENETRATION-LOCALITY §11: 관통 floor — 낮은 global, 의미있는 local (이후 rebalance/cap이 마감)
    if (material === 'steel') { G(isAP ? 0.65 : 0.55); L(isAP ? 12 : 10); }
    else if (material === 'titanium') { G(0.45); L(9); }
    else if (material === 'ceramic') { G(isAP ? 4 : 3); L(isAP ? 24 : 18); }
    else if (material === 'glass') { G(2.5); L(18); }
    else if (material === 'composite' || material === 'pe') { G(1.5); L(12); }
    else if (material === 'aramid') { G(1.0); L(10); }
    else if (material === 'aluminum') { G(0.8); L(12); }
    localAmount = Math.min(120, localAmount);
    return { globalAmount, localAmount };
  }
  if (!stopped) return { globalAmount, localAmount };   // ricochet 등 — floor 미적용
  if (material === 'steel') {
    if (isAP) { G(0.45); L(8.0); }
    else if (tc === 'small_rifle_fmj' || tc === 'small_rifle_fragmenting') { if (eJ >= 450) { G(0.30); L(4.0); } }
    else if (tc === 'intermediate_fmj') { if (eJ >= 900) { G(0.45); L(5.5); } }
    else if (tc === 'full_power_fmj') { if (eJ >= 1500) { G(0.70); L(7.0); } }
    else if (tc === 'shotgun_slug') { if (mNs >= 8) { G(0.80); L(8.0); } }
    if (nearOM) { G(0.75); L(8.0); }
  } else if (material === 'titanium') {   // steel의 70~85% global, 80~90% local
    if (isAP) { G(0.38); L(6.8); }
    else if (tc === 'small_rifle_fmj' || tc === 'small_rifle_fragmenting') { if (eJ >= 450) { G(0.24); L(3.4); } }
    else if (tc === 'intermediate_fmj') { if (eJ >= 900) { G(0.36); L(4.7); } }
    else if (tc === 'full_power_fmj') { if (eJ >= 1500) { G(0.56); L(6.0); } }
    else if (tc === 'shotgun_slug') { if (mNs >= 8) { G(0.62); L(6.8); } }
    if (nearOM) { G(0.58); L(6.8); }
  } else if (material === 'aluminum') {   // steel보다 soft → floor 높음
    if (isAP) { G(0.55); L(8.0); }
    else if (tc === 'small_rifle_fmj' || tc === 'small_rifle_fragmenting') { if (eJ >= 450) { G(0.60); L(6.0); } }
    else if (tc === 'intermediate_fmj') { if (eJ >= 900) { G(0.75); L(7.0); } }
    else if (tc === 'full_power_fmj') { if (eJ >= 1500) { G(0.95); L(8.5); } }
    else if (tc === 'shotgun_slug') { if (mNs >= 8) { G(1.0); L(10.0); } }
    if (nearOM) { G(0.90); L(9.0); }
  }
  localAmount = Math.min(55, localAmount);
  return { globalAmount, localAmount };
}
// §11 Armor Analysis 전용 estimate — 실제 전투와 같은 compute 사용 (durability는 깎지 않음)
function effectivePenetration(ammo, weapon, material) {
  const fallback = (weapon && weapon.penetration) || 2;
  if (!ammo) return fallback;
  const base = (ammo.penetration != null) ? ammo.penetration : fallback;
  if (!material) return base;
  const tbl = ammo.materialPenPenalty || {};
  const penalty = (tbl[material] != null) ? tbl[material] : 0;
  return Math.max(0, base - penalty);
}
function penetrationProbability(diff) {
  const k = 0.21, center = 4.0;
  const p = 1 / (1 + Math.exp(-k * (diff - center)));
  // 상한 동적 조정 — 압도적 우세에선 사실상 확정 관통
  //   diff >= 30: 1.0 (완전 확정)
  //   diff >= 20: 0.995 (사실상 확정)
  //   그 외: 기존 0.98 상한 유지
  if (diff >= 30) return 1.0;
  if (diff >= 20) return Math.max(0.995, p);
  return Math.max(0.01, Math.min(0.98, p));
}
function rollPenetration(pen, armor) {
  let p = pen, a = armor;
  // 스케일 일관성 — 둘 다 0~10 소형 스케일일 때만 ×10 정규화.
  //   한쪽이 10 이상(100-스케일)이면 작은 값을 ×10 하지 않는다.
  //   (예전: 한쪽만 스케일되어 flechette 유효관통 9 → 90으로 부풀려져 6급 플레이트 관통하던 버그)
  if (p > 0 && a > 0 && p < 10 && a < 10) { p *= ARMOR_SCALE; a *= ARMOR_SCALE; }
  else if (p > 0 && p < 10 && a <= 0)     { p *= ARMOR_SCALE; }   // 비방호(armor 0)에서만 단독 스케일 허용
  const diff = p - a;
  const prob = penetrationProbability(diff);
  return Math.random() < prob;
}

// 헬멧에 대한 탄종별 방호 감소 (armorValue에서 차감)
//   소구경 고속탄: 헬멧 shell 구조 약점이 크게 드러남 (penalty 큼)
//   대구경 풀파워탄: 에너지로 밀어붙임 — penalty 보통
//   변형탄/frangible: 헬멧에 특별히 강하지 않음 — penalty 작음
//   권총탄: 권총탄은 헬멧의 본래 위협 대상이므로 penalty 0 (기존 방호 그대로)
function getHelmetArmorPenalty(ammo) {
  if (!ammo || !ammo.caliber) return 0;
  const cal = ammo.caliber;
  // 권총탄은 그대로
  if (cal === '9x19mm' || cal === '9mm' || cal === '.45 ACP') return 0;
  // 소구경 고속탄 — 헬멧 약점
  if (cal === '5.45x39mm' || cal === '5.56x45mm' || cal === '.223 Rem') {
    if (ammo.barrierBehavior === 'penetrator' || ammo.barrierBehavior === 'penetrator_unstable') return 8;
    if (ammo.barrierBehavior === 'fragment' || ammo.barrierBehavior === 'frangible' || ammo.barrierBehavior === 'deform') return 4;
    return 6;
  }
  // 대구경/중간탄 — 에너지로 밀어붙임
  if (cal === '7.62x39mm' || cal === '7.62x51mm' || cal === '.308 Win') {
    if (ammo.barrierBehavior === 'penetrator') return 6;
    if (ammo.barrierBehavior === 'deform' || ammo.barrierBehavior === 'frangible' || ammo.barrierBehavior === 'fragment') return 3;
    return 4;
  }
  return 0;
}

// 헬멧 슬롯에 적용된 effective armor — armorValue에서 탄종 페널티 차감 (0 이하 X)
function applyHelmetArmorPenalty(armorValue, ammo, slot) {
  if (!slot || !slot.isHelmet) return armorValue;
  const pen = getHelmetArmorPenalty(ammo);
  return Math.max(0, armorValue - pen);
}
function residualPenetrationAfterHard(weaponPen, hardArmor) {
  let p = weaponPen, a = hardArmor;
  if (p > 0 && p < 10) p *= ARMOR_SCALE;
  if (a > 0 && a < 10) a *= ARMOR_SCALE;
  return Math.max(0, p - (a * 0.75 - Math.random() * 6));
}

// =============================================================
// 2A-6.6: 관통 후 잔여 위협 패킷 — residualKind / overmatch / integrity 기반 조건부 백커 모델
//   hardArmor + backingArmor 단순합을 1차/2차 판정에 직접 쓰지 않는다.
//   고 overmatch intact AP 관통자는 백커가 거의 완전저지하지 못하고, 피해 완화 위주로만 작동.
// =============================================================
// SIDE-AMMO-1B §2: sabot 계열 탄약 식별 + subtype별 성향 (barrierBehavior 기반, notes/projectile 보조)
function _sabotInfo(ammo) {
  if (!ammo) return null;
  const beh = ammo.barrierBehavior || '';
  const notes = (ammo.ui && ammo.ui.notes) || ammo.notes || ammo._notes || [];
  const nh = (k) => Array.isArray(notes) && notes.indexOf(k) >= 0;
  const projSabot = ammo.projectile && (ammo.projectile.projectileType === 'sabot' || (ammo.projectile.sabot && ammo.projectile.sabot.enabled));
  const isSabot = beh === 'sabot_tungsten_ap' || beh === 'sabot_penetrator' || projSabot ||
                  nh('slap') || nh('sabot_ap') || nh('sabot_penetrator') || nh('cbj_subcaliber');
  if (!isSabot) return null;
  let subtype;
  if (beh === 'sabot_penetrator' || nh('cbj_subcaliber')) subtype = 'cbj_subcaliber';
  else if ((ammo.caliber && String(ammo.caliber).indexOf('12.7') >= 0) || (ammo.penetration || 0) >= 95) subtype = 'heavy_slap';
  else subtype = 'legacy_slap';
  const T = {
    legacy_slap:    { integrity:0.82, dragAfterSeparationMul:1.20, woundChannelMul:0.65, armorFocusMul:1.18, backerCatchPenaltyMul:0.70, backerEfficiencyMul:0.35, penetratorMassClass:'light' },
    heavy_slap:     { integrity:0.90, dragAfterSeparationMul:1.10, woundChannelMul:0.75, armorFocusMul:1.25, backerCatchPenaltyMul:0.58, backerEfficiencyMul:0.27, penetratorMassClass:'medium_light' },
    cbj_subcaliber: { integrity:0.72, dragAfterSeparationMul:0.98, woundChannelMul:0.65, armorFocusMul:1.15, backerCatchPenaltyMul:0.75, backerEfficiencyMul:0.42, penetratorMassClass:'medium_light' },
  }[subtype];
  return Object.assign({ subtype, enabled:true, penetratorMaterial:'tungsten', penetratorDiameterClass:'small' }, T);
}
function _ammoBarrierInfo(ammo) {
  return {
    behavior: (ammo && ammo.barrierBehavior) || 'normal',
    stability: (ammo && ammo.barrierStability != null) ? ammo.barrierStability : 0.6,
    retention: (ammo && ammo.barrierDamageRetention != null) ? ammo.barrierDamageRetention : 0.7,
    pen: (ammo && ammo.penetration) || 0,
  };
}
function buildResidualThreatAfterHard(ammo, effPenHard, effHardArmor, protection, backerRes) {
  const overmatchMargin = +(effPenHard - effHardArmor).toFixed(1);
  const b = _ammoBarrierInfo(ammo);
  // SIDE-AMMO-1B §3: sabot 계열은 일반 AP-like와 분리된 sabot_penetrator residualKind로 처리
  const sabot = _sabotInfo(ammo);
  if (sabot) {
    let integrity = sabot.integrity + (overmatchMargin >= 12 ? 0.05 : 0) + (b.stability - 0.9) * 0.10;
    integrity = Math.max(0, Math.min(1, integrity));
    let residualPen = residualPenetrationAfterHard(effPenHard, effHardArmor);
    // armorFocus 보조 — 이미 pen/materialPenalty에 반영됐으므로 overmatch 클 때만 약하게(중복 과증폭 금지)
    if (overmatchMargin > 0) residualPen *= (1 + Math.min(0.10, overmatchMargin * 0.005) * (sabot.armorFocusMul - 1) * 2);
    residualPen = +Math.max(0, residualPen).toFixed(1);
    return {
      overmatchMargin, residualPen,
      residualIntegrity: +integrity.toFixed(2), residualBreakup: +(1 - integrity).toFixed(2),
      residualKind: 'sabot_penetrator',
      backerEfficiencyMul: sabot.backerEfficiencyMul,
      mitigationMul: 0.90,
      backerCatchEligible: (overmatchMargin < 8),
      residualDeflectionRisk: (sabot.subtype === 'cbj_subcaliber') ? 0.45 : 0.35,
      residualYawRisk: 0.30,
      residualMassPenalty: (sabot.subtype === 'heavy_slap') ? 0.10 : 0.20,
      sabot: {
        enabled: true, subtype: sabot.subtype, penetratorMaterial: 'tungsten',
        penetratorDiameterClass: 'small', penetratorMassClass: sabot.penetratorMassClass,
        armorFocusMul: sabot.armorFocusMul, woundChannelMul: sabot.woundChannelMul,
        dragAfterSeparationMul: sabot.dragAfterSeparationMul, backerCatchPenaltyMul: sabot.backerCatchPenaltyMul,
      },
    };
  }
  // [0.39.5 §1] AP 판정은 raw barrier behavior 문자열이 아니라 canonical profile.apLike 사용.
  //   barrier_blind는 AP가 아니다 — intact_penetrator / integrity bonus / residualPen bonus를 자동 부여하지 않는다.
  //   장애물 통과 안정성은 b.stability/retention(탄별 실제 stat)에 이미 반영됨(별도 AP 보너스 없음).
  const _canonProfile = (typeof getCanonicalProjectileProfile === 'function') ? getCanonicalProjectileProfile(ammo) : null;
  const _explicitAP = !!(ammo && (ammo.armorPiercing === true || ammo.penetrator === true)) || (_canonProfile && _canonProfile.subsonicClass === 'armor_piercing');
  const apLike   = _canonProfile ? (!!_canonProfile.apLike || _explicitAP)
                                 : (b.behavior === 'penetrator' || b.behavior === 'precision' || b.behavior === 'pistol_penetrator');   // legacy: barrier_blind 제외
  const barrierBlind = _canonProfile ? !!_canonProfile.barrierBlind : (b.behavior === 'barrier_blind');
  const fragLike = (b.behavior === 'fragment' || b.behavior === 'frangible' || b.behavior === 'deform');
  // residualIntegrity (0~1): 관통자가 얼마나 멀쩡히 살아남았는가
  let integrity = 0.5;
  integrity += (b.stability - 0.6) * 0.45;
  integrity += (b.retention - 0.7) * 0.30;
  if (apLike) integrity += 0.22;
  if (fragLike) integrity -= 0.35;
  if (b.behavior === 'penetrator_unstable') integrity -= 0.10;
  if (overmatchMargin >= 12) integrity += 0.10;
  integrity = Math.max(0, Math.min(1, integrity));
  const breakup = +(1 - integrity).toFixed(2);
  // residualKind 판정
  let kind;
  if (apLike && integrity >= 0.62) kind = 'intact_penetrator';
  else if (fragLike || integrity < 0.35) kind = 'fragmented_core';
  else if (overmatchMargin <= 4 && integrity < 0.55) kind = 'spall_fragment';
  else kind = 'deformed_core';
  // residualPen — residualKind별 차등
  let residualPen = residualPenetrationAfterHard(effPenHard, effHardArmor);
  if (kind === 'intact_penetrator') residualPen *= 1.05;
  else if (kind === 'deformed_core') residualPen *= 0.80;
  else if (kind === 'fragmented_core') residualPen *= 0.55;
  else residualPen *= 0.40;  // spall_fragment
  residualPen = +Math.max(0, residualPen).toFixed(1);
  // backerEfficiencyMul (section 9)
  let backerEfficiencyMul = (kind === 'spall_fragment') ? 1.20
                          : (kind === 'fragmented_core') ? 1.05
                          : (kind === 'deformed_core') ? 0.78 : 0.25;
  // mitigationMul — 완전저지 실패해도 피해 완화 (작을수록 강한 완화). intact는 5~15%만.
  let mitigationMul = (kind === 'spall_fragment') ? 0.70
                    : (kind === 'fragmented_core') ? 0.78
                    : (kind === 'deformed_core') ? 0.85 : 0.92;
  return { overmatchMargin, residualPen, residualIntegrity:+integrity.toFixed(2), residualBreakup:breakup,
           residualKind:kind, backerEfficiencyMul, mitigationMul, backerCatchEligible:true };
}
// 백커 완전저지 시도 가능 여부 (section 8)
function canBackerAttemptStop(pkt, backerArmorValue, backerSufficiency, ratingMode) {
  if (!pkt) return false;
  const om = pkt.overmatchMargin;
  // SIDE-AMMO-1B §3-5: sabot_penetrator — 큰 overmatch면 사실상 못 잡고, 낮으면 드물게 시도 가능
  if (pkt.residualKind === 'sabot_penetrator') {
    if (om >= 10) return false;
    if (!pkt.backerCatchEligible) return false;
    if (pkt.residualPen > backerArmorValue * 0.55) return false;
    if (ratingMode === 'icw' && backerSufficiency === 'insufficient') return false;
    return true;
  }
  if (om >= 16) return false;
  if (pkt.residualKind === 'intact_penetrator' && om >= 10) return false;
  if (pkt.residualKind === 'intact_penetrator' && pkt.residualPen > backerArmorValue * 0.45) return false;
  if (backerArmorValue > 0 && pkt.residualPen >= backerArmorValue * 0.90) return false;
  if (ratingMode === 'icw' && backerSufficiency === 'insufficient') return false;
  return true;
}
// chanceGate (section 15)
function backerStopChanceGate(pkt, backerSufficiency, ratingMode) {
  let base = (pkt.residualKind === 'spall_fragment') ? 0.85
           : (pkt.residualKind === 'fragmented_core') ? 0.68
           : (pkt.residualKind === 'sabot_penetrator') ? 0.12
           : (pkt.residualKind === 'deformed_core') ? 0.40 : 0.10;
  // SIDE-AMMO-1B §3-5/3-6: sabot은 backerCatchPenalty로 추가 하향
  if (pkt.residualKind === 'sabot_penetrator' && pkt.sabot) base *= pkt.sabot.backerCatchPenaltyMul;
  const om = pkt.overmatchMargin;
  const omMul = (om <= 4) ? 1.0 : (om <= 8) ? 0.75 : (om <= 12) ? 0.40 : (om <= 15) ? 0.15 : 0.0;
  let sufMul = 1.0;
  if (ratingMode === 'icw') sufMul = (backerSufficiency === 'sufficient') ? 1.0 : (backerSufficiency === 'partial') ? 0.6 : 0.15;
  return Math.max(0, Math.min(1, base * omMul * sufMul));
}
// 완전저지 실패 시 blunt/shock/pain 완화 계수 (section 10). 1.0=완화없음.
function backerMitigationFactor(pkt, backerSufficiency, ratingMode) {
  let m = pkt.mitigationMul;
  if (ratingMode === 'icw') {
    if (backerSufficiency === 'partial') m = 1 - (1 - m) * 0.55;
    else if (backerSufficiency === 'insufficient') m = 1 - (1 - m) * 0.20;
  }
  return Math.max(0.62, Math.min(1, m));
}
// 관통(penetrated_after_backer) 시에도 백커가 일부 에너지를 흡수 → blunt/shock/pain mult에 완화 반영.
//   applyOutcome이 ctx.bluntModifier/shockModifier/painModifier로 backerRes mults를 읽으므로 여기서 곱한다.
//   관통 자체는 무효화하지 않음(출혈/조직피해 유지). 음수/마법힐 금지.
function computeBackerResolution(protection) {
  const meta = protection._plateMeta || {};
  const mode = meta.plateRatingMode;
  const out = {
    ratingMode: mode || null, backerResult: 'none', backerSufficiency: 0,
    backerArmorValue: 0, secondaryBackerChanceMul: 0, residualStopMul: 0, armorMul: 1.0,
    bluntMul: 1.0, shockMul: 1.0, painMul: 1.0,
    overmatchMargin: 0, residualThreat: 0,
    secondaryStopAttempted: false, secondaryStopSuccess: false,
    armorResultLabel: null, penetrationResultLabel: null, debug: '',
  };
  const backerArmor = meta.plateBaseSoftArmor || 0;   // 외부 방탄복 soft armor
  out.backerArmorValue = backerArmor;
  if (mode === 'icw') {
    const minB = meta.plateMinBackerArmor || 20;
    if (backerArmor >= minB)            { out.backerResult='sufficient';   out.backerSufficiency=1.00; out.secondaryBackerChanceMul=1.00; out.residualStopMul=1.00; out.armorMul=1.00; out.bluntMul=0.85; out.shockMul=0.90; out.painMul=0.90; out.debug='backer sufficient'; }
    else if (backerArmor >= minB*0.6)   { out.backerResult='partial';      out.backerSufficiency=0.70; out.secondaryBackerChanceMul=0.75; out.residualStopMul=0.80; out.armorMul=0.96; out.bluntMul=1.12; out.shockMul=1.10; out.painMul=1.10; out.debug='backer partial'; }
    else                                { out.backerResult='insufficient'; out.backerSufficiency=0.40; out.secondaryBackerChanceMul=0.55; out.residualStopMul=0.70; out.armorMul=0.91; out.bluntMul=1.35; out.shockMul=1.25; out.painMul=1.25; out.debug='backer insufficient'; }
  } else if (mode === 'standalone') {
    out.backerResult = 'integral'; out.backerSufficiency = 1.00; out.armorMul = 1.00;
    // 외부 소프트아머가 있으면 제한적 2차층 (직접합산 X)
    if (backerArmor > 0) { out.secondaryBackerChanceMul = 0.35; out.residualStopMul = 0.45; out.bluntMul=0.90; out.shockMul=0.94; out.painMul=0.94; out.debug='integral + external limited'; }
    else                 { out.secondaryBackerChanceMul = 0.0;  out.residualStopMul = 0.0;  out.bluntMul=0.92; out.shockMul=0.95; out.painMul=0.95; out.debug='integral only'; }
  } else {
    out.backerResult = meta.plateId ? 'not_required' : 'none';
    out.armorMul = 1.0;
  }
  return out;
}

// 탄약이 특정 재질에 대해 실제로 발휘하는 관통력
//   ammo가 새 구조면 ammo.penetration - materialPenPenalty[material]
//   ammo가 없거나 구조에 없으면 weapon.penetration 폴백
// =============================================================
// 탄약 의료 프로파일 — 출혈/골절/쇼크/둔상/조직손상
// =============================================================
//   AMMO_MEDICAL[id]에 탄약별 의료 수치를 정의. AMMO_PRESETS 본체에 직접 넣지 않고
//   별도 테이블로 두어 가독성/유지보수성 ↑.
//   누락된 필드는 기본값으로 보완.
const HELMET_ZONE_CURVATURE = {
  helmetFrontCenter: 0.95, helmetFrontUpper: 1.30, helmetSideFront: 1.25,
  helmetSideCenter: 1.40, helmetSideRear: 1.25, helmetRearCenter: 1.10,
  helmetRearLower: 1.15, helmetTop: 1.45, helmetEarCoverage: 1.20, helmetLowerEdge: 1.20,
  slaapFrontUpper: 1.25, slaapSideFrontOverlap: 1.30, facePlateTitanium: 1.20,
  titaniumFacePlate: 1.20, steelFacePlate: 1.20, metalFacePlate: 1.20,
};

// 재질 → ricochet materialMul
function getMaterialRicochetMul(material) {
  if (!material) return 1.0;
  const m = String(material).toLowerCase();
  if (m === 'steel' || m === 'titanium') return 1.25;
  if (m === 'aramid' || m === 'kevlar') return 0.95;
  if (m === 'ceramic') return 1.0;
  if (m === 'composite') return 1.0;
  if (m === 'glass' || m === 'polycarbonate') return 0.35;
  return 1.0;
}

// location(내부 표기) → hitPart(impactAddress 표기)
//   isLeft: arms/legs 통합형일 때 좌우 확정값 (null이면 호출측이 별도 결정)
function computeRicochetHint(impactAddress, ammo, armorResult) {
  const hint = { eligible:false, chance:0, reason:'', zoneCurvatureMul:1, ammoRicochetMul:1, materialMul:1, angleMul:1, finalRoll:null, ricocheted:false };
  // 적용 대상: helmetShell / helmetAccessory(SLAAP) / titaniumFacePlate / metalFacePlate
  const layer = impactAddress.armorLayer;
  const zone = impactAddress.coverageZone;
  const isHelmet = (layer === 'helmet' || layer === 'helmetAccessory');
  const isHardFace = (zone === 'titaniumFacePlate' || zone === 'facePlateTitanium' || zone === 'metalFacePlate' || zone === 'steelFacePlate');
  // glass/eyeGlass는 도탄 X (crack/shatter 중심)
  if (zone === 'eyeGlass' || zone === 'visionSlitGlass' || zone === 'glassVisor' || zone === 'ballisticGlass') {
    hint.reason = 'glass_no_ricochet';
    // 관통 여부에 따라 crack vs shatter 힌트 (실제 damage는 생성 X, 후보만)
    const shattered = (armorResult === 'penetrated');
    impactAddress.crackHint = {
      eligible: true,
      type: shattered ? 'shatter' : 'crack',
      material: 'glass',
      durabilityGroupHint: 'visionGlass',
    };
    impactAddress.spallHint = null;
    return hint;
  }
  if (!isHelmet && !isHardFace) { hint.reason = 'not_curved_hard'; return hint; }
  // 관통됐으면 도탄 없음
  if (armorResult === 'penetrated') { hint.reason = 'penetrated'; return hint; }
  // base ammo ricochet 성향
  let baseAmmoRicochet = 0;
  let ammoRicochetMul = 1.0;
  let ammoSrc = 'none';
  if (ammo) {
    if (ammo.ricochetChance != null) { baseAmmoRicochet = ammo.ricochetChance; ammoSrc = 'ricochetChance'; }
    else if (ammo.ricochet != null) { baseAmmoRicochet = ammo.ricochet; ammoSrc = 'ricochet'; }
    else if (ammo.deflectChance != null) { baseAmmoRicochet = ammo.deflectChance; ammoSrc = 'deflectChance'; }
    else if (ammo.terminalEffect && ammo.terminalEffect.ricochetChance != null) { baseAmmoRicochet = ammo.terminalEffect.ricochetChance; ammoSrc = 'terminalEffect'; }
    // ricochetMul은 확률 자체가 아니라 도탄 성향 배율/보정값
    if (ammo.ricochetMul != null) ammoRicochetMul = ammo.ricochetMul;
    else if (ammo.terminalEffect && ammo.terminalEffect.ricochetMul != null) ammoRicochetMul = ammo.terminalEffect.ricochetMul;
    // fallback: 탄종 behavior 기반 rough 추정 (base가 비었을 때만)
    if (!baseAmmoRicochet) {
      const beh = ammo.barrierBehavior;
      if (beh === 'penetrator' || beh === 'penetrator_unstable') { baseAmmoRicochet = 0.12; ammoSrc = 'behavior:penetrator'; }
      else if (beh === 'deform' || beh === 'fragment' || beh === 'frangible') { baseAmmoRicochet = 0.06; ammoSrc = 'behavior:deform'; }
      else { baseAmmoRicochet = 0.10; ammoSrc = 'behavior:default'; }
    }
  }
  // zone curvature
  const zoneCurv = HELMET_ZONE_CURVATURE[impactAddress.helmetZone] || HELMET_ZONE_CURVATURE[zone] || 1.0;
  // material
  const matMul = getMaterialRicochetMul(impactAddress.material || (isHelmet ? 'aramid' : 'titanium'));
  // angle (impactSide + zone 근사)
  let angleMul = 1.0;
  const hz = impactAddress.helmetZone || '';
  if (hz === 'helmetFrontCenter') angleMul = 0.9;
  else if (hz.indexOf('Upper') >= 0 || hz === 'helmetTop' || hz.indexOf('SideCenter') >= 0 || hz.indexOf('SideFront') >= 0) angleMul = 1.3;
  if (impactAddress.impactSide === 'oblique') angleMul = Math.max(angleMul, 1.4);
  // armorResult context
  const ctxMul = (armorResult === 'stopped' || armorResult === 'partial') ? 1.1 : 0.7;
  hint.eligible = true;
  hint.zoneCurvatureMul = zoneCurv;
  hint.ammoRicochetMul = ammoRicochetMul;
  hint.materialMul = matMul;
  hint.angleMul = angleMul;
  hint.baseAmmoRicochet = baseAmmoRicochet;
  hint.ammoSource = ammoSrc;
  let chance = baseAmmoRicochet * ammoRicochetMul * zoneCurv * matMul * angleMul * ctxMul;
  chance = Math.max(0, Math.min(0.65, chance));   // clamp 0~0.65 (보수적)
  hint.chance = chance;
  hint.reason = 'curved_hard_eligible';
  return hint;
}

// === 핵심: buildImpactAddress ===
//   기존 rollHitLocation / rollProtection 결과를 받아 impactAddress 생성
const BODY_RESISTANCE = {
  head:      { cost:10, exitCost:5, cls:'rigid_high',   cavity:false },
  neck:      { cost:7,  exitCost:4, cls:'soft_vascular', cavity:false },
  chest:     { cost:14, exitCost:5, cls:'cavity_torso',  cavity:true  },
  abdomen:   { cost:12, exitCost:5, cls:'cavity_torso',  cavity:true  },
  left_arm:  { cost:7,  exitCost:3, cls:'limb_thin',     cavity:false },
  right_arm: { cost:7,  exitCost:3, cls:'limb_thin',     cavity:false },
  left_leg:  { cost:11, exitCost:5, cls:'limb_thick',    cavity:false },
  right_leg: { cost:11, exitCost:5, cls:'limb_thick',    cavity:false },
  legs:      { cost:11, exitCost:5, cls:'limb_thick',    cavity:false },
  arms:      { cost:7,  exitCost:3, cls:'limb_thin',     cavity:false },
};
// terminal family → 인체 경로 보정 (관통cost mul / exit 경향 / 잔류 경향)
// SIDE-MED-2B-1A-HOTFIX-1: 탄 크기 등급 (내부 메타 — terminalEffect.type에 추가하지 않음)
function _bodyTerminalMods(profile) {
  const fam = (profile && profile.family) || '';
  const ch = (profile && profile.woundChannel) || 'normal';
  let costMul = 1.0, exitMul = 1.0, retainBias = 0.0, channel = 'normal';
  if (/ap|penetrator|sabot|narrow/.test(fam) || ch === 'narrow') { costMul = 0.7; exitMul = 1.35; retainBias = -0.12; channel = 'narrow'; }
  else if (/expand/.test(fam) || ch === 'expanding') { costMul = 1.4; exitMul = 0.6; retainBias = 0.18; channel = 'expanding'; }
  else if (/frangible|fragmenting/.test(fam) || ch === 'fragmenting') { costMul = 1.5; exitMul = 0.4; retainBias = 0.22; channel = 'fragmenting'; }
  else if (/subsonic_heavy|crush/.test(fam) || ch === 'crushing') { costMul = 1.2; exitMul = 0.55; retainBias = 0.25; channel = 'crushing'; }
  else if (/controlled_fragment|barrier_blind/.test(fam)) { costMul = 1.2; exitMul = 0.75; retainBias = 0.1; channel = 'controlled'; }
  if (profile && profile.exitWoundMul != null) exitMul *= profile.exitWoundMul;
  return { costMul, exitMul, retainBias, channel, fam };
}
// 출혈 분류 — 깊이 + 부위 + 주소
// SIDE-MEDICAL-TRAUMA-BRIDGE-1 §4: 결정형 피격/방호 주소 → 의료 표준 필드 번역 (snake_case 새 주소 대응 + legacy alias)
function resolveBodyDepth(br, mods, penBefore) {
  const cost = br.cost * mods.costMul;
  const skinEntry = 3;
  let depth, bodyEntered = false, deepTissue = false, exitWound = false, retained = false, nearExit = false, bttt = false;
  if (penBefore < skinEntry) { depth = 'surface_only'; }
  else {
    bodyEntered = true;
    const penAfter0 = penBefore - cost;
    if (penAfter0 <= 0) {
      if (penBefore < cost * 0.5) { depth = 'shallow_entry'; }
      else { depth = 'deep_penetration'; deepTissue = true; }
      retained = true;
    } else if (penAfter0 < br.exitCost) { depth = 'near_exit_lodged'; deepTissue = true; nearExit = true; retained = true; }
    else { depth = 'body_through_and_through'; deepTissue = true; exitWound = true; bttt = true; }
  }

return { cost, skinEntry, depth, bodyEntered, deepTissue, exitWound, retained, nearExit, bttt, penAfterBody: bttt ? Math.max(0, penBefore - cost) : 0 };
}
return Object.freeze({ BODY_RESISTANCE, _bodyTerminalMods, getCanonicalProjectileProfile, effectivePenetration, computeProjectileKinetics, resolveKineticPenetrationMul, penetrationProbability, rollPenetration, buildResidualThreatAfterHard, canBackerAttemptStop, backerStopChanceGate, backerMitigationFactor, computeBackerResolution, applyHelmetArmorPenalty, getDurabilityArmorMul, getArmorLocalZoneMul, computeArmorDurabilityDamage, applyArmorLocalZoneDamage, ARMOR_ZONE_NEIGHBORS, resolveBodyDepth, computeRicochetHint });
}
