function updateUnit(unit, dt) {
  // passive 표적 — 사망 시 respawnTimer 카운트, 도달하면 부활
  if (unit.isDead || (!unit.alive && !unit.isDowned)) {
    if (unit.role === 'passive' && unit.respawnDelay > 0) {
      unit.respawnTimer += dt;
      if (unit.respawnTimer >= unit.respawnDelay) {
        unit.alive = true;
        unit.hp = unit.maxHp;
        // 부위 hp + 전투 상태 초기화
        for (const p of BODY_PARTS) unit.bodyHp[p] = unit.bodyHpMax[p];
        unit.combatState = 'active';
        unit.isDead = false;
        unit.isDowned = false;
        unit.conscious = true;
        unit.canBeDragged = false;
        unit.draggedBy = null;
        unit.draggingTarget = null;
        unit.aiIntent = 'none';
        unit._aiCoverTarget = null;
        unit._aiCoverTimer = 0;
        unit.downedTime = 0;
        unit._playerPathBackup = null;
        unit._lastReportedState = null;
        unit._lastReportedConscious = true;
        unit.stance = 'standing';
        unit.pain = 0;
        unit.stoppingTimer = 0;
        unit._painReportedTier = 0;
        unit._lastStoppedFire = false;
        unit.suppression = 0;
        unit.pinned = false;
        unit.x = unit.spawnX; unit.y = unit.spawnY;
        unit.facing = unit.spawnFacing;
        unit.aimTimer = 0;
        unit.fireTimer = 0;
        unit.currentTarget = null;
        unit.respawnTimer = 0;
        unit.shotQueue = null;
        unit.manualFireTarget = null;
        // === Medical 완전 초기화 ⭐ ===
        if (typeof createMedical === 'function') {
          unit.medical = createMedical();
          if (typeof recalcMedicalSummary === 'function') recalcMedicalSummary(unit);
          if (typeof syncLegacyCombatState === 'function') syncLegacyCombatState(unit);
        }
        // legacy 출혈/골절/응급처치 잔여 제거
        unit.bleeding = 'none';
        unit.bleedingLoc = null;
        unit.bleedingTime = 0;
        unit.fracture = 'none';
        unit.shock = 0;
        unit.tourniquetActive = false;
        unit.tourniquetLoc = null;
        unit.tourniquetAppliedAt = 0;
        unit.splintApplied = false;
        unit.chestSealApplied = false;
        unit.stabilized = false;
        unit.shockCareApplied = false;
        unit.painkillerActive = false;
        unit.painkillerTimer = 0;
        unit.painkillerDelay = 0;
        unit.painkillerDoseCount = 0;
        unit.painkillerCooldown = 0;
        unit.analgesiaLevel = 0;
        unit.forcedProneTimer = 0;
        unit._proneReason = null;
        unit.proneLockUntil = null;
        unit.lastProneExitTime = null;
        unit.spawnedAt = GAME.gameTime || 0;
        // 탄약/재장전 초기화
        initUnitAmmo(unit);
      }
    }
    return;
  }
  unit.suppression = Math.max(0, unit.suppression - dt * 9);
  unit.pinned = unit.suppression >= 70;
  unit.fireTimer = Math.max(0, unit.fireTimer - dt);
  unit._suppressFireTimer = Math.max(0, unit._suppressFireTimer - dt);
  unit._coverFireTimer = Math.max(0, (unit._coverFireTimer || 0) - dt);
  // downed 시간 — 명중률 회복 곡선에 사용
  if (unit.isDowned) unit.downedTime += dt;

  // 보류 의료/끌기 — 접근 후 자동 실행
  tickPendingMedic(unit);

  // Stance 전환 — goingProne/gettingUp timer 진행
  if (typeof tickStanceTransition === 'function') tickStanceTransition(unit, dt);

  // === Medical tick — 출혈/혈액/HR/BP/호흡/회복/저혈량 손상 ===
  if (unit.medical && typeof tickMedical === 'function') {
    tickMedical(unit, dt);
  }

  // === stance/prone 지속시간 누적 ===
  if (unit._lastStance !== unit.stance) {
    unit.stanceTime = 0;
    if (unit.stance === 'prone') unit.proneTime = 0;
    unit._lastStance = unit.stance;
  } else {
    unit.stanceTime = (unit.stanceTime || 0) + dt;
    if (unit.stance === 'prone') unit.proneTime = (unit.proneTime || 0) + dt;
    else unit.proneTime = 0;
  }

  // 수류탄 사건 watch timer 감소
  if (unit.grenadeSourceWatchTimer > 0) {
    unit.grenadeSourceWatchTimer = Math.max(0, unit.grenadeSourceWatchTimer - dt);
  }

  // AI 레이캐스트 스캔 — 모든 유닛 (성능: 스캔 주기 도달 시만 실제 cast)
  tickAIScan(unit, dt);
  // 공간 인지 — 지형 기억을 관측 기반 믿음으로 교체 (스위치 off면 무동작)
  tickSpatialPerception(unit, dt);

  // 초기 스캔 후 천천히 경계 방향으로 회전 (idle 상태일 때만)
  tickWatchRotation(unit, dt);

  // 수류탄 반응 — Utility AI보다 먼저 (즉시 위험 우선 처리)
  tickGrenadeReaction(unit, dt);

  // Utility AI — 점수 기반 행동 선택 레이어 (강제 반응 / 플레이어 명령은 자동 우회)
  tickUtilityAI(unit, dt);

  // Personal Space — 가까운 동료/적과 겹치지 않게 부드러운 separation
  applyPersonalSpace(unit, dt);

  // 투척 진행 (prep → flight → fuse → 폭발)
  if (unit.throwState) tickThrowable(unit, dt);

  // === 응급처치 진행 / 효과 tick ===
  // painkiller 발동 지연 → 효과 지속
  if (unit.painkillerDelay > 0) {
    unit.painkillerDelay = Math.max(0, unit.painkillerDelay - dt);
    if (unit.painkillerDelay === 0) {
      // 발동 — 효과 게이지 누적
      const baseAnalgesia = 35;
      const stackBonus = (unit.painkillerDoseCount || 0) >= 1 ? 25 : 0;
      const newLevel = Math.min(85, (unit.analgesiaLevel || 0) + baseAnalgesia + stackBonus);
      unit.analgesiaLevel = newLevel;
      unit.painkillerActive = true;
      // 효과 시간 — 첫 투여 60초, 중첩 시 연장
      unit.painkillerTimer = Math.max(unit.painkillerTimer || 0, 60);
      // pain 즉시 감소 — medical 우선 (medical.pain이 단일 출처)
      const immediateReduce = Math.round(newLevel * 0.35);
      if (unit.medical) {
        if (unit.medical.pain > 20) unit.medical.pain = Math.max(15, unit.medical.pain - immediateReduce);
        unit.pain = unit.medical.pain;   // 즉시 sync
      } else {
        if (unit.pain > 20) unit.pain = Math.max(15, unit.pain - immediateReduce);
      }
      if (unit.team === 'friend') {
        log(`[${unit.name}] 진통 효과 ${newLevel}% (${immediateReduce} 감소)`, 'info');
      }
      // downed conscious면 일어나기 시도
      if (unit.isDowned && unit.conscious) tryStandUp(unit);
    }
  }
  if (unit.painkillerActive) {
    unit.painkillerTimer = Math.max(0, unit.painkillerTimer - dt);
    // 효과 게이지 점진 감소 (시간 비례)
    if (unit.analgesiaLevel != null && unit.painkillerTimer > 0) {
      // 시간 잔여 비율에 따라 감소
      unit.analgesiaLevel = Math.max(0, unit.analgesiaLevel - dt * 0.6);
    }
    if (unit.painkillerTimer === 0) {
      unit.painkillerActive = false;
      unit.analgesiaLevel = 0;
      if (unit.team === 'friend') log(`[${unit.name}] 진통제 효과 종료`, 'warn');
    }
  }
  // 진통제 cooldown 감소 (재투여 제한)
  if (unit.painkillerCooldown > 0) {
    unit.painkillerCooldown = Math.max(0, unit.painkillerCooldown - dt);
  }

  // 처치 timer
  if (unit.treatmentTimer > 0) {
    // 처치 중에는 사격/이동 불가 — 별도 게이트로 처리. 여기선 시간만 진행.
    unit.treatmentTimer = Math.max(0, unit.treatmentTimer - dt);
    // 1.5초마다 작은 noise (처치 작업음)
    unit._treatNoiseTimer = (unit._treatNoiseTimer || 0) - dt;
    if (unit._treatNoiseTimer <= 0) {
      emitNoise(unit.x, unit.y, { type: 'treatment', team: unit.team, sourceUnitId: unit.id });
      unit._treatNoiseTimer = 1.5;
    }
    // 처치자가 stopping/heavy hit 받으면 중단
    if (unit.stoppingTimer > 0 || unit.suppression > 70) {
      cancelTreatment(unit, '중단됨');
    } else if (unit.treatmentTimer === 0) {
      completeTreatment(unit);
    }
  }

  // === 출혈 진행 — medical system이 처리 (tickMedical) ===
  //   medical이 있으면 bleedRate 기반 bloodMl 감소가 일어남
  //   legacy 출혈 tick은 medical 없는 유닛에만 적용 (사격장 등 fallback)
  if (!unit.medical && unit.bleeding && unit.bleeding !== 'none' && !unit.isDead) {
    unit.bleedingTime += dt;
    let postureMul = 1.0;
    if (unit.isDowned) postureMul = 0.75;
    else if (unit.movePath && unit.movePath.length > 0) {
      const wp = unit.movePath[0];
      postureMul = wp._run ? 1.30 : 1.15;
    }
    if (unit.tourniquetActive && (unit.bleedingLoc === 'arms' || unit.bleedingLoc === 'legs')) {
      postureMul *= 0.20;
    }
    if (unit.stabilized) postureMul *= 0.50;
    let hpRate = 0, painRate = 0;
    if (unit.bleeding === 'light')          { hpRate = 0.6; painRate = 0.4; }
    else if (unit.bleeding === 'heavy')     { hpRate = 1.8; painRate = 1.0; }
    else if (unit.bleeding === 'critical')  { hpRate = 3.5; painRate = 1.8; }
    unit.hp = Math.max(0, unit.hp - hpRate * postureMul * dt);
    if (painRate > 0) addPain(unit, painRate * postureMul * dt);
    if (unit.tourniquetActive && unit.tourniquetAppliedAt > 0) {
      const tElapsed = (GAME.gameTime || 0) - unit.tourniquetAppliedAt;
      if (tElapsed > 30) addPain(unit, 0.6 * dt);
    }
    if (unit.hp <= 0) updateCombatState(unit);
  }
  // stoppingTimer 감소 + pain 자연 회복 (medical 없는 유닛만 — medical은 tickMedical에서 처리)
  if (unit.stoppingTimer > 0) unit.stoppingTimer = Math.max(0, unit.stoppingTimer - dt);
  // 섬광 — 시야/청각은 따로 회복한다(귀가 더 오래 먹는다)
  if (unit.flashBlindTimer > 0) unit.flashBlindTimer = Math.max(0, unit.flashBlindTimer - dt);
  if (unit.flashDeafTimer > 0) unit.flashDeafTimer = Math.max(0, unit.flashDeafTimer - dt);
  // [0.39.2 Fix1] impactKnockdownTimer — 감소 + alias 동기화. 자세 강제(prone)는 canonical stance chain에서 처리(아래).
  if ((unit.impactKnockdownTimer || 0) > 0) {
    unit.impactKnockdownTimer = Math.max(0, unit.impactKnockdownTimer - dt);
    if (unit.medical) unit.medical.impactKnockdownTimer = unit.impactKnockdownTimer;   // alias 동기화
    unit._knockdownStanceApplied = (unit.impactKnockdownTimer > 0);   // 종료 시 false → 정상 제어 복귀 신호
  } else if (unit._knockdownStanceApplied) {
    unit._knockdownStanceApplied = false;
  }
  if (!unit.medical && unit.pain > 0) {
    let recoveryRate = 3.0;
    if (unit.bodyHp) {
      const minBp = Math.min(unit.bodyHp.head, unit.bodyHp.chest, unit.bodyHp.abdomen);
      if (minBp <= 30)      recoveryRate = 0.5;
      else if (minBp <= 50) recoveryRate = 1.2;
      else if (minBp <= 70) recoveryRate = 2.0;
    }
    unit.pain = Math.max(0, unit.pain - recoveryRate * dt);
  }

  // 진행 중 사격 묶음(shotQueue) 처리 — 매 프레임 한 발씩 시간차로 발사
  processShotQueue(unit, dt);

  // 재장전 타이머 갱신
  updateReload(unit, dt);

  // SIDE-WEAPON-PLATFORM-1A: 무기 전환/거치/간섭 갱신 (active slot 탄약 동기화 포함)
  if (unit.weaponState) {
    syncActiveSlotAmmoFromLegacy(unit);
    if (typeof updateWeaponSwitch === 'function') updateWeaponSwitch(unit, dt);
    if (typeof updateInjuryWeaponHandling === 'function') updateInjuryWeaponHandling(unit, dt);   // SIDE-WEAPON-INJURY-HANDLING-1: 부상 강제 보조무기 전환
    if (typeof updateMountedWeaponArc === 'function') updateMountedWeaponArc(unit);
    if (typeof computeWeaponObstructionState === 'function') {
      const _rp = unit._resolvedWeaponProfile || (typeof resolveActiveWeapon === 'function' ? resolveActiveWeapon(unit) : null);
      unit.weaponState.obstructionState = computeWeaponObstructionState(unit, _rp);
    }
  }

  // 위협 기억 — 보이는 적마다 lastKnown 갱신, confidence 시간 감쇠
  updateLastKnownFromVisibility(unit);
  decayMemory(unit, dt);

  const target = pickTarget(unit);

  if (target) {
    if (!unit.currentTarget || unit.currentTarget.id !== target.id) {
      unit.currentTarget = target;
      unit.aimTimer = 0;
    }
    const moving = unit.movePath.length > 0;
    const aimSpeed = (unit.skill && unit.skill.aimSpeed) || 1.0;
    const baseRate = moving ? 0.6 : 1.4;
    const aimMedMul = (unit.medical && unit.medical.aimMul != null) ? unit.medical.aimMul : 1.0;
    let aimInjMul = 1.0;
    if (typeof getWeaponHandlingInjuryModifier === 'function' && unit.weaponState) { const _m = getWeaponHandlingInjuryModifier(unit, unit.weaponState.activeSlot); aimInjMul = 1 / Math.max(1.0, _m.aimTimeMul); }   // SIDE-WEAPON-INJURY-HANDLING-1: 부상 시 조준 느려짐
    unit.aimTimer = Math.min(1.8, unit.aimTimer + dt * baseRate * aimSpeed * getLoadAimMul(unit) * aimMedMul * getVisorAimMul(unit) * aimInjMul);
    unit._lastAimQuality = computeAimQuality(unit);
  } else {
    unit.currentTarget = null;
    unit.aimTimer = Math.max(0, unit.aimTimer - dt * 1.0);
    unit._lastAimQuality = computeAimQuality(unit);
    // SIDE-MEMORY-1A §7: visible target 없음 — best threat memory 방향으로 각 잡기.
    //   PRECISE/AREA는 예측/마지막 위치, STALE는 구역 방향만. INVALID는 갱신 안 함.
    const mem = getBestThreatMemory(unit);
    if (mem && unit.aiMemory) {
      const cls = classifyEnemyMemory(mem);
      if (cls !== 'INVALID') {
        let wx = mem.x, wy = mem.y;
        if ((cls === 'PRECISE_RECENT' || cls === 'AREA_SUSPECTED') && _fcIsRegularPlus(unit)) {
          const pts = buildPredictedEnemyPoints(unit, mem);
          const lead = pts.find(p => p.kind === 'shortLead');
          if (lead) { wx = lead.x; wy = lead.y; }
        }
        unit.aiMemory.preferredWatchAngle = Math.atan2(wy - unit.y, wx - unit.x);
        unit._memWatchClass = cls;   // 디버그용
      }
    }
  }

  // === FACING DECISION (시선 우선순위) ===
  //   1. pinned → 회전 정지
  //   2. visible target
  //   3. 현재 이동 목표 waypoint.facing (이동 중에도 적용)
  //   4. _holdFacing (마지막 도착 wp의 facing 유지)
  //   5. lastKnownEnemy
  //   6. threatDirection (탄 스침/피격)
  //   7. 이동 방향 또는 homeFacing (적 전용)
  let desiredFacing = null;
  let aimType = 'idle';
  if (unit.pinned) {
    desiredFacing = null;
    aimType = 'pinned';
  } else if (target) {
    desiredFacing = Math.atan2(target.y - unit.y, target.x - unit.x);
    aimType = 'visible';
  } else if (unit.manualFireTarget) {
    // 수동 사격 지점 — visible target 없을 때 그쪽으로 우선 회전
    desiredFacing = Math.atan2(unit.manualFireTarget.y - unit.y, unit.manualFireTarget.x - unit.x);
    aimType = 'manual_fire';
  } else if (unit.movePath.length > 0 && unit.movePath[0].facing != null) {
    // 이동 중 + 다음 wp에 시선 지정 있음
    //   거리 기반이 아니라 "도착까지 남은 시간(ETA)" 기반으로 회전 시점 결정.
    //   - rotation time = 필요한 회전 각 / ROTATE_SPEED
    //   - ETA <= rotation time + margin 이면 wp.facing으로 즉시 회전 시작
    //   - 짧은 wp는 처음부터 wp.facing이 desiredFacing이 됨
    //   - 긴 wp는 도착 직전에 회전이 끝나도록 자연스럽게 시작
    const wp = unit.movePath[0];
    const dToWp = Math.hypot(wp.x - unit.x, wp.y - unit.y);
    const moveAng = Math.atan2(wp.y - unit.y, wp.x - unit.x);
    // 현재 적용되는 이동 속도 — target 있으면 engaged, pain/legs 페널티는 무시(보수적 추정)
    const baseSpeed = target ? unit.moveSpeedEngaged : unit.moveSpeed;
    const eta = (baseSpeed > 0) ? (dToWp / baseSpeed) : 999;
    // 회전에 필요한 시간 — 현재 facing → wp.facing
    const rotNeeded = Math.abs(angleDiff(wp.facing, unit.facing));
    const rotTime = rotNeeded / ROTATE_SPEED;
    // 회전 시작 조건 — 둘 중 하나라도 만족하면 wp.facing
    //   1) ETA <= rotTime + margin  (회전이 도착 전에 끝나도록)
    //   2) ETA <= MIN_LEAD          (도착까지 ~1초 이내면 무조건 미리 회전)
    //   짧은 wp는 (1)로, 긴 wp도 (2)로 적당한 시점에 회전이 시작됨.
    const PIVOT_MARGIN = 0.05;
    const MIN_LEAD = 1.0;
    if (eta <= Math.max(rotTime + PIVOT_MARGIN, MIN_LEAD)) {
      desiredFacing = wp.facing;
    } else {
      desiredFacing = moveAng;
    }
    aimType = 'wp_facing';
  } else if (unit.movePath.length === 0 && unit._holdFacing != null) {
    desiredFacing = unit._holdFacing;
    aimType = 'wp_facing';
  } else {
    const best = pickBestLastKnown(unit);
    const threatActive = (unit.threatDirection != null) &&
                         ((GAME.gameTime - unit.threatTime) < THREAT_DURATION);
    const heard = unit.lastHeardNoise;
    const heardActive = heard && heard.confidence > 0.15;
    // 큰 소리 — 폭발/사격/근거리 발자국 등 (강도 높은 이벤트)
    //   loudness, type, 거리 기반으로 "급박한 소리" 판정
    const loudHeard = heard && (
      heard.type === 'explosion_loud' || heard.type === 'explosion' ||
      (heard.type === 'gunshot' && heard.confidence > 0.4) ||
      (heard.confidence > 0.55)   // 매우 가까운/큰 소리
    );

    // 우선순위 (위→아래):
    //   1) 피격 위협 (threat) — 자신을 맞춘 탄/근접 미스의 방향 — 즉시 반응
    //   2) 큰 소리 (loud noise) — 폭발/근거리 사격
    //   3) lastKnownEnemy (last_known) — 본 적의 마지막 위치
    //   4) 일반 소리
    //   5) move 방향
    //   6) homeFacing
    if (threatActive) {
      desiredFacing = unit.threatDirection;
      aimType = 'threat';
    } else if (loudHeard) {
      desiredFacing = Math.atan2(heard.y - unit.y, heard.x - unit.x);
      aimType = 'loud_noise';
    } else if (best && best.confidence > 0.30) {
      desiredFacing = Math.atan2(best.y - unit.y, best.x - unit.x);
      aimType = 'last_known';
    } else if (heardActive) {
      // 일반 소음 — searchNoise 상태면 좌우 스캔
      desiredFacing = Math.atan2(heard.y - unit.y, heard.x - unit.x);
      if (unit.aiState === 'searchNoise') {
        const t = (GAME.gameTime - unit.aiStateTimer);
        const sweep = Math.sin(t * 2.0) * (Math.PI / 6);
        desiredFacing += sweep;
      }
      aimType = 'noise';
    } else if (unit.movePath.length > 0) {
      const wp = unit.movePath[0];
      desiredFacing = Math.atan2(wp.y - unit.y, wp.x - unit.x);
      aimType = 'move';
    } else {
      // SIDE-AI-SCAN-FACING-FIX: 능동 감시 방향을 본체 facing으로 반영 (스캔이 이 facing을 따라감)
      //   위험 출입구(dangerLevel 최고) → 선호 감시각 → (적)home → idle
      let watchAng = null;
      const _m = unit.aiMemory;
      if (_m && _m.dangerousEntrances && _m.dangerousEntrances.length > 0) {
        let bestDE = null;
        for (const de of _m.dangerousEntrances) { if (!bestDE || (de.dangerLevel || 0) > (bestDE.dangerLevel || 0)) bestDE = de; }
        if (bestDE) watchAng = Math.atan2(bestDE.y - unit.y, bestDE.x - unit.x);
      }
      if (watchAng == null && _m && _m.preferredWatchAngle != null) watchAng = _m.preferredWatchAngle;
      if (watchAng != null) { desiredFacing = watchAng; aimType = 'watch'; }
      else if (unit.team === 'enemy') { desiredFacing = unit.homeFacing; aimType = 'home'; }
      else { aimType = 'idle'; }
    }
  }
  unit._aimType = aimType;

  // 회전 처리 — 적 전용 homeFacing 복귀는 더 느린 속도, threat/loud는 더 빠른 회전
  if (desiredFacing != null) {
    let rotMul = 1.0;
    if (aimType === 'home')        rotMul = 0.4;
    else if (aimType === 'threat')     rotMul = 1.8;   // 피격 — 즉각 회전
    else if (aimType === 'loud_noise') rotMul = 1.5;   // 큰 소리 — 빠른 회전
    const diff = angleDiff(desiredFacing, unit.facing);
    const step = ROTATE_SPEED * rotMul * getLoadHandlingMul(unit) * dt;
    if (Math.abs(diff) <= step) unit.facing = desiredFacing;
    else unit.facing = normalizeAngle(unit.facing + Math.sign(diff) * step);
  }

  // === FIRING (visible target 있을 때) ===
  if (target) {
    // skill.reaction × medical.reactionMul (clamp로 안정)
    const skillReaction = (unit.skill && unit.skill.reaction) || 1.0;
    const medReactionMul = (unit.medical && unit.medical.reactionMul != null)
                         ? Math.max(0.35, Math.min(1.15, unit.medical.reactionMul)) : 1.0;
    const effectiveReaction = Math.max(0.30, skillReaction * medReactionMul);
    const reactionDelay = 0.35 / effectiveReaction;
    // 자동 엄폐 이동 중에는 사격 보류 — 단, 매우 가까운 적(<5m)은 즉응 사격
    const inAutoCover = unit.movePath.length > 0 && unit.movePath[0]._autoCover;
    const targetDist = Math.hypot(target.x - unit.x, target.y - unit.y);
    const tooClose = targetDist < 100;   // 5m 이내
    const fireAllowed = !inAutoCover || tooClose;
    if (!unit.pinned && unit.aimTimer >= reactionDelay && inFireArc(unit, target) && fireAllowed) {
      if (canFireWeapon(unit)) {
        fireWeapon(unit, target);
      } else if (!unit.isReloading && unit.magAmmo <= 0 && unit.reserveAmmo > 0) {
        startReload(unit);
      }
    }
  } else if (unit.manualFireTarget) {
    // === 수동 사격 — 플레이어가 지정한 지점 ===
    // 한 번의 trigger 사격. visible target이 없을 때만 발동.
    // pinned/재장전/탄약 부족 시는 fireWeapon이 자체 차단.
    // 수동 사격은 즉시성 — aimTimer를 빠르게 충전.
    const aimSpeed = (unit.skill && unit.skill.aimSpeed) || 1.0;
    const aimMedMul2 = (unit.medical && unit.medical.aimMul != null) ? unit.medical.aimMul : 1.0;
    // SIDE-WEAPON-INJURY-HANDLING-1A: POINT FIRE 준비속도도 팔 부상 보정 (정상 속도로 준비되지 않게)
    let aimInjMul2 = 1.0;
    if (typeof getWeaponHandlingInjuryModifier === 'function' && unit.weaponState) { const _m = getWeaponHandlingInjuryModifier(unit, unit.weaponState.activeSlot); aimInjMul2 = 1 / Math.max(1.0, _m.aimTimeMul); }
    unit.aimTimer = Math.min(1.8, unit.aimTimer + dt * 1.6 * aimSpeed * getLoadAimMul(unit) * aimMedMul2 * getVisorAimMul(unit) * aimInjMul2);
    if (!unit.pinned && canFireWeapon(unit)) {
      const dx = unit.manualFireTarget.x - unit.x;
      const dy = unit.manualFireTarget.y - unit.y;
      const desired = Math.atan2(dy, dx);
      const facingDiff = Math.abs(angleDiff(desired, unit.facing));
      if (facingDiff <= unit.fireArc / 2) {
        const fakeTarget = {
          x: unit.manualFireTarget.x, y: unit.manualFireTarget.y,
          alive: true, stance: 'standing',
          name: '지정 사격', team: (unit.team === 'friend' ? 'enemy' : 'friend'),
          suppression: 0, maxHp: 100, hp: 100,
          bodyArmorId: null, helmetId: null,
          movePath: [], role: 'passive',
          _fcSource: 'manual',   // SIDE-FIRE-1A: manual point target
        };
        log(`[${unit.name}] 지정 사격`, 'info');
        fireWeapon(unit, fakeTarget);
        unit.manualFireTarget = null;
      }
    } else if (!unit.isReloading && unit.magAmmo <= 0 && unit.reserveAmmo > 0) {
      startReload(unit);
    }
  } else {
    // === 엄호사격 (미는 동료가 있을 때) → 없으면 견제사격 ===
    if (!tickCoverFire(unit)) maybeSuppressingFire(unit);
  }

  // === 자동 엄폐 보조 AI ===
  if (!unit.isDead && !unit.isDowned && unit._aiCoverTimer > 0) unit._aiCoverTimer -= dt;
  if (!unit.isDead && !unit.isDowned && unit._aiCoverTimer <= 0) {
    if (unit.team === 'enemy') {
      // 적군 — 노출이나 위협 받으면 적극적으로 엄폐 시도
      const hit = (unit.stoppingTimer > 0) || (unit._lastStoppedFire === true);
      const suppressed = (unit.suppression > 10);
      //  visible target 있고 노출되어 있으면 suppression 무관 발동
      const exposed = (target != null || unit.threatDirection != null) && isExposedToThreat(unit);
      const trigger = hit || suppressed || exposed;
      if (trigger && unit.threatDirection != null) {
        if (tryAutoSeekCover(unit)) {
          unit._lastStoppedFire = false;
        }
      }
    } else {
      // 친군은 보조 — 강한 위협일 때만 1회성
      const strongThreat = (unit.stoppingTimer > 0) || (unit.suppression > 50) || (unit._lastStoppedFire === true);
      const exposedNoCmd = (unit.movePath.length === 0)
                          && isExposedToThreat(unit)
                          && unit.threatDirection != null
                          && unit.suppression > 25;
      if ((strongThreat || exposedNoCmd) && unit.threatDirection != null) {
        tryAutoSeekCover(unit);
        unit._lastStoppedFire = false;
      }
    }
  }
  // downed conscious는 crawl-to-cover만 시도 (자주 X, 짧은 거리)
  if (unit.isDowned && unit.conscious && !unit.isDead) {
    if (unit._aiCoverTimer > 0) unit._aiCoverTimer -= dt;
    if (unit._aiCoverTimer <= 0 && unit.threatDirection != null && unit.movePath.length === 0) {
      // 매우 짧은 거리 엄폐만
      const cover = findNearbyCover(unit, unit.threatDirection);
      if (cover && Math.hypot(cover.x - unit.x, cover.y - unit.y) < 120) {
        const _cr = issueAICommand(unit, {
          type: 'move', source: 'acute_survival', actionType: 'downedCrawlToCover',
          targetX: cover.x, targetY: cover.y,
          path: [{ x: cover.x, y: cover.y, facing: null, _autoCover: true }], reason: 'downed_crawl',
        });
        if (_cr.accepted) { unit.aiIntent = 'crawlToCover'; unit._aiCoverTimer = 5.0; }
      }
    }
  }

  // === 소음 조사 / 경계 (적 AI 전용) ===
  //   visible/lastKnown이 없을 때 lastHeardNoise로 의심 지점 조사.
  //   너무 자주 이동하지 않게 cooldown.
  if (unit.team === 'enemy' && !unit.isDead && !unit.isDowned && !unit.currentTarget
      && unit.movePath.length === 0 && unit.aiIntent !== 'engage') {
    if (unit._noiseInvestigateTimer > 0) unit._noiseInvestigateTimer -= dt;
    const heard = unit.lastHeardNoise;
    if (heard && heard.confidence > 0.35 && unit._noiseInvestigateTimer <= 0) {
      const d = Math.hypot(heard.x - unit.x, heard.y - unit.y);
      // 가까운 소음만 조사 — 너무 가깝거나(이미 알고있음) 너무 멀면 무시
      if (d > 100 && d < 600) {
        // 소음 위치 근처 cover/corner로 이동 (정확한 지점이 아니라 약간 떨어진 지점)
        const angle = Math.atan2(unit.y - heard.y, unit.x - heard.x);
        const standoff = Math.min(80, d * 0.4);
        const tx = heard.x + Math.cos(angle) * standoff;
        const ty = heard.y + Math.sin(angle) * standoff;
        // 벽 안이 아니어야 함
        if (!pointInWalls(tx, ty, UNIT_RADIUS) && hasLineOfWalkClear(unit.x, unit.y, tx, ty)) {
          const _ni = issueAICommand(unit, {
            type: 'move', source: 'legacy_behavior', actionType: 'legacyNoiseInvestigate',
            targetX: tx, targetY: ty,
            path: [{ x: tx, y: ty, facing: angle + Math.PI, _investigateNoise: true }], reason: 'legacy_noise_investigate',
          });
          if (!_ni.accepted) { unit._noiseInvestigateTimer = 4.0; }
          else unit.aiIntent = 'investigateNoise';
          unit._noiseInvestigateTimer = _ni.accepted ? 8.0 : unit._noiseInvestigateTimer;   // 8초 cooldown
          if (GAME.debugNoise) log(`[${unit.name}] 소음 조사`, 'info');
        } else {
          unit._noiseInvestigateTimer = 4.0;
        }
      } else if (d <= 100) {
        // 매우 가까운 소음 — guard만
        unit.aiIntent = 'guardNoise';
        unit._noiseInvestigateTimer = 4.0;
      } else {
        unit._noiseInvestigateTimer = 4.0;
      }
    }
  }

  // === MOVEMENT (좌표 갱신) ===
  //   pinned면 일반 이동은 차단되지만, 자동엄폐(_autoCover) wp는 생존 이동으로 허용 (감속).
  const firstWp = unit.movePath.length > 0 ? unit.movePath[0] : null;
  const isSurvivalMove = firstWp && firstWp._autoCover;
  // [0.39.3 A-Closure] knockdown 중 일반 경로 이동 정지 — canonical gate. 생존 이동(수류탄 회피)은 예외.
  const _acuteMove = getAcuteActionBlockState(unit);
  const _knockedDown = _acuteMove.knockedDown;
  const halt = (unit.pinned && !isSurvivalMove) || (_acuteMove.blocksNormalMovement && !isSurvivalMove);
  // === 문 === 진행 방향 바로 앞이 닫힌 문이면 그 앞에 서서 연다 (아군·적 동일 규칙).
  //   계획(_planPointInWalls)은 이미 닫힌 문을 통과하도록 짜여 있다 — 실제로 여는 건 여기다.
  //   여는 동안(_doorHold)에는 이동만 멈춘다. 사격·시야 등 나머지 갱신은 그대로 돈다.
  if (!halt && !unit.pendingDoor && !unit.isDowned && unit.movePath.length > 0) {
    const _w0 = unit.movePath[0];
    const _dx0 = _w0.x - unit.x, _dy0 = _w0.y - unit.y, _d0 = Math.hypot(_dx0, _dy0);
    if (_d0 > 1e-6) {
      const _ahead = closedDoorAhead(unit, _dx0 / _d0, _dy0 / _d0);
      if (_ahead) setPendingDoor(unit, _ahead);
    }
  }
  const _doorHold = tickDoorInteraction(unit, dt);
  // 피킹 — 나갔다 관측하고 돌아온다. movePath를 스스로 관리하므로(관측 창에는 비운다)
  //   아래 이동 로직은 그대로 태운다. 여기서 막으면 나가지도 돌아오지도 못한다.
  tickPeek(unit, dt);
  // 프래그 계획 — 피킹 뒤에. 피킹이 도는 동안은 계획이 그 다리를 기다린다.
  tickFragPlan(unit, dt);
  tickSmokeAlert(unit, dt);
  if (!halt && !_doorHold && unit.movePath.length > 0) {
    const wp = unit.movePath[0];
    const dx = wp.x - unit.x, dy = wp.y - unit.y;
    const d = Math.hypot(dx, dy);
    // 다리 손상 페널티 — bodyHp.legs 낮을수록 이동 속도 감소
    const legsMul = getLegsImpairment(unit);
    const painMoveMul = getPainMoveMul(unit);
    // stoppingTimer 동안 추가 둔화
    const stopMul = _acuteMove.stopping ? 0.30 : 1.0;   // [0.39.5 §4] canonical gate (직접 timer 판정 제거)
    // knockdown 중 이동 강제 제한 (기어가듯) — stoppingTimer와 별개 배수(이중 적용 아님, 더 강한 쪽)
    const knockMul = _acuteMove.knockedDown ? 0.20 : 1.0;
    // pinned 중 생존 이동 — 추가 감속 (한 발 한 발 기듯)
    const pinnedMul = (unit.pinned && isSurvivalMove) ? 0.45 : 1.0;
    // runToCover — _run 플래그가 있고 정상 상태일 때 가속
    //   heavy/overloaded면 가속폭 감소
    let runMul = 1.0;
    if (wp._run && !unit.isDowned && !unit.pinned) {
      const lc = unit.loadClass || 'standard';
      runMul = (lc === 'overloaded') ? 1.15 :
               (lc === 'heavy')      ? 1.25 :
               (lc === 'standard')   ? 1.40 : 1.45;
    }
    // downed 처리: unconscious면 이동 불가, conscious면 crawl 속도
    let downedMul = 1.0;
    if (unit.isDowned) {
      if (!unit.conscious) downedMul = 0;
      else                 downedMul = getCrawlSpeedMul(unit);
    }
    // 자동 엄폐 중에는 target이 있어도 일반 moveSpeed 사용 — 교전이 아니라 회피
    const useFullSpeed = !!wp._autoCover;
    const baseSpeedSrc = (target && !useFullSpeed) ? unit.moveSpeedEngaged : unit.moveSpeed;
    const speed = baseSpeedSrc
                  * legsMul * painMoveMul * stopMul * knockMul * getLoadMoveMul(unit)
                  * pinnedMul * runMul * downedMul * dt;
    if (d <= Math.max(speed, 1.5)) {
      // 도착
      unit.x = wp.x; unit.y = wp.y;
      const wasAutoCover = !!wp._autoCover;
      // [HF1] gateway 명령의 마지막 waypoint 도착 → command 완료 처리(수류탄 회피면 플레이어 경로 자동 복구)
      const _wpCmdFinal = !!wp._aiCommandFinal;
      const _wpCmdId = wp._aiCommandId, _wpCmdAction = wp._aiActionType;
      // 마지막 wp 도착 시 _holdFacing 갱신:
      //   wp.facing이 지정돼 있으면 그 방향
      //   없으면 도착 시점의 현재 facing(=이동 방향)을 유지
      if (unit.movePath.length === 1) {
        // 자동 엄폐 도착 — threatDirection이 있으면 그 방향 경계
        if (wasAutoCover && unit.threatDirection != null) {
          unit._holdFacing = unit.threatDirection;
        } else {
          unit._holdFacing = (wp.facing != null) ? wp.facing : unit.facing;
        }
      }
      unit.movePath.shift();
      // _approachMedic 플래그면 도착 시 자동 응급처치 메뉴
      if (wp._approachMedic != null) {
        const tgt = unitById(wp._approachMedic);
        if (tgt && tgt.isDowned && !tgt.isDead) openMedicOverlay(unit.id, tgt.id);
      }
      // _investigateNoise 플래그면 search 단계 시작
      if (wp._investigateNoise) {
        unit._justArrivedFromInvestigate = true;
        unit.aiIntent = 'searchNoise';
      }
      // 자동 엄폐 도착 + 백업된 플레이어 경로 있음 → 복귀 (친군 전용)
      if (_wpCmdFinal) {
        const _st = ensureAICommandState(unit);
        if (_st && _st.current && _st.current.commandId === _wpCmdId) {
          completeAICommand(unit, { reason: (_wpCmdAction || 'command') + '_arrived' });
        }
      }
      if (wasAutoCover && unit.team === 'friend' && restorePlayerCommand(unit)) {
        unit.aiIntent = 'none';
        log(`[${unit.name}] 원래 경로로 복귀`, 'info');
      } else if (wasAutoCover) {
        unit.aiIntent = 'none';
      }
    } else {
      const ux = dx / d, uy = dy / d;
      // 끌고 있으면 속도 큰 감소 (50%)
      let dragMul = 1.0;
      if (unit.draggingTarget != null) dragMul = 0.50;
      // === stance 기반 이동 속도 ===
      const stanceMul = (typeof getStanceMoveMul === 'function') ? getStanceMoveMul(unit) : 1.0;
      const medMul = (unit.medical && unit.medical.moveMul != null) ? unit.medical.moveMul : 1.0;
      const nx = unit.x + ux * speed * dragMul * stanceMul * medMul, ny = unit.y + uy * speed * dragMul * stanceMul * medMul;
      const _hitDoor = pointInWalls(nx, ny, UNIT_RADIUS - 3)
        ? closedDoorAt(nx, ny, UNIT_RADIUS - 3) : null;
      if (_hitDoor && !_planPointInWalls(nx, ny, UNIT_RADIUS - 3)) {
        // 막은 게 닫힌 문뿐이다 — 경로를 버리지 않고 그 앞에 서서 연다
        setPendingDoor(unit, _hitDoor);
      } else if (pointInWalls(nx, ny, UNIT_RADIUS - 3)
                 && _trySlideAlongWall(unit, ux, uy, speed * dragMul * stanceMul * medMul)) {
        // 벽을 따라 미끄러졌다 — 접촉은 기억에 남기되 **경로는 버리지 않는다.**
        //   부딪혔다고 매번 경로를 통째로 포기하는 건 너무 거칠다.
        //   다만 미끄러지는 내내 매 프레임 심지는 않는다 — 같은 벽을 문지르는 것뿐이라
        //   기록할 새 사실이 없다. 자리를 옮겼거나 시간이 지났을 때만 남긴다.
        if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
            && typeof SpatialPerception !== 'undefined') {
          const _lc = unit._lastSlideContact;
          const _far = !_lc || Math.hypot(nx - _lc.x, ny - _lc.y) > mToPx(0.5)
                     || (GAME.gameTime - _lc.t) > 0.5;
          if (_far) {
            try { SpatialPerception.recordContact(unit, nx, ny, ux, uy); } catch (e) {}
            unit._lastSlideContact = { x: nx, y: ny, t: GAME.gameTime };
          }
        }
      } else if (pointInWalls(nx, ny, UNIT_RADIUS - 3)) {
        log(`[${unit.name}] 벽에 막힘. 경로 종료.`, 'warn');
        // 접촉도 감각이다 — 안 보고 계획했다가 부딪힌 벽을 믿음에 남긴다.
        //   남기지 않으면 같은 경로를 영원히 다시 계획한다(freespace assumption의 대가).
        if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
            && typeof SpatialPerception !== 'undefined') {
          try { SpatialPerception.recordContact(unit, nx, ny, ux, uy); } catch (e) {}
          // 연속 실패가 쌓이면 그 목표를 잠시 접는다 — 제자리 재계획 폭주 방지
          unit._pathBlockedRun = (unit._pathBlockedRun || 0) + 1;
          unit._pathBlockedAt = GAME.gameTime || 0;
          if (unit._pathBlockedRun >= 3) {
            unit.aiGoalCooldownUntil = (GAME.gameTime || 0) + 2.5;
            unit._pathBlockedRun = 0;
          }
        }
        unit.movePath = [];
        // [HF1] 비정상 종료도 gateway 명령 완료로 처리 — 중단된 플레이어 경로가 고아로 남지 않게 한다.
        //   (gateway snapshot은 aiCommandState.suspended가 보유하므로 legacy mirror만 정리한다)
        if (unit.aiCommandState && unit.aiCommandState.current) {
          completeAICommand(unit, { reason: 'path_blocked' });
        } else {
          unit._playerPathBackup = null;
        }
      } else {
        const oldX = unit.x, oldY = unit.y;
        if (unit._pathBlockedRun) unit._pathBlockedRun = 0;   // 한 발이라도 나아갔으면 연속 실패가 아니다
        unit.x = nx; unit.y = ny;
        // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 이동 먼지 (먼지 잘 나는 바닥 + 하중 비례)
        if (typeof _maybeEmitMovementDust === 'function') _maybeEmitMovementDust(unit, oldX, oldY, nx, ny);
        // 끌고 있는 대상 함께 이동 — 같은 변위 적용
        if (unit.draggingTarget != null) {
          const tgt = unitById(unit.draggingTarget);
          if (tgt && !tgt.isDead) {
            const tnx = tgt.x + (nx - oldX), tny = tgt.y + (ny - oldY);
            if (!pointInWalls(tnx, tny, UNIT_RADIUS - 3)) {
              tgt.x = tnx; tgt.y = tny;
            }
          } else {
            stopDragging(unit);
          }
        }
      }
    }
  }

  // stance — 우선순위: dead/downed > stanceTransition > forcedProneTimer > _proneReason(prone) > 자동 계산
  if (unit.isDead) {
    unit.stance = 'prone';
  } else if (unit.isDowned) {
    unit.stance = 'prone';
  } else if (unit.stanceTransition) {
    // stanceTransition이 진행 중 — tickStanceTransition이 stance 관리
    // 여기서는 덮어쓰지 않음
  } else if (unit.forcedProneTimer > 0) {
    unit.stance = 'prone';
  } else if (getAcuteActionBlockState(unit).forcesProne) {
    unit.stance = 'prone';   // [0.39.5 §4] canonical gate forcesProne (movePath보다 우선, 직접 timer 판정 제거)
  } else if (unit.stance === 'prone' && unit._proneReason) {
    // 수류탄/utility prone — 명시적 reason이 있으면 유지
    // (exitProne에서만 standing/crouched 전환)
  } else {
    unit.stance = unit.pinned ? 'pinned' :
                  (unit.movePath.length > 0 ? 'moving' :
                  (target ? 'crouched' : 'standing'));
  }

  // === 발소리 emit ===
  //   이동 중인 유닛은 일정 간격으로 noise 발생.
  //   dead/unconscious는 발생 X.
  //   끌리는 대상(draggedBy 있음)은 별도 발소리 없음 (carrier의 footstep_drag로 처리).
  if (!unit.isDead && !(unit.isDowned && !unit.conscious) && unit.draggedBy == null) {
    unit.footstepTimer -= dt;
    let isMoving = false;
    let stepType = 'footstep_walk';
    let baseInterval = 0.55;
    if (unit.draggingTarget != null && unit.movePath && unit.movePath.length > 0) {
      isMoving = true;
      stepType = 'footstep_drag';
      baseInterval = 0.45;
    } else if (unit.movePath && unit.movePath.length > 0) {
      const wp = unit.movePath[0];
      if (unit.isDowned && unit.conscious) {
        isMoving = true;
        stepType = 'footstep_crawl';
        baseInterval = 1.20;
      } else if (wp._run) {
        isMoving = true;
        stepType = 'footstep_run';
        baseInterval = 0.32;
      } else {
        isMoving = true;
        stepType = 'footstep_walk';
        baseInterval = 0.55;
      }
    }
    if (isMoving && unit.footstepTimer <= 0) {
      // 장비 무게 보정
      const lc = unit.loadClass || 'standard';
      let loadMul = 1.0;
      if (lc === 'light') loadMul = 0.85;
      else if (lc === 'heavy') loadMul = 1.15;
      else if (lc === 'overloaded') loadMul = 1.30;
      const prof = NOISE_TYPE_PROFILE[stepType];
      const loudness = (prof?prof.loudness:0.2) * loadMul;
      const radius   = (prof?prof.radius:120) * loadMul;
      emitNoise(unit.x, unit.y, {
        type: stepType,
        loudness, radius,
        team: unit.team,
        sourceUnitId: unit.id,
      });
      unit.footstepTimer = baseInterval;
    } else if (!isMoving && unit.footstepTimer < 0) {
      unit.footstepTimer = 0;
    }
  }

  // 소음 기억 decay
  tickLastHeardNoise(unit, dt);

  // AI 상태 머신 tick
  tickAiStateMachine(unit, dt);
}

