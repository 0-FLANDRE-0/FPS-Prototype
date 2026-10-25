// FRACTURE-FUNC-SYNC-1 Phase1 §2: 골절 타입별 기능률 저하 공통 helper (fractureEvidence ↔ functionRatio 동기화).
function recomputeBodyPartFunctionRatio(part, partDestruction) {
  if (!part) return 1;
  let ratio = (part.maxHp > 0) ? (part.hp / part.maxHp) : 0;
  ratio = Math.max(0, Math.min(1, ratio));
  if (part.fracture) {
    const ft = part.fractureType || 'simple';
    let fractureMul = 0.5;
    if (ft === 'hairline') fractureMul = 0.75;
    else if (ft === 'simple') fractureMul = 0.55;
    else if (ft === 'displaced') fractureMul = 0.40;
    else if (ft === 'comminuted') fractureMul = 0.28;
    else if (ft === 'shattered') fractureMul = 0.18;
    ratio *= fractureMul;
  }
  // PART-DESTRUCTION-1 Phase5 §9: 부위파괴 기능 상한 적용 (인자 우선, 없으면 part에 복사된 값 사용)
  const cap = (partDestruction && partDestruction.functionalCap != null) ? partDestruction.functionalCap
            : (part.destructionFunctionalCap != null ? part.destructionFunctionalCap : null);
  if (cap != null) ratio = Math.min(ratio, cap);
  const st = (partDestruction && partDestruction.state) || part.destructionState;
  // [B-STAGE 10.2] 최종 상태는 cap 이하로 강제하고 disabled 계약을 지킨다.
  if (st && PD_DISABLED_STATES.indexOf(st) >= 0) {
    const stCap = PART_DESTRUCTION_FUNCTIONAL_CAP[st];
    ratio = Math.min(ratio, stCap != null ? stCap : 0);
    part.disabled = true;
  } else if (st === 'mangled') ratio = Math.min(ratio, 0.20);
  else if (st === 'impaired') ratio = Math.min(ratio, 0.60);
  // HP 소진은 기능상실(구조적 파괴 라벨과 별개)
  if (part.hp <= 0) { ratio = 0; part.disabled = true; }
  part.functionRatio = +ratio.toFixed(3);
  return part.functionRatio;
}

