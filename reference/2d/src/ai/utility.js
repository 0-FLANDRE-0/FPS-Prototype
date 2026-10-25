// Utility AI — 점수 기반 행동 선택 레이어
// =============================================================
//   설계 원칙:
//   1) 기존 AI tick(사격/이동/감지/facing)은 그대로 유지
//   2) Utility AI는 추가 행동(엄폐 이동/후퇴/엎드림/재장전 트리거/조사 이동/holdAngle)을 명령 형태로 발급
//   3) 강제 반응(수류탄/사망/의식불명/플레이어 명령)은 점수보다 우선
//   4) 일정 주기로 평가, 행동 완료 후 reassess

// 훈련도별 판단 파라미터
function getUtilityProfile(unit) {
  const skillId = (unit.skill && unit.skill.presetId) || 'regular';
  if (skillId === 'recruit') {
    return { interval: 0.70, contactInterval: 0.35, scoreNoise: 8, switchThreshold: 22, panicMul: 1.3 };
  }
  if (skillId === 'veteran') {
    return { interval: 0.45, contactInterval: 0.22, scoreNoise: 3, switchThreshold: 16, panicMul: 0.6 };
  }
  if (skillId === 'elite') {
    return { interval: 0.40, contactInterval: 0.20, scoreNoise: 1, switchThreshold: 14, panicMul: 0.4 };
  }
  return { interval: 0.55, contactInterval: 0.28, scoreNoise: 5, switchThreshold: 18, panicMul: 1.0 };
}

// 강제 반응 체크 — true면 Utility AI 건너뜀
function shouldSkipUtility(unit) {
  if (!unit.alive || unit.isDead || unit.isDowned) return true;
  if (unit.treatmentTimer > 0) return true;
  if (unit.draggedBy != null) return true;
  // 수류탄 반응 진행 중
  if (unit.pendingGrenadeReact) return true;
  if (unit.grenadeReactionDelay > 0) return true;
  // forcedProneTimer 분기:
  //   - grenade/panic prone은 Utility skip (반응 진행 중)
  //   - utility prone은 skip X — 엎드린 상태에서도 holdAngle/engage 판단 가능
  if (unit.forcedProneTimer > 0) {
    if (unit._proneReason === 'grenade' || unit._proneReason === 'panic') return true;
    // utility prone은 통과 — Utility AI가 새 행동 평가 가능
  }
  // stanceTransition 진행 중 — 자세 안정화될 때까지 새 판단 X (단 수류탄/사망은 별도 처리)
  if (unit.stanceTransition) return true;
  // 플레이어가 직접 명령한 이동 — Utility 우선권 없음 (단 수류탄/사망은 위 강제 반응에서 처리됨)
  if (unit.team === 'friend' && unit.movePath && unit.movePath.length > 0) {
    if (unit._aiCommandPath !== unit.movePath) return true;
  }
  // 재장전 중 — 완료까지 유지 (단 수류탄/사망은 위에서 처리)
  if (unit.reloadTimer > 0) return true;
  // 수류탄 반응 직후(직전 frame까지 prone/evade였음) — 행동 즉시 reassess
  //   forcedProneTimer가 0이 됐는데 aiAction이 grenade 회피와 관련된 옛 상태면 만료
  if (unit._wasInGrenadeReaction && !unit.pendingGrenadeReact && unit.grenadeReactionDelay <= 0 && unit.forcedProneTimer <= 0) {
    unit._wasInGrenadeReaction = false;
    if (unit.aiAction) {
      unit.aiAction = null;
      unit.aiIntent = 'reassess';
      unit.aiUtilityNext = GAME.gameTime || 0;   // 다음 frame에 즉시 평가
    }
  }
  return false;
}

// AI 행동 평가 context 생성
function buildAIContext(unit) {
  if (!GAME.aiProfileOn) return _buildAIContextImpl(unit);
  _aiProfCall('buildAIContext');
  const _t0 = _aiProfNow();
  try { return _buildAIContextImpl(unit); }
  finally { _aiProfRecord('buildAIContext', _aiProfNow() - _t0); }
}
function _buildAIContextImpl(unit) {
  const mem = (typeof ensureAIMemory === 'function') ? ensureAIMemory(unit) : (unit.aiMemory || {});
  const med = unit.medical || null;
  const ctx = {
    unit,
    mem,
    medical: med,
    // === Medical AI context (1단계) ===
    lifeStatus: med ? med.lifeStatus : 100,
    bloodMl: med ? med.bloodMl : 5000,
    externalBleedRate: med ? med.externalBleedRate : 0,
    internalBleedRate: med ? med.internalBleedRate : 0,
    medShock: med ? med.shock : 0,
    consciousness: med ? med.consciousness : 100,
    aimPerformance: med ? med.aimPerformance : 100,
    medMobility: med ? med.mobility : 100,
    combatEffectiveness: med ? med.combatEffectiveness : 100,
    medCanMove: med ? med.canMove : true,
    medCanShoot: med ? med.canShoot : true,
    isCombatEffective: med ? med.isCombatEffective : true,
    activeSevereBleed: med ? (med.externalBleedRate + med.internalBleedRate) > 15 : false,
    breathingTrouble: med ? med.breathingEfficiency < 70 : false,
    lowBloodPressure: med ? med.systolicBP < 90 : false,
    // === 1.5단계 — stressResponse / hemodynamics ===
    combatArousal: (med && med.stressResponse) ? med.stressResponse.combatArousal : 0,
    adrenaline: (med && med.stressResponse) ? med.stressResponse.adrenaline : 0,
    panic: (med && med.stressResponse) ? med.stressResponse.panic : 0,
    perceivedPain: (med && med.stressResponse) ? med.stressResponse.perceivedPain : (med ? med.pain : 0),
    painMasking: (med && med.stressResponse) ? med.stressResponse.painMasking : 0,
    postCombatCrash: (med && med.stressResponse) ? med.stressResponse.postCombatCrash : 0,
    tissuePerfusion: (med && med.hemodynamics) ? med.hemodynamics.tissuePerfusion : 1.0,
    oxygenDelivery: (med && med.hemodynamics) ? med.hemodynamics.oxygenDelivery : 1.0,
    cardiacOutputMul: (med && med.hemodynamics) ? med.hemodynamics.cardiacOutputMul : 1.0,
    compensatedShock: (med && med.hemodynamics) ? med.hemodynamics.compensatedShock : false,
    decompensatingShock: (med && med.hemodynamics) ? med.hemodynamics.decompensatingShock : false,
    compensationExhaustion: (med && med.hemodynamics) ? med.hemodynamics.compensationExhaustion : 0,
    vasopressin: (med && med.hormonalCompensation) ? med.hormonalCompensation.vasopressin : 0,
    raasActivation: (med && med.hormonalCompensation) ? med.hormonalCompensation.raasActivation : 0,
    panicHigh: (med && med.stressResponse) ? med.stressResponse.panic > 0.5 : false,
    inDecompensation: (med && med.hemodynamics) ? med.hemodynamics.decompensatingShock : false,
    lowPerfusion: (med && med.hemodynamics) ? med.hemodynamics.tissuePerfusion < 0.6 : false,
    visibleEnemies: [],
    visibleEnemyCount: 0,
    nearestEnemy: null,
    nearestEnemyDist: Infinity,
    threatPos: null,
    threatSource: null,
    exposedToEnemy: false,
    inCover: !!unit.inCover,
    suppression: unit.suppression || 0,
    pain: med ? med.pain : (unit.pain || 0),
    recentlyHit: ((GAME.gameTime || 0) - (unit._lastHitTime || -999)) < 3.5,
    ammoLow: false, ammoEmpty: false,
    // severeWound — 새 medical 기준
    severeWound: med
      ? (med.lifeStatus < 45 || med.bloodMl < 3000 || med.shock > 70 || med.consciousness < 50
         || !med.isCombatEffective || med.breathingEfficiency < 55)
      : (unit.hp < unit.maxHp * 0.40 || unit.bleeding === 'critical'),
    bleeding: unit.bleeding,
    grenadeDanger: false,
    enemyFirepower: 0, friendlyFirepower: 0, firepowerBalance: 0,
    hasGoodCoverNearby: false,
    lastSeenEnemy: mem.lastSeenEnemy,
    lastHeardNoise: mem.lastHeardNoise,
    preferredWatchAngle: mem.preferredWatchAngle,
    // 이 감시각이 **둘러보기가 스스로 써 넣은 것**인가.
    //   `scoreHoldAngle`은 감시각이 있으면 +8을 주는데, 그건 "볼 이유가 있다"는 뜻이었다.
    //   둘러보기가 그 칸을 채우면 holdAngle이 자기 자신에게 뇌물을 주는 꼴이 된다 —
    //   실제로 guardEntry가 32%→25%로 밀렸다. 출처를 표시해 그 가산을 막는다.
    _watchFromIdleScan: !!(unit._idleScan && unit._idleScan.ang != null
                           && mem.preferredWatchAngle === unit._idleScan.ang),
  };
  // 탄약 상태
  const magMax = unit.magCapacity || 30;
  if (unit.magAmmo <= 0) ctx.ammoEmpty = true;
  else if (unit.magAmmo / magMax <= 0.30) ctx.ammoLow = true;

  // 보이는 적 — [AI-PERF Phase2] canonical perception snapshot 공유 (targeting과 동일 visible set/confidence).
  //   이전의 단순 LOS(isInFOV+isLOSBlockedForBlast) 대신 checkVisibility 결과를 쓴다 → 표적/utility 시야 불일치 제거.
  {
    const _snap = getPerceptionSnapshot(unit);
    for (const _rec of _snap.enemies) {
      if (!_rec.visible) continue;
      const u = _rec.unit;
      if (u.isDead || u.team === unit.team) continue;
      ctx.visibleEnemies.push(u);
      ctx.visibleEnemyCount++;
      if (_rec.dist < ctx.nearestEnemyDist) { ctx.nearestEnemyDist = _rec.dist; ctx.nearestEnemy = u; }
    }
  }

  // 위협 위치
  if (ctx.nearestEnemy) {
    ctx.threatPos = { x: ctx.nearestEnemy.x, y: ctx.nearestEnemy.y };
    ctx.threatSource = 'visible';
  } else if (mem.lastSeenEnemy) {
    ctx.threatPos = { x: mem.lastSeenEnemy.x, y: mem.lastSeenEnemy.y };
    ctx.threatSource = 'memory';
  } else if (mem.lastHeardNoise) {
    ctx.threatPos = { x: mem.lastHeardNoise.x, y: mem.lastHeardNoise.y };
    ctx.threatSource = 'noise';
  } else if (unit.threatDirection != null && (GAME.gameTime - unit.threatTime) < 4.0) {
    ctx.threatPos = { x: unit.x + Math.cos(unit.threatDirection) * 200, y: unit.y + Math.sin(unit.threatDirection) * 200 };
    ctx.threatSource = 'damage';
  }

  // 노출 — 위협 위치 기준 LOS 차단 없으면 노출
  if (ctx.threatPos && typeof isLOSBlockedForBlast === 'function') {
    ctx.exposedToEnemy = !isLOSBlockedForBlast(ctx.threatPos.x, ctx.threatPos.y, unit.x, unit.y);
  }

  // === coverState — threat 방향 기준 실제 엄폐 여부 ===
  let cs = null;
  if (typeof computeCoverState === 'function') {
    const tx = ctx.threatPos ? ctx.threatPos.x : null;
    const ty = ctx.threatPos ? ctx.threatPos.y : null;
    cs = computeCoverState(unit, tx, ty);
    unit.coverState = cs;
    // context에 반영 — 기존 inCover/exposedToEnemy 보정
    ctx.inCover = cs.inCover;
    ctx.coverType = cs.coverType;
    ctx.coverQuality = cs.coverQuality;
    ctx.canReturnFire = cs.canReturnFire;
    ctx.coverObjectId = cs.coverObjectId;
    ctx.exposedToThreat = cs.exposedToThreat;
    // exposedToEnemy 재정의 — coverState가 더 정확
    if (cs.inCover) ctx.exposedToEnemy = false;
    if (cs.exposedToThreat) ctx.exposedToEnemy = true;
    ctx.enemyBehindCover = !!cs.enemyBehindCover;
    ctx.enemyBehindPartialCover = !!cs.enemyBehindPartialCover;
    ctx.enemyBehindFullCover = !!cs.enemyBehindFullCover;
    ctx.enemyCoverObjectId = cs.enemyCoverObjectId;
  }

  // 수류탄 위험 — [0.38.2 Fix2] canonical getGrenadeDangerForUnit 사용 (fast path와 동일 기준).
  ctx.grenadeDanger = getGrenadeDangerForUnit(unit);

  // 화력 우세/열세 — 시야 안의 적/아군 단순 카운트 + 거리 보정
  let enFP = 0, frFP = 0;
  if (Array.isArray(UNITS)) {
    for (const u of UNITS) {
      if (u.isDead) continue;
      const d = Math.hypot(u.x - unit.x, u.y - unit.y);
      if (d > 350) continue;
      const distMul = Math.max(0.2, 1.0 - d / 350);
      const ammoOK = (u.magAmmo || 0) > 0 ? 1.0 : 0.3;
      const condMul = u.isDowned ? 0.2 : 1.0;
      const fp = distMul * ammoOK * condMul;
      if (u.team === unit.team) frFP += fp;
      else                       enFP += fp;
    }
  }
  ctx.enemyFirepower = enFP;
  ctx.friendlyFirepower = frFP;
  ctx.firepowerBalance = frFP - enFP;   // 양수 = 우세

  // 좋은 cover 미리 평가 — [AI-PERF Phase4] 조건부 캐시. 위협/유닛 위치·엄폐집합·suppression 등이
  //   의미 있게 변하지 않으면 이전 best cover 재사용 (findBestCover가 매 tick 반복 호출되지 않도록).
  if (ctx.threatPos && typeof findBestCover === 'function') {
    const bc = getCachedBestCover(unit, ctx.threatPos);
    if (bc && bc.score > 50) {
      ctx.hasGoodCoverNearby = true;
      ctx.bestCover = bc;
    }
  }

  // 믿음 방 — 경계할 문 / 클리어할 문을 여기서 한 번만 고른다(두 스코어러가 공유)
  if (typeof prepBeliefRoomContext === 'function') prepBeliefRoomContext(unit, ctx);
  if (typeof prepPeekContext === 'function') prepPeekContext(unit, ctx);   // 문턱 선택 뒤에 — noiseDriven을 물려받는다
  if (typeof prepFragContext === 'function') prepFragContext(unit, ctx);
  if (typeof prepScreenContext === 'function') prepScreenContext(unit, ctx);
  if (typeof prepObjectiveContext === 'function') prepObjectiveContext(unit, ctx);
  if (typeof prepSupportContext === 'function') prepSupportContext(unit, ctx);

  // === 위협 분류 — Immediate (지금 맞고 있거나 곧 맞을) vs Potential (잠재) ===
  const now = GAME.gameTime || 0;
  // Immediate threat 조건
  let immediateThreat = false;
  let immediateSource = null;
  if (ctx.grenadeDanger) { immediateThreat = true; immediateSource = 'grenadeDanger'; }
  if (ctx.recentlyHit)   { immediateThreat = true; immediateSource = 'recentlyHit'; }
  if (ctx.suppression > 60) { immediateThreat = true; immediateSource = immediateSource || 'highSuppression'; }
  if (ctx.visibleEnemyCount > 0 && ctx.exposedToEnemy) {
    immediateThreat = true; immediateSource = immediateSource || 'visibleEnemyExposed';
  }
  if (mem.lastHeardGunshot && (now - mem.lastHeardGunshot.heardAt) < 4
      && ctx.exposedToThreat && ctx.suppression > 30) {
    immediateThreat = true; immediateSource = immediateSource || 'gunshotExposedSuppressed';
  }
  if (mem.lastSeenEnemy && (now - mem.lastSeenEnemy.lastSeenTime) < 3 && ctx.exposedToThreat) {
    immediateThreat = true; immediateSource = immediateSource || 'lastSeenExposedRecent';
  }
  ctx.hasImmediateThreat = immediateThreat;
  ctx.immediateThreatSource = immediateSource;

  // Potential threat — 잠재 위협 (goProne 진입 사유 아님)
  let potentialThreat = false;
  if (mem.possibleEntrances && mem.possibleEntrances.length > 0) potentialThreat = true;
  if (mem.dangerousEntrances && mem.dangerousEntrances.length > 0) potentialThreat = true;
  if (mem.suspectedEnemyPos) potentialThreat = true;
  if (ctx.lastHeardNoise) potentialThreat = true;
  if (ctx.exposedToThreat && !immediateThreat) potentialThreat = true;
  ctx.hasPotentialThreat = potentialThreat;

  // grace 상태 — 스폰/방진입 직후 goProne 억제
  ctx.inSpawnGrace = (unit.spawnedAt != null && (now - unit.spawnedAt) < 3.0);
  ctx.inInitialScanGrace = (unit._initialBurst && unit._initialBurst.phase !== 'complete')
                          || (unit.initialTacticalGraceUntil != null && now < unit.initialTacticalGraceUntil);
  ctx.inRoomEntryGrace = (unit.lastRoomEntryTime != null && (now - unit.lastRoomEntryTime) < 2.0);

  return ctx;
}

