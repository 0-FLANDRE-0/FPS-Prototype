// DOOR — 벽 간극에 놓이는 여닫이 문
// =============================================================
//   이 엔진은 전부 축정렬 사각형(AABB) 위에 서 있다 — rayBoxT / pointInWalls /
//   segmentIntersectsRect / circleRectPush. 문짝을 실제로 회전시키면 전부 깨진다.
//
//   그래서 상태를 이산으로 둔다. 닫힘도 열림도 **축정렬 사각형**이다:
//     닫힘 — 간극을 메우는, 벽과 같은 방향의 얇은 판
//     열림 — 경첩 끝에 붙어 벽과 **수직으로** 뻗은 얇은 판
//   스윙은 렌더링만 각도를 보간한다. 충돌·시야·경로는 언제나 둘 중 하나의 AABB를 본다.
//
//   문은 coverObjects에 들어간다. 그러면 pointInWalls / pathBlocked /
//   pathCellWalkableForMap / 엄폐 판정이 아무것도 안 고쳐도 문을 본다.
//   열린 문짝이 시야를 막고 이동을 막는 것 하나로 "길을 방해"와 "약한 엄폐"가 같이 나온다.
//
//   axis   — 'h': 벽이 가로로 뻗음(통행은 세로) / 'v': 그 반대
//   hinge  — 'min' | 'max': 간극의 어느 끝에 경첩이 달렸나
//   swing  — -1 | +1: 열릴 때 문짝이 벽의 어느 쪽으로 나가나 (안여닫이/밖여닫이)
// =============================================================
const DOOR_LEAF_TH = 8;        // 문짝 두께 (px)
const DOOR_OPEN_TIME = 0.9;    // 여는 데 걸리는 시간 (초)
const DOOR_REACH_M = 1.2;      // 이 안에 들어와야 손이 닿는다
const DOOR_PLAN_COST = 6.0;    // 계획에서 닫힌 문 한 칸에 얹는 비용 (셀 단위, 1칸=1.0)

function doorAabb(d, state) {
  const st = state || d.state || 'closed';
  const a = d.gapMin, b = d.gapMax, L = b - a;
  const th = d.leafTh || DOOR_LEAF_TH;
  const mid = d.wallPos + (d.wallTh || th) / 2;
  if (st === 'closed') {
    // 간극을 메운다 — 벽과 같은 방향
    return (d.axis === 'h')
      ? { x: a, y: mid - th / 2, w: L, h: th }
      : { x: mid - th / 2, y: a, w: th, h: L };
  }
  // 열림 — 경첩에서 벽과 수직으로 뻗는다
  const near = (d.hinge === 'max') ? (b - th) : a;             // 경첩쪽 끝
  const far = (d.swing > 0) ? (mid - th / 2) : (mid + th / 2 - L);
  return (d.axis === 'h')
    ? { x: near, y: far, w: th, h: L }
    : { x: far, y: near, w: L, h: th };
}
// 문 객체의 실제 사각형을 현재 상태에 맞춘다 (coverObject로서의 x/y/w/h)
function applyDoorAabb(d) {
  const r = doorAabb(d, d.state);
  d.x = r.x; d.y = r.y; d.w = r.w; d.h = r.h;
  d.closedDoor = (d.state === 'closed');   // isBallisticAbsoluteStopper가 보는 플래그
  return d;
}
// 저작 헬퍼 — 벽 간극 하나에 문을 놓는다.
//   axis 'h': wallPos=벽의 y, gap=[x0,x1]  /  axis 'v': wallPos=벽의 x, gap=[y0,y1]
function makeDoor(id, axis, wallPos, wallTh, gapMin, gapMax, opts) {
  const o = opts || {};
  const d = {
    id, kind: 'door', axis, wallPos, wallTh,
    gapMin, gapMax, leafTh: o.leafTh || DOOR_LEAF_TH,
    hinge: o.hinge || 'min', swing: (o.swing != null) ? o.swing : 1,
    state: o.state || 'closed', transition: null,
    material: o.material || 'wood', armor: (o.armor != null) ? o.armor : 10,
    ricochetBase: (o.ricochetBase != null) ? o.ricochetBase : 0.08,
    // 문짝은 얇고 약하지만 시야는 막는다 — 열려 있어도 판때기는 판때기다
    category: 'fullCover', blocksLOS: true, halfHeight: false, penetrable: true,
    label: o.label || '문',
  };
  return applyDoorAabb(d);
}
function isDoor(o) { return !!(o && o.kind === 'door'); }
function isClosedDoor(o) { return isDoor(o) && o.state === 'closed'; }
function doorsOf(map) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  if (!M || !Array.isArray(M.coverObjects)) return [];
  return M.coverObjects.filter(isDoor);
}
function doorAt(x, y, pad) {
  const p = pad || 0;
  for (const d of doorsOf(null)) {
    if (x >= d.x - p && x <= d.x + d.w + p && y >= d.y - p && y <= d.y + d.h + p) return d;
  }
  return null;
}
// 문 중심 — 간극 한가운데. 접근 목표와 거리 판정에 쓴다.
function doorCenter(d) {
  const mid = (d.gapMin + d.gapMax) / 2, cross = d.wallPos + (d.wallTh || DOOR_LEAF_TH) / 2;
  return (d.axis === 'h') ? { x: mid, y: cross } : { x: cross, y: mid };
}