// ════════════════════════════════════════════════════════════════════════════
// [IMPACT-A Phase2] Acute Impact Response — 피격 직후 급성반응을 단일 helper로 통합.
//   출력은 stopping/pain/suppression/aim/stagger/neuro. medical.shock·bloodMl·BP·perfusion을
//   절대 직접 변경하지 않는다(그건 physiological shock 경로 전용). 새 RNG 미소비(결정적).
//   "맞아서 순간 멈춤 ≠ 순환성 쇼크" 분리를 코드로 강제한다.
// ════════════════════════════════════════════════════════════════════════════
function computeAcuteImpactResponse(ev, partKey, sourceType, bodyDmg, pelletAcute) {
  const dmg = Math.max(0, bodyDmg || 0);
  const penetrated = (ev.armorResult === 'penetrated');
  // 급성 강도 — 부위별 가중(놀람/동작중단), physiological과 무관.
  let stoppingIntensity = dmg * 0.5;
  if (partKey === 'chest' || partKey === 'abdomen') stoppingIntensity *= 1.4;
  else if (partKey === 'head' || partKey === 'neck') stoppingIntensity *= 1.3;
  if (sourceType === 'blast') stoppingIntensity += 8;
  const painImpulse = dmg * 1.0 + (penetrated ? 4 : 0);
  const suppressionImpulse = Math.min(30, dmg * 0.6 + (sourceType === 'blast' ? 10 : 0));
  const aimDisruption = Math.min(1.0, dmg * 0.02 + (penetrated ? 0.15 : 0.05));
  const fireInterruptChance = Math.min(0.95, 0.3 + dmg * 0.02);
  // stagger/knockdown — 큰 급성 충격 시 짧게 (생리학적 downed와 구분)
  const staggerIntensity = (dmg >= 25 || (penetrated && (partKey === 'chest' || partKey === 'head'))) ? Math.min(1.0, dmg * 0.02) : 0;
  const knockdownDuration = staggerIntensity > 0 ? Math.min(1.5, 0.4 + staggerIntensity * 0.8) : 0;
  // 산탄 펠릿 급성 보정 (physiological shock 아님 — stopping/pain load만)
  let sMul = 1.0, pMul = 1.0;
  if (pelletAcute && pelletAcute.isShotgunPellet) {
    sMul = (pelletAcute.shockMul != null) ? pelletAcute.shockMul : 1.0;
    pMul = (pelletAcute.painMul != null) ? pelletAcute.painMul : 1.0;
  }
  return {
    stoppingIntensity: +(stoppingIntensity * sMul).toFixed(2),
    stoppingDuration: +Math.min(1.2, 0.2 + stoppingIntensity * 0.02).toFixed(3),
    fireInterruptChance: +fireInterruptChance.toFixed(3),
    aimDisruption: +aimDisruption.toFixed(3),
    suppressionImpulse: +suppressionImpulse.toFixed(2),
    painImpulse: +(painImpulse * pMul).toFixed(2),
    staggerIntensity: +staggerIntensity.toFixed(3),
    knockdownDuration: +knockdownDuration.toFixed(3),
    postureDisruption: staggerIntensity > 0.4,
    transientNeurologicDisruption: (partKey === 'head' && penetrated) ? 40 : (partKey === 'neck' && penetrated ? 20 : 0),
    stressStimulus: +Math.min(1.0, dmg * 0.015 + (penetrated ? 0.2 : 0.05)).toFixed(3),
  };
}
function applyDamageEvent(unit, ev) {
  if (!unit || !unit.medical || unit.isDead) return;
  const m = unit.medical;
  ev = ev || {};
  const sourceType = ev.sourceType || 'bullet';
  const armorResultRaw = ev.armorResult || 'penetrated';   // 원본 (deflected/ricocheted 보존)
  let armorResult = armorResultRaw;
  // === 2A-1 일관성: deflected/ricocheted는 관통 아님 — 처리상으로는 stopped (둔상만)
  //   _lastDamageEvent에는 armorResultRaw를 별도 보존해 AAR/debug 일관성 유지
  if (armorResult === 'deflected' || armorResult === 'ricocheted') armorResult = 'stopped';
  const partKey = resolveBodyPartKey(ev.hitPart, ev.isLeft);
  const part = m.bodyParts[partKey];
  // SHOTGUN-PHYS-CLUSTER-1 Phase2 §4: 산탄 펠릿 즉시 생리 보정 (펠릿당 shock/pain/bodyDmg 과누적 방지)
  const _acuteAmmo = (ev.ammoId && typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[ev.ammoId] : null;
  const pelletAcute = getShotgunPelletAcutePhysiologyMeta(ev, _acuteAmmo);
  if (!part) return;

  // === 1) 부위 HP 감소 ===
  let bodyDmg = 0;
  if (armorResult === 'stopped') {
    // armor stopped — direct tissue damage 거의 없음, blunt trauma 위주
    const blunt = (ev.bluntTrauma != null) ? ev.bluntTrauma : Math.max(1, (ev.rawDamage || 0) * 0.10);
    bodyDmg = blunt * 0.5;
  } else if (armorResult === 'absorbed') {
    bodyDmg = (ev.bluntTrauma || 0) * 0.3;
  } else {
    // penetrated — tissueDamage 또는 rawDamage * tissueMul
    const tMul = (ev.ammoMedicalProfile && ev.ammoMedicalProfile.tissueDamageMul) || 1.0;
    bodyDmg = (ev.tissueDamage != null) ? ev.tissueDamage : (ev.rawDamage || 0) * tMul;
    // 사지는 부위 HP는 많이 깎이지만 생명 영향은 낮음
    if (partKey === 'leftArm' || partKey === 'rightArm' || partKey === 'leftLeg' || partKey === 'rightLeg') {
      bodyDmg *= 1.0;   // 그대로
    }
  }
  bodyDmg = Math.max(0, bodyDmg);
  if (pelletAcute.isShotgunPellet) bodyDmg *= pelletAcute.bodyDmgMul;   // 산탄 펠릿 즉시 조직손상 보정
  part.hp = Math.max(0, part.hp - bodyDmg);

  // === 2) 출혈 — external (사지/목/노출) vs internal (흉부/복부) ===
  let bleedAdded = 0;
  let internalBleedAdded = 0;
  // 2A-6.4 마감: 막힌 탄/막힌 파편(stopped 계열)은 관통상 출혈 생성 금지 (안전장치만 추가, 기존 frag 출혈은 유지).
  // SIDE-MED-BASELINE-1 §3/§4: 아래 bodyParts bleedRate 가산은 '피격 즉시 반응 / legacy fallback'이다.
  //   recordWoundFromDamageEvent로 wound가 생기면 다음 tick부터 wound.bleedingProfile이 source-of-truth가 되어
  //   updateMedicalBleedingWoundBased가 bodyParts 값을 '=' 대입으로 덮어쓴다(이중 적용 아님). wound 없을 때만 이 값이 지속된다.
  const _stoppedFamily = (armorResult === 'stopped' || armorResult === 'absorbed');
  if ((armorResult === 'penetrated' || sourceType === 'frag') && !_stoppedFamily) {
    // 부위별 외부/내부 출혈 분리
    const isLimbOrNeck = (partKey === 'leftArm' || partKey === 'rightArm'
                       || partKey === 'leftLeg' || partKey === 'rightLeg' || partKey === 'neck');
    const isTorso = (partKey === 'chest' || partKey === 'abdomen');
    // 출혈 등급 결정 — bleedRisk 우선, 없으면 rawDamage 기반
    let sev = 'light';
    const risk = ev.bleedRisk || 0;
    if (risk > 0.8 || bodyDmg > 30) sev = 'severe';
    else if (risk > 0.5 || bodyDmg > 18) sev = 'medium';
    else if (risk > 0.25 || bodyDmg > 8) sev = 'light';
    else sev = 'micro';
    const rate = bleedRateForSeverity(sev);
    if (isTorso) {
      // 흉부/복부 — 외부 30% / 내부 70%
      part.externalBleedRate += rate * 0.3;
      part.internalBleedRate += rate * 0.7;
      bleedAdded = rate * 0.3;
      internalBleedAdded = rate * 0.7;
    } else if (isLimbOrNeck) {
      part.externalBleedRate += rate;
      bleedAdded = rate;
    } else if (partKey === 'head') {
      // 머리 — 외부 60% / 내부 40%
      part.externalBleedRate += rate * 0.6;
      part.internalBleedRate += rate * 0.4;
      bleedAdded = rate * 0.6;
      internalBleedAdded = rate * 0.4;
    }
  } else if (sourceType === 'blast') {
    // 폭압 — 내부 손상 위주
    if (partKey === 'chest' || partKey === 'abdomen' || partKey === 'head') {
      part.internalBleedRate += 3.0;
      internalBleedAdded = 3.0;
    }
  }

  // === 3) Pain ===
  const painAdd = (ev.painAmount != null) ? ev.painAmount : (bodyDmg * 1.2 + (armorResult === 'stopped' ? 5 : 0));
  const painAddEff = pelletAcute.isShotgunPellet ? painAdd * pelletAcute.painMul : painAdd;
  part.pain += painAddEff * 0.6;
  m.pain = Math.min(100, m.pain + painAddEff);

  // === 4) Acute Impact Response (급성 피격반응) — [IMPACT-A Phase2] ===
  //   피격 직후의 놀람/동작중단/자세붕괴/신경학적 충격은 physiological shock와 분리한다.
  //   medical.shock / bloodMl / BP / perfusion / oxygen / compensation을 직접 건드리지 않는다.
  //   physiological shock는 오직 시간경과 출혈·저관류(updatePainShockConsciousness)에서만 상승한다.
  const acute = computeAcuteImpactResponse(ev, partKey, sourceType, bodyDmg, pelletAcute);
  m._acuteResponse = acute;   // 추적 가능한 단일 급성반응 결과
  // [0.39.1 Fix1] acute response를 실제 전투상태에 연결 (source-of-truth). medical.shock는 여전히 미조작.
  //   중복 방지: 이 유닛은 legacy applyStopping 블록을 건너뛴다(_acuteHandledThisHit 플래그).
  {
    // stoppingDuration → stoppingTimer
    if (acute.stoppingDuration > 0) unit.stoppingTimer = Math.max(unit.stoppingTimer || 0, acute.stoppingDuration);
    // aimDisruption → aimTimer 감소 (조준 방해)
    if (acute.aimDisruption > 0) unit.aimTimer = Math.max(0, (unit.aimTimer || 0) - acute.aimDisruption * 0.6);
    // suppressionImpulse → suppression
    if (acute.suppressionImpulse > 0) unit.suppression = Math.min(100, (unit.suppression || 0) + acute.suppressionImpulse);
    // fireInterruptChance → shotQueue 중단 (진행 중 사격 묶음)
    if (unit.shotQueue && acute.fireInterruptChance > 0 && Math.random() < acute.fireInterruptChance) {
      unit.shotQueue = null;
      unit._lastStoppedFire = true;
    }
    // [0.39.2 Fix1] postureDisruption/knockdownDuration → unit.impactKnockdownTimer (단일 source-of-truth).
    //   실제 자세·이동·사격 게이트에서 소비된다(canFire/movement/stance). stoppingTimer와 중복 적용 안 함.
    if (acute.postureDisruption && acute.knockdownDuration > 0) {
      unit.impactKnockdownTimer = Math.max(unit.impactKnockdownTimer || 0, acute.knockdownDuration);
      unit._knockdownStanceApplied = false;   // tick에서 강제 prone 진입 처리
    }
    unit._acuteHandledThisHit = true;   // applyOutcome legacy stopping 중복 방지
  }
  // 급성 → knockdown alias 유지 (compatibility만; unit.impactKnockdownTimer가 실제 source-of-truth)
  m.impactKnockdownTimer = unit.impactKnockdownTimer || 0;
  // 산탄 cluster governor용 급성 부하 (physiological shock 아님)
  if (pelletAcute.isShotgunPellet) {
    m._acuteResponseLoad = (m._acuteResponseLoad || 0) + acute.stoppingIntensity;
  }

  // === 5) Breathing — chest/blast 영향 ===
  if (partKey === 'chest' && armorResult === 'penetrated') {
    m.breathingEfficiency = Math.max(20, m.breathingEfficiency - 25);
  } else if (sourceType === 'blast' && (partKey === 'chest' || partKey === 'head')) {
    m.breathingEfficiency = Math.max(30, m.breathingEfficiency - 15);
  } else if (partKey === 'chest') {
    m.breathingEfficiency = Math.max(50, m.breathingEfficiency - 8);
  }

  // === 6) Consciousness — head/neck 직접 신경학적 손상 (medical.shock 경유 금지) ===
  //   [IMPACT-A Phase2] 실제 관통 + head/neck 구조 손상 근거가 있을 때만 즉각 의식저하(transientNeurologicDisruption).
  //   generic torso shock 공식을 head/neck에 적용하지 않는다. 즉사·영구 의식상실은 기존 치명 손상 근거 유지.
  if (partKey === 'head' && armorResult === 'penetrated') {
    m.consciousness = Math.max(0, m.consciousness - 40);
    m.transientNeurologicDisruption = Math.max(m.transientNeurologicDisruption || 0, 40);
    if (part.hp <= 0) {
      m.consciousness = 0;
      m.deathReason = 'head_critical';
    }
  } else if (partKey === 'neck' && armorResult === 'penetrated') {
    m.consciousness = Math.max(20, m.consciousness - 20);
    m.transientNeurologicDisruption = Math.max(m.transientNeurologicDisruption || 0, 20);
  }
  // (기존의 "m.shock>80 → consciousness" 즉시감소 제거 — 의식은 physiological 경로(updatePainShockConsciousness)에서 처리)

  // === 7) Fracture / functionRatio ===
  //   복부(abdomen)는 골격이 없는 연부조직이므로 골절 발생 X — 내부장기 손상은 internalBleedRate로 표현
  //   ORGANIC-BLEED-CLEANUP-1 §1: medical wound 생성 유닛은 buildFractureEvidence()가 fracture source-of-truth.
  //     legacy 랜덤 판정은 wound descriptor 비활성/실패 fallback으로만 실행 (중복 방지).
  const canFracture = (partKey !== 'abdomen');
  const _useLegacyFracture = (ev.disableWoundDescriptor === true) || (ev._woundDescriptorFailed === true);
  if (_useLegacyFracture) {
    if (canFracture && armorResult === 'penetrated' && bodyDmg > 15) {
      if (Math.random() < 0.3) part.fracture = true;
    } else if (canFracture && sourceType === 'blast' && bodyDmg > 8) {
      if (Math.random() < 0.4) part.fracture = true;
    }
  }
  // functionRatio = hp/maxHp + fracture penalty (FRACTURE-FUNC-SYNC-1: 골절 타입별 helper)
  recomputeBodyPartFunctionRatio(part);

  // === 8) 디버그 로그 ===
  m._lastDamageEvent = {
    sourceType, partKey, hitPart: ev.hitPart,
    armorResult,          // 처리용 (stopped/penetrated/absorbed)
    armorResultRaw,       // 원본 (deflected/ricocheted 보존 — AAR/debug 일관성)
    rawDamage: ev.rawDamage, bodyDmg, bleedAdded, internalBleedAdded,
    painAdd, shockAdd: 0, acuteResponseLoad: (acute ? acute.stoppingIntensity : 0), stoppingLoad: (acute ? acute.stoppingIntensity : 0), painLoad: (acute ? acute.painImpulse : 0), partHpAfter: part.hp,
    impactAddress: ev.impactAddress || null,
    // SIDE-HIT-ADDRESS-DEBUG-1A §1-A: 피격주소 감쇠 추적 필드 복사 (debug/AAR/의료 UI)
    hitAddressDamageProfile: ev.hitAddressDamageProfile || (ev.impactAddress && ev.impactAddress.hitAddressDamageProfile) || null,
    hitAddressDamageMul: (ev.hitAddressDamageMul != null) ? ev.hitAddressDamageMul : null,
    hitAddressWoundMul: (ev.hitAddressWoundMul != null) ? ev.hitAddressWoundMul : null,
    hitAddressPhysiologyMul: (ev.hitAddressPhysiologyMul != null) ? ev.hitAddressPhysiologyMul : null,
    originalRawDamage: (ev.originalRawDamage != null) ? ev.originalRawDamage : null,
    effectiveRawDamage: (ev.effectiveRawDamage != null) ? ev.effectiveRawDamage : null,
    // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 파편 에너지 추적
    fragmentMassG: (ev.fragmentMassG != null) ? ev.fragmentMassG : null,
    fragmentVelocityMps: (ev.fragmentVelocityMps != null) ? ev.fragmentVelocityMps : null,
    fragmentEnergyJ: (ev.fragmentEnergyJ != null) ? ev.fragmentEnergyJ : null,
    fragmentEnergyClass: (ev.fragmentEnergyClass != null) ? ev.fragmentEnergyClass : null,
    fragmentEnergyMeta: ev.fragmentEnergyMeta || null,
    // SIDE-ARMOR-2C §5: coverage 추적
    armorHitResult: ev.armorHitResult || null,
    impactAddressFull: (ev.impactAddress && ev.impactAddress.fullAddress) || null,
    selectedLayerType: ev.selectedLayerType || (ev.armorHitResult && ev.armorHitResult.selectedLayerType) || null,
    coverageSource: ev.coverageSource || (ev.armorHitResult && ev.armorHitResult.coverageSource) || null,
    durabilityOwnerId: ev.durabilityOwnerId || (ev.armorHitResult && ev.armorHitResult.durabilityOwnerId) || null,
    fallbackUsed: (ev.armorHitResult && ev.armorHitResult.fallbackUsed) || false,
    time: GAME.gameTime || 0,
  };
  if (GAME.debugBallistic) {
    console.log('[DamageEvent]', m._lastDamageEvent);
  }

  // === 2B-0: woundDescriptor 생성/기록 (상처 단위 레이어) ===
  m._currentEventWound = null;   // HOTFIX-2 §1: 이번 피격에서 생성된 wound만 추적
  try {
    ev.partKey = partKey;
    ev.anatomicalZone = ev.anatomicalZone || (ev.impactAddress && (ev.impactAddress.anatomicalZone || ev.impactAddress.coverageZone)) || null;
    ev._fracture = !!part.fracture;
    ev.wasPenetrated = (armorResult === 'penetrated');
    // SHOTGUN-PHYS-CLUSTER-1 Phase3 §6: 즉시 생리값을 wound 생성 전에 기록 (buildWoundDescriptor가 복사)
    ev._immediatePhysiology = {
      bodyDmg, painAdd: painAddEff, shockAdd: 0,   // [IMPACT-A Phase2] deprecated — 산탄 governor는 physiological shock 미조작
      acuteResponseLoad: (acute ? acute.stoppingIntensity : 0), painLoad: (acute ? acute.painImpulse : 0), stoppingLoad: (acute ? acute.stoppingIntensity : 0),
      partKey, hitPart: ev.hitPart,
      pelletGroupId: ev.pelletGroupId || null, shotgunPellet: !!ev.shotgunPellet, ammoId: ev.ammoId || null,
    };
    const w = recordWoundFromDamageEvent(unit, ev);
    if (w) { m._lastWound = w; m._currentEventWound = w; }
  } catch (e) { if (GAME.debugBallistic) console.warn('[wound] 생성 실패:', e && e.message); }

  // === 9) summary 즉시 갱신 + legacy sync ===
  // 1.5단계 — stressResponse 즉시 자극 (injuryDrive 트리거)
  if (m.stressResponse) {
    m.stressResponse.timeSinceLastDamage = 0;
    m.stressResponse.timeSinceLastThreat = 0;
    // 부상 자극 — 큰 피해/관통/심부위는 더 강한 자극
    const partImpact = (partKey === 'head' || partKey === 'chest' || partKey === 'neck') ? 1.5 : 1.0;
    const dmgImpact = Math.min(1, bodyDmg / 25);
    const penImpact = (armorResult === 'penetrated') ? 1.0 : 0.4;
    let stim = dmgImpact * penImpact * partImpact;
    if (pelletAcute.isShotgunPellet) stim *= pelletAcute.stressMul;   // 산탄 펠릿 즉시 stress 자극 보정
    m.stressResponse.injuryDrive = Math.min(1, m.stressResponse.injuryDrive + stim * 0.5);
    // 큰 피해는 즉시 adrenaline spike
    if (stim > 0.4) {
      m.stressResponse.adrenaline = Math.min(1, m.stressResponse.adrenaline + stim * 0.3);
      m.stressResponse.combatArousal = Math.min(1, m.stressResponse.combatArousal + stim * 0.4);
    }
  }
  recalcMedicalSummary(unit);
  syncLegacyCombatState(unit);
}

// === 매 tick 호출 — 출혈/혈액/HR/BP/호흡/회복/저혈량 손상 ===
// SIDE-MED-BASELINE-1 §4: tickMedical = '지속 생리' 담당 (지속 출혈 / bloodMl 감소 / hemodynamics /
//   compensation·shock 진행 / consciousness·performance / wound 처치효과 반영 / ECG 표시용 상태 갱신).
//   '즉시 효과'(즉시 HP·pain·shock·stun·breathing, wound 생성, AAR 기록, 피격 직후 stress 트리거)는 applyDamageEvent 담당.
//   같은 wound가 두 경로에서 출혈을 이중 증폭하지 않도록 — 지속 출혈은 여기(wound 기반)서만 최종 합산한다.
function tickMedical(unit, dt) {
  if (!unit.medical || unit.isDead) return;
  ensureMedicalExtensions(unit);
  // [IMPACT-A Phase2] 급성 반응 타이머 자연 감쇠 (physiological과 독립)
  const _m = unit.medical;
  // [0.39.2 Fix1] impactKnockdownTimer 감소는 unit tick(updateUnit)이 소유 — 여기선 감소하지 않음(이중 감소 방지). alias만 동기화됨.
  if (_m.transientNeurologicDisruption > 0) _m.transientNeurologicDisruption = Math.max(0, _m.transientNeurologicDisruption - 30 * dt);
  if (_m._acuteResponseLoad > 0) _m._acuteResponseLoad = Math.max(0, _m._acuteResponseLoad - 40 * dt);
  // 단계별 — 순서 중요 (출혈 → 저혈량 → stress → hormonal → hemodynamics → vitals → pain/shock/conscious → multipliers)
  updateMedicalBleeding(unit, dt);
  updateChestTrauma(unit, dt);            // SIDE-MED-2C §26: 흉부 외상/기흉 진행 (호흡 효율 영향)
  updateSystemicHypoxiaDamage(unit, dt);
  updateStressResponse(unit, dt);
  updateHormonalCompensation(unit, dt);
  updateHemodynamics(unit, dt);
  updateVitalsFromHemodynamics(unit, dt);
  updatePainShockConsciousness(unit, dt);
  updateMedicalPerformanceMultipliers(unit, dt);
  buildTcccAssessment(unit);   // SIDE-MED-2C §4: care phase / MARCH / airway·exposure hook 갱신
  buildPreCardiacRisk(unit);   // PRECARDIAC-1 §10: 다음 cardiac 단계 입력 flag (rhythm/사망 판정에 미사용)
  buildCardiacRhythmModel(unit, dt);   // CARDIAC-1R §10: 리듬 후보 상태 (preCardiacRisk 이후 — 최신 입력)
  updateFieldStabilization(unit, dt);  // FIELD-STAB-1 §8~§12,§18: 원인 완화 action candidate/degradation/modifier
  buildEvacuationModel(unit);          // FIELD-STAB-1 §13: 후송 우선순위/definitive care 표시 (직접 치료효과 없음)
  // 9) lifeStatus 종합
  recalcMedicalSummary(unit);
  syncLegacyCombatState(unit);
}

// === SIDE-MED-2C §26: 흉부 외상 진행 (chestTraumaModel 기반, breathingEfficiency 영향. ECG는 표시만) ===
function updateChestTrauma(unit, dt) {
  const m = unit.medical;
  if (!m || !m.wounds) return;
  let worstDrain = 0, anyChest = false, pneumoMax = 0, tensionMax = 0, needleHook = false;
  for (const w of m.wounds) {
    const ctm = w.chestTraumaModel;
    if (!ctm || (!ctm.openChestWound && !ctm.lungInjuryCandidate && !(ctm.pneumothoraxRisk > 0))) continue;
    anyChest = true;
    const ts = w.treatmentState || {};
    const sealed = !!ts.chestSealed && (ts.chestSealEffective !== false);
    ctm._pneumoProg = (ctm._pneumoProg != null) ? ctm._pneumoProg : ctm.pneumothoraxRisk;
    const progRate = sealed ? 0.004 : 0.02;
    const ceil = Math.min(1, ctm.pneumothoraxRisk + (sealed ? 0.1 : 0.4));
    if (ctm.openChestWound || ctm.lungInjuryCandidate) ctm._pneumoProg = Math.min(ceil, ctm._pneumoProg + progRate * dt);
    // FIELD-STAB-1 §9/§14: chest_relief active → tension 진행 억제 (직전 tick modifier). 폐손상/혈흉 자체는 미해결.
    const _csRelief = (m.fieldStabilizationModel && m.fieldStabilizationModel.chestRelief) || null;
    const _tensionMod = (_csRelief && _csRelief.active) ? _csRelief.tensionReliefModifier : 1.0;
    const _drainMod = (_csRelief && _csRelief.active) ? _csRelief.breathingEfficiencyDrainModifier : 1.0;
    if (!sealed && ctm._pneumoProg > 0.6) ctm.tensionPneumothoraxRisk = Math.min(1, (ctm.tensionPneumothoraxRisk || 0) + 0.01 * _tensionMod * dt);
    else ctm.tensionPneumothoraxRisk = Math.max(0, (ctm.tensionPneumothoraxRisk || 0) - 0.005 * dt - (_csRelief && _csRelief.active ? 0.004 * _csRelief.effectStrength * dt : 0));
    // FIELD-STAB-1 §9: chest_relief active → 압력 능동 완화 (양 branch 공통, net 감소 가능). 폐손상/혈흉 자체는 미해결.
    if (_csRelief && _csRelief.active && _csRelief.effectStrength > 0) ctm.tensionPneumothoraxRisk = Math.max(0, ctm.tensionPneumothoraxRisk - 0.012 * _csRelief.effectStrength * dt);
    if (ctm.tensionPneumothoraxRisk > 0.5) { ctm.needleDecompressionCandidate = true; needleHook = true; }
    // PRECARDIAC-1 §8: 밀봉했어도 tension 진행 가능 — "체스트씰만으로 해결 불가" 상태 표시 (needle은 후속 단계)
    ctm.tensionStillPossible = sealed && (ctm.tensionPneumothoraxRisk || 0) > 0.3;
    if (sealed && ts.chestSealed) ts.chestSealPartial = ctm.tensionStillPossible;
    // PRECARDIAC-1 §7: 폐 손상 likely·혈흉은 호흡 효율에 약하게 가산 (clamp 내)
    const lungDrain = (ctm.lungInjuryStatus === 'likely') ? 0.08 : (ctm.lungInjuryStatus === 'suspected' ? 0.04 : 0);
    const hemoDrain = ((ctm.hemothoraxRisk || 0) >= 0.45) ? 0.05 : 0;
    // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §4/§8: confirmed_physiologic 폐손상 → breathingDrain 가산 (clamp)
    const pep = w.physiologicEffectProfile;
    const physBreathDrain = (pep && pep.breathingDrain) ? Math.min(0.25, pep.breathingDrain) : 0;
    if (pep && (pep.pneumothoraxBoost || 0) > 0 && (ctm.openChestWound || ctm.lungInjuryCandidate)) {
      ctm._pneumoProg = Math.min(1, ctm._pneumoProg + Math.min(0.4, pep.pneumothoraxBoost) * 0.02 * dt);   // tension 진행에 소폭 가산(밀봉 시에도 §주의)
    }
    const drain = Math.min(0.9, (ctm._pneumoProg * 0.25 + (ctm.tensionPneumothoraxRisk || 0) * 0.45 + lungDrain + hemoDrain + physBreathDrain) * _drainMod);
    ctm.breathingEfficiencyDrain = +drain.toFixed(3);
    worstDrain = Math.max(worstDrain, drain);
    pneumoMax = Math.max(pneumoMax, ctm._pneumoProg);
    tensionMax = Math.max(tensionMax, ctm.tensionPneumothoraxRisk || 0);
  }
  if (anyChest && m.breathingEfficiency != null) {
    // breathingEfficiency는 0~100 스케일. drain(0~1)을 비율로 환산해 target까지 감소 (직접 사망 스위치 금지).
    const target = Math.max(25, 100 * (1 - worstDrain));
    m.breathingEfficiency = Math.max(target, m.breathingEfficiency - worstDrain * 100 * dt * 0.08);
    m._chestPneumoRisk = +pneumoMax.toFixed(2);
    m._chestTensionRisk = +tensionMax.toFixed(2);
    m._needleDecompressionHook = needleHook;
  }
}

// === SIDE-MED-2C §3: TCCC care phase ===
function getTcccCarePhase(unit, treater, tacticalCtx) {
  const supp = (unit.suppression || 0);
  const underFire = (tacticalCtx && tacticalCtx.underFire) || supp > 45 || !!(unit._recentIncomingFire && (GAME.gameTime || 0) - unit._recentIncomingFire < 5);
  if (underFire) return 'under_fire';
  const m = unit.medical;
  let urgent = false;
  if (m && m.wounds) for (const w of m.wounds) {
    if ((w.internalBleedingModel && (w.internalBleedingModel.evacuationPriority === 'high' || w.internalBleedingModel.evacuationPriority === 'urgent'))
      || (w.organInjuryModel && w.organInjuryModel.surgeryRequiredCandidate)) { urgent = true; break; }
  }
  if (urgent) return 'evacuation_pending';
  return 'tactical_field_care';
}
function isTreatmentAllowedInPhase(type, phase) {
  if (phase !== 'under_fire') return true;
  return (type === 'tourniquet' || type === 'pressure_bandage' || type === 'remove_tourniquet');
}


// === FIELD-STAB-1 §17: 처치 품질 — 숙련도/상황/phase/공황 기반 (game balance 값) ===
function calculateTreatmentQuality(treater, target, actionType, ctx) {
  ctx = ctx || {};
  const cp = treater ? getUnitComposureProfile(treater) : COMPOSURE_PROFILES.regular;
  let q = 0.55;
  q += (cp.composure - 0.6) * 0.45;                       // 숙련도(침착성) — elite↑ recruit↓
  const phase = ctx.phase || 'tactical_field_care';
  if (phase === 'under_fire') q -= 0.25;
  q -= ((treater && treater.suppression) ? treater.suppression / 100 : 0) * 0.2;
  if (treater && treater.medical && treater.medical.stressResponse) q -= (treater.medical.stressResponse.panic || 0) * 0.15;
  if (target && target.medical) { if (target.medical.shock > 70) q -= 0.1; if (target.medical.consciousness < 30) q -= 0.05; }
  if (target && (target.beingDragged || ctx.moving)) q -= 0.1;
  return clampMed(q, 0.2, 0.95);
}

// === FIELD-STAB-1 §7: phase 게이팅 — field stabilization action 허용 단계 ===
const FIELD_STAB_ACTIONS = ['airway_support', 'chest_relief', 'pelvic_binder', 'junctional_control', 'circulation_support', 'mark_evac'];
function isFieldStabAllowedInPhase(actionType, phase) {
  if (phase === 'under_fire') return false;   // 총격 중 advanced stabilization 금지
  if (actionType === 'circulation_support') return (phase === 'evacuation_pending');   // 강한 순환 보조는 후송 단계 위주
  return true;   // tactical_field_care / evacuation_pending에서 나머지 허용
}

// === FIELD-STAB-1: wound 영역 분류 헬퍼 (pelvic/junctional candidate 판정용) ===
function _woundIsPelvicRegion(w) {
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §3: 새 normalizedMedicalAddress / internalBleedingCategory / treatmentIndicationTags 우선.
  const med = w.normalizedMedicalAddress || (w.bodyTrajectory && w.bodyTrajectory.normalizedMedicalAddress) || null;
  const tags = w.treatmentIndicationTags || [];
  const prob = w.probableInjuries || [];
  const cands = (w.candidateInjuries || []).concat((w.candidateMap || []).map(c => (c && c.id) || ''));
  if (w.internalBleedingCategory === 'pelvic_internal') return true;
  if (tags.indexOf('pelvicInternalBleed') >= 0 || tags.indexOf('pelvicControlCandidate') >= 0) return true;
  if (med && (med.medicalZone === 'pelvis_upper' || med.cavityRegion === 'pelvic' || med.vascularRegion === 'iliac')) return true;
  if (prob.indexOf('iliac_vessel_injury_probable') >= 0 || prob.indexOf('pelvic_bleeding_probable') >= 0) return true;
  if (cands.some(id => id === 'pelvic_bleed_candidate' || id === 'iliac_vessel_candidate' || id === 'pelvic_bone_candidate')) return true;
  // fallback: legacy organInjuryModel / bleedingProfile (새 주소 조건이 없을 때만 — abdomen cavity만으로 과판정 금지)
  const pk = w.partKey || '';
  if (pk === 'abdomen' || pk === 'leftLeg' || pk === 'rightLeg') {
    const oim = w.organInjuryModel;
    if (oim && oim.injuries) for (const inj of oim.injuries) {
      if (/pelvic|retroperitoneal|femoral|iliac/.test(inj.organ)) return true;
    }
  }
  return false;
}
function _woundIsJunctionalRegion(w) {
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §4: 새 주소/분류/태그 우선. femoral_triangle/groin_junctional/axilla/supraclavicular를 놓치지 않음.
  const med = w.normalizedMedicalAddress || (w.bodyTrajectory && w.bodyTrajectory.normalizedMedicalAddress) || null;
  const tags = w.treatmentIndicationTags || [];
  const prob = w.probableInjuries || [];
  if (w.internalBleedingCategory === 'junctional_limited_control') return true;
  if (tags.indexOf('junctionalHemorrhage') >= 0 || tags.indexOf('junctionalControlCandidate') >= 0 || tags.indexOf('probableMajorVesselInjury') >= 0) return true;
  if (med) {
    const mz = med.medicalZone || '';
    if (mz === 'groin' || mz === 'groin_junctional' || mz === 'femoral_triangle' || mz === 'axilla' || mz === 'supraclavicular') return true;
    if (med.junctionalBleedRisk === true || med.majorVesselRiskHint === true) return true;
    const vr = med.vascularRegion || '';
    if (vr === 'femoral' || vr === 'femoral_iliac' || vr === 'iliac' || vr === 'axillary_subclavian' || vr === 'subclavian') return true;
  }
  if (prob.some(id => id === 'femoral_vessel_injury_probable' || id === 'iliac_vessel_injury_probable' || id === 'axillary_vessel_injury_probable' || id === 'subclavian_vessel_injury_probable' || id === 'junctional_hemorrhage_probable')) return true;
  // fallback: legacy bleedingProfile / bleedingPulseModel
  const pk = w.partKey || '';
  if (pk === 'neck' || pk === 'leftArm' || pk === 'rightArm' || pk === 'leftLeg' || pk === 'rightLeg' || pk === 'abdomen') {
    const bp = w.bleedingProfile || {};
    if (bp.bleedingType === 'junctional') return true;
    const bpm = w.bleedingPulseModel;
    if (bpm && bpm.tags && (bpm.tags.indexOf('arterial_pulse') >= 0 || bpm.tags.indexOf('junctional_pulse') >= 0)) return true;
  }
  return false;
}

// === FIELD-STAB-1 §8~§12,§18: field stabilization 갱신 — candidate 산출 + degradation + modifier 계산 ===
//   효과 modifier는 이 모델에 저장만 하고, 생리(updateHemodynamics/updateChestTrauma/updateMedicalBleeding)가 다음 tick에 읽는다.
function updateFieldStabilization(unit, dt) {
  const m = unit.medical; if (!m) return;
  const fs = ensureFieldStabilizationModel(unit);
  const hd = m.hemodynamics || {};
  const pcr = m.preCardiacRisk || {};
  const sr = m.stressResponse || {};
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  fs.lastUpdateTime = now;
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  const moving = !!(unit.isMoving || (unit.movePath && unit.movePath.length) || unit.beingDragged);
  const severeChest = !!pcr.severeChestTrauma;
  const severeHypo = (hd.hypovolemiaSeverity === 'severe' || hd.hypovolemiaSeverity === 'critical');

  // ---- AIRWAY ----
  const aw = fs.airwaySupport;
  aw.candidate = (m.consciousness < 60 || m.breathingEfficiency < 75 || o2 < 0.7) && !unit.isDead;
  aw.obstructionRisk = clamp01((60 - m.consciousness) / 60 * 0.6 + (sr.panic || 0) * 0.3);
  if (aw.active) {
    // recurrence: unconscious 악화/이동 시 위험 증가
    aw.recurrenceRisk = clamp01(aw.recurrenceRisk + (moving ? 0.04 : -0.02) * dt + (m.consciousness < 25 ? 0.03 : 0) * dt);
    if (aw.recurrenceRisk > 0.85) { aw.active = false; aw.failureReason = 'airway_lost_recurrence'; }
    // 효과 강도 — quality 기반, 단 severe chest/blood loss면 제한
    let eff = aw.quality;
    if (severeChest) eff *= 0.5;
    if (severeHypo) eff *= 0.6;
    aw.effectStrength = clampMed(eff * (1 - aw.recurrenceRisk * 0.5), 0, 0.95);
    aw.oxygenDeliveryModifier = 1.0 + aw.effectStrength * 0.08;   // 최대 ~1.076 (제한적)
    aw.artifactReduction = aw.effectStrength * 0.12;
    aw.breathingDisciplineSupport = aw.effectStrength * 0.1;
    aw.tags = ['airway_active']; if (severeChest) aw.tags.push('limited_chest_trauma'); if (severeHypo) aw.tags.push('limited_hypovolemia');
  } else { aw.oxygenDeliveryModifier = 1.0; aw.artifactReduction = 0; aw.breathingDisciplineSupport = 0; aw.effectStrength = 0; }

  // ---- CHEST RELIEF ----
  const cr = fs.chestRelief;
  const tensionRisk = (pcr.tensionPneumothoraxRisk || 0);
  cr.candidate = (tensionRisk > 0.45 || (severeChest && m.breathingEfficiency < 65)) && !unit.isDead;
  if (cr.active) {
    cr.recurrenceRisk = clamp01(cr.recurrenceRisk + (moving ? 0.05 : 0.01) * dt + (tensionRisk > 0.6 ? 0.02 : 0) * dt - (cr.quality > 0.7 ? 0.01 : 0) * dt);
    if (cr.recurrenceRisk > 0.9) { cr.active = false; cr.failureReason = 'tension_recurred'; }
    const eff = clampMed(cr.quality * (1 - cr.recurrenceRisk * 0.5), 0, 0.95);
    cr.effectStrength = eff;
    cr.tensionReliefModifier = 1.0 - eff * 0.4;             // tension progression 억제 (×0.6 최저)
    cr.breathingEfficiencyDrainModifier = 1.0 - eff * 0.35; // drain 완화
    cr.oxygenDeliveryModifier = 1.0 + eff * 0.05;
    cr.tags = ['chest_relief_active']; if ((pcr.hemothoraxRisk || 0) >= 0.45) cr.tags.push('hemothorax_unresolved');
    if (cr.recurrenceRisk > 0.5) cr.tags.push('recurrence_possible');
  } else { cr.tensionReliefModifier = 1.0; cr.breathingEfficiencyDrainModifier = 1.0; cr.oxygenDeliveryModifier = 1.0; cr.effectStrength = 0; }

  // ---- PELVIC / JUNCTIONAL (wound 기반) ----
  let pelvicCand = false, junctionalCand = false;
  if (m.wounds) for (const w of m.wounds) {
    if (_woundIsPelvicRegion(w)) pelvicCand = true;
    if (_woundIsJunctionalRegion(w)) junctionalCand = true;
  }
  const pc = fs.pelvicControl;
  pc.candidate = pelvicCand && !unit.isDead;
  if (pc.active) {
    pc.recurrenceRisk = clamp01(pc.recurrenceRisk + (moving ? 0.04 : -0.01) * dt);
    const eff = clampMed(pc.quality * (1 - pc.recurrenceRisk * 0.4), 0, 0.95);
    pc.effectStrength = eff;
    pc.pelvicBleedModifier = clampMed(1.0 - eff * 0.15, 0.85, 1.0);   // 0.85~1.0 제한적 (cavity 완전제어 금지)
    pc.mobilityPenalty = 0.2;
    pc.evacuationPriorityBoost = 1;
    pc.tags = ['pelvic_binder_active', 'cavity_uncontrolled'];
  } else { pc.pelvicBleedModifier = 1.0; pc.mobilityPenalty = 0; pc.evacuationPriorityBoost = 0; pc.effectStrength = 0; }

  const jc = fs.junctionalControl;
  jc.candidate = junctionalCand && !unit.isDead;
  if (jc.active) {
    jc.recurrenceRisk = clamp01(jc.recurrenceRisk + (moving ? 0.06 : -0.01) * dt);
    const eff = clampMed(jc.quality * (1 - jc.recurrenceRisk * 0.5), 0, 0.95);
    jc.effectStrength = eff;
    jc.pulseSuppression = eff * 0.4;                       // bleedingPulse extPulse 억제 (최대 ~0.38)
    jc.tags = ['junctional_control_active']; if (jc.recurrenceRisk > 0.5) jc.tags.push('recurrence_if_moved');
  } else { jc.pulseSuppression = 0; jc.effectStrength = 0; }

  // ---- CIRCULATION SUPPORT (field limited placeholder) ----
  const cs = fs.circulationSupport;
  cs.candidate = (severeHypo || hd.poorPerfusion || (hd.map != null && hd.map < 65)) && !unit.isDead;
  cs.transfusionRequired = (hd.hypovolemiaSeverity === 'critical' || m.bloodMl < 2200);
  cs.definitiveCareRequired = cs.transfusionRequired;
  if (cs.active) {
    // uncontrolled bleeding이면 효과가 빠르게 사라짐
    const uncontrolled = (m.internalBleedRate > 4) || (m.externalBleedRate > 8);
    cs.effectStrength = clampMed((cs.fieldLimited ? 0.4 : 0.7) * cs.quality * (uncontrolled ? 0.4 : 1.0), 0, 0.8);
    cs.mapSupportModifier = 1.0 + cs.effectStrength * 0.06;        // 매우 제한적
    cs.perfusionSupportModifier = 1.0 + cs.effectStrength * 0.05;
    cs.tags = ['circulation_field_limited']; if (uncontrolled) cs.tags.push('uncontrolled_bleeding_limits'); if (cs.transfusionRequired) cs.tags.push('transfusion_required');
  } else { cs.mapSupportModifier = 1.0; cs.perfusionSupportModifier = 1.0; cs.effectStrength = 0; }
}

// === FIELD-STAB-1 §13: 후송/definitive care 모델 — field로 해결 불가한 원인 표시 (직접 치료효과 없음) ===
function buildEvacuationModel(unit) {
  const m = unit.medical; if (!m) return null;
  const hd = m.hemodynamics || {};
  const pcr = m.preCardiacRisk || {};
  const crm = m.cardiacRhythmModel || {};
  const fs = m.fieldStabilizationModel || {};
  const tags = [];
  let surgeryRequired = false, transfusionRequired = false, airwayAdvancedRequired = false, chestAdvancedRequired = false, vascularControlRequired = false;
  // 원인 수집
  if (m.internalBleedRate > 3) { tags.push('uncontrolled_internal_bleeding'); surgeryRequired = true; }
  if (hd.hypovolemiaSeverity === 'severe' || hd.hypovolemiaSeverity === 'critical') { tags.push('severe_hypovolemia'); transfusionRequired = true; }
  if ((hd.oxygenDelivery != null && hd.oxygenDelivery < 0.5)) { tags.push('low_oxygen_delivery'); }
  if ((pcr.tensionPneumothoraxRisk || 0) > 0.5) { tags.push('tension_risk'); chestAdvancedRequired = true; }
  if ((pcr.hemothoraxRisk || 0) >= 0.45) { tags.push('hemothorax_risk'); chestAdvancedRequired = true; }
  if (pcr.thoracicVesselRisk) { tags.push('thoracic_vessel_risk'); vascularControlRequired = true; surgeryRequired = true; }
  if (fs.pelvicControl && fs.pelvicControl.candidate) { tags.push('pelvic_bleeding_candidate'); }
  if (pcr.heartAdjacentTrack) { tags.push('heart_adjacent_track'); }
  if (crm.rhythmClass === 'unstable' || crm.rhythmClass === 'peri_arrest_candidate' || crm.rhythmClass === 'arrest_candidate') { tags.push('unstable_rhythm_candidate'); }
  if (m.consciousness < 25) { tags.push('airway_at_risk'); airwayAdvancedRequired = true; }
  // SIDE-MEDICAL-ORGAN-BLEEDING-HOTFIX-1 §6: wound별 수술/수혈/혈관통제/내부출혈 표식을 전신 후송 판단에 반영 (표식만 — 실제 회복 로직 없음)
  let confirmedPresent = false, probableSerious = false, woundFieldUncontrollable = false;
  if (Array.isArray(m.wounds)) for (const w of m.wounds) {
    if (!w) continue;
    if (w.surgeryRequiredCandidate) { surgeryRequired = true; if (tags.indexOf('wound_surgery_candidate') < 0) tags.push('wound_surgery_candidate'); }
    if (w.transfusionRequiredCandidate) { transfusionRequired = true; if (tags.indexOf('wound_transfusion_candidate') < 0) tags.push('wound_transfusion_candidate'); }
    if (w.vascularControlRequiredCandidate) { vascularControlRequired = true; surgeryRequired = true; if (tags.indexOf('vascular_control_required') < 0) tags.push('vascular_control_required'); }
    const cat = w.internalBleedingCategory;
    if (cat === 'thoracic_internal' || cat === 'abdominal_internal' || cat === 'retroperitoneal_internal' || cat === 'pelvic_internal') { surgeryRequired = true; if (tags.indexOf(cat) < 0) tags.push(cat); }
    if (cat === 'junctional_limited_control') { vascularControlRequired = true; if (tags.indexOf('junctional_limited_control') < 0) tags.push('junctional_limited_control'); }
    const fc = w.fieldControllability;
    if (fc === 'uncontrollable_field' || fc === 'chest_limited' || fc === 'pelvic_binder_partial') { woundFieldUncontrollable = true; if (tags.indexOf('field_uncontrollable') < 0) tags.push('field_uncontrollable'); }
    if ((w.confirmedInjuries && w.confirmedInjuries.length) || (w.confirmedInjuryModel && w.confirmedInjuryModel.confirmed && w.confirmedInjuryModel.confirmed.length)) confirmedPresent = true;
    const prob = (w.probableInjuries && w.probableInjuries.length ? w.probableInjuries : (w.confirmedInjuryModel && w.confirmedInjuryModel.probable) || []);
    if (prob.some(i => /vessel|organ|hemothorax|pelvic|retroperitoneal/.test(i))) probableSerious = true;
  }
  if (confirmedPresent && tags.indexOf('confirmed_injury_present') < 0) tags.push('confirmed_injury_present');
  if (probableSerious && tags.indexOf('probable_serious_injury') < 0) tags.push('probable_serious_injury');
  if (transfusionRequired) tags.push('transfusion_required');
  if (surgeryRequired) tags.push('surgery_required');
  // priority 산정
  let priority = 'none';
  const crit = (hd.hypovolemiaSeverity === 'critical') || (hd.oxygenDelivery != null && hd.oxygenDelivery < 0.4) || crm.rhythmClass === 'arrest_candidate' || crm.rhythmClass === 'peri_arrest_candidate';
  const urgent = (hd.hypovolemiaSeverity === 'severe') || m.internalBleedRate > 3 || (pcr.tensionPneumothoraxRisk || 0) > 0.5 || pcr.thoracicVesselRisk || crm.rhythmClass === 'unstable';
  if (crit) priority = 'immediate';
  else if (urgent) priority = 'urgent';
  else if (tags.length > 0) priority = 'priority';
  else if (m.lifeStatus < 70 || (m.externalBleedRate + m.internalBleedRate) > 1) priority = 'monitor';
  const definitiveCareRequired = (surgeryRequired || transfusionRequired || vascularControlRequired || chestAdvancedRequired || airwayAdvancedRequired || woundFieldUncontrollable);
  const prevPriority = (m.evacuationModel && m.evacuationModel.evacuationPriority) || 'none';
  m.evacuationModel = {
    evacuationPriority: priority, definitiveCareRequired, surgeryRequired, transfusionRequired,
    airwayAdvancedRequired, chestAdvancedRequired, vascularControlRequired, reasonTags: tags,
    lastUpdated: (typeof GAME !== 'undefined' && GAME.gameTime) || 0,
  };
  if (fs) { fs.evacuationPriority = priority; fs.definitiveCareRequired = definitiveCareRequired; }
  // HOTFIX: 우선순위 상승 시 1회만 로그 (high-water latch — 임계값 근처 진동으로 매 tick 반복되지 않게)
  const order = { none:0, monitor:1, priority:2, urgent:3, immediate:4 };
  const hw = m._evacLoggedPriority || 0;
  if (order[priority] > hw && order[priority] >= 3 && typeof log === 'function') {
    log(`[${unit.name}] 후송 우선순위: ${priority === 'immediate' ? '최우선' : '긴급'} — ${tags.slice(0, 2).join(', ')} (현장처치 한계)`, 'warn');
    m._evacLoggedPriority = order[priority];
  }
  return m.evacuationModel;
}

// === FIELD-STAB-1: action 완료 처리 (completeTreatment에서 호출) ===
function completeFieldStabilizationAction(treater, target, actionType, ctx) {
  const m = target.medical; if (!m) return false;
  const fs = ensureFieldStabilizationModel(target);
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const phase = (typeof getTcccCarePhase === 'function') ? getTcccCarePhase(target, treater, null) : 'tactical_field_care';
  const q = calculateTreatmentQuality(treater, target, actionType, { phase });
  const log2 = (msg, c) => { if (typeof log === 'function') log(msg, c); };
  const fail = (q < 0.3) && (Math.random() < (0.3 - q));   // 낮은 quality 일부 실패 (과도 랜덤 금지)
  switch (actionType) {
    case 'airway_support': {
      const aw = fs.airwaySupport;
      if (fail) { aw.failureReason = 'poor_quality_airway'; log2(`[${target.name}] 기도 보조 실패 — 품질 부족`, 'warn'); return true; }
      aw.active = true; aw.applied = true; aw.quality = q; aw.completedAt = now; aw.recurrenceRisk = Math.max(0, (1 - q) * 0.3); aw.failureReason = null;
      log2(`[${target.name}] 기도 보조 적용 (제한적, 품질 ${(q*100|0)}%)`, 'good'); return true;
    }
    case 'chest_relief': {
      const cr = fs.chestRelief;
      if (fail) { cr.failureReason = 'poor_quality_relief'; log2(`[${target.name}] 흉부 압력 완화 실패 — 재시도 필요`, 'warn'); return true; }
      cr.active = true; cr.applied = true; cr.quality = q; cr.completedAt = now; cr.recurrenceRisk = Math.max(0, (1 - q) * 0.4); cr.failureReason = null;
      log2(`[${target.name}] 흉부 압력 완화 적용 (긴장 진행 억제, 품질 ${(q*100|0)}%) — 폐손상 자체는 미해결`, 'good'); return true;
    }
    case 'pelvic_binder': {
      const pc = fs.pelvicControl;
      pc.active = true; pc.applied = true; pc.quality = q; pc.completedAt = now; pc.recurrenceRisk = Math.max(0, (1 - q) * 0.3);
      log2(`[${target.name}] 골반 고정 적용 (제한적 출혈 완화) — 체강 내부출혈은 미해결, 후송 필요`, 'good'); return true;
    }
    case 'junctional_control': {
      const jc = fs.junctionalControl;
      jc.active = true; jc.applied = true; jc.quality = q; jc.completedAt = now; jc.recurrenceRisk = Math.max(0, (1 - q) * 0.4);
      log2(`[${target.name}] junctional 출혈 제어 적용 (박동성 출혈 억제) — 이동 시 재발 위험`, 'good'); return true;
    }
    case 'circulation_support': {
      const cs = fs.circulationSupport;
      cs.active = true; cs.available = true; cs.quality = q; cs.startedAt = now;
      log2(`[${target.name}] 순환 보조 (현장 제한적) — 근본 회복 아님, ${cs.transfusionRequired ? '수혈 필요' : '후송 권장'}`, 'info'); return true;
    }
    case 'mark_evac': {
      if (typeof buildEvacuationModel === 'function') buildEvacuationModel(target);
      const ev = m.evacuationModel || {};
      log2(`[${target.name}] 후송 표시 — 우선순위 ${ev.evacuationPriority || 'monitor'}`, 'info'); return true;
    }
  }
  return false;
}
// completeFieldStabilizationAction 직후 modifier 즉시 반영을 위해 wrapper에서 updateFieldStabilization(target,0) 호출
const _origCompleteFieldStab = completeFieldStabilizationAction;
completeFieldStabilizationAction = function(treater, target, actionType, ctx) {
  const r = _origCompleteFieldStab(treater, target, actionType, ctx);
  if (r && target && target.medical && typeof updateFieldStabilization === 'function') updateFieldStabilization(target, 0);
  return r;
};
function getFieldStabilizationSummary(unit) {
  const m = unit.medical; if (!m || !m.fieldStabilizationModel) return null;
  const fs = m.fieldStabilizationModel;
  return {
    airway: fs.airwaySupport.active ? 'active' : (fs.airwaySupport.candidate ? 'candidate' : 'clear'),
    chestRelief: fs.chestRelief.active ? 'active' : (fs.chestRelief.candidate ? 'candidate' : 'none'),
    pelvic: fs.pelvicControl.active ? 'applied' : (fs.pelvicControl.candidate ? 'candidate' : 'none'),
    junctional: fs.junctionalControl.active ? 'controlled' : (fs.junctionalControl.candidate ? 'candidate' : 'none'),
    circulation: fs.circulationSupport.active ? 'field_limited' : (fs.circulationSupport.candidate ? 'candidate' : 'none'),
    evac: fs.evacuationPriority,
  };
}

// === CARDIAC-1R §10~§14: 심장 리듬 모델 — preCardiacRisk/hemodynamics/stress 기반 보수적 후보 상태기 ===
//   중요: rhythm 하나만으로 즉시 death/소생 처리 금지. 기존 medical death 흐름이 우선.
//   vtach/vfib/pea/asystole는 "후보(_candidate)" 단계까지만. AED/CPR/defib 없음.
function buildCardiacRhythmModel(unit, dt) {
  const m = unit.medical; if (!m) return null;
  const hd = m.hemodynamics || {};
  const sr = m.stressResponse || {};
  const pcr = m.preCardiacRisk || {};
  const prev = m.cardiacRhythmModel || null;
  const cp = getUnitComposureProfile(unit);
  const HR = m.heartRate || 75;
  const MAP = (hd.map != null) ? hd.map : 75;
  const PP = (hd.pulsePressure != null) ? hd.pulsePressure : 40;
  const perf = (hd.tissuePerfusion != null) ? hd.tissuePerfusion : 1.0;
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  const hypo = hd.hypovolemiaSeverity || 'none';
  const exh = hd.compensationExhaustion || 0;
  const cons = m.consciousness != null ? m.consciousness : 100;
  const shock = m.shock || 0;
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;

  // === §12 riskScore 합성 (0~1) ===
  let raw = 0;
  if (hypo === 'severe') raw += 0.18; else if (hypo === 'critical') raw += 0.34;
  raw += clamp01(0.6 - perf) * 0.50;
  raw += clamp01(0.6 - o2) * 0.62;
  if (MAP < 50) raw += 0.18; else if (MAP < 65) raw += 0.08;
  if (PP < 20) raw += 0.10;
  if (hd.decompensatingShock) raw += 0.15;
  raw += exh * 0.12;
  if (hd.preArrestRisk) raw += 0.18;
  if (pcr.arrestRiskHint) raw += 0.12;
  if (pcr.severeChestTrauma) raw += 0.08;
  raw += (pcr.tensionPneumothoraxRisk || 0) * 0.12;
  raw += (pcr.hemothoraxRisk || 0) * 0.08;
  if (pcr.thoracicVesselRisk) raw += 0.08;
  if (pcr.heartAdjacentTrack) raw += 0.10;
  // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §7: confirmed_physiologic 장기/혈관/흉부 → rhythm risk 입력 강화 (보수적 가중)
  raw += (pcr.physiologicRhythmRisk || 0) * 0.30;
  raw += (pcr.physiologicPreArrestBoost || 0) * 0.25;
  if (cons < 20) raw += 0.10;
  if (shock > 80) raw += 0.08;
  if (HR > 170) raw += 0.08; if (HR < 40) raw += 0.12;
  // 완화 — 저산소/출혈을 없애지는 못함(작게)
  raw -= clamp01(o2 - 0.8) * 0.15;
  raw -= clamp01((MAP - 80) / 40) * 0.08;
  if (hd.compensatedShock && !hd.decompensatingShock) raw -= 0.05;
  raw -= cp.composure * 0.04;
  raw -= (1 - (sr.panic || 0)) * 0.02;
  let riskTarget = clamp01(raw);
  // smoothing — critical hemorrhage/severe hypoxia는 빠르게 상승 허용
  let riskScore = prev ? prev.riskScore : 0;
  const riskRise = (riskTarget > riskScore) ? Math.min(1, dt * 0.8) : Math.min(1, dt * 0.4);
  riskScore = clamp01(riskScore + (riskTarget - riskScore) * riskRise);

  // === 누적 시간 추적 (불안정/심실 자극 dwell — 후보 승격 게이트) ===
  let ventTime = prev ? (prev._ventTime || 0) : 0;
  let unstableTime = prev ? (prev._unstableTime || 0) : 0;
  let periArrestTime = prev ? (prev._periArrestTime || 0) : 0;

  const heartElectricalThreat = !!(pcr.heartAdjacentTrack || pcr.thoracicVesselRisk);
  const severeHypoxia = o2 < 0.42;
  const verySevereHypoxia = o2 < 0.32;
  const deathAdjacent = (m.lifeStatus != null && m.lifeStatus < 12) || (m.bloodMl < 1200);
  // 이 hemodynamics 모델은 빈사에도 MAP/perf가 완전 붕괴하지 않으므로(보상), arrest zone은
  //   death-adjacency + 심한 저산소(또는 낮은 MAP)로 판정한다. 전기활동 소실은 극단 지표로 분리.
  const lowMap = MAP < 52;
  const lowPerf = perf < 0.45;
  const arrestZone = deathAdjacent && (verySevereHypoxia || (lowMap && lowPerf));
  const electricalGone = (m.lifeStatus != null && m.lifeStatus <= 2) || (m.bloodMl < 1000) || (o2 < 0.20);

  // === §13 상태 전이 (보수적, 심각도 높은 것부터 게이트) ===
  let rhythm = 'normal_sinus';
  let transitionReason = '';

  // 심실 자극 조건 (V후보 전 단계)
  const ventIrritable = heartElectricalThreat && (severeHypoxia || hd.decompensatingShock) && riskScore > 0.55;
  if (ventIrritable || (unstableTime > 6 && heartElectricalThreat && riskScore > 0.6)) {
    ventTime += dt;
  } else {
    ventTime = Math.max(0, ventTime - dt * 0.6);
  }

  if (arrestZone && electricalGone) {
    rhythm = 'asystole_candidate'; transitionReason = 'death_adjacent_no_electrical';
    periArrestTime += dt;
  } else if (verySevereHypoxia && shock > 85 && riskScore > 0.85 && ventTime > 5 && (pcr.heartAdjacentTrack || hd.preArrestRisk)) {
    rhythm = 'vfib_candidate'; transitionReason = 'ventricular_chaos_candidate';
    periArrestTime += dt;
  } else if (severeHypoxia && lowMap && riskScore > 0.78 && ventTime > 4 && heartElectricalThreat) {
    rhythm = 'vtach_candidate'; transitionReason = 'wide_fast_candidate';
    periArrestTime += dt * 0.5;
  } else if (arrestZone) {
    rhythm = 'pea_candidate'; transitionReason = 'organized_no_perfusion';
    periArrestTime += dt;
  } else if (ventTime > 2.5 && riskScore > 0.62) {
    rhythm = 'ventricular_irritability'; transitionReason = 'ectopy_candidate';
    periArrestTime = Math.max(0, periArrestTime - dt);
  } else if (m.heartRate < 50 && (hypo === 'severe' || hypo === 'critical') && hd.poorPerfusion && o2 < 0.5 && exh > 0.5) {
    rhythm = 'unstable_bradycardia'; transitionReason = 'late_shock_brady';
    unstableTime += dt; periArrestTime = Math.max(0, periArrestTime - dt * 0.5);
  } else if (m.heartRate > 150 && hd.poorPerfusion && (o2 < 0.5 || hd.decompensatingShock)) {
    rhythm = 'unstable_tachycardia'; transitionReason = 'decomp_tachy';
    unstableTime += dt; periArrestTime = Math.max(0, periArrestTime - dt * 0.5);
  } else if ((m.heartRate < 55 || (severeHypoxia && m.heartRate < 75)) && (severeHypoxia || hd.decompensatingShock || cons < 25 || exh > 0.6)) {
    rhythm = 'sinus_bradycardia'; transitionReason = 'hypoxic_brady';
    unstableTime = Math.max(0, unstableTime - dt); periArrestTime = Math.max(0, periArrestTime - dt);
  } else if (m.heartRate > 100 && (sr.sympatheticTone > 0.4 || sr.adrenaline > 0.4 || hd.compensatedShock || hypo !== 'none' || (sr.panic || 0) > 0.4 || (sr.suppressionDrive || 0) > 0.4 || (sr.combatArousal || 0) > 0.3)) {
    rhythm = 'sinus_tachycardia'; transitionReason = 'compensatory_tachy';
    unstableTime = Math.max(0, unstableTime - dt); periArrestTime = Math.max(0, periArrestTime - dt);
  } else {
    rhythm = 'normal_sinus'; transitionReason = 'stable';
    unstableTime = Math.max(0, unstableTime - dt * 1.5); ventTime = Math.max(0, ventTime - dt); periArrestTime = Math.max(0, periArrestTime - dt * 1.5);
  }

  // === 파생 속성 ===
  const RCLASS = {
    normal_sinus: 'normal', sinus_tachycardia: 'compensatory', sinus_bradycardia: 'compensatory',
    unstable_tachycardia: 'unstable', unstable_bradycardia: 'unstable', ventricular_irritability: 'unstable',
    vtach_candidate: 'peri_arrest_candidate', vfib_candidate: 'peri_arrest_candidate',
    pea_candidate: 'arrest_candidate', asystole_candidate: 'arrest_candidate',
  };
  const rhythmClass = RCLASS[rhythm] || 'normal';
  const ECGPAT = {
    normal_sinus: 'pqrst_normal', sinus_tachycardia: 'pqrst_fast', sinus_bradycardia: 'pqrst_slow',
    unstable_tachycardia: 'pqrst_fast_irregular', unstable_bradycardia: 'pqrst_slow_irregular',
    ventricular_irritability: 'pqrst_ectopy', vtach_candidate: 'wide_fast', vfib_candidate: 'chaotic',
    pea_candidate: 'organized_low_perfusion', asystole_candidate: 'flatline',
  };
  const ecgPattern = ECGPAT[rhythm] || 'pqrst_normal';
  // perfusing — pea/asystole는 false, vfib 후보 false, vtach 후보는 조건부
  let perfusing = true;
  if (rhythm === 'pea_candidate' || rhythm === 'asystole_candidate' || rhythm === 'vfib_candidate') perfusing = false;
  else if (rhythm === 'vtach_candidate') perfusing = (MAP >= 50 && perf >= 0.35);
  const electricalActivityPresent = (rhythm !== 'asystole_candidate');
  // shockableHint — vfib true, pulseless vtach만 true, pea/asystole/그외 false
  let shockableHint = false, nonShockableReason = null;
  if (rhythm === 'vfib_candidate') shockableHint = true;
  else if (rhythm === 'vtach_candidate' && !perfusing) shockableHint = true;
  else if (rhythm === 'pea_candidate') nonShockableReason = 'pulseless_electrical_activity';
  else if (rhythm === 'asystole_candidate') nonShockableReason = 'no_electrical_activity';
  // perfusingRhythmFactor — 다음 tick hemodynamics에 약한 feedback (보수적)
  let perfusingRhythmFactor = 1.0;
  if (rhythmClass === 'unstable') perfusingRhythmFactor = 0.92;
  else if (rhythm === 'vtach_candidate') perfusingRhythmFactor = perfusing ? 0.78 : 0.55;
  else if (rhythm === 'vfib_candidate') perfusingRhythmFactor = 0.30;
  else if (rhythm === 'pea_candidate') perfusingRhythmFactor = 0.25;
  else if (rhythm === 'asystole_candidate') perfusingRhythmFactor = 0.12;
  // SIDE-MED-PHYS-HOTFIX-1A §2-D: confirmed_physiologic perfusingRhythmPenalty — 리듬 효율만 약하게 제한 (rhythmClass 강제 금지)
  if (pcr && (pcr.physiologicPerfusingPenalty || 0) > 0) {
    perfusingRhythmFactor = Math.max(0.25, Math.min(1.0, perfusingRhythmFactor - (pcr.physiologicPerfusingPenalty || 0) * 0.45));
  }
  // severity / stability
  const severity = (rhythmClass === 'arrest_candidate') ? 'critical' : (rhythmClass === 'peri_arrest_candidate') ? 'severe' : (rhythmClass === 'unstable') ? 'moderate' : (rhythm === 'normal_sinus' ? 'none' : 'mild');
  const stability = clamp01(1 - riskScore);
  // triggerTags
  const triggerTags = [];
  if (hypo === 'severe' || hypo === 'critical') triggerTags.push('hypovolemia');
  if (o2 < 0.55) triggerTags.push('hypoxia');
  if (hd.decompensatingShock) triggerTags.push('decompensating_shock');
  if (pcr.heartAdjacentTrack) triggerTags.push('heart_adjacent');
  if (pcr.thoracicVesselRisk) triggerTags.push('thoracic_vessel');
  if ((pcr.tensionPneumothoraxRisk || 0) > 0.5) triggerTags.push('tension_risk');
  if ((sr.panic || 0) > 0.5) triggerTags.push('panic');
  if (sr.combatArousal > 0.5) triggerTags.push('combat_arousal');

  const timeInRhythm = (prev && prev.rhythm === rhythm) ? ((prev.timeInRhythm || 0) + dt) : 0;
  const transitioned = !prev || prev.rhythm !== rhythm;

  m.cardiacRhythmModel = {
    rhythm, rhythmClass, severity, stability: +stability.toFixed(3),
    shockableHint, nonShockableReason, perfusing, rateHint: Math.round(HR),
    ecgPattern, riskScore: +riskScore.toFixed(3), triggerTags,
    lastUpdateTime: now, timeInRhythm: +timeInRhythm.toFixed(2), transitionReason,
    candidateOnly: true, heartRateState: m._heartRateState || 'calm',
    composureInfluence: +cp.composure.toFixed(2), perfusingRhythmFactor: +perfusingRhythmFactor.toFixed(3),
    electricalActivityPresent, resuscitationCandidate: (shockableHint || rhythmClass === 'arrest_candidate'),
    rhythmTreatmentLocked: (rhythmClass === 'peri_arrest_candidate' || rhythmClass === 'arrest_candidate'),
    _ventTime: +ventTime.toFixed(2), _unstableTime: +unstableTime.toFixed(2), _periArrestTime: +periArrestTime.toFixed(2),
    _transitioned: transitioned,
  };
  // CARDIAC-1R §20: 전이 시에만 AAR 로그 (스팸 방지) — 불안정 이상 등급 진입만.
  if (transitioned && typeof log === 'function' && (rhythmClass === 'unstable' || rhythmClass === 'peri_arrest_candidate' || rhythmClass === 'arrest_candidate')) {
    const RKO = { unstable_tachycardia:'불안정 빈맥', unstable_bradycardia:'불안정 서맥', ventricular_irritability:'심실 자극 후보', vtach_candidate:'심실빈맥 후보', vfib_candidate:'심실세동 후보', pea_candidate:'무맥성 전기활동 후보', asystole_candidate:'무수축 후보' };
    const reason = pcr.heartAdjacentTrack ? '심장 인접 궤적' : (o2 < 0.5 ? '저산소' : hd.decompensatingShock ? '보상 붕괴' : '관류 저하');
    log(`[${unit.name}] 심장 리듬: ${RKO[rhythm] || rhythm} — ${reason} (리듬 모델, 소생 처치 미구현)`, rhythmClass === 'arrest_candidate' ? 'warn' : 'info');
  }
  return m.cardiacRhythmModel;
}

// === PRECARDIAC-1 §10: pre-cardiac risk profile — 다음 cardiac rhythm 단계의 "입력"이다.
//   이 flag로 lifeStatus/death를 직접 바꾸지 않는다. ECG는 cardiacRhythmModel을 읽어 P-QRS-T rhythm-aware display를 한다(치료 엔진 아님).
function buildPreCardiacRisk(unit) {
  const m = unit.medical; if (!m) return null;
  const hd = m.hemodynamics || {};
  let tensionMax = 0, hemoMax = 0, pneumoMax = 0, heartAdjacent = false, thoracicVessel = false;
  let physRhythmRisk = 0, physPerfPenalty = 0, physPreArrest = 0;
  if (m.wounds) for (const w of m.wounds) {
    const ctm = w.chestTraumaModel;
    if (ctm) {
      tensionMax = Math.max(tensionMax, ctm.tensionPneumothoraxRisk || 0);
      hemoMax = Math.max(hemoMax, ctm.hemothoraxRisk || 0);
      pneumoMax = Math.max(pneumoMax, (ctm._pneumoProg != null ? ctm._pneumoProg : ctm.pneumothoraxRisk) || 0);
    }
    const oim = w.organInjuryModel;
    if (oim && oim.injuries) for (const inj of oim.injuries) {
      if (inj.organ === 'heart_hook_only') heartAdjacent = true;
      if (inj.organ === 'thoracic_vessel' && (inj.status === 'suspected' || inj.status === 'likely' || inj.status === 'confirmed_limited')) thoracicVessel = true;
    }
    // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §7/§8: confirmed_physiologic rhythm risk 입력 강화 (확정 손상 아님)
    const pep = w.physiologicEffectProfile;
    if (pep) {
      physRhythmRisk = Math.max(physRhythmRisk, pep.rhythmRiskBoost || 0);
      physPerfPenalty = Math.max(physPerfPenalty, pep.perfusingRhythmPenalty || 0);
      physPreArrest = Math.max(physPreArrest, pep.preArrestBoost || 0);
    }
  }
  const severeChest = (tensionMax >= 0.5) || (pneumoMax >= 0.7) || (hemoMax >= 0.6);
  m.preCardiacRisk = {
    hypovolemiaSeverity: hd.hypovolemiaSeverity || 'none',
    decompensatingShock: !!hd.decompensatingShock,
    poorPerfusion: !!hd.poorPerfusion,
    lowOxygenDelivery: (hd.oxygenDelivery != null) ? hd.oxygenDelivery < 0.55 : false,
    severeChestTrauma: severeChest,
    tensionPneumothoraxRisk: +tensionMax.toFixed(2),
    hemothoraxRisk: +hemoMax.toFixed(2),
    thoracicVesselRisk: thoracicVessel,
    physiologicRhythmRisk: +physRhythmRisk.toFixed(3),
    physiologicPerfusingPenalty: +physPerfPenalty.toFixed(3),
    physiologicPreArrestBoost: +physPreArrest.toFixed(3),
    heartAdjacentTrack: heartAdjacent,
    cardiacInjuryCandidateOnly: true,                      // 확정 심장손상 없음 — 후보/감시 단계
    rhythmModelReadySignal: !!(hd.cardiacRhythmReadySignal || severeChest),
    arrestRiskHint: !!(hd.preArrestRisk || tensionMax >= 0.8),   // 힌트 — 사망/리듬 판정 직접 사용 금지
  };
  return m.preCardiacRisk;
}
// === SIDE-MED-2C §4/§18/§19: 경량 unit assessment (airway/exposure hook 포함) ===
function buildTcccAssessment(unit) {
  const m = unit.medical; if (!m) return null;
  const phase = getTcccCarePhase(unit, null, null);
  let airwayConcern = false, airwayReason = '', hypothermiaRisk = false;
  const wounds = m.wounds || [];
  let massiveHemorrhage = false, openChest = false, cavityBleed = false;
  for (const w of wounds) {
    if (w.hemorrhageControlModel && w.hemorrhageControlModel.isMassiveHemorrhage) massiveHemorrhage = true;
    if (w.chestTraumaModel && w.chestTraumaModel.openChestWound) openChest = true;
    if (w.internalBleedingModel && w.internalBleedingModel.sourceType === 'cavity') cavityBleed = true;
    if ((w.partKey === 'neck') || (w.candidateMap && w.candidateMap.some(c => c.type === 'airway'))) { airwayConcern = true; airwayReason = 'neck/airway candidate'; }
  }
  if ((m.consciousness != null && m.consciousness < 35) && (m.shock || 0) > 50) { airwayConcern = true; airwayReason = airwayReason || 'reduced consciousness'; }
  if ((m.bloodMl != null && m.bloodMl < 3500) || cavityBleed) hypothermiaRisk = true;
  let marchStep = 'none', recommendedAction = 'monitor';
  if (massiveHemorrhage) { marchStep = 'M'; recommendedAction = 'hemorrhage_control'; }
  else if (airwayConcern) { marchStep = 'A'; recommendedAction = 'airway_hook'; }
  else if (openChest) { marchStep = 'R'; recommendedAction = 'chest_seal'; }
  else if (cavityBleed || (m.shock || 0) > 50) { marchStep = 'C'; recommendedAction = 'evac_circulation'; }
  else if ((m.pain || 0) > 60) { marchStep = 'P'; recommendedAction = 'painkiller'; }
  m.airwayModel = { airwayConcern, airwayObstructionRisk: airwayConcern, neckTraumaConcern: wounds.some(w => w.partKey === 'neck'), reducedConsciousnessAirwayRisk: (m.consciousness != null && m.consciousness < 35), airwayInterventionCandidate: airwayConcern, airwayInterventionAvailable: false, reason: airwayReason };
  m.exposureModel = { hypothermiaRisk, exposedCasualty: phase === 'evacuation_pending', severeBloodLossExposureRisk: (m.bloodMl != null && m.bloodMl < 3000), hypothermiaPreventionCandidate: hypothermiaRisk };
  m.tcccAssessment = { phase, marchStep, recommendedAction, massiveHemorrhage, openChest, cavityBleed, airwayConcern };
  return m.tcccAssessment;
}

// === 1) 출혈 처리 ===
// SIDE-MED-BASELINE-1 §3/§4: 지속 출혈 source-of-truth 규칙
//   • wounds가 있으면 wound.bleedingProfile이 1차 source-of-truth → updateMedicalBleedingWoundBased.
//     (그 함수가 부위별 effective rate를 계산해 bodyParts.external/internalBleedRate에 '=' 대입 = 합산 표시값)
//   • wounds가 없는 legacy damage 상태에서만 아래 bodyParts fallback이 작동.
//   • applyDamageEvent가 피격 즉시 넣는 bodyParts bleed는 '초기 반응/ fallback'일 뿐,
//     wound가 있으면 다음 tick에 wound 기반 값으로 덮어써진다(이중 증폭 없음).
//   • bodyParts bleedRate가 wound 기반 합산을 다시 덮어쓰는 경로를 만들지 말 것.
function updateMedicalBleeding(unit, dt) {
  const m = unit.medical;
  // wound 데이터가 있으면 wound 합산 우선(source-of-truth), 없으면 기존 bodyParts 기반 legacy fallback
  if (m.wounds && m.wounds.length > 0) {
    try { updateMedicalBleedingWoundBased(unit, dt); m._bleedSource = 'wound'; return; }
    catch (e) { m._bleedSource = 'legacy_fallback(err)'; /* 실패 시 legacy fallback */ }
  } else {
    m._bleedSource = 'legacy_fallback';
  }
  let totalExt = 0, totalInt = 0;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (p.externalBleedRate > 0 && p.externalBleedRate < 2.0) {
      p.externalBleedRate = Math.max(0, p.externalBleedRate - 0.02 * dt);
    }
    if (p.tourniquetApplied && (k === 'leftArm' || k === 'rightArm' || k === 'leftLeg' || k === 'rightLeg')) {
      p.externalBleedRate = 0;
    }
    if (p.bandageApplied) {
      if (p.externalBleedRate > 1.5) {
        p.externalBleedRate = Math.max(1.5, p.externalBleedRate - 0.5 * dt);
      } else {
        p.externalBleedRate = Math.max(0, p.externalBleedRate - 0.3 * dt);
      }
    }
    totalExt += p.externalBleedRate;
    totalInt += p.internalBleedRate;
  }
  m.externalBleedRate = totalExt;
  m.internalBleedRate = totalInt;
  const totalBleed = totalExt + totalInt;
  if (totalBleed > 0) m.bloodMl = Math.max(0, m.bloodMl - totalBleed * dt);
}

