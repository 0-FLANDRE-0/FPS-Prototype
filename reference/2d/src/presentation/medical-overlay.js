// =============================================================
// 의료 오버레이 시스템
// =============================================================
const MEDIC_OVERLAY = {
  open: false,
  treaterId: null,
  targetId: null,
  selectedPart: 'chest',
  selectedWoundId: null,       // 2B-0: 선택 wound
  selectedWoundGroupId: null,  // 2B-0-FINAL: 선택 클러스터
  _lastPart: null,
  showAllParts: false,         // 부위 요약 접이식
};

function openMedicOverlay(treaterId, targetId) {
  MEDIC_OVERLAY.open = true;
  MEDIC_OVERLAY.treaterId = treaterId;
  MEDIC_OVERLAY.targetId = targetId;
  // 가장 위험한 부위를 기본 선택
  const tgt = unitById(targetId);
  if (tgt) MEDIC_OVERLAY.selectedPart = findMostUrgentPart(tgt) || 'chest';
  document.getElementById('medicOverlay').style.display = 'flex';
  renderMedicOverlay();
}

function closeMedicOverlay() {
  MEDIC_OVERLAY.open = false;
  document.getElementById('medicOverlay').style.display = 'none';
}

function findMostUrgentPart(tgt) {
  const parts = ['head','neck','chest','abdomen','left_arm','right_arm','left_leg','right_leg'];
  // bleedingLoc 우선
  if (tgt.bleeding === 'heavy' || tgt.bleeding === 'critical') {
    if (tgt.bleedingLoc === 'arms') return 'right_arm';
    if (tgt.bleedingLoc === 'legs') return 'right_leg';
    if (tgt.bleedingLoc) return tgt.bleedingLoc;
  }
  // 가장 낮은 부위 hp
  let worst = null, worstHp = 200;
  for (const p of parts) {
    const hp = getPartHp(tgt, p);
    if (hp < worstHp) { worstHp = hp; worst = p; }
  }
  return worst || 'chest';
}

function getPartMaxHp(target, part) {
  if (target && target.medical && target.medical.bodyParts) {
    const k = _legacyPartToMedical(part);
    if (target.medical.bodyParts[k]) return target.medical.bodyParts[k].maxHp;
    if (part === 'arms') return (target.medical.bodyParts.leftArm.maxHp + target.medical.bodyParts.rightArm.maxHp) / 2;
    if (part === 'legs') return (target.medical.bodyParts.leftLeg.maxHp + target.medical.bodyParts.rightLeg.maxHp) / 2;
  }
  return 100;
}

// ratio 기준 — 부위별 maxHp가 다르므로(head 35, chest 85 등) 절대값 대신 비율 사용
function getPartStatus(target, part) {
  const hp = getPartHp(target, part);
  const maxHp = getPartMaxHp(target, part);
  const ratio = hp / Math.max(1, maxHp);
  if (ratio >= 0.75) return 'normal';
  if (ratio >= 0.50) return 'light';
  if (ratio >= 0.25) return 'serious';
  return 'critical';
}

function getPartStatusLabel(s) {
  return { normal:'정상', light:'경상', serious:'중상', critical:'치명상' }[s] || '정상';
}

function renderMedicOverlay() {
  if (!MEDIC_OVERLAY.open) return;
  const treater = unitById(MEDIC_OVERLAY.treaterId);
  const target = unitById(MEDIC_OVERLAY.targetId);
  if (!treater || !target) { closeMedicOverlay(); return; }
  const isSelf = (treater.id === target.id);
  document.getElementById('medTitle').textContent = isSelf
    ? `${treater.name} — 자가 처치`
    : `${treater.name} → ${target.name}`;

  // 실루엣 부위별 상태 클래스 갱신
  const parts = ['head','neck','chest','abdomen','left_arm','right_arm','left_leg','right_leg'];
  for (const p of parts) {
    const el = document.querySelector(`.med-part[data-part="${p}"]`);
    if (!el) continue;
    el.classList.remove('normal','light','serious','critical','selected','bleeding','fractured');
    el.classList.add(getPartStatus(target, p));
    if (isPartBleeding(target, p)) el.classList.add('bleeding');
    if (isPartFractured(target, p)) el.classList.add('fractured');
    if (p === MEDIC_OVERLAY.selectedPart) el.classList.add('selected');
  }

  // === 좌측: 부위 다각형 + 부위 중앙 박스 overlay (둘 다 같은 그룹) ===
  renderMedPartBoxes(target);
  // SVG 다각형 클릭 → 같은 부위 선택 그룹
  bindBodyPartClicks();
  // === 중앙: 단일 스크롤 (선택 부위 → 전신 vitals → 처치 → 부위 요약) ===
  renderMedDetailScroll(target);
  // === 우측: 처치 버튼 ===
  renderMedTreatArea(treater, target);
}

// 부위 SVG의 viewBox(0~100, 0~200) 기준 중심 좌표
//   anchor: 부위 실제 중심 (다각형 중심)
//   box: 박스가 그려질 위치 (anchor와 같으면 부위 위, 다르면 옆으로 치워 leader line 연결)
const MED_PART_CENTERS = {
  head:      { anchor: { x: 50,  y: 18 },  box: { x: 50,  y: 18 } },
  // 목 — 작아서 박스를 옆(왼쪽)으로 치우고 leader line 연결
  neck:      { anchor: { x: 50,  y: 36 },  box: { x: 18,  y: 32 },  leader: true },
  chest:     { anchor: { x: 50,  y: 59 },  box: { x: 50,  y: 59 } },
  abdomen:   { anchor: { x: 50,  y: 91 },  box: { x: 50,  y: 91 } },
  right_arm: { anchor: { x: 21,  y: 71 },  box: { x: 21,  y: 71 } },
  left_arm:  { anchor: { x: 79,  y: 71 },  box: { x: 79,  y: 71 } },
  right_leg: { anchor: { x: 40,  y: 140 }, box: { x: 40,  y: 140 } },
  left_leg:  { anchor: { x: 60,  y: 140 }, box: { x: 60,  y: 140 } },
};

function renderMedPartBoxes(target) {
  const overlay = document.getElementById('medBodyOverlay');
  if (!overlay) return;
  const parts = ['head','neck','chest','abdomen','left_arm','right_arm','left_leg','right_leg'];
  const partLabels = {
    head: '머리', neck: '목', chest: '가슴', abdomen: '복부',
    left_arm: 'L팔', right_arm: 'R팔', left_leg: 'L다리', right_leg: 'R다리',
  };
  let html = '';
  for (const p of parts) {
    const hp = getPartHp(target, p);
    const maxHp = getPartMaxHp(target, p);
    const ratio = hp / Math.max(1, maxHp);
    // 색상도 ratio 기준 (절대값 X) — 부위별 maxHp 차이 보정
    const barClass = ratio < 0.30 ? 'danger' : (ratio < 0.60 ? 'warn' : '');
    const isSel = (p === MEDIC_OVERLAY.selectedPart);
    // 상태이상 아이콘 (작은 태그)
    const icons = [];
    if (target.medical && target.medical.bodyParts[_legacyPartToMedical(p)]) {
      const part = target.medical.bodyParts[_legacyPartToMedical(p)];
      if (part.externalBleedRate > 25) icons.push(`<span class="mpo-icon-tag bleed-ext" title="외부출혈 ${part.externalBleedRate.toFixed(1)} ml/s">출혈</span>`);
      else if (part.externalBleedRate > 8) icons.push(`<span class="mpo-icon-tag bleed-ext" title="외부출혈 ${part.externalBleedRate.toFixed(1)} ml/s">출혈</span>`);
      else if (part.externalBleedRate > 0.5) icons.push(`<span class="mpo-icon-tag bleed-ext" title="경미 출혈 ${part.externalBleedRate.toFixed(1)} ml/s">경출혈</span>`);
      if (part.internalBleedRate > 0.5) icons.push(`<span class="mpo-icon-tag bleed-int" title="내부출혈 ${part.internalBleedRate.toFixed(1)} ml/s">내출혈</span>`);
      if (part.fracture) icons.push(`<span class="mpo-icon-tag fx" title="골절">골절</span>`);
      if (part.tourniquetApplied) icons.push(`<span class="mpo-icon-tag tq" title="지혈대 적용">지혈</span>`);
      if (part.bandageApplied) icons.push(`<span class="mpo-icon-tag bnd" title="붕대 적용">붕대</span>`);
      if (part.splinted) icons.push(`<span class="mpo-icon-tag sp" title="부목 적용">부목</span>`);
      if (part.chestSealed) icons.push(`<span class="mpo-icon-tag seal" title="흉부 씰">씰</span>`);
    } else if (target.bodyHp) {
      if (isPartBleeding(target, p)) icons.push(`<span class="mpo-icon-tag bleed-ext">출혈</span>`);
      if (isPartFractured(target, p)) icons.push(`<span class="mpo-icon-tag fx">골절</span>`);
    }
    // 머리 부위 — 정신/뇌 상태
    if (p === 'head' && target.medical) {
      const m = target.medical;
      if (m.consciousness < 50) icons.push(`<span class="mpo-icon-tag unconscious" title="의식 ${m.consciousness.toFixed(0)}%">의식저하</span>`);
      else if (m.consciousness < 80) icons.push(`<span class="mpo-icon-tag dizzy" title="혼란/어지러움 (의식 ${m.consciousness.toFixed(0)}%)">혼란</span>`);
      if (m.pain >= 70) icons.push(`<span class="mpo-icon-tag pain-high" title="극심한 통증">극통</span>`);
    }
    // 위치 — anchor/box 좌표 (목은 옆으로 치움)
    const center = MED_PART_CENTERS[p] || { anchor: { x: 50, y: 100 }, box: { x: 50, y: 100 } };
    const boxLeft = center.box.x;
    const boxTop = (center.box.y / 200) * 100;
    html += `<div class="med-part-box ${isSel ? 'selected' : ''}"
      data-part="${p}"
      style="left:${boxLeft}%; top:${boxTop}%;">
      <div class="mpo-name">${partLabels[p]}</div>
      <div class="mpo-bar">
        <div class="mpo-bar-fill ${barClass}" style="width:${Math.max(0, ratio*100)}%"></div>
        <span class="mpo-bar-text">${hp.toFixed(0)}/${maxHp}</span>
      </div>
      <div class="mpo-icons">${icons.join('')}</div>
    </div>`;
  }
  overlay.innerHTML = html;
  // 박스 클릭 — 부위 선택
  overlay.querySelectorAll('.med-part-box').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      MEDIC_OVERLAY.selectedPart = box.dataset.part;
      renderMedicOverlay();
    });
  });
  // Leader lines — 박스를 옆으로 치운 부위에 연결선
  renderMedLeaderLines(target);
}

function renderMedLeaderLines(target) {
  const g = document.getElementById('medLeaderLines');
  if (!g) return;
  let lines = '';
  for (const p in MED_PART_CENTERS) {
    const c = MED_PART_CENTERS[p];
    if (!c.leader) continue;
    const isSel = (p === MEDIC_OVERLAY.selectedPart);
    // anchor (부위 중심) → box 좌표로 짧은 선
    // SVG viewBox 좌표계에서 직접 그림
    lines += `<line class="med-leader-line ${isSel ? 'selected' : ''}"
      x1="${c.anchor.x}" y1="${c.anchor.y}"
      x2="${c.box.x}" y2="${c.box.y}"/>`;
  }
  g.innerHTML = lines;
}

function bindBodyPartClicks() {
  // SVG 다각형 클릭 — 박스와 같은 부위 선택 그룹 (이벤트 위임)
  const svg = document.getElementById('medSilhouetteSvg');
  if (!svg || svg._medBound) return;
  svg._medBound = true;
  svg.addEventListener('click', (e) => {
    const el = e.target.closest('.med-part');
    if (!el) return;
    const part = el.dataset.part;
    if (!part) return;
    MEDIC_OVERLAY.selectedPart = part;
    renderMedicOverlay();
  });
}

