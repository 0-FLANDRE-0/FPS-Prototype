// 11b. THREAT AWARENESS  (위협 기억 / 경계 / 견제사격)
// =============================================================
const LAST_KNOWN_DURATION    = 11.0;  // 초 — tactical memory (confidence 감소 + uncertaintyRadius 증가). 정확한 점 기억은 짧게.
// =============================================================
// 소음 시스템 — emit, 감지, lastHeardNoise
// =============================================================
//   소음은 정확한 위치가 아니라 confidence/오차가 있는 의심 정보.
//   감지된 소음은 lastHeardNoise에 저장되고 AI의 약한 우선순위로 사용.
//   gunshot/impact는 강한 반응, footstep은 약한 반응.
const NOISE_TYPE_PROFILE = {
  // SIDE-METRIC-SCALE-1 §9: radiusM(m)이 기준값 — radius(px)는 파생. 벽 너머는 radius × 0.55 자동 감쇠.
  //   gunshot 80m — 맵(50×30m) 어디서든 들림. legacy px÷20 = m 의미 유지.
  gunshot:        { loudness: 1.00, radiusM: 80,  decay: 4.0,  conf: 0.85 },
  impact:         { loudness: 0.50, radiusM: 25,  decay: 2.0,  conf: 0.55 },
  reload:         { loudness: 0.20, radiusM: 4.5, decay: 1.5,  conf: 0.40 },
  footstep_walk:  { loudness: 0.18, radiusM: 4.5, decay: 1.0,  conf: 0.30 },
  footstep_run:   { loudness: 0.45, radiusM: 10,  decay: 1.8,  conf: 0.45 },
  footstep_crawl: { loudness: 0.08, radiusM: 2.5, decay: 0.8,  conf: 0.22 },
  footstep_drag:  { loudness: 0.55, radiusM: 11,  decay: 2.0,  conf: 0.50 },
  drag:           { loudness: 0.55, radiusM: 11,  decay: 2.0,  conf: 0.50 },
  treatment:      { loudness: 0.12, radiusM: 3.5, decay: 1.5,  conf: 0.30 },
  door:           { loudness: 0.40, radiusM: 9,   decay: 2.0,  conf: 0.55 },
  generic:        { loudness: 0.30, radiusM: 7.5, decay: 1.5,  conf: 0.40 },
};
// px 파생값 부여 (기존 코드 호환 — prof.radius 사용처)
for (const _nk in NOISE_TYPE_PROFILE) { const _p = NOISE_TYPE_PROFILE[_nk]; _p.radius = mToPx(_p.radiusM); }

// =============================================================
// THROWABLE / EXPLOSION / FRAGMENT 시스템
// =============================================================
const PX_PER_M_FALLBACK = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 20;

// 유닛이 수류탄을 던질 수 있는지
function canThrow(unit, throwableId) {
  if (!unit || !unit.alive || unit.isDowned) return false;
  if (unit.throwState) return false;
  if (getAcuteActionBlockState(unit).blocksThrow) return false;   // [0.39.3 A-Closure] knockdown 중 투척 시작 불가
  const cnt = (unit.throwables && unit.throwables[throwableId]) || 0;
  return cnt > 0;
}

// 투척 경로 시뮬 — 출발점 → 목표점, 벽 충돌/튕김 처리
//   반환: { path:[{x,y},...], bounces:[...], endX, endY, blocked, finalDistPx }
function computeThrowTrajectory(launchX, launchY, aimX, aimY, maxRangePx) {
  const path = [{ x: launchX, y: launchY }];
  const bounces = [];
  let dx = aimX - launchX, dy = aimY - launchY;
  let dist = Math.hypot(dx, dy);
  // 사거리 클램프
  if (dist > maxRangePx) {
    const k = maxRangePx / dist;
    aimX = launchX + dx * k;
    aimY = launchY + dy * k;
    dx = aimX - launchX; dy = aimY - launchY;
    dist = maxRangePx;
  }
  let curX = launchX, curY = launchY;
  let nx = dx / Math.max(0.001, dist), ny = dy / Math.max(0.001, dist);
  let remaining = dist;
  let totalDist = 0;
  let bounceCount = 0;
  const MAX_BOUNCES = 1;   // 1회 튕김 허용
  let blocked = false;
  while (remaining > 1) {
    // 벽까지 거리
    let bestT = remaining;
    let hitWall = null;
    if (typeof rayDistToWalls === 'function') {
      const w = rayDistToWalls(curX, curY, nx, ny, remaining);
      if (w.t < bestT - 0.5) { bestT = w.t; hitWall = w.obj; }
    }
    // blocksLOS cover
    if (MAP_DATA && MAP_DATA.coverObjects) {
      for (const o of MAP_DATA.coverObjects) {
        if (o.blocksLOS !== true) continue;
        if (typeof rayBoxT === 'function') {
          const t = rayBoxT(curX, curY, nx, ny, o, bestT);
          if (t < bestT - 0.5) { bestT = t; hitWall = o; }
        }
      }
    }
    curX += nx * bestT;
    curY += ny * bestT;
    totalDist += bestT;
    remaining -= bestT;
    path.push({ x: curX, y: curY });
    if (!hitWall) {
      // 목표 도달
      break;
    }
    // 벽 충돌 — 튕김 또는 정지
    if (bounceCount >= MAX_BOUNCES) {
      blocked = true;
      break;
    }
    bounces.push({ x: curX, y: curY });
    // 반사 — 벽의 법선 추정 (rect 충돌면 기준)
    // 단순화: 가까운 면을 추정. dx/dy 큰 쪽으로 normal 결정
    let nrmX = 0, nrmY = 0;
    if (hitWall.x != null && hitWall.w != null) {
      // rect 벽 — 충돌 좌표가 어느 면에 가까운지
      const lx = curX - hitWall.x, rx = (hitWall.x + hitWall.w) - curX;
      const ty = curY - hitWall.y, by = (hitWall.y + hitWall.h) - curY;
      const minH = Math.min(Math.abs(lx), Math.abs(rx));
      const minV = Math.min(Math.abs(ty), Math.abs(by));
      if (minH < minV) { nrmX = (lx < rx ? -1 : 1); nrmY = 0; }
      else             { nrmX = 0; nrmY = (ty < by ? -1 : 1); }
    } else {
      // fallback — 반대방향
      nrmX = -nx; nrmY = -ny;
    }
    // 반사 계산: r = d - 2(d·n)n
    const dotDN = nx * nrmX + ny * nrmY;
    nx = nx - 2 * dotDN * nrmX;
    ny = ny - 2 * dotDN * nrmY;
    // 튕김 손실 — 30% 사거리 감소
    remaining *= 0.7;
    // 튕김 후 진입 방지 — 살짝 안쪽으로 이동
    curX += nrmX * 1.5; curY += nrmY * 1.5;
    bounceCount += 1;
  }
  return {
    path, bounces,
    endX: curX, endY: curY,
    blocked,
    finalDistPx: totalDist,
  };
}

// 자동 모서리 던지기 — 캐릭터 옆에 벽이 있고 목표가 가려져 있으면
//   launchPoint를 캐릭터 좌/우로 살짝 옮겨 LOS 확보
function computeAutoCornerLaunch(unit, aimX, aimY) {
  // 1) 직선 LOS 검사
  const directBlocked = isLOSBlockedForBlast(unit.x, unit.y, aimX, aimY);
  if (!directBlocked) return { x: unit.x, y: unit.y, autoCorner: false };
  // 2) 좌/우로 살짝 옮긴 위치에서 검사 — facing 기준 측면
  const facing = unit.facing || 0;
  const sideOffset = (typeof UNIT_RADIUS !== 'undefined' ? UNIT_RADIUS : 7) * 2.5;
  // 좌측 (facing - 90°)
  const lx = unit.x + Math.cos(facing - Math.PI/2) * sideOffset;
  const ly = unit.y + Math.sin(facing - Math.PI/2) * sideOffset;
  // 우측
  const rx = unit.x + Math.cos(facing + Math.PI/2) * sideOffset;
  const ry = unit.y + Math.sin(facing + Math.PI/2) * sideOffset;
  const lBlocked = isLOSBlockedForBlast(lx, ly, aimX, aimY);
  const rBlocked = isLOSBlockedForBlast(rx, ry, aimX, aimY);
  if (!lBlocked && !rBlocked) {
    // 둘 다 OK — 더 가까운 쪽
    const dl = Math.hypot(lx - aimX, ly - aimY);
    const dr = Math.hypot(rx - aimX, ry - aimY);
    return dl < dr ? { x: lx, y: ly, autoCorner: true } : { x: rx, y: ry, autoCorner: true };
  }
  if (!lBlocked) return { x: lx, y: ly, autoCorner: true };
  if (!rBlocked) return { x: rx, y: ry, autoCorner: true };
  // 둘 다 막힘 — 그대로 (사용자가 튕김으로 노린 경우)
  return { x: unit.x, y: unit.y, autoCorner: false };
}

