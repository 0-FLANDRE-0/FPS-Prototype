// 12. RENDERING
// =============================================================
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const r = mapArea.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.round(r.width  * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  view.viewportW = r.width;
  view.viewportH = r.height;
  view.dpr = dpr;
  // 사용자가 줌해 둔 비율을 보존한 채로 baseScale을 재계산.
  //   ratio = view.scale / view.baseScale  (현재 사용자 줌 비율)
  //   resize 후에도 같은 비율이 되도록 view.scale을 다시 적용한다.
  //   첫 호출 시에는 baseScale이 초깃값(1)이라 ratio=1로 시작 → 동작 동일.
  const oldBase = view.baseScale || 1;
  const ratio = (view.scale || oldBase) / oldBase;
  computeBaseView();
  if (ratio > 0 && ratio !== 1) {
    view.scale = view.baseScale * ratio;
    view.tx = (view.viewportW - MAP_DATA.w * view.scale) / 2;
    view.ty = (view.viewportH - MAP_DATA.h * view.scale) / 2;
  }
}
function computeBaseView() {
  const sx = view.viewportW / MAP_DATA.w;
  const sy = view.viewportH / MAP_DATA.h;
  view.baseScale = Math.min(sx, sy) * 0.96;
  view.scale = view.baseScale;
  view.tx = (view.viewportW - MAP_DATA.w * view.scale) / 2;
  view.ty = (view.viewportH - MAP_DATA.h * view.scale) / 2;
}
window.addEventListener('resize', () => resizeCanvas());
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#050709';
  ctx.fillRect(0, 0, view.viewportW, view.viewportH);

  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.scale, view.scale);

  // 1) 바닥
  ctx.fillStyle = '#181d22';
  ctx.fillRect(48, 48, MAP_DATA.w - 96, MAP_DATA.h - 96);

  // 격자 — 5 m 단위 (100 px). 10 m마다 강조선. 모서리에는 m 눈금.
  // 격자는 게임플레이 방해를 최소화하기 위해 매우 옅게 그린다.
  const mapX0 = 48, mapY0 = 48;
  const mapX1 = MAP_DATA.w - 48, mapY1 = MAP_DATA.h - 48;
  ctx.lineWidth = 1 / view.scale;
  // 5 m 일반 선
  ctx.strokeStyle = 'rgba(80, 100, 120, 0.10)';
  for (let gx = mapX0 + GRID_PX; gx < mapX1; gx += GRID_PX) {
    ctx.beginPath(); ctx.moveTo(gx, mapY0); ctx.lineTo(gx, mapY1); ctx.stroke();
  }
  for (let gy = mapY0 + GRID_PX; gy < mapY1; gy += GRID_PX) {
    ctx.beginPath(); ctx.moveTo(mapX0, gy); ctx.lineTo(mapX1, gy); ctx.stroke();
  }
  // 10 m 강조선 (200 px)
  ctx.strokeStyle = 'rgba(120, 150, 180, 0.18)';
  ctx.lineWidth = 1.2 / view.scale;
  for (let gx = mapX0 + GRID_PX * 2; gx < mapX1; gx += GRID_PX * 2) {
    ctx.beginPath(); ctx.moveTo(gx, mapY0); ctx.lineTo(gx, mapY1); ctx.stroke();
  }
  for (let gy = mapY0 + GRID_PX * 2; gy < mapY1; gy += GRID_PX * 2) {
    ctx.beginPath(); ctx.moveTo(mapX0, gy); ctx.lineTo(mapX1, gy); ctx.stroke();
  }
  // 가장자리 m 눈금 (상/좌)
  ctx.fillStyle = 'rgba(140, 160, 180, 0.45)';
  ctx.font = `${10 / view.scale}px ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (let m = GRID_M; m * PX_PER_M < (mapX1 - mapX0); m += GRID_M) {
    const x = mapX0 + m * PX_PER_M;
    ctx.fillText(m + 'm', x + 2 / view.scale, mapY0 + 2 / view.scale);
  }
  for (let m = GRID_M; m * PX_PER_M < (mapY1 - mapY0); m += GRID_M) {
    const y = mapY0 + m * PX_PER_M;
    ctx.fillText(m + 'm', mapX0 + 2 / view.scale, y + 2 / view.scale);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // 1-d) SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 바닥 재질 구역 표시 (맵 직후, 유닛/먼지 전)
  renderFloorMaterialZones(ctx);

  // 2) 시야 부채꼴 (아군) — unconscious는 시야 없음
  for (const u of UNITS) {
    if (u.team !== 'friend' || !u.alive) continue;
    if (u.isDowned && !u.conscious) continue;   // unconscious — 시야 cone 제거
    drawViewCone(u);
  }

  // 3) 벽 — 재질별 색상 (엄폐물과 동일 스킴)
  const MAT_STYLE = {
    drywall:    { fill:'#4a4438', stroke:'#7a7058' },
    wood:       { fill:'#5a3a20', stroke:'#8a5a30' },
    glass:      { fill:'rgba(120,180,200,0.20)', stroke:'#7ab0c8' },
    thin_metal: { fill:'#3a4248', stroke:'#7a8088' },
    concrete:   { fill:'#4a4a4a', stroke:'#7a7a7a' },
    steel:      { fill:'#2a323a', stroke:'#6a727a' },
  };
  ctx.lineWidth = 1.2 / view.scale;
  for (const w of MAP_DATA.walls) {
    const s = MAT_STYLE[w.material] || { fill:'#3d4750', stroke:'#5a6470' };
    ctx.fillStyle = s.fill; ctx.strokeStyle = s.stroke;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeRect(w.x, w.y, w.w, w.h);
    // 관통 불가 외벽 — 안쪽에 진한 테두리로 강조
    if (w.penetrable === false) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.8 / view.scale;
      ctx.strokeRect(w.x + 0.6 / view.scale, w.y + 0.6 / view.scale, w.w - 1.2 / view.scale, w.h - 1.2 / view.scale);
      ctx.restore();
    }
  }

  // 3b) 장애물 (cover objects) — 재질별 색상 (벽과 동일 스킴)
  if (MAP_DATA.coverObjects) {
    ctx.lineWidth = 1.0 / view.scale;
    for (const o of MAP_DATA.coverObjects) {
      const s = MAT_STYLE[o.material] || { fill:'#4a4a4a', stroke:'#7a7a7a' };
      ctx.fillStyle = s.fill;
      ctx.strokeStyle = s.stroke;
      if (typeof isDoor === 'function' && isDoor(o)) { drawDoor(o, s); continue; }
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      // 반높이 표시 — 빗금 패턴 (cover 영역에 clip)
      if (o.halfHeight) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(o.x, o.y, o.w, o.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 224, 102, 0.45)';
        ctx.lineWidth = 1.2 / view.scale;
        const step = 8;
        ctx.beginPath();
        for (let i = -o.h; i < o.w; i += step) {
          ctx.moveTo(o.x + i, o.y);
          ctx.lineTo(o.x + i + o.h, o.y + o.h);
        }
        ctx.stroke();
        ctx.restore();
      }
      // 선택된 cover — 황색 박스
      if (GAME.placementMode && o._coverUid === GAME.selectedCoverId) {
        ctx.save();
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 2.0 / view.scale;
        ctx.setLineDash([4 / view.scale, 3 / view.scale]);
        ctx.strokeRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  // 4) 다른 친군 경로 (옅게)
  for (const u of UNITS) {
    if (u.team !== 'friend' || !u.alive) continue;
    if (u.id === GAME.selectedId) continue;
    if (u.movePath.length === 0) continue;
    drawPath(u, true);
  }

  // 5) 선택 대원 경로 (강조) + 거리 가이드 링
  if (GAME.selectedId && !GAME.over) {
    const sel = unitById(GAME.selectedId);
    if (sel && sel.alive) {
      // 거리 가이드 — 5 m / 10 m / 20 m 링 (옅게), 무기 사거리 링 (점선)
      const w0 = WEAPONS[sel.weaponId];
      ctx.lineWidth = 1 / view.scale;
      // 5 m
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.10)';
      ctx.beginPath(); ctx.arc(sel.x, sel.y, mToPx(5), 0, Math.PI * 2); ctx.stroke();
      // 10 m
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.08)';
      ctx.beginPath(); ctx.arc(sel.x, sel.y, mToPx(10), 0, Math.PI * 2); ctx.stroke();
      // 20 m
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.06)';
      ctx.beginPath(); ctx.arc(sel.x, sel.y, mToPx(20), 0, Math.PI * 2); ctx.stroke();
      // 무기 사거리 (점선)
      if (w0 && w0.range) {
        ctx.save();
        ctx.setLineDash([4 / view.scale, 4 / view.scale]);
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.18)';
        ctx.beginPath(); ctx.arc(sel.x, sel.y, w0.range, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // 사거리 라벨
        ctx.fillStyle = 'rgba(255, 200, 100, 0.55)';
        ctx.font = `${10 / view.scale}px ui-monospace, monospace`;
        ctx.fillText('사거리 ' + fmtMeter(w0.range, 0),
          sel.x + w0.range * 0.71 + 2 / view.scale,
          sel.y - w0.range * 0.71 - 2 / view.scale);
        ctx.restore();
      }
      drawPath(sel, false);
    }
  }

  // 6) facing 미리보기
  if (GAME.facingMode && facingStartWorld && facingEndWorld) {
    const dx = facingEndWorld.x - facingStartWorld.x;
    const dy = facingEndWorld.y - facingStartWorld.y;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const ux = dx / len, uy = dy / len;
      const armLen = 80;
      ctx.strokeStyle = 'rgba(255, 224, 102, 0.85)';
      ctx.lineWidth = 2 / view.scale;
      ctx.beginPath();
      ctx.moveTo(facingStartWorld.x, facingStartWorld.y);
      ctx.lineTo(facingStartWorld.x + ux * armLen, facingStartWorld.y + uy * armLen);
      ctx.stroke();
      const ah = 8;
      const ang = Math.atan2(uy, ux);
      const ex = facingStartWorld.x + ux * armLen, ey = facingStartWorld.y + uy * armLen;
      ctx.beginPath();
      ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang - 0.4) * ah, ey - Math.sin(ang - 0.4) * ah);
      ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang + 0.4) * ah, ey - Math.sin(ang + 0.4) * ah);
      ctx.stroke();
    }
  }

  // 6b) 수동 사격 지점 표시 — 모든 친군의 manualFireTarget
  for (const u of UNITS) {
    if (u.team !== 'friend' || !u.alive || !u.manualFireTarget) continue;
    const t = u.manualFireTarget;
    // 사수에서 지점까지 점선
    ctx.save();
    ctx.setLineDash([6 / view.scale, 4 / view.scale]);
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.55)';
    ctx.lineWidth = 1.4 / view.scale;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y); ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // 십자 + 원
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.95)';
    ctx.lineWidth = 1.6 / view.scale;
    const r = 8 / Math.sqrt(view.scale);
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(t.x - r * 1.5, t.y); ctx.lineTo(t.x + r * 1.5, t.y);
    ctx.moveTo(t.x, t.y - r * 1.5); ctx.lineTo(t.x, t.y + r * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  // 7) 트레이서 + 임팩트
  for (const f of GAME.fxList) {
    if (f.type === 'tracer') {
      const a = f.life / f.maxLife;
      // alpha curve — 처음에는 강하고 천천히 페이드. sqrt로 빗나간 ray도
      // 후반까지 어느 정도 또렷이 보이게 한다.
      const tAlpha = Math.sqrt(Math.max(0, a));
      if (f.isPellet) {
        // 펠릿 트레이서 — 노란빛 / 더 두꺼움 / 발사점 부근 살짝 굵게
        ctx.strokeStyle = f.team === 'friend'
          ? `rgba(255, 220, 130, ${tAlpha * 0.95})`
          : `rgba(255, 170, 90, ${tAlpha * 0.95})`;
        ctx.lineWidth = 2.4 / view.scale;
      } else {
        ctx.strokeStyle = f.team === 'friend'
          ? `rgba(200, 230, 255, ${tAlpha * 0.95})`
          : `rgba(255, 190, 110, ${tAlpha * 0.95})`;
        ctx.lineWidth = 1.8 / view.scale;
      }
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      // 펠릿은 종점에 작은 점 추가 — 펠릿 군집감 표현
      if (f.isPellet) {
        ctx.fillStyle = f.team === 'friend'
          ? `rgba(255, 230, 150, ${tAlpha * 0.7})`
          : `rgba(255, 180, 100, ${tAlpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(f.x2, f.y2, 1.4 / Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      }

      // 종점 임팩트 — wall/cover 충돌, 도탄, 허공 모두 표시
      if (f.hitType === 'wall' || f.hitType === 'stopped' || f.hitType === 'cover') {
        ctx.fillStyle = `rgba(220, 200, 160, ${tAlpha})`;
        ctx.beginPath();
        ctx.arc(f.x2, f.y2, 2.8 / Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.hitType === 'cover_pen') {
        // 관통 — 작은 노란 점
        ctx.fillStyle = `rgba(255, 230, 140, ${tAlpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(f.x2, f.y2, 2.0 / Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.hitType === 'ricochet') {
        // 도탄 — 작은 분홍/주황 점
        ctx.fillStyle = `rgba(255, 160, 120, ${tAlpha})`;
        ctx.beginPath();
        ctx.arc(f.x2, f.y2, 2.5 / Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.hitType === 'none') {
        // 허공 — 작은 fade-out 점
        ctx.fillStyle = f.team === 'friend'
          ? `rgba(200, 230, 255, ${tAlpha * 0.5})`
          : `rgba(255, 190, 110, ${tAlpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(f.x2, f.y2, 1.8 / Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 8) 유닛
  for (const u of UNITS) drawUnit(u);

  // 8-d) SIDE-DUST-CLOUD-VISUAL-1: 먼지구름 (유닛 위 약한 레이어, 벽 클리핑)
  renderDustClouds(ctx);

  // 9) muzzle flash
  for (const f of GAME.fxList) {
    if (f.type === 'muzzle') {
      const a = f.life / f.maxLife;
      ctx.fillStyle = f.team === 'friend'
        ? `rgba(255, 240, 180, ${a})` : `rgba(255, 200, 120, ${a})`;
      const fx = f.x + Math.cos(f.facing) * 14;
      const fy = f.y + Math.sin(f.facing) * 14;
      ctx.beginPath();
      ctx.arc(fx, fy, 4 + 3 * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9-a) 폭발 FX
  for (const f of GAME.fxList) {
    if (f.type !== 'explosion') continue;
    const a = f.life / f.maxLife;
    const t = 1 - a;   // 0 → 1
    // 바깥 충격파
    const outerR = f.radius * (0.3 + t * 0.7);
    ctx.fillStyle = `rgba(255, 200, 80, ${a * 0.35})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, outerR, 0, Math.PI * 2); ctx.fill();
    // 내부 화염
    const innerR = f.radius * 0.4 * (0.4 + t * 0.6);
    ctx.fillStyle = `rgba(255, 140, 60, ${a * 0.75})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, innerR, 0, Math.PI * 2); ctx.fill();
    // 중심 백색
    if (a > 0.5) {
      ctx.fillStyle = `rgba(255, 255, 220, ${(a - 0.5) * 1.5})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, innerR * 0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 9-a-2) 파편 raycast 시각화 (0.5초 잔존)
  //   segment type별 색 구분: normal(등급색) / penetrated(어두운 주황) / ricochet(청록)
  //   endType: unit(빨강) / armor_blocked(노랑) / wall_blocked(파랑X) / range(페이드)
  for (const f of GAME.fxList) {
    if (f.type !== 'fragment_ray') continue;
    const a = f.life / f.maxLife;
    let r, g, b;
    if (f.tierName === 'small')      { r=255; g=220; b=100; }
    else if (f.tierName === 'medium'){ r=255; g=160; b=80;  }
    else                              { r=255; g=80;  b=60;  }   // large
    if (!f.segments || f.segments.length === 0) continue;
    for (const s of f.segments) {
      let segR = r, segG = g, segB = b, alpha = a * 0.55, lw = 0.6;
      if (s.segType === 'penetrated')      { segR = 180; segG = 110; segB = 50; alpha = a * 0.45; lw = 0.5; }
      else if (s.segType === 'ricochet')   { segR = 100; segG = 220; segB = 200; alpha = a * 0.70; lw = 0.7; }
      ctx.strokeStyle = `rgba(${segR},${segG},${segB},${alpha})`;
      ctx.lineWidth = lw / view.scale;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    // 마지막 segment 끝점에 endType 마커
    const last = f.segments[f.segments.length - 1];
    const ex = last.x2, ey = last.y2;
    if (f.endType === 'unit') {
      ctx.fillStyle = `rgba(255,80,80,${a * 0.95})`;
      ctx.beginPath(); ctx.arc(ex, ey, 2.0 / view.scale, 0, Math.PI * 2); ctx.fill();
    } else if (f.endType === 'armor_blocked') {
      ctx.fillStyle = `rgba(255,220,80,${a * 0.85})`;
      ctx.beginPath(); ctx.arc(ex, ey, 1.5 / view.scale, 0, Math.PI * 2); ctx.fill();
    } else if (f.endType === 'wall_blocked') {
      const ss = 1.3 / view.scale;
      ctx.strokeStyle = `rgba(120,170,255,${a * 0.7})`;
      ctx.lineWidth = 0.6 / view.scale;
      ctx.beginPath();
      ctx.moveTo(ex - ss, ey - ss); ctx.lineTo(ex + ss, ey + ss);
      ctx.moveTo(ex - ss, ey + ss); ctx.lineTo(ex + ss, ey - ss);
      ctx.stroke();
    }
  }

  // 9-b) 비행 중 수류탄
  for (const st of GAME.flyingThrowables) {
    if (!st.flying && !st.landed) continue;
    const x = st.curX != null ? st.curX : st.targetX;
    const y = st.curY != null ? st.curY : st.targetY;
    // 본체
    ctx.fillStyle = '#3a4a30';
    ctx.strokeStyle = '#80a060';
    ctx.lineWidth = 1.0 / view.scale;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // 신관 잔여 표시
    if (st.fuseTimer != null && st.fuseTimer < 99) {
      ctx.fillStyle = '#ffcc40';
      ctx.font = `${10 / view.scale}px sans-serif`;
      ctx.fillText(st.fuseTimer.toFixed(1), x + 5, y - 5);
    }
    // 착탄 후 — 목표 지점 깜박임
    if (st.landed) {
      const pulse = (Math.sin(GAME.gameTime * 12) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255, 80, 40, ${0.6 + 0.4 * pulse})`;
      ctx.lineWidth = 2.0 / view.scale;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 9-b-2) react_text — 수류탄 반응 표시 (위로 떠오르며 페이드)
  for (const f of GAME.fxList) {
    if (f.type !== 'react_text') continue;
    const a = f.life / f.maxLife;
    const t = 1 - a;
    const yOffset = -t * 14;
    ctx.fillStyle = f.color;
    ctx.globalAlpha = a;
    ctx.font = `bold ${10 / view.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y + yOffset);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1.0;
  }

  // 9-b-3) AI 스캔 ray 시각화 (debugAIScan)
  if (GAME.debugAIScan) {
    for (const f of GAME.fxList) {
      if (f.type !== 'ai_scan_ray') continue;
      const a = f.life / f.maxLife;
      let col;
      if (f.kind === 'enemy')      col = `rgba(255,80,80,${a * 0.85})`;
      else if (f.kind === 'half')  col = `rgba(255,170,80,${a * 0.7})`;
      else if (f.kind === 'full')  col = `rgba(180,100,220,${a * 0.7})`;
      else if (f.kind === 'wall')  col = `rgba(160,160,200,${a * 0.6})`;
      else                          col = `rgba(80,170,255,${a * 0.45})`;   // open
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7 / view.scale;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
    }
  }

  // 9-b-3c) 선택 유닛이 "믿는" 지형 (debugSpatialMemory)
  //   실선 = 기억한 면 (색: 확신도 단계) / 붉은 굵은선 = 그 자리에 실제로는 아무것도 없는 구간
  //   점선 게이트 = 미확인 구역(UNK)
  if (GAME.debugSpatialMemory && GAME.selectedId && typeof SpatialPerception !== 'undefined') {
    const sel = unitById(GAME.selectedId);
    if (sel && sel.aiMemory && sel.aiMemory.spatial) {
      const dbg = SpatialPerception.getDebugSurfaces(sel);
      ctx.save();
      for (const s of dbg.surfaces) {
        const col = s.state === 'confirmed' ? 'rgba(90,220,190,' : s.state === 'uncertain' ? 'rgba(230,190,90,' : 'rgba(140,140,150,';
        ctx.strokeStyle = col + (0.35 + s.confidence * 0.5) + ')';
        ctx.lineWidth = (s.blocksSight ? 2.6 : 1.6) / view.scale;
        if (!s.blocksSight) ctx.setLineDash([5 / view.scale, 3 / view.scale]);
        ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
        ctx.setLineDash([]);
        // 허상 구간 — AI가 벽이라 믿지만 실제로는 비어 있는 곳
        if (s.phantom.length) {
          ctx.strokeStyle = 'rgba(255,70,70,0.92)';
          ctx.lineWidth = 4.5 / view.scale;
          for (const ph of s.phantom) {
            ctx.beginPath(); ctx.moveTo(ph.x1, ph.y1); ctx.lineTo(ph.x2, ph.y2); ctx.stroke();
          }
        }
        // 재질을 틀리게 믿는 면 — 노란 파선을 덧그린다 (허상 붉은선과 구분)
        if (s.materialWrong) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,215,60,0.9)';
          ctx.lineWidth = 1.6 / view.scale;
          ctx.setLineDash([3 / view.scale, 3 / view.scale]);
          ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
          ctx.restore();
        }
        // 이름 + 믿는 재질(오인이면 실제를 괄호로) + 두께 추정
        ctx.fillStyle = s.materialWrong ? 'rgba(255,215,60,0.95)' : col + '0.85)';
        ctx.font = `${9 / view.scale}px monospace`;
        const mx = (s.ax + s.bx) / 2, my = (s.ay + s.by) / 2;
        const matTag = s.material + (s.materialKnown === 'exact' ? '' : s.materialKnown === 'class' ? '?' : '??');
        ctx.fillText(s.name + ' ' + matTag + (s.thickness != null ? ' ' + Math.round(s.thickness) : ''),
                     mx + 3 / view.scale, my - 3 / view.scale);
      }
      for (const u of dbg.unknowns) {
        const done = (u.state === 'crossed' || u.state === 'observedBeyond');
        ctx.strokeStyle = done ? 'rgba(120,200,120,0.5)' : 'rgba(190,120,235,0.75)';
        ctx.lineWidth = 1.6 / view.scale;
        ctx.setLineDash([6 / view.scale, 4 / view.scale]);
        if (u.gateA && u.gateB) {
          ctx.beginPath(); ctx.moveTo(u.gateA.x, u.gateA.y); ctx.lineTo(u.gateB.x, u.gateB.y); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(sel.x, sel.y); ctx.lineTo(u.ax, u.ay); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = done ? 'rgba(120,200,120,0.8)' : 'rgba(190,120,235,0.9)';
        ctx.font = `${9 / view.scale}px monospace`;
        ctx.fillText(u.name + '·' + u.state, u.ix + 4 / view.scale, u.iy - 4 / view.scale);
      }
      // 문턱 — 프론티어(보라 점선)와 구분되는 청록 실선 게이트.
      //   경계는 세 종류다: 벽(위 실선) / 문턱(여기) / 프론티어(위 점선).
      const _th = (sel.aiMemory.spatial.thresholds) || [];
      for (const t of _th) {
        const done = (t.state === 'crossed' || t.state === 'observedBeyond');
        ctx.strokeStyle = t.confirmed ? (done ? 'rgba(80,220,255,0.55)' : 'rgba(80,220,255,0.95)')
                                      : 'rgba(80,220,255,0.35)';
        ctx.lineWidth = (t.confirmed ? 3.4 : 1.8) / view.scale;
        if (t.gateA && t.gateB) {
          ctx.beginPath(); ctx.moveTo(t.gateA.x, t.gateA.y); ctx.lineTo(t.gateB.x, t.gateB.y); ctx.stroke();
        }
        if (t.doorBacked) {   // 문짝을 본 문턱 — 바깥 테두리를 하나 더
          ctx.strokeStyle = 'rgba(255,224,102,0.8)';
          ctx.lineWidth = 1.2 / view.scale;
          ctx.beginPath(); ctx.arc(t.ix, t.iy, 7, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(80,220,255,0.95)';
        ctx.font = `${9 / view.scale}px monospace`;
        ctx.fillText((t.name || 'TH') + '·' + (t.state || 'detected') + (t.confirmed ? '' : '?'),
                     t.ix + 4 / view.scale, t.iy + 11 / view.scale);
      }
      // 아는 방 — 이름과 상태. cleared는 초록, entered는 흰색, named(안 가 봄)는 회색.
      const _kr = sel.aiMemory.knownRooms;
      if (_kr && typeof roomById === 'function') {
        ctx.font = `${11 / view.scale}px monospace`;
        for (const [, kr] of _kr) {
          const rm = roomById(kr.roomId); if (!rm) continue;
          const col = kr.state === 'cleared' ? 'rgba(120,220,140,'
                    : kr.state === 'entered' ? 'rgba(235,235,245,' : 'rgba(150,150,165,';
          ctx.strokeStyle = col + '0.30)';
          ctx.lineWidth = 1.2 / view.scale;
          ctx.setLineDash([7 / view.scale, 5 / view.scale]);
          ctx.strokeRect(rm.x + 4, rm.y + 4, rm.w - 8, rm.h - 8);
          ctx.setLineDash([]);
          ctx.fillStyle = col + '0.95)';
          ctx.fillText(rm.name + ' [' + kr.state + ']', rm.x + 10, rm.y + 20);
        }
      }
      ctx.restore();
    }
  }

  // 9-b-4) 선택 유닛의 AI 메모리 시각화 (debugAIMemory)
  if (GAME.debugAIMemory && GAME.selectedId) {
    const sel = unitById(GAME.selectedId);
    if (sel && sel.aiMemory) {
      const mem = sel.aiMemory;
      // knownCovers
      for (const c of mem.knownCovers.values()) {
        ctx.strokeStyle = (c.coverType === 'full') ? 'rgba(180,100,220,0.6)' : 'rgba(255,170,80,0.6)';
        ctx.lineWidth = 1.0 / view.scale;
        ctx.strokeRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
        // 중심 + confidence 표시
        ctx.fillStyle = (c.coverType === 'full') ? 'rgba(180,100,220,0.8)' : 'rgba(255,170,80,0.8)';
        ctx.beginPath(); ctx.arc(c.x, c.y, 2 / view.scale, 0, Math.PI * 2); ctx.fill();
      }
      // knownCorners — 타입별 색상은 아래 dangerPoints 다음 블록에서 처리
      // openSectors — 화살표
      for (const s of mem.openSectors) {
        const tx = sel.x + Math.cos(s.angle) * Math.min(s.distance, 100);
        const ty = sel.y + Math.sin(s.angle) * Math.min(s.distance, 100);
        ctx.strokeStyle = 'rgba(80,200,255,0.25)';
        ctx.lineWidth = 0.4 / view.scale;
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y); ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      // preferredWatchAngle — 굵은 노란 화살표
      if (mem.preferredWatchAngle != null) {
        const wx = sel.x + Math.cos(mem.preferredWatchAngle) * 80;
        const wy = sel.y + Math.sin(mem.preferredWatchAngle) * 80;
        ctx.strokeStyle = 'rgba(255,230,80,0.9)';
        ctx.lineWidth = 1.6 / view.scale;
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y); ctx.lineTo(wx, wy);
        ctx.stroke();
        // 화살촉
        const ah = 6 / view.scale;
        const aang = Math.atan2(wy - sel.y, wx - sel.x);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx - ah * Math.cos(aang - 0.4), wy - ah * Math.sin(aang - 0.4));
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx - ah * Math.cos(aang + 0.4), wy - ah * Math.sin(aang + 0.4));
        ctx.stroke();
      }
      // lastSeenEnemy
      if (mem.lastSeenEnemy) {
        ctx.fillStyle = `rgba(255,80,80,${0.4 + mem.lastSeenEnemy.confidence * 0.5})`;
        ctx.beginPath(); ctx.arc(mem.lastSeenEnemy.x, mem.lastSeenEnemy.y, 4 / view.scale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,80,80,0.8)';
        ctx.lineWidth = 1 / view.scale;
        ctx.stroke();
      }
      // lastHeardNoise
      if (mem.lastHeardNoise) {
        ctx.strokeStyle = 'rgba(80,200,255,0.6)';
        ctx.lineWidth = 0.8 / view.scale;
        ctx.setLineDash([3 / view.scale, 2 / view.scale]);
        ctx.beginPath(); ctx.arc(mem.lastHeardNoise.x, mem.lastHeardNoise.y, 6 / view.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      // dangerPoints
      for (const dp of (mem.dangerPoints || [])) {
        ctx.strokeStyle = 'rgba(255,100,60,0.5)';
        ctx.lineWidth = 0.6 / view.scale;
        ctx.beginPath(); ctx.arc(dp.x, dp.y, 10 / view.scale, 0, Math.PI * 2); ctx.stroke();
      }
      // gunshot danger zones — 진하게
      if (mem.noiseDangerZones) {
        for (const z of mem.noiseDangerZones) {
          ctx.strokeStyle = 'rgba(255, 60, 60, 0.55)';
          ctx.lineWidth = 1.0 / view.scale;
          ctx.setLineDash([4 / view.scale, 3 / view.scale]);
          ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255, 60, 60, 0.08)';
          ctx.fill();
        }
      }
      // dangerousEntrances — 빨간 막대 (입구 표시)
      if (mem.dangerousEntrances) {
        for (const de of mem.dangerousEntrances) {
          const a = de.dangerLevel || 0.5;
          ctx.strokeStyle = `rgba(255, 100, 40, ${0.4 + a * 0.5})`;
          ctx.lineWidth = 2.0 / view.scale;
          // 입구 방향 short bar
          const perpAng = de.angle + Math.PI / 2;
          const barLen = 12 / view.scale;
          ctx.beginPath();
          ctx.moveTo(de.x - Math.cos(perpAng) * barLen, de.y - Math.sin(perpAng) * barLen);
          ctx.lineTo(de.x + Math.cos(perpAng) * barLen, de.y + Math.sin(perpAng) * barLen);
          ctx.stroke();
          // ! 마커
          ctx.fillStyle = `rgba(255, 80, 40, ${0.6 + a * 0.4})`;
          ctx.font = `bold ${9 / view.scale}px sans-serif`;
          ctx.fillText('!', de.x - 2 / view.scale, de.y - 3 / view.scale);
        }
      }
      // lastHeardGunshot — 진한 빨간 X
      if (mem.lastHeardGunshot) {
        const g = mem.lastHeardGunshot;
        ctx.strokeStyle = 'rgba(255, 40, 40, 0.95)';
        ctx.lineWidth = 1.5 / view.scale;
        const s = 6 / view.scale;
        ctx.beginPath();
        ctx.moveTo(g.x - s, g.y - s); ctx.lineTo(g.x + s, g.y + s);
        ctx.moveTo(g.x + s, g.y - s); ctx.lineTo(g.x - s, g.y + s);
        ctx.stroke();
      }
      // 코너 타입 — 색상 구분
      for (const c of mem.knownCorners) {
        if (c.confidence < 0.2) continue;
        const ct = c._classifiedType || 'unknownCorner';
        let col;
        if (ct === 'tacticalCorner')      col = `rgba(120, 255, 120, ${0.5 + c.confidence * 0.4})`;
        else if (ct === 'roomCorner')     col = `rgba(255, 180, 80, ${0.5 + c.confidence * 0.4})`;
        else if (ct === 'deadEndCorner')  col = `rgba(255, 80, 80, ${0.5 + c.confidence * 0.4})`;
        else                              col = `rgba(255,230,100,${0.4 + c.confidence * 0.5})`;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(c.x, c.y, 3.5 / view.scale, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // 9-b-5) AI cover candidates (debugAICover) — 상위 후보 표시
  if (GAME.debugAICover) {
    for (const f of GAME.fxList) {
      if (f.type !== 'ai_cover_candidates') continue;
      const a = f.life / f.maxLife;
      for (let i = 0; i < f.candidates.length; i++) {
        const c = f.candidates[i];
        const isBest = (i === 0);
        ctx.fillStyle = isBest ? `rgba(255,230,80,${a * 0.95})` : `rgba(180,180,180,${a * 0.55})`;
        ctx.beginPath(); ctx.arc(c.spotX, c.spotY, (isBest ? 4 : 2.5) / view.scale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isBest ? `rgba(255,230,80,${a})` : `rgba(180,180,180,${a * 0.6})`;
        ctx.lineWidth = 0.8 / view.scale;
        ctx.beginPath(); ctx.arc(c.spotX, c.spotY, (isBest ? 6 : 4) / view.scale, 0, Math.PI * 2); ctx.stroke();
        // score 텍스트
        ctx.fillStyle = isBest ? '#ffe650' : '#aaaaaa';
        ctx.font = `${7 / view.scale}px monospace`;
        ctx.fillText(c.score.toFixed(0), c.spotX + 5 / view.scale, c.spotY - 5 / view.scale);
      }
    }
  }

  // 9-b-6) Utility AI (debugUtility) — 선택 유닛의 행동 점수 + 이유 표시
  if (GAME.debugUtility && GAME.selectedId) {
    const sel = unitById(GAME.selectedId);
    if (sel && sel.aiUtilityDebug) {
      const d = sel.aiUtilityDebug;
      // 화면 좌표 (월드)
      const baseX = sel.x + 14;
      const baseY = sel.y - 50;
      // 배경 박스
      const lineH = 9 / view.scale;
      const lines = [];
      const intentStr = sel.aiIntent || 'none';
      const curStr = d.currentType ? `${d.currentType}(${(d.currentScore != null ? d.currentScore.toFixed(0) : '?')})` : '—';
      lines.push(`AI ${sel.name}: ${intentStr}`);
      lines.push(`cur: ${curStr}  pick: ${d.picked}`);
      if (d.reason) lines.push(`why: ${d.reason}`);
      lines.push(`thr:${d.threat || '-'} fp:${d.fpBalance != null ? d.fpBalance.toFixed(1) : '0'} cs:${d.coverScore || '-'}`);
      // SIDE-WEAPON-PLATFORM-1A §23.5: 무기 슬롯/간섭/거치/빌드 debug
      if (sel.weaponState && typeof resolveActiveWeapon === 'function') {
        const ws = sel.weaponState;
        const wp = sel._resolvedWeaponProfile || resolveActiveWeapon(sel);
        if (wp) {
          const presetShort = wp.presetId && WEAPON_PRESET_REGISTRY[wp.presetId] ? WEAPON_PRESET_REGISTRY[wp.presetId].shortName : (wp.customModified ? 'CUSTOM' : '');
          lines.push(`WEAPON: ${ws.activeSlot} ${wp.resolvedName} ${presetShort} ${wp.obstructionLengthMm}mm ${ws.obstructionState}`);
          if (ws.obstructionState !== 'clear') lines.push(`OBSTRUCT: ${getWeaponObstructionLabel(ws.obstructionState)}`);
          if (ws.mounted) lines.push(`MOUNT: on arc±${Math.round((ws.mountArcLimit || 0) * 180 / Math.PI)}${ws._outsideArc ? ' OUT' : ''}`);
          if (ws.switching) lines.push(`SWITCH: →${ws.switchTarget} ${ws.switchTimer.toFixed(2)}s`);
          if (wp.customModified || wp.presetId) lines.push(`BUILD: ${wp.barrelId ? (WEAPON_BARREL_REGISTRY[wp.barrelId] ? WEAPON_BARREL_REGISTRY[wp.barrelId].shortName : wp.barrelId) : '-'} ${wp.opticId} ${wp.muzzleId || '-'} ${wp.foregripId || '-'}`);
        }
      }
      // coverState
      if (d.csType && d.csType !== 'none') {
        const q = d.csQuality ? d.csQuality.toFixed(2) : '0';
        const fire = d.csCanFire ? 'fire✓' : 'fire✗';
        lines.push(`cover: ${d.csType} q${q} ${fire}`);
      } else if (d.csType === 'none') {
        lines.push(`cover: exposed`);
      }
      if (d.enemyCover) lines.push(`enemy: behind ${d.enemyCover}`);
      // stance 정보
      if (sel.stanceTransition) {
        const st = sel.stanceTransition;
        const progress = (1 - st.timer / st.total) * 100;
        lines.push(`stance: ${st.from} → ${st.to} (${progress.toFixed(0)}%)`);
      } else {
        let s = sel.stance || 'standing';
        if (sel.forcedProneTimer > 0) s += ` (forced ${sel.forcedProneTimer.toFixed(1)}s)`;
        lines.push(`stance: ${s}`);
      }
      // proneTime / stanceTime
      if (sel.stance === 'prone' && sel.proneTime > 0) {
        lines.push(`proneTime: ${sel.proneTime.toFixed(1)}s`);
      }
      // immediate/potential threat 분리 정보
      if (d.hasImmediateThreat != null || d.hasPotentialThreat != null) {
        const imm = d.hasImmediateThreat ? `IMM(${d.immediateSrc || '?'})` : '-';
        const pot = d.hasPotentialThreat ? 'POT' : '-';
        lines.push(`threat: ${imm} ${pot}`);
      }
      // visibility 정보 — currentTarget의 가시성 상태
      if (sel.currentTarget && sel.currentTarget._lastVisReason) {
        const conf = sel.currentTarget._lastVisConfidence != null ? sel.currentTarget._lastVisConfidence.toFixed(2) : '?';
        lines.push(`tgt vis: ${conf} ${sel.currentTarget._lastVisReason}`);
      } else if (sel._lastCanSeeResult) {
        const r = sel._lastCanSeeResult;
        lines.push(`canSee: ${r.visible ? '✓' : '✗'} ${r.reason}`);
      }
      // === Medical 정보 ===
      if (GAME.debugMedical && sel.medical) {
        const m = sel.medical;
        lines.push('--- MEDICAL ---');
        lines.push(`life ${m.lifeStatus.toFixed(0)} body ${m.bodyHpTotal.toFixed(0)}/${m.bodyHpMax} blood ${(m.bloodMl/1000).toFixed(2)}L`);
        lines.push(`HR ${m.heartRate.toFixed(0)} BP ${m.systolicBP.toFixed(0)}/${m.diastolicBP.toFixed(0)} RESP ${m.breathingEfficiency.toFixed(0)}`);
        lines.push(`pain ${m.pain.toFixed(0)} shock ${m.shock.toFixed(0)} cons ${m.consciousness.toFixed(0)}`);
        if (m.externalBleedRate + m.internalBleedRate > 0.1) {
          lines.push(`bleed: ext ${m.externalBleedRate.toFixed(1)} int ${m.internalBleedRate.toFixed(1)} ml/s`);
        }
        // SIDE-MED-BASELINE-1 §11: source-of-truth / bodyTrajectory / candidate / ECG 요약
        {
          const src = m._bleedSource || (m.wounds && m.wounds.length ? 'wound' : 'legacy_fallback');
          lines.push(`MED: bleed=${src} (ext ${m.externalBleedRate.toFixed(1)} int ${m.internalBleedRate.toFixed(1)})`);
          const lw = m._lastDamageEvent && m._lastDamageEvent.bodyTrajectory;
          if (lw) {
            const depth = lw.woundDepthClass || lw.depthClass || '?';
            const bc = lw.bleedingClass || '?';
            lines.push(`  traj=${depth} / ${bc}`);
            // SIDE-MED-2B-1A §12: 현재 event wound의 candidate 라벨 (후보/의심 — 확정 아님). raw object 미표시.
            const cm = lw.candidateMap || [];
            if (cm.length) {
              const fmt = (c) => `${c.label}(${c.confidence[0]}/${c.severityHint[0]})`;
              const organs = cm.filter(c => c.type === 'organ' || c.type === 'cavity' || c.type === 'airway').slice(0, 4).map(fmt);
              const vessels = cm.filter(c => c.type === 'vessel').slice(0, 3).map(fmt);
              if (organs.length) lines.push(`  organ cand: ${organs.join(', ')}`);
              if (vessels.length) lines.push(`  vessel cand: ${vessels.join(', ')}`);
            }
            if (lw.majorVesselCandidate) lines.push(`  majorVessel: candidate only (확정 아님)`);
            const tg = lw.treatmentIndicationTags || [];
            if (tg.length) lines.push(`  treat tags: ${tg.slice(0, 6).join(', ')}`);
            if (!cm.length) lines.push(`  candidate: 없음 (${depth})`);
          }
          // SIDE-MED-2B-1B §9: internalBleedingModel 요약 (현재 wound)
          const wlist = m.wounds || [];
          const lwound = wlist.length ? wlist[wlist.length - 1] : null;
          const ibm = lwound && lwound.internalBleedingModel;
          if (ibm) {
            if (ibm.severity === 'none') lines.push(`  ib: none (${ibm.reason})`);
            else lines.push(`  ib=${ibm.severity} src=${ibm.sourceType} risk ${Math.max(ibm.cavityRisk, ibm.junctionalRisk, ibm.majorVesselRisk).toFixed(2)} evac ${ibm.evacuationPriority}`);
            lines.push(`  fieldCare=${ibm.fieldCareLimit}${ibm.surgeryRequiredCandidate ? ' / surgery cand' : ''}`);
          }
          // SIDE-MEDICAL-ORGAN-BLEEDING-1 §9: 확정/강한의심/후보 구분 + 내부출혈 분류 + 후송/처치 표식 (표시 전용)
          const cim = lwound && lwound.confirmedInjuryModel;
          if (cim) {
            if (cim.confirmed.length) lines.push(`  [확정] ${cim.confirmed.join(', ')}`);
            if (cim.probable.length) lines.push(`  [강한의심] ${cim.probable.slice(0, 5).join(', ')}`);
            if (!cim.confirmed.length && !cim.probable.length && cim.candidates.length) lines.push(`  [후보] ${cim.candidates.slice(0, 5).join(', ')} (확정 아님)`);
          }
          if (lwound && lwound.internalBleedingCategory) lines.push(`  내부출혈분류=${lwound.internalBleedingCategory} / 현장통제=${lwound.fieldControllability}`);
          if (lwound) {
            const _dc = [];
            if (lwound.surgeryRequiredCandidate) _dc.push('수술필요');
            if (lwound.transfusionRequiredCandidate) _dc.push('수혈필요');
            if (lwound.vascularControlRequiredCandidate) _dc.push('혈관통제필요');
            if ((lwound.treatmentIndicationTags || []).indexOf('definitiveCareRequired') >= 0) _dc.push('후송필요');
            if (_dc.length) lines.push(`  후송/처치(표시전용): ${_dc.join(', ')}`);
          }
          // SIDE-MED-2C §28: TCCC / chest / organ / hemorrhage 요약
          const ta = m.tcccAssessment;
          if (ta) lines.push(`  TCCC: phase=${ta.phase} march=${ta.marchStep} action=${ta.recommendedAction}`);
          // PRECARDIAC-1 §12: 생리/전심장 위험 요약 (rhythm 없음)
          const hdD = m.hemodynamics;
          if (hdD) lines.push(`  PHYS: blood ${Math.round(m.bloodMl)}ml hypo=${hdD.hypovolemiaSeverity || 'none'} MAP ${Math.round(hdD.map || 0)} O2 ${(hdD.oxygenDelivery != null ? hdD.oxygenDelivery : 1).toFixed(2)}${hdD.decompensatingShock ? ' DECOMP' : hdD.compensatedShock ? ' comp' : ''}`);
          const pcr = m.preCardiacRisk;
          if (pcr && (pcr.rhythmModelReadySignal || pcr.heartAdjacentTrack || pcr.severeChestTrauma)) lines.push(`  PRECARDIAC: ${pcr.arrestRiskHint ? 'arrestHint ' : ''}${pcr.severeChestTrauma ? 'chest! ' : ''}${pcr.heartAdjacentTrack ? 'heartAdj ' : ''}tension=${pcr.tensionPneumothoraxRisk} (risk source active)`);
          // CARDIAC-1R §20: 리듬/심전도 debug
          const crm = m.cardiacRhythmModel;
          if (crm) lines.push(`  CARDIAC: rhythm=${crm.rhythm} HR=${Math.round(m.heartRate)} risk=${crm.riskScore} class=${crm.rhythmClass}${crm.shockableHint ? ' SHOCKABLE' : ''}${!crm.perfusing ? ' nonperfusing' : ''} tags=${(crm.triggerTags || []).slice(0, 3).join(',')}`);
          // bleedingPulse — 가장 출혈 큰 wound 1개만
          if (m.wounds && m.wounds.length) {
            let topW = null, topR = 0;
            for (const w of m.wounds) { const r = (w._effExternal || 0) + (w._effInternal || 0); if (r > topR) { topR = r; topW = w; } }
            const bpm = topW && topW.bleedingPulseModel;
            if (bpm && topR > 0.5) lines.push(`  BLEEDPULSE: ${(bpm.tags || []).slice(0, 2).join(',') || 'steady'} HR=${Math.round(m.heartRate)} MAP=${Math.round((m.hemodynamics && m.hemodynamics.map) || 0)} pulseMod=${bpm.pulseModifier}`);
          }
          // FIELD-STAB-1 §16: field stabilization + evacuation debug
          const fsd = m.fieldStabilizationModel;
          if (fsd) {
            const fa = [];
            if (fsd.airwaySupport.active) fa.push(`airway q=${fsd.airwaySupport.quality.toFixed(2)} O2mod=${fsd.airwaySupport.oxygenDeliveryModifier.toFixed(2)}`);
            if (fsd.chestRelief.active) fa.push(`chestRelief tensionMod=${fsd.chestRelief.tensionReliefModifier.toFixed(2)} recur=${fsd.chestRelief.recurrenceRisk.toFixed(2)}`);
            if (fsd.pelvicControl.active) fa.push(`pelvic bleedMod=${fsd.pelvicControl.pelvicBleedModifier.toFixed(2)}`);
            if (fsd.junctionalControl.active) fa.push(`junctional pulseSupp=${fsd.junctionalControl.pulseSuppression.toFixed(2)}`);
            if (fsd.circulationSupport.active) fa.push(`circ fieldLimited mapMod=${fsd.circulationSupport.mapSupportModifier.toFixed(2)}`);
            if (fa.length) lines.push(`  FIELD: ${fa.join(' | ')}`);
          }
          const evd = m.evacuationModel;
          if (evd && evd.evacuationPriority && evd.evacuationPriority !== 'none') lines.push(`  EVAC: priority=${evd.evacuationPriority} tags=${(evd.reasonTags || []).slice(0, 3).join(',')}`);
          const lwound2 = wlist.length ? wlist[wlist.length - 1] : null;
          if (lwound2) {
            const hcm = lwound2.hemorrhageControlModel;
            if (hcm && hcm.isMassiveHemorrhage) lines.push(`  hemorrhage=${hcm.hemorrhageType} ctrl=${(hcm.controllableBy || []).join('/')} ${hcm.treatmentEffectLimit}`);
            const ctm = lwound2.chestTraumaModel;
            if (ctm && (ctm.openChestWound || ctm.pneumothoraxRisk > 0)) lines.push(`  chest open=${!!ctm.openChestWound} pneumo=${(ctm._pneumoProg != null ? ctm._pneumoProg : ctm.pneumothoraxRisk).toFixed(2)} tension=${(ctm.tensionPneumothoraxRisk || 0).toFixed(2)} seal=${lwound2.treatmentState && lwound2.treatmentState.chestSealed ? 'on' : 'off'}`);
            const otm = lwound2.openTorsoModel;
            if (otm && otm.openTorsoWound) lines.push(`  torso open=${!!otm.openAbdominalWound} contam=${(otm.contaminationRisk || 0).toFixed(2)} evisc=${otm.eviscerationStatus}`);
            const oim = lwound2.organInjuryModel;
            if (oim && oim.injuries.length) lines.push(`  organ: ${oim.injuries.slice(0, 3).map(i => i.organ + ':' + i.status + '(P' + i.priorityScore + '/' + i.bleedRisk + ')').join(', ')}${oim.confirmedCount ? ' (no rhythm model)' : ''}`);
          }
          lines.push(`  ECG: P-QRS-T rhythm-aware display (telemetry only, no AED/CPR)`);
        }
        lines.push(`mul: aim ${m.aimMul.toFixed(2)} mv ${m.moveMul.toFixed(2)} rx ${m.reactionMul.toFixed(2)} rl ${m.reloadMul.toFixed(2)}`);
        // === 1.5단계 — stressResponse / hemodynamics / hormonal ===
        if (m.stressResponse) {
          const sr = m.stressResponse;
          lines.push(`stress: arousal ${sr.combatArousal.toFixed(2)} adren ${sr.adrenaline.toFixed(2)} panic ${sr.panic.toFixed(2)}`);
          lines.push(`  symp ${sr.sympatheticTone.toFixed(2)} mask ${sr.painMasking.toFixed(2)} percPain ${sr.perceivedPain.toFixed(0)} crash ${sr.postCombatCrash.toFixed(2)}`);
          lines.push(`  t/threat ${sr.timeSinceLastThreat.toFixed(1)}s t/dmg ${sr.timeSinceLastDamage.toFixed(1)}s`);
        }
        if (m.hemodynamics) {
          const hd = m.hemodynamics;
          lines.push(`hemo: vol ${hd.volumeRatio.toFixed(2)} preload ${hd.preload.toFixed(2)} tone ${hd.vascularTone.toFixed(2)} contr ${hd.contractility.toFixed(2)}`);
          lines.push(`  SV ${hd.strokeVolumeMul.toFixed(2)} CO ${hd.cardiacOutputMul.toFixed(2)} MAP ${hd.map.toFixed(0)} perf ${hd.tissuePerfusion.toFixed(2)} O2 ${hd.oxygenDelivery.toFixed(2)}`);
          lines.push(`  load ${hd.compensationLoad.toFixed(2)} exhaust ${hd.compensationExhaustion.toFixed(2)} ${hd.compensatedShock?'CompShock':''} ${hd.decompensatingShock?'DECOMP':''}`);
        }
        if (m.hormonalCompensation) {
          const hc = m.hormonalCompensation;
          lines.push(`hormonal: ADH ${hc.vasopressin.toFixed(2)} RAAS ${hc.raasActivation.toFixed(2)} angio ${hc.angiotensinTone.toFixed(2)} cort ${hc.cortisolStress.toFixed(2)}`);
        }
        if (m.statusTags && m.statusTags.length > 0) {
          lines.push(`tags: ${m.statusTags.join(', ')}`);
        }
        if (m._lastDamageEvent) {
          const e = m._lastDamageEvent;
          const ar = e.armorResultRaw || e.armorResult;
          lines.push(`last DMG: ${e.sourceType} ${e.partKey} ${ar} body-${e.bodyDmg.toFixed(0)}`);
          // 2A-1 impactAddress
          const ia = e.impactAddress;
          if (ia) {
            if (ia.aarLabel) lines.push(`  → ${ia.aarLabel}`);
            lines.push(`  addr: ${ia.debugLabel || (ia.hitPart+'/'+ia.impactSide)}`);
            if (ia.anatomicalClass) lines.push(`  class: ${getAnatomicalClassLabel(ia.anatomicalClass)}${(ia.junctionClass&&ia.junctionClass!=='none')?' / '+getJunctionClassLabel(ia.junctionClass):''}`);
            if (ia.sourceModel) lines.push(`  model: ${ia.sourceModel}`);
            if (ia.baseCoverage) lines.push(`  base h/s/n: ${(ia.baseCoverage.hardP*100).toFixed(0)}/${(ia.baseCoverage.softP*100).toFixed(0)}/${(ia.baseCoverage.noneP*100).toFixed(0)}`);
            if (ia.transformedCoverage) lines.push(`  transf h/s/n: ${(ia.transformedCoverage.hardP*100).toFixed(0)}/${(ia.transformedCoverage.softP*100).toFixed(0)}/${(ia.transformedCoverage.noneP*100).toFixed(0)}`);
            if (ia.anatomicalZone) lines.push(`  anat: ${ia.anatomicalZone}`);
            if (ia.organCandidates && ia.organCandidates.length) lines.push(`  organs: ${ia.organCandidates.join(', ')}`);
            if (ia.structureCandidates && ia.structureCandidates.length) lines.push(`  struct: ${ia.structureCandidates.join(', ')}`);
            if (ia._slaapCandidate) lines.push(`  SLAAP: candidate (실제 미반영)`);
            if (ia.accessoryType === 'SLAAP') lines.push(`  SLAAP: 실제 방호 반영`);
            if (ia.crackHint && ia.crackHint.eligible) lines.push(`  crack: ${ia.crackHint.type} (${ia.crackHint.material})`);
            if (ia.durabilityGroupHint) lines.push(`  durGroup: ${ia.durabilityGroupHint}${ia.damageTypeHint ? ' ['+ia.damageTypeHint.join('/')+']' : ''}`);
            if (ia.ricochetHint && ia.ricochetHint.eligible) {
              const rh = ia.ricochetHint;
              lines.push(`  ricochet: ${(rh.chance*100).toFixed(0)}% ${rh.ricocheted?'(RICOCHETED)':''}`);
              lines.push(`    base ${(rh.baseAmmoRicochet*100||0).toFixed(0)}%[${rh.ammoSource}] ×ammoMul ${(rh.ammoRicochetMul||1).toFixed(2)} ×curv ${rh.zoneCurvatureMul.toFixed(2)} ×mat ${rh.materialMul.toFixed(2)} ×ang ${rh.angleMul.toFixed(2)}`);
            }
            if (ia.blastInfo) lines.push(`  blast: ${ia.blastInfo.tier} int ${ia.blastInfo.intensity}`);
          }
        }
      }
      // goProne 점수 분해
      if (d.goProneRaw != null) {
        lines.push(`goProne: raw ${d.goProneRaw} - cost ${d.goProneCost} = ${d.goProneFinal}`);
      }
      if (d.goProneBlockedReason) lines.push(`goProne blocked: ${d.goProneBlockedReason}`);
      // grace
      if (d.inGrace) lines.push(`grace: ${d.inGrace}`);
      // scan 정보
      if (sel.aiMemory) {
        const m = sel.aiMemory;
        if (m._lastScanCenter) {
          const deg = (m._lastScanCenter.angle * 180 / Math.PI).toFixed(0);
          lines.push(`scan: center ${deg}° (${m._lastScanCenter.source})`);
        }
        if (m.scanOffset != null) {
          const offDeg = (m.scanOffset * 180 / Math.PI).toFixed(1);
          lines.push(`scan offset: ${offDeg}°`);
        }
      }
      if (sel._initialBurst && sel._initialBurst.phase !== 'complete') {
        lines.push(`burst: ${sel._initialBurst.phase}`);
      }
      if (sel._proneReason) lines.push(`prone: ${sel._proneReason}`);
      if (sel.proneLockUntil != null && (GAME.gameTime || 0) < sel.proneLockUntil) {
        const remaining = sel.proneLockUntil - (GAME.gameTime || 0);
        lines.push(`prone lock: ${remaining.toFixed(1)}s`);
      }
      if (sel.lastProneExitTime != null) {
        const since = (GAME.gameTime || 0) - sel.lastProneExitTime;
        if (since < 3.0) lines.push(`getup ago: ${since.toFixed(1)}s`);
      }
      // shouldStayProne 결과 (디버그용 — 매 평가에서 계산되어 ctx에 저장됨)
      if (sel.stance === 'prone' && sel._proneReason === 'utility' && sel._lastShouldStayProne != null) {
        const tag = sel._lastShouldStayProne ? 'STAY' : 'getup OK';
        const real = sel._lastHasRealThreat ? '+threat' : '';
        lines.push(`prone check: ${tag}${real}`);
      }
      if (sel.lastGrenadeThreat && (GAME.gameTime - sel.lastGrenadeThreat.time) < 10) {
        const lgt = sel.lastGrenadeThreat;
        const dirDeg = lgt.suspectedDir != null ? (lgt.suspectedDir * 180 / Math.PI).toFixed(0) : '?';
        lines.push(`grenade src dir: ${dirDeg}° (conf ${lgt.confidence.toFixed(1)})`);
      }
      if (sel.lastGrenadeEvent && (GAME.gameTime - sel.lastGrenadeEvent.time) < 10) {
        const lge = sel.lastGrenadeEvent;
        const dirDeg = lge.suspectedDir != null ? (lge.suspectedDir * 180 / Math.PI).toFixed(0) : '?';
        lines.push(`grenade event: src ${dirDeg}° (conf ${lge.sourceConfidence.toFixed(1)})`);
      }
      if (sel.grenadeSourceWatchTimer > 0) {
        lines.push(`grenade watch: ${sel.grenadeSourceWatchTimer.toFixed(1)}s`);
      }
      if (sel._lastGrenadeReactDebug) {
        const d = sel._lastGrenadeReactDebug;
        if (d.ignored) {
          let extra = '';
          if (d.closestApproachM != null) extra += ` closest:${d.closestApproachM}m`;
          if (d.movingTowardUnit !== undefined) extra += d.movingTowardUnit ? ' →approach' : ' →away';
          lines.push(`grenade ignore: ${d.ignored}${extra}`);
        } else {
          lines.push(`grenade: reacted`);
        }
      }
      // stance 일관성 검사 — effective vs actual
      const effStance = (typeof getEffectiveStance === 'function') ? getEffectiveStance(sel) : sel.stance;
      if (effStance !== sel.stance) {
        lines.push(`stance mismatch: actual=${sel.stance} eff=${effStance}`);
      }
      if (sel._lastEvadeCandidates) {
        const valid = sel._lastEvadeCandidates.filter(c => c.valid).length;
        const total = sel._lastEvadeCandidates.length;
        lines.push(`evade: ${valid}/${total} valid`);
      }
      if (d.currentAreaType || d.targetAreaType) {
        lines.push(`area: ${d.currentAreaType || '-'} → ${d.targetAreaType || '-'}`);
      }
      if (d.coverNudged) lines.push(`slot nudged: ${d.coverNudged}x`);
      lines.push(`-- top 5 --`);
      if (d.top) {
        for (const c of d.top) {
          const tag = (sel.aiAction && sel.aiAction.type === c.type) ? '►' : ' ';
          lines.push(`${tag} ${c.type} ${c.score.toFixed(0)}`);
        }
      }
      // 배경
      const boxW = 130 / view.scale;
      const boxH = lines.length * lineH + 6 / view.scale;
      ctx.fillStyle = 'rgba(8, 14, 20, 0.85)';
      ctx.fillRect(baseX, baseY, boxW, boxH);
      ctx.strokeStyle = 'rgba(120, 180, 255, 0.6)';
      ctx.lineWidth = 0.5 / view.scale;
      ctx.strokeRect(baseX, baseY, boxW, boxH);
      // 텍스트
      ctx.font = `${7 / view.scale}px monospace`;
      ctx.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        const isHeader = (i === 0);
        const isCurrent = lines[i].startsWith('►');
        ctx.fillStyle = isHeader ? '#ffe650' : (isCurrent ? '#90ff90' : '#cfd6dd');
        ctx.fillText(lines[i], baseX + 3 / view.scale, baseY + 3 / view.scale + i * lineH);
      }
      ctx.textBaseline = 'alphabetic';
      // 현재 행동 목표 위치 (있으면) — 노란 선
      if (sel.aiAction && sel.aiAction.targetX != null) {
        ctx.strokeStyle = 'rgba(255,230,80,0.7)';
        ctx.lineWidth = 1.0 / view.scale;
        ctx.setLineDash([4 / view.scale, 3 / view.scale]);
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y);
        ctx.lineTo(sel.aiAction.targetX, sel.aiAction.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,230,80,0.9)';
        ctx.beginPath();
        ctx.arc(sel.aiAction.targetX, sel.aiAction.targetY, 4 / view.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      // coverState ray — threat 방향으로의 검증 ray
      if (sel.coverState && sel.coverState.threatAngle != null) {
        const cs = sel.coverState;
        const len = 120;
        const tx = sel.x + Math.cos(cs.threatAngle) * len;
        const ty = sel.y + Math.sin(cs.threatAngle) * len;
        let col;
        if (cs.coverType === 'fullCover' || cs.coverType === 'wallBlocked') col = 'rgba(120,255,160,0.85)';
        else if (cs.coverType === 'partialCover') col = 'rgba(255,200,80,0.75)';
        else col = 'rgba(255,80,80,0.65)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2 / view.scale;
        ctx.beginPath(); ctx.moveTo(sel.x, sel.y); ctx.lineTo(tx, ty); ctx.stroke();
        // cover/wall 차단 위치 표시
        if (cs.coverDistance != null && isFinite(cs.coverDistance)) {
          const bx = sel.x + Math.cos(cs.threatAngle) * cs.coverDistance;
          const by = sel.y + Math.sin(cs.threatAngle) * cs.coverDistance;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(bx, by, 4 / view.scale, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  // 9-b-7) Personal Space (debugPersonalSpace) — separation 영역 표시
  if (GAME.debugPersonalSpace && Array.isArray(UNITS)) {
    for (const u of UNITS) {
      if (u.isDead) continue;
      // 강제 분리 거리 — 빨강
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.45)';
      ctx.lineWidth = 0.5 / view.scale;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      // 약한 분리 — 노랑
      ctx.strokeStyle = 'rgba(255, 220, 80, 0.25)';
      ctx.beginPath();
      ctx.arc(u.x, u.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 9-b-8) AI Scan Sweep (debugAIScan) — 최근 ray fade 표시 (실제 hit 거리까지만)
  if (GAME.debugAIScan && Array.isArray(UNITS)) {
    const now = GAME.gameTime || 0;
    for (const u of UNITS) {
      if (!u.aiMemory || !u.aiMemory._recentScanRays) continue;
      const rays = u.aiMemory._recentScanRays;
      for (const r of rays) {
        const age = now - r.time;
        if (age > 1.5) continue;
        const alpha = Math.max(0, 1 - age / 1.5) * 0.45;
        // 색상 — source + hitKind
        let col;
        if (r.hitKind === 'wall')       col = `rgba(255, 80, 80, ${alpha})`;
        else if (r.hitKind === 'full')  col = `rgba(255, 140, 60, ${alpha})`;
        else if (r.hitKind === 'enemy') col = `rgba(255, 60, 200, ${alpha})`;
        else if (r.source === 'initialBurstPass1') col = `rgba(120, 200, 255, ${alpha})`;
        else if (r.source === 'initialBurstPass2') col = `rgba(180, 140, 255, ${alpha})`;
        else col = `rgba(180, 220, 180, ${alpha * 0.7})`;
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.5 / view.scale;
        // 실제 hit 거리까지 그림 (wall/fullCover 관통 X)
        const hitDist = r.hitDist != null ? r.hitDist : r.maxPx;
        const dx = Math.cos(r.ang) * hitDist;
        const dy = Math.sin(r.ang) * hitDist;
        ctx.beginPath();
        ctx.moveTo(r.ox, r.oy);
        ctx.lineTo(r.ox + dx, r.oy + dy);
        ctx.stroke();
      }
      if (u._initialBurst && u._initialBurst.phase !== 'complete') {
        ctx.fillStyle = 'rgba(120, 200, 255, 0.9)';
        ctx.font = `${10 / view.scale}px sans-serif`;
        ctx.fillText(`burst:${u._initialBurst.phase}`, u.x + 8, u.y - 16);
      }
    }
  }

  // 9-b-9) Visibility debug — selected unit이 각 적에게 보이는지 + reason
  if (GAME.debugVisibility && GAME.selectedId != null && Array.isArray(UNITS)) {
    const sel = UNITS.find(u => u.id === GAME.selectedId);
    if (sel && typeof checkVisibility === 'function') {
      for (const t of UNITS) {
        if (t.team === sel.team || t.isDead || t === sel) continue;
        const vr = checkVisibility(sel, t);
        // 선
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y);
        ctx.lineTo(t.x, t.y);
        if (vr.visible) {
          const c = vr.confidence;
          ctx.strokeStyle = c >= 0.7 ? 'rgba(80, 255, 100, 0.6)' : (c >= 0.4 ? 'rgba(255, 200, 80, 0.6)' : 'rgba(255, 100, 80, 0.5)');
        } else {
          ctx.strokeStyle = 'rgba(120, 120, 120, 0.35)';
        }
        ctx.lineWidth = 1 / view.scale;
        ctx.setLineDash([4 / view.scale, 4 / view.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
        // target 위 작은 라벨
        const lbl = vr.visible ? `${vr.confidence.toFixed(2)}` : '✗';
        ctx.fillStyle = vr.visible ? '#90ff90' : '#888';
        ctx.font = `${9 / view.scale}px monospace`;
        ctx.fillText(lbl, t.x + 8, t.y - 4);
      }
    }
  }

  // 9-c) 투척 모드 — 사거리 원 + 조준 마커 + 경로 미리보기
  if (GAME.throwMode) {
    const u = unitById(GAME.throwMode.unitId);
    if (u) {
      const preset = THROWABLE_PRESETS[GAME.throwMode.throwableId];
      if (preset) {
        const rPx = preset.throwRange * PX_PER_M_FALLBACK;
        // 사거리 원
        ctx.strokeStyle = 'rgba(255, 200, 80, 0.35)';
        ctx.setLineDash([5 / view.scale, 4 / view.scale]);
        ctx.lineWidth = 1.0 / view.scale;
        ctx.beginPath(); ctx.arc(u.x, u.y, rPx, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // 미리보기 경로
        const traj = GAME.throwMode.previewTrajectory;
        const launch = GAME.throwMode.previewLaunch;
        if (traj && traj.path && traj.path.length >= 2) {
          // 자동 모서리 — 출발점 다르면 캐릭터 → launch 점선
          if (launch && launch.autoCorner) {
            ctx.strokeStyle = 'rgba(120, 200, 255, 0.55)';
            ctx.setLineDash([2 / view.scale, 3 / view.scale]);
            ctx.lineWidth = 1.4 / view.scale;
            ctx.beginPath();
            ctx.moveTo(u.x, u.y); ctx.lineTo(launch.x, launch.y);
            ctx.stroke();
            ctx.setLineDash([]);
            // launch 지점 마커
            ctx.fillStyle = 'rgba(120, 200, 255, 0.85)';
            ctx.beginPath(); ctx.arc(launch.x, launch.y, 3 / view.scale, 0, Math.PI * 2);
            ctx.fill();
          }
          // 경로 — 차단 / 정상에 따라 색
          ctx.strokeStyle = traj.blocked
            ? 'rgba(255, 100, 60, 0.85)'
            : 'rgba(120, 255, 140, 0.85)';
          ctx.lineWidth = 2.0 / view.scale;
          ctx.setLineDash([4 / view.scale, 3 / view.scale]);
          ctx.beginPath();
          ctx.moveTo(traj.path[0].x, traj.path[0].y);
          for (let i = 1; i < traj.path.length; i++) {
            ctx.lineTo(traj.path[i].x, traj.path[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          // 튕김 지점 표시
          for (const b of traj.bounces) {
            ctx.fillStyle = 'rgba(255, 200, 80, 0.95)';
            ctx.strokeStyle = 'rgba(255, 200, 80, 0.6)';
            ctx.lineWidth = 1.0 / view.scale;
            ctx.beginPath(); ctx.arc(b.x, b.y, 4 / view.scale, 0, Math.PI * 2);
            ctx.fill();
            // 작은 X
            const s = 3 / view.scale;
            ctx.beginPath();
            ctx.moveTo(b.x - s, b.y - s); ctx.lineTo(b.x + s, b.y + s);
            ctx.moveTo(b.x - s, b.y + s); ctx.lineTo(b.x + s, b.y - s);
            ctx.stroke();
          }
          // 끝점 마커 — 폭발 위치 미리보기
          const ex = traj.endX, ey = traj.endY;
          // 폭발 lethal 반경 미리보기
          const lethPx = (preset.blastRadiusLethal || 2) * PX_PER_M_FALLBACK;
          const outerPx = (preset.blastRadiusOuter || 5) * PX_PER_M_FALLBACK;
          ctx.fillStyle = 'rgba(255, 100, 60, 0.15)';
          ctx.beginPath(); ctx.arc(ex, ey, outerPx, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255, 60, 40, 0.25)';
          ctx.beginPath(); ctx.arc(ex, ey, lethPx, 0, Math.PI * 2); ctx.fill();
          // 중심 마커 — 손가락 따라가는 위치
          ctx.strokeStyle = '#ffcc40';
          ctx.fillStyle = 'rgba(255, 200, 80, 0.9)';
          ctx.lineWidth = 2.0 / view.scale;
          ctx.beginPath(); ctx.arc(ex, ey, 6 / view.scale, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // 십자선
          const cs = 8 / view.scale;
          ctx.strokeStyle = 'rgba(255, 230, 100, 0.9)';
          ctx.lineWidth = 1.0 / view.scale;
          ctx.beginPath();
          ctx.moveTo(ex - cs, ey); ctx.lineTo(ex + cs, ey);
          ctx.moveTo(ex, ey - cs); ctx.lineTo(ex, ey + cs);
          ctx.stroke();
        }
        // 안내 텍스트
        ctx.fillStyle = '#ffe066';
        ctx.font = `${11 / view.scale}px sans-serif`;
        const distM = (Math.hypot(GAME.throwMode.aimX - u.x, GAME.throwMode.aimY - u.y) / PX_PER_M_FALLBACK).toFixed(1);
        const note = GAME.throwMode.dragging ? '드래그 중 — 떼면 던짐' : '화면을 드래그해 조준';
        ctx.fillText(`${preset.shortName} ${distM}m · ${note}`, u.x + 15, u.y - 15);
      }
    }
  }

  // 9b) 디버그 — 소음 원 + lastHeard 위치
  if (GAME.debugNoise) {
    ctx.lineWidth = 1.0 / view.scale;
    for (const n of GAME.noiseEvents) {
      const age = (GAME.gameTime - n.time) / n.decayTime;
      const a = Math.max(0, 1 - age);
      ctx.strokeStyle = `rgba(255, 200, 80, ${0.4 * a})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 200, 80, ${0.8 * a})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // lastHeard 표시 (적 AI만)
    for (const u of UNITS) {
      if (u.team !== 'enemy' || !u.lastHeardNoise) continue;
      const h = u.lastHeardNoise;
      ctx.strokeStyle = `rgba(255, 120, 60, ${0.6 * h.confidence})`;
      ctx.setLineDash([3 / view.scale, 2 / view.scale]);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawViewCone(u) {
  const _arc = (typeof getEffectiveViewArc === 'function') ? getEffectiveViewArc(u) : u.viewArc;
  const half = _arc / 2;
  const N = 26;
  ctx.beginPath();
  ctx.moveTo(u.x, u.y);
  for (let i = 0; i <= N; i++) {
    const a = u.facing - half + (_arc * i / N);
    const dx = Math.cos(a), dy = Math.sin(a);
    const wh = rayDistToWalls(u.x, u.y, dx, dy, u.sightRange);
    let t = wh.t;
    // blocksLOS cover도 시야 막음
    if (MAP_DATA.coverObjects) {
      for (const o of MAP_DATA.coverObjects) {
        if (o.blocksLOS !== true) continue;
        const tc = rayBoxT(u.x, u.y, dx, dy, o, t);
        if (tc < t) t = tc;
      }
    }
    ctx.lineTo(u.x + dx * t, u.y + dy * t);
  }
  ctx.closePath();
  const sel = (u.id === GAME.selectedId);
  ctx.fillStyle   = sel ? 'rgba(120, 180, 240, 0.18)' : 'rgba(74, 144, 196, 0.09)';
  ctx.strokeStyle = sel ? 'rgba(120, 180, 240, 0.55)' : 'rgba(74, 144, 196, 0.30)';
  ctx.lineWidth = 0.8 / view.scale;
  ctx.fill();
  ctx.stroke();
}

// 문 렌더 — 안정 상태에서는 물리 사각형을 그대로 그린다(렌더와 물리가 어긋나지 않게).
//   전환 중에만 경첩을 축으로 각도를 보간해 스윙을 보여 준다. 충돌에는 쓰지 않는다.
function drawDoor(d, style) {
  const th = d.leafTh || 8;
  const L = d.gapMax - d.gapMin;
  const mid = d.wallPos + (d.wallTh || th) / 2;
  // 문틀 — 문이 열려 있어도 "여기 문이 있다"가 보여야 한다
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 224, 102, 0.28)';
  ctx.lineWidth = 1.4 / view.scale;
  ctx.setLineDash([5 / view.scale, 4 / view.scale]);
  ctx.beginPath();
  if (d.axis === 'h') { ctx.moveTo(d.gapMin, mid); ctx.lineTo(d.gapMax, mid); }
  else                { ctx.moveTo(mid, d.gapMin); ctx.lineTo(mid, d.gapMax); }
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  if (!d.transition) {
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeRect(d.x, d.y, d.w, d.h);
  } else {
    // 스윙 보간 — 경첩 모서리를 축으로 닫힘 방향에서 열림 방향으로
    const p = doorSwingProgress(d);
    const atMax = (d.hinge === 'max');
    const sw = (d.swing > 0) ? 1 : -1;
    let hx, hy, a0, a1;
    if (d.axis === 'h') {
      hx = atMax ? d.gapMax : d.gapMin; hy = mid;
      a0 = atMax ? Math.PI : 0;
      a1 = (sw > 0) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      hx = mid; hy = atMax ? d.gapMax : d.gapMin;
      a0 = atMax ? -Math.PI / 2 : Math.PI / 2;
      a1 = (sw > 0) ? 0 : Math.PI;
    }
    let da = a1 - a0;
    while (da >  Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    ctx.save();
    ctx.translate(hx, hy);          // 경첩선 = 문틀 중심선 위의 간극 끝
    ctx.rotate(a0 + da * p);
    ctx.fillRect(0, -th / 2, L, th);
    ctx.strokeRect(0, -th / 2, L, th);
    ctx.restore();
  }
  // 경첩 표시
  const c = doorCenter(d);
  const hpx = (d.axis === 'h')
    ? { x: (d.hinge === 'max') ? d.gapMax : d.gapMin, y: mid }
    : { x: mid, y: (d.hinge === 'max') ? d.gapMax : d.gapMin };
  ctx.save();
  ctx.fillStyle = 'rgba(255, 224, 102, 0.7)';
  ctx.beginPath(); ctx.arc(hpx.x, hpx.y, 2.2 / view.scale + 1.2, 0, Math.PI * 2); ctx.fill();
  // 대원이 선택돼 있으면 닫힌 문에 "탭해서 열 수 있다" 표시
  if (GAME.selectedId && d.state === 'closed' && !d.transition) {
    ctx.strokeStyle = 'rgba(120, 220, 140, 0.55)';
    ctx.lineWidth = 1.6 / view.scale;
    ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.stroke();
  }
  if (d.transition) {
    ctx.strokeStyle = 'rgba(255, 224, 102, 0.8)';
    ctx.lineWidth = 2.0 / view.scale;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * doorSwingProgress(d));
    ctx.stroke();
  }
  ctx.restore();
}

function drawPath(unit, dim) {
  if (unit.movePath.length === 0) return;
  const alpha = dim ? 0.30 : 1.0;
  ctx.strokeStyle = `rgba(255, 224, 102, ${alpha})`;
  ctx.lineWidth = 2 / view.scale;
  ctx.setLineDash([6 / view.scale, 5 / view.scale]);
  ctx.beginPath();
  ctx.moveTo(unit.x, unit.y);
  for (const p of unit.movePath) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // waypoint 점 + 번호 + facing 화살표
  for (let i = 0; i < unit.movePath.length; i++) {
    const p = unit.movePath[i];
    const isSelected = (!dim) && (GAME.selectedWpIdx === i);
    const baseR = 5 / view.scale * (dim ? 0.7 : 1.0) + 2;

    // 선택 링
    if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.6 / view.scale;
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseR + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // waypoint 본체
    ctx.fillStyle = `rgba(255, 224, 102, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2);
    ctx.fill();

    // 번호
    if (!dim) {
      ctx.fillStyle = '#0a0e12';
      ctx.font = `${10}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.x, p.y);
    }

    // facing 화살표
    if (p.facing != null) {
      const ux = Math.cos(p.facing), uy = Math.sin(p.facing);
      const armLen = dim ? 18 : 26;
      ctx.strokeStyle = `rgba(255, 224, 102, ${dim ? 0.6 : 0.95})`;
      ctx.lineWidth = (dim ? 1.2 : 1.6) / view.scale;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + ux * armLen, p.y + uy * armLen);
      ctx.stroke();
      const ah = 5;
      const ex = p.x + ux * armLen, ey = p.y + uy * armLen;
      ctx.beginPath();
      ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(p.facing - 0.4) * ah, ey - Math.sin(p.facing - 0.4) * ah);
      ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(p.facing + 0.4) * ah, ey - Math.sin(p.facing + 0.4) * ah);
      ctx.stroke();
    }
  }
}

// SIDE-VISUAL-UNIT-GRENADE-DUST-HOTFIX-1 (항목1,2,3): 사람 형상(탑다운) 실루엣 + 오른손 총기 — 시각 전용 (hitbox/medical/입력판정 불변)
function getUnitFacingVector(u) { const a = u.facing || 0; return { x: Math.cos(a), y: Math.sin(a) }; }
function getUnitRightVector(u) { const a = (u.facing || 0) + Math.PI / 2; return { x: Math.cos(a), y: Math.sin(a) }; }   // facing +90°(screen 시계방향) = 유닛 오른쪽
function getUnitWeaponVisualAnchors(u, weapon) {
  const r = UNIT_RADIUS;
  const f = getUnitFacingVector(u), rt = getUnitRightVector(u);
  const sx = u.x + f.x * (r * 0.20) + rt.x * (r * 0.34), sy = u.y + f.y * (r * 0.20) + rt.y * (r * 0.34);   // 오른 어깨
  const hx = u.x + f.x * (r * 0.50) + rt.x * (r * 0.26), hy = u.y + f.y * (r * 0.50) + rt.y * (r * 0.26);   // 오른 손
  const mm = (weapon && weapon.obstructionLengthMm) ? weapon.obstructionLengthMm : 700;   // 무기 길이(mm)로 시각 길이 결정
  let len; if (mm < 300) len = r * 0.7; else if (mm < 560) len = r * 1.05; else if (mm < 820) len = r * 1.5; else len = r * 1.95;
  return { shoulder: { x: sx, y: sy }, hand: { x: hx, y: hy }, muzzle: { x: sx + f.x * len, y: sy + f.y * len }, length: len };
}
function renderUnitHumanSilhouette(ctx, u, fillBase, strokeBase) {
  const r = UNIT_RADIUS;
  ctx.save();
  ctx.translate(u.x, u.y); ctx.rotate(u.facing || 0);   // local +x=전방, +y=오른쪽
  ctx.lineWidth = 1.3 / view.scale;
  // 몸통 — 어깨가 넓은 타원 (x=전후 깊이, y=좌우 어깨폭)
  ctx.fillStyle = fillBase; ctx.strokeStyle = strokeBase;
  ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.72, r * 0.92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 머리 — 전방 작은 원 (방향 명확화)
  ctx.beginPath(); ctx.arc(r * 0.48, 0, r * 0.40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function renderUnitWeaponInHands(ctx, u, weapon) {
  if (!u.alive) return;
  const a = getUnitWeaponVisualAnchors(u, weapon);
  const r = UNIT_RADIUS;
  ctx.save();
  ctx.strokeStyle = '#2a2d33'; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.6, 2.4) / view.scale;
  // 총열
  ctx.beginPath(); ctx.moveTo(a.shoulder.x, a.shoulder.y); ctx.lineTo(a.muzzle.x, a.muzzle.y); ctx.stroke();
  // 개머리판 느낌 — 어깨 뒤로 짧게 (소총류만, 길이 충분할 때)
  if (a.length > r * 1.1) {
    const f = getUnitFacingVector(u);
    ctx.lineWidth = Math.max(1.2, 1.8) / view.scale;
    ctx.beginPath(); ctx.moveTo(a.shoulder.x, a.shoulder.y); ctx.lineTo(a.shoulder.x - f.x * r * 0.35, a.shoulder.y - f.y * r * 0.35); ctx.stroke();
  }
  ctx.restore();
}
function drawUnit(u) {
  // passive 표적은 항상 보임 (사격장)
  // 일반 적은 _spotted일 때만 렌더
  const isPassive = (u.role === 'passive');
  if (u.team === 'enemy' && !isPassive && !u._spotted && u.alive) return;

  const r = UNIT_RADIUS;
  if (!u.alive) {
    // 시신 표시
    ctx.fillStyle = u.team === 'friend' ? 'rgba(60, 90, 120, 0.5)' : 'rgba(120, 50, 50, 0.5)';
    ctx.strokeStyle = u.team === 'friend' ? 'rgba(80, 110, 140, 0.8)' : 'rgba(150, 70, 70, 0.8)';
    ctx.lineWidth = 1.2 / view.scale;
    ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // X 마크
    const m = r * 0.7;
    ctx.beginPath();
    ctx.moveTo(u.x - m, u.y - m); ctx.lineTo(u.x + m, u.y + m);
    ctx.moveTo(u.x - m, u.y + m); ctx.lineTo(u.x + m, u.y - m);
    ctx.stroke();
    return;
  }

  // 선택 링
  if (u.id === GAME.selectedId) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2 / view.scale;
    ctx.beginPath(); ctx.arc(u.x, u.y, r + 4, 0, Math.PI * 2); ctx.stroke();
  }

  // 본체 — passive는 흐릿한 회색/올리브
  const fillBase = isPassive
    ? '#5a5a40'
    : (u.team === 'friend' ? '#4a90c4' : '#c64040');
  const strokeBase = isPassive
    ? '#a0a070'
    : (u.team === 'friend' ? '#80c0ff' : '#ff6060');

  // === downed 시각화: 누운 타원 + 의식 X 표시 ===
  if (u.isDowned) {
    const isUnconscious = !u.conscious;
    ctx.save();
    // 누운 타원 — 폭이 더 크고 높이 낮음, facing 방향으로 회전
    ctx.translate(u.x, u.y);
    ctx.rotate(u.facing);
    ctx.fillStyle = isUnconscious
      ? (u.team === 'friend' ? '#2a4858' : '#5a2828')
      : fillBase;
    ctx.strokeStyle = isUnconscious
      ? (u.team === 'friend' ? '#4a7088' : '#883838')
      : strokeBase;
    ctx.lineWidth = 1.4 / view.scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.7, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // unconscious — X 표시 / conscious — 작은 점
    if (isUnconscious) {
      const m = r * 0.55;
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 1.5 / view.scale;
      ctx.beginPath();
      ctx.moveTo(-m, -m); ctx.lineTo(m, m);
      ctx.moveTo(-m, m);  ctx.lineTo(m, -m);
      ctx.stroke();
    } else {
      // conscious — 중앙 점 (눈 뜸)
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.20, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // bleeding overlay 등 추가 표시는 그대로 유지하기 위해 일단 진행
    return;
  }

  // === prone 시각화: 길쭉한 타원 (downed보다 덜 어둡고 노란 외곽선) ===
  if (u.stance === 'prone') {
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(u.facing);
    ctx.fillStyle = fillBase;
    ctx.strokeStyle = '#ffa040';   // 노란 주황 — prone 표시
    ctx.lineWidth = 1.6 / view.scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.5, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // 방향 표시 — 작은 삼각형
    ctx.fillStyle = '#ffa040';
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(r * 0.8, -r * 0.35);
    ctx.lineTo(r * 0.8, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // === 서있는 유닛 본체 — 사람 형상 실루엣 + 오른손 총기 (원형은 fallback) ===
  if (!GAME.simpleUnitRender && typeof renderUnitHumanSilhouette === 'function') {
    renderUnitHumanSilhouette(ctx, u, fillBase, strokeBase);
    if (u.alive && !u.reloading && typeof renderUnitWeaponInHands === 'function') renderUnitWeaponInHands(ctx, u, u._resolvedWeaponProfile);
  } else {
    ctx.fillStyle = fillBase;
    ctx.strokeStyle = strokeBase;
    ctx.lineWidth = 1.4 / view.scale;
    ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // passive는 작은 표시 — 가운데 점
  if (isPassive) {
    ctx.fillStyle = '#d0d0a0';
    ctx.beginPath(); ctx.arc(u.x, u.y, r * 0.30, 0, Math.PI * 2); ctx.fill();
  }

  // facing 인디케이터 (실루엣 머리와 함께 방향 강조)
  const ux = Math.cos(u.facing), uy = Math.sin(u.facing);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.4 / view.scale;
  ctx.beginPath();
  ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + ux * (r + 5), u.y + uy * (r + 5));
  ctx.stroke();

  // pinned 표시
  if (u.pinned) {
    ctx.strokeStyle = '#ff8a3a';
    ctx.lineWidth = 2 / view.scale;
    ctx.beginPath(); ctx.arc(u.x, u.y, r + 7, 0, Math.PI * 2); ctx.stroke();
  }

  // 조준 시간 표시 — 작은 게이지
  if (u.aimTimer > 0 && u.currentTarget) {
    const w = (u.aimTimer / 1.0) * 18;
    ctx.fillStyle = 'rgba(255,224,102,0.9)';
    ctx.fillRect(u.x - 9, u.y - r - 8, w, 2);
    ctx.strokeStyle = 'rgba(120,100,40,0.6)';
    ctx.lineWidth = 0.6 / view.scale;
    ctx.strokeRect(u.x - 9, u.y - r - 8, 18, 2);
  }

  // HP 바
  const hpRatio = Math.max(0, u.hp / u.maxHp);
  ctx.fillStyle = 'rgba(20,20,20,0.85)';
  ctx.fillRect(u.x - 12, u.y + r + 3, 24, 3);
  ctx.fillStyle = hpRatio > 0.5 ? '#6abc6a' : (hpRatio > 0.25 ? '#d4a04a' : '#c64040');
  ctx.fillRect(u.x - 12, u.y + r + 3, 24 * hpRatio, 3);

  // 이름 (아군만)
  if (u.team === 'friend') {
    ctx.fillStyle = '#d6dde2';
    ctx.font = `bold ${10}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(u.name, u.x, u.y + r + 8);
  }

  // 디버그 AI 라벨 — 적군 상태 표시
  if (GAME.debugAI && u.team === 'enemy' && !u.isDead) {
    const stateColors = {
      idle:'#6b7780', alert:'#ffe066', investigateNoise:'#ffa060',
      searchNoise:'#ff8060', contact:'#ff4040', suppressed:'#ff6060', downed:'#c080ff',
    };
    const stateLabels = {
      idle:'IDLE', alert:'ALERT', investigateNoise:'INVEST', searchNoise:'SEARCH',
      contact:'CONTACT', suppressed:'SUPPRESS', downed:'DOWN',
    };
    const lab = stateLabels[u.aiState] || u.aiState;
    const col = stateColors[u.aiState] || '#d6dde2';
    ctx.fillStyle = col;
    ctx.font = `bold ${9}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(lab, u.x, u.y + r + 8);
  }

  // SIDE-FIRE-1A: Fire Control Debug — 선택/조작/최근 차단 유닛 중심 (적 AI는 debug 시 가까운 유닛만)
  if (GAME.debugFireControl && u._fcDebug && !u.isDead) {
    const recentEvent = (u._fireControl && (u._fireControl.lineOfFireSafety === 'blocked' || u._fireControl.shotQueueInterruptReason || u._fireControl.panicOverride));
    let showFC = (u.id === GAME.selectedId) || (u.team === 'friend' && (u.manualFireTarget || recentEvent));
    // 적 AI는 debug 활성 + 화면 중앙 부근(가까운 유닛)일 때만
    if (!showFC && u.team === 'enemy') {
      const wcx = (view.viewportW / 2 - view.tx) / view.scale, wcy = (view.viewportH / 2 - view.ty) / view.scale;
      showFC = recentEvent && (Math.hypot(u.x - wcx, u.y - wcy) < 300);
    }
    if (showFC) {
      ctx.fillStyle = (u._fireControl && u._fireControl.lineOfFireSafety === 'blocked') ? '#ff6060' : (u._fireControl && u._fireControl.panicOverride) ? '#ffcc40' : '#7fd6c0';
      ctx.font = `${8}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(u._fcDebug, u.x, u.y - r - 6);
    }
  }
  // 크로스파이어 빨간 점선 경고 — 플레이어 정규군급 이상. 선택/조작 외에도 최근 차단·보류 이벤트면 표시(HOTFIX-2 §4)
  if (u.team === 'friend' && u._crossfireWarning && !u.isDead) {
    // _crossfireWarning은 플레이어 정규군급의 실제 caution/blocked 이벤트에서만 설정됨 → 존재 자체가 게이트
    const cw = u._crossfireWarning;
    if (cw && cw.blocker && cw.blocker.alive && (GAME.gameTime || 0) - cw.t < 2.4) {
      const fade = Math.max(0.35, 1 - ((GAME.gameTime || 0) - cw.t) / 2.4);
      ctx.save();
      ctx.strokeStyle = `rgba(255,40,40,${0.95 * fade})`;
      ctx.lineWidth = 2.2 / view.scale;
      ctx.setLineDash([6 / view.scale, 4 / view.scale]);
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(cw.tx, cw.ty); ctx.stroke();
      ctx.setLineDash([]);
      // blocker 주변 굵은 붉은 링 + 펄스
      ctx.lineWidth = 2.5 / view.scale;
      ctx.strokeStyle = `rgba(255,48,48,${0.95 * fade})`;
      ctx.beginPath(); ctx.arc(cw.blocker.x, cw.blocker.y, (UNIT_RADIUS + 5), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,48,48,${0.18 * fade})`;
      ctx.beginPath(); ctx.arc(cw.blocker.x, cw.blocker.y, (UNIT_RADIUS + 5), 0, Math.PI * 2); ctx.fill();
      // CROSSFIRE 텍스트 — 선택/조작 유닛
      if (u.id === GAME.selectedId || u.manualFireTarget) {
        ctx.fillStyle = `rgba(255,70,70,${0.98 * fade})`; ctx.font = `bold ${10}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('CROSSFIRE', u.x, u.y - r - 16);
      }
      ctx.restore();
    } else if (cw.blocker && (GAME.gameTime || 0) - cw.t >= 2.4) { u._crossfireWarning = null; }
  }

  // 출혈 표시 — 작은 붉은 점 (등급별 크기)
  if (u.bleeding && u.bleeding !== 'none' && !u.isDead) {
    const bleedSize = u.bleeding === 'critical' ? 3.5 : (u.bleeding === 'heavy' ? 2.8 : 2.0);
    const bleedColor = u.bleeding === 'critical' ? '#ff3030' : (u.bleeding === 'heavy' ? '#ff6060' : '#ff9090');
    ctx.fillStyle = bleedColor;
    ctx.beginPath();
    ctx.arc(u.x - r + 1, u.y + 1, bleedSize, 0, Math.PI*2);
    ctx.fill();
  }

  // 처치 진행 — 십자 + 진행 게이지
  if (u.treatmentTimer > 0 && u.treatmentTotal > 0) {
    const prog = 1 - u.treatmentTimer / u.treatmentTotal;
    ctx.strokeStyle = '#80c0ff';
    ctx.lineWidth = 1.4 / view.scale;
    ctx.beginPath();
    ctx.moveTo(u.x - 5, u.y - r - 11); ctx.lineTo(u.x + 5, u.y - r - 11);
    ctx.moveTo(u.x,     u.y - r - 16); ctx.lineTo(u.x,     u.y - r - 6);
    ctx.stroke();
    ctx.fillStyle = '#80c0ff';
    ctx.fillRect(u.x - 9, u.y - r - 3, 18 * prog, 2);
  }
  // 처치 받는 중 — 작은 십자
  if (u.beingTreatedBy != null && u.treatmentTimer === 0) {
    ctx.strokeStyle = 'rgba(128,200,255,0.7)';
    ctx.lineWidth = 1.2 / view.scale;
    ctx.beginPath();
    ctx.moveTo(u.x - 3, u.y - r - 10); ctx.lineTo(u.x + 3, u.y - r - 10);
    ctx.moveTo(u.x,     u.y - r - 13); ctx.lineTo(u.x,     u.y - r - 7);
    ctx.stroke();
  }

  // 끌고가기 표시 — carrier와 target 사이 연결선
  if (u.draggingTarget != null) {
    const tgt = unitById(u.draggingTarget);
    if (tgt) {
      ctx.strokeStyle = 'rgba(255,224,102,0.6)';
      ctx.lineWidth = 1.5 / view.scale;
      ctx.setLineDash([3 / view.scale, 2 / view.scale]);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// =============================================================
