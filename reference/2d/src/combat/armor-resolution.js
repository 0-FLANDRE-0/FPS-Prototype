// 3. COMBAT RESOLUTION (보병 1인 전용)
// =============================================================
// 방향별 방호 슬롯 조회 헬퍼
//   - 1순위: 장비.coverage[`${location}_${aspect}`]
//   - 2순위: 장비.coverage[location]
//   - 3순위: PROTECTION_INFANTRY[location]
//   aspect는 'front'/'side'/'rear'. null이면 기본 슬롯 사용.
// 플레이트가 location/aspect에 적용되는지 판단
//   front plate: chest_front (frontSet이면 abdomen_front 추가)
//   back plate: chest_rear (frontBack이면 그대로, 6B23 back는 chest만)
//   side plate: chest_side (granit_side는 abdomen_side 일부도)
function getActivePlateForSlot(unit, location, aspect) {
  if (!aspect) return null;
  if (location !== 'chest' && location !== 'abdomen') return null;
  if (typeof PLATE_PRESETS === 'undefined') return null;
  // 위치/방향에 따라 어떤 플레이트가 적용되는지
  if (aspect === 'front') {
    const p = unit.frontPlateId ? PLATE_PRESETS[unit.frontPlateId] : null;
    if (!p || p.isNone) return null;
    // chest_front는 항상 적용. abdomen_front는 frontSet에만
    if (location === 'chest') return p;
    if (location === 'abdomen' && p.slotType === 'frontSet') return p;
    return null;
  } else if (aspect === 'rear') {
    const p = unit.backPlateId ? PLATE_PRESETS[unit.backPlateId] : null;
    if (!p || p.isNone) return null;
    // chest_rear는 항상 적용. abdomen_rear는 명시적 복부 후면 hard coverage(abdomenRear 플레이트 슬롯)만.
    //   frontBack은 front/back 장착 호환 의미일 뿐 복부 후면 coverage로 확대하지 않는다 (HOTFIX-1 §6).
    if (location === 'chest') return p;
    if (location === 'abdomen' && (p.slotType === 'frontSet' || (p.plateSlots && p.plateSlots.abdomenRear) || p.coversAbdomenRear)) return p;
    return null;
  } else if (aspect === 'side') {
    const p = unit.sidePlateId ? PLATE_PRESETS[unit.sidePlateId] : null;
    if (!p || p.isNone) return null;
    // chest_side 항상. abdomen_side는 Granit Side (대형) 한정으로 일부 커버
    if (location === 'chest') return p;
    if (location === 'abdomen' && p.id === 'plate_granit_side') return p;
    return null;
  }
  return null;
}

// 방탄복 soft 슬롯 + 플레이트 hard를 합성해서 protection slot 반환
// 2A-6.5: 최신 slot shape 정규화 — soft armor 값/재질을 slot.soft.smallArmor / slot.soft.material에서 안전 추출
function getSlotSoftArmorValue(slot) {
  if (!slot) return 0;
  if (typeof slot.softArmor === 'number') return slot.softArmor;        // legacy fallback
  if (slot.soft && typeof slot.soft.smallArmor === 'number') return slot.soft.smallArmor;
  return 0;
}
function getSlotSoftMaterial(slot) {
  if (!slot) return 'fabric';
  if (slot.softMaterial) return slot.softMaterial;                       // legacy fallback
  if (slot.soft && slot.soft.material) return slot.soft.material;
  return 'fabric';
}
// 2A-6.5-FINAL: Stand-Alone 플레이트만 자체 backingArmor를 soft fallback으로 쓸 수 있다.
//   ICW 플레이트는 외부 소프트백커 전제 — plate.backingArmor를 external backer처럼 우회 사용 금지.
function isStandalonePlate(plate) {
  if (!plate) return false;
  return !!plate.hasIntegralBacker || plate.ratingMode === 'standalone' || plate.plateSystem === 'standalone';
}
function compositeArmorWithPlate(softSlot, plate, _location, _aspect) {
  if (!plate || plate.isNone || !plate.hardArmor) return softSlot;
  // 2A-6.4: soft_insert는 hard plate처럼 hardP를 주지 않고 soft armor 보강으로 처리
  if (plate.ratingMode === 'soft_insert') {
    const baseSoftP = (softSlot && softSlot.softP) || 0;
    const baseHardP = (softSlot && softSlot.hardP) || 0;
    const baseSoftArmor = (softSlot && softSlot.soft && softSlot.soft.smallArmor) || 0;
    // soft 비율을 끌어올리고(최대 0.80), armorValue는 insert와 기존 soft 중 큰 값
    const newSoftP = Math.min(0.80, baseSoftP + 0.45);
    const newSoftArmor = Math.max(baseSoftArmor, plate.hardArmor || 0);
    const out = P(
      baseHardP,                                  // 기존 hard 비율 유지 (insert는 hard 아님)
      Math.min(1.0 - baseHardP, newSoftP),
      Math.max(0, 1.0 - baseHardP - Math.min(1.0 - baseHardP, newSoftP)),
      (softSlot && softSlot.hard && softSlot.hard.smallArmor) || 0,
      newSoftArmor,
      false,
      (softSlot && softSlot.hard && softSlot.hard.material) || 'composite',
      plate.material || getSlotSoftMaterial(softSlot) || 'aramid'
    );
    out._softInsert = true;            // impactAddress 표시용 (hard 아님)
    out._softInsertId = plate.id;
    return out;
  }
  // softSlot: { hardP, softP, noneP, hardArmor, softArmor, softBacker, hardMaterial, softMaterial }
  //   플레이트 장착 시 hard 비율을 늘리고 hardArmor/hardMaterial은 플레이트 값으로
  // 2A-6.5-FINAL: 방탄복 soft는 softSlot.soft.smallArmor에서만 읽는다.
  //   softSlot soft가 없으면 — Stand-Alone만 자체 backingArmor를 fallback으로 쓰고, ICW/그 외는 0(외부백커 없음).
  //   임의 기본값 14는 제거. plate.backingArmor를 ICW 외부백커처럼 우회하지 않는다.
  const slotSoftArmor = getSlotSoftArmorValue(softSlot);
  const plateHasOwnBacker = isStandalonePlate(plate);
  const compositedSoftArmor = (slotSoftArmor > 0)
    ? slotSoftArmor
    : (plateHasOwnBacker ? (plate.backingArmor || 0) : 0);
  const compositedSoftMaterial = (slotSoftArmor > 0)
    ? getSlotSoftMaterial(softSlot)
    : (plateHasOwnBacker ? (plate.backingMaterial || 'aramid') : 'fabric');
  const composited = P(
    0.85,   // hardP — 플레이트 커버 비율
    0.10,   // softP
    0.05,   // noneP
    plate.hardArmor,
    compositedSoftArmor,
    true,
    plate.material,
    compositedSoftMaterial
  );
  // 2A-6.4: 플레이트 시스템 메타 전달 (백커 2차 저지/표시용)
  composited._plateId = plate.id;
  composited._plateRatingMode = plate.ratingMode || null;
  composited._plateRequiresSoftBacker = !!plate.requiresSoftBacker;
  composited._plateHasIntegralBacker = !!plate.hasIntegralBacker;
  composited._plateMinBackerArmor = plate.minBackerArmor || 0;
  composited._plateSecondaryBackerMode = plate.secondaryBackerMode || 'none';
  composited._plateBaseSoftArmor = (softSlot && softSlot.soft && softSlot.soft.smallArmor) || 0;
  // ABDOMEN-PLATE-SLOT-1: frontSet 복부 플레이트는 가슴판과 별개 슬롯으로 표기/소모한다.
  //   (복부 피격인데 "전면 플레이트(가슴판)"로 표시되고 가슴판 내구도가 닳던 문제 수정)
  const _isFrontSetAbdomen = (_location === 'abdomen' && (_aspect === 'front' || _aspect === 'rear') && plate.slotType === 'frontSet');
  composited._plateSlotLocation = _location || null;
  composited._plateSlotAspect = _aspect || null;
  if (_isFrontSetAbdomen) {
    composited._plateLayerType = (_aspect === 'rear') ? 'frontset_abdomen_hard_rear' : 'frontset_abdomen_hard';
    composited._plateSlotKey = plate.id + '_' + (_aspect === 'rear' ? 'abdomen_rear' : 'abdomen_front');
    composited._plateDisplayName = ((plate.display && plate.display.name) || plate.name || plate.id) + ' (복부판)';
  } else {
    composited._plateLayerType = (_aspect === 'rear') ? 'rear_hard_plate' : (_aspect === 'side' || _aspect === 'left' || _aspect === 'right') ? 'side_hard_plate' : 'front_hard_plate';
    composited._plateSlotKey = plate.id + '_' + (_aspect || 'front');
  }
  return composited;
}

function getProtectionSlotByAspect(unit, location, aspect) {
  const ba = unit.bodyArmorId ? BODY_ARMOR_PRESETS[unit.bodyArmorId] : null;
  const cov = (ba && ba.coverage) || {};
  // left_arm/right_arm은 coverage 조회 시 arms로 정규화 (방호 정보 공통, 내구도는 좌/우 분리)
  const lookupLoc = (location === 'left_arm' || location === 'right_arm') ? 'arms' : location;
  let slot = null;
  if (aspect) {
    const key = lookupLoc + '_' + aspect;
    if (cov[key]) slot = cov[key];
    // left/right이면 side로 fallback
    if (!slot && (aspect === 'left' || aspect === 'right')) {
      const sideKey = lookupLoc + '_side';
      if (cov[sideKey]) slot = cov[sideKey];
    }
  }
  if (!slot && cov[lookupLoc]) slot = cov[lookupLoc];
  if (!slot) slot = PROTECTION_INFANTRY[lookupLoc];
  // 플레이트 합성 — chest/abdomen + 방향이 있을 때만 (arms는 plate X)
  const plate = getActivePlateForSlot(unit, lookupLoc, aspect);
  if (plate) slot = compositeArmorWithPlate(slot, plate, lookupLoc, aspect);
  // 추가 보호구 합성 — accessory는 location='arms'로 조회 (좌/우 공통)
  const acc = getAccessoriesForSlot(unit, lookupLoc, aspect);
  if (acc.length > 0) slot = compositeSlotWithAccessories(slot, acc);
  return slot;
}