// 투척 시작 — 유닛이 목표 위치로 수류탄을 던짐
function startThrow(unit, throwableId, targetX, targetY) {
  if (!canThrow(unit, throwableId)) return false;
  const preset = THROWABLE_PRESETS[throwableId];
  if (!preset) return false;
  // 자동 모서리 — 출발점 조정
  const launch = computeAutoCornerLaunch(unit, targetX, targetY);
  const maxPx = preset.throwRange * PX_PER_M_FALLBACK;
  // 경로 시뮬 — 튕김 포함
  const traj = computeThrowTrajectory(launch.x, launch.y, targetX, targetY, maxPx);
  unit.throwState = {
    id: throwableId,
    launchX: launch.x, launchY: launch.y,
    targetX: traj.endX, targetY: traj.endY,
    trajectory: traj,
    prepTimer: preset.prepDelay || 0.5,
    flightTimer: 0,
    flying: false,
    fuseTimer: preset.fuseTime || 4.0,
    autoCorner: launch.autoCorner,
    _thrownByUnitId: unit.id,
    _thrownByTeam: unit.team,
    // === AI 판단용 phase + 예측 정보 ===
    grenadePhase: 'airborne',                 // 'airborne' | 'landed' | 'exploded'
    hasLanded: false,
    hasBounced: traj.bounces.length > 0,
    landedAtTime: null,
    landedX: null, landedY: null,
    // 예상 착지점 — trajectory 끝점 또는 targetX/Y
    predictedLandingX: traj ? traj.endX : targetX,
    predictedLandingY: traj ? traj.endY : targetY,
    incomingDir: Math.atan2((traj ? traj.endY : targetY) - launch.y,
                            (traj ? traj.endX : targetX) - launch.x),
  };
  // 인벤토리 감소
  unit.throwables[throwableId] = Math.max(0, (unit.throwables[throwableId] || 0) - 1);
  const cornerNote = launch.autoCorner ? ' (모서리)' : '';
  const bounceNote = traj.bounces.length > 0 ? ` (${traj.bounces.length}회 튕김)` : '';
  log(`[${unit.name}] ${preset.shortName || preset.name} 투척 준비${cornerNote}${bounceNote}`, 'info');
  return true;
}

// 던져도 되는가 — AI 전용 안전 게이트. 플레이어 투척은 통과시키지 않는다(발밑 투척도 선택이다).
//   실제로 던질 때와 **같은 궤적 시뮬**을 돌려 튕김까지 반영한 착탄점에서 판정한다.
//   반환: { safe, reason, landX, landY, selfHarm, mateHarm, mateName }
const THROW_SELF_HARM_MAX = 0.15;   // 자기 위해가 이보다 크면 안 던진다
const THROW_MATE_HARM_MAX = 0.25;   // 아군 위해가 이보다 크면 안 던진다
const THROW_SELF_BLIND_MAX = 0.8;   // 자기 실명(초). 문설주 뒤면 0이므로 스택업이 곧 안전이다
const THROW_MATE_BLIND_MAX = 1.2;   // 아군 실명(초)
function checkThrowSafety(unit, throwableId, targetX, targetY) {
  const preset = THROWABLE_PRESETS[throwableId];
  if (!preset) return { safe: false, reason: 'no_preset' };
  const launch = computeAutoCornerLaunch(unit, targetX, targetY);
  const maxPx = preset.throwRange * PX_PER_M_FALLBACK;
  const traj = computeThrowTrajectory(launch.x, launch.y, targetX, targetY, maxPx);
  const landX = traj.endX, landY = traj.endY;
  const out = { safe: true, reason: null, landX, landY, selfHarm: 0, mateHarm: 0, mateName: null, trajectory: traj };
  const units = (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) ? UNITS : (GAME.units || []);
  //   id로도 제외한다 — 던질 자리를 시뮬할 때 대역 유닛을 쓰므로 본인이 아군으로 잡히면 안 된다
  const isSelf = (u) => (u === unit || (unit.id != null && u.id === unit.id));

  // 섬광은 폭압이 없다. 폭압만 재면 **언제나 안전**이라고 답해서 아군을 눈멀게 한다.
  if (preset.type === 'flash') {
    const selfE = flashEffectOn(preset, landX, landY, unit);
    out.selfHarm = selfE ? selfE.blind : 0;
    if (out.selfHarm > THROW_SELF_BLIND_MAX) { out.safe = false; out.reason = 'self_flash'; return out; }
    for (const u of units) {
      if (isSelf(u) || !u.alive || u.team !== unit.team) continue;
      const e = flashEffectOn(preset, landX, landY, u);
      const b = e ? e.blind : 0;
      if (b > out.mateHarm) { out.mateHarm = b; out.mateName = u.name; }
    }
    if (out.mateHarm > THROW_MATE_BLIND_MAX) { out.safe = false; out.reason = 'friendly_flash'; }
    return out;
  }

  // 연막은 몸도 지각도 안 때린다 — 안전 판정에 잴 것이 없다.
  //   폭압 경로로 흘려보내면 blastRadius*가 없어서 우연히 0이 나오는데,
  //   **우연히 맞는 답은 계약이 아니다.** 명시적으로 안전이라고 말한다.
  if (preset.type === 'smoke') return out;

  const self = blastHarmAt(preset, landX, landY, unit.x, unit.y);
  out.selfHarm = self.harm;
  if (self.harm > THROW_SELF_HARM_MAX) { out.safe = false; out.reason = 'self_blast'; return out; }
  for (const u of units) {
    if (isSelf(u) || !u.alive || u.team !== unit.team) continue;
    const h = blastHarmAt(preset, landX, landY, u.x, u.y);
    if (h.harm > out.mateHarm) { out.mateHarm = h.harm; out.mateName = u.name; }
  }
  if (out.mateHarm > THROW_MATE_HARM_MAX) { out.safe = false; out.reason = 'friendly_blast'; }
  return out;
}

