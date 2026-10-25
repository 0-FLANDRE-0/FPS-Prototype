// SHOT TIMING — rateOfFire 기반 발사 간격 + 숙련도 SEMI 후속탄 텀
// =============================================================
//   shotDelay = 60 / rateOfFire (초). 모든 발사방식의 최소 발사 간격.
//   getSemiCooldown은 SEMI 후속탄 텀 — shotDelay에 무기 fireCooldown과
//   숙련도(reaction)를 약하게 곱한 값.
function getShotDelay(weapon) {
  const rpm = (weapon && weapon.rateOfFire) ? weapon.rateOfFire : 600;
  return 60 / Math.max(60, rpm);
}
// SEMI 후속탄 텀 — 숙련도가 높으면 더 짧지만, shotDelay 이하로 떨어지지 않는다.
function getSemiCooldown(weapon, shooter) {
  const minDelay = getShotDelay(weapon);
  // 무기의 fireCooldown은 "한 발 단위" SEMI 후속탄 베이스 — 보정 전 값
  const base = (weapon && weapon.fireCooldown) ? weapon.fireCooldown : 0.5;
  // 숙련도 — reaction이 높을수록 cooldown 짧아짐 (1/reaction)
  const reaction = (shooter && shooter.skill && shooter.skill.reaction) || 1.0;
  // medical.weaponHandlingMul — 팔 손상/통증/공황/아드레날린 과다로 무기 조작 저하
  const handlingMul = (shooter && shooter.medical && shooter.medical.weaponHandlingMul != null)
    ? Math.max(0.25, Math.min(1.15, shooter.medical.weaponHandlingMul)) : 1.0;
  // skill.reaction 0.85 → ×1.18, 1.20 → ×0.83
  const cooldown = base / Math.max(0.5, reaction * handlingMul);
  return Math.max(minDelay, cooldown);
}
// BURST/FULL의 전체 묶음 종료 후 회복 시간 — 다음 묶음이 너무 빨리 시작되지 않게.
function getBurstRecoveryTime(weapon, shooter) {
  return getSemiCooldown(weapon, shooter);
}