function renderMedDetailScroll(target) {
  const dSec = document.getElementById('medDetailScroll');
  if (!dSec) return;
  const m = target.medical;
  const sel = MEDIC_OVERLAY.selectedPart || 'chest';
  const selKor = BODY_PART_KOR[sel] || sel;
  // 2B-0-FINAL: 부위 변경 시 선택 초기화 + displayRows 기반 자동 선택 (개별 wound 또는 클러스터)
  const selPartKey = resolveBodyPartKey(sel, null);
  let _rows = [];
  if (m && m.wounds) {
    if (MEDIC_OVERLAY._lastPart !== sel) { MEDIC_OVERLAY.selectedWoundId = null; MEDIC_OVERLAY.selectedWoundGroupId = null; MEDIC_OVERLAY._lastPart = sel; }
    _rows = buildWoundDisplayRows(target, selPartKey);
    // 선택 유효성
    const selSingle = MEDIC_OVERLAY.selectedWoundId && _rows.find(r => r.type === 'single' && r.woundId === MEDIC_OVERLAY.selectedWoundId);
    const selGroup = MEDIC_OVERLAY.selectedWoundGroupId && _rows.find(r => r.type === 'cluster' && r.groupId === MEDIC_OVERLAY.selectedWoundGroupId);
    if (!selSingle) MEDIC_OVERLAY.selectedWoundId = null;
    if (!selGroup) MEDIC_OVERLAY.selectedWoundGroupId = null;
    // 아무것도 선택 안 됐으면 가장 긴급 row 자동 선택
    if (!MEDIC_OVERLAY.selectedWoundId && !MEDIC_OVERLAY.selectedWoundGroupId && _rows.length) {
      const top = _rows[0];
      if (top.type === 'cluster') MEDIC_OVERLAY.selectedWoundGroupId = top.groupId;
      else MEDIC_OVERLAY.selectedWoundId = top.woundId;
    }
    // 대형 PHASE 5: 명칭 정리 — selectedWoundGroupId는 실제 medical.woundClusters의 id를 담는다 (호환 미러).
    MEDIC_OVERLAY.selectedTreatmentClusterId = MEDIC_OVERLAY.selectedWoundGroupId;
  }

  let html = '';

  // === 1) 선택 부위 세부사항 (최상단, 우선 표시) ===
  html += `<div class="med-detail-section">`;
  html += `<div class="med-detail-section-title">▶ 선택 부위: ${selKor}</div>`;
  if (m && m.bodyParts[_legacyPartToMedical(sel)]) {
    const p = m.bodyParts[_legacyPartToMedical(sel)];
    const ratio = p.hp / p.maxHp;
    const hpCls = ratio < 0.3 ? 'bad' : (ratio < 0.6 ? 'warn' : '');
    html += `<div class="med-detail-row"><span>HP</span><b class="${hpCls}">${p.hp.toFixed(1)} / ${p.maxHp} (${(ratio*100).toFixed(0)}%)</b></div>`;
    html += `<div class="med-detail-row"><span>기능</span><b class="${p.functionRatio<0.3?'bad':(p.functionRatio<0.6?'warn':'')}">${(p.functionRatio*100).toFixed(0)}%</b></div>`;
    // PART-DESTRUCTION-1 Phase8 §14: 부위파괴 상태 표시
    {
      const _pd = m.partDestruction && m.partDestruction[_legacyPartToMedical(sel)];
      if (_pd && _pd.state && _pd.state !== 'intact') {
        const PD_LABEL = { damaged:'손상', impaired:'기능저하', mangled:'심한 파괴', destroyed:'기능상실', partial_traumatic_loss:'부분 소실', traumatic_amputation:'외상성 절단', catastrophic_non_limb:'치명적 손상' };
        const _stCls = (_pd.state === 'mangled' || _pd.state === 'destroyed' || _pd.state === 'traumatic_amputation' || _pd.state === 'catastrophic_non_limb' || _pd.state === 'partial_traumatic_loss') ? 'bad' : (_pd.state === 'impaired' ? 'warn' : '');
        html += `<div class="med-detail-row"><span>부위 상태</span><b class="${_stCls}">${PD_LABEL[_pd.state] || _pd.state}</b></div>`;
        html += `<div class="med-detail-row"><span>누적 외상</span><b class="${_pd.cumulativeTraumaScore>=0.5?'bad':(_pd.cumulativeTraumaScore>=0.28?'warn':'')}">${_pd.cumulativeTraumaScore.toFixed(2)}</b></div>`;
        if (_pd.destructionRisk > 0.05) html += `<div class="med-detail-row"><span>부위파괴 위험</span><b class="${_pd.destructionRisk>=0.6?'bad':(_pd.destructionRisk>=0.3?'warn':'')}">${(_pd.destructionRisk*100).toFixed(0)}%</b></div>`;
        html += `<div class="med-detail-row"><span>기능 상한</span><b class="${_pd.functionalCap<0.3?'bad':(_pd.functionalCap<0.6?'warn':'')}">${(_pd.functionalCap*100).toFixed(0)}%</b></div>`;
      }
    }
    if (p.externalBleedRate > 0.5) {
      const tag = p.externalBleedRate > 25 ? ' (치명)' : p.externalBleedRate > 8 ? ' (심함)' : ' (경미)';
      html += `<div class="med-detail-row"><span>외부 출혈</span><b class="bad">${p.externalBleedRate.toFixed(1)} ml/s${tag}</b></div>`;
    }
    if (p.internalBleedRate > 0.5) html += `<div class="med-detail-row"><span>내부 출혈</span><b class="bad">${p.internalBleedRate.toFixed(1)} ml/s</b></div>`;
    if (p.fracture) html += `<div class="med-detail-row"><span>골절</span><b class="warn">있음${p.splinted ? ' · 부목 적용' : ''}</b></div>`;
    if (p.tourniquetApplied) html += `<div class="med-detail-row"><span>지혈대</span><b class="ok">적용됨</b></div>`;
    if (p.bandageApplied) html += `<div class="med-detail-row"><span>붕대</span><b class="ok">적용됨</b></div>`;
    if (p.chestSealed) html += `<div class="med-detail-row"><span>흉부 씰</span><b class="ok">적용됨</b></div>`;
    if (p.disabled) html += `<div class="med-detail-row"><span>상태</span><b class="bad">기능 상실</b></div>`;
    if (p.pain > 0) html += `<div class="med-detail-row"><span>부위 통증</span><b class="${p.pain>=50?'warn':''}">${p.pain.toFixed(0)}</b></div>`;
    // 머리 — 의식/통증 추가
    if (sel === 'head') {
      const consCls = m.consciousness < 50 ? 'bad' : (m.consciousness < 80 ? 'warn' : '');
      html += `<div class="med-detail-row"><span>의식 수준</span><b class="${consCls}">${m.consciousness.toFixed(0)}%</b></div>`;
    }
    // 가슴 — 호흡 추가
    if (sel === 'chest') {
      const respCls = m.breathingEfficiency < 35 ? 'bad' : (m.breathingEfficiency < 70 ? 'warn' : '');
      html += `<div class="med-detail-row"><span>호흡 효율</span><b class="${respCls}">${m.breathingEfficiency.toFixed(0)}%</b></div>`;
    }
  } else {
    html += `<div class="med-detail-row"><span>HP</span><b>${getPartHp(target, sel).toFixed(0)}/${getPartMaxHp(target, sel)}</b></div>`;
    if (isPartBleeding(target, sel)) html += `<div class="med-detail-row"><span>출혈</span><b class="bad">있음</b></div>`;
    if (isPartFractured(target, sel)) html += `<div class="med-detail-row"><span>골절</span><b class="warn">있음</b></div>`;
  }
  html += `</div>`;

  // === 2) 전신 vitals + ECG 심전도 ===
  if (m) {
    html += `<div class="med-detail-section">`;
    html += `<div class="med-detail-section-title">전신 활력 징후</div>`;
    // ECG 심전도 (실시간 — drawActiveEcgCanvases가 캔버스 갱신)
    html += `<div class="ecg-box-large">
      <canvas id="medicalEcgCanvas"></canvas>
    </div>`;
    const lifeCls = m.lifeStatus < 30 ? 'bad' : (m.lifeStatus < 60 ? 'warn' : 'ok');
    const bloodCls = m.bloodMl < 2500 ? 'bad' : (m.bloodMl < 3500 ? 'warn' : 'ok');
    const hrCls = (m.heartRate > 140 || m.heartRate < 50) ? 'bad' : (m.heartRate > 110 ? 'warn' : '');
    const bpCls = m.systolicBP < 70 ? 'bad' : (m.systolicBP < 90 ? 'warn' : '');
    const respCls = m.breathingEfficiency < 35 ? 'bad' : (m.breathingEfficiency < 70 ? 'warn' : '');
    const shockCls = m.shock > 70 ? 'bad' : (m.shock > 40 ? 'warn' : '');
    const consCls = m.consciousness < 50 ? 'bad' : (m.consciousness < 80 ? 'warn' : '');
    const painCls = m.pain >= 70 ? 'bad' : (m.pain >= 40 ? 'warn' : '');
    const isDead = target.isDead || m.lifeStatus <= 0;
    html += `<div class="med-detail-row"><span>심박수 HR</span><b class="${hrCls}">${isDead ? '--' : m.heartRate.toFixed(0)} bpm</b></div>`;
    // CARDIAC-1R §20: 심장 리듬 / 관류 리듬 / 제세동 가능성 / ECG 품질 (확정 진단 표현 금지)
    if (!isDead && m.cardiacRhythmModel) {
      const crm = m.cardiacRhythmModel;
      const RKO = { normal_sinus:'정상동율동', sinus_tachycardia:'보상성 빈맥', sinus_bradycardia:'동성 서맥', unstable_tachycardia:'불안정 빈맥', unstable_bradycardia:'불안정 서맥', ventricular_irritability:'심실 자극(후보)', vtach_candidate:'심실빈맥 후보', vfib_candidate:'심실세동 후보', pea_candidate:'무맥성 전기활동 후보', asystole_candidate:'무수축 후보' };
      const rCls = (crm.rhythmClass === 'arrest_candidate' || crm.rhythmClass === 'peri_arrest_candidate') ? 'bad' : (crm.rhythmClass === 'unstable' ? 'warn' : '');
      html += `<div class="med-detail-row"><span>심장 리듬</span><b class="${rCls}">${RKO[crm.rhythm] || crm.rhythm}</b></div>`;
      const perfTxt = !crm.perfusing ? '매우 낮음' : (crm.rhythmClass === 'unstable' ? '불안정' : '유지');
      const perfCls = !crm.perfusing ? 'bad' : (crm.rhythmClass === 'unstable' ? 'warn' : '');
      html += `<div class="med-detail-row"><span>관류 리듬</span><b class="${perfCls}">${perfTxt}</b></div>`;
      if (crm.shockableHint) html += `<div class="med-detail-row"><span>제세동 가능성</span><b class="warn">후보 (처치 미구현)</b></div>`;
      else if (crm.nonShockableReason) html += `<div class="med-detail-row"><span>제세동 가능성</span><b>비적응 (${crm.nonShockableReason === 'pulseless_electrical_activity' ? '무맥성 전기활동' : '무수축'})</b></div>`;
      const ecgVs = getEcgVisualState(target);
      const aLvl = ecgVs.artifactLevel || 0;
      const qTxt = aLvl > 0.45 ? 'artifact 높음' : (ecgVs.lowPerfAmp < 0.7 ? 'low amplitude' : '안정');
      if (aLvl > 0.25 || ecgVs.lowPerfAmp < 0.7) html += `<div class="med-detail-row"><span>ECG 품질</span><b class="${aLvl > 0.45 ? 'warn' : ''}">${qTxt}</b></div>`;
    }
    // FIELD-STAB-1 §15: 적용된 안정화 처치 상태 (active만 간결 표시)
    if (!isDead && m.fieldStabilizationModel) {
      const fs = m.fieldStabilizationModel;
      if (fs.airwaySupport.active) html += `<div class="med-detail-row"><span>기도 보조</span><b class="ok">적용 · 제한적${fs.airwaySupport.recurrenceRisk > 0.5 ? ' (재발 위험)' : ''}</b></div>`;
      if (fs.chestRelief.active) html += `<div class="med-detail-row"><span>흉부 압력</span><b class="ok">완화 중${fs.chestRelief.recurrenceRisk > 0.5 ? ' (재발 위험)' : ''}</b></div>`;
      if (fs.pelvicControl.active) html += `<div class="med-detail-row"><span>골반 고정</span><b class="ok">적용 · 내부출혈 미해결</b></div>`;
      if (fs.junctionalControl.active) html += `<div class="med-detail-row"><span>Junctional</span><b class="ok">제어 중${fs.junctionalControl.recurrenceRisk > 0.5 ? ' (이동시 재발)' : ''}</b></div>`;
      if (fs.circulationSupport.active) html += `<div class="med-detail-row"><span>순환 보조</span><b class="${fs.circulationSupport.transfusionRequired ? 'warn' : ''}">현장 제한${fs.circulationSupport.transfusionRequired ? ' · 수혈 필요' : ''}</b></div>`;
    }
    html += `<div class="med-detail-row"><span>혈압 BP</span><b class="${bpCls}">${isDead ? '--/--' : `${m.systolicBP.toFixed(0)} / ${m.diastolicBP.toFixed(0)}`}</b></div>`;
    html += `<div class="med-detail-row"><span>호흡 RESP</span><b class="${respCls}">${m.breathingEfficiency.toFixed(0)}% · ${getRespLabel(m.breathingEfficiency)}</b></div>`;
    html += `<div class="med-detail-row"><span>혈액 BLOOD</span><b class="${bloodCls}">${(m.bloodMl/1000).toFixed(2)}L / ${(m.bloodMax/1000).toFixed(1)}L</b></div>`;
    html += `<div class="med-detail-row"><span>생명유지 LIFE</span><b class="${lifeCls}">${m.lifeStatus.toFixed(0)}%</b></div>`;
    html += `<div class="med-detail-row"><span>의식 CONSC</span><b class="${consCls}">${m.consciousness.toFixed(0)}%</b></div>`;
    html += `<div class="med-detail-row"><span>쇼크 SHOCK</span><b class="${shockCls}">${m.shock.toFixed(0)}</b></div>`;
    html += `<div class="med-detail-row"><span>통증 PAIN</span><b class="${painCls}">${m.pain.toFixed(0)}</b></div>`;
    html += `<div class="med-detail-row"><span>BODY 총합</span><b>${m.bodyHpTotal.toFixed(0)} / ${m.bodyHpMax}</b></div>`;
    const totalBleed = m.externalBleedRate + m.internalBleedRate;
    if (totalBleed > 0.5) html += `<div class="med-detail-row"><span>총 출혈률</span><b class="bad">${totalBleed.toFixed(1)} ml/s</b></div>`;
    html += `</div>`;
  } else {
    html += `<div class="med-detail-section">`;
    html += `<div class="med-detail-section-title">전신</div>`;
    html += `<div class="med-detail-row"><span>HP</span><b>${target.hp}/${target.maxHp}</b></div>`;
    html += `<div class="med-detail-row"><span>통증</span><b>${target.pain || 0}</b></div>`;
    html += `</div>`;
  }

  // === 3) 적용된 처치 ===
  const applied = [];
  if (m) {
    const partNames = { head:'머리', neck:'목', chest:'가슴', abdomen:'복부',
                        leftArm:'L팔', rightArm:'R팔', leftLeg:'L다리', rightLeg:'R다리' };
    for (const k of ['head','neck','chest','abdomen','leftArm','rightArm','leftLeg','rightLeg']) {
      const p = m.bodyParts[k];
      if (!p) continue;
      if (p.tourniquetApplied) applied.push(`${partNames[k]} 지혈대`);
      if (p.bandageApplied) applied.push(`${partNames[k]} 붕대`);
      if (p.chestSealed) applied.push(`${partNames[k]} 흉부 씰`);
      if (p.splinted) applied.push(`${partNames[k]} 부목`);
    }
  }
  if (target.painkillerActive) applied.push(`진통제 효과 ${Math.round(target.analgesiaLevel || 0)}% (${Math.round(target.painkillerTimer || 0)}s 잔여)`);
  else if (target.painkillerDelay > 0) applied.push(`진통제 발동 대기 ${Math.round(target.painkillerDelay)}s`);
  if (target.stabilized || target.shockCareApplied) applied.push('쇼크 안정화');
  if (applied.length > 0) {
    html += `<div class="med-detail-section">`;
    html += `<div class="med-detail-section-title">적용된 처치</div>`;
    for (const a of applied) html += `<div class="med-detail-row"><span>${a}</span><b class="ok">✓</b></div>`;
    html += `</div>`;
  }

  // === 2B-0: 4) 선택 부위 wound/cluster 목록 + 상세 ===
  if (m && m.wounds) {
    html += renderWoundListAndDetail(target, selPartKey, _rows);
  }

  // === 5) 부위 요약 (접이식 — 기본 숨김) ===
  if (m) {
    const open = MEDIC_OVERLAY.showAllParts;
    html += `<div class="med-detail-section">`;
    html += `<div class="med-detail-section-title med-collapse-toggle" id="medAllPartsToggle" style="cursor:pointer">${open?'▼':'▶'} 전체 부위 요약 ${open?'':'(접힘)'}</div>`;
    if (open) {
      const allParts = ['head','neck','chest','abdomen','leftArm','rightArm','leftLeg','rightLeg'];
      const partNames = { head:'머리', neck:'목', chest:'가슴', abdomen:'복부', leftArm:'L팔', rightArm:'R팔', leftLeg:'L다리', rightLeg:'R다리' };
      for (const k of allParts) {
        const p = m.bodyParts[k]; if (!p) continue;
        const ratio = p.hp / p.maxHp;
        const cls = ratio < 0.3 ? 'bad' : (ratio < 0.6 ? 'warn' : '');
        html += `<div class="med-detail-row"><span>${partNames[k]}</span><b class="${cls}">${p.hp.toFixed(0)}/${p.maxHp} (${(ratio*100).toFixed(0)}%)</b></div>`;
      }
    }
    html += `</div>`;
  }

  dSec.innerHTML = html;
  // wound/cluster row 클릭
  dSec.querySelectorAll('.med-wound-row').forEach(row => {
    row.addEventListener('click', () => {
      if (row.dataset.groupId) { MEDIC_OVERLAY.selectedWoundGroupId = row.dataset.groupId; MEDIC_OVERLAY.selectedWoundId = null; }
      else { MEDIC_OVERLAY.selectedWoundId = row.dataset.woundId; MEDIC_OVERLAY.selectedWoundGroupId = null; }
      renderMedicOverlay();
    });
  });
  const tog = document.getElementById('medAllPartsToggle');
  if (tog) tog.addEventListener('click', () => { MEDIC_OVERLAY.showAllParts = !MEDIC_OVERLAY.showAllParts; renderMedicOverlay(); });
}