function buildUnitProtection(unit, aspect) {
  const ba = unit.bodyArmorId ? BODY_ARMOR_PRESETS[unit.bodyArmorId] : null;
  const hm = unit.helmetId    ? HELMET_PRESETS[unit.helmetId]        : null;
  const fb = PROTECTION_INFANTRY;
  // head_skull: 헬멧 + SLAAP (front aspect)
  let headSkull = (hm && hm.head_skull) || fb.head_skull;
  const slaap = getAccessoriesForSlot(unit, 'head_skull', aspect);
  if (slaap.length > 0) headSkull = compositeSlotWithAccessories(headSkull, slaap);
  // head_face: 헬멧(보통 비방호) + visor
  let headFace = (hm && hm.head_face) || fb.head_face;
  const visor = getAccessoriesForSlot(unit, 'head_face', aspect);
  if (visor.length > 0) headFace = compositeSlotWithAccessories(headFace, visor);
  // head_temporal: 헬멧만 (보호구 없음)
  const headTemporal = (hm && hm.head_temporal) || (hm && hm.head_skull) || fb.head_skull;

  const armsSlot = getProtectionSlotByAspect(unit, 'arms', aspect) || fb.arms;
  return {
    head_skull:    headSkull,
    head_temporal: headTemporal,
    head_face:     headFace,
    neck:          getProtectionSlotByAspect(unit, 'neck',    aspect) || fb.neck,
    chest:         getProtectionSlotByAspect(unit, 'chest',   aspect) || fb.chest,
    abdomen:       getProtectionSlotByAspect(unit, 'abdomen', aspect) || fb.abdomen,
    arms:          armsSlot,
    left_arm:      armsSlot,    // 좌/우 동일 protection slot. 내구도는 분리.
    right_arm:     armsSlot,
    legs:          getProtectionSlotByAspect(unit, 'legs',    aspect) || fb.legs,
  };
}
function getProtectionProfile(u, aspect) {
  const k = (u.bodyArmorId||'')+'|'+(u.helmetId||'')+'|'+(u.frontPlateId||'')+'|'+(u.backPlateId||'')+'|'+(u.sidePlateId||'')
          +'|'+(u.groinGuardId||'')+'|'+(u.shoulderGuardId||'')+'|'+(u.neckGuardId||'')+'|'+(u.visorId||'')+'|'+(u.slaapId||'')
          +'|'+(aspect||'');
  if (u._protCacheKey !== k) { u._protCache = buildUnitProtection(u, aspect); u._protCacheKey = k; }
  return u._protCache;
}
// SIDE-FIRE-1A: head 계열 확률 상한 — 초과분 chest/abdomen 재분배 (정규화 전 tbl 대상)
function _fcApplyHeadCap(tbl, fc, confirmShot) {
  if (!fc || !fc.modifiers || confirmShot) return;
  const cap = fc.modifiers.headChanceCap;
  const headKeys = ['head_skull', 'head_temporal', 'head_face', 'neck'];
  let total = 0; for (const k in tbl) total += tbl[k];
  if (total <= 0) return;
  let headSum = 0; for (const k of headKeys) headSum += (tbl[k] || 0);
  const headFrac = headSum / total;
  if (headFrac > cap && headSum > 0) {
    const scale = (cap * total) / headSum;
    let excess = 0;
    for (const k of headKeys) { const old = tbl[k] || 0; const nw = old * scale; excess += (old - nw); tbl[k] = nw; }
    tbl.chest = (tbl.chest || 0) + excess * 0.6;
    tbl.abdomen = (tbl.abdomen || 0) + excess * 0.4;
  }
}
function rollHitLocation(target, shooter, aimQuality, hitAspect, ctx) {
  // stance 매핑 — 'downed'/'prone' 모두 prone 테이블 사용
  const rawStance = target.stance || 'standing';
  const stanceKey = (rawStance === 'downed') ? 'prone' : rawStance;
  const baseTable = HIT_LOC_TABLES[stanceKey] || HIT_LOC_TABLES.standing;
  // SIDE-FIRE-1A: fireControl이 있으면 placementAimQuality로 세부 부위 조준 능력 결정 (탄도 명중과 분리)
  const _fc = shooter && shooter._fireControl;
  const _fcActive = !!(_fc && _fc.shooter === shooter && _fc.modifiers);
  const aqIn = _fcActive ? _fc.placementAimQuality : aimQuality;
  const aq = Math.max(0, Math.min(1, aqIn || 0));
  let ws = (shooter && shooter.skill && shooter.skill.weakspot) || 1.0;
  if (_fcActive) ws *= _fc.modifiers.weakspotMul;

  // === 방향별 보정 ===
  //   front: head_temporal 약간 ↓ (정면에선 측두부 잘 안 보임)
  //   side : head_temporal 크게 ↑, head_face ↓
  //   rear : head_face 거의 0, skull/temporal/neck ↑
  let aspectAdj = baseTable;
  if (hitAspect) {
    aspectAdj = Object.assign({}, baseTable);
    if (hitAspect === 'front') {
      // 정면 — head_temporal 더 낮춤
      aspectAdj.head_temporal = (aspectAdj.head_temporal || 0) * 0.50;
    } else if (hitAspect === 'side' || hitAspect === 'left' || hitAspect === 'right') {
      aspectAdj.arms          = (aspectAdj.arms          || 0) * 1.30;
      aspectAdj.head_skull    = (aspectAdj.head_skull    || 0) * 1.10;
      aspectAdj.head_temporal = (aspectAdj.head_temporal || 0) * 2.20;   // 측두부 크게 ↑
      aspectAdj.neck          = (aspectAdj.neck          || 0) * 1.15;
      aspectAdj.head_face     = (aspectAdj.head_face     || 0) * 0.50;
      aspectAdj.legs          = (aspectAdj.legs          || 0) * 0.90;
    } else if (hitAspect === 'rear') {
      aspectAdj.head_face     = (aspectAdj.head_face     || 0) * 0.05;
      aspectAdj.head_skull    = (aspectAdj.head_skull    || 0) * 1.30;
      aspectAdj.head_temporal = (aspectAdj.head_temporal || 0) * 1.20;   // 뒤에선 측두부 약간 ↑
      aspectAdj.neck          = (aspectAdj.neck          || 0) * 1.25;
      aspectAdj.arms          = (aspectAdj.arms          || 0) * 0.75;
      aspectAdj.chest         = (aspectAdj.chest         || 0) * 1.05;
      aspectAdj.abdomen       = (aspectAdj.abdomen       || 0) * 1.05;
    }
    // 정규화
    let s = 0; for (const k in aspectAdj) s += aspectAdj[k];
    if (s > 0) for (const k in aspectAdj) aspectAdj[k] /= s;
  }

  // SIDE-HITLOC-COVER-EXPOSURE-1A / 1B: half-cover 상호작용별 피격부위 보정
  const _exp = ctx || _hitCoverExposure;
  if (_exp && _exp.band) {
    if (_exp.kind === 'penetrated') {
      // 관통 후 — 하복부/골반/허벅지/다리 중심 (over와 반대). 절대 분포로 재구성.
      const PEN_TABLE = {
        contact: { head_skull:0.022, head_temporal:0.005, head_face:0.005, neck:0.010, chest:0.140, abdomen:0.360, arms:0.075, legs:0.383 },
        near:    { head_skull:0.030, head_temporal:0.008, head_face:0.007, neck:0.012, chest:0.210, abdomen:0.310, arms:0.100, legs:0.323 },
        mid:     { head_skull:0.045, head_temporal:0.012, head_face:0.010, neck:0.013, chest:0.300, abdomen:0.270, arms:0.120, legs:0.230 },
      }[_exp.band];
      if (PEN_TABLE) {
        let pm = Object.assign({}, PEN_TABLE);
        // 탄 안정성 낮으면 하체 편중 약화 → 가슴/팔(인접 몸통)로 분산. 머리는 거의 올리지 않음.
        if (_exp.stability != null && _exp.stability < 0.5) {
          const spread = 0.55 * (1 - _exp.stability / 0.5);   // stab 0 → 0.55, stab 0.5 → 0
          const moveLegs = pm.legs * spread * 0.45;
          const moveAbd  = pm.abdomen * spread * 0.25;
          pm.legs -= moveLegs; pm.abdomen -= moveAbd;
          const moved = moveLegs + moveAbd;
          pm.chest += moved * 0.62; pm.arms += moved * 0.30;
          pm.head_skull += moved * 0.05; pm.neck += moved * 0.03;
        }
        let ps = 0; for (const k in pm) ps += pm[k];
        if (ps > 0) for (const k in pm) pm[k] /= ps;
        aspectAdj = pm;
      }
      // far → 일반 테이블 유지 (단 stability 낮으면 하체로 약간 편중시켜 관통 흔적 유지 + 분산)
      else if (_exp.stability != null && _exp.stability < 0.5) {
        const fm = Object.assign({}, aspectAdj);
        const spread = 0.20 * (1 - _exp.stability / 0.5);
        fm.legs = (fm.legs || 0) * (1 + spread * 0.5);
        fm.abdomen = (fm.abdomen || 0) * (1 + spread * 0.3);
        let fs = 0; for (const k in fm) fs += fm[k]; if (fs > 0) for (const k in fm) fm[k] /= fs;
        aspectAdj = fm;
      }
    } else {
      // over (엄폐물 위로 넘어간 탄) — 상체/머리/팔 위주, 하복부/다리 억제
      const EXP_MUL = {
        contact: { abdomen:0.10, legs:0.10, chest:1.40, arms:1.30, head_skull:1.20, head_temporal:1.20, head_face:1.20, neck:1.15 },
        near:    { abdomen:0.30, legs:0.30, chest:1.30, arms:1.15, head_skull:1.10, head_temporal:1.10, head_face:1.10, neck:1.05 },
        mid:     { abdomen:0.65, legs:0.60, chest:1.12, arms:1.05 },
        far:     { abdomen:0.92, legs:0.85 },
      }[_exp.band] || {};
      const em = Object.assign({}, aspectAdj);
      for (const k in em) if (EXP_MUL[k] != null) em[k] = em[k] * EXP_MUL[k];
      let es = 0; for (const k in em) es += em[k];
      if (es > 0) for (const k in em) em[k] /= es;
      aspectAdj = em;
    }
  }
  // 확인사격용 — prone + unconscious + 시간 흐름 시 머리/가슴 비중 증가
  //   고정 표적이므로 사수가 머리/가슴을 노림. 팔/다리는 덜 노린다.
  if (stanceKey === 'prone' && target.isDowned && !target.conscious
      && typeof target.downedTime === 'number' && target.downedTime >= 1.0) {
    // 1초 이상 정적이면 효과 적용 (시간이 길수록 강함, 최대 3초 기준)
    const t = Math.min(1, (target.downedTime - 1.0) / 2.0);
    const adj = Object.assign({}, aspectAdj);
    adj.head_skull    = (adj.head_skull    || 0) * (1 + 0.8 * t);
    adj.head_temporal = (adj.head_temporal || 0) * (1 + 0.7 * t);
    adj.chest         = (adj.chest         || 0) * (1 + 0.6 * t);
    adj.arms          = (adj.arms          || 0) * (1 - 0.5 * t);
    adj.legs          = (adj.legs          || 0) * (1 - 0.5 * t);
    let s2 = 0; for (const k in adj) s2 += adj[k];
    if (s2 > 0) for (const k in adj) adj[k] /= s2;
    aspectAdj = adj;
  }

  // aq가 낮으면 (보정된) 기본 테이블 그대로 — 단 headChanceCap은 적용
  if (aq <= 0.001) {
    const t2 = Object.assign({}, aspectAdj);
    _fcApplyHeadCap(t2, _fcActive ? _fc : null, (target.isDowned && !target.conscious));
    let s2 = 0; for (const k in t2) s2 += t2[k];
    if (s2 > 0) for (const k in t2) t2[k] /= s2;
    const r = Math.random(); let acc = 0;
    for (const loc in t2) { acc += t2[loc]; if (r < acc) return loc; }
    return 'chest';
  }

  // 보정 테이블 복사 (aspectAdj 기준으로 재시작)
  const tbl = Object.assign({}, aspectAdj);

  // 팔/다리에서 빼낼 비율 (최대 ~50% × weakspot)
  const reduction = Math.min(0.55, 0.5 * aq * ws);
  const reduceArms = (tbl.arms || 0) * reduction;
  const reduceLegs = (tbl.legs || 0) * reduction;
  const totalReduce = reduceArms + reduceLegs;
  tbl.arms = Math.max(0, (tbl.arms || 0) - reduceArms);
  tbl.legs = Math.max(0, (tbl.legs || 0) - reduceLegs);

  // 분배 — 가슴/복부 우선, 머리 보너스는 작게
  // weakspot이 높을수록 머리 비율 ↑
  const headShare = 0.18 + 0.18 * Math.min(1.5, ws - 0.5); // ws=1.0 → 0.27, ws=1.3 → 0.32, ws=0.85 → 0.20
  const torsoShare = 1.0 - headShare;
  // 가슴 60%, 복부 40% (몸통 내 분배)
  tbl.chest   = (tbl.chest   || 0) + totalReduce * torsoShare * 0.60;
  tbl.abdomen = (tbl.abdomen || 0) + totalReduce * torsoShare * 0.40;
  // 머리 분배: skull 60% / face 25% / neck 15%
  tbl.head_skull = (tbl.head_skull || 0) + totalReduce * headShare * 0.60;
  tbl.head_face  = (tbl.head_face  || 0) + totalReduce * headShare * 0.25;
  tbl.neck       = (tbl.neck       || 0) + totalReduce * headShare * 0.15;

  // 합계 정규화 (수치 오차 방지)
  let sum = 0;
  for (const k in tbl) sum += tbl[k];
  if (sum > 0) for (const k in tbl) tbl[k] /= sum;

  // SIDE-FIRE-1A: headChanceCap — head 계열 합산 상한, 초과분 chest/abdomen 재분배. downed unconscious 확인사격 예외.
  if (_fcActive) _fcApplyHeadCap(tbl, _fc, (target.isDowned && !target.conscious));
  // 재정규화
  let sum2 = 0; for (const k in tbl) sum2 += tbl[k];
  if (sum2 > 0) for (const k in tbl) tbl[k] /= sum2;

  const r = Math.random(); let acc = 0;
  for (const loc in tbl) { acc += tbl[loc]; if (r < acc) return loc; }
  return 'chest';
}
// =============================================================
// 내구도 슬롯 매핑 — 피격 location + aspect + protectionType → durability key
// =============================================================
function getDurabilitySlotKey(location, aspect, protectionType) {
  if (protectionType === 'none') return null;
  // 헬멧
  if (location === 'head_skull')    return protectionType === 'hard' ? 'head_skull_shell' : null;
  if (location === 'head_temporal') return protectionType === 'hard' ? 'head_temporal_shell' : null;
  if (location === 'head_face')     return protectionType === 'hard' ? 'head_face_visor' : null;
  if (location === 'neck')          return protectionType === 'soft' ? 'neck_soft' : null;
  // 팔 — left/right만 받음. arms는 호출자가 변환 책임.
  //   만약 arms가 들어오면 안전 fallback으로 50/50 랜덤.
  if (location === 'arms') {
    location = (Math.random() < 0.5) ? 'left_arm' : 'right_arm';
  }
  if (location === 'left_arm')  return 'left_arm_soft';
  if (location === 'right_arm') return 'right_arm_soft';
  // 가슴/복부 — aspect로 슬롯 결정. side는 left/right로 강제 변환.
  let aspKey;
  if (aspect === 'front' || aspect === 'rear' || aspect === 'left' || aspect === 'right') {
    aspKey = aspect;
  } else if (aspect === 'side') {
    aspKey = (Math.random() < 0.5) ? 'left' : 'right';
  } else {
    aspKey = 'front';   // 마지막 안전 fallback
  }
  // 측면 hard는 chest/abdomen 공통 — left_side_hard / right_side_hard 통합 슬롯
  if (protectionType === 'hard' && (aspKey === 'left' || aspKey === 'right')) {
    if (location === 'chest' || location === 'abdomen') {
      return aspKey === 'left' ? 'left_side_hard' : 'right_side_hard';
    }
  }
  if (location === 'chest') {
    return protectionType === 'hard' ? `chest_${aspKey}_hard` : `chest_${aspKey}_soft`;
  }
  if (location === 'abdomen') {
    return protectionType === 'hard' ? `abdomen_${aspKey}_hard` : `abdomen_${aspKey}_soft`;
  }
  return null;
}