// === 2) 저혈량성 전신 손상 (기존 — clamp 유지) ===
function updateSystemicHypoxiaDamage(unit, dt) {
  const m = unit.medical;
  if (m.bloodMl >= 3350) return;
  const HYP_MUL = { head: 0.85, neck: 0.90, chest: 1.25, abdomen: 1.45,
                    leftArm: 0.45, rightArm: 0.45, leftLeg: 0.55, rightLeg: 0.55 };
  let sysRate = 0;
  if (m.bloodMl < 1800)      sysRate = 8.0;
  else if (m.bloodMl < 2500) sysRate = 4.5;
  else if (m.bloodMl < 3000) sysRate = 2.0;
  else                       sysRate = 0.6;
  for (const k of BODY_PART_KEYS) {
    const p = m.bodyParts[k];
    if (p.hp > 0) {
      p.hp = Math.max(0, p.hp - sysRate * (HYP_MUL[k] || 1.0) * dt);
      recomputeBodyPartFunctionRatio(p);   // FRACTURE-FUNC-SYNC-1 Phase1 §5: 골절 패널티 유지하며 재계산
    }
  }
}

// === 3) StressResponse — 전투흥분/아드레날린/공황/통증마스킹 (dt 기반 decay) ===
function updateStressResponse(unit, dt) {
  const m = unit.medical;
  const sr = m.stressResponse;
  sr.timeSinceLastThreat += dt;
  sr.timeSinceLastDamage += dt;
  // 위협 입력
  const sup = (unit.suppression || 0) / 100;
  const recentHit = sr.timeSinceLastDamage < 3.5 ? (1 - sr.timeSinceLastDamage / 3.5) : 0;
  const enemyClose = (unit.currentTarget && unit.currentTarget.x != null)
    ? Math.max(0, Math.min(1, 1 - Math.hypot(unit.x - unit.currentTarget.x, unit.y - unit.currentTarget.y) / mToPx(10)))   // SIDE-METRIC-SCALE-1: 10m
    : 0;
  const newThreatInput = clamp01(sup * 0.6 + recentHit * 0.4 + enemyClose * 0.3);
  // dt 기반 exponential decay — FPS 독립적
  sr.threatDrive = Math.max(decayExp(sr.threatDrive, dt, 1.5), newThreatInput);
  sr.threatDrive = clamp01(sr.threatDrive);
  if (sr.threatDrive > 0.15 || recentHit > 0) sr.timeSinceLastThreat = 0;
  // 부상 입력
  const painNorm = m.pain / 100;
  const shockNorm = m.shock / 100;
  const lifeLoss = 1 - m.lifeStatus / 100;
  const newInjuryInput = clamp01(painNorm * 0.5 + shockNorm * 0.4 + lifeLoss * 0.3);
  sr.injuryDrive = Math.max(decayExp(sr.injuryDrive, dt, 3.0), newInjuryInput);
  sr.injuryDrive = clamp01(sr.injuryDrive);
  // 제압 — suppression 매 tick에서 직접 읽으므로 별도 감쇠 불필요
  sr.suppressionDrive = sup;
  // combatArousal target
  const arousalTarget = clamp01(sr.threatDrive * 0.7 + sr.injuryDrive * 0.5 + sr.suppressionDrive * 0.5);
  // approachValue — rise 빠르게, fall 느리게
  sr.combatArousal = clamp01(approachValue(sr.combatArousal, arousalTarget, 2.0, 0.25, dt));
  // adrenaline target
  const lowBpDrive = m.systolicBP < 95 ? Math.max(0, (95 - m.systolicBP) / 95) : 0;
  const adrenalineTarget = clamp01(
    sr.combatArousal * 0.7 + painNorm * 0.35 + lowBpDrive * 0.3 + shockNorm * 0.25 + sr.threatDrive * 0.3
  );
  sr.adrenaline = clamp01(approachValue(sr.adrenaline, adrenalineTarget, 2.5, 0.35, dt));
  // CARDIAC-1R §6: 숙련도 침착성 — adrenalineControl이 높으면 과폭주(상한)를 낮춘다 (출혈엔 무영향).
  const cp = getUnitComposureProfile(unit);
  const adrCeil = 1.0 - (cp.adrenalineControl - 0.6) * 0.35;   // elite ≈ 0.885, recruit ≈ 1.07→clamp1
  sr.adrenaline = Math.min(sr.adrenaline, clamp01(adrCeil));
  // sympatheticTone (느린 변화)
  const sympTarget = clamp01(
    sr.adrenaline * 0.6 + lowBpDrive * 0.4 + (1 - Math.min(1, m.bloodMl/m.bloodMax)) * 0.5 + painNorm * 0.2
  );
  sr.sympatheticTone = clamp01(approachValue(sr.sympatheticTone, sympTarget, 1.0, 0.5, dt));
  // panic — CARDIAC-1R §6: composure.panicResistance + startleResistance(피격 직후) 기반
  const panicResistance = Math.max(0.4, Math.min(1.5, 0.5 + cp.panicResistance));
  const startleSpike = recentHit * (1 - cp.startleResistance) * 0.5;   // recruit는 피격 startle 큼
  const panicTarget = clamp01((
    sup * 0.4 + (m.lifeStatus < 30 ? 0.3 : 0) + (m.consciousness < 50 ? 0.25 : 0)
    + (m.bloodMl < 2500 ? 0.25 : 0) + sr.threatDrive * 0.3 + startleSpike
  ) / panicResistance);
  sr.panic = clamp01(approachValue(sr.panic, panicTarget, 1.5, 0.4, dt));
  // painMasking — adrenaline / painkiller / combatArousal
  const analgesia = (unit.analgesiaLevel || 0) / 100;
  const maskTarget = Math.min(0.85, sr.adrenaline * 0.45 + sr.combatArousal * 0.20 + analgesia * 0.65);
  sr.painMasking = clampMed(approachValue(sr.painMasking, maskTarget, 1.2, 0.6, dt), 0, 0.85);
  // perceivedPain = pain * (1 - painMasking)
  sr.perceivedPain = m.pain * (1 - sr.painMasking);
  // postCombatCrash — 위협 없고 adrenaline이 떨어지며 부상이 남아있을 때
  //   CARDIAC-1R §6: postCombatRecovery 높으면 crash가 더 빨리 가신다 (elite 회복 빠름).
  const adrenalineDropping = (sr.combatArousal < 0.3 && sr.timeSinceLastThreat > 5);
  const injuryPresent = (m.pain > 30 || m.lifeStatus < 70 || m.shock > 20);
  const recoveryRate = 0.05 * (0.6 + cp.postCombatRecovery);
  if (adrenalineDropping && injuryPresent) {
    sr.postCombatCrash = clamp01(approachValue(sr.postCombatCrash, 1.0 * (1.3 - cp.postCombatRecovery * 0.5), 0.15, recoveryRate, dt));
  } else {
    sr.postCombatCrash = clamp01(approachValue(sr.postCombatCrash, 0, recoveryRate, recoveryRate, dt));
  }
}