// fireWeapon — trigger를 한 번 당김.
//   SEMI: 즉시 1발 발사 후 fireTimer = SemiCooldown
//   BURST/FULL: shotQueue에 발수 예약. 큐가 매 프레임 shotDelay 간격으로 한 발씩 발사.
// ============================================================================
// SIDE-FIRE-1A: Fire Control Layer — Utility AI 아래, 발사 직전 중간 판단층
//   무엇을/어떻게 쏘는가 · 안전한가 · 산포/부위 보정 · 크로스파이어 차단
// ============================================================================
function _fcTier(u) { return (u && u.skill && u.skill.presetId) || 'regular'; }
function _fcIsRegularPlus(u) { const t = _fcTier(u); return t === 'regular' || t === 'veteran' || t === 'elite'; }
function _fcPanicState(u) {
  return !!(u && (u.panic || u.morale === 'panic' || (u.suppression || 0) >= 70));
}
function _fcSafetyOverrideChance(u, ctx) {
  const t = _fcTier(u);
  // HOTFIX-2 §3: 평상시 override 기본 0. recruit만 평상시에도 높게.
  const baseRecruit = 0.85;
  const sup = (u.suppression || 0) / 100;
  const panic = _fcPanicState(u);
  const strongSuppress = (u.suppression || 0) >= 60;
  const urgentClose = !!(ctx && ctx.descriptor && ctx.distance != null && ctx.distance < 90 && ctx.descriptor.type === 'unit');
  const downedSurvival = !!(u.isDowned);
  if (t === 'recruit') return Math.min(0.97, baseRecruit + sup * 0.1);
  // regular/veteran/elite — 트리거 조건(패닉/강한 제압/급박 근거리/downed)이 있을 때만 override
  const triggered = panic || strongSuppress || urgentClose || downedSurvival;
  if (!triggered) return 0;
  const cap = ({ regular: 0.30, veteran: 0.16, elite: 0.07 })[t] != null ? ({ regular: 0.30, veteran: 0.16, elite: 0.07 })[t] : 0.30;
  let chance = 0;
  if (panic) chance += cap * 0.7;
  if (strongSuppress) chance += cap * (0.4 + sup * 0.4);
  if (urgentClose) chance += cap * 0.5;
  if (downedSurvival) chance += cap * 0.8;
  return Math.min(cap, chance);
}
function canFireWithSafety(shooter, ctx) {
  if (!ctx) return true;
  const s = ctx.lineOfFireSafety;
  if (s !== 'blocked' && s !== 'caution') return true;
  if (!_fcIsRegularPlus(shooter)) return true;   // 저숙련/비정규 — 오사 감수하고 사격
  // HOTFIX-2 §2: 정규군급 이상은 caution/blocked 둘 다 기본 발사 보류
  const oc = _fcSafetyOverrideChance(shooter, ctx);
  if (oc > 0 && Math.random() < oc) { ctx.panicOverride = true; ctx.safetyOverride = true; return true; }
  return false;
}
function buildTargetDescriptor(shooter, target) {
  if (!target) return null;
  if (target._fcSource === 'manual') return { type:'manual', x:target.x, y:target.y, source:'manual', unit:null, isPointTarget:true, confidence:0.5 };
  if (target._fcSource === 'lastKnown') return { type:'lastKnown', x:target.x, y:target.y, source:'lastKnown', unit:null, isPointTarget:true, confidence:(target._fcConfidence != null ? target._fcConfidence : 0.3), uncertaintyRadius:(target._fcUncertainty || 0), age:(target._fcAge || 0), memoryClass:(target._fcMemoryClass || null) };
  if (target._fcSource === 'expected') return { type:'expected', x:target.x, y:target.y, source:'expected', unit:null, isPointTarget:true, confidence:(target._fcConfidence != null ? target._fcConfidence : 0.3), uncertaintyRadius:(target._fcUncertainty || 0), age:(target._fcAge || 0), memoryClass:(target._fcMemoryClass || null), expectedLead:(target._fcExpectedLead || 0) };
  if (target._fcSource === 'barrier_probe') return { type:'barrier_probe', x:target.x, y:target.y, source:'barrier_probe', unit:null, isPointTarget:true, confidence:(target._fcConfidence != null ? target._fcConfidence : 0.3), uncertaintyRadius:(target._fcUncertainty || 0), age:(target._fcAge || 0), barrierEstimate:(target._fcBarrierEst || null) };
  if (target._fcSource === 'wall_penetration') return { type:'wall_penetration', x:target.x, y:target.y, source:'wall_penetration', unit:null, isPointTarget:true, confidence:(target._fcConfidence != null ? target._fcConfidence : 0.3), uncertaintyRadius:(target._fcUncertainty || 0), age:(target._fcAge || 0), barrierEstimate:(target._fcBarrierEst || null) };
  // 엄호사격 — 아무도 안 보이는 구역에 쏜다. 표적이 없는 게 전제라 confidence가 가장 낮다.
  if (target._fcSource === 'suppressive') return { type:'suppressive', x:target.x, y:target.y, source:'suppressive', unit:null, isPointTarget:true, confidence:0.15, uncertaintyRadius:(target._fcUncertainty || 0), age:0, memoryClass:null };
  if (target.id) return { type:'unit', unit:target, x:target.x, y:target.y, source:'visible', confidence:(target._visibilityConfidence != null ? target._visibilityConfidence : 0.9), isPointTarget:false };
  // id 없는 fakeTarget — 좌표 표적
  return { type:'point', x:target.x, y:target.y, source:'manual', unit:null, isPointTarget:true, confidence:0.4 };
}
// 표적 각속도(횡이동) 보수적 추정 — 이전 프레임 표적 위치 대비
function _fcEstimateAngularSpeed(shooter, desc) {
  if (!desc || !desc.unit) return 0;
  const d = Math.max(20, dist(shooter.x, shooter.y, desc.x, desc.y));
  const lp = shooter._fcLastTargetPos;
  let angSpeed = 0;
  if (lp && lp.id === desc.unit.id) {
    const mvx = desc.x - lp.x, mvy = desc.y - lp.y;
    // LOS 수직 성분 (횡이동)
    const losx = (desc.x - shooter.x) / d, losy = (desc.y - shooter.y) / d;
    const perp = Math.abs(mvx * (-losy) + mvy * losx);
    angSpeed = perp / d;   // rad/frame 근사
  }
  shooter._fcLastTargetPos = { id: desc.unit.id, x: desc.x, y: desc.y };
  return angSpeed;
}
function buildFireControlContext(shooter, target, opts) {
  opts = opts || {};
  const desc = buildTargetDescriptor(shooter, target);
  if (!desc) return null;
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  const tid = desc.unit ? ('u:' + desc.unit.id) : ('pt:' + Math.round(desc.x) + ',' + Math.round(desc.y));
  if (shooter._fcTargetLockId !== tid) { shooter._fcTargetLockId = tid; shooter._fcTargetFirstSeenAt = now; }
  const targetLockTime = Math.max(0, now - (shooter._fcTargetFirstSeenAt != null ? shooter._fcTargetFirstSeenAt : now));
  const distance = dist(shooter.x, shooter.y, desc.x, desc.y);
  const targetMoving = !!(desc.unit && desc.unit.movePath && desc.unit.movePath.length > 0);
  const targetAngularSpeed = _fcEstimateAngularSpeed(shooter, desc);
  const shooterMoving = !!(shooter.movePath && shooter.movePath.length > 0);
  const suppression = shooter.suppression || 0;
  const panic = _fcPanicState(shooter);
  const aimTimer = shooter.aimTimer || 0;
  const ballisticAimQuality = (shooter._lastAimQuality != null) ? shooter._lastAimQuality : (opts.aimQuality || 0);
  const ctx = {
    shooter, team: shooter.team, tier: _fcTier(shooter), descriptor: desc,
    distance, targetLockTime, aimTimer, targetMoving, targetAngularSpeed, shooterMoving,
    suppression, panic, ballisticAimQuality, visibilityConfidence: desc.confidence,
    fireIntent: null, modifiers: null, lineOfFireSafety: null, crossfireBlocker: null,
    panicOverride: false, placementAimQuality: 0, shotQueueInterruptReason: null,
  };
  ctx.fireIntent = chooseFireIntent(ctx);
  ctx.modifiers = computeFireControlModifiers(ctx);
  ctx.placementAimQuality = computePlacementAimQuality(ctx);
  const safety = evaluateLineOfFireSafety(shooter, desc, ctx, opts.fireMode);
  ctx.lineOfFireSafety = safety.status; ctx.crossfireBlocker = safety.blocker;
  return ctx;
}
function chooseFireIntent(ctx) {
  const d = ctx.descriptor;
  if (d.type === 'barrier_probe') return 'BARRIER_PROBE_FIRE';
  if (d.type === 'wall_penetration') return 'WALL_PENETRATION_FIRE';
  if (d.type === 'expected') return 'EXPECTED_POSITION_FIRE';
  if (d.type === 'suppressive') return 'SUPPRESSIVE_FIRE';
  if (d.type === 'lastKnown') return 'LAST_KNOWN_FIRE';
  if (d.type === 'manual' || d.type === 'point') return 'POINT_FIRE';
  // unit target
  if (ctx.targetAngularSpeed > 0.025 && ctx.targetMoving) return 'TRACKING_FIRE';
  if (ctx.targetLockTime < 0.5) return 'SNAP_FIRE';
  // SIDE-FIRE-1B §5.3: AIMED는 충분히 보고 조준한 정지 사수에게만 (식별 직후 즉시 정밀사격 금지)
  const aimNeed = (ctx.tier === 'veteran' || ctx.tier === 'elite') ? 1.2 : 1.5;
  const lockNeed = (ctx.tier === 'veteran' || ctx.tier === 'elite') ? 1.4 : 1.8;
  const stable = !ctx.shooterMoving && ctx.aimTimer >= aimNeed && ctx.targetLockTime >= lockNeed
              && ctx.visibilityConfidence >= 0.7 && ctx.suppression < 30 && !ctx.targetMoving
              && _fcIsRegularPlus(ctx.shooter);
  if (stable) return 'AIMED_FIRE';
  if (ctx.distance < 160) return 'POINT_FIRE';
  return ctx.targetMoving ? 'TRACKING_FIRE' : 'POINT_FIRE';
}
function computeFireControlModifiers(ctx) {
  const I = ctx.fireIntent;
  let m = { spreadMul:1.0, placementAimMul:0.6, headChanceCap:0.08, weakspotMul:0.7, fireModeBias:null, shotsBias:0, pointTargetPlacementMul:1.0, targetMovementPenalty:0 };
  if (I === 'SNAP_FIRE')        m = { spreadMul:1.6, placementAimMul:0.35, headChanceCap:0.04, weakspotMul:0.4, fireModeBias:'burst', shotsBias:0, pointTargetPlacementMul:1.0, targetMovementPenalty:0 };
  else if (I === 'POINT_FIRE')  m = { spreadMul:1.3, placementAimMul:0.50, headChanceCap:0.06, weakspotMul:0.5, fireModeBias:'burst', shotsBias:0, pointTargetPlacementMul:0.5, targetMovementPenalty:0 };
  else if (I === 'AIMED_FIRE')  m = { spreadMul:0.80, placementAimMul:1.0, headChanceCap:0.16, weakspotMul:1.0, fireModeBias:'semi', shotsBias:0, pointTargetPlacementMul:1.0, targetMovementPenalty:0 };
  else if (I === 'TRACKING_FIRE'){ const aspd = Math.min(0.06, ctx.targetAngularSpeed); m = { spreadMul:1.5, placementAimMul:0.4, headChanceCap:Math.max(0.03, 0.08 - aspd*1.2), weakspotMul:0.4, fireModeBias:'burst', shotsBias:1, pointTargetPlacementMul:1.0, targetMovementPenalty:aspd }; }
  else if (I === 'SUPPRESSIVE_FIRE' || I === 'LAST_KNOWN_FIRE' || I === 'EXPECTED_POSITION_FIRE' || I === 'BARRIER_PROBE_FIRE' || I === 'WALL_PENETRATION_FIRE') m = { spreadMul:1.8, placementAimMul:0.12, headChanceCap:0.02, weakspotMul:0.2, fireModeBias:'burst', shotsBias:0, pointTargetPlacementMul:0.1, targetMovementPenalty:0 };
  // probe/wallpen은 짧게 — full 억제, 1~2발
  if (I === 'BARRIER_PROBE_FIRE') { m.fireModeBias = 'semi'; m.headChanceCap = 0.01; }
  if (I === 'WALL_PENETRATION_FIRE') { m.fireModeBias = 'burst'; m.headChanceCap = 0.01; }
  // 베테랑/엘리트 — TRACKING head bias 추가 억제, AIMED 약점 활용 우수
  if (ctx.tier === 'veteran' || ctx.tier === 'elite') {
    if (I === 'TRACKING_FIRE') m.headChanceCap *= 0.85;
    if (I === 'AIMED_FIRE') { m.headChanceCap = ctx.tier === 'elite' ? 0.18 : 0.16; m.weakspotMul = ctx.tier === 'elite' ? 1.15 : 1.0; }
  } else if (ctx.tier === 'recruit') {
    if (I === 'AIMED_FIRE') { m.headChanceCap = Math.min(m.headChanceCap, 0.10); m.weakspotMul *= 0.8; }
  }
  return m;
}
function computePlacementAimQuality(ctx) {
  let q = ctx.ballisticAimQuality * (ctx.modifiers ? ctx.modifiers.placementAimMul : 0.6);
  // 표적 인지 시간 (짧으면 세부 조준 능력 낮음)
  q *= Math.max(0.25, Math.min(1.0, ctx.targetLockTime / 1.4));
  // 가시성
  q *= Math.max(0.4, Math.min(1.0, ctx.visibilityConfidence));
  // 표적 이동
  if (ctx.targetMoving) q *= 0.7;
  q *= Math.max(0.3, 1 - ctx.targetAngularSpeed * 8);
  // 제압
  q *= Math.max(0.4, 1 - (ctx.suppression / 100) * 0.6);
  // 좌표 표적 — 세부 조준 거의 없음
  if (ctx.descriptor.isPointTarget) q *= (ctx.modifiers ? ctx.modifiers.pointTargetPlacementMul : 0.3);
  return Math.max(0, Math.min(1, q));
}
// 사선 안전 — 같은 팀 유닛이 corridor에 있는가
function evaluateLineOfFireSafety(shooter, desc, ctx, fireMode) {
  const tx = desc.x, ty = desc.y;
  const ang = Math.atan2(ty - shooter.y, tx - shooter.x);
  const losLen = Math.max(1, dist(shooter.x, shooter.y, tx, ty));
  const nx = Math.cos(ang), ny = Math.sin(ang);
  // corridor 폭 — burst/full + 불안정 사격 + 산탄이면 넓게 (HOTFIX-2 §5)
  const R = (UNIT_RADIUS || 11);
  let corridor = 6;   // caution 추가 여유 (UNIT_RADIUS 위에 더해짐)
  if (fireMode === 'burst') corridor += 5;
  if (fireMode === 'full') corridor += 9;
  if (ctx && (ctx.fireIntent === 'SNAP_FIRE' || ctx.fireIntent === 'POINT_FIRE' || ctx.fireIntent === 'TRACKING_FIRE')) corridor += 6;
  if (ctx && ctx.modifiers) corridor += Math.max(0, (ctx.modifiers.spreadMul - 1) * 8);
  // 산탄/펠릿 — cone 형태로 더 넓게. _ammo(해결됨) 또는 ammoId→AMMO_PRESETS로 견고하게 감지.
  let _ammo = null;
  const _wid = ctx && ctx.shooter && ctx.shooter.weaponId;
  const _w = _wid && typeof WEAPONS !== 'undefined' ? WEAPONS[_wid] : null;
  if (_w) {
    _ammo = _w._ammo
      || (ctx.shooter.selectedAmmoId && typeof AMMO_PRESETS !== 'undefined' ? AMMO_PRESETS[ctx.shooter.selectedAmmoId] : null)
      || (_w.ammoId && typeof AMMO_PRESETS !== 'undefined' ? AMMO_PRESETS[_w.ammoId] : null);
  }
  const isPellet = !!(_ammo && _ammo.pelletCount && _ammo.pelletCount > 1);
  if (isPellet) corridor += 12;
  const blockPad = 2;   // blocked 판정 여유 (perp <= R + blockPad)
  let status = 'clear', blocker = null, nearestPerp = Infinity, blockedHit = false;
  for (const u of UNITS) {
    if (u === shooter || !u.alive || u.isDead) continue;
    if (u.team !== shooter.team) continue;   // 같은 팀만
    const relx = u.x - shooter.x, rely = u.y - shooter.y;
    const proj = relx * nx + rely * ny;
    if (proj <= 0 || proj > losLen + 10) continue;   // 사수 뒤 또는 표적 너머
    const perp = Math.abs(relx * (-ny) + rely * nx);
    // 산탄은 거리 비례 cone — 멀수록 폭 넓어짐
    const coneExtra = isPellet ? (proj / losLen) * 14 : 0;
    if (perp <= R + corridor + coneExtra) {
      if (perp < nearestPerp) { nearestPerp = perp; blocker = u; }
      if (perp <= R + blockPad) blockedHit = true;   // 몸통 반경 직접 걸림
    }
  }
  if (blocker) status = blockedHit ? 'blocked' : 'caution';
  return { status, blocker, corridor };
}
function _fcDebugSummary(ctx) {
  if (!ctx) return '';
  const I = ({ SNAP_FIRE:'SNAP', POINT_FIRE:'POINT', AIMED_FIRE:'AIMED', TRACKING_FIRE:'TRACKING', SUPPRESSIVE_FIRE:'SUPPR', LAST_KNOWN_FIRE:'LASTKNOWN', EXPECTED_POSITION_FIRE:'EXPECTED', BARRIER_PROBE_FIRE:'PROBE', WALL_PENETRATION_FIRE:'WALLPEN' })[ctx.fireIntent] || ctx.fireIntent;
  const S = (ctx.lineOfFireSafety || 'clear').toUpperCase();
  let extra = '';
  if (ctx.panicOverride || ctx.safetyOverride) extra = (ctx.panic ? ' / PANIC OVERRIDE' : ' / SAFETY OVERRIDE');
  else if (ctx.crossfireBlocker) extra = ' / friendly in LOF';
  else if (ctx.fireIntent === 'BARRIER_PROBE_FIRE' || ctx.fireIntent === 'WALL_PENETRATION_FIRE') {
    const e = ctx.descriptor.barrierEstimate;
    if (e) {
      const res = ({ likely_penetrates:'likely', uncertain:'uncertain', unlikely:'unlikely', blocked_hard_wall:'blocked' })[e.result] || e.result;
      extra = ` / ${e.material} ${res} pen ${Math.round(e.estimatedPenAfterBarrier || 0)}`;
    } else extra = ' / barrier';
  }
  else if (ctx.fireIntent === 'EXPECTED_POSITION_FIRE') {
    const d = ctx.descriptor;
    extra = ` / lead ${(d.expectedLead || 0).toFixed(1)}s conf ${(d.confidence != null ? d.confidence : 0).toFixed(2)}`;
  }
  else if (ctx.fireIntent === 'LAST_KNOWN_FIRE' || ctx.fireIntent === 'SUPPRESSIVE_FIRE') {
    const d = ctx.descriptor;
    const mc = ({ PRECISE_RECENT:'PRECISE', AREA_SUSPECTED:'AREA', STALE_SUSPICION:'STALE' })[d.memoryClass] || '';
    extra = ` / ${mc ? mc + ' ' : ''}conf ${(d.confidence != null ? d.confidence : 0).toFixed(2)} unc ${Math.round(d.uncertaintyRadius || 0)}`;
  }
  else if (ctx.descriptor.isPointTarget) extra = ' / point';
  if (ctx.shotQueueInterruptReason) extra += ' / ' + ctx.shotQueueInterruptReason;
  return `FC: ${I} / ${S} / place ${ctx.placementAimQuality.toFixed(2)} headCap ${ctx.modifiers.headChanceCap.toFixed(2)}${extra}`;
}

