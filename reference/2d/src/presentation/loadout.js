// 14b. LOADOUT / SKILL UI
// =============================================================
const LOADOUT_OPTIONS = {
  // 2A-5.1: 총기 목록은 WEAPON_REGISTRY에서 자동 생성 (showInLoadout/tableOrder 기준, 테스트 총기 제외)
  weapon:    (typeof buildLoadoutWeaponListFromRegistry === 'function')
               ? buildLoadoutWeaponListFromRegistry()
               : ['mp5', 'm4a1', 'm16a2', 'ak74', 'akm', 'scar_h', 'shotgun_m870', 'shotgun_m590a1', 'shotgun_m1014'],
  bodyArmor: (typeof buildBodyArmorLoadoutOptionsFromRegistry === 'function')
               ? buildBodyArmorLoadoutOptionsFromRegistry()
               : ['iotv_test', 'jpc_test', 'armor_6b23_test', 'armor_6b45_basic_test', 'msv', 'police_vest',
                  'airsoft_plate_carrier', 'replica_tactical_vest'],
  helmet:    ['mich_test', 'fast_mt', 'ech', 'k6_3', 'helmet_6b47_test', 'helmet_6b47m', 'lshz_light',
              'helmet_fast_bump', 'helmet_fast_carbon_bump', 'helmet_ulach'],
  ammo:      ['556_223_fmj', '556_m193', '556_m855', '556_m855a1',
              '556_mk318_sost', '556_mk255_rrlp', '556_m995_ap',
              '556_varmageddon', '556_hp', '556_mk262_mod1',
              '545_hp', '545_prs_gs', '545_sp', '545_us_gs', '545_fmj',
              '545_ps_gs', '545_pp_gs', '545_bp_gs', '545_bs_gs',
              '545_7n40', '545_ppbs_gs',
              '762_308_fmj', '762_m80', '762_m80a1',
              '762_m61_ap', '762_m993_ap',
              '762x39_hp', '762x39_sp', '762x39_us',
              '762x39_ps', '762x39_pp', '762x39_bp',
              '9mm_115gr', '9mm_124gr', '9mm_m882', '9mm_7n21', '9mm_7n31',
              '9mm_jhp', '9mm_jhp_p', '9mm_rip','9mm_luger_tracer'],
  skill:     ['recruit', 'regular', 'veteran', 'elite'],
};

