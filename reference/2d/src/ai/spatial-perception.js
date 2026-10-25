// SPATIAL PERCEPTION 0.8.0 — AI 공간 인지 감각기관 (프로토타입 이식)
// =============================================================
//   기존 시야와 역할이 다르다. 겹치지 않는다.
//     checkVisibility    — "저 유닛이 지금 보이는가" (적 탐지·먼지·바이저·자세). 그대로 유지.
//     SpatialPerception  — "이 방이 어떻게 생겼다고 믿는가" (지형 기억). 여기서 교체.
//
//   기존 aiMemory.knownCovers는 정답 객체 id를 들고 있어 결코 틀리지 않는다 — 낡을 뿐이다.
//   이 계층의 기억(surfaces)은 관측으로 재구성한 가설이라 틀릴 수 있다:
//     · 없는 벽을 믿을 수 있고
//     · 벽 길이를 실제보다 짧거나 길게 알 수 있고
//     · 기억한 벽을 뚫고 보이면 reconcile이 그 기억을 쪼개거나 지운다 (반증)
//     · 두께는 양면을 봐야 추론된다 → 관통저항 추정
//
//   전역을 늘리지 않기 위해 전부 IIFE 안에 가둔다. 특히 getPerceptionSnapshot은
//   본편에 이미 같은 이름의 다른 함수(유닛별 적 가시성)가 있으므로 절대 전역으로 내보내지 않는다.
//
//   길이 상수는 전부 미터로 적고 mToPx로 환산한다. 프로토타입은 px 상수였고
//   그쪽 스케일(약 40px/m)과 본편(PX_PER_M=32)이 다르기 때문이다.
// =============================================================
const SpatialPerception = (function () {
  'use strict';
  const VERSION = '0.8.0';

  const _px = (m) => (typeof mToPx === 'function') ? mToPx(m) : m * 32;

  // ---- 신뢰도 / 기억 단계 (무차원) ----
  const CONF_FLOOR = 0.08, MEMORY_CONFIRMED = 0.62, MEMORY_UNCERTAIN = 0.30;
  const BASE_TAU = 14;            // 초. 숙련도(memoryDecayMul)로 나눠 쓴다.

  // ---- 길이 상수 (미터 → px) ----
  const PERP_TOL      = _px(0.125);  // 같은 직선으로 볼 수직 허용오차
  const GAP_TOL       = _px(0.225);  // 확정된 모서리 너머로 볼 간격
  const COLLINEAR_GAP = _px(6.5);    // 같은 면으로 이어 볼 최대 공백
  const HOLE_MARGIN   = _px(0.125);  // 반증 시 뚫는 구멍 반폭
  const MIN_PIECE     = _px(0.225);  // 반증 후 남길 최소 조각
  const FRAGMENT_LEN  = _px(0.65);   // 이보다 짧으면 노이즈 후보
  const UNK_APPROACH  = _px(1.8);    // 개구부 접근 판정 거리
  const MAX_THICKNESS = _px(3.75);   // 두께 추정 상한
  const ATT_RADIUS_MIN = _px(0.125), ATT_RADIUS_GAIN = _px(0.7);
  const THICK_REF     = _px(1.125);  // 관통저항 정규화 기준 두께
  const GATE_MIN      = _px(0.75);
  const GATE_BEYOND   = _px(1.375);

  const NORMAL_TOL = 0.95;
  const FRAGMENT_OBS = 6, FRAGMENT_TTL = 6;
  const UNK_RESOLVED_TTL = 8, UNK_STALE_TTL = 25;
  const SECTOR_RAYS = 160, FAR = _px(50), MIN_GAP_RAYS = 3, UNK_MATCH_SCORE = 118;

  // ---- 표면 등급 ----
  //   시야 차단 / 탄도 차단 / 높이는 서로 다른 성질이다.
  //   height는 매몰 판정에만 쓴다 — 높은 물체가 낮은 물체의 면을 가리지, 그 반대는 아니다.
  const SURFACE_CLASS = {
    wall  : { label: '전신 벽',    sight: true,  ballistic: 1.00, movement: true, height: 2.0 },
    cover : { label: '반높이 엄폐', sight: false, ballistic: 1.00, movement: true, height: 1.0 },
    window: { label: '창문',       sight: false, ballistic: 0.35, movement: true, height: 2.0 },
    rail  : { label: '난간',       sight: false, ballistic: 0.00, movement: true, height: 1.0 }
  };
  // 본편 지오메트리 → 등급. 명시 override(perceptionClass)를 최우선으로 본다.
  function classNameOf(obj, kind) {
    if (obj && obj.perceptionClass && SURFACE_CLASS[obj.perceptionClass]) return obj.perceptionClass;
    if (kind === 'wall') return 'wall';
    if (typeof isCoverBlocksVision === 'function') return isCoverBlocksVision(obj) ? 'wall' : 'cover';
    return (obj && obj.category === 'fullCover') ? 'wall' : 'cover';
  }
  function clsOf(name) { return SURFACE_CLASS[name] || SURFACE_CLASS.wall; }

  // 재질 저항은 본편 MATERIAL_ARMOR_PER_M을 그대로 정규화해 쓴다 — 별도 표를 두면 어긋난다.
  //   이 값은 AI가 "저 벽이 얼마나 단단해 보이는가"라고 믿는 추정치일 뿐이며,
  //   실제 관통 계산은 기존 장벽 시스템이 그대로 담당한다.
  let _matMax = 0;
  function materialResist(mat) {
    const T = (typeof MATERIAL_ARMOR_PER_M !== 'undefined') ? MATERIAL_ARMOR_PER_M : null;
    if (!T) return 0.35;
    if (!_matMax) { for (const k in T) if (T[k] > _matMax) _matMax = T[k]; }
    const v = T[mat];
    if (v == null) return 0.35;
    return Math.min(1, v / (_matMax || 1));
  }

  // ---- 재질 인지 ----
  //   멀리서 흘깃 본 벽도 단단한지 무른지는 안다. 헷갈리는 건 콘크리트냐 강철이냐다.
  //   그래서 등급은 비교적 빨리 서고, 정확한 재질은 관측이 쌓여야 나온다.
  //
  //   혼동은 실제로 닮은 것끼리만 일어난다. 강철판은 금속 광택이 있고 유리는 유리라
  //   가까이서 보면 헷갈릴 이유가 없다. 진짜 헷갈리는 건 도색된 평면끼리다:
  //     · drywall ↔ concrete — 도색된 격벽과 구조벽. 실제 돌파조가 틀리는 지점이고
  //       하필 "뚫을 수 있나"를 가르는 판단이다.
  //     · wood ↔ drywall — 합판 격벽과 석고 격벽.
  //   나머지(steel/glass/thin_metal)는 등급만 알아도 재질이 특정된다.
  //
  //   등급 경계는 MATERIAL_ARMOR_PER_M 표의 실제 간극에 맞춘다:
  //     soft 22.4~38.4 | (간극) | medium 70.4 | (간극) | hard 160~256
  const MAT_CUT_MEDIUM = 50, MAT_CUT_HARD = 110;
  // 겉보기 혼동군 — 같은 군 안에서만 오인한다. 군의 첫 항목이 "가장 흔해 보이는" 기본 추정.
  const MAT_LOOKALIKE = [['concrete', 'drywall'], ['drywall', 'wood']];
  const MAT_EV_CLASS = 0.55;   // 이 아래는 재질을 못 읽음 → 가장 보수적으로 concrete 가정
  const MAT_EV_EXACT = 2.2;    // 이 위는 정확한 재질까지 앎

  // 이 재질과 겉보기로 헷갈릴 수 있는 것들 (자기 자신 포함)
  function lookalikeGroupOf(mat) {
    for (const g of MAT_LOOKALIKE) if (g.indexOf(mat) >= 0) return g;
    return null;
  }
  // 재질 식별 감쇠 — 가까이서 정면으로 봐야 재질이 보인다
  const MAT_DIST_NEAR = _px(6);    // 이 안쪽은 감쇠 없음
  const MAT_DIST_FAR  = _px(22);   // 이 밖은 재질 정보를 못 얻음
  const MAT_INCID_FLOOR = 0.25;    // 완전히 비스듬해도 이만큼은 읽힌다

  function materialClassOf(mat) {
    const T = (typeof MATERIAL_ARMOR_PER_M !== 'undefined') ? MATERIAL_ARMOR_PER_M : null;
    const v = T ? T[mat] : null;
    if (v == null) return 'soft';
    return v >= MAT_CUT_HARD ? 'hard' : v >= MAT_CUT_MEDIUM ? 'medium' : 'soft';
  }
  function materialKnownLevel(w) {
    const e = w.materialEvidence || 0;
    return e >= MAT_EV_EXACT ? 'exact' : e >= MAT_EV_CLASS ? 'class' : 'unknown';
  }
  // 증거가 단계를 넘을 때만 확정값을 갱신한다.
  //   매 프레임 다시 뽑으면 믿는 재질이 흔들려 하류 판단이 요동친다.
  //   증거는 감쇠하지 않으므로 단계는 단조 증가 — 갱신은 최대 두 번뿐이다.
  function updateBelievedMaterial(w) {
    const lvl = materialKnownLevel(w);
    if (w.materialKnown === lvl && w.believedMaterialId) return;
    w.materialKnown = lvl;
    if (lvl === 'exact') { w.believedMaterialId = w.material; return; }
    if (lvl === 'unknown') { w.believedMaterialId = 'concrete'; return; }   // 미조사 — 최악 가정
    // class — 겉보기로 구분되는 재질은 이미 특정된다. 닮은 것끼리만 헷갈린다.
    const g = lookalikeGroupOf(w.material);
    w.believedMaterialId = g ? g[0] : w.material;
  }
  function believedMaterial(w) {
    return w.believedMaterialId || 'concrete';   // 아직 아무것도 안 본 상태 — 최악 가정
  }

  // ---- 소소한 수학 ----
  function clamp01v(v) { return Math.max(0, Math.min(1, v)); }
  function normRel(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function mergeIntervals(items) {
    if (!items.length) return [];
    const a = items.map(iv => [Math.min(iv[0], iv[1]), Math.max(iv[0], iv[1])]).sort((x, y) => x[0] - y[0]);
    const out = [a[0].slice()];
    for (let i = 1; i < a.length; i++) {
      const last = out[out.length - 1], cur = a[i];
      if (cur[0] <= last[1] + 1e-5) last[1] = Math.max(last[1], cur[1]);
      else out.push(cur.slice());
    }
    return out;
  }
  function intersectIntervals(a, b) {
    const out = [];
    for (const x of a) for (const y of b) {
      const lo = Math.max(x[0], y[0]), hi = Math.min(x[1], y[1]);
      if (hi - lo > 0.002) out.push([lo, hi]);
    }
    return mergeIntervals(out);
  }
  function segmentParam(seg, x, y) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1, L2 = dx * dx + dy * dy;
    return L2 > 1e-9 ? clamp01v(((x - seg.x1) * dx + (y - seg.y1) * dy) / L2) : 0;
  }
  function surfaceGeomKey(seg) {
    return seg.wallId + '#' + seg.face + '@' + [seg.x1, seg.y1, seg.x2, seg.y2].map(v => Math.round(v * 10) / 10).join(',');
  }
  function orient2(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
  function pointOnSegment(p, a, b) {
    return Math.abs(orient2(a, b, p)) < 1e-6 && p.x >= Math.min(a.x, b.x) - 1e-6 && p.x <= Math.max(a.x, b.x) + 1e-6 &&
           p.y >= Math.min(a.y, b.y) - 1e-6 && p.y <= Math.max(a.y, b.y) + 1e-6;
  }
  function segmentsCrossInclusive(a, b, c, d) {
    const o1 = orient2(a, b, c), o2 = orient2(a, b, d), o3 = orient2(c, d, a), o4 = orient2(c, d, b);
    if (((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0))) return true;
    return pointOnSegment(c, a, b) || pointOnSegment(d, a, b) || pointOnSegment(a, c, d) || pointOnSegment(b, c, d);
  }
  function crossesGate(prev, cur, gateA, gateB) {
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) < 1.5) return false;   // 제자리 회전은 횡단이 아니다
    const a = orient2(gateA, gateB, prev), b = orient2(gateA, gateB, cur);
    if (Math.abs(a) < 1e-5 || Math.abs(b) < 1e-5) return segmentsCrossInclusive(prev, cur, gateA, gateB) && Math.abs(a - b) > 1e-4;
    return (a > 0) !== (b > 0) && segmentsCrossInclusive(prev, cur, gateA, gateB);
  }
  function angleDistance(a, b) { return Math.abs(normRel(a - b)); }
  function openingWidth(op) { return op.gateA && op.gateB ? Math.hypot(op.gateB.x - op.gateA.x, op.gateB.y - op.gateA.y) : 999; }
  function openingGateAngle(op) { return op.gateA && op.gateB ? Math.atan2(op.gateB.y - op.gateA.y, op.gateB.x - op.gateA.x) : op.mid + Math.PI / 2; }
  function gateEndDistance(u, op) {
    if (!u.gateA || !u.gateB || !op.gateA || !op.gateB) return null;
    const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    return Math.min(d(u.gateA, op.gateA) + d(u.gateB, op.gateB), d(u.gateA, op.gateB) + d(u.gateB, op.gateA)) / 2;
  }
  // 게이트 양끝은 월드 좌표라 개구부 자체를 특정한다. 방위/폭은 관측자와 함께 움직이므로 동점 처리에만 쓴다.
  function openingMatchScore(u, op) {
    const ends = gateEndDistance(u, op);
    const center = Math.hypot(u.ix - op.ix, u.iy - op.iy);
    const anchor = ends !== null ? Math.min(ends, center * 0.9) : center;
    const gateAngle = angleDistance(u.gateAngle != null ? u.gateAngle : openingGateAngle(u), openingGateAngle(op)) * 26;
    const bearing = angleDistance(u.mid || 0, op.mid || 0) * 7;
    const width = Math.abs((u.width != null ? u.width : openingWidth(u)) - openingWidth(op)) * 0.12;
    const sideBonus = (u.leftWall && op.leftWall && u.leftWall === op.leftWall ? 24 : 0) +
                      (u.rightWall && op.rightWall && u.rightWall === op.rightWall ? 24 : 0);
    return anchor + gateAngle + bearing + width - sideBonus;
  }
  function unknownFinished(u) { return u.state === 'observedBeyond' || u.state === 'crossed'; }

  // =========================================================
  // 지오메트리 — 맵 단위 1회 계산 후 캐시 (14명이 공유한다)
  // =========================================================
  function rectFaces(r) {
    return [
      { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y }, n: { x: 0, y: -1 } },
      { a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.h }, n: { x: 1, y: 0 } },
      { a: { x: r.x + r.w, y: r.y + r.h }, b: { x: r.x, y: r.y + r.h }, n: { x: 0, y: 1 } },
      { a: { x: r.x, y: r.y + r.h }, b: { x: r.x, y: r.y }, n: { x: -1, y: 0 } }
    ];
  }
  // 면 중 실제로 드러난 구간 — 바깥쪽이 다른 물체에 파묻히지 않은 부분.
  // 자기보다 낮은 물체는 자기 면을 파묻을 수 없다.
  function exposedIntervals(face, others, selfHeight) {
    const ax = face.a.x, ay = face.a.y;
    const dx = face.b.x - ax, dy = face.b.y - ay;
    const px = ax + face.n.x * 1.2, py = ay + face.n.y * 1.2;
    const covered = [];
    for (const o of others) {
      if (clsOf(o._spCls).height < selfHeight - 1e-6) continue;
      const w = o.rect;
      let t0 = 0, t1 = 1, ok = true;
      if (Math.abs(dx) < 1e-9) {
        if (!(px > w.x + 0.02 && px < w.x + w.w - 0.02)) ok = false;
      } else {
        const l = (w.x + 0.02 - px) / dx, h = (w.x + w.w - 0.02 - px) / dx;
        t0 = Math.max(t0, Math.min(l, h)); t1 = Math.min(t1, Math.max(l, h));
      }
      if (ok) {
        if (Math.abs(dy) < 1e-9) {
          if (!(py > w.y + 0.02 && py < w.y + w.h - 0.02)) ok = false;
        } else {
          const l = (w.y + 0.02 - py) / dy, h = (w.y + w.h - 0.02 - py) / dy;
          t0 = Math.max(t0, Math.min(l, h)); t1 = Math.min(t1, Math.max(l, h));
        }
      }
      if (ok && t1 > t0) covered.push([t0, t1]);
    }
    covered.sort((a, b) => a[0] - b[0]);
    const out = []; let cur = 0;
    for (const c of covered) {
      if (c[0] > cur + 1e-4) out.push([cur, Math.min(c[0], 1)]);
      cur = Math.max(cur, c[1]);
      if (cur >= 1) break;
    }
    if (cur < 1 - 1e-4) out.push([cur, 1]);
    return out.filter(iv => iv[1] - iv[0] > 0.004);
  }

  let _segCache = null, _segKey = null;
  function _geomKey() {
    const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
    if (!M) return 'none';
    // 본편이 이미 관리하는 지오메트리 리비전을 그대로 캐시 키로 쓴다 (편집/삭제 시 증가)
    const rev = (typeof GAME !== 'undefined' && GAME.tacticalGeometry) ? (GAME.tacticalGeometry.revision || 0) : 0;
    const nw = Array.isArray(M.walls) ? M.walls.length : 0;
    const nc = Array.isArray(M.coverObjects) ? M.coverObjects.length : 0;
    return (M.id || '?') + '|' + rev + '|' + nw + '|' + nc + '|' + M.w + 'x' + M.h;
  }
  function invalidate() { _segCache = null; _segKey = null; }
  function allSegments() {
    const key = _geomKey();
    if (_segCache && key === _segKey) return _segCache;
    const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
    if (!M) { _segCache = []; _segKey = key; return _segCache; }
    const items = [];
    const push = (arr, kind) => {
      if (!Array.isArray(arr)) return;
      for (const o of arr) {
        if (!o || o.x == null) continue;
        // 문은 세 번째 출처다. 시야·엄폐로는 cover와 똑같이 다루지만,
        // "지날 수 있는 장벽"이라는 사실을 기억해 두어야 계획이 문을 통과할 수 있다.
        const kind2 = (kind === 'cover' && typeof isDoor === 'function' && isDoor(o)) ? 'door' : kind;
        items.push({ rect: o, src: o, kind: kind2, _spCls: classNameOf(o, kind2),
                     id: (typeof coverObjectId === 'function' && kind !== 'wall') ? coverObjectId(o) : (o.id || (kind + '_' + Math.round(o.x) + '_' + Math.round(o.y))),
                     material: o.material || 'concrete' });
      }
    };
    push(M.walls, 'wall');
    push(M.coverObjects, 'cover');

    const out = [];
    for (const it of items) {
      const others = items.filter(z => z !== it);
      const C = clsOf(it._spCls);
      rectFaces(it.rect).forEach((f, i) => {
        exposedIntervals(f, others, C.height).forEach(iv => {
          out.push({
            x1: f.a.x + (f.b.x - f.a.x) * iv[0], y1: f.a.y + (f.b.y - f.a.y) * iv[0],
            x2: f.a.x + (f.b.x - f.a.x) * iv[1], y2: f.a.y + (f.b.y - f.a.y) * iv[1],
            wallId: it.id, face: i, nx: f.n.x, ny: f.n.y, material: it.material,
            cls: it._spCls, blocksSight: C.sight, ballistic: C.ballistic, seeOver: !C.sight,
            srcKind: it.kind   // 'wall' | 'cover' — 미러가 knownWalls/knownCovers로 나눌 때 쓴다
          });
        });
      });
    }
    const W = M.w, H = M.h;
    out.push(
      { x1: 0, y1: 0, x2: W, y2: 0, wallId: 'BND', face: 0, nx: 0, ny: 1, material: 'concrete', cls: 'wall', blocksSight: true, ballistic: 1, seeOver: false, srcKind: 'wall' },
      { x1: W, y1: 0, x2: W, y2: H, wallId: 'BND', face: 1, nx: -1, ny: 0, material: 'concrete', cls: 'wall', blocksSight: true, ballistic: 1, seeOver: false, srcKind: 'wall' },
      { x1: W, y1: H, x2: 0, y2: H, wallId: 'BND', face: 2, nx: 0, ny: -1, material: 'concrete', cls: 'wall', blocksSight: true, ballistic: 1, seeOver: false, srcKind: 'wall' },
      { x1: 0, y1: H, x2: 0, y2: 0, wallId: 'BND', face: 3, nx: 1, ny: 0, material: 'concrete', cls: 'wall', blocksSight: true, ballistic: 1, seeOver: false, srcKind: 'wall' }
    );
    _segCache = out; _segKey = key;
    return out;
  }

  function rayHit(ox, oy, ang, maxD, segs) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let best = maxD, hit = null;
    for (const s of segs) {
      const sx = s.x2 - s.x1, sy = s.y2 - s.y1, den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-9) continue;
      const ex = s.x1 - ox, ey = s.y1 - oy;
      const t1 = (sy * ex - sx * ey) / den, t2 = (dy * ex - dx * ey) / den;
      if (t1 >= 0 && t1 < best && t2 >= -0.0005 && t2 <= 1.0005) { best = t1; hit = s; }
    }
    return { dist: best, seg: hit };
  }
  // 넘겨보는 표면은 탐지는 되지만 광선을 멈추지 않는다.
  function rayScan(ox, oy, ang, maxD, segs) {
    const dx = Math.cos(ang), dy = Math.sin(ang), hits = [];
    for (const s of segs) {
      const sx = s.x2 - s.x1, sy = s.y2 - s.y1, den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-9) continue;
      const ex = s.x1 - ox, ey = s.y1 - oy;
      const t1 = (sy * ex - sx * ey) / den, t2 = (dy * ex - dx * ey) / den;
      if (t1 >= 0 && t1 < maxD && t2 >= -0.0005 && t2 <= 1.0005) hits.push({ seg: s, dist: t1 });
    }
    hits.sort((a, b) => a.dist - b.dist);
    let sightDist = maxD, cut = hits.length;
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].seg.blocksSight !== false) { sightDist = hits[i].dist; cut = i + 1; break; }
    }
    return { hits: hits.slice(0, cut), sightDist };
  }
  function pointVisible(ox, oy, px, py, segs, facing, fov, maxD) {
    const dx = px - ox, dy = py - oy, d = Math.hypot(dx, dy);
    if (d > maxD || d < 1e-6) return false;
    if (fov < Math.PI * 2 - 0.01 && Math.abs(normRel(Math.atan2(dy, dx) - facing)) > fov / 2) return false;
    const ux = dx / d, uy = dy / d, tx = px - ux * 0.6, ty = py - uy * 0.6, limit = Math.hypot(tx - ox, ty - oy);
    for (const s of segs) {
      if (s.blocksSight === false) continue;
      const sx = s.x2 - s.x1, sy = s.y2 - s.y1, den = ux * sy - uy * sx;
      if (Math.abs(den) < 1e-9) continue;
      const ex = s.x1 - ox, ey = s.y1 - oy;
      const t1 = (sy * ex - sx * ey) / den, t2 = (uy * ex - ux * ey) / den;
      if (t1 > 0.001 && t1 < limit - 0.001 && t2 >= 0.0005 && t2 <= 0.9995) return false;
    }
    return true;
  }
  function visibilitySampleCount(face) {
    const L = Math.hypot(face.b.x - face.a.x, face.b.y - face.a.y);
    return Math.max(12, Math.min(96, Math.ceil(L / 10)));
  }
  function refine(ox, oy, segs, facing, fov, maxD, tInv, tVis, at) {
    let lo = tInv, hi = tVis;
    for (let k = 0; k < 7; k++) {
      const m = (lo + hi) / 2, p = at(m);
      if (pointVisible(ox, oy, p.x, p.y, segs, facing, fov, maxD)) hi = m; else lo = m;
    }
    return hi;
  }
  function faceVisibleSpans(face, ox, oy, segs, facing, fov, maxD) {
    const N = visibilitySampleCount(face);
    const at = t => ({ x: face.a.x + (face.b.x - face.a.x) * t, y: face.a.y + (face.b.y - face.a.y) * t });
    const vis = [];
    for (let i = 0; i <= N; i++) { const p = at(i / N); vis.push(pointVisible(ox, oy, p.x, p.y, segs, facing, fov, maxD)); }
    const spans = []; let start = null;
    for (let i = 0; i <= N; i++) {
      if (vis[i] && start === null) start = i;
      if ((!vis[i] || i === N) && start !== null) {
        const endI = vis[i] ? i : i - 1;
        let t0 = start / N, t1 = endI / N;
        if (start > 0) t0 = refine(ox, oy, segs, facing, fov, maxD, (start - 1) / N, start / N, at);
        if (endI < N) t1 = refine(ox, oy, segs, facing, fov, maxD, (endI + 1) / N, endI / N, at);
        if (t1 - t0 > 0.008) spans.push({ t0: Math.min(t0, t1), t1: Math.max(t0, t1) });
        start = null;
      }
    }
    return spans;
  }

  // =========================================================
  // 유닛별 기억
  // =========================================================
  function ensureSpatial(unit) {
    const mem = (typeof ensureAIMemory === 'function') ? ensureAIMemory(unit) : (unit.aiMemory || (unit.aiMemory = {}));
    if (!mem.spatial) {
      mem.spatial = {
        surfaces: [], surfaceSeq: 0,
        unknowns: [], unkSeq: 0,
        thresholds: [], thSeq: 0,          // 믿는 벽선 위의 간극 (프론티어와 별개 목록)
        faceAttention: new Map(),
        sector: { known: false, sightClosed: false, solidClosed: false, openings: [] },
        prevPos: null, crossedThisTick: null,
        lastSenseAt: -999, lastDoorwayAt: -999,
        stats: { reconcileSplits: 0, reconcileKills: 0, absorbed: 0, born: 0 }
      };
    }
    return mem.spatial;
  }
  function tauFor(unit) {
    const prof = (typeof getScanProfile === 'function') ? getScanProfile(unit) : null;
    const mul = (prof && prof.memoryDecayMul) ? prof.memoryDecayMul : 1.0;
    return BASE_TAU / Math.max(0.2, mul);   // 신병은 빨리 잊고, 베테랑은 오래 기억한다
  }
  function confidenceAt(w, now, tau) {
    const dt = Math.max(0, now - w.lastSeen);
    const ev = Math.max(CONF_FLOOR, Math.min(1, w.evidence != null ? w.evidence : 1));
    return CONF_FLOOR + (ev - CONF_FLOOR) * Math.exp(-dt / tau);
  }
  function memoryState(c) { return c >= MEMORY_CONFIRMED ? 'confirmed' : c >= MEMORY_UNCERTAIN ? 'uncertain' : 'stale'; }
  function projOn(w, px, py) { return (px - w.ox) * w.ux + (py - w.oy) * w.uy; }
  function perpOn(w, px, py) { return Math.abs((px - w.ox) * w.nx + (py - w.oy) * w.ny); }

  function surfaceSegments(S, now, tau, minConfidence, filter) {
    const out = [];
    for (const w of S.surfaces) {
      const c = confidenceAt(w, now, tau);
      if (c < minConfidence) continue;
      if (filter && !filter(w)) continue;
      out.push({
        x1: w.ox + w.ux * w.tMin, y1: w.oy + w.uy * w.tMin,
        x2: w.ox + w.ux * w.tMax, y2: w.oy + w.uy * w.tMax,
        ref: w, confidence: c, memoryState: memoryState(c),
        blocksSight: w.blocksSight !== false, cls: w.cls || 'wall'
      });
    }
    return out;
  }
  // AI가 "시야를 막는다"고 믿는 것 — 섹터 폐쇄 판정은 이걸로 한다
  function sightMemory(S, now, tau, minC) { return surfaceSegments(S, now, tau, minC, w => w.blocksSight !== false); }

  // 같은 면 = 같은 직선 + 같은 방향 + 같은 재질.
  // 그 직선을 따라 더 멀리서 본 조각은 새 벽이 아니라 같은 벽을 다른 데서 본 것이다.
  function sameSurface(w, obs) {
    if (w.material !== obs.material) return false;
    if ((w.cls || 'wall') !== (obs.cls || 'wall')) return false;
    if ((w.srcKind || 'wall') !== (obs.srcKind || 'wall')) return false;   // 방 벽과 상자를 한 면으로 합치지 않는다
    if (w.nx * obs.nx + w.ny * obs.ny < NORMAL_TOL) return false;
    return perpOn(w, obs.x1, obs.y1) <= PERP_TOL && perpOn(w, obs.x2, obs.y2) <= PERP_TOL;
  }
  function matchSurface(S, obs) {
    let best = null, bestGap = Infinity;
    for (const w of S.surfaces) {
      if (!sameSurface(w, obs)) continue;
      const p1 = projOn(w, obs.x1, obs.y1), p2 = projOn(w, obs.x2, obs.y2);
      const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
      const gap = Math.max(w.tMin - hi, lo - w.tMax, 0);
      if (gap > COLLINEAR_GAP) continue;
      if (gap < bestGap) { bestGap = gap; best = w; }
    }
    return best;
  }
  // 이미 확정된 모서리 너머의 조각은 진짜 다른 면이다
  function matchSurfaceStrict(S, obs) {
    const w = matchSurface(S, obs);
    if (!w) return null;
    const p1 = projOn(w, obs.x1, obs.y1), p2 = projOn(w, obs.x2, obs.y2);
    const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
    if (hi < w.tMin && w.minCorner && w.tMin - hi > GAP_TOL) return null;
    if (lo > w.tMax && w.maxCorner && lo - w.tMax > GAP_TOL) return null;
    return w;
  }
  function absorbObservation(S, obs, now, dt) {
    let w = matchSurfaceStrict(S, obs);
    const strength = clamp01v(obs.strength != null ? obs.strength : 0.5);
    // 재질 증거 — senseFor가 낸 관측 품질(matQuality)을 그대로 쓴다.
    //   strength(기하 신뢰도)에 거리·입사각 감쇠를 더 건 값이다.
    const matGain = (obs.matQuality != null ? obs.matQuality : strength) * (dt != null ? dt : 1 / 30);
    if (!w) {
      const dx = obs.x2 - obs.x1, dy = obs.y2 - obs.y1, L = Math.hypot(dx, dy);
      if (L < 2) return null;
      w = {
        name: 'M-' + String(++S.surfaceSeq).padStart(2, '0'), material: obs.material,
        ox: obs.x1, oy: obs.y1, ux: dx / L, uy: dy / L, nx: obs.nx, ny: obs.ny,
        tMin: 0, tMax: L, minCorner: obs.c1, maxCorner: obs.c2,
        cls: obs.cls || 'wall', blocksSight: obs.blocksSight !== false, ballistic: obs.ballistic != null ? obs.ballistic : 1,
        srcKind: obs.srcKind || 'wall',
        trueIds: new Set([obs.wallId]),
        firstSeen: now, lastSeen: now, evidence: 0.34 + strength * 0.18, observations: 1,
        materialEvidence: matGain, materialKnown: null, believedMaterialId: null
      };
      updateBelievedMaterial(w);
      S.surfaces.push(w); S.stats.born++;
      return w;
    }
    const p1 = projOn(w, obs.x1, obs.y1), p2 = projOn(w, obs.x2, obs.y2);
    const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
    const loC = (p1 < p2) ? obs.c1 : obs.c2, hiC = (p1 < p2) ? obs.c2 : obs.c1;
    if (lo < w.tMin - 0.6) { w.tMin = lo; w.minCorner = loC; } else if (loC && lo - w.tMin < 2) w.minCorner = true;
    if (hi > w.tMax + 0.6) { w.tMax = hi; w.maxCorner = hiC; } else if (hiC && w.tMax - hi < 2) w.maxCorner = true;
    w.trueIds.add(obs.wallId); w.lastSeen = now;
    w.observations = (w.observations || 0) + 1;
    w.evidence = Math.min(1, (w.evidence != null ? w.evidence : 0.45) + (1 - (w.evidence != null ? w.evidence : 0.45)) * (0.035 + strength * 0.09));
    w.materialEvidence = (w.materialEvidence || 0) + matGain;
    updateBelievedMaterial(w);
    S.stats.absorbed++;
    return w;
  }

  // ---- 반증: 기억한 벽을 뚫고 보였다면 그 기억이 틀린 것이다 ----
  function raySegPoint(p, q, a, b) {
    const r = { x: q.x - p.x, y: q.y - p.y }, s = { x: b.x - a.x, y: b.y - a.y };
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((a.x - p.x) * s.y - (a.y - p.y) * s.x) / den;
    const u = ((a.x - p.x) * r.y - (a.y - p.y) * r.x) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: p.x + r.x * t, y: p.y + r.y * t };
  }
  function reconcileMemory(S, unit, rays, now) {
    if (!S.surfaces.length || !rays.length) return;
    const born = [];
    for (const w of S.surfaces) {
      if (w.blocksSight === false) continue;   // 광선이 통과하는 게 정상인 등급
      const A = { x: w.ox + w.ux * w.tMin, y: w.oy + w.uy * w.tMin };
      const B = { x: w.ox + w.ux * w.tMax, y: w.oy + w.uy * w.tMax };
      const holes = [];
      for (const r of rays) {
        const clear = r.dist - 2.0;
        if (clear <= 3) continue;
        const P = { x: unit.x, y: unit.y };
        const Q = { x: P.x + Math.cos(r.ang) * clear, y: P.y + Math.sin(r.ang) * clear };
        const hit = raySegPoint(P, Q, A, B);
        if (hit) holes.push(projOn(w, hit.x, hit.y));
      }
      if (!holes.length) continue;
      const cuts = mergeIntervals(holes.map(t => [t - HOLE_MARGIN, t + HOLE_MARGIN]));
      const pieces = []; let cur = w.tMin;
      for (const c of cuts) {
        if (c[1] <= w.tMin || c[0] >= w.tMax) continue;
        if (c[0] > cur + MIN_PIECE) pieces.push([cur, c[0]]);
        cur = Math.max(cur, c[1]);
      }
      if (w.tMax > cur + MIN_PIECE) pieces.push([cur, w.tMax]);
      if (!pieces.length) { w.doomed = true; S.stats.reconcileKills++; continue; }
      const [f0, f1] = pieces[0];
      const keptMin = f0 <= w.tMin + 0.5 ? w.minCorner : true;   // 잘린 끝은 모서리다 — 그 너머가 보였으니까
      const keptMax = f1 >= w.tMax - 0.5 ? w.maxCorner : true;
      for (let i = 1; i < pieces.length; i++) {
        const [g0, g1] = pieces[i];
        born.push({
          name: 'M-' + String(++S.surfaceSeq).padStart(2, '0'), material: w.material,
          ox: w.ox, oy: w.oy, ux: w.ux, uy: w.uy, nx: w.nx, ny: w.ny,
          cls: w.cls, blocksSight: w.blocksSight, ballistic: w.ballistic, srcKind: w.srcKind,
          // 재질 인지는 쪼개도 남는다 — 같은 벽을 본 경험이지 구간별 경험이 아니다
          materialEvidence: w.materialEvidence, materialKnown: w.materialKnown,
          believedMaterialId: w.believedMaterialId,
          tMin: g0, tMax: g1, minCorner: true, maxCorner: g1 >= w.tMax - 0.5 ? w.maxCorner : true,
          trueIds: new Set(), firstSeen: w.firstSeen, lastSeen: w.lastSeen,
          evidence: Math.max(CONF_FLOOR, (w.evidence != null ? w.evidence : 0.5) * 0.75),
          observations: Math.max(1, Math.round((w.observations || 1) / 2))
        });
      }
      if (pieces.length > 1) { S.stats.reconcileSplits++; w.trueIds = new Set(); }
      w.tMin = f0; w.tMax = f1; w.minCorner = keptMin; w.maxCorner = keptMax;
      w.evidence = Math.max(CONF_FLOOR, (w.evidence != null ? w.evidence : 0.5) * 0.75);
    }
    if (born.length) S.surfaces = S.surfaces.concat(born);
    if (S.surfaces.some(w => w.doomed)) S.surfaces = S.surfaces.filter(w => !w.doomed);
  }

  // ---- 두께는 직접 관측되지 않는다. 양면을 봐야 추론된다 ----
  function updateThicknessEstimates(S, now, tau) {
    for (const w of S.surfaces) { w.thickness = null; w.thicknessFrom = null; }
    for (let i = 0; i < S.surfaces.length; i++) {
      for (let j = i + 1; j < S.surfaces.length; j++) {
        const a = S.surfaces[i], b = S.surfaces[j];
        if (a.material !== b.material || (a.cls || 'wall') !== (b.cls || 'wall')) continue;
        if (a.nx * b.nx + a.ny * b.ny > -0.95) continue;              // 두 면이 서로 반대를 봐야 한다
        const bm = (b.tMin + b.tMax) / 2, bmx = b.ox + b.ux * bm, bmy = b.oy + b.uy * bm;
        const th = -((bmx - a.ox) * a.nx + (bmy - a.oy) * a.ny);
        if (th < 1 || th > MAX_THICKNESS) continue;
        const p1 = projOn(a, b.ox + b.ux * b.tMin, b.oy + b.uy * b.tMin);
        const p2 = projOn(a, b.ox + b.ux * b.tMax, b.oy + b.uy * b.tMax);
        const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
        const overlap = Math.min(hi, a.tMax) - Math.max(lo, a.tMin);
        if (overlap < Math.min(_px(0.75), (a.tMax - a.tMin) * 0.35)) continue;   // 같은 구간이어야 한다
        const conf = Math.min(confidenceAt(a, now, tau), confidenceAt(b, now, tau));
        if (!a.thickness || conf > a.thicknessConf) { a.thickness = th; a.thicknessConf = conf; a.thicknessFrom = b.name; }
        if (!b.thickness || conf > b.thicknessConf) { b.thickness = th; b.thicknessConf = conf; b.thicknessFrom = a.name; }
      }
    }
  }
  function ballisticResistanceEstimate(w) {
    // 실제 재질이 아니라 "믿는 재질"로 저항을 추정한다 — 이게 AI가 가진 정보의 전부다
    const mat = materialResist(believedMaterial(w));
    const clsBall = (w.ballistic != null ? w.ballistic : 1);
    if (w.thickness == null) return { value: mat * clsBall * 0.5, thicknessKnown: false, note: '두께 미상 — 겉보기 재질만' };
    return { value: Math.min(1, mat * clsBall * Math.min(1, w.thickness / THICK_REF)), thicknessKnown: true, note: null };
  }
  function pruneMemory(S, now, tau) {
    if (S.surfaces.length < 4) return;
    S.surfaces = S.surfaces.filter(w => {
      const age = now - w.lastSeen;
      const len = w.tMax - w.tMin;
      // 몇 번 못 보고 재확인도 안 된 짧은 조각은 센서 노이즈다
      if (len < FRAGMENT_LEN && (w.observations || 0) < FRAGMENT_OBS && age > FRAGMENT_TTL) return false;
      // 바닥까지 삭았고 오래 안 본 것은 더 이상 지도의 일부가 아니다
      if (confidenceAt(w, now, tau) <= CONF_FLOOR + 0.005 && age > FRAGMENT_TTL * 5) return false;
      return true;
    });
  }

  // =========================================================
  // 문턱 — 믿는 벽선 위의 간극
  //
  //   섹터의 "개구부"(아래)와 **다른 물건이다.** 개구부는 시선이 무한으로 빠져나가는
  //   방향이라 잘 알수록 0으로 수렴한다 — 그게 sightClosed고, "이 방은 다 봤다"는 뜻이다.
  //   문턱은 벽이 끊긴 자리다. 벽을 잘 알수록 오히려 또렷해진다.
  //   둘을 같은 목록에 섞으면 방을 못 만든다(이전 위상 시도가 정확히 그렇게 실패했다).
  //
  //   경계는 세 종류다:  벽 = S.surfaces / 문턱 = S.thresholds / 프론티어 = S.sector.openings
  // =========================================================
  const TH_MIN_M = 0.6, TH_MAX_M = 2.6;   // 문으로 볼 간극 폭
  const TH_LINE_TOL = 6;                  // 같은 벽선으로 볼 원점거리 오차 (px)
  const TH_MIN_SEG = 8;                   // 이보다 짧은 조각은 벽선 근거로 쓰지 않는다
  const TH_DOOR_NEAR = 24;                // 이 안에 믿는 문짝이 있으면 확정 문턱
  //   문턱은 **기억된다.** 벽면이 삭아도 "저기 문이 있었다"는 사실은 남는다 —
  //   문간은 움직이지 않으므로 프론티어(UNK_STALE_TTL 25초)보다 훨씬 오래 붙잡는다.
  const TH_STALE_TTL = 90;                // 이만큼 다시 못 보면 잊는다 (초)
  const TH_MATCH_SCORE = 90;              // 이 점수 아래면 같은 문턱으로 본다

  function findBeliefThresholds(S, unit, now, tau) {
    const usable = [], doorSegs = [];
    for (const w of S.surfaces) {
      if (w.blocksSight === false) continue;               // 넘겨보는 물체는 벽선이 아니다
      if (confidenceAt(w, now, tau) < MEMORY_UNCERTAIN) continue;
      if (w.srcKind === 'door') {
        doorSegs.push({ x: w.ox + w.ux * (w.tMin + w.tMax) / 2, y: w.oy + w.uy * (w.tMin + w.tMax) / 2 });
        continue;                                          // 문짝 자신은 벽선 근거가 아니다
      }
      if ((w.tMax - w.tMin) < TH_MIN_SEG) continue;
      usable.push(w);
    }
    // (법선 방향, 원점거리)로 같은 벽선끼리 묶는다. 벽의 반대쪽 면은 법선이 반대라 안 묶인다.
    const groups = new Map();
    for (const w of usable) {
      const perp = w.ox * w.nx + w.oy * w.ny;
      const key = (Math.round(w.nx * 4) / 4) + '|' + (Math.round(w.ny * 4) / 4) + '|' + Math.round(perp / TH_LINE_TOL);
      let g = groups.get(key);
      if (!g) { g = []; groups.set(key, g); }
      g.push(w);
    }
    const minGap = _px(TH_MIN_M), maxGap = _px(TH_MAX_M);
    const out = [];
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const base = g[0], ux = base.ux, uy = base.uy, ox = base.ox, oy = base.oy;
      const proj = (x, y) => (x - ox) * ux + (y - oy) * uy;
      const iv = g.map(w => {
        const a = proj(w.ox + w.ux * w.tMin, w.oy + w.uy * w.tMin);
        const b = proj(w.ox + w.ux * w.tMax, w.oy + w.uy * w.tMax);
        return { s: Math.min(a, b), e: Math.max(a, b), w };
      }).sort((A, B) => A.s - B.s);
      for (let i = 1; i < iv.length; i++) {
        const L = iv[i - 1], R = iv[i];
        const gap = R.s - L.e;
        if (gap < minGap || gap > maxGap) continue;
        // 양쪽 끝이 확정된 모서리여야 문설주다 — 그 너머를 실제로 봤다는 뜻
        const confirmed = !!((L.w.minCorner || L.w.maxCorner) && (R.w.minCorner || R.w.maxCorner));
        const gateA = { x: ox + ux * L.e, y: oy + uy * L.e };
        const gateB = { x: ox + ux * R.s, y: oy + uy * R.s };
        const mid = (L.e + R.s) / 2;
        const ix = ox + ux * mid, iy = oy + uy * mid;
        // 문짝을 본 적이 있으면 추론이 아니라 확정이다
        let doorBacked = false;
        for (const d of doorSegs) { if (Math.hypot(d.x - ix, d.y - iy) <= TH_DOOR_NEAR) { doorBacked = true; break; } }
        out.push({
          ix, iy, gateA, gateB, width: gap,
          gateAngle: Math.atan2(gateB.y - gateA.y, gateB.x - gateA.x),
          // openingMatchScore가 방위(mid)를 동점 처리에 쓴다 — 관측자 기준 방위를 준다
          mid: unit ? Math.atan2(iy - unit.y, ix - unit.x) : 0,
          nx: base.nx, ny: base.ny,
          leftWall: L.w.name, rightWall: R.w.name,
          confirmed, doorBacked,
          lastSeen: Math.max(L.w.lastSeen || 0, R.w.lastSeen || 0)
        });
      }
    }
    return out;
  }

  // 문턱을 **기억으로 합친다.** 매번 새로 만들면 벽면이 삭을 때 문턱도 같이 사라지고,
  //   AI는 방금 지나온 문도 잊는다. openingMatchScore는 게이트 양끝 월드 좌표와
  //   문설주 표면 이름으로 점수를 매기므로 문턱에 그대로 쓸 수 있다(설계상 같은 모양이다).
  // 소비자용 접근자 — 양쪽 문설주가 **확정된 모서리**인 문턱만.
  //   "그 너머를 실제로 봤다"는 뜻이라 허깨비 문을 경계하는 일이 크게 줄어든다.
  //   실측(5회 × 30초): 전부 90% 정밀도 / 확정만 98%. 팀 문간 4.8 → 4.6으로 거의 안 잃는다.
  //   원본 목록은 그대로 둔다 — 탐색처럼 덜 확실한 것도 쓰고 싶은 소비자가 있다.
  function confirmedThresholds(S) {
    if (!S || !Array.isArray(S.thresholds)) return [];
    return S.thresholds.filter(t => t.confirmed);
  }
  function thresholdsOf(unit, opts) {
    const S = unit && unit.aiMemory && unit.aiMemory.spatial;
    if (!S) return [];
    return (opts && opts.all) ? (S.thresholds || []) : confirmedThresholds(S);
  }
  // 이 지점의 장벽에 대해 **내가 믿는 것**.
  //   사격 결정(관통할까 우회할까)이 정답 재질 대신 이걸 읽으면,
  //   지금까지 쌓아 둔 재질 오인이 처음으로 결과를 낳는다 —
  //   석고보드를 콘크리트로 잘못 믿으면 뚫을 수 있는 벽을 안 뚫는다.
  //   못 본 장벽은 null을 돌려준다. 소비자가 보수적으로(콘크리트) 처리한다.
  function believedBarrierAt(unit, x, y, maxDist) {
    const S = unit && unit.aiMemory && unit.aiMemory.spatial;
    if (!S || !S.surfaces.length) return null;
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    const tau = tauFor(unit);
    let best = null, bestD = (maxDist != null) ? maxDist : _px(0.7);
    for (const w of S.surfaces) {
      if (confidenceAt(w, now, tau) < MEMORY_UNCERTAIN) continue;
      const t = Math.max(w.tMin, Math.min(w.tMax, projOn(w, x, y)));
      const d = Math.hypot(w.ox + w.ux * t - x, w.oy + w.uy * t - y);
      if (d < bestD) { bestD = d; best = w; }
    }
    if (!best) return null;
    return {
      surfaceName: best.name, srcKind: best.srcKind,
      material: believedMaterial(best),          // 믿는 재질 — 틀릴 수 있다
      materialKnown: materialKnownLevel(best),   // 'unknown' | 'class' | 'exact'
      thickness: best.thickness,                 // null이면 한 면만 봐서 두께 미상
      resistance: ballisticResistanceEstimate(best),
      confidence: confidenceAt(best, now, tau),
      distance: bestD
    };
  }

  // 소음이 어느 문턱으로 들어왔나.
  //
  //   **직선 교차로 풀면 안 된다.** 소리는 벽을 관통해 오지 않고 문을 돌아 들어온다 —
  //   다른 방 유닛 사이의 직선은 대개 문이 아니라 벽을 지난다(실측: 72쌍 전부 실패했다).
  //   정답 쪽 resolveSoundArrivalPortal도 직선이 아니라 포탈 체인의 첫 문을 쓴다.
  //
  //   그래서 믿음 쪽도 같은 의미로 답한다:
  //     1) 믿는 지형에 가리는 게 없으면 → 같은 방에서 난 소리
  //     2) 가려 있으면 → 내가 아는 문 중 **우회 거리가 가장 짧은 문**
  //        (나→문 + 문너머→소리). 내가 아는 문만 놓고 1홉 경로를 고르는 셈이다.
  //   방을 다각형으로 나누지 않고도 답이 나온다 — 그게 이 설계의 요점이다.
  function thresholdForNoise(unit, noiseX, noiseY, opts) {
    const S = unit && unit.aiMemory && unit.aiMemory.spatial;
    if (!S) return { threshold: null, sameRoom: true, known: false };
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    const dx = noiseX - unit.x, dy = noiseY - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { threshold: null, sameRoom: true, known: true };
    // 1) 믿는 지형 기준으로 소리 나는 곳이 가려져 있나
    const memSegs = sightMemory(S, now, tauFor(unit), MEMORY_UNCERTAIN);
    const blocked = !!rayHit(unit.x, unit.y, Math.atan2(dy, dx), dist - _px(0.25), memSegs).seg;
    if (!blocked) return { threshold: null, sameRoom: true, known: true };
    // 2) 가려 있다 — 아는 문 중 우회가 가장 짧은 문으로 들어온 것으로 본다
    const list = thresholdsOf(unit, opts);
    if (!list.length) return { threshold: null, sameRoom: false, known: false };
    //   문 중심을 경유점으로 삼는다. 문 '너머' 지점(ax/ay)은 처음 발견한 위치 기준이라
    //   유닛이 반대편으로 넘어가면 엉뚱한 쪽을 가리킨다 — 우회 계산에 쓰면 안 된다.
    let best = null, bestD = Infinity;
    for (const t of list) {
      const d = Math.hypot(t.ix - unit.x, t.iy - unit.y) + Math.hypot(noiseX - t.ix, noiseY - t.iy);
      if (d < bestD) { bestD = d; best = t; }
    }
    return { threshold: best, sameRoom: false, known: true, detour: bestD };
  }

  function mergeThresholds(S, unit, fresh, now) {
    const list = S.thresholds;
    for (const f of fresh) {
      let m = null, best = TH_MATCH_SCORE;
      for (const t of list) { const sc = openingMatchScore(t, f); if (sc < best) { best = sc; m = t; } }
      if (m) {
        // 위치는 천천히 따라간다(관측 잡음 흡수), 성질은 최신 관측을 신뢰한다
        m.ix = m.ix * 0.7 + f.ix * 0.3; m.iy = m.iy * 0.7 + f.iy * 0.3;
        m.gateA = f.gateA; m.gateB = f.gateB; m.width = f.width; m.gateAngle = f.gateAngle;
        m.mid = f.mid; m.nx = f.nx; m.ny = f.ny;
        m.leftWall = f.leftWall; m.rightWall = f.rightWall;
        m.confirmed = m.confirmed || f.confirmed;      // 한 번 확정되면 유지
        m.doorBacked = m.doorBacked || f.doorBacked;
        m.lastSeen = now; m.observations = (m.observations || 1) + 1;
      } else {
        list.push(Object.assign({
          name: 'TH-' + String(++S.thSeq).padStart(2, '0'),
          state: 'detected', visited: false, observations: 1,
          firstSeen: now, ax: null, ay: null
        }, f, { lastSeen: now }));
      }
    }
    // 문턱 너머를 봤는지 판정할 목표점 — 문턱에서 법선 방향으로 한 발 너머
    for (const t of list) {
      if (t.ax == null) {
        const step = _px(1.5);
        const sx = t.ix + t.nx * step, sy = t.iy + t.ny * step;
        const bx = t.ix - t.nx * step, by = t.iy - t.ny * step;
        // 관측자 반대쪽이 '너머'다
        const away = (Math.hypot(sx - unit.x, sy - unit.y) > Math.hypot(bx - unit.x, by - unit.y));
        const p = clampArena(away ? { x: sx, y: sy } : { x: bx, y: by });
        t.ax = p.x; t.ay = p.y;
      }
    }
  }

  // =========================================================
  // 섹터 / 개구부 (미확인 구역)
  // =========================================================
  function clampArena(p) {
    const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
    const r = (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS + 3 : 14;
    if (!M) return p;
    return { x: Math.max(r, Math.min(M.w - r, p.x)), y: Math.max(r, Math.min(M.h - r, p.y)) };
  }
  //   프론티어와 문턱은 같은 상태기계를 쓰지만 **목록은 절대 섞지 않는다.**
  //   list 인자로 어느 목록을 돌리는지 정한다. crossedThisTick은 둘 중 먼저 넘은 것을 담는다.
  function updateUnknownStates(S, unit, truthSegs, fov, maxD, now, list, staleTtl) {
    const items = list || S.unknowns;
    if (items === S.unknowns) S.crossedThisTick = null;
    for (const u of items) {
      const d = Math.hypot(u.ix - unit.x, u.iy - unit.y);
      if (u.state === 'detected' && d < UNK_APPROACH) u.state = 'approached';
      if (S.prevPos && u.gateA && u.gateB && crossesGate(S.prevPos, unit, u.gateA, u.gateB)) {
        u.state = 'crossed'; u.crossedAt = now; u.visited = true; S.crossedThisTick = u;
      } else if (u.state === 'approached' && u.ax != null && Math.hypot(u.ax - unit.x, u.ay - unit.y) < maxD * 0.8 &&
                 pointVisible(unit.x, unit.y, u.ax, u.ay, truthSegs, unit.facing, fov, maxD)) {
        u.state = 'observedBeyond'; u.observedBeyondAt = now; u.visited = true;
      }
      u.visited = unknownFinished(u);
    }
    // 문턱은 해결됐다고 잊지 않는다 — 넘어간 문도 계속 거기 있다(경계 대상이다).
    const resolvedTtl = (items === S.unknowns) ? UNK_RESOLVED_TTL : Infinity;
    const stale = (staleTtl != null) ? staleTtl : UNK_STALE_TTL;
    const kept = items.filter(u => {
      const idle = now - u.lastSeen;
      if (unknownFinished(u) && idle > resolvedTtl) return false;
      if (idle > stale) return false;
      return true;
    });
    if (items === S.unknowns) S.unknowns = kept; else S.thresholds = kept;
  }
  function analyzeSector(S, unit, truthSegs, fov, maxD, now, tau) {
    const memSegs = sightMemory(S, now, tau, MEMORY_UNCERTAIN);
    const solidSegs = surfaceSegments(S, now, tau, MEMORY_UNCERTAIN, null);
    const hits = [];
    for (let i = 0; i < SECTOR_RAYS; i++) {
      const a = (i / SECTOR_RAYS) * Math.PI * 2;
      const h = rayHit(unit.x, unit.y, a, FAR, memSegs);
      hits.push({ a, esc: !h.seg, seg: h.seg, x: unit.x + Math.cos(a) * h.dist, y: unit.y + Math.sin(a) * h.dist });
    }
    const esc = hits.map(h => h.esc), ranges = [];
    if (esc.every(v => v)) ranges.push({ s: 0, e: SECTOR_RAYS - 1, n: SECTOR_RAYS, full: true });
    else if (esc.some(v => v)) {
      const start = esc.findIndex(v => !v); let cur = null;
      for (let k = 0; k < SECTOR_RAYS; k++) {
        const i = (start + k) % SECTOR_RAYS;
        if (esc[i]) { if (!cur) cur = { s: i, e: i, n: 1 }; else { cur.e = i; cur.n++; } }
        else if (cur) { ranges.push(cur); cur = null; }
      }
      if (cur) ranges.push(cur);
    }
    const openings = [];
    for (const r of ranges) {
      if (!r.full && r.n < MIN_GAP_RAYS) continue;
      const midIdx = (r.s + Math.floor((r.n - 1) / 2)) % SECTOR_RAYS;
      const mid = hits[midIdx].a;
      let gateA = null, gateB = null, gateD, leftWall = null, rightWall = null;
      if (r.full) { gateD = _px(3); }
      else {
        const before = hits[(r.s - 1 + SECTOR_RAYS) % SECTOR_RAYS], after = hits[(r.e + 1) % SECTOR_RAYS];
        gateA = { x: before.x, y: before.y }; gateB = { x: after.x, y: after.y };
        leftWall = (before.seg && before.seg.ref) ? before.seg.ref.name : null;
        rightWall = (after.seg && after.seg.ref) ? after.seg.ref.name : null;
        gateD = Math.max(GATE_MIN, Math.min(Math.hypot(gateA.x - unit.x, gateA.y - unit.y), Math.hypot(gateB.x - unit.x, gateB.y - unit.y)));
      }
      const ix = unit.x + Math.cos(mid) * gateD, iy = unit.y + Math.sin(mid) * gateD;
      // 시야 지도는 탈출해도 넘겨보는 물체가 길을 막을 수 있다 — 그 앞에서 멈춘다
      const bar = rayHit(unit.x, unit.y, mid, gateD + GATE_BEYOND, solidSegs);
      const reach = bar.seg ? Math.max(_px(0.7), bar.dist - _px(0.65)) : gateD + GATE_BEYOND;
      const pa = clampArena({ x: unit.x + Math.cos(mid) * reach, y: unit.y + Math.sin(mid) * reach });
      const op = { mid, span: r.n * (2 * Math.PI / SECTOR_RAYS), ax: pa.x, ay: pa.y, ix, iy, gateA, gateB, full: !!r.full, leftWall, rightWall };
      op.width = openingWidth(op); op.gateAngle = openingGateAngle(op); openings.push(op);
    }
    for (const op of openings) {
      let m = null, best = UNK_MATCH_SCORE;
      for (const u of S.unknowns) { const score = openingMatchScore(u, op); if (score < best) { best = score; m = u; } }
      if (m) {
        m.ix = m.ix * 0.78 + op.ix * 0.22; m.iy = m.iy * 0.78 + op.iy * 0.22;
        m.ax = op.ax; m.ay = op.ay; m.gateA = op.gateA; m.gateB = op.gateB; m.mid = op.mid;
        m.width = op.width; m.gateAngle = op.gateAngle; m.leftWall = op.leftWall; m.rightWall = op.rightWall;
        m.lastSeen = now; op.unk = m;
      } else {
        const u = {
          name: 'UNK-' + String(++S.unkSeq).padStart(2, '0'), ix: op.ix, iy: op.iy, ax: op.ax, ay: op.ay,
          gateA: op.gateA, gateB: op.gateB, mid: op.mid, width: op.width, gateAngle: op.gateAngle,
          leftWall: op.leftWall, rightWall: op.rightWall,
          state: 'detected', visited: false, firstSeen: now, lastSeen: now
        };
        S.unknowns.push(u); op.unk = u;
      }
    }
    updateUnknownStates(S, unit, truthSegs, fov, maxD, now);
    const sightKnown = memSegs.length > 0;
    let solidEscapes = 0;
    if (solidSegs.length) for (let i = 0; i < SECTOR_RAYS; i += 2) {
      const a = (i / SECTOR_RAYS) * Math.PI * 2;
      if (!rayHit(unit.x, unit.y, a, FAR, solidSegs).seg) solidEscapes++;
    }
    S.sector = {
      known: solidSegs.length > 0,
      sightClosed: openings.length === 0 && sightKnown,
      solidClosed: solidSegs.length > 0 && solidEscapes === 0,
      openings
    };
  }

  // =========================================================
  // 진입점
  // =========================================================
  function senseFor(unit, dt, nowArg) {
    if (!unit || unit.x == null) return null;
    const now = (nowArg != null) ? nowArg : ((typeof GAME !== 'undefined') ? GAME.gameTime : 0);
    const S = ensureSpatial(unit);
    const segs = allSegments();
    if (!segs.length) return S;

    const fov = (typeof getEffectiveViewArc === 'function') ? getEffectiveViewArc(unit) : (unit.viewArc || Math.PI);
    const maxD = (typeof getEffectiveVisionRange === 'function') ? getEffectiveVisionRange(unit) : (unit.sightRange || _px(24));
    const prof = (typeof getScanProfile === 'function') ? getScanProfile(unit) : null;
    const nRays = Math.max(6, (prof && prof.rayCount) ? prof.rayCount * 2 : 24);
    const tau = tauFor(unit);
    const full = fov >= Math.PI * 2 - 0.01;

    // 1) 광선 — 넘겨보는 표면은 통과시키되 탐지는 한다
    const rays = [];
    const hitsBySeg = new Map();
    for (let i = 0; i < nRays; i++) {
      const ang = full ? (i / nRays) * Math.PI * 2 : unit.facing - fov / 2 + (nRays > 1 ? fov * i / (nRays - 1) : fov / 2);
      const scan = rayScan(unit.x, unit.y, ang, maxD, segs);
      rays.push({ ang, dist: scan.sightDist });
      const rel = full ? 0 : Math.abs(normRel(ang - unit.facing)) / (fov / 2 || 1);
      const centrality = full ? 0.55 : clamp01v(1 - rel);
      for (const h of scan.hits) {
        const hx = unit.x + Math.cos(ang) * h.dist, hy = unit.y + Math.sin(ang) * h.dist;
        if (!hitsBySeg.has(h.seg)) hitsBySeg.set(h.seg, []);
        hitsBySeg.get(h.seg).push({ t: segmentParam(h.seg, hx, hy), centrality });
      }
    }

    // 2) 주의력 감쇠 — 안 보는 면은 관측 구간이 좁아진다
    for (const [key, a] of S.faceAttention) {
      if (now - a.lastSeen > 0.001) a.attention = Math.max(0, a.attention * Math.exp(-dt * 1.35));
      if (a.attention < 0.01 && now - a.lastSeen > 2) S.faceAttention.delete(key);
    }

    // 3) 관측 흡수
    const observedNow = new Set();
    for (const [seg, samples] of hitsBySeg) {
      const mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
      const facingMe = seg.nx * (unit.x - mx) + seg.ny * (unit.y - my) > 0;
      // 전신 벽은 이쪽을 향한 면만 보인다. 내려다보는 물체는 전체 발자국이 보이되 먼 쪽이 약하게 읽힌다.
      if (!facingMe && !seg.seeOver) continue;
      const farFace = !facingMe;
      const key = surfaceGeomKey(seg);
      let maxCentral = 0;
      for (const s of samples) if (s.centrality > maxCentral) maxCentral = s.centrality;
      const att = S.faceAttention.get(key) || { attention: 0, lastSeen: now };
      att.attention = Math.min(1.6, att.attention + dt * (0.65 + maxCentral * 1.8 + Math.min(0.5, samples.length * 0.06)));
      att.lastSeen = now; S.faceAttention.set(key, att);
      const L = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) || 1;
      const radiusPx = ATT_RADIUS_MIN + att.attention * ATT_RADIUS_GAIN;
      const sensed = mergeIntervals(samples.map(p => [clamp01v(p.t - radiusPx / L), clamp01v(p.t + radiusPx / L)]));
      const face = { a: { x: seg.x1, y: seg.y1 }, b: { x: seg.x2, y: seg.y2 }, n: { x: seg.nx, y: seg.ny } };
      const visible = faceVisibleSpans(face, unit.x, unit.y, segs, unit.facing, fov, maxD).map(sp => [sp.t0, sp.t1]);
      for (const iv of intersectIntervals(sensed, visible)) {
        const t0 = iv[0], t1 = iv[1];
        const strength = clamp01v((0.28 + maxCentral * 0.42 + att.attention * 0.18) * (farFace ? 0.55 : 1));
        // 재질 식별력은 기하 관측과 다르게 떨어진다.
        //   벽이 거기 있다는 건 멀리서도 알지만, 콘크리트인지 강철인지는 가까이서 정면으로 봐야 안다.
        //   그래서 거리·입사각 감쇠를 재질 증거에만 따로 건다 (strength는 기하 신뢰도라 건드리지 않는다).
        const _ox = (face.a.x + (face.b.x - face.a.x) * (t0 + t1) / 2);
        const _oy = (face.a.y + (face.b.y - face.a.y) * (t0 + t1) / 2);
        const _d = Math.hypot(_ox - unit.x, _oy - unit.y);
        const distMul = clamp01v((MAT_DIST_FAR - _d) / (MAT_DIST_FAR - MAT_DIST_NEAR));
        const _vx = (unit.x - _ox) / (_d || 1), _vy = (unit.y - _oy) / (_d || 1);
        const incid = Math.abs(seg.nx * _vx + seg.ny * _vy);   // 1=정면, 0=완전 비스듬
        const matQuality = strength * distMul * (MAT_INCID_FLOOR + (1 - MAT_INCID_FLOOR) * incid);
        const obs = {
          x1: face.a.x + (face.b.x - face.a.x) * t0, y1: face.a.y + (face.b.y - face.a.y) * t0,
          x2: face.a.x + (face.b.x - face.a.x) * t1, y2: face.a.y + (face.b.y - face.a.y) * t1,
          c1: t0 <= 0.012, c2: t1 >= 0.988, nx: seg.nx, ny: seg.ny, material: seg.material,
          strength, matQuality, cls: seg.cls, blocksSight: seg.blocksSight, ballistic: seg.ballistic,
          wallId: seg.wallId, srcKind: seg.srcKind
        };
        const rw = absorbObservation(S, obs, now, dt);
        if (rw) observedNow.add(rw.name);
      }
    }

    // 4) 반증 → 정리 → 두께 추론 → 섹터
    reconcileMemory(S, unit, rays, now);
    pruneMemory(S, now, tau);
    updateThicknessEstimates(S, now, tau);
    mergeThresholds(S, unit, findBeliefThresholds(S, unit, now, tau), now);
    updateUnknownStates(S, unit, segs, fov, maxD, now, S.thresholds, TH_STALE_TTL);
    analyzeSector(S, unit, segs, fov, maxD, now, tau);

    S.prevPos = { x: unit.x, y: unit.y };
    S.lastSenseAt = now;
    return S;
  }

  // 유닛의 공간 인지 스냅샷 — 진단/AAR/디버그용. 전투 계산은 이걸 읽지 않는다.
  function getSnapshotFor(unit) {
    const S = ensureSpatial(unit);
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    const tau = tauFor(unit);
    return {
      version: VERSION, timestamp: +now.toFixed(4), observerId: unit.id,
      rememberedSurfaces: S.surfaces.map(w => {
        const c = confidenceAt(w, now, tau);
        return {
          id: w.name,
          start: { x: w.ox + w.ux * w.tMin, y: w.oy + w.uy * w.tMin },
          end: { x: w.ox + w.ux * w.tMax, y: w.oy + w.uy * w.tMax },
          normal: { x: w.nx, y: w.ny },
          materialGuess: believedMaterial(w),
          materialKnown: materialKnownLevel(w),        // 'unknown' | 'class' | 'exact'
          materialEvidence: +(w.materialEvidence || 0).toFixed(3),
          surfaceClass: w.cls || 'wall',
          blocksSight: w.blocksSight !== false, ballisticBlock: w.ballistic != null ? w.ballistic : 1,
          geometryConfidence: +c.toFixed(3), memoryState: memoryState(c),
          thicknessEstimate: w.thickness != null ? +w.thickness.toFixed(1) : null,
          thicknessSource: w.thicknessFrom || null,
          ballisticResistance: ballisticResistanceEstimate(w),
          minCornerConfirmed: !!w.minCorner, maxCornerConfirmed: !!w.maxCorner,
          observations: w.observations || 0,
          trueIdCount: w.trueIds ? w.trueIds.size : 0,
          firstObservedAt: w.firstSeen, lastObservedAt: w.lastSeen
        };
      }),
      sector: { sightClosed: !!S.sector.sightClosed, solidClosed: !!S.sector.solidClosed, openingCount: S.sector.openings.length },
      unknownAreas: S.unknowns.map(u => ({
        id: u.name, center: { x: u.ix, y: u.iy }, beyond: { x: u.ax, y: u.ay },
        gateA: u.gateA, gateB: u.gateB, width: u.width, direction: u.mid, state: u.state,
        firstObservedAt: u.firstSeen, lastObservedAt: u.lastSeen
      })),
      stats: Object.assign({}, S.stats)
    };
  }

  // =========================================================
  // 자체 검증 — 프로토타입 0.8.0의 15종 중 14종.
  //   '첫 관측은 아직 미식별'은 개체 식별 계층 테스트라 이번 이식 범위 밖이므로 뺐다.
  // =========================================================
  function runSelfTests() {
    const tests = [];
    const test = (name, fn) => { try { tests.push({ name, ok: !!fn() }); } catch (e) { tests.push({ name, ok: false, error: String(e) }); } };

    test('구간 병합', () => JSON.stringify(mergeIntervals([[0, .2], [.19, .4], [.7, .8]])) === JSON.stringify([[0, .4], [.7, .8]]));
    test('관측·가시 구간 교집합', () => {
      const r = intersectIntervals([[.1, .4]], [[.25, .8]]);
      return r.length === 1 && Math.abs(r[0][0] - .25) < 1e-6 && Math.abs(r[0][1] - .4) < 1e-6;
    });
    test('개구부 실제 횡단', () => crossesGate({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 }));
    test('회전만으로 횡단 안 함', () => !crossesGate({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 }));
    test('긴 면은 샘플 증가', () => visibilitySampleCount({ a: { x: 0, y: 0 }, b: { x: 500, y: 0 } }) > visibilitySampleCount({ a: { x: 0, y: 0 }, b: { x: 50, y: 0 } }));
    test('기억 상태 단계', () => {
      const w = { lastSeen: 0, evidence: 1 };
      const c0 = confidenceAt(w, 0, 10), c1 = confidenceAt(w, 12, 10), c2 = confidenceAt(w, 40, 10);
      return c0 >= MEMORY_CONFIRMED && c1 < MEMORY_CONFIRMED && c1 >= MEMORY_UNCERTAIN && c2 < MEMORY_UNCERTAIN;
    });
    test('가까운 다른 방향 개구부 분리', () => {
      const u = { ix: 0, iy: 0, mid: 0, width: 40, gateAngle: Math.PI / 2 };
      const same = { ix: 8, iy: 5, mid: .04, gateA: { x: 8, y: -20 }, gateB: { x: 8, y: 20 } };
      const other = { ix: 8, iy: 5, mid: Math.PI / 2, gateA: { x: -12, y: 5 }, gateB: { x: 28, y: 5 } };
      return openingMatchScore(u, same) < openingMatchScore(u, other);
    });
    test('반높이 엄폐는 광선을 멈추지 않음', () => {
      const segs = [{ x1: 100, y1: -50, x2: 100, y2: 50, blocksSight: false, cls: 'cover' },
                    { x1: 200, y1: -50, x2: 200, y2: 50, blocksSight: true, cls: 'wall' }];
      const r = rayScan(0, 0, 0, 400, segs);
      return Math.abs(r.sightDist - 200) < 1 && r.hits.length === 2;
    });
    test('전신 벽은 광선을 멈춤', () => {
      const segs = [{ x1: 100, y1: -50, x2: 100, y2: 50, blocksSight: true, cls: 'wall' },
                    { x1: 200, y1: -50, x2: 200, y2: 50, blocksSight: true, cls: 'wall' }];
      const r = rayScan(0, 0, 0, 400, segs);
      return Math.abs(r.sightDist - 100) < 1 && r.hits.length === 1;
    });
    test('넘겨보는 표면도 탐지는 됨', () => rayScan(0, 0, 0, 400, [{ x1: 100, y1: -50, x2: 100, y2: 50, blocksSight: false, cls: 'cover' }]).hits.length === 1);
    test('시야 차단은 등급 full, 넘겨봄은 아님', () =>
      SURFACE_CLASS.wall.sight === true && SURFACE_CLASS.cover.sight === false &&
      SURFACE_CLASS.cover.movement === true && SURFACE_CLASS.rail.ballistic === 0);
    // 아래 두 테스트는 재질을 정확히 아는 면을 가정한다 —
    // ballisticResistanceEstimate는 실제 재질이 아니라 믿는 재질을 읽기 때문이다.
    const _knownMat = (mat, extra) => {
      const w = Object.assign({ material: mat, materialEvidence: MAT_EV_EXACT + 0.01, ballistic: 1 }, extra || {});
      updateBelievedMaterial(w);
      return w;
    };
    test('두께 확인 시 관통 저항 상승', () => {
      const unknown = ballisticResistanceEstimate(_knownMat('concrete', { thickness: null }));
      const known = ballisticResistanceEstimate(_knownMat('concrete', { thickness: THICK_REF * 1.5 }));
      return unknown.thicknessKnown === false && known.thicknessKnown === true && known.value > unknown.value;
    });
    test('재질이 무를수록 저항 낮음', () =>
      ballisticResistanceEstimate(_knownMat('wood', { thickness: THICK_REF })).value <
      ballisticResistanceEstimate(_knownMat('concrete', { thickness: THICK_REF })).value);
    test('재질표는 본편 MATERIAL_ARMOR_PER_M을 따른다', () =>
      materialResist('steel') > materialResist('concrete') &&
      materialResist('concrete') > materialResist('wood') &&
      materialResist('wood') > materialResist('drywall'));
    test('재질 등급 분류', () =>
      materialClassOf('steel') === 'hard' && materialClassOf('concrete') === 'hard' &&
      materialClassOf('thin_metal') === 'medium' &&
      materialClassOf('wood') === 'soft' && materialClassOf('drywall') === 'soft' &&
      materialClassOf('glass') === 'soft');
    test('증거 부족이면 보수적으로 hard로 단정', () => {
      const w = { material: 'drywall', materialEvidence: 0 };
      updateBelievedMaterial(w);
      return materialKnownLevel(w) === 'unknown' && believedMaterial(w) === 'concrete';
    });
    test('겉보기 닮은 것만 오인 — 석고보드를 콘크리트로', () => {
      const w = { material: 'drywall', materialEvidence: MAT_EV_CLASS + 0.01 };
      updateBelievedMaterial(w);
      return materialKnownLevel(w) === 'class' && believedMaterial(w) === 'concrete' &&
             believedMaterial(w) !== w.material;
    });
    test('겉보기로 구분되는 재질은 오인하지 않는다', () => {
      for (const m of ['steel', 'glass', 'thin_metal']) {
        const w = { material: m, materialEvidence: MAT_EV_CLASS + 0.01 };
        updateBelievedMaterial(w);
        if (believedMaterial(w) !== m) return false;
      }
      return true;
    });
    test('혼동군은 서로 닮은 재질끼리만 묶인다', () =>
      lookalikeGroupOf('concrete').indexOf('drywall') >= 0 &&
      lookalikeGroupOf('steel') === null &&
      lookalikeGroupOf('glass') === null);
    test('재질 식별은 멀수록 어렵다', () => {
      const near = clamp01v((MAT_DIST_FAR - MAT_DIST_NEAR * 0.5) / (MAT_DIST_FAR - MAT_DIST_NEAR));
      const far = clamp01v((MAT_DIST_FAR - MAT_DIST_FAR * 1.2) / (MAT_DIST_FAR - MAT_DIST_NEAR));
      return near === 1 && far === 0 && MAT_DIST_FAR > MAT_DIST_NEAR;
    });
    test('비스듬히 봐도 완전히 못 읽지는 않는다', () => MAT_INCID_FLOOR > 0 && MAT_INCID_FLOOR < 1);
    test('증거가 쌓이면 정확한 재질로 수렴', () => {
      const w = { material: 'steel', materialEvidence: MAT_EV_EXACT + 0.01 };
      updateBelievedMaterial(w);
      return materialKnownLevel(w) === 'exact' && believedMaterial(w) === 'steel';
    });
    test('믿는 재질이 관통저항 추정을 좌우한다', () => {
      // 석고보드를 콘크리트로 믿는 동안은 방호력을 과대평가한다 →
      // 사실은 쉽게 뚫리는 격벽인데 뚫을 생각을 못 한다. 가까이 가서 봐야 알아본다.
      const wWrong = { material: 'drywall', materialEvidence: MAT_EV_CLASS + 0.01, ballistic: 1, thickness: THICK_REF };
      const wRight = { material: 'drywall', materialEvidence: MAT_EV_EXACT + 0.01, ballistic: 1, thickness: THICK_REF };
      updateBelievedMaterial(wWrong); updateBelievedMaterial(wRight);
      return believedMaterial(wWrong) === 'concrete' && believedMaterial(wRight) === 'drywall' &&
             ballisticResistanceEstimate(wWrong).value > ballisticResistanceEstimate(wRight).value;
    });
    test('단계가 그대로면 확정값을 다시 뽑지 않는다', () => {
      const w = { material: 'steel', materialEvidence: MAT_EV_EXACT + 0.01 };
      updateBelievedMaterial(w);
      w.believedMaterialId = '__sentinel__';       // 흔들림 방지 확인용
      updateBelievedMaterial(w);
      return w.believedMaterialId === '__sentinel__';
    });
    test('믿는 몸통은 면에서 법선 반대쪽으로 두께만큼 뻗는다', () => {
      const w = { ox: 0, oy: 0, ux: 1, uy: 0, nx: 0, ny: -1, tMin: 0, tMax: 100, thickness: 20 };
      const b = believedBodyOf(w);
      // 법선이 -y니 몸통은 +y 쪽으로 20만큼
      return Math.abs(b.x - 0) < 1e-6 && Math.abs(b.w - 100) < 1e-6 &&
             Math.abs(b.y - 0) < 1e-6 && Math.abs(b.h - 20) < 1e-6;
    });
    test('두께 미상이면 기본 깊이를 가정한다', () => {
      const w = { ox: 0, oy: 0, ux: 1, uy: 0, nx: 0, ny: -1, tMin: 0, tMax: 100, thickness: null };
      return Math.abs(believedBodyOf(w).h - MIRROR_DEFAULT_DEPTH) < 1e-6;
    });
    test('파생 면은 정답 객체 없이도 슬롯 후보가 된다', () => {
      // _c1SurfaceUsable이 believed 면을 object_gone/stale_revision으로 떨구면
      // 정본 엄폐 경로가 통째로 무력화된다 — 그 회귀를 막는 테스트다.
      const sm = { surfaceId: 'M-99', objectId: 'M-99', objectKind: 'cover', believed: true,
                   blocksBullets: true, confidence: 0.9, invalidCount: 0,
                   observedRanges: [{ s0: 0, s1: 50, confidence: 0.9 }],
                   believedBody: { x: 0, y: 0, w: 50, h: 10 } };
      return typeof _c1SurfaceUsable === 'function' && _c1SurfaceUsable(sm).ok === true;
    });
    test('안 본 공간은 뚫려 있다고 본다 (freespace)', () => {
      const probe = { id: '__sp_free__', x: 0, y: 0, facing: 0, aiMemory: { observedSurfaces: new Map() } };
      const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
      const cx2 = M ? M.w / 2 : 500, cy2 = M ? M.h / 2 : 500;
      return believedCellWalkable(probe, cx2, cy2, 0) === true;
    });
    test('기억하는 몸통은 통행 불가', () => {
      const probe = { id: '__sp_blk__', x: 0, y: 0, facing: 0, aiMemory: { observedSurfaces: new Map() } };
      const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
      const cx2 = M ? M.w / 2 : 500, cy2 = M ? M.h / 2 : 500;
      probe.aiMemory.observedSurfaces.set('M-1', { believedBody: { x: cx2 - 20, y: cy2 - 20, w: 40, h: 40 } });
      return believedCellWalkable(probe, cx2, cy2, 0) === false &&
             believedWalkClear(probe, cx2 - 100, cy2, cx2 + 100, cy2, 0) === false;
    });
    test('맵 밖으로는 계획하지 않는다', () => {
      const probe = { id: '__sp_out__', x: 0, y: 0, facing: 0, aiMemory: { observedSurfaces: new Map() } };
      return believedCellWalkable(probe, -50, -50, 0) === false;
    });
    test('접촉이 믿음에 표면을 남긴다', () => {
      const probe = { id: '__sp_contact__', x: 0, y: 0, facing: 0, aiMemory: null };
      const S0 = ensureSpatial(probe);
      const before = S0.surfaces.length;
      recordContact(probe, 100, 100, 1, 0);
      return S0.surfaces.length === before + 1 && S0.stats.contacts === 1;
    });
    test('접촉은 재질 증거를 주지 않는다', () => {
      const probe = { id: '__sp_contact2__', x: 0, y: 0, facing: 0, aiMemory: null };
      const S0 = ensureSpatial(probe);
      const w = recordContact(probe, 200, 200, 0, 1);
      // 만져봤을 뿐이므로 재질은 여전히 미상 — 최악 가정에 머문다
      return !!w && materialKnownLevel(w) === 'unknown';
    });
    test('출력 스냅샷 JSON 안전', () => {
      const probe = { id: '__sp_selftest__', x: 0, y: 0, facing: 0, aiMemory: null };
      const s = getSnapshotFor(probe);
      JSON.stringify(s);
      return Array.isArray(s.rememberedSurfaces) && s.version === VERSION;
    });


    // ---- 문턱 / 방 ----
    //   합성 표면으로 벽선을 만든다. y=400 위, 법선 (0,-1), 접선 (1,0).
    const _mkSurf = (name, x0, x1, opts) => Object.assign({
      name, ox: x0, oy: 400, ux: 1, uy: 0, nx: 0, ny: -1,
      tMin: 0, tMax: x1 - x0, minCorner: true, maxCorner: true,
      blocksSight: true, srcKind: 'wall', cls: 'wall', ballistic: 1,
      material: 'concrete', lastSeen: 0, firstSeen: 0, evidence: 1, observations: 5
    }, opts || {});
    const _thProbe = (surfaces) => {
      const probe = { id: '__sp_th__', x: 250, y: 300, facing: Math.PI / 2, aiMemory: null };
      const S = ensureSpatial(probe);
      S.surfaces = surfaces; S.thresholds = []; S.thSeq = 0; S.unknowns = [];
      return { probe, S };
    };
    test('문턱 — 같은 벽선의 문 너비 간극만 잡는다', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 270, 400)]);
      const th = findBeliefThresholds(S, probe, 0, 20);
      return th.length === 1 && Math.abs(th[0].ix - 235) < 1 && Math.abs(th[0].width - 70) < 1;
    });
    test('문턱 — 너무 넓은 간극은 문이 아니다', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 500, 700)]);
      return findBeliefThresholds(S, probe, 0, 20).length === 0;
    });
    test('문턱 — 반대쪽 면끼리는 벽선으로 묶이지 않는다', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 270, 400, { nx: 0, ny: 1 })]);
      return findBeliefThresholds(S, probe, 0, 20).length === 0;
    });
    test('문턱 — 양쪽 모서리가 확정돼야 confirmed', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200, { minCorner: false, maxCorner: false }),
                                     _mkSurf('W2', 270, 400)]);
      const th = findBeliefThresholds(S, probe, 0, 20);
      return th.length === 1 && th[0].confirmed === false;
    });
    test('문턱 — 간극 안에 믿는 문짝이 있으면 확정 문턱', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 270, 400),
                                     _mkSurf('D1', 225, 245, { srcKind: 'door' })]);
      const th = findBeliefThresholds(S, probe, 0, 20);
      return th.length === 1 && th[0].doorBacked === true;
    });
    test('문턱 — 관측자가 움직여도 같은 문턱으로 합쳐진다', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 270, 400)]);
      mergeThresholds(S, probe, findBeliefThresholds(S, probe, 0, 20), 0);
      probe.x = 400; probe.y = 250;                       // 다른 자리에서 다시 본다
      mergeThresholds(S, probe, findBeliefThresholds(S, probe, 1, 20), 1);
      return S.thresholds.length === 1 && S.thresholds[0].observations === 2;
    });
    test('문턱 — 프론티어 목록과 섞이지 않는다', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 270, 400)]);
      mergeThresholds(S, probe, findBeliefThresholds(S, probe, 0, 20), 0);
      for (const t of S.thresholds) if (S.unknowns.indexOf(t) >= 0) return false;
      return S.thresholds.length > 0 && S.unknowns.length === 0;
    });
    test('소음 — 가려 있으면 문턱, 트여 있으면 같은 방', () => {
      const { probe, S } = _thProbe([_mkSurf('W1', 100, 200), _mkSurf('W2', 270, 400)]);
      mergeThresholds(S, probe, findBeliefThresholds(S, probe, 0, 20), 0);
      // 관측자는 y=300(벽 위쪽). 벽에 가린 y=500 소리는 문턱으로 귀속돼야 한다.
      const far = thresholdForNoise(probe, 150, 500);
      // 같은 쪽(y=250)의 소리는 가리는 게 없으니 같은 방
      const near = thresholdForNoise(probe, 300, 250);
      return far.sameRoom === false && !!far.threshold && near.sameRoom === true;
    });
    test('방 — 상태는 역행하지 않는다 (named → entered → cleared)', () => {
      const probe = { id: '__sp_room__', team: 'enemy', x: 0, y: 0, aiMemory: null };
      const room = { id: '__r1__', name: '시험실' };
      markRoomKnown(probe, room, 'entered', 0);
      markRoomKnown(probe, room, 'named', 1);            // 역행 시도 — 무시돼야 한다
      const kr = probe.aiMemory.knownRooms.get('__r1__');
      if (kr.state !== 'entered') return false;
      markRoomKnown(probe, room, 'cleared', 2);
      return kr.state === 'cleared' && kr.clearedAt === 2 && kr.name === '시험실';
    });

    test('장벽 — 본 적 있는 면의 믿는 재질을 돌려준다', () => {
      const probe = { id: '__sp_bar__', x: 250, y: 300, facing: Math.PI / 2, aiMemory: null };
      const S = ensureSpatial(probe);
      S.surfaces = [_mkSurf('B1', 100, 400, { material: 'drywall', materialEvidence: 0, thickness: null })];
      updateBelievedMaterial(S.surfaces[0]);
      const b = believedBarrierAt(probe, 250, 400);
      // 증거가 없으면 보수적으로 콘크리트라고 단정한다(기존 규약)
      return !!b && b.materialKnown === 'unknown' && b.material === 'concrete' && b.thickness === null;
    });
    test('장벽 — 못 본 자리는 null (소비자가 보수적으로 처리한다)', () => {
      const probe = { id: '__sp_bar2__', x: 250, y: 300, facing: Math.PI / 2, aiMemory: null };
      const S = ensureSpatial(probe);
      S.surfaces = [_mkSurf('B1', 100, 400)];
      return believedBarrierAt(probe, 250, 900) === null;
    });
    test('장벽 — 재질을 정확히 알면 그 재질을 돌려준다', () => {
      const probe = { id: '__sp_bar3__', x: 250, y: 300, facing: Math.PI / 2, aiMemory: null };
      const S = ensureSpatial(probe);
      const w = _mkSurf('B1', 100, 400, { material: 'wood', materialEvidence: MAT_EV_EXACT + 0.01, thickness: 10 });
      updateBelievedMaterial(w);
      S.surfaces = [w];
      const b = believedBarrierAt(probe, 250, 400);
      return !!b && b.material === 'wood' && b.materialKnown === 'exact' && b.thickness === 10;
    });

    // 경로 소비는 기본 OFF다(맵에 우회로가 없어 값을 못 한다) — 테스트는 켜고 잰다.
    const _withDanger = (fn) => {
      const prev = GAME.dangerPathOn;
      try { GAME.dangerPathOn = true; return fn(); } finally { GAME.dangerPathOn = prev; }
    };
    test('위험 섹터 — 위험은 기억에서만 나온다', () => _withDanger(() => {
      if (typeof buildDangerField !== 'function') return false;
      const bare = { id: '__dg0__', aiMemory: null };
      if (buildDangerField(bare) !== null) return false;             // 기억 없음 → 위험장 없음
      const u = { id: '__dg1__', aiMemory: null };
      const rm = MAP_DATA.rooms && MAP_DATA.rooms[0];
      if (!rm) return true;                                          // 방 없는 맵은 해당 없음
      markRoomDanger(u, rm, 10, GAME.gameTime || 0);
      const f = buildDangerField(u);
      return !!f && f.rooms.get(rm.id) > 0;
    }));
    test('위험 섹터 — 방 안은 균일하고 벽 너머 다른 방은 0', () => _withDanger(() => {
      const rooms = MAP_DATA.rooms || [];
      if (rooms.length < 2) return true;
      const a = rooms[0], b2 = rooms.find(r => r.id !== a.id);
      const u = { id: '__dg2__', aiMemory: null };
      markRoomDanger(u, a, 10, GAME.gameTime || 0);
      const f = buildDangerField(u);
      const p1 = dangerCostAt(f, a.x + 20, a.y + 20);
      const p2 = dangerCostAt(f, a.x + a.w - 20, a.y + a.h - 20);   // 같은 방 반대쪽 끝
      const p3 = dangerCostAt(f, b2.x + 20, b2.y + 20);             // 다른 방
      return p1 > 0 && Math.abs(p1 - p2) < 1e-6 && p3 === 0;
    }));
    test('위험 섹터 — 폭발은 국소로 남는다 (방보다 작다)', () => _withDanger(() => {
      const u = { id: '__dg3__', aiMemory: { dangerPoints: [
        { x: 700, y: 700, type: 'explosion', time: (GAME.gameTime || 0) }] } };
      const f = buildDangerField(u);
      if (!f || !f.local.length) return false;
      const mid = dangerCostAt(f, 700, 700), out = dangerCostAt(f, 700 + DANGER_R_BLAST + 20, 700);
      return mid > 0 && out === 0;
    }));
    test('위험 섹터 — 문턱 너머 방의 위험을 읽는다 (행동이 쓰는 값)', () => {
      const rooms = MAP_DATA.rooms || [];
      if (rooms.length < 1) return true;
      const a = rooms[0];
      const u = { id: '__dg5__', aiMemory: null };
      const th = { ax: a.x + a.w / 2, ay: a.y + a.h / 2 };
      if (beyondRoomDanger(u, th) !== 0) return false;              // 아직 아무것도 모른다
      markRoomDanger(u, a, 10, GAME.gameTime || 0);
      return beyondRoomDanger(u, th) > 0;
    });
    test('위험 섹터 — 겹쳐도 상한을 넘지 않는다', () => {
      const f = { rooms: new Map(), local: [] };
      for (let i = 0; i < 8; i++) f.local.push({ x: 500, y: 500, r: 100, w: 10 });
      return dangerCostAt(f, 500, 500) === DANGER_COST_CAP;
    });
    test('위험 섹터 — 선분 위험은 평균이라 길이에 비례하지 않는다', () => {
      const f = { rooms: new Map(), local: [{ x: 500, y: 500, r: 100, w: 10 }] };
      const short = segmentDangerCost(f, 450, 500, 550, 500);
      const long = segmentDangerCost(f, 100, 500, 900, 500);   // 같은 구역을 지나지만 훨씬 김
      return short > long && long > 0;
    });
    test('위험 섹터 — 스위치를 끄면 위험장이 없다', () => {
      const u = { id: '__dg4__', aiMemory: null };
      const rm = MAP_DATA.rooms && MAP_DATA.rooms[0];
      if (!rm) return true;
      markRoomDanger(u, rm, 10, GAME.gameTime || 0);
      const prev = GAME.dangerPathOn;
      try { GAME.dangerPathOn = false; return buildDangerField(u) === null; }
      finally { GAME.dangerPathOn = prev; }
    });

    test('유틸리티 — 동전던지기로는 하던 일을 안 바꾼다', () => {
      if (typeof _stickyPick !== 'function') return false;
      const prof = { scoreNoise: 5 };
      const now = 100;
      const u = { id: '__sk1__', _prevActionType: 'holdAngle', _prevActionEndedAt: now - 0.2, aiUtilityDebug: { reason: '' } };
      const cands = [{ type: 'guardEntry', score: 42 }, { type: 'holdAngle', score: 39 }];
      // 차이 3 < 노이즈 5 → 하던 걸 유지
      if (_stickyPick(u, cands[0], cands, prof, now).type !== 'holdAngle') return false;
      // 차이 9 ≥ 노이즈 5 → 갈아탄다
      const cands2 = [{ type: 'guardEntry', score: 48 }, { type: 'holdAngle', score: 39 }];
      if (_stickyPick(u, cands2[0], cands2, prof, now).type !== 'guardEntry') return false;
      // 창을 벗어나면 유지하지 않는다
      const u2 = { id: '__sk2__', _prevActionType: 'holdAngle', _prevActionEndedAt: now - 99, aiUtilityDebug: { reason: '' } };
      return _stickyPick(u2, cands[0], cands, prof, now).type === 'guardEntry';
    });
    test('유틸리티 — 스위치를 끄면 언제나 1위를 고른다', () => {
      const prof = { scoreNoise: 5 };
      const u = { id: '__sk3__', _prevActionType: 'holdAngle', _prevActionEndedAt: 100, aiUtilityDebug: { reason: '' } };
      const cands = [{ type: 'guardEntry', score: 42 }, { type: 'holdAngle', score: 39 }];
      const prev = GAME.utilityStickyOn;
      try { GAME.utilityStickyOn = false; return _stickyPick(u, cands[0], cands, prof, 100).type === 'guardEntry'; }
      finally { GAME.utilityStickyOn = prev; }
    });

    test('방 — 스위치와 팀 게이트가 행동 후보를 좌우한다', () => {
      if (typeof beliefRoomsActiveFor !== 'function') return false;
      const en = { team: 'enemy' }, fr = { team: 'friend' };
      const prev = (typeof GAME !== 'undefined') ? GAME.beliefRoomsOn : undefined;
      try {
        GAME.beliefRoomsOn = false;
        if (beliefRoomsActiveFor(en)) return false;      // 꺼면 적에게도 안 붙는다
        GAME.beliefRoomsOn = true;
        if (beliefRoomsActiveFor(fr)) return false;      // 이번 단계는 아군 제외
        return beliefRoomsActiveFor(en) === true;
      } finally { GAME.beliefRoomsOn = prev; }
    });

    // ---- 수류탄 소유 인식 ----
    //   원칙: "누가 던졌나"는 놀람을 줄이고, "실제로 날 죽일 수 있나"는 여전히 도망시킨다.
    const _nade = () => THROWABLE_PRESETS.grenade_m67;
    const _mkThrow = (throwerId, team, lx, ly) => ({
      id: 'grenade_m67', fuseTimer: 1.0, grenadePhase: 'landed',
      landedX: lx, landedY: ly, curX: lx, curY: ly, targetX: lx, targetY: ly,
      _thrownByUnitId: throwerId, _thrownByTeam: team,
    });
    test('수류탄 — 위해는 거리로 정해진다 (치명 1, 반경 밖 0)', () => {
      const p = _nade();
      const at = (m) => blastHarmAt(p, 0, 0, m * PX_PER_M_FALLBACK, 0).harm;
      return at(1) === 1 && at(3.5) > 0 && at(3.5) < 1 && at(15) < 0.05;
    });
    test('수류탄 — 벽 뒤면 위해가 줄어든다', () => {
      const p = _nade();
      const open = blastHarmAt(p, 0, 0, 3 * PX_PER_M_FALLBACK, 0);
      // LOS 판정을 강제로 막아 같은 거리에서 비교한다
      const _o = window.isLOSBlockedForBlast;
      try {
        window.isLOSBlockedForBlast = () => true;
        const blocked = blastHarmAt(p, 0, 0, 3 * PX_PER_M_FALLBACK, 0);
        return blocked.harm < open.harm && blocked.harm > 0;
      } finally { window.isLOSBlockedForBlast = _o; }
    });
    test('수류탄 — 내가 던진 것은 멀면 위험이 아니다', () => {
      const u = { id: '__gn1__', team: 'friend', x: 0, y: 0, aiAction: null };
      const st = _mkThrow('__gn1__', 'friend', 9 * PX_PER_M_FALLBACK, 0);
      GAME.flyingThrowables = [st];
      const prev = GAME.grenadeOwnerAwareOn;
      try {
        GAME.grenadeOwnerAwareOn = true;
        const th = grenadeThreatToUnit(u, st);
        if (!th || !th.mine || th.surprise !== false) return false;
        return getGrenadeDangerForUnit(u) === false;
      } finally { GAME.grenadeOwnerAwareOn = prev; GAME.flyingThrowables = []; }
    });
    test('수류탄 — 내 발밑으로 튕겨 온 자기 수류탄이면 도망친다', () => {
      const u = { id: '__gn2__', team: 'friend', x: 0, y: 0, aiAction: null };
      const st = _mkThrow('__gn2__', 'friend', 10, 0);       // 0.3m — 발밑
      GAME.flyingThrowables = [st];
      const prev = GAME.grenadeOwnerAwareOn;
      try {
        GAME.grenadeOwnerAwareOn = true;
        const th = grenadeThreatToUnit(u, st);
        return !!th && th.mine && th.harm >= GRENADE_HARM_FLEE && getGrenadeDangerForUnit(u) === true;
      } finally { GAME.grenadeOwnerAwareOn = prev; GAME.flyingThrowables = []; }
    });
    test('수류탄 — 적이 던진 것은 소유 인식과 무관하게 오늘과 같다', () => {
      const u = { id: '__gn3__', team: 'friend', x: 0, y: 0, aiAction: null };
      const st = _mkThrow('__op__', 'enemy', 4 * PX_PER_M_FALLBACK, 0);
      GAME.flyingThrowables = [st];
      const prev = GAME.grenadeOwnerAwareOn;
      try {
        GAME.grenadeOwnerAwareOn = true;  const on  = getGrenadeDangerForUnit(u);
        GAME.grenadeOwnerAwareOn = false; const off = getGrenadeDangerForUnit(u);
        return on === true && off === true;
      } finally { GAME.grenadeOwnerAwareOn = prev; GAME.flyingThrowables = []; }
    });
    test('수류탄 — 스위치를 끄면 자기 수류탄에도 오늘처럼 반응한다', () => {
      const u = { id: '__gn4__', team: 'friend', x: 0, y: 0, aiAction: null };
      const st = _mkThrow('__gn4__', 'friend', 4 * PX_PER_M_FALLBACK, 0);   // 6m 규칙 안, 위해는 낮음
      GAME.flyingThrowables = [st];
      const prev = GAME.grenadeOwnerAwareOn;
      try {
        GAME.grenadeOwnerAwareOn = false; return getGrenadeDangerForUnit(u) === true;
      } finally { GAME.grenadeOwnerAwareOn = prev; GAME.flyingThrowables = []; }
    });
    test('수류탄 — 던지기 안전 게이트: 발밑 투척은 거부한다', () => {
      if (typeof checkThrowSafety !== 'function') return false;
      const u = { id: '__gn5__', team: 'friend', x: 300, y: 300, facing: 0, alive: true };
      const near = checkThrowSafety(u, 'grenade_m67', u.x + 8, u.y);
      return near.safe === false && near.reason === 'self_blast' && near.selfHarm === 1;
    });
    test('수류탄 — 안전 판정은 조준점이 아니라 튕김까지 시뮬한 착탄점에서 나온다', () => {
      // 벽으로 되튕겨 발밑에 떨어지는 투척을 "10m 앞이니 안전"으로 통과시키면 안 된다.
      if (typeof checkThrowSafety !== 'function') return false;
      const u = { id: '__gn6__', team: 'friend', x: 300, y: 300, facing: 0, alive: true };
      const aimX = u.x + 10 * PX_PER_M_FALLBACK;
      const r = checkThrowSafety(u, 'grenade_m67', aimX, u.y);
      const atLanding = blastHarmAt(THROWABLE_PRESETS.grenade_m67, r.landX, r.landY, u.x, u.y).harm;
      const atAim = blastHarmAt(THROWABLE_PRESETS.grenade_m67, aimX, u.y, u.x, u.y).harm;
      // 판정은 착탄점 기준이어야 한다. 되튕긴 경우 조준점 기준과 값이 갈린다.
      if (r.selfHarm !== atLanding) return false;
      const bounced = Math.hypot(r.landX - aimX, r.landY - u.y) > 32;
      return bounced ? (r.safe === false && r.selfHarm > atAim) : (r.safe !== false || r.reason === 'friendly_blast');
    });

    // ---- 피킹 ----
    //   계약은 하나다: 어떻게 끝나든 원위치로 돌아온다.
    const _mkPeeker = (id, x, y) => ({
      id, name: id, team: 'friend', alive: true, isDowned: false, x, y, facing: 0,
      movePath: [], aiMemory: null, hp: 100,
    });
    // 좌표를 맵에 하드코딩하지 않는다 — 맵이 바뀌면 테스트가 지형에 걸린다(이미 두 번 겪었다).
    const _openPair = (() => {
      const probe = _mkPeeker('__pkprobe__', 0, 0);
      for (let y = 60; y < MAP_DATA.h - 60; y += 20) {
        for (let x = 60; x < MAP_DATA.w - 60; x += 20) {
          probe.x = x; probe.y = y;
          const a = validateMoveTarget(probe, x, y, {});
          if (!a || a.valid === false) continue;
          const b2 = validateMoveTarget(probe, x + 30, y, {});
          if (b2 && b2.valid !== false) return { x, y, ex: x + 30, ey: y };
        }
      }
      return null;
    })();
    test('피킹 — 나감 → 관측 → 복귀 순서로 진행한다', () => {
      if (!_openPair) return false;
      const u = _mkPeeker('__pk1__', _openPair.x, _openPair.y);
      if (!setPendingPeek(u, _openPair.ex, _openPair.ey, { watchX: _openPair.ex + 200, watchY: _openPair.ey })) return false;
      if (u.pendingPeek.phase !== 'out') return false;
      u.x = _openPair.ex; u.y = _openPair.ey;        // 노출 지점 도착
      tickPeek(u, 0.1);
      if (u.pendingPeek.phase !== 'look') return false;
      tickPeek(u, u.pendingPeek.lookTime + 0.01);
      if (u.pendingPeek.phase !== 'back') return false;
      u.x = _openPair.x; u.y = _openPair.y;          // 원위치 복귀
      tickPeek(u, 0.1);
      return u.pendingPeek === null && u._lastPeek && u._lastPeek.endReason === 'done';
    });
    test('피킹 — 시간이 초과돼도 복귀 단계로 돌아간다 (버려두지 않는다)', () => {
      if (!_openPair) return false;
      const u = _mkPeeker('__pk2__', _openPair.x, _openPair.y);
      if (!setPendingPeek(u, _openPair.ex, _openPair.ey)) return false;
      u.x = _openPair.x + 15;                        // 나가는 중이었다 (원위치에서 떨어져 있다)
      tickPeek(u, u.pendingPeek.timeout + 0.1);      // 그 상태로 시간 초과
      return !!u.pendingPeek && u.pendingPeek.phase === 'back';
    });
    test('피킹 — 쿨다운이 있으면 다시 고개를 내밀지 않는다', () => {
      if (!_openPair) return false;
      const u = _mkPeeker('__pk3__', _openPair.x, _openPair.y);
      u._peekCooldownUntil = (GAME.gameTime || 0) + 99;
      return setPendingPeek(u, _openPair.ex, _openPair.ey) === false;
    });
    test('피킹 — 이미 하는 중이면 겹쳐 예약하지 않는다', () => {
      if (!_openPair) return false;
      const u = _mkPeeker('__pk4__', _openPair.x, _openPair.y);
      if (!setPendingPeek(u, _openPair.ex, _openPair.ey)) return false;
      return setPendingPeek(u, _openPair.ex + 10, _openPair.ey) === false;
    });
    test('피킹 — 끝나면 관측 이득이 기록된다', () => {
      if (!_openPair) return false;
      const u = _mkPeeker('__pk5__', _openPair.x, _openPair.y);
      if (!setPendingPeek(u, _openPair.ex, _openPair.ey)) return false;
      clearPendingPeek(u, 'test');
      const g = u._lastPeek && u._lastPeek.gain;
      return !!g && typeof g.surfaces === 'number' && typeof g.thresholds === 'number';
    });
    test('피킹 — 스위치를 끄면 후보에 오르지 않는다', () => {
      const u = { team: 'friend' };
      const prev = GAME.peekOn;
      try { GAME.peekOn = false; return peekActiveFor(u) === false; }
      finally { GAME.peekOn = prev; }
    });

    // ---- 섬광 ----
    const _M84 = () => THROWABLE_PRESETS.grenade_m84;
    const _mkSeer = (x, y, facing) => ({ id: '__fl__', name: '__fl__', team: 'enemy', alive: true,
                                         x, y, facing, skill: { presetId: 'regular' } });
    test('섬광 — 그쪽을 보고 있었으면 더 심하다', () => {
      const bx = 500, by = 400;
      const toward = _mkSeer(bx - 64, by, 0);                    // 폭발을 정면으로
      const away = _mkSeer(bx - 64, by, Math.PI);                // 등지고
      const a = flashEffectOn(_M84(), bx, by, toward);
      const b2 = flashEffectOn(_M84(), bx, by, away);
      return !!a && !!b2 && a.blind > b2.blind && b2.blind > 0;  // 등져도 0은 아니다(주변시)
    });
    test('섬광 — 소리는 어디를 보든 똑같이 먹는다', () => {
      const bx = 500, by = 400;
      const a = flashEffectOn(_M84(), bx, by, _mkSeer(bx - 64, by, 0));
      const b2 = flashEffectOn(_M84(), bx, by, _mkSeer(bx - 64, by, Math.PI));
      return !!a && !!b2 && Math.abs(a.deaf - b2.deaf) < 1e-6;
    });
    test('섬광 — 빛은 모퉁이를 안 돌지만 소리는 조금 돈다', () => {
      const _o = window.isLOSBlockedForBlast;
      try {
        window.isLOSBlockedForBlast = () => true;                // 벽 뒤로 강제
        const e = flashEffectOn(_M84(), 500, 400, _mkSeer(436, 400, 0));
        return !!e && e.blind === 0 && e.deaf > 0;
      } finally { window.isLOSBlockedForBlast = _o; }
    });
    test('섬광 — 반경 밖은 아무 일도 없다', () => {
      const r = _M84().flashRadius * PX_PER_M_FALLBACK;
      return flashEffectOn(_M84(), 500, 400, _mkSeer(500 + r + 40, 400, Math.PI)) === null;
    });
    test('섬광 — 눈이 멀면 보이지 않고 조준도 무너진다', () => {
      const prev = GAME.flashbangOn;
      try {
        GAME.flashbangOn = true;
        const viewer = _mkSeer(400, 400, 0); viewer.flashBlindTimer = 2;
        const target = _mkSeer(460, 400, 0); target.id = '__fl2__';
        if (_checkVisibilityBase(viewer, target).reason !== 'flash_blinded') return false;
        const blindAim = computeAimQuality({ aimTimer: 3, flashBlindTimer: 2 });
        const clearAim = computeAimQuality({ aimTimer: 3, flashBlindTimer: 0 });
        return blindAim < clearAim * 0.3;
      } finally { GAME.flashbangOn = prev; }
    });
    test('섬광 — 눈이 멀면 지형 학습이 멈춘다 (믿음이 낡는 이유가 처음으로 남이 된다)', () => {
      const prev = GAME.flashbangOn;
      try {
        GAME.flashbangOn = true;
        const u = { id: '__fl3__', alive: true, isDead: false, isDowned: false, x: 400, y: 400,
                    facing: 0, aiMemory: null, flashBlindTimer: 3 };
        const S = SpatialPerception.ensureSpatial(u);
        //   -900 미만은 "첫 호출"로 간주돼 위상 오프셋으로 리셋된다 — 그 아래로 내리면 안 된다.
        S.lastSenseAt = -500;                                   // 스캔할 때가 한참 지났다
        const before = GAME._flashScanSkipped || 0;
        tickSpatialPerception(u, 0.1);
        return (GAME._flashScanSkipped || 0) === before + 1;
      } finally { GAME.flashbangOn = prev; }
    });
    test('섬광 — 스위치를 끄면 눈멂이 아무 데도 안 걸린다', () => {
      const prev = GAME.flashbangOn;
      try {
        GAME.flashbangOn = false;
        const u = { flashBlindTimer: 5, flashDeafTimer: 5 };
        return isFlashBlinded(u) === false && isFlashDeafened(u) === false;
      } finally { GAME.flashbangOn = prev; }
    });

    // ---- 섬광 사용 (flashThenEnter) ----
    test('표적 신선도 — 위험 기록의 나이를 잰다', () => {
      const u = { id: '__fr8__', aiMemory: null };
      const rm = (MAP_DATA.rooms || [])[0];
      if (!rm) return true;
      const th = { ix: rm.x + 10, iy: rm.y + 10, ax: rm.x + rm.w / 2, ay: rm.y + rm.h / 2 };
      if (beyondRoomDangerAge(u, th) !== Infinity) return false;      // 기록이 없으면 무한
      const now = GAME.gameTime || 0;
      markRoomDanger(u, rm, 10, now - 7);
      const age = beyondRoomDangerAge(u, th);
      return age > 6.5 && age < 7.5;
    });
    test('표적 신선도 — 낡은 근거로는 계획을 세우지 않는다', () => {
      // 실측: 그 방에 적이 있을 확률이 0~2초 97% → 20초+ 28%. 수준만 보면 28%짜리로 던진다.
      const rm = (MAP_DATA.rooms || [])[0];
      if (!rm) return true;
      const u = { id: '__fr9__', name: '__fr9__', team: 'friend', alive: true, isDowned: false,
                  x: rm.x - 40, y: rm.y + 10, facing: 0, aiMemory: null,
                  throwables: { grenade_m84: 1 } };
      const th = { ix: rm.x + 10, iy: rm.y + 10, ax: rm.x + rm.w / 2, ay: rm.y + rm.h / 2 };
      const now = GAME.gameTime || 0;
      markRoomDanger(u, rm, 12, now - (FRAG_PLAN_FRESH + 5));
      const stale = beyondRoomDangerAge(u, th) > FRAG_PLAN_FRESH;
      markRoomDanger(u, rm, 12, now);
      const fresh = beyondRoomDangerAge(u, th) <= FRAG_PLAN_FRESH;
      return stale && fresh;
    });
    test('섬광 사용 — 들어갈 방에는 섬광이 먼저다', () => {
      const u = { throwables: { grenade_m67: 1, grenade_m84: 1 } };
      if (fragThrowableIdFor(u, 'flash') !== 'grenade_m84') return false;
      if (fragThrowableIdFor(u, 'frag') !== 'grenade_m67') return false;
      const noStun = { throwables: { grenade_m67: 1 } };
      return fragThrowableIdFor(noStun, 'flash') === null;    // 없으면 프래그로 떨어진다
    });
    test('섬광 사용 — 안전 게이트가 폭압이 아니라 실명을 본다', () => {
      const prev = GAME.flashbangOn;
      try {
        GAME.flashbangOn = true;
        // 발밑 섬광 — 폭압 위해는 0이지만 실명은 최대다. 예전엔 이걸 "안전"이라 답했다.
        const u = { id: '__fz__', team: 'friend', alive: true, x: 300, y: 300, facing: 0 };
        const r = checkThrowSafety(u, 'grenade_m84', u.x + 8, u.y);
        if (blastHarmAt(THROWABLE_PRESETS.grenade_m84, u.x + 8, u.y, u.x, u.y).harm !== 0) return true;
        return r.safe === false && r.reason === 'self_flash';
      } finally { GAME.flashbangOn = prev; }
    });
    test('섬광 사용 — 아군을 눈멀게 하는 투척은 거부한다', () => {
      const prev = GAME.flashbangOn;
      const saved = window.UNITS;
      try {
        GAME.flashbangOn = true;
        const me = { id: '__fz2__', team: 'friend', alive: true, x: 300, y: 300, facing: 0 };
        // 아군이 착탄점 바로 옆에 있고 그쪽을 보고 있다
        const mate = { id: '__fz3__', name: 'mate', team: 'friend', alive: true,
                       x: 300 + 6 * PX_PER_M_FALLBACK, y: 300, facing: 0,
                       skill: { presetId: 'regular' } };
        const aimX = 300 + 6 * PX_PER_M_FALLBACK, aimY = 300;
        const e = flashEffectOn(THROWABLE_PRESETS.grenade_m84, aimX, aimY, mate);
        if (!e || e.blind <= THROW_MATE_BLIND_MAX) return true;   // 전제가 안 맞으면 무의미
        const solo = checkThrowSafety(me, 'grenade_m84', aimX, aimY);
        return solo.safe === false ? true : (solo.mateName === null);
      } finally { GAME.flashbangOn = prev; window.UNITS = saved; }
    });
    test('섬광 사용 — 프래그는 짬을 두고 섬광은 즉시 들어간다', () => {
      // 눈먼 창이 짧으니 기다리면 그 창이 닫힌다 — 두 물건의 쓰임새 차이 전부다.
      const mk = (kind) => ({ id: '__fe' + kind, name: 'x', alive: true, isDowned: false,
                              x: 0, y: 0, pendingFrag: { kind, phase: 'enter', t: 1, phaseT: 0,
                                enterT: 0, enterX: 0, enterY: 0, threw: true, budget: 99 } });
      const flash = mk('flash'), frag = mk('frag');
      tickFragPlan(flash, 0.1);        // 즉시 도착 판정(거리 0) → 완료
      tickFragPlan(frag, 0.1);         // 짬이 안 끝나 아직 진행 중
      return flash.pendingFrag === null && frag.pendingFrag !== null;
    });

    // ---- 동료 엄호 ----
    const _withSupport = (on, fn) => {
      const prev = GAME.supportOn;
      try { GAME.supportOn = on; return fn(); } finally { GAME.supportOn = prev; }
    };
    const _mkMate = (id, x, y, act, claim) => ({
      id, name: id, team: 'friend', alive: true, isDowned: false, x, y,
      aiAction: act ? { type: act } : null, _claim: claim || null,
    });
    test('엄호 — 미는 동료와 그가 맡은 대상이 있어야 성립한다', () => _withSupport(true, () => {
      const me = _mkMate('__sp0__', 100, 100, null, null);
      const pusher = _mkMate('__sp1__', 200, 100, 'clearUnknownRoom', { x: 400, y: 100 });
      const idler = _mkMate('__sp2__', 150, 100, 'holdAngle', { x: 400, y: 100 });
      const c1 = {}; prepSupportContext(me, c1, [me, idler]);
      if (c1._supportMate) return false;              // 아무도 안 밀면 엄호할 게 없다
      const c2 = {}; prepSupportContext(me, c2, [me, pusher, idler]);
      return c2._supportMate === pusher && c2._supportAim.x === 400;
    }));
    test('엄호 — 맡은 대상이 없는 동료는 엄호 대상이 아니다', () => _withSupport(true, () => {
      const me = _mkMate('__sp3__', 100, 100, null, null);
      const pusher = _mkMate('__sp4__', 200, 100, 'clearUnknownRoom', null);   // 선점 없음
      const c = {}; prepSupportContext(me, c, [me, pusher]);
      return c._supportMate === null;
    }));
    test('엄호 — 적이나 쓰러진 대원은 엄호하지 않는다', () => _withSupport(true, () => {
      const me = _mkMate('__sp5__', 100, 100, null, null);
      const foe = _mkMate('__sp6__', 200, 100, 'clearUnknownRoom', { x: 400, y: 100 });
      foe.team = 'enemy';
      const down = _mkMate('__sp7__', 210, 100, 'clearUnknownRoom', { x: 400, y: 100 });
      down.isDowned = true;
      const c = {}; prepSupportContext(me, c, [me, foe, down]);
      return c._supportMate === null;
    }));
    test('엄호 — 너무 멀면 엄호가 아니다', () => _withSupport(true, () => {
      const me = _mkMate('__spA__', 100, 100, null, null);
      const far = _mkMate('__spB__', 100 + (SUPPORT_RANGE_M + 3) * PX_PER_M_FALLBACK, 100,
                          'fragThenEnter', { x: 400, y: 100 });
      const c = {}; prepSupportContext(me, c, [me, far]);
      return c._supportMate === null;
    }));
    test('엄호 — 스위치를 끄면 후보 자체가 없다', () => {
      const me = _mkMate('__sp8__', 100, 100, null, null);
      const pusher = _mkMate('__sp9__', 200, 100, 'fragThenEnter', { x: 400, y: 100 });
      return _withSupport(false, () => { const c = {}; prepSupportContext(me, c, [me, pusher]); return c._supportMate === null; })
          && scoreCoverMate({ _supportMate: null }) === 0;
    });

    // ---- 엄호사격 ----
    const _withCoverFire = (on, fn) => {
      const prev = GAME.coverFireOn;
      try { GAME.coverFireOn = on; return fn(); } finally { GAME.coverFireOn = prev; }
    };
    const _mkCoverer = (id, mateId) => ({
      id, name: id, team: 'friend', alive: true, isDowned: false, role: 'rifleman',
      x: 100, y: 100, pinned: false, movePath: [], magAmmo: 30, _coverFireTimer: 0,
      weaponId: 'ar_m4a1',
      aiAction: { type: 'coverMate', targetX: 500, targetY: 100, coverForId: mateId },
    });
    test('엄호사격 — 움직이는 동료만 엄호 대상이다', () => {
      const me = _mkCoverer('__cf0__', '__cf1__');
      const moving = { id: '__cf1__', alive: true, isDowned: false, movePath: [{ x: 400, y: 100 }] };
      const still  = { id: '__cf1__', alive: true, isDowned: false, movePath: [] };
      return coverFireMate(me, [me, moving]) === moving
          && coverFireMate(me, [me, still]) === null;
    });
    test('엄호사격 — 쓰러진 동료는 엄호 대상이 아니다', () => {
      const me = _mkCoverer('__cf2__', '__cf3__');
      const down = { id: '__cf3__', alive: true, isDowned: true, movePath: [{ x: 400, y: 100 }] };
      return coverFireMate(me, [me, down]) === null;
    });
    test('엄호사격 — coverMate가 아니면 쏘지 않는다', () => _withCoverFire(true, () => {
      const me = _mkCoverer('__cf4__', '__cf5__');
      const mate = { id: '__cf5__', alive: true, isDowned: false, movePath: [{ x: 400, y: 100 }] };
      me.aiAction.type = 'holdAngle';
      return tickCoverFire(me, [me, mate]) === false;
    }));
    test('엄호사격 — 탄이 적으면 아껴 둔다', () => _withCoverFire(true, () => {
      const me = _mkCoverer('__cf6__', '__cf7__');
      const mate = { id: '__cf7__', alive: true, isDowned: false, movePath: [{ x: 400, y: 100 }] };
      me.magAmmo = COVERFIRE_AMMO_MIN - 1;
      return tickCoverFire(me, [me, mate]) === false;
    }));
    test('엄호사격 — 스위치를 끄면 아무 일도 안 한다', () => {
      const me = _mkCoverer('__cf8__', '__cf9__');
      const mate = { id: '__cf9__', alive: true, isDowned: false, movePath: [{ x: 400, y: 100 }] };
      return _withCoverFire(false, () => tickCoverFire(me, [me, mate])) === false;
    });
    test('엄호사격 — 누를 대상을 안 믿으면 쏘지 않는다', () => _withCoverFire(true, () => {
      // 동료가 맡은 문을 겨눴을 때 21발 중 진짜 적 근처는 0발이었다. 미확인 방의 문이니 당연하다.
      // 그래서 위협 기억이 없으면 아예 안 쏜다 — 빈 문에 쏘는 건 탄약과 총성만 쓴다.
      const me = _mkCoverer('__cfA__', '__cfB__');
      me.weaponId = Object.keys(WEAPONS)[0];
      me.lastKnownEnemies = null;                      // 아무것도 안 믿는다
      const mate = { id: '__cfB__', alive: true, isDowned: false, movePath: [{ x: 400, y: 100 }] };
      const before = (GAME._coverFireWhy && GAME._coverFireWhy.no_belief) || 0;
      const fired = tickCoverFire(me, [me, mate]);
      const after = (GAME._coverFireWhy && GAME._coverFireWhy.no_belief) || 0;
      return fired === false && after === before + 1;
    }));
    // ---- 연막 ----
    const _dustSandbox = (fn) => {
      const saved = GAME.dustClouds ? GAME.dustClouds.slice() : [];
      if (!GAME.dustClouds) GAME.dustClouds = [];
      GAME.dustClouds.length = 0;
      try { return fn(); } finally { GAME.dustClouds.length = 0; GAME.dustClouds.push(...saved); }
    };
    const _age = (s) => { for (let k = 0; k < Math.round(s / 0.1); k++) updateDustClouds(0.1); };
    const _losAt = (cx, cy, m) => {
      const h = (m / 2) * PX_PER_M_FALLBACK;
      return sampleDustAlongLOS(cx - h, cy, cx + h, cy, {});
    };
    test('연막 — 부산물 먼지는 아무리 겹쳐도 시야를 못 끊는다', () => _dustSandbox(() => {
      // 상한 전에는 탄착 8발(구름 25개)이 실제로 dust_blocked를 냈다. 소총 사격이 우발적 연막이 되면 안 된다.
      for (let i = 0; i < 60; i++) spawnDustCloud({ x: 700, y: 400, density: 0.4, startRadius: 40, maxRadius: 40, life: 5 });
      _age(0.4);
      const s = _losAt(700, 400, 10);
      return s.blocksVision === false && s.peakDensity <= DUST_VISION_CAP + 1e-6;
    }));
    test('연막 — 연막은 상한을 받지 않는다', () => _dustSandbox(() => {
      spawnSmokeCloud(700, 400, {});
      _age(4);
      const q = sampleDustAtPoint(700, 400);
      return q.smokeDensity > DUST_VISION_CAP && q.dustDensity === 0;
    }));
    test('연막 — 던지자마자 벽이 서지는 않는다 (피어오름)', () => _dustSandbox(() => {
      spawnSmokeCloud(700, 400, {});
      _age(0.5);
      const early = _losAt(700, 400, 10);
      _age(3.0);
      const late = _losAt(700, 400, 10);
      return early.blocksVision === false && late.blocksVision === true;
    }));
    test('연막 — 스위치를 끄면 구름이 안 생긴다', () => _dustSandbox(() => {
      const prev = GAME.smokeOn;
      try {
        GAME.smokeOn = false;
        detonateThrowable('grenade_m18', 700, 400, null);
        return GAME.dustClouds.length === 0;
      } finally { GAME.smokeOn = prev; }
    }));
    test('연막 차폐 — 접근 다리 없이 바로 던지기 단계에서 시작한다', () => {
      // 프래그는 approach→look→decide를 거치는데, 그 긴 접근이 이번 세션 내내 계획을 죽였다.
      // 연막은 지금 자리에서 건널 문을 가리므로 갈 곳이 없다.
      const u = { id: '__sc0__', name: 'x', team: 'friend', alive: true, isDowned: false,
                  x: 400, y: 300, throwables: { grenade_m18: 1 } };
      const th = { ix: 400, iy: 200, ax: 400, ay: 150, name: 'TH-01' };
      const ok = setPendingScreen(u, th, {});
      return ok && u.pendingFrag.phase === 'throw' && u.pendingFrag.kind === 'smoke'
          && u.pendingFrag.aimX === 400 && u.pendingFrag.aimY === 200;   // 문턱 자체를 덮는다
    });
    test('연막 차폐 — 계획을 세운 행동이 그 계획의 주인이다', () => {
      // 이걸 인라인 문자열 비교로 두었더니 screenThenCross가 빠져서, 계획이 세워지자마자
      // 다음 평가에서 스스로 지워졌다. 던지고 터지기까지 갔는데 기다리는 구간이 통째로 잘렸다.
      const owners = ['fragThenEnter', 'screenThenCross'];
      const others = ['holdAngle', 'seekCover', 'engageEnemy', 'peekAndAssess', 'coverMate', 'guardEntry'];
      return owners.every(t => actionOwnsFragPlan(t) === true)
          && others.every(t => actionOwnsFragPlan(t) === false);
    });
    test('연막 차폐 — 연막이 없으면 계획이 안 선다', () => {
      const u = { id: '__sc1__', name: 'x', team: 'friend', alive: true, isDowned: false,
                  x: 400, y: 300, throwables: { grenade_m67: 1 } };   // 파편만 있다
      return setPendingScreen(u, { ix: 400, iy: 200, ax: 400, ay: 150 }, {}) === false;
    });
    test('연막 차폐 — 너무 멀거나 발밑이면 안 던진다', () => {
      const mk = () => ({ id: '__sc2__', name: 'x', team: 'friend', alive: true, isDowned: false,
                          x: 400, y: 300, throwables: { grenade_m18: 1 } });
      const far  = setPendingScreen(mk(), { ix: 400, iy: 300 - (SCREEN_MAX_M + 3) * PX_PER_M_FALLBACK, ax: 400, ay: 0 }, {});
      const near = setPendingScreen(mk(), { ix: 400, iy: 300 - 10, ax: 400, ay: 280 }, {});
      return far === false && near === false;
    });
    test('연막 차폐 — 터지는 게 아니라 서는 걸 기다린다', () => _dustSandbox(() => {
      // 구름은 3초에 걸쳐 자란다. 터지자마자 들어가면 아직 아무것도 안 가려져 있다.
      const p = { aimX: 700, aimY: 400, enterX: 700, enterY: 340 };   // 북쪽으로 건넌다
      spawnSmokeCloud(700, 400, {});
      _age(0.3);
      const early = screenIsUp(p);
      _age(3.5);
      return early === false && screenIsUp(p) === true;
    }));
    test('연막 — 경로 비용을 깎기만 한다 (더하지 않는다)', () => _dustSandbox(() => {
      // 연막은 새 위험을 만들지 않는다. 보이지 않으면 못 맞힐 뿐이다.
      const prev = GAME.smokePathOn;
      try {
        GAME.smokePathOn = true;
        const clean = smokeCoverMulAt(700, 400);
        spawnSmokeCloud(700, 400, {});
        _age(4);
        const inside = smokeCoverMulAt(700, 400);
        const edge = smokeCoverMulAt(700 + 4.6 * PX_PER_M_FALLBACK, 400);   // 구름 가장자리
        return clean === 1 && inside <= SMOKE_PATH_MIN_MUL + 1e-6 && inside > 0
            && edge > inside && edge <= 1;
      } finally { GAME.smokePathOn = prev; }
    }));
    test('연막 — 부산물 먼지는 경로를 깎지 않는다', () => _dustSandbox(() => {
      // 가려 주는 건 연막이다. 탄착 먼지로 길이 안전해지면 안 된다.
      for (let i = 0; i < 40; i++) spawnDustCloud({ x: 700, y: 400, density: 0.5, startRadius: 40, maxRadius: 40, life: 5 });
      _age(0.4);
      return smokeCoverMulAt(700, 400) === 1;
    }));
    test('연막 차폐 — 대기 중 물러서기가 취소되지 않는다', () => {
      // 프래그 대기는 이동 명령을 취소한다(문 옆에서 가만히 기다려야 하니까).
      // 연막은 반대로 빠져야 하는데, 그 취소에 걸리면 물러서기가 다음 틱에 지워진다.
      const mk = (kind) => {
        const path = [{ x: 500, y: 300 }];
        const u = { id: '__dk' + kind, name: 'x', alive: true, isDowned: false, x: 400, y: 300,
                    movePath: path, throwState: null,
                    pendingFrag: { kind, phase: 'wait', t: 0, phaseT: 0, waitT: 0, enterT: 0,
                                   threw: true, ducked: true, detonated: true, budget: 99,
                                   aimX: 400, aimY: 200, enterX: 400, enterY: 150,
                                   spot: { x: 400, y: 300 }, spots: [{ x: 400, y: 300 }], spotIdx: 0 } };
        u._aiCommandPath = path;
        return u;
      };
      // completeAICommand는 movePath를 지우지 않고 명령 상태만 정리한다.
      //   그래서 "호출되었는가"를 직접 센다 — 그게 실제 계약이다.
      const orig = completeAICommand;
      const calls = { smoke: 0, frag: 0 };
      try {
        window.completeAICommand = function (u) { if (u && u.__k) calls[u.__k]++; return orig.apply(this, arguments); };
        const smoke = mk('smoke'), frag = mk('frag');
        smoke.__k = 'smoke'; frag.__k = 'frag';
        tickFragPlan(smoke, 0.1);
        tickFragPlan(frag, 0.1);
      } finally { window.completeAICommand = orig; }
      return calls.smoke === 0 && calls.frag === 1;
    });
    test('연막 경보 — 벽 너머 연막은 못 본다 (투시 금지)', () => _dustSandbox(() => {
      const mk = () => {
        const u = { id: '__sa0__', name: 'x', team: 'enemy', alive: true, isDowned: false,
                    x: 400, y: 300, aiMemory: null, _smokeAlertAt: null };
        const S = SpatialPerception.ensureSpatial(u);
        S.thresholds = [{ ix: 400, iy: 200, ax: 400, ay: 150, nx: 0, ny: -1, name: 'TH-01', confirmed: true }];
        return u;
      };
      spawnSmokeCloud(400, 200, {});
      _age(3);
      const before = GAME._smokeAlerts || 0;
      // 벽이 없으면 반응한다
      const seen = mk();
      tickSmokeAlert(seen, 0.6);
      const afterSeen = GAME._smokeAlerts || 0;
      // isLOSBlockedForBlast를 막아 놓으면 반응하지 않는다
      const orig = window.isLOSBlockedForBlast;
      let blockedOk = false;
      try {
        window.isLOSBlockedForBlast = () => true;
        const hidden = mk(); hidden.id = '__sa1__';
        const b2 = GAME._smokeAlerts || 0;
        tickSmokeAlert(hidden, 0.6);
        blockedOk = ((GAME._smokeAlerts || 0) === b2);
      } finally { window.isLOSBlockedForBlast = orig; }
      return afterSeen === before + 1 && blockedOk;
    }));
    test('연막 경보 — 문 너머를 뜨겁다고 믿고 그쪽을 본다', () => _dustSandbox(() => {
      const u = { id: '__sa2__', name: 'x', team: 'enemy', alive: true, isDowned: false,
                  x: 400, y: 300, aiMemory: null, _smokeAlertAt: null };
      const S = SpatialPerception.ensureSpatial(u);
      S.thresholds = [{ ix: 400, iy: 200, ax: 400, ay: 150, nx: 0, ny: -1, name: 'TH-01', confirmed: true }];
      ensureSpatialMemoryFields(ensureAIMemory(u));
      spawnSmokeCloud(400, 200, {});
      _age(3);
      tickSmokeAlert(u, 0.6);
      const ang = u.aiMemory.preferredWatchAngle;
      // 문턱은 북쪽(-y) → 각도는 -π/2 근처
      return ang != null && Math.abs(ang - (-Math.PI / 2)) < 0.01
          && beyondRoomDanger(u, S.thresholds[0]) > 0;
    }));
    test('연막 경보 — 연막이 근거다 (위협 기억을 요구하지 않는다)', () => {
      // 엄호사격은 "누를 대상을 안 믿으면 안 쏜다"가 계약이다. 연막 경보는 그 예외다 —
      // 문 앞에 연막이 피었다는 것 자체가 근거이기 때문이다.
      const now = GAME.gameTime || 0;
      const u = { id: '__sf0__', _smokeAlertAim: { x: 400, y: 200, t: now } };
      const stale = { id: '__sf1__', _smokeAlertAim: { x: 400, y: 200, t: now - SMOKE_ALERT_FIRE_FRESH - 1 } };
      const none = { id: '__sf2__' };
      return !!smokeAlertAimFor(u) && smokeAlertAimFor(stale) === null && smokeAlertAimFor(none) === null;
    });
    test('연막 경보 — 스위치를 끄면 아무 일도 안 한다', () => _dustSandbox(() => {
      const prev = GAME.smokeAlertOn;
      try {
        GAME.smokeAlertOn = false;
        const u = { id: '__sa3__', name: 'x', team: 'enemy', alive: true, isDowned: false,
                    x: 400, y: 300, aiMemory: null, _smokeAlertAt: null };
        const S = SpatialPerception.ensureSpatial(u);
        S.thresholds = [{ ix: 400, iy: 200, ax: 400, ay: 150, nx: 0, ny: -1, name: 'T', confirmed: true }];
        spawnSmokeCloud(400, 200, {}); _age(3);
        const b2 = GAME._smokeAlerts || 0;
        tickSmokeAlert(u, 0.6);
        return (GAME._smokeAlerts || 0) === b2;
      } finally { GAME.smokeAlertOn = prev; }
    }));
    test('연막 — 던지기 안전은 연막에 잴 것이 없다고 명시한다', () => {
      // blastRadius*가 없어서 우연히 0이 나오는 것과, 계약으로 안전인 것은 다르다.
      const u = { id: '__sc3__', name: 'x', team: 'friend', alive: true, isDowned: false,
                  x: 400, y: 300, facing: 0, throwables: { grenade_m18: 1 } };
      const r = checkThrowSafety(u, 'grenade_m18', 430, 300);
      return r.safe === true && r.selfHarm === 0 && r.mateHarm === 0;
    });
    test('연막 — 살상도 섬광도 없다 (선언으로 표현)', () => {
      const p = THROWABLE_PRESETS.grenade_m18;
      return p && p.type === 'smoke'
          && p.blastRadiusLethal == null && p.blastRadiusOuter == null
          && p.flashRadius == null && p.fragmentCount == null;
    });

    // ---- 방어자 둘러보기 ----
    const _withIdleScan = (on, fn) => {
      const prev = GAME.idleScanOn;
      try { GAME.idleScanOn = on; return fn(); } finally { GAME.idleScanOn = prev; }
    };
    const _mkWatcher = (id, facing) => {
      const u = { id, name: id, team: 'enemy', alive: true, isDowned: false,
                  x: 400, y: 300, facing: facing || 0, _idleScan: null };
      const S = SpatialPerception.ensureSpatial(u);
      S.sector = { known: true, sightClosed: false, solidClosed: false, openings: [] };
      return { u, S };
    };
    test('둘러보기 — 시야 밖 프론티어를 먼저 본다', () => {
      // 등 뒤가 안 본 쪽이다. 정면(180° viewArc) 안쪽은 이미 보고 있으니 나중이다.
      const { u, S } = _mkWatcher('__is0__', 0);
      S.sector.openings = [ { ix: 500, iy: 300 },    // 정면 (시야 안)
                            { ix: 300, iy: 300 } ];  // 등 뒤 (시야 밖)
      const r = pickIdleScanAngle(u);
      return r && r.kind === 'scanRoom' && Math.abs(Math.abs(r.ang) - Math.PI) < 0.01;
    });
    test('둘러보기 — 도착 전에는 목표를 안 바꾼다', () => {
      const { u, S } = _mkWatcher('__is1__', 0);
      S.sector.openings = [ { ix: 300, iy: 300 } ];
      const a = pickIdleScanAngle(u).ang;
      S.sector.openings = [ { ix: 400, iy: 100 } ];   // 도중에 후보가 바뀌어도
      return pickIdleScanAngle(u).ang === a;          // 도착 전이면 붙들고 있다
    });
    test('둘러보기 — 다 봤으면 아는 문턱을 지킨다', () => {
      // 프론티어 0 = sightClosed = "이 방은 다 봤다". 그때 할 일은 출입구 경계다.
      const { u, S } = _mkWatcher('__is2__', 0);
      S.sector.openings = [];
      S.thresholds = [ { ix: 400, iy: 100, name: 'TH-01', confirmed: true } ];   // thresholdsOf는 확정된 것만 준다
      const r = pickIdleScanAngle(u);
      return r && r.kind === 'watchThreshold' && Math.abs(r.ang - (-Math.PI / 2)) < 0.01;
    });
    test('둘러보기 — 스스로 채운 감시각으로 holdAngle에 가산이 붙지 않는다', () => {
      // 이걸 안 막으면 둘러보기가 holdAngle에 +8을 주고, 그 결과 guardEntry가 밀린다(32%→25% 실측).
      const base = { unit: {}, preferredWatchAngle: 1.0, _watchFromIdleScan: false };
      const scan = { unit: {}, preferredWatchAngle: 1.0, _watchFromIdleScan: true };
      return scoreHoldAngle(base) - scoreHoldAngle(scan) === 8;
    });
    test('둘러보기 — 볼 것도 지킬 것도 없으면 null (기존 idle 그대로)', () => {
      const { u, S } = _mkWatcher('__is3__', 0);
      S.sector.openings = []; S.thresholds = [];
      return pickIdleScanAngle(u) === null;
    });
    test('둘러보기 — 스위치를 끄면 holdKind가 다시 idle이다', () => {
      // 실행부 게이트만 확인한다 — picker 자체는 스위치를 안 본다.
      return _withIdleScan(false, () => isIdleScanOn() === false)
          && _withIdleScan(true, () => isIdleScanOn() === true);
    });
    test('엄호사격 — 제압 의도가 실제로 생산된다 (죽은 intent였다)', () => {
      // SUPPRESSIVE_FIRE는 modifiers·사격호·디버그에 다 배선돼 있었지만 생산자가 없었다.
      const d = buildTargetDescriptor({ x: 0, y: 0 }, { x: 300, y: 100, _fcSource: 'suppressive' });
      return d && d.type === 'suppressive' && d.isPointTarget === true
          && chooseFireIntent({ descriptor: d }) === 'SUPPRESSIVE_FIRE';
    });

    // ---- 이동사격 ----
    const _withMovingFire = (on, fn) => {
      const prev = GAME.movingFireOn;
      try { GAME.movingFireOn = on; return fn(); } finally { GAME.movingFireOn = prev; }
    };
    const _mkShooter = (moving, hasTarget) => ({
      id: '__mf__', movePath: moving ? [{ x: 0, y: 0 }] : [],
      currentTarget: hasTarget ? { x: 100, y: 0 } : null,
    });
    test('이동사격 — 표적을 잡았다고 이동이 공짜가 되지 않는다', () => _withMovingFire(true, () => {
      // 기존 게이트(`&& !currentTarget`)는 조준 이동사격에 페널티를 0으로 줬다. 그래서 두 극단만 있었다.
      return isFiringOnTheMove(_mkShooter(true, true)) === true
          && isFiringOnTheMove(_mkShooter(true, false)) === true
          && isFiringOnTheMove(_mkShooter(false, true)) === false
          && isFiringOnTheMove(_mkShooter(false, false)) === false;
    }));
    test('이동사격 — 스위치를 끄면 옛 게이트가 그대로 돌아온다', () => _withMovingFire(false, () => {
      return isFiringOnTheMove(_mkShooter(true, true)) === false     // 조준 이동사격은 다시 공짜
          && isFiringOnTheMove(_mkShooter(true, false)) === true
          && movingHitMul() === 0.55                                  // 옛 값
          && movingSpreadMulFor(2.0) === 2.0 && movingSpreadMulFor(3.0) === 3.0;
    }));
    test('이동사격 — 완화해도 여전히 정지보다 불리하다', () => _withMovingFire(true, () => {
      // "매리트가 있되 정지보다는 나쁘다" — 어느 무기에서도 이 부등식이 깨지면 안 된다.
      const ms = [1.0, 1.35, 2.0, 2.6, 3.0];
      return movingHitMul() < 1 && movingHitMul() > 0.55
          && ms.every(m => movingSpreadMulFor(m) >= 1 && movingSpreadMulFor(m) <= m);
    }));
    test('이동사격 — 무기별 순서가 보존된다 (평평한 상수가 아니다)', () => _withMovingFire(true, () => {
      // 배수를 상수로 갈아치우면 기관총과 권총이 이동 중 똑같아진다. 1 쪽으로 압축하되 순서는 남긴다.
      const a = movingSpreadMulFor(1.35), b = movingSpreadMulFor(2.0), c = movingSpreadMulFor(3.0);
      return a < b && b < c
          && Math.abs(b - (1 + 1.0 * MOVEFIRE_SPREAD_SOFTEN)) < 1e-9;
    }));
    test('이동사격 — 기본 배수가 없는 무기도 같은 규칙을 탄다', () => _withMovingFire(true, () => {
      return movingSpreadMulFor(null) === movingSpreadMulFor(DEFAULT_SPREAD.spreadMovingMul);
    }));

    // ---- 목표 선점 ----
    const _withClaims = (on, fn) => {
      const prev = GAME.claimsOn;
      try { GAME.claimsOn = on; return fn(); } finally { GAME.claimsOn = prev; }
    };
    test('선점 — 같은 문을 조금 다르게 본 둘이 같은 선점으로 맞는다', () => _withClaims(true, () => {
      // 격자 반올림이면 경계에서 갈라진다. 근접으로 봐야 같은 문이 같은 문이 된다.
      const me = { id: '__cl0a__', team: 'friend', alive: true };
      const mate = { id: '__cl0b__', team: 'friend', alive: true, isDowned: false,
                     _claim: thresholdClaimKey({ ix: 400, iy: 300 }) };
      const roster = [me, mate];
      const sameDoor = thresholdClaimKey({ ix: 404, iy: 297 });   // 같은 문, 다른 관측자
      const otherDoor = thresholdClaimKey({ ix: 600, iy: 300 });
      return claimHolder(me, sameDoor, roster) === mate
          && claimHolder(me, otherDoor, roster) === null;
    }));
    test('선점 — 살아 있는 같은 팀만 센다', () => _withClaims(true, () => {
      const at = (x, y) => thresholdClaimKey({ ix: x, iy: y });
      const me = { id: '__cl0__', team: 'friend', alive: true };
      const mate = { id: '__cl1__', team: 'friend', alive: true, isDowned: false, _claim: at(100, 100) };
      const dead = { id: '__cl2__', team: 'friend', alive: false, _claim: at(300, 300) };
      const foe = { id: '__cl3__', team: 'enemy', alive: true, isDowned: false, _claim: at(500, 500) };
      const roster = [me, mate, dead, foe];
      return claimHolder(me, at(100, 100), roster) === mate
          && claimHolder(me, at(300, 300), roster) === null   // 죽은 대원은 자리를 잡아 두지 않는다
          && claimHolder(me, at(500, 500), roster) === null;  // 적의 의도는 알 수 없다
    }));
    test('선점 — 안 맡힌 것을 먼저 고르고, 다 맡혔으면 표시만 남긴다', () => _withClaims(true, () => {
      const me = { id: '__cl4__', team: 'friend', alive: true };
      const near = { ix: 100, iy: 100 }, far = { ix: 500, iy: 100 };
      const mate = { id: '__cl5__', team: 'friend', alive: true, isDowned: false,
                     _claim: thresholdClaimKey(near) };
      const roster = [me, mate];
      const r1 = preferUnclaimed(me, [near, far], (t) => -Math.abs(t.ix - 100), roster);
      if (r1.target !== far || r1.claimed) return false;   // 가까운 게 맡혔으면 먼 걸 고른다
      const r2 = preferUnclaimed(me, [near], () => 0, roster);
      return r2.target === near && r2.claimed === true;    // 하나뿐이면 쓰되 맡혔다고 표시
    }));
    test('선점 — 스위치를 끄면 표시가 붙지 않는다', () => {
      const me = { id: '__cl6__', team: 'friend', alive: true };
      const th = { ix: 100, iy: 100 };
      const mate = { id: '__cl7__', team: 'friend', alive: true, isDowned: false,
                     _claim: { x: 100, y: 100 } };
      const roster = [me, mate];
      return _withClaims(false, () => preferUnclaimed(me, [th], () => 0, roster).claimed === false);
    });

    // ---- 성향 ----
    const _withTraits = (on, fn) => {
      const prev = GAME.traitsOn;
      try { GAME.traitsOn = on; return fn(); } finally { GAME.traitsOn = prev; }
    };
    test('성향 — 스위치를 끄면 편향이 0이다', () => _withTraits(false, () => {
      const u = { traits: { aggression: 1, caution: -1 } };
      return traitBiasFor(u, 'clearUnknownRoom') === 0 && traitBiasFor(u, 'seekCover') === 0;
    }));
    test('성향 — 적극적이면 밀고, 신중하면 먼저 본다', () => _withTraits(true, () => {
      const agg = { traits: { aggression: 1, caution: 0 } };
      const cau = { traits: { aggression: 0, caution: 1 } };
      return traitBiasFor(agg, 'clearUnknownRoom') > 0 && traitBiasFor(agg, 'holdAngle') < 0
          && traitBiasFor(cau, 'peekAndAssess') > 0 && traitBiasFor(cau, 'seekCover') > 0;
    }));
    test('성향 — 자격 없는 후보(점수 0)를 되살리지 않는다', () => _withTraits(true, () => {
      // 이 파일에서 0은 "지금 자격 없음"이다. 편향이 그걸 1위로 올리면 실행부가 없는 전제를 읽는다.
      const u = { id: '__tr1__', team: 'enemy', traits: { aggression: 1, caution: 0 },
                  skill: { presetId: 'elite' }, aiAction: null, aiMemory: null };
      const ctx = { unit: u, mem: null, lastHeardNoise: null, visibleEnemyCount: 0,
                    preferredWatchAngle: null, inCover: false, exposedToEnemy: false,
                    grenadeDanger: false, ammoEmpty: false, ammoLow: false, severeWound: false,
                    suppression: 0, recentlyHit: false, firepowerBalance: 0, enemyBehindFullCover: false,
                    enemyBehindPartialCover: false, exposedToThreat: false, canReturnFire: true,
                    hasImmediateThreat: false, hasPotentialThreat: false, threatPos: null,
                    bestCover: null, coverType: null, coverQuality: 0, visibleEnemy: null };
      const inv = scoreInvestigateNoise(ctx);
      if (inv !== 0) return true;                       // 전제가 안 맞으면 이 테스트는 무의미
      const c = evaluateActions(u, ctx);
      const m = c.find(x => x.type === 'investigateNoise');
      // 점수 노이즈는 0점 후보에도 붙으므로 "≤ 0"으로는 못 쓴다.
      //   편향(+6)을 못 받았다는 건 **노이즈 폭 안에 머문다**는 뜻이다.
      const noise = getUtilityProfile(u).scoreNoise;
      return !!m && m.raw === 0 && Math.abs(m.score) <= noise + 1e-6;
    }));
    test('성향 — 원형이 번호를 따라 공간을 덮는다', () => {
      const keys = [1, 2, 3, 4].map(n => rollTraits({ name: 'X-' + n }).key);
      return new Set(keys).size === 4;
    });
    test('성향 — 숙련도가 높을수록 기질이 덜 튄다', () => {
      let e = 0, r = 0;
      for (let i = 0; i < 40; i++) {
        e += Math.abs(rollTraits({ name: 'A-1', skillId: 'elite' }).aggression);
        r += Math.abs(rollTraits({ name: 'A-1', skillId: 'recruit' }).aggression);
      }
      return e < r;
    });

    // ---- 치명적 깔때기 ----
    const _withFunnel = (base, fn) => {
      const pw = GAME.funnelCostOn, pb = GAME.funnelBase;
      try { GAME.funnelCostOn = true; GAME.funnelBase = base; return fn(); }
      finally { GAME.funnelCostOn = pw; GAME.funnelBase = pb; }
    };
    test('깔때기 — 선분 교차 판정', () => {
      if (!_segCross(0, 0, 10, 0, 5, -5, 5, 5)) return false;      // 게이트를 가로지른다
      if (_segCross(0, 0, 10, 0, 20, -5, 20, 5)) return false;     // 게이트 못 미친다
      return _segCross(0, -30, 10, -30, 5, -5, 5, 5) === false;    // 게이트 옆으로 비껴간다
    });
    test('깔때기 — 게이트 정면은 비싸고 문설주 옆은 싸다', () => {
      const f = { funnels: [{ ax: 400, ay: 380, bx: 400, by: 420, hx: 500, hy: 400, ix: 400, iy: 400, w: 10 }] };
      return _withFunnel(0, () => {
        const front = dangerCostAt(f, 300, 400);      // 개구부 정면 — 방 안이 보인다
        const beside = dangerCostAt(f, 300, 300);     // 문설주 옆 — 안 보인다
        return front > beside && beside === 0;
      });
    });
    test('깔때기 — 너무 멀면 사선이라도 세지 않는다', () => {
      const f = { funnels: [{ ax: 400, ay: 380, bx: 400, by: 420, hx: 500, hy: 400, ix: 400, iy: 400, w: 10 }] };
      return _withFunnel(0, () => dangerCostAt(f, 400 - FUNNEL_MAX_M * PX_PER_M - 40, 400) === 0);
    });
    test('깔때기 — 스위치를 끄면 목록 자체가 안 생긴다', () => {
      const prev = GAME.funnelCostOn;
      try { GAME.funnelCostOn = false; return buildFunnels({ id: '__fn__', aiMemory: null }) === null; }
      finally { GAME.funnelCostOn = prev; }
    });

    // ---- 프래그 후 진입 ----
    test('프래그 — 팀 게이트: 돌입 측만 계획을 세운다', () => {
      const prev = GAME.fragPlanOn;
      try {
        GAME.fragPlanOn = true;
        if (fragPlanActiveFor({ team: 'enemy' })) return false;    // 측정상 적에겐 0.9%뿐인 상황이다
        if (!fragPlanActiveFor({ team: 'friend' })) return false;
        GAME.fragPlanOn = false;
        return fragPlanActiveFor({ team: 'friend' }) === false;
      } finally { GAME.fragPlanOn = prev; }
    });
    test('프래그 — 같은 방에 두 번 넣지 않는다', () => {
      const u = { id: '__fr1__', name: '__fr1__' };
      if (fragRoomOnCooldown(u, 'cqb_A')) return false;
      u._fragRoomAt = { cqb_A: (GAME.gameTime || 0) };
      if (!fragRoomOnCooldown(u, 'cqb_A')) return false;
      u._fragRoomAt = { cqb_A: (GAME.gameTime || 0) - FRAG_ROOM_COOLDOWN - 1 };
      return fragRoomOnCooldown(u, 'cqb_A') === false;
    });
    test('프래그 — 수류탄이 없으면 계획도 없다', () => {
      const u = { id: '__fr2__', team: 'friend', alive: true, throwables: {} };
      if (fragLethalIdFor(u) !== null) return false;
      u.throwables = { grenade_m67: 1 };
      return fragLethalIdFor(u) === 'grenade_m67';
    });
    test('프래그 — 던질 자리는 하나가 아니라 안전한 순서의 목록이다', () => {
      if (!_openPair) return false;
      const u = { id: '__fr3__', team: 'friend', alive: true, x: _openPair.x, y: _openPair.y, facing: 0 };
      const th = { ix: _openPair.x + 64, iy: _openPair.y, nx: 1, ny: 0, width: 40 };
      const l = fragThrowSpots(u, th);
      return Array.isArray(l) && l.length > 1;
    });
    test('프래그 — 계획은 접근부터 시작한다 (피킹 헛왕복 방지)', () => {
      if (!_openPair) return false;
      const u = { id: '__fr6__', name: '__fr6__', team: 'friend', alive: true, isDowned: false,
                  x: _openPair.x, y: _openPair.y, facing: 0, movePath: [], aiMemory: null,
                  throwables: { grenade_m67: 1 } };
      const th = { ix: _openPair.x + 96, iy: _openPair.y, nx: 1, ny: 0, width: 40,
                   ax: _openPair.x + 144, ay: _openPair.y, state: 'detected' };
      if (!setPendingFrag(u, th)) return false;
      const ok = u.pendingFrag.phase === 'approach';
      clearPendingFrag(u, 'test');
      return ok;
    });
    test('프래그 — 전체 예산을 넘기면 접고 잠시 쉰다', () => {
      if (!_openPair) return false;
      const u = { id: '__fr7__', name: '__fr7__', team: 'friend', alive: true, isDowned: false,
                  x: _openPair.x, y: _openPair.y, facing: 0, movePath: [], aiMemory: null,
                  throwables: { grenade_m67: 1 } };
      const th = { ix: _openPair.x + 96, iy: _openPair.y, nx: 1, ny: 0, width: 40,
                   ax: _openPair.x + 144, ay: _openPair.y, state: 'detected' };
      if (!setPendingFrag(u, th)) return false;
      u.pendingFrag.t = u.pendingFrag.budget + 1;
      tickFragPlan(u, 0.1);
      return u.pendingFrag === null
          && u._fragRetryUntil != null && u._fragRetryUntil > (GAME.gameTime || 0);
    });
    test('프래그 — 진입 목표는 문턱을 넘는 순간 뒤집히면 안 된다', () => {
      // _peekProbe는 현재 위치 기준으로 '너머'를 정한다. 그래서 목표를 굳혀 두어야 한다.
      const th = { ix: 400, iy: 400, nx: 1, ny: 0 };
      const before = _peekProbe(th, { x: 300, y: 400 }, 1.5);
      const after  = _peekProbe(th, { x: 500, y: 400 }, 1.5);
      return before.x > 400 && after.x < 400;      // 실제로 뒤집힌다 — 그래서 얼려 둔다
    });

    // ---- 문 ----
    const _mkDoor = (axis, hinge, swing) => makeDoor('t_' + axis + hinge + swing, axis, 400, 10, 200, 270,
                                                    { hinge, swing, material: 'wood' });
    test('문 — 닫힘은 간극을 메우고 열림은 수직으로 뻗는다', () => {
      const d = _mkDoor('h', 'min', 1);
      const c = doorAabb(d, 'closed'), o = doorAabb(d, 'open');
      return c.w === 70 && c.h === 8 && o.w === 8 && o.h === 70;
    });
    test('문 — 두 상태 모두 축정렬 사각형', () => {
      for (const ax of ['h', 'v']) for (const hg of ['min', 'max']) for (const sw of [1, -1]) {
        const d = _mkDoor(ax, hg, sw);
        for (const st of ['closed', 'open']) {
          const r = doorAabb(d, st);
          if (!(isFinite(r.x) && isFinite(r.y) && r.w > 0 && r.h > 0)) return false;
        }
      }
      return true;
    });
    test('문 — 경첩이 간극 끝을 잡는다', () => {
      const dmin = _mkDoor('h', 'min', 1), dmax = _mkDoor('h', 'max', 1);
      const omin = doorAabb(dmin, 'open'), omax = doorAabb(dmax, 'open');
      // min 경첩은 간극 시작, max 경첩은 간극 끝에 붙는다
      return Math.abs(omin.x - 200) < 1e-6 && Math.abs((omax.x + omax.w) - 270) < 1e-6;
    });
    test('문 — 여는 방향이 문짝이 차지하는 쪽을 바꾼다 (안/밖 여닫이)', () => {
      const dp = _mkDoor('h', 'min', 1), dm = _mkDoor('h', 'min', -1);
      const op = doorAabb(dp, 'open'), om = doorAabb(dm, 'open');
      const mid = 405;   // wallPos 400 + wallTh 10 / 2
      return op.y >= mid - 5 && (om.y + om.h) <= mid + 5 && op.y !== om.y;
    });
    test('문 — 상태 전환은 시간이 걸리고 그동안 닫힘 사각형을 유지한다', () => {
      const d = _mkDoor('h', 'min', 1);
      const before = [d.x, d.y, d.w, d.h].join(',');
      if (!setDoorState(d, 'open', null)) return false;
      if (setDoorState(d, 'open', null)) return false;          // 전환 중 재요청은 거부
      const during = [d.x, d.y, d.w, d.h].join(',');
      d.transition.t = d.transition.dur;                        // 완료 직전으로
      return before === during && d.state === 'closed' && doorSwingProgress(d) > 0.99;
    });
    test('문 — 계획은 통과, 물리는 차단', () => {
      const doors = doorsOf(null);
      if (!doors.length) return true;                            // 문 없는 맵은 해당 없음
      const d = doors.find(z => z.state === 'closed');
      if (!d) return true;
      const c = doorCenter(d);
      return _pathCellWalkable(c.x, c.y) === true && pointInWalls(c.x, c.y, PATH_PAD) === true;
    });
    test('문 — 계획에서 열린 문짝은 그대로 장애물', () => {
      const doors = doorsOf(null);
      if (!doors.length) return true;
      const d = doors[0], keep = d.state;
      d.state = 'open'; applyDoorAabb(d);
      const blocked = _planPointInWalls(d.x + d.w / 2, d.y + d.h / 2, 0);
      d.state = keep; applyDoorAabb(d);
      return blocked === true;
    });
    test('문 — 닫힌 문 칸에는 계획 비용이 붙는다', () => {
      const doors = doorsOf(null);
      if (!doors.length) return true;
      const d = doors.find(z => z.state === 'closed');
      if (!d) return true;
      const c = doorCenter(d);
      return _planDoorCostTruth(c.x, c.y) > 0 && _planDoorCostTruth(48, 48) === 0;
    });
    test('문 — 믿음 계획은 기억하는 문을 지나갈 수 있다고 본다', () => {
      const probe = { id: '__sp_door__', x: 0, y: 0, facing: 0,
                      aiMemory: { observedSurfaces: new Map() } };
      const M = probe.aiMemory.observedSurfaces;
      M.set('D-1', { objectKind: 'door', believedBody: { x: 200, y: 400, w: 70, h: 8 } });
      M.set('W-1', { objectKind: 'wall', believedBody: { x: 600, y: 400, w: 70, h: 8 } });
      const dm = { x: 235, y: 404 }, wm = { x: 635, y: 404 };
      // 문은 계획에서 빠지고(통행 가능) 비용이 붙는다. 벽은 그대로 막는다.
      return believedCellWalkable(probe, dm.x, dm.y, 0) === true &&
             believedCellWalkable(probe, wm.x, wm.y, 0) === false &&
             believedDoorCost(probe, dm.x, dm.y, 0) > 0 &&
             believedDoorCost(probe, wm.x, wm.y, 0) === 0 &&
             believedBodies(probe).length === 2 &&
             believedBodies(probe, { planning: true }).length === 1;
    });

    const pass = tests.filter(t => t.ok).length;
    return { pass, total: tests.length, tests };
  }

  // =========================================================
  // legacy mirror — 기존 소비자(knownCovers 23곳 / knownWalls 6곳)를 위해
  //   믿음(surfaces)에서 옛 자료구조 모양을 역산해 채운다.
  //   결정적 차이: 여기 들어가는 id는 정답 객체 id가 아니라 믿음 id(M-01)이고,
  //   좌표도 관측 추정치다. 없는 엄폐물이 들어 있을 수 있으며 그것이 의도된 동작이다.
  // =========================================================
  const MIRROR_COVER_MAX_LEN = _px(8);     // 이보다 긴 면은 방 벽이지 엄폐물이 아니다
  const MIRROR_DEFAULT_DEPTH = _px(0.5);   // 두께 미상일 때 가정하는 몸통 깊이
  const MIRROR_MAX_COVERS = 50, MIRROR_MAX_WALLS = 80;

  // 믿는 면 → AI가 믿는 "물체의 몸통". 면에서 법선 반대쪽으로 두께만큼 밀어낸 사각형이다.
  //   두께를 아직 모르면 기본 깊이를 가정한다 — 그것도 믿음의 일부다.
  //   미러와 믿음 기반 슬롯 검증이 같은 몸통을 봐야 하므로 여기 한 곳에서만 만든다.
  function believedBodyOf(w) {
    const ax = w.ox + w.ux * w.tMin, ay = w.oy + w.uy * w.tMin;
    const bx = w.ox + w.ux * w.tMax, by = w.oy + w.uy * w.tMax;
    const depth = (w.thickness != null) ? w.thickness : MIRROR_DEFAULT_DEPTH;
    const qx1 = ax - w.nx * depth, qy1 = ay - w.ny * depth;
    const qx2 = bx - w.nx * depth, qy2 = by - w.ny * depth;
    const rx = Math.min(ax, bx, qx1, qx2), ry = Math.min(ay, by, qy1, qy2);
    return {
      ax, ay, bx, by, depth,
      x: rx, y: ry,
      w: Math.max(ax, bx, qx1, qx2) - rx,
      h: Math.max(ay, by, qy1, qy2) - ry,
      cx: (ax + bx) / 2 - w.nx * depth / 2,
      cy: (ay + by) / 2 - w.ny * depth / 2
    };
  }

  function mirrorToLegacyMemory(unit, mem, now) {
    const S = ensureSpatial(unit);
    const tau = tauFor(unit);
    if (!mem.knownCovers) mem.knownCovers = new Map();
    if (!mem.knownWalls) mem.knownWalls = new Map();
    const prevOcc = new Map();
    for (const [k, v] of mem.knownCovers) if (v && v.occupiedBy) prevOcc.set(k, v.occupiedBy);
    mem.knownCovers.clear();
    mem.knownWalls.clear();

    const covers = [], walls = [];
    for (const w of S.surfaces) {
      const c = confidenceAt(w, now, tau);
      if (c < MEMORY_UNCERTAIN) continue;
      const len = w.tMax - w.tMin;
      const ax = w.ox + w.ux * w.tMin, ay = w.oy + w.uy * w.tMin;
      const bx = w.ox + w.ux * w.tMax, by = w.oy + w.uy * w.tMax;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;

      // 기존 시스템과 같은 분류를 지킨다: 벽은 knownWalls로, 엄폐물만 knownCovers로.
      //   면 등급(cls)이 아니라 출처(srcKind)로 나눠야 한다 — 벽 면도 시야를 막으므로
      //   cls만 보면 방 벽이 전부 'full cover'로 둔갑한다.
      if ((w.srcKind || 'wall') === 'wall') {
        const gx = Math.round(mx / 16) * 16, gy = Math.round(my / 16) * 16;   // recordWall과 같은 격자 규칙
        walls.push({ c, entry: { id: 'w_' + gx + '_' + gy, x: mx, y: my, wallType: w.cls || 'wall',
                                 lastSeenTime: w.lastSeen, confidence: c, believed: true } });
        continue;
      }

      if (len > MIRROR_COVER_MAX_LEN) continue;
      const body = believedBodyOf(w);
      const full = (w.blocksSight !== false);
      covers.push({ c, entry: {
        id: w.name, x: body.cx, y: body.cy,
        rect: { x: body.x, y: body.y, w: body.w, h: body.h },
        coverType: full ? 'full' : 'half',
        blocksVision: full,
        blocksBullets: (w.ballistic != null ? w.ballistic : 1) > 0,
        lastSeenTime: w.lastSeen, confidence: c,
        occupiedBy: prevOcc.get(w.name) || null,
        believed: true, thicknessKnown: w.thickness != null
      } });
    }
    covers.sort((a, b) => b.c - a.c);
    walls.sort((a, b) => b.c - a.c);
    for (let i = 0; i < Math.min(covers.length, MIRROR_MAX_COVERS); i++) mem.knownCovers.set(covers[i].entry.id, covers[i].entry);
    for (let i = 0; i < Math.min(walls.length, MIRROR_MAX_WALLS); i++) mem.knownWalls.set(walls[i].entry.id, walls[i].entry);

    mirrorObservedSurfaces(unit, mem, S, now, tau);
    mirrorOpenSectors(unit, mem, S, now);
    mirrorKnownCorners(unit, mem, S, now, tau);
    return { covers: mem.knownCovers.size, walls: mem.knownWalls.size,
             surfaces: mem.observedSurfaces ? mem.observedSurfaces.size : 0 };
  }

  // ---- observedSurfaces (AI0-B 모양) 파생 ----
  //   정본 엄폐 경로(findBestObservedCover)가 읽는 자료구조다.
  //   구조는 그대로 두고 내용만 믿음으로 채운다 — 소비자를 고치지 않기 위해서.
  //   결정적 차이: surfaceId/objectId가 믿음 id이고, material/armor가 추정치다.
  function mirrorObservedSurfaces(unit, mem, S, now, tau) {
    if (!(mem.observedSurfaces instanceof Map)) mem.observedSurfaces = new Map();
    mem.observedSurfaces.clear();
    for (const w of S.surfaces) {
      const c = confidenceAt(w, now, tau);
      if (c < MEMORY_UNCERTAIN) continue;
      const len = w.tMax - w.tMin;
      if (len < 4) continue;
      const body = believedBodyOf(w);
      const mat = believedMaterial(w);
      const armorPerM = (typeof getBarrierArmorPerMeter === 'function')
        ? getBarrierArmorPerMeter({ material: mat }, mat)
        : ((typeof MATERIAL_ARMOR_PER_M !== 'undefined' && MATERIAL_ARMOR_PER_M[mat]) || 38.4);
      mem.observedSurfaces.set(w.name, {
        surfaceId: w.name, objectId: w.name, objectKind: (w.srcKind || 'wall'), face: 0,
        geometryRevision: 0, observationRevision: 0,
        worldNormalX: w.nx, worldNormalY: w.ny,
        tangentX: w.ux, tangentY: w.uy,
        segmentStartX: body.ax, segmentStartY: body.ay,
        segmentEndX: body.bx, segmentEndY: body.by, segmentLength: len,
        // 믿는 구간 전체가 곧 관측 구간이다 — 이 계층은 본 만큼만 면을 갖고 있다
        observedRanges: [{ s0: 0, s1: len, firstSeenAt: w.firstSeen, lastSeenAt: w.lastSeen, confidence: c }],
        coverType: (w.blocksSight !== false) ? 'full' : 'half',
        blocksVision: (w.blocksSight !== false),
        blocksBullets: (w.ballistic != null ? w.ballistic : 1) > 0,
        material: mat,
        armor: +(armorPerM * pxToM(body.depth)).toFixed(1),
        believedBody: { x: body.x, y: body.y, w: body.w, h: body.h },   // 믿음 기반 슬롯 검증이 쓴다
        believed: true, thicknessKnown: w.thickness != null,
        observerRegionId: null,
        firstSeenAt: w.firstSeen, lastSeenAt: w.lastSeen, lastVerifiedAt: w.lastSeen,
        confidence: c, invalidCount: 0
      });
    }
  }

  // ---- knownCorners 파생 ----
  //   면의 확정된 끝이 곧 모서리다. "그 너머가 보였다"는 뜻이라 정답 사각형 꼭짓점보다
  //   관측에 충실하다. 레거시는 레이가 직접 맞은 모서리만 기록했으므로 언제나 볼 수 있는
  //   곳이었다 — 같은 성질을 지키려고 믿는 지형 기준으로 가로막힌 것은 뺀다.
  function mirrorKnownCorners(unit, mem, S, now, tau) {
    const out = [], seen = [];
    const memSegs = sightMemory(S, now, tau, MEMORY_UNCERTAIN);
    const visible = (x, y) => {
      const dx = x - unit.x, dy = y - unit.y, d = Math.hypot(dx, dy);
      if (d < 1) return true;
      return !rayHit(unit.x, unit.y, Math.atan2(dy, dx), d - _px(0.25), memSegs).seg;
    };
    // 소비자(repositionToCorner)는 모서리에서 관측자 쪽으로 조금 물러난 자리로 이동한다.
    //   벽 접합부의 모서리는 그만한 여유가 없어 경로 마지막 구간이 벽을 스친다.
    //   그래서 관측자 쪽에 설 자리가 있다고 믿는 모서리만 내보낸다.
    const R = (typeof UNIT_RADIUS !== 'undefined') ? UNIT_RADIUS : 11;
    const bodies = [];
    for (const w2 of S.surfaces) {
      if (confidenceAt(w2, now, tau) < MEMORY_UNCERTAIN) continue;
      bodies.push(believedBodyOf(w2));
    }
    const hasStandingRoom = (cx2, cy2) => {
      const dx = unit.x - cx2, dy = unit.y - cy2, d = Math.hypot(dx, dy) || 1;
      const px = cx2 + (dx / d) * R * 1.6, py = cy2 + (dy / d) * R * 1.6;
      for (const b of bodies) {
        if (px >= b.x - R && px <= b.x + b.w + R && py >= b.y - R && py <= b.y + b.h + R) return false;
      }
      return true;
    };
    for (const w of S.surfaces) {
      const c = confidenceAt(w, now, tau);
      if (c < MEMORY_UNCERTAIN) continue;
      // 문짝의 끝은 전술적 모서리가 아니다. 그건 문틀 안이고, 문틀의 모서리는
      //   이미 벽 면에서 나온다. 문에서 모서리를 뽑으면 물러설 자리가 문틀 안이라
      //   경로 마지막 구간이 언제나 벽을 스친다(repositionToCorner 폭주의 원인).
      if (w.srcKind === 'door') continue;
      const ends = [];
      if (w.minCorner) ends.push({ x: w.ox + w.ux * w.tMin, y: w.oy + w.uy * w.tMin });
      if (w.maxCorner) ends.push({ x: w.ox + w.ux * w.tMax, y: w.oy + w.uy * w.tMax });
      for (const e of ends) {
        let dup = false;
        for (const s of seen) if (Math.hypot(s.x - e.x, s.y - e.y) < 8) { dup = true; break; }
        if (dup || !visible(e.x, e.y) || !hasStandingRoom(e.x, e.y)) continue;
        seen.push(e);
        // 레거시와 같은 뜻: 접근각은 모서리에서 관측자 쪽, 엿보는 각은 그 반대.
        out.push({
          x: e.x, y: e.y,
          approachAngle: Math.atan2(unit.x - e.x, unit.y - e.y),
          peekAngle: Math.atan2(e.y - unit.y, e.x - unit.x) + Math.PI,
          lastSeenTime: w.lastSeen, confidence: c, believed: true
        });
      }
    }
    out.sort((a, b) => b.confidence - a.confidence);
    mem.knownCorners = out.slice(0, 30);
  }

  // ---- openSectors 파생 ---- 섹터 분석이 낸 개구부가 곧 열린 방향이다
  function mirrorOpenSectors(unit, mem, S, now) {
    const out = [];
    for (const op of S.sector.openings) {
      const d = Math.hypot(op.ax - unit.x, op.ay - unit.y);
      out.push({ angle: op.mid, distance: d, lastCheckedTime: now, score: d, believed: true });
    }
    out.sort((a, b) => b.score - a.score);
    mem.openSectors = out.slice(0, 16);
  }


  // =========================================================
  // 인식 정확도 측정 — 믿음을 정답 지오메트리와 대조한다.
  //   진단 전용이다. AI는 이 함수를 절대 호출하지 않는다 (정답을 보게 되므로).
  //
  //   "덜 아는 것"과 "틀리게 아는 것"을 구분한다.
  //     · 벽의 일부만 기억하는 것은 오류가 아니다 — 그만큼만 봤을 뿐이다.
  //     · 없는 것을 믿거나(ghost), 실제보다 길게 믿는 것(overExtend)이 오류다.
  // =========================================================
  //   관측점은 정답 선분 위에서 만들어지므로 끝점의 수직오차나 바깥으로 삐져나간 길이는
  //   구조적으로 항상 0이다. 그런 걸 재면 "오차 없음"이라는 잘못된 결론이 나온다.
  //   실제 오류는 matchSurface가 최대 COLLINEAR_GAP(6.5m)까지 같은 면으로 이어 믿는 데서 난다:
  //   한 직선 위 두 벽 사이에 출입구가 있어도 하나의 연속된 벽으로 기억할 수 있다.
  //   따라서 "믿는 구간 중 실제로 단단한 것이 없는 길이"(허상 구간)를 잰다.
  const SUPPORT_TOL = _px(0.2);
  const SPAN_SAMPLES = 24;
  function spanSupported(px, py, w, segs) {
    for (const s of segs) {
      if (s.nx * w.nx + s.ny * w.ny < NORMAL_TOL) continue;
      if (Math.abs((px - s.x1) * s.nx + (py - s.y1) * s.ny) > SUPPORT_TOL) continue;
      const t = segmentParam(s, px, py);
      if (t <= 0.0001 || t >= 0.9999) {
        // 끝점 근처는 파라미터가 잘리므로 실제 거리로 다시 본다
        const ex = (t <= 0.0001) ? s.x1 : s.x2, ey = (t <= 0.0001) ? s.y1 : s.y2;
        if (Math.hypot(px - ex, py - ey) > SUPPORT_TOL) continue;
      }
      return true;
    }
    return false;
  }
  function measureAccuracy(unit) {
    const S = ensureSpatial(unit);
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    const tau = tauFor(unit);
    const segs = allSegments();
    const believed = S.surfaces.filter(w => confidenceAt(w, now, tau) >= MEMORY_UNCERTAIN);

    let ghosts = 0, phantomLenSum = 0, believedLenSum = 0, worstRatio = 0, worstPhantomPx = 0;
    let matWrong = 0, matClassWrong = 0, matExact = 0, matClassOnly = 0, matUnknown = 0;
    const trueObjs = new Set();

    for (const w of believed) {
      const bm = believedMaterial(w), lvl = materialKnownLevel(w);
      if (bm !== w.material) matWrong++;
      if (materialClassOf(bm) !== materialClassOf(w.material)) matClassWrong++;
      if (lvl === 'exact') matExact++; else if (lvl === 'class') matClassOnly++; else matUnknown++;
      const len = w.tMax - w.tMin;
      believedLenSum += len;
      let unsupported = 0;
      for (let i = 0; i < SPAN_SAMPLES; i++) {
        const t = w.tMin + len * ((i + 0.5) / SPAN_SAMPLES);
        const px = w.ox + w.ux * t, py = w.oy + w.uy * t;
        if (!spanSupported(px, py, w, segs)) unsupported++;
      }
      const ratio = unsupported / SPAN_SAMPLES;
      const phantomPx = ratio * len;
      phantomLenSum += phantomPx;
      if (ratio > worstRatio) worstRatio = ratio;
      if (phantomPx > worstPhantomPx) worstPhantomPx = phantomPx;
      if (ratio > 0.5) ghosts++;                    // 절반 넘게 허상이면 그 면 자체가 유령이다
      if (w.trueIds) for (const id of w.trueIds) trueObjs.add(id);
    }
    const n = believed.length || 1;
    return {
      believed: believed.length,
      ghosts, ghostRate: +(ghosts / n).toFixed(3),
      believedLenPx: +believedLenSum.toFixed(1),
      phantomLenPx: +phantomLenSum.toFixed(1),
      phantomRate: +(phantomLenSum / (believedLenSum || 1)).toFixed(4),
      worstPhantomRatio: +worstRatio.toFixed(3),
      worstPhantomPx: +worstPhantomPx.toFixed(1),
      materialWrong: matWrong, materialWrongRate: +(matWrong / n).toFixed(3),
      materialClassWrong: matClassWrong, materialClassWrongRate: +(matClassWrong / n).toFixed(3),
      materialExact: matExact, materialExactRate: +(matExact / n).toFixed(3),
      materialClassOnly: matClassOnly, materialUnknown: matUnknown,
      thicknessKnown: believed.filter(w => w.thickness != null).length,
      thicknessRate: +(believed.filter(w => w.thickness != null).length / n).toFixed(3),
      distinctTrueObjects: trueObjs.size,
      unknownsOpen: S.unknowns.filter(u => !unknownFinished(u)).length,
      unknownsResolved: S.unknowns.filter(u => unknownFinished(u)).length,
      reconcileSplits: S.stats.reconcileSplits,
      reconcileKills: S.stats.reconcileKills,
      surfacesBorn: S.stats.born
    };
  }

  // 디버그 오버레이용 — 믿는 면 + 그 중 실재하지 않는 구간.
  //   정답을 읽으므로 렌더/진단 전용이다. AI 판단 경로는 절대 호출하지 않는다.
  function getDebugSurfaces(unit) {
    const S = ensureSpatial(unit);
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    const tau = tauFor(unit);
    const segs = allSegments();
    const out = [];
    for (const w of S.surfaces) {
      const c = confidenceAt(w, now, tau);
      const len = w.tMax - w.tMin;
      const phantom = [];
      let run = null;
      for (let i = 0; i < SPAN_SAMPLES; i++) {
        const f = (i + 0.5) / SPAN_SAMPLES;
        const t = w.tMin + len * f;
        const ok = spanSupported(w.ox + w.ux * t, w.oy + w.uy * t, w, segs);
        if (!ok && !run) run = { f0: f };
        if (ok && run) { run.f1 = f; phantom.push(run); run = null; }
      }
      if (run) { run.f1 = 1; phantom.push(run); }
      out.push({
        name: w.name, state: memoryState(c), confidence: c,
        cls: w.cls || 'wall', blocksSight: w.blocksSight !== false,
        thickness: w.thickness,
        material: believedMaterial(w), materialKnown: materialKnownLevel(w),
        materialWrong: believedMaterial(w) !== w.material,
        ax: w.ox + w.ux * w.tMin, ay: w.oy + w.uy * w.tMin,
        bx: w.ox + w.ux * w.tMax, by: w.oy + w.uy * w.tMax,
        phantom: phantom.map(r => ({
          x1: w.ox + w.ux * (w.tMin + len * r.f0), y1: w.oy + w.uy * (w.tMin + len * r.f0),
          x2: w.ox + w.ux * (w.tMin + len * r.f1), y2: w.oy + w.uy * (w.tMin + len * r.f1)
        }))
      });
    }
    return { surfaces: out, unknowns: S.unknowns, sector: S.sector };
  }

  // 전 유닛 합산 — 콘솔/AAR에서 한 줄로 보기 위한 것
  function measureAll(units) {
    const list = (units || (typeof UNITS !== 'undefined' ? UNITS : [])).filter(u => u && u.aiMemory && u.aiMemory.spatial);
    if (!list.length) return { units: 0 };
    const acc = { units: list.length, believed: 0, ghosts: 0, thicknessKnown: 0,
                  reconcileSplits: 0, reconcileKills: 0, surfacesBorn: 0,
                  unknownsOpen: 0, unknownsResolved: 0, believedLenPx: 0, phantomLenPx: 0,
                  materialWrong: 0, materialClassWrong: 0, materialExact: 0,
                  materialClassOnly: 0, materialUnknown: 0, byTier: {} };
    let worstRatio = 0, worstPx = 0;
    for (const u of list) {
      const m = measureAccuracy(u);
      acc.believed += m.believed; acc.ghosts += m.ghosts;
      acc.thicknessKnown += m.thicknessKnown;
      acc.reconcileSplits += m.reconcileSplits; acc.reconcileKills += m.reconcileKills;
      acc.surfacesBorn += m.surfacesBorn;
      acc.unknownsOpen += m.unknownsOpen; acc.unknownsResolved += m.unknownsResolved;
      acc.believedLenPx += m.believedLenPx; acc.phantomLenPx += m.phantomLenPx;
      acc.materialWrong += m.materialWrong; acc.materialClassWrong += m.materialClassWrong;
      acc.materialExact += m.materialExact;
      acc.materialClassOnly += m.materialClassOnly; acc.materialUnknown += m.materialUnknown;
      if (m.worstPhantomRatio > worstRatio) worstRatio = m.worstPhantomRatio;
      if (m.worstPhantomPx > worstPx) worstPx = m.worstPhantomPx;
      // 숙련도별 분해 — scanInterval/rayCount가 다르니 수렴 속도도 달라야 한다
      const tier = (u.skill && u.skill.presetId) || 'regular';
      const t = acc.byTier[tier] || (acc.byTier[tier] = { units: 0, believed: 0, wrong: 0, exact: 0, thick: 0 });
      t.units++; t.believed += m.believed; t.wrong += m.materialWrong;
      t.exact += m.materialExact; t.thick += m.thicknessKnown;
    }
    for (const k in acc.byTier) {
      const t = acc.byTier[k], d = t.believed || 1;
      t.wrongRate = +(t.wrong / d).toFixed(3);
      t.exactRate = +(t.exact / d).toFixed(3);
      t.thickRate = +(t.thick / d).toFixed(3);
      // 비율만 보면 오해한다 — 아는 면이 적을수록 "가진 것 중 정확한 비율"은 높아진다.
      // 적게 아는 것과 정확히 아는 것을 구분하려면 규모를 같이 봐야 한다.
      t.believedPerUnit = +(t.believed / (t.units || 1)).toFixed(1);
      t.exactPerUnit = +(t.exact / (t.units || 1)).toFixed(1);
    }
    acc.materialWrongRate = +(acc.materialWrong / (acc.believed || 1)).toFixed(3);
    acc.materialClassWrongRate = +(acc.materialClassWrong / (acc.believed || 1)).toFixed(3);
    acc.materialExactRate = +(acc.materialExact / (acc.believed || 1)).toFixed(3);
    acc.ghostRate = +(acc.ghosts / (acc.believed || 1)).toFixed(3);
    acc.thicknessRate = +(acc.thicknessKnown / (acc.believed || 1)).toFixed(3);
    acc.phantomRate = +(acc.phantomLenPx / (acc.believedLenPx || 1)).toFixed(4);
    acc.worstPhantomRatio = +worstRatio.toFixed(3);
    acc.worstPhantomPx = +worstPx.toFixed(1);
    acc.believedLenPx = +acc.believedLenPx.toFixed(1);
    acc.phantomLenPx = +acc.phantomLenPx.toFixed(1);
    acc.believedPerUnit = +(acc.believed / acc.units).toFixed(1);
    return acc;
  }

  // =========================================================
  // 경로 계획용 술어 — freespace assumption
  //   "안 본 곳은 뚫려 있다"고 보고 계획하다가 부딪히면 재계획한다(로보틱스의 표준).
  //   덕분에 탐색 행동이 저절로 나오고, 기억한 지형만으로 길을 고르게 된다.
  //
  //   경계선: 여기는 **계획**만 담당한다. 실제 이동 충돌·validateMoveTarget·슬롯 물리검증은
  //   계속 정답(pointInWalls/pathBlocked)을 쓴다. 물리가 정답이어야 AI가 틀렸다는 사실이
  //   드러난다 — 믿음으로 계획하고 현실에 부딪히는 것이 이 설계의 핵심이다.
  // =========================================================
  //   opts.planning — 계획용으로 부르면 **기억하는 문을 뺀다.**
  //     닫힌 문은 "지날 수 있는 장벽"이므로 A*가 피해 돌아가면 안 된다(그러면 아무도 문을 안 연다).
  //     본 적 없는 문은 애초에 기억에 없어 freespace 가정으로 통행 가능하다 — 양쪽이 같은 답이 된다.
  //     물리(pointInWalls/pathBlocked)는 그대로 문을 막는다. 여는 건 실행부의 몫이다.
  function believedBodies(unit, opts) {
    const mem = unit && unit.aiMemory;
    if (!mem || !(mem.observedSurfaces instanceof Map)) return null;
    const skipDoors = !!(opts && opts.planning);
    const out = [];
    for (const sm of mem.observedSurfaces.values()) {
      if (!sm || !sm.believedBody) continue;
      if (skipDoors && (sm.objectKind || sm.srcKind) === 'door') continue;
      out.push(sm.believedBody);
    }
    return out;
  }
  // 기억하는 닫힌 문을 지나는 비용 — 믿음 쪽 비용원. 정답 문 상태를 보지 않는다.
  function believedDoorCost(unit, x, y, pad) {
    const mem = unit && unit.aiMemory;
    if (!mem || !(mem.observedSurfaces instanceof Map)) return 0;
    const p = pad || 0;
    for (const sm of mem.observedSurfaces.values()) {
      if (!sm || (sm.objectKind || sm.srcKind) !== 'door' || !sm.believedBody) continue;
      const b = sm.believedBody;
      if (x >= b.x - p && x <= b.x + b.w + p && y >= b.y - p && y <= b.y + b.h + p) return DOOR_PLAN_COST;
    }
    return 0;
  }
  // 접촉도 감각이다.
  //   freespace assumption의 필연적 귀결 — 모르는 벽으로 계획하고 부딪힌다.
  //   부딪혔다는 사실을 남기지 않으면 같은 경로를 영원히 다시 계획한다.
  //   낮은 evidence로 심어 두면, 나중에 실제로 보면 absorbObservation이 정식 관측으로
  //   덮어쓰고 아니면 pruneMemory가 노이즈로 지운다 — reconcileMemory와 같은 철학이다.
  const CONTACT_LEN = _px(0.5);
  function recordContact(unit, x, y, dirX, dirY) {
    const S = ensureSpatial(unit);
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    const d = Math.hypot(dirX, dirY) || 1;
    const nx = -dirX / d, ny = -dirY / d;          // 법선은 부딪힌 쪽을 되받는 방향
    const tx = -ny, ty = nx;                        // 접선
    const half = CONTACT_LEN / 2;
    const obs = {
      x1: x - tx * half, y1: y - ty * half,
      x2: x + tx * half, y2: y + ty * half,
      c1: false, c2: false, nx, ny,
      material: 'concrete',                         // 만져봤을 뿐 — 재질은 모른다(unknown 단계 유지)
      // 부딪혔다는 건 **거기 뭔가 있다는 물리적 사실**이다. 확신도는 그 사실만큼 준다 —
      //   MEMORY_UNCERTAIN(0.30) 위, MEMORY_CONFIRMED(0.62) 아래. 그래야 미러에 올라가
      //   다음 계획을 실제로 막는다. 예전 0.12는 문턱 아래라 심자마자 사라졌고,
      //   그래서 유닛이 같은 벽을 몇 번이고 다시 들이받았다.
      strength: 0.55, matQuality: 0,                // 재질 증거는 주지 않는다
      cls: 'wall', blocksSight: true, ballistic: 1,
      wallId: 'contact', srcKind: 'wall'
    };
    const w = absorbObservation(S, obs, now, 0);
    if (w) { S.stats.contacts = (S.stats.contacts || 0) + 1; }
    return w;
  }

  function believedCellWalkable(unit, x, y, pad) {
    const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
    if (M) {
      // 맵 경계는 아는 것으로 친다 — 건물 밖으로 계획을 세우는 건 탐색이 아니라 버그다
      const m = 48;
      if (!(x >= m && x <= M.w - m && y >= m && y <= M.h - m)) return false;
    }
    const bodies = believedBodies(unit, { planning: true });
    if (!bodies) return true;
    const p = pad || 0;
    for (const b of bodies) {
      if (x >= b.x - p && x <= b.x + b.w + p && y >= b.y - p && y <= b.y + b.h + p) return false;
    }
    return true;
  }
  function believedWalkClear(unit, x1, y1, x2, y2, pad) {
    const bodies = believedBodies(unit, { planning: true });
    if (!bodies) return true;
    const p = pad || 0;
    for (const b of bodies) {
      if (typeof segmentIntersectsRect === 'function' &&
          segmentIntersectsRect(x1, y1, x2, y2, { x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p })) return false;
    }
    return true;
  }

  // =========================================================
  // 믿음 위상 — 방과 문을 "믿는 지형"에서 세운다.
  //   기존 buildTacticalSpatialGraph를 그대로 쓴다. 그 빌더가 맵에서 읽는 건
  //   walls / w / h / id 뿐이고 아래 계층도 전부 map 인자를 받으므로,
  //   합성 맵을 넣으면 region/portal 로직을 한 줄도 안 고치고 믿음 그래프가 나온다.
  //
  //   여기서 큰 단순화가 따라온다: 이 그래프는 애초에 그 유닛이 믿는 것만 담는다.
  //   "이 방을 봤는가"를 따로 추적할 필요가 없다 — 담겨 있으면 아는 것이다.
  // =========================================================
  function believedMapOf(unit) {
    const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
    if (!M) return null;
    const walls = [];
    const mem = unit && unit.aiMemory;
    if (mem && mem.observedSurfaces instanceof Map) {
      for (const sm of mem.observedSurfaces.values()) {
        const b = sm && sm.believedBody;
        if (!b || b.w <= 0 || b.h <= 0) continue;
        // 복사본을 넘긴다 — ensureTacticalGeometryIds가 맵 객체에 _tacticalObjectId를
        // 심으므로 believedBody 원본을 그대로 주면 기억이 오염된다.
        walls.push({ x: b.x, y: b.y, w: b.w, h: b.h, material: sm.material || 'concrete' });
      }
    }
    // coverObjects는 비운다 — 빌더는 문을 walls의 간극에서만 찾는다.
    //   엄폐물을 넣으면 상자 사이 틈이 전부 문이 된다.
    return { id: 'belief:' + (unit && unit.id != null ? unit.id : '?'),
             name: 'belief', w: M.w, h: M.h, walls, coverObjects: [] };
  }

  // AI가 기억하는 개구부 → 빌더가 아는 문 모양.
  //   관측으로 재구성한 벽은 조각이라 벽 간극으로는 문이 안 나온다. 대신 섹터 분석이
  //   이미 찾아 둔 개구부(UNK)가 곧 그 유닛이 믿는 문이다 — 틀린 것도 섞여 있고, 그게 맞다.
  function believedOpenings(S) {
    const out = [];
    for (const u of S.unknowns) {
      if (!u.gateA || !u.gateB) continue;
      const ax = u.gateA.x, ay = u.gateA.y, bx = u.gateB.x, by = u.gateB.y;
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (L < _px(0.4)) continue;
      const tx = dx / L, ty = dy / L;
      out.push({
        kind: 'doorway', ax, ay, bx, by,
        centerX: (ax + bx) / 2, centerY: (ay + by) / 2,
        tangentX: tx, tangentY: ty,
        normalX: -ty, normalY: tx,            // 통행 방향 = 게이트에 수직
        sideA: null, sideB: null, width: L,
        clearanceVerified: true, gridNativeCapable: null, path: null,
        orientation: Math.abs(tx) >= Math.abs(ty) ? 'horizontal' : 'vertical',
      });
    }
    return out;
  }

  // 믿음 리비전 — 이미 세고 있는 변화량의 합. 이 값이 그대로면 지형 믿음이 안 바뀐 것이다.
  function beliefRevision(S) {
    const st = S.stats || {};
    return (st.born || 0) + (st.reconcileSplits || 0) + (st.reconcileKills || 0) + (st.contacts || 0);
  }

  let _graphBuilds = 0, _graphDeferred = 0;
  function beliefGraphOf(unit) {
    if (!unit) return null;
    const S = ensureSpatial(unit);
    const rev = beliefRevision(S);
    if (S.graph && S.graphRev === rev) return S.graph;
    // 믿음이 바뀌었을 때만, 그것도 예산이 남을 때만 다시 세운다.
    //   못 세우면 조금 낡은 그래프를 계속 쓴다 — 미션 초반에 몰리므로 지연이 정상이다.
    const now = (typeof GAME !== 'undefined') ? GAME.gameTime : 0;
    if (S.graph && !budgetAvailable(now)) { _graphDeferred++; return S.graph; }
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    try {
      const bm = believedMapOf(unit);
      S.graph = bm ? buildTacticalSpatialGraph(bm, { extraOpenings: believedOpenings(S) }) : null;
      S.graphRev = rev;
      _graphBuilds++;
    } catch (e) { S.graph = S.graph || null; }
    if (t0) budgetCharge(performance.now() - t0);
    return S.graph;
  }
  function graphStats() { return { builds: _graphBuilds, deferred: _graphDeferred }; }

  // =========================================================
  // 프레임 예산 — 14명이 같은 프레임에 몰리면 스파이크가 난다.
  //   GAME.gameTime은 한 틱 동안 불변이므로 프레임 식별자로 쓴다.
  // =========================================================
  const FRAME_BUDGET_MS = 2.5;
  let _budgetStamp = -1, _budgetSpent = 0, _budgetDeferred = 0;
  function budgetAvailable(now) {
    if (now !== _budgetStamp) { _budgetStamp = now; _budgetSpent = 0; _budgetDeferred = 0; }
    return _budgetSpent < FRAME_BUDGET_MS;
  }
  function budgetCharge(ms) { _budgetSpent += ms; }
  function budgetDefer() { _budgetDeferred++; }
  function budgetStats() { return { spentMs: +_budgetSpent.toFixed(3), deferred: _budgetDeferred }; }

  // 유닛별 위상 오프셋 — 안 주면 전원이 같은 프레임에 첫 스캔을 돈다
  function phaseOffsetFor(unit, interval) {
    const s = String(unit && unit.id != null ? unit.id : '0');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000 * interval;
  }

  return {
    VERSION, SURFACE_CLASS,
    senseFor, getSnapshotFor, ensureSpatial, runSelfTests, invalidate,
    mirrorToLegacyMemory, budgetAvailable, budgetCharge, budgetDefer, budgetStats, phaseOffsetFor,
    measureAccuracy, measureAll, getDebugSurfaces, believedBodyOf,
    believedCellWalkable, believedWalkClear, believedBodies, believedDoorCost, recordContact,
    findBeliefThresholds, confirmedThresholds, thresholdsOf, thresholdForNoise, believedBarrierAt,
    believedMapOf, beliefGraphOf, beliefRevision, graphStats,
    // 진단/지표 계산에 필요한 내부 접근 (전투 계산은 쓰지 않는다)
    _internal: { allSegments, surfaceSegments, sightMemory, confidenceAt, memoryState,
                 ballisticResistanceEstimate, tauFor, classNameOf, rayScan, rayHit, pointVisible,
                 believedMaterial, materialClassOf, materialKnownLevel, materialResist }
  };
})();

// =============================================================
