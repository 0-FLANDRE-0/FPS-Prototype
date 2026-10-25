// 8. SETUP
// =============================================================
// =============================================================
// 배치 모드 — PLAN 단계 전용. EXECUTE(=paused=false) 중에는 차단.
// =============================================================
function isPlacementAllowed() {
  return GAME.phase === 'play' && GAME.paused === true && !GAME.over;
}

function placeUnitAt(wx, wy) {
  if (!isPlacementAllowed()) return;
  if (pointInWalls(wx, wy, UNIT_RADIUS - 2)) {
    log('배치 지점이 벽/장애물 안입니다.', 'warn'); return;
  }
  if (!pointInMap(wx, wy, 0)) {
    log('배치 지점이 맵 밖입니다.', 'warn'); return;
  }
  const t = GAME.placementType;
  let opts;
  if (t === 'reactive') {
    GAME.placementCounter.reactive++;
    opts = {
      team:'enemy', role:'reactive',
      name:'OPFOR-' + GAME.placementCounter.reactive,
      x: wx, y: wy, facing: Math.PI,
    };
  } else if (t === 'passive') {
    GAME.placementCounter.passive++;
    opts = {
      team:'enemy', role:'passive',
      name:'TARGET-' + GAME.placementCounter.passive,
      x: wx, y: wy, facing: Math.PI,
    };
  } else {
    return;
  }
  const u = makeUnit(opts);
  UNITS.push(u);
  // grace 타이머 — 스폰 직후 + 초기 스캔 직후 goProne 억제
  u.spawnedAt = GAME.gameTime || 0;
  u.initialTacticalGraceUntil = (GAME.gameTime || 0) + 3.0;
  // 새로 배치된 적 — 즉시 360° 초기 스캔 + 입구/사각지대 분석 + facing 정렬
  if (typeof performInitialAIScan === 'function') {
    performInitialAIScan(u);
  }
  log('배치: ' + u.name, 'info');
  refreshUI();
}

let _nextCoverUid = 1;

function placeCoverAt(wx, wy) {
  if (!isPlacementAllowed()) return;
  const coverId = GAME.placementCoverId;
  const preset = PLACEMENT_COVERS[coverId];
  if (!preset) {
    // fallback to 재질 모드
    const m = GAME.placementMaterial;
    const oldPreset = PLACEMENT_MATERIALS[m];
    if (!oldPreset) return;
    if (!pointInMap(wx, wy, 0)) { log('배치 지점이 맵 밖입니다.', 'warn'); return; }
    const obj = {
      _coverUid: _nextCoverUid++,
      x: Math.round(wx - oldPreset.w/2), y: Math.round(wy - oldPreset.h/2),
      w: oldPreset.w, h: oldPreset.h,
      material: m, armor: oldPreset.armor, penetrable:true, ricochetBase:oldPreset.ricochetBase,
      blocksLOS: true, halfHeight: false, category:'fullCover',
      angle: 0, _placed: true,
    };
    if (!MAP_DATA.coverObjects) MAP_DATA.coverObjects = [];
    getTacticalObjectId(obj, 'cover');   // [AI0-B R2] push 전 runtime ID 확정
  MAP_DATA.coverObjects.push(obj);
  markTacticalGeometryChanged(obj, 'edit_place_cover_material');
    GAME.placementCounter.cover++;
    return;
  }
  if (!pointInMap(wx, wy, 0)) {
    log('배치 지점이 맵 밖입니다.', 'warn'); return;
  }
  const obj = {
    _coverUid: _nextCoverUid++,
    x: Math.round(wx - preset.w / 2),
    y: Math.round(wy - preset.h / 2),
    w: preset.w, h: preset.h,
    material: preset.material, armor: preset.armor,
    penetrable: preset.penetrable !== false,
    ricochetBase: preset.ricochetBase,
    blocksLOS: preset.blocksLOS,
    halfHeight: !!preset.halfHeight,
    category: preset.category,
    coverPresetId: coverId,
    angle: 0,
    _placed: true,
  };
  if (!MAP_DATA.coverObjects) MAP_DATA.coverObjects = [];
  recomputeArmorFromThickness(obj);   // 두께×재질로 armor 산출 (fullCover/벽)
  // [AI0-B R2] runtime 객체는 push 전에 monotonic ID를 확정한다.
  //   (ensureTacticalGeometryIds가 좌표 기반 정적 ID를 먼저 부여하면 삭제 후 재생성 시 ID가 재사용된다)
  getTacticalObjectId(obj, 'cover');
  MAP_DATA.coverObjects.push(obj);
  markTacticalGeometryChanged(obj, 'edit_place_cover');   // [AI0-B R2] 실제 추가 성공 후
  GAME.placementCounter.cover++;
  // 인근 적 — 새 cover 인식 위해 재스캔
  if (typeof rescanNearbyEnemies === 'function') {
    rescanNearbyEnemies(obj.x + obj.w / 2, obj.y + obj.h / 2, 15 * PX_PER_M_FALLBACK);
  }
  log('배치: ' + (preset.label || coverId), 'info');
}

