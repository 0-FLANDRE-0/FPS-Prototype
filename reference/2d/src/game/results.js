function checkWinLoss() {
  if (GAME.over) return;
  aarScanDeaths();   // 2A-3.5: 사망/사살 기록
  // 승리/패배 — dead, 또는 downed+unconscious(완전 무력화)는 제거된 것으로 간주
  //   downed + conscious는 아직 위협 가능하므로 카운트
  function isEliminated(u) {
    if (u.isDead) return true;
    if (u.isDowned && !u.conscious) return true;
    return !u.alive;
  }
  const friendsActive = UNITS.filter(u => u.team === 'friend' && !isEliminated(u)).length;
  const reactiveEnemies = UNITS.filter(u => u.team === 'enemy' && u.role !== 'passive');
  const enemiesActive = reactiveEnemies.filter(u => !isEliminated(u)).length;
  if (reactiveEnemies.length > 0 && enemiesActive === 0) {
    GAME.over = true; GAME.result = 'win'; GAME.paused = true;
    showBanner('MISSION COMPLETE', '모든 적 제압', 'win');
    log('임무 완료 — 모든 적 제압.', 'good');
    updatePhasePill();
    aarFinalize('win');   // 2A-3.5
  } else if (friendsActive === 0) {
    GAME.over = true; GAME.result = 'lose'; GAME.paused = true;
    showBanner('MISSION FAILED', '아군 전멸', 'lose');
    log('임무 실패 — 아군 전멸.', 'kill');
    updatePhasePill();
    aarFinalize('lose');   // 2A-3.5
  }
}
// =============================================================