// === 행동별 점수 함수 ===
function scoreEngageEnemy(ctx) {
  const u = ctx.unit;
  if (ctx.visibleEnemyCount === 0) return 0;
  if (ctx.ammoEmpty) return 5;
  // canShoot false면 engage 불가
  if (ctx.medCanShoot === false) return 0;
  let s = 50;
  s += Math.min(20, ctx.visibleEnemyCount * 8);
  if (ctx.inCover) s += 15;
  if (ctx.nearestEnemyDist < 150) s += 12;
  s += ctx.firepowerBalance * 8;
  if (ctx.ammoLow) s -= 12;
  if (ctx.suppression > 50) s -= 18;
  if (ctx.exposedToEnemy) s -= 20;
  if (ctx.severeWound) s -= 18;
  if (ctx.grenadeDanger) s -= 30;
  if (ctx.enemyBehindFullCover) s -= 30;
  else if (ctx.enemyBehindPartialCover) s -= 12;
  if (ctx.inCover && !ctx.canReturnFire) s -= 25;
  // === 1.5단계 — 생리 상태 반영 ===
  if (ctx.decompensatingShock) s -= 35;       // 보상 붕괴 — 교전 가치 크게 ↓
  else if (ctx.compensatedShock) s -= 10;     // 보상성 쇼크 — 약간 ↓
  if (ctx.lowPerfusion) s -= 12;              // 조직관류 저하
  if (ctx.consciousness < 60) s -= 15;
  if (ctx.panic > 0.6) s -= 20;               // 공황 — 합리적 교전 어려움
  else if (ctx.panic > 0.3) s -= 8;
  // adrenaline 적정 — 단기 buff (과다는 panic으로 따로 처리)
  if (ctx.adrenaline >= 0.3 && ctx.adrenaline <= 0.7) s += 6;
  if (ctx.perceivedPain >= 70) s -= 12;       // 극심한 체감 통증
  return s;
}

function scoreSeekCover(ctx) {
  const u = ctx.unit;
  if (ctx.inCover && !ctx.exposedToEnemy && ctx.coverQuality >= 0.9) return 10;
  if (!ctx.bestCover) return 5;
  let s = 30;
  if (ctx.exposedToEnemy || ctx.exposedToThreat) s += 25;
  if (ctx.recentlyHit)           s += 20;
  if (ctx.suppression > 40)      s += 18;
  if (ctx.severeWound)           s += 22;
  if (ctx.ammoEmpty || ctx.ammoLow) s += 12;
  s -= ctx.firepowerBalance * 6;
  if (ctx.inCover && ctx.coverType === 'partialCover' && ctx.exposedToThreat) s += 12;
  s += Math.min(30, ctx.bestCover.score * 0.3);
  if (ctx.threatPos) {
    const curD = Math.hypot(u.x - ctx.threatPos.x, u.y - ctx.threatPos.y);
    const spotD = Math.hypot(ctx.bestCover.spotX - ctx.threatPos.x, ctx.bestCover.spotY - ctx.threatPos.y);
    if (spotD < curD * 0.7) s -= 25;
  }
  // === 1.5단계 — 부상/공황/저관류 시 엄폐 우선 ===
  if (ctx.decompensatingShock) s += 25;
  if (ctx.activeSevereBleed)   s += 18;
  if (ctx.lowPerfusion)        s += 12;
  if (ctx.panic > 0.5)         s += 12;
  // canMove false면 큰 이동 불가 — score 감소 (hold/crawl로 유도)
  if (ctx.medCanMove === false) s -= 30;
  return s;
}

function scoreRetreatFromThreat(ctx) {
  const u = ctx.unit;
  if (!ctx.threatPos) return 5;
  let s = 15;
  if (ctx.firepowerBalance < -1.0) s += 25;
  if (ctx.severeWound)             s += 28;
  if (ctx.bleeding === 'critical') s += 20;
  if (ctx.bleeding === 'heavy')    s += 12;
  if (ctx.suppression > 60)        s += 15;
  if (ctx.visibleEnemyCount >= 3)  s += 12;
  if (ctx.friendlyFirepower < 0.5) s += 12;
  if (ctx.firepowerBalance > 1.0)  s -= 25;
  if (ctx.ammoEmpty)               s += 18;
  // === 1.5단계 — 보상 붕괴/저관류 시 후퇴 ↑, 이동 불가면 ↓ ===
  if (ctx.decompensatingShock) s += 20;
  if (ctx.lowPerfusion)        s += 10;
  if (ctx.medCanMove === false) s -= 40;     // 이동 불가 — 후퇴 X (hold로 유도)
  if (ctx.medMobility < 50)    s -= 15;       // 이동 효율 낮음
  if (ctx.panic > 0.7)         s += 10;       // 공황 시 비합리적 후퇴
  return s;
}

function scoreGoProne(ctx) {
  const u = ctx.unit;
  const now = GAME.gameTime || 0;
  // 이미 prone — 진입 점수 0 (sticky 제거)
  if (u.stance === 'prone') return 0;
  // === 즉시 위협 없으면 0 — 잠재 위협만으로는 엎드리지 않음 ===
  if (!ctx.hasImmediateThreat) {
    ctx._goProneBlockedReason = ctx.hasPotentialThreat ? 'potential_threat_only' : 'no_threat';
    return 0;
  }
  // === 스폰 / 초기 스캔 / 방 진입 grace — 강제 조건 외 0 ===
  const forceConditions = ctx.grenadeDanger
                       || (ctx.recentlyHit && ctx.visibleEnemyCount > 0)
                       || (ctx.suppression > 75 && (ctx.visibleEnemyCount > 0 || (ctx.mem && ctx.mem.lastHeardGunshot
                              && (now - ctx.mem.lastHeardGunshot.heardAt) < 3)));
  if (!forceConditions) {
    if (ctx.inSpawnGrace) { ctx._goProneBlockedReason = 'spawn_grace'; return 0; }
    if (ctx.inInitialScanGrace) { ctx._goProneBlockedReason = 'initial_scan_grace'; return 0; }
    if (ctx.inRoomEntryGrace) { ctx._goProneBlockedReason = 'room_entry_grace'; return 0; }
  }
  // 기상 직후 쿨다운
  if (u.lastProneExitTime != null && (now - u.lastProneExitTime) < 2.5) {
    if (!ctx.grenadeDanger && !ctx.recentlyHit && ctx.suppression < 75) {
      ctx._goProneBlockedReason = 'cooldown_after_getup';
      return 0;
    }
  }
  if (u.stanceTransition) { ctx._goProneBlockedReason = 'stance_transition'; return 0; }
  if (ctx.grenadeDanger) return 90;
  // === Raw 점수 ===
  let raw = 8;
  if (ctx.suppression > 70)      raw += 25;
  else if (ctx.suppression > 45) raw += 12;
  if (ctx.recentlyHit && !ctx.bestCover) raw += 22;
  else if (ctx.recentlyHit)              raw += 8;
  if (ctx.exposedToEnemy && ctx.visibleEnemyCount > 0 && !ctx.bestCover) raw += 18;
  if (ctx.nearestEnemyDist < 80) raw -= 25;
  // === 1.5단계 — 공황/저관류/보상붕괴 시 prone 선호 ↑ ===
  if (ctx.panic > 0.6)         raw += 15;
  if (ctx.lowPerfusion)        raw += 8;
  if (ctx.decompensatingShock) raw += 10;
  // === Stance tactical cost 차감 ===
  const cost = (typeof getStanceTacticalCost === 'function')
    ? getStanceTacticalCost(u, ctx, 'prone') : 0;
  const final = raw - cost;
  ctx._goProneRaw = raw;
  ctx._goProneCost = cost;
  ctx._goProneFinal = final;
  return Math.max(0, final);
}

// === Prone 상태 유지 판단 — utility prone에서 일어날지 결정 ===
//   true: 계속 엎드림 / false: 일어남 가능
function shouldStayProne(unit, ctx) {
  const now = GAME.gameTime || 0;
  // === 즉시 위협이 있어야 유지 ===
  // hasImmediateThreat가 false면 단순 노출 / 잠재 위협만으로는 유지 X
  let stay = false;
  if (ctx.hasImmediateThreat) {
    // 즉시 위협 + 노출 또는 강한 위험이면 유지
    if (ctx.exposedToThreat) stay = true;
    if (ctx.grenadeDanger || ctx.recentlyHit || ctx.suppression > 60) stay = true;
  }
  // proneLock 안이면 무조건 유지
  if (unit.proneLockUntil != null && now < unit.proneLockUntil) stay = true;
  unit._lastShouldStayProne = stay;
  unit._lastHasRealThreat = ctx.hasImmediateThreat;
  return stay;
}

function scoreReloadInCover(ctx) {
  const u = ctx.unit;
  if (!ctx.ammoLow && !ctx.ammoEmpty) return 0;
  let s = ctx.ammoEmpty ? 60 : 30;
  if (ctx.inCover)                  s += 25;
  if (ctx.visibleEnemyCount === 0)  s += 15;
  if (ctx.exposedToEnemy)           s -= 25;
  if (ctx.grenadeDanger)            s -= 40;
  if (ctx.suppression > 60)         s -= 15;
  return s;
}

function scoreInvestigateNoise(ctx) {
  const u = ctx.unit;
  if (!ctx.lastHeardNoise) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;
  const age = (GAME.gameTime || 0) - (ctx.lastHeardNoise.heardAt || 0);
  if (age > 20) return 0;
  let s = 25;
  s -= age * 0.8;
  // === 총성은 진입하지 말고 holdAngle로 — 점수 큰 폭 감소 ===
  if (ctx.lastHeardNoise.type === 'gunshot' || ctx.mem.lastHeardGunshot) {
    s -= 25;
  }
  if (ctx.suppression > 40) s -= 15;
  if (ctx.severeWound)      s -= 25;
  if (ctx.grenadeDanger)    s -= 30;
  if (ctx.recentlyHit)      s -= 20;
  return s;
}

// ── 믿음 방 기반 행동 둘 ───────────────────────────────────────────────
//   문턱을 하나도 모르면 두 점수 모두 0이 되어 기존 holdAngle로 자연 폴백한다.
//   ctx._noiseThreshold는 buildAIContext에서 한 번만 계산해 둔다(두 스코어러가 공유).

// 내 방에 머물며 들어올 문을 경계한다.
//   핵심은 **정보의 질**이다. "소리가 저 문으로 들어왔다"는 "저쪽에서 소리가 났다"보다
//   훨씬 강한 정보라, 그때만 holdAngle(방향만 보는 일반 경계)을 이길 값을 준다.
//   귀속이 없으면(그냥 가까운 문) 낮은 점수로 남아 대개 지는 게 맞다.
function scoreGuardEntry(ctx) {
  const t = ctx._guardThreshold;
  if (!t) return 0;
  let s = 14;
  if (ctx._guardNoiseDriven) {
    s += 30;                                          // 소리가 이 문으로 들어왔다 — 이 행동의 본령
    if (ctx.mem && ctx.mem.lastHeardGunshot) s += 18; // 총성이면 더더욱 진입하지 말고 각을 잡는다
  } else if (ctx.lastHeardNoise) {
    s += 6;
  }
  if (ctx._guardDanger > 0.5)      s += 10;           // 문 너머가 뜨겁다 — 저기로 들어온다
  if (ctx.inCover)                 s += 12;
  if (ctx.firepowerBalance < -0.5) s += 14;           // 열세면 자리를 지킨다
  if (ctx.severeWound)             s += 12;
  if (ctx.ammoLow)                 s += 6;
  if (t.doorBacked)                s += 5;            // 문짝이 달린 문턱 = 확실한 진입로
  // 조용할 때 이 행동은 경쟁이 안 됐다 — 기본 14인데 repositionToCorner는 전술적 문간 코너에서 ~70까지 간다.
  //   둘러보기로 코너 지식이 늘자 reposition이 7%→31%로 불어나며 guardEntry를 18%까지 밀어냈다.
  //   그런데 둘은 **같은 자리를 원한다**(reposition도 doorway에 +20). 서서 지키는 쪽에 값을 준다.
  //   처음엔 +20을 줬다가 과했다 — 스캔과 무관하게 guardEntry가 32%→56%로 불었다.
  //   되돌리려던 것을 두 배로 만든 셈이라, 좁게 걸리는 확정 문턱 가산만 남긴다.
  if (t.confirmed)                 s += 10;           // 확정된 문 — 지킬 값이 있는 대상이다
  if (ctx.visibleEnemyCount > 0)   s -= 30;           // 보이면 교전이 우선
  if (ctx.grenadeDanger)           s -= 30;
  if (ctx.firepowerBalance > 1.0)  s -= 12;           // 우세하면 나가서 잡는 게 낫다
  return s;
}

// 미확인 방을 클리어하러 간다.
function scoreClearUnknownRoom(ctx) {
  const t = ctx._clearThreshold;
  if (!t) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;            // 눈앞의 적이 먼저다
  let s = 10;
  if (ctx.firepowerBalance > 0.5)  s += 16;           // 우세할 때 밀고 들어간다
  if (ctx._clearNoiseDriven)       s += 26;           // 소리가 저 문 너머다 — 확인하러 간다
  if (ctx.mem && ctx.mem.lastHeardGunshot) s -= 24;   // 총성 쪽으로는 함부로 안 들어간다
  // 위험 섹터 — 뜨거운 방으로는 우세할 때만 들어간다
  if (ctx._clearDanger > 0.5) s -= (ctx.firepowerBalance > 1.0 ? 8 : 22);
  if (ctx.inCover)                 s -= 8;
  if (ctx.severeWound)             s -= 26;
  if (ctx.suppression > 40)        s -= 18;
  if (ctx.grenadeDanger)           s -= 30;
  if (ctx.recentlyHit)             s -= 16;
  if (ctx.ammoLow)                 s -= 10;
  if (ctx._clearClaimed)           s -= claimPushPenalty();   // 저 문은 동료가 맡았다
  return s;
}

