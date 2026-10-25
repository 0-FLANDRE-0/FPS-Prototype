
// =============================================================
// 1. EQUIPMENT & COMBAT DATA  (기존 tactical.html 호환)
// =============================================================
const ARMOR_SCALE = 10;

function P(hardP, softP, noneP, hardArmor, softArmor, softBacker, hardMaterial, softMaterial) {
  return {
    hardP, softP, noneP,
    hard: { smallArmor: hardArmor || 0, material: hardMaterial || 'composite' },
    soft: { smallArmor: softArmor || 0, material: softMaterial || 'aramid' },
    none: { smallArmor: 0, material: 'fabric' },
    softBacker: !!softBacker,
  };
}
function locSlot(hardP, softP, noneP, hardArmor, softArmor, softBacker, hardMaterial, softMaterial) {
  return P(hardP, softP, noneP, hardArmor, softArmor, softBacker, hardMaterial, softMaterial);
}

// 헬멧 전용 방호 슬롯 — shell + liner backer 구조
//   shell: 헬멧 외피 (hard) — 권총탄/파편 위주 차단
//   liner: shell 뒤 backer — 독립 soft 방호가 아니라, shell 관통 시 잔여 관통력/둔상 완화
//   "헬멧 외피 없이 라이너만 막음" 같은 결과를 방지하기 위해 softP=0
//   isHelmet 플래그 — 소총탄 방호 감소 보정에서 사용
function helmetSlot(shellArmor, linerArmor, shellMaterial) {
  // 일반컷 헬멧 — 머리 두개부의 거의 전체를 덮음 (틈 5%)
  const slot = P(0.95, 0.00, 0.05,
                 shellArmor, linerArmor, true,
                 shellMaterial || 'aramid', 'aramid');
  slot.isHelmet = true;
  return slot;
}

// 측면 노출이 더 큰 고컷 헬멧용 helmetSlot — FAST MT 등에서 사용
//   hardP를 낮추고 noneP를 높여 측두부 노출 표현
function helmetSlotHighCut(shellArmor, linerArmor, shellMaterial) {
  const slot = P(0.70, 0.00, 0.30,
                 shellArmor, linerArmor, true,
                 shellMaterial || 'aramid', 'aramid');
  slot.isHelmet = true;
  return slot;
}

// 중간컷 — 일반 헬멧보다 귀/측면을 조금 더 덮음 (ULACH)
function helmetSlotMidCut(shellArmor, linerArmor, shellMaterial) {
  const slot = P(0.86, 0.00, 0.14,
                 shellArmor, linerArmor, true,
                 shellMaterial || 'pe', 'aramid');
  slot.isHelmet = true;
  return slot;
}

// 풀컷 — 측면/귀/후두부까지 매우 넓게 보호 (K6-3)
function helmetSlotFullCut(shellArmor, linerArmor, shellMaterial) {
  const slot = P(0.92, 0.00, 0.08,
                 shellArmor, linerArmor, true,
                 shellMaterial || 'titanium', 'aramid');
  slot.isHelmet = true;
  return slot;
}

// =============================================================
// MATERIAL_PROPS — 방호재 재질별 성질 (표시명 + bluntRatio + 설명)
// =============================================================
//   bluntRatio: 관통을 막았을 때 원래 피해 중 둔상/충격으로 전달되는 비율 (0~1)
//     - 높으면 막아도 아프다 (아라미드, 세라믹, 알루미늄)
//     - 낮으면 충격 전달도 적다 (복합소재, 티타늄)
//   pain/stopping 가중치도 같은 값을 사용해 일관되게 반영
const MATERIAL_PROPS = {
  fabric:    { displayName:'비방탄재',   bluntRatio:1.00, desc:'코듀라/플라스틱/면/폼/레플리카 소재 등 실질 방탄 성능이 없는 재질' },
  aramid:    { displayName:'아라미드',   bluntRatio:0.80, desc:'소프트 방호. 관통은 막지만 둔상 큼' },
  pe:        { displayName:'초고분자량', bluntRatio:0.55, desc:'UHMWPE. 가볍고 충격 흡수성 양호' },
  composite: { displayName:'복합소재',   bluntRatio:0.45, desc:'균형형 하드재. 충격 전달 낮은 편' },
  ceramic:   { displayName:'세라믹',     bluntRatio:0.75, desc:'우수한 관통저항. 파손/충격 전달 큼' },
  steel:     { displayName:'강철',       bluntRatio:0.55, desc:'단단·무거움. 도탄/스폴 위험' },
  aluminum:  { displayName:'알루미늄',   bluntRatio:0.70, desc:'경량 금속. 강철보다 방호 한계 있음' },
  titanium:  { displayName:'티타늄',     bluntRatio:0.45, desc:'고급 금속재. 무게 대비 우수' },
  glass:     { displayName:'방탄유리',   bluntRatio:0.60, desc:'바이저/시야 유리부. 균열·파쇄 중심 (계산은 PE proxy 사용)' },
};
function getMaterialDisplay(id) {
  return (MATERIAL_PROPS[id] && MATERIAL_PROPS[id].displayName) || id;
}
function getMaterialBluntRatio(id) {
  return (MATERIAL_PROPS[id] && MATERIAL_PROPS[id].bluntRatio != null) ? MATERIAL_PROPS[id].bluntRatio : 0.55;
}

