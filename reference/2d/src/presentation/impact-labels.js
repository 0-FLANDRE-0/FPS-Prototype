// 2A-2: impactAddress 라벨러 + 분류 (한국어 표시, UI/AAR/debug 공통)
// =============================================================
const IA_LABELS = {
  hitPart: { head:'머리', face:'안면', neck:'목', chest:'흉부', abdomen:'복부',
    leftArm:'좌완', rightArm:'우완', leftLeg:'좌각', rightLeg:'우각' },
  impactSide: { front:'정면', rear:'후면', left:'좌측', right:'우측', side:'측면', oblique:'경사', omni:'전방위', unknown:'불명' },
  stance: { standing:'직립', crouched:'쪼그림', prone:'엎드림', kneeling:'무릎' },
  armorLayer: { hard:'하드', soft:'소프트', softInsert:'소프트 삽입재', unprotected:'비방호',
    helmet:'헬멧', helmetAccessory:'헬멧 부착물', faceShield:'안면보호구', blast:'폭압' },
  coverageZone: {
    plateCore:'플레이트 중심부', plateEdge:'플레이트 엣지', softOnly:'소프트 단독', softInsert:'소프트 삽입재',
    unprotectedGap:'비방호 노출', helmetShell:'헬멧 외피', helmetLiner:'헬멧 라이너', skullExposed:'두개부 노출',
    slaapFrontUpper:'SLAAP 전면상부', slaapSideFrontOverlap:'SLAAP 측면전방 중첩',
    eyeGlass:'시야 유리부', visionSlitGlass:'시야 슬릿 유리', glassVisor:'폴리카보네이트 바이저', ballisticGlass:'방탄유리',
    titaniumFacePlate:'티타늄 안면판', steelFacePlate:'강철 안면판', metalFacePlate:'금속 안면판', faceShieldHard:'안면 경질부',
    faceSoft:'안면 연질부', faceExposed:'안면 노출', blastArea:'폭압 영역',
    rearLowerHardApprox:'후면 하부 방호범위', lowerHardApprox:'하복부 방호범위' },
  edgeLocation: {
    upperShoulderEdge:'상부-어깨 엣지', topFlatEdge:'상단 엣지', lowerEdge:'하단 엣지',
    leftSideEdge:'좌측 엣지', rightSideEdge:'우측 엣지', upperEdge:'상단 엣지', frontEdge:'전방 엣지', rearEdge:'후방 엣지' },
  softLocation: {
    softUpper:'상부 소프트', softCenter:'중앙 소프트', softLateral:'측면 소프트', softLower:'하부 소프트', shoulderCoverage:'어깨 커버',
    softRearUpper:'후면 상부', softRearCenter:'후면 중앙', softRearLower:'후면 하부', softRearLateral:'후면 측면',
    sideWrapCenter:'측면 랩 중앙', sideWrapUpper:'측면 랩 상부', sideWrapLower:'측면 랩 하부', sideWrapFrontEdge:'측면 랩 전연', sideWrapRearEdge:'측면 랩 후연',
    softUpperAbdomen:'상복부 소프트', softCenterAbdomen:'중복부 소프트', softLowerAbdomen:'하복부 소프트', softLateralAbdomen:'측복부 소프트',
    softFlank:'측복부 소프트', sideWrapAbdomen:'복부 측면 랩', sideWrapLower:'하부 측면 랩', softPelvisSide:'골반 측면 소프트',
    softRearUpperAbdomen:'후복부 상부', softRearCenterAbdomen:'후복부 중앙', softRearLowerAbdomen:'후복부 하부', softRearFlank:'후측복부', softGeneral:'소프트' },
  exposedLocation: {
    upperGap:'상부 노출', upperLateralGap:'상부 측면 노출', axillaGap:'겨드랑이 노출', lowerGap:'하부 노출', neckAdjacent:'목 인접 노출',
    lateralThoraxGap:'측흉부 노출', lowerSideGap:'하측면 노출', armShoulderGap:'팔-어깨 노출',
    rearUpperGap:'후상부 노출', rearLateralGap:'후측면 노출', rearLowerGap:'후하부 노출', neckRearAdjacent:'후경부 인접',
    upperAbdomenExposed:'상복부 노출', centralAbdomenExposed:'중복부 노출', lowerAbdomenExposed:'하복부 노출',
    flankExposed:'측복부 노출', flankGap:'측복부 노출', pelvisGroinAdjacent:'서혜부 인접', kidneySideRegion:'신장 측면부',
    lowerSideGap:'하측면 노출', pelvisSideGap:'골반 측면 노출', rearFlankGap:'후측복부 노출', rearLowerGap:'후하복부 노출',
    kidneyRearRegion:'신장 후면부', pelvisRearAdjacent:'골반 후면 인접', generalGap:'노출부',
    earCoverageGap:'귀/측면 하부 노출', sideLowerHelmetGap:'헬멧 측면 하부 노출' },
  helmetZone: {
    helmetFrontCenter:'전면 중앙', helmetFrontUpper:'전면 상부', helmetSideFront:'측면 전방', helmetSideCenter:'측면 중앙',
    helmetSideRear:'측면 후방', helmetRearCenter:'후면 중앙', helmetRearLower:'후면 하부', helmetTop:'정수리', helmetLowerEdge:'하부 엣지' },
  faceLocation: { eyes:'눈', nose:'코', mouth:'입', jaw:'턱', cheekLeft:'좌측 볼', cheekRight:'우측 볼', brow:'눈썹', lowerFace:'하안면' },
  neckLocation: { throat:'전경부', frontNeck:'전경부', rearNeck:'후경부', sideNeckLeft:'좌경부', sideNeckRight:'우경부', lowerNeck:'하경부', neckAdjacent:'경부 인접' },
  limbLocation: {
    upperArm:'상완부', forearm:'전완부', elbowJoint:'팔꿈치 관절', upperArmProximal:'상완 근위부', forearmDistal:'전완 원위부',
    thigh:'허벅지', kneeJoint:'무릎 관절', lowerLeg:'하퇴부', innerThigh:'허벅지 안쪽', thighProximal:'대퇴 근위부',
    upperInnerThighProximal:'대퇴 내측 근위부(서혜 인접)', lowerLegDistal:'하퇴 원위부' },
  anatomicalZone: {
    centralThorax:'중앙 흉부', upperThorax:'상부 흉부', lateralThorax:'측흉부', leftLateralThorax:'좌측흉부', rightLateralThorax:'우측흉부',
    axilla:'겨드랑이', lowerThorax:'하부 흉부', upperAbdomen:'상복부', centralAbdomen:'중복부', lowerAbdomen:'하복부',
    leftFlank:'좌측복부', rightFlank:'우측복부', pelvisAdjacent:'골반 인접', skull:'두개부', frontalSkull:'전두부',
    frontTemporal:'전측두부', temporalRegion:'측두부', parietalOccipital:'두정후두부', cranialVault:'두개관', occipital:'후두부',
    lowerSkullEdge:'두개 하연', orbitalRegion:'안와부', nasalRegion:'비부', lowerFace:'하안면', midFace:'중안면', frontalRegion:'전두부',
    throat:'전경부', posteriorNeck:'후경부', lateralNeck:'측경부', lowerNeck:'하경부', upperArm:'상완부', forearm:'전완부',
    elbow:'팔꿈치', shoulder:'어깨', thigh:'허벅지', femoralRegion:'대퇴부(서혜 인접)', innerThigh:'허벅지 안쪽', knee:'무릎', lowerLeg:'하퇴부' },
  organ: {
    lung:'폐', leftLung:'좌폐', rightLung:'우폐', upperLung:'상부 폐', lowerLung:'하부 폐', heart:'심장', greatVessel:'대혈관',
    subclavianVessel:'쇄골하동맥', axillaryVessel:'액와동맥', diaphragm:'횡격막', liver:'간', liverSide:'간 측부', stomach:'위',
    spleen:'비장', spleenSide:'비장 측부', bowel:'장', mesentericVessels:'장간막 혈관', abdominalAorta:'복대동맥', bladder:'방광',
    pelvicVessels:'골반 혈관', pelvicVessel:'골반 혈관', kidney:'신장', leftKidney:'좌신장', rightKidney:'우신장', abdominalWall:'복벽',
    femoralVessel:'대퇴혈관', femoralVesselDistalBranch:'대퇴혈관 분지', brachialVessel:'상완동맥', radialVessel:'요골동맥', distalVessel:'원위 혈관', brain:'뇌',
    brainFrontalLobe:'전두엽', brainTemporalLobe:'측두엽', brainOccipitalLobe:'후두엽', brainstemRisk:'뇌간 위험', eye:'안구',
    vision:'시야', frontalBrainRisk:'전두엽 위험', upperAirway:'상기도', airway:'기도', trachea:'기관', carotid:'경동맥',
    jugular:'경정맥', spinalCord:'척수', softTissue:'연부조직' },
  structure: {
    rib:'늑골', sternum:'흉골', lumbarSpine:'요추', pelvis:'골반', clavicle:'쇄골', skull:'두개골', temporalBone:'측두골',
    parietalBone:'두정골', occipitalBone:'후두골', cranialVault:'두개관', skullBase:'두개저', orbitalBone:'안와골', nasalBone:'비골',
    jaw:'턱뼈', facialBone:'안면골', frontalBone:'전두골', cervicalSpine:'경추', upperThoraxInlet:'흉곽 입구',
    humerus:'상완골', radius:'요골', ulna:'척골', tendon:'건', muscle:'근육', femur:'대퇴골', largeMuscle:'대근육',
    tibia:'경골', fibula:'비골', jointDamageCandidate:'관절 손상 후보', bone:'뼈', shoulderJoint:'어깨 관절' },
};
function _lbl(map, key) { if (key == null) return null; return (map && map[key]) || key; }
// 2A-6.4-AAR: 추가보호대 종류/세부존 한글 라벨 (내부 영어 키 노출 방지)
const ACCESSORY_TYPE_LABELS = { groin:'낭심보호대', shoulder:'어깨보호구', neck:'목보호대', '6b23_builtin_neck':'기본 목보호대', SLAAP:'견부 SLAAP' };
const ACCESSORY_ZONE_LABELS = {
  groin:'사타구니', groinAdjacent:'사타구니 인접', pelvisGroinAdjacent:'서혜부 인접', pelvisAdjacent:'골반 인접',
  lowerAbdomenFront:'하복부 전면', lowerAbdomenCenter:'하복부 중앙', lowerAbdomenAdjacent:'하복부 인접', lowerAbdomenExposed:'하복부 노출',
  upperInnerThighProximal:'상부 내측대퇴', sideAbdomen:'측복부', flank:'옆구리', upperAbdomen:'상복부',
  shoulderCap:'어깨 상단', shoulderJoint:'어깨 관절', deltoid:'삼각근', upperArmProximal:'상완 근위부', upperArmDistal:'상완 원위부', axillaAdjacent:'겨드랑이 인접',
  lowerNeck:'목 하단', collarLine:'쇄골선', throatAdjacent:'기도 인접', neckAdjacent:'경부 인접', rearNeck:'후경부',
};
function getAccessoryTypeLabel(t){ return ACCESSORY_TYPE_LABELS[t] || t; }
function getAccessoryZoneLabel(z){ return ACCESSORY_ZONE_LABELS[z] || _lbl(IA_LABELS.exposedLocation,z) || _lbl(IA_LABELS.anatomicalZone,z) || _lbl(IA_LABELS.limbLocation,z) || z; }
function isBodyGuardAccessory(t){ return t==='groin'||t==='shoulder'||t==='neck'||t==='6b23_builtin_neck'; }
function getCoverageZoneLabel(z)  { return _lbl(IA_LABELS.coverageZone, z); }
function getEdgeLocationLabel(z)  { return _lbl(IA_LABELS.edgeLocation, z); }
function getSoftLocationLabel(z)  { return _lbl(IA_LABELS.softLocation, z); }
function getExposedLocationLabel(z){ return _lbl(IA_LABELS.exposedLocation, z); }
function getHelmetZoneLabel(z)    { return _lbl(IA_LABELS.helmetZone, z); }
function getFaceLocationLabel(z)  { return _lbl(IA_LABELS.faceLocation, z); }
function getLimbLocationLabel(z)  { return _lbl(IA_LABELS.limbLocation, z); }
function getNeckLocationLabel(z)  { return _lbl(IA_LABELS.neckLocation, z); }
function getAnatomicalZoneLabel(z){ return _lbl(IA_LABELS.anatomicalZone, z); }
function getOrganLabel(o)         { return _lbl(IA_LABELS.organ, o); }
function getStructureLabel(s)     { return _lbl(IA_LABELS.structure, s); }
function getOrganListLabel(arr)   { return (arr && arr.length) ? arr.map(getOrganLabel).join(', ') : null; }
function getStructureListLabel(arr){ return (arr && arr.length) ? arr.map(getStructureLabel).join(', ') : null; }