// =============================================================
// 목표 선점 — "저건 누가 맡았다"
// =============================================================
//   성향이 의도 중복을 39% → 18%까지 내렸다. 남은 18%는 **같은 대상**을 향한 중복이라
//   점수 편향으로는 안 갈린다. 그래서 계층을 세우지 않고 **선점 하나**만 둔다 —
//   엄폐 슬롯 예약(`targetSlotId`)이 "같은 엄폐물을 둘이 잡지 않는다"를 하는 것과 같은 모양이다.
//
//   유닛은 선점을 **하나만** 들고 있고(`unit._claim`), 행동이 바뀌면 놓는다.
//   죽거나 쓰러지면 조회에서 자연히 빠지므로 만료 처리가 필요 없다.
//
//   경계: 선점은 **의도의 공유**이지 지식의 공유가 아니다. 남이 무엇을 보고 있는지는
//   여전히 각자의 믿음이고, "저 문은 누가 맡았다"만 팀이 안다(무전에 해당).
const USE_CLAIMS = true;
function isClaimsOn() {
  if (typeof GAME !== 'undefined' && GAME.claimsOn != null) return !!GAME.claimsOn;
  return USE_CLAIMS;
}
//   문턱은 유닛마다 제 이름(TH-01)을 붙이므로 이름으로는 못 맞춘다. 위치로 맞추되
//   **격자 반올림이 아니라 근접**으로 본다 — 반올림은 경계에서 갈라져서, 같은 문을 보는
//   두 관측자가 4 px 차이로 다른 칸이 될 수 있다(자체테스트가 바로 그 경우를 잡았다).
const CLAIM_RADIUS = 40;
function thresholdClaimKey(th) {
  if (!th || th.ix == null) return null;
  return { x: th.ix, y: th.iy };
}
//   roster는 테스트용 주입구다. 평소에는 UNITS를 본다.
function claimHolder(unit, key, roster) {
  if (!key || !isClaimsOn() || !unit) return null;
  const list = roster || ((typeof UNITS !== 'undefined' && Array.isArray(UNITS)) ? UNITS : (GAME.units || []));
  for (const u of list) {
    if (u === unit || !u.alive || u.isDowned) continue;
    if (u.team !== unit.team || !u._claim) continue;
    if (Math.hypot(u._claim.x - key.x, u._claim.y - key.y) <= CLAIM_RADIUS) return u;
  }
  return null;
}
function setClaim(unit, key) { if (unit) unit._claim = key || null; }
function releaseClaim(unit) { if (unit) unit._claim = null; }
// 남이 맡지 않은 것부터 고른다. 전부 맡혀 있으면 그냥 가장 좋은 것을 쓰되 **맡혔다고 표시**한다.
//   선점은 금지가 아니다. 문이 하나뿐인 방에서 "다른 문을 골라라"는 답이 될 수 없다 —
//   실측에서 그 폴백 때문에 선점을 켜도 같은 문턱 중복이 41% → 43%로 그대로였다.
//   대신 그 표시를 점수가 읽는다: **미는 행동만** 깎여서, 하나가 밀고 나머지는 각을 잡는다.
function preferUnclaimed(unit, list, scoreFn, roster) {
  if (!list || !list.length) return { target: null, claimed: false };
  let best = null, bestS = -Infinity, fallback = null, fallbackS = -Infinity;
  for (const t of list) {
    const s = scoreFn(t);
    if (s > fallbackS) { fallbackS = s; fallback = t; }
    if (isClaimsOn() && claimHolder(unit, thresholdClaimKey(t), roster)) continue;
    if (s > bestS) { bestS = s; best = t; }
  }
  if (best) return { target: best, claimed: false };
  return { target: fallback, claimed: isClaimsOn() && !!fallback };
}
//   감점 크기가 균형을 정한다. 세게 잡으면 중복은 사라지지만 전원이 각만 잡는다(실측 아래).
let CLAIM_PUSH_PENALTY = 26;     // 남이 맡은 문을 나까지 밀 이유는 없다
function claimPushPenalty() {
  return (typeof GAME !== 'undefined' && GAME.claimPushPenalty != null) ? GAME.claimPushPenalty : CLAIM_PUSH_PENALTY;
}

// 이 문턱 너머 방의 위험 기록이 **몇 초 묵었나**. 없으면 Infinity.
//   수준(level)만으로는 부족하다. 실측(954표본): 그 방에 적이 실제로 있을 확률이
//     0~2초 97% · 2~5초 80% · 5~10초 66% · 10~20초 44% · 20초+ **28%**
//   TTL 25초짜리 기록을 그대로 쓰면 28%짜리로 수류탄을 쓴다.
function beyondRoomDangerAge(unit, th) {
  if (!unit || !th || th.ax == null || typeof roomAt !== 'function') return Infinity;
  const mem = unit.aiMemory;
  if (!mem || !(mem.roomDangers instanceof Map)) return Infinity;
  const r = roomAt(th.ax, th.ay);
  if (!r) return Infinity;
  const rd = mem.roomDangers.get(r.id);
  if (!rd) return Infinity;
  return Math.max(0, (GAME.gameTime || 0) - rd.lastAt);
}

// 이 문턱 너머 방을 얼마나 뜨겁다고 믿는가 (0이면 모르거나 조용하다)
function beyondRoomDanger(unit, th) {
  if (!unit || !th || th.ax == null || typeof roomAt !== 'function') return 0;
  const mem = unit.aiMemory;
  if (!mem || !(mem.roomDangers instanceof Map)) return 0;
  const r = roomAt(th.ax, th.ay);
  if (!r) return 0;
  const rd = mem.roomDangers.get(r.id);
  if (!rd) return 0;
  const fade = 1 - Math.max(0, (GAME.gameTime || 0) - rd.lastAt) / DANGER_TTL.enemy;
  return fade > 0 ? rd.level * fade : 0;
}

// =============================================================
// 방어자는 둘러본다 — 할 일 없는 시간을 지형 학습으로 바꾼다
// =============================================================
//   `holdAngle`의 `idle`은 적 시간의 13%다. 총성도 위협 위치도 없는 시간인데,
//   측정해 보니 그 유닛들은 **자기 방을 다 본 게 아니었다** — 시야 닫힘 0%,
//   한 번도 안 움직임 60%, 그리고 **56%가 아는 문턱이 0개**다.
//
//   원인은 기하다. `viewArc`는 180°이고 `senseFor`는 `unit.facing` 중심 부채꼴만 훑는다.
//   한 번도 안 돌아본 방어자는 등 뒤 벽을 영원히 모르고, 그 벽의 문턱도 모른다.
//   그래서 `guardEntry`가 경계할 대상을 못 찾고 `holdAngle`로 떨어진다.
//
//   고칠 것은 13%가 아니라 그 위다 — `guardEntry`는 이미 적 시간의 32%인데
//   **입력이 굶고 있다.** 둘러보게 하면 그 32%의 대상이 좋아진다.
//
//   어디를 보나: `S.sector.openings`(프론티어)는 **아직 시선이 빠져나가는 방향**,
//   즉 "안 본 쪽"이다. 잘 알수록 0으로 수렴하고 그게 `sightClosed`다 —
//   종료 조건이 공짜로 있다. 다 봤으면 아는 문턱을 지킨다.
const USE_IDLE_SCAN = true;
function isIdleScanOn() {
  if (typeof GAME !== 'undefined' && GAME.idleScanOn != null) return !!GAME.idleScanOn;
  return USE_IDLE_SCAN;
}
const IDLESCAN_DWELL   = 1.2;    // 초 — 한 방향에 머무는 시간. 스캔 간격 0.4초보다 길어야 실제로 배운다
const IDLESCAN_ARRIVE  = 0.25;   // rad — 이 안에 들어오면 도착
function pickIdleScanAngle(unit) {
  if (typeof SpatialPerception === 'undefined' || !SpatialPerception.ensureSpatial) return null;
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const st = unit._idleScan || (unit._idleScan = { ang: null, kind: null, arrivedAt: null });
  // 아직 도는 중이거나 도착해서 머무는 중이면 그대로 둔다 — **머무는 동안 배운다.**
  if (st.ang != null) {
    if (Math.abs(angleDelta(st.ang, unit.facing || 0)) > IDLESCAN_ARRIVE) { st.arrivedAt = null; return st; }
    if (st.arrivedAt == null) st.arrivedAt = now;
    if (now - st.arrivedAt < IDLESCAN_DWELL) return st;
  }
  const S = SpatialPerception.ensureSpatial(unit);
  const fov = (typeof getEffectiveViewArc === 'function') ? getEffectiveViewArc(unit) : Math.PI;
  let best = null, bestScore = -Infinity;
  for (const op of (S && S.sector && S.sector.openings) || []) {
    if (op.ix == null) continue;
    const a = Math.atan2(op.iy - unit.y, op.ix - unit.x);
    const off = Math.abs(angleDelta(a, unit.facing || 0));
    // 시야 **밖**부터 본다(거기가 안 본 쪽이다). 그중에서는 가까운 쪽부터 — 훑듯이 돌게.
    const score = (off > fov / 2 ? 100 : 0) - off * 10;
    if (score > bestScore) { bestScore = score; best = { ang: a, kind: 'scanRoom' }; }
  }
  // 다 봤으면 아는 문턱을 지킨다 — 이게 방어자가 원래 해야 할 일이다.
  if (!best && SpatialPerception.thresholdsOf) {
    let nd = Infinity;
    for (const t of SpatialPerception.thresholdsOf(unit) || []) {
      if (t.ix == null) continue;
      const d = Math.hypot(t.ix - unit.x, t.iy - unit.y);
      if (d < nd) { nd = d; best = { ang: Math.atan2(t.iy - unit.y, t.ix - unit.x), kind: 'watchThreshold' }; }
    }
  }
  if (!best) return null;
  st.ang = best.ang; st.kind = best.kind; st.arrivedAt = null;
  return st;
}

// 두 행동이 쓸 문턱을 고른다 — buildAIContext에서 1회.
function prepBeliefRoomContext(unit, ctx) {
  ctx._guardThreshold = null; ctx._clearThreshold = null;
  ctx._clearNoiseDriven = false; ctx._guardNoiseDriven = false;
  ctx._guardDanger = 0; ctx._clearDanger = 0;
  if (!beliefRoomsActiveFor(unit)) return;
  const list = SpatialPerception.thresholdsOf(unit);
  if (!list.length) return;
  // 소리가 어느 문으로 들어왔나 — 그 문이 곧 경계 대상이다
  let noiseTh = null;
  if (ctx.lastHeardNoise) {
    const r = SpatialPerception.thresholdForNoise(unit, ctx.lastHeardNoise.x, ctx.lastHeardNoise.y);
    if (r && !r.sameRoom && r.threshold) noiseTh = r.threshold;
  }
  // 경계할 문: 소리가 온 문 우선, 없으면 가장 가까운 문
  ctx._guardNoiseDriven = !!noiseTh;
  const _near = (t) => -Math.hypot(t.ix - unit.x, t.iy - unit.y);
  const _g = preferUnclaimed(unit, list, _near);
  ctx._guardThreshold = noiseTh || _g.target;
  ctx._guardDanger = beyondRoomDanger(unit, ctx._guardThreshold);
  // 클리어할 문: 아직 안 넘어갔고 너머도 못 본 문. 소리가 온 문이 그런 문이면 그쪽부터.
  const unexplored = list.filter(t => t.state !== 'crossed' && t.state !== 'observedBeyond');
  if (!unexplored.length) return;
  if (noiseTh && unexplored.indexOf(noiseTh) >= 0) { ctx._clearThreshold = noiseTh; ctx._clearNoiseDriven = true; }
  else { const _c = preferUnclaimed(unit, unexplored, _near); ctx._clearThreshold = _c.target; ctx._clearClaimed = _c.claimed; }
  ctx._clearDanger = beyondRoomDanger(unit, ctx._clearThreshold);
}

// =============================================================
// 동료 엄호 — "각 잡기"에 뭉뚱그려져 있던 것
// =============================================================
//   선점을 넣자 `holdAngle`이 58% → 71%로 올랐다. 그 시간을 분해해 보니(표본 2,747):
//     아군 — 총성 듣고 대기 46% · **동료가 미는 중이라 비켜섬 33%** · 방향 경계 18%
//     적   — 총성 듣고 대기 82% · 방향 경계 11%
//   아군의 33%가 선점이 만든 시간이다. 그런데 그때 하는 일이 "제자리에서 각 잡기"뿐이라
//   **미는 동료가 향하는 곳을 아무도 안 보고 있었다.** 그게 엄호다.
//
//   `holdAngle`과의 차이는 **겨누는 대상**이다. holdAngle은 위협 방향을 보고,
//   이건 **동료가 맡은 문**을 본다.
const USE_SUPPORT = true;
function isSupportOn() {
  if (typeof GAME !== 'undefined' && GAME.supportOn != null) return !!GAME.supportOn;
  return USE_SUPPORT;
}
const SUPPORT_RANGE_M = 12.0;
const SUPPORT_PUSH_ACTIONS = ['clearUnknownRoom', 'fragThenEnter', 'peekAndAssess', 'screenThenCross'];
// 누구를 엄호하나 — 근처에서 밀고 있고 맡은 대상이 있는 동료.
//   roster는 테스트용 주입구다(선점과 같은 이유 — UNITS는 재바인딩되지 않는다).
function prepSupportContext(unit, ctx, roster) {
  ctx._supportMate = null; ctx._supportAim = null; ctx._supportLOS = false;
  if (!isSupportOn() || !unit) return;
  const list = roster || ((typeof UNITS !== 'undefined' && Array.isArray(UNITS)) ? UNITS : (GAME.units || []));
  const maxPx = SUPPORT_RANGE_M * PX_PER_M_FALLBACK;
  let best = null, bestD = Infinity;
  for (const m of list) {
    if (m === unit || !m.alive || m.isDowned || m.team !== unit.team) continue;
    if (!m._claim) continue;                                   // 무엇을 맡았는지 모르면 엄호할 대상도 없다
    const t = m.aiAction && m.aiAction.type;
    if (SUPPORT_PUSH_ACTIONS.indexOf(t) < 0) continue;
    const d = Math.hypot(m.x - unit.x, m.y - unit.y);
    if (d > maxPx || d >= bestD) continue;
    bestD = d; best = m;
  }
  if (!best) return;
  ctx._supportMate = best;
  ctx._supportAim = { x: best._claim.x, y: best._claim.y };
  // 그쪽이 실제로 보이나 — 안 보이면 엄호가 아니라 그냥 벽을 보는 것이다
  ctx._supportLOS = (typeof isLOSBlockedForBlast === 'function')
    ? !isLOSBlockedForBlast(unit.x, unit.y, ctx._supportAim.x, ctx._supportAim.y) : true;
}
function scoreCoverMate(ctx) {
  if (!ctx._supportMate) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;         // 보이는 적이 있으면 쏘는 게 엄호다
  let s = 22;
  if (ctx._supportLOS)     s += 14;                // 실제로 그 문이 보인다
  if (ctx._clearClaimed || ctx._fragClaimed || ctx._peekClaimed) s += 12;   // 내가 비켜선 그 문이다
  if (ctx.inCover)         s += 8;
  if (ctx.mem && ctx.mem.lastHeardGunshot) s += 4;
  if (ctx.severeWound)     s -= 24;
  if (ctx.suppression > 40) s -= 20;
  if (ctx.recentlyHit)     s -= 14;
  if (ctx.grenadeDanger)   s -= 30;
  if (ctx.ammoEmpty)       s -= 20;
  return s;
}

function scoreHoldAngle(ctx) {
  const u = ctx.unit;
  let s = 18;
  if (ctx.preferredWatchAngle != null && !ctx._watchFromIdleScan) s += 8;   // 둘러보기가 채운 각은 이유가 아니다
  if (ctx.inCover)               s += 12;
  // 적이 cover 뒤 + 본인 노출 안 됨 → holdAngle 매우 유리 (각 잡고 대기)
  if (ctx.enemyBehindFullCover && !ctx.exposedToThreat) s += 25;
  else if (ctx.enemyBehindPartialCover && !ctx.exposedToThreat) s += 12;
  if (!ctx.ammoEmpty)            s += 5;
  // 총성 들었는데 적 안 보임 → holdAngle 우선
  if (ctx.mem && ctx.mem.lastHeardGunshot && ctx.visibleEnemyCount === 0) {
    s += 20;
  }
  if (ctx.visibleEnemyCount > 0) {
    // 단 적이 fullCover 뒤라 무력하면 holdAngle 유지가 더 좋을 수도 있음
    if (ctx.enemyBehindFullCover) s -= 10;   // 약하게만 감소
    else s -= 30;
  }
  if (ctx.exposedToEnemy)        s -= 12;
  if (ctx.grenadeDanger)         s -= 25;
  // 본인이 fullCover 안인데 사격 불가 → reposition이 더 좋을 수도
  if (ctx.inCover && !ctx.canReturnFire && ctx.visibleEnemyCount > 0) s -= 18;
  // 너무 오래
  if (u.aiAction && u.aiAction.type === 'holdAngle') {
    const dur = (GAME.gameTime || 0) - u.aiAction.startedAt;
    if (dur > 6.0) s -= Math.min(20, (dur - 6.0) * 3);
  }
  return s;
}

