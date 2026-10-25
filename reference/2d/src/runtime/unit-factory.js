function makeUnit(opts) {
  // 팀 로드아웃 적용 — 명시적으로 opts에 지정된 값이 우선
  const teamLoadout = opts.loadout || (GAME.loadout && GAME.loadout[opts.team]) || {};   // SIDE-PER-OPERATOR-LOADOUT-1: 대원별 resolved loadout 우선
  // 팀 숙련도 적용
  const teamSkillCfg = (GAME.teamSkill && GAME.teamSkill[opts.team]) || {};
  const skillPreset = opts.skill || getSkillPreset(teamSkillCfg.presetId);
  const skill = {
    presetId: skillPreset.id || 'regular',
    presetName: skillPreset.name || '정규병',
    reaction: skillPreset.reaction != null ? skillPreset.reaction : 1.0,
    aimSpeed: skillPreset.aimSpeed != null ? skillPreset.aimSpeed : 1.0,
    accuracy: skillPreset.accuracy != null ? skillPreset.accuracy : 1.0,
    weakspot: skillPreset.weakspot != null ? skillPreset.weakspot : 1.0,
  };
  const u = {
    id: nextUnitId++,
    team: opts.team,
    name: opts.name,
    x: opts.x, y: opts.y,
    facing: opts.facing || 0,

    alive: true,
    hp: 100, maxHp: 100,
    // === 부위별 체력제 ===
    //   각 부위는 정상=100. 0이면 기능상실/치명.
    //   부위 손상은 woundSeverity로 누적, 일부는 전체 hp로 흘려 보낸다.
    bodyHp: { head: 100, neck: 100, chest: 100, abdomen: 100, arms: 100, legs: 100,
              left_arm: 100, right_arm: 100, left_leg: 100, right_leg: 100 },
    bodyHpMax: { head: 100, chest: 100, abdomen: 100, arms: 100, legs: 100 },
    // 전투 상태 — active(정상) / wounded(부상) / downed(전투불능, 살아있음) / dead(사망)
    combatState: 'active',
    isDowned: false,
    isDead: false,
    conscious: true,             // downed 상태에서 의식 여부
    canBeDragged: false,         // 끌고가기 대상 여부 (downed이면 true)
    draggedBy: null,             // 나를 끌고 있는 유닛 id
    draggingTarget: null,        // 내가 끌고 있는 유닛 id
    // === 응급처치 / 상태이상 ===
    bleeding: 'none',            // none / light / heavy / critical
    bleedingLoc: null,           // 출혈 부위 (arms/legs/abdomen/chest/head)
    bleedingTime: 0,             // 출혈 누적 시간
    fracture: 'none',            // none / arm / leg / chest / multiple
    painkillerActive: false,
    painkillerTimer: 0,          // 효과 잔여 시간 (초)
    painkillerDelay: 0,          // 발동 전 지연 (초)
    tourniquetAppliedAt: 0,      // 지혈대 적용 시각 (gameTime) — pain 증가 곡선 시작점
    tourniquetActive: false,
    stabilized: false,
    treatmentTimer: 0,           // 처치 중 잔여 시간 (초)
    treatmentTotal: 0,           // 처치 총 시간 (진행률 계산용)
    treatmentType: null,         // 'bandage' / 'tourniquet' / 'splint' / 'painkiller' / 'stabilizer'
    beingTreatedBy: null,        // 처치 중인 대원 id (자가처치면 자기 id)
    treatingTarget: null,        // 처치 시술 중인 대상 id
    pendingMedic: null,          // 접근 후 자동 실행할 처치/끌기 예약
                                 // { type:'treat'|'drag', targetId, treatType?, location? }
    pendingDoor: null,           // 접근 후 자동 개방할 문 예약 { door, t, manual, want }
    pendingPeek: null,           // 힐끗 보고 돌아오는 왕복 예약 { phase, fromX/Y, exX/Y, watchX/Y, ... }
    pendingFrag: null,           // 던지고 터진 뒤 진입하는 다단계 계획 { phase, th, spot, ... }
    flashBlindTimer: 0,          // 섬광 — 시야 상실 잔여(초). 감각기관 스캔도 멈춘다
    flashDeafTimer: 0,           // 섬광 — 청각 상실 잔여(초)
    // === 투척 장비 인벤토리 ===
    //   throwables: { [throwableId]: count } — 미래 확장 (다양한 수류탄/연막/섬광 등)
    //   기본 지급은 initUnitThrowables에서 처리
    throwables: {},
    throwState: null,            // 투척 진행 상태 { id, targetX, targetY, prepTimer, flightTimer, ... }
    // === 자세 + 수류탄 반응 ===
    stance: 'standing',          // 'standing' | 'prone'
    forcedProneTimer: 0,         // 강제 엎드림 잔여 시간 (초)
    spawnedAt: GAME.gameTime || 0,   // 스폰 시각 — 스폰 직후 grace period
    lastRoomEntryTime: null,         // 방 진입 시각 — 진입 직후 grace
    stanceTime: 0,                   // 현재 stance 지속 시간
    proneTime: 0,                    // prone 지속 시간 (proneTime != stanceTime 별도)
    grenadeReactedIds: null,     // Set<throwableInstanceId> — 이미 반응한 수류탄
    grenadeReactionCooldown: 0,  // 새 반응 가능까지 (초)
    grenadeReactionDelay: 0,     // 반응 결정 지연 (초)
    pendingGrenadeReact: null,   // { type:'evade'|'prone', grenadeRef, panicked? }

    // === Utility AI (점수 기반 행동 선택 레이어) ===
    aiIntent: 'none',            // 현재 의도: 'engage' | 'seekCover' | 'holdCover' | 'retreat' | 'goProne' | 'reload' | 'investigateNoise' | 'holdAngle' | 'reposition' | 'reassess' | 'guardNoise' | 'crawlToCover' | 'none'
    aiAction: null,              // { type, startedAt, minDuration, targetX, targetY, reason, score, afterAction }
    aiUtilityNext: 0,            // 다음 판단 시간 (GAME.gameTime 기준)
    aiUtilityDebug: null,        // { topActions: [...], picked, ctxSummary }
    _aiCommandPath: null,        // Utility AI가 발급한 명령 (플레이어 명령과 구분)
    aiState: 'idle',             // === 상태 머신 (호환 유지): idle/alert/investigateNoise/searchNoise/contact/suppressed/downed
    aiStateTimer: 0,             // 현재 상태 진입 시각 (gameTime). 상태 머문 시간 계산용.
    aiSearchTimer: 0,            // searchNoise 잔여 시간
    aiStateLogged: '',           // 마지막 로그된 상태 (중복 방지)
    _aiCoverTarget: null,        // {x,y} 자동 엄폐 대상 위치
    _aiCoverTimer: 0,            // 엄폐 시도 쿨다운
    downedTime: 0,               // downed 상태 진입 후 경과 시간 (초) — 명중률 회복용
    _playerPathBackup: null,     // 자동 엄폐 시 플레이어 명령 백업 — 도착 후 복귀
    _lastReportedConscious: true,
    _lastReportedState: null,
    // === 저지력 / 고통 (1차) ===
    //   stoppingTimer — 피격 직후 짧게 행동 방해 (초)
    //   pain — 누적 고통 0~100. 시간에 따라 천천히 감소.
    pain: 0,
    stoppingTimer: 0,
    _painReportedTier: 0,   // 큰 고통 변화 로그용 (0/30/60 단계)
    suppression: 0,
    pinned: false,
    stance: 'standing',

    sightRange: SIGHT_RANGE,
    viewArc: opts.team === 'friend' ? VIEW_ARC_FRIEND : VIEW_ARC_ENEMY,
    fireArc: opts.team === 'friend' ? FIRE_ARC_FRIEND : FIRE_ARC_ENEMY,
    // SIDE-METRIC-SCALE-1 §8: 이동속도는 m/s가 기준 (legacy 75/55/35/30 px÷20 = 3.75/2.75/1.75/1.5 m/s). px/s는 파생.
    moveSpeedMps: opts.team === 'friend' ? 3.75 : 2.75,
    moveSpeedEngagedMps: opts.team === 'friend' ? 1.75 : 1.5,
    moveSpeed: mToPx(opts.team === 'friend' ? 3.75 : 2.75),         // px/s 파생 (기존 코드 호환)
    moveSpeedEngaged: mToPx(opts.team === 'friend' ? 1.75 : 1.5),

    weaponId:    _resolveLoadoutWeaponId(opts.weaponId || teamLoadout.weaponId || (opts.team === 'friend' ? 'm4a1' : 'akm')),
    ammoId:      opts.ammoId      || teamLoadout.ammoId      || '556_m855',
    bodyArmorId: opts.bodyArmorId || teamLoadout.bodyArmorId || (opts.team === 'friend' ? 'iotv_test' : 'armor_6b23_test'),
    helmetId:    opts.helmetId    || teamLoadout.helmetId    || (opts.team === 'friend' ? 'mich_test' : 'helmet_6b47_test'),
    // 플레이트 — 방호 정보 탭에서 선택. loadout 또는 opts에서 전달
    frontPlateId: opts.frontPlateId || teamLoadout.frontPlateId || 'no_front_plate',
    backPlateId:  opts.backPlateId  || teamLoadout.backPlateId  || 'no_back_plate',
    sidePlateId:  opts.sidePlateId  || teamLoadout.sidePlateId  || 'no_side_plate',
    // 추가 보호구
    groinGuardId:    opts.groinGuardId    || teamLoadout.groinGuardId    || 'no_groin_guard',
    shoulderGuardId: opts.shoulderGuardId || teamLoadout.shoulderGuardId || 'no_shoulder_guard',
    neckGuardId:     opts.neckGuardId     || teamLoadout.neckGuardId     || 'no_neck_guard',
    visorId:         opts.visorId         || teamLoadout.visorId         || 'no_visor',
    slaapId:         opts.slaapId         || teamLoadout.slaapId         || 'no_slaap',

    skill,

    aimTimer: 0,
    fireTimer: 0,
    currentTarget: null,

    // 디버그용 — 마지막 사격의 명중률/거리/조준안정도
    _lastAimQuality: 0,
    _lastHitChance: 0,
    _lastDistanceFactor: 1.0,

    _spotted: false,
    _lastSeenAt: -999,

    movePath: [],
    homeFacing: opts.facing || 0,

    // === Range / passive target (이번 작업) ===
    //   role: 'reactive' (대응사격) | 'passive' (사격 X — 사격장 표적)
    //   spawnX/Y/Facing: 재생성 시 사용
    //   respawnDelay/respawnTimer: passive 사망 후 재생성
    role: opts.role || (opts.team === 'enemy' ? 'reactive' : 'reactive'),
    // 성향 — "무엇을 하고 싶나". 숙련도와 축이 다르다 (아래 rollTraits 주석 참조).
    traits: opts.traits || rollTraits(opts),
    spawnX: opts.x, spawnY: opts.y, spawnFacing: opts.facing || 0,
    respawnDelay: opts.role === 'passive' ? 4.0 : 0,
    respawnTimer: 0,

    // === 수동 사격 ===
    //   manualFireTarget: {x, y} 또는 null. 한 번의 trigger로 처리되고 클리어.
    manualFireTarget: null,
    // === 사격 큐 (BURST/FULL 시간차 발사용) ===
    //   shotQueue가 있으면 매 프레임 shotTimer를 감소시키고
    //   0이 되면 fireSingleShot()으로 1발씩 발사한다.
    shotQueue: null,   // null | { fireMode, shotsRemaining, shotDelay, shotTimer,
                       //         targetX, targetY, targetId, baseAng, baseSpread,
                       //         baseAimQuality, weaponId, totalShots }

    // === Threat Awareness (이번 작업) ===
    // 적별 마지막 위치 기억: { [enemyId]: { id, x, y, time, confidence } }
    lastKnownEnemies: {},
    // 탄이 스쳤거나 피격 받았을 때의 위협 방향 (radians, 또는 null)
    threatDirection: null,
    threatTime: -999,
    threatTimer: 0,
    // === 소음 시스템 ===
    lastHeardNoise: null,       // { x, y, time, confidence, type, sourceTeam }
    footstepTimer: 0,           // 발소리 step interval 카운터
    // 마지막 도착한 waypoint의 facing 유지값 (movePath 비었을 때)
    _holdFacing: null,
    // 견제사격 쿨다운
    _suppressFireTimer: 0,
    // 엄호사격 쿨다운 (coverMate 중 제압사격)
    _coverFireTimer: 0,
    // 디버그/UI용 — 현재 시선이 어디를 향하는 이유
    _aimType: 'idle',
  };
  // 탄창/재장전/발사방식 초기화
  // SIDE-WEAPON-PLATFORM-1A §11: weaponState(주/보조 슬롯 + build) 초기화 — legacy weaponId/ammoId/mag/reserve와 동기화
  if (typeof initializeWeaponStateFromLoadout === 'function') {
    try { initializeWeaponStateFromLoadout(u, teamLoadout); } catch (e) { if (typeof console !== 'undefined') console.warn('weaponState init 실패', e && e.message); }
  }
  initUnitAmmo(u);
  // 장비 무게 초기화 (loadWeightKg / loadClass 캐시)
  updateUnitWeight(u);
  // 방어구 내구도 초기화
  rebuildArmorDurability(u);
  // 기본 투척 장비 — 대원별 resolved loadout 기반 (GAME.loadout 재참조 금지)
  if (!u.throwables || Object.keys(u.throwables).length === 0) {
    const lethalId = teamLoadout && teamLoadout.lethalGrenadeId;
    const lethalCount = teamLoadout && teamLoadout.lethalGrenadeCount != null ? teamLoadout.lethalGrenadeCount : 1;
    u.throwables = {};
    if (lethalId && lethalId !== 'none' && THROWABLE_PRESETS[lethalId] && lethalCount > 0) {
      u.throwables[lethalId] = lethalCount;
    }
    const stunId = teamLoadout && teamLoadout.stunGrenadeId;
    const stunCount = teamLoadout && teamLoadout.stunGrenadeCount != null ? teamLoadout.stunGrenadeCount : 0;
    if (stunId && stunId !== 'none' && THROWABLE_PRESETS[stunId] && stunCount > 0) {
      u.throwables[stunId] = stunCount;
    }
    const smokeId = teamLoadout && teamLoadout.smokeGrenadeId;
    const smokeCount = teamLoadout && teamLoadout.smokeGrenadeCount != null ? teamLoadout.smokeGrenadeCount : 0;
    if (smokeId && smokeId !== 'none' && THROWABLE_PRESETS[smokeId] && smokeCount > 0) {
      u.throwables[smokeId] = smokeCount;
    }
  }
  u.loadoutKey = opts.loadoutKey || null;            // SIDE-PER-OPERATOR-LOADOUT-1
  u.loadoutSource = opts.loadoutSource || null;
  u.loadoutSnapshot = cloneLoadoutForOperator(teamLoadout);
  // === Medical 시스템 초기화 ===
  u.medical = createMedical();
  initMedicalResources(u);   // SIDE-MEDICAL-FIELDCARE-RESOURCE-1 §1: 현장 처치 자원
  recalcMedicalSummary(u);
  // SIDE-AMMO-1B-HOTFIX-2: 인체 관통 저항 scaffold (현재 Mk211 신관 판단 전용, 후속 의료 trajectory 연결용)
  u.bodyResistanceProfile = {
    profileId: 'human_default', enabled: true, futureMedicalTrajectoryHook: true,
    usedCurrentlyFor: ['mk211_fuze_only'],
    directionMul: BODY_HIT_DIRECTION_RESISTANCE_MUL, partResistance: BODY_PART_RESISTANCE_TABLE,
  };
  return u;
}

