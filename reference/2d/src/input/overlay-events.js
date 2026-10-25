(function() {
  const closeBtn = document.getElementById('medCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeMedicOverlay);
  const cancelBtn = document.getElementById('medCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeMedicOverlay);
  const dragBtn = document.getElementById('medDragBtn');
  if (dragBtn) dragBtn.addEventListener('click', () => {
    const tr = unitById(MEDIC_OVERLAY.treaterId);
    const tg = unitById(MEDIC_OVERLAY.targetId);
    if (!tr || !tg) return;
    const d = Math.hypot(tr.x - tg.x, tr.y - tg.y);
    if (d <= 40) {
      // 범위 내 — 즉시 시작
      if (startDragging(tr, tg)) {
        closeMedicOverlay();
        refreshUI();
      }
    } else {
      // 범위 밖 — 자동 접근 + 끌기 예약
      setPendingMedic(tr, { type:'drag', targetId: tg.id });
      closeMedicOverlay();
      refreshUI();
    }
  });
  const stopDragBtn = document.getElementById('medStopDragBtn');
  if (stopDragBtn) stopDragBtn.addEventListener('click', () => {
    const tr = unitById(MEDIC_OVERLAY.treaterId);
    if (!tr) return;
    stopDragging(tr);
    closeMedicOverlay();
    refreshUI();
  });
  const overlay = document.getElementById('medicOverlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMedicOverlay();
  });
  // 부위 선택
  document.querySelectorAll('.med-part').forEach(p => {
    p.addEventListener('click', () => {
      MEDIC_OVERLAY.selectedPart = p.dataset.part;
      renderMedicOverlay();
    });
  });
  // 처치 버튼 (delegation) — 새 3-panel 구조에선 #medTreatArea에 바인딩, 호환을 위해 모달 전체에도 listener
  const treatEl = document.getElementById('medTreatArea');
  const modalEl = document.getElementById('medicOverlay');
  const handleTreatClick = (e) => {
    const btn = e.target.closest('.med-treat-btn');
    if (!btn || btn.disabled) return;
    const type = btn.dataset.treat;
    const part = btn.dataset.part;
    const woundId = btn.dataset.woundId || null;   // 2B-0: 선택 wound 처치
    const groupId = btn.dataset.groupId || null;    // 2B-0-FINAL: 클러스터 일괄 처치
    const clusterCount = btn.dataset.clusterCount ? parseInt(btn.dataset.clusterCount, 10) : 0;
    const treater = unitById(MEDIC_OVERLAY.treaterId);
    const target = unitById(MEDIC_OVERLAY.targetId);
    if (!treater || !target) return;
    const isSelf = (treater.id === target.id);
    const d = Math.hypot(treater.x - target.x, treater.y - target.y);
    if (isSelf || d <= 40) {
      // 범위 내 — 즉시 시작
      if (startTreatment(treater, target, type, { location: part, woundId, groupId, clusterCount })) {
        closeMedicOverlay();
      }
    } else {
      // 범위 밖 — 자동 접근 + 예약
      setPendingMedic(treater, { type:'treat', targetId: target.id, treatType: type, location: part, woundId, groupId, clusterCount });
      closeMedicOverlay();
    }
  };
  if (treatEl) treatEl.addEventListener('click', handleTreatClick);
  // legacy 호환 — 옛 구조 detailContent에서도 listen
  const detailEl = document.getElementById('medDetailContent');
  if (detailEl) detailEl.addEventListener('click', handleTreatClick);
})();

// === 로드아웃 선택 오버레이 이벤트 ===
(function() {
  // SIDE-WEAPON-PLATFORM-1A: 총기 셋팅 탭 이벤트 위임 (탄약/파츠/프리셋)
  const wsBody = document.getElementById('weaponSetupBody');
  if (wsBody) wsBody.addEventListener('click', (e) => {
    const el = e.target.closest('[data-ws-action]');
    if (!el) return;
    const action = el.dataset.wsAction;
    const team = el.dataset.wsTeam;
    const wpnSlot = el.dataset.wsSlot;
    if (action === 'ammo') {
      openLoadoutSelect(team, wpnSlot === 'secondary' ? 'secondaryAmmo' : 'primaryAmmo');
    } else if (action === 'part') {
      cycleWeaponBuildPart(team, wpnSlot, el.dataset.wsPart, parseInt(el.dataset.wsDir || '1', 10));
    } else if (action === 'preset') {
      applyPresetToTeamBuild(team, wpnSlot, el.dataset.wsPreset);
    }
  });
  const listEl = document.getElementById('lsList');
  if (listEl) listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.ps-item');
    if (!item) return;
    LOADOUT_SELECT.selectedId = item.dataset.id;
    // §16: 무기 변경 시 previewBuild를 해당 무기의 저장된 build 또는 기본 build로 재로드
    const slot = LOADOUT_SELECT.slot;
    if ((slot === 'weapon' || slot === 'secondaryWeapon') && typeof createDefaultWeaponBuild === 'function') {
      const ld = (typeof getScopedLoadout === 'function') ? getScopedLoadout(LOADOUT_SELECT.team) : GAME.loadout[LOADOUT_SELECT.team];   // RESIDUAL HOTFIX 2: preview도 scoped(대원별 override) 사용
      const saved = (slot === 'secondaryWeapon') ? ld.secondaryBuild : ld.primaryBuild;
      LOADOUT_SELECT.previewBuild = (saved && saved.weaponId === LOADOUT_SELECT.selectedId) ? Object.assign({}, saved) : createDefaultWeaponBuild(LOADOUT_SELECT.selectedId);
    }
    renderLoadoutSelect();
  });
  // §5/§7: 프리셋 버튼 클릭 (delegation on detail content) — previewBuild 변경 + 상세 재렌더 (오버레이 닫지 않음)
  const lsDetail = document.getElementById('lsDetailContent');
  if (lsDetail) lsDetail.addEventListener('click', (e) => {
    const pb = e.target.closest('[data-preset-btn]');
    if (!pb || pb.disabled) return;
    const presetId = pb.dataset.presetBtn;
    if (typeof applyWeaponPresetToBuild === 'function' && LOADOUT_SELECT.previewBuild) {
      LOADOUT_SELECT.previewBuild = applyWeaponPresetToBuild(LOADOUT_SELECT.previewBuild, presetId);
      renderLoadoutSelectDetail();
    }
  });
  const closeBtn = document.getElementById('lsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeLoadoutSelect);
  const cancelBtn = document.getElementById('lsCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeLoadoutSelect);
  const equipBtn = document.getElementById('lsEquipBtn');
  if (equipBtn) equipBtn.addEventListener('click', equipSelectedLoadout);
  const overlay = document.getElementById('loadoutSelectOverlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLoadoutSelect();
  });
})();