function fireWeapon(shooter, target) {
  if (shooter.role === 'passive') return;
  if (shooter.isDead) return;
  if (shooter.isDowned && !shooter.conscious) return;
  // [0.39.3 A-Closure] 직접 fireWeapon 경로도 canonical acute gate 경유 (knockdown/stopping 중 신규 사격 차단)
  if (getAcuteActionBlockState(shooter).blocksNewFire) return;
  const w0 = WEAPONS[shooter.weaponId];
  if (!w0) return;
  const w = resolveAmmoForWeapon(shooter, w0);
  // SIDE-WEAPON-PLATFORM-1A §13/§14/§18/§19: active resolved profile — 배럴/머즐 velocityMul 반영, 간섭/거치 처리
  if (shooter.weaponState) {
    const _rprof = resolveActiveWeapon(shooter);
    if (shooter.weaponState.mounted && typeof applyMountedWeaponModifiers === 'function') applyMountedWeaponModifiers(shooter, _rprof);
    shooter._resolvedWeaponProfile = _rprof;
    if (_rprof && _rprof.velocityMul != null) w.velocityMul = _rprof.velocityMul;   // ammo.velocity는 불변 — 배럴 보정만
    // 총구 간섭: hard면 사격 억제
    if (shooter.weaponState.obstructionState === 'hard_obstructed') {
      if (shooter.weaponState._stats) shooter.weaponState._stats.obstructInhibitedShots++;
      return;
    }
    if (shooter.weaponState.mounted && shooter.weaponState._stats) shooter.weaponState._stats.mountedShots++;
  }
  const d = dist(shooter.x, shooter.y, target.x, target.y);
  if (d > w.range) return;

  // 1) 사격 가능 상태 체크
  // 튜브식(샷건) 재장전 중이라도 1발 이상 있으면 장전 중단하고 사격 (수동 개입감)
  if (shooter.isReloading && shooter.tubeReloading && shooter.magAmmo >= 1) interruptTubeReloadForFiring(shooter);
  if (shooter.isReloading) return;
  if (shooter.shotQueue) return;     // 진행 중인 사격 묶음 있음
  if (shooter.magAmmo <= 0) {
    if (shooter.reserveAmmo > 0) startReload(shooter);
    return;
  }
  // downed + 팔 상태 — canFireWeapon에서 이미 차단되었지만 안전망
  if (shooter.isDowned && areArmsFunctionallyCritical(shooter)) return;

  // 2) 명중률 (디버그/AI/탄퍼짐 입력값 — 직접 hit/miss 결정 X). FC가 _lastAimQuality를 읽으므로 먼저 계산.
  calculateHitChance(shooter, target, w, d);
  const baseAimQuality = shooter._lastAimQuality != null ? shooter._lastAimQuality : 0;

  // === SIDE-FIRE-1A: Fire Control Layer — 발사 직전 판단 ===
  let fireMode0 = chooseFireMode(shooter, target, w, d);
  const fcCtx = buildFireControlContext(shooter, target, { aimQuality: baseAimQuality, fireMode: fireMode0 });
  shooter._fireControl = fcCtx;
  shooter._fcDebug = fcCtx ? _fcDebugSummary(fcCtx) : null;
  // 크로스파이어 경고 (플레이어 정규군급 이상) — caution/blocked 모두, 렌더용
  if (fcCtx && shooter.team === 'friend' && _fcIsRegularPlus(shooter) && (fcCtx.lineOfFireSafety === 'blocked' || fcCtx.lineOfFireSafety === 'caution') && fcCtx.crossfireBlocker) {
    shooter._crossfireWarning = { blocker: fcCtx.crossfireBlocker, tx: fcCtx.descriptor.x, ty: fcCtx.descriptor.y, t: (GAME.gameTime || 0), status: fcCtx.lineOfFireSafety };
  } else { shooter._crossfireWarning = null; }
  // 안전 게이트 — 정규군급 이상 caution/blocked면 보류 (override 조건 충족 시만 발사)
  if (fcCtx && !canFireWithSafety(shooter, fcCtx)) {
    if (GAME.debugFireControl) log(`[FC] ${shooter.name} 사격 보류 — 사선 아군 (${fcCtx.crossfireBlocker ? fcCtx.crossfireBlocker.name : '?'})`, 'info');
    return;
  }
  if (fcCtx && fcCtx.panicOverride && GAME.debugFireControl) log(`[FC] ${shooter.name} 패닉 override — 사선 무시 발사`, 'warn');

  // 3) 발사방식 결정 — downed shooter나 unconscious 표적엔 SEMI 강제
  let fireMode = chooseFireMode(shooter, target, w, d);
  // downed 사격 — 근거리에선 패닉성 burst/full 가능, 중·원거리는 semi
  if (shooter.isDowned) {
    if (d < 120) {
      // 5~6m 이내 — 가까운 적엔 짧은 연사 가능 (정확도는 낮음, spread 큼)
      if (w.supportsFireModes && w.supportsFireModes.includes('burst') && Math.random() < 0.55) {
        fireMode = 'burst';
      } else if (w.supportsFireModes && w.supportsFireModes.includes('full') && Math.random() < 0.35) {
        fireMode = 'full';
      } else {
        fireMode = 'semi';
      }
    } else if (d < 240) {
      // 12m 이내 — semi 또는 가끔 burst
      fireMode = (Math.random() < 0.25 && w.supportsFireModes && w.supportsFireModes.includes('burst'))
                 ? 'burst' : 'semi';
    } else {
      fireMode = 'semi';
    }
  }
  // 확인사격 — unconscious downed 표적은 정확한 semi
  if (target.isDowned && !target.conscious) fireMode = 'semi';
  // === SIDE-FIRE-1A-HOTFIX-1: fireModeBias 가벼운 반영 (무기 지원 모드 존중 / downed·확인사격 제외) ===
  if (fcCtx && fcCtx.modifiers && !shooter.isDowned && !(target.isDowned && !target.conscious)) {
    const sup = w.supportsFireModes || ['semi'];
    const bias = fcCtx.modifiers.fireModeBias;
    const intent = fcCtx.fireIntent;
    if (bias === 'semi') {
      // AIMED — full-auto 남발 억제
      if (fireMode === 'full') fireMode = sup.includes('burst') ? (Math.random() < 0.7 ? 'burst' : 'semi') : 'semi';
    } else if (bias === 'burst') {
      // POINT/SNAP/TRACKING/SUPPR — 과도한 full 억제
      if (fireMode === 'full' && sup.includes('burst') && Math.random() < 0.5) fireMode = 'burst';
    }
    // SUPPRESSIVE/LAST_KNOWN — 탄약 낭비 방지: full 강하게 억제
    if ((intent === 'SUPPRESSIVE_FIRE' || intent === 'LAST_KNOWN_FIRE') && fireMode === 'full' && sup.includes('burst')) fireMode = 'burst';
    // 무기가 해당 모드를 지원하지 않으면 강등 (단발 무기가 burst/full 금지)
    if (!sup.includes(fireMode)) fireMode = sup.includes('burst') ? 'burst' : 'semi';
  }
  shooter.currentFireMode = fireMode;
  const ammoProf = getWeaponAmmoProfile(w);
  const shotsCtx = {
    distance: d,
    ammoFrac: shooter.magAmmo / Math.max(1, ammoProf.magazineSize),
    aimQuality: baseAimQuality,
    suppression: shooter.suppression || 0,
    targetMoving: !!(target && target.movePath && target.movePath.length > 0),
  };
  let shotsToFire = getShotsPerTrigger(w, fireMode, shotsCtx);
  // SIDE-FIRE-1A-HOTFIX-1: shotsBias 1차 보정 (과격하지 않게 ±1~2 수준)
  if (fcCtx && fcCtx.modifiers && fcCtx.modifiers.shotsBias && fireMode !== 'semi') {
    shotsToFire = Math.max(1, shotsToFire + fcCtx.modifiers.shotsBias);
  }
  shotsToFire = Math.min(shotsToFire, shooter.magAmmo);

  // 4) 탄퍼짐 + 발사 각도 베이스
  let baseSpread = calculateShotSpread(shooter, target, w, d);
  if (fcCtx && fcCtx.modifiers) baseSpread *= fcCtx.modifiers.spreadMul;   // SIDE-FIRE-1A: fireIntent 산포 보정
  const baseAng = Math.atan2(target.y - shooter.y, target.x - shooter.x);

  // 5) 첫 발 즉시 발사
  fireSingleShot(shooter, target, {
    weapon: w, fireMode, shotIndex: 0,
    baseAng, baseSpread, baseAimQuality,
  });

  // 6) 남은 발이 있으면 shotQueue 예약 (BURST/FULL)
  if (shotsToFire > 1) {
    shooter.shotQueue = {
      fireMode,
      shotsRemaining: shotsToFire - 1,
      totalShots: shotsToFire,
      shotDelay: getShotDelay(w),
      shotTimer: getShotDelay(w),
      shotIndex: 1,
      baseAng,
      baseSpread,
      baseAimQuality,
      // target 추적 — 살아있으면 그쪽으로 baseAng 갱신, 죽었으면 마지막 위치로
      targetId: (target && target.id) ? target.id : null,
      targetX: target.x, targetY: target.y,
      // weapon은 매 프레임 resolveAmmoForWeapon으로 재계산 (탄약 변경 등 대비)
      weaponId: shooter.weaponId,
    };
  } else {
    // SEMI 또는 BURST 1발 — 후속 cooldown
    shooter.fireTimer = (fireMode === 'semi')
      ? getSemiCooldown(w, shooter)
      : getBurstRecoveryTime(w, shooter);
  }
}