// === 4) HormonalCompensation — vasopressin/RAAS (느린 보상) ===
function updateHormonalCompensation(unit, dt) {
  const m = unit.medical;
  const hc = m.hormonalCompensation;
  const lowBp = m.systolicBP < 95 ? Math.max(0, (95 - m.systolicBP) / 95) : 0;
  const lowVol = Math.max(0, 1 - m.bloodMl / m.bloodMax);
  const shockNorm = m.shock / 100;
  // vasopressin (ADH) — 분 단위 반응 (rise/fall 모두 매우 느림)
  const vasoTarget = clamp01(lowBp * 0.6 + lowVol * 0.5 + shockNorm * 0.3);
  hc.vasopressin = clamp01(approachValue(hc.vasopressin, vasoTarget, 0.08, 0.04, dt));
  // RAAS — 더 느림
  const raasTarget = clamp01(lowVol * 0.6 + lowBp * 0.5 + shockNorm * 0.3);
  hc.raasActivation = clamp01(approachValue(hc.raasActivation, raasTarget, 0.04, 0.02, dt));
  hc.angiotensinTone = clamp01(approachValue(hc.angiotensinTone, hc.raasActivation * 0.8, 0.05, 0.03, dt));
  hc.aldosteroneEffect = clamp01(approachValue(hc.aldosteroneEffect, hc.raasActivation, 0.02, 0.015, dt));
  // cortisol — 장기 스트레스 (debug 용)
  const cortTarget = clamp01(m.stressResponse.combatArousal * 0.7 + m.stressResponse.injuryDrive * 0.3);
  hc.cortisolStress = clamp01(approachValue(hc.cortisolStress, cortTarget, 0.05, 0.02, dt));
}

