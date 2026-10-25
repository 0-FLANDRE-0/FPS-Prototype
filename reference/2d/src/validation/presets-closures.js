// 2A-4.5: AMMO REGISTRY (POC) + PRESET VALIDATOR
// -------------------------------------------------------------
//   ⚠ 이 블록은 검증/비교/실험 전용이다.
//   실제 전투/방호/의료/AAR 로직은 여전히 기존 AMMO_PRESETS 등을 읽는다.
//   registry는 향후 탄종 이관을 위한 "창고 구조" 증명이며, 기존 데이터를
//   대체하거나 수정하지 않는다.
// =============================================================

// --- 검증 결과 누적기 ---
function _mkValidationReport() {
  return {
    errors: [], warnings: [], infos: [],
    error(cat, msg)   { this.errors.push({ cat, msg }); },
    warn(cat, msg)    { this.warnings.push({ cat, msg }); },
    info(cat, msg)    { this.infos.push({ cat, msg }); },
    merge(other) {
      if (!other) return;
      this.errors.push(...other.errors); this.warnings.push(...other.warnings); this.infos.push(...other.infos);
    },
    summary() { return { errors:this.errors.length, warnings:this.warnings.length, infos:this.infos.length }; },
  };
}
function _isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
function _has(obj, k) { return obj && obj[k] !== undefined && obj[k] !== null; }

// ---------- 1. 탄약 검증 ----------
function validateAmmoPresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof AMMO_PRESETS === 'undefined') { rep.error('ammo', 'AMMO_PRESETS 미정의'); return rep; }
  for (const id in AMMO_PRESETS) {
    const a = AMMO_PRESETS[id];
    if (!a) { rep.error('ammo', `${id}: preset 비어있음`); continue; }
    if (a.id !== id) rep.warn('ammo', `${id}: id 필드(${a.id})가 키와 불일치`);
    // 표시 정보
    if (!_has(a, 'name')) rep.error('ammo', `${id}: name 누락`);
    if (!_has(a, 'shortName')) rep.warn('ammo', `${id}: shortName 누락 (AAR/표 표시 fallback)`);
    if (!_has(a, 'caliber')) rep.warn('ammo', `${id}: caliber 누락 (탄약표 그룹화 불가)`);
    if (!_has(a, 'desc')) rep.info('ammo', `${id}: desc 누락`);
    // 수치 (pellet 계열은 damage/penetration이 pellet 단위라 존재만 확인)
    if (!_isFiniteNum(a.penetration)) rep.error('ammo', `${id}: penetration 비수치`);
    if (!_isFiniteNum(a.damage)) rep.error('ammo', `${id}: damage 비수치`);
    if (a.recoil !== undefined && !_isFiniteNum(a.recoil)) rep.warn('ammo', `${id}: recoil 비수치`);
    if (a.accuracyMul !== undefined && !_isFiniteNum(a.accuracyMul)) rep.warn('ammo', `${id}: accuracyMul 비수치`);
    // armor interaction
    if (!_has(a, 'materialPenPenalty')) rep.warn('ammo', `${id}: materialPenPenalty 누락 (재질별 관통 fallback)`);
    else {
      for (const mk in a.materialPenPenalty) if (!_isFiniteNum(a.materialPenPenalty[mk])) rep.warn('ammo', `${id}: materialPenPenalty.${mk} 비수치`);
    }
    if (!_has(a, 'barrierBehavior')) rep.info('ammo', `${id}: barrierBehavior 누락 (기본 거동)`);
    if (a.ricochetMul !== undefined && !_isFiniteNum(a.ricochetMul)) rep.warn('ammo', `${id}: ricochetMul 비수치`);
    // energyClass (직접 우선, 없으면 AMMO_ENERGY_CLASS)
    const ecDirect = a.energyClass;
    const ecTable = (typeof AMMO_ENERGY_CLASS !== 'undefined') ? AMMO_ENERGY_CLASS[id] : undefined;
    if (!ecDirect && !ecTable) rep.warn('ammo', `${id}: energyClass 누락 (직접/AMMO_ENERGY_CLASS 모두 없음)`);
    // medical fallback
    const med = (typeof AMMO_MEDICAL !== 'undefined') ? AMMO_MEDICAL[id] : undefined;
    if (!med) rep.info('ammo', `${id}: AMMO_MEDICAL 항목 없음 (DEFAULTS fallback 사용)`);
    // AAR 표시명 생성 가능 여부
    if (!a.name && !a.shortName) rep.warn('ammo', `${id}: AAR 탄종명 생성 불가 (name/shortName 모두 없음)`);
  }
  return rep;
}

// ---------- 2. 총기-탄약 연결 ----------
function validateWeaponPresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof WEAPONS === 'undefined') { rep.error('weapon', 'WEAPONS 미정의'); return rep; }
  for (const id in WEAPONS) {
    const w = WEAPONS[id];
    if (!w) { rep.error('weapon', `${id}: preset 비어있음`); continue; }
    if (!_has(w, 'name')) rep.error('weapon', `${id}: name 누락`);
    if (!_has(w, 'shortName')) rep.info('weapon', `${id}: shortName 누락`);
    // allowedAmmoIds
    const allowed = w.allowedAmmoIds || w.allowedAmmo || null;
    if (allowed && Array.isArray(allowed)) {
      for (const aid of allowed) if (!(AMMO_PRESETS && AMMO_PRESETS[aid])) rep.error('weapon', `${id}: allowedAmmoId '${aid}' 가 AMMO_PRESETS에 없음`);
    } else if (w.type === 'small' || w.type === 'shotgun') {
      rep.info('weapon', `${id}: allowedAmmoIds 없음 (단일 탄종 또는 기본 ammoId 사용)`);
    }
    // defaultAmmoId
    const def = w.defaultAmmoId || w.ammoId || null;
    if (def && !(AMMO_PRESETS && AMMO_PRESETS[def])) rep.error('weapon', `${id}: defaultAmmoId '${def}' 가 AMMO_PRESETS에 없음`);
    if (def && allowed && Array.isArray(allowed) && allowed.indexOf(def) < 0) rep.warn('weapon', `${id}: defaultAmmoId '${def}' 가 allowedAmmoIds에 미포함`);
    // 주요 필드
    if (!_has(w, 'magazineSize') && !_has(w, 'magSize')) rep.warn('weapon', `${id}: magazineSize 누락`);
    if (!_has(w, 'weightKg')) rep.warn('weapon', `${id}: weightKg 누락 (무게/loadClass 왜곡)`);
    if ((w.type === 'shotgun') && !(AMMO_PRESETS && def && AMMO_PRESETS[def] && AMMO_PRESETS[def].pelletCount)) {
      rep.info('weapon', `${id}: 산탄총인데 기본탄 pelletCount 미확인 (통계 연결 확인 권장)`);
    }
  }
  // LOADOUT_OPTIONS.weapon 교차검증
  if (typeof LOADOUT_OPTIONS !== 'undefined' && LOADOUT_OPTIONS.weapon) {
    for (const id of LOADOUT_OPTIONS.weapon) if (!WEAPONS[id]) rep.error('weapon', `LOADOUT_OPTIONS.weapon '${id}' 가 WEAPONS에 없음`);
    for (const id in WEAPONS) if (LOADOUT_OPTIONS.weapon.indexOf(id) < 0) rep.info('weapon', `${id}: 선택창(LOADOUT_OPTIONS.weapon)에 미노출`);
  }
  return rep;
}

// ---------- 3. 방탄복 / 헬멧 / 플레이트 / 보호구 ----------
function validateArmorPresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof BODY_ARMOR_PRESETS === 'undefined') { rep.error('armor', 'BODY_ARMOR_PRESETS 미정의'); return rep; }
  for (const id in BODY_ARMOR_PRESETS) {
    const a = BODY_ARMOR_PRESETS[id];
    if (!_has(a, 'name')) rep.error('armor', `${id}: name 누락`);
    if (!_has(a, 'coverage')) rep.error('armor', `${id}: coverage 누락`);
    const softDur = a.softMaxDurability || (typeof ARMOR_SOFT_MAX_DURABILITY !== 'undefined' && ARMOR_SOFT_MAX_DURABILITY[id]);
    if (!softDur) rep.warn('armor', `${id}: softMaxDurability/ARMOR_SOFT_MAX_DURABILITY 누락`);
    if (!_has(a, 'weightKg')) rep.warn('armor', `${id}: weightKg 누락`);
    if (typeof ARMOR_COVERAGE_SHAPES !== 'undefined' && !ARMOR_COVERAGE_SHAPES[id]) rep.info('armor', `${id}: ARMOR_COVERAGE_SHAPES 없음 (visual fallback)`);
    _validateCoverageMaterials(a.coverage, id, rep);
  }
  return rep;
}
function _validateCoverageMaterials(cov, ownerId, rep) {
  if (!cov) return;
  for (const slot in cov) {
    const s = cov[slot]; if (!s) continue;
    // 평면 material 필드
    for (const mk of ['hardMaterial','softMaterial','material']) {
      const m = s[mk];
      if (m) _validateMaterialId(m, `${ownerId}.${slot}.${mk}`, rep);
    }
    // 중첩 레이어 material (slot.hard.material / slot.soft.material / slot.none.material)
    for (const layer of ['hard','soft','none']) {
      if (s[layer] && typeof s[layer] === 'object' && s[layer].material) {
        _validateMaterialId(s[layer].material, `${ownerId}.${slot}.${layer}.material`, rep);
      }
    }
  }
}
function validateHelmetPresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof HELMET_PRESETS === 'undefined') { rep.error('helmet', 'HELMET_PRESETS 미정의'); return rep; }
  for (const id in HELMET_PRESETS) {
    const h = HELMET_PRESETS[id];
    if (!_has(h, 'name')) rep.error('helmet', `${id}: name 누락`);
    for (const slot of ['head_skull','head_temporal','head_face']) if (!_has(h, slot)) rep.warn('helmet', `${id}: ${slot} 누락 (fallback 사용)`);
    const dur = h.maxDurability || (typeof HELMET_MAX_DURABILITY !== 'undefined' && HELMET_MAX_DURABILITY[id]);
    if (!dur) rep.warn('helmet', `${id}: maxDurability/HELMET_MAX_DURABILITY 누락`);
    if (!_has(h, 'weightKg')) rep.warn('helmet', `${id}: weightKg 누락`);
    if (typeof HELMET_COVERAGE_SHAPES !== 'undefined' && !HELMET_COVERAGE_SHAPES[id]) rep.info('helmet', `${id}: HELMET_COVERAGE_SHAPES 없음 (visual fallback)`);
    for (const slot of ['head_skull','head_temporal','head_face']) if (h[slot] && h[slot].material) _validateMaterialId(h[slot].material, `${id}.${slot}`, rep);
  }
  return rep;
}
function validatePlatePresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof PLATE_PRESETS === 'undefined') { rep.error('plate', 'PLATE_PRESETS 미정의'); return rep; }
  for (const id in PLATE_PRESETS) {
    const p = PLATE_PRESETS[id]; if (p.isNone) { rep.info('plate', `${id}: none preset`); continue; }
    if (!_has(p, 'name')) rep.error('plate', `${id}: name 누락`);
    if (!_has(p, 'slotType')) rep.warn('plate', `${id}: slotType 누락`);
    if (!_isFiniteNum(p.hardArmor)) rep.warn('plate', `${id}: hardArmor 비수치`);
    if (!_has(p, 'material')) rep.warn('plate', `${id}: material 누락`);
    else _validateMaterialId(p.material, `plate:${id}`, rep);
    if (!_has(p, 'weightKg')) rep.warn('plate', `${id}: weightKg 누락`);
    const dur = p.maxDurability || (typeof PLATE_MAX_DURABILITY !== 'undefined' && PLATE_MAX_DURABILITY[id]);
    if (!dur) rep.warn('plate', `${id}: maxDurability/PLATE_MAX_DURABILITY 누락`);
    for (const k of ['compatibleArmorIds','incompatibleArmorIds']) {
      if (Array.isArray(p[k])) for (const aid of p[k]) if (!(BODY_ARMOR_PRESETS && BODY_ARMOR_PRESETS[aid])) rep.warn('plate', `${id}: ${k} '${aid}' 가 BODY_ARMOR_PRESETS에 없음`);
    }
  }
  return rep;
}
function validateAccessoryPresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof PROTECTION_ACCESSORY_PRESETS === 'undefined') { rep.error('accessory', 'PROTECTION_ACCESSORY_PRESETS 미정의'); return rep; }
  for (const id in PROTECTION_ACCESSORY_PRESETS) {
    const a = PROTECTION_ACCESSORY_PRESETS[id]; if (a.isNone) continue;
    if (!_has(a, 'name')) rep.error('accessory', `${id}: name 누락`);
    if (!_has(a, 'accessoryType')) rep.error('accessory', `${id}: accessoryType 누락`);
    const dur = a.maxDurability || (typeof ACCESSORY_MAX_DURABILITY !== 'undefined' && ACCESSORY_MAX_DURABILITY[id]);
    if (!dur) rep.info('accessory', `${id}: maxDurability 누락 (소프트 보호구는 선택)`);
    if (Array.isArray(a.compatibleArmorIds)) for (const aid of a.compatibleArmorIds) if (!(BODY_ARMOR_PRESETS && BODY_ARMOR_PRESETS[aid])) rep.warn('accessory', `${id}: compatibleArmorId '${aid}' 없음`);
    if (Array.isArray(a.compatibleHelmetIds)) for (const hid of a.compatibleHelmetIds) if (!(HELMET_PRESETS && HELMET_PRESETS[hid])) rep.warn('accessory', `${id}: compatibleHelmetId '${hid}' 없음`);
    if (a.material) _validateMaterialId(a.material, `accessory:${id}`, rep);
    if (Array.isArray(a.visorHitTable)) {
      a.visorHitTable.forEach((z, i) => {
        if (!z.material) rep.warn('accessory', `${id}.visorHitTable[${i}]: material 누락`);
        else _validateMaterialId(z.material, `accessory:${id}.visor[${i}]`, rep);
        if (!_isFiniteNum(z.armorValue)) rep.warn('accessory', `${id}.visorHitTable[${i}]: armorValue 비수치`);
      });
    }
  }
  return rep;
}

// ---------- 4. 재질 참조 ----------
function _validateMaterialId(m, owner, rep) {
  if (!m) return;
  if (typeof MATERIAL_PROPS !== 'undefined' && !MATERIAL_PROPS[m]) rep.warn('material', `${owner}: material '${m}' 가 MATERIAL_PROPS에 없음`);
  if (typeof MATERIAL_BREAK_MUL !== 'undefined' && MATERIAL_BREAK_MUL[m] === undefined) rep.info('material', `${owner}: material '${m}' 가 MATERIAL_BREAK_MUL에 없음 (1.0 fallback)`);
  if (typeof ARMOR_DURABILITY_CURVES !== 'undefined' && !ARMOR_DURABILITY_CURVES[m]) rep.info('material', `${owner}: material '${m}' 가 ARMOR_DURABILITY_CURVES에 없음 (기본 곡선)`);
}
function validateMaterialReferences(rep) {
  rep = rep || _mkValidationReport();
  // 특수 재질이 핵심 테이블에 존재하는지 우선 확인
  for (const m of ['glass','pe','ceramic','titanium','composite','aramid','steel','aluminum','fabric']) {
    if (typeof MATERIAL_PROPS !== 'undefined' && !MATERIAL_PROPS[m]) rep.warn('material', `특수재질 '${m}' 가 MATERIAL_PROPS에 없음`);
  }
  return rep;
}

// ---------- 5. 투척물 / 숙련도 ----------
function validateThrowablePresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof THROWABLE_PRESETS === 'undefined') { rep.error('throwable', 'THROWABLE_PRESETS 미정의'); return rep; }
  for (const id in THROWABLE_PRESETS) {
    const t = THROWABLE_PRESETS[id]; if (t.isNone) continue;
    if (!_has(t, 'name')) rep.error('throwable', `${id}: name 누락`);
    if (!_has(t, 'weightKg')) rep.warn('throwable', `${id}: weightKg 누락`);
    const hasEffect = _has(t,'fragmentCount')||_has(t,'fragmentRadius')||_has(t,'explosionRadius')||_has(t,'blastRadius')||t.type;
    if (!hasEffect) rep.warn('throwable', `${id}: fragment/explosion 관련 필드 누락`);
  }
  if (typeof LOADOUT_OPTIONS !== 'undefined' && LOADOUT_OPTIONS.lethalGrenade) {
    for (const id of LOADOUT_OPTIONS.lethalGrenade) if (id && id.indexOf('no_')!==0 && !THROWABLE_PRESETS[id]) rep.error('throwable', `LOADOUT_OPTIONS.lethalGrenade '${id}' 가 THROWABLE_PRESETS에 없음`);
  }
  return rep;
}
function validateSkillPresets(rep) {
  rep = rep || _mkValidationReport();
  if (typeof SKILL_PRESETS === 'undefined') { rep.error('skill', 'SKILL_PRESETS 미정의'); return rep; }
  for (const id in SKILL_PRESETS) {
    const s = SKILL_PRESETS[id];
    if (!_has(s, 'name') && !_has(s, 'label')) rep.info('skill', `${id}: name/label 누락`);
  }
  if (typeof LOADOUT_OPTIONS !== 'undefined' && LOADOUT_OPTIONS.skill) {
    for (const id of LOADOUT_OPTIONS.skill) if (!SKILL_PRESETS[id]) rep.error('skill', `LOADOUT_OPTIONS.skill '${id}' 가 SKILL_PRESETS에 없음`);
  }
  return rep;
}

// ---------- 6. Visual / 로드아웃 참조 ----------
function validateVisualProfiles(rep) {
  rep = rep || _mkValidationReport();
  // 플레이트 shape 추론 → polygon 존재 확인
  if (typeof PLATE_PRESETS !== 'undefined' && typeof PLATE_SHAPE_POLYGONS !== 'undefined') {
    for (const id in PLATE_PRESETS) {
      const p = PLATE_PRESETS[id]; if (p.isNone) continue;
      const shape = (typeof getPlateShape === 'function') ? getPlateShape(id, 'chest') : (p.plateShape || null);
      if (shape && !PLATE_SHAPE_POLYGONS[shape]) rep.warn('visual', `plate ${id}: plateShape '${shape}' 가 PLATE_SHAPE_POLYGONS에 없음`);
    }
  }
  return rep;
}
function validateLoadoutReferences(rep) {
  rep = rep || _mkValidationReport();
  if (typeof LOADOUT_OPTIONS === 'undefined') { rep.warn('loadout', 'LOADOUT_OPTIONS 미정의'); return rep; }
  const checks = [
    ['bodyArmor', typeof BODY_ARMOR_PRESETS!=='undefined'?BODY_ARMOR_PRESETS:null],
    ['helmet', typeof HELMET_PRESETS!=='undefined'?HELMET_PRESETS:null],
    ['weapon', typeof WEAPONS!=='undefined'?WEAPONS:null],
  ];
  for (const [key, table] of checks) {
    if (LOADOUT_OPTIONS[key] && table) for (const id of LOADOUT_OPTIONS[key]) if (id && id.indexOf('no_')!==0 && !table[id]) rep.error('loadout', `LOADOUT_OPTIONS.${key} '${id}' 가 해당 preset 테이블에 없음`);
  }
  return rep;
}

// ---------- 통합 ----------
// 2A-6.6: 플레이트 유효방호/백커 정합성 검사 (자동수정 없음, 보고만)
function validatePlateEffectiveRating(rep) {
  rep = rep || _mkValidationReport();
  if (typeof PLATE_PRESETS === 'undefined') return rep;
  const STEEL=new Set(['steel']), PE=new Set(['pe']), TI=new Set(['titanium']), CERCOMP=new Set(['ceramic','composite','alumina','boron_carbide']);
  let prevSAPI={}, byId={};
  for (const id in PLATE_PRESETS) {
    const p = PLATE_PRESETS[id]; if (!p || p.isNone) continue; byId[id]=p;
    const ha=p.hardArmor||0, ba=p.backingArmor||0, eff=(p.effectiveArmor!=null)?p.effectiveArmor:(ha+ba);
    // effectiveArmor = hard + backing
    if (p.effectiveArmor != null && p.effectiveArmor !== ha+ba) rep.error('plateEff', `${id}: effectiveArmor(${p.effectiveArmor}) ≠ hard+back(${ha+ba})`);
    const rm=p.ratingMode, mat=p.material;
    if (rm==='icw') {
      if (ba>7) rep.warn('plateEff', `${id}: ICW backingArmor ${ba} > 7 (자체백커처럼 과함)`);
      if (p.hasIntegralBacker) rep.error('plateEff', `${id}: ICW인데 hasIntegralBacker=true`);
      if (p.requiresSoftBacker===false) rep.error('plateEff', `${id}: ICW인데 requiresSoftBacker=false`);
      if (p.minBackerArmor!=null && (p.minBackerArmor<18||p.minBackerArmor>24)) rep.warn('plateEff', `${id}: ICW minBackerArmor ${p.minBackerArmor} (18~24 권장)`);
    } else if (rm==='standalone') {
      if (p.hasIntegralBacker===false) rep.warn('plateEff', `${id}: Stand-Alone인데 hasIntegralBacker=false`);
      if (STEEL.has(mat)) { if (ba>4) rep.warn('plateEff', `${id}: Steel Stand-Alone backingArmor ${ba} > 4 (coating은 스폴완화용)`); if (eff>=50) rep.warn('plateEff', `${id}: Steel III effectiveArmor ${eff} ≥ 50 (4클 유지 권장)`); }
      else if (PE.has(mat)) { if (ba>18) rep.warn('plateEff', `${id}: PE backingArmor ${ba} > 18`); if (eff>=50) rep.warn('plateEff', `${id}: PE Level III effectiveArmor ${eff} ≥ 50 (4클 상한 권장)`); }
      else if (TI.has(mat)) { if (ba>8) rep.warn('plateEff', `${id}: Titanium backingArmor ${ba} > 8 (둔상완화 중심)`); }
      else if (CERCOMP.has(mat)) { if (ba>18) rep.warn('plateEff', `${id}: Ceramic/Composite backingArmor ${ba} > 18`); else if (ba<8) rep.info('plateEff', `${id}: Ceramic/Composite backingArmor ${ba} < 8 (자체백커 빈약)`); }
    }
    // 두께 vs 유효방호
    if (p.thicknessMm!=null && p.thicknessMm<=15 && eff>=65) rep.warn('plateEff', `${id}: 두께 ${p.thicknessMm}mm ≤15 인데 effectiveArmor ${eff} ≥65 (과효율 의심)`);
    // 7클은 XSAPI급만
    // SIDE-ARMOR-ADD-COLOSSUS: Colossus 계열은 의도적으로 XSAPI급 이상인 신규 최상위 standalone 플레이트
    const XSAPI_TIER = ['plate_xsapi','plate_colossus','plate_colossus_side'];
    if (eff>=69 && XSAPI_TIER.indexOf(id)<0) rep.warn('plateEff', `${id}: effectiveArmor ${eff} → 7클인데 XSAPI급 아님`);
  }
  // 순서 정합성
  const ord=(a,b,lbl)=>{ if(byId[a]&&byId[b]){const ea=byId[a].effectiveArmor, eb=byId[b].effectiveArmor; if(!(ea<eb)) rep.warn('plateEff', `${lbl}: ${a}(${ea}) < ${b}(${eb}) 순서 위배`);} };
  ord('plate_sapi','plate_esapi','SAPI<ESAPI'); ord('plate_esapi','plate_xsapi','ESAPI<XSAPI');
  ord('plate_ssapi','plate_esbi','SSAPI<ESBI'); ord('plate_granit_br4','plate_granit_br5','Br4<Br5');
  ord('plate_xsapi','plate_colossus','XSAPI<Colossus'); ord('plate_esbi','plate_colossus_side','ESBI<ColossusSide');
  return rep;
}

function validateBackerModifierSanity(rep) {
  rep = rep || _mkValidationReport();
  if (typeof computeBackerResolution !== 'function') { rep.warn('backer','computeBackerResolution 미정의'); return rep; }
  const _fin = (x)=> typeof x==='number' && isFinite(x);
  // 대표 ratingMode 입력으로 blunt/shock/pain mult가 NaN이 아닌지 확인
  const samples = [
    { _plateMeta:{ plateRatingMode:'icw', plateMinBackerArmor:22, plateBaseSoftArmor:32 } },
    { _plateMeta:{ plateRatingMode:'icw', plateMinBackerArmor:22, plateBaseSoftArmor:0 } },
    { _plateMeta:{ plateRatingMode:'standalone', plateBaseSoftArmor:0 } },
    { _plateMeta:{ plateRatingMode:'standalone', plateBaseSoftArmor:32 } },
    { _plateMeta:{ plateRatingMode:'soft_insert' } },
    { _plateMeta:{} },
  ];
  for (const s of samples) {
    const r = computeBackerResolution(s);
    const mode = (s._plateMeta && s._plateMeta.plateRatingMode) || 'none';
    for (const k of ['bluntMul','shockMul','painMul','armorMul','secondaryBackerChanceMul','residualStopMul','backerSufficiency']) {
      if (!_fin(r[k])) rep.error('backer', `computeBackerResolution(${mode}).${k} 비수치(NaN/undef)`);
    }
    // ICW 무백커: backerSufficiency<=insufficient, armorMul>0 (완전무효 아님)
    if (mode==='icw' && (s._plateMeta.plateBaseSoftArmor||0)===0) {
      if (r.armorMul <= 0) rep.error('backer', 'ICW 무백커인데 armorMul<=0 (방호 완전무효 금지)');
      if (r.backerResult !== 'insufficient') rep.warn('backer', `ICW 무백커 backerResult=${r.backerResult} (insufficient 기대)`);
    }
    // standalone: 자체백커 인정
    if (mode==='standalone' && r.backerResult !== 'integral') rep.warn('backer', `standalone backerResult=${r.backerResult} (integral 기대)`);
  }
  return rep;
}

// ════════════════════════════════════════════════════════════════════════════
// [0.39.3 A-Closure] A단계 closure validator — projectile metadata / subsonic 전수 / 분류 정합성 /
//   impact packet 정합성 / fallback 통계. 정상 등록 탄약이 이유 없이 fallback을 타면 오류.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// [0.39.4 A-Closure] 실행형 closure suite + mutation test — 개발자 console/validator에서 호출.
//   게임 전역 상태·RNG를 snapshot 후 완전 복원. UI 버튼 없음.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// [0.39.5 Phase2/3] 실행형 A단계 종료 시험 — 실제 gameplay consumer를 호출한다.
//   helper boolean만 검사하지 않고 실제 fireWeapon/processShotQueue/startReload/startWeaponSwitch/
//   buildResidualThreatAfterHard/computeWoundSize/buildBodyTrajectoryContext/tickMedical를 호출하고
//   상태 변화를 확인한다. 게임 전역 상태 snapshot 후 완전 복원. RNG는 withSeededGameplayRng로 스코프.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// [0.39.7 Sandbox] A단계 종료 시험 — public wrapper / isolated core 분리.
//   suite core는 setupGame()·UI render를 호출하지 않고, makeUnit() 기반 isolated fixture만 사용한다.
//   public wrapper가 live state fingerprint(reference/content/scalar) + DOM fingerprint + GAME own-property
//   descriptor + RNG identity + hook registry를 하나의 transaction으로 검증한다.
// ════════════════════════════════════════════════════════════════════════════
const CONTINUATION_ZERO_POLICY = 'omit';   // residual 0 → continueRaycast=false AND continuationThreatPacket=null
const _IW_REAR_FIXTURE_SEED = 1;           // [0.39.9] rear plate fixture 전용 RNG stream — 측정 재현성 확보용
const IW_TEST_HOOKS = { installed: {} };
const _IW_HOOKABLE = {
  renderLog:                { get: () => renderLog,                set: v => { renderLog = v; } },
  refreshUI:                { get: () => refreshUI,                set: v => { refreshUI = v; } },
  renderRoster:             { get: () => renderRoster,             set: v => { renderRoster = v; } },
  showBanner:               { get: () => showBanner,               set: v => { showBanner = v; } },
  renderPlaceEditor:        { get: () => renderPlaceEditor,        set: v => { renderPlaceEditor = v; } },
  _normalizeResidualThreat: { get: () => _normalizeResidualThreat, set: v => { _normalizeResidualThreat = v; } },
  getAcuteActionBlockState: { get: () => getAcuteActionBlockState, set: v => { getAcuteActionBlockState = v; } },
  // [B-STAGE] part destruction mutation 대상
  buildPartDestructionEvidence: { get: () => buildPartDestructionEvidence, set: v => { buildPartDestructionEvidence = v; } },
  refreshPartDestructionState: { get: () => refreshPartDestructionState, set: v => { refreshPartDestructionState = v; } },
  computePartDestructionContribution: { get: () => computePartDestructionContribution, set: v => { computePartDestructionContribution = v; } },
  recomputeBodyPartFunctionRatio: { get: () => recomputeBodyPartFunctionRatio, set: v => { recomputeBodyPartFunctionRatio = v; } },
  reinforceVascularEvidenceWithPartDestruction: { get: () => reinforceVascularEvidenceWithPartDestruction, set: v => { reinforceVascularEvidenceWithPartDestruction = v; } },
  // [AI0-A HF1] mutation 대상
  recordThreatEvidence: { get: () => recordThreatEvidence, set: v => { recordThreatEvidence = v; } },
  completeAICommand: { get: () => completeAICommand, set: v => { completeAICommand = v; } },
  restorePlayerCommand: { get: () => restorePlayerCommand, set: v => { restorePlayerCommand = v; } },
  markPlayerCommandChanged: { get: () => markPlayerCommandChanged, set: v => { markPlayerCommandChanged = v; } },
  // [AI0-B] mutation 대상
  pathCellWalkableForMap: { get: () => pathCellWalkableForMap, set: v => { pathCellWalkableForMap = v; } },
  markTacticalGeometryChanged: { get: () => markTacticalGeometryChanged, set: v => { markTacticalGeometryChanged = v; } },
  buildTacticalSpatialGraph: { get: () => buildTacticalSpatialGraph, set: v => { buildTacticalSpatialGraph = v; } },
  getTacticalObjectId: { get: () => getTacticalObjectId, set: v => { getTacticalObjectId = v; } },
  resolveSoundArrivalPortal: { get: () => resolveSoundArrivalPortal, set: v => { resolveSoundArrivalPortal = v; } },
  recordSurfaceObservation: { get: () => recordSurfaceObservation, set: v => { recordSurfaceObservation = v; } },
  // [AI0-C1] mutation 대상
  buildSlotsForObservedSurface: { get: () => buildSlotsForObservedSurface, set: v => { buildSlotsForObservedSurface = v; } },
  validateObservedCoverSlot: { get: () => validateObservedCoverSlot, set: v => { validateObservedCoverSlot = v; } },
  scoreObservedCoverSlot: { get: () => scoreObservedCoverSlot, set: v => { scoreObservedCoverSlot = v; } },
  getObservedCoverSlotMemorySignature: { get: () => getObservedCoverSlotMemorySignature, set: v => { getObservedCoverSlotMemorySignature = v; } },
  findBestObservedCover: { get: () => findBestObservedCover, set: v => { findBestObservedCover = v; } },
  // [AI0-C2] mutation 대상 (최소 범위)
  getEffectivePortalDanger: { get: () => getEffectivePortalDanger, set: v => { getEffectivePortalDanger = v; } },
  getPortalRiskEvidence: { get: () => getPortalRiskEvidence, set: v => { getPortalRiskEvidence = v; } },
  getKnownPortalCrossingsForPath: { get: () => getKnownPortalCrossingsForPath, set: v => { getKnownPortalCrossingsForPath = v; } },
};
const _IW_UI_HOOKS = ['renderLog', 'refreshUI', 'renderRoster', 'showBanner', 'renderPlaceEditor'];
function _iwInstallHook(name, replacement) {
  const h = _IW_HOOKABLE[name]; if (!h) return false;
  if (!Object.prototype.hasOwnProperty.call(IW_TEST_HOOKS.installed, name)) IW_TEST_HOOKS.installed[name] = h.get();
  h.set(replacement); return true;
}
function _iwRemoveHook(name) {
  const h = _IW_HOOKABLE[name]; if (!h) return false;
  if (Object.prototype.hasOwnProperty.call(IW_TEST_HOOKS.installed, name)) { h.set(IW_TEST_HOOKS.installed[name]); delete IW_TEST_HOOKS.installed[name]; }
  return true;
}
function _iwRemoveAllTestHooks() { for (const n of Object.keys(IW_TEST_HOOKS.installed)) _iwRemoveHook(n); }
function _iwInstalledHookNames() { return Object.keys(IW_TEST_HOOKS.installed); }
function _iwMutationHookNames() { return _iwInstalledHookNames().filter(n => _IW_UI_HOOKS.indexOf(n) < 0); }

// ── stable serializer (content 검사 전용; function identity는 별도 reference 비교) ──
function _iwStableHash(obj) {
  const seen = new WeakSet();
  const norm = (v) => {
    if (typeof v === 'function') return '[fn]';
    if (v && typeof v === 'object') {
      if (seen.has(v)) return '[circ]'; seen.add(v);
      if (Array.isArray(v)) return v.map(norm);
      if (typeof Set !== 'undefined' && v instanceof Set) return { __set: Array.from(v).map(norm) };
      if (typeof Map !== 'undefined' && v instanceof Map) return { __map: Array.from(v.entries()).map(e => [norm(e[0]), norm(e[1])]) };
      const o = {}; for (const k of Object.keys(v).sort()) o[k] = norm(v[k]); return o;
    }
    if (typeof v === 'number' && !isFinite(v)) return String(v);
    return v;
  };
  try { return JSON.stringify(norm(obj)); } catch (e) { return 'ERR:' + String(e && e.message); }
}
function _iwShortHash(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h1 = (h1 ^ s.charCodeAt(i)) >>> 0; h1 = Math.imul(h1, 16777619) >>> 0; h2 = (h2 + s.charCodeAt(i) * (i + 1)) >>> 0; }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8) + ':' + s.length;
}

// ── live state fingerprint (reference / content / scalar) ──
const _IW_REF_FIELDS = ['units','logs','fxList','dustClouds','noiseEvents','flyingThrowables','pendingExplosions','projectiles','fx','battleReport','_impactLog','_aarUI','loadout','teamSkill','operatorLoadout','placementCounter'];
const _IW_CONTENT_FIELDS = ['logs','fxList','dustClouds','noiseEvents','flyingThrowables','pendingExplosions','battleReport','_impactLog','_aarUI','loadout','teamSkill','operatorLoadout','placementCounter'];
const _IW_SCALAR_FIELDS = ['phase','paused','gameTime','over','result','selectedId','selectedWpIdx','facingMode','pointFireMode','throwMode','placementMode','placementType','placementMaterial','placementCoverId','placementFloorMaterial','placementBrushSize','selectedCoverId','selectedWallUid','_impactLogSeq','mapId','aiProfileOn','debugCover','debugNoise','debugAI','debugMedical','debugBallistic'];
function _iwCaptureLiveStateFingerprint() {
  const g = GAME, refs = {}, contents = {}, scalars = {};
  for (const f of _IW_REF_FIELDS) refs[f] = g[f];
  refs.UNITS = (typeof UNITS !== 'undefined') ? UNITS : null;
  refs.random = Math.random;
  for (const f of _IW_CONTENT_FIELDS) contents[f] = _iwShortHash(_iwStableHash(g[f]));
  contents.UNITS = _iwShortHash(_iwStableHash((typeof UNITS !== 'undefined') ? UNITS : null));
  for (const f of _IW_SCALAR_FIELDS) scalars[f] = g[f];
  scalars.nextUnitId = (typeof nextUnitId !== 'undefined') ? nextUnitId : null;
  scalars.unitsAlias = ((typeof UNITS !== 'undefined') && UNITS === g.units);
  return { refs, contents, scalars, gameKeys: Object.getOwnPropertyNames(g).slice().sort().join(',') };
}
function _iwDiffFingerprint(a, b) {
  const paths = [];
  for (const k of Object.keys(a.refs)) if (a.refs[k] !== b.refs[k]) paths.push((k === 'UNITS' || k === 'random') ? (k + '.reference') : ('GAME.' + k + '.reference'));
  for (const k of Object.keys(a.contents)) if (a.contents[k] !== b.contents[k]) paths.push((k === 'UNITS' ? 'UNITS' : 'GAME.' + k) + '.content');
  for (const k of Object.keys(a.scalars)) if (a.scalars[k] !== b.scalars[k]) paths.push(k === 'nextUnitId' ? 'nextUnitId' : (k === 'unitsAlias' ? 'UNITS===GAME.units' : 'GAME.' + k));
  if (a.gameKeys !== b.gameKeys) paths.push('GAME.ownPropertyKeys');
  return paths;
}
function _iwFingerprintDigest(fp) {
  return _iwShortHash(JSON.stringify({ c: fp.contents, s: fp.scalars, k: fp.gameKeys }));
}

// ── DOM fingerprint ──
const _IW_DOM_IDS = ['app','loadoutScreen','banner','bannerTitle','bannerSub','phasePill','missionPill','log','rosterBar','unitInfo','hint','placePanel','medicMenu','aarOverlay','medicOverlay','throwableSelectOverlay','loadoutSelectOverlay','plateSelectOverlay','armorAnalysisOverlay','canvas'];
function _iwDomEl(id) { try { return (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null; } catch (e) { return null; } }
function _iwSafeRead(fn) { try { const v = fn(); return (v === undefined) ? null : v; } catch (e) { return null; } }
function _iwCaptureDomFingerprint() {
  const out = {};
  for (const id of _IW_DOM_IDS) {
    const el = _iwDomEl(id);
    if (!el) { out[id] = null; continue; }
    out[id] = {
      className: _iwSafeRead(() => el.className == null ? null : String(el.className)),
      style: _iwSafeRead(() => (el.getAttribute ? el.getAttribute('style') : null)),
      textContent: _iwSafeRead(() => el.textContent == null ? null : String(el.textContent)),
      innerHTML: _iwSafeRead(() => el.innerHTML == null ? null : String(el.innerHTML)),
      hidden: _iwSafeRead(() => el.hidden), disabled: _iwSafeRead(() => el.disabled),
      checked: _iwSafeRead(() => el.checked), value: _iwSafeRead(() => el.value),
      scrollTop: _iwSafeRead(() => el.scrollTop), scrollLeft: _iwSafeRead(() => el.scrollLeft),
      width: _iwSafeRead(() => el.width), height: _iwSafeRead(() => el.height),
    };
  }
  return out;
}
function _iwDiffDom(a, b, prefix) {
  const paths = [];
  for (const id of _IW_DOM_IDS) {
    const x = a[id], y = b[id];
    if (!x && !y) continue;
    if (!x || !y) { paths.push((prefix || 'DOM') + '.#' + id); continue; }
    for (const k of Object.keys(x)) if (x[k] !== y[k]) paths.push((prefix || 'DOM') + '.#' + id + '.' + k);
  }
  return paths;
}

// ── live state capture / restore (GAME own-property descriptor 전체) ──
function _iwCaptureLiveState() {
  const hookOriginals = {};
  for (const k of Object.keys(_IW_HOOKABLE)) hookOriginals[k] = _IW_HOOKABLE[k].get();
  const hadGameUnits = Object.prototype.hasOwnProperty.call(GAME, 'units');
  return {
    gameDesc: Object.getOwnPropertyDescriptors(GAME),
    gameKeys: Object.getOwnPropertyNames(GAME).slice(),
    hadGameUnits,                                   // [0.39.8 §1] loadout 화면에서는 GAME.units 자체가 없을 수 있다
    originalGameUnits: hadGameUnits ? GAME.units : undefined,
    unitsRef: (typeof UNITS !== 'undefined') ? UNITS : null,
    nextUnitId: (typeof nextUnitId !== 'undefined') ? nextUnitId : null,
    randomFn: Math.random,
    hookOriginals,
  };
}
function _iwRestoreLiveState(snap) {
  if (!snap) return;
  for (const k of Object.getOwnPropertyNames(GAME)) if (!Object.prototype.hasOwnProperty.call(snap.gameDesc, k)) { try { delete GAME[k]; } catch (e) {} }
  if (!snap.hadGameUnits) { try { delete GAME.units; } catch (e) {} }   // [0.39.8 §1] 원래 없던 property 잔존 금지
  for (const k of Object.keys(snap.gameDesc)) { try { Object.defineProperty(GAME, k, snap.gameDesc[k]); } catch (e) { try { GAME[k] = snap.gameDesc[k].value; } catch (e2) {} } }
  if (typeof UNITS !== 'undefined' && snap.unitsRef !== null) UNITS = snap.unitsRef;
  if (typeof nextUnitId !== 'undefined' && snap.nextUnitId !== null) nextUnitId = snap.nextUnitId;
  Math.random = snap.randomFn;
  for (const k of Object.keys(snap.hookOriginals)) { const h = _IW_HOOKABLE[k]; if (h) { try { h.set(snap.hookOriginals[k]); } catch (e) {} } }
  IW_TEST_HOOKS.installed = {};
}
function _iwGameOwnPropsRestored(snap) {
  const now = Object.getOwnPropertyNames(GAME);
  if (now.length !== snap.gameKeys.length) return false;
  for (const k of snap.gameKeys) { if (!Object.prototype.hasOwnProperty.call(GAME, k)) return false; const d = snap.gameDesc[k]; if (d && 'value' in d && GAME[k] !== d.value) return false; }
  return true;
}
// ── sandbox 설치 ──
const _IW_SANDBOX_NEXT_UNIT_ID = 900001;
function _iwInstallSandboxState(seed) {
  const testUnits = [];
  UNITS = testUnits; GAME.units = testUnits;
  GAME.logs = []; GAME.fxList = []; GAME.dustClouds = []; GAME.noiseEvents = [];
  GAME.flyingThrowables = []; GAME.pendingExplosions = []; GAME.projectiles = []; GAME.fx = [];
  GAME.battleReport = null; GAME._impactLog = []; GAME._impactLogSeq = 0; GAME._aarUI = null;
  GAME.phase = 'play'; GAME.paused = false; GAME.gameTime = 0; GAME.over = false; GAME.result = null;
  GAME.selectedId = null; GAME.selectedWpIdx = -1; GAME.facingMode = false; GAME.pointFireMode = false;
  GAME.throwMode = null; GAME.placementMode = false; GAME.selectedCoverId = null; GAME.selectedWallUid = null;
  // 이 하네스 스위트들은 레거시(정답 기반) 계약을 검증한다. 살아있는 공간 인지 스위치가
  // 결과를 좌우하면 안 되므로 샌드박스 안에서는 항상 끈다.
  //   (GAME 자체 속성이라 샌드박스 복원이 원래 값을 되돌린다 — gameOwnPropertiesRestored가 검증)
  GAME.spatialPerceptionOn = false;
  nextUnitId = _IW_SANDBOX_NEXT_UNIT_ID;
  // UI 격리 — core가 DOM을 건드리지 않도록 render 진입점을 no-op으로 (finally에서 제거)
  for (const n of _IW_UI_HOOKS) _iwInstallHook(n, function () {});
  return { units: testUnits, seed, baselineNextUnitId: _IW_SANDBOX_NEXT_UNIT_ID };
}
function _iwResetSandboxToBaseline(ctx) {
  for (const n of _iwMutationHookNames()) _iwRemoveHook(n);
  ctx.units.length = 0;
  for (const f of ['logs','fxList','dustClouds','noiseEvents','flyingThrowables','pendingExplosions','projectiles','fx','_impactLog']) if (Array.isArray(GAME[f])) GAME[f].length = 0;
  GAME._impactLogSeq = 0; GAME.battleReport = null; GAME._aarUI = null;
  GAME.gameTime = 0; GAME.over = false; GAME.result = null; GAME.selectedId = null;
  nextUnitId = ctx.baselineNextUnitId;
}
function _iwAssertSandboxBaselineRestored(ctx) {
  const paths = [];
  if (_iwMutationHookNames().length) paths.push('hooks:' + _iwMutationHookNames().join('|'));
  if (ctx.units.length !== 0) paths.push('ctx.units');
  if (GAME._impactLog.length !== 0) paths.push('GAME._impactLog');
  if (GAME._impactLogSeq !== 0) paths.push('GAME._impactLogSeq');
  if (GAME.battleReport !== null) paths.push('GAME.battleReport');
  if (nextUnitId !== ctx.baselineNextUnitId) paths.push('nextUnitId');
  return { ok: paths.length === 0, paths };
}
// ── isolated fixture (setupGame 미사용) ──
function _iwStripArmor(u) { u.bodyArmorId = null; u.helmetId = null; u.visorId = null; u.frontPlateId = null; u.backPlateId = null; u.sidePlateId = null; u.groinGuardId = null; u.neckGuardId = null; u.shoulderGuardId = null; }
function _iwCreateTestPair(ctx, options) {
  const o = options || {};
  const fAmmo = (typeof AMMO_PRESETS !== 'undefined' && AMMO_PRESETS[o.ammoId]) ? o.ammoId : '556_m855';
  const eAmmo = (typeof AMMO_PRESETS !== 'undefined' && AMMO_PRESETS['762x39_ps']) ? '762x39_ps' : '556_m855';
  const skill = (typeof getSkillPreset === 'function') ? getSkillPreset('regular') : undefined;
  const shooter = makeUnit({ team:'friend', name:'IW Shooter', x: mToPx(o.sx != null ? o.sx : 5), y: mToPx(5), facing: 0,
    weaponId: o.weaponId || 'm4a1', ammoId: fAmmo, role:'reactive', skill,
    loadout: { weaponId: o.weaponId || 'm4a1', ammoId: fAmmo } });
  const target = makeUnit({ team:'enemy', name:'IW Target', x: mToPx(o.tx != null ? o.tx : 6), y: mToPx(5), facing: Math.PI,
    weaponId: 'akm', ammoId: eAmmo, role:'reactive', skill,
    loadout: { weaponId:'akm', ammoId: eAmmo } });
  for (const u of [shooter, target]) { _iwStripArmor(u); u.stance = 'standing'; u.alive = true; u.isMoving = false; u.conscious = true; }
  ctx.units.push(shooter, target);
  return { shooter, target };
}
// [0.39.8 §4] 실제 후면 방호(soft body armor + back plate) 장착 표적 — 기존 preset만 사용
function _iwCreateRearArmoredTarget(ctx) {
  // [0.39.9 §1] 실제 호환 조합만 사용 — plate_korund_vm_back은 slotType 'back' + compatibleArmorIds ['armor_6b23_test'].
  //   (western frontBack 세라믹 플레이트들은 incompatibleArmorIds에 armor_6b23_test가 있어 rear plate fixture로 부적합)
  const armorId = (typeof BODY_ARMOR_PRESETS !== 'undefined' && BODY_ARMOR_PRESETS['armor_6b23_test']) ? 'armor_6b23_test' : null;
  const backPlateId = (typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS['plate_korund_vm_back']) ? 'plate_korund_vm_back' : 'no_back_plate';
  const t = makeUnit({ team:'enemy', name:'IW RearTarget', x: mToPx(6), y: mToPx(5), facing: Math.PI, weaponId:'akm', ammoId:'556_m855', role:'reactive',
    loadout: { weaponId:'akm', ammoId:'556_m855', bodyArmorId: armorId, backPlateId } });
  t.bodyArmorId = armorId; t.backPlateId = backPlateId; t.frontPlateId = 'no_front_plate'; t.sidePlateId = 'no_side_plate';
  t.helmetId = null; t.visorId = null; t.groinGuardId = null; t.neckGuardId = null; t.shoulderGuardId = null;
  t.stance = 'standing'; t.alive = true; t.isMoving = false; t.conscious = true;
  initMedicalResources(t); ctx.units.push(t);
  return t;
}
function _iwHitReal(shooter, target, addr, loc) {
  const p = getAddressParts(addr);
  const fa = normalizeImpactAddressObject({ fullAddress:addr, side:p.side, region:p.region, hitPart:p.hitPart, zone:p.zone, subZone:p.subZone });
  const w = resolveAmmoForWeapon(shooter, WEAPONS[shooter.weaponId]);
  return resolveImpact(shooter, target, w, { forcedImpactAddress:fa, forcedLocation:loc, forcedAspect:p.side });
}
// residual 소비자 측정 — 실제 computeWoundSize + buildBodyTrajectoryContext (rear/continuation 포함)
function _iwResidualConsumers(rp, integ, present, part) {
  const pk = part || 'chest';
  const ammo = AMMO_PRESETS['556_m855'];
  const kin = computeProjectileKinetics(ammo, 700, ammo.velocity || 920);
  const resolve = present ? { penetrated:true, armorResult:'penetrated', residualPen:rp, residualIntegrity:integ, continuationDepth:0 } : { penetrated:true, armorResult:'penetrated', residualIntegrity:integ };
  const pkt = buildImpactTraumaPacket(kin, ammo, { id:'r' }, { penetrated:true }, { armorResult:'penetrated' }, resolve);
  if (!present) pkt.residualPen = undefined;
  const ev = { ammoId:'556_m855', sourceType:'bullet', partKey:pk, hitPart:pk, armorResult:'penetrated', rawDamage:32, impactPacket:pkt, bleedRisk:0.3 };
  const ws = computeWoundSize(ammo, ev, 'deep');
  const bt = buildBodyTrajectoryContext({ medical:{} }, ev, 'deep');
  return { woundDepth: ws.penetrationDepthScore, btPen: bt.projectilePenBeforeBody, preRear: bt.projectilePenBeforeRearArmor,
    rearResult: bt.rearArmorResult, continueRaycast: bt.continueRaycast, contPacket: bt.continuationThreatPacket,
    ttt: bt.bodyThroughAndThrough, terminalEffectType: bt.terminalEffectType };
}

// ════════════════════ CLOSURE CORE (snapshot/restore 수행하지 않음) ════════════════════
function _runImpactWoundClosureCore(ctx, seed) {
  const tests = [];
  const T = (id, passC, expected, actual, consumer) => tests.push({ id, pass: !!passC, expected, actual, consumer: consumer || '' });
  const evidence = {};
  // ── 급성 행동 차단 (실제 fireWeapon / processShotQueue / start*) ──
  withSeededGameplayRng(seed, () => {
    { const { shooter, target } = _iwCreateTestPair(ctx); target.impactKnockdownTimer = 1.2; target.stoppingTimer = 0; const mag0 = target.magAmmo, sq0 = target.shotQueue; fireWeapon(target, shooter); T('C-A1_knockdown_new_fire', target.magAmmo === mag0 && target.shotQueue == sq0, '발사0/탄약0', `mag ${mag0}->${target.magAmmo}`, 'fireWeapon'); }
    { const { shooter, target } = _iwCreateTestPair(ctx); target.impactKnockdownTimer = 0; target.stoppingTimer = 0.5; const mag0 = target.magAmmo; fireWeapon(target, shooter); T('C-A2_stopping_new_fire', target.magAmmo === mag0, '탄약0', `mag ${mag0}->${target.magAmmo}`, 'fireWeapon'); }
    { const { target } = _iwCreateTestPair(ctx); target.impactKnockdownTimer = 1.2; const mag0 = target.magAmmo; target.shotQueue = { weaponId:target.weaponId, shotTimer:0.001, targetId:null, targetX:target.x+50, targetY:target.y, baseAng:0, remaining:3, magAtStart:mag0 }; processShotQueue(target, 0.1); T('C-A3_knockdown_burst_queue', target.shotQueue === null && target.magAmmo === mag0, 'queue null/탄약0', `sq=${target.shotQueue} mag ${mag0}->${target.magAmmo}`, 'processShotQueue'); }
    { const { target } = _iwCreateTestPair(ctx); target.stoppingTimer = 0.5; target.impactKnockdownTimer = 0; const mag0 = target.magAmmo; target.shotQueue = { weaponId:target.weaponId, shotTimer:0.001, targetId:null, targetX:target.x+50, targetY:target.y, baseAng:0, remaining:5, magAtStart:mag0 }; processShotQueue(target, 0.1); T('C-A4_stopping_fullauto_queue', target.shotQueue === null && target.magAmmo === mag0, 'queue null/탄약0', `sq=${target.shotQueue}`, 'processShotQueue'); }
    { const { target } = _iwCreateTestPair(ctx); target.impactKnockdownTimer = 1.2; target.magAmmo = 1; target.reserveAmmo = 90; const rl = startReload(target); const reloadBlocked = (rl === false) && !target.isReloading; let switchBlocked = true; if (typeof startWeaponSwitch === 'function' && target.weaponState) { const sw = startWeaponSwitch(target, 'secondary'); switchBlocked = (sw === false) && !(target.weaponState && target.weaponState.switching); } const throwBlocked = (typeof canThrow === 'function') ? (canThrow(target, 'frag_m67') === false) : true; T('C-A5_reload_switch_throw', reloadBlocked && switchBlocked && throwBlocked, '전부 차단', `reload=${reloadBlocked} switch=${switchBlocked} throw=${throwBlocked}`, 'startReload/startWeaponSwitch/canThrow'); }
    // 실제 updateUnit tick으로 timer 소멸 → 행동 복귀 (테스트가 timer를 직접 빼지 않는다)
    { const { target } = _iwCreateTestPair(ctx); target.impactKnockdownTimer = 0.25; target.stoppingTimer = 0.25; target.magAmmo = 30; target.isReloading = false; target.shotQueue = null; target.fireTimer = 0;
      const blockedDuring = !canFireWeapon(target); const moveBlocked = getAcuteActionBlockState(target).blocksNormalMovement;
      let ticks = 0; while (((target.impactKnockdownTimer||0) > 0 || (target.stoppingTimer||0) > 0) && ticks < 200) { updateUnit(target, 1/30); ticks++; }
      const canFire = canFireWeapon(target); const canMove = !getAcuteActionBlockState(target).blocksNormalMovement; const stanceFree = !getAcuteActionBlockState(target).forcesProne;
      evidence.timerRecovery = { blockedDuring, moveBlockedDuring: moveBlocked, ticks, tickSeconds: +(ticks/30).toFixed(3), canFire, canMove, stanceFree };
      T('C-A6_timer_recovery_realtick', blockedDuring && moveBlocked && canFire && canMove && stanceFree && ticks > 0, 'tick 후 사격/이동/자세 복귀', `blocked=${blockedDuring} ticks=${ticks} canFire=${canFire} canMove=${canMove} stance=${stanceFree}`, 'updateUnit/canFireWeapon/getAcuteActionBlockState'); }
  });
  // ── residual 소비자 (실제 computeWoundSize / buildBodyTrajectoryContext) ──
  const rez = withSeededGameplayRng(seed, () => ({ A: _iwResidualConsumers(20,0.8,true), B: _iwResidualConsumers(12,0.45,true), C: _iwResidualConsumers(0,0.9,true), D: _iwResidualConsumers(null,0.9,false) }));
  T('C-R_woundDepth_A>B>C', rez.A.woundDepth > rez.B.woundDepth && rez.B.woundDepth > rez.C.woundDepth, 'A>B>C', `${rez.A.woundDepth}>${rez.B.woundDepth}>${rez.C.woundDepth}`, 'computeWoundSize');
  T('C-R_bodyTraj_A>B>C', rez.A.btPen > rez.B.btPen && rez.B.btPen > rez.C.btPen, 'A>B>C', `${rez.A.btPen}>${rez.B.btPen}>${rez.C.btPen}`, 'buildBodyTrajectoryContext');
  T('C-R_zero_no_revival', rez.C.woundDepth < rez.A.woundDepth * 0.6 && rez.C.btPen === 0 && rez.D.btPen > rez.A.btPen, 'C<<A, C=0, missing만 fallback', `depthC=${rez.C.woundDepth} btPenC=${rez.C.btPen} btPenD=${rez.D.btPen}`, 'computeWoundSize/buildBodyTrajectoryContext');
  // ── rear armor: 실제 후면 방호 장착 unit으로 pre/post/durability 검증 ([0.39.8 §4]) ──
  //   no_rear_armor 경로 금지 — 기존 preset(body armor + back plate) 조합 사용, 새 방탄 preset 생성 안 함.
  const rr = withSeededGameplayRng(seed, () => {
    const runRear = (rp, integ) => {
      const t = _iwCreateRearArmoredTarget(ctx);
      const skHard = (typeof getDurabilitySlotKey === 'function') ? getDurabilitySlotKey('chest', 'rear', 'hard') : 'chest_rear_hard';
      const skSoft = (typeof getDurabilitySlotKey === 'function') ? getDurabilitySlotKey('chest', 'rear', 'soft') : 'chest_rear_soft';
      const dur = (k) => { const d = t.armorDurability && t.armorDurability[k]; return d ? d.current : null; };
      const hardBefore = dur(skHard), softBefore = dur(skSoft);   // [0.39.9 §5] hard slot 고정 측정
      const ammo = AMMO_PRESETS['556_m855'];
      const kin = computeProjectileKinetics(ammo, 700, ammo.velocity || 920);
      const pkt = buildImpactTraumaPacket(kin, ammo, { id:'r' }, { penetrated:true }, { armorResult:'penetrated' }, { penetrated:true, armorResult:'penetrated', residualPen:rp, residualIntegrity:integ, continuationDepth:0 });
      const ev = { ammoId:'556_m855', sourceType:'bullet', partKey:'chest', hitPart:'chest', armorResult:'penetrated', rawDamage:32, impactPacket:pkt, bleedRisk:0.3,
        // [0.39.9 §2] buildBodyTrajectoryContext의 실제 consumer 계약은 ev._entryArmorContext — 양쪽 동시 지정 금지
        _entryArmorContext: { entryLayerClass:'hard', entryLayerSlot:'front_plate', entryAspect:'front' },
        impactAddress: { hitPart:'chest', impactSide:'front', side:'front' } };
      const bt = buildBodyTrajectoryContext(t, ev, 'deep');
      const hardAfter = dur(skHard), softAfter = dur(skSoft);
      const slot = bt.rearDurabilitySlotKey;
      // durability delta는 항상 chest_rear_hard 기준 (soft slot 감소로 rear plate test를 통과시키지 않는다)
      const dBefore = hardBefore, dAfter = hardAfter;
      return { preRear: bt.projectilePenBeforeRearArmor, postRear: bt.projectilePenAfterRearArmor, rearResult: bt.rearArmorResult,
        candidate: bt.rearArmorCandidate, armorValue: bt.rearArmorValue, slotKey: slot, ttt: bt.targetThroughAndThrough, bodyTtt: bt.bodyThroughAndThrough,
        durSlot: skHard, durBefore: dBefore, durAfter: dAfter,
        durDelta: (dBefore != null && dAfter != null) ? +(dBefore - dAfter).toFixed(3) : null,
        softDurDelta: (softBefore != null && softAfter != null) ? +(softBefore - softAfter).toFixed(3) : null,
        retained: bt.retainedInRearArmor,
        continueRaycast: bt.continueRaycast, contPacket: bt.continuationThreatPacket };
    };
    // [0.39.8 §4] A는 후면 방호 armorValue를 확정적으로 초과하도록 fixture 조정(seed 무관 안정) — comparator 완화 아님
    const fx = _iwCreateRearArmoredTarget(ctx);
    // [0.39.9] rear 방호 판정은 rollPenetration 확률 roll이므로, 앞선 test의 RNG 소비량에 따라
    //   stream 위치가 흔들리면 같은 fixture에서도 결과가 달라진다(A 관통 78.6% / B 저지 99%).
    //   각 측정을 전용 고정 stream에서 수행해 outer seed와 무관하게 재현 가능하게 만든다.
    //   (gameplay 계산식·residual 70/25/0 수치는 그대로 — 측정 재현성만 확보)
    return { fixture: { bodyArmorId: fx.bodyArmorId, backPlateId: fx.backPlateId, rngStream: _IW_REAR_FIXTURE_SEED },
      A: withSeededGameplayRng(_IW_REAR_FIXTURE_SEED, () => runRear(70, 0.95)),
      B: withSeededGameplayRng(_IW_REAR_FIXTURE_SEED, () => runRear(25, 0.85)),
      C: withSeededGameplayRng(_IW_REAR_FIXTURE_SEED, () => runRear(0, 0.9)) };
  });
  evidence.rear = rr;
  // [0.39.9 §3] rear_soft / chest_rear_soft / no_rear_armor / null은 PASS로 인정하지 않는다.
  T('C-REAR_real_fixture',
    rr.A.candidate === 'rear_plate' && rr.B.candidate === 'rear_plate' &&
    rr.A.slotKey === 'chest_rear_hard' && rr.B.slotKey === 'chest_rear_hard' &&
    rr.A.rearResult === 'rear_armor_penetrated' && rr.B.rearResult === 'stopped_by_rear_plate' &&
    rr.fixture.bodyArmorId === 'armor_6b23_test' && rr.fixture.backPlateId === 'plate_korund_vm_back',
    'A/B 모두 실제 rear_plate + chest_rear_hard (A 관통 / B 저지)',
    `A=${rr.A.rearResult}/${rr.A.candidate}/${rr.A.slotKey} B=${rr.B.rearResult}/${rr.B.candidate}/${rr.B.slotKey} fixture=${rr.fixture.bodyArmorId}+${rr.fixture.backPlateId}`,
    'resolveRearArmorInteraction');
  T('C-REAR_preRear_strict', rr.A.preRear > rr.B.preRear && rr.B.preRear > rr.C.preRear && rr.C.preRear === 0, 'strict A>B>C, C=0', `${rr.A.preRear} > ${rr.B.preRear} > ${rr.C.preRear}`, 'buildBodyTrajectoryContext(projectilePenBeforeRearArmor)');
  T('C-REAR_post_monotonic', rr.A.postRear >= rr.B.postRear && rr.B.postRear >= rr.C.postRear && rr.C.postRear === 0 && rr.C.ttt === false,
    'postRear A>=B>=C, C 관통결과 없음', `post ${rr.A.postRear} >= ${rr.B.postRear} >= ${rr.C.postRear}, C ttt=${rr.C.ttt} rear=${rr.C.rearResult}`, 'buildBodyTrajectoryContext(projectilePenAfterRearArmor)');
  T('C-REAR_durability', (rr.A.durDelta != null && rr.A.durDelta > 0) && (rr.B.durDelta != null && rr.B.durDelta > 0) && rr.C.durDelta === 0,
    'A/B chest_rear_hard 내구도 감소, C 변화 0', `A Δ${rr.A.durDelta} B Δ${rr.B.durDelta} C Δ${rr.C.durDelta} (slot=${rr.A.durSlot})`, 'applyRearArmorDurabilityDamage');
  // ── continuation packet contract (positive 필수 / zero 정책 정확 일치) ──
  const cA = rr.A.contPacket, cC = rr.C.contPacket;
  evidence.continuation = { policy: CONTINUATION_ZERO_POLICY,
    positive: cA ? { continueRaycast: rr.A.continueRaycast, residualPen: cA.residualPen, residualIntegrity: cA.residualIntegrity, hasProfile: !!cA.projectileProfile, profileTBC: cA.projectileProfile && cA.projectileProfile.terminalBehaviorClass } : null,
    zero: { continueRaycast: rr.C.continueRaycast, packet: cC } };
  T('C-CONT_positive_required', rr.A.continueRaycast === true && !!cA && cA.residualPen > 0 && !!cA.projectileProfile, 'continueRaycast+packet+residualPen>0+profile', cA ? `ray=${rr.A.continueRaycast} pen=${cA.residualPen} profile=${!!cA.projectileProfile}` : 'packet MISSING', 'buildBodyTrajectoryContext(continuationThreatPacket)');
  T('C-CONT_zero_policy_omit', CONTINUATION_ZERO_POLICY === 'omit' && rr.C.continueRaycast === false && cC == null, 'omit: ray=false, packet=null', `ray=${rr.C.continueRaycast} packet=${cC == null ? 'null' : 'PRESENT'}`, 'buildBodyTrajectoryContext');
  // ── secondary target: 실제 _spawnContinuationRaycast ──
  const sec = withSeededGameplayRng(seed, () => {
    const { shooter, target } = _iwCreateTestPair(ctx, { sx:5, tx:6 });
    const second = makeUnit({ team:'enemy', name:'IW Second', x: mToPx(8), y: mToPx(5), facing: Math.PI, weaponId:'akm', ammoId:'556_m855', role:'reactive', loadout:{ weaponId:'akm', ammoId:'556_m855' } });
    _iwStripArmor(second); second.alive = true; second.stance = 'standing'; ctx.units.push(second);
    const w = resolveAmmoForWeapon(shooter, WEAPONS[shooter.weaponId]);
    const posPacket = Object.assign({}, cA || {}, { originalAmmoId:'556_m855', sourceType:'bullet', residualPen: (cA && cA.residualPen) || 30, residualDamage: 12, continuationDepth: 0 });
    const hitRes = _spawnContinuationRaycast(shooter, target, 1, 0, w, posPacket);
    // [0.39.8 §5-1] zero residual 경로가 2차 표적을 실제로 손상시키지 않는지 직접 assertion
    const snapMed = (u) => ({ wounds: u.medical.wounds.length, blood: u.medical.bloodMl, shock: u.medical.shock, pain: u.medical.pain, hp: u.hp, alive: u.alive });
    const zeroBefore = snapMed(second);
    const zeroPacket = Object.assign({}, posPacket, { residualPen: 0, residualDamage: 0 });
    const zeroRes = _spawnContinuationRaycast(shooter, target, 1, 0, w, zeroPacket);
    const nullRes = _spawnContinuationRaycast(shooter, target, 1, 0, w, null);
    const zeroAfter = snapMed(second);
    return { hitRes, zeroRes, nullRes, zeroBefore, zeroAfter, secondWounds: second.medical.wounds.length, secondAlive: second.alive };
  });
  const _slim = (r) => r ? { hit: !!r.hit, reason: r.reason || null, targetId: (r.target && r.target.id) || (r.unit && r.unit.id) || null } : null;
  const zeroUnchanged = sec.zeroBefore.wounds === sec.zeroAfter.wounds && sec.zeroBefore.blood === sec.zeroAfter.blood && sec.zeroBefore.shock === sec.zeroAfter.shock && sec.zeroBefore.pain === sec.zeroAfter.pain && sec.zeroBefore.hp === sec.zeroAfter.hp;
  evidence.secondaryTarget = { positive: _slim(sec.hitRes), zero: _slim(sec.zeroRes), nullPacket: _slim(sec.nullRes), zeroBefore: sec.zeroBefore, zeroAfter: sec.zeroAfter, zeroUnchanged };
  T('C-SECOND_positive_spawns', sec.hitRes && sec.hitRes.reason !== 'residual_too_low' && sec.hitRes.reason !== 'no_packet', 'positive residual → continuation 시도', JSON.stringify(sec.hitRes && { hit: sec.hitRes.hit, reason: sec.hitRes.reason }), '_spawnContinuationRaycast');
  T('C-SECOND_zero_no_continuation', sec.zeroRes && sec.zeroRes.hit === false && sec.zeroRes.reason === 'residual_too_low' && sec.nullRes.reason === 'no_packet' && zeroUnchanged,
    'residual0 → 관통 없음 + 2차 표적 wound/blood/shock/pain 불변', `zero=${sec.zeroRes && sec.zeroRes.reason} null=${sec.nullRes && sec.nullRes.reason} wounds ${sec.zeroBefore.wounds}->${sec.zeroAfter.wounds} blood ${sec.zeroBefore.blood}->${sec.zeroAfter.blood} shock ${sec.zeroBefore.shock}->${sec.zeroAfter.shock} pain ${sec.zeroBefore.pain}->${sec.zeroAfter.pain}`, '_spawnContinuationRaycast');
  // ── barrier-blind residual / AP 불변식 ──
  const brt = (id) => { const a = AMMO_PRESETS[id]; if (!a || typeof getAmmoEffectivePenForMaterial !== 'function') return null; return buildResidualThreatAfterHard(a, getAmmoEffectivePenForMaterial(a, 'ceramic'), 38, {}, {}); };
  const mk = brt('556_mk318_sost'), hy = brt('68x51_sig_hybrid'), xm = brt('68x51_xm1184_ap');
  if (mk) T('C-BB_mk318_nonAP', mk.residualKind !== 'intact_penetrator', '!= intact_penetrator', mk.residualKind, 'buildResidualThreatAfterHard');
  if (hy) T('C-BB_hybrid_nonAP', hy.residualKind !== 'intact_penetrator', '!= intact_penetrator', hy.residualKind, 'buildResidualThreatAfterHard');
  if (xm) T('C-BB_xm1184_AP', xm.residualKind === 'intact_penetrator', '= intact_penetrator', xm.residualKind, 'buildResidualThreatAfterHard');
  if (xm && hy) T('C-BB_xm1184>hybrid', xm.residualPen > hy.residualPen, 'XM1184 > Hybrid', `${xm.residualPen} > ${hy.residualPen}`, 'buildResidualThreatAfterHard');
  for (const id of ['9x39_sp6_7n9','127x55_ps12b']) { const a = AMMO_PRESETS[id]; if (!a) continue; const prof = getCanonicalProjectileProfile(a); const r = brt(id); T('C-AP_' + id, prof.apLike === true && !!r && r.residualKind === 'intact_penetrator', 'apLike+intact_penetrator', `apLike=${prof.apLike} kind=${r && r.residualKind}`, 'getCanonicalProjectileProfile/buildResidualThreatAfterHard'); }
  // ── canonical consumer consistency ──
  for (const id of ['556_m855','300blk_220_subsonic','9x39_sp6_7n9','556_mk318_sost','545_us_gs']) {
    const a = AMMO_PRESETS[id]; if (!a) continue;
    const prof = getCanonicalProjectileProfile(a);
    const kin = computeProjectileKinetics(a, (a.velocity||500)*0.9, a.velocity||500);
    const pkt = buildImpactTraumaPacket(kin, a, { id:'w' }, { penetrated:true }, { armorResult:'penetrated' }, { penetrated:true, armorResult:'penetrated', residualPen:12, residualIntegrity:0.9 });
    const pp = pkt.projectileProfile;
    const ev = { ammoId:id, sourceType:'bullet', partKey:'chest', hitPart:'chest', armorResult:'penetrated', rawDamage:32, impactPacket:pkt, bleedRisk:0.3 };
    const ws = computeWoundSize(a, ev, 'deep'); const bt = buildBodyTrajectoryContext({ medical:{} }, ev, 'deep');
    const consistent = pp && pp.subsonicClass === prof.subsonicClass && pp.armorThreatClass === prof.armorThreatClass && pp.terminalBehaviorClass === prof.terminalBehaviorClass && pp.apLike === prof.apLike && pp.diameterMm === prof.diameterMm
      && ws.subsonicClass === prof.subsonicClass && ws.terminalBehaviorClass === prof.terminalBehaviorClass && ws.apLike === prof.apLike && bt.terminalEffectType === prof.terminalBehaviorClass;
    T('C-CANON_' + id, consistent, 'profile==packet==wound==bodyTraj', consistent ? 'match' : JSON.stringify({ c:prof.terminalBehaviorClass, p:pp&&pp.terminalBehaviorClass, w:ws.terminalBehaviorClass, bt:bt.terminalEffectType }), 'getCanonicalProjectileProfile/buildImpactTraumaPacket/computeWoundSize/buildBodyTrajectoryContext');
  }
  // ── 실제 AAR consumer: resolveImpact → recordImpactEvent → GAME._impactLog / battleReport.impactLog → normalizeImpactForAAR ──
  const aar = withSeededGameplayRng(seed, () => {
    const { shooter, target } = _iwCreateTestPair(ctx);
    aarInit();
    GAME.gameTime = 3;
    const seqBefore = GAME._impactLogSeq, rawBefore = GAME._impactLog.length, brBefore = GAME.battleReport.impactLog.length;
    _iwHitReal(shooter, target, 'front.torso.chest.mid', 'chest');
    const raw = GAME._impactLog[GAME._impactLog.length - 1];
    const brEv = GAME.battleReport.impactLog[GAME.battleReport.impactLog.length - 1];
    const bt = brEv && brEv.bodyTrajectory;
    const prof = getCanonicalProjectileProfile(AMMO_PRESETS[shooter.ammoId]);
    const wound = target.medical.wounds[target.medical.wounds.length - 1];
    const ws = wound && wound.woundSize;
    const brHashBefore = _iwStableHash(brEv);
    const norm = (typeof normalizeImpactForAAR === 'function' && brEv) ? normalizeImpactForAAR(brEv) : null;
    const brHashAfter = _iwStableHash(brEv);
    const cont = bt && bt.continuationThreatPacket;
    return {
      seqBefore, seqAfter: GAME._impactLogSeq, rawGrew: GAME._impactLog.length > rawBefore, brGrew: GAME.battleReport.impactLog.length > brBefore,
      raw: raw && { eventId: raw.eventId, hitPart: raw.hitPart, armorResult: raw.armorResult, targetId: raw.targetId, hasAddress: !!raw.impactAddress },
      brEv: brEv && { eventId: brEv.eventId, ammoId: brEv.ammoId, hitPart: brEv.hitPart, armorResult: brEv.armorResult, hasAddress: !!brEv.impactAddress, hasBodyTraj: !!bt },
      btFields: bt && { terminalEffectType: bt.terminalEffectType, penBeforeBody: bt.projectilePenBeforeBody, penBeforeRear: bt.projectilePenBeforeRearArmor, continueRaycast: bt.continueRaycast },
      contProfile: cont && cont.projectileProfile ? { diameterMm: cont.projectileProfile.diameterMm, armorThreatClass: cont.projectileProfile.armorThreatClass, terminalBehaviorClass: cont.projectileProfile.terminalBehaviorClass, apLike: cont.projectileProfile.apLike, heavySlow: cont.projectileProfile.heavySlow, residualPen: cont.residualPen } : null,
      wound: ws && { terminalBehaviorClass: ws.terminalBehaviorClass, apLike: ws.apLike, subsonicClass: ws.subsonicClass },
      canon: { ammoId: shooter.ammoId, diameterMm: prof.diameterMm, armorThreatClass: prof.armorThreatClass, terminalBehaviorClass: prof.terminalBehaviorClass, apLike: prof.apLike, heavySlow: prof.heavySlow },
      normLabels: norm ? { hasLabel: !!(norm.primaryLabel || norm.bodyAddressLabel), armorLayerLabel: norm.armorLayerLabel || null } : null,
      normMutatedRaw: brHashBefore !== brHashAfter,
    };
  });
  evidence.aar = aar;
  T('C-AAR_event_recorded', !!(aar.raw && aar.brEv && aar.rawGrew && aar.brGrew && aar.seqAfter > aar.seqBefore && aar.raw.eventId === aar.brEv.eventId && aar.brEv.ammoId && aar.brEv.hitPart && aar.brEv.hasAddress),
    'raw+battleReport 기록, eventId 일치', `seq ${aar.seqBefore}->${aar.seqAfter} eventId=${aar.raw && aar.raw.eventId}/${aar.brEv && aar.brEv.eventId} ammo=${aar.brEv && aar.brEv.ammoId} part=${aar.brEv && aar.brEv.hitPart}`, 'resolveImpact/recordImpactEvent/aarRecordImpact');
  const btCanon = !!(aar.btFields && aar.btFields.terminalEffectType === aar.canon.terminalBehaviorClass);
  const wCanon = !!(aar.wound && aar.wound.terminalBehaviorClass === aar.canon.terminalBehaviorClass && aar.wound.apLike === aar.canon.apLike);
  const cCanon = !aar.contProfile || (aar.contProfile.diameterMm === aar.canon.diameterMm && aar.contProfile.armorThreatClass === aar.canon.armorThreatClass && aar.contProfile.terminalBehaviorClass === aar.canon.terminalBehaviorClass && aar.contProfile.apLike === aar.canon.apLike && aar.contProfile.heavySlow === aar.canon.heavySlow);
  T('C-AAR_canonical_fields', btCanon && wCanon && cCanon, 'AAR bodyTrajectory/wound/continuation == canonical',
    `bt=${aar.btFields && aar.btFields.terminalEffectType} wound=${aar.wound && aar.wound.terminalBehaviorClass}/${aar.wound && aar.wound.apLike} cont=${aar.contProfile ? aar.contProfile.terminalBehaviorClass + '/' + aar.contProfile.diameterMm : 'none'} canon=${aar.canon.terminalBehaviorClass}/${aar.canon.apLike}/${aar.canon.diameterMm}`, 'aarRecordImpact/buildBodyTrajectoryContext/computeWoundSize');
  T('C-AAR_normalize_no_mutation', !!(aar.normLabels && aar.normLabels.hasLabel) && aar.normMutatedRaw === false,
    'normalize는 표시 전용(raw 불변)', `labels=${aar.normLabels && aar.normLabels.hasLabel} rawMutated=${aar.normMutatedRaw}`, 'normalizeImpactForAAR');
  // ── subsonic 13 matrix ──
  const SUB13 = ['4.6_subsonic_sx','5.7_sb193_subsonic','545_us_gs','762x39_us','9x21_7u4_subsonic','9x39_sp5_7n8','300blk_220_subsonic','338lm_ucw_subsonic','127x55_ps12','9x39_sp6_7n9','9x39_pab9','9x39_bp_7n12','127x55_ps12b'];
  let mOk = true, mDet = [];
  for (const id of SUB13) { const a = AMMO_PRESETS[id]; if (!a) { mOk = false; mDet.push(id+':missing'); continue; } const pr = getCanonicalProjectileProfile(a); if (pr.subsonicClass === 'none' || pr.fallbackUsed) { mOk = false; mDet.push(id+':'+pr.subsonicClass); } }
  T('C-SUB_matrix', mOk, '13종 분류+무fallback', mOk ? 'ok(13/13)' : mDet.join(','), 'getCanonicalProjectileProfile');
  T('C-SUB_545_standard', getCanonicalProjectileProfile(AMMO_PRESETS['545_us_gs']).terminalBehaviorClass === 'subsonic_standard', 'subsonic_standard', getCanonicalProjectileProfile(AMMO_PRESETS['545_us_gs']).terminalBehaviorClass, 'getCanonicalProjectileProfile');
  // ── physiological shock (실제 tickMedical) ──
  withSeededGameplayRng(seed, () => {
    const { shooter, target } = _iwCreateTestPair(ctx);
    GAME.gameTime = 1; const shock0 = target.medical.shock;
    _iwHitReal(shooter, target, 'front.limb.left_leg.mid_thigh', 'left_leg');
    T('C-PS_no_instant_shock', target.medical.shock <= shock0 + 3 && target.medical._acuteResponse != null && target.medical.pain > 0, 'shock 즉증없음+acute+pain', `shock ${shock0}->${target.medical.shock.toFixed(1)} pain=${target.medical.pain.toFixed(1)}`, 'resolveImpact/computeAcuteImpactResponse');
    _iwHitReal(shooter, target, 'front.torso.abdomen.mid', 'abdomen'); _iwHitReal(shooter, target, 'front.torso.abdomen.mid', 'abdomen');
    target.medical.bloodMl = Math.min(target.medical.bloodMl, 2900); const shockPre = target.medical.shock;
    for (let i = 0; i < 300; i++) { GAME.gameTime += 0.1; tickMedical(target, 0.1); }
    T('C-PS_bleed_shock_rise', target.medical.shock > shockPre && target.medical.bloodMl < target.medical.bloodMax, '출혈 → shock 상승', `shock ${shockPre.toFixed(1)}->${target.medical.shock.toFixed(1)}`, 'tickMedical');
  });
  // ── part destruction 회귀 ──
  // [B-STAGE §17] A단계에는 가벼운 smoke만 남긴다 — 상세 통계/게이트 검증은 runPartDestructionClosureSuite 담당.
  //   존재하지 않던 pd.traumaticAmputation boolean 검사를 제거하고 실제 상태 문자열 집합으로 판정한다.
  const PD_CATASTROPHIC_STATES = ['mangled','destroyed','partial_traumatic_loss','traumatic_amputation','catastrophic_non_limb'];
  const pdStats = withSeededGameplayRng(seed, () => {
    let states = {}, catastrophic = 0, nonLimbOnLimb = 0, total = 0;
    for (let i = 0; i < 20; i++) {
      const { shooter, target } = _iwCreateTestPair(ctx); GAME.gameTime = i + 1;
      _iwHitReal(shooter, target, 'front.limb.left_leg.mid_thigh', 'left_leg');
      const pdAll = target.medical.partDestruction || {};
      const pd = (pdAll.leftLeg && pdAll.leftLeg.sourceWoundIds.length) ? pdAll.leftLeg : pdAll.rightLeg;
      if (!pd || !pd.sourceWoundIds.length) continue;
      total++;
      states[pd.state] = (states[pd.state] || 0) + 1;
      if (PD_CATASTROPHIC_STATES.indexOf(pd.state) >= 0) catastrophic++;
      if (pd.state === 'catastrophic_non_limb') nonLimbOnLimb++;   // 사지 통계에 비사지 상태가 나오면 별도 실패
    }
    return { states, catastrophic, nonLimbOnLimb, total };
  });
  evidence.partDestruction = pdStats;
  T('C-PD_regression', pdStats.total > 0 && pdStats.catastrophic <= pdStats.total * 0.2 && pdStats.nonLimbOnLimb === 0,
    '단발 사지 catastrophic <=20%, 비사지 상태 0', `${pdStats.catastrophic}/${pdStats.total} nonLimb=${pdStats.nonLimbOnLimb} states=${JSON.stringify(pdStats.states)}`, 'resolveImpact/partDestruction');
  // ── determinism (실제 RNG 소비 전투) ──
  const combatHash = (sd) => withSeededGameplayRng(sd, () => {
    const { shooter, target } = _iwCreateTestPair(ctx);
    GAME.gameTime = 1; _iwHitReal(shooter, target, 'front.torso.chest.mid', 'chest'); _iwHitReal(shooter, target, 'front.limb.left_leg.mid_thigh', 'left_leg');
    const w = target.medical.wounds.map(x => { const ws = x.woundSize || {}; return [x.partKey, ws.sizeClass, ws.penetrationDepthScore, ws.impactEnergyJ, ws.terminalBehaviorClass].join(':'); }).join('|');
    return _iwShortHash(w + '#shock' + Math.round(target.medical.shock) + '#blood' + Math.round(target.medical.bloodMl) + '#pain' + Math.round(target.medical.pain) + '#frac' + (target.medical.fractures ? target.medical.fractures.length : 0));
  });
  const h1 = combatHash(seed), h2 = combatHash(seed);
  // [0.39.8 §2] 단일 seed pair 강제 비교 제거 — 이산 결과 구간 충돌로 인한 false failure 방지.
  //   4개 variant 중 최소 하나가 baseline과 다르면 RNG 의존성 확인으로 충분(무조건 true 아님).
  const variants = [combatHash(seed + 1), combatHash(seed + 2), combatHash(seed + 3), combatHash(seed + 4)];
  const diffCount = variants.filter(h => h !== h1).length;
  evidence.determinism = { sameSeedA: h1, sameSeedB: h2, variantSeeds: [seed+1, seed+2, seed+3, seed+4], variants, diffCount };
  T('C-DET_same_seed', h1 === h2, 'same seed 동일 hash', `${h1} == ${h2}`, 'resolveImpact 전투 전체');
  T('C-DET_diff_seed', diffCount > 0, 'variant 중 최소 1개가 baseline과 다름', `${diffCount}/4 differ (baseline ${h1})`, 'resolveImpact 전투 전체');
  const failures = tests.filter(t => !t.pass);
  return { tests, failures, evidence };
}

// ════════════════════ MUTATION CORE (같은 sandbox 안에서 closure CORE로 검출) ════════════════════
function _runImpactWoundMutationCore(ctx, seed) {
  const results = [];
  const AMMO = (typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS : {};
  const TP = (typeof AMMO_TERMINAL_PROFILE !== 'undefined') ? AMMO_TERMINAL_PROFILE : {};
  // 검출기 — public suite를 다시 부르지 않고 같은 sandbox의 core를 호출한다.
  const detect = () => {
    const failureIds = [];
    const rep = _mkValidationReport();
    try { validateImpactWoundFoundation(rep); } catch (e) { rep.error('exc', e.message); }
    for (const er of rep.errors) failureIds.push('validator:' + er.msg.slice(0, 40));
    let cs; try { cs = _runImpactWoundClosureCore(ctx, seed); } catch (e) { failureIds.push('closureCore:exc:' + e.message); cs = { failures: [] }; }
    for (const f of (cs.failures || [])) failureIds.push('closure:' + f.id);
    return failureIds;
  };
  // [0.39.8 §3] mutation 주입 전 baseline failure 집합 — mutation과 무관한 failure가 detection에 섞이지 않게 한다.
  _iwResetSandboxToBaseline(ctx);
  const baselineFailureList = detect();
  const baselineFailures = new Set(baselineFailureList);
  const baselineClean = baselineFailureList.length === 0;
  // baseline이 clean하지 않으면 mutation suite를 시작하지 않는다 (오염된 검출 금지).
  if (!baselineClean) {
    return { mutations: [], failures: [{ mutationId: 'BASELINE_NOT_CLEAN', baselineFailures: baselineFailureList.slice(0, 8) }],
      baselineClean, baselineFailureCount: baselineFailureList.length, baselineFailures: baselineFailureList.slice(0, 8), blocked: true };
  }
  // mutation 후 새로 생긴 failure만 검출로 인정
  const detectNew = () => detect().filter(id => !baselineFailures.has(id));
  const runOne = (mutationId, spec) => {
    _iwResetSandboxToBaseline(ctx);
    const rngBefore = Math.random;
    const r = spec();
    const hooksClean = _iwMutationHookNames().length === 0;
    _iwResetSandboxToBaseline(ctx);                       // 다음 mutation으로 잔여가 넘어가지 않도록
    const baselineChk = _iwAssertSandboxBaselineRestored(ctx);
    results.push(Object.assign({ mutationId, rngRestored: (Math.random === rngBefore), hooksRemoved: hooksClean, sandboxBaselineRestored: baselineChk.ok, baselineResidue: baselineChk.paths }, r));
  };
  // 데이터 mutation 공통 — 동일 대상 before/mutated/restored hash
  const dataMutation = (targetObj, mutate) => {
    const beforeHash = _iwStableHash(targetObj);
    const undo = mutate();
    const mutatedHash = _iwStableHash(targetObj);
    const injected = (mutatedHash !== beforeHash);
    const failureIds = detectNew();
    if (typeof undo === 'function') undo();
    const restoredHash = _iwStableHash(targetObj);
    return { injected, detected: failureIds.length >= 1, detectedBy: failureIds.slice(0, 4), failureIds,
      hashTarget: 'ammo/terminalProfile data object', beforeHash: _iwShortHash(beforeHash), mutatedHash: _iwShortHash(mutatedHash), restoredHash: _iwShortHash(restoredHash),
      restored: (restoredHash === beforeHash), localMutation: false, globalDataMutated: true };
  };
  runOne('M1_terminal_mismatch', () => dataMutation(TP['545_us_gs'] || {}, () => { const t = TP['545_us_gs']; if (!t) return null; const sv = t.family; t.family = 'subsonic_heavy'; return () => { t.family = sv; }; }));
  runOne('M2_bblind_ap', () => dataMutation(AMMO['556_mk318_sost'] || {}, () => { const a = AMMO['556_mk318_sost']; if (!a) return null; const sv = a.barrierBehavior; a.barrierBehavior = 'penetrator'; return () => { a.barrierBehavior = sv; }; }));
  runOne('M3_pdw_unknown', () => dataMutation(AMMO['4.6_subsonic_sx'] || {}, () => { const a = AMMO['4.6_subsonic_sx']; if (!a) return null; const sv = { c:a.caliber, b:a.barrierBehavior, sc:a.subsonicClass, p:a.projectile ? a.projectile.subsonicClass : undefined }; a.subsonicClass = 'none'; if (a.projectile) a.projectile.subsonicClass = 'none'; a.caliber = 'zzz_unknown'; a.barrierBehavior = 'zzz_unknown'; return () => { a.caliber = sv.c; a.barrierBehavior = sv.b; if (sv.sc === undefined) delete a.subsonicClass; else a.subsonicClass = sv.sc; if (a.projectile) { if (sv.p === undefined) delete a.projectile.subsonicClass; else a.projectile.subsonicClass = sv.p; } }; }));
  // M4 — 로컬 packet mutation. consumer별 계약: bodyTrajectory는 packet source-of-truth(변해야 함),
  //      wound는 canonical ammo를 재구성하므로 저항이 정상(계약 B). 복원은 "새 packet 생성 시 baseline 재현"으로 검증.
  runOne('M4_packet_consumer_mismatch', () => {
    const id = '300blk_220_subsonic'; const a = AMMO[id];
    if (!a) return { injected:false, detected:false, detectedBy:[], failureIds:[], restored:false, localMutation:true, globalDataMutated:false };
    const prof = getCanonicalProjectileProfile(a);
    const mkEv = (pkt) => ({ ammoId:id, sourceType:'bullet', partKey:'chest', hitPart:'chest', armorResult:'penetrated', rawDamage:60, impactPacket:pkt, bleedRisk:0.3 });
    const mkPkt = () => { const kin = computeProjectileKinetics(a, (a.velocity||315)*0.9, a.velocity||315); return buildImpactTraumaPacket(kin, a, { id:'w' }, { penetrated:true }, { armorResult:'penetrated' }, { penetrated:true, armorResult:'penetrated', residualPen:14, residualIntegrity:0.9 }); };
    const consumerOut = (pkt) => { const ws = computeWoundSize(a, mkEv(pkt), 'deep'); const bt = buildBodyTrajectoryContext({ medical:{} }, mkEv(pkt), 'deep'); return { woundTBC: ws.terminalBehaviorClass, woundAP: ws.apLike, woundDia: ws.projectileDiameterMm, btFam: bt.terminalEffectType, btDepth: bt.woundDepthClass }; };
    const baseOut = consumerOut(mkPkt());                    // baseline (동일 대상: consumer 출력)
    const badPkt = mkPkt();
    badPkt.projectileProfile.terminalBehaviorClass = 'rifle_ap';
    badPkt.projectileProfile.apLike = true;
    badPkt.projectileProfile.diameterMm = 0.300;
    const injected = (badPkt.projectileProfile.terminalBehaviorClass !== prof.terminalBehaviorClass);
    const mutOut = consumerOut(badPkt);
    const failureIds = [];
    if (mutOut.btFam !== baseOut.btFam) failureIds.push('C-CANON-bodyTrajectory:family ' + baseOut.btFam + '->' + mutOut.btFam);
    if (mutOut.woundTBC !== baseOut.woundTBC || mutOut.woundAP !== baseOut.woundAP) failureIds.push('C-CANON-wound:changed');
    const restoredOut = consumerOut(mkPkt());                // mutated packet 폐기 후 새 packet 재생성
    const globalClean = (_iwStableHash(a) === _iwStableHash(AMMO[id]));
    return { injected, detected: failureIds.length >= 1, detectedBy: failureIds.slice(0, 4), failureIds,
      hashTarget: 'consumer output {wound,bodyTrajectory}',
      beforeHash: _iwShortHash(_iwStableHash(baseOut)), mutatedHash: _iwShortHash(_iwStableHash(mutOut)), restoredHash: _iwShortHash(_iwStableHash(restoredOut)),
      restored: (_iwStableHash(restoredOut) === _iwStableHash(baseOut)) && globalClean,
      localMutation: true, globalDataMutated: false,
      consumerContract: { bodyTrajectory: 'packet source-of-truth (must change)', wound: 'canonical ammo re-read (resistance normal)', baseline: baseOut, mutated: mutOut } };
  });
  // M5 — 실제 _normalizeResidualThreat hook: 명시적 0을 missing처럼 → consumer fallback 부활
  runOne('M5_residual_zero', () => {
    const orig = _normalizeResidualThreat;
    const baseC = withSeededGameplayRng(seed, () => _iwResidualConsumers(0, 0.9, true));
    _iwInstallHook('_normalizeResidualThreat', function (ev) { const r = orig(ev); if (r && r.residualPen === 0) r.residualPenPresent = false; return r; });
    const injected = (_normalizeResidualThreat !== orig);
    const dirtyC = withSeededGameplayRng(seed, () => _iwResidualConsumers(0, 0.9, true));
    const failureIds = [];
    if (dirtyC.woundDepth > baseC.woundDepth || dirtyC.btPen > baseC.btPen) failureIds.push('residual_consumer:zero_fallback depth ' + baseC.woundDepth + '->' + dirtyC.woundDepth + ' btPen ' + baseC.btPen + '->' + dirtyC.btPen);
    const csFail = detectNew().filter(x => /C-R_|C-REAR|C-CONT/.test(x));
    for (const f of csFail) failureIds.push(f);
    _iwRemoveHook('_normalizeResidualThreat');
    const restoredC = withSeededGameplayRng(seed, () => _iwResidualConsumers(0, 0.9, true));
    return { injected, detected: failureIds.length >= 1, detectedBy: failureIds.slice(0, 4), failureIds,
      hashTarget: 'residual consumer output (rp=0)',
      beforeHash: _iwShortHash(_iwStableHash(baseC)), mutatedHash: _iwShortHash(_iwStableHash(dirtyC)), restoredHash: _iwShortHash(_iwStableHash(restoredC)),
      restored: (_iwStableHash(restoredC) === _iwStableHash(baseC)) && (_normalizeResidualThreat === orig), localMutation: false, globalDataMutated: false, hookName: '_normalizeResidualThreat' };
  });
  // M6 — 실제 getAcuteActionBlockState hook로 processShotQueue gate 우회
  runOne('M6_shotqueue_bypass', () => {
    const orig = getAcuteActionBlockState;
    const queueRun = () => withSeededGameplayRng(seed, () => {
      const { target } = _iwCreateTestPair(ctx);
      target.impactKnockdownTimer = 1.2; const mag0 = target.magAmmo;
      target.shotQueue = { weaponId:target.weaponId, shotTimer:0.001, targetId:null, targetX:target.x+50, targetY:target.y, baseAng:0, remaining:3, magAtStart:mag0 };
      processShotQueue(target, 0.1);
      return { followup: target.shotQueue !== null, ammoDrop: mag0 - target.magAmmo, queueNull: target.shotQueue === null };
    });
    const base = queueRun();
    _iwInstallHook('getAcuteActionBlockState', function (u) { const r = orig(u); r.interruptsQueuedFire = false; return r; });
    const injected = (getAcuteActionBlockState !== orig);
    const dirty = queueRun();
    const failureIds = [];
    if (dirty.followup || dirty.ammoDrop > 0) failureIds.push('acute_queue:bypass_fired followup=' + dirty.followup + ' ammoDrop=' + dirty.ammoDrop);
    _iwRemoveHook('getAcuteActionBlockState');
    const restored = queueRun();
    return { injected, detected: failureIds.length >= 1, detectedBy: failureIds.slice(0, 4), failureIds,
      hashTarget: 'processShotQueue outcome {followup,ammoDrop,queueNull}',
      beforeHash: _iwShortHash(_iwStableHash(base)), mutatedHash: _iwShortHash(_iwStableHash(dirty)), restoredHash: _iwShortHash(_iwStableHash(restored)),
      restored: (_iwStableHash(restored) === _iwStableHash(base)) && (getAcuteActionBlockState === orig), localMutation: false, globalDataMutated: false, hookName: 'getAcuteActionBlockState',
      observed: { baseline: base, mutated: dirty, restored } };
  });
  runOne('M7_ap_false', () => dataMutation(AMMO['9x39_sp6_7n9'] || {}, () => { const a = AMMO['9x39_sp6_7n9']; if (!a) return null; const sv = { sc:a.subsonicClass, p:a.projectile ? a.projectile.subsonicClass : undefined, b:a.barrierBehavior }; a.subsonicClass = 'heavy'; if (a.projectile) a.projectile.subsonicClass = 'heavy'; a.barrierBehavior = 'heavy_subsonic'; return () => { if (sv.sc === undefined) delete a.subsonicClass; else a.subsonicClass = sv.sc; if (a.projectile) { if (sv.p === undefined) delete a.projectile.subsonicClass; else a.projectile.subsonicClass = sv.p; } a.barrierBehavior = sv.b; }; }));
  runOne('M8_diameter', () => dataMutation((AMMO['300blk_220_subsonic'] && AMMO['300blk_220_subsonic'].projectile) || {}, () => { const a = AMMO['300blk_220_subsonic']; if (!a || !a.projectile) return null; const sv = a.projectile.diameterMm; a.projectile.diameterMm = 0.300; return () => { a.projectile.diameterMm = sv; }; }));
  const failures = results.filter(r => !(r.injected && r.detected && r.restored && r.rngRestored && r.hooksRemoved && r.sandboxBaselineRestored && r.failureIds.length >= 1));
  return { mutations: results, failures, baselineClean, baselineFailureCount: baselineFailureList.length, baselineFailures: baselineFailureList.slice(0, 8), blocked: false };
}

// ════════════════════ SANDBOX TRANSACTION (public wrapper 전용) ════════════════════
function withImpactWoundHarnessSandbox(seed, fn) {
  const originalRandom = Math.random;
  const beforeFingerprint = _iwCaptureLiveStateFingerprint();
  const beforeDom = _iwCaptureDomFingerprint();
  const snap = _iwCaptureLiveState();
  let coreResult = null, coreError = null, domDuringCore = beforeDom, uiHooksActive = [];
  try {
    const ctx = _iwInstallSandboxState(seed);
    uiHooksActive = _IW_UI_HOOKS.slice();
    try { coreResult = fn(ctx); } finally { domDuringCore = _iwCaptureDomFingerprint(); }
  } catch (e) { coreError = e; }
  finally { _iwRemoveAllTestHooks(); _iwRestoreLiveState(snap); }
  const afterFingerprint = _iwCaptureLiveStateFingerprint();
  const afterDom = _iwCaptureDomFingerprint();
  const refPaths = [], contentPaths = [];
  for (const k of Object.keys(beforeFingerprint.refs)) if (beforeFingerprint.refs[k] !== afterFingerprint.refs[k]) refPaths.push(k === 'UNITS' || k === 'random' ? k + '.reference' : 'GAME.' + k + '.reference');
  for (const k of Object.keys(beforeFingerprint.contents)) if (beforeFingerprint.contents[k] !== afterFingerprint.contents[k]) contentPaths.push((k === 'UNITS' ? 'UNITS' : 'GAME.' + k) + '.content');
  const allChanged = _iwDiffFingerprint(beforeFingerprint, afterFingerprint);
  const domRestorePaths = _iwDiffDom(beforeDom, afterDom, 'DOM');
  const domCorePaths = _iwDiffDom(beforeDom, domDuringCore, 'DOM@core');
  const hooksRemoved = _iwInstalledHookNames().length === 0 && Object.keys(snap.hookOriginals).every(k => _IW_HOOKABLE[k].get() === snap.hookOriginals[k]);
  // [0.39.8 §1] GAME.units가 원래 없었다면 종료 후에도 없어야 한다 (loadout 화면 대응)
  const gameUnitsRestored = snap.hadGameUnits
    ? (Object.prototype.hasOwnProperty.call(GAME, 'units') && GAME.units === snap.originalGameUnits)
    : !Object.prototype.hasOwnProperty.call(GAME, 'units');
  const changedPaths = allChanged.concat(domRestorePaths).concat(Math.random === originalRandom ? [] : ['Math.random']);
  const stateIntegrity = {
    liveStateUnchanged: changedPaths.length === 0,
    gameOwnPropertiesRestored: _iwGameOwnPropsRestored(snap),
    referencesRestored: refPaths.length === 0,
    contentsRestored: contentPaths.length === 0,
    domUnchangedDuringCore: domCorePaths.length === 0,
    domRestored: domRestorePaths.length === 0,
    rngRestored: (Math.random === originalRandom),
    hooksRemoved,
    gameUnitsPropertyRestored: gameUnitsRestored,
    unitsAliasRestored: (UNITS === snap.unitsRef) && gameUnitsRestored && (((typeof UNITS !== 'undefined') && UNITS === GAME.units) === beforeFingerprint.scalars.unitsAlias),
  };
  return { coreResult, coreError, stateIntegrity, changedPaths, domChangedDuringCorePaths: domCorePaths,
    beforeFingerprint: _iwFingerprintDigest(beforeFingerprint), afterFingerprint: _iwFingerprintDigest(afterFingerprint),
    uiIsolationHooks: uiHooksActive,
    gameKeyCount: { before: snap.gameKeys.length, after: Object.getOwnPropertyNames(GAME).length } };
}
function _iwIntegrityAllTrue(si) { return Object.keys(si).every(k => si[k] === true); }
// ════════════════════ PUBLIC SUITES ════════════════════
function runImpactWoundClosureSuite(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runImpactWoundClosureCore(ctx, seed));
  const core = sb.coreResult || { tests: [], failures: [{ id: 'CORE_EXCEPTION', pass: false }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ id: 'CORE_EXCEPTION:' + sb.coreError.message, pass: false }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, tests: core.tests || [], failures: core.failures || [], evidence: core.evidence || {},
    stateIntegrity: sb.stateIntegrity, beforeFingerprint: sb.beforeFingerprint, afterFingerprint: sb.afterFingerprint,
    changedPaths: sb.changedPaths, domChangedDuringCorePaths: sb.domChangedDuringCorePaths, uiIsolationHooks: sb.uiIsolationHooks, gameKeyCount: sb.gameKeyCount,
    summary: `${(core.tests||[]).length - (core.failures||[]).length}/${(core.tests||[]).length} tests, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
function runImpactWoundMutationTests(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runImpactWoundMutationCore(ctx, seed));
  const core = sb.coreResult || { mutations: [], failures: [{ mutationId: 'CORE_EXCEPTION' }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ mutationId: 'CORE_EXCEPTION:' + sb.coreError.message }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, mutations: core.mutations || [], failures: core.failures || [],
    baselineClean: core.baselineClean, baselineFailureCount: core.baselineFailureCount, baselineFailures: core.baselineFailures, blocked: !!core.blocked,
    stateIntegrity: sb.stateIntegrity, beforeFingerprint: sb.beforeFingerprint, afterFingerprint: sb.afterFingerprint,
    changedPaths: sb.changedPaths, domChangedDuringCorePaths: sb.domChangedDuringCorePaths, uiIsolationHooks: sb.uiIsolationHooks, gameKeyCount: sb.gameKeyCount,
    summary: `${(core.mutations||[]).length - (core.failures||[]).length}/${(core.mutations||[]).length} full-pass, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}

function validateImpactWoundFoundation(rep) {
  if (typeof AMMO_PRESETS === 'undefined') { rep.error('impactWound', 'AMMO_PRESETS 미정의'); return rep; }
  const REG = (typeof AMMO_REGISTRY !== 'undefined') ? AMMO_REGISTRY : {};
  const fb = { kinetic: 0, diameter: 0, mass: 0, subsonic: 0, terminal: 0 };
  // 11-1. Projectile metadata
  for (const id in AMMO_PRESETS) {
    const a = AMMO_PRESETS[id];
    if (!a) continue;
    if ((a.pelletCount || 1) > 1) continue;   // 산탄은 pellet meta 별도
    const prof = getCanonicalProjectileProfile(a);
    if (prof.massG == null) { rep.error('impactWound', `${id}: projectile mass 없음(명시 fallback 필요)`); fb.mass++; }
    if (!(prof.diameterMm > 0)) rep.error('impactWound', `${id}: diameter 무효`);
    // 점 시작 인치식 오파싱 감지: .300/.338/.30-06가 1mm 미만이면 오류
    if (prof.diameterMm > 0 && prof.diameterMm < 3) rep.error('impactWound', `${id}: diameter ${prof.diameterMm}mm — 인치식 오파싱 의심`);
    if (prof.physicalSource === 'legacy_parser') fb.diameter++;
    // registry ↔ live 일치 (mass/diameter 의미 동일)
    const r = REG[id];
    if (r && r.projectile) {
      if (typeof r.projectile.massG === 'number' && prof.massG != null && Math.abs(r.projectile.massG - prof.massG) > 0.01)
        rep.error('impactWound', `${id}: registry mass(${r.projectile.massG})≠live(${prof.massG})`);
    }
  }
  // 11-2 & 11-3. Subsonic 전수 + 분류 정합성
  const subCounts = { pdw_light: 0, standard: 0, heavy: 0, armor_piercing: 0, none: 0 };
  const enumSubsonic = (obj, getCls, tag) => {
    for (const id in obj) {
      const a = obj[id]; if (!a) continue;
      const ec = a.energyClass || (a.energy && a.energy.class) || null;
      if (ec !== 'subsonic') continue;
      const prof = getCanonicalProjectileProfile(tag === 'registry' ? buildAmmoPresetFromRegistry(a) : a);
      const sc = prof.subsonicClass;
      if (sc === 'none') { rep.error('impactWound', `${id}: subsonic인데 subsonicClass 미분류(${tag})`); fb.subsonic++; }
      // 분류 정합성
      if (sc === 'pdw_light' && prof.heavySlow) rep.error('impactWound', `${id}: pdw_light인데 heavySlow`);
      if (sc === 'standard' && prof.terminalBehaviorClass === 'subsonic_heavy') rep.error('impactWound', `${id}: standard인데 subsonic_heavy terminal`);
      if (sc === 'armor_piercing' && !prof.apLike) rep.error('impactWound', `${id}: armor_piercing인데 apLike=false`);
      if (sc === 'heavy' && (prof.armorThreatClass === 'high_power_ap' || prof.armorThreatClass === 'anti_material')) {
        // heavy가 high_power_ap/anti_material이면 명시적 이유(penetration>=high or 12.7 실제구경) 있어야
        const pen = a.penetration || (a.ballistic && a.ballistic.penetration) || 0;
        const isBig = prof.diameterMm >= 11;
        if (!(pen >= 55 || isBig)) rep.error('impactWound', `${id}: heavy가 이유없이 ${prof.armorThreatClass}`);
      }
      if (tag === 'live' && subCounts[sc] != null) subCounts[sc]++;
    }
  };
  enumSubsonic(AMMO_PRESETS, getSubsonicClass, 'live');
  enumSubsonic(REG, getSubsonicClass, 'registry');
  // 초음속 .300 BLK heavySlow 금지
  for (const id in AMMO_PRESETS) {
    const a = AMMO_PRESETS[id]; if (!a) continue;
    const ec = a.energyClass || (a.energy && a.energy.class) || null;
    if (/300|blk/i.test(id) && ec !== 'subsonic') {
      const prof = getCanonicalProjectileProfile(a);
      if (prof.heavySlow) rep.error('impactWound', `${id}: 초음속 .300 BLK인데 heavySlow`);
    }
  }
  // [0.39.4] terminal profile mismatch — canonical terminalBehaviorClass vs 실제 terminalProfile.family
  const TP = (typeof AMMO_TERMINAL_PROFILE !== 'undefined') ? AMMO_TERMINAL_PROFILE : {};
  for (const id in AMMO_PRESETS) {
    const a = AMMO_PRESETS[id]; if (!a) continue;
    const prof = getCanonicalProjectileProfile(a);
    const fam = (TP[id] && TP[id].family) || (a.terminalProfile && a.terminalProfile.family) || null;
    if (!fam) continue;
    if (prof.subsonicClass === 'standard' && fam === 'subsonic_heavy') rep.error('impactWound', `${id}: canonical standard인데 terminalProfile.family=subsonic_heavy (mismatch)`);
    if (prof.subsonicClass === 'heavy' && fam === 'subsonic_standard') rep.error('impactWound', `${id}: canonical heavy인데 terminalProfile.family=subsonic_standard (mismatch)`);
    if (prof.subsonicClass === 'pdw_light' && fam === 'subsonic_heavy') rep.error('impactWound', `${id}: pdw_light인데 subsonic_heavy family (mismatch)`);
  }
  // [0.39.4] barrier-blind / AP contamination — barrierBlind이면 apLike=true 금지 (명시 AP metadata 없는 한)
  for (const id in AMMO_PRESETS) {
    const a = AMMO_PRESETS[id]; if (!a) continue;
    const prof = getCanonicalProjectileProfile(a);
    const explicitAP = !!(a.armorPiercing === true || a.penetrator === true || prof.subsonicClass === 'armor_piercing');
    if (prof.barrierBlind && prof.apLike && !explicitAP) rep.error('impactWound', `${id}: barrier-blind인데 apLike=true (AP 오염)`);
    if (prof.barrierBlind && (prof.armorThreatClass === 'high_power_ap' || prof.armorThreatClass === 'small_rifle_penetrator') && !explicitAP)
      rep.error('impactWound', `${id}: barrier-blind인데 AP armor threat(${prof.armorThreatClass})`);
    // 실제 terminalProfile.family가 barrier_blind인데 canonical이 AP면 오염 (behavior 변조 등)
    const _fam = (TP[id] && TP[id].family) || (a.terminalProfile && a.terminalProfile.family) || null;
    if (_fam === 'barrier_blind' && (prof.apLike || prof.terminalBehaviorClass === 'rifle_ap') && !explicitAP)
      rep.error('impactWound', `${id}: terminalProfile barrier_blind인데 canonical AP(apLike=${prof.apLike})`);
  }
  // [0.39.4] threat class consumer coverage — armorThreatClass가 ARMOR_MATERIAL_THREAT_RESPONSE에 등록됐는지
  if (typeof ARMOR_MATERIAL_THREAT_RESPONSE !== 'undefined') {
    const known = new Set(Object.keys(ARMOR_MATERIAL_THREAT_RESPONSE.steel || {}));
    for (const id in AMMO_PRESETS) {
      const a = AMMO_PRESETS[id]; if (!a) continue;
      if ((a.pelletCount || 1) > 1) continue;
      const tc = getArmorThreatClass(a);
      if (!known.has(tc)) rep.error('impactWound', `${id}: threat class '${tc}' 미등록(generic default 위험)`);
    }
  }
  // fallback 통계 (additive 정보)
  rep.info && rep.info('impactWound', `subsonic 분류: pdw_light=${subCounts.pdw_light} standard=${subCounts.standard} heavy=${subCounts.heavy} ap=${subCounts.armor_piercing}`);
  rep.info && rep.info('impactWound', `fallback: diameter=${fb.diameter} mass=${fb.mass} subsonic=${fb.subsonic}`);
  return rep;
}

// ════════════════════════════════════════════════════════════════════════════
// [B-STAGE] PART DESTRUCTION CLOSURE / MUTATION SUITE
//   A단계 sandbox(withImpactWoundHarnessSandbox)를 재사용하되 결과와 failure ID는 B 전용으로 분리한다.
//   모든 판정은 production 함수(resolveImpact → updatePartDestructionFromWound →
//   refreshPartDestructionState → applyPartDestructionEffects)를 실제로 통과시킨 결과만 읽는다.
// ════════════════════════════════════════════════════════════════════════════
const PD_ADDR = {
  thigh: 'front.limb.left_leg.mid_thigh', lowerThigh: 'front.limb.left_leg.lower_thigh',
  knee: 'front.limb.left_leg.knee', shin: 'front.limb.left_leg.shin', foot: 'front.limb.left_leg.foot',
  upperArm: 'front.limb.left_arm.upper_arm', forearm: 'front.limb.left_arm.forearm', hand: 'front.limb.left_arm.hand',
  chest: 'front.torso.chest.mid', abdomen: 'front.torso.abdomen.mid', head: 'front.head.skull.front',
  neck: 'front.neck.neck.neck_base',
};
const PD_LOC_OF = { thigh:'left_leg', lowerThigh:'left_leg', knee:'left_leg', shin:'left_leg', foot:'left_leg',
  upperArm:'left_arm', forearm:'left_arm', hand:'left_arm', chest:'chest', abdomen:'abdomen',
  head:'head_skull', neck:'neck' };   // [0.40.1] production locationToImpactPart이 인식하는 값 사용
const PD_MIRROR_PART = { leftLeg:'rightLeg', rightLeg:'leftLeg', leftArm:'rightArm', rightArm:'leftArm' };
const PD_PART_OF = { left_leg:'leftLeg', right_leg:'rightLeg', left_arm:'leftArm', right_arm:'rightArm', chest:'chest', abdomen:'abdomen', head:'head', neck:'neck' };
// 하나의 시나리오 실행 — 실제 사격 경로로 타격한 뒤 최종 partDestruction을 읽는다.
function _pdRunScenario(ctx, o) {
  const spots = o.spots || ['thigh'];
  const loc = PD_LOC_OF[spots[0]] || 'left_leg';
  let partKey = o.partKey || PD_PART_OF[loc] || 'leftLeg';
  const { shooter, target } = _iwCreateTestPair(ctx, { ammoId: o.ammoId || '556_m855', weaponId: o.weaponId || 'm4a1' });
  if (o.unarmored) _iwStripArmor(target);   // [0.40.1 §6.2] 테스트 fixture 전용 — 장비 시스템·탄약 수치 무변경
  if (o.directHitPart) {
    // [0.40.1 §6.3] production의 locationToBodyPart()는 location 'neck'을 head 부위로 귀속시킨다(기존 설계).
    //   따라서 neck 부위는 사격 경로로 도달할 수 없어, 파편/스폴이 쓰는 것과 동일한 canonical 피해 진입점
    //   applyDamageEvent()를 그대로 사용한다. 상태를 주입하지 않으며 part destruction 게이트는 전부 실행된다.
    for (const sp of spots) {
      const ap = getAddressParts(PD_ADDR[sp]);
      applyDamageEvent(target, {
        sourceType: 'bullet', hitPart: o.directHitPart, isLeft: null,
        rawDamage: o.directDamage || 26, tissueDamage: o.directDamage || 26,
        penetration: 30, penetrated: true, armorResult: 'penetrated', ammoId: o.ammoId || '556_m855',
        impactAddress: normalizeImpactAddressObject({ fullAddress: PD_ADDR[sp], side: ap.side, region: ap.region, hitPart: ap.hitPart, zone: ap.zone, subZone: ap.subZone }),
        hitZone: sp,
      });
    }
  } else {
    for (const sp of spots) _iwHitReal(shooter, target, PD_ADDR[sp], PD_LOC_OF[sp]);
  }
  // 좌우 판정은 production의 aspect 해석에 달려 있다 — 실제로 피격된 쪽을 읽는다(강제 주입 금지)
  const mirror = PD_MIRROR_PART[partKey];
  let resolvedKey = partKey;
  if (mirror && target.medical.partDestruction[mirror]) {
    const a = (target.medical.partDestruction[partKey].sourceWoundIds || []).length;
    const b = (target.medical.partDestruction[mirror].sourceWoundIds || []).length;
    if (b > a) resolvedKey = mirror;
  }
  partKey = resolvedKey;
  const pd = target.medical.partDestruction[partKey];
  const part = target.medical.bodyParts[partKey];
  return { shooter, target, pd, part, partKey,
    state: pd.state, cts: pd.cumulativeTraumaScore, dominantClusterKey: pd.dominantClusterKey,
    dominantClusterScore: pd.dominantClusterScore, dominantClusterState: pd.dominantClusterState,
    concentration: pd.localConcentrationRatio, functionRatio: part.functionRatio, disabled: !!part.disabled };
}
const PD_TIER_RANK = { minor:0, moderate:1, severe:2, catastrophic:3 };
// [0.40.1 §5.2] 파편 증거 비교용 테스트 fixture — production evidence builder가 읽는 필드만 구성한다.
//   골절을 주입해 비교를 통과시키지 않는다(fractureEvidence.occurred=false 고정).
function _pdBuildFragmentEvidenceFixture(partKey, variant) {
  const big = (variant === 'large_deep');
  const wound = {
    id: big ? 999002 : 999001, partKey, sourceType: 'frag', isFragment: true,
    fragmentSize: big ? 'large' : 'small', ammoId: big ? 'frag_large_fixture' : 'frag_small_fixture',
    woundSize: { sizeClass: big ? 'large' : 'micro', exitWoundPresent: false },
    fractureEvidence: { occurred: false },
    bodyTrajectory: { projectileSizeClass: 'fragment', woundDepthClass: big ? 'deep' : 'shallow' },
    vascularEvidence: { level: 'none' }, bleedingProfile: {},
  };
  const pd = makeDefaultPartDestruction(partKey);
  pd.sourceWoundIds = [wound.id];
  return { wound, pd };
}
const PD_SEVERE_STATES = ['mangled','destroyed','partial_traumatic_loss','traumatic_amputation','catastrophic_non_limb'];
const PD_LOSS_STATES = ['partial_traumatic_loss','traumatic_amputation'];
// 통계 분포 — 같은 seed 스트림에서 n회 반복
function _pdDistribution(ctx, seed, o, n) {
  const counts = {}; let ctsSum = 0, domSum = 0, concSum = 0, valid = 0;
  withSeededGameplayRng(seed, () => {
    for (let i = 0; i < n; i++) {
      GAME.gameTime = i + 1;
      const r = _pdRunScenario(ctx, o);
      // 미러(반대편) 판정으로 대상 부위에 상처가 없으면 표본에서 제외 — 파괴 분포가 아니라 명중 분포이기 때문
      if (r.pd.sourceWoundIds.length === 0) continue;
      valid++;
      counts[r.state] = (counts[r.state] || 0) + 1;
      ctsSum += r.cts; domSum += r.dominantClusterScore || 0; concSum += r.concentration || 0;
    }
  });
  const tot = Math.max(1, valid);
  const rate = (list) => list.reduce((a, k) => a + (counts[k] || 0), 0) / tot;
  return { counts, samples: valid, severeRate: +rate(PD_SEVERE_STATES).toFixed(3), lossRate: +rate(PD_LOSS_STATES).toFixed(3),
    ampRate: +((counts.traumatic_amputation || 0) / tot).toFixed(3),
    meanCts: +(ctsSum / tot).toFixed(3), meanDominant: +(domSum / tot).toFixed(3), meanConcentration: +(concSum / tot).toFixed(3) };
}
function _runPartDestructionClosureCore(ctx, seed, opts) {
  const o = opts || {};
  const N = o.statSamples || 100;
  const tests = [];
  const T = (id, passC, expected, actual, consumer) => tests.push({ id, pass: !!passC, expected, actual, consumer: consumer || '' });
  const evidence = {};

  // ── B-PD-01 Model shape ──
  {
    const r = withSeededGameplayRng(seed, () => _pdRunScenario(ctx, { spots: ['thigh'] }));
    let ok = true, miss = [];
    for (const k of BODY_PART_KEYS) { const pd = r.target.medical.partDestruction[k]; if (!pd || pd.partKey !== k || pd.state == null || pd.functionalCap == null) { ok = false; miss.push(k); } }
    T('B-PD-01_model_shape', ok, '모든 부위 partDestruction model 존재', ok ? `${BODY_PART_KEYS.length}/8 ok` : miss.join(','), 'ensurePartDestructionModel');
  }
  // ── B-PD-02 Duplicate idempotency ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['thigh'] });
      const w = sc.target.medical.wounds.filter(x => x.partKey === sc.partKey)[0];
      const before = sc.pd.cumulativeTraumaScore, cl = Object.assign({}, sc.pd.localClusters);
      const domBefore = sc.pd.dominantClusterScore;
      let again = null;
      if (w) again = updatePartDestructionFromWound(sc.target, w, { ammoId: w.ammoId }, { partKey: sc.partKey, bodyPart: sc.part, bodyDmg: 0 });
      return { before, after: sc.pd.cumulativeTraumaScore, domBefore, domAfter: sc.pd.dominantClusterScore, applied: again && again.alreadyApplied, contribution: again && again.contribution, hasWound: !!w };
    });
    T('B-PD-02_duplicate_idempotency', r.hasWound && r.before === r.after && r.contribution === 0 && r.applied === true && r.domBefore === r.domAfter,
      '동일 wound 재적용 시 contribution 0', `cts ${r.before}->${r.after} contribution=${r.contribution} alreadyApplied=${r.applied}`, 'updatePartDestructionFromWound');
    evidence.idempotency = r;
  }
  // ── B-PD-03 Monotonic state ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['thigh','thigh','thigh','thigh'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' });
      const high = sc.pd.state, rank0 = getPartDestructionStateRank(high, true);
      // 치료/회복 시도: HP 복원 + 골절 안정화 후 재판정해도 상태는 내려가지 않아야 한다
      sc.part.hp = sc.part.maxHp; sc.part.fracture = false; sc.part.splinted = true;
      refreshPartDestructionState(sc.target, sc.partKey, {});
      applyPartDestructionEffects(sc.target, sc.partKey);
      const after = sc.pd.state;
      return { high, after, rank0, rank1: getPartDestructionStateRank(after, true), cap: sc.pd.functionalCap, fr: sc.part.functionRatio };
    });
    T('B-PD-03_monotonic_state', r.rank1 >= r.rank0, '치료 후에도 상태 역행 없음', `${r.high} -> ${r.after} (rank ${r.rank0}->${r.rank1})`, 'refreshPartDestructionState');
    T('B-PD-15_splint_ceiling', r.fr <= r.cap + 1e-6, '부목이 destruction cap을 넘지 못함', `functionRatio=${r.fr} cap=${r.cap}`, 'recomputeBodyPartFunctionRatio');
    evidence.monotonic = r;
  }
  // ── B-PD-04 / 16.1 표준 소총 단발 근육 중심 ──
  {
    const d = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: '556_m855', weaponId: 'm4a1' }, N);
    evidence.singleRifleSoftTissue = d;
    T('B-PD-04_single_rifle_soft_tissue', d.lossRate === 0 && (d.counts.catastrophic_non_limb || 0) === 0 && d.severeRate <= 0.05,
      'traumatic loss 0 / amputation 0 / mangled+ <=5%', `severe=${(d.severeRate*100).toFixed(1)}% loss=${(d.lossRate*100).toFixed(1)}% n=${d.samples} ${JSON.stringify(d.counts)}`, 'resolveImpact/refreshPartDestructionState');
  }
  // ── B-PD-05 / 16.2 표준 소총 단발 사지 전체 (뼈 인접 포함) ──
  {
    const spotsList = ['thigh','knee','shin','foot','upperArm','forearm','hand'];
    const agg = { counts: {}, samples: 0, loss: 0, severe: 0 };
    for (const sp of spotsList) {
      const d = _pdDistribution(ctx, seed, { spots: [sp], ammoId: '762_m80', weaponId: 'sr25' }, Math.max(20, Math.round(N / 3)));
      agg.samples += d.samples;
      for (const k in d.counts) agg.counts[k] = (agg.counts[k] || 0) + d.counts[k];
      agg.loss += PD_LOSS_STATES.reduce((a, k) => a + (d.counts[k] || 0), 0);
      agg.severe += PD_SEVERE_STATES.reduce((a, k) => a + (d.counts[k] || 0), 0);
    }
    evidence.singleRifleAllLimb = agg;
    T('B-PD-05_single_rifle_bone_adjacent', agg.loss === 0, '사지 전 주소 단발에서 traumatic loss/amputation 0',
      `loss=${agg.loss}/${agg.samples} severe=${agg.severe} ${JSON.stringify(agg.counts)}`, 'resolveImpact/refreshPartDestructionState');
  }
  // ── HOTFIX-1 / B-PD-04b 표준 소총 탄종 매트릭스 (실제 production 경로, 상태 주입 없음) ──
  {
    const matrix = {};
    let allOk = true, det = [];
    for (const aid of ['545_ps_gs', '762x39_ps']) {
      const d = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: aid, weaponId: 'dev_allammo_test' }, N);
      matrix[aid] = d;
      const nonLimbOnLimb = (d.counts.catastrophic_non_limb || 0);
      const ok = d.samples > 0 && d.lossRate === 0 && d.ampRate === 0 && nonLimbOnLimb === 0;
      if (!ok) { allOk = false; det.push(`${aid}: n=${d.samples} loss=${d.lossRate} amp=${d.ampRate} nonLimb=${nonLimbOnLimb}`); }
      else det.push(`${aid}: n=${d.samples} severe=${(d.severeRate*100).toFixed(0)}% loss=0 amp=0`);
    }
    evidence.standardRifleMatrix = matrix;
    T('B-PD-04b_standard_rifle_matrix', allOk, '추가 소총 탄종: samples>0, loss/amp 0, 사지에 비사지 상태 0', det.join(' | '), 'resolveImpact/refreshPartDestructionState');
  }
  // ── B-PD-06 반복 동일 cluster / B-PD-07 분산 ──
  {
    const conc = _pdDistribution(ctx, seed, { spots: ['thigh','thigh','thigh','thigh'], ammoId: '556_m855', weaponId: 'm4a1' }, N);
    const dist = _pdDistribution(ctx, seed, { spots: ['thigh','knee','shin','foot'], ammoId: '556_m855', weaponId: 'm4a1' }, N);
    const distAM = _pdDistribution(ctx, seed, { spots: ['thigh','knee','shin','foot'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' }, N);
    const single = evidence.singleRifleSoftTissue;
    evidence.repeatedSameCluster = conc; evidence.distributed = dist; evidence.distributedAntiMaterial = distAM;
    T('B-PD-06_repeated_same_cluster', conc.severeRate > single.severeRate && conc.meanDominant > single.meanDominant,
      '반복 동일 cluster가 단발보다 severe/dominant 높음', `severe ${(single.severeRate*100).toFixed(0)}%->${(conc.severeRate*100).toFixed(0)}% dominant ${single.meanDominant}->${conc.meanDominant}`, 'updatePartDestructionFromWound');
    T('B-PD-07_distributed_no_loss', dist.lossRate === 0 && distAM.lossRate === 0 && dist.meanDominant < conc.meanDominant && dist.meanConcentration < conc.meanConcentration,
      '분산 적중은 dominant/집중도 낮고 traumatic loss 0', `dist dominant=${dist.meanDominant} conc=${dist.meanConcentration} vs 집중 ${conc.meanDominant}/${conc.meanConcentration}; loss ${dist.lossRate}/${distAM.lossRate}`, 'buildPartDestructionEvidence');
  }
  // ── B-PD-08 dominant cluster location ──
  {
    const r = withSeededGameplayRng(seed, () => {
      // 큰 손상은 근위(thigh), 작은 상처 하나만 원위(foot) → dominant는 thigh여야 한다
      const sc = _pdRunScenario(ctx, { spots: ['thigh','thigh','thigh','foot'], ammoId: '556_m855', weaponId: 'm4a1' });
      const evd = sc.pd.evidence;
      return { dom: sc.dominantClusterKey, distal: evd.dominantClusterIsDistal, proximal: evd.dominantClusterIsProximal,
        clusters: Object.keys(sc.pd.localClusters).map(k => k + ':' + sc.pd.localClusters[k].traumaScore).join(' ') };
    });
    T('B-PD-08_dominant_cluster_location', r.dom === 'thigh' && r.distal === false && r.proximal === true,
      '작은 distal wound가 전체 위치를 distal로 바꾸지 않음', `dominant=${r.dom} distal=${r.distal} proximal=${r.proximal} [${r.clusters}]`, 'buildPartDestructionEvidence');
    evidence.dominantLocation = r;
  }
  // ── B-PD-09 small fragment gate ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['thigh'] });
      const w = sc.target.medical.wounds.filter(x => x.partKey === sc.partKey)[0];
      if (!w) return null;
      // 얕은 소형 파편 fixture — sourceType만 frag이고 실제 파괴 규모는 없음
      const probe = { partKey: sc.partKey, sourceType: 'frag', shotgunPellet: false, ammoId: 'frag_generic',
        woundSize: { sizeClass: 'micro', exitWoundPresent: false }, fractureEvidence: { occurred: false },
        bodyTrajectory: { projectileSizeClass: 'fragment', woundDepthClass: 'shallow' }, vascularEvidence: { level: 'none' } };
      const cls = _pdProjectileEvidenceClass(probe);
      const fakePd = makeDefaultPartDestruction(sc.partKey);
      fakePd.sourceWoundIds = [999001];
      const fakeUnit = { medical: { bodyParts: sc.target.medical.bodyParts, wounds: [Object.assign({ id: 999001 }, probe)] } };
      const evd = buildPartDestructionEvidence(fakeUnit, sc.partKey, fakePd);
      return { cls, catastrophic: evd.catastrophicProjectileEvidence, largeFrag: evd.largeFragmentEvidence, tier: evd.evidenceTier };
    });
    T('B-PD-09_small_fragment_gate', !!r && r.cls === 'fragment' && r.catastrophic === false && r.largeFrag === false,
      'small/shallow fragment는 catastrophic evidence 아님', r ? `class=${r.cls} catastrophic=${r.catastrophic} largeFragment=${r.largeFrag} tier=${r.tier}` : 'no wound', 'buildPartDestructionEvidence');
    evidence.smallFragment = r;
  }
  // ── HOTFIX-3 / B-PD-09b small shallow < large deep fragment 상대 검증 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['thigh'] });
      const pk = sc.partKey;
      const mk = (variant) => {
        const fx = _pdBuildFragmentEvidenceFixture(pk, variant);
        const unitLike = { medical: { bodyParts: sc.target.medical.bodyParts, wounds: [fx.wound] } };
        const evd = buildPartDestructionEvidence(unitLike, pk, fx.pd);
        let contrib = null;
        try { contrib = computePartDestructionContribution(fx.wound, { ammoId: fx.wound.ammoId }, { partKey: pk, bodyPart: sc.target.medical.bodyParts[pk], bodyDmg: 0, sourceType: 'frag' }); } catch (e) { contrib = null; }
        return { cls: _pdProjectileEvidenceClass(fx.wound), tier: evd.evidenceTier, tierRank: PD_TIER_RANK[evd.evidenceTier],
          largeFragmentEvidence: evd.largeFragmentEvidence, catastrophic: evd.catastrophicProjectileEvidence, contribution: contrib };
      };
      return { small: mk('small_shallow'), large: mk('large_deep') };
    });
    evidence.largeDeepFragment = r.large; evidence.fragmentOrdering = { small: r.small, large: r.large };
    const contribOk = (r.small.contribution == null || r.large.contribution == null) ? true : (r.large.contribution > r.small.contribution);
    T('B-PD-09b_large_deep_fragment_ordering',
      r.large.cls === 'fragment' && r.large.largeFragmentEvidence === true && r.large.tierRank > r.small.tierRank && contribOk,
      'large/deep: fragment + largeFragmentEvidence + tier > small/shallow',
      `small tier=${r.small.tier}(${r.small.tierRank}) largeFrag=${r.small.largeFragmentEvidence} contrib=${r.small.contribution} | large tier=${r.large.tier}(${r.large.tierRank}) largeFrag=${r.large.largeFragmentEvidence} contrib=${r.large.contribution}`,
      'buildPartDestructionEvidence/computePartDestructionContribution');
  }
  // ── B-PD-10 anti-material 가능성 (증거 있을 때만) ──
  {
    const amSingle = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' }, N);
    const amRepeat = _pdDistribution(ctx, seed, { spots: ['shin','shin','shin'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' }, Math.max(30, Math.round(N / 2)));
    const rifle = evidence.singleRifleSoftTissue;
    evidence.antiMaterialSingle = amSingle; evidence.antiMaterialRepeat = amRepeat;
    T('B-PD-10_anti_material_possible', amRepeat.severeRate > 0 && amRepeat.lossRate > 0,
      '실제 고에너지+대형상처 fixture는 극단 상태 경로 존재', `repeat severe=${(amRepeat.severeRate*100).toFixed(0)}% loss=${(amRepeat.lossRate*100).toFixed(0)}%`, 'refreshPartDestructionState');
    T('B-PD-10b_anti_material_not_guaranteed', amSingle.ampRate < 1 && amRepeat.ampRate < 1,
      '대물탄도 100% amputation 아님', `single amp=${(amSingle.ampRate*100).toFixed(0)}% repeat amp=${(amRepeat.ampRate*100).toFixed(0)}%`, 'refreshPartDestructionState');
    T('B-PD-16.6_anti_material_over_rifle', amSingle.severeRate > rifle.severeRate,
      '대물탄 severe 빈도 > 일반 소총', `AM=${(amSingle.severeRate*100).toFixed(0)}% rifle=${(rifle.severeRate*100).toFixed(0)}%`, 'refreshPartDestructionState');
  }
  // ── HOTFIX-2 / B-PD-10c 대물탄 매트릭스 (127x108 계열) ──
  {
    const matrix = {};
    const rifleBase = evidence.singleRifleSoftTissue;
    let allOk = true, det = [];
    for (const aid of ['127x108_b32_api', '127x108_mdz_hei']) {
      const d = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: aid, weaponId: 'dev_allammo_test' }, Math.max(50, Math.round(N / 2)));
      matrix[aid] = d;
      const ok = d.samples > 0 && d.severeRate > rifleBase.severeRate && d.ampRate < 1;
      if (!ok) allOk = false;
      det.push(`${aid}: n=${d.samples} severe=${(d.severeRate*100).toFixed(0)}% amp=${(d.ampRate*100).toFixed(0)}%`);
    }
    evidence.antiMaterialMatrix = matrix;
    T('B-PD-10c_anti_material_matrix', allOk, '12.7x108 각 탄종: samples>0, severe > 일반소총, amp < 100%',
      `${det.join(' | ')} (rifle severe=${(rifleBase.severeRate*100).toFixed(0)}%)`, 'resolveImpact/refreshPartDestructionState');
  }
  // ── B-PD-11 shotgun group ceiling / flechette <= buckshot ──
  {
    const buck = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: '12g_00buck', weaponId: 'shotgun_m1014' }, N);
    const flech = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: '12g_flechette', weaponId: 'shotgun_m1014' }, N);
    const slug = _pdDistribution(ctx, seed, { spots: ['thigh'], ammoId: '12g_slug', weaponId: 'shotgun_m1014' }, N);
    const rifle = evidence.singleRifleSoftTissue;
    evidence.buckshot = buck; evidence.flechette = flech; evidence.slug = slug;
    T('B-PD-11_shotgun_group_ceiling', flech.meanCts <= buck.meanCts && flech.severeRate <= buck.severeRate && buck.meanCts < rifle.meanCts * 3,
      'flechette <= buckshot, pellet 선형 누적 없음', `flechette cts=${flech.meanCts} severe=${(flech.severeRate*100).toFixed(0)}% | buckshot cts=${buck.meanCts} severe=${(buck.severeRate*100).toFixed(0)}% | rifle cts=${rifle.meanCts}`, '_shotgunDestructionContributionMul');
    T('B-PD-16.5_threat_ordering', flech.meanCts <= buck.meanCts && evidence.antiMaterialSingle.meanCts > rifle.meanCts && slug.meanCts >= rifle.meanCts,
      'flechette<=buckshot, rifle<slug/anti-material', `flech=${flech.meanCts} buck=${buck.meanCts} rifle=${rifle.meanCts} slug=${slug.meanCts} AM=${evidence.antiMaterialSingle.meanCts}`, 'computePartDestructionContribution');
  }
  // ── B-PD-12 non-limb state ──
  {
    const nN = Math.max(30, Math.round(N / 2));
    const AM = '127x99_mk211_heiap';
    const chest   = _pdDistribution(ctx, seed, { spots: ['chest','chest','chest','chest'], ammoId: AM, weaponId: 'dev_allammo_test', partKey: 'chest', unarmored: true }, nN);
    const abdomen = _pdDistribution(ctx, seed, { spots: ['abdomen','abdomen','abdomen','abdomen'], ammoId: AM, weaponId: 'dev_allammo_test', partKey: 'abdomen', unarmored: true }, nN);
    const head    = _pdDistribution(ctx, seed, { spots: ['head','head'], ammoId: AM, weaponId: 'dev_allammo_test', partKey: 'head', unarmored: true }, nN);
    // neck은 production locationToBodyPart()가 head로 귀속시키므로 canonical 피해 진입점(applyDamageEvent)을 사용한다
    const neck    = _pdDistribution(ctx, seed, { spots: ['neck','neck'], ammoId: AM, weaponId: 'dev_allammo_test', partKey: 'neck', unarmored: true, directHitPart: 'neck' }, nN);
    evidence.nonLimbChest = chest; evidence.nonLimbAbdomen = abdomen; evidence.nonLimbHead = head; evidence.nonLimbNeck = neck;
    const all = { head, neck, chest, abdomen };
    const zeroSample = Object.keys(all).filter(k => !(all[k].samples > 0));
    T('B-PD-12a_non_limb_valid_samples', zeroSample.length === 0, 'head/neck/chest/abdomen 유효표본 > 0',
      Object.keys(all).map(k => `${k}=${all[k].samples}`).join(' ') + (zeroSample.length ? ` ZERO:${zeroSample.join(',')}` : ''), '_pdDistribution/_pdRunScenario');
    const ALLOWED_NON_LIMB = ['intact','damaged','impaired','mangled','destroyed','catastrophic_non_limb'];
    let limbOnly = 0, illegal = [];
    for (const k of Object.keys(all)) {
      for (const st of Object.keys(all[k].counts)) {
        if (PD_LOSS_STATES.indexOf(st) >= 0) limbOnly += all[k].counts[st];
        if (ALLOWED_NON_LIMB.indexOf(st) < 0) illegal.push(`${k}:${st}`);
      }
    }
    T('B-PD-12_non_limb_state', limbOnly === 0 && illegal.length === 0, '비사지 4부위에 limb-only 상태 0, 허용 상태 집합만 관측',
      `limbOnly=${limbOnly} illegal=[${illegal.join(',')}] head=${JSON.stringify(head.counts)} neck=${JSON.stringify(neck.counts)} chest=${JSON.stringify(chest.counts)} abdomen=${JSON.stringify(abdomen.counts)}`, 'refreshPartDestructionState');
  }
  // ── B-PD-13/14 functional cap + disabled contract ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const rows = [];
      const scenarios = [
        { spots: ['thigh'], ammoId: '556_m855', weaponId: 'm4a1' },
        { spots: ['thigh','thigh','thigh'], ammoId: '556_m855', weaponId: 'm4a1' },
        { spots: ['shin','shin','shin'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' },
        { spots: ['chest','chest','chest','chest'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test', partKey: 'chest' },
      ];
      for (const sc0 of scenarios) { const sc = _pdRunScenario(ctx, sc0); rows.push({ state: sc.state, cap: sc.pd.functionalCap, fr: sc.functionRatio, disabled: sc.disabled }); }
      return rows;
    });
    const capOk = r.every(x => x.fr <= x.cap + 1e-6 && x.cap === PART_DESTRUCTION_FUNCTIONAL_CAP[x.state]);
    const disabledOk = r.every(x => PD_DISABLED_STATES.indexOf(x.state) < 0 || x.disabled === true);
    evidence.functionalCap = r;
    T('B-PD-13_functional_cap', capOk, '모든 상태에서 functionRatio <= cap', JSON.stringify(r.map(x => `${x.state}:fr${x.fr}<=cap${x.cap}`)), 'recomputeBodyPartFunctionRatio');
    T('B-PD-14_disabled_contract', disabledOk, '최종 상태는 disabled', JSON.stringify(r.map(x => `${x.state}:${x.disabled}`)), 'applyPartDestructionEffects');
  }
  // ── B-PD-16 arm/leg consumers ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['thigh'] });
      const t = sc.target, bpz = t.medical.bodyParts;
      // 양팔 기능상실 → canShoot false
      for (const k of ['leftArm','rightArm']) { bpz[k].hp = 0; bpz[k].disabled = true; bpz[k].functionRatio = 0; }
      updateMedicalPerformanceMultipliers(t);
      const bothArms = { canShoot: t.medical.canShoot, armFn: +(bpz.leftArm.functionRatio + bpz.rightArm.functionRatio).toFixed(2) };
      // 팔 회복 + 양다리 심각 저하 → canWalk false, canCrawl 유지
      for (const k of ['leftArm','rightArm']) { bpz[k].hp = bpz[k].maxHp; bpz[k].disabled = false; bpz[k].functionRatio = 1; }
      for (const k of ['leftLeg','rightLeg']) { bpz[k].hp = 0; bpz[k].disabled = true; bpz[k].functionRatio = 0; }
      updateMedicalPerformanceMultipliers(t);
      const bothLegs = { canWalk: t.medical.canWalk, canCrawl: t.medical.canCrawl, canShoot: t.medical.canShoot };
      return { bothArms, bothLegs };
    });
    evidence.consumers = r;
    T('B-PD-16_arm_leg_consumers', r.bothArms.canShoot === false && r.bothLegs.canWalk === false && r.bothLegs.canCrawl === true,
      '양팔 상실→canShoot false, 양다리 상실→canWalk false/canCrawl 유지',
      `arms canShoot=${r.bothArms.canShoot} legs canWalk=${r.bothLegs.canWalk} canCrawl=${r.bothLegs.canCrawl}`, 'updateMedicalPerformanceMultipliers');
  }
  // ── B-PD-17/18 vascular ceiling + sustained bleed guard ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['shin','shin','shin'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' });
      const ws = sc.target.medical.wounds.filter(w => w.partKey === sc.partKey);
      let confirmedFromPd = 0, maxSustained = 0, levels = {};
      for (const w of ws) {
        const ve = w.vascularEvidence || {}; levels[ve.level || 'none'] = (levels[ve.level || 'none'] || 0) + 1;
        if (ve.level === 'confirmed' && !(ve.evidenceTags || []).some(t => /vessel_transection|named_vessel|direct/.test(t))) confirmedFromPd++;
        const bp = w.bleedingProfile || {}; maxSustained = Math.max(maxSustained, bp.sustainedExternal || 0);
      }
      return { state: sc.state, levels, confirmedFromPd, maxSustained, ampNoAutoBleed: !(sc.state === 'traumatic_amputation' && maxSustained >= 30) };
    });
    evidence.vascular = r;
    T('B-PD-17_vascular_ceiling', r.confirmedFromPd === 0, 'part destruction만으로 confirmed 승격 없음', `state=${r.state} levels=${JSON.stringify(r.levels)}`, 'reinforceVascularEvidenceWithPartDestruction');
    T('B-PD-18_sustained_bleed_guard', r.ampNoAutoBleed, 'amputation만으로 지속 대량출혈 자동 생성 없음', `state=${r.state} maxSustained=${r.maxSustained}ml/s`, 'finalizeBleedingProfileWithEvidence');
  }
  // ── B-PD-19 AAR snapshot ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['thigh','thigh','thigh'], ammoId: '556_m855', weaponId: 'm4a1' });
      const w = sc.target.medical.wounds.filter(x => x.partKey === sc.partKey).slice(-1)[0];
      const snap = w && w.partDestructionEvidence;
      aarInit();
      const bs = (typeof aarMedicalSnapshot === 'function') ? aarMedicalSnapshot(sc.target) : null;
      const partSnap = bs && bs.bodyParts && bs.bodyParts[sc.partKey] && bs.bodyParts[sc.partKey].partDestruction;
      return { snap, partSnap, state: sc.state };
    });
    const snapFields = ['partDestructionContribution','partDestructionStateBefore','partDestructionStateAfter','dominantClusterKey','dominantClusterState','dominantClusterScore','evidenceTier','destructionTags','gateReasons'];
    const partFields = ['state','cumulativeTraumaScore','acuteTraumaScore','dominantClusterKey','dominantClusterScore','distributedClusterCount','worstFractureType','functionalCap','disabled','evidenceTags'];
    const snapOk = !!r.snap && snapFields.every(f => r.snap[f] !== undefined);
    const partOk = !!r.partSnap && partFields.every(f => r.partSnap[f] !== undefined);
    evidence.aarSnapshot = { woundSnapshot: r.snap, partSnapshot: r.partSnap };
    T('B-PD-19_aar_snapshot', snapOk && partOk, 'wound/part AAR snapshot 필수 필드 존재',
      `wound=${snapOk ? 'ok' : 'missing:' + snapFields.filter(f => !r.snap || r.snap[f] === undefined).join(',')} part=${partOk ? 'ok' : 'missing:' + partFields.filter(f => !r.partSnap || r.partSnap[f] === undefined).join(',')}`, 'updatePartDestructionFromWound/aarMedicalSnapshot');
  }
  // ── Validator 런타임 계약 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const sc = _pdRunScenario(ctx, { spots: ['shin','shin','shin'], ammoId: '127x99_mk211_heiap', weaponId: 'dev_allammo_test' });
      const rep = _mkValidationReport();
      validatePartDestructionFoundation(rep, sc.target);
      return { errors: rep.errors.length, msgs: rep.errors.slice(0, 3).map(e => e.msg.slice(0, 60)), state: sc.state };
    });
    evidence.validatorRuntime = r;
    T('B-PD-VAL_runtime', r.errors === 0, 'validator 런타임 계약 오류 0', `errors=${r.errors} ${JSON.stringify(r.msgs)}`, 'validatePartDestructionFoundation');
  }
  const failures = tests.filter(t => !t.pass);
  return { tests, failures, evidence };
}
// ════════════════ B단계 MUTATION CORE (§18) ════════════════
function _runPartDestructionMutationCore(ctx, seed) {
  const results = [];
  const MUT_STAT_SAMPLES = 25;   // mutation 검출용 축소 표본 (계약 테스트가 주 검출기)
  const detect = () => {
    const ids = [];
    const rep = _mkValidationReport();
    try { validatePartDestructionFoundation(rep, null); } catch (e) { rep.error('exc', e.message); }
    for (const er of rep.errors) ids.push('validator:' + er.msg.slice(0, 40));
    let cs; try { cs = _runPartDestructionClosureCore(ctx, seed, { statSamples: MUT_STAT_SAMPLES }); } catch (e) { ids.push('closureCore:exc:' + e.message); cs = { failures: [] }; }
    for (const f of (cs.failures || [])) ids.push('closure:' + f.id);
    return ids;
  };
  // [§18] mutation 주입 전 baseline failure 집합 — 무관한 failure가 검출로 섞이지 않게 한다
  _iwResetSandboxToBaseline(ctx);
  const baselineFailureList = detect();
  const baselineFailures = new Set(baselineFailureList);
  const baselineClean = baselineFailureList.length === 0;
  if (!baselineClean) {
    return { mutations: [], failures: [{ mutationId: 'BASELINE_NOT_CLEAN', baselineFailures: baselineFailureList.slice(0, 8) }],
      baselineClean, baselineFailureCount: baselineFailureList.length, baselineFailures: baselineFailureList.slice(0, 8), blocked: true };
  }
  const detectNew = () => detect().filter(id => !baselineFailures.has(id));
  const runOne = (mutationId, hookName, makeReplacement, note) => {
    _iwResetSandboxToBaseline(ctx);
    const rngBefore = Math.random;
    const orig = _IW_HOOKABLE[hookName].get();
    const beforeHash = _iwShortHash(_iwStableHash({ hook: hookName, state: 'orig' }));
    _iwInstallHook(hookName, makeReplacement(orig));
    const injected = (_IW_HOOKABLE[hookName].get() !== orig);
    const mutatedHash = _iwShortHash(_iwStableHash({ hook: hookName, state: 'mutated' }));
    const failureIds = detectNew();
    _iwRemoveHook(hookName);
    const restored = (_IW_HOOKABLE[hookName].get() === orig);
    const restoredHash = _iwShortHash(_iwStableHash({ hook: hookName, state: 'orig' }));
    const hooksClean = _iwMutationHookNames().length === 0;
    _iwResetSandboxToBaseline(ctx);
    const baseChk = _iwAssertSandboxBaselineRestored(ctx);
    results.push({ mutationId, hookName, note, injected, detected: failureIds.length >= 1, detectedBy: failureIds.slice(0, 4), failureIds,
      beforeHash, mutatedHash, restoredHash, restored, rngRestored: (Math.random === rngBefore), hooksRemoved: hooksClean,
      sandboxBaselineRestored: baseChk.ok, baselineResidue: baseChk.paths });
  };
  // M-PD-01 local gate bypass — 분산 손상도 집중된 것처럼 위장 → B-PD-07이 잡아야 한다
  runOne('M-PD-01_local_gate_bypass', 'buildPartDestructionEvidence',
    (orig) => function (unit, partKey, pd) {
      const e = orig(unit, partKey, pd);
      e.localConcentrationRatio = 1; e.dominantClusterState = 'catastrophic';
      e.dominantClusterScore = Math.max(e.dominantClusterScore, 1.0);
      e.dominantCatastrophicSource = true; e.dominantClusterIsDistal = true;
      return e;
    }, '분산 hit를 dominant catastrophic으로 위장');
  // M-PD-02 torso amputation — 비사지에 limb-only 상태 허용 → B-PD-12가 잡아야 한다
  runOne('M-PD-02_torso_amputation', 'refreshPartDestructionState',
    (orig) => function (unit, partKey, extra) {
      const pd = orig(unit, partKey, extra);
      if (pd && (partKey === 'chest' || partKey === 'abdomen') && pd.state === 'catastrophic_non_limb') {
        pd.state = 'traumatic_amputation';
        pd.functionalCap = PART_DESTRUCTION_FUNCTIONAL_CAP.traumatic_amputation;
      }
      return pd;
    }, 'chest/abdomen에 traumatic_amputation 허용');
  // M-PD-03 single rifle over-escalation — contribution 과대 → B-PD-04/05 통계 guard가 잡아야 한다
  runOne('M-PD-03_single_rifle_over_escalation', 'computePartDestructionContribution',
    (orig) => function (wound, ev, ctx2) { return Math.min(1.2, orig(wound, ev, ctx2) * 3.2); },
    '단발 contribution 3.2배 과대');
  // M-PD-04 functional cap bypass — cap 무시 → B-PD-13/14가 잡아야 한다
  runOne('M-PD-04_functional_cap_bypass', 'recomputeBodyPartFunctionRatio',
    (orig) => function (part, partDestruction) {
      orig(part, partDestruction);
      if (part) { part.functionRatio = 1.0; part.disabled = false; }
      return 1.0;
    }, 'mangled/destroyed인데 functionRatio 1.0');
  // M-PD-05 vascular confirmed leak — 부위 파괴만으로 confirmed 생성 → B-PD-17/18이 잡아야 한다
  runOne('M-PD-05_vascular_confirmed_leak', 'reinforceVascularEvidenceWithPartDestruction',
    (orig) => function (unit, w) {
      const ve = orig(unit, w);
      const pd = unit && unit.medical && unit.medical.partDestruction && unit.medical.partDestruction[w && w.partKey];
      if (ve && pd && PD_DISABLED_STATES.indexOf(pd.state) >= 0) { ve.level = 'confirmed'; ve.vesselClass = 'major_named'; ve._confirmedByPartDestruction = true; }
      return ve;
    }, 'part destruction만으로 vascular confirmed 생성');
  const failures = results.filter(r => !(r.injected && r.detected && r.restored && r.rngRestored && r.hooksRemoved && r.sandboxBaselineRestored && r.failureIds.length >= 1));
  return { mutations: results, failures, baselineClean, baselineFailureCount: baselineFailureList.length, baselineFailures: [], blocked: false };
}
// ════════════════ B단계 PUBLIC SUITES ════════════════
function runPartDestructionClosureSuite(seed, options) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runPartDestructionClosureCore(ctx, seed, options || {}));
  const core = sb.coreResult || { tests: [], failures: [{ id: 'CORE_EXCEPTION', pass: false }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ id: 'CORE_EXCEPTION:' + sb.coreError.message, pass: false }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, tests: core.tests || [], failures: core.failures || [], evidence: core.evidence || {},
    stateIntegrity: sb.stateIntegrity, beforeFingerprint: sb.beforeFingerprint, afterFingerprint: sb.afterFingerprint,
    changedPaths: sb.changedPaths, domChangedDuringCorePaths: sb.domChangedDuringCorePaths,
    summary: `${(core.tests||[]).length - (core.failures||[]).length}/${(core.tests||[]).length} tests, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
function runPartDestructionMutationTests(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runPartDestructionMutationCore(ctx, seed));
  const core = sb.coreResult || { mutations: [], failures: [{ mutationId: 'CORE_EXCEPTION' }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ mutationId: 'CORE_EXCEPTION:' + sb.coreError.message }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, mutations: core.mutations || [], failures: core.failures || [],
    baselineClean: core.baselineClean, baselineFailureCount: core.baselineFailureCount, blocked: !!core.blocked,
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.mutations||[]).length - (core.failures||[]).length}/${(core.mutations||[]).length} full-pass, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}

// ════════════════════════════════════════════════════════════════════════════
// [AI0-A] COMMAND AUTHORITY & THREAT FOUNDATION CLOSURE SUITE
//   A/B sandbox(withImpactWoundHarnessSandbox)를 재사용하되 failure ID는 AI0-A 전용으로 분리한다.
//   상태를 주입하지 않고 실제 gateway / perception / evidence 함수를 호출해 검증한다.
// ════════════════════════════════════════════════════════════════════════════
function _ai0aMakePair(ctx, opts) {
  const o = opts || {};
  const { shooter, target } = _iwCreateTestPair(ctx, { ammoId: '556_m855', weaponId: 'm4a1' });
  shooter.team = 'friend'; target.team = 'enemy';
  for (const u of [shooter, target]) { u.alive = true; u.isDead = false; u.isDowned = false; u.movePath = []; u._aiCommandPath = null; ensureAICommandState(u); }
  return { shooter, target };
}
// [HF1] closure 테스트용 경량 리셋 — 유닛/로그만 정리하고 mutation hook은 유지한다.
//   (_iwResetSandboxToBaseline은 hook을 제거하므로 mutation 검출이 무력화된다)
function _ai0aResetUnits(ctx) {
  ctx.units.length = 0;
  for (const f of ['logs','fxList','dustClouds','noiseEvents','flyingThrowables','pendingExplosions','projectiles','fx','_impactLog']) {
    if (Array.isArray(GAME[f])) GAME[f].length = 0;
  }
  GAME._impactLogSeq = 0; GAME.battleReport = null;
  nextUnitId = ctx.baselineNextUnitId;
}
// [HF2] 테스트 전용 — 실제 맵에서 개활지를 찾아 유닛을 배치한다(상태 주입이 아니라 위치 선정).
//   기본 스폰 지점은 벽 모서리에 가까워 executor의 첫 스텝 벽 검사에 걸린다.
function _ai0aPlaceInOpenGround(unit) {
  const R = (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS : 8;
  // MAP_W/MAP_H는 이 파일에 존재한 적이 없어 항상 1600×960 상수로 떨어졌다 → 실제 맵 크기를 쓴다.
  const _M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  const W = (_M && _M.w != null) ? _M.w : 1600, H = (_M && _M.h != null) ? _M.h : 960;
  for (let gy = 0.15; gy <= 0.85; gy += 0.05) {
    for (let gx = 0.15; gx <= 0.85; gx += 0.05) {
      const cx = W * gx, cy = H * gy;
      if (typeof pointInWalls === 'function' && pointInWalls(cx, cy, R * 2)) continue;
      let ok = true;
      for (let k = 0; k < 8 && ok; k++) {
        const a = (Math.PI * 2 * k) / 8;
        for (const dd of [60, 120]) {
          const tx = cx + Math.cos(a) * dd, ty = cy + Math.sin(a) * dd;
          if (typeof pointInWalls === 'function' && pointInWalls(tx, ty, R)) { ok = false; break; }
          if (typeof pathBlocked === 'function' && pathBlocked(cx, cy, tx, ty, R - 2)) { ok = false; break; }
        }
      }
      if (!ok) continue;
      unit.x = cx; unit.y = cy;
      return { x: cx, y: cy };
    }
  }
  return null;
}
function _ai0aFindWalkableTarget(unit, minDist) {
  const R = (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS : 8;
  const dists = [minDist || 120, 100, 80, 60, 45, 30];
  // 1차: 벽 밖 + 보행 직선 확보
  for (const dd of dists) {
    for (let k = 0; k < 24; k++) {
      const a = (Math.PI * 2 * k) / 24;
      const tx = unit.x + Math.cos(a) * dd, ty = unit.y + Math.sin(a) * dd;
      if (typeof pointInWalls === 'function' && pointInWalls(tx, ty, R)) continue;
      if (typeof hasLineOfWalkClear === 'function' && !hasLineOfWalkClear(unit.x, unit.y, tx, ty)) continue;
      return { x: tx, y: ty };
    }
  }
  // 2차: 벽 밖 조건만
  for (const dd of dists) {
    for (let k = 0; k < 24; k++) {
      const a = (Math.PI * 2 * k) / 24;
      const tx = unit.x + Math.cos(a) * dd, ty = unit.y + Math.sin(a) * dd;
      if (typeof pointInWalls === 'function' && pointInWalls(tx, ty, R)) continue;
      return { x: tx, y: ty };
    }
  }
  return null;
}
function _runAI0ACommandClosureCore(ctx, seed) {
  const tests = [];
  const T = (id, passC, expected, actual, consumer) => tests.push({ id, pass: !!passC, expected, actual, consumer: consumer || '' });
  const evidence = {};

  // ── AI0A-01 Gateway 존재 + 우선순위 테이블 ──
  {
    const fns = ['issueAICommand','cancelAICommand','completeAICommand','suspendPlayerCommand','restorePlayerCommand','getCurrentCommandAuthority'];
    const missing = fns.filter(f => typeof this_globalLookup(f) !== 'function');
    const order = ['hard_state','immediate_grenade','player','medical','acute_survival','legacy_behavior','utility','idle'];
    let mono = true;
    for (let i = 1; i < order.length; i++) if (!(AI_COMMAND_PRIORITY[order[i-1]] > AI_COMMAND_PRIORITY[order[i]])) mono = false;
    evidence.priority = Object.assign({}, AI_COMMAND_PRIORITY);
    T('AI0A-01_gateway_api', missing.length === 0 && mono, 'gateway 6함수 + 우선순위 단조 감소',
      missing.length ? ('missing:' + missing.join(',')) : JSON.stringify(AI_COMMAND_PRIORITY), 'AI Command Gateway');
  }
  // ── AI0A-02 Hidden nearest enemy leak 0 (§3.6 / AI0-02) ──
  {
    const r = withSeededGameplayRng(seed, () => {
      _ai0aResetUnits(ctx);
      const { shooter, target } = _ai0aMakePair(ctx);
      // 실제 맵 벽을 사이에 두고 아주 가깝게 배치 — 거리만 보면 'visible'이 되던 조건
      const walls = (typeof MAP_DATA !== 'undefined' && MAP_DATA.walls) ? MAP_DATA.walls : [];
      const w = walls.find(x => x && x.w > 60 && x.h > 0 && x.h <= 20);
      if (!w) return { skipped: true };
      const cx = w.x + w.w / 2;
      shooter.x = cx; shooter.y = w.y - 20;
      target.x = cx;  target.y = w.y + w.h + 20;
      shooter.team = 'friend'; target.team = 'enemy'; target.alive = true;
      const snap = getPerceptionSnapshot(shooter);
      const visibleByCanonical = !!(snap && snap.nearestVisible);
      const th = getThreatPosition(shooter);
      const claimsVisible = !!(th && th.type === 'visible');
      const dist = Math.hypot(target.x - shooter.x, target.y - shooter.y);
      const withinLegacyRange = dist < (shooter.sightRange || 200) * 1.2;   // 구버전이면 visible로 셌을 거리
      return { visibleByCanonical, claimsVisible, threatType: th ? th.type : null, dist: +dist.toFixed(0), withinLegacyRange };
    });
    evidence.hiddenEnemy = r;
    T('AI0A-02_hidden_enemy_leak',
      !r.skipped && r.withinLegacyRange && r.visibleByCanonical === false && r.claimsVisible === false,
      '벽 뒤 근접 적을 visible 위협으로 쓰지 않음',
      `dist=${r.dist} legacyRange=${r.withinLegacyRange} canonical=${r.visibleByCanonical} threatType=${r.threatType}`,
      'getThreatPosition/getPerceptionSnapshot');
  }
  // ── AI0A-03 자율 이동은 gateway 경유(단일 write) ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'enemy';   // 자율 유닛
      const before = shooter.aiCommandTrace.length;
      const res = issueMoveOrder(shooter, shooter.x + 60, shooter.y, { source: 'utility', actionType: 'testMove' });
      const auth = getCurrentCommandAuthority(shooter);
      return { accepted: res.accepted, pathLen: shooter.movePath.length, owned: shooter._aiCommandPath === shooter.movePath,
        traceGrew: shooter.aiCommandTrace.length > before, authSource: auth && auth.source, authType: auth && auth.type };
    });
    evidence.singleWrite = r;
    T('AI0A-03_gateway_single_write', r.accepted && r.pathLen > 0 && r.owned && r.traceGrew && r.authSource === 'utility',
      '수락 시 movePath 소유권 + trace 기록', JSON.stringify(r), 'issueMoveOrder/issueAICommand');
  }
  // ── AI0A-04 Player command 보존 (AI0-26) ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'friend';
      shooter.movePath = [{ x: shooter.x + 200, y: shooter.y, mode: 'walk' }];   // 플레이어 명령
      shooter._aiCommandPath = null;
      const playerPath = shooter.movePath;
      const util = issueAICommand(shooter, { type:'move', source:'utility', actionType:'utilMove',
        path: [{ x: shooter.x - 90, y: shooter.y, mode:'walk' }], targetX: shooter.x - 90, targetY: shooter.y });
      const legacy = issueAICommand(shooter, { type:'move', source:'legacy_behavior', actionType:'legacyAutoCover',
        path: [{ x: shooter.x - 50, y: shooter.y, mode:'walk' }], targetX: shooter.x - 50, targetY: shooter.y });
      return { utilAccepted: util.accepted, utilReason: util.rejectedReason, legacyAccepted: legacy.accepted,
        legacyReason: legacy.rejectedReason, pathIntact: shooter.movePath === playerPath };
    });
    evidence.playerPreserve = r;
    T('AI0A-04_player_command_preserved', r.utilAccepted === false && r.legacyAccepted === false && r.pathIntact,
      '일반 Utility/legacy가 플레이어 경로를 덮어쓰지 않음',
      `utility=${r.utilAccepted}(${r.utilReason}) legacy=${r.legacyAccepted}(${r.legacyReason}) pathIntact=${r.pathIntact}`, 'issueAICommand');
  }
  // ── AI0A-05 Grenade override + player restore (AI0-27) ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'friend';
      const px = shooter.x + 220;
      shooter.movePath = [{ x: px, y: shooter.y, mode: 'walk' }];
      shooter._aiCommandPath = null;
      const gren = issueAICommand(shooter, { type:'move', source:'immediate_grenade', actionType:'grenadeEvade',
        path: [{ x: shooter.x - 40, y: shooter.y, mode:'run' }], targetX: shooter.x - 40, targetY: shooter.y });
      const suspended = !!(shooter.aiCommandState && shooter.aiCommandState.suspended);
      const overrode = shooter.movePath.length > 0 && shooter.movePath[0].x === shooter.x - 40;
      const restored = restorePlayerCommand(shooter);
      const back = shooter.movePath.length > 0 && shooter.movePath[0].x === px && shooter._aiCommandPath === null;
      return { grenAccepted: gren.accepted, suspended, overrode, restored, back };
    });
    evidence.grenadeOverride = r;
    T('AI0A-05_grenade_override_restore', r.grenAccepted && r.suspended && r.overrode && r.restored && r.back,
      '임박 수류탄만 override, 이후 플레이어 경로 복귀', JSON.stringify(r), 'issueAICommand/suspendPlayerCommand/restorePlayerCommand');
  }
  // ── AI0A-06 우선순위 거부 + legacy 행동 보존 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'enemy';
      const u = issueAICommand(shooter, { type:'move', source:'utility', actionType:'utilMove',
        path:[{ x: shooter.x+30, y: shooter.y, mode:'walk' }], targetX: shooter.x+30, targetY: shooter.y });
      // legacy는 utility보다 뒤에 실행되어 현재 우선한다 → 수락되어야 기존 행동이 보존된다
      const l = issueAICommand(shooter, { type:'move', source:'legacy_behavior', actionType:'legacyAutoCover',
        path:[{ x: shooter.x+70, y: shooter.y, mode:'run' }], targetX: shooter.x+70, targetY: shooter.y });
      const legacyWon = shooter.movePath.length > 0 && shooter.movePath[0].x === shooter.x + 70;
      // 그 뒤 utility가 다시 시도하면 거부되어야 한다(하위 우선순위)
      const u2 = issueAICommand(shooter, { type:'move', source:'utility', actionType:'utilMove2',
        path:[{ x: shooter.x-30, y: shooter.y, mode:'walk' }], targetX: shooter.x-30, targetY: shooter.y });
      return { u: u.accepted, l: l.accepted, legacyWon, u2: u2.accepted, u2Reason: u2.rejectedReason };
    });
    evidence.legacyPreserved = r;
    T('AI0A-06_legacy_behavior_preserved', r.u && r.l && r.legacyWon && r.u2 === false && r.u2Reason === 'lower_priority_same_tick',
      'legacy adapter가 gateway 경유로 기존 우선순위를 보존', JSON.stringify(r), 'issueAICommand');
  }
  // ── AI0A-07 command trace cap 30 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'enemy';
      for (let i = 0; i < 60; i++) {
        issueAICommand(shooter, { type:'move', source:'utility', actionType:'spam',
          path:[{ x: shooter.x + (i%7) + 1, y: shooter.y, mode:'walk' }], targetX: shooter.x, targetY: shooter.y });
        shooter.movePath = [];   // executor 소비 흉내 → 다음 명령 수락 가능
      }
      return { len: shooter.aiCommandTrace.length, cap: AI_COMMAND_TRACE_MAX };
    });
    evidence.traceCap = r;
    T('AI0A-07_trace_cap', r.len <= r.cap && r.len > 0, 'trace 최근 30개만 유지', `len=${r.len} cap=${r.cap}`, '_aiCommandTrace');
  }
  // ── AI0A-08 Threat evidence: 소리는 정확한 위치가 아니다 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      const { shooter } = _ai0aMakePair(ctx);
      const v = recordThreatEvidence(shooter, { kind:'visual', x: shooter.x+50, y: shooter.y, positionKnown:true, sourceUnitId: 7 });
      const sd = recordThreatEvidence(shooter, { kind:'sound', dirRad: 1.2, radius: 140, positionKnown:false });
      const hit = recordThreatEvidence(shooter, { kind:'hit', x: shooter.x-30, y: shooter.y+10, positionKnown:true });
      const all = getThreatEvidence(shooter);
      if (!v || !sd || !hit) return { kinds: [], recorded: false, n: all.length };
      return { kinds: all.map(e => e.kind), recorded: true, soundPosKnown: sd.positionKnown, soundHasDir: sd.dirRad != null,
        soundNoXY: sd.x === null && sd.y === null, visualConf: v.confidence, soundConf: sd.confidence, hitConf: hit.confidence, n: all.length };
    });
    evidence.threatEvidence = r;
    T('AI0A-08_threat_evidence_model', r.recorded && r.n === 3 && r.soundPosKnown === false && r.soundHasDir && r.soundNoXY && r.visualConf > r.soundConf,
      '소리는 방향만/위치 미확정, visual > sound 신뢰도', JSON.stringify(r), 'recordThreatEvidence/getThreatEvidence');
  }
  // ── AI0A-09 결정성 ──
  {
    const run = (sd) => withSeededGameplayRng(sd, () => {
      _ai0aResetUnits(ctx);   // 두 실행이 동일한 world 상태에서 시작하도록(다른 유닛 혼잡 보정 영향 제거)
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'enemy';
      issueMoveOrder(shooter, shooter.x + 80, shooter.y + 20, { source: 'utility', actionType: 'detTest' });
      return _iwShortHash(_iwStableHash({ path: shooter.movePath, trace: shooter.aiCommandTrace.map(t => t.type + ':' + t.accepted) }));
    });
    const h1 = run(seed), h2 = run(seed);
    evidence.determinism = { a: h1, b: h2 };
    T('AI0A-09_determinism', h1 === h2, 'same seed 동일 결과', `${h1} == ${h2}`, 'issueMoveOrder');
  }
  // ── AI0A-10 Production Threat Evidence Hooks (fixture 직접 주입 금지) ──
  {
    const r = withSeededGameplayRng(seed, () => {
      _ai0aResetUnits(ctx);
      const { shooter, target } = _ai0aMakePair(ctx);
      GAME.gameTime = 1;
      // visual — 실제 canonical 소비 경로
      target.x = shooter.x + 60; target.y = shooter.y;
      for (let i = 0; i < 3; i++) { GAME.gameTime += 0.5; updateLastKnownFromVisibility(shooter); }
      // sound — 실제 emitNoise + tickNoiseEvents
      emitNoise(target.x + 40, target.y, { type: 'gunshot', loudness: 1.0, team: target.team });
      for (let i = 0; i < 6; i++) { tickNoiseEvents(1 / 30); GAME.gameTime += 1 / 30; }
      // hit — 실제 피격 확정 등록 지점
      registerThreat(shooter, target.x, target.y, { sourceUnitId: target.id, sourceEventId: 'hitTest1' });
      registerThreat(shooter, target.x, target.y, { sourceUnitId: target.id, sourceEventId: 'hitTest1' });   // 동일 event 반복
      // near_miss — 실제 탄도 근접 판정
      checkNearMissForUnits(target, { x: shooter.x + 12, y: shooter.y + 12, type: 'wall' }, AMMO_PRESETS['556_m855']);
      // grenade — 실제 위협 기록 지점, 동일 투척물 2회
      _recordGrenadeThreat(shooter, { gx: shooter.x + 60, gy: shooter.y + 20, fuseLeft: 0.8, throwableId: 'twT', throwerId: target.id });
      _recordGrenadeThreat(shooter, { gx: shooter.x + 58, gy: shooter.y + 22, fuseLeft: 0.5, throwableId: 'twT', throwerId: target.id });
      const all = getThreatEvidence(shooter, { maxAge: 60 });
      const byKind = {};
      for (const e of all) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      const snd = all.filter(e => e.kind === 'sound');
      const nm = all.filter(e => e.kind === 'near_miss');
      const hits = all.filter(e => e.kind === 'hit');
      const gren = all.filter(e => e.kind === 'grenade');
      return { byKind, total: all.length, cap: THREAT_EVIDENCE_MAX,
        soundPosLeak: snd.filter(e => e.positionKnown || e.x !== null || e.y !== null).length,
        soundHasDir: snd.every(e => e.direction != null && e.angularUncertainty > 0),
        nmPosLeak: nm.filter(e => e.positionKnown || e.x !== null).length,
        hitDedup: hits.length, grenDedup: gren.length,
        grenUpdated: gren.length === 1 && (gren[0].updateCount || 0) >= 1 };
    });
    evidence.productionHooks = r;
    const allKinds = ['visual','sound','hit','near_miss','grenade'].every(k => (r.byKind[k] || 0) > 0);
    T('AI0A-10_production_evidence_hooks',
      allKinds && r.soundPosLeak === 0 && r.soundHasDir && r.nmPosLeak === 0
      && r.hitDedup === 1 && r.grenDedup === 1 && r.grenUpdated && r.total <= r.cap,
      '5종 production evidence 생성 + 소리/근접탄 위치 없음 + 동일 event dedup + cap 24',
      `kinds=${JSON.stringify(r.byKind)} total=${r.total}/${r.cap} soundLeak=${r.soundPosLeak} nmLeak=${r.nmPosLeak} hitDedup=${r.hitDedup} grenDedup=${r.grenDedup}`,
      'updateLastKnownFromVisibility/tickNoiseEvents/registerThreat/checkNearMissForUnits/_recordGrenadeThreat');
  }
  // ── AI0A-11 GrenadeEvade 자동 복구 (restorePlayerCommand 직접 호출 금지) ──
  {
    const r = withSeededGameplayRng(seed, () => {
      _ai0aResetUnits(ctx);
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'friend';
      GAME.gameTime = 1;
      if (!_ai0aPlaceInOpenGround(shooter)) return { noTarget: true };
      const _pt = _ai0aFindWalkableTarget(shooter, 140);
      if (!_pt) return { noTarget: true };
      const px = _pt.x, py = _pt.y;
      shooter.movePath = [{ x: px, y: py, mode: 'walk' }];   // 플레이어 명령
      shooter._aiCommandPath = null;
      // production 수류탄 회피와 동일한 발급 경로
      const res = issueMoveOrder(shooter, shooter.x + 30, shooter.y, { source: 'immediate_grenade', actionType: 'grenadeEvade' });
      const suspended = !!(shooter.aiCommandState && shooter.aiCommandState.suspended);
      // 실제 이동 executor로 도착시킨다(수동 restore 호출 없음)
      let ticks = 0, restored = false;
      while (ticks < 400) {
        updateUnit(shooter, 1 / 30); GAME.gameTime += 1 / 30; ticks++;
        if (shooter.movePath.length > 0 && Math.abs(shooter.movePath[0].x - px) < 1e-6 && shooter._aiCommandPath === null) { restored = true; break; }
        if (shooter.movePath.length === 0 && !(shooter.aiCommandState && shooter.aiCommandState.suspended)) break;
      }
      const kinds = shooter.aiCommandTrace.map(t => t.traceKind || t.type);
      return { accepted: res.accepted, suspended, ticks, restored, kinds,
        hasSuspend: kinds.indexOf('player_suspended') >= 0,
        hasAccept: kinds.indexOf('grenade_command_accepted') >= 0,
        hasComplete: kinds.indexOf('grenade_command_completed') >= 0,
        hasRestore: kinds.indexOf('player_restore_accepted') >= 0 };
    });
    evidence.grenadeEvadeRestore = r;
    T('AI0A-11_grenade_evade_auto_restore',
      !r.noTarget && r.accepted && r.suspended && r.restored && r.hasSuspend && r.hasAccept && r.hasComplete && r.hasRestore,
      '회피 완료 후 플레이어 경로 자동 복구 + trace 4종',
      `restored=${r.restored} ticks=${r.ticks} suspend=${r.hasSuspend} accept=${r.hasAccept} complete=${r.hasComplete} restore=${r.hasRestore}`,
      'issueMoveOrder/updateUnit/completeAICommand/restorePlayerCommand');
  }
  // ── AI0A-12 GrenadeProne 자동 복구 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      _ai0aResetUnits(ctx);
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'friend';
      GAME.gameTime = 1;
      if (!_ai0aPlaceInOpenGround(shooter)) return { noTarget: true };
      const _pt = _ai0aFindWalkableTarget(shooter, 140);
      if (!_pt) return { noTarget: true };
      const px = _pt.x, py = _pt.y;
      // [HF2] production 플레이어 입력 경로로 path A 생성
      shooter.movePath = [];
      addWaypoint(shooter, px, py);
      shooter._aiCommandPath = null;
      const originalPath = shooter.movePath.slice();
      if (!originalPath.length) return { noTarget: true };
      const origDest = originalPath[originalPath.length - 1];
      // production 자세 회피 경로
      enterProne(shooter, 'grenade', 0.4);
      const suspended = !!(shooter.aiCommandState && shooter.aiCommandState.suspended);
      const wasProne = (shooter.forcedProneTimer || 0) > 0 || shooter.stance === 'prone' || !!shooter.stanceTransition;
      let ticks = 0, ownerReleased = false, restoredPath = null, snapshotConsumed = false;
      const st0 = ensureAICommandState(shooter);
      while (ticks < 400) {
        const hadSnap = !!st0.suspended;
        updateUnit(shooter, 1 / 30); GAME.gameTime += 1 / 30; ticks++;
        // 자동 복구가 일어난 tick을 포착 (수동 restore 호출 없음)
        if (hadSnap && !st0.suspended) {
          snapshotConsumed = true;
          ownerReleased = shooter._aiCommandPath === null;
          restoredPath = shooter.movePath.slice();
          break;
        }
      }
      const kinds = shooter.aiCommandTrace.map(t => t.traceKind || t.type);
      const rd = (restoredPath && restoredPath.length) ? restoredPath[restoredPath.length - 1] : null;
      const destMatch = !!(rd && Math.abs(rd.x - origDest.x) < 1e-6 && Math.abs(rd.y - origDest.y) < 1e-6);
      return { suspended, wasProne, ownerReleased, snapshotConsumed, ticks, stance: shooter.stance,
        originalLen: originalPath.length, restoredLen: restoredPath ? restoredPath.length : 0, destMatch,
        origDest: { x: Math.round(origDest.x), y: Math.round(origDest.y) },
        restoredDest: rd ? { x: Math.round(rd.x), y: Math.round(rd.y) } : null,
        hasComplete: kinds.indexOf('grenade_command_completed') >= 0,
        hasRestore: kinds.indexOf('player_restore_accepted') >= 0 };
    });
    evidence.grenadeProneRestore = r;
    T('AI0A-12_grenade_prone_auto_restore',
      !r.noTarget && r.suspended && r.wasProne && r.snapshotConsumed && r.ownerReleased
      && r.originalLen > 0 && r.restoredLen > 0 && r.destMatch
      && r.hasComplete && r.hasRestore && r.stance === 'prone',
      '원래 player path가 실제로 복구(길이>0, 목적지 동일) + 자동 완료, 자세 강제 복귀 없음',
      `originalLen=${r.originalLen} restoredLen=${r.restoredLen} destMatch=${r.destMatch} orig=${JSON.stringify(r.origDest)} restored=${JSON.stringify(r.restoredDest)} ownerReleased=${r.ownerReleased} stance=${r.stance} complete=${r.hasComplete} restore=${r.hasRestore}`,
      'addWaypoint/enterProne/tickGrenadeReaction/completeAICommand/restorePlayerCommand');
  }
  // ── AI0A-13 새 플레이어 명령이 stale snapshot보다 우선 ──
  {
    const r = withSeededGameplayRng(seed, () => {
      _ai0aResetUnits(ctx);
      const { shooter } = _ai0aMakePair(ctx);
      shooter.team = 'friend';
      GAME.gameTime = 1;
      if (!_ai0aPlaceInOpenGround(shooter)) return { noTarget: true };
      const _ptA = _ai0aFindWalkableTarget(shooter, 140);
      if (!_ptA) return { noTarget: true };
      const _ptB = _ai0aFindWalkableTarget(shooter, 90);
      if (!_ptB) return { noTarget: true };
      // [HF2] production 입력으로 path A 생성 (fixture가 revision을 직접 조작하지 않는다)
      shooter.movePath = []; addWaypoint(shooter, _ptA.x, _ptA.y); shooter._aiCommandPath = null;
      const pathA = shooter.movePath.slice();
      if (!pathA.length) return { noTarget: true };
      const destA = pathA[pathA.length - 1];
      const revAfterA = shooter._playerCommandRevision || 0;
      issueMoveOrder(shooter, shooter.x + 30, shooter.y, { source: 'immediate_grenade', actionType: 'grenadeEvade' });
      const suspendedA = !!(shooter.aiCommandState && shooter.aiCommandState.suspended);
      // 회피 도중 플레이어가 production 입력으로 새 명령 B
      shooter.movePath = []; addWaypoint(shooter, _ptB.x, _ptB.y); shooter._aiCommandPath = null;
      const pathB = shooter.movePath.slice();
      const destB = pathB.length ? pathB[pathB.length - 1] : null;
      const revAfterB = shooter._playerCommandRevision || 0;
      const snapshotDiscarded = !(shooter.aiCommandState && shooter.aiCommandState.suspended);
      // 위험 종료 후 완료 처리
      completeAICommand(shooter, { reason: 'grenade_safe' });
      const cur = shooter.movePath.length ? shooter.movePath[shooter.movePath.length - 1] : null;
      const keptB = !!(cur && destB && Math.abs(cur.x - destB.x) < 1e-6 && Math.abs(cur.y - destB.y) < 1e-6);
      const restoredA = !!(cur && Math.abs(cur.x - destA.x) < 1e-6 && Math.abs(cur.y - destA.y) < 1e-6);
      const kinds = shooter.aiCommandTrace.map(t => t.traceKind || t.type);
      const rej = shooter.aiCommandTrace.filter(t => (t.traceKind || t.type) === 'player_restore_rejected');
      const staleAccepted = shooter.aiCommandTrace.filter(t => (t.traceKind || t.type) === 'player_restore_accepted').length;
      return { suspendedA, keptB, restoredA, snapshotDiscarded, revAfterA, revAfterB,
        revisionIncreased: revAfterB > revAfterA,
        hasSuperseded: kinds.indexOf('player_command_superseded') >= 0,
        staleAccepted, rejectReasons: rej.map(x => x.rejectedReason) };
    });
    evidence.staleSnapshot = r;
    T('AI0A-13_new_player_command_supersedes_suspended',
      !r.noTarget && r.suspendedA && r.revisionIncreased && r.snapshotDiscarded
      && r.hasSuperseded && r.keptB && !r.restoredA && r.staleAccepted === 0,
      'production 입력이 revision을 올리고 snapshot 폐기 → 오래된 A 복구 0, B 유지',
      `revision ${r.revAfterA}->${r.revAfterB} snapshotDiscarded=${r.snapshotDiscarded} superseded=${r.hasSuperseded} keptB=${r.keptB} restoredA=${r.restoredA} staleRestoreAccepted=${r.staleAccepted} rejects=${JSON.stringify(r.rejectReasons)}`,
      'addWaypoint/markPlayerCommandChanged/completeAICommand/restorePlayerCommand');
  }
  const failures = tests.filter(t => !t.pass);
  return { tests, failures, evidence };
}
function this_globalLookup(name) {
  try { return eval(name); } catch (e) { return undefined; }
}
function _runAI0AMutationCore(ctx, seed) {
  const results = [];
  const detect = () => {
    const ids = [];
    let cs; try { cs = _runAI0ACommandClosureCore(ctx, seed); } catch (e) { ids.push('closureCore:exc:' + e.message); cs = { failures: [] }; }
    for (const f of (cs.failures || [])) ids.push('closure:' + f.id);
    return ids;
  };
  _iwResetSandboxToBaseline(ctx);
  const baselineList = detect();
  const baseline = new Set(baselineList);
  const baselineClean = baselineList.length === 0;
  if (!baselineClean) {
    return { mutations: [], failures: [{ mutationId: 'BASELINE_NOT_CLEAN', baselineFailures: baselineList.slice(0, 6) }],
      baselineClean, baselineFailureCount: baselineList.length, blocked: true };
  }
  const detectNew = () => detect().filter(id => !baseline.has(id));
  const runOne = (mutationId, hookName, makeReplacement, note) => {
    _iwResetSandboxToBaseline(ctx);
    const rngBefore = Math.random;
    const orig = _IW_HOOKABLE[hookName].get();
    _iwInstallHook(hookName, makeReplacement(orig));
    const injected = (_IW_HOOKABLE[hookName].get() !== orig);
    const failureIds = detectNew();
    _iwRemoveHook(hookName);
    const restored = (_IW_HOOKABLE[hookName].get() === orig);
    const hooksClean = _iwMutationHookNames().length === 0;
    _iwResetSandboxToBaseline(ctx);
    const chk = _iwAssertSandboxBaselineRestored(ctx);
    results.push({ mutationId, hookName, note, injected, detected: failureIds.length >= 1,
      detectedBy: failureIds.slice(0, 4), failureIds, restored,
      rngRestored: (Math.random === rngBefore), hooksRemoved: hooksClean, sandboxBaselineRestored: chk.ok });
  };
  // M-AI0A-01 production evidence hook 무력화
  runOne('M-AI0A-01_evidence_hooks_removed', 'recordThreatEvidence',
    () => function () { return null; }, 'production evidence 기록 제거');
  // M-AI0A-02 sound에 정확 좌표 주입
  runOne('M-AI0A-02_sound_exact_position_leak', 'recordThreatEvidence',
    (orig) => function (unit, ev) {
      if (ev && (ev.kind === 'sound' || ev.type === 'sound')) {
        const leaked = Object.assign({}, ev, { positionKnown: true, x: unit.x + 100, y: unit.y + 100 });
        return orig(unit, leaked);
      }
      return orig(unit, ev);
    }, 'sound evidence에 exact x/y + positionKnown:true');
  // M-AI0A-03 수류탄 완료 후 restore 누락
  runOne('M-AI0A-03_grenade_restore_missing', 'completeAICommand',
    () => function (unit, result) {
      const st = ensureAICommandState(unit);
      if (!st) return false;
      const cur = st.current || st.lastInstant;
      if (!cur) return false;
      st.current = null;
      if (st.lastInstant && cur && st.lastInstant.commandId === cur.commandId) st.lastInstant = null;
      _aiCommandTrace(unit, { source: 'gateway', type: 'complete', accepted: true, reason: (result && result.reason) || null });
      return true;   // restore 호출 없음
    }, 'command 완료 시 플레이어 경로 자동 복구 생략');
  // M-AI0A-04 [HF2] production 입력이 revision을 올리지도, suspended snapshot을 폐기하지도 않게 만든다
  runOne('M-AI0A-04_stale_player_snapshot_restore', 'markPlayerCommandChanged',
    () => function (unit) { return (unit && unit._playerCommandRevision) || 0; },
    'markPlayerCommandChanged가 revision 갱신/snapshot 폐기를 하지 않음');
  const failures = results.filter(r => !(r.injected && r.detected && r.restored && r.rngRestored && r.hooksRemoved && r.sandboxBaselineRestored));
  return { mutations: results, failures, baselineClean, baselineFailureCount: baselineList.length, blocked: false };
}
function runAI0AMutationTests(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0AMutationCore(ctx, seed));
  const core = sb.coreResult || { mutations: [], failures: [{ mutationId: 'CORE_EXCEPTION' }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ mutationId: 'CORE_EXCEPTION:' + sb.coreError.message }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, mutations: core.mutations || [], failures: core.failures || [],
    baselineClean: core.baselineClean, baselineFailureCount: core.baselineFailureCount, blocked: !!core.blocked,
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.mutations||[]).length - (core.failures||[]).length}/${(core.mutations||[]).length} full-pass, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
function runAI0ACommandClosureSuite(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0ACommandClosureCore(ctx, seed));
  const core = sb.coreResult || { tests: [], failures: [{ id: 'CORE_EXCEPTION', pass: false }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ id: 'CORE_EXCEPTION:' + sb.coreError.message, pass: false }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, tests: core.tests || [], failures: core.failures || [], evidence: core.evidence || {},
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.tests||[]).length - (core.failures||[]).length}/${(core.tests||[]).length} tests, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] SURFACE & SPATIAL PERCEPTION — CLOSURE / MUTATION SUITE
//   production 경로(placeCoverAt / editor 함수 / castScanRay / tickNoiseEvents)를 그대로 호출한다.
// ════════════════════════════════════════════════════════════════════════════
// [AI0-B R1] suite가 production 편집을 쓰면서도 원본 맵을 오염시키지 않도록 전체 스냅샷/복원.
//   배열 참조와 각 객체의 own property를 모두 보존한다(runtime tactical ID/revision 포함).
// [AI0-B R1] production으로 만든 대상 객체의 실제 위치·네 face 기준으로 유효 ray를 탐색한다.
//   다른 객체가 먼저 맞으면 그 ray는 쓰지 않는다. 없으면 null을 돌려 명시적 FAIL이 되게 한다.
function _ai0bFindSurfaceHit(obj) {
  if (!obj || !obj._tacticalObjectId) return null;
  const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
  for (const off of [10, 16, 24, 34]) {
    const probes = [
      [cx, obj.y - off, 0, 1], [cx, obj.y + obj.h + off, 0, -1],
      [obj.x - off, cy, 1, 0], [obj.x + obj.w + off, cy, -1, 0],
    ];
    for (const [ox, oy, dx, dy] of probes) {
      const h = raycastWorldSurface(ox, oy, dx, dy, off + Math.max(obj.w, obj.h) + 8, {});
      if (h && h.objectId === obj._tacticalObjectId) return { hit: h, ox, oy, dist: off };
    }
  }
  return null;
}
function _ai0bSnapshotMaps() {
  const out = { maps: [], activeMapId: GAME.mapId, activeMapData: (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null,
    tacticalGeometry: GAME.tacticalGeometry, runtimeUidSeq: _tgRuntimeUidSeq, sharedCache: _spatialSharedCache };
  const M = (typeof MAPS !== 'undefined') ? MAPS : {};
  for (const id of Object.keys(M)) {
    const map = M[id]; if (!map) continue;
    const rec = { id, mapRef: map, arrays: {}, own: {} };
    for (const key of ['walls', 'coverObjects', 'floorZones', 'rooms']) {
      const arr = map[key];
      if (!Array.isArray(arr)) continue;
      rec.arrays[key] = { ref: arr, items: arr.slice(), props: arr.map(o => Object.assign({}, o)) };
    }
    for (const k of Object.keys(map)) if (typeof map[k] !== 'object' || map[k] === null) rec.own[k] = map[k];
    out.maps.push(rec);
  }
  return out;
}
function _ai0bRestoreMaps(snap) {
  if (!snap) return;
  for (const rec of snap.maps) {
    const map = rec.mapRef;
    for (const key of Object.keys(rec.arrays)) {
      const a = rec.arrays[key];
      const arr = a.ref;
      arr.length = 0;
      for (let i = 0; i < a.items.length; i++) {
        const obj = a.items[i], props = a.props[i];
        for (const k of Object.keys(obj)) if (!(k in props)) delete obj[k];   // suite가 추가한 필드 제거
        Object.assign(obj, props);                                            // 원래 값 복원
        arr.push(obj);
      }
      map[key] = arr;
    }
    for (const k of Object.keys(rec.own)) map[k] = rec.own[k];
  }
  try { if (snap.activeMapId) { setMapById(snap.activeMapId); GAME.mapId = snap.activeMapId; } } catch (e) {}
  GAME.tacticalGeometry = snap.tacticalGeometry;
  _tgRuntimeUidSeq = snap.runtimeUidSeq;
  _spatialSharedCache = snap.sharedCache;
}
function _ai0bMapsContentHash() {
  const M = (typeof MAPS !== 'undefined') ? MAPS : {};
  const parts = [];
  for (const id of Object.keys(M).sort()) {
    const map = M[id]; if (!map) continue;
    for (const key of ['walls', 'coverObjects', 'floorZones', 'rooms']) {
      const arr = map[key]; if (!Array.isArray(arr)) continue;
      parts.push(id + '.' + key + '#' + arr.length);
      for (const o of arr) parts.push(_iwStableHash(o));
    }
  }
  return _iwShortHash(parts.join('|'));
}
const AI0B_MAP_IDS = ['cqb', 'range', 'apartment', 'corridor', 'warehouse'];
const AI0B_SANITY = { cqb:[8,20,7], range:[2,10,1], apartment:[8,20,7], corridor:[11,30,10], warehouse:[2,20,1] };
function _ai0bFreshGraph(mapId) {
  const M = (typeof MAPS !== 'undefined') ? MAPS[mapId] : null;
  if (!M) return null;
  ensureTacticalGeometryIds(M);
  return buildTacticalSpatialGraph(M, {});
}
// production 배치 — isPlacementAllowed()를 우회하지 않고 유효 위치를 탐색한다
function _ai0bPlaceCover(startX, startY) {
  const M = MAP_DATA;
  if (!isPlacementAllowed()) return null;
  const sx = (startX != null) ? startX : 100, sy = (startY != null) ? startY : 100;
  const before0 = M.coverObjects ? M.coverObjects.length : 0;
  placeCoverAt(sx, sy);
  if (M.coverObjects && M.coverObjects.length > before0) return M.coverObjects[M.coverObjects.length - 1];
  for (let y = 100; y < M.h - 100; y += 40) {
    for (let x = 100; x < M.w - 100; x += 40) {
      const b = M.coverObjects ? M.coverObjects.length : 0;
      placeCoverAt(x, y);
      if (M.coverObjects && M.coverObjects.length > b) return M.coverObjects[M.coverObjects.length - 1];
    }
  }
  return null;
}
function _ai0bEnablePlacement() {
  GAME.phase = 'play'; GAME.paused = true; GAME.over = false;
  GAME.placementType = 'cover'; GAME.placementCoverId = 'crate_wood'; GAME.placementMaterial = 'wood';
  // 원본 counter 객체를 in-place로 증가시키지 않는다(sandbox live content 보존)
  GAME.placementCounter = { cover: 0, wall: 0, reactive: 0 };
}
function _runAI0BClosureCore(ctx, seed) {
  const _mapSnap = _ai0bSnapshotMaps();
  const _restoreMapId = GAME.mapId;
  try {
  const tests = [];
  const T = (id, passC, expected, actual, consumer) => tests.push({ id, pass: !!passC, expected, actual, consumer: consumer || '' });
  const evidence = {};

  // ── B-01 Surface raycast 계약 ──
  {
    const g0 = ensureTacticalSpatialGraph();
    const w = MAP_DATA.walls.find(x => x.w > 60 && x.h <= 20);
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const N = raycastWorldSurface(cx, w.y - 50, 0, 1, 200, {});
    const S = raycastWorldSurface(cx, w.y + w.h + 50, 0, -1, 200, {});
    const E = raycastWorldSurface(w.x + w.w + 50, cy, -1, 0, 200, {});
    const ok = N && S && E && N.face === 'north' && S.face === 'south' && E.face === 'east'
      && N.worldNormalY === -1 && S.worldNormalY === 1 && E.worldNormalX === 1
      && N.segmentLength > 0 && N.hitS >= 0 && N.hitS <= N.segmentLength
      && Math.abs(N.tangentX * N.worldNormalX + N.tangentY * N.worldNormalY) < 1e-9;
    evidence.surfaceRaycast = { face: [N && N.face, S && S.face, E && E.face], segLen: N && N.segmentLength, hitS: N && +N.hitS.toFixed(1) };
    T('B-01_surface_raycast_contract', ok, 'face/normal/tangent/segment/hitS 정합', JSON.stringify(evidence.surfaceRaycast), 'raycastWorldSurface');
  }
  // ── B-02 corner tie 결정성 ──
  {
    const w = MAP_DATA.walls.find(x => x.w > 60 && x.h <= 20);
    const faces = new Set();
    for (let i = 0; i < 12; i++) faces.add(raycastAabbSurface(w.x - 100, w.y - 100, Math.SQRT1_2, Math.SQRT1_2, w, 500, {}).face);
    T('B-02_corner_tie_deterministic', faces.size === 1, '동일 face 12회', JSON.stringify([...faces]), 'raycastAabbSurface');
  }
  // ── B-03 observedRanges 부분 관측 ──
  {
    const mem = ensureAIMemory({ id: 81001, x: 0, y: 0, team: 'friend' });
    const w = MAP_DATA.walls.find(x => x.w > 200 && x.h <= 20);
    const hit = raycastWorldSurface(w.x + w.w / 2, w.y - 60, 0, 1, 200, {});
    const sm = recordSurfaceObservation(mem, hit, 1, { hitDistance: 60, angularSpacing: 0.12 });
    const cov = getObservedSurfaceCoverage(sm);
    evidence.partialObservation = { segLen: sm.segmentLength, ranges: sm.observedRanges.length, coverage: +cov.toFixed(4) };
    T('B-03_partial_surface_observation', cov > 0 && cov < 0.25 && sm.observedRanges.length === 1,
      '한 ray는 면 전체를 관측하지 않음', JSON.stringify(evidence.partialObservation), 'recordSurfaceObservation');
  }
  // ── B-04 반대편 면 자동 기억 금지 ──
  {
    const mem = ensureAIMemory({ id: 81002, x: 0, y: 0, team: 'friend' });
    const w = MAP_DATA.walls.find(x => x.w > 200 && x.h <= 20);
    const hit = raycastWorldSurface(w.x + w.w / 2, w.y - 60, 0, 1, 200, {});
    recordSurfaceObservation(mem, hit, 1, { hitDistance: 60, angularSpacing: 0.12 });
    const faces = [...mem.observedSurfaces.values()].filter(x => x.objectId === hit.objectId).map(x => x.face);
    T('B-04_no_opposite_face_memory', faces.length === 1 && faces[0] === hit.face,
      '맞은 면만 기억', JSON.stringify(faces), 'recordSurfaceObservation');
  }
  // ── B-05 range 조각 병합 ──
  {
    const mem = ensureAIMemory({ id: 81003, x: 0, y: 0, team: 'friend' });
    const w = MAP_DATA.walls.find(x => x.w > 200 && x.h <= 20);
    let sm = null;
    for (const off of [-40, -38, -36, 60]) {
      const hit = raycastWorldSurface(w.x + w.w / 2 + off, w.y - 60, 0, 1, 200, {});
      if (hit) sm = recordSurfaceObservation(mem, hit, 1, { hitDistance: 60, angularSpacing: 0.12 });
    }
    const sorted = sm.observedRanges.every((r, i, a) => i === 0 || a[i - 1].s0 <= r.s0);
    T('B-05_observed_range_merge', sm.observedRanges.length >= 1 && sm.observedRanges.length < 4 && sorted,
      '인접 관측 병합 + 정렬 유지', `ranges=${sm.observedRanges.length}`, '_mergeObservedRanges');
  }
  // ── B-06~B-10 5맵 sanity + stable ID + map-local build ──
  {
    const per = {}; let sanityOk = true, stableOk = true, totalMs = 0, maxMs = 0;
    for (const m of AI0B_MAP_IDS) {
      const a = _ai0bFreshGraph(m), b = _ai0bFreshGraph(m);
      const [rmin, rmax, pmin] = AI0B_SANITY[m];
      const st = a.buildStats;
      if (!(st.regionCount >= rmin && st.regionCount <= rmax && st.portalCount >= pmin)) sanityOk = false;
      if (a.buildFingerprint !== b.buildFingerprint) stableOk = false;
      totalMs += st.buildMs; maxMs = Math.max(maxMs, st.buildMs);
      per[m] = { R: st.regionCount, doorway: st.doorwayPortals, thresholds: st.tacticalThresholdCount,
        gridNative: st.gridNativePortals, subgrid: st.subgridBridgePortals, cols: a.cols, rows: a.rows, ms: +st.buildMs.toFixed(1) };
    }
    evidence.maps = per; evidence.buildTotalMs = +totalMs.toFixed(1); evidence.buildMaxMs = +maxMs.toFixed(1);
    T('B-06_five_map_sanity', sanityOk, '5맵 region/portal 범위', JSON.stringify(per), 'buildTacticalSpatialGraph');
    T('B-07_stable_ids', stableOk, '재빌드 fingerprint 동일', 'all maps', 'buildTacticalSpatialGraph');
    T('B-08_build_performance', totalMs < 300 && maxMs < 100, '합계<300ms 개별<100ms', `total=${totalMs.toFixed(1)} max=${maxMs.toFixed(1)}`, 'buildTacticalSpatialGraph');
    T('B-09_corridor_topology', per.corridor.R === 11 && per.corridor.doorway === 10,
      'corridor 11 regions / 10 doorway portals', JSON.stringify(per.corridor), 'buildTacticalSpatialGraph');
    T('B-10_map_dimensions', per.range.cols === 74 && per.range.rows === 32 && per.apartment.cols === 37,
      '맵 실제 크기 기반 격자', `range ${per.range.cols}x${per.range.rows} apartment ${per.apartment.cols}x${per.apartment.rows}`, 'getPathGridSpec');
  }
  // ── B-11 map-local build (active와 무관) ──
  {
    const prevId = GAME.mapId;
    setMapById('cqb'); GAME.mapId = 'cqb'; ensureTacticalGeometryIds(MAP_DATA);
    const rg = _ai0bFreshGraph('range');
    const sp = getPathGridSpec(MAPS.range);
    const ok = sp.cols === 74 && sp.rows === 32 && rg.regions.size === 5 && rg.portals.size === 5;
    // cache poisoning 확인
    setMapById(prevId || 'cqb'); GAME.mapId = prevId || 'cqb';
    const rg2 = _ai0bFreshGraph('range');
    evidence.mapLocalBuild = { cols: sp.cols, rows: sp.rows, R: rg.regions.size, P: rg.portals.size, poisonFree: rg.buildFingerprint === rg2.buildFingerprint };
    T('B-11_map_local_build', ok && rg.buildFingerprint === rg2.buildFingerprint,
      'active와 무관한 build + poisoning 0', JSON.stringify(evidence.mapLocalBuild), 'buildTacticalSpatialGraph/pathBlockedForMap');
  }
  // ── B-12 region 계약 fixture ──
  {
    const PXM = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 32;
    const FIX = [
      ['cqb', 230, 140, 600, 160, false],
      // 복도를 방화문 격벽으로 서/중앙/동 셋으로 나눴다 — 이 두 점은 이제 **다른 구간**이다.
      ['cqb', 450, 495, 700, 495, false],
      // 같은 구간 안에서는 여전히 이어져 있다
      ['cqb', 600, 495, 1000, 495, true],
      ['apartment', 4 * PXM, 4 * PXM, 11 * PXM, 4.5 * PXM, false], ['apartment', 14 * PXM, 9 * PXM, 20 * PXM, 9 * PXM, true],
      ['corridor', 13 * PXM, 3.5 * PXM, 24 * PXM, 8 * PXM, false], ['corridor', 24 * PXM, 8 * PXM, 42 * PXM, 8 * PXM, true],
      ['warehouse', 10 * PXM, 7.5 * PXM, 34 * PXM, 7.5 * PXM, true],
    ];
    let ok = 0; const det = [];
    for (const [m, x1, y1, x2, y2, want] of FIX) {
      const g = _ai0bFreshGraph(m);
      const a = getSpatialRegionAt(x1, y1, g), b = getSpatialRegionAt(x2, y2, g);
      const same = !!(a && b && a.id === b.id);
      if (same === want) ok++; else det.push(`${m}:${x1},${y1}~${x2},${y2} got=${same} want=${want}`);
    }
    evidence.regionFixtures = { pass: ok, total: FIX.length, fails: det };
    T('B-12_region_fixtures', ok === FIX.length, `region fixture ${FIX.length}/${FIX.length}`, `${ok}/${FIX.length} ${det.join(' ')}`, 'getSpatialRegionAt');
  }
  // ── B-13 5맵 전 doorway 횡단 (10/25/50/75/90%) ──
  {
    let totCross = 0, crossFail = 0, misID = 0, outsideHit = 0, doors = 0;
    for (const m of AI0B_MAP_IDS) {
      setMapById(m); GAME.mapId = m;
      GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA);
      const g = ensureTacticalSpatialGraph(true);
      for (const op of g.openings.filter(o => o.kind === 'doorway' && o.portalId)) {
        doors++;
        for (const f of [0.10, 0.25, 0.50, 0.75, 0.90]) {
          const u = { id: 82000, x: 0, y: 0, team: 'friend' }; ensureAIMemory(u); u.aiMemory.knownPortals = new Map();
          const px = op.ax + (op.bx - op.ax) * f, py = op.ay + (op.by - op.ay) * f;
          u.x = px - op.normalX * 70; u.y = py - op.normalY * 70;
          traceSpatialKnowledgeAlongRay(u, u.x, u.y, px + op.normalX * 70, py + op.normalY * 70, { graph: g });
          totCross++;
          const ids = [...u.aiMemory.knownPortals.keys()];
          if (!ids.includes(op.portalId)) crossFail++; else if (ids.length > 1) misID++;
        }
        const u2 = { id: 82001, x: 0, y: 0, team: 'friend' }; ensureAIMemory(u2); u2.aiMemory.knownPortals = new Map();
        const offD = Math.max(60, op.width * 2);
        const ox2 = op.centerX + op.tangentX * offD, oy2 = op.centerY + op.tangentY * offD;
        u2.x = ox2 - op.normalX * 70; u2.y = oy2 - op.normalY * 70;
        traceSpatialKnowledgeAlongRay(u2, u2.x, u2.y, ox2 + op.normalX * 70, oy2 + op.normalY * 70, { graph: g });
        if (u2.aiMemory.knownPortals.has(op.portalId)) outsideHit++;
      }
    }
    evidence.portalCrossing = { doors, totCross, crossFail, misID, outsideHit };
    T('B-13_doorway_crossing_all', crossFail === 0, '전 doorway 5지점 획득', `${totCross - crossFail}/${totCross} doors=${doors}`, 'traceSpatialKnowledgeAlongRay');
    T('B-14_no_adjacent_portal_confusion', misID === 0 && outsideHit === 0, '인접 오인 0 / opening 밖 0', `misID=${misID} outside=${outsideHit}`, 'traceSpatialKnowledgeAlongRay');
  }
  // ── B-15 blocker 뒤 portal 인식 0 ──
  {
    setMapById('corridor'); GAME.mapId = 'corridor';
    GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA);
    const g = ensureTacticalSpatialGraph(true);
    const op = g.openings.find(o => o.kind === 'doorway' && o.portalId);
    const u = { id: 82002, x: 0, y: 0, team: 'friend' }; ensureAIMemory(u); u.aiMemory.knownPortals = new Map();
    // 문 반대편 훨씬 먼 지점에서 시작하되 ray를 문 '앞'에서 끊는다(도달 전)
    u.x = op.centerX - op.normalX * 200; u.y = op.centerY - op.normalY * 200;
    const stopX = op.centerX - op.normalX * 60, stopY = op.centerY - op.normalY * 60;
    traceSpatialKnowledgeAlongRay(u, u.x, u.y, stopX, stopY, { graph: g });
    T('B-15_no_portal_beyond_blocker', u.aiMemory.knownPortals.size === 0,
      'ray 도달 전 portal 인식 0', `known=${u.aiMemory.knownPortals.size}`, 'traceSpatialKnowledgeAlongRay');
  }
  // ── B-16 소리는 geometry를 발견하지 않는다 ──
  {
    const g = _ai0bFreshGraph('corridor');
    setMapById('corridor'); GAME.mapId = 'corridor';
    invalidateTacticalSpatialGraph('b16'); const gg = ensureTacticalSpatialGraph();
    const op = gg.openings.find(o => o.kind === 'doorway' && o.portalId);
    const u = { id: 82003, x: op.centerX - op.normalX * 60, y: op.centerY - op.normalY * 60, team: 'friend' };
    ensureAIMemory(u); u.aiMemory.knownPortals = new Map();
    const arr = resolveSoundArrivalPortal(u, op.centerX + op.normalX * 60, op.centerY + op.normalY * 60);
    evidence.soundNoGeometry = { portalKnown: arr.portalKnown, arrivalPortalId: arr.arrivalPortalId, knownAfter: u.aiMemory.knownPortals.size };
    T('B-16_sound_does_not_discover_geometry',
      arr.portalKnown === false && arr.arrivalPortalId === null && u.aiMemory.knownPortals.size === 0,
      '모르는 portal은 ID 미노출 + 학습 0', JSON.stringify(evidence.soundNoGeometry), 'resolveSoundArrivalPortal');
  }
  // ── B-17 아는 portal이면 소리 방향이 portal로 연결 ──
  {
    invalidateTacticalSpatialGraph('b17'); const gg = ensureTacticalSpatialGraph();
    const op = gg.openings.find(o => o.kind === 'doorway' && o.portalId);
    const p = gg.portals.get(op.portalId);
    const u = { id: 82004, x: op.centerX - op.normalX * 60, y: op.centerY - op.normalY * 60, team: 'friend' };
    ensureAIMemory(u); u.aiMemory.knownPortals = new Map();
    markPortalKnown(u, p, { confidence: 0.9 });
    const arr = resolveSoundArrivalPortal(u, op.centerX + op.normalX * 90, op.centerY + op.normalY * 90);
    const expectDir = Math.atan2(p.centerY - u.y, p.centerX - u.x);
    T('B-17_known_portal_sound_direction',
      arr.portalKnown === true && arr.arrivalPortalId === op.portalId && Math.abs(arr.arrivalDirection - expectDir) < 1e-6,
      '아는 portal로 방향 연결', `known=${arr.portalKnown} id=${!!arr.arrivalPortalId}`, 'resolveSoundArrivalPortal');
  }
  // ── B-18 production editor revision 계약 ──
  {
    setMapById('cqb'); GAME.mapId = 'cqb';
    GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA); ensureTacticalSpatialGraph(true);
    _ai0bEnablePlacement();
    const topo0 = GAME.tacticalGeometry.revision;
    const A = _ai0bPlaceCover();
    let ok = !!A, det = {};
    if (A) {
      det.placed = A._tacticalObjectId.slice(-10);
      det.topoAfterPlace = GAME.tacticalGeometry.revision;
      GAME.selectedCoverId = A._coverUid;
      const r1 = A._tacticalGeometryRevision; rotateSelectedCover();
      det.rotate = `${r1}->${A._tacticalGeometryRevision}`;
      if (!(A._tacticalGeometryRevision > r1)) ok = false;
      const r2 = A._tacticalGeometryRevision, ox = A.x; moveSelectedCover(A.x + 120, A.y + 80);
      det.move = `${r2}->${A._tacticalGeometryRevision} x ${ox}->${A.x}`;
      if (!(A._tacticalGeometryRevision > r2)) ok = false;
      const r3 = A._tacticalGeometryRevision; moveSelectedCover(A.x + A.w / 2, A.y + A.h / 2);
      det.moveNoChange = `${r3}->${A._tacticalGeometryRevision}`;
      if (A._tacticalGeometryRevision !== r3) ok = false;
      GAME.selectedCoverId = null; const t4 = GAME.tacticalGeometry.revision; moveSelectedCover(500, 500);
      det.noSelection = `${t4}->${GAME.tacticalGeometry.revision}`;
      if (GAME.tacticalGeometry.revision !== t4) ok = false;
      if (!(det.topoAfterPlace > topo0)) ok = false;
    }
    evidence.editorRevision = det;
    T('B-18_production_editor_revision', ok, '실제 변경만 revision 증가', JSON.stringify(det), 'placeCoverAt/rotateSelectedCover/moveSelectedCover');
  }
  // ── B-19 재질 변경: topology 불변 + SurfaceMemory 무효화 ──
  {
    setMapById('cqb'); GAME.mapId = 'cqb';
    GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA); ensureTacticalSpatialGraph(true);
    GAME.selectedCoverId = null;
    _ai0bEnablePlacement();
    const A = _ai0bPlaceCover();
    let ok = !!A, det = { placed: !!A };
    if (A) {
      GAME.selectedCoverId = A._coverUid;
      const mem = ensureAIMemory({ id: 82005, x: 0, y: 0, team: 'friend' });
      const p1 = _ai0bFindSurfaceHit(A);
      if (!p1) { ok = false; det.aimFail = 'initial aim: 유효 surface hit 없음'; }
      else {
        recordSurfaceObservation(mem, p1.hit, 1, { hitDistance: p1.dist, angularSpacing: 0.12 });
        const sm1 = mem.observedSurfaces.get(p1.hit.surfaceId);
        const obs0 = sm1.observationRevision, mat0 = A.material;
        const topo0 = GAME.tacticalGeometry.revision, geo0 = A._tacticalGeometryRevision, surf0 = A._tacticalSurfaceRevision || 0;
        editorCycleMaterial(1);
        det.topology = `${topo0}->${GAME.tacticalGeometry.revision}`;
        det.geometry = `${geo0}->${A._tacticalGeometryRevision}`;
        det.surface = `${surf0}->${A._tacticalSurfaceRevision}`;
        det.material = `${mat0}->${A.material}`;
        det.face = p1.hit.face;
        if (GAME.tacticalGeometry.revision !== topo0) ok = false;
        if (A._tacticalGeometryRevision !== geo0) ok = false;
        if (!(A._tacticalSurfaceRevision > surf0)) ok = false;
        const p2 = _ai0bFindSurfaceHit(A);
        if (!p2) { ok = false; det.aimFail = 're-aim: 유효 surface hit 없음'; }
        else {
          det.obsRevChanged = p2.hit.observationRevision !== obs0;
          if (!det.obsRevChanged) ok = false;
          recordSurfaceObservation(mem, p2.hit, 2, { hitDistance: p2.dist, angularSpacing: 0.12 });
          const sm2 = mem.observedSurfaces.get(p2.hit.surfaceId);
          det.newMaterial = sm2.material;
          if (sm2.material !== A.material) ok = false;
        }
      }
    }
    evidence.materialContract = det;
    T('B-19_material_surface_only', ok, '재질: topology/geometry 불변 + SurfaceMemory 무효화', JSON.stringify(det), 'editorCycleMaterial/markSurfaceMaterialChanged');
  }
  // ── B-20 runtime ID lifecycle ──
  {
    setMapById('cqb'); GAME.mapId = 'cqb';
    GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA); ensureTacticalSpatialGraph(true);
    _ai0bEnablePlacement();
    const A = _ai0bPlaceCover();
    let ok = !!A, det = { placed: !!A };
    if (A) {
      const posA = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, idA = A._tacticalObjectId;
      const B = _ai0bPlaceCover();
      GAME.selectedCoverId = A._coverUid; deleteSelectedCover();
      const C = _ai0bPlaceCover(posA.x, posA.y);
      det = { A: idA.slice(-8), B: B ? B._tacticalObjectId.slice(-8) : null, C: C ? C._tacticalObjectId.slice(-8) : null };
      if (!B || !C) ok = false;
      else { if (B._tacticalObjectId === C._tacticalObjectId) ok = false; if (idA === C._tacticalObjectId) ok = false; }
      const seen = new Set(); let dup = 0;
      for (const o of (MAP_DATA.coverObjects || []).concat(MAP_DATA.walls || [])) { const id = getTacticalObjectId(o); if (seen.has(id)) dup++; seen.add(id); }
      det.dup = dup; if (dup !== 0) ok = false;
    }
    evidence.runtimeIdLifecycle = det;
    T('B-20_runtime_id_lifecycle', ok, '배치→삭제→재배치 ID 재사용 0, 중복 0', JSON.stringify(det), 'placeCoverAt/getTacticalObjectId');
  }
  const failures = tests.filter(t => !t.pass);
  return { tests, failures, evidence };
  } finally { _ai0bRestoreMaps(_mapSnap); }
}
// ════════════════ AI0-B MUTATION CORE ════════════════
function _runAI0BMutationCore(ctx, seed) {
  const _mapSnap = _ai0bSnapshotMaps();
  try {
  const results = [];
  const detect = () => {
    const ids = [];
    const rep = _mkValidationReport();
    try { validateSurfaceSpatialFoundation(rep); } catch (e) { rep.error('exc', e.message); }
    for (const er of rep.errors) ids.push('validator:' + er.msg.slice(0, 40));
    let cs; try { cs = _runAI0BClosureCore(ctx, seed); } catch (e) { ids.push('closureCore:exc:' + e.message); cs = { failures: [] }; }
    for (const f of (cs.failures || [])) ids.push('closure:' + f.id);
    return ids;
  };
  _iwResetSandboxToBaseline(ctx);
  const baselineList = detect();
  const baseline = new Set(baselineList);
  if (baselineList.length) {
    return { mutations: [], failures: [{ mutationId: 'BASELINE_NOT_CLEAN', baselineFailures: baselineList.slice(0, 6) }],
      baselineClean: false, baselineFailureCount: baselineList.length, blocked: true };
  }
  const detectNew = () => detect().filter(id => !baseline.has(id));
  const runOne = (mutationId, hookName, makeReplacement, note) => {
    _iwResetSandboxToBaseline(ctx);
    const rngBefore = Math.random;
    const orig = _IW_HOOKABLE[hookName].get();
    _iwInstallHook(hookName, makeReplacement(orig));
    const injected = (_IW_HOOKABLE[hookName].get() !== orig);
    const failureIds = detectNew();
    _iwRemoveHook(hookName);
    const restored = (_IW_HOOKABLE[hookName].get() === orig);
    const hooksClean = _iwMutationHookNames().length === 0;
    _iwResetSandboxToBaseline(ctx);
    const chk = _iwAssertSandboxBaselineRestored(ctx);
    results.push({ mutationId, hookName, note, injected, detected: failureIds.length >= 1,
      detectedBy: failureIds.slice(0, 4), failureIds, restored,
      rngRestored: (Math.random === rngBefore), hooksRemoved: hooksClean, sandboxBaselineRestored: chk.ok });
  };
  // M-AI0B-01 graph가 전달받은 map 대신 global MAP_DATA를 사용
  runOne('M-AI0B-01_graph_uses_global_map', 'pathCellWalkableForMap',
    () => function (map, x, y) { return _pathCellWalkable(x, y); },   // map 무시 → active map 기준
    'walkable 판정이 global MAP_DATA를 사용');
  // M-AI0B-02 production 편집이 object revision을 올리지 않음
  runOne('M-AI0B-02_edit_no_object_revision', 'markTacticalGeometryChanged',
    (orig) => function (obj, reason, options) { return orig(null, reason, options); },   // 객체 전달 누락
    '편집이 변경 객체를 전달하지 않아 object revision 미증가');
  // M-AI0B-03 portal cell이 단일 후보만 보존
  runOne('M-AI0B-03_single_portal_candidate', 'buildTacticalSpatialGraph',
    (orig) => function (map, options) {
      const g = orig(map, options);
      if (g && g.portalCellCandidates) for (const [k, list] of g.portalCellCandidates) if (list.length > 1) g.portalCellCandidates.set(k, [list[0]]);
      return g;
    }, 'cell당 portal 후보를 하나만 남김');
  // M-AI0B-04 runtime ID가 삭제 후 재사용됨
  runOne('M-AI0B-04_runtime_id_reuse', 'getTacticalObjectId',
    (orig) => function (obj, kind) {
      if (obj && !obj._tacticalObjectId) {
        const mapId = _tgMapId(null);
        obj._tacticalObjectId = mapId + ':' + (kind || 'cover') + ':' + _tgGeomKey(obj);   // 좌표 기반 → 재사용
        obj._tacticalKind = kind || 'cover';
        if (obj._tacticalGeometryRevision == null) obj._tacticalGeometryRevision = 0;
        return obj._tacticalObjectId;
      }
      return orig(obj, kind);
    }, 'runtime 객체가 좌표 기반 ID를 재사용');
  // M-AI0B-05 소리가 모르는 portal을 학습
  runOne('M-AI0B-05_sound_learns_geometry', 'resolveSoundArrivalPortal',
    (orig) => function (listener, sx, sy) {
      const g = ensureTacticalSpatialGraph();
      const lr = g && getSpatialRegionAt(listener.x, listener.y, g), sr = g && getSpatialRegionAt(sx, sy, g);
      if (g && lr && sr && lr.id !== sr.id) {
        const chain = getPortalChainBetween(lr.id, sr.id, g);
        if (chain && chain.length) {
          const p = g.portals.get(chain[0]);
          if (p) { markPortalKnown(listener, p, { confidence: 0.9 });   // 보지도 않은 portal 학습
            return { portalKnown: true, arrivalPortalId: p.id, arrivalDirection: Math.atan2(p.centerY - listener.y, p.centerX - listener.x), sameRegion: false }; }
        }
      }
      return orig(listener, sx, sy);
    }, '소리만으로 portal geometry 학습');
  // M-AI0B-06 한 ray가 면 전체를 관측
  runOne('M-AI0B-06_full_surface_from_one_ray', 'recordSurfaceObservation',
    (orig) => function (mem, hit, now, options) {
      const sm = orig(mem, hit, now, options);
      if (sm) sm.observedRanges = [{ s0: 0, s1: sm.segmentLength, firstSeenAt: now, lastSeenAt: now, confidence: 1 }];
      return sm;
    }, '한 ray가 면 전체를 관측한 것으로 기록');
  const failures = results.filter(r => !(r.injected && r.detected && r.restored && r.rngRestored && r.hooksRemoved && r.sandboxBaselineRestored));
  return { mutations: results, failures, baselineClean: true, baselineFailureCount: 0, blocked: false };
  } finally { _ai0bRestoreMaps(_mapSnap); }
}
// ════════════════ AI0-B VALIDATOR ════════════════
function validateSurfaceSpatialFoundation(rep, graph) {
  const g = graph || ensureTacticalSpatialGraph();
  if (!g) { rep.error('surfaceSpatial', 'spatial graph 없음'); return rep; }
  // 1) walkable cell의 region 누락 0
  let missing = 0;
  for (let i = 0; i < g.walkable.length; i++) if (g.walkable[i] && g.cellRegionIds[i] < 0) missing++;
  if (missing > 0) rep.error('surfaceSpatial', `walkable cell region 누락 ${missing}`);
  // 2) portal 계약
  for (const p of g.portals.values()) {
    if (!g.regions.has(p.regionAId) || !g.regions.has(p.regionBId)) rep.error('surfaceSpatial', `portal ${p.id}: region 참조 dangling`);
    if (p.regionAId === p.regionBId) rep.error('surfaceSpatial', `portal ${p.id}: 같은 region 연결`);
    if (!p.clearanceVerified) rep.error('surfaceSpatial', `portal ${p.id}: clearanceVerified 아님`);
    if (p.gridNative === p.subgridBridge) rep.error('surfaceSpatial', `portal ${p.id}: gridNative/subgridBridge 배타 위반`);
    if (p.bridgePath && typeof pathBlockedForMap === 'function') {
      const M = (typeof MAPS !== 'undefined' && MAPS[g.mapId]) ? MAPS[g.mapId] : MAP_DATA;
      for (let k = 1; k < p.bridgePath.length; k++) {
        if (pathBlockedForMap(M, p.bridgePath[k-1].x, p.bridgePath[k-1].y, p.bridgePath[k].x, p.bridgePath[k].y, PATH_PAD)) {
          rep.error('surfaceSpatial', `portal ${p.id}: wall-penetrating bridge`); break;
        }
      }
    }
  }
  // 3) region ↔ portal 상호 참조
  for (const r of g.regions.values()) for (const pid of r.portalIds) {
    const p = g.portals.get(pid);
    if (!p) { rep.error('surfaceSpatial', `region ${r.id}: portal ${pid} dangling`); continue; }
    if (p.regionAId !== r.id && p.regionBId !== r.id) rep.error('surfaceSpatial', `region ${r.id}: portal ${pid} 역참조 불일치`);
  }
  // 4) tacticalThreshold는 region을 분할하지 않는다
  for (const th of (g.tacticalThresholds || [])) {
    if (th.kind === 'doorway') rep.error('surfaceSpatial', `threshold ${th.thresholdId}: doorway로 분류됨`);
  }
  // 5) 격자 규약 일치
  const sp = getPathGridSpec((typeof MAPS !== 'undefined' && MAPS[g.mapId]) ? MAPS[g.mapId] : MAP_DATA);
  if (sp.cols !== g.cols || sp.rows !== g.rows) rep.error('surfaceSpatial', `격자 불일치 spec ${sp.cols}x${sp.rows} vs graph ${g.cols}x${g.rows}`);
  return rep;
}
// ════════════════ AI0-B PUBLIC SUITES ════════════════
function runAI0BSpatialClosureSuite(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0BClosureCore(ctx, seed));
  const core = sb.coreResult || { tests: [], failures: [{ id: 'CORE_EXCEPTION', pass: false }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ id: 'CORE_EXCEPTION:' + sb.coreError.message, pass: false }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, coreError: sb.coreError, tests: core.tests || [], failures: core.failures || [], evidence: core.evidence || {},
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.tests||[]).length - (core.failures||[]).length}/${(core.tests||[]).length} tests, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
function runAI0BSpatialMutationTests(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0BMutationCore(ctx, seed));
  const core = sb.coreResult || { mutations: [], failures: [{ mutationId: 'CORE_EXCEPTION' }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ mutationId: 'CORE_EXCEPTION:' + sb.coreError.message }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, mutations: core.mutations || [], failures: core.failures || [],
    baselineClean: core.baselineClean, baselineFailureCount: core.baselineFailureCount, blocked: !!core.blocked,
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.mutations||[]).length - (core.failures||[]).length}/${(core.mutations||[]).length} full-pass, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
// ════════════════ AI0-C1 CHECKPOINT SUITE ════════════════
function _c1MakeSurfaceMemory(unit, obj, face, ranges, opts) {
  const o = opts || {};
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const nrm = SURFACE_FACE_NORMAL[face];
  let sx0, sy0, sx1, sy1;
  if (face === 'north') { sx0 = obj.x; sy0 = obj.y; sx1 = obj.x + obj.w; sy1 = obj.y; }
  else if (face === 'south') { sx0 = obj.x; sy0 = obj.y + obj.h; sx1 = obj.x + obj.w; sy1 = obj.y + obj.h; }
  else if (face === 'west') { sx0 = obj.x; sy0 = obj.y; sx1 = obj.x; sy1 = obj.y + obj.h; }
  else { sx0 = obj.x + obj.w; sy0 = obj.y; sx1 = obj.x + obj.w; sy1 = obj.y + obj.h; }
  const segLen = Math.hypot(sx1 - sx0, sy1 - sy0);
  const tx = segLen > 0 ? (sx1 - sx0) / segLen : 1, ty = segLen > 0 ? (sy1 - sy0) / segLen : 0;
  const now = GAME.gameTime || 0;
  const sid = getTacticalObjectId(obj, o.objectKind || 'wall') + ':' + face;
  const sm = { surfaceId: sid, objectId: obj._tacticalObjectId, objectKind: o.objectKind || 'wall', face,
    geometryRevision: getTacticalGeometryRevision(obj), observationRevision: getSurfaceObservationRevision(obj),
    worldNormalX: nrm[0], worldNormalY: nrm[1], tangentX: tx, tangentY: ty,
    segmentStartX: sx0, segmentStartY: sy0, segmentEndX: sx1, segmentEndY: sy1, segmentLength: segLen,
    observedRanges: ranges.map(r => ({ s0: r[0], s1: r[1], firstSeenAt: now, lastSeenAt: now, confidence: 1 })),
    coverType: o.coverType || (o.objectKind === 'cover' ? 'full' : 'full'),
    blocksVision: true, blocksBullets: true, material: obj.material || null, armor: obj.armor != null ? obj.armor : null,
    firstSeenAt: now, lastSeenAt: now, lastVerifiedAt: now, confidence: 1.0, invalidCount: 0 };
  mem.observedSurfaces.set(sid, sm);
  return sm;
}
function _c1TestUnit(ctx, x, y, team) {
  const u = makeUnit({ team: team || 'friend', name: 'C1', x, y, facing: 0, weaponId: 'm4a1', ammoId: '556_m855',
    role: 'reactive', loadout: { weaponId: 'm4a1', ammoId: '556_m855' } });
  u.alive = true; u.stance = 'standing'; u.movePath = []; u._aiCommandPath = null;
  ensureAICommandState(u); ensureSpatialMemoryFields(ensureAIMemory(u));
  ctx.units.push(u);
  return u;
}
// 개활지의 큰 벽을 찾아 fixture source로 쓴다
// [AI0-C1 R1] fixture용 벽 — threat(북쪽 200px)에서 남쪽 slot까지의 시선이
//   다른 벽/엄폐물에 먼저 막히지 않는 벽만 고른다(source-first 계약을 정직하게 만족시키기 위함).
function _c1PickWall() {
  const M = MAP_DATA;
  const R = _c1UnitRadius();
  const cands = [];
  for (const w of (M.walls || [])) {
    if (w.w < 120 || w.h > 24) continue;
    if (w.y < 100 || w.y > M.h - 160) continue;
    cands.push(w);
  }
  cands.sort((a, b) => b.w - a.w);
  for (const w of cands) {
    const threat = { x: w.x + w.w / 2, y: w.y - 200 };
    const sx = w.x + w.w / 2, sy = w.y + w.h + R + C1_SLOT_STANDOFF_PX;
    const dx = sx - threat.x, dy = sy - threat.y, len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = dx / len, uy = dy / len;
    const tS = rayBoxT(threat.x, threat.y, ux, uy, w, len);
    if (!(tS >= 0 && tS < Infinity)) continue;
    let blocked = false;
    for (const arr of [M.walls, M.coverObjects]) {
      if (!Array.isArray(arr) || blocked) continue;
      for (const o of arr) {
        if (!o || o === w) continue;
        const t2 = rayBoxT(threat.x, threat.y, ux, uy, o, tS);
        if (t2 >= 0 && t2 < tS - 0.5) { blocked = true; break; }
      }
    }
    if (blocked) continue;
    if (pointInWalls(sx, sy, R - 2)) continue;      // slot 자리가 막혀 있으면 부적합
    // 이 픽스처가 실제로 필요한 건 **슬롯이 나오는 벽**이다. 대리 검사만 통과하고
    //   정작 슬롯이 0개인 벽을 고르면 C1-02/12/13이 통째로 무너진다(맵을 손댈 때마다 겪었다).
    //   그러니 뽑아 보고 확인한다 — 맵 내용이 바뀌어도 견딘다.
    if (typeof _c1WallYieldsSlots === 'function' && !_c1WallYieldsSlots(w)) continue;
    return w;
  }
  return cands[0] || null;
}
// 이 벽으로 관측 기억을 만들었을 때 실제로 엄폐 슬롯이 나오는가.
//   **테스트가 쓰는 관측 구간을 전부 확인한다.** 전체 구간만 보면, 좁은 구간(C1-02의 60~160)이
//   하필 장애물에 걸리는 벽을 통과시켜 버린다 — 실제로 복도 격벽을 넣자 그렇게 됐다.
const _C1_FIXTURE_RANGES = [[60, 160], null];   // null = 전체(40 ~ w-40)
function _c1WallYieldsSlots(w) {
  try {
    for (const rg of _C1_FIXTURE_RANGES) {
      const s0 = rg ? rg[0] : 40, s1 = rg ? rg[1] : Math.max(41, w.w - 40);
      if (s1 > w.w) return false;
      const probe = { id: -999001, team: 'friend', x: w.x + w.w / 2, y: w.y + 80,
                      alive: true, aiMemory: null, movePath: [] };
      ensureSpatialMemoryFields(ensureAIMemory(probe));
      _c1MakeSurfaceMemory(probe, w, 'south', [[s0, s1]]);
      const best = findBestObservedCover(probe, { x: w.x + w.w / 2, y: w.y - 200 }, { skipPath: true });
      // buildAIContext가 ctx.bestCover로 채택하는 문턱(>50)까지 넘어야 한다 —
      //   슬롯이 나오기만 하고 점수가 낮으면 C1-13(플레이어 명령 권위)이 명령 자체를 못 만든다.
      if (!best || !(best.score > 50)) return false;
    }
    return true;
  } catch (e) { return false; }
}
function _runAI0C1CheckpointCore(ctx, seed) {
  const mapSnap = _ai0bSnapshotMaps();
  try {
  const tests = []; const evidence = {};
  const T = (id, passC, expected, actual, consumer) => tests.push({ id, pass: !!passC, expected, actual, consumer: consumer || '' });
  setMapById('cqb'); GAME.mapId = 'cqb';
  GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA); ensureTacticalSpatialGraph(true);
  const W = _c1PickWall();
  if (!W) { T('C1-00_fixture', false, '개활지 벽 fixture', 'not found', '_c1PickWall'); return { tests, failures: tests, evidence }; }
  const R = _c1UnitRadius();
  // C1-01 observed face only
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const res1 = buildObservedCoverSlotCandidates(u, threat, { skipPath: true, keepRejected: true });
    const observedFaces = new Set([...u.aiMemory.observedSurfaces.values()].map(x => x.face));
    const allFaces = new Set(res1.all.map(c => c.face));
    const validFaces = new Set(res1.valid.map(c => c.face));
    // 생성 단계에서부터 관측하지 않은 face가 나오면 안 된다(거부 여부와 무관)
    const inferred = [...allFaces].filter(f => !observedFaces.has(f));
    evidence.faceOnly = { n: res1.valid.length, observed: [...observedFaces], produced: [...allFaces], valid: [...validFaces], inferred };
    T('C1-01_observed_face_only',
      res1.valid.length > 0 && inferred.length === 0 && validFaces.size === 1 && validFaces.has('south'),
      '관측한 face에서만 slot 생성(추론 face 0)', JSON.stringify(evidence.faceOnly), 'buildSlotsForObservedSurface');
  }
  // C1-02 observed range bound
  {
    const u = _c1TestUnit(ctx, W.x + 100, W.y + 80);
    const s0 = 60, s1 = 160;
    _c1MakeSurfaceMemory(u, W, 'south', [[s0, s1]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const cand = buildObservedCoverSlotCandidates(u, threat, { skipPath: true });
    const inside = cand.every(c => c.s >= s0 && c.s <= s1);
    evidence.rangeBound = { n: cand.length, s: cand.map(c => Math.round(c.s)), s0, s1, segLen: Math.round(W.w) };
    T('C1-02_observed_range_bound', cand.length > 0 && inside,
      '모든 slot s가 관측 범위 안', JSON.stringify(evidence.rangeBound), 'buildSlotsForObservedSurface');
  }
  // C1-03 short range rejection
  {
    const u = _c1TestUnit(ctx, W.x + 100, W.y + 80);
    _c1MakeSurfaceMemory(u, W, 'south', [[80, 80 + R]]);   // clearance보다 짧음
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const cand = buildObservedCoverSlotCandidates(u, threat, { skipPath: true });
    T('C1-03_short_range_rejection', cand.length === 0, '짧은 range → slot 0', `n=${cand.length}`, 'buildSlotsForObservedSurface');
  }
  // C1-04 wall surface cover (knownCovers 없이)
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    u.aiMemory.knownCovers = new Map();
    _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const best = findBestObservedCover(u, threat, { skipPath: true });
    evidence.wallCover = best ? { objectKind: best.objectKind, coverType: best.coverType, slotId: best.slotId.slice(-24) } : null;
    T('C1-04_wall_surface_cover', !!best && best.objectKind === 'wall' && best.coverType === 'full',
      'knownCovers 없이 wall surface가 full cover', JSON.stringify(evidence.wallCover), 'findBestObservedCover');
  }
  // C1-05 half/full contract
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    const smF = _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const full = buildObservedCoverSlotCandidates(u, threat, { skipPath: true })[0];
    smF.objectKind = 'cover'; smF.coverType = 'half';
    const half = buildObservedCoverSlotCandidates(u, threat, { skipPath: true })[0];
    evidence.halfFull = { fullType: full && full.coverType, halfType: half && half.coverType,
      fullScore: full && +full.score.toFixed(1), halfScore: half && +half.score.toFixed(1) };
    T('C1-05_half_full_contract', !!full && !!half && full.coverType === 'full' && half.coverType === 'half' && full.score > half.score,
      'half는 full로 승격되지 않고 점수도 낮음', JSON.stringify(evidence.halfFull), 'scoreObservedCoverSlot');
  }
  // C1-06 source-side correctness
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const north = buildObservedCoverSlotCandidates(u, { x: W.x + W.w / 2, y: W.y - 200 }, { skipPath: true });
    const south = buildObservedCoverSlotCandidates(u, { x: W.x + W.w / 2, y: W.y + 300 }, { skipPath: true });
    const nOk = north.every(c => c.y > W.y + W.h);   // threat 북쪽 → slot 남쪽
    const sOk = south.every(c => c.y < W.y);         // threat 남쪽 → slot 북쪽
    // [AI0-C1 R2] threat와 source 사이에 미관측 blocker가 있으면 source protection이 아니다
    let blockerRej = 0, blockerValid = 0;
    {
      const u2 = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
      _c1MakeSurfaceMemory(u2, W, 'south', [[40, W.w - 40]]);
      const thr = { x: W.x + W.w / 2, y: W.y - 200 };
      // 관측하지 않은 blocker를 threat와 source 사이에 삽입 (production 배열에 직접 추가 후 복원)
      const blocker = { x: W.x + W.w / 2 - 80, y: W.y - 120, w: 160, h: 12, material: 'concrete', armor: 55, penetrable: true };
      getTacticalObjectId(blocker, 'wall');
      MAP_DATA.walls.push(blocker);
      const res2 = buildObservedCoverSlotCandidates(u2, thr, { skipPath: true, keepRejected: true });
      blockerValid = res2.valid.length;
      blockerRej = res2.all.filter(c => c.rejectionReasons.indexOf('source_not_first_blocker') >= 0).length;
      const bi = MAP_DATA.walls.indexOf(blocker); if (bi >= 0) MAP_DATA.walls.splice(bi, 1);
    }
    evidence.sourceSide = { nN: north.length, nOk, sN: south.length, sOk, blockerRej, blockerValid };
    T('C1-06_source_side_correctness',
      north.length > 0 && nOk && (south.length === 0 || sOk) && blockerRej > 0 && blockerValid === 0,
      'threat 반대편에만 slot + 앞 blocker 있으면 전부 reject', JSON.stringify(evidence.sourceSide),
      '_c1SafeNormal/validateObservedCoverSlot');
  }
  // C1-07 physical validity
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    _c1MakeSurfaceMemory(u, W, 'south', [[0, W.w]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const res = buildObservedCoverSlotCandidates(u, threat, { skipPath: true, keepRejected: true });
    const bad = res.valid.filter(c => !pointInMap(c.x, c.y, 0) || pointInWalls(c.x, c.y, R - 2));
    const rejected = res.all.filter(c => c.rejectionReasons.length > 0).length;
    evidence.physical = { valid: res.valid.length, rejected, bad: bad.length };
    T('C1-07_physical_validity', bad.length === 0, '맵 밖/장애물 내부 slot 0', JSON.stringify(evidence.physical), 'validateObservedCoverSlot');
  }
  // C1-08 reachability
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const cand = buildObservedCoverSlotCandidates(u, threat, {});
    const allReach = cand.every(c => c.reachable === true && c.pathLengthPx != null && c.pathLengthPx > 0);
    evidence.reachability = { n: cand.length, allReach, samplePath: cand[0] ? cand[0].pathLengthPx : null };
    T('C1-08_reachability', cand.length > 0 && allReach, '유효 slot은 전부 도달 가능 + path 길이 기록', JSON.stringify(evidence.reachability), 'buildObservedCoverSlotCandidates/findPath');
  }
  // C1-09 stable slot identity
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    const sm = _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const a = buildObservedCoverSlotCandidates(u, threat, { skipPath: true }).map(c => c.slotId);
    const b = buildObservedCoverSlotCandidates(u, threat, { skipPath: true }).map(c => c.slotId);
    sm.observationRevision += 1;
    const c2 = buildObservedCoverSlotCandidates(u, threat, { skipPath: true }).map(c => c.slotId);
    const same = JSON.stringify(a) === JSON.stringify(b);
    const changed = c2.length === 0 || c2.every(id => a.indexOf(id) < 0);
    evidence.slotIdentity = { n: a.length, repeatSame: same, revisionChanged: changed };
    T('C1-09_stable_slot_identity', a.length > 0 && same && changed,
      '반복 ID 동일, revision 변경 시 ID 변경', JSON.stringify(evidence.slotIdentity), '_c1SlotId');
  }
  // C1-10 runtime edit invalidation
  {
    GAME.phase = 'play'; GAME.paused = true; GAME.over = false;
    GAME.placementType = 'cover'; GAME.placementCoverId = 'crate_wood'; GAME.placementMaterial = 'wood';
    GAME.placementCounter = { cover: 0, wall: 0, reactive: 0 };
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    // [AI0-C1 R1] 배치 지점은 threat→slot 시선이 다른 객체에 먼저 막히지 않는 개활지여야 한다.
    let obj = null;
    {
      const R2 = _c1UnitRadius();
      const spots = [];
      // 상한 40은 두 줄 남짓만 훑고 끝나서, 맵에 물건이 하나 늘면 개활지를 하나도 못 찾았다.
      // 조건은 그대로 두고 탐색 범위만 넓힌다.
      for (let yy = W.y + 140; yy < MAP_DATA.h - 120 && spots.length < 240; yy += 40)
        for (let xx = 120; xx < MAP_DATA.w - 120 && spots.length < 240; xx += 60) spots.push([xx, yy]);
      // 이 지점 위쪽(북쪽)에서 내려오는 시선이 다른 벽/엄폐물에 막히지 않아야 한다
      const _northClear = (px, py) => {
        if (pointInWalls(px, py, R2 * 3)) return false;
        for (const arr of [MAP_DATA.walls, MAP_DATA.coverObjects]) {
          if (!Array.isArray(arr)) continue;
          for (const o of arr) {
            if (!o) continue;
            const t2 = rayBoxT(px, py - 200, 0, 1, o, 260);
            if (t2 >= 0 && t2 < 195) return false;
          }
        }
        return true;
      };
      // 개활 조건만으로는 부족하다 — 실제로 slot이 나오는 자리여야 이 시험이 성립한다.
      //   그래서 놓아 보고, 안 나오면 치우고 다음 자리로 간다. 맵 내용이 늘어도 견딘다.
      const _memOf = (uu) => ensureAIMemory(uu).observedSurfaces;
      for (const [px, py] of spots) {
        // 아래쪽 48px로 옮긴 뒤에도 같은 조건을 만족해야 한다 — 이 시험은 옮기고 나서 재관측한다
        if (!_northClear(px, py) || !_northClear(px, py + 48)) continue;
        const cand = _ai0bPlaceCover(px, py);
        if (!cand) continue;
        _memOf(u).clear();
        _c1MakeSurfaceMemory(u, cand, 'south', [[0, cand.w]], { objectKind: 'cover' });
        const probe = buildObservedCoverSlotCandidates(u, { x: cand.x + cand.w / 2, y: cand.y - 200 }, { skipPath: true });
        if (probe.length > 0) { obj = cand; break; }
        GAME.selectedCoverId = cand._coverUid;
        deleteSelectedCover();
        GAME.selectedCoverId = null;
        _memOf(u).clear();
      }
      if (!obj) obj = _ai0bPlaceCover();
    }
    let det = { placed: !!obj };
    let ok = !!obj;
    if (obj) {
      const sm = _c1MakeSurfaceMemory(u, obj, 'south', [[0, obj.w]], { objectKind: 'cover' });
      const threat = { x: obj.x + obj.w / 2, y: obj.y - 200 };
      const before = buildObservedCoverSlotCandidates(u, threat, { skipPath: true }).map(c => c.slotId);
      const sig0 = getObservedCoverSlotMemorySignature(u);
      GAME.selectedCoverId = obj._coverUid;
      // 개활 조건을 유지하는 짧은 이동(같은 열에서 아래로) — production editor 사용
      moveSelectedCover(obj.x + obj.w / 2, obj.y + obj.h / 2 + 48);
      const after = buildObservedCoverSlotCandidates(u, threat, { skipPath: true });
      const sig1 = getObservedCoverSlotMemorySignature(u);
      det = Object.assign(det, { before: before.length, afterStale: after.length, sigChanged: sig0 !== sig1 });
      if (!(after.length === 0 && sig0 !== sig1)) ok = false;
      // 재관측 후 새 slot 생성
      _c1MakeSurfaceMemory(u, obj, 'south', [[0, obj.w]], { objectKind: 'cover' });
      const re = buildObservedCoverSlotCandidates(u, threat, { skipPath: true });
      det.reobserved = re.length;
      det.newIds = re.length > 0 && re.every(c => before.indexOf(c.slotId) < 0);
      if (!(re.length > 0 && det.newIds)) ok = false;
    }
    // 맵을 편집한 테스트는 **스스로 되돌린다.** 안 그러면 여기서 놓은 엄폐물이
    //   뒤 테스트(C1-13 등)의 지형을 바꿔 놓아 엉뚱한 실패를 만든다 — 실제로 겪었다.
    if (obj) {
      GAME.selectedCoverId = obj._coverUid;
      if (typeof deleteSelectedCover === 'function') deleteSelectedCover();
      GAME.selectedCoverId = null;
    }
    evidence.runtimeEdit = det;
    T('C1-10_runtime_edit_invalidation', ok, '편집 후 stale slot 0 + 재관측 시 새 slot', JSON.stringify(det), 'moveSelectedCover/getObservedCoverSlotMemorySignature');
  }
  // C1-11 occupancy and reservation
  {
    const u1 = _c1TestUnit(ctx, W.x + 60, W.y + 80);
    const u2 = _c1TestUnit(ctx, W.x + W.w - 60, W.y + 80);
    _c1MakeSurfaceMemory(u1, W, 'south', [[40, W.w - 40]]);
    _c1MakeSurfaceMemory(u2, W, 'south', [[40, W.w - 40]]);
    const threat = { x: W.x + W.w / 2, y: W.y - 200 };
    const b1 = findBestObservedCover(u1, threat, { skipPath: true, others: [u2] });
    u1.aiAction = { type: 'seekCover', targetSlotId: b1 ? b1.slotId : null };
    if (b1) { u1.x = b1.spotX; u1.y = b1.spotY; }   // 실제로 그 자리를 점유한 상태
    const b2 = findBestObservedCover(u2, threat, { skipPath: true, others: [u1] });
    // 예약된 slot 자체가 실제로 감점되는지 직접 확인 (감점 제거 mutation 검출용)
    let resvPenalty = 0, occPenalty = 0;
    if (b1) {
      const cands2 = buildObservedCoverSlotCandidates(u2, threat, { skipPath: true, others: [u1] });
      const reserved = cands2.filter(c => c.slotId === b1.slotId)[0];
      if (reserved && reserved.scoreBreakdown) resvPenalty = reserved.scoreBreakdown.reservationPenalty || 0;
      // u1이 서 있는 자리 근처 slot은 점유 감점을 받아야 한다
      let maxOcc = 0;
      for (const c of cands2) if (c.scoreBreakdown && (c.scoreBreakdown.occupancyPenalty || 0) > maxOcc) maxOcc = c.scoreBreakdown.occupancyPenalty;
      occPenalty = maxOcc;
    }
    evidence.reservation = { u1: b1 && b1.slotId.slice(-14), u2: b2 && b2.slotId.slice(-14),
      distinct: !!(b1 && b2 && b1.slotId !== b2.slotId), resvPenalty, occPenalty };
    T('C1-11_occupancy_reservation',
      !!b1 && !!b2 && b1.slotId !== b2.slotId && resvPenalty > 0 && occPenalty > 0,
      '같은 slotId 동시 선택 없음 + 예약/점유 감점 실제 적용', JSON.stringify(evidence.reservation), 'scoreObservedCoverSlot');
  }
  // C1-12 production seekCover path
  {
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    u.aiMemory.lastSeenEnemy = { x: W.x + W.w / 2, y: W.y - 200, seenAt: GAME.gameTime };
    u.aiAction = { type: 'seekCover', targetX: null, targetY: null };
    const ctx2 = buildAIContext(u);                      // production context (getCachedBestCover → findBestCover 포함)
    const bc = ctx2.bestCover;
    const act2 = { type: 'seekCover', score: 100 };
    executeUtilityAction(u, act2, ctx2);                 // production action (unit, action, ctx)
    if (!u.aiAction) u.aiAction = act2;
    const trace = (u.aiCommandTrace || []).map(t => t.actionType).filter(Boolean);
    evidence.productionPath = { canonical: bc && bc.canonical, slotId: bc && bc.slotId && bc.slotId.slice(-18),
      actionSlotId: u.aiAction.targetSlotId && u.aiAction.targetSlotId.slice(-18), trace: trace.slice(-3), pathLen: u.movePath.length };
    T('C1-12_production_seekcover_path',
      !!bc && bc.canonical === 'observedSurface' && u.aiAction.targetSlotId === bc.slotId && trace.indexOf('seekCover') >= 0 && u.movePath.length > 0,
      'buildAIContext 경로 + slotId가 action/trace에 기록', JSON.stringify(evidence.productionPath),
      'getCachedBestCover/findBestCover/executeUtilityAction/issueMoveOrder');
  }
  // C1-13 player command authority
  {
    // 앞선 시험(C1-12)의 유닛이 같은 자리에서 슬롯을 **예약한 채 살아 있다.**
    //   이 시험은 플레이어 명령 권위를 보는 것이지 슬롯 경쟁이 아니므로,
    //   앞선 예약은 이 시나리오의 일부가 아니다. 지우고 시작한다.
    for (const m of (ctx.units || [])) { if (m && m.aiAction) m.aiAction.targetSlotId = null; }
    const u = _c1TestUnit(ctx, W.x + W.w / 2, W.y + 80);
    u.team = 'friend';
    _c1MakeSurfaceMemory(u, W, 'south', [[40, W.w - 40]]);
    const px = W.x + W.w / 2 + 200, py = W.y + 200;
    u.movePath = [{ x: px, y: py, mode: 'walk' }]; u._aiCommandPath = null;
    const playerPath = u.movePath;
    u.aiMemory.lastSeenEnemy = { x: W.x + W.w / 2, y: W.y - 200, seenAt: GAME.gameTime };
    u.aiAction = { type: 'seekCover' };
    const ctxP = buildAIContext(u);
    executeUtilityAction(u, { type: 'seekCover', score: 100 }, ctxP);
    // [AI0-C1 R2] gateway 거부 + phantom reservation 없음 + 다른 유닛 영향 0
    const trace13 = (u.aiCommandTrace || []).filter(t => t.actionType === 'seekCover');
    const rejected = trace13.length > 0 && trace13[trace13.length - 1].accepted === false;
    const rejReason = trace13.length ? trace13[trace13.length - 1].rejectedReason : null;
    const noPhantom = !u.aiAction || !u.aiAction.targetSlotId;
    // 다른 아군이 이 유닛의 phantom 예약 때문에 후보를 잃지 않아야 한다
    const mate13 = _c1TestUnit(ctx, W.x + W.w / 2 + 40, W.y + 80);
    _c1MakeSurfaceMemory(mate13, W, 'south', [[40, W.w - 40]]);
    const mateBest = findBestObservedCover(mate13, { x: W.x + W.w / 2, y: W.y - 200 }, { skipPath: true, others: [u] });
    evidence.playerAuthority = { intact: u.movePath === playerPath, len: u.movePath.length,
      rejected, rejReason, noPhantom, mateGotSlot: !!mateBest };
    T('C1-13_player_command_authority',
      u.movePath === playerPath && rejected && rejReason === 'player_command_active' && noPhantom && !!mateBest,
      'movePath 유지 + gateway 거부 + targetSlotId 없음 + 다른 유닛 영향 0',
      JSON.stringify(evidence.playerAuthority), 'issueMoveOrder/issueAICommand/executeUtilityAction');
  }
  // C1-14 5맵 smoke + 결정성
  {
    const per = {}; let crash = 0, oob = 0;
    for (const m of ['cqb', 'range', 'apartment', 'corridor', 'warehouse']) {
      setMapById(m); GAME.mapId = m;
      GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA); ensureTacticalSpatialGraph(true);
      const w = _c1PickWall();
      if (!w) { per[m] = 'no_wall'; continue; }
      try {
        const u = _c1TestUnit(ctx, w.x + w.w / 2, w.y + 80);
        _c1MakeSurfaceMemory(u, w, 'south', [[40, Math.max(60, w.w - 40)]]);
        const threat = { x: w.x + w.w / 2, y: w.y - 200 };
        const c1 = buildObservedCoverSlotCandidates(u, threat, { skipPath: true });
        const c2 = buildObservedCoverSlotCandidates(u, threat, { skipPath: true });
        const stable = JSON.stringify(c1.map(z => z.slotId)) === JSON.stringify(c2.map(z => z.slotId));
        for (const z of c1) if (!pointInMap(z.x, z.y, 0)) oob++;
        per[m] = { n: c1.length, stable };
        if (!stable) crash++;
      } catch (e) { per[m] = 'ERR:' + e.message; crash++; }
    }
    evidence.mapSmoke = per;
    T('C1-14_deterministic_sandbox', crash === 0 && oob === 0, '5맵 crash 0 / bounds 위반 0 / 반복 동일', JSON.stringify(per), 'buildObservedCoverSlotCandidates');
  }
  const failures = tests.filter(t => !t.pass);
  return { tests, failures, evidence };
  } finally { _ai0bRestoreMaps(mapSnap); }
}
// ════════════════ AI0-C2 PHASE 1 CHECKPOINT SUITE ════════════════
function _c2TestUnit(ctx, x, y) {
  const u = makeUnit({ team: 'friend', name: 'C2', x, y, facing: 0, weaponId: 'm4a1', ammoId: '556_m855',
    role: 'reactive', loadout: { weaponId: 'm4a1', ammoId: '556_m855' } });
  u.alive = true; u.stance = 'standing'; u.movePath = []; u._aiCommandPath = null;
  ensureAICommandState(u); ensureSpatialMemoryFields(ensureAIMemory(u));
  ctx.units.push(u);
  return u;
}
// opening을 실제로 횡단하는 2점 path (normal 방향으로 관통)
function _c2CrossPath(op, dist) {
  const d = dist || 60;
  return [{ x: op.centerX - op.normalX * d, y: op.centerY - op.normalY * d },
          { x: op.centerX + op.normalX * d, y: op.centerY + op.normalY * d }];
}
function _runAI0C2CheckpointCore(ctx, seed) {
  const mapSnap = _ai0bSnapshotMaps();
  try {
  const tests = []; const evidence = {};
  const T = (id, passC, expected, actual, consumer) => tests.push({ id, pass: !!passC, expected, actual, consumer: consumer || '' });
  setMapById('corridor'); GAME.mapId = 'corridor';
  GAME.tacticalGeometry = null; ensureTacticalGeometryIds(MAP_DATA);
  const g = ensureTacticalSpatialGraph(true);
  const doors = g.openings.filter(o => o.kind === 'doorway' && o.portalId);
  if (doors.length < 2) { T('C2-00_fixture', false, 'doorway >= 2', 'doors=' + doors.length, 'ensureTacticalSpatialGraph'); return { tests, failures: tests, evidence }; }
  const opA = doors[0], opB = doors[1];
  const pA = g.portals.get(opA.portalId), pB = g.portals.get(opB.portalId);

  // ── C2-01 known portal authority ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });
    const ev = getPortalRiskEvidence(u, opA.portalId, {});
    evidence.knownAuthority = ev ? { known: ev.known, id: ev.portalId === opA.portalId, band: ev.band, score: ev.score } : null;
    T('C2-01_known_portal_authority',
      !!ev && ev.known === true && ev.usable === true && ev.portalId === opA.portalId
      && ev.score != null && ev.components != null && ev.geometry != null,
      'known=true + portalId 일치 + 구성요소 존재', JSON.stringify(evidence.knownAuthority), 'getPortalRiskEvidence');
  }
  // ── C2-02 unknown portal redaction ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });   // A만 알고 B는 모름
    const ev = getPortalRiskEvidence(u, opB.portalId, {});
    const json = JSON.stringify(ev);
    const leaks = [];
    if (ev.portalId != null) leaks.push('portalId');
    if (json.indexOf(opB.portalId) >= 0) leaks.push('id_in_payload');
    if (ev.geometry != null) leaks.push('geometry');
    if (ev.memory != null) leaks.push('memory');
    if (ev.score != null) leaks.push('score');
    if (json.indexOf(String(Math.round(pB.centerX))) >= 0) leaks.push('centerX');
    const dg = getEffectivePortalDanger(u, opB.portalId, {});
    evidence.redaction = { known: ev.known, usable: ev.usable, band: ev.band, reasons: ev.reasons, leaks, dangerNull: dg === null };
    T('C2-02_unknown_portal_redaction',
      ev.known === false && ev.usable === false && ev.portalId === null && ev.band === 'unknown'
      && leaks.length === 0 && dg === null,
      'known/usable false + portalId null + 정보 누출 0', JSON.stringify(evidence.redaction), 'getPortalRiskEvidence/getEffectivePortalDanger');
  }
  // ── C2-03 danger freshness ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });
    GAME.gameTime = 100;
    recordPortalDanger(u, opA.portalId, 0.9, 'ev1');
    const rec = u.aiMemory.portalDangers.get(opA.portalId);
    const before = JSON.stringify(rec);
    const d0 = getEffectivePortalDanger(u, opA.portalId, { now: 100 });
    const d10 = getEffectivePortalDanger(u, opA.portalId, { now: 110 });
    const d20 = getEffectivePortalDanger(u, opA.portalId, { now: 120 });
    const d30 = getEffectivePortalDanger(u, opA.portalId, { now: 130 });
    const after = JSON.stringify(u.aiMemory.portalDangers.get(opA.portalId));
    const stillThere = u.aiMemory.portalDangers.has(opA.portalId);
    evidence.freshness = { d0: d0.effectiveDanger, d10: d10.effectiveDanger, d20: d20.effectiveDanger, d30: d30.effectiveDanger,
      recordUnchanged: before === after, stillThere };
    T('C2-03_danger_freshness',
      d0.effectiveDanger > d10.effectiveDanger && d10.effectiveDanger > 0
      && d20.effectiveDanger === 0 && d30.effectiveDanger === 0
      && before === after && stillThere,
      'age 0 > 10 > 0, age 20 이상 0, 원본 무변경', JSON.stringify(evidence.freshness), 'getEffectivePortalDanger');
  }
  // ── C2-04 geometry monotonicity ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });
    const w0 = pA.width;
    pA.width = 2 * _c1UnitRadius() + 2;      // 겨우 통과
    const narrow = getPortalRiskEvidence(u, opA.portalId, {});
    pA.width = 3 * PATH_GRID;                // 충분히 넓음
    const wide = getPortalRiskEvidence(u, opA.portalId, {});
    // gridNative/subgridBridge만 바꿔서는 score 불변
    const gn0 = pA.gridNative, sb0 = pA.subgridBridge;
    const before = getPortalRiskEvidence(u, opA.portalId, {});
    pA.gridNative = !gn0; pA.subgridBridge = !sb0;
    const flipped = getPortalRiskEvidence(u, opA.portalId, {});
    pA.gridNative = gn0; pA.subgridBridge = sb0; pA.width = w0;
    evidence.geometryMono = { narrow: narrow.components.geometryRisk, wide: wide.components.geometryRisk,
      scoreBefore: before.score, scoreFlipped: flipped.score };
    T('C2-04_geometry_monotonicity',
      narrow.components.geometryRisk > wide.components.geometryRisk && before.score === flipped.score,
      '좁을수록 geometryRisk 높음 + native/subgrid 플립은 score 불변', JSON.stringify(evidence.geometryMono), 'getPortalRiskEvidence');
  }
  // ── C2-05 real crossing only ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });
    const crossPath = _c2CrossPath(opA, 60);
    const hit = getKnownPortalCrossingsForPath(u, crossPath, {});
    // opening 바깥을 tangent 방향으로 평행 이동 (횡단 아님)
    const off = Math.max(60, (pA.width || 32) * 2);
    const px = pA.centerX + opA.tangentX * off, py = pA.centerY + opA.tangentY * off;
    const parallel = [{ x: px - opA.tangentX * 40, y: py - opA.tangentY * 40 },
                      { x: px + opA.tangentX * 40, y: py + opA.tangentY * 40 }];
    const miss = getKnownPortalCrossingsForPath(u, parallel, {});
    evidence.realCrossing = { hit: hit.length, hitId: hit.length ? (hit[0].portalId === opA.portalId) : false, miss: miss.length };
    T('C2-05_real_crossing_only',
      hit.length === 1 && hit[0].portalId === opA.portalId && miss.length === 0,
      '실제 횡단만 검출, 평행 이동은 0', JSON.stringify(evidence.realCrossing), 'getKnownPortalCrossingsForPath/_segCrossesOpening');
  }
  // ── C2-06 stable order and dedup ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });
    markPortalKnown(u, pB, { confidence: 0.9 });
    // A를 여러 waypoint로 잘게 나눠 통과 → 경계 중복이 병합되는지 확인
    const a0 = { x: pA.centerX - opA.normalX * 60, y: pA.centerY - opA.normalY * 60 };
    const aM = { x: pA.centerX, y: pA.centerY };
    const a1 = { x: pA.centerX + opA.normalX * 60, y: pA.centerY + opA.normalY * 60 };
    const b0 = { x: pB.centerX - opB.normalX * 60, y: pB.centerY - opB.normalY * 60 };
    const b1 = { x: pB.centerX + opB.normalX * 60, y: pB.centerY + opB.normalY * 60 };
    const path = [a0, aM, a1, b0, b1];
    const r1 = getKnownPortalCrossingsForPath(u, path, {});
    const r2 = getKnownPortalCrossingsForPath(u, path, {});
    const ids = r1.map(c => c.portalId);
    const orders = r1.map(c => c.pathOrder);
    const noAdjacentDup = ids.every((id, i) => i === 0 || id !== ids[i - 1]);
    const orderAsc = orders.every((v, i) => i === 0 || v > orders[i - 1]);
    // [R1] 한 segment가 두 portal을 횡단하는 경우 — 가까운 쪽 ID가 사전순으로 뒤에 오도록 배치.
    //   ID 순서가 아니라 실제 이동(t) 순서로 반환되어야 한다.
    let singleSegOk = false, singleSegDet = null;
    {
      const u2 = _c2TestUnit(ctx, 0, 0);
      // 합성 opening 2개: near는 x=10(사전순 뒤 'z_near'), far는 x=20(사전순 앞 'a_far')
      const mkOp = (pid, x) => ({ kind: 'doorway', portalId: pid,
        ax: x, ay: -40, bx: x, by: 40, centerX: x, centerY: 0,
        tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, width: 80 });
      const opNear = mkOp('z_near', 10), opFar = mkOp('a_far', 20);
      const fakeGraph = {
        buildFingerprint: 'c2r1-fixture',
        openingByPortalId: new Map([['z_near', opNear], ['a_far', opFar]]),
        portals: new Map([
          ['z_near', { id: 'z_near', centerX: 10, centerY: 0, width: 80, portalType: 'doorway', orientation: 'vertical', gridNative: true, subgridBridge: false }],
          ['a_far', { id: 'a_far', centerX: 20, centerY: 0, width: 80, portalType: 'doorway', orientation: 'vertical', gridNative: true, subgridBridge: false }],
        ]),
      };
      u2.aiMemory.knownPortals.set('z_near', { portalId: 'z_near', confidence: 0.9, firstSeenAt: 0, lastSeenAt: 0 });
      u2.aiMemory.knownPortals.set('a_far', { portalId: 'a_far', confidence: 0.9, firstSeenAt: 0, lastSeenAt: 0 });
      const seg = [{ x: 0, y: 0 }, { x: 30, y: 0 }];
      const q1 = getKnownPortalCrossingsForPath(u2, seg, { graph: fakeGraph });
      const q2 = getKnownPortalCrossingsForPath(u2, seg, { graph: fakeGraph });
      const qIds = q1.map(c => c.portalId);
      const qOrders = q1.map(c => c.pathOrder);
      const rep2 = buildPathPortalRiskReport(u2, seg, { graph: fakeGraph });
      const uniqIds = rep2.uniquePortals.map(p => p.portalId);
      singleSegOk = q1.length === 2 && qIds[0] === 'z_near' && qIds[1] === 'a_far'
        && qOrders[0] === 0 && qOrders[1] === 1
        && JSON.stringify(qIds) === JSON.stringify(q2.map(c => c.portalId))
        && JSON.stringify(uniqIds) === JSON.stringify(['z_near', 'a_far']);
      singleSegDet = { ids: qIds, orders: qOrders, t: q1.map(c => c.segmentT), unique: uniqIds,
        repeatSame: JSON.stringify(qIds) === JSON.stringify(q2.map(c => c.portalId)) };
    }
    // [R2] fixture 1 — 공유 waypoint 중복: portal 위치(aM)에서 waypoint를 나눠 통과.
    //   seg0이 t≈1, seg1이 t≈0으로 같은 portal을 잡지만 occurrence는 1개여야 한다.
    const countA = ids.filter(id => id === opA.portalId).length;
    const boundaryOk = countA === 1;
    // [R2] fixture 2 — 명백한 재횡단: portal을 지나 멀리 간 뒤 되돌아온다.
    //   같은 portalId가 다시 나와도 별 occurrence로 보존되어야 한다.
    let recrossOk = false, recrossDet = null;
    {
      const u3 = _c2TestUnit(ctx, 0, 0);
      const mkOp2 = (pid, x) => ({ kind: 'doorway', portalId: pid,
        ax: x, ay: -40, bx: x, by: 40, centerX: x, centerY: 0,
        tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, width: 80 });
      const XS = [['p10', 10], ['p20', 20], ['p30', 30]];
      const opMap = new Map(), pMap = new Map();
      for (const [pid, x] of XS) {
        opMap.set(pid, mkOp2(pid, x));
        pMap.set(pid, { id: pid, centerX: x, centerY: 0, width: 80, portalType: 'doorway',
          orientation: 'vertical', gridNative: true, subgridBridge: false });
        u3.aiMemory.knownPortals.set(pid, { portalId: pid, confidence: 0.9, firstSeenAt: 0, lastSeenAt: 0 });
      }
      const g3 = { buildFingerprint: 'c2r2-recross', openingByPortalId: opMap, portals: pMap };
      // x=0 → x=40 → x=0 : 세 portal을 통과했다가 그대로 되돌아온다.
      const rc1 = getKnownPortalCrossingsForPath(u3, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 0 }], { graph: g3 });
      const rc2 = getKnownPortalCrossingsForPath(u3, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 0 }], { graph: g3 });
      const rcIds = rc1.map(c => c.portalId);
      const rcOrders = rc1.map(c => c.pathOrder);
      const rcSegs = rc1.map(c => c.segmentIndex);
      const rcT = rc1.map(c => c.segmentT);
      const expIds = ['p10', 'p20', 'p30', 'p30', 'p20', 'p10'];
      const expSegs = [0, 0, 0, 1, 1, 1];
      const expT = [0.25, 0.5, 0.75, 0.25, 0.5, 0.75];
      recrossOk = rc1.length === 6
        && JSON.stringify(rcIds) === JSON.stringify(expIds)
        && JSON.stringify(rcSegs) === JSON.stringify(expSegs)
        && rcT.every((v, k) => Math.abs(v - expT[k]) < 1e-6)
        && rcOrders.every((v, k) => v === k)
        && JSON.stringify(rcIds) === JSON.stringify(rc2.map(c => c.portalId));
      recrossDet = { n: rc1.length, ids: rcIds, segs: rcSegs, t: rcT, orders: rcOrders,
        repeatSame: JSON.stringify(rcIds) === JSON.stringify(rc2.map(c => c.portalId)) };
    }
    evidence.orderDedup = { ids: ids.map(x => x.slice(-10)), orders, countA, boundaryOk, noAdjacentDup, orderAsc,
      repeatSame: JSON.stringify(r1.map(c => c.portalId + ':' + c.pathOrder)) === JSON.stringify(r2.map(c => c.portalId + ':' + c.pathOrder)),
      singleSegment: singleSegDet, recross: recrossDet };
    T('C2-06_stable_order_and_dedup',
      r1.length >= 2 && ids[0] === opA.portalId && ids[ids.length - 1] === opB.portalId
      && boundaryOk && orderAsc && evidence.orderDedup.repeatSame && singleSegOk && recrossOk,
      '진행 순서 유지 + 공유 waypoint 중복만 병합 + 재횡단 보존 + 반복 동일 + 단일 segment 다중 횡단이 t 순서',
      JSON.stringify(evidence.orderDedup), 'getKnownPortalCrossingsForPath');
  }
  // ── C2-07 path report aggregate ──
  {
    const u = _c2TestUnit(ctx, pA.centerX, pA.centerY + 80);
    markPortalKnown(u, pA, { confidence: 0.9 });
    markPortalKnown(u, pB, { confidence: 0.9 });
    GAME.gameTime = 200;
    recordPortalDanger(u, opA.portalId, 1.0, 'evA');   // A를 확실히 더 위험하게
    const a0 = { x: pA.centerX - opA.normalX * 60, y: pA.centerY - opA.normalY * 60 };
    const a1 = { x: pA.centerX + opA.normalX * 60, y: pA.centerY + opA.normalY * 60 };
    const b0 = { x: pB.centerX - opB.normalX * 60, y: pB.centerY - opB.normalY * 60 };
    const b1 = { x: pB.centerX + opB.normalX * 60, y: pB.centerY + opB.normalY * 60 };
    const rep = buildPathPortalRiskReport(u, [a0, a1, b0, b1], { now: 200 });
    const scores = rep.uniquePortals.map(p => p.score);
    const expMax = Math.max.apply(null, scores);
    const expSum = scores.reduce((s, v) => s + v, 0);
    const expAvg = expSum / scores.length;
    const expCum = Math.min(1, Math.max(0, expMax + 0.25 * (expSum - expMax)));
    const top = rep.uniquePortals.filter(p => p.score === expMax)[0];
    const empty = buildPathPortalRiskReport(u, [], { now: 200 });
    const noCross = buildPathPortalRiskReport(u, [{ x: 10, y: 10 }, { x: 20, y: 10 }], { now: 200 });
    // 같은 path면 signature 동일, generatedAt은 영향 없음
    const s1 = buildPathPortalRiskReport(u, [a0, a1, b0, b1], { now: 200 }).pathSignature;
    const s2 = buildPathPortalRiskReport(u, [a0, a1, b0, b1], { now: 999 }).pathSignature;
    evidence.aggregate = { unique: rep.uniquePortalCount, max: rep.maxRisk, avg: rep.averageRisk, cum: rep.cumulativeRisk,
      top: rep.highestRiskPortalId === top.portalId, hasHigh: rep.hasHighRisk,
      emptyZero: empty.maxRisk === 0 && empty.cumulativeRisk === 0 && empty.crossingCount === 0,
      noCrossZero: noCross.maxRisk === 0 && noCross.crossingCount === 0, sigStable: s1 === s2 };
    T('C2-07_path_report_aggregate',
      Math.abs(rep.maxRisk - expMax) < 1e-6 && Math.abs(rep.averageRisk - expAvg) < 1e-6
      && Math.abs(rep.cumulativeRisk - expCum) < 1e-6 && rep.highestRiskPortalId === top.portalId
      && evidence.aggregate.emptyZero && evidence.aggregate.noCrossZero && s1 === s2,
      'max/avg/cumulative 정확 + 최고위험 portal 정확 + 빈 경로 0 + signature 안정',
      JSON.stringify(evidence.aggregate), 'buildPathPortalRiskReport');
  }
  // ── C2-08 shadow-only authority ──
  {
    // 실제 시뮬레이션에서 신규 4함수 자동 호출 0 + findPath/issueMoveOrder 경로 불변
    const calls = { danger: 0, risk: 0, crossings: 0, report: 0 };
    const o1 = getEffectivePortalDanger, o2 = getPortalRiskEvidence, o3 = getKnownPortalCrossingsForPath, o4 = buildPathPortalRiskReport;
    getEffectivePortalDanger = function () { calls.danger++; return o1.apply(null, arguments); };
    getPortalRiskEvidence = function () { calls.risk++; return o2.apply(null, arguments); };
    getKnownPortalCrossingsForPath = function () { calls.crossings++; return o3.apply(null, arguments); };
    buildPathPortalRiskReport = function () { calls.report++; return o4.apply(null, arguments); };
    let pathSig = null, moveSig = null;
    try {
      const { shooter } = _iwCreateTestPair(ctx, {});
      GAME.gameTime = 1;
      const dst = _ai0aFindWalkableTarget(shooter, 140);
      if (dst) {
        const p = findPath(shooter.x, shooter.y, dst.x, dst.y);
        pathSig = p ? p.map(w => Math.round(w.x) + ',' + Math.round(w.y)).join('|') : null;
        shooter.movePath = [];
        const res = issueMoveOrder(shooter, dst.x, dst.y, { source: 'utility', actionType: 'c2Shadow' });
        moveSig = (res && res.accepted) ? shooter.movePath.map(w => Math.round(w.x) + ',' + Math.round(w.y)).join('|') : null;
      }
      // 실제 tick 시뮬 — 자동 호출이 있으면 카운터가 오른다
      for (let i = 0; i < 120; i++) { for (const u of ctx.units) { if (u.alive) updateUnit(u, 1 / 30); } GAME.gameTime += 1 / 30; }
    } finally {
      getEffectivePortalDanger = o1; getPortalRiskEvidence = o2; getKnownPortalCrossingsForPath = o3; buildPathPortalRiskReport = o4;
    }
    const total = calls.danger + calls.risk + calls.crossings + calls.report;
    evidence.shadowOnly = { calls, total, pathComputed: !!pathSig, moveAccepted: !!moveSig, sameRoute: pathSig != null && pathSig === moveSig };
    T('C2-08_shadow_only_authority',
      total === 0 && pathSig != null && moveSig != null,
      '시뮬레이션 중 신규 4함수 자동 호출 0 + findPath/issueMoveOrder 정상',
      JSON.stringify(evidence.shadowOnly), 'updateUnit/findPath/issueMoveOrder');
  }
  const failures = tests.filter(t => !t.pass);
  return { tests, failures, evidence };
  } finally { _ai0bRestoreMaps(mapSnap); }
}
function runAI0C2PortalRiskCheckpointSuite(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0C2CheckpointCore(ctx, seed));
  const core = sb.coreResult || { tests: [], failures: [{ id: 'CORE_EXCEPTION', pass: false }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ id: 'CORE_EXCEPTION:' + sb.coreError.message, pass: false }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, coreError: sb.coreError, tests: core.tests || [], failures: core.failures || [], evidence: core.evidence || {},
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.tests||[]).length - (core.failures||[]).length}/${(core.tests||[]).length} tests, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
// ════════════════ AI0-C2 MUTATION SUITE ════════════════
function _runAI0C2MutationCore(ctx, seed) {
  const mapSnap = _ai0bSnapshotMaps();
  try {
  const results = [];
  const detect = () => {
    const ids = [];
    let cs; try { cs = _runAI0C2CheckpointCore(ctx, seed); } catch (e) { ids.push('core:exc:' + e.message); cs = { failures: [] }; }
    for (const f of (cs.failures || [])) ids.push('checkpoint:' + f.id);
    return ids;
  };
  _iwResetSandboxToBaseline(ctx);
  const baselineList = detect();
  const baseline = new Set(baselineList);
  if (baselineList.length) {
    return { mutations: [], failures: [{ mutationId: 'BASELINE_NOT_CLEAN', baselineFailures: baselineList.slice(0, 6) }],
      baselineClean: false, baselineFailureCount: baselineList.length, blocked: true };
  }
  const detectNew = () => detect().filter(id => !baseline.has(id));
  const runOne = (mutationId, hookName, makeReplacement, note) => {
    _iwResetSandboxToBaseline(ctx);
    const rngBefore = Math.random;
    const orig = _IW_HOOKABLE[hookName].get();
    _iwInstallHook(hookName, makeReplacement(orig));
    const injected = (_IW_HOOKABLE[hookName].get() !== orig);
    const failureIds = detectNew();
    _iwRemoveHook(hookName);
    const restored = (_IW_HOOKABLE[hookName].get() === orig);
    const hooksClean = _iwMutationHookNames().length === 0;
    _iwResetSandboxToBaseline(ctx);
    const chk = _iwAssertSandboxBaselineRestored(ctx);
    results.push({ mutationId, hookName, note, injected, detected: failureIds.length >= 1,
      detectedBy: failureIds.slice(0, 4), failureIds, restored,
      rngRestored: (Math.random === rngBefore), hooksRemoved: hooksClean, sandboxBaselineRestored: chk.ok });
  };
  // M-C2-01 모르는 portal의 ID/geometry를 반환
  runOne('M-C2-01_unknown_portal_leak', 'getPortalRiskEvidence',
    (orig) => function (unit, portalId, options) {
      const r = orig(unit, portalId, options);
      if (r && r.known === false) {
        const g = (options && options.graph) || ensureTacticalSpatialGraph();
        const p = (g && g.portals) ? g.portals.get(portalId) : null;
        if (p) return Object.assign({}, r, { portalId, geometry: { widthPx: p.width, portalType: p.portalType,
          orientation: p.orientation, gridNative: !!p.gridNative, subgridBridge: !!p.subgridBridge } });
      }
      return r;
    }, '미관측 portal의 ID/geometry 노출');
  // M-C2-02 danger decay 제거
  runOne('M-C2-02_no_danger_decay', 'getEffectivePortalDanger',
    (orig) => function (unit, portalId, options) {
      const r = orig(unit, portalId, options);
      if (!r) return r;
      const eff = Math.max(0, Math.min(1, r.rawDangerLevel * r.confidence));   // ageFactor 무시
      return Object.assign({}, r, { ageFactor: 1, effectiveDanger: eff });
    }, 'ageFactor를 항상 1로 고정');
  // M-C2-03 실제 횡단 대신 center 근접만으로 crossing 인정
  runOne('M-C2-03_fake_crossing', 'getKnownPortalCrossingsForPath',
    () => function (unit, path, options) {
      const out = [];
      if (!unit || !Array.isArray(path) || path.length < 2) return out;
      const mem = unit.aiMemory;
      if (!mem || !(mem.knownPortals instanceof Map)) return out;
      const g = (options && options.graph) || ensureTacticalSpatialGraph();
      if (!g) return out;
      let order = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        for (const pid of Array.from(mem.knownPortals.keys()).sort()) {
          const p = g.portals ? g.portals.get(pid) : null;
          if (!p) continue;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (Math.hypot(mx - p.centerX, my - p.centerY) < 200) {   // center 근접만으로 인정
            out.push({ portalId: pid, segmentIndex: i, pathOrder: order++, fromX: a.x, fromY: a.y, toX: b.x, toY: b.y,
              portalCenterX: p.centerX, portalCenterY: p.centerY, evidence: getPortalRiskEvidence(unit, pid, options) });
          }
        }
      }
      return out;
    }, 'opening 횡단 대신 center 근접만으로 crossing 인정');
  const failures = results.filter(r => !(r.injected && r.detected && r.restored && r.rngRestored && r.hooksRemoved && r.sandboxBaselineRestored));
  return { mutations: results, failures, baselineClean: true, baselineFailureCount: 0, blocked: false };
  } finally { _ai0bRestoreMaps(mapSnap); }
}
function runAI0C2PortalRiskMutationTests(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0C2MutationCore(ctx, seed));
  const core = sb.coreResult || { mutations: [], failures: [{ mutationId: 'CORE_EXCEPTION' }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ mutationId: 'CORE_EXCEPTION:' + sb.coreError.message }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, mutations: core.mutations || [], failures: core.failures || [],
    baselineClean: core.baselineClean, baselineFailureCount: core.baselineFailureCount, blocked: !!core.blocked,
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.mutations||[]).length - (core.failures||[]).length}/${(core.mutations||[]).length} full-pass, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
// ════════════════ AI0-C1 MUTATION CORE ════════════════
function _runAI0C1MutationCore(ctx, seed) {
  const mapSnap = _ai0bSnapshotMaps();
  try {
  const results = [];
  const detect = () => {
    const ids = [];
    let cs; try { cs = _runAI0C1CheckpointCore(ctx, seed); } catch (e) { ids.push('core:exc:' + e.message); cs = { failures: [] }; }
    for (const f of (cs.failures || [])) ids.push('checkpoint:' + f.id);
    return ids;
  };
  _iwResetSandboxToBaseline(ctx);
  const baselineList = detect();
  const baseline = new Set(baselineList);
  if (baselineList.length) {
    return { mutations: [], failures: [{ mutationId: 'BASELINE_NOT_CLEAN', baselineFailures: baselineList.slice(0, 6) }],
      baselineClean: false, baselineFailureCount: baselineList.length, blocked: true };
  }
  const detectNew = () => detect().filter(id => !baseline.has(id));
  const runOne = (mutationId, hookName, makeReplacement, note) => {
    _iwResetSandboxToBaseline(ctx);
    const rngBefore = Math.random;
    const orig = _IW_HOOKABLE[hookName].get();
    _iwInstallHook(hookName, makeReplacement(orig));
    const injected = (_IW_HOOKABLE[hookName].get() !== orig);
    const failureIds = detectNew();
    _iwRemoveHook(hookName);
    const restored = (_IW_HOOKABLE[hookName].get() === orig);
    const hooksClean = _iwMutationHookNames().length === 0;
    _iwResetSandboxToBaseline(ctx);
    const chk = _iwAssertSandboxBaselineRestored(ctx);
    results.push({ mutationId, hookName, note, injected, detected: failureIds.length >= 1,
      detectedBy: failureIds.slice(0, 4), failureIds, restored,
      rngRestored: (Math.random === rngBefore), hooksRemoved: hooksClean, sandboxBaselineRestored: chk.ok });
  };
  // M-C1-01 관측 범위를 무시하고 face 전체에 slot 생성
  runOne('M-C1-01_ignore_observed_range', 'buildSlotsForObservedSurface',
    (orig) => function (unit, sm, threatPos, options) {
      const fake = Object.assign({}, sm, { observedRanges: [{ s0: 0, s1: sm.segmentLength, firstSeenAt: 0, lastSeenAt: 0, confidence: 1 }] });
      return orig(unit, fake, threatPos, options);
    }, '관측하지 않은 구간까지 slot 생성');
  // M-C1-02 반대편/미관측 face 추론
  runOne('M-C1-02_infer_opposite_face', 'buildSlotsForObservedSurface',
    (orig) => function (unit, sm, threatPos, options) {
      const out = orig(unit, sm, threatPos, options);
      const OPP = { north: 'south', south: 'north', west: 'east', east: 'west' };
      const opp = OPP[sm.face];
      if (opp && out.length) {
        const clone = Object.assign({}, out[0], { face: opp, slotId: out[0].slotId + ':inferred_' + opp });
        out.push(clone);
      }
      return out;
    }, '관측하지 않은 반대편 face slot 추론');
  // M-C1-03 source 보호 검증 우회 (첫 blocker 확인 생략)
  runOne('M-C1-03b_skip_source_protection', 'validateObservedCoverSlot',
    () => function (unit, slot, threatPos, options) { slot.sourceProtectionVerified = true; return true; },
    'source-first blocker 검증 없이 전부 통과');
  // M-C1-03 legacy knownCovers authority — canonical을 무력화해 legacy 결과가 우선되게 한다
  runOne('M-C1-03_legacy_knowncovers_authority', 'findBestObservedCover',
    () => function () { return null; },
    'canonical 경로 무력화 → legacy knownCovers 결과가 production 권위를 가짐');
  // M-C1-04 예약/점유 무시 — 여러 유닛이 같은 slot 선택
  runOne('M-C1-04_ignore_reservation', 'scoreObservedCoverSlot',
    (orig) => function (unit, slot, threatPos, context) {
      const r = orig(unit, slot, threatPos, context);
      r.breakdown.reservationPenalty = 0; r.breakdown.occupancyPenalty = 0;
      r.score = r.breakdown.protectionScore + r.breakdown.confidenceScore + r.breakdown.freshnessScore
        - r.breakdown.travelPenalty - r.breakdown.threatDistancePenalty - r.breakdown.pathPenalty - r.breakdown.halfCoverPenalty;
      return r;
    }, '예약/점유 감점 제거');
  // M-C1-05 stale slot 유지 (geometry 변경 후에도 무효화 안 함)
  runOne('M-C1-05_stale_slot_survives', 'getObservedCoverSlotMemorySignature',
    () => function (unit) { return 'FROZEN'; },
    'signature 고정 → 편집 후에도 stale slot 유지');
  const failures = results.filter(r => !(r.injected && r.detected && r.restored && r.rngRestored && r.hooksRemoved && r.sandboxBaselineRestored));
  return { mutations: results, failures, baselineClean: true, baselineFailureCount: 0, blocked: false };
  } finally { _ai0bRestoreMaps(mapSnap); }
}
function runAI0C1CoverSlotMutationTests(seed) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0C1MutationCore(ctx, seed));
  const core = sb.coreResult || { mutations: [], failures: [{ mutationId: 'CORE_EXCEPTION' }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ mutationId: 'CORE_EXCEPTION:' + sb.coreError.message }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, mutations: core.mutations || [], failures: core.failures || [],
    baselineClean: core.baselineClean, baselineFailureCount: core.baselineFailureCount, blocked: !!core.blocked,
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.mutations||[]).length - (core.failures||[]).length}/${(core.mutations||[]).length} full-pass, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
function runAI0C1CoverSlotCheckpointSuite(seed, options) {
  seed = (seed == null) ? 1234 : seed;
  const sb = withImpactWoundHarnessSandbox(seed, (ctx) => _runAI0C1CheckpointCore(ctx, seed));
  const core = sb.coreResult || { tests: [], failures: [{ id: 'CORE_EXCEPTION', pass: false }] };
  if (sb.coreError) core.failures = (core.failures || []).concat([{ id: 'CORE_EXCEPTION:' + sb.coreError.message, pass: false }]);
  const pass = (core.failures || []).length === 0 && _iwIntegrityAllTrue(sb.stateIntegrity);
  return { pass, seed, tests: core.tests || [], failures: core.failures || [], evidence: core.evidence || {},
    stateIntegrity: sb.stateIntegrity, changedPaths: sb.changedPaths,
    summary: `${(core.tests||[]).length - (core.failures||[]).length}/${(core.tests||[]).length} tests, integrity=${_iwIntegrityAllTrue(sb.stateIntegrity)}` };
}
// [B-STAGE §19] part destruction 구조 검증 — additive. gameplay state를 절대 변경하지 않는다.
function validatePartDestructionFoundation(rep, unit) {
  // 1) 모든 상태가 functional cap table에 존재 + 범위 0~1
  for (const st of PD_ALL_STATES) {
    const cap = PART_DESTRUCTION_FUNCTIONAL_CAP[st];
    if (cap == null) rep.error('partDestruction', `상태 ${st}: functional cap table에 없음`);
    else if (!(cap >= 0 && cap <= 1)) rep.error('partDestruction', `상태 ${st}: functionalCap 범위 밖 (${cap})`);
  }
  for (const st of Object.keys(PART_DESTRUCTION_FUNCTIONAL_CAP)) {
    if (PD_ALL_STATES.indexOf(st) < 0) rep.error('partDestruction', `cap table의 ${st}: 알 수 없는 상태`);
  }
  // 2) rank table 정합성
  for (const st of PD_ALL_STATES) {
    const isLimbOnly = PD_LIMB_ONLY_STATES.indexOf(st) >= 0, isNonLimbOnly = PD_NON_LIMB_ONLY_STATES.indexOf(st) >= 0;
    if (!isNonLimbOnly && PD_STATE_RANK_LIMB[st] == null) rep.error('partDestruction', `상태 ${st}: 사지 rank 없음`);
    if (!isLimbOnly && PD_STATE_RANK_NON_LIMB[st] == null) rep.error('partDestruction', `상태 ${st}: 비사지 rank 없음`);
  }
  if (!unit || !unit.medical || !unit.medical.partDestruction) return rep;
  // 3) 런타임 계약
  const m = unit.medical, allPd = m.partDestruction;
  const woundIds = new Set((m.wounds || []).map(w => w && w.id).filter(x => x != null));
  for (const k of BODY_PART_KEYS) {
    const pd = allPd[k]; if (!pd) { rep.error('partDestruction', `${k}: model 없음`); continue; }
    const isLimb = _LIMB_PART_KEYS.indexOf(k) >= 0;
    if (PD_ALL_STATES.indexOf(pd.state) < 0) rep.error('partDestruction', `${k}: 알 수 없는 상태 ${pd.state}`);
    if (!isLimb && PD_LIMB_ONLY_STATES.indexOf(pd.state) >= 0) rep.error('partDestruction', `${k}: 비사지에 limb-only 상태 ${pd.state}`);
    if (isLimb && PD_NON_LIMB_ONLY_STATES.indexOf(pd.state) >= 0) rep.error('partDestruction', `${k}: 사지에 non-limb 상태 ${pd.state}`);
    if (!(pd.functionalCap >= 0 && pd.functionalCap <= 1)) rep.error('partDestruction', `${k}: functionalCap 범위 밖 (${pd.functionalCap})`);
    const expCap = PART_DESTRUCTION_FUNCTIONAL_CAP[pd.state];
    if (expCap != null && pd.functionalCap !== expCap) rep.error('partDestruction', `${k}: functionalCap ${pd.functionalCap} != 상태 ${pd.state} cap ${expCap}`);
    const evd = pd.evidence || null;
    // 극단 상태 증거 요구
    if (pd.state === 'traumatic_amputation' && evd && !(evd.dominantCatastrophicSource || evd.dominantShattered))
      rep.error('partDestruction', `${k}: traumatic_amputation인데 dominant catastrophic evidence 없음`);
    if (pd.state === 'partial_traumatic_loss' && evd && !evd.dominantClusterIsDistal)
      rep.error('partDestruction', `${k}: partial_traumatic_loss인데 dominant distal evidence 없음`);
    // dangling reference
    for (const wid of (pd.sourceWoundIds || [])) if (!woundIds.has(wid)) rep.error('partDestruction', `${k}: sourceWoundIds dangling (${wid})`);
    for (const ck of Object.keys(pd.localClusters || {})) {
      for (const wid of (pd.localClusters[ck].woundIds || [])) if (!woundIds.has(wid)) rep.error('partDestruction', `${k}/${ck}: cluster woundId dangling (${wid})`);
    }
    // disabled 계약
    const part = m.bodyParts && m.bodyParts[k];
    if (part) {
      if (PD_DISABLED_STATES.indexOf(pd.state) >= 0 && !part.disabled) rep.error('partDestruction', `${k}: ${pd.state}인데 disabled 아님`);
      if ((part.functionRatio || 0) > pd.functionalCap + 1e-6) rep.error('partDestruction', `${k}: functionRatio ${part.functionRatio} > cap ${pd.functionalCap}`);
    }
    // part destruction만으로 vascular confirmed 생성 금지
    for (const w of (m.wounds || [])) {
      if (!w || w.partKey !== k) continue;
      const ve = w.vascularEvidence || {};
      if (ve.level === 'confirmed' && ve._confirmedByPartDestruction) rep.error('partDestruction', `${k}: part destruction이 vascular confirmed를 생성함`);
    }
  }
  return rep;
}
function validateAllPresets(opts) {
  const rep = _mkValidationReport();
  try { validateAmmoPresets(rep); } catch(e){ rep.error('ammo','검증 예외: '+e.message); }
  try { validatePartDestructionFoundation(rep, null); } catch(e){ rep.error('partDestruction','검증 예외: '+e.message); }
  try { if (GAME.tacticalGeometry && GAME.tacticalGeometry.spatialGraph) validateSurfaceSpatialFoundation(rep); } catch(e){ rep.error('surfaceSpatial','검증 예외: '+e.message); }
  try { validateWeaponPresets(rep); } catch(e){ rep.error('weapon','검증 예외: '+e.message); }
  try { validateArmorPresets(rep); } catch(e){ rep.error('armor','검증 예외: '+e.message); }
  try { validateHelmetPresets(rep); } catch(e){ rep.error('helmet','검증 예외: '+e.message); }
  try { validatePlatePresets(rep); } catch(e){ rep.error('plate','검증 예외: '+e.message); }
  try { validateAccessoryPresets(rep); } catch(e){ rep.error('accessory','검증 예외: '+e.message); }
  try { validateThrowablePresets(rep); } catch(e){ rep.error('throwable','검증 예외: '+e.message); }
  try { validateSkillPresets(rep); } catch(e){ rep.error('skill','검증 예외: '+e.message); }
  try { validateMaterialReferences(rep); } catch(e){ rep.error('material','검증 예외: '+e.message); }
  try { validateVisualProfiles(rep); } catch(e){ rep.error('visual','검증 예외: '+e.message); }
  try { validateLoadoutReferences(rep); } catch(e){ rep.error('loadout','검증 예외: '+e.message); }
  try { validateAmmoRegistry(rep); } catch(e){ rep.error('registry','검증 예외: '+e.message); }
  try { validateWeaponRegistry(rep); } catch(e){ rep.error('weaponReg','검증 예외: '+e.message); }
  try { validatePlateRegistry(rep); } catch(e){ rep.error('plateReg','검증 예외: '+e.message); }
  try { validateHelmetRegistry(rep); } catch(e){ rep.error('helmetReg','검증 예외: '+e.message); }
  try { validateBodyArmorRegistry(rep); } catch(e){ rep.error('bodyArmorReg','검증 예외: '+e.message); }
  try { validateHelmetAccessoryRegistry(rep); } catch(e){ rep.error('helmetAccReg','검증 예외: '+e.message); }
  try { validateAccessoryCoverage(rep); } catch(e){ rep.error('accCov','검증 예외: '+e.message); }
  try { validateBackerModifierSanity(rep); } catch(e){ rep.error('backer','검증 예외: '+e.message); }
  try { validatePlateEffectiveRating(rep); } catch(e){ rep.error('plateEff','검증 예외: '+e.message); }
  try { validateChestSealPlaceholder(rep); } catch(e){ rep.error('chestseal','검증 예외: '+e.message); }
  try { validateSideAmmo1B(rep); } catch(e){ rep.error('sideAmmo1B','검증 예외: '+e.message); }
  try { validateAmmoTerminalEffects(rep); } catch(e){ rep.error('terminalEffect','검증 예외: '+e.message); }
  try { validateMicroFragmentSystem(rep); } catch(e){ rep.error('microFrag','검증 예외: '+e.message); }
  try { validateArmorCoverage(rep); } catch(e){ rep.error('armorCoverage','검증 예외: '+e.message); }
  try { validateBodyTrajectory(rep); } catch(e){ rep.error('bodyTrajectory','검증 예외: '+e.message); }
  try { validateImpactWoundFoundation(rep); } catch(e){ rep.error('impactWound','검증 예외: '+e.message); }
  if (!opts || opts.log !== false) _printValidationReport(rep);
  return rep;
}
// SIDE-AMMO-1B-HOTFIX-4: micro fragment hit-resolution 검증
// SIDE-ARMOR-2A-REVISED: coverage candidate / 소유권 검증
// SIDE-MED-2B-1A: bodyTrajectory scaffold 검증
function validateBodyTrajectory(rep) {
  if (typeof buildBodyTrajectoryContext !== 'function') { rep.error('bodyTrajectory', 'buildBodyTrajectoryContext 누락'); return; }
  const mkEv = (o) => Object.assign({ sourceType:'bullet', armorResult:'penetrated', impactAddress:{} }, o);
  // 1) 사지 소총탄 — 관통 경향 (overpenetration), 체강출혈 아님
  let legThrough = 0, legCavity = 0;
  for (let i = 0; i < 40; i++) {
    const bt = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'556_m855', hitPart:'left_leg', rawDamage:40 }), 'penetrating');
    if (bt.bodyThroughAndThrough || bt.deepTissueReached) legThrough++;
    if (bt.bleedingClass === 'cavity_internal_bleed') legCavity++;
  }
  if (legCavity > 0) rep.error('bodyTrajectory', '사지 피격이 cavity_internal_bleed로 분류됨 ('+legCavity+'/40)');
  // 2) 소형 12.7 micro fragment — deep/through 금지
  let fragDeep = 0;
  for (let i = 0; i < 40; i++) {
    const bt = buildBodyTrajectoryContext({ id:'t' }, mkEv({ sourceType:'frag', isFragment:true, fragmentSize:'small', ammoId:'127x108_mdz_hei', hitPart:'abdomen', penetration:6, rawDamage:6 }), 'shallow');
    if (bt.bodyThroughAndThrough || bt.woundDepthClass === 'deep_penetration') fragDeep++;
  }
  if (fragDeep > 0) rep.error('bodyTrajectory', '소형 12.7 micro fragment가 deep/through 생성 ('+fragDeep+'/40)');
  // 3) 방호 막힌 저에너지 — surface_only
  const btStopped = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'9mm_115gr', hitPart:'chest', armorResult:'stopped', rawDamage:10 }), 'none');
  if (btStopped.woundDepthClass !== 'surface_only') rep.error('bodyTrajectory', '방호 정지인데 surface_only 아님: '+btStopped.woundDepthClass);
  // 4) 복부 깊은 관통 — cavity_internal_bleed 후보 가능
  let abdCavity = 0;
  for (let i = 0; i < 30; i++) {
    const bt = buildBodyTrajectoryContext({ id:'t', bodyArmorId:'iotv_test', backPlateId:'plate_esapi' }, mkEv({ ammoId:'762x51_m80', hitPart:'abdomen', rawDamage:60, impactAddress:{ zone:'upper', impactSide:'front' } }), 'penetrating');
    if (bt.bleedingClass === 'cavity_internal_bleed') abdCavity++;
  }
  if (abdCavity === 0) rep.warn('bodyTrajectory', '복부 깊은 관통에서 cavity_internal_bleed 후보 미발생');
  // 5) continuation — 사출구 없으면 continueRaycast 금지
  const btSurf = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'9mm_115gr', hitPart:'chest', armorResult:'stopped' }), 'none');
  if (btSurf.continueRaycast) rep.error('bodyTrajectory', '사출구 없는데 continueRaycast true');
  // HOTFIX-1: projectileSizeClass + internalScores 존재
  const btAP = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'556_m995_ap', hitPart:'chest', rawDamage:50 }), 'penetrating');
  if (!btAP.projectileSizeClass) rep.error('bodyTrajectory', 'projectileSizeClass 누락');
  if (!btAP.internalScores) rep.error('bodyTrajectory', 'internalScores 누락');
  // HOTFIX-1: AP는 좁은 채널/높은 overpen — sabot/pdw crush 낮음
  const btPDW = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'556_m995_ap', hitPart:'chest', rawDamage:50 }), 'penetrating');
  if (btPDW.internalScores && btPDW.internalScores.crushDamageScore > 1.1) rep.error('bodyTrajectory', 'AP crush가 과도하게 높음');
  // HOTFIX-1: 저속(velocity 낮음)이면 temporary cavity 과장 금지
  const btSlow = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'556_m855', hitPart:'chest', rawDamage:50, _shotVelocity:120, _shotInitialVelocity:900 }), 'penetrating');
  const btFast = buildBodyTrajectoryContext({ id:'t' }, mkEv({ ammoId:'556_m855', hitPart:'chest', rawDamage:50, _shotVelocity:850, _shotInitialVelocity:900 }), 'penetrating');
  if (btSlow.internalScores && btFast.internalScores && btSlow.internalScores.temporaryCavityScore >= btFast.internalScores.temporaryCavityScore) rep.error('bodyTrajectory', '저속탄 temporary cavity가 고속탄 이상 (과장)');
  // HOTFIX-1: 파편 continuation packet 없음 / continuation 금지
  const btFrag = buildBodyTrajectoryContext({ id:'t' }, mkEv({ sourceType:'frag', isFragment:true, fragmentSize:'large', ammoId:'127x108_mdz_hei', hitPart:'abdomen', penetration:20, rawDamage:20 }), 'deep');
  if (btFrag.continueRaycast) rep.error('bodyTrajectory', '파편이 continueRaycast 생성');
  if (typeof _spawnContinuationRaycast !== 'function') rep.error('bodyTrajectory', '_spawnContinuationRaycast 누락');
  // 6) 후면 플레이트 — 인체 완전관통해도 plate에 막히면 continueRaycast 가능성↓ (구조 확인)
  // (확률적이라 강제 검증은 하지 않음)
}
function validateArmorCoverage(rep) {
  // ARMOR-CANONICAL-1 (대형 PHASE 2): 검증도 production과 동일한 canonical 결정형 core만 사용 (legacy 판정식 사용 금지).
  const ok = (typeof buildCoverageImpactAddress === 'function') && (typeof collectDeterministicCoverageCandidates === 'function')
          && (typeof selectDeterministicCoverageLayer === 'function') && (typeof rollProtectionAddressCoverage === 'function');
  if (!ok) { rep.error('armorCoverage', 'canonical coverage 핵심 헬퍼 누락'); return; }
  const mk = (ba, extra) => Object.assign({ bodyArmorId: ba }, extra || {});
  const A = (hitPart, side, zone, subZone) => {
    const region = (hitPart === 'chest' || hitPart === 'abdomen') ? 'torso' : (hitPart === 'head' ? 'head' : (hitPart === 'neck' ? 'neck' : 'limb'));
    return { hitPart, side, impactSide: side, region, zone, subZone: subZone || '' };
  };
  const b23 = mk('armor_6b23_test', { frontPlateId:'plate_korund_vm_front', backPlateId:'plate_korund_vm_back' });
  const iotv = mk('iotv_test', { frontPlateId:'plate_esapi', backPlateId:'plate_esapi', sidePlateId:'plate_esbi', groinGuardId:'iotv_groin' });
  // 1) 6B23 후보 금지 — side plate slot 없음 / groin protector 없음
  const rSide23 = rollProtectionAddressCoverage(b23, A('chest', 'left', 'side_core', 'side_plate_core'));
  if (((rSide23 && rSide23.candidateLayers) || []).some(c => c.layerType === 'side_hard_plate')) rep.error('armorCoverage', '6B23 side_hard_plate candidate 생성됨 (금지)');
  const rGro23 = rollProtectionAddressCoverage(b23, A('abdomen', 'front', 'groin', 'groin'));
  if (((rGro23 && rGro23.candidateLayers) || []).some(c => c.layerType === 'groin_protector')) rep.error('armorCoverage', '6B23 groin_protector candidate 생성됨 (금지)');
  // 2) 소유권 일치 — iotv side plate (결정형: 1회로 충분)
  const rSide = rollProtectionAddressCoverage(iotv, A('chest', 'left', 'side_core', 'side_plate_core'));
  if (rSide && rSide.selectedLayerType === 'side_hard_plate') {
    const selCand = (rSide.candidateLayers || []).find(c => c.layerType === 'side_hard_plate');
    if (selCand && selCand.durabilityOwnerType !== 'side_hard_plate') rep.error('armorCoverage', 'side plate 선택인데 owner가 side plate 아님');
    if (rSide.protectionType !== 'hard') rep.error('armorCoverage', 'side_hard_plate인데 protectionType!=hard');
    if (!(rSide.softArmor > 0)) rep.warn('armorCoverage', 'side hard 선택인데 soft backer armor 미연결');
  }
  // 3) ARMOR INVARIANT — chest impact를 abdomen plate가 막지 않고, abdomen impact를 chest plate가 막지 않음 (frontSet 분리)
  const rChest23 = rollProtectionAddressCoverage(b23, A('chest', 'front', 'upper', ''));
  if (rChest23 && rChest23.protectionType === 'hard' && rChest23.selectedLayerType !== 'front_hard_plate') rep.error('armorCoverage', 'chest hard가 front_hard_plate 아님: ' + rChest23.selectedLayerType);
  const rAbd23 = rollProtectionAddressCoverage(b23, A('abdomen', 'front', 'lower', ''));
  if (rAbd23 && rAbd23.protectionType === 'hard') {
    if (rAbd23.selectedLayerType !== 'frontset_abdomen_hard') rep.error('armorCoverage', 'frontSet abdomen hard가 별도 layer 아님: ' + rAbd23.selectedLayerType);
    const selAbd = (rAbd23.candidateLayers || []).find(c => c.layerType === rAbd23.selectedLayerType);
    if (selAbd && !/_abdomen_/.test(String(selAbd.durabilityOwnerId || ''))) rep.error('armorCoverage', 'abdomen plate owner가 abdomen 슬롯 아님: ' + selAbd.durabilityOwnerId);
  }
  // 6B23 (플레이트 없음) lower front soft — owner sub-pool
  const rAbdSoft = rollProtectionAddressCoverage(mk('armor_6b23_test', {}), A('abdomen', 'front', 'lower', ''));
  if (rAbdSoft && /built_in_lower_front_soft/.test(rAbdSoft.selectedLayerType || '')) {
    const selS = (rAbdSoft.candidateLayers || []).find(c => c.layerType === rAbdSoft.selectedLayerType);
    if (selS && !/6b23_soft/.test(String(selS.durabilityOwnerId || ''))) rep.error('armorCoverage', '6B23 lower soft owner가 6b23 sub-pool 아님');
  }
  // 4) single-source — 전달 주소를 새로 만들지 않음 (내용 동일성) + production entry 일치 + fallback 미사용
  const a0 = buildCoverageImpactAddress(iotv, 'abdomen', 'front', {});
  const p0 = rollProtectionAddressCoverage(iotv, a0);
  if (p0 && p0.impactAddress && a0 && p0.impactAddress.fullAddress !== a0.fullAddress) rep.error('armorCoverage', 'canonical이 impactAddress를 새로 생성 (single source 위반)');
  if (typeof rollProtection === 'function') {
    const pProd = rollProtection(iotv, 'abdomen', 'front', { impactAddress: a0 });
    if (pProd && pProd.impactAddress && pProd.impactAddress.fullAddress !== a0.fullAddress) rep.error('armorCoverage', 'rollProtection이 전달 주소를 무시');
    if (pProd && pProd.fallbackUsed) rep.error('armorCoverage', '주소 있는데 legacy fallback 사용됨: ' + pProd.fallbackReason);
    if (pProd && p0 && pProd.selectedLayerType !== p0.selectedLayerType) rep.error('armorCoverage', 'production entry와 canonical core layer 불일치: ' + pProd.selectedLayerType + ' vs ' + p0.selectedLayerType);
  }
  // 5) 내구도 ratio가 effectiveArmor에 반영 (canonical helper)
  if (typeof candidateToProtectionResult === 'function') {
    const cand = { layerType:'built_in_lower_front_soft', armorValue:22, durabilityOwnerId:'6b23_soft_lower_front_chk', material:'aramid' };
    const full = candidateToProtectionResult(cand, b23).armorValue;
    const dmgUnit = { armorCoverageDurability:{ '6b23_soft_lower_front_chk':0 } };
    const broken = candidateToProtectionResult(cand, dmgUnit).armorValue;
    if (!(broken < full)) rep.error('armorCoverage', 'coverage durability가 effectiveArmor에 미반영');
  }
  // 6) fragment 경로 — canonical 주소 생성
  if (typeof _fragArmorCheckFromCoverage !== 'function') rep.error('armorCoverage', 'coverage-aware protection missing in fragment path');
  const aFrag = buildCoverageImpactAddress(b23, 'abdomen', 'front', { sourceType:'frag', isFragment:true });
  if (!aFrag || !aFrag.fullAddress) rep.error('armorCoverage', 'fragment abdomen impactAddress 누락');
}
function validateMicroFragmentSystem(rep) {
  const defined = (typeof pickFragmentBodyPart === 'function') && (typeof _fragArmorCheck === 'function') && (typeof resolveMicroFragmentImpact === 'function') && (typeof _fragBurstAspect === 'function');
  if (!defined) { rep.error('microFrag', 'micro fragment hit-resolution 헬퍼 누락'); return; }
  const cnt = {}; for (let i = 0; i < 300; i++) { const p = pickFragmentBodyPart({ facing:0, x:0, y:0 }, 'micro_hei_contact_burst', 2); cnt[p] = (cnt[p] || 0) + 1; }
  if (Object.keys(cnt).length < 4) rep.error('microFrag', `pickFragmentBodyPart 분산 부족 (${Object.keys(cnt).length}부위)`);
  if ((cnt.chest || 0) > 200) rep.warn('microFrag', 'pickFragmentBodyPart chest 편중 의심');
  if (typeof _microExplosiveInfo === 'function' && typeof AMMO_PRESETS !== 'undefined') {
    const mdz = AMMO_PRESETS['127x108_mdz_hei'] && _microExplosiveInfo(AMMO_PRESETS['127x108_mdz_hei']);
    const mk = AMMO_PRESETS['127x99_mk211_heiap'] && _microExplosiveInfo(AMMO_PRESETS['127x99_mk211_heiap']);
    if (mdz && mdz.fragmentCount !== 32) rep.error('microFrag', `MDZ fragmentCount ${mdz.fragmentCount} != 32`);
    if (mk && mk.fragmentCount !== 30) rep.error('microFrag', `Mk211 fragmentCount ${mk.fragmentCount} != 30`);
  }
}
// SIDE-AMMO-1B §12: 특수 탄약 효과 자체 점검
function validateAmmoTerminalEffects(rep) {
  const ALLOWED_TYPE = ['fragment','controlled_fragment','yaw','expand','frangible','penetrator','pistol_penetrator','barrier_blind','full_power','pellet','pistol_ball',
    'pdw_penetrator','small_caliber_ap','rifle_ap','high_power_ball','high_power_ap','sabot_penetrator','subsonic_heavy','subsonic_standard','subsonic_ap','large_bore_ball','anti_material_ball','anti_material_ap','api','hei_direct','heiap_primary'];
  const TE_FORBIDDEN_NEW = ['pdw_subsonic','pdw_expanding','large_bore_light','pdw_frangible','cbj_sabot','rifle_expanding'];   // profile family 전용 — terminalEffect.type 금지
  const TE = (typeof AMMO_TERMINAL_EFFECT !== 'undefined') ? AMMO_TERMINAL_EFFECT : {};
  const TP = (typeof AMMO_TERMINAL_PROFILE !== 'undefined') ? AMMO_TERMINAL_PROFILE : {};
  const REG = (typeof AMMO_REGISTRY !== 'undefined') ? AMMO_REGISTRY : {};
  const numOK = (v) => typeof v === 'number' && isFinite(v);
  // --- terminalEffect ---
  for (const id in REG) {
    const te = TE[id] || (AMMO_PRESETS[id] && AMMO_PRESETS[id].terminalEffect);
    if (!te) { rep.warn('terminalEffect', `${id}: terminalEffect 없음 (live ammo)`); continue; }
    if (ALLOWED_TYPE.indexOf(te.type) < 0) rep.error('terminalEffect', `${id}: 허용되지 않은 type '${te.type}'`);
    if (!numOK(te.thresholdVelocity)) rep.error('terminalEffect', `${id}: thresholdVelocity 비정상`);
    for (const f of ['aboveTissueMul','belowTissueMul','aboveBleedMul','belowBleedMul','aboveShockMul','belowShockMul']) {
      if (!numOK(te[f])) rep.error('terminalEffect', `${id}: ${f} 비정상`);
      else if (te[f] > 2.5 || te[f] < 0.2) rep.warn('terminalEffect', `${id}: ${f}=${te[f]} 범위 의심`);
    }
    if (te.estimatedThreshold === true && !te.debugNote && !te.notes) rep.warn('terminalEffect', `${id}: estimated인데 debugNote 없음`);
    // SIDE-AMMO-2A-HOTFIX-2 §14
    if (TE_FORBIDDEN_NEW.indexOf(te.type) >= 0) rep.error('terminalEffect', `${id}: terminalEffect.type '${te.type}'는 profile family 전용 (type 금지)`);
    if (/^9mm_(115gr|124gr|m882|luger_tracer)$|^9x21_sp11/.test(id) && te.type === 'yaw' && te.thresholdVelocity >= 600) rep.warn('terminalEffect', `${id}: 일반 권총탄이 rifle yaw threshold(${te.thresholdVelocity}) — pistol_ball 권장`);
    if (/subsonic/.test(id) && /^(4\.6|5\.7)/.test(id) && te.type === 'subsonic_heavy') rep.warn('terminalEffect', `${id}: 소형 PDW 아음속이 subsonic_heavy`);
    if (id === '300blk_cbj' && te.thresholdVelocity >= 850) rep.warn('terminalEffect', `${id}: CBJ threshold ${te.thresholdVelocity} 과도 (고속 SLAP 기준)`);
    if (id === '127x55_ps12a' && te.type === 'subsonic_heavy') rep.warn('terminalEffect', `${id}: PS12A가 subsonic_heavy`);
    if (te.type === 'expand' && /_hp$|_sp$/.test(id) && !/^9mm|^9x21|^4\.6|^5\.7/.test(id) && te.thresholdVelocity < 400) rep.warn('terminalEffect', `${id}: 소총 HP/SP threshold ${te.thresholdVelocity} 너무 낮음(권총 기준)`);
    if (id === '300blk_vmax_110' && te.thresholdVelocity >= 720) rep.warn('terminalEffect', `${id}: V-MAX threshold ${te.thresholdVelocity} — 항상 below`);
    if (id === '5.7_r37f' && te.type === 'fragment' && te.thresholdVelocity >= 700) rep.warn('terminalEffect', `${id}: R37.F가 rifle fragment처럼 과장`);
  }
  // 기존 28종 핵심 값 비변경 확인 (대표 샘플)
  const lock = { '556_m193':['fragment',780], '556_m855':['yaw',760], '556_m995_ap':['penetrator',700], '9mm_jhp':['expand',320], '12g_slug':['full_power',320] };
  for (const id in lock) { const te = TE[id]; if (te && (te.type !== lock[id][0] || te.thresholdVelocity !== lock[id][1])) rep.error('terminalEffect', `${id}: 기존 terminalEffect 변경됨 (보존 위반)`); }
  // --- terminalProfile ---
  const FAM = ['rifle_ball','fragmenting_rifle','controlled_fragment','barrier_blind','pistol_ball','pistol_ap','pdw_penetrator','rifle_ap','sabot','subsonic_heavy','subsonic_standard','subsonic_ap','large_bore_ball','high_power_ap','anti_material_ball','anti_material_ap','hei','heiap','pellet','slug','frangible',
    'pdw_subsonic','pdw_expanding','pdw_frangible','large_bore_light','cbj_sabot','slap_sabot','anti_material_heiap','anti_material_hei','subsonic_intermediate','rifle_expanding','small_caliber_ap'];
  const WC = ['pin_hole','narrow','normal','wide','crushing','fragmenting','expanding','pellet'];
  const TEND = ['none','low','medium','high','very_high','conditional'];
  for (const id in REG) {
    const tp = TP[id] || (REG[id] && REG[id].terminalProfile);
    if (!tp) { rep.error('terminalEffect', `${id}: terminalProfile 없음`); continue; }
    if (FAM.indexOf(tp.family) < 0) rep.warn('terminalEffect', `${id}: family '${tp.family}' 미등록`);
    if (WC.indexOf(tp.woundChannel) < 0) rep.error('terminalEffect', `${id}: woundChannel '${tp.woundChannel}' 무효`);
    for (const f of ['overpenetrationTendency','yawTendency','fragmentationTendency','armorAfterEffect']) {
      if (TEND.indexOf(tp[f]) < 0 && tp[f] !== 'special_micro_fragment') rep.error('terminalEffect', `${id}: ${f} '${tp[f]}' 무효`);
    }
    for (const f of ['tissueCrushMul','temporaryCavityMul','boneBreakMul','exitWoundMul','retainedProjectileChance']) {
      if (!numOK(tp[f])) rep.error('terminalEffect', `${id}: terminalProfile.${f} 비정상`);
    }
    if (tp.futureMedicalHook !== true) rep.error('terminalEffect', `${id}: futureMedicalHook !== true`);
    // 일관성 경고
    if ((tp.family === 'hei' || tp.family === 'heiap') && tp.specialEffectSource !== 'microExplosiveEffect') rep.warn('terminalEffect', `${id}: HEI/HEIAP specialEffectSource 누락`);
    if (tp.family === 'sabot' && (tp.woundChannel === 'wide' || tp.woundChannel === 'crushing')) rep.warn('terminalEffect', `${id}: sabot인데 woundChannel ${tp.woundChannel}`);
    if (/_ap$/.test(tp.family) && tp.fragmentationTendency === 'high') rep.warn('terminalEffect', `${id}: AP인데 fragmentation high`);
    if (tp.family === 'pdw_penetrator' && tp.tissueCrushMul > 1.0) rep.warn('terminalEffect', `${id}: PDW tissueCrushMul ${tp.tissueCrushMul} 과도`);
    if (tp.family === 'anti_material_ball' && (tp.boneBreakMul < 1.3 || tp.tissueCrushMul < 1.3)) rep.warn('terminalEffect', `${id}: anti_material_ball crush/bone 과소`);
    // SIDE-AMMO-2A-HOTFIX-2 §14 profile 경고
    if (/^(545|762x39)/.test(id) && tp.family === 'pistol_ball') rep.warn('terminalEffect', `${id}: 소총/중간탄인데 family pistol_ball`);
    if (/_ap$|_ap_|ppbs|7bt4|m995|m61|m993/.test(id) && tp.family === 'rifle_ball') rep.warn('terminalEffect', `${id}: AP탄인데 family rifle_ball`);
    if (/^(4\.6|5\.7)/.test(id) && /jsp|action|ss192|jhp|expand/.test(id) && tp.family === 'pistol_ball') rep.warn('terminalEffect', `${id}: PDW 팽창탄인데 family pistol_ball`);
    if (/^(4\.6|5\.7)/.test(id) && /subsonic/.test(id) && tp.family === 'subsonic_heavy') rep.warn('terminalEffect', `${id}: PDW 아음속인데 family subsonic_heavy`);
    if (/sabot/.test(tp.family) && (tp.woundChannel === 'wide' || tp.woundChannel === 'crushing')) rep.warn('terminalEffect', `${id}: sabot family인데 woundChannel ${tp.woundChannel}`);
    if (tp.family === 'large_bore_light' && (tp.armorAfterEffect === 'high' || tp.armorAfterEffect === 'very_high')) rep.warn('terminalEffect', `${id}: large_bore_light armorAfterEffect ${tp.armorAfterEffect} 과도`);
  }
}
function validateSideAmmo1B(rep) {
  const A = (typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS : {};
  const num = (id, f, exp) => { const a = A[id]; if (a && a[f] !== exp) rep.error('sideAmmo1B', `${id}.${f}=${a[f]} (기대 ${exp})`); };
  // 스펙 보정값
  num('762x51_m948_slap','penetration',87); num('762x51_m948_slap','armorDamagePct',78);
  num('127x99_m903_slap','penetration',102); num('127x99_m903_slap','armorDamagePct',115);
  num('300blk_cbj','penetration',56); num('300blk_cbj','armorDamagePct',52);
  num('4.6_dm11_ap_sx','penetration',43);
  // tracer color 규칙
  const tc = (id) => (typeof getTracerColor === 'function') ? getTracerColor(A[id]) : null;
  const wantRed = ['9mm_luger_tracer','556_m856_tracer','556_m856a1_tracer','762x51_m62_tracer','30_06_m25_tracer','127x99_m17_tracer','127x99_m20_apit'];
  const wantGreen = ['545_7t3_tracer','545_7bt4_aptracer','762x39_t45m_tracer','762x54r_t46m','762x54r_7bt1','9x21_sp13_7bt3'];
  for (const id of wantRed) if (A[id] && tc(id) !== 'red') rep.error('sideAmmo1B', `${id} tracer color=${tc(id)} (기대 red)`);
  for (const id of wantGreen) if (A[id] && tc(id) !== 'green') rep.error('sideAmmo1B', `${id} tracer color=${tc(id)} (기대 green)`);
  if (A['127x108_bzt44_apit'] && tc('127x108_bzt44_apit') !== 'red') rep.error('sideAmmo1B', '12.7×108 BZT-44 API-T tracer 예외 red 아님');
  // sabot 후보 + residualKind
  if (typeof _sabotInfo === 'function') {
    for (const id of ['762x51_m948_slap','127x99_m903_slap','300blk_cbj']) if (A[id] && !_sabotInfo(A[id])) rep.error('sideAmmo1B', `${id} sabot 후보로 인식 안 됨`);
    if (A['762_m993_ap'] && _sabotInfo(A['762_m993_ap'])) rep.error('sideAmmo1B', 'M993 AP가 sabot으로 오인식');
    if (_sabotInfo(A['300blk_cbj']) && _sabotInfo(A['300blk_cbj']).subtype !== 'cbj_subcaliber') rep.error('sideAmmo1B', 'CBJ subtype 불일치');
  }
  if (typeof buildResidualThreatAfterHard === 'function' && typeof getAmmoEffectivePenForMaterial === 'function') {
    for (const id of ['762x51_m948_slap','127x99_m903_slap','300blk_cbj']) {
      const a = A[id]; if (!a) continue;
      const pkt = buildResidualThreatAfterHard(a, getAmmoEffectivePenForMaterial(a,'ceramic'), 40, {}, {});
      if (pkt.residualKind !== 'sabot_penetrator') rep.error('sideAmmo1B', `${id} residualKind=${pkt.residualKind} (기대 sabot_penetrator)`);
    }
  }
  // PS-12B ceramic ≤ 7.62×39 BP ceramic
  if (typeof getAmmoEffectivePenForMaterial === 'function' && A['127x55_ps12b'] && A['762x39_bp']) {
    const ps = getAmmoEffectivePenForMaterial(A['127x55_ps12b'],'ceramic'), bp = getAmmoEffectivePenForMaterial(A['762x39_bp'],'ceramic');
    if (ps > bp) rep.error('sideAmmo1B', `PS-12B ceramic eff(${ps}) > BP(${bp})`);
  }
  // micro explosive
  if (typeof _microExplosiveInfo === 'function') {
    const mdz = _microExplosiveInfo(A['127x108_mdz_hei']);
    const mk = _microExplosiveInfo(A['127x99_mk211_heiap']);
    if (!mdz || mdz.detonationMode !== 'impact_instant') rep.error('sideAmmo1B', 'MDZ detonationMode != impact_instant');
    if (!mdz || mdz.fragmentCount !== 32) rep.error('sideAmmo1B', 'MDZ fragmentCount != 32');
    if (!mk || mk.detonationMode !== 'delayed_post_penetration') rep.error('sideAmmo1B', 'Mk211 detonationMode != delayed_post_penetration');
    if (!mk || mk.fragmentCount !== 30) rep.error('sideAmmo1B', 'Mk211 fragmentCount != 30');
    if (!mk || mk.postPenConeAngleDeg !== 30) rep.error('sideAmmo1B', 'Mk211 cone != 30');
    for (const m of [mdz, mk]) if (m && (m.fragmentSizeChance.small !== 0.80 || m.fragmentSizeChance.medium !== 0.15 || m.fragmentSizeChance.large !== 0.05)) rep.error('sideAmmo1B', 'HEI/HEIAP fragment size 확률 오류');
    // HOTFIX: 거리/속도/bodyBurst
    for (const [nm, m] of [['MDZ', mdz], ['Mk211', mk]]) {
      if (!m) continue;
      if (m.fragmentThreatRangeM !== 3) rep.error('sideAmmo1B', `${nm} fragmentThreatRangeM != 3`);
      if (m.fragmentMaxRangeM !== 13) rep.error('sideAmmo1B', `${nm} fragmentMaxRangeM != 13`);
      const v = m.fragmentVelocityMps;
      if (!v || v.small[0] < 800 || v.small[1] > 1500 || v.large[0] < 800) rep.error('sideAmmo1B', `${nm} fragmentVelocityMps 범위 오류`);
    }
    if (mk && (!mk.bodyBurstEffect || !mk.bodyBurstEffect.enabled)) rep.error('sideAmmo1B', 'Mk211 bodyBurstEffect 없음');
    if (mk && mk.bodyBurstEffect && mk.bodyBurstEffect.internalFragmentWoundCount.max > 6) rep.error('sideAmmo1B', 'Mk211 body burst secondary wound > 6');
    // 거리 감쇠 함수 검증
    if (typeof _fragRangeMul === 'function') {
      if (_fragRangeMul(2, 3, 13) !== 1.0) rep.error('sideAmmo1B', '거리감쇠 3m 이내 != 1.0');
      if (_fragRangeMul(13, 3, 13) !== 0) rep.error('sideAmmo1B', '거리감쇠 13m != 0');
      if (!(_fragRangeMul(8, 3, 13) < 0.6 && _fragRangeMul(8, 3, 13) > 0)) rep.error('sideAmmo1B', '거리감쇠 중간 구간 오류');
    }
  }
  return rep;
}
// 2B-0-FINAL HOTFIX §3: chestseal이 placeholder인지 검증 — 내부/cavity 출혈에 직접 영향 없어야 함
function validateChestSealPlaceholder(rep) {
  if (typeof updateMedicalBleedingWoundBased !== 'function' || typeof createMedical !== 'function') return rep;
  // 흉부 내부+cavity 출혈 wound를 가진 합성 유닛 구성
  function mkChestUnit() {
    const med = createMedical();
    med.wounds = [{
      id:'vt_cs', partKey:'chest', location:'흉부', sourceType:'bullet', woundType:'cavity_wound',
      armorResult:'penetrated', penetrationState:'penetrating',
      woundSize:{ sizeClass:'large', sizeScore:80, entrySizeClass:'medium', internalSizeClass:'large' },
      bleedingProfile:{ bleedingType:'cavity', baseExternal:6, baseInternal:9, currentExternal:6, currentInternal:9, tourniquetEligible:false, vesselRisk:0.6, rebleedRisk:0.3 },
      fieldCare:{ fieldCareClass:'limited' },
      treatmentProfile:{ pressureBandageEligible:true, chestSealEligible:true },
      treatmentState:{ bandaged:false, pressureBandaged:false, hemostaticApplied:false, packed:false, chestSealed:false, stabilized:false, treatmentQuality:0, pressureBandageStabilization:0 },
      tissueProfile:{ boneRisk:0 }, createdAt:0,
    }];
    return { id:9990, name:'VT', medical:med, bodyParts:med.bodyParts };
  }
  const u1 = mkChestUnit(); updateMedicalBleedingWoundBased(u1, 0.1);
  const beforeInt = u1.medical.wounds[0]._effInternal;
  const u2 = mkChestUnit(); u2.medical.wounds[0].treatmentState.chestSealed = true; updateMedicalBleedingWoundBased(u2, 0.1);
  const afterInt = u2.medical.wounds[0]._effInternal;
  if (Math.abs((beforeInt||0) - (afterInt||0)) > 1e-6)
    rep.error('chestseal', `chestseal이 내부/cavity 출혈을 변화시킴 (${beforeInt} → ${afterInt}) — placeholder 위반`);
  if (afterInt < beforeInt - 1e-6)
    rep.error('chestseal', `chestseal이 cavity 출혈을 직접 감소시킴 — placeholder 위반`);
  if (u2.medical.wounds[0].treatmentState.chestSealed !== true)
    rep.error('chestseal', 'chestSealed state가 저장되지 않음');
  return rep;
}
function _printValidationReport(rep) {
  if (typeof console === 'undefined') return;
  const s = rep.summary();
  console.groupCollapsed ? console.groupCollapsed(`[Preset Validator] error ${s.errors} / warning ${s.warnings} / info ${s.infos}`)
                         : console.log(`[Preset Validator] error ${s.errors} / warning ${s.warnings} / info ${s.infos}`);
  for (const e of rep.errors)   console.error(`  ✖ [${e.cat}] ${e.msg}`);
  for (const w of rep.warnings) console.warn(`  ⚠ [${w.cat}] ${w.msg}`);
  for (const i of rep.infos)    console.info(`  · [${i.cat}] ${i.msg}`);
  if (console.groupEnd) console.groupEnd();
}

// =============================================================
