// 6. GAME STATE
// =============================================================
// 배치 모드용 재질 기본값
// === 배치용 엄폐물 종류 ===
//   카테고리:
//     - 시야 차단형 (blocksLOS: true): 사람 전체 가림. 기존 cover와 동일.
//     - 반높이형 (halfHeight: true, blocksLOS: false): 시야는 통과. 사격은 약 절반만 차단.
//       엄폐 뒤 사람은 다리/하반신 가려지고 가슴/머리는 노출됨.
const PLACEMENT_COVERS = {
  // ----- 시야 차단형 (사람 키 이상) — 벽 형태. armor는 두께(짧은 축)로 산출 -----
  drywall_wall:    { category:'fullCover', material:'drywall',    armor: 6,  ricochetBase:0.05, w:80, h:8,   label:'드라이월 벽',   blocksLOS:true,  halfHeight:false },
  wood_wall:       { category:'fullCover', material:'wood',       armor:12,  ricochetBase:0.10, w:80, h:10,  label:'나무 벽',       blocksLOS:true,  halfHeight:false },
  thin_metal_wall: { category:'fullCover', material:'thin_metal', armor:18,  ricochetBase:0.45, w:80, h:8,   label:'얇은 금속 벽',  blocksLOS:true,  halfHeight:false },
  concrete_wall:   { category:'fullCover', material:'concrete',   armor:60,  ricochetBase:0.55, w:80, h:12,  label:'콘크리트 벽',   blocksLOS:true,  halfHeight:false },
  rha_plate:       { category:'fullCover', material:'steel',      armor:80,  ricochetBase:0.70, w:64, h:10,  label:'RHA 강판',      blocksLOS:true,  halfHeight:false },
  glass_pane:      { category:'fullCover', material:'glass',      armor: 7,  ricochetBase:0.05, w:8,  h:80,  label:'유리벽',        blocksLOS:false, halfHeight:false },

  // ----- 반높이형 (사람 절반만 가림) — authored armor 유지 -----
  sandbag_low:     { category:'halfCover', material:'concrete',   armor:50,  ricochetBase:0.30, w:60, h:24,  label:'모래주머니',    blocksLOS:false, halfHeight:true, penetrable:true },
  wooden_table:    { category:'halfCover', material:'wood',       armor:10,  ricochetBase:0.10, w:64, h:32,  label:'나무 책상',     blocksLOS:false, halfHeight:true, penetrable:true },
  metal_railing:   { category:'halfCover', material:'thin_metal', armor:24,  ricochetBase:0.45, w:80, h:16,  label:'금속 난간',     blocksLOS:false, halfHeight:true, penetrable:true },
  low_wall:        { category:'halfCover', material:'concrete',   armor:60,  ricochetBase:0.55, w:80, h:20,  label:'낮은 벽',       blocksLOS:false, halfHeight:true, penetrable:true },
};

// 시야 차단형 fullCover도 penetrable 기본 명시
for (const k in PLACEMENT_COVERS) {
  if (PLACEMENT_COVERS[k].category === 'fullCover' && PLACEMENT_COVERS[k].penetrable == null) {
    PLACEMENT_COVERS[k].penetrable = true;
  }
}

