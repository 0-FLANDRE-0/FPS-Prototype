// COVERAGE TAB — 방호 정보 시각화
// =============================================================
let covCurrentSide   = 'friend';   // 'friend' | 'enemy'
let covCurrentAspect = 'front';    // 'front' | 'side' | 'rear'
let covSelectedPanelId = null;

// 방향별 머리 실루엣 (viewBox 0 0 100 60)
//   front: 얼굴 정면 (눈/코/입 디테일 — 윤곽 + 얼굴 평면)
//   side : 옆모습 (코/턱 라인)
//   rear : 후두부 (머리카락 윤곽)
function getHeadSilhouette(aspect) {
  if (aspect === 'side') {
    // 옆모습 — 왼쪽 방향을 바라봄 (IOTV/6B23 측면 armor 기준에 맞춤)
    return `
      <path class="cov-body" d="
        M 68 10 Q 66 5 58 4 Q 42 3 33 8
        Q 24 13 22 24 Q 21 33 26 40
        L 30 42 Q 34 45 37 49
        Q 43 52 50 51
        L 55 49 Q 58 46 59 43
        Q 68 41 71 33
        Q 73 22 68 10 Z" />
      <ellipse class="cov-body-detail" cx="53" cy="28" rx="3" ry="5" />
      <path class="cov-body-detail" d="M 30 42 Q 37 47 44 50" />`;
  }
  if (aspect === 'rear') {
    return `
      <path class="cov-body" d="
        M 38 6 Q 50 3 62 6 Q 70 10 70 22
        Q 70 33 65 41 Q 60 49 50 50
        Q 40 49 35 41 Q 30 33 30 22
        Q 30 10 38 6 Z" />
      <path class="cov-body-detail" d="M 36 16 Q 50 12 64 16" />
      <path class="cov-body-detail" d="M 34 27 Q 50 23 66 27" />`;
  }
  // front — 달걀형 두상 + 얼굴 평면
  return `
    <path class="cov-body" d="
      M 38 6 Q 50 3 62 6 Q 70 10 70 22
      Q 70 32 66 40 Q 61 49 50 50
      Q 39 49 34 40 Q 30 32 30 22
      Q 30 10 38 6 Z" />
    <path class="cov-face-skin" d="
      M 35 23 Q 38 17 50 17 Q 62 17 65 23
      L 65 38 Q 60 47 50 47 Q 40 47 35 38 Z" />
    <ellipse fill="#5a6470" cx="43" cy="27" rx="1.8" ry="1.2" />
    <ellipse fill="#5a6470" cx="57" cy="27" rx="1.8" ry="1.2" />
    <line stroke="#3a4550" stroke-width="0.8" x1="45" y1="39" x2="55" y2="39" />`;
}

// 방향별 상반신 실루엣 (viewBox 0 0 100 100)
function getTorsoSilhouette(aspect) {
  if (aspect === 'side') {
    // 옆모습 — 왼쪽 방향을 바라봄. 가슴 앞으로, 등 뒤로, 허리 잘록 (PSD 비례)
    return `
      <path class="cov-body" d="M 60 4 Q 60 12 62 17 L 42 17 Q 44 12 44 4 Z" />
      <path class="cov-body" d="
        M 62 17 Q 71 20 74 29
        L 76 42 Q 76 56 73 67
        Q 71 80 68 92
        L 30 92 Q 26 80 26 67
        L 26 42 Q 26 27 34 21 L 42 17 Z" />
      <path class="cov-body-detail" d="M 62 21 Q 69 27 71 36 L 72 52" />
      <path class="cov-body-detail" d="M 74 40 Q 70 45 66 47" />`;
  }
  // front / rear — 경사진 어깨 + 잘록한 허리 (PSD 비례, IOTV 크기)
  return `
    <path class="cov-body" d="M 41 4 Q 41 12 39 17 L 61 17 Q 59 12 59 4 Z" />
    <path class="cov-body" d="
      M 40 17 Q 27 18 18 25 L 15 35 Q 15 41 17 43
      L 21 33 Q 25 25 34 22 L 41 22 Z" />
    <path class="cov-body" d="
      M 60 17 Q 73 18 82 25 L 85 35 Q 85 41 83 43
      L 79 33 Q 75 25 66 22 L 59 22 Z" />
    <path class="cov-body" d="
      M 33 22 L 67 22 Q 78 26 80 37 Q 79 51 74 63
      Q 72 75 69 81 Q 65 90 58 92 L 42 92
      Q 35 90 31 81 Q 28 75 26 63 Q 21 51 20 37 Q 22 26 33 22 Z" />
    ${aspect === 'front' ? '<line class="cov-body-detail" x1="50" y1="22" x2="50" y2="82" />' : ''}`;
}

