// 4. MAP DATA — 작은 실내 맵 (1280 x 720)
// =============================================================
// =============================================================
// MAPS — 기본 CQB 맵 + 사격장 맵
//   GAME.mapId가 가리키는 맵을 MAP_DATA로 노출.
//   setMapById()로 전환.
//   SIDE-METRIC-SCALE-1 §16: MAP_CQB는 pixel footprint(1600×960) 유지 + meter 의미 재해석 = 50×30 m.
//     (legacy 80×48m 해석 → 1.6× 축소. 문/복도/방 치수가 실제 CQB 감각(문~1.25m, 복도~1.9m, 방 4~7m)으로 수렴)
// =============================================================
const MAP_CQB = (() => {
  const W = 1600, H = 960, T = 14;
  const walls = [], cover = [];
  const wall = (x, y, w, h, material, armor, penetrable, ric) => walls.push({ x, y, w, h, material, armor, penetrable, ricochetBase: ric });
  const cov = (x, y, w, h, material, armor, ric, opts) => cover.push(Object.assign({ x, y, w, h, material, armor, penetrable: true, ricochetBase: ric }, opts || {}));
  // 문 갭이 있는 가로/세로 벽
  const hGap = (x0, x1, y, th, mat, ar, pen, ric, gaps) => {
    let cx = x0; for (const g of (gaps || []).slice().sort((a, b) => a[0] - b[0])) { if (g[0] > cx) wall(cx, y, g[0] - cx, th, mat, ar, pen, ric); cx = Math.max(cx, g[1]); } if (x1 > cx) wall(cx, y, x1 - cx, th, mat, ar, pen, ric);
  };
  const vGap = (x, y0, y1, th, mat, ar, pen, ric, gaps) => {
    let cy = y0; for (const g of (gaps || []).slice().sort((a, b) => a[0] - b[0])) { if (g[0] > cy) wall(x, cy, th, g[0] - cy, mat, ar, pen, ric); cy = Math.max(cy, g[1]); } if (y1 > cy) wall(x, cy, th, y1 - cy, mat, ar, pen, ric);
  };

  // ---- 외벽 — 콘크리트, 두꺼움(armor95) 관통 불가 ----
  wall(40, 40, W - 80, T, 'concrete', 95, false, 0.20);
  wall(40, H - 40 - T, W - 80, T, 'concrete', 95, false, 0.20);
  wall(40, 40, T, H - 80, 'concrete', 95, false, 0.20);
  wall(W - 40 - T, 40, T, H - 80, 'concrete', 95, false, 0.20);

  // ---- 중앙 복도 가로벽 (방 ↔ 복도, 문 갭) ----
  // 상단: 방A/B/C/D ↔ 복도 (콘크리트 내벽 armor55 관통 가능)
  const TOP_DOORS = [[195, 265], [555, 625], [895, 965], [1285, 1355]];
  hGap(54, 1546, 440, 10, 'concrete', 55, true, 0.25, TOP_DOORS);
  // 그 갭마다 실제 문을 단다. 경첩쪽과 여는 방향을 섞어 안/밖 여닫이가 둘 다 나오게 한다.
  //   swing +1 = 복도 쪽(아래)으로 열림 / -1 = 방 쪽(위)으로 열림
  // 문은 네 문간 중 **세 곳**에만 단다. 첫 번째 문간(방 A)은 문틀만 있는 열린 통로로 남긴다 —
  //   이 맵의 초기 교전은 그 문간을 지나는 시선 하나에 걸려 있어서, 거기에 문을 달면
  //   (열어 두어도 문짝이 대각선 시선을 가려) 양측이 서로를 아예 못 보고 대치만 한다.
  //   열림/닫힘을 섞는다 — 닫힌 문은 열어야 하고, 열린 문은 문짝이 방을 차지한 채 시야를 가른다.
  const TOP_DOOR_SPEC = [
    { i: 1, hinge: 'max', swing:  1, state: 'closed' },
    { i: 2, hinge: 'min', swing: -1, state: 'open'   },
    { i: 3, hinge: 'max', swing: -1, state: 'closed' },
  ];
  TOP_DOOR_SPEC.forEach(sp => {
    const g = TOP_DOORS[sp.i];
    cover.push(makeDoor('door_top_' + sp.i, 'h', 440, 10, g[0], g[1],
      { hinge: sp.hinge, swing: sp.swing, state: sp.state,
        material: 'wood', armor: 10, label: '방 ' + 'ABCD'[sp.i] + ' 문' }));
  });
  // 하단: 콘크리트 구간(현관/중앙실/3실) + 강철 구간(금고실)
  hGap(54, 1180, 540, 10, 'concrete', 55, true, 0.25, [[120, 260], [600, 670], [1000, 1070]]);
  hGap(1180, 1546, 540, 10, 'steel', 90, true, 0.70, [[1360, 1430]]);   // 금고실 천장벽 = 강철

  // ---- 복도 격벽 (방화문) — 복도를 서/중앙/동 세 구간으로 나눈다 ----
  //   원래 복도는 x 54~1546 통짜였다. 그래서 남북 횡단로가 넷이나 있어도 **전부 같은 방**이라,
  //   한 곳에서 총성이 나면 복도 전체가 뜨거워지고 어디로 건너든 위험이 똑같았다.
  //   구간을 나누면 "서쪽은 조용하니 그쪽으로 건넌다"는 선택이 비로소 성립한다.
  vGap(520, 440, 540, 10, 'concrete', 55, true, 0.25, [[462, 518]]);
  vGap(1100, 440, 540, 10, 'concrete', 55, true, 0.25, [[462, 518]]);
  cover.push(makeDoor('door_hall_w', 'v', 520, 10, 462, 518,
    { hinge: 'min', swing: 1, state: 'open', material: 'steel', armor: 60, label: '서쪽 방화문' }));
  cover.push(makeDoor('door_hall_e', 'v', 1100, 10, 462, 518,
    { hinge: 'max', swing: -1, state: 'closed', material: 'steel', armor: 60, label: '동쪽 방화문' }));

  // ---- 상단 방 칸막이 (y 54~440) ----
  //   A|B에 측면 통로를 낸다 — 방 A에서 방 B로 가는 데 복도를 안 거쳐도 되는 두 번째 길.
  vGap(414, 54, 440, 8, 'drywall', 6, true, 0.05, [[200, 270]]);   // A|B 석고 + 측면 통로
  vGap(754, 54, 440, 8, 'drywall', 6, true, 0.05, []);    // B|C 석고
  vGap(1094, 54, 440, 10, 'concrete', 55, true, 0.25, []); // C|D 콘크리트
  cover.push(makeDoor('door_ab', 'v', 414, 8, 200, 270,
    { hinge: 'min', swing: -1, state: 'closed', material: 'wood', armor: 10, label: 'A–B 연결문' }));

  // ---- 하단 방 칸막이 (y 550~906) ----
  vGap(460, 550, 906, 8, 'drywall', 6, true, 0.05, []);    // 현관|중앙실 석고
  //   중앙실|3실에도 측면 통로 — 남쪽에서도 복도를 안 타는 길이 생긴다.
  vGap(900, 550, 906, 8, 'drywall', 6, true, 0.05, [[700, 770]]);   // 중앙실|3실 석고 + 측면 통로
  vGap(1180, 550, 906, 10, 'steel', 90, true, 0.70, []);   // 금고실 좌벽 = 강철
  cover.push(makeDoor('door_mid3', 'v', 900, 8, 700, 770,
    { hinge: 'max', swing: 1, state: 'open', material: 'wood', armor: 10, label: '중앙–3실 연결문' }));

  // ---- 엄폐물 (재질별 색 / 반높이는 대각선 줄) ----
  // 복도
  cov(510, 468, 60, 24, 'concrete', 50, 0.30, { halfHeight: true, blocksLOS: false });   // 모래주머니
  cov(960, 468, 60, 24, 'concrete', 50, 0.30, { halfHeight: true, blocksLOS: false });
  cov(690, 500, 80, 16, 'thin_metal', 24, 0.45, { halfHeight: true, blocksLOS: false });  // 금속 난간
  // 현관
  cov(150, 720, 64, 32, 'wood', 10, 0.10, { halfHeight: true, blocksLOS: false });        // 나무 책상
  cov(320, 580, 80, 20, 'concrete', 60, 0.55, { halfHeight: true, blocksLOS: false });    // 낮은 벽
  // 방 A
  cov(130, 150, 64, 32, 'wood', 10, 0.10, { halfHeight: true, blocksLOS: false });
  cov(320, 330, 36, 36, 'wood', 12, 0.10, { halfHeight: true, blocksLOS: false });        // 나무 상자
  // 방 B
  cov(560, 90, 8, 80, 'glass', 7, 0.05, { blocksLOS: false });                            // 유리 칸막이 (전높이·투시)
  cov(650, 300, 32, 32, 'concrete', 60, 0.55, { blocksLOS: true });                       // 콘크리트 기둥
  // 방 C
  cov(820, 120, 24, 70, 'steel', 85, 0.70, { blocksLOS: true });                          // 강철 캐비닛
  cov(940, 360, 80, 20, 'concrete', 60, 0.55, { halfHeight: true, blocksLOS: false });
  // 방 D
  cov(1200, 200, 80, 16, 'thin_metal', 24, 0.45, { halfHeight: true, blocksLOS: false });
  cov(1380, 320, 64, 32, 'wood', 10, 0.10, { halfHeight: true, blocksLOS: false });
  // 중앙실
  cov(560, 640, 64, 32, 'wood', 10, 0.10, { halfHeight: true, blocksLOS: false });
  cov(760, 770, 64, 32, 'wood', 10, 0.10, { halfHeight: true, blocksLOS: false });
  cov(680, 830, 32, 32, 'concrete', 60, 0.55, { blocksLOS: true });
  // 3실
  cov(980, 650, 36, 36, 'wood', 12, 0.10, { halfHeight: true, blocksLOS: false });
  cov(1050, 710, 36, 36, 'wood', 12, 0.10, { halfHeight: true, blocksLOS: false });
  cov(1120, 600, 8, 80, 'glass', 7, 0.05, { blocksLOS: false });
  // 금고실
  cov(1470, 650, 24, 70, 'steel', 85, 0.70, { blocksLOS: true });
  cov(1280, 800, 80, 20, 'concrete', 60, 0.55, { halfHeight: true, blocksLOS: false });

  return {
    id: 'cqb', name: 'CQB 시설', w: W, h: H, walls, coverObjects: cover,
    floorDefaultMaterial: 'concrete',
    // 방 이름 — **이름만 정답이다.** 형상·문턱·클리어 여부는 전부 유닛의 믿음에서 나온다.
    //   유닛은 그 방에 들어가거나(entered) 문턱 너머로 들여다봐야(named) 이름을 알게 된다.
    //   사각형은 벽 저작 그대로다: 칸막이 x=414/754/1094(위) · 460/900/1180(아래), 가로벽 y=440/540.
    rooms: [
      { id:'cqb_A',     name:'방 A',     x: 54,   y: 54,  w: 360,  h: 386 },
      { id:'cqb_B',     name:'방 B',     x: 414,  y: 54,  w: 340,  h: 386 },
      { id:'cqb_C',     name:'방 C',     x: 754,  y: 54,  w: 340,  h: 386 },
      { id:'cqb_D',     name:'방 D',     x: 1094, y: 54,  w: 452,  h: 386 },
      // 복도는 격벽으로 셋으로 나뉜다 — 위험 섹터가 구간별로 갈려야 우회 선택이 생긴다
      { id:'cqb_hall_w', name:'서쪽 복도', x: 54,   y: 440, w: 466, h: 100 },
      { id:'cqb_hall_c', name:'중앙 복도', x: 520,  y: 440, w: 580, h: 100 },
      { id:'cqb_hall_e', name:'동쪽 복도', x: 1100, y: 440, w: 446, h: 100 },
      { id:'cqb_entry', name:'현관',     x: 54,   y: 540, w: 406,  h: 366 },
      { id:'cqb_mid',   name:'중앙실',   x: 460,  y: 540, w: 440,  h: 366 },
      { id:'cqb_3rd',   name:'3실',      x: 900,  y: 540, w: 280,  h: 366 },
      { id:'cqb_vault', name:'금고실',   x: 1180, y: 540, w: 366,  h: 366 },
    ],
    // 임무 목표 — 아군은 현관(좌하단)에서 시작해 대각선 반대편 금고실까지 밀고 간다.
    //   측정에서 나온 이유다: 지배적 분산 항이 "교전 결과"가 아니라 **"교전이 얼마나 일어나는가"**였고
    //   (피격 0·교전 3초 대 피격 27·교전 22초), 원인은 공격 측에 **추진력이 아예 없다**는 것이었다.
    //   평소엔 플레이어가 명령하지만 하네스엔 플레이어가 없어 아군 행동이 전부 반응에서 창발한다.
    objectiveRoomId: 'cqb_vault',
    floorZones: [
      { id:'cqb_room_rubble_01',  material:'rubble',         x: 60,   y: 60,  w: 348, h: 374 },   // 방A 잔해
      { id:'cqb_room_wood_01',    material:'wood',           x: 420,  y: 60,  w: 328, h: 374 },   // 방B 목재
      { id:'cqb_hall_tile_01',    material:'tile',           x: 60,   y: 446, w: 1480, h: 88 },   // 중앙 복도 타일
      { id:'cqb_entry_dirt_01',   material:'compacted_dirt', x: 60,   y: 546, w: 360, h: 350 },   // 현관 다짐흙
      { id:'cqb_storage_metal_01',material:'metal',          x: 1186, y: 546, w: 354, h: 350 },   // 금고실 금속
    ],
    friendSpawns: [
      { name: 'Alpha-1', x: 95, y: 820, facing: 0 },
      { name: 'Alpha-2', x: 175, y: 820, facing: 0 },
      { name: 'Alpha-3', x: 95, y: 875, facing: 0 },
      { name: 'Alpha-4', x: 175, y: 875, facing: 0 },
    ],
    enemySpawns: [
      { name: 'OPFOR-1', x: 230, y: 140, facing: Math.PI * 0.5, role: 'reactive' },   // 방A
      { name: 'OPFOR-2', x: 600, y: 160, facing: Math.PI, role: 'reactive' },          // 방B
      { name: 'OPFOR-3', x: 700, y: 340, facing: Math.PI * 0.5, role: 'reactive' },    // 방B 하단
      { name: 'OPFOR-4', x: 920, y: 180, facing: Math.PI, role: 'reactive' },          // 방C
      { name: 'OPFOR-5', x: 1320, y: 150, facing: Math.PI, role: 'reactive' },         // 방D
      { name: 'OPFOR-6', x: 1480, y: 380, facing: Math.PI * 0.75, role: 'reactive' },   // 방D
      { name: 'OPFOR-7', x: 450, y: 495, facing: 0, role: 'reactive' },                // 복도
      { name: 'OPFOR-8', x: 700, y: 700, facing: Math.PI * 1.5, role: 'reactive' },    // 중앙실
      { name: 'OPFOR-9', x: 1030, y: 720, facing: Math.PI, role: 'reactive' },         // 3실
      { name: 'OPFOR-10', x: 1360, y: 700, facing: Math.PI, role: 'reactive' },        // 금고실
    ],
  };
})();

