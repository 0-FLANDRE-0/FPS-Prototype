
"use strict";
// ============================================================
// METRIC SCALE SOURCE-OF-TRUTH  (SIDE-METRIC-SCALE-1)
//   모든 "의미 거리값"은 meter가 기준. px는 Canvas 좌표/충돌/렌더링 변환용.
//   legacy 값(20px/m 시절 px)은 legacyPxToM으로 meter 의미 복원 후 재계산.
//   스크립트 최상단 정의 — 맵 IIFE 등 파스타임 코드에서도 사용 가능.
// ============================================================
const LEGACY_PX_PER_M = 20;
const PX_PER_M = 32;
const M_PER_PX = 1 / PX_PER_M;
function mToPx(m)  { return m * PX_PER_M; }
function pxToM(px) { return px * M_PER_PX; }
function legacyPxToM(px) { return px / LEGACY_PX_PER_M; }
function legacyPxToCurrentPx(px) { return mToPx(legacyPxToM(px)); }
function fmtMeterFromPx(px, decimals) {
  const m = pxToM(px);
  const d = (decimals != null) ? decimals : (m < 10 ? 1 : 0);
  return m.toFixed(d) + ' m';
}
function fmtMeterM(m, decimals) {
  const d = (decimals != null) ? decimals : (m < 10 ? 1 : 0);
  return m.toFixed(d) + ' m';
}
// 맵 작성용 m 헬퍼 (새 맵 프리셋은 meter로 작성)
function rectM(xM, yM, wM, hM, extra) {
  return Object.assign({ x: mToPx(xM), y: mToPx(yM), w: mToPx(wM), h: mToPx(hM) }, extra || {});
}
function spawnM(name, xM, yM, facing, extra) {
  return Object.assign({ name, x: mToPx(xM), y: mToPx(yM), facing }, extra || {});
}
// ============================================================
// CQB TACTICAL — DOOR-KICKER STYLE PROTOTYPE
//   - 별도 파일 (기존 tactical.html 미수정)
//   - 일시정지 모드에서 대원별 이동경로 + 방향 지정
//   - 실행하면 계획대로 이동, 적 발견 시 자동 교전
//   - 기존 무기/탄약/방탄복/헬멧/피격부위/관통/방호 판정 재사용
//   - 1 병사 = 1 유닛 (분대 멤버 구조 없음)
// ============================================================