// fireSingleShot — 1발 발사 처리. fireWeapon과 processShotQueue 양쪽에서 호출.
//   target은 실제 유닛이거나, manualFire의 fakeTarget 같은 점/객체일 수 있다.
// =============================================================
// fireShotgunPellets — 산탄총 펠릿 처리
// =============================================================
//   pelletCount만큼 개별 raycast를 발사하며, 클러스터 패턴 + 거리별 분산을 적용.
//   각 펠릿은 독립적으로 명중/관통/방호 판정을 가진다.
//   근거리에서는 첫 명중 펠릿의 부위를 기준으로 클러스터.
function fireShotgunPellets(shooter, target, ctx) {
  const w = ctx.weapon;
  const ammo = w._ammo;
  const fireMode = ctx.fireMode;
  const shotIndex = ctx.shotIndex || 0;
  const baseAng = ctx.baseAng;
  const baseSpread = ctx.baseSpread;
  const baseAimQuality = ctx.baseAimQuality;
  const skill = shooter.skill || {};
  const ammoRecoil = (w && w.recoil) || 0;
  const pelletCount = ammo.pelletCount || 9;
  const patternType = ammo.patternType || 'clustered_circle';
  // SHOTGUN-MED-NORM-1 §13: 이 산탄 volley의 펠릿들을 묶는 groupId (aggregate 출혈 governor용)
  const pelletGroupId = 'sg_' + shooter.id + '_' + ((typeof GAME !== 'undefined' && GAME.gameTime != null ? GAME.gameTime : 0)).toFixed(3) + '_' + shotIndex;

  shooter.magAmmo--;
  aarShotFired(shooter, w);   // 2A-4: 산탄총도 방아쇠 1회 = 발사 1회로 기록 (펠릿 명중은 별도)
  emitNoise(shooter.x, shooter.y, {
    type: 'gunshot', team: shooter.team, sourceUnitId: shooter.id,
  });

  // 거리 기반 spread — 가까우면 좁고, 멀면 넓음 (실제 cylinder bore는 25~30cm/10m)
  const distPx = target ? Math.hypot(target.x - shooter.x, target.y - shooter.y) : 200;
  const distM = pxToM(distPx);   // SIDE-METRIC-SCALE-1
  const basePelletDeg = (w.pelletSpreadDeg || 2.6);
  // 5m까지는 거의 한 덩어리, 그 이후 완만하게 증가
  const spreadDeg = basePelletDeg * (1 + Math.max(0, (distM - 5) / 30));
  const spreadRad = spreadDeg * Math.PI / 180;

  // 1회 발사의 조준 보정
  const shotSpread = applyFireModeToSpread(baseSpread, fireMode, shotIndex, skill, ammoRecoil);
  const shotAimQ = getEffectiveAimQualityForShot(baseAimQuality, fireMode, shotIndex, skill, ammoRecoil);
  const aimOffset = sampleSpreadAngle(shotSpread);
  const centerAng = baseAng + aimOffset;

  // muzzle flash 1회
  GAME.fxList.push({
    type:'muzzle', x:shooter.x, y:shooter.y, facing:shooter.facing,
    life: 0.12, maxLife: 0.12, team: shooter.team
  });
  // SIDE-DUST-CLOUD-VISUAL-1: 총구 먼지
  if (typeof emitDustFromAction === 'function') emitDustFromAction('muzzle_fire', shooter.x + Math.cos(shooter.facing) * 16, shooter.y + Math.sin(shooter.facing) * 16, { power: 0.7 });

  // 펠릿 트레이서는 더 길게 + 펠릿 마커로 표시
  const fxLifeBase = 0.55;
  const fxIsPellet = true;

  // === 펠릿 패턴 생성 ===
  // 9펠릿 buckshot: 중심 1 + 중간원 4 (r=0.45) + 외곽 4 (r=0.85)
  // 8펠릿 flechette: 중심 0 + 내부 4 (r=0.40) + 외부 4 (r=0.85)
  function makePatternPoints(n, type) {
    const pts = [];
    if (type === 'flechette_cluster') {
      // SIDE-AMMO-KINETICS §3: n개 전부 생성 — center 1 + golden-angle 분포 (buckshot보다 좁고 촘촘)
      pts.push([0, 0]);
      const GA = Math.PI * (3 - Math.sqrt(5));   // golden angle ≈ 2.39996
      const maxR = 0.74;
      for (let i = 1; i < n; i++) {
        const frac = i / Math.max(1, n - 1);
        const r = maxR * Math.sqrt(frac);        // 면적 균일 분포
        const ang = i * GA;
        const j = 0.04;                          // 작은 결정적 jitter (촘촘 유지)
        let x = Math.cos(ang) * r + (Math.random() - 0.5) * j;
        let y = Math.sin(ang) * r + (Math.random() - 0.5) * j;
        pts.push([Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]);
      }
    } else {
      // clustered_circle (buckshot) — 기존 9펠릿 느낌 유지
      pts.push([0, 0]);    // 중앙
      const inner = Math.min(4, n - 1);
      for (let i = 0; i < inner; i++) {
        const ang = (i / inner) * Math.PI * 2 + 0.4;
        pts.push([Math.cos(ang) * 0.45, Math.sin(ang) * 0.45]);
      }
      const outer = Math.max(0, n - 1 - inner);
      for (let i = 0; i < outer; i++) {
        const ang = (i / Math.max(1, outer)) * Math.PI * 2;
        pts.push([Math.cos(ang) * 0.85, Math.sin(ang) * 0.85]);
      }
    }
    return pts.slice(0, n);
  }
  const patternPts = makePatternPoints(pelletCount, patternType);

  // 첫 명중 펠릿의 부위 정보 — 근거리 클러스터 hit location
  let clusterBodyPart = null;
  const PROX_CLUSTER_DIST_M = 5;

  // 명중 결과 집계
  let totalHits = 0;
  const hitInfos = [];
  let lastImpactResult = null;

  // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목4,7): 펠릿 공통 총구 origin
  let _bOrigin = { x: shooter.x, y: shooter.y };
  if (typeof computeWeaponMuzzlePoint === 'function' && (!shooter.weaponState || shooter.weaponState.obstructionState !== 'hard_obstructed')) _bOrigin = computeWeaponMuzzlePoint(shooter, shooter._resolvedWeaponProfile);

  for (let i = 0; i < patternPts.length; i++) {
    const [px, py] = patternPts[i];
    // 패턴 좌표를 각도로 변환 — 중심에서 spreadRad 반경 내 분산
    // jitter 추가 (각 펠릿이 정확히 패턴 점에 가지 않게)
    const jitterX = (Math.random() - 0.5) * 0.15;
    const jitterY = (Math.random() - 0.5) * 0.15;
    const fx = (px + jitterX) * spreadRad;
    const fy = (py + jitterY) * spreadRad;
    const pelletAng = centerAng + fx;
    // 펠릿별로 raycast
    const ray = raycastShot(shooter, Math.cos(pelletAng), Math.sin(pelletAng), w.range,
                            { weapon: w, ammo: w._ammo, teamHitMode: 'damage', origin: _bOrigin });

    // tracer (펠릿마다 한 줄, 줄임 표시)
    if (ray.barrierEvents && ray.barrierEvents.length > 0) {
      let prevX = _bOrigin.x, prevY = _bOrigin.y;
      for (const ev of ray.barrierEvents) {
        GAME.fxList.push({
          type:'tracer', x1:prevX, y1:prevY, x2:ev.x, y2:ev.y,
          life: fxLifeBase, maxLife: fxLifeBase,
          team: shooter.team, hitType: ev.outcome === 'penetrated' ? 'cover_pen' : ev.outcome,
          isPellet: true,
        });
        if (ev.outcome === 'penetrated' && ev.exitX != null) {
          prevX = ev.exitX; prevY = ev.exitY;
        } else { prevX = ev.x; prevY = ev.y; }
      }
      GAME.fxList.push({
        type:'tracer', x1:prevX, y1:prevY, x2:ray.x, y2:ray.y,
        life: fxLifeBase, maxLife: fxLifeBase,
        team: shooter.team, hitType: ray.type,
        isPellet: true,
      });
    } else {
      GAME.fxList.push({
        type:'tracer', x1: _bOrigin.x, y1: _bOrigin.y, x2: ray.x, y2: ray.y,
        life: fxLifeBase, maxLife: fxLifeBase,
        team: shooter.team, hitType: ray.type,
        isPellet: true,
      });
    }

    // 펠릿 명중 처리
    if (ray.type === 'unit') {
      const actualTarget = ray.unit;
      const damageMul = (ray.shotDamage != null && w._ammo && w._ammo.damage)
                        ? (ray.shotDamage / w._ammo.damage) : 1.0;
      const wForImpact = damageMul < 0.999 ? Object.assign({}, w, { damageScale: w.damageScale * damageMul }) : w;

      // 근거리 클러스터 hit location 강제 — 첫 hit가 정해지면 나머지는 인접 부위 위주
      const impactCtx = {
        aimQualityOverride: shotAimQ,
        shotVelocity: ray.shotVelocity,
        shotInitialVelocity: ray.shotInitialVelocity,
        shotStability: ray.shotStability,
        shotBarrierCount: ray.shotBarrierCount,
        shotDistPx: (ray.shotDistTotalPx != null ? ray.shotDistTotalPx : ray.dist),   // CLEANUP HOTFIX 2: 장벽 전 구간 포함 총거리
        coverExposure: _computeRayCoverExposure(ray),   // SIDE-HITLOC-COVER-EXPOSURE-1A
        coverPenetrationContext: _computeRayCoverPenetrationExposure(ray),   // SIDE-HITLOC-COVER-INTERACTION-1B
        // SHOTGUN-MED-NORM-1 §13: 산탄 pellet 그룹 메타 (wound까지 전달 → aggregate governor)
        pelletGroupId: pelletGroupId,
        pelletIndex: i,
        pelletCount: pelletCount,
        shotgunPellet: true,
        shotgunAmmoId: ammo.id,
        shotgunPatternType: patternType,
      };
      // 0~5m 근거리 + 첫 hit가 정해진 경우 → 후속 펠릿은 같은/인접 부위로 편향
      if (distM <= PROX_CLUSTER_DIST_M && clusterBodyPart && actualTarget === target) {
        impactCtx.preferredBodyPart = clusterBodyPart;
        impactCtx.clusterBias = 0.65;   // 65% 같은 부위, 25% 인접, 10% 임의
      }
      const r = resolveImpact(shooter, actualTarget, wForImpact, impactCtx);
      r.hitAspect = getHitAspect(shooter, actualTarget);
      r.fireMode = fireMode;
      r.shotIndex = shotIndex;
      r._pelletIdx = i;
      actualTarget._lastHitAspect = r.hitAspect;

      if (!clusterBodyPart) clusterBodyPart = r.bodyPart;
      totalHits++;
      hitInfos.push({ target: actualTarget, result: r });
      lastImpactResult = r;
    }
    checkNearMissForUnits(shooter, ray, w._ammo);
  }

  // SHOTGUN-PHYS-CLUSTER-1 Phase3 §8: volley 종료 후 명중 target별로 출혈+즉시생리 governor 최종 정규화 (1순위 호출, delta 기반이라 안전)
  {
    const _seen = new Set();
    for (const hi of hitInfos) {
      const t = hi.target; const gid = pelletGroupId;
      if (!t || !t.medical || !gid) continue;
      const key = t.id + '|' + gid;
      if (_seen.has(key)) continue;
      _seen.add(key);
      if (typeof normalizeShotgunPelletGroupBleeding === 'function') normalizeShotgunPelletGroupBleeding(t, gid);
      if (typeof normalizeShotgunPelletGroupPhysiology === 'function') normalizeShotgunPelletGroupPhysiology(t, gid);
      // WOUND-CLUSTER-REFRESH-1 §3: governor가 bleedingProfile을 조정한 뒤 cluster 집계 최신화
      if (typeof refreshShotgunPelletGroupClusters === 'function') refreshShotgunPelletGroupClusters(t, gid);
    }
  }
  // 펠릿 통합 로그 — 명중 수 + 가장 심한 severity 기준 1개
  if (totalHits > 0 && hitInfos[0].target) {
    // 2A-4: 산탄총 명중 기록 — 펠릿 1발 이상 명중 시 발사 1회당 명중 1로 집계 + 펠릿 수 누적
    aarShotHit(shooter, w);
    const _st = (typeof aarUnitStats==='function') ? aarUnitStats(shooter.id) : null;
    if (_st) { _st.pelletHits = (_st.pelletHits||0) + totalHits; }
    const tgt = hitInfos[0].target;
    // 가장 심한 severity 우선
    const SEV_RANK = { critical: 4, serious: 3, light: 2, graze: 1, miss: 0 };
    let worst = hitInfos[0];
    for (const h of hitInfos) {
      if ((SEV_RANK[h.result.severity] || 0) > (SEV_RANK[worst.result.severity] || 0)) worst = h;
    }
    const sev = worst.result.severity;
    const ammoShort = ammo.shortName || ammo.name || '';
    log(`[${shooter.name} → ${tgt.name}] ${ammoShort} ${totalHits}/${pelletCount}펠릿 명중`
      + (sev === SEVERITY.CRITICAL ? ' · 치명상'
       : sev === SEVERITY.SERIOUS  ? ' · 중상'
       : sev === SEVERITY.LIGHT    ? ' · 경상' : ''),
      sev === SEVERITY.CRITICAL ? 'kill' : sev === SEVERITY.SERIOUS ? 'warn' : 'info');

    // 상태 변화 로그
    const cs = tgt.combatState;
    if (cs === 'dead' && tgt._lastReportedState !== 'dead') {
      log(`${tgt.name} 사망`, tgt.team === 'friend' ? 'danger' : 'kill');
      tgt._lastReportedState = 'dead';
    } else if (cs === 'downed' && tgt._lastReportedState !== 'downed' && tgt._lastReportedState !== 'dead') {
      log(`${tgt.name} 전투불능`, tgt.team === 'friend' ? 'danger' : 'warn');
      tgt._lastReportedState = 'downed';
    }
    registerThreat(tgt, shooter.x, shooter.y, { sourceUnitId: shooter.id, sourceEventId: 'hit' + shooter.id + '_' + Math.round((GAME.gameTime||0)*100) });
  } else if (target && target.alive !== false) {
    applyOutcome(target, OUTCOME.MISS, w);
  }

  // aimTimer 감소 (산탄총은 높은 반동)
  shooter.aimTimer = Math.max(0, shooter.aimTimer - getEffectiveAimQualityShotPenalty(fireMode, ammoRecoil) * 1.5);
}

