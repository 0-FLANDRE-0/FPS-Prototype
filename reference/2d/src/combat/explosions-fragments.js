// 섬광 — 지각을 때린다
// =============================================================
//   프래그가 몸을 때린다면 섬광은 **감각**을 때린다. 그래서 세기가 거리만으로 정해지지 않는다:
//     · 벽 뒤면 아무 일도 없다 (빛은 모퉁이를 돌지 않는다 — 소리는 조금 돈다)
//     · 그쪽을 보고 있었으면 훨씬 심하다
//     · 훈련된 대원은 덜 당한다 (터지기 전에 고개를 돌린다)
//   그리고 이 프로젝트에서 새로운 부분: **눈이 멀면 지형 학습이 멈춘다.**
//   지금까지 믿음이 낡는 건 시간 때문이었는데, 여기서 처음으로 남이 그걸 만든다.
const USE_FLASHBANG = true;
function isFlashbangOn() {
  if (typeof GAME !== 'undefined' && GAME.flashbangOn != null) return !!GAME.flashbangOn;
  return USE_FLASHBANG;
}
const FLASH_FACING_MIN = 0.35;   // 등지고 있어도 이만큼은 당한다 (주변시·반사광)
const FLASH_DEAF_WALL  = 0.45;   // 벽 뒤에서도 폭음은 이만큼 들린다

// 이 폭발이 이 유닛의 감각을 얼마나 마비시키나. 0이면 아무 일도 없다.
//   반환: { blind, deaf, sup, dM, losBlocked, facing }
function flashEffectOn(preset, ex, ey, unit) {
  const rM = preset.flashRadius || 8.0;
  const dM = Math.hypot(unit.x - ex, unit.y - ey) / PX_PER_M_FALLBACK;
  if (dM > rM) return null;
  const falloff = 1 - dM / rM;                       // 선형 — 가까울수록 강하다
  const losBlocked = (typeof isLOSBlockedForBlast === 'function')
    ? isLOSBlockedForBlast(ex, ey, unit.x, unit.y) : false;
  // 어느 쪽을 보고 있었나 — 폭발 쪽을 정면으로 보면 1, 등지면 0
  const toBurst = Math.atan2(ey - unit.y, ex - unit.x);
  const align = Math.max(0, Math.cos((typeof angleDelta === 'function')
    ? angleDelta(unit.facing || 0, toBurst) : ((unit.facing || 0) - toBurst)));
  const facing = FLASH_FACING_MIN + (1 - FLASH_FACING_MIN) * align;
  // 훈련도 — getReactionProfile의 detectRangeMul을 그대로 쓴다(잘 볼수록 미리 대비한다)
  const prof = (typeof getReactionProfile === 'function') ? getReactionProfile(unit) : { detectRangeMul: 0.85 };
  const trained = 1 - Math.max(0, Math.min(0.45, (prof.detectRangeMul - 0.65) * 0.9));
  // 빛은 모퉁이를 안 돈다 — 벽 뒤면 실명 0. 소리는 조금 돈다.
  const blind = losBlocked ? 0 : (preset.flashBlindMax || 5.0) * falloff * facing * trained;
  const deaf  = (preset.flashDeafMax || 7.0) * falloff * trained * (losBlocked ? FLASH_DEAF_WALL : 1);
  const sup   = (preset.flashSuppression || 45) * falloff * (losBlocked ? 0.5 : 1);
  return { blind, deaf, sup, dM, losBlocked, facing: align };
}

function applyFlashEffect(preset, ex, ey, thrower) {
  if (!isFlashbangOn()) return;
  const list = (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) ? UNITS : (GAME.units || []);
  GAME.fxList.push({ type: 'explosion', x: ex, y: ey, life: 0.25, maxLife: 0.25,
                     radius: (preset.flashRadius || 8) * PX_PER_M_FALLBACK * 0.5,
                     team: thrower ? thrower.team : 'friend' });
  let hit = 0;
  for (const u of list) {
    if (!u.alive || u.isDead) continue;
    const e = flashEffectOn(preset, ex, ey, u);
    if (!e) continue;
    if (e.blind > 0.05) u.flashBlindTimer = Math.max(u.flashBlindTimer || 0, e.blind);
    if (e.deaf > 0.05)  u.flashDeafTimer  = Math.max(u.flashDeafTimer  || 0, e.deaf);
    if (e.sup > 0) u.suppression = Math.min(100, (u.suppression || 0) + e.sup);
    if (e.blind > 0.05 || e.deaf > 0.05) {
      hit++;
      GAME._flashHits = (GAME._flashHits || 0) + 1;
      if (u.team === 'friend') {
        log(`[${u.name}] 섬광 — ${e.blind > 0.05 ? '시야 상실 ' + e.blind.toFixed(1) + '초' : '이명'}`, 'danger');
      }
    }
  }
  GAME._flashDetonations = (GAME._flashDetonations || 0) + 1;
  return hit;
}
// 눈이 멀었나 / 귀가 먹었나 — 소비처가 공유하는 단일 질문
function isFlashBlinded(unit) { return isFlashbangOn() && !!unit && (unit.flashBlindTimer || 0) > 0; }
function isFlashDeafened(unit) { return isFlashbangOn() && !!unit && (unit.flashDeafTimer || 0) > 0; }

