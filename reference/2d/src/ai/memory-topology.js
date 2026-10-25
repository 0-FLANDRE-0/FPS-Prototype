// SPATIAL PERCEPTION SOURCE SWITCH
// =============================================================
//   이 파일이 이미 쓰는 USE_*_REGISTRY_AS_SOURCE 관용구와 같은 형태.
//     true  — AI 지형 기억(knownCovers/knownWalls)을 공간 인지 믿음으로 덮어쓴다.
//     false — 기존 castScanRay/recordCover 경로(정답 객체 id)를 그대로 쓴다.
//   적 탐지(checkVisibility / recordSeenUnit)는 어느 쪽이든 건드리지 않는다.
//   콘솔에서 GAME.spatialPerceptionOn = false 로 런타임 A/B가 가능하다.
const USE_SPATIAL_PERCEPTION_AS_SOURCE = true;

function isSpatialPerceptionOn() {
  if (typeof GAME !== 'undefined' && GAME.spatialPerceptionOn != null) return !!GAME.spatialPerceptionOn;
  return USE_SPATIAL_PERCEPTION_AS_SOURCE;
}

// tickAIScan 직후에 호출된다. 자체 주기 + 프레임 예산으로 스스로 스태거한다.
function tickSpatialPerception(unit, dt) {
  if (!isSpatialPerceptionOn()) return;
  if (!unit || !unit.alive || unit.isDead || unit.isDowned) return;
  if (typeof SpatialPerception === 'undefined') return;

  const now = GAME.gameTime || 0;
  const mem = ensureAIMemory(unit);
  const S = SpatialPerception.ensureSpatial(unit);
  const prof = (typeof getScanProfile === 'function') ? getScanProfile(unit) : null;
  const interval = (prof && prof.scanInterval) ? prof.scanInterval : 0.4;

  // 첫 호출 — 유닛마다 위상을 흩어 전원이 같은 프레임에 몰리는 것을 막는다
  if (S.lastSenseAt < -900) S.lastSenseAt = now - SpatialPerception.phaseOffsetFor(unit, interval);

  const elapsed = now - S.lastSenseAt;
  if (elapsed < interval) return;
  // 섬광 — 눈이 멀면 **지형도 못 배운다.** 이 프로젝트에서 처음으로 믿음이 낡는 이유가
  //   시간이 아니라 **남이 그렇게 만들어서**가 된다. 기억은 그대로 두고 갱신만 멈춘다 —
  //   그래서 눈이 멀린 유닛은 낡은 지도를 들고 움직인다(그게 정확히 섬광의 값이다).
  //   간격 검사 **뒤에** 둔다 — 그래야 이 수가 "건너뛴 스캔"을 뜻한다(앞에 두면 프레임 수를 센다).
  if (typeof isFlashBlinded === 'function' && isFlashBlinded(unit)) {
    GAME._flashScanSkipped = (GAME._flashScanSkipped || 0) + 1;
    return;
  }
  if (!SpatialPerception.budgetAvailable(now)) { SpatialPerception.budgetDefer(); return; }

  const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  SpatialPerception.senseFor(unit, elapsed, now);
  SpatialPerception.mirrorToLegacyMemory(unit, mem, now);
  if (t0) SpatialPerception.budgetCharge(performance.now() - t0);
}

// =============================================================
// AI 메모리 + 레이캐스트 기반 지형 인식 시스템
// =============================================================
//
// 설계:
//   - 모든 유닛에 aiMemory 추가 (lazy init via ensureAIMemory)
//   - 일정 간격으로 전방 부채꼴 스캔 → 벽/cover/적/통로 기록
//   - half cover는 시야 통과 (기록 후 ray 계속), full wall/cover는 시야 차단 (종료)
//   - 기억은 시간 흐름에 따라 confidence 감소
//   - findBestCover 등 보조 함수로 다른 시스템에서 활용 가능
//
// 기존 시스템 호환:
//   - aiMemory는 새 필드 — 기존 AI 상태/행동 코드는 그대로
//   - 새 시스템은 보조. 기존 노이즈 반응/시야 감지/엄폐 시스템과 별개 동작
//   - findBestCover() 등은 호출자가 필요할 때만 사용

// AI 메모리 초기화 — 처음 접근 시 lazy init
function ensureAIMemory(unit) {
  if (unit.aiMemory) return unit.aiMemory;
  unit.aiMemory = {
    knownCovers: new Map(),       // id → { id, x, y, rect, coverType, blocksVision, blocksBullets, lastSeenTime, confidence }
    knownWalls: new Map(),        // id → { id, x, y, wallType, lastSeenTime, confidence }
    knownCorners: [],             // [{ x, y, approachAngle, peekAngle, lastSeenTime, confidence }]
    openSectors: [],              // [{ angle, distance, lastCheckedTime, score }]
    lastSeenEnemy: null,          // { unitId, x, y, lastSeenTime, confidence, behindCoverId, behindCoverType }
    lastHeardNoise: null,         // { x, y, heardAt, intensity }
    dangerPoints: [],             // [{ x, y, type, time }]
    preferredWatchAngle: null,
    lastScanTime: 0,
    scanInterval: 0.5,            // 다음 스캔까지
    // [AI0-B] additive — 기존 knownCovers/knownWalls/knownCorners는 그대로 유지된다(legacy mirror)
    observedSurfaces: new Map(),  // surfaceId → SurfaceMemory (직접 본 면만)
    knownRegions: new Map(),      // regionId → { regionId, state, firstKnownAt, lastObservedAt, confidence }
    knownPortals: new Map(),      // portalId → { portalId, regionAId, regionBId, centerX, centerY, ... }
    portalDangers: new Map(),     // portalId → { portalId, dangerLevel, confidence, lastUpdatedAt, sourceEvidenceId }
    currentRegionId: null,
    // 방 지식 — 이름만 정답에서 오고 나머지는 믿음이다.
    knownRooms: new Map(),        // roomId → { roomId, name, state, firstKnownAt, lastSeenAt, clearedAt }
    roomDangers: new Map(),       // roomId → { roomId, level, lastAt } — "저 방은 뜨겁다"
    currentRoomId: null,
  };
  return unit.aiMemory;
}
// [AI0-B] 구버전 저장 객체 호환 — 신규 Map 필드가 없으면 만들어 준다
function ensureSpatialMemoryFields(mem) {
  if (!mem) return mem;
  if (!(mem.observedSurfaces instanceof Map)) mem.observedSurfaces = new Map();
  if (!(mem.knownRegions instanceof Map)) mem.knownRegions = new Map();
  if (!(mem.knownRooms instanceof Map)) mem.knownRooms = new Map();
  if (!(mem.roomDangers instanceof Map)) mem.roomDangers = new Map();
  if (!(mem.knownPortals instanceof Map)) mem.knownPortals = new Map();
  if (!(mem.portalDangers instanceof Map)) mem.portalDangers = new Map();
  return mem;
}

// 훈련도별 스캔 파라미터
function getScanProfile(unit) {
  const skillId = (unit.skill && unit.skill.presetId) || 'regular';
  const isAlert = (unit.awareness === 'alert' || unit.awareness === 'contact' || unit.aiState === 'engage' || unit.aiState === 'suppressed');
  if (skillId === 'recruit') {
    return {
      rayCount: isAlert ? 10 : 6,
      halfAng: isAlert ? Math.PI / 3 : Math.PI / 4,
      scanInterval: isAlert ? 0.35 : 0.6,
      memoryDecayMul: 1.5,
      cornerPrecisionMul: 0.6,
      validatePerScan: isAlert ? 2 : 1,
      offsetStepMul: 0.20,   // raySpacing × 0.20 — 느린 sweep
    };
  }
  if (skillId === 'veteran') {
    return {
      rayCount: isAlert ? 16 : 10,
      halfAng: isAlert ? Math.PI * 0.45 : Math.PI / 3,
      scanInterval: isAlert ? 0.22 : 0.40,
      memoryDecayMul: 0.7,
      cornerPrecisionMul: 1.1,
      validatePerScan: isAlert ? 3 : 2,
      offsetStepMul: 0.30,
    };
  }
  if (skillId === 'elite') {
    return {
      rayCount: isAlert ? 18 : 12,
      halfAng: isAlert ? Math.PI * 0.5 : Math.PI / 3,
      scanInterval: isAlert ? 0.20 : 0.35,
      memoryDecayMul: 0.5,
      cornerPrecisionMul: 1.3,
      validatePerScan: isAlert ? 4 : 2,
      offsetStepMul: 0.35,
    };
  }
  // regular
  return {
    rayCount: isAlert ? 13 : 8,
    halfAng: isAlert ? Math.PI / 3 : Math.PI / 4,
    scanInterval: isAlert ? 0.28 : 0.5,
    memoryDecayMul: 1.0,
    cornerPrecisionMul: 1.0,
    validatePerScan: isAlert ? 2 : 1,
    offsetStepMul: 0.25,
  };
}

// 각도 차이 (-PI ~ PI)
function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// cover 객체에서 ID 추출 (없으면 좌표 기반)
function coverObjectId(obj) {
  if (obj.id) return obj.id;
  return `c_${Math.round(obj.x)}_${Math.round(obj.y)}_${Math.round(obj.w || 0)}_${Math.round(obj.h || 0)}`;
}
// 그 id의 cover 객체가 아직 맵에 남아 있는가 — best cover 캐시 무효화용.
//   배치 모드에서 엄폐물이 삭제될 수 있으므로(deleteSelectedCover), 캐시가 사라진
//   객체를 계속 가리키는 것을 막는다.
//   호출부는 coverObjectId() / obj.id / _tacticalObjectId 중 아무 형태나 넘길 수 있어 셋 다 대조한다.
//   판단이 불가능하면 true — 확실히 사라졌을 때만 캐시를 버린다(불필요한 재평가 방지).
function isCoverStillValid(id) {
  if (id == null) return true;
  if (typeof MAP_DATA === 'undefined' || !Array.isArray(MAP_DATA.coverObjects)) return true;
  for (const o of MAP_DATA.coverObjects) {
    if (!o) continue;
    if (o._tacticalObjectId === id) return true;
    if (coverObjectId(o) === id) return true;
  }
  return false;
}

// cover의 시야 차단 여부 판별
function isCoverBlocksVision(obj) {
  if (!obj) return false;
  if (obj.blocksLOS === true) return true;
  if (obj.halfHeight === true) return false;
  // category 기반
  if (obj.category === 'halfCover') return false;
  if (obj.category === 'fullCover') return true;
  return false;   // 알 수 없으면 시야 통과로 보수적 처리
}

// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] TACTICAL GEOMETRY IDENTITY — 안정적 객체 ID + geometry revision.
//   배열 index만으로 ID를 만들지 않는다(앞 객체 삭제 시 뒤 ID가 전부 바뀌면 안 됨).
//   명시적 id가 있으면 그것을, 없으면 초기 geometry fingerprint + duplicate ordinal을 쓴다.
// ════════════════════════════════════════════════════════════════════════════
function _tgMapId(map) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  if (!M) return 'unknown';
  if (!M) return 'unknown';
  if (typeof MAPS !== 'undefined') { for (const k of Object.keys(MAPS)) if (MAPS[k] === M) return k; }
  return M.id || M.name || 'unknown';
}
function _tgGeomKey(obj) {
  return [Math.round(obj.x || 0), Math.round(obj.y || 0), Math.round(obj.w || 0), Math.round(obj.h || 0)].join('_');
}
function _tgStableHash(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
function ensureTacticalGeometry() {
  if (!GAME.tacticalGeometry) {
    GAME.tacticalGeometry = { mapId: null, revision: 0, fingerprint: null,
      spatialGraph: null, graphBuiltRevision: -1, dirty: true, dirtyReasons: [] };
  }
  return GAME.tacticalGeometry;
}
// 정적 맵 객체에 _tacticalObjectId / _tacticalGeometryRevision / _tacticalKind 부여 (idempotent)
function ensureTacticalGeometryIds(map) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  if (!M) return null;
  const tg = ensureTacticalGeometry();
  const mapId = _tgMapId(M);
  const seen = Object.create(null);
  const assign = (arr, kind) => {
    if (!Array.isArray(arr)) return;
    for (const o of arr) {
      if (!o || o.x == null) continue;
      if (!o._tacticalObjectId) {
        const base = o.id ? String(o.id) : _tgGeomKey(o);
        const k = mapId + ':' + kind + ':' + base;
        const ord = (seen[k] = (seen[k] == null ? 0 : seen[k] + 1));
        o._tacticalObjectId = k + (ord > 0 ? ('#' + ord) : '');
      } else {
        const k2 = o._tacticalObjectId.split('#')[0];
        seen[k2] = (seen[k2] == null ? 0 : seen[k2] + 1);
      }
      if (o._tacticalGeometryRevision == null) o._tacticalGeometryRevision = 0;
      o._tacticalKind = kind;
    }
  };
  assign(M.walls, 'wall');
  assign(M.coverObjects, 'cover');
  tg.mapId = mapId;
  tg.fingerprint = computeTacticalGeometryFingerprint(M);
  return tg;
}
function computeTacticalGeometryFingerprint(map) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  if (!M) return 'none';
  const parts = [];
  const push = (arr, kind) => {
    if (!Array.isArray(arr)) return;
    for (const o of arr) {
      if (!o || o.x == null) continue;
      parts.push(kind + '|' + (o._tacticalObjectId || _tgGeomKey(o)) + '|' + _tgGeomKey(o) + '|' + (o._tacticalGeometryRevision || 0));
    }
  };
  push(M.walls, 'wall'); push(M.coverObjects, 'cover');
  parts.sort();
  return _tgStableHash(parts.join(';')) + ':' + parts.length;
}
let _tgRuntimeUidSeq = 0;
function getTacticalObjectId(obj, kind) {
  if (!obj) return null;
  if (obj._tacticalObjectId) return obj._tacticalObjectId;
  // [AI0-B R1] 런타임 추가 객체는 monotonic UID를 붙여 동일 위치·크기여도 ID가 겹치지 않게 한다.
  //   (정적 map 객체는 ensureTacticalGeometryIds에서 이미 안정 ID를 받으므로 재빌드 안정성은 유지된다)
  const mapId = _tgMapId(null);
  const k = (kind || obj._tacticalKind || 'cover');
  obj._tacticalRuntimeUid = (++_tgRuntimeUidSeq);
  obj._tacticalObjectId = mapId + ':' + k + ':' + (obj.id ? String(obj.id) : _tgGeomKey(obj)) + '@rt' + obj._tacticalRuntimeUid;
  if (obj._tacticalGeometryRevision == null) obj._tacticalGeometryRevision = 0;
  obj._tacticalKind = k;
  return obj._tacticalObjectId;
}
function getTacticalGeometryRevision(obj) { return (obj && obj._tacticalGeometryRevision) || 0; }
// 형상 변경 — graph rebuild 대상. 재질만 바뀌면 shapeChanged:false로 호출한다.
function markTacticalGeometryChanged(obj, reason, options) {
  const tg = ensureTacticalGeometry();
  const o = options || {};
  const shapeChanged = (o.shapeChanged !== false);
  if (obj) {
    if (!obj._tacticalObjectId) getTacticalObjectId(obj, obj._tacticalKind);
    if (shapeChanged) obj._tacticalGeometryRevision = (obj._tacticalGeometryRevision || 0) + 1;
  }
  if (shapeChanged) {
    tg.revision = (tg.revision || 0) + 1;
    tg.dirty = true;
    if (reason) { tg.dirtyReasons.push(reason); while (tg.dirtyReasons.length > 16) tg.dirtyReasons.shift(); }
    tg.fingerprint = computeTacticalGeometryFingerprint(null);
    if (typeof clearAreaCache === 'function') clearAreaCache();
  } else {
    tg.fingerprint = computeTacticalGeometryFingerprint(null);
  }
  return tg.revision;
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] CANONICAL SURFACE RAYCAST — 어느 면에 맞았고, 그 면의 법선/접선/구간/위치가 무엇인가.
//   기존 rayBoxT/rayBoxExitT/rayDistToWalls는 탄도 회귀 방지를 위해 그대로 둔다.
// ════════════════════════════════════════════════════════════════════════════
const SURFACE_FACES = ['north', 'south', 'west', 'east'];
const SURFACE_FACE_NORMAL = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const _SURFACE_CORNER_EPS = 1e-6;
function raycastAabbSurface(ox, oy, dx, dy, box, maxDist, meta) {
  if (!box || box.x == null) return null;
  let txmin, txmax, tyEntryAxis = null;
  const noX = Math.abs(dx) < 1e-7, noY = Math.abs(dy) < 1e-7;
  if (noX) { if (ox < box.x || ox > box.x + box.w) return null; txmin = -1e9; txmax = 1e9; }
  else { const t1 = (box.x - ox) / dx, t2 = (box.x + box.w - ox) / dx; txmin = Math.min(t1, t2); txmax = Math.max(t1, t2); }
  let tymin, tymax;
  if (noY) { if (oy < box.y || oy > box.y + box.h) return null; tymin = -1e9; tymax = 1e9; }
  else { const t1 = (box.y - oy) / dy, t2 = (box.y + box.h - oy) / dy; tymin = Math.min(t1, t2); tymax = Math.max(t1, t2); }
  const tmin = Math.max(txmin, tymin), tmax = Math.min(txmax, tymax);
  if (tmax < 0 || tmin > tmax) return null;
  const t = (tmin < 0) ? 0 : Math.min(tmin, maxDist);
  if (tmin > maxDist) return null;
  // ── face 결정: corner tie는 결정적으로 (|dx| >= |dy| → x face) ──
  let axis;
  if (noX) axis = 'y';
  else if (noY) axis = 'x';
  else if (Math.abs(txmin - tymin) <= _SURFACE_CORNER_EPS) axis = (Math.abs(dx) >= Math.abs(dy)) ? 'x' : 'y';
  else axis = (txmin > tymin) ? 'x' : 'y';
  let face;
  if (axis === 'x') face = (dx > 0) ? 'west' : 'east';
  else face = (dy > 0) ? 'north' : 'south';
  const n = SURFACE_FACE_NORMAL[face];
  // segment (면의 양 끝점) + tangent
  let sx0, sy0, sx1, sy1;
  if (face === 'north') { sx0 = box.x; sy0 = box.y; sx1 = box.x + box.w; sy1 = box.y; }
  else if (face === 'south') { sx0 = box.x; sy0 = box.y + box.h; sx1 = box.x + box.w; sy1 = box.y + box.h; }
  else if (face === 'west') { sx0 = box.x; sy0 = box.y; sx1 = box.x; sy1 = box.y + box.h; }
  else { sx0 = box.x + box.w; sy0 = box.y; sx1 = box.x + box.w; sy1 = box.y + box.h; }
  const segLen = Math.hypot(sx1 - sx0, sy1 - sy0);
  const tanX = segLen > 0 ? (sx1 - sx0) / segLen : 1, tanY = segLen > 0 ? (sy1 - sy0) / segLen : 0;
  const hitX = ox + dx * t, hitY = oy + dy * t;
  // hitS = segment 시작점에서의 거리(px), 항상 [0, segLen]
  let hitS = (hitX - sx0) * tanX + (hitY - sy0) * tanY;
  hitS = Math.max(0, Math.min(segLen, hitS));
  // observerNormal — 충돌면에서 ray 원점 쪽. 내부 원점/경계 오차에서도 관측자 방향으로 정규화.
  let obsNX = n[0], obsNY = n[1];
  const toObsX = ox - hitX, toObsY = oy - hitY;
  if ((obsNX * toObsX + obsNY * toObsY) < 0) { obsNX = -obsNX; obsNY = -obsNY; }
  const m = meta || {};
  return {
    hit: true, t, hitX, hitY,
    object: box, objectId: m.objectId || getTacticalObjectId(box, m.objectKind),
    objectKind: m.objectKind || box._tacticalKind || 'cover',
    coverType: m.coverType || null,
    face, surfaceId: (m.objectId || getTacticalObjectId(box, m.objectKind)) + ':' + face,
    worldNormalX: n[0], worldNormalY: n[1],
    observerNormalX: obsNX, observerNormalY: obsNY,
    tangentX: tanX, tangentY: tanY,
    segmentStartX: sx0, segmentStartY: sy0, segmentEndX: sx1, segmentEndY: sy1, segmentLength: segLen,
    hitS, geometryRevision: getTacticalGeometryRevision(box),
    observationRevision: getSurfaceObservationRevision(box),
    blocksVision: (m.blocksVision != null) ? m.blocksVision : true,
    blocksBullets: (m.blocksBullets != null) ? m.blocksBullets : true,
    material: box.material || null, armor: (box.armor != null) ? box.armor : null,
  };
}
// wall과 cover를 동일 계약으로 한 번에 조회 (중복 순회 없음)
function raycastWorldSurface(ox, oy, dx, dy, maxDist, options) {
  const o = options || {};
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (!M) return null;
  // [perf] 먼저 값싼 rayBoxT로 최근접 객체만 고르고, 표면 메타데이터 객체는 승자에 대해 한 번만 만든다.
  let bestT = maxDist, bestObj = null, bestKind = null;
  if (Array.isArray(M.walls) && o.includeWalls !== false) {
    for (const w of M.walls) {
      if (o.excluded && o.excluded.has(w)) continue;
      const t = rayBoxT(ox, oy, dx, dy, w, bestT);
      if (t < bestT) { bestT = t; bestObj = w; bestKind = 'wall'; }
    }
  }
  if (Array.isArray(M.coverObjects) && o.includeCovers !== false) {
    for (const c of M.coverObjects) {
      if (o.excluded && o.excluded.has(c)) continue;
      const t = rayBoxT(ox, oy, dx, dy, c, bestT);
      if (t < bestT) { bestT = t; bestObj = c; bestKind = 'cover'; }
    }
  }
  if (!bestObj) return null;
  if (bestKind === 'wall') {
    return raycastAabbSurface(ox, oy, dx, dy, bestObj, maxDist, { objectKind: 'wall', blocksVision: true, blocksBullets: true });
  }
  const bv = (typeof isCoverBlocksVision === 'function') ? isCoverBlocksVision(bestObj) : true;
  return raycastAabbSurface(ox, oy, dx, dy, bestObj, maxDist, { objectKind: 'cover',
    coverType: bv ? 'full' : 'half', blocksVision: bv, blocksBullets: true });
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] TACTICAL SPATIAL GRAPH — 안정적 region/portal.
//   walkability는 기존 _pathCellWalkable / PATH_GRID / PATH_PAD 계약을 그대로 재사용한다.
//   portal은 "좁다"만으로 만들지 않고, 그 band를 제거했을 때 실제로 두 공간이 분리되는지 검증한다.
// ════════════════════════════════════════════════════════════════════════════
const SPATIAL_MIN_REGION_CELLS = 6;      // 이보다 작은 조각은 인접 region과 병합 후보
const SPATIAL_PORTAL_MAX_CLEARANCE = 2;  // cell 단위 — clearance 보조 지표
const SPATIAL_PORTAL_SPAN_MAX = 5;       // cell 단위 — 이 이하 free span은 병목 후보(문/좁은 통로)
const SPATIAL_PORTAL_MIN_BASIN = 8;
const SPATIAL_PORTAL_OPEN_MIN_BASIN = 25;
const SPATIAL_CLEARANCE_MARGIN = 1.0;    // 진행축 양쪽이 이만큼 넓어져야 진짜 local minimum
const SPATIAL_PLATEAU_MAX = 3;
const SPATIAL_DOORWAY_SPAN = 3;          // cell — 이보다 좁은 벽 간극은 문 신호로 인정           // 같은 clearance가 이보다 길게 이어지면 plateau(가상 단면)   // 벽에 닿지 않는 band는 양쪽이 이만큼 커야 경계로 인정
const SPATIAL_TINY_CELLS = 6;            // 이보다 작고 인접 region이 없는 조각은 근접 병합 대상
const SPATIAL_TINY_MERGE_RADIUS = 7;     // cell 단위 근접 병합 반경      // 후보 제거 시 양쪽에 최소 이만큼 cell이 남아야 진짜 분리
function _spatialCellKey(cx, cy) { return cx + ',' + cy; }
// [AI0-B] 공간 위상은 '벽'이 정한다. 상자 하나가 새로운 방을 만들지 않도록
//   병목(문/좁은 통로) 후보 탐지는 벽만으로 만든 격자에서 수행한다.
//   (region flood fill과 walkability는 기존 _pathCellWalkable 계약을 그대로 쓴다)
function _spatialWallOnlyOpen(map, cols, rows, spec) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  const sp = spec || getPathGridSpec(M);
  const open = new Uint8Array(cols * rows);
  const walls = (M && Array.isArray(M.walls)) ? M.walls : [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x = sp.cellCenterX(cx), y = sp.cellCenterY(cy);
    let blocked = !pointInMapForMap(M, x, y, 0);
    if (!blocked) {
      for (const w of walls) {
        if (x >= w.x - PATH_PAD && x <= w.x + w.w + PATH_PAD && y >= w.y - PATH_PAD && y <= w.y + w.h + PATH_PAD) { blocked = true; break; }
      }
    }
    open[cy * cols + cx] = blocked ? 0 : 1;
  }
  return open;
}
function _spatialBuildWalkable(map, spec) {
  const sp = spec || getPathGridSpec(map);
  const { cols, rows } = sp;
  const walkable = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      walkable[cy * cols + cx] = pathCellWalkableForMap(sp.map, sp.cellCenterX(cx), sp.cellCenterY(cy)) ? 1 : 0;
    }
  }
  return { cols, rows, walkable };
}
// obstacle clearance (chamfer distance, cell 단위)
function _spatialClearance(cols, rows, walkable) {
  const INF = 1e6;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = walkable[i] ? INF : 0;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const i = cy * cols + cx; if (!walkable[i]) continue;
    let best = d[i];
    if (cx > 0) best = Math.min(best, d[i - 1] + 1);
    if (cy > 0) best = Math.min(best, d[i - cols] + 1);
    if (cx > 0 && cy > 0) best = Math.min(best, d[i - cols - 1] + 1.414);
    if (cx < cols - 1 && cy > 0) best = Math.min(best, d[i - cols + 1] + 1.414);
    d[i] = best;
  }
  for (let cy = rows - 1; cy >= 0; cy--) for (let cx = cols - 1; cx >= 0; cx--) {
    const i = cy * cols + cx; if (!walkable[i]) continue;
    let best = d[i];
    if (cx < cols - 1) best = Math.min(best, d[i + 1] + 1);
    if (cy < rows - 1) best = Math.min(best, d[i + cols] + 1);
    if (cx < cols - 1 && cy < rows - 1) best = Math.min(best, d[i + cols + 1] + 1.414);
    if (cx > 0 && cy < rows - 1) best = Math.min(best, d[i + cols - 1] + 1.414);
    d[i] = best;
  }
  return d;
}
function _spatialFloodFill(cols, rows, walkable, blocked, seedIdx, label, labels) {
  const stack = [seedIdx]; const cells = [];
  labels[seedIdx] = label;
  while (stack.length) {
    const i = stack.pop(); cells.push(i);
    const cx = i % cols, cy = (i - cx) / cols;
    const nb = [];
    if (cx > 0) nb.push(i - 1);
    if (cx < cols - 1) nb.push(i + 1);
    if (cy > 0) nb.push(i - cols);
    if (cy < rows - 1) nb.push(i + cols);
    for (const j of nb) {
      if (labels[j] !== 0 || !walkable[j] || blocked[j]) continue;
      labels[j] = label; stack.push(j);
    }
  }
  return cells;
}
// ── geometry revision당 1회만 계산해 공유하는 캐시 ──
let _spatialSharedCache = null;
function _spatialGetShared(map, revision) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  const mapId = _tgMapId(M);
  if (_spatialSharedCache && _spatialSharedCache.mapRef === M && _spatialSharedCache.mapId === mapId
      && _spatialSharedCache.revision === revision) return _spatialSharedCache;
  const spec = getPathGridSpec(M);
  const { cols, rows, walkable } = _spatialBuildWalkable(M, spec);
  const wallOpen = _spatialWallOnlyOpen(M, cols, rows, spec);
  const clearance = _spatialClearance(cols, rows, walkable);
  const wallGaps = _spatialFindWallGapDoorways(M);
  _spatialSharedCache = { mapRef: M, mapId, revision, spec, cols, rows, walkable, wallOpen, clearance, wallGaps };
  return _spatialSharedCache;
}
// 두 점을 잇는 이동 segment가 opening plane(문 개구부)을 횡단하는가
function _segCrossesOpening(x1, y1, x2, y2, op) {
  const ax = op.ax, ay = op.ay, bx = op.bx, by = op.by;
  const d1x = x2 - x1, d1y = y2 - y1, d2x = bx - ax, d2y = by - ay;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((ax - x1) * d2y - (ay - y1) * d2x) / den;
  const u = ((ax - x1) * d1y - (ay - y1) * d1x) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1);
}
function buildTacticalSpatialGraph(map, options) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  if (!M) return null;
  ensureTacticalGeometryIds(M);
  const mapId = _tgMapId(M);
  const tg = ensureTacticalGeometry();
  const shared = _spatialGetShared(M, tg.revision || 0);
  const { spec, cols, rows, walkable, wallOpen, clearance, wallGaps } = shared;
  const N = cols * rows;

  // ══ 1. PORTAL PRIMITIVE — region보다 먼저. doorway는 벽 형상에서만 나온다. ══
  const openings = [];          // doorway만 — region 분할 경계
  const tacticalThresholds = []; // narrowPassage/openThreshold — 분할하지 않음(전술 정보)
  for (const wg of wallGaps) {
    const horiz = (wg.orientation === 'horizontal');   // 벽 라인이 가로 → 통행은 세로
    // opening segment = 간극 자체 (벽 라인 위)
    const halfW = wg.gapWidth / 2;
    const ax = horiz ? (wg.centerX - halfW) : wg.centerX;
    const ay = horiz ? wg.centerY : (wg.centerY - halfW);
    const bx = horiz ? (wg.centerX + halfW) : wg.centerX;
    const by = horiz ? wg.centerY : (wg.centerY + halfW);
    openings.push({
      kind: 'doorway', ax, ay, bx, by,
      centerX: wg.centerX, centerY: wg.centerY,
      tangentX: horiz ? 1 : 0, tangentY: horiz ? 0 : 1,
      normalX: horiz ? 0 : 1, normalY: horiz ? 1 : 0,   // crossing normal (통행 방향)
      sideA: wg.sideA, sideB: wg.sideB, width: wg.gapWidth,
      clearanceVerified: true, gridNativeCapable: null, path: wg.path,
      orientation: horiz ? 'horizontal' : 'vertical',
    });
  }
  // 외부 주입 개구부 — 믿음 위상이 쓴다.
  //   관측으로 재구성한 지형은 긴 벽 라인이 아니라 조각이라 wallGaps로는 문이 안 나온다.
  //   대신 그 유닛이 섹터 분석으로 이미 찾아 둔 개구부(UNK)를 문으로 준다.
  if (options && Array.isArray(options.extraOpenings)) {
    for (const eo of options.extraOpenings) if (eo) openings.push(eo);
  }
  // 격자 chokepoint — doorway source가 아니다. region을 분할하지 않고 전술 정보로만 보관한다.
  //   (복도 중간의 좁은 목이 중앙 복도를 토막내지 않도록)
  for (const co of _spatialChokepointOpenings(shared, N)) tacticalThresholds.push(co);

  // ══ 2. REGION FLOOD FILL — 정확히 한 번. cell band를 제거하지 않고,
  //     이동 segment가 opening plane을 횡단할 때만 연결을 끊는다.
  //     (방↔복도는 분리되지만 복도의 좌우 진행은 끊기지 않는다)
  const labels = new Int32Array(N);
  const gs = PATH_GRID;
  const cellX = (i) => spec.cellCenterX(i % cols), cellY = (i) => spec.cellCenterY((i - (i % cols)) / cols);
  // [perf] opening을 격자 셀 버킷에 색인해 인접 검사에서 후보만 확인한다.
  const openIndex = new Map();
  for (const op of openings) {
    const x0 = Math.min(op.ax, op.bx), x1o = Math.max(op.ax, op.bx);
    const y0 = Math.min(op.ay, op.by), y1o = Math.max(op.ay, op.by);
    for (let ccx = spec.rawCellX(x0) - 1; ccx <= spec.rawCellX(x1o) + 1; ccx++)
      for (let ccy = spec.rawCellY(y0) - 1; ccy <= spec.rawCellY(y1o) + 1; ccy++) {
        const k = ccx + ',' + ccy;
        if (!openIndex.has(k)) openIndex.set(k, []);
        openIndex.get(k).push(op);
      }
  }
  const blockedPair = (i, j) => {
    const cxi = i % cols, cyi = (i - cxi) / cols;
    const list = openIndex.get(cxi + ',' + cyi);
    if (!list) return false;
    const x1 = cellX(i), y1 = cellY(i), x2 = cellX(j), y2 = cellY(j);
    for (const op of list) if (_segCrossesOpening(x1, y1, x2, y2, op)) return true;
    return false;
  };
  let regionSeq = 0;
  const rawRegions = [];
  for (let start = 0; start < N; start++) {
    if (!walkable[start] || labels[start] !== 0) continue;
    regionSeq++;
    const stack = [start], cells = [];
    labels[start] = regionSeq;
    while (stack.length) {
      const i = stack.pop(); cells.push(i);
      const cx = i % cols, cy = (i - cx) / cols;
      for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx2 = cx + ddx, ny2 = cy + ddy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows) continue;
        const j = ny2 * cols + nx2;
        if (labels[j] !== 0 || !walkable[j]) continue;
        if (blockedPair(i, j)) continue;   // opening plane 횡단 — region 경계
        labels[j] = regionSeq; stack.push(j);
      }
    }
    rawRegions.push({ seq: regionSeq, cells });
  }
  // 미세 조각 병합 (격자 이산화 잡음) — opening을 넘지 않는 인접 region으로만
  const regionOfSeq = new Map(rawRegions.map(r => [r.seq, r]));
  for (const r of rawRegions) {
    if (r.merged || r.cells.length >= SPATIAL_TINY_CELLS) continue;
    const nb = new Map();
    for (const i of r.cells) {
      const cx = i % cols, cy = (i - cx) / cols;
      for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx2 = cx + ddx, ny2 = cy + ddy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows) continue;
        const j = ny2 * cols + nx2, lb = labels[j];
        if (lb && lb !== r.seq && !blockedPair(i, j)) nb.set(lb, (nb.get(lb) || 0) + 1);
      }
    }
    let bestSeq = 0, bestShare = 0;
    for (const [lb, c] of nb) if (c > bestShare) { bestShare = c; bestSeq = lb; }
    if (bestSeq) { const host = regionOfSeq.get(bestSeq); if (host && !host.merged) { for (const i of r.cells) { labels[i] = bestSeq; host.cells.push(i); } r.merged = true; } }
  }
  const finalRegions = rawRegions.filter(r => !r.merged);
  // 안정 ID
  const regions = new Map(); const seqToId = new Map();
  for (const r of finalRegions) {
    let minCell = Infinity, sx = 0, sy = 0;
    for (const i of r.cells) { if (i < minCell) minCell = i; const cx = i % cols; sx += cx; sy += (i - cx) / cols; }
    const sorted = r.cells.slice().sort((a, b) => a - b);
    const mcx = minCell % cols, mcy = (minCell - mcx) / cols;
    const id = 'region_' + mapId + '_' + mcx + '_' + mcy + '_' + r.cells.length + '_' + _tgStableHash(sorted.join(','));
    seqToId.set(r.seq, id);
    regions.set(id, { id, mapId, cellCount: r.cells.length, cells: r.cells,
      centerX: spec.originX + (sx / r.cells.length) * gs, centerY: spec.originY + (sy / r.cells.length) * gs,
      minCellIdx: minCell, portalIds: [], type: 'unknown' });
  }
  const regionIdList = Array.from(regions.keys());
  const idIndex = new Map(regionIdList.map((k, i) => [k, i]));
  const cellRegionIds = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) { const lb = labels[i]; if (lb && seqToId.has(lb)) cellRegionIds[i] = idIndex.get(seqToId.get(lb)); }

  // ══ 3. PORTAL EDGE — opening 양쪽 side sample에서 region을 얻어 연결한다.
  //     sub-grid는 이미 검출된 opening의 연결을 보완할 뿐, 새 doorway를 추측하지 않는다.
  const portals = new Map();
  const portalCellIds = new Int32Array(N).fill(-1);   // legacy 단일 후보(호환)
  const portalCellCandidates = new Map();            // cellIndex → [portalIndex...]
  const nearestRegionAt = (x, y) => {
    const cx = spec.rawCellX(x), cy = spec.rawCellY(y);
    for (let rad = 0; rad <= 2; rad++) {
      for (let ddy = -rad; ddy <= rad; ddy++) for (let ddx = -rad; ddx <= rad; ddx++) {
        if (Math.max(Math.abs(ddx), Math.abs(ddy)) !== rad) continue;
        const nx2 = cx + ddx, ny2 = cy + ddy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows) continue;
        const ri = cellRegionIds[ny2 * cols + nx2];
        if (ri >= 0) return { id: regionIdList[ri], cx: nx2, cy: ny2 };
      }
    }
    return null;
  };
  for (const op of openings) {   // doorway만 portal edge가 된다
    const ra = nearestRegionAt(op.sideA.x, op.sideA.y);
    const rb = nearestRegionAt(op.sideB.x, op.sideB.y);
    if (!ra || !rb || ra.id === rb.id) continue;
    // grid-native 여부: 양쪽 side에서 격자 셀만으로 직접 인접하면 native
    // gridNative = 경로 격자만으로도 두 region이 직접 이어지는 문(= aliasing 없이 잡히는 문).
    //   side sample 간격(2.4m)을 고려해 격자 거리로 판정한다.
    // gridNative = 경로 격자만으로 두 region이 직접 이어지는가.
    //   이 opening을 횡단하는 인접 walkable cell 쌍이 실제로 존재하면 native, 없으면 sub-grid bridge.
    let gridNative = false;
    {
      const ocx2 = spec.rawCellX(op.centerX), ocy2 = spec.rawCellY(op.centerY);
      for (let ddy = -2; ddy <= 2 && !gridNative; ddy++) for (let ddx = -2; ddx <= 2 && !gridNative; ddx++) {
        const ax2 = ocx2 + ddx, ay2 = ocy2 + ddy;
        if (ax2 < 0 || ay2 < 0 || ax2 >= cols || ay2 >= rows) continue;
        const ia = ay2 * cols + ax2; if (!walkable[ia] || cellRegionIds[ia] < 0) continue;
        for (const [ex2, ey2] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const bx2 = ax2 + ex2, by2 = ay2 + ey2;
          if (bx2 < 0 || by2 < 0 || bx2 >= cols || by2 >= rows) continue;
          const ib = by2 * cols + bx2; if (!walkable[ib] || cellRegionIds[ib] < 0) continue;
          if (cellRegionIds[ia] === cellRegionIds[ib]) continue;
          if (_segCrossesOpening(cellX(ia), cellY(ia), cellX(ib), cellY(ib), op)) { gridNative = true; break; }
        }
      }
    }
    // clearance 검증 — 동일 PATH_PAD 계약
    let verified = true;
    if (op.path) {
      for (let k = 1; k < op.path.length; k++) {
        if (pathBlockedForMap(M, op.path[k - 1].x, op.path[k - 1].y, op.path[k].x, op.path[k].y, PATH_PAD)) { verified = false; break; }
      }
    }
    if (!verified) continue;
    const ids = [ra.id, rb.id].sort();
    const ocx = spec.rawCellX(op.centerX), ocy = spec.rawCellY(op.centerY);
    const pid = 'portal_' + mapId + '_' + ids[0].slice(-8) + '_' + ids[1].slice(-8) + '_' + ocx + '_' + ocy + '_' + op.orientation;
    if (portals.has(pid)) continue;
    portals.set(pid, { id: pid, mapId, regionAId: ids[0], regionBId: ids[1],
      centerX: op.centerX, centerY: op.centerY, orientation: op.orientation,
      portalType: op.kind, cellCount: 0, cells: [], minClearance: op.width || 0,
      gridNative, subgridBridge: !gridNative, clearanceVerified: true,
      openingAX: op.ax, openingAY: op.ay, openingBX: op.bx, openingBY: op.by,
      tangentX: op.tangentX, tangentY: op.tangentY, normalX: op.normalX, normalY: op.normalY,
      bridgePath: op.path, width: op.width || 0 });
    const A = regions.get(ids[0]), B = regions.get(ids[1]);
    if (A && A.portalIds.indexOf(pid) < 0) A.portalIds.push(pid);
    if (B && B.portalIds.indexOf(pid) < 0) B.portalIds.push(pid);
    // [AI0-B R1] 문 중심 cell 하나가 아니라 opening segment가 덮는 모든 cell을 crossing index에 등록.
    //   문 가장자리로 지나간 ray도 같은 portal로 인식된다.
    const pIdx = portals.size - 1;
    const segLen = Math.hypot(op.bx - op.ax, op.by - op.ay);
    const steps = Math.max(2, Math.ceil(segLen / (gs * 0.4)) + 1);
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      const sxp = op.ax + (op.bx - op.ax) * f, syp = op.ay + (op.by - op.ay) * f;
      for (let ddy = -1; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
        const pcx = spec.rawCellX(sxp) + ddx, pcy = spec.rawCellY(syp) + ddy;
        if (pcx < 0 || pcy < 0 || pcx >= cols || pcy >= rows) continue;
        const ii = pcy * cols + pcx;
        if (portalCellIds[ii] < 0) portalCellIds[ii] = pIdx;
        let lst = portalCellCandidates.get(ii);
        if (!lst) { lst = []; portalCellCandidates.set(ii, lst); }
        if (lst.indexOf(pIdx) < 0) lst.push(pIdx);
      }
    }
    op.portalId = pid;
  }
  // tacticalThreshold — 어느 region 안/사이에 있는지 기록(분할하지 않음)
  for (const th of tacticalThresholds) {
    const ta = nearestRegionAt(th.sideA.x, th.sideA.y), tb = nearestRegionAt(th.sideB.x, th.sideB.y);
    th.regionAId = ta ? ta.id : null;
    th.regionBId = tb ? tb.id : null;
    th.withinSingleRegion = !!(ta && tb && ta.id === tb.id);
    th.thresholdId = 'threshold_' + mapId + '_' + Math.round(th.centerX) + '_' + Math.round(th.centerY) + '_' + th.orientation;
  }
  const openingByPortalId = new Map();
  for (const op of openings) if (op.portalId) openingByPortalId.set(op.portalId, op);
  for (const r of regions.values()) r.type = _spatialClassifyRegion(r, cols);
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const fpParts = [];
  for (const k of Array.from(regions.keys()).sort()) fpParts.push('R' + k);
  for (const k of Array.from(portals.keys()).sort()) fpParts.push('P' + k);
  let nativeN = 0, subN = 0, doorN = 0;
  for (const p of portals.values()) { if (p.gridNative) nativeN++; else subN++; if (p.portalType === 'doorway') doorN++; }
  return {
    mapId, geometryRevision: tg.revision || 0, gridSize: gs, pathPad: PATH_PAD,
    spec, cols, rows, walkable, clearance, openings, tacticalThresholds, openingByPortalId,
    regions, portals, cellRegionIds, portalCellIds, portalCellCandidates,
    regionIdList, portalIdList: Array.from(portals.keys()),
    buildFingerprint: _tgStableHash(fpParts.join('|')) + ':' + regions.size + ':' + portals.size,
    buildStats: { buildMs: +(t1 - t0).toFixed(2), cells: N,
      walkableCells: Array.prototype.reduce.call(walkable, (a, b) => a + b, 0),
      regionCount: regions.size, portalCount: portals.size,
      openingCount: openings.length, doorwayOpenings: wallGaps.length,
      tacticalThresholdCount: tacticalThresholds.length,
      gridNativePortals: nativeN, subgridBridgePortals: subN, doorwayPortals: doorN },
  };
}
// 격자 chokepoint → narrowPassage/openThreshold opening (doorway 아님)
function _spatialChokepointOpenings(shared, N) {
  const { spec, cols, rows, walkable, wallOpen, clearance } = shared;
  const gs = PATH_GRID;
  const hSpan = new Int16Array(N), vSpan = new Int16Array(N);
  for (let cy = 0; cy < rows; cy++) { let run = 0;
    for (let cx = 0; cx < cols; cx++) { const i = cy * cols + cx; if (wallOpen[i]) run++; else { for (let k = 1; k <= run; k++) hSpan[i - k] = run; run = 0; } }
    for (let k = 1; k <= run; k++) hSpan[cy * cols + cols - k] = run; }
  for (let cx = 0; cx < cols; cx++) { let run = 0;
    for (let cy = 0; cy < rows; cy++) { const i = cy * cols + cx; if (wallOpen[i]) run++; else { for (let k = 1; k <= run; k++) vSpan[i - k * cols] = run; run = 0; } }
    for (let k = 1; k <= run; k++) vSpan[(rows - k) * cols + cx] = run; }
  const out = [];
  const LOOK = 3;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const i = cy * cols + cx; if (!walkable[i]) continue;
    const h = hSpan[i], v = vSpan[i], narrow = Math.min(h, v);
    if (narrow > SPATIAL_PORTAL_SPAN_MAX) continue;
    const c0 = clearance[i];
    let cA = 0, cB = 0, plateau = 1;
    const vertPass = (h <= v);
    for (let k = 1; k <= LOOK; k++) { const j = vertPass ? (i - k * cols) : (i - k);
      const oob = vertPass ? (cy - k < 0) : (cx - k < 0);
      if (oob || !walkable[j]) break; cA = Math.max(cA, clearance[j]); if (Math.abs(clearance[j] - c0) < 0.01) plateau++; }
    for (let k = 1; k <= LOOK; k++) { const j = vertPass ? (i + k * cols) : (i + k);
      const oob = vertPass ? (cy + k >= rows) : (cx + k >= cols);
      if (oob || !walkable[j]) break; cB = Math.max(cB, clearance[j]); if (Math.abs(clearance[j] - c0) < 0.01) plateau++; }
    if (!((cA >= c0 + SPATIAL_CLEARANCE_MARGIN) && (cB >= c0 + SPATIAL_CLEARANCE_MARGIN) && plateau <= SPATIAL_PLATEAU_MAX)) continue;
    // opening plane = 통행축에 직교하는 얇은 단면
    const wpx = narrow * gs / 2;
    const px = spec.cellCenterX(cx), py = spec.cellCenterY(cy);
    const ax = vertPass ? (px - wpx) : px, ay = vertPass ? py : (py - wpx);
    const bx = vertPass ? (px + wpx) : px, by = vertPass ? py : (py + wpx);
    const off = gs;
    const sA = vertPass ? { x: px, y: py - off } : { x: px - off, y: py };
    const sB = vertPass ? { x: px, y: py + off } : { x: px + off, y: py };
    out.push({ kind: (c0 <= 1.5 ? 'narrowPassage' : 'openThreshold'), ax, ay, bx, by,
      centerX: px, centerY: py, tangentX: vertPass ? 1 : 0, tangentY: vertPass ? 0 : 1,
      normalX: vertPass ? 0 : 1, normalY: vertPass ? 1 : 0,
      sideA: sA, sideB: sB, width: narrow * gs, clearanceVerified: true,
      gridNativeCapable: true, path: [sA, sB], orientation: vertPass ? 'horizontal' : 'vertical' });
  }
  return out;
}
function _spatialFindWallGapDoorways(map) {
  const M = map || (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
  if (!M || !Array.isArray(M.walls)) return [];
  const gaps = [];
  const ALIGN_TOL = 6;        // px — 같은 벽 라인으로 볼 오차
  const MAX_GAP = 2.2 * ((typeof PX_PER_M !== 'undefined') ? PX_PER_M : 32);   // 문으로 볼 최대 간극(넓은 간극은 열린 공간)
  const groups = new Map();
  for (const w of M.walls) {
    if (w.w == null || w.h == null) continue;
    const horiz = w.w >= w.h;
    const line = horiz ? Math.round((w.y + w.h / 2) / ALIGN_TOL) : Math.round((w.x + w.w / 2) / ALIGN_TOL);
    const key = (horiz ? 'H' : 'V') + line;
    if (!groups.has(key)) groups.set(key, { horiz, walls: [] });
    groups.get(key).walls.push(w);
  }
  for (const [, grp] of groups) {
    const { horiz, walls } = grp;
    if (walls.length < 2) continue;
    walls.sort((a, b) => horiz ? (a.x - b.x) : (a.y - b.y));
    for (let i = 1; i < walls.length; i++) {
      const prev = walls[i - 1], cur = walls[i];
      const gapStart = horiz ? (prev.x + prev.w) : (prev.y + prev.h);
      const gapEnd = horiz ? cur.x : cur.y;
      const gap = gapEnd - gapStart;
      if (gap <= 1 || gap > MAX_GAP) continue;
      const cx = horiz ? (gapStart + gap / 2) : (prev.x + prev.w / 2);
      const cy = horiz ? (prev.y + prev.h / 2) : (gapStart + gap / 2);
      // 문을 가로지르는 실제 통과 가능 segment 확인 (양옆으로 조금 벗어난 지점끼리 연결)
      const off = 1.2 * ((typeof PX_PER_M !== 'undefined') ? PX_PER_M : 32);
      const ax = horiz ? cx : cx - off, ay = horiz ? cy - off : cy;
      const bx = horiz ? cx : cx + off, by = horiz ? cy + off : cy;
      let passable = false, viaX = null, viaY = null;
      {
        if (!pathBlockedForMap(M, ax, ay, bx, by, PATH_PAD)) { passable = true; }
        else {
          // 문 중심이 살짝 어긋난 경우 — 간극 안에서 sub-grid 샘플
          const half = gap / 2;
          for (let d = -half; d <= half && !passable; d += Math.max(1, gap / 10)) {
            const mx = horiz ? (cx + d) : cx, my = horiz ? cy : (cy + d);
            if (!pathBlockedForMap(M, ax, ay, mx, my, PATH_PAD) && !pathBlockedForMap(M, mx, my, bx, by, PATH_PAD)) {
              passable = true; viaX = mx; viaY = my;
            }
          }
        }
      }
      if (!passable) continue;
      gaps.push({ centerX: (viaX != null) ? viaX : cx, centerY: (viaY != null) ? viaY : cy,
        orientation: horiz ? 'horizontal' : 'vertical', gapWidth: gap,
        sideA: { x: ax, y: ay }, sideB: { x: bx, y: by },
        path: (viaX != null) ? [{ x: ax, y: ay }, { x: viaX, y: viaY }, { x: bx, y: by }]
                             : [{ x: ax, y: ay }, { x: bx, y: by }] });
    }
  }
  // 벽 끝과 직교 벽 사이의 간극(문틀 한쪽만 있는 문)도 doorway로 인식한다.
  const M2 = M;
  const blockedAt = (x, y) => {
    for (const w of M2.walls) if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
    return false;
  };
  for (const w of M2.walls) {
    if (w.w == null || w.h == null) continue;
    const horiz = w.w >= w.h;
    const thick = horiz ? w.h : w.w;
    const cx0 = horiz ? w.x : (w.x + w.w / 2), cy0 = horiz ? (w.y + w.h / 2) : w.y;
    const cx1 = horiz ? (w.x + w.w) : (w.x + w.w / 2), cy1 = horiz ? (w.y + w.h / 2) : (w.y + w.h);
    for (const [ex, ey, dirx, diry] of [[cx0, cy0, horiz ? -1 : 0, horiz ? 0 : -1], [cx1, cy1, horiz ? 1 : 0, horiz ? 0 : 1]]) {
      // 벽 축 방향으로 전진하며 다음 장애물까지 거리 측정
      let d = 0, hitDist = -1;
      const STEP = 2;
      while (d <= MAX_GAP) {
        d += STEP;
        if (blockedAt(ex + dirx * d, ey + diry * d)) { hitDist = d; break; }
      }
      if (hitDist < 0 || hitDist <= thick) continue;
      const gapW = hitDist;
      const gcx = ex + dirx * (gapW / 2), gcy = ey + diry * (gapW / 2);
      const off = 1.2 * ((typeof PX_PER_M !== 'undefined') ? PX_PER_M : 32);
      // 통행은 벽 축의 직교 방향
      const ax = horiz ? gcx : (gcx - off), ay = horiz ? (gcy - off) : gcy;
      const bx = horiz ? gcx : (gcx + off), by = horiz ? (gcy + off) : gcy;
      if (pathBlockedForMap(M2, ax, ay, bx, by, PATH_PAD)) continue;
      gaps.push({ centerX: gcx, centerY: gcy, orientation: horiz ? 'horizontal' : 'vertical',
        gapWidth: gapW, sideA: { x: ax, y: ay }, sideB: { x: bx, y: by },
        path: [{ x: ax, y: ay }, { x: bx, y: by }] });
    }
  }
  // 같은 문을 두 경로(동일 라인 간극 / 벽 끝 간극)로 중복 검출한 것을 제거한다.
  const dedup = [], DEDUP_TOL = 8;
  for (const g2 of gaps) {
    let dup = false;
    for (const k of dedup) {
      if (k.orientation === g2.orientation && Math.abs(k.centerX - g2.centerX) <= DEDUP_TOL && Math.abs(k.centerY - g2.centerY) <= DEDUP_TOL) { dup = true; break; }
    }
    if (!dup) dedup.push(g2);
  }
  return dedup;
}
// [AI0-B R1] legacy 제거됨: _spatialFindSubgridBridges (region pair 전수 검색).
//   sub-grid 연결은 이제 buildTacticalSpatialGraph의 opening side-sample 경로에서만 수행된다.
function _spatialClusterTouchesWall(cl, cols, rows, walkable) {
  for (const i of cl.cells) {
    const cx = i % cols, cy = (i - cx) / cols;
    for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx2 = cx + ddx, ny2 = cy + ddy;
      if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows) return true;
      if (!walkable[ny2 * cols + nx2]) return true;
    }
  }
  return false;
}
function _spatialClassifyRegion(r, cols) {
  let minCX = Infinity, maxCX = -Infinity, minCY = Infinity, maxCY = -Infinity;
  for (const i of r.cells) { const cx = i % cols, cy = (i - cx) / cols;
    minCX = Math.min(minCX, cx); maxCX = Math.max(maxCX, cx); minCY = Math.min(minCY, cy); maxCY = Math.max(maxCY, cy); }
  const w = maxCX - minCX + 1, h = maxCY - minCY + 1;
  const fill = r.cellCount / Math.max(1, w * h);
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  if (r.portalIds.length >= 3) return 'junction';
  if (r.portalIds.length <= 1 && r.cellCount < 14) return 'deadEnd';
  if (aspect >= 3 && fill > 0.5) return 'corridor';
  if (r.cellCount >= 120) return 'openArea';
  if (fill >= 0.6) return 'room';
  return 'mixed';
}
// ── graph 수명 관리 ──
function ensureTacticalSpatialGraph(force) {
  const tg = ensureTacticalGeometry();
  const mapId = _tgMapId(null);
  const stale = !tg.spatialGraph || tg.dirty || tg.spatialGraph.mapId !== mapId || tg.graphBuiltRevision !== (tg.revision || 0);
  if (force || stale) {
    tg.spatialGraph = buildTacticalSpatialGraph(null, {});
    tg.graphBuiltRevision = tg.revision || 0;
    tg.dirty = false;
    tg.dirtyReasons = [];
  }
  return tg.spatialGraph;
}
function invalidateTacticalSpatialGraph(reason) {
  const tg = ensureTacticalGeometry();
  tg.dirty = true;
  if (reason) { tg.dirtyReasons.push(reason); while (tg.dirtyReasons.length > 16) tg.dirtyReasons.shift(); }
  return tg;
}
// 위상 그래프 선택 — 공간 인지가 켜져 있고 unit이 있으면 그 유닛이 **믿는** 방/문 지도,
//   아니면 기존 정답 그래프. 믿음 그래프는 애초에 믿는 것만 담으므로
//   "이 방을 봤는가"를 따로 물을 필요가 없다.
//
// [보류] 믿음 위상은 아직 켜지 않는다 — 모델이 맞지 않는다.
//   방/문은 flood fill로 나온다. 그건 닫힌 기하가 있어야 성립하는데, 관측으로 재구성한
//   지형은 조각이다. 20초 실측에서 한 유닛이 믿는 벽은 맵 면적의 1.9%(정답 7.2%),
//   조각 13개뿐이라 98%가 빈 공간으로 이어져 **방이 하나**로 나온다.
//   방이 안 나뉘니 개구부를 주입해도 나눌 경계가 없어 문도 0개다.
//   그 상태로 켜면 currentRegionId가 늘 같은 방이 되고 포탈 위험 평가가 통째로 비어
//   조용히 능력이 줄어든다(에러는 안 난다).
//   조각난 믿음에 맞는 다른 위상 모델이 필요하다 — 프로토타입처럼 방 분할을 포기하고
//   개구부와 "그 너머 미확인" 만으로 가는 쪽이 유력하다.
//   아래 배선(believedMapOf/beliefGraphOf/extraOpenings 훅)은 그 시도를 위해 남겨 둔다.
const USE_BELIEF_TOPOLOGY = false;
// 믿음 방(Room) — 유닛이 자기 방을 알고, 문턱을 알고, 소음이 어느 문으로 왔는지 판단한다.
//   위상 그래프(위)와 달리 **방을 다각형으로 나누지 않는다.** 경계는 벽/문턱/프론티어 셋뿐이고
//   "나는 어느 방인가"는 문턱 횡단 이벤트로, "소리는 어느 문으로 왔나"는 아는 문 중
//   우회가 가장 짧은 문으로 답한다. 끄면 오늘과 완전히 동일하게 동작한다.
const USE_BELIEF_ROOMS = true;
//   이번 단계는 **적 AI에만** 켠다. 아군은 플레이어 명령 게이트웨이와 경합할 수 있어 다음 단계로 미룬다.
//   런타임 토글 — isSpatialPerceptionOn과 같은 관용구. A/B 계측이 되려면 const만으로는 안 된다.
function isBeliefRoomsOn() {
  if (typeof GAME !== 'undefined' && GAME.beliefRoomsOn != null) return !!GAME.beliefRoomsOn;
  return USE_BELIEF_ROOMS;
}
function beliefRoomsActiveFor(unit) {
  return !!(isBeliefRoomsOn() && unit && unit.team === 'enemy'
            && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
            && typeof SpatialPerception !== 'undefined'
            && typeof MAP_DATA !== 'undefined' && Array.isArray(MAP_DATA.rooms) && MAP_DATA.rooms.length > 0);
}
function tacticalGraphFor(unit) {
  if (USE_BELIEF_TOPOLOGY && unit && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()
      && typeof SpatialPerception !== 'undefined') {
    const g = SpatialPerception.beliefGraphOf(unit);
    if (g) return g;
  }
  return ensureTacticalSpatialGraph();
}
function getSpatialRegionAt(x, y, graph) {
  const g = graph || ensureTacticalSpatialGraph();
  if (!g) return null;
  const cx = g.spec.rawCellX(x), cy = g.spec.rawCellY(y);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return null;
  const i = cy * g.cols + cx;
  const ri = g.cellRegionIds[i];
  if (ri >= 0) return g.regions.get(g.regionIdList[ri]) || null;
  // portal band 위 또는 비보행 셀 — 가장 가까운 region 셀 탐색(짧은 반경)
  for (let rad = 1; rad <= 3; rad++) {
    for (let ddy = -rad; ddy <= rad; ddy++) for (let ddx = -rad; ddx <= rad; ddx++) {
      if (Math.max(Math.abs(ddx), Math.abs(ddy)) !== rad) continue;
      const nx2 = cx + ddx, ny2 = cy + ddy;
      if (nx2 < 0 || ny2 < 0 || nx2 >= g.cols || ny2 >= g.rows) continue;
      const k = ny2 * g.cols + nx2;
      const r2 = g.cellRegionIds[k];
      if (r2 >= 0) return g.regions.get(g.regionIdList[r2]) || null;
    }
  }
  return null;
}
function getSpatialPortalAt(x, y, graph) {
  const g = graph || ensureTacticalSpatialGraph();
  if (!g) return null;
  const cx = g.spec.rawCellX(x), cy = g.spec.rawCellY(y);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return null;
  const pi = g.portalCellIds[cy * g.cols + cx];
  if (pi < 0) return null;
  return g.portals.get(g.portalIdList[pi]) || null;
}
// region 간 최단 portal chain (BFS)
function getPortalChainBetween(regionAId, regionBId, graph) {
  const g = graph || ensureTacticalSpatialGraph();
  if (!g || !regionAId || !regionBId) return null;
  if (regionAId === regionBId) return [];
  const prev = new Map([[regionAId, null]]);
  const q = [regionAId];
  while (q.length) {
    const cur = q.shift();
    const r = g.regions.get(cur); if (!r) continue;
    for (const pid of r.portalIds) {
      const p = g.portals.get(pid); if (!p) continue;
      const nxt = (p.regionAId === cur) ? p.regionBId : p.regionAId;
      if (prev.has(nxt)) continue;
      prev.set(nxt, { from: cur, portalId: pid });
      if (nxt === regionBId) {
        const chain = []; let c = nxt;
        while (prev.get(c)) { chain.unshift(prev.get(c).portalId); c = prev.get(c).from; }
        return chain;
      }
      q.push(nxt);
    }
  }
  return null;
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] PER-UNIT SPATIAL KNOWLEDGE — 시각으로만 공간을 배운다.
// ════════════════════════════════════════════════════════════════════════════
function markRegionKnown(unit, regionId, opts) {
  if (!unit || !regionId) return null;
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const o = opts || {};
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  let kr = mem.knownRegions.get(regionId);
  if (kr && (now - kr.lastObservedAt) < 0.5 && !(o.state === 'entered' && kr.state !== 'entered')) return kr;
  if (!kr) {
    kr = { regionId, state: o.state || 'glimpsed', firstKnownAt: now, lastObservedAt: now,
      confidence: (o.confidence != null) ? o.confidence : 0.6 };
    mem.knownRegions.set(regionId, kr);
  } else {
    kr.lastObservedAt = now;
    // entered는 glimpsed보다 강하다 — 역행하지 않는다
    if (o.state === 'entered') kr.state = 'entered';
    if (o.confidence != null) kr.confidence = Math.max(kr.confidence, o.confidence);
  }
  return kr;
}
function markPortalKnown(unit, portal, opts) {
  if (!unit || !portal) return null;
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const o = opts || {};
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  let kp = mem.knownPortals.get(portal.id);
  if (kp && (now - kp.lastSeenAt) < 0.5) return kp;   // [perf] 최근 관측은 재기록 생략
  if (!kp) {
    kp = { portalId: portal.id, regionAId: portal.regionAId, regionBId: portal.regionBId,
      centerX: portal.centerX, centerY: portal.centerY, orientation: portal.orientation,
      portalType: portal.portalType, firstSeenAt: now, lastSeenAt: now,
      confidence: (o.confidence != null) ? o.confidence : 0.9 };
    mem.knownPortals.set(portal.id, kp);
  } else {
    kp.lastSeenAt = now;
    if (o.confidence != null) kp.confidence = Math.max(kp.confidence, o.confidence);
  }
  return kp;
}
// ── 방 지식 ─────────────────────────────────────────────────
//   상태는 역행하지 않는다:  named  →  entered  →  cleared
//     named   — 이름만 안다 (문턱 너머로 들여다봤다)
//     entered — 직접 들어가 봤다
//     cleared — 들어가서 링이 닫히고(sightClosed) 적을 못 봤다
const ROOM_STATE_RANK = { named: 1, entered: 2, cleared: 3 };
function markRoomKnown(unit, room, state, now) {
  if (!unit || !room) return null;
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const t = (now != null) ? now : (GAME.gameTime || 0);
  let kr = mem.knownRooms.get(room.id);
  if (!kr) {
    kr = { roomId: room.id, name: room.name, state: state || 'named',
           firstKnownAt: t, lastSeenAt: t, clearedAt: null };
    mem.knownRooms.set(room.id, kr);
  } else {
    kr.lastSeenAt = t;
    if (ROOM_STATE_RANK[state] > ROOM_STATE_RANK[kr.state]) kr.state = state;
  }
  if (kr.state === 'cleared' && kr.clearedAt == null) kr.clearedAt = t;
  return kr;
}
// 유닛이 지금 서 있는 방 + 문턱 너머로 보이는 방의 이름을 습득한다.
function updateUnitCurrentRoom(unit) {
  if (!unit || !unit.alive) return null;
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (!M || !Array.isArray(M.rooms) || !M.rooms.length) return null;
  const now = GAME.gameTime || 0;
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const here = roomAt(unit.x, unit.y);
  if (here) {
    mem.currentRoomId = here.id;
    markRoomKnown(unit, here, 'entered', now);
    // 클리어 판정 — 이 방을 다 봤고(링이 닫혔다) **이 방 안에** 보이는 적이 없다.
    //   맵 전체에 적이 없다는 뜻이 아니다. 옆방 적이 보여도 이 방은 비어 있을 수 있다.
    const S = unit.aiMemory && unit.aiMemory.spatial;
    if (S && S.sector && S.sector.sightClosed && typeof getPerceptionSnapshot === 'function') {
      let enemyHere = false;
      const snap = getPerceptionSnapshot(unit);     // tick 단위 캐시 — 추가 비용 없음
      for (const rec of snap.enemies) {
        if (!rec.visible || !rec.unit || rec.unit.isDead) continue;
        const r = roomAt(rec.unit.x, rec.unit.y);
        if (r && r.id === here.id) { enemyHere = true; break; }
      }
      if (!enemyHere) markRoomKnown(unit, here, 'cleared', now);
    }
  } else {
    mem.currentRoomId = null;
  }
  // 문턱 너머의 방은 이름만 알게 된다 — 들어가 본 게 아니다
  if (typeof SpatialPerception !== 'undefined' && SpatialPerception.thresholdsOf) {
    for (const t of SpatialPerception.thresholdsOf(unit)) {
      if (t.ax == null) continue;
      const beyond = roomAt(t.ax, t.ay);
      if (beyond && (!here || beyond.id !== here.id)) markRoomKnown(unit, beyond, 'named', now);
    }
  }
  return here;
}

