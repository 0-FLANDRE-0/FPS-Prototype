// 15. MAIN LOOP
// =============================================================
let lastFrameTime = 0;
function frame(now) {
  const dt0 = (now - lastFrameTime) / 1000 || 0;
  lastFrameTime = now;
  const dt = Math.min(0.05, dt0);

  if (GAME.phase === 'play' && !GAME.paused && !GAME.over) {
    GAME.gameTime += dt;
    tickDoors(dt);            // 문 전환 — 시야/보행보다 먼저. 이번 프레임 지오메트리를 확정한다
    updateVisibility();
    if (GAME.aiProfileOn && GAME.aiProfile) {
      const _t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      for (const u of UNITS) updateUnit(u, dt);
      const _t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      GAME.aiProfile.updateSamples.push(_t1 - _t0);
    } else {
      for (const u of UNITS) updateUnit(u, dt);
    }
    tickNoiseEvents(dt);
    updateFx(dt);
    updateDustClouds(dt);   // SIDE-DUST-CLOUD-VISUAL-1
    checkWinLoss();
    if (Math.floor(GAME.gameTime * 4) !== Math.floor((GAME.gameTime - dt) * 4)) {
      renderRoster();
      renderUnitCard();
      updateMissionPill();
    }
  }

  if (GAME.phase === 'play') render();
  // ECG 캔버스 — pause/over 중에도 UI 표시는 갱신
  if (typeof drawActiveEcgCanvases === 'function') drawActiveEcgCanvases(dt);
  requestAnimationFrame(frame);
}

// =============================================================