function detonateThrowable(throwableId, ex, ey, thrower) {
  const preset = THROWABLE_PRESETS[throwableId];
  if (!preset) return;

  // === 연막 — 폭발이 아니다. 폭발 FX/먼지보다 **먼저** 갈라져야 한다 ===
  //   섬광은 폭발 FX를 지나간 뒤 분기하는데, 그건 실제로 폭음과 섬광이 있기 때문이다.
  //   연막은 터지는 게 아니라 피어오른다.
  if (preset.type === 'smoke') {
    if (isSmokeOn()) {
      spawnSmokeCloud(ex, ey, { radiusM: preset.smokeRadius, density: preset.smokeDensity,
                                life: preset.smokeDuration });
      GAME._smokeDetonations = (GAME._smokeDetonations || 0) + 1;
    }
    emitNoise(ex, ey, { type: 'impact', team: thrower ? thrower.team : 'friend',
                        sourceUnitId: thrower ? thrower.id : null });
    return;
  }

  // === FX: 폭발 시각화 ===
  GAME.fxList.push({
    type: 'explosion', x: ex, y: ey,
    life: 0.45, maxLife: 0.45,
    radius: (preset.blastRadiusOuter || 5) * PX_PER_M_FALLBACK,
    team: thrower ? thrower.team : 'friend',
  });
  // SIDE-DUST-CLOUD-VISUAL-1: 폭발 먼지 (≥8 cloud, 바닥+주변 구조물 반영, 벽 클리핑)
  if (typeof emitDustFromAction === 'function') {
    const _blastPx = (preset.blastRadiusOuter || 5) * PX_PER_M_FALLBACK;
    const _isGren = (preset.type === 'frag' || preset.type === 'he' || preset.type === 'fragmentation');   // SIDE-VISUAL-UNIT-GRENADE-DUST-HOTFIX-1: 수류탄 = grenade 먼지 프로파일
    emitDustFromAction('explosion', ex, ey, { blastRadius: Math.max(50, _blastPx * 0.9), power: (preset.type === 'frag' ? 1.3 : 1.0), isGrenade: _isGren });
  }

  // === 섬광 — 살상이 아니라 지각을 때린다 ===
  if (preset.type === 'flash') { applyFlashEffect(preset, ex, ey, thrower); return; }

  // === 폭압/충격 처리 — 유닛별 반경 검사 ===
  if (preset.type === 'frag') {
    const lethalPx = preset.blastRadiusLethal * PX_PER_M_FALLBACK;
    const innerPx  = preset.blastRadiusInner  * PX_PER_M_FALLBACK;
    const outerPx  = preset.blastRadiusOuter  * PX_PER_M_FALLBACK;
    for (const u of UNITS) {
      if (!u.alive || u.isDead) continue;
      const d = Math.hypot(u.x - ex, u.y - ey);
      if (d > outerPx) continue;
      // LOS 차단 (벽 / fullCover) — 폭압은 벽에 막힘
      const losBlocked = isLOSBlockedForBlast(ex, ey, u.x, u.y);
      if (d <= lethalPx && !losBlocked) {
        applyBlastDamage(u, 0.55, 'lethal', thrower, ex, ey);
      } else if (d <= innerPx) {
        applyBlastDamage(u, losBlocked ? 0.10 : 0.30, 'inner', thrower, ex, ey);
      } else if (d <= outerPx) {
        applyBlastDamage(u, losBlocked ? 0.05 : 0.15, 'outer', thrower, ex, ey);
      }
    }
    // === 파편 raycast ===
    spawnFragments(ex, ey, preset, thrower);
    // 인근 유닛의 AI 메모리에 danger point 등록 (15초 유지)
    if (typeof ensureAIMemory === 'function' && Array.isArray(GAME.units)) {
      const dangerPx = (preset.fragmentRadius || 18) * PX_PER_M_FALLBACK * 1.5;
      const now = GAME.gameTime || 0;
      for (const u of GAME.units) {
        if (u.isDead) continue;
        if (Math.hypot(u.x - ex, u.y - ey) > dangerPx) continue;
        const mem = ensureAIMemory(u);
        if (!mem.dangerPoints) mem.dangerPoints = [];
        mem.dangerPoints.push({ x: ex, y: ey, type: 'explosion', time: now });
        while (mem.dangerPoints.length > 8) mem.dangerPoints.shift();
      }
    }
  }

  // 소음 이벤트
  if (typeof emitNoise === 'function') {
    emitNoise(ex, ey, {
      type: 'gunshot',   // 큰 소음 — 폭발 별도 type이 없으면 gunshot 대체
      team: thrower ? thrower.team : null,
      sourceUnitId: thrower ? thrower.id : null,
      intensityMul: 3.0,
    });
  }
  log(`💥 ${preset.shortName || preset.name} 폭발`, 'warn');
}

// LOS 차단 — 벽/blocksLOS cover 사이에 있으면 폭압 감소
function isLOSBlockedForBlast(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return false;
  const nx = dx / len, ny = dy / len;
  // 벽 검사
  if (typeof rayDistToWalls === 'function') {
    const w = rayDistToWalls(x1, y1, nx, ny, len);
    if (w.t < len - 1) return true;
  }
  // blocksLOS cover 검사
  if (MAP_DATA && MAP_DATA.coverObjects) {
    for (const o of MAP_DATA.coverObjects) {
      if (o.blocksLOS !== true) continue;
      if (typeof rayBoxT === 'function') {
        const t = rayBoxT(x1, y1, nx, ny, o, len);
        if (t < len - 1) return true;
      }
    }
  }
  return false;
}

// 폭압 피해 적용
function applyBlastDamage(u, intensity, tier, thrower, ex, ey) {
  // intensity: 0~1, 폭심 가까울수록 높음
  let blastMul = 1.0;
  if (u.stance === 'prone' && !u.isDowned && ex != null && ey != null) {
    const distM = Math.hypot(u.x - ex, u.y - ey) / PX_PER_M_FALLBACK;
    blastMul = getProneBlastMul(distM);
  }
  const baseDmg = intensity * 90 * blastMul;
  const basePain = intensity * 60 * blastMul;
  // === 2A-1: blast impactAddress (방향 추정, 정밀 관통 X) ===
  function buildBlastImpactAddress(part) {
    let impactSide = 'omni';
    if (ex != null && ey != null) {
      const dx = ex - u.x, dy = ey - u.y;
      const ang = Math.atan2(dy, dx);   // 폭심 방향
      const facing = u.facing != null ? u.facing : 0;
      let rel = ang - facing;
      while (rel > Math.PI) rel -= Math.PI*2;
      while (rel < -Math.PI) rel += Math.PI*2;
      const a = Math.abs(rel);
      if (a < Math.PI*0.25) impactSide = 'front';
      else if (a > Math.PI*0.75) impactSide = 'rear';
      else impactSide = (rel > 0) ? 'right' : 'left';
    }
    const anat = (typeof pickAnatomyCandidates === 'function')
      ? pickAnatomyCandidates(locationToImpactPart(part), impactSide, 'blastArea', null)
      : { anatomicalZone: null, organCandidates: [], structureCandidates: [] };
    return {
      sourceModel: 'blast_area_wrapped',
      hitPart: locationToImpactPart(part), impactSide,
      stance: normalizeStance(u.stance),
      armorLayer: 'blast', coverageZone: 'blastArea',
      plateShape: null, plateLocation: null, edgeLocation: null,
      softLocation: null, exposedLocation: null,
      accessoryType: null, helmetZone: null, faceLocation: null, limbLocation: null, neckLocation: null,
      anatomicalZone: anat.anatomicalZone, organCandidates: anat.organCandidates, structureCandidates: anat.structureCandidates,
      armorResult: 'absorbed', penetrationResult: 'absorbed',
      ricochetHint: null, spallHint: null, crackHint: null,
      material: null, baseCoverage: null, transformedCoverage: null,
      blastInfo: { tier, intensity: +intensity.toFixed(2), blastMul: +blastMul.toFixed(2) },
      anatomicalClass: (part === 'chest' || part === 'abdomen') ? 'torso' : 'torso',
      junctionClass: 'none',
      aarLabel: `${({front:'정면',rear:'후면',left:'좌측',right:'우측',omni:'전방위'}[impactSide]||impactSide)} 폭압 / ${({chest:'흉부',abdomen:'복부'}[part]||part)}`,
      debugLabel: `blast/${impactSide} ${part}`,
    };
  }
  // === Medical applyDamageEvent로 통합 ===
  //   폭압 — 주로 흉부/복부 내부 손상 + 쇼크
  if (u.medical) {
    // 여러 부위에 약하게 분산 (chest 위주)
    const dist2 = (ex != null) ? Math.hypot(u.x - ex, u.y - ey) / PX_PER_M_FALLBACK : 2.0;
    const chestIA = buildBlastImpactAddress('chest');
    applyDamageEvent(u, {
      sourceType: 'blast',
      blastType: tier === 'lethal' ? 'directBlast' : 'legacyExplosion',
      hitPart: 'chest',
      rawDamage: baseDmg,
      tissueDamage: baseDmg * 0.5,
      armorResult: 'absorbed',
      bluntTrauma: baseDmg * 0.6,
      shockRisk: 0.8 * intensity,
      bleedRisk: 0.4 * intensity,
      painAmount: basePain,
      distance: dist2,
      impactAddress: chestIA,
    });
    if (thrower) recordImpactEvent(thrower, u, chestIA, { sourceType:'blast',
      medicalSummaryAfter: u.medical ? { lifeStatus: u.medical.lifeStatus } : null });
    // 추가로 abdomen에도 약한 영향
    if (intensity > 0.5) {
      const abdIA = buildBlastImpactAddress('abdomen');
      applyDamageEvent(u, {
        sourceType: 'blast',
        blastType: 'directBlast',
        hitPart: 'abdomen',
        rawDamage: baseDmg * 0.4,
        tissueDamage: baseDmg * 0.2,
        armorResult: 'absorbed',
        bluntTrauma: baseDmg * 0.3,
        shockRisk: 0.5 * intensity,
        bleedRisk: 0.3 * intensity,
        painAmount: basePain * 0.5,
        distance: dist2,
        impactAddress: abdIA,
      });
    }
  } else {
    // medical 없음 — fallback
    if (u.bodyHp && u.bodyHp.chest != null) {
      u.bodyHp.chest = Math.max(0, u.bodyHp.chest - baseDmg);
    }
    u.hp = Math.max(0, u.hp - baseDmg);
    if (typeof addPain === 'function') addPain(u, basePain);
  }
  // downed/dead는 syncLegacyCombatState가 처리 (medical 있음)
  const proneTag = u.stance === 'prone' ? ' [prone]' : '';
  log(`[${u.name}] 폭압 (${tier}${proneTag}) — pain +${basePain.toFixed(0)} dmg ${baseDmg.toFixed(0)}`,
      tier === 'lethal' ? 'danger' : 'warn');
}

