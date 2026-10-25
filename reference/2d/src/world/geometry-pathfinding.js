// 5. GEOMETRY
// =============================================================
function distSq(ax, ay, bx, by) { const dx=bx-ax, dy=by-ay; return dx*dx+dy*dy; }
function dist(ax, ay, bx, by) { return Math.hypot(bx-ax, by-ay); }
function normalizeAngle(a) {
  while (a > Math.PI)  a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function angleDiff(a, b) { return normalizeAngle(a - b); }

function segmentIntersectsRect(x1, y1, x2, y2, r) {
  const xmin = r.x, ymin = r.y, xmax = r.x + r.w, ymax = r.y + r.h;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1];
  let u1 = 0, u2 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > u2) return false; if (t > u1) u1 = t; }
      else          { if (t < u1) return false; if (t < u2) u2 = t; }
    }
  }
  return u1 < u2;
}
function losClear(x1, y1, x2, y2) {
  // 벽
  for (const w of MAP_DATA.walls) if (segmentIntersectsRect(x1, y1, x2, y2, w)) return false;
  // 시야 차단 cover — blocksLOS가 명시적으로 true인 경우만 시야 차단
  //   (반높이 cover는 blocksLOS:false → 시야 통과)
  //   기존 맵 cover들(material만 있는)은 blocksLOS 미지정 → 사격은 막지만 시야는 통과 (기존 동작 유지)
  if (MAP_DATA.coverObjects) {
    for (const o of MAP_DATA.coverObjects) {
      if (o.blocksLOS === true && segmentIntersectsRect(x1, y1, x2, y2, o)) return false;
    }
  }
  return true;
}
// 이동/배치 충돌 — 벽 + cover 모두 막는다.
//   사격(raycast)은 별도로 cover의 관통 가능성을 평가한다.
function pathBlocked(x1, y1, x2, y2, padding) {
  const pad = padding || 0;
  for (const w of MAP_DATA.walls) {
    if (segmentIntersectsRect(x1, y1, x2, y2, {
      x: w.x - pad, y: w.y - pad,
      w: w.w + 2*pad, h: w.h + 2*pad,
    })) return true;
  }
  if (MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) {
    if (segmentIntersectsRect(x1, y1, x2, y2, {
      x: o.x - pad, y: o.y - pad,
      w: o.w + 2*pad, h: o.h + 2*pad,
    })) return true;
  }
  return false;
}
function pointInWalls(x, y, padding) {
  const pad = padding || 0;
  for (const w of MAP_DATA.walls) {
    if (x >= w.x - pad && x <= w.x + w.w + pad &&
        y >= w.y - pad && y <= w.y + w.h + pad) return true;
  }
  if (MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) {
    if (x >= o.x - pad && x <= o.x + o.w + pad &&
        y >= o.y - pad && y <= o.y + o.h + pad) return true;
  }
  return false;
}
// 점이 이동 불가 지오메트리(벽 또는 엄폐물) 안에 있는가 — 여유(padding) 없는 단순 판정.
//   pointInWalls와 같은 대상을 보되 padding을 주지 않는다.
//   validateMoveTarget / nudge 경로는 바로 앞에서 pointInWalls(…, UNIT_RADIUS-2)를 부르므로
//   이 검사가 중복이지만, scoreCoverSpot은 단독으로 쓰므로 그곳에서는 유일한 방어선이다.
function isPointBlocked(x, y) {
  return pointInWalls(x, y, 0);
}
function pointInMap(x, y, padding) {
  const pad = padding || 0;
  return (x >= 48 + pad && x <= MAP_DATA.w - 48 - pad &&
          y >= 48 + pad && y <= MAP_DATA.h - 48 - pad);
}

// =============================================================
// PATHFINDING — 격자 기반 A* + 직선화
// =============================================================
//   hasLineOfWalkClear: 두 점 사이를 unit이 직선 이동 가능한지 (벽/cover 검사)
//   findPath: 시작→목표 경로 (월드 좌표 배열). 못 찾으면 null.
//   simplifyPath: 직선으로 잇는 구간 압축
const PATH_GRID = 24;     // 격자 간격 (px). UNIT_RADIUS의 ~2배.
const PATH_PAD  = 9;      // 충돌 패딩 (UNIT_RADIUS - 2)

function hasLineOfWalkClear(x1, y1, x2, y2) {
  return !pathBlocked(x1, y1, x2, y2, PATH_PAD);
}

function _pathCellWalkable(cx, cy) {
  // 셀 중심이 맵 안 + 벽/cover 안 아닐 것
  const x = cx, y = cy;
  if (!pointInMap(x, y, 0)) return false;
  return !_planPointInWalls(x, y, PATH_PAD);
}