// 2B-0: 선택 부위 wound 목록 + 선택 wound 상세 HTML
function renderWoundListAndDetail(target, partKey, rows) {
  const m = target.medical;
  rows = rows || buildWoundDisplayRows(target, partKey);
  let html = `<div class="med-detail-section">`;
  const woundCount = getPartWounds(target, partKey).length;
  html += `<div class="med-detail-section-title">부상 목록 (${woundCount})</div>`;
  if (!rows.length) {
    html += `<div class="med-detail-row"><span style="color:#7a848c">이 부위에 기록된 상처 없음</span></div>`;
  } else {
    html += `<div class="med-wound-list">`;
    let n = 1;
    for (const r of rows) {
      if (r.type === 'cluster') {
        const sel = (r.groupId === MEDIC_OVERLAY.selectedWoundGroupId);
        const bleedCls = (r.totalExternal > 0.5) ? 'bleeding' : '';
        const fcCls = 'field-care-' + r.fieldCareClass.replace('field_unmanageable','unmanageable');
        html += `<div class="med-wound-row med-wound-cluster ${sel?'selected':''} ${bleedCls}" data-group-id="${r.groupId}">
          <span class="mw-num">#${n}</span>
          <span class="mw-label wound-size-${r.wounds[0].woundSize.sizeClass}">${r.representativeLocation} ${r.representativeLabel}</span>
          <span class="mw-bleed">${r.bleedingSummary}</span>
          <span class="mw-treat">${r.treatmentSummary}</span>
          <span class="mw-fc ${fcCls}">${r.fieldCareSummary}</span>
        </div>`;
      } else {
        const w = r.wound;
        w.uiLabels = buildWoundUiLabels(w);                 // §2: 렌더 시 최신화
        const sel = (w.id === MEDIC_OVERLAY.selectedWoundId);
        const L = w.uiLabels, bp = w.bleedingProfile || {};
        const eff = (w._effExternal != null) ? w._effExternal : (bp.currentExternal || 0);
        const bleedCls = (bp.bleedingType === 'none') ? '' : (eff > 18 || bp.bleedingType === 'cavity' || bp.bleedingType === 'junctional') ? 'urgent' : (eff > 0.5 ? 'bleeding' : '');
        const fcCls = 'field-care-' + (w.fieldCare.fieldCareClass.replace('field_unmanageable','unmanageable'));
        const szCls = 'wound-size-' + w.woundSize.sizeClass;
        html += `<div class="med-wound-row ${sel?'selected':''} ${bleedCls}" data-wound-id="${w.id}">
          <span class="mw-num">#${n}</span>
          <span class="mw-label ${szCls}">${L.combinedLabel}</span>
          <span class="mw-bleed">${L.bleedingLabel}</span>
          <span class="mw-treat">${L.treatmentLabel}</span>
          <span class="mw-fc ${fcCls}">${L.fieldCareLabel}</span>
        </div>`;
      }
      n++;
    }
    html += `</div>`;
  }
  html += `</div>`;
  // === 선택 클러스터 상세 (§14) ===
  if (MEDIC_OVERLAY.selectedWoundGroupId) {
    const cr = rows.find(r => r.type === 'cluster' && r.groupId === MEDIC_OVERLAY.selectedWoundGroupId);
    if (cr) {
      const ws = cr.wounds;
      let totExt = 0, totInt = 0, treated = 0, bleed = 0;
      const sizeDist = {};
      for (const w of ws) {
        const bp = w.bleedingProfile || {};
        totExt += (w._effExternal != null) ? w._effExternal : (bp.currentExternal || 0);
        totInt += (w._effInternal != null) ? w._effInternal : (bp.currentInternal || 0);
        const ts = w.treatmentState || {};
        if (ts.pressureBandaged || ts.stabilized || ts.bandageApplied || ts.hemostaticApplied || ts.packed) treated++;
        if (bp.bleedingType !== 'none') bleed++;
        sizeDist[w.woundSize.sizeClass] = (sizeDist[w.woundSize.sizeClass] || 0) + 1;
      }
      const distStr = Object.keys(sizeDist).map(k => `${WOUND_SIZE_LABEL_KO[k]} ${sizeDist[k]}`).join(', ');
      html += `<div class="med-detail-section med-wound-detail">`;
      html += `<div class="med-detail-section-title">묶음 상처: ${cr.representativeLabel}</div>`;
      html += `<div class="med-detail-row"><span>위치</span><b>${cr.representativeLocation}</b></div>`;
      html += `<div class="med-detail-row"><span>포함 상처</span><b>${cr.count}건</b></div>`;
      html += `<div class="med-detail-row"><span>크기 분포</span><b>${distStr}</b></div>`;
      // SIDE-FRAGMENT-WOUND-CLUSTER-ADDRESS-1: 최대 파편 에너지/등가피해 (있을 때만) + 성격/재질
      if (cr.maxFragmentEnergyJ != null || cr.maxEquivalentDamage != null || cr.maxFragmentSharpness != null) {
        let _ce = [];
        if (cr.maxFragmentEnergyJ != null) _ce.push(`최대 ${cr.maxFragmentEnergyJ.toFixed(1)}J`);
        if (cr.maxEquivalentDamage != null) _ce.push(`최대 등가피해 ${cr.maxEquivalentDamage.toFixed(1)}`);
        if (cr.maxFragmentSharpness != null) _ce.push(`최대 예리도 ${cr.maxFragmentSharpness.toFixed(2)}`);
        html += `<div class="med-detail-row" style="color:#d0b890;"><span>파편 에너지</span><b>${_ce.join(' · ')}</b></div>`;
        if (cr.spallMaterialTypes && cr.spallMaterialTypes.length) {
          const _mk = ({ steel:'강철', ceramic:'세라믹', aramid:'아라미드', pe:'PE', aluminum:'알루미늄', titanium:'티타늄', composite:'복합재', glass:'유리' });
          html += `<div class="med-detail-row" style="color:#b0a880;"><span>스폴 재질</span><b>${cr.spallMaterialTypes.map(m => _mk[m] || m).join(', ')}</b></div>`;
        }
      }
      html += `<div class="med-detail-row"><span>출혈</span><b class="${totExt>0.5?'warn':''}">${cr.bleedingSummary} · 총 ${totExt.toFixed(1)} ml/s</b></div>`;
      if (totInt > 0.5) html += `<div class="med-detail-row"><span>내부 출혈</span><b>${totInt.toFixed(1)} ml/s</b></div>`;
      // 대형 PHASE 5: 실제 cluster(backend) 집계 — id/type/지속출혈/혈관/골절/상태/필요자원
      {
        const TCS_KO = { untreated:'미처치', partially_treated:'일부 처치됨', pressure_controlled:'압박 통제됨', packed:'패킹됨', secured:'안정', reopened:'재개방', rebleeding:'재출혈' };
        const TYPE_KO = { shotgun_pattern:'산탄 패턴', flechette_pattern:'플레셰트 패턴', same_area_multi_hit:'동일부위 다발', junctional_cluster:'접합부 군집', single:'단일' };
        const agg = cr.aggregateBleeding;
        html += `<div class="med-detail-row" style="font-size:9px;color:#8aa;"><span>cluster</span><b>${cr.groupId} · ${TYPE_KO[cr.clusterType] || cr.clusterType}</b></div>`;
        if (agg) html += `<div class="med-detail-row"><span>지속 출혈(집계)</span><b>외 ${agg.sustainedExternal.toFixed(1)} · 내 ${agg.sustainedInternal.toFixed(1)} ml/s</b></div>`;
        if (cr.maxVascularEvidenceLevel && cr.maxVascularEvidenceLevel !== 'none') {
          const VE_KO = { risk_only:'위험만', candidate:'후보', probable:'강한 의심', confirmed:'확정' };
          html += `<div class="med-detail-row"><span>최대 혈관 근거</span><b class="${cr.maxVascularEvidenceLevel==='confirmed'||cr.maxVascularEvidenceLevel==='probable'?'bad':'warn'}">${VE_KO[cr.maxVascularEvidenceLevel] || cr.maxVascularEvidenceLevel}</b></div>`;
        }
        if (cr.hasFracture) html += `<div class="med-detail-row"><span>골절 포함</span><b class="warn">있음${cr.fractureTypes && cr.fractureTypes.length ? ' ('+cr.fractureTypes.join(', ')+')' : ''}</b></div>`;
        const stCls = (cr.clusterTreatmentState === 'reopened' || cr.clusterTreatmentState === 'rebleeding') ? 'bad' : (cr.clusterTreatmentState === 'secured' || cr.clusterTreatmentState === 'pressure_controlled' || cr.clusterTreatmentState === 'packed') ? 'ok' : (cr.clusterTreatmentState === 'partially_treated' ? 'warn' : '');
        html += `<div class="med-detail-row"><span>묶음 처치 상태</span><b class="${stCls}">${TCS_KO[cr.clusterTreatmentState] || cr.clusterTreatmentState}</b></div>`;
        // [HOTFIX 마감] 처치 종류별 분리 요약 (child 실제 상태와 일치) — 압박/마감/지혈/패킹 구분 표시
        {
          const _tcs2 = (cr.clusterRef && cr.clusterRef.treatmentClusterState) || {};
          const _parts = [];
          if (_tcs2.pressureControlledCount) _parts.push(`압박 ${_tcs2.pressureControlledCount}`);
          if (_tcs2.plainBandagedCount) _parts.push(`마감 ${_tcs2.plainBandagedCount}`);
          if (_tcs2.hemostaticCount) _parts.push(`지혈거즈 ${_tcs2.hemostaticCount}`);
          if (_tcs2.packedCount) _parts.push(`패킹 ${_tcs2.packedCount}`);
          if (_tcs2.untreatedEligible) _parts.push(`미처치 ${_tcs2.untreatedEligible}`);
          if (_parts.length) html += `<div class="med-detail-row"><span>처치 내역</span><b>${_parts.join(' · ')}</b></div>`;
        }
        if (cr.clusterReopened) html += `<div class="med-warning">처치 후 새 피격 — 재개방됨 · 재처치 필요</div>`;
        html += `<div class="med-detail-row"><span>필요 자원(잔여)</span><b>압박붕대 ${cr.remainingBandageUnits}${cr.hemostaticUnits > 0 ? ' · 지혈거즈 권장 ' + cr.hemostaticUnits : ''}</b></div>`;
        // 고위험 자식 노출 — 묶음 요약에 숨기지 않는다
        const hi = ws.filter(w2 => { const bp2 = w2.bleedingProfile || {}; const eff2 = (w2._effExternal != null) ? w2._effExternal : (bp2.currentExternal || 0);
          return (bp2.vesselRisk || 0) > 0.5 || eff2 > 8 || bp2.majorVesselLocked || bp2.bleedingType === 'cavity'; });
        if (hi.length) html += `<div class="med-detail-row" style="color:#e08a6a;"><span>고위험 포함</span><b class="bad">${hi.length}건 — 개별 확인 필요</b></div>`;
      }
      html += `<div class="med-detail-row"><span>처치</span><b class="${treated>=cr.count?'ok':''}">${treated}/${cr.count} 처치됨</b></div>`;
      html += `<div class="med-detail-row"><span>현장처치</span><b class="ok">${cr.fieldCareSummary}</b></div>`;
      html += `<div class="med-detail-row"><span>권장</span><b>${cr.eligibleCount>0?'일괄 압박붕대':'안정'}</b></div>`;
      // 대형 PHASE 5: 자식 상처 목록 (클릭 → 개별 상세/개별 처치 그대로 사용 가능)
      html += `<div class="med-detail-section-title" style="margin-top:4px;">포함 상처 (클릭 시 개별 상세)</div>`;
      {
        let ci = 1;
        for (const w2 of ws) {
          w2.uiLabels = buildWoundUiLabels(w2);
          const L2 = w2.uiLabels, bp2 = w2.bleedingProfile || {};
          const eff2 = (w2._effExternal != null) ? w2._effExternal : (bp2.currentExternal || 0);
          const bCls = eff2 > 8 ? 'urgent' : (eff2 > 0.5 ? 'bleeding' : '');
          html += `<div class="med-wound-row ${bCls}" data-wound-id="${w2.id}" style="font-size:9px;">
            <span class="mw-num">·${ci}</span>
            <span class="mw-label">${L2.combinedLabel}</span>
            <span class="mw-bleed">${L2.bleedingLabel}</span>
            <span class="mw-treat">${L2.treatmentLabel}</span>
          </div>`;
          ci++;
        }
      }
      html += `<div class="med-warning">깊은 파편상/관통상은 별도 개별 확인 필요</div>`;
      html += `</div>`;
    }
  } else {
    // === 선택 개별 wound 상세 ===
    let w = null;
    const sr = rows.find(r => r.type === 'single' && r.woundId === MEDIC_OVERLAY.selectedWoundId);
    if (sr) w = sr.wound;
    else { const firstSingle = rows.find(r => r.type === 'single'); if (firstSingle) w = firstSingle.wound; }
    if (w) {
      w.uiLabels = buildWoundUiLabels(w);                  // §2: 최신화
      const L = w.uiLabels, wsz = w.woundSize, bp = w.bleedingProfile || {}, ts = w.treatmentState || {};
      const eff = (w._effExternal != null) ? w._effExternal : (bp.currentExternal || 0);
      const fcCls = w.fieldCare.fieldCareClass === 'field_unmanageable' ? 'bad' : (w.fieldCare.fieldCareClass === 'limited' ? 'warn' : 'ok');
      html += `<div class="med-detail-section med-wound-detail">`;
      html += `<div class="med-detail-section-title">선택 상처: ${L.combinedLabel}</div>`;
      html += `<div class="med-detail-row"><span>위치</span><b>${L.locationLabel}${w.location?(' · '+w.location):''}</b></div>`;
      html += `<div class="med-detail-row"><span>원인</span><b>${(w.ammoId||w.sourceType||'')}</b></div>`;
      html += `<div class="med-detail-row"><span>방호 결과</span><b>${({penetrated:'관통',stopped:'저지',absorbed:'흡수'})[w.armorResult]||w.armorResult||'-'}</b></div>`;
      html += `<div class="med-detail-row"><span>관통 상태</span><b>${({stopped_blunt:'비관통(둔상)',shallow:'얕음',deep:'깊음',penetrating:'관통',through_and_through:'관통(관통상)',none:'없음'})[w.penetrationState]||w.penetrationState}</b></div>`;
      html += `<div class="med-detail-row"><span>상처 규모</span><b>${WOUND_SIZE_LABEL_KO[wsz.sizeClass]} (sc ${wsz.sizeScore})</b></div>`;
      // SIDE-FRAGMENT-MASS-ENERGY-BRIDGE-1 §9: 파편 질량/에너지 표시 (있을 때만)
      if (w.fragmentEnergyJ != null || w.fragmentMassG != null) {
        const _fsrc = ({ grenade:'수류탄', micro_explosive:'12.7mm', armor_spall:'스폴', armor_spall_steel:'강철 스폴' })[w.fragmentSource] || w.fragmentSource || '파편';
        const _fcls = ({ trace:'미미', low:'낮음', moderate:'중간', high:'높음', severe:'심각' })[w.fragmentEnergyClass] || w.fragmentEnergyClass || '';
        const _spMatKo = ({ steel:'강철', ceramic:'세라믹', aramid:'아라미드', pe:'PE', aluminum:'알루미늄', titanium:'티타늄', composite:'복합재', glass:'유리' })[w.spallMaterialType] || w.spallMaterialType;
        let _fline = `${_fsrc}`;
        if (w.spallMaterialType) _fline += ` (${_spMatKo})`;
        if (w.fragmentTier || w.spallClass) _fline += ` / ${w.spallClass || w.fragmentTier}`;
        if (w.fragmentMassG != null) _fline += ` / ${(+w.fragmentMassG).toFixed(2)}g`;
        if (w.fragmentVelocityMps != null) _fline += ` / ${Math.round(w.fragmentVelocityMps)}m/s`;
        if (w.fragmentEnergyJ != null) _fline += ` / ${(+w.fragmentEnergyJ).toFixed(1)}J (${_fcls})`;
        html += `<div class="med-detail-row" style="font-size:9px;color:#d0b890;"><span>파편</span><b>${_fline}</b></div>`;
        // 파편 성격 계수 (있을 때만 — 상세)
        if (w.fragmentSharpness != null || w.fragmentShapeFactor != null) {
          let _tl = [];
          if (w.fragmentSharpness != null) _tl.push(`예리도 ${(+w.fragmentSharpness).toFixed(2)}`);
          if (w.fragmentShapeFactor != null) _tl.push(`형상 ${(+w.fragmentShapeFactor).toFixed(2)}`);
          if (w.fragmentStabilityFactor != null) _tl.push(`안정성 ${(+w.fragmentStabilityFactor).toFixed(2)}`);
          if (GAME.debugUtility && w.fragmentTumblingChance != null) _tl.push(`텀블 ${(+w.fragmentTumblingChance).toFixed(2)}`);
          if (GAME.debugUtility && w.fragmentDragFactor != null) _tl.push(`드래그 ${(+w.fragmentDragFactor).toFixed(2)}`);
          html += `<div class="med-detail-row" style="font-size:9px;color:#b0a880;"><span>파편 성격</span><b>${_tl.join(' · ')}</b></div>`;
        }
        if (GAME.debugUtility && w.equivalentDamage != null) html += `<div class="med-detail-row" style="font-size:9px;color:#667;"><span>frag energy</span><b>base→eq 피해 ${w.equivalentDamage != null ? (+w.equivalentDamage).toFixed(1) : '-'} / 관통 ${w.equivalentPenetration != null ? (+w.equivalentPenetration).toFixed(1) : '-'} / 예산 ${w.sourceGeneratedMassTotalG != null ? (+w.sourceGeneratedMassTotalG).toFixed(1) : '-'}≤${w.sourceMassBudgetG != null ? (+w.sourceMassBudgetG).toFixed(1) : '-'}g</b></div>`;
      }
      // SIDE-HIT-ADDRESS-DAMAGE-ATTENUATION-1 §5: 피격주소 피해 감쇠 표시 (감쇠가 있을 때만)
      {
        const dap = w.damageAttenuationProfile;
        if (dap && (dap.damageMul < 0.999 || dap.physiologyMul < 0.999)) {
          html += `<div class="med-detail-row" style="font-size:9px;color:#9fc8e0;"><span>피격주소 감쇠</span><b>피해 ${dap.damageMul.toFixed(2)}x · 생리승격 ${dap.physiologyMul.toFixed(2)}x</b></div>`;
          html += `<div class="med-detail-row" style="font-size:9px;color:#8aa;">감쇠 사유: ${dap.class}${dap.reason && dap.reason !== dap.class ? ' ('+dap.reason+')' : ''}</div>`;
          if (GAME.debugUtility && w.originalRawDamage != null) html += `<div class="med-detail-row" style="font-size:9px;color:#667;"><span>raw atten</span><b>원본 ${(+w.originalRawDamage).toFixed(1)} → wound ${(+w.effectiveRawDamage).toFixed(1)} (wound ${dap.woundMul.toFixed(2)}/pain ${dap.painMul.toFixed(2)}/bleed ${dap.bleedMul.toFixed(2)}/shock ${dap.shockMul.toFixed(2)})</b></div>`;
        }
      }
      html += `<div class="med-detail-row"><span>입구 / 내부 / 사출구</span><b>${WOUND_SIZE_LABEL_KO[wsz.entrySizeClass]} / ${WOUND_SIZE_LABEL_KO[wsz.internalSizeClass]} / ${w.exitWoundPresent && w.exitSizeClass ? WOUND_SIZE_LABEL_KO[w.exitSizeClass] : (w.bodyTrajectory && w.bodyTrajectory.retainedProjectile ? '체내 잔류' : '없음')}</b></div>`;
      if (w.bodyTrajectory) {
        const bt = w.bodyTrajectory;
        const depthKo = (typeof _WOUND_DEPTH_KO !== 'undefined' && _WOUND_DEPTH_KO[bt.woundDepthClass]) || bt.woundDepthClass;
        let pathTxt = depthKo;
        if (bt.rearArmorResult && bt.rearArmorResult !== 'no_rear_armor' && bt.rearArmorResult !== 'not_applicable_limb' && bt.rearArmorResult !== 'not_applicable_fragment' && typeof _REAR_RESULT_KO !== 'undefined') pathTxt += ' · ' + (_REAR_RESULT_KO[bt.rearArmorResult] || '');
        if (bt.continueRaycast) pathTxt += ' · 후속 탄도';
        html += `<div class="med-detail-row"><span>상처 경로</span><b>${pathTxt}</b></div>`;
        // SIDE-MED-BALLISTIC-2C-1 §15: 전면/후면 방호 요약 + 후속탄도 (raw는 debug)
        if (w.entryArmorSummary) html += `<div class="med-detail-row"><span>전면 방호</span><b>${w.entryArmorSummary}</b></div>`;
        if (w.rearArmorSummary) html += `<div class="med-detail-row"><span>후면 방호</span><b>${w.rearArmorSummary}</b></div>`;
        if (w.continuationSummary) html += `<div class="med-detail-row"><span>후속 탄도</span><b>${w.continuationSummary}</b></div>`;
        if (GAME.debugUtility) {
          const eac = w.entryArmorContext, ri = w.rearArmorInteraction;
          if (eac) html += `<div class="med-detail-row" style="color:#667;font-size:10px"><span>raw entry</span><b>${eac.entryLayerSlot}/${eac.entryArmorResult} pen ${eac.entryPenBeforeArmor}→${eac.entryPenAfterArmor}</b></div>`;
          if (ri) html += `<div class="med-detail-row" style="color:#667;font-size:10px"><span>raw rear</span><b>${ri.candidate}/${ri.rearArmorResult} pen ${ri.penBefore}→${ri.penAfter} slot ${ri.durabilitySlotKey||'-'}</b></div>`;
          if (bt.continuationThreatPacket) { const p=bt.continuationThreatPacket; html += `<div class="med-detail-row" style="color:#667;font-size:10px"><span>raw cont</span><b>pen ${p.residualPen} vel ${p.residualVelocity||'-'} defl ${p.deflectionDeg||0}°</b></div>`; }
        }
      }
      html += `<div class="med-detail-row"><span>상처 형태</span><b>${L.typeLabel}</b></div>`;
      html += `<div class="med-detail-row"><span>출혈 유형</span><b class="${bp.bleedingType==='none'?'':'bad'}">${BLEED_TYPE_LABEL_KO[bp.bleedingType]||bp.bleedingType}</b></div>`;
      if (bp.bleedingType !== 'none') html += `<div class="med-detail-row"><span>현재 출혈량</span><b class="${eff>8?'bad':''}">외 ${eff.toFixed(1)} · 내 ${((w._effInternal!=null?w._effInternal:bp.currentInternal)||0).toFixed(1)} ml/s</b></div>`;
      if (bp.vesselRisk > 0.5) html += `<div class="med-detail-row"><span>혈관 위험</span><b class="bad">높음 (${(bp.vesselRisk*100).toFixed(0)}%)</b></div>`;
      if (w.tissueProfile && w.tissueProfile.boneRisk > 0) html += `<div class="med-detail-row"><span>골절 위험</span><b class="warn">있음</b></div>`;
      html += `<div class="med-detail-row"><span>현재 처치</span><b class="${ts.pressureBandaged||ts.chestSealed?'ok':''}">${L.treatmentLabel}</b></div>`;
      html += `<div class="med-detail-row"><span>현장처치</span><b class="${fcCls}">${L.fieldCareLabel}</b></div>`;
      if (w._tourniquetSuppressed) html += `<div class="med-warning">지혈대 억제됨 — 상처 미처치 / 추가 처치 필요</div>`;
      if (ts.chestSealed) html += `<div class="med-warning">체스트씰 적용됨 — 개방성 흉부상 안정화 · 기흉 악화 완화 · 내부출혈 해결 아님</div>`;
      // TRAUMA-REFINE-1 §12: 장기/혈관 후보 표시 — 상위 후보만, "확정" 대신 의심/가능성/감시 표현
      const oimD = w.organInjuryModel;
      if (oimD && oimD.topCandidates && oimD.topCandidates.length) {
        const ORGAN_KO = { lung:'폐', pleura:'흉막', thoracic_vessel:'흉부 혈관', heart_hook_only:'심장 인접 고위험 궤적', liver:'간', spleen:'비장', kidney:'신장', stomach:'위', bowel:'장', bladder:'방광', abdominal_vessel:'복부 혈관', iliac_vessel:'장골혈관', femoral_vessel:'대퇴혈관', axillary_vessel:'액와혈관', carotid_jugular:'경동·경정맥', airway:'기도', cervical_spine:'경추', pelvic_bleed:'골반 출혈', retroperitoneal_bleed:'후복막 출혈', limb_bone:'사지 골', muscle_bleed:'근육 출혈' };
        const ST_KO = { candidate:'가능성', suspected:'의심', likely:'가능성 높음', confirmed_limited:'제한적 확인' };
        const parts = oimD.topCandidates.map(tc => {
          if (tc.monitorOnly) return `${ORGAN_KO[tc.organ] || tc.organ} — 감시 필요`;
          const hot = (tc.clinicalPriority === 'critical' || tc.clinicalPriority === 'high');
          return `${ORGAN_KO[tc.organ] || tc.organ} ${ST_KO[tc.status] || tc.status}${hot ? ' 높음' : ''}`;
        });
        html += `<div class="med-detail-row" style="font-size:9px;color:#c8a060;">장기/혈관 후보: ${parts.join(' · ')}</div>`;
        if (oimD.surgeryRequiredCandidate) html += `<div class="med-detail-row" style="font-size:9px;color:#d4845a;">현장처치 한계 — 수술/후송 후보</div>`;
      }
      // SIDE-MEDICAL-ORGAN-BLEEDING-1 §9: 확정 / 강한 의심 / 후보 구분 + 내부출혈 분류 + 후송/처치 표식
      const cimD = w.confirmedInjuryModel;
      if (cimD) {
        const INJ_KO = { lung_injury_confirmed:'폐 손상', open_chest_wound_confirmed:'개방성 흉부창', heart_injury_confirmed:'심장 손상', lung_injury_probable:'폐 손상', pneumothorax_probable:'기흉', hemothorax_probable:'혈흉', heart_injury_probable:'심장 손상', subclavian_vessel_injury_probable:'쇄골하혈관 손상', axillary_vessel_injury_probable:'액와혈관 손상', solid_organ_injury_probable:'실질장기 손상', hollow_viscus_injury_probable:'중공장기 손상', kidney_injury_probable:'신장 손상', retroperitoneal_bleeding_probable:'후복막 출혈', abdominal_internal_bleeding_probable:'복강 내부출혈', junctional_hemorrhage_probable:'접합부 대량출혈', femoral_vessel_injury_probable:'대퇴혈관 손상', iliac_vessel_injury_probable:'장골혈관 손상', pelvic_bleeding_probable:'골반 출혈', skull_fracture_probable:'두개골 골절', tbi_probable:'외상성 뇌손상', eye_injury_probable:'안구 손상', airway_compromise_probable:'기도 손상', facial_bone_injury_probable:'안면골 골절' };
        const nmI = (id) => INJ_KO[id] || id;
        if (cimD.confirmed && cimD.confirmed.length) html += `<div class=\"med-detail-row\" style=\"font-size:10px;color:#e06a5a;font-weight:bold;\"><span>확정</span><b>${cimD.confirmed.map(nmI).join(', ')}</b></div>`;
        if (cimD.probable && cimD.probable.length) html += `<div class=\"med-detail-row\" style=\"font-size:9px;color:#d8a05a;\"><span>강한 의심</span><b>${cimD.probable.slice(0,5).map(nmI).join(', ')}</b></div>`;
        if ((!cimD.confirmed || !cimD.confirmed.length) && (!cimD.probable || !cimD.probable.length) && cimD.candidates && cimD.candidates.length) html += `<div class=\"med-detail-row\" style=\"font-size:9px;color:#a0a0a0;\"><span>후보</span><b>손상 후보만 (확정 아님)</b></div>`;
      }
      if (w.internalBleedingCategory) {
        const CAT_KO = { external_controllable:'외부출혈(통제가능)', external_severe:'외부출혈(심함)', junctional_limited_control:'접합부출혈(통제제한)', thoracic_internal:'흉강 내부출혈', abdominal_internal:'복강 내부출혈', retroperitoneal_internal:'후복막 출혈', pelvic_internal:'골반 내부출혈', cranial_neuro:'두부/신경 손상', airway_compromise:'기도 위협' };
        const isInternalCat = /internal|retroperitoneal|junctional|cranial|airway/.test(w.internalBleedingCategory);
        html += `<div class=\"med-detail-row\" style=\"font-size:9px;color:${isInternalCat?'#d47a6a':'#8ab0c8'};\"><span>내부출혈 분류</span><b>${CAT_KO[w.internalBleedingCategory] || w.internalBleedingCategory}</b></div>`;
        if (isInternalCat) html += `<div class=\"med-detail-row\" style=\"font-size:9px;color:#c88;\">현장 처치 제한적 — 후송 필요</div>`;
      }
      {
        const _dcT = [];
        if (w.surgeryRequiredCandidate) _dcT.push('수술 필요');
        if (w.transfusionRequiredCandidate) _dcT.push('수혈 필요');
        if (w.vascularControlRequiredCandidate) _dcT.push('혈관 통제');
        if (_dcT.length) html += `<div class=\"med-detail-row\" style=\"font-size:9px;color:#b090a0;\"><span>후송/처치 표식</span><b>${_dcT.join(', ')} (표시 전용)</b></div>`;
      }
      // PRECARDIAC-1 §11: 흉부 외상 위험 표시 (확정 아님 — 위험/의심 표현)
      const ctmD = w.chestTraumaModel;
      if (ctmD && (ctmD.openChestWound || (ctmD.pneumothoraxRisk || 0) > 0.2 || (ctmD.hemothoraxRisk || 0) > 0.2)) {
        const pn = (ctmD._pneumoProg != null ? ctmD._pneumoProg : ctmD.pneumothoraxRisk) || 0;
        const tn = ctmD.tensionPneumothoraxRisk || 0;
        const hm = ctmD.hemothoraxRisk || 0;
        const lvl = (v) => v >= 0.7 ? '높음' : v >= 0.4 ? '중간' : '낮음';
        let line = `기흉 위험: ${lvl(pn)}`;
        if (hm > 0.2) line += ` · 혈흉 위험: ${lvl(hm)}`;
        if (tn > 0.3) line += ` · 긴장성 의심`;
        html += `<div class="med-detail-row" style="font-size:9px;color:#c8a060;">${line}</div>`;
        if (ctmD.tensionStillPossible) html += `<div class="med-warning">긴장성 기흉 의심 — 체스트씰만으로 해결 불가 · 후속 처치 필요</div>`;
      }
      if (w.fieldCare.fieldCareClass === 'field_unmanageable') html += `<div class="med-warning">현장처치 불가 — 응급 억제 + 후송/수술 필요</div>`;
      else if (w.fieldCare.fieldCareClass === 'limited') html += `<div class="med-warning">현장처치 제한 — 후속 장기/수술 업데이트 필요</div>`;
      // SIDE-MED-PHYSIOLOGIC-INJURY-CONFIRM-1 §9: 확정 생리손상 — candidate와 분리(적색)
      const _physInj = (w.physiologicInjuries || []).filter(i => i.confirmedLevel === 'confirmed_physiologic');
      const _physRisk = (w.physiologicInjuries || []).filter(i => i.confirmedLevel === 'risk_only');
      if (_physInj.length || _physRisk.length) {
        if (_physInj.length) html += `<div class="med-detail-row" style="font-size:9px;color:#ff8a8a;font-weight:bold;">확정 생리손상: ${_physInj.map(i => _physInjuryLabelKo(i)).join(' · ')}</div>`;
        if (_physRisk.length) html += `<div class="med-detail-row" style="font-size:9px;color:#ffb060;">${_physRisk.map(i => _physInjuryLabelKo(i)).join(' · ')}</div>`;
        const _eff = _physEffectSummaryKo(w.physiologicEffectProfile);
        if (_eff) html += `<div class="med-detail-row" style="font-size:9px;color:#ffd0d0;">생리효과: ${_eff}</div>`;
        if ((w.physiologicTags || []).some(t => t === 'SURGERY-REQ' || t === 'EVAC-URGENT')) html += `<div class="med-warning">확정 생리손상 — 현장처치로 해결 불가 · 수술/긴급 후송 필요</div>`;
      }
      html += `</div>`;
    }
  }
  return html;
}
function renderMedTreatArea(treater, target) {
  const area = document.getElementById('medTreatArea');
  if (!area) return;
  const isSelf = (treater.id === target.id);
  const part = MEDIC_OVERLAY.selectedPart;
  const distPx = isSelf ? 0 : Math.hypot(treater.x - target.x, treater.y - target.y);
  const distM = pxToM(distPx);   // SIDE-METRIC-SCALE-1
  const inRange = isSelf || distM <= 2.0;

  let html = '';
  // 거리 안내
  if (!inRange) {
    html += `<div style="font-size:9px;color:#d4a04a;padding:3px 4px;margin-bottom:4px;background:#2a2418;border-radius:2px;border:1px solid #4a3a18;">
      거리 ${distM.toFixed(1)}m — 자동 접근
    </div>`;
  }
  // 2B-0-FINAL: 선택 클러스터 처치 (일괄 압박붕대만) 또는 선택 상처 처치 (압박붕대/체스트씰)
  const med = target.medical;
  if (med && med.wounds) {
    const selPartKey = resolveBodyPartKey(part, null);
    const rows = buildWoundDisplayRows(target, selPartKey);
    const cr = MEDIC_OVERLAY.selectedWoundGroupId ? rows.find(r => r.type === 'cluster' && r.groupId === MEDIC_OVERLAY.selectedWoundGroupId) : null;
    if (cr) {
      html += `<div class="med-treat-section-title">★ 묶음 상처: ${cr.representativeLabel}</div>`;
      const _clBtns = buildClusterTreatBtn(cr, target, treater, part, inRange);
      if (_clBtns) html += _clBtns;
      else html += `<div class="med-detail-row"><span style="color:#7a848c">일괄 처치 대상 없음 (모두 처치됨/출혈 없음/선행 지혈 필요)</span></div>`;
    } else {
      let w = med.wounds.find(x => x.id === MEDIC_OVERLAY.selectedWoundId);
      if (!w) { const sr = rows.find(r => r.type === 'single'); if (sr) w = sr.wound; }
      if (w) {
        const tp = w.treatmentProfile || {};
        html += `<div class="med-treat-section-title">★ 선택 상처: ${w.uiLabels.combinedLabel}</div>`;
        // === SIDE-MEDICAL-FIELDCARE-RESOURCE-1 §10: 처치 추천 계획 (1순위/후속/선택/비추천 + 자원 + 콤보/재출혈) ===
        try {
          const _plan = buildTreatmentRecommendationPlan(target, w, treater);
          const _KO = { tourniquet:'지혈대', pressure_bandage:'압박붕대', hemostatic:'지혈거즈', packing:'패킹', bandage:'붕대', splint:'부목', junctional_pressure:'접합부압박', chestseal:'체스트씰', needle_decompression:'감압침', airway:'기도확보', oxygen:'산소', pelvic_binder:'골반바인더', iv_fluid:'수액', blood_pack:'수혈', evacuation:'후송/후송표식' };
          const _lab = (a) => { const k = TREATMENT_RESOURCE_MAP[a]; const c = k ? getMedicalResourceCount(target, k) : null; return (_KO[a] || a) + (c != null ? ` x${c}` : ''); };
          const _line = (arr, color, tag) => arr.length ? `<div class="med-detail-row" style="font-size:9px;color:${color};"><span>${tag}</span><b>${arr.map(_lab).join(', ')}</b></div>` : '';
          html += `<div style="margin:2px 0 4px;padding:3px 4px;background:#181e24;border-radius:2px;">`;
          html += _line(_plan.primary, '#5ac85a', '1순위');
          html += _line(_plan.followUps, '#c8a85a', '후속');
          html += _line(_plan.optional, '#8ab0c8', '선택');
          if (_plan.notRecommended.length) html += `<div class="med-detail-row" style="font-size:9px;color:#c87a6a;"><span>비추천</span><b>${_plan.notRecommended.map(a => _KO[a] || a).join(', ')}${_plan.rationaleTags.indexOf('tourniquet_not_first_line_junctional') >= 0 ? ' (접합부엔 제한적)' : ''}</b></div>`;
          const _ce = (w.treatmentState && w.treatmentState.comboEffects) || null;
          const _rr = (w.treatmentState && w.treatmentState.recurrenceRisk);
          if (_ce && _ce.comboTags && _ce.comboTags.length) {
            const _last = _ce.lastCombo ? _ce.lastCombo.replace(/tourniquet/g,'지혈대').replace(/hemostatic/g,'지혈거즈').replace(/packing/g,'패킹').replace(/pressure/g,'압박').replace(/chestseal/g,'체스트씰').replace(/decompression/g,'감압').replace(/\+/g,' + ') : '';
            if (_last) html += `<div class="med-detail-row" style="font-size:9px;color:#7ac87a;"><span>콤보</span><b>${_last}</b></div>`;
          }
          if (_rr != null) { const _rk = _rr >= 0.5 ? '높음' : _rr >= 0.3 ? '중간' : '낮음'; const _rc = _rr >= 0.5 ? '#d47a6a' : _rr >= 0.3 ? '#c8a85a' : '#7ac87a'; html += `<div class="med-detail-row" style="font-size:9px;color:${_rc};"><span>재출혈 위험</span><b>${_rk}</b></div>`; }
          if (_plan.sequenceStage === 'evac_required' || _plan.rationaleTags.indexOf('cavity_internal_no_field_control') >= 0) html += `<div class="med-detail-row" style="font-size:9px;color:#d47a6a;">현장 처치 제한적 — 후송 필요</div>`;
          html += `</div>`;
        } catch (e) {}
        const rec = (tp.recommendedActions && tp.recommendedActions[0]) || null;
        // SIDE-MED-2C-HOTFIX-1 §1/§2: 적응증(treatmentIndicationTags + trauma model) 기반 처치 구성, TCCC 순서.
        const tags = w.treatmentIndicationTags || [];
        const bp = w.bleedingProfile || {};
        const hcm = w.hemorrhageControlModel || {};
        const ctm = w.chestTraumaModel || null;
        const otm = w.openTorsoModel || null;
        const isCavityOnly = (bp.bleedingType === 'cavity');
        const ctrlBy = hcm.controllableBy || [];
        const woundActs = [];
        // pressure_bandage
        if (tp.pressureBandageEligible || tags.includes('pressureBandageCandidate') || (bp.currentExternal > 0 && (w.fieldCare && w.fieldCare.fieldCareClass !== 'field_unmanageable'))) woundActs.push('pressure_bandage');
        // hemostatic — cavity 단독 wound 제외
        if (!isCavityOnly && (tags.includes('hemostaticCandidate') || ctrlBy.includes('hemostatic'))) woundActs.push('hemostatic');
        // packing — cavity 단독 wound 제외
        if (!isCavityOnly && (tags.includes('packingCandidate') || ctrlBy.includes('packing'))) woundActs.push('packing');
        // junctional_pressure — 접합부 (limb proper 제외)
        if (tags.includes('junctionalPressureCandidate') || hcm.hemorrhageType === 'junctional' || tags.includes('tourniquetLimited')) woundActs.push('junctional_pressure');
        // chestseal — open chest 중심 (chest hit만으로 무조건 X)
        if (tp.chestSealEligible || tags.includes('chestSealCandidate') || (ctm && (ctm.openChestWound || ctm.chestSealIndicated))) woundActs.push('chestseal');
        // abdominal_dressing — 열린 복부 wound (cavity 내부출혈만 있으면 X)
        if (tags.includes('abdominalDressingCandidate') || (otm && (otm.openAbdominalWound || otm.abdominalWallDisruption || otm.eviscerationRisk))) woundActs.push('abdominal_dressing');
        if (!woundActs.length) html += `<div class="med-detail-row"><span style="color:#7a848c">이 상처에 적용할 개별 처치 없음 (출혈 없음/둔상/체강 내부출혈은 후송 필요)</span></div>`;
        // 추천 처치 판단 — recommendedAction / controlUrgency
        const ta = (target.medical && target.medical.tcccAssessment) || {};
        const recAct = ta.recommendedAction;
        const recType = (recAct === 'chest_seal') ? 'chestseal' : (recAct === 'hemorrhage_control' ? (woundActs.includes('packing') ? 'packing' : woundActs.includes('hemostatic') ? 'hemostatic' : 'pressure_bandage') : null);
        // === HOTFIX §2/§10: 추천 계획을 실제 버튼에 연결 (tier 부여 + 누락 추천 추가 + 정렬) ===
        try {
          const _plan = buildTreatmentRecommendationPlan(target, w, treater);
          const _WOUND_ACTS = ['pressure_bandage','hemostatic','packing','junctional_pressure','chestseal','abdominal_dressing','bandage'];
          // normalize된 plan key → wound 버튼 action key (동일 계열만 wound 버튼으로)
          const _planToBtn = (a) => { const n = normalizeTreatmentActionKey(a); return _WOUND_ACTS.indexOf(n) >= 0 ? n : (n === 'bandage' ? 'bandage' : null); };
          // plan에 있으나 woundActs에 없는 wound-적용 처치 추가
          const _addFrom = (arr) => { for (const a of arr) { const b = _planToBtn(a); if (b && woundActs.indexOf(b) < 0) woundActs.push(b); } };
          _addFrom(_plan.primary); _addFrom(_plan.followUps); _addFrom(_plan.optional);
          // bandage는 마감 처치 — 항상 옵션으로 보이게
          if (woundActs.indexOf('bandage') < 0) woundActs.push('bandage');
          // tier 결정
          const _tierOf = (t) => {
            if (isTreatmentAlreadyApplied(w, t)) return 'completed';
            if (_plan.primary.some(a => normalizeTreatmentActionKey(a) === t)) return 'primary';
            if (_plan.followUps.some(a => normalizeTreatmentActionKey(a) === t)) return 'followUp';
            if (_plan.optional.some(a => normalizeTreatmentActionKey(a) === t)) return 'optional';
            if (_plan.notRecommended.some(a => normalizeTreatmentActionKey(a) === t)) return 'notRecommended';
            return 'none';
          };
          const _order = { primary:0, followUp:1, optional:2, none:3, notRecommended:4, completed:5 };
          const _uniq = Array.from(new Set(woundActs));
          _uniq.sort((a, b) => (_order[_tierOf(a)] - _order[_tierOf(b)]));
          for (const t of _uniq) {
            const tier = _tierOf(t);
            const isRec = (tier === 'primary');
            html += buildWoundTreatBtn(t, w, target, treater, part, inRange, isRec, tier);
          }
        } catch (e) {
          for (const t of woundActs) {
            const isRec = (t === rec) || (t === recType) || ((hcm.controlUrgency === 'immediate' || hcm.controlUrgency === 'high') && (t === 'tourniquet' || t === recType));
            html += buildWoundTreatBtn(t, w, target, treater, part, inRange, isRec);
          }
        }
      }
    }
  }
  // 2B-0-FINAL §7: 부위 전체 처치 — 지혈대 중심 (부목/골반바인더/쇼크케어 숨김)
  // HOTFIX2 §2/§3/§12: 선택 wound 계획으로 부위/안정화 버튼 tier 결정
  let _selPlan = null; try { const _pr = getSelectedWoundTreatmentPlan(target, treater, MEDIC_OVERLAY && MEDIC_OVERLAY.selectedPart, MEDIC_OVERLAY && MEDIC_OVERLAY.selectedWoundId); _selPlan = _pr && _pr.plan; } catch (e) {}
  const available = getAvailableTreatmentsForPart(target, part);
  html += `<div class="med-treat-section-title">▶ ${BODY_PART_KOR[part]||part} 부위 처치</div>`;
  // TRAUMA-REFINE-1 §4: 부위 처치 = 지혈대 + 부목 (사지). 부목은 골절+미부목이면 추천.
  const partOnly = available.filter(t => t === 'tourniquet' || (t === 'splint' && isLimbPart(part)));
  for (const type of partOnly) {
    const _tier = _selPlan ? getPlanTierForButton(_selPlan, type) : 'none';
    const isRec = (_tier === 'primary') || (type === 'splint' && isPartFractured(target, part) && !isPartSplinted(target, part));
    html += buildTreatBtn(type, target, treater, part, inRange, isRec, _tier);
  }
  // 지혈대 해제/재평가 — 적용돼 있을 때만
  if (target.tourniquetActive) html += buildTreatBtn('remove_tourniquet', target, treater, part, inRange, false);
  if (!partOnly.length && !target.tourniquetActive) html += `<div class="med-detail-row"><span style="color:#7a848c">이 부위 전체 처치 없음 (지혈대는 사지 출혈에만)</span></div>`;
  // TRAUMA-REFINE-1 §4/§5: 전신 처치 섹션 — 진통제 (통증/패널티 완화 전용, 출혈·혈압·내부손상 치료 아님)
  html += `<div class="med-treat-section-title">▶ 전신 처치</div>`;
  for (const gType of getGlobalTreatments(target)) {
    const gRec = (gType === 'painkiller' && (target.medical && (target.medical.pain || 0) > 55) && !(target.painkillerActive) && (target.painkillerCooldown || 0) <= 0);
    html += buildTreatBtn(gType, target, treater, part, inRange, gRec);
  }
  // === FIELD-STAB-1 §15: 안정화 처치 섹션 — 원인 완화 (candidate일 때만 노출, 완치 아님) ===
  if (med && med.fieldStabilizationModel) {
    const fs = med.fieldStabilizationModel;
    const fsBtns = [];
    if (fs.airwaySupport.candidate || fs.airwaySupport.active) fsBtns.push('airway_support');
    if (fs.chestRelief.candidate || fs.chestRelief.active) fsBtns.push('chest_relief');
    if (fs.pelvicControl.candidate || fs.pelvicControl.active) fsBtns.push('pelvic_binder');
    if (fs.junctionalControl.candidate || fs.junctionalControl.active) fsBtns.push('junctional_control');
    if (fs.circulationSupport.candidate || fs.circulationSupport.active) fsBtns.push('circulation_support');
    fsBtns.push('mark_evac');
    if (fsBtns.length) {
      html += `<div class="med-treat-section-title">▶ 안정화 처치 (원인 완화 · 후송 bridge)</div>`;
      for (const fType of fsBtns) { const _t = _selPlan ? getPlanTierForButton(_selPlan, fType) : 'none'; html += buildTreatBtn(fType, target, treater, part, inRange, _t === 'primary', _t); }
    }
    // 후송 요약
    const ev = med.evacuationModel;
    if (ev && ev.evacuationPriority && ev.evacuationPriority !== 'none') {
      const pKor = { monitor:'관찰', priority:'우선', urgent:'긴급', immediate:'최우선' }[ev.evacuationPriority] || ev.evacuationPriority;
      const pCls = (ev.evacuationPriority === 'immediate' || ev.evacuationPriority === 'urgent') ? 'bad' : (ev.evacuationPriority === 'priority' ? 'warn' : '');
      html += `<div class="med-detail-row"><span>후송 EVAC</span><b class="${pCls}">${pKor}${ev.definitiveCareRequired ? ' · 확정처치 필요' : ''}</b></div>`;
    }
  }
  area.innerHTML = html;

  // 끌기 버튼
  const dragBtn = document.getElementById('medDragBtn');
  const stopDragBtn = document.getElementById('medStopDragBtn');
  if (dragBtn && stopDragBtn) {
    const canDrag = !isSelf && target.isDowned && !target.isDead && treater.draggingTarget == null && !treater.isDowned;
    const currentlyDragging = treater.draggingTarget === target.id;
    dragBtn.style.display = (canDrag && !currentlyDragging) ? '' : 'none';
    dragBtn.disabled = false;
    dragBtn.title = inRange ? '' : '거리 밖 — 클릭 시 자동 접근';
    stopDragBtn.style.display = currentlyDragging ? '' : 'none';
  }
}

