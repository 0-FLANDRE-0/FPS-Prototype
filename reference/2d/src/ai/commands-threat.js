// [AI0-A] CANONICAL THREAT EVIDENCE — 시각/소리/피격/근접탄/수류탄을 하나의 증거 목록으로 모은다.
//   AI0-A에서는 additive 기록 계층이다(소비자 재배선은 AI0-D). 기존 필드는 그대로 유지된다.
// ════════════════════════════════════════════════════════════════════════════
const THREAT_EVIDENCE_KINDS = ['visual', 'sound', 'hit', 'near_miss', 'grenade'];
const THREAT_EVIDENCE_MAX = 24;
const THREAT_EVIDENCE_CONFIDENCE = { visual: 1.0, hit: 0.8, near_miss: 0.6, grenade: 0.7, sound: 0.45 };
let _threatEvidenceSeq = 0;
// [HF1] 같은 사건이 매 tick 누적되지 않도록 최소 cooldown (초). sound/hit/near_miss/grenade는 event id로도 dedup.
const THREAT_EVIDENCE_COOLDOWN = { visual: 0.25, sound: 0, hit: 0, near_miss: 0, grenade: 0 };
function ensureThreatEvidence(unit) {
  const mem = ensureAIMemory(unit);
  if (!Array.isArray(mem.threatEvidence)) mem.threatEvidence = [];
  return mem.threatEvidence;
}
function _threatEvidenceKey(ev) {
  const dirQ = (ev.direction != null) ? Math.round(ev.direction / (Math.PI / 8)) : 'n';
  return [ev.type, (ev.sourceUnitId != null ? ev.sourceUnitId : 'u'), (ev.sourceEventId != null ? ev.sourceEventId : 'e'), dirQ].join('|');
}
// positionKnown=false면 방향만 아는 증거(소리 등) — 정확한 적 위치로 승격하지 않는다
function recordThreatEvidence(unit, ev) {
  if (!unit || !ev) return null;
  const kind = ev.kind || ev.type;
  if (THREAT_EVIDENCE_KINDS.indexOf(kind) < 0) return null;
  const list = ensureThreatEvidence(unit);
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  const positionKnown = !!ev.positionKnown;
  // [HF1] positionKnown=false면 정확 좌표를 저장하지 않는다(소리·근접탄 위치 승격 금지)
  const x = positionKnown && ev.x != null ? ev.x : null;
  const y = positionKnown && ev.y != null ? ev.y : null;
  const direction = (ev.direction != null) ? ev.direction
    : (ev.dirRad != null) ? ev.dirRad
    : ((ev.x != null && ev.y != null) ? Math.atan2(ev.y - unit.y, ev.x - unit.x) : null);
  const conf = (ev.confidence != null) ? ev.confidence : (THREAT_EVIDENCE_CONFIDENCE[kind] || 0.4);
  const rec = {
    evidenceId: (++_threatEvidenceSeq),
    kind, type: kind,
    x, y, dirRad: direction, direction,
    positionKnown,
    angularUncertainty: (ev.angularUncertainty != null) ? ev.angularUncertainty : (positionKnown ? 0 : 0.35),
    distanceMin: (ev.distanceMin != null) ? ev.distanceMin : null,
    distanceMax: (ev.distanceMax != null) ? ev.distanceMax : null,
    radius: (ev.radius != null) ? ev.radius : 0,
    confidence: conf,
    danger: (ev.danger != null) ? ev.danger : conf,
    sourceUnitId: (ev.sourceUnitId != null) ? ev.sourceUnitId : null,
    sourceEventId: (ev.sourceEventId != null) ? ev.sourceEventId : null,
    at: now, observedAt: now,
    expiresAt: (ev.ttl != null) ? now + ev.ttl : null,
    updateCount: 0,
  };
  // dedup — 같은 사건이면 새 항목을 만들지 않고 최신값만 갱신
  const key = _threatEvidenceKey(rec);
  const cd = THREAT_EVIDENCE_COOLDOWN[kind] || 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (_threatEvidenceKey(e) !== key) continue;
    if (cd > 0 && (now - e.observedAt) > cd) break;   // cooldown 지난 visual은 새 항목 허용
    e.observedAt = now; e.at = now;
    e.confidence = rec.confidence; e.danger = rec.danger;
    e.expiresAt = rec.expiresAt; e.updateCount = (e.updateCount || 0) + 1;
    if (e.positionKnown && rec.positionKnown) { e.x = rec.x; e.y = rec.y; }
    e.direction = rec.direction; e.dirRad = rec.direction;
    return e;
  }
  list.push(rec);
  while (list.length > THREAT_EVIDENCE_MAX) list.shift();
  return rec;
}
function getThreatEvidence(unit, opts) {
  const list = ensureThreatEvidence(unit);
  const o = opts || {};
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  const maxAge = (o.maxAge != null) ? o.maxAge : 12;
  return list.filter(e => (now - e.at) <= maxAge && (!o.kind || e.kind === o.kind));
}
// ════════════════════════════════════════════════════════════════════════════
// [AI0-A] AI COMMAND GATEWAY — 자율 AI의 이동/자세 명령 단일 발급 계층.
//   이 패치 이후 자율 AI가 movePath를 직접 교체하는 곳은 _aiWriteCommandPath() 하나뿐이다.
//   예외(직접 write 허용): 플레이어 입력, 명시적 의료 접근, movement executor 종료, reset/respawn,
//   그리고 사망/downed 등 hard state 강제 정리.
//   AI0-A 단계에서는 구형 자동엄폐/소음 행동을 제거하지 않고 legacy adapter source로 gateway를 경유시켜
//   기존 행동을 그대로 보존한다(제거는 AI0-D).
// ════════════════════════════════════════════════════════════════════════════
const AI_COMMAND_PRIORITY = {
  hard_state: 1000,
  immediate_grenade: 900,
  player: 800,
  medical: 750,
  acute_survival: 700,
  legacy_behavior: 410,   // [AI0-A 한시] 구형 자동엄폐/소음 — utility보다 뒤에 실행되어 현재 우선하므로 값도 그 순서를 보존한다. AI0-D에서 제거.
  utility: 400,
  idle: 100,
};
const AI_COMMAND_SOURCES = Object.keys(AI_COMMAND_PRIORITY);
const AI_COMMAND_TRACE_MAX = 30;
let _aiCommandSeq = 0;
function ensureAICommandState(unit) {
  if (!unit) return null;
  if (!unit.aiCommandState) {
    unit.aiCommandState = { current: null, suspended: null, lastAcceptedTick: -1 };
  }
  if (!Array.isArray(unit.aiCommandTrace)) unit.aiCommandTrace = [];
  return unit.aiCommandState;
}
function getAICommandPriority(source) {
  const p = AI_COMMAND_PRIORITY[source];
  return (p == null) ? AI_COMMAND_PRIORITY.idle : p;
}
function _aiCommandTrace(unit, entry) {
  ensureAICommandState(unit);
  unit.aiCommandTrace.push(Object.assign({ time: (typeof GAME !== 'undefined' ? GAME.gameTime : 0) }, entry));
  while (unit.aiCommandTrace.length > AI_COMMAND_TRACE_MAX) unit.aiCommandTrace.shift();
}
function getCurrentCommandAuthority(unit) {
  const st = ensureAICommandState(unit);
  if (!st) return null;
  const cur = st.current;
  if (!cur) return null;
  // 경로를 모두 소비했거나 만료되면 권한 해제
  const expired = (cur.expiresAt != null && (GAME.gameTime || 0) > cur.expiresAt);
  const consumed = (cur.type === 'move') && (!unit.movePath || unit.movePath.length === 0);
  if (expired || consumed) { st.current = null; return null; }
  return cur;
}
// 자율 명령의 유일한 movePath writer
function _aiWriteCommandPath(unit, path, cmd) {
  unit.movePath = path;
  unit._aiCommandPath = unit.movePath;
  const st = ensureAICommandState(unit);
  st.current = cmd;
  st.lastAcceptedTick = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
}
// 플레이어 명령이 살아 있는가 (자율 경로가 아닌 실제 이동 경로)
function hasActivePlayerCommand(unit) {
  return !!(unit && unit.team === 'friend' && unit.movePath && unit.movePath.length > 0
            && unit._aiCommandPath !== unit.movePath);
}
function suspendPlayerCommand(unit, reason) {
  const st = ensureAICommandState(unit);
  if (!hasActivePlayerCommand(unit)) return false;
  // [HF2] suspend는 플레이어 명령 변경이 아니다 — revision을 올리지 않고 현재 revision을 기록만 한다.
  if (unit._playerCommandRevision == null) unit._playerCommandRevision = 0;
  st.suspended = {
    path: unit.movePath.slice(),
    token: unit.movePath,                      // [HF1] 원본 배열 식별자 — 새 플레이어 명령이면 달라진다
    revisionAtSuspend: unit._playerCommandRevision,
    revision: unit._playerCommandRevision,
    suspendedAt: (typeof GAME !== 'undefined') ? GAME.gameTime : 0,
    reason: reason || 'unspecified',
  };
  unit._playerPathBackup = st.suspended.path.slice();   // legacy mirror (기존 소비자 호환)
  _aiCommandTrace(unit, { source: 'player', type: 'player_suspended', accepted: true, reason: reason || null, revision: st.suspended.revision });
  return true;
}
function restorePlayerCommand(unit) {
  const st = ensureAICommandState(unit);
  const snap = st.suspended || (unit._playerPathBackup && unit._playerPathBackup.length
    ? { path: unit._playerPathBackup.slice(), reason: 'legacy_backup' } : null);
  if (!snap || !snap.path || !snap.path.length) return false;
  const _rej = (why) => {
    st.suspended = null; unit._playerPathBackup = null;
    _aiCommandTrace(unit, { source: 'player', type: 'player_restore_rejected', accepted: false, rejectedReason: why });
    return false;
  };
  // [HF1] 복귀 금지 조건
  if (!unit.alive || unit.isDead) return _rej('restore_rejected_dead');
  if (unit.conscious === false) return _rej('restore_rejected_unconscious');
  if (unit.isDowned) return _rej('restore_rejected_downed');
  // 새 플레이어 명령이 이미 존재하면 오래된 snapshot을 복구하지 않는다
  if (hasActivePlayerCommand(unit)) return _rej('restore_rejected_new_player_command');
  const _snapRev = (snap.revisionAtSuspend != null) ? snap.revisionAtSuspend : snap.revision;
  if (_snapRev != null && (unit._playerCommandRevision || 0) !== _snapRev) {
    return _rej('restore_rejected_revision_mismatch');
  }
  // 즉시 수류탄 위험이 남아 있으면 복구하지 않는다
  if (typeof getGrenadeDangerForUnit === 'function' && getGrenadeDangerForUnit(unit)) {
    _aiCommandTrace(unit, { source: 'player', type: 'player_restore_rejected', accepted: false, rejectedReason: 'restore_rejected_danger_active' });
    return false;   // snapshot은 유지 — 위험이 끝나면 다시 시도
  }
  const last = snap.path[snap.path.length - 1];
  if (typeof pointInWalls === 'function' && last && pointInWalls(last.x, last.y, (typeof UNIT_RADIUS !== 'undefined' ? UNIT_RADIUS : 8))) {
    return _rej('restore_rejected_invalid_path');
  }
  unit.movePath = snap.path.slice();
  unit._aiCommandPath = null;         // 플레이어 소유로 복귀
  st.current = null; st.suspended = null; unit._playerPathBackup = null;
  _aiCommandTrace(unit, { source: 'player', type: 'player_restore_accepted', accepted: true });
  return true;
}
// [HF2] 실제 플레이어 입력으로 경로가 바뀔 때 호출한다.
//   revision을 올리고 그 이전에 저장된 suspended snapshot을 폐기한다(오래된 A가 나중에 복구되지 않도록).
//   AI Gateway 경로 write / 수류탄 회피 / Utility / legacy / 의료 / executor 소비 / reset은 호출하지 않는다.
function markPlayerCommandChanged(unit, reason, options) {
  if (!unit) return null;
  const st = ensureAICommandState(unit);
  const o = options || {};
  if (o.noChange) return null;                      // 실제 변경이 없으면 revision을 올리지 않는다
  unit._playerCommandRevision = (unit._playerCommandRevision || 0) + 1;
  const discarded = st.suspended ? (st.suspended.commandId || st.suspended.revisionAtSuspend || null) : null;
  if (st.suspended) {
    st.suspended = null;
    unit._playerPathBackup = null;
    _aiCommandTrace(unit, { source: 'player', type: 'player_command_superseded', accepted: true,
      reason: reason || null, revision: unit._playerCommandRevision, discardedSuspendedCommandId: discarded });
  }
  _aiCommandTrace(unit, { source: 'player', type: 'player_command_changed', accepted: true,
    reason: reason || null, revision: unit._playerCommandRevision, discardedSuspendedCommandId: discarded });
  return unit._playerCommandRevision;
}
function cancelAICommand(unit, reason) {
  const st = ensureAICommandState(unit);
  if (!st || !st.current) return false;
  const id = st.current.commandId;
  st.current = null;
  _aiCommandTrace(unit, { source: 'gateway', type: 'cancel', accepted: true, reason: reason || null, replacedCommandId: id });
  return true;
}
function completeAICommand(unit, result) {
  const st = ensureAICommandState(unit);
  if (!st) return false;
  const cur = st.current || st.lastInstant;
  if (!cur) return false;
  const id = cur.commandId;
  const wantRestore = !!cur.restorePlayerOnComplete;
  const src = cur.source;
  st.current = null;
  if (st.lastInstant && st.lastInstant.commandId === id) st.lastInstant = null;
  _aiCommandTrace(unit, { source: 'gateway', type: 'complete',
    traceKind: (src === 'immediate_grenade') ? 'grenade_command_completed' : null,
    accepted: true, reason: (result && result.reason) || null, replacedCommandId: id });
  // [HF1] 즉시 수류탄 명령 종료 → 조건 충족 시 플레이어 경로 자동 복구
  if (wantRestore && st.suspended) restorePlayerCommand(unit);
  return true;
}
// 공용 명령 발급 — 수락 시에만 movePath/자세가 바뀐다
function issueAICommand(unit, command) {
  if (!unit || !command) return { accepted: false, rejectedReason: 'bad_args' };
  const st = ensureAICommandState(unit);
  const source = command.source || 'utility';
  const priority = (command.priority != null) ? command.priority : getAICommandPriority(source);
  const type = command.type || 'move';
  const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
  const reject = (why) => {
    _aiCommandTrace(unit, { source, type, accepted: false, rejectedReason: why, actionType: command.actionType || null });
    return { accepted: false, rejectedReason: why };
  };
  // 플레이어 명령 보존 — 일반 자율 명령은 플레이어 이동을 덮어쓰지 못한다
  if (hasActivePlayerCommand(unit) && priority < AI_COMMAND_PRIORITY.player) {
    return reject('player_command_active');
  }
  // [§6.2] 한 tick 안에서만 우선순위/중복을 강제한다.
  //   tick을 넘어선 재발급까지 막으면 0.40.1의 "나중 tick의 Utility가 기존 경로를 갱신"하는
  //   기존 행동이 사라진다(AI0-A는 행동 보존이 계약). 지속 권한 강화는 AI0-D에서 다룬다.
  const cur = getCurrentCommandAuthority(unit);
  if (cur && cur.issuedAt === now) {
    if (priority < cur.priority) return reject('lower_priority_same_tick');
    if (priority === cur.priority && cur.type === type) return reject('duplicate_same_tick');
  }
  // 상위 우선순위가 플레이어 명령을 중단시키는 경우 snapshot 보존
  let _suspendedNow = false;
  if (hasActivePlayerCommand(unit) && priority >= AI_COMMAND_PRIORITY.player) {
    _suspendedNow = suspendPlayerCommand(unit, source);
  }
  const cmd = {
    commandId: (++_aiCommandSeq),
    type, actionType: command.actionType || null, source, priority,
    issuedAt: now, expiresAt: (command.ttl != null) ? now + command.ttl : null,
    targetX: command.targetX, targetY: command.targetY,
    pathMode: command.pathMode || 'direct',
    reason: command.reason || null,
    replacedCommandId: cur ? cur.commandId : null,
    // [HF1] 즉시 수류탄 명령은 완료 시 플레이어 경로를 자동 복구한다
    restorePlayerOnComplete: (command.restorePlayerOnComplete != null)
      ? !!command.restorePlayerOnComplete : (source === 'immediate_grenade'),
    suspendedPlayerCommandId: (_suspendedNow && st.suspended) ? st.suspended.revision : (st.suspended ? st.suspended.revision : null),
    suspendedAt: (st.suspended ? st.suspended.suspendedAt : null),
  };
  if (type === 'move') {
    const path = command.path;
    if (!Array.isArray(path) || path.length === 0) return reject('empty_path');
    // [HF1] 완료 감지용 — 마지막 waypoint에만 command 메타를 붙인다(모든 wp 무분별 태깅 금지)
    if (cmd.restorePlayerOnComplete) {
      const _lastWp = path[path.length - 1];
      if (_lastWp) { _lastWp._aiCommandId = cmd.commandId; _lastWp._aiActionType = cmd.actionType; _lastWp._aiCommandFinal = true; }
    }
    _aiWriteCommandPath(unit, path, cmd);
  } else {
    // [AI0-A] stance/face/hold/firePermission은 즉시 적용되는 1회성 명령이다.
    //   지속 권한(st.current)은 이동 명령만 점유한다 — 그렇지 않으면 prone 한 번이
    //   이후 모든 utility 이동을 'lower_priority_than_active'로 영구 차단한다.
    st.lastAcceptedTick = now;
    st.lastInstant = { commandId: cmd.commandId, type, source, priority, issuedAt: now, actionType: cmd.actionType,
      restorePlayerOnComplete: cmd.restorePlayerOnComplete, suspendedPlayerCommandId: cmd.suspendedPlayerCommandId };
  }
  _aiCommandTrace(unit, { source, type, accepted: true,
    traceKind: (source === 'immediate_grenade') ? 'grenade_command_accepted' : null,
    actionType: cmd.actionType, replacedCommandId: cmd.replacedCommandId, commandId: cmd.commandId });
  return { accepted: true, commandId: cmd.commandId, command: cmd };
}
// [AI0-A] 경로 계산 후 AI Command Gateway로 발급. opts.source 미지정 시 'utility'.
//   반환값: gateway 결과({accepted,...}) — 기존 호출부는 반환값을 쓰지 않으므로 호환.
function issueMoveOrder(unit, x, y, opts) {
  if (!unit) return { accepted: false, rejectedReason: 'no_unit' };
  const o = opts || {};
  // 겹침 방지 — 다른 유닛이 이미 같은 위치 향함
  if (typeof adjustTargetForCrowding === 'function') {
    const adj = adjustTargetForCrowding(unit, x, y, { minDist: 18 });
    if (adj.adjusted) { x = adj.x; y = adj.y; }
  }
  // 기존 path 클리어 + 새 목표
  let path = null;
  if (typeof findPath === 'function') {
    const p2 = findPath(unit.x, unit.y, x, y, unit);
    if (p2 && p2.length > 0) path = p2.map(p => ({ x: p.x, y: p.y, mode: 'walk' }));
  }
  // 경로가 없으면 명령을 거부한다. 예전에는 목표까지 직선 path를 지어냈는데,
  // _findPathImpl은 맨 처음에 hasLineOfWalkClear를 검사해 통과하면 그 직선을 이미 반환한다.
  // 즉 여기까지 왔다는 건 직선이 막혀 있다는 뜻이고, 그 path는 언제나 벽을 관통했다.
  if (!path) return { accepted: false, rejectedReason: 'no_path' };
  // 다른 목적의 이동 명령이 들어오면 문 예약은 의미를 잃는다 (문 접근 명령 자체는 예외)
  if (unit.pendingDoor && o.source !== 'door') clearPendingDoor(unit, '다른 명령');
  // 피킹도 같다 — 다른 데로 가기로 했으면 원위치로 돌아갈 이유가 없다.
  //   단 프래그 계획이 시킨 피킹은 예외다(같은 의도의 두 다리다).
  if (unit.pendingPeek && o.source !== 'peek' && o.source !== 'frag') clearPendingPeek(unit, 'other_order');
  if (unit.pendingFrag && o.source !== 'frag' && o.source !== 'peek' && o.source !== 'screen') clearPendingFrag(unit, 'other_order');
  return issueAICommand(unit, {
    type: 'move', source: o.source || 'utility', actionType: o.actionType || null,
    targetX: x, targetY: y, path, reason: o.reason || null, ttl: o.ttl,
  });
}

