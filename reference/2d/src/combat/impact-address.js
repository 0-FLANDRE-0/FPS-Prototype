// 2A-1: impactAddress + armorCoverageProfile 시스템
//   기존 rollHitLocation / rollProtection 결과를 "설명 가능한 피격주소"로 포장.
//   피해 판정을 대체하지 않고, debug/AAR/UI/후속 woundTrack 기반을 만든다.
// =============================================================

// plate id → plateShape 매핑
const PLATE_SHAPE_MAP = {
  // 서방 SAPI형
  plate_sapi:'sapi', plate_esapi:'sapi', plate_xsapi:'sapi',
  plate_highcom_4s17m:'sapi', plate_highcom_4sas7:'sapi',
  plate_hesco_4400:'sapi', plate_hesco_4800:'sapi',
  plate_rma_1155:'sapi', plate_ltc_26605:'sapi',
  plate_highcom_3s9:'sapi', plate_highcom_3s9m:'sapi', plate_rma_1092_gen2:'sapi',
  // 강철 사각/풀컷
  plate_ar500:'rectangular', plate_civ_steel_level3:'rectangular',
  plate_ar500_light:'rectangular', plate_mantis_titanium:'rectangular',
  // PE/하드 민수
  plate_pe_level3:'sapi', plate_civ_pe_level3:'sapi', plate_civ_iiia_hard:'sapi',
  // 소프트 삽입재
  plate_civ_iiia_soft:'soft_insert',
  // 레플리카
  plate_replica_foam_sapi:'sapi', plate_replica_plastic_sapi:'sapi',
  // 러시아 Granit
  plate_granit_br4:'shooter_cut', plate_granit_br5:'shooter_cut',
  plate_granit_side:'side_plate_large',
  // 6B23/6B12 전방 세트 — 6B12 가슴판은 비대칭, Korund는 대칭(shooter_cut)
  plate_6b12:'asym_6b12_chest',
  // Korund 전방 세트 / 후면판 — shooter_cut
  plate_korund_vm_front:'shooter_cut', plate_korund_vm_back:'shooter_cut',
  plate_korund_vm_k_front:'shooter_cut', plate_korund_vm_k_back:'shooter_cut',
  // 측면판
  plate_ssapi:'side_plate_small', plate_esbi:'side_plate_small',
  // SIDE-ARMOR-ADD-COLOSSUS: Colossus 본판 shooter_cut, 측면판 large side plate (sapi fallback 방지)
  plate_colossus:'shooter_cut',
  plate_colossus_side:'side_plate_large',
};

// 6B23 frontSet은 가슴=rounded_swimmer_like, 복부=small_fullcut으로 분리
const PLATE_FRONTSET_ABDOMEN_SHAPE = {
  plate_6b12:'small_fullcut',
  plate_korund_vm_front:'small_fullcut', plate_korund_vm_k_front:'small_fullcut',
};

// plateShape → shapeCoverageTransform (bias 값, 1.0 = 변화 없음)
const PLATE_SHAPE_TRANSFORMS = {
  sapi:                 { hardCoverageBias:1.00, softCoverageBias:1.00, gapCoverageBias:1.00, upperLateralGapBias:1.00, axillaGapBias:1.00, lowerGapBias:1.00, flankGapBias:1.00, groinGapBias:1.00, edgeBias:1.00 },
  shooter_cut:          { hardCoverageBias:0.94, softCoverageBias:1.03, gapCoverageBias:1.10, upperLateralGapBias:1.25, axillaGapBias:1.20, lowerGapBias:1.05, flankGapBias:1.00, groinGapBias:1.00, edgeBias:1.10 },
  swimmer_like:         { hardCoverageBias:0.88, softCoverageBias:1.06, gapCoverageBias:1.20, upperLateralGapBias:1.55, axillaGapBias:1.45, lowerGapBias:1.08, flankGapBias:1.00, groinGapBias:1.00, edgeBias:1.20 },
  rounded_swimmer_like: { hardCoverageBias:0.88, softCoverageBias:1.06, gapCoverageBias:1.20, upperLateralGapBias:1.55, axillaGapBias:1.45, lowerGapBias:1.08, flankGapBias:1.00, groinGapBias:1.00, edgeBias:1.20 },
  rectangular:          { hardCoverageBias:1.06, softCoverageBias:0.98, gapCoverageBias:0.85, upperLateralGapBias:0.75, axillaGapBias:0.85, lowerGapBias:0.90, flankGapBias:1.00, groinGapBias:1.00, edgeBias:0.90 },
  fullcut:              { hardCoverageBias:1.06, softCoverageBias:0.98, gapCoverageBias:0.85, upperLateralGapBias:0.75, axillaGapBias:0.85, lowerGapBias:0.90, flankGapBias:1.00, groinGapBias:1.00, edgeBias:0.90 },
  small_fullcut:        { hardCoverageBias:0.92, softCoverageBias:1.02, gapCoverageBias:1.12, upperLateralGapBias:1.00, axillaGapBias:1.00, lowerGapBias:1.25, flankGapBias:1.15, groinGapBias:1.00, edgeBias:1.12 },
  side_plate_small:     { hardCoverageBias:0.95, softCoverageBias:1.01, gapCoverageBias:1.05, upperLateralGapBias:1.00, axillaGapBias:1.10, lowerGapBias:1.10, flankGapBias:1.10, groinGapBias:1.00, edgeBias:1.05 },
  side_plate_large:     { hardCoverageBias:1.02, softCoverageBias:1.00, gapCoverageBias:0.95, upperLateralGapBias:0.95, axillaGapBias:0.95, lowerGapBias:0.95, flankGapBias:0.90, groinGapBias:1.00, edgeBias:0.98 },
  soft_insert:          { hardCoverageBias:0.00, softCoverageBias:1.30, gapCoverageBias:1.00, upperLateralGapBias:1.00, axillaGapBias:1.00, lowerGapBias:1.00, flankGapBias:1.00, groinGapBias:1.00, edgeBias:1.00 },
  asym_6b12_chest:      { hardCoverageBias:0.90, softCoverageBias:1.04, gapCoverageBias:1.15, upperLateralGapBias:1.40, axillaGapBias:1.35, lowerGapBias:1.06, flankGapBias:1.00, groinGapBias:1.00, edgeBias:1.15 },
};

// 방탄복 본체 soft coverage 성향 (0=없음 ~ 1=넓음). 부위/면별로.
//   softness: plate 밖 영역을 softOnly로 받아내는 능력
//   각 vest는 chest/abdomen front/side/rear별 soft 성향을 가진다.
const VEST_SOFT_PROFILES = {
  // 미니멀 plate carrier — soft 거의 없음, gap 큼
  jpc_test:               { chestFront:0.12, chestSide:0.10, chestRear:0.12, abdomenFront:0.10, abdomenSide:0.08, abdomenRear:0.10, neck:0.0, shoulder:0.05, groin:0.0 },
  airsoft_plate_carrier:  { chestFront:0.12, chestSide:0.10, chestRear:0.12, abdomenFront:0.10, abdomenSide:0.08, abdomenRear:0.10, neck:0.0, shoulder:0.05, groin:0.0 },
  replica_tactical_vest:  { chestFront:0.15, chestSide:0.12, chestRear:0.15, abdomenFront:0.12, abdomenSide:0.10, abdomenRear:0.12, neck:0.0, shoulder:0.08, groin:0.0 },
  // MSV — 중간형, JPC보다 넓은 soft
  msv:                    { chestFront:0.50, chestSide:0.42, chestRear:0.50, abdomenFront:0.48, abdomenSide:0.38, abdomenRear:0.46, neck:0.10, shoulder:0.25, groin:0.10 },
  // IOTV — 넓은 soft coverage
  iotv_test:              { chestFront:0.80, chestSide:0.68, chestRear:0.80, abdomenFront:0.78, abdomenSide:0.60, abdomenRear:0.76, neck:0.30, shoulder:0.45, groin:0.20 },
  // 6B23 — 러시아식 넓은 soft, 측면 약함
  armor_6b23_test:        { chestFront:0.72, chestSide:0.50, chestRear:0.70, abdomenFront:0.68, abdomenSide:0.45, abdomenRear:0.66, neck:0.20, shoulder:0.30, groin:0.15 },
  // 6B45 — 현대 모듈러, 넓은 coverage
  armor_6b45_basic_test:  { chestFront:0.78, chestSide:0.62, chestRear:0.76, abdomenFront:0.74, abdomenSide:0.55, abdomenRear:0.72, neck:0.25, shoulder:0.40, groin:0.18 },
  // Police Vest — soft 전용, hard 없음
  police_vest:            { chestFront:0.50, chestSide:0.42, chestRear:0.50, abdomenFront:0.48, abdomenSide:0.38, abdomenRear:0.46, neck:0.10, shoulder:0.25, groin:0.10 },
};
function getVestSoftProfile(unit) {
  if (!unit) return null;
  return VEST_SOFT_PROFILES[unit.bodyArmorId] || null;
}

// 헬멧 zone별 곡률 multiplier (도탄 힌트용)
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
function locationToImpactPart(location, isLeft) {
  if (!location) return 'chest';
  if (location === 'head_skull')    return 'head';
  if (location === 'head_temporal') return 'head';
  if (location === 'head_face')     return 'face';
  if (location === 'neck')          return 'neck';
  if (location === 'neck_soft')     return 'neck';
  if (location === 'chest')         return 'chest';
  if (location === 'abdomen')       return 'abdomen';
  if (location === 'left_arm')      return 'leftArm';
  if (location === 'right_arm')     return 'rightArm';
  if (location === 'left_leg')      return 'leftLeg';
  if (location === 'right_leg')     return 'rightLeg';
  // legacy 통합형 — isLeft가 주어지면 그대로, 없으면 한 번만 좌우 결정
  if (location === 'arms') return (isLeft != null) ? (isLeft ? 'leftArm' : 'rightArm') : (Math.random() < 0.5 ? 'leftArm' : 'rightArm');
  if (location === 'legs') return (isLeft != null) ? (isLeft ? 'leftLeg' : 'rightLeg') : (Math.random() < 0.5 ? 'leftLeg' : 'rightLeg');
  return location;
}
// aspect → impactSide 정규화
function aspectToImpactSide(aspect) {
  if (!aspect) return 'front';
  if (aspect === 'front') return 'front';
  if (aspect === 'rear')  return 'rear';
  if (aspect === 'left')  return 'left';
  if (aspect === 'right') return 'right';
  if (aspect === 'side')  return 'side';
  return aspect;
}
function normalizeStance(stance) {
  if (!stance) return 'standing';
  if (stance === 'downed') return 'prone';
  if (stance === 'goingProne' || stance === 'gettingUp') return 'crouched';
  return stance;
}

// 현재 피격에 관여한 플레이트 id 선택 (front/rear/side)
function getRelevantPlateId(unit, impactSide) {
  if (!unit) return null;
  if (impactSide === 'rear') return unit.backPlateId || null;
  if (impactSide === 'left' || impactSide === 'right' || impactSide === 'side') return unit.sidePlateId || null;
  return unit.frontPlateId || null;   // front 기본
}
// 2A-6.4-AAR: 해당 부위/방향에 실제 하드 플레이트 슬롯이 존재하는지 (AAR 시각 라벨용. 판정 불변)
//   chest: front/rear/side 플레이트 슬롯
//   abdomen: frontSet(가슴+복부 일체형) 플레이트만 실제 복부 커버. 일반 방탄복(IOTV 등)은 복부 플레이트 없음.
function hasActualPlateCoverage(unit, hitPart, impactSide) {
  if (!unit) return false;
  const pid = getRelevantPlateId(unit, impactSide);
  if (!pid) return false;
  const preset = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[pid] : null;
  if (!preset || preset.isNone) return false;
  if (hitPart === 'chest') return true;
  if (hitPart === 'abdomen') {
    return !!(typeof PLATE_FRONTSET_ABDOMEN_SHAPE !== 'undefined' && PLATE_FRONTSET_ABDOMEN_SHAPE[pid]);
  }
  return false;
}
// =============================================================
// SIDE-ARMOR-2A-REVISED: impactAddress 상세주소 → coverageCandidates → selectedLayer / durabilityOwner
//   기존 hardP/softP/noneP 확률식을 대체하지 않고, 그 위에 "어떤 방호 레이어가 덮는가"를 수집하는 중간 계층.
// =============================================================
// =====================================================================================
// SIDE-ARMOR-DETERMINISTIC-ADDRESS-COVERAGE-1A: 결정형 주소 기반 방호범위 엔진 (foundation)
//   명중주소(buildCoverageImpactAddress 등)는 "탄이 어느 세부주소에 도달했는가"를 결정하고,
//   addressCoverageMap은 "그 주소를 장비가 덮는가"를 확률 없이 결정한다.
//   ※ 이 단계는 엔진 + 데이터 + 검증. 실제 전투 resolveImpact 경로 교체는 검증 후 별도 단계.
// =====================================================================================

// 주소 vocabulary (검증/문서용 — 실제 매칭은 문자열 파트 비교)
const ARMOR_ADDRESS_TAXONOMY = {
  side:    ['front', 'rear', 'left', 'right', 'side', 'top'],
  region:  ['head', 'neck', 'torso', 'limb'],
  hitPart: ['head', 'face', 'neck', 'chest', 'abdomen', 'right_arm', 'left_arm', 'right_leg', 'left_leg'],
  // side 묶음 별칭 (패턴에서 사용)
  groups: {
    sideLike:     ['left', 'right', 'side'],
    headSideLike: ['left', 'right', 'side'],
    armLike:      ['front', 'left', 'right', 'rear', 'side'],
    legLike:      ['front', 'left', 'right', 'rear', 'side'],
  },
};