// 매 tick — 투척 prep/flight 진행, fuse 진행, 비행 중 수류탄 그리기 데이터 갱신
function tickThrowable(unit, dt) {
  if (!unit.throwState) return;
  const st = unit.throwState;
  const preset = THROWABLE_PRESETS[st.id];
  if (!preset) { unit.throwState = null; return; }
  if (st.prepTimer > 0) {
    st.prepTimer = Math.max(0, st.prepTimer - dt);
    if (st.prepTimer === 0) {
      // 투척 시작 — flying 모드 (trajectory 사용)
      st.flying = true;
      const totalDist = st.trajectory ? st.trajectory.finalDistPx : Math.hypot(st.targetX - unit.x, st.targetY - unit.y);
      const speedPx = (preset.throwSpeed || 25) * PX_PER_M_FALLBACK;
      st.flightDuration = totalDist / speedPx;
      st.flightTimer = 0;
      st.startX = st.launchX || unit.x;
      st.startY = st.launchY || unit.y;
      st.curX = st.startX; st.curY = st.startY;
      GAME.flyingThrowables.push(st);
      log(`[${unit.name}] ${preset.shortName} 투척!`, 'info');
    }
    return;
  }
  if (st.flying) {
    // === 이전 위치 저장 (movement vector 계산용) ===
    st.prevX = st.curX;
    st.prevY = st.curY;
    st.flightTimer += dt;
    const t = Math.min(1, st.flightTimer / Math.max(0.001, st.flightDuration));
    // trajectory 경로 따라 이동 — path 세그먼트별 누적 거리 계산
    let curSegIdx = 0;   // 현재 진행 중인 세그먼트 인덱스 (0 = 첫 segment)
    if (st.trajectory && st.trajectory.path && st.trajectory.path.length >= 2) {
      const path = st.trajectory.path;
      const totalDist = st.trajectory.finalDistPx;
      const travelTarget = totalDist * t;
      let acc = 0;
      let placed = false;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (acc + segLen >= travelTarget) {
          const segT = (travelTarget - acc) / Math.max(0.001, segLen);
          st.curX = a.x + (b.x - a.x) * segT;
          st.curY = a.y + (b.y - a.y) * segT;
          curSegIdx = i;
          placed = true;
          break;
        }
        acc += segLen;
      }
      if (!placed) {
        st.curX = st.trajectory.endX;
        st.curY = st.trajectory.endY;
        curSegIdx = path.length - 2;
      }
      // 새 segment 진입 = 벽 튕김 — sound emit (한 번씩만)
      if (st._lastSegIdx == null) st._lastSegIdx = 0;
      while (st._lastSegIdx < curSegIdx) {
        const bounceIdx = st._lastSegIdx + 1;
        if (bounceIdx < path.length - 1) {
          // 마지막 노드(end)는 bounce가 아님 — 중간 노드만 bounce
          const bp = path[bounceIdx];
          if (typeof emitNoise === 'function') {
            emitNoise(bp.x, bp.y, { type: 'footstep', intensityMul: 0.7, source: 'grenade_bounce' });
          }
          GAME.fxList.push({
            type: 'react_text', x: bp.x, y: bp.y - 6,
            text: '*튕김*', color: '#ffd060', life: 0.6, maxLife: 0.6,
          });
        }
        st._lastSegIdx++;
      }
    } else {
      // fallback — 직선
      st.curX = st.startX + (st.targetX - st.startX) * t;
      st.curY = st.startY + (st.targetY - st.startY) * t;
    }
    // === 속도 계산 — 이번 frame 이동분 (prev → cur) ===
    if (st.prevX != null && dt > 0) {
      st.velX = (st.curX - st.prevX) / dt;
      st.velY = (st.curY - st.prevY) / dt;
      st.speed = Math.hypot(st.velX, st.velY);
    } else {
      st.velX = 0; st.velY = 0; st.speed = 0;
    }
    // 비행 끝 — 착탄
    if (t >= 1) {
      st.flying = false;
      st.landed = true;
      if (st.trajectory) { st.curX = st.trajectory.endX; st.curY = st.trajectory.endY; }
      else { st.curX = st.targetX; st.curY = st.targetY; }
      // === phase 전환 — airborne → landed ===
      if (st.grenadePhase === 'airborne') {
        st.grenadePhase = 'landed';
        st.hasLanded = true;
        st.landedAtTime = GAME.gameTime || 0;
        st.landedX = st.curX; st.landedY = st.curY;
        // landed 후 속도 0
        st.velX = 0; st.velY = 0; st.speed = 0;
      }
      // 낙하 소리
      if (!st._landSoundEmitted) {
        st._landSoundEmitted = true;
        if (typeof emitNoise === 'function') {
          emitNoise(st.curX, st.curY, { type: 'footstep', intensityMul: 1.0, source: 'grenade_land' });
        }
        GAME.fxList.push({
          type: 'react_text', x: st.curX, y: st.curY - 8,
          text: '*떨어짐*', color: '#ffa040', life: 0.8, maxLife: 0.8,
        });
      }
    }
  }
  // 신관 — prep 끝났을 때부터 진행
  if (st.prepTimer === 0) {
    st.fuseTimer = Math.max(0, st.fuseTimer - dt);
    if (st.fuseTimer === 0) {
      // 폭발 — 착탄 위치(또는 비행 중 위치)에서
      const ex = st.curX != null ? st.curX : st.targetX;
      const ey = st.curY != null ? st.curY : st.targetY;
      // === phase 전환 — exploded ===
      st.grenadePhase = 'exploded';
      // 모든 유닛에 grenade event 기록 (가까운 + 보이는 범위)
      if (typeof _recordGrenadeEvent === 'function') _recordGrenadeEvent(st, ex, ey);
      detonateThrowable(st.id, ex, ey, unit);
      const idx = GAME.flyingThrowables.indexOf(st);
      if (idx >= 0) GAME.flyingThrowables.splice(idx, 1);
      unit.throwState = null;
    }
  }
}

// 폭발 처리 — 폭압 + 850 파편 raycast
// =============================================================
// 파편 HIT LOCATION 테이블 — 자세 × 방향 × 거리
// =============================================================
// 좌우 사지 처리: nearSideArm/Leg, farSideArm/Leg는 폭심 방향에 따라 동적 변환

// --- STANDING ---
const FRAG_HIT_STANDING_FRONT = [
  { loc: 'head_skull', w: 0.05 },
  { loc: 'head_face',  w: 0.05 },
  { loc: 'neck_soft',  w: 0.03 },
  { loc: 'chest',      w: 0.24 },
  { loc: 'abdomen',    w: 0.22 },
  { loc: 'left_arm',   w: 0.09 },
  { loc: 'right_arm',  w: 0.09 },
  { loc: 'left_leg',   w: 0.115 },
  { loc: 'right_leg',  w: 0.115 },
];
const FRAG_HIT_STANDING_SIDE = [
  { loc: 'head_skull',  w: 0.06 },
  { loc: 'head_face',   w: 0.02 },
  { loc: 'neck_soft',   w: 0.03 },
  { loc: 'chest',       w: 0.16 },
  { loc: 'abdomen',     w: 0.20 },
  { loc: 'nearSideArm', w: 0.22 },
  { loc: 'nearSideLeg', w: 0.24 },
  { loc: 'farSideArm',  w: 0.03 },
  { loc: 'farSideLeg',  w: 0.04 },
];
const FRAG_HIT_STANDING_REAR = [
  { loc: 'head_skull', w: 0.06 },
  { loc: 'head_face',  w: 0.0  },
  { loc: 'neck_soft',  w: 0.03 },
  { loc: 'chest',      w: 0.20 },
  { loc: 'abdomen',    w: 0.18 },
  { loc: 'left_arm',   w: 0.09 },
  { loc: 'right_arm',  w: 0.09 },
  { loc: 'left_leg',   w: 0.175 },
  { loc: 'right_leg',  w: 0.175 },
];
// 0~2m 매우 가까운 폭발 — 가슴/복부 노출 증가 (aspect 무관)
const FRAG_HIT_STANDING_CLOSE = [
  { loc: 'head_skull', w: 0.06 },
  { loc: 'head_face',  w: 0.05 },
  { loc: 'neck_soft',  w: 0.03 },
  { loc: 'chest',      w: 0.28 },
  { loc: 'abdomen',    w: 0.24 },
  { loc: 'left_arm',   w: 0.08 },
  { loc: 'right_arm',  w: 0.08 },
  { loc: 'left_leg',   w: 0.09 },
  { loc: 'right_leg',  w: 0.09 },
];

// --- PRONE ---
const FRAG_HIT_PRONE_FRONT_REAR = [
  { loc: 'head_skull', w: 0.18 },
  { loc: 'head_face',  w: 0.02 },
  { loc: 'neck_soft',  w: 0.04 },
  { loc: 'chest',      w: 0.18 },
  { loc: 'abdomen',    w: 0.10 },
  { loc: 'left_arm',   w: 0.13 },
  { loc: 'right_arm',  w: 0.13 },
  { loc: 'left_leg',   w: 0.11 },
  { loc: 'right_leg',  w: 0.11 },
];
const FRAG_HIT_PRONE_SIDE = [
  { loc: 'head_skull',  w: 0.14 },
  { loc: 'head_face',   w: 0.01 },
  { loc: 'neck_soft',   w: 0.02 },
  { loc: 'chest',       w: 0.10 },
  { loc: 'abdomen',     w: 0.18 },
  { loc: 'nearSideArm', w: 0.24 },
  { loc: 'nearSideLeg', w: 0.24 },
  { loc: 'farSideArm',  w: 0.03 },
  { loc: 'farSideLeg',  w: 0.04 },
];
// PRONE close (0~2m) — 가슴/복부 일부 복구
const FRAG_HIT_PRONE_CLOSE = [
  { loc: 'head_skull', w: 0.10 },
  { loc: 'head_face',  w: 0.05 },
  { loc: 'neck_soft',  w: 0.03 },
  { loc: 'chest',      w: 0.20 },
  { loc: 'abdomen',    w: 0.16 },
  { loc: 'left_arm',   w: 0.10 },
  { loc: 'right_arm',  w: 0.10 },
  { loc: 'left_leg',   w: 0.13 },
  { loc: 'right_leg',  w: 0.13 },
];

// 옛 이름 호환 (제거 안전 — 외부 참조 없음 확인)
const PRONE_HIT_LOC_FRONT_REAR = FRAG_HIT_PRONE_FRONT_REAR;
const PRONE_HIT_LOC_SIDE       = FRAG_HIT_PRONE_SIDE;
const PRONE_HIT_LOC_CLOSE      = FRAG_HIT_PRONE_CLOSE;