// 보병 기본 방호 프로파일 — 장비 폴백 (재질: 일반 보병이라 가정 — soft=aramid 기본)
const PROTECTION_INFANTRY = {
  head_skull:    P(0.00, 0.85, 0.15,  0, 20, false, 'composite', 'aramid'),
  head_temporal: P(0.00, 0.50, 0.50,  0, 15, false, 'composite', 'aramid'),
  head_face:     P(0.00, 0.00, 1.00,  0,  0, false, 'composite', 'fabric'),
  neck:          P(0.00, 0.10, 0.90,  0, 15, false, 'composite', 'aramid'),
  chest:         P(0.55, 0.30, 0.15, 50, 20, true,  'composite', 'aramid'),
  abdomen:       P(0.20, 0.40, 0.40, 40, 20, true,  'composite', 'aramid'),
  arms:          P(0.00, 0.30, 0.70,  0, 10, false, 'composite', 'aramid'),
  legs:          P(0.00, 0.20, 0.80,  0, 10, false, 'composite', 'aramid'),
};

const LEGACY_BODY_ARMOR_PRESETS_MANUAL = {
  iotv_test: { id:'iotv_test', name:'IOTV 표준 방탄복', shortName:'IOTV',
    desc:'표준 / 소프트 방호 넓음 / 플레이트 별도',
    weightKg: 6.20,
    coverage: {
      // IOTV 캐리어 — soft 위주. hard는 플레이트가 제공.
      chest_front: locSlot(0.00, 0.85, 0.15,  0, 32, false, 'composite', 'aramid'),
      chest_side:  locSlot(0.00, 0.55, 0.45,  0, 32, false, 'composite', 'aramid'),
      chest_rear:  locSlot(0.00, 0.80, 0.20,  0, 32, false, 'composite', 'aramid'),
      abdomen_front: locSlot(0.00, 0.50, 0.50,  0, 32, false, 'composite', 'aramid'),
      abdomen_side:  locSlot(0.00, 0.35, 0.65,  0, 32, false, 'composite', 'aramid'),
      abdomen_rear:  locSlot(0.00, 0.45, 0.55,  0, 32, false, 'composite', 'aramid'),
      // fallback
      chest:   locSlot(0.00, 0.85, 0.15,  0, 32, false, 'composite', 'aramid'),
      abdomen: locSlot(0.00, 0.50, 0.50,  0, 32, false, 'composite', 'aramid'),
      neck:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 목 기본방호 제거 (neckGuard 전담)
      arms:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 팔 기본방호 제거 (shoulderGuard 전담)
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
  },
  jpc_test: { id:'jpc_test', name:'JPC 경량 플레이트', shortName:'JPC',
    desc:'경량 캐리어 / 플레이트로 방호 / 측면 매우 취약',
    weightKg: 1.10,
    coverage: {
      // JPC 캐리어 — soft 매우 적음, hard는 플레이트
      chest_front: locSlot(0.00, 0.30, 0.70,  0, 13, false, 'ceramic', 'aramid'),
      chest_side:  locSlot(0.00, 0.10, 0.90,  0, 13, false, 'ceramic', 'aramid'),
      chest_rear:  locSlot(0.00, 0.30, 0.70,  0, 13, false, 'ceramic', 'aramid'),
      abdomen_front: locSlot(0.00, 0.05, 0.95,  0, 13, false, 'ceramic', 'aramid'),
      abdomen_side:  locSlot(0.00, 0.00, 1.00,  0,  0, false, 'ceramic', 'fabric'),
      abdomen_rear:  locSlot(0.00, 0.05, 0.95,  0, 13, false, 'ceramic', 'aramid'),
      // fallback
      chest:   locSlot(0.00, 0.30, 0.70,  0, 13, false, 'ceramic', 'aramid'),
      abdomen: locSlot(0.00, 0.00, 1.00,  0,  0, false, 'ceramic', 'fabric'),
      neck:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'ceramic', 'fabric'),
      arms:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'ceramic', 'fabric'),
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
  },
  armor_6b23_test: { id:'armor_6b23_test', name:'6B23 중방호', shortName:'6B23',
    desc:'6B23 전용 플레이트 호환 / 측면 슬롯 없음',
    weightKg: 5.70,
    coverage: {
      // 6B23 캐리어 — 측면 항상 soft만 (플레이트 슬롯 없음)
      chest_front: locSlot(0.00, 0.70, 0.30,  0, 23, false, 'steel', 'aramid'),
      chest_side:  locSlot(0.00, 0.55, 0.45,  0, 23, false, 'steel', 'aramid'),
      chest_rear:  locSlot(0.00, 0.60, 0.40,  0, 23, false, 'steel', 'aramid'),
      abdomen_front: locSlot(0.00, 0.55, 0.45,  0, 23, false, 'steel', 'aramid'),
      abdomen_side:  locSlot(0.00, 0.45, 0.55,  0, 23, false, 'steel', 'aramid'),
      abdomen_rear:  locSlot(0.00, 0.45, 0.55,  0, 23, false, 'steel', 'aramid'),
      // fallback
      chest:   locSlot(0.00, 0.70, 0.30,  0, 23, false, 'steel', 'aramid'),
      abdomen: locSlot(0.00, 0.55, 0.45,  0, 23, false, 'steel', 'aramid'),
      neck:    locSlot(0.00, 0.20, 0.80,  0, 23, false, 'steel', 'aramid'),   // 2A-6.4: 6B23 기본 목보호대 (softArmor23/softP0.20, 예외 유지)
      arms:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 팔 기본방호 제거 (shoulderGuard 전담)
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
  },
  armor_6b45_basic_test: { id:'armor_6b45_basic_test', name:'6B45 기본형', shortName:'6B45',
    desc:'정면 강함 / 측면 제한 / 후면 플레이트 슬롯 / 높은 패널티',
    weightKg: 5.30,
    coverage: {
      // 6B45 캐리어 — soft 정면 두꺼움, 사이드/후면도 일부 soft. hard는 플레이트.
      chest_front: locSlot(0.00, 0.80, 0.20,  0, 32, false, 'ceramic', 'aramid'),
      chest_side:  locSlot(0.00, 0.50, 0.50,  0, 32, false, 'ceramic', 'aramid'),
      chest_rear:  locSlot(0.00, 0.65, 0.35,  0, 32, false, 'ceramic', 'aramid'),
      abdomen_front: locSlot(0.00, 0.45, 0.55,  0, 32, false, 'ceramic', 'aramid'),
      abdomen_side:  locSlot(0.00, 0.30, 0.70,  0, 32, false, 'ceramic', 'aramid'),
      abdomen_rear:  locSlot(0.00, 0.35, 0.65,  0, 32, false, 'ceramic', 'aramid'),
      // fallback
      chest:   locSlot(0.00, 0.80, 0.20,  0, 32, false, 'ceramic', 'aramid'),
      abdomen: locSlot(0.00, 0.45, 0.55,  0, 32, false, 'ceramic', 'aramid'),
      neck:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 목 기본방호 제거 (neckGuard 전담)
      arms:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'ceramic', 'fabric'),
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
  },
  // === MSV — IOTV와 JPC 사이 균형형 ===
  msv: { id:'msv', name:'MSV 모듈러 베스트', shortName:'MSV',
    desc:'현대 모듈형 / IOTV보다 가볍고 JPC보다 방호 넓음',
    weightKg: 5.00,
    coverage: {
      chest_front: locSlot(0.00, 0.60, 0.40,  0, 30, false, 'composite', 'pe'),
      chest_side:  locSlot(0.00, 0.35, 0.65,  0, 30, false, 'composite', 'pe'),
      chest_rear:  locSlot(0.00, 0.55, 0.45,  0, 30, false, 'composite', 'pe'),
      abdomen_front: locSlot(0.00, 0.30, 0.70,  0, 30, false, 'composite', 'pe'),
      abdomen_side:  locSlot(0.00, 0.20, 0.80,  0, 30, false, 'composite', 'pe'),
      abdomen_rear:  locSlot(0.00, 0.25, 0.75,  0, 30, false, 'composite', 'pe'),
      // fallback
      chest:   locSlot(0.00, 0.60, 0.40,  0, 30, false, 'composite', 'pe'),
      abdomen: locSlot(0.00, 0.30, 0.70,  0, 30, false, 'composite', 'pe'),
      neck:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 목 기본방호 제거 (neckGuard 전담)
      arms:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 팔 기본방호 제거 (shoulderGuard 전담)
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
  },
  // === 경찰용 방탄복 — 고정 알루미늄 삽입. 별도 플레이트 불가 ===
  police_vest: { id:'police_vest', name:'경찰용 방탄복', shortName:'Police Vest',
    desc:'고정 알루미늄 + 소프트. 권총·파편 강함, 소총·AP 취약. 플레이트 추가 불가.',
    weightKg: 6.20,
    noPlateSlots: true,   // 플레이트 슬롯 사용 불가
    coverage: {
      // 고정 알루미늄은 가슴(chest)에만. 복부는 소프트만 (MSV 수준). 측면 플레이트 없음.
      chest_front: locSlot(0.70, 0.25, 0.05, 38, 32, true,  'aluminum', 'aramid'),
      chest_side:  locSlot(0.00, 0.35, 0.65,  0, 32, false, 'aluminum', 'aramid'),
      chest_rear:  locSlot(0.65, 0.30, 0.05, 38, 32, true,  'aluminum', 'aramid'),
      abdomen_front: locSlot(0.00, 0.30, 0.70,  0, 32, false, 'aluminum', 'aramid'),
      abdomen_side:  locSlot(0.00, 0.20, 0.80,  0, 32, false, 'aluminum', 'aramid'),
      abdomen_rear:  locSlot(0.00, 0.25, 0.75,  0, 32, false, 'aluminum', 'aramid'),
      // fallback
      chest:   locSlot(0.70, 0.25, 0.05, 38, 32, true,  'aluminum', 'aramid'),
      abdomen: locSlot(0.00, 0.30, 0.70,  0, 32, false, 'aluminum', 'aramid'),
      neck:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 목 기본방호 제거 (neckGuard 전담)
      arms:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.3: 본체 팔 기본방호 제거 (shoulderGuard 전담)
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
  },

  // ----- 레플리카 / 에어소프트 (방호 거의 없음) -----
  airsoft_plate_carrier: { id:'airsoft_plate_carrier', name:'Airsoft Plate Carrier', shortName:'Airsoft PC',
    desc:'에어소프트/레플리카용 플레이트 캐리어. 패널당 무게 제한 있음 (≤2.8kg).',
    weightKg: 0.90,
    // 플레이트 패널당 무게 제한 (kg)
    plateWeightLimitKg: { front: 2.8, back: 2.8, side: 0 },
    coverage: {
      chest_front: locSlot(0.00, 0.18, 0.82, 0, 1, false, 'fabric', 'fabric'),
      chest_side:  locSlot(0.00, 0.10, 0.90, 0, 0, false, 'fabric', 'fabric'),
      chest_rear:  locSlot(0.00, 0.18, 0.82, 0, 1, false, 'fabric', 'fabric'),
      abdomen_front: locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      abdomen_side:  locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      abdomen_rear:  locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      chest:   locSlot(0.00, 0.18, 0.82, 0, 1, false, 'fabric', 'fabric'),
      abdomen: locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      neck:    locSlot(0.00, 0.00, 1.00, 0, 0, false, 'fabric', 'fabric'),
      arms:    locSlot(0.00, 0.00, 1.00, 0, 0, false, 'fabric', 'fabric'),
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
    softMaxDurability: 12,
  },

  replica_tactical_vest: { id:'replica_tactical_vest', name:'Replica Tactical Vest', shortName:'Replica Vest',
    desc:'전술 조끼 형태 레플리카. 실탄 방호 없음. 레플리카 플레이트만 호환.',
    weightKg: 1.00,
    // 레플리카 플레이트만 호환 — replica factionType만 허용 (커스텀 처리)
    plateWeightLimitKg: { front: 1.0, back: 1.0, side: 0 },
    allowReplicaPlatesOnly: true,
    coverage: {
      chest_front: locSlot(0.00, 0.15, 0.85, 0, 1, false, 'fabric', 'fabric'),
      chest_side:  locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      chest_rear:  locSlot(0.00, 0.15, 0.85, 0, 1, false, 'fabric', 'fabric'),
      abdomen_front: locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      abdomen_side:  locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      abdomen_rear:  locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      chest:   locSlot(0.00, 0.15, 0.85, 0, 1, false, 'fabric', 'fabric'),
      abdomen: locSlot(0.00, 0.05, 0.95, 0, 0, false, 'fabric', 'fabric'),
      neck:    locSlot(0.00, 0.00, 1.00, 0, 0, false, 'fabric', 'fabric'),
      arms:    locSlot(0.00, 0.00, 1.00, 0, 0, false, 'fabric', 'fabric'),
      legs:    locSlot(0.00, 0.00, 1.00,  0,  0, false, 'fabric', 'fabric'),   // 2A-6.4: legs fallback 제거
    },
    softMaxDurability: 10,
  },
};