// =============================================================
// SIDE-PER-OPERATOR-LOADOUT-1: 대원별 장비 (scoped loadout)
// =============================================================
function cloneLoadoutForOperator(ld) {
  const c = ld ? JSON.parse(JSON.stringify(ld)) : {};
  if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(c);
  return c;
}
function _opCurMapId() { return GAME.mapId || 'cqb'; }
function getOperatorOverrideBucket(mapId, team) {
  const ol = GAME.operatorLoadout; if (!ol) return null;
  if (!ol.overridesByMap[mapId]) ol.overridesByMap[mapId] = {};
  if (!ol.overridesByMap[mapId][team]) ol.overridesByMap[mapId][team] = {};
  return ol.overridesByMap[mapId][team];
}
function getLoadoutUnitKey(team, spawn, index) {
  return (spawn && (spawn.loadoutKey || spawn.unitKey || spawn.id)) || (team + '_' + index);
}
function getLoadoutUnitDescriptors(mapId, team) {
  const map = (typeof MAPS !== 'undefined' && MAPS[mapId]) || MAP_DATA;
  const spawns = (team === 'friend') ? (map && map.friendSpawns) : (map && map.enemySpawns);
  const out = [];
  if (!spawns) return out;
  const prefix = team === 'friend' ? 'A' : 'E';
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    out.push({ team, unitKey: getLoadoutUnitKey(team, s, i), index: i, name: s.name || (prefix + (i + 1)), label: prefix + (i + 1), role: s.role || 'reactive', spawn: s });
  }
  return out;
}
function getCurrentLoadoutUnitKey(team) { return (GAME.operatorLoadout && GAME.operatorLoadout.scope[team]) || 'default'; }
function setCurrentLoadoutUnitKey(team, unitKey) { if (GAME.operatorLoadout) GAME.operatorLoadout.scope[team] = unitKey || 'default'; }
function _operatorOverrideExists(mapId, team, unitKey) {
  const ol = GAME.operatorLoadout;
  return !!(ol && ol.overridesByMap[mapId] && ol.overridesByMap[mapId][team] && ol.overridesByMap[mapId][team][unitKey]);
}
// 현재 scope가 가리키는 loadout (읽기 전용 용도) — default면 팀 기본, 대원이면 override(없으면 팀 기본)
function getScopedLoadout(team) {
  const unitKey = getCurrentLoadoutUnitKey(team);
  if (unitKey === 'default') return GAME.loadout[team];
  const mapId = _opCurMapId();
  if (_operatorOverrideExists(mapId, team, unitKey)) return GAME.operatorLoadout.overridesByMap[mapId][team][unitKey];
  return GAME.loadout[team];   // override 없으면 팀 기본 상속
}
// 현재 scope가 가리키는 loadout (쓰기 용도) — 대원이면 override를 생성(팀 기본 복사)해서 반환
function getWritableScopedLoadout(team) {
  const unitKey = getCurrentLoadoutUnitKey(team);
  if (unitKey === 'default') {
    const ld = GAME.loadout[team];
    if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(ld);
    return ld;
  }
  const mapId = _opCurMapId();
  const bucket = getOperatorOverrideBucket(mapId, team);
  if (!bucket[unitKey]) bucket[unitKey] = cloneLoadoutForOperator(GAME.loadout[team]);   // 최초 수정 시 팀 기본 복사
  return bucket[unitKey];
}
// makeUnit에 넘길 완성형 loadout (팀 기본 + 대원 override 병합)
function resolveOperatorLoadout(mapId, team, unitKey) {
  if (!unitKey || unitKey === 'default') return cloneLoadoutForOperator(GAME.loadout[team]);
  if (_operatorOverrideExists(mapId, team, unitKey)) return cloneLoadoutForOperator(GAME.operatorLoadout.overridesByMap[mapId][team][unitKey]);
  return cloneLoadoutForOperator(GAME.loadout[team]);
}
function resetOperatorOverride(team, unitKey) {
  const mapId = _opCurMapId();
  const ol = GAME.operatorLoadout;
  if (ol && ol.overridesByMap[mapId] && ol.overridesByMap[mapId][team]) delete ol.overridesByMap[mapId][team][unitKey];
  if (typeof renderLoadout === 'function') renderLoadout();
  if (typeof renderWeaponSetupTab === 'function') renderWeaponSetupTab();
  if (typeof renderCoverageTab === 'function') renderCoverageTab();
  if (typeof renderAllOperatorScopeBars === 'function') renderAllOperatorScopeBars();
}
// 맵 변경 시 — 새 맵에 없는 unitKey면 scope를 default로 되돌림 (override 데이터는 보존)
function reconcileOperatorScopeForMap(mapId) {
  for (const team of ['friend', 'enemy']) {
    const cur = getCurrentLoadoutUnitKey(team);
    if (cur === 'default') continue;
    const descs = getLoadoutUnitDescriptors(mapId, team);
    if (!descs.some(d => d.unitKey === cur)) setCurrentLoadoutUnitKey(team, 'default');
  }
}
function getLoadoutSlotId(team, slot) {
  if (slot === 'skill') return GAME.teamSkill[team].presetId;
  const ld = getScopedLoadout(team);   // SIDE-PER-OPERATOR-LOADOUT-1: 현재 scope 반영
  if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(ld);
  if (slot === 'weapon')    return ld.primaryWeaponId || ld.weaponId;
  if (slot === 'secondaryWeapon') return ld.secondaryWeaponId;
  if (slot === 'bodyArmor') return ld.bodyArmorId;
  if (slot === 'helmet')    return ld.helmetId;
  if (slot === 'ammo')      return ld.primaryAmmoId || ld.ammoId;
  if (slot === 'primaryAmmo')   return ld.primaryAmmoId || ld.ammoId;
  if (slot === 'secondaryAmmo') return ld.secondaryAmmoId;
  if (slot === 'frontPlate') return ld.frontPlateId;
  if (slot === 'backPlate')  return ld.backPlateId;
  if (slot === 'sidePlate')  return ld.sidePlateId;
  if (slot === 'groinGuard')    return ld.groinGuardId;
  if (slot === 'shoulderGuard') return ld.shoulderGuardId;
  if (slot === 'neckGuard')     return ld.neckGuardId;
  if (slot === 'visor')         return ld.visorId;
  if (slot === 'slaap')         return ld.slaapId;
  if (slot === 'lethalGrenade') return ld.lethalGrenadeId || 'none';
  return null;
}
function setLoadoutSlotId(team, slot, id) {
  if (slot === 'skill') { GAME.teamSkill[team].presetId = id; return; }
  const ld = getWritableScopedLoadout(team);   // SIDE-PER-OPERATOR-LOADOUT-1: default면 팀 기본, 대원이면 override 수정
  if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(ld);
  if (slot === 'weapon') {
    ld.primaryWeaponId = id; ld.weaponId = id;
    const w = WEAPONS[id];
    if (w && w.allowedAmmoIds && ld.primaryAmmoId && w.allowedAmmoIds.indexOf(ld.primaryAmmoId) < 0) {
      ld.primaryAmmoId = w.defaultAmmoId || w.allowedAmmoIds[0]; ld.ammoId = ld.primaryAmmoId;
    }
    // 무기 변경 시 build를 LOADOUT_SELECT.previewBuild(확정) 또는 기본 build로 재생성
    if (typeof createDefaultWeaponBuild === 'function' && (!ld.primaryBuild || ld.primaryBuild.weaponId !== id)) ld.primaryBuild = createDefaultWeaponBuild(id);
    return;
  }
  if (slot === 'secondaryWeapon') {
    ld.secondaryWeaponId = id;
    const w = WEAPONS[id];
    if (w && w.allowedAmmoIds && ld.secondaryAmmoId && w.allowedAmmoIds.indexOf(ld.secondaryAmmoId) < 0) {
      ld.secondaryAmmoId = w.defaultAmmoId || w.allowedAmmoIds[0];
    }
    if (typeof createDefaultWeaponBuild === 'function' && (!ld.secondaryBuild || ld.secondaryBuild.weaponId !== id)) ld.secondaryBuild = createDefaultWeaponBuild(id);
    return;
  }
  if (slot === 'primaryAmmo') { ld.primaryAmmoId = id; ld.ammoId = id; return; }
  if (slot === 'secondaryAmmo') { ld.secondaryAmmoId = id; return; }
  if (slot === 'ammo') { ld.primaryAmmoId = id; ld.ammoId = id; return; }
  if (slot === 'bodyArmor') {
    ld.bodyArmorId = id;
    // 플레이트 호환성 자동 처리
    const _armorPreset = BODY_ARMOR_PRESETS[id];
    if (_armorPreset && _armorPreset.noPlateSlots) {
      // 경찰 방탄복 등 — 모든 탈착 플레이트 슬롯 비움 (내장 고정 플레이트만 사용)
      ld.frontPlateId = 'no_front_plate';
      ld.backPlateId  = 'no_back_plate';
      ld.sidePlateId  = 'no_side_plate';
    } else if (typeof PLATE_PRESETS !== 'undefined') {
      const fp = PLATE_PRESETS[ld.frontPlateId];
      if (!fp || !isPlateCompatible(fp, id, 'front')) ld.frontPlateId = 'no_front_plate';
      const bp = PLATE_PRESETS[ld.backPlateId];
      if (!bp || !isPlateCompatible(bp, id, 'back'))  ld.backPlateId  = 'no_back_plate';
      const sp = PLATE_PRESETS[ld.sidePlateId];
      if (!armorSupportsSidePlate(id) || !sp || !isPlateCompatible(sp, id, 'side')) {
        ld.sidePlateId = 'no_side_plate';
      }
    }
    // 추가 보호구 호환성
    if (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') {
      const checkAcc = (key, slotKind) => {
        const cur = ld[key];
        const a = PROTECTION_ACCESSORY_PRESETS[cur];
        if (!a) { ld[key] = 'no_' + slotKind + '_guard'; return; }
        if (a.isNone) return;
        if (a.compatibleArmorIds && !a.compatibleArmorIds.includes(id)) {
          ld[key] = 'no_' + slotKind + '_guard';
        }
      };
      checkAcc('groinGuardId', 'groin');
      checkAcc('shoulderGuardId', 'shoulder');
      checkAcc('neckGuardId', 'neck');
      // Police Vest는 모든 보호구 강제 없음
      if (!armorSupportsAnyPlate(id)) {
        ld.groinGuardId = 'no_groin_guard';
        ld.shoulderGuardId = 'no_shoulder_guard';
        ld.neckGuardId = 'no_neck_guard';
      }
    }
    return;
  }
  if (slot === 'helmet') {
    ld.helmetId = id;
    // 헬멧 변경 시 visor/slaap 호환성 처리
    if (typeof PROTECTION_ACCESSORY_PRESETS !== 'undefined') {
      const checkH = (key, slotKind) => {
        const cur = ld[key];
        const a = PROTECTION_ACCESSORY_PRESETS[cur];
        if (!a || a.isNone) return;
        if (a.compatibleHelmetIds && !a.compatibleHelmetIds.includes(id)) {
          ld[key] = 'no_' + slotKind;
        }
      };
      checkH('visorId', 'visor');
      checkH('slaapId', 'slaap');
    }
    return;
  }
  if (slot === 'ammo')   ld.ammoId   = id;
  else if (slot === 'frontPlate') ld.frontPlateId = id;
  else if (slot === 'backPlate')  ld.backPlateId  = id;
  else if (slot === 'sidePlate')  ld.sidePlateId  = id;
  else if (slot === 'groinGuard')    ld.groinGuardId    = id;
  else if (slot === 'shoulderGuard') ld.shoulderGuardId = id;
  else if (slot === 'neckGuard')     ld.neckGuardId     = id;
  else if (slot === 'visor')         ld.visorId         = id;
  else if (slot === 'slaap')         ld.slaapId         = id;
  else if (slot === 'lethalGrenade') {
    ld.lethalGrenadeId = (id === 'none' ? null : id);
    ld.lethalGrenadeCount = (id === 'none' ? 0 : 1);
  }
}

// =============================================================
// 로드아웃 선택 오버레이 시스템
// =============================================================
const LOADOUT_SELECT = {
  open: false,
  team: 'friend',
  slot: 'weapon',
  candidates: [],   // [{ id, name, meta }]
  selectedId: null,
  previewBuild: null,   // §16: 무기 슬롯 프리셋/파츠 미리보기 빌드
};

