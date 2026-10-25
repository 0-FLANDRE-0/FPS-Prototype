// SIDE-DUST-CLOUD-VISUAL-1: 전장 먼지구름 시각 시스템 (시야/AI/명중/피해 미연결 — 순수 렌더 레이어)
//   모든 먼지는 동일한 dustCloud 구조. 차이는 개수/radius/density/spread/decay/색상/drift로만 표현.
// =============================================================
const FLOOR_DUST_PROFILES = {
  // dustAmount(0~2 상대량), color[r,g,b], linger(잔류 배수), spread(확산 배수)
  concrete:       { dustAmount:1.00, color:[150,150,150], linger:1.00, spread:1.00 },
  drywall_dust:   { dustAmount:1.60, color:[225,222,214], linger:1.40, spread:1.40 },
  drywall:        { dustAmount:1.60, color:[225,222,214], linger:1.40, spread:1.40 },
  plaster:        { dustAmount:1.60, color:[230,226,218], linger:1.40, spread:1.35 },
  rubble:         { dustAmount:2.00, color:[140,125,110], linger:1.35, spread:1.20 },
  dirt:           { dustAmount:2.00, color:[132,100,70],  linger:1.20, spread:1.40 },
  sand:           { dustAmount:2.00, color:[202,180,120], linger:1.00, spread:1.50 },
  compacted_dirt: { dustAmount:1.30, color:[122,95,70],   linger:1.00, spread:1.00 },
  wood:           { dustAmount:1.00, color:[162,132,92],  linger:1.00, spread:1.00 },
  carpet:         { dustAmount:0.60, color:[92,90,95],    linger:0.70, spread:0.70 },
  tile:           { dustAmount:0.50, color:[200,200,206], linger:0.60, spread:0.70 },
  metal:          { dustAmount:0.25, color:[112,116,120], linger:0.60, spread:0.60 },
  steel:          { dustAmount:0.25, color:[112,116,120], linger:0.60, spread:0.60 },
  thin_metal:     { dustAmount:0.30, color:[120,124,128], linger:0.60, spread:0.60 },
  glass:          { dustAmount:0.45, color:[198,205,210], linger:0.55, spread:0.65 },
  ceramic:        { dustAmount:1.10, color:[205,200,195], linger:0.90, spread:1.00 },
  wet_floor:      { dustAmount:0.05, color:[90,95,100],   linger:0.30, spread:0.40 },
  default:        { dustAmount:1.00, color:[150,150,150], linger:1.00, spread:1.00 },
};
function getFloorDustProfile(material) {
  return FLOOR_DUST_PROFILES[material] || FLOOR_DUST_PROFILES[(material || '').toLowerCase()] || FLOOR_DUST_PROFILES.default;
}
// 방 조회 — **오직 "이 자리의 방 이름이 무엇인가"에만 쓴다.**
//   AI가 방의 형상이나 문턱을 여기서 읽으면 안 된다. 그건 믿음(S.thresholds)에서 나온다.
//   방이 저작되지 않은 맵은 null — 그런 맵에서는 방 기반 행동이 그냥 안 켜진다.
function roomAt(x, y) {
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (!M || !Array.isArray(M.rooms)) return null;
  for (const r of M.rooms) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}
