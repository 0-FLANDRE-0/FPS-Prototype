// 라벨화 — UI 표시용 (낮음/보통/높음/매우높음)
function medicalLevelLabel(value, thresholds) {
  // thresholds: [low, mid, high] — 그 아래/사이/위로 4단계 분류
  if (value < thresholds[0]) return { label:'낮음',   cls:'med-low' };
  if (value < thresholds[1]) return { label:'보통',   cls:'med-mid' };
  if (value < thresholds[2]) return { label:'높음',   cls:'med-high' };
  return                            { label:'매우높음', cls:'med-vhigh' };
}
const MED_THRESHOLDS = {
  bleed:    [0.20, 0.35, 0.55],
  fracture: [0.12, 0.22, 0.34],
  shock:    [0.15, 0.25, 0.35],
  blunt:    [0.85, 1.10, 1.40],
  tissue:   [0.90, 1.15, 1.50],
};

function effectivePenetration(ammo, weapon, material) {
  const fallback = (weapon && weapon.penetration) || 2;
  if (!ammo) return fallback;
  const base = (ammo.penetration != null) ? ammo.penetration : fallback;
  if (!material) return base;
  const tbl = ammo.materialPenPenalty || {};
  const penalty = (tbl[material] != null) ? tbl[material] : 0;
  return Math.max(0, base - penalty);
}
function rollDamageOutcome(weapon, location, penetrated) {
  if (!penetrated) return Math.random() < 0.15 ? OUTCOME.LIGHT : OUTCOME.BLOCK;
  const r = Math.random();
  if (location === 'head_skull') {
    if (r < 0.60) return OUTCOME.KILL;
    if (r < 0.90) return OUTCOME.DOWN;
    return OUTCOME.SERIOUS;
  }
  if (location === 'head_face') {
    if (r < 0.50) return OUTCOME.KILL;
    if (r < 0.85) return OUTCOME.DOWN;
    return OUTCOME.SERIOUS;
  }
  if (location === 'neck') {
    if (r < 0.65) return OUTCOME.KILL;
    if (r < 0.90) return OUTCOME.DOWN;
    return OUTCOME.SERIOUS;
  }
  if (location === 'chest') {
    if (r < 0.20) return OUTCOME.KILL;
    if (r < 0.55) return OUTCOME.DOWN;
    if (r < 0.85) return OUTCOME.SERIOUS;
    return OUTCOME.LIGHT;
  }
  if (location === 'abdomen') {
    if (r < 0.10) return OUTCOME.KILL;
    if (r < 0.40) return OUTCOME.DOWN;
    if (r < 0.75) return OUTCOME.SERIOUS;
    return OUTCOME.LIGHT;
  }
  if (r < 0.04) return OUTCOME.KILL;
  if (r < 0.20) return OUTCOME.DOWN;
  if (r < 0.55) return OUTCOME.SERIOUS;
  return OUTCOME.LIGHT;
}
function applyOutcome(target, outcome, weapon, ctx) {
  if (target) target._acuteHandledThisHit = false;   // [0.39.1 Fix1] per-hit 리셋 (applyDamageEvent가 이 hit에서 set)
  // 2A-6.4 마감: 백커 보정 modifier 안전 읽기 (NaN/undefined → 1.0)
  const _isFin = (x) => typeof x === 'number' && isFinite(x);
  const bluntMod = (ctx && _isFin(ctx.bluntModifier)) ? ctx.bluntModifier : 1.0;
  const shockMod = (ctx && _isFin(ctx.shockModifier)) ? ctx.shockModifier : 1.0;
  const painMod  = (ctx && _isFin(ctx.painModifier))  ? ctx.painModifier  : 1.0;
  let dmgFrac = 0;
  let supGain = weapon.suppressionHit || 5;
  switch (outcome) {
    case OUTCOME.MISS:    dmgFrac = 0;     supGain = weapon.suppressionMiss || 2; break;
    case OUTCOME.NEAR:    dmgFrac = 0;     supGain = (weapon.suppressionMiss || 2) * 1.6; break;
    case OUTCOME.BLOCK:   dmgFrac = 0.015; supGain *= 0.6; break;
    case OUTCOME.LIGHT:   dmgFrac = 0.06;  supGain *= 0.85; break;
    case OUTCOME.SERIOUS: dmgFrac = 0.18;  supGain *= 1.30; break;
    case OUTCOME.DOWN:    dmgFrac = 0.32;  supGain *= 1.55; break;
    case OUTCOME.KILL:    dmgFrac = 0.48;  supGain *= 1.85; break;
  }
  if (outcome === OUTCOME.BLOCK && ctx && ctx.stopStage) {
    // 차단 시 기본 충격 비율 — stopStage별 기본값
    let baseDmgFrac, supMul;
    switch (ctx.stopStage) {
      case 'hard_block':          baseDmgFrac = 0.008; supMul = 0.75; break;
      case 'soft_block':          baseDmgFrac = 0.030; supMul = 1.00; break;
      case 'hard_pen_soft_block': baseDmgFrac = 0.040; supMul = 1.20; break;
      default:                    baseDmgFrac = 0.015; supMul = 1.00;
    }
    // 차단한 재질의 bluntRatio 반영 — 재질별로 충격 전달이 다르게
    //   예: 아라미드(0.80) 막힘 → 0.80배 / 티타늄(0.45) → 0.45배
    const bRatio = getMaterialBluntRatio(ctx.blockMaterial);
    dmgFrac = baseDmgFrac * (0.5 + bRatio);   // bluntRatio 1.0이면 ×1.5, 0.45면 ×0.95
    supGain *= supMul * (0.6 + bRatio * 0.5); // 충격이 큰 재질은 제압도 약간 강함
    // === 바이저 block — 얼굴과 이격, 큰 둔상 X. accessory.bluntMul 적용 ===
    //   K6-3 visorHitTable의 영역별 bluntMul: ctx.blockMaterial과 zone.material 일치 시 그 zone의 bluntMul.
    //   FAST/LShZ 일반 visor: visor.bluntMul (0.10) 적용.
    if (ctx.location === 'head_face' && target && target.visorId) {
      const visor = PROTECTION_ACCESSORY_PRESETS[target.visorId];
      if (visor && !visor.isNone) {
        let bMul = visor.bluntMul != null ? visor.bluntMul : 0.10;
        if (visor.visorHitTable) {
          for (const z of visor.visorHitTable) {
            if (z.material === ctx.blockMaterial) { bMul = z.bluntMul; break; }
          }
        }
        dmgFrac *= bMul;     // 일반 0.10 → 90% 감소
        supGain *= 0.5;      // 어지러움 정도의 약한 suppression
      }
    }
    // ctx에 저장 — 아래 stopping/pain 가중에서 사용
    ctx._bluntRatio = bRatio;
    // 2A-6.4: 백커 충족도에 따른 둔상 보정 (ICW 부족 시 둔상↑, 충족 시 둔상↓) — dmgFrac에 1회만 적용
    if (bluntMod !== 1.0) dmgFrac *= bluntMod;
  }
  const ds = (weapon.damageScale != null) ? weapon.damageScale : 1.0;
  dmgFrac *= ds;

  // === velocity 보정 + terminalEffect ===
  //   ctx.damageVelMul: 거리/장벽 후 속도에 따른 피해 보정
  //   weapon._ammo.terminalEffect: 파쇄/yaw/확장 임계
  //   penetrated인 경우에만 적용 (BLOCK은 그대로)
  const wasPenInOutcome = (outcome !== OUTCOME.MISS && outcome !== OUTCOME.NEAR && outcome !== OUTCOME.BLOCK);
  if (wasPenInOutcome && ctx && ctx.damageVelMul != null) {
    dmgFrac *= ctx.damageVelMul;
    // terminalEffect
    const te = weapon._ammo && weapon._ammo.terminalEffect;
    if (te) {
      const above = ctx.impactVelocity >= te.thresholdVelocity;
      const tissueMul = above ? (te.aboveTissueMul || 1.0) : (te.belowTissueMul || 1.0);
      dmgFrac *= tissueMul;
      // ctx에 저장 — bleed/shock 적용 시 사용
      ctx._terminalAbove = above;
      ctx._terminalBleedMul = above ? (te.aboveBleedMul || 1.0) : (te.belowBleedMul || 1.0);
      ctx._terminalShockMul = above ? (te.aboveShockMul || 1.0) : (te.belowShockMul || 1.0);
    }
    // 클램프 — 너무 극단으로 가지 않도록
    dmgFrac = Math.max(0, dmgFrac);
  }

  const dmgFull = target.maxHp * dmgFrac;

  // === 부위별 + 전체 hp 분리 적용 ===
  const bodyPart = (ctx && ctx.bodyPart) ? ctx.bodyPart
                 : (ctx && ctx.location ? locationToBodyPart(ctx.location) : 'chest');
  const severity = outcomeToSeverity(outcome, bodyPart);
  let dmg = 0;
  // === 2A-1 정합성: ricocheted 여부 ===
  //   impactAddress가 도탄으로 확정한 경우 비관통 처리를 강제
  const wasRicocheted = !!(ctx && ctx.impactAddress && ctx.impactAddress.ricochetHint && ctx.impactAddress.ricochetHint.ricocheted);
  // === NEW: Medical applyDamageEvent로 통합 ===
  //   부위 HP는 더 이상 직접 깎지 않고 applyDamageEvent가 처리
  //   legacy unit.hp는 syncLegacyCombatState가 medical.lifeStatus로 갱신
  if (severity != null && target.medical) {
    const bodyDmg = severityToBodyDamage(severity) * ds;
    // 좌우 — ctx.isLeft(impactAddress와 공유된 확정값) 우선, 없으면 location 기반
    const isLeft = (ctx && ctx.isLeft != null) ? ctx.isLeft
                 : (ctx && ctx.location === 'left_arm') ? true
                 : (ctx && ctx.location === 'right_arm') ? false : null;
    // === 2A-1 정합성: armorResult를 ctx.penetrated 기준으로 일관 결정 ===
    //   - 실제 penetrated=false: outcome이 LIGHT여도 비관통 (stopped/deflected). 관통 출혈 X.
    //   - 실제 penetrated=true: 관통 (기존 흐름).
    //   - ricocheted=true: penetrated=false 위에서 deflected로 표시.
    let armorResult;
    if (wasRicocheted) armorResult = 'deflected';
    else if (outcome === OUTCOME.BLOCK) armorResult = 'stopped';
    else if (ctx && ctx.penetrated === false) armorResult = 'stopped';   // 차단됐는데 LIGHT 결과 — 둔상으로
    else armorResult = 'penetrated';
    // 출혈/충격 위험도 — severity 기반 (비관통이면 모두 0으로)
    let bleedRisk = 0, shockRisk = 0;
    if (armorResult === 'penetrated') {
      switch (outcome) {
        case OUTCOME.LIGHT:   bleedRisk = 0.20; shockRisk = 0.15; break;
        case OUTCOME.SERIOUS: bleedRisk = 0.55; shockRisk = 0.50; break;
        case OUTCOME.DOWN:    bleedRisk = 0.80; shockRisk = 0.75; break;
        case OUTCOME.KILL:    bleedRisk = 0.95; shockRisk = 0.90; break;
      }
    } else {
      // 비관통 — 작은 shock만, 출혈 없음
      shockRisk = (outcome === OUTCOME.BLOCK) ? 0.25 : 0.10;
    }
    // 탄종 medical profile (있으면 보정)
    // SHOTGUN-PHYS-CLUSTER-1 Phase1 §2: ammoMedicalProfile fallback — weapon에 없으면 ammo에서 조회(산탄 medical 보정이 즉시 생리에도 반영되게)
    const _ammoObj = (weapon && weapon._ammo) || ((weapon && weapon.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[weapon.ammoId] : null);
    const ammoProf = (weapon && weapon.ammoMedicalProfile) || ((typeof getAmmoMedicalProfile === 'function') ? getAmmoMedicalProfile(_ammoObj) : null) || null;
    if (ammoProf) {
      if (ammoProf.bleedChance != null) bleedRisk *= ammoProf.bleedChance;
      if (ammoProf.shockChance != null) shockRisk *= ammoProf.shockChance;
    }
    // 2A-6.4 마감: 백커 충족도 → shock 보정 (백커 부족 시 shock↑, 충족 시 shock↓)
    shockRisk *= shockMod;
    // SIDE-AMMO-1B §6: API/API-T 관통 후 내부 소이 효과 — 관통 성공시에만 소폭 보정 (화상 wound/지속피해 없음)
    let _incPainMul = 1.0, _incTissueMul = 1.0;
    const _incAmmo = (weapon && weapon._ammo) || null;
    const _inc = (typeof _incendiaryInfo === 'function') ? _incendiaryInfo(_incAmmo) : null;
    if (_inc && armorResult === 'penetrated') {
      _incTissueMul = _inc.postPenInternalDamageMul;
      shockRisk *= _inc.postPenShockMul;
      _incPainMul = _inc.postPenPainMul;
      if (GAME.debugUtility) log(`[debug] ${_incAmmo.id} API 관통: 내부 소이 효과 / 피해 소폭 증가`, 'info');
    } else if (_inc && armorResult !== 'penetrated') {
      if (GAME.debugUtility) log(`[debug] ${_incAmmo.id} API 탄착: flash/scorch / 관통 실패 (내부피해 없음)`, 'info');
    }
    // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1: 세부주소 감쇠 (≤1.0). applyOutcome에서만 tissue/pain/bleed/shock 감쇠.
    //   원본 물리값(rawDamage/penetration/velocity/energy/terminal/internalScores)은 불변. applyDamageEvent에서 재감쇠 금지.
    const _hap = (ctx && ctx.impactAddress && ctx.impactAddress.hitAddressDamageProfile) || null;
    const _hapDmg = _hap ? _hap.damageMul : 1.0;
    const _hapWound = _hap ? _hap.woundMul : 1.0;
    const _hapPain = _hap ? _hap.painMul : 1.0;
    const _hapBleed = _hap ? _hap.bleedMul : 1.0;
    const _hapShock = _hap ? _hap.shockMul : 1.0;
    const _tissueAtten = ((armorResult === 'penetrated') ? bodyDmg * _incTissueMul : 0) * _hapDmg;
    const _painAtten = (weapon && weapon.painMul != null ? weapon.painMul : 1.0) * painMod * bodyDmg * 1.2 * _incPainMul * _hapPain;
    const _origRaw = dmgFull;
    const _effRaw = dmgFull * _hapWound;
    applyDamageEvent(target, {
      sourceType: 'bullet',
      hitPart: bodyPart, isLeft,
      hitZone: ctx && ctx.location,
      rawDamage: dmgFull,
      originalRawDamage: _origRaw, effectiveRawDamage: _effRaw,
      hitAddressDamageProfile: _hap, hitAddressDamageMul: _hapDmg, hitAddressWoundMul: _hapWound, hitAddressPhysiologyMul: (_hap ? _hap.physiologyMul : 1.0),
      // 비관통(stopped/deflected) — tissue 관통 X, 둔상으로 처리. 관통 tissue는 세부주소 감쇠 적용.
      tissueDamage: _tissueAtten,
      armorResult,
      bleedRisk: bleedRisk * _hapBleed, shockRisk: shockRisk * _hapShock,
      bluntTrauma: (armorResult === 'penetrated') ? 0
                 : (outcome === OUTCOME.BLOCK) ? dmgFull * 0.4
                 : dmgFull * 0.25,   // LIGHT non-penetrated: 둔상 (보수적, 방호 결과 불변)
      // 2A-6.4 마감: 백커 충족도 → pain 보정 (백커 부족 시 통증↑) — painAmount에만 적용(중복 방지)
      painAmount: _painAtten,
      ammoMedicalProfile: ammoProf,
      ammoId: (weapon && weapon._ammo && weapon._ammo.id) || (weapon && weapon.ammoId) || null,
      weaponId: weapon && weapon.id || null,
      fragmentPenetrated: !!(ctx && ctx.fragmentPenetrated),
      terminalEffect: weapon && weapon.terminalEffect,
      impactAddress: (ctx && ctx.impactAddress) || null,
      // [IMPACT-A Phase1] canonical impact packet — computeWoundSize가 원본 kinetics를 읽는 경로
      impactPacket: (ctx && ctx.impactPacket) || null,
      // SIDE-ARMOR-2C §5: coverage 메타 — AAR/wound 표시용
      armorHitResult: (ctx && ctx.armorHitResult) || null,
      coverageSource: (ctx && ctx.armorHitResult && ctx.armorHitResult.coverageSource) || null,
      selectedLayerType: (ctx && ctx.armorHitResult && ctx.armorHitResult.selectedLayerType) || null,
      durabilityOwnerId: (ctx && ctx.armorHitResult && ctx.armorHitResult.durabilityOwnerId) || null,
      _shotVelocity: (ctx && ctx.shotVelocity) != null ? ctx.shotVelocity : null,
      _shotInitialVelocity: (ctx && ctx.shotInitialVelocity) != null ? ctx.shotInitialVelocity : null,
      _continuationDepth: (ctx && ctx.continuationDepth) || 0,
      _entryArmorContext: (ctx && ctx.entryArmorContext) || null,
      // SHOTGUN-MED-NORM-1 §13: 산탄 pellet 그룹 메타 (wound까지 전달)
      pelletGroupId: (ctx && ctx.pelletGroupId) || null, pelletIndex: (ctx && ctx.pelletIndex), pelletCount: (ctx && ctx.pelletCount),
      shotgunPellet: !!(ctx && ctx.shotgunPellet), shotgunAmmoId: (ctx && ctx.shotgunAmmoId) || null, shotgunPatternType: (ctx && ctx.shotgunPatternType) || null,
    });
    // legacy dmg값 — UI/로그용으로만 (실제 hp는 syncLegacyCombatState가 lifeStatus로 갱신함)
    dmg = Math.round(dmgFull * (BODY_HP_BLEED[bodyPart] || 0.5));
  } else if (severity == null) {
    dmg = 0;
  } else {
    // medical 없음 — fallback (개발 중 안전망)
    dmg = Math.round(dmgFull);
  }

  // [0.39.1 Fix1] acute response가 suppression을 적용한 hit(medical)은 legacy supGain 중복 금지.
  //   MISS/NEAR/비medical은 기존대로 supGain 적용 (acute 미발생 경로).
  if (!(target._acuteHandledThisHit && target.medical)) {
    target.suppression = Math.min(100, target.suppression + supGain);
  }

  // === stoppingPower / pain 적용 ===
  //   - severity가 있고 부위 손상이 있을 때만 적용 (MISS/NEAR는 X)
  //   - 부위/관통/severity로 계수 결정
  //   - 방호 차단도 약한 stopping/pain
  if (severity != null && weapon) {
    const sp = (weapon.stoppingPower != null) ? weapon.stoppingPower : 1.0;
    const pm = (weapon.painMul != null) ? weapon.painMul : 1.0;
    const wasPenetrated = !!(ctx && ctx.penetrated) && outcome !== OUTCOME.BLOCK;
    // 부위별 stopping 가중 — 머리/가슴/복부 크게, 팔/다리 보통, BLOCK 약하게
    let stopBodyMul = 1.0;
    if (bodyPart === 'head')         stopBodyMul = 1.7;
    else if (bodyPart === 'chest')   stopBodyMul = 1.4;
    else if (bodyPart === 'abdomen') stopBodyMul = 1.2;
    else if (bodyPart === 'arms')    stopBodyMul = 0.85;
    else if (bodyPart === 'legs')    stopBodyMul = 0.95;
    // severity 가중
    let sevStopMul = 1.0;
    if (severity === SEVERITY.GRAZE)        sevStopMul = 0.30;
    else if (severity === SEVERITY.LIGHT)   sevStopMul = 0.60;
    else if (severity === SEVERITY.SERIOUS) sevStopMul = 1.10;
    else if (severity === SEVERITY.CRITICAL) sevStopMul = 1.50;
    // 방호로 막힌 경우 — bluntRatio 기반으로 stopping/pain 조정
    //   재질이 아라미드/세라믹이면 막아도 큰 충격, 티타늄/복합소재면 작은 충격
    //   ctx에 저장된 _bluntRatio 사용 (BLOCK 처리에서 세팅)
    if (!wasPenetrated) {
      const bRatio = (ctx && ctx._bluntRatio != null) ? ctx._bluntRatio
                   : getMaterialBluntRatio((ctx && ctx.blockMaterial) || null);
      // 기존 0.45 고정값 대신 bluntRatio 기반 (0.25~0.70 범위)
      sevStopMul *= (0.20 + bRatio * 0.50);
    }
    // SHOTGUN-PHYS-CLUSTER-1 Phase2 §5: 산탄 펠릿당 순간 저지력 보정 (완전 제거 아님 — buck 근거리 유지, flechette per-dart 낮춤)
    const _stopAmmo = (weapon && weapon._ammo) || ((weapon && weapon.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[weapon.ammoId] : null);
    const _pelletStop = getShotgunPelletAcutePhysiologyMeta(ctx || {}, _stopAmmo);
    const _pelletStopMul = _pelletStop.isShotgunPellet ? _pelletStop.stoppingMul : 1.0;
    const stopRes = applyStopping(target, sp * _pelletStopMul, weapon, { severityMul: stopBodyMul * sevStopMul, skipIfAcute: !!target.medical });
    target._lastStoppedFire = (target.medical && target._lastStoppedFire) ? target._lastStoppedFire : (stopRes && stopRes.stoppedFire);

    // pain 증가 — severity와 부위와 painMul로 결정
    let painGain = 0;
    if (severity === SEVERITY.GRAZE)        painGain = 4;
    else if (severity === SEVERITY.LIGHT)   painGain = 12;
    else if (severity === SEVERITY.SERIOUS) painGain = 28;
    else if (severity === SEVERITY.CRITICAL) painGain = 50;
    // 부위 가중
    if (bodyPart === 'head')        painGain *= 1.20;
    else if (bodyPart === 'chest')  painGain *= 1.15;
    else if (bodyPart === 'abdomen') painGain *= 1.10;
    else if (bodyPart === 'arms')   painGain *= 0.85;
    else if (bodyPart === 'legs')   painGain *= 0.90;
    // 방호 차단 시 — bluntRatio 반영
    if (!wasPenetrated) {
      const bRatio = (ctx && ctx._bluntRatio != null) ? ctx._bluntRatio
                   : getMaterialBluntRatio((ctx && ctx.blockMaterial) || null);
      // 0.25~0.75 범위 (재질에 따라 둔상통 강도 차이)
      painGain *= (0.25 + bRatio * 0.50);
    }
    painGain *= pm;
    // 2A-6.4 마감: 백커 보정 — legacy painGain은 medical 없는 유닛에만 실행되므로 painAmount와 중복 안 됨
    painGain *= painMod;
    // === medical 있으면 pain은 applyDamageEvent에서 단일 처리 ===
    //   addPain은 medical 없는 유닛(legacy fallback)에만 적용
    if (!target.medical) {
      addPain(target, painGain);
    }

    // === 출혈 부여 ===
    //   medical 있는 유닛은 applyDamageEvent에서 이미 bleedRate를 부여함
    //   legacy bleeding 태그(none/light/heavy/critical)는 syncLegacyCombatState가 갱신
    //   여기 코드는 medical 없는 유닛(사격장 등)에만 적용
    const ammo = weapon && weapon._ammo;
    const med = getAmmoMedicalProfile(ammo);
    if (!target.medical && wasPenetrated && severity !== SEVERITY.GRAZE) {
      let bleedProb = med.bleedChance;
      if (ctx && ctx._terminalBleedMul != null) bleedProb *= ctx._terminalBleedMul;
      if (severity === SEVERITY.LIGHT)         bleedProb *= 0.5;
      else if (severity === SEVERITY.SERIOUS)  bleedProb *= 1.1;
      else if (severity === SEVERITY.CRITICAL) bleedProb *= 1.5;
      if (bodyPart === 'arms' || bodyPart === 'legs') bleedProb *= 1.0;
      else if (bodyPart === 'abdomen')                bleedProb *= 1.20;
      else if (bodyPart === 'chest')                  bleedProb *= 1.00;
      else                                            bleedProb *= 0.3;
      bleedProb = Math.min(0.95, bleedProb);
      if (Math.random() < bleedProb) {
        const sevMul = med.bleedSeverityMul;
        const ranks = { none:0, light:1, heavy:2, critical:3 };
        let newRank;
        if (severity === SEVERITY.CRITICAL) {
          newRank = (Math.random() < Math.min(0.85, 0.45 * sevMul)) ? 3 : 2;
        } else if (severity === SEVERITY.SERIOUS) {
          newRank = (Math.random() < Math.min(0.75, 0.30 * sevMul)) ? 2 : 1;
          if (sevMul >= 1.45 && Math.random() < 0.15) newRank = 3;
        } else {
          newRank = 1;
          if (sevMul >= 1.40 && Math.random() < 0.20) newRank = 2;
        }
        if ((bodyPart === 'abdomen' || bodyPart === 'chest') && newRank < 3 && Math.random() < 0.25) newRank++;
        const cur = ranks[target.bleeding] || 0;
        if (newRank > cur) {
          const labels = ['none','light','heavy','critical'];
          target.bleeding = labels[newRank];
          target.bleedingLoc = bodyPart;
          target.bleedingTime = 0;
          if (target.team === 'friend') {
            const tag = newRank === 3 ? '치명' : newRank === 2 ? '심함' : '경미';
            log(`[${target.name}] 출혈 ${tag} (${BODY_PART_KOR[bodyPart]||bodyPart})`, newRank>=2 ? 'danger' : 'warn');
          }
        }
      }
    }

    // === 골절 부여 ===
    //   탄약 fractureChance + bluntTraumaMul. AP/penetrator도 골절 위험 높음.
    //   관통 시: fractureChance 기준. blunt-only: fractureChance × bluntTraumaMul × bluntRatio.
    // === 골절 / 둔상 ===
    //   medical 있는 유닛은 applyDamageEvent에서 fracture 처리됨
    if (!target.medical)
    {
      let fxProb = med.fractureChance;
      if (severity === SEVERITY.LIGHT)         fxProb *= 0.5;
      else if (severity === SEVERITY.SERIOUS)  fxProb *= 1.1;
      else if (severity === SEVERITY.CRITICAL) fxProb *= 1.5;
      if (!wasPenetrated) {
        const bRatio = (ctx && ctx._bluntRatio != null) ? ctx._bluntRatio
                     : getMaterialBluntRatio((ctx && ctx.blockMaterial) || null);
        fxProb *= med.bluntTraumaMul * bRatio;
      }
      if (bodyPart !== 'arms' && bodyPart !== 'legs' && bodyPart !== 'chest') fxProb *= 0;
      fxProb = Math.min(0.85, fxProb);
      if (fxProb > 0 && Math.random() < fxProb) {
        let newFx = null;
        if (bodyPart === 'arms') newFx = 'arm';
        else if (bodyPart === 'legs') newFx = 'leg';
        else if (bodyPart === 'chest') newFx = 'chest';
        if (newFx) {
          if (target.fracture === 'none')      target.fracture = newFx;
          else if (target.fracture !== newFx)  target.fracture = 'multiple';
          if (target.team === 'friend') log(`[${target.name}] 골절 (${BODY_PART_KOR[bodyPart]||bodyPart})`, 'warn');
        }
      }
    }

    // === 쇼크 / 의식상실 ===
    //   medical 있는 유닛은 applyDamageEvent에서 shock/consciousness 처리됨
    if (!target.medical && wasPenetrated && (severity === SEVERITY.SERIOUS || severity === SEVERITY.CRITICAL)) {
      let shockProb = med.shockChance;
      if (ctx && ctx._terminalShockMul != null) shockProb *= ctx._terminalShockMul;
      if (severity === SEVERITY.CRITICAL) shockProb *= 1.5;
      if (bodyPart === 'head')        shockProb *= 1.6;
      else if (bodyPart === 'chest')  shockProb *= 1.2;
      else if (bodyPart === 'abdomen') shockProb *= 1.1;
      shockProb = Math.min(0.90, shockProb);
      if (Math.random() < shockProb) {
        if (target.isDowned && target.conscious) {
          target.conscious = false;
          if (target.team === 'friend') log(`[${target.name}] 쇼크로 의식 잃음`, 'danger');
        } else if (!target.isDowned) {
          target.pain = Math.min(100, (target.pain || 0) + 15);
        }
      }
    }

    // 큰 충격은 큰 stopping → "사격 중단" 로그 (strong cases만)
    if (target.shotQueue == null && severity === SEVERITY.CRITICAL && wasPenetrated && (bodyPart === 'head' || bodyPart === 'chest')) {
      // shotQueue가 있다가 위에서 break됐다면 이미 null. 여기서는 추가 로그는 fireSingleShot에서 처리.
    }
  }
  // updateCombatState에서 alive/combatState 갱신 (전체 hp 0이거나 부위 치명일 때)
  if (severity != null) {
    updateCombatState(target);

    // === 머리/목 관통 별도 판정 ===
    //   bodyHp 임계와 무관하게, head 계열이 관통되고 손상이 충분하면 즉시 상태 강제.
    //   방호로 막힌 경우(penetrated=false 또는 BLOCK)는 적용하지 않음 (suppression만 가산).
    const isHeadHit = (ctx && ctx.location === 'head_skull')
                   || (ctx && ctx.location === 'head_temporal')
                   || (ctx && ctx.location === 'head_face')
                   || (ctx && ctx.location === 'neck');
    const wasPenetrated = !!(ctx && ctx.penetrated) && outcome !== OUTCOME.BLOCK;
    // === medical 있는 유닛은 applyDamageEvent가 head/neck 치명 처리 (lifeStatus/consciousness/deathReason) ===
    //   legacy 강제 dead/downed는 medical 없는 fallback 유닛에만 적용
    if (isHeadHit && wasPenetrated && target.alive !== false && !target.medical) {
      let forced = null;
      if (severity === SEVERITY.CRITICAL) {
        forced = (Math.random() < 0.90) ? 'dead' : 'downed';
      } else if (severity === SEVERITY.SERIOUS) {
        forced = (Math.random() < 0.70) ? 'downed' : 'dead';
      } else if (severity === SEVERITY.LIGHT) {
        if (Math.random() < 0.20) forced = 'downed';
      }
      if (forced) {
        if (forced === 'dead') {
          target.combatState = 'dead';
          target.isDead = true;
          target.isDowned = false;
          target.conscious = false;
          target.alive = false; target.hp = 0;
          target.canBeDragged = false;
          if (target.bodyHp) target.bodyHp.head = 0;
          target.shotQueue = null;
          target.movePath = [];
        } else if (forced === 'downed') {
          target.combatState = 'downed';
          target.isDowned = true;
          target.canBeDragged = true;
          target.downedTime = 0;
          target.conscious = (Math.random() < 0.25);
          target.alive = true;
          target.shotQueue = null;
          target.movePath = [];
          target.stance = 'prone';
        }
      }
    }
    // === medical 유닛의 head/neck 치명 처리 강화 ===
    //   applyDamageEvent에서 이미 처리됐지만, 사격 outcome KILL/SERIOUS이고 head/neck 관통인 경우 보정
    else if (isHeadHit && wasPenetrated && target.medical) {
      const med = target.medical;
      if (severity === SEVERITY.CRITICAL) {
        // 치명상 관통 — [IMPACT-A Phase2] consciousness 즉시 급락 (physiological shock 경유 금지, 직접 신경학적 손상)
        med.consciousness = Math.max(0, med.consciousness - 60);
        med.transientNeurologicDisruption = Math.max(med.transientNeurologicDisruption || 0, 60);
        if (ctx && ctx.location === 'neck') {
          // 목 — 호흡 + 외부 출혈 추가
          med.breathingEfficiency = Math.max(15, med.breathingEfficiency - 35);
          if (med.bodyParts.neck) med.bodyParts.neck.externalBleedRate += 40;
        }
        if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(target);
        if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(target);
      } else if (severity === SEVERITY.SERIOUS) {
        med.consciousness = Math.max(0, med.consciousness - 30);
        med.transientNeurologicDisruption = Math.max(med.transientNeurologicDisruption || 0, 30);
        if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(target);
        if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(target);
      }
    }
  } else if (target.hp <= 0 && target.alive && !target.medical) {
    // legacy fallback만
    target.alive = false; target.hp = 0; target.combatState = 'dead';
    target.isDead = true; target.conscious = false;
  }
  return { dmg, supGain, outcome, severity, bodyPart };
}

// =============================================================