// 상태 전환 — 여는 동안에는 **닫힘 사각형을 유지**한다(보수적).
//   지오메트리는 전환이 끝나는 순간 한 번만 바뀐다. 그때만 그래프를 무효화한다.
//   전환 중에는 렌더가 스윙 각도를 보간해서 보여 준다.
function setDoorState(d, next, actor) {
  if (!isDoor(d) || d.state === next) return false;
  if (d.transition) return false;             // 이미 여닫는 중
  d.transition = { from: d.state, to: next, t: 0, dur: DOOR_OPEN_TIME, actorId: actor ? actor.id : null };
  if (actor && typeof log === 'function') {
    log(`[${actor.name}] 문 ${next === 'open' ? '여는 중' : '닫는 중'} — ${d.label || d.id}`, 'info');
  }
  return true;
}
// 여닫히는 문짝은 사람을 밀어낸다 — 새 사각형 안에 갇힌 유닛을 밖으로 내보낸다.
//   이게 없으면 문을 연 본인이 문짝 안에 박힌다(pointInWalls 안쪽 = 이동 불가 상태).
function pushUnitsOutOfDoor(d) {
  if (typeof UNITS === 'undefined' || !Array.isArray(UNITS)) return 0;
  const R = (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS : 11;
  let n = 0;
  for (const u of UNITS) {
    if (!u || u.isDead) continue;
    if (u.x < d.x - R || u.x > d.x + d.w + R || u.y < d.y - R || u.y > d.y + d.h + R) continue;
    const cands = [
      { x: d.x - R - 1, y: u.y }, { x: d.x + d.w + R + 1, y: u.y },
      { x: u.x, y: d.y - R - 1 }, { x: u.x, y: d.y + d.h + R + 1 },
    ];
    let best = null, bestD = Infinity;
    for (const c of cands) {
      if (pointInWalls(c.x, c.y, R - 3)) continue;      // 벽으로 밀어넣지 않는다
      if (!pointInMap(c.x, c.y, 0)) continue;
      const dd = Math.hypot(c.x - u.x, c.y - u.y);
      if (dd < bestD) { bestD = dd; best = c; }
    }
    if (best) { u.x = best.x; u.y = best.y; n++; }
  }
  return n;
}
function tickDoors(dt) {
  const doors = doorsOf(null);
  for (const d of doors) {
    const tr = d.transition;
    if (!tr) continue;
    tr.t += dt;
    if (tr.t < tr.dur) continue;
    d.transition = null;
    d.state = tr.to;
    applyDoorAabb(d);
    GAME._doorPushes = (GAME._doorPushes || 0) + pushUnitsOutOfDoor(d);
    // 지오메트리가 실제로 바뀐 순간 — 여기서만 그래프/영역 캐시를 버린다
    try { if (typeof markTacticalGeometryChanged === 'function') markTacticalGeometryChanged(d, 'door_' + tr.to); } catch (e) {}
    GAME._doorEvents = (GAME._doorEvents || 0) + 1;
  }
}
// ---- 상호작용 ----
//   pendingMedic과 같은 모양: 예약 → 접근 → 사거리 도달 시 실행 → 해제.
//   **아군·적 동일 규칙**이다. 문은 누구에게나 같은 물건이다.
const DOOR_REACH_PX = DOOR_REACH_M * 32;      // PX_PER_M — 이 시점엔 아직 상수 선언 전이라 값을 직접 쓴다
const DOOR_LOOKAHEAD_PX = 31;                 // UNIT_RADIUS(11) + 20 — 문에 닿기 직전에 알아챈다
const DOOR_PENDING_TIMEOUT = 6.0;             // 이 안에 못 닿으면 예약을 접는다(문 앞 정체 방지)

// 문 앞 대기 지점 — 유닛이 있는 쪽에서 간극 중심을 향해 한 발 앞
function doorApproachSpot(unit, d) {
  const c = doorCenter(d);
  const off = 11 + 0.6 * 32;                  // UNIT_RADIUS + 0.6m
  if (d.axis === 'h') {
    const s = (unit && unit.y < c.y) ? -1 : 1;
    return { x: c.x, y: c.y + s * off };
  }
  const s = (unit && unit.x < c.x) ? -1 : 1;
  return { x: c.x + s * off, y: c.y };
}
// 진행 방향 바로 앞의 닫힌 문
function closedDoorAhead(unit, ux, uy) {
  if (typeof segmentIntersectsRect !== 'function') return null;
  const x2 = unit.x + ux * DOOR_LOOKAHEAD_PX, y2 = unit.y + uy * DOOR_LOOKAHEAD_PX;
  const p = 8;                                // UNIT_RADIUS - 3
  for (const d of doorsOf(null)) {
    if (d.state !== 'closed') continue;
    if (segmentIntersectsRect(unit.x, unit.y, x2, y2,
        { x: d.x - p, y: d.y - p, w: d.w + 2 * p, h: d.h + 2 * p })) return d;
  }
  return null;
}
function closedDoorAt(x, y, pad) {
  const p = pad || 0;
  for (const d of doorsOf(null)) {
    if (d.state !== 'closed') continue;
    if (x >= d.x - p && x <= d.x + d.w + p && y >= d.y - p && y <= d.y + d.h + p) return d;
  }
  return null;
}
function setPendingDoor(unit, door, opts) {
  if (!unit || !isDoor(door)) return false;
  const o = opts || {};
  if (unit.pendingDoor && unit.pendingDoor.door === door) return true;
  unit.pendingDoor = { door, t: 0, manual: !!o.manual, want: o.want || 'open' };
  if (o.approach && typeof issueMoveOrder === 'function') {
    const s = doorApproachSpot(unit, door);
    const r = issueMoveOrder(unit, s.x, s.y, { source: 'door', actionType: 'doorApproach' });
    if (r && r.accepted === false) { unit.pendingDoor = null; return false; }
  }
  return true;
}
function clearPendingDoor(unit, reason) {
  if (!unit || !unit.pendingDoor) return;
  if (reason && unit.pendingDoor.manual && typeof log === 'function') {
    log(`[${unit.name}] 문 예약 취소 — ${reason}`, 'warn');
  }
  unit.pendingDoor = null;
}
// 반환값 true = 이 프레임엔 제자리에서 기다린다(여는 중).
function tickDoorInteraction(unit, dt) {
  if (!unit) return false;
  const pd = unit.pendingDoor;
  if (!pd) return false;
  if (!unit.alive || unit.isDowned) { unit.pendingDoor = null; return false; }
  const d = pd.door;
  if (!d || d.state === pd.want) { unit.pendingDoor = null; return false; }
  if (d.transition) return true;              // 누군가 여닫는 중 — 끝날 때까지 기다린다
  const c = doorCenter(d);
  if (Math.hypot(unit.x - c.x, unit.y - c.y) <= DOOR_REACH_PX + 11) {
    if (setDoorState(d, pd.want, unit)) {
      GAME._doorOpens = (GAME._doorOpens || 0) + 1;
      if (pd.manual) GAME._doorOpensManual = (GAME._doorOpensManual || 0) + 1;
      else           GAME._doorOpensAuto = (GAME._doorOpensAuto || 0) + 1;
      return true;
    }
    unit.pendingDoor = null;                  // 열지 못했다 — 다음 tick에 다시 판단한다
    return false;
  }
  pd.t += dt;                                 // 아직 접근 중
  if (pd.t > DOOR_PENDING_TIMEOUT) clearPendingDoor(unit, '문에 닿지 못함');
  return false;
}

// =============================================================
// 피킹 — 힐끗 보고 다시 들어온다
// =============================================================
//   지금까지 믿음은 전부 "돌아다니다 우연히 본 것"의 부산물이었다. 피킹은 **의도적 관측**이다 —
//   모르는 걸 알기 위해 위험을 감수하고 정보를 얻으러 나갔다 돌아온다.
//   구조에 없던 건 각도도 자세도 아니라 **왕복**이었다. 지금 모든 행동은 목표에 닿으면 끝난다.
//     나감(out) → 관측 창(look) → 복귀(back)
//   계약: 실패하든 중단되든 **원위치로 돌아온다.**
const PEEK_STEP_M     = 1.0;    // 노출 지점까지 내딛는 거리
const PEEK_LOOK_MIN   = 0.4;    // 관측 창 — 스캔 주기(0.22~0.6초)보다 길어야 한 번은 본다
const PEEK_LOOK_MAX   = 0.9;
const PEEK_TIMEOUT_BASE = 3.0;  // 왕복 제한시간의 고정분
const PEEK_WALK_MPS     = 1.6;  // 보수적인 걷기 속도 — 제한시간을 거리에 맞춰 늘린다
const PEEK_TIMEOUT_MAX  = 14.0;
const PEEK_ARRIVE_PX  = 9;
const PEEK_COOLDOWN   = 6.0;    // 같은 자리에서 계속 고개를 내밀지 않는다

// 관측 이득을 재기 위한 표본 — 피킹 전후로 한 번씩 뜬다
function peekInfoSnapshot(unit) {
  const out = { surfaces: 0, thresholds: 0, rooms: 0, enemies: 0 };
  if (typeof SpatialPerception !== 'undefined') {
    try {
      const S = SpatialPerception.ensureSpatial ? SpatialPerception.ensureSpatial(unit) : null;
      if (S && Array.isArray(S.surfaces)) out.surfaces = S.surfaces.length;
      if (SpatialPerception.thresholdsOf) out.thresholds = (SpatialPerception.thresholdsOf(unit) || []).length;
    } catch (e) { /* 표본 실패는 피킹을 막지 않는다 */ }
  }
  const mem = unit.aiMemory;
  if (mem && mem.knownRooms instanceof Map) out.rooms = mem.knownRooms.size;
  if (typeof getPerceptionSnapshot === 'function') {
    try { out.enemies = getPerceptionSnapshot(unit).visibleCount || 0; } catch (e) { /* 동일 */ }
  }
  return out;
}

// 피킹 예약 — (exX, exY)로 한 발 나갔다가 원위치로 돌아온다.
//   watchX/watchY를 주면 관측 창 동안 그쪽을 본다(보통 문턱 너머 또는 모서리 바깥).
function setPendingPeek(unit, exX, exY, opts) {
  const o = opts || {};
  if (!unit || !unit.alive || unit.isDowned) return false;
  if (unit.pendingPeek) return false;
  const now = GAME.gameTime || 0;
  if (unit._peekCooldownUntil != null && now < unit._peekCooldownUntil) return false;
  if (typeof validateMoveTarget === 'function') {
    const v = validateMoveTarget(unit, exX, exY, {});
    if (v && v.valid === false) return false;              // 나갈 수 없는 자리면 피킹도 없다
  }
  unit.pendingPeek = {
    fromX: unit.x, fromY: unit.y,
    exX, exY,
    watchX: (o.watchX != null) ? o.watchX : exX,
    watchY: (o.watchY != null) ? o.watchY : exY,
    phase: 'out', t: 0, lookT: 0,
    lookTime: PEEK_LOOK_MIN + Math.random() * (PEEK_LOOK_MAX - PEEK_LOOK_MIN),
    reason: o.reason || null,
    // 제한시간은 왕복 거리에 맞춘다 — 고정 5초로 두니 먼 피킹이 통째로 시간초과로 끝났다(실측).
    timeout: Math.min(PEEK_TIMEOUT_MAX,
                      PEEK_TIMEOUT_BASE + 2 * (Math.hypot(exX - unit.x, exY - unit.y) / PX_PER_M_FALLBACK) / PEEK_WALK_MPS),
    before: peekInfoSnapshot(unit),
    after: null, gain: null,
    sawEnemy: false, tookFire: false,
    hpAtStart: (unit.hp != null) ? unit.hp : null,
  };
  GAME._peekStarted = (GAME._peekStarted || 0) + 1;
  return true;
}

function clearPendingPeek(unit, reason) {
  if (!unit || !unit.pendingPeek) return;
  const p = unit.pendingPeek;
  // 이득을 남긴다 — 피킹이 정보를 벌었는지는 나중에 숫자로 답해야 한다
  p.after = peekInfoSnapshot(unit);
  p.gain = {
    surfaces: p.after.surfaces - p.before.surfaces,
    thresholds: p.after.thresholds - p.before.thresholds,
    rooms: p.after.rooms - p.before.rooms,
  };
  p.endReason = reason || null;
  unit._lastPeek = p;
  GAME._peekLog = GAME._peekLog || [];
  GAME._peekLog.push({
    unit: unit.name, reason: p.reason, end: p.endReason,
    gain: p.gain, sawEnemy: p.sawEnemy, tookFire: p.tookFire,
    returned: Math.hypot(unit.x - p.fromX, unit.y - p.fromY) <= PEEK_ARRIVE_PX * 2,
  });
  unit.pendingPeek = null;
  unit._peekCooldownUntil = (GAME.gameTime || 0) + PEEK_COOLDOWN;
}

// 피킹 진행 — 매 unit tick. true를 돌려주면 일반 이동 로직을 잠시 넘긴다.
function tickPeek(unit, dt) {
  const p = unit && unit.pendingPeek;
  if (!p) return false;
  if (!unit.alive || unit.isDowned) { unit.pendingPeek = null; return false; }
  p.t += dt;
  // 피격 기록 — 노출의 대가를 잰다
  if (p.hpAtStart != null && unit.hp != null && unit.hp < p.hpAtStart) p.tookFire = true;
  if (typeof getPerceptionSnapshot === 'function') {
    try { if (getPerceptionSnapshot(unit).visibleCount > 0) p.sawEnemy = true; } catch (e) { /* 관측 실패는 무시 */ }
  }
  // 시간 초과 — 나가는 중이었으면 즉시 복귀로 돌린다. 복귀에도 같은 시간을 다시 준다.
  const tmo = p.timeout || PEEK_TIMEOUT_BASE;
  if (p.t > tmo) {
    if (p.phase !== 'back') { p.phase = 'back'; p.t = 0; }
    else { clearPendingPeek(unit, 'timeout'); return false; }
  }
  // 이동은 AI 명령 게이트웨이를 그대로 경유한다 — movePath를 직접 쓰는 예외를 만들지 않는다.
  //   한 발 거리라 findPath는 직선 단축로에서 끝난다.
  const goTo = (tx, ty) => {
    const d = Math.hypot(tx - unit.x, ty - unit.y);
    if (d <= PEEK_ARRIVE_PX) { return true; }
    if (p._legX !== tx || p._legY !== ty || !unit.movePath || unit.movePath.length === 0) {
      p._legX = tx; p._legY = ty;
      const r = issueMoveOrder(unit, tx, ty, { source: 'peek', actionType: 'peek' });
      if (!r || r.accepted === false) { p.blocked = true; return true; }   // 못 가면 그 다리는 끝난 것으로 본다
    }
    return false;
  };
  if (p.phase === 'out') {
    if (goTo(p.exX, p.exY)) { p.phase = 'look'; p.lookT = 0; }
    return true;
  }
  if (p.phase === 'look') {
    p.lookT += dt;
    if (unit.movePath && unit.movePath.length > 0 && unit._aiCommandPath === unit.movePath) {
      if (typeof completeAICommand === 'function') completeAICommand(unit, { reason: 'peek_look' });
      else unit.movePath = [];
    }
    // 관측 창 동안 그쪽을 본다 — 기존 조준 우선순위 사슬이 소비한다
    const ang = Math.atan2(p.watchY - unit.y, p.watchX - unit.x);
    if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) unit.aiMemory.preferredWatchAngle = ang;
    if (p.lookT >= p.lookTime) p.phase = 'back';
    return true;
  }
  // back — 원위치로. 여기가 계약이다.
  if (goTo(p.fromX, p.fromY)) { clearPendingPeek(unit, 'done'); return false; }
  return true;
}

