// AMMO PRESETS — 탄약은 자체 damage / penetration / suppression / recoil 보유
//   penetration: 기본 (재질 패널티 없는 fabric 기준의 최대 관통력)
//   damage: 탄 고유 피해 — 52~56이 5.56 표준탄 기준값
//   suppression: 탄당 추가 제압 보정
//   recoil: 추가 반동 (음수면 감소)
//   materialPenPenalty: 재질별 관통력 감소
// =============================================================
const AMMO_DAMAGE_BASELINE = 52;   // 5.56 M855 기준 — damageScale 변환 기준
const ALLOWED_MATERIALS = ['fabric', 'aramid', 'pe', 'steel', 'ceramic', 'composite'];

const LEGACY_AMMO_PRESETS_MANUAL = {   // 2A-4.8: 기존 수동 탄약 원본 (백업/fallback/비교 기준)
  // ===== 5.56×45mm =====
  '556_223_fmj': { id:'556_223_fmj', name:'.223 Rem FMJ', shortName:'.223 FMJ', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / 비군용 FMJ / 관통 낮음 / 반동 적음',
    penetration: 27, damage: 59, suppression: 0.4, recoil: -0.7,
    materialPenPenalty: { fabric:0, aramid:2, pe:8, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
    barrierPenMul: 0.85, barrierStability: 0.5, barrierDamageRetention: 0.75, ricochetMul: 1.25, barrierBehavior: 'normal',
    accuracyMul: 1.00,
    stoppingPower: 1.00, painMul: 1.00,
  },
  '556_m193': { id:'556_m193', name:'5.56 M193', shortName:'M193', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / 구형 군용 FMJ / 평이한 균형',
    penetration: 32, damage: 56, suppression: 0.2, recoil: 0,
    materialPenPenalty: { fabric:0, aramid:1, pe:6, steel:7, aluminum:5, titanium:9, ceramic:10, composite:10 },
    barrierPenMul: 0.85, barrierStability: 0.45, barrierDamageRetention: 0.65, ricochetMul: 1.25, barrierBehavior: 'normal',
    accuracyMul: 0.98,
    stoppingPower: 1.00, painMul: 1.00,
  },
  // 5.56 군용 표준탄
  '556_m855': { id:'556_m855', name:'5.56 M855', shortName:'M855', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / 표준 군용탄 / PE에 강함 / 강철·세라믹에 약함',
    penetration: 46, damage: 52, suppression: 0.2, recoil: 0,
    materialPenPenalty: { fabric:0, aramid:1, pe:2, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
    barrierPenMul: 1.0, barrierStability: 0.45, barrierDamageRetention: 0.75, ricochetMul: 1.55, barrierBehavior: 'penetrator_unstable',
    accuracyMul: 1.00,
    stoppingPower: 1.00, painMul: 1.00,
  },
  '556_m855a1': { id:'556_m855a1', name:'5.56 M855A1 EPR', shortName:'M855A1', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / 강철 페너트레이터 / 재질 상성 적음',
    penetration: 53, damage: 49, suppression: 0.3, recoil: 0.5,
    materialPenPenalty: { fabric:0, aramid:0, pe:1, steel:4, aluminum:3, titanium:6, ceramic:7, composite:6 },
    barrierPenMul: 1.15, barrierStability: 1.2, barrierDamageRetention: 1.05, ricochetMul: 1.25, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 1.10, painMul: 1.10,
  },
  '556_mk318_sost': { id:'556_mk318_sost', name:'5.56 Mk318 Mod 0 SOST', shortName:'SOST', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / SOST / 저지력 우수 / 하드 방호재에는 제한적',
    penetration: 48, damage: 55, suppression: 0.4, recoil: 0.2,
    materialPenPenalty: { fabric:0, aramid:1, pe:6, steel:6, aluminum:4, titanium:8, ceramic:11, composite:10 },
    barrierPenMul: 1.25, barrierStability: 1.65, barrierDamageRetention: 1.35, ricochetMul: 0.8, barrierBehavior: 'barrier_blind',
    accuracyMul: 1.04,
    stoppingPower: 1.15, painMul: 1.15,
  },
  '556_mk255_rrlp': { id:'556_mk255_rrlp', name:'5.56 Mk255 Mod 0 RRLP', shortName:'RRLP', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / RRLP / 저관통·저도탄 / 비방호 저지력 우수',
    penetration: 20, damage: 61, suppression: 0.6, recoil: -0.3,
    materialPenPenalty: { fabric:0, aramid:5, pe:13, steel:13, aluminum:11, titanium:15, ceramic:16, composite:15 },
    barrierPenMul: 0.1, barrierStability: 0.1, barrierDamageRetention: 0.15, ricochetMul: 0.05, barrierBehavior: 'frangible',
    accuracyMul: 0.93,
    stoppingPower: 0.40, painMul: 0.45,
  },
  '556_m995_ap': { id:'556_m995_ap', name:'5.56 M995 AP', shortName:'M995', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / AP / 텅스텐 관통자 / 고관통 저피해',
    penetration: 64, damage: 44, suppression: 0.4, recoil: 0.8,
    materialPenPenalty: { fabric:0, aramid:0, pe:0, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
    barrierPenMul: 1.35, barrierStability: 1.6, barrierDamageRetention: 0.95, ricochetMul: 1.5, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 0.85, painMul: 0.85,
  },
  '556_varmageddon': { id:'556_varmageddon', name:'5.56 Varmageddon', shortName:'.223 Rem Varmint', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / 극단적 파편화 / 비방호 고피해 / 방탄재에 매우 약함',
    penetration: 15, damage: 79, suppression: 1.0, recoil: 0.5,
    materialPenPenalty: { fabric:0, aramid:4, pe:12, steel:13, aluminum:10, titanium:14, ceramic:15, composite:14 },
    barrierPenMul: 0.05, barrierStability: 0.1, barrierDamageRetention: 0.1, ricochetMul: 0.05, barrierBehavior: 'fragment',
    accuracyMul: 0.93,
    stoppingPower: 1.40, painMul: 1.40,
  },
  '556_hp': { id:'556_hp', name:'5.56 HP', shortName:'HP', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / Hollow Point / 고피해 저관통',
    penetration: 24, damage: 62, suppression: 0.5, recoil: -0.3,
    materialPenPenalty: { fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
    barrierPenMul: 0.3, barrierStability: 0.25, barrierDamageRetention: 0.35, ricochetMul: 0.35, barrierBehavior: 'deform',
    accuracyMul: 0.96,
    stoppingPower: 1.30, painMul: 1.30,
  },
  '556_mk262_mod1': { id:'556_mk262_mod1', name:'5.56 Mk262 Mod 1 77gr OTM', shortName:'77gr OTM', type:'small',
    caliber:'5.56x45mm',
    desc:'5.56 / 77gr OTM / 정밀·고피해 / 방탄재 관통은 제한적',
    penetration: 36, damage: 60, suppression: 0.5, recoil: 0.2,
    materialPenPenalty: { fabric:0, aramid:2, pe:8, steel:10, aluminum:7, titanium:12, ceramic:14, composite:13 },
    barrierPenMul: 0.95, barrierStability: 0.85, barrierDamageRetention: 0.85, ricochetMul: 0.85, barrierBehavior: 'precision',
    accuracyMul: 1.10,
    stoppingPower: 1.05, painMul: 1.05,
  },

  // ===== 7.62×51mm =====
  '762_308_fmj': { id:'762_308_fmj', name:'.308 Win FMJ 130gr', shortName:'.308 FMJ', type:'small',
    caliber:'7.62x51mm',
    desc:'7.62 / 사냥용 FMJ / 큰 피해 / 큰 반동',
    penetration: 40, damage: 73, suppression: 1.5, recoil: 1.8,
    materialPenPenalty: { fabric:0, aramid:2, pe:8, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
    barrierPenMul: 1.05, barrierStability: 1.1, barrierDamageRetention: 0.9, ricochetMul: 1.25, barrierBehavior: 'normal_fast',
    accuracyMul: 1.00,
    stoppingPower: 1.30, painMul: 1.30,
  },
  // 7.62 군용 표준탄
  '762_m80': { id:'762_m80', name:'7.62 M80', shortName:'M80', type:'small',
    caliber:'7.62x51mm',
    desc:'7.62 / 표준 군용탄 / 큰 피해·제압 / 큰 반동',
    penetration: 44, damage: 78, suppression: 2.0, recoil: 2.4,
    materialPenPenalty: { fabric:0, aramid:2, pe:6, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
    barrierPenMul: 1.25, barrierStability: 1.35, barrierDamageRetention: 1.0, ricochetMul: 1.45, barrierBehavior: 'full_power',
    accuracyMul: 1.00,
    stoppingPower: 1.35, painMul: 1.35,
  },
  '762_m80a1': { id:'762_m80a1', name:'7.62 M80A1 EPR', shortName:'M80A1 EPR', type:'small',
    caliber:'7.62x51mm',
    desc:'7.62 / 고관통탄 / 재질 상성 적음 / 큰 반동',
    penetration: 60, damage: 74, suppression: 1.8, recoil: 2.3,
    materialPenPenalty: { fabric:0, aramid:0, pe:2, steel:4, aluminum:3, titanium:6, ceramic:7, composite:6 },
    barrierPenMul: 1.35, barrierStability: 1.6, barrierDamageRetention: 1.05, ricochetMul: 1.45, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 1.30, painMul: 1.25,
  },
  '762_m61_ap': { id:'762_m61_ap', name:'7.62 M61 AP', shortName:'M61', type:'small',
    caliber:'7.62x51mm',
    desc:'7.62 / AP / 강철 관통자 / 고관통',
    penetration: 63, damage: 70, suppression: 1.9, recoil: 2.6,
    materialPenPenalty: { fabric:0, aramid:0, pe:1, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
    barrierPenMul: 1.4, barrierStability: 1.65, barrierDamageRetention: 1.0, ricochetMul: 1.7, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 1.10, painMul: 1.05,
  },
  '762_m993_ap': { id:'762_m993_ap', name:'7.62 M993 AP', shortName:'M993', type:'small',
    caliber:'7.62x51mm',
    desc:'7.62 / AP / 텅스텐 관통자 / 최상위 관통탄',
    penetration: 72, damage: 68, suppression: 2.0, recoil: 2.8,
    materialPenPenalty: { fabric:0, aramid:0, pe:0, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
    barrierPenMul: 1.55, barrierStability: 1.95, barrierDamageRetention: 0.95, ricochetMul: 1.7, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 1.05, painMul: 1.00,
  },

  // ===== 9×19mm =====
  '9mm_115gr': { id:'9mm_115gr', name:'9mm Luger FMJ 115gr', shortName:'115gr FMJ', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 민수용 FMJ / 하드 방호 약함',
    penetration: 16, damage: 52, suppression: 0.1, recoil: -0.2,
    materialPenPenalty: { fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
    barrierPenMul: 0.7, barrierStability: 0.45, barrierDamageRetention: 0.65, ricochetMul: 1.25, barrierBehavior: 'round_fmj',
    accuracyMul: 0.98,
    stoppingPower: 0.90, painMul: 0.85,
  },
  '9mm_124gr': { id:'9mm_124gr', name:'9mm Luger FMJ 124gr', shortName:'FMJ', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 민수용 표준 FMJ / 하드 방호 약함',
    penetration: 17, damage: 54, suppression: 0.4, recoil: 0,
    materialPenPenalty: { fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
    barrierPenMul: 0.7, barrierStability: 0.45, barrierDamageRetention: 0.65, ricochetMul: 1.25, barrierBehavior: 'round_fmj',
    accuracyMul: 1.00,
    stoppingPower: 0.95, painMul: 0.90,
  },
  '9mm_m882': { id:'9mm_m882', name:'9mm M882', shortName:'M882', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 군용 표준 FMJ / 일부 차폐물 침투',
    penetration: 21, damage: 55, suppression: 0.5, recoil: 0.2,
    materialPenPenalty: { fabric:0, aramid:1, pe:7, steel:8, aluminum:6, titanium:10, ceramic:12, composite:11 },
    barrierPenMul: 0.8, barrierStability: 0.55, barrierDamageRetention: 0.7, ricochetMul: 1.25, barrierBehavior: 'round_fmj',
    accuracyMul: 1.00,
    stoppingPower: 0.95, painMul: 0.90,
  },
  '9mm_7n21': { id:'9mm_7n21', name:'9mm 7N21', shortName:'7N21', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 강철심 AP / 아라미드/헬멧에 위협적',
    penetration: 28, damage: 51, suppression: 0.6, recoil: 0.4,
    materialPenPenalty: { fabric:0, aramid:0, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
    barrierPenMul: 1.0, barrierStability: 1.1, barrierDamageRetention: 0.85, ricochetMul: 1.45, barrierBehavior: 'pistol_penetrator',
    accuracyMul: 1.00,
    stoppingPower: 0.80, painMul: 0.85,
  },
  '9mm_7n31': { id:'9mm_7n31', name:'9mm 7N31', shortName:'7N31', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 최고급 권총 AP / 소프트아머·헬멧 관통 가능',
    penetration: 35, damage: 50, suppression: 0.8, recoil: 0.9,
    materialPenPenalty: { fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
    barrierPenMul: 1.1, barrierStability: 1.3, barrierDamageRetention: 0.9, ricochetMul: 1.5, barrierBehavior: 'pistol_penetrator',
    accuracyMul: 1.02,
    stoppingPower: 0.85, painMul: 0.85,
  },
  // === 신규 9mm 확장탄 / 고저지력탄 ===
  '9mm_jhp': { id:'9mm_jhp', name:'9mm JHP', shortName:'JHP', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 자켓홀로포인트 / 비방호 고저지력 / 방탄재 매우 취약',
    penetration: 13, damage: 64, suppression: 0.6, recoil: 0.1,
    materialPenPenalty: { fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
    barrierPenMul: 0.40, barrierStability: 0.35, barrierDamageRetention: 0.45, ricochetMul: 0.55, barrierBehavior: 'deform',
    accuracyMul: 0.96,
    stoppingPower: 1.30, painMul: 1.30,
  },
  '9mm_jhp_p': { id:'9mm_jhp_p', name:'9mm +P JHP', shortName:'+P JHP', type:'small',
    caliber:'9x19mm',
    desc:'9mm +P / 고압 JHP / 비방호 정지력 우수 / 반동 큼',
    penetration: 16, damage: 66, suppression: 0.7, recoil: 0.5,
    materialPenPenalty: { fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
    barrierPenMul: 0.45, barrierStability: 0.40, barrierDamageRetention: 0.50, ricochetMul: 0.55, barrierBehavior: 'deform',
    accuracyMul: 0.95,
    stoppingPower: 1.35, painMul: 1.30,
  },
  '9mm_rip': { id:'9mm_rip', name:'9mm R.I.P.', shortName:'R.I.P.', type:'small',
    caliber:'9x19mm',
    desc:'9mm / 다중 파편 분리탄 / 비방호 극단적 저지력 / 방탄재·장애물에 거의 무력',
    penetration: 10, damage: 84, suppression: 0.6, recoil: 0.2,
    materialPenPenalty: { fabric:0, aramid:5, pe:13, steel:13, aluminum:11, titanium:15, ceramic:16, composite:15 },
    barrierPenMul: 0.18, barrierStability: 0.18, barrierDamageRetention: 0.22, ricochetMul: 0.25, barrierBehavior: 'fragment',
    accuracyMul: 0.94,
    stoppingPower: 1.60, painMul: 1.58,
  },

  // ===== 7.62×39mm =====
  '762x39_hp': { id:'762x39_hp', name:'7.62×39 HP', shortName:'HP', type:'small',
    caliber:'7.62x39mm',
    desc:'7.62×39 / 민수 HP / 비방호 고피해 / 방탄복에 매우 약함',
    penetration: 18, damage: 84, suppression: 1.3, recoil: 1.0,
    materialPenPenalty: { fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
    barrierPenMul: 0.45, barrierStability: 0.45, barrierDamageRetention: 0.4, ricochetMul: 0.4, barrierBehavior: 'deform',
    accuracyMul: 0.95,
    stoppingPower: 1.40, painMul: 1.40,
  },
  '762x39_sp': { id:'762x39_sp', name:'7.62×39 SP', shortName:'SP', type:'small',
    caliber:'7.62x39mm',
    desc:'7.62×39 / 민수 SP / 비방호·낮은 방호에 강함',
    penetration: 22, damage: 69, suppression: 1.1, recoil: 1.0,
    materialPenPenalty: { fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:14, composite:13 },
    barrierPenMul: 0.45, barrierStability: 0.45, barrierDamageRetention: 0.4, ricochetMul: 0.4, barrierBehavior: 'deform',
    accuracyMul: 0.96,
    stoppingPower: 1.30, painMul: 1.30,
  },
  '762x39_us': { id:'762x39_us', name:'7.62×39 US (57-N-231U)', shortName:'US', type:'small',
    caliber:'7.62x39mm',
    desc:'7.62×39 / 아음속탄 / 저반동·저관통·저제압',
    penetration: 20, damage: 58, suppression: 0.5, recoil: 0.4,
    materialPenPenalty: { fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:15, composite:14 },
    barrierPenMul: 0.75, barrierStability: 1.1, barrierDamageRetention: 0.85, ricochetMul: 1.0, barrierBehavior: 'subsonic',
    accuracyMul: 0.92,
    stoppingPower: 1.05, painMul: 1.05,
  },
  '762x39_ps': { id:'762x39_ps', name:'7.62×39 PS (57-N-231)', shortName:'PS', type:'small',
    caliber:'7.62x39mm',
    desc:'7.62×39 / 군용 표준탄 / AK 계열 기본 탄약',
    penetration: 36, damage: 64, suppression: 1.2, recoil: 1.2,
    materialPenPenalty: { fabric:0, aramid:1, pe:4, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
    barrierPenMul: 1.1, barrierStability: 0.85, barrierDamageRetention: 0.9, ricochetMul: 1.25, barrierBehavior: 'normal_heavy',
    accuracyMul: 1.00,
    stoppingPower: 1.30, painMul: 1.30,
  },
  '762x39_pp': { id:'762x39_pp', name:'7.62×39 PP (7N27)', shortName:'PP', type:'small',
    caliber:'7.62x39mm',
    desc:'7.62×39 / 관통 강화탄 / 하드 방호 위협',
    penetration: 50, damage: 60, suppression: 1.3, recoil: 1.5,
    materialPenPenalty: { fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
    barrierPenMul: 1.2, barrierStability: 1.25, barrierDamageRetention: 0.95, ricochetMul: 1.45, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 1.20, painMul: 1.15,
  },
  '762x39_bp': { id:'762x39_bp', name:'7.62×39 BP (7N23)', shortName:'BP', type:'small',
    caliber:'7.62x39mm',
    desc:'7.62×39 / 철갑탄 / 7.62×39 최상위 관통',
    penetration: 55, damage: 58, suppression: 1.4, recoil: 1.7,
    materialPenPenalty: { fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
    barrierPenMul: 1.3, barrierStability: 1.35, barrierDamageRetention: 0.95, ricochetMul: 1.7, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 1.10, painMul: 1.05,
  },

  // ===== 5.45×39mm =====
  '545_hp': { id:'545_hp', name:'5.45×39 HP', shortName:'HP', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / Hollow Point / 비방호 고피해 / 방탄재에 약함',
    penetration: 16, damage: 59, suppression: 0.4, recoil: -0.5,
    materialPenPenalty: { fabric:0, aramid:4, pe:11, steel:12, aluminum:10, titanium:14, ceramic:15, composite:14 },
    barrierPenMul: 0.3, barrierStability: 0.15, barrierDamageRetention: 0.3, ricochetMul: 0.35, barrierBehavior: 'deform',
    accuracyMul: 0.95,
    stoppingPower: 1.30, painMul: 1.30,
  },
  '545_prs_gs': { id:'545_prs_gs', name:'5.45×39 PRS gs', shortName:'PRS', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 저도탄 / 저관통',
    penetration: 12, damage: 48, suppression: 0.2, recoil: -0.6,
    materialPenPenalty: { fabric:0, aramid:5, pe:13, steel:13, aluminum:11, titanium:15, ceramic:16, composite:15 },
    barrierPenMul: 0.1, barrierStability: 0.2, barrierDamageRetention: 0.15, ricochetMul: 0.05, barrierBehavior: 'frangible',
    accuracyMul: 0.92,
    stoppingPower: 0.40, painMul: 0.45,
  },
  '545_sp': { id:'545_sp', name:'5.45×39 SP', shortName:'SP', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / Soft Point / 고피해 저관통',
    penetration: 20, damage: 57, suppression: 0.4, recoil: -0.4,
    materialPenPenalty: { fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:14, composite:13 },
    barrierPenMul: 0.3, barrierStability: 0.15, barrierDamageRetention: 0.3, ricochetMul: 0.35, barrierBehavior: 'deform',
    accuracyMul: 0.96,
    stoppingPower: 1.25, painMul: 1.25,
  },
  '545_us_gs': { id:'545_us_gs', name:'5.45×39 US gs (7U1)', shortName:'US', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 아음속 / 저반동·저관통',
    penetration: 23, damage: 46, suppression: 0.2, recoil: -0.7,
    materialPenPenalty: { fabric:0, aramid:3, pe:10, steel:11, aluminum:8, titanium:13, ceramic:15, composite:14 },
    barrierPenMul: 0.65, barrierStability: 0.85, barrierDamageRetention: 0.75, ricochetMul: 0.95, barrierBehavior: 'subsonic',
    accuracyMul: 0.92,
    stoppingPower: 0.85, painMul: 0.85,
  },
  '545_fmj': { id:'545_fmj', name:'5.45×39 FMJ', shortName:'FMJ', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 민수용 표준 FMJ / 낮은 반동',
    penetration: 25, damage: 52, suppression: 0.1, recoil: -0.4,
    materialPenPenalty: { fabric:0, aramid:2, pe:8, steel:8, aluminum:6, titanium:10, ceramic:11, composite:11 },
    barrierPenMul: 0.8, barrierStability: 0.55, barrierDamageRetention: 0.7, ricochetMul: 1.1, barrierBehavior: 'normal',
    accuracyMul: 1.00,
    stoppingPower: 0.95, painMul: 0.95,
  },
  '545_ps_gs': { id:'545_ps_gs', name:'5.45×39 PS gs (7N6)', shortName:'PS', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 군용 표준탄 / 저반동',
    penetration: 35, damage: 49, suppression: 0.1, recoil: -0.3,
    materialPenPenalty: { fabric:0, aramid:1, pe:3, steel:6, aluminum:4, titanium:8, ceramic:9, composite:8 },
    barrierPenMul: 0.9, barrierStability: 0.15, barrierDamageRetention: 0.55, ricochetMul: 1.55, barrierBehavior: 'unstable',
    accuracyMul: 1.00,
    stoppingPower: 1.00, painMul: 1.00,
  },
  '545_pp_gs': { id:'545_pp_gs', name:'5.45×39 PP gs (7N10)', shortName:'PP', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 관통 강화탄',
    penetration: 42, damage: 47, suppression: 0.2, recoil: -0.2,
    materialPenPenalty: { fabric:0, aramid:0, pe:2, steel:5, aluminum:3, titanium:7, ceramic:8, composite:7 },
    barrierPenMul: 1.0, barrierStability: 0.7, barrierDamageRetention: 0.8, ricochetMul: 1.45, barrierBehavior: 'penetrator_unstable',
    accuracyMul: 1.02,
    stoppingPower: 0.95, painMul: 0.95,
  },
  '545_bp_gs': { id:'545_bp_gs', name:'5.45×39 BP gs (7N22)', shortName:'BP', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 고관통탄',
    penetration: 50, damage: 45, suppression: 0.3, recoil: 0.1,
    materialPenPenalty: { fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
    barrierPenMul: 1.15, barrierStability: 1.1, barrierDamageRetention: 0.95, ricochetMul: 1.5, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 0.90, painMul: 0.90,
  },
  '545_bs_gs': { id:'545_bs_gs', name:'5.45×39 BS gs (7N24)', shortName:'BS', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 상위 AP / 높은 관통력',
    penetration: 57, damage: 43, suppression: 0.4, recoil: 0.3,
    materialPenPenalty: { fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
    barrierPenMul: 1.25, barrierStability: 1.3, barrierDamageRetention: 1.0, ricochetMul: 1.65, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 0.85, painMul: 0.85,
  },
  '545_7n40': { id:'545_7n40', name:'5.45×39 7N40', shortName:'7N40', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 현대식 저반동·고정밀 탄 / 관통보다 명중 안정성',
    penetration: 46, damage: 46, suppression: 0.2, recoil: -0.6,
    materialPenPenalty: { fabric:0, aramid:0, pe:1, steel:4, aluminum:2, titanium:6, ceramic:7, composite:6 },
    barrierPenMul: 1.0, barrierStability: 0.85, barrierDamageRetention: 0.85, ricochetMul: 0.85, barrierBehavior: 'precision',
    accuracyMul: 1.15,
    stoppingPower: 1.00, painMul: 1.00,
  },
  '545_ppbs_gs': { id:'545_ppbs_gs', name:'5.45×39 PPBS gs (7N39)', shortName:'PPBS', type:'small',
    caliber:'5.45x39mm',
    desc:'5.45 / 최상위 AP / 매우 높은 관통력 / 낮은 피해',
    penetration: 64, damage: 39, suppression: 0.4, recoil: 0.5,
    materialPenPenalty: { fabric:0, aramid:0, pe:0, steel:2, aluminum:1, titanium:4, ceramic:5, composite:4 },
    barrierPenMul: 1.35, barrierStability: 1.55, barrierDamageRetention: 0.95, ricochetMul: 1.8, barrierBehavior: 'penetrator',
    accuracyMul: 1.02,
    stoppingPower: 0.85, painMul: 0.85,
  },

  // ===== 12 Gauge — 산탄총 =====
  // damage / penetration / armorDamagePct는 펠릿/슬러그 1발 기준.
  // pelletCount > 1이면 다중 raycast로 처리됨.
  '12g_00buck': { id:'12g_00buck', name:'12ga 00 Buckshot', shortName:'00 Buck', type:'small',
    caliber:'12ga',
    desc:'12ga / 산탄 9펠릿 / 근거리 비방호 매우 위험 / 방탄판에는 한계',
    projectileType: 'pellet',
    pelletCount: 9,
    patternType: 'clustered_circle',
    penetration: 12, damage: 15, suppression: 1.5, recoil: 2.5,
    materialPenPenalty: { fabric:0, aramid:3, pe:8, steel:10, aluminum:7, titanium:12, ceramic:12, composite:11 },
    barrierPenMul: 0.55, barrierStability: 0.40, barrierDamageRetention: 0.55, ricochetMul: 1.40, barrierBehavior: 'buckshot',
    accuracyMul: 0.85,
    stoppingPower: 0.45, painMul: 0.60,
    // SHOTGUN-MED-NORM-1 §7: 의료 전용 투사체 메타 (탄도/방호/관통 계산엔 미사용 — wound size만)
    projectile: { projectileType:'pellet', pelletCount:9, patternType:'clustered_circle', massG:3.49, effectiveDiameterMm:8.4, medicalProjectileClass:'buckshot_pellet', pelletMedicalScalar:0.55, maxEntryClass:'small', maxInternalClass:'medium', maxExitClass:'small' },
  },
  '12g_slug': { id:'12g_slug', name:'12ga Rifled Slug', shortName:'Slug', type:'small',
    caliber:'12ga',
    desc:'12ga / 단일 대구경 / 매우 높은 저지력·둔상 / 방탄판도 큰 충격',
    projectileType: 'single',
    pelletCount: 1,
    penetration: 32, damage: 95, suppression: 2.2, recoil: 3.0,
    materialPenPenalty: { fabric:0, aramid:2, pe:5, steel:7, aluminum:5, titanium:9, ceramic:10, composite:8 },
    barrierPenMul: 0.95, barrierStability: 0.85, barrierDamageRetention: 0.85, ricochetMul: 1.10, barrierBehavior: 'normal_heavy',
    accuracyMul: 0.90,
    stoppingPower: 1.90, painMul: 1.65, bluntTraumaMul: 1.70,
  },
  '12g_flechette': { id:'12g_flechette', name:'12ga Flechette', shortName:'Flechette', type:'small',
    caliber:'12ga',
    desc:'12ga / 화살형 20개 / 펠릿당 피해는 낮지만 다수 플레셰트가 얕고 좁은 상처를 만든다',
    projectileType: 'pellet',
    pelletCount: 20,
    patternType: 'flechette_cluster',
    penetration: 20, damage: 5, suppression: 1.3, recoil: 2.6,
    materialPenPenalty: { fabric:0, aramid:1, pe:3, steel:6, aluminum:4, titanium:9, ceramic:10, composite:8 },
    barrierPenMul: 0.80, barrierStability: 0.55, barrierDamageRetention: 0.55, ricochetMul: 1.45, barrierBehavior: 'penetrator_unstable',
    accuracyMul: 0.92,
    stoppingPower: 0.35, painMul: 0.50,
    // SHOTGUN-MED-NORM-1 §7/§16: 의료 전용 투사체 메타 — 좁은 dart. 탄도/방호는 무변경.
    projectile: { projectileType:'pellet', pelletCount:20, patternType:'flechette_cluster', massG:0.47, effectiveDiameterMm:1.5, medicalProjectileClass:'flechette_dart', pelletMedicalScalar:0.22, maxEntryClass:'micro', maxInternalClass:'small', maxExitClass:'small', forceProjectileSizeClass:'sabot_subcaliber' },
  },
};

// =============================================================
// armorDamagePct — 탄종별 방어구 내구도 손상 성향 (0~100)
// =============================================================
//   인체 피해(damage)와 분리. 같은 탄이라도 방어구 손상은 별도 스케일.
//   AP/penetrator/풀파워탄은 높음. HP/JHP/RIP/frangible은 낮음.
const LEGACY_ARMOR_DAMAGE_PCT_MANUAL = {   // 2A-4.9: 수동 백업 (registry 생성물이 기본)
  // 9mm
  '9mm_115gr': 13, '9mm_124gr': 14, '9mm_m882': 18,
  '9mm_7n21': 38, '9mm_7n31': 55,
  '9mm_jhp': 12, '9mm_jhp_p': 14, '9mm_rip': 11,
  // 5.56
  '556_223_fmj': 28, '556_m193': 30, '556_m855': 37, '556_m855a1': 47,
  '556_mk318_sost': 38, '556_mk255_rrlp': 8, '556_m995_ap': 52,
  '556_varmageddon': 11, '556_hp': 16, '556_mk262_mod1': 34,
  // 5.45
  '545_hp': 12, '545_prs_gs': 8, '545_sp': 14, '545_us_gs': 24, '545_fmj': 28,
  '545_ps_gs': 34, '545_pp_gs': 42, '545_bp_gs': 50, '545_bs_gs': 55,
  '545_7n40': 45, '545_ppbs_gs': 59,
  // 12ga (펠릿 1발 / 슬러그 단일 기준)
  '12g_00buck': 10, '12g_slug': 45, '12g_flechette': 18,
  // 7.62×39
  '762x39_hp': 24, '762x39_sp': 26, '762x39_us': 24,
  '762x39_ps': 42, '762x39_pp': 50, '762x39_bp': 57,
  // 7.62×51
  '762_308_fmj': 55, '762_m80': 55, '762_m80a1': 68,
  '762_m61_ap': 75, '762_m993_ap': 85,
};
// 일괄 적용
for (const id in LEGACY_ARMOR_DAMAGE_PCT_MANUAL) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id]) LEGACY_AMMO_PRESETS_MANUAL[id].armorDamagePct = LEGACY_ARMOR_DAMAGE_PCT_MANUAL[id];
}
// 미정의 탄은 기본값 25
for (const id in LEGACY_AMMO_PRESETS_MANUAL) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id].armorDamagePct == null) LEGACY_AMMO_PRESETS_MANUAL[id].armorDamagePct = 25;
}

const ARMOR_DAMAGE_PCT = {};
Object.assign(ARMOR_DAMAGE_PCT, LEGACY_ARMOR_DAMAGE_PCT_MANUAL);

// =============================================================
// velocity — 탄약별 출구 속도 (m/s)
// =============================================================
//   실제 비행 시뮬용 아님. 관통력 유지 / 장벽 관통 후 안정성 / 명중률 보정.
//   현실 자료 + Tarkov 자료 + 비슷한 구경 평균값 절충.
const LEGACY_AMMO_VELOCITY_MANUAL = {   // 2A-4.9: 수동 백업
  // 9mm — 380~600
  '9mm_115gr': 380, '9mm_124gr': 360, '9mm_m882': 400,
  '9mm_7n21': 460, '9mm_7n31': 580,
  '9mm_jhp': 360, '9mm_jhp_p': 390, '9mm_rip': 380,
  // 5.56 — 880~960
  '556_223_fmj': 900, '556_m193': 990, '556_m855': 925, '556_m855a1': 955,
  '556_mk318_sost': 935, '556_mk255_rrlp': 880, '556_m995_ap': 1015,
  '556_varmageddon': 920, '556_hp': 900, '556_mk262_mod1': 850,
  // 5.45 — 850~920
  '545_hp': 840, '545_prs_gs': 860, '545_sp': 870, '545_us_gs': 305,
  '545_fmj': 880, '545_ps_gs': 890, '545_pp_gs': 890, '545_bp_gs': 890,
  '545_bs_gs': 880, '545_7n40': 900, '545_ppbs_gs': 910,
  // 12ga (펠릿/슬러그 muzzle)
  '12g_00buck': 400, '12g_slug': 450, '12g_flechette': 475,
  // 7.62×39 — 700~750
  '762x39_hp': 715, '762x39_sp': 720, '762x39_us': 305,
  '762x39_ps': 718, '762x39_pp': 730, '762x39_bp': 745,
  // 7.62×51 — 820~930
  '762_308_fmj': 850, '762_m80': 833, '762_m80a1': 850,
  '762_m61_ap': 855, '762_m993_ap': 910,
};
for (const id in LEGACY_AMMO_VELOCITY_MANUAL) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id]) LEGACY_AMMO_PRESETS_MANUAL[id].velocity = LEGACY_AMMO_VELOCITY_MANUAL[id];
}
// 미정의 탄은 기본값 — 구경별 평균 추정
for (const id in LEGACY_AMMO_PRESETS_MANUAL) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id].velocity == null) {
    if (id.startsWith('9mm'))   LEGACY_AMMO_PRESETS_MANUAL[id].velocity = 380;
    else if (id.startsWith('556'))     LEGACY_AMMO_PRESETS_MANUAL[id].velocity = 920;
    else if (id.startsWith('545'))     LEGACY_AMMO_PRESETS_MANUAL[id].velocity = 880;
    else if (id.startsWith('762x39'))  LEGACY_AMMO_PRESETS_MANUAL[id].velocity = 720;
    else if (id.startsWith('762'))     LEGACY_AMMO_PRESETS_MANUAL[id].velocity = 850;
    else LEGACY_AMMO_PRESETS_MANUAL[id].velocity = 500;
  }
}

const AMMO_VELOCITY = {};
Object.assign(AMMO_VELOCITY, LEGACY_AMMO_VELOCITY_MANUAL);

// =============================================================
// energyClass — 구경/에너지 분류 (장벽 관통 감쇠 보정용)
// =============================================================
//   ammo.energyClass가 있으면 그 값을 우선 사용한다.
//   없으면 caliber 기반 fallback. 새 탄종 추가 시 energyClass만 지정하면 됨.
const LEGACY_AMMO_ENERGY_CLASS_MANUAL = {   // 2A-4.9: 수동 백업
  // 9mm — 일반 vs AP 분리
  '9mm_115gr': 'pistol', '9mm_124gr': 'pistol', '9mm_m882': 'pistol',
  '9mm_jhp': 'pistol', '9mm_jhp_p': 'pistol', '9mm_rip': 'pistol',
  '9mm_7n21': 'pistol_ap', '9mm_7n31': 'pistol_ap',
  // 5.56 / 5.45 — 모두 small_rifle
  '556_223_fmj': 'small_rifle', '556_m193': 'small_rifle', '556_m855': 'small_rifle',
  '556_m855a1': 'small_rifle', '556_mk318_sost': 'small_rifle',
  '556_mk255_rrlp': 'small_rifle', '556_m995_ap': 'small_rifle',
  '556_varmageddon': 'small_rifle', '556_hp': 'small_rifle', '556_mk262_mod1': 'small_rifle',
  '545_hp': 'small_rifle', '545_prs_gs': 'small_rifle', '545_sp': 'small_rifle',
  '545_us_gs': 'subsonic', '545_fmj': 'small_rifle', '545_ps_gs': 'small_rifle',
  '545_pp_gs': 'small_rifle', '545_bp_gs': 'small_rifle', '545_bs_gs': 'small_rifle',
  '545_7n40': 'small_rifle', '545_ppbs_gs': 'small_rifle',
  // 12ga
  '12g_00buck': 'shotgun', '12g_slug': 'shotgun', '12g_flechette': 'shotgun',
  // 7.62×39 — intermediate_rifle
  '762x39_hp': 'intermediate_rifle', '762x39_sp': 'intermediate_rifle',
  '762x39_us': 'subsonic',
  '762x39_ps': 'intermediate_rifle', '762x39_pp': 'intermediate_rifle', '762x39_bp': 'intermediate_rifle',
  // 7.62×51 / .308 — full_power_rifle
  '762_308_fmj': 'full_power_rifle', '762_m80': 'full_power_rifle',
  '762_m80a1': 'full_power_rifle', '762_m61_ap': 'full_power_rifle', '762_m993_ap': 'full_power_rifle',
};
for (const id in LEGACY_AMMO_ENERGY_CLASS_MANUAL) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id]) LEGACY_AMMO_PRESETS_MANUAL[id].energyClass = LEGACY_AMMO_ENERGY_CLASS_MANUAL[id];
}

const AMMO_ENERGY_CLASS = {};
Object.assign(AMMO_ENERGY_CLASS, LEGACY_AMMO_ENERGY_CLASS_MANUAL);

// =============================================================
// velocityDragClass — 미래 확장용 (거리별 탄속 감소 / 파쇄임계탄속)
// =============================================================
//   ammo.velocityDragClass 우선, 없으면 energyClass 기반 fallback.
const AMMO_DRAG_CLASS = {
  // 5.45 PRS — 저도탄/저도비산 (frangible이지만 아음속 아님)
  '545_prs_gs': 'frangible_poor',
  // 5.56 — 경량 고속 라이플
  '556_m193': 'rifle_light', '556_m855': 'rifle_light', '556_m855a1': 'rifle_light',
  '556_mk318_sost': 'rifle_light', '556_mk262_mod1': 'rifle_light',
  '556_223_fmj': 'rifle_light', '556_hp': 'rifle_light',
  '556_varmageddon': 'frangible_poor', '556_mk255_rrlp': 'frangible_poor',
  '556_m995_ap': 'ap_streamlined',
  // 5.45 — 경량 라이플
  '545_fmj': 'rifle_light', '545_ps_gs': 'rifle_light', '545_pp_gs': 'rifle_light',
  '545_sp': 'rifle_light', '545_hp': 'frangible_poor',
  '545_bp_gs': 'ap_streamlined', '545_bs_gs': 'ap_streamlined',
  '545_7n40': 'ap_streamlined', '545_ppbs_gs': 'ap_streamlined',
  // 12ga
  '12g_00buck': 'shotgun', '12g_slug': 'shotgun', '12g_flechette': 'shotgun',
  '545_us_gs': 'subsonic',
  // 7.62×39 — intermediate
  '762x39_hp': 'frangible_poor', '762x39_sp': 'rifle_heavy',
  '762x39_ps': 'rifle_heavy', '762x39_pp': 'rifle_heavy',
  '762x39_bp': 'ap_streamlined', '762x39_us': 'subsonic',
  // 7.62×51 — 풀파워
  '762_308_fmj': 'rifle_heavy', '762_m80': 'rifle_heavy',
  '762_m80a1': 'ap_streamlined', '762_m61_ap': 'ap_streamlined', '762_m993_ap': 'ap_streamlined',
  // 9mm
  '9mm_115gr': 'pistol', '9mm_124gr': 'pistol', '9mm_m882': 'pistol',
  '9mm_jhp': 'pistol', '9mm_jhp_p': 'pistol', '9mm_rip': 'frangible_poor',
  '9mm_7n21': 'pistol_fast', '9mm_7n31': 'pistol_fast',
};
for (const id in AMMO_DRAG_CLASS) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id]) LEGACY_AMMO_PRESETS_MANUAL[id].velocityDragClass = AMMO_DRAG_CLASS[id];
}

// 거리별 탄속 감쇠 — 100m당 retention 배율 (현실 단순화)
const DRAG_RETENTION_PER_100M = {
  pistol:          0.88,
  pistol_fast:     0.90,
  rifle_light:     0.94,
  rifle_heavy:     0.95,
  ap_streamlined:  0.96,
  subsonic:        0.92,
  frangible_poor:  0.86,
  shotgun:         0.80,   // 펠릿/슬러그 — 거리 감쇠 매우 큼
};
function getVelocityDragClass(ammo) {
  if (!ammo) return 'rifle_light';
  if (ammo.velocityDragClass) return ammo.velocityDragClass;
  const ec = getCaliberEnergyClass(ammo);
  if (ec === 'pistol') return 'pistol';
  if (ec === 'pistol_ap') return 'pistol_fast';
  if (ec === 'subsonic') return 'subsonic';
  if (ec === 'full_power_rifle') return 'rifle_heavy';
  if (ec === 'intermediate_rifle') return 'rifle_heavy';
  if (ec === 'shotgun') return 'shotgun';
  return 'rifle_light';
}
function getDistanceVelocityRetention(ammo, distanceM) {
  const dragClass = getVelocityDragClass(ammo);
  const per100 = DRAG_RETENTION_PER_100M[dragClass] || 0.93;
  // 100m마다 per100 비율씩 곱함 — pow(per100, distance/100)
  return Math.pow(per100, distanceM / 100);
}

// =============================================================
// TERMINAL_EFFECTS — 탄종별 파쇄/yaw/확장 임계 + 효과
// =============================================================
//   thresholdVelocity 이상이면 ideal 종말효과,
//   이하면 tissue/bleed/shock 감소.
const AMMO_TERMINAL_EFFECT = {
  // 5.56 — fragment/yaw 의존성 큼
  '556_m193': { type:'fragment', thresholdVelocity: 780,
    aboveTissueMul: 1.45, belowTissueMul: 0.65, aboveBleedMul: 1.25, belowBleedMul: 0.85, aboveShockMul: 1.15, belowShockMul: 0.85 },
  '556_m855': { type:'yaw', thresholdVelocity: 760,
    aboveTissueMul: 1.20, belowTissueMul: 0.75, aboveBleedMul: 1.15, belowBleedMul: 0.85, aboveShockMul: 1.10, belowShockMul: 0.90 },
  '556_m855a1': { type:'controlled_fragment', thresholdVelocity: 720,
    aboveTissueMul: 1.25, belowTissueMul: 0.85, aboveBleedMul: 1.15, belowBleedMul: 0.90, aboveShockMul: 1.10, belowShockMul: 0.95 },
  '556_mk318_sost': { type:'barrier_blind', thresholdVelocity: 680,
    aboveTissueMul: 1.30, belowTissueMul: 0.95, aboveBleedMul: 1.20, belowBleedMul: 1.00, aboveShockMul: 1.15, belowShockMul: 0.95 },
  '556_mk262_mod1': { type:'fragment', thresholdVelocity: 700,
    aboveTissueMul: 1.30, belowTissueMul: 0.80, aboveBleedMul: 1.20, belowBleedMul: 0.85, aboveShockMul: 1.10, belowShockMul: 0.85 },
  '556_223_fmj': { type:'yaw', thresholdVelocity: 760,
    aboveTissueMul: 1.10, belowTissueMul: 0.80, aboveBleedMul: 1.05, belowBleedMul: 0.90, aboveShockMul: 1.05, belowShockMul: 0.90 },
  '556_varmageddon': { type:'fragment', thresholdVelocity: 800,
    aboveTissueMul: 1.55, belowTissueMul: 0.50, aboveBleedMul: 1.30, belowBleedMul: 0.70, aboveShockMul: 1.15, belowShockMul: 0.75 },
  '556_hp':      { type:'expand', thresholdVelocity: 770,
    aboveTissueMul: 1.35, belowTissueMul: 0.65, aboveBleedMul: 1.25, belowBleedMul: 0.80, aboveShockMul: 1.15, belowShockMul: 0.85 },
  '556_mk255_rrlp': { type:'frangible', thresholdVelocity: 800,
    aboveTissueMul: 1.50, belowTissueMul: 0.40, aboveBleedMul: 1.20, belowBleedMul: 0.65, aboveShockMul: 1.10, belowShockMul: 0.70 },
  '556_m995_ap': { type:'penetrator', thresholdVelocity: 700,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },

  // 5.45
  '545_ps_gs': { type:'yaw', thresholdVelocity: 740,
    aboveTissueMul: 1.20, belowTissueMul: 0.80, aboveBleedMul: 1.10, belowBleedMul: 0.90, aboveShockMul: 1.10, belowShockMul: 0.90 },
  '545_pp_gs': { type:'yaw', thresholdVelocity: 740,
    aboveTissueMul: 1.20, belowTissueMul: 0.80, aboveBleedMul: 1.10, belowBleedMul: 0.90, aboveShockMul: 1.10, belowShockMul: 0.90 },
  '545_bp_gs': { type:'penetrator', thresholdVelocity: 680,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },
  '545_bs_gs': { type:'penetrator', thresholdVelocity: 680,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },

  // 7.62×39
  '762x39_ps': { type:'yaw', thresholdVelocity: 620,
    aboveTissueMul: 1.15, belowTissueMul: 0.85, aboveBleedMul: 1.10, belowBleedMul: 0.95, aboveShockMul: 1.05, belowShockMul: 0.95 },

  // 7.62×51 — 풀파워, 속도 떨어져도 기본 피해 강함
  '762_m80': { type:'full_power', thresholdVelocity: 600,
    aboveTissueMul: 1.10, belowTissueMul: 0.90, aboveBleedMul: 1.05, belowBleedMul: 0.95, aboveShockMul: 1.05, belowShockMul: 0.95 },
  '762_308_fmj': { type:'full_power', thresholdVelocity: 600,
    aboveTissueMul: 1.10, belowTissueMul: 0.90, aboveBleedMul: 1.05, belowBleedMul: 0.95, aboveShockMul: 1.05, belowShockMul: 0.95 },
  '762_m80a1': { type:'controlled_fragment', thresholdVelocity: 620,
    aboveTissueMul: 1.20, belowTissueMul: 0.90, aboveBleedMul: 1.10, belowBleedMul: 0.95, aboveShockMul: 1.10, belowShockMul: 0.95 },
  '762_m61_ap':  { type:'penetrator', thresholdVelocity: 600,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },
  '762_m993_ap': { type:'penetrator', thresholdVelocity: 600,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },

  // 9mm
  '9mm_jhp':   { type:'expand', thresholdVelocity: 320,
    aboveTissueMul: 1.30, belowTissueMul: 0.75, aboveBleedMul: 1.20, belowBleedMul: 0.85, aboveShockMul: 1.10, belowShockMul: 0.90 },
  '9mm_jhp_p': { type:'expand', thresholdVelocity: 330,
    aboveTissueMul: 1.35, belowTissueMul: 0.75, aboveBleedMul: 1.25, belowBleedMul: 0.85, aboveShockMul: 1.15, belowShockMul: 0.90 },
  '9mm_rip':   { type:'frangible', thresholdVelocity: 350,
    aboveTissueMul: 1.40, belowTissueMul: 0.55, aboveBleedMul: 1.25, belowBleedMul: 0.70, aboveShockMul: 1.10, belowShockMul: 0.80 },
  '9mm_7n21':  { type:'pistol_penetrator', thresholdVelocity: 380,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },
  '9mm_7n31':  { type:'pistol_penetrator', thresholdVelocity: 480,
    aboveTissueMul: 1.05, belowTissueMul: 0.95, aboveBleedMul: 1.00, belowBleedMul: 0.95, aboveShockMul: 1.00, belowShockMul: 0.95 },

  // 12ga
  '12g_00buck': { type:'pellet', thresholdVelocity: 250,
    aboveTissueMul: 1.10, belowTissueMul: 0.80, aboveBleedMul: 1.20, belowBleedMul: 0.85, aboveShockMul: 1.05, belowShockMul: 0.85 },
  '12g_slug':   { type:'full_power', thresholdVelocity: 320,
    aboveTissueMul: 1.15, belowTissueMul: 0.95, aboveBleedMul: 1.10, belowBleedMul: 0.95, aboveShockMul: 1.20, belowShockMul: 1.00 },
  '12g_flechette': { type:'pellet', thresholdVelocity: 300,
    aboveTissueMul: 1.05, belowTissueMul: 0.80, aboveBleedMul: 1.15, belowBleedMul: 0.80, aboveShockMul: 1.00, belowShockMul: 0.85 },

  // ===== SIDE-AMMO-2A: 누락 탄약 terminalEffect 보강 (estimatedThreshold) =====
  '9mm_115gr': { type:'pistol_ball', thresholdVelocity:360, aboveTissueMul:1.0, belowTissueMul:0.88, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:0.98, belowShockMul:0.86, estimatedThreshold:true, debugNote:'estimated threshold (pistol ball)' },
  '9mm_124gr': { type:'pistol_ball', thresholdVelocity:360, aboveTissueMul:1.0, belowTissueMul:0.88, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:0.98, belowShockMul:0.86, estimatedThreshold:true, debugNote:'estimated threshold (pistol ball)' },
  '9mm_m882': { type:'pistol_ball', thresholdVelocity:360, aboveTissueMul:1.0, belowTissueMul:0.88, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:0.98, belowShockMul:0.86, estimatedThreshold:true, debugNote:'estimated threshold (pistol ball)' },
  '545_hp': { type:'expand', thresholdVelocity:540, aboveTissueMul:1.18, belowTissueMul:0.82, aboveBleedMul:1.2, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (5.45 rifle HP/SP; not pistol JHP threshold)' },
  '545_prs_gs': { type:'frangible', thresholdVelocity:600, aboveTissueMul:1.05, belowTissueMul:0.7, aboveBleedMul:1.05, belowBleedMul:0.7, aboveShockMul:0.95, belowShockMul:0.75, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '545_sp': { type:'expand', thresholdVelocity:540, aboveTissueMul:1.18, belowTissueMul:0.82, aboveBleedMul:1.2, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (5.45 rifle HP/SP; not pistol JHP threshold)' },
  '545_us_gs': { type:'subsonic_standard', thresholdVelocity:300, aboveTissueMul:1.02, belowTissueMul:0.92, aboveBleedMul:0.98, belowBleedMul:0.9, aboveShockMul:1.0, belowShockMul:0.92, estimatedThreshold:true, debugNote:'[0.39.4] standard subsonic (저속 소구경 FMJ, heavy 아님)' },
  '545_fmj': { type:'yaw', thresholdVelocity:660, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:1, belowBleedMul:0.85, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '545_7n40': { type:'fragment', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.82, aboveBleedMul:1.18, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '545_ppbs_gs': { type:'small_caliber_ap', thresholdVelocity:740, aboveTissueMul:0.9, belowTissueMul:0.78, aboveBleedMul:0.88, belowBleedMul:0.76, aboveShockMul:0.9, belowShockMul:0.78, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x39_hp': { type:'expand', thresholdVelocity:560, aboveTissueMul:1.18, belowTissueMul:0.82, aboveBleedMul:1.2, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (7.62x39 rifle HP/SP; not pistol JHP threshold)' },
  '762x39_sp': { type:'expand', thresholdVelocity:560, aboveTissueMul:1.18, belowTissueMul:0.82, aboveBleedMul:1.2, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (7.62x39 rifle HP/SP; not pistol JHP threshold)' },
  '762x39_us': { type:'subsonic_heavy', thresholdVelocity:300, aboveTissueMul:1.2, belowTissueMul:1.02, aboveBleedMul:1.08, belowBleedMul:0.95, aboveShockMul:1.18, belowShockMul:1.02, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x39_pp': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x39_bp': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '4.6_dm11_ap_sx': { type:'pdw_penetrator', thresholdVelocity:540, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.86, belowBleedMul:0.7, aboveShockMul:0.86, belowShockMul:0.72, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '4.6_action_sx': { type:'expand', thresholdVelocity:500, aboveTissueMul:1.05, belowTissueMul:0.8, aboveBleedMul:1.05, belowBleedMul:0.78, aboveShockMul:1.0, belowShockMul:0.8, estimatedThreshold:true, debugNote:'PDW expanding projectile override' },
  '4.6_fmj_sx': { type:'pdw_penetrator', thresholdVelocity:540, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.86, belowBleedMul:0.7, aboveShockMul:0.86, belowShockMul:0.72, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '4.6_jsp_sx': { type:'expand', thresholdVelocity:500, aboveTissueMul:1.05, belowTissueMul:0.8, aboveBleedMul:1.05, belowBleedMul:0.78, aboveShockMul:1.0, belowShockMul:0.8, estimatedThreshold:true, debugNote:'PDW expanding projectile override' },
  '4.6_subsonic_sx': { type:'pdw_penetrator', thresholdVelocity:290, aboveTissueMul:0.78, belowTissueMul:0.68, aboveBleedMul:0.76, belowBleedMul:0.64, aboveShockMul:0.76, belowShockMul:0.66, estimatedThreshold:true, debugNote:'small PDW subsonic override' },
  '5.7_ss190': { type:'pdw_penetrator', thresholdVelocity:540, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.86, belowBleedMul:0.7, aboveShockMul:0.86, belowShockMul:0.72, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '5.7_l191_tracer': { type:'pdw_penetrator', thresholdVelocity:540, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.86, belowBleedMul:0.7, aboveShockMul:0.86, belowShockMul:0.72, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '5.7_ss192_jhp': { type:'expand', thresholdVelocity:500, aboveTissueMul:1.05, belowTissueMul:0.8, aboveBleedMul:1.05, belowBleedMul:0.78, aboveShockMul:1.0, belowShockMul:0.8, estimatedThreshold:true, debugNote:'PDW expanding projectile override' },
  '5.7_sb193_subsonic': { type:'pdw_penetrator', thresholdVelocity:290, aboveTissueMul:0.78, belowTissueMul:0.68, aboveBleedMul:0.76, belowBleedMul:0.64, aboveShockMul:0.76, belowShockMul:0.66, estimatedThreshold:true, debugNote:'small PDW subsonic override' },
  '5.7_r37f': { type:'frangible', thresholdVelocity:600, aboveTissueMul:1.05, belowTissueMul:0.7, aboveBleedMul:1.05, belowBleedMul:0.7, aboveShockMul:0.95, belowShockMul:0.75, estimatedThreshold:true, debugNote:'estimated threshold (5.7 R37.F frangible)' },
  '9mm_luger_tracer': { type:'pistol_ball', thresholdVelocity:360, aboveTissueMul:1.0, belowTissueMul:0.88, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:0.98, belowShockMul:0.86, estimatedThreshold:true, debugNote:'estimated threshold (pistol ball)' },
  '9x21_sp10_7n29': { type:'pistol_penetrator', thresholdVelocity:440, aboveTissueMul:0.95, belowTissueMul:0.82, aboveBleedMul:0.92, belowBleedMul:0.8, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x21_sp11_7n28': { type:'pistol_ball', thresholdVelocity:360, aboveTissueMul:1.0, belowTissueMul:0.88, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:0.98, belowShockMul:0.86, estimatedThreshold:true, debugNote:'estimated threshold (pistol ball)' },
  '9x21_sp12_jhp': { type:'expand', thresholdVelocity:380, aboveTissueMul:1.18, belowTissueMul:0.82, aboveBleedMul:1.2, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x21_sp13_7bt3': { type:'pistol_penetrator', thresholdVelocity:440, aboveTissueMul:0.95, belowTissueMul:0.82, aboveBleedMul:0.92, belowBleedMul:0.8, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x21_7n42': { type:'pistol_penetrator', thresholdVelocity:440, aboveTissueMul:0.95, belowTissueMul:0.82, aboveBleedMul:0.92, belowBleedMul:0.8, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x21_7u4_subsonic': { type:'subsonic_heavy', thresholdVelocity:300, aboveTissueMul:1.2, belowTissueMul:1.02, aboveBleedMul:1.08, belowBleedMul:0.95, aboveShockMul:1.18, belowShockMul:1.02, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x39_sp5_7n8': { type:'subsonic_heavy', thresholdVelocity:300, aboveTissueMul:1.2, belowTissueMul:1.02, aboveBleedMul:1.08, belowBleedMul:0.95, aboveShockMul:1.18, belowShockMul:1.02, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x39_sp6_7n9': { type:'subsonic_ap', thresholdVelocity:330, aboveTissueMul:1.02, belowTissueMul:0.9, aboveBleedMul:0.98, belowBleedMul:0.86, aboveShockMul:1.02, belowShockMul:0.92, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x39_pab9': { type:'subsonic_ap', thresholdVelocity:330, aboveTissueMul:1.02, belowTissueMul:0.9, aboveBleedMul:0.98, belowBleedMul:0.86, aboveShockMul:1.02, belowShockMul:0.92, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '9x39_bp_7n12': { type:'subsonic_ap', thresholdVelocity:330, aboveTissueMul:1.02, belowTissueMul:0.9, aboveBleedMul:0.98, belowBleedMul:0.86, aboveShockMul:1.02, belowShockMul:0.92, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '300blk_vmax_110': { type:'fragment', thresholdVelocity:680, aboveTissueMul:1.15, belowTissueMul:0.82, aboveBleedMul:1.18, belowBleedMul:0.8, aboveShockMul:1.1, belowShockMul:0.85, estimatedThreshold:true, debugNote:'estimated threshold (.300 BLK 110gr V-MAX; supersonic varmint/fragmenting behavior)' },
  '300blk_fmj_147': { type:'yaw', thresholdVelocity:660, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:1, belowBleedMul:0.85, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '300blk_m62_tracer': { type:'yaw', thresholdVelocity:660, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:1, belowBleedMul:0.85, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '300blk_cbj': { type:'sabot_penetrator', thresholdVelocity:680, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.84, belowBleedMul:0.68, aboveShockMul:0.92, belowShockMul:0.75, estimatedThreshold:true, debugNote:'CBJ Tech 300 BLK: lower threshold than M948/M903 SLAP' },
  '300blk_ap_hardcore': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '300blk_220_subsonic': { type:'subsonic_heavy', thresholdVelocity:300, aboveTissueMul:1.2, belowTissueMul:1.02, aboveBleedMul:1.08, belowBleedMul:0.95, aboveShockMul:1.18, belowShockMul:1.02, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '556_m856_tracer': { type:'yaw', thresholdVelocity:660, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:1, belowBleedMul:0.85, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '556_m856a1_tracer': { type:'controlled_fragment', thresholdVelocity:670, aboveTissueMul:1.08, belowTissueMul:0.88, aboveBleedMul:1.08, belowBleedMul:0.85, aboveShockMul:1.05, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '545_7t3_tracer': { type:'yaw', thresholdVelocity:660, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:1, belowBleedMul:0.85, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '545_7bt4_aptracer': { type:'small_caliber_ap', thresholdVelocity:740, aboveTissueMul:0.9, belowTissueMul:0.78, aboveBleedMul:0.88, belowBleedMul:0.76, aboveShockMul:0.9, belowShockMul:0.78, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x39_t45m_tracer': { type:'yaw', thresholdVelocity:660, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:1, belowBleedMul:0.85, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x51_m62_tracer': { type:'full_power', thresholdVelocity:620, aboveTissueMul:1.1, belowTissueMul:0.9, aboveBleedMul:1.05, belowBleedMul:0.95, aboveShockMul:1.05, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x51_m948_slap': { type:'sabot_penetrator', thresholdVelocity:900, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.84, belowBleedMul:0.68, aboveShockMul:0.92, belowShockMul:0.75, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x54r_lps_gzh': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x54r_t46m': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x54r_7n1': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x54r_7bt1': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x54r_7n14_snb': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '762x54r_7n37_bs': { type:'high_power_ap', thresholdVelocity:770, aboveTissueMul:0.98, belowTissueMul:0.85, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '68x51_sig_fmj': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '68x51_sig_hybrid': { type:'barrier_blind', thresholdVelocity:620, aboveTissueMul:1.05, belowTissueMul:0.92, aboveBleedMul:1.05, belowBleedMul:0.9, aboveShockMul:1.02, belowShockMul:0.92, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '68x51_xm1186': { type:'controlled_fragment', thresholdVelocity:670, aboveTissueMul:1.08, belowTissueMul:0.88, aboveBleedMul:1.08, belowBleedMul:0.85, aboveShockMul:1.05, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '68x51_xm1188_rra': { type:'high_power_ball', thresholdVelocity:650, aboveTissueMul:1.0, belowTissueMul:0.9, aboveBleedMul:1.0, belowBleedMul:0.88, aboveShockMul:1.0, belowShockMul:0.9, estimatedThreshold:true, debugNote:'estimated reduced range/training ball' },
  '68x51_xm1184_ap': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '93x64_fmj': { type:'large_bore_ball', thresholdVelocity:730, aboveTissueMul:1.18, belowTissueMul:0.98, aboveBleedMul:1.12, belowBleedMul:0.92, aboveShockMul:1.18, belowShockMul:0.98, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '93x64_sp': { type:'expand', thresholdVelocity:620, aboveTissueMul:1.2, belowTissueMul:0.88, aboveBleedMul:1.18, belowBleedMul:0.86, aboveShockMul:1.15, belowShockMul:0.9, estimatedThreshold:true, debugNote:'estimated threshold (9.3x64 large-bore soft point)' },
  '93x64_9sn_7n33_ap': { type:'high_power_ap', thresholdVelocity:770, aboveTissueMul:0.98, belowTissueMul:0.85, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '338lm_fmj': { type:'large_bore_ball', thresholdVelocity:730, aboveTissueMul:1.18, belowTissueMul:0.98, aboveBleedMul:1.12, belowBleedMul:0.92, aboveShockMul:1.18, belowShockMul:0.98, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '338lm_ap': { type:'high_power_ap', thresholdVelocity:770, aboveTissueMul:0.98, belowTissueMul:0.85, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '338lm_tacx': { type:'expand', thresholdVelocity:620, aboveTissueMul:1.2, belowTissueMul:0.88, aboveBleedMul:1.18, belowBleedMul:0.86, aboveShockMul:1.15, belowShockMul:0.9, estimatedThreshold:true, debugNote:'estimated threshold (.338 LM TAC-X / Barnes-style expanding copper projectile)' },
  '338lm_ucw_subsonic': { type:'subsonic_heavy', thresholdVelocity:300, aboveTissueMul:1.2, belowTissueMul:1.02, aboveBleedMul:1.08, belowBleedMul:0.95, aboveShockMul:1.18, belowShockMul:1.02, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '338nm_fmj': { type:'large_bore_ball', thresholdVelocity:730, aboveTissueMul:1.18, belowTissueMul:0.98, aboveBleedMul:1.12, belowBleedMul:0.92, aboveShockMul:1.18, belowShockMul:0.98, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '338nm_ap': { type:'high_power_ap', thresholdVelocity:770, aboveTissueMul:0.98, belowTissueMul:0.85, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:1, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x55_ps12': { type:'subsonic_heavy', thresholdVelocity:300, aboveTissueMul:1.2, belowTissueMul:1.02, aboveBleedMul:1.08, belowBleedMul:0.95, aboveShockMul:1.18, belowShockMul:1.02, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x55_ps12a': { type:'large_bore_ball', thresholdVelocity:480, aboveTissueMul:1.15, belowTissueMul:0.92, aboveBleedMul:1.05, belowBleedMul:0.86, aboveShockMul:1.12, belowShockMul:0.9, estimatedThreshold:true, debugNote:'12.7x55 PS12A light large-bore override; not PS12 heavy subsonic' },
  '127x55_ps12b': { type:'subsonic_ap', thresholdVelocity:330, aboveTissueMul:1.02, belowTissueMul:0.9, aboveBleedMul:0.98, belowBleedMul:0.86, aboveShockMul:1.02, belowShockMul:0.92, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x99_m33_ball': { type:'anti_material_ball', thresholdVelocity:800, aboveTissueMul:1.35, belowTissueMul:1.1, aboveBleedMul:1.2, belowBleedMul:1, aboveShockMul:1.3, belowShockMul:1.1, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x99_m17_tracer': { type:'anti_material_ball', thresholdVelocity:800, aboveTissueMul:1.35, belowTissueMul:1.1, aboveBleedMul:1.2, belowBleedMul:1, aboveShockMul:1.3, belowShockMul:1.1, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x99_m8_api': { type:'api', thresholdVelocity:780, aboveTissueMul:1.08, belowTissueMul:0.92, aboveBleedMul:1, belowBleedMul:0.88, aboveShockMul:1.08, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x99_m20_apit': { type:'api', thresholdVelocity:780, aboveTissueMul:1.08, belowTissueMul:0.92, aboveBleedMul:1, belowBleedMul:0.88, aboveShockMul:1.08, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x99_mk211_heiap': { type:'heiap_primary', thresholdVelocity:830, aboveTissueMul:1.05, belowTissueMul:0.9, aboveBleedMul:1, belowBleedMul:0.86, aboveShockMul:1.08, belowShockMul:0.92, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x99_m903_slap': { type:'sabot_penetrator', thresholdVelocity:900, aboveTissueMul:0.88, belowTissueMul:0.72, aboveBleedMul:0.84, belowBleedMul:0.68, aboveShockMul:0.92, belowShockMul:0.75, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x108_b32_api': { type:'api', thresholdVelocity:780, aboveTissueMul:1.08, belowTissueMul:0.92, aboveBleedMul:1, belowBleedMul:0.88, aboveShockMul:1.08, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x108_bzt44_apit': { type:'api', thresholdVelocity:780, aboveTissueMul:1.08, belowTissueMul:0.92, aboveBleedMul:1, belowBleedMul:0.88, aboveShockMul:1.08, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '127x108_mdz_hei': { type:'hei_direct', thresholdVelocity:770, aboveTissueMul:1, belowTissueMul:0.85, aboveBleedMul:0.95, belowBleedMul:0.82, aboveShockMul:1.05, belowShockMul:0.9, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '30_06_m2_ball': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '30_06_m2_ap': { type:'rifle_ap', thresholdVelocity:710, aboveTissueMul:0.92, belowTissueMul:0.8, aboveBleedMul:0.9, belowBleedMul:0.78, aboveShockMul:0.92, belowShockMul:0.82, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '30_06_m25_tracer': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
  '30_06_sp': { type:'expand', thresholdVelocity:600, aboveTissueMul:1.18, belowTissueMul:0.85, aboveBleedMul:1.18, belowBleedMul:0.84, aboveShockMul:1.12, belowShockMul:0.88, estimatedThreshold:true, debugNote:'estimated threshold (.30-06 rifle soft point)' },
  '30_06_m72_match': { type:'high_power_ball', thresholdVelocity:730, aboveTissueMul:1.15, belowTissueMul:0.95, aboveBleedMul:1.1, belowBleedMul:0.9, aboveShockMul:1.12, belowShockMul:0.95, estimatedThreshold:true, debugNote:'estimated threshold (SIDE-AMMO-2A)' },
};
for (const id in AMMO_TERMINAL_EFFECT) {
  if (LEGACY_AMMO_PRESETS_MANUAL[id]) LEGACY_AMMO_PRESETS_MANUAL[id].terminalEffect = AMMO_TERMINAL_EFFECT[id];
}

// ===== SIDE-AMMO-2A: terminalProfile — 후속 2B-1AB 의료/관통 메타데이터 (현재 전투 계산 미연결) =====
const AMMO_TERMINAL_PROFILE = {
  '9mm_115gr': {"family":"pistol_ball","woundChannel":"normal","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":0.95,"exitWoundMul":1,"retainedProjectileChance":0.18,"futureMedicalHook":true},
  '9mm_124gr': {"family":"pistol_ball","woundChannel":"normal","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":0.95,"exitWoundMul":1,"retainedProjectileChance":0.18,"futureMedicalHook":true},
  '9mm_m882': {"family":"pistol_ball","woundChannel":"normal","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":0.95,"exitWoundMul":1,"retainedProjectileChance":0.18,"futureMedicalHook":true},
  '9mm_7n21': {"family":"pistol_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.85,"temporaryCavityMul":0.8,"boneBreakMul":0.85,"exitWoundMul":0.9,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '9mm_7n31': {"family":"pistol_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.85,"temporaryCavityMul":0.8,"boneBreakMul":0.85,"exitWoundMul":0.9,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '9mm_jhp': {"family":"pistol_ball","woundChannel":"expanding","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"none","tissueCrushMul":1.2,"temporaryCavityMul":0.95,"boneBreakMul":0.95,"exitWoundMul":1.1,"retainedProjectileChance":0.2,"futureMedicalHook":true},
  '9mm_jhp_p': {"family":"pistol_ball","woundChannel":"expanding","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"none","tissueCrushMul":1.2,"temporaryCavityMul":0.95,"boneBreakMul":0.95,"exitWoundMul":1.1,"retainedProjectileChance":0.2,"futureMedicalHook":true},
  '9mm_rip': {"family":"frangible","woundChannel":"fragmenting","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"high","armorAfterEffect":"none","tissueCrushMul":1.1,"temporaryCavityMul":1.1,"boneBreakMul":0.85,"exitWoundMul":0.8,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '556_223_fmj': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1,"temporaryCavityMul":1.05,"boneBreakMul":1,"exitWoundMul":1,"retainedProjectileChance":0.07,"futureMedicalHook":true},
  '556_m193': {"family":"fragmenting_rifle","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"high","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.25,"boneBreakMul":1,"exitWoundMul":1.05,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '556_m855': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1,"temporaryCavityMul":1.05,"boneBreakMul":1,"exitWoundMul":1,"retainedProjectileChance":0.07,"futureMedicalHook":true},
  '556_m855a1': {"family":"controlled_fragment","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"medium","armorAfterEffect":"medium","tissueCrushMul":1.05,"temporaryCavityMul":1.2,"boneBreakMul":1.05,"exitWoundMul":1.05,"retainedProjectileChance":0.05,"futureMedicalHook":true},
  '556_mk318_sost': {"family":"barrier_blind","woundChannel":"expanding","overpenetrationTendency":"medium","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"high","tissueCrushMul":1.1,"temporaryCavityMul":1.1,"boneBreakMul":1.05,"exitWoundMul":1.05,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '556_mk255_rrlp': {"family":"frangible","woundChannel":"fragmenting","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"high","armorAfterEffect":"none","tissueCrushMul":1.1,"temporaryCavityMul":1.1,"boneBreakMul":0.85,"exitWoundMul":0.8,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '556_m995_ap': {"family": "small_caliber_ap", "woundChannel": "narrow", "overpenetrationTendency": "high", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "high", "tissueCrushMul": 0.82, "temporaryCavityMul": 0.92, "boneBreakMul": 0.95, "exitWoundMul": 0.85, "retainedProjectileChance": 0.04, "futureMedicalHook": true},
  '556_varmageddon': {"family":"fragmenting_rifle","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"high","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.25,"boneBreakMul":1,"exitWoundMul":1.05,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '556_hp': {"family":"rifle_ball","woundChannel":"expanding","overpenetrationTendency":"low","yawTendency":"medium","fragmentationTendency":"medium","armorAfterEffect":"none","tissueCrushMul":1.25,"temporaryCavityMul":1.15,"boneBreakMul":1.05,"exitWoundMul":1.15,"retainedProjectileChance":0.12,"futureMedicalHook":true},
  '556_mk262_mod1': {"family":"fragmenting_rifle","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"high","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.25,"boneBreakMul":1,"exitWoundMul":1.05,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '545_hp': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.1, "temporaryCavityMul": 1.1, "boneBreakMul": 0.95, "exitWoundMul": 1.05, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '545_prs_gs': {"family":"frangible","woundChannel":"fragmenting","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"high","armorAfterEffect":"none","tissueCrushMul":1.1,"temporaryCavityMul":1.1,"boneBreakMul":0.85,"exitWoundMul":0.8,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '545_sp': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.1, "temporaryCavityMul": 1.1, "boneBreakMul": 0.95, "exitWoundMul": 1.05, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '545_us_gs': {"family":"subsonic_standard","woundChannel":"narrow","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":0.92,"temporaryCavityMul":0.6,"boneBreakMul":0.9,"exitWoundMul":0.9,"retainedProjectileChance":0.28,"futureMedicalHook":true},
  '545_fmj': {"family": "rifle_ball", "woundChannel": "normal", "overpenetrationTendency": "high", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "medium", "tissueCrushMul": 1.0, "temporaryCavityMul": 1.05, "boneBreakMul": 1.0, "exitWoundMul": 1.0, "retainedProjectileChance": 0.07, "futureMedicalHook": true},
  '545_ps_gs': {"family": "rifle_ball", "woundChannel": "normal", "overpenetrationTendency": "high", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "medium", "tissueCrushMul": 1.0, "temporaryCavityMul": 1.05, "boneBreakMul": 1.0, "exitWoundMul": 1.0, "retainedProjectileChance": 0.07, "futureMedicalHook": true},
  '545_pp_gs': {"family": "rifle_ball", "woundChannel": "normal", "overpenetrationTendency": "high", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "medium", "tissueCrushMul": 1.0, "temporaryCavityMul": 1.05, "boneBreakMul": 1.0, "exitWoundMul": 1.0, "retainedProjectileChance": 0.07, "futureMedicalHook": true},
  '545_bp_gs': {"family": "small_caliber_ap", "woundChannel": "narrow", "overpenetrationTendency": "high", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "high", "tissueCrushMul": 0.82, "temporaryCavityMul": 0.92, "boneBreakMul": 0.95, "exitWoundMul": 0.85, "retainedProjectileChance": 0.04, "futureMedicalHook": true},
  '545_bs_gs': {"family": "small_caliber_ap", "woundChannel": "narrow", "overpenetrationTendency": "high", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "high", "tissueCrushMul": 0.82, "temporaryCavityMul": 0.92, "boneBreakMul": 0.95, "exitWoundMul": 0.85, "retainedProjectileChance": 0.04, "futureMedicalHook": true},
  '545_7n40': {"family":"fragmenting_rifle","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"high","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.25,"boneBreakMul":1,"exitWoundMul":1.05,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '545_ppbs_gs': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.82,"temporaryCavityMul":0.92,"boneBreakMul":0.95,"exitWoundMul":0.85,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '762x39_hp': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.1, "temporaryCavityMul": 1.1, "boneBreakMul": 1.0, "exitWoundMul": 1.1, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '762x39_sp': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.1, "temporaryCavityMul": 1.1, "boneBreakMul": 1.0, "exitWoundMul": 1.1, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '762x39_us': {"family":"subsonic_heavy","woundChannel":"crushing","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.35,"temporaryCavityMul":0.8,"boneBreakMul":1.25,"exitWoundMul":1.05,"retainedProjectileChance":0.3,"futureMedicalHook":true},
  '762x39_ps': {"family": "rifle_ball", "woundChannel": "normal", "overpenetrationTendency": "high", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.0, "temporaryCavityMul": 1.05, "boneBreakMul": 1.0, "exitWoundMul": 1.0, "retainedProjectileChance": 0.07, "futureMedicalHook": true},
  '762x39_pp': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '762x39_bp': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '762_308_fmj': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.1,"boneBreakMul":1.1,"exitWoundMul":1.05,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '762_m80': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.1,"boneBreakMul":1.1,"exitWoundMul":1.05,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '762_m80a1': {"family":"controlled_fragment","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"medium","armorAfterEffect":"medium","tissueCrushMul":1.05,"temporaryCavityMul":1.2,"boneBreakMul":1.05,"exitWoundMul":1.05,"retainedProjectileChance":0.05,"futureMedicalHook":true},
  '762_m61_ap': {"family": "rifle_ap", "woundChannel": "narrow", "overpenetrationTendency": "high", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "high", "tissueCrushMul": 0.85, "temporaryCavityMul": 0.95, "boneBreakMul": 1.0, "exitWoundMul": 0.9, "retainedProjectileChance": 0.04, "futureMedicalHook": true},
  '762_m993_ap': {"family": "high_power_ap", "woundChannel": "narrow", "overpenetrationTendency": "high", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "high", "tissueCrushMul": 0.92, "temporaryCavityMul": 0.98, "boneBreakMul": 1.1, "exitWoundMul": 0.9, "retainedProjectileChance": 0.03, "futureMedicalHook": true},
  '12g_00buck': {"family":"pellet","woundChannel":"pellet","overpenetrationTendency":"low","yawTendency":"none","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1.1,"temporaryCavityMul":0.95,"boneBreakMul":0.95,"exitWoundMul":0.9,"retainedProjectileChance":0.12,"futureMedicalHook":true},
  '12g_slug': {"family":"slug","woundChannel":"crushing","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.45,"temporaryCavityMul":1.1,"boneBreakMul":1.4,"exitWoundMul":1.3,"retainedProjectileChance":0.08,"futureMedicalHook":true},
  '12g_flechette': {"family":"pellet","woundChannel":"pellet","overpenetrationTendency":"low","yawTendency":"none","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1.1,"temporaryCavityMul":0.95,"boneBreakMul":0.95,"exitWoundMul":0.9,"retainedProjectileChance":0.12,"futureMedicalHook":true},
  '4.6_dm11_ap_sx': {"family":"pdw_penetrator","woundChannel":"pin_hole","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.65,"temporaryCavityMul":0.7,"boneBreakMul":0.7,"exitWoundMul":0.7,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '4.6_action_sx': {"family": "pdw_expanding", "woundChannel": "expanding", "overpenetrationTendency": "low", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 0.92, "temporaryCavityMul": 0.92, "boneBreakMul": 0.78, "exitWoundMul": 0.98, "retainedProjectileChance": 0.18, "futureMedicalHook": true},
  '4.6_fmj_sx': {"family":"pdw_penetrator","woundChannel":"pin_hole","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.65,"temporaryCavityMul":0.7,"boneBreakMul":0.7,"exitWoundMul":0.7,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '4.6_jsp_sx': {"family": "pdw_expanding", "woundChannel": "expanding", "overpenetrationTendency": "low", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 0.92, "temporaryCavityMul": 0.92, "boneBreakMul": 0.78, "exitWoundMul": 0.98, "retainedProjectileChance": 0.18, "futureMedicalHook": true},
  '4.6_subsonic_sx': {"family": "pdw_subsonic", "woundChannel": "narrow", "overpenetrationTendency": "medium", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "low", "tissueCrushMul": 0.62, "temporaryCavityMul": 0.58, "boneBreakMul": 0.58, "exitWoundMul": 0.68, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '5.7_ss190': {"family":"pdw_penetrator","woundChannel":"pin_hole","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.65,"temporaryCavityMul":0.7,"boneBreakMul":0.7,"exitWoundMul":0.7,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '5.7_l191_tracer': {"family":"pdw_penetrator","woundChannel":"pin_hole","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.65,"temporaryCavityMul":0.7,"boneBreakMul":0.7,"exitWoundMul":0.7,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '5.7_ss192_jhp': {"family": "pdw_expanding", "woundChannel": "expanding", "overpenetrationTendency": "low", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 0.92, "temporaryCavityMul": 0.92, "boneBreakMul": 0.78, "exitWoundMul": 0.98, "retainedProjectileChance": 0.18, "futureMedicalHook": true},
  '5.7_sb193_subsonic': {"family": "pdw_subsonic", "woundChannel": "narrow", "overpenetrationTendency": "medium", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "low", "tissueCrushMul": 0.62, "temporaryCavityMul": 0.58, "boneBreakMul": 0.58, "exitWoundMul": 0.68, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '5.7_r37f': {"family": "pdw_frangible", "woundChannel": "fragmenting", "overpenetrationTendency": "low", "yawTendency": "low", "fragmentationTendency": "medium", "armorAfterEffect": "low", "tissueCrushMul": 0.85, "temporaryCavityMul": 0.95, "boneBreakMul": 0.65, "exitWoundMul": 0.78, "retainedProjectileChance": 0.06, "futureMedicalHook": true},
  '9mm_luger_tracer': {"family":"pistol_ball","woundChannel":"normal","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":0.95,"exitWoundMul":1,"retainedProjectileChance":0.18,"futureMedicalHook":true},
  '9x21_sp10_7n29': {"family":"pistol_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.85,"temporaryCavityMul":0.8,"boneBreakMul":0.85,"exitWoundMul":0.9,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '9x21_sp11_7n28': {"family":"pistol_ball","woundChannel":"normal","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"none","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":0.95,"exitWoundMul":1,"retainedProjectileChance":0.18,"futureMedicalHook":true},
  '9x21_sp12_jhp': {"family":"pistol_ball","woundChannel":"expanding","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"none","tissueCrushMul":1.2,"temporaryCavityMul":0.95,"boneBreakMul":0.95,"exitWoundMul":1.1,"retainedProjectileChance":0.2,"futureMedicalHook":true},
  '9x21_sp13_7bt3': {"family":"pistol_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.85,"temporaryCavityMul":0.8,"boneBreakMul":0.85,"exitWoundMul":0.9,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '9x21_7n42': {"family":"pistol_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":0.85,"temporaryCavityMul":0.8,"boneBreakMul":0.85,"exitWoundMul":0.9,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '9x21_7u4_subsonic': {"family":"subsonic_heavy","woundChannel":"crushing","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.35,"temporaryCavityMul":0.8,"boneBreakMul":1.25,"exitWoundMul":1.05,"retainedProjectileChance":0.3,"futureMedicalHook":true},
  '9x39_sp5_7n8': {"family":"subsonic_heavy","woundChannel":"crushing","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.35,"temporaryCavityMul":0.8,"boneBreakMul":1.25,"exitWoundMul":1.05,"retainedProjectileChance":0.3,"futureMedicalHook":true},
  '9x39_sp6_7n9': {"family":"subsonic_ap","woundChannel":"narrow","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":1.05,"exitWoundMul":0.95,"retainedProjectileChance":0.15,"futureMedicalHook":true},
  '9x39_pab9': {"family":"subsonic_ap","woundChannel":"narrow","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":1.05,"exitWoundMul":0.95,"retainedProjectileChance":0.15,"futureMedicalHook":true},
  '9x39_bp_7n12': {"family":"subsonic_ap","woundChannel":"narrow","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":1.05,"exitWoundMul":0.95,"retainedProjectileChance":0.15,"futureMedicalHook":true},
  '300blk_vmax_110': {"family":"fragmenting_rifle","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"high","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.25,"boneBreakMul":1,"exitWoundMul":1.05,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '300blk_fmj_147': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1,"temporaryCavityMul":1.05,"boneBreakMul":1,"exitWoundMul":1,"retainedProjectileChance":0.07,"futureMedicalHook":true},
  '300blk_m62_tracer': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1,"temporaryCavityMul":1.05,"boneBreakMul":1,"exitWoundMul":1,"retainedProjectileChance":0.07,"futureMedicalHook":true},
  '300blk_cbj': {"family": "cbj_sabot", "woundChannel": "pin_hole", "overpenetrationTendency": "very_high", "yawTendency": "none", "fragmentationTendency": "none", "armorAfterEffect": "high", "tissueCrushMul": 0.72, "temporaryCavityMul": 0.82, "boneBreakMul": 0.95, "exitWoundMul": 0.72, "retainedProjectileChance": 0.02, "futureMedicalHook": true},
  '300blk_ap_hardcore': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '300blk_220_subsonic': {"family":"subsonic_heavy","woundChannel":"crushing","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.35,"temporaryCavityMul":0.8,"boneBreakMul":1.25,"exitWoundMul":1.05,"retainedProjectileChance":0.3,"futureMedicalHook":true},
  '556_m856_tracer': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1,"temporaryCavityMul":1.05,"boneBreakMul":1,"exitWoundMul":1,"retainedProjectileChance":0.07,"futureMedicalHook":true},
  '556_m856a1_tracer': {"family":"controlled_fragment","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"medium","armorAfterEffect":"medium","tissueCrushMul":1.05,"temporaryCavityMul":1.2,"boneBreakMul":1.05,"exitWoundMul":1.05,"retainedProjectileChance":0.05,"futureMedicalHook":true},
  '545_7t3_tracer': {"family": "rifle_ball", "woundChannel": "normal", "overpenetrationTendency": "high", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "medium", "tissueCrushMul": 1.0, "temporaryCavityMul": 1.05, "boneBreakMul": 1.0, "exitWoundMul": 1.0, "retainedProjectileChance": 0.07, "futureMedicalHook": true},
  '545_7bt4_aptracer': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.82,"temporaryCavityMul":0.92,"boneBreakMul":0.95,"exitWoundMul":0.85,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '762x39_t45m_tracer': {"family": "rifle_ball", "woundChannel": "normal", "overpenetrationTendency": "high", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.0, "temporaryCavityMul": 1.05, "boneBreakMul": 1.0, "exitWoundMul": 1.0, "retainedProjectileChance": 0.07, "futureMedicalHook": true},
  '762x51_m62_tracer': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.05,"temporaryCavityMul":1.1,"boneBreakMul":1.1,"exitWoundMul":1.05,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '762x51_m948_slap': {"family":"sabot","woundChannel":"pin_hole","overpenetrationTendency":"very_high","yawTendency":"none","fragmentationTendency":"none","armorAfterEffect":"very_high","tissueCrushMul":0.75,"temporaryCavityMul":0.9,"boneBreakMul":1.05,"exitWoundMul":0.75,"retainedProjectileChance":0.01,"futureMedicalHook":true},
  '762x54r_lps_gzh': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '762x54r_t46m': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '762x54r_7n1': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '762x54r_7bt1': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '762x54r_7n14_snb': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '762x54r_7n37_bs': {"family":"high_power_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.95,"temporaryCavityMul":1,"boneBreakMul":1.3,"exitWoundMul":0.95,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '68x51_sig_fmj': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '68x51_sig_hybrid': {"family":"barrier_blind","woundChannel":"expanding","overpenetrationTendency":"medium","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"high","tissueCrushMul":1.1,"temporaryCavityMul":1.1,"boneBreakMul":1.05,"exitWoundMul":1.05,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '68x51_xm1186': {"family":"controlled_fragment","woundChannel":"fragmenting","overpenetrationTendency":"medium","yawTendency":"high","fragmentationTendency":"medium","armorAfterEffect":"medium","tissueCrushMul":1.05,"temporaryCavityMul":1.2,"boneBreakMul":1.05,"exitWoundMul":1.05,"retainedProjectileChance":0.05,"futureMedicalHook":true},
  '68x51_xm1188_rra': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":0.98,"temporaryCavityMul":1.0,"boneBreakMul":1.0,"exitWoundMul":0.95,"retainedProjectileChance":0.07,"futureMedicalHook":true},
  '68x51_xm1184_ap': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '93x64_fmj': {"family":"large_bore_ball","woundChannel":"wide","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1.35,"temporaryCavityMul":1.25,"boneBreakMul":1.35,"exitWoundMul":1.25,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '93x64_sp': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.18, "temporaryCavityMul": 1.15, "boneBreakMul": 1.05, "exitWoundMul": 1.15, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '93x64_9sn_7n33_ap': {"family":"high_power_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.95,"temporaryCavityMul":1,"boneBreakMul":1.3,"exitWoundMul":0.95,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '338lm_fmj': {"family":"large_bore_ball","woundChannel":"wide","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1.35,"temporaryCavityMul":1.25,"boneBreakMul":1.35,"exitWoundMul":1.25,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '338lm_ap': {"family":"high_power_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.95,"temporaryCavityMul":1,"boneBreakMul":1.3,"exitWoundMul":0.95,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '338lm_tacx': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.18, "temporaryCavityMul": 1.15, "boneBreakMul": 1.05, "exitWoundMul": 1.15, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '338lm_ucw_subsonic': {"family":"subsonic_heavy","woundChannel":"crushing","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.35,"temporaryCavityMul":0.8,"boneBreakMul":1.25,"exitWoundMul":1.05,"retainedProjectileChance":0.3,"futureMedicalHook":true},
  '338nm_fmj': {"family":"large_bore_ball","woundChannel":"wide","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1.35,"temporaryCavityMul":1.25,"boneBreakMul":1.35,"exitWoundMul":1.25,"retainedProjectileChance":0.1,"futureMedicalHook":true},
  '338nm_ap': {"family":"high_power_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.95,"temporaryCavityMul":1,"boneBreakMul":1.3,"exitWoundMul":0.95,"retainedProjectileChance":0.03,"futureMedicalHook":true},
  '127x55_ps12': {"family":"subsonic_heavy","woundChannel":"crushing","overpenetrationTendency":"low","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"low","tissueCrushMul":1.35,"temporaryCavityMul":0.8,"boneBreakMul":1.25,"exitWoundMul":1.05,"retainedProjectileChance":0.3,"futureMedicalHook":true},
  '127x55_ps12a': {"family": "large_bore_light", "woundChannel": "wide", "overpenetrationTendency": "medium", "yawTendency": "low", "fragmentationTendency": "none", "armorAfterEffect": "low", "tissueCrushMul": 1.22, "temporaryCavityMul": 1.02, "boneBreakMul": 1.18, "exitWoundMul": 1.12, "retainedProjectileChance": 0.22, "futureMedicalHook": true},
  '127x55_ps12b': {"family":"subsonic_ap","woundChannel":"narrow","overpenetrationTendency":"medium","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1,"temporaryCavityMul":0.85,"boneBreakMul":1.05,"exitWoundMul":0.95,"retainedProjectileChance":0.15,"futureMedicalHook":true},
  '127x99_m33_ball': {"family":"anti_material_ball","woundChannel":"crushing","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1.7,"temporaryCavityMul":1.55,"boneBreakMul":1.8,"exitWoundMul":1.6,"retainedProjectileChance":0.02,"futureMedicalHook":true},
  '127x99_m17_tracer': {"family":"anti_material_ball","woundChannel":"crushing","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"medium","tissueCrushMul":1.7,"temporaryCavityMul":1.55,"boneBreakMul":1.8,"exitWoundMul":1.6,"retainedProjectileChance":0.02,"futureMedicalHook":true},
  '127x99_m8_api': {"family":"anti_material_ap","woundChannel":"normal","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"very_high","tissueCrushMul":1.2,"temporaryCavityMul":1.15,"boneBreakMul":1.5,"exitWoundMul":1.25,"retainedProjectileChance":0.02,"futureMedicalHook":true,"notes":["API flash/scorch — no fire spread"]},
  '127x99_m20_apit': {"family":"anti_material_ap","woundChannel":"normal","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"very_high","tissueCrushMul":1.2,"temporaryCavityMul":1.15,"boneBreakMul":1.5,"exitWoundMul":1.25,"retainedProjectileChance":0.02,"futureMedicalHook":true,"notes":["API flash/scorch — no fire spread"]},
  '127x99_mk211_heiap': {"family":"heiap","woundChannel":"fragmenting","overpenetrationTendency":"conditional","yawTendency":"none","fragmentationTendency":"special_micro_fragment","armorAfterEffect":"very_high","tissueCrushMul":1,"temporaryCavityMul":1,"boneBreakMul":1.2,"exitWoundMul":1,"retainedProjectileChance":0.02,"futureMedicalHook":true,"specialEffectSource":"microExplosiveEffect"},
  '127x99_m903_slap': {"family":"sabot","woundChannel":"pin_hole","overpenetrationTendency":"very_high","yawTendency":"none","fragmentationTendency":"none","armorAfterEffect":"very_high","tissueCrushMul":0.75,"temporaryCavityMul":0.9,"boneBreakMul":1.05,"exitWoundMul":0.75,"retainedProjectileChance":0.01,"futureMedicalHook":true},
  '127x108_b32_api': {"family":"anti_material_ap","woundChannel":"normal","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"very_high","tissueCrushMul":1.2,"temporaryCavityMul":1.15,"boneBreakMul":1.5,"exitWoundMul":1.25,"retainedProjectileChance":0.02,"futureMedicalHook":true,"notes":["API flash/scorch — no fire spread"]},
  '127x108_bzt44_apit': {"family":"anti_material_ap","woundChannel":"normal","overpenetrationTendency":"very_high","yawTendency":"low","fragmentationTendency":"low","armorAfterEffect":"very_high","tissueCrushMul":1.2,"temporaryCavityMul":1.15,"boneBreakMul":1.5,"exitWoundMul":1.25,"retainedProjectileChance":0.02,"futureMedicalHook":true,"notes":["API flash/scorch — no fire spread"]},
  '127x108_mdz_hei': {"family":"hei","woundChannel":"fragmenting","overpenetrationTendency":"conditional","yawTendency":"none","fragmentationTendency":"special_micro_fragment","armorAfterEffect":"low","tissueCrushMul":1,"temporaryCavityMul":1,"boneBreakMul":1.1,"exitWoundMul":1,"retainedProjectileChance":0.05,"futureMedicalHook":true,"specialEffectSource":"microExplosiveEffect"},
  '30_06_m2_ball': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '30_06_m2_ap': {"family":"rifle_ap","woundChannel":"narrow","overpenetrationTendency":"high","yawTendency":"low","fragmentationTendency":"none","armorAfterEffect":"high","tissueCrushMul":0.85,"temporaryCavityMul":0.95,"boneBreakMul":1,"exitWoundMul":0.9,"retainedProjectileChance":0.04,"futureMedicalHook":true},
  '30_06_m25_tracer': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
  '30_06_sp': {"family": "rifle_expanding", "woundChannel": "expanding", "overpenetrationTendency": "medium", "yawTendency": "medium", "fragmentationTendency": "low", "armorAfterEffect": "low", "tissueCrushMul": 1.18, "temporaryCavityMul": 1.15, "boneBreakMul": 1.05, "exitWoundMul": 1.15, "retainedProjectileChance": 0.12, "futureMedicalHook": true},
  '30_06_m72_match': {"family":"rifle_ball","woundChannel":"normal","overpenetrationTendency":"high","yawTendency":"medium","fragmentationTendency":"low","armorAfterEffect":"low","tissueCrushMul":1.1,"temporaryCavityMul":1.15,"boneBreakMul":1.15,"exitWoundMul":1.1,"retainedProjectileChance":0.06,"futureMedicalHook":true},
};
// terminalEffect를 live preset에도 보장 (registry sync 이후 재호출됨)
function applyAmmoTerminalEffectsToPresets() {
  for (const id in AMMO_TERMINAL_EFFECT) {
    if (typeof LEGACY_AMMO_PRESETS_MANUAL !== 'undefined' && LEGACY_AMMO_PRESETS_MANUAL[id]) LEGACY_AMMO_PRESETS_MANUAL[id].terminalEffect = AMMO_TERMINAL_EFFECT[id];
    if (typeof AMMO_PRESETS !== 'undefined' && AMMO_PRESETS[id]) AMMO_PRESETS[id].terminalEffect = AMMO_TERMINAL_EFFECT[id];
  }
}

// =============================================================
// 2A-4.8: AMMO_PRESETS — 로드 중 임시로 manual을 채워 참조 안전 확보.
//   실제 source(registry/manual)는 buildLegacyAmmoPresetsFromRegistry 정의 후 하단 switch에서 확정.
//   const 참조는 유지하고 내용만 교체(in-place)하여 기존 코드의 AMMO_PRESETS[id] 접근을 보존.
// =============================================================
const AMMO_PRESETS = {};
Object.assign(AMMO_PRESETS, LEGACY_AMMO_PRESETS_MANUAL);

// fallback — energyClass 미지정 탄은 caliber로 추정
//   미래 탄종은 ammo.energyClass를 직접 넣어 대응.
//   확장 예시:
//     5.7×28mm / 4.6×30mm → 'pdw'
//     6.8×51mm / .277 Fury → 'high_power_rifle'
//     6.8 SPC               → 'intermediate_rifle'
function getCaliberEnergyClass(ammo) {
  if (!ammo) return 'small_rifle';
  if (ammo.energyClass) return ammo.energyClass;
  const cal = (ammo.caliber || '').toLowerCase();
  if (cal.includes('9') || cal.includes('parabellum')) return 'pistol';
  if (cal.includes('5.56') || cal.includes('5.45')) return 'small_rifle';
  if (cal.includes('7.62×39') || cal.includes('7.62x39')) return 'intermediate_rifle';
  if (cal.includes('7.62×51') || cal.includes('7.62x51') || cal.includes('.308')) return 'full_power_rifle';
  return 'small_rifle';
}

// =============================================================
// 장벽 감쇠 보정 계수 — energyClass / barrierBehavior 기반
// =============================================================
//   낮을수록 감쇠 적음 (탄이 잘 유지), 높을수록 감쇠 큼.
const ENERGY_CLASS_BARRIER_LOSS_MUL = {
  pistol:             1.25,
  pistol_ap:          1.05,
  subsonic:           1.30,
  small_rifle:        1.00,
  intermediate_rifle: 0.92,
  full_power_rifle:   0.80,
  shotgun:            1.40,   // 산탄: 펠릿 단위 - 장벽 손실 큼
  // 미래 확장용
  pdw:                1.10,
  high_power_rifle:   0.72,
};

const BEHAVIOR_BARRIER_LOSS_MUL = {
  penetrator:         0.80,
  penetrator_unstable:0.90,
  pistol_penetrator:  0.95,
  barrier_blind:      0.80,
  full_power:         0.90,
  normal_heavy:       0.95,
  normal:             1.00,
  precision:          1.00,
  deform:             1.35,
  fragment:           1.55,
  frangible:          2.00,
  subsonic:           1.30,
  buckshot:           1.60,   // 산탄 펠릿: 장벽 빠르게 무너짐
  // 미래 확장용
  small_fast_penetrator: 0.90,
  pdw_penetrator:        0.90,
  high_power_penetrator: 0.72,
};

// 대구경 + AP 조합 보정 — penetrator 계열일 때만
const PENETRATOR_BEHAVIORS = new Set([
  'penetrator', 'penetrator_unstable', 'pistol_penetrator', 'barrier_blind',
  'small_fast_penetrator', 'pdw_penetrator', 'high_power_penetrator',
]);

function getSpecialComboLossMul(energyClass, barrierBehavior) {
  if (!PENETRATOR_BEHAVIORS.has(barrierBehavior)) return 1.00;
  if (energyClass === 'full_power_rifle')   return 0.85;
  if (energyClass === 'intermediate_rifle') return 0.92;
  if (energyClass === 'high_power_rifle')   return 0.80;   // 미래용
  return 1.00;
}

// =============================================================
// AMMO_LORE — 탄약별 고증/배경 설명 (탄약 정보 표 펼침용)
//   가급적 실제 사양/도입 시기/특징 기반으로 작성
// =============================================================
const AMMO_LORE = {
  // ===== 9×19mm =====
  '9mm_115gr':
    'Luger / Parabellum 9×19mm의 대표적 상용 사양. 115gr FMJ 탄두는 약 1180 ft/s 수준의 속도로 발사되며, 표준 권총탄으로 가장 널리 보급된 라운드. 저렴하고 구하기 쉬워 훈련/사격 연습에 흔히 사용된다. 비방호 표적에는 충분한 효과를 내지만 현대 방탄복 앞에서는 제한적.',
  '9mm_124gr':
    '9×19mm 124gr FMJ. 115gr보다 무겁고 침투력/관통력이 약간 더 좋으며, 군/경찰 표준에서 흔히 채택된 사양. NATO 9mm 표준탄(M882)과 거의 동일한 무게대로, 권총·MP5 등 SMG 모두에서 안정적인 성능을 보인다.',
  '9mm_m882':
    'NATO 표준 9×19mm 군용탄. 124gr FMJ에 부드러운 강철심을 포함해 일부 차폐물 관통이 가능하며, 베레타 M9 등 NATO 권총·MP5에 표준 보급. 일반 FMJ보다 약간 더 강하지만 본격적인 AP는 아니다.',
  '9mm_7n21':
    '러시아 7N21 — MP-443 그라치 권총용 +P급 +AP 탄. 강철 관통자를 가진 9×19mm로 약 460 m/s 고속을 내며, IIIA급 소프트 아머와 일부 RHA 강판도 관통. 권총탄 중에서는 매우 높은 관통력을 가진다.',
  '9mm_7n31':
    '러시아 7N31 — 7N21을 더 가속한 GSh-18/PYa용 차폐물 관통탄. 약 600 m/s에 달하는 9×19mm로, 이 구경의 한계에 가까운 관통력을 보여준다. 동시에 반동도 매우 큰 편.',
  '9mm_jhp':
    '9×19 JHP (Jacketed Hollow Point) — 자켓홀로포인트 확장탄. 비방호 표적에 부딪히면 탄두 머리가 꽃잎 모양으로 확장되며 일시 정지력과 조직 손상을 극대화한다. 자위·법집행 시장의 사실상 표준이지만 방탄재 앞에서는 확장으로 관통력이 무너진다.',
  '9mm_jhp_p':
    '9×19 +P JHP — 표준 9mm보다 챔버 압력을 높여 더 큰 운동에너지를 내는 고압 사양 JHP. 비방호 정지력이 추가로 향상되지만 반동 증가와 무기 마모가 단점. 일부 권총·SMG에서만 안정적으로 운용 가능.',
  '9mm_rip':
    '9×19 R.I.P. (Radically Invasive Projectile) — G2 Research가 도입한 다중 파편 분리 탄두. 비방호 표적에 닿으면 8개의 머리 파편이 방사상으로 분리되며 개별 상처관(wound channel)을 만들어 극단적인 저지력을 낸다. 그러나 방탄재·차폐물 앞에서는 파편화가 즉시 일어나 관통은 극히 비효율적이다.',

  // ===== 5.45×39mm =====
  '545_hp':
    '5.45×39 Hollow Point 상용 사양. 비방호 표적에 대한 확장/파편화로 정지력은 좋지만, 방탄재 앞에서는 변형으로 인해 관통력이 크게 떨어진다. 사냥/민수 시장 위주.',
  '545_prs_gs':
    '러시아 PRS gs — 폴리머 충진을 둔 저도(reduced-ricochet) 훈련탄. 도탄 위험이 낮아 실내 사격장/근접 훈련에 사용된다. 관통력과 종말효과 모두 매우 약하다.',
  '545_sp':
    '5.45×39 Soft Point. 비방호 표적에 대한 정지력/피해는 우수하지만, 방탄재 앞에서는 탄두 머리가 변형되며 관통력을 크게 잃는다. 민수/사냥 영역에서 주로 사용.',
  '545_us_gs':
    '7U1 US gs — 소련/러시아의 5.45×39 아음속탄. AKS-74UB(억제기)에 맞춰 개발되어 음속 미만의 약 300 m/s대 속도. 저소음·저반동이지만 사거리/관통력이 크게 줄어든다.',
  '545_fmj':
    '5.45×39 일반 FMJ — 민수용 표준 풀메탈자켓. 큰 특징 없는 범용 사양으로, 군용 PS gs와 비교하면 침투/공기역학에서 약간 떨어진다.',
  '545_ps_gs':
    '7N6 PS gs — 1974년 도입된 5.45×39 군용 표준탄. 53gr 강심탄두로 고속, 저반동, 우수한 침투를 갖췄으며 AK-74의 표준 보급탄으로 수십 년간 사용됐다. 탄두 내 공동(air gap)으로 뒤틀림 효과를 가진다.',
  '545_pp_gs':
    '7N10 PP gs — 1992년 도입된 강화 침투형 5.45×39. 강철 관통자 무게 증가 및 열처리 강화로 PS gs 대비 더 높은 관통력. 소비에트 후기 형태의 방탄재 대응을 목적으로 개발됐다.',
  '545_bp_gs':
    '7N22 BP gs — 1998년 도입된 5.45×39 고관통탄. 더 단단한 합금강 관통자를 사용해 6mm 강판/2급 방탄복 등을 100m에서 관통할 수 있게 설계.',
  '545_bs_gs':
    '7N24 BS gs — 텅스텐 카바이드 관통자를 사용한 상위 AP. 7N22보다 한 단계 높은 침투를 자랑하며, 군 정예부대 보급용. 탄두 비용과 무게 때문에 일반 보급에는 들어가지 않는다.',
  '545_7n40':
    '7N40 — 2010년대 도입된 현대식 5.45×39. 고강도 강심에 공기역학을 정돈한 형태로, 7N22 수준의 관통력과 함께 정확도/저반동을 강화했다. AK-12 등 신형 소총 표준탄으로 채택.',
  '545_ppbs_gs':
    '7N39 PPBS — 5.45×39 최상위 AP. 텅스텐 카바이드 강심을 강화해 고급 방탄판도 관통 가능하지만, 탄두 무게가 가벼워 종말 피해는 가장 낮다. 특수전용 스나이퍼/AK-12 보급에서 제한적 운용.',

  // ===== 5.56×45mm =====
  '556_223_fmj':
    '.223 Remington 55gr FMJ — 5.56×45mm의 민수용 원형. 군용 5.56보다 챔버 압력이 약간 낮고 강철심도 없는 단순 FMJ. 사격장/사냥(소형 동물)용. 종말효과는 yaw에 의존.',
  '556_m193':
    'M193 — 1960년대 베트남전기 미군이 채택한 초기 5.56 표준탄. 55gr 일반 납심 FMJ로, 고속(약 990 m/s)에서 yaw에 의한 파편화로 비방호 표적에 강한 효과. 방탄재 관통은 약하다.',
  '556_m855':
    'M855 / SS109 — 1980년대 NATO 표준 채택된 강심 부착 62gr FMJ. 강철 침투자 덕분에 M193 대비 강판/방탄재 관통이 크게 향상됐지만, 100m 이내 yaw 효과는 일관되지 않다는 비판이 있다.',
  '556_m855a1':
    'M855A1 EPR — 2010년 미 육군이 도입한 환경친화적 강화탄. 무연 구리/강철 합성 탄두로 M855 대비 거리·표적별 종말효과가 일관적이고, 강판 관통도 향상됐다. 압력이 약간 높아 무기 마모가 크다.',
  '556_mk318_sost':
    'Mk318 Mod 0 SOST (Special Operations Science and Technology) — 미 해병 SOCOM이 채택한 62gr OTM. "barrier blind" 특성을 목표로 설계되어 자동차 유리/얇은 강판을 통과해도 종말효과가 유지된다. 정밀도와 장벽 너머 안정성 모두 뛰어남.',
  '556_mk255_rrlp':
    'Mk255 RRLP (Reduced Ricochet Limited Penetration) — 5.56×45 도탄 저감 훈련/특수 환경탄. 압축 동/주석 분말 탄두로, 단단한 표면에 닿으면 즉시 분쇄돼 도탄 위험이 거의 없다. 대신 방탄재/장벽 관통은 사실상 0.',
  '556_m995_ap':
    'M995 — 5.56×45 텅스텐 카바이드 AP. 약 52gr 텅스텐 코어로 강판/2~3급 방탄판도 가까운 거리에서 관통 가능. 대단히 비싸고 종말 피해는 낮다(관통 우선). M16/M4의 대장갑 옵션.',
  '556_varmageddon':
    'Nosler Varmageddon — 민수용 사냥(소형 해수) 전용 폴리머 팁 탄. 의도적으로 매우 빠르고 극단적으로 파편화하도록 설계되어 비방호 소형 표적엔 압도적인 효과. 사람·방탄재 대상으로는 거의 효과 없음.',
  '556_hp':
    '5.56 Hollow Point 상용 사양. 비방호 종말효과는 우수하지만 강철심이 없어 방탄판/장벽 관통은 미미하다. 자위/사냥 시장.',
  '556_mk262_mod1':
    'Mk262 Mod 1 — 미군 SOCOM의 5.56 정밀 사격용 77gr OTM. SAM-R/Mk12 SPR과 함께 운용되며, 600m까지 유효한 정확도와 일관된 fragmentation을 자랑한다. 방탄판 관통은 제한적.',

  // ===== 7.62×39mm =====
  '762x39_hp':
    '7.62×39 Hollow Point 상용 사양. 비방호 표적에 대한 정지력은 큰 편이지만 변형/단편화로 인해 방탄재 관통이 매우 낮다.',
  '762x39_sp':
    '7.62×39 Soft Point. 사냥용 사양으로 비방호 표적엔 강력하지만 강심이 없어 방탄재/철판 관통은 떨어진다.',
  '762x39_us':
    '7.62×39 아음속(US) — 약 300 m/s대 저속탄. AKM/AK-103 + 억제기 조합에서 저소음 운용에 사용. 사거리·관통력 모두 큰 폭으로 줄어든다.',
  '762x39_ps':
    '7.62×39 PS — 1949년 도입된 AK-47/AKM 표준탄. 122gr FMJ에 작은 강철심을 가지며, 비방호 종말효과는 묵직하지만 강판/방탄판 관통은 평범하다. 동구권의 가장 흔한 라운드.',
  '762x39_pp':
    '7.62×39 PP — 침투 강화형 강심탄. 더 단단한 합금강심으로 PS 대비 강판 관통이 향상됐으며, 1990년대 후반 동구권 일부 정예 부대 운용.',
  '762x39_bp':
    '7.62×39 BP (7N27) — 7.62×39의 상위 강심 AP. 더 단단한 강심으로 동급 구경에서 가장 높은 관통력. 대신 pure AP 대비 종말 피해는 더 좋은 편.',

  // ===== 7.62×51mm =====
  '762_308_fmj':
    '.308 Winchester 130gr FMJ — 사냥/민수 시장의 7.62×51 표준 사양. 일반 FMJ로 종말효과는 yaw에 의존, 방탄재 앞에서는 더 무거운 군용탄에 비해 떨어진다.',
  '762_m80':
    'M80 — NATO 7.62×51 표준탄. 147gr FMJ에 납심 + 일부 강철심으로 큰 운동에너지와 강한 제압을 자랑. M14/M240/SCAR-H 등 풀파워 무기의 표준 보급.',
  '762_m80a1':
    'M80A1 EPR — 7.62×51의 환경친화 강화 사양. M855A1과 같은 사상으로 강철·구리 합성 탄두를 적용해 M80 대비 거리에 관계없이 일관된 침투/종말효과를 보인다.',
  '762_m61_ap':
    'M61 — 1950년대 도입된 7.62×51 AP. 단단한 강심으로 군용 차량/얇은 장갑에 대한 침투력 확보. 후속 M993 도입 후 점차 대체됐다.',
  '762_m993_ap':
    'M993 — 7.62×51 텅스텐 카바이드 AP. 미 육군의 표준 7.62 AP로, 가까운 거리에서 두꺼운 강판/3급 방탄판도 관통 가능. 종말 피해는 낮고 단가가 매우 비싸다.',

  // ===== 12 Gauge =====
  '12g_00buck':
    '12ga 00 Buckshot — 9개의 8.4mm 납 펠릿을 발사하는 표준 산탄. 근거리(0~10m)에서 비방호 표적에 압도적인 피해를 주지만, 방탄판 정면에는 펠릿별로 막히는 경우가 많다. 거리가 늘어날수록 펠릿 패턴이 퍼져 명중 펠릿 수가 급격히 줄어든다.',
  '12g_slug':
    '12ga Rifled Slug — 단일 28g(약 1온스) 납탄. 펠릿이 아닌 단일 대구경 투사체로 발사되어 충격력/저지력/둔상 모두 극단적으로 높다. 방탄판에 막혀도 큰 후방둔상을 전달하며, drywall/wood 같은 약한 장벽은 무리 없이 관통한다.',
  '12g_flechette':
    '12ga Flechette — 화살형(파이어트) 8~12개를 발사하는 특수 산탄. 펠릿당 운동에너지를 좁은 단면에 집중해 buckshot보다 관통성이 좋지만, 펠릿당 피해/저지력은 낮다. 소프트아머와 비방호 부위의 틈을 노리기 좋다.',
};

// ---- Skill presets (팀 단위 숙련도) ----
//   reaction  — 표적 발견 후 반응성 (현재 first-shot delay에 약하게 반영)
//   aimSpeed  — aimTimer가 쌓이는 속도 (조준 안정 속도)
//   accuracy  — 최종 명중률 곱 보정
//   weakspot  — 조준 안정 시 중심부/머리 피격 보정 강도
const SKILL_PRESETS = {
  recruit: { id:'recruit', name:'신병', shortName:'신병',
    desc:'느린 반응 / 낮은 조준 안정 / 낮은 명중률',
    reaction: 0.85, aimSpeed: 0.75, accuracy: 0.85, weakspot: 0.85 },
  regular: { id:'regular', name:'정규병', shortName:'정규',
    desc:'표준 반응 / 표준 명중률 (기준값)',
    reaction: 1.00, aimSpeed: 1.00, accuracy: 1.00, weakspot: 1.00 },
  veteran: { id:'veteran', name:'숙련병', shortName:'숙련',
    desc:'빠른 조준 / 높은 명중률 / 중심부 타격 우수',
    reaction: 1.10, aimSpeed: 1.22, accuracy: 1.08, weakspot: 1.15 },
  elite:   { id:'elite', name:'정예', shortName:'정예',
    desc:'매우 빠른 조준 / 높은 명중률 / 약점 타격 우수',
    reaction: 1.20, aimSpeed: 1.45, accuracy: 1.15, weakspot: 1.30 },
};
function getSkillPreset(id) {
  return SKILL_PRESETS[id] || SKILL_PRESETS.regular;
}
// === CARDIAC-1R §6: 숙련도 기반 침착성 프로필 ===
//   중요 — 침착성은 출혈/저산소/혈압을 직접 바꾸지 않는다. panic, adrenaline 폭주, 호흡 discipline,
//   심박 spike, ECG artifact, 불안정 리듬 risk에만 "간접" 보정한다. elite도 총에 맞으면 출혈은 동일.
const COMPOSURE_PROFILES = {
  recruit: { composure:0.35, panicResistance:0.42, adrenalineControl:0.40, painTolerance:0.45, breathingDiscipline:0.40, postCombatRecovery:0.45, startleResistance:0.38 },
  regular: { composure:0.60, panicResistance:0.62, adrenalineControl:0.60, painTolerance:0.60, breathingDiscipline:0.60, postCombatRecovery:0.60, startleResistance:0.60 },
  veteran: { composure:0.80, panicResistance:0.82, adrenalineControl:0.78, painTolerance:0.76, breathingDiscipline:0.80, postCombatRecovery:0.80, startleResistance:0.80 },
  elite:   { composure:0.93, panicResistance:0.93, adrenalineControl:0.90, painTolerance:0.86, breathingDiscipline:0.92, postCombatRecovery:0.90, startleResistance:0.92 },
};
function getUnitComposureProfile(unit) {
  const id = (unit && unit.skill && (unit.skill.presetId || unit.skill.id)) || 'regular';
  return COMPOSURE_PROFILES[id] || COMPOSURE_PROFILES.regular;
}
const LEGACY_WEAPONS_MANUAL = {   // 2A-5.0: 수동 백업 (테스트총기 포함, registry 생성물이 기본)
  // ========== 기존 fallback 총기 (보존) ==========
  cqb_rifle_test: {
    id:'cqb_rifle_test', name:'CQB 소총', type:'small', ammoId:'556_m855',
    caliber:'5.56x45mm',
    weightKg: 3.00,
    allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost',
                    '556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'],
    defaultAmmoId:'556_m855',
    accuracy:0.62, range:2000, falloffStart:200,
    handling: 1.10,         // CQB 조작성 (높을수록 빠른 회전/반응)
    damage:5, suppressionHit:5, suppressionMiss:2, penetration:42, damageScale:0.95,
    fireMode:'semi', fireCooldown:0.85, recoilBase: 0.7,
    rateOfFire: 800,
    spreadBaseDeg:        2.2,
    spreadMinDeg:         0.5,
    spreadMaxDeg:         9.0,
    spreadMovingMul:      2.0,
    spreadSuppressionMul: 2.4,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.6,
    tacticalReloadTime:   2.0,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        5,    fullAutoMin: 3, fullAutoMax: 8,
    burstShotDelay:       0.07,
  },
  rifle_test: {
    id:'rifle_test', name:'소총', type:'small', ammoId:'556_m855',
    caliber:'5.56x45mm',
    weightKg: 3.50,
    allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost',
                    '556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'],
    defaultAmmoId:'556_m855',
    accuracy:0.55, range:2400, falloffStart:240,
    handling: 1.00,
    damage:5, suppressionHit:5, suppressionMiss:2, penetration:42, damageScale:0.85,
    fireMode:'semi', fireCooldown:1.05, recoilBase: 0.9,
    rateOfFire: 750,
    spreadBaseDeg:        3.0,
    spreadMinDeg:         0.7,
    spreadMaxDeg:        11.0,
    spreadMovingMul:      2.2,
    spreadSuppressionMul: 2.4,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.8,
    tacticalReloadTime:   2.2,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        5,    fullAutoMin: 3, fullAutoMax: 8,
    burstShotDelay:       0.08,
  },

  // ========== 새 총기 ==========

  // MP5 — 9mm SMG, 저반동 근거리
  mp5: {
    id:'mp5', name:'MP5', type:'small', ammoId:'9mm_124gr',
    caliber:'9x19mm',
    weightKg: 2.60,
    allowedAmmoIds:['9mm_115gr','9mm_124gr','9mm_m882','9mm_7n21','9mm_7n31',
                    '9mm_jhp','9mm_jhp_p','9mm_rip','9mm_luger_tracer'],
    defaultAmmoId:'9mm_124gr',
    accuracy:0.70, range:1400, falloffStart:120,
    handling: 1.30,
    damage:5, suppressionHit:4, suppressionMiss:2, penetration:14, damageScale:0.85,
    fireMode:'semi', fireCooldown:0.55, recoilBase: 0.3,
    rateOfFire: 800,
    spreadBaseDeg:        1.6,
    spreadMinDeg:         0.4,
    spreadMaxDeg:         7.5,
    spreadMovingMul:      1.6,
    spreadSuppressionMul: 2.0,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.4,
    tacticalReloadTime:   1.8,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        6,    fullAutoMin: 4, fullAutoMax: 9,
    burstShotDelay:       0.06,
  },

  // M4A1 — 5.56 카빈, 표준 CQB
  m4a1: {
    id:'m4a1', name:'M4A1', type:'small', ammoId:'556_m855',
    caliber:'5.56x45mm',
    weightKg: 3.00,
    allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost',
                    '556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'],
    defaultAmmoId:'556_m855',
    accuracy:0.66, range:2200, falloffStart:220,
    handling: 1.10,
    damage:5, suppressionHit:5, suppressionMiss:2, penetration:42, damageScale:0.95,
    fireMode:'semi', fireCooldown:0.85, recoilBase: 0.8,
    rateOfFire: 800,
    spreadBaseDeg:        2.0,
    spreadMinDeg:         0.45,
    spreadMaxDeg:         8.5,
    spreadMovingMul:      2.0,
    spreadSuppressionMul: 2.3,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.6,
    tacticalReloadTime:   2.0,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        5,    fullAutoMin: 3, fullAutoMax: 8,
    burstShotDelay:       0.075,
  },
  dev_allammo_test: {
    id:'dev_allammo_test', name:'[DEV] 전탄종 테스트 소총', type:'small', ammoId:'556_m855',
    caliber:'5.56x45mm',
    weightKg: 3.00,
    allowedAmmoIds:['9mm_115gr','9mm_124gr','9mm_m882','9mm_7n21','9mm_7n31','9mm_jhp','9mm_jhp_p','9mm_rip','556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost','556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','545_hp','545_prs_gs','545_sp','545_us_gs','545_fmj','545_ps_gs','545_pp_gs','545_bp_gs','545_bs_gs','545_7n40','545_ppbs_gs','762x39_hp','762x39_sp','762x39_us','762x39_ps','762x39_pp','762x39_bp','762_308_fmj','762_m80','762_m80a1','762_m61_ap','762_m993_ap','4.6_dm11_ap_sx','4.6_action_sx','4.6_fmj_sx','4.6_jsp_sx','4.6_subsonic_sx','5.7_ss190','5.7_l191_tracer','5.7_ss192_jhp','5.7_sb193_subsonic','5.7_r37f','9mm_luger_tracer','9x21_sp10_7n29','9x21_sp11_7n28','9x21_sp12_jhp','9x21_sp13_7bt3','9x21_7n42','9x21_7u4_subsonic','9x39_sp5_7n8','9x39_sp6_7n9','9x39_pab9','9x39_bp_7n12','300blk_vmax_110','300blk_fmj_147','300blk_m62_tracer','300blk_cbj','300blk_ap_hardcore','300blk_220_subsonic','556_m856_tracer','556_m856a1_tracer','545_7t3_tracer','545_7bt4_aptracer','762x39_t45m_tracer','762x51_m62_tracer','762x51_m948_slap','762x54r_lps_gzh','762x54r_t46m','762x54r_7n1','762x54r_7bt1','762x54r_7n14_snb','762x54r_7n37_bs','68x51_sig_fmj','68x51_sig_hybrid','68x51_xm1186','68x51_xm1188_rra','68x51_xm1184_ap','93x64_fmj','93x64_sp','93x64_9sn_7n33_ap','338lm_fmj','338lm_ap','338lm_tacx','338lm_ucw_subsonic','338nm_fmj','338nm_ap','127x55_ps12','127x55_ps12a','127x55_ps12b','127x99_m33_ball','127x99_m17_tracer','127x99_m8_api','127x99_m20_apit','127x99_mk211_heiap','127x99_m903_slap','127x108_b32_api','127x108_bzt44_apit','127x108_mdz_hei','30_06_m2_ball','30_06_m2_ap','30_06_m25_tracer','30_06_sp','30_06_m72_match'],
    defaultAmmoId:'556_m855',
    accuracy:0.66, range:2200, falloffStart:220,
    handling: 1.10,
    damage:5, suppressionHit:5, suppressionMiss:2, penetration:42, damageScale:0.95,
    fireMode:'semi', fireCooldown:0.85, recoilBase: 0.8,
    rateOfFire: 800,
    spreadBaseDeg:        2.0,
    spreadMinDeg:         0.45,
    spreadMaxDeg:         8.5,
    spreadMovingMul:      2.0,
    spreadSuppressionMul: 2.3,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.6,
    tacticalReloadTime:   2.0,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        5,    fullAutoMin: 3, fullAutoMax: 8,
    burstShotDelay:       0.075,
  },

  // M16A2 — 5.56 장총, 정확·중장거리, FULL 없음
  m16a2: {
    id:'m16a2', name:'M16A2', type:'small', ammoId:'556_m855',
    caliber:'5.56x45mm',
    weightKg: 3.50,
    allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost',
                    '556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'],
    defaultAmmoId:'556_m855',
    accuracy:0.74, range:2600, falloffStart:280,
    handling: 0.85,
    damage:5, suppressionHit:5, suppressionMiss:2, penetration:42, damageScale:0.92,
    fireMode:'semi', fireCooldown:0.95, recoilBase: 0.7,
    rateOfFire: 800,
    spreadBaseDeg:        1.6,
    spreadMinDeg:         0.30,
    spreadMaxDeg:         7.5,
    spreadMovingMul:      2.4,
    spreadSuppressionMul: 2.4,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.8,
    tacticalReloadTime:   2.2,
    supportsFireModes:    ['semi', 'burst'],   // FULL 없음
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        5,    fullAutoMin: 3, fullAutoMax: 8,
    burstShotDelay:       0.075,
  },

  // AK-74 — 5.45 저반동
  ak74: {
    id:'ak74', name:'AK-74', type:'small', ammoId:'545_ps_gs',
    caliber:'5.45x39mm',
    weightKg: 3.30,
    allowedAmmoIds:['545_hp','545_prs_gs','545_sp','545_us_gs','545_fmj',
                    '545_ps_gs','545_pp_gs','545_bp_gs','545_bs_gs','545_7n40','545_ppbs_gs','545_7t3_tracer','545_7bt4_aptracer'],
    defaultAmmoId:'545_ps_gs',
    accuracy:0.62, range:2200, falloffStart:220,
    handling: 1.05,
    damage:5, suppressionHit:5, suppressionMiss:2, penetration:35, damageScale:0.92,
    fireMode:'semi', fireCooldown:0.92, recoilBase: 0.7,
    rateOfFire: 650,
    spreadBaseDeg:        2.2,
    spreadMinDeg:         0.50,
    spreadMaxDeg:         9.0,
    spreadMovingMul:      2.1,
    spreadSuppressionMul: 2.3,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.7,
    tacticalReloadTime:   2.1,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        5,    fullAutoMin: 3, fullAutoMax: 8,
    burstShotDelay:       0.085,
  },

  // AKM — 7.62×39 묵직한 중간탄
  akm: {
    id:'akm', name:'AKM', type:'small', ammoId:'762x39_ps',
    caliber:'7.62x39mm',
    weightKg: 3.30,
    allowedAmmoIds:['762x39_hp','762x39_sp','762x39_us','762x39_ps','762x39_pp','762x39_bp','762x39_t45m_tracer'],
    defaultAmmoId:'762x39_ps',
    accuracy:0.55, range:2200, falloffStart:200,
    handling: 0.90,
    damage:5, suppressionHit:6, suppressionMiss:3, penetration:40, damageScale:1.00,
    fireMode:'semi', fireCooldown:1.00, recoilBase: 1.4,
    rateOfFire: 600,
    spreadBaseDeg:        2.6,
    spreadMinDeg:         0.65,
    spreadMaxDeg:        11.0,
    spreadMovingMul:      2.2,
    spreadSuppressionMul: 2.4,
    magazineSize:         30,
    reserveMags:          4,
    reloadTime:           2.8,
    tacticalReloadTime:   2.2,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        4,    fullAutoMin: 3, fullAutoMax: 6,    // 짧은 연사
    burstShotDelay:       0.10,
  },

  // SCAR-H — 7.62×51 고화력 전투소총
  scar_h: {
    id:'scar_h', name:'SCAR-H', type:'small', ammoId:'762_m80',
    caliber:'7.62x51mm',
    weightKg: 3.70,
    allowedAmmoIds:['762_308_fmj','762_m80','762_m80a1','762_m61_ap','762_m993_ap','762x51_m62_tracer','762x51_m948_slap'],
    defaultAmmoId:'762_m80',
    accuracy:0.60, range:2800, falloffStart:300,
    handling: 0.80,
    damage:5, suppressionHit:7, suppressionMiss:3, penetration:55, damageScale:1.10,
    fireMode:'semi', fireCooldown:1.05, recoilBase: 2.0,
    rateOfFire: 600,
    spreadBaseDeg:        2.4,
    spreadMinDeg:         0.55,
    spreadMaxDeg:        12.0,
    spreadMovingMul:      2.5,
    spreadSuppressionMul: 2.6,
    magazineSize:         20,    // 작은 탄창
    reserveMags:          5,
    reloadTime:           3.0,
    tacticalReloadTime:   2.4,
    supportsFireModes:    ['semi', 'burst', 'full'],
    defaultFireMode:      'auto',
    burstCount:           3,
    fullAutoCount:        4,    fullAutoMin: 3, fullAutoMax: 5,
    burstShotDelay:       0.10,
  },

  // === 산탄총 (12 Gauge) — pump/semi action ===
  // tubeReload: true (튜브식, 향후 shell 단위 장전 확장 가능)
  shotgun_m870: {
    id:'shotgun_m870', name:'Remington M870', type:'small', ammoId:'12g_00buck',
    caliber:'12ga',
    weightKg: 3.20,
    allowedAmmoIds:['12g_00buck','12g_slug','12g_flechette'],
    defaultAmmoId:'12g_00buck',
    accuracy:0.55, range:600, falloffStart:30,
    handling: 0.95,
    damage:5, suppressionHit:8, suppressionMiss:3, penetration:30, damageScale:1.00,
    fireMode:'semi', fireCooldown:1.10, recoilBase: 3.0,
    rateOfFire: 60,
    spreadBaseDeg:        1.0,
    spreadMinDeg:         0.40,
    spreadMaxDeg:         6.0,
    spreadMovingMul:      2.0,
    spreadSuppressionMul: 2.2,
    magazineSize:         7,
    reserveMags:          2,
    reloadTime:           4.5,
    tacticalReloadTime:   4.0,
    supportsFireModes:    ['semi'],
    defaultFireMode:      'semi',
    burstCount:           1,
    fullAutoCount:        1,
    burstShotDelay:       0.10,
    // 산탄/펠릿용 spread (펠릿 패턴 반경)
    pelletSpreadDeg:      2.6,
    // 튜브식 재장전 — 1차는 reloadTime로 처리
    tubeReload: true,
    velocityMul: 1.00,
  },
  shotgun_m590a1: {
    id:'shotgun_m590a1', name:'Mossberg M590A1', type:'small', ammoId:'12g_00buck',
    caliber:'12ga',
    weightKg: 3.45,
    allowedAmmoIds:['12g_00buck','12g_slug','12g_flechette'],
    defaultAmmoId:'12g_00buck',
    accuracy:0.55, range:600, falloffStart:30,
    handling: 0.88,
    damage:5, suppressionHit:8, suppressionMiss:3, penetration:30, damageScale:1.00,
    fireMode:'semi', fireCooldown:1.15, recoilBase: 3.1,
    rateOfFire: 55,
    spreadBaseDeg:        1.0,
    spreadMinDeg:         0.42,
    spreadMaxDeg:         6.5,
    spreadMovingMul:      2.0,
    spreadSuppressionMul: 2.2,
    magazineSize:         8,
    reserveMags:          2,
    reloadTime:           5.0,
    tacticalReloadTime:   4.4,
    supportsFireModes:    ['semi'],
    defaultFireMode:      'semi',
    burstCount:           1,
    fullAutoCount:        1,
    burstShotDelay:       0.10,
    pelletSpreadDeg:      2.6,
    tubeReload: true,
    velocityMul: 1.00,
  },
  shotgun_m1014: {
    id:'shotgun_m1014', name:'Benelli M1014', type:'small', ammoId:'12g_00buck',
    caliber:'12ga',
    weightKg: 3.90,
    allowedAmmoIds:['12g_00buck','12g_slug','12g_flechette'],
    defaultAmmoId:'12g_00buck',
    accuracy:0.58, range:600, falloffStart:30,
    handling: 0.82,
    damage:5, suppressionHit:8, suppressionMiss:3, penetration:30, damageScale:1.00,
    fireMode:'semi', fireCooldown:0.55, recoilBase: 2.8,
    rateOfFire: 120,
    spreadBaseDeg:        1.0,
    spreadMinDeg:         0.40,
    spreadMaxDeg:         6.0,
    spreadMovingMul:      2.0,
    spreadSuppressionMul: 2.2,
    magazineSize:         7,
    reserveMags:          2,
    reloadTime:           4.8,
    tacticalReloadTime:   4.2,
    supportsFireModes:    ['semi'],
    defaultFireMode:      'semi',
    burstCount:           1,
    fullAutoCount:        1,
    burstShotDelay:       0.10,
    pelletSpreadDeg:      2.6,
    tubeReload: true,
    velocityMul: 1.00,
  },
};

// =============================================================
// velocityMul — 총기/총열 길이에 따른 탄속 보정 배율
// =============================================================
//   기본 1.00. 짧은 총열은 낮게, 긴 총열은 높게.
//   barrelLengthMm 같은 정밀 보정으로 확장 가능 (1차는 단순 배율).
const LEGACY_WEAPON_VELOCITY_MUL_MANUAL = {   // 2A-5.0: 수동 백업
  mp5:    1.00,    // SMG — 표준
  m4a1:   0.95,    // 14.5" 카빈
  m16a2:  1.05,    // 20" 풀 라이플
  ak74:   1.00,    // 16" 표준
  akm:    1.00,    // 16" 표준
  scar_h: 1.00,    // 16" 풀파워
  shotgun_m870:    1.00,
  shotgun_m590a1:  1.00,
  shotgun_m1014:   1.00,
  cqb_rifle_test: 0.90,
  rifle_test:     1.00,
  dev_allammo_test: 0.95,
};
for (const id in LEGACY_WEAPON_VELOCITY_MUL_MANUAL) {
  if (LEGACY_WEAPONS_MANUAL[id]) LEGACY_WEAPONS_MANUAL[id].velocityMul = LEGACY_WEAPON_VELOCITY_MUL_MANUAL[id];
}
for (const id in LEGACY_WEAPONS_MANUAL) {
  if (LEGACY_WEAPONS_MANUAL[id].velocityMul == null) LEGACY_WEAPONS_MANUAL[id].velocityMul = 1.00;
}

// =============================================================