function scoreRepositionToCorner(ctx) {
  const u = ctx.unit;
  const mem = ctx.mem;
  if (!mem || !mem.knownCorners || mem.knownCorners.length === 0) return 0;
  // 모든 후보 코너 평가 — 단순 가까움이 아니라 타입 + 위험구역 + 사거리
  let bestC = null, bestS = -Infinity;
  for (const c of mem.knownCorners) {
    if (c.confidence < 0.3) continue;
    const d = Math.hypot(c.x - u.x, c.y - u.y);
    if (d < 30 || d > 300) continue;
    let s = 20 - d * 0.04;
    // 코너 타입 분류 (8-dir local 기반)
    const ct = (typeof classifyCorner === 'function') ? classifyCorner(c, c.x, c.y) : 'unknownCorner';
    if (ct === 'tacticalCorner')       s += 30;
    else if (ct === 'coverCorner')     s += 20;
    else if (ct === 'unknownCorner')   s += 5;
    else if (ct === 'roomCorner')      s -= 25;
    else if (ct === 'deadEndCorner')   s -= 60;
    // === area-aware — 코너의 area type ===
    if (typeof getAreaInfo === 'function') {
      const ca = getAreaInfo(c.x, c.y);
      if (ca.areaType === 'doorway')         s += 20;   // 입구 근처 = 전술적
      else if (ca.areaType === 'corridor')   s += 10;
      else if (ca.areaType === 'roomInterior') s -= 20;
      else if (ca.areaType === 'deadEnd')    s -= 40;
    }
    // 위험 입구 너머
    if (typeof isAcrossEntrance === 'function' && isAcrossEntrance(u, c.x, c.y)) s -= 50;
    // gunshot danger zone 안 큰 감점
    if (typeof isInGunshotDangerZone === 'function' && isInGunshotDangerZone(u, c.x, c.y)) {
      s -= 60;
    }
    if (mem.lastHeardGunshot && isLikelySameRoom(c.x, c.y, mem.lastHeardGunshot.x, mem.lastHeardGunshot.y)) {
      s -= 40;
    }
    // 코너가 위협보다 가까워지면 감점
    if (ctx.threatPos) {
      const curD = Math.hypot(u.x - ctx.threatPos.x, u.y - ctx.threatPos.y);
      const cD = Math.hypot(c.x - ctx.threatPos.x, c.y - ctx.threatPos.y);
      if (cD < curD * 0.7) s -= 25;
    }
    c._tacticalScore = s;
    c._cornerType = ct;
    if (s > bestS) { bestS = s; bestC = c; }
  }
  if (!bestC) return 0;
  if (bestS < 0) return 0;   // 음수면 의미 없음
  let s = bestS;
  if (ctx.exposedToEnemy)        s += 12;
  if (ctx.lastHeardNoise && !ctx.visibleEnemy) s += 6;
  if (ctx.visibleEnemyCount > 0) s -= 20;
  if (ctx.grenadeDanger)         s -= 25;
  // 본인이 fullCover 안인데 사격 불가 + 적 보임 → reposition 강한 가산
  if (ctx.inCover && !ctx.canReturnFire && ctx.visibleEnemyCount > 0) s += 25;
  // 적이 cover 뒤 + 본인 노출 → 우회 reposition 가산
  if (ctx.enemyBehindCover && ctx.exposedToThreat) s += 15;
  ctx._bestCorner = bestC;
  ctx._bestCornerType = bestC._cornerType;
  return s;
}

function scoreReassess(ctx) { return 0; }   // reassess는 후보가 아니라 trigger

// =============================================================
// 피킹 — 의도적 관측
// =============================================================
//   지금까지 믿음은 전부 "돌아다니다 우연히 본 것"의 부산물이었다. 피킹은 모르는 걸 알기 위해
//   **위험을 감수하고 정보를 얻으러 가는** 첫 행동이다. 그래서 값을 하는지는 숫자로 답해야 한다:
//   피킹 1회당 새로 알게 된 표면·문턱 수 vs 피킹 중 피격률(§README).
const USE_PEEK = true;
const PEEK_MAX_DIST_M = 5.0;   // 이보다 멀면 한 발 나가 봐야 각이 안 열린다
const PEEK_PROBE_M    = 4.0;   // "저 너머가 보이나"를 묻는 깊이 — 문턱 코앞이 아니라 방 안쪽
// 문턱 너머 depthM 지점 — 관측자 반대쪽이 '너머'다 (문턱의 ax/ay와 같은 규칙, 깊이만 다르다)
function _peekProbe(t, unit, depthM) {
  const step = depthM * PX_PER_M_FALLBACK;
  const sx = t.ix + t.nx * step, sy = t.iy + t.ny * step;
  const bx = t.ix - t.nx * step, by = t.iy - t.ny * step;
  const away = Math.hypot(sx - unit.x, sy - unit.y) > Math.hypot(bx - unit.x, by - unit.y);
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  const p = away ? { x: sx, y: sy } : { x: bx, y: by };
  if (!M) return p;
  const r = UNIT_RADIUS + 3;
  return { x: Math.max(r, Math.min(M.w - r, p.x)), y: Math.max(r, Math.min(M.h - r, p.y)) };
}
function isPeekOn() {
  if (typeof GAME !== 'undefined' && GAME.peekOn != null) return !!GAME.peekOn;
  return USE_PEEK;
}
function peekActiveFor(unit) {
  return !!(isPeekOn() && unit
            && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
            && typeof SpatialPerception !== 'undefined');
}

// 무엇을 힐끗 볼 것인가 — buildAIContext에서 1회.
//   대상은 "넘어가 보지 않았고, 지금 그 너머가 안 보이는" 문턱이다. 이미 보이면 볼 이유가 없다.
function prepPeekContext(unit, ctx) {
  ctx._peekTarget = null;
  if (!peekActiveFor(unit)) return;
  if (unit.pendingPeek) return;                                   // 이미 하는 중
  const now = GAME.gameTime || 0;
  if (unit._peekCooldownUntil != null && now < unit._peekCooldownUntil) return;
  const list = SpatialPerception.thresholdsOf(unit) || [];
  if (!list.length) return;
  const maxPx = PEEK_MAX_DIST_M * PX_PER_M_FALLBACK;
  const cands = [];
  for (const t of list) {
    if (t.state === 'crossed') continue;
    if (t.ax == null) continue;
    const d = Math.hypot(t.ix - unit.x, t.iy - unit.y);
    if (d > maxPx) continue;
    // 문턱 너머 **깊숙한 점**으로 판정한다. t.ax/ay는 문턱에서 1.5m밖에 안 나가서
    //   몇 발 뒤에서도 보이는 경우가 많고, 그걸 기준으로 삼으니 이득 0인 피킹이 27% 나왔다(실측).
    const probe = _peekProbe(t, unit, PEEK_PROBE_M);
    if (typeof isLOSBlockedForBlast === 'function' && !isLOSBlockedForBlast(unit.x, unit.y, probe.x, probe.y)) continue;
    t.__peekProbe = probe;
    cands.push(t);
  }
  const _p = preferUnclaimed(unit, cands, (t) => -Math.hypot(t.ix - unit.x, t.iy - unit.y));
  const best = _p.target;
  if (!best) return;
  ctx._peekClaimed = _p.claimed;
  const bestD = Math.hypot(best.ix - unit.x, best.iy - unit.y);
  const bestProbe = best.__peekProbe;
  // 노출 지점 — **문턱 앞 내 쪽**이다. 문설주에 가려 있는 한 각은 안 열리므로,
  //   개구부 정면에 서야 방이 보인다("파이 자르기"). 처음엔 제자리에서 한 발만 내밀게 했는데
  //   레이 스캔이 이미 그 각을 다 보고 있어서 이득 0인 피킹이 36%였다(실측).
  const nSign = (Math.hypot(best.ix + best.nx - unit.x, best.iy + best.ny - unit.y)
               > Math.hypot(best.ix - best.nx - unit.x, best.iy - best.ny - unit.y)) ? -1 : 1;
  const stand = PEEK_STEP_M * PX_PER_M_FALLBACK;
  const exX = best.ix + best.nx * nSign * stand;
  const exY = best.iy + best.ny * nSign * stand;
  if (Math.hypot(exX - unit.x, exY - unit.y) < 6) return;          // 이미 그 자리에 서 있다
  ctx._peekTarget = {
    threshold: best,
    exX, exY,
    watchX: bestProbe.x, watchY: bestProbe.y,      // 문턱이 아니라 그 너머 방을 본다
    distM: bestD / PX_PER_M_FALLBACK,
    danger: (typeof beyondRoomDanger === 'function') ? beyondRoomDanger(unit, best) : 0,
    noiseDriven: !!(ctx._clearNoiseDriven && ctx._clearThreshold === best)
              || !!(ctx._guardNoiseDriven && ctx._guardThreshold === best),
  };
}

// =============================================================
// 프래그 후 진입 — 후보 선택
// =============================================================
//   팀 게이트가 측정에서 나왔다. "들어가야 하는데 그 너머가 뜨겁다"는 상황은
//   적 1,719표본 중 16회(0.9%), 아군 720표본 중 577회(80.1%)다. 밀고 들어가는 쪽의 문제다.
//   거리 상한은 계획이 접근 다리를 갖고 있으므로 투척 사거리(20m) 쪽에 맞춘다.
//   9m로 두었더니 문턱까지의 **중앙값이 10m**여서 대상의 대부분이 잘려 나갔다(실측 217/242).
const FRAG_MAX_DIST_M = 15.0;
function fragPlanActiveFor(unit) {
  return !!(isFragPlanOn() && unit && unit.team === 'friend'
            && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
            && typeof SpatialPerception !== 'undefined');
}
function prepFragContext(unit, ctx) {
  ctx._fragTarget = null;
  if (!fragPlanActiveFor(unit)) return;
  if (unit.pendingFrag || unit.throwState) return;
  if (unit._fragRetryUntil != null && (GAME.gameTime || 0) < unit._fragRetryUntil) return;
  const stunId = fragThrowableIdFor(unit, 'flash');
  const fragId = fragThrowableIdFor(unit, 'frag');
  if (!stunId && !fragId) return;                           // 던질 게 없다 (1인 1발)
  ctx._fragKind = stunId ? 'flash' : 'frag';
  const list = SpatialPerception.thresholdsOf(unit) || [];
  if (!list.length) return;
  const maxPx = FRAG_MAX_DIST_M * PX_PER_M_FALLBACK;
  const cands = [];
  for (const t of list) {
    if (t.state === 'crossed' || t.ax == null) continue;
    const d = Math.hypot(t.ix - unit.x, t.iy - unit.y);
    if (d > maxPx) continue;
    const roomId = (typeof roomAt === 'function') ? ((roomAt(t.ax, t.ay) || {}).id || null) : null;
    if (fragRoomOnCooldown(unit, roomId)) continue;          // 같은 방에 두 번 넣지 않는다
    const danger = (typeof beyondRoomDanger === 'function') ? beyondRoomDanger(unit, t) : 0;
    if (danger < FRAG_MIN_DANGER) continue;                  // 약한 근거로 수류탄을 쓰지 않는다 (0.5~3은 29%뿐)
    if (beyondRoomDangerAge(unit, t) > FRAG_PLAN_FRESH) continue;   // 이미 낡은 정보로 출발하지 않는다
    cands.push(t);
  }
  const _f = preferUnclaimed(unit, cands, (t) =>
    beyondRoomDanger(unit, t) - Math.hypot(t.ix - unit.x, t.iy - unit.y) / PX_PER_M_FALLBACK);
  const best = _f.target;
  if (!best) return;
  ctx._fragClaimed = _f.claimed;
  ctx._fragTarget = {
    threshold: best, kind: ctx._fragKind,
    danger: (typeof beyondRoomDanger === 'function') ? beyondRoomDanger(unit, best) : 0,
    distM: Math.hypot(best.ix - unit.x, best.iy - unit.y) / PX_PER_M_FALLBACK,
    noiseDriven: !!(ctx._clearNoiseDriven && ctx._clearThreshold === best),
  };
}
// =============================================================
// 연막 차폐 후 횡단 — 후보 선택
// =============================================================
//   프래그와 **조건이 다르다.** 프래그는 "그 너머가 뜨겁다"(danger ≥ 3)를 요구하지만,
//   연막은 **건너야 하는데 사선이 열려 있다**는 것만으로 충분하다. 사람을 때리는 게 아니라
//   보이는 걸 막는 것이라 근거가 약해도 손해가 작다 (탄약이 아니라 연막 1발).
//   그리고 접근 다리가 없으므로 사거리 상한이 투척 사거리 그대로다.
function prepScreenContext(unit, ctx) {
  ctx._screenTarget = null;
  if (!isSmokeOn() || !fragPlanActiveFor(unit)) return;   // 돌입 측 장비 — 프래그와 같은 팀 게이트
  if (unit.pendingFrag || unit.pendingPeek) return;
  if (!fragThrowableIdFor(unit, 'smoke')) return;
  const list = (typeof SpatialPerception !== 'undefined' && SpatialPerception.thresholdsOf)
             ? (SpatialPerception.thresholdsOf(unit) || []) : [];
  if (!list.length) return;
  const minPx = SCREEN_MIN_M * PX_PER_M_FALLBACK, maxPx = SCREEN_MAX_M * PX_PER_M_FALLBACK;
  const cands = [];
  for (const t of list) {
    if (t.state === 'crossed' || t.ax == null) continue;
    const d = Math.hypot(t.ix - unit.x, t.iy - unit.y);
    if (d < minPx || d > maxPx) continue;
    // 이미 가려져 있으면 또 던지지 않는다
    if (typeof sampleDustAtPoint === 'function'
        && sampleDustAtPoint(t.ix, t.iy).smokeDensity >= SCREEN_DENSITY_MIN) continue;
    cands.push(t);
  }
  const _s = preferUnclaimed(unit, cands, (t) =>
    ((typeof beyondRoomDanger === 'function') ? beyondRoomDanger(unit, t) : 0)
    - Math.hypot(t.ix - unit.x, t.iy - unit.y) / PX_PER_M_FALLBACK);
  const best = _s.target;
  if (!best) return;
  ctx._screenClaimed = _s.claimed;
  ctx._screenTarget = {
    threshold: best,
    danger: (typeof beyondRoomDanger === 'function') ? beyondRoomDanger(unit, best) : 0,
    distM: Math.hypot(best.ix - unit.x, best.iy - unit.y) / PX_PER_M_FALLBACK,
  };
}
// =============================================================
// 목표를 향해 전진 — 공격 측에 없던 추진력
// =============================================================
//   아군 행동 배분에 holdAngle·engageEnemy·coverMate·seekCover·repositionToCorner는 있어도
//   **전진하는 행동이 하나도 없었다.** clearUnknownRoom은 적 전용이고 fragThenEnter·screenThenCross는
//   위험 근거가 있을 때만 뜬다. 그래서 아군이 어느 방으로 흘러가느냐가 사실상 무작위였다.
//   점수는 낮게 둔다 — 조용할 때만 이기고, 적이 보이거나 다치면 진다.
//   **기본값 OFF.** 미리 못 박은 기준(노출·생존 변동계수 하락)에 양쪽 다 실패했다:
//   35초에서 노출 CV 0.29→0.47, 70초에서 0.46. 생존도 0.25→0.19→0.29로 안 내려간다.
//   무엇보다 **목표 도달이 0/12, 0/10**이다 — 전진은 79·94회 채택되는데 아무도 금고실에 못 간다.
//   실행 시간 탓도 아니었다(70초로 늘려도 0). 오히려 아군이 더 죽는다(생존 3.4→2.7, 피해 70→143).
//   순진한 전진은 **도착하지 못하고 죽는다.** 추진력을 주려면 걷게 하는 것으로 부족하고
//   도약 전진·엄호 아래 이동이 실제로 작동해야 한다. 코드와 테스트는 남긴다(깔때기 비용과 같은 처리).
const USE_OBJECTIVE = false;
function isObjectiveOn() {
  if (typeof GAME !== 'undefined' && GAME.objectiveOn != null) return !!GAME.objectiveOn;
  return USE_OBJECTIVE;
}
const OBJECTIVE_ARRIVE_M = 3.0;
function objectiveRoomFor(unit) {
  if (!isObjectiveOn() || !unit || unit.team !== 'friend') return null;
  if (typeof MAP_DATA === 'undefined' || !MAP_DATA.objectiveRoomId || !Array.isArray(MAP_DATA.rooms)) return null;
  return MAP_DATA.rooms.find(r => r.id === MAP_DATA.objectiveRoomId) || null;
}
function prepObjectiveContext(unit, ctx) {
  ctx._objective = null;
  const room = objectiveRoomFor(unit);
  if (!room) return;
  const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
  const d = Math.hypot(cx - unit.x, cy - unit.y);
  if (typeof roomAt === 'function') {
    const here = roomAt(unit.x, unit.y);
    if (here && here.id === room.id) return;      // 이미 도착했다 — 밀 곳이 없다
  }
  if (d <= OBJECTIVE_ARRIVE_M * PX_PER_M_FALLBACK) return;
  ctx._objective = { room, x: cx, y: cy, distM: d / PX_PER_M_FALLBACK };
}
function scoreAdvanceToObjective(ctx) {
  const o = ctx._objective;
  if (!o) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;        // 눈앞의 적이 먼저다
  let s = 26;
  if (!ctx.recentlyHit)       s += 8;
  if (ctx.suppression < 20)   s += 6;
  if (ctx.severeWound)        s -= 30;
  if (ctx.grenadeDanger)      s -= 40;
  if (ctx.ammoEmpty)          s -= 20;
  if (ctx.exposedToThreat)    s -= 10;
  return s;
}

