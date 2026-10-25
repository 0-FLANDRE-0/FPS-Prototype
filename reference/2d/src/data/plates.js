// PLATE_PRESETS — 방탄 플레이트 (방탄복과 분리된 별도 장비)
// =============================================================
//   필드:
//     id, name, shortName, factionType: 'western'/'russian'/'universal'/'none'
//     slotType: 'frontBack' (전후 공용) / 'side' / 'frontSet' (6B23 전용 전방 세트) / 'back'
//     compatibleArmorIds: 배열이면 그 안의 방탄복만 호환 (6B23 전용 등)
//     incompatibleArmorIds: 명시적 호환 불가 목록
//     material, backingMaterial, hardArmor, backingArmor, weightKg
//   호환 헬퍼 isPlateCompatible / armorSupportsSidePlate / getCompatiblePlatesForArmor 참조.
const LEGACY_PLATE_PRESETS_MANUAL = {   // 2A-6.0: 수동 백업 (registry 생성물이 기본)
  // === 플레이트 없음 ===
  no_front_plate: { id:'no_front_plate', name:'No Front Plate', shortName:'없음',
    factionType:'none', slotType:'frontBack', isNone:true,
    hardArmor:0, material: null, weightKg: 0, desc:'전면 플레이트 없음' },
  no_back_plate:  { id:'no_back_plate',  name:'No Back Plate',  shortName:'없음',
    factionType:'none', slotType:'frontBack', isNone:true,
    hardArmor:0, material: null, weightKg: 0, desc:'후면 플레이트 없음' },
  no_side_plate:  { id:'no_side_plate',  name:'No Side Plate',  shortName:'없음',
    factionType:'none', slotType:'side', isNone:true,
    hardArmor:0, material: null, weightKg: 0, desc:'측면 플레이트 없음' },

  // === 서방제 일반 frontBack ===
  plate_ar500: { id:'plate_ar500', name:'AR500 Ballistic Plate', shortName:'AR500',
    factionType:'western', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'steel', backingMaterial:'aramid',
    hardArmor:42, backingArmor:2, weightKg: 4.0,
    desc:'Stand-Alone 강철+Paxcon / 약 12~15mm / 무겁고 스폴 위험' },
  plate_sapi: { id:'plate_sapi', name:'SAPI Ballistic Plate', shortName:'SAPI',
    factionType:'western', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'aramid',
    hardArmor:51, backingArmor:5, weightKg: 2.5,
    desc:'ICW SAPI 세라믹 / 약 19~20mm / 외부 소프트백커 필요' },
  plate_esapi: { id:'plate_esapi', name:'ESAPI Ballistic Plate', shortName:'ESAPI',
    factionType:'western', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:59, backingArmor:5, weightKg: 2.8,
    desc:'ICW ESAPI 세라믹 / 약 22~25mm / SAPI보다 고방호 / 백커 필요' },
  plate_xsapi: { id:'plate_xsapi', name:'XSAPI Ballistic Plate', shortName:'XSAPI',
    factionType:'western', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:68, backingArmor:7, weightKg: 3.3,
    desc:'ICW XSAPI 최상위 세라믹 / 약 25~28mm / 높은 백커 요구' },
  // 서방 side
  plate_ssapi: { id:'plate_ssapi', name:'SSAPI Side Ballistic Plate', shortName:'SSAPI',
    factionType:'western', slotType:'side',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'aramid',
    hardArmor:48, backingArmor:4, weightKg: 1.6,
    desc:'ICW Side SAPI 측면 세라믹 / 약 19~20mm / 백커 필요' },
  plate_esbi: { id:'plate_esbi', name:'ESBI Side Ballistic Plate', shortName:'ESBI',
    factionType:'western', slotType:'side',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:56, backingArmor:5, weightKg: 2.0,
    desc:'ICW ESBI 측면 세라믹 / 약 22~25mm / SSAPI보다 고성능 / 백커 필요' },

  // === 러시아제 / Universal 일반 frontBack ===
  plate_granit_br4: { id:'plate_granit_br4', name:'Granit Br4 Ballistic Plate', shortName:'Granit Br4',
    factionType:'russian', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'aramid',
    hardArmor:51, backingArmor:5, weightKg: 2.7,
    desc:'ICW 러시아식 세라믹복합 / 약 15mm / 외부 소프트백커 필요' },
  plate_granit_br5: { id:'plate_granit_br5', name:'Granit Br5 Ballistic Plate', shortName:'Granit Br5',
    factionType:'russian', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:62, backingArmor:6, weightKg: 3.1,
    desc:'ICW 러시아식 고성능 세라믹복합 / 약 18~20mm / 백커 필요' },
  plate_granit_side: { id:'plate_granit_side', name:'Granit Ballistic Plate Side', shortName:'Granit Side',
    factionType:'russian', slotType:'side',
    incompatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:55, backingArmor:5, weightKg: 2.3,
    desc:'ICW 러시아식 측면 세라믹복합 / 약 15~20mm / 백커 필요' },

  // === 6B23 전용 플레이트 ===
  plate_6b12: { id:'plate_6b12', name:'6B12 Ballistic Plates', shortName:'6B12',
    factionType:'russian', slotType:'frontSet',
    compatibleArmorIds:['armor_6b23_test'],
    material:'steel', backingMaterial:'aramid',
    hardArmor:38, backingArmor:3, weightKg: 4.2,
    desc:'ICW 구형 러시아 장갑강판 / 약 10~12mm / 둔상·스폴 위험 / 백커 필요' },
  plate_korund_vm_front: { id:'plate_korund_vm_front', name:'Korund-VM Ballistic Plates', shortName:'Korund-VM',
    factionType:'russian', slotType:'frontSet',
    compatibleArmorIds:['armor_6b23_test'],
    material:'steel', backingMaterial:'aramid',
    hardArmor:48, backingArmor:3, weightKg: 4.6,
    desc:'ICW Korund VM 전면 강판 / 약 6~8mm / 매우 얇음 / 백커 필요' },
  plate_korund_vm_back: { id:'plate_korund_vm_back', name:'Korund-VM Back Ballistic Plate', shortName:'Korund-VM Back',
    factionType:'russian', slotType:'back',
    compatibleArmorIds:['armor_6b23_test'],
    material:'steel', backingMaterial:'aramid',
    hardArmor:47, backingArmor:3, weightKg: 2.4,
    desc:'ICW Korund VM 후면 강판 / 약 6~8mm / 백커 필요' },
  plate_korund_vm_k_front: { id:'plate_korund_vm_k_front', name:'Korund-VM-K Ballistic Plates', shortName:'Korund-VM-K',
    factionType:'russian', slotType:'frontSet',
    compatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:56, backingArmor:5, weightKg: 4.1,
    desc:'ICW Korund VM-K 전면 세라믹복합 / 약 15mm / 백커 필요' },
  plate_korund_vm_k_back: { id:'plate_korund_vm_k_back', name:'Korund-VM-K Back Ballistic Plate', shortName:'Korund-VM-K Back',
    factionType:'russian', slotType:'back',
    compatibleArmorIds:['armor_6b23_test'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:56, backingArmor:5, weightKg: 2.2,
    desc:'ICW Korund VM-K 후면 세라믹복합 / 약 15mm / 백커 필요' },

  // =====================================================
  // 상용 플레이트 (commercial) — 일반 plate carrier 호환
  //   6B23 / Police Vest와는 호환 X.
  //   front/back 슬롯에 자유롭게 장착 가능.
  // =====================================================

  // ----- 고방호 Level IV 계열 -----
  plate_highcom_4s17m: { id:'plate_highcom_4s17m', name:'HighCom Guardian 4S17M', shortName:'4S17M',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:50, backingArmor:14, weightKg: 3.25,
    desc:'Stand-Alone 세라믹+UHMWPE / 약 23mm / 자체 백커' },

  plate_highcom_4sas7: { id:'plate_highcom_4sas7', name:'HighCom Guardian 4SAS7', shortName:'4SAS7',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'aramid',
    hardArmor:51, backingArmor:15, weightKg: 2.90,
    desc:'Stand-Alone 세라믹+Kevlar / 약 19mm / 자체 백커' },

  plate_hesco_4400: { id:'plate_hesco_4400', name:'Hesco 4400', shortName:'HESCO 4400',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:50, backingArmor:14, weightKg: 3.70,
    desc:'Stand-Alone Lv IV 세라믹+UHMWPE / 약 23mm' },

  plate_hesco_4800: { id:'plate_hesco_4800', name:'Hesco 4800', shortName:'HESCO 4800',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:51, backingArmor:16, weightKg: 2.60,
    desc:'Stand-Alone 경량 탄화붕소+UHMWPE / 약 17mm' },

  plate_rma_1155: { id:'plate_rma_1155', name:'RMA 1155 Level IV Plate', shortName:'RMA 1155',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:51, backingArmor:12, weightKg: 3.00,
    desc:'Stand-Alone Lv IV 알루미나+고밀도 UHMWPE / 약 25mm' },

  plate_ltc_26605: { id:'plate_ltc_26605', name:'LTC 26605', shortName:'LTC 26605',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'composite',
    hardArmor:52, backingArmor:16, weightKg: 2.80,
    desc:'Stand-Alone 고성능 세라믹 / 약 25mm' },

  // ----- 중간급 / Class 3~5 계열 -----
  plate_pe_level3: { id:'plate_pe_level3', name:'UHMWPE Level III Plate', shortName:'PE III',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'pe', backingMaterial:'pe',
    hardArmor:32, backingArmor:16, weightKg: 1.40,
    desc:'Stand-Alone UHMWPE Lv III / 약 25~30mm bulky' },

  plate_highcom_3s9: { id:'plate_highcom_3s9', name:'HighCom Guardian 3S9', shortName:'3S9',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:42, backingArmor:15, weightKg: 2.35,
    desc:'Stand-Alone Lv III++ 세라믹복합+두꺼운 UHMWPE / 약 29mm bulky' },

  plate_highcom_3s9m: { id:'plate_highcom_3s9m', name:'HighCom Guardian 3S9M', shortName:'3S9M',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:43, backingArmor:16, weightKg: 2.55,
    desc:'Stand-Alone Lv III++ 세라믹복합+UHMWPE / 약 29mm bulky' },

  plate_rma_1092_gen2: { id:'plate_rma_1092_gen2', name:'RMA 1092 Gen2 RF2', shortName:'RMA 1092',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'ceramic', backingMaterial:'pe',
    hardArmor:43, backingArmor:16, weightKg: 2.45,
    desc:'Stand-Alone Lv III+ 알루미나+초고밀도 UHMWPE / 약 30mm bulky' },

  plate_mantis_titanium: { id:'plate_mantis_titanium', name:'Adept Armor Mantis Titanium Armor Plate', shortName:'Mantis Ti',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'titanium', backingMaterial:'pe',
    hardArmor:46, backingArmor:5, weightKg: 2.47,
    desc:'Stand-Alone 티타늄합금+열가소성폼 / 약 15~19mm' },

  // ----- 금속계 경량 강철 -----
  plate_ar500_light: { id:'plate_ar500_light', name:'AR500 Lightweight Steel Plate', shortName:'AR500 Light',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'steel', backingMaterial:'aramid',
    hardArmor:41, backingArmor:2, weightKg: 3.30,
    desc:'경량형 강철+Paxcon / 약 12~15mm' },

  // ----- 레플리카 플레이트 (방호 거의 없음) -----
  plate_replica_foam_sapi: { id:'plate_replica_foam_sapi', name:'Replica Foam SAPI Plate', shortName:'Foam SAPI',
    factionType:'replica', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'fabric', backingMaterial:'fabric',
    hardArmor:1, backingArmor:0, weightKg: 0.20,
    desc:'Training/Replica / 실질 방호 없음' },

  plate_replica_plastic_sapi: { id:'plate_replica_plastic_sapi', name:'Replica Plastic SAPI Plate', shortName:'Plastic SAPI',
    factionType:'replica', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'fabric', backingMaterial:'fabric',
    hardArmor:2, backingArmor:0, weightKg: 0.60,
    desc:'Training/Replica / 실질 방호 없음' },

  // ----- 민수용 IIIA / III 플레이트 -----
  plate_civ_iiia_soft: { id:'plate_civ_iiia_soft', name:'Civilian IIIA Soft Insert', shortName:'IIIA Soft',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'aramid', backingMaterial:'aramid',
    hardArmor:30, backingArmor:5, weightKg: 0.85,
    desc:'Soft Insert / IIIA급 소프트 삽입재 / soft armor 보강' },

  plate_civ_iiia_hard: { id:'plate_civ_iiia_hard', name:'Civilian IIIA Hard Plate', shortName:'IIIA Hard',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'pe', backingMaterial:'aramid',
    hardArmor:31, backingArmor:5, weightKg: 1.25,
    desc:'Soft Insert / IIIA급 준하드 삽입재 / soft armor 보강' },

  plate_civ_pe_level3: { id:'plate_civ_pe_level3', name:'Civilian PE Level III Plate', shortName:'Civ PE III',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'pe', backingMaterial:'pe',
    hardArmor:31, backingArmor:15, weightKg: 1.40,
    desc:'민수 UHMWPE Lv III / 약 25~30mm bulky' },

  plate_civ_steel_level3: { id:'plate_civ_steel_level3', name:'Civilian Steel Level III Plate', shortName:'Steel III',
    factionType:'commercial', slotType:'frontBack',
    incompatibleArmorIds:['armor_6b23_test', 'police_vest'],
    material:'steel', backingMaterial:'aramid',
    hardArmor:41, backingArmor:2, weightKg: 3.30,
    desc:'민수 강철 Lv III / 약 12~15mm' },
};

// =============================================================
// maxDurability — 장비별 내구도 최대치 일괄 적용
// =============================================================
const LEGACY_PLATE_MAX_DURABILITY_MANUAL = {   // 2A-6.0: 수동 백업
  plate_ar500: 60, plate_sapi: 55, plate_esapi: 60, plate_xsapi: 65,
  plate_ssapi: 28, plate_esbi: 32,
  plate_granit_br4: 55, plate_granit_br5: 60, plate_granit_side: 36,
  plate_6b12: 58,
  plate_korund_vm_front: 62, plate_korund_vm_back: 40,
  plate_korund_vm_k_front: 60, plate_korund_vm_k_back: 38,
  // 상용 플레이트 (commercial)
  plate_highcom_4s17m: 58, plate_highcom_4sas7: 58,
  plate_hesco_4400: 60, plate_hesco_4800: 58,
  plate_rma_1155: 56, plate_ltc_26605: 58,
  plate_pe_level3: 55, plate_highcom_3s9: 54, plate_highcom_3s9m: 56,
  plate_rma_1092_gen2: 57, plate_mantis_titanium: 62, plate_ar500_light: 60,
  // 레플리카 / 민수용
  plate_replica_foam_sapi: 10, plate_replica_plastic_sapi: 15,
  plate_civ_iiia_soft: 40, plate_civ_iiia_hard: 40,
  plate_civ_pe_level3: 55, plate_civ_steel_level3: 60,
};
for (const id in LEGACY_PLATE_MAX_DURABILITY_MANUAL) {
  if (LEGACY_PLATE_PRESETS_MANUAL[id]) LEGACY_PLATE_PRESETS_MANUAL[id].maxDurability = LEGACY_PLATE_MAX_DURABILITY_MANUAL[id];
}

// =============================================================
// 2A-6.0: PLATE REGISTRY (방탄 플레이트 source of truth)
//   실제 방호/피격/방호범위/AAR은 여전히 PLATE_PRESETS를 읽는다. registry는 원본.
//   새 플레이트 추가 시 이 registry 한 곳만 작성 → PLATE_PRESETS + maxDurability 자동 생성.
//   새 플레이트 템플릿:
//     'id': {
//       id, display:{name,shortName,desc,group,tableOrder},
//       plate:{factionType,slotType,isNone},                      // slotType: frontBack/side/frontSet/back
//       armor:{material,backingMaterial,hardArmor,backingArmor},   // none이면 material:null,hardArmor:0
//       durability:{maxDurability},                                // none이면 생략 가능
//       physical:{weightKg},
//       compatibility:{compatibleArmorIds,incompatibleArmorIds},   // 6B23 전용은 compatibleArmorIds 사용
//       visual:{plateShape,visualRole,notes},                      // (선택) 향후 확장용
//       ui:{showInPlateSelector,notes},
//     }
// =============================================================
const PLATE_REGISTRY_GROUPS = {
  'None':       { label:'없음',   tableOrder: 5 },
  'Western':    { label:'서방제', tableOrder: 10 },
  'Russian':    { label:'러시아', tableOrder: 20 },
  'Commercial': { label:'상용',   tableOrder: 30 },
  'Replica':    { label:'레플리카/민수', tableOrder: 40 },
};
const PLATE_REGISTRY = {
  'no_front_plate': {
    id:'no_front_plate',
    display:{ name:'No Front Plate', shortName:'없음', desc:'전면 플레이트 없음', group:'None', tableOrder:1 },
    plate:{ factionType:'none', slotType:'frontBack', isNone:true },
    armor:{ material:null, hardArmor:0 },
    physical:{ weightKg:0 },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'none', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:0, thicknessMinMm:0, thicknessMaxMm:0, bulkClass:'none' },
    materialStack:{ strikeFace:'none', core:'none', backer:'none', coating:'none' },
  },
  'no_back_plate': {
    id:'no_back_plate',
    display:{ name:'No Back Plate', shortName:'없음', desc:'후면 플레이트 없음', group:'None', tableOrder:2 },
    plate:{ factionType:'none', slotType:'frontBack', isNone:true },
    armor:{ material:null, hardArmor:0 },
    physical:{ weightKg:0 },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'none', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:0, thicknessMinMm:0, thicknessMaxMm:0, bulkClass:'none' },
    materialStack:{ strikeFace:'none', core:'none', backer:'none', coating:'none' },
  },
  'no_side_plate': {
    id:'no_side_plate',
    display:{ name:'No Side Plate', shortName:'없음', desc:'측면 플레이트 없음', group:'None', tableOrder:3 },
    plate:{ factionType:'none', slotType:'side', isNone:true },
    armor:{ material:null, hardArmor:0 },
    physical:{ weightKg:0 },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'none', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:0, thicknessMinMm:0, thicknessMaxMm:0, bulkClass:'none' },
    materialStack:{ strikeFace:'none', core:'none', backer:'none', coating:'none' },
  },
  'plate_ar500': {
    id:'plate_ar500',
    display:{ name:'AR500 Ballistic Plate', shortName:'AR500', desc:'Stand-Alone 강철+Paxcon / 약 12~15mm / 무겁고 스폴 위험', group:'Western', tableOrder:4 },
    plate:{ factionType:'western', slotType:'frontBack' },
    armor:{ material:'steel', backingMaterial:'aramid', hardArmor:42, backingArmor:2 },
    durability:{ maxDurability:76 },
    physical:{ weightKg:4 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:14, thicknessMinMm:12, thicknessMaxMm:15, bulkClass:'thin' },
    materialStack:{ strikeFace:'hardened_steel', core:'armor_steel', backer:'none_or_minimal', coating:'paxcon_polyurea' },
  },
  'plate_sapi': {
    id:'plate_sapi',
    display:{ name:'SAPI Ballistic Plate', shortName:'SAPI', desc:'ICW SAPI 세라믹 / 약 19~20mm / 외부 소프트백커 필요', group:'Western', tableOrder:5 },
    plate:{ factionType:'western', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'aramid', hardArmor:51, backingArmor:5 },
    durability:{ maxDurability:46 },
    physical:{ weightKg:2.5 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:18, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:20, thicknessMinMm:19, thicknessMaxMm:20, bulkClass:'standard' },
    materialStack:{ strikeFace:'alumina_or_silicon_carbide_ceramic', core:'ceramic', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_esapi': {
    id:'plate_esapi',
    display:{ name:'ESAPI Ballistic Plate', shortName:'ESAPI', desc:'ICW ESAPI 세라믹 / 약 22~25mm / SAPI보다 고방호 / 백커 필요', group:'Western', tableOrder:6 },
    plate:{ factionType:'western', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:59, backingArmor:5 },
    durability:{ maxDurability:52 },
    physical:{ weightKg:2.8 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:22, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:24, thicknessMinMm:22, thicknessMaxMm:25, bulkClass:'standard' },
    materialStack:{ strikeFace:'boron_carbide_or_advanced_ceramic', core:'advanced_ceramic', backer:'high_density_plastic_fiber', coating:'fabric_wrap' },
  },
  'plate_xsapi': {
    id:'plate_xsapi',
    display:{ name:'XSAPI Ballistic Plate', shortName:'XSAPI', desc:'ICW XSAPI 최상위 세라믹 / 약 25~28mm / 높은 백커 요구', group:'Western', tableOrder:7 },
    plate:{ factionType:'western', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:68, backingArmor:7 },
    durability:{ maxDurability:58 },
    physical:{ weightKg:3.3 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:24, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:27, thicknessMinMm:25, thicknessMaxMm:28, bulkClass:'thick' },
    materialStack:{ strikeFace:'boron_carbide_or_silicon_carbide_ceramic', core:'advanced_ceramic', backer:'thin_composite_backing_layer', coating:'fabric_wrap' },
  },
  'plate_colossus': {
    id:'plate_colossus',
    display:{ name:'Adept Colossus', shortName:'Colossus', desc:'SiC-TiB₂ 복합 세라믹 + 내장 UHMWPE 백커 standalone 최상위 하드플레이트 / 약 30mm / XSAPI급 이상 / 두껍고 무거움', group:'Western', tableOrder:7.5 },
    plate:{ factionType:'western', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:64, backingArmor:15 },
    durability:{ maxDurability:64 },
    physical:{ weightKg:3.27 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:30, thicknessMinMm:30, thicknessMaxMm:30, bulkClass:'bulky' },
    materialStack:{ strikeFace:'sic_tib2_composite_ceramic', core:'sic_tib2_composite_ceramic', backer:'uhmwpe', coating:'fabric_wrap' },
  },
  'plate_ssapi': {
    id:'plate_ssapi',
    display:{ name:'SSAPI Side Ballistic Plate', shortName:'SSAPI', desc:'ICW Side SAPI 측면 세라믹 / 약 19~20mm / 백커 필요', group:'Western', tableOrder:8 },
    plate:{ factionType:'western', slotType:'side' },
    armor:{ material:'ceramic', backingMaterial:'aramid', hardArmor:48, backingArmor:4 },
    durability:{ maxDurability:28 },
    physical:{ weightKg:1.6 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:18, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:20, thicknessMinMm:19, thicknessMaxMm:20, bulkClass:'standard' },
    materialStack:{ strikeFace:'alumina_or_silicon_carbide_ceramic', core:'ceramic', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_esbi': {
    id:'plate_esbi',
    display:{ name:'ESBI Side Ballistic Plate', shortName:'ESBI', desc:'ICW ESBI 측면 세라믹 / 약 22~25mm / SSAPI보다 고성능 / 백커 필요', group:'Western', tableOrder:9 },
    plate:{ factionType:'western', slotType:'side' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:56, backingArmor:5 },
    durability:{ maxDurability:32 },
    physical:{ weightKg:2 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:22, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:24, thicknessMinMm:22, thicknessMaxMm:25, bulkClass:'standard' },
    materialStack:{ strikeFace:'boron_carbide_or_advanced_ceramic', core:'advanced_ceramic', backer:'high_density_plastic_fiber', coating:'fabric_wrap' },
  },
  'plate_colossus_side': {
    id:'plate_colossus_side',
    display:{ name:'Adept Colossus Side Plate', shortName:'Colossus Side', desc:'Colossus 계열 standalone 측면 하드플레이트 / SiC-TiB₂ 세라믹 + 내장 UHMWPE 백커 / 약 30mm / XSAPI급', group:'Western', tableOrder:9.5 },
    plate:{ factionType:'western', slotType:'side' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:60, backingArmor:15 },
    durability:{ maxDurability:40 },
    physical:{ weightKg:1.35 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:30, thicknessMinMm:30, thicknessMaxMm:30, bulkClass:'bulky' },
    materialStack:{ strikeFace:'sic_tib2_composite_ceramic', core:'sic_tib2_composite_ceramic', backer:'uhmwpe', coating:'fabric_wrap' },
  },
  'plate_granit_br4': {
    id:'plate_granit_br4',
    display:{ name:'Granit Br4 Ballistic Plate', shortName:'Granit Br4', desc:'ICW 러시아식 세라믹복합 / 약 15mm / 외부 소프트백커 필요', group:'Russian', tableOrder:10 },
    plate:{ factionType:'russian', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'aramid', hardArmor:51, backingArmor:5 },
    durability:{ maxDurability:48 },
    physical:{ weightKg:2.7 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:18, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:15, thicknessMinMm:15, thicknessMaxMm:15, bulkClass:'thin' },
    materialStack:{ strikeFace:'aluminum_oxide_or_silicon_carbide_ceramic', core:'ceramic_composite', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_granit_br5': {
    id:'plate_granit_br5',
    display:{ name:'Granit Br5 Ballistic Plate', shortName:'Granit Br5', desc:'ICW 러시아식 고성능 세라믹복합 / 약 18~20mm / 백커 필요', group:'Russian', tableOrder:11 },
    plate:{ factionType:'russian', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:62, backingArmor:6 },
    durability:{ maxDurability:52 },
    physical:{ weightKg:3.1 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:22, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:19, thicknessMinMm:18, thicknessMaxMm:20, bulkClass:'standard' },
    materialStack:{ strikeFace:'high_density_ceramic', core:'boron_carbide_or_equivalent_ceramic', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_granit_side': {
    id:'plate_granit_side',
    display:{ name:'Granit Ballistic Plate Side', shortName:'Granit Side', desc:'ICW 러시아식 측면 세라믹복합 / 약 15~20mm / 백커 필요', group:'Russian', tableOrder:12 },
    plate:{ factionType:'russian', slotType:'side' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:55, backingArmor:5 },
    durability:{ maxDurability:36 },
    physical:{ weightKg:2.3 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:20, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:18, thicknessMinMm:15, thicknessMaxMm:20, bulkClass:'standard' },
    materialStack:{ strikeFace:'ceramic_composite', core:'ceramic_composite', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_6b12': {
    id:'plate_6b12',
    display:{ name:'6B12 Ballistic Plates', shortName:'6B12', desc:'ICW 구형 러시아 장갑강판 / 약 10~12mm / 둔상·스폴 위험 / 백커 필요', group:'Russian', tableOrder:13 },
    plate:{ factionType:'russian', slotType:'frontSet' },
    armor:{ material:'steel', backingMaterial:'aramid', hardArmor:38, backingArmor:3 },
    durability:{ maxDurability:66, frontSetSlotMax:{ chest_front_hard:44, abdomen_front_hard:28 } },
    physical:{ weightKg:4.2 },
    compatibility:{ compatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:18, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:11, thicknessMinMm:10, thicknessMaxMm:12, bulkClass:'thin' },
    materialStack:{ strikeFace:'armor_steel', core:'steel', backer:'none_or_fabric_liner', coating:'painted_or_fabric_wrap' },
  },
  'plate_korund_vm_front': {
    id:'plate_korund_vm_front',
    display:{ name:'Korund-VM Ballistic Plates', shortName:'Korund-VM', desc:'ICW Korund VM 전면 강판 / 약 6~8mm / 매우 얇음 / 백커 필요', group:'Russian', tableOrder:14 },
    plate:{ factionType:'russian', slotType:'frontSet' },
    armor:{ material:'steel', backingMaterial:'aramid', hardArmor:48, backingArmor:3 },
    durability:{ maxDurability:70, frontSetSlotMax:{ chest_front_hard:46, abdomen_front_hard:30 } },
    physical:{ weightKg:4.6 },
    compatibility:{ compatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:18, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:7, thicknessMinMm:6, thicknessMaxMm:8, bulkClass:'ultraThin' },
    materialStack:{ strikeFace:'special_armor_steel', core:'steel', backer:'none_or_fabric_liner', coating:'painted_or_fabric_wrap' },
  },
  'plate_korund_vm_back': {
    id:'plate_korund_vm_back',
    display:{ name:'Korund-VM Back Ballistic Plate', shortName:'Korund-VM Back', desc:'ICW Korund VM 후면 강판 / 약 6~8mm / 백커 필요', group:'Russian', tableOrder:15 },
    plate:{ factionType:'russian', slotType:'back' },
    armor:{ material:'steel', backingMaterial:'aramid', hardArmor:47, backingArmor:3 },
    durability:{ maxDurability:44 },
    physical:{ weightKg:2.4 },
    compatibility:{ compatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:18, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:7, thicknessMinMm:6, thicknessMaxMm:8, bulkClass:'ultraThin' },
    materialStack:{ strikeFace:'special_armor_steel', core:'steel', backer:'none_or_fabric_liner', coating:'painted_or_fabric_wrap' },
  },
  'plate_korund_vm_k_front': {
    id:'plate_korund_vm_k_front',
    display:{ name:'Korund-VM-K Ballistic Plates', shortName:'Korund-VM-K', desc:'ICW Korund VM-K 전면 세라믹복합 / 약 15mm / 백커 필요', group:'Russian', tableOrder:16 },
    plate:{ factionType:'russian', slotType:'frontSet' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:56, backingArmor:5 },
    durability:{ maxDurability:52, frontSetSlotMax:{ chest_front_hard:40, abdomen_front_hard:26 } },
    physical:{ weightKg:4.1 },
    compatibility:{ compatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:22, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:15, thicknessMinMm:15, thicknessMaxMm:15, bulkClass:'thin' },
    materialStack:{ strikeFace:'alumina_ceramic', core:'ceramic_composite', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_korund_vm_k_back': {
    id:'plate_korund_vm_k_back',
    display:{ name:'Korund-VM-K Back Ballistic Plate', shortName:'Korund-VM-K Back', desc:'ICW Korund VM-K 후면 세라믹복합 / 약 15mm / 백커 필요', group:'Russian', tableOrder:17 },
    plate:{ factionType:'russian', slotType:'back' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:56, backingArmor:5 },
    durability:{ maxDurability:38 },
    physical:{ weightKg:2.2 },
    compatibility:{ compatibleArmorIds:['armor_6b23_test'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'icw', requiresSoftBacker:true, hasIntegralBacker:false, minBackerArmor:22, backerContributionMode:'required', secondaryBackerMode:'full' },
    thickness:{ thicknessMm:15, thicknessMinMm:15, thicknessMaxMm:15, bulkClass:'thin' },
    materialStack:{ strikeFace:'alumina_ceramic', core:'ceramic_composite', backer:'structural_composite', coating:'fabric_wrap' },
  },
  'plate_highcom_4s17m': {
    id:'plate_highcom_4s17m',
    display:{ name:'HighCom Guardian 4S17M', shortName:'4S17M', desc:'Stand-Alone 세라믹+UHMWPE / 약 23mm / 자체 백커', group:'Commercial', tableOrder:18 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:50, backingArmor:14 },
    durability:{ maxDurability:50 },
    physical:{ weightKg:3.25 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:23, thicknessMinMm:22, thicknessMaxMm:23, bulkClass:'standard' },
    materialStack:{ strikeFace:'aluminum_oxide_ceramic', core:'ceramic', backer:'UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_highcom_4sas7': {
    id:'plate_highcom_4sas7',
    display:{ name:'HighCom Guardian 4SAS7', shortName:'4SAS7', desc:'Stand-Alone 세라믹+Kevlar / 약 19mm / 자체 백커', group:'Commercial', tableOrder:19 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'aramid', hardArmor:51, backingArmor:15 },
    durability:{ maxDurability:50 },
    physical:{ weightKg:2.9 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:19, thicknessMinMm:19, thicknessMaxMm:19, bulkClass:'standard' },
    materialStack:{ strikeFace:'aluminum_oxide_ceramic', core:'ceramic', backer:'aramid_kevlar', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_hesco_4400': {
    id:'plate_hesco_4400',
    display:{ name:'Hesco 4400', shortName:'HESCO 4400', desc:'Stand-Alone Lv IV 세라믹+UHMWPE / 약 23mm', group:'Commercial', tableOrder:20 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:50, backingArmor:14 },
    durability:{ maxDurability:52 },
    physical:{ weightKg:3.7 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:23, thicknessMinMm:22, thicknessMaxMm:23, bulkClass:'standard' },
    materialStack:{ strikeFace:'ceramic', core:'ceramic_composite', backer:'UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_hesco_4800': {
    id:'plate_hesco_4800',
    display:{ name:'Hesco 4800', shortName:'HESCO 4800', desc:'Stand-Alone 경량 탄화붕소+UHMWPE / 약 17mm', group:'Commercial', tableOrder:21 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:51, backingArmor:16 },
    durability:{ maxDurability:50 },
    physical:{ weightKg:2.6 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:17, thicknessMinMm:17, thicknessMaxMm:17, bulkClass:'thin' },
    materialStack:{ strikeFace:'boron_carbide_ceramic', core:'advanced_ceramic', backer:'UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_rma_1155': {
    id:'plate_rma_1155',
    display:{ name:'RMA 1155 Level IV Plate', shortName:'RMA 1155', desc:'Stand-Alone Lv IV 알루미나+고밀도 UHMWPE / 약 25mm', group:'Commercial', tableOrder:22 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:51, backingArmor:12 },
    durability:{ maxDurability:48 },
    physical:{ weightKg:3 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:25, thicknessMinMm:25, thicknessMaxMm:25, bulkClass:'thick' },
    materialStack:{ strikeFace:'aluminum_oxide_ceramic', core:'ceramic', backer:'high_density_UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_ltc_26605': {
    id:'plate_ltc_26605',
    display:{ name:'LTC 26605', shortName:'LTC 26605', desc:'Stand-Alone 고성능 세라믹 / 약 25mm', group:'Commercial', tableOrder:23 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'composite', hardArmor:52, backingArmor:16 },
    durability:{ maxDurability:50 },
    physical:{ weightKg:2.8 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:25, thicknessMinMm:25, thicknessMaxMm:25, bulkClass:'thick' },
    materialStack:{ strikeFace:'aluminum_oxide_ceramic', core:'ceramic', backer:'aramid_PE_composite', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_pe_level3': {
    id:'plate_pe_level3',
    display:{ name:'UHMWPE Level III Plate', shortName:'PE III', desc:'Stand-Alone UHMWPE Lv III / 약 25~30mm bulky', group:'Commercial', tableOrder:24 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'pe', backingMaterial:'pe', hardArmor:32, backingArmor:16 },
    durability:{ maxDurability:55 },
    physical:{ weightKg:1.4 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:28, thicknessMinMm:25, thicknessMaxMm:30, bulkClass:'bulky' },
    materialStack:{ strikeFace:'UHMWPE', core:'compressed_UHMWPE', backer:'UHMWPE', coating:'polymer_wrap' },
  },
  'plate_highcom_3s9': {
    id:'plate_highcom_3s9',
    display:{ name:'HighCom Guardian 3S9', shortName:'3S9', desc:'Stand-Alone Lv III++ 세라믹복합+두꺼운 UHMWPE / 약 29mm bulky', group:'Commercial', tableOrder:25 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:42, backingArmor:15 },
    durability:{ maxDurability:46 },
    physical:{ weightKg:2.35 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:29, thicknessMinMm:29, thicknessMaxMm:29, bulkClass:'bulky' },
    materialStack:{ strikeFace:'ceramic_composite', core:'ceramic_composite', backer:'thick_UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_highcom_3s9m': {
    id:'plate_highcom_3s9m',
    display:{ name:'HighCom Guardian 3S9M', shortName:'3S9M', desc:'Stand-Alone Lv III++ 세라믹복합+UHMWPE / 약 29mm bulky', group:'Commercial', tableOrder:26 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:43, backingArmor:16 },
    durability:{ maxDurability:48 },
    physical:{ weightKg:2.55 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:29, thicknessMinMm:29, thicknessMaxMm:29, bulkClass:'bulky' },
    materialStack:{ strikeFace:'ceramic_composite', core:'ceramic_composite', backer:'thick_UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_rma_1092_gen2': {
    id:'plate_rma_1092_gen2',
    display:{ name:'RMA 1092 Gen2 RF2', shortName:'RMA 1092', desc:'Stand-Alone Lv III+ 알루미나+초고밀도 UHMWPE / 약 30mm bulky', group:'Commercial', tableOrder:27 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'ceramic', backingMaterial:'pe', hardArmor:43, backingArmor:16 },
    durability:{ maxDurability:50 },
    physical:{ weightKg:2.45 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:30, thicknessMinMm:30, thicknessMaxMm:30, bulkClass:'bulky' },
    materialStack:{ strikeFace:'alumina_ceramic', core:'ceramic', backer:'ultra_high_density_UHMWPE', coating:'fabric_wrap_or_polyurea_optional' },
  },
  'plate_mantis_titanium': {
    id:'plate_mantis_titanium',
    display:{ name:'Adept Armor Mantis Titanium Armor Plate', shortName:'Mantis Ti', desc:'Stand-Alone 티타늄합금+열가소성폼 / 약 15~19mm', group:'Commercial', tableOrder:28 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'titanium', backingMaterial:'pe', hardArmor:46, backingArmor:5 },
    durability:{ maxDurability:62 },
    physical:{ weightKg:2.47 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:17, thicknessMinMm:15, thicknessMaxMm:19, bulkClass:'thin' },
    materialStack:{ strikeFace:'titanium_alloy', core:'titanium_alloy', backer:'thermoplastic_foam', coating:'protective_wrap' },
  },
  'plate_ar500_light': {
    id:'plate_ar500_light',
    display:{ name:'AR500 Lightweight Steel Plate', shortName:'AR500 Light', desc:'경량형 강철+Paxcon / 약 12~15mm', group:'Commercial', tableOrder:29 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'steel', backingMaterial:'aramid', hardArmor:41, backingArmor:2 },
    durability:{ maxDurability:68 },
    physical:{ weightKg:3.3 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:13, thicknessMinMm:12, thicknessMaxMm:15, bulkClass:'thin' },
    materialStack:{ strikeFace:'hardened_steel', core:'armor_steel', backer:'none_or_minimal', coating:'paxcon_polyurea' },
  },
  'plate_replica_foam_sapi': {
    id:'plate_replica_foam_sapi',
    display:{ name:'Replica Foam SAPI Plate', shortName:'Foam SAPI', desc:'Training/Replica / 실질 방호 없음', group:'Replica', tableOrder:30 },
    plate:{ factionType:'replica', slotType:'frontBack' },
    armor:{ material:'fabric', backingMaterial:'fabric', hardArmor:1, backingArmor:0 },
    durability:{ maxDurability:10 },
    physical:{ weightKg:0.2 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'training', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:25, thicknessMinMm:20, thicknessMaxMm:30, bulkClass:'training' },
    materialStack:{ strikeFace:'foam', core:'foam', backer:'none', coating:'fabric_or_plastic_skin' },
  },
  'plate_replica_plastic_sapi': {
    id:'plate_replica_plastic_sapi',
    display:{ name:'Replica Plastic SAPI Plate', shortName:'Plastic SAPI', desc:'Training/Replica / 실질 방호 없음', group:'Replica', tableOrder:31 },
    plate:{ factionType:'replica', slotType:'frontBack' },
    armor:{ material:'fabric', backingMaterial:'fabric', hardArmor:2, backingArmor:0 },
    durability:{ maxDurability:15 },
    physical:{ weightKg:0.6 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'training', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:8, thicknessMinMm:6, thicknessMaxMm:10, bulkClass:'training' },
    materialStack:{ strikeFace:'plastic', core:'plastic', backer:'none', coating:'none' },
  },
  'plate_civ_iiia_soft': {
    id:'plate_civ_iiia_soft',
    display:{ name:'Civilian IIIA Soft Insert', shortName:'IIIA Soft', desc:'Soft Insert / IIIA급 소프트 삽입재 / soft armor 보강', group:'Commercial', tableOrder:32 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'aramid', backingMaterial:'aramid', hardArmor:30, backingArmor:5 },
    durability:{ maxDurability:40 },
    physical:{ weightKg:0.85 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'soft_insert', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:8, thicknessMinMm:6, thicknessMaxMm:10, bulkClass:'thin' },
    materialStack:{ strikeFace:'aramid_or_UHMWPE_fabric', core:'soft_ballistic_fabric', backer:'none', coating:'nylon_cover' },
  },
  'plate_civ_iiia_hard': {
    id:'plate_civ_iiia_hard',
    display:{ name:'Civilian IIIA Hard Plate', shortName:'IIIA Hard', desc:'Soft Insert / IIIA급 준하드 삽입재 / soft armor 보강', group:'Commercial', tableOrder:33 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'pe', backingMaterial:'aramid', hardArmor:31, backingArmor:5 },
    durability:{ maxDurability:40 },
    physical:{ weightKg:1.25 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'soft_insert', requiresSoftBacker:false, hasIntegralBacker:false, minBackerArmor:0, backerContributionMode:'none', secondaryBackerMode:'none' },
    thickness:{ thicknessMm:10, thicknessMinMm:8, thicknessMaxMm:12, bulkClass:'thin' },
    materialStack:{ strikeFace:'compressed_UHMWPE_or_hard_ballistic_panel', core:'semi_rigid_ballistic_panel', backer:'aramid_or_UHMWPE', coating:'nylon_cover' },
  },
  'plate_civ_pe_level3': {
    id:'plate_civ_pe_level3',
    display:{ name:'Civilian PE Level III Plate', shortName:'Civ PE III', desc:'민수 UHMWPE Lv III / 약 25~30mm bulky', group:'Commercial', tableOrder:34 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'pe', backingMaterial:'pe', hardArmor:31, backingArmor:15 },
    durability:{ maxDurability:52 },
    physical:{ weightKg:1.4 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:28, thicknessMinMm:25, thicknessMaxMm:30, bulkClass:'bulky' },
    materialStack:{ strikeFace:'UHMWPE', core:'compressed_UHMWPE', backer:'UHMWPE', coating:'polymer_wrap' },
  },
  'plate_civ_steel_level3': {
    id:'plate_civ_steel_level3',
    display:{ name:'Civilian Steel Level III Plate', shortName:'Steel III', desc:'민수 강철 Lv III / 약 12~15mm', group:'Commercial', tableOrder:35 },
    plate:{ factionType:'commercial', slotType:'frontBack' },
    armor:{ material:'steel', backingMaterial:'aramid', hardArmor:41, backingArmor:2 },
    durability:{ maxDurability:68 },
    physical:{ weightKg:3.3 },
    compatibility:{ incompatibleArmorIds:['armor_6b23_test','police_vest'] },
    ui:{ showInPlateSelector:true },
    plateSystem:{ ratingMode:'standalone', requiresSoftBacker:false, hasIntegralBacker:true, minBackerArmor:0, backerContributionMode:'secondary_ballistic_and_trauma', secondaryBackerMode:'limited' },
    thickness:{ thicknessMm:14, thicknessMinMm:12, thicknessMaxMm:15, bulkClass:'thin' },
    materialStack:{ strikeFace:'hardened_steel', core:'armor_steel', backer:'none_or_minimal', coating:'paxcon_polyurea' },
  },
};

// registry 항목 → 기존 PLATE_PRESETS 형태 생성 (섹션 → 플랫). 정의된 필드만 emit.
const _PLATE_FIELD_MAP = {
  name:'display.name', shortName:'display.shortName', desc:'display.desc',
  factionType:'plate.factionType', slotType:'plate.slotType', isNone:'plate.isNone',
  material:'armor.material', backingMaterial:'armor.backingMaterial', hardArmor:'armor.hardArmor', backingArmor:'armor.backingArmor',
  weightKg:'physical.weightKg',
  compatibleArmorIds:'compatibility.compatibleArmorIds', incompatibleArmorIds:'compatibility.incompatibleArmorIds',
  maxDurability:'durability.maxDurability',
};
function buildPlatePresetFromRegistry(entry) {
  if (!entry) return null;
  const out = { id: entry.id };
  for (const f in _PLATE_FIELD_MAP) {
    const [s,k] = _PLATE_FIELD_MAP[f].split('.');
    const v = entry[s] && Object.prototype.hasOwnProperty.call(entry[s], k) ? entry[s][k] : undefined;
    if (v !== undefined) out[f] = Array.isArray(v) ? v.slice() : v;
  }
  // 2A-6.4: 새 메타데이터 — 전체 서브객체를 PLATE_PRESETS에 그대로 전달
  if (entry.plateSystem)  out.plateSystem  = Object.assign({}, entry.plateSystem);
  if (entry.materialStack) out.materialStack = Object.assign({}, entry.materialStack);
  if (entry.thickness) {
    out.thicknessMm    = entry.thickness.thicknessMm;
    out.thicknessMinMm = entry.thickness.thicknessMinMm;
    out.thicknessMaxMm = entry.thickness.thicknessMaxMm;
    out.bulkClass      = entry.thickness.bulkClass;
  }
  // 편의 평탄화 필드 (UI/debug용)
  if (entry.plateSystem) {
    out.ratingMode = entry.plateSystem.ratingMode;
    out.requiresSoftBacker = entry.plateSystem.requiresSoftBacker;
    out.hasIntegralBacker = entry.plateSystem.hasIntegralBacker;
    out.minBackerArmor = entry.plateSystem.minBackerArmor;
    out.backerContributionMode = entry.plateSystem.backerContributionMode;
    out.secondaryBackerMode = entry.plateSystem.secondaryBackerMode;
  }
  // 2A-6.6: 유효방호 파생값 부착 (effectiveArmor = hardArmor + backingArmor). 레지스트리 원본엔 저장 안 함(파생).
  out.effectiveArmor = (out.hardArmor || 0) + (out.backingArmor || 0);
  // SIDE-KORUND-FRONTSET §3.3: frontSet slot별 내구도 분리 필드 보존
  if (entry.durability && entry.durability.frontSetSlotMax) out.frontSetSlotMax = Object.assign({}, entry.durability.frontSetSlotMax);
  if (entry.durability && entry.durability.slotMax) out.slotMax = Object.assign({}, entry.durability.slotMax);
  return out;
}
function buildLegacyPlatePresetsFromRegistry() {
  const out = {};
  for (const id in PLATE_REGISTRY) out[id] = buildPlatePresetFromRegistry(PLATE_REGISTRY[id]);
  return out;
}
function buildPlateMaxDurabilityFromRegistry() {
  const out = {};
  for (const id in PLATE_REGISTRY) { const d = PLATE_REGISTRY[id].durability && PLATE_REGISTRY[id].durability.maxDurability; if (d !== undefined) out[id] = d; }
  return out;
}

// =============================================================
// 2A-6.0: PLATE SOURCE SWITCH
//   true  → PLATE_PRESETS / PLATE_MAX_DURABILITY = registry 생성
//   false → manual 백업 사용
//   const 참조 유지, 내용만 in-place 교체.
// =============================================================
const USE_PLATE_REGISTRY_AS_SOURCE = true;
const PLATE_PRESETS = {};
const PLATE_MAX_DURABILITY = {};
(function _switchPlateSource() {
  function replaceInPlace(t, s) { for (const k in t) delete t[k]; Object.assign(t, s); }
  function manualFallback() {
    replaceInPlace(PLATE_PRESETS, LEGACY_PLATE_PRESETS_MANUAL);
    replaceInPlace(PLATE_MAX_DURABILITY, LEGACY_PLATE_MAX_DURABILITY_MANUAL);
  }
  try {
    if (USE_PLATE_REGISTRY_AS_SOURCE) {
      const presets = buildLegacyPlatePresetsFromRegistry();
      const dur = buildPlateMaxDurabilityFromRegistry();
      // maxDurability 주입 (기존 apply loop과 동일 의미)
      for (const id in dur) if (presets[id]) presets[id].maxDurability = dur[id];
      // registry에 없고 manual에만 있는 플레이트(있다면) 보존
      for (const id in LEGACY_PLATE_PRESETS_MANUAL) if (!presets[id]) presets[id] = LEGACY_PLATE_PRESETS_MANUAL[id];
      replaceInPlace(PLATE_PRESETS, presets);
      replaceInPlace(PLATE_MAX_DURABILITY, dur);
    } else {
      manualFallback();
    }
    if (typeof console !== 'undefined') console.log(`[PlateSource] source=${USE_PLATE_REGISTRY_AS_SOURCE?'PLATE_REGISTRY':'manual'} (${Object.keys(PLATE_PRESETS).length}종 / maxDur ${Object.keys(PLATE_MAX_DURABILITY).length})`);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[PlateSource] switch 실패 → manual fallback:', e && e.message);
    try { manualFallback(); } catch (e2) {}
  }
})();

// =============================================================
// 2A-6.0: PLATE REGISTRY 비교 / 검증
// =============================================================
function compareRegistryPlatesWithLegacy(opts) {
  const rep = _mkValidationReport();
  const TOL = 1e-6;
  const neq = (a,b) => (typeof a==='number'&&typeof b==='number') ? Math.abs(a-b)>TOL : a!==b;
  const arrNeq = (a,b) => { if(!Array.isArray(a)&&!Array.isArray(b)) return false; if(!Array.isArray(a)||!Array.isArray(b)) return true; if(a.length!==b.length) return true; const x=a.slice().sort(),y=b.slice().sort(); for(let i=0;i<x.length;i++) if(x[i]!==y[i]) return true; return false; };
  const STR=['name','shortName','desc','factionType','slotType'];
  const NUM=['hardArmor','backingArmor','weightKg','maxDurability'];
  const MAN=(typeof LEGACY_PLATE_PRESETS_MANUAL!=='undefined')?LEGACY_PLATE_PRESETS_MANUAL:{};
  for (const id in PLATE_REGISTRY) {
    const gen=buildPlatePresetFromRegistry(PLATE_REGISTRY[id]);
    // maxDurability 주입(switch와 동일)
    const d=PLATE_REGISTRY[id].durability&&PLATE_REGISTRY[id].durability.maxDurability; if(d!==undefined) gen.maxDurability=d;
    const man=MAN[id];
    const allow=(PLATE_REGISTRY[id].allowDifference)||{};
    if(!man){ rep.warn('plateReg', `${id}: manual 백업에 없음 (신규 플레이트?)`); continue; }
    const isNone=PLATE_REGISTRY[id].plate&&PLATE_REGISTRY[id].plate.isNone;
    for(const f of STR){ if(allow[f])continue; if(gen[f]===undefined&&man[f]===undefined)continue; if(neq(gen[f],man[f])) rep.warn('plateReg',`${id}.${f}: registry(${JSON.stringify(gen[f])}) ≠ manual(${JSON.stringify(man[f])})`); }
    for(const f of NUM){ if(allow[f])continue; if(gen[f]===undefined&&man[f]===undefined)continue; if(neq(gen[f],man[f])) rep.warn('plateReg',`${id}.${f}: registry(${gen[f]}) ≠ manual(${man[f]})`); }
    // isNone
    if(!!gen.isNone !== !!man.isNone) rep.warn('plateReg',`${id}.isNone: registry(${gen.isNone}) ≠ manual(${man.isNone})`);
    // material/backingMaterial (none이면 null 허용)
    if(gen.material!==man.material) rep.warn('plateReg',`${id}.material: registry(${gen.material}) ≠ manual(${man.material})`);
    if(gen.backingMaterial!==man.backingMaterial) rep.warn('plateReg',`${id}.backingMaterial: registry(${gen.backingMaterial}) ≠ manual(${man.backingMaterial})`);
    // 배열 호환성
    if(arrNeq(gen.compatibleArmorIds,man.compatibleArmorIds)) rep.warn('plateReg',`${id}.compatibleArmorIds: registry≠manual`);
    if(arrNeq(gen.incompatibleArmorIds,man.incompatibleArmorIds)) rep.warn('plateReg',`${id}.incompatibleArmorIds: registry≠manual`);
  }
  // manual의 모든 플레이트가 registry에 있는지
  for(const id in MAN) if(!PLATE_REGISTRY[id]) rep.error('plateReg',`${id}: manual 백업에 있으나 PLATE_REGISTRY 미이관`);
  if(!opts || opts.log!==false){
    const s=rep.summary();
    if(typeof console!=='undefined'){
      console.log(`[PLATE_REGISTRY ↔ manual 비교] error ${s.errors} / 불일치 ${s.warnings}건 (대상 ${Object.keys(PLATE_REGISTRY).length}종)`);
      for(const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for(const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if(s.errors===0&&s.warnings===0) console.log('  ✓ 모든 플레이트가 manual과 일치');
    }
  }
  return rep;
}

function validatePlateRegistry(rep) {
  rep = rep || _mkValidationReport();
  if (typeof PLATE_REGISTRY==='undefined'){ rep.warn('plateReg','PLATE_REGISTRY 미정의'); return rep; }
  const seen={};
  const armorExists=(aid)=> (typeof BODY_ARMOR_PRESETS!=='undefined' && BODY_ARMOR_PRESETS[aid]);
  for(const id in PLATE_REGISTRY){
    const e=PLATE_REGISTRY[id];
    const d=e.display||{}, pl=e.plate||{}, ar=e.armor||{}, ph=e.physical||{}, co=e.compatibility||{}, du=e.durability||{};
    if(e.id!==id) rep.warn('plateReg',`${id}: id 필드 불일치`);
    if(seen[e.id]) rep.error('plateReg',`${e.id}: registry id 중복`); seen[e.id]=true;
    if(!d.name) rep.error('plateReg',`${id}: display.name 누락`);
    if(!d.shortName) rep.warn('plateReg',`${id}: display.shortName 누락`);
    if(!d.desc) rep.warn('plateReg',`${id}: display.desc 누락`);
    if(!pl.factionType) rep.warn('plateReg',`${id}: plate.factionType 누락`);
    if(!pl.slotType) rep.error('plateReg',`${id}: plate.slotType 누락`);
    const isNone=!!pl.isNone;
    if(isNone){
      // none preset: hardArmor 0, weightKg 0, material null 허용
      if(ar.hardArmor!==0) rep.warn('plateReg',`${id}: none preset인데 hardArmor≠0`);
      if(ph.weightKg!==0) rep.warn('plateReg',`${id}: none preset인데 weightKg≠0`);
    } else {
      if(!_isFiniteNum(ar.hardArmor)) rep.warn('plateReg',`${id}: armor.hardArmor 누락`);
      if(!_isFiniteNum(ar.backingArmor)) rep.warn('plateReg',`${id}: armor.backingArmor 누락`);
      if(!ar.material) rep.warn('plateReg',`${id}: armor.material 누락`);
      if(!ar.backingMaterial) rep.warn('plateReg',`${id}: armor.backingMaterial 누락`);
      if(!_isFiniteNum(ph.weightKg)) rep.warn('plateReg',`${id}: physical.weightKg 누락`);
      if(!_isFiniteNum(du.maxDurability)) rep.warn('plateReg',`${id}: durability.maxDurability 누락`);
    }
    // 호환성 armor id 존재 확인
    if(Array.isArray(co.compatibleArmorIds)) for(const aid of co.compatibleArmorIds) if(!armorExists(aid)) rep.warn('plateReg',`${id}: compatibleArmorId '${aid}' 가 BODY_ARMOR_PRESETS에 없음`);
    if(Array.isArray(co.incompatibleArmorIds)) for(const aid of co.incompatibleArmorIds) if(!armorExists(aid)) rep.warn('plateReg',`${id}: incompatibleArmorId '${aid}' 가 BODY_ARMOR_PRESETS에 없음`);
    // side plate는 side slotType
    if(/side/i.test(id) && pl.slotType!=='side' && !isNone) rep.info('plateReg',`${id}: 이름은 side인데 slotType=${pl.slotType}`);
    // 생성 검증
    const gen=buildPlatePresetFromRegistry(e);
    if(!gen||!gen.name||!gen.slotType) rep.error('plateReg',`${id}: 생성 plate preset 필수 필드 누락`);
    // === 2A-6.4: plateSystem / physical / materialStack 검증 ===
    const ps=e.plateSystem||{}, th=e.thickness||{}, ms=e.materialStack||{};
    if(!ps.ratingMode) rep.error('plateReg',`${id}: plateSystem.ratingMode 누락`);
    if(th.thicknessMm===undefined) rep.warn('plateReg',`${id}: thickness.thicknessMm 누락`);
    if(!th.bulkClass) rep.warn('plateReg',`${id}: thickness.bulkClass 누락`);
    if(th.thicknessMinMm!==undefined && th.thicknessMaxMm!==undefined && th.thicknessMm!==undefined){
      if(!(th.thicknessMinMm<=th.thicknessMm && th.thicknessMm<=th.thicknessMaxMm)) rep.warn('plateReg',`${id}: thickness 범위 이상 (${th.thicknessMinMm}/${th.thicknessMm}/${th.thicknessMaxMm})`);
    }
    for(const f of ['strikeFace','core','backer','coating']) if(ms[f]===undefined) rep.warn('plateReg',`${id}: materialStack.${f} 누락`);
    const rm=ps.ratingMode;
    if(rm==='icw'){
      if(ps.requiresSoftBacker!==true) rep.error('plateReg',`${id}: ICW인데 requiresSoftBacker≠true`);
      if(!_isFiniteNum(ps.minBackerArmor)||ps.minBackerArmor<=0) rep.warn('plateReg',`${id}: ICW인데 minBackerArmor 누락/0`);
      if(ps.secondaryBackerMode!=='full') rep.warn('plateReg',`${id}: ICW인데 secondaryBackerMode≠full (${ps.secondaryBackerMode})`);
      if(ps.hasIntegralBacker===true) rep.error('plateReg',`${id}: ICW인데 hasIntegralBacker=true (내부 backer를 자체백커로 처리 금지)`);
    } else if(rm==='standalone'){
      if(ps.hasIntegralBacker!==true) rep.error('plateReg',`${id}: Stand-Alone인데 hasIntegralBacker≠true`);
      if(ps.requiresSoftBacker!==false) rep.error('plateReg',`${id}: Stand-Alone인데 requiresSoftBacker≠false`);
    } else if(rm==='soft_insert'){
      if(ps.secondaryBackerMode!=='none') rep.info('plateReg',`${id}: soft_insert인데 secondaryBackerMode=${ps.secondaryBackerMode}`);
      // soft_insert는 hard plate처럼 과도한 hardArmor를 가지면 경고 (IIIA급 28~32 범위)
      if(!isNone && ar.hardArmor>36) rep.warn('plateReg',`${id}: soft_insert인데 armorValue ${ar.hardArmor} 과도 (IIIA급 28~32 권장)`);
    } else if(rm==='training'){
      if(th.bulkClass!=='training') rep.info('plateReg',`${id}: training인데 bulkClass≠training`);
      if(!isNone && ar.hardArmor>6) rep.warn('plateReg',`${id}: training 플레이트 방호값 ${ar.hardArmor} 과도`);
    } else if(rm==='none'){
      if(th.thicknessMm!==0) rep.warn('plateReg',`${id}: none인데 thicknessMm≠0`);
    }
  }
  // completeness: 최종 PLATE_PRESETS ↔ registry
  if(typeof PLATE_PRESETS!=='undefined'){
    for(const id in PLATE_REGISTRY) if(!PLATE_PRESETS[id]) rep.error('plateReg',`${id}: registry에 있으나 최종 PLATE_PRESETS에 없음`);
    for(const id in PLATE_PRESETS) if(!PLATE_REGISTRY[id]) rep.warn('plateReg',`${id}: 최종 PLATE_PRESETS에 있으나 registry에 없음`);
    // no plate 3종 존재
    for(const id of ['no_front_plate','no_back_plate','no_side_plate']) if(!PLATE_PRESETS[id]) rep.error('plateReg',`${id}: 필수 none preset이 최종 PLATE_PRESETS에 없음`);
  }
  return rep;
}
if (typeof window !== 'undefined') {
  window.compareRegistryPlatesWithLegacy = compareRegistryPlatesWithLegacy;
  window.buildLegacyPlatePresetsFromRegistry = buildLegacyPlatePresetsFromRegistry;
}


const HELMET_MAX_DURABILITY = {
  mich_test: 45, helmet_6b47_test: 42,
  fast_mt: 40, lshz_light: 38, ech: 55, helmet_6b47m: 50, k6_3: 60,
  helmet_fast_bump: 18, helmet_fast_carbon_bump: 20, helmet_ulach: 50,
};
for (const id in HELMET_MAX_DURABILITY) {
  if (typeof HELMET_PRESETS !== 'undefined' && HELMET_PRESETS[id]) {
    HELMET_PRESETS[id].maxDurability = HELMET_MAX_DURABILITY[id];
  }
}

// 추가 보호구 (visor / SLAAP / groin / shoulder / neck)
const ACCESSORY_MAX_DURABILITY = {
  fast_mt_visor: 22, k6_3_visor: 40, fast_mt_slaap: 32,
  iotv_groin: 30, iotv_shoulder: 30, iotv_neck: 25,
  '6b45_groin': 32, '6b45_shoulder': 32, '6b45_neck': 26,
  msv_groin: 28, msv_shoulder: 28, msv_neck: 22,
};
for (const id in ACCESSORY_MAX_DURABILITY) {
  if (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined' && PROTECTION_ACCESSORY_PRESETS[id]) {
    PROTECTION_ACCESSORY_PRESETS[id].maxDurability = ACCESSORY_MAX_DURABILITY[id];
  }
}

// 방탄복 soft armor (단일 슬롯)
// 2A-6.5: softMaxDurability는 BODY_ARMOR_REGISTRY.softArmor.maxDurability가 권위.
//   아래 상수/루프는 registry 미생성(fallback) 시에만 채우는 보조값 (이중관리 방지).
const ARMOR_SOFT_MAX_DURABILITY = {
  jpc_test: 35, msv: 45, iotv_test: 55,
  armor_6b23_test: 45, armor_6b45_basic_test: 55,
  police_vest: 55,
};
for (const id in ARMOR_SOFT_MAX_DURABILITY) {
  if (BODY_ARMOR_PRESETS[id] && BODY_ARMOR_PRESETS[id].softMaxDurability == null) BODY_ARMOR_PRESETS[id].softMaxDurability = ARMOR_SOFT_MAX_DURABILITY[id];
}

// FAST/LShZ visor와 K6-3 glass zone은 durabilityMaterial = 'glass'
if (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') {
  if (PROTECTION_ACCESSORY_PRESETS.fast_mt_visor) {
    PROTECTION_ACCESSORY_PRESETS.fast_mt_visor.durabilityMaterial = 'glass';
  }
  if (PROTECTION_ACCESSORY_PRESETS.k6_3_visor && PROTECTION_ACCESSORY_PRESETS.k6_3_visor.visorHitTable) {
    for (const z of PROTECTION_ACCESSORY_PRESETS.k6_3_visor.visorHitTable) {
      if (z.id === 'glass') z.durabilityMaterial = 'glass';
    }
  }
}

// =============================================================
