// DEBUG PANEL — 모바일 친화 통합 디버그 UI
// =============================================================
// 외부 스크립트/콘솔에서 사용 가능하게 핵심 AI 스캔 API 노출
if (typeof performInitialAIScan === 'function') window.performInitialAIScan = performInitialAIScan;
if (typeof performAllInitialScans === 'function') window.performAllInitialScans = performAllInitialScans;
if (typeof rescanNearbyEnemies === 'function') window.rescanNearbyEnemies = rescanNearbyEnemies;
if (typeof pickWatchDirection === 'function') window.pickWatchDirection = pickWatchDirection;
// 구조: DEBUG_REGISTRY에 항목 등록 → 자동으로 패널에 버튼 생성
// 항목 추가: registerDebugItem({ label, category, getState, toggle, description })
// 기존 콘솔 방식(GAME.debugX = true)은 그대로 유지 — 패널은 보조 UI
(function setupDebugPanel() {
  // ---- 등록 시스템 ----
  const DEBUG_REGISTRY = [];

  function registerDebugItem(item) {
    DEBUG_REGISTRY.push(item);
  }
  // 외부에서 추가 등록 가능하게 노출
  window.registerDebugItem = registerDebugItem;
  window.DEBUG_REGISTRY = DEBUG_REGISTRY;

  // GAME 플래그 자동 토글 헬퍼 — closure로 GAME 직접 참조 (window.GAME 의존 X)
  function gameFlag(key) {
    return {
      getState: () => !!GAME[key],
      toggle:   () => { GAME[key] = !GAME[key]; },
    };
  }

  // ---- 카테고리별 디버그 기능 등록 ----
  // AI
  registerDebugItem({
    label: 'AI Scan Ray', category: 'AI',
    description: '레이캐스트 스캔 ray (열림/half/full/wall/적)',
    ...gameFlag('debugAIScan'),
  });
  registerDebugItem({
    label: 'AI Memory', category: 'AI',
    description: '선택 유닛의 cover/corner/적/소음 기억 표시',
    ...gameFlag('debugAIMemory'),
  });
  registerDebugItem({
    label: 'Spatial Memory', category: 'AI',
    description: '선택 유닛이 믿는 지형 (붉은 구간 = 실재하지 않는 벽) + 미확인 구역',
    ...gameFlag('debugSpatialMemory'),
  });
  registerDebugItem({
    label: 'AI Cover Spot', category: 'AI',
    description: 'findBestCover의 상위 후보 + score 표시',
    ...gameFlag('debugAICover'),
  });
  registerDebugItem({
    label: 'AI State Label', category: 'AI',
    description: '적 AI 상태 라벨 (idle/patrol/contact/engage 등)',
    ...gameFlag('debugAI'),
  });
  registerDebugItem({
    label: 'Cover System', category: 'AI',
    description: '엄폐물 / 반엄폐물 위치 및 보호 영역',
    ...gameFlag('debugCover'),
  });
  registerDebugItem({
    label: 'Noise Events', category: 'AI',
    description: '소음 원 / 들은 위치 / lastHeard 마커',
    ...gameFlag('debugNoise'),
  });
  registerDebugItem({
    label: 'Utility AI', category: 'AI',
    description: '선택 유닛의 행동 후보 + 점수 + 이유 표시',
    ...gameFlag('debugUtility'),
  });
  registerDebugItem({
    label: 'Personal Space', category: 'AI',
    description: '대원 간 separation 거리 영역 표시',
    ...gameFlag('debugPersonalSpace'),
  });
  registerDebugItem({
    label: 'AI Scan Sweep', category: 'AI',
    description: '최근 스캔 ray + scanOffset/burst phase 시각화',
    ...gameFlag('debugAIScan'),
  });

  // GRENADE / FRAGMENT
  registerDebugItem({
    label: 'Fragment Ray', category: 'GRENADE',
    description: '파편 raycast 경로 + 관통/도탄/방호 차단 시각화',
    ...gameFlag('debugFragments'),
  });

  // COMBAT — 탄도 / 도탄 로그
  registerDebugItem({
    label: 'Ballistic Log', category: 'COMBAT',
    description: '관통/도탄/정지 상세 로그 (탄종, 각도, 확률, 결과)',
    ...gameFlag('debugBallistic'),
  });
  registerDebugItem({
    label: 'Impact Address', category: 'COMBAT',
    description: '2A-1 피격주소 — coverageZone/plateShape/transformedCoverage/organ후보/ricochetHint',
    ...gameFlag('debugImpactAddress'),
  });
  registerDebugItem({
    label: 'Visibility', category: 'COMBAT',
    description: '선택 유닛의 표적 가시성 (stance-aware halfCover 판정 결과)',
    ...gameFlag('debugVisibility'),
  });
  registerDebugItem({
    label: 'Fire Control', category: 'COMBAT',
    description: '사격통제 레이어 — fireIntent/safety/placement/headCap/lastKnown conf·unc/memoryClass 요약',
    ...gameFlag('debugFireControl'),
  });

  // MEDICAL
  registerDebugItem({
    label: 'Medical Summary', category: 'MEDICAL',
    description: '선택 유닛의 의료 상태 (vitals, lifeStatus, summary multipliers)',
    ...gameFlag('debugMedical'),
  });

  // ---- UI 요소 ----
  // DBG 탭 (항상 보이는 작은 버튼)
  const tab = document.createElement('button');
  tab.id = 'dbgTab';
  tab.textContent = 'DBG';
  tab.title = '디버그 패널 열기/닫기';
  // 패널 (반투명 사이드)
  const panel = document.createElement('div');
  panel.id = 'dbgPanel';
  panel.innerHTML = `
    <div class="dbg-header">
      <div class="dbg-title">DEBUG</div>
      <div class="dbg-header-actions">
        <button class="dbg-btn-allOff" id="dbgAllOffBtn">ALL OFF</button>
        <button class="dbg-close" id="dbgCloseBtn">✕</button>
      </div>
    </div>
    <div class="dbg-body" id="dbgBody"></div>
  `;
  document.body.appendChild(tab);
  document.body.appendChild(panel);

  // 스타일 (스크립트로 주입 — 한 곳에 모음)
  const style = document.createElement('style');
  style.textContent = `
    #dbgTab {
      position: fixed; right: 4px; top: 50%;
      transform: translateY(-50%);
      z-index: 9000;
      background: rgba(20, 30, 40, 0.85);
      color: #80d090;
      border: 1px solid #2a5a3a;
      border-radius: 6px 0 0 6px;
      padding: 8px 5px;
      font: 700 11px/1 monospace;
      letter-spacing: 0.1em;
      cursor: pointer;
      writing-mode: vertical-rl;
      touch-action: manipulation;
      min-height: 44px;
    }
    #dbgTab:active { background: rgba(40, 60, 50, 0.95); }
    #dbgTab.active { background: rgba(80, 140, 100, 0.85); color: #fff; }

    #dbgPanel {
      position: fixed; right: 0; top: 0; bottom: 0;
      width: min(380px, 78vw);
      background: rgba(10, 16, 22, 0.96);
      border-left: 2px solid #2a5a8a;
      z-index: 8999;
      display: none;
      flex-direction: column;
      box-shadow: -4px 0 12px rgba(0,0,0,0.6);
      -webkit-overflow-scrolling: touch;
    }
    #dbgPanel.on { display: flex; }
    .dbg-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px;
      background: rgba(30, 50, 70, 0.7);
      border-bottom: 1px solid #1f3a5a;
      flex-shrink: 0;
    }
    .dbg-title {
      font: 700 13px/1 monospace;
      letter-spacing: 0.2em;
      color: #80c0ff;
    }
    .dbg-header-actions { display: flex; gap: 6px; }
    .dbg-btn-allOff {
      background: #3a2828; border: 1px solid #6a4040; color: #ff9090;
      font: 700 10px monospace; padding: 6px 10px; border-radius: 3px;
      cursor: pointer; touch-action: manipulation;
    }
    .dbg-btn-allOff:active { background: #4a3030; }
    .dbg-close {
      background: #2a3a4a; border: 1px solid #4a5a6a; color: #d6dde2;
      font: 700 12px monospace; padding: 4px 9px; border-radius: 3px;
      cursor: pointer; touch-action: manipulation;
    }
    .dbg-close:active { background: #3a4a5a; }
    .dbg-body {
      flex: 1 1 auto; min-height: 0;
      overflow-y: auto; overflow-x: hidden;
      padding: 8px 10px 16px;
      scrollbar-width: thin;
    }
    .dbg-category {
      margin-bottom: 12px;
    }
    .dbg-cat-title {
      font: 700 10px monospace;
      letter-spacing: 0.2em;
      color: #5a7a90;
      margin: 6px 2px 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid #1f2a32;
    }
    .dbg-item {
      display: flex; flex-direction: column;
      background: #131a20;
      border: 1px solid #1f2a32;
      border-radius: 4px;
      margin-bottom: 4px;
      padding: 8px 10px;
      cursor: pointer;
      touch-action: manipulation;
      min-height: 44px;
      justify-content: center;
      /* button reset */
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      -webkit-appearance: none;
    }
    .dbg-item:active { background: #1a242c; }
    .dbg-item.on {
      background: #2a4030;
      border-color: #4a7050;
    }
    .dbg-item-row {
      display: flex; justify-content: space-between; align-items: center;
    }
    .dbg-item-label {
      font: 700 11px sans-serif;
      color: #d6dde2;
      flex: 1 1 auto;
    }
    .dbg-item.on .dbg-item-label { color: #b0ffb0; }
    .dbg-item-state {
      font: 700 10px monospace;
      padding: 2px 8px;
      border-radius: 2px;
      letter-spacing: 0.1em;
      background: #1f2a32; color: #6b7780;
      flex-shrink: 0;
    }
    .dbg-item.on .dbg-item-state {
      background: #80d090; color: #102018;
    }
    .dbg-item-desc {
      font: 400 9px sans-serif;
      color: #8a9099;
      margin-top: 3px;
      line-height: 1.3;
    }
    .dbg-item.on .dbg-item-desc { color: #a0c0a0; }
    @media (max-width: 480px) {
      #dbgTab { padding: 10px 6px; font-size: 12px; }
      #dbgPanel { width: 84vw; }
      .dbg-item { padding: 10px 12px; min-height: 48px; }
    }
  `;
  document.head.appendChild(style);

  // ---- 패널 렌더 ----
  function renderPanel() {
    const body = document.getElementById('dbgBody');
    if (!body) return;
    // 카테고리별 그룹화
    const groups = {};
    for (const item of DEBUG_REGISTRY) {
      const cat = item.category || 'OTHER';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    const catOrder = ['AI', 'COMBAT', 'GRENADE', 'MEDICAL', 'VISUAL', 'OTHER'];
    const sortedCats = Object.keys(groups).sort((a, b) => {
      const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    let html = '';
    for (const cat of sortedCats) {
      html += `<div class="dbg-category"><div class="dbg-cat-title">${cat}</div>`;
      for (let i = 0; i < groups[cat].length; i++) {
        const item = groups[cat][i];
        const idx = DEBUG_REGISTRY.indexOf(item);
        const on = !!item.getState();
        html += `
          <button class="dbg-item ${on ? 'on' : ''}" data-dbg-idx="${idx}" type="button">
            <div class="dbg-item-row">
              <div class="dbg-item-label">${item.label}</div>
              <div class="dbg-item-state">${on ? 'ON' : 'OFF'}</div>
            </div>
            ${item.description ? `<div class="dbg-item-desc">${item.description}</div>` : ''}
          </button>
        `;
      }
      html += `</div>`;
    }
    body.innerHTML = html;
  }

  // ---- 토글 동작 ----
  function setOpen(open) {
    if (open) {
      panel.classList.add('on');
      tab.classList.add('active');
      renderPanel();
    } else {
      panel.classList.remove('on');
      tab.classList.remove('active');
    }
  }
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!panel.classList.contains('on'));
  });
  document.getElementById('dbgCloseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  document.getElementById('dbgAllOffBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    for (const item of DEBUG_REGISTRY) {
      if (item.getState()) item.toggle();
    }
    renderPanel();
  });
  // 항목 토글 — pointerup 사용 (모바일에서도 안정적)
  function toggleItemFromEvent(e) {
    const it = e.target.closest('.dbg-item');
    if (!it) return;
    e.stopPropagation();
    e.preventDefault();
    const idx = parseInt(it.dataset.dbgIdx, 10);
    if (isNaN(idx)) return;
    const item = DEBUG_REGISTRY[idx];
    if (!item) return;
    item.toggle();
    // 부분 갱신
    const on = !!item.getState();
    it.classList.toggle('on', on);
    const state = it.querySelector('.dbg-item-state');
    if (state) state.textContent = on ? 'ON' : 'OFF';
  }
  const bodyEl = document.getElementById('dbgBody');
  bodyEl.addEventListener('click', toggleItemFromEvent);

  // 게임 캔버스로 이벤트가 전파되지 않게 — 패널 자체의 pointerdown만 막음
  //   (단 click은 막지 않아 위 핸들러가 정상 동작)
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('touchstart',  (e) => e.stopPropagation());
  tab.addEventListener('pointerdown',   (e) => e.stopPropagation());
  tab.addEventListener('touchstart',    (e) => e.stopPropagation());
})();