// === 파편 생성 + raycast ===
// =============================================================
// SIDE-FRAGMENT-MASS-ENERGY-DAMAGE-BRIDGE-1: 파편 질량 예산제 + 운동에너지 기반 피해 브리지
//   새 파편 시스템 생성 아님 — 기존 수류탄/12.7mm micro/강철 스폴 파편 흐름에 질량·에너지 메타 + base값과 blend.
//   질량 보존: 개별 난수 무한생성 금지, source 위험질량 예산을 나눠 가짐(총합 ≤ 예산).
//   에너지 실사용: fragmentEnergyJ로 equivalentDamage/equivalentPenetration 산출(blend+clamp), 표시용으로 끝내지 않음.
// =============================================================
const FRAGMENT_SOURCE_BUDGETS = {
  grenade_m67:  { totalSourceMassG:410, hazardousFragmentMassBudgetG:150, massShare:{ small:0.40, medium:0.42, large:0.18 }, shapeFactor:0.78, stabilityFactor:0.72, energyWeight:0.52 },
  grenade_rgd5: { totalSourceMassG:336, hazardousFragmentMassBudgetG:110, massShare:{ small:0.36, medium:0.44, large:0.20 }, shapeFactor:0.76, stabilityFactor:0.70, energyWeight:0.50 },
};
const FRAGMENT_ENERGY_CLASS_THRESHOLDS = {
  grenade:           { trace:5, low:20, moderate:80, high:180 },
  micro_explosive:   { trace:2, low:10, moderate:40, high:100 },
  armor_spall_steel: { trace:1, low:5,  moderate:20, high:50  },
};
function _fragEnergyFamily(sourceType) {
  if (sourceType === 'micro_explosive') return 'micro_explosive';
  if (sourceType === 'armor_spall_steel') return 'armor_spall_steel';
  return 'grenade';
}
function classifyFragmentEnergy(energyJ, sourceType) {
  const t = FRAGMENT_ENERGY_CLASS_THRESHOLDS[_fragEnergyFamily(sourceType)] || FRAGMENT_ENERGY_CLASS_THRESHOLDS.grenade;
  if (energyJ < t.trace) return 'trace';
  if (energyJ < t.low) return 'low';
  if (energyJ < t.moderate) return 'moderate';
  if (energyJ < t.high) return 'high';
  return 'severe';
}
function computeFragmentEnergyJ(massG, velMps) {
  const kg = Math.max(0, massG) / 1000;
  return 0.5 * kg * velMps * velMps;
}
// source 위험 파편 질량 예산 구성
function buildFragmentMassBudget(sourceInfo) {
  const st = sourceInfo.sourceType || 'grenade';
  const cfg = (sourceInfo.presetId && FRAGMENT_SOURCE_BUDGETS[sourceInfo.presetId]) || null;
  let totalSourceMassG, hazardousFragmentMassBudgetG, massShare, shapeFactor, stabilityFactor, energyWeight;
  if (cfg) {
    totalSourceMassG = sourceInfo.weightKg ? sourceInfo.weightKg * 1000 : cfg.totalSourceMassG;
    hazardousFragmentMassBudgetG = cfg.hazardousFragmentMassBudgetG;
    massShare = cfg.massShare; shapeFactor = cfg.shapeFactor; stabilityFactor = cfg.stabilityFactor; energyWeight = cfg.energyWeight;
  } else if (st === 'micro_explosive') {
    const pm = sourceInfo.projectileMassG || 43;       // 12.7mm ~43g
    const isHEIAP = !!sourceInfo.isHEIAP;
    // secondaryFragmentMassBudgetG << projectileMassG. HEIAP는 관통자 보존 → 더 보수적.
    hazardousFragmentMassBudgetG = isHEIAP ? Math.min(3.2, pm * 0.055) : Math.min(4.1, pm * 0.085);
    totalSourceMassG = pm; massShare = { small:0.45, medium:0.40, large:0.15 };
    shapeFactor = 0.58; stabilityFactor = 0.55; energyWeight = 0.38;
  } else if (st === 'armor_spall_steel') {
    hazardousFragmentMassBudgetG = (sourceInfo.budgetG != null) ? sourceInfo.budgetG : 0.30;   // 0.05~0.60g 수준
    totalSourceMassG = sourceInfo.plateMassG || 100; massShare = { small:0.50, medium:0.35, large:0.15 };
    shapeFactor = 0.32; stabilityFactor = 0.32; energyWeight = 0.22;
  } else {
    totalSourceMassG = (sourceInfo.weightKg || 0.4) * 1000;
    hazardousFragmentMassBudgetG = totalSourceMassG * 0.37; massShare = { small:0.40, medium:0.42, large:0.18 };
    shapeFactor = 0.6; stabilityFactor = 0.6; energyWeight = 0.5;
  }
  // 안전: 예산은 총질량보다 훨씬 작아야
  hazardousFragmentMassBudgetG = Math.min(hazardousFragmentMassBudgetG, totalSourceMassG * 0.6);
  return { totalSourceMassG:+totalSourceMassG.toFixed(1), hazardousFragmentMassBudgetG:+hazardousFragmentMassBudgetG.toFixed(2),
    massShare, shapeFactor, stabilityFactor, energyWeight, sourceType:st, presetId:sourceInfo.presetId || null,
    physicalFragmentCount: sourceInfo.fragmentCount || 0, generatedFragmentMassTotalG:0, massBudgetMode:'physical_fragments' };
}
// tier(또는 size) 내 개별 파편 질량 배분 — randomWeight 기반, 총합 = tierMassBudgetG (예산 초과 불가)
function allocateTierFragmentMasses(count, tierMassBudgetG) {
  if (count <= 0 || tierMassBudgetG <= 0) return [];
  const w = []; let sum = 0;
  for (let i = 0; i < count; i++) { const x = 0.5 + Math.random(); w.push(x); sum += x; }
  return w.map(x => tierMassBudgetG * x / sum);
}
// 에너지 기반 피해 브리지 — base값과 energy값 blend + source clamp (1:1 대입 금지, spall 상향 금지)
// SIDE-FRAGMENT-CLUSTER-TRAIT-MATERIAL-SPALL-1: 파편별 성격 계수 + 재질별 스폴 특성
const FRAGMENT_TRAIT_PROFILES = {
  // shapeFactor=피해 전환 효율, stabilityFactor=관통 전환 효율, sharpness=출혈/열창 성향, dragFactor=거리/잔여속도 감쇠, tumblingChance=관통↓·표재/출혈 전환
  grenade:         { shapeFactor:0.78, stabilityFactor:0.60, sharpness:0.62, dragFactor:0.70, tumblingChance:0.55 },
  micro_explosive: { shapeFactor:0.52, stabilityFactor:0.40, sharpness:0.50, dragFactor:0.90, tumblingChance:0.66 },
  armor_spall:     { shapeFactor:0.32, stabilityFactor:0.32, sharpness:0.45, dragFactor:0.80, tumblingChance:0.70 },
};
// 재질별 스폴 특성 — spallChanceMul=steel 기준 확률 배수, sharpness=절상 성향, massBudgetMul/fragmentCountMul=질량·개수 배수, dmg/penClampMax=상한(≤1.0, 상향 금지), deepRisk=깊은 손상 성향(낮게)
const SPALL_MATERIAL_PROFILES = {
  steel:     { spallChanceMul:1.00, sharpness:0.78, massBudgetMul:1.00, fragmentCountMul:1.00, dmgClampMax:1.00, penClampMax:1.00, deepRisk:0.15 },
  ceramic:   { spallChanceMul:0.80, sharpness:0.45, massBudgetMul:0.70, fragmentCountMul:1.55, dmgClampMax:0.92, penClampMax:0.82, deepRisk:0.08 },
  aramid:    { spallChanceMul:0.22, sharpness:0.32, massBudgetMul:0.45, fragmentCountMul:0.60, dmgClampMax:0.78, penClampMax:0.66, deepRisk:0.03, bluntBias:true },
  pe:        { spallChanceMul:0.10, sharpness:0.28, massBudgetMul:0.35, fragmentCountMul:0.50, dmgClampMax:0.68, penClampMax:0.58, deepRisk:0.02, bluntBias:true },
  aluminum:  { spallChanceMul:0.62, sharpness:0.55, massBudgetMul:0.78, fragmentCountMul:1.10, dmgClampMax:0.88, penClampMax:0.74, deepRisk:0.07 },
  titanium:  { spallChanceMul:0.55, sharpness:0.70, massBudgetMul:0.84, fragmentCountMul:0.90, dmgClampMax:0.94, penClampMax:0.90, deepRisk:0.10 },
  composite: { spallChanceMul:0.58, sharpness:0.50, massBudgetMul:0.74, fragmentCountMul:1.00, dmgClampMax:0.90, penClampMax:0.80, deepRisk:0.07 },
  glass:     { spallChanceMul:0.78, sharpness:0.66, massBudgetMul:0.62, fragmentCountMul:1.50, dmgClampMax:0.92, penClampMax:0.80, deepRisk:0.06 },
};
function getSpallProfileForMaterial(material) {
  const m = (material || 'steel').toString().toLowerCase();
  let key = 'steel';
  if (m.indexOf('steel') >= 0 || m.indexOf('강철') >= 0) key = 'steel';
  else if (m.indexOf('ceramic') >= 0 || m.indexOf('alumina') >= 0 || m.indexOf('sic') >= 0 || m.indexOf('b4c') >= 0 || m.indexOf('세라믹') >= 0) key = 'ceramic';
  else if (m.indexOf('aramid') >= 0 || m.indexOf('kevlar') >= 0 || m.indexOf('twaron') >= 0 || m.indexOf('아라미드') >= 0) key = 'aramid';
  else if (m === 'pe' || m.indexOf('uhmwpe') >= 0 || m.indexOf('hdpe') >= 0 || m.indexOf('dyneema') >= 0 || m.indexOf('spectra') >= 0 || m.indexOf('polyethylene') >= 0) key = 'pe';
  else if (m.indexOf('alumin') >= 0) key = 'aluminum';
  else if (m.indexOf('titan') >= 0) key = 'titanium';
  else if (m.indexOf('glass') >= 0 || m.indexOf('polycarb') >= 0 || m.indexOf('유리') >= 0) key = 'glass';
  else if (m.indexOf('composite') >= 0 || m.indexOf('복합') >= 0) key = 'composite';
  return Object.assign({ spallMaterialType: key }, SPALL_MATERIAL_PROFILES[key] || SPALL_MATERIAL_PROFILES.steel);
}
// 파편 성격 프로파일 — source + (스폴이면 재질) 반영
function getFragmentTraitProfile(sourceType, material) {
  const st = sourceType || 'grenade';
  if (st === 'armor_spall' || st === 'armor_spall_steel' || st.indexOf('spall') >= 0) {
    const sp = getSpallProfileForMaterial(material);
    const t = FRAGMENT_TRAIT_PROFILES.armor_spall;
    return { source:'armor_spall', spallMaterialType: sp.spallMaterialType,
      shapeFactor: t.shapeFactor, stabilityFactor: t.stabilityFactor, sharpness: sp.sharpness, dragFactor: t.dragFactor, tumblingChance: t.tumblingChance,
      dmgClampMax: sp.dmgClampMax, penClampMax: sp.penClampMax, deepRisk: sp.deepRisk, bluntBias: !!sp.bluntBias,
      spallChanceMul: sp.spallChanceMul, massBudgetMul: sp.massBudgetMul, fragmentCountMul: sp.fragmentCountMul };
  }
  const fam = (st === 'micro_explosive') ? 'micro_explosive' : 'grenade';
  const t = FRAGMENT_TRAIT_PROFILES[fam];
  return { source: fam, spallMaterialType: null, shapeFactor: t.shapeFactor, stabilityFactor: t.stabilityFactor, sharpness: t.sharpness, dragFactor: t.dragFactor, tumblingChance: t.tumblingChance };
}
function computeFragmentEnergyDamageBridge(baseDamage, basePen, baseBleed, massG, velMps, sourceType, shapeFactor, stabilityFactor, traitProfile) {
  const fam = _fragEnergyFamily(sourceType);
  const energyJ = computeFragmentEnergyJ(massG, velMps);
  const energyClass = classifyFragmentEnergy(energyJ, fam);
  const tp = traitProfile || null;
  const shape = (tp && tp.shapeFactor != null) ? tp.shapeFactor : (shapeFactor != null ? shapeFactor : 0.6);
  const stab = (tp && tp.stabilityFactor != null) ? tp.stabilityFactor : (stabilityFactor != null ? stabilityFactor : 0.6);
  const sharpness = (tp && tp.sharpness != null) ? tp.sharpness : 0.5;
  const tumbling = (tp && tp.tumblingChance != null) ? tp.tumblingChance : 0.0;
  const drag = (tp && tp.dragFactor != null) ? tp.dragFactor : 0.0;
  let dmgCoef, penCoef, ew, dC, pC, bC;
  if (fam === 'grenade')              { dmgCoef = 0.42; penCoef = 0.50; ew = 0.52; dC = [0.70, 1.45]; pC = [0.75, 1.40]; bC = [0.78, 1.35]; }
  else if (fam === 'micro_explosive') { dmgCoef = 0.50; penCoef = 0.55; ew = 0.38; dC = [0.70, 1.25]; pC = [0.70, 1.25]; bC = [0.75, 1.20]; }
  else                                { dmgCoef = 0.30; penCoef = 0.30; ew = 0.22; dC = [0.50, 1.00]; pC = [0.45, 1.00]; bC = [0.50, 1.00]; }   // spall: max 1.0 (상향 금지)
  // 재질별 스폴 상한 강화 (약한 재질일수록 낮은 천장 — 상향 금지)
  if (tp && tp.dmgClampMax != null) dC = [dC[0], Math.min(dC[1], tp.dmgClampMax)];
  if (tp && tp.penClampMax != null) pC = [pC[0], Math.min(pC[1], tp.penClampMax)];
  const sqrtE = Math.sqrt(Math.max(0, energyJ));
  const energyDamage = sqrtE * dmgCoef * shape;        // shapeFactor → 피해 전환 효율
  let energyPen = sqrtE * penCoef * (0.5 + stab * 0.5); // stabilityFactor → 관통 전환 효율
  const blend = (a, b, wgt) => a * (1 - wgt) + b * wgt;
  let eqD = blend(baseDamage, energyDamage, ew);
  let eqP = blend(basePen, energyPen, ew);
  // tumblingChance: 관통 일부를 표재/출혈로 전환 (penetration↓), dragFactor: 고드래그 잔여속도 보정 (mild)
  const penTumbleMul = (1 - tumbling * 0.20) * (1 - Math.max(0, drag - 0.7) * 0.15);
  eqP *= penTumbleMul;
  eqD = Math.max(baseDamage * dC[0], Math.min(baseDamage * dC[1], eqD));
  eqP = Math.max(basePen * pC[0], Math.min(basePen * pC[1], eqP));
  // sharpness → bleed/laceration 성향 (mild, clamp 내). tumbling으로 잃은 관통 일부를 표재 출혈로 (소폭).
  const bleedMulByClass = ({ trace:0.85, low:0.95, moderate:1.05, high:1.18, severe:1.30 })[energyClass] || 1.0;
  const sharpMul = 0.92 + sharpness * 0.16;            // 0.92~1.08 (mild)
  const tumbleBleedBonus = 1 + tumbling * 0.06;        // 텀블 → 표재 출혈 소폭
  let eqBleed = Math.max(baseBleed * bC[0], Math.min(baseBleed * bC[1], baseBleed * bleedMulByClass * sharpMul * tumbleBleedBonus));
  return { fragmentEnergyJ:+energyJ.toFixed(2), fragmentEnergyClass:energyClass,
    energyDamage:+energyDamage.toFixed(2), energyPenetration:+energyPen.toFixed(2),
    equivalentDamage:+eqD.toFixed(2), equivalentPenetration:+eqP.toFixed(2), bleedRisk:eqBleed, energyWeight:ew,
    fragmentShapeFactor:+shape.toFixed(2), fragmentStabilityFactor:+stab.toFixed(2), fragmentSharpness:+sharpness.toFixed(2),
    fragmentDragFactor:+drag.toFixed(2), fragmentTumblingChance:+tumbling.toFixed(2), spallMaterialType: (tp && tp.spallMaterialType) || null };
}