// 주소 객체 → 점 구분 문자열 키 (단일 생성 규칙 — 함수마다 다르게 만들지 않는다)
function makeArmorAddressKey(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (addr.fullAddress) return addr.fullAddress;
  const side = addr.side || addr.impactSide || 'front';
  const region = addr.region || 'torso';
  const hp = addr.hitPart || '';
  const parts = [side, region, hp, addr.zone, addr.subZone].filter(p => p != null && p !== '');
  return parts.join('.');
}
function getAddressParts(addressKey) {
  const k = (typeof addressKey === 'string') ? addressKey : makeArmorAddressKey(addressKey);
  const a = k.split('.');
  return { side: a[0] || '', region: a[1] || '', hitPart: a[2] || '', zone: a[3] || '', subZone: a[4] || '', _raw: k, _parts: a };
}
// impactAddress 객체를 표준 형태로 정규화 (fullAddress + parts 보장)
function normalizeImpactAddressObject(addr) {
  if (!addr) return null;
  const key = makeArmorAddressKey(addr);
  const p = getAddressParts(key);
  return Object.assign({}, (typeof addr === 'object' ? addr : {}), {
    fullAddress: key, side: p.side, region: p.region, hitPart: p.hitPart, zone: p.zone, subZone: p.subZone,
  });
}
// 한 토큰 매칭 (정확/와일드카드/그룹 별칭). 정규식 난사 없이 단순 비교만.
function _addrTokenMatch(patTok, valTok, sideVal) {
  if (patTok === '*' || patTok === valTok) return true;
  const grp = ARMOR_ADDRESS_TAXONOMY.groups[patTok];   // sideLike/headSideLike/armLike/legLike
  if (grp) return grp.indexOf(sideVal != null ? sideVal : valTok) >= 0;
  return false;
}
// 주소키가 패턴과 매칭되는지. 패턴은 정확/와일드카드/sideLike·headSideLike·armLike·legLike만 지원.
//   끝 토큰이 모자라면(패턴이 더 김) 매칭 실패. 패턴이 짧고 끝이 '*'면 나머지 허용.
function addressMatchesPattern(addressKey, pattern) {
  if (!pattern) return false;
  const a = getAddressParts(addressKey)._parts;
  const pp = pattern.split('.');
  const sideVal = a[0] || '';
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] === '**') return true;   // 나머지 전부 허용 (드물게 사용)
    const valTok = a[i];
    if (valTok == null) {
      // 주소가 패턴보다 짧음 — 패턴 잔여가 전부 '*'면 허용, 아니면 실패
      return pp.slice(i).every(t => t === '*');
    }
    // 첫 토큰(side)은 그룹 별칭 가능, 그 외 토큰의 그룹 별칭은 side 기준이 아니라 자체 비교
    const ok = (i === 0) ? _addrTokenMatch(pp[i], valTok, sideVal)
                         : _addrTokenMatch(pp[i], valTok, (ARMOR_ADDRESS_TAXONOMY.groups[pp[i]] ? sideVal : null));
    if (!ok) return false;
  }
  return true;   // 패턴 토큰을 모두 통과 (주소가 더 길어도 접두 매칭 허용)
}
// addressCoverageMap의 layer 정의 + 매칭된 패턴 → 결정형 candidate
function buildAddressCoverageCandidate(layerDef, addr, ctx) {
  ctx = ctx || {};
  const lt = layerDef.layerType || 'soft';
  const isHard = !!(layerDef.isHard || /hard|plate|shell|frame|slaap/.test(lt) && !/soft|liner|glass/.test(lt));
  return {
    layerId: layerDef.layerId || lt,
    layerType: lt,
    coverageSource: layerDef.coverageSource || layerDef.layerId || lt,
    sourceKind: layerDef.sourceKind || 'vest',
    priority: (layerDef.priority != null) ? layerDef.priority : 50,
    addressKey: makeArmorAddressKey(addr),
    matchedPattern: ctx.matchedPattern || null,
    itemId: ctx.itemId || layerDef.itemId || null,
    itemName: ctx.itemName || layerDef.itemName || null,
    armorValue: (ctx.armorValue != null) ? ctx.armorValue : (layerDef.armorValue || 0),
    material: layerDef.material || (isHard ? 'composite' : 'aramid'),
    softBacker: !!layerDef.softBacker,
    durabilityOwnerId: ctx.durabilityOwnerId || layerDef.durabilityOwnerId || null,
    durabilityOwnerType: layerDef.durabilityOwnerType || lt,
    isHard, isSoft: !isHard && !/glass|none|body/.test(lt),
    isBuiltIn: !!layerDef.isBuiltIn || layerDef.sourceKind === 'builtIn',
    isAccessory: !!layerDef.isAccessory || layerDef.sourceKind === 'accessory',
    isPlate: !!layerDef.isPlate || layerDef.sourceKind === 'plate',
    isHelmet: !!layerDef.isHelmet || layerDef.sourceKind === 'helmet',
    isVisor: !!layerDef.isVisor || /visor/.test(layerDef.sourceKind || ''),
    isSlaap: !!layerDef.isSlaap || layerDef.sourceKind === 'slaap',
    backerEligible: layerDef.backerEligible !== false,
    _visorZoneId: layerDef._visorZoneId || null,
    _zoneDurabilityMaterial: layerDef._zoneDurabilityMaterial || null,
    deterministic: true,
  };
}

// 몸통(torso) 결정형 방호범위 테이블 — 각 방탄복 본체 soft + builtIn (§6). 플레이트/groinGuard는 장착 기준 동적.
//   addresses는 패턴(정확/와일드/sideLike). 주소가 목록에 포함되면 덮음, 없으면 안 덮음(확률 없음).
//   ※ 1A 토르소 범위. 헬멧/바이저/SLAAP/사지는 후속 단계에서 같은 구조로 확장.
const ARMOR_ADDRESS_COVERAGE_TORSO = {
  iotv_test: {
    vestSoft: { armorValue:23, material:'aramid', addresses:[
      '*.torso.chest.upper','*.torso.chest.mid','*.torso.chest.lower',
      'front.torso.abdomen.upper','front.torso.abdomen.lower','rear.torso.abdomen.upper','rear.torso.abdomen.lower','rear.torso.abdomen.kidney_left','rear.torso.abdomen.kidney_right',
      'sideLike.torso.chest.upper_lateral','sideLike.torso.chest.lower_lateral',
      'sideLike.torso.abdomen.upper_flank','sideLike.torso.abdomen.lower_flank',
      'front.torso.chest.clavicle','front.torso.chest.collar_line_left','front.torso.chest.collar_line_right' ] },
  },
  jpc_test: {
    // 짧은 plate carrier — 흉부만. 복부/골반/낭심/옆구리/겨드랑이 비방호.
    vestSoft: { armorValue:8, material:'aramid', addresses:[
      'front.torso.chest.upper','front.torso.chest.mid','front.torso.chest.lower',
      'rear.torso.chest.upper','rear.torso.chest.mid','rear.torso.chest.lower' ] },
  },
  armor_6b23_test: {
    vestSoft: { armorValue:23, material:'aramid', addresses:[
      '*.torso.chest.upper','*.torso.chest.mid','*.torso.chest.lower',
      'front.torso.abdomen.upper','front.torso.abdomen.lower','rear.torso.abdomen.upper','rear.torso.abdomen.lower','rear.torso.abdomen.kidney_left','rear.torso.abdomen.kidney_right',
      'sideLike.torso.chest.upper_lateral','sideLike.torso.chest.lower_lateral',
      'sideLike.torso.abdomen.upper_flank','sideLike.torso.abdomen.lower_flank' ] },
    builtInApron: { armorValue:23, material:'aramid', layerType:'built_in_lower_front_soft', coverageSource:'6b23_lower_front_soft', durabilityOwnerId:'6b23_soft_lower_front', addresses:[
      'front.torso.abdomen.lower','front.torso.abdomen.pelvis.pelvis_upper',
      'front.torso.abdomen.groin.groin','front.torso.abdomen.groin.groin_junctional' ] },
    builtInNeck: { armorValue:23, material:'aramid', layerType:'built_in_neck_soft', coverageSource:'6b23_neck_soft', durabilityOwnerId:'6b23_soft_neck', addresses:[
      'front.neck.neck.neck_base','front.neck.neck.throat_lower',
      'front.torso.chest.clavicle','front.torso.chest.supraclavicular',
      'front.torso.chest.collar_line_left','front.torso.chest.collar_line_right' ] },
  },
  armor_6b45_basic_test: {
    vestSoft: { armorValue:23, material:'aramid', addresses:[
      '*.torso.chest.upper','*.torso.chest.mid','*.torso.chest.lower',
      'front.torso.abdomen.upper','front.torso.abdomen.lower','rear.torso.abdomen.upper','rear.torso.abdomen.lower','rear.torso.abdomen.kidney_left','rear.torso.abdomen.kidney_right',
      'sideLike.torso.chest.upper_lateral','sideLike.torso.chest.lower_lateral',
      'sideLike.torso.abdomen.upper_flank','sideLike.torso.abdomen.lower_flank',
      'front.torso.chest.clavicle','front.torso.chest.supraclavicular' ] },
  },
  msv: {
    vestSoft: { armorValue:20, material:'aramid', addresses:[
      'front.torso.chest.upper','front.torso.chest.mid','front.torso.chest.lower',
      'rear.torso.chest.upper','rear.torso.chest.mid','rear.torso.chest.lower',
      'front.torso.abdomen.upper','front.torso.abdomen.lower','rear.torso.abdomen.upper',
      'sideLike.torso.chest.upper_lateral','sideLike.torso.abdomen.upper_flank' ] },
  },
  police_vest: {
    vestSoft: { armorValue:16, material:'aramid', addresses:[
      'front.torso.chest.upper','front.torso.chest.mid','front.torso.chest.lower',
      'rear.torso.chest.upper','rear.torso.chest.mid','rear.torso.chest.lower',
      'front.torso.abdomen.upper','rear.torso.abdomen.upper' ] },
    fixedHard: { armorValue:0, material:'aluminum', layerType:'fixed_hard', coverageSource:'police_fixed_aluminum', addresses:[
      'front.torso.chest.upper','front.torso.chest.mid','front.torso.chest.lower',
      'rear.torso.chest.upper','rear.torso.chest.mid','rear.torso.chest.lower' ] },
  },
  airsoft_plate_carrier: { vestSoft: { armorValue:0, material:'fabric', ballisticProtection:false, addresses:['front.torso.chest.upper','front.torso.chest.mid','rear.torso.chest.upper'] } },
  replica_tactical_vest:  { vestSoft: { armorValue:0, material:'fabric', ballisticProtection:false, addresses:['front.torso.chest.upper','front.torso.chest.mid'] } },
};
// === 머리/얼굴 결정형 방호범위 (§11~14) ===
// 헬멧 cut type별 head 주소 (face는 헬멧 shell 비방호 — 바이저 담당)
const HELMET_CUT_ADDRESS = {
  high_cut: ['front.head.head.forehead','front.head.head.crown_front','top.head.head.crown','rear.head.head.occipital'],
  mid_cut: ['front.head.head.forehead','front.head.head.crown_front','top.head.head.crown','rear.head.head.occipital','left.head.head.temporal','right.head.head.temporal','side.head.head.temporal'],
  standard_cut: ['front.head.head.forehead','front.head.head.crown_front','top.head.head.crown','rear.head.head.occipital','left.head.head.temporal','right.head.head.temporal'],
  full_cut: ['front.head.head.forehead','front.head.head.crown_front','top.head.head.crown','rear.head.head.occipital','rear.head.head.nape_shell','left.head.head.temporal','right.head.head.temporal','side.head.head.temporal','left.head.head.ear','right.head.head.ear','side.head.head.ear'],
  full_face_shell: ['front.head.head.forehead','front.head.head.crown_front','top.head.head.crown','rear.head.head.occipital','rear.head.head.nape_shell','left.head.head.temporal','right.head.head.temporal','side.head.head.temporal','left.head.head.ear','right.head.head.ear','side.head.head.ear'],
  bump: ['front.head.head.forehead','front.head.head.crown_front','top.head.head.crown','rear.head.head.occipital'],
  replica: ['front.head.head.forehead','top.head.head.crown'],
};
// 헬멧 id → cut type (preset.helmetCoverageType 우선, 없으면 매핑)
const HELMET_CUT_BY_ID = {
  mich_test:'standard_cut', helmet_6b47_test:'mid_cut', helmet_6b47m:'mid_cut', fast_mt:'high_cut',
  ech:'standard_cut', k6_3:'full_face_shell', lshz_light:'bump',
};
function getHelmetCutType(helmetId) {
  const hp = (typeof HELMET_PRESETS !== 'undefined') ? HELMET_PRESETS[helmetId] : null;
  return (hp && (hp.helmetCoverageType || hp.cutType)) || HELMET_CUT_BY_ID[helmetId] || 'standard_cut';
}
// 비탄도(bump/replica) 헬멧
const HELMET_NONBALLISTIC = { lshz_light:false };   // lshz_light는 탄도(경량). 진짜 replica/bump 헬멧만 false.
function helmetIsBallistic(helmetId) {
  const hp = (typeof HELMET_PRESETS !== 'undefined') ? HELMET_PRESETS[helmetId] : null;
  if (hp && hp.ballisticProtection === false) return false;
  const cut = getHelmetCutType(helmetId);
  return !(cut === 'replica');
}
// 바이저 glass/frame 주소 (§13). K6-3는 frame이 brow/jaw/cheek, glass가 eyes/nose/cheek/mouth.
const VISOR_GLASS_ADDRESS = ['front.head.face.upper.eyes','front.head.face.upper.brow','front.head.face.mid.nose','front.head.face.mid.cheek_left','front.head.face.mid.cheek_right','front.head.face.lower.mouth','front.head.face.lower.jaw','left.head.face.cheek','right.head.face.cheek'];
const VISOR_K6_GLASS_ADDRESS = ['front.head.face.upper.eyes','front.head.face.mid.nose','front.head.face.mid.cheek_left','front.head.face.mid.cheek_right','front.head.face.lower.mouth'];
const VISOR_K6_FRAME_ADDRESS = ['front.head.face.upper.brow','front.head.face.lower.jaw','left.head.face.cheek','right.head.face.cheek'];
// SLAAP hard overlay 주소 (§14) — 이마/전두부만
const SLAAP_ADDRESS = ['front.head.head.forehead','front.head.head.crown_front','front.head.face.upper.brow'];
// neckGuard 주소 (§8)
const NECKGUARD_ADDRESS = ['front.neck.neck.neck_base','front.neck.neck.throat_lower','front.torso.chest.clavicle','front.torso.chest.supraclavicular','front.torso.chest.collar_line_left','front.torso.chest.collar_line_right'];
const NECKGUARD_SIDE_ADDRESS = ['left.neck.neck.side_neck','right.neck.neck.side_neck'];
const NECKGUARD_NAPE_ADDRESS = ['rear.neck.neck.nape'];
// shoulderGuard 주소 (§7) — deltoid + 상완 근위 외측. axilla_gap/proximal_inner 제외.
const SHOULDERGUARD_ADDRESS = ['armLike.limb.*.shoulder.deltoid_front','armLike.limb.*.shoulder.deltoid_outer','armLike.limb.*.shoulder.deltoid_rear','armLike.limb.*.upper_arm.proximal_outer'];