// ---- 계획 지오메트리 = 정답 지오메트리 − 닫힌 문 ----
//   닫힌 문이 보행격자를 막으면 A*가 문을 피해 돌아가고, 그러면 아무도 문을 열지 않는다.
//   그래서 **계획에서만** 닫힌 문을 없는 셈 치고, 대신 비용을 얹는다(DOOR_PLAN_COST).
//   물리(pointInWalls / pathBlocked)는 손대지 않는다 — 문 앞에서 실제로 막히고,
//   실행부가 그 앞에 서서 연다. 열린 문짝은 진짜 장애물이므로 계획에서도 그대로 막는다.
function _planPointInWalls(x, y, padding) {
  const pad = padding || 0;
  for (const w of MAP_DATA.walls) {
    if (x >= w.x - pad && x <= w.x + w.w + pad &&
        y >= w.y - pad && y <= w.y + w.h + pad) return true;
  }
  if (MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) {
    if (isClosedDoor(o)) continue;
    if (x >= o.x - pad && x <= o.x + o.w + pad &&
        y >= o.y - pad && y <= o.y + o.h + pad) return true;
  }
  return false;
}
function _planPathBlocked(x1, y1, x2, y2, padding) {
  const pad = padding || 0;
  for (const w of MAP_DATA.walls) {
    if (segmentIntersectsRect(x1, y1, x2, y2, {
      x: w.x - pad, y: w.y - pad, w: w.w + 2*pad, h: w.h + 2*pad })) return true;
  }
  if (MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) {
    if (isClosedDoor(o)) continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, {
      x: o.x - pad, y: o.y - pad, w: o.w + 2*pad, h: o.h + 2*pad })) return true;
  }
  return false;
}
// ---- 위험 가중 경로 ----
//   "위험지역을 가로지르는 리스크"를 경로 비용으로 표현한다. 막지 않고 **비싸게** 만든다 —
//   급하면 질러가고, 여유가 있으면 돌아간다. 그 판단이 A* 안에서 자연스럽게 나온다.
//
//   위험원은 전부 **이미 유닛별 기억**이다. 정답에서 새로 읽는 게 없다:
//     noiseDangerZones  총성을 들은 자리 (반경 포함, 18초)
//     dangerPoints      폭발이 난 자리 (15초)
//     lastSeenEnemy     마지막으로 본 적 (25초)
//   플레이어가 그은 경로는 unit 없이 findPath를 부르므로 위험 가중이 붙지 않는다 — 의도한 대로다.
//   한동안 꺼 두었다. 통짜 복도 하나가 북·남을 잇는 유일한 통로였을 때는 피할 길이 없어
//   A*가 고를 것도 없었기 때문이다(그때 실측: 경로 7,555건 중 개선 15건, 0.2%).
//   복도를 방화문으로 셋으로 나누고 방 사이에 측면 통로를 내자 선택지가 생겼다.
//   재측정(5회, 경로 15,888건): **개선 106건 · 악화 0건**, 위험 적분 −5.6%,
//   경로 길이 ±0%, 실패 0, findPath 1.9배. 이제 값을 한다.
const USE_DANGER_PATH_COST = true;
function isDangerPathOn() {
  if (typeof GAME !== 'undefined' && GAME.dangerPathOn != null) return !!GAME.dangerPathOn;
  return USE_DANGER_PATH_COST;
}
const DANGER_W_GUNSHOT = 9.0;    // 총성이 난 방 (한 칸 = 1.0)
const DANGER_W_BLAST   = 12.0;   // 폭발 지점 — 방보다 작아서 국소로 남긴다
const DANGER_W_ENEMY   = 14.0;   // 적이 있던 방 — 가장 비싸다
const DANGER_R_BLAST   = 3.0 * 32;
const DANGER_R_ENEMY   = 6.0 * 32;   // 방이 없는 맵에서만 쓰는 폴백 반경
const DANGER_TTL       = { gunshot: 18, blast: 15, enemy: 25 };
const DANGER_COST_CAP  = 26.0;   // 한 칸에서 위험이 무한정 쌓이지 않게

// ---- 위험은 방 단위다 ----
//   반경으로 칠하면 **벽을 무시한다.** 실측: 위험 비용이 붙은 셀의 36.6%가
//   위험원과의 사이에 벽이 있었다 — 실제로는 엄폐된 땅에 3분의 1이 넘게 비용이 칠해졌다.
//   위험은 "총 맞을 수 있는 공간"의 성질이고, 그 공간을 가르는 게 방이다.
//   방 단위로 두면 안전한 방과 위험한 방 사이의 **문턱**이 비싼 칸이 되어,
//   위험한 방으로 들어가는 문 앞에서 망설이는 행동이 저절로 나온다.
//
//   폭발만 국소로 남긴다 — 방보다 작고 방 한가운데서 날 수 있다.
//   방이 저작되지 않은 맵은 기존 반경 모델로 폴백한다.
function markRoomDanger(unit, room, level, now) {
  if (!unit || !room) return null;
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const t = (now != null) ? now : (GAME.gameTime || 0);
  const cur = mem.roomDangers.get(room.id);
  if (!cur || level >= cur.level || t - cur.lastAt > 3) {
    mem.roomDangers.set(room.id, { roomId: room.id, level: Math.max(level, cur ? cur.level * 0.6 : 0), lastAt: t });
  }
  return mem.roomDangers.get(room.id);
}
function mapHasRooms() {
  return !!(typeof MAP_DATA !== 'undefined' && Array.isArray(MAP_DATA.rooms) && MAP_DATA.rooms.length);
}
// 방 조회를 O(1)로 — A*는 셀마다 이걸 부른다. 사각형 9개를 매번 순회하면 findPath가 2배 느려진다.
//   PATH_GRID 해상도 격자를 맵당 한 번 굽고 방 인덱스를 담아 둔다.
let _roomGrid = null, _roomGridKey = null, _roomGridSpec = null;
function _ensureRoomGrid() {
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (!M || !Array.isArray(M.rooms) || !M.rooms.length) { _roomGrid = null; return null; }
  const key = (M.id || '?') + '|' + M.rooms.length + '|' + M.w + 'x' + M.h;
  if (_roomGrid && _roomGridKey === key) return _roomGrid;
  const cols = Math.ceil(M.w / PATH_GRID) + 1, rows = Math.ceil(M.h / PATH_GRID) + 1;
  const g = new Int8Array(cols * rows).fill(-1);
  for (let j = 0; j < rows; j++) {
    const y = j * PATH_GRID;
    for (let i = 0; i < cols; i++) {
      const x = i * PATH_GRID;
      for (let k = 0; k < M.rooms.length; k++) {
        const r = M.rooms[k];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { g[j * cols + i] = k; break; }
      }
    }
  }
  _roomGrid = g; _roomGridKey = key; _roomGridSpec = { cols, rows };
  return g;
}
function roomIndexAt(x, y) {
  const g = _ensureRoomGrid();
  if (!g) return -1;
  const i = Math.round(x / PATH_GRID), j = Math.round(y / PATH_GRID);
  if (i < 0 || j < 0 || i >= _roomGridSpec.cols || j >= _roomGridSpec.rows) return -1;
  return g[j * _roomGridSpec.cols + i];
}

