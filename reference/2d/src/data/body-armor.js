// =============================================================
// 2A-6.5: BODY_ARMOR_REGISTRY — 방탄복 본체 소스 데이터 (BODY_ARMOR_PRESETS는 builder 생성물)
//   coverage는 locSlot 인자 튜플 [hardP,softP,noneP,hardArmor,softArmor,softBacker,hardMaterial,softMaterial]
//   builder가 locSlot(...)로 기존과 동일한 shape를 생성한다.
// =============================================================
const BODY_ARMOR_REGISTRY = {
  iotv_test: {
    id:'iotv_test',
    display:{ name:'IOTV 표준 방탄복', shortName:'IOTV', desc:'표준 / 소프트 방호 넓음 / 플레이트 별도', group:'western', tableOrder:10 },
    armor:{ category:'heavy_vest', role:'standard_infantry_armor', noPlateSlots:false, allowReplicaPlatesOnly:false },
    physical:{ weightKg:6.20 },
    softArmor:{ value:32, material:'aramid', maxDurability:44 },
    plateSlots:{ front:true, back:true, side:true, abdomenFront:false, abdomenRear:false },
    accessorySlots:{ groinGuard:true, shoulderGuard:true, neckGuard:true },
    compatibleAccessoryIds:{ groinGuard:['iotv_groin'], shoulderGuard:['iotv_shoulder'], neckGuard:['iotv_neck'] },
    coverage:{
      chest_front:[0.00,0.85,0.15,0,32,false,'composite','aramid'],
      chest_side:[0.00,0.55,0.45,0,32,false,'composite','aramid'],
      chest_rear:[0.00,0.80,0.20,0,32,false,'composite','aramid'],
      abdomen_front:[0.00,0.50,0.50,0,32,false,'composite','aramid'],
      abdomen_side:[0.00,0.35,0.65,0,32,false,'composite','aramid'],
      abdomen_rear:[0.00,0.45,0.55,0,32,false,'composite','aramid'],
      chest:[0.00,0.85,0.15,0,32,false,'composite','aramid'],
      abdomen:[0.00,0.50,0.50,0,32,false,'composite','aramid'],
      neck:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'본체 neck/arms/legs 기본방호 없음 (accessory/플레이트 전담). 외피 코듀라/나일론은 방호 비참여.',
  },
  jpc_test: {
    id:'jpc_test',
    display:{ name:'JPC 경량 플레이트', shortName:'JPC', desc:'경량 캐리어 / 플레이트로 방호 / 측면 매우 취약', group:'western', tableOrder:20 },
    armor:{ category:'plate_carrier', role:'light_plate_carrier', noPlateSlots:false, allowReplicaPlatesOnly:false },
    physical:{ weightKg:1.10 },
    softArmor:{ value:13, material:'aramid', maxDurability:35 },
    plateSlots:{ front:true, back:true, side:false, abdomenFront:false, abdomenRear:false },
    accessorySlots:{ groinGuard:false, shoulderGuard:false, neckGuard:false },
    compatibleAccessoryIds:{ groinGuard:[], shoulderGuard:[], neckGuard:[] },
    coverage:{
      chest_front:[0.00,0.30,0.70,0,13,false,'ceramic','aramid'],
      chest_side:[0.00,0.10,0.90,0,13,false,'ceramic','aramid'],
      chest_rear:[0.00,0.30,0.70,0,13,false,'ceramic','aramid'],
      abdomen_front:[0.00,0.05,0.95,0,13,false,'ceramic','aramid'],
      abdomen_side:[0.00,0.00,1.00,0,0,false,'ceramic','fabric'],
      abdomen_rear:[0.00,0.05,0.95,0,13,false,'ceramic','aramid'],
      chest:[0.00,0.30,0.70,0,13,false,'ceramic','aramid'],
      abdomen:[0.00,0.00,1.00,0,0,false,'ceramic','fabric'],
      neck:[0.00,0.00,1.00,0,0,false,'ceramic','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'ceramic','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'코듀라/나일론 외피는 별도 필드 없이 desc로만. 방호 계산은 얇은 aramid 13 backer만 대표.',
  },
  armor_6b23_test: {
    id:'armor_6b23_test',
    display:{ name:'6B23 중방호', shortName:'6B23', desc:'6B23 전용 플레이트 호환 / 측면 슬롯 없음', group:'russian', tableOrder:30 },
    armor:{ category:'russian_vest', role:'russian_medium_armor', noPlateSlots:false, allowReplicaPlatesOnly:false },
    physical:{ weightKg:5.70 },
    softArmor:{ value:23, material:'aramid', maxDurability:45 },
    plateSlots:{ front:true, back:true, side:false, abdomenFront:false, abdomenRear:false },
    accessorySlots:{ groinGuard:false, shoulderGuard:false, neckGuard:false },
    compatibleAccessoryIds:{ groinGuard:[], shoulderGuard:[], neckGuard:[] },
    builtInProtection:{
      neckGuard:{ enabled:true, armorValue:23, material:'aramid', coverageHint:['lowerNeck','collarLine','neckAdjacent'] },
      lowerGroinApron:{ enabled:true, armorValue:23, material:'aramid', coverageHint:['lowerAbdomen','beltLine','pelvisUpper','groinFront','inguinalPartial'] },
    },
    coverage:{
      chest_front:[0.00,0.70,0.30,0,23,false,'steel','aramid'],
      chest_side:[0.00,0.55,0.45,0,23,false,'steel','aramid'],
      chest_rear:[0.00,0.60,0.40,0,23,false,'steel','aramid'],
      abdomen_front:[0.00,0.55,0.45,0,23,false,'steel','aramid'],
      abdomen_side:[0.00,0.45,0.55,0,23,false,'steel','aramid'],
      abdomen_rear:[0.00,0.45,0.55,0,23,false,'steel','aramid'],
      chest:[0.00,0.70,0.30,0,23,false,'steel','aramid'],
      abdomen:[0.00,0.55,0.45,0,23,false,'steel','aramid'],
      neck:[0.00,0.20,0.80,0,23,false,'steel','aramid'],
      arms:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'6B23 기본 목보호(neck softP0.20/23)와 기본 하부 패널(lowerGroinApron, 하복부/골반상부/낭심 일부 soft 보호)은 본체 built-in. 별도 neckGuard/groinGuard 장착으로 처리 안 함(accessorySlots.groinGuard:false 유지).',
  },
  armor_6b45_basic_test: {
    id:'armor_6b45_basic_test',
    display:{ name:'6B45 기본형', shortName:'6B45', desc:'정면 강함 / 측면 제한 / 후면 플레이트 슬롯 / 높은 패널티', group:'russian', tableOrder:40 },
    armor:{ category:'russian_vest', role:'russian_heavy_modular_armor', noPlateSlots:false, allowReplicaPlatesOnly:false },
    physical:{ weightKg:5.30 },
    softArmor:{ value:32, material:'aramid', maxDurability:44 },
    plateSlots:{ front:true, back:true, side:true, abdomenFront:false, abdomenRear:false },
    accessorySlots:{ groinGuard:true, shoulderGuard:true, neckGuard:true },
    compatibleAccessoryIds:{ groinGuard:['6b45_groin'], shoulderGuard:['6b45_shoulder'], neckGuard:['6b45_neck'] },
    coverage:{
      chest_front:[0.00,0.80,0.20,0,32,false,'ceramic','aramid'],
      chest_side:[0.00,0.50,0.50,0,32,false,'ceramic','aramid'],
      chest_rear:[0.00,0.65,0.35,0,32,false,'ceramic','aramid'],
      abdomen_front:[0.00,0.45,0.55,0,32,false,'ceramic','aramid'],
      abdomen_side:[0.00,0.30,0.70,0,32,false,'ceramic','aramid'],
      abdomen_rear:[0.00,0.35,0.65,0,32,false,'ceramic','aramid'],
      chest:[0.00,0.80,0.20,0,32,false,'ceramic','aramid'],
      abdomen:[0.00,0.45,0.55,0,32,false,'ceramic','aramid'],
      neck:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'ceramic','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'본체 neck/arms/legs 기본방호 없음.',
  },
  msv: {
    id:'msv',
    display:{ name:'MSV 모듈러 베스트', shortName:'MSV', desc:'현대 모듈형 / IOTV보다 가볍고 JPC보다 방호 넓음', group:'modern', tableOrder:50 },
    armor:{ category:'modern_vest', role:'modern_light_modular_armor', noPlateSlots:false, allowReplicaPlatesOnly:false },
    physical:{ weightKg:5.00 },
    softArmor:{ value:30, material:'pe', maxDurability:45 },
    plateSlots:{ front:true, back:true, side:true, abdomenFront:false, abdomenRear:false },
    accessorySlots:{ groinGuard:true, shoulderGuard:true, neckGuard:true },
    compatibleAccessoryIds:{ groinGuard:['msv_groin'], shoulderGuard:['msv_shoulder'], neckGuard:['msv_neck'] },
    coverage:{
      chest_front:[0.00,0.60,0.40,0,30,false,'composite','pe'],
      chest_side:[0.00,0.35,0.65,0,30,false,'composite','pe'],
      chest_rear:[0.00,0.55,0.45,0,30,false,'composite','pe'],
      abdomen_front:[0.00,0.30,0.70,0,30,false,'composite','pe'],
      abdomen_side:[0.00,0.20,0.80,0,30,false,'composite','pe'],
      abdomen_rear:[0.00,0.25,0.75,0,30,false,'composite','pe'],
      chest:[0.00,0.60,0.40,0,30,false,'composite','pe'],
      abdomen:[0.00,0.30,0.70,0,30,false,'composite','pe'],
      neck:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'MSV 본체 soft는 경량 PE 인서트 30. 본체 neck/arms/legs 기본방호 없음.',
  },
  police_vest: {
    id:'police_vest',
    display:{ name:'경찰용 방탄복', shortName:'Police Vest', desc:'고정 알루미늄 + 소프트. 권총·파편 강함, 소총·AP 취약. 플레이트 추가 불가.', group:'police', tableOrder:60 },
    armor:{ category:'police_vest', role:'police_soft_armor_with_fixed_plate', noPlateSlots:true, allowReplicaPlatesOnly:false },
    physical:{ weightKg:6.20 },
    softArmor:{ value:32, material:'aramid', maxDurability:44 },
    plateSlots:{ front:false, back:false, side:false, abdomenFront:false, abdomenRear:false },
    accessorySlots:{ groinGuard:false, shoulderGuard:false, neckGuard:false },
    compatibleAccessoryIds:{ groinGuard:[], shoulderGuard:[], neckGuard:[] },
    coverage:{
      chest_front:[0.70,0.25,0.05,38,32,true,'aluminum','aramid'],
      chest_side:[0.00,0.35,0.65,0,32,false,'aluminum','aramid'],
      chest_rear:[0.65,0.30,0.05,38,32,true,'aluminum','aramid'],
      abdomen_front:[0.00,0.30,0.70,0,32,false,'aluminum','aramid'],
      abdomen_side:[0.00,0.20,0.80,0,32,false,'aluminum','aramid'],
      abdomen_rear:[0.00,0.25,0.75,0,32,false,'aluminum','aramid'],
      chest:[0.70,0.25,0.05,38,32,true,'aluminum','aramid'],
      abdomen:[0.00,0.30,0.70,0,32,false,'aluminum','aramid'],
      neck:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'고정 알루미늄 chest hard. 탈착 플레이트 슬롯 없음(noPlateSlots).',
  },
  airsoft_plate_carrier: {
    id:'airsoft_plate_carrier',
    display:{ name:'Airsoft Plate Carrier', shortName:'Airsoft PC', desc:'에어소프트/레플리카용 플레이트 캐리어. 패널당 무게 제한 있음 (≤2.8kg).', group:'replica', tableOrder:70 },
    armor:{ category:'replica', role:'airsoft_plate_carrier', noPlateSlots:false, allowReplicaPlatesOnly:false },
    physical:{ weightKg:0.90 },
    softArmor:{ value:1, material:'fabric', maxDurability:12 },
    plateSlots:{ front:true, back:true, side:false, abdomenFront:false, abdomenRear:false },
    plateWeightLimitKg:{ front:2.8, back:2.8, side:0 },
    accessorySlots:{ groinGuard:false, shoulderGuard:false, neckGuard:false },
    compatibleAccessoryIds:{ groinGuard:[], shoulderGuard:[], neckGuard:[] },
    coverage:{
      chest_front:[0.00,0.18,0.82,0,1,false,'fabric','fabric'],
      chest_side:[0.00,0.10,0.90,0,0,false,'fabric','fabric'],
      chest_rear:[0.00,0.18,0.82,0,1,false,'fabric','fabric'],
      abdomen_front:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      abdomen_side:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      abdomen_rear:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      chest:[0.00,0.18,0.82,0,1,false,'fabric','fabric'],
      abdomen:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      neck:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'실질 방호 없음. side 슬롯 없음.',
  },
  replica_tactical_vest: {
    id:'replica_tactical_vest',
    display:{ name:'Replica Tactical Vest', shortName:'Replica Vest', desc:'전술 조끼 형태 레플리카. 실탄 방호 없음. 레플리카 플레이트만 호환.', group:'replica', tableOrder:80 },
    armor:{ category:'replica', role:'replica_tactical_vest', noPlateSlots:false, allowReplicaPlatesOnly:true },
    physical:{ weightKg:1.00 },
    softArmor:{ value:1, material:'fabric', maxDurability:10 },
    plateSlots:{ front:true, back:true, side:false, abdomenFront:false, abdomenRear:false },
    plateWeightLimitKg:{ front:1.0, back:1.0, side:0 },
    accessorySlots:{ groinGuard:false, shoulderGuard:false, neckGuard:false },
    compatibleAccessoryIds:{ groinGuard:[], shoulderGuard:[], neckGuard:[] },
    coverage:{
      chest_front:[0.00,0.15,0.85,0,1,false,'fabric','fabric'],
      chest_side:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      chest_rear:[0.00,0.15,0.85,0,1,false,'fabric','fabric'],
      abdomen_front:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      abdomen_side:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      abdomen_rear:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      chest:[0.00,0.15,0.85,0,1,false,'fabric','fabric'],
      abdomen:[0.00,0.05,0.95,0,0,false,'fabric','fabric'],
      neck:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      arms:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
      legs:[0.00,0.00,1.00,0,0,false,'fabric','fabric'],
    },
    notes:'레플리카 플레이트만 호환(allowReplicaPlatesOnly). 실질 방호 없음.',
  },
};
function buildBodyArmorPresetFromRegistry(entry) {
  if (!entry) return null;
  const d = entry.display || {}, am = entry.armor || {}, ph = entry.physical || {}, sa = entry.softArmor || {};
  const out = { id: entry.id, name: d.name, shortName: d.shortName, desc: d.desc, weightKg: ph.weightKg };
  // coverage — locSlot 인자 튜플 → 기존과 동일 shape
  out.coverage = {};
  const cov = entry.coverage || {};
  for (const k in cov) { const t = cov[k]; out.coverage[k] = locSlot(t[0],t[1],t[2],t[3],t[4],t[5],t[6],t[7]); }
  // top-level 호환 필드
  if (am.noPlateSlots) out.noPlateSlots = true;
  if (am.allowReplicaPlatesOnly) out.allowReplicaPlatesOnly = true;
  if (entry.plateWeightLimitKg) out.plateWeightLimitKg = Object.assign({}, entry.plateWeightLimitKg);
  if (sa.maxDurability != null) out.softMaxDurability = sa.maxDurability;
  // 2A-6.5 신규 메타데이터 (additive — AAR/helper 참고용)
  if (entry.plateSlots) out.plateSlots = Object.assign({}, entry.plateSlots);
  if (entry.accessorySlots) out.accessorySlots = Object.assign({}, entry.accessorySlots);
  if (entry.compatibleAccessoryIds) out.compatibleAccessoryIds = JSON.parse(JSON.stringify(entry.compatibleAccessoryIds));
  if (entry.builtInProtection) out.builtInProtection = JSON.parse(JSON.stringify(entry.builtInProtection));
  out.softArmorValue = (sa.value != null) ? sa.value : 0;
  out.softArmorMaterial = sa.material || 'aramid';
  out.category = am.category; out.role = am.role;
  return out;
}
function buildBodyArmorPresetsFromRegistry() {
  const o = {};
  for (const id in BODY_ARMOR_REGISTRY) o[id] = buildBodyArmorPresetFromRegistry(BODY_ARMOR_REGISTRY[id]);
  return o;
}
// 2A-6.5-FINAL: 로드아웃 방탄복 선택지를 BODY_ARMOR_REGISTRY에서 자동 생성 (id 문자열 배열).
//   ui.showInArmorSelector === false 제외, display.tableOrder(또는 ui.tableOrder) 기준 정렬.
function buildBodyArmorLoadoutOptionsFromRegistry() {
  const items = [];
  for (const id in BODY_ARMOR_REGISTRY) {
    const e = BODY_ARMOR_REGISTRY[id];
    const ui = e.ui || {}, disp = e.display || {};
    if (ui.showInArmorSelector === false || ui.hidden === true) continue;
    const order = (ui.tableOrder != null) ? ui.tableOrder : (disp.tableOrder != null ? disp.tableOrder : 9999);
    items.push({ id, order });
  }
  items.sort((a, b) => a.order - b.order);
  return items.map(x => x.id);
}
const BODY_ARMOR_PRESETS = {};
(function _switchBodyArmorSource() {
  function replaceInPlace(t, s) { for (const k in t) delete t[k]; Object.assign(t, s); }
  try {
    replaceInPlace(BODY_ARMOR_PRESETS, buildBodyArmorPresetsFromRegistry());
    if (typeof console !== 'undefined') console.log(`[BodyArmorSource] REGISTRY (${Object.keys(BODY_ARMOR_PRESETS).length})`);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[BodyArmorSource] registry 생성 실패 → manual fallback:', e && e.message);
    try { replaceInPlace(BODY_ARMOR_PRESETS, LEGACY_BODY_ARMOR_PRESETS_MANUAL); } catch (e2) {}
  }
})();


const LEGACY_HELMET_PRESETS_MANUAL = {   // 2A-6.1: 수동 백업 (registry 생성물이 기본)
  mich_test: { id:'mich_test', name:'MICH 헬멧', shortName:'MICH',
    desc:'shell 24 / liner 8 (aramid) — 권총·파편 차단, 소총탄 직격 위험',
    weightKg: 1.45,
    head_skull:    helmetSlot(24, 8, 'aramid'),
    head_temporal: helmetSlot(23, 8, 'aramid'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  helmet_6b47_test: { id:'helmet_6b47_test', name:'6B47 헬멧', shortName:'6B47',
    desc:'shell 23 / liner 8 (aramid) — 표준 러시아식 전투헬멧',
    weightKg: 1.15,
    head_skull:    helmetSlot(23, 8, 'aramid'),
    head_temporal: helmetSlot(22, 8, 'aramid'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  // OPS-CORE FAST MT — 경량 고컷
  fast_mt: { id:'fast_mt', name:'FAST MT', shortName:'FAST MT',
    desc:'shell 25 / liner 8 (pe) — 경량 고컷. 측두부 방호 낮음',
    weightKg: 1.05,
    head_skull:    helmetSlot(25, 8, 'pe'),
    head_temporal: helmetSlotHighCut(22, 8, 'pe'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  // ECH — 강화 미군 헬멧
  ech: { id:'ech', name:'ECH', shortName:'ECH',
    desc:'shell 28 / liner 8 (pe) — MICH 강화형',
    weightKg: 1.50,
    head_skull:    helmetSlot(28, 8, 'pe'),
    head_temporal: helmetSlot(27, 8, 'pe'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  // K6-3 — 무거운 티타늄
  k6_3: { id:'k6_3', name:'K6-3 헬멧', shortName:'K6-3',
    desc:'shell 30 / liner 8 (titanium) — 매우 무거움. 측면/귀 매우 넓게 방호',
    weightKg: 3.20,
    head_skull:    helmetSlot(30, 8, 'titanium'),
    head_temporal: helmetSlotFullCut(28, 8, 'titanium'),   // 풀컷 — 측면 매우 넓게 덮음
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  // 6B47M — PE 계열 현대화 러시아식
  helmet_6b47m: { id:'helmet_6b47m', name:'6B47M', shortName:'6B47M',
    desc:'shell 27 / liner 8 (pe) — 6B47 현대화/PE 강화',
    weightKg: 1.30,
    head_skull:    helmetSlot(27, 8, 'pe'),
    head_temporal: helmetSlot(25, 8, 'pe'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  // LShZ Lightweight — 경량 고컷 (FAST MT 러시아판)
  lshz_light: { id:'lshz_light', name:'LShZ 경량', shortName:'LShZ',
    desc:'shell 23 / liner 8 (aramid) — 경량 고컷 러시아식. 귀 노출 큼',
    weightKg: 1.10,
    head_skull:    helmetSlot(23, 8, 'aramid'),
    head_temporal: helmetSlotHighCut(20, 8, 'aramid'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },

  // ----- 비방탄 범프 헬멧 (Ops-Core FAST Bump 계열) -----
  helmet_fast_bump: { id:'helmet_fast_bump', name:'Ops-Core FAST Bump Helmet', shortName:'FAST Bump',
    desc:'shell 4 (비방탄재) — 460g 범프 헬멧. 낙상/충격 보호용, 실탄 방호 없음. 바이저/SLAAP 장착 가능.',
    weightKg: 0.46,
    head_skull:    helmetSlot(4, 2, 'fabric'),
    head_temporal: helmetSlotHighCut(2, 1, 'fabric'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'fabric', 'fabric'),
  },
  helmet_fast_carbon_bump: { id:'helmet_fast_carbon_bump', name:'Ops-Core FAST Carbon Composite Bump Helmet', shortName:'FAST Carbon',
    desc:'shell 6 (복합재) — 330g 카본 복합재 범프 헬멧. 일반 범프보다 약간 강하지만 방탄 헬멧은 아님.',
    weightKg: 0.33,
    head_skull:    helmetSlot(6, 2, 'composite'),
    head_temporal: helmetSlotHighCut(4, 1, 'composite'),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
  // ULACH — PE 경량 방탄 헬멧, 귀/측면 방호 넓음
  helmet_ulach: { id:'helmet_ulach', name:'ULACH Helmet', shortName:'ULACH',
    desc:'shell 26 / liner 8 (pe) — PE 경량 방탄 헬멧. 귀/측면 방호가 일반 헬멧보다 넓지만 K6-3급은 아님.',
    weightKg: 1.30,
    head_skull:    helmetSlot(26, 8, 'pe'),
    head_temporal: helmetSlotMidCut(25, 8, 'pe'),   // 중간컷 — 일반보다 넓게
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, 'composite', 'fabric'),
  },
};

// =============================================================
// PROTECTION_ACCESSORY_PRESETS — 추가 보호구
// =============================================================
//   accessoryType: 'groin' / 'shoulder' / 'neck' / 'visor' / 'slaap'
//   compatibleArmorIds 또는 compatibleHelmetIds로 호환 제한.
//   장착 시 해당 부위의 protection slot에 합성 (softP/softArmor 또는 hardP 증가).
const LEGACY_PROTECTION_ACCESSORY_PRESETS_MANUAL = {   // 2A-6.1: 수동 백업 (body armor accessory + helmet accessory 원본)
  // ----- 없음 -----
  no_groin_guard:    { id:'no_groin_guard',    name:'No Groin Guard',    shortName:'없음', accessoryType:'groin',    isNone:true, weightKg:0 },
  no_shoulder_guard: { id:'no_shoulder_guard', name:'No Shoulder Guards',shortName:'없음', accessoryType:'shoulder', isNone:true, weightKg:0 },
  no_neck_guard:     { id:'no_neck_guard',     name:'No Neck Guard',     shortName:'없음', accessoryType:'neck',     isNone:true, weightKg:0 },
  no_visor:          { id:'no_visor',          name:'No Visor',          shortName:'없음', accessoryType:'visor',    isNone:true, weightKg:0 },
  no_slaap:          { id:'no_slaap',          name:'No SLAAP',          shortName:'없음', accessoryType:'slaap',    isNone:true, weightKg:0 },

  // ----- IOTV 전용 -----
  iotv_groin:    { id:'iotv_groin', name:'IOTV Groin Protector', shortName:'IOTV 낭심',
    accessoryType:'groin',    compatibleArmorIds:['iotv_test'],
    material:'aramid', armorType:'soft', armorValue:33, weightKg:0.50,
    desc:'IOTV용 사타구니 보호 패널 (아라미드 소프트)' },
  iotv_shoulder: { id:'iotv_shoulder', name:'IOTV Shoulder Protectors', shortName:'IOTV 어깨',
    accessoryType:'shoulder', compatibleArmorIds:['iotv_test'],
    material:'aramid', armorType:'soft', armorValue:32, weightKg:0.75,
    desc:'IOTV용 어깨 패드 (한 쌍)' },
  iotv_neck:     { id:'iotv_neck', name:'IOTV Neck Protector', shortName:'IOTV 목',
    accessoryType:'neck',     compatibleArmorIds:['iotv_test'],
    material:'aramid', armorType:'soft', armorValue:33, weightKg:0.40,
    desc:'IOTV용 목 보호 패드' },

  // ----- 6B45 전용 -----
  '6b45_groin':    { id:'6b45_groin', name:'6B45 Groin Protector', shortName:'6B45 낭심',
    accessoryType:'groin',    compatibleArmorIds:['armor_6b45_basic_test'],
    material:'aramid', armorType:'soft', armorValue:33, weightKg:0.55,
    desc:'6B45용 사타구니 보호 패널' },
  '6b45_shoulder': { id:'6b45_shoulder', name:'6B45 Shoulder Protectors', shortName:'6B45 어깨',
    accessoryType:'shoulder', compatibleArmorIds:['armor_6b45_basic_test'],
    material:'aramid', armorType:'soft', armorValue:32, weightKg:0.85,
    desc:'6B45용 어깨 패드' },
  '6b45_neck':     { id:'6b45_neck', name:'6B45 Neck Protector', shortName:'6B45 목',
    accessoryType:'neck',     compatibleArmorIds:['armor_6b45_basic_test'],
    material:'aramid', armorType:'soft', armorValue:33, weightKg:0.45,
    desc:'6B45용 목 보호 패드' },

  // ----- MSV 전용 -----
  msv_groin:    { id:'msv_groin', name:'MSV Groin Protector', shortName:'MSV 낭심',
    accessoryType:'groin',    compatibleArmorIds:['msv'],
    material:'pe', armorType:'soft', armorValue:28, weightKg:0.45,
    desc:'MSV용 사타구니 보호 패널' },
  msv_shoulder: { id:'msv_shoulder', name:'MSV Shoulder Protectors', shortName:'MSV 어깨',
    accessoryType:'shoulder', compatibleArmorIds:['msv'],
    material:'pe', armorType:'soft', armorValue:26, weightKg:0.65,
    desc:'MSV용 어깨 패드' },
  msv_neck:     { id:'msv_neck', name:'MSV Neck Protector', shortName:'MSV 목',
    accessoryType:'neck',     compatibleArmorIds:['msv'],
    material:'pe', armorType:'soft', armorValue:28, weightKg:0.40,
    desc:'MSV용 목 보호 패드' },

  // ----- 헬멧 바이저 -----
  //   FAST MT / LShZ는 동일 마운트로 처리 — 같은 바이저 + SLAAP 호환.
  fast_mt_visor: { id:'fast_mt_visor', name:'FAST/LShZ Ballistic Visor', shortName:'바이저',
    accessoryType:'visor', compatibleHelmetIds:['fast_mt','lshz_light','helmet_fast_bump','helmet_fast_carbon_bump'],
    material:'pe', armorType:'hard', armorValue:22, weightKg:0.80,
    bluntMul: 0.10,
    desc:'고컷 헬멧용 권총·파편 차단 바이저. 9mm FMJ는 막지만 AP·소총탄 취약. 막음시 얼굴 둔상 거의 없음 (어지러움)' },
  // K6-3 바이저 — 방탄유리(40%) + 티타늄 프레임(60%) 분할 피격
  k6_3_visor:    { id:'k6_3_visor', name:'K6-3 Visor (Glass+Titanium)', shortName:'K6-3 바이저',
    accessoryType:'visor', compatibleHelmetIds:['k6_3'],
    armorType:'mixed', weightKg:1.00,
    visorHitTable: [
      { id:'glass',    label:'방탄유리',  weight:0.40, material:'pe',       durabilityMaterial:'glass',    armorValue:23, bluntMul:0.08 },
      { id:'titanium', label:'티타늄부',  weight:0.60, material:'titanium', durabilityMaterial:'titanium', armorValue:28, bluntMul:0.16 },
    ],
    desc:'K6-3 통합형 바이저 — 방탄유리(40%) + 티타늄 프레임(60%). 권총·파편 강함, 소총탄 취약. 7N31은 대체로 관통.' },

  // ----- SLAAP -----
  fast_mt_slaap: { id:'fast_mt_slaap', name:'FAST/LShZ SLAAP', shortName:'SLAAP',
    accessoryType:'slaap', compatibleHelmetIds:['fast_mt','lshz_light','helmet_fast_bump','helmet_fast_carbon_bump'],
    material:'ceramic', armorType:'hard', armorValue:48, weightKg:0.75,
    bluntMul: 0.30,
    desc:'전면 두개부 하드 보강 플레이트 (소총탄 일부 대응)' },
};

