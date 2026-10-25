// SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: 피격 세부주소 기반 피해 감쇠 (증폭 금지, ≤1.0)
//   치명부위 보너스가 아니라 비치명/주변/말단 부위 감쇠. 방호/관통/탄속/에너지/탄약 원본 불변.
//   최종 조직피해·wound size·출혈/쇼크/통증·생리손상 승격 gate에만 적용.
// =============================================================
function buildHitAddressDamageProfile(hitPart, impactAddress, ctx) {
  const ONE = { damageMul:1.0, woundMul:1.0, painMul:1.0, bleedMul:1.0, shockMul:1.0, physiologyMul:1.0, class:'default', reason:'unknown_address_default' };
  if (!impactAddress) return ONE;
  const ia = impactAddress;
  // 모든 주소 필드 토큰 수집 (하드코딩 최소화 — 필드값을 모아 토큰 분류)
  const fields = [ia.anatomicalZone, ia.coverageZone, ia.edgeLocation, ia.softLocation, ia.exposedLocation,
                  ia.limbLocation, ia.neckLocation, ia.faceLocation, ia.helmetZone, ia.zone, ia.subZone,
                  ia.location, ia.boneRegion, ia.jointRegion, ia.region, ia.organRegionHint];
  // candidate/vessel 힌트도 vascularRisk 분류에 사용
  const vesselHints = (ctx && (ctx.vesselCandidateHints || (ctx.candidateMap && ctx.candidateMap.filter(c=>c.type==='vessel').map(c=>c.id)))) || [];
  const tok = fields.concat(vesselHints, [hitPart]).filter(Boolean).map(f => String(f).toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');
  const has = (re) => re.test(tok);
  // 우선순위: 위험중심부(감쇠 없음) → 대혈관/접합부(physiology 높게) → 부위별 주변/말단
  const P = (damageMul,woundMul,painMul,bleedMul,shockMul,physiologyMul,cls,reason)=>({damageMul,woundMul,painMul,bleedMul,shockMul,physiologyMul,class:cls,reason});
  // 4-A 위험 중심부 — 감쇠 없음 (무력화 금지)
  if (has(/central|core|mediastin|throat|anteriorneck|cranial|skull|temporal|occipit|platecore|softcenter|femoral|groin|pelvisgroin|carotid|jugular|upperinnerthighproximal/))
    return P(1.0,1.0,1.0,1.0,1.0,1.0,'critical','central_or_vascular_core');
  // 4-B 대혈관/접합부 후보 — physiology/bleed 높게 유지 (peripheral 자동 감쇠 금지)
  if (has(/subclav|iliac|axill|junction|vascular|pelvisadjacent|neckside|shoulderchest|armshouldergap/))
    return P(0.90,0.90,0.95,0.96,0.93,0.96,'vascular','vascular_junctional_address');
  // 4-C 측흉부 / 폐 주변부
  if (has(/lateralthorax|sidewrapcenter|sidewrapupper|upperlung|lowerlung|leftlateral|rightlateral/))
    return P(0.88,0.88,0.92,0.90,0.90,0.88,'lateralThorax','lateral_thorax_lung_periphery');
  // 4-E 안와/눈
  if (has(/orbital|eyeball|eyes|eyesocket/))
    return P(0.92,0.90,1.0,0.92,0.88,0.90,'orbital','orbital_region');
  // 4-E 하부 안면 (두개강 취급 금지, 통증/출혈 과도 감쇠 금지)
  if (has(/jaw|cheek|mouth|lowerface|midface|mandible|chin|maxilla/))
    return P(0.78,0.78,0.95,0.86,0.82,0.71,'facePeripheral','lower_face_peripheral');
  // 4-D 옆구리
  if (has(/flank|softflank|flankgap|lowersidegap/))
    return P(0.80,0.82,0.88,0.86,0.84,0.80,'flank','flank_lower_lateral_abdomen');
  // 4-D 하복부
  if (has(/lowerabdomen|hypogastr|suprapubic/))
    return P(0.87,0.88,0.93,0.90,0.88,0.90,'abdomenLower','lower_abdomen');
  // 4-D 상복부/중앙복부 (경미)
  if (has(/upperabdomen|centralabdomen|epigastr|periumbil/))
    return P(0.95,0.95,0.97,0.97,0.95,0.95,'abdomenCentral','upper_central_abdomen');
  // 4-G 다리 — 내측 허벅지(완만), 허벅지, 무릎, 하퇴, 발
  if (has(/innerthigh/))
    return P(0.90,0.90,0.95,0.95,0.92,0.95,'innerThigh','inner_thigh');
  if (has(/foot|ankle/))
    return P(0.66,0.68,0.85,0.64,0.62,0.55,'foot','foot_ankle_distal');
  if (has(/lowerleg|calf|shin|tibia|fibula/))
    return P(0.72,0.73,0.85,0.73,0.70,0.64,'lowerLeg','lower_leg_distal');
  if (has(/knee|patella/))
    return P(0.78,0.80,0.88,0.84,0.80,0.72,'knee','knee_joint');
  if (has(/thigh/))
    return P(0.84,0.86,0.92,0.90,0.88,0.84,'thigh','thigh');
  // 4-F 팔 — 어깨, 상완, 전완/팔꿈치/손
  if (has(/hand|wrist|forearm|elbow/))
    return P(0.74,0.74,0.87,0.78,0.74,0.69,'distalArm','forearm_distal');
  if (has(/upperarm/))
    return P(0.82,0.84,0.90,0.86,0.84,0.82,'upperArm','upper_arm');
  if (has(/shoulder/))
    return P(0.86,0.88,0.93,0.92,0.90,0.88,'shoulder','shoulder');
  // generic edge/peripheral (위에서 안 잡힌 가장자리)
  if (has(/edge|lateral|peripher|sidegap|lowergap/))
    return P(0.85,0.86,0.92,0.90,0.88,0.85,'peripheral','generic_edge_peripheral');
  return ONE;
}
// SIDE-MED-PHYS-HOTFIX-1A §2-A: wound별 physiologicEffectProfile 집계 (중복 합산 방지 — wound 단위 1회)
function aggregatePhysiologicEffectProfile(m) {
  const agg = { oxygenDrain:0, shockBoost:0, perfusingRhythmPenalty:0, majorVesselMul:1.0, breathingDrain:0, rhythmRiskBoost:0, preArrestBoost:0 };
  if (!m || !m.wounds) return agg;
  for (const w of m.wounds) {
    const p = w.physiologicEffectProfile;
    if (!p) continue;
    agg.oxygenDrain += p.oxygenDrain || 0;
    agg.shockBoost += p.shockBoost || 0;
    agg.perfusingRhythmPenalty = Math.max(agg.perfusingRhythmPenalty, p.perfusingRhythmPenalty || 0);
    agg.majorVesselMul = Math.max(agg.majorVesselMul, p.majorVesselMul || 1.0);   // max (곱셈 폭주 방지)
    agg.breathingDrain = Math.max(agg.breathingDrain, p.breathingDrain || 0);
    agg.rhythmRiskBoost = Math.max(agg.rhythmRiskBoost, p.rhythmRiskBoost || 0);
    agg.preArrestBoost = Math.max(agg.preArrestBoost, p.preArrestBoost || 0);
  }
  agg.oxygenDrain = Math.min(0.18, agg.oxygenDrain);
  agg.shockBoost = Math.min(0.30, agg.shockBoost);
  agg.perfusingRhythmPenalty = Math.min(0.30, agg.perfusingRhythmPenalty);
  agg.majorVesselMul = Math.min(2.4, agg.majorVesselMul);
  return agg;
}

// SIDE-MEDICAL-TRAUMA-BRIDGE-HOTFIX-1 §5: forced address 검증 helper (디버그/콘솔 전용 — 일반 플레이 흐름 무영향)
//   사용: debugResolveForcedAddress(shooter, target, weapon, 'side.torso.chest.axilla_gap')
function debugResolveForcedAddress(shooter, target, weapon, forcedAddrStr) {
  if (!forcedAddrStr) return null;
  const parts = getAddressParts(forcedAddrStr);
  const hp = parts.hitPart;
  const locMap = { chest:'chest', abdomen:'abdomen', neck:'neck', head:'head_skull', face:'head_face',
    left_arm:'left_arm', right_arm:'right_arm', left_leg:'left_leg', right_leg:'right_leg' };
  const location = locMap[hp] || hp;
  const aspect = (parts.side === 'top') ? 'front' : (parts.side || 'front');
  const isLeft = /left/.test(hp) ? true : (/right/.test(hp) ? false : null);
  const addr = normalizeImpactAddressObject({ fullAddress: forcedAddrStr, side: parts.side, region: parts.region, hitPart: hp, zone: parts.zone, subZone: parts.subZone });
  let result = null;
  try { result = resolveImpact(shooter, target, weapon, { forcedImpactAddress: addr, forcedLocation: location, forcedAspect: aspect, forcedIsLeft: isLeft }); } catch (e) { return { error: e.message }; }
  const wounds = (target.medical && target.medical.wounds) || [];
  const wound = wounds[wounds.length - 1] || null;
  const ahr = (result && result.armorHitResult) || null;
  const nm = wound && wound.normalizedMedicalAddress;
  const btnm = wound && wound.bodyTrajectory && wound.bodyTrajectory.normalizedMedicalAddress;
  const out = {
    forcedAddress: forcedAddrStr,
    protectionAddress: result && result.impactAddress && result.impactAddress.fullAddress,
    resultAddress: result && result.impactAddress && result.impactAddress.fullAddress,
    woundAddress: wound && wound.impactAddressFull,
    woundMedicalZone: nm && nm.medicalZone,
    btMedicalZone: btnm && btnm.medicalZone,
    sourceModel: ahr && ahr.sourceModel,
    selectedLayerType: ahr && ahr.selectedLayerType,
    coverageSource: ahr && ahr.coverageSource,
    durabilityOwnerId: ahr && ahr.durabilityOwnerId,
    backerOwnerId: ahr && ahr.backerOwnerId,
    bleedingClass: wound && wound.bleedingClass,
    treatmentIndicationTags: wound && wound.treatmentIndicationTags,
    addressConsistent: !!(result && result.impactAddress && wound && result.impactAddress.fullAddress === wound.impactAddressFull),
  };
  if (typeof console !== 'undefined' && console.log) console.log('[forcedAddress]', JSON.stringify(out, null, 2));
  return out;
}

// CLEANUP HOTFIX 5: 디버그 helper 콘솔 export (강제주소 회귀 테스트 편의용 — 게임 로직 무영향)
function debugFindUnitByName(name) {
  if (typeof UNITS === 'undefined' || !name) return null;
  const n = String(name).toLowerCase();
  return UNITS.find(u => u && String(u.name || '').toLowerCase().indexOf(n) >= 0) || null;
}
function debugListAliveUnits() {
  if (typeof UNITS === 'undefined') return [];
  return UNITS.filter(u => u && (u.alive !== false) && (!u.medical || u.medical.lifeStatus !== 'dead'))
    .map(u => ({ id: u.id, name: u.name, team: u.team, weaponId: u.weaponId, x: u.x, y: u.y }));
}
if (typeof window !== 'undefined') {
  window.debugResolveForcedAddress = debugResolveForcedAddress;
  window.debugFindUnitByName = debugFindUnitByName;
  window.debugListAliveUnits = debugListAliveUnits;
  // SIDE-PATHLEN-ARMOR-1 §15: barrier 방호력/두께 진단
  // ORGANIC-BLEED-1 Phase3: wound evidence 진단
  window.debugWoundEvidence = function(unitName) {
    const u = debugFindUnitByName(unitName);
    if (!u || !u.medical || !u.medical.wounds) return [];
    return u.medical.wounds.map(w => ({
      id: w.id, part: w.partKey,
      vascular: w.vascularEvidence ? (w.vascularEvidence.level + '/' + w.vascularEvidence.vesselClass + ' ' + w.vascularEvidence.riskPercent + '%') : null,
      fracture: w.fractureEvidence ? (w.fractureEvidence.occurred ? (w.fractureEvidence.fractureType + '@' + w.fractureEvidence.boneZone) : 'none') : null,
      bleed: w.bleedingProfile ? ('init ' + w.bleedingProfile.initialExternal + ' → sust ' + w.bleedingProfile.sustainedExternal + ' (cur ' + w.bleedingProfile.currentExternal + ', locked ' + !!w.bleedingProfile.majorVesselLocked + ')') : null,
    }));
  };
  window.debugListBarrierArmor = function() {
    if (typeof MAP_DATA === 'undefined') return [];
    const rows = [];
    const add = (o, kind) => rows.push({
      barrierType: kind, id: o.id || null, material: o.material || null, penetrable: (o.penetrable !== false),
      baseArmor: Number.isFinite(o.armor) ? o.armor : null,
      nominalThicknessM: +getBarrierNominalThicknessM(o).toFixed(3),
      armorPerMeter: +getBarrierArmorPerMeter(o, o.material).toFixed(1),
      w: o.w, h: o.h,
    });
    (MAP_DATA.walls || []).forEach(w => add(w, 'wall'));
    (MAP_DATA.coverObjects || []).forEach(c => add(c, c.halfHeight ? 'halfCover' : 'cover'));
    console.table ? console.table(rows) : console.log(rows);
    return rows;
  };
  window.debugShootThroughBarrier = function(shooterName, targetName) {
    const sh = debugFindUnitByName(shooterName), tg = debugFindUnitByName(targetName);
    if (!sh || !tg) return { error: 'unit not found' };
    const b = findFirstBarrierBetween(sh, tg.x, tg.y);
    if (!b.hasBarrier) return { hasBarrier: false };
    const dx = tg.x - sh.x, dy = tg.y - sh.y, ll = Math.hypot(dx, dy); const nx = dx/ll, ny = dy/ll;
    const obj = b.barrierObj;
    const exitT = rayBoxExitT(sh.x, sh.y, nx, ny, obj, ll);
    const norm = { nx: 1, ny: 0 };
    const inc = (typeof getIncidentAngle === 'function') ? getIncidentAngle(nx, ny, norm.nx, norm.ny) * 180 / Math.PI : null;
    const eff = computeBarrierEffectiveArmor(obj, { entryT: b.distanceToBarrier, exitT, material: obj.material, incidentDeg: inc });
    const amb = (typeof getAmmoBarrier === 'function' && sh._resolvedAmmo) ? getAmmoBarrier(sh._resolvedAmmo) : null;
    const barrierPen = (sh._resolvedAmmo ? sh._resolvedAmmo.penetration : 30) * (amb ? amb.barrierPenMul : 1);
    const out = {
      barrierType: b.barrierType, material: eff.material, penetrable: b.penetrable,
      baseArmor: eff.baseArmor, nominalThicknessM: +eff.nominalThicknessM.toFixed(3),
      armorPerMeter: +eff.armorPerMeter.toFixed(1), pathLenM: +eff.pathLenM.toFixed(3), pathRatio: +eff.pathRatio.toFixed(2),
      effectiveArmor: +eff.effectiveArmor.toFixed(1), incidentDeg: inc != null ? +inc.toFixed(1) : null,
      barrierPen: +barrierPen.toFixed(1), penProbability: +penetrationProbability(barrierPen - eff.effectiveArmor).toFixed(3),
    };
    console.log(out);
    return out;
  };
}

function resolveImpact(shooter, target, weapon, ctx) {
  if (!target.alive) return { outcome: OUTCOME.MISS };
  if (target.medical) target.medical._currentEventWound = null;   // HOTFIX-2 §1: 이전 피격 잔존 방지
  // ctx.aimQualityOverride가 있으면 그것을 사용 (발사방식별 흔들림용)
  let aimQuality;
  if (ctx && ctx.aimQualityOverride != null) {
    aimQuality = ctx.aimQualityOverride;
  } else {
    aimQuality = (shooter && shooter._lastAimQuality != null) ? shooter._lastAimQuality : 0;
  }
  // 피격 방향 — front/left/right/rear. shooter가 없으면 front 가정.
  //   location 결정 *전에* 계산해 hit table에도 반영한다.
  let hitAspect = shooter ? getHitAspect(shooter, target) : 'front';
  // 안전 변환 — side가 어딘가에서 들어오면 left/right로
  if (hitAspect === 'side') {
    if (shooter) {
      // shooter 위치 기준 cross product로 정확히 판정
      const dx = shooter.x - target.x, dy = shooter.y - target.y;
      const fx = Math.cos(target.facing), fy = Math.sin(target.facing);
      // cross = fx*dy - fy*dx — 양수면 좌측 (반시계)
      hitAspect = (fx * dy - fy * dx) > 0 ? 'left' : 'right';
    } else {
      hitAspect = (Math.random() < 0.5) ? 'left' : 'right';
    }
  }
  // SIDE-HITLOC-COVER-INTERACTION-1B: over / penetrated context 분리·선택
  //   penetration이 있으면 우선. 둘 다 있으면 targetHitPoint에 더 가까운 interaction 우선.
  const _ce = (ctx && ctx.coverExposure) ? ctx.coverExposure : null;
  const _cp = (ctx && ctx.coverPenetrationContext) ? ctx.coverPenetrationContext : null;
  if (_cp && _ce) _hitCoverExposure = (_cp.distM <= _ce.distM + 0.01) ? _cp : _ce;
  else _hitCoverExposure = _cp || _ce || null;
  let location = rollHitLocation(target, shooter, aimQuality, hitAspect, _hitCoverExposure);

  // === 산탄 클러스터 편향 ===
  //   첫 펠릿이 기준 부위(clusterBodyPart)를 정하면, 후속 펠릿은
  //   해당 부위 / 인접 부위 위주로 분배 (근거리 0~5m에서만 활성)
  if (ctx && ctx.preferredBodyPart) {
    const bias = ctx.clusterBias || 0.65;
    const r = Math.random();
    if (r < bias) {
      // 같은 부위 — bodyPart를 일치시키는 대표 location 선택
      const bp = ctx.preferredBodyPart;
      if (bp === 'chest')  location = 'chest';
      else if (bp === 'abdomen') location = 'abdomen';
      else if (bp === 'arms') location = Math.random() < 0.5 ? 'left_arm' : 'right_arm';
      else if (bp === 'legs') location = 'legs';
      else if (bp === 'head') location = Math.random() < 0.65 ? 'head_skull' : 'head_face';
    } else if (r < bias + 0.25) {
      // 인접 부위 — chest↔abdomen, abdomen↔legs, chest↔arms 등
      const bp = ctx.preferredBodyPart;
      const adjacencyMap = {
        chest: ['abdomen', 'arms'], abdomen: ['chest', 'legs'],
        arms: ['chest'], legs: ['abdomen'], head: ['chest'],
      };
      const adj = adjacencyMap[bp] || ['chest'];
      const pick = adj[Math.floor(Math.random() * adj.length)];
      if (pick === 'chest') location = 'chest';
      else if (pick === 'abdomen') location = 'abdomen';
      else if (pick === 'arms') location = Math.random() < 0.5 ? 'left_arm' : 'right_arm';
      else if (pick === 'legs') location = 'legs';
    }
    // 나머지 10%는 원래 굴린 location 유지
  }

  // arms → left_arm / right_arm 분리
  //   hitAspect = left:  left 75% / right 25%
  //   hitAspect = right: right 75% / left 25%
  //   front/rear:        50/50
  if (location === 'arms') {
    let pLeft = 0.5;
    if (hitAspect === 'left')  pLeft = 0.75;
    else if (hitAspect === 'right') pLeft = 0.25;
    location = (Math.random() < pLeft) ? 'left_arm' : 'right_arm';
  }
  // legs 좌우 정합성 — legs 슬롯은 통합(좌우 공통)이므로 location은 'legs' 유지하되,
  //   좌우(isLeft)는 여기서 한 번만 결정해 impactAddress와 medical damage가 공유한다.
  let hitIsLeft = null;
  if (location === 'left_arm') hitIsLeft = true;
  else if (location === 'right_arm') hitIsLeft = false;
  else if (location === 'legs') {
    let pLeft = 0.5;
    if (hitAspect === 'left')  pLeft = 0.75;
    else if (hitAspect === 'right') pLeft = 0.25;
    hitIsLeft = (Math.random() < pLeft);
  }
  // === 방호 판정: rollProtection이 내부에서 결정형 주소 coverage를 우선 사용(단일 경로). deterministicCoverage=실제 결정형 경로, coverageAware=호환 플래그, armorContact=legacy 표시/접촉정보, impactAddress=의료/AAR/방호 공통 주소. ===
  // SIDE-MEDICAL-TRAUMA-BRIDGE-HOTFIX-1 §5: forced address 검증 훅 (디버그 전용 — 일반 플레이 무영향)
  if (ctx && ctx.forcedLocation) location = ctx.forcedLocation;
  if (ctx && ctx.forcedAspect) hitAspect = ctx.forcedAspect;
  if (ctx && ctx.forcedIsLeft != null) hitIsLeft = ctx.forcedIsLeft;
  const _covHitPart = locationToImpactPart(location, hitIsLeft);
  const _sideAspect = (hitAspect === 'left' || hitAspect === 'right' || hitAspect === 'side');
  const _coverageZone = false;   // DEPRECATED: 결정형 주소가 impactAddress source of truth. 미사용 플래그.
  let protection;
  // SIDE-MEDICAL-TRAUMA-BRIDGE-HOTFIX-1 §1: 결정형 주소를 좌우 확정(hitIsLeft) 상태로 한 번만 생성 → rollProtection에 전달.
  //   rollProtection 내부 재랜덤(left/right 재결정) 방지. 이 주소가 protection/result/wound/bodyTrajectory 공통 source.
  //   §5: ctx.forcedImpactAddress가 있으면 그 주소를 강제(디버그/검증 전용).
  const _covAddr = (ctx && ctx.forcedImpactAddress)
    ? normalizeImpactAddressObject(ctx.forcedImpactAddress)
    : buildCoverageImpactAddress(target, _covHitPart, hitAspect, { isLeft: hitIsLeft });
  const localZoneHint = addressZoneToLocalZone(_covAddr) || getArmorLocalZoneFromImpact({ location, aspect: hitAspect });
  protection = rollProtection(target, location, hitAspect, { localZoneHint, impactAddress: _covAddr, isLeft: hitIsLeft });
  const ammo = weapon._ammo;   // resolveAmmoForWeapon이 첨부

  // === velocity 기반 보정 ===
  //   shotVelocity: 장벽 관통 후 남은 속도
  //   shotInitialVelocity: 출구 속도 (muzzle)
  //   거리 감쇠 추가 적용
  const totalDistPx = (ctx && ctx.shotDistPx) || Math.hypot(shooter.x - target.x, shooter.y - target.y);
  const distM = pxToM(totalDistPx);   // SIDE-METRIC-SCALE-1: PX_PER_M 기준
  const distRet = ammo ? getDistanceVelocityRetention(ammo, distM) : 1.0;
  const shotVel = (ctx && ctx.shotVelocity != null) ? ctx.shotVelocity : (ammo ? (ammo.velocity * (weapon.velocityMul || 1.0)) : 800);
  const initVel = (ctx && ctx.shotInitialVelocity != null) ? ctx.shotInitialVelocity : shotVel;
  const impactVelocity = shotVel * distRet;
  const velocityRatio = Math.max(0.1, Math.min(1.0, impactVelocity / Math.max(1, initVel)));

  // SIDE-AMMO-KINETICS §6: kinetic 기반 보정 (변수명 penVelMul/damageVelMul 유지 — applyOutcome 호환. massG 없으면 helper가 기존 선형 공식 fallback)
  const kinetics = computeProjectileKinetics(ammo, impactVelocity, initVel);
  const penVelMul = resolveKineticPenetrationMul(ammo, kinetics);
  let damageVelMul = resolveKineticDamageMul(ammo, kinetics);
  // ctx에 보정값 저장 — applyOutcome에서 사용
  if (ctx) {
    ctx.impactVelocity = impactVelocity;
    ctx.velocityRatio = velocityRatio;
    ctx.penVelMul = penVelMul;
    ctx.damageVelMul = damageVelMul;
    ctx.kinetics = kinetics;
  }

  let stopStage = 'penetration';
  let penetrated = false;
  let backerRes = null;   // 2A-6.4: 백커 해석 결과 (AAR/debug/blunt-shock-pain용)
  let _effPenUsed = null; // ARMOR-HOTFIX-1 §6: 실제 판정에 쓴 유효 관통력 — 내구도 손상 관통압과 동기화

  if (protection.protectionType === 'none') {
    penetrated = true;
    stopStage = 'unprotected_hit';
  } else if (protection.protectionType === 'soft') {
    const effPen = effectivePenetration(ammo, weapon, protection.material) * penVelMul;
    _effPenUsed = effPen;
    // 헬멧 슬롯이면 armorValue 감소 — 소총탄/AP 보정
    const effArmor = applyHelmetArmorPenalty(protection.softArmor, ammo, protection);
    penetrated = rollPenetration(effPen, effArmor);
    stopStage = penetrated ? 'penetration' : 'soft_block';
  } else if (protection.protectionType === 'hard') {
    backerRes = computeBackerResolution(protection);
    const _mode = backerRes.ratingMode;
    const effPenHard = effectivePenetration(ammo, weapon, protection.hardMaterial || protection.material) * penVelMul;
    _effPenUsed = effPenHard;
    // 헬멧 shell이면 armorValue 감소
    let effHardArmor = applyHelmetArmorPenalty(protection.hardArmor, ammo, protection);
    // ICW 백커 부족 시 hardArmor 소폭 감소 (완전 무효화 아님)
    effHardArmor *= backerRes.armorMul;
    const hardPen = rollPenetration(effPenHard, effHardArmor);
    backerRes.overmatchMargin = +(effPenHard - effHardArmor).toFixed(1);
    if (!hardPen) {
      stopStage = 'hard_block';
    } else if (_mode === 'icw') {
      // 2A-6.6: ICW는 외부 방탄복 soft armor만 2차 저지. residualThreatPacket으로 조건부 제한.
      const pkt = buildResidualThreatAfterHard(ammo, effPenHard, effHardArmor, protection, backerRes);
      backerRes.residualThreatPacket = pkt;
      backerRes.residualThreat = pkt.residualPen;
      backerRes.residualKind = pkt.residualKind;
      const bav = backerRes.backerArmorValue;   // 외부 soft만
      if (bav > 0 && backerRes.secondaryBackerChanceMul > 0 && canBackerAttemptStop(pkt, bav, backerRes.backerResult, 'icw')) {
        backerRes.secondaryStopAttempted = true;
        const effBackerArmor = bav * backerRes.residualStopMul * pkt.backerEfficiencyMul;
        const softPen = rollPenetration(pkt.residualPen, effBackerArmor);
        const gate = Math.random() < backerStopChanceGate(pkt, backerRes.backerResult, 'icw');
        if (!softPen && gate) {
          backerRes.secondaryStopSuccess = true;
          stopStage = 'hard_pen_soft_block';
          backerRes.armorResultLabel = 'backer_stopped_residual';
        } else {
          penetrated = true; stopStage = 'penetration';
          backerRes.penetrationResultLabel = 'penetrated_after_backer';
          _applyBackerMitigation(backerRes, pkt, backerRes.backerResult, 'icw');
        }
      } else {
        penetrated = true; stopStage = 'penetration';
        backerRes.penetrationResultLabel = 'penetrated_after_backer';
        // 외부백커 부족/금지 — 완전저지 불가, 단 미약한 완화는 적용
        _applyBackerMitigation(backerRes, pkt, backerRes.backerResult, 'icw');
      }
    } else if (_mode === 'standalone') {
      // 2A-6.6: Stand-Alone 자체 백커(integral) — residualKind별 효율. intact AP 큰 overmatch엔 거의 못 막음.
      const pkt = buildResidualThreatAfterHard(ammo, effPenHard, effHardArmor, protection, backerRes);
      backerRes.residualThreatPacket = pkt;
      backerRes.residualThreat = pkt.residualPen;
      backerRes.residualKind = pkt.residualKind;
      if (protection.softBacker && protection.softArmor > 0) {
        const integralArmor = applyHelmetArmorPenalty(protection.softArmor, ammo, protection);
        if (canBackerAttemptStop(pkt, integralArmor, 'sufficient', 'standalone')) {
          backerRes.secondaryStopAttempted = true;
          const effBackerArmor = integralArmor * 0.85 * pkt.backerEfficiencyMul;
          const softPen = rollPenetration(pkt.residualPen, effBackerArmor);
          const gate = Math.random() < backerStopChanceGate(pkt, 'sufficient', 'standalone');
          if (!softPen && gate) { stopStage = 'hard_pen_soft_block'; backerRes.secondaryStopSuccess = true; backerRes.armorResultLabel = 'stopped_by_backer'; }
          else { penetrated = true; stopStage = 'penetration'; backerRes.penetrationResultLabel = 'penetrated_after_backer'; _applyBackerMitigation(backerRes, pkt, 'sufficient', 'standalone'); }
        } else {
          penetrated = true; stopStage = 'penetration'; backerRes.penetrationResultLabel = 'penetrated_after_backer';
          _applyBackerMitigation(backerRes, pkt, 'sufficient', 'standalone');
        }
      } else { penetrated = true; stopStage = 'penetration'; backerRes.penetrationResultLabel = 'penetrated_after_backer'; }
    } else if (protection.softBacker && protection.softArmor > 0) {
      // 헬멧 liner 등 — residualThreatPacket 적용 (ratingMode 없음)
      const pkt = buildResidualThreatAfterHard(ammo, effPenHard, effHardArmor, protection, backerRes);
      backerRes.residualThreatPacket = pkt;
      backerRes.residualThreat = pkt.residualPen;
      backerRes.residualKind = pkt.residualKind;
      const linerArmor = applyHelmetArmorPenalty(protection.softArmor, ammo, protection);
      if (canBackerAttemptStop(pkt, linerArmor, 'sufficient', 'helmet')) {
        backerRes.secondaryStopAttempted = true;
        const effBackerArmor = linerArmor * pkt.backerEfficiencyMul;
        const softPen = rollPenetration(pkt.residualPen, effBackerArmor);
        const gate = Math.random() < backerStopChanceGate(pkt, 'sufficient', 'helmet');
        if (!softPen && gate) { stopStage = 'hard_pen_soft_block'; backerRes.secondaryStopSuccess = true; if (!backerRes.armorResultLabel) backerRes.armorResultLabel = 'stopped_by_backer'; }
        else { penetrated = true; stopStage = 'penetration'; if (!backerRes.penetrationResultLabel) backerRes.penetrationResultLabel = 'penetrated_after_backer'; _applyBackerMitigation(backerRes, pkt, 'sufficient', 'helmet'); }
      } else { penetrated = true; stopStage = 'penetration'; if (!backerRes.penetrationResultLabel) backerRes.penetrationResultLabel = 'penetrated_after_backer'; _applyBackerMitigation(backerRes, pkt, 'sufficient', 'helmet'); }
    } else { penetrated = true; }
  }

  // SIDE-MED-BALLISTIC-2C-1 §4: entryArmorContext 생성 (legacy 결과 정리 — 재판정 아님)
  let entryArmorContext = null;
  try {
    const _durKey = (typeof getDurabilitySlotKey === 'function') ? getDurabilitySlotKey(location, hitAspect, protection.protectionType) : (protection._durabilityKey || null);
    entryArmorContext = buildEntryArmorContext({
      protection, location, aspect: hitAspect, hitPart: locationToBodyPart(location),
      stopStage, penetrated, ammo, weapon, penVelMul,
      backerRes, velBefore: initVel, velAfter: impactVelocity, stabAfter: null, durabilityKey: _durKey,
    });
  } catch (e) { entryArmorContext = null; }

  const outcome = rollDamageOutcome(weapon, location, penetrated);
  const bodyPart = locationToBodyPart(location);
  // 차단한 재질 — stopStage에 따라 hard/soft 재질을 선택
  // === SIDE-ARMOR-2C §3: coverage hard special layer 관통 후 soft backer pass ===
  let _coverageBackerInfo = null;
  if (protection && protection._coverageSpecial && protection.protectionType === 'hard' && protection._coverageBackerOwnerId && penetrated) {
    const apPen = effectivePenetration(ammo, weapon, protection.hardMaterial || protection.material) * (typeof penVelMul !== 'undefined' ? penVelMul : 1);
    const residualPen = Math.max(0, apPen - (protection.hardArmor || 0) * 0.85);   // 하드 통과 후 잔여 관통
    const backerArmor = protection._coverageBackerArmor || 0;
    const backerStopped = !rollPenetration(residualPen, backerArmor);              // backer가 잔여를 막는가
    _coverageBackerInfo = { layerType: protection._coverageBackerLayerType, ownerId: protection._coverageBackerOwnerId,
      ownerType: protection._coverageBackerOwnerType, backerArmor, residualPen: +residualPen.toFixed(1),
      backerResult: backerStopped ? 'stopped_residual' : 'penetrated' };
    // backer 내구도는 legacy 슬롯(soft)이 담당 (플레이트 관통 시 applyArmorDurabilityDamage가 softKey 차감) — owner 풀 이중차감 방지.
  }

  let blockMaterial = null;
  if (stopStage === 'hard_block')               blockMaterial = protection.hardMaterial || protection.material;
  else if (stopStage === 'soft_block')          blockMaterial = protection.material;
  else if (stopStage === 'hard_pen_soft_block') blockMaterial = protection.softMaterial || protection.material;

  // === 방어구 내구도 감소 ===
  // coverage-aware special layer는 owner 풀에서 내구도 소모하므로 legacy 중복 적용 방지
  // SIDE-AAR-ARMOR-DAMAGE-MAP §2: 이 이벤트의 방어구 손상 요약을 AAR로 넘길 배열 (hard+soft 다중 레이어 대응)
  const armorDamageInfos = [];
  // SIDE-PLATE-DURABILITY-DISPLAY-FIX-1: deterministic도 legacy slot 내구도 경로 사용 → finalArmor 스냅샷/armorLog/localZones(국부손상)가 갱신됨.
  //   (HOTFIX-1의 owner 전용 경로는 표시층이 못 읽어 플레이트/국부손상이 멈춘 것처럼 보였음)
  if (!(protection && protection._coverageSpecial)) applyArmorDurabilityDamage(target, weapon, protection, stopStage, penetrated, location, hitAspect,
    { effectivePenUsed: _effPenUsed, impactVelocity, initialVelocity: initVel, kinetics, localZoneHint, armorDamageInfos });   // ARMOR-HOTFIX-1 §6 + KINETICS §16 + AAR-MAP §2

  // === 2A-6.2: 바이저 zone 피격 → 시야/분리내구도 갱신 ===
  if (location === 'head_face' && target && target.visorState) {
    const zoneId = protection && protection._visorZoneId ? protection._visorZoneId : 'glass';
    const ammoPen = (weapon && weapon._ammo && weapon._ammo.penetration) ? weapon._ammo.penetration : 8;
    try { applyVisorZoneHit(target, zoneId, 4 + ammoPen * 0.12); } catch (e) {}
  }

  // === SIDE-MEDICAL-TRAUMA-BRIDGE-1 §3: impactAddress single-source ===
  //   rollProtection이 결정형 주소를 이미 만들었으면 그걸 인체주소 source of truth로. buildImpactAddress는 armorContact/표시 보조만.
  const armorResultStr = penetrated ? 'penetrated' : (protection.protectionType === 'none' ? 'penetrated' : 'stopped');
  let impactAddress = null;
  if (protection && protection.impactAddress) {
    impactAddress = protection.impactAddress;   // 결정형 주소 (재생성 금지)
    try {
      const rich = buildImpactAddress(target, { location, aspect: hitAspect }, protection,
        { location, aspect: hitAspect, armorResult: armorResultStr, penetrated, ammo, sourceType: 'bullet', isLeft: hitIsLeft });
      if (rich) {
        // 인체 후보 hint(anatomical/organ/structure)와 ricochet/curvature는 보조로 유지 (candidate map legacy fallback)
        const SAFE = ['ricochetHint','curvature','stance','anatomicalZone','coverageZone','organCandidates','structureCandidates','losAngleDeg','spallHint','crackHint'];
        for (const k of SAFE) if (rich[k] !== undefined && impactAddress[k] === undefined) impactAddress[k] = rich[k];
        // legacy plateCore/plateEdge/edgeLocation/softLocation 등은 "방호구 내부 접촉 위치"로 재해석
        impactAddress.armorContact = {
          sourceModel: 'legacy',
          legacyCoverageZone: rich.coverageZone || null, legacyEdgeLocation: rich.edgeLocation || null,
          legacySoftLocation: rich.softLocation || null, legacyExposedLocation: rich.exposedLocation || null,
          legacyPlateShape: rich.plateShape || null, legacyArmorLayer: rich.armorLayer || null,
          legacyPlateLocation: rich.plateLocation || null,
          legacyAarLabel: rich.aarLabel || null, legacyDebugLabel: rich.debugLabel || null,
        };
      }
    } catch (e) {}
    impactAddress.sourceModel = 'deterministic_address_coverage';
  } else {
    try {
      impactAddress = buildImpactAddress(target,
        { location, aspect: hitAspect },
        protection,
        { location, aspect: hitAspect, armorResult: armorResultStr, penetrated, ammo, sourceType: 'bullet', isLeft: hitIsLeft });
    } catch (e) { impactAddress = null; }
  }
  // 의료 표준 주소 번역 부착 (bodyTrajectory/candidateMap/woundDescriptor가 읽음)
  try {
    if (impactAddress) impactAddress.medical = normalizeMedicalImpactAddress(impactAddress,
      { location, hitPart: (impactAddress.hitPart || (typeof locationToImpactPart === 'function' ? locationToImpactPart(location, hitIsLeft) : location)), partKey: location });
  } catch (e) {}

  // === 2A-1: ricochet roll (헬멧/곡면 hard, 보수적) ===
  //   기존 armorResult가 stopped/partial일 때만 도탄 후보. 관통은 도탄 X.
  //   ricocheted true여도 medical damage는 기존 applyOutcome(BLOCK 계열) 흐름 그대로.
  if (impactAddress && impactAddress.ricochetHint && impactAddress.ricochetHint.eligible && !penetrated) {
    const roll = Math.random();
    impactAddress.ricochetHint.finalRoll = roll;
    if (roll < impactAddress.ricochetHint.chance) {
      impactAddress.ricochetHint.ricocheted = true;
      impactAddress.penetrationResult = 'ricocheted';
      // stopStage가 penetration이 아니면 deflected로 표기 (피해 계산은 그대로 BLOCK 계열)
      if (stopStage === 'hard_block' || stopStage === 'soft_block' || stopStage === 'hard_pen_soft_block') {
        impactAddress.armorResult = 'deflected';
      }
    }
  }
  // 좌우 확정값 — impactAddress가 결정한 _isLeft를 우선 사용 (medical과 공유)
  if (impactAddress && impactAddress._isLeft != null) hitIsLeft = impactAddress._isLeft;

  // 2A-6.4: 백커 해석 결과를 impactAddress + 피해 ctx에 반영
  if (backerRes) {
    if (impactAddress) {
      impactAddress.backerResult = backerRes.backerResult;
      impactAddress.backerSufficiency = backerRes.backerSufficiency;
      impactAddress.residualThreat = backerRes.residualThreat;
      impactAddress.overmatchMargin = backerRes.overmatchMargin;
      impactAddress.secondaryStopAttempted = backerRes.secondaryStopAttempted;
      impactAddress.secondaryStopSuccess = backerRes.secondaryStopSuccess;
      if (backerRes.armorResultLabel && !penetrated && !(impactAddress.armorResult === 'deflected')) impactAddress.armorResult = backerRes.armorResultLabel;
      if (backerRes.penetrationResultLabel && penetrated) impactAddress.penetrationResult = backerRes.penetrationResultLabel;
      if (backerRes.ratingMode) impactAddress.plateRatingMode = backerRes.ratingMode;
      // 2A-6.6: residualThreatPacket 디버그/AAR 필드
      if (backerRes.residualThreatPacket) {
        const pk = backerRes.residualThreatPacket;
        impactAddress.residualKind = pk.residualKind;
        impactAddress.residualPen = pk.residualPen;
        impactAddress.residualIntegrity = pk.residualIntegrity;
        impactAddress.backerCatchEligible = (typeof canBackerAttemptStop === 'function')
          ? canBackerAttemptStop(pk, backerRes.backerArmorValue || 0, backerRes.backerResult, backerRes.ratingMode) : null;
      }
      if (backerRes.backerMitigationApplied) impactAddress.backerMitigationMul = backerRes.backerMitigationMul;
    }
  }
  // SIDE-AMMO-KINETICS §23: impactKinetics를 AAR/debug용으로 저장 (전투 source로 재사용 금지 — 표시/분석 전용)
  if (impactAddress && kinetics && kinetics.hasKinetics) {
    impactAddress.impactKinetics = {
      massG: kinetics.massG, massBasis: kinetics.massBasis, projectileCount: kinetics.projectileCount,
      impactVelocityMps: +kinetics.impactVelocityMps.toFixed(1), initialVelocityMps: +kinetics.initialVelocityMps.toFixed(1),
      impactEnergyJ: kinetics.impactEnergyJ, initialEnergyJ: kinetics.initialEnergyJ, energyRatio: kinetics.energyRatio,
      impactMomentumNs: kinetics.impactMomentumNs, totalImpactEnergyJ: kinetics.totalImpactEnergyJ, totalImpactMomentumNs: kinetics.totalImpactMomentumNs,
    };
  }
  // SIDE-AAR-ARMOR-DAMAGE-MAP §2.3: 방어구 손상 요약을 impactAddress에 저장 (armorDamageInfos 배열 + 편의용 첫 항목)
  if (impactAddress && armorDamageInfos.length) {
    impactAddress.armorDamageInfos = armorDamageInfos;
    impactAddress.armorDamageInfo = armorDamageInfos[0];
  }
  // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: 세부주소 피해 감쇠 프로파일 생성 (impactAddress 확정 이후)
  if (impactAddress) {
    try {
      impactAddress.hitAddressDamageProfile = buildHitAddressDamageProfile(bodyPart, impactAddress,
        { vesselCandidateHints: (impactAddress.vesselCandidateHints || null), candidateMap: (impactAddress.candidateMap || null), armorResult: (penetrated ? 'penetrated' : 'stopped') });
    } catch (e) { impactAddress.hitAddressDamageProfile = null; }
  }
  // [IMPACT-A Phase1] canonical impact trauma packet — 원본 kinetics를 의료까지 전달 (AAR rounded와 분리)
  // [0.39.1 Fix2] canonical packet — resolveImpact 실제 결과(penetrated/stopStage/residual)를 명시적으로 전달.
  //   ctx의 오래된 값/기본 false에 의존하지 않는다. armorResult=penetrated ⇒ packet.penetrated=true 보장.
  const _impactPacket = buildImpactTraumaPacket(kinetics, ammo, weapon, ctx, impactAddress, {
    penetrated, stopStage,
    armorResult: (penetrated ? 'penetrated' : (impactAddress && impactAddress.armorResult) || 'stopped'),
    residualPen: (impactAddress && impactAddress.residualPen != null) ? impactAddress.residualPen : null,
    residualIntegrity: (impactAddress && impactAddress.residualIntegrity != null) ? impactAddress.residualIntegrity : null,
    overmatchMargin: (impactAddress && impactAddress.overmatchMargin != null) ? impactAddress.overmatchMargin : null,
    continuationDepth: (ctx && ctx._continuationDepth) || 0,
  });
  const result = applyOutcome(target, outcome, weapon, { stopStage, location, bodyPart, penetrated, blockMaterial, impactAddress, isLeft: hitIsLeft,
    armorHitResult: (protection && protection.armorHitResult) || null,
    shotVelocity: impactVelocity, shotInitialVelocity: initVel, continuationDepth: (ctx && ctx._continuationDepth) || 0,
    entryArmorContext,
    impactPacket: _impactPacket,
    // SHOTGUN-MED-NORM-1 §13: 산탄 pellet 그룹 메타를 medical damage event까지 전달
    pelletGroupId: (ctx && ctx.pelletGroupId) || null, pelletIndex: (ctx && ctx.pelletIndex), pelletCount: (ctx && ctx.pelletCount),
    shotgunPellet: !!(ctx && ctx.shotgunPellet), shotgunAmmoId: (ctx && ctx.shotgunAmmoId) || null, shotgunPatternType: (ctx && ctx.shotgunPatternType) || null,
    bluntModifier: backerRes ? backerRes.bluntMul : 1.0, shockModifier: backerRes ? backerRes.shockMul : 1.0, painModifier: backerRes ? backerRes.painMul : 1.0, _backer: backerRes });
  result.location = location;
  result.bodyPart = bodyPart;
  result.hitAspect = hitAspect;
  result.protectionType = protection.protectionType;
  result.protectionTypeKor = protection.protectionTypeKor;
  result.material = protection.material;
  result.impactAddress = impactAddress;
  // SIDE-AMMO-2B-HOTFIX-0 §8: 방탄복 순간 관통력 손실률 (Mk211 기폭 입력 + AAR/debug)
  {
    const _apB = (ammo && ammo.penetration != null) ? ammo.penetration : ((weapon && weapon._ammo && weapon._ammo.penetration) || 0);
    let _apA = (impactAddress && impactAddress.residualPen != null) ? impactAddress.residualPen
             : (result.armorHitResult && result.armorHitResult.backerResidualPen != null) ? result.armorHitResult.backerResidualPen
             : (result.residualPen != null ? result.residualPen : null);
    if (_apA == null) _apA = penetrated ? _apB * 0.6 : 0;   // 관통이면 일부 잔존, 정지면 0
    result.armorPenBeforeImpact = +(_apB || 0).toFixed(1);
    result.armorPenAfterImpact = +(_apA || 0).toFixed(1);
    result.instantArmorPenLoss = +Math.max(0, _apB - _apA).toFixed(1);
    result.instantArmorPenLossRatio = _apB > 0 ? +Math.max(0, Math.min(1, (_apB - _apA) / _apB)).toFixed(3) : 0;
    if (result.residualPen == null) result.residualPen = +(_apA || 0).toFixed(1);
  }
  // ABDOMEN-PLATE-SLOT-1: 레거시 경로에서도 frontSet 복부 플레이트가 막았으면 "복부 플레이트"로 표기 (가슴판 아님).
  //   coverage-aware가 아닌 rollProtection 경로에서 복부 피격이 front_hard_plate로 표시되던 문제 수정.
  if (protection && protection.protectionType === 'hard' && protection._plateMeta && protection._plateMeta.isAbdomenPlate) {
    const _pm = protection._plateMeta;
    result.armorHitResult = result.armorHitResult || {};
    const _ahr = result.armorHitResult;
    _ahr.selectedLayerType = _pm.plateLayerType || 'frontset_abdomen_hard';
    _ahr.coverageSource = (_pm.plateLayerType === 'frontset_abdomen_hard_rear') ? 'frontset_abdomen_rear' : 'frontset_abdomen_hard';
    _ahr.selectedLayerName = _pm.plateDisplayName || _ahr.selectedLayerName || null;
    _ahr.durabilitySlotKey = _pm.plateSlotKey || _ahr.durabilitySlotKey || null;
    _ahr.durabilityOwnerId = _pm.plateId || _ahr.durabilityOwnerId || null;
    _ahr.durabilityOwnerType = 'frontset_abdomen_hard';
    if (impactAddress) { impactAddress.selectedLayerType = _ahr.selectedLayerType; impactAddress.coverageSource = _ahr.coverageSource; }
  }
  // === SIDE-ARMOR-2B: coverage-aware path면 실제 selectedLayer 기준 armorHitResult + owner 내구도 소모 (단일 source) ===
  if (protection && protection.coverageAware && protection.armorHitResult) {
    const ahr = protection.armorHitResult;
    ahr.armorResult = armorResultStr;
    // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §8: owner(선택된 장비 정체성)와 slot(실제 UI/AAR이 읽는 내구도 슬롯)을 명시적으로 분리.
    ahr.durabilitySlotKey = protection._durabilityKey || null;
    ahr.durabilityDisplaySource = 'armorDurability.localZones';
    ahr.localZone = protection._localZoneHint || ahr.localZone || null;
    // 국부손상(localZone) 기록/표시는 legacy 슬롯(applyArmorDurabilityDamage)이 담당 — AAR은 armorDurability 슬롯을 읽음.
    if (protection._coverageOwnerId && (armorResultStr === 'stopped' || armorResultStr === 'penetrated')) {
      const _slot = protection._durabilityKey && target.armorDurability ? target.armorDurability[protection._durabilityKey] : null;
      if (_slot && _slot.localZones) ahr.localZones = _slot.localZones;
    } else if (!protection._coverageOwnerId && protection.deterministicCoverage && protection.protectionType !== 'none') {
      ahr.debugNote = (ahr.debugNote || '') + ' owner missing';
    }
    result.armorHitResult = ahr;
    // §3: backer pass 결과를 armorHitResult에 기록 (AAR "hard → soft backer") + 백커 owner 내구도 분리 차감
    if (_coverageBackerInfo) {
      ahr.backerLayerType = _coverageBackerInfo.layerType;
      ahr.backerOwnerId = _coverageBackerInfo.ownerId || protection._coverageBackerOwnerId || null;
      ahr.backerResult = _coverageBackerInfo.backerResult;
      ahr.backerResidualPen = _coverageBackerInfo.residualPen;
      ahr.debugNote = (ahr.debugNote || '') + ` → backer ${_coverageBackerInfo.layerType}(${_coverageBackerInfo.backerResult})`;
      // 백커 내구도도 legacy 슬롯(soft)이 담당 (플레이트 관통 시 applyArmorDurabilityDamage가 softKey도 차감).
    } else if (protection.deterministicCoverage && protection._coverageBackerOwnerId && penetrated && protection.protectionType === 'hard') {
      ahr.backerOwnerId = protection._coverageBackerOwnerId; ahr.backerLayerType = protection._coverageBackerLayerType || 'vest_soft';
    }
  } else {
    // 결정형 armorHitResult가 없을 때만(비결정형 fallback) legacy 어댑터로 변환
    result.armorHitResult = _legacyArmorHitResultAdapter(protection, impactAddress, location, hitAspect, target);
    if (_coverageBackerInfo && result.armorHitResult) {
      result.armorHitResult.backerLayerType = _coverageBackerInfo.layerType;
      result.armorHitResult.backerOwnerId = _coverageBackerInfo.ownerId;
      result.armorHitResult.backerResult = _coverageBackerInfo.backerResult;
      result.armorHitResult.backerResidualPen = _coverageBackerInfo.residualPen;
    }
  }
  // AAR 로그
  if (impactAddress) {
    const _ahr = result.armorHitResult || null;
    recordImpactEvent(shooter, target, impactAddress, {
      sourceType: 'bullet',
      weaponName: (weapon && weapon.id) || (shooter && shooter.weaponId),
      ammoId: (weapon && weapon.ammoId) || (shooter && shooter.ammoId),
      damageSummary: { outcome, penetrated, stopStage },
      // SIDE-ARMOR-2D: 실제 결과/coverage 메타를 AAR로 직접 전달 (impactAddress 내부값만 의존하지 않음)
      armorResult: armorResultStr,
      penetrationResult: penetrated ? 'penetrated' : (impactAddress.penetrationResult || null),
      armorHitResult: _ahr,
      selectedLayerType: _ahr && _ahr.selectedLayerType,
      coverageSource: _ahr && _ahr.coverageSource,
      durabilityOwnerId: _ahr && _ahr.durabilityOwnerId,
      backerInfo: _coverageBackerInfo || (_ahr && _ahr.backerLayerType ? { layerType:_ahr.backerLayerType, ownerId:_ahr.backerOwnerId, backerResult:_ahr.backerResult } : null),
      bodyTrajectory: (target.medical && target.medical._currentEventWound && target.medical._currentEventWound.bodyTrajectory) || null,
      bodyTrajectoryLabel: (target.medical && target.medical._currentEventWound && target.medical._currentEventWound.bodyTrajectoryLabel) || null,
      medicalSummaryAfter: target.medical ? { lifeStatus: target.medical.lifeStatus, bloodMl: Math.round(target.medical.bloodMl) } : null,
    });
    if (typeof GAME !== 'undefined' && GAME.debugImpactAddress) {
      logImpactAddressDebug(impactAddress, shooter, target);
    }
  }
  result.penetrated = penetrated;
  result.stopStage = stopStage;
  // HOTFIX-1: continuation raycast 연결용 — 최신 wound의 bodyTrajectory 노출
  result.bodyTrajectory = (target.medical && target.medical._currentEventWound && target.medical._currentEventWound.bodyTrajectory) || null;
  result.entryArmorContext = entryArmorContext;
  return result;
}

// === 2A-2: debugImpactAddress 가독성 출력 (라벨 + raw key, null 생략) ===
function logImpactAddressDebug(ia, shooter, target) {
  if (!ia) return;
  const fmtCov = (c) => c ? `${(c.hardP*100).toFixed(0)}/${(c.softP*100).toFixed(0)}/${(c.noneP*100).toFixed(0)}` : '–';
  const L = (labelFn, raw) => raw != null ? `${labelFn(raw)} (${raw})` : null;
  const rows = {
    '라벨': (typeof getImpactAddressLabel==='function') ? getImpactAddressLabel(ia, {withCandidates:true}) : ia.aarLabel,
    sourceModel: ia.sourceModel,
    hitPart: L(k=>_lbl(IA_LABELS.hitPart,k), ia.hitPart),
    impactSide: L(k=>_lbl(IA_LABELS.impactSide,k), ia.impactSide),
    stance: ia.stance,
    armorLayer: L(k=>_lbl(IA_LABELS.armorLayer,k), ia.armorLayer),
    coverageZone: L(getCoverageZoneLabel, ia.coverageZone),
    plateShape: ia.plateShape, plateLocation: ia.plateLocation,
    edgeLocation: L(getEdgeLocationLabel, ia.edgeLocation),
    softLocation: L(getSoftLocationLabel, ia.softLocation),
    exposedLocation: L(getExposedLocationLabel, ia.exposedLocation),
    accessoryType: ia.accessoryType,
    helmetZone: L(getHelmetZoneLabel, ia.helmetZone),
    faceLocation: L(getFaceLocationLabel, ia.faceLocation),
    limbLocation: L(getLimbLocationLabel, ia.limbLocation),
    neckLocation: L(getNeckLocationLabel, ia.neckLocation),
    anatomicalClass: L(getAnatomicalClassLabel, ia.anatomicalClass),
    junctionClass: (ia.junctionClass && ia.junctionClass !== 'none') ? L(getJunctionClassLabel, ia.junctionClass) : null,
    anatomicalZone: L(getAnatomicalZoneLabel, ia.anatomicalZone),
    organCandidates: getOrganListLabel(ia.organCandidates),
    structureCandidates: getStructureListLabel(ia.structureCandidates),
    baseCoverage: fmtCov(ia.baseCoverage),
    transformedCoverage: ia.transformedCoverage ? fmtCov(ia.transformedCoverage) : null,
    armorResult: ia.armorResult, penetrationResult: ia.penetrationResult,
    plateRating: ia.plateRatingMode || null,
    backer: (ia.backerResult && ia.backerResult !== 'none') ? `${ia.backerResult} (suff ${ia.backerSufficiency!=null?ia.backerSufficiency.toFixed(2):'?'})` : null,
    residual: (ia.secondaryStopAttempted) ? `threat ${ia.residualThreat} / overmatch ${ia.overmatchMargin} / 2차저지 ${ia.secondaryStopSuccess?'성공':'실패'}` : null,
    ricochet: (ia.ricochetHint && ia.ricochetHint.eligible) ? `${(ia.ricochetHint.chance*100).toFixed(0)}%${ia.ricochetHint.ricocheted?' RICOCHETED':''} [${ia.ricochetHint.ammoSource}]` : null,
    crack: (ia.crackHint && ia.crackHint.eligible) ? `${ia.crackHint.type} (${ia.crackHint.material})` : null,
    durabilityGroup: ia.durabilityGroupHint,
    SLAAP: ia.accessoryType === 'SLAAP' ? '실제 방호' : (ia._slaapCandidate ? 'candidate(미반영)' : null),
  };
  // 2A-6.4 마감: 의료 연계 debug (target.medical.stressResponse가 있으면)
  try {
    const m = target && target.medical;
    const sr = m && m.stressResponse;
    if (sr) {
      const f2 = (x) => (typeof x === 'number' && isFinite(x)) ? x.toFixed(2) : '?';
      rows['med:pain/perceived'] = `${(m.pain||0).toFixed(0)} / ${f2(sr.perceivedPain)}`;
      rows['med:shock'] = (m.shock||0).toFixed(0);
      rows['stress:adr/symp/panic'] = `${f2(sr.adrenaline)} / ${f2(sr.sympatheticTone)} / ${f2(sr.panic)}`;
      rows['stress:mask/crash'] = `${f2(sr.painMasking)} / ${f2(sr.postCombatCrash)}`;
      if (target.painkillerActive || (target.analgesiaLevel||0) > 0) rows['analgesia'] = (target.analgesiaLevel||0).toFixed(0);
      if (target.shockCareApplied) rows['shockCareApplied'] = 'true';
    }
  } catch (e) {}
  // null/없음 제거
  const clean = {};
  for (const k in rows) { if (rows[k] != null && rows[k] !== '–' && rows[k] !== '') clean[k] = rows[k]; }
  console.groupCollapsed('%c[ImpactAddress] ' + (clean['라벨'] || ia.debugLabel), 'color:#7ac0ff;font-weight:bold');
  console.table(clean);
  console.groupEnd();
}
// =============================================================