// =============================================================
// 치명적 깔때기 — 위험은 방 단위지만 노출은 사선 단위다
// =============================================================
//   방 위험만으로는 **문 앞 공터가 싸다.** 다른 방이니까. 그런데 거길 지나면
//   뜨거운 방 안에서 그대로 보인다. 실측(경로 396건): 아군 경로 길이의 40.5%가
//   뜨거운 방으로 뚫린 사선 안이고, **프래그 접근만 보면 75%**였다.
//
//   그래서 스택업은 새 행동이 아니다 — **깔때기를 비싸게 만들면 경로가 벽을 탄다.**
//   문설주 옆은 사선 밖이므로 A*가 알아서 거기로 붙는다.
//   **기본 OFF다.** 경로는 확실히 바뀌는데(짝지은 A/B로 노출 −19.7%) 결과가 안 움직인다 —
//   26회씩 모아도 아군 생존 2.69 vs 2.62, 피해 155 vs 165으로 전부 잡음 안이다.
//   findPath 1.72배를 내고 사는 값이 아직 증명되지 않았다. 위험 가중 경로가 우회로 없는 맵에서
//   기본 OFF였던 것과 같은 처지다 — 값을 하게 되면 그때 켠다.
const USE_FUNNEL_COST = false;
function isFunnelCostOn() {
  if (typeof GAME !== 'undefined' && GAME.funnelCostOn != null) return !!GAME.funnelCostOn;
  return USE_FUNNEL_COST;
}
//   가중치는 쓸어서 골랐다. 짝지은 A/B(같은 호출에서 양쪽 다 계산, 회차 변동 제거):
//     W=0.05  노출 −7.6%  · 길이 +0.3%  · 개선 569 / 악화  58 · findPath 1.24배
//     W=0.15  노출 −19.7% · 길이 +7.6%  · 개선 926 / 악화 122 · findPath 1.72배   ← 채택
//     W=0.35  노출 +5.5%  · 길이 +25.3% · 개선 663 / 악화 757 · findPath 2.70배
//     W=1.1   노출 +28.1% · 길이 +62.9% · 개선 702 / 악화 1873 · findPath 3.03배
//   비싸게 매길수록 노출**률**은 계속 좋아지지만 경로가 길어져서 **총 노출은 오히려 늘어난다.**
//   위험 가중 경로 때 배운 것과 같다 — 지표는 비율이 아니라 적분이어야 한다.
let FUNNEL_W = 0.15;           // 방 위험 가중(level)에 곱한다 — 뜨거울수록 사선도 비싸다
function funnelW() {
  return (typeof GAME !== 'undefined' && GAME.funnelW != null) ? GAME.funnelW : FUNNEL_W;
}
const FUNNEL_DEPTH_M = 4.0;    // 방 안 어디서 본다고 가정하나
const FUNNEL_MAX_M = 12.0;     // 이보다 멀면 사선이라도 위협으로 치지 않는다
const FUNNEL_BASE  = 0;        // 아직 안 넘어간 문턱의 기본 위험 (0이면 '뜨겁다고 믿는 방'만)

// 선분 pq와 선분 ab가 교차하나 — 셀마다 도는 판정이라 최소 연산만 한다.
//   (SpatialPerception.crossesGate와 같은 뜻이지만 그건 IIFE 안이라 못 쓴다.)
function _segCross(px, py, qx, qy, ax, ay, bx, by) {
  const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const d2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
  if ((d1 > 0) === (d2 > 0)) return false;
  const d3 = (qx - px) * (ay - py) - (qy - py) * (ax - px);
  const d4 = (qx - px) * (by - py) - (qy - py) * (bx - px);
  return (d3 > 0) !== (d4 > 0);
}

// 믿는 문턱 중 **그 너머 방이 뜨거운** 것들의 게이트 + 방 안 관측점.
//   findPath 1회당 한 번만 만든다.
function buildFunnels(unit) {
  if (!isFunnelCostOn()) return null;
  if (typeof SpatialPerception === 'undefined' || !SpatialPerception.thresholdsOf) return null;
  if (typeof beyondRoomDanger !== 'function') return null;
  const list = SpatialPerception.thresholdsOf(unit) || [];
  if (!list.length) return null;
  const out = [];
  const step = FUNNEL_DEPTH_M * PX_PER_M;
  const base = (typeof GAME !== 'undefined' && GAME.funnelBase != null) ? GAME.funnelBase : FUNNEL_BASE;
  for (const t of list) {
    if (!t.gateA || !t.gateB || t.ax == null || t.nx == null) continue;
    // 아직 안 넘어간 문턱은 뜨겁다고 **알기 전에도** 사선이다 — 교리상 미확인 개구부는
    //   함부로 가로지르지 않는다. base > 0이면 그 규칙이 켜진다.
    const known = beyondRoomDanger(unit, t);
    const unexplored = (t.state !== 'crossed' && t.state !== 'observedBeyond');
    const w = Math.max(known, unexplored ? base : 0);
    if (w <= 0.5) continue;
    // 뜨거운 방 쪽 관측점 — t.ax/ay가 이미 '너머'를 가리키므로 그 방향으로 더 깊이
    const sign = ((t.ax - t.ix) * t.nx + (t.ay - t.iy) * t.ny) >= 0 ? 1 : -1;
    out.push({
      ax: t.gateA.x, ay: t.gateA.y, bx: t.gateB.x, by: t.gateB.y,
      hx: t.ix + t.nx * sign * step, hy: t.iy + t.ny * sign * step,
      ix: t.ix, iy: t.iy, w,
    });
  }
  return out.length ? out : null;
}

