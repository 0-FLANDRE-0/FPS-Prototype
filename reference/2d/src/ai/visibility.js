// 11. SIMULATION
// =============================================================
// === Stance-aware visibility check ===
//   wall / fullCover / halfCover + prone observer / prone target 규칙 통합
//   반환: { visible, confidence, reason, halfCoverPenetration, attachedHalfCoverObj }
// SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목13): 먼지 시야 디버프 래퍼 (벽/엄폐물 LOS 후순위 — 더 나쁘게만)
// [AI-PERF Phase1] 프로파일러 래퍼 — aiProfileOn일 때만 호출수/누적시간 기록. RNG 미소비, gameplay 불변.
// [CLOSURE 목표C] 함수별 시간 계측 — benchmark 모드에서만. 일반 플레이는 무비용(플래그 off 시 즉시 반환).
//   time[name] = { totalMs, calls, maxMs, samples[] } — samples는 제한 버퍼(p95용, 무제한 저장 금지).
const _AI_PROF_SAMPLE_CAP = 512;   // 함수별 p95 계산용 상한 (reservoir 아님, 순환 버퍼)
function _aiProfReset() {
  GAME.aiProfile = { calls: Object.create(null), time: Object.create(null), updateSamples: [], _selfMs: 0 };
}
function _aiProfCall(name) {
  if (!GAME.aiProfileOn || !GAME.aiProfile) return;
  GAME.aiProfile.calls[name] = (GAME.aiProfile.calls[name] || 0) + 1;
}
// 저(低)allocation 시간 기록 — closure 없이 시작 timestamp만 받아 종료 시 1회 기록.
//   고빈도 함수(checkVisibility)는 이 start/record 쌍으로 계측해 호출당 새 함수 생성을 피한다.
function _aiProfNow() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}
function _aiProfRecord(name, elapsedMs) {
  const p = GAME.aiProfile;
  if (!p) return;
  let e = p.time[name];
  if (!e) { e = p.time[name] = { totalMs: 0, calls: 0, maxMs: 0, samples: [], _si: 0 }; }
  e.totalMs += elapsedMs;
  e.calls++;
  if (elapsedMs > e.maxMs) e.maxMs = elapsedMs;
  // 순환 버퍼 — 최근 _AI_PROF_SAMPLE_CAP개만 유지 (메모리 상한)
  if (e.samples.length < _AI_PROF_SAMPLE_CAP) e.samples.push(elapsedMs);
  else { e.samples[e._si] = elapsedMs; e._si = (e._si + 1) % _AI_PROF_SAMPLE_CAP; }
}
// wrapper 형식 — 저빈도 함수용. 예외에도 기록이 깨지지 않도록 finally 사용. profiler OFF면 순수 통과.
function _aiProfTime(name, fn) {
  if (!GAME.aiProfileOn || !GAME.aiProfile) return fn();
  const t0 = _aiProfNow();
  try { return fn(); }
  finally { _aiProfRecord(name, _aiProfNow() - t0); }
}
function _aiProfReport() {
  const p = GAME.aiProfile;
  if (!p) return null;
  const s = p.updateSamples.slice().sort((a, b) => a - b);
  const pct = (arr, q) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(q * arr.length))] : 0;
  const timeOut = Object.create(null);
  for (const name in p.time) {
    const e = p.time[name];
    const sorted = e.samples.slice().sort((a, b) => a - b);
    timeOut[name] = {
      totalMs: +e.totalMs.toFixed(4),
      calls: e.calls,
      avgMs: e.calls ? +(e.totalMs / e.calls).toFixed(5) : 0,
      maxMs: +e.maxMs.toFixed(4),
      p95Ms: +pct(sorted, 0.95).toFixed(5),
    };
  }
  return {
    calls: Object.assign({}, p.calls),
    time: timeOut,
    simulation: {
      frames: s.length,
      avgMs: s.length ? +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(4) : 0,
      p50Ms: +pct(s, 0.50).toFixed(4), p95Ms: +pct(s, 0.95).toFixed(4),
      maxMs: s.length ? +s[s.length - 1].toFixed(4) : 0,
    },
    // 하위호환 — 기존 bench.js 필드
    updateCount: s.length,
    updateAvg: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0,
    updateP50: pct(s, 0.50), updateP95: pct(s, 0.95), updateMax: s.length ? s[s.length - 1] : 0,
  };
}
function checkVisibility(viewer, target) {
  if (!GAME.aiProfileOn) return _checkVisibilityImpl(viewer, target);
  _aiProfCall('checkVisibility');
  const _t0 = _aiProfNow();
  try { return _checkVisibilityImpl(viewer, target); }
  finally { _aiProfRecord('checkVisibility', _aiProfNow() - _t0); }
}
function _checkVisibilityImpl(viewer, target) {
  const r = _checkVisibilityBase(viewer, target);
  if (!r || !r.visible) return r;   // 이미 차단 → 먼지 계산 생략 (먼지는 벽 너머를 보이게 만들지 않음)
  if (typeof sampleDustAlongLOS === 'function' && typeof GAME !== 'undefined' && GAME.dustClouds && GAME.dustClouds.length) {
    const ds = sampleDustAlongLOS(viewer.x, viewer.y, target.x, target.y, {});
    if (ds && ds.opticalDepth > 0.001) {
      r.dust = { opticalDepth:+ds.opticalDepth.toFixed(3), averageDensity:+ds.averageDensity.toFixed(3), peakDensity:+ds.peakDensity.toFixed(3), dustedFraction:+ds.dustedFraction.toFixed(3), visibilityMul:+ds.visibilityMul.toFixed(3), blocksVision: ds.blocksVision };
      if (ds.blocksVision) return { visible: false, confidence: 0, reason: 'dust_blocked', dust: r.dust };
      // SIDE-VISUAL-UNIT-GRENADE-DUST-HOTFIX-1 (항목6): 명시적 가시거리 감소 (effectiveSightRange = base × visibilityMul)
      const _dd = Math.hypot(target.x - viewer.x, target.y - viewer.y);
      const _baseSight = (typeof getEffectiveVisionRange === 'function') ? getEffectiveVisionRange(viewer) : (viewer.sightRange || 480);
      const _effSight = _baseSight * ds.visibilityMul;
      r._effectiveSightRange = _effSight;
      if (_dd > _effSight) return { visible: false, confidence: 0, reason: 'dust_range_limited', dust: r.dust };
      r.confidence = Math.max(0, r.confidence * ds.visibilityMul);   // 식별 confidence 감소
      r._dustVisibilityMul = ds.visibilityMul;
    }
  }
  return r;
}
function _checkVisibilityBase(viewer, target) {
  // 섬광 — **관측자**가 눈이 멀면 아무것도 안 보인다. 먼지는 경로를 가리지만 이건 관측자를 가린다.
  if (typeof isFlashBlinded === 'function' && isFlashBlinded(viewer)) {
    return { visible: false, confidence: 0, reason: 'flash_blinded' };
  }
  const dx = target.x - viewer.x, dy = target.y - viewer.y;
  const d = Math.hypot(dx, dy);
  if (d > (getEffectiveVisionRange ? getEffectiveVisionRange(viewer) : (viewer.sightRange || 480))) return { visible: false, confidence: 0, reason: 'out_of_range' };
  const ang = Math.atan2(dy, dx);
  const _effArc = (typeof getEffectiveViewArc === 'function') ? getEffectiveViewArc(viewer) : (viewer.viewArc || Math.PI);
  if (Math.abs(angleDiff(ang, viewer.facing)) > _effArc / 2) {
    return { visible: false, confidence: 0, reason: 'out_of_fov' };
  }

  // 자세 정보
  const obsStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(viewer) : (viewer.stance || 'standing');
  const tgtStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(target) : (target.stance || 'standing');
  const obsProne = (obsStance === 'prone' || obsStance === 'goingProne');
  const tgtProne = (tgtStance === 'prone' || tgtStance === 'goingProne' || tgtStance === 'downed' || tgtStance === 'unconscious');

  const ATTACHED_DIST_PX = 1.2 * PX_PER_M_FALLBACK;
  const MIN_PEEK = 0.5 * PX_PER_M_FALLBACK;
  const MAX_PEEK = 2.5 * PX_PER_M_FALLBACK;
  const PEEK_SCALE = 0.45;

  // raycast — viewer → target 경로의 차폐물 탐색
  const nx = dx / d, ny = dy / d;
  let firstFullT = Infinity, firstFullKind = null;
  let firstHalfT = Infinity, firstHalfObj = null;
  if (typeof rayDistToWalls === 'function') {
    const w = rayDistToWalls(viewer.x, viewer.y, nx, ny, d);
    if (w && w.t < d) { firstFullT = w.t; firstFullKind = 'wall'; }
  }
  if (MAP_DATA && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
    for (const o of MAP_DATA.coverObjects) {
      const t = rayBoxT(viewer.x, viewer.y, nx, ny, o, d);
      if (t >= d) continue;
      if (isCoverBlocksVision(o)) {
        if (t < firstFullT) { firstFullT = t; firstFullKind = 'fullCover'; }
      } else {
        if (t < firstHalfT) { firstHalfT = t; firstHalfObj = o; }
      }
    }
  }

  // wall/fullCover 차단 (LOS X)
  if (firstFullT < d) {
    return { visible: false, confidence: 0, reason: firstFullKind === 'wall' ? 'wall_blocked' : 'fullcover_blocked' };
  }

  // halfCover 처리 — stance-aware
  if (firstHalfT < d) {
    const halfDistFromViewer = firstHalfT;
    const halfDistFromTarget = d - firstHalfT;

    // === 1) prone observer + halfCover 붙어있음 → 시야 차단 ===
    if (obsProne && halfDistFromViewer <= ATTACHED_DIST_PX) {
      return { visible: false, confidence: 0, reason: 'observer_prone_attached_halfcover_blocks_view' };
    }

    // === 2) target prone + halfCover 붙어있음 (target 쪽) → 직접 시야 차단 ===
    if (tgtProne && halfDistFromTarget <= ATTACHED_DIST_PX) {
      return {
        visible: false, confidence: 0,
        reason: 'target_prone_attached_halfcover_hidden',
        halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj,
      };
    }

    // === 3) prone observer + detached halfCover → peekDepth 제한 ===
    if (obsProne && halfDistFromViewer > ATTACHED_DIST_PX) {
      const peekDepth = Math.max(MIN_PEEK,
        Math.min(MAX_PEEK, MIN_PEEK + (halfDistFromViewer - ATTACHED_DIST_PX) * PEEK_SCALE));
      // target이 halfCover 반대편 peekDepth 안에 있어야 식별 가능
      if (halfDistFromTarget > peekDepth) {
        return { visible: false, confidence: 0, reason: 'observer_prone_peek_depth_exceeded' };
      }
      // target이 halfCover 부근에 붙어 있어야 상체 노출됨
      if (halfDistFromTarget > ATTACHED_DIST_PX) {
        return { visible: false, confidence: 0, reason: 'target_detached_no_upper_body_exposure' };
      }
      // target이 standing/crouched이면 상체 노출로 제한적 식별
      if (tgtStance === 'standing') {
        return { visible: true, confidence: 0.50, reason: 'observer_prone_detached_peek_standing',
                 halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj };
      }
      if (tgtStance === 'crouched') {
        return { visible: true, confidence: 0.30, reason: 'observer_prone_detached_peek_crouched',
                 halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj };
      }
      return { visible: false, confidence: 0, reason: 'observer_prone_target_too_low' };
    }

    // === 4) standing/crouched observer + halfCover ===
    //   target이 halfCover 부근에 붙어 있으면 상체 노출
    if (halfDistFromTarget <= ATTACHED_DIST_PX) {
      if (tgtStance === 'standing') {
        return { visible: true, confidence: 0.85, reason: 'target_standing_upper_body_exposed',
                 halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj };
      }
      if (tgtStance === 'crouched') {
        return { visible: true, confidence: 0.55, reason: 'target_crouched_upper_body_partially_exposed',
                 halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj };
      }
      if (tgtStance === 'pinned') {
        return { visible: true, confidence: 0.25, reason: 'target_pinned_low_exposure',
                 halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj };
      }
      // tgtProne은 이미 위에서 처리됨 (return)
    }
    // halfCover 중간이지만 target이 떨어져 있음 — halfCover가 시야 통과 가능 (3D 추상화)
    return { visible: true, confidence: 0.75, reason: 'halfcover_partial',
             halfCoverPenetration: true, attachedHalfCoverObj: firstHalfObj };
  }

  // 차폐물 없음 — 명확히 보임
  return { visible: true, confidence: 1.0, reason: 'clear_los' };
}