// 하드 플레이트가 덮는 torso 주소 (장착 시). frontSet는 복부까지 확장.
const PLATE_ADDRESS_CHEST_FRONT = ['front.torso.chest.upper','front.torso.chest.mid','front.torso.chest.lower'];
const PLATE_ADDRESS_CHEST_REAR  = ['rear.torso.chest.upper','rear.torso.chest.mid','rear.torso.chest.lower'];
const PLATE_ADDRESS_SIDE_CORE   = ['sideLike.torso.chest.side_core.side_plate_core'];
const PLATE_ADDRESS_FRONTSET_ABD= ['front.torso.abdomen.upper','front.torso.abdomen.lower','front.torso.abdomen.pelvis.pelvis_upper'];
// groinGuard가 덮는 주소 (§9). femoral은 메타(thighFlap/femoralCoverage/inguinalWing) 있을 때만.
const GROINGUARD_ADDRESS_BASE = ['front.torso.abdomen.lower','front.torso.abdomen.pelvis.pelvis_upper','front.torso.abdomen.groin.groin','front.torso.abdomen.groin.groin_junctional'];
const GROINGUARD_ADDRESS_FEMORAL = ['front.limb.left_leg.femoral_triangle','front.limb.right_leg.femoral_triangle','legLike.limb.*.upper_thigh.proximal_inner'];

