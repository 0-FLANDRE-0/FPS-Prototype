// SIDE-MED-2B-1A: BodyTrajectoryContext scaffold — 잔여관통 기반 인체 경로 + 출혈 분류 (장기/혈관은 hint만)
// =============================================================
// 부위별 인체저항 (fabric 관통력 단위 근사) + exit skin cost + 분류
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
function _projectileSizeClass(ammo, profile, ev) {
  if (ev && ev.sourceType === 'frag' && ev.isFragment) return 'micro_fragment';
  // SHOTGUN-MED-NORM-1 §11: 의료 메타의 forceProjectileSizeClass 우선 (flechette → sabot_subcaliber). buckshot slug 오분류 방지.
  const pelletMeta = getMedicalProjectileMeta(ammo, ev);
  if (pelletMeta.projectileSizeClass && (pelletMeta.isFlechette || pelletMeta.isBuckshot)) return pelletMeta.projectileSizeClass;
  const fam = (profile && profile.family) || '';
  const cal = (ammo && (ammo.caliberMm || ammo.caliber)) || null;
  const id = (ammo && ammo.id) || (ev && ev.ammoId) || '';
  if (/sabot|flechette/.test(fam) || /sabot|flechette/.test(id)) return 'sabot_subcaliber';
  if (/pdw|4_6|4x30|5_7|5x28/.test(id) || fam === 'pdw_penetrator' || fam === 'pdw_subsonic') return 'small_pdw';
  if (/pellet|buck/.test(id)) return 'pellet';
  if (/slug/.test(id)) return 'shotgun_slug';
  if (/anti_material|large_bore|12_7|127x|338|408|50bmg|50_bmg/.test(id) || fam === 'large_bore_ball' || /anti_material/.test(fam)) return (/ap|heiap|penetrator/.test(fam) ? 'anti_material' : 'large_bore');
  if (/pistol/.test(fam) || /^9mm|^45|^40sw|357|380/.test(id)) return 'pistol';
  // 소총탄 — 구경/탄종으로 intermediate vs full power
  if (/762x51|762x54|308|3006|762nato|m80|m118/.test(id)) return 'full_power_rifle';
  if (/556|545|762x39|300blk|68|grendel|223/.test(id)) return 'intermediate_rifle';
  if (cal != null) { if (cal >= 12) return 'large_bore'; if (cal >= 7) return 'full_power_rifle'; if (cal >= 5) return 'intermediate_rifle'; }
  return 'intermediate_rifle';
}
// projectileSizeClass별 내부 피해 보정 (crush / cavity / bone / exit / retain / overpen)
const _PROJ_SIZE_MODS = {
  micro_fragment:    { crush:0.5, cavity:0.3, bone:0.5, exit:0.3, retain:0.2, overpen:-0.3 },
  pellet:            { crush:0.8, cavity:0.5, bone:0.7, exit:0.6, retain:0.3, overpen:-0.2 },
  small_pdw:         { crush:0.7, cavity:0.7, bone:0.8, exit:0.8, retain:0.05, overpen:0.2 },
  sabot_subcaliber:  { crush:0.6, cavity:0.7, bone:0.85, exit:0.9, retain:0.02, overpen:0.35 },
  pistol:            { crush:1.0, cavity:0.7, bone:0.9, exit:0.9, retain:0.18, overpen:-0.1 },
  intermediate_rifle:{ crush:1.0, cavity:1.1, bone:1.0, exit:1.0, retain:0.06, overpen:0.15 },
  full_power_rifle:  { crush:1.15, cavity:1.35, bone:1.15, exit:1.15, retain:0.05, overpen:0.25 },
  large_bore:        { crush:1.5, cavity:1.4, bone:1.4, exit:1.3, retain:0.12, overpen:0.1 },
  shotgun_slug:      { crush:1.6, cavity:1.2, bone:1.5, exit:1.2, retain:0.2, overpen:-0.1 },
  anti_material:     { crush:1.3, cavity:1.5, bone:1.4, exit:1.4, retain:0.03, overpen:0.5 },
};
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
function normalizeMedicalImpactAddress(addr, ev) {
  addr = addr || {}; ev = ev || {};
  const full = addr.fullAddress || makeArmorAddressKey(addr) || '';
  const side = addr.side || addr.impactSide || '';
  const region = addr.region || '';
  let hitPart = addr.hitPart || ev.hitPart || ev.partKey || ev.location || '';
  hitPart = ({ leftArm:'left_arm', rightArm:'right_arm', leftLeg:'left_leg', rightLeg:'right_leg' })[hitPart] || hitPart;
  const zone = addr.zone || '', sub = addr.subZone || '';
  const out = {
    fullAddress: full, sourceAddress: full, region, hitPart, partKey: ev.partKey || hitPart, side, zone, subZone: sub,
    medicalZone: null, anatomicalZone: null, vascularRegion: null, organRegion: null, cavityRegion: null,
    junctionalRegion: null, limbRegion: null, headFaceRegion: null,
    airwayRisk: false, chestCavityRisk: false, abdominalCavityRisk: false, pelvicCavityRisk: false,
    junctionalBleedRisk: false, majorVesselRiskHint: false, neuroRisk: false, aliases: [],
  };
  const A = out.aliases;
  const isChest = hitPart === 'chest', isAbd = hitPart === 'abdomen', isNeck = hitPart === 'neck';
  const isArm = hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms';
  const isLeg = hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs';
  const isHead = hitPart === 'head', isFace = hitPart === 'face';
  // === 흉부/상체 ===
  if (isChest) {
    if (zone === 'axilla_gap' || /axilla/.test(zone) || /axilla/.test(sub)) {
      out.medicalZone = 'axilla'; out.anatomicalZone = 'axilla'; out.vascularRegion = 'axillary_subclavian';
      out.organRegion = 'lung_apex'; out.junctionalBleedRisk = true; out.chestCavityRisk = true; A.push('axillaGap','axilla_gap');
    } else if (zone === 'clavicle') {
      out.medicalZone = 'clavicle'; out.vascularRegion = 'subclavian'; out.organRegion = 'upper_thorax'; out.chestCavityRisk = true; A.push('clavicle');
    } else if (zone === 'supraclavicular') {
      out.medicalZone = 'supraclavicular'; out.vascularRegion = 'subclavian'; out.organRegion = 'thoracic_inlet';
      out.chestCavityRisk = true; out.junctionalBleedRisk = true; A.push('supraclavicular');
    } else if (zone === 'collar_line' || /collar_line/.test(zone)) {
      out.medicalZone = 'collar_line'; out.vascularRegion = 'subclavian'; out.organRegion = 'upper_thorax'; out.chestCavityRisk = true; A.push('collar_line','clavicle');
    } else if (/upper_lateral|lower_lateral/.test(zone)) {
      out.medicalZone = (zone === 'upper_lateral' ? 'lateral_chest_upper' : 'lateral_chest_lower'); out.organRegion = 'lung';
      out.cavityRegion = 'pleural'; out.chestCavityRisk = true; A.push('lateralThoraxGap','side');
    } else if (zone === 'side_core' || sub === 'side_plate_core') {
      out.medicalZone = 'lateral_chest'; out.organRegion = 'lung'; out.cavityRegion = 'pleural'; out.chestCavityRisk = true; A.push('side');
    } else {
      out.medicalZone = (zone || 'chest'); out.organRegion = 'thorax'; out.cavityRegion = 'pleural'; out.chestCavityRisk = true;
      if (zone === 'sternum_upper' || zone === 'upper') A.push('upperGap');
      if (zone === 'mid' || zone === 'lower') A.push('softCenter');
    }
  }
  // === 복부/골반/낭심 ===
  else if (isAbd) {
    if (zone === 'groin') {
      out.junctionalBleedRisk = true; out.vascularRegion = 'femoral_iliac';
      if (sub === 'groin_junctional') { out.medicalZone = 'groin_junctional'; out.junctionalRegion = 'inguinal'; out.majorVesselRiskHint = true; A.push('groin_junctional','groin_adjacent','pelvisGroinAdjacent'); }
      else { out.medicalZone = 'groin'; out.junctionalRegion = 'groin'; A.push('groin','groin_adjacent'); }
    } else if (zone === 'pelvis' || /pelvis/.test(zone)) {
      out.medicalZone = 'pelvis_upper'; out.vascularRegion = 'iliac'; out.cavityRegion = 'pelvic';
      out.pelvicCavityRisk = true; out.junctionalBleedRisk = true; A.push('pelvis','pelvis_upper');
    } else if (/upper_flank|lower_flank|flank/.test(zone)) {
      out.medicalZone = (zone === 'upper_flank' ? 'flank_upper' : 'flank_lower'); out.organRegion = 'kidney_or_solid_organ_side';
      out.cavityRegion = 'retroperitoneal'; out.abdominalCavityRisk = true; A.push('flankRegion');
    } else if (/kidney/.test(zone)) {
      out.medicalZone = 'kidney_region'; out.organRegion = 'kidney'; out.cavityRegion = 'retroperitoneal'; out.abdominalCavityRisk = true; A.push('kidneyRearRegion','kidney_left','kidney_right');
    } else {
      out.medicalZone = (zone || 'abdomen'); out.organRegion = (zone === 'upper' ? 'upper_abdomen_solid_organ' : 'abdomen');
      out.cavityRegion = 'peritoneal'; out.abdominalCavityRisk = true;
      if (zone === 'upper') A.push('upperEdge','upperAbdomenExposed');
      if (sub === 'groin_adjacent') { out.junctionalBleedRisk = true; A.push('groin_adjacent'); }
    }
  }
  // === 목 ===
  else if (isNeck) {
    out.medicalZone = (zone || 'neck'); out.vascularRegion = 'carotid_jugular'; out.junctionalBleedRisk = true; out.majorVesselRiskHint = true;
    out.airwayRisk = (zone === 'throat_upper' || zone === 'throat_lower' || zone === 'neck_base');
    out.neuroRisk = (side === 'rear' || zone === 'nape'); A.push('neck');
  }
  // === 다리(대퇴/서혜) ===
  else if (isLeg) {
    out.limbRegion = 'leg';
    if (zone === 'femoral_triangle') {
      out.medicalZone = 'femoral_triangle'; out.vascularRegion = 'femoral'; out.limbRegion = 'proximal_thigh';
      out.junctionalBleedRisk = true; out.majorVesselRiskHint = true; A.push('femoral_triangle','upperInnerThighProximal','innerThigh');
    } else if (zone === 'upper_thigh') {
      if (sub === 'proximal_inner') { out.medicalZone = 'proximal_inner_thigh'; out.vascularRegion = 'femoral_branch'; out.junctionalBleedRisk = 'possible'; out.limbRegion = 'proximal_thigh'; A.push('innerThigh','upperInnerThighProximal'); }
      else { out.medicalZone = 'proximal_thigh'; out.limbRegion = 'proximal_thigh'; A.push('proximal_thigh'); }
    } else if (zone === 'mid_thigh') { out.medicalZone = 'mid_thigh'; out.limbRegion = 'mid_thigh'; }
    else if (zone === 'knee') { out.medicalZone = 'knee'; out.limbRegion = 'knee'; }
    else if (zone === 'lower_leg') { out.medicalZone = 'lower_leg'; out.limbRegion = 'distal_leg'; }
    else { out.medicalZone = (zone || 'leg'); }
  }
  // === 팔/어깨/겨드랑이 ===
  else if (isArm) {
    out.limbRegion = 'arm';
    if (zone === 'axilla_gap') { out.medicalZone = 'axilla'; out.vascularRegion = 'axillary'; out.junctionalBleedRisk = true; out.majorVesselRiskHint = true; A.push('axillaGap','axilla_gap'); }
    else if (zone === 'shoulder') { out.medicalZone = 'shoulder'; out.limbRegion = 'shoulder'; A.push(sub||'shoulder'); }
    else if (zone === 'upper_arm') { out.medicalZone = 'upper_arm'; out.limbRegion = 'upper_arm'; if (sub === 'proximal_inner') { out.vascularRegion = 'brachial'; A.push('innerArm'); } }
    else if (zone === 'forearm') { out.medicalZone = 'forearm'; out.limbRegion = 'forearm'; }
    else { out.medicalZone = (zone || 'arm'); }
  }
  // === 머리(두개) ===
  else if (isHead) {
    out.neuroRisk = true;
    if (zone === 'forehead' || zone === 'crown_front') { out.medicalZone = 'forehead'; out.organRegion = 'skull_brain_frontal'; A.push('forehead'); }
    else if (zone === 'crown') { out.medicalZone = 'crown'; out.organRegion = 'skull_brain_vertex'; A.push('crown'); }
    else if (zone === 'temporal') { out.medicalZone = 'temporal'; out.organRegion = 'skull_brain_temporal'; A.push('temporal'); }
    else if (zone === 'occipital' || zone === 'nape_shell') { out.medicalZone = 'occipital'; out.organRegion = 'skull_brain_occipital'; A.push('occipital'); }
    else if (zone === 'ear') { out.medicalZone = 'ear'; out.organRegion = 'skull_base_temporal'; A.push('ear'); }
    else { out.medicalZone = (zone || 'head'); out.organRegion = 'skull_brain'; }
  }
  // === 얼굴(안면) ===
  else if (isFace) {
    out.headFaceRegion = (zone === 'upper' ? 'upper_face' : zone === 'mid' ? 'mid_face' : zone === 'lower' ? 'lower_face' : 'face');
    if (zone === 'upper') {
      if (sub === 'eyes') { out.medicalZone = 'eyes'; out.neuroRisk = 'possible'; A.push('eyes'); }
      else { out.medicalZone = 'brow'; out.neuroRisk = 'possible'; A.push('brow'); }
    } else if (zone === 'mid') { out.medicalZone = 'mid_face'; out.airwayRisk = 'possible'; A.push('nose','cheek'); }
    else if (zone === 'lower') { out.medicalZone = (sub === 'jaw' ? 'jaw' : 'mouth_jaw'); out.airwayRisk = true; A.push('jaw','mouth'); }
    else if (sub === 'cheek' || zone === 'cheek') { out.medicalZone = 'cheek'; out.airwayRisk = 'possible'; A.push('cheek'); }
    else { out.medicalZone = (zone || 'face'); }
  }
  else { out.medicalZone = (zone || hitPart || 'unknown'); }
  return out;
}
function classifyBleedingClass(depth, hitPart, ia, deep) {
  const zone = ia && ia.zone, sub = ia && ia.subZone, side = ia && (ia.impactSide || ia.side);
  const med = ia && ia.medical;   // SIDE-MEDICAL-TRAUMA-BRIDGE-1 §6: 결정형 의료주소 우선
  // 결정형 주소 기반 junctional/cavity 판정 (medAddr) — legacy 조건은 fallback
  const medJunctional = !!(med && (med.junctionalBleedRisk === true || med.majorVesselRiskHint === true
    || med.medicalZone === 'groin' || med.medicalZone === 'groin_junctional' || med.medicalZone === 'femoral_triangle'
    || med.medicalZone === 'supraclavicular' || med.medicalZone === 'axilla' || med.vascularRegion === 'femoral' || med.vascularRegion === 'femoral_iliac'));
  const medCavity = !!(med && (med.chestCavityRisk || med.abdominalCavityRisk || med.pelvicCavityRisk));
  const junctional = medJunctional
    || (hitPart === 'abdomen' && (zone === 'groin' || zone === 'pelvis' || sub === 'groin_adjacent'))
    || (hitPart === 'neck');
  if (depth === 'surface_only') return 'no_bleed_or_minor';
  if (depth === 'shallow_entry') return (hitPart === 'neck' || junctional) ? 'external_controllable_bleed' : 'superficial_bleed';
  // deep_penetration / near_exit_lodged / body_through_and_through
  // femoral_triangle / proximal_inner_thigh 는 사지라도 junctional 유지 (단순 muscle_bleed 금지)
  if (med && (med.medicalZone === 'femoral_triangle' || (med.medicalZone === 'proximal_inner_thigh' && deep) || (med.medicalZone === 'axilla'))) return 'junctional_bleed';
  if (hitPart === 'chest' || hitPart === 'abdomen') {
    if (junctional) return 'junctional_bleed';
    return 'cavity_internal_bleed';
  }
  if (junctional) return 'junctional_bleed';
  if (hitPart === 'neck') return 'junctional_bleed';
  // pelvis_upper deep (abdomen 외 경로로 온 경우)
  if (medCavity && deep && (hitPart === 'chest' || hitPart === 'abdomen')) return 'cavity_internal_bleed';
  // 사지
  if (hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs' || hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms') {
    return deep ? 'muscle_bleed' : 'external_controllable_bleed';
  }
  return 'external_controllable_bleed';
}
// 장기/혈관 candidate hint (확정 손상 아님)
function _organVesselHints(hitPart, ia, depth, deep) {
  // SIDE-MED-2B-1A: 문자열 배열 형태는 backward compat 유지. 풍부한 후보는 buildOrganVesselCandidateMap이 담당.
  const map = buildOrganVesselCandidateMap(hitPart, ia, depth, deep, null, null, 0);
  return { organ: map.organStrings, vessel: map.vesselStrings };
}
// SIDE-MED-2B-1A §5/§8: bodyTrajectory 기반 정밀 후보 지도 (candidate 단계만, confirmed 아님)
//   결과: { candidates:[{id,label,type,confidence,severityHint,reason,source,confirmed:false}], organStrings, vesselStrings, treatmentTags:[] }
function buildOrganVesselCandidateMap(hitPart, ia, depth, deep, sizeClass, terminalFam, crushBias) {
  const candidates = [];
  const tags = new Set();
  // §6 깊이 게이트 — surface_only/shallow_entry는 장기·대혈관 후보 강하게 제한
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const isShallow = (depth === 'shallow_entry');
  const through = (depth === 'body_through_and_through');
  const nearExit = (depth === 'near_exit_lodged');
  const zone = ia && ia.zone, sub = ia && ia.subZone, side = (ia && (ia.impactSide || ia.side)) || '';
  const limbLoc = ia && ia.limbLocation;
  // §7 탄종/크기 → severity 편향
  const fam = terminalFam || '';
  let sevBias = crushBias || 0;
  if (/expand|jhp|hollow/.test(fam) || sizeClass === 'large_bore' || sizeClass === 'shotgun_slug') sevBias += 1;
  if (sizeClass === 'anti_material') sevBias += 1;
  if (sizeClass === 'sabot_subcaliber' || /ap|penetrator|narrow/.test(fam)) sevBias -= 0.5;   // 좁고 깊음 — crush 낮음
  const microFrag = (sizeClass === 'micro_fragment' || sizeClass === 'small');
  const bumpSev = (base) => {
    const order = ['low','medium','high'];
    let i = order.indexOf(base); if (i < 0) i = 0;
    i = Math.max(0, Math.min(2, i + Math.round(sevBias)));
    return order[i];
  };
  const add = (id, label, type, confidence, severityHint, reason, source) => {
    candidates.push({ id, label, type, confidence, severityHint: bumpSev(severityHint), reason, source: source || 'trajectory', confirmed: false });
  };
  // === 깊이 부족: 표층/근육 후보만 ===
  if (!isDeep) {
    if (isShallow) {
      // SIDE-MED-2B-1A-HOTFIX-1 §3: chest/abdomen 표층 후보 id 구분 (라벨은 체벽/근육층, id는 부위별).
      if (hitPart === 'chest') add('chest_wall_candidate', '흉벽/근육층 후보', 'soft_tissue', 'low', 'low', 'shallow_entry', 'trajectory');
      else if (hitPart === 'abdomen') add('abdominal_wall_candidate', '복벽/근육층 후보', 'soft_tissue', 'low', 'low', 'shallow_entry', 'trajectory');
      else add('soft_tissue_candidate', '연조직 후보', 'soft_tissue', 'low', 'low', 'shallow_entry', 'trajectory');
      tags.add('hemostaticCandidate');
    }
    return _finishMap(candidates, tags);
  }
  // micro/small fragment는 deep이라도 장기/through 후보 남발 금지 — 보수적
  const fragConservative = microFrag && !through;

  if (hitPart === 'chest') {
    // §8.1 — 측면(lateral)은 subZone/zone이 명시적 측면일 때만. 그 외(정면/중앙, left-ish 포함)는 front/center.
    const isLateral = (sub === 'leftSideEdge' || sub === 'rightSideEdge' || sub === 'lateralThoraxGap'
                    || sub === 'axillaGap' || sub === 'armShoulderGap' || zone === 'side' || zone === 'axilla');
    if (isLateral) {
      add('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'side_chest_deep', 'trajectory');
      add('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'side_chest', 'trajectory');
      if (sub === 'axillaGap' || sub === 'armShoulderGap' || zone === 'axilla') add('axillary_vessel_candidate', '액와혈관 후보', 'vessel', 'low', 'medium', 'axilla_adjacent', 'impactAddress');
    } else if (side === 'rear' || zone === 'rear') {
      add('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'rear_chest_deep', 'trajectory');
      add('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'rear_chest', 'trajectory');
      if (deep) add('thoracic_vessel_candidate', '흉부혈관 후보', 'vessel', 'low', 'high', 'rear_chest_deep', 'trajectory');
      // heart는 rear에서 제한
    } else {
      // front/center (left-ish frontal 포함)
      add('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'front_chest_deep', 'trajectory');
      add('rib_candidate', '늑골 후보', 'bone', 'low', 'low', 'front_chest', 'trajectory');
      add('pleural_space_candidate', '흉막강 후보', 'cavity', 'low', 'medium', 'penetrating_chest', 'trajectory');
      // heart는 center/upper/left-ish + high severity(또는 through/nearExit) 조건에서만 제한적으로
      const centerUpperLeft = (sub === 'softCenter' || sub === 'upperGap' || sub === 'plateCore' || /left/.test(side) || zone === 'upper' || zone === 'center');
      if (centerUpperLeft && (sevBias >= 1 || through || nearExit)) add('heart_candidate', '심장 후보', 'organ', 'low', 'high', 'central_thorax_high_energy', 'trajectory');
      if (deep) add('thoracic_vessel_candidate', '흉부혈관 후보', 'vessel', 'low', 'high', 'central_thorax_deep', 'trajectory');
    }
    tags.add('chestSealCandidate');
    if (sevBias >= 1 || through) tags.add('surgeryRequiredCandidate');
  }
  else if (hitPart === 'abdomen') {
    if (zone === 'upper' || sub === 'upperEdge' || sub === 'upperAbdomenExposed') {
      // §8.2 — 방향성
      if (/right/.test(side)) add('liver_candidate', '간 후보', 'organ', 'medium', 'high', 'right_upper_abdomen', 'trajectory');
      else if (/left/.test(side)) { add('spleen_candidate', '비장 후보', 'organ', 'medium', 'high', 'left_upper_abdomen', 'trajectory'); add('stomach_candidate', '위 후보', 'organ', 'low', 'medium', 'left_upper_abdomen', 'trajectory'); }
      else { add('stomach_candidate', '위 후보', 'organ', 'medium', 'medium', 'central_upper_abdomen', 'trajectory'); add('upper_gi_candidate', '상부위장관 후보', 'organ', 'low', 'medium', 'central_upper_abdomen', 'trajectory'); }
      if (deep) add('upper_abdominal_vessel_candidate', '상복부혈관 후보', 'vessel', 'low', 'high', 'upper_abdomen_deep', 'trajectory');
    }
    else if (zone === 'flank' || sub === 'flankRegion' || sub === 'kidneyRearRegion' || zone === 'side' || /flank/.test(side)) {
      // §8.3 flank
      if (deep || nearExit || through) { add('kidney_candidate', '신장 후보', 'organ', 'medium', 'high', 'flank_deep', 'trajectory'); add('retroperitoneal_bleed_candidate', '후복막출혈 후보', 'cavity', 'low', 'high', 'flank_deep', 'trajectory'); }
      add('flank_muscle_candidate', '측복부 근육 후보', 'soft_tissue', 'medium', 'low', 'flank', 'trajectory');
    }
    else if (zone === 'groin' || zone === 'pelvis' || sub === 'groin_adjacent' || sub === 'pelvisGroinAdjacent' || sub === 'pelvisSideGap' || sub === 'pelvisRearAdjacent') {
      // §8.4/§8.5 pelvis/groin
      add('pelvic_bleed_candidate', '골반출혈 후보', 'cavity', 'medium', 'high', 'pelvis_deep', 'trajectory');
      add('iliac_vessel_candidate', '장골혈관 후보', 'vessel', 'low', 'high', 'pelvis_deep', 'trajectory');
      if (sub === 'groin_adjacent') { add('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', 'low', 'high', 'groin_junctional', 'trajectory'); add('junctional_bleed_candidate', '접합부출혈 후보', 'cavity', 'medium', 'high', 'groin', 'trajectory'); tags.add('junctionalPressureCandidate'); tags.add('packingCandidate'); tags.add('hemostaticCandidate'); tags.add('tourniquetLimited'); }
      add('bladder_candidate', '방광 후보', 'organ', 'low', 'medium', 'pelvis', 'trajectory');
    }
    else {
      // lower/central abdomen
      add('bowel_candidate', '장 후보', 'organ', 'medium', 'medium', 'lower_abdomen_deep', 'trajectory');
      add('mesenteric_vessel_candidate', '장간막혈관 후보', 'vessel', 'low', 'high', 'lower_abdomen_deep', 'trajectory');
    }
    tags.add('abdominalDressingCandidate');
    if (sevBias >= 1 || through) tags.add('surgeryRequiredCandidate');
  }
  else if (hitPart === 'neck') {
    // §8.6
    add('carotid_candidate', '경동맥 후보', 'vessel', 'medium', 'high', 'neck_deep', 'trajectory');
    add('jugular_candidate', '경정맥 후보', 'vessel', 'medium', 'high', 'neck_deep', 'trajectory');
    if (side === 'front' || zone === 'front' || zone === 'anterior') add('airway_candidate', '기도 후보', 'airway', 'medium', 'high', 'anterior_neck', 'impactAddress');
    if (side === 'rear' || side === 'center' || through || sevBias >= 1) add('cervical_spine_candidate', '경추 후보', 'bone', 'low', 'high', 'neck_rear_or_through', 'trajectory');
    add('neck_junctional_bleed_candidate', '경부 접합부출혈 후보', 'cavity', 'medium', 'high', 'neck', 'trajectory');
    tags.add('hemostaticCandidate'); tags.add('packingCandidate'); tags.add('airwayConcernCandidate');
    tags.add('surgeryRequiredCandidate');
  }
  else if (hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs') {
    // §8.7 limbs — torso cavity와 구분, organ 후보 없음
    add('muscle_bleed_candidate', '근육출혈 후보', 'soft_tissue', 'medium', 'low', 'limb', 'trajectory');
    if (limbLoc === 'innerThigh' || limbLoc === 'thighProximal' || sub === 'groin_adjacent') {
      add('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', 'low', 'high', 'proximal_medial_thigh', 'trajectory');
      tags.add('junctionalPressureCandidate'); tags.add('tourniquetLimited');
    } else { tags.add('tourniquetCandidate'); }
    add('limb_bone_candidate', '사지 골절 후보', 'bone', 'low', 'medium', 'limb', 'trajectory');
    tags.add('pressureBandageCandidate'); tags.add('hemostaticCandidate');
    if ((ia && ia.boneRisk) || sevBias >= 1) tags.add('splintCandidate');
  }
  else if (hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms') {
    add('muscle_bleed_candidate', '근육출혈 후보', 'soft_tissue', 'medium', 'low', 'limb', 'trajectory');
    if (limbLoc === 'upperArmProximal' || limbLoc === 'axillaAdjacent') {
      add('axillary_brachial_candidate', '액와/상완혈관 후보', 'vessel', 'low', 'high', 'proximal_arm_axilla', 'trajectory');
      tags.add('junctionalPressureCandidate'); tags.add('tourniquetLimited');
    } else { tags.add('tourniquetCandidate'); }
    add('limb_bone_candidate', '사지 골절 후보', 'bone', 'low', 'medium', 'limb', 'trajectory');
    tags.add('pressureBandageCandidate'); tags.add('hemostaticCandidate');
  }
  else {
    // head 등 기타 — 보수적
    add('soft_tissue_candidate', '연조직 후보', 'soft_tissue', 'low', 'medium', hitPart, 'trajectory');
  }
  // fragment 보수화: micro/small fragment deep(비관통)이면 vessel/organ high confidence 강등
  if (fragConservative) {
    for (const c of candidates) {
      if ((c.type === 'organ' || c.type === 'vessel') && c.confidence === 'medium') c.confidence = 'low';
    }
  }
  // === SIDE-MEDICAL-TRAUMA-BRIDGE-1 §7: 결정형 의료주소(medAddr) 기반 후보 보강 (새 주소 대응) ===
  const med = ia && ia.medical;
  if (med) {
    const has = (id) => candidates.some(c => c.id === id);
    const addM = (id, label, type, conf, sev, reason) => { if (!has(id)) add(id, label, type, conf, sev, reason, 'impactAddress'); };
    const mz = med.medicalZone;
    // 겨드랑이/액와
    if (mz === 'axilla' || med.vascularRegion === 'axillary' || med.vascularRegion === 'axillary_subclavian') {
      addM('axillary_vessel_candidate', '액와혈관 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'axilla_gap');
      if (med.chestCavityRisk && isDeep) { addM('lung_apex_candidate', '폐첨부 후보', 'organ', 'low', 'medium', 'axilla_deep'); addM('subclavian_vessel_candidate', '쇄골하혈관 후보', 'vessel', 'low', 'high', 'axilla_apex'); tags.add('chestSealCandidate'); }
      tags.add('junctionalControlCandidate'); tags.add('hemostaticCandidate');
    }
    // 쇄골/쇄골상/칼라
    if (mz === 'clavicle' || mz === 'supraclavicular' || mz === 'collar_line') {
      addM('subclavian_vessel_candidate', '쇄골하혈관 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'clavicle_region');
      addM('clavicle_candidate', '쇄골 후보', 'bone', 'medium', 'low', 'clavicle');
      if (mz === 'supraclavicular') addM('thoracic_inlet_candidate', '흉곽입구 후보', 'cavity', 'low', 'high', 'thoracic_inlet');
      if (isDeep && med.chestCavityRisk) { addM('upper_lung_candidate', '상폐엽 후보', 'organ', 'low', 'medium', 'clavicle_deep'); tags.add('chestSealCandidate'); }
      if (mz === 'supraclavicular') tags.add('junctionalControlCandidate');
    }
    // 측흉부
    if (mz === 'lateral_chest_upper' || mz === 'lateral_chest_lower' || mz === 'lateral_chest') {
      addM('lung_candidate', '폐 후보', 'organ', 'medium', 'medium', 'lateral_chest'); addM('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'lateral_chest');
      if (med.chestCavityRisk) addM('pleural_cavity_candidate', '흉막강 후보', 'cavity', isDeep ? 'medium' : 'low', 'high', 'pleural_space');
      if (isDeep && (sevBias >= 1 || through)) addM('thoracic_vessel_candidate', '흉부혈관 후보', 'vessel', 'low', 'high', 'lateral_chest_deep');
      tags.add('chestSealCandidate');
    }
    // SIDE-MEDICAL-ORGAN-BLEEDING-1 §2: 흉부 정면 중앙 — 폐/늑골/흉막강 + (매우 제한적) 심장 후보
    if (hitPart === 'chest' && (mz === 'upper' || mz === 'mid' || mz === 'lower' || med.organRegion === 'thorax')) {
      addM('lung_candidate', '폐 후보', 'organ', isDeep ? 'medium' : 'low', 'medium', 'anterior_chest');
      addM('rib_candidate', '늑골 후보', 'bone', 'medium', 'low', 'anterior_chest');
      if (med.chestCavityRisk) addM('pleural_cavity_candidate', '흉막강 후보', 'cavity', isDeep ? 'medium' : 'low', 'high', 'pleural_space');
      if ((mz === 'mid' || mz === 'lower' || mz === 'chest') && isDeep) addM('heart_candidate', '심장 후보', 'organ', 'low', 'high', 'central_chest_deep');
    }
    // 옆구리/신장/후복막
    if (mz === 'flank_upper' || mz === 'flank_lower' || mz === 'kidney_region' || med.cavityRegion === 'retroperitoneal') {
      addM('kidney_candidate', '신장 후보', 'organ', isDeep ? 'medium' : 'low', 'high', 'flank_kidney');
      if (isDeep) addM('retroperitoneal_bleed_candidate', '후복막출혈 후보', 'cavity', 'low', 'high', 'retroperitoneal');
      addM('flank_muscle_candidate', '측복부근육 후보', 'soft_tissue', 'low', 'low', 'flank');
    }
    // SIDE-MEDICAL-ORGAN-BLEEDING-1 §3: 복부 정면 실질/중공 장기 후보 (hitPart abdomen 한정 — 흉부 upper/mid/lower와 구분)
    if (hitPart === 'abdomen' && (mz === 'upper' || mz === 'mid' || mz === 'lower' || med.organRegion === 'upper_abdomen_solid_organ' || med.organRegion === 'abdomen')) {
      if (mz === 'upper' || med.organRegion === 'upper_abdomen_solid_organ') {
        // 상복부: 간/비장/위 (좌우 미확정 — 실질장기 후보 집합). isLeft로 편향.
        const _leftBias = (ia && (ia.side === 'left' || ia.impactSide === 'left')) || /left/.test(String((ia&&ia.fullAddress)||''));
        if (_leftBias) { addM('spleen_candidate', '비장 후보', 'organ', isDeep ? 'medium' : 'low', 'high', 'upper_abdomen_left'); addM('stomach_candidate', '위 후보', 'organ', 'low', 'medium', 'upper_abdomen'); }
        else { addM('liver_candidate', '간 후보', 'organ', isDeep ? 'medium' : 'low', 'high', 'upper_abdomen_right_center'); addM('stomach_candidate', '위 후보', 'organ', 'low', 'medium', 'upper_abdomen'); }
      }
      if (mz === 'mid' || mz === 'lower' || med.organRegion === 'abdomen') addM('bowel_candidate', '장(중공장기) 후보', 'organ', isDeep ? 'medium' : 'low', 'medium', 'mid_lower_abdomen');
      if (isDeep && (med.abdominalCavityRisk || through)) addM('abdominal_vessel_candidate', '복부대혈관 후보', 'vessel', 'low', 'high', 'abdomen_deep');
    }
    // 골반
    if (mz === 'pelvis_upper' || med.cavityRegion === 'pelvic') {
      addM('pelvic_bleed_candidate', '골반출혈 후보', 'cavity', isDeep ? 'medium' : 'low', 'high', 'pelvis');
      addM('iliac_vessel_candidate', '장골혈관 후보', 'vessel', 'low', 'high', 'pelvis_upper');
      addM('pelvic_bone_candidate', '골반골 후보', 'bone', 'medium', 'medium', 'pelvis');
      tags.add('pelvicControlCandidate'); tags.add('evacuationPriorityCandidate');
    }
    // 낭심/서혜부
    if (mz === 'groin' || mz === 'groin_junctional') {
      addM('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'groin');
      if (isDeep && (mz === 'groin_junctional' || med.majorVesselRiskHint)) addM('iliac_vessel_candidate', '장골혈관 후보', 'vessel', 'low', 'high', 'groin_junctional_deep');
      addM('junctional_hemorrhage_candidate', '접합부출혈 후보', 'cavity', 'low', 'high', 'groin_junctional');
      tags.add('junctionalControlCandidate'); tags.add('hemostaticCandidate'); tags.add('packingCandidate');
    }
    // 대퇴삼각(femoral_triangle)
    if (mz === 'femoral_triangle' || mz === 'proximal_inner_thigh') {
      addM('femoral_vessel_candidate', '대퇴혈관 후보', 'vessel', isDeep ? 'high' : 'medium', 'high', 'femoral_triangle');
      if (isDeep) addM('femur_candidate', '대퇴골 후보', 'bone', 'low', 'medium', 'proximal_thigh_deep');
      tags.add('junctionalControlCandidate'); tags.add('tourniquetCandidate'); tags.add('hemostaticCandidate');
    }
    // 얼굴
    if (mz === 'eyes') { addM('eye_candidate', '안구 후보', 'organ', 'medium', 'medium', 'eyes'); addM('orbital_bone_candidate', '안와골 후보', 'bone', 'low', 'low', 'orbital'); if (sevBias >= 1) addM('neuro_candidate', '신경/전두엽 후보', 'organ', 'low', 'high', 'orbital_deep'); }
    if (mz === 'mid_face' || mz === 'cheek' || mz === 'brow') { addM('facial_bleed_candidate', '안면출혈 후보', 'soft_tissue', 'medium', 'low', 'mid_face'); addM('facial_bone_candidate', '안면골 후보', 'bone', 'low', 'low', 'facial'); if (med.airwayRisk) tags.add('airwayRiskCandidate'); }
    if (mz === 'jaw' || mz === 'mouth_jaw') { addM('jaw_candidate', '하악골 후보', 'bone', 'medium', 'low', 'jaw'); addM('facial_bleed_candidate', '안면출혈 후보', 'soft_tissue', 'medium', 'medium', 'lower_face'); tags.add('airwayRiskCandidate'); tags.add('advancedAirwayRequiredCandidate'); }
    // 두개/뇌
    if (med.organRegion && /skull_brain/.test(med.organRegion)) {
      addM('skull_candidate', '두개골 후보', 'bone', 'medium', 'medium', 'skull');
      if (isDeep || sevBias >= 1) { addM('tbi_candidate', '외상성뇌손상 후보', 'organ', 'low', 'high', 'skull_deep'); addM('brain_region_candidate', '뇌 영역 후보', 'organ', 'low', 'high', med.medicalZone || 'brain'); }
      if (mz === 'temporal') addM('temporal_bone_candidate', '측두골 후보', 'bone', 'medium', 'medium', 'temporal');
      if (mz === 'occipital') addM('occipital_brain_candidate', '후두엽 후보', 'organ', 'low', 'high', 'occipital');
    }
    // 목 대혈관
    if (hitPart === 'neck' || med.vascularRegion === 'carotid_jugular') {
      addM('carotid_candidate', '경동맥 후보', 'vessel', isDeep ? 'medium' : 'low', 'high', 'neck');
      addM('jugular_candidate', '경정맥 후보', 'vessel', 'low', 'high', 'neck');
      tags.add('junctionalControlCandidate'); tags.add('hemostaticCandidate');
      if (med.airwayRisk) tags.add('airwayRiskCandidate');
    }
    // 내부출혈 체강은 지혈/드레싱으로 안 줄음 — surgery/transfusion 표식
    if ((med.chestCavityRisk || med.abdominalCavityRisk || med.pelvicCavityRisk) && isDeep) {
      tags.add('surgeryRequiredCandidate'); if (through || sevBias >= 1) tags.add('transfusionRequiredCandidate'); tags.add('evacuationPriorityCandidate');
    }
    if (med.majorVesselRiskHint && isDeep) { tags.add('vascularControlRequiredCandidate'); tags.add('surgeryRequiredCandidate'); }
  }
  return _finishMap(candidates, tags);
}
function _finishMap(candidates, tags) {
  const organStrings = [], vesselStrings = [];
  for (const c of candidates) {
    if (c.type === 'organ' || c.type === 'cavity' || c.type === 'airway') { if (!organStrings.includes(c.id)) organStrings.push(c.id); }
    if (c.type === 'vessel') { if (!vesselStrings.includes(c.id)) vesselStrings.push(c.id); }
  }
  return { candidates, organStrings, vesselStrings, treatmentTags: Array.from(tags) };
}
// SIDE-MED-2B-1A §9/§10: bleedingClass와 후보를 일치시켜 처치 적응증 태그 도출 (실제 처치효과 X — 태그만)
function _deriveTreatmentIndicationTags(candMap, bleedingClass, depth, majorVessel, hitPart, impactAddress) {
  const tags = new Set(candMap.treatmentTags || []);
  // SIDE-MED-2B-1A-HOTFIX-1 §1: tourniquetCandidate는 사지(arm/leg) 전용. torso/neck/junctional 금지.
  const isLimb = /arm|leg/.test(hitPart || '');
  // bleedingClass 기반 보정 — candidate와 정합
  if (bleedingClass === 'external_controllable_bleed') {
    tags.add('pressureBandageCandidate'); tags.add('hemostaticCandidate');
    if (isLimb) tags.add('tourniquetCandidate');   // 사지 외부출혈만 지혈대 후보
  }
  else if (bleedingClass === 'muscle_bleed') { tags.add('hemostaticCandidate'); tags.add('pressureBandageCandidate'); if (isLimb) tags.add('tourniquetCandidate'); }
  else if (bleedingClass === 'junctional_bleed') { tags.add('junctionalPressureCandidate'); tags.add('packingCandidate'); tags.add('hemostaticCandidate'); tags.add('tourniquetLimited'); }
  else if (bleedingClass === 'cavity_internal_bleed') {
    // cavity 내부출혈 — hemostatic/packing은 기본 무효(체벽 표층만 가능). 수술/후송 후보.
    tags.delete('hemostaticCandidate'); tags.delete('packingCandidate');
    tags.add('surgeryRequiredCandidate'); tags.add('evacuationPriority');
  }
  if (majorVessel) { tags.add('surgeryRequiredCandidate'); tags.add('evacuationPriority'); }
  // §1 안전장치 — 비사지(neck/chest/abdomen/pelvis/groin/axilla 등)에는 tourniquetCandidate가 절대 남지 않게.
  if (!isLimb && tags.has('tourniquetCandidate')) {
    tags.delete('tourniquetCandidate');
    if (bleedingClass === 'junctional_bleed' || candMap.candidates.some(c => /junctional/.test(c.id))) tags.add('tourniquetLimited');
  }
  // SIDE-MED-2B-1B §1: junctional-like 우선권 — tourniquetLimited/junctionalPressure 또는 junctional·femoral·axillary·groin·axilla 후보가
  //   있으면 tourniquetCandidate 제거(proximal-medial junctional 경로는 지혈대 부적합). tourniquetLimited로 둔다.
  const junctionalLike = tags.has('tourniquetLimited') || tags.has('junctionalPressureCandidate')
    || candMap.candidates.some(c => /junctional|femoral|axillary|groin|axilla|neck_junctional/.test(c.id));
  if (junctionalLike && tags.has('tourniquetCandidate')) {
    tags.delete('tourniquetCandidate');
    tags.add('tourniquetLimited');
  }
  return Array.from(tags);
}
// =============================================================
// SIDE-MED-2B-1B: Internal Bleeding Severity Model — wound 단위 내부출혈 위험도 분류 (confirmed 아님)
// =============================================================
//   입력: bodyTrajectory(depth/internalScores/residualEnergyFactor/projectileSizeClass/candidateMap/majorVesselCandidate),
//         bleedingClass, hitPart. 출력: {severity, sourceType, *Risk, fieldCareLimit, surgeryRequiredCandidate, evacuationPriority, reason}.
function buildInternalBleedingModel(bt, bleedingClass, hitPart) {
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through');
  const nearExit = (depth === 'near_exit_lodged');
  const sc = bt.internalScores || {};
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const size = bt.projectileSizeClass || '';
  const fam = bt.terminalEffectType || '';
  const cm = bt.candidateMap || [];
  const major = !!bt.majorVesselCandidate;
  const isLimb = /arm|leg/.test(hitPart || '');
  const microFrag = (size === 'micro_fragment' || size === 'small');

  // sourceType — bleedingClass + candidate 결합
  let sourceType = 'none';
  if (major) sourceType = 'major_vessel_candidate';
  else if (bleedingClass === 'cavity_internal_bleed') sourceType = 'cavity';
  else if (bleedingClass === 'junctional_bleed') sourceType = 'junctional';
  else if (bleedingClass === 'muscle_bleed') sourceType = 'muscle';
  else if (bleedingClass === 'external_controllable_bleed') sourceType = (cm.some(c => c.type === 'muscle' || c.id === 'muscle_bleed_candidate') ? 'muscle' : 'soft_tissue');
  else if (!isDeep) sourceType = (depth === 'surface_only') ? 'none' : 'soft_tissue';
  else sourceType = 'soft_tissue';

  // 위험도 점수 (0~1) — cavity/organ 위험은 체강 부위 한정(사지는 체강 내부출혈 위험 N/A)
  const cavityRisk = +(isLimb ? 0 : Math.min(1, (sourceType === 'cavity' ? 0.55 : 0) + (sc.temporaryCavityScore || 0) * 0.35 + (sc.bleedingSeverityScore || 0) * 0.2) * (isDeep ? 1 : 0.2)).toFixed(2);
  const junctionalRisk = +(Math.min(1, (sourceType === 'junctional' ? 0.6 : 0) + (cm.some(c => /junctional/.test(c.id)) ? 0.2 : 0)) * (isDeep ? 1 : 0.3)).toFixed(2);
  const majorVesselRisk = +(major ? Math.min(1, 0.55 + (sc.bleedingSeverityScore || 0) * 0.3 + (through || nearExit ? 0.1 : 0)) : (cm.some(c => c.type === 'vessel') ? 0.2 : 0)).toFixed(2);
  const organCandidateRisk = +(isLimb ? 0 : Math.min(1, cm.filter(c => c.type === 'organ').length * 0.18 + (sourceType === 'cavity' ? 0.25 : 0)) * (isDeep ? 1 : 0.2)).toFixed(2);

  // severity 등급 — 강화/약화 요인 종합
  let score = 0;
  if (depth === 'surface_only') score = 0.05;
  else if (depth === 'shallow_entry') score = 0.25;
  else if (depth === 'deep_penetration') score = 0.5;
  else if (depth === 'near_exit_lodged') score = 0.62;
  else if (depth === 'body_through_and_through') score = 0.68;
  score += (sc.bleedingSeverityScore || 0) * 0.25;
  score += cavityRisk * 0.25 + junctionalRisk * 0.2 + majorVesselRisk * 0.35 + organCandidateRisk * 0.15;
  score += ref * 0.1;
  if (/expand|jhp|hollow/.test(fam) || size === 'large_bore' || size === 'shotgun_slug' || size === 'anti_material') score += 0.12;
  // 약화
  if (!bt.bodyEntered) score = Math.min(score, 0.1);
  if (microFrag && !through) score *= 0.7;
  if (isLimb) score = Math.min(score, 0.6);   // 사지는 cavity 즉사급 아님
  if (depth === 'surface_only' || bt.skinEntryPassed === false) score = Math.min(score, 0.15);

  let severity;
  if (score < 0.18) severity = 'none';
  else if (score < 0.38) severity = 'low';
  else if (score < 0.62) severity = 'moderate';
  else if (score < 0.85) severity = 'severe';
  else severity = 'critical';
  // surface/shallow는 상한
  if (depth === 'surface_only') severity = (severity === 'none') ? 'none' : 'low';
  else if (depth === 'shallow_entry' && (severity === 'severe' || severity === 'critical')) severity = 'moderate';
  // major_vessel_candidate는 severe/critical 후보 허용 (단 confirmed 아님)

  // fieldCareLimit
  let fieldCareLimit;
  if (sourceType === 'cavity' || sourceType === 'major_vessel_candidate') fieldCareLimit = (severity === 'critical' || severity === 'severe') ? 'unmanageable' : 'limited';
  else if (sourceType === 'junctional') fieldCareLimit = 'limited';
  else if (sourceType === 'muscle') fieldCareLimit = (severity === 'severe' || severity === 'critical') ? 'limited' : 'controllable';
  else if (sourceType === 'soft_tissue') fieldCareLimit = 'treatable';
  else fieldCareLimit = 'treatable';

  const surgeryRequiredCandidate = (sourceType === 'cavity' || sourceType === 'major_vessel_candidate') && (severity === 'moderate' || severity === 'severe' || severity === 'critical');
  let evacuationPriority = 'low';
  if (severity === 'critical') evacuationPriority = 'urgent';
  else if (severity === 'severe') evacuationPriority = 'high';
  else if (severity === 'moderate') evacuationPriority = 'medium';

  const reason = `${depth}/${sourceType}` + (major ? '/majorVesselCand' : '');
  return { severity, sourceType, cavityRisk, junctionalRisk, majorVesselRisk, organCandidateRisk, fieldCareLimit, surgeryRequiredCandidate, evacuationPriority, reason, confirmed: false };
}
// =============================================================
// SIDE-MED-2C: Chest / Lung / Pneumothorax Foundation (§11)
// =============================================================
function buildChestTraumaModel(bt, ibm, hitPart, woundSize) {
  if (hitPart !== 'chest') return null;
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  if (!bt.bodyEntered || !isDeep) return { openChestWound:false, lungInjuryStatus:'none', pneumothoraxRisk:0, tensionPneumothoraxRisk:0, hemothoraxRisk:0, breathingEfficiencyDrain:0, chestSealIndicated:false, needleDecompressionCandidate:false, reason:'surface/shallow' };
  const through = (depth === 'body_through_and_through');
  const cm = bt.candidateMap || [];
  const size = (woundSize && woundSize.sizeClass) || '';
  const bigWound = (size === 'large' || size === 'massive');
  const lungCand = cm.some(c => c.id === 'lung_candidate');
  const pleuralCand = cm.some(c => c.id === 'pleural_space_candidate' || c.id === 'thoracic_vessel_candidate');
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const sz = bt.projectileSizeClass || '';
  const frag = (sz === 'fragmenting' || /fragment/.test(bt.terminalEffectType || ''));
  const openChestWound = !!(bt.bodyEntered && (bt.exitWoundPresent || bigWound || through));
  const suckingChestWoundCandidate = openChestWound && (lungCand || pleuralCand);
  let lungInjuryStatus = 'none';
  if (lungCand) { lungInjuryStatus = 'candidate'; if (isDeep && (ibm && (ibm.severity === 'moderate' || ibm.severity === 'severe' || ibm.severity === 'critical'))) lungInjuryStatus = 'suspected'; if (through && ref > 0.6) lungInjuryStatus = 'likely'; }
  let pneumothoraxRisk = 0;
  if (lungCand || pleuralCand || openChestWound) {
    pneumothoraxRisk = Math.min(1, 0.3 + (through ? 0.2 : 0) + (openChestWound ? 0.2 : 0) + ref * 0.2 + (frag ? 0.1 : 0) + (bigWound ? 0.1 : 0));
  }
  const hemothoraxRisk = +(Math.min(1, (ibm && ibm.sourceType === 'cavity' ? 0.45 : 0) + (cm.some(c => c.id === 'thoracic_vessel_candidate') ? 0.3 : 0) + (lungInjuryStatus === 'likely' ? 0.15 : 0))).toFixed(2);
  pneumothoraxRisk = +pneumothoraxRisk.toFixed(2);
  return {
    openChestWound, suckingChestWoundCandidate, lungInjuryCandidate: lungCand, lungInjuryStatus,
    pleuralSpaceInvolvement: pleuralCand, pneumothoraxRisk, tensionPneumothoraxRisk: 0,   // tension은 tick에서 진행
    hemothoraxRisk, breathingEfficiencyDrain: 0, oxygenationRisk: pneumothoraxRisk > 0.5,
    chestSealIndicated: openChestWound, needleDecompressionCandidate: false, reason: `${depth}${openChestWound ? '/open' : ''}`,
  };
}
// =============================================================
// SIDE-MED-2C: Open Torso Wound Foundation (§14)
// =============================================================
function buildOpenTorsoModel(bt, ibm, hitPart, woundSize) {
  if (hitPart !== 'chest' && hitPart !== 'abdomen') return null;
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through');
  const cm = bt.candidateMap || [];
  const size = (woundSize && woundSize.sizeClass) || '';
  const bigWound = (size === 'large' || size === 'massive');
  const sz = bt.projectileSizeClass || '';
  const highDisrupt = (sz === 'shotgun_slug' || sz === 'anti_material' || sz === 'large_bore' || /fragment|explos/.test(bt.terminalEffectType || ''));
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  if (!bt.bodyEntered || !isDeep) return { openTorsoWound:false, openChestWound:false, openAbdominalWound:false, abdominalWallDisruption:false, eviscerationRisk:false, eviscerationStatus:'none', contaminationRisk:0, dressingIndicated:false, abdominalDressingCandidate:false, reason:'surface/shallow' };
  const openTorsoWound = !!(bt.exitWoundPresent || bigWound || through || highDisrupt);
  const openChestWound = (hitPart === 'chest') && openTorsoWound;
  const abdominalWallDisruption = (hitPart === 'abdomen') && (cm.some(c => c.id === 'abdominal_wall_candidate') || bigWound) && (ref > 0.5 || highDisrupt);
  const openAbdominalWound = (hitPart === 'abdomen') && (bigWound || through || abdominalWallDisruption || cm.some(c => c.id === 'abdominal_wall_candidate'));
  const bowelCand = cm.some(c => c.id === 'bowel_candidate' || c.id === 'mesenteric_vessel_candidate');
  let eviscerationRisk = openAbdominalWound && abdominalWallDisruption && bigWound && (through || bowelCand);
  let eviscerationStatus = eviscerationRisk ? (bigWound && through ? 'suspected' : 'candidate') : 'none';
  const contaminationRisk = +(Math.min(1, (openTorsoWound ? 0.3 : 0) + (bowelCand ? 0.35 : 0) + (bigWound ? 0.15 : 0))).toFixed(2);
  return {
    openTorsoWound, openChestWound, openAbdominalWound, abdominalWallDisruption,
    eviscerationRisk, eviscerationStatus, contaminationRisk,
    dressingIndicated: openAbdominalWound, abdominalDressingCandidate: openAbdominalWound,
    fieldCareLimit: (ibm && ibm.fieldCareLimit) || 'limited', reason: `${depth}${openTorsoWound ? '/open' : ''}`,
  };
}
// =============================================================
// SIDE-MED-2C: Organ Injury Confirmation Foundation (§16) — candidate/suspected/likely/confirmed_limited
// =============================================================
// [심층의료 계약면 §9.2] buildOrganInjuryModel은 기존 candidateMap을 읽기만 한다 — 대체 함수 금지.
//   candidate/suspected/likely 중심, confirmed_limited는 엄격 조건. heart는 hook-only(확정 승격 금지).
//   TRAUMA-REFINE-1 §9~§11: priorityScore/clinicalPriority/bleedRisk/functionRisk/evidenceTags 보강 (확정 본편 없음).
function buildOrganInjuryModel(bt, ibm, hitPart) {
  const cm = bt.candidateMap || [];
  if (!cm.length) return { injuries:[], topCandidates:[], highestSeverity:'none', surgeryRequiredCandidate:false, evacuationPriority:'low', confirmedCount:0, suspectedCount:0, reason:'no_candidate' };
  const depth = bt.woundDepthClass || 'surface_only';
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through');
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const highEnergy = ref > 0.6;
  const sevHigh = ibm && (ibm.severity === 'severe' || ibm.severity === 'critical');
  const retained = !!(bt.retainedProjectile || depth === 'near_exit_lodged');
  const injuries = [];
  let confirmedCount = 0, suspectedCount = 0;
  const ORGAN_MAP = { lung_candidate:'lung', heart_candidate:'heart_hook_only', liver_candidate:'liver', spleen_candidate:'spleen', kidney_candidate:'kidney', stomach_candidate:'stomach', bowel_candidate:'bowel', bladder_candidate:'bladder', pleural_space_candidate:'pleura', thoracic_vessel_candidate:'thoracic_vessel', upper_abdominal_vessel_candidate:'abdominal_vessel', mesenteric_vessel_candidate:'abdominal_vessel', iliac_vessel_candidate:'iliac_vessel', femoral_vessel_candidate:'femoral_vessel', axillary_vessel_candidate:'axillary_vessel', axillary_brachial_candidate:'axillary_vessel', carotid_candidate:'carotid_jugular', jugular_candidate:'carotid_jugular',
    airway_candidate:'airway', cervical_spine_candidate:'cervical_spine', pelvic_bleed_candidate:'pelvic_bleed', retroperitoneal_bleed_candidate:'retroperitoneal_bleed', limb_bone_candidate:'limb_bone', muscle_bleed_candidate:'muscle_bleed' };
  // §10: 장기/혈관별 기본 우선순위 (생리적 위험 베이스)
  const BASE_PRIORITY = { carotid_jugular:38, thoracic_vessel:34, femoral_vessel:34, iliac_vessel:30, heart_hook_only:30, airway:28, abdominal_vessel:28, axillary_vessel:26, pelvic_bleed:26, liver:26, lung:24, spleen:24, cervical_spine:24, kidney:20, retroperitoneal_bleed:20, pleura:16, bowel:16, stomach:14, bladder:12, limb_bone:10, muscle_bleed:8 };
  const heartNearby = cm.some(c => c.id === 'heart_candidate');
  const RISK_ORDER = ['none','low','moderate','high','massive'];
  const downRisk = (r) => RISK_ORDER[Math.max(0, RISK_ORDER.indexOf(r) - 1)];
  const upRisk = (r) => RISK_ORDER[Math.min(RISK_ORDER.length - 1, RISK_ORDER.indexOf(r) + 1)];
  for (const c of cm) {
    const organ = ORGAN_MAP[c.id]; if (!organ) continue;
    let status = 'candidate';
    if (isDeep && (c.confidence === 'medium' || c.confidence === 'high')) status = 'suspected';
    if ((through || highEnergy) && sevHigh && (c.confidence === 'medium' || c.confidence === 'high') && c.severityHint === 'high') status = 'likely';
    // confirmed_limited: 매우 엄격 (through + high energy + high severity + high confidence). 심장은 제외(hook only).
    if (organ !== 'heart_hook_only' && through && highEnergy && sevHigh && c.confidence === 'high' && c.severityHint === 'high' && bt.exitWoundPresent) status = 'confirmed_limited';
    // §11/§14: heart는 monitoring 단계 고정 — candidate 초과 승격 금지 (rhythm/확정은 후속 단계)
    if (organ === 'heart_hook_only' && status !== 'candidate') status = 'candidate';
    if (status === 'confirmed_limited') confirmedCount++;
    else if (status === 'suspected' || status === 'likely') suspectedCount++;
    // === §9 evidenceTags ===
    const evidenceTags = [];
    if (isDeep) evidenceTags.push('deep_penetration');
    if (through) evidenceTags.push('through_and_through');
    if (highEnergy) evidenceTags.push('high_residual_energy');
    if (retained) evidenceTags.push('retained_projectile');
    if (c.type === 'cavity') evidenceTags.push('cavity_track');
    if (hitPart === 'neck') evidenceTags.push('neck_track');
    if (organ === 'femoral_vessel' || organ === 'iliac_vessel' || organ === 'pelvic_bleed') evidenceTags.push(organ === 'femoral_vessel' ? 'junctional_track' : 'pelvis_track');
    if (organ === 'kidney' || organ === 'retroperitoneal_bleed') evidenceTags.push('flank_track');
    if (hitPart === 'chest' && heartNearby) evidenceTags.push('chest_central');
    if (organ === 'heart_hook_only') evidenceTags.push('heart_adjacent_track');
    // === §9/§10 bleedRisk ===
    let bleedRisk;
    if (c.type === 'vessel') bleedRisk = sevHigh ? 'massive' : 'high';
    else if (organ === 'pelvic_bleed' || organ === 'retroperitoneal_bleed') bleedRisk = sevHigh ? 'high' : 'moderate';
    else if (organ === 'liver' || organ === 'spleen') bleedRisk = sevHigh ? 'high' : 'moderate';
    else if (organ === 'lung' || organ === 'kidney') bleedRisk = 'moderate';
    else if (organ === 'bowel' || organ === 'stomach' || organ === 'bladder') bleedRisk = sevHigh ? 'moderate' : 'low';
    else if (organ === 'heart_hook_only') bleedRisk = 'high';
    else if (organ === 'airway' || organ === 'cervical_spine') bleedRisk = 'low';
    else bleedRisk = 'low';
    if (status === 'candidate') bleedRisk = downRisk(bleedRisk);
    if (through && (organ === 'lung' || organ === 'thoracic_vessel')) bleedRisk = upRisk(bleedRisk);   // §10.1
    // === §9/§10 functionRisk ===
    let functionRisk = 'low';
    if (organ === 'airway') functionRisk = isDeep ? 'critical' : 'high';
    else if (organ === 'cervical_spine') functionRisk = through ? 'critical' : 'high';
    else if (organ === 'lung') functionRisk = sevHigh ? 'high' : 'moderate';
    else if (organ === 'carotid_jugular' || organ === 'heart_hook_only') functionRisk = 'high';
    else if (organ === 'limb_bone') functionRisk = 'high';
    else if (c.type === 'vessel' || c.type === 'organ') functionRisk = 'moderate';
    // === §9/§10 priorityScore + 부위별 보정 ===
    let pScore = (BASE_PRIORITY[organ] != null ? BASE_PRIORITY[organ] : 12)
      + (status === 'suspected' ? 12 : status === 'likely' ? 22 : status === 'confirmed_limited' ? 30 : 0)
      + (sevHigh ? 10 : 0) + (through ? 6 : 0)
      + (c.confidence === 'high' ? 8 : c.confidence === 'medium' ? 4 : 0);
    if (hitPart === 'chest' && heartNearby && isDeep && highEnergy) {           // §10.1 central chest
      if (organ === 'thoracic_vessel') pScore += 14;
      if (organ === 'heart_hook_only') pScore += 10;
    }
    if (organ === 'femoral_vessel' && isDeep) pScore += 18;                      // §10.3 groin/thigh — junctional 임상 1순위
    if ((organ === 'iliac_vessel' || organ === 'pelvic_bleed') && isDeep) pScore += 8;
    if (organ === 'carotid_jugular' && isDeep) pScore += 12;                     // §10.4 deep neck
    pScore = Math.max(0, Math.min(100, Math.round(pScore)));
    const clinicalPriority = pScore >= 75 ? 'critical' : pScore >= 55 ? 'high' : pScore >= 35 ? 'moderate' : 'low';
    injuries.push({
      organ, status, injuryScore: Math.round((c.confidence === 'high' ? 60 : c.confidence === 'medium' ? 40 : 20) + (sevHigh ? 20 : 0) + (through ? 10 : 0)),
      priorityScore: pScore, clinicalPriority, bleedRisk, functionRisk, evidenceTags,
      sourceRegion: hitPart || null, trajectoryReason: c.reason || '',
      fieldCareLimit: (c.type === 'vessel' || c.type === 'organ' || c.type === 'cavity') ? 'limited' : 'treatable',
      monitorOnly: organ === 'heart_hook_only',
      bleedingContribution: +(c.type === 'vessel' ? 0.6 : c.type === 'organ' ? 0.4 : 0.2).toFixed(2),
      functionLoss: +(organ === 'lung' && sevHigh ? 0.4 : 0.1).toFixed(2),
      contaminationRisk: +((organ === 'bowel' || organ === 'stomach') ? 0.5 : 0.1).toFixed(2),
      fieldTreatable: (c.type === 'vessel' || c.type === 'organ' || c.type === 'cavity') ? false : 'limited',
      surgeryRequiredCandidate: (c.type === 'organ' || c.type === 'vessel' || c.type === 'cavity') && (status !== 'candidate'),
      reason: c.reason || '', confirmedBy: through ? 'through_path' : (highEnergy ? 'high_energy' : 'candidateMap'), confirmed: status === 'confirmed_limited',
    });
  }
  // §9: 생리적 우선순위 정렬 + 상위 후보 (UI/AAR 표시용 — 확정 표현 금지)
  injuries.sort((a, b) => b.priorityScore - a.priorityScore);
  const _seenOrgan = new Set();
  const topCandidates = [];
  for (const i of injuries) {
    if (_seenOrgan.has(i.organ)) continue;
    _seenOrgan.add(i.organ);
    topCandidates.push({ organ: i.organ, status: i.status, clinicalPriority: i.clinicalPriority, bleedRisk: i.bleedRisk, monitorOnly: !!i.monitorOnly });
    if (topCandidates.length >= 4) break;
  }
  const sevOrder = ['none','candidate','suspected','likely','confirmed_limited'];
  let highestSeverity = 'none';
  for (const inj of injuries) if (sevOrder.indexOf(inj.status) > sevOrder.indexOf(highestSeverity)) highestSeverity = inj.status;
  const surgeryRequiredCandidate = injuries.some(i => i.surgeryRequiredCandidate);
  let evacuationPriority = (ibm && ibm.evacuationPriority) || 'low';
  return { injuries, topCandidates, highestSeverity, surgeryRequiredCandidate, evacuationPriority, confirmedCount, suspectedCount, reason: `${depth}/${injuries.length}inj` };
}
// =============================================================
// SIDE-MED-2C: Massive Hemorrhage Control Model (§5)
// =============================================================
function buildHemorrhageControlModel(bt, ibm, bleedingProfile, hitPart, woundSize) {
  const bp = bleedingProfile || {};
  const isLimb = /arm|leg/.test(hitPart || '');
  const ext = bp.currentExternal || 0;
  const sourceType = (ibm && ibm.sourceType) || 'soft_tissue';
  const sev = (ibm && ibm.severity) || 'none';
  const sevHigh = (sev === 'severe' || sev === 'critical');
  // hemorrhageType
  let hemorrhageType = 'limb_external';
  if (sourceType === 'major_vessel_candidate') hemorrhageType = 'major_vessel_candidate';
  else if (sourceType === 'cavity') hemorrhageType = 'cavity_internal';
  else if (sourceType === 'junctional') hemorrhageType = 'junctional';
  else if (!isLimb && (hitPart === 'chest' || hitPart === 'abdomen' || hitPart === 'neck')) hemorrhageType = 'torso_external';
  else hemorrhageType = 'limb_external';
  // SIDE-MED-2C-HOTFIX-1 §5: woundSize 정상 판정 (object.sizeClass / string / bt.woundSize fallback)
  const sizeClass = (woundSize && woundSize.sizeClass) || (typeof woundSize === 'string' ? woundSize : null) || (typeof bt.woundSize === 'string' ? bt.woundSize : (bt.woundSize && bt.woundSize.sizeClass)) || null;
  const bigWound = (sizeClass === 'large' || sizeClass === 'massive');
  // isMassiveHemorrhage — bigWound는 active external bleeding과 함께일 때만
  const isMassiveHemorrhage = (ext >= 12)
    || (sourceType === 'major_vessel_candidate')
    || (sourceType === 'junctional' && sevHigh)
    || (sevHigh && (hemorrhageType === 'limb_external' || hemorrhageType === 'junctional'))
    || (bigWound && ext > 6 && hemorrhageType !== 'cavity_internal');
  // controllableBy + treatmentEffectLimit
  let controllableBy = [], treatmentEffectLimit = 'full_control_possible';
  if (hemorrhageType === 'limb_external') {
    controllableBy = ['tourniquet','pressure_bandage','hemostatic'];
    treatmentEffectLimit = sevHigh ? 'partial_control_only' : 'full_control_possible';
  } else if (hemorrhageType === 'junctional') {
    controllableBy = ['junctional_pressure','packing','hemostatic'];
    treatmentEffectLimit = sevHigh ? 'partial_control_only' : 'temporary_stabilization';
    if (sev === 'critical') treatmentEffectLimit = 'not_field_controllable';
  } else if (hemorrhageType === 'torso_external') {
    controllableBy = ['pressure_bandage','hemostatic','packing'];
    treatmentEffectLimit = 'partial_control_only';
  } else if (hemorrhageType === 'cavity_internal') {
    controllableBy = ['not_field_controllable'];
    treatmentEffectLimit = 'not_field_controllable';
  } else if (hemorrhageType === 'major_vessel_candidate') {
    controllableBy = isLimb ? ['tourniquet'] : ['not_field_controllable'];
    treatmentEffectLimit = isLimb ? 'partial_control_only' : 'not_field_controllable';
  }
  let controlUrgency = 'none';
  if (isMassiveHemorrhage) controlUrgency = (sev === 'critical') ? 'immediate' : (sevHigh ? 'high' : 'medium');
  else if (ext > 4) controlUrgency = 'low';
  return { isMassiveHemorrhage, hemorrhageType, controllableBy, controlUrgency, treatmentEffectLimit };
}
// 후면 방호구 후보 (인체 완전관통 후)
function _rearArmorCheck(unit, penAfterBody) {
  if (!unit) return { candidate:'none', result:'no_rear_armor', penAfter:penAfterBody, armorValue:0 };
  const plateEff = (pid) => { const p = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[pid] : null; if (!p || p.isNone) return 0; return (p.effectiveArmor != null) ? p.effectiveArmor : (p.hardArmor || 0) + (p.backingArmor || 0); };
  let candidate = 'none', armorValue = 0;
  if (unit.backPlateId && plateEff(unit.backPlateId) > 0) { candidate = 'rear_plate'; armorValue = plateEff(unit.backPlateId); }
  else if (unit.bodyArmorId) { candidate = 'rear_soft'; armorValue = 10; }
  if (candidate === 'none') return { candidate:'none', result:'no_rear_armor', penAfter:penAfterBody, armorValue:0 };
  const blocked = !rollPenetration(penAfterBody, armorValue);
  let result;
  if (blocked) result = (candidate === 'rear_plate') ? 'stopped_by_rear_plate' : 'stopped_by_rear_soft';
  else result = 'rear_armor_penetrated';
  const penAfter = blocked ? 0 : Math.max(0, penAfterBody - armorValue * 0.85);
  return { candidate, result, penAfter, armorValue };
}
// 메인 — bodyTrajectoryContext 생성
// SIDE-MED-BASELINE-1 §5/§6: bodyTrajectoryContext는 '후속 장기·혈관·내부출혈 판단의 척추(상위 맥락)'다. hitPart의 대체물이 아니다.
//   입력값으로 쓰일 필드: impactAddress/entryAddress/exitAddress, hitPart/hitDirection, woundDepthClass,
//   bodyEntered/deepTissueReached/retainedProjectile, bodyThroughAndThrough/targetThroughAndThrough/exitWoundPresent,
//   rearArmorResult, projectileSizeClass, residualVelocity/residualEnergyFactor, internalScores, bleedingClass,
//   organCandidateHints / vesselCandidateHints / majorVesselCandidate.
//   — 이들은 전부 'candidate(후보)' 단계다. confirmed 손상이 아니다. hitPart만으로 장기/혈관을 확정하지 말 것.
//   — surface_only / shallow_entry는 장기·대혈관 후보가 과하게 뜨면 안 되고, deep_penetration 이상부터 hint가 의미를 가진다.
//   — 다음 Organ & Vessel Candidate Mapping 단계에서 이 맥락을 읽어 보정한다(이번 단계에서 confirmed로 승격 금지).
// =============================================================
// [심층의료 계약면 §9.2 — PRETRAUMA-STAB-1] trajectory → candidateMap.
//   candidateMap(organ/vessel/cavity 후보 지도)은 여기서 단일 생성된다 — 중복 생성 금지.
//   TODO(SIDE-TRAUMA-CANDIDATE-REFINE-1): 기존 후보에 priorityScore / clinicalPriority /
//   bleedRisk / functionRisk 확장 필드 추가 예정 (새 후보 시스템 금지, refine만).
// =============================================================
function buildBodyTrajectoryContext(unit, ev, penState) {
  const ammo = (ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null;
  // [0.39.5 §2] canonical projectile profile 우선 — packet.projectileProfile → event.projectileProfile → canonical builder.
  //   raw ammo.terminalProfile은 canonical 생성 자체가 불가능할 때만(legacy) 사용. raw를 consumer가 직접 우선하지 않는다.
  const _canonProfile = (ev.impactPacket && ev.impactPacket.projectileProfile)
    || ev.projectileProfile
    || ((typeof getCanonicalProjectileProfile === 'function' && ammo) ? getCanonicalProjectileProfile(ammo) : null);
  // terminal family는 canonical terminalBehaviorClass에서 파생(mutation-proof). per-ammo tuning multiplier는 raw에서(밸런스 보존).
  //   raw terminalProfile은 canonical이 전무할 때만 통째로 사용.
  const _rawTP = (ammo && ammo.terminalProfile) || (ev.ammoId && typeof AMMO_TERMINAL_PROFILE !== 'undefined' ? AMMO_TERMINAL_PROFILE[ev.ammoId] : null) || null;
  const profile = _canonProfile
    ? { family: _canonProfile.terminalBehaviorClass, _fromCanonical: true,
        apLike: _canonProfile.apLike, heavySlow: _canonProfile.heavySlow, barrierBlind: _canonProfile.barrierBlind,
        fragmentingLike: _canonProfile.fragmentingLike, expandingLike: _canonProfile.expandingLike,
        subsonicClass: _canonProfile.subsonicClass, diameterMm: _canonProfile.diameterMm, massG: _canonProfile.massG,
        // per-ammo tuning (raw) — family는 canonical이 override하므로 raw family 변조에 불변
        woundChannel: _rawTP ? _rawTP.woundChannel : undefined,
        tissueCrushMul: _rawTP ? _rawTP.tissueCrushMul : undefined,
        temporaryCavityMul: _rawTP ? _rawTP.temporaryCavityMul : undefined,
        boneBreakMul: _rawTP ? _rawTP.boneBreakMul : undefined,
        exitWoundMul: _rawTP ? _rawTP.exitWoundMul : undefined,
        retainedProjectileChance: _rawTP ? _rawTP.retainedProjectileChance : undefined,
        overpenetrationTendency: _rawTP ? _rawTP.overpenetrationTendency : undefined,
        yawTendency: _rawTP ? _rawTP.yawTendency : undefined,
        fragmentationTendency: _rawTP ? _rawTP.fragmentationTendency : undefined,
        armorAfterEffect: _rawTP ? _rawTP.armorAfterEffect : undefined }
    : _rawTP;
  const ia = ev.impactAddress || {};
  if (ia && !ia.medical) { try { ia.medical = normalizeMedicalImpactAddress(ia, ev); } catch (e) {} }   // SIDE-MEDICAL-TRAUMA-BRIDGE-1 §5
  const hitPart = ev.hitPart || ia.hitPart || 'chest';
  const isFrag = (ev.sourceType === 'frag' && ev.isFragment === true);
  const stopped = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed' || ev.armorResult === 'deflected');
  const br = BODY_RESISTANCE[hitPart] || BODY_RESISTANCE.chest;
  const mods = _bodyTerminalMods(profile);
  const eac = ev._entryArmorContext || (ev.armorHitResult && ev.armorHitResult.entryArmorContext) || null;
  // 인체 진입 전 관통력 — [0.39.3 A-Closure] canonical residual 우선(impactPacket → eac → impactAddress).
  //   명시적 residualPen 0은 penBefore=0으로 보존 — ammo.penetration fallback으로 부활 금지.
  let penBefore;
  const _crt = (typeof _normalizeResidualThreat === 'function') ? _normalizeResidualThreat(ev) : null;
  if (isFrag) penBefore = (ev.penetration != null) ? ev.penetration : 4;
  else if (eac && (eac.entryArmorResult === 'hard_block' || eac.entryArmorResult === 'soft_block' || eac.entryArmorResult === 'hard_pen_soft_block')) {
    penBefore = 0;   // 방호 정지 또는 hard관통-backer정지 → 인체 진입 위협 없음(둔상은 별도)
  }
  else if (stopped) penBefore = 0;
  else if (_crt && _crt.residualPenPresent) penBefore = Math.max(0, _crt.residualPen);   // canonical 실제 잔여값(명시적 0 포함) 지배
  else if (eac && eac.residualThreatPacket && eac.residualThreatPacket.residualPen != null) penBefore = eac.residualThreatPacket.residualPen;
  else if (eac && eac.entryPenAfterArmor != null) penBefore = eac.entryPenAfterArmor;
  else {
    // 데이터 누락(residualPenPresent=false)일 때만 legacy fallback
    const base = (ammo && ammo.penetration != null) ? ammo.penetration : (ev.penetration != null ? ev.penetration : 12);
    const hadArmor = !!(ia.armorLayer || (ev.armorHitResult && ev.armorHitResult.protectionType && ev.armorHitResult.protectionType !== 'none'));
    penBefore = base * (hadArmor ? 0.65 : 1.0);
  }
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
  // 파편 보수화 — size별 상한
  if (isFrag) {
    const fs = ev.fragmentSize || 'small';
    if (fs === 'small' && (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through')) { depth = 'shallow_entry'; deepTissue = false; exitWound = false; bttt = false; nearExit = false; retained = true; }
    else if (fs === 'medium' && (depth === 'near_exit_lodged' || depth === 'body_through_and_through')) { depth = 'deep_penetration'; exitWound = false; bttt = false; nearExit = false; retained = true; }
    else if (fs === 'large' && depth === 'body_through_and_through') { depth = 'near_exit_lodged'; exitWound = false; bttt = false; nearExit = true; retained = true; }   // large도 사출구 거의 금지
  }
  const penAfterBody = bttt ? Math.max(0, penBefore - cost) : 0;
  // retained 확률 보정 (terminal retainBias) — near_exit/shallow/deep에서만 의미
  if (retained && profile && profile.retainedProjectileChance != null) {
    const rc = Math.min(0.95, Math.max(0.02, profile.retainedProjectileChance + mods.retainBias + (nearExit ? 0.3 : 0)));
    if (depth === 'deep_penetration' && Math.random() > rc) retained = false;   // 깊은 관통은 일부 미잔류(조직 통과)
  }
  // 후면 방호구 (인체 완전관통 시) — entry 맥락 기반 후보 선택 + 실제 판정 + 내구도 (resolveRearArmorInteraction)
  const isTorso = (hitPart === 'chest' || hitPart === 'abdomen');
  const isLimb = (hitPart === 'left_arm' || hitPart === 'right_arm' || hitPart === 'arms' || hitPart === 'left_leg' || hitPart === 'right_leg' || hitPart === 'legs');
  const entryAspect = (eac && eac.entryAspect) || ia.impactSide || 'front';
  let rear = { candidate:'none', rearArmorResult:null, penAfter:0, armorValue:0 };
  let rearInteraction = null;
  let targetTtt = false, limbTtt = false, continueRaycast = false, contPacket = null;
  if (bttt && !isFrag && isTorso) {
    rearInteraction = resolveRearArmorInteraction({ unit, hitPart, entryAspect, entryArmorContext: eac, penAfterBody, ammo, weapon: null });
    rear = rearInteraction;
    const rr = rearInteraction.rearArmorResult;
    if (rr === 'rear_armor_penetrated') targetTtt = (rearInteraction.penAfter >= 6);
    else if (rr === 'no_rear_armor') targetTtt = (penAfterBody >= 6);
    // 후면 방호구 정지면 targetTtt=false, continuation 금지
    if ((rr === 'no_rear_armor' || rr === 'rear_armor_penetrated') && rearInteraction.penAfter >= 6) continueRaycast = true;
  } else if (bttt && !isFrag && isLimb) {
    rear = { candidate:'none', rearArmorResult:'not_applicable_limb', penAfter:penAfterBody, armorValue:0 };
    limbTtt = (penAfterBody >= 6);
    if (penAfterBody >= 6) continueRaycast = true;
  } else if (bttt && !isFrag) {
    rear = { candidate:'none', rearArmorResult:'no_rear_armor', penAfter:penAfterBody, armorValue:0 };
  } else if (isFrag && bttt) {
    rear = { candidate:'none', rearArmorResult:'not_applicable_fragment', penAfter:0, armorValue:0 };
  }
  const _rearResult = rear.rearArmorResult || rear.result || null;
  if (continueRaycast) {
    contPacket = {
      originalAmmoId: ev.ammoId || null, sourceType: ev.sourceType || 'bullet',
      residualPen: +(rear.penAfter||0).toFixed(1), residualDamage: +((ev.rawDamage || 0) * 0.4).toFixed(1),
      velocityMul: 0.5, residualBleedMul: 0.55,
      yawState: mods.channel === 'expanding' ? 'destabilized' : 'stable',
      deformationState: /expand/.test(mods.fam) ? 'expanded' : 'intact',
      fragmentationState: /frangible|fragmenting/.test(mods.fam) ? 'fragmented' : 'none',
      exitedFromBody: true, exitedFromRearArmor: (_rearResult === 'rear_armor_penetrated'), exitedFromLimb: isLimb,
      previousTargetId: unit.id, continuationDepth: ((ev._continuationDepth || 0) + 1),
      // [0.39.6 §8-2] canonical projectile profile을 2차 표적까지 유지 (secondary continuation이 재추측하지 않도록)
      projectileProfile: _canonProfile ? {
        massG: _canonProfile.massG, diameterMm: _canonProfile.diameterMm, subsonicClass: _canonProfile.subsonicClass,
        armorThreatClass: _canonProfile.armorThreatClass, terminalBehaviorClass: _canonProfile.terminalBehaviorClass,
        apLike: _canonProfile.apLike, barrierBlind: _canonProfile.barrierBlind, heavySlow: _canonProfile.heavySlow,
      } : null,
    };
  }
  const bleedingClass = classifyBleedingClass(depth, hitPart, ia, deepTissue);
  // === HOTFIX-1: 잔여 탄속/에너지 (관통력과 역할 분리) ===
  const vNow = (ev._shotVelocity != null) ? ev._shotVelocity : null;
  const vInit = (ev._shotInitialVelocity != null && ev._shotInitialVelocity > 0) ? ev._shotInitialVelocity : null;
  let velocityRatio = (vNow != null && vInit != null) ? Math.max(0, Math.min(1, vNow / vInit)) : (isFrag ? 0.4 : 0.85);
  const residualEnergyFactor = +(velocityRatio * velocityRatio).toFixed(3);   // 에너지 ~ v²
  // === HOTFIX-1: projectileSizeClass + 내부 스코어 ===
  const sizeClass = _projectileSizeClass(ammo, profile, ev);
  const szMod = _PROJ_SIZE_MODS[sizeClass] || _PROJ_SIZE_MODS.intermediate_rifle;
  const crushMul = (profile && profile.tissueCrushMul != null) ? profile.tissueCrushMul : 1.0;
  // SIDE-MED-2B-1A: 정밀 후보 지도 (projectileSizeClass/terminal/crush 반영). 기존 문자열 hint는 map에서 파생.
  //   sizeClass/crushMul 정의 이후에 호출 (TDZ 방지).
  // PRECARDIAC-1: terminalFam에 woundChannel 합성 — JHP/expanding의 sevBias+1 의도 복원 (heart 후보 §10 표시 가능성)
  const candMap = buildOrganVesselCandidateMap(hitPart, ia, depth, deepTissue, sizeClass, ((mods.fam || '') + ' ' + (mods.channel || '')), (crushMul - 1));
  const hints = { organ: candMap.organStrings, vessel: candMap.vesselStrings };
  // major_vessel_candidate 승격 (후보 단계 — confirmed 아님)
  let majorVessel = false;
  if (hints.vessel.some(v => /carotid|femoral|iliac|axillary|aort|thoracic|abdominal_vessel/.test(v)) && (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through')) majorVessel = true;
  const cavityMul = (profile && profile.temporaryCavityMul != null) ? profile.temporaryCavityMul : 1.0;
  const boneMul = (profile && profile.boneBreakMul != null) ? profile.boneBreakMul : 1.0;
  const depthScoreMap = { surface_only:0.1, shallow_entry:0.35, deep_penetration:0.7, near_exit_lodged:0.85, body_through_and_through:1.0 };
  const penetrationDepthScore = depthScoreMap[depth] != null ? depthScoreMap[depth] : 0.5;
  const crushDamageScore = +(crushMul * szMod.crush * (deepTissue ? 1.0 : 0.5)).toFixed(2);
  // temporary cavity는 잔여에너지에 강하게 의존 (저속탄 과장 금지)
  const temporaryCavityScore = +(cavityMul * szMod.cavity * residualEnergyFactor * (deepTissue ? 1.0 : 0.4)).toFixed(2);
  const boneRiskScore = +(boneMul * szMod.bone * (deepTissue ? 1.0 : 0.4)).toFixed(2);
  const bleedSevBase = { no_bleed_or_minor:0.1, superficial_bleed:0.3, external_controllable_bleed:0.5, muscle_bleed:0.65, junctional_bleed:0.8, cavity_internal_bleed:0.85, major_vessel_candidate:1.0 };
  let bleedingSeverityScore = +(((bleedSevBase[bleedingClass] != null ? bleedSevBase[bleedingClass] : 0.4) * (0.7 + crushMul * 0.3)) * (majorVessel ? 1.15 : 1.0)).toFixed(2);
  bleedingSeverityScore = Math.min(1.2, bleedingSeverityScore);
  const shockContributionScore = +(temporaryCavityScore * 0.5 + (br.cavity ? 0.3 : 0.1) + (bleedingClass === 'cavity_internal_bleed' ? 0.2 : 0)).toFixed(2);
  // 잔여 위협 packet에 탄속/에너지 반영
  if (contPacket) { contPacket.residualVelocity = vNow != null ? Math.round(vNow * 0.5) : null; contPacket.velocityMul = +(0.4 + velocityRatio * 0.3).toFixed(2); contPacket.residualEnergyFactor = +(residualEnergyFactor * 0.4).toFixed(3); contPacket.projectileSizeClass = sizeClass; }
  // === HOTFIX-2 §3: 사출구 크기 등급 (생성 여부와 분리, 내부보다 크지 않게, AP/sabot 작게) ===
  let exitSizeClass = null, exitSizeScore = 0;
  const exitMulP = (profile && profile.exitWoundMul != null) ? profile.exitWoundMul : szMod.exit;
  if (exitWound) {
    const internalScore = depthScoreMap[depth] || 0.7;
    // 사출구 점수 = 잔여에너지 × exitMul × sizeClass exit성향
    let exScore = (0.35 + residualEnergyFactor * 0.5) * exitMulP * szMod.exit;
    // expand/large_bore/full_power는 사출구↑, AP/sabot은 억제
    if (/expand/.test(mods.fam) || sizeClass === 'large_bore' || sizeClass === 'shotgun_slug') exScore *= 1.25;
    if (sizeClass === 'sabot_subcaliber' || sizeClass === 'anti_material' || /ap|penetrator|narrow/.test(mods.fam)) exScore *= 0.7;
    const ORDER = ['micro','small','medium','large'];
    let cls = exScore < 0.35 ? 'micro' : exScore < 0.6 ? 'small' : exScore < 0.95 ? 'medium' : 'large';
    // 내부 상처보다 크지 않게 clamp
    const intCls = depth === 'body_through_and_through' ? 'large' : depth === 'deep_penetration' ? 'medium' : 'small';
    if (ORDER.indexOf(cls) > ORDER.indexOf(intCls)) cls = intCls;
    if (cls === 'micro' && exitWound) cls = 'small';   // 사출구 있으면 최소 small
    exitSizeClass = cls; exitSizeScore = +(exScore).toFixed(2);
    // SHOTGUN-MED-NORM-1 §12: 산탄 펠릿 사출구 clamp (slug 미적용)
    const _pelletMeta = getMedicalProjectileMeta(ammo, ev);
    if (_pelletMeta.isShotgunPellet) {
      exitSizeClass = clampWoundClass(exitSizeClass, _pelletMeta.maxExitClass);
      if (_pelletMeta.isFlechette) { exitSizeClass = clampWoundClass(exitSizeClass, 'small'); exitSizeScore = Math.min(exitSizeScore, 0.45); }
      if (_pelletMeta.isBuckshot) { exitSizeClass = clampWoundClass(exitSizeClass, 'small'); exitSizeScore = Math.min(exitSizeScore, 0.55); }
    }
  }
  const _EXIT_KO = { micro:'미세', small:'소형', medium:'중형', large:'대형' };
  const exitWoundLabel = exitWound ? (_EXIT_KO[exitSizeClass] || exitSizeClass) : (retained ? '체내 잔류' : '없음');
  return {
    sourceType: ev.sourceType || 'bullet', ammoId: ev.ammoId || null,
    terminalEffectType: mods.fam || null, woundChannelType: mods.channel,
    impactAddress: ia, entryAddress: ia, exitAddress: exitWound ? Object.assign({}, ia, { _exit:true }) : null,
    hitPart, hitDirection: ia.impactSide || ia.side || null,
    bodyPartResistanceKey: hitPart, bodyResistanceClass: br.cls,
    projectilePenBeforeBody: +penBefore.toFixed(1), bodyPenetrationCost: +cost.toFixed(1), projectilePenAfterBody: +penAfterBody.toFixed(1),
    skinEntryPassed: penBefore >= skinEntry, bodyEntered, deepTissueReached: deepTissue,
    woundDepthClass: depth, bodyThroughAndThrough: bttt,
    nearExitLodged: nearExit, retainedProjectile: retained, retainedLocation: retained ? (nearExit ? 'near_exit_subcutaneous' : 'internal_track') : null,
    exitWound,
    rearArmorChecked: (bttt && isTorso), rearArmorCandidate: rear.candidate, rearArmorResult: _rearResult,
    rearArmorCandidateLayer: rear.candidateLayer || null, rearArmorCandidateReason: rear.candidateReason || null,
    rearArmorValue: rear.armorValue || 0, rearArmorMaterial: rear.material || null, rearDurabilitySlotKey: rear.durabilitySlotKey || null,
    rearArmorInteraction: rearInteraction || null, exitAspect: (rear.exitAspect) || (rearInteraction && rearInteraction.exitAspect) || null,
    projectilePenBeforeRearArmor: bttt ? +penAfterBody.toFixed(1) : 0, projectilePenAfterRearArmor: +(rear.penAfter || 0).toFixed(1),
    retainedInRearArmor: (_rearResult === 'stopped_by_rear_plate' || _rearResult === 'stopped_by_rear_soft'),
    targetThroughAndThrough: targetTtt, limbThroughAndThrough: limbTtt, continueRaycast, continuationThreatPacket: contPacket,
    exitWoundPresent: exitWound, exitSizeClass, exitSizeScore, exitWoundMul: +exitMulP.toFixed(2), exitWoundLabel,
    bleedingClass, organCandidateHints: hints.organ, vesselCandidateHints: hints.vessel, majorVesselCandidate: majorVessel,
    normalizedMedicalAddress: ia.medical || null,
    // SIDE-MED-2B-1A: 정밀 후보 지도(구조화) + 처치 적응증 태그 (candidate 단계 — confirmed 아님)
    candidateMap: candMap.candidates,
    treatmentIndicationTags: _deriveTreatmentIndicationTags(candMap, bleedingClass, depth, majorVessel, hitPart, ia),
    // entry 방호 맥락 (의료/탄도 메타)
    entryArmorContext: eac, entryLayerClass: eac && eac.entryLayerClass, entryLayerSlot: eac && eac.entryLayerSlot,
    entryArmorResult: eac && eac.entryArmorResult, entryPenAfterArmor: eac && eac.entryPenAfterArmor,
    // HOTFIX-1: 탄 크기 / 잔여 탄속·에너지 / 내부 스코어
    projectileSizeClass: sizeClass, velocityRatio: +velocityRatio.toFixed(3), residualEnergyFactor,
    internalScores: { penetrationDepthScore, crushDamageScore, temporaryCavityScore, boneRiskScore, bleedingSeverityScore, shockContributionScore },
    futureOrganHook: true, futureVesselHook: true, futureMedicalHook: true,
  };
}
// bodyTrajectory 한 줄 요약 (AAR/wound)
const _WOUND_DEPTH_KO = { surface_only:'표면 손상', shallow_entry:'얕은 침투', deep_penetration:'깊은 관통', near_exit_lodged:'관통 직전 체내 잔류', body_through_and_through:'인체 완전관통' };
const _BLEED_CLASS_KO = { no_bleed_or_minor:'출혈 없음/경미', superficial_bleed:'표재성 출혈', external_controllable_bleed:'외부 통제가능 출혈', muscle_bleed:'근육층 출혈', junctional_bleed:'접합부 출혈', cavity_internal_bleed:'체강 내부출혈 후보', major_vessel_candidate:'대혈관 후보' };
const _REAR_RESULT_KO = { stopped_by_rear_soft:'후면 소프트아머 정지', stopped_by_rear_plate:'후면 플레이트 정지', retained_in_rear_armor:'후면 방호구 잔류', rear_armor_penetrated:'후면 방호구 관통', rear_armor_deflected:'후면 편향', no_rear_armor:'후면 방호구 없음', target_through_and_through:'표적 완전관통', not_applicable_limb:'사지(후면 방호 해당없음)', not_applicable_fragment:'파편(후면 방호 해당없음)' };
// SIDE-MED-BALLISTIC-2C-1 §15/§16: 깔끔한 요약 (raw key는 debug에만)
function entryArmorSummaryLabel(bt) {
  const eac = bt && bt.entryArmorContext;
  if (!eac) return '비방호';
  const r = eac.entryArmorResult;
  const cls = eac.entryLayerClass;
  if (r === 'unprotected_hit') return '비방호';
  if (r === 'hard_block') return '전면 하드 방호 저지';
  if (r === 'soft_block') return '전면 소프트 방호 저지';
  if (r === 'hard_pen_soft_block') return '전면 하드 관통 · 백커 저지';
  if (r === 'penetrated') return cls === 'hard' ? '전면 하드 방호 관통' : cls === 'soft' ? '전면 소프트 관통' : '관통';
  if (r === 'deflected') return '전면 방호 편향';
  if (r === 'ricocheted') return '전면 방호 도탄';
  return cls === 'none' ? '비방호' : '전면 방호';
}
function rearArmorSummaryLabel(bt) {
  if (!bt || !bt.rearArmorChecked) return '';
  const rr = bt.rearArmorResult;
  if (!rr || rr === 'no_rear_armor') return '후면 방호구 없음';
  return _REAR_RESULT_KO[rr] || rr;
}
function continuationSummaryLabel(bt) {
  if (!bt) return '';
  if (bt.continueRaycast) return '후속 탄도 생성';
  if (bt.targetThroughAndThrough) return '표적 완전관통';
  if (bt.rearArmorResult === 'stopped_by_rear_plate' || bt.rearArmorResult === 'stopped_by_rear_soft') return '후속 탄도 없음(후면 방호 정지)';
  if (bt.retainedProjectile) return '후속 탄도 없음(체내 잔류)';
  return '후속 탄도 없음';
}
function bodyTrajectorySummaryLabel(bt) {
  if (!bt) return '';
  const parts = [];
  let path = _WOUND_DEPTH_KO[bt.woundDepthClass] || bt.woundDepthClass;
  if (bt.exitWoundPresent) path += ' / 사출구 ' + (bt.exitWoundLabel || '있음'); else if (bt.retainedProjectile) path += ' / 체내 잔류'; else path += ' / 사출구 없음';
  parts.push('상처 경로: ' + path);
  if (bt.rearArmorChecked && bt.rearArmorResult && bt.rearArmorResult !== 'no_rear_armor') parts.push('후면: ' + (_REAR_RESULT_KO[bt.rearArmorResult] || bt.rearArmorResult));
  if (bt.continueRaycast) parts.push('후속 탄도 생성(잔여위협)');
  // 탄자 등급 + 내부 피해 경향 (debug/detail)
  const SZ_KO = { micro_fragment:'미세 파편', pellet:'펠릿', small_pdw:'소형 PDW', sabot_subcaliber:'사보 관통자', pistol:'권총탄', intermediate_rifle:'중간형 소총탄', full_power_rifle:'풀파워 소총탄', large_bore:'대구경', shotgun_slug:'슬러그', anti_material:'대물탄' };
  if (bt.projectileSizeClass) parts.push('탄자 등급: ' + (SZ_KO[bt.projectileSizeClass] || bt.projectileSizeClass));
  const sc = bt.internalScores;
  if (sc) { const lo=(v)=>v<0.5?'낮음':v<0.9?'중간':'높음'; parts.push('내부 피해: crush ' + lo(sc.crushDamageScore) + ' / cavity ' + lo(sc.temporaryCavityScore)); }
  parts.push('출혈 분류: ' + ((bt.majorVesselCandidate ? _BLEED_CLASS_KO.major_vessel_candidate + ' / ' : '') + (_BLEED_CLASS_KO[bt.bleedingClass] || bt.bleedingClass)));
  if (bt.vesselCandidateHints && bt.vesselCandidateHints.length) parts.push('혈관 후보: ' + bt.vesselCandidateHints.join(', '));
  return parts.join(' · ');
}
// =============================================================