// 사격장 맵 — 좌측에 친군 사격선, 우측으로 거리별 표적/장애물 뒤 표적/도탄 구역.
//   하단에 작은 CQB 건물 (대응사격 적). SIDE-METRIC-SCALE-1: m 기준 재작성 — 56×24 m.
//   친군 사격선 x=3 m → 표적 x = 3 m + 표적거리. 표적 3/5/10/15/20/30/40/50 m.
const MAP_RANGE = (() => {
  const SHOOT_M = 3;                                 // 사수 x (m)
  const T = (m) => mToPx(SHOOT_M + m);               // 표적 x (px)
  const W_M = 56, H_M = 24;
  const wallT = 0.25;                                // 벽 두께 0.25 m
  const walls = [
    // 외벽 (m 단위 작성)
    rectM(1, 1, W_M - 2, wallT),
    rectM(1, H_M - 1 - wallT, W_M - 2, wallT),
    rectM(1, 1, wallT, H_M - 2),
    rectM(W_M - 1 - wallT, 1, wallT, H_M - 2),
  ];
  // 작은 CQB 건물 (우측 하단) 7×6 m — 입구는 좌벽 위쪽 1.2 m 갭
  walls.push(
    rectM(46, 15, 7, wallT),                          // 위벽
    rectM(46, 15 + 1.2 + wallT, wallT, 6 - 1.2 - wallT),   // 좌벽 (문 아래)
    rectM(53 - wallT, 15, wallT, 6),                  // 우벽
    rectM(46, 21 - wallT, 7, wallT),                  // 아래벽
  );
  return {
    id: 'range',
    name: '사격장',
    w: mToPx(W_M), h: mToPx(H_M),
    floorDefaultMaterial: 'compacted_dirt',
    floorZones: [
      Object.assign(rectM(1.2, 1.5, 4, 21), { id:'range_concrete_pad_01', material:'concrete' }),   // 사대 콘크리트
      Object.assign(rectM(6, 2, 38, 20),    { id:'range_sand_01',         material:'sand' }),        // 사격장 모래
      Object.assign(rectM(46, 15, 7, 6),    { id:'range_rubble_target_01',material:'rubble' }),      // CQB 표적동 잔해
    ],
    walls,
    coverObjects: [
      // 거리별 장애물 뒤 표적용 cover들 — 표적은 장애물 바로 뒤에 배치 (두께 m 기준)
      Object.assign(rectM(0,0,0,0), { x:T(5)-mToPx(0.3),  y:mToPx(7.5),  w:mToPx(0.25), h:mToPx(2), material:'drywall',    armor:6,  penetrable:true, ricochetBase:0.05 }),
      Object.assign(rectM(0,0,0,0), { x:T(10)-mToPx(0.35),y:mToPx(10),   w:mToPx(0.35), h:mToPx(2), material:'wood',       armor:14, penetrable:true, ricochetBase:0.10 }),
      Object.assign(rectM(0,0,0,0), { x:T(15)-mToPx(0.3), y:mToPx(12.5), w:mToPx(0.25), h:mToPx(2), material:'glass',      armor:8,  penetrable:true, ricochetBase:0.05 }),
      Object.assign(rectM(0,0,0,0), { x:T(20)-mToPx(0.35),y:mToPx(15),   w:mToPx(0.35), h:mToPx(2), material:'thin_metal', armor:24, penetrable:true, ricochetBase:0.45 }),
      Object.assign(rectM(0,0,0,0), { x:T(30)-mToPx(0.5), y:mToPx(17.5), w:mToPx(0.75), h:mToPx(2), material:'concrete',   armor:60, penetrable:true, ricochetBase:0.55 }),
      // 도탄 테스트 — 비스듬한 steel/thin_metal 장애물 (상단, 사격선과 비스듬)
      Object.assign(rectM(0,0,0,0), { x:T(15), y:mToPx(2.2), w:mToPx(0.12), h:mToPx(1.6), material:'steel',      armor:80, penetrable:true, ricochetBase:0.70 }),
      Object.assign(rectM(0,0,0,0), { x:T(20), y:mToPx(2.2), w:mToPx(0.12), h:mToPx(1.6), material:'thin_metal', armor:24, penetrable:true, ricochetBase:0.45 }),
    ],
    friendSpawns: [
      spawnM('사수-1', SHOOT_M, 6,  0),
      spawnM('사수-2', SHOOT_M, 9,  0),
      spawnM('사수-3', SHOOT_M, 12, 0),
      spawnM('사수-4', SHOOT_M, 16, 0),
    ],
    enemySpawns: [
      // === 거리별 표적 라인 (passive — 대응사격 X) — y=5 m 일렬
      spawnM('표적 3m',  SHOOT_M + 3,  5, Math.PI, { role:'passive' }),
      spawnM('표적 5m',  SHOOT_M + 5,  5, Math.PI, { role:'passive' }),
      spawnM('표적 10m', SHOOT_M + 10, 5, Math.PI, { role:'passive' }),
      spawnM('표적 15m', SHOOT_M + 15, 5, Math.PI, { role:'passive' }),
      spawnM('표적 20m', SHOOT_M + 20, 5, Math.PI, { role:'passive' }),
      spawnM('표적 30m', SHOOT_M + 30, 5, Math.PI, { role:'passive' }),
      spawnM('표적 40m', SHOOT_M + 40, 5, Math.PI, { role:'passive' }),
      spawnM('표적 50m', SHOOT_M + 50, 5, Math.PI, { role:'passive' }),
      // === 장애물 뒤 표적 (passive) — cover 바로 뒤 0.4 m
      spawnM('drywall 뒤',    SHOOT_M + 5 + 0.4,  7.5 + 1, Math.PI, { role:'passive' }),
      spawnM('wood 뒤',       SHOOT_M + 10 + 0.4, 10 + 1,  Math.PI, { role:'passive' }),
      spawnM('glass 뒤',      SHOOT_M + 15 + 0.4, 12.5 + 1,Math.PI, { role:'passive' }),
      spawnM('thin_metal 뒤', SHOOT_M + 20 + 0.4, 15 + 1,  Math.PI, { role:'passive' }),
      spawnM('concrete 뒤',   SHOOT_M + 30 + 0.6, 17.5 + 1,Math.PI, { role:'passive' }),
      // === 작은 CQB 건물 내부 — 사격장이므로 모두 passive
      spawnM('CQB-1', 48.5, 18,   Math.PI,       { role:'passive' }),
      spawnM('CQB-2', 51,   19.5, Math.PI * 0.8, { role:'passive' }),
    ],
  };
})();