// =============================================================
// 프래그 후 진입 — 힐끗 보고, 판단하고, 던지고, 터진 뒤 들어간다
// =============================================================
//   이게 0.4초 재평가로는 안 되는 첫 의도다. 준비 0.6초 + 비행 + 신관 4.7초 ≈ 6초,
//   재평가 열네 번. 지금 구조면 던지자마자 다른 행동으로 갈아타고 수류탄은
//   아무도 안 보는 방에서 터진다. 그래서 계획을 하나의 예약으로 들고 간다.
//
//     look → decide → throw → wait → enter
//            ↑ 피킹이 여기서 처음으로 **결정을 바꾼다**
//
//   측정이 팀도 정했다: "들어가야 하는데 그 너머가 뜨겁다"는 상황은
//   적 0.9% vs 아군 80.1%로 거의 전적으로 **돌입 측**에서만 생긴다(0.5초 표본 2,439건).
const FRAG_STANDOFF_M   = 1.4;   // 문설주 옆으로 비켜서는 거리 — 벽이 폭풍을 막아 준다
const FRAG_DEPTH_M      = 4.0;   // 방 안 어디로 던지나 (문턱에서 법선 방향)
const FRAG_WAIT_MAX     = 8.0;   // 폭발을 이만큼 기다리고도 안 터지면 계획을 접는다
const FRAG_APPROACH_MAX = 9.0;   // 한 자리당 접근 제한 — 예산이 따로 있으니 짧게
//   던지기까지의 전체 예산. **거리에 맞춰 늘린다** — 고정 14초로 두었더니 단계 점유의 62%가
//   접근인 이 계획에서 먼 목표는 걸어가다가 끝났다(섬광 8건 중 투척 0, 전부 budget).
//   피킹 제한시간에서 쓴 것과 같은 모양이다.
//   신선도 게이트. 계획은 새 정보로만 출발하고, 걸어온 뒤 낡았으면 던지기 직전에 접는다.
const FRAG_MIN_DANGER   = 3.0;   // 0.5~3 구간은 점유율 29%뿐이다
const FRAG_PLAN_FRESH   = 5.0;   // 출발 시점 (0~5초 = 80~97%)
const FRAG_THROW_FRESH  = 10.0;  // 걸어온 뒤 (0~10초 = 66%+)
const FRAG_BUDGET_BASE  = 6.0;
const FRAG_BUDGET_MPS   = 1.4;   // 보수적인 걷기 속도
const FRAG_BUDGET_MAX   = 22.0;
function fragPlanBudget(distPx) {
  return Math.min(FRAG_BUDGET_MAX, FRAG_BUDGET_BASE + (distPx / PX_PER_M_FALLBACK) / FRAG_BUDGET_MPS);
}
const FRAG_RETRY_CD     = 12.0;  // 못 던지고 끝났으면 이만큼 쉰다 (곧바로 다시 매달리지 않게)
const FRAG_ROOM_COOLDOWN = 45.0; // 같은 방에 두 번 넣지 않는다
const FRAG_ENTER_DELAY  = 0.6;   // 터진 직후 파편이 가라앉을 짬