// 견제사격 — 보이는 적은 없지만 lastKnown이 충분히 신뢰할만할 때 낮은 빈도로 사격
// =============================================================
// 자동 엄폐 보조 AI
// =============================================================
//   findNearbyCover(unit, threatDir): 위협 방향 기준 가까운 엄폐 후보 위치
//   scoreCoverPosition: 위치의 안전도 점수 (낮을수록 좋음)
//   tryAutoSeekCover: 트리거 발생 시 엄폐 시도 (movePath에 임시 wp 삽입)
const COVER_SEARCH_RADIUS = 280;   // ~14m
const COVER_MIN_GAIN      = 0.45;  // 현재 위치보다 이만큼 더 안전해야 이동

function isCoverBetweenPoints(coverObj, fromX, fromY, toX, toY) {
  // 점-segment vs AABB 교차 — 직선이 cover 박스를 지나는지
  const minx = Math.min(fromX, toX), maxx = Math.max(fromX, toX);
  const miny = Math.min(fromY, toY), maxy = Math.max(fromY, toY);
  if (maxx < coverObj.x || minx > coverObj.x + coverObj.w) return false;
  if (maxy < coverObj.y || miny > coverObj.y + coverObj.h) return false;
  return true;
}

// 위치 점수 — threatPos에서 보면 가려질수록 좋음 (낮은 점수가 안전)
function scoreCoverPosition(x, y, threatX, threatY) {
  // 1) 위협까지 가시선이 cover/벽에 막히면 매우 안전 (큰 마이너스 보너스)
  let safe = 1.0;
  // 벽 — 완전 불투과
  if (MAP_DATA.walls) {
    for (const w of MAP_DATA.walls) {
      if (isCoverBetweenPoints(w, x, y, threatX, threatY)) {
        safe -= 0.95;   // 벽은 거의 완벽한 차폐
        break;
      }
    }
  }
  // cover 객체 — armor에 비례
  if (safe > 0.05 && MAP_DATA.coverObjects) {
    for (const c of MAP_DATA.coverObjects) {
      if (isCoverBetweenPoints(c, x, y, threatX, threatY)) {
        safe -= Math.min(0.85, (c.armor || 10) / 50);
        break;
      }
    }
  }
  // 2) 위협까지 거리 — 멀수록 약간 더 안전
  const dToThreat = Math.hypot(threatX - x, threatY - y);
  safe -= Math.min(0.20, dToThreat / 1500);
  return Math.max(0, safe);
}