// =============================================================
// SIDE-METRIC-SCALE-1 §18: 신규 맵 프리셋 3종 — 전부 m 단위(rectM/spawnM)로 작성.
//   실측 감각: 문 1.0m, 복도 2~2.5m, 방 3~6m, 내벽 0.2m, 외벽 0.3m.
// =============================================================
const MAP_APARTMENT = (() => {
  const W_M = 28, H_M = 18, EX = 0.3, IN = 0.2;
  const walls = [], cover = [];
  const wallM = (x,y,w,h,mat,armor,ric)=>walls.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:true,ricochetBase:ric}));
  const outerM = (x,y,w,h,mat,armor,ric)=>walls.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:false,ricochetBase:ric}));   // 외벽/경계 — 명시 절대차단
  const covM  = (x,y,w,h,mat,armor,ric,o)=>cover.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:true,ricochetBase:ric},o||{}));
  // 외벽 (concrete)
  outerM(0.5,0.5,W_M-1,EX,'concrete',95,0.20); outerM(0.5,H_M-0.5-EX,W_M-1,EX,'concrete',95,0.20);
  outerM(0.5,0.5,EX,H_M-1,'concrete',95,0.20); outerM(W_M-0.5-EX,0.5,EX,H_M-1,'concrete',95,0.20);
  // 중앙 복도 (y 8~10, 폭 2m) — 상단벽: 문 4개(각 1.0m)
  const cy0=8, cy1=10;
  // 복도 상단벽 x 0.8~27.2, 문 @3.5,10,16.5,23
  const topDoors=[[3.5,4.5],[10,11],[16.5,17.5],[23,24]];
  let cx=0.8; for(const g of topDoors){ if(g[0]>cx) wallM(cx,cy0-IN,g[0]-cx,IN,'drywall',6,0.05); cx=g[1]; } wallM(cx,cy0-IN,27.2-cx,IN,'drywall',6,0.05);
  // 복도 하단벽 — 문 @6,13.5,20.5
  const botDoors=[[6,7],[13.5,14.5],[20.5,21.5]];
  cx=0.8; for(const g of botDoors){ if(g[0]>cx) wallM(cx,cy1,g[0]-cx,IN,'drywall',6,0.05); cx=g[1]; } wallM(cx,cy1,27.2-cx,IN,'drywall',6,0.05);
  // 상단 방 구획벽 (세로) x=7.5,14,20.5 (y 0.8~8)
  for(const vx of [7.5,14,20.5]) wallM(vx,0.8,IN,cy0-0.8-IN,'drywall',6,0.05);
  // 하단 방 구획벽 x=10,18 (y 10.2~17.2)
  for(const vx of [10,18]) wallM(vx,cy1+IN,IN,H_M-0.8-(cy1+IN),'drywall',6,0.05);
  // 가구 커버
  covM(2,3,2,0.9,'wood',14,0.10,{name:'소파'});          // 방A 소파
  covM(11,2.5,1.2,0.7,'wood',12,0.10,{name:'책상'});     // 방B 책상
  covM(17.5,4.5,0.8,1.6,'thin_metal',24,0.45,{name:'냉장고'}); // 방C 냉장고
  covM(24.5,3,1.8,1.4,'wood',10,0.08,{name:'침대'});     // 방D 침대
  covM(3,13,2.2,1.0,'wood',14,0.10,{name:'거실장'});     // 거실
  covM(13,14.5,1.6,0.9,'wood',12,0.10,{name:'식탁'});    // 주방
  covM(22,12.5,1.8,1.4,'wood',10,0.08,{name:'침대2'});
  return {
    id:'apartment', name:'아파트 층', w:mToPx(W_M), h:mToPx(H_M), walls, coverObjects:cover,
    floorDefaultMaterial:'wood',
    floorZones:[
      Object.assign(rectM(0.8,cy0,26.4,2),{id:'apt_hall_tile',material:'tile'}),
      Object.assign(rectM(10.2,cy1+IN,7.8-IN,7),{id:'apt_kitchen_tile',material:'tile'}),
    ],
    friendSpawns:[
      spawnM('Alpha-1',2,16.2,0), spawnM('Alpha-2',3.4,16.2,0),
      spawnM('Alpha-3',2,17,0),   spawnM('Alpha-4',3.4,17,0),
    ],
    enemySpawns:[
      spawnM('OPFOR-1',4,4,Math.PI*0.5,{role:'reactive'}),      // 방A
      spawnM('OPFOR-2',11,4.5,Math.PI,{role:'reactive'}),        // 방B
      spawnM('OPFOR-3',17,2.5,Math.PI*0.5,{role:'reactive'}),    // 방C
      spawnM('OPFOR-4',24.5,5.5,Math.PI,{role:'reactive'}),      // 방D
      spawnM('OPFOR-5',14,9,0,{role:'reactive'}),                // 복도
      spawnM('OPFOR-6',14.5,13,Math.PI*1.5,{role:'reactive'}),   // 주방
      spawnM('OPFOR-7',23,15,Math.PI*0.75,{role:'reactive'}),    // 침실2
    ],
  };
})();