const USE_FRAG_PLAN = true;
function isFragPlanOn() {
  if (typeof GAME !== 'undefined' && GAME.fragPlanOn != null) return !!GAME.fragPlanOn;
  return USE_FRAG_PLAN;
}

//   들어갈 방에는 **섬광이 먼저다.** 프래그로 방을 여는 건 특수한 경우고,
//   CQB에서 진입 전 표준은 섬광이다. 섬광이 없을 때만 프래그를 쓴다.
function fragThrowableIdFor(unit, kind) {
  if (!unit || !unit.throwables) return null;
  const want = (kind === 'flash') ? 'flash' : (kind === 'smoke') ? 'smoke' : 'frag';
  for (const k in unit.throwables) {
    const P = THROWABLE_PRESETS[k];
    if (unit.throwables[k] > 0 && P && P.type === want) return k;
  }
  return null;
}
function fragLethalIdFor(unit) {
  if (!unit || !unit.throwables) return null;
  for (const k in unit.throwables) {
    if (unit.throwables[k] > 0 && THROWABLE_PRESETS[k]) return k;
  }
  return null;
}

// 문턱 옆 던질 자리 — 개구부 정면이 아니라 **문설주 뒤**다.
//   정면에 서서 4m 앞에 던지면 자기 위해가 0.33이라 안전 게이트가 막는다(그게 맞다).
//   벽 뒤로 비켜서면 LOS가 끊겨 0.07로 떨어진다.
//
//   자리를 하나로 못박지 않는다 — 좌/우 × 이격/후퇴 조합을 실제 궤적 시뮬로 검사해
//   **안전 게이트를 통과하는 첫 자리**를 고른다. 한 자리만 계산했더니 그 자리에서
//   수류탄이 문틀에 튕겨 되돌아와 `unsafe_self_blast`로 절반이 막혔다(실측).
function fragThrowSpot(unit, th, aimX, aimY, throwableId) {
  const l = fragThrowSpots(unit, th, aimX, aimY, throwableId);
  return l.length ? l[0] : null;
}
// 안전한 순서대로 정렬된 후보 목록. 경로가 없거나 위해가 크면 다음 자리를 쓴다 —
//   자리를 하나만 계산하면 그 자리가 못 가는 곳일 때 계획이 통째로 죽는다(실측 no_path_to_spot 6건).
function fragThrowSpots(unit, th, aimX, aimY, throwableId) {
  const nSign = (Math.hypot(th.ix + th.nx - unit.x, th.iy + th.ny - unit.y)
               > Math.hypot(th.ix - th.nx - unit.x, th.iy - th.ny - unit.y)) ? -1 : 1;
  const tx = -th.ny, ty = th.nx;                       // 벽선 방향
  const halfGap = (th.width || 40) / 2;
  const probe = { x: unit.x, y: unit.y, facing: unit.facing, team: unit.team, id: unit.id, alive: true };
  const safeList = [], unsafeList = [];
  for (const backM of [0.8, 1.6, 2.6]) {
    for (const sideM of [FRAG_STANDOFF_M, FRAG_STANDOFF_M * 0.5, FRAG_STANDOFF_M * 1.8]) {
      for (const s of [1, -1]) {
        const side = halfGap + sideM * PX_PER_M_FALLBACK;
        const c = {
          x: th.ix + th.nx * nSign * backM * PX_PER_M_FALLBACK + tx * side * s,
          y: th.iy + th.ny * nSign * backM * PX_PER_M_FALLBACK + ty * side * s,
        };
        // 물리적으로만 본다. 뜨거운 방의 문턱 옆은 언제나 `tacticalInvalid`
        //   (beyondDangerousEntrance / sameAreaAsGunshot)라서, 그걸 그대로 따르면
        //   **던질 만한 방일수록 던질 자리가 없어진다**. 실측에서 후보 18개가 전부 잘렸다.
        if (typeof validateMoveTarget === 'function') {
          const v = validateMoveTarget(unit, c.x, c.y, {});
          if (v && v.valid === false && v.tacticalInvalid !== true) continue;
        }
        if (aimX == null || !throwableId) { safeList.push(c); continue; }
        // 그 자리에 서 있다고 치고 실제 궤적으로 안전을 본다
        probe.x = c.x; probe.y = c.y;
        probe.facing = Math.atan2(aimY - c.y, aimX - c.x);
        const safe = checkThrowSafety(probe, throwableId, aimX, aimY);
        if (safe.safe) safeList.push(c); else unsafeList.push(c);
      }
    }
  }
  // 안전한 자리를 앞에, 그다음이 걸어갈 수는 있는 자리. 던지기 직전에 다시 검사하므로
  //   뒤쪽 자리가 실제로 쓰이면 그때 접힌다.
  return safeList.concat(unsafeList);
}

function setPendingFrag(unit, th, opts) {
  const o = opts || {};
  if (!unit || !unit.alive || unit.isDowned || unit.pendingFrag) return false;
  const kind = o.kind || 'flash';
  const id = fragThrowableIdFor(unit, kind) || fragLethalIdFor(unit);
  if (!id) return false;
  const isFlash = !!(THROWABLE_PRESETS[id] && THROWABLE_PRESETS[id].type === 'flash');
  const spot = fragThrowSpot(unit, th);          // 조준점이 정해지는 decide 단계에서 다시 고른다
  if (!spot) return false;
  unit.pendingFrag = {
    th, id, spot, kind: isFlash ? 'flash' : 'frag',
    budget: fragPlanBudget(Math.hypot(spot.x - unit.x, spot.y - unit.y)),
    aimX: null, aimY: null,
    phase: 'approach', t: 0, phaseT: 0, waitT: 0, enterT: 0, spotIdx: 0,
    reason: o.reason || null,
    roomId: (typeof roomAt === 'function' && th.ax != null) ? ((roomAt(th.ax, th.ay) || {}).id || null) : null,
    sawEnemy: false, threw: false, detonated: false, entered: false,
    abortReason: null,
  };
  GAME._fragPlanStarted = (GAME._fragPlanStarted || 0) + 1;
  return true;
}