function fireSingleShot(shooter, target, ctx) {
  if (!shooter.alive) return;
  if (shooter.magAmmo <= 0) return;
  // SIDE-VISUAL-UNIT-GRENADE-DUST-HOTFIX-1 (항목7): 총구 hard_obstructed면 발사 자체를 막는다 (shooter 중심 fallback 발사 금지). shotQueue도 중단.
  if (shooter.weaponState && shooter.weaponState.obstructionState === 'hard_obstructed') { if (shooter.shotQueue) shooter.shotQueue = null; return; }
  const w = ctx.weapon;
  // === 펠릿(산탄) 분기 — pelletCount > 1이면 다중 raycast ===
  if (w._ammo && w._ammo.pelletCount && w._ammo.pelletCount > 1) {
    fireShotgunPellets(shooter, target, ctx);
    return;
  }
  const fireMode = ctx.fireMode;
  const shotIndex = ctx.shotIndex || 0;
  const baseAng = ctx.baseAng;
  const baseSpread = ctx.baseSpread;
  const baseAimQuality = ctx.baseAimQuality;
  const skill = shooter.skill || {};
  const ammoRecoil = (w && w.recoil) || 0;

  shooter.magAmmo--;
  aarShotFired(shooter, w);   // 2A-3.5: 발사 기록

  // 총성 — 적팀 AI가 감지하는 소음
  emitNoise(shooter.x, shooter.y, {
    type: 'gunshot',
    team: shooter.team,
    sourceUnitId: shooter.id,
  });

  // 발사방식/shotIndex 보정
  const shotSpread = applyFireModeToSpread(baseSpread, fireMode, shotIndex, skill, ammoRecoil);
  const shotAimQ = getEffectiveAimQualityForShot(baseAimQuality, fireMode, shotIndex, skill, ammoRecoil);

  const offset = sampleSpreadAngle(shotSpread);
  const fireAng = baseAng + offset;
  // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목4,7): 총구 기반 ballistic origin (hard_obstructed면 벽 너머 시작 방지 위해 shooter 중심 fallback)
  let _bOrigin = { x: shooter.x, y: shooter.y };
  if (typeof computeWeaponMuzzlePoint === 'function' && (!shooter.weaponState || shooter.weaponState.obstructionState !== 'hard_obstructed')) _bOrigin = computeWeaponMuzzlePoint(shooter, shooter._resolvedWeaponProfile);
  const ray = raycastShot(shooter, Math.cos(fireAng), Math.sin(fireAng), w.range,
                          { weapon: w, ammo: w._ammo, teamHitMode: 'damage', origin: _bOrigin });
  shooter._lastShotRay = ray;   // SIDE-FIRE-2A: barrier probe 결과 학습용
  // FX — 트레이서 (각 발의 실제 발사 시점에 생성됨 — 시간차 자연스러움)
  const fxLifeBase = 0.30;
  // MDZ 등 탄체 소멸형(consumesPrimaryProjectileOnDetonation)은 첫 충돌점에서 중심 ray 종료 (뒤로 파란 선 X)
  const _mexFx = _microExplosiveInfo(w._ammo);
  const mdzConsumes = !!(_mexFx && _mexFx.consumesPrimaryProjectileOnDetonation);
  if (mdzConsumes) {
    // PENETRATION-VISUAL-ROLLBACK-1 §5: MDZ/탄체 소멸형은 첫 충돌점(또는 첫 barrier event)까지만 tracer. segment tracer와 섞지 않는다.
    const be0 = (ray.barrierEvents && ray.barrierEvents.length) ? ray.barrierEvents[0] : null;
    let tx = ray.x, ty = ray.y, htype = ray.type;
    if (be0) {
      tx = (be0.exitX != null ? be0.exitX : be0.x); ty = (be0.exitY != null ? be0.exitY : be0.y);
      htype = (be0.outcome === 'penetrated' ? 'cover_pen' : be0.outcome);
    }
    GAME.fxList.push({ type:'tracer', x1: _bOrigin.x, y1: _bOrigin.y, x2: tx, y2: ty,
      life: fxLifeBase, maxLife: fxLifeBase, team: shooter.team, hitType: htype });
    if (htype === 'wall' || htype === 'cover') emitNoise(tx, ty, { type:'impact', team: shooter.team, sourceUnitId: shooter.id });
    if ((htype === 'wall' || htype === 'cover') && typeof emitDustFromAction === 'function') emitDustFromAction('bullet_impact', tx, ty, { power: 0.8 });   // SIDE-DUST-CLOUD-VISUAL-1
    else if (htype === 'ricochet' && typeof emitDustFromAction === 'function') emitDustFromAction('ricochet', tx, ty, { power: 0.7 });
    if (htype === 'cover_pen' && be0 && /drywall|wood|plaster|rubble|glass/.test(be0.material || '') && typeof emitDustFromAction === 'function') emitDustFromAction('debris_fall', tx, ty, { power: 0.7 });
  } else if (ray.barrierEvents && ray.barrierEvents.length > 0) {
    // PENETRATION-VISUAL-ROLLBACK-1 §4: 일반탄 — barrierEvents 기반 분할 tracer (origin→entry, exit→다음, 마지막 exit→final).
    let prevX = _bOrigin.x, prevY = _bOrigin.y;
    for (const ev of ray.barrierEvents) {
      if (ev.x == null || ev.y == null) continue;
      GAME.fxList.push({
        type:'tracer', x1:prevX, y1:prevY, x2:ev.x, y2:ev.y,
        life: fxLifeBase, maxLife: fxLifeBase,
        team: shooter.team, hitType: ev.outcome === 'penetrated' ? 'cover_pen' : ev.outcome,
      });
      if (ev.outcome === 'penetrated' && ev.exitX != null && ev.exitY != null) {
        prevX = ev.exitX; prevY = ev.exitY;
      } else {
        prevX = ev.x; prevY = ev.y;
      }
      // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 도탄 먼지
      if (ev.outcome === 'ricochet' && typeof emitDustFromAction === 'function') emitDustFromAction('ricochet', ev.x, ev.y, { power: 0.7 });
      // 파괴 가능 구조물 관통 → 잔해 낙하 먼지
      if (ev.outcome === 'penetrated' && /drywall|wood|plaster|rubble|glass/.test(ev.material || '') && typeof emitDustFromAction === 'function') emitDustFromAction('debris_fall', ev.x, ev.y, { power: 0.7 });
    }
    GAME.fxList.push({
      type:'tracer', x1:prevX, y1:prevY, x2:ray.x, y2:ray.y,
      life: fxLifeBase, maxLife: fxLifeBase,
      team: shooter.team, hitType: ray.type,
    });
    // 탄착음 — 최종 hit 위치에 impact noise (sourceTeam은 shooter)
    if (ray.type === 'wall' || ray.type === 'cover') {
      emitNoise(ray.x, ray.y, {
        type: 'impact', team: shooter.team, sourceUnitId: shooter.id,
      });
    }
    if ((ray.type === 'wall' || ray.type === 'cover') && typeof emitDustFromAction === 'function') emitDustFromAction('bullet_impact', ray.x, ray.y, { power: 0.8 });   // SIDE-DUST-CLOUD-VISUAL-1
  } else {
    GAME.fxList.push({
      type:'tracer', x1: _bOrigin.x, y1: _bOrigin.y, x2: ray.x, y2: ray.y,
      life: fxLifeBase, maxLife: fxLifeBase,
      team: shooter.team, hitType: ray.type,
    });
  }
  // 첫 발에만 muzzle flash (총구 origin)
  if (shotIndex === 0) {
    GAME.fxList.push({
      type:'muzzle', x:_bOrigin.x, y:_bOrigin.y, facing:shooter.facing,
      life: 0.10, maxLife: 0.10, team: shooter.team
    });
    if (typeof emitDustFromAction === 'function') emitDustFromAction('muzzle_fire', _bOrigin.x, _bOrigin.y, { power: 0.6 });
  }

  // 명중 처리
  let _sideHitResult = null;
  if (ray.type === 'unit' && mdzConsumes) {
    // SIDE-AMMO-2B-HOTFIX-0 §9: MDZ 중심탄 소멸 — 중심탄 관통상/bodyTrajectory/continuation 없음. 폭발/파편만 적용.
    const actualTarget = ray.unit;
    aarShotHit(shooter, w);
    actualTarget._lastHitAspect = getHitAspect(shooter, actualTarget);
    registerThreat(actualTarget, shooter.x, shooter.y, { sourceUnitId: shooter.id, sourceEventId: 'hit' + shooter.id + '_' + Math.round((GAME.gameTime||0)*100) });
    log(`[${shooter.name} → ${actualTarget.name}] MDZ 착탄 · 폭발 (중심탄 소멸)`, 'warn');
    _sideHitResult = null;   // 중심탄 피해/후속탄도 없음 — explosive effect는 applySpecialAmmoEffects에서
  } else if (ray.type === 'unit') {
    const actualTarget = ray.unit;
    aarShotHit(shooter, w);   // 2A-3.5: 유닛 명중 기록
    const damageMul = (ray.shotDamage != null && w._ammo && w._ammo.damage)
                      ? (ray.shotDamage / w._ammo.damage) : 1.0;
    const wForImpact = damageMul < 0.999 ? Object.assign({}, w, { damageScale: w.damageScale * damageMul }) : w;
    const r = resolveImpact(shooter, actualTarget, wForImpact, {
      aimQualityOverride: shotAimQ,
      shotVelocity: ray.shotVelocity,
      shotInitialVelocity: ray.shotInitialVelocity,
      shotStability: ray.shotStability,
      shotBarrierCount: ray.shotBarrierCount,
      shotDistPx: (ray.shotDistTotalPx != null ? ray.shotDistTotalPx : ray.dist),   // CLEANUP HOTFIX 2: 총 비행거리(장벽 전 구간 포함)
      coverExposure: _computeRayCoverExposure(ray),   // SIDE-HITLOC-COVER-EXPOSURE-1A: exit→hitPoint 노출
      coverPenetrationContext: _computeRayCoverPenetrationExposure(ray),   // SIDE-HITLOC-COVER-INTERACTION-1B
    });
    r.hitAspect = getHitAspect(shooter, actualTarget);
    r.fireMode = fireMode;
    r.shotIndex = shotIndex;
    _sideHitResult = r;
    actualTarget._lastHitAspect = r.hitAspect;
    registerThreat(actualTarget, shooter.x, shooter.y, { sourceUnitId: shooter.id, sourceEventId: 'hit' + shooter.id + '_' + Math.round((GAME.gameTime||0)*100) });
    // HOTFIX-1/2 §7: 인체+후면방호구(또는 사지) 완전관통 시 감쇠된 continuation raycast 생성 + 결과 기록
    if (r.bodyTrajectory && r.bodyTrajectory.continueRaycast && r.bodyTrajectory.continuationThreatPacket) {
      try {
        const _cr = _spawnContinuationRaycast(shooter, actualTarget, Math.cos(fireAng), Math.sin(fireAng), wForImpact, r.bodyTrajectory.continuationThreatPacket);
        r.bodyTrajectory.continuationFired = true;
        r.bodyTrajectory.continuationHitTarget = !!(_cr && _cr.hit);
        r.bodyTrajectory.continuationReason = (_cr && _cr.reason) || (_cr && _cr.hit ? 'hit' : 'no_target');
      } catch (e) {}
    }

    // 1) 공격 로그 — 부위 + (방향) + 방호 + 손상 정도 (severity)
    //    "팔 사망" 같이 부위명 + 사망/전투불능을 직접 붙이지 않는다.
    const ASPECT_KOR = { front: '정면', side: '측면', rear: '후면' };
    // 머리 계열은 두개부/얼굴/목 구분이 의미 있으므로 LOC_KOR 우선 사용
    const isHeadLoc = (r.location === 'head_skull' || r.location === 'head_face' || r.location === 'neck');
    let partKor = isHeadLoc
      ? (LOC_KOR[r.location] || r.location)
      : (BODY_PART_KOR[r.bodyPart] || (LOC_KOR[r.location] || r.location));
    // chest/abdomen/두개부에 방향 표시 (얼굴/목/팔/다리는 방향 표시 생략)
    if ((r.bodyPart === 'chest' || r.bodyPart === 'abdomen' || r.location === 'head_skull')
        && r.hitAspect && ASPECT_KOR[r.hitAspect]) {
      partKor = partKor + ' ' + ASPECT_KOR[r.hitAspect];
    }
    const sev = r.severity;
    let prot = '';
    if (r.protectionType === 'hard')      prot = '하드 ';
    else if (r.protectionType === 'soft') prot = '소프트 ';
    if (r.outcome === OUTCOME.BLOCK) {
      // 방호 차단 — 부위 + 차단
      log(`[${shooter.name} → ${actualTarget.name}] ${partKor} ${prot}차단`, 'info');
    } else if (sev === SEVERITY.CRITICAL) {
      log(`[${shooter.name} → ${actualTarget.name}] ${partKor} 관통 · 치명상`, 'kill');
    } else if (sev === SEVERITY.SERIOUS) {
      log(`[${shooter.name} → ${actualTarget.name}] ${partKor} 관통 · 중상`, 'warn');
    } else if (sev === SEVERITY.LIGHT) {
      log(`[${shooter.name} → ${actualTarget.name}] ${partKor} 명중 · 경상`, 'info');
    } else if (sev === SEVERITY.GRAZE) {
      // 스침 — 보통 로그 생략 (너무 자주 발생)
    }

    // 2) 상태 변화 로그 — combatState 기준 (사망/전투불능)
    //    이미 "사망" 상태였다면 중복 출력 방지 — _lastReportedState 사용
    const cs = actualTarget.combatState;
    if (cs === 'dead' && actualTarget._lastReportedState !== 'dead') {
      log(`${actualTarget.name} 사망`, actualTarget.team === 'friend' ? 'danger' : 'kill');
      actualTarget._lastReportedState = 'dead';
    } else if (cs === 'downed' && actualTarget._lastReportedState !== 'downed' && actualTarget._lastReportedState !== 'dead') {
      const consLabel = actualTarget.conscious ? '의식 있음' : '의식 잃음';
      log(`${actualTarget.name} 쓰러짐 · ${consLabel}`, actualTarget.team === 'friend' ? 'danger' : 'good');
      actualTarget._lastReportedState = 'downed';
      actualTarget._lastReportedConscious = actualTarget.conscious;
    } else if (cs === 'downed' && actualTarget._lastReportedState === 'downed'
               && actualTarget._lastReportedConscious !== actualTarget.conscious) {
      // 의식 상태가 바뀐 경우만
      log(`${actualTarget.name} ${actualTarget.conscious ? '의식 회복' : '의식 잃음'}`, 'warn');
      actualTarget._lastReportedConscious = actualTarget.conscious;
    } else if (cs !== 'dead' && cs !== 'downed') {
      // 큰 stopping으로 사격 중단된 경우 — 별도 로그
      if (actualTarget._lastStoppedFire) {
        log(`${actualTarget.name} 충격으로 사격 중단`, 'info');
        actualTarget._lastStoppedFire = false;
      }
      // pain tier가 올라간 경우 — 30/60 단계 진입 시 로그
      const tier = getPainTier(actualTarget.pain);
      if (tier > (actualTarget._painReportedTier || 0)) {
        if (tier === 2) log(`${actualTarget.name} 전투능력 저하`, 'warn');
        else if (tier === 3) log(`${actualTarget.name} 고통 극심`, 'warn');
        actualTarget._painReportedTier = tier;
      }
    }
  } else if (target && target.alive !== false) {
    // 빗나감 — 본 표적에게 약간의 제압
    applyOutcome(target, OUTCOME.MISS, w);
  }

  // SIDE-AMMO-1B: near miss + tracer + incendiary debug + micro-HEI/HEIAP (기존 checkNearMissForUnits 대체)
  applySpecialAmmoEffects(shooter, ray, w, _sideHitResult);

  // 한 발마다 aimTimer 흔들림 일부 반영 (샷별 누적)
  shooter.aimTimer = Math.max(0, shooter.aimTimer - getEffectiveAimQualityShotPenalty(fireMode, ammoRecoil));
}

