// 소음 이벤트 emit
// =============================================================
function emitNoise(x, y, opts) {
  const type = (opts && opts.type) || 'generic';
  const prof = NOISE_TYPE_PROFILE[type] || NOISE_TYPE_PROFILE.generic;
  const loud = (opts && opts.loudness != null) ? opts.loudness : prof.loudness;
  const rad  = (opts && opts.radius   != null) ? opts.radius   : prof.radius;
  // intensityMul 처리 — 수류탄 폭발같이 큰 소음
  const intensityMul = (opts && opts.intensityMul) || 1.0;
  GAME.noiseEvents.push({
    x, y,
    radius: rad * intensityMul * (loud > 0 ? Math.max(0.5, loud / Math.max(0.01, prof.loudness)) : 1.0),
    loudness: loud * intensityMul,
    type,
    team: (opts && opts.team) || null,
    sourceUnitId: (opts && opts.sourceUnitId) || null,
    time: GAME.gameTime || 0,
    decayTime: (opts && opts.decay) || prof.decay,
    confidence: prof.conf,
    _processed: new Set(),   // 이미 들은 유닛 id들 (중복 방지)
  });
}

// 매 프레임 처리: 만료된 소음 제거 + 각 유닛이 적팀 소음을 들었는지 판정
function tickNoiseEvents(dt) {
  const list = GAME.noiseEvents;
  if (!list || list.length === 0) return;
  const now = GAME.gameTime || 0;
  // 각 유닛이 새 소음을 듣는지 판정
  for (const u of UNITS) {
    if (u.isDead) continue;
    if (u.isDowned && !u.conscious) continue;
    for (const n of list) {
      if (!n.team || n.team === u.team) continue;
      if (n._processed.has(u.id)) continue;
      const dx = u.x - n.x, dy = u.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d > n.radius) { n._processed.add(u.id); continue; }
      // 벽 감쇠 — 직선 LOS가 막히면 radius 60%로 축소된 거리 비교
      const wallBlocked = !losClear(n.x, n.y, u.x, u.y);
      const effRange = wallBlocked ? n.radius * 0.55 : n.radius;
      if (d > effRange) { n._processed.add(u.id); continue; }
      // 감지 확률 — 거리/loudness 기반
      const distFactor = Math.max(0, 1 - d / effRange);
      let pHear = Math.min(1, 0.35 + 0.65 * distFactor * Math.max(0.3, n.loudness));
      // suppression/pain ↑ 시 감지 ↓
      if (u.suppression > 50) pHear *= 0.7;
      if (u.pain > 60) pHear *= 0.75;
      if (wallBlocked) pHear *= 0.7;
      // 섬광 — 이명 중에는 거의 못 듣는다
      if (typeof isFlashDeafened === 'function' && isFlashDeafened(u)) pHear *= 0.12;
      if (Math.random() < pHear) {
        // 들음 — 위치 오차 추가
        let posErr = 8 + (1 - distFactor) * 35;   // 가까우면 작음, 멀면 큼
        if (wallBlocked) posErr *= 1.6;
        if (n.type.startsWith('footstep') || n.type === 'treatment') posErr *= 1.3;
        const angErr = (Math.random() - 0.5) * Math.PI * 2;
        const dErr = Math.random() * posErr;
        const hx = n.x + Math.cos(angErr) * dErr;
        const hy = n.y + Math.sin(angErr) * dErr;
        // 더 신뢰도 높은 lastHeard만 갱신 (기존이 훨씬 높으면 유지)
        const newConf = n.confidence * (0.6 + 0.4 * distFactor) * (wallBlocked ? 0.7 : 1.0);
        const cur = u.lastHeardNoise;
        if (!cur || cur.confidence < newConf || (now - cur.time) > 3.0) {
          u.lastHeardNoise = {
            x: hx, y: hy,
            time: now,
            confidence: newConf,
            type: n.type,
            sourceTeam: n.team,
          };
          // [HF1] sound evidence — 방향/거리대만 저장하고 정확 좌표는 승격하지 않는다
          if (n._evId == null) n._evId = 'noise' + (++_threatEvidenceSeq);
          let _sDir = Math.atan2(n.y - u.y, n.x - u.x);
          let _sAngUnc = Math.min(1.2, 0.20 + (1 - distFactor) * 0.55 + (wallBlocked ? 0.30 : 0));
          // [AI0-B] 이미 시각으로 아는 portal을 통해 들어온 소리면 방향을 그 portal로 연결한다.
          //   모르는 portal이면 ID를 노출하지 않고 불확실성만 키운다(소리로 geometry를 배우지 않음).
          const _arr = resolveSoundArrivalPortal(u, n.x, n.y);
          if (_arr.portalKnown && _arr.arrivalDirection != null) {
            _sDir = _arr.arrivalDirection;
            _sAngUnc = Math.min(1.2, _sAngUnc * 0.6);
          } else if (!_arr.sameRegion) {
            _sAngUnc = Math.min(1.5, _sAngUnc + 0.25);
          }
          const _sEv = recordThreatEvidence(u, { kind: 'sound', positionKnown: false,
            direction: _sDir, angularUncertainty: _sAngUnc,
            distanceMin: Math.max(0, d * 0.7), distanceMax: d * 1.4,
            confidence: newConf, danger: newConf * (n.type === 'gunshot' ? 1.0 : 0.6),
            sourceEventId: n._evId, ttl: 10 });
          if (_sEv) {
            _sEv.arrivalPortalId = _arr.arrivalPortalId;   // 모르는 portal이면 null
            _sEv.portalKnown = !!_arr.portalKnown;
            _sEv.wallBlocked = !!wallBlocked;
          }
          // 아는 portal 너머 적 총성 → portal danger
          if (_arr.portalKnown && n.type === 'gunshot' && n.team !== u.team) {
            recordPortalDanger(u, _arr.arrivalPortalId, Math.min(1, 0.5 + newConf * 0.5), _sEv ? _sEv.evidenceId : null);
          }
          // 신규 AI 메모리에도 동기화 (보조 시스템)
          if (typeof ensureAIMemory === 'function') {
            const mem = ensureAIMemory(u);
            mem.lastHeardNoise = { x: hx, y: hy, heardAt: now, intensity: n.loudness || 0.5, type: n.type };
            // === 총성 위치 — 단순 조사 대상이 아니라 적 추정 위치 + 위험구역 ===
            if (n.type === 'gunshot' && n.team !== u.team) {
              const radiusPx = (5 + (n.loudness || 0.5) * 3) * PX_PER_M_FALLBACK;
              mem.lastHeardGunshot = { x: hx, y: hy, heardAt: now, confidence: newConf };
              mem.suspectedEnemyPos = { x: hx, y: hy, time: now, confidence: newConf };
              if (!mem.noiseDangerZones) mem.noiseDangerZones = [];
              let merged = false;
              for (const z of mem.noiseDangerZones) {
                if (Math.hypot(z.x - hx, z.y - hy) < radiusPx * 0.6) {
                  z.x = hx; z.y = hy; z.time = now; z.radius = Math.max(z.radius, radiusPx);
                  merged = true; break;
                }
              }
              if (!merged) {
                mem.noiseDangerZones.push({ x: hx, y: hy, radius: radiusPx, time: now, sourceType: 'gunshot' });
                while (mem.noiseDangerZones.length > 6) mem.noiseDangerZones.shift();
              }
              // 위험 섹터 — 소리가 난 **방**이 뜨겁다. hx/hy는 이미 오차가 실린 추정 위치다.
              if (typeof markRoomDanger === 'function' && typeof roomAt === 'function') {
                const nr = roomAt(hx, hy);
                if (nr) markRoomDanger(u, nr, DANGER_W_GUNSHOT, now);
              }
              // === 입구 너머의 위협이면 dangerousEntrance로도 등록 ===
              if (typeof getAreaInfo === 'function') {
                const myArea = getAreaInfo(u.x, u.y);
                // 내 area에서 보이는 possibleEntrance 중 gunshot 방향과 가까운 것
                const gunshotAng = Math.atan2(hy - u.y, hx - u.x);
                let matchedEntrance = null;
                for (const e of (myArea.possibleEntrances || [])) {
                  if (Math.abs(angleDelta(e.angle, gunshotAng)) < Math.PI / 4) {
                    matchedEntrance = e; break;
                  }
                }
                // 같은 area인가? — 아니면 입구 너머
                const sameArea = (typeof isInSameArea === 'function') ? isInSameArea(u.x, u.y, hx, hy) : false;
                if (!sameArea && matchedEntrance) {
                  if (!mem.dangerousEntrances) mem.dangerousEntrances = [];
                  // 같은 입구 갱신
                  let merged2 = false;
                  for (const de of mem.dangerousEntrances) {
                    if (Math.abs(angleDelta(de.angle, matchedEntrance.angle)) < Math.PI / 6) {
                      de.x = matchedEntrance.x; de.y = matchedEntrance.y;
                      de.angle = matchedEntrance.angle;
                      de.lastSeenAt = now;
                      de.dangerLevel = Math.min(1.0, (de.dangerLevel || 0.3) + 0.3);
                      de.source = 'gunshot';
                      merged2 = true; break;
                    }
                  }
                  if (!merged2) {
                    mem.dangerousEntrances.push({
                      x: matchedEntrance.x, y: matchedEntrance.y,
                      angle: matchedEntrance.angle,
                      source: 'gunshot',
                      confidence: newConf,
                      dangerLevel: 0.6,
                      lastSeenAt: now,
                    });
                    while (mem.dangerousEntrances.length > 6) mem.dangerousEntrances.shift();
                  }
                }
              }
            }
          }
          // 적 AI는 들은 직후 intent 갱신 (있는 그대로 — engage 등 더 높은 우선순위는 다른 곳에서 처리)
          if (u.team === 'enemy') maybeReactToNoise(u, n, d);
        }
      }
      n._processed.add(u.id);
    }
  }
  // 만료된 소음 제거
  for (let i = list.length - 1; i >= 0; i--) {
    if (now - list[i].time > list[i].decayTime) list.splice(i, 1);
  }
}

// lastHeardNoise 시간 경과 confidence decay
function tickLastHeardNoise(unit, dt) {
  if (!unit.lastHeardNoise) return;
  unit.lastHeardNoise.confidence -= dt * 0.08;
  if (unit.lastHeardNoise.confidence <= 0.05) unit.lastHeardNoise = null;
}

// 적 AI 반응 — 소음 종류/거리별로 intent 또는 threatDirection
//   visible/lastKnown이 더 우선이므로 여기선 약한 신호만 설정.
function maybeReactToNoise(unit, noise, dist) {
  if (unit.isDead) return;
  if (unit.isDowned && !unit.conscious) return;
  // passive target은 소음 반응 안 함 (테스트 사격장 표적)
  if (unit.role === 'passive') return;
  // 이미 교전 중이거나 가까운 visible 적이 있으면 무시
  if (unit.currentTarget) return;
  // 위협 방향 — 항상 갱신 (가벼운 표시)
  const ang = Math.atan2(noise.y - unit.y, noise.x - unit.x);
  if (!unit.threatDirection || (noise.type === 'gunshot' || noise.type === 'impact')) {
    unit.threatDirection = ang;
    unit.threatTimer = THREAT_DURATION * 0.5;
  }
  // 거리/종류별 intent
  //   gunshot/impact 거리 기준 — 맵이 큰 만큼 단계별로 분리:
  //     < 240px (12m): 즉시 경계 (guardNoise)
  //     < 600px (30m): 조사 이동 (investigateNoise)
  //     >= 600px:      방향 경계만 (threatDirection)
  if (noise.type === 'gunshot' || noise.type === 'impact') {
    if (dist < 240) {
      unit.aiIntent = 'guardNoise';
    } else if (dist < 600) {
      unit.aiIntent = 'investigateNoise';
    }
    // 매우 먼 gunshot은 방향만 (threatDirection)
  } else if (noise.type === 'footstep_run' || noise.type === 'footstep_drag' || noise.type === 'drag') {
    if (dist < 120) unit.aiIntent = 'guardNoise';
    else if (dist < 280) unit.aiIntent = 'guardNoise';
  } else if (noise.type === 'footstep_walk' || noise.type === 'treatment') {
    if (dist < 80) unit.aiIntent = 'guardNoise';
  }
  // crawl/reload는 경계만 (threatDirection만)
  if (GAME.debugNoise && unit.team === 'enemy') {
    log(`[${unit.name}] 소음 감지 (${noise.type}, ${(dist/PX_PER_M).toFixed(1)}m)`, 'info');
  }
}

const THREAT_DURATION        = 4.0;   // 초 — threatDirection 유효 시간
const NEAR_MISS_RADIUS       = 38;    // 픽셀 — ray가 이 안을 지나가면 nearMiss
const SUPPRESS_FIRE_COOLDOWN = 2.5;   // 초 — 견제사격 최소 간격
const SUPPRESS_CONFIDENCE_MIN = 0.45; // 견제사격 최소 confidence

// 보이는 적마다 lastKnown 갱신 (시간/위치/confidence 1.0)
//   추가: visible 적 방향을 threatDirection으로도 등록 — 사격 받기 전이라도
//   AI가 위협 방향을 알고 행동할 수 있게 한다.
function updateLastKnownFromVisibility(unit) {
  if (!GAME.aiProfileOn) return _updateLastKnownFromVisibilityImpl(unit);
  _aiProfCall('updateLastKnownFromVisibility');
  const _t0 = _aiProfNow();
  try { return _updateLastKnownFromVisibilityImpl(unit); }
  finally { _aiProfRecord('updateLastKnownFromVisibility', _aiProfNow() - _t0); }
}
function _updateLastKnownFromVisibilityImpl(unit) {
  let nearestThreatDist = Infinity;
  let nearestThreatX = null, nearestThreatY = null;
  // [AI-PERF Phase2] canonical perception snapshot 공유 — 적별 checkVisibility 재계산 없음.
  const _snap = getPerceptionSnapshot(unit);
  for (const _rec of _snap.enemies) {
    const t = _rec.unit;
    if (!t.alive || t.team === unit.team) continue;
    if (t.isDead || t.isDowned) continue;
    if (_rec.visible) {
      const prev = unit.lastKnownEnemies[t.id];
      // 이전 좌표가 최근이면 속도 추정
      let vx = 0, vy = 0;
      if (prev && (GAME.gameTime - prev.time) > 1e-3 && (GAME.gameTime - prev.time) < 1.0) {
        const dtp = GAME.gameTime - prev.time;
        vx = (t.x - prev.x) / dtp; vy = (t.y - prev.y) / dtp;
      }
      // [CLOSURE 목표B] snapshot의 관측 confidence를 memory에 전달 — 고정 1.0 금지.
      //   visibilityConfidence = 이번 관측 자체의 품질(먼지/제한노출/장거리로 낮아질 수 있음).
      //   memory.confidence     = 기억 위치 신뢰도. 위치 자체는 지금 보이므로 정확하나(uncertaintyRadius=8),
      //                           관측 품질이 낮으면 완전 확신으로 뛰지 않도록 관측 품질로 상한을 둔다.
      //   snapshot이 유효 숫자(0~1)를 줄 때만 사용하고, 아니면 안전 fallback(1.0). checkVisibility 재호출 없음.
      const _cf = _rec.confidence;
      const seenConfidence = (typeof _cf === 'number' && isFinite(_cf)) ? Math.max(0, Math.min(1, _cf)) : 1.0;
      unit.lastKnownEnemies[t.id] = {
        id: t.id, x: t.x, y: t.y,
        time: GAME.gameTime, confidence: seenConfidence,
        age: 0, uncertaintyRadius: 8,            // 막 본 위치 — 위치는 정확 (관측 품질과 별개)
        lastSeenVx: vx, lastSeenVy: vy,
        lastSeenFacing: (t.facing != null ? t.facing : null),
        visibilityConfidence: seenConfidence,    // 이번 관측 자체의 품질
        observationConfidence: seenConfidence,   // [0.38.2] decay 기준값 — confidence는 이 값에서 감쇠
        source: 'visible',
      };
      // [HF1] canonical visible contact → threat evidence (additive, 소비자 재배선은 AI0-D)
      recordThreatEvidence(unit, { kind: 'visual', positionKnown: true, x: t.x, y: t.y,
        confidence: 1.0, danger: seenConfidence, sourceUnitId: t.id, sourceEventId: 'v' + t.id, ttl: 6 });
      const dd = Math.hypot(t.x - unit.x, t.y - unit.y);
      if (dd < nearestThreatDist) {
        nearestThreatDist = dd;
        nearestThreatX = t.x; nearestThreatY = t.y;
      }
    }
  }
  // visible 적이 있으면 가장 가까운 적을 위협 방향으로
  if (nearestThreatX != null) {
    unit.threatDirection = Math.atan2(nearestThreatY - unit.y, nearestThreatX - unit.x);
    unit.threatTime = GAME.gameTime;
  }
}