// 좌표 (cx,cy) 반경 radiusPx 안의 적 유닛을 재스캔
function rescanNearbyEnemies(cx, cy, radiusPx) {
  if (!Array.isArray(UNITS)) return;
  // area 캐시 무효화 — cover/벽 변경 시 area 정보 변경 가능
  if (typeof clearAreaCache === 'function') clearAreaCache();
  for (const u of UNITS) {
    if (u.team !== 'enemy' || u.isDead) continue;
    const d = Math.hypot(u.x - cx, u.y - cy);
    if (d > radiusPx) continue;
    u._initialScanDone = false;
    if (typeof performInitialAIScan === 'function') performInitialAIScan(u);
  }
}

// 배치된 cover를 좌표로 찾기 — 가장 먼저 hit되는 것
function pickCoverAt(wx, wy, pad) {
  const p = pad || 4;
  if (!MAP_DATA.coverObjects) return null;
  for (let i = MAP_DATA.coverObjects.length - 1; i >= 0; i--) {
    const o = MAP_DATA.coverObjects[i];
    if (!o._placed) continue;
    if (wx >= o.x - p && wx <= o.x + o.w + p &&
        wy >= o.y - p && wy <= o.y + o.h + p) return o;
  }
  return null;
}

// 선택된 cover 회전 — 90° 단위 (AABB 폭/높이 swap)
function rotateSelectedCover(dir) {
  if (GAME.selectedCoverId == null) return;
  const o = MAP_DATA.coverObjects.find(c => c._coverUid === GAME.selectedCoverId);
  if (!o) return;
  // 중심 유지하면서 w/h swap
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const nw = o.h, nh = o.w;
  o.w = nw; o.h = nh;
  o.x = Math.round(cx - nw / 2);
  o.y = Math.round(cy - nh / 2);
  o.angle = ((o.angle || 0) + (dir > 0 ? 90 : -90) + 360) % 360;
  // 맵 경계 보정
  if (o.x < 48) o.x = 48;
  if (o.y < 48) o.y = 48;
  if (o.x + o.w > 1232) o.x = 1232 - o.w;
  if (o.y + o.h > 672)  o.y = 672  - o.h;
  if (typeof rescanNearbyEnemies === 'function') {
    rescanNearbyEnemies(o.x + o.w / 2, o.y + o.h / 2, 15 * PX_PER_M_FALLBACK);
  }
  markTacticalGeometryChanged(o, 'edit_rotate_cover');   // [AI0-B R2] 실제 회전 후
}