// =============================================================
// rebuildArmorDurability — 장비 ID들로부터 내구도 슬롯 재구성
// =============================================================
//   장착/장비 변경/미션 시작 시 호출. 기존 내구도가 있으면 덮어쓴다.
//   슬롯 키:
//     chest_front_hard / chest_rear_hard / abdomen_front_hard / abdomen_rear_hard
//     chest_left_hard / chest_right_hard / abdomen_left_hard / abdomen_right_hard
//     chest_front_soft / chest_rear_soft / chest_left_soft / chest_right_soft
//     abdomen_front_soft / abdomen_rear_soft
//     left_arm_soft / right_arm_soft / neck_soft / groin_soft
//     head_skull_shell / head_temporal_shell / head_face_visor / head_front_slaap
function rebuildArmorDurability(unit) {
  if (!unit) return;
  unit.armorDurability = {};
  const ba = unit.bodyArmorId ? BODY_ARMOR_PRESETS[unit.bodyArmorId] : null;
  const hm = unit.helmetId ? HELMET_PRESETS[unit.helmetId] : null;

  // Soft armor — 방탄복 자체 (전/후/좌/우)
  if (ba && ba.softMaxDurability) {
    const mat = (ba.coverage && ba.coverage.chest && ba.coverage.chest.soft && ba.coverage.chest.soft.material) || 'aramid';
    const m = ba.softMaxDurability;
    // 부위별 분리. 같은 max 공유.
    for (const k of ['chest_front_soft','chest_rear_soft','chest_left_soft','chest_right_soft',
                     'abdomen_front_soft','abdomen_rear_soft']) {
      unit.armorDurability[k] = { current: m, max: m, material: mat, sourceId: ba.id };
    }
  }

  // Plates — front / back / side
  // SIDE-KORUND-FRONTSET §3.4: frontSet은 slot별 분리 max, 그 외는 maxDurability fallback
  function getPlateMaxDurabilityForSlot(plate, slotKey) {
    if (!plate) return 50;
    if (plate.frontSetSlotMax && plate.frontSetSlotMax[slotKey] != null) return plate.frontSetSlotMax[slotKey];
    if (plate.slotMax && plate.slotMax[slotKey] != null) return plate.slotMax[slotKey];
    return plate.maxDurability || 50;
  }
  function addPlateDurability(slotKey, plateId) {
    if (!plateId) return;
    const p = PLATE_PRESETS[plateId];
    if (!p || p.isNone) return;
    const max = getPlateMaxDurabilityForSlot(p, slotKey);   // §3.4 frontSet slot별 분리
    unit.armorDurability[slotKey] = {
      current: max, max,
      material: p.material || 'composite',
      sourceId: plateId,
    };
  }
  // 6B23 frontSet: chest_front + abdomen_front 둘 다
  const fp = unit.frontPlateId ? PLATE_PRESETS[unit.frontPlateId] : null;
  if (fp && !fp.isNone) {
    if (fp.slotType === 'frontSet') {
      addPlateDurability('chest_front_hard', unit.frontPlateId);
      addPlateDurability('abdomen_front_hard', unit.frontPlateId);
    } else {
      addPlateDurability('chest_front_hard', unit.frontPlateId);
    }
  }
  // back
  addPlateDurability('chest_rear_hard', unit.backPlateId);
  // side: 좌/우 한 장씩 — left_side_hard / right_side_hard 통합 슬롯
  //   chest_left / abdomen_left 피격은 모두 left_side_hard를 참조한다.
  //   chest_right / abdomen_right 피격은 모두 right_side_hard를 참조한다.
  if (unit.sidePlateId && PLATE_PRESETS[unit.sidePlateId] && !PLATE_PRESETS[unit.sidePlateId].isNone) {
    addPlateDurability('left_side_hard',  unit.sidePlateId);
    addPlateDurability('right_side_hard', unit.sidePlateId);
  }

  // Police Vest 등 고정 알루미늄 — bodyArmor coverage에 hardArmor 있으면 hard slot 생성
  if (ba && ba.coverage) {
    function ensureHardFromArmor(slotKey, covKey) {
      if (unit.armorDurability[slotKey]) return;   // plate가 이미 있으면 skip
      const c = ba.coverage[covKey];
      if (!c || !c.hard || !c.hard.smallArmor || c.hard.smallArmor <= 0) return;
      const max = ba.softMaxDurability || 50;
      unit.armorDurability[slotKey] = {
        current: max, max,
        material: c.hard.material || 'aluminum',
        sourceId: ba.id + ':fixed',
      };
    }
    ensureHardFromArmor('chest_front_hard',   'chest_front');
    ensureHardFromArmor('chest_rear_hard',    'chest_rear');
    ensureHardFromArmor('abdomen_front_hard', 'abdomen_front');
    ensureHardFromArmor('abdomen_rear_hard',  'abdomen_rear');
  }

  // 헬멧
  if (hm && hm.maxDurability) {
    const skullMat = (hm.head_skull && hm.head_skull.hard && hm.head_skull.hard.material) || 'aramid';
    const tempMat = (hm.head_temporal && hm.head_temporal.hard && hm.head_temporal.hard.material) || skullMat;
    const m = hm.maxDurability;
    unit.armorDurability.head_skull_shell    = { current: m, max: m, material: skullMat, sourceId: unit.helmetId };
    unit.armorDurability.head_temporal_shell = { current: m, max: m, material: tempMat,  sourceId: unit.helmetId };
  }

  // 추가 보호구
  function addAccDurability(slotKey, accId) {
    if (!accId) return;
    const a = PROTECTION_ACCESSORY_PRESETS[accId];
    if (!a || a.isNone) return;
    const max = a.maxDurability || 25;
    unit.armorDurability[slotKey] = {
      current: max, max,
      material: a.material || 'aramid',
      durabilityMaterial: a.durabilityMaterial || a.material || 'aramid',
      sourceId: accId,
    };
  }
  addAccDurability('groin_soft',      unit.groinGuardId);
  addAccDurability('neck_soft',       unit.neckGuardId);
  // shoulder: 좌/우 분리 (한 쌍이지만 내구도는 좌/우)
  if (unit.shoulderGuardId && PROTECTION_ACCESSORY_PRESETS[unit.shoulderGuardId]
      && !PROTECTION_ACCESSORY_PRESETS[unit.shoulderGuardId].isNone) {
    addAccDurability('left_arm_soft',  unit.shoulderGuardId);
    addAccDurability('right_arm_soft', unit.shoulderGuardId);
  }
  // 바이저 — PRETRAUMA-STAB-1 §4.3 A안: visorHitTable이면 슬롯은 'mixed'(분류/표시용) shared pool 유지.
  //   실제 손상/곡선 계산은 피격 zone의 durabilityMaterial(glass/titanium)이 protection._zoneDurabilityMaterial로 항상 우선.
  //   zone별 별도 내구도 풀 분리는 다음 패치 TODO.
  if (unit.visorId && PROTECTION_ACCESSORY_PRESETS[unit.visorId]
      && !PROTECTION_ACCESSORY_PRESETS[unit.visorId].isNone) {
    const v = PROTECTION_ACCESSORY_PRESETS[unit.visorId];
    const max = v.maxDurability || 28;
    unit.armorDurability.head_face_visor = {
      current: max, max,
      material: v.material || 'pe',
      durabilityMaterial: v.durabilityMaterial || (v.visorHitTable ? 'mixed' : v.material) || 'pe',
      sourceId: unit.visorId,
    };
  }
  addAccDurability('head_front_slaap', unit.slaapId);
  // 2A-6.2: 바이저 시야/분리내구도 상태 초기화
  try { initUnitVisorState(unit); } catch (e) {}
}

// =============================================================