function scoreScreenThenCross(ctx) {
  const s0 = ctx._screenTarget;
  if (!s0) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;      // 보이면 쏘는 게 먼저다
  let s = 18;
  if (s0.danger > 0.5)        s += 14;          // 뜨거울수록 가리고 건널 값이 크다
  if (s0.danger > 2.0)        s += 8;
  if (ctx.mem && ctx.mem.lastHeardGunshot) s += 10;   // 총성 = 사선이 살아 있다
  if (ctx.exposedToThreat)    s += 10;
  if (s0.distM < 6)           s += 4;
  if (ctx.severeWound)        s -= 20;
  if (ctx.suppression > 40)   s -= 18;
  if (ctx.grenadeDanger)      s -= 30;
  if (ctx._screenClaimed)     s -= claimPushPenalty();
  return s;
}

function scoreFragThenEnter(ctx) {
  const f = ctx._fragTarget;
  if (!f) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;      // 보이는 적은 쏘는 게 먼저다
  let s = 20;
  if (f.danger > 1.0)         s += 20;          // 확실히 뜨겁다
  if (f.noiseDriven)          s += 12;
  if (ctx.firepowerBalance > 0.5) s += 8;
  if (f.distM < 4)            s += 6;
  if (ctx.severeWound)        s -= 30;
  if (ctx.suppression > 40)   s -= 25;
  if (ctx.recentlyHit)        s -= 18;
  if (ctx.grenadeDanger)      s -= 40;          // 이미 수류탄이 날아다니면 하나 더 넣지 않는다
  if (ctx.ammoEmpty)          s -= 10;
  if (ctx._fragClaimed)       s -= claimPushPenalty();
  return s;
}

function scorePeekAndAssess(ctx) {
  const p = ctx._peekTarget;
  if (!p) return 0;
  if (ctx.visibleEnemyCount > 0) return 0;             // 보이는 적이 있으면 힐끗 볼 게 아니라 쏠 때다
  let s = 14;
  if (p.noiseDriven)          s += 22;                 // 저 문 너머에서 소리가 났다 — 확인한다
  if (p.danger > 0.5)         s += 18;                 // 뜨겁다고 믿는 방 — 들어가기 전에 본다
  if (ctx.inCover)            s += 10;                 // 피킹은 엄폐 행동이다
  if (p.distM < 2.5)          s += 8;                  // 가까울수록 한 발에 각이 크게 열린다
  if (ctx.mem && ctx.mem.lastHeardGunshot) s += 6;
  if (ctx.severeWound)        s -= 30;
  if (ctx.suppression > 40)   s -= 24;                 // 제압당한 채 고개를 내밀지 않는다
  if (ctx.recentlyHit)        s -= 20;
  if (ctx.grenadeDanger)      s -= 30;
  if (ctx.exposedToEnemy)     s -= 12;
  if (ctx.ammoEmpty)          s -= 15;
  if (ctx._peekClaimed)       s -= claimPushPenalty();
  return s;
}

// =============================================================
// 성향 — "무엇을 하고 싶나"
// =============================================================
//   숙련도(`getUtilityProfile` / `getReactionProfile`)는 이미 있지만 그건 **"얼마나 잘 하나"**다.
//   elite는 점수 노이즈가 1이라 덜 흔들릴 뿐, recruit과 **원하는 게 같다.** 행동 간 선호는
//   전 유닛이 동일했다 — 그래서 4명이 늘 같은 걸 했다(실측: 의도 중복 41%, 퍼진 방 1.45개).
//
//   결정적인 차이는 **지속성**이다. 지금 다양성의 유일한 출처인 `scoreNoise`는 매 결정마다
//   다시 굴려서 평균으로 수렴한다. 성향은 유닛에 붙어 계속 같은 방향으로 민다.
//
//   두 축으로 잡는다. 네 단어(적극/소극/신중/무모)를 4분류로 두는 것보다 표현력이 넓다 —
//   "적극적이면서 신중함"(밀되 먼저 본다)과 "소극적이면서 무모함"이 둘 다 나온다.
const USE_TRAITS = true;
function isTraitsOn() {
  if (typeof GAME !== 'undefined' && GAME.traitsOn != null) return !!GAME.traitsOn;
  return USE_TRAITS;
}
//   값은 −1..+1. 계수는 상황 수정치(보통 ±20~30)보다 작고 점수 노이즈(regular 5)보다 크게 잡았다.
const TRAIT_BIAS = {
  engageEnemy:        { agg:  8, cau: -3 },
  clearUnknownRoom:   { agg: 12, cau: -4 },
  fragThenEnter:      { agg: 10, cau:  2 },   // 미는 행동이지만 준비를 갖춘 미는 행동이다
  investigateNoise:   { agg:  6, cau: -2 },
  peekAndAssess:      { agg:  2, cau: 10 },   // 신중함의 대표 행동
  repositionToCorner: { agg:  3, cau:  3 },
  reloadInCover:      { agg:  0, cau:  3 },
  guardEntry:         { agg: -7, cau:  5 },
  coverMate:          { agg: -2, cau:  7 },   // 남을 위해 자리를 지키는 건 신중함 쪽이다
  holdAngle:          { agg: -9, cau:  3 },
  goProne:            { agg: -6, cau:  6 },
  seekCover:          { agg: -8, cau:  9 },
  retreatFromThreat:  { agg: -10, cau: 6 },
};
//   원형(archetype)을 **번호 순서로 돌린다.** 완전 무작위로 굴렸더니 실행마다 팀 구성이
//   통째로 달라져서, 전투 변동 위에 구성 변동이 하나 더 얹혔다(같은 설정 두 번에
//   의도 중복 10% vs 33%). 팀은 매번 이 공간을 고르게 덮는 편이 측정에도 설계에도 낫다.
const TRAIT_ARCHETYPES = [
  { key: 'assault',  aggression:  0.80, caution: -0.30 },   // 돌격 — 밀어붙인다
  { key: 'methodic', aggression:  0.20, caution:  0.80 },   // 신중 — 밀되 먼저 본다
  { key: 'support',  aggression: -0.60, caution:  0.50 },   // 지원 — 자리를 지킨다
  { key: 'reckless', aggression:  0.50, caution: -0.80 },   // 무모 — 나가되 대책이 없다
];
//   **게임플레이 RNG를 소비하지 않는다.** 처음엔 Math.random()으로 흔들었는데,
//   시드 고정 스위트(runImpactWoundClosureSuite)가 유닛 생성 뒤의 난수 순서에 의존해서
//   탄도 판정 두 건이 깨졌다. 흔들림은 이름 해시에서 뽑는다 — 재현도 되고 순서도 안 민다.
function _traitHash(str, salt) {
  let h = 2166136261 ^ (salt || 0);
  const t = String(str || '');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;                        // 0..1
}
function rollTraits(opts) {
  const o = opts || {};
  const skill = (o.skill && o.skill.presetId) || o.skillId || 'regular';
  // 숙련도가 높을수록 기질이 덜 튄다 — 잘 훈련된 대원은 기질보다 교리를 따른다.
  const damp = skill === 'elite' ? 0.55 : skill === 'veteran' ? 0.75 : 1.0;
  const name = o.name || '';
  const m = /(\d+)\s*$/.exec(name);
  const idx = m ? (parseInt(m[1], 10) - 1) : Math.floor(_traitHash(name, 7) * TRAIT_ARCHETYPES.length);
  const a = TRAIT_ARCHETYPES[((idx % TRAIT_ARCHETYPES.length) + TRAIT_ARCHETYPES.length) % TRAIT_ARCHETYPES.length];
  const j = (salt) => (_traitHash(name, salt) * 2 - 1) * 0.15;   // 같은 원형끼리도 조금은 다르다
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return {
    key: a.key,
    aggression: +clamp((a.aggression + j(11)) * damp).toFixed(2),
    caution:    +clamp((a.caution    + j(29)) * damp).toFixed(2),
  };
}
function traitsOf(unit) {
  if (!isTraitsOn() || !unit || !unit.traits) return null;
  return unit.traits;
}
// 사람이 읽을 이름 — 디버그/AAR용. 판단에는 쓰지 않는다(축 값이 정본).
function traitLabel(t) {
  if (!t) return '—';
  const a = t.aggression, c = t.caution;
  const A = a > 0.33 ? '적극' : a < -0.33 ? '소극' : '보통';
  const C = c > 0.33 ? '신중' : c < -0.33 ? '무모' : '보통';
  return A + '·' + C;
}
function traitBiasFor(unit, actionType) {
  const t = traitsOf(unit);
  if (!t) return 0;
  const b = TRAIT_BIAS[actionType];
  if (!b) return 0;
  return b.agg * t.aggression + b.cau * t.caution;
}