function spawnFragments(ex, ey, preset, thrower) {
  const total = preset.fragmentCount || 850;
  // 등급 비율 — 매 폭발 살짝 랜덤
  const ranges = preset.fragmentRatioRange || { large:[0.04,0.06], medium:[0.22,0.28] };
  const largeP  = ranges.large[0]  + Math.random() * (ranges.large[1]  - ranges.large[0]);
  const mediumP = ranges.medium[0] + Math.random() * (ranges.medium[1] - ranges.medium[0]);
  const smallP  = Math.max(0, 1 - largeP - mediumP);
  let nLarge  = Math.floor(total * largeP);
  let nMedium = Math.floor(total * mediumP);
  let nSmall  = total - nLarge - nMedium;
  // 폭발 반경 안 후보 유닛만 미리 추림 (성능)
  const maxFragPx = preset.fragmentRadius * PX_PER_M_FALLBACK;
  const candidateUnits = [];
  for (const u of UNITS) {
    if (!u.alive || u.isDead) continue;
    const d = Math.hypot(u.x - ex, u.y - ey);
    if (d <= maxFragPx + 30) candidateUnits.push(u);
  }
  const candidateCovers = [];
  if (MAP_DATA && MAP_DATA.coverObjects) {
    for (const o of MAP_DATA.coverObjects) {
      const cx = o.x + o.w/2, cy = o.y + o.h/2;
      const d = Math.hypot(cx - ex, cy - ey);
      if (d <= maxFragPx + 60) candidateCovers.push(o);
    }
  }
  // 파편 통계 누적
  const stats = {
    generated: total, nSmall, nMedium, nLarge,
    unitHit: 0, armorBlocked: 0,
    wallBlocked: 0, coverBlocked: 0,
    penetratedWall: 0, penetratedCover: 0,
    ricochet: 0, expired: 0,
  };
  // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 질량 예산 구성 + tier별 개별 파편 질량 배분 (총합 ≤ hazardousFragmentMassBudgetG)
  const _massBudget = buildFragmentMassBudget({ presetId: preset.id, weightKg: preset.weightKg, fragmentCount: total, sourceType: 'grenade' });
  const _share = _massBudget.massShare;
  const _massArr = {
    small:  allocateTierFragmentMasses(nSmall,  _massBudget.hazardousFragmentMassBudgetG * (_share.small  || 0.40)),
    medium: allocateTierFragmentMasses(nMedium, _massBudget.hazardousFragmentMassBudgetG * (_share.medium || 0.42)),
    large:  allocateTierFragmentMasses(nLarge,  _massBudget.hazardousFragmentMassBudgetG * (_share.large  || 0.18)),
  };
  _massBudget.generatedFragmentMassTotalG = +([].concat(_massArr.small, _massArr.medium, _massArr.large).reduce((a, b) => a + b, 0)).toFixed(2);
  // 검산: 예산 초과 시 정규화 (구조상 초과하지 않지만 안전장치)
  if (_massBudget.generatedFragmentMassTotalG > _massBudget.hazardousFragmentMassBudgetG + 0.01) {
    const norm = _massBudget.hazardousFragmentMassBudgetG / _massBudget.generatedFragmentMassTotalG;
    for (const k of ['small', 'medium', 'large']) _massArr[k] = _massArr[k].map(m => m * norm);
    _massBudget.generatedFragmentMassTotalG = _massBudget.hazardousFragmentMassBudgetG;
  }
  // 파편 발사 (등급별 일괄 처리)
  fireFragmentBatch(ex, ey, nSmall,  'small',  preset, thrower, candidateUnits, candidateCovers, stats, _massArr.small,  _massBudget);
  fireFragmentBatch(ex, ey, nMedium, 'medium', preset, thrower, candidateUnits, candidateCovers, stats, _massArr.medium, _massBudget);
  fireFragmentBatch(ex, ey, nLarge,  'large',  preset, thrower, candidateUnits, candidateCovers, stats, _massArr.large,  _massBudget);
  log(`💥 파편 ${total} | S${nSmall} M${nMedium} L${nLarge} | hit ${stats.unitHit} armor ${stats.armorBlocked} wall ${stats.wallBlocked} cover ${stats.coverBlocked} pen ${stats.penetratedWall + stats.penetratedCover} rico ${stats.ricochet} miss ${stats.expired}`, 'info');
}