// 가중치 테이블에서 무작위 선택
function pickWeightedLocation(table) {
  let total = 0;
  for (const e of table) total += e.w;
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.w;
    if (r <= 0) return e.loc;
  }
  return table[table.length - 1].loc;
}

// nearSide/farSide → 실제 left/right로 변환
function resolveSidedLocation(picked, side) {
  if (picked === 'nearSideArm') return (side === 'right') ? 'right_arm' : 'left_arm';
  if (picked === 'farSideArm')  return (side === 'right') ? 'left_arm'  : 'right_arm';
  if (picked === 'nearSideLeg') return (side === 'right') ? 'right_leg' : 'left_leg';
  if (picked === 'farSideLeg')  return (side === 'right') ? 'left_leg'  : 'right_leg';
  return picked;
}

// 통합 파편 hit location 판정 — standing/prone × front/side/rear × close 보정 + 좌우 사지
//   returns: { location, aspect, side }
function rollFragmentHitLocation(target, ex, ey, fragment, distM) {
  const ga = computeGrenadeAspect(target, ex, ey);
  const isProne = (target.stance === 'prone' && !target.isDowned);
  let table;
  if (isProne) {
    if (distM <= 2)                 table = FRAG_HIT_PRONE_CLOSE;
    else if (ga.aspect === 'side')  table = FRAG_HIT_PRONE_SIDE;
    else                            table = FRAG_HIT_PRONE_FRONT_REAR;
  } else {
    if (distM <= 2)                 table = FRAG_HIT_STANDING_CLOSE;
    else if (ga.aspect === 'front') table = FRAG_HIT_STANDING_FRONT;
    else if (ga.aspect === 'side')  table = FRAG_HIT_STANDING_SIDE;
    else                            table = FRAG_HIT_STANDING_REAR;
  }
  const picked = pickWeightedLocation(table);
  const location = resolveSidedLocation(picked, ga.side);
  return { location, aspect: ga.aspect, side: ga.side };
}

// 수류탄 입사 방향 → 유닛 facing 기준 aspect
//   returns: { aspect: 'front'|'rear'|'side', side: 'left'|'right'|null, angleDeg }
function computeGrenadeAspect(unit, gx, gy) {
  const dx = gx - unit.x, dy = gy - unit.y;
  const incomingAng = Math.atan2(dy, dx);   // 수류탄이 있는 방향
  let diff = incomingAng - unit.facing;
  // -PI ~ PI 정규화
  while (diff > Math.PI)  diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const deg = diff * 180 / Math.PI;
  const absDeg = Math.abs(deg);
  let aspect, side = null;
  if (absDeg <= 60)        aspect = 'front';
  else if (absDeg >= 120)  aspect = 'rear';
  else {
    aspect = 'side';
    side = (deg > 0) ? 'right' : 'left';   // facing 기준 시계방향이 right
  }
  return { aspect, side, angleDeg: deg };
}

// prone 거리별 파편 회피 배수 — 1.0이면 다 맞음, 0이면 다 빗나감
function getProneFragmentMul(distM) {
  if (distM <= 2)   return 0.85;
  if (distM <= 5)   return 0.55;
  if (distM <= 10)  return 0.35;
  return 0.18;
}

// prone 거리별 폭압 감쇠
function getProneBlastMul(distM) {
  if (distM <= 2)  return 0.90;
  if (distM <= 5)  return 0.75;
  return 0.60;
}

// =============================================================
// 수류탄 반응 AI
// =============================================================

// 유닛 훈련도 → 반응 파라미터
function getReactionProfile(unit) {
  const skillId = (unit.skill && unit.skill.presetId) || 'regular';
  if (skillId === 'recruit') {
    return {
      delayMin: 0.8,  delayMax: 1.5,
      panicChance: 0.30,
      proneChance: 0.30,
      evadeDistMin: 2.0, evadeDistMax: 4.0,
      detectRangeMul: 0.65,
    };
  }
  if (skillId === 'veteran') {
    return {
      delayMin: 0.20, delayMax: 0.45,
      panicChance: 0.05,
      proneChance: 0.55,
      evadeDistMin: 4.0, evadeDistMax: 6.0,
      detectRangeMul: 0.95,
    };
  }
  if (skillId === 'elite') {
    return {
      delayMin: 0.10, delayMax: 0.25,
      panicChance: 0.0,
      proneChance: 0.65,
      evadeDistMin: 4.5, evadeDistMax: 6.5,
      detectRangeMul: 1.0,
    };
  }
  // regular default
  return {
    delayMin: 0.35, delayMax: 0.65,
    panicChance: 0.12,
    proneChance: 0.45,
    evadeDistMin: 3.0, evadeDistMax: 5.0,
    detectRangeMul: 0.85,
  };
}

// =============================================================
// 수류탄 위해 추정 — 두 층(물리 회피 / 유틸리티 위험)이 공유하는 단일 기준
// =============================================================
//   측정(주입 실험 3회): 아군 하나가 앞으로 8m 던지면 팀원 3/3이 매번 엎드리고,
//   1회는 던진 본인이 자기 수류탄에서 도망치며 자기 행동을 28틱 연속 파기했다.
//   원인은 층이 둘인데 규칙이 달랐기 때문이다 —
//     perceiveGrenades       : 팀 인식 있으나 무시 조건이 셋 모두(예상착탄 멂 && 안 다가옴 && 최근접 안전)
//     getGrenadeDangerForUnit: 팀 인식 없음. 신관 1.2초 + 6m만 본다
//   원칙: "누가 던졌나"는 **놀람**을 줄이고, "실제로 날 죽일 수 있나"는 **여전히 도망**시킨다.
const USE_GRENADE_OWNER_AWARE = true;
function isGrenadeOwnerAwareOn() {
  if (typeof GAME !== 'undefined' && GAME.grenadeOwnerAwareOn != null) return !!GAME.grenadeOwnerAwareOn;
  return USE_GRENADE_OWNER_AWARE;
}
const GRENADE_HARM_FLEE   = 0.55;   // 이 이상이면 팀 무관하게 회피한다 (진짜 위험한 자기 수류탄)
const GRENADE_HARM_NOTICE = 0.20;   // 이 이상이면 아군 것이라도 눈길은 준다
const GRENADE_LOS_RELIEF  = 0.30;   // 벽 뒤면 파편 위해가 이만큼으로 줄어든다

// 폭발점 (bx,by)이 (x,y)에 주는 위해 0..1 — 팀·소유와 무관한 순수 물리 추정.
//   1이면 치명 반경 안. 벽 뒤면 파편이 막히므로 크게 줄어든다.
function blastHarmAt(preset, bx, by, x, y) {
  const lethalM = preset.blastRadiusLethal || 2.0;
  const outerM  = preset.blastRadiusOuter  || 5.0;
  const fragM   = preset.fragmentRadius    || 15;
  const dM = Math.hypot(x - bx, y - by) / PX_PER_M_FALLBACK;
  const losBlocked = (typeof isLOSBlockedForBlast === 'function')
    ? isLOSBlockedForBlast(bx, by, x, y) : false;
  // 폭풍 위해 — 치명 반경 안이면 1, outer에서 0
  let harm;
  if (dM <= lethalM) harm = 1;
  else if (dM >= outerM) harm = 0;
  else harm = 1 - (dM - lethalM) / Math.max(0.001, outerM - lethalM);
  // 파편 위해 — outer 밖이어도 파편 반경 안이면 남는다.
  //   fragmentRadius(M67 = 18m)는 사상 반경이지 치명 반경이 아니다. 선형으로 두면
  //   8m 떨어진 아군까지 0.25가 나와서 "알고 있는 수류탄"에도 전원이 반응했다(실측).
  //   제곱 감쇠 — 8m에서 0.14, 3m에서 0.31.
  if (dM < fragM) { const k = 1 - dM / fragM; harm = Math.max(harm, 0.45 * k * k); }
  if (losBlocked) harm *= GRENADE_LOS_RELIEF;
  return { harm, dM, losBlocked };
}