const MAP_CORRIDOR = (() => {
  const W_M = 45, H_M = 16, EX = 0.3, IN = 0.2;
  const walls = [], cover = [];
  const wallM = (x,y,w,h,mat,armor,ric)=>walls.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:true,ricochetBase:ric}));
  const outerM = (x,y,w,h,mat,armor,ric)=>walls.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:false,ricochetBase:ric}));   // 외벽/경계 — 명시 절대차단
  const covM  = (x,y,w,h,mat,armor,ric,o)=>cover.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:true,ricochetBase:ric},o||{}));
  outerM(0.5,0.5,W_M-1,EX,'concrete',95,0.20); outerM(0.5,H_M-0.5-EX,W_M-1,EX,'concrete',95,0.20);
  outerM(0.5,0.5,EX,H_M-1,'concrete',95,0.20); outerM(W_M-0.5-EX,0.5,EX,H_M-1,'concrete',95,0.20);
  // 중앙 복도 y 6.75~9.25 (2.5m). 위 5실 / 아래 5실, 각 문 1.0m.
  const cy0=6.75, cy1=9.25;
  const roomXs=[0.8,9.6,18.4,27.2,36.0,44.2];   // 5칸 경계
  // 복도 상/하단 벽 — 각 방 중앙에 문
  let cx=0.8;
  for(let i=0;i<5;i++){ const x0=roomXs[i], x1=roomXs[i+1]; const dc=(x0+x1)/2; const g0=dc-0.5,g1=dc+0.5;
    wallM(cx,cy0-IN,g0-cx,IN,'drywall',6,0.05); cx=g1; }
  wallM(cx,cy0-IN,44.2-cx,IN,'drywall',6,0.05);
  cx=0.8;
  for(let i=0;i<5;i++){ const x0=roomXs[i], x1=roomXs[i+1]; const dc=(x0+x1)/2+2; const g0=Math.min(x1-1.2,dc-0.5),g1=Math.min(x1-0.2,dc+0.5);
    wallM(cx,cy1,g0-cx,IN,'drywall',6,0.05); cx=g1; }
  wallM(cx,cy1,44.2-cx,IN,'drywall',6,0.05);
  // 방 구획 세로벽 (상단: y 0.8~6.75, 하단: 9.25~15.2)
  for(let i=1;i<5;i++){ wallM(roomXs[i],0.8,IN,cy0-0.8-IN,'drywall',6,0.05); wallM(roomXs[i],cy1+IN,IN,H_M-0.8-(cy1+IN),'drywall',6,0.05); }
  // 복도 콘크리트 기둥 2개 + 사무 가구
  covM(15,7.6,0.6,0.8,'concrete',60,0.55,{name:'기둥'});
  covM(30,7.6,0.6,0.8,'concrete',60,0.55,{name:'기둥'});
  covM(4,3,1.6,0.8,'wood',12,0.10,{name:'책상'});
  covM(21,12,1.6,0.8,'wood',12,0.10,{name:'책상'});
  covM(39,3.5,0.8,1.6,'thin_metal',24,0.45,{name:'캐비닛'});
  return {
    id:'corridor', name:'복도 시설', w:mToPx(W_M), h:mToPx(H_M), walls, coverObjects:cover,
    floorDefaultMaterial:'tile',
    floorZones:[ Object.assign(rectM(0.8,cy0,43.4,2.5),{id:'cor_hall_concrete',material:'concrete'}) ],
    friendSpawns:[
      spawnM('Alpha-1',2,7.4,0), spawnM('Alpha-2',2,8.6,0),
      spawnM('Alpha-3',3.4,7.4,0), spawnM('Alpha-4',3.4,8.6,0),
    ],
    enemySpawns:[
      spawnM('OPFOR-1',13,3.5,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-2',22,3,Math.PI*0.75,{role:'reactive'}),
      spawnM('OPFOR-3',40,4,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-4',15,12.5,Math.PI*0.5,{role:'reactive'}),
      spawnM('OPFOR-5',31,12,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-6',42,8,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-7',24,8,Math.PI,{role:'reactive'}),
    ],
  };
})();