// 유닛이 현재 서 있는 region — 진입은 entered(확신 1.0)
function updateUnitCurrentRegion(unit) {
  if (!unit) return null;
  const g = tacticalGraphFor(unit);
  if (!g) return null;
  const r = getSpatialRegionAt(unit.x, unit.y, g);
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  if (!r) { mem.currentRegionId = null; return null; }
  if (mem.currentRegionId !== r.id) mem.currentRegionId = r.id;
  markRegionKnown(unit, r.id, { state: 'entered', confidence: 1.0 });
  return r;
}
// 시각 ray가 실제 도달한 거리까지만 공간 지식을 갱신한다.
//   blocker 뒤의 portal/region은 기록하지 않는다.
function traceSpatialKnowledgeAlongRay(unit, x1, y1, x2, y2, options) {
  // 믿음 위상이 서면 여기는 불필요해진다(그래프가 곧 아는 것이므로). 위 USE_BELIEF_TOPOLOGY 참조.
  if (USE_BELIEF_TOPOLOGY && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return null;
  const g = ensureTacticalSpatialGraph();
  if (!g || !unit) return null;
  const o = options || {};
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;
  // [perf] hot path — 셀 인덱스를 직접 읽고, 셀이 바뀔 때만 판정한다(fallback 탐색 없음).
  const step = g.gridSize;
  const n = Math.min(40, Math.max(1, Math.floor(dist / step)));
  const ux = dx / dist, uy = dy / dist;
  const cols = g.cols, rows = g.rows, gs = g.gridSize, sp = g.spec;
  const scx = sp.rawCellX(x1), scy = sp.rawCellY(y1);
  const startRid = (scx >= 0 && scy >= 0 && scx < cols && scy < rows) ? g.cellRegionIds[scy * cols + scx] : -1;
  // [perf] 대부분의 ray는 같은 region 안에서 끝난다 — 그런 ray는 portal을 지날 수 없으므로 즉시 종료.
  //   (양 끝 cell이 같은 region이고 중간 지점도 같으면 portal band를 지나지 않았다)
  {
    const ecx = sp.rawCellX(x2), ecy = sp.rawCellY(y2);
    if (ecx >= 0 && ecy >= 0 && ecx < cols && ecy < rows) {
      const endRid = g.cellRegionIds[ecy * cols + ecx];
      if (endRid >= 0 && endRid === startRid) {
        const mcx = sp.rawCellX((x1 + x2) / 2), mcy = sp.rawCellY((y1 + y2) / 2);
        if (mcx >= 0 && mcy >= 0 && mcx < cols && mcy < rows && g.cellRegionIds[mcy * cols + mcx] === startRid) {
          return { portalsSeen: 0, regionsSeen: 0, lastPortalId: null, sameRegion: true };
        }
      }
    }
  }
  let crossedPortalIdx = -1, portalsSeen = 0, regionsSeen = 0, lastCell = -1;
  for (let k = 1; k <= n; k++) {
    const t = (dist * k) / n;
    const cx = sp.rawCellX(x1 + ux * t), cy = sp.rawCellY(y1 + uy * t);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) break;
    const ci = cy * cols + cx;
    if (ci === lastCell) continue;
    lastCell = ci;
    // [AI0-B R2] cell의 모든 portal 후보를 검사한다(가까운 문끼리 서로 가리지 않도록).
    //   실제 ray 구간이 그 opening segment를 횡단한 portal만 기록한다.
    const cand = g.portalCellCandidates ? g.portalCellCandidates.get(ci) : null;
    if (cand && cand.length) {
      const prevT = (dist * (k - 1)) / n;
      const sx0 = x1 + ux * prevT, sy0 = y1 + uy * prevT;
      const sx1 = x1 + ux * t, sy1 = y1 + uy * t;
      let any = false;
      for (const pidx of cand) {
        const portal = g.portals.get(g.portalIdList[pidx]);
        if (!portal) continue;
        const op = g.openingByPortalId ? g.openingByPortalId.get(portal.id) : null;
        if (op && !_segCrossesOpening(sx0, sy0, sx1, sy1, op)) continue;
        markPortalKnown(unit, portal, { confidence: 0.9 }); portalsSeen++; crossedPortalIdx = pidx; any = true;
      }
      if (any) continue;
    }
    if (crossedPortalIdx < 0) continue;   // portal을 지나기 전 구간은 현재 region
    const ri = g.cellRegionIds[ci];
    if (ri < 0 || ri === startRid) continue;
    markRegionKnown(unit, g.regionIdList[ri], { state: 'glimpsed', confidence: 0.6 });
    regionsSeen++;
  }
  return { portalsSeen, regionsSeen,
    lastPortalId: (crossedPortalIdx >= 0) ? g.portalIdList[crossedPortalIdx] : null };
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] PORTAL-AWARE SOUND — 소리는 geometry를 발견하지 않는다.
//   이미 시각으로 아는 portal을 통해 들어온 소리만 그 portal 방향으로 연결한다.
// ════════════════════════════════════════════════════════════════════════════
function resolveSoundArrivalPortal(listener, sourceX, sourceY) {
  const g = tacticalGraphFor(listener);
  if (!g || !listener) return { portalKnown: false, arrivalPortalId: null, arrivalDirection: null, sameRegion: false };
  // 믿음 그래프는 그 유닛이 믿는 문만 담는다 — 담겨 있다는 것 자체가 "안다"는 뜻이다.
  const _beliefGraph = !!(USE_BELIEF_TOPOLOGY && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn());
  const mem = ensureSpatialMemoryFields(ensureAIMemory(listener));
  const lr = getSpatialRegionAt(listener.x, listener.y, g);
  const sr = getSpatialRegionAt(sourceX, sourceY, g);
  if (!lr || !sr) return { portalKnown: false, arrivalPortalId: null, arrivalDirection: null, sameRegion: false };
  if (lr.id === sr.id) return { portalKnown: false, arrivalPortalId: null, arrivalDirection: null, sameRegion: true };
  const chain = getPortalChainBetween(lr.id, sr.id, g);
  if (!chain || !chain.length) return { portalKnown: false, arrivalPortalId: null, arrivalDirection: null, sameRegion: false };
  const firstId = chain[0];
  // 유닛이 아직 보지 못한 portal이면 ID를 memory에 노출하지 않는다(소리로 배우지 않음)
  if (!_beliefGraph && !mem.knownPortals.has(firstId)) return { portalKnown: false, arrivalPortalId: null, arrivalDirection: null, sameRegion: false };
  const p = g.portals.get(firstId);
  if (!p) return { portalKnown: false, arrivalPortalId: null, arrivalDirection: null, sameRegion: false };
  return { portalKnown: true, arrivalPortalId: firstId,
    arrivalDirection: Math.atan2(p.centerY - listener.y, p.centerX - listener.x),
    portalCenterX: p.centerX, portalCenterY: p.centerY, sameRegion: false };
}
// 문별 위험도는 **학습된** 값이라 기하에서 파생되지 않는다 — 그래프가 다시 서도 살아남아야 한다.
//   그런데 portal id에 region 라벨이 섞여 있어(portal_<map>_<regionA>_<regionB>_<cx>_<cy>_<orient>)
//   믿음 그래프를 재빌드하면 라벨이 바뀌며 학습이 고아가 된다.
//   그래서 위치+방향으로 양자화한 키에 저장한다. 같은 자리의 문이면 같은 키다.
function _portalDangerKey(unit, portalId) {
  if (!portalId) return portalId;
  try {
    const g = (typeof tacticalGraphFor === 'function') ? tacticalGraphFor(unit) : null;
    const p = g && g.portals ? g.portals.get(portalId) : null;
    if (p && g.spec) {
      return 'pd_' + g.spec.rawCellX(p.centerX) + '_' + g.spec.rawCellY(p.centerY) + '_' + (p.orientation || '?');
    }
  } catch (e) {}
  return portalId;
}
function recordPortalDanger(unit, portalId, dangerLevel, evidenceId) {
  if (!unit || !portalId) return null;
  const mem = ensureSpatialMemoryFields(ensureAIMemory(unit));
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  portalId = _portalDangerKey(unit, portalId);
  const cur = mem.portalDangers.get(portalId);
  const rec = { portalId, dangerLevel: Math.max(cur ? cur.dangerLevel : 0, dangerLevel),
    confidence: 0.8, lastUpdatedAt: now, sourceEvidenceId: evidenceId || null };
  mem.portalDangers.set(portalId, rec);
  return rec;
}
// === 레이캐스트 스캔 — 한 ray ===
//   half cover는 기록 후 통과 / full wall/cover는 기록 후 종료
//   유닛에 닿으면 lastSeenEnemy 갱신
//   source: 'sweep' | 'initialBurstPass1' | 'initialBurstPass2' | 'validationRay' | 'coverStateRay'
function castScanRay(unit, ox, oy, ang, maxPx, now, mem, source, angularSpacing) {
  source = source || 'sweep';
  const _scanAngularSpacing = (angularSpacing != null && isFinite(angularSpacing)) ? angularSpacing : 0.12;
  // === observer stance — prone이면 halfCover 통과 제한 ===
  const observerStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(unit) : (unit.stance || 'standing');
  const isObserverProne = (observerStance === 'prone' || observerStance === 'goingProne');
  const ATTACHED_DIST = 1.2 * PX_PER_M_FALLBACK;
  const MIN_PEEK = 0.5 * PX_PER_M_FALLBACK;
  const MAX_PEEK = 2.5 * PX_PER_M_FALLBACK;
  const PEEK_SCALE = 0.45;
  // === 디버그용 ray 기록 (최근 N개만 유지, hit 거리 + kind 포함) ===
  let debugRayEntry = null;
  if (GAME.debugAIScan) {
    if (!mem._recentScanRays) mem._recentScanRays = [];
    debugRayEntry = { ox, oy, ang, maxPx, hitDist: maxPx, hitKind: 'open', time: now, source };
    mem._recentScanRays.push(debugRayEntry);
    if (mem._recentScanRays.length > 80) mem._recentScanRays.shift();
  }
  const nx = Math.cos(ang), ny = Math.sin(ang);
  let curX = ox, curY = oy, traveled = 0;
  const halfCovsPassed = [];   // 이 ray가 통과한 half cover (적 발견 시 behindCover로 기록)
  let safety = 0;
  let lastBlocker = null;       // 마지막 차단체 (코너 후보용)

  while (traveled < maxPx && safety < 6) {
    safety++;
    const remaining = maxPx - traveled;
    let bestT = remaining;
    let bestHit = null;

    // [AI0-B] canonical surface query 1회 — wall/cover를 한 계약으로 조회(이중 순회 없음).
    //   반환에 face/normal/tangent/segment/hitS가 포함되어 surface memory에 그대로 쓰인다.
    let bestSurface = null;
    {
      const sh = raycastWorldSurface(curX, curY, nx, ny, bestT, {});
      if (sh && sh.t < bestT) {
        bestT = sh.t; bestSurface = sh;
        bestHit = { type: (sh.objectKind === 'wall') ? 'wall' : 'cover', obj: sh.object };
      }
    }
    // 유닛 (자신 + 죽은 유닛 제외)
    let bestUnitT = Infinity, bestUnit = null;
    if (Array.isArray(GAME.units)) {
      for (const u of GAME.units) {
        if (u === unit || u.isDead) continue;
        const t = intersectRayCircle(curX, curY, nx, ny, u.x, u.y, UNIT_RADIUS);
        if (t < bestUnitT && t <= bestT) { bestUnitT = t; bestUnit = u; }
      }
    }

    // 유닛 발견
    if (bestUnit && bestUnitT <= bestT) {
      const hx = curX + nx * bestUnitT, hy = curY + ny * bestUnitT;
      recordSeenUnit(unit, bestUnit, hx, hy, now, halfCovsPassed);
      traceSpatialKnowledgeAlongRay(unit, ox, oy, hx, hy, {});
      if (debugRayEntry) {
        debugRayEntry.hitDist = traveled + bestUnitT;
        debugRayEntry.hitKind = 'enemy';
      }
      if (GAME.debugAIScan) {
        GAME.fxList.push({ type: 'ai_scan_ray', x1: ox, y1: oy, x2: hx, y2: hy, kind: 'enemy', life: 0.4, maxLife: 0.4 });
      }
      return;
    }
    // 아무것도 없음 — 사거리 끝 (열린 통로)
    if (!bestHit) {
      const ex = curX + nx * remaining, ey = curY + ny * remaining;
      recordOpenSector(mem, ang, traveled + remaining, now);
      traceSpatialKnowledgeAlongRay(unit, ox, oy, ex, ey, {});
      if (debugRayEntry) {
        debugRayEntry.hitDist = traveled + remaining;
        debugRayEntry.hitKind = 'open';
      }
      if (GAME.debugAIScan) {
        GAME.fxList.push({ type: 'ai_scan_ray', x1: ox, y1: oy, x2: ex, y2: ey, kind: 'open', life: 0.4, maxLife: 0.4 });
      }
      return;
    }

    // 충돌체 처리
    const hx = curX + nx * bestT, hy = curY + ny * bestT;
    const obj = bestHit.obj;

    if (bestHit.type === 'cover') {
      const blocksVision = isCoverBlocksVision(obj);
      if (!blocksVision) {
        // half cover — 기록 후 통과 (legacy mirror 유지 + canonical surface 관측)
        recordCover(mem, obj, 'half', now, 0.9);
        if (bestSurface) recordSurfaceObservation(mem, bestSurface, now, { hitDistance: traveled + bestT, angularSpacing: _scanAngularSpacing, confidence: 0.9 });
        // === prone observer가 halfCover에 붙어 있으면 시야 차단 ===
        if (isObserverProne) {
          const distToHC = traveled + bestT;
          if (distToHC <= ATTACHED_DIST) {
            // 붙어 있음 → fullCoverLike, ray 종료
            if (debugRayEntry) {
              debugRayEntry.hitDist = distToHC;
              debugRayEntry.hitKind = 'proneAttachedHalfCover';
            }
            if (obj && obj.x != null && obj.w != null) maybeRecordCorner(mem, obj, hx, hy, ang, now);
            return;
          }
          // 떨어져 있음 → peekDepth 계산 후 제한적 통과
          const peekDepth = Math.max(MIN_PEEK,
            Math.min(MAX_PEEK, MIN_PEEK + (distToHC - ATTACHED_DIST) * PEEK_SCALE));
          // halfCover 직후 peekDepth 만큼만 추가 탐색
          // exit point 계산
          let exitT = bestT + 2;
          if (typeof rayBoxExitT === 'function') {
            const ext = rayBoxExitT(curX, curY, nx, ny, obj, remaining);
            if (ext > bestT) exitT = ext + 1;
          }
          // 새 maxPx 제한 — peekDepth 이후 자르기
          const newRemainingMax = exitT + peekDepth;
          if (newRemainingMax < remaining) {
            // peekDepth 너머는 탐색 안 함 — 새 maxPx로 자름
            // recordOpenSector도 peekDepth까지만
            // 간단 구현: 그 너머 wall/cover 발견 시 무시
            const ex = curX + nx * Math.min(newRemainingMax, remaining);
            const ey = curY + ny * Math.min(newRemainingMax, remaining);
            // peekDepth 안에 적이 있는지만 검사 (간소화 — recordOpenSector도 안 함)
            // 일단 ray 종료 — 깊은 정보는 기록 X
            if (GAME.debugAIScan) {
              GAME.fxList.push({ type: 'ai_scan_ray', x1: curX, y1: curY, x2: hx, y2: hy, kind: 'half', life: 0.4, maxLife: 0.4 });
            }
            if (debugRayEntry) {
              debugRayEntry.hitDist = newRemainingMax;
              debugRayEntry.hitKind = 'pronePeek';
            }
            // peek 영역 안의 유닛 — checkVisibility와 동일 규칙 적용:
            //   target이 standing 또는 crouched여야 함 (prone/pinned/downed/unconscious X)
            //   target이 halfCover 반대편 ATTACHED_DIST 이내 붙어 있어야 함 (떨어진 target X)
            const peekEndT = exitT + peekDepth;
            if (Array.isArray(GAME.units)) {
              for (const u2 of GAME.units) {
                if (u2 === unit || u2.isDead) continue;
                const t = intersectRayCircle(curX, curY, nx, ny, u2.x, u2.y, UNIT_RADIUS);
                if (t < peekEndT && t > bestT) {
                  // target stance 검사 — standing / crouched만 식별 가능
                  const tgtStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(u2) : (u2.stance || 'standing');
                  if (tgtStance !== 'standing' && tgtStance !== 'crouched') {
                    // prone/goingProne/downed/unconscious/pinned → 식별 X
                    continue;
                  }
                  // target이 halfCover 반대편 ATTACHED_DIST 이내인지 (붙어 있어야 상체 노출)
                  const distFromHalfCoverToTarget = t - exitT;
                  if (distFromHalfCoverToTarget > ATTACHED_DIST) {
                    // 떨어진 target — 상체 노출 판정 없음, 식별 X
                    continue;
                  }
                  // OK — 상체 노출로 제한적 식별
                  const txp = curX + nx * t, typ = curY + ny * t;
                  recordSeenUnit(unit, u2, txp, typ, now, halfCovsPassed);
                  break;
                }
              }
            }
            return;
          }
        }
        // (기존 동작) standing/crouched observer — 정상 통과
        halfCovsPassed.push({ id: coverObjectId(obj), x: obj.x, y: obj.y });
        if (GAME.debugAIScan) {
          GAME.fxList.push({ type: 'ai_scan_ray', x1: curX, y1: curY, x2: hx, y2: hy, kind: 'half', life: 0.4, maxLife: 0.4 });
        }
        let exitT = bestT + 2;
        if (typeof rayBoxExitT === 'function') {
          const ext = rayBoxExitT(curX, curY, nx, ny, obj, remaining);
          if (ext > bestT) exitT = ext + 1;
        }
        traveled += exitT;
        curX = ox + nx * traveled;
        curY = oy + ny * traveled;
        continue;
      }
      // full cover — 기록 후 종료
      recordCover(mem, obj, 'full', now, 1.0);
      if (bestSurface) recordSurfaceObservation(mem, bestSurface, now, { hitDistance: traveled + bestT, angularSpacing: _scanAngularSpacing, confidence: 1.0 });
      lastBlocker = obj;
      if (debugRayEntry) {
        debugRayEntry.hitDist = traveled + bestT;
        debugRayEntry.hitKind = 'full';
      }
      if (GAME.debugAIScan) {
        GAME.fxList.push({ type: 'ai_scan_ray', x1: ox + nx * (traveled), y1: oy + ny * (traveled), x2: hx, y2: hy, kind: 'full', life: 0.4, maxLife: 0.4 });
      }
      maybeRecordCorner(mem, obj, hx, hy, ang, now);
      traceSpatialKnowledgeAlongRay(unit, ox, oy, hx, hy, {});
      return;
    }

    // wall — 기록 후 종료
    recordWall(mem, obj, hx, hy, now);
    if (bestSurface) recordSurfaceObservation(mem, bestSurface, now, { hitDistance: traveled + bestT, angularSpacing: _scanAngularSpacing, confidence: 1.0 });
    lastBlocker = obj;
    if (debugRayEntry) {
      debugRayEntry.hitDist = traveled + bestT;
      debugRayEntry.hitKind = 'wall';
    }
    if (GAME.debugAIScan) {
      GAME.fxList.push({ type: 'ai_scan_ray', x1: ox + nx * (traveled), y1: oy + ny * (traveled), x2: hx, y2: hy, kind: 'wall', life: 0.4, maxLife: 0.4 });
    }
    if (obj && obj.x != null && obj.w != null) maybeRecordCorner(mem, obj, hx, hy, ang, now);
    traceSpatialKnowledgeAlongRay(unit, ox, oy, hx, hy, {});
    return;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// [AI0-B] SURFACE MEMORY — 직접 본 면과 직접 본 범위만 저장한다.
//   한 face를 맞혔다고 나머지 세 face를 만들지 않고, 한 ray가 면 전체를 관측하지도 않는다.
// ════════════════════════════════════════════════════════════════════════════
const SURFACE_RANGE_MERGE_TOL = 3;      // px — 인접/겹치는 range 병합 허용치
const SURFACE_RANGE_MAX_PER_FACE = 16;  // face당 range 상한 (초과 시 인접 병합)
const SURFACE_OBS_MIN_HALF = 2;         // px — 최소 관측 반폭
const SURFACE_OBS_MAX_FRAC = 0.20;      // 한 ray가 볼 수 있는 segment 비율 상한
function _surfaceObservedHalfWidth(hitDistance, angularSpacing, segmentLength) {
  const spacing = (angularSpacing != null && isFinite(angularSpacing)) ? angularSpacing : 0.12;
  const raw = Math.max(SURFACE_OBS_MIN_HALF, Math.abs(hitDistance) * Math.tan(Math.max(0.01, spacing) / 2));
  return Math.min(raw, Math.max(SURFACE_OBS_MIN_HALF, segmentLength * SURFACE_OBS_MAX_FRAC * 0.5));
}
// 정렬 유지 + 인접/겹침 병합. 반환은 새 배열이 아니라 in-place 정리.
function _mergeObservedRanges(ranges) {
  ranges.sort((a, b) => a.s0 - b.s0);
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r.s0 <= last.s1 + SURFACE_RANGE_MERGE_TOL) {
      last.s1 = Math.max(last.s1, r.s1);
      last.lastSeenAt = Math.max(last.lastSeenAt, r.lastSeenAt);
      last.firstSeenAt = Math.min(last.firstSeenAt, r.firstSeenAt);
      last.confidence = Math.max(last.confidence, r.confidence);
    } else out.push(r);
  }
  // 상한 초과 시 가장 가까운 이웃 쌍부터 강제 병합
  while (out.length > SURFACE_RANGE_MAX_PER_FACE) {
    let bi = 0, bgap = Infinity;
    for (let i = 1; i < out.length; i++) { const g = out[i].s0 - out[i - 1].s1; if (g < bgap) { bgap = g; bi = i; } }
    out[bi - 1].s1 = Math.max(out[bi - 1].s1, out[bi].s1);
    out[bi - 1].lastSeenAt = Math.max(out[bi - 1].lastSeenAt, out[bi].lastSeenAt);
    out.splice(bi, 1);
  }
  return out;
}
function recordSurfaceObservation(mem, hit, now, options) {
  // 공간 인지가 켜져 있으면 면 기억의 주인은 믿음 계층이다.
  // hit은 정답 면(재질·armor 포함)이라 여기서 쓰면 믿음과 정답이 한 Map에 섞인다.
  if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return null;
  if (!mem || !hit || !hit.surfaceId) return null;
  ensureSpatialMemoryFields(mem);
  const o = options || {};
  const half = _surfaceObservedHalfWidth(o.hitDistance != null ? o.hitDistance : hit.t, o.angularSpacing, hit.segmentLength);
  const s0 = Math.max(0, hit.hitS - half);
  const s1 = Math.min(hit.segmentLength, hit.hitS + half);
  let sm = mem.observedSurfaces.get(hit.surfaceId);
  let _priorInvalid = 0;
  const _obsRev = (hit.observationRevision != null) ? hit.observationRevision : hit.geometryRevision;
  if (sm && sm.observationRevision !== _obsRev) {
    // [AI0-B R1] geometry가 바뀐 면은 range뿐 아니라 normal/tangent/segment/material까지 무효다.
    //   부분 갱신 대신 삭제 후 새 hit 값으로 재생성한다(오래된 metadata 잔존 방지).
    _priorInvalid = (sm.invalidCount || 0) + 1;
    mem.observedSurfaces.delete(hit.surfaceId);
    sm = null;
  }
  if (!sm) {
    sm = { surfaceId: hit.surfaceId, objectId: hit.objectId, objectKind: hit.objectKind, face: hit.face,
      geometryRevision: hit.geometryRevision, observationRevision: _obsRev,
      worldNormalX: hit.worldNormalX, worldNormalY: hit.worldNormalY,
      tangentX: hit.tangentX, tangentY: hit.tangentY,
      segmentStartX: hit.segmentStartX, segmentStartY: hit.segmentStartY,
      segmentEndX: hit.segmentEndX, segmentEndY: hit.segmentEndY, segmentLength: hit.segmentLength,
      observedRanges: [], coverType: hit.coverType,
      blocksVision: hit.blocksVision, blocksBullets: hit.blocksBullets,
      material: hit.material, armor: hit.armor,
      observerRegionId: o.observerRegionId || null,
      firstSeenAt: now, lastSeenAt: now, lastVerifiedAt: now, confidence: 1.0, invalidCount: _priorInvalid };
    mem.observedSurfaces.set(hit.surfaceId, sm);
  }
  sm.observedRanges.push({ s0, s1, firstSeenAt: now, lastSeenAt: now, confidence: (o.confidence != null ? o.confidence : 1.0) });
  sm.observedRanges = _mergeObservedRanges(sm.observedRanges);
  sm.lastSeenAt = now; sm.lastVerifiedAt = now;
  sm.segmentLength = hit.segmentLength;
  sm.coverType = hit.coverType; sm.material = hit.material; sm.armor = hit.armor;
  if (o.observerRegionId) sm.observerRegionId = o.observerRegionId;
  return sm;
}
function getObservedSurfaceCoverage(sm) {
  if (!sm || !sm.observedRanges || !sm.segmentLength) return 0;
  let sum = 0;
  for (const r of sm.observedRanges) sum += Math.max(0, r.s1 - r.s0);
  return Math.max(0, Math.min(1, sum / sm.segmentLength));
}
// 객체가 사라졌거나 geometry revision이 어긋난 surface 정리
function validateSurfaceMemory(mem, options) {
  if (!mem || !(mem.observedSurfaces instanceof Map)) return { removed: 0, reset: 0 };
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  const live = new Map();
  if (M) {
    for (const arr of [M.walls, M.coverObjects]) {
      if (!Array.isArray(arr)) continue;
      for (const o of arr) { if (o && o._tacticalObjectId) live.set(o._tacticalObjectId, o); }
    }
  }
  let removed = 0, reset = 0;
  for (const [sid, sm] of Array.from(mem.observedSurfaces.entries())) {
    const obj = live.get(sm.objectId);
    if (!obj) { mem.observedSurfaces.delete(sid); removed++; continue; }
    if (getSurfaceObservationRevision(obj) !== sm.observationRevision) {
      mem.observedSurfaces.delete(sid);   // [AI0-B R1] stale metadata 제거 — 다음 관측에서 재생성
      reset++;
    }
  }
  return { removed, reset };
}
// 기록 함수들
function recordCover(mem, obj, type, now, confidence) {
  // 공간 인지가 켜져 있으면 지형 기억의 주인은 믿음 계층이다.
  // 여기서 정답 객체를 써 넣으면 믿음과 정답이 한 Map에 섞인다.
  if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return;
  const id = coverObjectId(obj);
  const cx = obj.x + (obj.w || 0) / 2;
  const cy = obj.y + (obj.h || 0) / 2;
  mem.knownCovers.set(id, {
    id, x: cx, y: cy,
    rect: { x: obj.x, y: obj.y, w: obj.w || 0, h: obj.h || 0 },
    coverType: type,                // 'half' | 'full'
    blocksVision: (type === 'full'),
    blocksBullets: true,
    lastSeenTime: now,
    confidence: confidence,
    occupiedBy: null,
  });
  // 최대 50개 유지
  if (mem.knownCovers.size > 50) {
    let oldestKey = null, oldestTime = Infinity;
    for (const [k, v] of mem.knownCovers) {
      if (v.lastSeenTime < oldestTime) { oldestTime = v.lastSeenTime; oldestKey = k; }
    }
    if (oldestKey) mem.knownCovers.delete(oldestKey);
  }
}

