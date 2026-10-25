// 5b. BARRIER PENETRATION (벽/장애물 관통 + 도탄)
// =============================================================
//   raycastShot 안에서 cover object와 ray의 교차를 검사하고,
//   탄약 barrier 특성으로 관통/도탄을 결정한다.
//   장애물 관통 시 새 ray가 이어지므로 raycastShot은 재귀로 처리.

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
function aabbNormalAtEntry(box, px, py) {
  const cx = box.x + box.w * 0.5, cy = box.y + box.h * 0.5;
  const dx = (px - cx) / (box.w * 0.5);
  const dy = (py - cy) / (box.h * 0.5);
  if (Math.abs(dx) > Math.abs(dy)) return { nx: dx > 0 ? 1 : -1, ny: 0 };
  return { nx: 0, ny: dy > 0 ? 1 : -1 };
}

// 가장 가까운 cover object 검사 — 결과 t/object/exitPoint
function rayDistToCovers(ox, oy, nx, ny, maxDist, exclude) {
  let best = maxDist, bestObj = null, bestExitT = 0;
  if (!MAP_DATA.coverObjects) return { t: maxDist, obj: null, exitT: 0 };
  for (const o of MAP_DATA.coverObjects) {
    if (exclude && exclude.has(o)) continue;
    // 진입 t (rayBoxT는 진입점 t를 반환)
    const tEnter = rayBoxT(ox, oy, nx, ny, o, maxDist);
    if (tEnter >= maxDist) continue;
    if (tEnter <= 0.01) continue;   // 시작점이 box 안이면 스킵
    if (tEnter < best) {
      // 박스 통과 후 exit t (반대편)
      const exitT = rayBoxExitT(ox, oy, nx, ny, o, maxDist);
      best = tEnter; bestObj = o; bestExitT = exitT;
    }
  }
  return { t: best, obj: bestObj, exitT: bestExitT };
}

// rayBoxExitT는 이 아래(도탄/관통 통합 ballistic 시스템 구획)에 한 번 더 선언되어 있었고,
// 함수 선언 호이스팅 때문에 항상 그쪽이 이겨 왔다. 여기 있던 구버전은 축평행 미교차와
// 비교차(tmin>tmax) 처리가 없어 실제로 호출된 적이 없는 사어였으므로 제거한다. 동작 변화 없음.

// 입사각 (정상 표면 기준 라디안) — 0=정면 / Math.PI/2=완전 비스듬
// =============================================================
// 도탄 / 관통 / 정지 — 통합 ballistic 시스템
// =============================================================
//   기존 ricochetProbability/penetrationProbability는 유지하되,
//   새 calcRicochetChance가 더 정교한 컨텍스트(속도/관통/재질/탄자) 기반 확률 계산.

// 재질별 ballistic 프로필
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
function getIncidentAngle(nx, ny, normalX, normalY) {
  // 진행 방향과 표면 법선의 내적 → cos(θ_face)
  // 진행이 normal과 정반대일수록 정면 → angle from surface = 0 (정면 충돌)
  const dot = -(nx * normalX + ny * normalY);   // 0~1, 1=정면
  const cosTheta = Math.max(0, Math.min(1, dot));
  return Math.acos(cosTheta);   // 0=정면, π/2=얕음
}

// 도탄 확률 — 입사각 + 재질 ricochetBase + 탄약 ricochetMul
function ricochetProbability(incidentAngleRad, materialBase, ammoMul) {
  // 입사각 0 ~ π/2 → 정면=0, 완전 얕음=π/2
  // 얕은 각도에서 큰 확률 — sin(angle)^4 곡선 사용
  const angleScore = Math.pow(Math.sin(incidentAngleRad), 4);   // 0=0, 60도=0.56, 80도=0.94
  const p = angleScore * materialBase * ammoMul;
  return Math.max(0, Math.min(0.85, p));
}