function renderCoverageTab() {
  const ld = getScopedLoadout(covCurrentSide) || {};
  // SIDE-PER-OPERATOR-LOADOUT-1: 방호 탭 대원 scope 바 + 라벨 (covCurrentSide 기준)
  const _covBar = document.getElementById('covOpScopeBar');
  if (_covBar) renderOperatorScopeBar(null, covCurrentSide, _covBar);
  const _covLbl = document.getElementById('covOpScopeLabel');
  if (_covLbl) _covLbl.innerHTML = `방호 정보: <b>${covCurrentSide === 'friend' ? 'FRIENDLY' : 'HOSTILE'} · ${_opScopeLabel(covCurrentSide)}</b>`;
  const armorId  = ld.bodyArmorId;
  const helmetId = ld.helmetId;
  const armor  = armorId  ? BODY_ARMOR_PRESETS[armorId] : null;
  const helmet = helmetId ? HELMET_PRESETS[helmetId]   : null;

  // 상단 표시
  const armorEl = document.getElementById('covCurArmor');
  const helmEl  = document.getElementById('covCurHelmet');
  if (armorEl) armorEl.textContent = armor ? armor.name : '방탄복 없음';
  if (helmEl)  helmEl.textContent  = helmet ? helmet.name : '헬멧 없음';

  // 플레이트 cycler 렌더 — 호환성 반영
  const sideSupported = armorSupportsSidePlate(armorId);
  function renderPlateCycler(slotKind, slotKey, nameEl) {
    const el = document.getElementById(nameEl);
    if (!el) return;
    const curId = ld[slotKey];
    const p = curId ? PLATE_PRESETS[curId] : null;
    // 호환 후보 — 모든 plate 슬롯에 대해 검사
    const opts = getCompatiblePlatesForArmor(armorId, slotKind);
    const onlyNone = (opts.length <= 1);   // 'no_*_plate' 하나뿐이면
    const isSideUnsupported = (slotKind === 'side' && !sideSupported);
    // JPC/레플리카는 측면 슬롯 자체를 숨김 (6B23은 '슬롯 없음' 표시 유지)
    const hideSideRow = isSideUnsupported && (armorId === 'jpc_test' || armorId === 'replica_tactical_vest' || armorId === 'airsoft_plate_carrier');

    // === plate 행 자체 숨김 ===
    //   Police Vest처럼 plate 슬롯이 없는 방탄복은 행 숨김.
    //   6B23의 side는 슬롯 없음 표시 (기존 동작 유지). JPC/레플리카 side는 숨김.
    const row = el.closest('.cov-plate-row');
    if (row) {
      if (hideSideRow) {
        row.style.display = 'none';
        return;
      } else if (onlyNone && !isSideUnsupported) {
        row.style.display = 'none';
        return;
      } else if (onlyNone && isSideUnsupported) {
        // 6B23 side: 행은 보이고 "슬롯 없음"으로 표시
        row.style.display = '';
      } else {
        row.style.display = '';
      }
    }

    if (isSideUnsupported) {
      el.textContent = '슬롯 없음';
      el.className = 'cov-plate-name disabled';
    } else if (!p || p.isNone) {
      el.textContent = '없음';
      el.className = 'cov-plate-name none';
    } else {
      el.textContent = p.shortName || p.name;
      el.className = 'cov-plate-name';
    }
    // 카드(행) 자체 disabled 표시 — 슬롯 없는 경우 클릭 막힘
    if (row) row.classList.toggle('disabled', isSideUnsupported);
  }
  renderPlateCycler('front', 'frontPlateId', 'covFrontPlateName');
  renderPlateCycler('back',  'backPlateId',  'covBackPlateName');
  renderPlateCycler('side',  'sidePlateId',  'covSidePlateName');

  // === 추가 보호구 cycler ===
  function renderAccCycler(slotKind, slotKey, nameEl) {
    const el = document.getElementById(nameEl);
    if (!el) return;
    const curId = ld[slotKey];
    const a = curId ? PROTECTION_ACCESSORY_PRESETS[curId] : null;
    // 호환 후보
    let opts;
    if (slotKind === 'visor' || slotKind === 'slaap') {
      opts = getCompatibleAccessoriesForHelmet(ld.helmetId, slotKind);
    } else {
      opts = getCompatibleAccessoriesForArmor(ld.bodyArmorId, slotKind);
    }
    const isDisabled = (opts.length <= 1);

    // === 호환 가능한 보호구가 'no_*' 하나뿐이면 행 자체 숨김 ===
    //   visor/slaap: 헬멧 미지원 시 숨김
    //   groin/shoulder/neck: 방탄복 미지원 시 숨김 (JPC/Police Vest 등)
    const row = el.closest('.cov-plate-row');
    if (row) {
      if (isDisabled) {
        row.style.display = 'none';
        return;
      } else {
        row.style.display = '';
      }
    }

    if (!a || a.isNone) {
      el.textContent = '없음';
      el.className = 'cov-plate-name none';
    } else {
      el.textContent = a.shortName || a.name;
      el.className = 'cov-plate-name';
    }
    // UI selector는 HTML data-acc-slot(UI slotKey)과 일치해야 함.
    //   slotKey는 내부 id 필드명('groinGuardId')이므로 'Id'를 떼어 UI slotKey('groinGuard')로 변환.
    const uiSlotKey = slotKey.replace(/Id$/, '');
    document.querySelectorAll(`.cov-plate-cyc[data-acc-slot="${uiSlotKey}"]`).forEach(b => {
      b.disabled = isDisabled;
    });
  }
  renderAccCycler('groin',    'groinGuardId',    'covGroinName');
  renderAccCycler('shoulder', 'shoulderGuardId', 'covShoulderName');
  renderAccCycler('neck',     'neckGuardId',     'covNeckName');
  renderAccCycler('visor',    'visorId',         'covVisorName');
  renderAccCycler('slaap',    'slaapId',         'covSlaapName');

  // 버튼 동기화
  document.querySelectorAll('.cov-side-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.side === covCurrentSide);
  });
  document.querySelectorAll('.cov-aspect-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.aspect === covCurrentAspect);
  });

  // 실루엣 렌더 — 방향마다 다름
  const headSil = document.getElementById('covHeadSilhouette');
  const torsoSil = document.getElementById('covTorsoSilhouette');
  if (headSil)  headSil.innerHTML  = getHeadSilhouette(covCurrentAspect);
  if (torsoSil) torsoSil.innerHTML = getTorsoSilhouette(covCurrentAspect);

  // 방탄복 — softShape 먼저(아래) → hardShape(위) → extras
  const torsoG = document.getElementById('covArmorPanels');
  if (torsoG) {
    const shape = (ARMOR_COVERAGE_SHAPES[armorId] && ARMOR_COVERAGE_SHAPES[armorId][covCurrentAspect]) || {};
    let svg = '';
    // 1) extras (어깨/사타구니 패드 — 가장 아래)
    if (shape.extras) {
      for (const e of shape.extras) {
        const on = covSelectedPanelId === e.id ? ' on' : '';
        svg += `<polygon class="cov-extra-panel${on}" data-panel-id="${e.id}" data-equip-kind="armor"
                points="${e.points}" />`;
      }
    }
    // 2) softShape — 캐리어 외곽
    if (shape.softShape) {
      const s = shape.softShape;
      const on = covSelectedPanelId === s.id ? ' on' : '';
      svg += `<polygon class="cov-soft-panel${on}" data-panel-id="${s.id}" data-equip-kind="armor"
              points="${s.points}" />`;
    }
    // 3) hardShape — 하드 플레이트 (위에 겹침). 단, 해당 슬롯에 플레이트가 장착돼 있어야 표시.
    //    aspect별로 frontPlateId / backPlateId / sidePlateId 참조.
    function plateForAspect(asp) {
      if (asp === 'front')      return PLATE_PRESETS[ld.frontPlateId];
      else if (asp === 'rear')  return PLATE_PRESETS[ld.backPlateId];
      else if (asp === 'side')  return PLATE_PRESETS[ld.sidePlateId];
      return null;
    }
    const curArmorPreset = BODY_ARMOR_PRESETS[armorId];
    const armorNoPlates = curArmorPreset && curArmorPreset.noPlateSlots;
    const curPlate = armorNoPlates ? null : plateForAspect(covCurrentAspect);
    const hasPlate = curPlate && !curPlate.isNone;

    // 3a) 일반 hardShape — requiresPlateSlot 없거나 매칭되면 표시. fixedPlate는 항상 표시.
    if (shape.hardShape && (hasPlate || shape.hardShape.fixedPlate)) {
      const h = shape.hardShape;
      if (h.fixedPlate) {
        // 고정형 내장 플레이트 — plateShape 무관, polygon 그대로
        const on = covSelectedPanelId === h.id ? ' on' : '';
        svg += `<polygon class="cov-hard-panel${on}" data-panel-id="${h.id}" data-equip-kind="armor" data-fixed-plate="1"
                points="${h.points}" />`;
        const cb = _bboxOfPoints(h.points);
        const ix = cb.minX + cb.w*0.20, iy = cb.minY + cb.h*0.20, iw = cb.w*0.6, ih = cb.h*0.6;
        const inset = `${ix},${iy} ${ix+iw},${iy} ${ix+iw},${iy+ih} ${ix},${iy+ih}`;
        svg += `<polygon class="cov-plate-core" points="${inset}" pointer-events="none" />`;
      } else {
      const req = h.requiresPlateSlot;   // 6B23 rear는 'back' 요구
      const match = !req || (curPlate.slotType === req);
      if (match) {
        // 2A-2: plateShape 기반 동적 polygon
        const pShape = (typeof getPlateShape === 'function') ? getPlateShape(curPlate.id, _slotHitPart(h.slot)) : 'sapi';
        const bbox = _bboxOfPoints(h.points);
        const platePts = plateShapeToPoints(pShape, bbox, 0);
        const corePts  = plateShapeToPoints(pShape, bbox, 0.20);
        const on = covSelectedPanelId === h.id ? ' on' : '';
        svg += `<polygon class="cov-hard-panel${on}" data-panel-id="${h.id}" data-equip-kind="armor" data-plate-shape="${pShape}"
                points="${platePts}" />`;
        // plateCore (안쪽 inset) — 클릭 불가, 시각 구분용
        svg += `<polygon class="cov-plate-core" points="${corePts}" pointer-events="none" />`;
      }
      }
    }
    // 3b) hardShapeSet — 6B23 frontSet (가슴+복부 2개)
    if (shape.hardShapeSet && hasPlate) {
      for (const h of shape.hardShapeSet) {
        const req = h.requiresPlateSlot;
        const match = !req || (curPlate.slotType === req);
        if (!match) continue;
        const pShape = (typeof getPlateShape === 'function') ? getPlateShape(curPlate.id, _slotHitPart(h.slot)) : 'sapi';
        const bbox = _bboxOfPoints(h.points);
        const platePts = plateShapeToPoints(pShape, bbox, 0);
        const corePts  = plateShapeToPoints(pShape, bbox, 0.20);
        const on = covSelectedPanelId === h.id ? ' on' : '';
        svg += `<polygon class="cov-hard-panel${on}" data-panel-id="${h.id}" data-equip-kind="armor" data-plate-shape="${pShape}"
                points="${platePts}" />`;
        svg += `<polygon class="cov-plate-core" points="${corePts}" pointer-events="none" />`;
      }
    }

    // 3c) 2A-3: 사이드 플레이트 — 정면/후면 view에서는 좌우 옆구리 가장자리 세로 패널로 표시
    //   (사이드 플레이트가 흉부/복부 중앙에 뜨지 않도록. 측면 view에서는 별도 hardShape가 처리)
    if (covCurrentAspect === 'front' || covCurrentAspect === 'rear') {
      const sp = PLATE_PRESETS[ld.sidePlateId];
      if (sp && !sp.isNone) {
        const sShape = (typeof getPlateShape === 'function') ? getPlateShape(sp.id, 'chest') : 'side_plate_small';
        const isLarge = (sShape === 'side_plate_large');
        const edges = SIDE_PLATE_EDGE_POLYGONS[isLarge ? 'large' : 'small'];
        ['side_plate_edge_left', 'side_plate_edge_right'].forEach((pid, i) => {
          const on = covSelectedPanelId === pid ? ' on' : '';
          svg += `<polygon class="cov-hard-panel${on}" data-panel-id="${pid}" data-equip-kind="armor" data-plate-shape="${sShape}" data-plate-loc="sidePlate"
                  points="${edges[i]}" />`;
        });
      }
    }
    //   groin / shoulder / neck — 현재 aspect에 해당 좌표가 있을 때만.
    //   각 accessory에 dataset.accId 부착 → 클릭 시 상세 표시.
    function addAccPanel(accId, shapeData, panelIdSuffix) {
      if (!shapeData) return;
      const acc = PROTECTION_ACCESSORY_PRESETS[accId];
      if (!acc || acc.isNone) return;
      const cls = (acc.armorType === 'hard' || acc.armorType === 'mixed') ? 'cov-acc-hard' : 'cov-acc-soft';
      if (shapeData.ids) {
        // 좌우 한 쌍 (shoulder)
        for (const sh of shapeData.ids) {
          const pid = sh.id;
          const on = covSelectedPanelId === pid ? ' on' : '';
          svg += `<polygon class="${cls}${on}" data-panel-id="${pid}" data-equip-kind="accessory" data-acc-id="${accId}"
                  points="${sh.points}" />`;
        }
      } else {
        const pid = shapeData.id;
        const on = covSelectedPanelId === pid ? ' on' : '';
        svg += `<polygon class="${cls}${on}" data-panel-id="${pid}" data-equip-kind="accessory" data-acc-id="${accId}"
                points="${shapeData.points}" />`;
      }
    }
    addAccPanel(ld.groinGuardId,    ACCESSORY_SHAPES.groin[covCurrentAspect]);
    addAccPanel(ld.shoulderGuardId, ACCESSORY_SHAPES.shoulder[covCurrentAspect]);
    addAccPanel(ld.neckGuardId,     ACCESSORY_SHAPES.neck[covCurrentAspect]);

    // === 2A-2: 주요 gap overlay (정면 한정, 약한 표시) ===
    //   현재 삽입 plate의 shape 기준 major gap을 약하게 표시. 판정 변경 없음.
    if (covCurrentAspect === 'front' && GAP_VISUAL_POLYGONS.front) {
      const pShape = hasPlate ? ((typeof getPlateShape === 'function') ? getPlateShape(curPlate.id, 'chest') : 'sapi') : null;
      let gaps = pShape ? _majorGapsForShape(pShape, 'chest') : [];
      // soft coverage가 빈약한 캐리어(JPC/airsoft/replica)는 측면 gap 추가 강조
      const vestProf = (typeof getVestSoftProfile === 'function') ? getVestSoftProfile({ bodyArmorId: armorId }) : null;
      const chestSoftness = vestProf ? (vestProf.chestFront || 0.3) : 0.3;
      if (chestSoftness < 0.3) { gaps = gaps.concat(['axillaGap','upperLateralGap']); }
      // groinGuard 없으면 골반 인접 gap 표시
      const hasGroin = ld.groinGuardId && ld.groinGuardId !== 'no_groin_guard';
      if (!hasGroin) gaps.push('pelvisGroinAdjacent');
      // 중복 제거
      const seen = {};
      for (const g of gaps) {
        if (seen[g]) continue; seen[g] = 1;
        const polys = GAP_VISUAL_POLYGONS.front[g];
        if (!polys) continue;
        for (const pts of polys) {
          svg += `<polygon class="cov-gap-zone" data-gap="${g}" points="${pts}" />`;
        }
      }
    }

    torsoG.innerHTML = svg;
  }

  // 헬멧 — shellShape + visor + SLAAP
  const headG = document.getElementById('covHelmetPanels');
  if (headG) {
    const shape = (HELMET_COVERAGE_SHAPES[helmetId] && HELMET_COVERAGE_SHAPES[helmetId][covCurrentAspect]) || {};
    let svg = '';
    if (shape.shellShape) {
      const s = shape.shellShape;
      const on = covSelectedPanelId === s.id ? ' on' : '';
      svg += `<polygon class="cov-hard-panel${on}" data-panel-id="${s.id}" data-equip-kind="helmet"
              points="${s.points}" />`;
    }
    // SLAAP — 헬멧 전면 상단 (정면 전용)
    if (ld.slaapId && !PROTECTION_ACCESSORY_PRESETS[ld.slaapId].isNone) {
      const slaapShape = ACCESSORY_SHAPES.slaap[covCurrentAspect];
      if (slaapShape) {
        const pid = slaapShape.id;
        const on = covSelectedPanelId === pid ? ' on' : '';
        svg += `<polygon class="cov-acc-hard${on}" data-panel-id="${pid}" data-equip-kind="accessory" data-acc-id="${ld.slaapId}"
                points="${slaapShape.points}" />`;
      }
    }
    // Visor — K6-3은 glass+frame 분할, 그 외는 단일 패널
    if (ld.visorId && !PROTECTION_ACCESSORY_PRESETS[ld.visorId].isNone) {
      const visor = PROTECTION_ACCESSORY_PRESETS[ld.visorId];
      if (visor.visorHitTable && ACCESSORY_SHAPES.visorK63[covCurrentAspect]) {
        // K6-3 — 티타늄 프레임(노랑) 먼저 + 방탄유리(분홍) 위
        const k63 = ACCESSORY_SHAPES.visorK63[covCurrentAspect];
        const onF = covSelectedPanelId === k63.frame.id ? ' on' : '';
        svg += `<polygon class="cov-acc-hard${onF}" data-panel-id="${k63.frame.id}" data-equip-kind="accessory" data-acc-id="${ld.visorId}" data-zone="titanium"
                style="fill: rgba(230, 200, 60, 0.5); stroke: rgba(245, 225, 120, 0.95);"
                points="${k63.frame.points}" />`;
        const onG = covSelectedPanelId === k63.glass.id ? ' on' : '';
        // 방탄유리 — 분홍
        svg += `<polygon class="cov-acc-hard${onG}" data-panel-id="${k63.glass.id}" data-equip-kind="accessory" data-acc-id="${ld.visorId}" data-zone="glass"
                style="fill: rgba(220, 80, 200, 0.45); stroke: rgba(240, 140, 220, 0.95);"
                points="${k63.glass.points}" />`;
      } else if (ACCESSORY_SHAPES.visor[covCurrentAspect]) {
        const v = ACCESSORY_SHAPES.visor[covCurrentAspect];
        const on = covSelectedPanelId === v.id ? ' on' : '';
        svg += `<polygon class="cov-acc-hard${on}" data-panel-id="${v.id}" data-equip-kind="accessory" data-acc-id="${ld.visorId}"
                points="${v.points}" />`;
      }
    }
    // 2A-3: 고컷 헬멧 측면 view — 귀/측면 하부 노출 gap overlay (약하게)
    if (covCurrentAspect === 'side' && helmetId) {
      const highCut = ['fast_mt','lshz_light','helmet_fast_bump','helmet_fast_carbon_bump'];
      if (highCut.indexOf(helmetId) >= 0) {
        // 귀 영역 (측면 하부) — shell 아래 노출
        svg += `<polygon class="cov-gap-zone" data-gap="earCoverageGap" points="22,33 44,33 44,46 24,46" />`;
        svg += `<polygon class="cov-gap-zone" data-gap="sideLowerHelmetGap" points="50,33 78,33 76,44 52,44" />`;
      }
    }
    headG.innerHTML = svg;
  }

  // 클릭 핸들러
  document.querySelectorAll('#covArmorPanels polygon, #covHelmetPanels polygon').forEach(el => {
    el.addEventListener('click', (ev) => {
      const pid = ev.currentTarget.getAttribute('data-panel-id');
      covSelectedPanelId = (covSelectedPanelId === pid) ? null : pid;
      renderCoverageTab();
    });
  });

  // 상세 영역
  if (covSelectedPanelId) {
    const armorShape = (ARMOR_COVERAGE_SHAPES[armorId] && ARMOR_COVERAGE_SHAPES[armorId][covCurrentAspect]) || {};
    const helmShape  = (HELMET_COVERAGE_SHAPES[helmetId] && HELMET_COVERAGE_SHAPES[helmetId][covCurrentAspect]) || {};
    let found = null, kind = null;
    if (armorShape.softShape && armorShape.softShape.id === covSelectedPanelId) { found = armorShape.softShape; kind = 'armor-soft'; }
    else if (armorShape.hardShape && armorShape.hardShape.id === covSelectedPanelId) { found = armorShape.hardShape; kind = 'armor-hard'; }
    else if (armorShape.hardShapeSet) {
      for (const h of armorShape.hardShapeSet) if (h.id === covSelectedPanelId) { found = h; kind = 'armor-hard'; break; }
    }
    if (!found && armorShape.extras) {
      for (const e of armorShape.extras) if (e.id === covSelectedPanelId) { found = e; kind = 'armor-extra'; break; }
    }
    if (!found && helmShape.shellShape && helmShape.shellShape.id === covSelectedPanelId) { found = helmShape.shellShape; kind = 'helmet-shell'; }
    // 2A-3: 사이드 플레이트 가장자리 패널 (정면/후면 동적 생성) — 합성 shape로 상세 표시
    if (!found && (covSelectedPanelId === 'side_plate_edge_left' || covSelectedPanelId === 'side_plate_edge_right')) {
      const sp = PLATE_PRESETS[ld.sidePlateId];
      if (sp && !sp.isNone) {
        const sideKor = covSelectedPanelId.endsWith('left') ? '좌측' : '우측';
        found = { id: covSelectedPanelId, label: `측면판 (${sideKor} 옆구리)`, slot: 'chest_side', _sidePlate: true };
        kind = 'armor-hard';
      }
    }
    // accessory panel — dom에서 직접 찾아서 acc-id 확인
    if (!found) {
      const accPoly = document.querySelector(`polygon[data-panel-id="${covSelectedPanelId}"][data-equip-kind="accessory"]`);
      if (accPoly) {
        const accId = accPoly.getAttribute('data-acc-id');
        const zone = accPoly.getAttribute('data-zone');
        const a = accId ? PROTECTION_ACCESSORY_PRESETS[accId] : null;
        if (a) {
          // 분석용 컨텍스트 저장
          _covCurrentAnalysisCtx = { kind: 'accessory', accessory: a, accZone: zone };
          renderCovPanelDetailAccessory(a, zone);
          appendAnalyzeButton();
          return;
        }
      }
    }
    if (found) {
      _covCurrentAnalysisCtx = { kind, shape: found, armor, helmet };
      renderCovPanelDetail(found, kind, armor, helmet);
      appendAnalyzeButton();
    }
    else { covSelectedPanelId = null; renderCovPanelEmpty(); }
  } else {
    renderCovPanelEmpty();
    _covCurrentAnalysisCtx = null;
  }
  renderCovMiniLog();
}