// 이 수류탄이 나에게 실제로 얼마나 위험한가.
//   harm 0..1 — 1이면 치명 반경 안. 팀·소유와 무관한 순수 물리 추정이다.
function grenadeThreatToUnit(unit, st) {
  const preset = THROWABLE_PRESETS[st.id];
  if (!preset) return null;
  // 위험 위치 — 공중이면 예상 착지점, 착지 후면 실제 위치
  let dangerX, dangerY;
  if (st.grenadePhase === 'airborne') {
    dangerX = st.predictedLandingX != null ? st.predictedLandingX : (st.targetX != null ? st.targetX : st.curX);
    dangerY = st.predictedLandingY != null ? st.predictedLandingY : (st.targetY != null ? st.targetY : st.curY);
  } else {
    dangerX = st.landedX != null ? st.landedX : (st.curX != null ? st.curX : st.targetX);
    dangerY = st.landedY != null ? st.landedY : (st.curY != null ? st.curY : st.targetY);
  }
  if (dangerX == null || dangerY == null) return null;
  // 던진 주체 — 팀은 지연 해석(startThrow가 못 채운 경우 대비)
  if (st._thrownByTeam == null && st._thrownByUnitId != null && typeof unitById === 'function') {
    const thr = unitById(st._thrownByUnitId);
    if (thr) st._thrownByTeam = thr.team;
  }
  const mine = (st._thrownByUnitId != null && st._thrownByUnitId === unit.id);
  const friendly = !mine && (st._thrownByTeam != null && st._thrownByTeam === unit.team);
  const b = blastHarmAt(preset, dangerX, dangerY, unit.x, unit.y);
  return {
    harm: b.harm, dM: b.dM, dangerX, dangerY, losBlocked: b.losBlocked, mine, friendly, preset,
    // 놀랄 일인가 — 내가 던졌거나 아군이 던진 건 이미 알고 있는 것이다
    surprise: !(mine || friendly),
  };
}

// 매 unit tick — 가까운 수류탄 감지 + 반응 시작
function tickGrenadeReaction(unit, dt) {
  // [HF1] grenadeProne 완료 검사 — 즉시 위험이 사라지고 강제 prone이 끝나면 command를 완료하고
  //   중단됐던 플레이어 경로를 자동 복구한다(자세는 강제 복귀시키지 않는다).
  {
    const _st = unit.aiCommandState;
    const _pend = _st && (_st.lastInstant || _st.current);
    if (_pend && _pend.source === 'immediate_grenade' && _pend.actionType === 'grenadeProne' && _pend.restorePlayerOnComplete) {
      const _dangerNow = (typeof getGrenadeDangerForUnit === 'function') ? getGrenadeDangerForUnit(unit) : false;
      const _proneHeld = (unit.forcedProneTimer || 0) > 0;
      const _reacting = !!unit.pendingGrenadeReact || (unit.grenadeReactionDelay || 0) > 0;
      if (!_dangerNow && !_proneHeld && !_reacting && !unit.stanceTransition) {
        completeAICommand(unit, { reason: 'grenade_safe' });
      }
    }
  }
  if (!unit.alive || unit.isDead) return;
  if (unit.isDowned) return;
  // 반응 cooldown
  if (unit.grenadeReactionCooldown > 0) {
    unit.grenadeReactionCooldown = Math.max(0, unit.grenadeReactionCooldown - dt);
  }
  // 보류 반응 대기 — 지연 후 실행
  if (unit.grenadeReactionDelay > 0) {
    unit.grenadeReactionDelay = Math.max(0, unit.grenadeReactionDelay - dt);
    if (unit.grenadeReactionDelay === 0 && unit.pendingGrenadeReact) {
      executeGrenadeReaction(unit, unit.pendingGrenadeReact);
      unit.pendingGrenadeReact = null;
    }
    return;
  }
  // 강제 prone 진행
  if (unit.forcedProneTimer > 0) {
    unit.forcedProneTimer = Math.max(0, unit.forcedProneTimer - dt);
    if (unit.forcedProneTimer === 0 && unit.stance === 'prone' && !unit.stanceTransition) {
      // utility prone은 즉시 기상 X — Utility AI 재평가에 맡김
      // grenade/panic prone은 자동 기상 시도
      if (unit._proneReason === 'grenade' || unit._proneReason === 'panic') {
        if (typeof exitProne === 'function') exitProne(unit, 'forcedProneTimer_expired');
        else unit.stance = 'standing';
      }
      // utility prone은 그대로 두면 Utility AI가 다음 tick에 평가 후 exitProne 호출
    }
  }

  // 새 수류탄 감지
  if (!GAME.flyingThrowables || GAME.flyingThrowables.length === 0) return;
  if (!unit.grenadeReactedIds) unit.grenadeReactedIds = new Set();

  const prof = getReactionProfile(unit);

  for (const st of GAME.flyingThrowables) {
    // 이미 반응한 수류탄
    const gid = st._instId || (st._instId = `g${(GAME.gameTime || 0).toFixed(2)}_${Math.random().toString(36).slice(2,6)}`);
    if (unit.grenadeReactedIds.has(gid)) continue;
    // 신관 0이면 곧 폭발 — 반응 무의미
    if (st.fuseTimer <= 0.1) continue;
    // 위치: 비행 중이면 curX/Y, 착탄 후엔 그대로
    const gx = st.curX != null ? st.curX : st.targetX;
    const gy = st.curY != null ? st.curY : st.targetY;
    const preset = THROWABLE_PRESETS[st.id];
    if (!preset) continue;
    if (st.grenadePhase === 'exploded') continue;   // 폭발 후는 회피 대상 X

    // _thrownByTeam 추출 먼저
    if (st._thrownByTeam == null && st._thrownByUnitId) {
      const thr = unitById(st._thrownByUnitId);
      if (thr) st._thrownByTeam = thr.team;
    }

    // === 위험 위치 결정 — phase에 따라 ===
    let dangerX, dangerY;
    if (st.grenadePhase === 'airborne') {
      // 공중 — 예상 착지점 또는 trajectory 끝
      dangerX = st.predictedLandingX != null ? st.predictedLandingX : (st.targetX || gx);
      dangerY = st.predictedLandingY != null ? st.predictedLandingY : (st.targetY || gy);
    } else {
      // landed — 실제 착지 위치
      dangerX = st.landedX != null ? st.landedX : gx;
      dangerY = st.landedY != null ? st.landedY : gy;
    }
    const dPx = Math.hypot(unit.x - dangerX, unit.y - dangerY);
    const dM = dPx / PX_PER_M_FALLBACK;

    // 수류탄 이동 방향 — vel dot toUnit 으로 다가오는지 판정 (tickThrowable에서 갱신된 값 사용)
    let movingTowardUnit = false;
    let closestApproachDist = dPx;
    if (st.velX != null && st.speed > 0.01) {
      // toUnit 벡터 (grenade → unit)
      const tuX = unit.x - gx, tuY = unit.y - gy;
      const dot = st.velX * tuX + st.velY * tuY;
      movingTowardUnit = dot > 0;
      // 최근접 거리 (line vs point) — 대략적인 추정
      if (movingTowardUnit) {
        const speedSq = st.speed * st.speed;
        const tProj = Math.max(0, dot / speedSq);   // 도달 시간 (sec, 단순화)
        const projX = gx + st.velX * tProj;
        const projY = gy + st.velY * tProj;
        closestApproachDist = Math.hypot(unit.x - projX, unit.y - projY);
      }
    }

    // === 소유 인식 — 내가/아군이 던진 것은 이미 알고 있다. 놀랄 일이 아니다 ===
    //   무시가 아니라 위해 추정이다: 튕겨 돌아온 자기 수류탄은 그대로 회피시킨다.
    let ownerThreat = null;
    if (isGrenadeOwnerAwareOn()) {
      ownerThreat = grenadeThreatToUnit(unit, st);
      if (ownerThreat && (ownerThreat.mine || ownerThreat.friendly)) {
        if (ownerThreat.harm < GRENADE_HARM_NOTICE) {
          unit._lastGrenadeReactDebug = {
            ignored: ownerThreat.mine ? 'own_grenade_safe' : 'friendly_grenade_safe',
            dM: ownerThreat.dM, harm: +ownerThreat.harm.toFixed(2), blocked: ownerThreat.losBlocked,
          };
          continue;
        }
        // 눈길은 주되 놀라지 않는다 — decideGrenadeReaction이 surprise=false로 처리한다
        decideGrenadeReaction(unit, st, ownerThreat.dangerX, ownerThreat.dangerY, ownerThreat.dM, preset, prof,
                              { surprise: false, harm: ownerThreat.harm, losBlocked: ownerThreat.losBlocked });
        unit.grenadeReactedIds.add(gid);
        return;
      }
    }

    // === 같은 팀 수류탄 — phase별 분기 (소유 인식 OFF일 때의 기존 경로) ===
    if (st._thrownByTeam === unit.team) {
      if (st.grenadePhase === 'airborne') {
        // airborne: 예상 착지점 멀고 + 다가오지 않고 + 최근접 거리도 안전이면 무시
        const predictedFar = dM > 5;
        const closestSafe = closestApproachDist > 4 * PX_PER_M_FALLBACK;   // 4m+ 빗나감
        if (predictedFar && !movingTowardUnit && closestSafe) {
          unit._lastGrenadeReactDebug = {
            ignored: 'sameTeam_airborne_far', dM,
            predictedFar, closestSafe, movingTowardUnit,
            closestApproachM: (closestApproachDist / PX_PER_M_FALLBACK).toFixed(1),
          };
          continue;
        }
      } else {
        // landed: 5m+ 멀고 fuse 1.5s+ 남았으면 무시 (LOS 막혔거나 멀면 안전)
        const fuseLong = (st.fuseTimer || 0) > 1.5;
        if (dM > 5 && fuseLong) {
          let blocked = false;
          if (typeof isLOSBlockedForBlast === 'function') {
            blocked = isLOSBlockedForBlast(unit.x, unit.y, dangerX, dangerY);
          }
          if (blocked || dM > 7) {
            unit._lastGrenadeReactDebug = { ignored: 'sameTeam_landed_far_safe', dM, blocked };
            continue;
          }
        }
      }
    }

    // 감지 반경 — fragmentRadius 75% × 훈련도
    const detectM = (preset.fragmentRadius || 18) * 0.75 * prof.detectRangeMul;
    if (dM > detectM) continue;

    // 반응 결정
    decideGrenadeReaction(unit, st, dangerX, dangerY, dM, preset, prof);
    unit.grenadeReactedIds.add(gid);
    return;
  }
}

