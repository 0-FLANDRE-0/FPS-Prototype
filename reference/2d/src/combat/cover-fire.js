const USE_COVER_FIRE = true;
function isCoverFireOn() {
  if (typeof GAME !== 'undefined' && GAME.coverFireOn != null) return !!GAME.coverFireOn;
  return USE_COVER_FIRE;
}
const COVERFIRE_INTERVAL = 1.7;      // 초 — 묶음 사이 간격. 견제사격(2.5초)보다 짧다: 동료가 건너는 중이다
const COVERFIRE_MAX_M    = 22.0;     // 이보다 멀면 엄호가 아니라 낭비
const COVERFIRE_MIN_M    = 2.5;      // 코앞에 쏘지 않는다 (도탄/파편)
const COVERFIRE_AMMO_MIN = 10;       // 이보다 적으면 아껴 둔다 (진짜 적이 나올 때를 위해)
const COVERFIRE_SIDE_M   = [0, 0.9, -0.9, 1.8, -1.8];   // 동료를 피해 옆으로 밀어 보는 조준 후보
// 견제사격은 0.45를 요구한다. 엄호는 그보다 약한 정보로도 누른다 — 동료가 지금 건너고 있기 때문이다.
const COVERFIRE_CONF_MIN = 0.35;
const COVERFIRE_UNC_MAX  = 120;      // px — 이보다 넓은 구역 추정이면 누를 지점이 없는 것과 같다
// 내가 엄호 중인 동료 — 지금도 실제로 움직이고 있어야 한다.
//   서 있는 동료를 엄호한다며 탄을 쓰는 건 낭비다. 엄호는 **이동에 붙는다.**
function coverFireMate(unit, roster) {
  const id = unit.aiAction && unit.aiAction.coverForId;
  if (!id) return null;
  const list = roster || ((typeof UNITS !== 'undefined' && Array.isArray(UNITS)) ? UNITS : (GAME.units || []));
  for (const m of list) {
    if (m.id !== id) continue;
    if (!m.alive || m.isDowned) return null;
    return (m.movePath && m.movePath.length > 0) ? m : null;
  }
  return null;
}
// 한 프레임의 엄호사격 시도. 실제로 쐈으면 true — 호출자는 견제사격을 건너뛴다.
//   왜 안 쐈나 — 기회가 어디서 죽는지 세어 둔다. 첫 결과가 8회 22발이라
//   결과 비교로는 아무것도 못 본다. 먼저 용량을 봐야 한다.
function _cfWhy(r) { const w = (GAME._coverFireWhy = GAME._coverFireWhy || {}); w[r] = (w[r] || 0) + 1; }
// 연막이 핀 문을 지키는 방어자는 **그 안으로 쏜다.**
//   경보를 `guardEntry`에만 걸었더니 방어자가 오히려 굳었다 — guardEntry 35%→50%,
//   engageEnemy·clearUnknownRoom은 목록에서 사라졌다. 서서 보는 행동에 알람을 건 탓이다.
//   내 문 앞에 연막이 피면 쳐다보는 게 아니라 쏠 준비를 하는 것이다.
const SMOKE_ALERT_FIRE_FRESH = 1.5;   // 초 — 이보다 오래된 경보로는 안 쏜다
function smokeAlertAimFor(unit) {
  if (!isSmokeAlertOn()) return null;
  const m = unit && unit._smokeAlertAim;
  if (!m) return null;
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  return (now - m.t <= SMOKE_ALERT_FIRE_FRESH) ? m : null;
}
function tickCoverFire(unit, roster) {
  if (!isCoverFireOn()) return false;
  const a = unit.aiAction;
  if (!a) return false;
  //   두 갈래가 같은 좌표 사격 기계를 쓴다: 동료를 엄호하거나, 연막 핀 내 문을 누르거나.
  const alertAim = (a.type === 'guardEntry') ? smokeAlertAimFor(unit) : null;
  if (!alertAim && (a.type !== 'coverMate' || a.targetX == null)) return false;
  if (unit.role === 'passive' || unit.pinned) { _cfWhy('pinned'); return false; }
  if ((unit._coverFireTimer || 0) > 0) { _cfWhy('interval'); return false; }
  if (unit.movePath.length > 0) { _cfWhy('self_moving'); return false; }   // 엄호는 자리를 지키는 쪽이다
  if (unit.magAmmo < COVERFIRE_AMMO_MIN) { _cfWhy('ammo'); return false; }
  //   엄호는 **움직이는 동료**가 전제다. 연막 경보는 그 전제가 없다 — 연막 자체가 신호다.
  if (!alertAim) {
    const mate = coverFireMate(unit, roster);
    if (!mate) { _cfWhy('mate_still'); return false; }  // 아무도 안 움직이면 엄호할 이동이 없다
  }
  if (!canFireWeapon(unit)) { _cfWhy('cant_fire'); return false; }

  const w0 = WEAPONS[unit.weaponId];
  if (!w0) { _cfWhy('no_weapon'); return false; }

  // === 어디를 누르나 — 문이 아니라 **내가 적이 있다고 믿는 자리**다 ===
  //   동료가 맡은 문을 겨눴을 때: 21발 중 조준점 4 m 안에 살아있는 적이 있었던 건 **0발**.
  //   당연하다. 그 문은 **미확인** 방의 문이고, 안에 누가 있다고 믿었다면 동료는
  //   클리어가 아니라 교전을 하고 있을 것이다. 구조적으로 빈 방을 겨누고 있었다.
  //   반대로 엄호자 자신의 위협 기억은 60건 중 60건이 진짜 적 4 m 안이었다.
  //   그래서 **누를 대상이 없으면 쏘지 않는다.** 빈 문에 쏘는 건 탄약과 총성만 쓴다.
  //   연막 경보는 위협 기억을 요구하지 않는다 — **연막이 곧 근거**다.
  const best = alertAim ? { x: alertAim.x, y: alertAim.y, confidence: 1, uncertaintyRadius: 0 }
                        : ((typeof getBestThreatMemory === 'function') ? getBestThreatMemory(unit) : null);
  if (!best || (best.confidence || 0) < COVERFIRE_CONF_MIN) { _cfWhy('no_belief'); return false; }
  if ((best.uncertaintyRadius || 0) > COVERFIRE_UNC_MAX) { _cfWhy('too_vague'); return false; }
  if (!alertAim && typeof buildEnemyMemoryContext === 'function') {
    const mc = buildEnemyMemoryContext(unit, best).memoryClass;
    if (mc === 'INVALID' || mc === 'STALE_SUSPICION') { _cfWhy('stale'); return false; }
  }
  const d0 = dist(unit.x, unit.y, best.x, best.y);
  if (d0 < COVERFIRE_MIN_M * PX_PER_M_FALLBACK) { _cfWhy('too_close'); return false; }
  if (d0 > COVERFIRE_MAX_M * PX_PER_M_FALLBACK || d0 > w0.range) { _cfWhy('too_far'); return false; }
  const nx = (best.x - unit.x) / Math.max(1, d0), ny = (best.y - unit.y) / Math.max(1, d0);
  const bx = best.x, by = best.y;

  // 동료가 사선을 가로지른다 — 문을 겨눴을 때는 기하적으로 거의 항상 막혔다(11발 대 56차단).
  //   믿는 자리로 옮겨도 같은 위험이 남으므로, 동료가 없는 쪽으로 조준점을 밀어 본다.
  //   탄착 주변 3 m 제압이 따라오므로 옆을 때려도 그 자리는 눌린다.
  let aimX = null, aimY = null, sawLOS = false, usedOff = 0;
  for (const off of COVERFIRE_SIDE_M) {
    const cx = bx + (-ny) * off * PX_PER_M_FALLBACK, cy = by + nx * off * PX_PER_M_FALLBACK;
    // 그쪽이 실제로 보여야 한다 — 벽을 보고 쏘는 건 소음일 뿐이다
    if (typeof isLOSBlockedForBlast === 'function'
        && isLOSBlockedForBlast(unit.x, unit.y, cx, cy)) continue;
    sawLOS = true;
    // 사선 안전 — tier 무관 hard gate. caution도 쏘지 않는다.
    const safety = evaluateLineOfFireSafety(unit, { x: cx, y: cy },
                                            { shooter: unit, fireIntent: 'SUPPRESSIVE_FIRE' }, 'burst');
    if (safety.status !== 'clear') continue;
    aimX = cx; aimY = cy; usedOff = off; break;
  }
  if (aimX == null) {
    GAME._coverFireBlocked = (GAME._coverFireBlocked || 0) + 1;
    _cfWhy(sawLOS ? 'lof' : 'no_los');                 // 사선에 동료냐, 애초에 안 보이느냐 — 다른 문제다
    unit._coverFireTimer = 0.3;                        // 동료가 지나가길 기다린다
    return false;
  }
  // 총구 정렬 — 안 맞으면 돌리고 다음 프레임에 다시
  const gate = canFireAtMemoryPoint(unit, aimX, aimY, { fireIntent: 'SUPPRESSIVE_FIRE' });
  if (!gate.ready) {
    updatePreferredWatchAngleFromMemory(unit, aimX, aimY);
    _cfWhy('turning');
    unit._coverFireTimer = 0.2;
    return false;
  }

  const fakeTarget = {
    x: aimX, y: aimY,
    alive: true, stance: 'standing',
    name: '엄호', team: (unit.team === 'friend' ? 'enemy' : 'friend'),
    suppression: 0, maxHp: 100, hp: 100,
    bodyArmorId: null, helmetId: null,
    movePath: [], role: 'passive',
    _fcSource: 'suppressive',
  };
  const mag0 = unit.magAmmo;
  fireWeapon(unit, fakeTarget);
  if (unit.magAmmo === mag0) { _cfWhy('fire_refused'); return false; }   // 발사가 막혔다 — 견제사격에 양보
  _cfWhy(alertAim ? 'fired_alert' : 'fired');
  if (alertAim) GAME._smokeAlertShots = (GAME._smokeAlertShots || 0) + 1;
  // 측정용 — 거기에 누가 있었나. 정답 기하를 쓴다(AI 판단이 아니라 사후 채점이다).
  //   섬광에서 배운 것: 조준점이 사람 근처가 아니면 값이 안 나온다.
  if (GAME.coverFireLogOn) {
    // 조준점에서 **가장 가까운 진짜 적까지의 거리**를 남긴다. "4 m 안"은 너무 후한 채점이었다 —
    // 실제 제압 반경은 탄도 통과 1.19 m(NEAR_MISS_RADIUS 38px), 탄착 주변 3 m다.
    let near = Infinity, seen = false;
    for (const u of UNITS) {
      if (!u.alive || u.isDowned || u.team === unit.team) continue;
      const dd = Math.hypot(u.x - aimX, u.y - aimY);
      if (dd < near) {
        near = dd;
        seen = (typeof isLOSBlockedForBlast !== 'function') || !isLOSBlockedForBlast(aimX, aimY, u.x, u.y);
      }
    }
    (GAME._coverFireLog = GAME._coverFireLog || []).push({
      t: GAME.gameTime || 0, seen,
      nearM: (near === Infinity ? -1 : near / PX_PER_M_FALLBACK),
      offM: usedOff, dM: d0 / PX_PER_M_FALLBACK,
      uncM: (best.uncertaintyRadius || 0) / PX_PER_M_FALLBACK,
    });
  }
  unit._coverFireTimer = COVERFIRE_INTERVAL + Math.random() * 0.6;
  GAME._coverFireShots = (GAME._coverFireShots || 0) + 1;
  return true;
}