// 한 발 발사 후 aimTimer가 떨어질 양 — applyFireModeAfterShot의 1발 단위 분할
function getEffectiveAimQualityShotPenalty(fireMode, recoil) {
  const recMul = Math.max(0.8, 1 + (recoil || 0) * 0.10);
  if (fireMode === 'semi')  return 0.05 * recMul;
  if (fireMode === 'burst') return 0.10 * recMul;
  if (fireMode === 'full')  return 0.14 * recMul;
  return 0.05;
}

// processShotQueue — updateUnit에서 매 프레임 호출.
//   shotQueue가 있으면 shotTimer를 감소시키고, 0 이하면 1발 발사 후 재예약.
//   진행 중 중단 조건이 충족되면 큐를 종료한다.
function processShotQueue(unit, dt) {
  const q = unit.shotQueue;
  if (!q) return;

  // [0.39.3 A-Closure] knockdown/stopping 시 예약 연사 결정적 중단 — 후속탄 발사 전 queue 제거(탄약 미소모).
  //   피격순간 fireInterruptChance(확률)와 별개: knockdown이면 확률 실패해도 반드시 중단.
  const _acute = getAcuteActionBlockState(unit);
  if (_acute.interruptsQueuedFire) { unit.shotQueue = null; return; }

  // 중단 조건
  if (!unit.alive || unit.pinned || unit.isReloading || unit.magAmmo <= 0) {
    unit.shotQueue = null;
    return;
  }
  // SIDE-WEAPON-INJURY-HANDLING-1A: 부상/의식/전환으로 현재 슬롯 사용 불가 → 예약탄 중단
  if (unit.weaponState && unit.weaponState.switching) { unit.shotQueue = null; return; }
  if (unit._injuryWeaponDisabled) { unit.shotQueue = null; return; }
  if (typeof isWeaponSlotUsable === 'function' && unit.weaponState && !isWeaponSlotUsable(unit, unit.weaponState.activeSlot)) { unit.shotQueue = null; return; }
  // 무기 변경
  if (unit.weaponId !== q.weaponId) {
    unit.shotQueue = null;
    return;
  }

  q.shotTimer -= dt;
  if (q.shotTimer > 0) return;

  // target — id가 있으면 살아있는지 확인하고 위치 갱신, 죽었으면 마지막 위치로 사격 후 종료
  let target = null;
  if (q.targetId) {
    target = UNITS.find(u => u.id === q.targetId) || null;
    if (target && target.alive) {
      // 표적 갱신 — 이동 중일 수 있으므로 방향 다시 계산
      q.targetX = target.x; q.targetY = target.y;
      q.baseAng = Math.atan2(target.y - unit.y, target.x - unit.x);
    } else {
      // 표적 사망 — 마지막 위치 그대로 사용 (q.targetX/Y), target은 null
      target = null;
    }
  }
  // target이 null이면 fakeTarget — 큐 예약 시 저장한 좌표를 fake로 사용
  if (!target) {
    target = {
      x: q.targetX, y: q.targetY,
      alive: false, stance: 'standing',
      name: '지점',
      team: (unit.team === 'friend' ? 'enemy' : 'friend'),
      suppression: 0, hp: 100, maxHp: 100,
      bodyArmorId: null, helmetId: null,
      movePath: [], role: 'passive',
    };
  }

  const w = resolveAmmoForWeapon(unit, WEAPONS[q.weaponId]);
  // SIDE-VISUAL-UNIT-GRENADE-DUST-HOTFIX-1 (항목7): 발당 총구 간섭 재검사 — 이동/회전으로 총구가 막히면 후속탄 중단
  if (typeof computeWeaponObstructionState === 'function') {
    const _rp = unit._resolvedWeaponProfile || (typeof resolveActiveWeapon === 'function' ? resolveActiveWeapon(unit) : null);
    const _obst = computeWeaponObstructionState(unit, _rp);
    if (unit.weaponState) unit.weaponState.obstructionState = _obst;
    if (_obst === 'hard_obstructed') {
      if (unit._fireControl) { unit._fireControl.shotQueueInterruptReason = 'muzzle hard-obstructed'; unit._fcDebug = (typeof _fcDebugSummary === 'function') ? _fcDebugSummary(unit._fireControl) : unit._fcDebug; }
      if (GAME.debugFireControl) log(`[FC] ${unit.name} 연사 중단 — 총구 간섭(hard)`, 'info');
      unit.shotQueue = null;
      return;
    }
  }
  // === SIDE-FIRE-1A: burst/full 발당 사선 안전 재검사 (HOTFIX-2: caution도 중단) ===
  if (_fcIsRegularPlus(unit) && target) {
    const fcCtx = buildFireControlContext(unit, target, { aimQuality: unit._lastAimQuality, fireMode: q.fireMode });
    unit._fireControl = fcCtx;
    unit._fcDebug = fcCtx ? _fcDebugSummary(fcCtx) : null;
    if (fcCtx && (fcCtx.lineOfFireSafety === 'blocked' || fcCtx.lineOfFireSafety === 'caution') && !canFireWithSafety(unit, fcCtx)) {
      fcCtx.shotQueueInterruptReason = 'interrupted by crossfire';
      unit._fcDebug = _fcDebugSummary(fcCtx);
      if (unit.team === 'friend' && fcCtx.crossfireBlocker) unit._crossfireWarning = { blocker: fcCtx.crossfireBlocker, tx: fcCtx.descriptor.x, ty: fcCtx.descriptor.y, t: (GAME.gameTime || 0), status: fcCtx.lineOfFireSafety };
      if (GAME.debugFireControl) log(`[FC] ${unit.name} 연사 중단 — 사선 아군 진입`, 'info');
      unit.shotQueue = null;
      return;
    }
  }
  fireSingleShot(unit, target, {
    weapon: w, fireMode: q.fireMode, shotIndex: q.shotIndex,
    baseAng: q.baseAng, baseSpread: q.baseSpread,
    baseAimQuality: q.baseAimQuality,
  });

  q.shotsRemaining--;
  q.shotIndex++;
  q.shotTimer = q.shotDelay;

  // 표적이 죽었으면 burst/full 묶음을 일찍 끝낸다 (한 발 정도 더 가다가 정지)
  if (q.targetId) {
    const t = UNITS.find(u => u.id === q.targetId);
    if (t && !t.alive) {
      // 시각적으로 한 발 더 이어쏠 수 있게 1발만 더 두고 그 다음 종료
      q.shotsRemaining = Math.min(q.shotsRemaining, 1);
    }
  }

  // 탄약 부족 시 종료
  if (unit.magAmmo <= 0) {
    unit.shotQueue = null;
    if (unit.reserveAmmo > 0) startReload(unit);
    return;
  }

  if (q.shotsRemaining <= 0) {
    // 묶음 종료 — fireTimer 회복
    unit.fireTimer = getBurstRecoveryTime(WEAPONS[q.weaponId], unit);
    unit.shotQueue = null;
  }
}