function fireFragmentBatch(ex, ey, count, tierName, preset, thrower, units, covers, stats, massArr, massBudget) {
  if (count <= 0) return;
  const tier = FRAGMENT_TIERS[tierName];
  if (!tier) return;
  const velMul = preset.fragmentVelocityMul || 1.00;
  // velMul^1.3로 dmg/pen 보정 — RGD-5의 0.93은 약 0.91배 위력
  const dmgMul = Math.pow(velMul, 1.3);
  const penMul = Math.pow(velMul, 1.5);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    const dmg = (tier.damageRange[0] + Math.random() * (tier.damageRange[1] - tier.damageRange[0])) * dmgMul;
    const pen = (tier.penRange[0]    + Math.random() * (tier.penRange[1]    - tier.penRange[0])) * penMul;
    const iVel = (tier.velocityRange[0] + Math.random() * (tier.velocityRange[1] - tier.velocityRange[0])) * velMul;
    const range = tier.rangeRange[0]  + Math.random() * (tier.rangeRange[1]    - tier.rangeRange[0]);
    // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 개별 파편 질량 메타 (energy bridge용)
    const fragMeta = (massArr && massArr[i] != null && massBudget) ? {
      fragmentMassG: +massArr[i].toFixed(4), sourceType: 'grenade', fragmentSource: (preset && preset.id) || 'grenade',
      fragmentTier: tierName, shapeFactor: massBudget.shapeFactor, stabilityFactor: massBudget.stabilityFactor,
      sourceMassBudgetG: massBudget.hazardousFragmentMassBudgetG, sourceGeneratedMassTotalG: massBudget.generatedFragmentMassTotalG,
      parentAmmoId: (preset && preset.id) || null,
    } : null;
    fireFragmentRay(ex, ey, nx, ny, dmg, pen, iVel, range, tier, tierName, preset, thrower, units, covers, stats, fragMeta);
  }
}