// 모든 행동 점수 평가 + 노이즈 추가 (훈련도)
//   goProne은 노이즈 없음 — 점수 변동으로 인한 자세 플래핑 방지
function evaluateActions(unit, ctx) {
  const prof = getUtilityProfile(unit);
  const noise = prof.scoreNoise;
  const rand = () => (Math.random() - 0.5) * 2 * noise;
  //   raw는 노이즈 이전 점수다. **자격 판정은 raw로 한다** — 노이즈가 0점을 살짝 양수로
  //   밀면 자격 없는 후보가 성향 편향을 받아 되살아난다(자체테스트가 이 구멍을 잡았다).
  const mk = (type, raw, noisy) => ({ type, raw, score: raw + (noisy === false ? 0 : rand()) });
  const candidates = [
    mk('engageEnemy',        scoreEngageEnemy(ctx)),
    mk('seekCover',          scoreSeekCover(ctx)),
    mk('retreatFromThreat',  scoreRetreatFromThreat(ctx)),
    mk('goProne',            scoreGoProne(ctx), false),                    // 노이즈 X
    mk('reloadInCover',      scoreReloadInCover(ctx)),
    mk('investigateNoise',   scoreInvestigateNoise(ctx)),
    mk('holdAngle',          scoreHoldAngle(ctx)),
    mk('repositionToCorner', scoreRepositionToCorner(ctx)),
  ];
  // 믿음 방 행동 — 켜져 있고(적 AI) 아는 문턱이 있을 때만 후보에 오른다.
  //   꺼져 있으면 후보는 정확히 위 8개 그대로다.
  if (beliefRoomsActiveFor(unit)) {
    candidates.push(mk('guardEntry',       scoreGuardEntry(ctx)));
    candidates.push(mk('clearUnknownRoom', scoreClearUnknownRoom(ctx)));
  }
  // 피킹 — 볼 대상이 있을 때만. 양 팀 모두 쓴다(의도적 관측은 팀을 안 가린다).
  if (peekActiveFor(unit) && ctx._peekTarget) {
    candidates.push(mk('peekAndAssess', scorePeekAndAssess(ctx)));
  }
  // 프래그 후 진입 — 던질 문턱과 수류탄이 다 있을 때만.
  if (ctx._fragTarget) {
    candidates.push(mk('fragThenEnter', scoreFragThenEnter(ctx)));
  }
  // 연막 차폐 후 횡단 — 가릴 문턱과 연막이 다 있을 때만.
  if (ctx._screenTarget) {
    candidates.push(mk('screenThenCross', scoreScreenThenCross(ctx)));
  }
  // 목표를 향해 전진 — 아군에게만, 목표가 남아 있을 때만.
  if (ctx._objective) {
    candidates.push(mk('advanceToObjective', scoreAdvanceToObjective(ctx)));
  }
  // 동료 엄호 — 근처에서 미는 동료가 있을 때만. 양 팀 공통.
  if (ctx._supportMate) {
    candidates.push(mk('coverMate', scoreCoverMate(ctx)));
  }
  // 성향 편향 — 점수 함수 12개를 각각 고치지 않고 한 곳에서 얹는다.
  //   끄면 항이 0이라 오늘과 완전히 동일하다.
  //   **점수 0 이하는 건드리지 않는다.** 이 파일에서 0은 "지금 이 행동은 자격이 없다"는 뜻이고
  //   (`scoreInvestigateNoise`는 들은 소리가 없으면 0을 낸다), 편향으로 그걸 되살리면
  //   실행부가 없는 전제를 읽는다 — 실제로 그렇게 크래시했다.
  if (isTraitsOn()) for (const c of candidates) { if (c.raw > 0) c.score += traitBiasFor(unit, c.type); }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// 하던 일을 **동전던지기로** 바꾸지 않는다.
//
//   실측: 행동 평가의 36%에서 1·2위 점수차가 점수 노이즈 폭보다 작다 — 즉 그 결정은
//   상황이 아니라 난수가 골랐다. 그중 82%가 holdAngle / guardEntry / repositionToCorner,
//   다시 말해 **"제자리에서 지켜본다"의 세 변형끼리** 다투는 경우였다.
//   그리고 행동이 완료된 시점에는 전환 문턱 검사가 없어서(위 shouldSwitch 참조)
//   그 난수가 그대로 다음 행동이 된다.
//
//   그래서 직전에 하던 행동이 아직 후보에 있고 1위와의 차이가 노이즈 폭 안이면 그걸 유지한다.
//   점수가 의미 있게 벌어졌을 때만 갈아탄다. 자세 계층(posture HFSM)은 이 문제를 못 고친다 —
//   동전던지기의 86%가 같은 자세 안에서 일어나기 때문이다(실측).
const USE_UTILITY_STICKY = true;
const UTIL_STICKY_WINDOW = 2.0;   // 이 안에 끝난 직전 행동만 후보로 되살린다
function isUtilityStickyOn() {
  if (typeof GAME !== 'undefined' && GAME.utilityStickyOn != null) return !!GAME.utilityStickyOn;
  return USE_UTILITY_STICKY;
}
function _stickyPick(unit, best, candidates, prof, now) {
  if (!isUtilityStickyOn()) return best;
  const prev = unit._prevActionType;
  if (!prev || prev === best.type) return best;
  if ((now - (unit._prevActionEndedAt || -999)) > UTIL_STICKY_WINDOW) return best;
  const cand = candidates.find(c => c.type === prev);
  if (!cand) return best;
  const noise = (prof && prof.scoreNoise) || 0;
  if ((best.score - cand.score) >= noise) return best;   // 의미 있게 앞선다 — 갈아탄다
  GAME._utilitySticky = (GAME._utilitySticky || 0) + 1;
  if (unit.aiUtilityDebug) unit.aiUtilityDebug.reason += '+sticky(' + prev + ')';
  return cand;
}

// 행동 실행 — 명령 발급 (기존 시스템이 실행)
function executeUtilityAction(unit, action, ctx) {
  const now = GAME.gameTime || 0;
  // 다른 행동으로 넘어가면 진행 중이던 다단계 예약은 끝난 것이다.
  //   이동 명령을 안 내는 행동(goProne 등)으로 갈아타도 예약이 남아 계속 돌면 서로 싸운다.
  if (unit.pendingFrag && !actionOwnsFragPlan(action.type)) {
    clearPendingFrag(unit, 'switched_to_' + action.type);
  }
  if (unit.pendingPeek && action.type !== 'peekAndAssess' && action.type !== 'fragThenEnter') {
    clearPendingPeek(unit, 'switched_to_' + action.type);
  }
  // 선점은 행동이 바뀔 때마다 놓는다. 각 case가 자기 대상을 다시 잡는다.
  releaseClaim(unit);
  const reasonParts = [];
  if (ctx.exposedToEnemy) reasonParts.push('exposed');
  if (ctx.ammoEmpty)      reasonParts.push('ammo_empty');
  if (ctx.ammoLow)        reasonParts.push('ammo_low');
  if (ctx.severeWound)    reasonParts.push('wounded');
  if (ctx.firepowerBalance < -1.0) reasonParts.push('outgunned');
  if (ctx.firepowerBalance > 1.0)  reasonParts.push('superior');
  const reason = reasonParts.join('+') || ctx.threatSource || 'general';
  unit.aiAction = {
    type: action.type,
    startedAt: now,
    minDuration: 0.5,
    targetX: null, targetY: null,
    reason, score: action.score,
    afterAction: 'reassess',
  };
  unit.aiIntent = action.type;

  switch (action.type) {
    case 'engageEnemy':
      // 기존 AI가 자동 처리 — Utility는 별도 명령 발급 X
      unit.aiAction.minDuration = 0.4;
      break;
    case 'seekCover': {
      if (ctx.bestCover) {
        unit.aiAction.targetX = ctx.bestCover.spotX;
        unit.aiAction.targetY = ctx.bestCover.spotY;
        unit.aiAction.targetSlotKey = ctx.bestCover.slotKey;
        unit.aiAction.targetCoverId = ctx.bestCover.cover ? ctx.bestCover.cover.id : null;
        // [AI0-C1] gateway 경유 — source/actionType 명시(직접 movePath write 금지)
        const _cvRes = issueMoveOrder(unit, ctx.bestCover.spotX, ctx.bestCover.spotY,
          { source: 'utility', actionType: 'seekCover', reason: ctx.bestCover.slotId || null });
        // [AI0-C1 R1] 명령이 실제로 수락됐을 때만 slot 예약 증거를 확정한다.
        //   거부(플레이어 명령 활성 등) 시 phantom reservation을 남기지 않는다.
        if (_cvRes && _cvRes.accepted) {
          unit.aiAction.targetSlotId = ctx.bestCover.slotId || null;
          unit.aiAction.targetSurfaceId = ctx.bestCover.surfaceId || null;
          unit.aiAction.targetObservationRevision = (ctx.bestCover.observationRevision != null) ? ctx.bestCover.observationRevision : null;
        } else {
          unit.aiAction.targetSlotId = null;
          unit.aiAction.targetSurfaceId = null;
          unit.aiAction.targetObservationRevision = null;
        }
        unit.aiAction.minDuration = 1.2;
      }
      break;
    }
    case 'retreatFromThreat': {
      if (ctx.threatPos) {
        const dx = unit.x - ctx.threatPos.x, dy = unit.y - ctx.threatPos.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.01) {
          // 여러 거리/각도 시도 — 첫 valid 위치 사용
          let tx = null, ty = null;
          const baseDist = 6 * PX_PER_M_FALLBACK;
          const tryAngles = [0, 0.25, -0.25, 0.5, -0.5];   // 반대 방향에서 ±쏠림
          const tryDists = [baseDist, baseDist * 0.7, baseDist * 1.3];
          outer: for (const distMul of tryDists) {
            for (const angOff of tryAngles) {
              const baseAng = Math.atan2(dy, dx) + angOff;
              const cx = unit.x + Math.cos(baseAng) * distMul;
              const cy = unit.y + Math.sin(baseAng) * distMul;
              const v = validateMoveTarget(unit, cx, cy, {});
              if (v.valid) { tx = cx; ty = cy; break outer; }
            }
          }
          if (tx == null) break;   // 모두 invalid면 행동 포기
          if (typeof adjustTargetForCrowding === 'function') {
            const adj = adjustTargetForCrowding(unit, tx, ty);
            tx = adj.x; ty = adj.y;
          }
          unit.aiAction.targetX = tx; unit.aiAction.targetY = ty;
          if (typeof issueMoveOrder === 'function') {
            issueMoveOrder(unit, tx, ty);
            unit._aiCommandPath = unit.movePath;
          }
          unit.aiAction.minDuration = 1.0;
        }
      }
      break;
    }
    case 'goProne':
      if (typeof enterProne === 'function') {
        enterProne(unit, 'utility', 1.5 + Math.random() * 1.5);
      } else {
        unit.stance = 'prone';
        unit.forcedProneTimer = 1.5 + Math.random() * 1.5;
        issueAICommand(unit, { type: 'stance', source: 'utility', actionType: 'goProne', reason: 'utility_prone' });
        unit.movePath = [];   // 자세 전환 — executor 정지(경로 소유권 해제)
      }
      unit._aiCommandPath = null;
      unit.aiAction.minDuration = 1.5;
      break;
    case 'reloadInCover':
      if (typeof startReload === 'function') startReload(unit);
      else if (unit.reloadTimer == null) unit.reloadTimer = 2.0;   // fallback
      unit.aiAction.minDuration = 1.8;
      break;
    case 'investigateNoise': {
      const mem = ctx.mem;
      let tx = null, ty = null;
      // 점수 게이트가 보장해 주리라 믿고 전제를 읽지 않는다 — 실제로 여기서 크래시가 났다.
      if (!ctx.lastHeardNoise) {
        unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle';
        unit.aiAction.reason = 'noise_gone'; unit.aiAction.minDuration = 2.0; break;
      }
      const noiseAng = Math.atan2(ctx.lastHeardNoise.y - unit.y, ctx.lastHeardNoise.x - unit.x);
      const isGunshotSource = (ctx.lastHeardNoise.type === 'gunshot' || mem.lastHeardGunshot);
      // === gunshot이면 dangerousEntrance를 절대 통과하지 않음 ===
      const blockByEntrance = (px, py) => {
        if (!isGunshotSource) return false;
        if (typeof isAcrossEntrance === 'function' && isAcrossEntrance(unit, px, py)) return true;
        return false;
      };
      // 비슷한 방향 corner
      if (mem.knownCorners) {
        let best = null, bestD = Infinity;
        for (const c of mem.knownCorners) {
          if (c.confidence < 0.3) continue;
          const angToCorner = Math.atan2(c.y - unit.y, c.x - unit.x);
          if (Math.abs(angleDelta(angToCorner, noiseAng)) > Math.PI / 3) continue;
          if (isGunshotSource) {
            if (typeof isInGunshotDangerZone === 'function' && isInGunshotDangerZone(unit, c.x, c.y)) continue;
            const ct = (typeof classifyCorner === 'function') ? classifyCorner(c, c.x, c.y) : 'unknownCorner';
            if (ct === 'roomCorner' || ct === 'deadEndCorner') continue;
            if (blockByEntrance(c.x, c.y)) continue;
            // 코너 area type — roomInterior 거부
            if (typeof getAreaInfo === 'function') {
              const ca = getAreaInfo(c.x, c.y);
              if (ca.areaType === 'roomInterior' || ca.areaType === 'deadEnd') continue;
            }
          }
          const d = Math.hypot(c.x - unit.x, c.y - unit.y);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (best) { tx = best.x; ty = best.y; }
      }
      if (tx == null && mem.openSectors) {
        let best = null, bestDiff = Math.PI;
        for (const s of mem.openSectors) {
          const diff = Math.abs(angleDelta(s.angle, noiseAng));
          if (diff < bestDiff) { bestDiff = diff; best = s; }
        }
        if (best && bestDiff < Math.PI / 2.5) {
          const maxDistM = isGunshotSource ? 3.5 : 8;
          const dist = Math.min(best.distance * 0.6, maxDistM * PX_PER_M_FALLBACK);
          const candX = unit.x + Math.cos(best.angle) * dist;
          const candY = unit.y + Math.sin(best.angle) * dist;
          if (isGunshotSource && typeof isInGunshotDangerZone === 'function'
              && isInGunshotDangerZone(unit, candX, candY)) {
            // skip
          } else if (blockByEntrance(candX, candY)) {
            // skip
          } else {
            tx = candX; ty = candY;
          }
        }
      }
      if (tx == null && isGunshotSource) {
        unit.aiAction.type = 'holdAngle';
        unit.aiIntent = 'holdAngle';
        // grenade event watch timer 활성 중이면 그 방향 우선 (덮지 않음)
        if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) {
          unit.aiMemory.preferredWatchAngle = noiseAng;
          unit.homeFacing = noiseAng;
        }
        unit.aiAction.minDuration = 2.5;
        unit.aiAction.reason = 'gunshot_hold_position';
        break;
      }
      if (tx == null) {
        tx = unit.x + Math.cos(noiseAng) * (4 * PX_PER_M_FALLBACK);
        ty = unit.y + Math.sin(noiseAng) * (4 * PX_PER_M_FALLBACK);
      }
      // 최종 validate — 물리/위험 invalid면 holdAngle로 fallback
      const v = validateMoveTarget(unit, tx, ty, {});
      if (!v.valid) {
        unit.aiAction.type = 'holdAngle';
        unit.aiIntent = 'holdAngle';
        if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) {
          unit.aiMemory.preferredWatchAngle = noiseAng;
          unit.homeFacing = noiseAng;
        }
        unit.aiAction.minDuration = 2.5;
        unit.aiAction.reason = 'invalid_target_' + v.reason;
        break;
      }
      if (typeof adjustTargetForCrowding === 'function') {
        const adj = adjustTargetForCrowding(unit, tx, ty);
        tx = adj.x; ty = adj.y;
      }
      unit.aiAction.targetX = tx; unit.aiAction.targetY = ty;
      if (typeof issueMoveOrder === 'function') {
        issueMoveOrder(unit, tx, ty);
        unit._aiCommandPath = unit.movePath;
      }
      unit.aiAction.minDuration = 1.5;
      break;
    }
    case 'guardEntry': {
      // 제자리에서 문을 겨눈다 — 이동 명령을 내리지 않는다.
      //   preferredWatchAngle은 기존 조준 우선순위 사슬 6단계가 그대로 소비한다.
      const t = ctx._guardThreshold;
      if (t) {
        const ang = Math.atan2(t.iy - unit.y, t.ix - unit.x);
        if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) {
          unit.aiMemory.preferredWatchAngle = ang;
          unit.homeFacing = ang;
        }
        unit.aiAction.targetX = t.ix; unit.aiAction.targetY = t.iy;
        setClaim(unit, thresholdClaimKey(t));
        unit.aiAction.reason = (unit.aiAction.reason || '') + '_guard_' + (t.name || 'th');
        unit.movePath = [];              // 자리를 지킨다
        unit._aiCommandPath = null;
        GAME._guardEntryCount = (GAME._guardEntryCount || 0) + 1;
      }
      unit.aiAction.minDuration = 3.0;
      break;
    }
    case 'fragThenEnter': {
      const f = ctx._fragTarget;
      if (!f || !setPendingFrag(unit, f.threshold, { reason: f.noiseDriven ? 'noise' : 'hot_room', kind: f.kind })) {
        unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break;
      }
      setClaim(unit, thresholdClaimKey(f.threshold));
      unit.aiAction.reason = (unit.aiAction.reason || '') + '_frag_' + ((f.threshold && f.threshold.name) || 'th');
      unit.aiAction.minDuration = 2.0;
      GAME._fragCount = (GAME._fragCount || 0) + 1;
      break;
    }
    case 'advanceToObjective': {
      const o = ctx._objective;
      if (!o) { unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break; }
      const r = issueMoveOrder(unit, o.x, o.y, { source: 'utility', actionType: 'advanceToObjective' });
      if (!r || r.accepted === false) {
        unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break;
      }
      unit._aiCommandPath = unit.movePath;
      unit.aiAction.targetX = o.x; unit.aiAction.targetY = o.y;
      unit.aiAction.reason = (unit.aiAction.reason || '') + '_obj_' + o.room.id;
      unit.aiAction.minDuration = 2.0;
      GAME._objectiveCount = (GAME._objectiveCount || 0) + 1;
      break;
    }
    case 'screenThenCross': {
      // 접근 다리가 없다 — 지금 자리에서 바로 던진다. 그게 프래그와 다른 점 전부다.
      const sc = ctx._screenTarget;
      if (!sc || !setPendingScreen(unit, sc.threshold, { reason: 'screen' })) {
        unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break;
      }
      setClaim(unit, thresholdClaimKey(sc.threshold));
      unit.aiAction.reason = (unit.aiAction.reason || '') + '_screen_' + ((sc.threshold && sc.threshold.name) || 'th');
      unit.aiAction.minDuration = 2.0;
      GAME._screenCount = (GAME._screenCount || 0) + 1;
      break;
    }
    case 'coverMate': {
      // 동료가 맡은 **그 문**을 겨눈다. holdAngle은 위협 방향을 보지만 엄호는 대상이 다르다.
      const aim = ctx._supportAim;
      if (!aim) { unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break; }
      const ang = Math.atan2(aim.y - unit.y, aim.x - unit.x);
      if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) unit.aiMemory.preferredWatchAngle = ang;
      unit.homeFacing = ang;
      unit.aiAction.targetX = aim.x; unit.aiAction.targetY = aim.y;
      unit.aiAction.coverForId = ctx._supportMate ? ctx._supportMate.id : null;
      unit.aiAction.reason = (unit.aiAction.reason || '') + '_cover_' + ((ctx._supportMate && ctx._supportMate.name) || '?');
      unit.movePath = [];                       // 자리를 지킨다
      unit._aiCommandPath = null;
      unit.aiAction.minDuration = 2.5;
      GAME._coverMateCount = (GAME._coverMateCount || 0) + 1;
      break;
    }
    case 'peekAndAssess': {
      const p = ctx._peekTarget;
      if (!p || !setPendingPeek(unit, p.exX, p.exY,
                                { watchX: p.watchX, watchY: p.watchY,
                                  reason: p.noiseDriven ? 'noise' : (p.danger > 0.5 ? 'hot_room' : 'unknown') })) {
        unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break;
      }
      unit.aiAction.targetX = p.exX; unit.aiAction.targetY = p.exY;
      setClaim(unit, thresholdClaimKey(p.threshold));
      unit.aiAction.reason = (unit.aiAction.reason || '') + '_peek_' + ((p.threshold && p.threshold.name) || 'th');
      unit.aiAction.minDuration = 1.0;
      GAME._peekCount = (GAME._peekCount || 0) + 1;
      break;
    }
    case 'clearUnknownRoom': {
      const t = ctx._clearThreshold;
      if (!t) { unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle'; unit.aiAction.minDuration = 2.0; break; }
      // 문턱 앞으로 — 내 쪽 한 발 앞. 닫힌 문이면 기존 pendingDoor 자동 개방이 이어받는다.
      const dx = unit.x - t.ix, dy = unit.y - t.iy, len = Math.hypot(dx, dy) || 1;
      const stand = (typeof UNIT_RADIUS !== 'undefined' ? UNIT_RADIUS : 11) + 0.7 * PX_PER_M_FALLBACK;
      let tx = t.ix + (dx / len) * stand, ty = t.iy + (dy / len) * stand;
      const v = (typeof validateMoveTarget === 'function') ? validateMoveTarget(unit, tx, ty, {}) : { valid: true };
      if (!v.valid) { unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle';
                      unit.aiAction.reason = 'clear_invalid_' + v.reason; unit.aiAction.minDuration = 2.0; break; }
      if (typeof adjustTargetForCrowding === 'function') { const adj = adjustTargetForCrowding(unit, tx, ty); tx = adj.x; ty = adj.y; }
      unit.aiAction.targetX = tx; unit.aiAction.targetY = ty;
      if (typeof issueMoveOrder === 'function') {
        const r = issueMoveOrder(unit, tx, ty, { source: 'utility', actionType: 'clearUnknownRoom' });
        if (r && r.accepted === false) { unit.aiAction.type = 'holdAngle'; unit.aiIntent = 'holdAngle';
                                         unit.aiAction.minDuration = 2.0; break; }
        unit._aiCommandPath = unit.movePath;
      }
      setClaim(unit, thresholdClaimKey(t));
      unit.aiAction.reason = (unit.aiAction.reason || '') + '_clear_' + (t.name || 'th');
      unit.aiAction.minDuration = 2.0;
      GAME._clearRoomCount = (GAME._clearRoomCount || 0) + 1;
      break;
    }
    case 'holdAngle': {
      // 자세 결정 — prone 상태인데 실제 위험 없으면 exitProne 후 holdAngle
      if (unit.stance === 'prone' && unit._proneReason === 'utility' && !unit.stanceTransition) {
        const stayProne = (typeof shouldStayProne === 'function') ? shouldStayProne(unit, ctx) : false;
        if (!stayProne) {
          const now2 = GAME.gameTime || 0;
          if (unit.proneLockUntil == null || now2 >= unit.proneLockUntil) {
            if (typeof exitProne === 'function') exitProne(unit, 'holdAngle_getup');
          }
        }
      }
      // 총성 들렸으면 그 방향 우선, 없으면 일반 threat 방향
      let ang = null;
      if (ctx.mem && ctx.mem.lastHeardGunshot) {
        ang = Math.atan2(ctx.mem.lastHeardGunshot.y - unit.y, ctx.mem.lastHeardGunshot.x - unit.x);
      } else if (ctx.threatPos) {
        ang = Math.atan2(ctx.threatPos.y - unit.y, ctx.threatPos.x - unit.x);
      }
      if (ang != null) {
        if (unit.aiMemory) unit.aiMemory.preferredWatchAngle = ang;
        unit.homeFacing = ang;
      }
      // 볼 이유가 아무것도 없으면 **둘러본다.** 얼어 있는 것보다 배우는 게 낫다.
      //   각도만 써 주면 된다 — 본체 facing 사슬의 마지막 단계가 preferredWatchAngle을
      //   이미 소비하고, 감각기관은 그 facing을 따라간다.
      let scanKind = null;
      if (ang == null && isIdleScanOn() && unit.team === 'enemy') {
        const s = pickIdleScanAngle(unit);
        if (s && s.ang != null) {
          if (unit.aiMemory) unit.aiMemory.preferredWatchAngle = s.ang;
          unit.homeFacing = s.ang;
          unit._holdFacing = null;   // 마지막 도착 시선을 붙들고 있으면 못 돈다 — 그게 얼어붙은 나머지 절반이다
          scanKind = s.kind;
        }
      }
      // 이 시간이 무엇인지 남긴다. holdAngle 하나에 대기·경계·엄호·할 일 없음이 다 들어가 있어서
      //   "시간의 71%"가 무슨 뜻인지 지표로 읽히지 않았다. 판단에는 쓰지 않는다 — 기록만.
      unit.aiAction.holdKind = ctx.visibleEnemyCount > 0 ? 'enemyVisible'
        : (ctx._supportMate ? 'matePushing'
        : ((ctx.mem && ctx.mem.lastHeardGunshot) ? 'gunshotWait'
        : (ang != null ? 'watchingAngle' : (scanKind || 'idle'))));
      unit.aiAction.minDuration = 2.5;
      break;
    }
    case 'repositionToCorner': {
      const c = ctx._bestCorner;
      if (c) {
        const dx = unit.x - c.x, dy = unit.y - c.y;
        const len = Math.hypot(dx, dy) || 1;
        let tx = c.x + (dx / len) * 12;
        let ty = c.y + (dy / len) * 12;
        // 코너 뒤쪽으로 nudge — invalid면 더 멀리
        let v = validateMoveTarget(unit, tx, ty, {});
        if (!v.valid && v.physicalInvalid) {
          for (let i = 2; i <= 4; i++) {
            tx = c.x + (dx / len) * 12 * i;
            ty = c.y + (dy / len) * 12 * i;
            v = validateMoveTarget(unit, tx, ty, {});
            if (v.valid) break;
          }
        }
        if (!v.valid) break;   // 행동 포기
        if (typeof adjustTargetForCrowding === 'function') {
          const adj = adjustTargetForCrowding(unit, tx, ty);
          tx = adj.x; ty = adj.y;
        }
        unit.aiAction.targetX = tx; unit.aiAction.targetY = ty;
        if (typeof issueMoveOrder === 'function') {
          issueMoveOrder(unit, tx, ty);
          unit._aiCommandPath = unit.movePath;
        }
        unit.aiAction.minDuration = 1.5;
      }
      break;
    }
    case 'reassess':
      unit.aiUtilityNext = now;
      unit.aiAction.minDuration = 0.1;
      break;
  }
}