function renderMedicDetail() {
  // 호환용 — 새 구조에서는 renderMedicOverlay가 모든 패널 갱신
  renderMedicOverlay();
}

// SIDE-MED-2C-HOTFIX-1 §3/§9: 선택 wound 처치 버튼 (MED-2C 처치 전체)
function buildWoundTreatBtn(type, wound, target, treater, part, inRange, isRec, tier) {
  const isSelf = (treater.id === target.id);
  const labels = { pressure_bandage:'압박붕대', hemostatic:'지혈거즈', packing:'상처 패킹', junctional_pressure:'접합부 압박', chestseal:'체스트씰', abdominal_dressing:'복부 드레싱', bandage:'붕대' };
  const ts = wound.treatmentState || {};
  const done = { pressure_bandage:ts.pressureBandaged, hemostatic:ts.hemostaticApplied, packing:ts.packed, junctional_pressure:ts.junctionalPressureApplied, chestseal:ts.chestSealed, abdominal_dressing:ts.abdominalDressed, bandage:!!ts.bandageApplied }[type];   // [CLOSURE 목표A] 일반 붕대 done = bandageApplied 단독
  const fc = wound.fieldCare.fieldCareClass;
  const bt = wound.bleedingProfile.bleedingType;
  const big = (wound.woundSize.sizeClass === 'large' || wound.woundSize.sizeClass === 'massive');
  let desc;
  if (type === 'pressure_bandage') {
    desc = '외출혈 강력 억제 · 시간 경과 안정화';
    if (bt === 'junctional') desc = '접합부 — 효과 제한 / 잔여 출혈';
    else if (fc === 'limited' || fc === 'field_unmanageable' || big) desc = '외출혈 억제 · 대형/제한 상처 잔여 출혈 가능';
  } else if (type === 'hemostatic') {
    desc = '접근 가능한 외부/근육층 출혈 감소';
    if (bt === 'junctional') desc = '접합부 출혈 보조 · 패킹/압박과 조합 권장';
    else if (bt === 'cavity') desc = '체강 내부출혈 직접 효과 없음';
  } else if (type === 'packing') {
    desc = '깊은 상처길/접합부 출혈 패킹 · 압박 추가 권장';
    if (ts.hemostaticApplied) desc = '지혈거즈와 조합 효과 · 압박 추가 권장';
    else if (bt === 'cavity') desc = '체강 내부출혈 직접 효과 없음';
  } else if (type === 'junctional_pressure') {
    desc = '접합부 출혈 일시 압박 · 유지/재출혈 위험';
  } else if (type === 'chestseal') {
    desc = '개방성 흉부상 안정화 · 공기 유입/기흉 악화 완화 · 내부출혈 해결 아님';
  } else if (type === 'abdominal_dressing') {
    desc = '열린 복부 상처 보호 · 오염/노출 위험 완화 · 내부출혈 해결 아님';
  } else if (type === 'bandage') {
    desc = '마감/고정 처치 · 심한 출혈 단독 해결 아님';
    if (ts.hemostaticApplied || ts.packed || ts.pressureBandaged || ts.tourniquetApplied) desc = '고정 완료 · 재출혈 위험 감소';
  } else desc = '';
  let disabled = false, reason = '';
  if (done) { disabled = true; reason = '이미 적용됨'; }
  if (target.beingTreatedBy != null && target.beingTreatedBy !== treater.id) { disabled = true; reason = '다른 처치 진행 중'; }
  if (treater.treatmentTimer > 0) { disabled = true; reason = '처치자 작업 중'; }
  // §7 under_fire care phase 제한 — 지혈대/압박 외 제한
  try {
    const phase = getTcccCarePhase(target, treater, null);
    if (phase === 'under_fire' && !isTreatmentAllowedInPhase(type, phase)) { disabled = true; reason = '전투 중 처치 제한'; }
  } catch (e) {}
  // SIDE-MEDICAL-FIELDCARE-RESOURCE-1 §16: 자원 0이면 disabled + 수량 표시
  const _rk = TREATMENT_RESOURCE_MAP[type]; const _rc = _rk ? getMedicalResourceCount(target, _rk) : null;
  if (_rk && (_rc||0) <= 0) { disabled = true; reason = '자원 없음 (' + _rk + ')'; }
  const _rcTxt = (_rc != null) ? (' x' + _rc) : '';
  const _tierTag = tier==='primary'?'[1순위] ':tier==='followUp'?'[후속] ':tier==='optional'?'[선택] ':tier==='notRecommended'?'[비추천] ':tier==='completed'?'[완료] ':'';
  const dur = getTreatmentDuration(type, isSelf, target, treater);
  let _dispDur = dur;
  try { if (typeof getTreatmentQuality === 'function') { const _tqB = getTreatmentQuality(treater, target, wound, type); _dispDur = dur * Math.max(0.6, Math.min(2.0, _tqB.timeMultiplier || 1)); } } catch (e) {}
  return `<button class="med-treat-btn${isRec ? ' recommended' : ''}" data-treat="${type}" data-part="${part}" data-wound-id="${wound.id}" ${disabled ? 'disabled' : ''}>
    <span>${_tierTag}${labels[type] || type}${_rcTxt} ${isRec ? '★' : ''}<br><span class="med-treat-btn-meta">${disabled && reason ? reason : desc}</span></span>
    <span class="med-treat-btn-meta">${_dispDur > 0 ? _dispDur.toFixed(1) + 's' : '-'}</span>
  </button>`;
}
// 2B-0-FINAL §16: 클러스터 일괄 압박붕대 버튼
// [HOTFIX 마감] action별 cluster 버튼 1개 — buildClusterTreatmentPlan(UI=실행 동일 계산) 사용.
//   pressure_bandage / bandage 각각 자신의 eligible·자원·시간을 표시. 대상 0이면 버튼 미표시.
function _buildOneClusterTreatBtn(clusterId, actionType, label, hint, target, treater, part) {
  const plan = buildClusterTreatmentPlan(target.medical, clusterId, actionType);
  if (!plan.ok || plan.eligibleCount <= 0) return '';
  const isSelf = (treater.id === target.id);
  const need = plan.required;
  const have = getMedicalResourceCount(target, plan.resKey);
  let disabled = false, reason = '';
  if (target.beingTreatedBy != null && target.beingTreatedBy !== treater.id) { disabled = true; reason = '다른 처치 진행 중'; }
  else if (treater.treatmentTimer > 0) { disabled = true; reason = '처치자 작업 중'; }
  else if (need > 0 && have < need) { disabled = true; reason = `자원 부족 — 보유 ${have} / 필요 ${need}`; }
  const base = getTreatmentDuration(actionType, isSelf, target, treater);
  const dur = base * (1 + Math.min(20, plan.eligibleCount) * 0.045);
  const cls = (actionType === 'pressure_bandage') ? 'med-treat-btn recommended' : 'med-treat-btn';
  return `<button class="${cls}" data-treat="${actionType}" data-part="${part}" data-group-id="${clusterId}" data-cluster-count="${plan.eligibleCount}" ${disabled ? 'disabled' : ''}>
    <span>${label} ×${plan.eligibleCount} · 필요 ${need} / 보유 ${have}<br><span class="med-treat-btn-meta">${disabled && reason ? reason : hint}</span></span>
    <span class="med-treat-btn-meta">${dur > 0 ? dur.toFixed(1) + 's' : '-'}</span>
  </button>`;
}
function buildClusterTreatBtn(cluster, target, treater, part, inRange) {
  // 압박붕대(외부출혈 통제) + 일반 붕대(마감/고정) 각각 별도 계획·버튼. 각자 eligible 있을 때만 노출.
  let out = '';
  out += _buildOneClusterTreatBtn(cluster.groupId, 'pressure_bandage', '일괄 압박붕대', '넓은 표면 압박 — 외부출혈 통제 · 자원 일괄 소모', target, treater, part);
  out += _buildOneClusterTreatBtn(cluster.groupId, 'bandage', '일괄 붕대 마감', '통제된/경미 상처 마감·고정 · 자원 일괄 소모', target, treater, part);
  return out;
}