function maybeSuppressingFire(unit) {
  if (unit.role === 'passive') return;   // 사격장 표적은 견제사격도 안 함
  if (unit.pinned) return;
  if (unit._suppressFireTimer > 0) return;
  if (!canFireWeapon(unit)) return;
  if (unit.movePath.length > 0) return;   // 이동 중에는 견제사격 X (집중력)

  const best = getBestThreatMemory(unit);
  if (!best || best.confidence < SUPPRESS_CONFIDENCE_MIN) return;
  const memCtx = buildEnemyMemoryContext(unit, best);
  // SIDE-MEMORY-1A: INVALID/STALE는 견제보다 holdAngle/investigate가 어울림 — 사격 보류
  if (memCtx.memoryClass === 'INVALID' || memCtx.memoryClass === 'STALE_SUSPICION') return;
  // 너무 불확실한 기억(넓은 구역)이면 사격 보류
  if ((best.uncertaintyRadius || 0) > 120) return;

  // 사거리 안인지
  const w0 = WEAPONS[unit.weaponId];
  if (!w0) return;
  const dst = dist(unit.x, unit.y, best.x, best.y);
  if (dst > w0.range) return;

  // SIDE-MEMORY-1A §5/§6: 예상 위치 후보 생성 → EXPECTED vs LAST_KNOWN 결정.
  //   regular 이상 + velocity 있음 + PRECISE/AREA + crossfire 여지 → shortLead(EXPECTED) 가능.
  //   recruit/저숙련은 거의 EXPECTED 안 씀.
  const now = GAME.gameTime || 0;
  const pts = buildPredictedEnemyPoints(unit, best);
  const canExpected = _fcIsRegularPlus(unit) && memCtx.hasVelocity
                   && (memCtx.memoryClass === 'PRECISE_RECENT' || memCtx.memoryClass === 'AREA_SUSPECTED');
  const lead = pts.find(p => p.kind === 'shortLead');
  let aimX, aimY, fcSource, fcExpectedLead = 0;
  if (canExpected && lead && Math.random() < 0.5) {
    aimX = lead.x; aimY = lead.y; fcSource = 'expected'; fcExpectedLead = _memLeadTime(unit);
  } else {
    // lastKnown 주변 분산 (burst 묶음 내 같은 오프셋 시드 재사용)
    const unc = best.uncertaintyRadius || 8;
    if (!unit._lkOffset || unit._lkOffsetId !== best.id || (now - (unit._lkOffsetT || 0)) > 0.8) {
      const ang = Math.random() * Math.PI * 2;
      const r = unc * (0.3 + Math.random() * 0.7);
      unit._lkOffset = { dx: Math.cos(ang) * r, dy: Math.sin(ang) * r };
      unit._lkOffsetId = best.id; unit._lkOffsetT = now;
    }
    aimX = best.x + unit._lkOffset.dx; aimY = best.y + unit._lkOffset.dy; fcSource = 'lastKnown';
  }

  // === SIDE-FIRE-2A §5/§6/§7: barrier 기회 분류 — 사선에 얇은 벽이 있으면 probe/wallpen, 두꺼우면 보류 ===
  let barrierEst = null;
  const firstB = findFirstBarrierBetween(unit, aimX, aimY, { believed: true });
  if (firstB.hasBarrier) {
    // SIDE-FIRE-2A-HOTFIX-1: 실제 선택 탄종을 estimate에 반영 (w0._ammo는 이 시점 부정확할 수 있음)
    const rW = resolveAmmoForWeapon(unit, w0);
    barrierEst = estimateBarrierPenetrationFeasibility(unit, aimX, aimY, rW, (rW && rW._ammo) || w0._ammo, memCtx);
    const opp = classifyBarrierShotOpportunity(unit, memCtx, barrierEst);
    if (opp === 'no_shot') {
      // 두꺼운/비관통 벽 또는 저숙련 — 견제 보류, 각만 잡음
      updatePreferredWatchAngleFromMemory(unit, best.x, best.y);
      return;
    }
    if (opp === 'wall_penetration') { fcSource = 'wall_penetration'; aimX = best.x; aimY = best.y; }   // wallpen은 마지막 위치 직접
    else if (opp === 'barrier_probe') { fcSource = 'barrier_probe'; }
    // friendly behind barrier risk — 벽 너머 예상 cone에 같은 팀이 있으면 정규군 이상 보류
    if (_fcIsRegularPlus(unit)) {
      const dxb = aimX - unit.x, dyb = aimY - unit.y, ll = Math.max(1, Math.hypot(dxb, dyb));
      const bnx = dxb / ll, bny = dyb / ll;
      for (const f of UNITS) {
        if (f === unit || !f.alive || f.team !== unit.team) continue;
        const rel = (f.x - unit.x) * bnx + (f.y - unit.y) * bny;
        if (rel < (firstB.distanceToBarrier || 0)) continue;   // 벽 앞은 일반 crossfire가 처리
        const perp = Math.abs((f.x - unit.x) * (-bny) + (f.y - unit.y) * bnx);
        if (perp < (UNIT_RADIUS || 11) + 28 && rel < ll + 60) {   // 벽 뒤 cone
          updatePreferredWatchAngleFromMemory(unit, best.x, best.y);
          if (GAME.debugFireControl) log(`[FC] ${unit.name} 벽관통 보류 — 벽 뒤 아군 위험`, 'info');
          return;
        }
      }
    }
  }

  // === SIDE-FIRE-2A §3: Memory Fire Arc Gate — 총구가 대략 맞아야 발사 ===
  {
    const intentGuess = fcSource === 'expected' ? 'EXPECTED_POSITION_FIRE'
                      : fcSource === 'barrier_probe' ? 'BARRIER_PROBE_FIRE'
                      : fcSource === 'wall_penetration' ? 'WALL_PENETRATION_FIRE'
                      : 'LAST_KNOWN_FIRE';
    const gate = canFireAtMemoryPoint(unit, aimX, aimY, { fireIntent: intentGuess });
    if (!gate.ready) {
      // 총구 정렬 안 됨 — preferredWatchAngle만 갱신하고 이번 프레임 사격 보류 (turning)
      updatePreferredWatchAngleFromMemory(unit, aimX, aimY);
      unit._fcDebug = `FC: ${({EXPECTED_POSITION_FIRE:'EXPECTED',BARRIER_PROBE_FIRE:'PROBE',WALL_PENETRATION_FIRE:'WALLPEN',LAST_KNOWN_FIRE:'LASTKNOWN'})[intentGuess]} / TURNING / diff ${Math.round(gate.diff*180/Math.PI)}`;
      unit._suppressFireTimer = 0.25;   // 곧 다시 시도 (총구 회전 대기)
      return;
    }
  }

  // 발사 — 가짜 target으로 예상/마지막/벽관통 위치를 사용 (FC가 point target으로 인식)
  const fakeTarget = {
    x: aimX, y: aimY,
    alive: true, stance: 'standing',
    name: '?', team: (unit.team === 'friend' ? 'enemy' : 'friend'),
    suppression: 0, maxHp: 100, hp: 100,
    bodyArmorId: null, helmetId: null,
    _fcSource: fcSource,                   // 'lastKnown' | 'expected' | 'barrier_probe' | 'wall_penetration'
    _fcConfidence: best.confidence,
    _fcUncertainty: best.uncertaintyRadius,
    _fcAge: best.age,
    _fcMemoryClass: memCtx.memoryClass,
    _fcExpectedLead: fcExpectedLead,
    _fcBarrierEst: barrierEst,
  };
  // 견제사격은 명중률을 강제로 낮춤 — aimTimer 임시 감소 후 fireWeapon 호출
  const savedAim = unit.aimTimer;
  unit.aimTimer = Math.min(unit.aimTimer, 0.15);   // 임시로 낮은 조준 안정도
  fireWeapon(unit, fakeTarget);
  unit.aimTimer = Math.max(0, savedAim - 0.20);    // 사후 약간 깎기

  // probe/wallpen 결과를 barrierKnowledge에 짧게 반영 (실제 관통은 raycast가 결정)
  if (barrierEst && barrierEst.hasBarrier && (fcSource === 'barrier_probe' || fcSource === 'wall_penetration') && unit._lastShotRay) {
    const r = unit._lastShotRay;
    const evs = r.barrierEvents || [];
    // SIDE-FIRE-2A-HOTFIX-1: 해당 barrier(obj/id)와 일치하는 이벤트만 본다. outcome으로 성공/도탄/정지 분류.
    const bObj = barrierEst.barrierObj;
    const relevant = evs.filter(e => (bObj && e.obj === bObj) || (e.material === barrierEst.material));
    let outcome = null;
    for (const e of relevant) {
      const o = e.outcome || '';
      if (/penetrat|perforat|exit|through|pass/.test(o)) { outcome = 'penetrated'; break; }   // 관통 성공
      if (/ricochet|deflect/.test(o)) { outcome = 'ricochet'; }
      else if (/stop|block|absorb|shatter|hard_stop|no_penetration|half_hit/.test(o)) { if (outcome !== 'ricochet') outcome = 'stopped'; }
    }
    if (outcome) recordBarrierProbeResult(unit, barrierEst.barrierId, barrierEst.material, outcome);
  }

  unit._suppressFireTimer = SUPPRESS_FIRE_COOLDOWN + Math.random() * 1.0;
}

function updateFx(dt) {
  for (let i = GAME.fxList.length - 1; i >= 0; i--) {
    GAME.fxList[i].life -= dt;
    if (GAME.fxList[i].life <= 0) GAME.fxList.splice(i, 1);
  }
}