function getLoadoutCandidates(team, slot) {
  const ld = getScopedLoadout(team);   // SIDE-PER-OPERATOR-LOADOUT-1: 대원 scope 무기 기준 탄약 후보 (팀 기본 X)
  if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(ld);
  let ids = [];
  if (slot === 'weapon')         ids = (LOADOUT_OPTIONS.weapon || []).filter(id => { const g = WEAPONS[id] && (WEAPONS[id].group || (WEAPON_REGISTRY[id] && WEAPON_REGISTRY[id].display.group)); return g !== 'Secondary'; });
  else if (slot === 'secondaryWeapon') ids = (LOADOUT_OPTIONS.weapon || []).filter(id => { const g = WEAPONS[id] && (WEAPONS[id].group || (WEAPON_REGISTRY[id] && WEAPON_REGISTRY[id].display.group)); return g === 'Secondary'; });
  else if (slot === 'bodyArmor') ids = LOADOUT_OPTIONS.bodyArmor || [];
  else if (slot === 'helmet')    ids = LOADOUT_OPTIONS.helmet || [];
  else if (slot === 'ammo' || slot === 'primaryAmmo' || slot === 'secondaryAmmo') {
    const wId = (slot === 'secondaryAmmo') ? ld.secondaryWeaponId : (ld.primaryWeaponId || ld.weaponId);
    const w = WEAPONS[wId];
    ids = (w && w.allowedAmmoIds) ? w.allowedAmmoIds.slice() : Object.keys(AMMO_PRESETS);
    ids = _sortAmmoIdsByCaliberAndPen(ids);
  }
  return ids;
}
// 탄종 정렬 — 구경 그룹 순서 + 그룹 내 관통력 내림차순
const AMMO_CALIBER_SORT_ORDER = ['12ga',
  '9x19mm', '9x21mm', '4.6x30mm', '5.7x28mm',
  '5.56x45mm', '5.45x39mm', '7.62x39mm', '.300 BLK', '9x39mm', '7.62x51mm', '7.62x54mmR', '.30-06', '6.8x51mm',
  '9.3x64mm', '.338 Lapua', '.338 Norma', '12.7x55mm', '12.7x99mm', '12.7x108mm'];
function _sortAmmoIdsByCaliberAndPen(ids) {
  const idx = (cal) => { const i = AMMO_CALIBER_SORT_ORDER.indexOf(cal); return i < 0 ? 999 : i; };
  return ids.slice().sort((a, b) => {
    const pa = AMMO_PRESETS[a], pb = AMMO_PRESETS[b];
    if (!pa || !pb) return 0;
    const ca = idx(pa.caliber), cb = idx(pb.caliber);
    if (ca !== cb) return ca - cb;
    return (pb.penetration || 0) - (pa.penetration || 0);   // 그룹 내 관통력 높은 순
  });
}

function openLoadoutSelect(team, slot) {
  if (slot === 'skill') return;   // 숙련도는 별도 처리
  // 살상용 수류탄 — 전용 오버레이 사용 (loadout 컨텍스트)
  if (slot === 'lethalGrenade') {
    openThrowableSelectOverlay(null, team === 'enemy' ? 'loadout_enemy' : 'loadout_friend');
    return;
  }
  LOADOUT_SELECT.open = true;
  LOADOUT_SELECT.team = team;
  LOADOUT_SELECT.unitKey = getCurrentLoadoutUnitKey(team);   // SIDE-PER-OPERATOR-LOADOUT-1
  LOADOUT_SELECT.slot = slot;
  LOADOUT_SELECT.candidates = getLoadoutCandidates(team, slot);
  const ld = getScopedLoadout(team);
  let curId;
  if (slot === 'weapon') curId = ld.primaryWeaponId || ld.weaponId;
  else if (slot === 'secondaryWeapon') curId = ld.secondaryWeaponId;
  else if (slot === 'bodyArmor') curId = ld.bodyArmorId;
  else if (slot === 'helmet') curId = ld.helmetId;
  else if (slot === 'secondaryAmmo') curId = ld.secondaryAmmoId;
  else curId = ld.primaryAmmoId || ld.ammoId;
  LOADOUT_SELECT.selectedId = curId || LOADOUT_SELECT.candidates[0];
  // §5/§16: 무기 슬롯이면 previewBuild 로드 (프리셋 미리보기용)
  if ((slot === 'weapon' || slot === 'secondaryWeapon') && typeof createDefaultWeaponBuild === 'function') {
    const savedBuild = (slot === 'secondaryWeapon') ? ld.secondaryBuild : ld.primaryBuild;
    LOADOUT_SELECT.previewBuild = (savedBuild && savedBuild.weaponId === LOADOUT_SELECT.selectedId)
      ? Object.assign({}, savedBuild) : createDefaultWeaponBuild(LOADOUT_SELECT.selectedId);
  } else {
    LOADOUT_SELECT.previewBuild = null;
  }
  document.getElementById('loadoutSelectOverlay').style.display = 'flex';
  renderLoadoutSelect();
}

function closeLoadoutSelect() {
  LOADOUT_SELECT.open = false;
  document.getElementById('loadoutSelectOverlay').style.display = 'none';
}

function renderLoadoutSelect() {
  if (!LOADOUT_SELECT.open) return;
  const slot = LOADOUT_SELECT.slot;
  const team = LOADOUT_SELECT.team;
  const teamKor = team === 'friend' ? '아군' : '적군';
  const slotKor = { weapon: '주무기', secondaryWeapon: '보조무기', bodyArmor: '방탄복', helmet: '헬멧', ammo: '탄종', primaryAmmo: '주무기 탄약', secondaryAmmo: '보조무기 탄약' }[slot] || slot;
  document.getElementById('lsTitle').textContent = `${teamKor} ${slotKor} 선택`;
  // 리스트
  const listEl = document.getElementById('lsList');
  const _isWeaponSlot = (slot === 'weapon' || slot === 'secondaryWeapon');
  const _isAmmoSlot = (slot === 'ammo' || slot === 'primaryAmmo' || slot === 'secondaryAmmo');
  let html = '';
  for (const id of LOADOUT_SELECT.candidates) {
    const on = (LOADOUT_SELECT.selectedId === id) ? ' on' : '';
    let name = id, meta = '';
    if (_isWeaponSlot) {
      const w = WEAPONS[id];
      if (w) {
        name = w.name;
        meta = `${w.caliber || '—'} · ${(w.magazineSize || '—')}발 · ${(w.weightKg || 0).toFixed(2)}kg`;
      }
    } else if (slot === 'bodyArmor') {
      const a = BODY_ARMOR_PRESETS[id];
      if (a) {
        name = a.name;
        const platable = !a.noPlateSlots;
        meta = `${(a.weightKg || 0).toFixed(2)}kg · ${platable ? '플레이트 가능' : '플레이트 불가'}`;
      }
    } else if (slot === 'helmet') {
      const h = HELMET_PRESETS[id];
      if (h) {
        name = h.name;
        const mat = (h.head_skull && h.head_skull.hard) ? getMaterialDisplay(h.head_skull.hard.material) : '—';
        meta = `${mat} · ${(h.weightKg || 0).toFixed(2)}kg`;
      }
    } else if (_isAmmoSlot) {
      const am = AMMO_PRESETS[id];
      if (am) {
        name = am.name;
        meta = `Pen ${am.penetration || 0} · Dmg ${am.damage || 0} · ${am.velocity || '—'}m/s`;
      }
    }
    html += `<div class="ps-item${on}" data-id="${id}">
      <div class="ps-item-name">${name}</div>
      <div class="ps-item-meta">${meta}</div>
    </div>`;
  }
  listEl.innerHTML = html;
  // 디테일
  renderLoadoutSelectDetail();
}