function recordWall(mem, obj, hx, hy, now) {
  if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return;   // 위 recordCover와 같은 이유
  // 벽은 hit 위치 기준 grid에 fingerprint
  const gx = Math.round(hx / 16) * 16;
  const gy = Math.round(hy / 16) * 16;
  const id = `w_${gx}_${gy}`;
  mem.knownWalls.set(id, {
    id, x: hx, y: hy,
    wallType: (obj && obj.type) || 'wall',
    lastSeenTime: now,
    confidence: 0.95,
  });
  if (mem.knownWalls.size > 80) {
    let oldestKey = null, oldestTime = Infinity;
    for (const [k, v] of mem.knownWalls) {
      if (v.lastSeenTime < oldestTime) { oldestTime = v.lastSeenTime; oldestKey = k; }
    }
    if (oldestKey) mem.knownWalls.delete(oldestKey);
  }
}

function recordSeenUnit(observer, target, hx, hy, now, halfCovsPassed) {
  if (target.team === observer.team) return;   // 적군만 lastSeenEnemy
  const mem = ensureAIMemory(observer);
  const halfPenalty = halfCovsPassed.length * 0.15;
  // 위험 섹터 — 적이 서 있는 방이 뜨겁다
  if (typeof markRoomDanger === 'function' && typeof roomAt === 'function') {
    const er = roomAt(target.x, target.y);
    if (er) markRoomDanger(observer, er, DANGER_W_ENEMY, now);
  }
  mem.lastSeenEnemy = {
    unitId: target.id,
    x: target.x, y: target.y,
    lastSeenTime: now,
    confidence: Math.max(0.2, 1.0 - halfPenalty),
    behindCoverId: halfCovsPassed.length > 0 ? halfCovsPassed[halfCovsPassed.length - 1].id : null,
    behindCoverType: halfCovsPassed.length > 0 ? 'half' : null,
  };
}