// raycastShot — shooter 위치에서 (dx,dy) 방향, maxDist 까지 ray 발사.
//   유닛/벽/장애물 중 가장 가까운 것을 찾고, 장애물이면 관통/도탄을 시도해
//   필요시 새 ray로 이어 나간다. 재귀 깊이는 segments로 제한.
//   결과 객체에 추가 정보:
//     barrierEvents: [{obj,material,outcome:'penetrated'|'stopped'|'ricochet', ...}]
//     shotPen, shotDamage: 최종 시점의 남은 값 (유닛 명중 시 사용)
// SIDE-MED-BALLISTIC-2C-1 §12: continuation raycast — 기존 raycastSegment(cover/wall/unit) pipeline 재사용
const MAX_CONTINUATION_DEPTH = 2;
// 감쇠된 잔여 위협으로 origin에서부터 기존 ray pipeline을 이어 진행
function raycastContinuationFrom(ox, oy, nx, ny, maxDist, dampedAmmo, shooter) {
  const ammoBarrier = getAmmoBarrier(dampedAmmo);
  const shotState = {
    pen: dampedAmmo.penetration, damage: dampedAmmo.damage,
    velocity: dampedAmmo.velocity || 300, initialVelocity: dampedAmmo._initialVelocity || dampedAmmo.velocity || 600,
    stability: dampedAmmo._stability != null ? dampedAmmo._stability : 0.8,
    barrierCount: dampedAmmo._barrierCount || 1, ammoBarrier, ammo: dampedAmmo,
    travelDistPx: dampedAmmo._travelDistPx || 0,   // CLEANUP HOTFIX 2
  };
  return raycastSegment(ox, oy, nx, ny, maxDist, shotState, 0, [], new Set(), shooter);
}
function _spawnContinuationRaycast(shooter, fromUnit, dirX, dirY, w, packet) {
  if (!packet || !shooter || !fromUnit) return { hit:false, reason:'no_packet' };
  if ((packet.continuationDepth || 0) > MAX_CONTINUATION_DEPTH) return { hit:false, reason:'depth_limit' };
  if (packet.sourceType === 'frag') return { hit:false, reason:'fragment_no_continuation' };
  if (!(packet.residualPen >= 6)) return { hit:false, reason:'residual_too_low' };
  const baseAmmo = (w && w._ammo) || {};
  // 감쇠된 탄 — 원탄 full-power 재사용 금지
  const dAmmo = Object.assign({}, baseAmmo, {
    penetration: packet.residualPen, damage: Math.max(4, packet.residualDamage || 8),
    velocity: (packet.residualVelocity != null ? packet.residualVelocity : (baseAmmo.velocity || 400) * 0.5),
    _initialVelocity: (baseAmmo.velocity || 600), _stability: packet.residualStability != null ? packet.residualStability : 0.8, _barrierCount: 1,
  });
  const dWeapon = Object.assign({}, w, { _ammo: dAmmo, penetration: packet.residualPen, damageScale: (w.damageScale || 1.0) * (packet.velocityMul || 0.5) });
  // 안정성 기반 작은 편차 (개그 탄도 금지 — 최대 ±6도)
  let defl = 0;
  if (packet.yawState === 'destabilized' || packet.deformationState === 'expanded') defl = (Math.random() - 0.5) * (6 * Math.PI / 180);
  else if (packet.fragmentationState === 'fragmented') return { hit:false, reason:'fragmented_no_continuation' };
  else defl = (Math.random() - 0.5) * (2 * Math.PI / 180);   // stable: 거의 직진
  packet.deflectionDeg = +(defl * 180 / Math.PI).toFixed(1);
  const cos = Math.cos(defl), sin = Math.sin(defl);
  const ndx = dirX * cos - dirY * sin, ndy = dirX * sin + dirY * cos;
  packet.rayDirection = { nx: ndx, ny: ndy };
  // exit point 약간 바깥에서 시작 (같은 표적 즉시 재충돌 방지 — geometry)
  const ox = fromUnit.x + ndx * (UNIT_RADIUS + 3), oy = fromUnit.y + ndy * (UNIT_RADIUS + 3);
  packet.rayOrigin = { x: ox, y: oy };
  const maxPx = 10 * PX_PER_M;
  // 기존 pipeline 재사용 — cover/wall/ricochet/penetration 처리
  const ray = raycastContinuationFrom(ox, oy, ndx, ndy, maxPx, dAmmo, shooter);
  const endX = ray ? ray.x : ox + ndx * maxPx, endY = ray ? ray.y : oy + ndy * maxPx;
  if (typeof GAME !== 'undefined' && GAME.fxList) GAME.fxList.push({ type:'tracer', x1:ox, y1:oy, x2:endX, y2:endY, life:0.22, maxLife:0.22, team:shooter.team, hitType: (ray && ray.type === 'unit') ? 'unit' : 'none' });
  if (!ray || ray.type !== 'unit' || !ray.unit) return { hit:false, reason: ray ? ('blocked_' + ray.type) : 'no_target' };
  const best = ray.unit;
  // cover/wall 통과 후 ray의 잔여값으로 dAmmo 갱신 — 벽 우회 금지, 감쇠 반영
  const arrivePen = (ray.shotPen != null) ? ray.shotPen : packet.residualPen;
  if (arrivePen < 4) return { hit:false, reason:'absorbed_by_cover' };
  dAmmo.penetration = arrivePen;
  if (ray.shotDamage != null) dAmmo.damage = Math.max(4, ray.shotDamage);
  if (ray.shotVelocity != null) dAmmo.velocity = ray.shotVelocity;
  if (ray.shotStability != null) dAmmo._stability = ray.shotStability;
  dWeapon.penetration = arrivePen;
  // ray.shotDamage 감쇠를 실제 피해(damageScale)에 반영 — resolveAmmoForWeapon이 원탄 damage를 다시 읽으므로
  //   damageScale = 원래 weapon scale × (ray.shotDamage / baseAmmo.damage). cover/wall 통과 + 잔여 모두 반영되어 원탄보다 약함.
  const _baseDmg = (baseAmmo.damage != null && baseAmmo.damage > 0) ? baseAmmo.damage : AMMO_DAMAGE_BASELINE;
  const _arriveDmg = (ray.shotDamage != null) ? ray.shotDamage : (packet.residualDamage || _baseDmg * 0.4);
  const _dmgRatio = Math.max(0.05, Math.min(1.0, _arriveDmg / _baseDmg));
  packet.arrivedDamage = +_arriveDmg.toFixed(1);
  dWeapon.damageScale = (w.damageScale || 1.0) * _dmgRatio;
  const r = resolveImpact(shooter, best, dWeapon, { _continuationDepth: packet.continuationDepth, shotVelocity: (ray.shotVelocity != null ? ray.shotVelocity : packet.residualVelocity) || null, aimQualityOverride: 0.85, coverExposure: _computeRayCoverExposure(ray), coverPenetrationContext: _computeRayCoverPenetrationExposure(ray) });
  r.hitAspect = (typeof getHitAspect === 'function') ? getHitAspect(shooter, best) : 'front';
  registerThreat(best, shooter.x, shooter.y, { sourceUnitId: shooter.id, sourceEventId: 'hit' + shooter.id + '_' + Math.round((GAME.gameTime||0)*100) });
  if (r.bodyTrajectory && r.bodyTrajectory.continueRaycast && r.bodyTrajectory.continuationThreatPacket) {
    _spawnContinuationRaycast(shooter, best, ndx, ndy, dWeapon, r.bodyTrajectory.continuationThreatPacket);
  }
  return { hit:true, target:best, result:r, arrivePen };
}
function raycastShot(shooter, dx, dy, maxDist, opts) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-7) return { type:'none', dist: maxDist, x: shooter.x, y: shooter.y, barrierEvents: [] };
  const nx0 = dx / len, ny0 = dy / len;

  // opts: { weapon, ammo } — barrier 계산용
  const ammo = (opts && opts.ammo) || (opts && opts.weapon && opts.weapon._ammo) || null;
  const weapon = (opts && opts.weapon) || null;
  const ammoBarrier = getAmmoBarrier(ammo);
  const initShotPen = (ammo && ammo.penetration != null) ? ammo.penetration : ((weapon && weapon.penetration) || 30);
  const initShotDamage = (ammo && ammo.damage != null) ? ammo.damage : ((weapon && weapon.damage) || AMMO_DAMAGE_BASELINE);
  const ammoVelocity = (ammo && ammo.velocity) || 500;
  const velocityMul = (weapon && weapon.velocityMul) || 1.0;
  const initVelocity = ammoVelocity * velocityMul;

  const events = [];
  const excluded = new Set();   // 같은 cover에 다시 부딪히지 않게
  // shotState — 누적 트래킹
  const shotState = {
    pen: initShotPen, damage: initShotDamage,
    velocity: initVelocity, initialVelocity: initVelocity,
    stability: 1.0,
    barrierCount: 0,
    travelDistPx: 0,   // CLEANUP HOTFIX 2: 장벽 통과 누적 비행거리
    ammoBarrier,
    ammo,    // energyClass 조회용
    teamHitMode: (opts && opts.teamHitMode) || 'ignore',   // SIDE-FIRE-1A: 'ignore'|'detect_only'|'damage'
  };
  // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목4): 총구 기반 ballistic origin (기본 shooter 중심 — 하위호환)
  const origin = (opts && opts.origin) ? opts.origin : { x: shooter.x, y: shooter.y };
  return raycastSegment(origin.x, origin.y, nx0, ny0, maxDist,
                        shotState, 0, events, excluded, shooter);
}