// 피격 결과 라벨 (SIDE-ARMOR-2D: ev fallback — impactAddress 내부값 없으면 event/armorHitResult/damageSummary)
function getArmorResultLabel(ia, ev) {
  ia = ia || {};
  let pr = ia.penetrationResult, ar = ia.armorResult;
  if (ev) {
    pr = pr || ev.penetrationResult || (ev.armorHitResult && ev.armorHitResult.penetrationResult);
    ar = ar || ev.armorResult || (ev.armorHitResult && ev.armorHitResult.armorResult);
    if (!pr && !ar && ev.damageSummary) { if (ev.damageSummary.penetrated === true) { pr = 'penetrated'; } else if (ev.damageSummary.penetrated === false) { ar = 'stopped'; } }
  }
  if (pr === 'ricocheted') return '도탄';
  if (ar === 'deflected') return '편향';
  if (pr === 'penetrated' || ar === 'penetrated') return '관통';
  if (pr === 'partial' || pr === 'partial_penetration' || ar === 'partial') return '부분 관통';
  if (ar === 'absorbed') return '폭압 흡수';
  if (ar === 'stopped') return '방호 성공';
  return ar || pr || '';
}
// SIDE-ARMOR-2D: coverage layerType / backer 결과 한글
function _covLayerKo(lt) {
  const M = { side_hard_plate:'측면 하드플레이트', front_hard_plate:'전면 하드플레이트', rear_hard_plate:'후면 하드플레이트',
    frontset_abdomen_hard:'복부 하드플레이트', frontset_abdomen_hard_rear:'후면 복부 하드플레이트', frontset_chest_hard:'frontSet 흉부 하드',
    groin_protector:'낭심보호대', built_in_lower_front_soft:'기본 하부 패널(하복부)', built_in_groin_adjacent_soft:'기본 하부 패널(서혜부)',
    side_soft:'측면 소프트', abdomen_soft:'복부 소프트', chest_soft:'흉부 소프트', body:'무방호' };
  return M[lt] || lt;
}
function _covBackerResultKo(r) { return ({ stopped_residual:'잔여 저지', penetrated:'관통' })[r] || r || ''; }

