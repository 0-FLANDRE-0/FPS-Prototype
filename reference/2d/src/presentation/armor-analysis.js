// SIDE-ARMOR-INTERACTIVE-ANALYSIS-1 — 대화형 방호 실험장
//   실제 유닛/의료/AAR 무영향. 분석 전용 복사본(testDurability)에만 손상 누적.
// =============================================================
const AA_ZONE_LABELS = { center:'중심', upper:'상단', lower:'하단', side:'측면', edge:'가장자리', glass:'바이저 글래스', frame:'바이저 프레임', unknown:'미상' };
function aaZoneNeighbors(zone) {
  return ({ center:['upper','lower','side'], upper:['center','side'], lower:['center','side'],
            side:['center','upper','lower'], edge:['side','upper','lower'],
            glass:['frame'], frame:['glass'] })[zone] || [];
}
// 거리 기반 kinetics + 유효 관통 배율 (point-blank≈1.0)
function aaGetKinetics(ammo, distanceM) {
  const v0 = ammo.velocity || 0;
  const ret = (typeof getDistanceVelocityRetention === 'function') ? getDistanceVelocityRetention(ammo, distanceM) : 1;
  const impactVel = Math.max(1, v0 * ret);
  const kin = computeProjectileKinetics(ammo, impactVel, v0);
  const velMul = (typeof resolveKineticPenetrationMul === 'function') ? resolveKineticPenetrationMul(ammo, kin) : (0.55 + 0.45 * (impactVel / Math.max(1, v0)));
  return { kin, impactVel, velMul };
}
// frontSet 슬롯 최대 내구도 (frontSetSlotMax 우선)
function aaSlotMax(plate, slotKey, fallback) {
  if (plate && plate.frontSetSlotMax && plate.frontSetSlotMax[slotKey] != null) return plate.frontSetSlotMax[slotKey];
  if (plate && plate.slotMax && plate.slotMax[slotKey] != null) return plate.slotMax[slotKey];
  return (plate && plate.maxDurability) || fallback || 50;
}
function aaNewZones() { return { center:0, upper:0, lower:0, side:0, edge:0, glass:0, frame:0, unknown:0 }; }
// 분석 전용 durability 초기화 (실제 객체 참조 금지 — 값만 복사)
function initArmorAnalysisDurability(info) {
  if (!info) return null;
  const plate = info.sourceId ? PLATE_PRESETS[info.sourceId] : null;
  const out = {};
  const slotKey = info.slotKey || 'analysis_slot';
  const max = aaSlotMax(plate, slotKey, info.maxDur || 50);
  out[slotKey] = { slotKey, material: info.durabilityMaterial || info.material || 'composite', max, current: max,
    localZones: aaNewZones(), spallRisk: 0, coatingDamage: 0, visibilityDamage: 0, backfaceDamage: 0 };
  // frontSet 가슴/복부가 함께 있는 plate면 짝 슬롯도 생성 (섞이지 않게 별도 키)
  if (plate && plate.frontSetSlotMax) {
    for (const k of Object.keys(plate.frontSetSlotMax)) {
      if (out[k]) continue;
      const mx = plate.frontSetSlotMax[k];
      out[k] = { slotKey: k, material: info.durabilityMaterial || info.material || 'composite', max: mx, current: mx,
        localZones: aaNewZones(), spallRisk: 0, coatingDamage: 0, visibilityDamage: 0, backfaceDamage: 0 };
    }
  }
  // SIDE-ARMOR-INTERACTIVE-ANALYSIS: 소프트 백커 슬롯 (플레이트 뒤/주변 — 단독 피격 테스트용)
  if (info.softBacker && info.softBacker.slotKey && !out[info.softBacker.slotKey]) {
    const sb = info.softBacker;
    out[sb.slotKey] = { slotKey: sb.slotKey, material: sb.material || 'aramid', max: sb.maxDur || 40, current: sb.maxDur || 40,
      localZones: aaNewZones(), spallRisk: 0, coatingDamage: 0, visibilityDamage: 0, backfaceDamage: 0, isSoftBacker: true };
  }
  // SIDE-HELMET-ACCESSORY-ANALYSIS: 헬멧 부속품(바이저/SLAAP) 내구도 슬롯 — 부위별 단독 피격 테스트
  if (info.helmetAccessories && info.helmetAccessories.length) {
    for (const acc of info.helmetAccessories) {
      if (!acc.slotKey || out[acc.slotKey]) continue;
      const mx = acc.maxDur || 28;
      out[acc.slotKey] = { slotKey: acc.slotKey, material: acc.durabilityMaterial || acc.material || 'composite', max: mx, current: mx,
        localZones: aaNewZones(), spallRisk: 0, coatingDamage: 0, visibilityDamage: 0, backfaceDamage: 0, isAccessory: true, accessoryType: acc.accessoryType };
    }
  }
  ARMOR_ANALYSIS._baselineDur = JSON.parse(JSON.stringify(out));
  return out;
}
function resetArmorAnalysisTestState(keepPoint) {
  if (ARMOR_ANALYSIS._baselineDur) ARMOR_ANALYSIS.testDurability = JSON.parse(JSON.stringify(ARMOR_ANALYSIS._baselineDur));
  // durRatio 반영 (초기 내구도 슬라이더)
  const r = Math.max(0, Math.min(1, ARMOR_ANALYSIS.durRatio));
  if (ARMOR_ANALYSIS.testDurability) for (const k in ARMOR_ANALYSIS.testDurability) {
    const s = ARMOR_ANALYSIS.testDurability[k];
    s.current = +(s.max * r).toFixed(2);
    s.localZones = aaNewZones(); s.spallRisk = 0; s.coatingDamage = 0; s.visibilityDamage = 0; s.backfaceDamage = 0;
  }
  ARMOR_ANALYSIS.hitMarkers = [];
  ARMOR_ANALYSIS.hitLog = [];
  ARMOR_ANALYSIS.shotSeq = 0;
  ARMOR_ANALYSIS.lastResult = null;
  ARMOR_ANALYSIS.selMarkerId = null;
  if (!keepPoint) ARMOR_ANALYSIS.selectedPoint = null;
}
// 클릭점 → localZone + (visor) zone 재질
function resolveAnalysisLocalZoneFromPoint(normX, normY, panelKind, visorHitTable) {
  const cx = Math.abs(normX - 0.5), cy = Math.abs(normY - 0.5);
  if (visorHitTable) {
    if (cx < 0.28 && cy < 0.30) return { zone: 'glass' };
    return { zone: 'frame' };
  }
  if (normX < 0.12 || normX > 0.88 || normY < 0.10 || normY > 0.90) return { zone: 'edge' };
  if (cx <= 0.225 && cy <= 0.225) return { zone: 'center' };
  if (normY <= 0.25) return { zone: 'upper' };
  if (normY >= 0.75) return { zone: 'lower' };
  if (normX <= 0.20 || normX >= 0.80) return { zone: 'side' };
  return { zone: 'center' };
}
// 예상 인체 피해 (텍스트/hint 전용 — 실제 상처 생성 금지)
function estimateArmorAnalysisBodyDamage(resultKind, ammo, point, info, kin) {
  const loc = (point.slotKey || '').indexOf('abdomen') === 0 ? 'abdomen'
            : (point.slotKey || '').indexOf('head') === 0 || info.isHelmet ? 'head'
            : (point.slotKey || '').indexOf('neck') === 0 ? 'neck'
            : (point.slotKey || '').indexOf('arm') >= 0 ? 'arm' : 'chest';
  const eJ = (kin && kin.kin && kin.kin.impactEnergyJ) || 0;
  if (resultKind === 'ricochet') return { severity:'low', label:'낮음', hints:['도탄 — 직접 피해 낮음','파편/스폴 위험만'] };
  if (resultKind === 'stopped') {
    const hints = ['둔상 위험', '백페이스 변형 후보'];
    if (eJ >= 1500) hints.push('호흡 저하/통증 후보');
    return { severity: eJ >= 2200 ? 'medium' : 'low', label: eJ >= 2200 ? '중간' : '낮음', hints };
  }
  if (resultKind === 'partial_or_backer_stopped') {
    return { severity:'medium', label:'중간', hints:['얕은 관통/파편 후보','둔상+표재성 손상 후보'] };
  }
  // penetrated
  const organ = ({ chest:['폐 후보','심장/대혈관 후보','늑골 골절 후보'], abdomen:['간/위장 후보','장 손상 후보','복부 대혈관 후보'],
                   neck:['경동맥 후보','기도 후보'], head:['두개/뇌 손상 후보','치명적 위험'], arm:['근육/연부조직','상완 혈관 후보','외부출혈 후보'] })[loc] || ['연부조직 손상 후보'];
  const sev = (loc === 'head' || loc === 'neck') ? 'critical' : (eJ >= 2000 ? 'critical' : 'high');
  return { severity: sev, label: sev === 'critical' ? '치명적 위험' : '높음', hints: organ };
}
// === 사격 분석 (순수 계산 — 실제 부작용 없음) ===
function simulateArmorAnalysisShot(point, opts) {
  opts = opts || {};
  const ammo = AMMO_PRESETS[opts.ammoId || ARMOR_ANALYSIS.ammoId];
  const info = ARMOR_ANALYSIS.slotInfo;
  if (!ammo || !info || !point) return null;
  const td = ARMOR_ANALYSIS.testDurability;
  const slot = td && td[point.slotKey];
  if (!slot) {   // 비방호 영역
    ARMOR_ANALYSIS.lastResult = { resultKind:'unprotected', ammoId:ammo.id, distanceM: opts.distanceM || ARMOR_ANALYSIS.distanceM, point };
    return ARMOR_ANALYSIS.lastResult;
  }
  const distanceM = opts.distanceM != null ? opts.distanceM : ARMOR_ANALYSIS.distanceM;
  const kk = aaGetKinetics(ammo, distanceM);
  const material = point.material || info.material;
  const durMat = normalizeDurabilityMaterial(slot.material || material, point.zoneMaterialHint || null, 'composite');
  const baseArmor = point.baseArmor != null ? point.baseArmor : info.baseArmor;
  const ratio = slot.max > 0 ? slot.current / slot.max : 0;
  // 국부 손상 반영 effectiveArmor (분석용 fake target)
  const fakeTarget = { armorDurability: { [point.slotKey]: slot } };
  const localMul = getArmorLocalZoneMul(fakeTarget, point.slotKey, point.localZone);
  let effectiveArmor = baseArmor * getDurabilityArmorMul(durMat, ratio) * localMul;
  if (info.isHelmet && typeof getHelmetArmorPenalty === 'function') effectiveArmor = Math.max(0, effectiveArmor - getHelmetArmorPenalty(ammo));
  // 유효 관통 (재질 페널티 + 거리 배율)
  const matPenalty = (ammo.materialPenPenalty && ammo.materialPenPenalty[material]) || 0;
  const effPen = Math.max(0, ((ammo.penetration || 0) - matPenalty) * kk.velMul);
  const diff = effPen - effectiveArmor;
  const penProb = penetrationProbability(diff);
  // deterministic 판정 (재현성 우선)
  let resultKind;
  const tc = getArmorThreatClass(ammo);
  const isAP = /penetrator|high_power_ap|anti_material/.test(tc);
  if (diff <= -12 && (durMat === 'steel' || durMat === 'titanium') && !isAP) resultKind = 'ricochet';
  else if (penProb >= 0.80) resultKind = 'penetrated';
  else if (penProb >= 0.50) resultKind = 'partial_or_backer_stopped';
  else resultKind = 'stopped';
  const penetrated = (resultKind === 'penetrated');
  // 손상 계산 — 실제 전투와 같은 순수 함수 재사용 (target=분석 복사본 → cap/멀티히트 동작, 부작용 없음)
  const dmg = computeArmorDurabilityDamage({
    ammo, material, durabilityMaterial: durMat,
    layerType: (point.panelKind === 'soft') ? 'soft' : (info.isHelmet ? 'helmet' : (info.protectionType === 'soft' ? 'soft' : 'hard')),
    baseArmor, effectiveArmor, armorResult: resultKind, penetrated,
    localZone: point.localZone, kinetics: kk.kin, target: fakeTarget, slotKey: point.slotKey,
  }) || { globalAmount:0, localAmount:0, neighborSplashAmount:0, damageMode:'none' };
  // 누적 (분석 복사본에만)
  const gBefore = slot.current;
  slot.current = Math.max(0, +(slot.current - dmg.globalAmount).toFixed(2));
  const z = point.localZone;
  slot.localZones[z] = Math.min(100, +((slot.localZones[z] || 0) + dmg.localAmount).toFixed(2));
  const nb = aaZoneNeighbors(z);
  if (dmg.neighborSplashAmount > 0 && nb.length) { const per = dmg.neighborSplashAmount / nb.length; for (const nz of nb) slot.localZones[nz] = Math.min(100, +((slot.localZones[nz] || 0) + per).toFixed(2)); }
  slot.spallRisk = Math.min(100, +(slot.spallRisk + (dmg.spallRiskDelta || 0) * 100).toFixed(2));
  slot.coatingDamage = Math.min(100, +(slot.coatingDamage + (dmg.coatingDamageDelta || 0)).toFixed(2));
  slot.visibilityDamage = Math.min(100, +(slot.visibilityDamage + (dmg.visibilityDamageDelta || 0)).toFixed(2));
  slot.backfaceDamage = Math.min(100, +(slot.backfaceDamage + (dmg.backfaceDeformationHint || 0)).toFixed(2));
  // 마커 + 로그
  const shotNo = ++ARMOR_ANALYSIS.shotSeq;
  const mk = { id: 'aam' + shotNo, shotNo, x: point.x, y: point.y, slotKey: point.slotKey, localZone: z,
    resultKind, globalAmount: dmg.globalAmount, localAmount: dmg.localAmount, ammoId: ammo.id, distanceM };
  ARMOR_ANALYSIS.hitMarkers.push(mk);
  const bodyHint = estimateArmorAnalysisBodyDamage(resultKind, ammo, point, info, kk);
  const log = { id: mk.id, shotNo, ammoId: ammo.id, ammoName: ammo.name || ammo.id, distanceM, slotKey: point.slotKey, localZone: z,
    resultKind, effectivePen: +effPen.toFixed(1), effectiveArmor: +effectiveArmor.toFixed(1),
    impactVel: Math.round(kk.impactVel), impactEnergyJ: kk.kin.impactEnergyJ ? Math.round(kk.kin.impactEnergyJ) : null,
    impactMomentumNs: kk.kin.impactMomentumNs || null, penProb,
    globalBefore: +gBefore.toFixed(1), globalAfter: slot.current, globalAmount: +dmg.globalAmount.toFixed(2),
    localAmount: +dmg.localAmount.toFixed(2), neighborSplash: +(dmg.neighborSplashAmount || 0).toFixed(2),
    damageMode: dmg.damageMode, localBefore: +((slot.localZones[z] || 0) - dmg.localAmount).toFixed(1), localAfter: slot.localZones[z],
    spallRisk: slot.spallRisk, coatingDamage: slot.coatingDamage, visibilityDamage: slot.visibilityDamage, backfaceDamage: slot.backfaceDamage,
    bodyHint, material: durMat, damageInfo: dmg };
  ARMOR_ANALYSIS.hitLog.unshift(log);
  if (ARMOR_ANALYSIS.hitLog.length > 60) ARMOR_ANALYSIS.hitLog.length = 60;
  ARMOR_ANALYSIS.lastResult = log;
  ARMOR_ANALYSIS.selMarkerId = mk.id;
  return log;
}
// 연속 사격 (같은 지점 반복)
function fireArmorAnalysisShots(n) {
  const p = ARMOR_ANALYSIS.selectedPoint;
  if (!p) { const si = document.getElementById('aaStageInfo'); if (si) si.innerHTML = '<span style="color:#ff9a3a">우측 패널에서 피격점을 먼저 클릭하세요.</span>'; return; }
  for (let i = 0; i < n; i++) simulateArmorAnalysisShot(p, { ammoId: ARMOR_ANALYSIS.ammoId, distanceM: ARMOR_ANALYSIS.distanceM, repeatIndex: i });
  if (ARMOR_ANALYSIS.viewMode === 'coverage') ARMOR_ANALYSIS.viewMode = 'local';   // 첫 사격 후 국부손상 보기로
  ARMOR_ANALYSIS.tab = 'result';   // 사격 결과/그래프 탭으로 전환
  renderArmorAnalysis();
}