// 결정형 후보 수집 — addressCoverageMap에서 주소 패턴이 매칭되는 layer만 candidate로 (확률 없음).
function collectDeterministicCoverageCandidates(unit, addr) {
  const out = [];
  if (!unit) return out;
  const _accNone = (id) => { if (!id) return true; const a = (typeof PROTECTION_ACCESSORY_PRESETS!=='undefined'&&PROTECTION_ACCESSORY_PRESETS[id]) || (typeof ARMOR_ACCESSORY_PRESETS!=='undefined'&&ARMOR_ACCESSORY_PRESETS[id]) || (typeof HELMET_ACCESSORY_PRESETS!=='undefined'&&HELMET_ACCESSORY_PRESETS[id]) || null; return !!(a && a.isNone); };
  const key = makeArmorAddressKey(addr);
  const parts = getAddressParts(key);
  const preset = (typeof BODY_ARMOR_PRESETS !== 'undefined') ? BODY_ARMOR_PRESETS[unit.bodyArmorId] : null;
  const plateSlots = (preset && preset.plateSlots) || {};
  const accSlots = (preset && preset.accessorySlots) || {};
  const cov = ARMOR_ADDRESS_COVERAGE_TORSO[unit.bodyArmorId];
  const plateEff = (pid) => { const p = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[pid] : null; if (!p || p.isNone) return 0; return (p.effectiveArmor != null) ? p.effectiveArmor : (p.hardArmor || 0) + (p.backingArmor || 0); };
  const plateName = (pid) => { const p = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[pid] : null; return (p && p.display && p.display.name) || pid; };
  const isFrontSet = (pid) => !!(typeof PLATE_FRONTSET_ABDOMEN_SHAPE !== 'undefined' && PLATE_FRONTSET_ABDOMEN_SHAPE[pid]);
  const matchAny = (addresses) => { for (const pat of (addresses || [])) { if (addressMatchesPattern(key, pat)) return pat; } return null; };
  const push = (layerDef, ctx) => { const mp = matchAny(ctx._addresses || layerDef.addresses); if (mp) out.push(buildAddressCoverageCandidate(layerDef, addr, Object.assign({ matchedPattern: mp }, ctx))); };

  // --- 하드 플레이트 (장착 시) ---
  if (unit.frontPlateId && PLATE_PRESETS[unit.frontPlateId] && !PLATE_PRESETS[unit.frontPlateId].isNone) {
    // ABDOMEN-PLATE-SLOT-1: 가슴판은 흉부 주소만 덮는다.
    push({ layerType:'front_hard_plate', sourceKind:'plate', coverageSource:'front_hard_plate', priority:90, isHard:true, isPlate:true, durabilityOwnerType:'front_hard_plate' },
      { _addresses: PLATE_ADDRESS_CHEST_FRONT, itemId:unit.frontPlateId, itemName:plateName(unit.frontPlateId), armorValue:plateEff(unit.frontPlateId), durabilityOwnerId:(unit.frontPlateId+"_front") });
    // frontSet(복부까지 덮는 세트)이면 복부 플레이트를 별도 레이어로 — 표시/내구도 슬롯 분리.
    //   (복부 피격인데 "전면 플레이트(가슴판)"로 표기되고 가슴판 내구도가 닳던 문제 수정)
    if (isFrontSet(unit.frontPlateId)) {
      push({ layerType:'frontset_abdomen_hard', sourceKind:'plate', coverageSource:'frontset_abdomen_hard', priority:88, isHard:true, isPlate:true, durabilityOwnerType:'frontset_abdomen_hard' },
        { _addresses: PLATE_ADDRESS_FRONTSET_ABD, itemId:unit.frontPlateId, itemName:plateName(unit.frontPlateId) + ' (복부판)', armorValue:plateEff(unit.frontPlateId), durabilityOwnerId:(unit.frontPlateId+"_abdomen_front") });
    }
  }
  if (unit.backPlateId && PLATE_PRESETS[unit.backPlateId] && !PLATE_PRESETS[unit.backPlateId].isNone) {
    push({ layerType:'rear_hard_plate', sourceKind:'plate', coverageSource:'rear_hard_plate', priority:90, isHard:true, isPlate:true, durabilityOwnerType:'rear_hard_plate' },
      { _addresses: PLATE_ADDRESS_CHEST_REAR, itemId:unit.backPlateId, itemName:plateName(unit.backPlateId), armorValue:plateEff(unit.backPlateId), durabilityOwnerId:(unit.backPlateId+"_back") });
  }
  if (plateSlots.side === true && unit.sidePlateId && PLATE_PRESETS[unit.sidePlateId] && !PLATE_PRESETS[unit.sidePlateId].isNone) {
    push({ layerType:'side_hard_plate', sourceKind:'plate', coverageSource:'side_plate', priority:92, isHard:true, isPlate:true, durabilityOwnerType:'side_hard_plate' },
      { _addresses: PLATE_ADDRESS_SIDE_CORE, itemId:unit.sidePlateId, itemName:plateName(unit.sidePlateId), armorValue:plateEff(unit.sidePlateId), durabilityOwnerId:(unit.sidePlateId+"_side") });
  }
  // --- police 고정 하드 ---
  if (cov && cov.fixedHard) push(Object.assign({ sourceKind:'plate', isHard:true, priority:88, durabilityOwnerType:'fixed_hard' }, cov.fixedHard), { durabilityOwnerId: unit.bodyArmorId + '_fixed_hard', armorValue: cov.fixedHard.armorValue });

  // --- detachable groinGuard (accessory, 6B23 제외) ---
  if (accSlots.groinGuard === true && unit.groinGuardId && !_accNone(unit.groinGuardId)) {
    const gp = (typeof ARMOR_ACCESSORY_PRESETS !== 'undefined' && ARMOR_ACCESSORY_PRESETS[unit.groinGuardId]) || null;
    const femoralMeta = gp && (gp.thighFlap || gp.femoralCoverage || gp.inguinalWing);
    push({ layerType:'groin_protector', sourceKind:'accessory', coverageSource:'groin_protector', priority:60, isAccessory:true, material:'aramid', durabilityOwnerType:'groin_protector' },
      { _addresses: GROINGUARD_ADDRESS_BASE.concat(femoralMeta ? GROINGUARD_ADDRESS_FEMORAL : []), itemId:unit.groinGuardId, itemName:(gp && gp.name) || unit.groinGuardId, armorValue:(gp && gp.armorValue) || 18, durabilityOwnerId:unit.groinGuardId });
  }

  // --- 6B23 builtIn (apron + neck) ---
  if (cov && cov.builtInApron) push(Object.assign({ sourceKind:'builtIn', isBuiltIn:true, priority:55 }, cov.builtInApron), { durabilityOwnerId: cov.builtInApron.durabilityOwnerId, armorValue: cov.builtInApron.armorValue });
  if (cov && cov.builtInNeck)  push(Object.assign({ sourceKind:'builtIn', isBuiltIn:true, priority:52 }, cov.builtInNeck),  { durabilityOwnerId: cov.builtInNeck.durabilityOwnerId,  armorValue: cov.builtInNeck.armorValue });

  // --- 본체 vest soft ---
  if (cov && cov.vestSoft) {
    const vs = cov.vestSoft;
    const ballistic = vs.ballisticProtection !== false;
    push({ layerType:'vest_soft', sourceKind:'vest', coverageSource:(unit.bodyArmorId + '_vest_soft'), priority:40, material:vs.material || 'aramid', durabilityOwnerType:'vest_soft' },
      { _addresses: vs.addresses, itemId:unit.bodyArmorId, itemName:(preset && preset.display && preset.display.name) || unit.bodyArmorId, armorValue: ballistic ? (vs.armorValue || 0) : 0, durabilityOwnerId: unit.bodyArmorId });
  }

  // === 머리(head) ===
  if (parts.region === 'head' && parts.hitPart === 'head') {
    // SLAAP hard overlay (이마/전두부) — helmet shell보다 우선
    if (unit.slaapId && !_accNone(unit.slaapId)) {
      const sp = (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined' && PROTECTION_ACCESSORY_PRESETS[unit.slaapId]) || (typeof HELMET_ACCESSORY_PRESETS !== 'undefined' && HELMET_ACCESSORY_PRESETS[unit.slaapId]) || null;
      push({ layerType:'slaap_hard', sourceKind:'slaap', coverageSource:'slaap', priority:96, isHard:true, isSlaap:true, material:'composite', durabilityOwnerType:'slaap_plate' },
        { _addresses: SLAAP_ADDRESS, itemId:unit.slaapId, itemName:(sp && (sp.name||sp.shortName)) || unit.slaapId, armorValue:(sp && (sp.armorValue||sp.hardArmor)) || 20, durabilityOwnerId: unit.slaapId + '_plate' });
    }
    // 헬멧 shell
    if (unit.helmetId && helmetIsBallistic(unit.helmetId)) {
      const hp = HELMET_PRESETS[unit.helmetId];
      const cut = getHelmetCutType(unit.helmetId);
      const shellArmor = (hp && hp.armor && (hp.armor.smallArmor || hp.armor.value)) || (hp && hp.armorValue) || 18;
      push({ layerType:'helmet_shell', sourceKind:'helmet', coverageSource:'helmet_shell', priority:80, isHard:true, isHelmet:true, material:(hp && hp.material) || 'aramid', durabilityOwnerType:'helmet_shell' },
        { _addresses: HELMET_CUT_ADDRESS[cut] || HELMET_CUT_ADDRESS.standard_cut, itemId:unit.helmetId, itemName:(hp && hp.display && hp.display.name) || unit.helmetId, armorValue: shellArmor, durabilityOwnerId: unit.helmetId + '_shell' });
    }
  }
  // === 얼굴(face) — 바이저만 ===
  if (parts.region === 'head' && parts.hitPart === 'face') {
    if (unit.visorId && !_accNone(unit.visorId)) {
      const vp = (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined' && PROTECTION_ACCESSORY_PRESETS[unit.visorId]) || (typeof HELMET_ACCESSORY_PRESETS !== 'undefined' && HELMET_ACCESSORY_PRESETS[unit.visorId]) || null;
      const isK6 = unit.visorId === 'k6_3_visor';
      const vTable = (vp && vp.visorHitTable) || [];
      const vZone = (zid) => vTable.find(z => z.id === zid) || {};
      if (isK6) {
        const tiZ = vZone('titanium'), glZ = vZone('glass');
        // frame (titanium, hard) 우선 후보 + glass 후보 (owner/zone 분리)
        push({ layerType:'visor_frame', sourceKind:'visor_frame', coverageSource:'visor_frame', priority:74, isHard:true, isVisor:true, material:'titanium', durabilityOwnerType:'visor_frame', _visorZoneId:'titanium', _zoneDurabilityMaterial: tiZ.durabilityMaterial || 'titanium' },
          { _addresses: VISOR_K6_FRAME_ADDRESS, itemId:unit.visorId, itemName:(vp && (vp.name||vp.shortName)) || unit.visorId, armorValue:(tiZ.armorValue != null ? tiZ.armorValue : 28), durabilityOwnerId: unit.visorId + '_titanium' });
        push({ layerType:'visor_glass', sourceKind:'visor_glass', coverageSource:'visor_glass', priority:70, isVisor:true, material:(glZ.material || 'pe'), durabilityOwnerType:'visor_glass', _visorZoneId:'glass', _zoneDurabilityMaterial: glZ.durabilityMaterial || 'glass' },
          { _addresses: VISOR_K6_GLASS_ADDRESS, itemId:unit.visorId, itemName:(vp && (vp.name||vp.shortName)) || unit.visorId, armorValue:(glZ.armorValue != null ? glZ.armorValue : 23), durabilityOwnerId: unit.visorId + '_glass' });
      } else {
        push({ layerType:'visor_glass', sourceKind:'visor_glass', coverageSource:'visor_glass', priority:70, isVisor:true, material:'polycarbonate', durabilityOwnerType:'visor_glass', _visorZoneId:'glass', _zoneDurabilityMaterial:'glass' },
          { _addresses: VISOR_GLASS_ADDRESS, itemId:unit.visorId, itemName:(vp && (vp.name||vp.shortName)) || unit.visorId, armorValue:(vp && (vp.armorValue||vp.glassArmor)) || 6, durabilityOwnerId: unit.visorId + '_glass' });
      }
    }
    // SLAAP brow overlap (모델에 따라) — brow는 SLAAP_ADDRESS에 포함
    if (unit.slaapId && !_accNone(unit.slaapId)) {
      const sp = (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined' && PROTECTION_ACCESSORY_PRESETS[unit.slaapId]) || null;
      push({ layerType:'slaap_hard', sourceKind:'slaap', coverageSource:'slaap', priority:96, isHard:true, isSlaap:true, material:'composite', durabilityOwnerType:'slaap_plate' },
        { _addresses: SLAAP_ADDRESS, itemId:unit.slaapId, itemName:(sp && sp.name) || unit.slaapId, armorValue:(sp && (sp.armorValue||sp.hardArmor)) || 20, durabilityOwnerId: unit.slaapId + '_plate' });
    }
  }
  // === 목(neck) — neckGuard / 6B23 builtIn neck / vest collar ===
  if (parts.region === 'neck') {
    // 6B23 builtIn neck (위 builtInNeck은 torso 주소만; neck 주소는 여기서)
    if (cov && cov.builtInNeck) push(Object.assign({ sourceKind:'builtIn', isBuiltIn:true, priority:52 }, cov.builtInNeck), { durabilityOwnerId: cov.builtInNeck.durabilityOwnerId, armorValue: cov.builtInNeck.armorValue });
    // detachable neckGuard
    if (accSlots.neckGuard === true && unit.neckGuardId && !_accNone(unit.neckGuardId)) {
      const ng = (typeof ARMOR_ACCESSORY_PRESETS !== 'undefined' && ARMOR_ACCESSORY_PRESETS[unit.neckGuardId]) || null;
      let addrs = NECKGUARD_ADDRESS.slice();
      if (ng && ng.sideNeck) addrs = addrs.concat(NECKGUARD_SIDE_ADDRESS);
      if (ng && ng.napeCover) addrs = addrs.concat(NECKGUARD_NAPE_ADDRESS);
      push({ layerType:'neck_guard', sourceKind:'accessory', coverageSource:'neck_guard', priority:58, isAccessory:true, material:'aramid', durabilityOwnerType:'neck_guard' },
        { _addresses: addrs, itemId:unit.neckGuardId, itemName:(ng && ng.name) || unit.neckGuardId, armorValue:(ng && ng.armorValue) || 18, durabilityOwnerId: unit.neckGuardId });
    }
  }
  // === 어깨/상완(limb arm) — shoulderGuard ===
  if (parts.region === 'limb' && (parts.hitPart === 'left_arm' || parts.hitPart === 'right_arm')) {
    if (accSlots.shoulderGuard === true && unit.shoulderGuardId && !_accNone(unit.shoulderGuardId)) {
      const sg = (typeof ARMOR_ACCESSORY_PRESETS !== 'undefined' && ARMOR_ACCESSORY_PRESETS[unit.shoulderGuardId]) || null;
      push({ layerType:'shoulder_guard', sourceKind:'accessory', coverageSource:'shoulder_guard', priority:56, isAccessory:true, material:'aramid', durabilityOwnerType:'shoulder_guard' },
        { _addresses: SHOULDERGUARD_ADDRESS, itemId:unit.shoulderGuardId, itemName:(sg && sg.name) || unit.shoulderGuardId, armorValue:(sg && sg.armorValue) || 16, durabilityOwnerId: unit.shoulderGuardId });
    }
  }
  // === 다리(limb leg) — 기본 비방호. groinGuard femoral은 위 torso 블록에서 메타 조건부 처리됨(주소가 limb leg면 여기 collect엔 안 옴) ===
  if (parts.region === 'limb' && (parts.hitPart === 'left_leg' || parts.hitPart === 'right_leg')) {
    // groinGuard femoral fringe (메타 있을 때만)
    if (accSlots.groinGuard === true && unit.groinGuardId) {
      const gp = (typeof ARMOR_ACCESSORY_PRESETS !== 'undefined' && ARMOR_ACCESSORY_PRESETS[unit.groinGuardId]) || null;
      if (gp && (gp.thighFlap || gp.femoralCoverage || gp.inguinalWing)) {
        push({ layerType:'groin_protector', sourceKind:'accessory', coverageSource:'groin_protector_femoral', priority:50, isAccessory:true, material:'aramid', durabilityOwnerType:'groin_protector' },
          { _addresses: GROINGUARD_ADDRESS_FEMORAL, itemId:unit.groinGuardId, itemName:(gp && gp.name) || unit.groinGuardId, armorValue:(gp && gp.armorValue) || 18, durabilityOwnerId: unit.groinGuardId });
      }
    }
  }
  return out;
}

// 결정형 레이어 선택 — §5 우선순위 (확률 roll 없음). 후보 없으면 none(body).
function selectDeterministicCoverageLayer(candidates, addr) {
  if (!candidates || candidates.length === 0) return { selected:null, none:true };
  // priority 내림차순; 동률이면 hard 우선
  const sorted = candidates.slice().sort((a,b) => (b.priority - a.priority) || ((b.isHard?1:0) - (a.isHard?1:0)));
  return { selected: sorted[0], none:false, ranked: sorted };
}
// 결정형 주소의 zone/subZone → 국부손상 localZone (center/edge/upper/lower/side) — 플레이트 엣지/중앙/상하/측면 손상 추적용
function addressZoneToLocalZone(addr) {
  if (!addr) return 'center';
  const z = addr.zone || '', sz = addr.subZone || '', side = addr.side || '';
  if (sz === 'side_plate_core' || z === 'side_core' || /axilla|flank|lateral|side_neck/.test(z) || side === 'left' || side === 'right' || side === 'side') return 'side';
  if (/edge|plate_edge|plate_bottom/.test(sz) || /edge/.test(z)) return 'edge';
  if (z === 'upper' || /upper|forehead|crown_front|throat_upper|supraclavicular|deltoid|shoulder/.test(z) || /upper|brow|eyes/.test(sz)) return 'upper';
  if (z === 'lower' || z === 'groin' || z === 'pelvis' || z === 'abdomen' || /lower|groin|pelvis|jaw|mouth/.test(z) || /lower|groin|jaw|mouth/.test(sz)) return 'lower';
  if (z === 'crown' || z === 'occipital' || /crown|occipital|nape/.test(z)) return 'center';
  return 'center';
}
// 결정형 후보 → protection result (candidateToProtectionResult 재사용 — durability/material 일관)
function deterministicCandidateToProtection(candidate, unit) {
  // === SIDE-MEDICAL-ORGAN-BLEEDING-1 §0: 비방호(신체 직접) = body_none. soft armorValue 0으로 표시하지 않음. 내구도 owner 없음. ===
  const isBodyNone = !candidate
    || candidate.layerType === 'body'
    || candidate.coverageSource === 'body' || candidate.coverageSource === 'none'
    || ((candidate.armorValue || 0) <= 0 && /body|fallback|none/.test(String(candidate.sourceKind || candidate.layerType || '')));
  if (isBodyNone) {
    return { protectionType:'none', protectionTypeKor:'비방호(신체 직접)', armorValue:0, effectiveArmor:0, hardArmor:0, softArmor:0, softBacker:false,
      material:'fabric', hardMaterial:null, softMaterial:null, isHelmet:false,
      deterministicCoverage:true, selectedLayerType:'body', coverageSource:'body_none',
      _coverageLayerType:'body', _coverageOwnerId:null, _coverageOwnerType:null, _coverageDurRatio:1.0, _baseArmor:0 };
  }
  // 하드/소프트는 candidate.isHard로 직접 판정. armorValue는 base — 내구도 열화는 rollProtection이 legacy zone(슬롯)으로 적용(표시와 동일 소스).
  const isHard = !!candidate.isHard;
  const base = candidate.armorValue || 0;
  const ownerId = candidate.durabilityOwnerId || null;
  const r = isHard
    ? { protectionType:'hard', protectionTypeKor:'하드', armorValue:base, hardArmor:base, softArmor:0, softBacker:false,
        material:candidate.material || 'composite', hardMaterial:candidate.material || 'composite', softMaterial:'aramid' }
    : { protectionType:'soft', protectionTypeKor:'소프트', armorValue:base, hardArmor:0, softArmor:base, softBacker:false,
        material:candidate.material || 'aramid', hardMaterial:null, softMaterial:candidate.material || 'aramid' };
  r.effectiveArmor = base;
  r.deterministicCoverage = true;
  r.selectedLayerType = candidate.layerType;
  r.coverageSource = candidate.coverageSource;
  r.sourceKind = candidate.sourceKind;
  r._coverageOwnerId = ownerId;
  r._coverageOwnerType = candidate.durabilityOwnerType || candidate.layerType;
  r._coverageLayerType = candidate.layerType;
  r._coverageDurRatio = 1.0;
  r._baseArmor = base;
  r.isHelmet = !!(candidate.isHelmet || candidate.isVisor || candidate.isSlaap);
  // 바이저 zone (glass/titanium) — 균열/시야손상/분리내구도 추적 + AAR 표시
  if (candidate._visorZoneId) { r._visorZoneId = candidate._visorZoneId; r._visorZoneLabel = candidate._visorZoneId === 'titanium' ? '티타늄부' : '방탄유리'; }
  if (candidate._zoneDurabilityMaterial) r._zoneDurabilityMaterial = candidate._zoneDurabilityMaterial;
  return r;
}
// plate id → rollProtection이 기대하는 _plateMeta (computeBackerResolution용)
function _plateMetaFromPreset(plateId) {
  const p = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[plateId] : null;
  const ps = (p && p.plateSystem) || {};
  return {
    plateId: plateId || null,
    plateRatingMode: ps.ratingMode || 'none',
    plateRequiresSoftBacker: !!ps.requiresSoftBacker,
    plateHasIntegralBacker: !!ps.hasIntegralBacker,
    plateMinBackerArmor: ps.minBackerArmor || 0,
    plateSecondaryBackerMode: ps.secondaryBackerMode || 'none',
    plateBaseSoftArmor: (p && (p.baseSoftArmor || p.backingArmor)) || 0,
    softInsert: false, softInsertId: null,
  };
}
// 결정형 방호 해석 — rollProtection이 기대하는 완전한 shape 반환. 주소 미생성이면 null(legacy fallback).
function rollProtectionAddressCoverage(target, addr) {
  const parts = getAddressParts(makeArmorAddressKey(addr));
  if (!parts.hitPart) return null;   // 주소 자체가 없을 때만 legacy fallback
  const cands = collectDeterministicCoverageCandidates(target, addr);
  const sel = selectDeterministicCoverageLayer(cands, addr);
  const layer = sel.selected;
  const prot = deterministicCandidateToProtection(layer, target);
  prot.impactAddress = normalizeImpactAddressObject(addr);
  prot.candidateLayers = cands;
  prot.selectedLayerType = layer ? layer.layerType : (prot.selectedLayerType || 'body');
  prot.coverageAware = true; prot.deterministicCoverage = true;
  // SIDE-ARMOR-DETERMINISTIC-1A: 국부손상은 legacy zone durability 시스템 사용 (엣지/중앙/상하/측면 추적 + AAR 손상정보)
  const _normAddr = normalizeImpactAddressObject(addr);
  prot._impactSubZone = _normAddr.subZone || _normAddr.zone || null;
  prot._impactZone = _normAddr.zone || null;
  prot._localZoneHint = addressZoneToLocalZone(_normAddr);
  if (layer) {
    // hard 플레이트면 _plateMeta + 백커(하위 soft 후보) 연결 → computeBackerResolution/ICW 정상 작동
    if (prot.protectionType === 'hard' && layer.isPlate) {
      prot._plateMeta = _plateMetaFromPreset(layer.itemId);
      // 백커 = 같은 주소를 덮는 최상위 soft 후보 (vest soft / builtIn)
      const backer = cands.filter(c => c !== layer && !c.isHard && /soft|vest|built_in|liner/.test(c.layerType))
                          .sort((a,b) => (b.priority - a.priority))[0];
      if (backer) {
        const bp = candidateToProtectionResult(backer, target);
        prot.softArmor = bp.armorValue || 0;
        prot.softBacker = !!(prot._plateMeta.plateRequiresSoftBacker || prot._plateMeta.plateHasIntegralBacker);
        prot.softMaterial = bp.material || 'aramid';
        prot._coverageBackerArmor = bp.armorValue || 0;
        prot._coverageBackerMaterial = bp.material || 'aramid';
        prot._coverageBackerOwnerId = backer.durabilityOwnerId || (target.bodyArmorId + '_soft_backer');
        prot._coverageBackerOwnerType = backer.durabilityOwnerType || 'vest_soft';
        prot._coverageBackerLayerType = backer.layerType;
      } else if (prot._plateMeta.plateHasIntegralBacker) {
        prot.softArmor = prot._plateMeta.plateBaseSoftArmor || 0;
        prot.softBacker = true;
      }
    } else if (prot.protectionType === 'hard' && (layer.isHelmet || layer.isSlaap || layer.isVisor)) {
      prot._plateMeta = { plateId:null, plateRatingMode:'standalone', plateRequiresSoftBacker:false, plateHasIntegralBacker:true, plateMinBackerArmor:0, plateSecondaryBackerMode:'limited', plateBaseSoftArmor:0, softInsert:false, softInsertId:null };
    } else {
      prot._plateMeta = { plateId:null, plateRatingMode:'none', plateRequiresSoftBacker:false, plateHasIntegralBacker:false, plateMinBackerArmor:0, plateSecondaryBackerMode:'none', plateBaseSoftArmor:0, softInsert:false, softInsertId:null };
    }
  } else {
    prot._plateMeta = { plateId:null, plateRatingMode:'none', plateRequiresSoftBacker:false, plateHasIntegralBacker:false, plateMinBackerArmor:0, plateSecondaryBackerMode:'none', plateBaseSoftArmor:0, softInsert:false, softInsertId:null };
  }
  // === SIDE-MEDICAL-TRAUMA-BRIDGE-HOTFIX-1 §2: deterministic armorHitResult 직접 생성 (legacy_adapter 우회) ===
  prot.armorHitResult = {
    sourceModel: 'deterministic_address_coverage', deterministicCoverage: true,
    impactAddress: prot.impactAddress,
    selectedLayerType: prot.selectedLayerType || (layer ? layer.layerType : 'body'),
    coverageSource: prot.coverageSource || (layer ? layer.coverageSource : 'body'),
    durabilityOwnerId: prot._coverageOwnerId || (layer ? layer.durabilityOwnerId : null),
    durabilityOwnerType: prot._coverageOwnerType || (layer ? (layer.durabilityOwnerType || layer.layerType) : 'body'),
    protectionType: prot.protectionType, material: prot.material,
    effectiveArmor: prot.armorValue, armorValue: prot.armorValue,
    localZone: prot._localZoneHint || null,
    visorZoneId: prot._visorZoneId || null,
    armorContact: null,   // resolveImpact가 legacy rich에서 채움
    backerLayerType: prot._coverageBackerLayerType || null,
    backerOwnerId: prot._coverageBackerOwnerId || null,
    backerResult: null, backerResidualPen: null,   // 백커 판정 후 resolveImpact가 채움
    debugNote: (prot.protectionType === 'none') ? 'body_none (신체 직접, 방호 없음)' : (prot._coverageOwnerId ? '' : 'owner missing'),
  };
  return prot;
}

function buildCoverageImpactAddress(unit, hitPart, aspect, opts) {
  // locationToImpactPart는 leftArm/rightLeg(camelCase) 반환 — 결정형 맵 주소(left_arm 등)와 일치시킴
  hitPart = ({ leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' })[hitPart] || hitPart;
  const side = aspectToImpactSide(aspect);
  const region = (hitPart === 'head' || hitPart === 'face') ? 'head' : (hitPart === 'neck') ? 'neck'
    : (hitPart === 'chest' || hitPart === 'abdomen') ? 'torso' : 'limb';
  let zone = null, subZone = null;
  const forcedZone = opts && opts.zone;
  if (hitPart === 'abdomen') {
    if (forcedZone) { zone = forcedZone; subZone = (opts && opts.subZone) || null; }
    else if (side === 'front') {
      const r = Math.random();
      if (r < 0.34) zone = 'upper';
      else if (r < 0.62) zone = 'lower';
      else if (r < 0.77) { zone = 'lower'; subZone = 'groin_adjacent'; }
      else if (r < 0.89) { zone = 'groin'; subZone = 'groin'; }
      else { zone = 'pelvis'; subZone = 'pelvis_upper'; }
    } else if (side === 'rear') {
      // §4: 후복부 — 신장/요부/골반후면 자연 등장
      const r = Math.random();
      if (r < 0.38) zone = 'upper'; else if (r < 0.64) zone = 'lower';
      else if (r < 0.78) zone = 'kidney_left'; else if (r < 0.92) zone = 'kidney_right'; else zone = 'pelvis_rear';
    }
    else {
      // §4: 측복부 — 옆구리(flank) 자연 등장
      const r = Math.random();
      if (r < 0.32) zone = 'upper_flank'; else if (r < 0.56) zone = 'lower_flank';
      else if (r < 0.78) zone = 'upper'; else if (r < 0.90) zone = 'lower'; else zone = 'pelvis';
    }
    if (zone === 'lower' && subZone !== 'groin_adjacent' && Math.random() < 0.30) subZone = 'groin_adjacent';
  } else if (hitPart === 'chest') {
    if (forcedZone) { zone = forcedZone; subZone = (opts && opts.subZone) || null; }
    else if (side === 'left' || side === 'right' || side === 'side') {
      // SIDE-MEDICAL-TRAUMA-BRIDGE-HOTFIX-1 §4: 측흉부 — side_core가 전부 먹지 않게, 옆구리·겨드랑이 자연 등장
      const r = Math.random();
      if (r < 0.52) { zone = 'side_core'; subZone = 'side_plate_core'; }
      else if (r < 0.70) zone = 'upper_lateral';
      else if (r < 0.86) zone = 'lower_lateral';
      else zone = 'axilla_gap';   // 낮은 확률로 겨드랑이 틈 (방호구 없음)
    } else {
      const r = Math.random();
      if (r < 0.56) zone = 'upper';
      else if (r < 0.78) zone = 'lower';
      else if (r < 0.85) zone = 'mid';
      else if (r < 0.91) zone = 'clavicle';
      else if (r < 0.955) zone = 'supraclavicular';
      else zone = (Math.random() < 0.5) ? 'collar_line_left' : 'collar_line_right';
    }
  } else if (hitPart === 'head') {
    // SIDE-ARMOR-DETERMINISTIC-1A: 두개부 세부주소 (명중확률 분포 — 방호는 결정형)
    if (forcedZone) { zone = forcedZone; }
    else if (side === 'rear') { zone = (Math.random() < 0.72) ? 'occipital' : 'nape_shell'; }
    else if (side === 'left' || side === 'right' || side === 'side') { zone = (Math.random() < 0.6) ? 'temporal' : 'ear'; }
    else { const r = Math.random(); zone = (r < 0.5) ? 'forehead' : (r < 0.8 ? 'crown_front' : 'crown'); }
  } else if (hitPart === 'face') {
    if (forcedZone) { zone = forcedZone; subZone = (opts && opts.subZone) || null; }
    else { const r = Math.random();
      if (r < 0.30) { zone = 'upper'; subZone = (Math.random() < 0.6) ? 'eyes' : 'brow'; }
      else if (r < 0.62) { zone = 'mid'; const m = Math.random(); subZone = m < 0.45 ? 'nose' : (m < 0.72 ? 'cheek_left' : 'cheek_right'); }
      else { zone = 'lower'; subZone = (Math.random() < 0.55) ? 'mouth' : 'jaw'; }
    }
  } else if (hitPart === 'neck') {
    if (forcedZone) { zone = forcedZone; }
    else if (side === 'rear') { zone = 'nape'; }
    else if (side === 'left' || side === 'right' || side === 'side') { zone = 'side_neck'; }
    else { const r = Math.random(); zone = r < 0.42 ? 'throat_upper' : (r < 0.72 ? 'throat_lower' : 'neck_base'); }
  } else if (hitPart === 'left_arm' || hitPart === 'right_arm') {
    if (forcedZone) { zone = forcedZone; subZone = (opts && opts.subZone) || null; }
    else { const r = Math.random();
      if (r < 0.30) { zone = 'shoulder'; subZone = (side === 'rear') ? 'deltoid_rear' : (side === 'front' ? 'deltoid_front' : 'deltoid_outer'); }
      else if (r < 0.46) { zone = 'axilla_gap'; }
      else if (r < 0.70) { zone = 'upper_arm'; subZone = (Math.random() < 0.6) ? 'proximal_outer' : 'proximal_inner'; }
      else { zone = 'forearm'; }
    }
  } else if (hitPart === 'left_leg' || hitPart === 'right_leg') {
    if (forcedZone) { zone = forcedZone; subZone = (opts && opts.subZone) || null; }
    else { const r = Math.random();
      if (r < 0.20) { zone = 'upper_thigh'; const m = Math.random(); subZone = m < 0.4 ? 'proximal_front' : (m < 0.7 ? 'proximal_inner' : 'proximal_outer'); }
      else if (r < 0.30) { zone = 'femoral_triangle'; }
      else if (r < 0.62) { zone = 'mid_thigh'; }
      else if (r < 0.78) { zone = 'knee'; }
      else { zone = 'lower_leg'; }
    }
  }
  // head crown은 top 측면, face cheek 측면 보정 (coverage map과 주소 일치)
  let sideAdj = side;
  if (hitPart === 'head' && zone === 'crown') sideAdj = 'top';
  if (hitPart === 'face' && (subZone === 'cheek_left')) { sideAdj = 'left'; subZone = 'cheek'; }
  else if (hitPart === 'face' && (subZone === 'cheek_right')) { sideAdj = 'right'; subZone = 'cheek'; }
  const full = [sideAdj, region, hitPart, zone, subZone].filter(Boolean).join('.');
  return { enabled:true, hitPart, hitDirection:sideAdj, region, side:sideAdj, impactSide:sideAdj, zone, subZone, fullAddress:full, futureMedicalHook:true };
}

// 후보 레이어 생성 — 장비 메타(plateSlots/accessorySlots/6B23/frontSet)와 impactAddress를 읽는다.
// [삭제됨 — 대형 PHASE 8] collectCoverageCandidates: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.

// 후보 중 실제 먼저 맞은 레이어 선택 (priority desc + coverageConfidence roll). 실패 시 fallback.
// [삭제됨 — 대형 PHASE 8] selectCoverageLayer: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.

// 내구도 — durabilityOwnerId 풀 (side plate / groin / 6B23 sub-pool 등) 감소
function applyCoverageDurability(unit, ownerId, ownerType, amount, localZone) {
  if (!unit || !ownerId) return;
  unit.armorCoverageDurability = unit.armorCoverageDurability || {};
  if (unit.armorCoverageDurability[ownerId] == null) {
    // 풀 최대치: 플레이트는 PLATE 내구도, 6B23 sub-pool은 기본값
    let max = 30; const _baseId = ownerId.replace(/_(front|back|side)$/, '');
    if (typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[_baseId] && PLATE_PRESETS[_baseId].durability && PLATE_PRESETS[_baseId].durability.maxDurability != null) max = PLATE_PRESETS[_baseId].durability.maxDurability;
    else if (/^6b23_soft/.test(ownerId)) max = 20;
    unit.armorCoverageDurability[ownerId] = max;
  }
  unit.armorCoverageDurability[ownerId] = Math.max(0, unit.armorCoverageDurability[ownerId] - (amount || 0));
  // SIDE-MEDICAL-TRAUMA-BRIDGE-HOTFIX-1 §3: owner별 국부손상(엣지/중앙/상부/하부/측면) 추적 — owner 분리 유지하며 국부손상 보존
  if (localZone) {
    unit.armorCoverageZones = unit.armorCoverageZones || {};
    const z = (unit.armorCoverageZones[ownerId] = unit.armorCoverageZones[ownerId] || { center:0, edge:0, upper:0, lower:0, side:0, glass:0, frame:0, unknown:0 });
    const key = (z[localZone] != null) ? localZone : 'unknown';
    z[key] += (amount || 0);
  }
  return unit.armorCoverageDurability[ownerId];
}
// owner별 국부손상 맵 조회 (AAR/디버그용)
function getCoverageLocalZones(unit, ownerId) {
  return (unit && unit.armorCoverageZones && unit.armorCoverageZones[ownerId]) || null;
}
// SIDE-ARMOR-DURABILITY-REALISM-1 §12: damageInfo 기반 coverage owner 손상 (고정 amount 대신 공통 계산 결과 사용).
//   NOTE: 결정형 주소 방호가 actual source of truth. applyCoverageDurability는 owner별 내구도 차감을 담당.
// SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §7: [LEGACY/보조 — 메인 피격 경로 미사용]
//   실제 deterministic 피격은 resolveImpact → applyArmorDurabilityDamage()가 target.armorDurability/localZones를 갱신하며,
//   AAR 국부손상 MAP·방호 분석·finalArmor snapshot이 읽는 것도 그 legacy slot 경로다.
//   이 함수(및 resolveArmorCoverage 내 owner-pool 차감)는 coverage-aware 자체검증(validate) 경로 전용이므로 resolveImpact에서 호출하지 않는다.
//   Option B 대비: globalAmount/localAmount/localZone 필드도 읽도록 방어적으로 보강.
function applyCoverageDurabilityDamage(unit, ownerId, ownerType, damageInfo) {
  if (!unit || !ownerId || !damageInfo) return null;
  const globalAmount = damageInfo.globalAmount || damageInfo.amount || 0;
  const localZone = damageInfo.localZone || 'unknown';
  return applyCoverageDurability(unit, ownerId, ownerType, globalAmount, localZone);
}

// SIDE-ARMOR-2B: durabilityOwner 현재 내구도 비율 (1.0 온전 ~ 0.0 파괴). 미지정 1.0.
function getCoverageDurabilityRatio(unit, ownerId) {
  if (!unit || !ownerId) return 1.0;
  let max = null, cur = null;
  if (unit.armorCoverageDurability && unit.armorCoverageDurability[ownerId] != null) {
    cur = unit.armorCoverageDurability[ownerId]; const _baseId = ownerId.replace(/_(front|back|side)$/, '');
    if (typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[_baseId] && PLATE_PRESETS[_baseId].durability && PLATE_PRESETS[_baseId].durability.maxDurability != null) max = PLATE_PRESETS[_baseId].durability.maxDurability;
    else if (/^6b23_soft/.test(ownerId)) max = 20;
    else max = 30;
  }
  if (cur == null || max == null || max <= 0) return 1.0;
  return Math.max(0, Math.min(1, cur / max));
}
// soft 내구도 비율 → armorValue multiplier (기존 soft 곡선과 일관: 1.0→1.0, 0.5→~0.75, 0.0→~0.4)
// SIDE-ARMOR-DURABILITY-REALISM-1 §8/§12: deprecated 공통 곡선 — 재질별 getDurabilityArmorMul로 위임.
//   hard/plate 공통 최저 0.30 제거 (재질 곡선이 0% 잔존을 결정). material 없으면 composite.
function _coverageDurMul(ratio, layerType, material) {
  if (ratio == null) return 1.0;
  const mat = material || (/soft|groin/.test(layerType || '') ? 'aramid' : 'composite');
  return getDurabilityArmorMul(mat, ratio);
}
// coverageCandidate → 실제 protection result (armorValue/material/protectionType/durabilityOwner)
function candidateToProtectionResult(candidate, unit) {
  if (!candidate || candidate.layerType === 'body' || candidate.coverageSource === 'body' || candidate.coverageSource === 'none') {
    return { protectionType:'none', protectionTypeKor:'비방호(신체 직접)', armorValue:0, effectiveArmor:0, hardArmor:0, softArmor:0, softBacker:false,
      material:'fabric', hardMaterial:null, softMaterial:null, _coverageOwnerId:null, _coverageOwnerType:null, _coverageLayerType:'body',
      selectedLayerType:'body', coverageSource:'body_none', deterministicCoverage:true };
  }
  const lt = candidate.layerType;
  const ratio = getCoverageDurabilityRatio(unit, candidate.durabilityOwnerId);
  const eff = Math.max(0, (candidate.armorValue || 0) * _coverageDurMul(ratio, lt, candidate.material));
  const isHard = /hard_plate|frontset_.*_hard/.test(lt);
  if (isHard) {
    return { protectionType:'hard', protectionTypeKor:'하드', armorValue:eff, hardArmor:eff, softArmor:0, softBacker:false,
      material:candidate.material || 'composite', hardMaterial:candidate.material || 'composite', softMaterial:'aramid',
      _coverageOwnerId:candidate.durabilityOwnerId, _coverageLayerType:lt, _coverageDurRatio:ratio, _baseArmor:candidate.armorValue };
  }
  // soft 계열 (groin_protector / built_in_*_soft / side_soft / abdomen_soft)
  return { protectionType:'soft', protectionTypeKor:'소프트', armorValue:eff, hardArmor:0, softArmor:eff, softBacker:false,
    material:candidate.material || 'aramid', hardMaterial:null, softMaterial:candidate.material || 'aramid',
    _coverageOwnerId:candidate.durabilityOwnerId, _coverageLayerType:lt, _coverageDurRatio:ratio, _baseArmor:candidate.armorValue };
}
// SIDE-ARMOR-2C §3: hard special layer 뒤 soft backer 후보 탐색
// [삭제됨 — 대형 PHASE 8] findCoverageBackerCandidate: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.
// coverage-aware protection resolver — 문제 구역(복부 lower/groin, side, groin, 6B23)에서 우선 사용. 그 외 legacy.
const COVERAGE_SPECIAL_LAYERS = ['side_hard_plate','groin_protector','built_in_lower_front_soft','built_in_groin_adjacent_soft','frontset_abdomen_hard','frontset_chest_hard'];
// [삭제됨 — 대형 PHASE 8] rollProtectionCoverageAware: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.
// 통합 — impactAddress → candidates → selectedLayer → armorHitResult (+ 내구도 소모)
// [삭제됨 — 대형 PHASE 8] resolveArmorCoverage: legacy 경로. canonical(rollProtectionAddressCoverage / 실제 woundClusters)로 대체.
// plate id + 부위 → plateShape
function getPlateShape(plateId, hitPart) {
  if (!plateId) return null;
  const preset = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[plateId] : null;
  if (preset && preset.isNone) return null;
  // 복부 + frontSet plate → small_fullcut
  if (hitPart === 'abdomen' && PLATE_FRONTSET_ABDOMEN_SHAPE[plateId]) {
    return PLATE_FRONTSET_ABDOMEN_SHAPE[plateId];
  }
  return PLATE_SHAPE_MAP[plateId] || 'sapi';
}

// transformedCoverage 계산 — baseCoverage(hardP/softP/noneP) + plateShape + vestSoft + accessory
function computeTransformedCoverage(baseCoverage, plateShape, vestSoftProfile, hitPart, impactSide, accessoryCtx) {
  const base = baseCoverage || { hardP: 0, softP: 0, noneP: 1 };
  let hardP = base.hardP || 0;
  let softP = base.softP || 0;
  let noneP = base.noneP != null ? base.noneP : Math.max(0, 1 - hardP - softP);
  const tf = (plateShape && PLATE_SHAPE_TRANSFORMS[plateShape]) || PLATE_SHAPE_TRANSFORMS.sapi;
  // 1) plateShape로 hard 변형 — 깎인 hard는 soft/gap으로 흘러감
  const hardBefore = hardP;
  let hardAfter = hardP * (tf.hardCoverageBias != null ? tf.hardCoverageBias : 1.0);
  const hardDelta = hardBefore - hardAfter;   // 깎여나간 hard 비율 (양수면 hard 감소)
  // 2) 깎인 hard를 vestSoftness에 따라 soft 또는 gap으로 분배
  //    soft 넓은 vest는 softOnly로 받아냄, 빈약하면 unprotectedGap
  let face = 'chestFront';
  if (hitPart === 'abdomen') face = (impactSide === 'rear') ? 'abdomenRear' : (impactSide === 'left' || impactSide === 'right' || impactSide === 'side') ? 'abdomenSide' : 'abdomenFront';
  else if (hitPart === 'chest') face = (impactSide === 'rear') ? 'chestRear' : (impactSide === 'left' || impactSide === 'right' || impactSide === 'side') ? 'chestSide' : 'chestFront';
  const softness = (vestSoftProfile && vestSoftProfile[face] != null) ? vestSoftProfile[face] : 0.3;
  if (hardDelta > 0) {
    const toSoft = hardDelta * softness;
    const toGap = hardDelta * (1 - softness);
    softP += toSoft;
    noneP += toGap;
  } else if (hardDelta < 0) {
    // hard 증가 (rectangular) — gap에서 흡수
    const gain = -hardDelta;
    const fromGap = Math.min(noneP, gain * 0.6);
    const fromSoft = Math.min(softP, gain - fromGap);
    noneP -= fromGap; softP -= fromSoft;
  }
  hardP = hardAfter;
  // 3) softCoverageBias / gapCoverageBias 약하게 적용 (보수적)
  softP *= (1 + (tf.softCoverageBias - 1) * 0.5);
  noneP *= (1 + (tf.gapCoverageBias - 1) * 0.5);
  // 4) accessory — 특정 gap 일부를 soft로 전환 (보수적)
  let accessoryReduced = 0;
  if (accessoryCtx) {
    let gapReduce = 0;
    if (accessoryCtx.hasGroinGuard && hitPart === 'abdomen') gapReduce += noneP * 0.15;
    if (accessoryCtx.hasShoulderGuard && hitPart === 'chest') gapReduce += noneP * 0.10;
    if (accessoryCtx.hasNeckGuard && (hitPart === 'neck' || hitPart === 'chest')) gapReduce += noneP * 0.08;
    if (gapReduce > 0) { noneP -= gapReduce; softP += gapReduce; accessoryReduced = gapReduce; }
  }
  // 5) normalize
  hardP = Math.max(0, hardP); softP = Math.max(0, softP); noneP = Math.max(0, noneP);
  const sum = hardP + softP + noneP;
  if (sum > 0) { hardP /= sum; softP /= sum; noneP /= sum; }
  return {
    hardP, softP, noneP,
    _hardDelta: hardDelta, _softness: softness, _accessoryReduced: accessoryReduced,
    _shapeTransform: tf,
  };
}

// edgeLocation 결정 (plateEdge로 판정된 후 후속 분류)
function pickEdgeLocation(hitPart, impactSide, plateShape) {
  const sideEdges = (impactSide === 'left') ? ['leftSideEdge'] : (impactSide === 'right') ? ['rightSideEdge'] : ['leftSideEdge','rightSideEdge'];
  // 컷 있는 plate는 upperShoulderEdge 비중 ↑
  const hasShoulderCut = (plateShape === 'shooter_cut' || plateShape === 'swimmer_like' || plateShape === 'rounded_swimmer_like' || plateShape === 'sapi');
  if (hitPart === 'abdomen') {
    const pool = ['upperEdge','lowerEdge', ...sideEdges];
    if (plateShape === 'small_fullcut') pool.push('lowerEdge','leftSideEdge','rightSideEdge');
    return pool[Math.floor(Math.random()*pool.length)];
  }
  if (impactSide === 'side' || impactSide === 'left' || impactSide === 'right') {
    const pool = ['upperEdge','lowerEdge','frontEdge','rearEdge'];
    return pool[Math.floor(Math.random()*pool.length)];
  }
  // chest front/rear
  const pool = ['lowerEdge', ...sideEdges];
  if (hasShoulderCut) pool.push('upperShoulderEdge','upperShoulderEdge');
  else pool.push('topFlatEdge');
  return pool[Math.floor(Math.random()*pool.length)];
}

// softLocation 결정
function pickSoftLocation(hitPart, impactSide) {
  if (hitPart === 'abdomen') {
    if (impactSide === 'rear') return rand1(['softRearUpperAbdomen','softRearCenterAbdomen','softRearLowerAbdomen','softRearFlank']);
    if (impactSide === 'side' || impactSide === 'left' || impactSide === 'right') return rand1(['softFlank','sideWrapAbdomen','sideWrapLower','softPelvisSide']);
    // SIDE-HITLOC-COVER-EXPOSURE-1A/1B: half-cover 상호작용별 soft 복부 세부주소
    const exp = _hitCoverExposure;
    if (exp && exp.band) {
      if (exp.kind === 'penetrated') {
        // 관통 후 — 하복부 유지·강조 (제거 금지)
        if (exp.band === 'contact') return rand1(['softLowerAbdomen','softLowerAbdomen','softLowerAbdomen','softCenterAbdomen']);
        if (exp.band === 'near')    return rand1(['softLowerAbdomen','softLowerAbdomen','softCenterAbdomen','softLateralAbdomen']);
        if (exp.band === 'mid')     return rand1(['softLowerAbdomen','softCenterAbdomen','softCenterAbdomen','softUpperAbdomen']);
        // far → 일반
      } else {
        // over — 하복부(softLowerAbdomen) 제거·극소화, 상복부 위주
        if (exp.band === 'contact') return rand1(['softUpperAbdomen','softUpperAbdomen','softUpperAbdomen','softCenterAbdomen']);
        if (exp.band === 'near')    return rand1(['softUpperAbdomen','softUpperAbdomen','softCenterAbdomen','softLateralAbdomen']);
        if (exp.band === 'mid')     return rand1(['softUpperAbdomen','softCenterAbdomen','softCenterAbdomen','softLowerAbdomen','softLateralAbdomen']);
        // far → 일반
      }
    }
    return rand1(['softUpperAbdomen','softCenterAbdomen','softLowerAbdomen','softLateralAbdomen']);
  }
  if (hitPart === 'chest') {
    if (impactSide === 'rear') return rand1(['softRearUpper','softRearCenter','softRearLower','softRearLateral']);
    if (impactSide === 'side' || impactSide === 'left' || impactSide === 'right') return rand1(['sideWrapCenter','sideWrapUpper','sideWrapLower','sideWrapFrontEdge','sideWrapRearEdge']);
    return rand1(['softUpper','softCenter','softLateral','softLower','shoulderCoverage']);
  }
  return 'softGeneral';
}
function rand1(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

// exposedLocation 결정 (plateShape가 컷일수록 lateral/axilla gap 비중 ↑)
function pickExposedLocation(hitPart, impactSide, plateShape) {
  const cutBias = (plateShape === 'shooter_cut' || plateShape === 'swimmer_like' || plateShape === 'rounded_swimmer_like');
  if (hitPart === 'abdomen') {
    if (impactSide === 'rear') return rand1(['rearFlankGap','rearLowerGap','kidneyRearRegion','pelvisRearAdjacent']);
    if (impactSide === 'side' || impactSide === 'left' || impactSide === 'right') return rand1(['flankGap','lowerSideGap','pelvisSideGap','kidneySideRegion']);
    const exp = _hitCoverExposure;
    if (exp && exp.band) {
      if (exp.kind === 'penetrated') {
        // SIDE-HITLOC-COVER-INTERACTION-1B: 관통 후 — 하복부/골반/서혜부 중심 (over와 반대)
        if (exp.band === 'contact') return rand1(['lowerAbdomenExposed','lowerAbdomenExposed','pelvisGroinAdjacent','pelvisGroinAdjacent','centralAbdomenExposed']);
        if (exp.band === 'near')    return rand1(['lowerAbdomenExposed','lowerAbdomenExposed','centralAbdomenExposed','pelvisGroinAdjacent']);
        if (exp.band === 'mid')     return rand1(['lowerAbdomenExposed','centralAbdomenExposed','centralAbdomenExposed','upperAbdomenExposed']);
        // far → 일반 pool
      } else {
        // over: 가까울수록 상복부 위주, 하복부 노출 제한
        if (exp.band === 'contact') return rand1(['upperAbdomenExposed','upperAbdomenExposed','upperAbdomenExposed','centralAbdomenExposed']);
        if (exp.band === 'near')    return rand1(['upperAbdomenExposed','upperAbdomenExposed','upperAbdomenExposed','centralAbdomenExposed','centralAbdomenExposed']);
        if (exp.band === 'mid')     return rand1(['upperAbdomenExposed','upperAbdomenExposed','centralAbdomenExposed','centralAbdomenExposed','lowerAbdomenExposed']);
        // far → 일반 pool
      }
    }
    const pool = ['upperAbdomenExposed','centralAbdomenExposed','lowerAbdomenExposed','flankExposed','pelvisGroinAdjacent'];
    pool.push('lowerAbdomenExposed');   // 복부는 하부 노출이 흔함
    return rand1(pool);
  }
  if (hitPart === 'chest') {
    if (impactSide === 'rear') return rand1(['rearUpperGap','rearLateralGap','rearLowerGap','neckRearAdjacent']);
    if (impactSide === 'side' || impactSide === 'left' || impactSide === 'right') return rand1(['axillaGap','lateralThoraxGap','lowerSideGap','armShoulderGap']);
    const pool = ['upperGap','upperLateralGap','axillaGap','lowerGap','neckAdjacent'];
    if (cutBias) pool.push('upperLateralGap','axillaGap');   // 컷 plate는 상부측면/겨드랑 gap ↑
    return rand1(pool);
  }
  return 'generalGap';
}

// anatomicalZone + organCandidates / structureCandidates 후보 결정
function pickAnatomyCandidates(hitPart, impactSide, coverageZone, subLoc) {
  let anatomicalZone = null, organCandidates = [], structureCandidates = [];
  const sideTag = (impactSide === 'left') ? 'left' : (impactSide === 'right') ? 'right' : null;
  if (hitPart === 'chest') {
    if (coverageZone === 'plateCore' || subLoc === 'softCenter') { anatomicalZone='centralThorax'; organCandidates=['lung','heart','greatVessel']; }
    else if (subLoc === 'upperShoulderEdge' || subLoc === 'upperLateralGap' || subLoc === 'upperGap') { anatomicalZone='upperThorax'; organCandidates=['upperLung','subclavianVessel']; }
    else if (subLoc === 'leftSideEdge') { anatomicalZone='leftLateralThorax'; organCandidates=['leftLung','axillaryVessel']; }
    else if (subLoc === 'rightSideEdge') { anatomicalZone='rightLateralThorax'; organCandidates=['rightLung','axillaryVessel']; }
    else if (subLoc === 'lateralThoraxGap') { anatomicalZone='lateralThorax'; organCandidates=['lung','axillaryVessel']; }
    else if (subLoc === 'axillaGap' || subLoc === 'armShoulderGap') { anatomicalZone='axilla'; organCandidates=['lung','axillaryVessel']; structureCandidates=['shoulderJoint','humerus']; }
    else if (subLoc === 'lowerEdge' || subLoc === 'lowerGap') { anatomicalZone='lowerThorax'; organCandidates=['lowerLung','diaphragm']; }
    else if (subLoc === 'neckAdjacent') { anatomicalZone='upperThorax'; organCandidates=['subclavianVessel','upperLung']; structureCandidates=['clavicle']; }
    else { anatomicalZone='centralThorax'; organCandidates=['lung','heart']; }
    if (!structureCandidates.length) structureCandidates=['rib','sternum'];
  } else if (hitPart === 'abdomen') {
    if (coverageZone === 'plateCore' || subLoc === 'upperEdge' || subLoc === 'upperAbdomenExposed') { anatomicalZone='upperAbdomen'; organCandidates=['liver','stomach','spleen','diaphragm']; }
    else if (subLoc === 'centralAbdomenExposed') { anatomicalZone='centralAbdomen'; organCandidates=['bowel','mesentericVessels','abdominalAorta']; }
    else if (subLoc === 'lowerAbdomenExposed' || subLoc === 'lowerEdge') { anatomicalZone='lowerAbdomen'; organCandidates=['bowel','bladder','pelvicVessels']; }
    else if (subLoc === 'flankExposed' || subLoc === 'flankGap' || subLoc === 'kidneySideRegion' || subLoc === 'leftSideEdge' || subLoc === 'rightSideEdge') {
      // 좌우 flank 구분
      const fz = (sideTag === 'right') ? 'rightFlank' : (sideTag === 'left') ? 'leftFlank' : (Math.random() < 0.5 ? 'leftFlank' : 'rightFlank');
      anatomicalZone = fz;
      organCandidates = (fz === 'rightFlank') ? ['rightKidney','liverSide','abdominalWall'] : ['leftKidney','spleenSide','abdominalWall'];
    }
    else if (subLoc === 'kidneyRearRegion') { anatomicalZone=(sideTag==='right'?'rightFlank':'leftFlank'); organCandidates=['kidney','abdominalWall']; }
    else if (subLoc === 'pelvisGroinAdjacent' || subLoc === 'pelvisSideGap' || subLoc === 'pelvisRearAdjacent') { anatomicalZone='pelvisAdjacent'; organCandidates=['pelvicVessels','femoralVessel','bladder']; structureCandidates=['pelvis']; }
    else { anatomicalZone='centralAbdomen'; organCandidates=['bowel','mesentericVessels']; }
    if (!structureCandidates.length) structureCandidates=['lumbarSpine'];
  } else if (hitPart === 'head') {
    // helmet zone별 세분화 (subLoc = helmetZone)
    if (subLoc === 'helmetFrontUpper' || subLoc === 'slaapFrontUpper') { anatomicalZone='frontalSkull'; organCandidates=['brainFrontalLobe']; }
    else if (subLoc === 'helmetFrontCenter') { anatomicalZone='frontalSkull'; organCandidates=['brainFrontalLobe']; }
    else if (subLoc === 'helmetSideFront' || subLoc === 'slaapSideFrontOverlap') { anatomicalZone='frontTemporal'; organCandidates=['brainTemporalLobe']; structureCandidates=['temporalBone']; }
    else if (subLoc === 'helmetSideCenter') { anatomicalZone='temporalRegion'; organCandidates=['brainTemporalLobe']; structureCandidates=['temporalBone']; }
    else if (subLoc === 'helmetSideRear') { anatomicalZone='parietalOccipital'; organCandidates=['brainOccipitalLobe']; structureCandidates=['parietalBone','occipitalBone']; }
    else if (subLoc === 'helmetTop') { anatomicalZone='cranialVault'; organCandidates=['brain']; structureCandidates=['cranialVault']; }
    else if (subLoc === 'helmetRearCenter' || subLoc === 'helmetRearLower') { anatomicalZone='occipital'; organCandidates=['brainOccipitalLobe','brainstemRisk']; structureCandidates=['occipitalBone']; }
    else if (subLoc === 'helmetLowerEdge') { anatomicalZone='lowerSkullEdge'; organCandidates=['brainstemRisk']; structureCandidates=['skullBase']; }
    else { anatomicalZone='skull'; organCandidates=['brain']; }
    if (!structureCandidates.length) structureCandidates=['skull'];
  } else if (hitPart === 'face') {
    if (subLoc === 'eyes') { anatomicalZone='orbitalRegion'; organCandidates=['eye','vision','frontalBrainRisk']; structureCandidates=['orbitalBone']; }
    else if (subLoc === 'nose') { anatomicalZone='nasalRegion'; organCandidates=['upperAirway']; structureCandidates=['nasalBone']; }
    else if (subLoc === 'mouth' || subLoc === 'jaw' || subLoc === 'lowerFace') { anatomicalZone='lowerFace'; organCandidates=['airway']; structureCandidates=['jaw','facialBone']; }
    else if (subLoc === 'cheekLeft' || subLoc === 'cheekRight') { anatomicalZone='midFace'; organCandidates=['softTissue']; structureCandidates=['facialBone']; }
    else if (subLoc === 'brow') { anatomicalZone='frontalRegion'; organCandidates=['frontalBrainRisk']; structureCandidates=['frontalBone']; }
    else { anatomicalZone='orbitalRegion'; organCandidates=['eye','vision','frontalBrainRisk']; structureCandidates=['facialBone']; }
  } else if (hitPart === 'neck') {
    if (subLoc === 'rearNeck') { anatomicalZone='posteriorNeck'; organCandidates=['spinalCord']; structureCandidates=['cervicalSpine']; }
    else if (subLoc === 'sideNeckLeft' || subLoc === 'sideNeckRight') { anatomicalZone='lateralNeck'; organCandidates=['carotid','jugular']; structureCandidates=['cervicalSpine']; }
    else if (subLoc === 'lowerNeck' || subLoc === 'neckAdjacent') { anatomicalZone='lowerNeck'; organCandidates=['subclavianVessel']; structureCandidates=['clavicle','upperThoraxInlet']; }
    else { anatomicalZone='throat'; organCandidates=['airway','trachea','carotid','jugular']; structureCandidates=['cervicalSpine']; }
  } else if (hitPart === 'leftArm' || hitPart === 'rightArm') {
    if (subLoc === 'forearm' || subLoc === 'forearmProximal' || subLoc === 'forearmDistal') { anatomicalZone='forearm'; organCandidates=['radialVessel']; structureCandidates=['radius','ulna','tendon','muscle']; }
    else if (subLoc === 'elbowJoint') { anatomicalZone='elbow'; organCandidates=[]; structureCandidates=['jointDamageCandidate','bone','tendon']; }
    else if (subLoc === 'shoulderJoint') { anatomicalZone='shoulder'; organCandidates=['axillaryVessel']; structureCandidates=['shoulderJoint','humerus']; }
    else { anatomicalZone='upperArm'; organCandidates=['brachialVessel']; structureCandidates=['humerus','muscle']; }
  } else if (hitPart === 'leftLeg' || hitPart === 'rightLeg') {
    if (subLoc === 'upperInnerThighProximal') { anatomicalZone='femoralRegion'; organCandidates=['femoralVessel']; structureCandidates=['femur','largeMuscle']; }
    else if (subLoc === 'innerThigh') { anatomicalZone='innerThigh'; organCandidates=['femoralVesselDistalBranch']; structureCandidates=['femur','largeMuscle']; }
    else if (subLoc === 'outerThigh' || subLoc === 'thighProximal' || subLoc === 'thighDistal' || subLoc === 'thigh') { anatomicalZone='thigh'; organCandidates=[]; structureCandidates=['femur','largeMuscle']; }
    else if (subLoc === 'kneeJoint') { anatomicalZone='knee'; organCandidates=[]; structureCandidates=['jointDamageCandidate','bone','tendon']; }
    else if (subLoc === 'lowerLeg' || subLoc === 'lowerLegProximal' || subLoc === 'lowerLegDistal') { anatomicalZone='lowerLeg'; organCandidates=['distalVessel']; structureCandidates=['tibia','fibula','muscle']; }
    else { anatomicalZone='thigh'; organCandidates=['femoralVessel']; structureCandidates=['femur','largeMuscle']; }
  }
  return { anatomicalZone, organCandidates, structureCandidates };
}

// 헬멧 zone 결정 (head_skull/head_temporal 피격 시)
function pickHelmetZone(location, impactSide) {
  if (location === 'head_temporal') {
    return (impactSide === 'rear') ? 'helmetSideRear' : 'helmetSideCenter';
  }
  // head_skull
  if (impactSide === 'front') return rand1(['helmetFrontCenter','helmetFrontUpper']);
  if (impactSide === 'rear')  return rand1(['helmetRearCenter','helmetRearLower']);
  if (impactSide === 'side' || impactSide === 'left' || impactSide === 'right') return rand1(['helmetSideFront','helmetSideCenter','helmetSideRear']);
  return rand1(['helmetFrontCenter','helmetTop']);
}
// faceLocation 결정
function pickFaceLocation(impactSide) {
  return rand1(['eyes','nose','mouth','jaw','cheekLeft','cheekRight','brow','lowerFace']);
}
// neckLocation 결정
function pickNeckLocation(impactSide) {
  if (impactSide === 'rear') return 'rearNeck';
  if (impactSide === 'left') return 'sideNeckLeft';
  if (impactSide === 'right') return 'sideNeckRight';
  return rand1(['throat','frontNeck']);
}
// limbLocation 결정
function pickLimbLocation(hitPart) {
  if (hitPart === 'leftArm' || hitPart === 'rightArm') return rand1(['upperArm','forearm','elbowJoint','upperArmProximal','forearmDistal']);
  if (hitPart === 'leftLeg' || hitPart === 'rightLeg') {
    // SIDE-HITLOC-COVER-EXPOSURE-1: half-cover 통과 노출 시 가까울수록 허벅지(상부) 위주, 무릎/하퇴/발 제한
    const exp = _hitCoverExposure;
    if (exp && exp.band) {
      if (exp.kind === 'penetrated') {
        // SIDE-HITLOC-COVER-INTERACTION-1B: 관통 후 — 허벅지/대퇴 중심, 거리 멀수록 무릎/하퇴 분산
        if (exp.band === 'contact') return rand1(['thigh','thighProximal','upperInnerThighProximal','thigh','innerThigh']);
        if (exp.band === 'near')    return rand1(['thigh','thigh','thighProximal','kneeJoint','lowerLeg']);
        if (exp.band === 'mid')     return rand1(['thigh','lowerLeg','kneeJoint','thighProximal','lowerLegDistal']);
        return rand1(['thigh','kneeJoint','lowerLeg','innerThigh','thighProximal','upperInnerThighProximal','lowerLegDistal']);   // far 일반
      }
      // over: 가까울수록 허벅지(상부) 위주, 무릎/하퇴/발 제한
      if (exp.band === 'contact') return rand1(['thighProximal','upperInnerThighProximal','thighProximal','thigh']);
      if (exp.band === 'near')    return rand1(['thighProximal','thigh','thigh','innerThigh','upperInnerThighProximal']);
      if (exp.band === 'mid')     return rand1(['thigh','thighProximal','thigh','innerThigh','kneeJoint','lowerLeg']);
      return rand1(['thigh','thighProximal','kneeJoint','lowerLeg','innerThigh','thigh']);
    }
    return rand1(['thigh','kneeJoint','lowerLeg','innerThigh','thighProximal','upperInnerThighProximal','lowerLegDistal']);
  }
  return null;
}

// ricochetHint 계산 — 헬멧/곡면 hard 보호구에만 보수적으로 적용
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
function buildImpactAddress(unit, hitResult, protectionResult, context) {
  const ctx = context || {};
  const location = (hitResult && hitResult.location) || ctx.location || 'chest';
  const aspect = (hitResult && hitResult.aspect) || ctx.aspect || 'front';
  const protType = (protectionResult && protectionResult.protectionType) || 'none';
  const armorResult = ctx.armorResult || (ctx.penetrated ? 'penetrated' : (protType === 'none' ? 'penetrated' : 'stopped'));
  const ammo = ctx.ammo || null;
  const sourceType = ctx.sourceType || 'bullet';

  const ia = {
    sourceModel: 'legacy_probability_wrapped',
    hitPart: null, impactSide: null, stance: null,
    armorLayer: null, coverageZone: null,
    plateShape: null, plateLocation: null, edgeLocation: null,
    softLocation: null, exposedLocation: null,
    accessoryType: null, accessoryLocation: null,
    helmetZone: null, faceLocation: null, limbLocation: null, neckLocation: null,
    anatomicalZone: null, organCandidates: [], structureCandidates: [],
    armorResult: armorResult, penetrationResult: ctx.penetrated ? 'penetrated' : (protType === 'none' ? 'penetrated' : 'stopped'),
    losAngleDeg: null, ricochetHint: null, spallHint: null, crackHint: null,
    material: (protectionResult && protectionResult.material) || null,
    baseCoverage: null, transformedCoverage: null,
    aarLabel: '', debugLabel: '',
  };
  // 1) 정규화 — arms/legs 좌우는 한 번만 결정하고 _isLeft로 공유
  let isLeftResolved = (ctx.isLeft != null) ? ctx.isLeft : null;
  if (isLeftResolved == null) {
    if (location === 'left_arm' || location === 'left_leg') isLeftResolved = true;
    else if (location === 'right_arm' || location === 'right_leg') isLeftResolved = false;
    else if (location === 'arms' || location === 'legs') isLeftResolved = (Math.random() < 0.5);
  }
  const hitPart = locationToImpactPart(location, isLeftResolved);
  const impactSide = aspectToImpactSide(aspect);
  ia.hitPart = hitPart;
  ia.impactSide = impactSide;
  ia.stance = normalizeStance(unit && unit.stance);
  // 좌우 확정값을 노출 — 호출측(applyDamageEvent)이 동일 isLeft를 쓰도록
  if (hitPart === 'leftArm' || hitPart === 'leftLeg') ia._isLeft = true;
  else if (hitPart === 'rightArm' || hitPart === 'rightLeg') ia._isLeft = false;

  // 2) 보호구 유형 / armorLayer 결정
  const isHelmetSlot = !!(protectionResult && protectionResult.isHelmet);
  const slaapId = unit && unit.slaapId;
  const visorId = unit && unit.visorId;
  // 3) baseCoverage 추출 (getProtectionProfile slot의 hardP/softP)
  let baseCoverage = { hardP: 0, softP: 0, noneP: 1 };
  try {
    const prof = (typeof getProtectionProfile === 'function') ? getProtectionProfile(unit, aspect) : null;
    const slot = prof && prof[location];
    if (slot) {
      const hP = slot.hardP || 0, sP = slot.softP || 0;
      baseCoverage = { hardP: hP, softP: sP, noneP: Math.max(0, 1 - hP - sP) };
    }
  } catch (e) {}
  ia.baseCoverage = baseCoverage;

  // 4) hitPart별 분기
  if (hitPart === 'chest' || hitPart === 'abdomen') {
    const plateId = getRelevantPlateId(unit, impactSide);
    const plateShape = getPlateShape(plateId, hitPart);
    ia.plateShape = plateShape;
    // 2A-6.4-AAR: 해당 부위/방향에 실제 하드 플레이트 슬롯이 존재하는지 (시각 라벨용)
    const actualPlate = hasActualPlateCoverage(unit, hitPart, impactSide);
    ia.plateLocation = (hitPart === 'abdomen')
      ? (impactSide === 'rear' ? 'lowerBackArea' : (impactSide === 'left' || impactSide === 'right' || impactSide === 'side') ? 'abdomenSideArea' : 'lowerAbdomenArea')
      : (impactSide === 'rear') ? 'backPlate'
      : (impactSide === 'left' || impactSide === 'right' || impactSide === 'side') ? 'sidePlate' : 'chestPlate';
    // transformedCoverage
    const vestProf = getVestSoftProfile(unit);
    const accessoryCtx = {
      hasGroinGuard: !!(unit && unit.groinGuardId && unit.groinGuardId !== 'no_groin_guard'),
      hasShoulderGuard: !!(unit && unit.shoulderGuardId && unit.shoulderGuardId !== 'no_shoulder_guard'),
      hasNeckGuard: !!(unit && unit.neckGuardId && unit.neckGuardId !== 'no_neck_guard'),
    };
    ia.transformedCoverage = computeTransformedCoverage(baseCoverage, plateShape, vestProf, hitPart, impactSide, accessoryCtx);
    // coverageZone: 실제 판정(protType) 우선
    if (protType === 'hard') {
      ia.armorLayer = 'hard';
      if (!actualPlate) {
        // 2A-6.4-AAR: 실제 플레이트 슬롯이 없는 부위(예: IOTV 복부 후면)는 plateCore/plateEdge 금지.
        //   판정은 hard로 유지하되, 시각 라벨은 "후면 하부/하복부 방호범위"로 근사 표기.
        ia.coverageZone = (impactSide === 'rear') ? 'rearLowerHardApprox' : 'lowerHardApprox';
        ia._plateApproxNoSlot = true;
      } else {
        // plateCore vs plateEdge — edgeBias 반영 (보수적, edge 비중 ~25%)
        const edgeBias = (ia.transformedCoverage._shapeTransform.edgeBias != null) ? ia.transformedCoverage._shapeTransform.edgeBias : 1.0;
        const edgeProb = Math.min(0.5, 0.22 * edgeBias);
        if (Math.random() < edgeProb) {
          ia.coverageZone = 'plateEdge';
          ia.edgeLocation = pickEdgeLocation(hitPart, impactSide, plateShape);
        } else {
          ia.coverageZone = 'plateCore';
        }
      }
    } else if (protType === 'soft') {
      ia.armorLayer = (plateShape === 'soft_insert') ? 'softInsert' : 'soft';
      ia.coverageZone = (plateShape === 'soft_insert') ? 'softInsert' : 'softOnly';
      ia.softLocation = pickSoftLocation(hitPart, impactSide);
    } else {
      ia.armorLayer = 'unprotected';
      ia.coverageZone = 'unprotectedGap';
      ia.exposedLocation = pickExposedLocation(hitPart, impactSide, plateShape);
    }
    const subLoc = ia.edgeLocation || ia.exposedLocation || ia.softLocation;
    const anat = pickAnatomyCandidates(hitPart, impactSide, ia.coverageZone, subLoc);
    ia.anatomicalZone = anat.anatomicalZone;
    ia.organCandidates = anat.organCandidates;
    ia.structureCandidates = anat.structureCandidates;
  } else if (hitPart === 'head') {
    if (protType === 'hard') {
      ia.armorLayer = 'helmet';
      ia.coverageZone = 'helmetShell';
      ia.helmetZone = pickHelmetZone(location, impactSide);
      // SLAAP overlap — 실제 방호 적용 기준(getAccessoriesForSlot)과 동일하게 판단.
      //   실제 적용: location==='head_skull' && aspect==='front' && slaap 장착 (측면은 실제 미반영)
      const slaapEquipped = slaapId && slaapId !== 'no_slaap';
      const slaapActuallyApplied = !!(slaapEquipped && location === 'head_skull' && aspect === 'front');
      if (slaapActuallyApplied && (ia.helmetZone === 'helmetFrontCenter' || ia.helmetZone === 'helmetFrontUpper')) {
        ia.armorLayer = 'helmetAccessory';
        ia.accessoryType = 'SLAAP';
        ia.coverageZone = 'slaapFrontUpper';
      } else if (slaapEquipped && (ia.helmetZone === 'helmetSideFront' || (location === 'head_skull' && aspect === 'front'))) {
        // 후보였지만 이 zone에는 실제 방호 미반영 — coverageZone은 helmetShell 유지, debug candidate만
        ia._slaapCandidate = true;
      }
    } else {
      ia.armorLayer = (protType === 'soft') ? 'soft' : 'unprotected';
      ia.coverageZone = (protType === 'soft') ? 'helmetLiner' : 'skullExposed';
      ia.helmetZone = pickHelmetZone(location, impactSide);
    }
    const anat = pickAnatomyCandidates(hitPart, impactSide, ia.coverageZone, ia.helmetZone);
    ia.anatomicalZone = anat.anatomicalZone;
    ia.organCandidates = anat.organCandidates;
    ia.structureCandidates = anat.structureCandidates;
  } else if (hitPart === 'face') {
    if (protType === 'hard') {
      ia.armorLayer = 'faceShield';
      // 2A-1: visor zone id 우선 (계산용 material 'pe'와 무관하게 표시/주소 결정)
      const zoneId = protectionResult && protectionResult._visorZoneId;
      const dispMat = (protectionResult && protectionResult._visorDisplayMaterial) || (ia.material || '').toLowerCase();
      const isGlass = (zoneId === 'glass') || dispMat === 'glass' || dispMat === 'polycarbonate';
      const isMetal = (zoneId === 'titanium') || dispMat === 'titanium' || dispMat === 'steel' || dispMat === 'metal';
      if (isGlass) {
        // 유리/시야부 — eyes/brow/nose, crackHint 대상 (계산 material이 pe여도 표시는 glass)
        ia.faceLocation = rand1(['eyes','brow','nose']);
        ia.coverageZone = (dispMat === 'polycarbonate') ? 'glassVisor' : 'eyeGlass';
        ia.durabilityGroupHint = 'visionGlass';
        ia.damageTypeHint = ['crack','shatter','penetration'];
      } else if (isMetal) {
        // 금속 안면판 — 턱/입/볼/하부, ricochetHint 대상
        ia.faceLocation = rand1(['jaw','mouth','cheekLeft','cheekRight','lowerFace']);
        ia.coverageZone = (dispMat === 'steel') ? 'steelFacePlate' : 'titaniumFacePlate';
        ia.durabilityGroupHint = 'facePlate';
        ia.damageTypeHint = ['dent','deformation','penetration'];
      } else {
        ia.faceLocation = pickFaceLocation(impactSide);
        ia.coverageZone = 'faceShieldHard';
        ia.durabilityGroupHint = 'facePlate';
        ia.damageTypeHint = ['dent','penetration'];
      }
    } else if (protType === 'soft') {
      ia.faceLocation = pickFaceLocation(impactSide);
      ia.armorLayer = 'soft'; ia.coverageZone = 'faceSoft';
    } else {
      ia.faceLocation = pickFaceLocation(impactSide);
      ia.armorLayer = 'unprotected'; ia.coverageZone = 'faceExposed';
    }
    const anat = pickAnatomyCandidates(hitPart, impactSide, ia.coverageZone, ia.faceLocation);
    ia.anatomicalZone = anat.anatomicalZone;
    ia.organCandidates = anat.organCandidates;
    ia.structureCandidates = anat.structureCandidates;
  } else if (hitPart === 'neck') {
    ia.neckLocation = pickNeckLocation(impactSide);
    ia.armorLayer = (protType === 'soft') ? 'soft' : (protType === 'hard' ? 'hard' : 'unprotected');
    ia.coverageZone = (protType === 'soft') ? 'softOnly' : (protType === 'hard' ? 'plateCore' : 'unprotectedGap');
    const anat = pickAnatomyCandidates(hitPart, impactSide, ia.coverageZone, ia.neckLocation);
    ia.anatomicalZone = anat.anatomicalZone;
    ia.organCandidates = anat.organCandidates;
    ia.structureCandidates = anat.structureCandidates;
  } else if (hitPart === 'leftArm' || hitPart === 'rightArm' || hitPart === 'leftLeg' || hitPart === 'rightLeg') {
    ia.limbLocation = pickLimbLocation(hitPart);
    ia.armorLayer = (protType === 'soft') ? 'soft' : (protType === 'hard' ? 'hard' : 'unprotected');
    ia.coverageZone = (protType === 'soft') ? 'softOnly' : (protType === 'hard' ? 'plateCore' : 'unprotectedGap');
    const anat = pickAnatomyCandidates(hitPart, impactSide, ia.coverageZone, ia.limbLocation);
    ia.anatomicalZone = anat.anatomicalZone;
    ia.organCandidates = anat.organCandidates;
    ia.structureCandidates = anat.structureCandidates;
  } else {
    // fallback
    ia.coverageZone = 'unknown';
    ia.debugLabel = 'legacy hitPart only';
  }

  // 5) ricochetHint (헬멧/곡면 hard)
  ia.ricochetHint = computeRicochetHint(ia, ammo, armorResult);

  // 6) anatomicalClass / junctionClass 분류 (2A-2)
  const cls = classifyImpactAnatomy(ia);
  ia.anatomicalClass = cls.anatomicalClass;
  ia.junctionClass = cls.junctionClass;

  // 2A-6.3: accessory 세부 방호 주소 반영 (shoulder/groin/neck guard)
  if (protectionResult && (protectionResult._accCoverageAddr || protectionResult._accType)) {
    ia.accessoryType = protectionResult._accType || ia.accessoryType;
    ia.accessoryLocation = protectionResult._accCoverageAddr || ia.accessoryLocation;
    ia.anatomicalZone = protectionResult._accCoverageAddr || ia.anatomicalZone;
  }
  // 6B23 기본 목 보호대 — neck 방호가 본체(6B23)에서 온 경우 라벨 구분
  if (location === 'neck' && unit && unit.bodyArmorId === 'armor_6b23_test' && protType !== 'none' && !(protectionResult && protectionResult._accType)) {
    ia.accessoryType = '6b23_builtin_neck';
    ia.accessoryLocation = ia.accessoryLocation || 'lowerNeck';
  }
  // 7) aarLabel / debugLabel
  let zoneDesc = ia.coverageZone || '';
  if (ia.edgeLocation) zoneDesc += '.' + ia.edgeLocation;
  else if (ia.softLocation) zoneDesc += '.' + ia.softLocation;
  else if (ia.exposedLocation) zoneDesc += '.' + ia.exposedLocation;
  else if (ia.helmetZone) zoneDesc += '.' + ia.helmetZone;
  else if (ia.faceLocation) zoneDesc += '.' + ia.faceLocation;
  // accessory 주소가 있으면 zoneDesc에 보조 표기
  if (ia.accessoryLocation) zoneDesc += (zoneDesc ? '|' : '') + ia.accessoryLocation;
  // 사람이 읽는 라벨 (라벨러 사용)
  ia.aarLabel = getImpactAddressLabel(ia);
  // 2A-6.4-AAR: getImpactAddressLabel이 body guard를 이미 한글로 포함하므로 raw 키 중복 append 제거.
  //   SLAAP 등 비-bodyguard accessory만 보조 한글 표기.
  if (ia.accessoryType && ia.accessoryLocation && !isBodyGuardAccessory(ia.accessoryType)) {
    ia.aarLabel += ` · ${getAccessoryZoneLabel(ia.accessoryLocation)}/${getAccessoryTypeLabel(ia.accessoryType)}`;
  }
  ia.debugLabel = `${hitPart}/${impactSide} ${ia.armorLayer}:${zoneDesc}${ia.plateShape ? ' ['+ia.plateShape+']' : ''}`;
  return ia;
}

// AAR 로그 저장 (순환 버퍼)
// =============================================================