// 현재 행동이 완료/만료됐는지 체크
function isActionDone(unit, ctx) {
  if (!unit.aiAction) return true;
  const now = GAME.gameTime || 0;
  const dur = now - unit.aiAction.startedAt;
  if (dur < unit.aiAction.minDuration) return false;
  const a = unit.aiAction;
  switch (a.type) {
    case 'seekCover':
    case 'retreatFromThreat':
    case 'repositionToCorner':
    case 'investigateNoise':
      // 도착했나? 또는 movePath 비었나?
      if (!unit.movePath || unit.movePath.length === 0) return true;
      if (a.targetX != null && Math.hypot(unit.x - a.targetX, unit.y - a.targetY) < 18) return true;
      return false;
    case 'goProne':
      // prone 진입 자체가 끝나면 action 완료 → reassess
      //   - stance가 prone이 됐거나
      //   - stanceTransition.to === 'prone'으로 시작된 지 0.3초 지났거나
      //   - 1초 지나도록 진입 못했으면 (safety) 완료 처리
      if (unit.stance === 'prone') return true;
      if (unit.stanceTransition && unit.stanceTransition.to === 'prone' && dur > 0.3) return true;
      if (dur > 1.0) return true;
      return false;
    case 'reloadInCover':
      if (!unit.reloadTimer || unit.reloadTimer <= 0) return true;
      return false;
    case 'coverMate':
      return dur > 3.0;                 // 동료가 아직 미는지는 다음 평가에서 다시 본다
    case 'peekAndAssess':
      // 왕복이 끝나야 끝난다 — 그게 피킹의 계약이다. 중단은 quickActionInvalidation이 한다.
      return !unit.pendingPeek;
    case 'fragThenEnter':
      // 던지고 터지고 들어갈 때까지 하나의 의도다. 0.4초 재평가에 잘리면 안 되는 구간.
      return !unit.pendingFrag;
    case 'screenThenCross':
      return !unit.pendingFrag;
    case 'advanceToObjective':
      if (!unit.movePath || unit.movePath.length === 0) return true;
      return dur > 6.0;
    case 'guardEntry':
      return dur > 4.0;                 // holdAngle과 같은 리듬 — 주기적으로 재평가
    case 'clearUnknownRoom':
      if (!unit.movePath || unit.movePath.length === 0) return true;
      if (a.targetX != null && Math.hypot(unit.x - a.targetX, unit.y - a.targetY) < 18) return true;
      return false;
    case 'holdAngle':
      return dur > 4.0;
    case 'engageEnemy':
      if (ctx && ctx.visibleEnemyCount === 0) return true;
      return dur > 1.5;
    case 'reassess':
      return true;
  }
  return true;
}

// [AI-PERF Phase3] 경량 행동 만료 검사 — full buildAIContext를 만들지 않는다.
//   engageEnemy만 "visible 적 존재" 여부가 필요하고, 그건 canonical perception snapshot(캐시)에서 즉시 얻는다.
//   나머지 action은 unit 상태(movePath/위치/stance/timer)만으로 판정 — isActionDone과 의미 동일.
function isActionDoneLight(unit) {
  if (!unit.aiAction) return true;
  const now = GAME.gameTime || 0;
  const a = unit.aiAction;
  const dur = now - a.startedAt;
  if (dur < a.minDuration) return false;
  switch (a.type) {
    case 'seekCover':
    case 'retreatFromThreat':
    case 'repositionToCorner':
    case 'investigateNoise':
      if (!unit.movePath || unit.movePath.length === 0) return true;
      if (a.targetX != null && Math.hypot(unit.x - a.targetX, unit.y - a.targetY) < 18) return true;
      return false;
    case 'goProne':
      if (unit.stance === 'prone') return true;
      if (unit.stanceTransition && unit.stanceTransition.to === 'prone' && dur > 0.3) return true;
      if (dur > 1.0) return true;
      return false;
    case 'reloadInCover':
      if (!unit.reloadTimer || unit.reloadTimer <= 0) return true;
      return false;
    case 'coverMate':
      return dur > 3.0;
    case 'peekAndAssess':
      return !unit.pendingPeek;
    case 'fragThenEnter':
      return !unit.pendingFrag;
    case 'screenThenCross':
      return !unit.pendingFrag;
    case 'advanceToObjective':
      if (!unit.movePath || unit.movePath.length === 0) return true;
      return dur > 6.0;
    case 'guardEntry':
      return dur > 4.0;
    case 'clearUnknownRoom':
      if (!unit.movePath || unit.movePath.length === 0) return true;
      if (a.targetX != null && Math.hypot(unit.x - a.targetX, unit.y - a.targetY) < 18) return true;
      return false;
    case 'holdAngle':
      return dur > 4.0;
    case 'engageEnemy': {
      // visible 적 없으면 종료 — snapshot 캐시에서 즉시 (full context 불필요)
      const snap = getPerceptionSnapshot(unit);
      if (snap.visibleCount === 0) return true;
      return dur > 1.5;
    }
    case 'reassess':
      return true;
  }
  return true;
}

// 빠른 위험 체크 — 매 frame 호출 (full context 생성 X)
//   true 반환 시: 현재 aiAction이 명백히 위험/무효 → 즉시 reassess
// [0.38.2 Fix2] canonical 수류탄 위험 판정 — fast path·full context·cover invalidation이 동일 기준 공유.
//   기준: fuseTimer < 1.2초 && (유닛까지 거리 < 6m || 현재 행동 목표가 폭발 반경 4m 진입).
//   동일 tick 동일 조건에서 hasImmediateDanger===true ⇒ buildAIContext.grenadeDanger===true 보장.
function getGrenadeDangerForUnit(unit) {
  const s = _scanGrenadeDanger(unit, unit.aiAction);
  return s.near || s.target;
}
// 위 기준의 실제 구현 — quickActionInvalidation도 같은 것을 쓴다(규칙이 갈라지지 않게).
//   반환: { near, target } — 내가 폭발 반경 안인가 / 내 행동 목표가 폭발 반경 안인가
//   소유 인식이 켜지면 내가/아군이 던진 것은 **실제 위해 추정**으로만 위험이 된다.
//   적 수류탄 경로는 오늘과 완전히 동일하다.
function _scanGrenadeDanger(unit, a) {
  const out = { near: false, target: false };
  if (!Array.isArray(GAME.flyingThrowables) || GAME.flyingThrowables.length === 0) return out;
  const ownerAware = isGrenadeOwnerAwareOn();
  const dangerR = 6 * PX_PER_M_FALLBACK;
  for (const st of GAME.flyingThrowables) {
    if (st.fuseTimer == null || st.fuseTimer >= 1.2) continue;
    const gx = (st.curX != null) ? st.curX : st.targetX;
    const gy = (st.curY != null) ? st.curY : st.targetY;
    if (gx == null || gy == null) continue;
    let skipNear = false, skipTarget = false;
    if (ownerAware) {
      const th = grenadeThreatToUnit(unit, st);
      if (th && (th.mine || th.friendly)) {
        // 놀라지는 않는다 — 그러나 진짜로 날 죽일 수 있으면 그대로 도망친다
        skipNear = (th.harm < GRENADE_HARM_FLEE);
        // 내가 던진 것의 착탄점으로 가려는 건 의도다(던지고 진입). 아군 것은 여전히 막는다.
        skipTarget = th.mine;
      }
    }
    if (!skipNear && !out.near && Math.hypot(unit.x - gx, unit.y - gy) < dangerR) out.near = true;
    if (!skipTarget && !out.target && a && a.targetX != null
        && Math.hypot(a.targetX - gx, a.targetY - gy) < 4 * PX_PER_M_FALLBACK) out.target = true;
    if (out.near && out.target) break;
  }
  return out;
}
// [CLOSURE 목표A] 즉각 생존 위험 스캔 — aiAction과 독립. 현재 행동 유무와 관계없이 실행.
//   대상: 근접 grenade danger / 현재 위치가 grenade danger zone에 포함 / 폭발까지 긴급 회피 기준 이내.
//   경량(엄폐/시야/context 미생성) — 위험 없으면 즉시 false로 빠져 lightweight cadence를 깨지 않는다.
//   gameplay RNG 미소비. 안전 행동으로 이미 대피 중(goProne/seekCover)이면 재평가 불필요 → false.
function hasImmediateDanger(unit) {
  const a = unit.aiAction;
  // 이미 안전 행동으로 대피 중이면 재평가/초기화 불필요 (경계 구간 재평가 루프 방지).
  if (a && (a.type === 'goProne' || a.type === 'seekCover' || a.type === 'retreatFromThreat')) return false;
  return getGrenadeDangerForUnit(unit);   // [0.38.2 Fix2] canonical 기준 공유
}
function quickActionInvalidation(unit) {
  const a = unit.aiAction;
  if (!a) return false;
  const now = GAME.gameTime || 0;
  const dur = now - a.startedAt;

  // 1) 수류탄 임박 — 현재 행동이 prone/seekCover가 아니면 무효
  //    getGrenadeDangerForUnit과 같은 스캔을 쓴다. 규칙이 두 벌이면 소유 인식이 한쪽에만 걸린다.
  {
    const hit = _scanGrenadeDanger(unit, a);
    if (hit.target) return true;
    if (hit.near && a.type !== 'goProne' && a.type !== 'seekCover') return true;
  }

  // 2) 이동 행동인데 movePath 끊김 + 도착 멀음 (경로 막힘 / 외부에서 path 변경)
  const movingAction = (a.type === 'seekCover' || a.type === 'retreatFromThreat'
                     || a.type === 'investigateNoise' || a.type === 'repositionToCorner');
  if (movingAction && dur > 0.3 && a.targetX != null
      && (!unit.movePath || unit.movePath.length === 0)
      && Math.hypot(unit.x - a.targetX, unit.y - a.targetY) > 25) {
    return true;
  }

  // 3) 큰 피해 발생 — 행동 시작 후 피격이고 큰 데미지
  if ((unit._lastHitTime || -999) > a.startedAt
      && (unit._lastHitDamage || 0) > 22
      && a.type === 'holdAngle') {
    return true;
  }

  // 4) 강한 제압 — holdAngle/investigateNoise는 70+ 제압이면 무효
  if ((unit.suppression || 0) > 70
      && (a.type === 'holdAngle' || a.type === 'investigateNoise')) {
    return true;
  }

  // 5) holdAngle 방향 어긋남 — preferredWatchAngle과 lastSeenEnemy/threat 방향 차이 90°+
  if (a.type === 'holdAngle' && dur > 1.0) {
    const mem = unit.aiMemory;
    if (mem && mem.preferredWatchAngle != null) {
      let realThreatAng = null;
      if (mem.lastSeenEnemy && (now - mem.lastSeenEnemy.lastSeenTime) < 8) {
        realThreatAng = Math.atan2(mem.lastSeenEnemy.y - unit.y, mem.lastSeenEnemy.x - unit.x);
      } else if (unit.threatDirection != null && (now - unit.threatTime) < 4.0) {
        realThreatAng = unit.threatDirection;
      }
      if (realThreatAng != null) {
        const diff = Math.abs(angleDelta(mem.preferredWatchAngle, realThreatAng));
        if (diff > Math.PI / 2) return true;
      }
    }
  }

  // 6) 이동 행동 중 target이 새로 위험 area로 판정됨 (gunshot/dangerousEntrance가 행동 후 등록)
  if (movingAction && a.targetX != null && dur > 0.4 && typeof validateMoveTarget === 'function') {
    // 거의 도착(20px 이내)했고 위험만 아니면 유지
    const distLeft = Math.hypot(unit.x - a.targetX, unit.y - a.targetY);
    if (distLeft > 25) {
      const v = validateMoveTarget(unit, a.targetX, a.targetY, {});
      if (!v.valid && v.tacticalInvalid) {
        return true;   // 적 area / gunshot zone / dangerousEntrance 너머
      }
    }
  }

  return false;
}