// 위협 방향(라디안)을 받아 후보 위치들을 만들고 가장 안전한 위치 반환
//   1차: coverObjects 외곽 후보 + walls의 코너 근처 후보
//   도달 가능한(직선 또는 A* 우회) 후보만 평가.
function findNearbyCover(unit, threatDir) {
  if (threatDir == null) return null;
  const threatX = unit.x + Math.cos(threatDir) * 160;
  const threatY = unit.y + Math.sin(threatDir) * 160;
  const curScore = scoreCoverPosition(unit.x, unit.y, threatX, threatY);

  // 두 단계: (1) 직선 도달 가능 후보, (2) 그것도 없으면 A* 도달 가능 후보
  const directCands = [];   // {x, y, src, score}
  const blockedCands = [];  // 직선 막혔지만 위치 자체는 유효

  function evalCandidate(candX, candY, srcRef) {
    if (!pointInMap(candX, candY, 0)) return;
    if (pointInWalls(candX, candY, UNIT_RADIUS - 2)) return;
    const distFromUnit = Math.hypot(candX - unit.x, candY - unit.y);
    if (distFromUnit > COVER_SEARCH_RADIUS) return;
    const sc = scoreCoverPosition(candX, candY, threatX, threatY);
    if (sc >= curScore - COVER_MIN_GAIN) return;   // 현재보다 충분히 안전 X
    const cand = { x: candX, y: candY, src: srcRef, score: sc, d: distFromUnit };
    // 직선 도달 가능 여부
    if (hasLineOfWalkClear(unit.x, unit.y, candX, candY)) directCands.push(cand);
    else                                                  blockedCands.push(cand);
  }

  // 1) coverObjects 외곽 후보
  if (MAP_DATA.coverObjects) {
    for (const c of MAP_DATA.coverObjects) {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      if (Math.hypot(cx - unit.x, cy - unit.y) > COVER_SEARCH_RADIUS) continue;
      const dirCx = cx - threatX, dirCy = cy - threatY;
      const dn = Math.hypot(dirCx, dirCy) || 1;
      const off = Math.max(c.w, c.h) * 0.7 + UNIT_RADIUS + 6;
      evalCandidate(cx + (dirCx / dn) * off, cy + (dirCy / dn) * off, c);
    }
  }
  // 2) walls 코너 + 위협 반대편 면 + 면을 따라 샘플
  if (MAP_DATA.walls) {
    const PAD = UNIT_RADIUS + 8;
    for (const w of MAP_DATA.walls) {
      const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      if (Math.hypot(cx - unit.x, cy - unit.y) > COVER_SEARCH_RADIUS + Math.max(w.w, w.h)) continue;
      // 4 코너
      const corners = [
        { x: w.x - PAD,         y: w.y - PAD         },
        { x: w.x + w.w + PAD,   y: w.y - PAD         },
        { x: w.x - PAD,         y: w.y + w.h + PAD   },
        { x: w.x + w.w + PAD,   y: w.y + w.h + PAD   },
      ];
      for (const c of corners) evalCandidate(c.x, c.y, w);
      // 위협 반대편 면 — 면 중앙 + 면을 따라 양 끝쪽 샘플
      const dirCx = cx - threatX, dirCy = cy - threatY;
      const dn = Math.hypot(dirCx, dirCy) || 1;
      const ndx = dirCx / dn, ndy = dirCy / dn;
      const off = Math.max(w.w, w.h) * 0.55 + PAD;
      evalCandidate(cx + ndx * off, cy + ndy * off, w);
      // 긴 벽의 면을 따라 2~3점 더 샘플 — 좁은 통로 입구 등
      if (w.w >= 80 || w.h >= 80) {
        // 벽 면 따라 직각 방향 (가로벽이면 좌우, 세로벽이면 상하)
        if (w.w > w.h) {
          evalCandidate(w.x + w.w * 0.25, cy + ndy * (w.h * 0.5 + PAD), w);
          evalCandidate(w.x + w.w * 0.75, cy + ndy * (w.h * 0.5 + PAD), w);
        } else {
          evalCandidate(cx + ndx * (w.w * 0.5 + PAD), w.y + w.h * 0.25, w);
          evalCandidate(cx + ndx * (w.w * 0.5 + PAD), w.y + w.h * 0.75, w);
        }
      }
    }
  }

  // 직선 도달 가능한 후보 중 가장 안전한 것 우선
  if (directCands.length > 0) {
    directCands.sort((a, b) => a.score - b.score);
    const best = directCands[0];
    return { x: best.x, y: best.y, src: best.src, score: best.score, path: null };
  }
  // 직선 후보 없으면 — 가장 안전한 blocked 후보에 대해 A* 시도 (최대 3개)
  if (blockedCands.length > 0) {
    blockedCands.sort((a, b) => a.score - b.score);
    const tryN = Math.min(3, blockedCands.length);
    for (let i = 0; i < tryN; i++) {
      const cand = blockedCands[i];
      const path = findPath(unit.x, unit.y, cand.x, cand.y, unit);
      if (path && path.length >= 2) {
        return { x: cand.x, y: cand.y, src: cand.src, score: cand.score, path: path };
      }
    }
  }
  return null;
}