// === 2A-2: 최근 피격 미니 로그 (검증용, AAR 전체 UI 아님) ===
function renderCovMiniLog() {
  const el = document.getElementById('covMiniLog');
  if (!el) return;
  const log = (typeof GAME !== 'undefined' && GAME._impactLog) ? GAME._impactLog : [];
  if (!log.length) {
    el.innerHTML = `<div class="cov-minilog-title">최근 피격 로그</div><div class="cov-minilog-empty">아직 기록된 피격이 없습니다 (교전 후 표시)</div>`;
    return;
  }
  function unitName(id) {
    if (id == null) return '—';
    const u = (typeof UNITS !== 'undefined') ? UNITS.find(x => x.id === id) : null;
    if (!u) return 'Unit ' + id;
    const team = (u.team === 'friend' || u.team === 'friendly') ? '아군'
               : (u.team === 'enemy' || u.team === 'hostile') ? '적' : '?';
    return `${team} ${u.callsign || u.name || u.id}`;
  }
  const recent = log.slice(-12).reverse();
  let html = `<div class="cov-minilog-title">최근 피격 로그 (${log.length})</div>`;
  for (const ev of recent) {
    const ia = ev.impactAddress || {};
    const t = (ev.time != null) ? ev.time.toFixed(1) + 's' : '—';
    const label = ia.aarLabel || (typeof getImpactAddressLabel === 'function' ? getImpactAddressLabel(ia) : '') || ev.hitPart || '?';
    // 결과 색
    let resCls = 'cov-minilog-stop';
    const pr = ia.penetrationResult, ar = ia.armorResult;
    if (pr === 'ricocheted' || ar === 'deflected') resCls = 'cov-minilog-ric';
    else if (pr === 'penetrated' || ar === 'penetrated') resCls = 'cov-minilog-pen';
    const src = ({ bullet:'사격', frag:'파편', blast:'폭압', blunt:'둔격' })[ev.sourceType] || ev.sourceType || '';
    // 장기 후보 간략
    let cand = '';
    if (ia.organCandidates && ia.organCandidates.length) cand = ' · ' + getOrganListLabel(ia.organCandidates.slice(0,2)) + ' 후보';
    html += `<div class="cov-minilog-item">
      <span class="cov-minilog-time">[${t}]</span> ${unitName(ev.shooterId)} → ${unitName(ev.targetId)} <span style="color:#6b7780">(${src})</span><br>
      <span class="${resCls}">${label}</span>${cand}
    </div>`;
  }
  el.innerHTML = html;
}

// 분석 컨텍스트 — 현재 covDetail이 표시 중인 슬롯의 분석용 정보
let _covCurrentAnalysisCtx = null;

function appendAnalyzeButton() {
  if (!_covCurrentAnalysisCtx) return;
  const ctx = _covCurrentAnalysisCtx;
  // 분석 대상이 있는지 확인 — 실제 방호구인지
  const armor = BODY_ARMOR_PRESETS[(getScopedLoadout(covCurrentSide) || {}).bodyArmorId];
  const helmet = HELMET_PRESETS[(getScopedLoadout(covCurrentSide) || {}).helmetId];
  let info;
  if (ctx.kind === 'accessory') {
    info = buildAnalysisSlotInfo(null, 'accessory', armor, helmet, ctx.accessory, ctx.accZone);
  } else {
    info = buildAnalysisSlotInfo(ctx.shape, ctx.kind, armor, helmet);
  }
  if (!info || !info.baseArmor) return;   // 비방호는 버튼 X
  const el = document.getElementById('covDetail');
  if (!el) return;
  // 기존 버튼 제거 후 새로 추가
  const old = el.querySelector('.cov-detail-analyze');
  if (old) old.remove();
  const btn = document.createElement('button');
  btn.className = 'cov-detail-analyze';
  btn.textContent = '▶ 방호 분석';
  btn.addEventListener('click', () => openArmorAnalysis(info));
  el.appendChild(btn);
}

