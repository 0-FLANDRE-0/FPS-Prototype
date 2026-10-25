// 14. BUTTON HANDLERS
// =============================================================
document.getElementById('btnPlayPause').addEventListener('click', () => {
  if (GAME.over) return;
  GAME.paused = !GAME.paused;
  if (!GAME.paused) {
    // EXECUTE 진입 — 모드 입력 모두 해제
    GAME.facingMode = false;
    GAME.placementMode = false;
  }
  updatePlayPauseButton();
  updatePhasePill();
  updateHint();
  refreshUI();
  log(GAME.paused ? '일시정지.' : '실행 시작.', 'info');
});
document.getElementById('btnFacingMode').addEventListener('click', () => {
  if (GAME.over) return;
  if (!GAME.selectedId) { log('먼저 대원을 선택하세요.', 'warn'); return; }
  GAME.facingMode = !GAME.facingMode;
  updateFacingButton(); updateHint();
});
// 배치 모드 토글
document.getElementById('btnPlaceMode').addEventListener('click', () => {
  if (!isPlacementAllowed()) {
    log('배치는 PLAN 단계에서만 가능합니다.', 'warn'); return;
  }
  GAME.placementMode = !GAME.placementMode;
  if (GAME.placementMode) {
    // 배치 모드 진입 시 다른 모드 해제
    GAME.facingMode = false;
    GAME.pointFireMode = false;
    log('배치 모드: 클릭 지점에 ' + GAME.placementType + ' 배치', 'info');
  }
  refreshUI();
  updateHint();
});
// 배치 패널 — 대상/재질 버튼
document.querySelectorAll('#placePanel .place-btn[data-pt]').forEach(b => {
  b.addEventListener('click', () => {
    GAME.placementType = b.dataset.pt;
    // 카테고리 전환 시 첫 번째 cover preset 기본 선택
    if (b.dataset.pt === 'fullCover') {
      const ids = Object.keys(PLACEMENT_COVERS).filter(k => PLACEMENT_COVERS[k].category === 'fullCover');
      if (!ids.includes(GAME.placementCoverId)) GAME.placementCoverId = ids[0];
    } else if (b.dataset.pt === 'halfCover') {
      const ids = Object.keys(PLACEMENT_COVERS).filter(k => PLACEMENT_COVERS[k].category === 'halfCover');
      if (!ids.includes(GAME.placementCoverId)) GAME.placementCoverId = ids[0];
    } else {
      GAME.selectedCoverId = null;
    }
    refreshUI();
  });
});

// cover 종류 선택 버튼 — 동적 렌더링되므로 위임
document.getElementById('placeCoverBtns').addEventListener('click', (e) => {
  const b = e.target.closest('.place-btn[data-cover-id]');
  if (!b) return;
  GAME.placementCoverId = b.dataset.coverId;
  refreshUI();
});
// SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 바닥 재질 선택 + 브러시 크기
document.getElementById('placeFloorBtns').addEventListener('click', (e) => {
  const fb = e.target.closest('.place-btn[data-floor]');
  if (fb) { GAME.placementFloorMaterial = fb.dataset.floor; if (GAME.placementType !== 'floorPaint' && GAME.placementType !== 'floorErase') GAME.placementType = 'floorPaint'; refreshUI(); return; }
  const brush = e.target.closest('#btnFloorBrush');
  if (brush) { const order = ['small', 'medium', 'large']; const cur = order.indexOf(GAME.placementBrushSize || 'medium'); GAME.placementBrushSize = order[(cur + 1) % 3]; refreshUI(); return; }
});

// 편집 버튼들
document.getElementById('btnRotateCcw').addEventListener('click', () => { if (GAME.selectedWallUid != null) { editorRotateWall(-1); } else { rotateSelectedCover(-1); } refreshUI(); });
document.getElementById('btnRotateCw').addEventListener('click',  () => { if (GAME.selectedWallUid != null) { editorRotateWall(+1); } else { rotateSelectedCover(+1); } refreshUI(); });
document.getElementById('btnDeleteSelected').addEventListener('click', () => { deleteSelectedEditable(); refreshUI(); });
document.getElementById('btnDeselectCover').addEventListener('click',  () => { GAME.selectedCoverId = null; GAME.selectedWallUid = null; refreshUI(); });
// SIDE-MAP-BALLISTIC-1A: 커스텀 편집 버튼
document.getElementById('btnMatPrev').addEventListener('click', () => { editorCycleMaterial(-1); refreshUI(); });
document.getElementById('btnMatNext').addEventListener('click', () => { editorCycleMaterial(+1); refreshUI(); });
document.getElementById('btnLenDn').addEventListener('click', () => { editorAdjustLength(-8); refreshUI(); });
document.getElementById('btnLenUp').addEventListener('click', () => { editorAdjustLength(+8); refreshUI(); });
document.getElementById('btnThkDn').addEventListener('click', () => { editorAdjustThickness(-4); refreshUI(); });
document.getElementById('btnThkUp').addEventListener('click', () => { editorAdjustThickness(+4); refreshUI(); });
document.getElementById('btnClearPath').addEventListener('click', () => {
  if (!GAME.selectedId) return;
  const u = unitById(GAME.selectedId);
  if (!u) return;
  if (GAME.selectedWpIdx >= 0 && GAME.selectedWpIdx < u.movePath.length) {
    // 선택된 waypoint만 삭제
    markPlayerCommandChanged(u, 'delete_waypoint');   // [HF2] 실제 삭제할 wp가 있을 때만
    u.movePath.splice(GAME.selectedWpIdx, 1);
    GAME.selectedWpIdx = -1;
    log(`[${u.name}] waypoint 삭제.`, 'info');
  } else if (u.movePath.length > 0) {
    markPlayerCommandChanged(u, 'clear_path');        // [HF2] 이미 빈 경로면 revision 증가 없음
    u.movePath = [];
    log(`[${u.name}] 경로 초기화.`, 'info');
  }
  refreshUI();
});
document.getElementById('btnDeselect').addEventListener('click', () => {
  GAME.selectedId = null;
  GAME.selectedWpIdx = -1;
  GAME.facingMode = false;
  refreshUI();
});
// =============================================================