// === 방호 분석 오버레이 이벤트 ===
(function() {
  const closeBtn = document.getElementById('aaCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeArmorAnalysis);

  const prev = document.getElementById('aaAmmoPrev');
  const next = document.getElementById('aaAmmoNext');
  if (prev) prev.addEventListener('click', () => {
    const ids = getAllAmmoIdsSorted();
    let i = ids.indexOf(ARMOR_ANALYSIS.ammoId);
    if (i < 0) i = 0;
    ARMOR_ANALYSIS.ammoId = ids[(i - 1 + ids.length) % ids.length];
    renderArmorAnalysis();
  });
  if (next) next.addEventListener('click', () => {
    const ids = getAllAmmoIdsSorted();
    let i = ids.indexOf(ARMOR_ANALYSIS.ammoId);
    if (i < 0) i = 0;
    ARMOR_ANALYSIS.ammoId = ids[(i + 1) % ids.length];
    renderArmorAnalysis();
  });

  const slider = document.getElementById('aaDurSlider');
  if (slider) slider.addEventListener('input', () => {
    ARMOR_ANALYSIS.durRatio = parseInt(slider.value, 10) / 100;
    ARMOR_ANALYSIS.useCurrent = false;
    resetArmorAnalysisTestState(true);   // 초기 내구도 변경 = 누적 테스트 초기화 (피격점은 유지)
    renderArmorAnalysis();
  });

  const durReset = document.getElementById('aaDurReset');
  if (durReset) durReset.addEventListener('click', () => {
    if (!ARMOR_ANALYSIS.slotInfo) return;
    ARMOR_ANALYSIS.durRatio = ARMOR_ANALYSIS.slotInfo.curDur / ARMOR_ANALYSIS.slotInfo.maxDur;
    ARMOR_ANALYSIS.useCurrent = true;
    resetArmorAnalysisTestState(true);
    renderArmorAnalysis();
  });

  // K6-3 zone selector — 위임
  const zRow = document.getElementById('aaZoneRow');
  if (zRow) zRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.aa-zone-btn');
    if (!btn) return;
    const z = btn.dataset.zone;
    ARMOR_ANALYSIS.zoneId = (ARMOR_ANALYSIS.zoneId === z) ? null : z;
    renderArmorAnalysis();
  });

  // 배경 클릭 시 닫기
  const overlay = document.getElementById('armorAnalysisOverlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeArmorAnalysis();
  });
})();