// accessory 상세 — 이름, 방호값, 재질, 무게, (K6-3은 zone 별 정보)
function renderCovPanelDetailAccessory(accessory, zone) {
  const el = document.getElementById('covDetail');
  if (!el) return;
  let body = '';
  body += `<div class="cov-detail-title">${accessory.name}</div>`;
  body += `<div class="cov-detail-row"><span>종류</span><b>${{groin:'낭심',shoulder:'어깨',neck:'목',visor:'바이저',slaap:'SLAAP'}[accessory.accessoryType] || '보호구'}</b></div>`;
  body += `<div class="cov-detail-row"><span>무게</span><b>${(accessory.weightKg||0).toFixed(2)} kg</b></div>`;
  // K6-3 visor — 영역별 표시
  if (accessory.visorHitTable) {
    if (zone) {
      const zoneObj = accessory.visorHitTable.find(z => z.id === zone);
      if (zoneObj) {
        // 2A-2: 유리부/금속부 구분 표시 — 계산 재질(PE 등)과 표시 의미 분리
        const isGlass = (zoneObj.id === 'glass' || /glass|visor/i.test(zoneObj.id) || /유리/.test(zoneObj.label || ''));
        const isMetal = (zoneObj.material === 'titanium' || zoneObj.material === 'steel');
        body += `<div class="cov-detail-row"><span>피격 영역</span><b>${zoneObj.label} (${(zoneObj.weight*100).toFixed(0)}%)</b></div>`;
        if (isGlass) {
          body += `<div class="cov-detail-row"><span>표시 영역</span><b style="color:#7ad8f0">방탄유리 (eyeGlass/visionSlitGlass)</b></div>`;
          body += `<div class="cov-detail-row"><span>계산 재질</span><b>${getMaterialDisplay(zoneObj.material)} proxy</b></div>`;
          body += `<div class="cov-detail-row"><span>손상 힌트</span><b style="color:#7ad8f0">crack / shatter</b></div>`;
          body += `<div class="cov-detail-row"><span>도탄</span><b>비활성 (유리부)</b></div>`;
        } else if (isMetal) {
          body += `<div class="cov-detail-row"><span>표시 영역</span><b style="color:#d0a0f0">티타늄 안면판 (titaniumFacePlate)</b></div>`;
          body += `<div class="cov-detail-row"><span>재질</span><b>${getMaterialDisplay(zoneObj.material)}</b></div>`;
          body += `<div class="cov-detail-row"><span>손상 힌트</span><b style="color:#d0a0f0">dent / deformation / ricochet 가능</b></div>`;
        } else {
          body += `<div class="cov-detail-row"><span>재질</span><b>${getMaterialDisplay(zoneObj.material)}</b></div>`;
        }
        body += `<div class="cov-detail-row"><span>방호값</span><b>${zoneObj.armorValue}</b></div>`;
        body += `<div class="cov-detail-row"><span>충격 전달</span><b>×${zoneObj.bluntMul.toFixed(2)} (block 시)</b></div>`;
      }
    } else {
      // 분할 영역 요약 + 유리/금속 안내
      body += `<div class="cov-detail-row"><span style="color:#8aa0b0">K6-3: 유리부와 금속부가 구분됩니다</span></div>`;
      for (const z of accessory.visorHitTable) {
        const isGlass = (z.id === 'glass' || /glass|visor/i.test(z.id) || /유리/.test(z.label || ''));
        const tag = isGlass ? '<span style="color:#7ad8f0">[유리·crack]</span>' : (z.material === 'titanium' || z.material === 'steel') ? '<span style="color:#d0a0f0">[금속·ricochet]</span>' : '';
        body += `<div class="cov-detail-row"><span>${z.label} (${(z.weight*100).toFixed(0)}%) ${tag}</span><b>${getMaterialDisplay(z.material)} · 방호 ${z.armorValue}</b></div>`;
      }
    }
  } else {
    body += `<div class="cov-detail-row"><span>방호 종류</span><b>${{soft:'소프트',hard:'하드',mixed:'혼합'}[accessory.armorType] || '–'}</b></div>`;
    body += `<div class="cov-detail-row"><span>재질</span><b>${getMaterialDisplay(accessory.material)}</b></div>`;
    body += `<div class="cov-detail-row"><span>방호값</span><b>${accessory.armorValue}</b></div>`;
    if (accessory.bluntMul != null) {
      body += `<div class="cov-detail-row"><span>충격 전달</span><b>×${accessory.bluntMul.toFixed(2)} (block 시)</b></div>`;
    }
  }
  // 2A-2: 보완 주소 표시 (어떤 impactAddress 영역을 보완하는지)
  const accCoverNotes = {
    neck:     '하경부(lowerNeck) / 쇄골선(collarLine) / 목 인접부(neckAdjacent) 일부 보완',
    shoulder: '어깨 관절(shoulderJoint) / 상완 근위부(upperArmProximal) / 겨드랑이 인접(axillaAdjacent) 일부 보완',
    groin:    '서혜부(groinAdjacent) / 골반 인접(pelvisGroinAdjacent) / 대퇴 내측 근위부 일부 보완',
    visor:    '안면(eyes/nose/jaw) 일부 보호 — K6-3은 유리부/금속부 구분',
    slaap:    '헬멧 전면(frontCenter/frontUpper) 실제 방호 · 측면전방(sideFront)은 candidate only',
  };
  const note = accCoverNotes[accessory.accessoryType];
  if (note) {
    body += `<div class="cov-detail-sep"></div>`;
    body += `<div class="cov-detail-row"><span class="cov-detail-key">보완 주소</span><span class="cov-detail-val" style="font-weight:400">${note}</span></div>`;
    if (accessory.accessoryType === 'slaap') {
      body += `<div class="cov-detail-row"><span class="cov-detail-key">측면 SLAAP</span><span class="cov-detail-val" style="color:#ffd479;font-weight:400">실제 방호 미적용 (후보 표시만)</span></div>`;
    }
  }
  // 내구도
  if (accessory.maxDurability) {
    body += `<div class="cov-detail-row"><span>최대 내구도</span><b>${accessory.maxDurability}</b></div>`;
    const sel = GAME.selectedId ? UNITS.find(u => u.id === GAME.selectedId) : null;
    if (sel && sel.team === covCurrentSide && sel.armorDurability) {
      // accessory별 slot key 매핑
      const slotKey = (
        accessory.accessoryType === 'groin'    ? 'groin_soft' :
        accessory.accessoryType === 'neck'     ? 'neck_soft' :
        accessory.accessoryType === 'shoulder' ? 'left_arm_soft' :   // 좌/우 동일
        accessory.accessoryType === 'visor'    ? 'head_face_visor' :
        accessory.accessoryType === 'slaap'    ? 'head_front_slaap' : null
      );
      if (slotKey) {
        const d = sel.armorDurability[slotKey];
        if (d) {
          const pct = Math.round((d.current / d.max) * 100);
          const color = pct >= 75 ? '#80d090' : pct >= 50 ? '#ffd479' : pct >= 25 ? '#ff9a3a' : '#ff6060';
          body += `<div class="cov-detail-row"><span>현재 내구도</span><b style="color:${color}">${d.current}/${d.max} (${pct}%)</b></div>`;
        }
        // shoulder는 좌/우 둘 다
        if (accessory.accessoryType === 'shoulder') {
          const dR = sel.armorDurability.right_arm_soft;
          if (dR) {
            const pctR = Math.round((dR.current / dR.max) * 100);
            const colorR = pctR >= 75 ? '#80d090' : pctR >= 50 ? '#ffd479' : pctR >= 25 ? '#ff9a3a' : '#ff6060';
            body += `<div class="cov-detail-row"><span>우측 내구도</span><b style="color:${colorR}">${dR.current}/${dR.max} (${pctR}%)</b></div>`;
          }
        }
      }
      // 2A-6.2: 바이저 시야/분리내구도/상태 요약
      if (accessory.accessoryType === 'visor' && !accessory.isNone && sel.visorState && sel.visorId === accessory.id) {
        const st = sel.visorState;
        const condColor = (c) => (c==='clean'||c==='intact') ? '#80d090' : (c==='scratched'||c==='dented') ? '#ffd479' : (c==='cracked'||c==='damaged') ? '#ff9a3a' : '#ff6060';
        if (st.hasGlass) {
          const gp = Math.round((st.glassDurability / st.glassMaxDurability) * 100);
          body += `<div class="cov-detail-row"><span>유리부</span><b style="color:${condColor(st.glassCondition)}">${st.glassCondition} / ${gp}%</b></div>`;
        }
        if (st.hasFacePlate) {
          const fp = Math.round((st.facePlateDurability / st.facePlateMaxDurability) * 100);
          body += `<div class="cov-detail-row"><span>티타늄부</span><b style="color:${condColor(st.facePlateCondition)}">${st.facePlateCondition} / ${fp}%</b></div>`;
        }
        const vm = getUnitVisionModifiers(sel);
        const fovPct = Math.round((1 - vm.fovMul) * 100);
        body += `<div class="cov-detail-row"><span>시야</span><b>FOV -${fovPct}% · 목표획득 +${vm.targetAcquireTimeAdd.toFixed(2)}s</b></div>`;
      }
    }
  }
  if (accessory.desc) body += `<div class="cov-detail-desc">${accessory.desc}</div>`;
  el.innerHTML = body;
}

function renderCovPanelEmpty() {
  const el = document.getElementById('covDetail');
  if (el) el.innerHTML = '<div class="cov-detail-empty">패널을 탭하면 상세 정보가 표시됩니다</div>';
}

// =============================================================
// 방호 분석 시스템
// =============================================================
//   covDetail에 [방호 분석] 버튼 → 큰 오버레이 → 탄종/내구도별 관통/손상 시뮬.
//   기존 penetrationProbability / getDurabilityArmorMul / MATERIAL_BREAK_MUL 재사용.

// =============================================================
// 플레이트 선택 오버레이 시스템
// =============================================================
const PLATE_SELECT = {
  open: false,
  slotKind: null,    // 'front' | 'back' | 'side'
  team: 'friend',
  candidates: [],    // [{ plate, compatible, reason }]
  selectedPlateId: null,
};