function recordOpenSector(mem, ang, dist, now) {
  if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return;   // analyzeSector가 담당
  const tolerance = 0.20;
  for (const s of mem.openSectors) {
    if (Math.abs(angleDelta(s.angle, ang)) < tolerance) {
      s.angle = ang; s.distance = dist; s.lastCheckedTime = now; s.score = dist;
      return;
    }
  }
  mem.openSectors.push({ angle: ang, distance: dist, lastCheckedTime: now, score: dist });
  while (mem.openSectors.length > 16) mem.openSectors.shift();
}

// 코너 후보 — 벽/cover 모서리 근처
function maybeRecordCorner(mem, obj, hx, hy, incomingAng, now) {
  // 믿음 계층은 면의 확정된 끝(minCorner/maxCorner)으로 모서리를 안다 — 정답 사각형 꼭짓점이 아니라.
  if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return;
  if (!obj || obj.x == null || obj.w == null) return;
  // 모서리 4개 좌표
  const corners = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.w, y: obj.y },
    { x: obj.x, y: obj.y + (obj.h || 0) },
    { x: obj.x + obj.w, y: obj.y + (obj.h || 0) },
  ];
  // 가장 가까운 모서리
  let nearest = corners[0], minD = Infinity;
  for (const c of corners) {
    const d = Math.hypot(c.x - hx, c.y - hy);
    if (d < minD) { minD = d; nearest = c; }
  }
  // 너무 멀면 모서리 아님
  if (minD > Math.max(obj.w, obj.h || 0) * 0.35) return;
  // 비슷한 코너 이미 있는지 확인 (8px 이내)
  for (const c of mem.knownCorners) {
    if (Math.hypot(c.x - nearest.x, c.y - nearest.y) < 8) {
      c.lastSeenTime = now;
      c.confidence = Math.min(1.0, c.confidence + 0.1);
      return;
    }
  }
  mem.knownCorners.push({
    x: nearest.x, y: nearest.y,
    approachAngle: Math.atan2(hx - nearest.x, hy - nearest.y),  // 모서리 → ray 방향
    peekAngle: incomingAng + Math.PI,                            // 반대 방향
    lastSeenTime: now,
    confidence: 0.7,
  });
  while (mem.knownCorners.length > 30) mem.knownCorners.shift();
}