// =============================================================
// BARRIER_MATERIAL_PROPS — 장벽 재질별 관통 손실 계수
// =============================================================
//   penetrationLoss: 통과 시 절대 감소량 (펜)
//   velocityRetention: 통과 후 남는 탄속 비율 (0~1)
//   stabilityLossBase: 통과 시 stability 감소량 (0~1)
//   damageRetention: 통과 후 남는 damage 비율 (0~1)
//   penRetention: 통과 후 남는 관통력 비율 (0~1)
const BARRIER_MATERIAL_PROPS = {
  drywall:    { penetrationLoss: 1, velocityRetention: 0.94, stabilityLossBase: 0.08, damageRetention: 0.95, penRetention: 0.92 },
  wood:       { penetrationLoss: 2, velocityRetention: 0.88, stabilityLossBase: 0.14, damageRetention: 0.90, penRetention: 0.88 },
  glass:      { penetrationLoss: 1, velocityRetention: 0.92, stabilityLossBase: 0.15, damageRetention: 0.92, penRetention: 0.90 },
  thin_metal: { penetrationLoss: 6, velocityRetention: 0.72, stabilityLossBase: 0.28, damageRetention: 0.78, penRetention: 0.65 },
  concrete:   { penetrationLoss: 10, velocityRetention: 0.55, stabilityLossBase: 0.40, damageRetention: 0.62, penRetention: 0.45 },
  steel:      { penetrationLoss: 14, velocityRetention: 0.38, stabilityLossBase: 0.55, damageRetention: 0.45, penRetention: 0.28 },
};
function getBarrierMaterialProps(material) {
  return BARRIER_MATERIAL_PROPS[material] || BARRIER_MATERIAL_PROPS.wood;
}
// === 두께(px) × 재질 → 방호력(armor) 산출 ===
//   20px = 1m. 같은 재질이라도 두꺼우면 armor↑, 얇으면 armor↓.
//   armor를 임의로 올리지 않고 두께로만 결정한다.
// SIDE-PATHLEN-ARMOR-1 §1: 재질별 1m당 방호저항 (기존 MATERIAL_ARMOR_PER_PX × PX_PER_M(32) 환산 — 배치 밸런스 유지, 단위만 m 기준).
const MATERIAL_ARMOR_PER_M = {
  drywall:      22.4,   // 0.7 × 32
  glass:        28.8,   // 0.9 × 32
  wood:         38.4,   // 1.2 × 32
  thin_metal:   70.4,   // 2.2 × 32
  concrete:    160.0,   // 5.0 × 32
  steel:       256.0,   // 8.0 × 32
  furniture:    38.4,
  generic_wall: 38.4,
  generic_cover:38.4,
};
// (legacy) MATERIAL_ARMOR_PER_PX — 하위 참조용으로만 남김. 새 계산은 MATERIAL_ARMOR_PER_M 사용.
const MATERIAL_ARMOR_PER_PX = { drywall:0.7, glass:0.9, wood:1.2, thin_metal:2.2, concrete:5.0, steel:8.0 };
// SIDE-PATHLEN-ARMOR-1 §2: 두께(px)→m 변환 후 재질 1m당 저항 곱. armor 자체를 pxToM 하는 게 아님.
function thicknessToArmor(material, thicknessPx) {
  const thicknessM = pxToM(thicknessPx || 0);
  const k = MATERIAL_ARMOR_PER_M[material] != null ? MATERIAL_ARMOR_PER_M[material] : MATERIAL_ARMOR_PER_M.generic_cover;
  return Math.max(1, Math.min(160, Math.round(thicknessM * k)));
}
// SIDE-PATHLEN-ARMOR-1 §3: 솔리드 엄폐/내부벽 armor를 짧은 축 두께로 재계산 (halfHeight/고정프로파일 제외 — authored 유지).
function recomputeArmorFromThickness(o) {
  if (!o) return;
  if (o.coverPresetId === 'sandbag_low' || o._fixedProfile) return;
  if (o.halfHeight) return;
  const thicknessPx = Math.min(o.w, o.h);
  o.nominalThicknessM = pxToM(thicknessPx);
  o.armor = thicknessToArmor(o.material, thicknessPx);
}
// SIDE-PATHLEN-ARMOR-1 §4: barrier 정면 공칭 두께(m). 배치모드 값 우선, 없으면 짧은 축 px→m.
function getBarrierNominalThicknessM(obj) {
  if (!obj) return 0.1;
  if (Number.isFinite(obj.nominalThicknessM)) return Math.max(0.005, obj.nominalThicknessM);
  if (Number.isFinite(obj.thicknessM))        return Math.max(0.005, obj.thicknessM);
  if (Number.isFinite(obj.baseThicknessM))    return Math.max(0.005, obj.baseThicknessM);
  if (Number.isFinite(obj.thicknessMm))       return Math.max(0.005, obj.thicknessMm / 1000);
  if (Number.isFinite(obj.w) && Number.isFinite(obj.h)) return Math.max(0.005, pxToM(Math.min(obj.w, obj.h)));
  return 0.1;
}
// SIDE-PATHLEN-ARMOR-1 §5: authored armor를 정면 baseArmor로 보고 공칭 두께로 나눠 1m당 저항 역산.
function getBarrierArmorPerMeter(obj, material) {
  const mat = material || (obj && obj.material) || 'generic_cover';
  const nominalThicknessM = getBarrierNominalThicknessM(obj);
  if (obj && Number.isFinite(obj.armor) && nominalThicknessM > 0.005) {
    return obj.armor / nominalThicknessM;
  }
  return MATERIAL_ARMOR_PER_M[mat] != null ? MATERIAL_ARMOR_PER_M[mat] : MATERIAL_ARMOR_PER_M.generic_cover;
}
// SIDE-PATHLEN-ARMOR-1 §6: 실제 통과 길이(pathLenM) 기반 effectiveArmor. = armorPerMeter × pathLenM (baseArmor×mul 아님).
function computeBarrierEffectiveArmor(obj, ctx) {
  const material = (obj && obj.material) || (ctx && ctx.material) || 'generic_cover';
  const armorPerMeter = getBarrierArmorPerMeter(obj, material);
  const nominalThicknessM = getBarrierNominalThicknessM(obj);
  const baseArmor = (obj && Number.isFinite(obj.armor))
    ? obj.armor
    : Math.max(1, Math.round(armorPerMeter * nominalThicknessM));
  const entryT = Number.isFinite(ctx && ctx.entryT) ? ctx.entryT : 0;
  const exitT  = Number.isFinite(ctx && ctx.exitT)  ? ctx.exitT  : entryT;
  const pathLenPx = Math.max(0, exitT - entryT);
  const pathLenM  = pxToM(pathLenPx);
  const effPathM  = Math.max(0.005, pathLenM);
  const effectiveArmor = Math.max(1, armorPerMeter * effPathM);
  const pathRatio = pathLenM / Math.max(0.005, nominalThicknessM);
  return {
    material, baseArmor, effectiveArmor, armorPerMeter, nominalThicknessM,
    pathLenPx, pathLenM, pathRatio,
    incidentDeg: Number.isFinite(ctx && ctx.incidentDeg) ? ctx.incidentDeg : null,
  };
}