// 자동 엄폐 시도 — friend는 강한 위협 시에만, enemy는 빈번하게
// 현재 위치가 위협 방향으로 노출되어 있는지
function isExposedToThreat(unit) {
  if (unit.threatDirection == null) return false;
  const tx = unit.x + Math.cos(unit.threatDirection) * 160;
  const ty = unit.y + Math.sin(unit.threatDirection) * 160;
  // 0.55 이상이면 노출 — 벽/cover로 가려져 있지 않음
  return scoreCoverPosition(unit.x, unit.y, tx, ty) >= 0.55;
}

function tryAutoSeekCover(unit) {
  if (unit.isDead || unit.isDowned) return false;
  if (unit._aiCoverTimer > 0) return false;
  const threatDir = unit.threatDirection;
  if (threatDir == null) return false;
  if (unit.aiIntent === 'seekCover' && unit.movePath.length > 0) return false;
  const cover = findNearbyCover(unit, threatDir);
  if (!cover) {
    unit._aiCoverTimer = 1.5;
    // 디버그 — 가끔만 로그 (스팸 방지)
    if (GAME.debugCover && unit.team === 'enemy' && Math.random() < 0.10) {
      log(`[${unit.name}] 엄폐 후보 없음 (탐색 반경 내)`, 'warn');
    }
    return false;
  }
  const canRun = !unit.isDowned &&
                 (!unit.bodyHp || unit.bodyHp.legs > 40) &&
                 (unit.pain < 70);
  // 경로 결정 — 직선이면 wp 1개, A* 우회면 path 그대로 wp 리스트
  let newPath;
  if (cover.path && cover.path.length >= 2) {
    // path[0]은 시작점 — 제외하고 나머지를 wp로
    newPath = [];
    for (let i = 1; i < cover.path.length; i++) {
      newPath.push({
        x: cover.path[i].x, y: cover.path[i].y,
        facing: null, _autoCover: true,
        _run: canRun,   // 모든 leg에서 run — 회피 중에는 계속 빠르게 이동
      });
    }
  } else {
    newPath = [{ x: cover.x, y: cover.y, facing: null, _autoCover: true, _run: canRun }];
  }
  // [AI0-A] 구형 자동엄폐도 gateway를 경유한다(행동 보존 — legacy_behavior source).
  //   friend의 플레이어 명령은 gateway suspend snapshot으로 보존된다.
  if (unit.team === 'friend' && unit.movePath.length > 0) {
    suspendPlayerCommand(unit, 'legacy_auto_cover');
  }
  const _lacRes = issueAICommand(unit, {
    type: 'move', source: 'legacy_behavior', actionType: 'legacyAutoCover',
    targetX: cover.x, targetY: cover.y, path: newPath, reason: 'legacy_auto_cover',
  });
  if (!_lacRes.accepted) { unit._aiCoverTimer = 1.0; return false; }
  unit.aiIntent = 'seekCover';
  unit._aiCoverTarget = cover;
  unit._aiCoverTimer = 3.5;
  unit._lastCoverScore = cover.score;
  const detourTag = (cover.path && cover.path.length > 2) ? ' (우회)' : '';
  if (unit.team === 'friend') log(`[${unit.name}] 자동 엄폐${canRun ? ' (질주)' : ''}${detourTag}`, 'info');
  else                         log(`[${unit.name}] ${unit.pinned ? '제압된 채 ' : ''}엄폐 이동${canRun ? ' (질주)' : ''}${detourTag}`, 'info');
  return true;
}

// =============================================================
// 엄호 아래 이동 — coverMate를 겨누기에서 누르기로
// =============================================================
//   `coverMate`는 동료가 맡은 문을 **바라보기만** 했다. 바라보는 것은 엄호가 아니다.
//   실제로 그 구역에 탄을 넣어야 제압이 생기고, 제압은 이미 탄착군·판단 품질·
//   소음 감지에 전부 걸려 있어서 효과가 그대로 따라온다.
//
//   벽에 쏘는 게 제압을 만드나 — 만든다. `applySpecialAmmoEffects`가
//   (1) 탄도 근처 ~1.9 m 통과 제압, (2) 벽/엄폐물 탄착 주변 3 m 제압을 이미 준다.
//   표적 유닛이 없어도 둘 다 돈다. 그래서 좌표 사격으로 충분하다.
//
//   안전은 두 겹이다. `fireWeapon`의 기존 crossfire 게이트는 저숙련이면 통과시키지만,
//   엄호사격은 **미는 동료를 향해 쏘는 일**이라 여기서 tier 무관 hard gate를 건다.