// 선택된 cover 이동 (드래그 등에서 호출)
function moveSelectedCover(wx, wy) {
  if (GAME.selectedCoverId == null) return;
  const o = MAP_DATA.coverObjects.find(c => c._coverUid === GAME.selectedCoverId);
  if (!o) return;
  const oldCx = o.x + o.w / 2, oldCy = o.y + o.h / 2;
  let nx = Math.round(wx - o.w / 2);
  let ny = Math.round(wy - o.h / 2);
  // 맵 경계 보정
  if (nx < 48) nx = 48;
  if (ny < 48) ny = 48;
  if (nx + o.w > 1232) nx = 1232 - o.w;
  if (ny + o.h > 672)  ny = 672  - o.h;
  const _moved = (o.x !== nx || o.y !== ny);
  o.x = nx; o.y = ny;
  if (_moved) markTacticalGeometryChanged(o, 'edit_move_cover');   // [AI0-B R2] clamp로 변화 없으면 revision 증가 0
  if (typeof rescanNearbyEnemies === 'function') {
    // 옛 위치 + 새 위치 둘 다 인근 적 재스캔
    rescanNearbyEnemies(oldCx, oldCy, 15 * PX_PER_M_FALLBACK);
    rescanNearbyEnemies(o.x + o.w / 2, o.y + o.h / 2, 15 * PX_PER_M_FALLBACK);
  }
}

// 선택된 cover 삭제
function deleteSelectedCover() {
  if (GAME.selectedCoverId == null) return;
  const idx = MAP_DATA.coverObjects.findIndex(c => c._coverUid === GAME.selectedCoverId);
  if (idx >= 0) {
    const o = MAP_DATA.coverObjects[idx];
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    MAP_DATA.coverObjects.splice(idx, 1);
    markTacticalGeometryChanged(o, 'edit_delete_cover');   // [AI0-B R2] 실제 삭제 후
    if (typeof rescanNearbyEnemies === 'function') {
      rescanNearbyEnemies(cx, cy, 15 * PX_PER_M_FALLBACK);
    }
    log('선택된 엄폐물 삭제', 'info');
  }
  GAME.selectedCoverId = null;
}

