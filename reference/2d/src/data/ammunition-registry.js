// AMMO_REGISTRY — 탄약 데이터 source of truth (전 탄종 43종)
//   실제 전투는 AMMO_PRESETS를 읽는다. registry는 생성/비교/검증 전용.
// =============================================================
const AMMO_REGISTRY_GROUPS = {
  '9x19mm':   { label:'9×19mm Parabellum', tableOrder: 10 },
  '4.6x30mm': { label:'4.6×30mm HK',       tableOrder: 15 },
  '5.7x28mm': { label:'5.7×28mm FN',       tableOrder: 16 },
  '9x21mm':   { label:'9×21mm Gyurza',     tableOrder: 18 },
  '5.56x45mm':{ label:'5.56×45mm NATO',    tableOrder: 20 },
  '.300blk':  { label:'.300 BLK',          tableOrder: 25 },
  '5.45x39mm':{ label:'5.45×39mm',         tableOrder: 30 },
  '7.62x39mm':{ label:'7.62×39mm',         tableOrder: 40 },
  '9x39mm':   { label:'9×39mm',            tableOrder: 45 },
  '7.62x51mm':{ label:'7.62×51mm NATO/.308', tableOrder: 50 },
  '7.62x54r': { label:'7.62×54mmR',        tableOrder: 52 },
  '.30-06':   { label:'.30-06 Springfield', tableOrder: 54 },
  '6.8x51mm': { label:'6.8×51mm / .277 Fury', tableOrder: 55 },
  '9.3x64mm': { label:'9.3×64mm',          tableOrder: 58 },
  '12ga':     { label:'12 Gauge',          tableOrder: 60 },
  '.338lm':   { label:'.338 Lapua Magnum', tableOrder: 70 },
  '.338nm':   { label:'.338 Norma Magnum', tableOrder: 72 },
  '12.7x55mm':{ label:'12.7×55mm',         tableOrder: 80 },
  '12.7x99mm':{ label:'12.7×99mm NATO',    tableOrder: 90 },
  '12.7x108mm':{ label:'12.7×108mm',       tableOrder: 92 },
};
const AMMO_REGISTRY = {
  // ───────────────────────────────────────────────────────────
  // 새 탄종 추가 템플릿 (이 한 곳만 작성하면 AMMO_PRESETS + 보조테이블 4종이 자동 생성됨):
  //   'id': {
  //     id:'id',
  //     display:{ name, shortName, group, desc, tableOrder },          // group은 AMMO_REGISTRY_GROUPS 키
  //     ballistic:{ caliber, velocity, damage, penetration, accuracyMul, recoil, suppression },
  //     energy:{ class },                                              // pistol/small_rifle/intermediate_rifle/full_power_rifle/shotgun/subsonic/pdw/high_power_rifle 등
  //     armorInteraction:{ materialPenalty:{fabric,aramid,pe,steel,aluminum,titanium,ceramic,composite}, barrierPenMul, barrierStability, barrierDamageRetention, ricochetMul, barrierBehavior },
  //     durability:{ armorDamagePct },
  //     combat:{ stoppingPower, painMul, [bluntTraumaMul] },           // bluntTraumaMul은 슬러그 등 직접 둔상탄만
  //     projectile:{ projectileType, pelletCount, patternType },       // 산탄/투사체(12ga 등)만
  //     medical:{ bleedChance, bleedSeverityMul, fractureChance, fractureSeverityMul, shockChance, bluntTraumaMul, tissueDamageMul },
  //     ui:{ showInAmmoTable, showInArmorAnalysis, [notes] },
  //     // compatibility:{ allowedWeaponIds | weaponTags },            // (선택) 현재는 검증/비교용. 무기 선택 자동변경 안 함
  //   },
  //   ※ 신규 5.7mm/4.6mm/6.8mm/.300BLK 등도 위 구조만 채우면 됨. 보조 테이블 수정 불필요.
  // ───────────────────────────────────────────────────────────

  // ===== 9x19mm =====
  '9mm_115gr': {
    id:'9mm_115gr',
    display:{ name:'9mm Luger FMJ 115gr', shortName:'115gr FMJ', group:'9x19mm', desc:'9mm / 민수용 FMJ / 하드 방호 약함', tableOrder:1 },
    ballistic:{ caliber:'9x19mm', velocity:380, damage:52, penetration:16, accuracyMul:0.98, recoil:-0.2, suppression:0.1 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.7, barrierStability:0.45, barrierDamageRetention:0.65, ricochetMul:1.25, barrierBehavior:'round_fmj',
    },
    durability:{ armorDamagePct:13 },
    combat:{ stoppingPower:0.9, painMul:0.85 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.9, fractureChance:0.06, fractureSeverityMul:0.8, shockChance:0.1, bluntTraumaMul:0.95, tissueDamageMul:0.85 },
    projectile:{ massG:7.45 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_124gr': {
    id:'9mm_124gr',
    display:{ name:'9mm Luger FMJ 124gr', shortName:'FMJ', group:'9x19mm', desc:'9mm / 민수용 표준 FMJ / 하드 방호 약함', tableOrder:2 },
    ballistic:{ caliber:'9x19mm', velocity:360, damage:54, penetration:17, accuracyMul:1, recoil:0, suppression:0.4 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.7, barrierStability:0.45, barrierDamageRetention:0.65, ricochetMul:1.25, barrierBehavior:'round_fmj',
    },
    durability:{ armorDamagePct:14 },
    combat:{ stoppingPower:0.95, painMul:0.9 },
    medical:{ bleedChance:0.2, bleedSeverityMul:0.95, fractureChance:0.07, fractureSeverityMul:0.85, shockChance:0.12, bluntTraumaMul:1, tissueDamageMul:0.9 },
    projectile:{ massG:8.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_m882': {
    id:'9mm_m882',
    display:{ name:'9mm M882', shortName:'M882', group:'9x19mm', desc:'9mm / 군용 표준 FMJ / 일부 차폐물 침투', tableOrder:3 },
    ballistic:{ caliber:'9x19mm', velocity:400, damage:55, penetration:21, accuracyMul:1, recoil:0.2, suppression:0.5 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.8, barrierStability:0.55, barrierDamageRetention:0.7, ricochetMul:1.25, barrierBehavior:'round_fmj',
    },
    durability:{ armorDamagePct:18 },
    combat:{ stoppingPower:0.95, painMul:0.9 },
    medical:{ bleedChance:0.22, bleedSeverityMul:1, fractureChance:0.08, fractureSeverityMul:0.9, shockChance:0.14, bluntTraumaMul:1.05, tissueDamageMul:0.95 },
    projectile:{ massG:8.04 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_7n21': {
    id:'9mm_7n21',
    display:{ name:'9mm 7N21', shortName:'7N21', group:'9x19mm', desc:'9mm / 강철심 AP / 아라미드/헬멧에 위협적', tableOrder:4 },
    ballistic:{ caliber:'9x19mm', velocity:460, damage:51, penetration:28, accuracyMul:1, recoil:0.4, suppression:0.6 },
    energy:{ class:'pistol_ap' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:1, barrierStability:1.1, barrierDamageRetention:0.85, ricochetMul:1.45, barrierBehavior:'pistol_penetrator',
    },
    durability:{ armorDamagePct:38 },
    combat:{ stoppingPower:0.8, painMul:0.85 },
    medical:{ bleedChance:0.12, bleedSeverityMul:0.75, fractureChance:0.14, fractureSeverityMul:1.1, shockChance:0.12, bluntTraumaMul:1.1, tissueDamageMul:0.75 },
    projectile:{ massG:5.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_7n31': {
    id:'9mm_7n31',
    display:{ name:'9mm 7N31', shortName:'7N31', group:'9x19mm', desc:'9mm / 최고급 권총 AP / 소프트아머·헬멧 관통 가능', tableOrder:5 },
    ballistic:{ caliber:'9x19mm', velocity:580, damage:50, penetration:35, accuracyMul:1.02, recoil:0.9, suppression:0.8 },
    energy:{ class:'pistol_ap' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:1.1, barrierStability:1.3, barrierDamageRetention:0.9, ricochetMul:1.5, barrierBehavior:'pistol_penetrator',
    },
    durability:{ armorDamagePct:55 },
    combat:{ stoppingPower:0.85, painMul:0.85 },
    medical:{ bleedChance:0.1, bleedSeverityMul:0.7, fractureChance:0.16, fractureSeverityMul:1.15, shockChance:0.14, bluntTraumaMul:1.15, tissueDamageMul:0.7 },
    projectile:{ massG:4.1 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_jhp': {
    id:'9mm_jhp',
    display:{ name:'9mm JHP', shortName:'JHP', group:'9x19mm', desc:'9mm / 자켓홀로포인트 / 비방호 고저지력 / 방탄재 매우 취약', tableOrder:6 },
    ballistic:{ caliber:'9x19mm', velocity:360, damage:64, penetration:13, accuracyMul:0.96, recoil:0.1, suppression:0.6 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
      barrierPenMul:0.4, barrierStability:0.35, barrierDamageRetention:0.45, ricochetMul:0.55, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:12 },
    combat:{ stoppingPower:1.3, painMul:1.3 },
    medical:{ bleedChance:0.55, bleedSeverityMul:1.5, fractureChance:0.08, fractureSeverityMul:0.85, shockChance:0.32, bluntTraumaMul:0.75, tissueDamageMul:1.55 },
    projectile:{ massG:8.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_jhp_p': {
    id:'9mm_jhp_p',
    display:{ name:'9mm +P JHP', shortName:'+P JHP', group:'9x19mm', desc:'9mm +P / 고압 JHP / 비방호 정지력 우수 / 반동 큼', tableOrder:7 },
    ballistic:{ caliber:'9x19mm', velocity:390, damage:66, penetration:16, accuracyMul:0.95, recoil:0.5, suppression:0.7 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
      barrierPenMul:0.45, barrierStability:0.4, barrierDamageRetention:0.5, ricochetMul:0.55, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:14 },
    combat:{ stoppingPower:1.35, painMul:1.3 },
    medical:{ bleedChance:0.6, bleedSeverityMul:1.55, fractureChance:0.1, fractureSeverityMul:0.9, shockChance:0.36, bluntTraumaMul:0.8, tissueDamageMul:1.6 },
    projectile:{ massG:8.04 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '9mm_rip': {
    id:'9mm_rip',
    display:{ name:'9mm R.I.P.', shortName:'R.I.P.', group:'9x19mm', desc:'9mm / 다중 파편 분리탄 / 비방호 극단적 저지력 / 방탄재·장애물에 거의 무력', tableOrder:8 },
    ballistic:{ caliber:'9x19mm', velocity:380, damage:84, penetration:10, accuracyMul:0.94, recoil:0.2, suppression:0.6 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:5, pe:13, steel:13, aluminum:11, titanium:15, ceramic:16, composite:15 },
      barrierPenMul:0.18, barrierStability:0.18, barrierDamageRetention:0.22, ricochetMul:0.25, barrierBehavior:'fragment',
    },
    durability:{ armorDamagePct:11 },
    combat:{ stoppingPower:1.6, painMul:1.58 },
    medical:{ bleedChance:0.7, bleedSeverityMul:1.7, fractureChance:0.06, fractureSeverityMul:0.75, shockChance:0.42, bluntTraumaMul:0.6, tissueDamageMul:1.8 },
    projectile:{ massG:5.96 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },

  // ===== 5.56x45mm =====
  '556_223_fmj': {
    id:'556_223_fmj',
    display:{ name:'.223 Rem FMJ', shortName:'.223 FMJ', group:'5.56x45mm', desc:'5.56 / 비군용 FMJ / 관통 낮음 / 반동 적음', tableOrder:1 },
    ballistic:{ caliber:'5.56x45mm', velocity:900, damage:59, penetration:27, accuracyMul:1, recoil:-0.7, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
      barrierPenMul:0.85, barrierStability:0.5, barrierDamageRetention:0.75, ricochetMul:1.25, barrierBehavior:'normal',
    },
    durability:{ armorDamagePct:28 },
    combat:{ stoppingPower:1, painMul:1 },
    medical:{ bleedChance:0.28, bleedSeverityMul:1.05, fractureChance:0.16, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.1, tissueDamageMul:1.05 },
    projectile:{ massG:3.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_m193': {
    id:'556_m193',
    display:{ name:'5.56 M193', shortName:'M193', group:'5.56x45mm', desc:'5.56 / 구형 군용 FMJ / 평이한 균형', tableOrder:2 },
    ballistic:{ caliber:'5.56x45mm', velocity:990, damage:56, penetration:32, accuracyMul:0.98, recoil:0, suppression:0.2 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:6, steel:7, aluminum:5, titanium:9, ceramic:10, composite:10 },
      barrierPenMul:0.85, barrierStability:0.45, barrierDamageRetention:0.65, ricochetMul:1.25, barrierBehavior:'normal',
    },
    durability:{ armorDamagePct:30 },
    combat:{ stoppingPower:1, painMul:1 },
    medical:{ bleedChance:0.4, bleedSeverityMul:1.3, fractureChance:0.18, fractureSeverityMul:1.1, shockChance:0.25, bluntTraumaMul:1.15, tissueDamageMul:1.35 },
    projectile:{ massG:3.56 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_m855': {
    id:'556_m855',
    display:{ name:'5.56 M855', shortName:'M855', group:'5.56x45mm', desc:'5.56 / 표준 군용탄 / PE에 강함 / 강철·세라믹에 약함', tableOrder:3 },
    ballistic:{ caliber:'5.56x45mm', velocity:925, damage:52, penetration:46, accuracyMul:1, recoil:0, suppression:0.2 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:2, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:1, barrierStability:0.45, barrierDamageRetention:0.75, ricochetMul:1.55, barrierBehavior:'penetrator_unstable',
    },
    durability:{ armorDamagePct:37 },
    combat:{ stoppingPower:1, painMul:1 },
    medical:{ bleedChance:0.25, bleedSeverityMul:1.05, fractureChance:0.22, fractureSeverityMul:1.2, shockChance:0.2, bluntTraumaMul:1.2, tissueDamageMul:1 },
    projectile:{ massG:4.02 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_m855a1': {
    id:'556_m855a1',
    display:{ name:'5.56 M855A1 EPR', shortName:'M855A1', group:'5.56x45mm', desc:'5.56 / 강철 페너트레이터 / 재질 상성 적음', tableOrder:4 },
    ballistic:{ caliber:'5.56x45mm', velocity:955, damage:49, penetration:53, accuracyMul:1.02, recoil:0.5, suppression:0.3 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:3, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.15, barrierStability:1.2, barrierDamageRetention:1.05, ricochetMul:1.25, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:47 },
    combat:{ stoppingPower:1.1, painMul:1.1 },
    medical:{ bleedChance:0.28, bleedSeverityMul:1.1, fractureChance:0.24, fractureSeverityMul:1.25, shockChance:0.22, bluntTraumaMul:1.25, tissueDamageMul:1.05 },
    projectile:{ massG:4.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_mk318_sost': {
    id:'556_mk318_sost',
    display:{ name:'5.56 Mk318 Mod 0 SOST', shortName:'SOST', group:'5.56x45mm', desc:'5.56 / SOST / 저지력 우수 / 하드 방호재에는 제한적', tableOrder:5 },
    ballistic:{ caliber:'5.56x45mm', velocity:935, damage:55, penetration:48, accuracyMul:1.04, recoil:0.2, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:6, steel:6, aluminum:4, titanium:8, ceramic:11, composite:10 },
      barrierPenMul:1.25, barrierStability:1.65, barrierDamageRetention:1.35, ricochetMul:0.8, barrierBehavior:'barrier_blind',
    },
    durability:{ armorDamagePct:38 },
    combat:{ stoppingPower:1.15, painMul:1.15 },
    medical:{ bleedChance:0.38, bleedSeverityMul:1.2, fractureChance:0.18, fractureSeverityMul:1.1, shockChance:0.24, bluntTraumaMul:1.15, tissueDamageMul:1.3 },
    projectile:{ massG:4.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_mk255_rrlp': {
    id:'556_mk255_rrlp',
    display:{ name:'5.56 Mk255 Mod 0 RRLP', shortName:'RRLP', group:'5.56x45mm', desc:'5.56 / RRLP / 저관통·저도탄 / 비방호 저지력 우수', tableOrder:6 },
    ballistic:{ caliber:'5.56x45mm', velocity:880, damage:61, penetration:20, accuracyMul:0.93, recoil:-0.3, suppression:0.6 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:5, pe:13, steel:13, aluminum:11, titanium:15, ceramic:16, composite:15 },
      barrierPenMul:0.1, barrierStability:0.1, barrierDamageRetention:0.15, ricochetMul:0.05, barrierBehavior:'frangible',
    },
    durability:{ armorDamagePct:8 },
    combat:{ stoppingPower:0.4, painMul:0.45 },
    medical:{ bleedChance:0.5, bleedSeverityMul:1.4, fractureChance:0.1, fractureSeverityMul:0.85, shockChance:0.3, bluntTraumaMul:0.85, tissueDamageMul:1.55 },
    projectile:{ massG:4.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_m995_ap': {
    id:'556_m995_ap',
    display:{ name:'5.56 M995 AP', shortName:'M995', group:'5.56x45mm', desc:'5.56 / AP / 텅스텐 관통자 / 고관통 저피해', tableOrder:7 },
    ballistic:{ caliber:'5.56x45mm', velocity:1015, damage:44, penetration:64, accuracyMul:1.02, recoil:0.8, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.35, barrierStability:1.6, barrierDamageRetention:0.95, ricochetMul:1.5, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:52 },
    combat:{ stoppingPower:0.85, painMul:0.85 },
    medical:{ bleedChance:0.14, bleedSeverityMul:0.8, fractureChance:0.3, fractureSeverityMul:1.45, shockChance:0.2, bluntTraumaMul:1.3, tissueDamageMul:0.75 },
    projectile:{ massG:3.37 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_varmageddon': {
    id:'556_varmageddon',
    display:{ name:'5.56 Varmageddon', shortName:'.223 Rem Varmint', group:'5.56x45mm', desc:'5.56 / 극단적 파편화 / 비방호 고피해 / 방탄재에 매우 약함', tableOrder:8 },
    ballistic:{ caliber:'5.56x45mm', velocity:920, damage:79, penetration:15, accuracyMul:0.93, recoil:0.5, suppression:1 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:12, steel:13, aluminum:10, titanium:14, ceramic:15, composite:14 },
      barrierPenMul:0.05, barrierStability:0.1, barrierDamageRetention:0.1, ricochetMul:0.05, barrierBehavior:'fragment',
    },
    durability:{ armorDamagePct:11 },
    combat:{ stoppingPower:1.4, painMul:1.4 },
    medical:{ bleedChance:0.62, bleedSeverityMul:1.55, fractureChance:0.12, fractureSeverityMul:0.9, shockChance:0.38, bluntTraumaMul:0.7, tissueDamageMul:1.7 },
    projectile:{ massG:3.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_hp': {
    id:'556_hp',
    display:{ name:'5.56 HP', shortName:'HP', group:'5.56x45mm', desc:'5.56 / Hollow Point / 고피해 저관통', tableOrder:9 },
    ballistic:{ caliber:'5.56x45mm', velocity:900, damage:62, penetration:24, accuracyMul:0.96, recoil:-0.3, suppression:0.5 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
      barrierPenMul:0.3, barrierStability:0.25, barrierDamageRetention:0.35, ricochetMul:0.35, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:16 },
    combat:{ stoppingPower:1.3, painMul:1.3 },
    medical:{ bleedChance:0.55, bleedSeverityMul:1.45, fractureChance:0.14, fractureSeverityMul:0.95, shockChance:0.32, bluntTraumaMul:0.8, tissueDamageMul:1.55 },
    projectile:{ massG:3.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '556_mk262_mod1': {
    id:'556_mk262_mod1',
    display:{ name:'5.56 Mk262 Mod 1 77gr OTM', shortName:'77gr OTM', group:'5.56x45mm', desc:'5.56 / 77gr OTM / 정밀·고피해 / 방탄재 관통은 제한적', tableOrder:10 },
    ballistic:{ caliber:'5.56x45mm', velocity:850, damage:60, penetration:36, accuracyMul:1.1, recoil:0.2, suppression:0.5 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:10, aluminum:7, titanium:12, ceramic:14, composite:13 },
      barrierPenMul:0.95, barrierStability:0.85, barrierDamageRetention:0.85, ricochetMul:0.85, barrierBehavior:'precision',
    },
    durability:{ armorDamagePct:34 },
    combat:{ stoppingPower:1.05, painMul:1.05 },
    medical:{ bleedChance:0.42, bleedSeverityMul:1.3, fractureChance:0.18, fractureSeverityMul:1.05, shockChance:0.26, bluntTraumaMul:1.05, tissueDamageMul:1.35 },
    projectile:{ massG:4.99 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },

  // ===== 5.45x39mm =====
  '545_hp': {
    id:'545_hp',
    display:{ name:'5.45×39 HP', shortName:'HP', group:'5.45x39mm', desc:'5.45 / Hollow Point / 비방호 고피해 / 방탄재에 약함', tableOrder:1 },
    ballistic:{ caliber:'5.45x39mm', velocity:840, damage:59, penetration:16, accuracyMul:0.95, recoil:-0.5, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
      barrierPenMul:0.3, barrierStability:0.15, barrierDamageRetention:0.3, ricochetMul:0.35, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:12 },
    combat:{ stoppingPower:1.3, painMul:1.3 },
    medical:{ bleedChance:0.52, bleedSeverityMul:1.4, fractureChance:0.14, fractureSeverityMul:0.95, shockChance:0.3, bluntTraumaMul:0.8, tissueDamageMul:1.5 },
    projectile:{ massG:3.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_prs_gs': {
    id:'545_prs_gs',
    display:{ name:'5.45×39 PRS gs', shortName:'PRS', group:'5.45x39mm', desc:'5.45 / 저도탄 / 저관통', tableOrder:2 },
    ballistic:{ caliber:'5.45x39mm', velocity:860, damage:48, penetration:12, accuracyMul:0.92, recoil:-0.6, suppression:0.2 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:5, pe:13, steel:13, aluminum:11, titanium:15, ceramic:16, composite:15 },
      barrierPenMul:0.1, barrierStability:0.2, barrierDamageRetention:0.15, ricochetMul:0.05, barrierBehavior:'frangible',
    },
    durability:{ armorDamagePct:8 },
    combat:{ stoppingPower:0.4, painMul:0.45 },
    medical:{ bleedChance:0.58, bleedSeverityMul:1.45, fractureChance:0.1, fractureSeverityMul:0.85, shockChance:0.32, bluntTraumaMul:0.7, tissueDamageMul:1.55 },
    projectile:{ massG:3.9 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_sp': {
    id:'545_sp',
    display:{ name:'5.45×39 SP', shortName:'SP', group:'5.45x39mm', desc:'5.45 / Soft Point / 고피해 저관통', tableOrder:3 },
    ballistic:{ caliber:'5.45x39mm', velocity:870, damage:57, penetration:20, accuracyMul:0.96, recoil:-0.4, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:14, composite:13 },
      barrierPenMul:0.3, barrierStability:0.15, barrierDamageRetention:0.3, ricochetMul:0.35, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:14 },
    combat:{ stoppingPower:1.25, painMul:1.25 },
    medical:{ bleedChance:0.48, bleedSeverityMul:1.3, fractureChance:0.15, fractureSeverityMul:1, shockChance:0.28, bluntTraumaMul:0.9, tissueDamageMul:1.4 },
    projectile:{ massG:3.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_us_gs': {
    id:'545_us_gs',
    display:{ name:'5.45×39 US gs (7U1)', shortName:'US', group:'5.45x39mm', desc:'5.45 / 아음속 / 저반동·저관통', tableOrder:4 },
    ballistic:{ caliber:'5.45x39mm', velocity:305, damage:46, penetration:23, accuracyMul:0.92, recoil:-0.7, suppression:0.2 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.65, barrierStability:0.85, barrierDamageRetention:0.75, ricochetMul:0.95, barrierBehavior:'subsonic',
    },
    durability:{ armorDamagePct:24 },
    combat:{ stoppingPower:0.85, painMul:0.85 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.85, fractureChance:0.08, fractureSeverityMul:0.8, shockChance:0.1, bluntTraumaMul:0.85, tissueDamageMul:0.85 },
    projectile:{ massG:5.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_fmj': {
    id:'545_fmj',
    display:{ name:'5.45×39 FMJ', shortName:'FMJ', group:'5.45x39mm', desc:'5.45 / 민수용 표준 FMJ / 낮은 반동', tableOrder:5 },
    ballistic:{ caliber:'5.45x39mm', velocity:880, damage:52, penetration:25, accuracyMul:1, recoil:-0.4, suppression:0.1 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
      barrierPenMul:0.8, barrierStability:0.55, barrierDamageRetention:0.7, ricochetMul:1.1, barrierBehavior:'normal',
    },
    durability:{ armorDamagePct:28 },
    combat:{ stoppingPower:0.95, painMul:0.95 },
    medical:{ bleedChance:0.26, bleedSeverityMul:1, fractureChance:0.16, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.1, tissueDamageMul:1 },
    projectile:{ massG:3.9 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_ps_gs': {
    id:'545_ps_gs',
    display:{ name:'5.45×39 PS gs (7N6)', shortName:'PS', group:'5.45x39mm', desc:'5.45 / 군용 표준탄 / 저반동', tableOrder:6 },
    ballistic:{ caliber:'5.45x39mm', velocity:890, damage:49, penetration:35, accuracyMul:1, recoil:-0.3, suppression:0.1 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.9, barrierStability:0.15, barrierDamageRetention:0.55, ricochetMul:1.55, barrierBehavior:'unstable',
    },
    durability:{ armorDamagePct:34 },
    combat:{ stoppingPower:1, painMul:1 },
    medical:{ bleedChance:0.24, bleedSeverityMul:1, fractureChance:0.22, fractureSeverityMul:1.2, shockChance:0.2, bluntTraumaMul:1.2, tissueDamageMul:0.95 },
    projectile:{ massG:3.43 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_pp_gs': {
    id:'545_pp_gs',
    display:{ name:'5.45×39 PP gs (7N10)', shortName:'PP', group:'5.45x39mm', desc:'5.45 / 관통 강화탄', tableOrder:7 },
    ballistic:{ caliber:'5.45x39mm', velocity:890, damage:47, penetration:42, accuracyMul:1.02, recoil:-0.2, suppression:0.2 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:1, barrierStability:0.7, barrierDamageRetention:0.8, ricochetMul:1.45, barrierBehavior:'penetrator_unstable',
    },
    durability:{ armorDamagePct:42 },
    combat:{ stoppingPower:0.95, painMul:0.95 },
    medical:{ bleedChance:0.2, bleedSeverityMul:0.9, fractureChance:0.26, fractureSeverityMul:1.3, shockChance:0.2, bluntTraumaMul:1.25, tissueDamageMul:0.85 },
    projectile:{ massG:3.62 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_bp_gs': {
    id:'545_bp_gs',
    display:{ name:'5.45×39 BP gs (7N22)', shortName:'BP', group:'5.45x39mm', desc:'5.45 / 고관통탄', tableOrder:8 },
    ballistic:{ caliber:'5.45x39mm', velocity:890, damage:45, penetration:50, accuracyMul:1.02, recoil:0.1, suppression:0.3 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.15, barrierStability:1.1, barrierDamageRetention:0.95, ricochetMul:1.5, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:50 },
    combat:{ stoppingPower:0.9, painMul:0.9 },
    medical:{ bleedChance:0.16, bleedSeverityMul:0.85, fractureChance:0.3, fractureSeverityMul:1.4, shockChance:0.22, bluntTraumaMul:1.3, tissueDamageMul:0.8 },
    projectile:{ massG:3.69 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_bs_gs': {
    id:'545_bs_gs',
    display:{ name:'5.45×39 BS gs (7N24)', shortName:'BS', group:'5.45x39mm', desc:'5.45 / 상위 AP / 높은 관통력', tableOrder:9 },
    ballistic:{ caliber:'5.45x39mm', velocity:880, damage:43, penetration:57, accuracyMul:1.02, recoil:0.3, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.25, barrierStability:1.3, barrierDamageRetention:1, ricochetMul:1.65, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:55 },
    combat:{ stoppingPower:0.85, painMul:0.85 },
    medical:{ bleedChance:0.14, bleedSeverityMul:0.8, fractureChance:0.32, fractureSeverityMul:1.45, shockChance:0.22, bluntTraumaMul:1.3, tissueDamageMul:0.75 },
    projectile:{ massG:4.15 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_7n40': {
    id:'545_7n40',
    display:{ name:'5.45×39 7N40', shortName:'7N40', group:'5.45x39mm', desc:'5.45 / 현대식 저반동·고정밀 탄 / 관통보다 명중 안정성', tableOrder:10 },
    ballistic:{ caliber:'5.45x39mm', velocity:900, damage:46, penetration:46, accuracyMul:1.15, recoil:-0.6, suppression:0.2 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1, barrierStability:0.85, barrierDamageRetention:0.85, ricochetMul:0.85, barrierBehavior:'precision',
    },
    durability:{ armorDamagePct:45 },
    combat:{ stoppingPower:1, painMul:1 },
    medical:{ bleedChance:0.15, bleedSeverityMul:0.82, fractureChance:0.31, fractureSeverityMul:1.42, shockChance:0.22, bluntTraumaMul:1.3, tissueDamageMul:0.77 },
    projectile:{ massG:4.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '545_ppbs_gs': {
    id:'545_ppbs_gs',
    display:{ name:'5.45×39 PPBS gs (7N39)', shortName:'PPBS', group:'5.45x39mm', desc:'5.45 / 최상위 AP / 매우 높은 관통력 / 낮은 피해', tableOrder:11 },
    ballistic:{ caliber:'5.45x39mm', velocity:910, damage:39, penetration:64, accuracyMul:1.02, recoil:0.5, suppression:0.4 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.35, barrierStability:1.55, barrierDamageRetention:0.95, ricochetMul:1.8, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:59 },
    combat:{ stoppingPower:0.85, painMul:0.85 },
    medical:{ bleedChance:0.12, bleedSeverityMul:0.75, fractureChance:0.34, fractureSeverityMul:1.55, shockChance:0.22, bluntTraumaMul:1.35, tissueDamageMul:0.7 },
    projectile:{ massG:4.1 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },

  // ===== 7.62x39mm =====
  '762x39_hp': {
    id:'762x39_hp',
    display:{ name:'7.62×39 HP', shortName:'HP', group:'7.62x39mm', desc:'7.62×39 / 민수 HP / 비방호 고피해 / 방탄복에 매우 약함', tableOrder:1 },
    ballistic:{ caliber:'7.62x39mm', velocity:715, damage:84, penetration:18, accuracyMul:0.95, recoil:1, suppression:1.3 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
      barrierPenMul:0.45, barrierStability:0.45, barrierDamageRetention:0.4, ricochetMul:0.4, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:24 },
    combat:{ stoppingPower:1.4, painMul:1.4 },
    medical:{ bleedChance:0.55, bleedSeverityMul:1.5, fractureChance:0.22, fractureSeverityMul:1.2, shockChance:0.34, bluntTraumaMul:1.1, tissueDamageMul:1.6 },
    projectile:{ massG:8.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762x39_sp': {
    id:'762x39_sp',
    display:{ name:'7.62×39 SP', shortName:'SP', group:'7.62x39mm', desc:'7.62×39 / 민수 SP / 비방호·낮은 방호에 강함', tableOrder:2 },
    ballistic:{ caliber:'7.62x39mm', velocity:720, damage:69, penetration:22, accuracyMul:0.96, recoil:1, suppression:1.1 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:14, composite:13 },
      barrierPenMul:0.45, barrierStability:0.45, barrierDamageRetention:0.4, ricochetMul:0.4, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:26 },
    combat:{ stoppingPower:1.3, painMul:1.3 },
    medical:{ bleedChance:0.5, bleedSeverityMul:1.4, fractureChance:0.24, fractureSeverityMul:1.25, shockChance:0.32, bluntTraumaMul:1.15, tissueDamageMul:1.5 },
    projectile:{ massG:8.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762x39_us': {
    id:'762x39_us',
    display:{ name:'7.62×39 US (57-N-231U)', shortName:'US', group:'7.62x39mm', desc:'7.62×39 / 아음속탄 / 저반동·저관통·저제압', tableOrder:3 },
    ballistic:{ caliber:'7.62x39mm', velocity:305, damage:58, penetration:20, accuracyMul:0.92, recoil:0.4, suppression:0.5 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.75, barrierStability:1.1, barrierDamageRetention:0.85, ricochetMul:1, barrierBehavior:'subsonic',
    },
    durability:{ armorDamagePct:24 },
    combat:{ stoppingPower:1.05, painMul:1.05 },
    medical:{ bleedChance:0.28, bleedSeverityMul:0.95, fractureChance:0.14, fractureSeverityMul:0.9, shockChance:0.14, bluntTraumaMul:0.95, tissueDamageMul:0.95 },
    projectile:{ massG:12.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762x39_ps': {
    id:'762x39_ps',
    display:{ name:'7.62×39 PS (57-N-231)', shortName:'PS', group:'7.62x39mm', desc:'7.62×39 / 군용 표준탄 / AK 계열 기본 탄약', tableOrder:4 },
    ballistic:{ caliber:'7.62x39mm', velocity:718, damage:64, penetration:36, accuracyMul:1, recoil:1.2, suppression:1.2 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:4, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:1.1, barrierStability:0.85, barrierDamageRetention:0.9, ricochetMul:1.25, barrierBehavior:'normal_heavy',
    },
    durability:{ armorDamagePct:42 },
    combat:{ stoppingPower:1.3, painMul:1.3 },
    medical:{ bleedChance:0.34, bleedSeverityMul:1.15, fractureChance:0.3, fractureSeverityMul:1.35, shockChance:0.28, bluntTraumaMul:1.4, tissueDamageMul:1.15 },
    projectile:{ massG:7.9 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762x39_pp': {
    id:'762x39_pp',
    display:{ name:'7.62×39 PP (7N27)', shortName:'PP', group:'7.62x39mm', desc:'7.62×39 / 관통 강화탄 / 하드 방호 위협', tableOrder:5 },
    ballistic:{ caliber:'7.62x39mm', velocity:730, damage:60, penetration:50, accuracyMul:1.02, recoil:1.5, suppression:1.3 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:1.2, barrierStability:1.25, barrierDamageRetention:0.95, ricochetMul:1.45, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:50 },
    combat:{ stoppingPower:1.2, painMul:1.15 },
    medical:{ bleedChance:0.28, bleedSeverityMul:1.05, fractureChance:0.34, fractureSeverityMul:1.45, shockChance:0.28, bluntTraumaMul:1.45, tissueDamageMul:1.05 },
    projectile:{ massG:7.9 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762x39_bp': {
    id:'762x39_bp',
    display:{ name:'7.62×39 BP (7N23)', shortName:'BP', group:'7.62x39mm', desc:'7.62×39 / 철갑탄 / 7.62×39 최상위 관통', tableOrder:6 },
    ballistic:{ caliber:'7.62x39mm', velocity:745, damage:58, penetration:55, accuracyMul:1.02, recoil:1.7, suppression:1.4 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.3, barrierStability:1.35, barrierDamageRetention:0.95, ricochetMul:1.7, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:57 },
    combat:{ stoppingPower:1.1, painMul:1.05 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.95, fractureChance:0.38, fractureSeverityMul:1.55, shockChance:0.28, bluntTraumaMul:1.5, tissueDamageMul:0.95 },
    projectile:{ massG:7.9 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },

  // ===== 7.62x51mm =====
  '762_308_fmj': {
    id:'762_308_fmj',
    display:{ name:'.308 Win FMJ 130gr', shortName:'.308 FMJ', group:'7.62x51mm', desc:'7.62 / 사냥용 FMJ / 큰 피해 / 큰 반동', tableOrder:1 },
    ballistic:{ caliber:'7.62x51mm', velocity:850, damage:73, penetration:40, accuracyMul:1, recoil:1.8, suppression:1.5 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
      barrierPenMul:1.05, barrierStability:1.1, barrierDamageRetention:0.9, ricochetMul:1.25, barrierBehavior:'normal_fast',
    },
    durability:{ armorDamagePct:55 },
    combat:{ stoppingPower:1.3, painMul:1.3 },
    medical:{ bleedChance:0.4, bleedSeverityMul:1.3, fractureChance:0.36, fractureSeverityMul:1.55, shockChance:0.36, bluntTraumaMul:1.65, tissueDamageMul:1.3 },
    projectile:{ massG:9.5 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762_m80': {
    id:'762_m80',
    display:{ name:'7.62 M80', shortName:'M80', group:'7.62x51mm', desc:'7.62 / 표준 군용탄 / 큰 피해·제압 / 큰 반동', tableOrder:2 },
    ballistic:{ caliber:'7.62x51mm', velocity:833, damage:78, penetration:44, accuracyMul:1, recoil:2.4, suppression:2 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
      barrierPenMul:1.25, barrierStability:1.35, barrierDamageRetention:1, ricochetMul:1.45, barrierBehavior:'full_power',
    },
    durability:{ armorDamagePct:55 },
    combat:{ stoppingPower:1.35, painMul:1.35 },
    medical:{ bleedChance:0.42, bleedSeverityMul:1.35, fractureChance:0.38, fractureSeverityMul:1.6, shockChance:0.38, bluntTraumaMul:1.7, tissueDamageMul:1.35 },
    projectile:{ massG:9.5 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762_m80a1': {
    id:'762_m80a1',
    display:{ name:'7.62 M80A1 EPR', shortName:'M80A1 EPR', group:'7.62x51mm', desc:'7.62 / 고관통탄 / 재질 상성 적음 / 큰 반동', tableOrder:3 },
    ballistic:{ caliber:'7.62x51mm', velocity:850, damage:74, penetration:60, accuracyMul:1.02, recoil:2.3, suppression:1.8 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:4, aluminum:3, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.35, barrierStability:1.6, barrierDamageRetention:1.05, ricochetMul:1.45, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:68 },
    combat:{ stoppingPower:1.3, painMul:1.25 },
    medical:{ bleedChance:0.38, bleedSeverityMul:1.25, fractureChance:0.4, fractureSeverityMul:1.65, shockChance:0.38, bluntTraumaMul:1.75, tissueDamageMul:1.25 },
    projectile:{ massG:8.4 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762_m61_ap': {
    id:'762_m61_ap',
    display:{ name:'7.62 M61 AP', shortName:'M61', group:'7.62x51mm', desc:'7.62 / AP / 강철 관통자 / 고관통', tableOrder:4 },
    ballistic:{ caliber:'7.62x51mm', velocity:855, damage:70, penetration:63, accuracyMul:1.02, recoil:2.6, suppression:1.9 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.4, barrierStability:1.65, barrierDamageRetention:1, ricochetMul:1.7, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:75 },
    combat:{ stoppingPower:1.1, painMul:1.05 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.95, fractureChance:0.42, fractureSeverityMul:1.75, shockChance:0.32, bluntTraumaMul:1.8, tissueDamageMul:0.9 },
    projectile:{ massG:9.8 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '762_m993_ap': {
    id:'762_m993_ap',
    display:{ name:'7.62 M993 AP', shortName:'M993', group:'7.62x51mm', desc:'7.62 / AP / 텅스텐 관통자 / 최상위 관통탄', tableOrder:5 },
    ballistic:{ caliber:'7.62x51mm', velocity:910, damage:68, penetration:72, accuracyMul:1.02, recoil:2.8, suppression:2 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.55, barrierStability:1.95, barrierDamageRetention:0.95, ricochetMul:1.7, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:85 },
    combat:{ stoppingPower:1.05, painMul:1 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.85, fractureChance:0.45, fractureSeverityMul:1.8, shockChance:0.32, bluntTraumaMul:1.8, tissueDamageMul:0.8 },
    projectile:{ massG:8.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },

  // ===== 12ga =====
  '12g_00buck': {
    id:'12g_00buck',
    display:{ name:'12ga 00 Buckshot', shortName:'00 Buck', group:'12ga', desc:'12ga / 산탄 9펠릿 / 근거리 비방호 매우 위험 / 방탄판에는 한계', tableOrder:1 },
    ballistic:{ caliber:'12ga', velocity:400, damage:15, penetration:12, accuracyMul:0.85, recoil:2.5, suppression:1.5 },
    energy:{ class:'shotgun' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:8, steel:10, aluminum:7, titanium:12, ceramic:12, composite:11 },
      barrierPenMul:0.55, barrierStability:0.4, barrierDamageRetention:0.55, ricochetMul:1.4, barrierBehavior:'buckshot',
    },
    durability:{ armorDamagePct:10 },
    combat:{ stoppingPower:0.45, painMul:0.6 },
    projectile:{ projectileType:'pellet', pelletCount:9, patternType:'clustered_circle', massG:3.49, effectiveDiameterMm:8.4, medicalProjectileClass:'buckshot_pellet', pelletMedicalScalar:0.55, maxEntryClass:'small', maxInternalClass:'medium', maxExitClass:'small' },
    medical:{ bleedChance:0.24, bleedSeverityMul:0.65, fractureChance:0.07, fractureSeverityMul:0.85, shockChance:0.11, bluntTraumaMul:1.05, tissueDamageMul:0.74 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '12g_slug': {
    id:'12g_slug',
    display:{ name:'12ga Rifled Slug', shortName:'Slug', group:'12ga', desc:'12ga / 단일 대구경 / 매우 높은 저지력·둔상 / 방탄판도 큰 충격', tableOrder:2 },
    ballistic:{ caliber:'12ga', velocity:450, damage:95, penetration:32, accuracyMul:0.9, recoil:3, suppression:2.2 },
    energy:{ class:'shotgun' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:5, steel:7, aluminum:5, titanium:9, ceramic:10, composite:8 },
      barrierPenMul:0.95, barrierStability:0.85, barrierDamageRetention:0.85, ricochetMul:1.1, barrierBehavior:'normal_heavy',
    },
    durability:{ armorDamagePct:45 },
    combat:{ stoppingPower:1.9, painMul:1.65, bluntTraumaMul:1.7 },
    projectile:{ projectileType:'single', pelletCount:1, massG:28.35 },
    medical:{ bleedChance:0.42, bleedSeverityMul:1.4, fractureChance:0.48, fractureSeverityMul:1.85, shockChance:0.48, bluntTraumaMul:2, tissueDamageMul:1.55 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },
  '12g_flechette': {
    id:'12g_flechette',
    display:{ name:'12ga Flechette', shortName:'Flechette', group:'12ga', desc:'12ga / 화살형 20개 / 펠릿당 피해는 낮지만 다수 플레셰트가 얕고 좁은 상처를 만든다', tableOrder:3 },
    ballistic:{ caliber:'12ga', velocity:475, damage:5, penetration:20, accuracyMul:0.92, recoil:2.6, suppression:1.3 },
    energy:{ class:'shotgun' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:3, steel:6, aluminum:4, titanium:9, ceramic:10, composite:8 },
      barrierPenMul:0.8, barrierStability:0.55, barrierDamageRetention:0.55, ricochetMul:1.45, barrierBehavior:'penetrator_unstable',
    },
    durability:{ armorDamagePct:18 },
    combat:{ stoppingPower:0.35, painMul:0.5 },
    projectile:{ projectileType:'pellet', pelletCount:20, patternType:'flechette_cluster', massG:0.47, effectiveDiameterMm:1.5, medicalProjectileClass:'flechette_dart', pelletMedicalScalar:0.22, maxEntryClass:'micro', maxInternalClass:'small', maxExitClass:'small', forceProjectileSizeClass:'sabot_subcaliber' },
    medical:{ bleedChance:0.14, bleedSeverityMul:0.40, fractureChance:0.03, fractureSeverityMul:0.40, shockChance:0.05, bluntTraumaMul:0.55, tissueDamageMul:0.40 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true },
  },

  // ═══════════════════════════════════════════════════════════
  // SIDE-AMMO-1A: 신규 탄종 (탄약표/방호분석 표시, 동일 구경 무기에 연결)
  // ═══════════════════════════════════════════════════════════
  // ===== 4.6x30mm =====
  '4.6_dm11_ap_sx': {
    id:'4.6_dm11_ap_sx',
    display:{ name:'4.6×30mm DM11 / AP SX', shortName:'DM11 AP', group:'4.6x30mm', desc:'HK MP7용 강철 관통자 탄. 720 m/s의 고속으로 소프트아머·연질 방호를 잘 뚫지만, 경량 탄자 탓에 세라믹 하드플레이트 관통은 제한적이다.', tableOrder:1 },
    ballistic:{ caliber:'4.6x30mm', velocity:720, damage:36, penetration:43, accuracyMul:1.0, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:4, aluminum:2, titanium:4, ceramic:12, composite:10 },
      barrierPenMul:1.00, barrierStability:0.82, barrierDamageRetention:0.80, ricochetMul:1.18, barrierBehavior:'pdw_penetrator',
    },
    durability:{ armorDamagePct:36 },
    combat:{ stoppingPower:0.75, painMul:0.75 },
    medical:{ bleedChance:0.16, bleedSeverityMul:0.75, fractureChance:0.1, fractureSeverityMul:0.95, shockChance:0.1, bluntTraumaMul:0.8, tissueDamageMul:0.7 },
    projectile:{ massG:2.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '4.6_action_sx': {
    id:'4.6_action_sx',
    display:{ name:'4.6×30mm Action SX', shortName:'Action SX', group:'4.6x30mm', desc:'경찰·대테러용 팽창탄. 비방호 표적에 대한 저지력과 조직손상이 크지만 방호재 관통은 매우 낮다.', tableOrder:2 },
    ballistic:{ caliber:'4.6x30mm', velocity:700, damage:51, penetration:17, accuracyMul:0.95, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.55, barrierStability:0.35, barrierDamageRetention:0.42, ricochetMul:0.85, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:12 },
    combat:{ stoppingPower:1.15, painMul:1.1 },
    medical:{ bleedChance:0.34, bleedSeverityMul:1.2, fractureChance:0.08, fractureSeverityMul:0.85, shockChance:0.18, bluntTraumaMul:0.9, tissueDamageMul:1.25 },
    projectile:{ massG:2.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '4.6_fmj_sx': {
    id:'4.6_fmj_sx',
    display:{ name:'4.6×30mm FMJ SX', shortName:'FMJ SX', group:'4.6x30mm', desc:'표준 전피갑(FMJ) 연습·다목적탄. 균형형이나 관통·피해 모두 평범하다.', tableOrder:3 },
    ballistic:{ caliber:'4.6x30mm', velocity:600, damage:42, penetration:22, accuracyMul:1.0, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:6, steel:7, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.7, barrierStability:0.5, barrierDamageRetention:0.62, ricochetMul:1.1, barrierBehavior:'pdw_ball',
    },
    durability:{ armorDamagePct:38 },
    combat:{ stoppingPower:0.85, painMul:0.85 },
    medical:{ bleedChance:0.21, bleedSeverityMul:0.9, fractureChance:0.07, fractureSeverityMul:0.8, shockChance:0.12, bluntTraumaMul:0.9, tissueDamageMul:0.88 },
    projectile:{ massG:2.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '4.6_jsp_sx': {
    id:'4.6_jsp_sx',
    display:{ name:'4.6×30mm JSP SX', shortName:'JSP SX', group:'4.6x30mm', desc:'반피갑 소프트포인트. 명중 시 팽창해 비방호 피해를 키우지만 방호 관통은 낮다.', tableOrder:4 },
    ballistic:{ caliber:'4.6x30mm', velocity:690, damage:49, penetration:18, accuracyMul:0.95, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:10, steel:11, aluminum:8, titanium:12, ceramic:14, composite:13 },
      barrierPenMul:0.58, barrierStability:0.38, barrierDamageRetention:0.45, ricochetMul:0.9, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:29 },
    combat:{ stoppingPower:1.08, painMul:1.05 },
    medical:{ bleedChance:0.31, bleedSeverityMul:1.12, fractureChance:0.08, fractureSeverityMul:0.85, shockChance:0.17, bluntTraumaMul:0.9, tissueDamageMul:1.15 },
    projectile:{ massG:2.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '4.6_subsonic_sx': {
    id:'4.6_subsonic_sx',
    display:{ name:'4.6×30mm Subsonic SX', shortName:'Subsonic', group:'4.6x30mm', desc:'소음기 전용 아음속탄. 음속 이하로 발사음이 작지만 관통·에너지가 낮다.', tableOrder:5 },
    ballistic:{ caliber:'4.6x30mm', velocity:305, damage:38, penetration:16, accuracyMul:0.97, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:9, steel:10, aluminum:7, titanium:12, ceramic:14, composite:13 },
      barrierPenMul:0.5, barrierStability:0.45, barrierDamageRetention:0.55, ricochetMul:0.95, barrierBehavior:'subsonic',
    },
    durability:{ armorDamagePct:15 },
    combat:{ stoppingPower:0.8, painMul:0.82 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.82, fractureChance:0.06, fractureSeverityMul:0.75, shockChance:0.1, bluntTraumaMul:0.85, tissueDamageMul:0.78 },
    projectile:{ massG:5.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 5.7x28mm =====
  '5.7_ss190': {
    id:'5.7_ss190',
    display:{ name:'5.7×28mm SS190', shortName:'SS190', group:'5.7x28mm', desc:'FN P90/Five-seveN용 표준 군용탄. 강철·알루미늄 관통자로 소프트아머에 강하나 하드플레이트엔 제한적.', tableOrder:1 },
    ballistic:{ caliber:'5.7x28mm', velocity:716, damage:39, penetration:38, accuracyMul:1.0, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.95, barrierStability:0.8, barrierDamageRetention:0.84, ricochetMul:1.15, barrierBehavior:'pdw_penetrator',
    },
    durability:{ armorDamagePct:36 },
    combat:{ stoppingPower:0.78, painMul:0.78 },
    medical:{ bleedChance:0.17, bleedSeverityMul:0.78, fractureChance:0.09, fractureSeverityMul:0.9, shockChance:0.11, bluntTraumaMul:0.8, tissueDamageMul:0.72 },
    projectile:{ massG:2.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '5.7_l191_tracer': {
    id:'5.7_l191_tracer',
    display:{ name:'5.7×28mm L191 / SS191 Tracer', shortName:'L191', group:'5.7x28mm', desc:'SS190 기반 예광탄. 탄도 추적용 예광제 탓에 관통·피해는 SS190보다 약간 낮다.', tableOrder:2 },
    ballistic:{ caliber:'5.7x28mm', velocity:716, damage:37, penetration:36, accuracyMul:0.98, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.92, barrierStability:0.76, barrierDamageRetention:0.8, ricochetMul:1.15, barrierBehavior:'pdw_penetrator',
    },
    durability:{ armorDamagePct:30 },
    combat:{ stoppingPower:0.74, painMul:0.74 },
    projectile:{ projectileType:'tracer', massG:2.0 },
    medical:{ bleedChance:0.16, bleedSeverityMul:0.74, fractureChance:0.08, fractureSeverityMul:0.85, shockChance:0.1, bluntTraumaMul:0.78, tissueDamageMul:0.7 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '5.7_ss192_jhp': {
    id:'5.7_ss192_jhp',
    display:{ name:'5.7×28mm SS192 JHP', shortName:'SS192 JHP', group:'5.7x28mm', desc:'관통자 없는 할로우포인트 대인탄. 비방호 피해는 크지만 방호 관통은 거의 없다.', tableOrder:3 },
    ballistic:{ caliber:'5.7x28mm', velocity:715, damage:50, penetration:18, accuracyMul:0.95, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.55, barrierStability:0.34, barrierDamageRetention:0.4, ricochetMul:0.85, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:11 },
    combat:{ stoppingPower:1.1, painMul:1.06 },
    medical:{ bleedChance:0.34, bleedSeverityMul:1.18, fractureChance:0.08, fractureSeverityMul:0.85, shockChance:0.17, bluntTraumaMul:0.88, tissueDamageMul:1.22 },
    projectile:{ massG:1.8 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '5.7_sb193_subsonic': {
    id:'5.7_sb193_subsonic',
    display:{ name:'5.7×28mm SB193 / SS193 Subsonic', shortName:'SB193', group:'5.7x28mm', desc:'소음기용 아음속탄. 둔두형 탄자가 단단한 표면에서 잘 튕겨 도탄 위험이 크다.', tableOrder:4 },
    ballistic:{ caliber:'5.7x28mm', velocity:320, damage:39, penetration:18, accuracyMul:0.97, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:9, steel:10, aluminum:7, titanium:12, ceramic:13, composite:13 },
      barrierPenMul:0.52, barrierStability:0.46, barrierDamageRetention:0.56, ricochetMul:1.35, barrierBehavior:'subsonic',
    },
    durability:{ armorDamagePct:28 },
    combat:{ stoppingPower:0.84, painMul:0.84 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.82, fractureChance:0.06, fractureSeverityMul:0.75, shockChance:0.1, bluntTraumaMul:0.84, tissueDamageMul:0.78 },
    projectile:{ massG:3.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '5.7_r37f': {
    id:'5.7_r37f',
    display:{ name:'5.7×28mm R37.F', shortName:'R37.F', group:'5.7x28mm', desc:'민수용 파쇄·팽창 특수탄. 비방호 조직손상은 극대이나 방호재 상대로는 거의 무력하다.', tableOrder:5 },
    ballistic:{ caliber:'5.7x28mm', velocity:650, damage:62, penetration:12, accuracyMul:0.95, recoil:0.3, suppression:0.5 },
    energy:{ class:'pdw' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:5, pe:13, steel:13, aluminum:10, titanium:14, ceramic:16, composite:15 },
      barrierPenMul:0.45, barrierStability:0.22, barrierDamageRetention:0.28, ricochetMul:0.75, barrierBehavior:'fragment',
    },
    durability:{ armorDamagePct:8 },
    combat:{ stoppingPower:1.25, painMul:1.18 },
    medical:{ bleedChance:0.44, bleedSeverityMul:1.35, fractureChance:0.08, fractureSeverityMul:0.8, shockChance:0.22, bluntTraumaMul:0.85, tissueDamageMul:1.45 },
    projectile:{ massG:2.4 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 9x19mm =====
  '9mm_luger_tracer': {
    id:'9mm_luger_tracer',
    display:{ name:'9mm Luger Tracer', shortName:'Tracer', group:'9x19mm', desc:'권총·기관단총용 예광탄. 야간 탄착 확인용으로, 직접 성능은 일반 FMJ와 비슷하거나 약간 낮다.', tableOrder:1 },
    ballistic:{ caliber:'9x19mm', velocity:330, damage:52, penetration:16, accuracyMul:0.98, recoil:0.2, suppression:0.4 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.68, barrierStability:0.42, barrierDamageRetention:0.62, ricochetMul:1.2, barrierBehavior:'round_fmj',
    },
    durability:{ armorDamagePct:12 },
    combat:{ stoppingPower:0.88, painMul:0.84 },
    projectile:{ projectileType:'tracer', massG:8.04 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.88, fractureChance:0.06, fractureSeverityMul:0.78, shockChance:0.1, bluntTraumaMul:0.92, tissueDamageMul:0.82 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  // ===== 9x21mm =====
  '9x21_sp10_7n29': {
    id:'9x21_sp10_7n29',
    display:{ name:'9×21mm SP-10 (7N29)', shortName:'PS', group:'9x21mm', desc:'SR-1 그유르자/SR-2용 강철심 고관통 권총탄. 소프트아머·방탄헬멧에 위협적이다.', tableOrder:1 },
    ballistic:{ caliber:'9x21mm', velocity:410, damage:56, penetration:34, accuracyMul:1.0, recoil:0.5, suppression:0.6 },
    energy:{ class:'pistol_ap' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.92, barrierStability:0.74, barrierDamageRetention:0.8, ricochetMul:1.15, barrierBehavior:'pistol_penetrator',
    },
    durability:{ armorDamagePct:24 },
    combat:{ stoppingPower:1.02, painMul:0.98 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.95, fractureChance:0.12, fractureSeverityMul:1.0, shockChance:0.14, bluntTraumaMul:0.95, tissueDamageMul:0.86 },
    projectile:{ massG:6.7 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x21_sp11_7n28': {
    id:'9x21_sp11_7n28',
    display:{ name:'9×21mm SP-11 (7N28)', shortName:'P', group:'9x21mm', desc:'납심 전피갑 대인탄. 비방호 표적용으로 균형 잡힌 저지력을 가진다.', tableOrder:2 },
    ballistic:{ caliber:'9x21mm', velocity:390, damage:62, penetration:22, accuracyMul:1.0, recoil:0.2, suppression:0.4 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:6, steel:7, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.72, barrierStability:0.5, barrierDamageRetention:0.66, ricochetMul:1.15, barrierBehavior:'round_fmj',
    },
    durability:{ armorDamagePct:15 },
    combat:{ stoppingPower:1.08, painMul:1.02 },
    medical:{ bleedChance:0.24, bleedSeverityMul:1.0, fractureChance:0.08, fractureSeverityMul:0.9, shockChance:0.14, bluntTraumaMul:1.0, tissueDamageMul:0.95 },
    projectile:{ massG:7.5 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x21_sp12_jhp': {
    id:'9x21_sp12_jhp',
    display:{ name:'9×21mm SP-12 JHP', shortName:'PE', group:'9x21mm', desc:'팽창형 할로우포인트. 비방호 표적 저지력이 매우 높으나 방호 관통은 낮다.', tableOrder:3 },
    ballistic:{ caliber:'9x21mm', velocity:400, damage:72, penetration:16, accuracyMul:0.95, recoil:0.2, suppression:0.4 },
    energy:{ class:'pistol' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.55, barrierStability:0.32, barrierDamageRetention:0.4, ricochetMul:0.85, barrierBehavior:'deform',
    },
    durability:{ armorDamagePct:10 },
    combat:{ stoppingPower:1.3, painMul:1.2 },
    medical:{ bleedChance:0.42, bleedSeverityMul:1.35, fractureChance:0.1, fractureSeverityMul:0.95, shockChance:0.24, bluntTraumaMul:0.95, tissueDamageMul:1.38 },
    projectile:{ massG:5.7 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x21_sp13_7bt3': {
    id:'9x21_sp13_7bt3',
    display:{ name:'9×21mm SP-13 (7BT3) AP-T', shortName:'BT', group:'9x21mm', desc:'철갑예광 권총탄. SP-10 계열 관통력에 예광 추적 기능을 더한 탄.', tableOrder:4 },
    ballistic:{ caliber:'9x21mm', velocity:395, damage:53, penetration:33, accuracyMul:0.98, recoil:0.5, suppression:0.6 },
    energy:{ class:'pistol_ap' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.9, barrierStability:0.72, barrierDamageRetention:0.78, ricochetMul:1.15, barrierBehavior:'pistol_penetrator',
    },
    durability:{ armorDamagePct:30 },
    combat:{ stoppingPower:0.98, painMul:0.94 },
    projectile:{ projectileType:'tracer', massG:7.3 },
    medical:{ bleedChance:0.21, bleedSeverityMul:0.9, fractureChance:0.11, fractureSeverityMul:0.95, shockChance:0.13, bluntTraumaMul:0.92, tissueDamageMul:0.82 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['ap_t', 'tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '9x21_7n42': {
    id:'9x21_7n42',
    display:{ name:'9×21mm 7N42', shortName:'7N42', group:'9x21mm', desc:'SP-10 계열 상위 고관통탄. 최신 방탄헬멧·소프트아머에 강하다.', tableOrder:5 },
    ballistic:{ caliber:'9x21mm', velocity:410, damage:54, penetration:39, accuracyMul:1.0, recoil:0.5, suppression:0.6 },
    energy:{ class:'pistol_ap' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:0.98, barrierStability:0.8, barrierDamageRetention:0.86, ricochetMul:1.18, barrierBehavior:'pistol_penetrator',
    },
    durability:{ armorDamagePct:38 },
    combat:{ stoppingPower:0.98, painMul:0.94 },
    medical:{ bleedChance:0.2, bleedSeverityMul:0.88, fractureChance:0.13, fractureSeverityMul:1.05, shockChance:0.13, bluntTraumaMul:0.95, tissueDamageMul:0.78 },
    projectile:{ massG:6.7 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x21_7u4_subsonic': {
    id:'9x21_7u4_subsonic',
    display:{ name:'9×21mm 7U4 Subsonic', shortName:'7U4', group:'9x21mm', desc:'소음기용 아음속 중량탄. 발사음이 작고 비방호 저지력은 유지된다.', tableOrder:6 },
    ballistic:{ caliber:'9x21mm', velocity:300, damage:54, penetration:20, accuracyMul:0.97, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:3, pe:9, steel:10, aluminum:7, titanium:12, ceramic:14, composite:13 },
      barrierPenMul:0.58, barrierStability:0.48, barrierDamageRetention:0.58, ricochetMul:0.95, barrierBehavior:'subsonic',
    },
    durability:{ armorDamagePct:26 },
    combat:{ stoppingPower:0.98, painMul:0.95 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.92, fractureChance:0.07, fractureSeverityMul:0.85, shockChance:0.12, bluntTraumaMul:0.95, tissueDamageMul:0.88 },
    projectile:{ massG:10.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 9x39mm =====
  '9x39_sp5_7n8': {
    id:'9x39_sp5_7n8',
    display:{ name:'9×39mm SP-5 (7N8)', shortName:'SP-5', group:'9x39mm', desc:'VSS/AS Val용 아음속 정밀 대인탄. 느리지만 무거워 근거리 저지력이 크다.', tableOrder:1 },
    ballistic:{ caliber:'9x39mm', velocity:290, damage:82, penetration:28, accuracyMul:0.97, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:9, aluminum:6, titanium:11, ceramic:13, composite:12 },
      barrierPenMul:0.68, barrierStability:0.62, barrierDamageRetention:0.72, ricochetMul:0.85, barrierBehavior:'heavy_subsonic',
    },
    durability:{ armorDamagePct:25 },
    combat:{ stoppingPower:1.35, painMul:1.18 },
    medical:{ bleedChance:0.32, bleedSeverityMul:1.1, fractureChance:0.12, fractureSeverityMul:1.1, shockChance:0.2, bluntTraumaMul:1.2, tissueDamageMul:1.08 },
    projectile:{ massG:16.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x39_sp6_7n9': {
    id:'9x39_sp6_7n9',
    display:{ name:'9×39mm SP-6 (7N9)', shortName:'SP-6', group:'9x39mm', desc:'아음속 철갑탄. 강철심으로 근거리에서 소프트아머·하드플레이트를 위협한다.', tableOrder:2 },
    ballistic:{ caliber:'9x39mm', velocity:295, damage:78, penetration:45, accuracyMul:1.0, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.88, barrierStability:0.78, barrierDamageRetention:0.84, ricochetMul:0.95, barrierBehavior:'slow_penetrator',
    },
    durability:{ armorDamagePct:45 },
    combat:{ stoppingPower:1.22, painMul:1.05 },
    medical:{ bleedChance:0.26, bleedSeverityMul:0.95, fractureChance:0.15, fractureSeverityMul:1.15, shockChance:0.18, bluntTraumaMul:1.15, tissueDamageMul:0.9 },
    projectile:{ massG:16.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x39_pab9': {
    id:'9x39_pab9',
    display:{ name:'9×39mm PAB-9', shortName:'PAB-9', group:'9x39mm', desc:'SP-6 염가 대체형 철갑탄. 관통은 비슷하나 탄도 안정성이 낮고 방어구 손상이 크다.', tableOrder:3 },
    ballistic:{ caliber:'9x39mm', velocity:300, damage:76, penetration:42, accuracyMul:1.0, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:4, steel:7, aluminum:5, titanium:9, ceramic:10, composite:9 },
      barrierPenMul:0.84, barrierStability:0.62, barrierDamageRetention:0.72, ricochetMul:1.05, barrierBehavior:'slow_penetrator_unstable',
    },
    durability:{ armorDamagePct:40 },
    combat:{ stoppingPower:1.18, painMul:1.03 },
    medical:{ bleedChance:0.25, bleedSeverityMul:0.94, fractureChance:0.14, fractureSeverityMul:1.1, shockChance:0.17, bluntTraumaMul:1.12, tissueDamageMul:0.88 },
    projectile:{ massG:17.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '9x39_bp_7n12': {
    id:'9x39_bp_7n12',
    display:{ name:'9×39mm BP (7N12)', shortName:'BP', group:'9x39mm', desc:'9×39 계열 최상위 고관통 아음속 철갑탄.', tableOrder:4 },
    ballistic:{ caliber:'9x39mm', velocity:295, damage:75, penetration:50, accuracyMul:1.0, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:0.95, barrierStability:0.84, barrierDamageRetention:0.88, ricochetMul:1.0, barrierBehavior:'slow_penetrator_high',
    },
    durability:{ armorDamagePct:53 },
    combat:{ stoppingPower:1.15, painMul:1.0 },
    medical:{ bleedChance:0.24, bleedSeverityMul:0.9, fractureChance:0.16, fractureSeverityMul:1.2, shockChance:0.17, bluntTraumaMul:1.15, tissueDamageMul:0.84 },
    projectile:{ massG:15.5 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== .300blk =====
  '300blk_vmax_110': {
    id:'300blk_vmax_110',
    display:{ name:'.300 BLK V-Max 110gr', shortName:'V-Max', group:'.300blk', desc:'초음속 폴리머 팁 파편화탄. 비방호 표적에 극심한 조직손상을 주지만 방호 관통은 낮다.', tableOrder:1 },
    ballistic:{ caliber:'.300 BLK', velocity:720, damage:76, penetration:22, accuracyMul:0.95, recoil:0.7, suppression:0.7 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.58, barrierStability:0.3, barrierDamageRetention:0.38, ricochetMul:0.82, barrierBehavior:'fragment',
    },
    durability:{ armorDamagePct:18 },
    combat:{ stoppingPower:1.35, painMul:1.2 },
    medical:{ bleedChance:0.46, bleedSeverityMul:1.42, fractureChance:0.12, fractureSeverityMul:1.0, shockChance:0.26, bluntTraumaMul:0.95, tissueDamageMul:1.5 },
    projectile:{ massG:7.1 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '300blk_fmj_147': {
    id:'300blk_fmj_147',
    display:{ name:'.300 BLK FMJ 147gr', shortName:'BCP FMJ', group:'.300blk', desc:'초음속 전피갑 다목적탄. 5.56보다 느리고 무거워 근중거리 안정성이 좋다.', tableOrder:2 },
    ballistic:{ caliber:'.300 BLK', velocity:610, damage:70, penetration:34, accuracyMul:1.0, recoil:0.7, suppression:0.7 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:4, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.75, barrierStability:0.58, barrierDamageRetention:0.68, ricochetMul:1.08, barrierBehavior:'normal_heavy',
    },
    durability:{ armorDamagePct:29 },
    combat:{ stoppingPower:1.15, painMul:1.05 },
    medical:{ bleedChance:0.28, bleedSeverityMul:1.02, fractureChance:0.1, fractureSeverityMul:1.0, shockChance:0.17, bluntTraumaMul:1.05, tissueDamageMul:0.98 },
    projectile:{ massG:9.4 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '300blk_m62_tracer': {
    id:'300blk_m62_tracer',
    display:{ name:'.300 BLK M62-style Tracer', shortName:'M62', group:'.300blk', desc:'.300 BLK 예광탄. 탄착 추적용으로 관통·피해는 표준탄보다 약간 낮다.', tableOrder:3 },
    ballistic:{ caliber:'.300 BLK', velocity:500, damage:66, penetration:30, accuracyMul:0.98, recoil:0.7, suppression:0.7 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:5, steel:7, aluminum:5, titanium:9, ceramic:10, composite:9 },
      barrierPenMul:0.7, barrierStability:0.52, barrierDamageRetention:0.62, ricochetMul:1.1, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:32 },
    combat:{ stoppingPower:1.05, painMul:0.98 },
    projectile:{ projectileType:'tracer', massG:9.2 },
    medical:{ bleedChance:0.25, bleedSeverityMul:0.96, fractureChance:0.09, fractureSeverityMul:0.95, shockChance:0.15, bluntTraumaMul:1.0, tissueDamageMul:0.92 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '300blk_cbj': {
    id:'300blk_cbj',
    display:{ name:'.300 BLK CBJ', shortName:'CBJ', group:'.300blk', desc:'사보트식 텅스텐 관통자 탄. 초음속 소구경 관통자로 하드타겟에 특화, 조직피해는 좁고 깊다.', tableOrder:4 },
    ballistic:{ caliber:'.300 BLK', velocity:725, damage:58, penetration:56, accuracyMul:1.02, recoil:0.7, suppression:0.7 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:2, aluminum:1, titanium:3, ceramic:8, composite:6 },
      barrierPenMul:1.15, barrierStability:0.96, barrierDamageRetention:0.94, ricochetMul:1.18, barrierBehavior:'sabot_penetrator',
    },
    durability:{ armorDamagePct:52 },
    combat:{ stoppingPower:0.95, painMul:0.9 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.82, fractureChance:0.16, fractureSeverityMul:1.15, shockChance:0.15, bluntTraumaMul:0.98, tissueDamageMul:0.78 },
    projectile:{ massG:7.1 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['sabot_ap', 'cbj_subcaliber', 'futureOnly'] },
  },
  '300blk_ap_hardcore': {
    id:'300blk_ap_hardcore',
    display:{ name:'.300 BLK AP / Hard Core', shortName:'AP', group:'.300blk', desc:'경화강심 철갑탄. M855A1급 관통에 근접하나 텅스텐 AP(M995/M993)급에는 못 미친다.', tableOrder:5 },
    ballistic:{ caliber:'.300 BLK', velocity:620, damage:62, penetration:48, accuracyMul:1.0, recoil:0.7, suppression:0.7 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:0.96, barrierStability:0.8, barrierDamageRetention:0.86, ricochetMul:1.12, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:46 },
    combat:{ stoppingPower:1.0, painMul:0.94 },
    medical:{ bleedChance:0.23, bleedSeverityMul:0.86, fractureChance:0.15, fractureSeverityMul:1.1, shockChance:0.15, bluntTraumaMul:1.0, tissueDamageMul:0.82 },
    projectile:{ massG:8.4 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '300blk_220_subsonic': {
    id:'300blk_220_subsonic',
    display:{ name:'.300 BLK 220gr Subsonic', shortName:'Whisper', group:'.300blk', desc:'소음기용 220그레인 중량 아음속탄. 발사음이 매우 작고 근거리 저지력이 높다.', tableOrder:6 },
    ballistic:{ caliber:'.300 BLK', velocity:315, damage:78, penetration:26, accuracyMul:0.97, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:9, aluminum:6, titanium:11, ceramic:13, composite:12 },
      barrierPenMul:0.62, barrierStability:0.58, barrierDamageRetention:0.68, ricochetMul:0.88, barrierBehavior:'heavy_subsonic',
    },
    durability:{ armorDamagePct:15 },
    combat:{ stoppingPower:1.3, painMul:1.16 },
    medical:{ bleedChance:0.3, bleedSeverityMul:1.08, fractureChance:0.12, fractureSeverityMul:1.08, shockChance:0.2, bluntTraumaMul:1.18, tissueDamageMul:1.02 },
    projectile:{ massG:14.26, diameterMm:7.62, subsonicClass:'heavy' },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 5.56x45mm =====
  '556_m856_tracer': {
    id:'556_m856_tracer',
    display:{ name:'5.56×45mm M856 Tracer', shortName:'M856', group:'5.56x45mm', desc:'M855 기반 예광탄. 탄착 추적용으로 직접 관통·피해는 M855보다 낮다.', tableOrder:1 },
    ballistic:{ caliber:'5.56x45mm', velocity:900, damage:50, penetration:39, accuracyMul:0.98, recoil:0.5, suppression:0.7 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.72, barrierStability:0.54, barrierDamageRetention:0.64, ricochetMul:1.12, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:18 },
    combat:{ stoppingPower:0.88, painMul:0.84 },
    projectile:{ projectileType:'tracer', massG:4.13 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.88, fractureChance:0.08, fractureSeverityMul:0.82, shockChance:0.12, bluntTraumaMul:0.85, tissueDamageMul:0.82 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '556_m856a1_tracer': {
    id:'556_m856a1_tracer',
    display:{ name:'5.56×45mm M856A1 Tracer', shortName:'M856A1', group:'5.56x45mm', desc:'M855A1 계열 EPR 예광탄. M856보다 관통이 높고 M855A1보다는 약간 낮다.', tableOrder:2 },
    ballistic:{ caliber:'5.56x45mm', velocity:930, damage:48, penetration:50, accuracyMul:0.98, recoil:0.5, suppression:0.7 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:0.96, barrierStability:0.76, barrierDamageRetention:0.82, ricochetMul:1.15, barrierBehavior:'tracer_epr',
    },
    durability:{ armorDamagePct:35 },
    combat:{ stoppingPower:0.84, painMul:0.8 },
    projectile:{ projectileType:'tracer', massG:3.6 },
    medical:{ bleedChance:0.2, bleedSeverityMul:0.82, fractureChance:0.11, fractureSeverityMul:0.95, shockChance:0.12, bluntTraumaMul:0.86, tissueDamageMul:0.76 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  // ===== 5.45x39mm =====
  '545_7t3_tracer': {
    id:'545_7t3_tracer',
    display:{ name:'5.45×39 T gs (7T3)', shortName:'T', group:'5.45x39mm', desc:'5.45×39 표준 예광탄. 탄착 추적용으로 PS보다 관통·피해가 약간 낮다.', tableOrder:1 },
    ballistic:{ caliber:'5.45x39mm', velocity:885, damage:45, penetration:27, accuracyMul:0.98, recoil:0.5, suppression:0.7 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.65, barrierStability:0.5, barrierDamageRetention:0.6, ricochetMul:1.12, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:20 },
    combat:{ stoppingPower:0.78, painMul:0.76 },
    projectile:{ projectileType:'tracer', massG:3.2 },
    medical:{ bleedChance:0.2, bleedSeverityMul:0.82, fractureChance:0.07, fractureSeverityMul:0.78, shockChance:0.1, bluntTraumaMul:0.8, tissueDamageMul:0.76 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '545_7bt4_aptracer': {
    id:'545_7bt4_aptracer',
    display:{ name:'5.45×39 BT gs (7BT4)', shortName:'BT', group:'5.45x39mm', desc:'철갑예광탄. 7T3보다 관통이 높고 BP/BS 철갑탄보다는 낮다.', tableOrder:2 },
    ballistic:{ caliber:'5.45x39mm', velocity:880, damage:43, penetration:47, accuracyMul:0.98, recoil:0.5, suppression:0.7 },
    energy:{ class:'small_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:0.92, barrierStability:0.74, barrierDamageRetention:0.8, ricochetMul:1.15, barrierBehavior:'tracer_ap',
    },
    durability:{ armorDamagePct:37 },
    combat:{ stoppingPower:0.76, painMul:0.72 },
    projectile:{ projectileType:'tracer', massG:4.4 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.76, fractureChance:0.11, fractureSeverityMul:0.95, shockChance:0.11, bluntTraumaMul:0.8, tissueDamageMul:0.7 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['ap_t', 'tracer', 'futureNearMiss', 'futureOnly'] },
  },
  // ===== 7.62x39mm =====
  '762x39_t45m_tracer': {
    id:'762x39_t45m_tracer',
    display:{ name:'7.62×39 T-45M (7T2)', shortName:'T-45M', group:'7.62x39mm', desc:'7.62×39 예광탄. 탄착 추적용으로 PS보다 관통·피해가 약간 낮다.', tableOrder:1 },
    ballistic:{ caliber:'7.62x39mm', velocity:720, damage:60, penetration:32, accuracyMul:0.98, recoil:0.7, suppression:0.7 },
    energy:{ class:'intermediate_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:5, steel:7, aluminum:5, titanium:9, ceramic:10, composite:9 },
      barrierPenMul:0.7, barrierStability:0.54, barrierDamageRetention:0.64, ricochetMul:1.1, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:30 },
    combat:{ stoppingPower:1.0, painMul:0.96 },
    projectile:{ projectileType:'tracer', massG:7.6 },
    medical:{ bleedChance:0.25, bleedSeverityMul:0.94, fractureChance:0.08, fractureSeverityMul:0.9, shockChance:0.14, bluntTraumaMul:0.96, tissueDamageMul:0.9 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  // ===== 7.62x51mm =====
  '762x51_m62_tracer': {
    id:'762x51_m62_tracer',
    display:{ name:'7.62×51mm M62 Tracer', shortName:'M62', group:'7.62x51mm', desc:'M80 기반 예광탄. 기관총 탄착 추적용으로 직접 성능은 M80보다 약간 낮다.', tableOrder:1 },
    ballistic:{ caliber:'7.62x51mm', velocity:830, damage:72, penetration:40, accuracyMul:0.98, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:7, steel:9, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.72, barrierStability:0.56, barrierDamageRetention:0.66, ricochetMul:1.12, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:39 },
    combat:{ stoppingPower:1.1, painMul:1.0 },
    projectile:{ projectileType:'tracer', massG:9.2 },
    medical:{ bleedChance:0.27, bleedSeverityMul:0.98, fractureChance:0.1, fractureSeverityMul:0.95, shockChance:0.16, bluntTraumaMul:1.0, tissueDamageMul:0.92 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '762x51_m948_slap': {
    id:'762x51_m948_slap',
    display:{ name:'7.62×51mm M948 SLAP', shortName:'M948 SLAP', group:'7.62x51mm', desc:'사보트식 경장갑 관통 특수탄. 1210 m/s 초고속 소구경 텅스텐 관통자로 하드타겟에 특화되며, 일반 7.62보다 조직피해는 좁고 깊다.', tableOrder:2 },
    ballistic:{ caliber:'7.62x51mm', velocity:1210, damage:58, penetration:87, accuracyMul:0.98, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:1, aluminum:0, titanium:3, ceramic:5, composite:4 },
      barrierPenMul:1.30, barrierStability:1.00, barrierDamageRetention:0.90, ricochetMul:1.33, barrierBehavior:'sabot_tungsten_ap',
    },
    durability:{ armorDamagePct:78 },
    combat:{ stoppingPower:0.86, painMul:0.78 },
    medical:{ bleedChance:0.18, bleedSeverityMul:0.7, fractureChance:0.2, fractureSeverityMul:1.2, shockChance:0.13, bluntTraumaMul:0.9, tissueDamageMul:0.62 },
    projectile:{ massG:4.02 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['slap', 'sabot_ap', 'weaponCompatibilityCaution', 'futureOnly'] },
  },
  // ===== 7.62x54r =====
  '762x54r_lps_gzh': {
    id:'762x54r_lps_gzh',
    display:{ name:'7.62×54R LPS gs', shortName:'LPS', group:'7.62x54r', desc:'러시아 풀파워 연강심 표준탄. SVD/PKM에 두루 쓰이는 다목적탄.', tableOrder:1 },
    ballistic:{ caliber:'7.62x54mmR', velocity:830, damage:82, penetration:48, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:4, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.8, barrierStability:0.62, barrierDamageRetention:0.72, ricochetMul:1.1, barrierBehavior:'normal_heavy',
    },
    durability:{ armorDamagePct:40 },
    combat:{ stoppingPower:1.22, painMul:1.08 },
    medical:{ bleedChance:0.3, bleedSeverityMul:1.05, fractureChance:0.12, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.08, tissueDamageMul:1.0 },
    projectile:{ massG:9.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '762x54r_t46m': {
    id:'762x54r_t46m',
    display:{ name:'7.62×54R T-46M gs (7T2)', shortName:'T-46M', group:'7.62x54r', desc:'7.62×54R 예광탄. 기관총 탄착 추적용.', tableOrder:2 },
    ballistic:{ caliber:'7.62x54mmR', velocity:800, damage:77, penetration:43, accuracyMul:0.98, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:7, steel:9, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.72, barrierStability:0.56, barrierDamageRetention:0.66, ricochetMul:1.12, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:39 },
    combat:{ stoppingPower:1.12, painMul:1.0 },
    projectile:{ projectileType:'tracer', massG:9.4 },
    medical:{ bleedChance:0.27, bleedSeverityMul:0.98, fractureChance:0.1, fractureSeverityMul:0.95, shockChance:0.16, bluntTraumaMul:1.0, tissueDamageMul:0.92 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '762x54r_7n1': {
    id:'762x54r_7n1',
    display:{ name:'7.62×54R PS (7N1)', shortName:'PS', group:'7.62x54r', desc:'SVD용 저격 전용탄. 관통보다 정밀성과 안정적 조직손상에 중점.', tableOrder:3 },
    ballistic:{ caliber:'7.62x54mmR', velocity:830, damage:80, penetration:50, accuracyMul:1.03, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:5, steel:7, aluminum:5, titanium:9, ceramic:10, composite:9 },
      barrierPenMul:0.78, barrierStability:0.68, barrierDamageRetention:0.75, ricochetMul:1.05, barrierBehavior:'precision_heavy',
    },
    durability:{ armorDamagePct:43 },
    combat:{ stoppingPower:1.18, painMul:1.05 },
    medical:{ bleedChance:0.32, bleedSeverityMul:1.08, fractureChance:0.11, fractureSeverityMul:1.0, shockChance:0.18, bluntTraumaMul:1.02, tissueDamageMul:1.05 },
    projectile:{ massG:9.8 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '762x54r_7bt1': {
    id:'762x54r_7bt1',
    display:{ name:'7.62×54R BT gs (7BT1)', shortName:'BT', group:'7.62x54r', desc:'철갑예광탄. 관통과 탄착 추적을 겸한다.', tableOrder:4 },
    ballistic:{ caliber:'7.62x54mmR', velocity:800, damage:76, penetration:58, accuracyMul:0.98, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:0.92, barrierStability:0.76, barrierDamageRetention:0.82, ricochetMul:1.15, barrierBehavior:'tracer_ap',
    },
    durability:{ armorDamagePct:53 },
    combat:{ stoppingPower:1.05, painMul:0.96 },
    projectile:{ projectileType:'tracer', massG:9.2 },
    medical:{ bleedChance:0.24, bleedSeverityMul:0.9, fractureChance:0.13, fractureSeverityMul:1.08, shockChance:0.15, bluntTraumaMul:1.0, tissueDamageMul:0.82 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['ap_t', 'tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '762x54r_7n14_snb': {
    id:'762x54r_7n14_snb',
    display:{ name:'7.62×54R SNB (7N14)', shortName:'SNB', group:'7.62x54r', desc:'SVD용 강철심 정밀 철갑 저격탄.', tableOrder:5 },
    ballistic:{ caliber:'7.62x54mmR', velocity:830, damage:78, penetration:63, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.0, barrierStability:0.82, barrierDamageRetention:0.88, ricochetMul:1.12, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:62 },
    combat:{ stoppingPower:1.02, painMul:0.94 },
    medical:{ bleedChance:0.23, bleedSeverityMul:0.86, fractureChance:0.15, fractureSeverityMul:1.15, shockChance:0.15, bluntTraumaMul:1.0, tissueDamageMul:0.78 },
    projectile:{ massG:9.8 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '762x54r_7n37_bs': {
    id:'762x54r_7n37_bs',
    display:{ name:'7.62×54R BS gs (7N37)', shortName:'BS', group:'7.62x54r', desc:'텅스텐심 최상위 고관통 철갑탄. M993급 이상으로 하드플레이트를 위협한다.', tableOrder:6 },
    ballistic:{ caliber:'7.62x54mmR', velocity:815, damage:72, penetration:76, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:0, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.18, barrierStability:0.92, barrierDamageRetention:0.96, ricochetMul:1.22, barrierBehavior:'tungsten_ap',
    },
    durability:{ armorDamagePct:70 },
    combat:{ stoppingPower:0.95, painMul:0.88 },
    medical:{ bleedChance:0.21, bleedSeverityMul:0.78, fractureChance:0.18, fractureSeverityMul:1.25, shockChance:0.15, bluntTraumaMul:1.05, tissueDamageMul:0.7 },
    projectile:{ massG:12.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 6.8x51mm =====
  '68x51_sig_fmj': {
    id:'68x51_sig_fmj',
    display:{ name:'6.8×51mm SIG FMJ', shortName:'SIG FMJ', group:'6.8x51mm', desc:'상용압 6.8 전피갑탄. NGSW 계열의 일반 다목적탄.', tableOrder:1 },
    ballistic:{ caliber:'6.8x51mm', velocity:850, damage:84, penetration:54, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:8, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.82, barrierStability:0.66, barrierDamageRetention:0.76, ricochetMul:1.1, barrierBehavior:'full_power_ball',
    },
    durability:{ armorDamagePct:34 },
    combat:{ stoppingPower:1.18, painMul:1.06 },
    projectile:{ massG:8.75 },
    medical:{ bleedChance:0.3, bleedSeverityMul:1.04, fractureChance:0.12, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.05, tissueDamageMul:1.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '68x51_sig_hybrid': {
    id:'68x51_sig_hybrid',
    display:{ name:'6.8×51mm SIG Hybrid', shortName:'Hybrid', group:'6.8x51mm', desc:'하이브리드 케이스 고압탄. 고속으로 차폐물 관통과 하드 방호 위협이 크다.', tableOrder:2 },
    ballistic:{ caliber:'6.8x51mm', velocity:915, damage:82, penetration:60, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:5, steel:6, aluminum:4, titanium:8, ceramic:10, composite:9 },
      barrierPenMul:0.92, barrierStability:0.72, barrierDamageRetention:0.82, ricochetMul:1.12, barrierBehavior:'barrier_blind',
    },
    durability:{ armorDamagePct:43 },
    combat:{ stoppingPower:1.15, painMul:1.02 },
    projectile:{ massG:7.32 },
    medical:{ bleedChance:0.28, bleedSeverityMul:1.0, fractureChance:0.13, fractureSeverityMul:1.1, shockChance:0.18, bluntTraumaMul:1.04, tissueDamageMul:0.96 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '68x51_xm1186': {
    id:'68x51_xm1186',
    display:{ name:'6.8×51mm XM1186 EPR', shortName:'XM1186 EPR', group:'6.8x51mm', desc:'차세대 일반/다목적 EPR. M80A1보다 강한 위치의 현대 보병탄.', tableOrder:3 },
    ballistic:{ caliber:'6.8x51mm', velocity:915, damage:80, penetration:64, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:1.0, barrierStability:0.8, barrierDamageRetention:0.86, ricochetMul:1.15, barrierBehavior:'modern_epr',
    },
    durability:{ armorDamagePct:52 },
    combat:{ stoppingPower:1.1, painMul:0.98 },
    projectile:{ massG:7.65 },
    medical:{ bleedChance:0.26, bleedSeverityMul:0.94, fractureChance:0.15, fractureSeverityMul:1.15, shockChance:0.17, bluntTraumaMul:1.02, tissueDamageMul:0.88 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '68x51_xm1188_rra': {
    id:'68x51_xm1188_rra',
    display:{ name:'6.8×51mm XM1188 RRA', shortName:'XM1188 RRA', group:'6.8x51mm', desc:'사격장/훈련용 사거리 감소탄. FMJ급 이하의 관통력과 낮은 방호구 파손을 가지며, 장벽 통과 후 탄자 안정성은 비교적 높은 편.', tableOrder:4 },
    ballistic:{ caliber:'6.8x51mm', velocity:800, damage:78, penetration:50, accuracyMul:1.0, recoil:1.15, suppression:0.9 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:9, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.68, barrierStability:0.86, barrierDamageRetention:0.82, ricochetMul:1.08, barrierBehavior:'reduced_range_ball',
    },
    durability:{ armorDamagePct:26 },
    combat:{ stoppingPower:1.05, painMul:1.0 },
    projectile:{ massG:7.32 },
    medical:{ bleedChance:0.27, bleedSeverityMul:0.96, fractureChance:0.11, fractureSeverityMul:1.0, shockChance:0.15, bluntTraumaMul:1.0, tissueDamageMul:0.92 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly','reduced_range','training'] },
  },
  '68x51_xm1184_ap': {
    id:'68x51_xm1184_ap',
    display:{ name:'6.8×51mm XM1184 AP', shortName:'XM1184 AP', group:'6.8x51mm', desc:'6.8×51mm 특수목적 고관통 AP 탄. 하드 타겟과 방호구 관통에 특화된 전투용 탄.', tableOrder:5 },
    ballistic:{ caliber:'6.8x51mm', velocity:915, damage:76, penetration:78, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:0, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.2, barrierStability:0.92, barrierDamageRetention:0.96, ricochetMul:1.22, barrierBehavior:'tungsten_ap',
    },
    durability:{ armorDamagePct:72 },
    combat:{ stoppingPower:1.0, painMul:0.9 },
    projectile:{ massG:7.70 },
    medical:{ bleedChance:0.22, bleedSeverityMul:0.8, fractureChance:0.18, fractureSeverityMul:1.25, shockChance:0.16, bluntTraumaMul:1.04, tissueDamageMul:0.72 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 9.3x64mm =====
  '93x64_fmj': {
    id:'93x64_fmj',
    display:{ name:'9.3×64mm FMJ', shortName:'9.3 FMJ', group:'9.3x64mm', desc:'대구경 매그넘 전피갑탄. 관통보다 큰 조직손상·둔상·제압이 강점.', tableOrder:1 },
    ballistic:{ caliber:'9.3x64mm', velocity:780, damage:102, penetration:52, accuracyMul:1.0, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:8, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.85, barrierStability:0.68, barrierDamageRetention:0.78, ricochetMul:1.1, barrierBehavior:'magnum_ball',
    },
    durability:{ armorDamagePct:40 },
    combat:{ stoppingPower:1.45, painMul:1.25 },
    medical:{ bleedChance:0.38, bleedSeverityMul:1.18, fractureChance:0.2, fractureSeverityMul:1.3, shockChance:0.26, bluntTraumaMul:1.35, tissueDamageMul:1.16 },
    projectile:{ massG:19.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '93x64_sp': {
    id:'93x64_sp',
    display:{ name:'9.3×64mm SP', shortName:'9.3 SP', group:'9.3x64mm', desc:'수렵용 소프트포인트. 비방호 표적에 대한 파괴력이 극대화된 탄.', tableOrder:2 },
    ballistic:{ caliber:'9.3x64mm', velocity:770, damage:122, penetration:34, accuracyMul:0.95, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.58, barrierStability:0.32, barrierDamageRetention:0.4, ricochetMul:0.85, barrierBehavior:'deform_heavy',
    },
    durability:{ armorDamagePct:32 },
    combat:{ stoppingPower:1.75, painMul:1.4 },
    medical:{ bleedChance:0.55, bleedSeverityMul:1.55, fractureChance:0.22, fractureSeverityMul:1.4, shockChance:0.34, bluntTraumaMul:1.3, tissueDamageMul:1.65 },
    projectile:{ massG:18.5 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '93x64_9sn_7n33_ap': {
    id:'93x64_9sn_7n33_ap',
    display:{ name:'9.3×64mm 9-SN (7N33) AP', shortName:'7N33', group:'9.3x64mm', desc:'SVDK용 대구경 강철심 철갑탄. M61보다 위, M993보다 아래의 관통.', tableOrder:3 },
    ballistic:{ caliber:'9.3x64mm', velocity:770, damage:95, penetration:68, accuracyMul:1.0, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.05, barrierStability:0.84, barrierDamageRetention:0.9, ricochetMul:1.16, barrierBehavior:'large_penetrator',
    },
    durability:{ armorDamagePct:59 },
    combat:{ stoppingPower:1.35, painMul:1.12 },
    medical:{ bleedChance:0.3, bleedSeverityMul:0.98, fractureChance:0.22, fractureSeverityMul:1.35, shockChance:0.24, bluntTraumaMul:1.28, tissueDamageMul:0.95 },
    projectile:{ massG:16.6 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== .338lm =====
  '338lm_fmj': {
    id:'338lm_fmj',
    display:{ name:'.338 Lapua Magnum FMJ', shortName:'.338 FMJ', group:'.338lm', desc:'장거리 대구경 전피갑탄. 원거리 에너지 유지가 우수하다.', tableOrder:1 },
    ballistic:{ caliber:'.338 Lapua', velocity:900, damage:112, penetration:58, accuracyMul:1.0, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:8, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.88, barrierStability:0.72, barrierDamageRetention:0.82, ricochetMul:1.1, barrierBehavior:'magnum_ball',
    },
    durability:{ armorDamagePct:48 },
    combat:{ stoppingPower:1.55, painMul:1.3 },
    medical:{ bleedChance:0.4, bleedSeverityMul:1.22, fractureChance:0.22, fractureSeverityMul:1.35, shockChance:0.28, bluntTraumaMul:1.38, tissueDamageMul:1.2 },
    projectile:{ massG:16.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '338lm_ap': {
    id:'338lm_ap',
    display:{ name:'.338 Lapua Magnum AP', shortName:'.338 AP', group:'.338lm', desc:'텅스텐심 장거리 철갑탄. XSAPI 최상급 하드플레이트에도 매우 위협적.', tableOrder:2 },
    ballistic:{ caliber:'.338 Lapua', velocity:890, damage:102, penetration:84, accuracyMul:1.0, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:0, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.24, barrierStability:0.94, barrierDamageRetention:0.97, ricochetMul:1.24, barrierBehavior:'tungsten_ap',
    },
    durability:{ armorDamagePct:79 },
    combat:{ stoppingPower:1.35, painMul:1.08 },
    medical:{ bleedChance:0.26, bleedSeverityMul:0.88, fractureChance:0.24, fractureSeverityMul:1.45, shockChance:0.22, bluntTraumaMul:1.3, tissueDamageMul:0.82 },
    projectile:{ massG:15.4 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '338lm_tacx': {
    id:'338lm_tacx',
    display:{ name:'.338 Lapua Magnum TAC-X', shortName:'TAC-X', group:'.338lm', desc:'솔리드 구리 팽창탄. 비방호 표적 파괴력이 극대화되나 방호 관통은 낮다.', tableOrder:3 },
    ballistic:{ caliber:'.338 Lapua', velocity:890, damage:128, penetration:42, accuracyMul:0.95, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.62, barrierStability:0.34, barrierDamageRetention:0.42, ricochetMul:0.85, barrierBehavior:'deform_heavy',
    },
    durability:{ armorDamagePct:20 },
    combat:{ stoppingPower:1.85, painMul:1.45 },
    medical:{ bleedChance:0.58, bleedSeverityMul:1.65, fractureChance:0.25, fractureSeverityMul:1.5, shockChance:0.38, bluntTraumaMul:1.35, tissueDamageMul:1.75 },
    projectile:{ massG:18.4 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '338lm_ucw_subsonic': {
    id:'338lm_ucw_subsonic',
    display:{ name:'.338 Lapua Magnum UCW Subsonic', shortName:'UCW Sub', group:'.338lm', desc:'특수전용 아음속 중량탄. 소음 사격용으로 근거리 저지력이 크다.', tableOrder:4 },
    ballistic:{ caliber:'.338 Lapua', velocity:310, damage:106, penetration:34, accuracyMul:0.97, recoil:0.2, suppression:0.3 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:9, aluminum:6, titanium:11, ceramic:13, composite:12 },
      barrierPenMul:0.65, barrierStability:0.6, barrierDamageRetention:0.7, ricochetMul:0.9, barrierBehavior:'heavy_subsonic',
    },
    durability:{ armorDamagePct:33 },
    combat:{ stoppingPower:1.45, painMul:1.25 },
    medical:{ bleedChance:0.36, bleedSeverityMul:1.15, fractureChance:0.18, fractureSeverityMul:1.25, shockChance:0.24, bluntTraumaMul:1.35, tissueDamageMul:1.08 },
    projectile:{ massG:16.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== .338nm =====
  '338nm_fmj': {
    id:'338nm_fmj',
    display:{ name:'.338 Norma Magnum FMJ', shortName:'.338 NM FMJ', group:'.338nm', desc:'중기관총·장거리 저격용 다목적 매그넘탄.', tableOrder:1 },
    ballistic:{ caliber:'.338 Norma', velocity:825, damage:106, penetration:56, accuracyMul:1.0, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:8, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.86, barrierStability:0.7, barrierDamageRetention:0.8, ricochetMul:1.1, barrierBehavior:'magnum_ball',
    },
    durability:{ armorDamagePct:46 },
    combat:{ stoppingPower:1.48, painMul:1.24 },
    medical:{ bleedChance:0.38, bleedSeverityMul:1.18, fractureChance:0.2, fractureSeverityMul:1.3, shockChance:0.26, bluntTraumaMul:1.32, tissueDamageMul:1.14 },
    projectile:{ massG:19.44 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '338nm_ap': {
    id:'338nm_ap',
    display:{ name:'.338 Norma Magnum AP', shortName:'.338 NM AP', group:'.338nm', desc:'중기관총용 텅스텐 철갑탄. .338 LM AP보다 약간 낮은 관통.', tableOrder:2 },
    ballistic:{ caliber:'.338 Norma', velocity:825, damage:98, penetration:80, accuracyMul:1.0, recoil:2.8, suppression:1.4 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:2, aluminum:0, titanium:4, ceramic:5, composite:4 },
      barrierPenMul:1.2, barrierStability:0.92, barrierDamageRetention:0.96, ricochetMul:1.22, barrierBehavior:'tungsten_ap',
    },
    durability:{ armorDamagePct:75 },
    combat:{ stoppingPower:1.28, painMul:1.04 },
    medical:{ bleedChance:0.25, bleedSeverityMul:0.84, fractureChance:0.22, fractureSeverityMul:1.4, shockChance:0.2, bluntTraumaMul:1.24, tissueDamageMul:0.78 },
    projectile:{ massG:19.44 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 12.7x55mm =====
  '127x55_ps12': {
    id:'127x55_ps12',
    display:{ name:'12.7×55mm PS-12', shortName:'PS-12', group:'12.7x55mm', desc:'ASh-12용 아음속 대구경 일반탄. 근접 비방호 저지력이 매우 높다.', tableOrder:1 },
    ballistic:{ caliber:'12.7x55mm', velocity:300, damage:132, penetration:31, accuracyMul:0.97, recoil:4.5, suppression:1.7 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:8, steel:9, aluminum:6, titanium:11, ceramic:13, composite:12 },
      barrierPenMul:0.62, barrierStability:0.6, barrierDamageRetention:0.7, ricochetMul:0.85, barrierBehavior:'heavy_subsonic',
    },
    durability:{ armorDamagePct:29 },
    combat:{ stoppingPower:1.95, painMul:1.5 },
    medical:{ bleedChance:0.48, bleedSeverityMul:1.38, fractureChance:0.28, fractureSeverityMul:1.55, shockChance:0.42, bluntTraumaMul:1.7, tissueDamageMul:1.35 },
    projectile:{ massG:33.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '127x55_ps12a': {
    id:'127x55_ps12a',
    display:{ name:'12.7×55mm PS-12A', shortName:'PS-12A', group:'12.7x55mm', desc:'경량 고속 파쇄탄. 방호 관통은 낮고 비방호 파괴력은 극대.', tableOrder:2 },
    ballistic:{ caliber:'12.7x55mm', velocity:520, damage:145, penetration:20, accuracyMul:0.95, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:5, pe:13, steel:13, aluminum:10, titanium:14, ceramic:16, composite:15 },
      barrierPenMul:0.45, barrierStability:0.2, barrierDamageRetention:0.25, ricochetMul:0.7, barrierBehavior:'fragment_heavy',
    },
    durability:{ armorDamagePct:18 },
    combat:{ stoppingPower:2.1, painMul:1.6 },
    medical:{ bleedChance:0.62, bleedSeverityMul:1.75, fractureChance:0.26, fractureSeverityMul:1.45, shockChance:0.48, bluntTraumaMul:1.45, tissueDamageMul:1.85 },
    projectile:{ massG:7.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '127x55_ps12b': {
    id:'127x55_ps12b',
    display:{ name:'12.7×55mm PS-12B', shortName:'PS-12B', group:'12.7x55mm', desc:'아음속 대구경 철갑탄. 방패·엄폐물·소프트 방호 관통 후보.', tableOrder:3 },
    ballistic:{ caliber:'12.7x55mm', velocity:300, damage:118, penetration:52, accuracyMul:1.0, recoil:4.5, suppression:1.7 },
    energy:{ class:'subsonic' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
      barrierPenMul:0.92, barrierStability:0.76, barrierDamageRetention:0.83, ricochetMul:1.0, barrierBehavior:'slow_large_penetrator',
    },
    durability:{ armorDamagePct:48 },
    combat:{ stoppingPower:1.65, painMul:1.28 },
    medical:{ bleedChance:0.34, bleedSeverityMul:1.05, fractureChance:0.24, fractureSeverityMul:1.4, shockChance:0.3, bluntTraumaMul:1.5, tissueDamageMul:1.0 },
    projectile:{ massG:18.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  // ===== 12.7x99mm =====
  '127x99_m33_ball': {
    id:'127x99_m33_ball',
    display:{ name:'12.7×99mm M33 Ball', shortName:'M33 Ball', group:'12.7x99mm', desc:'.50 BMG 표준 일반탄. ESAPI/Br5급엔 위협적이나 세라믹 감산이 커 XSAPI 안정 관통탄은 아니다. 강점은 대구경 조직손상·둔상·엄폐물 파괴.', tableOrder:1 },
    ballistic:{ caliber:'12.7x99mm', velocity:890, damage:155, penetration:72, accuracyMul:1.0, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:5, steel:7, aluminum:5, titanium:9, ceramic:12, composite:10 },
      barrierPenMul:0.9, barrierStability:0.72, barrierDamageRetention:0.82, ricochetMul:1.18, barrierBehavior:'anti_material_ball',
    },
    durability:{ armorDamagePct:56 },
    combat:{ stoppingPower:2.2, painMul:1.65 },
    medical:{ bleedChance:0.55, bleedSeverityMul:1.45, fractureChance:0.35, fractureSeverityMul:1.7, shockChance:0.5, bluntTraumaMul:1.9, tissueDamageMul:1.45 },
    projectile:{ massG:42.8 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '127x99_m17_tracer': {
    id:'127x99_m17_tracer',
    display:{ name:'12.7×99mm M17 Tracer', shortName:'M17', group:'12.7x99mm', desc:'.50 BMG 예광탄. 중기관총 탄착 추적용.', tableOrder:2 },
    ballistic:{ caliber:'12.7x99mm', velocity:870, damage:145, penetration:68, accuracyMul:0.98, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:6, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.86, barrierStability:0.68, barrierDamageRetention:0.78, ricochetMul:1.18, barrierBehavior:'anti_material_tracer_ball',
    },
    durability:{ armorDamagePct:50 },
    combat:{ stoppingPower:2.05, painMul:1.55 },
    projectile:{ projectileType:'tracer', massG:40.05 },
    medical:{ bleedChance:0.5, bleedSeverityMul:1.35, fractureChance:0.32, fractureSeverityMul:1.6, shockChance:0.45, bluntTraumaMul:1.75, tissueDamageMul:1.35 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '127x99_m8_api': {
    id:'127x99_m8_api',
    display:{ name:'12.7×99mm M8 API', shortName:'M8 API', group:'12.7x99mm', desc:'철갑소이탄. 강철심으로 XSAPI도 위협하며, 관통 후 내부 소이 효과를 준다.', tableOrder:3 },
    ballistic:{ caliber:'12.7x99mm', velocity:890, damage:150, penetration:82, accuracyMul:1.0, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:4, aluminum:2, titanium:6, ceramic:8, composite:7 },
      barrierPenMul:1.08, barrierStability:0.84, barrierDamageRetention:0.9, ricochetMul:1.18, barrierBehavior:'anti_material_api',
    },
    durability:{ armorDamagePct:78 },
    combat:{ stoppingPower:2.1, painMul:1.55 },
    medical:{ bleedChance:0.48, bleedSeverityMul:1.25, fractureChance:0.36, fractureSeverityMul:1.75, shockChance:0.46, bluntTraumaMul:1.8, tissueDamageMul:1.25 },
    projectile:{ massG:40.34 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['api', 'incendiaryFuture', 'futureOnly'] },
  },
  '127x99_m20_apit': {
    id:'127x99_m20_apit',
    display:{ name:'12.7×99mm M20 API-T', shortName:'M20 API-T', group:'12.7x99mm', desc:'철갑소이예광탄. 관통·예광·소이를 겸한다.', tableOrder:4 },
    ballistic:{ caliber:'12.7x99mm', velocity:890, damage:145, penetration:80, accuracyMul:0.98, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:1.05, barrierStability:0.82, barrierDamageRetention:0.88, ricochetMul:1.18, barrierBehavior:'anti_material_api_t',
    },
    durability:{ armorDamagePct:75 },
    combat:{ stoppingPower:2.0, painMul:1.5 },
    projectile:{ projectileType:'tracer', massG:40.1 },
    medical:{ bleedChance:0.46, bleedSeverityMul:1.2, fractureChance:0.34, fractureSeverityMul:1.7, shockChance:0.44, bluntTraumaMul:1.7, tissueDamageMul:1.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['api_t', 'tracer', 'incendiaryFuture', 'futureNearMiss', 'futureOnly'] },
  },
  '127x99_mk211_heiap': {
    id:'127x99_mk211_heiap',
    display:{ name:'12.7×99mm Mk 211 Mod 0 HEIAP', shortName:'Mk211', group:'12.7x99mm', desc:'Raufoss 다목적 철갑소이작약탄. 장갑을 충분히 관통한 뒤 전방으로 작약 파편을 방출한다.', tableOrder:5 },
    ballistic:{ caliber:'12.7x99mm', velocity:915, damage:160, penetration:84, accuracyMul:1.0, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:4, aluminum:2, titanium:6, ceramic:8, composite:7 },
      barrierPenMul:1.12, barrierStability:0.86, barrierDamageRetention:0.92, ricochetMul:1.15, barrierBehavior:'anti_material_heiap',
    },
    durability:{ armorDamagePct:75 },
    combat:{ stoppingPower:2.25, painMul:1.65 },
    medical:{ bleedChance:0.58, bleedSeverityMul:1.55, fractureChance:0.38, fractureSeverityMul:1.8, shockChance:0.55, bluntTraumaMul:1.8, tissueDamageMul:1.6 },
    projectile:{ massG:43.5 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['heiap', 'postPenetrationBurstFuture', 'incendiaryFuture', 'futureOnly'] },
  },
  '127x99_m903_slap': {
    id:'127x99_m903_slap',
    display:{ name:'12.7×99mm M903 SLAP', shortName:'M903 SLAP', group:'12.7x99mm', desc:'초고속 텅스텐 사보트 철갑탄. 관통력 최상위로 XSAPI도 확실히 위협하나, 조직피해는 좁고 깊다.', tableOrder:6 },
    ballistic:{ caliber:'12.7x99mm', velocity:1219, damage:132, penetration:102, accuracyMul:1.02, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:0, steel:1, aluminum:0, titanium:3, ceramic:5, composite:4 },
      barrierPenMul:1.40, barrierStability:1.14, barrierDamageRetention:0.95, ricochetMul:1.32, barrierBehavior:'sabot_tungsten_ap',
    },
    durability:{ armorDamagePct:115 },
    combat:{ stoppingPower:1.75, painMul:1.25 },
    medical:{ bleedChance:0.38, bleedSeverityMul:1.0, fractureChance:0.42, fractureSeverityMul:1.9, shockChance:0.42, bluntTraumaMul:1.65, tissueDamageMul:0.95 },
    projectile:{ massG:23.33 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['slap', 'sabot_ap', 'futureOnly'] },
  },
  // ===== 12.7x108mm =====
  '127x108_b32_api': {
    id:'127x108_b32_api',
    display:{ name:'12.7×108mm B-32 API', shortName:'B-32 API', group:'12.7x108mm', desc:'동구권 표준 철갑소이탄. 관통 후 내부 소이 효과를 준다.', tableOrder:1 },
    ballistic:{ caliber:'12.7x108mm', velocity:820, damage:155, penetration:80, accuracyMul:1.0, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:4, aluminum:2, titanium:6, ceramic:8, composite:7 },
      barrierPenMul:1.06, barrierStability:0.82, barrierDamageRetention:0.88, ricochetMul:1.18, barrierBehavior:'anti_material_api',
    },
    durability:{ armorDamagePct:88 },
    combat:{ stoppingPower:2.15, painMul:1.58 },
    medical:{ bleedChance:0.5, bleedSeverityMul:1.3, fractureChance:0.36, fractureSeverityMul:1.75, shockChance:0.48, bluntTraumaMul:1.85, tissueDamageMul:1.3 },
    projectile:{ massG:48.2 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['api', 'incendiaryFuture', 'futureOnly'] },
  },
  '127x108_bzt44_apit': {
    id:'127x108_bzt44_apit',
    display:{ name:'12.7×108mm BZT-44 API-T', shortName:'BZT-44', group:'12.7x108mm', desc:'철갑소이예광탄. 관통·예광·소이를 겸한다.', tableOrder:2 },
    ballistic:{ caliber:'12.7x108mm', velocity:820, damage:148, penetration:78, accuracyMul:0.98, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
      barrierPenMul:1.02, barrierStability:0.8, barrierDamageRetention:0.86, ricochetMul:1.18, barrierBehavior:'anti_material_api_t',
    },
    durability:{ armorDamagePct:80 },
    combat:{ stoppingPower:2.02, painMul:1.5 },
    projectile:{ projectileType:'tracer', massG:44.0 },
    medical:{ bleedChance:0.47, bleedSeverityMul:1.22, fractureChance:0.34, fractureSeverityMul:1.68, shockChance:0.45, bluntTraumaMul:1.75, tissueDamageMul:1.22 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['api_t', 'tracer', 'incendiaryFuture', 'futureNearMiss', 'futureOnly'] },
  },
  '127x108_mdz_hei': {
    id:'127x108_mdz_hei',
    display:{ name:'12.7×108mm MDZ HEI', shortName:'MDZ HEI', group:'12.7x108mm', desc:'고폭소이탄. 충격 즉시 폭발해 작은 폭발과 파편을 사방으로 방출한다.', tableOrder:3 },
    ballistic:{ caliber:'12.7x108mm', velocity:830, damage:165, penetration:40, accuracyMul:1.0, recoil:4.5, suppression:1.7 },
    energy:{ class:'high_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:7, steel:9, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.78, barrierStability:0.5, barrierDamageRetention:0.6, ricochetMul:0.95, barrierBehavior:'hei_shell',
    },
    durability:{ armorDamagePct:54 },
    combat:{ stoppingPower:2.3, painMul:1.7 },
    medical:{ bleedChance:0.62, bleedSeverityMul:1.65, fractureChance:0.38, fractureSeverityMul:1.8, shockChance:0.6, bluntTraumaMul:1.7, tissueDamageMul:1.75 },
    projectile:{ massG:43.0 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['hei', 'blastFuture', 'incendiaryFuture', 'futureOnly'] },
  },
  // ===== .30-06 =====
  '30_06_m2_ball': {
    id:'30_06_m2_ball',
    display:{ name:'.30-06 M2 Ball', shortName:'M2 Ball', group:'.30-06', desc:'전통적 풀파워 전피갑탄. M1 개런드/볼트액션 계열의 표준 군용탄.', tableOrder:1 },
    ballistic:{ caliber:'.30-06', velocity:845, damage:86, penetration:48, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:6, steel:8, aluminum:5, titanium:9, ceramic:11, composite:10 },
      barrierPenMul:0.8, barrierStability:0.62, barrierDamageRetention:0.72, ricochetMul:1.1, barrierBehavior:'full_power_ball',
    },
    durability:{ armorDamagePct:37 },
    combat:{ stoppingPower:1.25, painMul:1.1 },
    medical:{ bleedChance:0.32, bleedSeverityMul:1.08, fractureChance:0.13, fractureSeverityMul:1.1, shockChance:0.2, bluntTraumaMul:1.12, tissueDamageMul:1.04 },
    projectile:{ massG:9.72 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '30_06_m2_ap': {
    id:'30_06_m2_ap',
    display:{ name:'.30-06 M2 AP', shortName:'M2 AP', group:'.30-06', desc:'블랙팁 철갑탄. IV/RF3 위협탄급에 가까운 관통.', tableOrder:2 },
    ballistic:{ caliber:'.30-06', velocity:829, damage:80, penetration:66, accuracyMul:1.0, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
      barrierPenMul:1.02, barrierStability:0.84, barrierDamageRetention:0.9, ricochetMul:1.16, barrierBehavior:'penetrator',
    },
    durability:{ armorDamagePct:60 },
    combat:{ stoppingPower:1.1, painMul:0.98 },
    medical:{ bleedChance:0.24, bleedSeverityMul:0.88, fractureChance:0.16, fractureSeverityMul:1.18, shockChance:0.16, bluntTraumaMul:1.05, tissueDamageMul:0.8 },
    projectile:{ massG:10.74 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '30_06_m25_tracer': {
    id:'30_06_m25_tracer',
    display:{ name:'.30-06 M25 Tracer', shortName:'M25', group:'.30-06', desc:'.30-06 예광탄. 탄착 추적용.', tableOrder:3 },
    ballistic:{ caliber:'.30-06', velocity:810, damage:78, penetration:43, accuracyMul:0.98, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:2, pe:7, steel:9, aluminum:6, titanium:10, ceramic:12, composite:11 },
      barrierPenMul:0.72, barrierStability:0.56, barrierDamageRetention:0.66, ricochetMul:1.12, barrierBehavior:'tracer_ball',
    },
    durability:{ armorDamagePct:31 },
    combat:{ stoppingPower:1.1, painMul:1.0 },
    projectile:{ projectileType:'tracer', massG:9.43 },
    medical:{ bleedChance:0.27, bleedSeverityMul:0.98, fractureChance:0.1, fractureSeverityMul:0.95, shockChance:0.16, bluntTraumaMul:1.0, tissueDamageMul:0.92 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['tracer', 'futureNearMiss', 'futureOnly'] },
  },
  '30_06_sp': {
    id:'30_06_sp',
    display:{ name:'.30-06 Soft Point', shortName:'SP', group:'.30-06', desc:'민수 수렵용 소프트포인트. 비방호 피해가 매우 높다.', tableOrder:4 },
    ballistic:{ caliber:'.30-06', velocity:835, damage:108, penetration:34, accuracyMul:0.95, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:4, pe:11, steel:12, aluminum:9, titanium:13, ceramic:15, composite:14 },
      barrierPenMul:0.58, barrierStability:0.32, barrierDamageRetention:0.4, ricochetMul:0.85, barrierBehavior:'deform_heavy',
    },
    durability:{ armorDamagePct:25 },
    combat:{ stoppingPower:1.6, painMul:1.32 },
    medical:{ bleedChance:0.52, bleedSeverityMul:1.5, fractureChance:0.2, fractureSeverityMul:1.35, shockChance:0.32, bluntTraumaMul:1.25, tissueDamageMul:1.58 },
    projectile:{ massG:11.7 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
  '30_06_m72_match': {
    id:'30_06_m72_match',
    display:{ name:'.30-06 M72 Match', shortName:'M72', group:'.30-06', desc:'정밀 매치탄. 관통보다 정확도·탄도 안정성에 중점.', tableOrder:5 },
    ballistic:{ caliber:'.30-06', velocity:805, damage:84, penetration:50, accuracyMul:1.03, recoil:1.3, suppression:1.0 },
    energy:{ class:'full_power_rifle' },
    armorInteraction:{
      materialPenalty:{ fabric:0, aramid:1, pe:5, steel:7, aluminum:5, titanium:9, ceramic:10, composite:9 },
      barrierPenMul:0.78, barrierStability:0.74, barrierDamageRetention:0.8, ricochetMul:1.05, barrierBehavior:'precision_heavy',
    },
    durability:{ armorDamagePct:33 },
    combat:{ stoppingPower:1.2, painMul:1.05 },
    medical:{ bleedChance:0.3, bleedSeverityMul:1.04, fractureChance:0.12, fractureSeverityMul:1.05, shockChance:0.18, bluntTraumaMul:1.08, tissueDamageMul:1.0 },
    projectile:{ massG:11.21 },
    ui:{ showInAmmoTable:true, showInArmorAnalysis:true, notes:['futureOnly'] },
  },
};
// SIDE-AMMO-2A: terminalProfile을 AMMO_REGISTRY(source of truth)에 주입
if (typeof AMMO_TERMINAL_PROFILE !== 'undefined') {
  for (const id in AMMO_TERMINAL_PROFILE) {
    if (AMMO_REGISTRY[id]) AMMO_REGISTRY[id].terminalProfile = AMMO_TERMINAL_PROFILE[id];
  }
}

// registry 항목 → legacy AMMO_PRESETS 형태 생성
function buildAmmoPresetFromRegistry(entry) {
  if (!entry) return null;
  const d = entry.display||{}, b = entry.ballistic||{}, ai = entry.armorInteraction||{}, c = entry.combat||{}, dur = entry.durability||{}, pj = entry.projectile||{};
  const preset = {
    id: entry.id, name: d.name, shortName: d.shortName, type: 'small',
    caliber: b.caliber, desc: d.desc,
    penetration: b.penetration, damage: b.damage, velocity: b.velocity,
    suppression: b.suppression, recoil: b.recoil,
    materialPenPenalty: ai.materialPenalty ? Object.assign({}, ai.materialPenalty) : undefined,
    barrierPenMul: ai.barrierPenMul, barrierStability: ai.barrierStability,
    barrierDamageRetention: ai.barrierDamageRetention, ricochetMul: ai.ricochetMul,
    barrierBehavior: ai.barrierBehavior,
    accuracyMul: b.accuracyMul,
    stoppingPower: c.stoppingPower, painMul: c.painMul,
    armorDamagePct: (dur.armorDamagePct != null) ? dur.armorDamagePct : undefined,
  };
  if (entry.energy && entry.energy.class) preset.energyClass = entry.energy.class;
  // 직접 둔상 배수 (예: 12g_slug)
  if (c.bluntTraumaMul !== undefined) preset.bluntTraumaMul = c.bluntTraumaMul;
  // 산탄/투사체 특성 (12ga 등) — 기존 필드명 유지
  if (pj.projectileType !== undefined) preset.projectileType = pj.projectileType;
  if (pj.pelletCount !== undefined) preset.pelletCount = pj.pelletCount;
  if (pj.patternType !== undefined) preset.patternType = pj.patternType;
  if (pj.massG !== undefined) preset.projectileMassG = pj.massG;   // SIDE-AMMO-PROJECTILE-MASS-1: 탄자무게(g) 보존
  // SHOTGUN-PHYS-CLUSTER-1 Phase1: registry projectile 전체를 preset.projectile로 보존 (의료 메타 effectiveDiameterMm/pelletMedicalScalar 등 — getMedicalProjectileMeta가 읽음)
  if (entry.projectile) preset.projectile = Object.assign({}, entry.projectile);
  // SIDE-AMMO-2A: terminalProfile 보존
  if (entry.terminalProfile) preset.terminalProfile = entry.terminalProfile;
  return preset;
}
function buildLegacyAmmoPresetsFromRegistry() {
  const out = {};
  for (const id in AMMO_REGISTRY) out[id] = buildAmmoPresetFromRegistry(AMMO_REGISTRY[id]);
  return out;
}

// 2A-4.9: registry → 보조 테이블 생성 helper들
function buildAmmoEnergyClassFromRegistry() {
  const out = {};
  for (const id in AMMO_REGISTRY) { const c = AMMO_REGISTRY[id].energy && AMMO_REGISTRY[id].energy.class; if (c !== undefined) out[id] = c; }
  return out;
}
function buildAmmoVelocityFromRegistry() {
  const out = {};
  for (const id in AMMO_REGISTRY) { const v = AMMO_REGISTRY[id].ballistic && AMMO_REGISTRY[id].ballistic.velocity; if (v !== undefined) out[id] = v; }
  return out;
}
function buildArmorDamagePctFromRegistry() {
  const out = {};
  for (const id in AMMO_REGISTRY) { const d = AMMO_REGISTRY[id].durability && AMMO_REGISTRY[id].durability.armorDamagePct; if (d !== undefined) out[id] = d; }
  return out;
}
function buildAmmoMedicalFromRegistry() {
  const out = {};
  for (const id in AMMO_REGISTRY) { const m = AMMO_REGISTRY[id].medical; if (m && Object.keys(m).length) out[id] = Object.assign({}, m); }
  return out;
}
function buildAmmoAuxTablesFromRegistry() {
  return { energyClass: buildAmmoEnergyClassFromRegistry(), velocity: buildAmmoVelocityFromRegistry(),
           armorDamagePct: buildArmorDamagePctFromRegistry(), medical: buildAmmoMedicalFromRegistry() };
}

// =============================================================
// 2A-4.8/4.9: AMMO SOURCE SWITCH (탄약 본체 + 보조 테이블)
//   USE_AMMO_REGISTRY_AS_SOURCE=true → AMMO_PRESETS / AMMO_ENERGY_CLASS / AMMO_VELOCITY /
//     ARMOR_DAMAGE_PCT / AMMO_MEDICAL 모두 AMMO_REGISTRY에서 생성 (source of truth = registry)
//   false → LEGACY_*_MANUAL 수동 백업 사용
//   모든 const 참조는 유지하고 내용만 in-place 교체 → 기존 코드 접근 방식 보존.
//   registry build에 없는 파생 필드(velocityDragClass/terminalEffect 등)는 manual에서 복원.
// =============================================================
const USE_AMMO_REGISTRY_AS_SOURCE = true;
// SIDE-AMMO-1A: 신규 futureOnly 탄종을 LEGACY_*_MANUAL 백업에 자동 동기화(builder 파생).
//   → 라이브 테이블(AMMO_PRESETS 등)은 손대지 않고 source-switch가 registry에서 생성.
//   → 비교/검증 baseline(count·필드)이 깨지지 않도록 backup만 registry와 정합 유지.
(function _syncNewAmmoIntoLegacyBackups() {
  try {
    if (typeof LEGACY_AMMO_PRESETS_MANUAL === 'undefined') return;
    for (const id in AMMO_REGISTRY) {
      if (LEGACY_AMMO_PRESETS_MANUAL[id]) continue;            // 기존 탄종은 그대로
      const entry = AMMO_REGISTRY[id];
      LEGACY_AMMO_PRESETS_MANUAL[id] = buildAmmoPresetFromRegistry(entry);
      if (typeof LEGACY_AMMO_VELOCITY_MANUAL !== 'undefined' && entry.ballistic) LEGACY_AMMO_VELOCITY_MANUAL[id] = entry.ballistic.velocity;
      if (typeof LEGACY_AMMO_ENERGY_CLASS_MANUAL !== 'undefined' && entry.energy) LEGACY_AMMO_ENERGY_CLASS_MANUAL[id] = entry.energy.class;
      if (typeof LEGACY_ARMOR_DAMAGE_PCT_MANUAL !== 'undefined' && entry.durability) LEGACY_ARMOR_DAMAGE_PCT_MANUAL[id] = entry.durability.armorDamagePct;
      if (typeof LEGACY_AMMO_MEDICAL_MANUAL !== 'undefined' && entry.medical) LEGACY_AMMO_MEDICAL_MANUAL[id] = Object.assign({}, entry.medical);
    }
  } catch (e) { if (typeof console !== 'undefined') console.warn('[SIDE-AMMO-1A] legacy sync 실패:', e && e.message); }
})();
(function _switchAmmoSource() {
  function replaceInPlace(target, src) {
    for (const k in target) delete target[k];
    Object.assign(target, src);
  }
  function manualFallbackAll() {
    replaceInPlace(AMMO_PRESETS, LEGACY_AMMO_PRESETS_MANUAL);
    replaceInPlace(AMMO_ENERGY_CLASS, LEGACY_AMMO_ENERGY_CLASS_MANUAL);
    replaceInPlace(AMMO_VELOCITY, LEGACY_AMMO_VELOCITY_MANUAL);
    replaceInPlace(ARMOR_DAMAGE_PCT, LEGACY_ARMOR_DAMAGE_PCT_MANUAL);
    replaceInPlace(AMMO_MEDICAL, LEGACY_AMMO_MEDICAL_MANUAL);
  }
  try {
    if (USE_AMMO_REGISTRY_AS_SOURCE) {
      // 1) AMMO_PRESETS — registry 생성 + 파생 필드 manual 복원
      const presets = buildLegacyAmmoPresetsFromRegistry();
      for (const id in presets) {
        const m = LEGACY_AMMO_PRESETS_MANUAL[id];
        if (m) for (const k in m) if (presets[id][k] === undefined) presets[id][k] = m[k];
      }
      for (const id in LEGACY_AMMO_PRESETS_MANUAL) if (!presets[id]) presets[id] = LEGACY_AMMO_PRESETS_MANUAL[id];
      replaceInPlace(AMMO_PRESETS, presets);
      // 2) 보조 테이블 — registry 생성
      const aux = buildAmmoAuxTablesFromRegistry();
      replaceInPlace(AMMO_ENERGY_CLASS, aux.energyClass);
      replaceInPlace(AMMO_VELOCITY, aux.velocity);
      replaceInPlace(ARMOR_DAMAGE_PCT, aux.armorDamagePct);
      replaceInPlace(AMMO_MEDICAL, aux.medical);
    } else {
      manualFallbackAll();
    }
    // SIDE-AMMO-2A: source switch 후 live preset에 terminalEffect 누락 방지
    try { applyAmmoTerminalEffectsToPresets(); } catch (e) {}
    if (typeof console !== 'undefined') {
      console.log(`[AmmoSource] source=${USE_AMMO_REGISTRY_AS_SOURCE?'AMMO_REGISTRY':'manual'} | presets ${Object.keys(AMMO_PRESETS).length} / energyClass ${Object.keys(AMMO_ENERGY_CLASS).length} / velocity ${Object.keys(AMMO_VELOCITY).length} / armorDmgPct ${Object.keys(ARMOR_DAMAGE_PCT).length} / medical ${Object.keys(AMMO_MEDICAL).length}`);
    }
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[AmmoSource] source switch 실패 → manual fallback:', e && e.message);
    try { manualFallbackAll(); } catch (e2) {}
  }
})();

// registry 생성 결과 vs 기존 수동 AMMO_PRESETS 비교
function compareRegistryAmmoWithLegacy(opts) {
  const rep = _mkValidationReport();
  const TOL = 1e-6;   // 부동소수 비교 tolerance
  // 문자열/거동 필드
  const STR_FIELDS = ['name','shortName','caliber','desc','barrierBehavior'];
  // 수치 필드 (tolerance 비교)
  const NUM_FIELDS = ['velocity','damage','penetration','accuracyMul','recoil','suppression',
    'barrierPenMul','barrierStability','barrierDamageRetention','ricochetMul','armorDamagePct'];
  const neq = (a,b) => (typeof a==='number'&&typeof b==='number') ? Math.abs(a-b)>TOL : a!==b;
  // 2A-4.8: source switch 후 AMMO_PRESETS가 registry-생성이면 자기 자신 비교가 되므로,
  //   manual 백업(LEGACY_AMMO_PRESETS_MANUAL)을 비교 기준으로 우선 사용.
  const BASE = (typeof LEGACY_AMMO_PRESETS_MANUAL !== 'undefined') ? LEGACY_AMMO_PRESETS_MANUAL
             : (typeof AMMO_PRESETS !== 'undefined' ? AMMO_PRESETS : {});
  for (const id in AMMO_REGISTRY) {
    const gen = buildAmmoPresetFromRegistry(AMMO_REGISTRY[id]);
    const legacy = BASE[id] || null;
    const allow = (AMMO_REGISTRY[id].allowDifference) || {};
    if (!legacy) { rep.warn('registry', `${id}: manual 백업에 없음 (신규 탄종?)`); continue; }
    for (const f of STR_FIELDS.concat(NUM_FIELDS)) {
      if (allow[f]) continue;
      const gv = gen[f], lv = legacy[f];
      if (gv === undefined && lv === undefined) continue;
      if (neq(gv, lv)) rep.warn('registry', `${id}.${f}: registry(${JSON.stringify(gv)}) ≠ legacy(${JSON.stringify(lv)})`);
    }
    // materialPenalty 비교
    const gm = gen.materialPenPenalty||{}, lm = legacy.materialPenPenalty||{};
    for (const mk in lm) if (neq(gm[mk], lm[mk])) rep.warn('registry', `${id}.materialPenPenalty.${mk}: registry(${gm[mk]}) ≠ legacy(${lm[mk]})`);
    // energyClass 비교 (registry는 직접 class, legacy는 energyClass 또는 AMMO_ENERGY_CLASS)
    const genEC = gen.energyClass, legEC = legacy.energyClass || (typeof AMMO_ENERGY_CLASS!=='undefined'?AMMO_ENERGY_CLASS[id]:undefined);
    if (genEC !== legEC) rep.warn('registry', `${id}.energyClass: registry(${genEC}) ≠ legacy(${legEC})`);
    // armorDamagePct 추가 비교 (legacy는 적용 후 AMMO_PRESETS[id].armorDamagePct)
    const legDmg = (legacy.armorDamagePct != null) ? legacy.armorDamagePct : (typeof ARMOR_DAMAGE_PCT!=='undefined'?ARMOR_DAMAGE_PCT[id]:undefined);
    if (!allow.armorDamagePct && gen.armorDamagePct != null && legDmg != null && neq(gen.armorDamagePct, legDmg))
      rep.warn('registry', `${id}.armorDamagePct: registry(${gen.armorDamagePct}) ≠ legacy(${legDmg})`);
    // medical 비교
    const genMed = AMMO_REGISTRY[id].medical||{}, legMed = (typeof AMMO_MEDICAL!=='undefined'?AMMO_MEDICAL[id]:null)||{};
    for (const mk in legMed) if (neq(genMed[mk], legMed[mk])) rep.warn('registry', `${id}.medical.${mk}: registry(${genMed[mk]}) ≠ legacy(${legMed[mk]})`);
    // 산탄/투사체 특성 비교 (12ga 등)
    for (const pf of ['projectileType','pelletCount','patternType','bluntTraumaMul']) {
      if (allow[pf]) continue;
      const gv = gen[pf], lv = legacy[pf];
      if (gv === undefined && lv === undefined) continue;
      if (neq(gv, lv)) rep.warn('registry', `${id}.${pf}: registry(${JSON.stringify(gv)}) ≠ legacy(${JSON.stringify(lv)})`);
    }
    // ammo table group / armor analysis 표시 / AAR 표시명 생성 가능 여부
    const ui = AMMO_REGISTRY[id].ui||{};
    if (!AMMO_REGISTRY[id].display || !AMMO_REGISTRY[id].display.group) rep.warn('registry', `${id}: ui group(display.group) 누락 — 탄약표 그룹화 불가`);
    if (!gen.name && !gen.shortName) rep.warn('registry', `${id}: AAR 탄종명 생성 불가 (name/shortName 없음)`);
  }
  // 완료 단계: manual 백업에 있는데 registry에 없으면 error (전체 이관 검증)
  if (typeof LEGACY_AMMO_PRESETS_MANUAL !== 'undefined') {
    for (const id in LEGACY_AMMO_PRESETS_MANUAL) if (!AMMO_REGISTRY[id]) rep.error('registry', `${id}: manual 백업에 있으나 AMMO_REGISTRY 미이관`);
  }
  if (!opts || opts.log !== false) {
    const s = rep.summary();
    if (typeof console !== 'undefined') {
      console.log(`[AMMO_REGISTRY ↔ legacy 비교] error ${s.errors} / 불일치 ${s.warnings}건 (대상 ${Object.keys(AMMO_REGISTRY).length}종)`);
      for (const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for (const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if (s.warnings === 0 && s.errors === 0) console.log('  ✓ registry 전체 탄약이 기존 preset과 모든 비교 필드에서 일치');
    }
  }
  return rep;
}

// 2A-4.9: registry 생성 보조 테이블 ↔ manual 백업 비교
function compareAmmoAuxTablesWithLegacy(opts) {
  const rep = _mkValidationReport();
  const TOL = 1e-6;
  const neq = (a,b) => (typeof a==='number'&&typeof b==='number') ? Math.abs(a-b)>TOL : a!==b;
  function cmpFlat(genTbl, manTbl, label) {
    if (!manTbl) { rep.warn('aux', `${label}: manual 백업 없음`); return; }
    for (const id in manTbl) { if (!(id in genTbl)) rep.error('aux', `${label}: '${id}' 가 registry 생성물에 없음`); else if (neq(genTbl[id], manTbl[id])) rep.warn('aux', `${label}.${id}: registry(${JSON.stringify(genTbl[id])}) ≠ manual(${JSON.stringify(manTbl[id])})`); }
    for (const id in genTbl) if (!(id in manTbl)) rep.warn('aux', `${label}: '${id}' 가 manual 백업에 없음 (신규?)`);
  }
  cmpFlat(buildAmmoEnergyClassFromRegistry(), (typeof LEGACY_AMMO_ENERGY_CLASS_MANUAL!=='undefined'?LEGACY_AMMO_ENERGY_CLASS_MANUAL:null), 'AMMO_ENERGY_CLASS');
  cmpFlat(buildAmmoVelocityFromRegistry(),    (typeof LEGACY_AMMO_VELOCITY_MANUAL!=='undefined'?LEGACY_AMMO_VELOCITY_MANUAL:null), 'AMMO_VELOCITY');
  cmpFlat(buildArmorDamagePctFromRegistry(),  (typeof LEGACY_ARMOR_DAMAGE_PCT_MANUAL!=='undefined'?LEGACY_ARMOR_DAMAGE_PCT_MANUAL:null), 'ARMOR_DAMAGE_PCT');
  // medical — 중첩 비교 (12ga pellet/slug/flechette 차이 보존 확인)
  const genMed = buildAmmoMedicalFromRegistry(), manMed = (typeof LEGACY_AMMO_MEDICAL_MANUAL!=='undefined'?LEGACY_AMMO_MEDICAL_MANUAL:null);
  if (manMed) {
    for (const id in manMed) {
      if (!genMed[id]) { rep.error('aux', `AMMO_MEDICAL: '${id}' 가 registry 생성물에 없음`); continue; }
      for (const k in manMed[id]) if (neq(genMed[id][k], manMed[id][k])) rep.warn('aux', `AMMO_MEDICAL.${id}.${k}: registry(${genMed[id][k]}) ≠ manual(${manMed[id][k]})`);
    }
    for (const id in genMed) if (!manMed[id]) rep.warn('aux', `AMMO_MEDICAL: '${id}' 가 manual 백업에 없음 (신규?)`);
  }
  if (!opts || opts.log !== false) {
    const s = rep.summary();
    if (typeof console !== 'undefined') {
      console.log(`[보조테이블 ↔ manual 비교] error ${s.errors} / 불일치 ${s.warnings}건`);
      for (const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for (const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if (s.errors === 0 && s.warnings === 0) console.log('  ✓ energyClass/velocity/armorDamagePct/medical 전부 manual과 일치');
    }
  }
  return rep;
}

// registry 자체 구조 검증
function validateAmmoRegistry(rep) {
  rep = rep || _mkValidationReport();
  if (typeof AMMO_REGISTRY === 'undefined') { rep.warn('registry', 'AMMO_REGISTRY 미정의'); return rep; }
  const seen = {};
  for (const id in AMMO_REGISTRY) {
    const e = AMMO_REGISTRY[id];
    if (e.id !== id) rep.warn('registry', `${id}: id 필드 불일치`);
    // 중복 id (id 필드 기준)
    if (seen[e.id]) rep.error('registry', `${e.id}: registry id 중복`);
    seen[e.id] = true;
    // manual 백업에 존재하는지 (이관 기준)
    if (typeof LEGACY_AMMO_PRESETS_MANUAL !== 'undefined' && !LEGACY_AMMO_PRESETS_MANUAL[id]) rep.warn('registry', `${id}: manual 백업에 없음 (이관 대상 아님?)`);
    // 필수 필드
    if (!e.display || !e.display.name) rep.error('registry', `${id}: display.name 누락`);
    if (!e.display || !e.display.group) rep.warn('registry', `${id}: display.group 누락 (탄약표 그룹화)`);
    if (!e.ballistic || !_isFiniteNum(e.ballistic.damage) || !_isFiniteNum(e.ballistic.penetration)) rep.error('registry', `${id}: ballistic.damage/penetration 누락`);
    if (!e.ballistic || !_isFiniteNum(e.ballistic.velocity)) rep.warn('registry', `${id}: ballistic.velocity 누락`);
    if (!e.energy || !e.energy.class) rep.warn('registry', `${id}: energy.class 누락`);
    if (!e.durability || !_isFiniteNum(e.durability.armorDamagePct)) rep.warn('registry', `${id}: durability.armorDamagePct 누락`);
    if (!e.medical || Object.keys(e.medical).length === 0) rep.warn('registry', `${id}: medical 프로필 누락`);
    if (!e.ui || e.ui.showInAmmoTable === undefined) rep.info('registry', `${id}: ui.showInAmmoTable 미지정`);
    if (!e.ui || e.ui.showInArmorAnalysis === undefined) rep.info('registry', `${id}: ui.showInArmorAnalysis 미지정`);
    if (e.display && e.display.group && typeof AMMO_REGISTRY_GROUPS!=='undefined' && !AMMO_REGISTRY_GROUPS[e.display.group]) rep.warn('registry', `${id}: group '${e.display.group}' 가 AMMO_REGISTRY_GROUPS에 없음`);
    // 생성 preset이 필수 필드를 갖는지
    const gen = buildAmmoPresetFromRegistry(e);
    if (!gen || !gen.name || !_isFiniteNum(gen.damage) || !_isFiniteNum(gen.penetration)) rep.error('registry', `${id}: 생성 preset 필수 필드 누락`);
    // 산탄총 탄약: projectileType/pelletCount 보존 확인 (manual에 있으면 registry에도 있어야)
    const leg = (typeof LEGACY_AMMO_PRESETS_MANUAL!=='undefined')?LEGACY_AMMO_PRESETS_MANUAL[id]:null;
    if (leg && (leg.projectileType !== undefined || leg.pelletCount !== undefined)) {
      const pj = e.projectile || {};
      if (pj.projectileType === undefined) rep.warn('registry', `${id}: projectile.projectileType 누락 (산탄/투사체 특성)`);
      if (leg.pelletCount !== undefined && pj.pelletCount === undefined) rep.warn('registry', `${id}: projectile.pelletCount 누락`);
    }
  }
  // 완료 단계 completeness (source switch 기준):
  if (typeof LEGACY_AMMO_PRESETS_MANUAL !== 'undefined') {
    // manual 백업의 모든 탄약이 registry에 있는지
    for (const id in LEGACY_AMMO_PRESETS_MANUAL) if (!AMMO_REGISTRY[id]) rep.error('registry', `${id}: manual 백업에 있으나 AMMO_REGISTRY 미이관`);
    // 최종 AMMO_PRESETS 탄약 수가 manual 백업과 같은지
    if (typeof AMMO_PRESETS !== 'undefined') {
      const nFinal = Object.keys(AMMO_PRESETS).length, nManual = Object.keys(LEGACY_AMMO_PRESETS_MANUAL).length;
      if (nFinal !== nManual) rep.error('registry', `AMMO_PRESETS 탄약 수(${nFinal}) ≠ manual 백업(${nManual})`);
      // AMMO_PRESETS의 모든 id가 manual에도 있는지
      for (const id in AMMO_PRESETS) if (!LEGACY_AMMO_PRESETS_MANUAL[id]) rep.warn('registry', `${id}: 최종 AMMO_PRESETS에 있으나 manual 백업에 없음`);
    }
  }
  // 2A-4.9: 모든 탄약이 보조 테이블 4종으로 생성되는지 (registry가 단일 source인지)
  if (typeof buildAmmoAuxTablesFromRegistry === 'function') {
    const aux = buildAmmoAuxTablesFromRegistry();
    for (const id in AMMO_REGISTRY) {
      if (aux.energyClass[id] === undefined) rep.warn('registry', `${id}: AMMO_ENERGY_CLASS 생성 불가 (energy.class 누락)`);
      if (aux.velocity[id] === undefined) rep.warn('registry', `${id}: AMMO_VELOCITY 생성 불가 (ballistic.velocity 누락)`);
      if (aux.armorDamagePct[id] === undefined) rep.warn('registry', `${id}: ARMOR_DAMAGE_PCT 생성 불가 (durability.armorDamagePct 누락)`);
      if (aux.medical[id] === undefined) rep.warn('registry', `${id}: AMMO_MEDICAL 생성 불가 (medical 누락)`);
      // NaN/undefined 방지
      if (aux.velocity[id] !== undefined && !_isFiniteNum(aux.velocity[id])) rep.error('registry', `${id}: velocity 비수치`);
      if (aux.armorDamagePct[id] !== undefined && !_isFiniteNum(aux.armorDamagePct[id])) rep.error('registry', `${id}: armorDamagePct 비수치`);
    }
  }
  return rep;
}
// 디버그 콘솔 접근용
if (typeof window !== 'undefined') {
  window.validateAllPresets = validateAllPresets;
  window.compareRegistryAmmoWithLegacy = compareRegistryAmmoWithLegacy;
  window.compareAmmoAuxTablesWithLegacy = compareAmmoAuxTablesWithLegacy;
  window.buildLegacyAmmoPresetsFromRegistry = buildLegacyAmmoPresetsFromRegistry;
  window.buildAmmoAuxTablesFromRegistry = buildAmmoAuxTablesFromRegistry;
}