// findPath 1회당 한 번만 만든다. A*는 셀마다 이 결과만 본다.
function buildDangerField(unit) {
  if (!unit || !isDangerPathOn()) return null;
  const mem = unit.aiMemory;
  if (!mem) return null;
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  const rooms = new Map();
  let roomW = null;
  const local = [];
  const pushLocal = (x, y, r, w, t0, ttl) => {
    if (x == null || y == null || !(r > 0) || !Number.isFinite(t0)) return;
    const fade = 1 - Math.max(0, now - t0) / ttl;
    if (fade <= 0) return;
    local.push({ x, y, r, w: w * fade });
  };
  // 폭발은 언제나 국소다
  if (Array.isArray(mem.dangerPoints)) {
    for (const d of mem.dangerPoints) pushLocal(d.x, d.y, DANGER_R_BLAST, DANGER_W_BLAST, d.time, DANGER_TTL.blast);
  }
  if (mapHasRooms()) {
    // 방 단위 위험 — 기억해 둔 위험 섹터를 시간 감쇠해서 읽는다.
    //   방 id가 아니라 **인덱스** 배열로 굳힌다 — A*가 셀마다 조회하므로 Map 조회도 아깝다.
    const list = MAP_DATA.rooms;
    if (mem.roomDangers instanceof Map) {
      for (const [, rd] of mem.roomDangers) {
        const fade = 1 - Math.max(0, now - rd.lastAt) / DANGER_TTL.enemy;
        if (fade <= 0) continue;
        const idx = list.findIndex(r => r.id === rd.roomId);
        if (idx < 0) continue;
        const w = rd.level * fade;
        if (!roomW) roomW = new Float32Array(list.length);
        if (w > roomW[idx]) roomW[idx] = w;
        rooms.set(rd.roomId, w);
      }
    }
  } else {
    // 방이 저작 안 된 맵 — 예전 반경 모델 그대로
    if (Array.isArray(mem.noiseDangerZones)) {
      for (const z of mem.noiseDangerZones) pushLocal(z.x, z.y, z.radius, DANGER_W_GUNSHOT, z.time, DANGER_TTL.gunshot);
    }
    if (mem.lastSeenEnemy) {
      const e = mem.lastSeenEnemy;
      pushLocal(e.x, e.y, DANGER_R_ENEMY, DANGER_W_ENEMY, e.lastSeenTime, DANGER_TTL.enemy);
    }
  }
  const funnels = buildFunnels(unit);
  if (!rooms.size && !local.length && !funnels) return null;
  return { rooms, roomW, local, funnels };
}
// 선분이 지나는 위험의 총량 — 직선 지름길과 경로 단순화가 A*를 우회하지 못하게 막는다.
//   이게 없으면 위험구역을 가로지르는 직선이 그대로 채택되어 위험 가중이 무의미해진다.
function segmentDangerCost(field, x1, y1, x2, y2) {
  if (!field) return 0;
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.min(24, Math.ceil(d / PATH_GRID)));
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    sum += dangerCostAt(field, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
  }
  return sum / (n + 1);   // 평균 — 길이에 비례해 커지지 않게
}
const DANGER_SHORTCUT_MAX = 8.0;   // 이 아래면 직선 지름길을 그냥 쓴다(A*를 돌릴 가치가 없다)

// 경로 전체가 지는 위험의 **적분** — 길이를 곱한 값이라 "짧게 지나가기"가 유리해진다.
//   평균만 보면 안 된다: 우회로는 평균 위험이 낮아도 훨씬 길어서 총 위험이 더 클 수 있다.
//   실측에서 이걸 안 보고 A*를 맹목적으로 선호했더니 더 위험해진 경로가 124건 vs 안전해진 46건이었다.
function pathDangerIntegral(field, pts) {
  if (!field || !pts || pts.length < 2) return 0;
  let I = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k].x - pts[k - 1].x, dy = pts[k].y - pts[k - 1].y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    const n = Math.max(1, Math.min(24, Math.round(d / PATH_GRID)));
    for (let q = 1; q <= n; q++) {
      const t = q / n;
      I += dangerCostAt(field, pts[k - 1].x + dx * t, pts[k - 1].y + dy * t) * (d / n);
    }
  }
  return I;
}
// A*가 쓰는 것과 같은 척도로 경로 총비용을 매긴다 — 칸 수 + 위험 적분(칸 단위 환산).
function pathTotalCost(field, pts) {
  if (!pts || pts.length < 2) return Infinity;
  let L = 0;
  for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
  return L / PATH_GRID + pathDangerIntegral(field, pts) / PATH_GRID;
}

