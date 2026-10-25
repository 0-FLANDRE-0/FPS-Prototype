// 9. LOG
// =============================================================
function log(msg, type) {
  GAME.logs.push({ msg, type: type || 'info' });
  if (GAME.logs.length > 40) GAME.logs.shift();
  renderLog();
}
function renderLog() {
  const el = document.getElementById('log');
  const last = GAME.logs.slice(-5);
  el.innerHTML = last.map(l => `<div class="log-entry ${l.type}">${l.msg}</div>`).join('');
}

// =============================================================