// 반응 결정 — 회피 또는 prone
//   opts.surprise === false 면 "이미 알고 있던 수류탄"이다(내가 던졌거나 아군이 던졌다).
//   놀라지 않으므로 패닉이 없고 반응이 빠르다. 다만 위해 추정이 높으면 회피는 그대로 한다.
function decideGrenadeReaction(unit, throwState, gx, gy, dM, preset, prof, opts) {
  const o = opts || {};
  const known = (o.surprise === false);
  // 반응 지연 — 훈련도별. RNG는 어느 경로든 같은 수를 소비한다(스위치 OFF 동작 보존).
  const baseDelay = prof.delayMin + Math.random() * (prof.delayMax - prof.delayMin);
  const supPen = ((unit.suppression || 0) / 100) * 0.3;
  const painPen = ((unit.pain || 0) / 100) * 0.2;
  let delay = baseDelay + supPen + painPen;
  if (known) delay *= 0.45;             // 날아오는 걸 보고 있었다
  const fuseLeft = throwState.fuseTimer;
  const effectiveTime = fuseLeft - delay;
  const panicRoll = (Math.random() < prof.panicChance) || ((unit.pain || 0) > 70);
  const panicked = known ? false : panicRoll;

  // === 현실적 위협 평가 ===
  // 1) LOS 차단 여부 — 수류탄과 유닛 사이에 벽/full cover가 있으면 위협 크게 감소
  let losBlocked = false;
  if (typeof isLOSBlockedForBlast === 'function') {
    losBlocked = isLOSBlockedForBlast(gx, gy, unit.x, unit.y);
  }
  // 2) 이동 가능 거리 — stance-aware (prone이면 30% 속도로 crawl)
  const stanceMul = (typeof getStanceMoveMul === 'function') ? getStanceMoveMul(unit) : 1.0;
  // 이미 prone이면 일어서서 도망갈 시간 빼기 (대략 0.45초)
  const isProneAlready = (unit.stance === 'prone' || unit.stance === 'goingProne');
  const getupTime = isProneAlready ? 0.45 : 0;
  const effectiveRunTime = Math.max(0, effectiveTime - getupTime);
  // 일어서면 일반 속도 5m/s, 못 일어나면 crawl 1.5m/s
  const effSpeed = (isProneAlready && getupTime > effectiveTime) ? (5.0 * stanceMul) : 5.0;
  const escapeMaxM = effectiveRunTime * effSpeed;
  const escapeMaxPx = escapeMaxM * PX_PER_M_FALLBACK;
  // 3) 위험 반경 — 폭발 반경 또는 파편 거리
  const lethalM = preset.blastRadiusLethal || 2.0;
  const fragR = preset.fragmentRadius || 15;

  let type;
  // LOS 차단 + 어느 정도 거리 — 위협 낮음, 자세만 prone으로 낮춤
  if (losBlocked && dM > lethalM + 1.0) {
    type = 'prone';   // 가만히 엎드려서 파편 회피
  } else if (effectiveTime <= 0.6) {
    type = 'prone';   // 시간 부족
  } else if (effectiveTime <= 1.6) {
    // 시간 애매 — 짧은 이동 가능 거리 안에 있으면 evade, 아니면 prone
    if (escapeMaxM >= 3.5 && !panicked) type = 'evade';
    else type = 'prone';
  } else {
    // 시간 충분 — 단 멀리 이동 못 하면 prone이 더 유리
    if (panicked) type = 'prone';
    else if (escapeMaxM >= 4.0) type = 'evade';
    else type = 'prone';
  }

  // 알고 있던 수류탄이면 엎드리기보다 **비켜선다** — 반경 밖으로 나갈 수만 있으면.
  //   자기/아군 수류탄에 팀 전체가 바닥에 눕는 그림을 없애는 지점이다.
  if (known && type === 'prone' && effectiveTime > 0.5) {
    const outerM = preset.blastRadiusOuter || 5.0;
    const needM = Math.max(0, outerM - dM) + 0.5;
    if (escapeMaxM >= needM) type = 'evade';
  }

  // evade 거리 — 남은 시간에 실제 도달 가능한 거리로 제한
  let evadeDist = prof.evadeDistMin + Math.random() * (prof.evadeDistMax - prof.evadeDistMin);
  if (type === 'evade') {
    // 시간이 짧으면 짧게, 충분하면 정상 거리 — 단 escape 가능 거리의 70%까지만
    const maxAllowed = Math.max(1.5, escapeMaxM * 0.7);
    if (evadeDist > maxAllowed) evadeDist = maxAllowed;
  }

  unit.pendingGrenadeReact = {
    type, gx, gy, dM, preset, panicked,
    evadeDist,
    losBlocked,
    effectiveTime,
    known,
    launchX: throwState.launchX || throwState._launchX,
    launchY: throwState.launchY || throwState._launchY,
    throwerId: throwState._thrownByUnitId,
  };
  unit.grenadeReactionDelay = delay;
  unit._wasInGrenadeReaction = true;
  // 결정 시점 — 가벼운 alert 텍스트만 (실제 행동은 execute에서)
  //   알고 있던 수류탄은 경보가 아니다. 로그도 FX도 조용한 쪽으로 낸다.
  if (unit.team === 'friend') {
    if (known) log(`[${unit.name}] 아군 폭발물 — ${type === 'prone' ? '자세 낮춤' : '반경 밖으로'}`, 'info');
    else log(`[${unit.name}] GRENADE? (${type === 'prone' ? '엎드림 준비' : '회피 준비'}${panicked ? ' · 패닉' : ''}${losBlocked ? ' · 벽뒤' : ''})`, 'danger');
  }
  GAME.fxList.push({
    type: 'react_text',
    x: unit.x, y: unit.y - 14,
    text: known ? 'CLEAR!' : 'GRENADE?',
    color: known ? '#8fd8ff' : '#ffcc40',
    life: 0.8, maxLife: 0.8,
  });
}

