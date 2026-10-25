// SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1: confirmed_physiologic 레이어
//   기존 candidate/suspected/likely/confirmed_limited 위에 "실제 생리효과" 확정 손상을 얹는다.
//   wound 생성 시 1회만 계산(결정론적, 무작위 없음). tick은 physiologicEffectProfile을 읽기만 한다.
//   안전: surface_only/shallow_entry/armor-stopped/얕은 진입 → 생리 확정 금지(빈 모델). micro fragment 과장 금지.
// =============================================================
function buildPhysiologicInjuryModel(w, bt, unit) {
  const empty = { physiologicInjuries: [], physiologicSeverity: 0, physiologicTags: [], physiologicEffectProfile: null };
  if (!w || !bt || !bt.bodyEntered) return empty;
  const depth = bt.woundDepthClass || 'surface_only';
  // 깊이 게이트 — 표면/얕은 진입은 깊은 장기/혈관 확정 금지
  if (depth === 'surface_only' || depth === 'shallow_entry') return empty;
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  if (!isDeep || !bt.deepTissueReached) return empty;
  const through = (depth === 'body_through_and_through');
  const nearExit = (depth === 'near_exit_lodged');
  const ref = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const sc = bt.internalScores || {};
  const tempCavity = sc.temporaryCavityScore || 0;
  const crush = sc.crushDamageScore || 0;
  const fam = (bt.terminalEffectType || '') + ' ' + (bt.woundChannelType || '');
  const size = bt.projectileSizeClass || '';
  const microFrag = (size === 'micro_fragment' || size === 'small');
  const retained = !!bt.retainedProjectile;
  const expanding = /expand|jhp|hollow/.test(fam);
  const fragmenting = /fragment|frangible/.test(fam);
  const highEnergyAmmo = expanding || fragmenting || size === 'large_bore' || size === 'shotgun_slug' || size === 'anti_material' || size === 'full_power_rifle';
  const cm = bt.candidateMap || [];
  const oim = w.organInjuryModel || null;
  const ctm = w.chestTraumaModel || null;
  const ibm = w.internalBleedingModel || null;
  const ia = bt.impactAddress || {};
  const addr = ((ia.zone||'') + ' ' + (ia.subZone||'') + ' ' + (ia.impactSide||ia.side||'') + ' ' + (ia.limbLocation||'') + ' ' + (ia.anatomicalZone||'')).toLowerCase();
  const hitPart = bt.hitPart || w.partKey || '';
  const isLimb = /arm|leg/.test(hitPart);
  const matchAny = (re) => re.test(addr);

  // 공통 승격 게이트 강도 (0~1.2)
  let gate = 0;
  if (isDeep) gate += 0.40;
  if (through) gate += 0.20; else if (nearExit) gate += 0.10;
  if (ref >= 0.6) gate += 0.20; else if (ref >= 0.35) gate += 0.10;
  if (tempCavity >= 0.9) gate += 0.08;
  if (crush >= 0.9) gate += 0.05;
  if (retained) gate += 0.05;            // 강화: 잔류
  if (highEnergyAmmo) gate += 0.08;      // 강화: 고에너지/팽창/파편
  if (bt._coverPenetratedDestabilized) gate += 0.05;   // 강화: 관통-cover 후 불안정화(선택적 hook)
  if (matchAny(/proximal|medial|central|upper/)) gate += 0.04;   // 강화: 근위/내측/중심
  if (microFrag && !through) gate -= 0.28;   // 감쇠: 미세 파편
  if (bt.armorResult === 'stopped' || bt.armorResult === 'absorbed') gate -= 0.6;   // 감쇠: 방호 정지
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1 §3-D: 세부주소 physiologyMul을 승격 gate에 약하게 반영 (critical/vascular는 1.0 → 무영향)
  const _hapPhys = (ia && ia.hitAddressDamageProfile && ia.hitAddressDamageProfile.physiologyMul != null) ? ia.hitAddressDamageProfile.physiologyMul
                 : ((w.damageAttenuationProfile && w.damageAttenuationProfile.physiologyMul != null) ? w.damageAttenuationProfile.physiologyMul : 1.0);
  gate *= (0.85 + _hapPhys * 0.15);
  gate = Math.max(0, Math.min(1.2, gate));

  const injuries = [];
  const tags = new Set();
  const addInj = (id, organ, type, severity, source, effects) => {
    injuries.push({ id, organ, type, severity: +Math.max(0, Math.min(1, severity)).toFixed(2), source, effects, confirmed: true, confirmedLevel: 'confirmed_physiologic' });
  };

  // ===== 4. 폐 손상 루프 =====
  if (ctm && (ctm.lungInjuryCandidate || (ctm.lungInjuryStatus && ctm.lungInjuryStatus !== 'none') || ctm.openChestWound)) {
    const ls = ctm.lungInjuryStatus;
    const promote = (ls === 'likely') || (ls === 'suspected' && gate >= 0.60) || (through && gate >= 0.70 && ctm.lungInjuryCandidate);
    if (promote) {
      const sev = Math.min(1, 0.40 + ref*0.30 + (through?0.15:0) + (highEnergyAmmo?0.10:0) + ((ctm.hemothoraxRisk||0)>0.4?0.10:0));
      addInj(through ? 'lung_penetrating' : 'lung_laceration', 'lung', 'lung_injury', sev, 'chestTraumaModel', {
        breathingDrain: +(0.04 + sev*0.06).toFixed(3),
        oxygenDrain: +(0.02 + sev*0.04).toFixed(3),
        pneumothoraxBoost: +(0.05 + (ctm.pneumothoraxRisk||0)*0.10).toFixed(3),
        hemothoraxBoost: +((ctm.hemothoraxRisk||0)*0.15).toFixed(3),
        internalBleedBoost: ((ctm.hemothoraxRisk||0) >= 0.5) ? +(0.05*(1+sev)).toFixed(3) : 0,   // 혈흉 강하면 internal 일부
      });
      tags.add('PHYS-LUNG');
      if ((ctm.hemothoraxRisk||0) >= 0.5) tags.add('PHYS-HEMOTHORAX');
    }
  }

  // ===== 5. 실질장기 출혈 루프 =====
  if (oim && oim.injuries) {
    const seen = new Set();
    for (const inj of oim.injuries) {
      if (!(inj.organ === 'liver' || inj.organ === 'spleen' || inj.organ === 'kidney' || inj.organ === 'retroperitoneal_bleed')) continue;
      if (seen.has(inj.organ)) continue;
      const strong = (inj.status === 'confirmed_limited') || (inj.status === 'likely' && gate >= 0.55) || (inj.status === 'suspected' && gate >= 0.80 && highEnergyAmmo);
      if (!strong) continue;
      seen.add(inj.organ);
      const kidneyDamp = (inj.organ === 'kidney') ? 0.78 : 1.0;   // kidney는 즉시 대량출혈 약간 낮게
      const sev = Math.min(1, (0.40 + ref*0.25 + (through?0.12:0) + (highEnergyAmmo?0.12:0)) * kidneyDamp);
      const solidStrong = (inj.organ === 'liver' || inj.organ === 'spleen');   // spleen/liver 고에너지 internal 가중 큼
      addInj(inj.organ + '_laceration', inj.organ, 'solid_organ_injury', sev, 'organInjuryModel', {
        internalBleedBoost: +((solidStrong ? 0.11 : 0.06) * (1 + (highEnergyAmmo?0.45:0)) * kidneyDamp).toFixed(3),
        shockBoost: +(0.03 + sev*0.05).toFixed(3),
      });
      tags.add('PHYS-SOLID-ORGAN'); tags.add('SURGERY-REQ');
    }
  }

  // ===== 6. 대혈관 출혈 루프 (매우 강력 → 보수적) =====
  if (oim && oim.injuries) {
    const seen = new Set();
    for (const inj of oim.injuries) {
      const vesselSet = ['femoral_vessel','iliac_vessel','carotid_jugular','thoracic_vessel','axillary_vessel','abdominal_vessel'];
      if (vesselSet.indexOf(inj.organ) < 0) continue;
      if (seen.has(inj.organ)) continue;
      // 부위별 주소 일치
      let addrOk = true;
      if (inj.organ === 'femoral_vessel') addrOk = matchAny(/groin|thigh|femoral|inguinal|proximal|pelvis|lower_?abdomen|medial/) && !matchAny(/distal|lower_?leg|foot|knee|calf/);
      else if (inj.organ === 'iliac_vessel' || inj.organ === 'abdominal_vessel') addrOk = matchAny(/pelvis|lower_?abdomen|groin|iliac|central|upper_?abdomen|flank/);
      else if (inj.organ === 'carotid_jugular') addrOk = (hitPart === 'neck') || matchAny(/neck|carotid|jugular|cervical/);
      else if (inj.organ === 'thoracic_vessel') addrOk = (hitPart === 'chest') || matchAny(/center|central|upper|plate_?core|thorax/);
      else if (inj.organ === 'axillary_vessel') addrOk = matchAny(/axilla|armshoulder|shoulder|subclavian/);
      // 사지 원위부 femoral 확정 금지
      if (isLimb && inj.organ === 'femoral_vessel' && matchAny(/distal|lower_?leg|foot|knee|calf/)) addrOk = false;
      const strong = addrOk && bt.deepTissueReached && ((inj.status === 'confirmed_limited') || (inj.status === 'likely' && gate >= 0.70));
      if (!strong) continue;
      seen.add(inj.organ);
      const sev = Math.min(1, 0.55 + ref*0.25 + (through?0.10:0));
      const internalVessel = (inj.organ === 'thoracic_vessel' || inj.organ === 'iliac_vessel' || inj.organ === 'abdominal_vessel');
      const eff = { majorVesselMul: +(1.6 + sev*0.6).toFixed(2), shockBoost: +(0.06 + sev*0.08).toFixed(3), preArrestBoost: +(0.04 + sev*0.06).toFixed(3) };
      if (internalVessel) eff.internalBleedBoost = +(0.14 * (1 + sev)).toFixed(3);
      else eff.externalBleedBoost = +(0.12 * (1 + sev)).toFixed(3);
      let injId, label;
      if (inj.organ === 'femoral_vessel') injId = 'femoral_artery_injury';
      else if (inj.organ === 'iliac_vessel') injId = 'iliac_vessel_injury';
      else if (inj.organ === 'carotid_jugular') injId = 'carotid_jugular_injury';
      else if (inj.organ === 'thoracic_vessel') injId = 'thoracic_great_vessel_injury';
      else if (inj.organ === 'axillary_vessel') injId = 'axillary_subclavian_injury';
      else injId = inj.organ + '_injury';
      addInj(injId, inj.organ, 'major_vessel_injury', sev, 'organInjuryModel', eff);
      tags.add('PHYS-MAJOR-VESSEL'); tags.add('EVAC-URGENT'); tags.add('SURGERY-REQ');
    }
  }

  // ===== 7. 심장 리듬 위험 연결 (확정 손상 아님 — risk 강화 전용) =====
  const heartAdjacent = cm.some(c => c.id === 'heart_candidate') || (oim && oim.injuries && oim.injuries.some(i => i.organ === 'heart_hook_only'));
  const thoracicVesselPhys = injuries.some(i => i.organ === 'thoracic_vessel');
  const severeChest = ctm && ((ctm.lungInjuryStatus === 'likely') || (ctm.hemothoraxRisk||0) >= 0.5);
  if ((heartAdjacent && hitPart === 'chest' && bt.deepTissueReached && gate >= 0.60) || thoracicVesselPhys || severeChest) {
    const riskBoost = Math.min(0.6, 0.15 + (heartAdjacent?0.15:0) + (thoracicVesselPhys?0.20:0) + (severeChest?0.10:0) + ref*0.10);
    injuries.push({ id:'cardiac_rhythm_risk', organ:'heart', type:'cardiac_rhythm_risk', severity:+riskBoost.toFixed(2), source:'preCardiacRisk',
      effects:{ rhythmRiskBoost:+riskBoost.toFixed(3), perfusingRhythmPenalty:+(riskBoost*0.3).toFixed(3) }, confirmed:false, confirmedLevel:'risk_only' });
    tags.add('PHYS-CARDIAC-RISK');
  }

  if (!injuries.length) return empty;
  // 종합 severity
  const confirmedInj = injuries.filter(i => i.confirmedLevel === 'confirmed_physiologic');
  const physiologicSeverity = +Math.min(1, (injuries.reduce((s,i)=> s + (i.confirmedLevel==='confirmed_physiologic' ? i.severity : i.severity*0.3), 0) / Math.max(1, injuries.length)) + confirmedInj.length*0.05).toFixed(2);
  // effect profile 집계 + clamp (중복 가중 방지)
  const prof = { breathingDrain:0, oxygenDrain:0, pneumothoraxBoost:0, hemothoraxBoost:0, internalBleedBoost:0, externalBleedBoost:0, majorVesselMul:1.0, shockBoost:0, preArrestBoost:0, rhythmRiskBoost:0, perfusingRhythmPenalty:0 };
  for (const i of injuries) {
    const e = i.effects || {};
    prof.breathingDrain += e.breathingDrain||0;
    prof.oxygenDrain += e.oxygenDrain||0;
    prof.pneumothoraxBoost += e.pneumothoraxBoost||0;
    prof.hemothoraxBoost += e.hemothoraxBoost||0;
    prof.internalBleedBoost += e.internalBleedBoost||0;
    prof.externalBleedBoost += e.externalBleedBoost||0;
    if (e.majorVesselMul) prof.majorVesselMul = Math.max(prof.majorVesselMul, e.majorVesselMul);
    prof.shockBoost += e.shockBoost||0;
    prof.preArrestBoost += e.preArrestBoost||0;
    prof.rhythmRiskBoost += e.rhythmRiskBoost||0;
    prof.perfusingRhythmPenalty += e.perfusingRhythmPenalty||0;
  }
  prof.breathingDrain = +Math.min(0.25, prof.breathingDrain).toFixed(3);
  prof.oxygenDrain = +Math.min(0.18, prof.oxygenDrain).toFixed(3);
  prof.pneumothoraxBoost = +Math.min(0.40, prof.pneumothoraxBoost).toFixed(3);
  prof.hemothoraxBoost = +Math.min(0.40, prof.hemothoraxBoost).toFixed(3);
  prof.internalBleedBoost = +Math.min(0.50, prof.internalBleedBoost).toFixed(3);
  prof.externalBleedBoost = +Math.min(0.40, prof.externalBleedBoost).toFixed(3);
  prof.majorVesselMul = +Math.min(2.6, prof.majorVesselMul).toFixed(2);
  prof.shockBoost = +Math.min(0.30, prof.shockBoost).toFixed(3);
  prof.preArrestBoost = +Math.min(0.30, prof.preArrestBoost).toFixed(3);
  prof.rhythmRiskBoost = +Math.min(0.60, prof.rhythmRiskBoost).toFixed(3);
  prof.perfusingRhythmPenalty = +Math.min(0.30, prof.perfusingRhythmPenalty).toFixed(3);
  return { physiologicInjuries: injuries, physiologicSeverity, physiologicTags: Array.from(tags), physiologicEffectProfile: prof };
}