// 메인 tick — 매 unit tick에서 호출
function tickUtilityAI(unit, dt) {
  if (shouldSkipUtility(unit)) return;
  const now = GAME.gameTime || 0;

  // === [CLOSURE 목표A] 즉각 생존 위험 — aiAction 존재 여부와 무관하게 매 tick 검사 ===
  //   근접 수류탄처럼 즉사 가능한 위험은 "현재 행동이 있을 때만" 검사되면 안 된다.
  //   aiAction===null 이어도 여기서 걸리면 aiUtilityNext를 앞당겨 즉시 재평가로 진입한다.
  //   위험이 없으면 아래 lightweight 경로가 그대로 유지된다(무행동 유닛이 매 tick full context를 만들지 않음).
  if (hasImmediateDanger(unit)) {
    if (unit.aiAction) { unit.aiAction = null; }
    unit.aiIntent = 'reassess';
    unit.aiUtilityNext = now;   // 대기 무시 — 아래 full 판단으로 진입
  }
  // === 빠른 위험 체크 (매 frame) — 현재 aiAction이 명백히 위험/무효면 즉시 reassess ===
  else if (unit.aiAction && quickActionInvalidation(unit)) {
    unit.aiAction = null;
    unit.aiIntent = 'reassess';
    unit.aiUtilityNext = now;   // 다음 if 블록 통과해서 본 판단으로 진입
  }

  if (now < (unit.aiUtilityNext || 0)) {
    // 판단 주기 미도달 — 단 현재 행동 만료 체크는 매번 (단, [AI-PERF Phase3] 가벼운 검사만).
    if (unit.aiAction) {
      // full buildAIContext 대신 lightweight 만료 검사 — engageEnemy만 visible count가 필요하고,
      //   그건 canonical perception snapshot(캐시)에서 즉시 얻는다. 나머지 action은 unit 상태만 사용.
      if (isActionDoneLight(unit)) {
        unit._prevActionType = unit.aiAction.type;      // 완료 직후 재선택 때 참고한다
        unit._prevActionEndedAt = now;
        unit.aiAction = null;
        unit.aiIntent = 'reassess';
        unit.aiUtilityNext = now;   // 즉시 재평가
      }
    }
    return;
  }
  const ctx = buildAIContext(unit);
  // === utility prone 자동 기상 체크 — shouldStayProne로 판단 ===
  if (unit.stance === 'prone' && unit._proneReason === 'utility'
      && !unit.stanceTransition) {
    // forcedProneTimer 만료 대기 X — shouldStayProne으로 통합 판단
    if (typeof shouldStayProne === 'function' && !shouldStayProne(unit, ctx)) {
      // lock 통과 시 일어남
      const now2 = GAME.gameTime || 0;
      if (unit.proneLockUntil == null || now2 >= unit.proneLockUntil) {
        if (typeof exitProne === 'function') {
          exitProne(unit, 'utility_safe_no_real_threat');
        }
      }
    }
  }
  const prof = getUtilityProfile(unit);
  // 현재 행동 완료 체크
  const curActionDone = isActionDone(unit, ctx);
  // 후보 평가
  const candidates = evaluateActions(unit, ctx);
  const best = candidates[0];
  const currentScore = unit.aiAction
    ? (candidates.find(c => c.type === unit.aiAction.type) || { score: 0 }).score
    : -999;

  // 디버그 저장
  unit.aiUtilityDebug = {
    top: candidates.slice(0, 5),
    picked: best.type,
    currentType: unit.aiAction ? unit.aiAction.type : null,
    currentScore,
    threat: ctx.threatSource,
    fpBalance: ctx.firepowerBalance,
    coverScore: ctx.bestCover ? ctx.bestCover.score.toFixed(0) : null,
    coverNudged: ctx.bestCover ? (ctx.bestCover.nudged || 0) : 0,
    targetAreaType: (unit.aiAction && unit.aiAction.targetX != null && typeof getAreaInfo === 'function')
      ? getAreaInfo(unit.aiAction.targetX, unit.aiAction.targetY).areaType : null,
    currentAreaType: (typeof getAreaInfo === 'function') ? getAreaInfo(unit.x, unit.y).areaType : null,
    // coverState
    csType: ctx.coverType,
    csQuality: ctx.coverQuality,
    csCanFire: ctx.canReturnFire,
    enemyCover: ctx.enemyBehindFullCover ? 'full' : (ctx.enemyBehindPartialCover ? 'partial' : null),
    // === Threat 분리 + goProne 점수 분해 ===
    hasImmediateThreat: ctx.hasImmediateThreat,
    hasPotentialThreat: ctx.hasPotentialThreat,
    immediateSrc: ctx.immediateThreatSource,
    goProneRaw: ctx._goProneRaw,
    goProneCost: ctx._goProneCost,
    goProneFinal: ctx._goProneFinal,
    goProneBlockedReason: ctx._goProneBlockedReason,
    inGrace: ctx.inSpawnGrace ? 'spawn' : (ctx.inInitialScanGrace ? 'scan' : (ctx.inRoomEntryGrace ? 'room' : null)),
    reason: '',
  };

  // 행동 전환 결정
  let shouldSwitch = false;
  // 다단계 의도는 진행 중에 점수로 갈아타지 않는다.
  //   후보 생성기는 계획이 도는 동안 그 후보를 아예 안 내놓는다(prepFragContext가 조기 반환).
  //   그러면 currentScore가 0이 되어 다음 재평가에서 무조건 밀려나고, 던지자마자 계획이 취소된다.
  //   그래서 "예약이 살아 있는 동안은 유지"를 여기서 못 박는다. 중단은 위험(아래 grenadeDanger)이 한다.
  //   목록이 세 군데(여기 · clearPendingFrag 게이트 · isActionDone)로 흩어져 있어서
  //   `screenThenCross`를 더할 때 **여기를 빠뜨렸다** — 위 주석이 경고하는 바로 그 증상이
  //   그대로 재현됐다(투척 8회, 차폐 0회, 종료 사유 전부 switched_to_*).
  //   그래서 소유권은 `actionOwnsFragPlan` 하나로만 말한다.
  const _planHeld = !!(unit.aiAction
    && ((actionOwnsFragPlan(unit.aiAction.type) && unit.pendingFrag)
     || (unit.aiAction.type === 'peekAndAssess' && unit.pendingPeek)));
  if (!unit.aiAction || curActionDone) {
    shouldSwitch = true;
    unit.aiUtilityDebug.reason = curActionDone ? 'completed' : 'no_action';
  } else if (_planHeld && !ctx.grenadeDanger && !ctx.severeWound) {
    shouldSwitch = false;
    unit.aiUtilityDebug.reason = 'plan_in_progress';
  } else if (ctx.grenadeDanger && unit.aiAction.type !== 'goProne' && unit.aiAction.type !== 'seekCover') {
    shouldSwitch = true;
    unit.aiUtilityDebug.reason = 'grenade_danger';
  } else if (ctx.recentlyHit && unit.aiAction.type === 'holdAngle') {
    shouldSwitch = true;
    unit.aiUtilityDebug.reason = 'hit_during_hold';
  } else {
    // 거의 완료 직전 + 안전한 이동 행동은 사소한 점수 차로 취소 X
    let effectiveThreshold = prof.switchThreshold;
    const a = unit.aiAction;
    const movingAction = (a.type === 'seekCover' || a.type === 'retreatFromThreat'
                       || a.type === 'investigateNoise' || a.type === 'repositionToCorner'
                       || a.type === 'clearUnknownRoom');   // 문 앞까지 다 가놓고 사소한 점수 차로 취소되면 안 된다
    if (movingAction && a.targetX != null) {
      const distLeft = Math.hypot(unit.x - a.targetX, unit.y - a.targetY);
      if (distLeft < 35 && !ctx.exposedToEnemy && !ctx.recentlyHit) {
        effectiveThreshold = prof.switchThreshold * 2.0;   // 거의 도착 + 안전 → 2배 까다롭게
      }
    }
    // reload는 거의 완료 직전이면 매우 보수적으로 유지
    if (a.type === 'reloadInCover' && unit.reloadTimer > 0 && unit.reloadTimer < 0.5 && !ctx.grenadeDanger) {
      effectiveThreshold = 999;   // 사실상 유지
    }
    // goProne 진입 — 절대 점수 + 상대 우위 모두 만족해야 (점수 노이즈 플래핑 방지)
    //   강제 조건은 즉시 허용
    if (best.type === 'goProne' && unit.stance !== 'prone') {
      const forceAllow = ctx.grenadeDanger
                     || (ctx.recentlyHit && ctx.visibleEnemyCount > 0)
                     || (ctx.suppression > 75 && (ctx.exposedToEnemy || ctx.visibleEnemyCount > 0));
      if (!forceAllow) {
        // hasImmediateThreat 필수
        if (!ctx.hasImmediateThreat) {
          effectiveThreshold = 999;
          unit.aiUtilityDebug.reason = 'goProne_no_immediate_threat';
        } else {
          // 절대 점수 ≥35 AND 2등 대비 +10 이상
          const second = candidates[1] ? candidates[1].score : 0;
          if (best.score < 35 || (best.score - second) < 10) {
            effectiveThreshold = 999;
            unit.aiUtilityDebug.reason = `goProne_margin_${(best.score - second).toFixed(0)}`;
          }
        }
      }
    }
    if (best.score - currentScore >= effectiveThreshold) {
      shouldSwitch = true;
      unit.aiUtilityDebug.reason = `score+${(best.score - currentScore).toFixed(0)}`;
    }
  }

  // SIDE-AI-PLAYER-REASSESS: 플레이어가 방금 직접 위치시킨 아군 — 잠깐 자율 이동(도주/재배치) 보류
  //   새 위치에서 사격/대기 우선. 단 즉각 위협(피격/임박위협/수류탄)에는 정상 반응.
  if (shouldSwitch && unit.team === 'friend' && unit._playerOrderTime != null) {
    const sinceOrder = now - unit._playerOrderTime;
    const moveBest = (best.type === 'seekCover' || best.type === 'retreatFromThreat'
                   || best.type === 'repositionToCorner' || best.type === 'reposition');
    if (sinceOrder >= 0 && sinceOrder < 3.5 && moveBest
        && !ctx.hasImmediateThreat && !ctx.recentlyHit && !ctx.grenadeDanger) {
      shouldSwitch = false;
      unit.aiUtilityDebug.reason = 'player_order_grace';
    }
  }

  if (shouldSwitch && best.score > 0) {
    executeUtilityAction(unit, _stickyPick(unit, best, candidates, prof, now), ctx);
  }

  // 다음 판단 시간
  const interval = (ctx.visibleEnemyCount > 0 || ctx.grenadeDanger) ? prof.contactInterval : prof.interval;
  unit.aiUtilityNext = now + interval;
}

// =============================================================
// 대원 간 겹침 방지 / Personal Space + 이동 목표 보정
// =============================================================
//   원칙:
//   - 기존 이동/경로 시스템을 깨지 않고 별도 보정 레이어 추가
//   - 좁은 통로에서는 약하게 작동
//   - 끌리는/끌고 가는 유닛은 예외

const SEPARATION_STRONG_PX = 14;    // 강제 분리 거리
const SEPARATION_SOFT_PX   = 22;    // 약한 분리
const SEPARATION_AWARE_PX  = 28;    // 인지 거리

// 매 unit tick에서 호출 — 이동 후 가벼운 separation 적용
function applyPersonalSpace(unit, dt) {
  if (!unit.alive || unit.isDead || unit.isDowned) return;
  if (unit.draggedBy != null) return;
  if (unit.draggingTarget != null) return;   // 끌고 있으면 안 흔듦
  if (unit.forcedProneTimer > 0) return;
  if (unit.stance === 'prone') return;
  if (typeof UNITS === 'undefined' || !Array.isArray(UNITS)) return;

  let pushX = 0, pushY = 0;
  let pushed = false;
  const isMoving = unit.movePath && unit.movePath.length > 0;

  for (const other of UNITS) {
    if (other === unit || other.isDead) continue;
    const dx = unit.x - other.x, dy = unit.y - other.y;
    const dsq = dx * dx + dy * dy;
    if (dsq > SEPARATION_AWARE_PX * SEPARATION_AWARE_PX) continue;
    if (dsq < 0.01) {
      // 정확히 겹침 — 무작위 방향으로 약하게
      pushX += (Math.random() - 0.5) * 2;
      pushY += (Math.random() - 0.5) * 2;
      pushed = true;
      continue;
    }
    const d = Math.sqrt(dsq);
    // 강도 — 거리 기반
    let strength = 0;
    if (d < SEPARATION_STRONG_PX) {
      strength = (SEPARATION_STRONG_PX - d) / SEPARATION_STRONG_PX;   // 0~1
      strength *= 28;   // 강한 분리
    } else if (d < SEPARATION_SOFT_PX) {
      strength = (SEPARATION_SOFT_PX - d) / SEPARATION_SOFT_PX;
      strength *= 8;    // 부드러운 분리
    } else {
      strength = (SEPARATION_AWARE_PX - d) / SEPARATION_AWARE_PX;
      strength *= 2;
    }
    // 같은 팀이면 정상 separation, 적팀이면 약하게
    if (other.team !== unit.team) strength *= 0.4;
    // 정지한 유닛은 더 단단함 — 이동 중인 유닛이 더 비켜남
    if (!isMoving && other.movePath && other.movePath.length > 0) strength *= 0.5;
    // downed 유닛은 약한 장애물
    if (other.isDowned) strength *= 0.6;

    pushX += (dx / d) * strength;
    pushY += (dy / d) * strength;
    pushed = true;
  }
  if (!pushed) return;
  // 좁은 통로 회피 — 벽에 너무 가까우면 강도 축소
  const wallProx = checkWallProximity(unit.x, unit.y, 20);
  if (wallProx > 0.6) {
    pushX *= 0.3; pushY *= 0.3;
  }
  // 상한 — frame당 너무 크게 밀리지 않게
  const maxStep = 40 * dt;   // 초당 40px 한도
  const mag = Math.hypot(pushX, pushY);
  if (mag > maxStep) {
    pushX = pushX / mag * maxStep;
    pushY = pushY / mag * maxStep;
  }
  // 적용 — 벽 안으로는 들어가지 않게
  const nx = unit.x + pushX, ny = unit.y + pushY;
  if (typeof pointInWalls === 'function' && pointInWalls(nx, ny, UNIT_RADIUS - 2)) {
    // 벽 — 일축씩 시도
    if (!pointInWalls(nx, unit.y, UNIT_RADIUS - 2)) { unit.x = nx; return; }
    if (!pointInWalls(unit.x, ny, UNIT_RADIUS - 2)) { unit.y = ny; return; }
    return;
  }
  unit.x = nx; unit.y = ny;
}

// 좁은 통로 감지 — 주변 8 방향 ray로 벽 근접도
function checkWallProximity(x, y, radius) {
  if (typeof pointInWalls !== 'function') return 0;
  let blocked = 0;
  const dirs = 8;
  for (let i = 0; i < dirs; i++) {
    const ang = (i / dirs) * Math.PI * 2;
    const tx = x + Math.cos(ang) * radius;
    const ty = y + Math.sin(ang) * radius;
    if (pointInWalls(tx, ty, 2)) blocked++;
  }
  return blocked / dirs;
}

// === 이동 목표점 겹침 방지 ===
// 다른 유닛이 향하는 위치/movePath 끝점/이미 점유한 위치 검사
// 너무 가까우면 옆으로 보정
function adjustTargetForCrowding(unit, tx, ty, opts) {
  opts = opts || {};
  const MIN_DIST_PX = opts.minDist || 18;
  // 기존 위치에 다른 유닛이 있는가?
  const reserved = collectReservedPoints(unit);
  let needAdjust = false;
  for (const p of reserved) {
    if (Math.hypot(p.x - tx, p.y - ty) < MIN_DIST_PX) { needAdjust = true; break; }
  }
  if (!needAdjust) return { x: tx, y: ty, adjusted: false };
  // 주변 8 방향으로 후보 — 첫 충돌 없는 위치
  for (let r = 22; r <= 40; r += 8) {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const cx = tx + Math.cos(ang) * r;
      const cy = ty + Math.sin(ang) * r;
      if (typeof pointInWalls === 'function' && pointInWalls(cx, cy, UNIT_RADIUS - 2)) continue;
      let collide = false;
      for (const p of reserved) {
        if (Math.hypot(p.x - cx, p.y - cy) < MIN_DIST_PX) { collide = true; break; }
      }
      if (!collide) return { x: cx, y: cy, adjusted: true };
    }
  }
  return { x: tx, y: ty, adjusted: false };
}

// 다른 유닛의 점유/예약 위치 수집
function collectReservedPoints(excludeUnit) {
  const out = [];
  if (typeof UNITS === 'undefined' || !Array.isArray(UNITS)) return out;
  for (const u of UNITS) {
    if (u === excludeUnit || u.isDead) continue;
    // 현재 위치
    out.push({ x: u.x, y: u.y, type: 'pos', unit: u });
    // 이동 목표 (마지막 wp)
    if (u.movePath && u.movePath.length > 0) {
      const last = u.movePath[u.movePath.length - 1];
      if (last && last.x != null) out.push({ x: last.x, y: last.y, type: 'movePath', unit: u });
    }
    // aiAction target
    if (u.aiAction && u.aiAction.targetX != null) {
      out.push({ x: u.aiAction.targetX, y: u.aiAction.targetY, type: 'aiTarget', unit: u });
    }
  }
  return out;
}

// =============================================================
// Cover Slot 시스템 — 엄폐물 뒤 좌/우/중앙 분산 위치
// =============================================================
// 한 엄폐물에 최대 5개 slot (center/left/right/farLeft/farRight)
// 각 slot은 targetX/Y + tactical 점수 (측면 보호, 사격각, 탈출)

// ════════════════════════════════════════════════════════════════════════════