// === SIDE-MAP-BALLISTIC-1A §9~§13: Custom Cover/Wall Editor (런타임 편집) ===
const EDITOR_MATERIALS = ['drywall','glass','wood','thin_metal','concrete','steel'];
function _ensureEditorIds() {
  if (MAP_DATA.walls) for (const w of MAP_DATA.walls) {
    if (w._wallUid == null) w._wallUid = _nextCoverUid++;
    if (w._locked == null) w._locked = (w.penetrable === false);   // 외벽/경계 = 비관통 = locked
  }
  if (MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) {
    if (o._coverUid == null) o._coverUid = _nextCoverUid++;
  }
}
// 편집 대상 선택 — 배치/정적 cover 우선, 그 다음 내부 wall (외벽은 locked로 표시)
function pickEditableAt(wx, wy, pad) {
  _ensureEditorIds();
  const p = pad || 4;
  if (MAP_DATA.coverObjects) for (let i = MAP_DATA.coverObjects.length - 1; i >= 0; i--) {
    const o = MAP_DATA.coverObjects[i];
    if (wx >= o.x - p && wx <= o.x + o.w + p && wy >= o.y - p && wy <= o.y + o.h + p) return { obj:o, type:'cover', locked:false };
  }
  if (MAP_DATA.walls) for (let i = MAP_DATA.walls.length - 1; i >= 0; i--) {
    const w = MAP_DATA.walls[i];
    if (wx >= w.x - p && wx <= w.x + w.w + p && wy >= w.y - p && wy <= w.y + w.h + p) return { obj:w, type:'wall', locked: !!w._locked };
  }
  return null;
}
function getSelectedEditable() {
  if (GAME.selectedWallUid != null && MAP_DATA.walls) {
    const w = MAP_DATA.walls.find(x => x._wallUid === GAME.selectedWallUid);
    if (w) return { obj:w, type:'wall', locked: !!w._locked };
  }
  if (GAME.selectedCoverId != null && MAP_DATA.coverObjects) {
    const o = MAP_DATA.coverObjects.find(c => c._coverUid === GAME.selectedCoverId);
    if (o) return { obj:o, type:'cover', locked:false };
  }
  return null;
}
function _isSandbag(o) { return !!(o && (o.coverPresetId === 'sandbag_low' || o._fixedProfile)); }
function _editorRefresh(o) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  if (typeof rescanNearbyEnemies === 'function') rescanNearbyEnemies(cx, cy, 15 * PX_PER_M_FALLBACK);
  else if (typeof clearAreaCache === 'function') clearAreaCache();
  if (typeof renderPlaceEditor === 'function') renderPlaceEditor();
}
function _editorGuard(sel, what) {
  if (!sel) return false;
  if (sel.locked) { log('외벽/경계벽은 편집할 수 없습니다.', 'warn'); return false; }
  if (what === 'material' && _isSandbag(sel.obj)) { log('모래주머니는 재질을 바꿀 수 없습니다.', 'warn'); return false; }
  if (what === 'thickness' && _isSandbag(sel.obj)) { log('모래주머니는 두께가 고정입니다.', 'warn'); return false; }
  return true;
}
// [AI0-B R2] 재질 변경은 map topology를 바꾸지 않는다 — surface revision만 올려 SurfaceMemory만 무효화한다.
function markSurfaceMaterialChanged(obj, reason) {
  if (!obj) return null;   // 선택 없음 — 아무것도 무효화하지 않는다
  if (!obj._tacticalObjectId) getTacticalObjectId(obj, obj._tacticalKind);
  obj._tacticalSurfaceRevision = (obj._tacticalSurfaceRevision || 0) + 1;
  return obj._tacticalSurfaceRevision;   // topology/geometry revision 불변 → graph rebuild 없음
}
// SurfaceMemory 무효화 기준 — 형상(geometry) + 재질(surface) 둘 다 반영하는 관측 revision.
//   형상 편집은 geometryRevision을, 재질 변경은 surfaceRevision을 올린다. 어느 쪽이든 관측이 무효가 된다.
function getSurfaceObservationRevision(obj) {
  if (!obj) return 0;
  return ((obj._tacticalGeometryRevision || 0) * 1000) + (obj._tacticalSurfaceRevision || 0);
}
function editorCycleMaterial(dir) {
  const sel = getSelectedEditable(); if (!_editorGuard(sel, 'material')) return;
  let i = EDITOR_MATERIALS.indexOf(sel.obj.material); if (i < 0) i = 0;
  i = (i + (dir > 0 ? 1 : -1) + EDITOR_MATERIALS.length) % EDITOR_MATERIALS.length;
  sel.obj.material = EDITOR_MATERIALS[i];
  recomputeArmorFromThickness(sel.obj);   // 재질 바뀌면 두께 기준 armor 재계산
  markSurfaceMaterialChanged(sel.obj, 'edit_material');   // [AI0-B R2] topology 불변
  _editorRefresh(sel.obj);
}
function editorAdjustLength(delta) {
  const sel = getSelectedEditable(); if (!_editorGuard(sel, 'length')) return;
  const _pw = sel && sel.obj ? sel.obj.w : null, _ph = sel && sel.obj ? sel.obj.h : null;   // [AI0-B R2] 변화 판정용
  const o = sel.obj, longIsW = o.w >= o.h, cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  if (longIsW) { o.w = Math.max(8, Math.min(400, o.w + delta)); o.x = Math.round(cx - o.w / 2); }
  else { o.h = Math.max(8, Math.min(400, o.h + delta)); o.y = Math.round(cy - o.h / 2); }
  if (o.x < 48) o.x = 48; if (o.y < 48) o.y = 48; if (o.x + o.w > 1232) o.x = 1232 - o.w; if (o.y + o.h > 672) o.y = 672 - o.h;
  if (o.w !== _pw || o.h !== _ph) markTacticalGeometryChanged(o, 'edit_length');   // [AI0-B R2] 실제 변경 후
  _editorRefresh(o);
}
function editorAdjustThickness(delta) {
  const sel = getSelectedEditable(); if (!_editorGuard(sel, 'thickness')) return;
  const _pw = sel && sel.obj ? sel.obj.w : null, _ph = sel && sel.obj ? sel.obj.h : null;   // [AI0-B R2] 변화 판정용
  const o = sel.obj;
  if (o.halfHeight) { log('반높이 엄폐는 두께를 조절하지 않습니다.', 'warn'); return; }   // fullCover/wall만
  const shortIsH = o.w >= o.h, cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  if (shortIsH) { o.h = Math.max(4, Math.min(120, o.h + delta)); o.y = Math.round(cy - o.h / 2); }
  else { o.w = Math.max(4, Math.min(120, o.w + delta)); o.x = Math.round(cx - o.w / 2); }
  recomputeArmorFromThickness(o);   // 두께 변경 → armor 자동 산출
  if (o.w !== _pw || o.h !== _ph) markTacticalGeometryChanged(o, 'edit_thickness');   // [AI0-B R2] 실제 변경 후
  _editorRefresh(o);
}
function deleteSelectedEditable() {
  const sel = getSelectedEditable(); if (!sel) return;
  if (sel.type === 'wall') {
    if (sel.locked) { log('외벽/경계벽은 삭제할 수 없습니다.', 'warn'); return; }
    const idx = MAP_DATA.walls.findIndex(w => w._wallUid === GAME.selectedWallUid);
  try { markTacticalGeometryChanged(sel.obj, 'edit_delete_editable'); } catch (e) {}   // [AI0-B R2] 실제 삭제 대상
    if (idx >= 0) { const w = MAP_DATA.walls[idx]; const cx = w.x + w.w / 2, cy = w.y + w.h / 2; MAP_DATA.walls.splice(idx, 1); if (typeof rescanNearbyEnemies === 'function') rescanNearbyEnemies(cx, cy, 15 * PX_PER_M_FALLBACK); log('내부 벽 삭제', 'info'); }
    GAME.selectedWallUid = null;
  } else { deleteSelectedCover(); }
}
function editorRotateWall(dir) {
  const sel = getSelectedEditable(); if (!sel || sel.type !== 'wall') return;
  if (sel.locked) { log('외벽/경계벽은 편집할 수 없습니다.', 'warn'); return; }
  const o = sel.obj, cx = o.x + o.w / 2, cy = o.y + o.h / 2, nw = o.h, nh = o.w;
  o.w = nw; o.h = nh; o.x = Math.round(cx - nw / 2); o.y = Math.round(cy - nh / 2);
  if (o.x < 48) o.x = 48; if (o.y < 48) o.y = 48; if (o.x + o.w > 1232) o.x = 1232 - o.w; if (o.y + o.h > 672) o.y = 672 - o.h;
  markTacticalGeometryChanged(o, 'edit_rotate_wall');   // [AI0-B R2] 실제 변경 후
  _editorRefresh(o);
}
// 편집 패널 값/표시 갱신
function renderPlaceEditor() {
  const customRow = document.getElementById('placeCustomRow');
  const infoRow = document.getElementById('placeEditInfoRow');
  const info = document.getElementById('placeEditInfo');
  if (!customRow || !infoRow || !info) return;
  const sel = getSelectedEditable();
  if (!sel) { customRow.style.display = 'none'; infoRow.style.display = 'none'; return; }
  const o = sel.obj, locked = sel.locked, sandbag = _isSandbag(o);
  customRow.style.display = locked ? 'none' : 'flex';
  infoRow.style.display = 'flex';
  // 버튼 활성/비활성
  const dis = (id, off) => { const b = document.getElementById(id); if (b) { b.disabled = off; b.style.opacity = off ? 0.4 : 1; } };
  dis('btnMatPrev', sandbag); dis('btnMatNext', sandbag);
  dis('btnThkDn', sandbag || !!o.halfHeight); dis('btnThkUp', sandbag || !!o.halfHeight);
  const typeKo = sel.type === 'wall' ? (locked ? '벽(잠김)' : '내부 벽') : (o.halfHeight ? '반높이 엄폐' : '시야차단 벽');
  const thickness = Math.min(o.w, o.h);
  const thicknessM = pxToM(thickness).toFixed(2);
  const armorNote = (sandbag || o.halfHeight) ? `방호 ${o.armor||0}(고정)` : `방호 ${o.armor||0} ← 두께 ${thickness}px(${thicknessM}m)×${o.material}`;
  info.textContent = `${typeKo} · 재질 ${o.material} · ${armorNote} · ${o.w}×${o.h}` +
    (sandbag ? ' · (모래주머니: 길이만)' : '') + (locked ? ' · 편집 불가' : '');
}