// === 5) Hemodynamics — preload / vascularTone / contractility / cardiacOutput / perfusion ===
// [심층의료 계약면 §9.4] hemodynamics는 bloodMl/breathingEfficiency 등 결과값을 읽어 반응만 한다.
//   처치/장기손상 수치를 여기에 직접 연결하지 않는다 — 출혈/호흡 경로를 통해서만 간접 반영.
//   TODO(REFINE-1 이후): 내부출혈/대혈관 후보의 정밀 hemodynamics 연결은 후보 레이어 정리 다음 단계.
function updateHemodynamics(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  const hc = m.hormonalCompensation;
  // volumeRatio — 0~1.05 clamp (안전)
  hd.volumeRatio = clampMed(m.bloodMl / Math.max(1, m.bloodMax), 0, 1.05);
  // preload — 정맥환류 (혈액량 기반, 0.05~1.15 clamp)
  let preloadTarget;
  if (m.bloodMl >= 4250) preloadTarget = 1.0;
  else if (m.bloodMl >= 3500) preloadTarget = 0.95 - (4250 - m.bloodMl) / 750 * 0.10;
  else if (m.bloodMl >= 3000) preloadTarget = 0.85 - (3500 - m.bloodMl) / 500 * 0.20;
  else if (m.bloodMl >= 2500) preloadTarget = 0.65 - (3000 - m.bloodMl) / 500 * 0.20;
  else if (m.bloodMl >= 2000) preloadTarget = 0.45 - (2500 - m.bloodMl) / 500 * 0.15;
  else preloadTarget = Math.max(0.10, 0.30 - (2000 - m.bloodMl) / 1500 * 0.20);
  preloadTarget = clampMed(preloadTarget, 0.05, 1.15);
  hd.preload = clampMed(approachValue(hd.preload, preloadTarget, 1.2, 1.2, dt), 0.05, 1.15);
  // vascularTone (혈관수축) — 0.5~1.8 clamp
  const toneFromSymp = sr.sympatheticTone * 0.4;
  const toneFromHormone = hc.vasopressin * 0.25 + hc.angiotensinTone * 0.20;
  let toneTarget = 1.0 + toneFromSymp + toneFromHormone;
  toneTarget *= (1 - hd.compensationExhaustion * 0.5);
  toneTarget = clampMed(toneTarget, 0.5, 1.8);
  hd.vascularTone = clampMed(approachValue(hd.vascularTone, toneTarget, 0.8, 0.8, dt), 0.5, 1.8);
  hd.systemicVascularResistance = clampMed(hd.vascularTone, 0.5, 1.8);
  // contractility — 0.4~1.5 clamp
  let contractTarget = 1.0 + sr.adrenaline * 0.25 + sr.sympatheticTone * 0.15;
  contractTarget *= (1 - hd.compensationExhaustion * 0.4);
  contractTarget *= Math.max(0.6, Math.min(1.0, hd.oxygenDelivery));
  contractTarget = clampMed(contractTarget, 0.4, 1.5);
  hd.contractility = clampMed(approachValue(hd.contractility, contractTarget, 1.0, 1.0, dt), 0.4, 1.5);
  // strokeVolumeMul = preload * contractility — HR 효율 감소
  let svMul = hd.preload * hd.contractility;
  const hr = m.heartRate;
  if (hr > 100) svMul *= 1 - Math.min(0.45, (hr - 100) / 80 * 0.45);
  if (hr > 170) svMul *= 0.7;
  hd.strokeVolumeMul = clampMed(svMul, 0.05, 1.3);
  // cardiacOutputMul — SV 가중치 0.7, HR factor 0.3 (둘 다 곱하면 폭증)
  // CARDIAC-1R §8: 명시적 빈맥/서맥 penalty. 정상범위 보상, 과도 빈맥은 filling time↓, 서맥은 output↓.
  let hrFactor = clampMed(hr / 75, 0.5, 2.0);
  let fillingTimePenalty = 1.0, bradyPenalty = 1.0;
  if (hr > 145) fillingTimePenalty = 1 - Math.min(0.35, (hr - 145) / 60 * 0.35);   // 145+ 충만 시간 감소
  if (hr < 50)  bradyPenalty = Math.max(0.45, hr / 50);                              // 50↓ output 저하
  hrFactor *= fillingTimePenalty * bradyPenalty;
  // 직전 tick의 불안정 리듬이면 관류 리듬 효율 하락 (1-tick feedback — 약하게, 보수적).
  const _priorRhythm = m.cardiacRhythmModel;
  let perfusingRhythmFactor = 1.0;
  if (_priorRhythm && _priorRhythm.perfusingRhythmFactor != null) perfusingRhythmFactor = _priorRhythm.perfusingRhythmFactor;
  hd.cardiacEfficiency = +(fillingTimePenalty * bradyPenalty * perfusingRhythmFactor).toFixed(3);
  hd.cardiacOutputMul = clampMed(
    (hd.strokeVolumeMul * 0.7 + hd.strokeVolumeMul * hrFactor * 0.3) * (0.7 + perfusingRhythmFactor * 0.3), 0.05, 1.5
  );
  // MAP
  hd.map = clampMed(93 * (hd.cardiacOutputMul * 0.6 + hd.systemicVascularResistance * 0.4), 20, 200);
  hd.pulsePressure = clampMed(hd.strokeVolumeMul * 40, 15, 80);
  // tissuePerfusion — MAP + CO 종합 (0~1.2 clamp)
  hd.tissuePerfusion = clampMed(
    (hd.map / 93) * 0.5 + (hd.cardiacOutputMul / 1.0) * 0.5, 0, 1.2
  );
  // oxygenDelivery
  hd.oxygenDelivery = clampMed(
    hd.tissuePerfusion * (m.breathingEfficiency / 100) * 0.9 + 0.1, 0, 1.2
  );
  // FIELD-STAB-1 §8/§14: airway support → oxygenDelivery 제한적 보정 (직전 tick 값, 1-tick feedback).
  //   원인(저산소)을 약하게 완화할 뿐 — bloodMl/internal bleeding/tension은 건드리지 않음.
  const _fs = m.fieldStabilizationModel;
  if (_fs) {
    const awMod = (_fs.airwaySupport && _fs.airwaySupport.oxygenDeliveryModifier) || 1.0;
    const crMod = (_fs.chestRelief && _fs.chestRelief.oxygenDeliveryModifier) || 1.0;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * awMod * crMod, 0, 1.2);
    // circulation support — MAP/perfusion 매우 제한적 보정 (field limited)
    const csMapMod = (_fs.circulationSupport && _fs.circulationSupport.mapSupportModifier) || 1.0;
    const csPerfMod = (_fs.circulationSupport && _fs.circulationSupport.perfusionSupportModifier) || 1.0;
    if (csMapMod !== 1.0) hd.map = clampMed(hd.map * csMapMod, 20, 200);
    if (csPerfMod !== 1.0) { hd.tissuePerfusion = clampMed(hd.tissuePerfusion * csPerfMod, 0, 1.2); hd.oxygenDelivery = clampMed(hd.oxygenDelivery * csPerfMod, 0, 1.2); }
  }
  // RESIDUAL HOTFIX 3: iv_fluid / oxygen 보조효과 제한 지속 (시간벌기 · 매우 약함). 출혈 source / internalBleeding / surgery·transfusion·definitiveCare markers 불변.
  const _nowHd = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (m._ivAssistUntil && _nowHd < m._ivAssistUntil) {
    hd.map = clampMed(hd.map * 1.03, 20, 200);                         // 수액: MAP/perfusion 중심 소폭 (bloodMl/oxygenDelivery 혈액대체 아님)
    hd.tissuePerfusion = clampMed(hd.tissuePerfusion * 1.02, 0, 1.2);
  }
  if (m._oxygenAssistUntil && _nowHd < m._oxygenAssistUntil) {
    // 산소: oxygenDelivery 소폭만 (bloodMl 회복 아님). 혈액량 극도 부족/호흡효율 급락 시 효과 제한.
    const _o2cap = (m.breathingEfficiency < 25 || hd.volumeRatio < 0.55) ? 1.02 : 1.04;
    hd.oxygenDelivery = clampMed(hd.oxygenDelivery * _o2cap, 0, 1.2);
  }
  // compensationLoad
  hd.compensationLoad = clamp01(
    sr.sympatheticTone * 0.5 + sr.adrenaline * 0.3
    + Math.max(0, (hd.vascularTone - 1.0) * 0.8) + hc.vasopressin * 0.3
  );
  // compensationExhaustion — approachValue로 부드럽게 (rise 매우 느림, fall 더 느림)
  if (hd.compensationLoad > 0.5 && m.bloodMl < 3500) {
    const exhaustGain = 0.015 * (hd.compensationLoad - 0.5) * 2;
    hd.compensationExhaustion = clamp01(hd.compensationExhaustion + exhaustGain * dt);
  } else {
    hd.compensationExhaustion = clamp01(decayExp(hd.compensationExhaustion, dt, 60.0));
  }
  // compensated/decompensating shock 판정
  hd.compensatedShock = (m.bloodMl < 3500 && m.systolicBP >= 90 && hd.compensationLoad > 0.4);
  // CARDIAC-1R Cleanup B: decompensatingShock을 preArrestRisk/readySignal보다 먼저 계산 —
  //   severe shock tick에서 신호가 한 tick 늦게 켜지는 현상 제거 (최신 상태 반영).
  hd.decompensatingShock = (m.bloodMl < 2800 && m.systolicBP < 90 && hd.compensationLoad > 0.5)
    || (hd.compensationExhaustion > 0.6 && m.systolicBP < 95);
  // === PRECARDIAC-1 §5: 위험 단계 flag (다음 cardiac 단계 입력 — rhythm state 아님) ===
  hd.hypovolemiaSeverity = (m.bloodMl >= 4250) ? 'none' : (m.bloodMl >= 3500) ? 'mild' : (m.bloodMl >= 3000) ? 'moderate' : (m.bloodMl >= 2500) ? 'severe' : 'critical';
  hd.poorPerfusion = hd.tissuePerfusion < 0.6;
  // SIDE-MED-PHYS-HOTFIX-1A §2-B: confirmed_physiologic oxygenDrain — 잔여 저산소 보조 감쇠 (breathingDrain과 중복 크기 금지, bloodMl 영향 없음)
  {
    const _pep = aggregatePhysiologicEffectProfile(unit.medical);
    if (_pep.oxygenDrain > 0) hd.oxygenDelivery = clampMed(hd.oxygenDelivery * (1 - _pep.oxygenDrain * 0.50), 0, 1.2);
  }
  hd.oxygenDebt = hd.oxygenDelivery < 0.6;
  // preArrestRisk는 "위험 힌트"일 뿐 — arrest/사망 판정에 직접 사용 금지 (rhythm 본편은 후속 단계).
  hd.preArrestRisk = (hd.hypovolemiaSeverity === 'critical') || (hd.oxygenDelivery < 0.4) || (hd.decompensatingShock && hd.compensationExhaustion > 0.7);
  hd.cardiacRhythmReadySignal = hd.preArrestRisk || hd.decompensatingShock || hd.oxygenDebt;
}