// === SIDE-ARMOR-INTERACTIVE-ANALYSIS-1: 실험장 컨트롤 이벤트 (once) ===
(function() {
  const tabbar = document.querySelector('.aa-tabbar');
  if (tabbar) tabbar.addEventListener('click', (e) => {
    const b = e.target.closest('.aa-tab'); if (!b) return;
    ARMOR_ANALYSIS.tab = b.dataset.tab;
    renderArmorAnalysisDynamic();
  });
  const distSlider = document.getElementById('aaDistanceSlider');
  if (distSlider) distSlider.addEventListener('input', () => {
    ARMOR_ANALYSIS.distanceM = parseInt(distSlider.value, 10) || 0;
    renderArmorAnalysis();
  });
  const quickRow = document.querySelector('.aa-quick-row');
  if (quickRow) quickRow.addEventListener('click', (e) => {
    const b = e.target.closest('.aa-quick'); if (!b) return;
    ARMOR_ANALYSIS.distanceM = +b.dataset.dist;
    renderArmorAnalysis();
  });
  const aspectRow = document.getElementById('aaAspectRow');
  if (aspectRow) aspectRow.addEventListener('click', (e) => {
    const b = e.target.closest('.aa-aspect-btn'); if (!b) return;
    ARMOR_ANALYSIS.aspect = b.dataset.aspect;
    renderArmorAnalysis();
  });
  const aimBtn = document.getElementById('aaAimModeBtn');
  if (aimBtn) aimBtn.addEventListener('click', () => { ARMOR_ANALYSIS.aimMode = !ARMOR_ANALYSIS.aimMode; renderArmorAnalysis(); });
  const f1 = document.getElementById('aaFireOneBtn'); if (f1) f1.addEventListener('click', () => fireArmorAnalysisShots(1));
  const f3 = document.getElementById('aaFire3Btn'); if (f3) f3.addEventListener('click', () => fireArmorAnalysisShots(3));
  const f5 = document.getElementById('aaFire5Btn'); if (f5) f5.addEventListener('click', () => fireArmorAnalysisShots(5));
  const rt = document.getElementById('aaResetTestBtn'); if (rt) rt.addEventListener('click', () => { resetArmorAnalysisTestState(false); renderArmorAnalysis(); });
  const toolbar = document.getElementById('aaStageToolbar');
  if (toolbar) toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('.aa-view-btn'); if (!b) return;
    ARMOR_ANALYSIS.viewMode = b.dataset.view;
    renderArmorAnalysisDynamic();
    document.querySelectorAll('.aa-view-btn').forEach(x => x.classList.toggle('on', x.dataset.view === ARMOR_ANALYSIS.viewMode));
  });
  const stage = document.getElementById('aaStageSvg');
  if (stage) stage.addEventListener('click', handleArmorAnalysisStageClick);
  // 피격 로그 클릭 → 해당 마커 강조
  const hitLog = document.getElementById('aaHitLog');
  if (hitLog) hitLog.addEventListener('click', (e) => {
    const row = e.target.closest('.aa-log-entry'); if (!row) return;
    ARMOR_ANALYSIS.selMarkerId = row.dataset.mid;
    const lg = ARMOR_ANALYSIS.hitLog.find(l => l.id === row.dataset.mid);
    if (lg) ARMOR_ANALYSIS.lastResult = lg;
    renderArmorAnalysis();
  });
})();

// =============================================================