function roomById(id) {
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (!M || !Array.isArray(M.rooms) || !id) return null;
  return M.rooms.find(r => r.id === id) || null;
}
// 바닥 재질 조회 — floorZones(사각 영역) 우선, 없으면 맵 기본, 없으면 concrete
function getFloorMaterialAt(x, y) {
  const M = (typeof MAP_DATA !== 'undefined') ? MAP_DATA : null;
  if (M && M.floorZones) {
    // SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목8): 뒤에서부터 순회 → 나중에 칠한 floorZone 우선
    for (let i = M.floorZones.length - 1; i >= 0; i--) {
      const z = M.floorZones[i];
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.material;
    }
  }
  return (M && M.floorDefaultMaterial) || 'concrete';
}
// 주변 원형 영역 재질 혼합 샘플링 (단일 조회 아님)
function sampleFloorMaterialsInRadius(x, y, radius, sampleCount) {
  const n = Math.max(1, sampleCount || 9);
  const counts = {};
  let total = 0;
  // 중심 1 + 동심원 샘플
  const addS = (sx, sy) => { const m = getFloorMaterialAt(sx, sy); counts[m] = (counts[m] || 0) + 1; total++; };
  addS(x, y);
  const rings = 2, perRing = Math.max(1, Math.floor((n - 1) / rings));
  for (let r = 1; r <= rings; r++) {
    const rr = radius * (r / rings);
    for (let i = 0; i < perRing; i++) {
      const a = (i / perRing) * Math.PI * 2 + r * 0.7;
      addS(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  const materialWeights = {};
  for (const m in counts) materialWeights[m] = counts[m] / total;
  const blended = blendFloorDustProfiles(materialWeights);
  return { materialWeights, blendedDustAmount: blended.dustAmount, blendedColor: blended.color, blendedLinger: blended.linger, blendedSpread: blended.spread };
}
// 재질 가중 → 혼합 dust 프로파일
function blendFloorDustProfiles(materialWeights) {
  let amt = 0, ling = 0, spr = 0, cr = 0, cg = 0, cb = 0, wsum = 0;
  for (const m in materialWeights) {
    const w = materialWeights[m], p = getFloorDustProfile(m);
    amt += p.dustAmount * w; ling += p.linger * w; spr += p.spread * w;
    cr += p.color[0] * w; cg += p.color[1] * w; cb += p.color[2] * w; wsum += w;
  }
  if (wsum <= 0) { const d = FLOOR_DUST_PROFILES.default; return { dustAmount:d.dustAmount, linger:d.linger, spread:d.spread, color:d.color.slice() }; }
  return { dustAmount: amt / wsum, linger: ling / wsum, spread: spr / wsum, color: [Math.round(cr / wsum), Math.round(cg / wsum), Math.round(cb / wsum)] };
}

// ---- 주변 구조물(벽/엄폐물) 먼지 영향 ----
function sampleNearbyWallDustContributors(x, y, radius) {
  const out = { count: 0, materialWeights: {} };
  if (typeof MAP_DATA === 'undefined' || !MAP_DATA.walls) return out;
  const r2 = radius * radius;
  for (const w of MAP_DATA.walls) {
    const cx = Math.max(w.x, Math.min(x, w.x + w.w)), cy = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r2) { out.count++; const m = w.material || 'concrete'; out.materialWeights[m] = (out.materialWeights[m] || 0) + 1; }
  }
  return out;
}
function sampleNearbyCoverDustContributors(x, y, radius) {
  const out = { count: 0, breakableCount: 0, fullCoverCount: 0, halfCoverCount: 0, solidCount: 0, materialWeights: {} };
  if (typeof MAP_DATA === 'undefined' || !MAP_DATA.coverObjects) return out;
  const r2 = radius * radius;
  for (const o of MAP_DATA.coverObjects) {
    const cx = Math.max(o.x, Math.min(x, o.x + o.w)), cy = Math.max(o.y, Math.min(y, o.y + o.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r2) { out.count++; const m = o.material || 'wood'; out.materialWeights[m] = (out.materialWeights[m] || 0) + 1;
      if (o.penetrable !== false || /drywall|wood|glass|plaster|rubble/.test(m)) out.breakableCount++;
      const isFull = (o.blocksLOS === true || o.category === 'fullCover');
      if (o.halfHeight) out.halfCoverCount++; else if (isFull) out.fullCoverCount++;
      if (o.penetrable === false) out.solidCount++; }
  }
  return out;
}
// 재질 → 먼지 생성 기여 배수 (구조물 파괴 시 먼지량)
function _materialDustContribMul(material) {
  const p = getFloorDustProfile(material);
  return p.dustAmount;   // 바닥 프로파일의 dustAmount를 구조물 기여로 재사용
}
function sampleEnvironmentalDustContext(x, y, radius, opts) {
  opts = opts || {};
  const floor = sampleFloorMaterialsInRadius(x, y, radius, opts.floorSamples || 9);
  const wallC = sampleNearbyWallDustContributors(x, y, radius);
  const coverC = sampleNearbyCoverDustContributors(x, y, radius);
  // 주변 재질 가중 혼합 (벽+엄폐물)
  const nearbyMaterialWeights = {}; let nbTot = 0;
  for (const m in wallC.materialWeights) { nearbyMaterialWeights[m] = (nearbyMaterialWeights[m] || 0) + wallC.materialWeights[m]; nbTot += wallC.materialWeights[m]; }
  for (const m in coverC.materialWeights) { nearbyMaterialWeights[m] = (nearbyMaterialWeights[m] || 0) + coverC.materialWeights[m]; nbTot += coverC.materialWeights[m]; }
  if (nbTot > 0) for (const m in nearbyMaterialWeights) nearbyMaterialWeights[m] /= nbTot;
  // 주변 재질 기반 먼지 배수
  let nearbyMatMul = 0, nbw = 0;
  for (const m in nearbyMaterialWeights) { nearbyMatMul += _materialDustContribMul(m) * nearbyMaterialWeights[m]; nbw += nearbyMaterialWeights[m]; }
  nearbyMatMul = nbw > 0 ? nearbyMatMul / nbw : 1.0;
  // clutter(장애물 밀도), confinement(협소도) — 벽/엄폐물 많을수록 ↑
  const clutterFactor = Math.min(1.0, (wallC.count * 0.10 + coverC.count * 0.14));
  const confinementFactor = Math.min(1.0, wallC.count * 0.09);
  const context = {
    floorWeights: floor.materialWeights, nearbyWallCount: wallC.count, nearbyCoverCount: coverC.count,
    nearbyBreakableCount: coverC.breakableCount, nearbyFullCoverCount: coverC.fullCoverCount, nearbyHalfCoverCount: coverC.halfCoverCount,
    nearbySolidCoverCount: coverC.solidCount, nearbyMaterialWeights, clutterFactor, confinementFactor,
    floorDustMul: floor.blendedDustAmount, nearbyMatMul, blendedColor: floor.blendedColor,
    blendedLinger: floor.blendedLinger, blendedSpread: floor.blendedSpread,
  };
  const m = computeEnvironmentalDustMultiplier(context);
  context.environmentalDustMul = m.environmentalDustMul;
  context.wallDustMul = m.wallDustMul; context.coverDustMul = m.coverDustMul; context.lingerMul = m.lingerMul;
  // 환경 색상 혼합 (바닥색 + 주변 구조물색 약간)
  let cr = floor.blendedColor[0], cg = floor.blendedColor[1], cb = floor.blendedColor[2];
  if (nbw > 0) { const nb = blendFloorDustProfiles(nearbyMaterialWeights).color; cr = Math.round(cr * 0.7 + nb[0] * 0.3); cg = Math.round(cg * 0.7 + nb[1] * 0.3); cb = Math.round(cb * 0.7 + nb[2] * 0.3); }
  context.environmentalColorMix = [cr, cg, cb];
  return context;
}
function computeEnvironmentalDustMultiplier(context) {
  // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 벽/fullCover/breakable 강화, 폭발 최대 3.0
  const wallDustMul = 1.0 + context.nearbyWallCount * 0.09;
  const fullCoverN = context.nearbyFullCoverCount != null ? context.nearbyFullCoverCount : context.nearbyCoverCount;
  const halfCoverN = context.nearbyHalfCoverCount || 0;
  const coverDustMul = 1.0 + fullCoverN * 0.10 + halfCoverN * 0.03 + (context.nearbyBreakableCount || 0) * 0.08;
  const floorDustMul = context.floorDustMul != null ? context.floorDustMul : 1.0;
  const nearbyMatMul = context.nearbyMatMul != null ? context.nearbyMatMul : 1.0;
  // 좁고 복잡할수록 잔류↑ (강화)
  const lingerMul = (context.blendedLinger || 1.0) * (1.0 + context.confinementFactor * 0.7 + context.clutterFactor * 0.45);
  let environmentalDustMul = floorDustMul * (0.55 + 0.55 * nearbyMatMul) * wallDustMul * coverDustMul;
  environmentalDustMul = Math.max(0.05, Math.min(3.0, environmentalDustMul));   // 폭발 한정 최대 3.0
  return { environmentalDustMul, wallDustMul, coverDustMul, floorDustMul, lingerMul };
}


// ---- dustCloud 생성 / 생명주기 ----
function _dustAlphaFromDensity(c) {
  const lifeFrac = c.maxLife > 0 ? Math.max(0, c.life / c.maxLife) : 1;
  const fadeIn = Math.min(1, (c.maxLife - c.life) / 0.25);   // 0.25s 페이드인 (불쑥 안 튀게)
  const a = c.density * 0.55 * Math.min(1, lifeFrac * 1.4) * fadeIn;
  return Math.max(0, Math.min(0.5, a));
}
function spawnDustCloud(opts) {
  opts = opts || {};
  const density = opts.density != null ? opts.density : 0.45;
  const startR = opts.startRadius != null ? opts.startRadius : 10;
  const c = {
    id: 'dust_' + (GAME._dustSeq = (GAME._dustSeq || 0) + 1), type: 'dust',
    x: opts.x || 0, y: opts.y || 0,
    startRadius: startR, radius: startR, maxRadius: opts.maxRadius != null ? opts.maxRadius : 50,
    density, initialDensity: density, visualAlpha: 0,
    visibilityDensity: density, visibilityFalloff: opts.visibilityFalloff != null ? opts.visibilityFalloff : 1.0,
    life: opts.life != null ? opts.life : 2.4, maxLife: opts.life != null ? opts.life : 2.4,
    vx: opts.vx || 0, vy: opts.vy || 0,
    spreadRate: opts.spreadRate != null ? opts.spreadRate : 1.0,
    decayRate: opts.decayRate != null ? opts.decayRate : 0.42,
    floorMaterialWeights: opts.floorMaterialWeights || null, nearbyMaterialWeights: opts.nearbyMaterialWeights || null,
    dustColor: opts.dustColor || [150, 150, 150],
    sourceType: opts.sourceType || 'dust', sourcePower: opts.sourcePower != null ? opts.sourcePower : 1.0,
    environmentalDustMul: opts.environmentalDustMul != null ? opts.environmentalDustMul : 1.0,
    clipMode: opts.clipMode || 'radial_wall', clipSegments: opts.clipSegments || 32,
    clipRadii: null, clipDirty: true, clipUpdateTimer: 0, clipUpdateInterval: 0.15,
    createdAt: (typeof GAME !== 'undefined' ? GAME.gameTime : 0),
    _lastClipX: opts.x || 0, _lastClipY: opts.y || 0, _lastClipR: 0,
  };
  c.visualAlpha = _dustAlphaFromDensity(c);
  GAME.dustClouds.push(c);
  // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 성능 상한 — 초과 시 옅고 오래된 cloud부터 제거
  if (GAME.dustClouds.length > MAX_DUST_CLOUDS) _evictDustClouds();
  return c;
}
// 연막 — 부산물이 아니라 **목적제**다. 구조는 먼지와 같고 규모만 한 자릿수 크다.
//   실측: 반경 5 m · 밀도 1.0이라야 10 m 사선에서 시야가 끊긴다(od 1.10).
//   기존 먼지 한 덩이는 반경 0.6 m · 밀도 0.36으로 od 0.015 — 사실상 0이다.
//   피어오름: 처음엔 작고 옅다가 커진다. 던지자마자 벽이 서면 그건 연막이 아니다.
const USE_SMOKE = true;
function isSmokeOn() {
  if (typeof GAME !== 'undefined' && GAME.smokeOn != null) return !!GAME.smokeOn;
  return USE_SMOKE;
}
const SMOKE_RADIUS_M = 5.0, SMOKE_DENSITY = 1.05, SMOKE_LIFE = 26.0;
// 피어오름은 `updateDustClouds`의 성장식이 정한다:
//   radius += (max-r) * min(1, spreadRate*dt*0.9) + spreadRate*4*dt
//   **min(1, ...)이 포화하면 한 틱에 만재가 된다.** 반경/시간으로 계산한 값(13.3)이 정확히 그랬다.
//   지수 접근의 시정수가 1/(spreadRate*0.9)이므로, ~3초 피어오름은 0.9 근처다.
const SMOKE_SPREAD_RATE = 0.9;
function spawnSmokeCloud(x, y, opts) {
  opts = opts || {};
  const rM = opts.radiusM != null ? opts.radiusM : SMOKE_RADIUS_M;
  const maxR = rM * PX_PER_M_FALLBACK;
  const c = spawnDustCloud({
    x, y,
    density: opts.density != null ? opts.density : SMOKE_DENSITY,
    startRadius: Math.max(10, maxR * 0.15),
    maxRadius: maxR,
    life: opts.life != null ? opts.life : SMOKE_LIFE,
    spreadRate: SMOKE_SPREAD_RATE,
    decayRate: 0.012,                                        // 거의 안 옅어진다 — 오래 서 있는 게 연막의 값이다
    dustColor: opts.color || [205, 205, 210],
    sourceType: 'smoke',
    clipMode: 'radial_wall',                                 // 벽을 넘지 않는다 (먼지와 같은 규칙)
  });
  c.obscurant = true;   // 상한을 받지 않는 쪽 — 차단은 연막의 일이다
  return c;
}
const MAX_DUST_CLOUDS = 240;
function _evictDustClouds() {
  const arr = GAME.dustClouds;
  if (arr.length <= MAX_DUST_CLOUDS) return;
  arr.sort((a, b) => (a.density + a.life / (a.maxLife || 1)) - (b.density + b.life / (b.maxLife || 1)));   // 낮은 점수(옅고 수명짧음) 먼저
  arr.splice(0, arr.length - MAX_DUST_CLOUDS);
}
// 하나의 사건 → 여러 cloud (중심 근처 클러스터·겹침 — 무분별 분산 아님)
function emitDustBurst(x, y, opts) {
  opts = opts || {};
  if (typeof GAME === 'undefined' || !GAME.dustClouds) return [];
  const env = opts.env || sampleEnvironmentalDustContext(x, y, opts.envRadius || 80, {});
  const power = opts.power != null ? opts.power : 1.0;
  const count = Math.max(1, opts.count || 2);
  const baseR = opts.baseRadius || 30;
  const spreadDist = opts.spreadDist != null ? opts.spreadDist : baseR * 0.8;
  const color = opts.color || env.environmentalColorMix || env.blendedColor || [150, 150, 150];
  const envMul = env.environmentalDustMul || 1.0;
  const lingerMul = env.lingerMul || 1.0;
  const out = [];
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const distFrac = opts.tightCluster ? Math.pow(Math.random(), 1.6) : Math.random();
    const dist = distFrac * spreadDist;
    const ox = x + Math.cos(ang) * dist, oy = y + Math.sin(ang) * dist;
    const sizeJ = 0.7 + _cosmeticRand() * 0.7, densJ = 0.65 + _cosmeticRand() * 0.6;
    const maxR = baseR * sizeJ * (0.85 + 0.3 * power);
    const dens = (opts.density != null ? opts.density : 0.42) * densJ * Math.min(1.6, envMul);
    const driftSpd = (opts.drift != null ? opts.drift : 6) * (0.4 + _cosmeticRand() * 0.8);
    out.push(spawnDustCloud({
      x: ox, y: oy, startRadius: maxR * (0.35 + Math.random() * 0.2), maxRadius: maxR,
      density: Math.min(0.72, dens), life: (opts.life || 2.4) * lingerMul * (0.8 + Math.random() * 0.5),
      vx: Math.cos(ang) * driftSpd + (opts.vx || 0), vy: Math.sin(ang) * driftSpd + (opts.vy || 0),
      spreadRate: (opts.spreadRate || 1.0) * (env.blendedSpread || 1.0) * (0.8 + Math.random() * 0.5),
      decayRate: (opts.decayRate || 0.42) / Math.max(0.5, lingerMul),
      dustColor: [color[0], color[1], color[2]], sourceType: opts.sourceType || 'dust', sourcePower: power,
      environmentalDustMul: envMul, floorMaterialWeights: env.floorWeights, nearbyMaterialWeights: env.nearbyMaterialWeights,
      clipSegments: opts.clipSegments || 32,
    }));
  }
  return out;
}
// 폭발 먼지 — 단일 대형 원이 아니라 여러 cloud 묶음 (총 ≥10)
// SIDE-VISUAL-UNIT-GRENADE-DUST-HOTFIX-1 (항목4,5): 수류탄 폭발 먼지 프로파일 (일반 explosion보다 넓고·많고·짙고·오래)
const GRENADE_EXPLOSION_DUST = { centerCount:[4,6], outerCount:[8,14], pushCount:[4,8], radiusMul:1.55, densityMul:1.55, lifeMul:1.30, spreadMul:1.40, envMulMax:3.4, visibilityDensityMul:1.45 };
function _emitExplosionDust(x, y, opts) {
  opts = opts || {};
  const power = opts.power != null ? opts.power : 1.0;
  const blastR = opts.blastRadius || 90;
  const G = opts.isGrenade ? (opts.grenadeProfile || GRENADE_EXPLOSION_DUST) : null;
  const env = sampleEnvironmentalDustContext(x, y, blastR, { floorSamples: 15 });
  let envMul = env.environmentalDustMul || 1.0;
  if (G) envMul = Math.min(G.envMulMax || 3.4, envMul * 1.13);   // 수류탄: 환경 배율 상한 3.4
  const floorAmt = env.floorDustMul || 1.0;
  const color = opts.color || env.environmentalColorMix || [150, 150, 150];
  const rMul = G ? G.radiusMul : 1.0, dMul = G ? G.densityMul : 1.0, lMul = G ? G.lifeMul : 1.0, sMul = G ? G.spreadMul : 1.0;
  const gEnv = G ? Object.assign({}, env, { environmentalDustMul: envMul }) : env;
  const out = [];
  // 바닥 재질 기반 개수 배수 (rubble/dirt/sand↑) — tile/metal은 개수 유지하되 density/life로 적게
  const matCountMul = Math.max(1.0, Math.min(1.8, floorAmt));
  const envBonus = Math.round((env.nearbyWallCount * 0.5 + (env.nearbyFullCoverCount || 0) * 0.7 + (env.nearbyBreakableCount || 0) * 0.5) * Math.min(1.6, envMul));
  const rnd = (a, b) => a + Math.floor(_cosmeticRand() * (b - a + 1));
  // 1) 중심부 진한 cloud (수류탄 4~6 / 일반 3~5)
  const nCenter = Math.round((G ? rnd(G.centerCount[0], G.centerCount[1]) : (3 + Math.floor(_cosmeticRand() * 3))) * matCountMul);
  for (let i = 0; i < nCenter; i++) emitDustBurst(x, y, { count: 1, baseRadius: blastR * (0.30 + _cosmeticRand() * 0.15) * (0.7 + 0.5 * power) * rMul, spreadDist: blastR * 0.12 * sMul, density: 0.52 * dMul, life: 4.4 * lMul, drift: 5, decayRate: 0.26, sourceType: 'explosion', power, color, env: gEnv, tightCluster: true }).forEach(c => out.push(c));
  // 2) 주변부 넓고 옅은 cloud (수류탄 8~14 / 일반 5~9) + 환경 가산
  const nOuter = Math.round((G ? rnd(G.outerCount[0], G.outerCount[1]) : (5 + Math.floor(_cosmeticRand() * 4))) * matCountMul) + Math.min(G ? 12 : 8, envBonus);
  for (let i = 0; i < nOuter; i++) {
    const ang = _cosmeticRand() * Math.PI * 2, dist = blastR * (0.2 + _cosmeticRand() * 0.6) * (G ? 1.15 : 1.0);
    emitDustBurst(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, { count: 1, baseRadius: blastR * (0.22 + _cosmeticRand() * 0.18) * rMul, spreadDist: blastR * 0.1 * sMul, density: 0.3 * dMul, life: 3.8 * lMul, drift: 8, decayRate: 0.34, sourceType: 'explosion', power, color, env: gEnv, vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6 }).forEach(c => out.push(c));
  }
  // 3) 파편/충격 방향 밀려나는 cloud (수류탄 4~8 / 일반 2~4)
  const nPush = G ? rnd(G.pushCount[0], G.pushCount[1]) : (2 + Math.floor(Math.random() * 3));
  for (let i = 0; i < nPush; i++) {
    const ang = Math.random() * Math.PI * 2;
    emitDustBurst(x + Math.cos(ang) * blastR * 0.3, y + Math.sin(ang) * blastR * 0.3, { count: 1, baseRadius: blastR * 0.2 * rMul, spreadDist: blastR * 0.08 * sMul, density: 0.32 * dMul, life: 3.4 * lMul, drift: 22, sourceType: 'explosion', power, color, env: gEnv, vx: Math.cos(ang) * 20, vy: Math.sin(ang) * 20 }).forEach(c => out.push(c));
  }
  return out;   // 일반 ≥10 / 수류탄 16~34
}
// 행위 타입 → 먼지 파라미터
// SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: sourceType별 life/density/radius 차등 + life ≥1.5배 강화
const DUST_SOURCE_PROFILES = {
  muzzle_fire:   { countBase:1, countRand:2, baseRadius:16, spreadDist:10, density:0.22, life:1.8, drift:10, tightCluster:true },
  bullet_impact: { countBase:2, countRand:2, baseRadius:20, spreadDist:14, density:0.36, life:2.9, drift:8 },
  ricochet:      { countBase:1, countRand:1, baseRadius:16, spreadDist:12, density:0.26, life:2.2, drift:14 },
  armor_hit:     { countBase:1, countRand:1, baseRadius:14, spreadDist:8,  density:0.24, life:1.9, drift:6 },
  armor_spall:   { countBase:1, countRand:2, baseRadius:14, spreadDist:10, density:0.28, life:2.1, drift:8 },
  movement_dust: { countBase:1, countRand:0, baseRadius:18, spreadDist:10, density:0.16, life:1.9, drift:6 },
  debris_fall:   { countBase:2, countRand:3, baseRadius:22, spreadDist:28, density:0.34, life:3.6, drift:5 },
};
function emitDustFromAction(actionType, x, y, opts) {
  opts = opts || {};
  if (typeof GAME === 'undefined' || !GAME.dustClouds) return [];
  if (actionType === 'explosion') return _emitExplosionDust(x, y, opts);
  const prof = DUST_SOURCE_PROFILES[actionType] || { countBase:2, countRand:1, baseRadius:20, spreadDist:14, density:0.3, life:2.0, drift:8 };
  // 환경 샘플링 (바닥 + 주변 구조물) — 먼지량/색/잔류 결정 (sampleFloorMaterialsInRadius 기반)
  const env = sampleEnvironmentalDustContext(x, y, opts.envRadius || (prof.baseRadius * 2.2), {});
  const envMul = env.environmentalDustMul || 1.0;
  // 재질·환경 기반 cloud 개수 보정 (clamp 0.7~2.0)
  let count = prof.countBase + Math.floor(Math.random() * (prof.countRand + 1));
  count = Math.max(1, Math.round(count * Math.min(2.0, Math.max(0.7, (env.floorDustMul || 1.0) * 0.5 + envMul * 0.5))));
  const p = { count, baseRadius: prof.baseRadius, spreadDist: prof.spreadDist, density: prof.density, life: prof.life, drift: prof.drift,
    tightCluster: prof.tightCluster, sourceType: actionType, env, power: opts.power != null ? opts.power : 1.0 };
  // ceramic/glass 장갑 → 밝은 분진 증가
  if ((actionType === 'armor_hit' || actionType === 'armor_spall') && opts.armorMaterial && /ceramic|glass/.test((opts.armorMaterial || '').toLowerCase())) { p.density *= 1.3; p.count += 1; }
  if (opts.suppressed && actionType === 'muzzle_fire') { p.count = Math.max(1, p.count - 1); p.density *= 0.5; p.baseRadius *= 0.7; }
  if (opts.color) p.color = opts.color;
  if (opts.override) Object.assign(p, opts.override);
  return emitDustBurst(x, y, p);
}
// SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 이동 먼지 — 먼지 잘 나는 바닥에서만, 하중(무게) 비례
function _maybeEmitMovementDust(unit, ox, oy, nx, ny) {
  if (typeof emitDustFromAction !== 'function' || typeof getFloorMaterialAt !== 'function') return;
  if (!unit || unit.isDead) return;
  const step = Math.hypot(nx - ox, ny - oy);
  if (step <= 0) return;
  unit._dustStepAccum = (unit._dustStepAccum || 0) + step;
  if (unit._dustStepAccum < 26) return;   // 보폭 ~26px마다 1회 평가
  unit._dustStepAccum = 0;
  const prof = getFloorDustProfile(getFloorMaterialAt(nx, ny));
  if (!prof || prof.dustAmount < 1.2) return;   // 먼지 잘 나는 바닥만 (흙/모래/잔해/다짐흙/석고). 콘크리트/타일/금속/목재/젖은바닥 등은 거의 안 남
  const loadKg = unit.loadWeightKg || 0;
  const weightMul = Math.max(0.6, Math.min(1.9, 0.7 + loadKg / 22));   // 하중(무게) 비례 — 무거울수록 ↑
  const dens = 0.14 * weightMul * Math.min(1.4, prof.dustAmount / 1.6);
  emitDustFromAction('movement_dust', nx, ny, { power: 0.4 * weightMul, override: { density: dens, count: (loadKg >= 15 ? 2 : 1) } });
}
function _dustPointBlocked(x, y) {
  if (typeof MAP_DATA === 'undefined') return false;
  if (MAP_DATA.walls) for (const w of MAP_DATA.walls) { if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true; }
  // SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1 (항목9): fullCover/닫힌문/시야차단 엄폐물도 이동 차단 (halfCover는 통과)
  if (MAP_DATA.coverObjects) for (const o of MAP_DATA.coverObjects) { if (isDustBlockingObject(o) && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return true; }
  return false;
}
function updateDustClouds(dt) {
  if (typeof GAME === 'undefined' || !GAME.dustClouds || !GAME.dustClouds.length) return;
  const arr = GAME.dustClouds;
  for (let i = arr.length - 1; i >= 0; i--) {
    const c = arr[i];
    c.life -= dt;
    if (c.radius < c.maxRadius) { c.radius += (c.maxRadius - c.radius) * Math.min(1, c.spreadRate * dt * 0.9) + c.spreadRate * 4 * dt; if (c.radius > c.maxRadius) c.radius = c.maxRadius; }
    c.density *= Math.max(0, 1 - c.decayRate * dt);
    c.visibilityDensity = c.density;
    c.visualAlpha = _dustAlphaFromDensity(c);
    if (c.vx || c.vy) {
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (!_dustPointBlocked(nx, ny)) { c.x = nx; c.y = ny; } else { c.vx *= 0.2; c.vy *= 0.2; }
      c.vx *= (1 - 0.6 * dt); c.vy *= (1 - 0.6 * dt);
    }
    if (Math.abs(c.radius - c._lastClipR) > 6 || (Math.abs(c.x - c._lastClipX) + Math.abs(c.y - c._lastClipY)) > 8) c.clipDirty = true;
    if (c.life <= 0 || c.visualAlpha <= 0.01 || c.density <= 0.01) arr.splice(i, 1);
  }
}

// ---- 먼지구름 벽 클리핑 (렌더링만 — 시야 판정 미연결) ----
function isDustBlockingObject(obj) {
  if (!obj) return false;
  if (obj.isDoor) return obj.closed === true;        // 닫힌 문만 차단
  if (obj.halfHeight) return false;                  // halfCover/낮은 엄폐물 제외
  if (obj.blocksLOS === true) return true;
  if (obj.category === 'fullCover') return true;
  if (obj.penetrable === false) return true;         // solid wall류
  return false;
}
function rayDistanceToDustBlocker(x, y, angle, maxDist) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = maxDist;
  if (typeof rayDistToWalls === 'function') { const w = rayDistToWalls(x, y, dx, dy, maxDist); if (w && w.t < best) best = w.t; }
  if (typeof MAP_DATA !== 'undefined' && MAP_DATA.coverObjects && typeof rayBoxT === 'function') {
    for (const o of MAP_DATA.coverObjects) { if (!isDustBlockingObject(o)) continue; const t = rayBoxT(x, y, dx, dy, o, maxDist); if (t < best) best = t; }
  }
  return best;
}
function buildDustClipProfile(cloud) {
  const seg = cloud.clipSegments || 32;
  const radii = new Array(seg);
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; const d = rayDistanceToDustBlocker(cloud.x, cloud.y, a, cloud.radius); radii[i] = Math.max(0, Math.min(cloud.radius, d)); }
  cloud.clipRadii = radii; cloud.clipDirty = false;
  cloud._lastClipX = cloud.x; cloud._lastClipY = cloud.y; cloud._lastClipR = cloud.radius;
}
function updateDustClipProfileIfNeeded(cloud, dt) {
  cloud.clipUpdateTimer = (cloud.clipUpdateTimer || 0) + (dt || 0);
  if (cloud.clipDirty || !cloud.clipRadii || cloud.clipUpdateTimer >= (cloud.clipUpdateInterval || 0.15)) { cloud.clipUpdateTimer = 0; buildDustClipProfile(cloud); }
}
function _dustGradient(ctx, c) {
  const g = ctx.createRadialGradient(c.x, c.y, Math.max(0.1, c.radius * 0.1), c.x, c.y, Math.max(1, c.radius));
  const col = c.dustColor || [150, 150, 150], a = c.visualAlpha;
  g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
  g.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.5})`);
  g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
  return g;
}
function _renderDustSimple(ctx, c) { ctx.fillStyle = _dustGradient(ctx, c); ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill(); }
function renderDustCloudClipped(ctx, cloud) {
  const radii = cloud.clipRadii;
  if (!radii) { _renderDustSimple(ctx, cloud); return; }
  const seg = radii.length;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= seg; i++) { const idx = i % seg; const a = (idx / seg) * Math.PI * 2; const r = Math.max(0.5, radii[idx]); const px = cloud.x + Math.cos(a) * r, py = cloud.y + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = _dustGradient(ctx, cloud);
  ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// SIDE-DUST-FLOOR-PLACEMENT-HOTFIX-1: 바닥 재질 구역 시각 표시 (배치모드 진하게/전투 약하게)
function renderFloorMaterialZones(ctx) {
  if (typeof MAP_DATA === 'undefined' || !MAP_DATA.floorZones || !MAP_DATA.floorZones.length) return;
  const placing = (typeof GAME !== 'undefined' && GAME.placementMode);
  const alpha = placing ? 0.28 : 0.07;
  const sc = (typeof view !== 'undefined' && view.scale) ? view.scale : 1;
  ctx.save();
  for (const z of MAP_DATA.floorZones) {
    const c = getFloorDustProfile(z.material).color;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    if (placing) {
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.6, alpha + 0.25)})`;
      ctx.lineWidth = 1 / sc;
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = 'rgba(225,230,235,0.55)';
      ctx.font = `${11 / sc}px ui-monospace, monospace`;
      ctx.fillText(z.material, z.x + 4 / sc, z.y + 13 / sc);
    }
  }
  ctx.restore();
}
// ---- SIDE-BALLISTIC-COVER-WALL-GATE-HOTFIX-1B (항목9-15): 먼지 시야 디버프 (탄도/파편 미연결 — 시야/식별만) ----
function isPointWithinDustClipProfile(cloud, x, y) {
  if (!cloud.clipRadii) return true;
  const dx = x - cloud.x, dy = y - cloud.y;
  const dist = Math.hypot(dx, dy);
  if (dist > cloud.radius) return false;
  const seg = cloud.clipRadii.length;
  let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2;
  const idx = Math.round(a / (Math.PI * 2) * seg) % seg;
  return dist <= cloud.clipRadii[idx];   // 벽 너머(잘린 방향)는 false
}
function isPointInsideVisibleDustCloud(cloud, x, y) {
  if (!cloud || cloud.visualAlpha <= 0.01 || cloud.density < 0.03) return false;
  const d = Math.hypot(x - cloud.x, y - cloud.y);
  if (d > cloud.radius) return false;
  if (cloud.clipMode === 'radial_wall' && !isPointWithinDustClipProfile(cloud, x, y)) return false;
  return true;
}
// 파편 먼지와 목적제 연막을 **따로 센다.**
//   합산에 상한이 없어서, 한 지점에 8발만 쏴도 구름 25개가 쌓여 지금도 시야가 끊긴다
//   (실측: od 0.366 · 최고밀도 ≥1.10 → dust_blocked). 소총 사격이 우발적 연막을 만드는 셈이다.
//   그래서 부산물 먼지는 **흐리게만** 하고(상한), 차단은 연막이 하도록 나눈다.
const DUST_VISION_CAP = 0.55;   // 부산물 먼지 합산 상한 — 이 값이면 가시배율 하한이 ~0.6, 차단은 못 한다
function sampleDustAtPoint(x, y) {
  const out = { density: 0, opacity: 0, strongestCloud: null, cloudCount: 0, materialMix: null,
                dustDensity: 0, smokeDensity: 0 };
  if (typeof GAME === 'undefined' || !GAME.dustClouds) return out;
  let maxC = 0, dustSum = 0, smokeSum = 0;
  for (const c of GAME.dustClouds) {
    if (c.density < 0.03 || c.visualAlpha <= 0.01) continue;
    const d = Math.hypot(x - c.x, y - c.y);
    if (d > c.radius) continue;
    if (c.clipMode === 'radial_wall' && !isPointWithinDustClipProfile(c, x, y)) continue;   // 벽 너머 먼지는 시야에도 미반영
    const falloff = Math.max(0, 1 - d / c.radius);
    const contrib = c.density * (0.35 + 0.65 * falloff * falloff);   // 중심 강, 외곽 약
    if (c.obscurant) smokeSum += contrib; else dustSum += contrib;
    out.cloudCount++;
    if (contrib > maxC) { maxC = contrib; out.strongestCloud = c; }
  }
  out.dustDensity = Math.min(DUST_VISION_CAP, dustSum);
  out.smokeDensity = smokeSum;
  out.density = out.dustDensity + smokeSum;
  out.opacity = Math.min(1, out.density);
  return out;
}
function computeDustVisibilityPenalty(dustSample) {
  const od = dustSample.opticalDepth || 0;
  const peak = dustSample.peakDensity || 0;
  const visibilityMul = Math.max(0.20, Math.min(1.0, 1.0 - od * 0.75));
  const blocksVision = (od >= 0.95 || peak >= 1.10);
  return { visibilityMul, blocksVision };
}
function sampleDustAlongLOS(x1, y1, x2, y2, opts) {
  opts = opts || {};
  const out = { opticalDepth: 0, averageDensity: 0, peakDensity: 0, dustedFraction: 0, cloudHits: 0, visibilityMul: 1.0, blocksVision: false, reason: 'dust' };
  if (typeof GAME === 'undefined' || !GAME.dustClouds || !GAME.dustClouds.length) return out;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist < 1) return out;
  const spacing = opts.spacing || 12;
  let n = Math.max(6, Math.min(48, Math.round(dist / spacing)));
  let sum = 0, peak = 0, dusted = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
    const s = sampleDustAtPoint(px, py);
    sum += s.density;
    if (s.density > peak) peak = s.density;
    if (s.density > 0.04) dusted++;
    if (s.cloudCount > 0) out.cloudHits++;
  }
  const samples = n + 1;
  out.averageDensity = sum / samples;
  out.peakDensity = peak;
  out.dustedFraction = dusted / samples;
  out.opticalDepth = out.averageDensity * (0.5 + 0.5 * out.dustedFraction) * (1 + out.dustedFraction);
  const pen = computeDustVisibilityPenalty(out);
  out.visibilityMul = pen.visibilityMul;
  out.blocksVision = pen.blocksVision;
  return out;
}
function renderDustClouds(ctx) {
  if (typeof GAME === 'undefined' || !GAME.dustClouds || !GAME.dustClouds.length) return;
  ctx.save();
  for (const c of GAME.dustClouds) {
    if (c.visualAlpha <= 0.01) continue;
    if (c.density < 0.04 || c.clipMode !== 'radial_wall') { _renderDustSimple(ctx, c); continue; }
    updateDustClipProfileIfNeeded(c, 0);
    renderDustCloudClipped(ctx, c);
  }
  ctx.restore();
}
// SIDE-DUST-CLOUD-VISUAL-1 끝


// =============================================================