// 호환을 위한 기존 PLACEMENT_MATERIALS 유지 (배치 패널 fallback)
const PLACEMENT_MATERIALS = {
  drywall:    { armor: 6,  ricochetBase: 0.05, w: 80, h: 8  },
  glass:      { armor: 8,  ricochetBase: 0.05, w: 8,  h: 80 },
  wood:       { armor: 14, ricochetBase: 0.10, w: 60, h: 24 },
  thin_metal: { armor: 24, ricochetBase: 0.45, w: 24, h: 80 },
  concrete:   { armor: 60, ricochetBase: 0.55, w: 32, h: 32 },
  steel:      { armor: 80, ricochetBase: 0.70, w: 24, h: 24 },
};
const PLACEMENT_MATERIAL_KOR = {
  drywall:'드라이월', glass:'유리', wood:'나무',
  thin_metal:'얇은금속', concrete:'콘크리트', steel:'강철'
};

const GAME = {
  phase: 'loadout',  // 'loadout' | 'play'
  paused: true,
  gameTime: 0,
  // [AI-PERF Phase1] 벤치마크 전용 프로파일러 — debug/benchmark 모드에서만 활성. 일반 플레이는 무비용(플래그 off).
  aiProfileOn: false,
  aiProfile: null,   // { calls:{fn:n}, time:{fn:ms}, updateSamples:[ms...] }
  selectedId: null,
  selectedWpIdx: -1,
  facingMode: false,
  pointFireMode: false,    // 수동 사격 지점 지정 모드
  // === 배치 모드 (PLAN 단계 전용) ===
  //   placementMode: 켜면 클릭이 이동/사격 명령이 아니라 배치 입력으로 작동
  //   placementType:    'reactive' / 'passive' / 'fullCover' / 'halfCover' / 'delete'
  //   placementCoverId: 어떤 종류의 cover를 배치할지 (PLACEMENT_COVERS 키)
  //   selectedCoverId:  현재 선택된 배치된 cover의 id (이동/회전/삭제용)
  placementMode: false,
  placementType: 'reactive',
  placementMaterial: 'wood',        // 호환 fallback
  placementCoverId: 'wood_wall',   // 기본 fullCover
  placementFloorMaterial: 'concrete',   // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: floor paint 재질
  placementBrushSize: 'medium',         // small/medium/large
  selectedCoverId: null,
  selectedWallUid: null,
  placementCounter: { reactive: 4, passive: 0, cover: 0 },
  debugCover: false,
  mapId: 'cqb',
  over: false,
  result: null,
  logs: [],
  fxList: [],
  dustClouds: [],    // SIDE-DUST-CLOUD-VISUAL-1: 먼지구름 (순수 시각 레이어 — 시야/AI/명중/피해 미연결)
  noiseEvents: [],   // 활성 소음 이벤트 (자동 만료)
  debugNoise: false, // 콘솔: GAME.debugNoise = true 로 시각화 ON
  debugAI: false,    // 콘솔: GAME.debugAI = true 로 적 AI state 라벨 표시
  // 투척 모드 / 비행 중 수류탄
  throwMode: null,         // { unitId, throwableId, range } — 투척 위치 지정 모드
  flyingThrowables: [],    // 비행 중 수류탄 [{ id, x, y, vx, vy, targetX, targetY, fuseTimer, ... }]
  pendingExplosions: [],   // 폭발 예약 [{ throwableId, x, y, gameTime }]
  debugFragments: false,   // 콘솔: GAME.debugFragments = true 로 파편 raycast 시각화
  debugAIScan: false,      // 콘솔: GAME.debugAIScan = true 로 AI scan ray 시각화
  debugAIMemory: false,    // 콘솔: GAME.debugAIMemory = true 로 기억된 cover/wall 표시
  debugSpatialMemory: false,   // 콘솔: GAME.debugSpatialMemory = true 로 "믿는 지형" + 허상 구간 표시
  spatialPerceptionOn: null,   // null이면 USE_SPATIAL_PERCEPTION_AS_SOURCE를 따름. true/false로 런타임 A/B.
  debugAICover: false,     // 콘솔: GAME.debugAICover = true 로 선택된 coverSpot 표시
  debugBallistic: false,   // 콘솔: GAME.debugBallistic = true 로 도탄/관통 상세 로그
  debugImpactAddress: false, // 2A-1 피격주소 디버그 (coverageZone/plateShape/organ후보)
  debugVisibility: false,  // stance-aware halfCover 가시성 시각화 + reason 표시
  debugMedical: false,
  debugSurface: false,        // [AI0-B] 관측된 면/observedRanges 표시
  debugSpatial: false,        // [AI0-B] region/portal/threshold 표시     // 의료 상태 디버그 (vitals, summary)
  debugUtility: false,     // 콘솔: GAME.debugUtility = true 로 Utility AI 점수/이유 표시
  debugFireControl: false, // 콘솔: GAME.debugFireControl = true 로 Fire Control(fireIntent/safety/blocker/override/placement/headCap) 표시
  debugPersonalSpace: false, // 콘솔: GAME.debugPersonalSpace = true 로 대원 간 거리 표시
  debugAIScan: false,      // 콘솔: GAME.debugAIScan = true 로 최근 스캔 ray fade 표시

  // 팀 단위 로드아웃 (시작 화면에서 설정)
  loadout: {
    friend: {
      weaponId: 'm4a1', bodyArmorId: 'iotv_test', helmetId: 'mich_test', ammoId: '556_m855',
      frontPlateId: 'plate_esapi',
      backPlateId:  'plate_esapi',
      sidePlateId:  'no_side_plate',
      groinGuardId: 'no_groin_guard',
      shoulderGuardId: 'no_shoulder_guard',
      neckGuardId: 'no_neck_guard',
      visorId: 'no_visor',
      slaapId: 'no_slaap',
      lethalGrenadeId: 'grenade_m67',
      lethalGrenadeCount: 1,
      // 섬광은 **돌입 측** 장비다. "들어가야 하는데 그 너머가 뜨겁다"가 아군 80.1% vs 적 0.9%로
      //   거의 전적으로 미는 쪽에서만 생긴다(실측). 방어 측에는 아직 주지 않는다.
      stunGrenadeId: 'grenade_m84',
      stunGrenadeCount: 1,
      // 연막도 같은 이유로 돌입 측 장비다 — 가리고 건너는 쪽이 쓴다.
      smokeGrenadeId: 'grenade_m18',
      smokeGrenadeCount: 1,
    },
    enemy: {
      weaponId: 'akm', bodyArmorId: 'armor_6b23_test', helmetId: 'helmet_6b47_test', ammoId: '762x39_ps',
      frontPlateId: 'plate_korund_vm_front',
      backPlateId:  'plate_korund_vm_back',
      sidePlateId:  'no_side_plate',
      groinGuardId: 'no_groin_guard',
      shoulderGuardId: 'no_shoulder_guard',
      neckGuardId: 'no_neck_guard',
      visorId: 'no_visor',
      slaapId: 'no_slaap',
      lethalGrenadeId: 'grenade_rgd5',
      lethalGrenadeCount: 1,
    },
  },

  // 팀 단위 숙련도 (시작 화면에서 설정)
  teamSkill: {
    friend: { presetId: 'regular' },
    enemy:  { presetId: 'regular' },
  },

  // SIDE-PER-OPERATOR-LOADOUT-1: 대원별 장비 (팀 기본 위에 얹는 override)
  operatorLoadout: {
    scope: { friend: 'default', enemy: 'default' },   // 현재 장비/총기/방호 탭이 보는 대상 ('default'=팀 기본)
    overridesByMap: {},   // [mapId]: { friend:{ [unitKey]:loadout }, enemy:{ [unitKey]:loadout } }
  },
};
// 콘솔에서 GAME.debugX = true 형태로 접근 가능하게 노출
window.GAME = GAME;
let UNITS = [];
let nextUnitId = 1;
const view = {
  scale: 1, baseScale: 1,
  tx: 0, ty: 0,
  viewportW: 800, viewportH: 400,
  dpr: 1,
};

// =============================================================