// === SIDE-AAR-ARMOR-2C: 통합 정규화 — 인체주소 / 방호레이어 / 방호접촉 / coverage근거 분리 ===
// coverageSource raw key → 한글 라벨 (raw는 debugRaw에만)
function _coverageSourceKo(cs) {
  if (!cs) return '';
  const M = {
    frontset_abdomen_upper:'복부 플레이트 상부', frontset_abdomen_hard:'복부 플레이트 중심부/하부',
    front_plate_lower_edge:'전면 플레이트 하단 중첩부', frontset_chest_lower_edge:'흉부 플레이트 하단 중첩부',
    front_hard_plate:'전면 플레이트', rear_hard_plate:'후면 플레이트', side_plate:'측면 플레이트',
    groin_protector:'낭심보호대',
    '6b23_lower_front_soft':'6B23 기본 하부 패널(하복부)', '6b23_groin_adjacent_soft':'6B23 기본 하부 패널(서혜부)',
    '6b23_front_torso_soft':'6B23 전면 토르소 소프트', '6b23_side_soft':'6B23 측면 소프트', '6b23_rear_soft':'6B23 후면 소프트',
    legacy_abdomen_front_soft:'복부 소프트', legacy_chest_front_soft:'흉부 전면 소프트', legacy_chest_side_soft:'흉부 측면 소프트',
    legacy_chest_rear_soft:'흉부 후면 소프트', legacy_abdomen_side_soft:'복부 측면 소프트', legacy_abdomen_rear_soft:'복부 후면 소프트',
    body:'무방호',
  };
  return M[cs] || '';
}
// 방호 접촉부 라벨 — selectedLayerType + 인체 zone/subZone + legacy edge/soft 힌트로 "플레이트 내부 어디"를 한글화
function _armorContactKo(ev, ia) {
  const slt = ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null;
  const ac = ia && ia.armorContact;
  const zone = ia && ia.zone, sub = ia && ia.subZone;
  if (!slt) {
    // legacy-only — plateCore/plateEdge 재해석
    const cz = ac ? ac.legacyCoverageZone : (ia && ia.coverageZone);
    if (cz === 'plateCore') return '플레이트 중심부';
    if (cz === 'plateEdge') { const el = ac ? ac.legacyEdgeLocation : (ia && ia.edgeLocation); return el === 'lowerEdge' ? '플레이트 하단부' : el === 'upperEdge' ? '플레이트 상부' : '플레이트 엣지'; }
    if (cz === 'softCenter' || cz === 'soft') return '소프트아머 중심부';
    return '';
  }
  // frontset 복부 플레이트 — 인체 zone으로 접촉부 구분
  if (slt === 'frontset_abdomen_hard') {
    if (sub === 'pelvis_upper' || zone === 'pelvis') return '복부 플레이트 하단부 / 골반상부 커버';
    if (zone === 'upper') return '복부 플레이트 상부';
    if (zone === 'lower') return '복부 플레이트 중심부/하부';
    return '복부 플레이트 중심부';
  }
  if (slt === 'side_hard_plate') return '측면 플레이트 중심부';
  if (slt === 'front_hard_plate') {
    const cz = ac ? ac.legacyCoverageZone : null;
    if (cz === 'plateEdge') return '전면 플레이트 엣지';
    return '전면 플레이트 중심부';
  }
  if (slt === 'rear_hard_plate') return '후면 플레이트 중심부';
  if (slt === 'groin_protector') return '낭심보호대 중심부';
  if (slt === 'built_in_lower_front_soft') return '기본 하부 패널(하복부)';
  if (slt === 'built_in_groin_adjacent_soft') return '기본 하부 패널(서혜부)';
  if (slt === 'side_soft') return '측면 소프트';
  if (slt === 'abdomen_soft') return '복부 소프트';
  if (slt === 'chest_soft') return '흉부 소프트';
  return _covLayerKo(slt);
}
// 인체 주소 한글 라벨 (fullAddress 기반)
function _bodyAddressKo(ia) {
  if (!ia) return '';
  const sideKo = ({ front:'정면', rear:'후면', left:'좌측', right:'우측', side:'측면' })[ia.impactSide] || '';
  const partKo = ({ chest:'가슴', abdomen:'복부', head:'머리', neck:'목', left_arm:'좌상지', right_arm:'우상지', left_leg:'좌하지', right_leg:'우하지', arms:'상지', legs:'하지' })[ia.hitPart] || (ia.hitPart || '');
  // ADDRESS-LABEL-FIX-1: zone 라벨이 hitPart 구분 없이 upper→'상복부' / lower→'하복부'로 찍혀
  //   흉부(chest) 피격도 "상복부/하복부"로 잘못 표기되던 문제 수정. hitPart별로 분리한다.
  const _zk = (ia.subZone === 'pelvis_upper') ? 'pelvis' : ia.zone;
  const CHEST_ZONE_KO = {
    upper:'흉부 상부', mid:'흉부 중앙', lower:'흉부 하부',
    clavicle:'쇄골', supraclavicular:'쇄골 상부', collar_line_left:'좌측 목빗선', collar_line_right:'우측 목빗선', collar_line:'목빗선',
    axilla_gap:'겨드랑이 틈', axilla:'겨드랑이', upper_lateral:'상부 측흉부', lower_lateral:'하부 측흉부',
    side_core:'측면 중심', side:'측면', side_upper:'측면 상부',
  };
  const ABDOMEN_ZONE_KO = {
    upper:'상복부', mid:'중복부', lower:'하복부', groin:'서혜부', pelvis:'골반부',
    kidney_left:'좌신장부', kidney_right:'우신장부', pelvis_rear:'골반 후면',
    upper_flank:'상부 옆구리', lower_flank:'하부 옆구리', side_core:'측면 중심', side:'측면',
  };
  const zoneKo = (ia.hitPart === 'chest') ? (CHEST_ZONE_KO[_zk] || '')
               : (ia.hitPart === 'abdomen') ? (ABDOMEN_ZONE_KO[_zk] || '')
               : (({ upper:'상부', lower:'하부', mid:'중앙', side_core:'측면 중심', side:'측면' })[_zk] || '');
  const subKo = ia.subZone === 'pelvis_upper' ? '골반 상부' : ia.subZone === 'groin_adjacent' ? '서혜부 인접' : '';
  let head = partKo; if (sideKo) head += ' ' + sideKo;
  const detail = subKo || zoneKo;
  return detail ? `${head.trim()} / ${detail}` : head.trim();
}
// 통합 정규화 뷰
function normalizeImpactForAAR(ev) {
  const ia = ev.impactAddress || (ev.armorHitResult && ev.armorHitResult.impactAddress) || {};
  const isCoverageAware = !!ia.fullAddress;   // ROLLBACK: fullAddress 있는 진짜 coverage 주소만. adapter selectedLayerType는 legacy 표시.
  const slt = ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null;
  const cs = ev.coverageSource || (ev.armorHitResult && ev.armorHitResult.coverageSource) || null;
  const resultKo = ({ penetrated:'관통', stopped:'방호 성공', deflected:'편향/도탄', absorbed:'흡수' })[ev.armorResult] || (ev.armorResult || '');
  let bodyAddressLabel, armorLayerLabel, armorContactLabel, coverageSourceLabel, primaryLabel;
  if (isCoverageAware) {
    bodyAddressLabel = _bodyAddressKo(ia) || (ev.aarLabel || '');
    armorLayerLabel = slt ? _covLayerKo(slt) : '';
    armorContactLabel = _armorContactKo(ev, ia);
    coverageSourceLabel = _coverageSourceKo(cs);
    // 제목: 인체주소 / 방호접촉부 / 결과 (모두 같은 사건을 가리키게)
    primaryLabel = [bodyAddressLabel, armorContactLabel, resultKo].filter(Boolean).join(' / ');
  } else {
    // legacy-only — 기존 라벨 사용
    bodyAddressLabel = (typeof getImpactAddressLabel === 'function') ? getImpactAddressLabel(ia) : '';
    armorLayerLabel = (ia.armorContact && ia.armorContact.legacyArmorLayer) ? _covLayerKo(ia.armorContact.legacyArmorLayer) : '';
    armorContactLabel = _armorContactKo(ev, ia);
    coverageSourceLabel = '';
    primaryLabel = [(ev.aarLabel || bodyAddressLabel), resultKo].filter(Boolean).join(' / ');
  }
  return {
    primaryLabel, bodyAddressLabel, bodyRegionLabel: bodyAddressLabel,
    armorLayerLabel, armorContactLabel, coverageSourceLabel, resultLabel: resultKo,
    isCoverageAware,
    debugRaw: { fullAddress: ia.fullAddress || null, selectedLayerType: slt, coverageSource: cs, durabilityOwnerId: ev.durabilityOwnerId || (ev.armorHitResult && ev.armorHitResult.durabilityOwnerId) || null },
  };
}