// === CARDIAC-1R §7: 심박 상태 분류 (표시/입력용 — 값 자체는 updateVitals에서 계산) ===
function getHeartRateState(m) {
  const hr = m.heartRate;
  const hd = m.hemodynamics || {};
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  if (hd.preArrestRisk && (hr < 50 || hr > 170)) return 'peri_arrest';
  if (hr < 50) return (hd.decompensatingShock || o2 < 0.5) ? 'late_shock_bradycardia' : 'sinus_bradycardia_state';
  if (hr > 150) return (hd.poorPerfusion || o2 < 0.55) ? 'unstable_tachycardia' : 'panic_tachycardia';
  if (hr > 130) return (hd.compensatedShock || hd.decompensatingShock) ? 'tachycardic_compensation' : 'panic_tachycardia';
  if (hr > 100) return 'combat_aroused';
  if (hr > 88) return 'alert';
  return 'calm';
}
// === 6) Vitals (HR/BP/RESP) 최종값 — hemodynamics 기반 ===
function updateVitalsFromHemodynamics(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  // HR target — baseHR + 각종 드라이브
  const lossPct = (1 - hd.volumeRatio) * 100;
  let hypovolemiaDrive = 0;
  if (lossPct >= 33) hypovolemiaDrive = 35 + (lossPct - 33) * 1.2;
  else if (lossPct >= 20) hypovolemiaDrive = 20 + (lossPct - 20) * 1.15;
  else if (lossPct >= 10) hypovolemiaDrive = 8 + (lossPct - 10) * 1.2;
  else hypovolemiaDrive = lossPct * 0.8;
  const lowBpDrive = m.systolicBP < 95 ? Math.max(0, (95 - m.systolicBP) * 0.6) : 0;
  const adrenalineDrive = sr.adrenaline * 30;
  const arousalDrive = sr.combatArousal * 15;
  // CARDIAC-1R §5/§6: panic 빈맥 spike는 composure로 완화 (recruit 큼, elite 작음). 출혈 무영향.
  const cp = getUnitComposureProfile(unit);
  const panicDrive = sr.panic * 25 * (1.25 - cp.composure * 0.5);
  const painDrive = sr.perceivedPain * 0.15;
  const shockDrive = m.shock * 0.35;
  const breathingDrive = m.breathingEfficiency < 60 ? (60 - m.breathingEfficiency) * 0.4 : 0;
  let hrTarget = 75 + hypovolemiaDrive + lowBpDrive + adrenalineDrive + arousalDrive
    + panicDrive + painDrive + shockDrive + breathingDrive;
  // CARDIAC-1R §7: 말기/임종기 서맥 — 심근 저산소·임종 상태는 직접 결과. stress 캐스케이드와 무관하게 적용.
  //   compensated shock(생존 가능)은 빈맥 유지, agonal(임종)만 서맥 hard-cap (directive 30~70 범위).
  const o2 = (hd.oxygenDelivery != null) ? hd.oxygenDelivery : 1.0;
  const agonal = (m.lifeStatus < 15 && o2 < 0.4) || (o2 < 0.28) || (hd.decompensatingShock && hd.compensationExhaustion > 0.7 && o2 < 0.5);
  if (agonal) {
    const severity = clamp01((0.4 - o2) * 2 + (15 - m.lifeStatus) / 15 * 0.5 + Math.max(0, (hd.compensationExhaustion - 0.7)) * 1.5);
    const agonalRate = 28 + (1 - severity) * 38;   // severity 1 → ~28bpm, 0.5 → ~47bpm
    hrTarget = Math.min(hrTarget, agonalRate);
  }
  hrTarget = Math.max(25, Math.min(190, hrTarget));
  // smoothing — 피격/공포 spike는 빠르게(rise), 진정은 느리게. 단 dt scaling 유지.
  const hrLerp = (hrTarget > m.heartRate) ? Math.min(1, dt * 1.4) : Math.min(1, dt * 0.9);
  m.heartRate += (hrTarget - m.heartRate) * hrLerp;
  m._heartRateState = getHeartRateState(m);
  // BP target — hemodynamics.map 기반
  //   systolic = MAP + pulsePressure/2 (대략 +15~25)
  let bpTarget = hd.map + Math.min(25, hd.pulsePressure * 0.6);
  // 보상이 깨지면 BP 급락
  if (hd.compensationExhaustion > 0.5) {
    bpTarget *= (1 - (hd.compensationExhaustion - 0.5) * 0.8);
  }
  bpTarget = Math.max(20, Math.min(170, bpTarget));
  m.systolicBP += (bpTarget - m.systolicBP) * Math.min(1, dt * 0.7);
  m.diastolicBP = Math.max(15, m.systolicBP * 0.65 + 5);
  // breathing — 호흡 회복 (느림) + panic/adrenaline 시 빨라짐
  if (m.breathingEfficiency < 100 && m.shock < 50 && m.bloodMl > 3500) {
    m.breathingEfficiency = Math.min(100, m.breathingEfficiency + 1.0 * dt);
  }
}