// =============================================================
// 연막 차폐 후 횡단 — 접근 구간 없이, 지금 자리에서 건널 곳을 가린다
// =============================================================
//   `pendingFrag`의 **꼬리만** 재사용한다(throw → wait → enter). 머리(approach → look → decide)는
//   안 쓴다 — 그 긴 접근 구간이 이번 세션 내내 계획을 죽인 바로 그 원인이기 때문이다
//   (프래그 중단 사유 1위가 접근/예산이었다). 연막은 성격이 다르다:
//   **던질 자리로 갈 필요가 없다.** 지금 서 있는 곳에서 건널 문을 가리면 된다.
//
//   조준점도 다르다. 프래그는 방 **안쪽 4 m**를 노려 사람을 때리지만,
//   연막은 **문턱 자체**를 덮는다 — 5 m 구름이 문 양쪽을 다 먹어 그 문을 지나는 모든 사선을 끊는다.
const SCREEN_MAX_M    = 14.0;   // 이보다 먼 문은 못 가린다 (투척 사거리 15 m)
const SCREEN_MIN_M    = 2.0;    // 발밑에 던지지 않는다
const SCREEN_BLOOM_MAX = 6.0;   // 초 — 이만큼 기다려도 안 피면 그냥 들어간다
const SCREEN_DENSITY_MIN = 0.45; // 문턱 지점의 연막 밀도가 이 정도면 "섰다"고 본다
const SCREEN_BUDGET   = 12.0;
function setPendingScreen(unit, th, opts) {
  const o = opts || {};
  if (!unit || !unit.alive || unit.isDowned || unit.pendingFrag) return false;
  if (!isSmokeOn() || !th || th.ix == null) return false;
  const id = fragThrowableIdFor(unit, 'smoke');
  if (!id) return false;
  const d = Math.hypot(th.ix - unit.x, th.iy - unit.y);
  if (d < SCREEN_MIN_M * PX_PER_M_FALLBACK || d > SCREEN_MAX_M * PX_PER_M_FALLBACK) return false;
  const into = _peekProbe(th, unit, 1.5);
  unit.pendingFrag = {
    th, id, kind: 'smoke',
    spot: { x: unit.x, y: unit.y }, spots: [{ x: unit.x, y: unit.y }], spotIdx: 0,
    aimX: th.ix, aimY: th.iy,          // 문턱 자체를 덮는다
    enterX: into.x, enterY: into.y,
    budget: SCREEN_BUDGET,
    phase: 'throw', t: 0, phaseT: 0, waitT: 0, enterT: 0,
    reason: o.reason || 'screen',
    roomId: (typeof roomAt === 'function' && th.ax != null) ? ((roomAt(th.ax, th.ay) || {}).id || null) : null,
    sawEnemy: false, threw: false, detonated: false, entered: false, screened: false, ducked: false,
    abortReason: null,
  };
  GAME._screenStarted = (GAME._screenStarted || 0) + 1;
  return true;
}
// 문턱이 실제로 가려졌나 — 시간이 아니라 **상태**를 본다.
//   중심 한 점을 재면 안 된다. 구름 중심 밀도는 생성 직후부터 1.04라 **피어오름을 못 잰다** —
//   자라는 것은 반경이다(자체테스트가 이걸 잡았다). 그래서 문턱을 **가로지르는 선**을 잰다:
//   내가 건너갈 방향에 수직인 SCREEN_SPAN_M 길이의 선이 끊기면 그 문은 가려진 것이다.
const SCREEN_CROSS_M = 8.0;   // 문을 통과하는 방향으로 이만큼이 끊기면 "섰다"고 본다
// 던지고 **빠진다.** 접근 다리를 없앤 대신 대기 구간이 노출됐다 —
//   실측: 차폐 중 피해 초당 3.16으로 미는 중(3.00)과 다르지 않았고,
//   계획 종료 사유 1위가 `switched_to_seekCover`(기다리다 맞아서 엄폐로 갈아탐)였다.
//   연막은 문을 가리지 던지는 사람을 가리지 않는다. 피는 동안은 문설주 뒤에 있어야 한다.
const SCREEN_DUCK_M = 2.8;     // 문턱에서 이만큼 물러선다
const SCREEN_DUCK_MIN_M = 1.2; // 물러설 자리가 없으면 이만큼이라도
const SCREEN_WALK_MPS = 1.6;   // 걷는 속도 근사 — 물러선 거리를 시간으로 환산할 때 쓴다
// 어디로 빠지나 — **뒤로 직선**은 거의 벽이다(실측: 2.8 m 전량 무효, 1.2 m도 4번 중 3번 무효).
//   전술적으로도 틀렸다. 문 앞에서 빠지는 건 뒤로 걷는 게 아니라 **문설주 뒤 옆으로 붙는 것**이다.
//   그래서 부채꼴로 훑고, **문턱이 안 보이는 자리**를 우선한다 — 안 보이면 못 맞힌다.
const SCREEN_DUCK_ARC = [0, -0.6, 0.6, -1.2, 1.2, -1.9, 1.9];   // rad — 뒤 방향 기준 좌우로 벌린다
function pickDuckSpot(unit, p) {
  const dx = unit.x - p.aimX, dy = unit.y - p.aimY;
  const len = Math.hypot(dx, dy) || 1;
  const base = Math.atan2(dy / len, dx / len);
  let fallback = null;
  for (const m of [SCREEN_DUCK_M, 1.9, SCREEN_DUCK_MIN_M]) {
    for (const off of SCREEN_DUCK_ARC) {
      const a = base + off;
      const bx = unit.x + Math.cos(a) * m * PX_PER_M_FALLBACK;
      const by = unit.y + Math.sin(a) * m * PX_PER_M_FALLBACK;
      const v = (typeof validateMoveTarget === 'function') ? validateMoveTarget(unit, bx, by, {}) : null;
      if (v && v.physicalInvalid) continue;
      const hidden = (typeof isLOSBlockedForBlast === 'function')
                   ? isLOSBlockedForBlast(bx, by, p.aimX, p.aimY) : false;
      if (hidden) return { x: bx, y: by, m, hidden: true };     // 문턱이 안 보인다 — 가장 좋은 자리
      if (!fallback) fallback = { x: bx, y: by, m, hidden: false };
    }
  }
  return fallback;
}