// impactAddress → 사람이 읽는 한 줄 라벨 (UI/AAR 공통)
function getImpactAddressLabel(ia, opts) {
  if (!ia) return '';
  const o = opts || {};
  const parts = [];
  const partKor = _lbl(IA_LABELS.hitPart, ia.hitPart);
  const sideKor = _lbl(IA_LABELS.impactSide, ia.impactSide);
  // 주 위치
  let head = partKor || '';
  if (sideKor && ia.hitPart !== 'face') head += ' ' + sideKor;
  parts.push(head.trim());
  // 세부 zone
  // 2A-6.4-AAR: 추가보호대(낭심/어깨/목)가 관여한 경우 — plateCore/plateEdge 대신 보호구 표시
  const bodyGuard = isBodyGuardAccessory(ia.accessoryType);
  let detail = '';
  if (bodyGuard && ia.accessoryLocation) {
    const zlab = getAccessoryZoneLabel(ia.accessoryLocation);
    const glab = getAccessoryTypeLabel(ia.accessoryType);
    detail = [zlab, glab].filter(Boolean).join(' · ');
  } else {
    const zoneKor = getCoverageZoneLabel(ia.coverageZone);
    detail = zoneKor || '';
    const sub = ia.edgeLocation ? getEdgeLocationLabel(ia.edgeLocation)
              : ia.softLocation ? getSoftLocationLabel(ia.softLocation)
              : ia.exposedLocation ? getExposedLocationLabel(ia.exposedLocation)
              : ia.helmetZone ? getHelmetZoneLabel(ia.helmetZone)
              : ia.faceLocation ? getFaceLocationLabel(ia.faceLocation)
              : ia.neckLocation ? getNeckLocationLabel(ia.neckLocation)
              : ia.limbLocation ? getLimbLocationLabel(ia.limbLocation) : null;
    if (sub && sub !== detail) detail += (detail ? ' · ' : '') + sub;
  }
  if (detail) parts.push(detail);
  // 결과
  const res = getArmorResultLabel(ia);
  if (ia.ricochetHint && ia.ricochetHint.ricocheted) parts.push('도탄');
  else if (ia.crackHint && ia.crackHint.eligible) parts.push(ia.crackHint.type === 'shatter' ? '유리 파쇄' : '유리 균열 위험');
  else if (res) parts.push(res);
  // 장기 후보 (옵션)
  if (o.withCandidates && ia.organCandidates && ia.organCandidates.length) {
    parts.push(getOrganListLabel(ia.organCandidates.slice(0,3)) + ' 후보');
  }
  return parts.join(' / ');
}