// =============================================================
// 기억된 cover/wall/corner 검증 — 유령 엄폐물 방지
// =============================================================
// 원칙:
//   - "안 보임" vs "없음" 구분 — 중간 장애물에 막히면 확인 불가 (삭제 X)
//   - 기억 위치까지 ray 도달했는데 감지 못 하면 invalidCount++
//   - invalidCount >= 2면 삭제
//   - half cover는 시야 통과로 인정, full cover/wall은 시야 차단

// 단일 항목 검증 — 결과: 'verified' | 'missing' | 'blocked' (확인 불가)
function validateMemoryItem(unit, item, type) {
  const ox = unit.x, oy = unit.y;
  const tx = item.x, ty = item.y;
  const dx = tx - ox, dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 'verified';
  const nx = dx / dist, ny = dy / dist;
  // 항목까지 직접 ray — 도착 전에 다른 장애물에 막히면 blocked
  let curX = ox, curY = oy, traveled = 0, safety = 0;
  const arrivalTolerance = 12;   // 도착 판정 px (cover 폭의 일부)
  while (traveled < dist + arrivalTolerance && safety < 6) {
    safety++;
    const remaining = (dist + arrivalTolerance) - traveled;
    let bestT = remaining;
    let bestHit = null;
    // 벽
    if (typeof rayDistToWalls === 'function') {
      const w = rayDistToWalls(curX, curY, nx, ny, remaining);
      if (w && w.t < bestT) { bestT = w.t; bestHit = { type: 'wall', obj: w.obj }; }
    }
    // cover
    if (MAP_DATA && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
      for (const o of MAP_DATA.coverObjects) {
        const t = rayBoxT(curX, curY, nx, ny, o, bestT);
        if (t < bestT) { bestT = t; bestHit = { type: 'cover', obj: o }; }
      }
    }
    if (!bestHit) {
      // 사거리 끝까지 막힘 없음 — 기억 위치 도달 (검증 통과 시 '있어야 할 무엇'을 못 봄)
      return 'missing';
    }
    const hitX = curX + nx * bestT, hitY = curY + ny * bestT;
    const obj = bestHit.obj;
    // 충돌한 obj가 기억 항목과 같은가?
    let isSameItem = false;
    if (type === 'cover' && bestHit.type === 'cover') {
      const cx = obj.x + (obj.w || 0) / 2, cy = obj.y + (obj.h || 0) / 2;
      if (Math.hypot(cx - tx, cy - ty) < 14) isSameItem = true;
      if (item.id && coverObjectId(obj) === item.id) isSameItem = true;
    } else if (type === 'wall' && bestHit.type === 'wall') {
      // 벽은 hit 위치가 기억 좌표 근처면 통과
      if (Math.hypot(hitX - tx, hitY - ty) < 28) isSameItem = true;
    } else if (type === 'corner') {
      // 코너 — 검증한 위치가 기억 좌표 근처
      if (Math.hypot(hitX - tx, hitY - ty) < 20) isSameItem = true;
    }
    if (isSameItem) return 'verified';
    // half cover면 시야 통과 — 검증 ray 계속 진행
    if (bestHit.type === 'cover' && !isCoverBlocksVision(obj)) {
      let exitT = bestT + 2;
      if (typeof rayBoxExitT === 'function') {
        const ext = rayBoxExitT(curX, curY, nx, ny, obj, remaining);
        if (ext > bestT) exitT = ext + 1;
      }
      traveled += exitT;
      curX = ox + nx * traveled;
      curY = oy + ny * traveled;
      continue;
    }
    // full cover/wall — 다른 장애물에 가려짐 — 확인 불가
    // 단 기억 위치가 충돌 이전(가까운 쪽)이라면 사실상 없는 것
    if (traveled + bestT >= dist - 4) {
      // 충돌 위치가 기억 위치 근처 — 다른 항목일 가능성 → 미감지
      return 'missing';
    }
    return 'blocked';
  }
  return 'blocked';
}

// 검증 결과 반영
function applyValidationResult(mem, item, type, result, now) {
  if (item.invalidCount == null) item.invalidCount = 0;
  if (result === 'verified') {
    item.lastVerifiedAt = now;
    item.invalidCount = 0;
    item.confidence = Math.min(1.0, (item.confidence || 0.5) + 0.05);
    return false;   // 삭제 X
  }
  if (result === 'missing') {
    item.invalidCount++;
    item.confidence = Math.max(0.05, (item.confidence || 0.5) - 0.20);
    if (item.invalidCount >= 2) return true;   // 삭제
  }
  // 'blocked' — 변화 없음
  return false;
}

// AI 검증 tick — 매 스캔 주기 호출
function tickMemoryValidation(unit, mem, now, perScan) {
  if (!mem) return;
  // 공간 인지가 켜져 있으면 기억 반증은 reconcileMemory가 담당한다.
  // 여기 검증은 정답 지오메트리와 대조하는 방식이라 믿음 계층과 싸운다.
  if (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn()) return;
  const items = [];
  // cover 우선 — 현재 seekCover 대상 또는 confidence 낮은 것
  if (mem.knownCovers) {
    for (const c of mem.knownCovers.values()) {
      const age = now - (c.lastVerifiedAt || c.lastSeenTime || 0);
      const priority = age + (1 - (c.confidence || 0.5)) * 30;
      items.push({ type: 'cover', item: c, priority, key: c.id });
    }
  }
  if (mem.knownCorners) {
    for (const c of mem.knownCorners) {
      const age = now - (c.lastVerifiedAt || c.lastSeenTime || 0);
      const priority = age + (1 - (c.confidence || 0.5)) * 20;
      items.push({ type: 'corner', item: c, priority });
    }
  }
  // 현재 seekCover 행동 대상은 최우선
  if (unit.aiAction && unit.aiAction.type === 'seekCover' && unit.aiAction.targetX != null) {
    for (const it of items) {
      const d = Math.hypot(it.item.x - unit.aiAction.targetX, it.item.y - unit.aiAction.targetY);
      if (d < 30) it.priority += 1000;
    }
  }
  items.sort((a, b) => b.priority - a.priority);
  const toCheck = items.slice(0, perScan);
  for (const entry of toCheck) {
    const result = validateMemoryItem(unit, entry.item, entry.type);
    const shouldDelete = applyValidationResult(mem, entry.item, entry.type, result, now);
    if (shouldDelete) {
      if (entry.type === 'cover' && mem.knownCovers && entry.key) {
        mem.knownCovers.delete(entry.key);
        // 현재 seekCover 대상이 사라졌다면 즉시 reassess
        if (unit.aiAction && unit.aiAction.type === 'seekCover' && unit.aiAction.targetX != null) {
          if (Math.hypot(entry.item.x - unit.aiAction.targetX, entry.item.y - unit.aiAction.targetY) < 30) {
            unit.aiAction = null;
            unit.aiIntent = 'reassess';
            unit.aiUtilityNext = now;
          }
        }
      } else if (entry.type === 'corner' && mem.knownCorners) {
        const idx = mem.knownCorners.indexOf(entry.item);
        if (idx >= 0) mem.knownCorners.splice(idx, 1);
      }
    }
  }
}

// 기억 신뢰도 감소
function decayAIMemory(mem, now, decayMul) {
  const mul = decayMul || 1.0;
  // lastSeenEnemy — 빠르게 감소 (확실한 가시 정보일수록 가치 낮음 시간 지나면)
  if (mem.lastSeenEnemy) {
    const age = now - mem.lastSeenEnemy.lastSeenTime;
    if (age > 25 * (1 / mul)) mem.lastSeenEnemy = null;
    else mem.lastSeenEnemy.confidence = Math.max(0.1, 1.0 - age * 0.05 * mul);
  }
  // lastHeardNoise — 중간 속도
  if (mem.lastHeardNoise) {
    const age = now - mem.lastHeardNoise.heardAt;
    if (age > 20 * (1 / mul)) mem.lastHeardNoise = null;
  }
  // dangerPoints — 10~20초
  if (mem.dangerPoints && mem.dangerPoints.length > 0) {
    mem.dangerPoints = mem.dangerPoints.filter(p => (now - p.time) < 15 * (1 / mul));
  }
  // openSectors — 30초 이상 안 본 건 제거
  if (mem.openSectors) {
    mem.openSectors = mem.openSectors.filter(s => (now - s.lastCheckedTime) < 30 * (1 / mul));
  }
  // 총성 danger zone — 18초 후 만료 (gunshot은 비교적 길게 유지)
  if (mem.noiseDangerZones) {
    mem.noiseDangerZones = mem.noiseDangerZones.filter(z => (now - z.time) < 18 * (1 / mul));
  }
  // dangerousEntrances — 25초 만료, 시간이 지나면 dangerLevel 감소
  if (mem.dangerousEntrances) {
    mem.dangerousEntrances = mem.dangerousEntrances.filter(e => (now - e.lastSeenAt) < 25 * (1 / mul));
    for (const e of mem.dangerousEntrances) {
      const age = now - e.lastSeenAt;
      e.dangerLevel = Math.max(0.05, (e.dangerLevel || 0.5) - age * 0.01 * mul);
    }
  }
  if (mem.lastHeardGunshot && (now - mem.lastHeardGunshot.heardAt) > 18 * (1 / mul)) {
    mem.lastHeardGunshot = null;
  }
  if (mem.suspectedEnemyPos && (now - mem.suspectedEnemyPos.time) > 20 * (1 / mul)) {
    mem.suspectedEnemyPos = null;
  }
  // knownCovers — 매우 오래(120초+) 안 본 건 confidence 감소
  for (const c of mem.knownCovers.values()) {
    const age = now - c.lastSeenTime;
    if (age > 60) c.confidence = Math.max(0.2, c.confidence - 0.01 * mul);
  }
  // knownCorners — 비슷
  for (const c of mem.knownCorners) {
    const age = now - c.lastSeenTime;
    if (age > 60) c.confidence = Math.max(0.1, c.confidence - 0.01 * mul);
  }
}

// 메인 — 매 unit tick에서 호출 (스캔 주기 도달 시만 실제 스캔)
// === Sweep scan 중심 방향 결정 — 상태별 우선순위 ===
//   1) visibleEnemy / current target
//   2) lastSeenEnemy (최근 5초)
//   3) lastHeardGunshot (최근 10초)
//   4) lastGrenadeEvent.suspectedDir (grenadeSourceWatchTimer 동안)
//   5) dangerousEntrance (가장 confidence 높은 것)
//   6) preferredWatchAngle
//   7) unit.facing fallback
function getScanCenter(unit, mem) {
  // SIDE-AI-SCAN-FACING-FIX: 스캔 레이는 항상 유닛이 실제로 바라보는 방향(unit.facing)을 중심으로 발사한다.
  //   → 스캔 부채꼴과 facing 선이 언제나 동일 방향(서로 어긋나지 않음).
  //   능동 감시 방향(visibleEnemy / lastSeen / 위험 출입구 / 선호 감시각 등)은 desiredFacing 로직이
  //   본체(unit.facing)를 그쪽으로 회전시키고, 스캔이 그 facing을 따라간다 (단일 진실원: facing).
  return { angle: unit.facing || 0, source: 'facing' };
}
function _getScanCenter_legacy(unit, mem) {
  const now = GAME.gameTime || 0;
  // 1) visible target
  if (unit.currentTarget && unit.currentTarget.alive && !unit.currentTarget.isDead) {
    return {
      angle: Math.atan2(unit.currentTarget.y - unit.y, unit.currentTarget.x - unit.x),
      source: 'visibleEnemy',
    };
  }
  // 2) lastSeenEnemy
  if (mem.lastSeenEnemy && (now - mem.lastSeenEnemy.lastSeenTime) < 5) {
    return {
      angle: Math.atan2(mem.lastSeenEnemy.y - unit.y, mem.lastSeenEnemy.x - unit.x),
      source: 'lastSeenEnemy',
    };
  }
  // 3) lastHeardGunshot
  if (mem.lastHeardGunshot && (now - mem.lastHeardGunshot.heardAt) < 10) {
    return {
      angle: Math.atan2(mem.lastHeardGunshot.y - unit.y, mem.lastHeardGunshot.x - unit.x),
      source: 'lastHeardGunshot',
    };
  }
  // 4) grenade event watch
  if (unit.grenadeSourceWatchTimer > 0 && unit.lastGrenadeEvent && unit.lastGrenadeEvent.suspectedDir != null) {
    return {
      angle: unit.lastGrenadeEvent.suspectedDir,
      source: 'grenadeSource',
    };
  }
  // 5) dangerousEntrance — 가장 dangerLevel 높은 것
  if (mem.dangerousEntrances && mem.dangerousEntrances.length > 0) {
    let best = null;
    for (const de of mem.dangerousEntrances) {
      if (!best || (de.dangerLevel || 0) > (best.dangerLevel || 0)) best = de;
    }
    if (best) {
      return {
        angle: Math.atan2(best.y - unit.y, best.x - unit.x),
        source: 'dangerousEntrance',
      };
    }
  }
  // 6) preferredWatchAngle
  if (mem.preferredWatchAngle != null) {
    return { angle: mem.preferredWatchAngle, source: 'preferredWatchAngle' };
  }
  // 7) facing fallback
  return { angle: unit.facing || 0, source: 'facing' };
}

function tickAIScan(unit, dt) {
  if (unit && unit.alive) updateUnitCurrentRegion(unit);
  if (unit && unit.alive) updateUnitCurrentRoom(unit);
  if (!unit.alive || unit.isDead || unit.isDowned) return;
  const mem = ensureAIMemory(unit);
  const now = GAME.gameTime || 0;
  const prof = getScanProfile(unit);
  mem.scanInterval = prof.scanInterval;
  decayAIMemory(mem, now, prof.memoryDecayMul);

  // === 2-pass Initial Burst Scan 처리 ===
  if (unit._initialBurst) {
    tickInitialBurstScan(unit, mem, now, prof);
    // burst pass1 진행 중이면 sweep scan skip (중복 ray 방지)
    if (unit._initialBurst && unit._initialBurst.phase !== 'complete') return;
  }

  // 스캔 주기 도달?
  if (now - mem.lastScanTime < mem.scanInterval) return;
  mem.lastScanTime = now;

  // === scan center 결정 ===
  const center = getScanCenter(unit, mem);
  mem._lastScanCenter = center;

  // === scanOffset / scanPhase 누적 — ray 사이 틈 메우기 ===
  if (mem.scanOffset == null) mem.scanOffset = 0;
  if (mem.scanPhase == null) mem.scanPhase = 0;
  const fov = prof.halfAng * 2;
  const raySpacing = fov / Math.max(1, prof.rayCount - 1);
  const offsetStep = raySpacing * (prof.offsetStepMul || 0.25);
  mem.scanOffset += offsetStep;
  if (mem.scanOffset >= raySpacing) mem.scanOffset -= raySpacing;
  mem.scanPhase = (mem.scanPhase + 1) % 1000;

  // 스캔 — center 기준 전방 부채꼴 N개 ray (scanOffset 적용)
  const sightPx = (unit.sightRange || (15 * PX_PER_M_FALLBACK));
  const baseAng = center.angle;
  for (let i = 0; i < prof.rayCount; i++) {
    const t = (prof.rayCount === 1) ? 0 : ((i / (prof.rayCount - 1)) - 0.5);
    const ang = baseAng + t * 2 * prof.halfAng + mem.scanOffset;
    castScanRay(unit, unit.x, unit.y, ang, sightPx, now, mem, 'sweep');
  }
  if (typeof tickMemoryValidation === 'function') {
    tickMemoryValidation(unit, mem, now, prof.validatePerScan || 1);
  }
}

