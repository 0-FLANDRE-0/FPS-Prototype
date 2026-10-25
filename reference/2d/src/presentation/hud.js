// 13. UI
// =============================================================
function refreshUI() {
  renderRoster();
  renderUnitCard();
  updateFacingButton();
  updateClearButton();
  updatePlayPauseButton();
  updatePlacementButton();
  if (typeof renderPlaceEditor === 'function') renderPlaceEditor();
  updateMissionPill();
  updateHint();
  if (medicMenuTarget != null) refreshMedicMenu();
}
// 배치 패널 + 버튼 토글 상태 갱신
function updatePlacementButton() {
  const btn = document.getElementById('btnPlaceMode');
  const panel = document.getElementById('placePanel');
  if (!btn || !panel) return;
  const allowed = isPlacementAllowed();
  btn.classList.toggle('disabled', !allowed);
  if (!allowed && GAME.placementMode) GAME.placementMode = false;
  btn.classList.toggle('on', !!GAME.placementMode);
  panel.classList.toggle('on', !!GAME.placementMode);
  // 대상 버튼 active
  panel.querySelectorAll('.place-btn[data-pt]').forEach(b => {
    b.classList.toggle('on', b.dataset.pt === GAME.placementType);
  });
  // cover 종류 동적 렌더 — 현재 카테고리에 맞는 preset만 표시
  const coverBtns = document.getElementById('placeCoverBtns');
  const coverRow = document.getElementById('placeCoverRow');
  if (coverBtns && coverRow) {
    const isCoverMode = (GAME.placementType === 'fullCover' || GAME.placementType === 'halfCover');
    coverRow.style.display = isCoverMode ? '' : 'none';
    if (isCoverMode) {
      const ids = Object.keys(PLACEMENT_COVERS).filter(k => PLACEMENT_COVERS[k].category === GAME.placementType);
      const cur = GAME.placementCoverId;
      let html = '';
      for (const id of ids) {
        const p = PLACEMENT_COVERS[id];
        const on = (id === cur) ? ' on' : '';
        html += `<button class="place-btn${on}" data-cover-id="${id}">${p.label}</button>`;
      }
      coverBtns.innerHTML = html;
    }
  }
  // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 바닥 행 — floorPaint/floorErase 모드에서만 + 재질 활성 + 브러시 라벨
  const floorRow = document.getElementById('placeFloorRow');
  if (floorRow) {
    const isFloorMode = (GAME.placementType === 'floorPaint' || GAME.placementType === 'floorErase');
    floorRow.style.display = isFloorMode ? '' : 'none';
    if (isFloorMode) {
      floorRow.querySelectorAll('.place-btn[data-floor]').forEach(b => b.classList.toggle('on', b.dataset.floor === GAME.placementFloorMaterial));
      const bb = document.getElementById('btnFloorBrush');
      if (bb) bb.textContent = '브러시: ' + ({ small: '소', medium: '중', large: '대' }[GAME.placementBrushSize] || '중');
    }
  }
  // 편집 행 — 선택된 cover가 있을 때만
  const editRow = document.getElementById('placeEditRow');
  if (editRow) editRow.style.display = (GAME.selectedCoverId != null) ? '' : 'none';
}
function renderRoster() {
  const el = document.getElementById('rosterBar');
  let html = '<div class="roster-title">아군 대원</div>';
  for (const u of UNITS) {
    if (u.team !== 'friend') continue;
    const sel = (u.id === GAME.selectedId) ? ' selected' : '';
    const dead = u.isDead ? ' dead' : '';
    const hpRatio = Math.max(0, u.hp / u.maxHp);
    const hpClass = hpRatio > 0.5 ? '' : (hpRatio > 0.25 ? 'warn' : 'danger');
    const pinned = u.pinned ? '<span class="roster-pinned">PIN</span>' : '';
    // 상태 배지 — 주 배지 (큰 상태) + 보조 배지 (출혈/골절/처치/끌기)
    let badges = '';
    if (u.isDead)                          badges += '<span class="roster-badge bd-dead">DEAD</span>';
    else if (u.isDowned && !u.conscious)   badges += '<span class="roster-badge bd-uncon">UNCON</span>';
    else if (u.isDowned)                   badges += '<span class="roster-badge bd-down">DOWN</span>';
    else if (u.combatState === 'wounded')  badges += '<span class="roster-badge bd-wound">WOUND</span>';
    // 보조 배지 — 살아있을 때만
    if (!u.isDead) {
      if (u.bleeding === 'critical')       badges += '<span class="roster-badge bd-bleed">CRIT</span>';
      else if (u.bleeding === 'heavy')     badges += '<span class="roster-badge bd-bleed">HBLD</span>';
      else if (u.bleeding === 'light')     badges += '<span class="roster-badge bd-bleed">BLED</span>';
      if (u.fracture && u.fracture !== 'none') badges += '<span class="roster-badge bd-fx">FX</span>';
      if (u.painkillerActive)              badges += '<span class="roster-badge bd-pkill">PK</span>';
      if (u.treatmentTimer > 0)            badges += '<span class="roster-badge bd-treat">TRT</span>';
      else if (u.beingTreatedBy != null)   badges += '<span class="roster-badge bd-treat">CARE</span>';
      if (u.draggingTarget != null)        badges += '<span class="roster-badge bd-drag">DRAG</span>';
      else if (u.draggedBy != null)        badges += '<span class="roster-badge bd-drag">HAUL</span>';
    }
    html += `
      <div class="roster-item${sel}${dead}" data-id="${u.id}">
        <div class="roster-tag"></div>
        <div class="roster-name">${u.name}</div>
        ${badges}${pinned}
        <div class="roster-hp-bar"><div class="roster-hp-fill ${hpClass}" style="width:${hpRatio*100}%"></div></div>
      </div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.roster-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id, 10);
      const u = unitById(id);
      if (!u || u.isDead) return;   // dead 선택 불가, downed는 선택 가능 (수동 명령용)
      GAME.selectedId = (GAME.selectedId === id) ? null : id;
      GAME.selectedWpIdx = -1;
      GAME.facingMode = false;
      refreshUI();
    });
  });
}
function pathFacings(u) {
  if (!u.movePath.length) return '';
  let n = 0;
  for (const wp of u.movePath) if (wp.facing != null) n++;
  return n > 0 ? ` · 방향 ${n}` : '';
}

// SIDE-WEAPON-PLATFORM-1A §23.3/§23.4: 전투 패널 무기 슬롯/간섭/거치 표시 헬퍼
function _activeWpnBuildTag(u) {
  if (!u.weaponState) return '';
  const b = getActiveWeaponBuild(u);
  if (!b) return '';
  if (b.customModified) return ' <span style="color:#e0b060;font-size:9px">CUSTOM</span>';
  if (b.presetId && WEAPON_PRESET_REGISTRY[b.presetId]) return ` <span style="color:#7aa0c0;font-size:9px">${WEAPON_PRESET_REGISTRY[b.presetId].shortName}</span>`;
  return '';
}
function _activeWpnProfileRows(u) {
  if (!u.weaponState) return '';
  const prof = u._resolvedWeaponProfile || (typeof resolveActiveWeapon === 'function' ? resolveActiveWeapon(u) : null);
  if (!prof) return '';
  let h = '';
  const opt = WEAPON_OPTIC_REGISTRY[prof.opticId];
  h += `<div class="unit-row"><span class="unit-label">조준경</span><span class="unit-value">${opt ? opt.shortName : '-'}</span></div>`;
  h += `<div class="unit-row"><span class="unit-label">길이</span><span class="unit-value">${prof.obstructionLengthMm}mm · ${prof.lengthClass}</span></div>`;
  if (prof.noiseSignature && prof.noiseSignature.suppressed) h += `<div class="unit-row"><span class="unit-label">소음</span><span class="unit-value" style="color:#80c080">소음기</span></div>`;
  return h;
}
function buildWeaponSlotPanel(u) {
  if (!u.alive || u.team !== 'friend' || !u.weaponState) return '';
  const ws = u.weaponState;
  const prof = u._resolvedWeaponProfile || (typeof resolveActiveWeapon === 'function' ? resolveActiveWeapon(u) : null);
  const slotKor = ws.activeSlot === 'secondary' ? '보조무기' : '주무기';
  const wName = prof ? (WEAPON_PRESET_REGISTRY[prof.presetId] ? prof.resolvedName + ' ' + WEAPON_PRESET_REGISTRY[prof.presetId].shortName : (prof.customModified ? prof.resolvedName + ' CUSTOM' : prof.resolvedName)) : '';
  // 간섭/거치 상태
  let stateTxt = 'clear', stateColor = '#80c080';
  if (ws.mounted) { stateTxt = '거치'; stateColor = '#7ac0e0'; }
  else if (ws.obstructionState === 'hard_obstructed') { stateTxt = '총구 간섭'; stateColor = '#ff7070'; }
  else if (ws.obstructionState === 'near_obstructed') { stateTxt = '총구 근접'; stateColor = '#ffb060'; }
  else if (ws.obstructionState === 'friendly_obstructed') { stateTxt = '아군 전방'; stateColor = '#ffd060'; }
  // 전환 버튼
  const switchTo = ws.activeSlot === 'primary' ? 'secondary' : 'primary';
  let switchLabel = switchTo === 'secondary' ? '⇄ 보조무기' : '⇄ 주무기';
  const switchSlotUsable = (typeof isWeaponSlotUsable === 'function') ? isWeaponSlotUsable(u, switchTo) : true;
  const hasOtherSlot = switchTo === 'secondary' ? (ws.secondaryWeaponId && ws.secondaryWeaponId !== ws.primaryWeaponId) : !!ws.primaryWeaponId;
  if (hasOtherSlot && !switchSlotUsable) switchLabel += ' ✕';
  const switchDisabled = ws.switching || !hasOtherSlot || !switchSlotUsable || (typeof canSwitchWeapon === 'function' && !canSwitchWeapon(u));
  // 거치 버튼
  let mountLabel, mountDisabled, mountClass = '';
  if (ws.mounted) { mountLabel = '거치 해제'; mountDisabled = false; mountClass = ' on'; }
  else if (typeof canMountWeapon === 'function' && canMountWeapon(u)) { mountLabel = '▰ 거치'; mountDisabled = false; }
  else { mountLabel = '거치 불가'; mountDisabled = true; }
  let h = `<div class="unit-row" style="margin-top:4px"><span class="unit-label">무장</span><span class="unit-value" style="font-size:10px">${slotKor} ${wName} · <span style="color:${stateColor}">${stateTxt}</span></span></div>`;
  h += `<div class="wpn-slot-bar">`;
  h += `<button class="wpn-slot-btn" data-action="weaponSwitch" data-slot="${switchTo}"${switchDisabled ? ' disabled' : ''}>${switchLabel}${ws.switching ? ' …' : ''}</button>`;
  h += `<button class="wpn-slot-btn${mountClass}" data-action="weaponMount"${mountDisabled ? ' disabled' : ''}>${mountLabel}</button>`;
  h += `</div>`;
  // SIDE-WEAPON-INJURY-HANDLING-1: 팔 부상/의식/쓰러짐 운용 상태
  const inj = (typeof getWeaponInjuryStatus === 'function') ? getWeaponInjuryStatus(u) : null;
  if (inj) h = `<div class="unit-row"><span class="unit-label">운용</span><span class="unit-value" style="font-size:10px;color:${inj.color}">${inj.label}</span></div>` + h;
  return h;
}
function renderUnitCard() {
  const el = document.getElementById('unitInfo');
  if (!GAME.selectedId) {
    el.classList.add('empty');
    el.textContent = '대원을 선택하세요';
    syncGlobalActionButtons(null);
    return;
  }
  const u = unitById(GAME.selectedId);
  if (!u) {
    el.classList.add('empty');
    el.textContent = '대원을 선택하세요';
    syncGlobalActionButtons(null);
    return;
  }
  el.classList.remove('empty');
  const w = WEAPONS[u.weaponId];
  const ammo = AMMO_PRESETS[u.ammoId];
  const ba = BODY_ARMOR_PRESETS[u.bodyArmorId];
  const hm = HELMET_PRESETS[u.helmetId];
  const hpRatio = Math.max(0, u.hp / u.maxHp);
  const hpClass = hpRatio > 0.5 ? '' : (hpRatio > 0.25 ? 'warn' : 'danger');
  const stanceKor = getEffectiveStanceKor(u);
  const targetName = u.currentTarget ? u.currentTarget.name : '—';
  const status = !u.alive ? '<span style="color:#c64040">전투불능</span>' :
                 (u.pinned ? '<span style="color:#ff8a3a">PINNED</span>' :
                 (u.currentTarget ? '<span style="color:#ffd479">교전</span>' :
                 (u.movePath.length > 0 ? '<span style="color:#80c0ff">이동중</span>' : '대기')));

  // 경계 라벨
  const aimTypeKor = {
    visible:'교전', manual_fire:'지정 사격', wp_facing:'WP 경계',
    last_known:'최근 위치', threat:'위협 방향', move:'이동 방향',
    home:'복귀 방향', pinned:'제압됨', idle:'대기',
    noise:'소음 경계',
  };
  // aiState 우선 표시 (적군)
  let awarenessLabel = '';
  let awarenessColor = '#8a9099';
  if (u.alive) {
    if (u.team === 'enemy' && (u.aiState === 'investigateNoise' || u.aiState === 'searchNoise')) {
      awarenessLabel = (u.aiState === 'investigateNoise') ? '소음 위치 조사' : '소음 위치 수색';
      awarenessColor = '#ffa060';
    } else {
      awarenessLabel = aimTypeKor[u._aimType] || '대기';
      awarenessColor = (u._aimType === 'last_known' || u._aimType === 'threat') ? '#ff9a3a'
                     : (u._aimType === 'noise')      ? '#ffe066'
                     : (u._aimType === 'wp_facing') ? '#80c0ff'
                     : (u._aimType === 'visible')   ? '#ffd479'
                     : (u._aimType === 'manual_fire') ? '#ff9090'
                     : '#8a9099';
    }
  }

  // 탄약 상태
  const ammoProf = getWeaponAmmoProfile(w);
  const magMax = ammoProf.magazineSize;
  let ammoStateHtml = '준비됨', ammoStateClass = '';
  if (u.isReloading) { ammoStateHtml = `재장전 ${u.reloadTimer.toFixed(1)}s`; ammoStateClass = 'warn'; }
  else if (u.magAmmo === 0 && u.reserveAmmo === 0) { ammoStateHtml = '탄약 없음'; ammoStateClass = 'danger'; }
  else if (u.magAmmo === 0) { ammoStateHtml = '재장전 필요'; ammoStateClass = 'warn'; }
  else if (u.fireTimer > 0) { ammoStateHtml = `쿨다운 ${u.fireTimer.toFixed(1)}s`; }
  const ammoFracClass = u.magAmmo === 0 ? 'danger' : (u.magAmmo < magMax * 0.3 ? 'warn' : '');
  const curFireMode = (u.currentFireMode || u.fireModePolicy || 'auto').toUpperCase();
  // 표적까지 거리
  let distLabel = '—', distColor = '#8a9099';
  if (u.currentTarget && u.currentTarget.alive) {
    const d = dist(u.x, u.y, u.currentTarget.x, u.currentTarget.y);
    const band = distanceBand(d);
    distLabel = fmtMeter(d) + ' · ' + DISTANCE_BAND_KOR[band];
    distColor = DISTANCE_BAND_COLOR[band];
  } else {
    const best = (typeof pickBestLastKnown === 'function') ? pickBestLastKnown(u) : null;
    if (best) {
      const d = dist(u.x, u.y, best.x, best.y);
      distLabel = '최근 ' + fmtMeter(d);
    }
  }

  // 부위 상태 라벨 (UI용) — 새 medical 우선, 8부위 표시
  let bodyHtml = '';
  if (u.medical && u.medical.bodyParts) {
    bodyHtml = '<div class="bp-grid">';
    const partLabels = {
      head: '머리', neck: '목', chest: '가슴', abdomen: '복부',
      leftArm: 'L팔', rightArm: 'R팔', leftLeg: 'L다리', rightLeg: 'R다리',
    };
    for (const k of ['head','neck','chest','abdomen','leftArm','rightArm','leftLeg','rightLeg']) {
      const p = u.medical.bodyParts[k];
      const ratio = p.hp / p.maxHp;
      let cls, label;
      if (ratio >= 0.9) { cls = 'ok'; label = '정상'; }
      else if (ratio >= 0.6) { cls = 'minor'; label = `${p.hp.toFixed(0)}`; }
      else if (ratio >= 0.3) { cls = 'warn'; label = `${p.hp.toFixed(0)} 손상`; }
      else if (p.hp > 0) { cls = 'danger'; label = `${p.hp.toFixed(0)} 위험`; }
      else { cls = 'danger'; label = '기능상실'; }
      const tags = [];
      if (p.externalBleedRate > 0.5) tags.push(`출혈 ${p.externalBleedRate.toFixed(1)}`);
      if (p.fracture) tags.push('골절');
      if (p.tourniquetApplied) tags.push('지혈');
      if (p.bandageApplied) tags.push('붕대');
      if (p.splinted) tags.push('부목');
      const tagStr = tags.length > 0 ? ` <span style="font-size:9px;color:#a09060">${tags.join(' ')}</span>` : '';
      bodyHtml += `<div class="bp-item ${cls}"><span class="bp-name">${partLabels[k]}</span><span class="bp-status">${label}${tagStr}</span></div>`;
    }
    bodyHtml += '</div>';
  } else if (u.bodyHp) {
    // legacy fallback
    bodyHtml = '<div class="bp-grid">';
    for (const part of BODY_PARTS) {
      const hp = u.bodyHp[part];
      const st = getBodyPartStatus(hp);
      bodyHtml += `<div class="bp-item ${st.cls}"><span class="bp-name">${BODY_PART_KOR[part]}</span><span class="bp-status">${st.label}</span></div>`;
    }
    bodyHtml += '</div>';
  }

  // 4 컬럼 그리드 — [상태] [경계/사격] [무기/탄약] [부위 상태]
  el.innerHTML = `
    <div class="info-col">
      <div class="info-col-title">상태</div>
      <div class="info-col-body">
        <div class="unit-name">${u.name}</div>
        <div class="unit-sub">${stanceKor} · ${status}</div>
        ${u.medical ? `
        <div class="unit-row"><span class="unit-label">LIFE</span><span class="unit-value" style="color:${u.medical.lifeStatus<30?'#ff6060':(u.medical.lifeStatus<60?'#d4a04a':'#80c080')}">${u.medical.lifeStatus.toFixed(0)}%</span></div>
        <div class="unit-bar"><div class="unit-bar-fill hp ${u.medical.lifeStatus<30?'danger':(u.medical.lifeStatus<60?'warn':'')}" style="width:${u.medical.lifeStatus}%"></div></div>
        <div class="unit-row"><span class="unit-label">BODY</span><span class="unit-value">${u.medical.bodyHpTotal.toFixed(0)}/${u.medical.bodyHpMax}</span></div>
        <div class="unit-row"><span class="unit-label">BLOOD</span><span class="unit-value" style="color:${u.medical.bloodMl<2500?'#ff6060':(u.medical.bloodMl<3500?'#d4a04a':'#80c080')}">${(u.medical.bloodMl/1000).toFixed(2)}L / ${(u.medical.bloodMax/1000).toFixed(2)}L</span></div>
        ${u.medical.externalBleedRate + u.medical.internalBleedRate > 0.5 ? `
        <div class="unit-row"><span class="unit-label">BLEED</span><span class="unit-value" style="color:#ff8080">${(u.medical.externalBleedRate + u.medical.internalBleedRate).toFixed(1)} ml/s${u.medical.internalBleedRate > 0.5 ? ' (내부)' : ''}</span></div>` : ''}
        <div class="unit-row"><span class="unit-label">HR / BP</span><span class="unit-value">${u.medical.heartRate.toFixed(0)} · ${u.medical.systolicBP.toFixed(0)}/${u.medical.diastolicBP.toFixed(0)}</span></div>
        <div class="mini-ecg-box"><canvas id="selectedMiniEcgCanvas"></canvas></div>
        ` : `
        <div class="unit-row"><span class="unit-label">HP</span><span class="unit-value">${Math.round(u.hp)}/${u.maxHp}</span></div>
        <div class="unit-bar"><div class="unit-bar-fill hp ${hpClass}" style="width:${hpRatio*100}%"></div></div>
        `}
        <div class="unit-row"><span class="unit-label">SUP</span><span class="unit-value">${Math.round(u.suppression)}</span></div>
        <div class="unit-bar"><div class="unit-bar-fill sup" style="width:${u.suppression}%"></div></div>
        <div class="unit-row"><span class="unit-label">PAIN</span><span class="unit-value" style="color:${getPainTier(u.pain||0)>=2?'#ff6060':(getPainTier(u.pain||0)>=1?'#d4a04a':'#8a9099')}">${Math.round(u.pain||0)} · ${getPainLabel(u.pain||0)}</span></div>
        <div class="unit-bar"><div class="unit-bar-fill pain" style="width:${u.pain||0}%"></div></div>
      </div>
    </div>

    <div class="info-col">
      <div class="info-col-title">경계 / 사격</div>
      <div class="info-col-body">
        <div class="unit-row"><span class="unit-label">상태</span><span class="unit-value" style="color:${awarenessColor}">${awarenessLabel}</span></div>
        <div class="unit-row"><span class="unit-label">목표</span><span class="unit-value">${targetName}</span></div>
        <div class="unit-row"><span class="unit-label">거리</span><span class="unit-value" style="color:${distColor}">${distLabel}</span></div>
        <div class="unit-row"><span class="unit-label">발사</span><span class="unit-value">${curFireMode}${u.manualFireTarget?' · 지정':''}</span></div>
        <div class="unit-row"><span class="unit-label">탄</span><span class="unit-value ammo-status ${ammoStateClass}">${ammoStateHtml}</span></div>
        ${buildWeaponSlotPanel(u)}
      </div>
    </div>

    <div class="info-col">
      <div class="info-col-title">무기 / 탄약</div>
      <div class="info-col-body">
        ${u.weaponState ? `<div class="unit-row"><span class="unit-label">슬롯</span><span class="unit-value">${u.weaponState.activeSlot === 'secondary' ? '보조무기' : '주무기'}</span></div>` : ''}
        <div class="unit-row"><span class="unit-label">무기</span><span class="unit-value">${w?w.name:'-'}${_activeWpnBuildTag(u)}</span></div>
        <div class="unit-row"><span class="unit-label">사거리</span><span class="unit-value">${w&&w.range?fmtMeter(w.range,0):'-'}</span></div>
        <div class="unit-row"><span class="unit-label">탄</span><span class="unit-value">${ammo?ammo.shortName:'-'}${ammo&&ammo.caliber?` <span style="color:#6b7780; font-weight:400; font-size:9px;">${ammo.caliber}</span>`:''}</span></div>
        <div class="unit-row"><span class="unit-label">탄창</span><span class="unit-value ammo-status ${ammoFracClass}">${u.magAmmo}/${magMax} · ${u.reserveAmmo}</span></div>
        ${_activeWpnProfileRows(u)}
        ${ammo ? `<div class="unit-row"><span class="unit-label">관통/피해</span><span class="unit-value">${ammo.penetration}/${ammo.damage}</span></div>` : ''}
        <div class="unit-row"><span class="unit-label">숙련</span><span class="unit-value">${u.skill ? u.skill.presetName : '-'}</span></div>
        ${buildUnitThrowableSection(u)}
      </div>
    </div>

    <div class="info-col">
      <div class="info-col-title">부위 상태</div>
      <div class="info-col-body">
        ${bodyHtml}
        <div class="unit-row" style="margin-top:2px;"><span class="unit-label">방탄복</span><span class="unit-value">${ba?ba.shortName:'-'}</span></div>
        <div class="unit-row"><span class="unit-label">중량</span><span class="unit-value load-${u.loadClass||'standard'}">${(u.loadWeightKg||0).toFixed(1)}kg · ${getLoadClassKor(u.loadClass||'standard')}</span></div>
        <div class="unit-medic-row">
          <button class="unit-medic-btn${u.isDead?' disabled':''}${(u.bleeding!=='none'||u.fracture!=='none'||(u.pain||0)>=40)?' alert':''}" id="unitMedicSelfBtn" data-action="self">자가 처치</button>
          <button class="unit-medic-btn${u.isDead?' disabled':''}" id="unitMedicNearbyBtn" data-action="nearby">주변 처치</button>
          ${u.draggingTarget != null ? `<button class="unit-medic-btn drag-stop" data-action="dragStop">끌기 중단</button>` : ''}
          ${u.treatmentTimer > 0 ? `<button class="unit-medic-btn drag-stop" data-action="treatCancel">처치 중단</button>` : ''}
        </div>
      </div>
    </div>
  `;

  syncGlobalActionButtons(u);
}

// 우측 액션 컬럼 / 하단 빠른 액션 — 선택된 유닛 상태에 따라 텍스트/색 갱신
function syncGlobalActionButtons(u) {
  const fmCur = document.getElementById('fmCurGlobal');
  const btnPF = document.getElementById('btnPointFireGlobal');
  const btnRL = document.getElementById('btnReloadGlobal');
  const btnFM = document.getElementById('btnFireModeGlobal');
  const btnTH = document.getElementById('btnThrowGlobal');   // null (removed)
  const thCnt = document.getElementById('throwCountGlobal'); // null (removed)
  if (!fmCur) return;
  if (!u || !u.alive) {
    fmCur.textContent = '—';
    btnPF.classList.add('disabled');
    btnRL.classList.add('disabled');
    btnFM.classList.add('disabled');
    btnPF.classList.remove('on', 'armed');
    btnPF.innerHTML = '⊕ POINT<br>FIRE';
    if (btnTH) { btnTH.classList.add('disabled'); btnTH.classList.remove('on'); }
    if (thCnt) thCnt.textContent = '-';
    return;
  }
  btnPF.classList.remove('disabled');
  btnFM.classList.remove('disabled');
  fmCur.textContent = (u.fireModePolicy || 'auto').toUpperCase();
  // POINT FIRE 상태
  btnPF.classList.remove('on', 'armed');
  if (GAME.pointFireMode) {
    btnPF.classList.add('on');
    btnPF.innerHTML = '⊕ 사격<br>지점 탭';
  } else if (u.manualFireTarget) {
    btnPF.classList.add('armed');
    btnPF.innerHTML = '⊕ POINT<br>(대기)';
  } else {
    btnPF.innerHTML = '⊕ POINT<br>FIRE';
  }
  // 재장전 가능 여부
  const w = WEAPONS[u.weaponId];
  const aprof = getWeaponAmmoProfile(w);
  const reloadDisabled = u.isReloading || u.magAmmo >= aprof.magazineSize || u.reserveAmmo === 0;
  btnRL.classList.toggle('disabled', reloadDisabled);
  // 수류탄 — 보유 수량 표시 + 활성 상태
  if (btnTH && thCnt) {
    let total = 0;
    let firstId = null;
    if (u.throwables) {
      for (const id in u.throwables) {
        total += u.throwables[id];
        if (firstId == null && u.throwables[id] > 0) firstId = id;
      }
    }
    if (total === 0 || u.isDowned || u.throwState) {
      btnTH.classList.add('disabled');
      btnTH.classList.remove('on');
    } else {
      btnTH.classList.remove('disabled');
    }
    const isThrowing = GAME.throwMode && GAME.throwMode.unitId === u.id;
    btnTH.classList.toggle('on', !!isThrowing);
    thCnt.textContent = total > 0 ? String(total) : '-';
  }
  // SIDE-WEAPON-INJURY-HANDLING-1: 부상/의식으로 사격 불가 시 POINT FIRE/발사모드 비활성
  if (typeof getWeaponInjuryStatus === 'function') {
    const inj = getWeaponInjuryStatus(u);
    if (inj && inj.canFire === false) {
      btnPF.classList.add('disabled'); btnFM.classList.add('disabled');
      btnPF.classList.remove('on', 'armed');
    }
  }
}

// 아군 발사방식 순환 — auto → 지원하는 모드들 순환
function cycleFireMode(unit) {
  const w = WEAPONS[unit.weaponId];
  const prof = getWeaponAmmoProfile(w);
  // 가능 목록: ['auto', ...supports]
  const cycle = ['auto'].concat(prof.supportsFireModes);
  let i = cycle.indexOf(unit.fireModePolicy);
  if (i < 0) i = 0;
  unit.fireModePolicy = cycle[(i + 1) % cycle.length];
  renderUnitCard();
}
function updateFacingButton() {
  const btn = document.getElementById('btnFacingMode');
  btn.classList.toggle('on', GAME.facingMode);
  btn.classList.toggle('disabled', !GAME.selectedId || GAME.over);
}
function updateClearButton() {
  const btn = document.getElementById('btnClearPath');
  const sel = GAME.selectedId ? unitById(GAME.selectedId) : null;
  const hasWpSel = sel && GAME.selectedWpIdx >= 0 && GAME.selectedWpIdx < sel.movePath.length;
  const hasPath = sel && sel.movePath.length > 0;
  btn.classList.toggle('disabled', !hasPath || GAME.over);
  btn.textContent = hasWpSel ? 'WP 삭제' : '경로 ✕';
}
function updatePlayPauseButton() {
  const btn = document.getElementById('btnPlayPause');
  btn.textContent = GAME.paused ? '▶ EXECUTE' : '⏸ PAUSE';
  btn.classList.toggle('disabled', GAME.over);
}
function updatePhasePill() {
  const el = document.getElementById('phasePill');
  if (GAME.over) {
    el.className = 'pill ' + (GAME.result === 'win' ? 'run' : 'paused');
    el.innerHTML = `<span class="dot"></span>${GAME.result === 'win' ? 'COMPLETE' : 'FAILED'}`;
  } else if (GAME.paused) {
    el.className = 'pill paused';
    el.innerHTML = '<span class="dot"></span>PLAN';
  } else {
    el.className = 'pill run';
    el.innerHTML = '<span class="dot"></span>EXECUTE';
  }
}
function updateMissionPill() {
  const f = UNITS.filter(u => u.team === 'friend' && u.alive).length;
  const e = UNITS.filter(u => u.team === 'enemy'  && u.alive).length;
  document.getElementById('missionPill').textContent = `FRIEND ${f} / ENEMY ${e}`;
}
function updateHint() {
  const el = document.getElementById('hint');
  if (GAME.over) { el.style.display = 'none'; return; }
  let msg = null;
  if (GAME.pointFireMode) {
    msg = '맵을 탭해 사격 지점 지정  ·  버튼 다시 누르면 취소';
  } else if (GAME.facingMode) {
    const sel = GAME.selectedId ? unitById(GAME.selectedId) : null;
    if (sel && GAME.selectedWpIdx >= 0) msg = `WP ${GAME.selectedWpIdx + 1}의 방향을 드래그로 지정`;
    else if (sel && sel.movePath.length > 0) msg = '마지막 WP의 방향을 드래그로 지정';
    else msg = '현재 위치 facing을 드래그로 지정';
  } else if (!GAME.selectedId) {
    msg = '대원을 탭해 선택 → 바닥을 탭해 경로 추가';
  } else {
    if (GAME.selectedWpIdx >= 0) msg = `WP ${GAME.selectedWpIdx + 1} 선택됨 · 방향 SET 또는 WP 삭제 가능`;
    else msg = '바닥 탭=경로 추가  ·  WP 탭=선택  ·  방향 SET=facing 지정';
  }
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else el.style.display = 'none';
}
function showBanner(title, sub, kind) {
  const b = document.getElementById('banner');
  document.getElementById('bannerTitle').textContent = title;
  document.getElementById('bannerTitle').className = 'title ' + (kind || '');
  document.getElementById('bannerSub').textContent = sub || '';
  b.classList.add('show');
}

// =============================================================