function getAllPlatesForSlot(armorId, slotKind) {
  // 모든 플레이트를 호환 여부와 함께 반환
  const out = [];
  for (const id in PLATE_PRESETS) {
    const p = PLATE_PRESETS[id];
    // None 항목 처리 — 현재 슬롯과 매치되는 no_*만
    if (p.isNone) {
      if (slotKind === 'front' && p.id !== 'no_front_plate') continue;
      if (slotKind === 'back'  && p.id !== 'no_back_plate')  continue;
      if (slotKind === 'side'  && p.id !== 'no_side_plate')  continue;
      out.push({ plate: p, compatible: true, reason: null });
      continue;
    }
    // 슬롯 종류 매치
    const st = p.slotType;
    if (slotKind === 'front' && st !== 'frontBack' && st !== 'frontSet') continue;
    if (slotKind === 'back'  && st !== 'frontBack' && st !== 'back')     continue;
    if (slotKind === 'side'  && st !== 'side')                            continue;
    // 호환성
    let compatible = true, reason = null;
    const armor = BODY_ARMOR_PRESETS[armorId];
    if (p.compatibleArmorIds && p.compatibleArmorIds.length > 0) {
      if (!p.compatibleArmorIds.includes(armorId)) {
        compatible = false; reason = `${p.compatibleArmorIds[0]} 전용`;
      }
    }
    if (p.incompatibleArmorIds && p.incompatibleArmorIds.includes(armorId)) {
      compatible = false; reason = (armorId === 'armor_6b23_test') ? '6B23 비호환' : (armorId === 'police_vest' ? 'Police Vest 비호환' : '비호환');
    }
    if (armor && armor.allowReplicaPlatesOnly && p.factionType !== 'replica') {
      compatible = false; reason = '레플리카 플레이트만 호환';
    }
    if (armor && armor.plateWeightLimitKg) {
      const limit = armor.plateWeightLimitKg[slotKind];
      if (limit === 0) { compatible = false; reason = '슬롯 없음'; }
      else if (limit != null && (p.weightKg || 0) > limit) {
        compatible = false; reason = `중량 초과 (${p.weightKg.toFixed(2)} > ${limit}kg)`;
      }
    }
    out.push({ plate: p, compatible, reason });
  }
  // 호환 가능 먼저, "없음"(none) 최상단 고정, 그 다음 effectiveArmor(방호력) 내림차순 자동 정렬
  out.sort((a, b) => {
    if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
    if (!!a.plate.isNone !== !!b.plate.isNone) return a.plate.isNone ? -1 : 1;
    const ea = (a.plate.effectiveArmor != null) ? a.plate.effectiveArmor : (a.plate.hardArmor || 0) + (a.plate.backingArmor || 0);
    const eb = (b.plate.effectiveArmor != null) ? b.plate.effectiveArmor : (b.plate.hardArmor || 0) + (b.plate.backingArmor || 0);
    return eb - ea;
  });
  return out;
}

function openPlateSelect(slotKind) {
  const team = covCurrentSide;
  const ld = getScopedLoadout(team) || {};   // SIDE-PER-OPERATOR-LOADOUT-1
  const armorId = ld.bodyArmorId;
  const armor = BODY_ARMOR_PRESETS[armorId];
  // Police Vest 등 noPlateSlots
  if (armor && armor.noPlateSlots) {
    return;   // 열지 않음
  }
  // 6B23 side 슬롯 없음
  if (slotKind === 'side' && !armorSupportsSidePlate(armorId)) {
    return;
  }
  PLATE_SELECT.open = true;
  PLATE_SELECT.slotKind = slotKind;
  PLATE_SELECT.team = team;
  PLATE_SELECT.candidates = getAllPlatesForSlot(armorId, slotKind);
  // 현재 장착된 plate를 default 선택
  const curIdField = (slotKind === 'front') ? 'frontPlateId' : (slotKind === 'back') ? 'backPlateId' : 'sidePlateId';
  PLATE_SELECT.selectedPlateId = ld[curIdField] || PLATE_SELECT.candidates[0].plate.id;
  document.getElementById('plateSelectOverlay').style.display = 'flex';
  renderPlateSelect();
}

function closePlateSelect() {
  PLATE_SELECT.open = false;
  document.getElementById('plateSelectOverlay').style.display = 'none';
}

function renderPlateSelect() {
  if (!PLATE_SELECT.open) return;
  const slotLabel = { front: '전면', back: '후면', side: '사이드' }[PLATE_SELECT.slotKind] || '';
  document.getElementById('psTitle').textContent = `${slotLabel} 플레이트 선택`;
  // 리스트
  const listEl = document.getElementById('psList');
  let html = '';
  for (const c of PLATE_SELECT.candidates) {
    const p = c.plate;
    const on = (PLATE_SELECT.selectedPlateId === p.id) ? ' on' : '';
    const disabled = !c.compatible ? ' disabled' : '';
    const meta = p.isNone ? '비어 있음'
               : `${getMaterialDisplay(p.material)} · 유효 ${getPlateTotalEffectiveArmor(p)}(C${armorValueToClass(getPlateTotalEffectiveArmor(p))}) · ${(p.weightKg||0).toFixed(2)}kg`;
    const reason = c.reason ? `<div class="ps-item-reason">${c.reason}</div>` : '';
    html += `<div class="ps-item${on}${disabled}" data-plate-id="${p.id}">
      <div class="ps-item-name">${p.shortName || p.name}</div>
      <div class="ps-item-meta">${meta}</div>
      ${reason}
    </div>`;
  }
  listEl.innerHTML = html;
  // 디테일
  renderPlateSelectDetail();
}

function renderPlateSelectDetail() {
  const detailEl = document.getElementById('psDetailContent');
  const sel = PLATE_SELECT.candidates.find(c => c.plate.id === PLATE_SELECT.selectedPlateId);
  if (!sel) { detailEl.innerHTML = '<div class="cov-detail-empty">선택된 플레이트가 없습니다</div>'; return; }
  const p = sel.plate;
  const cls = (typeof armorValueToClass === 'function' && p.hardArmor > 0) ? 'Class ' + armorValueToClass(p.hardArmor) : '';
  let body = `<div class="ps-detail-title">${p.name}</div>`;
  if (p.isNone) {
    body += `<div class="ps-detail-row"><span>플레이트 없음</span><b>—</b></div>`;
    body += `<div class="ps-detail-desc">이 슬롯에 플레이트를 장착하지 않습니다.</div>`;
  } else {
    body += `<div class="ps-detail-row"><span>구분</span><b>${p.shortName || '—'}</b></div>`;
    body += `<div class="ps-detail-row"><span>계열</span><b>${p.factionType || '—'} / ${p.slotType || '—'}</b></div>`;
    body += `<div class="ps-detail-row"><span>재질</span><b>${getMaterialDisplay(p.material)} · backer ${getMaterialDisplay(p.backingMaterial || 'aramid')}</b></div>`;
    body += `<div class="ps-detail-row"><span>방호값</span><b>hard ${p.hardArmor || 0} ${cls ? '('+cls+')' : ''} · backer ${p.backingArmor || 0}</b></div>`;
    // 2A-6.6: 유효방호 = hard + backing (표시/등급용). 실제 1차 관통은 hardArmor 기준.
    if (typeof getPlateTotalEffectiveArmor === 'function' && (p.hardArmor > 0 || p.backingArmor > 0)) {
      const tot = getPlateTotalEffectiveArmor(p);
      const totCls = armorValueToClass(tot);
      const basis = (p.ratingMode === 'icw') ? '외부 백커 조건 기준 · 1차판정은 hard' : (p.ratingMode === 'standalone') ? '자체 백커 포함 기준 · 1차판정은 hard' : '1차판정은 hard';
      body += `<div class="ps-detail-row"><span>유효 방호수치</span><b style="color:#8fd6ff">${tot} (= hard ${p.hardArmor||0} + backer ${p.backingArmor||0}) · 시스템 Class ${totCls}</b></div>`;
      body += `<div class="ps-detail-row"><span></span><b style="color:#8a949c;font-size:0.85em">${basis}</b></div>`;
    }
    body += `<div class="ps-detail-row"><span>무게</span><b>${(p.weightKg||0).toFixed(2)} kg</b></div>`;
    body += `<div class="ps-detail-row"><span>최대 내구도</span><b>${p.maxDurability || '—'}</b></div>`;
    // === 2A-6.4: 플레이트 시스템 메타데이터 ===
    if (p.ratingMode) {
      const rmLabel = { icw:'ICW (외부 백커 필요)', standalone:'Stand-Alone (자체 백커)', soft_insert:'Soft Insert (소프트 보강)', training:'Training (방호 없음)', none:'None' }[p.ratingMode] || p.ratingMode;
      body += `<div class="ps-detail-row"><span>구분 등급</span><b>${rmLabel}</b></div>`;
      if (p.thicknessMm != null) {
        const thRange = (p.thicknessMinMm != null && p.thicknessMaxMm != null && p.thicknessMinMm !== p.thicknessMaxMm) ? ` (${p.thicknessMinMm}~${p.thicknessMaxMm})` : '';
        body += `<div class="ps-detail-row"><span>두께 / 벌크</span><b>${p.thicknessMm}mm${thRange} · ${p.bulkClass || '—'}</b></div>`;
      }
      if (p.materialStack) {
        const ms = p.materialStack;
        const msStr = [ms.strikeFace, ms.core, ms.backer].filter(x=>x&&x!=='none').map(x=>String(x).replace(/_/g,' ')).join(' + ');
        if (msStr) body += `<div class="ps-detail-row"><span>재질 스택</span><b style="font-size:0.85em">${msStr}</b></div>`;
      }
      if (p.ratingMode === 'icw') body += `<div class="ps-detail-row"><span>백커</span><b>외부 소프트백커 필요 (min ${p.minBackerArmor||'?'})</b></div>`;
      else if (p.ratingMode === 'standalone') body += `<div class="ps-detail-row"><span>백커</span><b>자체 백커 내장 (단독 착용 가능)</b></div>`;
      else if (p.ratingMode === 'soft_insert') body += `<div class="ps-detail-row"><span>특성</span><b>하드 플레이트 아님 · 소프트 방호 보강</b></div>`;
      // 두께 벌크 경고
      // SIDE-ARMOR-ADD-COLOSSUS: 두꺼운 플레이트 벌크 경고 (Colossus 등 신규 + 기존 thick 플레이트 모두)
      if (p.bulkClass === 'bulky' || (p.thicknessMm != null && p.thicknessMm >= 29)) body += `<div class="ps-detail-row"><span>⚠ 벌크</span><b style="color:#ff9f6b">매우 두꺼움 — 착용성·기동성 크게 저하</b></div>`;
      else if (p.bulkClass === 'thick' || (p.thicknessMm != null && p.thicknessMm >= 25)) body += `<div class="ps-detail-row"><span>⚠ 벌크</span><b style="color:#ffd479">두꺼움 — 착용성 저하 가능</b></div>`;
    }
    // 호환 여부
    body += `<div class="ps-detail-row"><span>호환</span><b style="color:${sel.compatible ? '#80d090' : '#ff6060'}">${sel.compatible ? '가능' : (sel.reason || '비호환')}</b></div>`;
    // 무게 변화
    const team = PLATE_SELECT.team;
    const ld = getScopedLoadout(team) || {};   // SIDE-PER-OPERATOR-LOADOUT-1
    const idField = (PLATE_SELECT.slotKind === 'front') ? 'frontPlateId' : (PLATE_SELECT.slotKind === 'back') ? 'backPlateId' : 'sidePlateId';
    const curPlate = PLATE_PRESETS[ld[idField]];
    const curW = (curPlate && !curPlate.isNone) ? (curPlate.weightKg || 0) : 0;
    const newW = !p.isNone ? (p.weightKg || 0) : 0;
    const delta = newW - curW;
    const deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(2);
    const deltaColor = delta > 0 ? '#ff9a3a' : (delta < 0 ? '#80d090' : '#8a9099');
    body += `<div class="ps-detail-row"><span>무게 변화</span><b style="color:${deltaColor}">${deltaStr} kg</b></div>`;
    if (p.desc) body += `<div class="ps-detail-desc">${p.desc}</div>`;
  }
  detailEl.innerHTML = body;
  // 넣기 버튼 활성화
  document.getElementById('psEquipBtn').disabled = !sel.compatible;
}