function buildTreatBtn(type, target, treater, part, inRange, isRec, tier = 'none') {
  const isSelf = (treater.id === target.id);
  const labels = { painkiller:'진통제', tourniquet:'지혈대', remove_tourniquet:'지혈대 해제',
                   bandage:'붕대', splint:'부목',
                   shockcare:'쇼크 관리', chestseal:'체스트 씰',
                   airway_support:'기도 보조', chest_relief:'흉부 압력 완화', pelvic_binder:'골반 고정',
                   junctional_control:'junctional 출혈 제어', circulation_support:'순환 보조', mark_evac:'후송 표시' };
  // 진통제 동적 설명 (게이지/cooldown 표시)
  let pkDesc = 'pain 감소 / 출혈은 안 막음';
  if (type === 'painkiller') {
    const lvl = Math.round(target.analgesiaLevel || 0);
    const cd = Math.round(target.painkillerCooldown || 0);
    if (cd > 0) pkDesc = `재투여 가능 ${cd}s 후`;
    else if (lvl > 0) pkDesc = `진통 효과 ${lvl}% (중첩 가능)`;
  }
  // 지혈대 해제 동적 설명 — 출혈 상태에 따라 경고
  let rtDesc = '지혈대 제거';
  if (type === 'remove_tourniquet') {
    const b = target.bleeding;
    if (b === 'heavy' || b === 'critical') rtDesc = '⚠ 해제 시 과다출혈 재발 위험';
    else if (b === 'light') rtDesc = '출혈 경미 — 비교적 안전';
    else rtDesc = '출혈 없음 — 안전';
  }
  const desc = {
    painkiller: pkDesc + ' · 출혈/혈압 치료 아님',
    tourniquet: '사지 출혈 — 큰 출혈 통제',
    remove_tourniquet: rtDesc,
    bandage:    '출혈 완화 / 시간 김',
    splint:     '골절 안정화 · 이동/조준 패널티 완화 · 출혈 치료 아님',
    shockcare:  '쇼크/의식 보조 / 출혈 안 막음',
    chestseal:  '흉부 관통상 기록 (예정 — 내부출혈/혈압 효과 없음)',
    airway_support: '기도/산소 보조 (제한적) · 출혈/내부손상 치료 아님',
    chest_relief: '긴장성 기흉 진행 억제 (제한적) · 폐손상/혈흉 미해결',
    pelvic_binder: '골반 외부출혈 완화 (제한적) · 체강 내부출혈 미해결',
    junctional_control: 'junctional 박동성 출혈 억제 · 이동 시 재발',
    circulation_support: '순환 보조 (현장 제한) · 즉시 회복 아님 · 후송 필요',
    mark_evac: '후송 우선순위 표시 (처치 효과 없음)',
  };
  // 자가 처치 차단 조건 — 범위 밖이어도 클릭 가능 (접근 후 자동 실행)
  let disabled = false;
  let disabledReason = '';
  if (isSelf && (type === 'shockcare' || type === 'splint')) {
    disabled = true; disabledReason = '자가 처치 불가';
  }
  if (type === 'tourniquet' && !isLimbPart(part)) {
    disabled = true; disabledReason = '사지에만 적용';
  }
  if (type === 'splint' && !isLimbPart(part)) {
    disabled = true; disabledReason = '사지에만 적용';
  }
  if (type === 'splint' && !isPartFractured(target, part)) {
    disabled = true; disabledReason = '골절 없음';
  }
  if (type === 'chestseal' && part !== 'chest') {
    disabled = true; disabledReason = '가슴 전용';
  }
  if (type === 'chestseal' && !target.chestPenetrating) {
    disabled = true; disabledReason = '흉부 관통상 없음';
  }
  if (type === 'painkiller') {
    if ((target.painkillerCooldown || 0) > 0) {
      disabled = true; disabledReason = `재투여 cooldown ${Math.round(target.painkillerCooldown)}s`;
    }
    if ((target.analgesiaLevel || 0) >= 85) {
      disabled = true; disabledReason = '진통 효과 최대';
    }
  }
  if (type === 'remove_tourniquet' && !target.tourniquetActive) {
    disabled = true; disabledReason = '지혈대 없음';
  }
  // FIELD-STAB-1: field action 게이팅 — phase + candidate
  if (typeof FIELD_STAB_ACTIONS !== 'undefined' && FIELD_STAB_ACTIONS.indexOf(type) >= 0) {
    let _ph = 'tactical_field_care';
    try { _ph = getTcccCarePhase(target, treater, null); } catch (e) {}
    if (typeof isFieldStabAllowedInPhase === 'function' && !isFieldStabAllowedInPhase(type, _ph)) {
      disabled = true; disabledReason = (type === 'circulation_support') ? '후송 단계에서 가능' : '현재 단계 제한';
    }
    const _fs = target.medical && target.medical.fieldStabilizationModel;
    if (_fs && type !== 'mark_evac') {
      const map = { airway_support:'airwaySupport', chest_relief:'chestRelief', pelvic_binder:'pelvicControl', junctional_control:'junctionalControl', circulation_support:'circulationSupport' };
      const node = _fs[map[type]];
      if (node && !node.candidate && !node.active) { disabled = true; disabledReason = '적응증 아님'; }
      if (node && node.active) { disabled = true; disabledReason = '이미 적용됨'; }
    }
    if (isSelf && (type === 'circulation_support' || type === 'chest_relief')) { disabled = true; disabledReason = '자가 처치 불가'; }
  }
  if (type === 'splint' && isPartSplinted(target, part)) {
    disabled = true; disabledReason = '이 부위 이미 고정됨';
  }
  // TRAUMA-REFINE-1 §8: TCCC phase 게이팅 — under_fire에서는 지혈대/압박/해제 외 제한 (부목/진통제 포함)
  try {
    const _phase = getTcccCarePhase(target, treater, null);
    if (_phase === 'under_fire' && !isTreatmentAllowedInPhase(type, _phase)) {
      disabled = true; disabledReason = '전투 중 처치 제한';
    }
  } catch (e) {}
  if (target.beingTreatedBy != null && target.beingTreatedBy !== treater.id) {
    disabled = true; disabledReason = '다른 처치 진행 중';
  }
  if (treater.treatmentTimer > 0) {
    disabled = true; disabledReason = '처치자 다른 작업 중';
  }
  // SIDE-MEDICAL-FIELDCARE-RESOURCE-1 §16 + HOTFIX2 §5/§6: 자원 게이트 (순환/기도는 동적 선택과 일치)
  let _rk = TREATMENT_RESOURCE_MAP[type]; let _rc = _rk ? getMedicalResourceCount(target, _rk) : null; let _rcTxt = (_rc != null) ? (' x' + _rc) : '';
  if (type === 'circulation_support') {
    let _selW = null; try { _selW = _selectTreatWound(target.medical, (typeof MEDIC_OVERLAY !== 'undefined' && MEDIC_OVERLAY.selectedPart) ? resolveBodyPartKey(MEDIC_OVERLAY.selectedPart, null) : null, (typeof MEDIC_OVERLAY !== 'undefined' && MEDIC_OVERLAY.selectedWoundId) || null); } catch (e) {}
    const _cr = resolveCirculationResource(target, _selW);
    if (!_cr) { disabled = true; disabledReason = '자원 없음: 혈액팩/수액'; _rcTxt = ''; }
    else { _rcTxt = (_cr === 'blood_pack' ? ': 혈액팩 x' + getMedicalResourceCount(target,'blood_pack') : ': 수액 x' + getMedicalResourceCount(target,'iv_fluid')); }
  } else if (type === 'airway_support') {
    let _selW = null; try { _selW = _selectTreatWound(target.medical, (typeof MEDIC_OVERLAY !== 'undefined' && MEDIC_OVERLAY.selectedPart) ? resolveBodyPartKey(MEDIC_OVERLAY.selectedPart, null) : null, (typeof MEDIC_OVERLAY !== 'undefined' && MEDIC_OVERLAY.selectedWoundId) || null); } catch (e) {}
    const _ar = resolveAirwayResource(target, _selW);
    if (!_ar.length) { disabled = true; disabledReason = '자원 없음: 기도확보/산소'; _rcTxt = ''; }
    else { _rcTxt = ': ' + _ar.map(r => r === 'airway_basic' ? '기도확보' : '산소').join(' + '); }
  } else if (_rk && (_rc||0) <= 0) { disabled = true; disabledReason = '자원 없음 (' + _rk + ')'; }
  const _tierTag = tier==='primary'?'[1순위] ':tier==='followUp'?'[후속] ':tier==='optional'?'[선택] ':tier==='notRecommended'?'[비추천] ':tier==='completed'?'[완료] ':'';
  const dur = getTreatmentDuration(type, isSelf, target, treater);
  let _dispDur = dur;
  try { if (typeof getTreatmentQuality === 'function') { const _wq = _selectTreatWound(target.medical, (typeof MEDIC_OVERLAY!=='undefined'&&MEDIC_OVERLAY.selectedPart)?resolveBodyPartKey(MEDIC_OVERLAY.selectedPart,null):null, (typeof MEDIC_OVERLAY!=='undefined'&&MEDIC_OVERLAY.selectedWoundId)||null); const _tqB = getTreatmentQuality(treater, target, _wq, type); _dispDur = dur * Math.max(0.6, Math.min(2.0, _tqB.timeMultiplier || 1)); } } catch (e) {}
  return `<button class="med-treat-btn${isRec ? ' recommended' : ''}"
    data-treat="${type}" data-part="${part}" ${disabled ? 'disabled' : ''}>
    <span>${_tierTag}${labels[type] || type}${_rcTxt} ${isRec ? '★' : ''}<br><span class="med-treat-btn-meta">${disabled && disabledReason ? disabledReason : desc[type] || ''}</span></span>
    <span class="med-treat-btn-meta">${_dispDur > 0 ? _dispDur.toFixed(1) + 's' : '-'}</span>
  </button>`;
}

// === 이벤트 ===