// confidence 시간 감쇠 — 호출당 dt
function decayMemory(unit, dt) {
  for (const id in unit.lastKnownEnemies) {
    const m = unit.lastKnownEnemies[id];
    const elapsed = GAME.gameTime - m.time;
    m.age = elapsed;
    // [0.38.2 Fix1] decay는 마지막 관측 품질(observationConfidence)에서 시작 — 항상 1.0 시작 금지.
    //   재관측 없이 confidence가 상승하지 않고, observationConfidence를 초과하지 않는다.
    const _obs = (typeof m.observationConfidence === 'number' && isFinite(m.observationConfidence)) ? m.observationConfidence : (typeof m.visibilityConfidence === 'number' ? m.visibilityConfidence : 1.0);
    const _timeDecay = Math.max(0, Math.min(1, 1 - elapsed / LAST_KNOWN_DURATION));
    m.confidence = Math.max(0, _obs * _timeDecay);
    // SIDE-FIRE-1B §6.1: 시간이 지날수록 불확실 구역 확대 (이동 가능성 포함).
    //   0~1s 정확, 1~3s 작은 구역, 3~8s 넓은 위험구역, 이후 suspicion.
    const speed = Math.hypot(m.lastSeenVx || 0, m.lastSeenVy || 0);
    const drift = Math.min(180, (speed * 0.5 + 14) * Math.max(0, elapsed - 0.6));
    m.uncertaintyRadius = Math.min(200, 8 + drift);
    if (m.confidence <= 0.05) delete unit.lastKnownEnemies[id];
  }
  // 죽은 적은 즉시 제거
  for (const id in unit.lastKnownEnemies) {
    const tgt = UNITS.find(u => u.id === parseInt(id, 10));
    if (!tgt || !tgt.alive) delete unit.lastKnownEnemies[id];
  }
}