// =============================================================
// 응급처치 / 끌고가기 시스템
// =============================================================
//   처치 종류와 시간:
//   - 진통제 (painkiller): 짧음. 발동 지연 후 pain 감소 + downed conscious 일어남 시도
//   - 지혈대 (tourniquet): 짧음~중간. 사지 출혈만. 출혈 진행 ↓, 적용 후 pain ↑
//   - 붕대 (bandage): 중간~김. 출혈 등급을 1단계씩 낮춤. heavy/critical은 더 오래
//   - 부목 (splint): 중간. 골절 페널티 완화 (제거가 아닌 완화 플래그 splintApplied)
//   - 안정화 (stabilizer): 김. critical 상태 진행 지연

const TREATMENT_DURATIONS = {
  painkiller_self:  2.5,  painkiller_other: 1.8,
  tourniquet_self:  3.0,  tourniquet_other: 2.0,
  remove_tourniquet_self: 1.5, remove_tourniquet_other: 1.2,
  bandage_self:     6.0,  bandage_other:    4.0,
  pressure_bandage_self: 7.0, pressure_bandage_other: 4.5,
  hemostatic_self:  6.5,  hemostatic_other: 4.2,
  packing_self:     8.0,  packing_other:    5.5,
  splint_self:     10.0,  splint_other:     6.0,
  stabilizer_self:  0,    stabilizer_other: 8.0,   // 옛 이름 호환
  shockcare_self:   0,    shockcare_other:  8.0,   // 쇼크 관리 (자가 불가)
  chestseal_self:   4.5,  chestseal_other:  3.0,
  junctional_pressure_self: 9.0, junctional_pressure_other: 7.0,   // 유지형 (자가 제한적)
  abdominal_dressing_self: 9.0, abdominal_dressing_other: 7.5,
  // FIELD-STAB-1: field stabilization actions (원인 완화 — 완치 아님)
  airway_support_self: 5.0, airway_support_other: 3.5,
  chest_relief_self: 7.0, chest_relief_other: 5.0,
  pelvic_binder_self: 8.5, pelvic_binder_other: 6.0,
  junctional_control_self: 9.0, junctional_control_other: 6.5,
  circulation_support_self: 0, circulation_support_other: 8.0,   // 자가 제한
  mark_evac_self: 1.0, mark_evac_other: 1.0,
};