function deleteAt(wx, wy) {
  if (!isPlacementAllowed()) return;
  // 1) 가까운 유닛 찾기 (반경 24px) — friend는 삭제 불가
  let bestU = null, bestUD = 24 * 24;
  for (const u of UNITS) {
    if (u.team === 'friend') continue;
    if (!u.alive && !u.respawnDelay) continue;
    const d2 = distSq(u.x, u.y, wx, wy);
    if (d2 < bestUD) { bestUD = d2; bestU = u; }
  }
  if (bestU) {
    const idx = UNITS.indexOf(bestU);
    if (idx >= 0) UNITS.splice(idx, 1);
    log('삭제: ' + bestU.name, 'info');
    refreshUI();
    return;
  }
  // 2) 가까운 cover (점이 cover 안에 들어가면)
  if (MAP_DATA.coverObjects) {
    for (let i = MAP_DATA.coverObjects.length - 1; i >= 0; i--) {
      const o = MAP_DATA.coverObjects[i];
      if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) {
        MAP_DATA.coverObjects.splice(i, 1);
        log('삭제: ' + (PLACEMENT_MATERIAL_KOR[o.material] || o.material) + ' 장애물', 'info');
        return;
      }
    }
  }
  log('삭제할 대상이 없습니다.', 'warn');
}

