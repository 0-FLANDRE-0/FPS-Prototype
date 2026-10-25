// Generated from unchanged CQB declarations by scripts/training-ballistics.mjs. Do not edit.
export const LEGACY_BALLISTICS_SOURCES = [{"path":"src/runtime/scale.js","sha256":"0eb26687262cda2130bfbfbd71b209d16c9479ac0e7b97929eff1804c8e91cb5","declarations":["PX_PER_M","M_PER_PX","mToPx","pxToM"]},{"path":"src/runtime/game-state.js","sha256":"d890509f8ba0dfb0b708ec61950756e57a35470b0a47d4feec1ccfa87b5282ee","declarations":["BARRIER_MATERIAL_PROPS","getBarrierMaterialProps","MATERIAL_ARMOR_PER_M","getBarrierNominalThicknessM","getBarrierArmorPerMeter","computeBarrierEffectiveArmor"]},{"path":"src/data/ammunition-legacy.js","sha256":"0a7298e8fa5cd021e40edc67bffffcc736ee1c0ce7ca7284c19405dd7f60156f","declarations":["getCaliberEnergyClass","ENERGY_CLASS_BARRIER_LOSS_MUL","BEHAVIOR_BARRIER_LOSS_MUL","PENETRATOR_BEHAVIORS","getSpecialComboLossMul"]},{"path":"src/combat/armor-resolution.js","sha256":"f5a4dc104a6c5d6b434a687030a3280e1dc875a4350268969f609c7271a385f7","declarations":["penetrationProbability"]},{"path":"src/combat/ballistics.js","sha256":"9edf0595b32eb9a79d244f8c8c8f3a5b62230d21bbebb77a1da4be0a8a4daee2","declarations":["DEFAULT_BARRIER_FIELDS","getAmmoBarrier","MATERIAL_BALLISTIC","getMaterialBallistic","BEHAVIOR_BALLISTIC","getAmmoBallistic","getRicochetDecay","calcRicochetChance","calcRicochetDirection","applyLegacyPenetrationWobble","_applyBarrierLoss","_shotIsDead","isBallisticAbsoluteStopper","RAY_MAX_SEGMENTS"]}];
export function createLegacyBallistics(random = globalThis.Math.random) {
const Math = Object.create(globalThis.Math); Math.random = random;
const PX_PER_M = 32;
const M_PER_PX = 1 / PX_PER_M;
function mToPx(m)  { return m * PX_PER_M; }
function pxToM(px) { return px * M_PER_PX; }
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
const DEFAULT_BARRIER_FIELDS = {
  barrierPenMul: 1.0,
  barrierStability: 0.7,
  barrierDamageRetention: 0.8,
  ricochetMul: 1.0,
  barrierBehavior: 'normal',
};
function getAmmoBarrier(ammo) {
  if (!ammo) return Object.assign({}, DEFAULT_BARRIER_FIELDS);
  return {
    barrierPenMul: ammo.barrierPenMul != null ? ammo.barrierPenMul : DEFAULT_BARRIER_FIELDS.barrierPenMul,
    barrierStability: ammo.barrierStability != null ? ammo.barrierStability : DEFAULT_BARRIER_FIELDS.barrierStability,
    barrierDamageRetention: ammo.barrierDamageRetention != null ? ammo.barrierDamageRetention : DEFAULT_BARRIER_FIELDS.barrierDamageRetention,
    ricochetMul: ammo.ricochetMul != null ? ammo.ricochetMul : DEFAULT_BARRIER_FIELDS.ricochetMul,
    barrierBehavior: ammo.barrierBehavior || DEFAULT_BARRIER_FIELDS.barrierBehavior,
  };
}

// AABB의 표면 법선 — ray가 box에 들어온 진입점 (px,py)에 가장 가까운 면을 normal로 사용
const MATERIAL_BALLISTIC = {
  // 단단함 / 인성 / 도탄 기본 / 도탄 후 방향 편차
  drywall:    { hardness: 0.10, toughness: 0.15, ricochetBase: 0.02, dispersionDeg: 30 },
  wood:       { hardness: 0.25, toughness: 0.40, ricochetBase: 0.04, dispersionDeg: 22 },
  furniture:  { hardness: 0.20, toughness: 0.30, ricochetBase: 0.03, dispersionDeg: 25 },
  glass:      { hardness: 0.35, toughness: 0.05, ricochetBase: 0.03, dispersionDeg: 35 },
  thin_metal: { hardness: 0.55, toughness: 0.40, ricochetBase: 0.20, dispersionDeg: 12 },
  brick:      { hardness: 0.50, toughness: 0.55, ricochetBase: 0.22, dispersionDeg: 18 },
  concrete:   { hardness: 0.80, toughness: 0.70, ricochetBase: 0.35, dispersionDeg: 15 },
  steel:      { hardness: 0.95, toughness: 0.80, ricochetBase: 0.50, dispersionDeg: 8  },
  ceramic:    { hardness: 0.90, toughness: 0.30, ricochetBase: 0.32, dispersionDeg: 14 },
  fabric:     { hardness: 0.05, toughness: 0.15, ricochetBase: 0.005, dispersionDeg: 40 },
  flesh:      { hardness: 0.05, toughness: 0.20, ricochetBase: 0.005, dispersionDeg: 30 },
};
function getMaterialBallistic(matName) {
  return MATERIAL_BALLISTIC[matName] || { hardness: 0.30, toughness: 0.30, ricochetBase: 0.05, dispersionDeg: 20 };
}

// 탄약 ballistic 프로필 — barrierBehavior 기반
//   type, hardness, deformability, hardCoreGlancing (얕은 각도 도탄 가산), instability
const BEHAVIOR_BALLISTIC = {
  // === FMJ 계열 ===
  normal:              { type:'fmj',        hardness:0.55, deformability:0.30, hardCoreGlancing:0.00, instability:0.10 },
  normal_fast:         { type:'fmj',        hardness:0.55, deformability:0.30, hardCoreGlancing:0.00, instability:0.15 },
  normal_heavy:        { type:'fmj',        hardness:0.60, deformability:0.25, hardCoreGlancing:0.05, instability:0.05 },
  round_fmj:           { type:'fmj',        hardness:0.50, deformability:0.30, hardCoreGlancing:0.00, instability:0.05 },
  full_power:          { type:'fmj',        hardness:0.60, deformability:0.25, hardCoreGlancing:0.05, instability:0.05 },
  precision:           { type:'fmj',        hardness:0.55, deformability:0.25, hardCoreGlancing:0.00, instability:0.02 },
  subsonic:            { type:'fmj',        hardness:0.50, deformability:0.30, hardCoreGlancing:0.00, instability:0.05 },
  // === AP / Penetrator 계열 — 단단한 코어, 얕은 각도 도탄 증가 ===
  penetrator:          { type:'ap',         hardness:0.85, deformability:0.10, hardCoreGlancing:0.30, instability:0.10 },
  pistol_penetrator:   { type:'ap',         hardness:0.80, deformability:0.12, hardCoreGlancing:0.25, instability:0.10 },
  penetrator_unstable: { type:'ap',         hardness:0.85, deformability:0.10, hardCoreGlancing:0.32, instability:0.25 },
  barrier_blind:       { type:'barrier_opt',hardness:0.55, deformability:0.20, hardCoreGlancing:0.08, instability:0.05 },
  // === Soft point / Expand / JHP ===
  deform:              { type:'jhp',        hardness:0.30, deformability:0.80, hardCoreGlancing:0.00, instability:0.05, shatterMul:1.5 },
  // === Frangible / RIP ===
  frangible:           { type:'frangible',  hardness:0.20, deformability:0.95, hardCoreGlancing:0.00, instability:0.10, shatterMul:2.5 },
  // === Unstable ===
  unstable:            { type:'unstable',   hardness:0.50, deformability:0.45, hardCoreGlancing:0.05, instability:0.40 },
  // === Buckshot / Slug ===
  buckshot:            { type:'buckshot',   hardness:0.50, deformability:0.35, hardCoreGlancing:0.05, instability:0.20 },
  slug:                { type:'slug',       hardness:0.55, deformability:0.40, hardCoreGlancing:0.10, instability:0.30 },
  // === Fragments ===
  fragment_small:      { type:'fragment',   hardness:0.45, deformability:0.55, hardCoreGlancing:0.05, instability:0.50, irregular:true, sizeTier:'small'  },
  fragment_medium:     { type:'fragment',   hardness:0.50, deformability:0.40, hardCoreGlancing:0.08, instability:0.40, irregular:true, sizeTier:'medium' },
  fragment_large:      { type:'fragment',   hardness:0.55, deformability:0.30, hardCoreGlancing:0.12, instability:0.30, irregular:true, sizeTier:'large'  },
  fragment:            { type:'fragment',   hardness:0.50, deformability:0.40, hardCoreGlancing:0.08, instability:0.40, irregular:true, sizeTier:'medium' },
};
function getAmmoBallistic(behaviorOrPreset) {
  if (!behaviorOrPreset) return BEHAVIOR_BALLISTIC.normal;
  const key = typeof behaviorOrPreset === 'string' ? behaviorOrPreset
            : (behaviorOrPreset.barrierBehavior || 'normal');
  return BEHAVIOR_BALLISTIC[key] || BEHAVIOR_BALLISTIC.normal;
}

// 도탄 후 감쇠 — 탄종 type별 차등
function getRicochetDecay(behaviorOrPreset) {
  const ammoB = getAmmoBallistic(behaviorOrPreset);
  const t = ammoB.type;
  switch (t) {
    case 'ap':           return { vel: 0.60, pen: 0.50, dmg: 0.55, stab: 0.40 };
    case 'fmj':          return { vel: 0.55, pen: 0.45, dmg: 0.45, stab: 0.40 };
    case 'jhp':          return { vel: 0.30, pen: 0.20, dmg: 0.30, stab: 0.20 };
    case 'frangible':    return { vel: 0.15, pen: 0.05, dmg: 0.10, stab: 0.05 };
    case 'unstable':     return { vel: 0.40, pen: 0.30, dmg: 0.35, stab: 0.20 };
    case 'buckshot':     return { vel: 0.35, pen: 0.25, dmg: 0.30, stab: 0.25 };
    case 'slug':         return { vel: 0.50, pen: 0.40, dmg: 0.55, stab: 0.30 };
    case 'fragment':
      if (ammoB.sizeTier === 'small')  return { vel: 0.25, pen: 0.20, dmg: 0.18, stab: 0.10 };
      if (ammoB.sizeTier === 'large')  return { vel: 0.50, pen: 0.40, dmg: 0.50, stab: 0.30 };
      return { vel: 0.40, pen: 0.32, dmg: 0.35, stab: 0.20 };
    case 'barrier_opt':  return { vel: 0.50, pen: 0.40, dmg: 0.45, stab: 0.35 };
    default:             return { vel: 0.50, pen: 0.40, dmg: 0.40, stab: 0.30 };
  }
}

// 통합 도탄 확률 — 속도/관통/입사각/탄자/재질 모두 반영
//   ctx: { incidentAngleRad, material, ammoBarrier|behavior, ammoRicMul,
//          impactVel, initialVel, effectivePen, barrierResistance }
function calcRicochetChance(ctx) {
  const matB = getMaterialBallistic(ctx.material);
  const ammoB = getAmmoBallistic(ctx.ammoBarrier || ctx.behavior);
  const ricMul = (ctx.ammoRicMul != null) ? ctx.ammoRicMul
              : (ctx.ammoBarrier && ctx.ammoBarrier.ricochetMul) || 1.0;

  // glance: 0=정면, 1=완전 스침
  const glance = Math.sin(ctx.incidentAngleRad || 0);
  const normalImpact = Math.cos(ctx.incidentAngleRad || 0);

  // 1) 기본 — sin^4 곡선 × 재질 base × 탄약 ric mul
  let chance = Math.pow(glance, 4) * matB.ricochetBase * ricMul;

  // 2) 고속 + 얕은 각 보너스
  const initVel = ctx.initialVel > 0 ? ctx.initialVel : 1;
  const velRatio = Math.max(0, Math.min(1, (ctx.impactVel || initVel) / initVel));
  if (glance > 0.65) {
    chance += velRatio * Math.pow(glance, 2) * 0.12;
  }

  // 3) hardCoreGlancing — AP가 단단한 표면 + 얕은 각도 + 고속에서 도탄 ↑
  if (ammoB.hardCoreGlancing > 0 && matB.hardness > 0.55) {
    chance += ammoB.hardCoreGlancing * Math.pow(glance, 2) * matB.hardness * velRatio;
  }

  // 4) penetrationOvermatch — pen이 저항 크게 초과하면 도탄 ↓
  //    단 매우 얕은 각도(glance > 0.85)에서는 효과 약화 (AP도 스치면 튐)
  if (ctx.effectivePen > 0 && ctx.barrierResistance > 0) {
    const overmatch = (ctx.effectivePen - ctx.barrierResistance) / Math.max(1, ctx.barrierResistance);
    if (overmatch > 0.25) {
      const reduction = Math.min(0.55, overmatch * 0.40);
      const glanceProtect = Math.max(0, (glance - 0.85)) / 0.15;
      const effectiveReduction = reduction * (1 - glanceProtect * 0.7);
      chance -= effectiveReduction;
    }
  }

  // 5) deformability penalty — JHP/Frangible 변형으로 도탄 대신 정지/소실
  chance -= ammoB.deformability * 0.18;

  // 6) 정면 충돌 penalty
  chance -= normalImpact * 0.08;

  // 7) clamp — 재질별 상한
  let maxChance;
  if (matB.hardness < 0.20)      maxChance = 0.15;   // flesh/fabric/drywall은 매우 낮게
  else if (matB.hardness > 0.85) maxChance = 0.92;   // steel/ceramic 매우 높을 수 있음
  else                            maxChance = 0.80;
  return Math.max(0, Math.min(maxChance, chance));
}

// 도탄 후 방향 — 반사 + 재질/탄종별 분산 jitter
function calcRicochetDirection(nx, ny, normalX, normalY, materialName, ammoBehavior) {
  const dot = nx * normalX + ny * normalY;
  const rxBase = nx - 2 * dot * normalX;
  const ryBase = ny - 2 * dot * normalY;
  const baseAng = Math.atan2(ryBase, rxBase);
  const matB = getMaterialBallistic(materialName);
  const ammoB = getAmmoBallistic(ammoBehavior);
  // 분산 — 재질 + 탄종 불안정성
  let dispersionDeg = matB.dispersionDeg || 20;
  if (ammoB.instability) dispersionDeg += ammoB.instability * 25;
  if (ammoB.irregular)   dispersionDeg += 10;
  const dispRad = (dispersionDeg * Math.PI / 180);
  const jitter = (Math.random() - 0.5) * dispRad;
  const finalAng = baseAng + jitter;
  return { nx: Math.cos(finalAng), ny: Math.sin(finalAng), jitterDeg: jitter * 180 / Math.PI };
}

// =============================================================
// 기존 도탄 확률 함수 (호환 유지)
// =============================================================
function applyLegacyPenetrationWobble(nx, ny, shotState) {
  const wobbleMagDeg = Math.max(0, (1.0 - shotState.stability) * 6);
  const wobble = ((Math.random() - 0.5) * 2) * (wobbleMagDeg * Math.PI / 180);
  const newAng = Math.atan2(ny, nx) + wobble;
  return {
    nx: Math.cos(newAng),
    ny: Math.sin(newAng),
    wobbleRad: wobble,
    wobbleDeg: +(wobble * 180 / Math.PI).toFixed(1),
    wobbleMagDeg: +wobbleMagDeg.toFixed(2),
  };
}
// PENETRATION-VISUAL-ROLLBACK-1 §1: applyPostBarrierDeflection() 제거 — 구버전 탄도 감각(wall 기본 방향 / cover stability wobble)으로 복원. 새 관통 후 deflection 구조 미사용.
function _applyBarrierLoss(shotState, material, wallArmor) {
  const props = getBarrierMaterialProps(material);
  const ammoBarrier = shotState.ammoBarrier;
  const ammo = shotState.ammo;
  const velRatio = shotState.velocity / Math.max(1, shotState.initialVelocity);

  // === 보정 인수들 ===
  // 1) cumulativeLossMul — 누적 (관통 횟수↑/탄속↓/안정성↓)
  const barrierStackMul = 1 + shotState.barrierCount * 0.18;
  const lowVelocityMul  = 1 + (1 - velRatio) * 0.75;
  const instabilityMul  = 1 + (1 - shotState.stability) * 0.50;
  const cumulativeLossMul = barrierStackMul * lowVelocityMul * instabilityMul;

  // 2) energyClassLossMul — 구경/에너지
  const energyClass = ammo ? getCaliberEnergyClass(ammo) : 'small_rifle';
  const energyClassLossMul = ENERGY_CLASS_BARRIER_LOSS_MUL[energyClass] || 1.00;

  // 3) behaviorLossMul — 탄종 성격
  const behavior = ammoBarrier.barrierBehavior || 'normal';
  const behaviorLossMul = BEHAVIOR_BARRIER_LOSS_MUL[behavior] || 1.00;

  // 4) specialComboMul — 대구경 + AP 콤보
  const specialComboMul = getSpecialComboLossMul(energyClass, behavior);

  // 통합
  const totalLossMul = cumulativeLossMul * energyClassLossMul * behaviorLossMul * specialComboMul;

  // === 재질별 retention 적용 ===
  //   barrierPenMul이 높을수록 penRet 보너스 (penetrator는 retention 더 좋음)
  let penRet = Math.min(0.98, props.penRetention * (1 + (ammoBarrier.barrierPenMul - 1.0) * 0.4));
  // SIDE-MAP-BALLISTIC-1A §6: 낮은 armor/두께는 retention을 1.0 쪽으로 연화(얇은 판 표현), 높은 armor는 재질 base 유지
  //   thin_metal 등 동일 재질에서 armor로 손실 차이를 표현 (새 재질 추가 없이)
  const _armorForRet = (wallArmor != null && wallArmor > 0) ? wallArmor : 0;
  const _retSoften = Math.max(0, 1 - _armorForRet / 35) * 0.7;   // armor 0 → 70% 연화, armor>=35 → 0
  penRet = Math.min(0.98, penRet + (1 - penRet) * _retSoften);
  const velRet = Math.min(0.985, props.velocityRetention + (1 - props.velocityRetention) * _retSoften * 0.6);
  const dmgRet = Math.min(0.98, props.damageRetention * (1 + (ammoBarrier.barrierDamageRetention - 0.7) * 0.5));
  const stabLoss = props.stabilityLossBase / Math.max(0.5, ammoBarrier.barrierStability) * totalLossMul;

  // SIDE-AMMO-2B-HOTFIX-0 §4: wallArmor / cover armor를 관통 후 손실에 반영
  //   material이 기본 성격, armor가 두께/저항량 역할. 같은 재질이라도 armor↑ → penAfter/velAfter/stab 더 감소.
  const armorVal = (wallArmor != null && wallArmor > 0) ? wallArmor : 0;
  const armorPenScale = 1 + Math.min(1.2, armorVal / 30) * 0.9;   // armor 30 ≈ +90% 추가 penetrationLoss
  const armorVelScale = 1 + Math.min(1.0, armorVal / 40) * 0.5;
  const armorStabScale = 1 + Math.min(1.0, armorVal / 35) * 0.6;

  // === 결과 적용 ===
  const before = { pen: shotState.pen, vel: shotState.velocity, dmg: shotState.damage, stab: shotState.stability };
  shotState.pen = Math.max(0, (shotState.pen * penRet) - (props.penetrationLoss * totalLossMul * armorPenScale));
  shotState.velocity = Math.max(0, shotState.velocity * (1 - (1 - velRet) * totalLossMul * armorVelScale));
  shotState.damage = Math.max(0, shotState.damage * dmgRet);
  shotState.stability = Math.max(0, shotState.stability - stabLoss * armorStabScale);
  shotState.barrierCount += 1;

  // SIDE-AMMO-2B-HOTFIX-0 §3: 이번 충돌 1회의 순간 손실률 (누적 아님) — Mk211 기폭 입력
  const instantPenLoss = Math.max(0, before.pen - shotState.pen);
  const instantPenLossRatio = before.pen > 0 ? Math.max(0, Math.min(1, instantPenLoss / before.pen)) : 0;
  const velocityLossRatio = before.vel > 0 ? Math.max(0, Math.min(1, (before.vel - shotState.velocity) / before.vel)) : 0;
  const damageLossRatio = before.dmg > 0 ? Math.max(0, Math.min(1, (before.dmg - shotState.damage) / before.dmg)) : 0;

  // 디버그 정보 — barrierEvents에 기록되도록 반환
  return Object.assign(before, {
    energyClass, barrierBehavior: behavior,
    energyClassLossMul, behaviorLossMul, specialComboMul, cumulativeLossMul, totalLossMul,
    penBeforeImpact: +before.pen.toFixed(1), penAfterImpact: +shotState.pen.toFixed(1),
    instantPenLoss: +instantPenLoss.toFixed(1), instantPenLossRatio: +instantPenLossRatio.toFixed(3),
    velocityLossRatio: +velocityLossRatio.toFixed(3), damageLossRatio: +damageLossRatio.toFixed(3),
    impactArmor: armorVal, material,
  });
}
function _shotIsDead(shotState) {
  return shotState.pen <= 1 || shotState.velocity <= 90 || shotState.damage <= 1 || shotState.stability <= 0.05;
}

// SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목1,6): 탄도 hard blocker 판정 — 벽/닫힌문/시야차단/fullCover는 관통 불가(정지/도탄만), halfCover는 hard blocker 아님
// SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1: 탄도 절대 차단은 명시 플래그로만 결정.
//   blocksLOS/fullCover/type:'wall'/isWall은 시야·충돌·분류 속성일 뿐 탄도 절대 차단이 아님.
function isBallisticAbsoluteStopper(obj, opts) {
  if (!obj) return false;
  if (obj.allowBallisticPenetration === true) return false;   // 명시적 관통 허용이 최우선
  if (obj.penetrable === false) return true;                  // 명시적 관통 불가만 절대 차단
  if (obj.ballisticBlocker === true) return true;
  if (obj.absoluteBallisticStopper === true) return true;
  if (obj.closedDoor === true && obj.locked === true) return true;   // 잠긴 장갑문 등
  if (opts && opts.isWall === true && obj.penetrable === false) return true;
  return false;
}
// 하위호환: 기존 호출부가 있을 수 있어 유지하되, 절대 차단 의미로 위임 (더 이상 blocksLOS/fullCover/wall로 막지 않음)
const RAY_MAX_SEGMENTS = 16;   // 안전장치 — 실제 정지는 shotState 감소로 자연스럽게 일어남

// 장벽 통과 시 shotState 갱신 — 누적 감쇠 + energyClass + barrierBehavior + 콤보 보정
// WALL-AS-FULLCOVER-WOBBLE-RESTORE-1 §1: 구버전 cover 관통 wobble 공식을 공용 helper로 분리 (새 시스템 아님).
//   _applyBarrierLoss() 이후의 shotState.stability를 사용. cover/wall 관통 성공 시 동일 적용.
return Object.freeze({ mToPx, computeBarrierEffectiveArmor, getAmmoBarrier, penetrationProbability, calcRicochetChance, calcRicochetDirection, getRicochetDecay, getAmmoBallistic, applyLegacyPenetrationWobble, _applyBarrierLoss, _shotIsDead, isBallisticAbsoluteStopper, RAY_MAX_SEGMENTS, MATERIAL_ARMOR_PER_M, BARRIER_MATERIAL_PROPS });
}