// 내구도 비율로 armor 값 보정
function applyDurabilityToArmor(target, durabilitySlotKey, armorValue, material, localZone, materialHint) {
  if (!target.armorDurability || !durabilitySlotKey) return armorValue;
  const d = target.armorDurability[durabilitySlotKey];
  if (!d || !d.max) return armorValue;
  const ratio = d.current / d.max;
  // PRETRAUMA-STAB-1 §4.2: materialHint(zone 재질, 예: K6-3 glass/titanium)가 있으면 슬롯 'mixed'보다 우선.
  //   normalizeDurabilityMaterial이 zoneHint 우선 처리 — mixed는 계산 재질로 유입 금지.
  const mat = normalizeDurabilityMaterial(d.durabilityMaterial || d.material || material, materialHint || null, 'composite');
  let mul = getDurabilityArmorMul(mat, ratio);
  // SIDE-ARMOR-DURABILITY-REALISM-1 §13: localZone이 전달되면 국부 손상 배율 반영 (현재 호출부는 미전달 = A안 기록 전용. 다음 패치에서 연결)
  if (localZone) mul *= getArmorLocalZoneMul(target, durabilitySlotKey, localZone);
  return armorValue * mul;
}

// =============================================================
// applyArmorDurabilityDamage — 피격 시 내구도 감소
// =============================================================
//   resolveImpact에서 호출. protection 결과 + ammo + outcome 기반.
//   hard/soft 둘 다 손상 가능 (hard_pen_soft_block 시 둘 다).
// SIDE-AAR-ARMOR-DAMAGE-MAP §2.2: computeArmorDurabilityDamage info → AAR용 compact 요약 (객체/함수/순환참조 미포함, 숫자 반올림)
function buildArmorDamageAarInfo(info, t, d, prev, after, localZone, kin) {
  const eJ = (kin && kin.hasKinetics) ? kin.impactEnergyJ : null;
  const mNs = (kin && kin.hasKinetics) ? kin.impactMomentumNs : null;
  return {
    slotKey: t.key, layer: t.layer, sourceId: d.sourceId || null,
    material: info.material, materialProfileKey: info.materialProfileKey, threatClass: info.threatClass,
    localZone: localZone || null,
    globalAmount: +Number(info.globalAmount || 0).toFixed(2),
    localAmount: +Number(info.localAmount || 0).toFixed(2),
    before: +Number(prev || 0).toFixed(1), after: +Number(after || 0).toFixed(1), max: +Number(d.max || 0).toFixed(1),
    afterRatio: d.max ? +(after / d.max).toFixed(3) : null,
    damageKind: info.damageKind || null, damageMode: info.damageMode || null,
    aarLabel: info.aarLabel || (typeof getArmorDamageModeLabelKo === 'function' ? getArmorDamageModeLabelKo(info.damageMode) : info.damageMode),
    impactEnergyJ: eJ != null ? Math.round(eJ) : null,
    impactMomentumNs: mNs != null ? +mNs.toFixed(2) : null,
    energyRatio: info.energyRatio != null ? +info.energyRatio.toFixed(3) : null,
    momentumRatio: info.momentumRatio != null ? +info.momentumRatio.toFixed(3) : null,
    localShare: info.localShare != null ? +info.localShare.toFixed(3) : null,
    globalShare: info.globalShare != null ? +info.globalShare.toFixed(3) : null,
    spallRiskDelta: info.spallRiskDelta || 0, coatingDamageDelta: info.coatingDamageDelta || 0,
    neighborSplashAmount: info.neighborSplashAmount || 0, visibilityDamageDelta: info.visibilityDamageDelta || 0,
    backfaceDeformationHint: info.backfaceDeformationHint || 0, residualStrengthHint: info.residualStrengthHint != null ? info.residualStrengthHint : null,
    stateTags: info.stateTags || [],
    // SIDE-ARMOR-PENETRATION-LOCALITY §12: 관통 국부화/cap 표시 플래그
    penetrationLocalityRebalance: !!info.penetrationLocalityRebalance,
    globalCapApplied: !!info.globalCapApplied,
    localBoostApplied: !!info.localBoostApplied,
    cappedGlobalBefore: info.cappedGlobalAmountBefore != null ? info.cappedGlobalAmountBefore : null,
    cappedGlobalAfter: info.cappedGlobalAmountAfter != null ? info.cappedGlobalAmountAfter : null,
    localSeverity: info.localSeverity != null ? info.localSeverity : null,
  };
}
// SIDE-KORUND-FRONTSET §4: 강철 플레이트 반복 피격 → 누적 spall/coating 기반 얕은 파편상 (낮은 확률, 팔/얼굴/목 중심의 제한적 부상)
function _pickSteelSpallPart(aspect, slotKey) {
  const isRear = /rear/.test(slotKey) || /rear/.test(aspect || '');
  const isSide = /side/.test(slotKey) || aspect === 'side';
  let table;
  if (isRear) table = [['neck',20],['left_arm',22],['right_arm',22],['none',36]];                              // §5 후면: face 거의 0
  else if (isSide) table = [['left_arm',45],['face',12],['neck',8],['chest',15],['abdomen',8],['none',12]];
  else table = [['left_arm',28],['right_arm',28],['face',18],['neck',8],['chest',8],['abdomen',4],['none',6]]; // front
  let tot=0; for (const e of table) tot+=e[1];
  let roll=Math.random()*tot;
  for (const e of table) { roll-=e[1]; if (roll<=0) return e[0]; }
  return 'none';
}
function maybeApplySteelArmorSpallWound(ctx) {
  const target = ctx.target, d = ctx.durabilitySlot, info = ctx.armorInfo;
  if (!target || !target.medical || target.isDead) return null;
  if (!d || !info) return null;
  const mat = ctx.spallMaterialType || d.durabilityMaterial || d.material;
  // SIDE-FRAGMENT-CLUSTER-TRAIT-MATERIAL-SPALL-1: 재질별 스폴 특성 (steel 고정 → 재질 분화). SIDE-MATERIAL-SPALL-GATE-HOTFIX-1: 호출부에서 넘긴 재질 우선.
  const _spallProfile = ctx.spallProfile || getSpallProfileForMaterial(mat);
  const _spallMatType = _spallProfile.spallMaterialType || getSpallProfileForMaterial(mat).spallMaterialType;
  // 소프트 재질(aramid/pe)은 스폴보다 둔상 중심 — 스폴 생성 안 함 (blunt trauma는 별도 시스템)
  if (_spallProfile.bluntBias) return null;
  // §4.4 필수: spall 신호 + 하드 재질 damageMode + 에너지 + hard plate
  const hasSpallSignal = (info.spallRiskDelta > 0) || (info.stateTags && info.stateTags.indexOf('spall_risk') >= 0);
  if (!hasSpallSignal) return null;
  if (!/^(steel|ceramic|aluminum|titanium|composite|glass)_/.test(info.damageMode || '')) return null;
  const eJ = (ctx.kinetics && ctx.kinetics.impactEnergyJ) || info.impactEnergyJ || 0;
  if (eJ < 350) return null;
  const tc = info.threatClass || '';
  if (/pistol/.test(tc) || tc === 'shotgun_buck' || tc === 'flechette') return null;   // §4.4 제외
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const nearOM = !!info.nearOvermatch || (info.stateTags && info.stateTags.indexOf('near_overmatch') >= 0);
  // §4.4 결과 게이트: stopped / partial / ricochet / near-overmatch만 (관통-only는 제외)
  const ar = ctx.armorResult || '';
  if (!(ar === 'stopped' || ar === 'partial_or_backer_stopped' || ar === 'ricochet' || nearOM)) return null;
  // §4.4 누적 게이트
  const spallRisk = d.spallRisk || 0, coatingDamage = d.coatingDamage || 0;
  if (spallRisk < 0.12 && coatingDamage < 12) return null;
  // §4.8 cooldown — slotKey + shotId(없으면 gameTime 기반) / 같은 slot 0.15s 재발동 금지
  const gt = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (!target._armorSpallCooldown) target._armorSpallCooldown = {};
  if (!target._lastArmorSpallTimeBySlot) target._lastArmorSpallTimeBySlot = {};
  const cdKey = ctx.slotKey + ':' + (ctx.shotId != null ? ctx.shotId : (ctx.eventId != null ? 'e'+ctx.eventId : Math.floor(gt * 10)));
  if (target._armorSpallCooldown[cdKey]) return null;
  const lastT = target._lastArmorSpallTimeBySlot[ctx.slotKey];
  if (lastT != null && (gt - lastT) < 0.15) return null;
  // §4.5 확률
  let chance = 0;
  chance += clamp((spallRisk - 0.12) * 0.75, 0, 0.28);
  chance += clamp((coatingDamage - 10) / 100 * 0.35, 0, 0.25);
  chance += clamp((info.localAmount || 0) / 100, 0, 0.10);
  if (nearOM) chance += 0.08;
  if (/penetrator|high_power_ap|anti_material/.test(tc)) chance += 0.08;
  if (eJ >= 900) chance += 0.05;
  if (info.localZone === 'edge') chance += 0.05;
  if (coatingDamage < 20) chance *= 0.45;
  if (/rear/.test(ctx.slotKey) || /rear/.test(ctx.aspect || '')) chance *= 0.25;   // §5 후면 0.25배
  chance *= (_spallProfile.spallChanceMul != null ? _spallProfile.spallChanceMul : 1.0);   // 재질별 스폴 확률 배수 (steel=1.0 기준)
  chance = clamp(chance, 0, 0.42);
  if (Math.random() >= chance) return { triggered:false, spallChance:+chance.toFixed(3), spallRisk:+spallRisk.toFixed(3), coatingDamage:+coatingDamage.toFixed(1) };
  // === 발동 ===
  target._armorSpallCooldown[cdKey] = true;
  target._lastArmorSpallTimeBySlot[ctx.slotKey] = gt;
  const part = _pickSteelSpallPart(ctx.aspect, ctx.slotKey);
  if (part === 'none') return { triggered:false, part:'none', spallChance:+chance.toFixed(3), spallRisk:+spallRisk.toFixed(3), coatingDamage:+coatingDamage.toFixed(1) };
  // §4.7 woundDepth/rawDamage/bleed (얕은 파편상만)
  const r = Math.random();
  let woundDepth, rawDamage, bleed;
  if (r < 0.70) { woundDepth='abrasion'; rawDamage=0.8+Math.random()*1.0; bleed=0.01+Math.random()*0.02; }
  else if (r < 0.95) { woundDepth='superficial_fragment'; rawDamage=1.5+Math.random()*1.5; bleed=0.03+Math.random()*0.04; }
  else { woundDepth='shallow_fragment'; rawDamage=2.5+Math.random()*2.0; bleed=0.06+Math.random()*0.06; }
  let hitPart = part;
  if (part === 'face') hitPart = 'head';                       // face → head (얕은 파편상)
  else if (part === 'chest' || part === 'abdomen') { hitPart = part; woundDepth='abrasion'; rawDamage=Math.min(rawDamage,1.5); bleed=Math.min(bleed,0.02); }  // 표면 찰과만, 내부손상 금지
  rawDamage = +rawDamage.toFixed(2);
  // SIDE-FRAGMENT-CLUSTER-TRAIT-MATERIAL-SPALL-1: 재질별 스폴 질량/에너지 메타 (상향 금지 — material clamp ≤1.0, 표재성 유지). 재질별 massBudget 배수.
  const _spallBudget = buildFragmentMassBudget({ sourceType: 'armor_spall_steel', budgetG: (0.05 + Math.random() * 0.45) * (_spallProfile.massBudgetMul != null ? _spallProfile.massBudgetMul : 1.0), fragmentCount: 1 });
  const _spallMassG = _spallBudget.hazardousFragmentMassBudgetG;   // 1개 → 예산 전체
  _spallBudget.generatedFragmentMassTotalG = +_spallMassG.toFixed(3);
  const _spallVel = 140 + Math.random() * 120;   // 스폴 저속 (탄자보다 훨씬 느림)
  const _spallTrait = getFragmentTraitProfile('armor_spall', mat);
  const _spallBr = computeFragmentEnergyDamageBridge(rawDamage, 2, bleed, _spallMassG, _spallVel, 'armor_spall_steel', _spallBudget.shapeFactor, _spallBudget.stabilityFactor, _spallTrait);
  // 스폴은 상향 금지 — equivalentDamage가 base를 넘지 않음(clamp 상한 ≤1.0×base). depth/표재성은 위 로직 유지.
  const _spallRaw = Math.min(rawDamage, _spallBr.equivalentDamage);
  const _spallClass = (_spallBr.fragmentEnergyClass === 'trace') ? 'armor_spall_trace' : (_spallBr.fragmentEnergyClass === 'low') ? 'armor_spall_small' : 'armor_spall_shallow';
  applyDamageEvent(target, {
    sourceType:'frag', hitPart, rawDamage:_spallRaw, tissueDamage:_spallRaw, penetration:Math.min(2, _spallBr.equivalentPenetration),
    armorResult:'penetrated', isFragment:true, fragmentPenetrated:true, fragmentSize:'small',
    fragmentWoundDepth:woundDepth, bleedRisk:Math.min(bleed, _spallBr.bleedRisk), shockRisk:0.003, painAmount:_spallRaw*1.2,
    ammoId:'armor_spall_' + _spallMatType, weaponId: ctx.weapon && ctx.weapon.id, fragmentKind:'armor_spall',
    impactAddress:{ sourceType:'frag', armorSpall:true, parentSlotKey:ctx.slotKey, parentDamageMode:info.damageMode, parentLocalZone:info.localZone, fragArmorLayer:'none', fragArmorResult:'penetrated' },
    spallClass: _spallClass, spallMaterialType: _spallMatType,
    fragmentShapeFactor: _spallBr.fragmentShapeFactor, fragmentStabilityFactor: _spallBr.fragmentStabilityFactor, fragmentSharpness: _spallBr.fragmentSharpness, fragmentDragFactor: _spallBr.fragmentDragFactor, fragmentTumblingChance: _spallBr.fragmentTumblingChance,
    fragmentEnergyMeta: { fragmentMassG:+_spallMassG.toFixed(4), fragmentVelocityMps:+_spallVel.toFixed(1), fragmentEnergyJ:_spallBr.fragmentEnergyJ, fragmentEnergyClass:_spallBr.fragmentEnergyClass,
      fragmentSource:'armor_spall', spallClass:_spallClass, spallMaterialType:_spallMatType, sourceMassBudgetG:_spallBudget.hazardousFragmentMassBudgetG, sourceGeneratedMassTotalG:_spallBudget.generatedFragmentMassTotalG,
      energyBasedDamage:_spallBr.energyDamage, energyBasedPenetration:_spallBr.energyPenetration, equivalentDamage:_spallRaw, equivalentPenetration:Math.min(2, _spallBr.equivalentPenetration), fragmentEnergyDamageBridge:true,
      fragmentShapeFactor:_spallBr.fragmentShapeFactor, fragmentStabilityFactor:_spallBr.fragmentStabilityFactor, fragmentSharpness:_spallBr.fragmentSharpness, fragmentDragFactor:_spallBr.fragmentDragFactor, fragmentTumblingChance:_spallBr.fragmentTumblingChance },
    fragmentMassG:+_spallMassG.toFixed(4), fragmentVelocityMps:+_spallVel.toFixed(1), fragmentEnergyJ:_spallBr.fragmentEnergyJ, fragmentEnergyClass:_spallBr.fragmentEnergyClass,
  });
  // SIDE-DUST-CLOUD-VISUAL-1: 스폴 먼지 (시각 layer — 실제 피해와 별개)
  if (typeof emitDustFromAction === 'function' && target) emitDustFromAction('armor_spall', target.x, target.y, { power: 0.5, override: { color: getFloorDustProfile(_spallMatType).color } });
  return { triggered:true, part:hitPart, woundDepth, rawDamage, spallMaterialType:_spallMatType, spallChance:+chance.toFixed(3), spallRisk:+spallRisk.toFixed(3), coatingDamage:+coatingDamage.toFixed(1) };
}
function maybeApplyArmorMaterialSpallWound(ctx) { return maybeApplySteelArmorSpallWound(ctx); }

