// 16. INIT
// =============================================================
function init() {
  resizeCanvas();
  // 로드아웃 화면 먼저 표시 — 미션 시작 버튼 누르면 setupGame()
  GAME.phase = 'loadout';
  document.getElementById('app').classList.remove('playing');
  document.getElementById('loadoutScreen').classList.add('show');
  renderLoadout();
  requestAnimationFrame(frame);
  // 2A-4.5: 로드 시 preset validator + registry 비교 1회 실행 (콘솔 출력, 게임 흐름 비차단)
  try {
    if (typeof validateAllPresets === 'function') validateAllPresets();
    if (typeof compareRegistryAmmoWithLegacy === 'function') compareRegistryAmmoWithLegacy();
    if (typeof compareAmmoAuxTablesWithLegacy === 'function') compareAmmoAuxTablesWithLegacy();
    if (typeof compareRegistryWeaponsWithLegacy === 'function') compareRegistryWeaponsWithLegacy();
    if (typeof compareRegistryPlatesWithLegacy === 'function') compareRegistryPlatesWithLegacy();
    if (typeof compareBodyArmorRegistryWithLegacy === 'function') compareBodyArmorRegistryWithLegacy();
    if (typeof compareRegistryHelmetsWithLegacy === 'function') compareRegistryHelmetsWithLegacy();
    if (typeof compareHelmetAccessoriesWithLegacy === 'function') compareHelmetAccessoriesWithLegacy();
  } catch (e) { if (typeof console !== 'undefined') console.warn('[Validator] 실행 중 예외(무시):', e && e.message); }
}
window.addEventListener('load', init);
if (document.readyState === 'complete') init();

// === 플레이트 선택 오버레이 이벤트 ===
(function() {
  // 슬롯 카드 클릭
  document.querySelectorAll('.cov-plate-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('disabled')) return;
      const slotName = card.dataset.plateCard;   // frontPlate / backPlate / sidePlate
      const slotKind = (slotName === 'frontPlate') ? 'front' : (slotName === 'backPlate') ? 'back' : 'side';
      openPlateSelect(slotKind);
    });
  });
  // 리스트 클릭
  const listEl = document.getElementById('psList');
  if (listEl) listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.ps-item');
    if (!item) return;
    PLATE_SELECT.selectedPlateId = item.dataset.plateId;
    renderPlateSelect();
  });
  // 닫기/취소/넣기
  const closeBtn = document.getElementById('psCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closePlateSelect);
  const cancelBtn = document.getElementById('psCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closePlateSelect);
  const equipBtn = document.getElementById('psEquipBtn');
  if (equipBtn) equipBtn.addEventListener('click', equipSelectedPlate);
  // 배경 클릭
  const overlay = document.getElementById('plateSelectOverlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePlateSelect();
  });
})();