function renderLoadoutSelectDetail() {
  const detailEl = document.getElementById('lsDetailContent');
  const slot = LOADOUT_SELECT.slot;
  const team = LOADOUT_SELECT.team;
  const id = LOADOUT_SELECT.selectedId;
  const ld = getScopedLoadout(team);   // SIDE-PER-OPERATOR-LOADOUT-1: 선택 detail은 현재 scope 기준
  let body = '';

  if (slot === 'weapon' || slot === 'secondaryWeapon') {
    const w = WEAPONS[id];
    if (!w) { detailEl.innerHTML = '<div class="cov-detail-empty">선택된 무기 없음</div>'; return; }
    // previewBuild 보장 (해당 무기 기준)
    if (!LOADOUT_SELECT.previewBuild || LOADOUT_SELECT.previewBuild.weaponId !== id) {
      LOADOUT_SELECT.previewBuild = (typeof createDefaultWeaponBuild === 'function') ? createDefaultWeaponBuild(id) : null;
    }
    const build = LOADOUT_SELECT.previewBuild;
    const ammoId = (slot === 'secondaryWeapon') ? ld.secondaryAmmoId : (ld.primaryAmmoId || ld.ammoId);
    const prof = (typeof buildResolvedWeaponProfile === 'function') ? buildResolvedWeaponProfile(id, ammoId, build) : null;
    const fmList = (w.supportsFireModes || []).map(m => m.toUpperCase()).join(' / ');
    const buildTag = prof ? (prof.customModified ? ' · CUSTOM' : (prof.presetId ? ' · ' + (WEAPON_PRESET_REGISTRY[prof.presetId] ? WEAPON_PRESET_REGISTRY[prof.presetId].shortName : '') : '')) : '';
    body += `<div class="ps-detail-title">${w.name}<span style="color:#7aa0c0;font-size:11px">${buildTag}</span></div>`;
    // ── 프리셋 영역 ──
    const presets = (typeof getWeaponPresets === 'function') ? getWeaponPresets(id) : [];
    body += `<div class="ws-preset-area">`;
    if (presets.length) {
      body += `<div class="ws-preset-label">프리셋</div><div class="ws-preset-btns">`;
      for (const p of presets) {
        const on = (build && build.presetId === p.id) ? ' on' : '';
        body += `<button class="ws-preset-btn${on}" data-preset-btn="${p.id}">${p.shortName}</button>`;
      }
      if (build && build.customModified) body += `<button class="ws-preset-btn cur-custom" disabled>CUSTOM</button>`;
      body += `</div>`;
    } else {
      body += `<div class="ws-preset-label">프리셋: 없음</div>`;
    }
    body += `</div>`;
    // ── 스펙 (resolved 미리보기) ──
    body += `<div class="ps-detail-row"><span>구경</span><b>${w.caliber || '—'}</b></div>`;
    body += `<div class="ps-detail-row"><span>탄창</span><b>${w.magazineSize || '—'}발 · 여분 ${w.reserveMags || 0}개</b></div>`;
    if (prof) {
      body += `<div class="ps-detail-row"><span>무게(빌드)</span><b>${prof.weightKg.toFixed(2)} kg</b></div>`;
      body += `<div class="ps-detail-row"><span>배럴 길이</span><b>${prof.barrelLengthMm} mm</b></div>`;
      body += `<div class="ps-detail-row"><span>총기 길이</span><b>${prof.obstructionLengthMm} mm</b></div>`;
      body += `<div class="ps-detail-row"><span>탄속 보정</span><b>×${prof.velocityMul.toFixed(3)}</b></div>`;
      body += `<div class="ps-detail-row"><span>실내 조작성</span><b>${({ excellent:'우수', good:'양호', average:'보통', poor:'불리', very_poor:'매우 불리' }[prof.indoorHandlingClass] || prof.indoorHandlingClass)}</b></div>`;
      body += `<div class="ps-detail-row"><span>거치 적합도</span><b>${prof.mountBenefit >= 0.9 ? '우수' : (prof.mountBenefit >= 0.6 ? '양호' : '제한적')}</b></div>`;
      body += `<div class="ps-detail-row"><span>소음/화염</span><b>${prof.noiseSignature.loudness.toFixed(2)} / ${prof.noiseSignature.muzzleFlash.toFixed(2)}${prof.noiseSignature.suppressed ? ' (소음기)' : ''}</b></div>`;
    }
    body += `<div class="ps-detail-row"><span>명중률</span><b>${(w.accuracy || 0).toFixed(2)}</b></div>`;
    body += `<div class="ps-detail-row"><span>반동</span><b>${(w.recoilBase || 0).toFixed(2)}</b></div>`;
    body += `<div class="ps-detail-row"><span>발사 속도</span><b>${w.rateOfFire || 600} RPM</b></div>`;
    body += `<div class="ps-detail-row"><span>사격 모드</span><b>${fmList || '—'}</b></div>`;
    body += `<div class="ps-detail-row"><span>재장전</span><b>${(w.reloadTime || 0).toFixed(1)}s (전술 ${(w.tacticalReloadTime || w.reloadTime || 0).toFixed(1)}s)</b></div>`;
    // 태그
    if (prof && prof.autoTags && prof.autoTags.length) {
      body += `<div class="ps-detail-row" style="flex-wrap:wrap"><span>태그</span><b style="text-align:right">${prof.autoTags.join(' · ')}</b></div>`;
    }
    // 설명 (프리셋)
    if (build && build.presetId && WEAPON_PRESET_REGISTRY[build.presetId]) {
      body += `<div class="ps-detail-desc">${WEAPON_PRESET_REGISTRY[build.presetId].description}</div>`;
    }
  }
  else if (slot === 'bodyArmor') {
    const a = BODY_ARMOR_PRESETS[id];
    if (!a) { detailEl.innerHTML = '<div class="cov-detail-empty">선택된 방탄복 없음</div>'; return; }
    body += `<div class="ps-detail-title">${a.name}</div>`;
    body += `<div class="ps-detail-row"><span>무게</span><b>${(a.weightKg || 0).toFixed(2)} kg</b></div>`;
    body += `<div class="ps-detail-row"><span>소프트 내구도</span><b>${a.softMaxDurability || '—'}</b></div>`;
    const platable = !a.noPlateSlots;
    body += `<div class="ps-detail-row"><span>전면 플레이트</span><b>${platable ? '가능' : '불가'}</b></div>`;
    body += `<div class="ps-detail-row"><span>후면 플레이트</span><b>${platable ? '가능' : '불가'}</b></div>`;
    body += `<div class="ps-detail-row"><span>사이드 플레이트</span><b>${platable && armorSupportsSidePlate(a.id) ? '가능' : '불가'}</b></div>`;
    if (a.plateWeightLimitKg) {
      body += `<div class="ps-detail-row"><span>패널당 무게 제한</span><b>전/후 ${a.plateWeightLimitKg.front || 0}kg · 사이드 ${a.plateWeightLimitKg.side || 0}kg</b></div>`;
    }
    if (a.allowReplicaPlatesOnly) {
      body += `<div class="ps-detail-row"><span>특이사항</span><b style="color:#ff9a3a">레플리카 플레이트만 호환</b></div>`;
    }
    // 추가 보호구 — 실제 호환 보호구 유무로 판단 (platable과 무관)
    const accAvail = [];
    if (typeof getCompatibleAccessoriesForArmor === 'function') {
      if (getCompatibleAccessoriesForArmor(a.id, 'groin').length > 1) accAvail.push('낭심');
      if (getCompatibleAccessoriesForArmor(a.id, 'shoulder').length > 1) accAvail.push('어깨');
      if (getCompatibleAccessoriesForArmor(a.id, 'neck').length > 1) accAvail.push('목');
    }
    body += `<div class="ps-detail-row"><span>추가 보호구</span><b>${accAvail.length ? accAvail.join('/')+' 가능' : '불가'}</b></div>`;
    // 무게 변화
    const curA = BODY_ARMOR_PRESETS[ld.bodyArmorId];
    const delta = (a.weightKg || 0) - ((curA && curA.weightKg) || 0);
    const dc = delta > 0 ? '#ff9a3a' : (delta < 0 ? '#80d090' : '#8a9099');
    body += `<div class="ps-detail-row"><span>무게 변화</span><b style="color:${dc}">${delta>0?'+':''}${delta.toFixed(2)} kg</b></div>`;
    if (a.desc) body += `<div class="ps-detail-desc">${a.desc}</div>`;
  }
  else if (slot === 'helmet') {
    const h = HELMET_PRESETS[id];
    if (!h) { detailEl.innerHTML = '<div class="cov-detail-empty">선택된 헬멧 없음</div>'; return; }
    body += `<div class="ps-detail-title">${h.name}</div>`;
    body += `<div class="ps-detail-row"><span>무게</span><b>${(h.weightKg || 0).toFixed(2)} kg</b></div>`;
    const skullVal = h.head_skull && h.head_skull.hard ? h.head_skull.hard.smallArmor : 0;
    const skullMat = h.head_skull && h.head_skull.hard ? getMaterialDisplay(h.head_skull.hard.material) : '—';
    const tempVal = h.head_temporal && h.head_temporal.hard ? h.head_temporal.hard.smallArmor : 0;
    const tempHardP = (h.head_temporal && h.head_temporal.hardP) || 0;
    let cutLabel = '일반컷';
    if (tempHardP <= 0.75) cutLabel = '고컷 (귀 노출)';
    else if (tempHardP >= 0.90) cutLabel = '풀컷 (측면 넓음)';
    else if (tempHardP >= 0.85 && tempHardP < 0.90) cutLabel = '중간컷';
    body += `<div class="ps-detail-row"><span>두개부 방호</span><b>${skullVal} (${skullMat})</b></div>`;
    body += `<div class="ps-detail-row"><span>측두부 방호</span><b>${tempVal} (${cutLabel})</b></div>`;
    body += `<div class="ps-detail-row"><span>최대 내구도</span><b>${h.maxDurability || '—'}</b></div>`;
    // visor / SLAAP 호환 — fast_mt_visor / k6_3_visor / fast_mt_slaap의 compatibleHelmetIds 검사
    const visorOk = ['fast_mt_visor','k6_3_visor'].some(v => {
      const a = PROTECTION_ACCESSORY_PRESETS[v];
      return a && a.compatibleHelmetIds && a.compatibleHelmetIds.includes(h.id);
    });
    const slaapOk = ['fast_mt_slaap'].some(v => {
      const a = PROTECTION_ACCESSORY_PRESETS[v];
      return a && a.compatibleHelmetIds && a.compatibleHelmetIds.includes(h.id);
    });
    body += `<div class="ps-detail-row"><span>바이저</span><b>${visorOk ? '장착 가능' : '없음'}</b></div>`;
    body += `<div class="ps-detail-row"><span>SLAAP</span><b>${slaapOk ? '장착 가능' : '없음'}</b></div>`;
    const curH = HELMET_PRESETS[ld.helmetId];
    const delta = (h.weightKg || 0) - ((curH && curH.weightKg) || 0);
    const dc = delta > 0 ? '#ff9a3a' : (delta < 0 ? '#80d090' : '#8a9099');
    body += `<div class="ps-detail-row"><span>무게 변화</span><b style="color:${dc}">${delta>0?'+':''}${delta.toFixed(2)} kg</b></div>`;
    if (h.desc) body += `<div class="ps-detail-desc">${h.desc}</div>`;
  }
  else if (slot === 'ammo' || slot === 'primaryAmmo' || slot === 'secondaryAmmo') {
    const am = AMMO_PRESETS[id];
    if (!am) { detailEl.innerHTML = '<div class="cov-detail-empty">선택된 탄종 없음</div>'; return; }
    body += `<div class="ps-detail-title">${am.name}</div>`;
    body += `<div class="ps-detail-row"><span>구경</span><b>${am.caliber || '—'}</b></div>`;
    body += `<div class="ps-detail-row"><span>탄속</span><b style="color:#80c0ff">${am.velocity || '—'} m/s</b></div>`;
    if (am.projectileMassG !== undefined) {
      if ((am.pelletCount || 1) > 1) {
        const pc = am.pelletCount;
        body += `<div class="ps-detail-row"><span>펠릿당 무게</span><b>${am.projectileMassG.toFixed(2)}g</b></div>`;
        body += `<div class="ps-detail-row"><span>펠릿 수</span><b>${pc}</b></div>`;
        body += `<div class="ps-detail-row"><span>총 투사체량</span><b>${(am.projectileMassG * pc).toFixed(2)}g</b></div>`;
      } else {
        body += `<div class="ps-detail-row"><span>탄자무게</span><b>${am.projectileMassG.toFixed(2)}g</b></div>`;
      }
    }
    body += `<div class="ps-detail-row"><span>관통력</span><b>${am.penetration || 0}</b></div>`;
    body += `<div class="ps-detail-row"><span>피해</span><b>${am.damage || 0}</b></div>`;
    body += `<div class="ps-detail-row"><span>방어구 피해율</span><b>${am.armorDamagePct || 25}%</b></div>`;
    body += `<div class="ps-detail-row"><span>저지력</span><b>×${(am.stoppingPower || 1.0).toFixed(2)}</b></div>`;
    body += `<div class="ps-detail-row"><span>고통</span><b>×${(am.painMul || 1.0).toFixed(2)}</b></div>`;
    body += `<div class="ps-detail-row"><span>반동</span><b>${(am.recoil || 1.0).toFixed(2)}</b></div>`;
    body += `<div class="ps-detail-row"><span>정확도</span><b>×${(am.accuracyMul || 1.0).toFixed(2)}</b></div>`;
    body += `<div class="ps-detail-row"><span>장벽 성향</span><b>${am.barrierBehavior || '—'}</b></div>`;
    body += `<div class="ps-detail-row"><span>에너지 등급</span><b>${am.energyClass || getCaliberEnergyClass(am)}</b></div>`;
    if (am.terminalEffect) {
      body += `<div class="ps-detail-row"><span>터미널 효과</span><b>${am.terminalEffect.type} (임계 ${am.terminalEffect.thresholdVelocity} m/s)</b></div>`;
    }
    if (am.medicalProfile || (typeof getAmmoMedicalProfile === 'function')) {
      const med = (typeof getAmmoMedicalProfile === 'function') ? getAmmoMedicalProfile(am) : null;
      if (med) {
        body += `<div class="ps-detail-row"><span>출혈/골절/쇼크</span><b>${(med.bleedChance*100|0)}% / ${(med.fractureChance*100|0)}% / ${(med.shockChance*100|0)}%</b></div>`;
      }
    }
    if (typeof AMMO_LORE !== 'undefined' && AMMO_LORE[id]) {
      body += `<div class="ps-detail-desc">${AMMO_LORE[id]}</div>`;
    }
  }
  detailEl.innerHTML = body;
}