const RAY_MAX_SEGMENTS = 16;   // 안전장치 — 실제 정지는 shotState 감소로 자연스럽게 일어남

// 장벽 통과 시 shotState 갱신 — 누적 감쇠 + energyClass + barrierBehavior + 콤보 보정
// WALL-AS-FULLCOVER-WOBBLE-RESTORE-1 §1: 구버전 cover 관통 wobble 공식을 공용 helper로 분리 (새 시스템 아님).
//   _applyBarrierLoss() 이후의 shotState.stability를 사용. cover/wall 관통 성공 시 동일 적용.
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
function isBallisticHardBlocker(obj, opts) { return isBallisticAbsoluteStopper(obj, opts); }
function isBallisticPenetrableBarrier(obj, opts) {
  if (!obj) return false;
  if (obj.allowBallisticPenetration === true) return true;
  if (isBallisticAbsoluteStopper(obj, opts)) return false;
  return obj.penetrable !== false;   // penetrable:true(또는 미지정) → material/armor/탄종으로 관통 판정
}
function raycastSegment(ox, oy, nx, ny, maxDist, shotState, segments, events, excluded, shooter) {
  const ammoBarrier = shotState.ammoBarrier;
  // 1) 벽까지의 거리 (벽 객체도 반환)
  const wallHit = rayDistToWalls(ox, oy, nx, ny, maxDist, excluded);
  const wallT = wallHit.t;
  const wallObj = wallHit.obj;

  // 2) 장애물까지의 거리
  const cov = rayDistToCovers(ox, oy, nx, ny, maxDist, excluded);

  // 3) 적팀 유닛 hitbox
  let bestT = Infinity, bestUnit = null;
  const _teamHitMode = shotState.teamHitMode || 'ignore';
  for (const u of UNITS) {
    if (!u.alive) continue;
    if (u === shooter) continue;
    // SIDE-FIRE-1A: 같은 팀은 teamHitMode가 'ignore'일 때만 스킵 (damage/detect_only면 명중 가능 — 아군 오사)
    if (shooter && u.team === shooter.team && _teamHitMode === 'ignore') continue;
    const t = intersectRayCircle(ox, oy, nx, ny, u.x, u.y, UNIT_RADIUS);
    if (t < bestT && t <= maxDist) { bestT = t; bestUnit = u; }
  }

  const tWall = wallT;
  const tCover = cov.t;
  const tUnit = bestT;
  const tMin = Math.min(tWall, tCover, tUnit);

  // 유닛이 가장 가까움
  if (tMin === tUnit && bestUnit && tUnit < maxDist) {
    return {
      type: 'unit', dist: tUnit,
      shotDistTotalPx: (shotState.travelDistPx || 0) + tUnit,   // CLEANUP HOTFIX 2: 총 비행거리(장벽 전 구간 포함)
      x: ox + nx * tUnit, y: oy + ny * tUnit,
      unit: bestUnit, barrierEvents: events,
      shotPen: shotState.pen, shotDamage: shotState.damage, segments,
      shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
      shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
      passedHalfCovers: shotState.passedHalfCovers || null,   // SIDE-HITLOC-COVER-EXPOSURE-1A: exit→targetHitPoint 노출 계산용
      penetratedHalfCovers: shotState.penetratedHalfCovers || null,   // SIDE-HITLOC-COVER-INTERACTION-1B: 관통 후 피격부위 보정용
      _origin: { x: ox, y: oy }, _dir: { nx, ny },
    };
  }

  // 벽이 가장 가까움 — cover와 동일한 관통/도탄 처리
  if (tMin === tWall && wallObj && tWall < maxDist) {
    const ix = ox + nx * tWall, iy = oy + ny * tWall;
    const normal = aabbNormalAtEntry(wallObj, ix, iy);
    // 외벽 등 penetrable이 false면 무조건 정지. shot dead 시에도 정지. (SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1 §8: reason 기록)
    const _wallEarlyAbs = isBallisticAbsoluteStopper(wallObj, { isWall: true });
    if (segments >= RAY_MAX_SEGMENTS || _wallEarlyAbs || _shotIsDead(shotState)) {
      const _earlyReason = _wallEarlyAbs ? 'absolute_stopper' : (segments >= RAY_MAX_SEGMENTS ? 'max_segments' : 'shot_dead');
      events.push({ obj: wallObj, material: wallObj.material || 'concrete', outcome: 'stopped',
                    x: ix, y: iy, nx: normal.nx, ny: normal.ny, isWall: true,
                    armor: wallObj.armor, shotPenBefore: shotState.pen, reason: _earlyReason });
      return {
        type: 'wall', dist: tWall,
        x: ix, y: iy, wall: wallObj,
        barrierEvents: events,
        shotPen: shotState.pen, shotDamage: shotState.damage, segments,
        shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
        shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
        _origin: { x: ox, y: oy }, _dir: { nx, ny },
      };
    }
    // 관통 판정 (cover와 동일). SIDE-PATHLEN-ARMOR-1 §8: 고정 armor 대신 실제 통과 길이 기반 effectiveArmor.
    const wallMaterial = wallObj.material || 'drywall';
    const _wallExitT = rayBoxExitT(ox, oy, nx, ny, wallObj, maxDist);
    const _wallIncAngle = getIncidentAngle(nx, ny, normal.nx, normal.ny);
    const wallIncidentDeg = _wallIncAngle * 180 / Math.PI;
    const wallEff = computeBarrierEffectiveArmor(wallObj, { entryT: tWall, exitT: _wallExitT, material: wallMaterial, incidentDeg: wallIncidentDeg });
    const wallArmor = wallEff.effectiveArmor;
    // velocity ratio로 effective pen 보정
    const velRatio = shotState.velocity / Math.max(1, shotState.initialVelocity);
    const velMul = 0.5 + 0.5 * velRatio;
    const barrierPen = shotState.pen * ammoBarrier.barrierPenMul * velMul;
    const diff = barrierPen - wallArmor;
    const pPen = penetrationProbability(diff);
    let penetrated = Math.random() < pPen;
    // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1 §2: 벽은 penetrable:false 등 명시 절대차단만 강제 정지. drywall/wood/glass 등 penetrable:true는 관통 판정 정상 수행.
    const _wallAbsStop = isBallisticAbsoluteStopper(wallObj, { isWall: true });
    if (_wallAbsStop) penetrated = false;

    if (!penetrated) {
      // === 도탄 시도 — 새 통합 시스템 ===
      const incidentAngle = getIncidentAngle(nx, ny, normal.nx, normal.ny);
      const matName = wallObj.material || 'drywall';
      const ricChance = calcRicochetChance({
        incidentAngleRad: incidentAngle,
        material: matName,
        ammoBarrier: ammoBarrier,
        impactVel: shotState.velocity,
        initialVel: shotState.initialVelocity,
        effectivePen: barrierPen,
        barrierResistance: wallArmor,
      });
      if (Math.random() < ricChance) {
        // 반사 방향 — 재질/탄종별 분산
        const rd = calcRicochetDirection(nx, ny, normal.nx, normal.ny, matName, ammoBarrier && ammoBarrier.barrierBehavior);
        // 도탄 후 감쇠 — 탄종별 차등
        const dec = getRicochetDecay(ammoBarrier);
        if (GAME.debugBallistic) {
          log(`🔄 도탄: ${ammoBarrier.shortName || 'ammo'} → ${matName} (${(incidentAngle*180/Math.PI).toFixed(0)}°, p=${ricChance.toFixed(2)}, vel ${shotState.velocity.toFixed(0)}→${(shotState.velocity*dec.vel).toFixed(0)}, pen ${shotState.pen.toFixed(0)}→${(shotState.pen*dec.pen).toFixed(0)})`, 'info');
        }
        shotState.damage *= dec.dmg;
        shotState.pen *= dec.pen;
        shotState.velocity *= dec.vel;
        shotState.stability *= dec.stab;
        shotState.barrierCount += 1;
        const remainDist = maxDist - tWall;
        events.push({ obj: wallObj, material: matName, outcome: 'ricochet', reason: _wallAbsStop ? 'absolute_stopper' : 'ricochet',
                      x: ix, y: iy, nx: normal.nx, ny: normal.ny, isWall: true,
                      ricChance, incidentDeg: incidentAngle * 180 / Math.PI });
        const newExcluded = new Set(excluded); newExcluded.add(wallObj);
        const startX = ix + rd.nx * 1.5, startY = iy + rd.ny * 1.5;
        shotState.travelDistPx = (shotState.travelDistPx || 0) + (maxDist - remainDist);   // CLEANUP HOTFIX 2
        return raycastSegment(startX, startY, rd.nx, rd.ny, remainDist * 0.5,
                              shotState, segments + 1, events, newExcluded, shooter);
      }
      // 도탄도 실패 — 박힘 (frangible은 소실)
      const ammoB = getAmmoBallistic(ammoBarrier);
      const outcome = (ammoB.type === 'frangible' && Math.random() < 0.5) ? 'shattered' : 'stopped';
      events.push({ obj: wallObj, material: matName, outcome,
                    x: ix, y: iy, nx: normal.nx, ny: normal.ny, isWall: true,
                    armor: wallArmor, baseArmor: wallEff.baseArmor, effectiveArmor: wallEff.effectiveArmor,
                    armorPerMeter: +wallEff.armorPerMeter.toFixed(1), nominalThicknessM: +wallEff.nominalThicknessM.toFixed(3),
                    pathLenM: +wallEff.pathLenM.toFixed(3), pathRatio: +wallEff.pathRatio.toFixed(2),
                    shotPenBefore: shotState.pen, barrierPen, penProbability: +pPen.toFixed(3),
                    reason: _wallAbsStop ? 'absolute_stopper' : 'failed_penetration_roll',
                    ricChance, incidentDeg: incidentAngle * 180 / Math.PI });
      return {
        type: 'wall', dist: tWall,
        x: ix, y: iy, wall: wallObj,
        barrierEvents: events,
        shotPen: shotState.pen, shotDamage: shotState.damage, segments,
        shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
        shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
        _origin: { x: ox, y: oy }, _dir: { nx, ny },
      };
    }
    // 관통 성공 — shotState 갱신 (누적 감쇠). SIDE-PATHLEN-ARMOR-1 §11: effectiveArmor 전달.
    const _wStabBefore = shotState.stability;
    const before = _applyBarrierLoss(shotState, wallMaterial, wallArmor);
    // WALL-AS-FULLCOVER-WOBBLE-RESTORE-1 §3: 벽을 관통 후 탄도 처리 면에서 fullCover/blocksLOS cover와 동일 계열로 취급.
    //   _applyBarrierLoss()가 깎은 shotState.stability 기준 legacy wobble. 벽 내부는 기존 방향, exit 이후부터 틀어짐.
    const post = applyLegacyPenetrationWobble(nx, ny, shotState);
    const wallNewNx = post.nx, wallNewNy = post.ny;
    const _exitT = rayBoxExitT(ox, oy, nx, ny, wallObj, maxDist);
    const _exitX = ox + nx * _exitT, _exitY = oy + ny * _exitT;
    const _wallSpent = _shotIsDead(shotState);
    events.push({ obj: wallObj, material: wallMaterial, outcome: 'penetrated',
                  x: ix, y: iy, exitX: _exitX, exitY: _exitY, nx: normal.nx, ny: normal.ny, isWall: true,
                  armor: wallEff.effectiveArmor, baseArmor: wallEff.baseArmor, effectiveArmor: wallEff.effectiveArmor,
                  armorPerMeter: +wallEff.armorPerMeter.toFixed(1), nominalThicknessM: +wallEff.nominalThicknessM.toFixed(3),
                  pathLenM: +wallEff.pathLenM.toFixed(3), pathRatio: +wallEff.pathRatio.toFixed(2), incidentDeg: wallIncidentDeg,
                  barrierPen, penProbability: +pPen.toFixed(3),
                  shotPenBefore: before.pen, shotPenAfter: shotState.pen,
                  shotVelocityBefore: before.vel, shotVelocityAfter: shotState.velocity,
                  shotStabilityBefore: before.stab, shotStabilityAfter: shotState.stability,
                  wobbleDeg: post.wobbleDeg, wobbleMagDeg: post.wobbleMagDeg,
                  exitNx: wallNewNx, exitNy: wallNewNy, wallAsCoverWobble: true,
                  before, after: { pen: shotState.pen, vel: shotState.velocity, dmg: shotState.damage, stab: shotState.stability },
                  barrierCount: shotState.barrierCount,
                  continued: !_wallSpent, reason: _wallSpent ? 'shot_spent_after_penetration' : undefined });
    if (_wallSpent) {
      return {
        type: 'wall', dist: tWall,
        x: ix, y: iy, wall: wallObj,
        barrierEvents: events,
        shotPen: shotState.pen, shotDamage: shotState.damage, segments,
        shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
        shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
        _origin: { x: ox, y: oy }, _dir: { nx, ny },
      };
    }
    // exit point — 벽 box 반대편에서 exit 이후 틀어진 방향(wallNewNx,wallNewNy)으로 출발
    const exitT = _exitT;
    const exitX = _exitX, exitY = _exitY;
    const remainDist = maxDist - exitT;
    const newExcluded = new Set(excluded); newExcluded.add(wallObj);
    const startX = exitX + wallNewNx * 0.9, startY = exitY + wallNewNy * 0.9;   // 틀어진 방향 + epsilon 0.9px (동일 벽 재시작 방지)
    shotState.travelDistPx = (shotState.travelDistPx || 0) + exitT;   // CLEANUP HOTFIX 2
    return raycastSegment(startX, startY, wallNewNx, wallNewNy, remainDist,
                          shotState, segments + 1, events, newExcluded, shooter);
  }

  // 장애물 — 관통/도탄 시도
  if (tMin === tCover && cov.obj && tCover < maxDist) {
    const obj = cov.obj;
    const ix = ox + nx * tCover, iy = oy + ny * tCover;
    const normal = aabbNormalAtEntry(obj, ix, iy);

    // === half cover 처리 ===
    //   사수가 이 cover에 1.5m 이내(=30px)면 넘겨쏘기 — cover 무시
    //   표적이 이 cover에 1.5m 이내 + cover 자세면 halfCoverHitChance로 결정
    //   둘 다 아니면 기존 50% pass-through fallback
    if (obj.halfHeight && !excluded.has(obj)) {
      // SIDE-HITLOC-COVER-EXPOSURE-1A: entry(사격자 쪽) / exit(표적 쪽) 분리
      const exitT = rayBoxExitT(ox, oy, nx, ny, obj, maxDist);
      const enterX = ix, enterY = iy;
      const exitX = ox + nx * exitT, exitY = oy + ny * exitT;
      const PX_M = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 20;
      const SMALL = 1.0;
      const recordPass = (outcome) => {
        if (!shotState.passedHalfCovers) shotState.passedHalfCovers = [];
        shotState.passedHalfCovers.push({ obj, enterX, enterY, exitX, exitY, outcome, material: obj.material, armor: obj.armor });
      };
      // === 사격자 쪽 넘겨쏘기: ray 시작점(=총구/ballisticOrigin)에서 cover entry까지 거리 기준 ===
      // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목5): shooter 중심 대신 ray origin(ox,oy=첫 세그먼트는 muzzleOrigin) 기준
      const SHOOTER_HALF_COVER_SKIP_DIST = 28;   // ~1.4m
      const shooterToCoverEntryDist = Math.hypot(ox - enterX, oy - enterY);
      const shooterStance = (shooter && typeof getEffectiveStance === 'function')
        ? getEffectiveStance(shooter) : (shooter ? shooter.stance : 'standing');
      // prone/downed/goingProne 금지. standing/crouched/cover/pinned 허용.
      const shooterProne = (shooterStance === 'prone' || shooterStance === 'goingProne' || shooterStance === 'downed' || (shooter && shooter.isDowned));
      const shooterCanSkip = (shooterToCoverEntryDist <= SHOOTER_HALF_COVER_SKIP_DIST) && !shooterProne;

      if (shooterCanSkip) {
        // 넘겨쏨 — ray 시작점을 exit 이후로 이동 (두꺼운 cover에서도 내부/entry에 남지 않음)
        const newExcluded = new Set(excluded); newExcluded.add(obj);
        const remainDist = maxDist - exitT;
        const startX = exitX + nx * SMALL, startY = exitY + ny * SMALL;
        events.push({ obj, material: obj.material, outcome: 'half_skip_shooter', x: enterX, y: enterY, exitX, exitY });
        recordPass('half_skip_shooter');
        shotState.travelDistPx = (shotState.travelDistPx || 0) + exitT;   // COVER-PEN-RESIDUAL-HOTFIX-1 §2
        return raycastSegment(startX, startY, nx, ny, remainDist,
                              shotState, segments, events, newExcluded, shooter);
      }

      // SIDE-HITLOC-COVER-INTERACTION-1B §7-2: 이 탄이 실제로 맞출 ray상 표적 후보 우선
      const remainAfterExit = maxDist - exitT;
      let rayTarget = null, rayTgtT = Infinity, rayHitX = null, rayHitY = null;
      for (const u of UNITS) {
        if (!u.alive) continue;
        if (shooter && u.team === shooter.team) continue;
        if (u === shooter) continue;
        const tu = (typeof intersectRayCircle === 'function') ? intersectRayCircle(exitX, exitY, nx, ny, u.x, u.y, UNIT_RADIUS) : Infinity;
        if (tu > 0 && tu <= remainAfterExit && tu < rayTgtT) { rayTgtT = tu; rayTarget = u; rayHitX = exitX + nx * tu; rayHitY = exitY + ny * tu; }
      }
      // fallback: cover 인근(≤3.2m) 적팀 엄폐 자세 (ray상 후보 없을 때만)
      const DETECT_PX = 64;   // 3.2m
      const cx = obj.x + obj.w/2, cy = obj.y + obj.h/2;
      let nearbyTarget = rayTarget;
      if (!nearbyTarget) {
        for (const u of UNITS) {
          if (!u.alive) continue;
          if (shooter && u.team === shooter.team) continue;
          if (u === shooter) continue;
          if (Math.hypot(u.x - cx, u.y - cy) > DETECT_PX) continue;
          const st = (typeof getEffectiveStance === 'function') ? getEffectiveStance(u) : (u.stance || 'standing');
          if (st === 'cover' || st === 'crouched' || st === 'pinned' || st === 'prone' || st === 'goingProne') { nearbyTarget = u; break; }
        }
      }

      if (nearbyTarget) {
        const tgtStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(nearbyTarget) : (nearbyTarget.stance || 'standing');
        if (tgtStance === 'prone' || tgtStance === 'goingProne' || tgtStance === 'downed') {
          // 엎드린 표적 + 부착 halfCover → direct hit 0%, cover 피격 경로
          events.push({ obj, material: obj.material, outcome: 'half_hit_cover', reason: 'target_prone_attached_halfcover_direct_blocked', x: enterX, y: enterY });
        } else {
          // === 거리 기반 차단 확률: exit point → (가능하면 ray hitbox 교점, 아니면 표적 중심) ===
          const tHitX = (rayTarget === nearbyTarget && rayHitX != null) ? rayHitX : nearbyTarget.x;
          const tHitY = (rayTarget === nearbyTarget && rayHitY != null) ? rayHitY : nearbyTarget.y;
          const distAfterCover = Math.hypot(exitX - tHitX, exitY - tHitY) / PX_M;
          let hitCoverP = (tgtStance === 'standing') ? 0.27 : (tgtStance === 'crouched') ? 0.62 : (tgtStance === 'pinned') ? 0.75 : 0.40;
          const distMul = distAfterCover < 0.6 ? 1.30 : distAfterCover < 1.5 ? 1.00 : distAfterCover < 3.0 ? 0.65 : 0.40;
          hitCoverP *= distMul;
          const aimQ = shooter && shooter._lastAimQuality != null ? shooter._lastAimQuality : 0;
          hitCoverP -= aimQ * 0.20;
          hitCoverP = Math.max(0.08, Math.min(0.90, hitCoverP));
          if (Math.random() > hitCoverP) {
            // 표적에게 직접 — cover 통과 (exit 이후로 이동)
            const newExcluded = new Set(excluded); newExcluded.add(obj);
            const remainDist = maxDist - exitT;
            const startX = exitX + nx * SMALL, startY = exitY + ny * SMALL;
            events.push({ obj, material: obj.material, outcome: 'half_over_target', x: enterX, y: enterY, exitX, exitY });
            recordPass('half_over_target');
            shotState.travelDistPx = (shotState.travelDistPx || 0) + exitT;   // COVER-PEN-RESIDUAL-HOTFIX-1 §2
            return raycastSegment(startX, startY, nx, ny, remainDist,
                                  shotState, segments, events, newExcluded, shooter);
          }
          events.push({ obj, material: obj.material, outcome: 'half_hit_cover', x: enterX, y: enterY });
        }
      } else {
        // 표적 미탐지 — fallback. 멀리 떨어진 표적은 cover가 미미한 장애물(통과 우세). 통과도 기록.
        if (Math.random() < 0.30) {
          events.push({ obj, material: obj.material, outcome: 'half_hit_cover', x: enterX, y: enterY });
        } else {
          const newExcluded = new Set(excluded); newExcluded.add(obj);
          const remainDist = maxDist - exitT;
          const startX = exitX + nx * SMALL, startY = exitY + ny * SMALL;
          events.push({ obj, material: obj.material, outcome: 'half_pass_fallback', x: enterX, y: enterY, exitX, exitY });
          recordPass('half_pass_fallback');
          shotState.travelDistPx = (shotState.travelDistPx || 0) + exitT;   // COVER-PEN-RESIDUAL-HOTFIX-1 §2
          return raycastSegment(startX, startY, nx, ny, remainDist,
                                shotState, segments, events, newExcluded, shooter);
        }
      }
    }

    // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1 §3/§8: 명시 절대차단(penetrable:false 등)만 early 정지. penetrable:true fullCover는 관통 판정으로 진행.
    const _covEarlyAbs = isBallisticAbsoluteStopper(obj);
    if (segments >= RAY_MAX_SEGMENTS || _covEarlyAbs || _shotIsDead(shotState)) {
      const _covEarlyReason = _covEarlyAbs ? 'absolute_stopper' : (segments >= RAY_MAX_SEGMENTS ? 'max_segments' : 'shot_dead');
      events.push({ obj, material: obj.material, outcome: 'stopped',
                    x: ix, y: iy, nx: normal.nx, ny: normal.ny,
                    armor: obj.armor, shotPenBefore: shotState.pen, reason: _covEarlyReason });
      return {
        type: 'cover', dist: tCover,
        x: ix, y: iy, cover: obj,
        barrierEvents: events,
        shotPen: shotState.pen, shotDamage: shotState.damage, segments,
        shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
        shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
        _origin: { x: ox, y: oy }, _dir: { nx, ny },
      };
    }
    // 관통 판정 — velocity 보정 반영. SIDE-PATHLEN-ARMOR-1 §9: 실제 통과 길이 기반 effectiveArmor.
    const coverMaterial = obj.material || 'wood';
    const _coverExitT = (cov && cov.exitT != null) ? cov.exitT : rayBoxExitT(ox, oy, nx, ny, obj, maxDist);
    const _coverIncAngle = getIncidentAngle(nx, ny, normal.nx, normal.ny);
    const coverIncidentDeg = _coverIncAngle * 180 / Math.PI;
    const coverEff = computeBarrierEffectiveArmor(obj, { entryT: tCover, exitT: _coverExitT, material: coverMaterial, incidentDeg: coverIncidentDeg });
    const coverArmor = coverEff.effectiveArmor;
    const velRatio = shotState.velocity / Math.max(1, shotState.initialVelocity);
    const velMul = 0.5 + 0.5 * velRatio;
    const barrierPen = shotState.pen * ammoBarrier.barrierPenMul * velMul;
    const diff = barrierPen - coverArmor;
    const pPen = penetrationProbability(diff);
    let penetrated = Math.random() < pPen;
    // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1 §3: fullCover/blocksLOS는 시야 속성일 뿐. penetrable:false 등 명시 절대차단만 강제 정지. concrete/steel은 armor 때문에 대부분 막히되 그건 재질 결과.
    const _covAbsStop = isBallisticAbsoluteStopper(obj);
    if (_covAbsStop) penetrated = false;

    if (!penetrated) {
      // === 도탄 시도 — 새 통합 시스템 ===
      const incidentAngle = getIncidentAngle(nx, ny, normal.nx, normal.ny);
      const matName = obj.material || 'wood';
      const ricChance = calcRicochetChance({
        incidentAngleRad: incidentAngle,
        material: matName,
        ammoBarrier: ammoBarrier,
        impactVel: shotState.velocity,
        initialVel: shotState.initialVelocity,
        effectivePen: barrierPen,
        barrierResistance: coverEff.effectiveArmor,   // SIDE-PATHLEN-ARMOR-1 §9
      });
      if (Math.random() < ricChance) {
        const rd = calcRicochetDirection(nx, ny, normal.nx, normal.ny, matName, ammoBarrier && ammoBarrier.barrierBehavior);
        const dec = getRicochetDecay(ammoBarrier);
        shotState.damage *= dec.dmg;
        shotState.pen *= dec.pen;
        shotState.velocity *= dec.vel;
        shotState.stability *= dec.stab;
        shotState.barrierCount += 1;
        const remainDist = maxDist - tCover;
        events.push({ obj, material: matName, outcome: 'ricochet', reason: _covAbsStop ? 'absolute_stopper' : 'ricochet',
                      x: ix, y: iy, nx: normal.nx, ny: normal.ny,
                      ricChance, incidentDeg: incidentAngle * 180 / Math.PI });
        const newExcluded = new Set(excluded); newExcluded.add(obj);
        const startX = ix + rd.nx * 1.5, startY = iy + rd.ny * 1.5;
        shotState.travelDistPx = (shotState.travelDistPx || 0) + (maxDist - remainDist);   // CLEANUP HOTFIX 2
        return raycastSegment(startX, startY, rd.nx, rd.ny, remainDist * 0.5,
                              shotState, segments + 1, events, newExcluded, shooter);
      }
      // 도탄도 실패 — 박힘 또는 소실 (frangible)
      const ammoB = getAmmoBallistic(ammoBarrier);
      const outcome = (ammoB.type === 'frangible' && Math.random() < 0.5) ? 'shattered' : 'stopped';
      events.push({ obj, material: matName, outcome,
                    x: ix, y: iy, nx: normal.nx, ny: normal.ny,
                    armor: coverEff.effectiveArmor, baseArmor: coverEff.baseArmor, effectiveArmor: coverEff.effectiveArmor,
                    armorPerMeter: +coverEff.armorPerMeter.toFixed(1), nominalThicknessM: +coverEff.nominalThicknessM.toFixed(3),
                    pathLenM: +coverEff.pathLenM.toFixed(3), pathRatio: +coverEff.pathRatio.toFixed(2),
                    shotPenBefore: shotState.pen, barrierPen, penProbability: +pPen.toFixed(3),
                    reason: _covAbsStop ? 'absolute_stopper' : 'failed_penetration_roll',
                    ricChance, incidentDeg: incidentAngle * 180 / Math.PI });
      return {
        type: 'cover', dist: tCover,
        x: ix, y: iy, cover: obj,
        barrierEvents: events,
        shotPen: shotState.pen, shotDamage: shotState.damage, segments,
        shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
        shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
        _origin: { x: ox, y: oy }, _dir: { nx, ny },
      };
    }

    // 관통 성공 — shotState 갱신 (누적 감쇠)
    const exitT = cov.exitT;
    const ex = ox + nx * exitT, ey = oy + ny * exitT;
    const _cStabBefore = shotState.stability;
    const before = _applyBarrierLoss(shotState, coverMaterial, coverEff.effectiveArmor);   // SIDE-PATHLEN-ARMOR-1 §11: effectiveArmor (유지)
    // WALL-AS-FULLCOVER-WOBBLE-RESTORE-1 §2: 구버전 cover wobble 공식을 공용 helper 호출로만 교체 (동작 동일).
    //   손실 입력 armor는 coverEff.effectiveArmor(pathLen 유지). outcome:'penetrated'일 때만 wobble.
    const post = applyLegacyPenetrationWobble(nx, ny, shotState);
    const newNx = post.nx, newNy = post.ny;
    const wobble = post.wobbleRad;
    events.push({ obj, material: coverMaterial, outcome: 'penetrated',
                  x: ix, y: iy, exitX: ex, exitY: ey,
                  nx: normal.nx, ny: normal.ny,
                  armor: coverEff.effectiveArmor, baseArmor: coverEff.baseArmor, effectiveArmor: coverEff.effectiveArmor,
                  armorPerMeter: +coverEff.armorPerMeter.toFixed(1), nominalThicknessM: +coverEff.nominalThicknessM.toFixed(3),
                  pathLenM: +coverEff.pathLenM.toFixed(3), pathRatio: +coverEff.pathRatio.toFixed(2), incidentDeg: coverIncidentDeg,
                  barrierPen, penProbability: +pPen.toFixed(3),
                  shotPenBefore: before.pen, shotPenAfter: shotState.pen,
                  shotVelocityBefore: before.vel, shotVelocityAfter: shotState.velocity,
                  shotStabilityBefore: _cStabBefore, shotStabilityAfter: shotState.stability,
                  wobbleDeg: post.wobbleDeg, wobbleMagDeg: post.wobbleMagDeg,
                  before,
                  after: { pen: shotState.pen, vel: shotState.velocity, dmg: shotState.damage, stab: shotState.stability },
                  barrierCount: shotState.barrierCount, continued: true });
    // SIDE-HITLOC-COVER-INTERACTION-1B: halfHeight cover 관통 → penetratedHalfCovers 기록 (passedHalfCovers와 분리)
    if (obj.halfHeight) {
      if (!shotState.penetratedHalfCovers) shotState.penetratedHalfCovers = [];
      shotState.penetratedHalfCovers.push({
        obj, enterX: ix, enterY: iy, exitX: ex, exitY: ey,
        material: coverMaterial, armor: coverEff.effectiveArmor,
        baseArmor: coverEff.baseArmor, effectiveArmor: coverEff.effectiveArmor,
        pathLenM: coverEff.pathLenM, pathRatio: coverEff.pathRatio,
        before: { pen: before.pen, velocity: before.vel, damage: before.dmg, stability: before.stab },
        after: { pen: shotState.pen, velocity: shotState.velocity, damage: shotState.damage, stability: shotState.stability },
        barrierCount: shotState.barrierCount, wobbleDeg: +(wobble * 180 / Math.PI).toFixed(1),
        outcome: 'half_cover_penetrated',
      });
    }
    const newExcluded = new Set(excluded); newExcluded.add(obj);
    const remainDist = maxDist - exitT;
    shotState.travelDistPx = (shotState.travelDistPx || 0) + exitT;   // COVER-PEN-RESIDUAL-HOTFIX-1 §1: cover 관통 후 총 비행거리 누적
    if (remainDist <= 0 || _shotIsDead(shotState)) {
      return {
        type: 'cover', dist: exitT,
        x: ex, y: ey, cover: obj,
        barrierEvents: events,
        shotPen: shotState.pen, shotDamage: shotState.damage, segments,
        shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
        shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
        _origin: { x: ox, y: oy }, _dir: { nx, ny },
      };
    }
    return raycastSegment(ex + newNx * 0.5, ey + newNy * 0.5, newNx, newNy, remainDist,
                          shotState, segments + 1, events, newExcluded, shooter);
  }

  return {
    type: 'none', dist: maxDist,
    x: ox + nx * maxDist, y: oy + ny * maxDist,
    barrierEvents: events,
    shotPen: shotState.pen, shotDamage: shotState.damage, segments,
    shotVelocity: shotState.velocity, shotInitialVelocity: shotState.initialVelocity,
    shotStability: shotState.stability, shotBarrierCount: shotState.barrierCount,
    _origin: { x: ox, y: oy }, _dir: { nx, ny },
  };
}

// 미래 확장용 — 표적 facing 기준으로 탄이 들어온 방향이 front/side/rear 중 어느 쪽인지
//   현재 부위 테이블에는 적용하지 않음. 결과에 result.hitAspect로만 저장.
function getHitAspect(shooter, target) {
  // 표적 입장에서: shooter 방향 - target.facing
  //   rel < 45°: front
  //   rel > 135°: rear
  //   그 외: left/right로 분리 (cross product 부호로 판단)
  const angToShooter = Math.atan2(shooter.y - target.y, shooter.x - target.x);
  const rel = angleDiff(angToShooter, target.facing);
  const absRel = Math.abs(rel);
  if (absRel <  Math.PI / 4)            return 'front';
  if (absRel >  Math.PI * 3 / 4)        return 'rear';
  // 측면 — 양수면 target 기준 좌측 (반시계), 음수면 우측
  //   atan2가 반시계가 양수이므로, target 입장에선 화면 위쪽이 facing이면
  //   양수 rel은 target의 왼쪽
  return rel > 0 ? 'left' : 'right';
}

// =============================================================