// 방 위험은 방 안에서 균일하다 — 경계(=문턱)에서 계단처럼 오른다. 그게 맞다:
//   위험한 건 그 방이지 그 방 안의 어느 지점이 아니고, 위험을 감수하는 행위는 **문턱을 넘는 것**이다.
//   국소 위험(폭발)만 중심에서 가장자리로 선형 감쇠한다.
function dangerCostAt(field, x, y) {
  if (!field) return 0;
  let c = 0;
  if (field.roomW) {
    const ri = roomIndexAt(x, y);
    if (ri >= 0) c += field.roomW[ri];
  }
  if (field.local) for (const z of field.local) {
    const dx = x - z.x, dy = y - z.y;
    const d2 = dx * dx + dy * dy, r = z.r;
    if (d2 >= r * r) continue;
    c += z.w * (1 - Math.sqrt(d2) / r);
  }
  // 치명적 깔때기 — 이 칸에서 뜨거운 방 안이 그대로 보이나.
  //   문턱 게이트를 가로지르면 보인다는 뜻이다(벽은 게이트 밖이므로 자연히 걸러진다).
  if (field.funnels) {
    const maxPx = FUNNEL_MAX_M * PX_PER_M;
    for (const f of field.funnels) {
      const dx = x - f.ix, dy = y - f.iy;
      if (dx * dx + dy * dy > maxPx * maxPx) continue;
      if (_segCross(x, y, f.hx, f.hy, f.ax, f.ay, f.bx, f.by)) c += funnelW() * f.w;
    }
  }
  // 연막 아래는 덜 위험하다 — **보이지 않으면 못 맞힌다.**
  //   이게 빠지면 경로가 연막을 선호할 이유가 없고, 깔때기 비용에서 겪은
  //   "경로는 바꿨는데 결과가 안 바뀐다"를 그대로 반복하게 된다.
  //   위험을 **깎기만** 한다(더하지 않는다) — 연막은 새 위험을 만들지 않는다.
  if (c > 0 && isSmokePathOn()) c *= smokeCoverMulAt(x, y);
  return c > DANGER_COST_CAP ? DANGER_COST_CAP : c;
}
// 이 칸이 연막에 얼마나 덮여 있나 → 위험 배수 (1 = 그대로, SMOKE_PATH_MIN_MUL = 최대 할인)
const USE_SMOKE_PATH = true;
function isSmokePathOn() {
  if (typeof GAME !== 'undefined' && GAME.smokePathOn != null) return !!GAME.smokePathOn;
  return USE_SMOKE_PATH;
}
const SMOKE_PATH_MIN_MUL = 0.30;   // 짙은 연막 속은 위험의 30%로 친다
const SMOKE_PATH_FULL_DEN = 0.80;  // 이 밀도면 최대 할인
function smokeCoverMulAt(x, y) {
  if (typeof sampleDustAtPoint !== 'function') return 1;
  const s = sampleDustAtPoint(x, y);
  const den = s.smokeDensity || 0;          // 부산물 먼지는 안 친다 — 가려 주는 건 연막이다
  if (den <= 0.05) return 1;
  const t = Math.min(1, den / SMOKE_PATH_FULL_DEN);
  return 1 - (1 - SMOKE_PATH_MIN_MUL) * t;
}

// 정답 기준 문 통행 비용. 믿음 모드는 SpatialPerception.believedDoorCost가 짝을 이룬다.
function _planDoorCostTruth(x, y) {
  const p = PATH_PAD;
  for (const d of doorsOf(null)) {
    if (d.state !== 'closed') continue;
    if (x >= d.x - p && x <= d.x + d.w + p && y >= d.y - p && y <= d.y + d.h + p) return DOOR_PLAN_COST;
  }
  return 0;
}