// =============================================================
// 방어 측 반응 — 연막은 **누가 온다는 신호**다
// =============================================================
//   이게 없으면 연막은 공격자 전용 치트가 된다. 눈이 가려진 방어자가 수동적이 되는 게 아니라,
//   **자기 문 앞에 연막이 피었다는 사실 자체가 정보**여야 한다.
//
//   새 유틸리티 행동은 만들지 않는다. 이번 세션에서 행동을 더하거나 가격을 바꿀 때마다
//   배분이 예측 불가하게 흔들렸다(guardEntry 32→18→56→49→37, reposition 7→31→14).
//   방어자에겐 이미 `guardEntry`가 적 시간의 37%로 돌고 그건 `beyondRoomDanger`가 몰아준다.
//   그래서 **믿음만 바꾼다** — 문 너머가 뜨겁다고 믿게 하면 기존 소비자가 알아서 한다.
//
//   투시 금지: 벽 너머 연막은 못 본다. 보이는 것에만 반응한다.
const USE_SMOKE_ALERT = true;
function isSmokeAlertOn() {
  if (typeof GAME !== 'undefined' && GAME.smokeAlertOn != null) return !!GAME.smokeAlertOn;
  return USE_SMOKE_ALERT;
}
const SMOKE_ALERT_SEE_M   = 18.0;  // 이보다 멀면 못 본다
const SMOKE_ALERT_NEAR_M  = 6.0;   // 연막이 문턱에서 이 안이면 그 문 이야기다
const SMOKE_ALERT_LEVEL   = 4.0;   // 위험 수준 — FRAG_MIN_DANGER(3.0)보다 위
const SMOKE_ALERT_EVERY   = 0.5;   // 초
function tickSmokeAlert(unit, dt) {
  if (!isSmokeAlertOn() || !isSmokeOn()) return;
  if (!unit || !unit.alive || unit.isDowned) return;
  if (typeof beliefRoomsActiveFor !== 'function' || !beliefRoomsActiveFor(unit)) return;   // 방어 측
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (unit._smokeAlertAt != null && now - unit._smokeAlertAt < SMOKE_ALERT_EVERY) return;
  unit._smokeAlertAt = now;
  const clouds = (GAME.dustClouds || []).filter(c => c.obscurant && c.density > 0.2);
  if (!clouds.length) return;
  const ths = (typeof SpatialPerception !== 'undefined' && SpatialPerception.thresholdsOf)
            ? (SpatialPerception.thresholdsOf(unit) || []) : [];
  if (!ths.length) return;
  const seePx = SMOKE_ALERT_SEE_M * PX_PER_M_FALLBACK;
  const nearPx = SMOKE_ALERT_NEAR_M * PX_PER_M_FALLBACK;
  let best = null, bestD = Infinity;
  for (const c of clouds) {
    if (Math.hypot(c.x - unit.x, c.y - unit.y) > seePx) continue;
    // 벽 너머 연막은 안 보인다 — 연막 자체가 시야를 막지만, **구름이 거기 있다는 것**은 보인다
    if (typeof isLOSBlockedForBlast === 'function' && isLOSBlockedForBlast(unit.x, unit.y, c.x, c.y)) continue;
    for (const t of ths) {
      if (t.ix == null || t.ax == null) continue;
      const d = Math.hypot(c.x - t.ix, c.y - t.iy);
      if (d > nearPx || d >= bestD) continue;
      bestD = d; best = t;
    }
  }
  if (!best) return;
  // 그 문 **너머**가 뜨겁다 — 거기서 누가 온다.
  if (typeof roomAt === 'function' && typeof markRoomDanger === 'function') {
    const r = roomAt(best.ax, best.ay);
    if (r) markRoomDanger(unit, r, SMOKE_ALERT_LEVEL, now);
  }
  // 그리고 그쪽을 본다
  if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) {
    unit.aiMemory.preferredWatchAngle = Math.atan2(best.iy - unit.y, best.ix - unit.x);
  }
  unit._smokeAlertTh = best.name || null;
  unit._smokeAlertAim = { x: best.ix, y: best.iy, t: now };   // 여기로 **쏜다** — 아래 엄호사격 경로가 받는다
  GAME._smokeAlerts = (GAME._smokeAlerts || 0) + 1;
}

function screenIsUp(p, unit) {
  if (typeof sampleDustAlongLOS !== 'function' || !p) return false;
  if (!isFinite(p.aimX) || !isFinite(p.aimY) || !isFinite(p.enterX) || !isFinite(p.enterY)) return false;
  const dx = p.enterX - p.aimX, dy = p.enterY - p.aimY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;                        // 문을 **통과하는** 방향
  // enter가 NaN이면 아래 전부 NaN이 되어 **조용히 항상 false**가 된다. == null은 NaN을 못 막는다.
  if (!isFinite(ux) || !isFinite(uy)) return false;
  // **문 폭 방향으로 재면 안 된다.** 문은 1 m 남짓인데 4 m를 재면 나머지는 벽 속이고,
  //   먼지 구름은 `radial_wall`로 벽에서 잘려 그 표본이 전부 0이 된다 — 구름이 조준점에
  //   만재(4.9m/밀도 1.00)로 앉아 있는데도 차폐 판정이 6회 중 6회 실패했다.
  //   (클립을 벤치로 검증했다가 무효였다: 스폰과 샘플 사이에 렌더가 안 돌아
  //    `clipRadii`가 계산되지 않은 채 비교해서, 클립이 꺼진 것과 같은 결과가 나왔다.)
  //   문을 **통과하는** 방향이 열린 공간이고, 구름이 자라야만 그 길이가 덮인다 —
  //   그래서 기다릴 이유도 여기서 생긴다.
  const h = (SCREEN_CROSS_M / 2) * PX_PER_M_FALLBACK;
  const s = sampleDustAlongLOS(p.aimX - ux * h, p.aimY - uy * h,
                               p.aimX + ux * h, p.aimY + uy * h, {});
  return !!s.blocksVision;
}
// 진단용 — 연막이 조준점에서 얼마나 벗어나 떨어졌나. 6초를 기다려도 안 서는 이유를 이걸로 가른다.
function screenLandOffsetM(p) {
  if (!p || p.aimX == null || typeof GAME === 'undefined' || !GAME.dustClouds) return -1;
  let best = Infinity;
  for (const c of GAME.dustClouds) {
    if (!c.obscurant) continue;
    const d = Math.hypot(c.x - p.aimX, c.y - p.aimY);
    if (d < best) best = d;
  }
  return best === Infinity ? -1 : best / PX_PER_M_FALLBACK;
}

// **누가 이 계획의 주인인가.** 인라인 문자열 비교로 두었더니 `screenThenCross`를 빠뜨려서,
//   계획이 세워지자마자 다음 평가에서 스스로 지워졌다 — 던지고 터지기까지는 갔는데
//   기다리는 구간이 통째로 잘렸다(실측: 투척 8회에 차폐 성공 0회).
//   술어로 뽑아 두면 다음에 다단계 의도를 더할 때 같은 실수를 자체테스트가 잡는다.
function actionOwnsFragPlan(type) {
  return type === 'fragThenEnter' || type === 'screenThenCross';
}

function clearPendingFrag(unit, reason) {
  if (!unit || !unit.pendingFrag) return;
  const p = unit.pendingFrag;
  p.endReason = reason || null;
  GAME._fragLog = GAME._fragLog || [];
  GAME._fragLog.push({
    unit: unit.name, reason: p.reason, end: p.endReason, roomId: p.roomId,
    threw: p.threw, detonated: p.detonated, entered: p.entered,
    sawEnemy: p.sawEnemy, abort: p.abortReason, landOffM: p.landOffM, diag: p.diag, duckWhy: p.duckWhy,
  });
  if (p.threw && p.roomId) {
    unit._fragRoomAt = unit._fragRoomAt || {};
    unit._fragRoomAt[p.roomId] = GAME.gameTime || 0;
  }
  // 못 던지고 끝났으면 잠시 쉰다. 한 계획이 길게 매달려 아무것도 못 하는 것보다,
  //   빨리 접고 다른 걸 하다가 나중에 다시 보는 편이 낫다.
  if (!p.threw) unit._fragRetryUntil = (GAME.gameTime || 0) + FRAG_RETRY_CD;
  unit.pendingFrag = null;
}

// 이 방에 최근에 이미 넣었나
function fragRoomOnCooldown(unit, roomId) {
  if (!roomId || !unit._fragRoomAt) return false;
  const at = unit._fragRoomAt[roomId];
  return at != null && (GAME.gameTime || 0) - at < FRAG_ROOM_COOLDOWN;
}