// 반응 실행 — 회피 이동 명령 또는 prone 진입
function executeGrenadeReaction(unit, react) {
  if (!unit.alive || unit.isDead || unit.isDowned) return;
  const dxPx = unit.x - react.gx, dyPx = unit.y - react.gy;
  const lenPx = Math.hypot(dxPx, dyPx);
  if (react.type === 'evade') {
    // === 기본 방향 (수류탄 반대편) ===
    let baseNdx = 0, baseNdy = 0;
    if (lenPx < UNIT_RADIUS * 2.5) {
      // 거리 매우 가까움(< 1.5m) — grenade 진행 방향 반대로
      if (unit.throwState && unit.throwState.trajectory) {
        const traj = unit.throwState.trajectory;
        const sx = unit.throwState.launchX, sy = unit.throwState.launchY;
        const tdx = traj.endX - sx, tdy = traj.endY - sy;
        const tlen = Math.hypot(tdx, tdy);
        if (tlen > 0.01) { baseNdx = -tdx / tlen; baseNdy = -tdy / tlen; }
      }
      if (baseNdx === 0 && baseNdy === 0 && GAME.flyingThrowables) {
        for (const st of GAME.flyingThrowables) {
          const gx = st.curX != null ? st.curX : st.targetX;
          const gy = st.curY != null ? st.curY : st.targetY;
          if (Math.hypot(unit.x - gx, unit.y - gy) < UNIT_RADIUS * 4) {
            const sx = st.launchX, sy = st.launchY;
            const tdx = (st.targetX || gx) - sx, tdy = (st.targetY || gy) - sy;
            const tlen = Math.hypot(tdx, tdy);
            if (tlen > 0.01) { baseNdx = -tdx / tlen; baseNdy = -tdy / tlen; }
            break;
          }
        }
      }
      if (baseNdx === 0 && baseNdy === 0) {
        baseNdx = -Math.cos(unit.facing); baseNdy = -Math.sin(unit.facing);
      }
    } else if (lenPx > 0.001) {
      baseNdx = dxPx / lenPx; baseNdy = dyPx / lenPx;
    } else {
      baseNdx = -Math.cos(unit.facing); baseNdy = -Math.sin(unit.facing);
    }
    const baseAng = Math.atan2(baseNdy, baseNdx);
    const evadePx = react.evadeDist * PX_PER_M_FALLBACK;
    // === 후보 각도 — 정면(0) / ±30° / ±60°. 패닉이면 jitter 추가 ===
    const offsets = react.panicked
      ? [0, 0.5236, -0.5236, 1.047, -1.047]
      : [0, 0.5236, -0.5236, 1.047, -1.047];
    let chosenX = null, chosenY = null;
    const debugCandidates = [];
    for (const off of offsets) {
      const a = baseAng + off + (react.panicked ? (Math.random() - 0.5) * 0.3 : 0);
      const tx = unit.x + Math.cos(a) * evadePx;
      const ty = unit.y + Math.sin(a) * evadePx;
      // validateMoveTarget — 물리 + 수류탄 위험 (allowDanger=true: 즉시 위협 회피라 위험 입구는 허용)
      const v = (typeof validateMoveTarget === 'function')
        ? validateMoveTarget(unit, tx, ty, { allowDanger: true, allowGrenade: false })
        : { valid: true };
      debugCandidates.push({ a, tx, ty, valid: v.valid, reason: v.reason });
      if (v.valid) { chosenX = tx; chosenY = ty; break; }
    }
    unit._lastEvadeCandidates = debugCandidates;
    if (chosenX != null) {
      issueMoveOrder(unit, chosenX, chosenY, { source: 'immediate_grenade', actionType: 'grenadeEvade' });
      unit.shotQueue = null;
      unit.grenadeReactionCooldown = 1.5;
      _showReactText(unit, react.panicked ? 'PANIC EVADE!' : 'EVADE!', react.panicked ? '#ff6060' : '#ffe066');
      _recordGrenadeThreat(unit, react);
      return;
    }
    // 모든 후보 invalid → prone fallback
    react.type = 'prone';
  }
  // === Prone 진입 — helper 사용 ===
  if (typeof enterProne === 'function') {
    enterProne(unit, 'grenade', 1.5 + Math.random() * 1.5);
  } else {
    unit.stance = 'prone';
    unit.forcedProneTimer = 1.5 + Math.random() * 1.5;
    issueAICommand(unit, { type: 'stance', source: 'immediate_grenade', actionType: 'grenadeProne', reason: 'grenade_prone', restorePlayerOnComplete: true });
    unit.movePath = [];   // 즉시 생존 반응 — executor 정지
    unit.shotQueue = null;
  }
  unit.grenadeReactionCooldown = 1.0;
  _showReactText(unit, react.panicked ? 'PANIC PRONE!' : 'PRONE!', react.panicked ? '#ff6060' : '#ffa040');
  _recordGrenadeThreat(unit, react);
}

// 헬퍼 — 폭발 시점에 가까운 모든 유닛에 grenade event 기록
//   효과: lastGrenadeEvent + grenadeSourceWatchTimer 설정 → 폭발 후 일정 시간 그 방향 우선
function _recordGrenadeEvent(throwState, ex, ey) {
  if (!throwState || typeof UNITS === 'undefined' || !Array.isArray(UNITS)) return;
  // suspectedSource 계산
  let sx = null, sy = null;
  if (throwState.launchX != null) { sx = throwState.launchX; sy = throwState.launchY; }
  else if (throwState._thrownByUnitId) {
    const t = unitById(throwState._thrownByUnitId);
    if (t) { sx = t.x; sy = t.y; }
  }
  // suspected source가 없으면 비행 벡터 반대 (착지점에서 발사점 방향)
  if (sx == null && throwState.incomingDir != null) {
    const dist = 200;
    sx = ex - Math.cos(throwState.incomingDir) * dist;
    sy = ey - Math.sin(throwState.incomingDir) * dist;
  }
  const now = GAME.gameTime || 0;
  for (const u of UNITS) {
    if (!u.alive || u.isDead) continue;
    // 폭발 위치에서 일정 반경 안 또는 LOS 통과 유닛만
    const d = Math.hypot(u.x - ex, u.y - ey) / PX_PER_M_FALLBACK;
    if (d > 15) continue;   // 15m 이상은 인식 안 함
    const realDir = (sx != null) ? Math.atan2(sy - u.y, sx - u.x) : null;
    u.lastGrenadeEvent = {
      explosionX: ex, explosionY: ey,
      landedX: throwState.landedX, landedY: throwState.landedY,
      suspectedSourceX: sx, suspectedSourceY: sy,
      suspectedDir: realDir,
      sourceConfidence: (throwState.launchX != null ? 1.0 : (throwState._thrownByUnitId ? 0.7 : 0.4)),
      time: now,
    };
    // 일정 시간 그 방향 우선 감시
    u.grenadeSourceWatchTimer = 3.0;
    if (realDir != null && u.aiMemory) {
      u.aiMemory.preferredWatchAngle = realDir;
    }
  }
}

// 헬퍼 — react 텍스트 띄움
function _showReactText(unit, text, color) {
  GAME.fxList.push({
    type: 'react_text',
    x: unit.x, y: unit.y - 14,
    text, color,
    life: 1.5, maxLife: 1.5,
  });
}

// 헬퍼 — 수류탄 위협 방향 기록 (폭발 후 holdAngle 방향으로 사용)
function _recordGrenadeThreat(unit, react) {
  if (!react) return;
  let sx = null, sy = null, dir = null;
  // 1순위: 명시적 launch 위치
  if (react.launchX != null && react.launchY != null) {
    sx = react.launchX; sy = react.launchY;
  } else if (react.throwerId) {
    // 2순위: thrower 현재 위치
    const t = unitById(react.throwerId);
    if (t) { sx = t.x; sy = t.y; }
  }
  if (sx == null) {
    // 3순위: lastSeenEnemy
    const mem = unit.aiMemory;
    if (mem && mem.lastSeenEnemy) { sx = mem.lastSeenEnemy.x; sy = mem.lastSeenEnemy.y; }
  }
  if (sx == null) {
    // 4순위: grenade 방향 반대 (폭발 위치의 반대편이 source일 확률)
    sx = unit.x - (react.gx - unit.x);
    sy = unit.y - (react.gy - unit.y);
  }
  if (sx != null) {
    dir = Math.atan2(sy - unit.y, sx - unit.x);
  }
  // [HF1] grenade evidence — 수류탄 자체 위치는 관측된 값이므로 positionKnown=true. 동일 투척물은 1개 항목을 갱신.
  if (typeof recordThreatEvidence === 'function' && react.gx != null) {
    const _fuse = (react.fuseLeft != null) ? react.fuseLeft : (react.fuse != null ? react.fuse : 1.0);
    const _dG = Math.hypot(react.gx - unit.x, react.gy - unit.y);
    recordThreatEvidence(unit, { kind: 'grenade', positionKnown: true, x: react.gx, y: react.gy,
      confidence: 0.7, danger: Math.max(0, Math.min(1, 1 - _dG / (8 * PX_PER_M_FALLBACK))) * (1 / Math.max(0.3, _fuse)),
      sourceEventId: 'gren' + (react.throwableId != null ? react.throwableId : (react.throwerId != null ? react.throwerId : 'x')), ttl: 5 });
  }
  unit.lastGrenadeThreat = {
    explosionX: react.gx, explosionY: react.gy,
    suspectedSourceX: sx, suspectedSourceY: sy,
    suspectedDir: dir,
    time: GAME.gameTime || 0,
    confidence: react.launchX != null ? 1.0 : (react.throwerId ? 0.7 : 0.4),
  };
  // preferredWatchAngle 갱신 — 폭발 후 그쪽 face
  if (dir != null && unit.aiMemory) {
    unit.aiMemory.preferredWatchAngle = dir;
  }
}