// 벽의 면 법선 추정 — rect 충돌점 기준
function estimateNormal(obj, hx, hy, nx, ny) {
  if (obj && obj.x != null && obj.w != null) {
    const lx = hx - obj.x, rx = (obj.x + obj.w) - hx;
    const ty = hy - obj.y, by = (obj.y + obj.h) - hy;
    const minH = Math.min(Math.abs(lx), Math.abs(rx));
    const minV = Math.min(Math.abs(ty), Math.abs(by));
    if (minH < minV) return { x: (lx < rx ? -1 : 1), y: 0 };
    return { x: 0, y: (ty < by ? -1 : 1) };
  }
  return { x: -nx, y: -ny };
}

// 파편 단일 raycast — 다회 관통 + 도탄
//   stats 객체에 통계 누적 (선택)
function fireFragmentRay(ox, oy, nx, ny, dmg, pen, iVel, rangeM, tier, tierName, preset, thrower, units, covers, stats, fragMeta) {
  const maxDistPx = rangeM * PX_PER_M_FALLBACK;
  const EPS = 2.5;          // 관통/도탄 후 진행 방향 미세 push (재충돌 방지)
  const MAX_SEG = 6;        // 안전장치 (실제 정지는 curPen/Vel/Dmg/range 기준)
  let curX = ox, curY = oy;
  let curVel = iVel, curDmg = dmg, curPen = pen;
  let traveled = 0, segCount = 0;
  // 시각화 segments: [{x1,y1,x2,y2,segType}]
  const segments = [];
  let endType = 'range';
  let curSegType = 'normal';

  while (segCount < MAX_SEG && traveled < maxDistPx && curVel > 100 && curDmg > 0.5 && curPen > 0.3) {
    const remaining = maxDistPx - traveled;
    let bestT = remaining;
    let bestHit = null;
    if (typeof rayDistToWalls === 'function') {
      const w = rayDistToWalls(curX, curY, nx, ny, remaining);
      if (w.t < bestT) { bestT = w.t; bestHit = { type:'wall', obj: w.obj }; }
    }
    for (const o of covers) {
      if (typeof rayBoxT === 'function') {
        const t = rayBoxT(curX, curY, nx, ny, o, bestT);
        if (t < bestT) { bestT = t; bestHit = { type:'cover', obj: o }; }
      }
    }
    let bestUnitT = Infinity, bestUnit = null;
    for (const u of units) {
      if (thrower && u === thrower) continue;
      if (u.isDead) continue;
      if (typeof intersectRayCircle === 'function') {
        const t = intersectRayCircle(curX, curY, nx, ny, u.x, u.y, UNIT_RADIUS);
        if (t < bestUnitT && t <= bestT) { bestUnitT = t; bestUnit = u; }
      }
    }

    // 유닛 명중
    if (bestUnit && bestUnitT <= bestT) {
      const distM = (traveled + bestUnitT) / PX_PER_M_FALLBACK;
      const dragRate = tier.velDragPerM || 0.10;
      const dragFactor = Math.exp(-dragRate * distM);
      const hitVel = curVel * dragFactor;
      const hx = curX + nx * bestUnitT, hy = curY + ny * bestUnitT;
      segments.push({ x1: curX, y1: curY, x2: hx, y2: hy, segType: curSegType });
      const hitResult = applyFragmentHit(bestUnit, hx, hy, curDmg, curPen, hitVel, iVel, distM, tier, tierName, thrower, ox, oy, fragMeta);
      endType = (hitResult && hitResult.missed) ? 'prone_miss'
              : (hitResult && hitResult.blocked) ? 'armor_blocked'
              : 'unit';
      if (stats) {
        if (endType === 'armor_blocked') stats.armorBlocked++;
        else if (endType === 'prone_miss') stats.proneMiss = (stats.proneMiss || 0) + 1;
        else stats.unitHit++;
      }
      pushFragmentTraceFx(segments, endType, tierName);
      return;
    }
    // 사거리 끝 — 아무것도 안 만남
    if (!bestHit) {
      const ex = curX + nx * remaining, ey = curY + ny * remaining;
      segments.push({ x1: curX, y1: curY, x2: ex, y2: ey, segType: curSegType });
      endType = 'range';
      if (stats) stats.expired++;
      pushFragmentTraceFx(segments, endType, tierName);
      return;
    }
    // 벽/cover hit — segment 추가 + 관통/도탄 판정
    const hx = curX + nx * bestT, hy = curY + ny * bestT;
    segments.push({ x1: curX, y1: curY, x2: hx, y2: hy, segType: curSegType });
    traveled += bestT;
    curX = hx; curY = hy;

    const obj = bestHit.obj;
    const mat = obj && obj.material;
    let penProb = 0.0;
    if (mat === 'drywall') penProb = (tierName === 'small') ? 0.35 : (tierName === 'medium') ? 0.55 : 0.70;
    else if (mat === 'glass') penProb = 0.85;
    else if (mat === 'wood') penProb = (tierName === 'small') ? 0.08 : (tierName === 'medium') ? 0.30 : 0.50;
    else if (mat === 'thin_metal') penProb = (tierName === 'small') ? 0.02 : (tierName === 'medium') ? 0.10 : 0.30;
    else if (mat === 'concrete') penProb = 0.01;
    else if (mat === 'steel') penProb = 0.005;
    else penProb = 0.10;

    if (Math.random() < penProb) {
      // 관통 성공 — exit 위치까지 진행 + 감쇠
      const dmgMul = tier.postPenDmgMul || 0.30;
      const penMul = tier.postPenPenMul || 0.30;
      const velMul = tier.postPenVelMul || 0.35;
      curDmg *= dmgMul; curPen *= penMul; curVel *= velMul;
      // exit T 계산 — 객체 통과 후 위치
      if (typeof rayBoxExitT === 'function' && obj && obj.x != null) {
        const exitT = rayBoxExitT(curX, curY, nx, ny, obj, remaining);
        const exitX = curX + nx * exitT;
        const exitY = curY + ny * exitT;
        // 관통 segment (entry → exit, 회색/주황)
        segments.push({ x1: curX, y1: curY, x2: exitX, y2: exitY, segType: 'penetrated' });
        traveled += exitT;
        curX = exitX; curY = exitY;
      }
      // EPSILON push — 재충돌 방지
      curX += nx * EPS; curY += ny * EPS;
      traveled += EPS;
      curSegType = 'normal';   // 관통 후엔 다시 normal segment로
      if (stats) {
        if (bestHit.type === 'wall') stats.penetratedWall++;
        else stats.penetratedCover++;
      }
      segCount++;
      continue;
    }

    // 관통 실패 — 도탄 시도 (통합 시스템 사용)
    const tierBehaviorMap = { small: 'fragment_small', medium: 'fragment_medium', large: 'fragment_large' };
    const fragBehavior = tierBehaviorMap[tierName] || 'fragment';
    // 입사각 — 벽의 면 법선 추정
    const nrm = estimateNormal(obj, curX, curY, nx, ny);
    const incidentAngle = getIncidentAngle(nx, ny, nrm.x, nrm.y);
    const ricChance = calcRicochetChance({
      incidentAngleRad: incidentAngle,
      material: mat || 'drywall',
      behavior: fragBehavior,
      ammoRicMul: 1.0,
      impactVel: curVel,
      initialVel: iVel,
      effectivePen: curPen,
      barrierResistance: (obj && obj.armor) ? obj.armor : 20,
    });
    if (Math.random() < ricChance) {
      // 반사 + 분산
      const rd = calcRicochetDirection(nx, ny, nrm.x, nrm.y, mat || 'drywall', fragBehavior);
      nx = rd.nx; ny = rd.ny;
      const dec = getRicochetDecay(fragBehavior);
      curDmg *= dec.dmg;
      curPen *= dec.pen;
      curVel *= dec.vel;
      // EPSILON push
      curX += nrm.x * EPS; curY += nrm.y * EPS;
      curSegType = 'ricochet';
      if (stats) stats.ricochet++;
      segCount++;
      continue;
    }

    // 차단 — segment 끝
    endType = 'wall_blocked';
    if (stats) {
      if (bestHit.type === 'wall') stats.wallBlocked++;
      else stats.coverBlocked++;
    }
    pushFragmentTraceFx(segments, endType, tierName);
    return;
  }

  // 안전장치 종료
  if (stats) stats.expired++;
  pushFragmentTraceFx(segments, 'range', tierName);
}