function equipSelectedLoadout() {
  const team = LOADOUT_SELECT.team;
  const slot = LOADOUT_SELECT.slot;
  const id = LOADOUT_SELECT.selectedId;
  if (!id) return;
  // 기존 호환성 자동 처리 함수 재사용
  setLoadoutSlotId(team, slot, id);
  // §16: 무기 슬롯이면 previewBuild(프리셋/파츠 미리보기)를 현재 scope build로 저장
  if ((slot === 'weapon' || slot === 'secondaryWeapon') && LOADOUT_SELECT.previewBuild && LOADOUT_SELECT.previewBuild.weaponId === id) {
    const _wld = getWritableScopedLoadout(team);
    if (slot === 'secondaryWeapon') _wld.secondaryBuild = Object.assign({}, LOADOUT_SELECT.previewBuild);
    else _wld.primaryBuild = Object.assign({}, LOADOUT_SELECT.previewBuild);
  }
  if (typeof renderWeaponSetupTab === 'function') renderWeaponSetupTab();
  // SIDE-PER-OPERATOR-LOADOUT-1: scope 인지 동기화 (팀 기본 → override 없는 유닛만 / 대원 → 같은 loadoutKey만)
  if (UNITS) {
    const scopeKey = getCurrentLoadoutUnitKey(team);
    const mapId = _opCurMapId();
    for (const u of UNITS) {
      if (u.team !== team) continue;
      if (scopeKey === 'default') { if (_operatorOverrideExists(mapId, team, u.loadoutKey)) continue; }
      else { if (u.loadoutKey !== scopeKey) continue; }
      const newLd = resolveOperatorLoadout(mapId, team, u.loadoutKey);
      u.weaponId       = newLd.primaryWeaponId || newLd.weaponId;
      u.ammoId         = newLd.primaryAmmoId || newLd.ammoId;
      u.bodyArmorId    = newLd.bodyArmorId;
      u.helmetId       = newLd.helmetId;
      u.frontPlateId   = newLd.frontPlateId;
      u.backPlateId    = newLd.backPlateId;
      u.sidePlateId    = newLd.sidePlateId;
      u.groinGuardId   = newLd.groinGuardId;
      u.shoulderGuardId= newLd.shoulderGuardId;
      u.neckGuardId    = newLd.neckGuardId;
      u.visorId        = newLd.visorId;
      u.slaapId        = newLd.slaapId;
      u._protCacheKey = null;
      u.loadoutSnapshot = cloneLoadoutForOperator(newLd);
      if (typeof rebuildArmorDurability === 'function') rebuildArmorDurability(u);
      if (typeof updateUnitWeight === 'function') updateUnitWeight(u);
      if (typeof initializeWeaponStateFromLoadout === 'function') { try { initializeWeaponStateFromLoadout(u, newLd); } catch(e){} }
      if (typeof initUnitAmmo === 'function') initUnitAmmo(u);
    }
  }
  closeLoadoutSelect();
  if (typeof renderLoadout === 'function') renderLoadout();
  if (typeof renderCoverageTab === 'function') renderCoverageTab();
}