function handlePlacementTap(wx, wy) {
  if (!isPlacementAllowed()) return false;
  const t = GAME.placementType;
  // 먼저 기존 cover/내부벽 위 클릭이면 선택 (편집/드래그/회전 대상)
  if (t === 'fullCover' || t === 'halfCover') {
    const hitEdit = pickEditableAt(wx, wy, 4);
    if (hitEdit && hitEdit.type === 'cover') {
      GAME.selectedWallUid = null;
      GAME.selectedCoverId = (GAME.selectedCoverId === hitEdit.obj._coverUid) ? null : hitEdit.obj._coverUid;
      if (typeof renderPlaceEditor === 'function') renderPlaceEditor();
      return true;
    }
    if (hitEdit && hitEdit.type === 'wall') {
      // 내부 벽 선택 (외벽 locked도 선택은 되어 편집 불가 표시), 배치는 막음
      GAME.selectedCoverId = null;
      GAME.selectedWallUid = (GAME.selectedWallUid === hitEdit.obj._wallUid) ? null : hitEdit.obj._wallUid;
      if (typeof renderPlaceEditor === 'function') renderPlaceEditor();
      return true;
    }
    // 빈 공간 → 새 cover 배치
    GAME.selectedCoverId = null; GAME.selectedWallUid = null;
    placeCoverAt(wx, wy);
    if (typeof renderPlaceEditor === 'function') renderPlaceEditor();
    return true;
  }
  if (t === 'reactive' || t === 'passive') placeUnitAt(wx, wy);
  else if (t === 'cover')                  placeCoverAt(wx, wy);  // 호환 fallback
  else if (t === 'delete')                 deleteAt(wx, wy);
  else if (t === 'floorPaint')             paintFloorZoneAt(wx, wy);   // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1
  else if (t === 'floorErase')             eraseFloorZoneAt(wx, wy);
  return true;
}
// SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 배치모드 바닥 재질 칠하기/지우기
const FLOOR_BRUSH_SIZES = { small: 64, medium: 128, large: 208 };
function paintFloorZoneAt(wx, wy) {
  if (typeof MAP_DATA === 'undefined') return;
  if (!MAP_DATA.floorZones) MAP_DATA.floorZones = [];
  const mat = GAME.placementFloorMaterial || 'concrete';
  const sz = FLOOR_BRUSH_SIZES[GAME.placementBrushSize || 'medium'] || 128;
  const x = Math.round(wx - sz / 2), y = Math.round(wy - sz / 2);
  const nz = { id: 'floor_' + (GAME._floorSeq = (GAME._floorSeq || 0) + 1), material: mat, x, y, w: sz, h: sz, createdBy: 'placement', debugName: mat + '_paint' };
  // 같은 material 인접/겹침 → bounding box 병합 (병합 시 배열 끝으로 이동 → 최신 우선순위 유지)
  for (let i = 0; i < MAP_DATA.floorZones.length; i++) {
    const z = MAP_DATA.floorZones[i];
    if (z.material !== mat) continue;
    if (nz.x < z.x + z.w + 8 && nz.x + nz.w + 8 > z.x && nz.y < z.y + z.h + 8 && nz.y + nz.h + 8 > z.y) {
      const x0 = Math.min(z.x, nz.x), y0 = Math.min(z.y, nz.y), x1 = Math.max(z.x + z.w, nz.x + nz.w), y1 = Math.max(z.y + z.h, nz.y + nz.h);
      z.x = x0; z.y = y0; z.w = x1 - x0; z.h = y1 - y0;
      MAP_DATA.floorZones.splice(i, 1); MAP_DATA.floorZones.push(z);   // 최신으로 끌어올림
      return;
    }
  }
  MAP_DATA.floorZones.push(nz);
}
function eraseFloorZoneAt(wx, wy) {
  if (typeof MAP_DATA === 'undefined' || !MAP_DATA.floorZones) return;
  const sz = FLOOR_BRUSH_SIZES[GAME.placementBrushSize || 'medium'] || 128;
  const ex0 = wx - sz / 2, ey0 = wy - sz / 2, ex1 = wx + sz / 2, ey1 = wy + sz / 2;
  // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목8): 위(최신) zone부터 한 겹씩 제거 → 아래 재질/기본 재질이 다시 드러남
  for (let i = MAP_DATA.floorZones.length - 1; i >= 0; i--) {
    const z = MAP_DATA.floorZones[i];
    if (z.x < ex1 && z.x + z.w > ex0 && z.y < ey1 && z.y + z.h > ey0) { MAP_DATA.floorZones.splice(i, 1); return; }
  }
}