// === SIDE-MEDICAL-ORGAN-BLEEDING-1 §1-§5: 확정/강한의심 손상 모델 ===
//   기존 candidateMap/organ·vessel hints/physiologicInjuryModel을 유지한 채, 제한 조건에서만 후보를 confirmed/probable로 승격.
//   현장 확정 진단 한계를 반영 — 복부 장기는 probable 중심, 확정은 극히 제한적.
function buildConfirmedInjuryModel(wound, bt, candidateMap, med) {
  const out = { confirmed: [], probable: [], candidates: [], ruledOut: [], severity: 'none', confidence: 0.0, reasonTags: [] };
  const cands = Array.isArray(candidateMap) ? candidateMap : ((candidateMap && candidateMap.candidates) || []);
  const candIds = cands.map(c => c.id);
  out.candidates = candIds.slice();
  if (!bt) return out;
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §1: bodyTrajectory 실제 깊이 필드는 woundDepthClass. bt.depth는 undefined였음(deep 판정 실패).
  const depth = bt.woundDepthClass || bt.depthClass || bt.depth || 'surface_only';
  const bodyEntered = !!bt.bodyEntered;
  const isDeep = (depth === 'deep_penetration' || depth === 'near_exit_lodged' || depth === 'body_through_and_through');
  const through = (depth === 'body_through_and_through' || bt.bodyThroughAndThrough === true);
  const resid = (bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : 0.5;
  const penetrationState = wound && wound.penetrationState;
  const armorStopped = !!(wound && (wound.armorResult === 'stopped' || wound.armorResult === 'absorbed')) || (bt.armorResult === 'stopped') || penetrationState === 'stopped_by_armor';
  const bluntOnly = !bodyEntered && !!(wound && (wound.bluntTrauma || 0) > 0);
  const projClass = String((wound && (wound.projectileClass || wound.woundType)) || bt.projectileClass || '');
  const isRifleAP = /rifle|ap\b|armor_pierc|steel_core|m2ap|m993|mk211|apfsds/i.test(projClass) || resid >= 0.7;
  const sizeClass = String((wound && (wound.woundSizeClass || (wound.woundSize && wound.woundSize.sizeClass))) || bt.woundSizeClass || bt.projectileSizeClass || '');
  const bigWound = /large|massive/.test(sizeClass);
  const mz = (med && med.medicalZone) || '';
  const org = (med && med.organRegion) || '';
  const cav = (med && med.cavityRegion) || '';
  const vasc = (med && med.vascularRegion) || '';
  const junc = (med && med.junctionalRegion) || '';
  const hf = (med && med.headFaceRegion) || '';
  const majorVesselHint = !!(med && med.majorVesselRiskHint) || !!(wound && wound.majorVesselCandidate);
  const chestCav = !!(med && med.chestCavityRisk), abdCav = !!(med && med.abdominalCavityRisk), pelvCav = !!(med && med.pelvicCavityRisk);
  const physCrit = !!(wound && (wound.physiologicSeverity === 'critical'));
  const has = (frag) => cands.some(c => c.id.indexOf(frag) >= 0);

  // === 승격 금지 게이트: bodyEntered false / armor stopped / surface / shallow / 매우 낮은 잔여에너지 / 둔상 only / ricochet(체내 미진입) ===
  const blockReason = !bodyEntered ? 'no_body_entry'
    : armorStopped ? 'armor_stopped'
    : (depth === 'surface_only') ? 'surface_only'
    : (depth === 'shallow_entry') ? 'shallow_entry'
    : (resid < 0.12) ? 'very_low_residual_energy'
    : bluntOnly ? 'blunt_trauma_only'
    : (bt.ricochet && !bodyEntered) ? 'ricochet_no_entry'
    : null;
  if (blockReason) {
    out.reasonTags.push(blockReason);
    out.ruledOut = candIds.filter(id => /injury|fracture|pneumothorax|hemothorax|bleeding|compromise/.test(id));
    out.severity = bigWound ? 'minor' : 'minor';
    out.confidence = 0.1;
    return out;
  }

  const addC = (id, tag) => { if (out.confirmed.indexOf(id) < 0) out.confirmed.push(id); if (tag) out.reasonTags.push(tag); };
  const addP = (id, tag) => { if (out.probable.indexOf(id) < 0 && out.confirmed.indexOf(id) < 0) out.probable.push(id); if (tag) out.reasonTags.push(tag); };
  const addCand = (id) => { if (out.candidates.indexOf(id) < 0) out.candidates.push(id); };

  // === §2 흉부 ===
  const isChestZone = chestCav || /chest|thorax|lung|clavicle|supraclavicular|axilla|lateral_chest|collar/.test(mz + ' ' + org + ' ' + vasc);
  if (isChestZone) {
    if (has('lung_candidate') && chestCav && isDeep) addC('lung_injury_confirmed', 'chest_deep_lung');
    else if (has('lung_candidate') || has('lung_apex') || has('upper_lung')) addP('lung_injury_probable', 'lung_candidate');
    if (bodyEntered && chestCav && (through || bigWound || bt.exitWoundPresent)) addC('open_chest_wound_confirmed', 'penetrating_chest');
    if (out.confirmed.indexOf('lung_injury_confirmed') >= 0 || has('pleural_cavity_candidate') || has('lung_candidate')) {
      addP('pneumothorax_probable', 'pleural');
      if (isDeep && (bigWound || isRifleAP || through)) addP('hemothorax_probable', 'hemothorax');
    }
    if (has('subclavian_vessel_candidate') || /clavicle|supraclavicular|collar/.test(mz) || vasc === 'subclavian') addP('subclavian_vessel_injury_probable', 'subclavian');
    if (has('axillary_vessel_candidate') || mz === 'axilla' || /axillary/.test(vasc)) addP('axillary_vessel_injury_probable', 'axillary');
    // 심장: 매우 제한적. center chest + deep + high energy + 급격한 생리악화에서만 confirmed.
    if (has('heart_candidate') && /mid|lower|chest|center/.test(mz) && through && isRifleAP && physCrit) addC('heart_injury_confirmed', 'heart_center_deep_collapse');
    else {
      // CLEANUP HOTFIX 4: heart_injury_probable 축소 — center/left anterior + 고잔여에너지/rifle + through·nearExit·deep central 동반.
      //   단순 deep chest만으로는 뜨지 않음. physiologic collapse는 가중(필수 아님).
      const _heartCentral = /center|mid|left/.test(mz) || /central|left_anterior/.test(org);
      const _heartHighEnergy = (resid >= 0.6) || isRifleAP;
      const _heartDeepCentral = through || depth === 'near_exit_lodged' || (isDeep && _heartCentral);
      if (has('heart_candidate') && chestCav && _heartCentral && _heartHighEnergy && _heartDeepCentral) addP('heart_injury_probable', 'heart_candidate');
      else if (has('heart_candidate')) addCand('heart_candidate');   // 조건 미충족 → 후보로만 유지
    }
  }

  // === §3 복부 (probable 중심, 확정 지양) ===
  const isAbdZone = abdCav || /abdomen|liver|spleen|stomach|bowel|kidney|flank|retroperitoneal|peritoneal/.test(mz + ' ' + org + ' ' + cav);
  if (isAbdZone) {
    if (has('liver_candidate') || has('spleen_candidate') || has('stomach_candidate')) addP('solid_organ_injury_probable', 'solid_organ');
    if (has('bowel_candidate')) addP('hollow_viscus_injury_probable', 'hollow_viscus');
    if (has('kidney_candidate') || /kidney/.test(mz + ' ' + org)) addP('kidney_injury_probable', 'kidney');
    if (has('retroperitoneal_bleed_candidate') || cav === 'retroperitoneal') addP('retroperitoneal_bleeding_probable', 'retroperitoneal');
    if (has('abdominal_vessel_candidate') || (abdCav && isDeep && (bigWound || isRifleAP || through))) addP('abdominal_internal_bleeding_probable', 'abd_internal');
  }

  // === §4 골반/서혜부/대퇴삼각 ===
  const isPelvicJunc = /pelvis|groin|femoral|iliac/.test(mz + ' ' + junc + ' ' + vasc) || pelvCav;
  if (isPelvicJunc) {
    if (has('junctional_hemorrhage_candidate') || mz === 'groin_junctional' || junc === 'inguinal') addP('junctional_hemorrhage_probable', 'junctional');
    if (has('femoral_vessel_candidate') || mz === 'femoral_triangle' || /femoral/.test(vasc)) addP('femoral_vessel_injury_probable', 'femoral');
    if (has('iliac_vessel_candidate') || (mz === 'pelvis_upper' && isDeep) || vasc === 'iliac') addP('iliac_vessel_injury_probable', 'iliac');
    if (pelvCav || mz === 'pelvis_upper' || has('pelvic_bleed_candidate')) addP('pelvic_bleeding_probable', 'pelvic');
    if (has('pelvic_bone_candidate')) addCand('pelvic_bone_injury_candidate');
  }

  // === §5 두부/얼굴/기도 (헬멧/바이저 정지는 위 게이트에서 이미 차단됨 — 여기선 penetrated만) ===
  const isHeadZone = /skull|head|forehead|crown|temporal|occipital|brain/.test(mz + ' ' + hf + ' ' + org);
  if (isHeadZone) {
    if (has('skull_candidate') || /forehead|temporal|occipital|crown/.test(mz)) addP('skull_fracture_probable', 'skull');
    if (has('tbi_candidate') || has('brain_region') || (isDeep && bodyEntered)) addP('tbi_probable', 'tbi');
  }
  if (/eye|orbital/.test(mz + ' ' + hf) || has('eye_candidate')) {
    addP('eye_injury_probable', 'eye');
  }
  const isFaceLower = /jaw|mouth|face|nose|cheek|mid_face/.test(mz + ' ' + hf);
  if (isFaceLower) {
    // CLEANUP HOTFIX 3: airway_compromise_probable은 jaw/mouth 계열 또는 airwayRisk===true(possible 제외) 또는 생리악화 동반 시만.
    //   nose/cheek/mid_face(airwayRisk:'possible')는 후보 수준 — probable로 승격 안 함.
    const _airwayStrong = has('jaw_candidate') || /jaw|mouth|lower_face|mouth_jaw/.test(mz) || (med && med.airwayRisk === true);
    const _airwayPhys = physCrit || (wound && wound.physiologicSeverity === 'severe') || (med && med.consciousnessImpaired);
    if (_airwayStrong || (_airwayPhys && med && med.airwayRisk)) addP('airway_compromise_probable', 'airway');
    else if (med && med.airwayRisk === 'possible') addCand('airway_risk_candidate');
    if (has('facial_bone_candidate') || /jaw|cheek|nose|mid_face/.test(mz)) addP('facial_bone_injury_probable', 'facial_bone');
  }

  // === severity / confidence 산정 ===
  const nC = out.confirmed.length, nP = out.probable.length;
  if (nC > 0) {
    const lethal = out.confirmed.some(i => /heart|lung_injury|open_chest/.test(i));
    out.severity = (lethal || nC >= 2) ? 'critical' : 'severe';
    out.confidence = Math.min(0.92, 0.6 + 0.1 * nC);
  } else if (nP > 0) {
    out.severity = (nP >= 2 || majorVesselHint) ? 'severe' : 'moderate';
    out.confidence = Math.min(0.6, 0.28 + 0.08 * nP);
  } else {
    out.severity = bigWound ? 'moderate' : 'minor';
    out.confidence = 0.2;
  }
  out.reasonTags = Array.from(new Set(out.reasonTags));
  out.summary = _confirmedInjurySummary(out);
  return out;
}
function _confirmedInjurySummary(m) {
  const parts = [];
  if (m.confirmed.length) parts.push('확정: ' + m.confirmed.join(', '));
  if (m.probable.length) parts.push('강한의심: ' + m.probable.join(', '));
  if (!parts.length) parts.push('확정/강한의심 없음 (후보 ' + m.candidates.length + ')');
  return parts.join(' | ');
}

// === SIDE-MEDICAL-ORGAN-BLEEDING-1 §6: 내부출혈 분류 (confirmed/probable + 주소 기반) ===
//   external_controllable / external_severe / junctional_limited_control / thoracic_internal / abdominal_internal /
//   retroperitoneal_internal / pelvic_internal / cranial_neuro / airway_compromise
//   반환: { category, fieldControllability, evacBias, note }
function classifyInternalBleedingCategory(confirmedModel, med, bt, ibm, bleedingClass) {
  const mz = (med && med.medicalZone) || '';
  const cav = (med && med.cavityRegion) || '';
  const conf = (confirmedModel && confirmedModel.confirmed) || [];
  const prob = (confirmedModel && confirmedModel.probable) || [];
  const all = conf.concat(prob);
  const hasAny = (re) => all.some(i => re.test(i));
  // 두부/신경 우선 (혈액손실보다 neuro)
  if (/skull|head|forehead|crown|temporal|occipital|brain/.test(mz + ' ' + ((med && med.headFaceRegion) || '')) && hasAny(/tbi|skull_fracture/)) {
    return { category: 'cranial_neuro', fieldControllability: 'neuro_focus', evacBias: 'urgent', note: '두부 손상 — 신경/의식/호흡 위험 중심' };
  }
  // 기도
  if ((med && med.airwayRisk) || hasAny(/airway_compromise/)) {
    // 기도는 별도 분류지만 외부출혈(안면)과 공존 가능 — airway 우선 반환
    // CLEANUP HOTFIX 3: 기도 위협 category는 jaw/mouth/lower_face 계열만 (mid_face/nose/cheek 'face' 매칭 제외).
    if (/jaw|mouth|lower_face|mouth_jaw/.test(mz) || (med && med.airwayRisk === true) || prob.indexOf('airway_compromise_probable') >= 0) return { category: 'airway_compromise', fieldControllability: 'airway_focus', evacBias: 'urgent', note: '기도 위협 — 기도확보 우선, 안면출혈은 외부출혈로 분리' };
  }
  // 접합부 (§6: groin_junctional/femoral_triangle/axilla_gap/supraclavicular는 심부 장기위험이 있어도 junctional 우선 — 현장통제 제한)
  if (/groin_junctional|femoral_triangle|axilla|supraclavicular/.test(mz)) {
    return { category: 'junctional_limited_control', fieldControllability: 'junctional_partial', evacBias: 'high', note: '접합부 출혈 — tourniquet 효과 제한, hemostatic/packing/junctional control 일부 억제. 심부 iliac/subclavian은 현장 한계' };
  }
  // 흉부 내부
  if (hasAny(/lung_injury|hemothorax|open_chest|thoracic_vessel|subclavian_vessel/) || (med && med.chestCavityRisk && hasAny(/pneumothorax|lung/))) {
    return { category: 'thoracic_internal', fieldControllability: 'chest_limited', evacBias: 'urgent', note: '흉강 내부출혈/폐손상 — chestSeal은 개방창 악화만 완화, hemothorax 자체 제거 불가' };
  }
  // 후복막
  if (cav === 'retroperitoneal' || hasAny(/retroperitoneal|kidney_injury/) || /kidney|flank/.test(mz)) {
    return { category: 'retroperitoneal_internal', fieldControllability: 'uncontrollable_field', evacBias: 'urgent', note: '후복막 출혈 의심 — 외부출혈 적어도 실혈 위험, 현장 통제 불가' };
  }
  // 골반
  if ((med && med.pelvicCavityRisk) || mz === 'pelvis_upper' || hasAny(/iliac_vessel|pelvic_bleeding/)) {
    return { category: 'pelvic_internal', fieldControllability: 'pelvic_binder_partial', evacBias: 'urgent', note: '골반 내부출혈 — 골반고정은 진행 일부 완화, 완전 지혈 아님' };
  }
  // 잔여 접합부 후보 (혈관 후보만 있고 zone은 위에 안 걸린 경우)
  if (hasAny(/junctional_hemorrhage|femoral_vessel|axillary_vessel/)) {
    return { category: 'junctional_limited_control', fieldControllability: 'junctional_partial', evacBias: 'high', note: '접합부 출혈 — tourniquet 효과 제한, junctional control 일부 억제' };
  }
  // 복부 내부
  if (cav === 'peritoneal' || (med && med.abdominalCavityRisk) || hasAny(/solid_organ|hollow_viscus|abdominal_internal/)) {
    return { category: 'abdominal_internal', fieldControllability: 'uncontrollable_field', evacBias: 'urgent', note: '복강 내부출혈 — 현장 처치로 직접 감소 불가, 후송 우선' };
  }
  // 외부 (severity로 controllable/severe 구분)
  const sev = (ibm && ibm.severity) || 'low';
  if (bleedingClass === 'major_vessel_candidate' || sev === 'severe' || sev === 'critical') {
    return { category: 'external_severe', fieldControllability: 'pressure_tourniquet', evacBias: 'high', note: '심한 외부출혈 — 압박/지혈대 적용 가능' };
  }
  return { category: 'external_controllable', fieldControllability: 'controllable', evacBias: 'routine', note: '통제 가능한 외부출혈' };
}

// ============================================================
// ORGANIC-BLEED-1 — evidence models (Phase 1 §3, Phase 2 §7, finalize §4/§5/§8/§9)
//   기존 bleedingProfile/candidateMap/confirmedInjuryModel을 삭제하지 않고, evidence로 통합·gate.
// ============================================================
const _VESSEL_NAMED_RE = /femoral|brachial|axillary|subclavian|iliac|carotid|aorta|popliteal|jugular/;
const _VESSEL_MAJOR_RE = /femoral|brachial|axillary|subclavian|iliac|carotid|aorta/;
// Phase 1 §3: 혈관 위험%/후보/probable/confirmed를 하나의 evidence로 통합.
function buildVascularEvidence(w) {
  const bp = w.bleedingProfile || {};
  const conf = (w.confirmedInjuries || []).slice();
  const prob = (w.probableInjuries || []).slice();
  const cand = (w.candidateInjuries || []).slice();
  const physio = (w.physiologicInjuries || []).map(i => (i && i.type) || '').filter(Boolean);
  const vHints = (w.vesselCandidateHints || []).slice();
  const majorCandidate = !!w.majorVesselCandidate;
  const riskPercent = Math.max(0, Math.min(100, Math.round((bp.vesselRisk || 0) * 100)));

  const confirmedVessels = conf.filter(i => /vessel/.test(i) || _VESSEL_NAMED_RE.test(i))
    .concat(physio.filter(i => i === 'major_vessel_injury'));
  const probableVessels = prob.filter(i => /vessel/.test(i) || _VESSEL_NAMED_RE.test(i));
  const suspectedVessels = cand.filter(i => /vessel/.test(i) || _VESSEL_NAMED_RE.test(i)).concat(vHints);

  let level = 'none', vesselClass = 'none', source = 'risk_percent', evidenceStrength = 0;
  if (confirmedVessels.length) {
    level = 'confirmed'; source = 'confirmed_injury'; evidenceStrength = 1.0;
    vesselClass = confirmedVessels.some(i => _VESSEL_MAJOR_RE.test(i)) ? 'major_named' : 'named_branch';
  } else if (probableVessels.length) {
    level = 'probable'; source = 'probable_injury'; evidenceStrength = 0.65;
    vesselClass = probableVessels.some(i => _VESSEL_MAJOR_RE.test(i)) ? 'major_named'
                : probableVessels.some(i => _VESSEL_NAMED_RE.test(i)) ? 'named_branch' : 'small_branch';
  } else if (suspectedVessels.length || majorCandidate) {
    level = 'candidate'; source = 'candidate_map'; evidenceStrength = 0.35;
    vesselClass = (majorCandidate || suspectedVessels.some(i => _VESSEL_MAJOR_RE.test(i))) ? 'named_branch' : 'small_branch';
  } else if (riskPercent >= 60) {
    level = 'risk_only'; source = 'risk_percent'; evidenceStrength = 0.18; vesselClass = 'small_branch';
  } else if (riskPercent >= 25) {
    level = 'risk_only'; source = 'risk_percent'; evidenceStrength = 0.10; vesselClass = 'capillary_muscle';
  } else {
    vesselClass = (riskPercent > 5) ? 'capillary_muscle' : 'none';
  }
  const majorVessel = (vesselClass === 'major_named') && (level === 'probable' || level === 'confirmed');
  const selfTamponadePossible = !(level === 'confirmed' || (level === 'probable' && vesselClass === 'major_named'));
  const evidenceTags = [];
  if (majorVessel) evidenceTags.push('major_vessel_' + level);
  if (level === 'risk_only') evidenceTags.push('vascular_risk_only');
  return {
    riskPercent, level, vesselClass,
    suspectedVessels, probableVessels, confirmedVessels,
    evidenceStrength: +evidenceStrength.toFixed(2), majorVessel, selfTamponadePossible,
    evidenceTags, source,
  };
}

// Phase 2 §7: 골절 evidence — ammo별 기본 fractureChance 유지 + 주소/뼈 위험도로 상승.
const _BONE_ZONE_MAP = [
  [/skull|crown|forehead|occipital|temporal|cranium/, 'skull', 'extreme'],
  [/jaw|mandible|maxilla|face_lower|mouth/, 'jaw', 'high'],
  [/spine|vertebra|cervical|lumbar|thoracic_spine/, 'spine', 'extreme'],
  [/clavicle|collarbone/, 'clavicle', 'high'],
  [/rib|thorax_wall|costal/, 'rib', 'high'],
  [/pelvis|pelvic|hip|sacrum/, 'pelvis', 'high'],
  [/humerus|upper_arm_bone|shoulder_joint/, 'humerus', 'medium'],
  [/radius|ulna|forearm/, 'radius_ulna', 'medium'],
  [/femur|thigh_bone|femoral_shaft/, 'femur', 'medium'],
  [/tibia|fibula|shin|lower_leg/, 'tibia_fibula', 'medium'],
];
function buildFractureEvidence(unit, ev, woundSize, bt, med) {
  const prof = getAmmoMedicalProfile((ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null);
  const baseChance = (typeof prof.fractureChance === 'number') ? prof.fractureChance : 0.08;
  const partKey = ev.partKey;
  const zoneStr = ((ev.anatomicalZone || '') + ' ' + ((med && med.medicalZone) || '') + ' ' + ((bt && bt.hitZone) || '') + ' ' + ((ev.impactAddress && ev.impactAddress.fullAddress) || '')).toLowerCase();
  // boneZone/boneRisk 결정
  let boneZone = null, boneRisk = 'none';
  for (const [re, zone, risk] of _BONE_ZONE_MAP) { if (re.test(zoneStr)) { boneZone = zone; boneRisk = risk; break; } }
  // 사지 근육 중심부는 낮게, shaft/joint 명시면 상승
  const isLimb = (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg');
  const boneAdjacent = /shaft|proximal|distal|joint|bone|condyle|epiphysis/.test(zoneStr);
  if (!boneZone && isLimb) {
    // 팔/다리 근육 중심 — 뼈 경로 불명확
    boneZone = (partKey === 'leftArm' || partKey === 'rightArm') ? 'humerus' : 'femur';
    boneRisk = boneAdjacent ? 'high' : 'low';
  }
  if (boneAdjacent && (boneRisk === 'low' || boneRisk === 'medium')) boneRisk = (boneRisk === 'low') ? 'medium' : 'high';
  // trajectory가 뼈 통과/깊은 경로면 상승
  const deep = !!(bt && (bt.penetrationState === 'through_and_through' || bt.penetrationState === 'deep' || bt.deepTrajectory));
  const resid = (bt && bt.residualEnergyFactor != null) ? bt.residualEnergyFactor : (ev.residualEnergyFactor || 0.5);
  const riskMul = ({ none: 0.0, low: 0.6, medium: 1.6, high: 3.2, extreme: 5.0 })[boneRisk];
  const energyMul = 0.7 + Math.max(0, Math.min(1.2, resid)) * 0.9;
  const penMul = (ev.armorResult === 'penetrated' || ev.sourceType === 'frag') ? 1.15 : 0.6;
  const crossMul = deep ? 1.35 : 1.0;
  const backfaceMul = (ev.armorResult === 'stopped' || ev.armorResult === 'absorbed') ? (0.8 + (prof.bluntTraumaMul || 1) * 0.3) : 1.0;
  let finalChance = baseChance * riskMul * energyMul * penMul * crossMul * backfaceMul;
  finalChance = Math.max(0, Math.min(0.9, finalChance));
  const occurred = (riskMul > 0) && (Math.random() < finalChance);
  // fractureType — 에너지/severity 기반
  let fractureType = 'none';
  if (occurred) {
    const sizeClass = (woundSize && woundSize.sizeClass) || 'small';
    const heavy = (resid >= 0.7) || sizeClass === 'large' || sizeClass === 'massive';
    if (boneRisk === 'extreme' && heavy) fractureType = 'shattered';
    else if (heavy && (boneRisk === 'high' || boneRisk === 'extreme')) fractureType = 'comminuted';
    else if (heavy || boneRisk === 'high') fractureType = 'displaced';
    else if (resid >= 0.4) fractureType = 'simple';
    else fractureType = 'hairline';
  }
  const _fragSevMap = { none: 0, hairline: 0.05, simple: 0.15, displaced: 0.35, comminuted: 0.6, shattered: 0.85 };
  const boneFragmentSeverity = _fragSevMap[fractureType] || 0;
  const _bleedBonusMap = { none: 1.0, hairline: 1.07, simple: 1.15, displaced: 1.30, comminuted: 1.55, shattered: 1.80 };
  const bleedBonusMul = _bleedBonusMap[fractureType] || 1.0;
  const vascularRiskBonus = ({ none: 0, hairline: 0.0, simple: 0.03, displaced: 0.08, comminuted: 0.18, shattered: 0.30 })[fractureType] || 0;
  const evidenceTags = [];
  if (occurred) { evidenceTags.push('fracture_' + fractureType); if (boneZone) evidenceTags.push('bone_' + boneZone); }
  return {
    occurred, fractureType, boneRisk, boneZone,
    finalChance: +finalChance.toFixed(3), baseChance: +baseChance.toFixed(3), multiplier: +(riskMul * energyMul * penMul * crossMul * backfaceMul).toFixed(2),
    boneFragmentSeverity: +boneFragmentSeverity.toFixed(2), vascularRiskBonus: +vascularRiskBonus.toFixed(2), bleedBonusMul: +bleedBonusMul.toFixed(2),
    evidenceTags,
  };
}

// Phase 1 §4/§5 + §8/§9: 모든 evidence를 읽어 bleedingProfile 최종화 (soft ceiling / initial·sustained 분리 / 자연감소 target).
// ============================================================