function getPresetForSlot(slot, id) {
  if (slot === 'weapon' || slot === 'secondaryWeapon') {
    const w = WEAPONS[id];
    if (!w) return null;
    // weapon에는 desc가 없으므로 caliber / 발사방식을 desc 대신
    const fmList = (w.supportsFireModes || []).map(m => m.toUpperCase()).join('/');
    return { name: w.name, desc: `${w.caliber || ''} · ${fmList}` };
  }
  if (slot === 'bodyArmor') return BODY_ARMOR_PRESETS[id];
  if (slot === 'helmet')    return HELMET_PRESETS[id];
  if (slot === 'ammo' || slot === 'primaryAmmo' || slot === 'secondaryAmmo') return AMMO_PRESETS[id];
  if (slot === 'skill')     return SKILL_PRESETS[id];
  if (slot === 'lethalGrenade') {
    if (id === 'none' || !id) return { name: '없음', desc: '수류탄 미보유' };
    const p = THROWABLE_PRESETS[id];
    if (!p) return { name: '?', desc: '' };
    return { name: p.name, desc: `${p.shortName} · 신관 ${p.fuseTime}s · ${p.throwRange}m · ${Math.round(p.weightKg*1000)}g` };
  }
  return null;
}

function fmtSkillStat(v) {
  // 1.00 / 1.18 형식, 1.0 기준 색
  return v.toFixed(2);
}