// 가장 신뢰할만한 last known — confidence × 거리 × uncertainty/age penalty (SIDE-FIRE-1B §6.3)
function pickBestLastKnown(unit) {
  let best = null, bestScore = -1;
  for (const id in unit.lastKnownEnemies) {
    const m = unit.lastKnownEnemies[id];
    if (m.confidence < 0.12) continue;                       // 너무 흐린 기억 제외
    if ((m.uncertaintyRadius || 0) > 150) continue;          // 너무 불확실하면 견제 후보 제외
    const d = dist(unit.x, unit.y, m.x, m.y);
    const distScore = 1 / (1 + d / 300);
    const uncPenalty = 1 / (1 + (m.uncertaintyRadius || 0) / 60);
    const agePenalty = 1 / (1 + (m.age || 0) / 8);
    const score = m.confidence * distScore * uncPenalty * agePenalty;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// =============================================================
// SIDE-MEMORY-1A: 적 기억 해석 계층 — lastKnown을 AI 행동용으로 분류/예측
// =============================================================
// 숙련도별 예상 lead 시간 (초)
function _memLeadTime(unit) {
  const t = (unit.skill && unit.skill.presetId) || 'regular';
  return ({ recruit: 0.0, regular: 0.5, veteran: 0.8, elite: 1.0 })[t] != null
       ? ({ recruit: 0.0, regular: 0.5, veteran: 0.8, elite: 1.0 })[t] : 0.5;
}
// 가장 위협적인 기억 (pickBestLastKnown 재사용 — confidence/거리/uncertainty/age 가중)
function getBestThreatMemory(unit) {
  if (!unit.lastKnownEnemies) return null;
  return pickBestLastKnown(unit);
}
// 기억 분류 — PRECISE_RECENT / AREA_SUSPECTED / STALE_SUSPICION / INVALID
function classifyEnemyMemory(memory) {
  if (!memory) return 'INVALID';
  const age = memory.age || 0;
  const conf = memory.confidence || 0;
  const unc = memory.uncertaintyRadius || 0;
  if (conf < 0.12 || age > 10) return 'INVALID';
  if (age <= 1.0 && conf >= 0.7 && unc <= 24) return 'PRECISE_RECENT';
  if (age <= 4.0 && conf >= 0.4 && unc <= 90) return 'AREA_SUSPECTED';
  return 'STALE_SUSPICION';
}
function buildEnemyMemoryContext(unit, memory) {
  const cls = classifyEnemyMemory(memory);
  return {
    memory, memoryClass: cls,
    confidence: memory ? (memory.confidence || 0) : 0,
    uncertaintyRadius: memory ? (memory.uncertaintyRadius || 0) : 0,
    age: memory ? (memory.age || 0) : 0,
    hasVelocity: !!(memory && (Math.abs(memory.lastSeenVx || 0) + Math.abs(memory.lastSeenVy || 0) > 4)),
  };
}
// hard wall이 두 점 사이를 완전히 가로막는가 (예상 위치가 벽 너머로 새지 않게)
function _memHardWallBlocks(ax, ay, bx, by) {
  return (typeof _hardWallBetween === 'function') ? _hardWallBetween(ax, ay, bx, by) : false;
}
// 예상 위치 후보 — lastKnown / shortLead / uncertaintyOffset (벽 너머로 새지 않도록 검증)
function buildPredictedEnemyPoints(unit, memory) {
  if (!memory) return [];
  const pts = [];
  const lkx = memory.x, lky = memory.y;
  pts.push({ kind: 'lastKnown', x: lkx, y: lky });
  // shortLead — velocity * leadTime (숙련도 기반, 짧게만)
  const lead = _memLeadTime(unit);
  const speed = Math.hypot(memory.lastSeenVx || 0, memory.lastSeenVy || 0);
  if (lead > 0 && speed > 4) {
    const lx = lkx + (memory.lastSeenVx || 0) * lead;
    const ly = lky + (memory.lastSeenVy || 0) * lead;
    // 예상 경로가 hard wall을 통과하면 무효 (맵핵 방지) — lastKnown→lead 직선 검사
    if (!_memHardWallBlocks(lkx, lky, lx, ly)) pts.push({ kind: 'shortLead', x: lx, y: ly });
  }
  // uncertaintyOffset — 구역 긁기 (작은 오프셋)
  const unc = memory.uncertaintyRadius || 0;
  if (unc > 16) {
    const ang = Math.random() * Math.PI * 2;
    const r = unc * (0.3 + Math.random() * 0.5);
    const ox = lkx + Math.cos(ang) * r, oy = lky + Math.sin(ang) * r;
    if (!_memHardWallBlocks(lkx, lky, ox, oy)) pts.push({ kind: 'uncertaintyOffset', x: ox, y: oy });
  }
  return pts;
}

// =============================================================
// SIDE-FIRE-2A: Memory Fire Arc Gate — 기억 기반 사격은 총구가 대략 맞아야 발사
// =============================================================
// 숙련도별 memory fireArc (라디안) — point target은 visible보다 엄격
function _memoryFireArc(unit, intent) {
  const t = (unit.skill && unit.skill.presetId) || 'regular';
  // 기본 정렬 허용폭 (반각). recruit는 느슨, elite는 엄격.
  let base = ({ recruit: 0.55, regular: 0.32, veteran: 0.24, elite: 0.20 })[t];
  if (base == null) base = 0.32;
  if (intent === 'SUPPRESSIVE_FIRE') base *= 1.5;          // 견제는 약간 넓게
  else if (intent === 'LAST_KNOWN_FIRE') base *= 1.1;
  // BARRIER_PROBE/WALL_PENETRATION/EXPECTED는 base 그대로(정렬 중요)
  return base;
}
function updatePreferredWatchAngleFromMemory(shooter, tx, ty) {
  if (!shooter.aiMemory) return;
  shooter.aiMemory.preferredWatchAngle = Math.atan2(ty - shooter.y, tx - shooter.x);
}
// 총구 정렬 게이트 — 맞으면 ready, 아니면 turning(보류). diff(도) 기록.
function canFireAtMemoryPoint(shooter, tx, ty, fcCtx) {
  const want = Math.atan2(ty - shooter.y, tx - shooter.x);
  const diff = Math.abs(angleDiff(want, shooter.facing || 0));
  const arc = _memoryFireArc(shooter, fcCtx ? fcCtx.fireIntent : null);
  if (fcCtx) { fcCtx.memoryFacingDiff = diff * 180 / Math.PI; fcCtx.memoryFireArc = arc * 180 / Math.PI; }
  return { ready: diff <= arc, diff, arc };
}

// =============================================================
// SIDE-FIRE-2A: Barrier Probe / Penetration Estimate (AI 판단용 — 실제 피해는 raycast)
// =============================================================
// 사선 위 첫 barrier (벽 또는 cover) — 가장 가까운 것
// 장벽 소유권 — **어디에 뭔가 있다**는 건 보면 안다(기하는 정답).
//   **그게 무엇으로 만들어졌고 얼마나 두꺼운가**는 믿음이고, 틀릴 수 있다.
//   그래서 기하는 그대로 두고 재질·두께·장갑만 믿음으로 덮어쓴다.
//   실제 탄환 물리는 여기를 쓰지 않는다 — 물리는 계속 정답이라 AI가 틀렸다는 사실이 드러난다.
const USE_BELIEF_BARRIER = true;
function isBeliefBarrierOn() {
  if (typeof GAME !== 'undefined' && GAME.beliefBarrierOn != null) return !!GAME.beliefBarrierOn;
  return USE_BELIEF_BARRIER;
}
function applyBelievedBarrierProps(shooter, b, nx, ny) {
  if (!b || !b.hasBarrier) return b;
  if (!isBeliefBarrierOn()) return b;
  if (typeof isSpatialPerceptionOn !== 'function' || !isSpatialPerceptionOn()) return b;
  if (typeof SpatialPerception === 'undefined' || !SpatialPerception.believedBarrierAt) return b;
  const hx = shooter.x + nx * b.distanceToBarrier, hy = shooter.y + ny * b.distanceToBarrier;
  const bel = SpatialPerception.believedBarrierAt(shooter, hx, hy);
  // 못 본 장벽은 재질 미상 — 기존 규약대로 보수적으로 콘크리트라고 단정한다.
  const mat = bel ? bel.material : 'concrete';
  b.beliefSeen = !!bel;
  b.beliefMaterialKnown = bel ? bel.materialKnown : 'unknown';
  b.trueMaterial = b.material;
  b.beliefThicknessKnown = !!(bel && bel.thickness != null);
  // 재질이 우연히 맞아도 **항상** 다시 계산한다. 저작된 armor 수치(예: 콘크리트 55)는
  //   설계자가 적어 둔 값이지 사수가 벽을 보고 읽을 수 있는 게 아니다.
  //   사수는 언제나 "겉보기 재질 × 두께"로 어림한다 — 그 어림이 정답과 다른 건 정상이다.
  //   armor를 비운 합성 객체를 넘겨야 재질에서 파생된다.
  b.beliefArmorEstimated = true;
  const obj = b.barrierObj;
  const synth = { material: mat, w: obj ? obj.w : 8, h: obj ? obj.h : 8 };
  const entryT = b.distanceToBarrier, exitT = entryT + (b.pathLenM != null ? mToPx(b.pathLenM) : b.thickness);
  const eff = computeBarrierEffectiveArmor(synth, { entryT, exitT, material: mat });
  b.material = mat;
  b.armor = eff.baseArmor;
  b.baseArmor = eff.baseArmor;
  b.effectiveArmor = eff.effectiveArmor;
  b.armorPerMeter = eff.armorPerMeter;
  b.nominalThicknessM = eff.nominalThicknessM;
  // 두께는 양면을 봤을 때만 안다. 모르면 겉보기 기하값을 그대로 쓴다(추측은 하되 확신은 안 한다).
  if (bel && bel.thickness != null) b.thickness = bel.thickness;
  return b;
}

function findFirstBarrierBetween(shooter, tx, ty, opts) {
  const dx = tx - shooter.x, dy = ty - shooter.y;
  const losLen = Math.hypot(dx, dy);
  if (losLen < 1) return { hasBarrier: false };
  const nx = dx / losLen, ny = dy / losLen;
  const wall = rayDistToWalls(shooter.x, shooter.y, nx, ny, losLen);
  const cov = rayDistToCovers(shooter.x, shooter.y, nx, ny, losLen, null);
  let obj = null, t = Infinity, kind = null;
  if (wall.obj && wall.t < t) { obj = wall.obj; t = wall.t; kind = 'wall'; }
  if (cov.obj && cov.t < t) { obj = cov.obj; t = cov.t; kind = (obj.halfHeight ? 'halfCover' : 'cover'); }
  if (!obj) return { hasBarrier: false };
  // 두께(짧은 축) 추정
  const thickness = Math.min(obj.w || 8, obj.h || 8);
  // SIDE-PATHLEN-ARMOR-1 §14: 실제 통과 길이 기반 effectiveArmor 추정 (정면 vs 긴 방향 구분)
  const _exitT = (typeof rayBoxExitT === 'function') ? rayBoxExitT(shooter.x, shooter.y, nx, ny, obj, losLen) : (t + thickness);
  const _eff = (typeof computeBarrierEffectiveArmor === 'function')
    ? computeBarrierEffectiveArmor(obj, { entryT: t, exitT: _exitT, material: obj.material })
    : { effectiveArmor: obj.armor || 0, baseArmor: obj.armor || 0, pathLenM: pxToM(thickness), pathRatio: 1, armorPerMeter: 0, nominalThicknessM: pxToM(thickness) };
  const out = {
    hasBarrier: true, barrierObj: obj, barrierType: kind,
    barrierId: obj.id || (obj.coverPresetId || obj.material) + '@' + Math.round(obj.x) + ',' + Math.round(obj.y),
    material: obj.material || 'wood', armor: obj.armor || 0, thickness,
    baseArmor: _eff.baseArmor, effectiveArmor: _eff.effectiveArmor,
    pathLenM: _eff.pathLenM, pathRatio: _eff.pathRatio, armorPerMeter: _eff.armorPerMeter, nominalThicknessM: _eff.nominalThicknessM,
    penetrable: (obj.penetrable !== false),
    distanceToBarrier: t, distanceBeyondBarrier: Math.max(0, losLen - t),
  };
  // AI 판단 경로만 믿음으로 덮는다. 진단 콘솔(debugShootThroughBarrier)은 정답을 봐야 한다.
  return (opts && opts.believed) ? applyBelievedBarrierProps(shooter, out, nx, ny) : out;
}
// 관통 가능성 보수적 추정 — 기존 effectivePenetration + material penRetention 사용. 숙련도별 부정확.
function estimateBarrierPenetrationFeasibility(shooter, tx, ty, weapon, ammo, memoryCtx) {
  const b = findFirstBarrierBetween(shooter, tx, ty, { believed: true });
  if (!b.hasBarrier) return { hasBarrier: false, result: 'no_barrier' };
  const tier = (shooter.skill && shooter.skill.presetId) || 'regular';
  // 비관통(map boundary / non-penetrable) → 즉시 blocked
  if (!b.penetrable) {
    return Object.assign(b, { result: 'blocked_hard_wall', estimatedPenAfterBarrier: 0, penetrationConfidence: 0.9,
      barrierKnownConfidence: _barrierKnownConfidence(shooter, b.barrierId) });
  }
  const props = getBarrierMaterialProps(b.material);
  const penBefore = effectivePenetration(ammo, weapon, b.material);
  // SIDE-PATHLEN-ARMOR-1 §14: effectiveArmor(사선/긴 방향 반영) 우선, pathRatio로 두께 손실 근사.
  const effArmor = Number.isFinite(b.effectiveArmor) ? b.effectiveArmor : (b.armor || 0);
  const pathRatio = Number.isFinite(b.pathRatio) ? b.pathRatio : Math.max(0.5, (b.thickness || 8) / 8);
  // 두께 비례 손실 (실제 raycast의 penetrationLoss × armorPenScale 근사)
  const armorPenScale = 1 + Math.min(1.2, effArmor / 30) * 0.9;
  const thickMul = Math.max(0.5, pathRatio);   // pathRatio=1이 정면 공칭 두께
  const lossEst = props.penetrationLoss * thickMul * armorPenScale;
  let penAfter = Math.max(0, penBefore * props.penRetention - lossEst);
  // 숙련도별 추정 부정확성 — recruit는 크게 흔들림
  const noiseMul = ({ recruit: 0.45, regular: 0.18, veteran: 0.10, elite: 0.06 })[tier];
  const nz = 1 + (Math.random() * 2 - 1) * (noiseMul != null ? noiseMul : 0.18);
  const penAfterEst = penAfter * nz;
  // armor 대비 결과 분류 (보수적) — effectiveArmor 기준
  let result;
  const margin = penAfterEst - effArmor * 0.5;   // effectiveArmor 절반을 통과 기준 근사
  if (penAfterEst <= 1 || penBefore <= effArmor * 0.6) result = 'unlikely';
  else if (margin > 6) result = 'likely_penetrates';
  else result = 'uncertain';
  // 두꺼운/긴 방향 hard 재질은 보수적으로 unlikely/blocked 쪽
  if ((b.material === 'concrete' || b.material === 'steel') && pathRatio > 1.25) {
    result = (penBefore > effArmor * 1.3) ? 'uncertain' : 'unlikely';
  }
  return Object.assign(b, {
    estimatedPenBeforeBarrier: +penBefore.toFixed(1),
    estimatedPenAfterBarrier: +Math.max(0, penAfterEst).toFixed(1),
    estimatedVelocityAfterBarrier: +(props.velocityRetention).toFixed(2),
    estimatedDamageAfterBarrier: +(props.damageRetention).toFixed(2),
    penetrationConfidence: Math.max(0.2, 1 - (noiseMul != null ? noiseMul : 0.18)),
    barrierKnownConfidence: _barrierKnownConfidence(shooter, b.barrierId),
    result,
  });
}
// barrier 기회 분류 — memory + estimate 결합
function classifyBarrierShotOpportunity(shooter, memoryCtx, est) {
  if (!est || !est.hasBarrier) return 'open_los';
  if (est.result === 'blocked_hard_wall' || est.result === 'unlikely') return 'no_shot';
  const tier = (shooter.skill && shooter.skill.presetId) || 'regular';
  const isVetPlus = (tier === 'veteran' || tier === 'elite');
  // WALL_PENETRATION: likely + 높은 confidence recent memory + 얇음 + (veteran 우선/조건 좋은 regular)
  if (est.result === 'likely_penetrates'
      && memoryCtx && memoryCtx.confidence >= 0.62 && memoryCtx.uncertaintyRadius <= 40
      && (memoryCtx.memoryClass === 'PRECISE_RECENT' || memoryCtx.memoryClass === 'AREA_SUSPECTED')
      && est.thickness <= 14 && (isVetPlus || (tier === 'regular' && est.material !== 'concrete' && est.material !== 'steel'))) {
    return 'wall_penetration';
  }
  // BARRIER_PROBE: uncertain 또는 likely, 중간 confidence, regular+
  if ((est.result === 'uncertain' || est.result === 'likely_penetrates')
      && memoryCtx && memoryCtx.confidence >= 0.45 && _fcIsRegularPlus(shooter)) {
    return 'barrier_probe';
  }
  return 'no_shot';
}
// barrierKnowledge — 작은 기억 (probe 결과). 영구/팀공유 아님.
function _barrierKnownConfidence(unit, barrierId) {
  if (!unit.barrierKnowledge || !barrierId) return 0;
  const k = unit.barrierKnowledge[barrierId];
  if (!k) return 0;
  const elapsed = (GAME.gameTime || 0) - (k.lastProbeTime || 0);
  if (elapsed > 20) return 0;
  return Math.max(0, (k.confidence || 0) * (1 - elapsed / 20));
}
function recordBarrierProbeResult(unit, barrierId, material, outcome) {
  if (!barrierId) return;
  unit.barrierKnowledge = unit.barrierKnowledge || {};
  const k = unit.barrierKnowledge[barrierId] || { barrierId, material, observedPenetration: 0, observedStop: 0, observedRicochet: 0, confidence: 0 };
  // SIDE-FIRE-2A-HOTFIX-1: 성공/정지/도탄 분리. 막힘을 관통으로, 도탄을 관통으로 기록하지 않는다.
  if (outcome === 'penetrated') k.observedPenetration++;
  else if (outcome === 'ricochet') k.observedRicochet = (k.observedRicochet || 0) + 1;
  else k.observedStop++;   // stopped/blocked/absorbed/shattered/hard_stop 등
  k.lastProbeTime = (GAME.gameTime || 0);
  k.confidence = Math.min(1, 0.4 + 0.2 * (k.observedPenetration + k.observedStop + (k.observedRicochet || 0)));
  k.material = material;
  unit.barrierKnowledge[barrierId] = k;
}

// =============================================================
// AI 상태 머신 — idle / alert / investigateNoise / searchNoise / contact / suppressed / downed
// =============================================================
//   매 프레임 computeAiState로 우선순위 평가 → state 결정 → 행동 분기.
//   기존 자동엄폐/threatDirection/lastKnown/lastHeardNoise는 그대로 살리고,
//   상태는 시각화/디버그/로그/일부 동작 분기에 사용.
//
//   우선순위:
//     1. dead → (행동 없음 — 호출 안 됨)
//     2. downed
//     3. visible target (currentTarget) → contact
//     4. suppression 급증 / stoppingTimer / threatTimer 활성 → suppressed
//     5. lastKnownEnemy 높음 → contact-like 경계 (alert 대신 lastKnown 기반)
//     6. lastHeardNoise 활성 → 거리/신뢰도로 investigateNoise / searchNoise / alert
//     7. 그 외 → idle

function computeAiState(unit) {
  if (unit.isDead) return 'dead';
  if (unit.isDowned) return 'downed';
  // visible target
  if (unit.currentTarget) return 'contact';
  // suppressed — 직접 피격/stopping/threat 신호 활성
  const threatActive = (unit.threatDirection != null) &&
                       ((GAME.gameTime - unit.threatTime) < THREAT_DURATION);
  if (unit.stoppingTimer > 0 || (unit.suppression >= 60 && threatActive)) return 'suppressed';
  // lastKnown — visible은 없지만 시야 정보가 강한 경우 (contact로 처리하지만 상태는 alert로 표시)
  const best = pickBestLastKnown(unit);
  if (best && best.confidence > 0.40) return 'alert';
  // 소음 — 거리/신뢰도로 단계 결정
  const heard = unit.lastHeardNoise;
  if (heard && heard.confidence > 0.15) {
    const d = Math.hypot(heard.x - unit.x, heard.y - unit.y);
    // searchNoise — investigate 후 목적지 근처 도착했을 때
    //   movePath 비었고 lastHeardNoise 60px 이내면 searching
    if (unit.aiSearchTimer > 0) return 'searchNoise';
    if (heard.confidence > 0.45 && d > 100 && d < 600) return 'investigateNoise';
    return 'alert';
  }
  return 'idle';
}

// 상태 머신 tick — 매 프레임 호출. 상태 결정 + 부수 동작.
function tickAiStateMachine(unit, dt) {
  if (unit.isDead) { unit.aiState = 'dead'; return; }
  // passive target은 상태 머신 영향 X (기존 동작 유지)
  if (unit.role === 'passive') { unit.aiState = 'idle'; return; }

  // searchNoise 타이머 진행
  if (unit.aiSearchTimer > 0) unit.aiSearchTimer = Math.max(0, unit.aiSearchTimer - dt);

  const newState = computeAiState(unit);
  if (newState !== unit.aiState) {
    unit.aiState = newState;
    unit.aiStateTimer = GAME.gameTime || 0;
    // 적군만 상태 전환 로그 (쿨다운 + 중복 방지)
    if (unit.team === 'enemy' && newState !== unit.aiStateLogged
        && (newState === 'investigateNoise' || newState === 'searchNoise' || newState === 'contact' || newState === 'suppressed')) {
      const label = {
        contact:'접촉', suppressed:'엄폐 이동',
        investigateNoise:'소음 위치 조사', searchNoise:'소음 위치 수색',
        alert:'경계',
      }[newState] || newState;
      log(`[${unit.name}] ${label}`, newState === 'contact' ? 'danger' : 'warn');
      unit.aiStateLogged = newState;
    }
    if (newState === 'idle') unit.aiStateLogged = '';
  }

  // searchNoise 진입 트리거 — investigateNoise 목적지에 도착한 경우
  //   movePath 비고 lastHeardNoise 가깝고 컨피던스 남았으면 searchNoise 타이머 시작
  if (unit.aiState === 'alert' && unit.lastHeardNoise
      && unit.movePath.length === 0 && unit.aiSearchTimer === 0) {
    const d = Math.hypot(unit.lastHeardNoise.x - unit.x, unit.lastHeardNoise.y - unit.y);
    // 이전에 investigate로 접근했다면 — 그 흔적은 _justArrivedFromInvestigate (도착시 set)
    if (unit._justArrivedFromInvestigate && d < 120) {
      unit.aiSearchTimer = 3.0;   // 3초 수색
      unit._justArrivedFromInvestigate = false;
    }
  }
}

// 위협 방향 등록 — nearMiss나 피격 시 호출
//   threatX, threatY는 사수 위치 (또는 탄이 들어온 추정 방향의 점)
function registerThreat(unit, threatX, threatY, meta) {
  if (!unit.alive) return;
  unit.threatDirection = Math.atan2(threatY - unit.y, threatX - unit.x);
  unit.threatTime = GAME.gameTime;
  // [HF1] 피격 확정 직후 hit evidence. near_miss는 _applyNearMissToUnit에서 별도로 기록한다.
  const m = meta || {};
  if (m.kind === 'near_miss') return;
  if (typeof recordThreatEvidence === 'function') {
    const known = (m.sourceUnitId != null);   // 사수를 알 때만 정확 좌표
    recordThreatEvidence(unit, { kind: 'hit', positionKnown: known,
      x: known ? threatX : null, y: known ? threatY : null,
      direction: unit.threatDirection, angularUncertainty: known ? 0 : 0.30,
      confidence: 0.8, danger: 0.9,
      sourceUnitId: (m.sourceUnitId != null) ? m.sourceUnitId : null,
      sourceEventId: m.sourceEventId || ('hit' + Math.round((GAME.gameTime || 0) * 100)), ttl: 8 });
  }
}

// 점-선분 최단거리 (선분 [a→b]에 대한 점 p)
function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx*dx + dy*dy;
  if (lenSq < 1e-9) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// raycast 결과 ray가 어떤 유닛 근처를 스쳐갔는지 검사
//   shooter: 사수
//   ray: raycastShot 결과 (start = shooter, end = ray.x/ray.y)
//   직접 명중한 unit은 제외 (이미 처리)
//   nearMiss를 받은 유닛에게 suppression 약간 + threat 등록
function checkNearMissForUnits(shooter, ray, ammo) {
  const ex = ray.x, ey = ray.y;
  const shotId = ray._shotId || (ray._shotId = nextShotId());
  const supersonic = _ammoSupersonic(ammo);
  const bigBore = _ammoBigBore(ammo);
  let radius = NEAR_MISS_RADIUS;
  if (bigBore) radius *= 1.8;
  const passSupMul = (supersonic ? 1.0 : 0.6) * (bigBore ? 1.3 : 1.0);
  for (const u of UNITS) {
    if (!u.alive) continue;
    if (u === shooter) continue;
    if (ray.type === 'unit' && u === ray.unit) continue;   // 직접 맞은 유닛 제외
    const d = pointSegmentDistance(u.x, u.y, shooter.x, shooter.y, ex, ey);
    if (d >= radius || d <= UNIT_RADIUS) continue;
    if (_hardWallBetween(shooter.x, shooter.y, u.x, u.y) && _hardWallBetween(ex, ey, u.x, u.y)) continue;  // 벽 너머 무효
    const friendly = (u.team === shooter.team);   // SIDE-FIRE-1B: 같은 팀도 약한 friendly near miss
    let t = (1 - (d - UNIT_RADIUS) / (radius - UNIT_RADIUS)) * passSupMul;
    _applyNearMissToUnit(u, shooter, shooter.x, shooter.y, Math.min(1.2, t), 'pellet_passby', 0.3, shotId + 'p', friendly);
  }
}

// =============================================================
// SIDE-AMMO-1B: 특수 탄약 효과 (near miss / tracer / incendiary / micro-HEI·HEIAP / sabot debug)
//   기존 suppression / registerThreat / 파편 / damageEvent 흐름에 보조로 연동. AI 트리는 변경하지 않음.
// =============================================================
let _SIDE_SHOT_SEQ = 0;
function nextShotId() { return 'sh' + (++_SIDE_SHOT_SEQ); }
function _ammoSupersonic(ammo) { return ((ammo && ammo.velocity) || 0) >= 340; }
function _ammoBigBore(ammo) { return !!(ammo && ammo.caliber && String(ammo.caliber).indexOf('12.7') >= 0); }
function _ammoNotes(ammo) { return (ammo && ((ammo.ui && ammo.ui.notes) || ammo.notes || ammo._notes)) || []; }
function _noteHas(ammo, k) { const n = _ammoNotes(ammo); return Array.isArray(n) && n.indexOf(k) >= 0; }

// --- tracer (§5) ---
const TRACER_GREEN_IDS = ['545_7t3_tracer','545_7bt4_aptracer','762x39_t45m_tracer','762x54r_t46m','762x54r_7bt1','9x21_sp13_7bt3'];
const TRACER_RED_EXCEPTION_IDS = ['127x108_bzt44_apit'];   // 동구권이지만 red 예외
function _ammoIsTracer(ammo) {
  if (!ammo) return false;
  if (ammo.projectile && ammo.projectile.projectileType === 'tracer') return true;
  if ((ammo.barrierBehavior || '').indexOf('tracer') >= 0) return true;
  if (_noteHas(ammo, 'tracer') || _noteHas(ammo, 'api_t')) return true;
  const id = ammo.id || '';
  return id.indexOf('tracer') >= 0 || id.indexOf('apit') >= 0 || id.indexOf('_t46m') >= 0 || id.indexOf('_7bt') >= 0 || id.indexOf('_bzt') >= 0;
}
function getTracerColor(ammo) {
  if (!_ammoIsTracer(ammo)) return null;
  const id = ammo.id || '';
  if (TRACER_RED_EXCEPTION_IDS.indexOf(id) >= 0) return 'red';
  if (TRACER_GREEN_IDS.indexOf(id) >= 0) return 'green';
  return 'red';   // 서구권/NATO 기본
}
function _tracerEffect(ammo) {
  if (!_ammoIsTracer(ammo)) return null;
  const big = _ammoBigBore(ammo);
  return { enabled:true, color:getTracerColor(ammo),
    visualThreatMul: big?1.40:1.25, directionConfidenceMul: big?1.50:1.35,
    shooterRevealMul: big?1.40:1.25, nearMissSuppressionMul: big?1.35:1.20 };
}

// --- incendiary (§6) ---
function _incendiaryInfo(ammo) {
  if (!ammo) return null;
  const beh = ammo.barrierBehavior || '';
  const isInc = beh.indexOf('api') >= 0 || _noteHas(ammo,'api') || _noteHas(ammo,'api_t') || _noteHas(ammo,'incendiary') || _noteHas(ammo,'incendiaryFuture');
  if (!isInc) return null;
  const big = _ammoBigBore(ammo);
  return { enabled:true, flashOnly:true, armorScorch:true, ignitionEnabled:false, postPenOnly:true,
    postPenInternalDamageMul: big?1.10:1.07, postPenShockMul: big?1.07:1.05, postPenPainMul: big?1.07:1.05 };
}

// --- micro HEI / HEIAP (§7) ---
// ===== SIDE-AMMO-1B-HOTFIX-2: 인체 관통 저항 scaffold (Mk211 신관 판단 전용) =====
const BODY_HIT_DIRECTION_RESISTANCE_MUL = {
  front:          { resistanceMul: 1.00, note: 'front torso/limb path' },
  rear:           { resistanceMul: 1.00, note: 'rear body path' },
  side:           { resistanceMul: 0.75, note: 'side hit shorter body path' },
  oblique:        { resistanceMul: 1.15, note: 'angled longer tissue track' },
  lengthwise_limb:{ resistanceMul: 1.25, note: 'longitudinal limb path' },
};
const BODY_PART_RESISTANCE_TABLE = {
  head:          { penetrationCost: 8,  dropRatio: 0.08, triggerBias: 0.05, cls: 'dense_head' },
  neck:          { penetrationCost: 6,  dropRatio: 0.06, triggerBias: 0.05, cls: 'soft_tissue' },
  chest_front:   { penetrationCost: 10, dropRatio: 0.10, triggerBias: 0.08, cls: 'torso' },
  chest_side:    { penetrationCost: 8,  dropRatio: 0.08, triggerBias: 0.06, cls: 'torso' },
  abdomen_front: { penetrationCost: 9,  dropRatio: 0.09, triggerBias: 0.06, cls: 'torso' },
  abdomen_side:  { penetrationCost: 7,  dropRatio: 0.07, triggerBias: 0.04, cls: 'torso' },
  pelvis:        { penetrationCost: 12, dropRatio: 0.12, triggerBias: 0.10, cls: 'dense_pelvis' },
  shoulder_outer:{ penetrationCost: 6,  dropRatio: 0.06, triggerBias: 0.03, cls: 'muscle' },
  upper_arm:     { penetrationCost: 5,  dropRatio: 0.05, triggerBias: 0.00, cls: 'muscle' },
  forearm:       { penetrationCost: 4,  dropRatio: 0.04, triggerBias: -0.02, cls: 'thin_limb' },
  thigh:         { penetrationCost: 8,  dropRatio: 0.08, triggerBias: 0.05, cls: 'muscle' },
  calf:          { penetrationCost: 5,  dropRatio: 0.05, triggerBias: 0.00, cls: 'muscle' },
  hand_foot:     { penetrationCost: 3,  dropRatio: 0.03, triggerBias: -0.05, cls: 'thin_limb' },
};
// 게임 내부 bodyPart 명칭 → resistance table 키 매핑
function _bodyPartResistanceKey(part, dir) {
  const side = (dir === 'side');
  const map = {
    head:'head', neck:'neck', chest: side?'chest_side':'chest_front', abdomen: side?'abdomen_side':'abdomen_front',
    pelvis:'pelvis', groin:'pelvis', shoulder:'shoulder_outer', upperArm:'upper_arm', leftArm:'upper_arm', rightArm:'upper_arm',
    forearm:'forearm', thigh:'thigh', leftLeg:'thigh', rightLeg:'thigh', calf:'calf', hand:'hand_foot', foot:'hand_foot',
  };
  return map[part] || 'chest_front';
}
// Mk211 인체 관통 컨텍스트 산출 (신관/과관통/후면판 판단용 scaffold)
function _computeBodyPenetrationContext(unit, hitResult, projectilePenBefore, dir) {
  const part = (hitResult && hitResult.bodyPart) || 'chest';
  const prof = (unit && unit.bodyResistanceProfile) || { directionMul: BODY_HIT_DIRECTION_RESISTANCE_MUL, partResistance: BODY_PART_RESISTANCE_TABLE };
  const key = _bodyPartResistanceKey(part, dir);
  const pr = prof.partResistance[key] || BODY_PART_RESISTANCE_TABLE.chest_front;
  const dm = (prof.directionMul[dir] || BODY_HIT_DIRECTION_RESISTANCE_MUL.front).resistanceMul;
  const boneHit = !!(hitResult && (hitResult.boneHit || /head|pelvis/.test(key)));
  let costBase = pr.penetrationCost, cost = costBase * dm;
  let dropRatio = pr.dropRatio * dm, triggerBias = pr.triggerBias;
  if (boneHit) { cost += 6; dropRatio += 0.10; triggerBias += 0.20; }
  const penAfter = projectilePenBefore - cost;
  return {
    enabled:true, usedForMk211FuzeOnly:true, hitDirection:dir, bodyPartResistanceKey:key, bodyResistanceClass:pr.cls,
    directionResistanceMul:dm, bodyPenetrationCostBase:costBase, bodyPenetrationCostFinal:cost,
    bodyPenetrationDropRatio:dropRatio, bodyTriggerBias:triggerBias,
    projectilePenBeforeBody:projectilePenBefore, projectilePenAfterBody:penAfter,
    bodyPenetrated:penAfter > 0, bodyStopped:penAfter <= 0, overpenetratedBody:penAfter > 6, retainedProjectile:penAfter <= 0,
    boneHit, futureMedicalTrajectoryHook:true,
  };
}
// 12.7mm micro HE fragment 공통 기준값 (수류탄급 아님 — 하향)
const FRAG_DMG_BY_SIZE   = { small: 3.5, medium: 7,   large: 14 };
const FRAG_PEN_BY_SIZE   = { small: 4,   medium: 8.5, large: 17 };
const FRAG_BLEED_BY_SIZE = { small: 0.07, medium: 0.10, large: 0.15 };
function _fragWoundDepth(size, rm, penalty) {
  const eff = rm * (penalty != null ? penalty : 1);
  if (size === 'large') return eff > 0.6 ? 'deep_fragment' : (eff > 0.3 ? 'shallow_fragment' : 'abrasion');
  if (size === 'medium') return eff > 0.75 ? 'light_deep_fragment' : (eff > 0.35 ? 'shallow_fragment' : 'abrasion');
  return eff > 0.7 ? 'shallow_fragment' : (Math.random() < 0.5 ? 'abrasion' : 'bruise');   // small: 표면 중심
}
function _microExplosiveInfo(ammo) {
  if (!ammo) return null;
  const beh = ammo.barrierBehavior || '';
  const id = ammo.id || '';
  const isHEIAP = beh === 'anti_material_heiap' || _noteHas(ammo,'heiap') || id.indexOf('mk211') >= 0;
  const isHEI   = beh === 'hei_shell' || (_noteHas(ammo,'hei') && !isHEIAP) || id.indexOf('mdz') >= 0;
  const VEL = { small:[1100,1500], medium:[900,1250], large:[800,1050] };
  const SIZE = { small:0.80, medium:0.15, large:0.05 };
  const BLEED = { small:0.07, medium:0.10, large:0.15 };
  if (isHEIAP) return { enabled:true, type:'heiap', detonationMode:'delayed_post_penetration', detonationDelayMs:4,
    usesPrimaryPenetratorRaycast:true, primaryPenetratorUsesExistingBulletRaycast:true,
    consumesPrimaryProjectileOnDetonation:false, primaryProjectileContinuesAfterBurst:true,
    postPenBurstRadiusM:0.8, surfaceBurstRadiusM:0.9, nearMissRadiusM:2.0,
    fragmentCount:30, fragmentThreatRangeM:3, fragmentMaxRangeM:13,
    fragmentSizeChance:SIZE, fragmentVelocityMps:VEL, fragmentDamageMul:0.13, fragmentPenMul:0.13,
    fragmentBleedRiskBySize:BLEED, fragDmgScale:1.0, fragPenScale:1.0,
    nearMissSuppressionMul:1.40, requiresPenetrationForPostBurst:true,
    postPenTrigger:{ enabled:true, minPenetrationDropRatio:0.06, preferredPenetrationDropRatio:0.12, strongPenetrationDropRatio:0.24, hardSurfaceBurstDropRatio:0.50,
      minSingleImpactDropForFuze:0.06, preferredSingleImpactDropForFuze:0.10, strongSingleImpactDropForFuze:0.16, nearCertainSingleImpactDropForFuze:0.22,
      cumulativeDropEnabled:false, cumulativeDropWindowM:2.0, _debugCumulativeOnly:true },
    postPenDirectionMode:'forward_cone', postPenConeAngleDeg:30,
    hardSurfaceImpactBurst:true, hardSurfaceDirectionMode:'omnidirectional', postBodyAirBurstOffsetM:[0.3,1.0], barrierAirBurstOffsetM:[0.5,1.2],
    bodyBurstEffect:{ enabled:true, triggerOnBodyPenetration:true, detonationDepthM:[0.20,0.40], internalBurstMode:'localized_forward',
      maxInternalSecondaryWounds:6, internalFragmentWoundCount:{ min:2, max:6 },
      internalDamageMul:1.25, internalBleedMul:1.20, shockMul:1.35, painMul:1.30, fractureMul:1.25,
      noGrenadeLikeRadialDamageInsideBody:true } };
  if (isHEI) return { enabled:true, type:'hei', detonationMode:'impact_instant',
    consumesPrimaryProjectileOnDetonation:true, primaryProjectileContinuesAfterBurst:false,
    burstRadiusM:1.2, nearMissRadiusM:2.5,
    fragmentCount:32, fragmentThreatRangeM:3, fragmentMaxRangeM:13,
    fragmentSizeChance:SIZE, fragmentVelocityMps:VEL, fragmentDamageMul:0.12, fragmentPenMul:0.11,
    fragmentBleedRiskBySize:BLEED, fragDmgScale:0.92, fragPenScale:0.85,
    nearMissSuppressionMul:1.35, directionMode:'omnidirectional', requiresPenetrationForPostBurst:false,
    mdzFuzeModel:{ enabled:true, fuzeType:'sensitive_impact_fuze', fuzeArmsOnAnyImpact:true,
      detonationDelayMs:[0.02,0.25], shortDelayDistanceM:[0.02,0.18],
      hardSurfaceImmediateBurstChance:0.96, mediumSurfaceImmediateBurstChance:0.85, mediumSurfaceShortDelayChance:0.15,
      thinBarrierShortDelayChance:0.25, thinBarrierImmediateBurstChance:0.75, unitContactImmediateBurstChance:0.95, softTargetContactBurstChance:0.95,
      thickWallPassThroughChance:0.005, noFuzeOnImpactChance:0.00, maxThinBarrierPassesBeforeDetonation:1,
      shortDelayConeAngleDeg:[60,90] } };
  return null;
}
// 12.7급 HE 파편 거리 감쇠 (위협거리 3m / 최대 13m)
function _fragRangeMul(distM, threatM, maxM) {
  threatM = threatM || 3; maxM = maxM || 13;
  if (distM <= threatM) return 1.0;
  if (distM >= maxM) return 0;
  return Math.pow(1 - ((distM - threatM) / (maxM - threatM)), 2.2);
}
// 파편 크기 결정 + 속도 롤
function _rollFragSize(sz) { const r = Math.random(); return r < sz.small ? 'small' : r < sz.small + sz.medium ? 'medium' : 'large'; }
function _rollFragVel(vel, size) { const v = vel[size] || [900,1300]; return v[0] + Math.random() * (v[1] - v[0]); }

// 벽 강차폐 — near miss/blast 감쇠용
function _hardWallBetween(x1, y1, x2, y2) {
  if (!MAP_DATA || !MAP_DATA.walls) return false;
  for (const w of MAP_DATA.walls) if (segmentIntersectsRect(x1, y1, x2, y2, w)) return true;
  return false;
}
// near miss 입력을 유닛 전투생리/AI threat memory에 반영 (§9). AI 트리 변경 없음.
function _applyNearMissToUnit(u, shooter, sx, sy, intensity, kind, dirConf, shotId, friendly) {
  if (!u || !u.alive) return false;
  // per-shot/burst cap (§4-4)
  const now = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  u._nearMiss = u._nearMiss || { shotId:null, windowStart:0, accum:0 };
  if (u._nearMiss.shotId === shotId) return false;        // 같은 shot 중복 금지
  u._nearMiss.shotId = shotId;
  if (now - u._nearMiss.windowStart > 0.25) { u._nearMiss.windowStart = now; u._nearMiss.accum = 0; }
  const capRoom = Math.max(0, 14 - u._nearMiss.accum);    // 0.25s 윈도우 누적 cap
  // SIDE-FIRE-1B §4.2/§7: friendly near miss는 약하게. 적탄 near miss는 기존대로.
  const supAdd = friendly
    ? Math.min(capRoom, 0.6 + 1.6 * intensity)
    : Math.min(capRoom, 1.5 + 5.0 * intensity);
  u._nearMiss.accum += supAdd;
  u.suppression = Math.min(100, (u.suppression || 0) + supAdd);
  // friendly near miss는 적 위협 방향을 등록하지 않는다 (적 발견으로 오인 / lastKnown 오염 방지)
  // [HF1] near miss evidence — 방향만, 정확 위치 없음. 같은 shotId는 위에서 이미 차단된다.
  if (typeof recordThreatEvidence === 'function') {
    recordThreatEvidence(u, { kind: 'near_miss', positionKnown: false,
      direction: Math.atan2(sy - u.y, sx - u.x), angularUncertainty: 0.25 + 0.35 * (1 - Math.min(1, intensity)),
      confidence: 0.6, danger: Math.min(1, 0.4 + 0.5 * intensity),
      sourceEventId: shotId, ttl: 6 });
  }
  if (!friendly) registerThreat(u, sx, sy, { kind: 'near_miss' });
  const sr = u.medical && u.medical.stressResponse;
  if (sr) {
    const fm = friendly ? 0.4 : 1.0;
    sr.suppressionDrive = Math.min(1, (sr.suppressionDrive||0) + 0.10 * intensity * fm);
    sr.threatDrive      = Math.min(1, (sr.threatDrive||0)      + 0.08 * intensity * fm);
    sr.combatArousal    = Math.min(1, (sr.combatArousal||0)    + 0.06 * intensity * fm);
    sr.panic            = Math.min(1, (sr.panic||0)            + 0.03 * intensity * (kind==='ricochet'?1.4:1.0) * fm);
    if (!friendly) sr.threatDirectionConfidence = Math.min(1, (sr.threatDirectionConfidence||0) + 0.12 * (dirConf||0));
  }
  u._lastNearMiss = { kind, intensity:+intensity.toFixed(2), dist:null, t:now, friendly:!!friendly };
  if (friendly) u._friendlyNearMissT = now;
  return true;
}

// 특수효과 마스터 — 사격 처리 끝에서 호출 (기존 checkNearMissForUnits 대체)
function applySpecialAmmoEffects(shooter, ray, weapon, hitResult) {
  const ammo = (weapon && weapon._ammo) || null;
  const shotId = ray._shotId || (ray._shotId = nextShotId());
  const sx = shooter.x, sy = shooter.y, ex = ray.x, ey = ray.y;
  const tracer = _tracerEffect(ammo);
  const supersonic = _ammoSupersonic(ammo);
  const bigBore = _ammoBigBore(ammo);
  const dbg = (typeof GAME !== 'undefined' && GAME.debugUtility);
  // 거리 범위/강도 보정
  let radius = NEAR_MISS_RADIUS;                              // px (~1.9m)
  if (bigBore) radius *= 1.8;
  if (tracer) radius *= 1.15;
  const passSupMul = (supersonic ? 1.0 : 0.6) * (tracer ? tracer.nearMissSuppressionMul : 1.0) * (bigBore ? 1.3 : 1.0);

  // 1) ballistic pass-by + tracer_passby (§4-1, §5). SIDE-FIRE-1B: 같은 팀도 약한 friendly near miss.
  for (const u of UNITS) {
    if (!u.alive || u === shooter) continue;
    if (ray.type === 'unit' && u === ray.unit) continue;     // 직접 명중 유닛 제외 (중복 금지 §4)
    const d = pointSegmentDistance(u.x, u.y, sx, sy, ex, ey);
    if (d >= radius || d <= UNIT_RADIUS) continue;
    if (_hardWallBetween(sx, sy, u.x, u.y) && _hardWallBetween(ex, ey, u.x, u.y)) continue;  // 벽 너머 무효
    const friendly = (u.team === shooter.team);
    let t = 1 - (d - UNIT_RADIUS) / (radius - UNIT_RADIUS);   // 0~1
    t *= passSupMul;
    const dirConf = tracer ? tracer.directionConfidenceMul - 1 + 0.3 : 0.3;
    if (_applyNearMissToUnit(u, shooter, sx, sy, Math.min(1.2, t), tracer ? 'tracer_passby' : 'ballistic_passby', dirConf, shotId, friendly)) {
      if (!friendly && tracer && u.medical && u.medical.stressResponse) {
        u._tracerSpotted = { color: tracer.color, by: shooter.id, t: (GAME.gameTime||0) };
      }
    }
  }

  // 2) impact near miss (§4-2) — 벽/엄폐물/방탄판 탄착 주변. SIDE-MEMORY-1A §12: friendly도 약하게.
  if (ray.type === 'wall' || ray.type === 'cover') {
    let impR = (bigBore ? 6.0 : 3.0) * PX_PER_M;             // m→px
    for (const u of UNITS) {
      if (!u.alive || u === shooter) continue;
      const d = Math.hypot(u.x - ex, u.y - ey);
      if (d >= impR || d <= UNIT_RADIUS) continue;
      if (_hardWallBetween(ex, ey, u.x, u.y)) continue;       // 두꺼운 벽 반대편 감소(무효)
      const friendly = (u.team === shooter.team);
      let t = 1 - d / impR;
      if (bigBore) t *= 1.3;
      _applyNearMissToUnit(u, shooter, ex, ey, Math.min(1.0, t * 0.8), 'impact_nearby', 0.15, shotId + 'i', friendly);
    }
  }

  // 3) micro HEI / HEIAP (§7)
  const mex = _microExplosiveInfo(ammo);
  if (mex) _triggerMicroExplosive(shooter, ray, weapon, ammo, mex, hitResult, shotId);

  // 4) sabot / incendiary debug 요약 (§3-9, §6, §10)
  if (dbg) {
    const sab = _sabotInfo(ammo);
    if (sab) log(`[debug] ${ammo.id} sabot=${sab.subtype} woundCh=${sab.woundChannelMul} focus=${sab.armorFocusMul}`, 'info');
    if (tracer) log(`[debug] ${ammo.id} tracer=${tracer.color} visT=${tracer.visualThreatMul}`, 'info');
  }
}

// micro-HEI/HEIAP 폭발 트리거 — 작은 burst + 제한적 micro fragment (수류탄급 금지)
function _rayRectEntryT(ox, oy, nx, ny, maxT, r) {
  // 슬랩 검사 — ray가 rect에 들어가는 최소 t (px). 없으면 Infinity.
  let tmin = 0, tmax = maxT;
  for (const [o, d, lo, hi] of [[ox, nx, r.x, r.x + r.w], [oy, ny, r.y, r.y + r.h]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; }
    else { let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return Infinity; }
  }
  return tmin >= 0 ? tmin : Infinity;
}
// micro HE 파편 1발의 장애물 상호작용 비행 (clear/stopped/penetrated/ricochet) — 수류탄급 아님
// SIDE-AMMO-1B-HOTFIX-5: rect 충돌면 법선 (입사방향 반대쪽으로 향하게)
function _rectNormalAt(hx, hy, r, dx, dy) {
  const dl = Math.abs(hx - r.x), dr = Math.abs(hx - (r.x + r.w)), dt = Math.abs(hy - r.y), db = Math.abs(hy - (r.y + r.h));
  const m = Math.min(dl, dr, dt, db);
  let N;
  if (m === dl) N = { x:-1, y:0 }; else if (m === dr) N = { x:1, y:0 }; else if (m === dt) N = { x:0, y:-1 }; else N = { x:0, y:1 };
  if (N.x * dx + N.y * dy > 0) { N.x = -N.x; N.y = -N.y; }   // 입사와 같은 쪽이면 반전 (항상 바깥쪽)
  return N;
}
function _pointInRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
function _fragmentFlight(ex, ey, nx, ny, reachPx, fragPen, breakoutCtx) {
  let nearestT = Infinity, nearObj = null, isWall = false;
  if (MAP_DATA && MAP_DATA.walls) for (const w of MAP_DATA.walls) { const t = _rayRectEntryT(ex, ey, nx, ny, reachPx, w); if (t < nearestT) { nearestT = t; nearObj = w; isWall = true; } }
  if (MAP_DATA && MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) { const t = _rayRectEntryT(ex, ey, nx, ny, reachPx, o); if (t < nearestT) { nearestT = t; nearObj = o; isWall = false; } }
  if (!nearObj || nearestT >= reachPx) {
    return { segs:[{ x1:ex, y1:ey, x2:ex + nx * reachPx, y2:ey + ny * reachPx, segType:'normal' }], endX:ex + nx * reachPx, endY:ey + ny * reachPx, terminal:'clear', penaltyMul:1.0, hitLimitT:reachPx };
  }
  const hx = ex + nx * nearestT, hy = ey + ny * nearestT;
  const armor = (nearObj.armor != null) ? nearObj.armor : (isWall ? 90 : 30);
  const penetrable = nearObj.penetrable === true && !isWall;
  // === Mk211 embedded surface breakout — 폭발을 만든 바로 그 sameSurface에 한해 초기 탈출 보정 ===
  if (breakoutCtx && nearObj === breakoutCtx.surface && nearestT <= breakoutCtx.breakoutPx) {
    const mat = nearObj.material || (isWall ? 'concrete' : 'cover');
    const hardMat = /concrete|steel|ceramic|composite|brick|thick|stone|metal/.test(mat);
    const sz = breakoutCtx.size;
    // 재질/크기별 breakout 성공 확률
    let pSucc;
    if (hardMat) pSucc = (sz === 'large') ? 0.40 : (sz === 'medium') ? 0.20 : 0.10;
    else         pSucc = (sz === 'large') ? 0.85 : (sz === 'medium') ? 0.70 : 0.55;
    if (Math.random() < pSucc) {
      const rest = (reachPx - nearestT) * 0.6;
      return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }, { x1:hx, y1:hy, x2:hx + nx * rest, y2:hy + ny * rest, segType:'penetrated' }],
        endX:hx + nx * rest, endY:hy + ny * rest, terminal:'penetrated', penaltyMul:0.70, hitLimitT:nearestT + rest, breakout:true };
    }
    return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }], endX:hx, endY:hy, terminal:'stopped', penaltyMul:0, hitLimitT:nearestT, breakout:false };
  }
  // 얇은 관통 가능 cover — 낮은 확률 관통
  if (penetrable && fragPen > armor * 0.9 && Math.random() < 0.45) {
    const rest = (reachPx - nearestT) * 0.5;
    return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }, { x1:hx, y1:hy, x2:hx + nx * rest, y2:hy + ny * rest, segType:'penetrated' }],
      endX:hx + nx * rest, endY:hy + ny * rest, terminal:'penetrated', penaltyMul:0.5, hitLimitT:nearestT + rest };
  }
  // 단단한 표면 — 도탄(ricochetBase) 또는 정지. 도탄은 surface normal 기반 reflection.
  const ricBase = (nearObj.ricochetBase != null) ? nearObj.ricochetBase : (isWall ? 0.15 : 0.1);
  if (Math.random() < ricBase) {
    const N = _rectNormalAt(hx, hy, nearObj, nx, ny);
    // reflection R = D - 2(D·N)N
    const dot = nx * N.x + ny * N.y;
    let rx = nx - 2 * dot * N.x, ry = ny - 2 * dot * N.y;
    // reflection이 표면 안쪽을 향하면(법선과 반대) 도탄 취소 → 정지
    if (rx * N.x + ry * N.y <= 0.02) {
      return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }], endX:hx, endY:hy, terminal:'stopped', penaltyMul:0, hitLimitT:nearestT, ricochetCancelled:'reflection_into_surface' };
    }
    // 아주 작은 random spread만 reflection 이후 적용
    const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;
    const spread = (Math.random() * 2 - 1) * 0.18;   // ±~10도
    const ca = Math.cos(spread), sa = Math.sin(spread);
    const sx = rx * ca - ry * sa, sy = rx * sa + ry * ca; rx = sx; ry = sy;
    // 시작점을 표면 바깥으로 0.05m 밀어냄
    const off = 0.05 * PX_PER_M;
    let rsx = hx + N.x * off, rsy = hy + N.y * off;
    // 시작점이 여전히 cover/wall 내부면 도탄 취소
    let inside = false;
    if (MAP_DATA && MAP_DATA.walls) for (const w of MAP_DATA.walls) if (_pointInRect(rsx, rsy, w)) { inside = true; break; }
    if (!inside && MAP_DATA && MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) if (_pointInRect(rsx, rsy, o)) { inside = true; break; }
    if (inside) {
      return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }], endX:hx, endY:hy, terminal:'stopped', penaltyMul:0, hitLimitT:nearestT, ricochetCancelled:'start_inside_cover' };
    }
    // 도탄 segment 재충돌 검사 (다른 벽/cover 통과 금지)
    const rmax = Math.min(reachPx - nearestT, 2 * PX_PER_M);
    let ricT = rmax, ricObj = null;
    if (MAP_DATA && MAP_DATA.walls) for (const w of MAP_DATA.walls) { if (w === nearObj) continue; const t = _rayRectEntryT(rsx, rsy, rx, ry, rmax, w); if (t < ricT) { ricT = t; ricObj = w; } }
    if (MAP_DATA && MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) { if (o === nearObj) continue; const t = _rayRectEntryT(rsx, rsy, rx, ry, rmax, o); if (t < ricT) { ricT = t; ricObj = o; } }
    const rex = rsx + rx * ricT, rey = rsy + ry * ricT;
    return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }, { x1:rsx, y1:rsy, x2:rex, y2:rey, segType:'ricochet' }],
      endX:rex, endY:rey, terminal:'ricochet', penaltyMul:0.45, hitLimitT:nearestT + ricT,
      ricochet:true, surfaceNormal:N, reflectionDir:{ x:rx, y:ry }, ricochetStart:{ x:rsx, y:rsy } };
  }
  return { segs:[{ x1:ex, y1:ey, x2:hx, y2:hy, segType:'normal' }], endX:hx, endY:hy, terminal:'stopped', penaltyMul:0, hitLimitT:nearestT };
}
// 충돌 지점에서 가장 가까운 벽/엄폐물 면의 바깥 법선 (towardX/Y 쪽을 향하도록)
function _surfaceNormalAt(px, py, towardX, towardY) {
  let best = null, bd = Infinity;
  const consider = (rects) => { if (!rects) return; for (const r of rects) {
    const cx = Math.max(r.x, Math.min(px, r.x + r.w)), cy = Math.max(r.y, Math.min(py, r.y + r.h));
    const d = Math.hypot(px - cx, py - cy); if (d < bd) { bd = d; best = r; } } };
  consider(MAP_DATA && MAP_DATA.walls); consider(MAP_DATA && MAP_DATA.coverObjects);
  if (!best) { const ang = Math.atan2(towardY - py, towardX - px); return { nx: Math.cos(ang), ny: Math.sin(ang) }; }
  const dl = Math.abs(px - best.x), dr = Math.abs((best.x + best.w) - px), dt = Math.abs(py - best.y), db = Math.abs((best.y + best.h) - py);
  const m = Math.min(dl, dr, dt, db);
  let nx = 0, ny = 0;
  if (m === dl) nx = -1; else if (m === dr) nx = 1; else if (m === dt) ny = -1; else ny = 1;
  // 사수(바깥) 쪽을 향하도록 보정
  if (nx * (towardX - px) + ny * (towardY - py) < 0) { nx = -nx; ny = -ny; }
  return { nx, ny };
}
// 충돌 지점 근처 벽/엄폐물 rect 반환 (재질/관통성/armor 조회용)
function _coverAt(px, py) {
  let best = null, bd = Infinity, wall = false;
  const consider = (rects, isWall) => { if (!rects) return; for (const r of rects) {
    const cx = Math.max(r.x, Math.min(px, r.x + r.w)), cy = Math.max(r.y, Math.min(py, r.y + r.h));
    const d = Math.hypot(px - cx, py - cy); if (d < bd) { bd = d; best = r; wall = isWall; } } };
  consider(MAP_DATA && MAP_DATA.walls, true); consider(MAP_DATA && MAP_DATA.coverObjects, false);
  if (!best || bd > 4 * PX_PER_M) return null;
  return { material: best.material, armor: best.armor, penetrable: best.penetrable, _isWall: wall };
}
// 원본 rect 반환 (embedded surface breakout 매칭용)
function _coverRectAt(px, py) {
  let best = null, bd = Infinity, wall = false;
  const consider = (rects, isWall) => { if (!rects) return; for (const r of rects) {
    const cx = Math.max(r.x, Math.min(px, r.x + r.w)), cy = Math.max(r.y, Math.min(py, r.y + r.h));
    const d = Math.hypot(px - cx, py - cy); if (d < bd) { bd = d; best = r; wall = isWall; } } };
  consider(MAP_DATA && MAP_DATA.walls, true); consider(MAP_DATA && MAP_DATA.coverObjects, false);
  if (!best || bd > 1.0 * PX_PER_M) return null;   // 폭발점이 표면 내부/바로 근처일 때만
  return { rect: best, isWall: wall };
}
// === SIDE-AMMO-1B-HOTFIX-4: 12.7 micro fragment 실제 충돌/방어구/부위 판정 ===
function _fragBurstAspect(unit, bx, by) {
  const f = unit.facing || 0;
  let rel = Math.atan2(by - unit.y, bx - unit.x) - f;
  while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
  const a = Math.abs(rel);
  if (a < Math.PI / 4) return 'front';
  if (a > 3 * Math.PI / 4) return 'rear';
  return 'side';
}
// 폭발 방향/거리/모드 기반 전신 확률 부위 선택 — chest 고정 금지
function pickFragmentBodyPart(unit, mode, dM) {
  const cone = /forward_cone|unstable_forward_cone/.test(mode || '');
  let w;
  if (cone && dM != null && dM <= 1)      w = { head:4, neck:2, chest:26, abdomen:22, left_arm:12, right_arm:12, left_leg:11, right_leg:11 };
  else if (cone && dM != null && dM <= 3) w = { head:5, neck:3, chest:20, abdomen:18, left_arm:13, right_arm:13, left_leg:14, right_leg:14 };
  else                                     w = { head:6, neck:3, chest:16, abdomen:14, left_arm:13, right_arm:13, left_leg:15, right_leg:15 };  // 사지 높게, 머리 낮게
  let tot = 0; for (const k in w) tot += w[k];
  let r = Math.random() * tot;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'abdomen';   // fallback (chest 아님)
}
const FRAG_PART_TO_SLOT = { head:'head', neck:'neck', chest:'chest', abdomen:'abdomen', left_arm:'arms', right_arm:'arms', left_leg:'legs', right_leg:'legs' };
// 해당 부위 방어구 레이어 샘플 + 파편 관통 판정
function _fragArmorCheck(unit, partLoc, bx, by, fragPenEff) {
  const aspect = _fragBurstAspect(unit, bx, by);
  const slotLoc = FRAG_PART_TO_SLOT[partLoc] || partLoc;
  let slot = null;
  try { slot = getProtectionSlotByAspect(unit, slotLoc, aspect); } catch (e) {}
  if (!slot) return { armorResult:'penetrated', isHard:false, effectiveArmor:0, fragmentPenetrated:true, layer:'none' };
  const hardP = slot.hardP || 0, softP = slot.softP || 0;
  const hardA = (slot.hard && slot.hard.smallArmor) || 0;
  const softA = (slot.soft && slot.soft.smallArmor) || 0;
  const r = Math.random();
  let layer, armorVal, isHard = false;
  if (r < hardP) { layer = 'hard'; armorVal = hardA; isHard = true; }
  else if (r < hardP + softP) { layer = 'soft'; armorVal = softA; }
  else { layer = 'none'; armorVal = 0; }
  let armorResult, pen = false;
  if (layer === 'none' || armorVal <= 0) { armorResult = 'penetrated'; pen = true; }
  else if (isHard) {
    // hard plate — micro fragment 안정 관통 불가 (large도 거의 막힘, 극히 드물게 partial)
    armorResult = (fragPenEff >= armorVal * 1.15 && Math.random() < 0.08) ? 'partial' : 'stopped';
  } else {
    // soft armor
    if (fragPenEff >= armorVal) { armorResult = 'penetrated'; pen = true; }
    else if (fragPenEff >= armorVal * 0.6) { armorResult = 'partial'; }
    else { armorResult = (Math.random() < 0.12) ? 'ricochet' : 'stopped'; }
  }
  return { armorResult, isHard, effectiveArmor:armorVal, fragmentPenetrated:pen, layer };
}
// SIDE-ARMOR-2C §4: coverage-aware protection 기반 fragment 관통 판정 (fragment 원칙 유지 — hard 안정관통 금지)
function _fragArmorCheckFromCoverage(prot, fragPenEff) {
  const pt = prot.protectionType, armorVal = prot.armorValue || 0;
  const isHard = (pt === 'hard');
  let armorResult, pen = false;
  if (pt === 'none' || armorVal <= 0) { armorResult = 'penetrated'; pen = true; }
  else if (isHard) {
    armorResult = (fragPenEff >= armorVal * 1.15 && Math.random() < 0.08) ? 'partial' : 'stopped';   // hard plate — micro fragment 안정관통 불가
  } else {
    if (fragPenEff >= armorVal) { armorResult = 'penetrated'; pen = true; }
    else if (fragPenEff >= armorVal * 0.6) { armorResult = 'partial'; }
    else { armorResult = (Math.random() < 0.12) ? 'ricochet' : 'stopped'; }
  }
  const layer = (prot.armorHitResult && prot.armorHitResult.selectedLayerType) || (isHard ? 'hard' : pt === 'soft' ? 'soft' : 'none');
  return { armorResult, isHard, effectiveArmor:armorVal, fragmentPenetrated:pen, layer };
}
// 단일 파편이 유닛에 닿았을 때 부위/방어구/wound 결정 후 applyDamageEvent
function resolveMicroFragmentImpact(ctx) {
  const u = ctx.hitUnit;
  const part = pickFragmentBodyPart(u, ctx.mode, ctx.distanceM);
  const fragPenEff = ctx.fragPen * ctx.rm;
  // SIDE-ARMOR-2C §4: 복부 / 흉부 측면은 coverage-aware. 그 외 legacy. (내부폭발 body_internal_burst는 이 경로 아님)
  const fragAspect = _fragBurstAspect(u, ctx.ex, ctx.ey);
  const fragSide = (fragAspect === 'left' || fragAspect === 'right' || fragAspect === 'side');
  // ROLLBACK: 파편 방호판정도 legacy _fragArmorCheck 사용 (coverage-aware 제거)
  let ac, covAddr = null, covProt = null;
  ac = _fragArmorCheck(u, part, ctx.ex, ctx.ey, fragPenEff);
  let depth = null, makeWound = false, dmgMul = 1, bleedMul = 1;
  if (ac.armorResult === 'penetrated') {
    depth = _fragWoundDepth(ctx.size, ctx.rm, ctx.penaltyMul);
    if (ctx.size !== 'large' && depth === 'deep_fragment') depth = 'shallow_fragment';   // small/medium deep 금지
    if (ctx.size === 'small' && depth === 'light_deep_fragment') depth = 'shallow_fragment';
    makeWound = true;
  } else if (ac.armorResult === 'partial') {
    depth = (ctx.size === 'large') ? 'shallow_fragment' : (Math.random() < 0.5 ? 'superficial_fragment' : 'shallow_fragment');
    dmgMul = 0.5; bleedMul = 0.5; makeWound = true;
  } else if (ac.armorResult === 'ricochet') {
    depth = 'abrasion'; dmgMul = 0.3; bleedMul = 0.3; makeWound = Math.random() < 0.4;
  } else { // stopped
    if (ac.isHard && ctx.size === 'large' && Math.random() < 0.5) { depth = 'blunt_trauma_armor'; dmgMul = 0.35; bleedMul = 0.0; makeWound = true; }
    else makeWound = false;
  }
  if (!makeWound) return { woundCreated:false, armorResult:ac.armorResult, part, isHard:ac.isHard, effectiveArmor:ac.effectiveArmor, depth:null };
  const baseDmg = ctx.dmg * dmgMul;
  // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 12.7mm micro 에너지 브리지 (micro_explosive — 보수적, 수류탄급 금지)
  let _mRaw = baseDmg, _mPen = fragPenEff, _mBleed = (ctx.bleed * bleedMul), _mEnergyMeta = null;
  if (ctx.fragmentMassG > 0 && ctx.microBudget) {
    const mb = ctx.microBudget;
    const _trait = getFragmentTraitProfile('micro_explosive', null);
    const br = computeFragmentEnergyDamageBridge(baseDmg, fragPenEff, _mBleed, ctx.fragmentMassG, ctx.v, 'micro_explosive', mb.shapeFactor, mb.stabilityFactor, _trait);
    _mRaw = br.equivalentDamage; _mPen = br.equivalentPenetration; _mBleed = br.bleedRisk;
    _mEnergyMeta = { fragmentMassG: +ctx.fragmentMassG.toFixed(4), fragmentVelocityMps: +(ctx.v || 0).toFixed(1), fragmentEnergyJ: br.fragmentEnergyJ, fragmentEnergyClass: br.fragmentEnergyClass,
      fragmentSource: 'micro_explosive', fragmentTier: ctx.size, sourceMassBudgetG: mb.hazardousFragmentMassBudgetG, sourceGeneratedMassTotalG: mb.generatedFragmentMassTotalG,
      parentAmmoId: ctx.ammo && ctx.ammo.id, energyBasedDamage: br.energyDamage, energyBasedPenetration: br.energyPenetration, equivalentDamage: br.equivalentDamage, equivalentPenetration: br.equivalentPenetration, fragmentEnergyDamageBridge: true,
      fragmentShapeFactor: br.fragmentShapeFactor, fragmentStabilityFactor: br.fragmentStabilityFactor, fragmentSharpness: br.fragmentSharpness, fragmentDragFactor: br.fragmentDragFactor, fragmentTumblingChance: br.fragmentTumblingChance, spallMaterialType: null };
  }
  // §4: coverage zone이면 같은 covAddr + armorHitResult를 ev에 부착, 아니면 기존 frag 레이어 표기
  let fragImpactAddr, fragAHR = null;
  fragImpactAddr = { fragArmorLayer:ac.layer, fragArmorResult:ac.armorResult };
  // hitAddress 감쇠 — 파편은 applyOutcome 미경유 → energy bridge 이후 1회만
  const _mHap = (typeof buildHitAddressDamageProfile === 'function') ? buildHitAddressDamageProfile(part, fragImpactAddr, {}) : null;
  const _mhd = _mHap ? _mHap.damageMul : 1.0, _mhb = _mHap ? _mHap.bleedMul : 1.0, _mhp = _mHap ? _mHap.painMul : 1.0, _mhw = _mHap ? _mHap.woundMul : 1.0;
  applyDamageEvent(u, { sourceType:'frag', hitPart:part,
    rawDamage:_mRaw, tissueDamage:_mRaw * _mhd, penetration:_mPen, armorResult:ac.armorResult,
    isFragment:true, fragmentPenetrated:ac.fragmentPenetrated, fragmentSize:ctx.size, fragmentWoundDepth:depth,
    bleedRisk:(_mBleed * _mhb), shockRisk:0.01, painAmount:_mRaw * 1.1 * _mhp,
    distance:ctx.distanceM, fragmentVelocity:ctx.v, ammoId:ctx.ammo.id, weaponId:ctx.weapon && ctx.weapon.id,
    burstId:ctx.shotId, fragmentKind:ctx.fragmentKind,
    impactAddress: fragImpactAddr, armorHitResult: fragAHR,
    originalRawDamage: _mRaw, effectiveRawDamage: _mRaw * _mhw,
    hitAddressDamageProfile: _mHap, hitAddressDamageMul: _mhd, hitAddressWoundMul: _mhw, hitAddressPhysiologyMul: (_mHap ? _mHap.physiologyMul : 1.0),
    fragmentEnergyMeta: _mEnergyMeta,
    fragmentMassG: _mEnergyMeta ? _mEnergyMeta.fragmentMassG : null, fragmentVelocityMps: _mEnergyMeta ? _mEnergyMeta.fragmentVelocityMps : null,
    fragmentEnergyJ: _mEnergyMeta ? _mEnergyMeta.fragmentEnergyJ : null, fragmentEnergyClass: _mEnergyMeta ? _mEnergyMeta.fragmentEnergyClass : null,
    coverageSource: fragAHR && fragAHR.coverageSource, selectedLayerType: fragAHR && fragAHR.selectedLayerType, durabilityOwnerId: fragAHR && fragAHR.durabilityOwnerId });
  // CLEANUP HOTFIX 1: 파편도 applyDamageEvent 이후 recordImpactEvent 호출 → AAR 피격 기록/마커/부상 연결 (본탄과 동일 순서: 피해 후 기록으로 medicalSummaryAfter가 손상 반영).
  try {
    if (typeof recordImpactEvent === 'function' && ctx.shooter) {
      const _fw = (u.medical && u.medical.wounds && u.medical.wounds.length) ? u.medical.wounds[u.medical.wounds.length - 1] : null;
      fragImpactAddr.hitPart = part;
      recordImpactEvent(ctx.shooter, u, fragImpactAddr, {
        sourceType: 'frag', fragmentKind: ctx.fragmentKind, fragmentSize: ctx.size,
        distance: ctx.distanceM, burstId: ctx.shotId,
        armorResult: ac.armorResult, penetrationResult: ac.fragmentPenetrated ? 'penetrated' : 'stopped',
        woundId: _fw ? _fw.id : null,
        medicalSummaryAfter: u.medical ? { lifeStatus: u.medical.lifeStatus, consciousness: u.medical.consciousness } : null
      });
    }
  } catch (e) {}
  return { woundCreated:true, armorResult:ac.armorResult, part, depth, isHard:ac.isHard, effectiveArmor:ac.effectiveArmor };
}
function _triggerMicroExplosive(shooter, ray, weapon, ammo, mex, hitResult, shotId) {
  let ex = ray.x, ey = ray.y;
  let fwdAng = Math.atan2(ey - shooter.y, ex - shooter.x);
  const sz = mex.fragmentSizeChance, vel = mex.fragmentVelocityMps || {};
  const threatM = mex.fragmentThreatRangeM || 3, maxM = mex.fragmentMaxRangeM || 13;
  const maxReachPx = maxM * PX_PER_M;
  const tg = mex.postPenTrigger || {};
  const dmgScale = mex.fragDmgScale != null ? mex.fragDmgScale : 1.0;
  const penScale = mex.fragPenScale != null ? mex.fragPenScale : 1.0;
  const bleedBy = mex.fragmentBleedRiskBySize || FRAG_BLEED_BY_SIZE;
  // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1: 12.7mm secondary fragment 질량 예산 — bodyBurst(내부)·외부 scatter 양쪽이 공유 (단일 선언, TDZ 방지). projectileMassG << budget, HEIAP 더 보수적.
  const _projMassG = (ammo && ammo.projectile && ammo.projectile.massG) || (ammo && ammo.projectileMassG) || 43;
  const _microBudget = buildFragmentMassBudget({ sourceType: 'micro_explosive', projectileMassG: _projMassG, isHEIAP: (mex.type === 'heiap'), fragmentCount: mex.fragmentCount });
  // SIDE-FRAGMENT-MASS-BUDGET-SPLIT-1A: 외부 scatter 예산 — 기본은 전체. body_internal_burst 발생 시 내부에 배정한 만큼 차감(중복 사용 방지).
  let _externalScatterBudgetG = _microBudget.hazardousFragmentMassBudgetG;
  let mode, dirMode, coneDeg = 0, hitUnit = null, dropRatio = 0, triggerScore = 0, centerAng = 0;
  let breakoutSurface = null, embeddedSurfaceBurst = false;
  let coneHalfRand = 0, bodyCtxDbg = null, fuzeActivated = false, aarMode = '';
  const HEMI_HALF = (170 * Math.PI / 180) / 2;
  const matBias = (m) => {
    if (!m) return 0.0;
    if (/drywall|fabric|cloth|light_wood/.test(m)) return -0.25;
    if (/wood/.test(m)) return -0.10;
    if (/glass/.test(m)) return 0.05;
    if (/helmet|face|slaap|head_armor/.test(m)) return 0.25;
    if (/thin_metal|aluminum|vehicle|thin_steel/.test(m)) return 0.25;
    if (/steel|ceramic|composite|titanium|concrete|body_armor|bone/.test(m)) return 0.35;
    return 0.10;
  };
  const surfaceBurstAt = (mName) => {
    const nrm = _surfaceNormalAt(ex, ey, shooter.x, shooter.y);
    centerAng = Math.atan2(nrm.ny, nrm.nx);
    ex += nrm.nx * 0.15 * PX_PER_M; ey += nrm.ny * 0.15 * PX_PER_M;
    mode = mName; dirMode = 'wall_hemisphere';
  };

  if (mex.type === 'hei') {
    // ===== MDZ — 민감 충격신관: 닿는 순간 신관 즉시 활성. 첫 충돌 기준으로 폭발(뒤쪽 hard wall로 미루지 않음) =====
    const fm = mex.mdzFuzeModel || {};
    const onUnit = ray.type === 'unit';
    const surface = (ray.type === 'wall' || ray.type === 'cover');
    // 첫 충돌 지점/재질 — barrierEvents[0]가 있으면 그것을 first impact로 사용 (얇은 벽 여러겹 통과 후 뒤벽 폭발 방지)
    const be = ray.barrierEvents || [];
    let fx = ray.x, fy = ray.y, fex = ray.x, fey = ray.y;   // first impact / first exit
    let mat = hitResult && hitResult.material;
    if (be.length) {
      const f0 = be[0];
      fx = (f0.x != null ? f0.x : ray.x); fy = (f0.y != null ? f0.y : ray.y);
      fex = (f0.exitX != null ? f0.exitX : fx); fey = (f0.exitY != null ? f0.exitY : fy);
      mat = mat || f0.material;
    }
    let coverArmor = null, coverPenetrable = null, isWall = false;
    if (!mat || surface || be.length) {
      const obj = _coverAt(fx, fy);
      if (obj) { mat = mat || obj.material; coverArmor = obj.armor; coverPenetrable = obj.penetrable; isWall = obj._isWall; }
    }
    if (!mat) mat = 'unknown_cover';
    const blockedMDZ = hitResult && (hitResult.outcome === OUTCOME.BLOCK || hitResult.penetrated === false) && !be.length;
    // 첫 충돌 재질 thin / medium / hard 분류
    let cls;
    if (/concrete|steel|ceramic|titanium|composite|thick|hard_cover|armor_plate|high_armor/.test(mat) || isWall || blockedMDZ || (coverArmor != null && coverArmor >= 40)) cls = 'hard';
    else if (/drywall|light_wood|thin_panel|thin_metal|fabric|glass/.test(mat) || coverPenetrable === true || (coverArmor != null && coverArmor < 20)) cls = 'thin';
    else cls = 'medium';
    const hard = cls === 'hard', thin = cls === 'thin';
    const sdd = fm.shortDelayDistanceM || [0.02,0.18];
    const coneRng = fm.shortDelayConeAngleDeg || [60,90];
    // 폭발 기준점을 첫 충돌로 고정
    ex = fx; ey = fy;
    if (onUnit) {
      // 연질 대상 직접 피격 — 접촉점 360도 비산
      mode = 'micro_hei_contact_burst'; dirMode = 'omnidirectional'; aarMode = '직접 피격 / 360도 접촉폭발';
    } else if (thin) {
      // 얇은 장벽/엄폐 — 민감 충격신관: 충돌 표면(entry)에서 즉시폭발이 기본.
      //   드물게(아주 낮은 확률) 표면 직후 미세 지연이지만, exit 뒤가 아니라 entry 기준 아주 작은 offset만 허용.
      const immediate = Math.random() < (fm.thinBarrierImmediateBurstChance || 0.85);
      if (immediate) {
        surfaceBurstAt('micro_hei_surface_burst'); aarMode = '얇은 장벽 표면 즉시폭발(충격신관)';
      } else {
        mode = 'micro_hei_short_delay_air_burst'; dirMode = 'unstable_forward_cone';
        coneDeg = coneRng[0] + Math.random() * (coneRng[1] - coneRng[0]);
        const d = sdd[0] + Math.random() * Math.min(0.08, (sdd[1] - sdd[0]));   // entry 기준 ≤0.08m
        ex = fx + Math.cos(fwdAng) * d * PX_PER_M; ey = fy + Math.sin(fwdAng) * d * PX_PER_M;
        aarMode = '얇은 장벽 표면 직후 미세 지연폭발';
      }
    } else if (hard) {
      // 단단한 표면 — 표면 즉시폭발 (170 분사). 거의 항상 즉시.
      surfaceBurstAt('micro_hei_surface_burst'); aarMode = '단단한 표면 즉시폭발 / 170도 분사';
    } else {
      // 중간 재질 — 충격신관: 기본 표면 즉시폭발. 드물게 entry 기준 미세 지연.
      if (Math.random() < (fm.mediumSurfaceShortDelayChance || 0.10)) {
        mode = 'micro_hei_short_delay_air_burst'; dirMode = 'unstable_forward_cone';
        coneDeg = coneRng[0] + Math.random() * (coneRng[1] - coneRng[0]);
        const d = sdd[0] + Math.random() * Math.min(0.08, (sdd[1] - sdd[0]));   // entry 기준 ≤0.08m
        ex = fx + Math.cos(fwdAng) * d * PX_PER_M; ey = fy + Math.sin(fwdAng) * d * PX_PER_M;
        aarMode = '중간 재질 표면 직후 미세 지연폭발';
      } else { surfaceBurstAt('micro_hei_surface_burst'); aarMode = '표면 즉시폭발 / 170도 분사'; }
    }
    if (GAME.debugUtility) log(`[debug] ${ammo.id} MDZ sensitive fuze cls=${cls} mat=${mat} firstImpact=(${fx.toFixed(0)},${fy.toFixed(0)}) burst=(${ex.toFixed(0)},${ey.toFixed(0)}) mode=${mode}`, 'info');
    fuzeActivated = true;
  } else {
    // ===== Mk211 — 누적 관통력 손실 기반 신관 =====
    const r = hitResult;
    const onUnit = ray.type === 'unit';
    const surface = (ray.type === 'wall' || ray.type === 'cover');
    const blocked = r ? (r.outcome === OUTCOME.BLOCK || r.penetrated === false) : false;
    const ptype = r && r.protectionType;
    // SIDE-AMMO-2B-HOTFIX-0 §5/§6: 누적(cumDrop)이 아니라 단일 충돌 순간 손실률 기반 기폭
    const penEvents = (ray.barrierEvents || []).filter(e => /penetrat|perforat|pass/.test(e.outcome || ''));
    const _evDrop = (ev) => {
      const b = ev.before;
      if (b && b.instantPenLossRatio != null) return b.instantPenLossRatio;
      if (ev.penDropRatio != null) return ev.penDropRatio;
      const m = ev.material || ev.type || '';
      return (/steel|ceramic|concrete|titanium|composite|body_armor/.test(m) ? 0.20 : /thin_metal|aluminum|vehicle|thin_steel/.test(m) ? 0.14 : /helmet|face|slaap/.test(m) ? 0.16 : /wood/.test(m) ? 0.10 : 0.08);
    };
    let maxSingleImpactDrop = 0, lastMeaningfulImpactDrop = 0, cumDrop = 0, maxBias = -1, helmetBonus = 0;
    let selImpactMaterial = null, selImpactOutcome = null, selImpactArmor = 0, selectedFuzeEvent = null;
    for (const ev of penEvents) {
      const m = ev.material || ev.type || '';
      const d = _evDrop(ev);
      cumDrop += d;   // debug only
      if (d > maxSingleImpactDrop) { maxSingleImpactDrop = d; selImpactMaterial = m; selImpactOutcome = ev.outcome; selImpactArmor = (ev.before && ev.before.impactArmor) || (ev.obj && ev.obj.armor) || 0; selectedFuzeEvent = ev; }
      lastMeaningfulImpactDrop = d;
      maxBias = Math.max(maxBias, matBias(m));
      if (/helmet|face|slaap|head/.test(m)) helmetBonus += 0.20;
    }
    let biasSum = penEvents.length ? maxBias : 0;
    if (biasSum < -0.10) biasSum = -0.10;   // 약재질 음수 bias 완화 (누적합 보너스는 제거)
    let lastPen = penEvents.length ? penEvents[penEvents.length - 1] : null;
    const residualPen = (r && r.residualPen != null) ? r.residualPen : null;

    // 관통/정지 분류 — barrierEvents 마지막 이벤트(정지 계열)까지 포함해 final hard stop 판단
    const allEvents = ray.barrierEvents || [];
    const lastEvent = allEvents.length ? allEvents[allEvents.length - 1] : null;
    const finalHardStop = !!(lastEvent && /stop|block|ricochet|residual|depleted|shot_dead|absorb/.test(lastEvent.outcome || ''));
    const surfacePenetrated = surface && r && r.penetrated === true;
    // 표면 관통이지만 barrierEvents가 비어있으면 표면 재질로 drop/bias 보강
    if (surfacePenetrated && !penEvents.length) {
      const m = (r && r.material) || '';
      maxSingleImpactDrop = (/steel|ceramic|concrete|titanium|composite/.test(m) ? 0.20 : /thin_metal|aluminum|vehicle/.test(m) ? 0.14 : /wood/.test(m) ? 0.08 : 0.05);
      lastMeaningfulImpactDrop = maxSingleImpactDrop; cumDrop = maxSingleImpactDrop;
      selImpactMaterial = m; selImpactOutcome = 'surface_penetrated'; selImpactArmor = (r && r.barrierArmor) || 0;
      biasSum = matBias(m);
    }
    // 단일 충돌 손실률 기반 fuzeScore (누적합 사용 안 함). 기폭 게이트는 maxSingleImpactDrop(실제 단일 손실률).
    const fuzeScore = maxSingleImpactDrop + biasSum + helmetBonus;
    const airCandidate = (penEvents.length > 0 || surfacePenetrated);
    // 최종이 wall/cover인데 관통이 아님 → 정지 (penEvents가 있어도, hitResult가 없어도 잡는다)
    const finalWallStop = surface && !surfacePenetrated;
    const stopped = blocked || finalHardStop || finalWallStop;
    const minFuze = tg.minSingleImpactDropForFuze || 0.06;
    // §6 단일 충돌 손실률 → 기폭 확률 밴드 (낮음/중간/높음/거의확정)
    const _fuzeProb = (drop) => {
      const pref = tg.preferredSingleImpactDropForFuze || 0.10, strong = tg.strongSingleImpactDropForFuze || 0.16, nearC = tg.nearCertainSingleImpactDropForFuze || 0.22;
      if (drop < minFuze) return 0;
      if (drop < pref) return 0.25;          // 0.06~0.09 낮음
      if (drop < strong) return 0.45;        // 0.10~0.15 정상
      if (drop < nearC) return 0.65;         // 0.16~0.21 높음
      return 0.90;                            // 0.22+ 거의 확정 (hard stop은 별도)
    };

    // 게이트: 단일 충돌 손실률 minSingle 이상 + 확률 통과 시 신관 활성 (drywall/약장벽 누적 airburst 방지)
    if (airCandidate && !onUnit && maxSingleImpactDrop >= minFuze && Math.random() < _fuzeProb(maxSingleImpactDrop)) {
      // 1) 관통 후 공중 지연폭발 우선 — surface burst보다 먼저
      fuzeActivated = true;
      mode = 'micro_heiap_air_post_burst'; dirMode = 'forward_cone'; coneDeg = 30;
      triggerScore = fuzeScore; dropRatio = maxSingleImpactDrop;
      // §3/§7: 폭발 앵커는 lastPen이 아니라 기폭 원인 이벤트(selectedFuzeEvent)의 exit 기준
      let exitX, exitY, anchorSrc;
      const _anchor = selectedFuzeEvent || lastPen;
      if (_anchor) {
        if (_anchor.exitX != null) { exitX = _anchor.exitX; exitY = _anchor.exitY; anchorSrc = 'eventExit'; }
        else {
          // 같은 obj의 직후 'exit' 이벤트 검색 (pairedExit)
          const all = ray.barrierEvents || [];
          let paired = null;
          const idx = all.indexOf(_anchor);
          for (let k = idx + 1; k < all.length; k++) { if (all[k].outcome === 'exit' && all[k].obj === _anchor.obj) { paired = all[k]; break; } }
          if (paired) { exitX = paired.x; exitY = paired.y; anchorSrc = 'pairedExit'; }
          else { exitX = _anchor.x; exitY = _anchor.y; anchorSrc = 'eventEntryFallback'; }
        }
      } else { exitX = ray.x; exitY = ray.y; anchorSrc = 'rayPoint'; }
      const off = (mex.barrierAirBurstOffsetM || [0.5,1.2]); const d = off[0] + Math.random() * (off[1] - off[0]);
      ex = exitX + Math.cos(fwdAng) * d * PX_PER_M; ey = exitY + Math.sin(fwdAng) * d * PX_PER_M;
      aarMode = '단일 충돌 관통력 손실 / 신관 활성화 / 공중 지연폭발';
      if (GAME.debugUtility) log(`[debug] ${ammo.id} airPost sel=${selImpactMaterial||'surface'}/${selImpactOutcome||'penetrated'} armor=${selImpactArmor} maxSingleImpactDrop=${maxSingleImpactDrop.toFixed(3)} (cumDrop=${cumDrop.toFixed(2)} debug) anchor=(${exitX.toFixed(0)},${exitY.toFixed(0)})/${anchorSrc} fuzeScore=${fuzeScore.toFixed(2)} offsetM=${d.toFixed(2)} burst=(${ex.toFixed(0)},${ey.toFixed(0)})`, 'info');
    } else if (onUnit && r) {
      // 2) 최종 충돌이 unit — 인체 관통 저항 컨텍스트 (unit 명중만으로 burst 확정 아님)
      const aspect = r.hitAspect || '';
      let dir = 'front';
      if (/side|left|right/.test(aspect)) dir = 'side'; else if (/rear|back/.test(aspect)) dir = 'rear'; else if (/oblique|angle/.test(aspect)) dir = 'oblique';
      const penBefore = (r.residualPen != null ? r.residualPen : (ammo.penetration || 40));
      const bc = _computeBodyPenetrationContext(ray.unit, r, penBefore, dir);
      bodyCtxDbg = bc;
      // §8: 방탄복 판정이 만든 순간 관통력 손실률 우선 사용 (소프트/하드 하드코딩 대신)
      const armorPenLossRatio = (r.instantArmorPenLossRatio != null) ? r.instantArmorPenLossRatio : (ptype === 'hard' ? 0.20 : ptype === 'soft' ? 0.10 : 0);
      const armorBonus = armorPenLossRatio;
      const score = maxSingleImpactDrop + biasSum + helmetBonus + armorBonus + bc.bodyPenetrationDropRatio + bc.bodyTriggerBias;
      triggerScore = score; dropRatio = Math.max(maxSingleImpactDrop, armorPenLossRatio);
      const lowResistance = (!ptype || ptype === 'none') && !bc.boneHit && bc.overpenetratedBody && score < (tg.minSingleImpactDropForFuze || 0.06);
      if (lowResistance || score < (tg.minSingleImpactDropForFuze || 0.06)) {
        if (GAME.debugUtility) log(`[debug] ${ammo.id} Mk211 ${lowResistance?'low-resistance overpenetration':'weak pass-through'} / fuze OFF score=${score.toFixed(2)} penAfter=${bc.projectilePenAfterBody.toFixed(0)}`, 'info');
        log(`Mk211 HEIAP: ${lowResistance ? 'low-resistance target overpenetration / 신관 비활성 / 중심 관통자 피해만 적용' : 'weak armor pass-through / no fuze activation'}`, 'info');
        return;
      }
      fuzeActivated = true;
      const rearArmor = _unitRearPlateArmor(ray.unit);
      const rearStops = bc.bodyPenetrated && rearArmor > 0 && bc.projectilePenAfterBody <= rearArmor;
      if (bc.bodyStopped) {
        mode = 'body_internal_burst'; dirMode = 'forward_cone'; coneDeg = 30; hitUnit = ray.unit; aarMode = '인체에서 정지 / 국소 내부폭발';
      } else if (rearStops) {
        mode = 'body_internal_burst'; dirMode = 'forward_cone'; coneDeg = 30; hitUnit = ray.unit; aarMode = '전면판·인체 관통 후 후면판 정지 / 내부폭발 판정';
      } else {
        mode = 'micro_heiap_post_body_air_burst'; dirMode = 'forward_cone'; coneDeg = 30;
        const off = (mex.postBodyAirBurstOffsetM || [0.3,1.0]); const d = off[0] + Math.random() * (off[1] - off[0]);
        ex += Math.cos(fwdAng) * d * PX_PER_M; ey += Math.sin(fwdAng) * d * PX_PER_M;
        aarMode = '인체 관통 저항으로 신관 활성 / 출구 후 공중폭발';
      }
    } else if (stopped) {
      // 3) 막힘(정지/blocked/final hard stop) — 최종 단단한 표면에서 표면폭발 (170 분사)
      const stopMat = (lastEvent && lastEvent.material) || (r && r.material) || '';
      if (lastEvent && lastEvent.x != null) { ex = lastEvent.x; ey = lastEvent.y != null ? lastEvent.y : ey; }
      // embedded surface burst — 폭발을 만든 sameSurface 포착 (offset 전 표면 위치 기준)
      const _bs = _coverRectAt(ex, ey);
      if (_bs) { breakoutSurface = _bs.rect; embeddedSurfaceBurst = true; }
      surfaceBurstAt('micro_heiap_surface_burst');
      dropRatio = 0.58; triggerScore = dropRatio + (matBias(stopMat) || 0.35);
      const viaBarrier = penEvents.length > 0;
      aarMode = viaBarrier ? 'final hard stop / 장벽 관통 후 단단한 표면 정지 / 표면폭발' : 'stopped on hard surface / 단단한 표면 정지 / 표면폭발';
      if (GAME.debugUtility) log(`[debug] ${ammo.id} finalHardStop=${finalHardStop} stopped=true penEvents=${penEvents.length} lastEvent=${lastEvent?lastEvent.outcome:'-'}/${stopMat} finalRay=${ray.type} mode=${mode} burst=(${ex.toFixed(0)},${ey.toFixed(0)})`, 'info');
    } else {
      // 4) 관통했으나 fuze 부족 / 조건 미달 — burst 없음
      if (GAME.debugUtility) log(`[debug] ${ammo.id} airPostCandidate=${airCandidate} fuzeScore=${fuzeScore.toFixed(2)}<${minFuze} / 신관 비활성 / burst 없음`, 'info');
      return;
    }
  }
  if (!mode) return;

  const burstRadiusM = (mode === 'micro_hei_burst' || mode === 'micro_hei_contact_burst' || mode === 'micro_hei_surface_burst' || mode === 'micro_hei_short_delay_air_burst') ? (mex.burstRadiusM || 1.0)
    : (mode === 'micro_heiap_surface_burst') ? mex.surfaceBurstRadiusM : mex.postPenBurstRadiusM;
  if (typeof GAME !== 'undefined' && GAME.fxList) GAME.fxList.push({ type:'explosion', x:ex, y:ey, radius: Math.max(10, burstRadiusM * PX_PER_M * 1.1), life:0.34, maxLife:0.34 });
  emitNoise(ex, ey, { type:'impact', team:shooter.team, sourceUnitId:shooter.id });

  // burst 주변 near miss
  const nmR = (mex.nearMissRadiusM || 2.0) * PX_PER_M;
  for (const u of UNITS) {
    if (!u.alive || u === shooter || u === hitUnit) continue;
    const d = Math.hypot(u.x - ex, u.y - ey); const dM = d / PX_PER_M;
    if (d >= nmR || d <= UNIT_RADIUS) continue;
    if (_hardWallBetween(ex, ey, u.x, u.y)) continue;
    let t = (1 - d / nmR) * (mex.nearMissSuppressionMul || 1.3) * _fragRangeMul(dM, threatM, maxM);
    if (u.team === shooter.team) t *= 0.5;
    _applyNearMissToUnit(u, shooter, ex, ey, Math.min(1.1, t), 'fragment_near_miss', 0.2, shotId + 'x');
  }

  // Mk211 body internal burst (직접 명중 대상 — 국소 internal disruption)
  if (hitUnit && mex.bodyBurstEffect && mex.bodyBurstEffect.enabled) {
    const bb = mex.bodyBurstEffect;
    const part = (hitResult && hitResult.bodyPart) || (Math.random() < 0.5 ? 'chest' : 'abdomen');
    const nW = bb.internalFragmentWoundCount;
    const count = Math.max(nW.min, Math.min(nW.max, nW.min + Math.floor(Math.random() * (nW.max - nW.min + 1))));
    // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1A: 내부 burst 전용 질량 예산 — secondaryFragmentMassBudgetG의 35%만 배정 (외부 scatter와 질량 중복 복사 금지, projectileMass/관통자 미사용)
    const _ibBudgetG = Math.min(0.9, _microBudget.hazardousFragmentMassBudgetG * 0.35);
    _externalScatterBudgetG = Math.max(0, _microBudget.hazardousFragmentMassBudgetG - _ibBudgetG);   // 외부는 나머지만 (내부+외부 합 = 전체 예산)
    const _ibMasses = allocateTierFragmentMasses(count, _ibBudgetG);
    const _ibGenTotal = +(_ibMasses.reduce((a, b) => a + b, 0)).toFixed(4);
    for (let i = 0; i < count; i++) {
      const size = _rollFragSize(sz);
      const baseDmg = FRAG_DMG_BY_SIZE[size] * dmgScale * bb.internalDamageMul;
      const basePen = FRAG_PEN_BY_SIZE[size] * penScale;
      const baseBleed = bleedBy[size] * bb.internalBleedMul * (size === 'large' ? 1.4 : 1.0);
      // 내부 burst 파편 속도 — 관통 후 체내 폭발이므로 외부보다 느림 (damp)
      const _ibVel = _rollFragVel(vel, size) * 0.5;
      const _ibMassG = (_ibMasses[i] != null) ? _ibMasses[i] : 0;
      let _ibRaw = baseDmg, _ibPen = basePen, _ibBleed = baseBleed, _ibMeta = null;
      if (_ibMassG > 0) {
        const _trait = getFragmentTraitProfile('micro_explosive', null);
        const br = computeFragmentEnergyDamageBridge(baseDmg, basePen, baseBleed, _ibMassG, _ibVel, 'micro_explosive', _microBudget.shapeFactor, _microBudget.stabilityFactor, _trait);
        _ibRaw = br.equivalentDamage; _ibPen = br.equivalentPenetration; _ibBleed = br.bleedRisk;
        _ibMeta = { fragmentMassG: +_ibMassG.toFixed(4), fragmentVelocityMps: +_ibVel.toFixed(1), fragmentEnergyJ: br.fragmentEnergyJ, fragmentEnergyClass: br.fragmentEnergyClass,
          fragmentSource: 'micro_explosive', fragmentContext: 'body_internal_burst', fragmentTier: size, sourceMassBudgetG: +_ibBudgetG.toFixed(3), sourceGeneratedMassTotalG: _ibGenTotal,
          parentAmmoId: ammo.id, energyBasedDamage: br.energyDamage, energyBasedPenetration: br.energyPenetration, equivalentDamage: br.equivalentDamage, equivalentPenetration: br.equivalentPenetration, fragmentEnergyDamageBridge: true,
          fragmentShapeFactor: br.fragmentShapeFactor, fragmentStabilityFactor: br.fragmentStabilityFactor, fragmentSharpness: br.fragmentSharpness, fragmentDragFactor: br.fragmentDragFactor, fragmentTumblingChance: br.fragmentTumblingChance, spallMaterialType: null };
      }
      // hitAddress 감쇠 — internalBurst(deep/central)는 보통 default 1.0이나 일관성 위해 동일 경로 1회 적용
      const _ibHap = (typeof buildHitAddressDamageProfile === 'function') ? buildHitAddressDamageProfile(part, { internalBurst: true }, {}) : null;
      const _ibhd = _ibHap ? _ibHap.damageMul : 1.0, _ibhb = _ibHap ? _ibHap.bleedMul : 1.0, _ibhp = _ibHap ? _ibHap.painMul : 1.0, _ibhw = _ibHap ? _ibHap.woundMul : 1.0;
      applyDamageEvent(hitUnit, { sourceType:'frag', hitPart:part, rawDamage:_ibRaw, tissueDamage:_ibRaw * _ibhd,
        penetration:_ibPen, armorResult:'penetrated', isFragment:true, fragmentPenetrated:true, fragmentSize:size, internalBurst:true, fragmentWoundDepth:'deep_fragment',
        bleedRisk:_ibBleed * _ibhb, shockRisk:0.04 * bb.shockMul, painAmount:_ibRaw * 1.1 * bb.painMul * _ibhp, fractureRisk:0.12 * bb.fractureMul,
        distance:0.3, ammoId:ammo.id, weaponId:weapon && weapon.id, impactAddress:{ internalBurst:true },
        originalRawDamage:_ibRaw, effectiveRawDamage:_ibRaw * _ibhw,
        hitAddressDamageProfile:_ibHap, hitAddressDamageMul:_ibhd, hitAddressWoundMul:_ibhw, hitAddressPhysiologyMul:(_ibHap ? _ibHap.physiologyMul : 1.0),
        fragmentEnergyMeta:_ibMeta,
        fragmentMassG:_ibMeta ? _ibMeta.fragmentMassG : null, fragmentVelocityMps:_ibMeta ? _ibMeta.fragmentVelocityMps : null,
        fragmentEnergyJ:_ibMeta ? _ibMeta.fragmentEnergyJ : null, fragmentEnergyClass:_ibMeta ? _ibMeta.fragmentEnergyClass : null, fragmentContext:'body_internal_burst' });
    }
    log(`💥 Mk211 HEIAP: ${aarMode} / secondary fragment wounds ${count}`, 'warn');
    if (GAME.debugUtility) log(`[debug] ${ammo.id} ${mode} part=${part} secWounds=${count} ibBudget=${_ibBudgetG.toFixed(2)}g ibGen=${_ibGenTotal}g score=${triggerScore.toFixed(2)} bodyCtx penB=${bodyCtxDbg?bodyCtxDbg.projectilePenBeforeBody.toFixed(0):'-'} penA=${bodyCtxDbg?bodyCtxDbg.projectilePenAfterBody.toFixed(0):'-'}`, 'info');
  }

  // === 외부 파편 (fragmentCount개, 실제 raycast + 부위/방어구 판정 + 거리감쇠 + 아군/자기파편 포함) ===
  const halfCone = (coneDeg * Math.PI / 180) / 2;
  let created = 0, friendlyHits = 0, selfHits = 0, fragHits = 0; const rolls = { small:0, medium:0, large:0 };
  let breakoutOK = 0, breakoutFail = 0;
  const woundsBySize = { small:0, medium:0, large:0 };
  const term = { clear:0, stopped:0, penetrated:0, ricochet:0 };
  const armorStat = { penetrated:0, partial:0, stopped:0, ricochet:0 }; const perUnit = {};
  const fragKind = (mex.type === 'hei') ? 'micro_hei' : 'micro_heiap';
  // 외부 scatter — 위에서 선언한 _microBudget 공유. tier별 개별 파편 질량 사전 배분.
  const _microSizes = [], _microSizeW = [];
  for (let _mi = 0; _mi < mex.fragmentCount; _mi++) { const _ms = _rollFragSize(sz); _microSizes.push(_ms); _microSizeW.push(_ms === 'large' ? 3.0 : _ms === 'medium' ? 1.6 : 1.0); }
  const _microWSum = _microSizeW.reduce((a, b) => a + b, 0) || 1;
  const _microMasses = _microSizeW.map(w => _externalScatterBudgetG * w / _microWSum);
  _microBudget.generatedFragmentMassTotalG = +(_microMasses.reduce((a, b) => a + b, 0)).toFixed(3);
  for (let i = 0; i < mex.fragmentCount; i++) {
    const size = _microSizes[i]; rolls[size]++;
    const v = _rollFragVel(vel, size);
    const fragPen = FRAG_PEN_BY_SIZE[size] * penScale;
    const ang = (dirMode === 'forward_cone' || dirMode === 'unstable_forward_cone') ? fwdAng + (Math.random() * 2 - 1) * halfCone
              : (dirMode === 'wall_hemisphere') ? centerAng + (Math.random() * 2 - 1) * HEMI_HALF
              : Math.random() * Math.PI * 2;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    const reach = maxReachPx * (0.5 + Math.random() * 0.5);
    const fl = _fragmentFlight(ex, ey, nx, ny, reach, fragPen, breakoutSurface ? { surface:breakoutSurface, breakoutPx:0.5 * PX_PER_M, size } : null);
    term[fl.terminal] = (term[fl.terminal] || 0) + 1;
    if (fl.breakout === true) breakoutOK++; else if (fl.breakout === false) breakoutFail++;
    let endType = (fl.terminal === 'stopped') ? 'wall_blocked' : 'range';
    let hu = null, hd = Infinity, huSeg = -1;
    // segment별 유닛 충돌 검사 (initial + ricochet) — start→end 단일 직선 금지
    let segStart = 0;
    for (let si = 0; si < fl.segs.length; si++) {
      const sg = fl.segs[si];
      const segLen = Math.hypot(sg.x2 - sg.x1, sg.y2 - sg.y1) || 0.0001;
      for (const u of UNITS) {
        // shooter도 자기 파편에 맞을 수 있음. 내부burst 직접대상(hitUnit)만 외부파편 제외.
        if (!u.alive || u.isDead || u === hitUnit) continue;
        const dd = pointSegmentDistance(u.x, u.y, sg.x1, sg.y1, sg.x2, sg.y2);
        if (dd > UNIT_RADIUS) continue;
        const proj = Math.max(0, Math.min(1, ((u.x - sg.x1) * (sg.x2 - sg.x1) + (u.y - sg.y1) * (sg.y2 - sg.y1)) / (segLen * segLen)));
        const along = segStart + proj * segLen;
        if (along < hd) {
          if (_hardWallBetween(sg.x1, sg.y1, u.x, u.y)) continue;   // 해당 segment 시작점 기준 차폐
          hu = u; hd = along; huSeg = si;
        }
      }
      segStart += segLen;
    }
    if (hu) {
      const dM = hd / PX_PER_M, rm = _fragRangeMul(dM, threatM, maxM) * fl.penaltyMul;
      const onRicochet = huSeg >= 0 && fl.segs[huSeg] && fl.segs[huSeg].segType === 'ricochet';
      if (rm > 0.15 && (perUnit[hu.id] || 0) < 6) {
        perUnit[hu.id] = (perUnit[hu.id] || 0) + 1; fragHits++;
        const res = resolveMicroFragmentImpact({ hitUnit:hu, shooter, ex, ey, mode, dirMode, size, rm, fragPen,
          dmg: FRAG_DMG_BY_SIZE[size] * dmgScale * rm, bleed: bleedBy[size] * rm * (fl.penaltyMul != null ? fl.penaltyMul : 1),
          penaltyMul: fl.penaltyMul, v, ammo, weapon, shotId, distanceM:dM, fragmentKind:fragKind,
          fragmentMassG: _microMasses[i], microBudget: _microBudget });
        armorStat[res.armorResult] = (armorStat[res.armorResult] || 0) + 1;
        if (res.woundCreated) {
          created++; woundsBySize[size]++;
          if (hu === shooter) selfHits++; else if (hu.team === shooter.team) friendlyHits++;
        }
        fl.segs[huSeg].x2 = hu.x; fl.segs[huSeg].y2 = hu.y;
        endType = res.woundCreated ? 'unit' : 'armor_blocked';
        if (GAME.debugUtility) log(`[debug] frag#${i} ${fragKind} size=${size} seg${huSeg}${onRicochet?'/ricochet':''} dM=${dM.toFixed(1)} rm=${rm.toFixed(2)} part=${res.part} armor=${res.armorResult}(eff${(res.effectiveArmor||0).toFixed(0)}${res.isHard?'/hard':''}) wound=${res.woundCreated}${res.depth?'/'+res.depth:''}${hu===shooter?' SELF':''}`, 'info');
      } else if (rm > 0) {
        _applyNearMissToUnit(hu, shooter, ex, ey, Math.min(0.6, rm), 'fragment_near_miss', 0.1, shotId + 'f' + i);
      }
    }
    if (typeof GAME !== 'undefined' && GAME.fxList) GAME.fxList.push({ type:'fragment_ray', tierName:size, endType, segments:fl.segs, life:0.5, maxLife:0.5 });
  }

  const tag = (mex.type === 'hei') ? 'MDZ HEI' : 'Mk211 HEIAP';
  const isCone = (dirMode === 'forward_cone' || dirMode === 'unstable_forward_cone');
  if (isCone) log(`💥 ${tag} ${mode}: cone fragments ${mex.fragmentCount} / hits ${fragHits} / wounds ${created}`, 'warn');
  else log(`💥 ${tag}: ${aarMode} / scatter fragments ${mex.fragmentCount} / wounds ${created}`, 'warn');
  log(`12.7 micro fragment: small ×${woundsBySize.small} / medium ×${woundsBySize.medium} / large ×${woundsBySize.large} (관통${armorStat.penetrated}/부분${armorStat.partial}/막힘${armorStat.stopped}/도탄${armorStat.ricochet})`, 'info');
  if (selfHits > 0) log(`⚠ 자기 파편 피해 (self-fragment wound) ×${selfHits}`, 'danger');
  if (friendlyHits > 0) log(`⚠ 아군 파편 피해 (friendly micro fragment wound) ×${friendlyHits}`, 'danger');
  if (GAME.debugUtility) log(`[debug] ${ammo.id} mode=${mode} dir=${dirMode}${coneDeg?' cone'+coneDeg.toFixed(0):''} fuze=${fuzeActivated} hits${fragHits} wounds${created}(아군${friendlyHits}/자기${selfHits}) armor[pen${armorStat.penetrated}/part${armorStat.partial}/stop${armorStat.stopped}/ric${armorStat.ricochet}] obstacle[clear${term.clear}/stop${term.stopped}/pen${term.penetrated}/ric${term.ricochet}]${embeddedSurfaceBurst?` embeddedBurst breakout[ok${breakoutOK}/fail${breakoutFail}]`:''} score${triggerScore.toFixed(2)}`, 'info');
  return { detonated:true, mode, burstPoint:{ x:ex, y:ey }, consumesPrimaryProjectile: mex.consumesPrimaryProjectileOnDetonation === true };
}
// 유닛 후면 하드플레이트 방호수치 (Mk211 후면판 정지 판단 scaffold)
function _unitRearPlateArmor(unit) {
  if (!unit) return 0;
  const ids = [unit.backPlateId, unit.rearPlateId, unit.backPlate, (unit.loadout && unit.loadout.backPlateId)];
  for (const id of ids) {
    if (id && typeof PLATE_PRESETS !== 'undefined' && PLATE_PRESETS[id]) {
      const p = PLATE_PRESETS[id];
      return (p.effectiveArmor != null) ? p.effectiveArmor : (p.hardArmor || 0) + (p.backingArmor || 0);
    }
  }
  return 0;
}

function updateVisibility() {
  for (const e of UNITS) {
    if (e.team !== 'enemy') continue;
    let seen = false;
    for (const f of UNITS) {
      if (!f.alive || f.team !== 'friend') continue;
      if (canSee(f, e)) { seen = true; break; }
    }
    if (seen) {
      if (!e._spotted && e.alive) log(`[적 발견] ${e.name}`, 'spot');
      e._spotted = true;
      e._lastSeenAt = GAME.gameTime;
    } else if (e._spotted && (GAME.gameTime - e._lastSeenAt) > 1.5) {
      e._spotted = false;
    }
  }
}

// =============================================================