// unit이 오고 공간 인지가 켜져 있으면 그 유닛이 **믿는 지형**으로 길을 찾는다.
//   unit 없이 부르면 기존 그대로(정답 지형) — 플레이어 웨이포인트 경로가 그 경우다.
// 경로 길이만 필요할 때 쓰는 값싼 도달성 판정.
//   **직선이 뚫려 있으면 경로 길이는 정확히 직선거리다** — 근사가 아니라 동일하다.
//   엄폐 슬롯 도달성 검사가 경로 탐색의 96%를 차지하는데(실측 4,128/4,297),
//   슬롯은 다 가까이 있어 대부분 직선으로 끝난다. 막혔을 때만 A*를 돌린다.
//   세계를 보는 창은 A*와 같은 것을 쓴다 — 믿음 모드면 믿음, 아니면 정답.
function quickReachLength(unit, sx, sy, gx, gy) {
  // 위험 가중이 켜져 있으면 A*가 직선을 놔두고 우회할 수 있다 — 그때는 지름길을 쓰면 길이가 어긋난다.
  if (typeof isDangerPathOn === 'function' && isDangerPathOn()) return null;
  const P = _pathPredicates(unit);
  if (P.walkClear(sx, sy, gx, gy)) return Math.hypot(gx - sx, gy - sy);
  return null;   // 막혔다 — 부르는 쪽이 A*로 넘어간다
}
function findPath(sx, sy, gx, gy, unit) {
  if (!GAME.aiProfileOn) return _findPathImpl(sx, sy, gx, gy, unit);
  _aiProfCall('findPath');
  const _t0 = _aiProfNow();
  try { return _findPathImpl(sx, sy, gx, gy, unit); }
  finally { _aiProfRecord('findPath', _aiProfNow() - _t0); }
}
// 계획 술어 선택 — 믿음이냐 정답이냐. A* 본체는 이 둘만 통해 세계를 본다.
function _pathPredicates(unit, opts) {
  const believed = !!(unit && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
                      && typeof SpatialPerception !== 'undefined' && SpatialPerception.believedBodies(unit));
  const danger = (opts && opts.noDanger) ? null : buildDangerField(unit);
  if (!believed) {
    return { believed: false, danger,
      cellWalkable: (x, y) => _pathCellWalkable(x, y),
      walkClear: (x1, y1, x2, y2) => !_planPathBlocked(x1, y1, x2, y2, PATH_PAD),
      cellCost: (x, y) => _planDoorCostTruth(x, y) + dangerCostAt(danger, x, y) };
  }
  return { believed: true, danger,
    cellWalkable: (x, y) => SpatialPerception.believedCellWalkable(unit, x, y, PATH_PAD),
    walkClear: (x1, y1, x2, y2) => SpatialPerception.believedWalkClear(unit, x1, y1, x2, y2, PATH_PAD),
    cellCost: (x, y) => SpatialPerception.believedDoorCost(unit, x, y, PATH_PAD) + dangerCostAt(danger, x, y) };
}
// [AI0-B R1] 경로 격자 규약 단일 소스 — findPath와 Spatial Graph가 반드시 같은 값을 쓴다.
//   cols/rows/origin은 맵 실제 크기(map.w/map.h)에서 나오며, origin은 findPath와 동일한 centered grid다.
// [AI0-B R2] map-local 기하 helper — Spatial Graph는 global MAP_DATA를 보지 않는다.
//   production pointInMap/pointInWalls/pathBlocked/_pathCellWalkable은 active map wrapper로 유지된다.
function pointInMapForMap(map, x, y, padding) {
  const pad = padding || 0;
  const M = map; if (!M) return false;
  return (x >= 48 + pad && x <= M.w - 48 - pad && y >= 48 + pad && y <= M.h - 48 - pad);
}
//   ForMap 계열은 **위상 그래프 전용**이다. 그래서 계획 지오메트리와 같은 규칙을 쓴다 —
//   **닫힌 문은 없는 셈 친다.** 방과 포탈은 문이 지금 열려 있는지와 무관해야 한다.
//   "문이 거기 있고 지금 닫혀 있다"가 AI가 알아야 할 상태이지, 문간이 사라지는 게 아니다.
//   (열린 문짝은 진짜 장애물이므로 여기서도 그대로 막는다.)
function pointInWallsForMap(map, x, y, padding) {
  const pad = padding || 0;
  const M = map; if (!M) return false;
  if (Array.isArray(M.walls)) for (const w of M.walls) {
    if (x >= w.x - pad && x <= w.x + w.w + pad && y >= w.y - pad && y <= w.y + w.h + pad) return true;
  }
  if (Array.isArray(M.coverObjects)) for (const o of M.coverObjects) {
    if (isClosedDoor(o)) continue;
    if (x >= o.x - pad && x <= o.x + o.w + pad && y >= o.y - pad && y <= o.y + o.h + pad) return true;
  }
  return false;
}
function pathBlockedForMap(map, x1, y1, x2, y2, padding) {
  const pad = padding || 0;
  const M = map; if (!M) return true;
  if (Array.isArray(M.walls)) for (const w of M.walls) {
    if (segmentIntersectsRect(x1, y1, x2, y2, { x: w.x - pad, y: w.y - pad, w: w.w + 2 * pad, h: w.h + 2 * pad })) return true;
  }
  if (Array.isArray(M.coverObjects)) for (const o of M.coverObjects) {
    if (isClosedDoor(o)) continue;           // 위 주석 — 위상은 문 상태와 무관하다
    if (segmentIntersectsRect(x1, y1, x2, y2, { x: o.x - pad, y: o.y - pad, w: o.w + 2 * pad, h: o.h + 2 * pad })) return true;
  }
  return false;
}
function pathCellWalkableForMap(map, x, y) {
  if (!pointInMapForMap(map, x, y, 0)) return false;
  return !pointInWallsForMap(map, x, y, PATH_PAD);
}
function getPathGridSpec(map) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  const W = (M && M.w) ? M.w : 1600, H = (M && M.h) ? M.h : 960;
  const cols = Math.max(1, Math.floor(W / PATH_GRID));
  const rows = Math.max(1, Math.floor(H / PATH_GRID));
  const originX = (W - cols * PATH_GRID) * 0.5 + PATH_GRID * 0.5;
  const originY = (H - rows * PATH_GRID) * 0.5 + PATH_GRID * 0.5;
  return {
    map: M, w: W, h: H, cols, rows, originX, originY, grid: PATH_GRID, pad: PATH_PAD,
    worldToCellX: (x) => Math.max(0, Math.min(cols - 1, Math.round((x - originX) / PATH_GRID))),
    worldToCellY: (y) => Math.max(0, Math.min(rows - 1, Math.round((y - originY) / PATH_GRID))),
    rawCellX: (x) => Math.round((x - originX) / PATH_GRID),
    rawCellY: (y) => Math.round((y - originY) / PATH_GRID),
    cellCenterX: (i) => originX + i * PATH_GRID,
    cellCenterY: (j) => originY + j * PATH_GRID,
    inBounds: (i, j) => (i >= 0 && j >= 0 && i < cols && j < rows),
  };
}
function _findPathImpl(sx, sy, gx, gy, unit, opts) {
  // 세계를 보는 창 — 여기서 정한 술어 둘로만 지형을 판단한다(믿음 또는 정답).
  const _P = _pathPredicates(unit, opts);
  const _pathCellWalkable = _P.cellWalkable;
  const hasLineOfWalkClear = _P.walkClear;
  const _cellCost = _P.cellCost || (() => 0);
  const _danger = _P.danger || null;
  // 빠른 직선 통과 — 시작에서 목표가 그냥 보이면 바로 [start, goal].
  //   단 그 직선이 위험구역을 가로지르면 지름길을 쓰지 않는다. A*가 우회로를 찾게 둔다.
  //   직선이 뚫려 있다는 사실은 기억해 둔다 — A*가 실패하면 되돌아올 안전망이다.
  const _straightClear = hasLineOfWalkClear(sx, sy, gx, gy);
  const _straightPath = () => [{ x: sx, y: sy }, { x: gx, y: gy }];
  //   직선이 위험을 거의 안 지나면 그냥 쓴다 — A*를 돌릴 가치가 없다(대부분 이 경우다).
  //   위험을 지나면 A*를 돌려 보되, **맹목적으로 A*를 택하지 않는다.** 둘의 총비용을 재서 나은 쪽을 쓴다.
  //   우회로는 평균 위험이 낮아도 길어서 총 위험이 더 클 수 있기 때문이다.
  if (_straightClear && segmentDangerCost(_danger, sx, sy, gx, gy) <= DANGER_SHORTCUT_MAX) {
    return _straightPath();
  }
  // 격자 좌표로 변환 — Spatial Graph와 공유하는 단일 규약(getPathGridSpec)
  const _spec = getPathGridSpec(MAP_DATA);
  const W = _spec.w, H = _spec.h;
  const cols = _spec.cols, rows = _spec.rows;
  const ox = _spec.originX, oy = _spec.originY;
  function ci(x) { return Math.max(0, Math.min(cols - 1, Math.round((x - ox) / PATH_GRID))); }
  function cj(y) { return Math.max(0, Math.min(rows - 1, Math.round((y - oy) / PATH_GRID))); }
  function cx(i) { return ox + i * PATH_GRID; }
  function cy(j) { return oy + j * PATH_GRID; }
  function key(i, j) { return j * cols + i; }

  const startI = ci(sx), startJ = cj(sy);
  const goalI  = ci(gx), goalJ  = cj(gy);
  if (startI === goalI && startJ === goalJ) {
    return [{x:sx, y:sy}, {x:gx, y:gy}];
  }
  // 시작/목표 셀이 walkable하지 않으면 가까운 walkable 셀 찾기 (4반경 내)
  function findNearestWalkable(i0, j0) {
    if (_pathCellWalkable(cx(i0), cy(j0))) return [i0, j0];
    for (let r = 1; r <= 4; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di, j = j0 + dj;
          if (i < 0 || i >= cols || j < 0 || j >= rows) continue;
          if (_pathCellWalkable(cx(i), cy(j))) return [i, j];
        }
      }
    }
    return null;
  }
  const sn = findNearestWalkable(startI, startJ);
  const gn = findNearestWalkable(goalI, goalJ);
  if (!sn || !gn) return null;

  // A* — 8방향, 대각선은 양옆 셀이 walkable해야 (corner cutting 방지)
  const open = new Map();    // key → node
  const closed = new Set();
  const startNode = { i:sn[0], j:sn[1], g:0, f:0, parent:null };
  startNode.f = Math.hypot(gn[0]-sn[0], gn[1]-sn[1]);
  open.set(key(sn[0], sn[1]), startNode);
  let iter = 0;
  const MAX_ITER = 4000;
  while (open.size > 0 && iter++ < MAX_ITER) {
    // 가장 작은 f를 가진 노드 추출
    let curKey = null, cur = null;
    for (const [k, n] of open) {
      if (cur === null || n.f < cur.f) { cur = n; curKey = k; }
    }
    open.delete(curKey);
    closed.add(curKey);
    if (cur.i === gn[0] && cur.j === gn[1]) {
      // 경로 복원
      const cells = [];
      let n = cur;
      while (n) { cells.push([n.i, n.j]); n = n.parent; }
      cells.reverse();
      const pts = cells.map(([i,j]) => ({ x: cx(i), y: cy(j) }));
      // 시작/목표 정확한 좌표 교체
      pts[0] = { x: sx, y: sy };
      pts[pts.length - 1] = { x: gx, y: gy };
      const simplified = simplifyPath(pts, _danger);
      if (!_danger || (opts && opts.noDanger)) return simplified;
      // **절대 더 나쁜 길을 내놓지 않는다.** 후보를 모두 총비용(길이 + 위험 적분)으로 재고 고른다.
      //   위험 A*는 격자 위에서 `칸수 + 칸당위험`을 최소화하는데 그건 거리로 적분한 위험과
      //   미세하게 다르다(대각선은 1.414배 거리인데 비용은 한 번만 더해진다).
      //   그래서 위험 없는 A*가 더 나은 경우가 실제로 생긴다 — 실측 6건. 재서 고르면 0이 된다.
      // 위험을 아예 안 지나는 경로면 비교할 게 없다 — 대부분이 이 경우라 두 번째 A*를 아낀다.
      if (pathDangerIntegral(_danger, simplified) <= 1e-6) return simplified;
      let bestPath = simplified, bestCost = pathTotalCost(_danger, simplified);
      const consider = (p2) => {
        if (!p2 || p2.length < 2) return;
        const c2 = pathTotalCost(_danger, p2);
        if (c2 < bestCost) { bestCost = c2; bestPath = p2; }
      };
      if (_straightClear) consider(_straightPath());
      consider(_findPathImpl(sx, sy, gx, gy, unit, { noDanger: true }));
      return bestPath;
    }
    // 이웃 8방향
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const ni = cur.i + di, nj = cur.j + dj;
        if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue;
        const nk = key(ni, nj);
        if (closed.has(nk)) continue;
        if (!_pathCellWalkable(cx(ni), cy(nj))) continue;
        // 대각선이면 corner cutting 방지
        if (di !== 0 && dj !== 0) {
          if (!_pathCellWalkable(cx(cur.i + di), cy(cur.j))) continue;
          if (!_pathCellWalkable(cx(cur.i), cy(cur.j + dj))) continue;
        }
        const stepCost = (di !== 0 && dj !== 0) ? 1.414 : 1.0;
        // 닫힌 문 칸은 지날 수 있지만 공짜가 아니다 — 열려 있는 길이 있으면 그쪽을 고른다
        const tentG = cur.g + stepCost + _cellCost(cx(ni), cy(nj));
        const existing = open.get(nk);
        if (existing && existing.g <= tentG) continue;
        const h = Math.hypot(gn[0]-ni, gn[1]-nj);
        const node = { i:ni, j:nj, g:tentG, f:tentG + h, parent:cur };
        open.set(nk, node);
      }
    }
  }
  // A*가 못 찾았다.
  //   위험 비용은 탐색을 목표지향에서 멀어지게 해(휴리스틱은 거리만 본다) MAX_ITER를 소진시킬 수 있다.
  //   그러니 **위험을 빼고 한 번 더 찾는다.** 위험 가중은 선호지 금지가 아니다 —
  //   피하려다 아예 못 움직이는 게 더 나쁘다.
  if (_danger && !(opts && opts.noDanger)) {
    const retry = _findPathImpl(sx, sy, gx, gy, unit, { noDanger: true });
    if (retry) return retry;
  }
  return _straightClear ? _straightPath() : null;
}