// === 2A-2: anatomicalClass / junctionClass 분류 ===
//   후속 의료고도화(지혈대 가능여부 등)용 분류. 치료효과는 변경하지 않음.
const JUNCTIONAL_SUBLOCS = new Set([
  'axillaGap','armShoulderGap','shoulderJoint','upperArmProximal',
  'pelvisGroinAdjacent','pelvisSideGap','pelvisRearAdjacent','groinAdjacent','inguinal',
  'hipJoint','upperInnerThighProximal',
  'neckAdjacent','neckRearAdjacent','lowerNeck','collarLine',
]);
const JUNCTIONAL_ZONES = new Set(['axilla','pelvisAdjacent','lowerNeck','shoulder']);
const LIMB_JOINT_SUBLOCS = new Set(['elbowJoint','kneeJoint','wristHand','ankleFoot']);
function classifyImpactAnatomy(ia) {
  let anatomicalClass = 'torso', junctionClass = 'none';
  const hp = ia.hitPart;
  if (hp === 'head') anatomicalClass = 'head';
  else if (hp === 'face') anatomicalClass = 'face';
  else if (hp === 'neck') anatomicalClass = 'neck';
  else if (hp === 'chest' || hp === 'abdomen') anatomicalClass = 'torso';
  else if (hp === 'leftArm' || hp === 'rightArm' || hp === 'leftLeg' || hp === 'rightLeg') anatomicalClass = 'normalLimb';
  // 세부 위치 기반 junction 판정
  const subs = [ia.edgeLocation, ia.softLocation, ia.exposedLocation, ia.limbLocation, ia.neckLocation, ia.anatomicalZone];
  let isJunctional = JUNCTIONAL_ZONES.has(ia.anatomicalZone);
  let isLimbJoint = false;
  for (const s of subs) {
    if (!s) continue;
    if (JUNCTIONAL_SUBLOCS.has(s)) isJunctional = true;
    if (LIMB_JOINT_SUBLOCS.has(s)) isLimbJoint = true;
  }
  // neck 인접 / 어깨·겨드랑 / 서혜·골반 → junctionalArea
  if (isJunctional) { junctionClass = 'junctionalArea'; anatomicalClass = 'junctionalArea'; }
  else if (isLimbJoint) { junctionClass = 'limbJoint'; anatomicalClass = 'limbJoint'; }
  return { anatomicalClass, junctionClass };
}
function getAnatomicalClassLabel(c) {
  return ({ torso:'몸통', head:'머리', face:'안면', neck:'목', normalLimb:'사지', limbJoint:'사지 관절부', junctionalArea:'접합부' })[c] || c;
}
function getJunctionClassLabel(c) {
  return ({ none:'-', limbJoint:'관절부', junctionalArea:'접합부' })[c] || c;
}

// =============================================================