function applyArmorDurabilityDamage(target, weapon, protection, stopStage, penetrated, location, aspect, opts) {
  if (!target.armorDurability) return;
  if (!protection || protection.protectionType === 'none') return;
  const ammo = weapon && weapon._ammo;
  if (!ammo) return;

  // 어느 슬롯들이 손상받는지
  //   hard_block: hard 슬롯만
  //   soft_block: soft 슬롯만
  //   hard_pen_soft_block: hard + soft 둘 다
  //   pen (관통): 관통한 모든 레이어
  const targets = [];
  const hardKey = getDurabilitySlotKey(location, aspect, 'hard');
  const softKey = getDurabilitySlotKey(location, aspect, 'soft');
  if (stopStage === 'hard_block' && hardKey) targets.push({ key: hardKey, layer: 'hard', blocked: true });
  else if (stopStage === 'soft_block' && softKey) targets.push({ key: softKey, layer: 'soft', blocked: true });
  else if (stopStage === 'hard_pen_soft_block') {
    if (hardKey) targets.push({ key: hardKey, layer: 'hard', blocked: false });   // 관통됨
    if (softKey) targets.push({ key: softKey, layer: 'soft', blocked: true });
  } else if (penetrated) {
    // 완전 관통 — 가장 외곽(hard)만 손상 (간단화)
    if (protection.protectionType === 'hard' && hardKey) targets.push({ key: hardKey, layer: 'hard', blocked: false });
    else if (protection.protectionType === 'soft' && softKey) targets.push({ key: softKey, layer: 'soft', blocked: false });
  }

  // HOTFIX 3-1/3-2: 부속 방호구 슬롯 override — groin_protector→groin_soft, visor_glass(head_face+visorZone)→head_face_visor.
  //   durabilityOwnerId(선택 owner)는 유지, 표시/localZones 슬롯만 교정.
  const _layerT = protection.selectedLayerType || protection._coverageLayerType || '';
  const _slotOverride = (_layerT === 'groin_protector') ? 'groin_soft'
    : ((location === 'head_face' && protection._visorZoneId) ? 'head_face_visor' : null);
  if (_slotOverride) {
    if (!target.armorDurability[_slotOverride]) {
      const _mx = (protection._baseArmor || protection.armorValue || 18) || 18;
      target.armorDurability[_slotOverride] = { current:_mx, max:_mx, material: protection.material || (_slotOverride === 'head_face_visor' ? 'glass' : 'aramid'), durabilityMaterial: protection._zoneDurabilityMaterial || null, localZones:{} };
    }
    for (const t of targets) t.key = _slotOverride;
    if (!targets.length) targets.push({ key:_slotOverride, layer:(_slotOverride === 'head_face_visor' ? 'hard' : 'soft'), blocked: !penetrated });
  }

  for (const t of targets) {
    const d = target.armorDurability[t.key];
    if (!d) continue;
    // SIDE-ARMOR-DURABILITY-REALISM-1 §9: 공통 계산 함수 사용 (baseScale 10 고정식 제거, float 허용)
    // ARMOR-HOTFIX-1 §4/§5: visor zone 재질(glass/titanium) 우선, 'mixed'는 계산 진입 금지
    const breakMat = normalizeDurabilityMaterial(d.durabilityMaterial || d.material || protection.material, protection._zoneDurabilityMaterial, 'composite');
    const armorResult = t.blocked ? 'stopped' : (stopStage === 'hard_pen_soft_block' && t.layer === 'hard' ? 'partial_or_backer_stopped' : 'penetrated');
    // SIDE-AMMO-KINETICS §16: 방호력 보정에 쓴 localZoneHint와 동일 zone 사용 (불일치 금지)
    const localZone = (opts && opts.localZoneHint) || getArmorLocalZoneFromImpact({ subZone: protection._impactSubZone, location, aspect });
    const info = computeArmorDurabilityDamage({
      target, ammo, weapon,
      material: breakMat, durabilityMaterial: breakMat,
      zoneDurabilityMaterial: protection._zoneDurabilityMaterial || null,
      layerType: t.layer === 'soft' ? 'soft' : (protection._visorZoneId ? 'face_shield' : (protection.isHelmet ? 'helmet' : 'hard')),
      slotKey: t.key,
      baseArmor: protection._baseArmor || protection.armorValue || 0,
      effectiveArmor: protection.armorValue,
      // ARMOR-HOTFIX-1 §6 + KINETICS §22: 실제 판정 유효 관통력/속도/운동 — 관통압·마모 동기화
      shotPenOverride: (opts && opts.effectivePenUsed != null) ? opts.effectivePenUsed : undefined,
      impactVelocity: opts && opts.impactVelocity,
      initialVelocity: opts && opts.initialVelocity,
      kinetics: opts && opts.kinetics,
      armorResult, penetrated: !t.blocked,
      localZone,
    });
    // SIDE-AMMO-KINETICS §21: d.current 감소는 globalAmount, localZones 누적은 localAmount
    const globalDmg = info.globalAmount, localDmg = info.localAmount;
    if (globalDmg <= 0 && localDmg <= 0) continue;
    const prev = d.current;
    d.current = Math.max(0, d.current - globalDmg);
    const dmg = globalDmg;   // 로그/AAR 호환
    applyArmorLocalZoneDamage(target, t.key, localZone, localDmg);
    // §18 neighborSplash — 허용 재질만 (ceramic/glass/composite/pe/aramid). steel/titanium/fabric 기본 0
    if (info.neighborSplashAmount > 0 && (breakMat === 'ceramic' || breakMat === 'glass' || breakMat === 'composite' || breakMat === 'pe' || breakMat === 'aramid')) {
      const adj = ARMOR_ZONE_NEIGHBORS[localZone] || [];
      const per = info.neighborSplashAmount / Math.max(1, adj.length);
      for (const nz of adj) applyArmorLocalZoneDamage(target, t.key, nz, per);
    }
    // 2A-3.5: AAR 장비 손상 로그
    if (typeof aarArmorLog === 'function' && target && dmg > 0) aarArmorLog(target.id, t.key, prev, d.current, d.sourceId);
    // §21: debug 모드 한정 짧은 손상 요약 (스팸 방지 — debugBallistic일 때만)
    if (typeof GAME !== 'undefined' && GAME.debugBallistic && typeof log === 'function') {
      const _eJ = (opts && opts.kinetics && opts.kinetics.hasKinetics) ? ` ${Math.round(opts.kinetics.impactEnergyJ)}J` : '';
      log(`[armor] ${t.key} ${info.damageMode} g-${globalDmg.toFixed(1)}/l+${localDmg.toFixed(1)} (${info.threatClass}${info.nearOvermatch ? ' near-OM' : ''}${localZone ? ' @' + localZone : ''}${_eJ})`, 'info');
    }
    // 임계값 로그 (75/50/25/0 통과 시만 — 스팸 방지)
    const prevPct = prev / d.max, newPct = d.current / d.max;
    const thresholds = [0.75, 0.50, 0.25, 0.0];
    for (const th of thresholds) {
      if (prevPct > th && newPct <= th) {
        const equipName = (PLATE_PRESETS[d.sourceId] && PLATE_PRESETS[d.sourceId].shortName)
                       || (HELMET_PRESETS[d.sourceId] && HELMET_PRESETS[d.sourceId].shortName)
                       || (PROTECTION_ACCESSORY_PRESETS[d.sourceId] && PROTECTION_ACCESSORY_PRESETS[d.sourceId].shortName)
                       || d.sourceId;
        const kindKo = ({ surface_damage:'표면 손상', metal_deformation:'금속 변형', metal_perforation:'금속 관통', brittle_crack:'균열', brittle_shatter:'파쇄', glass_crack:'유리 균열', delamination:'층간박리', fiber_failure:'섬유 손상', backface_deformation:'후면 변형', spall_risk:'스폴 위험', fabric_damage:'외피 손상', ceramic_crack:'균열', metal_dent:'변형', fiber_deformation:'섬유 변형', perforation:'관통 손상', backer_deformation:'백커 변형', surface_scuff:'표면 손상' })[info.damageKind] || '손상';
        const msg = th === 0
          ? `[${target.name}] ${equipName} 파괴됨`
          : `[${target.name}] ${equipName} ${kindKo} (${Math.round(newPct*100)}%)`;
        if (typeof log === 'function') log(msg, th <= 0.25 ? 'danger' : 'warn');
        break;
      }
    }
    // §19 spall/coating — info.spallRiskDelta/coatingDamageDelta 반영 (steel/titanium 중심, helper가 결정)
    if (info.spallRiskDelta > 0) d.spallRisk = Math.min(1, (d.spallRisk || 0) + info.spallRiskDelta);
    if (info.coatingDamageDelta > 0) d.coatingDamage = Math.min(100, (d.coatingDamage || 0) + info.coatingDamageDelta);
    // §11.5/§20 glass visibility + backface 힌트 저장 (AAR/debug/후속 둔상용 — 즉시 AI/명중률 연결 안 함)
    if (info.visibilityDamageDelta > 0) d.visibilityDamage = Math.min(100, (d.visibilityDamage || 0) + info.visibilityDamageDelta);
    if (info.backfaceDeformationHint > 0) { d.lastBackfaceDeformation = info.backfaceDeformationHint; d.backfaceDeformationAccum = (d.backfaceDeformationAccum || 0) + info.backfaceDeformationHint; }
    // SIDE-KORUND-FRONTSET §4.9: spall/coating 누적 후 → 강철 스폴 얕은 파편상 시도 (steel 한정, helper가 확률/제외 판정)
    let spallWoundInfo = null;
    // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 장갑 피격 먼지 (재질 인지 — ceramic/glass면 밝은 분진↑)
    if (typeof emitDustFromAction === 'function' && target) emitDustFromAction('armor_hit', target.x, target.y, { power: 0.5, armorMaterial: breakMat });
    // SIDE-MATERIAL-SPALL-GATE-HOTFIX-1: steel 전용 gate → 재질 프로파일 기반 (steel/ceramic/aluminum/titanium/composite/glass 허용, aramid/PE는 bluntBias로 둔상 유지)
    const _spallProf = getSpallProfileForMaterial(breakMat);
    if (_spallProf && !_spallProf.bluntBias && _spallProf.spallChanceMul > 0) {
      spallWoundInfo = maybeApplySteelArmorSpallWound({
        target, shooter: (opts && opts.shooter) || (weapon && weapon._shooter) || null, weapon, ammo,
        slotKey: t.key, durabilitySlot: d, armorInfo: info, armorResult, location, aspect, localZone,
        impactAddress: opts && opts.impactAddress, kinetics: opts && opts.kinetics,
        eventId: opts && opts.eventId, shotId: opts && opts.shotId,
        spallMaterialType: breakMat, spallProfile: _spallProf,
      });
    }
    // SIDE-AAR-ARMOR-DAMAGE-MAP §2.2 + KORUND §6.1: AAR용 compact 손상 요약 push (현재 누적 spall/coating + spallWoundInfo 포함)
    if (opts && Array.isArray(opts.armorDamageInfos)) {
      const _ari = buildArmorDamageAarInfo(info, t, d, prev, d.current, localZone, opts.kinetics);
      _ari.spallRiskAccum = +Number(d.spallRisk || 0).toFixed(3);
      _ari.coatingDamageAccum = +Number(d.coatingDamage || 0).toFixed(1);
      if (spallWoundInfo && spallWoundInfo.triggered) _ari.spallWoundInfo = spallWoundInfo;
      opts.armorDamageInfos.push(_ari);
    }
  }
  // 캐시 무효화 (방호 재계산 필요)
  target._protCacheKey = null;
}