// SIDE-PER-OPERATOR-LOADOUT-1: 대원 선택 바 + 요약 렌더
function _opLdShortName(reg, id, fallback) { const p = reg && reg[id]; return (p && (p.shortName || (p.display && p.display.shortName) || p.name || (p.display && p.display.name))) || fallback || '—'; }
function summarizeLoadoutShort(ld) {
  if (!ld) return '';
  const primId = ld.primaryWeaponId || ld.weaponId;
  const wp = _opLdShortName(WEAPONS, primId, '—');
  const sec = ld.secondaryWeaponId ? _opLdShortName(WEAPONS, ld.secondaryWeaponId, '') : '';
  const arm = _opLdShortName(BODY_ARMOR_PRESETS, ld.bodyArmorId, '무방호');
  const hel = _opLdShortName(HELMET_PRESETS, ld.helmetId, '무헬멧');
  const gren = (ld.lethalGrenadeId && ld.lethalGrenadeId !== 'none') ? _opLdShortName(THROWABLE_PRESETS, ld.lethalGrenadeId, '') : '';
  let wcls = '';
  try { if (typeof getLoadClass === 'function' && typeof getEquipmentWeightKg === 'function') wcls = getLoadClass(getEquipmentWeightKg({ bodyArmorId:ld.bodyArmorId, helmetId:ld.helmetId, frontPlateId:ld.frontPlateId, backPlateId:ld.backPlateId, sidePlateId:ld.sidePlateId, weaponId:primId, throwables: (ld.lethalGrenadeId&&ld.lethalGrenadeId!=='none')?{[ld.lethalGrenadeId]:(ld.lethalGrenadeCount||1)}:{} })); } catch(e){}
  return `${wp}${sec ? ' / ' + sec : ''}<br>${arm} · ${hel}${gren ? ' · ' + gren : ''}${wcls ? ' · ' + wcls : ''}`;
}
function renderOperatorScopeBar(containerId, team, container) {
  const el = container || document.querySelector(`.ld-op-scopebar[data-team="${team}"]`) || (containerId && document.getElementById(containerId));
  if (!el) return;
  const mapId = _opCurMapId();
  const cur = getCurrentLoadoutUnitKey(team);
  const descs = getLoadoutUnitDescriptors(mapId, team);
  let h = `<button class="ld-op-btn${cur === 'default' ? ' on' : ''}" data-op-team="${team}" data-op-key="default">팀 기본</button>`;
  for (const d of descs) {
    const custom = _operatorOverrideExists(mapId, team, d.unitKey) ? ' custom' : '';
    const on = (cur === d.unitKey) ? ' on' : '';
    const pass = (d.role === 'passive') ? `<span class="ld-op-pass">표적</span>` : '';
    h += `<button class="ld-op-btn${on}${custom}" data-op-team="${team}" data-op-key="${d.unitKey}">${d.label}${pass}</button>`;
  }
  el.innerHTML = h;
}
function renderSelectedOperatorLoadoutSummary(team) {
  const el = document.querySelector(`.ld-op-summary[data-team="${team}"]`);
  if (!el) return;
  const cur = getCurrentLoadoutUnitKey(team);
  const ld = getScopedLoadout(team);
  const mapId = _opCurMapId();
  if (cur === 'default') {
    el.innerHTML = `<b>팀 기본</b><span class="ld-op-chip team">override 없는 전 대원 공용</span><br>${summarizeLoadoutShort(ld)}`;
  } else {
    const hasOv = _operatorOverrideExists(mapId, team, cur);
    const descs = getLoadoutUnitDescriptors(mapId, team);
    const d = descs.find(x => x.unitKey === cur);
    const label = d ? d.label : cur;
    const reset = hasOv ? `<button class="ld-op-reset" data-op-reset-team="${team}" data-op-reset-key="${cur}">개별 초기화</button>` : '';
    el.innerHTML = `<b>${label} ${hasOv ? '개별 장비' : '(팀 기본 상속)'}</b>` +
      (hasOv ? `<span class="ld-op-chip cust">팀 기본에서 복사됨</span>` : `<span class="ld-op-chip team">팀 기본 사용 중</span>`) +
      reset + `<br>${summarizeLoadoutShort(ld)}`;
  }
}
function renderAllOperatorScopeBars() {
  for (const team of ['friend', 'enemy']) {
    document.querySelectorAll(`.ld-op-scopebar[data-team="${team}"]`).forEach(el => renderOperatorScopeBar(null, team, el));
    renderSelectedOperatorLoadoutSummary(team);
  }
}
function renderLoadout() {
  document.querySelectorAll('.ld-cycler').forEach(el => {
    const team = el.dataset.team;
    const slot = el.dataset.slot;
    const id = getLoadoutSlotId(team, slot);
    const preset = getPresetForSlot(slot, id);
    el.querySelector('.ld-name').textContent = preset ? preset.name : id;
    el.querySelector('.ld-desc').textContent = preset && preset.desc ? preset.desc : '';
  });
  // 숙련도 stats 갱신
  document.querySelectorAll('.ld-skill-stats').forEach(box => {
    const team = box.dataset.team;
    const id = GAME.teamSkill[team].presetId;
    const preset = SKILL_PRESETS[id] || SKILL_PRESETS.regular;
    box.querySelectorAll('.ld-stat-value').forEach(el => {
      const k = el.dataset.key;
      const v = preset[k] != null ? preset[k] : 1.0;
      el.textContent = fmtSkillStat(v);
      el.classList.remove('high', 'low');
      if (v > 1.04) el.classList.add('high');
      else if (v < 0.96) el.classList.add('low');
    });
  });
  // 방호 정보 탭이 활성 상태면 함께 갱신
  const covTab = document.querySelector('.ld-tab-content[data-tab="coverage"]');
  if (covTab && covTab.classList.contains('on')) renderCoverageTab();
  if (typeof renderAllOperatorScopeBars === 'function') renderAllOperatorScopeBars();   // SIDE-PER-OPERATOR-LOADOUT-1
}