// 직선 가능한 구간을 한 점으로 합쳐 wp 수를 줄인다.
//   danger를 주면 **위험 적분을 키우는 합치기만 거부한다.**
//   길이가 줄면 적분도 줄 수 있으므로 평균 위험이 아니라 적분으로 판정해야 한다.
function _mergeKeepsDanger(danger, pts, i, j) {
  if (!danger) return true;
  const merged = pathDangerIntegral(danger, [pts[i], pts[j]]);
  const original = pathDangerIntegral(danger, pts.slice(i, j + 1));
  return merged <= original + 1e-6;
}
function simplifyPath(pts, danger) {
  if (!pts || pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    // i에서 가장 먼 j 중 hasLineOfWalkClear인 점 찾기
    while (j > i + 1 && !(hasLineOfWalkClear(pts[i].x, pts[i].y, pts[j].x, pts[j].y)
                          && _mergeKeepsDanger(danger, pts, i, j))) {
      j--;
    }
    out.push(pts[j]);
    i = j;
  }
  return out;
}
function rayBoxT(ox, oy, dx, dy, box, maxDist) {
  let txmin, txmax;
  if (Math.abs(dx) < 1e-7) {
    if (ox < box.x || ox > box.x + box.w) return maxDist;
    txmin = -1e9; txmax = 1e9;
  } else {
    const t1 = (box.x - ox) / dx;
    const t2 = (box.x + box.w - ox) / dx;
    txmin = Math.min(t1, t2); txmax = Math.max(t1, t2);
  }
  let tymin, tymax;
  if (Math.abs(dy) < 1e-7) {
    if (oy < box.y || oy > box.y + box.h) return maxDist;
    tymin = -1e9; tymax = 1e9;
  } else {
    const t1 = (box.y - oy) / dy;
    const t2 = (box.y + box.h - oy) / dy;
    tymin = Math.min(t1, t2); tymax = Math.max(t1, t2);
  }
  const tmin = Math.max(txmin, tymin);
  const tmax = Math.min(txmax, tymax);
  if (tmax < 0 || tmin > tmax) return maxDist;
  if (tmin < 0) return 0;
  return Math.min(tmin, maxDist);
}