// === 스테이지 SVG (피격점 선택/시각화) ===
const AA_STAGE_VB = { w: 100, h: 120 };
function aaStageGeom(info, aspect) {
  // 반환: { kind, plates:[{slotKey,ptsStr,bbox,shape,label}], ptsStr, bbox, softPts, hasSoft, isVisor }
  //   plates는 1개(일반) 또는 2개(6B23 frontSet 가슴+복부). ptsStr/bbox = plates[0] (호환).
  const isVisor = !!(info && info.visorHitTable);
  if (info && info.isHelmet) {
    const pts = '50,14 64,16 73,26 75,44 70,58 50,64 30,58 25,44 27,26 36,16';
    const bb = _bboxOfPoints(pts);
    const plates = [{ slotKey: info.slotKey, ptsStr: pts, bbox: bb, shape: 'helmet', label: info.label }];
    // SIDE-HELMET-ACCESSORY-ANALYSIS: 장착된 바이저/SLAAP를 같은 세트로 표시 (방호범위와 동일 형태 = ACCESSORY_SHAPES). head 100×100 좌표 → stage 변환.
    if (info.helmetAccessories && info.helmetAccessories.length && typeof ACCESSORY_SHAPES !== 'undefined') {
      const h2s = (str) => str.trim().split(/\s+/).map(p => { const a = p.split(',').map(Number); return (50 + (a[0] - 50) * 1.25).toFixed(1) + ',' + (14 + (a[1] - 6) * 1.136).toFixed(1); }).join(' ');
      for (const acc of info.helmetAccessories) {
        let raw = null;
        if (acc.accessoryType === 'visor') {
          if (acc.isK63 && ACCESSORY_SHAPES.visorK63 && ACCESSORY_SHAPES.visorK63.front && ACCESSORY_SHAPES.visorK63.front.frame) raw = ACCESSORY_SHAPES.visorK63.front.frame.points;
          else if (ACCESSORY_SHAPES.visor && ACCESSORY_SHAPES.visor.front) raw = ACCESSORY_SHAPES.visor.front.points;
        } else if (acc.accessoryType === 'slaap' && ACCESSORY_SHAPES.slaap && ACCESSORY_SHAPES.slaap.front) {
          raw = ACCESSORY_SHAPES.slaap.front.points;
        }
        if (!raw) continue;
        const aps = h2s(raw);
        plates.push({ slotKey: acc.slotKey, ptsStr: aps, bbox: _bboxOfPoints(aps), shape: acc.accessoryType, label: acc.label,
          isAccessory: true, accessoryType: acc.accessoryType, isVisor: acc.isVisor, visorHitTable: acc.visorHitTable,
          material: acc.material, durabilityMaterial: acc.durabilityMaterial, baseArmor: acc.baseArmor, bluntMul: acc.bluntMul });
      }
    }
    return { kind: 'helmet', plates, ptsStr: pts, bbox: bb, hasSoft: false, isVisor: false, hasAccessories: plates.length > 1 };
  }
  if (isVisor) {
    const pts = '34,24 66,24 70,40 66,72 34,72 30,40';
    const bb = _bboxOfPoints(pts);
    return { kind: 'visor', plates: [{ slotKey: info.slotKey, ptsStr: pts, bbox: bb, shape: 'visor', label: info.label, isVisor: true }], ptsStr: pts, bbox: bb, hasSoft: false, isVisor: true };
  }
  const protType = info ? info.protectionType : 'hard';
  const cov = (info && info.bodyArmorId && typeof ARMOR_COVERAGE_SHAPES !== 'undefined') ? ARMOR_COVERAGE_SHAPES[info.bodyArmorId] : null;
  const aspectKey = (info && (info.aspect === 'side' || info.aspect === 'rear')) ? info.aspect : 'front';
  const covA = cov ? (cov[aspectKey] || cov.front) : null;
  const plate = (info && info.sourceId && typeof PLATE_PRESETS !== 'undefined') ? PLATE_PRESETS[info.sourceId] : null;
  const isFrontSet = !!(plate && plate.frontSetSlotMax);
  if (protType !== 'soft' && info && info.sourceId && covA && covA.softShape && typeof getPlateShape === 'function') {
    const softRaw = covA.softShape.points;
    const softBb = _bboxOfPoints(softRaw);
    const dst = { x: 8, y: 8, w: 84, h: 104 };   // 스테이지 viewBox 0 0 100 120 내 대상 박스
    const sc = Math.min(dst.w / softBb.w, dst.h / softBb.h);
    const ox = dst.x + (dst.w - softBb.w * sc) / 2 - softBb.minX * sc;
    const oy = dst.y + (dst.h - softBb.h * sc) / 2 - softBb.minY * sc;
    const xf = (pStr) => pStr.trim().split(/\s+/).map(p => { const a = p.split(',').map(Number); return (a[0] * sc + ox).toFixed(1) + ',' + (a[1] * sc + oy).toFixed(1); }).join(' ');
    const softPts = xf(softRaw);
    const covSlotToDur = (cs) => cs === 'abdomen_front' ? 'abdomen_front_hard' : cs === 'chest_front' ? 'chest_front_hard' : cs === 'chest_rear' ? 'chest_rear_hard' : info.slotKey;
    const plates = [];
    if (isFrontSet && covA.hardShapeSet && covA.hardShapeSet.length) {
      // 6B23 frontSet — 가슴+복부 둘 다 (정확한 영역 = hardShapeSet)
      for (const hs of covA.hardShapeSet) {
        const hbb = _bboxOfPoints(hs.points);
        const hitPart = (hs.slot === 'abdomen_front') ? 'abdomen' : 'chest';
        const shapeName = getPlateShape(info.sourceId, hitPart) || 'sapi';
        const ptsStr = xf(plateShapeToPoints(shapeName, hbb, 0.0));
        plates.push({ slotKey: covSlotToDur(hs.slot), ptsStr, bbox: _bboxOfPoints(ptsStr), shape: shapeName, label: hs.label });
      }
    } else {
      const hitPart = (typeof _slotHitPart === 'function') ? _slotHitPart(info.slotKey) : 'chest';
      const shapeName = getPlateShape(info.sourceId, hitPart) || 'sapi';
      let hbb;
      if (covA.hardShape) hbb = _bboxOfPoints(covA.hardShape.points);
      else hbb = { minX: softBb.minX + softBb.w * 0.12, minY: softBb.minY + softBb.h * 0.20, w: softBb.w * 0.76, h: softBb.h * 0.62 };
      const ptsStr = xf(plateShapeToPoints(shapeName, hbb, 0.0));
      plates.push({ slotKey: info.slotKey, ptsStr, bbox: _bboxOfPoints(ptsStr), shape: shapeName, label: (covA.hardShape && covA.hardShape.label) || info.label });
    }
    return { kind: 'hard', plates, softPts, hasSoft: true, ptsStr: plates[0].ptsStr, bbox: plates[0].bbox, softLabel: covA.softShape.label };
  }
  // 커버리지 데이터 없음 — 단일 플레이트 fallback
  let bbox = { minX: 18, minY: 14, w: 64, h: 92 }, ptsStr;
  if (protType === 'hard' && info && info.sourceId && typeof getPlateShape === 'function') {
    const hitPart = (typeof _slotHitPart === 'function') ? _slotHitPart(info.slotKey) : 'chest';
    const sh = getPlateShape(info.sourceId, hitPart) || 'sapi';
    ptsStr = plateShapeToPoints(sh, bbox, 0.02);
    return { kind: 'hard', plates: [{ slotKey: info.slotKey, ptsStr, bbox, shape: sh, label: info.label }], ptsStr, bbox, hasSoft: false };
  }
  bbox = { minX: 22, minY: 16, w: 56, h: 88 };
  const { minX, minY, w, h } = bbox;
  ptsStr = `${minX+w*0.12},${minY} ${minX+w*0.88},${minY} ${minX+w},${minY+h*0.10} ${minX+w},${minY+h*0.90} ${minX+w*0.88},${minY+h} ${minX+w*0.12},${minY+h} ${minX},${minY+h*0.90} ${minX},${minY+h*0.10}`;
  return { kind: protType === 'soft' ? 'soft' : 'hard', plates: [{ slotKey: info.slotKey, ptsStr, bbox, shape: 'rect', label: info.label }], ptsStr, bbox, hasSoft: false };
}
function aaParsePts(str) { return str.trim().split(/\s+/).map(p => p.split(',').map(Number)); }
function aaPointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function aaDurabilityColor(r) {
  r = Math.max(0, Math.min(1, r));
  if (r <= 0) return '#3a1414';
  if (r < 0.25) return '#a33030';
  if (r < 0.50) return '#c87838';
  if (r < 0.80) return '#c8b038';
  return '#3a7a8a';
}
function aaKindColor(kind) {
  return ({ hard:'#22406e', soft:'#1f5a3a', helmet:'#3a2a6a', visor:'#2a5a64' })[kind] || '#2a3a4a';
}
// 국부 heatmap seeds (hitMarkers 기반 — 분석 클릭점)
function buildArmorAnalysisSeeds(geom) {
  const seeds = [];
  const rBase = ({ ceramic:11, glass:13, steel:8, titanium:8, composite:9, pe:9, aramid:10, aluminum:9 })[geom._mat] || 9;
  for (const m of ARMOR_ANALYSIS.hitMarkers) {
    const strength = Math.max(m.localAmount || 0, (m.globalAmount || 0) * 2, 1);
    seeds.push({ x: m.x, y: m.y, r: rBase, strength });
  }
  return seeds;
}
function aaFieldValueAt(x, y, seeds) {
  let v = 0;
  for (const s of seeds) {
    const dx = x - s.x, dy = y - s.y, dd = dx * dx + dy * dy;
    v += s.strength / (1 + dd / (s.r * s.r * 0.5));
  }
  return Math.max(0, Math.min(100, v));
}
function renderArmorAnalysisStage() {
  const svg = document.getElementById('aaStageSvg');
  if (!svg) return;
  const info = ARMOR_ANALYSIS.slotInfo;
  if (!info) { svg.innerHTML = ''; return; }
  const geom = aaStageGeom(info, ARMOR_ANALYSIS.aspect);
  const td = ARMOR_ANALYSIS.testDurability || {};
  const mainSlot = td[info.slotKey] || null;
  geom._mat = (mainSlot && mainSlot.material) || info.durabilityMaterial || info.material;
  const pts = aaParsePts(geom.ptsStr);
  const view = ARMOR_ANALYSIS.viewMode;
  let fill = aaKindColor(geom.kind), fillOpacity = 0.30;
  if (view === 'durability' && mainSlot) { fill = aaDurabilityColor(mainSlot.max > 0 ? mainSlot.current / mainSlot.max : 0); fillOpacity = 0.42; }
  let h = '';
  const clipId = 'aaStageClip';
  // heatmap/clip 영역 — 소프트 백커가 있으면 소프트 외곽까지 (플레이트+소프트 모두 표시)
  const clipPolyPts = (geom.hasSoft && geom.softPts) ? geom.softPts : geom.ptsStr;
  const fieldBb = (geom.hasSoft && geom.softPts) ? _bboxOfPoints(geom.softPts) : geom.bbox;
  h += `<defs><clipPath id="${clipId}"><polygon points="${clipPolyPts}"/></clipPath></defs>`;
  // 소프트 캐리어/백커 (플레이트 뒤) — 먼저 그려서 플레이트가 위에 겹치게
  if (geom.hasSoft && geom.softPts) {
    let softFill = '#1f5a3a', softOp = 0.22;
    const sb = info.softBacker;
    const sslot = (sb && td[sb.slotKey]) ? td[sb.slotKey] : null;
    if (view === 'durability' && sslot) { softFill = aaDurabilityColor(sslot.max > 0 ? sslot.current / sslot.max : 0); softOp = 0.34; }
    h += `<polygon points="${geom.softPts}" fill="${softFill}" fill-opacity="${softOp}" stroke="#4a7a58" stroke-width="0.6" stroke-dasharray="2.5,1.5"/>`;
  }
  // 패널 본체 (플레이트) — frontSet면 가슴+복부 둘 다, 각각 자기 내구도로
  for (const pl of geom.plates) {
    const slot = td[pl.slotKey] || null;
    let pfill = aaKindColor(geom.kind), pop = 0.30;
    if (pl.isAccessory) { pfill = (pl.accessoryType === 'visor') ? '#2a6a74' : '#6a5a2a'; pop = 0.38; }   // SIDE-HELMET-ACCESSORY-ANALYSIS: 바이저=청록/SLAAP=황갈 구분
    if (view === 'durability' && slot) { pfill = aaDurabilityColor(slot.max > 0 ? slot.current / slot.max : 0); pop = 0.45; }
    const selZone = ARMOR_ANALYSIS.selectedPoint;
    const isSelPlate = selZone && selZone.slotKey === pl.slotKey && selZone.panelKind !== 'soft';
    h += `<polygon points="${pl.ptsStr}" fill="${pfill}" fill-opacity="${pop}" stroke="${isSelPlate ? '#ffd479' : (pl.isAccessory ? '#8aa8b5' : '#5a7a95')}" stroke-width="${isSelPlate ? 1.3 : 0.9}"${pl.isAccessory ? ' stroke-dasharray="2,1"' : ''}/>`;
    const cx = pl.bbox.minX + pl.bbox.w / 2, cy = pl.bbox.minY + pl.bbox.h / 2;
    const tag = pl.isAccessory ? (pl.accessoryType === 'visor' ? '바이저' : 'SLAAP') : (pl.slotKey.indexOf('abdomen') === 0 ? '복부' : (pl.slotKey.indexOf('chest') === 0 ? '가슴' : ''));
    if (view === 'durability' && slot) {
      if (geom.plates.length > 1 && tag) h += `<text x="${cx}" y="${(cy - 2.2).toFixed(1)}" fill="#cdd6de" font-size="3.4" text-anchor="middle">${tag}</text>`;
      h += `<text x="${cx}" y="${(cy + 2.0).toFixed(1)}" fill="#eef3f7" font-size="4.6" text-anchor="middle" font-weight="bold">${slot.current.toFixed(0)}/${slot.max}</text>`;
    } else if (geom.plates.length > 1 && tag) {
      h += `<text x="${cx}" y="${(pl.bbox.minY + (pl.isAccessory && pl.accessoryType === 'visor' ? pl.bbox.h * 0.5 : 4)).toFixed(1)}" fill="${pl.isAccessory ? '#dfeaf0' : '#aab8c4'}" font-size="3.6" text-anchor="middle">${tag}</text>`;
    }
  }
  // 국부손상 heatmap
  if (view === 'local') {
    if (ARMOR_ANALYSIS.hitMarkers.length === 0) {
      h += `<text x="50" y="${geom.bbox.minY + geom.bbox.h / 2}" fill="#5a6a75" font-size="4" text-anchor="middle">국부 손상 없음 — 사격 필요</text>`;
    } else {
      const seeds = buildArmorAnalysisSeeds(geom);
      const bb = fieldBb; const cell = 3.2; let cells = '';
      let count = 0; const maxCells = 800;
      for (let yy = bb.minY; yy < bb.minY + bb.h && count < maxCells; yy += cell) {
        for (let xx = bb.minX; xx < bb.minX + bb.w && count < maxCells; xx += cell) {
          const cxp = xx + cell / 2, cyp = yy + cell / 2;
          const val = aaFieldValueAt(cxp, cyp, seeds);
          const col = aarDamageFieldColor(val);
          if (!col) continue;
          cells += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${cell}" height="${cell}" fill="${col}"/>`;
          count++;
        }
      }
      h += `<g clip-path="url(#${clipId})">${cells}</g>`;
      if (geom.hasSoft && geom.softPts) h += `<polygon points="${geom.softPts}" fill="none" stroke="#4a7a58" stroke-width="0.5" stroke-dasharray="2.5,1.5"/>`;
      for (const pl of geom.plates) h += `<polygon points="${pl.ptsStr}" fill="none" stroke="#7a98b5" stroke-width="0.7"/>`;
    }
  }
  // 피격 마커
  for (const m of ARMOR_ANALYSIS.hitMarkers) {
    const sel = (m.id === ARMOR_ANALYSIS.selMarkerId);
    const col = ({ stopped:'#5fd97a', partial_or_backer_stopped:'#ffd479', penetrated:'#ff6060', ricochet:'#9aa0a8' })[m.resultKind] || '#cccccc';
    if (m.resultKind === 'penetrated') {
      h += `<g stroke="${col}" stroke-width="${sel ? 1.4 : 1.0}"><line x1="${m.x - 2}" y1="${m.y - 2}" x2="${m.x + 2}" y2="${m.y + 2}"/><line x1="${m.x + 2}" y1="${m.y - 2}" x2="${m.x - 2}" y2="${m.y + 2}"/></g>`;
    } else {
      h += `<circle cx="${m.x}" cy="${m.y}" r="${sel ? 2.4 : 1.8}" fill="${col}" fill-opacity="0.85" stroke="${sel ? '#fff' : 'none'}" stroke-width="0.5"/>`;
    }
    if (sel) h += `<circle cx="${m.x}" cy="${m.y}" r="3.6" fill="none" stroke="#ffe066" stroke-width="0.6"/>`;
  }
  // 조준 마커 (selectedPoint)
  const sp = ARMOR_ANALYSIS.selectedPoint;
  if (sp && ARMOR_ANALYSIS.aimMode) {
    h += `<g stroke="#ffe066" stroke-width="0.7"><circle cx="${sp.x}" cy="${sp.y}" r="3" fill="none"/><line x1="${sp.x - 4}" y1="${sp.y}" x2="${sp.x + 4}" y2="${sp.y}"/><line x1="${sp.x}" y1="${sp.y - 4}" x2="${sp.x}" y2="${sp.y + 4}"/></g>`;
  }
  svg.innerHTML = h;
  // 스테이지 info
  const si = document.getElementById('aaStageInfo');
  if (si) {
    if (view === 'durability' && mainSlot) {
      let extra = '';
      for (const k in td) { const s = td[k]; const lm = Math.max(...Object.values(s.localZones)); extra += `${k} ${s.current.toFixed(1)}/${s.max}` + (lm > 0 ? ` · local max ${lm.toFixed(0)}` : '') + '　'; }
      si.innerHTML = extra;
    } else if (sp) {
      const kindKo = sp.panelKind === 'soft' ? ' · 소프트 백커' : '';
      si.innerHTML = `선택: <b>${AA_ZONE_LABELS[sp.localZone] || sp.localZone}</b> (${sp.slotKey})${kindKo}` + (ARMOR_ANALYSIS.aimMode ? ' · 사격 대기' : '');
    } else {
      si.innerHTML = ARMOR_ANALYSIS.aimMode ? '패널을 클릭해 피격점을 지정하세요.' : '“피격점 지정 모드”를 켜고 패널을 클릭하세요.';
    }
  }
  // legend
  const lg = document.getElementById('aaDamageLegend');
  if (lg) {
    if (view === 'local') lg.innerHTML = '<span class="aa-legend-item"><span class="aa-legend-color" style="background:#5fd97a"></span>경미</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#ffd479"></span>중간</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#ff9a3a"></span>높음</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#ff4040"></span>매우 높음</span>';
    else if (view === 'durability') lg.innerHTML = '<span class="aa-legend-item"><span class="aa-legend-color" style="background:#3a7a8a"></span>80~100%</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#c8b038"></span>50~80%</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#c87838"></span>25~50%</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#a33030"></span>0~25%</span>';
    else lg.innerHTML = '<span class="aa-legend-item"><span class="aa-legend-color" style="background:#5fd97a;width:8px;height:8px;border-radius:4px"></span>막힘</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#ffd479;width:8px;height:8px;border-radius:4px"></span>부분</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#ff6060;width:8px;height:8px;border-radius:4px"></span>관통</span><span class="aa-legend-item"><span class="aa-legend-color" style="background:#9aa0a8;width:8px;height:8px;border-radius:4px"></span>도탄</span>';
  }
}
// SVG 클릭 → 피격점
function handleArmorAnalysisStageClick(evt) {
  const svg = document.getElementById('aaStageSvg');
  const info = ARMOR_ANALYSIS.slotInfo;
  if (!svg || !info) return;
  if (!ARMOR_ANALYSIS.aimMode) { ARMOR_ANALYSIS.aimMode = true; }   // 클릭하면 자동으로 지정 모드 on
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // viewBox는 0 0 100 120, preserveAspectRatio xMidYMid meet → letterbox 보정
  const vbW = AA_STAGE_VB.w, vbH = AA_STAGE_VB.h;
  const scale = Math.min(rect.width / vbW, rect.height / vbH);
  const offX = (rect.width - vbW * scale) / 2, offY = (rect.height - vbH * scale) / 2;
  const px = (evt.clientX - rect.left - offX) / scale;
  const py = (evt.clientY - rect.top - offY) / scale;
  const geom = aaStageGeom(info, ARMOR_ANALYSIS.aspect);
  let hitPlate = null;
  for (const pl of geom.plates) { if (aaPointInPoly(px, py, aaParsePts(pl.ptsStr))) { hitPlate = pl; break; } }
  const inSoft = (geom.hasSoft && geom.softPts) ? aaPointInPoly(px, py, aaParsePts(geom.softPts)) : false;
  if (!hitPlate && !inSoft) {
    ARMOR_ANALYSIS.selectedPoint = null;
    const si = document.getElementById('aaStageInfo'); if (si) si.innerHTML = '<span style="color:#9aa0a8">비방호 영역 — 내구도 손상 없음</span>';
    renderArmorAnalysisStage();
    return;
  }
  let material = info.material, baseArmor = info.baseArmor, slotKey = info.slotKey, zoneMaterialHint = null, panelKind = 'hard', zone;
  if (!hitPlate && inSoft && info.softBacker) {
    // 소프트 백커 영역 (플레이트 밖, 캐리어 안)
    const sb = info.softBacker;
    const sbb = _bboxOfPoints(geom.softPts);
    const nX = Math.max(0, Math.min(1, (px - sbb.minX) / sbb.w));
    const nY = Math.max(0, Math.min(1, (py - sbb.minY) / sbb.h));
    zone = resolveAnalysisLocalZoneFromPoint(nX, nY, 'soft', null).zone;
    material = sb.material; baseArmor = sb.baseArmor; slotKey = sb.slotKey; panelKind = 'soft';
  } else if (hitPlate) {
    // 클릭된 플레이트 (frontSet면 가슴/복부 중 하나, 헬멧이면 두개부/바이저/SLAAP 중 하나)
    const bb = hitPlate.bbox;
    const normX = Math.max(0, Math.min(1, (px - bb.minX) / bb.w));
    const normY = Math.max(0, Math.min(1, (py - bb.minY) / bb.h));
    // SIDE-HELMET-ACCESSORY-ANALYSIS: 부속품 plate면 plate 자체 데이터 사용 (헬멧 쉘 값 아님)
    const _vht = hitPlate.isAccessory ? hitPlate.visorHitTable : info.visorHitTable;
    const zr = resolveAnalysisLocalZoneFromPoint(normX, normY, geom.kind, _vht);
    zone = zr.zone; slotKey = hitPlate.slotKey; panelKind = hitPlate.isAccessory ? hitPlate.accessoryType : geom.kind;
    if (hitPlate.isAccessory) { material = hitPlate.material; baseArmor = hitPlate.baseArmor; zoneMaterialHint = hitPlate.durabilityMaterial; }
    if (_vht) {
      const wantId = (zr.zone === 'glass') ? 'glass' : 'titanium';
      const z = _vht.find(zz => zz.id === wantId) || _vht[0];
      if (z) { material = z.material; baseArmor = z.armorValue; zoneMaterialHint = z.material; }
    }
  } else {
    ARMOR_ANALYSIS.selectedPoint = null;
    const si = document.getElementById('aaStageInfo'); if (si) si.innerHTML = '<span style="color:#9aa0a8">비방호 영역 — 내구도 손상 없음</span>';
    renderArmorAnalysisStage();
    return;
  }
  ARMOR_ANALYSIS.selectedPoint = { x: +px.toFixed(1), y: +py.toFixed(1),
    slotKey, localZone: zone, material, baseArmor, zoneMaterialHint, panelKind, aspect: ARMOR_ANALYSIS.aspect };
  renderArmorAnalysis();
}
// 피격 로그 렌더
function renderArmorAnalysisHitLog() {
  const el = document.getElementById('aaHitLog');
  if (!el) return;
  if (!ARMOR_ANALYSIS.hitLog.length) { el.innerHTML = ''; return; }
  const verdictKo = { stopped:'막힘', partial_or_backer_stopped:'부분저지', penetrated:'관통', ricochet:'도탄' };
  let h = '';
  for (const lg of ARMOR_ANALYSIS.hitLog) {
    const cls = lg.resultKind === 'penetrated' ? 'penetrated' : lg.resultKind === 'ricochet' ? 'ricochet' : lg.resultKind === 'stopped' ? 'stopped' : 'partial';
    const sel = (lg.id === ARMOR_ANALYSIS.selMarkerId) ? ' sel' : '';
    h += `<div class="aa-log-entry aa-log-${cls}${sel}" data-mid="${lg.id}">`
      + `#${lg.shotNo} ${lg.ammoName} ${lg.distanceM}m ${AA_ZONE_LABELS[lg.localZone] || lg.localZone} <b>${verdictKo[lg.resultKind] || lg.resultKind}</b>`
      + ` · 내구 ${lg.globalBefore}→${lg.globalAfter} (−${lg.globalAmount}) · 국부 +${lg.localAmount}`
      + `</div>`;
  }
  el.innerHTML = h;
}
// 최근 사격 상세 HTML (결과 패널 상단)
function aaLastResultHtml() {
  const lg = ARMOR_ANALYSIS.lastResult;
  if (!lg) return '';
  if (lg.resultKind === 'unprotected') return `<div class="aa-info-row"><span>최근 사격</span><b style="color:#9aa0a8">비방호 영역 (손상 없음)</b></div><div style="border-bottom:1px solid #1f2a32;margin:4px 0;"></div>`;
  const verdictKo = { stopped:'막힘', partial_or_backer_stopped:'부분저지', penetrated:'관통', ricochet:'도탄' };
  const vc = lg.resultKind === 'penetrated' ? '#ff6060' : lg.resultKind === 'ricochet' ? '#9aa0a8' : lg.resultKind === 'stopped' ? '#5fd97a' : '#ffd479';
  const modeKo = (typeof getArmorDamageModeLabelKo === 'function') ? getArmorDamageModeLabelKo(lg.damageMode) : lg.damageMode;
  const bh = lg.bodyHint || { label:'-', hints:[] };
  let nb = '';
  if (lg.neighborSplash > 0) nb = `<div class="aa-info-row"><span>주변 균열</span><b>+${lg.neighborSplash}</b></div>`;
  let extra = '';
  if (lg.spallRisk > 0) extra += `스폴 ${lg.spallRisk.toFixed(0)} `;
  if (lg.coatingDamage > 0) extra += `코팅 ${lg.coatingDamage.toFixed(0)} `;
  if (lg.visibilityDamage > 0) extra += `시야 ${lg.visibilityDamage.toFixed(0)} `;
  if (lg.backfaceDamage > 0) extra += `백페이스 ${lg.backfaceDamage.toFixed(0)} `;
  const hintPills = bh.hints.map(x => `<span class="aa-hint-pill">${x}</span>`).join('');
  return `<div style="margin-bottom:4px;">
    <div class="aa-info-row"><span>최근 결과</span><b style="color:${vc}">${verdictKo[lg.resultKind] || lg.resultKind}</b></div>
    <div class="aa-info-row"><span>탄종 / 거리</span><b>${lg.ammoName} / ${lg.distanceM}m</b></div>
    <div class="aa-info-row"><span>충돌</span><b>${lg.impactVel}m/s · ${lg.impactEnergyJ != null ? lg.impactEnergyJ + 'J' : '-'}${lg.impactMomentumNs != null ? ' · ' + lg.impactMomentumNs + 'Ns' : ''}</b></div>
    <div class="aa-info-row"><span>유효 관통 / 방호</span><b>${lg.effectivePen} / ${lg.effectiveArmor}</b></div>
    <div class="aa-info-row"><span>관통 확률</span><b style="color:${lg.penProb >= 0.5 ? '#ff9a3a' : '#80d090'}">${Math.round(lg.penProb * 100)}%</b></div>
    <div class="aa-info-row"><span>피격 부위</span><b>${AA_ZONE_LABELS[lg.localZone] || lg.localZone}</b></div>
    <div class="aa-info-row"><span>전체 내구도</span><b>${lg.globalBefore} → ${lg.globalAfter} (−${lg.globalAmount})</b></div>
    <div class="aa-info-row"><span>국부 손상</span><b style="color:#ffd479">${AA_ZONE_LABELS[lg.localZone] || lg.localZone} +${lg.localAmount} (→${lg.localAfter})</b></div>
    ${nb}
    <div class="aa-info-row"><span>손상 모드</span><b>${modeKo || '-'}</b></div>
    ${extra ? `<div class="aa-info-row"><span>표면/후면</span><b style="font-size:9px;">${extra}</b></div>` : ''}
    <div class="aa-info-row"><span>예상 인체 피해</span><b style="color:${bh.severity === 'critical' ? '#ff6060' : bh.severity === 'high' ? '#ff9a3a' : bh.severity === 'medium' ? '#ffd479' : '#80d090'}">${bh.label}</b></div>
    <div style="margin-top:2px;">${hintPills}</div>
  </div>
  <div style="border-bottom:1px solid #1f2a32;margin:4px 0;"></div>`;
}
// 동적 부분 갱신 (kinetic info / 버튼 상태 / stage / hitlog)
function renderArmorAnalysisDynamic() {
  // 좌측 탭 전환 (얇은 2-탭)
  document.querySelectorAll('.aa-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === ARMOR_ANALYSIS.tab));
  document.querySelectorAll('.aa-tab-pane').forEach(p => { if (p.dataset.pane === ARMOR_ANALYSIS.tab) p.removeAttribute('hidden'); else p.setAttribute('hidden', ''); });
  // 거리 슬라이더/값
  const ds = document.getElementById('aaDistanceSlider'); if (ds) ds.value = ARMOR_ANALYSIS.distanceM;
  const dv = document.getElementById('aaDistanceVal'); if (dv) dv.textContent = ARMOR_ANALYSIS.distanceM + 'm';
  document.querySelectorAll('.aa-quick').forEach(b => b.classList.toggle('on', +b.dataset.dist === ARMOR_ANALYSIS.distanceM));
  document.querySelectorAll('.aa-aspect-btn').forEach(b => b.classList.toggle('on', b.dataset.aspect === ARMOR_ANALYSIS.aspect));
  document.querySelectorAll('.aa-view-btn').forEach(b => b.classList.toggle('on', b.dataset.view === ARMOR_ANALYSIS.viewMode));
  const am = document.getElementById('aaAimModeBtn'); if (am) { am.classList.toggle('on', ARMOR_ANALYSIS.aimMode); am.textContent = ARMOR_ANALYSIS.aimMode ? '🎯 피격점 지정 모드 (ON)' : '🎯 피격점 지정 모드'; }
  // kinetic info
  const ki = document.getElementById('aaKineticInfo');
  if (ki) {
    const ammo = AMMO_PRESETS[ARMOR_ANALYSIS.ammoId];
    if (ammo) {
      const kk = aaGetKinetics(ammo, ARMOR_ANALYSIS.distanceM);
      const mat = ARMOR_ANALYSIS.slotInfo ? ARMOR_ANALYSIS.slotInfo.material : null;
      const matPen = (mat && ammo.materialPenPenalty && ammo.materialPenPenalty[mat]) || 0;
      const effPen = Math.max(0, ((ammo.penetration || 0) - matPen) * kk.velMul);
      const sevRaw = (typeof getAmmoLocalSeverity === 'function') ? getAmmoLocalSeverity(getArmorThreatClass(ammo)) : 1;
      ki.innerHTML = `<div class="aa-info-row"><span>충돌 속도</span><b>${Math.round(kk.impactVel)} m/s</b></div>`
        + `<div class="aa-info-row"><span>충돌 에너지</span><b>${kk.kin.impactEnergyJ != null ? Math.round(kk.kin.impactEnergyJ) + ' J' : '-'}</b></div>`
        + `<div class="aa-info-row"><span>운동량</span><b>${kk.kin.impactMomentumNs != null ? kk.kin.impactMomentumNs + ' Ns' : '-'}</b></div>`
        + `<div class="aa-info-row"><span>유효 관통(거리)</span><b style="color:#ffd479">${effPen.toFixed(1)}</b></div>`
        + `<div class="aa-info-row"><span>국부 위력 배율</span><b>×${sevRaw.toFixed(2)}</b></div>`;
    }
  }
  renderArmorAnalysisStage();
  renderArmorAnalysisHitLog();
}

// === 2A-2: 방호범위 상세 — transformedCoverage + impactAddress 주소 연결 ===
function _covTempUnit() {
  const ld = getScopedLoadout(covCurrentSide) || {};
  return { id:-1, stance:'standing',
    bodyArmorId:ld.bodyArmorId, frontPlateId:ld.frontPlateId, backPlateId:ld.backPlateId, sidePlateId:ld.sidePlateId,
    helmetId:ld.helmetId, slaapId:ld.slaapId, visorId:ld.visorId,
    groinGuardId:ld.groinGuardId, shoulderGuardId:ld.shoulderGuardId, neckGuardId:ld.neckGuardId };
}
// shape.slot → {location, aspect}
function _slotToLocAspect(slot) {
  if (!slot) return null;
  if (slot === 'chest_front')   return { location:'chest', aspect:'front' };
  if (slot === 'chest_side')    return { location:'chest', aspect:'side' };
  if (slot === 'chest_rear')    return { location:'chest', aspect:'rear' };
  if (slot === 'abdomen_front') return { location:'abdomen', aspect:'front' };
  if (slot === 'abdomen_side')  return { location:'abdomen', aspect:'side' };
  if (slot === 'abdomen_rear')  return { location:'abdomen', aspect:'rear' };
  if (slot === 'neck')          return { location:'neck', aspect:'front' };
  return null;
}
// plateShape별 주요 gap 후보 (transform bias가 큰 것)
function _majorGapsForShape(plateShape, hitPart) {
  const tf = (typeof PLATE_SHAPE_TRANSFORMS !== 'undefined' && PLATE_SHAPE_TRANSFORMS[plateShape]) || null;
  if (!tf) return [];
  const gaps = [];
  if (hitPart === 'chest') {
    if ((tf.upperLateralGapBias||1) > 1.1) gaps.push('upperLateralGap');
    if ((tf.axillaGapBias||1) > 1.1) gaps.push('axillaGap');
    if ((tf.lowerGapBias||1) > 1.1) gaps.push('lowerGap');
  } else if (hitPart === 'abdomen') {
    if ((tf.lowerGapBias||1) > 1.1) gaps.push('lowerAbdomenExposed');
    if ((tf.flankGapBias||1) > 1.05) gaps.push('flankGap');
    if ((tf.groinGapBias||1) > 1.05) gaps.push('pelvisGroinAdjacent');
  }
  return gaps;
}
// covDetail에 붙일 transformedCoverage + 주소 정보 HTML
function buildCoverageAddressInfoHtml(shape, kind) {
  const la = _slotToLocAspect(shape && shape.slot);
  if (!la) return '';
  const unit = _covTempUnit();
  // protType: hard panel=hard, soft=soft, extra=soft
  let protType = (kind === 'armor-hard') ? 'hard' : (kind === 'armor-soft') ? 'soft' : 'soft';
  // 해당 부위에 실제 plate 없으면 soft/none로 다운그레이드 (시각화 일관)
  let ia = null;
  try {
    ia = buildImpactAddress(unit, { location: la.location, aspect: la.aspect },
      { protectionType: protType, material: protType==='hard'?'ceramic':'aramid', isHelmet:false },
      { location: la.location, aspect: la.aspect, armorResult:'stopped', penetrated:false, sourceType:'bullet' });
  } catch (e) { return ''; }
  if (!ia) return '';
  const bc = ia.baseCoverage, tc = ia.transformedCoverage;
  const pct = (v) => (v != null) ? Math.round(v*100) : '–';
  let html = `<div class="cov-detail-sep"></div>
    <div class="cov-detail-row"><span class="cov-detail-key">선택 부위</span><span class="cov-detail-val">${_lbl(IA_LABELS.hitPart, ia.hitPart)} ${_lbl(IA_LABELS.impactSide, ia.impactSide)}</span></div>`;
  if (ia.plateShape) html += `<div class="cov-detail-row"><span class="cov-detail-key">Plate Shape</span><span class="cov-detail-val">${ia.plateShape}</span></div>`;
  if (bc) html += `<div class="cov-detail-row"><span class="cov-detail-key">Base (H/S/G)</span><span class="cov-detail-val">${pct(bc.hardP)} / ${pct(bc.softP)} / ${pct(bc.noneP)}</span></div>`;
  if (tc) {
    html += `<div class="cov-detail-row"><span class="cov-detail-key">Transformed (H/S/G)</span><span class="cov-detail-val">${pct(tc.hardP)} / ${pct(tc.softP)} / ${pct(tc.noneP)}</span></div>`;
    // plateCore / plateEdge breakdown (hard 중)
    if (protType === 'hard') {
      const tf = tc._shapeTransform || {};
      const edgeProb = Math.min(0.5, 0.22 * (tf.edgeBias != null ? tf.edgeBias : 1.0));
      html += `<div class="cov-detail-row"><span class="cov-detail-key">Plate</span><span class="cov-detail-val">Core ${Math.round((1-edgeProb)*100)} / Edge ${Math.round(edgeProb*100)}</span></div>`;
    }
  } else {
    html += `<div class="cov-detail-row"><span class="cov-detail-key">Transformed</span><span class="cov-detail-val">정보 없음</span></div>`;
  }
  // 주요 gap
  const gaps = _majorGapsForShape(ia.plateShape, ia.hitPart);
  if (gaps.length) {
    html += `<div class="cov-detail-row"><span class="cov-detail-key">주요 Gap</span><span class="cov-detail-val">${gaps.map(getExposedLocationLabel).join(', ')}</span></div>`;
  }
  // impactAddress 주소 연결
  // 2A-3: plateLocation / visualRole
  if (ia.plateLocation) {
    const plLocKor = { chestPlate:'가슴 플레이트', abdomenPlate:'복부 플레이트', backPlate:'후면 플레이트', sidePlate:'측면판' }[ia.plateLocation] || ia.plateLocation;
    const visualRole = { chestPlate:'frontChestPlate', abdomenPlate:'abdomenSmallPlate', backPlate:'rearBackPlate', sidePlate:'sideRibPlate' }[ia.plateLocation] || '';
    html += `<div class="cov-detail-row"><span class="cov-detail-key">plateLocation</span><span class="cov-detail-val">${plLocKor}${visualRole ? ' ('+visualRole+')' : ''}</span></div>`;
  }
  html += `<div class="cov-detail-row"><span class="cov-detail-key">주소(coverageZone)</span><span class="cov-detail-val">${getCoverageZoneLabel(ia.coverageZone)}</span></div>`;
  if (ia.anatomicalZone) html += `<div class="cov-detail-row"><span class="cov-detail-key">해부학적 부위</span><span class="cov-detail-val">${getAnatomicalZoneLabel(ia.anatomicalZone)}</span></div>`;
  const organs = getOrganListLabel(ia.organCandidates);
  if (organs) html += `<div class="cov-detail-row"><span class="cov-detail-key">장기 후보</span><span class="cov-detail-val">${organs}</span></div>`;
  const structs = getStructureListLabel(ia.structureCandidates);
  if (structs) html += `<div class="cov-detail-row"><span class="cov-detail-key">구조물 후보</span><span class="cov-detail-val">${structs}</span></div>`;
  // junction 분류
  if (ia.junctionClass && ia.junctionClass !== 'none') {
    html += `<div class="cov-detail-row"><span class="cov-detail-key">접합 분류</span><span class="cov-detail-val">${getJunctionClassLabel(ia.junctionClass)}</span></div>`;
  }
  // accessory 보완 여부
  const accNotes = [];
  if (unit.groinGuardId && unit.groinGuardId !== 'no_groin_guard' && ia.hitPart === 'abdomen') accNotes.push('서혜부 보호대: 하복부/골반 일부 보완');
  if (unit.shoulderGuardId && unit.shoulderGuardId !== 'no_shoulder_guard' && ia.hitPart === 'chest') accNotes.push('어깨 보호대: 겨드랑이 인접 일부 보완');
  if (unit.neckGuardId && unit.neckGuardId !== 'no_neck_guard' && (ia.hitPart === 'neck' || ia.hitPart === 'chest')) accNotes.push('목 보호대: 하경부/목 인접 일부 보완');
  if (accNotes.length) html += `<div class="cov-detail-row"><span class="cov-detail-key">추가 보호대</span><span class="cov-detail-val">${accNotes.join('<br>')}</span></div>`;
  return html;
}

function renderCovPanelDetail(shape, kind, armor, helmet) {
  const el = document.getElementById('covDetail');
  if (!el) return;
  // 선택된 unit (있으면) — 내구도 표시용
  const sel = GAME.selectedId ? (UNITS.find(u => u.id === GAME.selectedId)) : null;
  const showDurability = sel && sel.team === covCurrentSide && sel.armorDurability;

  function durabilityRowHtml(slotKey) {
    if (!showDurability || !slotKey) return '';
    const d = sel.armorDurability[slotKey];
    if (!d) return '';
    const pct = Math.round((d.current / d.max) * 100);
    const color = pct >= 75 ? '#80d090' : pct >= 50 ? '#ffd479' : pct >= 25 ? '#ff9a3a' : '#ff6060';
    return `<div class="cov-detail-row"><span class="cov-detail-key">내구도</span><span class="cov-detail-val" style="color:${color}">${d.current}/${d.max} (${pct}%)</span></div>`;
  }

  // armor-hard일 때 — 현재 aspect의 플레이트 정보 우선 표시
  if (kind === 'armor-hard') {
    const ld = getScopedLoadout(covCurrentSide) || {};
    let plateId = null;
    let durKey = null;
    if (shape._sidePlate)                  { plateId = ld.sidePlateId; durKey = 'left_side_hard'; }   // 2A-3: 정면 옆구리 패널
    else if (covCurrentAspect === 'front') { plateId = ld.frontPlateId; durKey = (shape.slot === 'abdomen_front') ? 'abdomen_front_hard' : 'chest_front_hard'; }
    else if (covCurrentAspect === 'rear')  { plateId = ld.backPlateId;  durKey = 'chest_rear_hard'; }
    else if (covCurrentAspect === 'side')  { plateId = ld.sidePlateId;  durKey = 'left_side_hard'; }   // 좌측 표시 (좌/우 같은 plate, 통합 슬롯)
    const plate = plateId ? PLATE_PRESETS[plateId] : null;
    if (plate && !plate.isNone) {
      const matLabel = plate.material ? getMaterialDisplay(plate.material) : '–';
      const bckLabel = plate.backingMaterial ? getMaterialDisplay(plate.backingMaterial) : '–';
      const cls = (typeof armorValueToClass === 'function') ? ('Class ' + armorValueToClass(plate.hardArmor)) : '';
      // 좌/우 분리 내구도 — side 슬롯이면 left_side_hard / right_side_hard 둘 다 표시
      let durabilityHtml = '';
      if (covCurrentAspect === 'side' && showDurability) {
        const dL = sel.armorDurability.left_side_hard;
        const dR = sel.armorDurability.right_side_hard;
        if (dL || dR) {
          const fmt = (d) => {
            if (!d) return '—';
            const p = Math.round(d.current/d.max*100);
            const c = p >= 75 ? '#80d090' : p >= 50 ? '#ffd479' : p >= 25 ? '#ff9a3a' : '#ff6060';
            return `<span style="color:${c}">${d.current}/${d.max} (${p}%)</span>`;
          };
          durabilityHtml = `<div class="cov-detail-row"><span class="cov-detail-key">Left Side Plate</span><span class="cov-detail-val">${fmt(dL)}</span></div>
                            <div class="cov-detail-row"><span class="cov-detail-key">Right Side Plate</span><span class="cov-detail-val">${fmt(dR)}</span></div>`;
        }
      } else {
        durabilityHtml = durabilityRowHtml(durKey);
      }
      el.innerHTML = `
        <div class="cov-detail-title">${shape.label}</div>
        <div class="cov-detail-row"><span class="cov-detail-key">플레이트</span><span class="cov-detail-val">${plate.name}</span></div>
        <div class="cov-detail-row"><span class="cov-detail-key">계열</span><span class="cov-detail-val">${plate.factionType || '—'} / ${plate.slotType || '—'}</span></div>
        <div class="cov-detail-row"><span class="cov-detail-key">방호값</span><span class="cov-detail-val">hard ${plate.hardArmor} ${cls ? '('+cls+')' : ''} · soft backer ${plate.backingArmor || 0}</span></div>
        <div class="cov-detail-row"><span class="cov-detail-key">재질</span><span class="cov-detail-val">${matLabel} · backer ${bckLabel}</span></div>
        <div class="cov-detail-row"><span class="cov-detail-key">최대 내구도</span><span class="cov-detail-val">${plate.maxDurability || '—'}</span></div>
        ${durabilityHtml}
        <div class="cov-detail-row"><span class="cov-detail-key">무게</span><span class="cov-detail-val">${(plate.weightKg||0).toFixed(2)}kg</span></div>
        <div class="cov-detail-row"><span class="cov-detail-key">설명</span><span class="cov-detail-val">${plate.desc || '—'}</span></div>
        ${buildCoverageAddressInfoHtml(shape, kind)}
      `;
      return;
    }
  }

  // helmet shell — 내구도 표시
  if (kind === 'helmet-shell' && helmet) {
    const matLabel = (helmet.head_skull && helmet.head_skull.hard) ? getMaterialDisplay(helmet.head_skull.hard.material) : '–';
    const skullVal = helmet.head_skull && helmet.head_skull.hard ? helmet.head_skull.hard.smallArmor : 0;
    const tempVal = helmet.head_temporal && helmet.head_temporal.hard ? helmet.head_temporal.hard.smallArmor : 0;
    let durSkullHtml = durabilityRowHtml('head_skull_shell');
    let durTempHtml  = durabilityRowHtml('head_temporal_shell');
    el.innerHTML = `
      <div class="cov-detail-title">${shape.label}</div>
      <div class="cov-detail-row"><span class="cov-detail-key">헬멧</span><span class="cov-detail-val">${helmet.name}</span></div>
      <div class="cov-detail-row"><span class="cov-detail-key">방호값</span><span class="cov-detail-val">두개부 ${skullVal} · 측두부 ${tempVal}</span></div>
      <div class="cov-detail-row"><span class="cov-detail-key">재질</span><span class="cov-detail-val">${matLabel}</span></div>
      <div class="cov-detail-row"><span class="cov-detail-key">최대 내구도</span><span class="cov-detail-val">${helmet.maxDurability || '—'}</span></div>
      ${durSkullHtml ? '<div class="cov-detail-row"><span class="cov-detail-key">두개부 내구도</span></div>' + durSkullHtml.replace('내구도','&nbsp;&nbsp;') : ''}
      ${durTempHtml  ? '<div class="cov-detail-row"><span class="cov-detail-key">측두부 내구도</span></div>' + durTempHtml.replace('내구도','&nbsp;&nbsp;') : ''}
      <div class="cov-detail-row"><span class="cov-detail-key">무게</span><span class="cov-detail-val">${(helmet.weightKg||0).toFixed(2)}kg</span></div>
      <div class="cov-detail-row"><span class="cov-detail-key">설명</span><span class="cov-detail-val">${helmet.desc || '—'}</span></div>
    `;
    return;
  }

  // 일반 케이스 — 방탄복 캐리어/소프트 또는 헬멧
  let equip = null, slot = null, typeLabel = '';
  if (kind.startsWith('armor')) {
    equip = armor;
    if (!equip) { renderCovPanelEmpty(); return; }
    slot = equip.coverage && equip.coverage[shape.slot];
    if (kind === 'armor-hard')       typeLabel = '하드 플레이트';
    else if (kind === 'armor-soft')  typeLabel = '캐리어/소프트 아머';
    else                              typeLabel = '보조 패드';
  } else if (kind === 'helmet-shell') {
    equip = helmet;
    if (!equip) { renderCovPanelEmpty(); return; }
    slot = equip[shape.slot];
    typeLabel = '헬멧 쉘';
  }
  if (!slot) { renderCovPanelEmpty(); return; }

  let mat = '';
  if (kind === 'armor-hard')          mat = slot.hard && slot.hard.material ? getMaterialDisplay(slot.hard.material) : '';
  else if (kind === 'armor-soft')     mat = slot.soft && slot.soft.material ? getMaterialDisplay(slot.soft.material) : '';
  else if (kind === 'armor-extra')    mat = slot.soft && slot.soft.material ? getMaterialDisplay(slot.soft.material) : '';
  else if (kind === 'helmet-shell')   mat = slot.hard && slot.hard.material ? getMaterialDisplay(slot.hard.material) : '';

  const hardP = slot.hardP != null ? (slot.hardP * 100).toFixed(0) + '%' : '–';
  const softP = slot.softP != null ? (slot.softP * 100).toFixed(0) + '%' : '–';
  const noneP = slot.noneP != null ? (slot.noneP * 100).toFixed(0) + '%' : '–';
  const hardA = slot.hard && slot.hard.smallArmor ? slot.hard.smallArmor : 0;
  const softA = slot.soft && slot.soft.smallArmor ? slot.soft.smallArmor : 0;
  const wKg   = equip.weightKg != null ? equip.weightKg.toFixed(2) + 'kg' : '–';

  el.innerHTML = `
    <div class="cov-detail-title">${shape.label}</div>
    <div class="cov-detail-row"><span class="cov-detail-key">유형</span><span class="cov-detail-val">${typeLabel}</span></div>
    <div class="cov-detail-row"><span class="cov-detail-key">슬롯</span><span class="cov-detail-val">${shape.slot}</span></div>
    <div class="cov-detail-row"><span class="cov-detail-key">방호 확률</span><span class="cov-detail-val">하드 ${hardP} · 소프트 ${softP} · 비방호 ${noneP}</span></div>
    <div class="cov-detail-row"><span class="cov-detail-key">방호값</span><span class="cov-detail-val">hard ${hardA} / soft ${softA}</span></div>
    ${mat ? `<div class="cov-detail-row"><span class="cov-detail-key">재질</span><span class="cov-detail-val">${mat}</span></div>` : ''}
    <div class="cov-detail-row"><span class="cov-detail-key">장비 중량</span><span class="cov-detail-val">${wKg}</span></div>
    ${kind.startsWith('armor') ? buildCoverageAddressInfoHtml(shape, kind) : ''}
  `;
}

// 버튼 이벤트
document.querySelectorAll('.cov-side-btn').forEach(b => {
  b.addEventListener('click', () => {
    covCurrentSide = b.dataset.side;
    covSelectedPanelId = null;
    renderCoverageTab();
  });
});
document.querySelectorAll('.cov-aspect-btn').forEach(b => {
  b.addEventListener('click', () => {
    covCurrentAspect = b.dataset.aspect;
    covSelectedPanelId = null;
    renderCoverageTab();
  });
});

// 플레이트 cycler — 현재 선택된 side(아군/적군)의 loadout 갱신
document.querySelectorAll('.cov-plate-cyc').forEach(b => {
  b.addEventListener('click', () => {
    if (b.disabled) return;
    const dir = b.classList.contains('cov-plate-next') ? 1 : -1;
    const ld = getWritableScopedLoadout(covCurrentSide);   // SIDE-PER-OPERATOR-LOADOUT-1: default면 팀기본, 대원이면 override
    // plate cycler
    if (b.dataset.plateSlot) {
      const slotKey = b.dataset.plateSlot;
      const slotKind = (slotKey === 'frontPlate') ? 'front'
                     : (slotKey === 'backPlate')  ? 'back' : 'side';
      const opts = getCompatiblePlatesForArmor(ld.bodyArmorId, slotKind);
      if (!opts || opts.length === 0) return;
      const ldKey = slotKey + 'Id';
      const cur = ld[ldKey];
      let i = opts.indexOf(cur);
      if (i < 0) i = 0;
      ld[ldKey] = opts[(i + dir + opts.length) % opts.length];
    }
    // accessory cycler
    else if (b.dataset.accSlot) {
      const slotKey = b.dataset.accSlot;   // groinGuard / shoulderGuard / neckGuard / visor / slaap
      const slotKind = (slotKey === 'groinGuard') ? 'groin'
                     : (slotKey === 'shoulderGuard') ? 'shoulder'
                     : (slotKey === 'neckGuard') ? 'neck'
                     : (slotKey === 'visor') ? 'visor' : 'slaap';
      let opts;
      if (slotKind === 'visor' || slotKind === 'slaap') {
        opts = getCompatibleAccessoriesForHelmet(ld.helmetId, slotKind);
      } else {
        opts = getCompatibleAccessoriesForArmor(ld.bodyArmorId, slotKind);
      }
      if (!opts || opts.length === 0) return;
      const ldKey = (slotKey === 'visor' || slotKind === 'slaap') ? (slotKey + 'Id') : (slotKey + 'Id');
      // visor → visorId, slaap → slaapId, groinGuard → groinGuardId 등
      const cur = ld[ldKey];
      let i = opts.indexOf(cur);
      if (i < 0) i = 0;
      ld[ldKey] = opts[(i + dir + opts.length) % opts.length];
    }
    if (UNITS) {
      // SIDE-PER-OPERATOR-LOADOUT-1: scope 인지 동기화 — 팀 기본 변경은 override 없는 유닛만, 대원 변경은 같은 loadoutKey만
      const team = covCurrentSide;
      const scopeKey = getCurrentLoadoutUnitKey(team);
      const mapId = _opCurMapId();
      for (const u of UNITS) {
        if (u.team !== team) continue;
        if (scopeKey === 'default') { if (_operatorOverrideExists(mapId, team, u.loadoutKey)) continue; }
        else { if (u.loadoutKey !== scopeKey) continue; }
        const newLd = resolveOperatorLoadout(mapId, team, u.loadoutKey);
        u.bodyArmorId    = newLd.bodyArmorId;
        u.helmetId       = newLd.helmetId;
        u.frontPlateId   = newLd.frontPlateId;
        u.backPlateId    = newLd.backPlateId;
        u.sidePlateId    = newLd.sidePlateId;
        u.groinGuardId   = newLd.groinGuardId;
        u.shoulderGuardId= newLd.shoulderGuardId;
        u.neckGuardId    = newLd.neckGuardId;
        u.visorId        = newLd.visorId;
        u.slaapId        = newLd.slaapId;
        u._protCacheKey = null;
        rebuildArmorDurability(u);
        if (typeof updateUnitWeight === 'function') updateUnitWeight(u);
        u.loadoutSnapshot = cloneLoadoutForOperator(newLd);
      }
    }
    renderCoverageTab();
  });
});

document.querySelectorAll('.ld-cycler').forEach(el => {
  const team = el.dataset.team, slot = el.dataset.slot;
  if (slot === 'skill') {
    // 숙련도 — 화살표 ‹/›로 cycle
    el.querySelectorAll('.ld-cycler-arrow').forEach(arr => {
      arr.addEventListener('click', (e) => {
        e.stopPropagation();
        const dir = parseInt(arr.dataset.dir, 10) || 1;
        cycleLoadout(team, slot, dir);
      });
    });
  } else {
    // 무기/방탄복/헬멧/탄종 — 카드 전체 클릭 시 선택 오버레이
    el.addEventListener('click', (e) => {
      openLoadoutSelect(team, slot);
    });
  }
});
document.querySelectorAll('.ld-tab').forEach(b => {
  b.addEventListener('click', () => selectTab(b.dataset.tab));
});
// ===== Ammo Info tab =====
//   - 시작 전 정보 표시 전용. 실제 전투 판정에는 영향 없음.
//   - getPenetrationGrade 는 게임의 penetrationProbability()와 일관되게 동작.
// 방호 클래스 표시 — armorValue → 1~7 클래스
//   Class 1: 0~14 / 2: 15~24 / 3: 25~34 / 4: 35~44 / 5: 45~54 / 6: 55~64 / 7: 65~75
//   75 이상도 7로 clamp.
function armorValueToClass(value) {
  // 2A-6.4: 통일 클래스 기준 — 1클=15, 2클=25, 3클=35, 4클=45, 5클=55, 6클=65, 7클=72+
  const v = value || 0;
  if (v <= 20) return 1;
  if (v <= 30) return 2;
  if (v <= 40) return 3;
  if (v <= 50) return 4;
  if (v <= 60) return 5;
  if (v <= 68) return 6;
  return 7;
}
function armorClassLabel(value) { return 'Class ' + armorValueToClass(value); }

// 탄약 정보표 — 각 순수 재질 기준, Class 1~7 대표 장갑값(15/25/35/45/55/65/72).
//   ※ 칸 안의 등급(g0~g6)은 "몇 발 만에 뚫는가" 자동계산. 6=1발이내(연초록), 0=20발+(암적).
//   ※ 플레이트 시스템(주재층+백커)의 총합 방호는 플레이트 쪽 표시값으로 별도 제공.
const AI_CLASS_ARMORS = [15, 25, 35, 45, 55, 65, 72];   // Class 1~7 대표값 (순수 재질 기준)
const AI_MATERIALS = ['fabric', 'aramid', 'pe', 'aluminum', 'steel', 'titanium', 'ceramic', 'composite'];
let aiSelectedMaterial = 'composite';

function getAmmoEffectivePenForMaterial(ammo, material) {
  return effectivePenetration(ammo, null, material);
}
function getClassArmorValue(classIndex) {
  return AI_CLASS_ARMORS[classIndex - 1] || 0;
}
// 관통확률 → 등급 (평균 저지 발수 기반, 0~6 체계)
//   기하분포 기댓값: 평균 저지 발수 = (1-p)/p
//     ≥20  → 0 (암적, 사실상 막힘)
//     13~20 → 1
//     9~13 → 2
//     5~9  → 3
//     3~5  → 4
//     1~3  → 5
//     ≤1발 → 6 (연초록, 1발 이내 관통)
function getPenetrationGrade(p) {
  if (p <= 1/21) return 0;
  if (p <= 1/14) return 1;
  if (p <= 1/10) return 2;
  if (p <= 1/6)  return 3;
  if (p <= 1/4)  return 4;
  if (p <= 1/2)  return 5;
  return 6;
}

// 2A-6.4: 탄약표 등급 — 각 순수 재질의 단일층 관통확률 (탄을 넣으면 자동계산).
//   하드/소프트 구분 없이 순수 재질 vs 탄 유효관통으로 계산.
//   플레이트 시스템의 백커 합산 방호는 플레이트 표시값(총합 유효방호)으로 별도 반영.
function getSystemPenetrationProb(eff, material, classArmor) {
  return penetrationProbability(eff - classArmor);
}

// 2A-6.4: 플레이트 총합 유효방호 — 주방탄재층(hardArmor) + 백커 기여 합산.
//   Stand-Alone: 자체 백커(backingArmor)가 통합 → 기여 0.6
//   ICW: 외부 소프트백커 필요 → 대표 백커(minBackerArmor) 기여 0.5 ("적정 백커 장착 시")
//   soft_insert / training / none: 합산 없음 (hardArmor 그대로 또는 0)
function getPlateTotalEffectiveArmor(plate) {
  if (!plate || plate.isNone) return 0;
  // 2A-6.6: 유효방호 = hardArmor + backingArmor (단순합). UI/등급/정렬/분석 전용.
  //   실제 1차 관통 판정엔 hardArmor만 사용(단순합 직접 사용 금지).
  const strike = plate.hardArmor || 0;
  const back = plate.backingArmor || 0;
  if (strike <= 0 && back <= 0) return 0;
  return strike + back;
}

// 펼친 탄약 ID — null이면 모두 접힘
let aiExpandedAmmoId = null;

function renderAmmoInfoTable() {
  const el = document.getElementById('aiTable');
  if (!el) return;
  const mat = aiSelectedMaterial;

  // 구경별 그룹화 + 그룹 내 관통력 오름차순 정렬
  const CALIBER_ORDER = ['12ga',
    '9x19mm', '9x21mm',
    '4.6x30mm', '5.7x28mm',
    '5.56x45mm', '5.45x39mm', '7.62x39mm', '.300 BLK', '9x39mm', '7.62x51mm', '7.62x54mmR', '.30-06', '6.8x51mm',
    '9.3x64mm', '.338 Lapua', '.338 Norma', '12.7x55mm', '12.7x99mm', '12.7x108mm'];
  const groups = {};
  for (const id in AMMO_PRESETS) {
    const a = AMMO_PRESETS[id];
    if (!a) continue;
    const cal = a.caliber || '기타';
    if (!groups[cal]) groups[cal] = [];
    groups[cal].push(a);
  }
  const orderedCalibers = CALIBER_ORDER.filter(c => groups[c]);
  for (const c in groups) if (!orderedCalibers.includes(c)) orderedCalibers.push(c);
  for (const c of orderedCalibers) {
    groups[c].sort((x, y) => (x.penetration || 0) - (y.penetration || 0));
  }

  // 헤더 — cls 컬럼은 1~7 (방호 Class). 각 칸 안의 등급은 0~6 관통등급.
  let html = '<thead><tr>'
    + '<th class="ai-name">탄종</th>'
    + '<th>관통</th>'
    + '<th>피해</th>'
    + '<th>제압</th>'
    + '<th>반동</th>'
    + '<th>정확도</th>'
    + '<th>탄속</th>'
    + '<th>방호피해</th>';
  for (let i = 1; i <= 7; i++) html += `<th class="ai-cls-h">${i}</th>`;
  html += '</tr></thead><tbody>';

  const headerSpan = 8 + 7;   // 탄종/관통/피해/제압/반동/정확도/탄속/방호피해 + 7 클래스
  const MATS_FOR_DETAIL = ['fabric', 'aramid', 'pe', 'aluminum', 'steel', 'titanium', 'ceramic', 'composite'];

  for (const cal of orderedCalibers) {
    html += `<tr class="ai-group"><td colspan="${headerSpan}">${cal}</td></tr>`;
    if (cal === '12ga') {
      html += `<tr class="ai-group-note"><td colspan="${headerSpan}">※ 산탄 항목의 피해/관통/방호피해는 펠릿 1발 기준 · 명중 펠릿 수에 따라 누적</td></tr>`;
    }
    for (const a of groups[cal]) {
      const eff = getAmmoEffectivePenForMaterial(a, mat);
      const basePen = (a.penetration != null) ? a.penetration : 0;
      let penCell;
      if (eff !== basePen) {
        penCell = `<span class="ai-pen-base">${basePen}</span>`
                + `<span class="ai-pen-arrow">→</span>`
                + `<span class="ai-pen-eff">${eff}</span>`;
      } else {
        penCell = `<span class="ai-pen-eff">${basePen}</span>`;
      }
      const accMul = (a.accuracyMul != null) ? a.accuracyMul : 1.0;
      const accClass = accMul > 1.04 ? 'ai-acc-hi' : (accMul < 0.96 ? 'ai-acc-lo' : '');
      const isExpanded = (aiExpandedAmmoId === a.id);
      html += `<tr class="ai-row${isExpanded ? ' on' : ''}" data-id="${a.id}">`;
      const pelletBadge = (a.pelletCount && a.pelletCount > 1)
        ? ` <span class="ai-pellet-badge">×${a.pelletCount}</span>`
        : '';
      html += `<td class="ai-name">${a.shortName || a.name || a.id}${pelletBadge}</td>`;
      html += `<td class="ai-pen">${penCell}</td>`;
      html += `<td>${a.damage != null ? a.damage : '-'}</td>`;
      html += `<td>${a.suppression != null ? a.suppression : '-'}</td>`;
      html += `<td>${a.recoil != null ? ((a.recoil>=0?'+':'') + a.recoil) : '-'}</td>`;
      html += `<td class="${accClass}">×${accMul.toFixed(2)}</td>`;
      html += `<td class="ai-velocity">${a.velocity != null ? a.velocity + ' m/s' : '-'}</td>`;
      const armorDmg = a.armorDamagePct != null ? a.armorDamagePct : 25;
      const adClass = armorDmg >= 50 ? 'ai-armor-hi' : armorDmg >= 25 ? 'ai-armor-mid' : 'ai-armor-lo';
      html += `<td class="${adClass}">${armorDmg}%</td>`;
      for (let cls = 1; cls <= 7; cls++) {
        const armor = getClassArmorValue(cls);
        const diff = eff - armor;
        const p = getSystemPenetrationProb(eff, mat, armor);
        const g = getPenetrationGrade(p);
        html += `<td class="ai-cls"><span class="ai-grade g${g}" title="Class ${cls} (armor ${armor}) · diff ${diff} · 평균 ${p>0?(p<1?(1/p).toFixed(1):"1"):"∞"}발 · 관통 ${(p*100).toFixed(0)}%">${g}</span></td>`;
      }
      html += '</tr>';

      // 펼친 행 — 좌측엔 설명(6 컬럼), 우측엔 재질별 등급(7 컬럼)
      if (isExpanded) {
        const lore = AMMO_LORE[a.id] || a.desc || '추가 정보 없음.';
        // 의료 프로파일
        const med = getAmmoMedicalProfile(a);
        const bleedLab    = medicalLevelLabel(med.bleedChance,    MED_THRESHOLDS.bleed);
        const fractureLab = medicalLevelLabel(med.fractureChance, MED_THRESHOLDS.fracture);
        const shockLab    = medicalLevelLabel(med.shockChance,    MED_THRESHOLDS.shock);
        const bluntLab    = medicalLevelLabel(med.bluntTraumaMul, MED_THRESHOLDS.blunt);
        const tissueLab   = medicalLevelLabel(med.tissueDamageMul,MED_THRESHOLDS.tissue);
        const woundHtml = `<div class="ai-wound-section">`
          + `<div class="ai-wound-title">상처 효과</div>`
          + `<div class="ai-wound-row">`
          +   `<span class="ai-wound-item"><span class="ai-wound-key">출혈</span><span class="ai-wound-val ${bleedLab.cls}">${bleedLab.label}</span> <span class="ai-wound-num">${med.bleedChance.toFixed(2)} ×${med.bleedSeverityMul.toFixed(2)}</span></span>`
          +   `<span class="ai-wound-item"><span class="ai-wound-key">골절</span><span class="ai-wound-val ${fractureLab.cls}">${fractureLab.label}</span> <span class="ai-wound-num">${med.fractureChance.toFixed(2)} ×${med.fractureSeverityMul.toFixed(2)}</span></span>`
          +   `<span class="ai-wound-item"><span class="ai-wound-key">쇼크</span><span class="ai-wound-val ${shockLab.cls}">${shockLab.label}</span> <span class="ai-wound-num">${med.shockChance.toFixed(2)}</span></span>`
          +   `<span class="ai-wound-item"><span class="ai-wound-key">둔상</span><span class="ai-wound-val ${bluntLab.cls}">${bluntLab.label}</span> <span class="ai-wound-num">×${med.bluntTraumaMul.toFixed(2)}</span></span>`
          +   `<span class="ai-wound-item"><span class="ai-wound-key">조직손상</span><span class="ai-wound-val ${tissueLab.cls}">${tissueLab.label}</span> <span class="ai-wound-num">×${med.tissueDamageMul.toFixed(2)}</span></span>`
          + `</div></div>`;
        html += `<tr class="ai-detail">`;
        html += `<td colspan="6" class="ai-detail-lore-cell">`
              + `<div class="ai-detail-title">${a.name || a.id}</div>`
              + `<div class="ai-lore-text">${lore}</div>`
              + woundHtml
              + `</td>`;
        html += `<td colspan="7" class="ai-detail-mats-cell">`
              + `<div class="ai-mats-grades">`;
        for (const m of MATS_FOR_DETAIL) {
          const e = getAmmoEffectivePenForMaterial(a, m);
          const penalty = basePen - e;
          html += `<div class="ai-mats-row">`;
          html += `<div class="ai-mats-row-label">${getMaterialDisplay(m)}`
                + ` <span class="ai-mats-row-val">${e}`
                + (penalty > 0 ? `<span class="ai-mat-cell-penalty"> -${penalty}</span>` : '')
                + `</span></div>`;
          // 클래스 1~7 등급 칩 — 칩 내부 숫자는 0~6 관통등급
          html += `<div class="ai-mats-row-cells">`;
          for (let cls = 1; cls <= 7; cls++) {
            const armor = getClassArmorValue(cls);
            const diff = e - armor;
            const p = getSystemPenetrationProb(e, m, armor);
            const g = getPenetrationGrade(p);
            html += `<span class="ai-grade g${g}" title="${getMaterialDisplay(m)} Class ${cls} · diff ${diff} · 평균 ${p>0?(p<1?(1/p).toFixed(1):"1"):"∞"}발 · 관통 ${(p*100).toFixed(0)}%">${g}</span>`;
          }
          html += `</div></div>`;
        }
        html += `</div></td></tr>`;
      }
    }
  }
  html += '</tbody>';
  el.innerHTML = html;

  // 행 클릭 → 펼침 토글
  el.querySelectorAll('.ai-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.id;
      aiExpandedAmmoId = (aiExpandedAmmoId === id) ? null : id;
      renderAmmoInfoTable();
    });
  });
}