// === 2-pass Initial Burst Scan ===
//   phase: 'pass1' → 'waitingPass2' → 'pass2' → 'complete'
//   1차: 64 ray 360도, offset=0
//   2차: 64 ray 360도, offset=raySpacing/2 (반 칸 밀어 누락된 방향 보완)
const BURST_RAY_COUNT = 64;
const BURST_PASS2_DELAY = 0.10;   // 1차 → 2차 사이 100ms

function tickInitialBurstScan(unit, mem, now, prof) {
  const b = unit._initialBurst;
  if (!b) return;
  const sightPx = (unit.sightRange || (15 * PX_PER_M_FALLBACK));
  if (b.phase === 'pass1') {
    const raySpacing = (Math.PI * 2) / BURST_RAY_COUNT;
    const distances = new Array(BURST_RAY_COUNT).fill(0);
    for (let i = 0; i < BURST_RAY_COUNT; i++) {
      const ang = i * raySpacing;
      castScanRay(unit, b.originX, b.originY, ang, sightPx, now, mem, 'initialBurstPass1');
      distances[i] = measureBlockerDistance(b.originX, b.originY, ang, sightPx);
    }
    b._pass1Distances = distances;
    // === pass1 결과로 임시 경계 방향 설정 (pass2 끝나면 보정) ===
    if (typeof detectEntrancesFromProfile === 'function') {
      const tempEntrances = detectEntrancesFromProfile(distances);
      mem._initialEntrances = tempEntrances;
      mem._initialDistances = distances;
      pickWatchDirection(unit);   // 임시 — pass2 후 다시 호출됨
    }
    b.phase = 'waitingPass2';
    b.startedAt = now;
    return;
  }
  if (b.phase === 'waitingPass2') {
    if ((now - b.startedAt) < BURST_PASS2_DELAY) return;
    const moved = Math.hypot(unit.x - b.originX, unit.y - b.originY);
    if (moved > 12) {
      unit._initialBurst = null;
      unit._initialScanDone = true;
      // pass1 결과는 이미 pickWatchDirection으로 사용됨
      return;
    }
    b.phase = 'pass2';
    return;
  }
  if (b.phase === 'pass2') {
    const raySpacing = (Math.PI * 2) / BURST_RAY_COUNT;
    const halfStep = raySpacing / 2;
    const distances = new Array(BURST_RAY_COUNT).fill(0);
    for (let i = 0; i < BURST_RAY_COUNT; i++) {
      const ang = i * raySpacing + halfStep;
      castScanRay(unit, b.originX, b.originY, ang, sightPx, now, mem, 'initialBurstPass2');
      distances[i] = measureBlockerDistance(b.originX, b.originY, ang, sightPx);
    }
    // pass1 + pass2 distance를 인터리브해 128 bin
    const merged = new Array(BURST_RAY_COUNT * 2);
    const pass1 = b._pass1Distances || new Array(BURST_RAY_COUNT).fill(0);
    for (let i = 0; i < BURST_RAY_COUNT; i++) {
      merged[i * 2] = pass1[i];
      merged[i * 2 + 1] = distances[i];
    }
    if (typeof detectEntrancesFromProfile === 'function') {
      const entrances = detectEntrancesFromProfile(merged);
      mem._initialEntrances = entrances;
      mem._initialDistances = merged;
    }
    pickWatchDirection(unit);   // 최종 — 128 bin 결과로 보정
    b.phase = 'complete';
    unit._initialScanDone = true;
    return;
  }
}

// 단일 ray의 차단체(벽/full cover)까지 거리만 측정 — half cover 통과 인정
function measureBlockerDistance(ox, oy, ang, maxPx) {
  const nx = Math.cos(ang), ny = Math.sin(ang);
  let curX = ox, curY = oy, traveled = 0, safety = 0;
  while (traveled < maxPx && safety < 4) {
    safety++;
    const remaining = maxPx - traveled;
    let bestT = remaining;
    let bestHit = null;
    if (typeof rayDistToWalls === 'function') {
      const w = rayDistToWalls(curX, curY, nx, ny, remaining);
      if (w && w.t < bestT) { bestT = w.t; bestHit = { type: 'wall', obj: w.obj }; }
    }
    if (MAP_DATA && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
      for (const o of MAP_DATA.coverObjects) {
        const t = rayBoxT(curX, curY, nx, ny, o, bestT);
        if (t < bestT) { bestT = t; bestHit = { type: 'cover', obj: o }; }
      }
    }
    if (!bestHit) return traveled + remaining;   // 막힘 없음 — 사거리 끝
    if (bestHit.type === 'cover') {
      const obj = bestHit.obj;
      // half cover는 시야 통과 — 무시하고 계속
      if (!isCoverBlocksVision(obj)) {
        let exitT = bestT + 2;
        if (typeof rayBoxExitT === 'function') {
          const ext = rayBoxExitT(curX, curY, nx, ny, obj, remaining);
          if (ext > bestT) exitT = ext + 1;
        }
        traveled += exitT;
        curX = ox + nx * traveled;
        curY = oy + ny * traveled;
        continue;
      }
    }
    return traveled + bestT;   // 벽 또는 full cover — 시야 차단
  }
  return traveled;
}

// 360° 거리 프로파일에서 입구 감지
//   입구 = 자신은 길고 양 옆은 짧은 방향 (벽 — 뚫림 — 벽 패턴)
//   양옆 검사는 ±3,4,5 bin 사용 — 입구는 보통 ±1~2 bin 너비
function detectEntrancesFromProfile(distances) {
  const N = distances.length;
  const PX = PX_PER_M_FALLBACK;
  const entrances = [];
  // 사이드 검사 bin offset — N 비례 (64 기준 3,4,5)
  const s1 = Math.max(2, Math.round(N * 3 / 64));
  const s2 = Math.max(3, Math.round(N * 4 / 64));
  const s3 = Math.max(4, Math.round(N * 5 / 64));
  for (let i = 0; i < N; i++) {
    const myDist = distances[i];
    if (myDist < 6 * PX) continue;
    const l1 = distances[(i - s1 + N) % N];
    const l2 = distances[(i - s2 + N) % N];
    const l3 = distances[(i - s3 + N) % N];
    const r1 = distances[(i + s1) % N];
    const r2 = distances[(i + s2) % N];
    const r3 = distances[(i + s3) % N];
    const sideAvg = (l1 + l2 + l3 + r1 + r2 + r3) / 6;
    if (sideAvg >= myDist * 0.6) continue;
    const leftAvg = (l1 + l2 + l3) / 3;
    const rightAvg = (r1 + r2 + r3) / 3;
    if (Math.max(leftAvg, rightAvg) > Math.min(leftAvg, rightAvg) * 2.5) continue;
    const score = myDist * (1 - sideAvg / myDist);
    entrances.push({
      angle: (i / N) * Math.PI * 2,
      distance: myDist,
      sideAvg,
      score,
      binIdx: i,
    });
  }
  // 가까운 bin은 같은 입구 — 클러스터링 (N 비례 — 64 bin 기준 6 bin, 128 bin 기준 12 bin)
  entrances.sort((a, b) => b.score - a.score);
  const clustered = [];
  const clusterBins = Math.max(3, Math.round(N * 6 / 64));
  for (const e of entrances) {
    let dup = false;
    for (const c of clustered) {
      const binDiff = Math.min(
        Math.abs(c.binIdx - e.binIdx),
        N - Math.abs(c.binIdx - e.binIdx),
      );
      if (binDiff <= clusterBins) { dup = true; break; }
    }
    if (!dup) clustered.push(e);
  }
  return clustered;
}

// =============================================================
// 초기 360° 스캔 — 유닛 생성 직후 1회 호출
// =============================================================
//   1) 360도 32개 ray로 메모리 빠르게 채움
//   2) 사각지대(가장 긴 openSector 또는 통로) 분석
//   3) preferredWatchAngle 설정 → 천천히 그 방향 회전

function performInitialAIScan(unit) {
  if (!unit || !unit.alive || unit.isDead) return;
  ensureAIMemory(unit);
  // 2-pass burst 시작 — 실제 ray cast는 tickInitialBurstScan에서 단계별로 진행
  unit._initialBurst = {
    phase: 'pass1',
    originX: unit.x,
    originY: unit.y,
    startedAt: GAME.gameTime || 0,
  };
  // pass1을 즉시 한 번 진행 — 첫 frame에 1차 360 ray 완료
  const mem = unit.aiMemory;
  const now = GAME.gameTime || 0;
  const prof = getScanProfile(unit);
  tickInitialBurstScan(unit, mem, now, prof);
}

// =============================================================
// 위험구역 (gunshot dangerZone) + 코너 타입 분류
// =============================================================

// === Local Area Scan — 16 방향 raycast로 공간 형태 인식 ===
// areaType: 'roomInterior' | 'corridor' | 'doorway' | 'deadEnd' | 'openArea'
const AREA_CACHE = new Map();   // key '<gx>_<gy>' → { info, computedAt }
const AREA_CACHE_TTL = 5.0;     // 초 — 캐시 유효 시간
const AREA_CACHE_CELL_PX = 32;  // 같은 셀이면 재사용
let _areaCacheLastClean = 0;

function clearAreaCache() {
  AREA_CACHE.clear();
}

function getAreaInfo(x, y, forceRecalc) {
  const gx = Math.floor(x / AREA_CACHE_CELL_PX);
  const gy = Math.floor(y / AREA_CACHE_CELL_PX);
  const key = gx + '_' + gy;
  const now = GAME.gameTime || 0;
  if (!forceRecalc) {
    const cached = AREA_CACHE.get(key);
    if (cached && (now - cached.computedAt) < AREA_CACHE_TTL) return cached.info;
  }
  // 캐시 청소 (매 10초)
  if (now - _areaCacheLastClean > 10) {
    _areaCacheLastClean = now;
    for (const [k, v] of AREA_CACHE) {
      if (now - v.computedAt > AREA_CACHE_TTL * 2) AREA_CACHE.delete(k);
    }
  }
  const info = computeAreaInfo(x, y);
  AREA_CACHE.set(key, { info, computedAt: now });
  return info;
}

function computeAreaInfo(x, y) {
  const N = 16;
  const maxPx = 10 * PX_PER_M_FALLBACK;   // 최대 10m 검사
  const distances = new Array(N);
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    distances[i] = (typeof measureBlockerDistance === 'function')
      ? measureBlockerDistance(x, y, ang, maxPx) : maxPx;
  }
  // 통계
  let sum = 0, mn = Infinity, mx = 0, openCount = 0, longOpenCount = 0;
  const ROOM_INTERIOR_PX = 4.5 * PX_PER_M_FALLBACK;
  const LONG_OPEN_PX = 7 * PX_PER_M_FALLBACK;
  for (const d of distances) {
    sum += d;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
    if (d > ROOM_INTERIOR_PX) openCount++;
    if (d > LONG_OPEN_PX) longOpenCount++;
  }
  const avg = sum / N;
  // possibleEntrance 감지 — 좁은 클러스터로 길게 열린 방향
  //   인접 ray들은 짧고, 특정 1~3 ray만 길게 열림
  const entrances = [];
  for (let i = 0; i < N; i++) {
    const me = distances[i];
    if (me < 5 * PX_PER_M_FALLBACK) continue;
    // 좌우 2 bin 평균
    const l1 = distances[(i - 1 + N) % N];
    const l2 = distances[(i - 2 + N) % N];
    const r1 = distances[(i + 1) % N];
    const r2 = distances[(i + 2) % N];
    const sideAvg = (l1 + l2 + r1 + r2) / 4;
    // 양옆이 짧음 → 좁은 통로 (입구)
    if (sideAvg < me * 0.55 && sideAvg < ROOM_INTERIOR_PX) {
      const ang = (i / N) * Math.PI * 2;
      entrances.push({
        angle: ang,
        x: x + Math.cos(ang) * me * 0.7,
        y: y + Math.sin(ang) * me * 0.7,
        distance: me,
        sideAvg,
        widthEstimate: sideAvg,
      });
    }
  }
  // areaType 판정 — 순서 중요 (특수한 케이스 먼저)
  let areaType;
  if (entrances.length >= 1 && avg < ROOM_INTERIOR_PX) areaType = 'doorway';
  else if (avg < 2.5 * PX_PER_M_FALLBACK && openCount === 0) areaType = 'deadEnd';
  else if (avg < ROOM_INTERIOR_PX && openCount <= 6) areaType = 'roomInterior';
  else if (longOpenCount >= 12) areaType = 'openArea';
  else if (longOpenCount >= 4 && entrances.length === 0) areaType = 'corridor';
  else if (longOpenCount >= 8) areaType = 'openArea';
  else areaType = 'roomInterior';
  return {
    centerX: x, centerY: y,
    distances,
    avgWallDist: avg,
    minWallDist: mn,
    maxOpenDist: mx,
    openCount, longOpenCount,
    possibleEntrances: entrances,
    areaType,
  };
}

// 두 점이 같은 area에 속하는가? — 단순 휴리스틱
//   LOS 통과 + areaType 비슷 + 거리 적당
function isInSameArea(x1, y1, x2, y2) {
  // [AI0-B R1] 유효한 Spatial Graph가 있으면 region ID가 최우선 권위다.
  //   같은 region이면 거리/legacy areaType과 무관하게 같은 공간이고, 다른 region이면 다른 공간이다.
  //   graph가 없거나 좌표가 graph 범위 밖일 때만 아래 legacy heuristic으로 내려간다.
  try {
    const _g = (typeof ensureTacticalSpatialGraph === 'function') ? ensureTacticalSpatialGraph() : null;
    if (_g && _g.spec) {
      const _c1x = _g.spec.rawCellX(x1), _c1y = _g.spec.rawCellY(y1);
      const _c2x = _g.spec.rawCellX(x2), _c2y = _g.spec.rawCellY(y2);
      if (_g.spec.inBounds(_c1x, _c1y) && _g.spec.inBounds(_c2x, _c2y)) {
        const _r1 = getSpatialRegionAt(x1, y1, _g), _r2 = getSpatialRegionAt(x2, y2, _g);
        if (_r1 && _r2) return _r1.id === _r2.id;
      }
    }
  } catch (e) { /* fallback to legacy */ }
  // LOS 막힘이면 다른 area
  if (typeof isLOSBlockedForBlast === 'function' && isLOSBlockedForBlast(x1, y1, x2, y2)) return false;
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d > 12 * PX_PER_M_FALLBACK) return false;
  const a1 = getAreaInfo(x1, y1);
  const a2 = getAreaInfo(x2, y2);
  // 둘 다 roomInterior — 평균 벽 거리가 비슷하면 같은 방
  if (a1.areaType === a2.areaType) return true;
  // 한쪽이 corridor, 다른쪽이 roomInterior — 다른 area
  if ((a1.areaType === 'corridor' && a2.areaType === 'roomInterior')
      || (a2.areaType === 'corridor' && a1.areaType === 'roomInterior')) return false;
  return true;
}

// 입구 너머로 진입해야 하는가? (단위 → target)
function isAcrossEntrance(unit, tx, ty) {
  const mem = unit.aiMemory;
  if (!mem || !mem.dangerousEntrances || mem.dangerousEntrances.length === 0) return false;
  const dxT = tx - unit.x, dyT = ty - unit.y;
  const dT = Math.hypot(dxT, dyT);
  if (dT < 10) return false;
  for (const e of mem.dangerousEntrances) {
    // 입구 방향과 target 방향이 비슷하고, 입구가 unit~target 사이에 있으면 입구 통과
    const eAngFromUnit = Math.atan2(e.y - unit.y, e.x - unit.x);
    const tAng = Math.atan2(dyT, dxT);
    if (Math.abs(angleDelta(eAngFromUnit, tAng)) > Math.PI / 4) continue;
    const eDist = Math.hypot(e.x - unit.x, e.y - unit.y);
    if (eDist < dT) return true;   // 입구가 target보다 가까움 → 입구 통과
  }
  return false;
}

// =============================================================
// coverState raycast — 위협 방향 기준 실제 엄폐 여부 판단
// =============================================================
//   "엄폐물 근처에 있음" ≠ "엄폐 중". threat 방향 사이에 실제 차폐물이 있는지가 핵심.
//   결과 coverType: 'none' | 'partialCover' | 'fullCover' | 'wallBlocked'

const COVER_NEAR_PX = 1.5 * 32;   // PX_PER_M_FALLBACK 대신 상수 (32 = px/m)
function _coverNearPx() { return 1.5 * PX_PER_M_FALLBACK; }