const MAP_WAREHOUSE = (() => {
  const W_M = 50, H_M = 30, EX = 0.3;
  const walls = [], cover = [];
  const wallM = (x,y,w,h,mat,armor,ric)=>walls.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:true,ricochetBase:ric}));
  const outerM = (x,y,w,h,mat,armor,ric)=>walls.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:false,ricochetBase:ric}));   // 외벽/경계 — 명시 절대차단
  const covM  = (x,y,w,h,mat,armor,ric,o)=>cover.push(Object.assign(rectM(x,y,w,h),{material:mat,armor,penetrable:true,ricochetBase:ric},o||{}));
  outerM(0.5,0.5,W_M-1,EX,'concrete',95,0.20); outerM(0.5,H_M-0.5-EX,W_M-1,EX,'concrete',95,0.20);
  outerM(0.5,0.5,EX,H_M-1,'concrete',95,0.20); outerM(W_M-0.5-EX,0.5,EX,H_M-1,'concrete',95,0.20);
  // 사무실 (우상단 6×5m, 문 1.0m 좌벽 하단)
  wallM(43,1,6,0.2,'drywall',6,0.05); wallM(43,6,6,0.2,'drywall',6,0.05);
  wallM(43,1,0.2,3.6,'drywall',6,0.05); /* 문 4.6~5.6 */ wallM(49-0.2,1,0.2,5,'drywall',6,0.05);
  // 선반/컨테이너 열 — 장거리 사선(20~40m) 확보하도록 세로 통로 유지
  const shelf=(x,y)=>covM(x,y,4,1.0,'steel',80,0.70,{name:'선반'});
  shelf(8,6); shelf(8,12); shelf(8,18); shelf(8,24);
  shelf(20,8); shelf(20,15); shelf(20,22);
  shelf(32,6); shelf(32,12); shelf(32,18); shelf(32,24);
  covM(14,10,2.4,2.4,'thin_metal',24,0.45,{name:'컨테이너'});
  covM(26,19,2.4,2.4,'thin_metal',24,0.45,{name:'컨테이너'});
  covM(38,14,2.4,2.4,'thin_metal',24,0.45,{name:'컨테이너'});
  covM(15,25,1.8,1.2,'wood',14,0.10,{name:'팔레트'});
  covM(28,4,1.8,1.2,'wood',14,0.10,{name:'팔레트'});
  return {
    id:'warehouse', name:'창고', w:mToPx(W_M), h:mToPx(H_M), walls, coverObjects:cover,
    floorDefaultMaterial:'concrete',
    floorZones:[
      Object.assign(rectM(43,1,6,5),{id:'wh_office_tile',material:'tile'}),
      Object.assign(rectM(1,26,10,3),{id:'wh_dock_metal',material:'metal'}),
    ],
    friendSpawns:[
      spawnM('Alpha-1',2.5,27,0), spawnM('Alpha-2',4,27,0),
      spawnM('Alpha-3',2.5,28.3,0), spawnM('Alpha-4',4,28.3,0),
    ],
    enemySpawns:[
      spawnM('OPFOR-1',10,7.5,Math.PI*0.5,{role:'reactive'}),
      spawnM('OPFOR-2',22,9.5,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-3',34,7.5,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-4',16,13,Math.PI*0.75,{role:'reactive'}),
      spawnM('OPFOR-5',34,19.5,Math.PI,{role:'reactive'}),
      spawnM('OPFOR-6',46,3.5,Math.PI,{role:'reactive'}),        // 사무실
      spawnM('OPFOR-7',27,26,Math.PI*1.5,{role:'reactive'}),
      spawnM('OPFOR-8',44,24,Math.PI,{role:'reactive'}),
    ],
  };
})();

const MAPS = { cqb: MAP_CQB, range: MAP_RANGE, apartment: MAP_APARTMENT, corridor: MAP_CORRIDOR, warehouse: MAP_WAREHOUSE };
let MAP_DATA = MAP_CQB;
function setMapById(id) {
  if (MAPS[id]) MAP_DATA = MAPS[id];
}

// =============================================================