function equipSelectedPlate() {
  const sel = PLATE_SELECT.candidates.find(c => c.plate.id === PLATE_SELECT.selectedPlateId);
  if (!sel || !sel.compatible) return;
  const team = PLATE_SELECT.team;
  const idField = (PLATE_SELECT.slotKind === 'front') ? 'frontPlateId'
                : (PLATE_SELECT.slotKind === 'back')  ? 'backPlateId'
                                                      : 'sidePlateId';
  getWritableScopedLoadout(team)[idField] = sel.plate.id;   // SIDE-PER-OPERATOR-LOADOUT-1
  // scope 인지 동기화 (팀 기본 → override 없는 유닛만 / 대원 → 같은 loadoutKey만)
  if (UNITS) {
    const scopeKey = getCurrentLoadoutUnitKey(team);
    const mapId = _opCurMapId();
    for (const u of UNITS) {
      if (u.team !== team) continue;
      if (scopeKey === 'default') { if (_operatorOverrideExists(mapId, team, u.loadoutKey)) continue; }
      else { if (u.loadoutKey !== scopeKey) continue; }
      const _rl = resolveOperatorLoadout(mapId, team, u.loadoutKey);
      u[idField] = _rl[idField];
      u._protCacheKey = null;
      u.loadoutSnapshot = cloneLoadoutForOperator(_rl);
      if (typeof rebuildArmorDurability === 'function') rebuildArmorDurability(u);
      if (typeof updateUnitWeight === 'function') updateUnitWeight(u);
    }
  }
  closePlateSelect();
  if (typeof renderCoverageTab === 'function') renderCoverageTab();
}

const ARMOR_ANALYSIS = {
  open: false,
  // 현재 분석 대상
  slotInfo: null,   // { sourceId, label, material, durabilityMaterial, baseArmor, slotKey, maxDur, curDur, isHelmet, visorHitTable }
  ammoId: '556_m855',
  durRatio: 1.0,    // 0~1 (초기 내구도 설정용)
  useCurrent: false,
  zoneId: null,     // K6-3: 'glass' / 'titanium' / null(평균)
  // SIDE-ARMOR-INTERACTIVE-ANALYSIS-1: 대화형 실험장 상태
  distanceM: 50,
  aspect: 'front',
  tab: 'config',          // 좌측 탭: 'config' | 'result'
  viewMode: 'coverage',   // 'coverage' | 'durability' | 'local' | 'log'
  aimMode: false,
  selectedPoint: null,    // { x,y,normX,normY,slotKey,localZone,material,panelKind,aspect }
  testDurability: null,   // { [slotKey]: { slotKey,material,max,current,localZones{},spallRisk,coatingDamage,visibilityDamage,backfaceDamage } } — 분석 전용 복사본
  hitMarkers: [],
  hitLog: [],
  shotSeq: 0,
  lastResult: null,
  selMarkerId: null,
  _baselineDur: null,     // open 시점 baseline (리셋용)
  // 모든 탄종 목록 캐시
  _ammoIds: null,
};

function getAllAmmoIdsSorted() {
  if (ARMOR_ANALYSIS._ammoIds) return ARMOR_ANALYSIS._ammoIds;
  const ids = Object.keys(AMMO_PRESETS);
  // 구경별 그룹 + 이름 순
  const order = { '9mm': 0, '556': 1, '545': 2, '762x39': 3, '762_308': 4, '762_m80': 4, '762_m61': 4, '762_m993': 4 };
  ids.sort((a, b) => {
    function group(id) {
      for (const k in order) if (id.startsWith(k)) return order[k];
      return 9;
    }
    const ga = group(a), gb = group(b);
    if (ga !== gb) return ga - gb;
    return a.localeCompare(b);
  });
  ARMOR_ANALYSIS._ammoIds = ids;
  return ids;
}

