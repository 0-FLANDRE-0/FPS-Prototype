// [AI0-C2 Phase 1] PORTAL RISK EVIDENCE — shadow API.
//   이미 계산된 경로가 "직접 아는 portal"을 통과하는지 판별하고 위험 근거를 분해한다.
//   이 Phase에서는 경로 선택·A* cost·Utility 점수에 연결하지 않는다(순수 evidence).
// ════════════════════════════════════════════════════════════════════════════
const PORTAL_DANGER_MEMORY_SEC = 20;      // gunshot portal danger는 noise memory와 동일 수명
const PORTAL_RISK_W_GEOMETRY = 0.30;
const PORTAL_RISK_W_DANGER = 0.55;
const PORTAL_RISK_W_UNCERTAINTY = 0.15;
function _c2Clamp01(v) { return (v < 0) ? 0 : (v > 1) ? 1 : v; }
function _c2Now(options) {
  const o = options || {};
  if (o.now != null) return o.now;
  return (typeof GAME !== 'undefined' && GAME.gameTime != null) ? GAME.gameTime : 0;
}
function _c2Band(score) {
  if (score < 0.25) return 'low';
  if (score < 0.50) return 'medium';
  if (score < 0.75) return 'high';
  return 'critical';
}
// band 단위로 양자화 — signature가 매 tick 흔들리지 않게 한다
function _c2QuantBand(v, steps) { return Math.round(_c2Clamp01(v) * (steps || 10)); }
// 아는 portal만 조회한다. 모르면 null(호출자에게 존재 자체를 노출하지 않음).
function _c2KnownPortalRecord(unit, portalId) {
  if (!unit || !portalId) return null;
  const mem = unit.aiMemory;
  if (!mem || !(mem.knownPortals instanceof Map)) return null;
  return mem.knownPortals.get(portalId) || null;
}
// ── 4.1 getEffectivePortalDanger ───────────────────────────────────────────
//   portalDangers 기록을 현재 시각 기준 유효 위험도로 변환한다(원본 무변경, RNG 미사용).
function getEffectivePortalDanger(unit, portalId, options) {
  // 믿음 그래프에 담겨 있다는 것 자체가 "관측했다"는 뜻이라 별도 관측 기록을 요구하지 않는다.
  const _bg = (USE_BELIEF_TOPOLOGY && typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn());
  if (!_bg && !_c2KnownPortalRecord(unit, portalId)) return null;   // 미관측 portal은 위험도 없음
  const mem = unit.aiMemory;
  if (!mem || !(mem.portalDangers instanceof Map)) return null;
  const rec = mem.portalDangers.get(_portalDangerKey(unit, portalId));
  if (!rec) return null;
  const now = _c2Now(options);
  const ageSec = Math.max(0, now - (rec.lastUpdatedAt || 0));
  const ageFactor = _c2Clamp01(1 - ageSec / PORTAL_DANGER_MEMORY_SEC);
  const rawDangerLevel = (rec.dangerLevel != null) ? rec.dangerLevel : 0;
  const confidence = (rec.confidence != null) ? rec.confidence : 0;
  const effectiveDanger = _c2Clamp01(rawDangerLevel * confidence * ageFactor);
  return {
    portalId, rawDangerLevel, confidence,
    ageSec: +ageSec.toFixed(3), ageFactor: +ageFactor.toFixed(6),
    effectiveDanger: +effectiveDanger.toFixed(6),
    sourceEvidenceId: (rec.sourceEvidenceId != null) ? rec.sourceEvidenceId : null,
  };
}
// 미관측 portal에 대한 고정 redaction 응답 — 입력 ID를 되돌려주지 않는다.
function _c2UnknownPortalResult(extraReason) {
  return {
    known: false, usable: false, portalId: null, score: null, band: 'unknown',
    components: null, geometry: null, memory: null, danger: null,
    reasons: [extraReason || 'portal_not_known'], signature: 'unknown',
  };
}
// ── 4.2 getPortalRiskEvidence ──────────────────────────────────────────────
function getPortalRiskEvidence(unit, portalId, options) {
  const kp = _c2KnownPortalRecord(unit, portalId);
  if (!kp) return _c2UnknownPortalResult('portal_not_known');
  const o = options || {};
  const graph = o.graph || ((typeof tacticalGraphFor === 'function') ? tacticalGraphFor(unit) : null);
  const portal = (graph && graph.portals) ? graph.portals.get(portalId) : null;
  if (!portal) return _c2UnknownPortalResult('portal_geometry_missing');
  const reasons = [];
  // A. geometryRisk — doorway 폭만 사용(gridNative/subgridBridge는 implementation detail)
  const R = (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS : 8;
  const minWidth = 2 * R;
  const safeWidth = 3 * PATH_GRID;
  const widthPx = (portal.width != null) ? portal.width : (portal.minClearance || 0);
  const span = Math.max(1e-6, safeWidth - minWidth);
  const geometryRisk = _c2Clamp01(1 - _c2Clamp01((widthPx - minWidth) / span));
  if (geometryRisk >= 0.75) reasons.push('narrow_opening');
  // B. dangerRisk
  const danger = getEffectivePortalDanger(unit, portalId, o);
  const dangerRisk = danger ? danger.effectiveDanger : 0;
  if (danger && danger.rawDangerLevel > 0 && dangerRisk <= 0) reasons.push('danger_expired');
  else if (dangerRisk >= 0.5) reasons.push('recent_threat_through_portal');
  // C. uncertaintyRisk
  const confidence = (kp.confidence != null) ? kp.confidence : 0;
  const uncertaintyRisk = _c2Clamp01(1 - confidence);
  if (uncertaintyRisk >= 0.5) reasons.push('low_observation_confidence');
  const score = _c2Clamp01(geometryRisk * PORTAL_RISK_W_GEOMETRY
    + dangerRisk * PORTAL_RISK_W_DANGER
    + uncertaintyRisk * PORTAL_RISK_W_UNCERTAINTY);
  const band = _c2Band(score);
  if (!reasons.length) reasons.push('nominal');
  const PXM = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 32;
  // signature — geometry revision/graph fingerprint + confidence band + danger band만 반영.
  //   생성 시각은 넣지 않는다(매 tick 다른 문자열 금지).
  const gfp = (graph && graph.buildFingerprint) ? graph.buildFingerprint : 'nograph';
  const signature = 'c2:' + portalId + '@' + gfp
    + ':w' + Math.round(widthPx)
    + ':cb' + _c2QuantBand(confidence, 10)
    + ':db' + _c2QuantBand(dangerRisk, 10);
  return {
    known: true, usable: true, portalId, score: +score.toFixed(6), band,
    components: {
      geometryRisk: +geometryRisk.toFixed(6),
      dangerRisk: +dangerRisk.toFixed(6),
      uncertaintyRisk: +uncertaintyRisk.toFixed(6),
    },
    geometry: {
      widthPx: +widthPx.toFixed(3), widthM: +(widthPx / PXM).toFixed(3),
      portalType: portal.portalType || null, orientation: portal.orientation || null,
      gridNative: !!portal.gridNative, subgridBridge: !!portal.subgridBridge,
    },
    memory: {
      confidence, firstSeenAt: (kp.firstSeenAt != null) ? kp.firstSeenAt : null,
      lastSeenAt: (kp.lastSeenAt != null) ? kp.lastSeenAt : null,
    },
    danger, reasons, signature,
  };
}
// [AI0-C2 R1] segment가 opening을 횡단하는 지점의 segment parameter t를 돌려준다.
//   _segCrossesOpening()의 boolean 계약은 그대로 두고, 순서 판정용으로만 별도 계산한다.
//   횡단하지 않으면 null.
function _c2SegOpeningCrossT(x1, y1, x2, y2, op) {
  const ax = op.ax, ay = op.ay, bx = op.bx, by = op.by;
  const d1x = x2 - x1, d1y = y2 - y1, d2x = bx - ax, d2y = by - ay;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((ax - x1) * d2y - (ay - y1) * d2x) / den;
  const u = ((ax - x1) * d1y - (ay - y1) * d1x) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}
// [AI0-C2 R2] 같은 portal이 "인접 segment가 공유하는 waypoint"에서 두 번 잡힌 경우만 중복이다.
//   그 외에는 같은 portalId가 연속으로 검출되더라도 실제 재횡단 occurrence이므로 보존한다.
//   (R1은 lastPortalId 단일 비교여서 portal을 통과했다가 되돌아오는 명백한 재횡단까지 삭제했다.)
const _C2_SEG_T_EPS = 1e-6;        // segmentT가 segment 끝/시작에 붙었다고 볼 임계
const _C2_SHARED_PT_EPS = 1e-3;    // 교차점이 공유 waypoint와 같다고 볼 거리(px)
function _c2IsSharedWaypointDuplicate(prev, cur, sharedPt) {
  if (!prev || !cur) return false;
  if (prev.portalId !== cur.portalId) return false;
  if (prev.segmentIndex !== cur.segmentIndex - 1) return false;
  if (!(prev.segmentT >= 1 - _C2_SEG_T_EPS)) return false;
  if (!(cur.segmentT <= _C2_SEG_T_EPS)) return false;
  // 두 교차점이 실제로 공유 waypoint 위에 있는지까지 확인 (경로가 불연속이면 병합하지 않는다)
  if (sharedPt && sharedPt.x != null && sharedPt.y != null) {
    if (!(Math.hypot(prev.crossX - sharedPt.x, prev.crossY - sharedPt.y) <= _C2_SHARED_PT_EPS)) return false;
    if (!(Math.hypot(cur.crossX - sharedPt.x, cur.crossY - sharedPt.y) <= _C2_SHARED_PT_EPS)) return false;
  }
  return true;
}
// ── 4.3 getKnownPortalCrossingsForPath ─────────────────────────────────────
//   기존 path가 '아는 portal'의 opening segment를 실제 횡단하는지만 판별한다.
//   graph.portals 전체 순회 금지 — knownPortals의 ID만 본다.
function getKnownPortalCrossingsForPath(unit, path, options) {
  const out = [];
  if (!unit || !Array.isArray(path) || path.length < 2) return out;
  const mem = unit.aiMemory;
  if (!mem || !(mem.knownPortals instanceof Map) || mem.knownPortals.size === 0) return out;
  const o = options || {};
  const graph = o.graph || ((typeof tacticalGraphFor === 'function') ? tacticalGraphFor(unit) : null);
  if (!graph || !graph.openingByPortalId) return out;
  // 아는 portal 중 graph에 opening이 있는 것만 후보(결정적 순서)
  const candidates = [];
  for (const pid of Array.from(mem.knownPortals.keys()).sort()) {
    const op = graph.openingByPortalId.get(pid);
    const portal = graph.portals ? graph.portals.get(pid) : null;
    if (op && portal) candidates.push({ pid, op, portal });
  }
  if (!candidates.length) return out;
  let lastCross = null, order = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if (!a || !b || a.x == null || b.x == null) continue;
    // 1) 이 segment의 모든 교차를 먼저 수집하고 segment parameter t를 계산한다.
    const hits = [];
    for (const c of candidates) {
      if (!_segCrossesOpening(a.x, a.y, b.x, b.y, c.op)) continue;
      let t = _c2SegOpeningCrossT(a.x, a.y, b.x, b.y, c.op);
      if (t == null) t = 0;   // 평행/퇴화 등으로 t를 못 구하면 segment 시작으로 취급
      hits.push({ c, t });
    }
    if (!hits.length) continue;
    // 2) 실제 이동 순서 = t 오름차순, 완전 동점이면 portalId 사전순
    hits.sort((h1, h2) => (h1.t - h2.t) || (h1.c.pid < h2.c.pid ? -1 : h1.c.pid > h2.c.pid ? 1 : 0));
    // 3) 공유 waypoint 중복만 병합한다. 같은 portalId가 연속으로 나와도
    //    인접 segment 경계 교차가 아니면 재횡단 occurrence로 보존한다.
    for (const h of hits) {
      const tR = +h.t.toFixed(6);
      const cand = { portalId: h.c.pid, segmentIndex: i, segmentT: tR,
        crossX: a.x + (b.x - a.x) * h.t, crossY: a.y + (b.y - a.y) * h.t };
      if (_c2IsSharedWaypointDuplicate(lastCross, cand, a)) continue;
      lastCross = cand;
      out.push({
        portalId: h.c.pid, segmentIndex: i, pathOrder: order++, segmentT: tR,
        fromX: a.x, fromY: a.y, toX: b.x, toY: b.y,
        portalCenterX: h.c.portal.centerX, portalCenterY: h.c.portal.centerY,
        evidence: getPortalRiskEvidence(unit, h.c.pid, o),
      });
    }
  }
  return out;
}
// ── 4.4 buildPathPortalRiskReport ──────────────────────────────────────────
function buildPathPortalRiskReport(unit, path, options) {
  const o = options || {};
  const PXM = (typeof PX_PER_M !== 'undefined') ? PX_PER_M : 32;
  const pts = Array.isArray(path) ? path.filter(p => p && p.x != null && p.y != null) : [];
  let dist = 0;
  for (let i = 1; i < pts.length; i++) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  // pathSignature — waypoint 좌표를 1px로 안정 양자화. generatedAt은 넣지 않는다.
  const sigParts = pts.map(p => Math.round(p.x) + ',' + Math.round(p.y));
  const pathSignature = _iwShortHash(sigParts.join('|')) + ':' + pts.length;
  const crossings = getKnownPortalCrossingsForPath(unit, pts, o);
  // unique portal 기준 집계
  const uniqueMap = new Map();
  for (const c of crossings) {
    if (uniqueMap.has(c.portalId)) continue;
    const sc = (c.evidence && c.evidence.score != null) ? c.evidence.score : 0;
    uniqueMap.set(c.portalId, { portalId: c.portalId, score: sc, band: c.evidence ? c.evidence.band : 'unknown' });
  }
  const uniquePortals = Array.from(uniqueMap.values());
  // 결정적 선택: score 최대 → 동점이면 portalId 사전순(먼저 오는 쪽)
  let maxRisk = 0, sumRisk = 0, highestRiskPortalId = null;
  for (const up of uniquePortals) {
    sumRisk += up.score;
    if (highestRiskPortalId == null
        || up.score > maxRisk
        || (up.score === maxRisk && up.portalId < highestRiskPortalId)) {
      maxRisk = up.score; highestRiskPortalId = up.portalId;
    }
  }
  const averageRisk = uniquePortals.length ? (sumRisk / uniquePortals.length) : 0;
  const cumulativeRisk = uniquePortals.length ? _c2Clamp01(maxRisk + 0.25 * (sumRisk - maxRisk)) : 0;
  return {
    pathSignature, pathDistancePx: +dist.toFixed(3), pathDistanceM: +(dist / PXM).toFixed(3),
    crossingCount: crossings.length, uniquePortalCount: uniquePortals.length,
    crossings, uniquePortals,
    maxRisk: +maxRisk.toFixed(6), averageRisk: +averageRisk.toFixed(6), cumulativeRisk: +cumulativeRisk.toFixed(6),
    highestRiskPortalId, hasHighRisk: maxRisk >= 0.50,
    generatedAt: _c2Now(o),
  };
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-C1] OBSERVED-SURFACE COVER SLOT — 직접 관측한 표면의 직접 관측한 범위 안에서만
//   엄폐 슬롯을 만든다. 객체 전체 rect/중심 추론, 반대편 face 추론, 미관측 구간 추론 금지.
// ════════════════════════════════════════════════════════════════════════════
const C1_SLOT_QUANTIZE_PX = 8;        // slotId 안정화 격자
const C1_SLOT_MIN_SPACING_PX = 26;    // 같은 range 안 slot 최소 간격
const C1_SLOT_STANDOFF_PX = 4;        // UNIT_RADIUS에 더할 stand-off 여유
const C1_SLOT_EDGE_MARGIN_PX = 2;     // range 양 끝 여유
const C1_MIN_CONFIDENCE = 0.25;
const C1_MAX_INVALID_COUNT = 3;
const C1_SURFACE_STALE_SEC = 45;      // 이보다 오래 미관측이면 강한 감점
const C1_RESERVATION_RADIUS_PX = 34;  // 실제 점유 감점 반경
function _c1UnitRadius() { return (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS : 8; }
function _c1LiveObjectById(objectId) {
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (!M || !objectId) return null;
  for (const arr of [M.walls, M.coverObjects]) {
    if (!Array.isArray(arr)) continue;
    for (const o of arr) if (o && o._tacticalObjectId === objectId) return o;
  }
  return null;
}
// 믿음 계층의 source — 정답 객체 대신 그 유닛이 기억하는 면에서 추정한 몸통 사각형.
//   rayBoxT가 쓸 수 있게 {x,y,w,h} 모양을 그대로 준다.
function _c1BelievedBodyOf(unit, slot) {
  const mem = unit && unit.aiMemory;
  if (!mem || !(mem.observedSurfaces instanceof Map)) return null;
  const sm = mem.observedSurfaces.get(slot.objectId);
  return (sm && sm.believedBody) ? sm.believedBody : null;
}
// 관측 신뢰도/무결성 기준을 통과한 surface만 후보가 된다
function _c1SurfaceUsable(sm) {
  if (!sm || !sm.surfaceId) return { ok: false, reason: 'no_surface' };
  if (sm.objectKind !== 'wall' && sm.objectKind !== 'cover') return { ok: false, reason: 'kind' };
  if (sm.blocksBullets === false) return { ok: false, reason: 'not_ballistic' };
  if ((sm.confidence || 0) < C1_MIN_CONFIDENCE) return { ok: false, reason: 'low_confidence' };
  if ((sm.invalidCount || 0) >= C1_MAX_INVALID_COUNT) return { ok: false, reason: 'invalid_count' };
  if (!Array.isArray(sm.observedRanges) || sm.observedRanges.length === 0) return { ok: false, reason: 'no_observed_range' };
  // 믿음 계층의 면은 정답 객체도 geometry revision도 없다. 신선도는 confidence 감쇠가
  // 이미 표현하고 있고(위 low_confidence), 어긋난 기억은 reconcileMemory가 지운다.
  if (sm.believed) return { ok: true, live: sm.believedBody || null };
  const live = _c1LiveObjectById(sm.objectId);
  if (!live) return { ok: false, reason: 'object_gone' };
  const rev = (typeof getSurfaceObservationRevision === 'function') ? getSurfaceObservationRevision(live) : 0;
  if (sm.observationRevision !== rev) return { ok: false, reason: 'stale_revision' };
  return { ok: true, live };
}
// coverType — wall은 full 성격, cover는 SurfaceMemory 값 유지
function _c1CoverTypeOf(sm) {
  if (sm.objectKind === 'wall') return 'full';
  return (sm.coverType === 'half') ? 'half' : 'full';
}
// threat 기준 안전면: threat가 normal 쪽이면 slot은 반대쪽
function _c1SafeNormal(sm, surfPX, surfPY, threatPos) {
  const nx = sm.worldNormalX, ny = sm.worldNormalY;
  const tx = threatPos.x - surfPX, ty = threatPos.y - surfPY;
  const dot = nx * tx + ny * ty;
  return (dot > 0) ? { x: -nx, y: -ny } : { x: nx, y: ny };
}
function _c1SlotId(sm, s, profile) {
  const q = Math.round(s / C1_SLOT_QUANTIZE_PX);
  return sm.surfaceId + ':' + sm.observationRevision + ':s' + q + ':' + (profile || 'anchor');
}
// 한 surface의 관측 범위 안에서만 slot 생성
// [AI0-C1 R1] slot 위치는 양자화된 range bound에서 파생한다.
//   1~2px 관측 흔들림으로 slot 집합/ID가 바뀌지 않게 하기 위함(캐시 thrash 방지).
// [AI0-C1 R2] stop 목록과 topology key를 '한 번에' 만든다.
//   key는 실제 선택된 quantized stop index 목록에서 파생하므로 stops와 절대 어긋날 수 없다.
//   raw rounded bounds는 key로 쓰지 않는다(18.9/19.1이 같은 key가 되던 결함 제거).
function _c1ComputeStopsAndKey(sm) {
  const R = _c1UnitRadius();
  const clearance = R + C1_SLOT_EDGE_MARGIN_PX;
  const Q = C1_SLOT_QUANTIZE_PX;
  const stops = [];
  for (let ri = 0; ri < sm.observedRanges.length; ri++) {
    const rng = sm.observedRanges[ri];
    const aRaw = rng.s0 + clearance, bRaw = rng.s1 - clearance;
    if (!(bRaw > aRaw)) continue;
    // surface 자체 좌표 격자(Q 배수)에 앵커 — range가 흔들려도 stop 위치가 움직이지 않는다.
    const first = Math.ceil(aRaw / Q) * Q, last = Math.floor(bRaw / Q) * Q;
    let lastTaken = -Infinity;
    for (let sv = first; sv <= last; sv += Q) {
      if (sv - lastTaken < C1_SLOT_MIN_SPACING_PX) continue;   // 최소 간격 유지
      stops.push({ s: sv, rng }); lastTaken = sv;
    }
    // [R2] 격자 앵커가 하나도 없는 좁은 range는 slot을 만들지 않는다.
    //   (raw midpoint fallback은 signature와 위치가 어긋나므로 금지)
  }
  // topology key = 실제 stop index 목록 (+ 관측 revision). stops가 바뀌면 key도 반드시 바뀐다.
  let key = sm.observationRevision + '#';
  for (const st of stops) key += Math.round(st.s / Q) + ',';
  return { stops, key };
}
function _c1QuantizedSlotStops(sm) {
  const r = _c1ComputeStopsAndKey(sm);
  // [AI0-C1 R3] 항상 방금 계산한 stops를 반환한다.
  //   topology key가 같아도 _mergeObservedRanges()가 range 객체를 교체할 수 있으므로,
  //   이전 stops를 재사용하면 stop.rng가 옛 range(confidence/s0/s1)를 가리켜 stale이 된다.
  //   _c1ComputeStopsAndKey()가 이미 최신 stops를 만든 뒤이므로 계산량은 늘지 않는다.
  sm._c1StopsKey = r.key; sm._c1Stops = r.stops;
  return r.stops;
}
function _c1StopsCacheKey(sm) { return _c1ComputeStopsAndKey(sm).key; }
function buildSlotsForObservedSurface(unit, sm, threatPos, options) {
  const o = options || {};
  const out = [];
  const chk = _c1SurfaceUsable(sm);
  if (!chk.ok) return out;
  const R = _c1UnitRadius();
  const clearance = R + C1_SLOT_EDGE_MARGIN_PX;
  const standoff = R + C1_SLOT_STANDOFF_PX;
  const coverType = _c1CoverTypeOf(sm);
  // [AI0-C1 R1] slot 위치의 단일 원천 — signature와 정확히 같은 stop 목록에서 생성한다.
  for (const stop of _c1QuantizedSlotStops(sm)) {
    {
      const rng = stop.rng, s = stop.s;
      const spx = sm.segmentStartX + sm.tangentX * s;
      const spy = sm.segmentStartY + sm.tangentY * s;
      const sn = _c1SafeNormal(sm, spx, spy, threatPos);
      out.push({
        slotId: _c1SlotId(sm, s, o.profile), surfaceId: sm.surfaceId, objectId: sm.objectId,
        objectKind: sm.objectKind, observationRevision: sm.observationRevision, face: sm.face,
        s: +s.toFixed(2), surfacePointX: spx, surfacePointY: spy,
        x: spx + sn.x * standoff, y: spy + sn.y * standoff,
        safeNormalX: sn.x, safeNormalY: sn.y, coverType,
        rangeS0: rng.s0, rangeS1: rng.s1,
        confidence: Math.min(sm.confidence || 1, rng.confidence != null ? rng.confidence : 1),
        lastSeenAt: sm.lastSeenAt, sourceProtectionVerified: false, reachable: false,
        pathLengthPx: null, rejectionReasons: [],
      });
    }
  }
  return out;
}
// 물리 유효성 + source 단독 보호 검증 (미관측 객체의 우연한 차폐는 인정하지 않는다)
function validateObservedCoverSlot(unit, slot, threatPos, options) {
  const rej = slot.rejectionReasons;
  // 1) 물리 유효성 — clamp/nudge로 억지 통과시키지 않는다
  if (typeof pointInMap === 'function' && !pointInMap(slot.x, slot.y, 0)) { rej.push('outside_map'); return false; }
  if (typeof pointInWalls === 'function' && pointInWalls(slot.x, slot.y, _c1UnitRadius() - 2)) { rej.push('inside_obstacle'); return false; }
  // 믿음 계층에서는 정답 객체가 존재하지 않는다 — 면에서 추정한 몸통이 source다.
  //   이 분기가 없으면 모든 슬롯이 source_gone으로 탈락해 정본 경로가 통째로 무력화된다.
  const believedBody = (typeof isSpatialPerceptionOn === 'function' && isSpatialPerceptionOn())
    ? _c1BelievedBodyOf(unit, slot) : null;
  const live = believedBody || _c1LiveObjectById(slot.objectId);
  if (!live) { rej.push('source_gone'); return false; }
  // 2) slot이 source의 threat 반대편인가 (같은 쪽이면 엄폐가 아니다)
  const nx = slot.safeNormalX, ny = slot.safeNormalY;
  const toSlot = (slot.x - slot.surfacePointX) * nx + (slot.y - slot.surfacePointY) * ny;
  const toThreat = (threatPos.x - slot.surfacePointX) * nx + (threatPos.y - slot.surfacePointY) * ny;
  if (!(toSlot > 0 && toThreat < 0)) { rej.push('same_side_as_threat'); return false; }
  // 3) threat → slot ray에서 '가장 먼저' 만나는 ballistic blocker가 source여야 한다.
  //    다른 미관측 wall/cover가 앞에 있으면 그 차폐는 source protection이 아니다.
  const dx = slot.x - threatPos.x, dy = slot.y - threatPos.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) { rej.push('degenerate_ray'); return false; }
  const ux = dx / len, uy = dy / len;
  const tSource = rayBoxT(threatPos.x, threatPos.y, ux, uy, live, len);
  if (!(tSource >= 0 && tSource < Infinity)) { rej.push('source_not_blocking'); return false; }
  const EPS = 0.5;
  if (believedBody) {
    // 믿음 계층 — 아는 몸통만 훑는다. 안 본 벽이 우연히 막아주는 것은 엄폐로 치지 않는다.
    const mem0 = unit.aiMemory;
    if (mem0 && mem0.observedSurfaces instanceof Map) {
      for (const sm of mem0.observedSurfaces.values()) {
        if (!sm || sm.surfaceId === slot.objectId || !sm.believedBody) continue;
        if (!sm.blocksBullets) continue;
        const t2 = rayBoxT(threatPos.x, threatPos.y, ux, uy, sm.believedBody, tSource);
        if (t2 >= 0 && t2 < tSource - EPS) { rej.push('source_not_first_blocker'); return false; }
      }
    }
  } else {
    const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
    if (M) {
      for (const arr of [M.walls, M.coverObjects]) {
        if (!Array.isArray(arr)) continue;
        for (const o of arr) {
          if (!o) continue;
          // 동일 객체는 ID로도 배제한다(sandbox 스냅샷 복원 등으로 참조가 달라질 수 있다)
          if (o === live || (o._tacticalObjectId && o._tacticalObjectId === slot.objectId)) continue;
          const t2 = rayBoxT(threatPos.x, threatPos.y, ux, uy, o, tSource);
          if (t2 >= 0 && t2 < tSource - EPS) { rej.push('source_not_first_blocker'); return false; }
        }
      }
    }
  }
  // 4) source 교차점이 관측한 face와 논리적으로 일치하는가 (threat는 face 바깥쪽에 있어야 한다)
  const fnx = -slot.safeNormalX, fny = -slot.safeNormalY;   // 관측 face의 threat 쪽 법선
  const towardThreat = (threatPos.x - slot.surfacePointX) * fnx + (threatPos.y - slot.surfacePointY) * fny;
  if (!(towardThreat > 0)) { rej.push('face_mismatch'); return false; }
  slot.sourceProtectionVerified = true;
  slot.sourceEntryT = +tSource.toFixed(2);
  return true;
}
function scoreObservedCoverSlot(unit, slot, threatPos, context) {
  const ctx = context || {};
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  const b = {};
  // protection — wall/full > half. sourceProtectionVerified 없으면 앞에서 이미 reject됨
  b.protectionScore = (slot.coverType === 'full') ? 55 : 30;
  if (slot.objectKind === 'wall') b.protectionScore += 8;
  b.halfCoverPenalty = (slot.coverType === 'half') ? 12 : 0;
  // 관측 신뢰도 / 신선도
  b.confidenceScore = 22 * Math.max(0, Math.min(1, slot.confidence));
  const age = Math.max(0, now - (slot.lastSeenAt || now));
  b.freshnessScore = 12 * Math.max(0, 1 - age / C1_SURFACE_STALE_SEC);
  // 이동 — 실제 path 길이
  const pl = (slot.pathLengthPx != null) ? slot.pathLengthPx : Math.hypot(slot.x - unit.x, slot.y - unit.y);
  b.travelPenalty = Math.min(40, pl / (PX_PER_M_FALLBACK * 0.6));
  b.pathPenalty = (slot.reachable === false) ? 999 : 0;
  // threat 거리 — 너무 가까우면 감점
  const td = Math.hypot(slot.x - threatPos.x, slot.y - threatPos.y);
  b.threatDistancePenalty = (td < 3 * PX_PER_M_FALLBACK) ? (3 * PX_PER_M_FALLBACK - td) / PX_PER_M_FALLBACK * 8 : 0;
  // 점유 / 예약
  b.occupancyPenalty = 0; b.reservationPenalty = 0;
  const others = ctx.others || [];
  for (const u of others) {
    if (!u || u === unit || !u.alive) continue;
    if (u.aiAction && u.aiAction.targetSlotId === slot.slotId) { b.reservationPenalty += 500; continue; }
    const ux = (u.movePath && u.movePath.length) ? u.movePath[u.movePath.length - 1].x : u.x;
    const uy = (u.movePath && u.movePath.length) ? u.movePath[u.movePath.length - 1].y : u.y;
    if (Math.hypot(ux - slot.x, uy - slot.y) < C1_RESERVATION_RADIUS_PX) b.occupancyPenalty += 26;
  }
  const score = b.protectionScore + b.confidenceScore + b.freshnessScore
    - b.travelPenalty - b.threatDistancePenalty - b.occupancyPenalty - b.reservationPenalty - b.pathPenalty - b.halfCoverPenalty;
  return { score, breakdown: b };
}
// cache signature — 관측 표면 기반
// [AI0-C1 R1] cache signature — 원시 range 픽셀이 아니라 '실제 생성 가능한 quantized slot index 집합'.
//   미세한 range 변화로 slot 집합이 그대로면 signature도 불변이다.
function _c1UsableSlotIndices(sm) {
  const chk = _c1SurfaceUsable(sm);
  if (!chk.ok) return null;
  const stops = _c1QuantizedSlotStops(sm);
  const idx = stops.map(st => Math.round(st.s / C1_SLOT_QUANTIZE_PX));
  if (idx.length === 0) return null;
  idx.sort((x, y) => x - y);
  return idx;
}
function getObservedCoverSlotMemorySignature(unit) {
  const mem = unit && unit.aiMemory;
  if (!mem || !(mem.observedSurfaces instanceof Map)) return 'none';
  // [AI0-C1 R1 perf] surface 상태(관측 revision + range 지문)와 geometry revision이 그대로면
  //   이전에 만든 signature 문자열을 그대로 재사용한다(값은 동일, 계산만 생략).
  const _tgRev = (typeof GAME !== 'undefined' && GAME.tacticalGeometry) ? (GAME.tacticalGeometry.revision || 0) : 0;
  let _stateKey = 'g' + _tgRev + '#' + mem.observedSurfaces.size + '#';
  for (const sid of mem.observedSurfaces.keys()) {
    const sm0 = mem.observedSurfaces.get(sid);
    _stateKey += sid + ':' + _c1StopsCacheKey(sm0) + ':c' + Math.round((sm0.confidence || 0) * 4) + ':i' + (sm0.invalidCount || 0) + '|';
  }
  if (mem._c1SigKey === _stateKey && mem._c1Sig != null) return mem._c1Sig;
  const parts = [];
  for (const sid of Array.from(mem.observedSurfaces.keys()).sort()) {
    const sm = mem.observedSurfaces.get(sid);
    const idx = _c1UsableSlotIndices(sm);
    if (!idx) continue;                            // 잠재 slot 0개 surface는 signature에 넣지 않는다
    parts.push(sid + '@' + sm.observationRevision + ':[' + idx.join(',') + ']'
      + ':c' + Math.round((sm.confidence || 0) * 4) + ':i' + (sm.invalidCount || 0));
  }
  if (parts.length === 0) { mem._c1SigKey = _stateKey; mem._c1Sig = 'none'; return 'none'; }
  const out = _iwShortHash(parts.join('|')) + ':' + parts.length + ':g' + _tgRev;
  mem._c1SigKey = _stateKey; mem._c1Sig = out;
  return out;
}
// 전체 후보 생성 + 검증 + 점수 (결정적 정렬)
function buildObservedCoverSlotCandidates(unit, threatPos, options) {
  const o = options || {};
  const mem = ensureAIMemory(unit);
  ensureSpatialMemoryFields(mem);
  const out = [];
  if (!(mem.observedSurfaces instanceof Map) || mem.observedSurfaces.size === 0) return out;
  const others = o.others || ((typeof UNITS !== 'undefined' && Array.isArray(UNITS))
    ? UNITS.filter(u => u && u !== unit && u.alive && u.team === unit.team) : []);
  const ctx = { others };
  const maxEval = o.maxEval || 48;
  let evaluated = 0;
  for (const sm of mem.observedSurfaces.values()) {
    const slots = buildSlotsForObservedSurface(unit, sm, threatPos, o);
    for (const slot of slots) {
      if (evaluated >= maxEval) break;
      evaluated++;
      if (!validateObservedCoverSlot(unit, slot, threatPos, o)) { if (o.keepRejected) out.push(slot); continue; }
      // 도달 가능성 — findPath가 null이면 reject
      if (o.skipPath) { slot.reachable = true; slot.pathLengthPx = Math.hypot(slot.x - unit.x, slot.y - unit.y); }
      else {
        // 값싼 길 먼저 — 직선이 뚫려 있으면 그게 곧 최단 경로다(A* 불필요).
        const quick = (typeof quickReachLength === 'function')
          ? quickReachLength(unit, unit.x, unit.y, slot.x, slot.y) : null;
        if (quick != null) {
          slot.reachable = true; slot.pathLengthPx = +quick.toFixed(1);
        } else {
          const path = (typeof findPath === 'function') ? findPath(unit.x, unit.y, slot.x, slot.y, unit) : null;
          if (!path || path.length === 0) { slot.reachable = false; slot.rejectionReasons.push('unreachable'); if (o.keepRejected) out.push(slot); continue; }
          let pl = 0, px = unit.x, py = unit.y;
          for (const p of path) { pl += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
          slot.reachable = true; slot.pathLengthPx = +pl.toFixed(1);
        }
      }
      const sc = scoreObservedCoverSlot(unit, slot, threatPos, ctx);
      slot.score = sc.score; slot.scoreBreakdown = sc.breakdown;
      out.push(slot);
    }
    if (evaluated >= maxEval) break;
  }
  // 결정적 정렬 — score 내림차순 → pathLength 오름차순 → slotId 사전순 (Math.random 금지)
  const valid = out.filter(s => s.score != null);
  valid.sort((a, b2) => (b2.score - a.score) || ((a.pathLengthPx || 0) - (b2.pathLengthPx || 0)) || (a.slotId < b2.slotId ? -1 : a.slotId > b2.slotId ? 1 : 0));
  return o.keepRejected ? { valid, all: out } : valid;
}
// canonical 최적 엄폐 — 기존 ctx.bestCover 소비자와 호환되는 shape로 반환
function findBestObservedCover(unit, threatPos, options) {
  const ranked = buildObservedCoverSlotCandidates(unit, threatPos, options);
  if (!ranked || ranked.length === 0) return null;
  const s = ranked[0];
  const live = _c1LiveObjectById(s.objectId);
  return {
    spotX: s.x, spotY: s.y, score: s.score,
    slotKey: s.slotId, slotId: s.slotId, surfaceId: s.surfaceId,
    objectId: s.objectId, objectKind: s.objectKind, observationRevision: s.observationRevision,
    face: s.face, coverType: s.coverType, pathLengthPx: s.pathLengthPx,
    scoreBreakdown: s.scoreBreakdown, losBlocked: true, canonical: 'observedSurface',
    cover: live ? { id: live._tacticalObjectId, x: live.x, y: live.y, coverType: s.coverType } : null,
    coverObjectId: live ? live._tacticalObjectId : null,
    candidateCount: ranked.length,
  };
}
// [AI0-C1 LEGACY] 객체 중심 기준 임의 슬롯 — canonical 경로에서 사용하지 않는다(AI0-D까지 보존).
function generateCoverSlots(cover, threatPos) {
  const slots = [];
  if (!cover) return slots;
  const cx = cover.x + (cover.rect ? cover.rect.w / 2 : 0);
  const cy = cover.y + (cover.rect ? cover.rect.h / 2 : 0);
  // cover 중심에서 threat 반대 방향
  const dx = (cover.x - threatPos.x), dy = (cover.y - threatPos.y);
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return slots;
  const offsetM = (cover.coverType === 'full') ? 0.8 : 0.55;
  const offsetPx = offsetM * PX_PER_M_FALLBACK;
  // threat 반대 방향 단위 벡터
  const oppX = dx / len, oppY = dy / len;
  // 수직 (좌우) 단위 벡터 — threat에 수직
  const perpX = -oppY, perpY = oppX;
  // cover 크기에 따라 slot 수 결정
  const w = (cover.rect && cover.rect.w) || 32;
  const h = (cover.rect && cover.rect.h) || 32;
  const longSide = Math.max(w, h);
  // 기준 위치 (center) — cover 중심에서 threat 반대편 offset
  const baseX = cover.x + oppX * offsetPx;
  const baseY = cover.y + oppY * offsetPx;
  slots.push({ key: 'center', x: baseX, y: baseY });
  // 좌/우 — longSide의 30%
  if (longSide >= 28) {
    const sideOffset = Math.min(longSide * 0.30, 22);
    slots.push({ key: 'left',  x: baseX - perpX * sideOffset, y: baseY - perpY * sideOffset });
    slots.push({ key: 'right', x: baseX + perpX * sideOffset, y: baseY + perpY * sideOffset });
  }
  // farLeft/farRight — cover가 크면
  if (longSide >= 56) {
    const farOffset = Math.min(longSide * 0.45, 38);
    slots.push({ key: 'farLeft',  x: baseX - perpX * farOffset, y: baseY - perpY * farOffset });
    slots.push({ key: 'farRight', x: baseX + perpX * farOffset, y: baseY + perpY * farOffset });
  }
  return slots;
}

// slot 전술 점수 — 측면 보호 / 탈출 / 사격각 평가 + 통합 검증
function scoreCoverSlot(unit, slot, cover, threatPos, ctx) {
  // === 1) 물리 검증 — invalid면 nudge 시도, 그래도 안 되면 폐기 ===
  let v = validateMoveTarget(unit, slot.x, slot.y, { allowDanger: true });
  if (!v.valid && v.physicalInvalid) {
    // 맵 밖은 절대 nudge 불가 (clamp 금지)
    if (v.outsideMap) return null;
    // 벽/cover 내부 — nudge 시도
    const nudged = nudgeSlotOutOfObstacle(slot, threatPos, unit);
    if (!nudged) return null;
    slot = { ...slot, x: nudged.x, y: nudged.y, _nudged: nudged.nudgeStep };
    v = validateMoveTarget(unit, slot.x, slot.y, { allowDanger: true });
    if (!v.valid && v.physicalInvalid) return null;   // nudge 후에도 invalid
  }
  // === 2) 위험 검증 — 자율 행동이면 reject ===
  const isAutonomous = !(unit.aiAction && unit.aiAction._playerCommanded);
  if (isAutonomous) {
    const v2 = validateMoveTarget(unit, slot.x, slot.y, {});
    if (!v2.valid && v2.tacticalInvalid) {
      // 위험 invalid는 슬롯 자체 폐기 (자율 seekCover는 위험 area 안 들어감)
      return null;
    }
  }
  // === 3) LOS — slot → threat ===
  const losBlocked = (typeof isLOSBlockedForBlast === 'function')
    ? isLOSBlockedForBlast(slot.x, slot.y, threatPos.x, threatPos.y) : false;
  if (!losBlocked && cover.coverType === 'full') return null;

  let score = 0;
  if (losBlocked) score += 80;
  if (cover.coverType === 'full') score += 25;
  else if (cover.coverType === 'half') score += 12;
  score += (cover.confidence || 0.5) * 20;
  if (cover.invalidCount === 1) score -= 30;

  // 거리 페널티
  const distFromUnit = Math.hypot(slot.x - unit.x, slot.y - unit.y) / PX_PER_M_FALLBACK;
  score -= distFromUnit * 6;
  const distFromThreat = Math.hypot(slot.x - threatPos.x, slot.y - threatPos.y) / PX_PER_M_FALLBACK;
  const curDistFromThreat = Math.hypot(unit.x - threatPos.x, unit.y - threatPos.y) / PX_PER_M_FALLBACK;
  if (distFromThreat < curDistFromThreat * 0.7) score -= 30;

  // === SIDE-AI-COVER-FIX: 기억/시야/거리/후퇴 페널티 — 멀리 떨어진 뒤쪽 엄폐물로 도망가는 것 방지 ===
  {
    const _nowC = GAME.gameTime || 0;
    // (1) 오래 미확인된 기억 cover (최근 직접 본 게 아님)
    if (cover.lastCheckedTime != null) {
      const _age = _nowC - cover.lastCheckedTime;
      if (_age > 6) score -= Math.min(40, (_age - 6) * 4);
    } else if ((cover.confidence || 1) < 0.5) {
      score -= 20;   // 확인시각 없고 신뢰도 낮음 = 흐릿한 기억
    }
    // (2) 멀리 있고 + 현재 유닛 시야에서 안 보이는 엄폐물 (기억에만 의존해서 달려감)
    if (distFromUnit > 5 && typeof isLOSBlockedForBlast === 'function'
        && isLOSBlockedForBlast(unit.x, unit.y, slot.x, slot.y)) score -= 35;
    // (3) 먼 거리 가속 페널티 (8m 초과부터 급증 — 기존 -6/m에 추가)
    if (distFromUnit > 8) score -= (distFromUnit - 8) * 8;
    // (4) 후퇴 방향 — 위협에서 오히려 더 멀어지는 엄폐물 (아군은 전진해야 하므로 더 강하게)
    if (distFromThreat > curDistFromThreat + 2) {
      const _retreatPen = (unit.team === 'friend') ? 28 : 14;
      score -= _retreatPen + (distFromUnit > 6 ? _retreatPen * 0.5 : 0);
    }
  }

  // 점유/예약 페널티
  const reserved = collectReservedPoints(unit);
  let occupiedPenalty = 0, reservedPenalty = 0;
  for (const p of reserved) {
    const d = Math.hypot(p.x - slot.x, p.y - slot.y);
    if (d < 14) {
      if (p.type === 'pos') occupiedPenalty = Math.max(occupiedPenalty, 80);
      else                   reservedPenalty = Math.max(reservedPenalty, 60);
    } else if (d < 22) {
      if (p.type === 'pos') occupiedPenalty = Math.max(occupiedPenalty, 30);
      else                   reservedPenalty = Math.max(reservedPenalty, 20);
    } else if (d < 30) {
      reservedPenalty = Math.max(reservedPenalty, 8);
    }
  }
  score -= occupiedPenalty + reservedPenalty;

  // 측면 보호
  let sideProtectionScore = 0;
  const threatAng = Math.atan2(threatPos.y - slot.y, threatPos.x - slot.x);
  const sideDirs = [threatAng + Math.PI / 2.5, threatAng - Math.PI / 2.5];
  for (const dir of sideDirs) {
    const sx = Math.cos(dir), sy = Math.sin(dir);
    const checkDist = 35;
    if (typeof rayDistToWalls === 'function') {
      const w = rayDistToWalls(slot.x, slot.y, sx, sy, checkDist);
      if (w && w.t < checkDist) { sideProtectionScore += 12; continue; }
    }
    if (MAP_DATA && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
      for (const o of MAP_DATA.coverObjects) {
        if (o === (cover._sourceObj || null)) continue;
        const t = rayBoxT(slot.x, slot.y, sx, sy, o, checkDist);
        if (t < checkDist && isCoverBlocksVision(o)) { sideProtectionScore += 10; break; }
      }
    }
  }
  score += sideProtectionScore;

  // 탈출/후방 openSector
  let escapeScore = 0;
  if (ctx && ctx.mem && ctx.mem.openSectors) {
    const escapeAng = threatAng + Math.PI;
    for (const s of ctx.mem.openSectors) {
      if (Math.abs(angleDelta(s.angle, escapeAng)) < Math.PI / 3) {
        if (s.distance > 4 * PX_PER_M_FALLBACK) { escapeScore += 8; break; }
      }
    }
  }
  score += escapeScore;

  // 행동 상황별 가중치
  if (unit.aiAction) {
    const aType = unit.aiAction.type;
    if (aType === 'retreatFromThreat' || aType === 'repositionToCorner') {
      score += escapeScore;
      score -= occupiedPenalty * 0.3;
    } else if (aType === 'holdAngle' || aType === 'engageEnemy') {
      score += sideProtectionScore * 0.5;
    }
  }

  // 추가 area 가산 — slot이 doorway이면 +10
  if (typeof getAreaInfo === 'function') {
    const sa = getAreaInfo(slot.x, slot.y);
    if (sa.areaType === 'doorway')          score += 10;
    else if (sa.areaType === 'corridor')    score += 4;
    else if (sa.areaType === 'roomInterior' && (unit.aiAction && (unit.aiAction.type === 'retreatFromThreat' || unit.aiAction.type === 'repositionToCorner'))) {
      score -= 12;
    }
  }

  return {
    spotX: slot.x, spotY: slot.y,
    score, losBlocked, cover, slotKey: slot.key,
    sideProtectionScore, escapeScore, occupiedPenalty, reservedPenalty,
    nudged: slot._nudged || 0,
  };
}

// =============================================================
// 엄폐 후보 평가 + 선택
// =============================================================

// cover spot 점수 계산 — 위협 반대편 offset 위치 평가
function scoreCoverSpot(unit, cover, threatPos) {
  // invalid 처리된 cover는 후보에서 제외
  if (cover.invalidCount != null && cover.invalidCount >= 2) return null;
  const dx = cover.x - threatPos.x, dy = cover.y - threatPos.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return null;
  // offset — half cover는 작게, full은 크게
  const offsetM = (cover.coverType === 'full') ? 0.8 : 0.55;
  const offsetPx = offsetM * PX_PER_M_FALLBACK;
  const spotX = cover.x + (dx / len) * offsetPx;
  const spotY = cover.y + (dy / len) * offsetPx;

  // spot이 맵 안인지
  if (typeof MAP_DATA !== 'undefined' && MAP_DATA.w != null) {
    if (spotX < 5 || spotY < 5 || spotX > MAP_DATA.w - 5 || spotY > MAP_DATA.h - 5) return null;
  }
  // spot이 벽 안인지 (단순 체크)
  if (typeof isPointBlocked === 'function' && isPointBlocked(spotX, spotY)) return null;

  // LOS 검사 — spot → threat
  const losBlocked = (typeof isLOSBlockedForBlast === 'function')
    ? isLOSBlockedForBlast(spotX, spotY, threatPos.x, threatPos.y) : false;

  let score = 0;
  // 위협 방향 막음 (가장 중요)
  if (losBlocked) score += 100;
  if (cover.coverType === 'full') score += 30;
  else if (cover.coverType === 'half') score += 15;
  // 신뢰도 보너스
  score += (cover.confidence || 0.5) * 25;
  // invalidCount 1회면 감점 (한 번 검증 실패한 경우)
  if (cover.invalidCount === 1) score -= 30;
  // 거리 페널티 — 가까울수록 좋음
  const distFromUnit = Math.hypot(spotX - unit.x, spotY - unit.y) / PX_PER_M_FALLBACK;
  score -= distFromUnit * 6;
  // 위협에 더 가까워지면 강한 페널티
  const distFromThreat = Math.hypot(spotX - threatPos.x, spotY - threatPos.y) / PX_PER_M_FALLBACK;
  const curDistFromThreat = Math.hypot(unit.x - threatPos.x, unit.y - threatPos.y) / PX_PER_M_FALLBACK;
  if (distFromThreat < curDistFromThreat * 0.7) score -= 50;
  // SIDE-AI-COVER-FIX: 기억/시야/거리/후퇴 페널티 (멀리 떨어진 뒤쪽 엄폐물 도망 방지)
  {
    const _nowC = GAME.gameTime || 0;
    if (cover.lastCheckedTime != null) { const _age = _nowC - cover.lastCheckedTime; if (_age > 6) score -= Math.min(40, (_age - 6) * 4); }
    if (distFromUnit > 5 && isLOSBlockedForBlast && isLOSBlockedForBlast(unit.x, unit.y, spotX, spotY)) score -= 35;
    if (distFromUnit > 8) score -= (distFromUnit - 8) * 8;
    if (distFromThreat > curDistFromThreat + 2) { const _rp = (unit.team === 'friend') ? 28 : 14; score -= _rp + (distFromUnit > 6 ? _rp * 0.5 : 0); }
  }
  // 너무 가까우면(<1.5m) 부적합
  if (distFromThreat < 1.5 * PX_PER_M_FALLBACK / PX_PER_M_FALLBACK) score -= 100;
  // 이미 다른 아군이 점유 중
  if (cover.occupiedBy && cover.occupiedBy !== unit.id) score -= 30;
  return { spotX, spotY, score, losBlocked, cover };
}

// 최고 점수 cover 찾기 — threatPos는 {x, y}
//   각 cover에서 여러 slot을 만들고, 모든 slot 점수를 비교 (slot 단위 최고점 반환)
// ════════════════════════════════════════════════════════════════════════════
// [AI-PERF Phase4] 조건부 best cover 재사용 — 단순 TTL이 아니라 "결과가 유효한 조건"으로 무효화.
//   재평가 트리거: 위협 위치 큰 이동 / 유닛 큰 이동 / 알려진 엄폐 집합 변화 /
//     수류탄 danger 발생 / suppression·부상으로 이동능력 급변 / 현재 행동이 seekCover·retreat로 전환.
//   조건이 그대로면 이전 후보·점수를 그대로 반환 → findBestCover가 frame rate로 호출되지 않는다.
//   결정성: 캐시는 checkVisibility/findBestCover의 결정적 결과를 저장할 뿐 새 RNG를 만들지 않는다.
const _COVER_THREAT_MOVE_SQ = 48 * 48;   // 위협이 이 이상 움직이면 재평가 (약 1.5m)
const _COVER_SELF_MOVE_SQ = 32 * 32;     // 유닛이 이 이상 움직이면 재평가 (약 1m)
function getCachedBestCover(unit, threatPos) {
  if (!GAME.aiProfileOn) return _getCachedBestCoverImpl(unit, threatPos);
  _aiProfCall('getCachedBestCover');
  const _t0 = _aiProfNow();
  try { return _getCachedBestCoverImpl(unit, threatPos); }
  finally { _aiProfRecord('getCachedBestCover', _aiProfNow() - _t0); }
}
function _getCachedBestCoverImpl(unit, threatPos) {
  const c = unit._bestCoverCache;
  const knownCoverCount = (unit.aiMemory && unit.aiMemory.knownCovers) ? unit.aiMemory.knownCovers.size : 0;
  // [AI0-C1 R2] cache mode 분리 — C1 signature는 canonical 결과에만 적용한다.
  //   legacy 결과는 0.40.3의 기존 검증만 사용해 non-intervention 동작을 완전히 보존한다.
  const _cachedMode = (c && c.coverMode) ? c.coverMode : null;
  const _mates = (typeof UNITS !== 'undefined' && Array.isArray(UNITS))
    ? UNITS.filter(u => u && u !== unit && u.alive && u.team === unit.team) : [];
  const _occAt = (sx, sy) => {
    if (sx == null) return '';
    const RR = C1_RESERVATION_RADIUS_PX;
    return _mates.filter(u => {
      const ux = (u.movePath && u.movePath.length) ? u.movePath[u.movePath.length - 1].x : u.x;
      const uy = (u.movePath && u.movePath.length) ? u.movePath[u.movePath.length - 1].y : u.y;
      return Math.hypot(ux - sx, uy - sy) < RR;
    }).map(u => u.id).sort().join(',');
  };
  // canonical availability — 값싼 none/non-none 전환 판정에만 쓴다
  const observedSig = getObservedCoverSlotMemorySignature(unit);
  const canonicalAvailability = (observedSig === 'none') ? 'none' : 'available';
  const reservationSig = (_cachedMode === 'canonical')
    ? _mates.map(u => (u.aiAction && u.aiAction.targetSlotId) || '').filter(Boolean).sort().join('|') : '';
  const localOccSig = (_cachedMode === 'canonical' && c && c.result && c.result.spotX != null)
    ? _occAt(c.result.spotX, c.result.spotY) : '';
  const grenadeActive = getGrenadeDangerForUnit(unit);   // [0.38.2 Fix2] canonical 기준 공유 (grenade cover invalidation)
  const canMove = !(unit.medical && unit.medical.canMove === false);
  const suppressionBand = ((unit.suppression || 0) > 70) ? 2 : ((unit.suppression || 0) > 40 ? 1 : 0);
  const actionType = unit.aiAction ? unit.aiAction.type : null;
  const coverSeeking = (actionType === 'seekCover' || actionType === 'retreatFromThreat');
  // 유효성 검사 — 하나라도 어긋나면 재평가
  let valid = !!c;
  if (valid) {
    if ((threatPos.x - c.threatX) ** 2 + (threatPos.y - c.threatY) ** 2 > _COVER_THREAT_MOVE_SQ) valid = false;
    else if ((unit.x - c.selfX) ** 2 + (unit.y - c.selfY) ** 2 > _COVER_SELF_MOVE_SQ) valid = false;
    else if (c.knownCoverCount !== knownCoverCount) valid = false;
    // [AI0-C1 R2] mode transition — availability가 none↔available로 바뀌면 어느 모드든 재평가
    else if (c.canonicalAvailability !== canonicalAvailability) valid = false;
    // canonical 결과에만 C1 signature 적용 (legacy 결과는 0.40.3 검증만)
    else if (c.coverMode === 'canonical' && c.observedSig !== observedSig) valid = false;
    else if (c.coverMode === 'canonical' && c.reservationSig !== reservationSig) valid = false;
    else if (c.coverMode === 'canonical' && c.localOccSig !== localOccSig) valid = false;
    else if (c.grenadeActive !== grenadeActive) valid = false;
    else if (c.canMove !== canMove) valid = false;
    else if (c.suppressionBand !== suppressionBand) valid = false;
    else if (c.coverSeeking !== coverSeeking) valid = false;
    // 기존 best cover가 점유·파괴·접근 불가로 바뀐 경우 — cover 객체 유효성 재확인
    else if (c.result && c.result.coverObjectId != null && typeof isCoverStillValid === 'function' && !isCoverStillValid(c.result.coverObjectId)) valid = false;
  }
  if (valid) { if (GAME.aiProfileOn) _aiProfCall('getCachedBestCover_hit'); return c.result; }
  // 재평가
  const result = findBestCover(unit, threatPos);
  // [AI0-C1 R2] 결과 모드 확정 — canonical 결과에만 C1 signature를 저장/검증한다.
  const _mode = (result && result.canonical === 'observedSurface') ? 'canonical' : 'legacy';
  unit._bestCoverCache = {
    threatX: threatPos.x, threatY: threatPos.y, selfX: unit.x, selfY: unit.y,
    knownCoverCount, canonicalAvailability, grenadeActive, canMove, suppressionBand, coverSeeking,
    coverMode: _mode,
    targetSlotId: (_mode === 'canonical' && result) ? (result.slotId || null) : null,
    targetSurfaceId: (_mode === 'canonical' && result) ? (result.surfaceId || null) : null,
    observedSig: (_mode === 'canonical') ? observedSig : null,
    reservationSig: (_mode === 'canonical')
      ? _mates.map(u => (u.aiAction && u.aiAction.targetSlotId) || '').filter(Boolean).sort().join('|') : null,
    localOccSig: (_mode === 'canonical' && result && result.spotX != null) ? _occAt(result.spotX, result.spotY) : null,
    result, stamp: GAME.gameTime,
  };
  return result;
}
function findBestCover(unit, threatPos) {
  if (!GAME.aiProfileOn) return _findBestCoverImpl(unit, threatPos);
  _aiProfCall('findBestCover');
  const _t0 = _aiProfNow();
  try { return _findBestCoverImpl(unit, threatPos); }
  finally { _aiProfRecord('findBestCover', _aiProfNow() - _t0); }
}
function _findBestCoverImpl(unit, threatPos) {
  ensureAIMemory(unit);
  const mem = unit.aiMemory;
  // [AI0-C1] canonical — 직접 관측한 표면의 관측 범위 안 슬롯을 우선한다.
  //   유효 후보가 하나라도 있으면 legacy generateCoverSlots/knownCovers 경로를 쓰지 않는다.
  const _canon = findBestObservedCover(unit, threatPos, {});
  if (_canon) return _canon;
  if (!mem.knownCovers || mem.knownCovers.size === 0) return null;
  // 간단한 ctx (slot 가중치용)
  const ctx = { mem };
  let best = null;
  const ranked = [];
  for (const cover of mem.knownCovers.values()) {
    // slot 후보 생성 (center/left/right/farLeft/farRight)
    const slots = generateCoverSlots(cover, threatPos);
    if (slots.length === 0) {
      // fallback — 기존 scoreCoverSpot 사용
      const s = scoreCoverSpot(unit, cover, threatPos);
      if (s) ranked.push(s);
      continue;
    }
    for (const slot of slots) {
      const ss = scoreCoverSlot(unit, slot, cover, threatPos, ctx);
      if (ss) ranked.push(ss);
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  best = ranked.length > 0 ? ranked[0] : null;
  if (GAME.debugAICover && ranked.length > 0) {
    GAME.fxList.push({
      type: 'ai_cover_candidates',
      candidates: ranked.slice(0, 6),
      unitId: unit.id,
      life: 0.8, maxLife: 0.8,
    });
  }
  return best;
}

// 위협 방향 결정 — 우선순위:
//   1) 보이는 적 (단순화: 가까운 적 first)
//   2) lastSeenEnemy
//   3) lastHeardNoise
//   4) recentDamageDir (피격 방향)
//   5) dangerPoints
function getThreatPosition(unit) {
  ensureAIMemory(unit);
  const mem = unit.aiMemory;
  // [AI0-A §3.6] 거리만으로 고른 적을 visible 위협으로 쓰지 않는다.
  //   canonical perception snapshot(checkVisibility 기반)이 실제로 본 적만 visible로 인정한다.
  if (typeof getPerceptionSnapshot === 'function') {
    const snap = getPerceptionSnapshot(unit);
    const vis = snap && snap.nearestVisible;
    if (vis && vis.unit) return { x: vis.unit.x, y: vis.unit.y, type: 'visible', unitId: vis.unit.id };
  }
  if (mem.lastSeenEnemy) return { x: mem.lastSeenEnemy.x, y: mem.lastSeenEnemy.y, type: 'memory' };
  if (mem.lastHeardNoise) return { x: mem.lastHeardNoise.x, y: mem.lastHeardNoise.y, type: 'noise' };
  if (unit.lastDamageFrom) {
    return { x: unit.lastDamageFrom.x, y: unit.lastDamageFrom.y, type: 'damage' };
  }
  if (mem.dangerPoints && mem.dangerPoints.length > 0) {
    const dp = mem.dangerPoints[mem.dangerPoints.length - 1];
    return { x: dp.x, y: dp.y, type: 'danger' };
  }
  return null;
}

// 외부 API — AI가 엄폐 이동을 시도 (다른 시스템에서 호출)
//   성공 시 issueMoveOrder 실행 + true 반환
function aiTakeCover(unit) {
  if (!unit.alive || unit.isDead || unit.isDowned) return false;
  const threat = getThreatPosition(unit);
  if (!threat) return false;
  const best = findBestCover(unit, threat);   // [AI0-C1] canonical observed-surface slot 우선
  if (!best) return false;
  // [AI0-A] gateway 단일 경로 — 직접 movePath write 금지
  const res = issueMoveOrder(unit, best.spotX, best.spotY,
    { source: 'utility', actionType: 'takeCover', reason: best.slotId || null });
  if (unit.aiAction) unit.aiAction.targetSlotId = (res && res.accepted) ? (best.slotId || null) : null;
  return !!(res && res.accepted);
}

// 외부에서 소음 알림 — emitNoise에서 호출 가능 (옵셔널)
function aiNotifyNoise(unit, x, y, intensity, now) {
  const mem = ensureAIMemory(unit);
  // 더 강한 소음이거나 더 최근이면 업데이트
  if (!mem.lastHeardNoise || (mem.lastHeardNoise.intensity || 0) <= intensity) {
    mem.lastHeardNoise = { x, y, heardAt: now, intensity };
  }
}

// =============================================================