// 파편 trace fx push — 시각화용
function pushFragmentTraceFx(segments, endType, tierName) {
  if (!segments || segments.length < 1) return;
  GAME.fxList.push({
    type: 'fragment_ray',
    segments,
    endType,
    tierName,
    life: 1.0,
    maxLife: 1.0,
  });
}

// 파편이 유닛에 hit — 기존 신체/방호/의료 시스템 활용
function applyFragmentHit(target, hx, hy, dmg, pen, curVel, iVel, distM, tier, tierName, thrower, ox, oy, fragMeta) {
  // velocity 비례 감쇠 — fireFragmentRay에서 자연 감쇠된 hitVel을 받음
  const velRatio = Math.max(0.05, Math.min(1.0, curVel / iVel));
  // 거리 기반 추가 감쇠 — 등급별 최대 사거리 기준
  const maxRange = tier.rangeRange ? tier.rangeRange[1] : 18;
  const distMul = Math.max(0.10, 1.0 - Math.pow(distM / maxRange, 1.4));
  const effDmg = dmg * Math.pow(velRatio, tier.damageVelExp) * distMul;
  const effPen = pen * Math.pow(velRatio, tier.penVelExp) * distMul;

  // === PRONE 회피 확률 ===
  //   엎드린 유닛은 거리별 hit chance 보정으로 일부 빗나감
  const isProne = (target.stance === 'prone' && !target.isDowned);
  if (isProne && ox != null && oy != null) {
    const explDistM = Math.hypot(target.x - ox, target.y - oy) / PX_PER_M_FALLBACK;
    const hitMul = getProneFragmentMul(explDistM);
    if (Math.random() >= hitMul) {
      // 빗나감 — 낮은 자세 위로 지나감
      return { blocked: false, missed: true };
    }
  }

  // === HIT LOCATION — 자세 × 방향 × 거리 기반 ===
  let location, aspect;
  if (ox != null && oy != null) {
    const explDistM = Math.hypot(target.x - ox, target.y - oy) / PX_PER_M_FALLBACK;
    const roll = rollFragmentHitLocation(target, ox, oy, { tier: tierName }, explDistM);
    location = roll.location;
    aspect = roll.aspect;
    // 파편 전용 location명 → 표준명 정규화 (neck_soft/nearSideArm 등이 흉부로 빠지던 버그 수정)
    if (location === 'neck_soft') location = 'neck';
    else if (location === 'nearSideArm' || location === 'farSideArm') location = 'arms';
    else if (location === 'nearSideLeg' || location === 'farSideLeg') location = 'legs';
  } else {
    // ox/oy 없을 때 fallback — 기존 standing front 사용
    location = pickWeightedLocation(FRAG_HIT_STANDING_FRONT);
    aspect = 'front';
  }

  // 방호 판정 — 기존 시스템 활용 (확률적 관통)
  let blocked = false;
  let fragProtection = null;
  if (typeof rollProtection === 'function') {
    const prot = rollProtection(target, location, aspect);
    fragProtection = prot;
    if (prot && prot.protectionType !== 'none') {
      const armorVal = (prot.hardArmor || prot.softArmor || 0);
      // 확률적 관통 판정 — 기존 penetrationProbability 활용
      if (typeof penetrationProbability === 'function') {
        const diff = effPen - armorVal;
        const pProb = penetrationProbability(diff);
        if (Math.random() >= pProb) blocked = true;
      } else {
        // fallback — 단순 비교
        if (effPen < armorVal * 0.9) blocked = true;
      }
    }
  }
  // === 2A-1: 좌우 정합성 — arms/legs 통합 location의 좌우를 한 번 결정 ===
  let fragIsLeft = null;
  if (location === 'left_arm') fragIsLeft = true;
  else if (location === 'right_arm') fragIsLeft = false;
  else if (location === 'arms' || location === 'legs') {
    fragIsLeft = (aspect === 'left') ? (Math.random() < 0.75)
               : (aspect === 'right') ? (Math.random() < 0.25)
               : (Math.random() < 0.5);
  }

  // === 2A-1: 파편 impactAddress ===
  let fragImpactAddress = null;
  try {
    fragImpactAddress = buildImpactAddress(target,
      { location, aspect },
      fragProtection || { protectionType:'none' },
      { location, aspect, armorResult: blocked ? 'stopped' : 'penetrated', penetrated: !blocked, sourceType: 'frag', isLeft: fragIsLeft });
    if (fragImpactAddress && fragImpactAddress._isLeft != null) fragIsLeft = fragImpactAddress._isLeft;
    if (fragImpactAddress && thrower) {
      recordImpactEvent(thrower, target, fragImpactAddress, { sourceType:'frag',
        medicalSummaryAfter: target.medical ? { lifeStatus: target.medical.lifeStatus } : null });
    }
  } catch (e) { fragImpactAddress = null; }
  // === 파편 방어구 내구도 손상 ===
  //   파편도 방어구를 마모/손상시킨다 (소프트는 침식, 플레이트는 소량 칩). 기존엔 미적용이라 내구도가 닳지 않던 문제.
  if (fragProtection && fragProtection.protectionType !== 'none' && target.armorDurability) {
    const fragStop = blocked
      ? (fragProtection.protectionType === 'hard' ? 'hard_block' : 'soft_block')
      : 'penetration';
    // 파편 합성 ammo — penetration/장벽계수/armorDamagePct
    const fragAmmo = { penetration: effPen, barrierPenMul: 1.0, armorDamagePct: 45, _isFragment: true };
    try { applyArmorDurabilityDamage(target, { _ammo: fragAmmo }, fragProtection, fragStop, !blocked, location, aspect); } catch (e) {}
  }
  if (blocked) {
    // 막힘 — 작은 둔상 + 약간의 pain
    if (target.medical) {
      // medical 있으면 applyDamageEvent로 통일 (blunt trauma + 작은 pain)
      applyDamageEvent(target, {
        sourceType: 'frag',
        hitPart: location,
        isLeft: fragIsLeft,
        rawDamage: effDmg * 0.20,
        armorResult: 'stopped',
        bluntTrauma: effDmg * 0.15,
        painAmount: effDmg * 0.20,
        shockRisk: 0.05,
        isFragment: true,
        fragmentSize: (tierName === 'large') ? 'large' : (tierName === 'medium') ? 'medium' : 'small',
        impactAddress: fragImpactAddress,
      });
    } else {
      if (typeof addPain === 'function') addPain(target, effDmg * 0.20);
    }
    return { blocked: true };
  }

  // 관통 — damage 적용 (medical applyDamageEvent로 통합)
  if (target.medical) {
    // location: chest/abdomen/head/neck/left_arm/right_arm/legs
    //   좌우는 위에서 결정한 fragIsLeft 사용 (impactAddress와 동일)
    const isLeft = fragIsLeft;
    const fragSize = (tierName === 'large') ? 'large' : (tierName === 'medium') ? 'medium' : 'small';
    const _baseBleed = tier.bleedChanceBase * (0.5 + 0.5 * velRatio) * (0.5 + 0.5 * distMul);
    // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 에너지 브리지 (base effDmg/effPen과 blend+clamp). fragMeta 없으면 기존 값 유지(회귀).
    let _rawD = effDmg, _penD = effPen, _bleedD = _baseBleed, _fragEnergyMeta = null;
    if (fragMeta && fragMeta.fragmentMassG > 0) {
      const _trait = getFragmentTraitProfile('grenade', null);
      const br = computeFragmentEnergyDamageBridge(effDmg, effPen, _baseBleed, fragMeta.fragmentMassG, curVel, 'grenade', fragMeta.shapeFactor, fragMeta.stabilityFactor, _trait);
      _rawD = br.equivalentDamage; _penD = br.equivalentPenetration; _bleedD = br.bleedRisk;
      _fragEnergyMeta = { fragmentMassG: fragMeta.fragmentMassG, fragmentVelocityMps: +curVel.toFixed(1), fragmentEnergyJ: br.fragmentEnergyJ, fragmentEnergyClass: br.fragmentEnergyClass,
        fragmentSource: fragMeta.fragmentSource, fragmentTier: fragMeta.fragmentTier, sourceMassBudgetG: fragMeta.sourceMassBudgetG, sourceGeneratedMassTotalG: fragMeta.sourceGeneratedMassTotalG,
        parentAmmoId: fragMeta.parentAmmoId, energyBasedDamage: br.energyDamage, energyBasedPenetration: br.energyPenetration, equivalentDamage: br.equivalentDamage, equivalentPenetration: br.equivalentPenetration, fragmentEnergyDamageBridge: true,
        fragmentShapeFactor: br.fragmentShapeFactor, fragmentStabilityFactor: br.fragmentStabilityFactor, fragmentSharpness: br.fragmentSharpness, fragmentDragFactor: br.fragmentDragFactor, fragmentTumblingChance: br.fragmentTumblingChance, spallMaterialType: null };
    }
    // hitAddress 감쇠 — 파편은 applyOutcome 미경유이므로 여기서 1회만 (energy bridge 이후 최종 단계). 중복 감쇠 금지.
    const _fragHap = (typeof buildHitAddressDamageProfile === 'function') ? buildHitAddressDamageProfile(location, fragImpactAddress, {}) : null;
    const _hd = _fragHap ? _fragHap.damageMul : 1.0, _hb = _fragHap ? _fragHap.bleedMul : 1.0, _hs = _fragHap ? _fragHap.shockMul : 1.0, _hp = _fragHap ? _fragHap.painMul : 1.0, _hw = _fragHap ? _fragHap.woundMul : 1.0;
    applyDamageEvent(target, {
      sourceType: 'frag',
      hitPart: location,
      isLeft,
      rawDamage: _rawD,
      tissueDamage: _rawD * _hd,
      penetration: _penD,
      armorResult: 'penetrated',
      isFragment: true,
      fragmentPenetrated: true,            // 2B-0-FINAL §1: 실제 관통한 파편 명시
      fragmentSize: fragSize,
      bleedRisk: _bleedD * _hb,
      shockRisk: 0.015 * tier.shockMul * (velRatio) * _hs,
      painAmount: _rawD * 1.2 * _hp,
      distance: distM,
      impactAddress: fragImpactAddress,
      // 에너지/감쇠 메타 (woundDescriptor/AAR/debug용 — 원본 추적 보존)
      originalRawDamage: _rawD, effectiveRawDamage: _rawD * _hw,
      hitAddressDamageProfile: _fragHap, hitAddressDamageMul: _hd, hitAddressWoundMul: _hw, hitAddressPhysiologyMul: (_fragHap ? _fragHap.physiologyMul : 1.0),
      fragmentEnergyMeta: _fragEnergyMeta,
      fragmentMassG: _fragEnergyMeta ? _fragEnergyMeta.fragmentMassG : null,
      fragmentVelocityMps: _fragEnergyMeta ? _fragEnergyMeta.fragmentVelocityMps : null,
      fragmentEnergyJ: _fragEnergyMeta ? _fragEnergyMeta.fragmentEnergyJ : null,
      fragmentEnergyClass: _fragEnergyMeta ? _fragEnergyMeta.fragmentEnergyClass : null,
    });
    // legacy bleeding tag — syncLegacyCombatState가 처리하지만 즉시 갱신
    syncLegacyCombatState(target);
  } else {
    // medical 없음 — fallback
    if (target.bodyHp && target.bodyHp[location] != null) {
      target.bodyHp[location] = Math.max(0, target.bodyHp[location] - effDmg);
    }
    target.hp = Math.max(0, target.hp - effDmg);
    if (typeof addPain === 'function') addPain(target, effDmg * 1.2);
    target.shock = Math.min(100, (target.shock || 0) + effDmg * 0.015 * tier.shockMul);
    if (target.hp <= 0) { target.alive = false; target.isDead = true; }
    if (typeof updateCombatState === 'function') updateCombatState(target);
  }
  // legacy fracture (medical 없는 유닛만 — medical 유닛은 applyDamageEvent에서 처리)
  if (!target.medical && Math.random() < tier.fractureChance * velRatio) {
    if (target.fracture === 'none') {
      if (location === 'left_arm' || location === 'right_arm') target.fracture = 'arm';
      else if (location === 'legs') target.fracture = 'leg';
      else if (location === 'chest') target.fracture = 'chest';
    }
  }
  return { blocked: false };
}

// 매 프레임 — flyingThrowables 진행은 tickThrowable이 unit별 처리하므로 별도 불필요

// =============================================================