// 분석 가능한 슬롯 정보를 covDetail에서 추출
//   shape: panel info (label 등)
//   kind: 'armor-hard' / 'armor-soft' / 'helmet-shell' / 'accessory'
//   armor/helmet: 현재 선택된 장비
//   accessory: 추가 보호구 (있을 때)
//   accZone: K6-3 zone
function buildAnalysisSlotInfo(shape, kind, armor, helmet, accessory, accZone) {
  const sel = GAME.selectedId ? UNITS.find(u => u.id === GAME.selectedId) : null;
  const useUnit = sel && sel.team === covCurrentSide && sel.armorDurability ? sel : null;
  const ld = getScopedLoadout(covCurrentSide) || {};
  let info = null;
  // hard plate
  if (kind === 'armor-hard') {
    let plateId = null, durKey = null;
    if (covCurrentAspect === 'front') {
      plateId = ld.frontPlateId;
      durKey = (shape && shape.slot === 'abdomen_front') ? 'abdomen_front_hard' : 'chest_front_hard';
    } else if (covCurrentAspect === 'rear') {
      plateId = ld.backPlateId;  durKey = 'chest_rear_hard';
    } else if (covCurrentAspect === 'side') {
      plateId = ld.sidePlateId;  durKey = 'left_side_hard';
    }
    const plate = plateId ? PLATE_PRESETS[plateId] : null;
    if (plate && !plate.isNone) {
      info = {
        sourceId: plateId,
        label: plate.name,
        material: plate.material,
        durabilityMaterial: plate.material,
        baseArmor: plate.hardArmor,
        slotKey: durKey,
        maxDur: plate.maxDurability || 50,
        curDur: useUnit && useUnit.armorDurability[durKey] ? useUnit.armorDurability[durKey].current : (plate.maxDurability || 50),
        isHelmet: false,
        protectionType: 'hard',
        // SIDE-ARMOR-INTERACTIVE-ANALYSIS: 실제 플레이트 형상 + 소프트 백커 표시용
        bodyArmorId: (getScopedLoadout(covCurrentSide) || {}).bodyArmorId,
        aspect: covCurrentAspect,
        softBacker: (armor && (armor.softArmorValue || 0) > 0) ? {
          slotKey: durKey.replace('_hard', '_soft'),
          material: armor.softArmorMaterial || 'aramid',
          baseArmor: armor.softArmorValue,
          maxDur: armor.softMaxDurability || 40,
        } : null,
      };
    }
  }
  // helmet shell
  else if (kind === 'helmet-shell' && helmet) {
    const skullVal = helmet.head_skull && helmet.head_skull.hard ? helmet.head_skull.hard.smallArmor : 0;
    const mat = (helmet.head_skull && helmet.head_skull.hard && helmet.head_skull.hard.material) || 'aramid';
    info = {
      sourceId: helmet.id,
      label: helmet.name + ' (두개부)',
      material: mat,
      durabilityMaterial: mat,
      baseArmor: skullVal,
      slotKey: 'head_skull_shell',
      maxDur: helmet.maxDurability || 45,
      curDur: useUnit && useUnit.armorDurability.head_skull_shell ? useUnit.armorDurability.head_skull_shell.current : (helmet.maxDurability || 45),
      isHelmet: true,
      protectionType: 'hard',
    };
    // SIDE-HELMET-ACCESSORY-ANALYSIS: 장착된 바이저/SLAAP를 세트로 함께 분석 (코룬드 가슴+복부처럼). 미장착이면 제외.
    const _accs = [];
    const _visorId = ld.visorId, _slaapId = ld.slaapId;
    const _vp = (_visorId && _visorId.indexOf('no_') !== 0 && typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') ? PROTECTION_ACCESSORY_PRESETS[_visorId] : null;
    const _sp = (_slaapId && _slaapId.indexOf('no_') !== 0 && typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') ? PROTECTION_ACCESSORY_PRESETS[_slaapId] : null;
    if (_vp) {
      const _z = _vp.visorHitTable ? (_vp.visorHitTable.find(zz => zz.id === 'titanium') || _vp.visorHitTable[0]) : null;
      _accs.push({ accessoryType: 'visor', sourceId: _vp.id, label: _vp.shortName || _vp.name, slotKey: 'head_face_visor',
        isVisor: !!_vp.visorHitTable, visorHitTable: _vp.visorHitTable || null, isK63: (_visorId === 'k6_3_visor'),
        material: (_z ? _z.material : _vp.material) || 'pe', durabilityMaterial: (_z ? (_z.durabilityMaterial || _z.material) : _vp.durabilityMaterial) || 'glass',
        baseArmor: (_z ? _z.armorValue : _vp.armorValue) || 0, bluntMul: _z ? _z.bluntMul : _vp.bluntMul,
        maxDur: _vp.maxDurability || 28,
        curDur: (useUnit && useUnit.armorDurability.head_face_visor) ? useUnit.armorDurability.head_face_visor.current : (_vp.maxDurability || 28) });
    }
    if (_sp) {
      _accs.push({ accessoryType: 'slaap', sourceId: _sp.id, label: _sp.shortName || _sp.name, slotKey: 'head_front_slaap',
        isVisor: false, visorHitTable: null, isK63: false,
        material: _sp.material || 'aramid', durabilityMaterial: _sp.durabilityMaterial || _sp.material || 'aramid',
        baseArmor: _sp.armorValue || 0, bluntMul: _sp.bluntMul, maxDur: _sp.maxDurability || 25,
        curDur: (useUnit && useUnit.armorDurability.head_front_slaap) ? useUnit.armorDurability.head_front_slaap.current : (_sp.maxDurability || 25) });
    }
    if (_accs.length) info.helmetAccessories = _accs;
  }
  // accessory (groin/shoulder/neck/visor/SLAAP)
  else if (accessory) {
    const a = accessory;
    if (a.visorHitTable) {
      // 영역 sample
      const zone = accZone ? a.visorHitTable.find(z => z.id === accZone) : null;
      const z = zone || a.visorHitTable.find(zz => zz.id === 'titanium') || a.visorHitTable[0];
      info = {
        sourceId: a.id,
        label: a.name + (zone ? ` (${zone.label})` : ''),
        material: z.material,
        durabilityMaterial: z.durabilityMaterial || z.material,
        baseArmor: z.armorValue,
        slotKey: a.accessoryType === 'visor' ? 'head_face_visor'
               : a.accessoryType === 'slaap' ? 'head_front_slaap' : null,
        maxDur: a.maxDurability || 28,
        curDur: useUnit && a.accessoryType === 'visor' && useUnit.armorDurability.head_face_visor ? useUnit.armorDurability.head_face_visor.current : (a.maxDurability || 28),
        isHelmet: false,
        protectionType: 'hard',
        visorHitTable: a.visorHitTable,
        bluntMul: z.bluntMul,
      };
    } else {
      const slotKey = a.accessoryType === 'groin' ? 'groin_soft'
                    : a.accessoryType === 'shoulder' ? 'left_arm_soft'   // 좌측 표시
                    : a.accessoryType === 'neck' ? 'neck_soft'
                    : a.accessoryType === 'visor' ? 'head_face_visor'
                    : a.accessoryType === 'slaap' ? 'head_front_slaap' : null;
      info = {
        sourceId: a.id,
        label: a.name,
        material: a.material || 'aramid',
        durabilityMaterial: a.durabilityMaterial || a.material || 'aramid',
        baseArmor: a.armorValue,
        slotKey,
        maxDur: a.maxDurability || 25,
        curDur: useUnit && slotKey && useUnit.armorDurability[slotKey] ? useUnit.armorDurability[slotKey].current : (a.maxDurability || 25),
        isHelmet: false,
        protectionType: a.armorType === 'hard' ? 'hard' : 'soft',
        bluntMul: a.bluntMul,
      };
    }
  }
  return info;
}

function openArmorAnalysis(slotInfo) {
  if (!slotInfo) return;
  ARMOR_ANALYSIS.open = true;
  ARMOR_ANALYSIS.slotInfo = slotInfo;
  ARMOR_ANALYSIS.durRatio = (slotInfo.curDur && slotInfo.maxDur) ? (slotInfo.curDur / slotInfo.maxDur) : 1.0;
  ARMOR_ANALYSIS.useCurrent = true;
  // 기본 탄종 — 현재 친군 무기 탄약
  const ld = getScopedLoadout('friend') || {};   // SIDE-PER-OPERATOR-LOADOUT-1
  if (ld.ammoId && AMMO_PRESETS[ld.ammoId]) ARMOR_ANALYSIS.ammoId = ld.ammoId;
  ARMOR_ANALYSIS.zoneId = (slotInfo.visorHitTable && slotInfo.visorHitTable[0]) ? slotInfo.visorHitTable[0].id : null;   // ARMOR-HOTFIX-1 §7: visor는 zone별 계산 (mixed 평균 금지)
  // SIDE-ARMOR-INTERACTIVE-ANALYSIS-1: 실험장 상태 초기화 (실제 유닛 무영향 — 깊은 복사본만)
  ARMOR_ANALYSIS.distanceM = 50;
  ARMOR_ANALYSIS.aspect = (typeof covCurrentAspect !== 'undefined' && covCurrentAspect) ? covCurrentAspect : 'front';
  ARMOR_ANALYSIS.tab = 'config';
  ARMOR_ANALYSIS.viewMode = 'coverage';
  ARMOR_ANALYSIS.aimMode = false;
  ARMOR_ANALYSIS.selectedPoint = null;
  ARMOR_ANALYSIS.hitMarkers = [];
  ARMOR_ANALYSIS.hitLog = [];
  ARMOR_ANALYSIS.shotSeq = 0;
  ARMOR_ANALYSIS.lastResult = null;
  ARMOR_ANALYSIS.selMarkerId = null;
  ARMOR_ANALYSIS.testDurability = initArmorAnalysisDurability(slotInfo);
  document.getElementById('armorAnalysisOverlay').style.display = 'flex';
  renderArmorAnalysis();
}

function closeArmorAnalysis() {
  ARMOR_ANALYSIS.open = false;
  document.getElementById('armorAnalysisOverlay').style.display = 'none';
}

// 분석 계산 — 선택된 ratio로 effectiveArmor / penProb / dur damage
function computeAnalysis(slot, ammoId, ratio) {
  const ammo = AMMO_PRESETS[ammoId];
  if (!slot || !ammo) return null;
  const material = slot.material;
  const durMat = normalizeDurabilityMaterial(slot.durabilityMaterial || material, null, 'composite');   // ARMOR-HOTFIX-1 §5: 'mixed ×' 표시 금지
  // 재질 페널티 — materialPenPenalty
  const matPenalty = (ammo.materialPenPenalty && ammo.materialPenPenalty[material]) || 0;
  let effectivePen = (ammo.penetration || 0) - matPenalty;
  let baseArmor = slot.baseArmor;
  let effectiveArmor = baseArmor * getDurabilityArmorMul(durMat, ratio);
  if (slot.isHelmet && typeof getHelmetArmorPenalty === 'function') {
    const hp = getHelmetArmorPenalty(ammo);
    effectiveArmor = Math.max(0, effectiveArmor - hp);
  }
  const diff = effectivePen - effectiveArmor;
  const penProb = penetrationProbability(diff);
  // SIDE-ARMOR-DURABILITY-REALISM-1 §11: 실제 전투와 같은 computeArmorDurabilityDamage 사용 (float)
  const est = getArmorAnalysisDamageEstimate({
    baseArmor, material, durabilityMaterial: durMat,
    layerType: slot.isHelmet ? 'helmet' : (slot.protectionType === 'soft' ? 'analysis_soft' : 'analysis_hard'),
    protectionType: slot.protectionType,
  }, ammo, ratio);
  const blockDmg = est.blockInfo.amount;
  const penDmg = est.penInfo.amount;
  return {
    effectivePen, matPenalty, effectiveArmor, baseArmor,
    diff, penProb,
    blockDmg, penDmg, armorDmgPct: (ammo.armorDamagePct != null ? ammo.armorDamagePct : 25),
    durMat, material,
    threatClass: est.blockInfo.threatClass,
    materialResponse: est.blockInfo.materialResponse,
    nearOvermatch: est.blockInfo.nearOvermatch,
    residual0: getDurabilityArmorMul(durMat, 0),
    damageKind: est.blockInfo.damageKind,
  };
}

function rankPenetrationDamage(ammo) {
  const dmg = ammo.damage || 0;
  if (dmg < 30) return { txt:'낮음', cls:'aa-rank-low' };
  if (dmg < 50) return { txt:'보통', cls:'aa-rank-medium' };
  if (dmg < 80) return { txt:'높음', cls:'aa-rank-high' };
  return { txt:'치명적', cls:'aa-rank-critical' };
}

function rankBlockBlunt(slot, ammo) {
  // visor면 매우 낮음 (bluntMul 적용)
  if (slot.slotKey === 'head_face_visor') return { txt:'얼굴 둔상 거의 없음 · 짧은 어지러움', cls:'aa-rank-low' };
  const bRatio = getMaterialBluntRatio(slot.material) || 0.5;
  const dmg = ammo.damage || 0;
  const score = bRatio * (dmg / 50);
  if (score < 0.4) return { txt:'낮음', cls:'aa-rank-low' };
  if (score < 0.8) return { txt:'보통', cls:'aa-rank-medium' };
  if (score < 1.4) return { txt:'높음', cls:'aa-rank-high' };
  return { txt:'심각', cls:'aa-rank-critical' };
}

function renderArmorAnalysis() {
  if (!ARMOR_ANALYSIS.open) return;
  const slot = ARMOR_ANALYSIS.slotInfo;
  if (!slot) return;
  const ammo = AMMO_PRESETS[ARMOR_ANALYSIS.ammoId];
  if (!ammo) return;
  // 타이틀
  document.getElementById('aaTitle').textContent = `방호 분석 — ${slot.label}`;
  // K6-3 zone selector
  const zSec = document.getElementById('aaZoneSection');
  const zRow = document.getElementById('aaZoneRow');
  if (slot.visorHitTable) {
    zSec.style.display = '';
    let html = '';
    const zones = slot.visorHitTable;
    for (const z of zones) {
      const on = (ARMOR_ANALYSIS.zoneId === z.id) ? ' on' : '';
      html += `<button class="aa-zone-btn${on}" data-zone="${z.id}">${z.label} (${Math.round(z.weight*100)}%)</button>`;
    }
    zRow.innerHTML = html;
  } else {
    zSec.style.display = 'none';
  }
  // K6-3은 zone 선택 시 slot 재계산
  let effSlot = slot;
  if (slot.visorHitTable && ARMOR_ANALYSIS.zoneId) {
    const z = slot.visorHitTable.find(zz => zz.id === ARMOR_ANALYSIS.zoneId);
    if (z) {
      effSlot = {
        ...slot,
        label: slot.label.split(' (')[0] + ` (${z.label})`,
        material: z.material,
        durabilityMaterial: z.durabilityMaterial || z.material,
        baseArmor: z.armorValue,
        bluntMul: z.bluntMul,
      };
    }
  }

  // 방호구 정보
  const armorInfo = document.getElementById('aaArmorInfo');
  armorInfo.innerHTML = `
    <div class="aa-info-row"><span>슬롯</span><b>${effSlot.slotKey || '—'}</b></div>
    <div class="aa-info-row"><span>재질</span><b>${getMaterialDisplay(effSlot.material)}</b></div>
    ${effSlot.durabilityMaterial !== effSlot.material ? `<div class="aa-info-row"><span>내구도 재질</span><b>${getMaterialDisplay(effSlot.durabilityMaterial)}</b></div>` : ''}
    <div class="aa-info-row"><span>기본 방호</span><b>${effSlot.baseArmor}</b></div>
    <div class="aa-info-row"><span>최대 내구도</span><b>${effSlot.maxDur}</b></div>
    <div class="aa-info-row"><span>현재 내구도</span><b>${effSlot.curDur}/${effSlot.maxDur} (${Math.round(effSlot.curDur/effSlot.maxDur*100)}%)</b></div>
  `;

  // 탄종 UI
  const ids = getAllAmmoIdsSorted();
  const i = ids.indexOf(ARMOR_ANALYSIS.ammoId);
  document.getElementById('aaAmmoName').textContent = ammo.name || ARMOR_ANALYSIS.ammoId;
  const ammoInfo = document.getElementById('aaAmmoInfo');
  const matPen = (ammo.materialPenPenalty && ammo.materialPenPenalty[effSlot.material]) || 0;
  const effPen = (ammo.penetration || 0) - matPen;
  ammoInfo.innerHTML = `
    <div class="aa-info-row"><span>구경</span><b>${ammo.caliber || ammo.type || '—'}</b></div>
    <div class="aa-info-row"><span>기본 관통</span><b>${ammo.penetration || 0}</b></div>
    <div class="aa-info-row"><span>재질 페널티</span><b>-${matPen}</b></div>
    <div class="aa-info-row"><span>유효 관통</span><b style="color:#ffd479">${effPen}</b></div>
    <div class="aa-info-row"><span>방어구 피해율</span><b>${ammo.armorDamagePct || 25}%</b></div>
    <div class="aa-info-row"><span>인체 피해</span><b>${ammo.damage || 0}</b></div>
  `;

  // 내구도 슬라이더
  const dRatio = ARMOR_ANALYSIS.durRatio;
  document.getElementById('aaDurSlider').value = Math.round(dRatio * 100);
  document.getElementById('aaDurVal').textContent = Math.round(dRatio * 100) + '%';

  // 계산 결과
  const res = computeAnalysis(effSlot, ARMOR_ANALYSIS.ammoId, dRatio);
  const resultInfo = document.getElementById('aaResultInfo');
  const penRank = rankPenetrationDamage(ammo);
  const blockRank = rankBlockBlunt(effSlot, ammo);
  // 판정 라벨
  let verdict, verdictCls;
  if (res.penProb >= 0.8)      { verdict = '관통 우세'; verdictCls = 'aa-rank-critical'; }
  else if (res.penProb >= 0.5) { verdict = '경합 (관통 유리)'; verdictCls = 'aa-rank-high'; }
  else if (res.penProb >= 0.2) { verdict = '경합 (방호 유리)'; verdictCls = 'aa-rank-medium'; }
  else                          { verdict = '방호 우세'; verdictCls = 'aa-rank-low'; }
  const expectedDmg = res.blockDmg * (1 - res.penProb) + res.penDmg * res.penProb;
  // §20: local zone 경고 문구 (재질별)
  const localWarn = (({ ceramic:'동일 지점 반복 시 균열 급락', glass:'첫 균열 후 급락 / 시야 저하', aramid:'권총탄 반복에 섬유 변형 누적', steel:'방호 감소보다 스폴/변형 위험', titanium:'변형 누적 / 잔존 방호 유지', pe:'고속탄 반복에 후반 급락', aluminum:'변형/균열 누적 빠름' })[res.durMat] || '') + ' · 국부 기록 전용(차기 반영)';
  resultInfo.innerHTML = `
    <div class="aa-info-row"><span>유효 방호</span><b style="color:#80c0ff">${res.effectiveArmor.toFixed(1)}</b></div>
    <div class="aa-info-row"><span>관통력 차이</span><b>${res.diff >= 0 ? '+' : ''}${res.diff.toFixed(1)}</b></div>
    <div class="aa-info-row"><span>관통 확률</span><b style="color:${res.penProb >= 0.5 ? '#ff9a3a' : '#80d090'}">${Math.round(res.penProb*100)}%</b></div>
    <div class="aa-info-row"><span>판정</span><b class="${verdictCls}">${verdict}</b></div>
    <div class="aa-info-row" style="margin-top:4px;"><span>위협 분류</span><b>${res.threatClass}</b></div>
    <div class="aa-info-row"><span>재질 반응</span><b>${getMaterialDisplay(res.durMat)} ×${res.materialResponse.toFixed(2)}${res.nearOvermatch ? ' <span style="color:#ff9a3a">near-overmatch</span>' : ''}</b></div>
    <div class="aa-info-row"><span>0% 잔존 방호</span><b>${Math.round(res.residual0*100)}%</b></div>
    <div class="aa-info-row" style="margin-top:4px;"><span>차단 시 손상</span><b>${res.blockDmg.toFixed(1)}/${effSlot.maxDur}</b></div>
    <div class="aa-info-row"><span>관통 시 손상</span><b>${res.penDmg.toFixed(1)}/${effSlot.maxDur}</b></div>
    <div class="aa-info-row"><span>평균 예상 손상</span><b style="color:#ffd479">${expectedDmg.toFixed(1)}/${effSlot.maxDur}</b></div>
    ${localWarn ? `<div class="aa-info-row"><span>국부 손상</span><b style="font-size:9px;color:#d4a04a">${localWarn}</b></div>` : ''}
    <div class="aa-info-row" style="margin-top:4px;"><span>관통 시 피해</span><b class="${penRank.cls}">${penRank.txt}</b></div>
    <div class="aa-info-row"><span>차단 시 둔상</span><b class="${blockRank.cls}">${blockRank.txt}</b></div>
  `;
  // SIDE-ARMOR-INTERACTIVE-ANALYSIS-1: 최근 사격 결과를 상단에 prepend
  resultInfo.innerHTML = aaLastResultHtml() + resultInfo.innerHTML;

  // 그래프
  renderAnalysisGraph(effSlot, ARMOR_ANALYSIS.ammoId, dRatio);
  // 실험장 동적 갱신 (거리/kinetic/버튼/스테이지/로그)
  renderArmorAnalysisDynamic();
}

function renderAnalysisGraph(slot, ammoId, currentRatio) {
  const svg = document.getElementById('aaGraph');
  if (!svg) return;
  const W = 400, H = 280;
  const padL = 40, padR = 14, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const ammo = AMMO_PRESETS[ammoId];
  const matPen = (ammo.materialPenPenalty && ammo.materialPenPenalty[slot.material]) || 0;
  let effPen = (ammo.penetration || 0) - matPen;
  if (slot.isHelmet && typeof getHelmetArmorPenalty === 'function') {
    // helmet penalty는 armor 쪽에 적용. 여기선 그대로.
  }
  // Y축 최대값 — baseArmor와 effPen 중 큰 값 기준
  const maxY = Math.max(slot.baseArmor * 1.1, effPen * 1.2, 20);
  // 곡선 — ratio 1.0 → 0.0 (좌→우)
  function px(r) { return padL + (1 - r) * plotW; }   // r=1 왼쪽, r=0 오른쪽
  function py(v) { return padT + plotH * (1 - v / maxY); }
  let curvePath = '';
  for (let i = 0; i <= 50; i++) {
    const r = 1 - i / 50;
    const eff = slot.baseArmor * getDurabilityArmorMul(slot.durabilityMaterial || slot.material, r);
    const x = px(r), y = py(eff);
    curvePath += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  }
  // 탄 유효 관통력 — 수평선
  const penY = py(effPen);
  // 현재 내구도 — 세로선
  const curX = px(currentRatio);
  const curEffArmor = slot.baseArmor * getDurabilityArmorMul(slot.durabilityMaterial || slot.material, currentRatio);
  const curY = py(curEffArmor);

  // 관통 우세 영역 (방호 곡선 아래쪽, 탄 라인 위쪽)
  // 단순화: 곡선 아래 영역 음영 처리
  let fillPath = curvePath + ' L' + px(0).toFixed(1) + ',' + py(0).toFixed(1) + ' L' + px(1).toFixed(1) + ',' + py(0).toFixed(1) + ' Z';

  // 축 라벨
  let labels = '';
  // X axis ticks (100%, 75%, 50%, 25%, 0%)
  for (const r of [1.0, 0.75, 0.5, 0.25, 0.0]) {
    const x = px(r);
    labels += `<line x1="${x}" y1="${padT + plotH}" x2="${x}" y2="${padT + plotH + 3}" stroke="#3a4a55" stroke-width="0.8"/>`;
    labels += `<text x="${x}" y="${padT + plotH + 14}" fill="#8a9099" font-size="9" text-anchor="middle">${Math.round(r*100)}%</text>`;
  }
  // Y axis ticks (0, 25%, 50%, 75%, 100% of maxY)
  for (let i = 0; i <= 4; i++) {
    const v = maxY * i / 4;
    const y = py(v);
    labels += `<line x1="${padL - 3}" y1="${y}" x2="${padL}" y2="${y}" stroke="#3a4a55" stroke-width="0.8"/>`;
    labels += `<text x="${padL - 5}" y="${y + 3}" fill="#8a9099" font-size="9" text-anchor="end">${Math.round(v)}</text>`;
  }
  // 축
  labels += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#3a4a55" stroke-width="0.8"/>`;
  labels += `<line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#3a4a55" stroke-width="0.8"/>`;
  // X 라벨
  labels += `<text x="${padL + plotW/2}" y="${H - 4}" fill="#8a9099" font-size="9" text-anchor="middle">내구도</text>`;
  // Y 라벨 (회전)
  labels += `<text x="10" y="${padT + plotH/2}" fill="#8a9099" font-size="9" text-anchor="middle" transform="rotate(-90 10 ${padT + plotH/2})">유효 방호</text>`;

  let html = '';
  // 곡선 음영
  html += `<path d="${fillPath}" fill="rgba(128, 192, 255, 0.12)" stroke="none"/>`;
  // 방호 곡선
  html += `<path d="${curvePath}" fill="none" stroke="#80c0ff" stroke-width="2"/>`;
  // 탄 유효 관통력 — 수평선
  if (penY >= padT && penY <= padT + plotH) {
    html += `<line x1="${padL}" y1="${penY}" x2="${padL + plotW}" y2="${penY}" stroke="#ff9a3a" stroke-width="1.5" stroke-dasharray="5,3"/>`;
    html += `<text x="${padL + plotW - 4}" y="${penY - 4}" fill="#ff9a3a" font-size="9" text-anchor="end">유효 관통 ${effPen.toFixed(0)}</text>`;
  }
  // 현재 내구도 — 세로선 + 점
  html += `<line x1="${curX}" y1="${padT}" x2="${curX}" y2="${padT + plotH}" stroke="#ffe066" stroke-width="1" stroke-dasharray="3,2"/>`;
  html += `<circle cx="${curX}" cy="${curY}" r="4" fill="#ffe066" stroke="#fff" stroke-width="0.8"/>`;
  html += `<text x="${curX + 6}" y="${curY - 6}" fill="#ffe066" font-size="9">${curEffArmor.toFixed(0)}</text>`;
  html += labels;

  svg.innerHTML = html;
}


// =============================================================