// 계획 진행 — 매 unit tick.
function tickFragPlan(unit, dt) {
  const p = unit && unit.pendingFrag;
  if (!p) return false;
  if (!unit.alive || unit.isDowned) { clearPendingFrag(unit, 'downed'); return false; }
  p.t += dt;
  p.phaseT = (p.phaseT || 0) + dt;
  //   단계 전환 — phaseT를 반드시 0으로 되돌린다. 예전엔 누적 시간 p.t로 접근 제한을 재서,
  //   피킹(왕복 10초까지)을 마치고 던지러 가기도 전에 approach_timeout이 났다(실측 6건 중 4건).
  const _goPhase = (next) => { p.phase = next; p.phaseT = 0; };
  // 계획 전체 예산. 단계별 제한만 두었더니 look(최대 14초) + throw(자리마다 18초 × 3자리)가
  //   겹쳐서 **한 계획이 17~19초를 잡고 아무것도 못 했다**(실측: 35초 교전의 절반).
  if (p.t > (p.budget || FRAG_BUDGET_BASE) && !p.threw) {
    p.abortReason = 'budget'; clearPendingFrag(unit, 'aborted'); return false;
  }
  const _nextSpot = (pf) => {
    if (!pf.spots || pf.spotIdx >= pf.spots.length - 1) return false;
    pf.spotIdx++; pf.spot = pf.spots[pf.spotIdx]; pf._legIssued = null; pf.phaseT = 0;
    return true;
  };

  if (p.phase === 'approach') {
    // 먼저 문설주 옆으로 붙는다. 예전엔 look이 먼저라, 던질 자리까지 갔다가 피킹의 복귀
    //   계약대로 원위치로 돌아온 뒤 **같은 자리로 다시 걸어갔다.** 왕복 하나가 통째로 헛일이었다.
    if (Math.hypot(p.spot.x - unit.x, p.spot.y - unit.y) <= PEEK_ARRIVE_PX) { _goPhase('look'); return true; }
    if (p._legIssued !== 'approach#' + p.spotIdx || !unit.movePath || unit.movePath.length === 0) {
      p._legIssued = 'approach#' + p.spotIdx;
      const r = issueMoveOrder(unit, p.spot.x, p.spot.y, { source: 'frag', actionType: 'fragThenEnter' });
      if (!r || r.accepted === false) {
        if (!_nextSpot(p)) { p.abortReason = 'no_path_to_spot'; clearPendingFrag(unit, 'aborted'); return false; }
      }
    }
    return true;
  }

  if (p.phase === 'look') {
    // 힐끗 본다 — 피킹 기계를 그대로 쓴다. 여기서 본 것이 다음 단계를 정한다.
    //   이미 던질 자리에 서 있으므로 피킹의 복귀 지점이 곧 던질 자리다 — 헛걸음이 없다.
    if (unit.pendingPeek) return true;
    if (!p.peekIssued) {
      p.peekIssued = true;
      const probe = _peekProbe(p.th, unit, PEEK_PROBE_M);
      const dx = p.th.ix - unit.x, dy = p.th.iy - unit.y, len = Math.hypot(dx, dy) || 1;
      const step = Math.min(PEEK_STEP_M * PX_PER_M, Math.max(0, len - 4));
      unit._peekCooldownUntil = null;                  // 이 계획의 관측은 쿨다운을 안 탄다
      if (step >= 6 && setPendingPeek(unit, unit.x + (dx / len) * step, unit.y + (dy / len) * step,
                                      { watchX: probe.x, watchY: probe.y, reason: 'frag_look' })) return true;
      _goPhase('decide');                              // 못 보면 아는 것만으로 판단한다
      return true;
    }
    p.sawEnemy = !!(unit._lastPeek && unit._lastPeek.sawEnemy);
    _goPhase('decide');
    return true;
  }

  if (p.phase === 'decide') {
    // 보고 온 결과로 판단한다 — 이게 피킹이 처음으로 결정을 바꾸는 지점이다.
    const stillHot = (typeof beyondRoomDanger === 'function') ? beyondRoomDanger(unit, p.th) : 0;
    if (!p.sawEnemy && stillHot <= 0.5) { p.abortReason = 'quiet_after_look'; clearPendingFrag(unit, 'aborted'); return false; }
    // 걸어오는 데 10초가 걸린다. 그 사이 정보가 낡았으면 **여기서 접는다** — 수류탄은 1발뿐이다.
    //   피킹에서 직접 봤으면 그게 가장 새 정보이므로 나이를 묻지 않는다.
    if (!p.sawEnemy && beyondRoomDangerAge(unit, p.th) > FRAG_THROW_FRESH) {
      p.abortReason = 'stale_after_walk'; clearPendingFrag(unit, 'aborted'); return false;
    }
    const aim = _peekProbe(p.th, unit, FRAG_DEPTH_M);
    p.aimX = aim.x; p.aimY = aim.y;
    // 진입 목표도 **지금** 굳힌다. _peekProbe는 현재 위치를 기준으로 '너머'를 정하므로,
    //   문턱을 넘는 순간 반대편으로 뒤집혀 들어가다 말고 되돌아온다(ax/ay를 검출 시점에
    //   얼려 두었다가 겪은 것과 같은 부류의 버그다).
    const into = _peekProbe(p.th, unit, 1.5);
    p.enterX = into.x; p.enterY = into.y;
    // 조준점이 정해졌으니 그 조준점으로 실제로 안전한 자리를 다시 고른다
    const spots = fragThrowSpots(unit, p.th, p.aimX, p.aimY, p.id);
    if (!spots.length) { p.abortReason = 'no_throw_spot'; clearPendingFrag(unit, 'aborted'); return false; }
    p.spots = spots; p.spotIdx = 0; p.spot = spots[0];
    _goPhase('throw');
    return true;
  }

  if (p.phase === 'throw') {
    if (p.phaseT > FRAG_APPROACH_MAX) { p.abortReason = 'approach_timeout'; clearPendingFrag(unit, 'aborted'); return false; }
    // 던질 자리까지 — 문설주 뒤
    const d = Math.hypot(p.spot.x - unit.x, p.spot.y - unit.y);
    if (d > PEEK_ARRIVE_PX) {
      if (p._legIssued !== 'spot#' + p.spotIdx || !unit.movePath || unit.movePath.length === 0) {
        p._legIssued = 'spot#' + p.spotIdx;
        const r = issueMoveOrder(unit, p.spot.x, p.spot.y, { source: 'frag', actionType: 'fragThenEnter' });
        if (!r || r.accepted === false) {
          if (!_nextSpot(p)) { p.abortReason = 'no_path_to_spot'; clearPendingFrag(unit, 'aborted'); return false; }
        }
      }
      return true;
    }
    if (unit.throwState) return true;                  // 이미 던지는 중
    // 던지기 전에 **조준점 쪽으로 돈다.** computeAutoCornerLaunch가 facing 기준으로
    //   발사점을 옆으로 옮기기 때문에, 몸이 딴 데를 보고 있으면 자리를 고를 때 통과했던
    //   궤적과 실제 궤적이 달라진다 — 그래서 문틀에 튕겨 되돌아왔다(unsafe_self_blast).
    const aimAng = Math.atan2(p.aimY - unit.y, p.aimX - unit.x);
    if (unit.aiMemory && !(unit.grenadeSourceWatchTimer > 0)) unit.aiMemory.preferredWatchAngle = aimAng;
    unit.homeFacing = aimAng;
    if (Math.abs(angleDelta(unit.facing || 0, aimAng)) > 0.35 && p.phaseT < FRAG_APPROACH_MAX * 0.5) return true;
    const safe = checkThrowSafety(unit, p.id, p.aimX, p.aimY);
    if (!safe.safe) {
      // 이 자리에선 안 된다 — 다음 자리를 시도한다. 다 떨어지면 접는다.
      if (!_nextSpot(p)) { p.abortReason = 'unsafe_' + safe.reason; clearPendingFrag(unit, 'aborted'); return false; }
      return true;
    }
    if (!startThrow(unit, p.id, p.aimX, p.aimY)) { p.abortReason = 'throw_failed'; clearPendingFrag(unit, 'aborted'); return false; }
    p.threw = true; _goPhase('wait'); p.waitT = 0;
    GAME._fragThrown = (GAME._fragThrown || 0) + 1;
    return true;
  }

  if (p.phase === 'wait') {
    // 터질 때까지 문 옆에서 기다린다. 여기가 재평가에 뺏기면 안 되는 구간이다.
    p.waitT += dt;
    //   프래그는 문 옆에서 **가만히** 기다린다. 연막은 반대로 **빠져야** 하므로
    //   이 취소에서 뺀다 — 안 그러면 물러서기가 다음 틱에 지워진다.
    if (p.kind !== 'smoke' && unit.movePath && unit.movePath.length > 0 && unit._aiCommandPath === unit.movePath) {
      if (typeof completeAICommand === 'function') completeAICommand(unit, { reason: 'frag_wait' });
    }
    if (!p.detonated) {
      const live = (GAME.flyingThrowables || []).some(st => st._thrownByUnitId === unit.id && st.grenadePhase !== 'exploded');
      if (!live && !unit.throwState) p.detonated = true;
    }
    // 연막은 **터지는 걸** 기다리는 게 아니라 **서는 걸** 기다린다. 시간이 아니라 상태를 본다 —
    //   구름이 3초에 걸쳐 자라므로, 터지자마자 들어가면 아직 아무것도 안 가려져 있다.
    if (p.kind === 'smoke') {
      // 던졌으면 **일단 빠진다.** 여기 서서 기다리는 게 이 계획의 유일한 노출 구간이었다.
      if (!p.ducked) {
        p.ducked = true;
        const spot = pickDuckSpot(unit, p);
        if (!spot) { p.duckWhy = 'no_spot'; }
        else {
          const r = issueMoveOrder(unit, spot.x, spot.y, { source: 'screen', actionType: 'screenThenCross' });
          if (r && r.accepted !== false) {
            p.duckWhy = (spot.hidden ? 'hidden@' : 'open@') + spot.m;
            GAME._screenDucked = (GAME._screenDucked || 0) + 1;
          } else {
            p.duckWhy = (r && r.rejectedReason) ? (r.rejectedReason + '@' + spot.m) : ('rejected@' + spot.m);
          }
        }
      }
      //   `p.detonated`를 조건에 걸지 않는다. 그건 폭발물 비행 정리 절차에 기대는 값인데,
      //   연막은 `detonateThrowable`에서 일찍 갈라져 나가므로 그 값이 안 설 수 있다.
      //   물어야 할 것은 "터졌나"가 아니라 **"연막이 섰나"**다 — 구름을 직접 본다.
      if (screenIsUp(p, unit)) {
        p.screened = true; GAME._screenUp = (GAME._screenUp || 0) + 1;
        _goPhase('enter'); p.enterT = 0; return true;
      }
      if (p.waitT > SCREEN_BLOOM_MAX) {
        // 안 피었는데 계속 서 있는 게 더 위험하다 — 그냥 건넌다. 실패로 기록만 한다.
        GAME._screenNoBloom = (GAME._screenNoBloom || 0) + 1;
        p.landOffM = screenLandOffsetM(p);
        // 구름은 제자리에 있는데(오차 0.0m) 왜 안 서는가 — 실제 광학깊이를 남긴다.
        if (typeof sampleDustAlongLOS === 'function') {
          const c1 = sampleDustAlongLOS(unit.x, unit.y, p.enterX, p.enterY, {});
          const cl = (GAME.dustClouds || []).find(z => z.obscurant);
          p.diag = { crossOd: +c1.opticalDepth.toFixed(2), crossVis: +c1.visibilityMul.toFixed(2),
                     crossPeak: +c1.peakDensity.toFixed(2),
                     cloudR: cl ? +(cl.radius / PX_PER_M_FALLBACK).toFixed(1) : -1,
                     cloudDen: cl ? +cl.density.toFixed(2) : -1,
                     clip: cl ? (cl.clipMode || 'none') : '?',
                     atAim: +sampleDustAtPoint(p.aimX, p.aimY).smokeDensity.toFixed(2) };
        }
        _goPhase('enter'); p.enterT = 0; return true;
      }
      return true;
    }
    if (p.detonated) { _goPhase('enter'); p.enterT = 0; return true; }
    if (p.waitT > FRAG_WAIT_MAX) { p.abortReason = 'no_detonation'; clearPendingFrag(unit, 'aborted'); return false; }
    return true;
  }

  // enter — 터졌다. 문턱 너머로 들어간다.
  //   프래그는 파편이 가라앉을 짬을 둔다. **섬광은 즉시 들어간다** — 눈먼 창이 짧고,
  //   기다리면 그 창이 닫힌다. 그게 두 물건의 쓰임새 차이 전부다.
  //   연막도 즉시 들어간다 — 이미 구름이 서기를 기다렸고, 그 창은 닫힌다.
  p.enterT += dt;
  if (p.kind !== 'flash' && p.kind !== 'smoke' && p.enterT < FRAG_ENTER_DELAY) return true;
  const tgt = { x: p.enterX, y: p.enterY };
  if (tgt.x == null) { p.abortReason = 'no_enter_target'; clearPendingFrag(unit, 'aborted'); return false; }
  if (Math.hypot(tgt.x - unit.x, tgt.y - unit.y) <= 20) {
    p.entered = true; GAME._fragEntered = (GAME._fragEntered || 0) + 1;
    clearPendingFrag(unit, 'done'); return false;
  }
  if (p._legIssued !== 'enter' || !unit.movePath || unit.movePath.length === 0) {
    p._legIssued = 'enter';
    const r = issueMoveOrder(unit, tgt.x, tgt.y, { source: 'frag', actionType: 'fragThenEnter' });
    if (!r || r.accepted === false) { p.abortReason = 'no_path_in'; clearPendingFrag(unit, 'aborted'); return false; }
  }
  //   연막은 **물러섰다가** 들어간다. 그만큼 건널 거리가 늘었는데 제한시간이 그대로면
  //   문 앞에서 잘린다(실측: enter_timeout 7건 중 2건). 물러선 거리만큼 돌려준다.
  const enterMax = (p.kind === 'smoke' && p.ducked)
                 ? FRAG_APPROACH_MAX + SCREEN_DUCK_M / SCREEN_WALK_MPS + 1.5
                 : FRAG_APPROACH_MAX;
  if (p.phaseT > enterMax) { p.abortReason = 'enter_timeout'; clearPendingFrag(unit, 'aborted'); return false; }
  return true;
}

// 렌더용 스윙 진행도 0..1 (0=닫힘, 1=열림). 충돌에는 쓰지 않는다.
function doorSwingProgress(d) {
  const open = (d.state === 'open');
  if (!d.transition) return open ? 1 : 0;
  const f = Math.max(0, Math.min(1, d.transition.t / d.transition.dur));
  return (d.transition.to === 'open') ? f : 1 - f;
}

// =============================================================