function setupGame() {
  UNITS = []; nextUnitId = 1;
  // 2A-2: 새 미션 시작 시 피격 로그 초기화 (이전 미션 로그가 남지 않게)
  GAME._impactLog = [];
  GAME._impactLogSeq = 0;
  // area 캐시 초기화 — 맵이 새로 시작
  if (typeof clearAreaCache === 'function') clearAreaCache();
  // SIDE-PER-OPERATOR-LOADOUT-1: spawn별 unitKey 부여 + 팀 기본+대원 override 병합 loadout 전달
  const _opMapId = GAME.mapId || 'cqb';
  for (let i = 0; i < MAP_DATA.friendSpawns.length; i++) {
    const s = MAP_DATA.friendSpawns[i];
    const uk = getLoadoutUnitKey('friend', s, i);
    UNITS.push(makeUnit({ team:'friend', name:s.name, x:s.x, y:s.y, facing:s.facing, role: s.role || 'reactive', loadoutKey: uk, loadout: resolveOperatorLoadout(_opMapId, 'friend', uk) }));
  }
  for (let i = 0; i < MAP_DATA.enemySpawns.length; i++) {
    const s = MAP_DATA.enemySpawns[i];
    const uk = getLoadoutUnitKey('enemy', s, i);
    UNITS.push(makeUnit({ team:'enemy', name:s.name, x:s.x, y:s.y, facing:s.facing, role: s.role || 'reactive', loadoutKey: uk, loadout: resolveOperatorLoadout(_opMapId, 'enemy', uk) }));
  }
  GAME.units = UNITS;   // alias — 다른 시스템에서 GAME.units 참조 가능하게
  GAME.phase = 'play';
  GAME.gameTime = 0;    // 2A-4: aarInit 전에 시간 0으로 — startTime이 이전 전투 시간을 물지 않게
  aarInit();   // 2A-3.5: 새 전투 battleReport 생성 + 시작 snapshot
  GAME.paused = true;
  GAME.selectedId = null;
  GAME.selectedWpIdx = -1;
  GAME.facingMode = false;
  GAME.placementMode = false;
  // 배치 카운터 — 기존 enemy 수 + reactive/passive 자동 분류
  let reactCount = 0, passCount = 0;
  for (const s of MAP_DATA.enemySpawns) {
    if ((s.role || 'reactive') === 'passive') passCount++;
    else reactCount++;
  }
  GAME.placementCounter = { reactive: reactCount, passive: passCount, cover: 0 };
  GAME.over = false;
  GAME.result = null;
  GAME.logs = [];
  GAME.fxList = [];
  GAME.noiseEvents = [];
  document.getElementById('banner').classList.remove('show');
  document.getElementById('loadoutScreen').classList.remove('show');
  document.getElementById('app').classList.add('playing');
  log('계획 모드. 대원을 선택하고 이동 경로를 지정하세요.', 'info');
  // [AI0-B §4.4] 초기 스캔 전에 geometry ID와 Spatial Graph가 준비되어야 한다
  try { ensureTacticalGeometryIds(MAP_DATA); invalidateTacticalSpatialGraph('setup'); ensureTacticalSpatialGraph(); } catch (e) {}
  // 모든 적 유닛에 대해 즉시 360° 초기 스캔 + 입구 감지 + facing 정렬
  if (typeof performAllInitialScans === 'function') performAllInitialScans();
  refreshUI();
  updatePhasePill();
}

function returnToLoadout() {
  GAME.phase = 'loadout';
  GAME.paused = true;
  GAME.over = false;
  // 2A-3.5: 사후강평 데이터 정리 + 내구도/상태 초기화
  if (typeof aarReset === 'function') aarReset();
  if (typeof closeAarOverlay === 'function') closeAarOverlay();
  // 모든 UI 오버레이/메뉴 닫기
  if (typeof closeMedicMenu === 'function') closeMedicMenu();
  if (typeof closeMedicOverlay === 'function') closeMedicOverlay();
  if (typeof closeThrowableSelectOverlay === 'function') closeThrowableSelectOverlay();
  GAME.throwMode = null;
  document.getElementById('banner').classList.remove('show');
  document.getElementById('loadoutScreen').classList.add('show');
  document.getElementById('app').classList.remove('playing');
  selectTab('loadout');
  renderLoadout();
}

function unitById(id) { return UNITS.find(u => u.id === id) || null; }
function friendlyAt(wx, wy, pad) {
  pad = pad || 22;
  let best = null, bestD = pad * pad;
  for (const u of UNITS) {
    if (!u.alive || u.team !== 'friend') continue;
    const d = distSq(u.x, u.y, wx, wy);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}
// =============================================================