function getTreatmentDuration(type, isSelf, target, treater) {
  let key = type + (isSelf ? '_self' : '_other');
  let dur = TREATMENT_DURATIONS[key];
  if (dur == null || dur === 0) return 0;
  const factors = {};
  // === 부상 심각도 ===
  let woundMul = 1.0;
  if (target.medical) {
    const m = target.medical;
    const totalBleed = m.externalBleedRate + m.internalBleedRate;
    if (type === 'bandage') {
      if (totalBleed > 30)      woundMul = 2.0;
      else if (totalBleed > 10) woundMul = 1.5;
      else if (totalBleed > 3)  woundMul = 1.2;
    } else if (type === 'tourniquet') {
      // 지혈대는 심한 출혈에서 빠르게 (긴급 적용)
      if (totalBleed > 30) woundMul = 0.9;
    } else if (type === 'chestseal') {
      if (m.breathingEfficiency < 50) woundMul = 1.4;
      else if (m.breathingEfficiency < 70) woundMul = 1.2;
    } else if (type === 'shockcare') {
      if (m.shock > 70) woundMul = 1.5;
      else if (m.shock > 40) woundMul = 1.2;
    }
  } else {
    // legacy fallback
    if (type === 'bandage') {
      if (target.bleeding === 'heavy')    woundMul = 1.6;
      else if (target.bleeding === 'critical') woundMul = 2.2;
    }
  }
  factors.woundMul = woundMul;
  // === 처치자 상태 — 본인 손상이 처치 속도 저하 ===
  let medicMul = 1.0;
  if (treater && treater.medical) {
    const tm = treater.medical;
    // 처치자 팔 기능 — 정상(1.0)이면 1.0배, 손상될수록 더 느려짐 ⭐ 버그 수정
    //   armFn 1.0 → 1.0배 / 0.5 → 1.40배 / 0.0 → 1.80배
    const lArm = tm.bodyParts.leftArm.functionRatio;
    const rArm = tm.bodyParts.rightArm.functionRatio;
    const armFn = clampMed((lArm + rArm) / 2, 0, 1);
    const armPenaltyMul = 1.0 + (1.0 - armFn) * 0.8;
    medicMul *= clampMed(armPenaltyMul, 1.0, 1.85);
    // 통증/쇼크 — medical 우선 perceivedPain 사용 (이중 적용 방지)
    const usePain = (tm.stressResponse && tm.stressResponse.perceivedPain != null)
      ? tm.stressResponse.perceivedPain : tm.pain;
    medicMul *= (1.0 + usePain / 200 + tm.shock / 200);
    // panic — 손떨림으로 처치 속도 저하
    if (tm.stressResponse && tm.stressResponse.panic > 0.3) {
      medicMul *= 1.0 + tm.stressResponse.panic * 0.5;
    }
    // adrenaline 과다 — 손떨림
    if (tm.stressResponse && tm.stressResponse.adrenaline > 0.75) {
      medicMul *= 1.0 + (tm.stressResponse.adrenaline - 0.75) * 0.4;
    }
    // consciousness 저하 — 정밀 처치 어려움
    if (tm.consciousness < 70) medicMul *= 1.0 + (70 - tm.consciousness) / 100;
    if (treater.suppression > 50) medicMul *= 1.2;
    if (treater.stance === 'prone' || treater.stance === 'goingProne') medicMul *= 1.2;
    else if (treater.stance === 'crouched') medicMul *= 1.05;
    factors.armFn = armFn;
    factors.armPenaltyMul = armPenaltyMul;
  }
  factors.medicMul = medicMul;
  // === 자가처치 페널티 ===
  let selfMul = isSelf ? 1.25 : 1.0;
  factors.selfMul = selfMul;
  // === 부위 접근성 — chest/abdomen/neck은 사지보다 어려움 ===
  let accessMul = 1.0;
  if (type === 'chestseal') accessMul = 1.0;   // 이미 chest 전용
  // 부위 정보는 startTreatment의 opts.part에서 결정 (여기선 기본)
  factors.accessMul = accessMul;
  // 최종 계산 + clamp
  let final = dur * woundMul * medicMul * selfMul * accessMul;
  final = Math.max(1.0, Math.min(30, final));
  // 디버그 저장
  if (treater) treater._lastTreatmentFactors = { base: dur, ...factors, final };
  return final;
}

// =============================================================
// 부위별 의료 시스템 — 가능한 처치 / 추천 처치
// =============================================================
function isLimbPart(part) {
  return part === 'left_arm' || part === 'right_arm' || part === 'left_leg' || part === 'right_leg'
      || part === 'arms' || part === 'legs';
}
function isLegPart(part) {
  return part === 'left_leg' || part === 'right_leg' || part === 'legs';
}

// 부위별 가능한 처치 목록 (진통제/지혈대 해제 같은 전신 처치는 제외)