// === 7) Pain / Shock / Consciousness ===
function updatePainShockConsciousness(unit, dt) {
  const m = unit.medical;
  const hd = m.hemodynamics;
  const sr = m.stressResponse;
  // Pain 자연 감소
  if (m.pain > 0) m.pain = Math.max(0, m.pain - 1.5 * dt);
  // perceivedPain 갱신 (stressResponse에서도 갱신되지만 여기서 한번 더 보장)
  sr.perceivedPain = m.pain * (1 - sr.painMasking);
  // Shock — bloodMl 낮으면 상승, 안정 시 천천히 감소
  if (m.bloodMl < 3000 || hd.decompensatingShock) {
    m.shock = Math.min(100, m.shock + 2.0 * dt);
  } else if (m.shock > 0 && m.bloodMl > 3500 && m.externalBleedRate + m.internalBleedRate < 5) {
    m.shock = Math.max(0, m.shock - 0.8 * dt);
  }
  // tissuePerfusion 낮으면 shock 추가 상승
  if (hd.tissuePerfusion < 0.55) m.shock = Math.min(100, m.shock + 1.0 * dt);
  // SIDE-MED-PHYS-HOTFIX-1A §2-C: confirmed_physiologic shockBoost — shock 천천히 상승 (clamp, unconscious/death 강제 금지)
  {
    const _pep = aggregatePhysiologicEffectProfile(m);
    if (_pep.shockBoost > 0) m.shock = Math.min(100, m.shock + Math.min(0.30, _pep.shockBoost) * 3.0 * dt);
  }
  // Consciousness — hemodynamics 기반
  let consTarget = 100;
  if (m.systolicBP < 70) consTarget -= 50;
  else if (m.systolicBP < 90) consTarget -= 20;
  if (m.shock > 70) consTarget -= 30;
  if (m.bloodMl < 2000) consTarget -= 40;
  if (m.breathingEfficiency < 35) consTarget -= 25;
  if (hd.oxygenDelivery < 0.5) consTarget -= 20;
  if (hd.decompensatingShock) consTarget -= 10;
  consTarget = Math.max(0, consTarget);
  if (consTarget < m.consciousness) m.consciousness += (consTarget - m.consciousness) * Math.min(1, dt * 1.2);
  else m.consciousness += (consTarget - m.consciousness) * Math.min(1, dt * 0.3);
}