function canSee(viewer, target) {
  const r = checkVisibility(viewer, target);
  // 디버그용 저장 — debugUtility 또는 debugVisibility 켜져 있을 때
  if ((GAME.debugUtility || GAME.debugVisibility) && viewer.id === GAME.selectedId) {
    viewer._lastCanSeeResult = r;
  }
  return r.visible;
}
// ════════════════════════════════════════════════════════════════════════════
// [AI-PERF Phase2] Canonical Perception Snapshot — 한 유닛의 한 tick 시야 판정을 1회만 계산.
//   같은 tick의 모든 소비자(기억 갱신 / 표적 선택 / utility context / 경계 / 디버그)가 공유한다.
//   판정 자체는 반드시 canonical checkVisibility(자세·half cover·먼지·confidence·FOV 유지)를 사용한다.
//   새 RNG 미소비 — checkVisibility는 결정적이므로 결과 캐싱은 gameplay/시드 결정성에 영향 없음.
//   stamp = GAME.gameTime (한 tick 동안 불변) — stamp가 같으면 재사용, 다르면 재계산.
// ════════════════════════════════════════════════════════════════════════════
function getPerceptionSnapshot(unit) {
  if (!GAME.aiProfileOn) return _getPerceptionSnapshotImpl(unit);
  _aiProfCall('getPerceptionSnapshot');
  const _t0 = _aiProfNow();
  try { return _getPerceptionSnapshotImpl(unit); }
  finally { _aiProfRecord('getPerceptionSnapshot', _aiProfNow() - _t0); }
}
function _getPerceptionSnapshotImpl(unit) {
  const stamp = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  const cached = unit._perception;
  if (cached && cached.stamp === stamp) return cached;   // 같은 tick — 재사용
  // 새 tick — 1회 계산
  const enemies = [];
  let nearestVisible = null, nearestVisibleDist = Infinity;
  let visibleCount = 0;
  if (Array.isArray(UNITS)) {
    for (const t of UNITS) {
      if (t === unit) continue;
      if (t.team === unit.team) continue;
      if (t.isDead) continue;
      if (!t.alive && !t.isDowned) continue;
      const dx = t.x - unit.x, dy = t.y - unit.y;
      const dist = Math.hypot(dx, dy);
      // canonical 판정 — 자세/차폐/먼지/FOV/confidence 전부 반영
      const vis = checkVisibility(unit, t);
      const rec = {
        unit: t, id: t.id,
        visible: !!(vis && vis.visible),
        confidence: (vis && vis.confidence != null) ? vis.confidence : (vis && vis.visible ? 1.0 : 0),
        reason: vis ? vis.reason : 'unknown',
        dust: vis ? vis.dust : null,
        dist,
        angle: Math.atan2(dy, dx),
      };
      enemies.push(rec);
      if (rec.visible) {
        visibleCount++;
        if (dist < nearestVisibleDist) { nearestVisibleDist = dist; nearestVisible = rec; }
      }
    }
  }
  const snap = {
    stamp, observerId: unit.id,
    enemies,                       // 검사한 모든 적 (visible 여부 포함)
    visibleCount,
    nearestVisible,                // 가장 가까운 visible 적 rec (없으면 null)
    nearestVisibleDist,
  };
  unit._perception = snap;
  return snap;
}
// 편의 접근자 — visible 적 unit 배열
function getVisibleEnemiesFromSnapshot(unit) {
  const snap = getPerceptionSnapshot(unit);
  const out = [];
  for (const rec of snap.enemies) if (rec.visible) out.push(rec.unit);
  return out;
}
function inFireArc(unit, target) {
  const ang = Math.atan2(target.y - unit.y, target.x - unit.x);
  return Math.abs(angleDiff(ang, unit.facing)) <= unit.fireArc / 2;
}
// 표적의 위협도 — 높을수록 위험. AI는 가장 높은 표적을 우선 사격.
//   active/wounded 사격 가능 + 나를 보는/사격 중 = 최고
//   conscious downed = 중간 (반격 가능성)
//   unconscious downed = 낮음 (확인사격 대상)
//   dead = 사격 대상 X
function computeThreatScore(unit, t) {
  if (t.isDead) return -1;            // 절대 사격 X
  // 기본 점수
  let s = 0;
  const d = dist(unit.x, unit.y, t.x, t.y);
  // 상태별 기본값 — active/wounded 가장 높음
  if (!t.isDowned) {
    s += 1000;     // active/wounded
    if (t.combatState === 'wounded') s -= 50;   // 약간 감점 (덜 위험)
  } else if (t.conscious) {
    // conscious downed — 팔이 살아있고 사격 가능하면 중간 위협
    const armsOk = !areArmsFunctionallyCritical(t);
    const hasAmmo = (t.magAmmo > 0 || t.reserveAmmo > 0);
    if (armsOk && hasAmmo) s += 500;   // 반격 가능
    else                    s += 250;   // 반격 약함
  } else {
    // unconscious downed — 위협 매우 낮음 (확인사격 대상)
    s += 50;
  }
  // 무기 사용 불가 — 큰 감점
  if (areArmsFunctionallyCritical(t)) s -= 200;
  // 탄약 없음 — 감점
  if (t.magAmmo === 0 && t.reserveAmmo === 0) s -= 150;
  // 가까운 거리 가산점 (최대 +200, 1m 이내까지)
  const distGain = Math.max(0, 200 - d * 0.6);
  s += distGain;
  // 나를 보고 있고 사격 중 — 즉시 위협
  if (t.currentTarget && t.currentTarget.id === unit.id) s += 250;
  // 현재 표적이면 약간 유지 보너스 — 표적 흔들림 방지
  if (unit.currentTarget && t.id === unit.currentTarget.id) s += 80;
  return s;
}