function tryStandUp(unit) {
  if (unit.isDead || !unit.isDowned || !unit.conscious) return false;
  if (unit.pain > 75 && !unit.painkillerActive) return false;
  // critical bleeding + 지혈대 없으면 못 일어남
  if (unit.bleeding === 'critical' && !unit.tourniquetActive && !unit.stabilized) return false;
  // leg fracture + 부목 없으면 못 일어남
  if (unit.fracture === 'leg' || unit.fracture === 'multiple') {
    const legSplinted = unit.medical ? (isPartSplinted(unit, 'left_leg') || isPartSplinted(unit, 'right_leg')) : unit.splintApplied;
    if (!legSplinted) return false;
  }
  unit.isDowned = false;
  unit.combatState = 'wounded';
  unit.canBeDragged = false;
  unit.stance = 'crouched';
  unit.downedTime = 0;
  unit._lastReportedState = null;
  log(`[${unit.name}] 일어섬`, 'good');
  return true;
}

// 벽을 따라 미끄러진다 — 축을 분리해 하나씩 시도한다.
//   막혔다고 경로를 통째로 포기하면 유닛이 모서리에서 계속 멈춰 선다.
//   미끄러져도 안 되면 그때 기존대로 경로를 끝낸다.
//   물리는 그대로 정답을 본다 — 통과시키는 게 아니라 갈 수 있는 축으로만 보낸다.
function _trySlideAlongWall(unit, ux, uy, step) {
  if (!(step > 0)) return false;
  const R = UNIT_RADIUS - 3;
  const cands = [];
  if (Math.abs(ux) > 1e-6) cands.push({ x: unit.x + ux * step, y: unit.y });
  if (Math.abs(uy) > 1e-6) cands.push({ x: unit.x, y: unit.y + uy * step });
  // 진행 방향에 더 가까운 축을 먼저 시도한다
  cands.sort((a, b) => Math.hypot(b.x - unit.x, b.y - unit.y) - Math.hypot(a.x - unit.x, a.y - unit.y));
  for (const c of cands) {
    if (pointInWalls(c.x, c.y, R)) continue;
    if (!pointInMap(c.x, c.y, 0)) continue;
    const oldX = unit.x, oldY = unit.y;
    unit.x = c.x; unit.y = c.y;
    if (typeof _maybeEmitMovementDust === 'function') _maybeEmitMovementDust(unit, oldX, oldY, c.x, c.y);
    if (unit.draggingTarget != null) {
      const tgt = unitById(unit.draggingTarget);
      if (tgt && !tgt.isDead) {
        const tnx = tgt.x + (c.x - oldX), tny = tgt.y + (c.y - oldY);
        if (!pointInWalls(tnx, tny, R)) { tgt.x = tnx; tgt.y = tny; }
      } else stopDragging(unit);
    }
    GAME._wallSlides = (GAME._wallSlides || 0) + 1;
    return true;
  }
  return false;
}