// === 8) 성능 multipliers 갱신 — perceivedPain + stress 반영 ===
function updateMedicalPerformanceMultipliers(unit, dt) {
  const m = unit.medical;
  const sr = m.stressResponse;
  const hd = m.hemodynamics;
  // ===== aim =====
  // arm function (좌우)
  const lArm = m.bodyParts.leftArm.functionRatio;
  const rArm = m.bodyParts.rightArm.functionRatio;
  const armFn = Math.min(lArm, rArm) * 0.4 + (lArm + rArm) / 2 * 0.6;
  let aim = 1.0;
  aim *= 0.4 + armFn * 0.6;
  // perceivedPain (실제 pain이 아니라 느끼는 통증)
  aim *= 1.0 - (sr.perceivedPain / 100) * 0.35;
  // adrenaline 과다 — 손떨림 (0.7 이상에서 점진적 손해)
  if (sr.adrenaline > 0.7) aim *= 1.0 - (sr.adrenaline - 0.7) * 0.6;
  // panic
  aim *= 1.0 - sr.panic * 0.40;
  // breathing
  aim *= 0.5 + (m.breathingEfficiency / 100) * 0.5;
  // consciousness
  aim *= 0.4 + (m.consciousness / 100) * 0.6;
  // HR 과상승
  if (m.heartRate > 150) aim *= 1.0 - Math.min(0.25, (m.heartRate - 150) / 100);
  // tissuePerfusion 낮음
  aim *= 0.5 + Math.min(0.5, hd.tissuePerfusion * 0.5);
  m.aimMul = Math.max(0.05, Math.min(1.0, aim));
  // ===== move =====
  const lLeg = m.bodyParts.leftLeg.functionRatio;
  const rLeg = m.bodyParts.rightLeg.functionRatio;
  const legFn = (lLeg + rLeg) / 2;
  let mv = 1.0;
  mv *= 0.2 + legFn * 0.8;
  // perceivedPain (adrenaline으로 일부 완화)
  mv *= 1.0 - (sr.perceivedPain / 100) * 0.3;
  // shock
  mv *= 1.0 - (m.shock / 100) * 0.4;
  // low BP
  if (m.systolicBP < 90) mv *= 0.7;
  if (m.systolicBP < 70) mv *= 0.5;
  // breathing
  if (m.breathingEfficiency < 55) mv *= 0.7;
  // tissuePerfusion
  if (hd.tissuePerfusion < 0.6) mv *= 0.7;
  // postCombatCrash
  mv *= 1.0 - sr.postCombatCrash * 0.15;
  m.moveMul = Math.max(0, Math.min(1.0, mv));
  // ===== reaction =====
  let rx = 1.0;
  // adrenaline 적정 (0.3~0.7) — 약간 향상 / 과다 — 저하
  if (sr.adrenaline < 0.3) rx *= 1.0;
  else if (sr.adrenaline < 0.7) rx *= 1.0 + (sr.adrenaline - 0.3) * 0.15;
  else rx *= 1.06 - (sr.adrenaline - 0.7) * 0.5;
  // panic — 크게 악화
  rx *= 1.0 - sr.panic * 0.55;
  // shock
  rx *= 1.0 - (m.shock / 100) * 0.30;
  // low BP
  if (m.systolicBP < 80) rx *= 0.75;
  if (m.systolicBP < 60) rx *= 0.6;
  // consciousness
  rx *= 0.3 + (m.consciousness / 100) * 0.7;
  // postCombatCrash
  rx *= 1.0 - sr.postCombatCrash * 0.20;
  m.reactionMul = Math.max(0.25, Math.min(1.20, rx));
  // ===== reload =====
  let rl = 1.0;
  rl *= 0.3 + armFn * 0.7;
  rl *= 1.0 - (sr.perceivedPain / 100) * 0.25;
  rl *= 1.0 - sr.panic * 0.30;
  if (sr.adrenaline > 0.75) rl *= 1.0 - (sr.adrenaline - 0.75) * 0.4;   // 손떨림으로 재장전도 느려짐
  rl *= 0.4 + (m.consciousness / 100) * 0.6;
  m.reloadMul = Math.max(0.20, Math.min(1.0, rl));
  // ===== weaponHandling =====
  let wh = 1.0;
  wh *= 0.4 + armFn * 0.6;
  wh *= 1.0 - (sr.perceivedPain / 100) * 0.20;
  wh *= 1.0 - sr.panic * 0.25;
  if (sr.adrenaline > 0.8) wh *= 1.0 - (sr.adrenaline - 0.8) * 0.4;
  m.weaponHandlingMul = Math.max(0.25, Math.min(1.0, wh));
  // ===== stanceChange =====
  let sc = 1.0;
  sc *= 0.3 + legFn * 0.7;
  sc *= 1.0 - (sr.perceivedPain / 100) * 0.30;
  sc *= 1.0 - (m.shock / 100) * 0.35;
  if (m.systolicBP < 80) sc *= 0.75;
  if (m.breathingEfficiency < 60) sc *= 0.80;
  m.stanceChangeMul = Math.max(0.25, Math.min(1.0, sc));
  // canShoot / canMove 갱신
  // SIDE-WEAPON-INJURY-HANDLING-1A: canShoot은 절대 불가만 (사망/의식불명/의식 극저하/양팔 모두 기능상실).
  //   팔별·무기별 사용 가능 여부는 isWeaponSlotUsable()가 최종 판정.
  const _laGone = m.bodyParts.leftArm.disabled || (m.bodyParts.leftArm.functionRatio != null && m.bodyParts.leftArm.functionRatio <= 0.12);
  const _raGone = m.bodyParts.rightArm.disabled || (m.bodyParts.rightArm.functionRatio != null && m.bodyParts.rightArm.functionRatio <= 0.12);
  m.canShoot = !m.isDead && !m.isUnconscious && m.consciousness > 12 && !(_laGone && _raGone);
  m.canWalk = !m.isDead && !m.isUnconscious && m.consciousness > 25 && legFn > 0.30 && m.systolicBP > 60;
  m.canCrawl = !m.isDead && !m.isUnconscious && m.consciousness > 15 && armFn > 0.15;
  m.canMove = m.canWalk || m.canCrawl;
}

// === lifeStatus + statusTags 계산 (multipliers는 updateMedicalPerformanceMultipliers가 담당) ===
function recalcMedicalSummary(unit) {
  const m = unit.medical;
  if (!m) return;
  ensureMedicalExtensions(unit);
  const sr = m.stressResponse;
  const hd = m.hemodynamics;
  const hc = m.hormonalCompensation;
  // bodyHpTotal 합산
  let total = 0;
  for (const k of BODY_PART_KEYS) total += m.bodyParts[k].hp;
  m.bodyHpTotal = total;
  // lifeStatus — 종합 (혈액 + perfusion + shock + breathing + 의식 + 부위치명)
  let life = 100;
  const lossPct = (1 - m.bloodMl / m.bloodMax) * 100;
  life -= lossPct * 0.55;
  // tissuePerfusion이 낮으면 추가 감점 (단순 lossPct 선형 X)
  if (hd && hd.tissuePerfusion < 0.7) life -= (0.7 - hd.tissuePerfusion) * 50;
  if (hd && hd.oxygenDelivery < 0.6) life -= (0.6 - hd.oxygenDelivery) * 40;
  life -= m.shock * 0.30;
  if (m.systolicBP < 90) life -= (90 - m.systolicBP) * 0.25;
  if (m.breathingEfficiency < 70) life -= (70 - m.breathingEfficiency) * 0.4;
  if (m.consciousness < 50) life -= (50 - m.consciousness) * 0.35;
  // 부위 치명
  if (m.bodyParts.head.hp <= 0) { life = 0; m.deathReason = m.deathReason || 'head_destroyed'; }
  if (m.bodyParts.neck.hp <= 0) { life = Math.min(life, 5); m.deathReason = m.deathReason || 'neck_destroyed'; }
  if (m.bodyParts.chest.hp <= 5) { life -= 30; }
  if (m.bodyParts.abdomen.hp <= 5) { life -= 20; }
  m.lifeStatus = Math.max(0, Math.min(100, life));
  // legacy 표시값
  m.aimPerformance = m.aimMul * 100;
  m.mobility = m.moveMul * 100;
  m.reactionPerformance = m.reactionMul * 100;
  m.combatEffectiveness = (m.aimMul + m.moveMul + m.reactionMul) / 3 * 100;
  // boolean state
  m.isAlive = m.lifeStatus > 0 && !m.isDead;
  m.isCombatEffective = m.combatEffectiveness > 30 && m.canShoot;
  m.isUnconscious = m.consciousness < 20;
  // === statusTags 갱신 (우선순위 높은 것만) ===
  const tags = [];
  // 위중 (높은 우선순위)
  if (hd && hd.decompensatingShock) tags.push('보상 붕괴');
  else if (hd && hd.compensatedShock) tags.push('보상성 쇼크');
  if (hd && hd.compensationExhaustion > 0.6) tags.push('보상피로');
  if (sr && sr.panic > 0.6) tags.push('공황');
  if (sr && sr.postCombatCrash > 0.5) tags.push('전투 후 crash');
  // 보조
  if (sr && sr.adrenaline > 0.7 && tags.length < 4) tags.push('아드레날린 상승');
  if (sr && sr.painMasking > 0.4 && m.pain > 30 && tags.length < 4) tags.push('통증 둔화');
  if (sr && sr.combatArousal > 0.6 && tags.length < 4) tags.push('전투흥분');
  if (hd && hd.tissuePerfusion < 0.55 && tags.length < 5) tags.push('조직관류 저하');
  if (hd && hd.oxygenDelivery < 0.55 && tags.length < 5) tags.push('산소공급 저하');
  if (hd && hd.vascularTone > 1.25 && tags.length < 5) tags.push('혈관수축');
  if (hc && hc.vasopressin > 0.5 && tags.length < 6) tags.push('ADH 반응');
  if (hc && hc.raasActivation > 0.5 && tags.length < 6) tags.push('RAAS 활성');
  m.statusTags = tags;
}

// === legacy state sync — 기존 unit.hp/isDead/isDowned/conscious와 동기화 ===
function syncLegacyCombatState(unit) {
  const m = unit.medical;
  if (!m) return;
  // 사망 판정 (medical 기반)
  let dead = false;
  if (m.lifeStatus <= 0) dead = true;
  if (m.bodyParts.head.hp <= 0) { dead = true; m.deathReason = m.deathReason || 'head_destroyed'; }
  if (m.bloodMl < 1200) { dead = true; m.deathReason = m.deathReason || 'exsanguination'; }
  if (m.systolicBP < 30 && m.bloodMl < 1800) { dead = true; m.deathReason = m.deathReason || 'cardiac_failure'; }
  // downed 판정
  let downed = false;
  if (!dead) {
    if (m.consciousness < 30) downed = true;
    if (m.systolicBP < 70) downed = true;
    if (m.shock > 85) downed = true;
    if (m.lifeStatus < 25) downed = true;
    if (!m.canMove && !m.canShoot) downed = true;
    if (m.bloodMl < 2000) downed = true;
  }
  // conscious 판정
  const conscious = !m.isUnconscious;

  // 상태 변경 감지
  const wasDead = unit.isDead;
  const wasDowned = unit.isDowned;
  if (dead && !wasDead) {
    unit.isDead = true;
    unit.alive = false;
    unit.isDowned = true;   // dead도 시각적으론 downed
    unit.conscious = false;
    unit.combatState = 'dead';
    m.isDead = true; m.isAlive = false;
    // 사망 처리 시 stance 강제 prone (legacy 호환)
    unit.stance = 'prone';
    unit.forcedProneTimer = 9999;
    if (typeof log === 'function') log(`${unit.name} 전사 (${m.deathReason || 'unknown'})`, 'warn');
  } else if (downed && !wasDowned && !dead) {
    unit.isDowned = true;
    unit.alive = true;
    unit.canBeDragged = true;
    unit.conscious = conscious;
    unit.combatState = 'downed';
    m.isDowned = true;
    if (unit.downedTime === 0) unit.downedTime = 0.01;
    // downed 시 자세 prone (legacy)
    unit.stance = 'prone';
    if (typeof log === 'function') log(`${unit.name} 전투불능 (${m.lifeStatus.toFixed(0)}%)`, 'warn');
  } else if (!dead && !downed && wasDowned) {
    // 회복 — 다시 active (드물지만 처치로 가능)
    unit.isDowned = false;
    unit.canBeDragged = false;
    unit.combatState = m.lifeStatus < 70 ? 'wounded' : 'active';
  } else if (!dead && !downed) {
    unit.conscious = conscious;
    if (m.lifeStatus < 70 || m.bodyHpTotal < m.bodyHpMax * 0.85) {
      if (unit.combatState !== 'wounded') unit.combatState = 'wounded';
    }
  }

  // legacy hp (요약값) — lifeStatus 기반 0~100
  unit.hp = Math.round(m.lifeStatus);
  unit.maxHp = 100;
  // legacy bodyHp (이전 구조 호환) — 모든 부위 sync
  if (unit.bodyHp) {
    unit.bodyHp.head = m.bodyParts.head.hp;
    unit.bodyHp.neck = m.bodyParts.neck.hp;
    unit.bodyHp.chest = m.bodyParts.chest.hp;
    unit.bodyHp.abdomen = m.bodyParts.abdomen.hp;
    unit.bodyHp.left_arm = m.bodyParts.leftArm.hp;
    unit.bodyHp.right_arm = m.bodyParts.rightArm.hp;
    unit.bodyHp.left_leg = m.bodyParts.leftLeg.hp;
    unit.bodyHp.right_leg = m.bodyParts.rightLeg.hp;
    unit.bodyHp.arms = (m.bodyParts.leftArm.hp + m.bodyParts.rightArm.hp) / 2;
    unit.bodyHp.legs = (m.bodyParts.leftLeg.hp + m.bodyParts.rightLeg.hp) / 2;
  }
  // legacy pain
  unit.pain = m.pain;
  // legacy fracture tag — medical bodyParts.fracture 기반
  let hasArmFx = m.bodyParts.leftArm.fracture || m.bodyParts.rightArm.fracture;
  let hasLegFx = m.bodyParts.leftLeg.fracture || m.bodyParts.rightLeg.fracture;
  let hasChestFx = m.bodyParts.chest.fracture;
  if (hasArmFx && hasLegFx) unit.fracture = 'multiple';
  else if (hasArmFx) unit.fracture = 'arm';
  else if (hasLegFx) unit.fracture = 'leg';
  else if (hasChestFx) unit.fracture = 'chest';
  else unit.fracture = 'none';
  // bleeding tag (UI/AI용)
  const total = m.externalBleedRate + m.internalBleedRate;
  if (total < 0.5) unit.bleeding = 'none';
  else if (total < 8) unit.bleeding = 'light';
  else if (total < 30) unit.bleeding = 'heavy';
  else unit.bleeding = 'critical';
}


// =============================================================