function pickTarget(unit) {
  if (!GAME.aiProfileOn) return _pickTargetImpl(unit);
  _aiProfCall('pickTarget');
  const _t0 = _aiProfNow();
  try { return _pickTargetImpl(unit); }
  finally { _aiProfRecord('pickTarget', _aiProfNow() - _t0); }
}
function _pickTargetImpl(unit) {
  // passive 표적(사격장)은 스스로 사격하지 않는다
  if (unit.role === 'passive') return null;
  // downed unconscious / dead 본인은 사격 안 함
  if (unit.isDead || (unit.isDowned && !unit.conscious)) return null;

  // 후보 수집 — 가시성 있고 같은 팀 아님
  let activeBest = null, activeBestScore = -Infinity;        // active/wounded
  let consciousDownBest = null, consciousDownScore = -Infinity;  // conscious downed
  let unconsciousBest = null, unconsciousScore = -Infinity;   // unconscious downed (확인사격용)
  // [AI-PERF Phase2] canonical perception snapshot 공유 — pickTarget이 별도 시야 스캔을 하지 않음.
  const _snap = getPerceptionSnapshot(unit);
  for (const _rec of _snap.enemies) {
    const t = _rec.unit;
    if (t.team === unit.team) continue;
    if (t.isDead) continue;
    if (!t.alive && !t.isDowned) continue;
    if (unit.team === 'friend' && t.role === 'passive') continue;
    // === stance-aware visibility (snapshot에서 — canonical checkVisibility 결과) ===
    const vis = { visible: _rec.visible, confidence: _rec.confidence, reason: _rec.reason };
    if (!vis.visible) continue;
    let score = computeThreatScore(unit, t);
    // visibility confidence — 낮을수록 우선순위 감소
    if (vis.confidence < 1.0) score *= (0.4 + vis.confidence * 0.6);   // 0.4~1.0 범위
    // 2A-6.2: 바이저 시야 제약 — 주변시/근거리 인지 저하 시 표적 인지도 감소
    const visorDet = getVisorDetectionMul(unit);
    if (visorDet < 1.0) score *= (0.55 + visorDet * 0.45);   // 0.55~1.0 범위 (과하지 않게)
    t._lastVisConfidence = vis.confidence;
    t._lastVisReason = vis.reason;
    if (!t.isDowned) {
      if (score > activeBestScore) { activeBestScore = score; activeBest = t; }
    } else if (t.conscious) {
      if (score > consciousDownScore) { consciousDownScore = score; consciousDownBest = t; }
    } else {
      if (score > unconsciousScore) { unconsciousScore = score; unconsciousBest = t; }
    }
  }
  // 우선순위 적용:
  //   1) active/wounded
  //   2) conscious downed (반격 가능)
  //   3) unconscious downed — 확인사격 조건 만족 시만
  if (activeBest) return activeBest;
  if (consciousDownBest) return consciousDownBest;
  // 확인사격 — 다른 위협 없음 + 거리 OK + 탄약 충분
  if (unconsciousBest) {
    const w = WEAPONS[unit.weaponId];
    const d = dist(unit.x, unit.y, unconsciousBest.x, unconsciousBest.y);
    const ammoOk = (unit.magAmmo > 4 || (unit.magAmmo > 0 && unit.reserveAmmo > 0));
    const distOk = (!w || d <= w.range * 0.7);
    if (ammoOk && distOk) {
      // 한 번만 로그 — currentTarget이 바뀔 때
      if (!unit.currentTarget || unit.currentTarget.id !== unconsciousBest.id) {
        log(`[${unit.name}] 쓰러진 표적 확인사격`, 'info');
      }
      return unconsciousBest;
    }
  }
  return null;
}
// =============================================================