// === 방호 롤백 어댑터: legacy rollProtection 결과 → 최신 시스템이 읽는 armorHitResult 번역층 (재판정 금지) ===
function _legacyArmorHitResultAdapter(protection, impactAddress, location, aspect, target) {
  if (!protection) return null;
  const pt = protection.protectionType;
  let selectedLayerType = null;
  if (pt === 'hard') {
    if (protection.isHelmet) selectedLayerType = 'helmet';
    else if (protection._visorZoneId) selectedLayerType = 'face_shield';
    else if (aspect === 'left' || aspect === 'right' || aspect === 'side') selectedLayerType = 'side_hard_plate';
    else if (aspect === 'rear' || aspect === 'back') selectedLayerType = 'rear_hard_plate';
    else selectedLayerType = 'front_hard_plate';
  } else if (pt === 'soft') {
    selectedLayerType = protection.isHelmet ? 'helmet' : 'soft';
  }
  const durabilityOwnerId = protection._durabilityKey || (protection._plateMeta && protection._plateMeta.id) || (target && target.bodyArmorId) || null;
  return {
    sourceModel: 'legacy_adapter', _legacy: true,
    selectedLayerType, coverageSource: null,
    durabilityOwnerId, durabilityOwnerType: selectedLayerType,
    effectiveArmor: protection.armorValue || 0,
    protectionType: pt, material: protection.material || null,
    impactAddress: impactAddress || null,
    armorResult: null, backerResidualPen: null,
  };
}
// === SIDE-MED-BALLISTIC-2C-1: entryArmorContext — legacy 방호 결과를 의료/탄도용으로 정리 (재판정 아님) ===
function _entryLayerSlot(protection, aspect, location) {
  const pt = protection.protectionType;
  if (protection._visorZoneId) return 'visor';
  if (protection.isHelmet) return pt === 'hard' ? 'helmet_shell' : 'helmet_liner';
  const sideA = (aspect === 'left' || aspect === 'right' || aspect === 'side');
  const rearA = (aspect === 'rear' || aspect === 'back');
  if (pt === 'hard') return sideA ? 'side_plate' : rearA ? 'rear_plate' : 'front_plate';
  if (pt === 'soft') {
    if (location === 'neck') return 'neck_soft';
    if (/arm|leg/.test(location)) return 'limb_soft';
    return sideA ? 'side_soft' : rearA ? 'rear_soft' : 'front_soft';
  }
  return 'none';
}
// =============================================================
// [심층의료 계약면 §9.1 — PRETRAUMA-STAB-1] ballistic → medical 단방향 context.
//   armor는 woundDescriptor에 context(관통/잔여/방호 요약)만 제공한다.
//   의료 시스템을 재판정하지 않고, organ/vessel confirmed injury를 직접 확정하지 않는다.
// =============================================================
function buildEntryArmorContext(o) {
  // o: { protection, location, aspect, hitPart, stopStage, penetrated, ammo, weapon, penVelMul, backerRes, velBefore, velAfter, stabAfter, durabilityKey }
  const p = o.protection || {};
  const pt = p.protectionType || 'none';
  const entryLayerClass = pt;
  const entryLayerSlot = _entryLayerSlot(p, o.aspect, o.location);
  const ss = o.stopStage;
  let entryArmorResult;
  if (ss === 'unprotected_hit' || pt === 'none') entryArmorResult = 'unprotected_hit';
  else if (ss === 'hard_block') entryArmorResult = 'hard_block';
  else if (ss === 'soft_block') entryArmorResult = 'soft_block';
  else if (ss === 'hard_pen_soft_block') entryArmorResult = 'hard_pen_soft_block';
  else if (o.penetrated) entryArmorResult = 'penetrated';
  else entryArmorResult = 'stopped';
  // 진입 전/후 관통력 (결정적 재계산 — 새 RNG roll 없음)
  let penBefore, effArmor = 0;
  if (pt === 'none') { penBefore = (o.ammo && o.ammo.penetration) || 0; effArmor = 0; }
  else {
    const mat = (pt === 'hard') ? (p.hardMaterial || p.material) : p.material;
    penBefore = effectivePenetration(o.ammo, o.weapon, mat) * (o.penVelMul || 1);
    effArmor = (pt === 'hard') ? (p.hardArmor || 0) : (p.softArmor || 0);
  }
  let penAfter;
  const pkt = o.backerRes && o.backerRes.residualThreatPacket;
  if (entryArmorResult === 'penetrated') {
    if (pkt && pkt.residualPen != null) penAfter = pkt.residualPen;
    else penAfter = Math.max(0, penBefore - effArmor * 0.85);
  } else if (entryArmorResult === 'unprotected_hit') {
    penAfter = penBefore;
  } else {
    penAfter = 0;   // hard_block / soft_block / hard_pen_soft_block → 인체 진입 위협 없음(또는 둔상)
  }
  const residualThreatPacket = pkt || (entryArmorResult === 'penetrated' || entryArmorResult === 'unprotected_hit'
    ? { residualPen: +penAfter.toFixed(1), residualKind: pt === 'none' ? 'intact' : 'post_armor', backerEfficiencyMul: 1 } : null);
  return {
    sourceModel: 'legacy_rollProtection',
    hitPart: o.hitPart, location: o.location, entryAspect: o.aspect,
    protectionType: pt, entryLayerClass, entryLayerSlot,
    entryArmorValue: effArmor, entryMaterial: (pt === 'hard') ? (p.hardMaterial || p.material) : (pt === 'soft' ? p.material : null),
    entryDurabilitySlotKey: o.durabilityKey || null,
    entryArmorResult,
    entryPenBeforeArmor: +(penBefore || 0).toFixed(1), entryPenAfterArmor: +(penAfter || 0).toFixed(1),
    entryVelocityBeforeArmor: o.velBefore != null ? Math.round(o.velBefore) : null,
    entryVelocityAfterArmor: o.velAfter != null ? Math.round(o.velAfter) : null,
    entryStabilityAfterArmor: o.stabAfter != null ? o.stabAfter : null,
    backerInfo: o.backerRes ? { backerResult: o.backerRes.backerResult, residualKind: o.backerRes.residualKind, secondaryStopSuccess: !!o.backerRes.secondaryStopSuccess } : null,
    residualThreatPacket,
  };
}
// 후면 방호구 내구도 감소 (전면과 분리)
function applyRearArmorDurabilityDamage(target, slotKey, ammo, rearResult, residualPen, armorValueRef, opts) {
  if (!target || !slotKey || !target.armorDurability) return;
  const d = target.armorDurability[slotKey];
  if (!d || !d.max) return;
  // SIDE-ARMOR-DURABILITY-REALISM-1 §10: 공통 계산 함수 사용 (rearArmor factor 0.9)
  //   residualPen: 인체 통과 후 잔여 관통력 (있으면 원본 ammo.penetration 대신 압력 계산에 사용 — 과대 손상 방지)
  const breakMat = d.durabilityMaterial || d.material || 'composite';
  const armorResult = (rearResult === 'rear_armor_penetrated') ? 'penetrated'
                    : (/partial/.test(rearResult || '') ? 'partial_or_backer_stopped' : 'stopped');
  // 압력 기준값 — armorValueRef(내구도 보정된 rear 방호값) 우선, 없으면 d.baseArmor → source preset → 보수 기본값
  let refArmor = (armorValueRef != null && armorValueRef > 0) ? armorValueRef : d.baseArmor;
  if (refArmor == null || refArmor <= 0) {
    const src = (typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[d.sourceId]) || null;
    if (src && !src.isNone) refArmor = (src.effectiveArmor != null) ? src.effectiveArmor : ((src.hardArmor || 0) + (src.backingArmor || 0));
    if (!refArmor) refArmor = /soft/.test(slotKey) ? 25 : 45;
  }
  // SIDE-AAR-ARMOR-DAMAGE-MAP §15: 후면 localZone 안정 지정 (abdomen→lower, 그 외 center)
  const rearLocalZone = /abdomen/.test(slotKey) ? 'lower' : 'center';
  // 후면은 정확한 충돌속도가 없으므로 muzzle 기준 fallback kinetics (Armor Analysis와 동일 규약)
  const rearKin = (ammo && ammo.velocity) ? computeProjectileKinetics(ammo, ammo.velocity, ammo.velocity) : null;
  const info = computeArmorDurabilityDamage({
    target, ammo,
    material: breakMat, durabilityMaterial: breakMat,
    layerType: /soft/.test(slotKey) ? 'rear_soft' : 'rear_hard',
    slotKey,
    baseArmor: refArmor,
    effectiveArmor: null,
    armorResult, penetrated: armorResult === 'penetrated',
    rearArmor: true, kinetics: rearKin, localZone: rearLocalZone,
    shotPenOverride: (residualPen != null) ? residualPen : undefined,
  });
  // §15: globalAmount → d.current, localAmount → localZones
  const globalDmg = info.globalAmount, localDmg = info.localAmount;
  if (globalDmg <= 0 && localDmg <= 0) return;
  const prev = d.current;
  d.current = Math.max(0, d.current - globalDmg);
  const dmg = globalDmg;
  if (localDmg > 0) applyArmorLocalZoneDamage(target, slotKey, rearLocalZone, localDmg);
  // 보조 손상값 (전면과 동일 규약)
  if (info.spallRiskDelta > 0) d.spallRisk = Math.min(1, (d.spallRisk || 0) + info.spallRiskDelta);
  if (info.coatingDamageDelta > 0) d.coatingDamage = Math.min(100, (d.coatingDamage || 0) + info.coatingDamageDelta);
  if (info.visibilityDamageDelta > 0) d.visibilityDamage = Math.min(100, (d.visibilityDamage || 0) + info.visibilityDamageDelta);
  if (info.backfaceDeformationHint > 0) { d.lastBackfaceDeformation = info.backfaceDeformationHint; d.backfaceDeformationAccum = (d.backfaceDeformationAccum || 0) + info.backfaceDeformationHint; }
  // §15: AAR 배선 — opts.armorDamageInfos가 있으면 layer:'rear'로 push
  if (opts && Array.isArray(opts.armorDamageInfos)) {
    opts.armorDamageInfos.push(buildArmorDamageAarInfo(info, { key: slotKey, layer: 'rear' }, d, prev, d.current, rearLocalZone, rearKin));
  }
  if (typeof aarArmorLog === 'function' && dmg > 0) aarArmorLog(target.id, slotKey, prev, d.current, d.sourceId);
  const prevPct = prev / d.max, newPct = d.current / d.max;
  for (const th of [0.75, 0.50, 0.25, 0.0]) {
    if (prevPct > th && newPct <= th) {
      const equipName = (typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[d.sourceId] && PLATE_PRESETS[d.sourceId].shortName) || d.sourceId;
      if (typeof log === 'function') log(th === 0 ? `[${target.name}] 후면 ${equipName} 파괴됨` : `[${target.name}] 후면 ${equipName} 손상 (${Math.round(newPct*100)}%)`, th <= 0.25 ? 'danger' : 'warn');
      break;
    }
  }
  target._protCacheKey = null;
}
// 인체 완전관통 후 후면 방호 상호작용 (entry 맥락 기반 후보 선택 + 실제 판정 + 내구도)
function resolveRearArmorInteraction(o) {
  // o: { unit, hitPart, entryAspect, entryArmorContext, penAfterBody, ammo, weapon }
  const unit = o.unit, hitPart = o.hitPart;
  const isTorso = (hitPart === 'chest' || hitPart === 'abdomen');
  if (!isTorso) return { rearArmorChecked:false, rearArmorResult:'not_applicable_limb', penAfter:o.penAfterBody, candidate:'none' };
  const exitAspect = ({ front:'rear', rear:'front', left:'right', right:'left' })[o.entryAspect] || 'rear';
  // side-through는 이번 패치 보수적: rear 방호구 없음 처리
  if (exitAspect === 'left' || exitAspect === 'right') return { rearArmorChecked:true, rearArmorResult:'no_rear_armor', penAfter:o.penAfterBody, candidate:'none', exitAspect };
  const ent = o.entryArmorContext || {};
  const plateEff = (pid) => { const p = (typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[pid] : null; if (!p || p.isNone) return 0; return (p.effectiveArmor != null) ? p.effectiveArmor : (p.hardArmor || 0) + (p.backingArmor || 0); };
  // 실제 coverage 검증 — exitAspect+hitPart를 실제로 덮는 hard plate만 후보. (abdomen_rear=frontBack, abdomen_front=frontSet, chest=항상)
  const exitPlate = (typeof getActivePlateForSlot === 'function') ? getActivePlateForSlot(unit, hitPart, exitAspect) : null;
  const exitPlateId = (exitPlate && !exitPlate.isNone) ? exitPlate.id : null;
  const hasExitPlate = !!(exitPlateId && plateEff(exitPlateId) > 0);
  // 출구측 실제 soft armor 값 (getProtectionProfile — legacy coverage). 실제 soft 값이 있을 때만 soft 후보.
  let exitSoftRaw = 0, softMat = 'aramid';
  try {
    const slot = (typeof getProtectionProfile === 'function') ? getProtectionProfile(unit, exitAspect)[hitPart] : null;
    if (slot && slot.soft) { exitSoftRaw = slot.soft.smallArmor || 0; softMat = slot.soft.material || 'aramid'; }
  } catch (e) {}
  const hasSoft = !!unit.bodyArmorId && exitSoftRaw > 0;   // 실제 body armor 보유 + 출구측 soft 값 존재
  // entry 맥락에 따른 후보 가중치
  let preferPlate = false, reason = '';
  if (ent.entryLayerClass === 'hard' && /^(front|rear|side)_plate$/.test(ent.entryLayerSlot || '')) { preferPlate = true; reason = 'hard_plate_penetration_centerline'; }
  else if (ent.entryLayerClass === 'soft') { preferPlate = false; reason = 'front_soft_offplate_path'; }
  else if (ent.entryLayerClass === 'none') { preferPlate = (hitPart === 'chest'); reason = 'unprotected_centerline'; }
  // 후보 선택 — 실제 coverage에 존재하는 것만
  let candidate = 'none', candidateLayer = null, armorValueRaw = 0, material = null, slotPt = null;
  if (preferPlate && hasExitPlate) { candidate = 'rear_plate'; candidateLayer = 'rear_hard_plate'; armorValueRaw = plateEff(exitPlateId); material = (exitPlate.material || exitPlate.hardMaterial || 'composite'); slotPt = 'hard'; }
  else if (hasSoft) { candidate = 'rear_soft'; candidateLayer = (exitAspect === 'rear' ? 'rear_soft' : 'front_soft'); armorValueRaw = exitSoftRaw; material = softMat; slotPt = 'soft'; }
  else if (hasExitPlate) { candidate = 'rear_plate'; candidateLayer = 'rear_hard_plate'; armorValueRaw = plateEff(exitPlateId); material = (exitPlate.material || exitPlate.hardMaterial || 'composite'); slotPt = 'hard'; }
  // 실제 coverage에 hard/soft 어느 것도 없으면 후면 방호구 없음 — slotKey/내구도 생성 안 함
  if (candidate === 'none') return { rearArmorChecked:true, rearArmorResult:'no_rear_armor', penAfter:o.penAfterBody, candidate:'none', candidateReason:reason, exitAspect };
  // slotKey + 내구도 보정된 실제 armorValue
  const slotKey = (typeof getDurabilitySlotKey === 'function') ? getDurabilitySlotKey(hitPart, exitAspect, slotPt) : null;
  const armorValue = (typeof applyDurabilityToArmor === 'function' && slotKey) ? applyDurabilityToArmor(unit, slotKey, armorValueRaw, material) : armorValueRaw;
  // 실제 후면 판정 (legacy rollPenetration) — penAfterBody가 이미 인체 통과 후 잔여
  const penIn = o.penAfterBody;
  const blocked = !rollPenetration(penIn, armorValue);
  const rearResult = blocked ? (candidate === 'rear_plate' ? 'stopped_by_rear_plate' : 'stopped_by_rear_soft') : 'rear_armor_penetrated';
  const penAfter = blocked ? 0 : Math.max(0, o.penAfterBody - armorValue * 0.85);
  // 후면 내구도 감소 (후보로 상호작용한 경우만 — legacy slotKey). 잔여 관통력+보정 방호값 전달로 압력 과대 방지.
  applyRearArmorDurabilityDamage(unit, slotKey, o.ammo, rearResult, penIn, armorValue);
  const ownerId = (candidate === 'rear_plate') ? exitPlateId : unit.bodyArmorId;
  return {
    rearArmorChecked:true, rearArmorInteraction:true, candidate, candidateLayer, candidateReason:reason,
    armorValue:+armorValue.toFixed(1), material, durabilitySlotKey:slotKey, exitAspect,
    penBefore:+o.penAfterBody.toFixed(1), penAfter:+penAfter.toFixed(1), rearArmorResult:rearResult, ownerId,
  };
}
// ════════════════════════════════════════════════════════════════════════════
// 대형 PHASE 7 — 시드 가능한 gameplay RNG (테스트/재현 전용. 게임 시작 동작 불변)
//   createSeededRng(seed): mulberry32 — 결정적 [0,1) 스트림.
//   withSeededGameplayRng(seed, cb): cb 실행 동안 Math.random을 시드 스트림으로 스왑 후 복원.
//     · gameplay 판정(방호/상처/골절/혈관/출혈/펠릿/파편)이 전부 Math.random 경유이므로 이 스왑만으로 재현 가능.
//     · 연출(파티클 등)용은 _cosmeticRand() 사용 시 시드 제외 스트림(native) 유지 — 신규 연출 코드는 이 helper 사용 권장.
// ════════════════════════════════════════════════════════════════════════════
function createSeededRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _nativeRandom = Math.random.bind(Math);
function _cosmeticRand() { return _nativeRandom(); }   // 시드 제외(연출) 스트림
function withSeededGameplayRng(seed, cb) {
  const prev = Math.random;
  Math.random = createSeededRng(seed);
  try { return cb(); } finally { Math.random = prev; }
}
// ════════════════════════════════════════════════════════════════════════════
// PHASE 0 산출물 — PRODUCTION CALL GRAPH (대형 구조공사. 함수 이동 시 이 문서를 갱신할 것)
//
// [PRODUCTION ARMOR PATH]  ← canonical
//   resolveImpact() ──(impactAddress+isLeft 1회 확정)──▶ rollProtection()
//   applyFragmentHit() ──(주소 없음: rollProtection 내부에서 buildCoverageImpactAddress 1회 생성)──▶ rollProtection()
//   rollProtection() ─▶ rollProtectionAddressCoverage() ─▶ collectDeterministicCoverageCandidates()
//                                                         ─▶ selectDeterministicCoverageLayer()
//                                                         ─▶ 내구도/백커/plateMeta (durabilitySlotKey)
// [LEGACY ARMOR FALLBACK PATH]
//   rollProtection() 내부: 결정형 주소 판정 불가 시에만 hardP/softP 확률식 (fallbackUsed 기록)
// [TEST / ANALYSIS ARMOR PATH]  ← PHASE 2에서 canonical로 이관 후 삭제됨
//   (구) rollProtectionCoverageAware / resolveArmorCoverage / collectCoverageCandidates / selectCoverageLayer
//
// [PRODUCTION WOUND PATH]  ← canonical: processWoundEvent() (PHASE 3 오케스트레이터)
//   applyDamageEvent() ─▶ processWoundEvent(unit, ev)
//     A입력정규화 → B순수draft(buildWoundDescriptor) → C단일commit(push) → D골절→bodyPart반영
//     → E cluster연결(assignWoundToTreatmentCluster) → F partDestruction → G vascular최종보강
//     → H bleeding 단일 finalize → I fieldCare/treatmentProfile → J shotgun governor
//     → K cluster refresh → L prune+참조정리 → M invariant 검증(debug)
// [WOUND STATE MUTATION POINTS] C(push), D(bodyPart.fracture), E(cluster), F(partDestruction),
//   H(bleedingProfile 확정), J(group ceiling), L(prune)
// [BLEEDING FINALIZATION POINTS] H 단일 (builder 내부 호출 제거됨 — bp._finalizationCount로 검증)
// [CLUSTER CREATION/REFRESH POINTS] E(생성/합류), K(개별), fireShotgunPellets volley말(그룹), 처치 후(refresh)
// [PRUNING/CLEANUP POINTS] L: _pruneWoundsWithRemovedIds → cleanupPrunedWoundReferences
//
// [BACKEND TREATMENT CLUSTER PATH]  ← 유일 source-of-truth
//   medical.woundClusters + wound.treatmentClusterId + assignWoundToTreatmentCluster/refreshWoundCluster
//   /computeWoundClusterTreatmentCost → UI/처치/AAR 전부 이 membership 사용
// [CURRENT UI TEMP GROUP PATH]  ← PHASE 5에서 제거됨
//   (구) _woundClusterSig/_woundClusterEligible signature 그룹 — buildWoundDisplayRows가 실제 cluster로 교체
// ════════════════════════════════════════════════════════════════════════════
function rollProtection(target, location, aspect, opts) {
  opts = opts || {};
  // === SIDE-ARMOR-DETERMINISTIC-ADDRESS-COVERAGE-1A: 결정형 주소 방호가 source of truth ===
  //   "탄이 도달한 세부주소를 장비가 덮는가"를 확률 없이 결정. 주소 미생성(불명) 시에만 아래 legacy로 fallback.
  if (!opts._noDeterministic) {
    const _hp = (typeof locationToImpactPart === 'function') ? locationToImpactPart(location, opts.isLeft) : location;
    const _addr = opts.impactAddress || buildCoverageImpactAddress(target, _hp, aspect, opts);
    const _det = (typeof rollProtectionAddressCoverage === 'function') ? rollProtectionAddressCoverage(target, _addr) : null;
    if (_det) {
      _det._legacyLocation = location;
      _det.impactAddress = _det.impactAddress || _addr;
      _det.fallbackUsed = false;   // ARMOR-CANONICAL-1: canonical 결정형 경로
      // SIDE-PLATE-DURABILITY-DISPLAY-FIX-1: armorValue를 legacy zone 내구도(슬롯)로 열화 → 표시(armorDurability)와 방호력이 동일 소스.
      //   국부손상(엣지/중앙/상하/측면) armorValue 반영 + 손상기록을 legacy 슬롯이 담당(표시층이 읽음).
      if (_det.protectionType !== 'none') {
        const _lz = _det._localZoneHint || addressZoneToLocalZone(_addr);
        const _durKey = (typeof getDurabilitySlotKey === 'function') ? getDurabilitySlotKey(location, aspect, _det.protectionType) : null;
        // HOTFIX 3-1/3-2: 표시 슬롯 override (groin_protector→groin_soft, visor_glass→head_face_visor)
        const _lt = _det.selectedLayerType || _det._coverageLayerType || '';
        // ABDOMEN-PLATE-SLOT-1: 복부 플레이트가 막았으면 내구도도 복부판 슬롯에 소모 (가슴판 슬롯 아님).
        //   legacy location이 chest여도 선택 레이어가 복부판이면 abdomen 슬롯을 쓴다.
        const _slotLoc = (_lt === 'frontset_abdomen_hard') ? 'abdomen'
                       : (_lt === 'frontset_abdomen_hard_rear') ? 'abdomen'
                       : (_lt === 'front_hard_plate' || _lt === 'rear_hard_plate') ? 'chest'
                       : location;
        const _durKey2 = (typeof getDurabilitySlotKey === 'function') ? getDurabilitySlotKey(_slotLoc, aspect, _det.protectionType) : _durKey;
        _det._durabilityKey = (_lt === 'groin_protector') ? 'groin_soft' : ((location === 'head_face' && _det._visorZoneId) ? 'head_face_visor' : _durKey2);
        if (_det._durabilityKey && typeof applyDurabilityToArmor === 'function') {
          const _base = (_det._baseArmor != null) ? _det._baseArmor : _det.armorValue;
          const _eff = applyDurabilityToArmor(target, _det._durabilityKey, _base, _det.material, _lz, _det._zoneDurabilityMaterial);
          if (_det.protectionType === 'hard') { _det.hardArmor = _eff; _det.armorValue = _eff; }
          else { _det.softArmor = _eff; _det.armorValue = _eff; }
        }
      }
      return _det;
    }
  }
  // ARMOR-CANONICAL-1: 여기부터 legacy fallback — 정상 production 피격에서 지속 발생하면 검증 실패 대상.
  const _fbReason = (opts && opts._noDeterministic) ? 'explicit_noDeterministic' : 'deterministic_address_unresolved';
  if (typeof GAME !== 'undefined') { GAME._armorFallbackCount = (GAME._armorFallbackCount || 0) + 1; }
  // head_face + visorHitTable이 있는 visor면 매 발 영역 sample이 달라져야 함
  //   → 캐시 우회: buildUnitProtection 직접 호출
  let slot;
  if (location === 'head_face' && target.visorId) {
    const a = PROTECTION_ACCESSORY_PRESETS[target.visorId];
    if (a && a.visorHitTable) {
      slot = buildUnitProtection(target, aspect)[location];
    }
  }
  if (!slot) slot = getProtectionProfile(target, aspect)[location];
  if (!slot) return { protectionType:'none', armorValue:0, hardArmor:0, softArmor:0, softBacker:false,
                      material:'fabric', hardMaterial:null, softMaterial:null };
  // 2A-6.3 마감: 추가 보호대(shoulder/groin/neck)는 캐시에 박지 않고 매 피격마다 판정.
  //   compositeSlotWithAccessories는 P()로 새 슬롯을 반환하므로 캐시 슬롯을 변형하지 않는다.
  if (location === 'arms' || location === 'left_arm' || location === 'right_arm' || location === 'neck' || location === 'abdomen') {
    let bodyAcc = rollBodyAccessoriesForSlot(target, location, aspect);
    const suppress = (opts && opts.suppressAccessoryTypes) || null;
    if (suppress && bodyAcc.length) bodyAcc = bodyAcc.filter(a => suppress.indexOf(a._accType) < 0);   // SIDE-ARMOR-2B: groin 등 중복 합성 방지
    if (bodyAcc.length > 0) slot = compositeSlotWithAccessories(slot, bodyAcc);
  }
  const hardP = slot.hardP || 0, softP = slot.softP || 0;
  const r = Math.random();
  let hardVal = (slot.hard && slot.hard.smallArmor) || 0;
  let softVal = (slot.soft && slot.soft.smallArmor) || 0;
  const hardMat = (slot.hard && slot.hard.material) || 'composite';
  const softMat = (slot.soft && slot.soft.material) || 'aramid';
  const backer = !!slot.softBacker;
  const isHelmet = !!slot.isHelmet;
  // 2A-1: visor zone 정보 (K6-3 유리부/금속부 구분용, 표시/주소 전용)
  const visorZoneId = slot._visorZoneId || null;
  const visorZoneLabel = slot._visorZoneLabel || null;
  const visorDisplayMaterial = slot._visorDisplayMaterial || null;
  // ARMOR-HOTFIX-1 §4: zone 전용 durability 재질 보존 (glass/titanium — 내구도 계산에서 우선 사용)
  const zoneDurabilityMaterial = slot.durabilityMaterial || null;
  // 2A-6.3: accessory 세부 방호 주소
  const accCoverageAddr = slot._accCoverageAddr || null;
  const accType = slot._accType || null;
  const accId = slot._accId || null;
  // 2A-6.4: 플레이트 시스템 메타 (백커 2차 저지/표시용)
  const plateId = slot._plateId || null;
  const plateRatingMode = slot._plateRatingMode || null;
  const plateRequiresSoftBacker = !!slot._plateRequiresSoftBacker;
  const plateHasIntegralBacker = !!slot._plateHasIntegralBacker;
  const plateMinBackerArmor = slot._plateMinBackerArmor || 0;
  const plateSecondaryBackerMode = slot._plateSecondaryBackerMode || 'none';
  const plateBaseSoftArmor = slot._plateBaseSoftArmor || 0;
  const softInsert = !!slot._softInsert;
  const softInsertId = slot._softInsertId || null;
  // ABDOMEN-PLATE-SLOT-1: frontSet 복부 플레이트는 가슴판과 별개 슬롯 (레이어 표기 + 내구도 소모 분리)
  const _plateLayerType = slot._plateLayerType || null;
  const _plateSlotKey = slot._plateSlotKey || null;
  const _isAbdomenPlate = (_plateLayerType === 'frontset_abdomen_hard' || _plateLayerType === 'frontset_abdomen_hard_rear');
  const _plateMeta = { plateId, plateRatingMode, plateRequiresSoftBacker, plateHasIntegralBacker, plateMinBackerArmor, plateSecondaryBackerMode, plateBaseSoftArmor, softInsert, softInsertId,
                       plateLayerType: _plateLayerType, plateSlotKey: _plateSlotKey, isAbdomenPlate: _isAbdomenPlate, plateDisplayName: slot._plateDisplayName || null };

  // 내구도 보정 — hard/soft 각각
  const hardKey = _isAbdomenPlate ? (_plateSlotKey || getDurabilitySlotKey(location, aspect, 'hard')) : getDurabilitySlotKey(location, aspect, 'hard');
  const softKey = getDurabilitySlotKey(location, aspect, 'soft');
  // SIDE-AMMO-KINETICS §16: resolveImpact가 만든 localZoneHint를 방호력 보정에 반영 (손상기록과 동일 zone)
  const _localZoneHint = (opts && opts.localZoneHint) || null;
  const hardValEff = applyDurabilityToArmor(target, hardKey, hardVal, hardMat, _localZoneHint, zoneDurabilityMaterial);   // §4.2: zone 재질 hint
  const softValEff = applyDurabilityToArmor(target, softKey, softVal, softMat, _localZoneHint);

  if (r < hardP) return { protectionType:'hard', protectionTypeKor:'하드', fallbackUsed:true, fallbackReason:_fbReason,
                          armorValue:hardValEff, hardArmor:hardValEff, softArmor:softValEff, softBacker:backer,
                          material: hardMat, hardMaterial: hardMat, softMaterial: softMat, isHelmet,
                          _baseArmor: hardVal, _durabilityKey: hardKey, _zoneDurabilityMaterial: zoneDurabilityMaterial,
                          _visorZoneId: visorZoneId, _visorZoneLabel: visorZoneLabel, _visorDisplayMaterial: visorDisplayMaterial, _accCoverageAddr: accCoverageAddr, _accType: accType, _accId: accId, _plateMeta: _plateMeta };
  if (r < hardP + softP) return { protectionType:'soft', protectionTypeKor:'소프트', fallbackUsed:true, fallbackReason:_fbReason,
                                   armorValue:softValEff, hardArmor:0, softArmor:softValEff, softBacker:false,
                                   material: softMat, hardMaterial: null, softMaterial: softMat, isHelmet,
                                   _baseArmor: softVal, _durabilityKey: softKey, _softInsert: softInsert,
                                   _visorZoneId: visorZoneId, _visorZoneLabel: visorZoneLabel, _visorDisplayMaterial: visorDisplayMaterial, _accCoverageAddr: accCoverageAddr, _accType: accType, _accId: accId, _plateMeta: _plateMeta };
  return { protectionType:'none', protectionTypeKor:'비방호', fallbackUsed:true, fallbackReason:_fbReason, armorValue:0, hardArmor:0, softArmor:0,
           softBacker:false, material:'fabric', hardMaterial:null, softMaterial:null, isHelmet:false };
}
// 관통 확률 — diff(=관통력 - 방호력) 기반의 부드러운 S커브 (logistic).
//   center=4.0 — 50% 지점을 +4쪽으로 옮겨 동률 근처에서 방어자 우세.
//   k=0.21    — 곡선 기울기를 약간 가파르게 해 고관통/저관통 차이를 강화.
//   clamp     — 확률 [0.01, 0.98] 범위로 안정화.
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
function _applyBackerMitigation(backerRes, pkt, backerSufficiency, ratingMode) {
  if (!backerRes || !pkt) return;
  const mit = backerMitigationFactor(pkt, backerSufficiency, ratingMode);
  backerRes.bluntMul = Math.max(0.4, (backerRes.bluntMul != null ? backerRes.bluntMul : 1.0) * mit);
  backerRes.shockMul = Math.max(0.4, (backerRes.shockMul != null ? backerRes.shockMul : 1.0) * mit);
  backerRes.painMul  = Math.max(0.4, (backerRes.painMul  != null ? backerRes.painMul  : 1.0) * mit);
  backerRes.backerMitigationMul = +mit.toFixed(2);
  backerRes.backerMitigationApplied = true;
}

// =============================================================
// 2A-6.4: 백커 충족도 + 2차 저지 해석 (ratingMode 인식)
//   ICW: 외부 소프트백커(방탄복 soft) 충족 여부로 sufficient/partial/insufficient
//   Stand-Alone: 자체 백커(integral) — 외부 soft는 제한적 2차층
//   백커는 "낮은 residualThreat"만 2차 저지. 큰 overmatch는 못 뒤집음.
//   hardArmor와 softArmor를 직접 합산하지 않음.
// =============================================================
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
const AMMO_MEDICAL_DEFAULTS = {
  bleedChance: 0.20, bleedSeverityMul: 1.00,
  fractureChance: 0.10, fractureSeverityMul: 1.00,
  shockChance: 0.10, bluntTraumaMul: 1.00, tissueDamageMul: 1.00,
};
const LEGACY_AMMO_MEDICAL_MANUAL = {   // 2A-4.9: 수동 백업
  // === 9mm 권총탄 ===
  '9mm_115gr':  { bleedChance:0.18, bleedSeverityMul:0.90, fractureChance:0.06, fractureSeverityMul:0.80, shockChance:0.10, bluntTraumaMul:0.95, tissueDamageMul:0.85 },
  '9mm_124gr':  { bleedChance:0.20, bleedSeverityMul:0.95, fractureChance:0.07, fractureSeverityMul:0.85, shockChance:0.12, bluntTraumaMul:1.00, tissueDamageMul:0.90 },
  '9mm_m882':   { bleedChance:0.22, bleedSeverityMul:1.00, fractureChance:0.08, fractureSeverityMul:0.90, shockChance:0.14, bluntTraumaMul:1.05, tissueDamageMul:0.95 },
  '9mm_7n21':   { bleedChance:0.12, bleedSeverityMul:0.75, fractureChance:0.14, fractureSeverityMul:1.10, shockChance:0.12, bluntTraumaMul:1.10, tissueDamageMul:0.75 },
  '9mm_7n31':   { bleedChance:0.10, bleedSeverityMul:0.70, fractureChance:0.16, fractureSeverityMul:1.15, shockChance:0.14, bluntTraumaMul:1.15, tissueDamageMul:0.70 },
  '9mm_jhp':    { bleedChance:0.55, bleedSeverityMul:1.50, fractureChance:0.08, fractureSeverityMul:0.85, shockChance:0.32, bluntTraumaMul:0.75, tissueDamageMul:1.55 },
  '9mm_jhp_p':  { bleedChance:0.60, bleedSeverityMul:1.55, fractureChance:0.10, fractureSeverityMul:0.90, shockChance:0.36, bluntTraumaMul:0.80, tissueDamageMul:1.60 },
  '9mm_rip':    { bleedChance:0.70, bleedSeverityMul:1.70, fractureChance:0.06, fractureSeverityMul:0.75, shockChance:0.42, bluntTraumaMul:0.60, tissueDamageMul:1.80 },

  // === 5.56 ===
  '556_223_fmj':     { bleedChance:0.28, bleedSeverityMul:1.05, fractureChance:0.16, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.10, tissueDamageMul:1.05 },
  '556_m193':        { bleedChance:0.40, bleedSeverityMul:1.30, fractureChance:0.18, fractureSeverityMul:1.10, shockChance:0.25, bluntTraumaMul:1.15, tissueDamageMul:1.35 },
  '556_m855':        { bleedChance:0.25, bleedSeverityMul:1.05, fractureChance:0.22, fractureSeverityMul:1.20, shockChance:0.20, bluntTraumaMul:1.20, tissueDamageMul:1.00 },
  '556_m855a1':      { bleedChance:0.28, bleedSeverityMul:1.10, fractureChance:0.24, fractureSeverityMul:1.25, shockChance:0.22, bluntTraumaMul:1.25, tissueDamageMul:1.05 },
  '556_mk318_sost':  { bleedChance:0.38, bleedSeverityMul:1.20, fractureChance:0.18, fractureSeverityMul:1.10, shockChance:0.24, bluntTraumaMul:1.15, tissueDamageMul:1.30 },
  '556_mk255_rrlp':  { bleedChance:0.50, bleedSeverityMul:1.40, fractureChance:0.10, fractureSeverityMul:0.85, shockChance:0.30, bluntTraumaMul:0.85, tissueDamageMul:1.55 },
  '556_m995_ap':     { bleedChance:0.14, bleedSeverityMul:0.80, fractureChance:0.30, fractureSeverityMul:1.45, shockChance:0.20, bluntTraumaMul:1.30, tissueDamageMul:0.75 },
  '556_varmageddon': { bleedChance:0.62, bleedSeverityMul:1.55, fractureChance:0.12, fractureSeverityMul:0.90, shockChance:0.38, bluntTraumaMul:0.70, tissueDamageMul:1.70 },
  '556_hp':          { bleedChance:0.55, bleedSeverityMul:1.45, fractureChance:0.14, fractureSeverityMul:0.95, shockChance:0.32, bluntTraumaMul:0.80, tissueDamageMul:1.55 },
  '556_mk262_mod1':  { bleedChance:0.42, bleedSeverityMul:1.30, fractureChance:0.18, fractureSeverityMul:1.05, shockChance:0.26, bluntTraumaMul:1.05, tissueDamageMul:1.35 },

  // === 5.45 ===
  '545_hp':       { bleedChance:0.52, bleedSeverityMul:1.40, fractureChance:0.14, fractureSeverityMul:0.95, shockChance:0.30, bluntTraumaMul:0.80, tissueDamageMul:1.50 },
  '545_prs_gs':   { bleedChance:0.58, bleedSeverityMul:1.45, fractureChance:0.10, fractureSeverityMul:0.85, shockChance:0.32, bluntTraumaMul:0.70, tissueDamageMul:1.55 },
  '545_sp':       { bleedChance:0.48, bleedSeverityMul:1.30, fractureChance:0.15, fractureSeverityMul:1.00, shockChance:0.28, bluntTraumaMul:0.90, tissueDamageMul:1.40 },
  '545_us_gs':    { bleedChance:0.22, bleedSeverityMul:0.85, fractureChance:0.08, fractureSeverityMul:0.80, shockChance:0.10, bluntTraumaMul:0.85, tissueDamageMul:0.85 },
  '545_fmj':      { bleedChance:0.26, bleedSeverityMul:1.00, fractureChance:0.16, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.10, tissueDamageMul:1.00 },
  '545_ps_gs':    { bleedChance:0.24, bleedSeverityMul:1.00, fractureChance:0.22, fractureSeverityMul:1.20, shockChance:0.20, bluntTraumaMul:1.20, tissueDamageMul:0.95 },
  '545_pp_gs':    { bleedChance:0.20, bleedSeverityMul:0.90, fractureChance:0.26, fractureSeverityMul:1.30, shockChance:0.20, bluntTraumaMul:1.25, tissueDamageMul:0.85 },
  '545_bp_gs':    { bleedChance:0.16, bleedSeverityMul:0.85, fractureChance:0.30, fractureSeverityMul:1.40, shockChance:0.22, bluntTraumaMul:1.30, tissueDamageMul:0.80 },
  '545_bs_gs':    { bleedChance:0.14, bleedSeverityMul:0.80, fractureChance:0.32, fractureSeverityMul:1.45, shockChance:0.22, bluntTraumaMul:1.30, tissueDamageMul:0.75 },
  '545_7n40':     { bleedChance:0.15, bleedSeverityMul:0.82, fractureChance:0.31, fractureSeverityMul:1.42, shockChance:0.22, bluntTraumaMul:1.30, tissueDamageMul:0.77 },
  '545_ppbs_gs':  { bleedChance:0.12, bleedSeverityMul:0.75, fractureChance:0.34, fractureSeverityMul:1.55, shockChance:0.22, bluntTraumaMul:1.35, tissueDamageMul:0.70 },

  // === 7.62×39 ===
  '762x39_hp':    { bleedChance:0.55, bleedSeverityMul:1.50, fractureChance:0.22, fractureSeverityMul:1.20, shockChance:0.34, bluntTraumaMul:1.10, tissueDamageMul:1.60 },
  '762x39_sp':    { bleedChance:0.50, bleedSeverityMul:1.40, fractureChance:0.24, fractureSeverityMul:1.25, shockChance:0.32, bluntTraumaMul:1.15, tissueDamageMul:1.50 },
  '762x39_us':    { bleedChance:0.28, bleedSeverityMul:0.95, fractureChance:0.14, fractureSeverityMul:0.90, shockChance:0.14, bluntTraumaMul:0.95, tissueDamageMul:0.95 },
  '762x39_ps':    { bleedChance:0.34, bleedSeverityMul:1.15, fractureChance:0.30, fractureSeverityMul:1.35, shockChance:0.28, bluntTraumaMul:1.40, tissueDamageMul:1.15 },
  '762x39_pp':    { bleedChance:0.28, bleedSeverityMul:1.05, fractureChance:0.34, fractureSeverityMul:1.45, shockChance:0.28, bluntTraumaMul:1.45, tissueDamageMul:1.05 },
  '762x39_bp':    { bleedChance:0.22, bleedSeverityMul:0.95, fractureChance:0.38, fractureSeverityMul:1.55, shockChance:0.28, bluntTraumaMul:1.50, tissueDamageMul:0.95 },

  // === 7.62×51 ===
  '762_308_fmj':  { bleedChance:0.40, bleedSeverityMul:1.30, fractureChance:0.36, fractureSeverityMul:1.55, shockChance:0.36, bluntTraumaMul:1.65, tissueDamageMul:1.30 },
  '762_m80':      { bleedChance:0.42, bleedSeverityMul:1.35, fractureChance:0.38, fractureSeverityMul:1.60, shockChance:0.38, bluntTraumaMul:1.70, tissueDamageMul:1.35 },
  '762_m80a1':    { bleedChance:0.38, bleedSeverityMul:1.25, fractureChance:0.40, fractureSeverityMul:1.65, shockChance:0.38, bluntTraumaMul:1.75, tissueDamageMul:1.25 },
  '762_m61_ap':   { bleedChance:0.22, bleedSeverityMul:0.95, fractureChance:0.42, fractureSeverityMul:1.75, shockChance:0.32, bluntTraumaMul:1.80, tissueDamageMul:0.90 },
  '762_m993_ap':  { bleedChance:0.18, bleedSeverityMul:0.85, fractureChance:0.45, fractureSeverityMul:1.80, shockChance:0.32, bluntTraumaMul:1.80, tissueDamageMul:0.80 },

  // === 12 Gauge (펠릿/슬러그 1발 기준) ===
  '12g_00buck':    { bleedChance:0.24, bleedSeverityMul:0.65, fractureChance:0.07, fractureSeverityMul:0.85, shockChance:0.11, bluntTraumaMul:1.05, tissueDamageMul:0.74 },
  '12g_slug':      { bleedChance:0.42, bleedSeverityMul:1.40, fractureChance:0.48, fractureSeverityMul:1.85, shockChance:0.48, bluntTraumaMul:2.00, tissueDamageMul:1.55 },
  '12g_flechette': { bleedChance:0.14, bleedSeverityMul:0.40, fractureChance:0.03, fractureSeverityMul:0.40, shockChance:0.05, bluntTraumaMul:0.55, tissueDamageMul:0.40 },
};

// 2A-4.9: live AMMO_MEDICAL — 로드 중 manual 임시. source는 하단 switch에서 확정.
const AMMO_MEDICAL = {};
Object.assign(AMMO_MEDICAL, LEGACY_AMMO_MEDICAL_MANUAL);

function getAmmoMedicalProfile(ammo) {
  if (!ammo) return Object.assign({}, AMMO_MEDICAL_DEFAULTS);
  const id = ammo.id || ammo;
  const fromTable = AMMO_MEDICAL[id] || {};
  return Object.assign({}, AMMO_MEDICAL_DEFAULTS, fromTable);
}

// =============================================================