function setAmmoInfoMaterial(material) {
  if (AI_MATERIALS.indexOf(material) < 0) return;
  aiSelectedMaterial = material;
  document.querySelectorAll('#aiMatButtons .ai-mat-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.mat === material);
  });
  renderAmmoInfoTable();
}

document.querySelectorAll('#aiMatButtons .ai-mat-btn').forEach(b => {
  b.addEventListener('click', () => setAmmoInfoMaterial(b.dataset.mat));
});

// 첫 진입 시 한 번 렌더 — 탭이 보이지 않는 상태에서도 미리 그려둠
renderAmmoInfoTable();

document.querySelectorAll('.ld-mapsel-btn').forEach(b => {
  b.addEventListener('click', () => {
    const id = b.dataset.map;
    GAME.mapId = id;
    document.querySelectorAll('.ld-mapsel-btn').forEach(x => {
      x.classList.toggle('on', x.dataset.map === id);
    });
    // SIDE-PER-OPERATOR-LOADOUT-1: 맵 변경 시 새 맵에 없는 scope는 default로 (override 데이터는 보존)
    if (typeof reconcileOperatorScopeForMap === 'function') reconcileOperatorScopeForMap(id);
    if (typeof renderAllOperatorScopeBars === 'function') renderAllOperatorScopeBars();
    if (typeof renderLoadout === 'function') renderLoadout();
    if (typeof renderWeaponSetupTab === 'function') renderWeaponSetupTab();
    if (typeof renderCoverageTab === 'function') renderCoverageTab();
  });
});

// SIDE-PER-OPERATOR-LOADOUT-1: 대원 scope 선택 + 개별 초기화 (위임)
document.addEventListener('click', (e) => {
  const opBtn = e.target.closest && e.target.closest('.ld-op-btn');
  if (opBtn && opBtn.dataset.opTeam) {
    setCurrentLoadoutUnitKey(opBtn.dataset.opTeam, opBtn.dataset.opKey);
    if (typeof renderLoadout === 'function') renderLoadout();
    if (typeof renderWeaponSetupTab === 'function') renderWeaponSetupTab();
    if (typeof renderCoverageTab === 'function') renderCoverageTab();
    if (typeof renderAllOperatorScopeBars === 'function') renderAllOperatorScopeBars();
    return;
  }
  const resetBtn = e.target.closest && e.target.closest('.ld-op-reset');
  if (resetBtn && resetBtn.dataset.opResetTeam) {
    resetOperatorOverride(resetBtn.dataset.opResetTeam, resetBtn.dataset.opResetKey);
    return;
  }
});

document.getElementById('btnStartMission').addEventListener('click', () => {
  setMapById(GAME.mapId || 'cqb');
  setupGame();
});

// =============================================================