// box의 exit t (ray가 box를 나가는 시점) — box에 hit한 후 통과 시 사용
function rayBoxExitT(ox, oy, dx, dy, box, maxDist) {
  let txmin, txmax;
  if (Math.abs(dx) < 1e-7) {
    if (ox < box.x || ox > box.x + box.w) return maxDist;
    txmin = -1e9; txmax = 1e9;
  } else {
    const t1 = (box.x - ox) / dx;
    const t2 = (box.x + box.w - ox) / dx;
    txmin = Math.min(t1, t2); txmax = Math.max(t1, t2);
  }
  let tymin, tymax;
  if (Math.abs(dy) < 1e-7) {
    if (oy < box.y || oy > box.y + box.h) return maxDist;
    tymin = -1e9; tymax = 1e9;
  } else {
    const t1 = (box.y - oy) / dy;
    const t2 = (box.y + box.h - oy) / dy;
    tymin = Math.min(t1, t2); tymax = Math.max(t1, t2);
  }
  const tmin = Math.max(txmin, tymin);
  const tmax = Math.min(txmax, tymax);
  if (tmax < 0 || tmin > tmax) return maxDist;
  return Math.min(Math.max(tmax, 0), maxDist);
}
function rayDistToWalls(ox, oy, dx, dy, maxDist, excluded) {
  let best = maxDist, bestObj = null;
  for (const w of MAP_DATA.walls) {
    if (excluded && excluded.has(w)) continue;   // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1 §6: 관통한 벽 재충돌 방지
    const t = rayBoxT(ox, oy, dx, dy, w, maxDist);
    if (t < best) { best = t; bestObj = w; }
  }
  return { t: best, obj: bestObj };
}

// =============================================================
