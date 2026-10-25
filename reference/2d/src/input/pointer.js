// 10. INPUT (Pointer Events)
// =============================================================
const canvas = document.getElementById('canvas');
const mapArea = document.getElementById('mapArea');

const TAP_THRESHOLD_PX = 8;
const TAP_THRESHOLD_MS = 250;
const pointers = new Map();
let inputMode = 'idle'; // 'idle' | 'pan' | 'pinch' | 'facing'
let pinchStartDist = 0;
let pinchStartScale = 1;
let pinchMidWorld = null;
let facingStartWorld = null;
let facingEndWorld = null;

function screenToWorld(sx, sy) {
  return { x: (sx - view.tx) / view.scale, y: (sy - view.ty) / view.scale };
}
function getCanvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
  const p = getCanvasPos(e);
  pointers.set(e.pointerId, {
    x: p.x, y: p.y, x0: p.x, y0: p.y,
    startTime: performance.now(),
    startTx: view.tx, startTy: view.ty,
  });

  // 투척 모드 — pinch / 화면 이동 차단, 손가락 위치 = 조준 지점
  if (GAME.throwMode && GAME.throwMode.unitId) {
    const sel = unitById(GAME.throwMode.unitId);
    if (sel && sel.alive && !sel.isDowned) {
      // 첫 번째 손가락만 사용 (이미 드래그 중이면 무시)
      if (GAME.throwMode.dragging && GAME.throwMode.pointerId !== e.pointerId) {
        pointers.delete(e.pointerId);
        return;
      }
      const w = screenToWorld(p.x, p.y);
      GAME.throwMode.aimX = w.x;
      GAME.throwMode.aimY = w.y;
      GAME.throwMode.dragging = true;
      GAME.throwMode.pointerId = e.pointerId;
      inputMode = 'throw';   // pan/pinch 진입 차단용 마커
      recomputeThrowPreview();
    } else {
      GAME.throwMode = null;
      refreshUI();
      pointers.delete(e.pointerId);
    }
    return;
  }

  if (pointers.size === 2) {
    const arr = [...pointers.values()];
    pinchStartDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    pinchStartScale = view.scale;
    const mx = (arr[0].x + arr[1].x) / 2;
    const my = (arr[0].y + arr[1].y) / 2;
    pinchMidWorld = screenToWorld(mx, my);
    inputMode = 'pinch';
  } else if (pointers.size === 1) {
    if (GAME.facingMode && GAME.selectedId) {
      const sel = unitById(GAME.selectedId);
      if (sel && sel.alive) {
        // 우선순위: 선택된 waypoint → 마지막 waypoint → 유닛 위치
        if (GAME.selectedWpIdx >= 0 && GAME.selectedWpIdx < sel.movePath.length) {
          const wp = sel.movePath[GAME.selectedWpIdx];
          facingStartWorld = { x: wp.x, y: wp.y };
        } else if (sel.movePath.length > 0) {
          const wp = sel.movePath[sel.movePath.length - 1];
          facingStartWorld = { x: wp.x, y: wp.y };
        } else {
          facingStartWorld = { x: sel.x, y: sel.y };
        }
        facingEndWorld = screenToWorld(p.x, p.y);
        inputMode = 'facing';
      }
    } else {
      inputMode = 'idle';
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = getCanvasPos(e);
  const ptr = pointers.get(e.pointerId);
  ptr.x = p.x; ptr.y = p.y;

  // 투척 모드 — 드래그로 조준 지점 갱신 (어떤 손가락이든)
  if (GAME.throwMode && GAME.throwMode.unitId) {
    // 등록된 throw 손가락이면 갱신, 아니면 무시 (pinch 등 차단)
    if (GAME.throwMode.pointerId === e.pointerId) {
      const w = screenToWorld(p.x, p.y);
      GAME.throwMode.aimX = w.x;
      GAME.throwMode.aimY = w.y;
      recomputeThrowPreview();
    }
    return;
  }

  if (inputMode === 'pinch' && pointers.size >= 2) {
    const arr = [...pointers.values()];
    const newDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    if (pinchStartDist > 1) {
      const target = pinchStartScale * (newDist / pinchStartDist);
      const mx = (arr[0].x + arr[1].x) / 2;
      const my = (arr[0].y + arr[1].y) / 2;
      const newScale = Math.max(view.baseScale * 0.7, Math.min(view.baseScale * 4.0, target));
      view.scale = newScale;
      view.tx = mx - pinchMidWorld.x * view.scale;
      view.ty = my - pinchMidWorld.y * view.scale;
    }
    return;
  }

  if (pointers.size === 1) {
    const dx = ptr.x - ptr.x0;
    const dy = ptr.y - ptr.y0;
    const moved = Math.hypot(dx, dy);
    if (inputMode === 'idle' && moved > TAP_THRESHOLD_PX) {
      // 배치 모드 + 선택된 cover가 있고 드래그 시작점이 그 cover 위면 → 드래그 모드
      if (GAME.placementMode && GAME.selectedCoverId != null) {
        const sw = screenToWorld(ptr.x0, ptr.y0);
        const o = MAP_DATA.coverObjects.find(c => c._coverUid === GAME.selectedCoverId);
        if (o && sw.x >= o.x - 8 && sw.x <= o.x + o.w + 8 &&
                sw.y >= o.y - 8 && sw.y <= o.y + o.h + 8) {
          inputMode = 'coverDrag';
        } else {
          inputMode = 'pan';
        }
      } else {
        inputMode = 'pan';
      }
    }
    if (inputMode === 'pan') {
      view.tx = ptr.startTx + dx;
      view.ty = ptr.startTy + dy;
    } else if (inputMode === 'facing') {
      facingEndWorld = screenToWorld(ptr.x, ptr.y);
    } else if (inputMode === 'coverDrag') {
      const w = screenToWorld(ptr.x, ptr.y);
      moveSelectedCover(w.x, w.y);
    }
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const ptr = pointers.get(e.pointerId);
  const elapsed = performance.now() - ptr.startTime;
  const moved = Math.hypot(ptr.x - ptr.x0, ptr.y - ptr.y0);

  // 투척 모드 — pointerup 시 던지기 실행
  if (GAME.throwMode && GAME.throwMode.dragging && GAME.throwMode.pointerId === e.pointerId) {
    const sel = unitById(GAME.throwMode.unitId);
    if (sel && sel.alive && !sel.isDowned) {
      if (startThrow(sel, GAME.throwMode.throwableId, GAME.throwMode.aimX, GAME.throwMode.aimY)) {
        GAME.throwMode = null;
      } else {
        GAME.throwMode.dragging = false;
        GAME.throwMode.pointerId = null;
      }
    } else {
      GAME.throwMode = null;
    }
    pointers.delete(e.pointerId);
    if (pointers.size === 0) inputMode = 'idle';
    refreshUI();
    return;
  }

  const wasTap = (pointers.size === 1) && (inputMode === 'idle') &&
                 moved < TAP_THRESHOLD_PX && elapsed < TAP_THRESHOLD_MS;
  if (wasTap) handleTap(ptr.x, ptr.y);
  else if (inputMode === 'facing' && pointers.size === 1) commitFacing();

  pointers.delete(e.pointerId);
  if (pointers.size === 0) inputMode = 'idle';
  else if (pointers.size === 1) inputMode = 'idle';
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', endPointer);

function handleTap(sx, sy) {
  if (GAME.over) return;
  const w = screenToWorld(sx, sy);

  // 배치 모드 — 다른 모든 처리보다 우선. PLAN 단계에서만 활성.
  if (GAME.placementMode && isPlacementAllowed()) {
    handlePlacementTap(w.x, w.y);
    return;
  }

  // POINT FIRE 모드 — 선택된 친군이 그 지점으로 사격
  if (GAME.pointFireMode && GAME.selectedId) {
    const sel = unitById(GAME.selectedId);
    if (sel && sel.alive) {
      sel.manualFireTarget = { x: w.x, y: w.y };
      log(`[${sel.name}] 지점 지정 사격`, 'info');
    }
    GAME.pointFireMode = false;
    refreshUI();
    return;
  }

  // 1) 친군 탭 → 선택 또는 응급처치 메뉴
  const hit = friendlyAt(w.x, w.y, 22);
  if (hit) {
    // 이미 다른 active/wounded 친군이 선택된 상태에서 downed 친군 클릭 → 처치 메뉴
    if (GAME.selectedId && GAME.selectedId !== hit.id) {
      const sel = unitById(GAME.selectedId);
      if (sel && !sel.isDowned && !sel.isDead && hit.isDowned && !hit.isDead) {
        // 거리 확인 — 가까우면 즉시 메뉴, 멀면 이동 후 메뉴
        const d = Math.hypot(sel.x - hit.x, sel.y - hit.y);
        if (d <= UNIT_RADIUS * 3.5) {
          openMedicOverlay(sel.id, hit.id);
        } else {
          // 대상 위치로 이동 명령 — 도착 시 자동 메뉴는 별도 _approachMedic 플래그
          markPlayerCommandChanged(sel, 'replace_path_medic');   // [HF2] 플레이어 입력 경로 교체
          sel.movePath = [{ x: hit.x, y: hit.y, facing: null, _approachMedic: hit.id }];
          log(`[${sel.name}] → ${hit.name} 접근`, 'info');
        }
        return;
      }
    }
    // unconscious 유닛은 직접 조작 불가 — 가장 가까운 아군 치료자가 의료 대상으로 처리
    if (hit.isDowned && !hit.conscious && hit.alive !== false && !hit.isDead && hit.team === 'friend') {
      // 가장 가까운 아군(자가 처치 불가, 1m 이내 안 봐도 됨 — 일단 메뉴 열기)
      let bestTreater = null, bestD = Infinity;
      for (const u of UNITS) {
        if (u.team !== 'friend' || u.id === hit.id) continue;
        if (u.isDead || (u.isDowned && !u.conscious)) continue;
        const d = Math.hypot(u.x - hit.x, u.y - hit.y);
        if (d < bestD) { bestD = d; bestTreater = u; }
      }
      if (bestTreater) {
        openMedicOverlay(bestTreater.id, hit.id);
        return;
      }
    }
    GAME.selectedId = (GAME.selectedId === hit.id) ? null : hit.id;
    GAME.selectedWpIdx = -1;
    GAME.facingMode = false;
    GAME.pointFireMode = false;
    // 다른 유닛 클릭 → 옛 medic 메뉴 잔여물 닫기
    if (medicMenuTarget != null && medicMenuTarget !== GAME.selectedId) closeMedicMenu();
    refreshUI();
    return;
  }

  // 2) 선택된 대원이 있으면 — waypoint 탭 선택 또는 새 waypoint 추가
  if (GAME.selectedId) {
    const sel = unitById(GAME.selectedId);
    if (!sel || !sel.alive) return;
    // unconscious 유닛은 명령 불가
    if (sel.isDowned && !sel.conscious) { GAME.selectedId = null; refreshUI(); return; }
    // 실행 중에도 명령 가능 — 이동/방향 지정 모두 즉시 반영

    // 기존 waypoint 근처 탭이면 그 waypoint를 선택/토글
    // 화면 픽셀 기준 18px 반경 (줌 무관하게 일관된 터치 영역)
    const wpHitWorldR = 18 / view.scale;
    const wpHitR2 = wpHitWorldR * wpHitWorldR;
    let wpHitIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < sel.movePath.length; i++) {
      const p = sel.movePath[i];
      const d2 = distSq(p.x, p.y, w.x, w.y);
      if (d2 < wpHitR2 && d2 < bestD) { bestD = d2; wpHitIdx = i; }
    }
    if (wpHitIdx >= 0) {
      GAME.selectedWpIdx = (GAME.selectedWpIdx === wpHitIdx) ? -1 : wpHitIdx;
      refreshUI();
      return;
    }

    // 문 탭 → 접근 후 개방 예약 (Door Kickers식 — 문 앞에 대원을 붙인다)
    const doorHit = doorAt(w.x, w.y, 14);
    if (doorHit && !sel.isDowned) {
      if (doorHit.state === 'closed') {
        if (setPendingDoor(sel, doorHit, { manual: true, approach: true })) {
          log(`[${sel.name}] ${doorHit.label || '문'} 앞으로 → 개방 예약`, 'info');
        } else {
          log(`[${sel.name}] 문까지 갈 길이 없습니다.`, 'warn');
        }
      } else {
        log(`[${doorHit.label || '문'}] 이미 열려 있습니다.`, 'info');
      }
      refreshUI();
      return;
    }

    // 빈 공간 → 새 waypoint 추가
    addWaypoint(sel, w.x, w.y);
    GAME.selectedWpIdx = sel.movePath.length - 1;
    refreshUI();
  }
}
function addWaypoint(unit, wx, wy) {
  const prev = unit.movePath.length > 0
    ? unit.movePath[unit.movePath.length - 1]
    : { x: unit.x, y: unit.y };
  if (pointInWalls(wx, wy, UNIT_RADIUS - 2)) {
    log(`[${unit.name}] 도착 지점이 벽 안입니다.`, 'warn'); return;
  }
  if (!pointInMap(wx, wy, 0)) {
    log(`[${unit.name}] 맵 밖으로 갈 수 없습니다.`, 'warn'); return;
  }
  // 직선이 가능하면 단일 wp 추가, 막히면 A*로 우회 경로 생성
  if (!pathBlocked(prev.x, prev.y, wx, wy, UNIT_RADIUS - 2)) {
    markPlayerCommandChanged(unit, 'add_waypoint');   // [HF2] 실제 추가 직전
    unit.movePath.push({ x: wx, y: wy, facing: null });
  } else {
    const path = findPath(prev.x, prev.y, wx, wy);
    if (!path || path.length < 2) {
      log(`[${unit.name}] 경로를 찾을 수 없습니다.`, 'warn');
      return;
    }
    markPlayerCommandChanged(unit, 'add_waypoint_path');   // [HF2] 우회 경로 추가 직전
    // path[0]은 시작점 — 제외하고 나머지를 wp로 추가
    for (let i = 1; i < path.length; i++) {
      unit.movePath.push({ x: path[i].x, y: path[i].y, facing: null });
    }
  }
  // 새 명령이 들어왔으므로 이전에 도착해서 유지하던 시선(_holdFacing)을 해제.
  // 새 wp에 facing이 지정되지 않은 상태이므로 이동 중에는 이동 방향을 본다.
  unit._holdFacing = null;
  // 자동 엄폐 백업도 무효화 — 플레이어가 새 의도를 표명
  unit._playerPathBackup = null;
  unit.aiIntent = 'none';
  if (unit.pendingDoor && unit.pendingDoor.manual) clearPendingDoor(unit, '새 이동 지시');
  // SIDE-AI-PLAYER-REASSESS: 플레이어가 직접 이동시키면 이전 자율 판단을 버리고 새 위치에서 새로 판단
  unit.aiAction = null;
  unit._aiCommandPath = null;                  // 이 경로는 플레이어 것 (자율 경로 아님)
  unit._playerOrderTime = (GAME.gameTime || 0); // 직후 자율 이동 grace 기준
  unit.aiUtilityNext = (GAME.gameTime || 0);    // 경로 종료 직후 즉시 재평가
}
function commitFacing() {
  const sel = unitById(GAME.selectedId);
  if (!sel || !facingStartWorld || !facingEndWorld) {
    facingStartWorld = facingEndWorld = null; return;
  }
  const dx = facingEndWorld.x - facingStartWorld.x;
  const dy = facingEndWorld.y - facingStartWorld.y;
  if (Math.hypot(dx, dy) < 6) {
    facingStartWorld = facingEndWorld = null; return;
  }
  const ang = Math.atan2(dy, dx);

  // 우선순위: 선택된 waypoint → 마지막 waypoint → 유닛 자체
  let target = null;
  if (GAME.selectedWpIdx >= 0 && GAME.selectedWpIdx < sel.movePath.length) {
    target = sel.movePath[GAME.selectedWpIdx];
  } else if (sel.movePath.length > 0) {
    target = sel.movePath[sel.movePath.length - 1];
  }

  if (target) {
    target.facing = ang;
  } else {
    // 경로 없음 → 현재 위치 facing.
    // _holdFacing에도 저장해 멈춰 있는 동안 그쪽을 계속 바라보게 한다.
    sel.facing = ang;
    sel.homeFacing = ang;
    sel._holdFacing = ang;
  }

  GAME.facingMode = false;
  facingStartWorld = facingEndWorld = null;
  refreshUI();
  log(`[${sel.name}] 방향 설정 완료.`, 'info');
}

// 더블 탭 zoom 리셋 — 비활성화됨 (오작동 방지를 위해 제거)
//   사용자가 핀치 줌 도중 의도치 않게 더블탭으로 인식되는 문제로 비활성화.
//   필요 시 리셋 버튼 또는 UI 컨트롤로 복원 가능.

// =============================================================