function computeCoverState(unit, threatX, threatY) {
  if (!GAME.aiProfileOn) return _computeCoverStateImpl(unit, threatX, threatY);
  _aiProfCall('computeCoverState');
  const _t0 = _aiProfNow();
  try { return _computeCoverStateImpl(unit, threatX, threatY); }
  finally { _aiProfRecord('computeCoverState', _aiProfNow() - _t0); }
}
function _computeCoverStateImpl(unit, threatX, threatY) {
  // threat 위치 없으면 noiseDangerZone / preferredWatchAngle / facing fallback
  if (threatX == null || threatY == null) {
    const mem = unit.aiMemory || {};
    if (mem.lastHeardGunshot) { threatX = mem.lastHeardGunshot.x; threatY = mem.lastHeardGunshot.y; }
    else if (mem.lastSeenEnemy) { threatX = mem.lastSeenEnemy.x; threatY = mem.lastSeenEnemy.y; }
    else if (mem.preferredWatchAngle != null) {
      const D = 200;
      threatX = unit.x + Math.cos(mem.preferredWatchAngle) * D;
      threatY = unit.y + Math.sin(mem.preferredWatchAngle) * D;
    } else {
      return {
        inCover: false, coverType: 'none', coverQuality: 0,
        coverObjectId: null, coverDistance: Infinity,
        threatAngle: unit.facing || 0,
        exposedToThreat: false, canReturnFire: true,
        enemyBehindCover: false, enemyBehindPartialCover: false, enemyBehindFullCover: false,
        enemyCoverObjectId: null,
      };
    }
  }
  const dx = threatX - unit.x, dy = threatY - unit.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return {
      inCover: false, coverType: 'none', coverQuality: 0,
      coverObjectId: null, coverDistance: Infinity,
      threatAngle: unit.facing || 0,
      exposedToThreat: false, canReturnFire: true,
      enemyBehindCover: false, enemyBehindPartialCover: false, enemyBehindFullCover: false,
      enemyCoverObjectId: null,
    };
  }
  const nx = dx / dist, ny = dy / dist;
  const NEAR_PX = _coverNearPx();
  // === observer가 prone이고 halfCover에 붙어 있으면 — 시야 완전 차단 (fullCoverLike) ===
  //   "엎드린 상태로 반높이 엄폐물에 붙어서 너머 감시/사격" 금지
  const observerStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(unit) : (unit.stance || 'standing');
  const isObserverProne = (observerStance === 'prone' || observerStance === 'goingProne');
  // raycast — unit → threat 경로의 차폐물 (wall, fullCover, halfCover)
  let firstFullT = Infinity, firstFullObj = null, firstFullKind = null;
  let firstHalfT = Infinity, firstHalfObj = null;
  // 벽
  if (typeof rayDistToWalls === 'function') {
    const w = rayDistToWalls(unit.x, unit.y, nx, ny, dist);
    if (w && w.t < dist) { firstFullT = w.t; firstFullObj = w.obj; firstFullKind = 'wallBlocked'; }
  }
  // cover
  if (MAP_DATA && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
    for (const o of MAP_DATA.coverObjects) {
      const t = rayBoxT(unit.x, unit.y, nx, ny, o, dist);
      if (t >= dist) continue;
      if (isCoverBlocksVision(o)) {
        if (t < firstFullT) { firstFullT = t; firstFullObj = o; firstFullKind = 'fullCover'; }
      } else {
        if (t < firstHalfT) { firstHalfT = t; firstHalfObj = o; }
      }
    }
  }

  const threatAng = Math.atan2(dy, dx);

  // === 본인 엄폐 판단 ===
  // 1) wall/fullCover가 본인 근처에 있음 → 완전 엄폐
  if (firstFullT < NEAR_PX) {
    return {
      inCover: true,
      coverType: firstFullKind,                              // 'wallBlocked' or 'fullCover'
      coverQuality: 1.0,
      coverObjectId: firstFullObj ? (firstFullObj.id || (typeof coverObjectId === 'function' ? coverObjectId(firstFullObj) : null)) : null,
      coverDistance: firstFullT,
      threatAngle: threatAng,
      exposedToThreat: false,
      canReturnFire: false,   // 완전 엄폐 → 사격하려면 위치 조정 필요
      enemyBehindCover: false, enemyBehindPartialCover: false, enemyBehindFullCover: false,
      enemyCoverObjectId: null,
    };
  }
  // 2) halfCover가 본인 근처에 있음 → 부분 엄폐
  //    하지만 observer가 prone이면 → fullCoverLike (시야 완전 차단)
  if (firstHalfT < NEAR_PX && firstHalfT < firstFullT) {
    if (isObserverProne) {
      // prone observer + 붙어있는 halfCover → fullCoverLike
      return {
        inCover: true,
        coverType: 'fullCoverLike',
        coverQuality: 0.95,
        coverObjectId: (typeof coverObjectId === 'function') ? coverObjectId(firstHalfObj) : null,
        coverDistance: firstHalfT,
        threatAngle: threatAng,
        exposedToThreat: false,
        canReturnFire: false,
        observerProneBlockedByHalfCover: true,
        enemyBehindCover: false, enemyBehindPartialCover: false, enemyBehindFullCover: false,
        enemyCoverObjectId: null,
      };
    }
    return {
      inCover: true,
      coverType: 'partialCover',
      coverQuality: 0.55,
      coverObjectId: (typeof coverObjectId === 'function') ? coverObjectId(firstHalfObj) : null,
      coverDistance: firstHalfT,
      threatAngle: threatAng,
      exposedToThreat: false,
      canReturnFire: true,
      enemyBehindCover: false, enemyBehindPartialCover: false, enemyBehindFullCover: false,
      enemyCoverObjectId: null,
    };
  }

  // === 적 엄폐 판단 ===
  // wall/fullCover가 적 근처 (threat에서 NEAR_PX 이내) → enemyBehindFullCover
  if (firstFullT > dist - NEAR_PX && firstFullT < dist) {
    return {
      inCover: false,
      coverType: 'none',
      coverQuality: 0,
      coverObjectId: null,
      coverDistance: Infinity,
      threatAngle: threatAng,
      exposedToThreat: true,
      canReturnFire: true,
      enemyBehindCover: true,
      enemyBehindFullCover: true,
      enemyBehindPartialCover: false,
      enemyCoverObjectId: firstFullObj ? (firstFullObj.id || (typeof coverObjectId === 'function' ? coverObjectId(firstFullObj) : null)) : null,
    };
  }
  // halfCover가 적 근처 → enemyBehindPartialCover
  if (firstHalfT > dist - NEAR_PX && firstHalfT < dist) {
    return {
      inCover: false,
      coverType: 'none',
      coverQuality: 0,
      coverObjectId: null,
      coverDistance: Infinity,
      threatAngle: threatAng,
      exposedToThreat: true,
      canReturnFire: true,
      enemyBehindCover: true,
      enemyBehindPartialCover: true,
      enemyBehindFullCover: false,
      enemyCoverObjectId: (typeof coverObjectId === 'function') ? coverObjectId(firstHalfObj) : null,
    };
  }

  // wall/fullCover가 사이 중간에 있음 → LOS 차단 (서로 못 봄)
  if (firstFullT < dist) {
    return {
      inCover: true,
      coverType: firstFullKind,
      coverQuality: 0.9,
      coverObjectId: firstFullObj ? (firstFullObj.id || (typeof coverObjectId === 'function' ? coverObjectId(firstFullObj) : null)) : null,
      coverDistance: firstFullT,
      threatAngle: threatAng,
      exposedToThreat: false,
      canReturnFire: false,
      enemyBehindCover: false,
      enemyBehindFullCover: false,
      enemyBehindPartialCover: false,
      enemyCoverObjectId: null,
    };
  }
  // halfCover만 사이 중간에 있음 → 둘 다 약간 보호 (partial)
  if (firstHalfT < dist) {
    return {
      inCover: true,
      coverType: 'partialCover',
      coverQuality: 0.35,
      coverObjectId: (typeof coverObjectId === 'function') ? coverObjectId(firstHalfObj) : null,
      coverDistance: firstHalfT,
      threatAngle: threatAng,
      exposedToThreat: true,    // 시야 통과 — 여전히 보임
      canReturnFire: true,
      enemyBehindCover: false,
      enemyBehindPartialCover: false,
      enemyBehindFullCover: false,
      enemyCoverObjectId: null,
    };
  }

  // 그 외 — 완전 노출
  return {
    inCover: false,
    coverType: 'none',
    coverQuality: 0,
    coverObjectId: null,
    coverDistance: Infinity,
    threatAngle: threatAng,
    exposedToThreat: true,
    canReturnFire: true,
    enemyBehindCover: false,
    enemyBehindFullCover: false,
    enemyBehindPartialCover: false,
    enemyCoverObjectId: null,
  };
}

// =============================================================
// 통합 이동/엄폐 목표 검증
// =============================================================
//   3단계: 1) 물리 검증 (강제 reject) 2) 위험 검증 (자율 reject) 3) 전술 점수
//
//   validateMoveTarget — 모든 자율 AI 이동 목표 전에 호출 필수
//   options:
//     allowDanger:    true면 위험 검증 skip (플레이어 명령 / assault 행동)
//     allowGrenade:   true면 grenade dangerPoint skip
//     allowEnemyArea: true면 적과 같은 area 허용

function validateMoveTarget(unit, x, y, opts) {
  opts = opts || {};
  // === 1) 물리 검증 — 무조건 reject ===
  if (typeof MAP_DATA !== 'undefined' && MAP_DATA.w != null) {
    if (x < 8 || y < 8 || x > MAP_DATA.w - 8 || y > MAP_DATA.h - 8) {
      return { valid: false, physicalInvalid: true, outsideMap: true, reason: 'outsideMap' };
    }
  }
  if (typeof pointInWalls === 'function' && pointInWalls(x, y, UNIT_RADIUS - 2)) {
    return { valid: false, physicalInvalid: true, insideObstacle: true, insideWall: true, reason: 'insideWall' };
  }
  if (typeof isPointBlocked === 'function' && isPointBlocked(x, y)) {
    return { valid: false, physicalInvalid: true, insideObstacle: true, insideCover: true, reason: 'insideCover' };
  }
  // === 2) 위험 검증 — 자율 행동에서 reject ===
  if (!opts.allowGrenade && unit.aiMemory && Array.isArray(unit.aiMemory.dangerPoints)) {
    for (const dp of unit.aiMemory.dangerPoints) {
      if (Math.hypot(dp.x - x, dp.y - y) < 4 * PX_PER_M_FALLBACK) {
        return { valid: false, tacticalInvalid: true, insideGrenadeDanger: true, reason: 'insideGrenadeDanger' };
      }
    }
  }
  if (!opts.allowDanger) {
    if (typeof isInGunshotDangerZone === 'function' && isInGunshotDangerZone(unit, x, y)) {
      return { valid: false, tacticalInvalid: true, insideGunshotDanger: true, reason: 'insideGunshotDanger' };
    }
    if (typeof isAcrossEntrance === 'function' && isAcrossEntrance(unit, x, y)) {
      return { valid: false, tacticalInvalid: true, beyondDangerousEntrance: true, reason: 'beyondDangerousEntrance' };
    }
    if (!opts.allowEnemyArea) {
      const mem = unit.aiMemory;
      if (mem && mem.lastSeenEnemy && typeof isInSameArea === 'function'
          && isInSameArea(x, y, mem.lastSeenEnemy.x, mem.lastSeenEnemy.y)) {
        return { valid: false, tacticalInvalid: true, sameAreaAsEnemy: true, reason: 'sameAreaAsEnemy' };
      }
      if (mem && mem.lastHeardGunshot && typeof isInSameArea === 'function'
          && isInSameArea(x, y, mem.lastHeardGunshot.x, mem.lastHeardGunshot.y)) {
        return { valid: false, tacticalInvalid: true, sameAreaAsGunshot: true, reason: 'sameAreaAsGunshot' };
      }
    }
  }
  return { valid: true };
}

// cover slot 전용 — slot이 invalid면 cover 바깥쪽 normal 방향으로 2~4회 nudge
//   성공: 새 좌표 반환, 실패: null
function nudgeSlotOutOfObstacle(slot, threatPos, unit) {
  // threat 반대 방향이 cover 바깥쪽
  const dxN = slot.x - threatPos.x, dyN = slot.y - threatPos.y;
  const len = Math.hypot(dxN, dyN);
  if (len < 0.01) return null;
  const nx = dxN / len, ny = dyN / len;
  for (let i = 1; i <= 4; i++) {
    const tx = slot.x + nx * 5 * i;
    const ty = slot.y + ny * 5 * i;
    // 맵 밖이면 폐기 (clamp 금지)
    if (typeof MAP_DATA !== 'undefined' && MAP_DATA.w != null) {
      if (tx < 8 || ty < 8 || tx > MAP_DATA.w - 8 || ty > MAP_DATA.h - 8) return null;
    }
    if (typeof pointInWalls === 'function' && pointInWalls(tx, ty, UNIT_RADIUS - 2)) continue;
    if (typeof isPointBlocked === 'function' && isPointBlocked(tx, ty)) continue;
    return { x: tx, y: ty, nudgeStep: i };
  }
  return null;
}

// 점이 unit의 gunshot dangerZone 안에 있는가?
function isInGunshotDangerZone(unit, x, y) {
  const mem = unit.aiMemory;
  if (!mem || !mem.noiseDangerZones) return false;
  for (const z of mem.noiseDangerZones) {
    if (Math.hypot(z.x - x, z.y - y) < z.radius) return true;
  }
  return false;
}

// 두 점이 LOS 없이 분리되어 있고 가까우면 "같은 방"으로 간주 (단순 휴리스틱)
function isLikelySameRoom(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d > 10 * PX_PER_M_FALLBACK) return false;   // 10m 이상은 다른 방으로 가정
  if (typeof isLOSBlockedForBlast === 'function') {
    return !isLOSBlockedForBlast(x1, y1, x2, y2);   // LOS 통과면 같은 방
  }
  return d < 6 * PX_PER_M_FALLBACK;
}

// 코너 타입 분류 — 주변 8 방향 raycast로 개방 정도 + LOS 검사
//   tacticalCorner: 2~3 방향 개방 (피킹/각잡기 좋음)
//   roomCorner:     1 방향 개방 (방 안쪽 구석)
//   deadEndCorner:  0 방향 개방
//   coverCorner:    cover 끝 (cover 객체 기반)
function classifyCorner(corner, x, y) {
  if (corner._classifiedType && (corner._classifiedAt || 0) > 0
      && (GAME.gameTime - corner._classifiedAt) < 8.0) {
    return corner._classifiedType;
  }
  // 8 방향 5m ray 발사 — 5m 이상 막힘 없는 방향 카운트
  const checkPx = 5 * PX_PER_M_FALLBACK;
  let openCount = 0;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    let blocked = false;
    if (typeof rayDistToWalls === 'function') {
      const w = rayDistToWalls(x, y, nx, ny, checkPx);
      if (w && w.t < checkPx * 0.7) blocked = true;
    }
    if (!blocked && MAP_DATA && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
      for (const o of MAP_DATA.coverObjects) {
        const t = rayBoxT(x, y, nx, ny, o, checkPx * 0.7);
        if (t < checkPx * 0.7 && isCoverBlocksVision(o)) { blocked = true; break; }
      }
    }
    if (!blocked) openCount++;
  }
  let type;
  if (openCount === 0)      type = 'deadEndCorner';
  else if (openCount <= 1)  type = 'roomCorner';
  else if (openCount <= 3)  type = 'tacticalCorner';
  else                       type = 'unknownCorner';   // 너무 개방되어 코너 의미 약함
  corner._classifiedType = type;
  corner._classifiedAt = GAME.gameTime || 0;
  return type;
}

// =============================================================
// 경계 방향 결정
// =============================================================
// 가장 위험한 방향 선정 — 입구 우선 + 사각지대
function pickWatchDirection(unit) {
  const mem = unit.aiMemory;
  if (!mem) return;

  // 1순위: 입구 (벽 사이 뚫린 통로)
  const entrances = mem._initialEntrances || [];
  let candidates = [];
  for (const e of entrances) {
    let score = e.score;
    // 다른 아군이 이미 비슷한 방향을 보고 있으면 감점
    if (Array.isArray(UNITS)) {
      for (const u of UNITS) {
        if (u === unit || u.team !== unit.team || u.isDead) continue;
        if (Math.abs(angleDelta(u.facing || 0, e.angle)) < Math.PI / 4) score *= 0.55;
      }
    }
    candidates.push({ angle: e.angle, score, type: 'entrance', distance: e.distance });
  }

  // 2순위: openSector (입구가 안 잡혔을 때 fallback)
  if (candidates.length === 0 && mem.openSectors) {
    for (const s of mem.openSectors) {
      if (s.distance < 5 * PX_PER_M_FALLBACK) continue;
      let score = s.distance * 0.5;
      if (Array.isArray(UNITS)) {
        for (const u of UNITS) {
          if (u === unit || u.team !== unit.team || u.isDead) continue;
          if (Math.abs(angleDelta(u.facing || 0, s.angle)) < Math.PI / 4) score *= 0.6;
        }
      }
      candidates.push({ angle: s.angle, score, type: 'open', distance: s.distance });
    }
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  mem.preferredWatchAngle = best.angle;
  // 적 유닛은 즉시 입구 방향으로 facing 설정 + homeFacing도 갱신
  //   (homeFacing 갱신: idle 복귀 시 spawn 방향이 아닌 입구 방향으로 돌아감)
  if (unit.team === 'enemy') {
    unit.facing = best.angle;
    unit.homeFacing = best.angle;
    unit._watchRotateActive = false;
  } else {
    unit._watchRotateActive = false;
  }
  const kor = best.type === 'entrance' ? '입구' : '사각지대';
  if (unit.team === 'enemy') {
    log(`[${unit.name}] 경계: ${kor} ${(best.distance / PX_PER_M_FALLBACK).toFixed(1)}m 방향`, 'info');
  }
}

// 천천히 preferredWatchAngle 방향으로 회전 — idle/passive 상태일 때만
function tickWatchRotation(unit, dt) {
  if (!unit._watchRotateActive) return;
  // 이동/사격 중이면 중단
  if (unit.movePath && unit.movePath.length > 0) { unit._watchRotateActive = false; return; }
  if (unit.shotQueue) { unit._watchRotateActive = false; return; }
  if (unit.isDowned || unit.isDead) { unit._watchRotateActive = false; return; }
  // 교전 상태면 자체 facing 우선
  if (unit.aiState === 'engage' || unit.aiState === 'suppressed' || unit.aiState === 'contact') {
    unit._watchRotateActive = false; return;
  }
  const mem = unit.aiMemory;
  if (!mem || mem.preferredWatchAngle == null) { unit._watchRotateActive = false; return; }
  const dest = mem.preferredWatchAngle;
  let diff = dest - (unit.facing || 0);
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const ROT_SPEED = 1.8;   // rad/s
  const step = Math.sign(diff) * Math.min(Math.abs(diff), ROT_SPEED * dt);
  unit.facing = (unit.facing || 0) + step;
  if (Math.abs(diff) < 0.05) {
    unit.facing = dest;
    unit._watchRotateActive = false;
  }
}

// EXECUTE 진입 시 1회 호출 — 모든 유닛에 초기 스캔, 적만 자동 회전 활성
function performAllInitialScans() {
  const list = (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) ? UNITS : (GAME.units || []);
  if (!Array.isArray(list)) return;
  let scanned = 0;
  for (const u of list) {
    if (u.isDead) continue;
    if (u._initialScanDone) continue;
    performInitialAIScan(u);
    // grace 타이머 — 스폰 + 초기 스캔 직후 goProne 억제
    u.spawnedAt = u.spawnedAt || (GAME.gameTime || 0);
    u.initialTacticalGraceUntil = (GAME.gameTime || 0) + 3.0;
    scanned++;
  }
  if (scanned > 0) {
    log(`📡 초기 360° 시야 스캔 완료 — ${scanned}명 (적은 입구 방향으로 정렬)`, 'info');
  }
}

// =============================================================