// =============================================================
// Prone 자세 전환 helper — enterProne / exitProne / tickStanceTransition
// =============================================================
//   - 즉시 전환 X, 0.35~0.75초 전환 시간
//   - downed/dead 유닛은 transition으로 standing이 되지 않음
//   - forcedProneTimer/stanceTransition은 자동 stance 계산보다 우선

function getStanceTransitionDuration(unit, kind) {
  const skill = (unit.skill && unit.skill.presetId) || 'regular';
  let dur;
  if (kind === 'goingProne') {
    dur = 0.45;
    if (skill === 'veteran') dur = 0.40;
    else if (skill === 'elite') dur = 0.35;
    else if (skill === 'recruit') dur = 0.55;
  } else {   // gettingUp
    dur = 0.60;
    if (skill === 'veteran') dur = 0.52;
    else if (skill === 'elite') dur = 0.45;
    else if (skill === 'recruit') dur = 0.75;
  }
  // 부상/제압이면 느려짐
  if ((unit.pain || 0) > 60) dur *= 1.3;
  if ((unit.suppression || 0) > 60) dur *= 1.15;
  return dur;
}

function enterProne(unit, reason, duration) {
  if (!unit.alive || unit.isDead) return;
  const now = GAME.gameTime || 0;
  // 이미 prone이면 timer만 갱신
  if (unit.stance === 'prone' && !unit.stanceTransition) {
    if (duration != null) unit.forcedProneTimer = Math.max(unit.forcedProneTimer || 0, duration);
    return;
  }
  const total = getStanceTransitionDuration(unit, 'goingProne');
  unit.stanceTransition = {
    from: unit.stance || 'standing',
    to: 'prone',
    timer: total,
    total,
    reason: reason || 'manual',
  };
  unit._proneReason = reason || 'manual';
  unit.forcedProneTimer = duration != null ? duration : 1.5;
  unit.lastProneEnterTime = now;
  // utility prone은 별도 lock — 너무 빨리 일어나지 못함 (2.5~4초)
  if (reason === 'utility') {
    unit.proneLockUntil = now + 2.5 + Math.random() * 1.5;
  } else {
    unit.proneLockUntil = now + 1.0;   // grenade/panic도 최소 1초는 유지
  }
  // 이동 중단 (회피 prone 등)
  if (reason === 'grenade' || reason === 'panic') {
    issueAICommand(unit, { type: 'stance', source: (reason === 'grenade' ? 'immediate_grenade' : (reason === 'panic' ? 'acute_survival' : 'utility')), actionType: (reason === 'grenade' ? 'grenadeProne' : 'enterProne'), reason: reason || null, restorePlayerOnComplete: (reason === 'grenade') });
    unit.movePath = [];   // 자세 강제 — executor 정지
    unit.shotQueue = null;
  }
}

function exitProne(unit, reason) {
  if (unit.isDowned || unit.isDead) return false;
  if (unit.stance !== 'prone') return false;
  const now = GAME.gameTime || 0;
  // 위험이 남아 있으면 즉시 일어나지 않음
  if (unit.forcedProneTimer > 0) return false;
  if (unit.pendingGrenadeReact || unit.grenadeReactionDelay > 0) return false;
  // proneLockUntil 안이면 거부 (단 grenade reaction은 별도)
  if (unit.proneLockUntil != null && now < unit.proneLockUntil) return false;
  const total = getStanceTransitionDuration(unit, 'gettingUp');
  unit.stanceTransition = {
    from: 'prone',
    to: 'standing',
    timer: total,
    total,
    reason: reason || 'manual',
  };
  unit._proneReason = null;
  unit.lastProneExitTime = now;
  return true;
}

// 매 unit tick에서 호출 — stanceTransition timer 진행
function tickStanceTransition(unit, dt) {
  if (!unit.stanceTransition) return;
  // medical.stanceChangeMul 적용 — 통증/저혈압/호흡곤란/다리손상 시 자세전환 느려짐
  const sMul = (unit.medical && unit.medical.stanceChangeMul != null)
    ? Math.max(0.15, Math.min(1.15, unit.medical.stanceChangeMul)) : 1.0;
  unit.stanceTransition.timer -= dt * sMul;
  if (unit.stanceTransition.timer <= 0) {
    // 완료 — 상태 적용 (단 dead/downed면 prone 강제)
    if (unit.isDead || unit.isDowned) {
      unit.stance = 'prone';
    } else {
      unit.stance = unit.stanceTransition.to;
    }
    unit.stanceTransition = null;
  } else {
    // 진행 중에는 stance를 transition.to로 점진 표시
    //   goingProne 절반 이상 진행 시 시각적으로 prone로 표시 (낮춰진 모습)
    //   gettingUp 절반 이상 진행 시 standing 표시
    if (unit.stanceTransition.timer < unit.stanceTransition.total * 0.5) {
      unit.stance = unit.stanceTransition.to;
    } else {
      unit.stance = unit.stanceTransition.from;
    }
  }
}

// === 표시용 effectiveStance — 실제 상태 우선순위 결정 ===
//   prone/transition/downed 등 다중 상태를 정확히 표시
function getEffectiveStance(unit) {
  if (!unit.alive || unit.isDead) return 'dead';
  if (unit.isDowned && unit.conscious === false) return 'unconscious';
  if (unit.isDowned) return 'downed';
  // stanceTransition 우선
  if (unit.stanceTransition) {
    if (unit.stanceTransition.to === 'prone') return 'goingProne';
    if (unit.stanceTransition.to === 'standing' || unit.stanceTransition.to === 'crouched') return 'gettingUp';
  }
  // forcedProneTimer 또는 stance=prone
  if (unit.stance === 'prone' || unit.forcedProneTimer > 0) return 'prone';
  if (unit.pinned) return 'pinned';
  if (unit.movePath && unit.movePath.length > 0) return 'moving';
  if (unit.stance === 'crouched') return 'crouched';
  return 'standing';
}

function getEffectiveStanceKor(unit) {
  const s = getEffectiveStance(unit);
  return {
    dead: '전투불능',
    unconscious: '의식불명',
    downed: '쓰러짐',
    goingProne: '엎드리는 중',
    prone: '엎드림',
    gettingUp: '일어나는 중',
    pinned: 'PINNED',
    moving: '이동',
    crouched: '낮은자세',
    standing: '서있음',
  }[s] || s;
}

// === Stance 기반 이동 속도 배율 ===
function getStanceMoveMul(unit) {
  const s = getEffectiveStance(unit);
  switch (s) {
    case 'standing': return 1.00;
    case 'moving':   return 1.00;
    case 'crouched': return 0.70;
    case 'pinned':   return 0.50;
    case 'prone':    return 0.30;
    case 'goingProne':
    case 'gettingUp': return 0.20;
    case 'downed':
    case 'unconscious':
    case 'dead': return 0.0;
    default: return 1.00;
  }
}

// === Stance 전술 비용 — goProne 진입 점수에서 차감 ===
function getStanceTacticalCost(unit, ctx, targetStance) {
  if (targetStance !== 'prone') return 0;
  let cost = 20;
  if (ctx.hasPotentialThreat && !ctx.hasImmediateThreat) cost += 5;
  const now = GAME.gameTime || 0;
  if (unit.roomEntryGraceUntil && now < unit.roomEntryGraceUntil) cost += 25;
  if (unit.initialTacticalGraceUntil && now < unit.initialTacticalGraceUntil) cost += 20;
  if (unit.movePath && unit.movePath.length > 0) cost += 25;
  if (ctx.visibleEnemyCount > 0) cost -= 8;
  if (ctx.suppression > 70) cost -= 5;
  if (ctx.recentlyHit) cost -= 5;
  if (ctx.grenadeDanger) cost = 0;
  return Math.max(0, cost);
}

// =============================================================