// ============================================================================
// SIDE-WEAPON-PLATFORM-1A §4.2/§23.2: 총기 셋팅 탭 렌더 + 파츠 사이클 헬퍼
// ============================================================================
function _wsGetTeamBuild(team, wpnSlot) {
  const ld = getScopedLoadout(team);
  if (typeof migrateTeamLoadout === 'function') migrateTeamLoadout(ld);
  return (wpnSlot === 'secondary') ? ld.secondaryBuild : ld.primaryBuild;
}
function _wsSetTeamBuild(team, wpnSlot, build) {
  const ld = getWritableScopedLoadout(team);
  if (wpnSlot === 'secondary') ld.secondaryBuild = build; else ld.primaryBuild = build;
}
function _wsWeaponId(team, wpnSlot) {
  const ld = getScopedLoadout(team);
  return (wpnSlot === 'secondary') ? ld.secondaryWeaponId : (ld.primaryWeaponId || ld.weaponId);
}
function _wsAmmoId(team, wpnSlot) {
  const ld = getScopedLoadout(team);
  return (wpnSlot === 'secondary') ? ld.secondaryAmmoId : (ld.primaryAmmoId || ld.ammoId);
}
// 파츠 사이클 (조준경/배럴/머즐/손잡이) — 개별 변경 시 custom
function cycleWeaponBuildPart(team, wpnSlot, partKind, dir) {
  const wId = _wsWeaponId(team, wpnSlot);
  let opts = [];
  if (partKind === 'opticId') opts = getCompatibleOptics(wId);
  else if (partKind === 'barrelId') opts = getCompatibleBarrels(wId);
  else if (partKind === 'muzzleId') opts = getCompatibleMuzzles(wId);
  else if (partKind === 'foregripId') opts = getCompatibleForegrips(wId);
  if (!opts.length) return;
  let build = _wsGetTeamBuild(team, wpnSlot) || createDefaultWeaponBuild(wId);
  let cur = build[partKind];
  let i = opts.indexOf(cur); if (i < 0) i = 0;
  const next = opts[(i + dir + opts.length) % opts.length];
  build = setWeaponBuildPart(build, partKind, next);
  _wsSetTeamBuild(team, wpnSlot, build);
  renderWeaponSetupTab();
}
function applyPresetToTeamBuild(team, wpnSlot, presetId) {
  const wId = _wsWeaponId(team, wpnSlot);
  let build = _wsGetTeamBuild(team, wpnSlot) || createDefaultWeaponBuild(wId);
  build = applyWeaponPresetToBuild(build, presetId);
  _wsSetTeamBuild(team, wpnSlot, build);
  renderWeaponSetupTab();
}
function updatePrimaryAmmoSelection(team, ammoId) {
  const ld = getWritableScopedLoadout(team);
  ld.primaryAmmoId = sanitizeWeaponAmmoSelection(ld.primaryWeaponId || ld.weaponId, ammoId); ld.ammoId = ld.primaryAmmoId;
}
function updateSecondaryAmmoSelection(team, ammoId) {
  const ld = getWritableScopedLoadout(team);
  ld.secondaryAmmoId = sanitizeWeaponAmmoSelection(ld.secondaryWeaponId, ammoId);
}
function _wsPartName(reg, id) { return (reg[id] && (reg[id].shortName || reg[id].name)) || '없음'; }
function _wsRenderWeaponCard(team, wpnSlot) {
  const wId = _wsWeaponId(team, wpnSlot);
  const w = WEAPONS[wId];
  if (!w) return `<div class="ws-wpncard"><div class="ws-wpncard-title">${wpnSlot === 'secondary' ? '보조무기' : '주무기'}: 없음</div></div>`;
  const ammoId = _wsAmmoId(team, wpnSlot);
  let build = _wsGetTeamBuild(team, wpnSlot) || createDefaultWeaponBuild(wId);
  const prof = buildResolvedWeaponProfile(wId, ammoId, build);
  const am = AMMO_PRESETS[ammoId];
  const slotKor = (wpnSlot === 'secondary') ? '보조무기' : '주무기';
  const customTag = prof.customModified ? ' · CUSTOM' : (prof.presetId && WEAPON_PRESET_REGISTRY[prof.presetId] ? ' · ' + WEAPON_PRESET_REGISTRY[prof.presetId].shortName : '');
  let h = `<div class="ws-wpncard">`;
  h += `<div class="ws-wpncard-title">${slotKor}: ${w.name}<span style="color:#7aa0c0;font-size:10px">${customTag}</span></div>`;
  // 프리셋
  const presets = getWeaponPresets(wId);
  h += `<div class="ws-preset-area">`;
  if (presets.length) {
    h += `<div class="ws-preset-label">프리셋</div><div class="ws-preset-btns">`;
    for (const p of presets) {
      const on = (build.presetId === p.id) ? ' on' : '';
      h += `<button class="ws-preset-btn${on}" data-ws-action="preset" data-ws-team="${team}" data-ws-slot="${wpnSlot}" data-ws-preset="${p.id}">${p.shortName}</button>`;
    }
    if (build.customModified) h += `<button class="ws-preset-btn cur-custom" disabled>CUSTOM</button>`;
    h += `</div>`;
  } else {
    h += `<div class="ws-preset-label">프리셋: 없음</div>`;
  }
  h += `</div>`;
  // 탄약
  h += `<div class="ws-slot-row"><span class="ws-slot-label">탄약</span>
    <div class="ws-slot-cycler" data-ws-action="ammo" data-ws-team="${team}" data-ws-slot="${wpnSlot}"><span class="ws-slot-val">${am ? am.name : ammoId}</span><span class="ld-card-arrow">›</span></div></div>`;
  // 조준경 (모든 총기)
  h += `<div class="ws-slot-row"><span class="ws-slot-label">조준경</span>
    <div class="ws-slot-cycler" data-ws-action="part" data-ws-part="opticId" data-ws-team="${team}" data-ws-slot="${wpnSlot}" data-ws-dir="1"><span class="ws-slot-val">${_wsPartName(WEAPON_OPTIC_REGISTRY, build.opticId)}</span><span class="ld-card-arrow">›</span></div></div>`;
  // 배럴/머즐/손잡이 — M4A1(모딩 지원)만
  if (weaponSupportsPartModding(wId)) {
    h += `<div class="ws-slot-row"><span class="ws-slot-label">배럴</span>
      <div class="ws-slot-cycler" data-ws-action="part" data-ws-part="barrelId" data-ws-team="${team}" data-ws-slot="${wpnSlot}" data-ws-dir="1"><span class="ws-slot-val">${_wsPartName(WEAPON_BARREL_REGISTRY, build.barrelId)}</span><span class="ld-card-arrow">›</span></div></div>`;
    h += `<div class="ws-slot-row"><span class="ws-slot-label">머즐</span>
      <div class="ws-slot-cycler" data-ws-action="part" data-ws-part="muzzleId" data-ws-team="${team}" data-ws-slot="${wpnSlot}" data-ws-dir="1"><span class="ws-slot-val">${_wsPartName(WEAPON_MUZZLE_REGISTRY, build.muzzleId)}</span><span class="ld-card-arrow">›</span></div></div>`;
    h += `<div class="ws-slot-row"><span class="ws-slot-label">손잡이</span>
      <div class="ws-slot-cycler" data-ws-action="part" data-ws-part="foregripId" data-ws-team="${team}" data-ws-slot="${wpnSlot}" data-ws-dir="1"><span class="ws-slot-val">${_wsPartName(WEAPON_FOREGRIP_REGISTRY, build.foregripId)}</span><span class="ld-card-arrow">›</span></div></div>`;
  } else {
    h += `<div class="ws-nomod">호환 부품 없음 (조준경만 변경 가능)</div>`;
  }
  // resolved 요약
  const ic = { excellent:'우수', good:'양호', average:'보통', poor:'불리', very_poor:'매우 불리' }[prof.indoorHandlingClass] || prof.indoorHandlingClass;
  h += `<div class="ws-prof-summary">`;
  h += `길이 <b>${prof.obstructionLengthMm}mm</b> (${prof.lengthClass}) · 무게 <b>${prof.weightKg.toFixed(2)}kg</b><br>`;
  h += `탄속보정 <b>×${prof.velocityMul.toFixed(3)}</b> · 실내조작 <b>${ic}</b><br>`;
  h += `소음 <b>${prof.noiseSignature.loudness.toFixed(2)}</b> / 화염 <b>${prof.noiseSignature.muzzleFlash.toFixed(2)}</b>${prof.noiseSignature.suppressed ? ' · 소음기' : ''} · 거치 <b>${prof.mountBenefit >= 0.9 ? '우수' : (prof.mountBenefit >= 0.6 ? '양호' : '제한')}</b>`;
  h += `<div class="ws-tags">${prof.autoTags.map(t => `<span class="ws-tag">${t}</span>`).join('')}</div>`;
  h += `</div>`;
  h += `</div>`;
  return h;
}
function _opScopeLabel(team) {
  const cur = getCurrentLoadoutUnitKey(team);
  if (cur === 'default') return '팀 기본';
  const d = getLoadoutUnitDescriptors(_opCurMapId(), team).find(x => x.unitKey === cur);
  const label = d ? d.label : cur;
  return _operatorOverrideExists(_opCurMapId(), team, cur) ? (label + ' 개별 장비') : (label + ' (팀 기본 상속)');
}
function renderWeaponSetupTab() {
  const body = document.getElementById('weaponSetupBody');
  if (!body) return;
  let h = '';
  for (const team of ['friend', 'enemy']) {
    const teamKor = team === 'friend' ? '▲ FRIENDLY' : '▼ HOSTILE';
    h += `<div><div class="ld-team-title">${teamKor} · <span style="font-size:11px;color:#9fb0bd">${_opScopeLabel(team)}</span></div>`;
    h += `<div class="ld-op-scopebar" data-team="${team}"></div><div class="ws-teamcol">`;
    h += _wsRenderWeaponCard(team, 'primary');
    h += _wsRenderWeaponCard(team, 'secondary');
    h += `</div></div>`;
  }
  body.innerHTML = h;
  for (const team of ['friend', 'enemy']) {
    body.querySelectorAll(`.ld-op-scopebar[data-team="${team}"]`).forEach(el => renderOperatorScopeBar(null, team, el));
  }
}

function cycleLoadout(team, slot, dir) {
  let opts = LOADOUT_OPTIONS[slot];
  // ammo 슬롯은 현재 무기의 호환 탄약만 순환
  if (slot === 'ammo') {
    const _clAmmo = getScopedLoadout(team);   // SIDE-PER-OPERATOR-LOADOUT-1
    const wId = _clAmmo.primaryWeaponId || _clAmmo.weaponId;
    const w = WEAPONS[wId];
    if (w && w.allowedAmmoIds && w.allowedAmmoIds.length > 0) {
      opts = w.allowedAmmoIds;
    }
  }
  const cur = getLoadoutSlotId(team, slot);
  let i = opts.indexOf(cur);
  if (i < 0) i = 0;
  const next = (i + dir + opts.length) % opts.length;
  setLoadoutSlotId(team, slot, opts[next]);
  renderLoadout();
}
function selectTab(name) {
  document.querySelectorAll('.ld-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.ld-tab-content').forEach(c => c.classList.toggle('on', c.dataset.tab === name));
  if (name === 'coverage') renderCoverageTab();
  if (name === 'weaponsetup' && typeof renderWeaponSetupTab === 'function') renderWeaponSetupTab();
}

// =============================================================
