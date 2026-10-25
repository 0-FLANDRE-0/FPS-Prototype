// 3d. AMMO / RELOAD / FIREMODE
// =============================================================
const DEFAULT_AMMO_PROFILE = {
  magazineSize: 30,
  reserveMags: 4,
  reloadTime: 2.6,
  tacticalReloadTime: 2.0,
  supportsFireModes: ['semi'],
  defaultFireMode: 'auto',
  burstCount: 3,
  fullAutoCount: 5,
  fullAutoMin: 3,
  fullAutoMax: 8,
  burstShotDelay: 0.07,
};

const FIRE_MODES = ['auto', 'semi', 'burst', 'full'];
const FIRE_MODE_KOR = {
  auto:'AUTO', semi:'SEMI', burst:'BURST', full:'FULL'
};

function getWeaponAmmoProfile(weapon) {
  if (!weapon) return Object.assign({}, DEFAULT_AMMO_PROFILE);
  return {
    magazineSize:       weapon.magazineSize       != null ? weapon.magazineSize       : DEFAULT_AMMO_PROFILE.magazineSize,
    reserveMags:        weapon.reserveMags        != null ? weapon.reserveMags        : DEFAULT_AMMO_PROFILE.reserveMags,
    reloadTime:         weapon.reloadTime         != null ? weapon.reloadTime         : DEFAULT_AMMO_PROFILE.reloadTime,
    tacticalReloadTime: weapon.tacticalReloadTime != null ? weapon.tacticalReloadTime : DEFAULT_AMMO_PROFILE.tacticalReloadTime,
    supportsFireModes:  weapon.supportsFireModes  || DEFAULT_AMMO_PROFILE.supportsFireModes.slice(),
    defaultFireMode:    weapon.defaultFireMode    || DEFAULT_AMMO_PROFILE.defaultFireMode,
    burstCount:         weapon.burstCount         != null ? weapon.burstCount         : DEFAULT_AMMO_PROFILE.burstCount,
    fullAutoCount:      weapon.fullAutoCount      != null ? weapon.fullAutoCount      : DEFAULT_AMMO_PROFILE.fullAutoCount,
    fullAutoMin:        weapon.fullAutoMin        != null ? weapon.fullAutoMin        : DEFAULT_AMMO_PROFILE.fullAutoMin,
    fullAutoMax:        weapon.fullAutoMax        != null ? weapon.fullAutoMax        : DEFAULT_AMMO_PROFILE.fullAutoMax,
    burstShotDelay:     weapon.burstShotDelay     != null ? weapon.burstShotDelay     : DEFAULT_AMMO_PROFILE.burstShotDelay,
    tubeReload:         weapon.tubeReload         != null ? weapon.tubeReload         : (DEFAULT_AMMO_PROFILE.tubeReload || false),
    perShellReloadTime: weapon.perShellReloadTime != null ? weapon.perShellReloadTime : (DEFAULT_AMMO_PROFILE.perShellReloadTime || null),
  };
}

function initUnitAmmo(unit) {
  const w = WEAPONS[unit.weaponId];
  const prof = getWeaponAmmoProfile(w);
  unit.magAmmo = prof.magazineSize;
  unit.reserveAmmo = prof.magazineSize * prof.reserveMags;
  unit.isReloading = false;
  unit.reloadTimer = 0;
  unit.fireModePolicy  = prof.defaultFireMode || 'auto';
  unit.currentFireMode = null;     // 실제 직전 사격에 사용된 fireMode (UI 표시용)
}

// ════════════════════════════════════════════════════════════════════════════
// [0.39.3 A-Closure] Canonical Acute Action Block State — knockdown/stopping 중 모든 행동 경로가
//   공유하는 단일 판정. 신규 사격·예약 연사·투척·reload·switch·이동·자세를 한 곳에서 결정.
//   physiological shock와 무관(급성반응 전용). alias(medical.impactKnockdownTimer)는 읽기 전용.
// ════════════════════════════════════════════════════════════════════════════
function getAcuteActionBlockState(unit) {
  const kd = (unit && (unit.impactKnockdownTimer || 0) > 0);
  const st = (unit && (unit.stoppingTimer || 0) > 0);
  return {
    knockedDown: kd,
    stopping: st,
    blocksNewFire: kd || st,
    interruptsQueuedFire: kd || st,   // 예약 연사 결정적 중단 (확률 아님)
    blocksThrow: kd,
    blocksReloadStart: kd,
    blocksWeaponSwitch: kd,
    blocksNormalMovement: kd,
    forcesProne: kd,
  };
}
function canFireWeapon(unit) {
  if (unit.isDead) return false;
  if (!unit.alive && !unit.isDowned) return false;
  // 처치 중이거나 끌고 있으면 사격 불가
  if (unit.treatmentTimer > 0) return false;
  if (unit.draggingTarget != null) return false;
  // SIDE-WEAPON-INJURY-HANDLING-1A: 최종 판정은 isWeaponSlotUsable. (medical.canShoot로 전체 차단하지 않음)
  if (unit.weaponState && unit.weaponState.switching) return false;
  if (unit._injuryWeaponDisabled) return false;
  if (typeof isWeaponSlotUsable === 'function' && unit.weaponState) {
    if (!isWeaponSlotUsable(unit, unit.weaponState.activeSlot)) return false;
  } else if (unit.medical && (unit.medical.isUnconscious || unit.medical.isDead)) {
    return false;   // weaponState 없는 유닛 fallback
  }
  // downed — 의식 없으면 불가. 의식 있으면 slot 판정이 결정 (downed 자체로 막지 않음)
  if (unit.isDowned && !unit.conscious) return false;
  // arm fracture + 부목 없으면 사격 불가
  if (unit.fracture === 'arm' || unit.fracture === 'multiple') {
    const armSplinted = unit.medical ? (isPartSplinted(unit, 'left_arm') || isPartSplinted(unit, 'right_arm')) : unit.splintApplied;
    if (!armSplinted) return false;
  }
  if (unit.isReloading) return false;
  if (unit.magAmmo <= 0) return false;
  if (unit.fireTimer > 0) return false;
  if (unit.shotQueue) return false;
  if (getAcuteActionBlockState(unit).blocksNewFire) return false;   // [0.39.4] knockdown/stopping 단일 gate (직접 timer 판정 제거)
  return true;
}

function startReload(unit) {
  if (unit.isReloading) return false;
  if (getAcuteActionBlockState(unit).blocksReloadStart) return false;   // [0.39.3 A-Closure] knockdown 중 재장전 시작 불가
  if (unit.reserveAmmo <= 0) return false;
  const w = WEAPONS[unit.weaponId];
  const prof = getWeaponAmmoProfile(w);
  // BUGFIX: 이미 가득 찬 탄창은 재장전하지 않음 (기존 `magAmmo >= 0` 무의미 조건 → 가득참 가드로 교체)
  if (unit.magAmmo >= prof.magazineSize) return false;
  // 진행 중 사격 묶음이 있으면 중단
  if (unit.shotQueue) unit.shotQueue = null;
  if (prof.tubeReload) {
    // 튜브식(샷건) — 한 발씩 장전. 첫 셸 타이머만 설정하고, updateReload가 셸 단위로 채운다.
    const perShell = prof.perShellReloadTime || Math.max(0.45, prof.reloadTime / Math.max(1, prof.magazineSize));
    unit.isReloading = true;
    unit.tubeReloading = true;
    unit._perShellReloadTime = perShell;
    unit.reloadTimer = perShell + 0.25;   // 첫 셸: 무기 내림/파지 약간의 초기 오버헤드
    unit.aimTimer = Math.max(0, unit.aimTimer - 0.4);
    if (unit.team === 'friend') log(`[${unit.name}] 재장전 (셸 장전)`, 'info');
    emitNoise(unit.x, unit.y, { type: 'reload', team: unit.team, sourceUnitId: unit.id });
    return true;
  }
  // 일반 탄창식 — 빈 탄창(longer)/전술 재장전 구분
  unit.reloadTimer = (unit.magAmmo === 0) ? prof.reloadTime : prof.tacticalReloadTime;
  unit.isReloading = true;
  unit.tubeReloading = false;
  unit.aimTimer = Math.max(0, unit.aimTimer - 0.4);   // 재장전 시작 시 조준 흐트러짐
  if (unit.team === 'friend') log(`[${unit.name}] 재장전`, 'info');
  emitNoise(unit.x, unit.y, { type: 'reload', team: unit.team, sourceUnitId: unit.id });
  return true;
}

function updateReload(unit, dt) {
  if (!unit.isReloading) return;
  // medical.reloadMul — 팔 손상/통증/의식 종합 (낮을수록 느림)
  const medMul = (unit.medical && unit.medical.reloadMul != null) ? unit.medical.reloadMul : 1.0;
  let injReloadMul = 1.0;
  if (typeof getWeaponHandlingInjuryModifier === 'function' && unit.weaponState) injReloadMul = getWeaponHandlingInjuryModifier(unit, unit.weaponState.activeSlot).reloadMul;
  unit.reloadTimer -= dt * medMul * injReloadMul;
  if (unit.reloadTimer > 0) return;
  const w = WEAPONS[unit.weaponId];
  const prof = getWeaponAmmoProfile(w);
  if (unit.tubeReloading) {
    // 셸 1발 장전
    if (unit.magAmmo < prof.magazineSize && unit.reserveAmmo > 0) {
      unit.magAmmo += 1;
      unit.reserveAmmo -= 1;
    }
    // 계속 장전할지 결정 — 가득 찼거나 예비 없으면 종료
    if (unit.magAmmo >= prof.magazineSize || unit.reserveAmmo <= 0) {
      unit.isReloading = false;
      unit.tubeReloading = false;
      unit.reloadTimer = 0;
      if (unit.team === 'friend') log(`[${unit.name}] 재장전 완료 (${unit.magAmmo}발)`, 'info');
    } else {
      // 다음 셸
      unit.reloadTimer = unit._perShellReloadTime || Math.max(0.45, prof.reloadTime / Math.max(1, prof.magazineSize));
      emitNoise(unit.x, unit.y, { type: 'reload', team: unit.team, sourceUnitId: unit.id });
    }
    return;
  }
  // 일반 탄창식 — 한 번에 채움
  const need = prof.magazineSize - unit.magAmmo;
  const fill = Math.min(need, unit.reserveAmmo);
  unit.magAmmo += fill;
  unit.reserveAmmo -= fill;
  unit.isReloading = false;
  unit.reloadTimer = 0;
  if (unit.team === 'friend') log(`[${unit.name}] 재장전 완료`, 'info');
}

// 튜브식(샷건) 재장전 중 발사 시도 → 최소 1발 있으면 장전 중단하고 사격 허용
function interruptTubeReloadForFiring(unit) {
  if (unit.isReloading && unit.tubeReloading && unit.magAmmo >= 1) {
    unit.isReloading = false;
    unit.tubeReloading = false;
    unit.reloadTimer = 0;
    return true;
  }
  return false;
}

// fireModePolicy가 auto일 때 상황 기반으로 semi/burst/full 결정
function chooseFireMode(shooter, target, weapon, distance) {
  const policy = shooter.fireModePolicy || 'auto';
  const prof = getWeaponAmmoProfile(weapon);
  const supported = prof.supportsFireModes;

  // 명시 모드 → 지원 여부 확인
  if (policy !== 'auto') {
    if (supported.indexOf(policy) >= 0) return policy;
    // fallback 우선순위
    for (const m of ['semi', 'burst', 'full']) {
      if (supported.indexOf(m) >= 0) return m;
    }
    return 'semi';
  }

  // AUTO — 거리 / aimQuality / 탄약 상태 / 탄약 반동 / 표적 상태 기반 선택
  const aimQuality = shooter._lastAimQuality != null ? shooter._lastAimQuality : 0;
  const ammoFrac = shooter.magAmmo / Math.max(1, prof.magazineSize);
  const targetStance = (target && target.stance) || 'standing';
  const targetMoving = !!(target && target.movePath && target.movePath.length > 0);
  const supp = shooter.suppression || 0;
  const has = (m) => supported.indexOf(m) >= 0;
  // 탄약 반동
  const recoil = (weapon && weapon.recoil) || 0;
  // SIDE-METRIC-SCALE-1: 거리 임계 m 기준 (PX_PER_M 무관)
  //   기본: FULL ≤ 8m / SEMI ≥ 14m
  //   반동 큼: FULL ≤ 6m / SEMI ≥ 12m (짧게 끊고 정확 사격 선호)
  //   반동 매우 큼: FULL ≤ 4m / SEMI ≥ 11m
  let fullDistMax = mToPx(8);
  let semiDistMin = mToPx(14);
  if (recoil >= 1.5)      { fullDistMax = mToPx(4); semiDistMin = mToPx(11); }
  else if (recoil >= 0.8) { fullDistMax = mToPx(6); semiDistMin = mToPx(12); }
  // 급박 상황(낮은 aimQuality + 가까운 거리 + 표적 이동/제압)에서는 FULL 임계 추가 확장
  const urgent = (aimQuality < 0.4) || (supp > 30) || targetMoving;
  if (urgent) fullDistMax += mToPx(3);   // +3 m

  // 탄약이 매우 적으면 SEMI 선호
  if (ammoFrac < 0.20 && has('semi')) return 'semi';

  // 가까운 거리 + 충분한 탄약 → FULL (제압)
  if (distance < fullDistMax && ammoFrac > 0.35 && has('full')) {
    // 표적이 cover/pinned + 거리 멀어지는 쪽 → 정밀한 BURST가 더 적절
    if ((targetStance === 'cover' || targetStance === 'pinned') && distance > 100 && has('burst')) {
      return 'burst';
    }
    return 'full';
  }

  // 장거리 → SEMI (정확)
  if (distance > semiDistMin && has('semi')) return 'semi';

  // 표적이 cover/pinned + 거리 멀음 → SEMI
  if ((targetStance === 'cover' || targetStance === 'pinned') && distance > 200 && has('semi')) return 'semi';

  // 기본 — BURST (균형)
  if (has('burst')) return 'burst';
  if (has('semi'))  return 'semi';
  if (has('full'))  return 'full';
  return 'semi';
}

// 발수 결정
//   SEMI: 1발 고정
//   BURST: weapon.burstCount (기본 3)
//   FULL: 3~8발 사이에서 상황별 결정
//     - 거리 가까움 → 길게 (제압)
//     - 거리 멂 → 짧게
//     - 반동 큰 탄 → 짧게 끊어 쏨
//     - 탄약 부족 → 짧게
//     - aimQuality 낮음 / suppression 높음 → 길게 (급박 대응)
//     - 표적 moving → 길게
function getShotsPerTrigger(weapon, fireMode, ctx) {
  const prof = getWeaponAmmoProfile(weapon);
  if (fireMode === 'semi')  return 1;
  if (fireMode === 'burst') return prof.burstCount  || 3;
  if (fireMode === 'full') {
    const minN = prof.fullAutoMin != null ? prof.fullAutoMin : 3;
    const maxN = prof.fullAutoMax != null ? prof.fullAutoMax : 8;
    if (!ctx) return Math.round((minN + maxN) / 2);
    let n = (minN + maxN) * 0.5;   // 기본 중간
    const dist = ctx.distance != null ? ctx.distance : 100;
    const recoil = (weapon && weapon.recoil) || 0;
    const ammoFrac = ctx.ammoFrac != null ? ctx.ammoFrac : 1.0;
    const aimQ = ctx.aimQuality != null ? ctx.aimQuality : 0.5;
    const supp = ctx.suppression || 0;
    const targetMoving = !!ctx.targetMoving;
    // 거리 — 가까울수록 길게
    if (dist < 60)        n += 2.0;     // ≤3m
    else if (dist < 120)  n += 1.0;     // 3~6m
    else if (dist < 200)  n += 0.0;     // 6~10m
    else if (dist < 300)  n -= 1.5;     // 10~15m
    else                  n -= 2.5;     // 15m+
    // 반동 — 큰 탄은 짧게
    n -= Math.max(0, recoil) * 0.6;
    // 탄약 — 부족하면 짧게
    if (ammoFrac < 0.30) n -= 1.5;
    else if (ammoFrac < 0.50) n -= 0.5;
    // 급박/제압 상황 — 길게
    if (aimQ < 0.4) n += 1.0;
    if (supp > 30)  n += 1.0;
    if (targetMoving) n += 0.8;
    // 약간의 무작위성 — ±1
    n += (Math.random() - 0.5) * 2;
    return Math.max(minN, Math.min(maxN, Math.round(n)));
  }
  return 1;
}

// 발사방식과 탄 순서에 따른 spread 보정 — 누적
//   shotIndex 0(첫 발)은 1.0, 이후 발마다 fireMode에 따라 증가
//   recoil(탄약 반동)이 양수면 누적 spread 증가폭이 더 커진다
function applyFireModeToSpread(baseSpread, fireMode, shotIndex, skill, recoil) {
  // 숙련도 — accuracy 높으면 증가폭 완화
  const accBonus = (skill && skill.accuracy) || 1.0;
  const tame = 1 / Math.max(0.7, accBonus);
  // 탄약 반동 가중 — recoil 0이면 1.0, +2.4(M80)는 약 1.24, -0.7(.223)는 약 0.93
  const r = recoil || 0;
  const recMul = Math.max(0.8, 1 + r * 0.10);

  let mul;
  if (fireMode === 'semi')       mul = 1.0;
  else if (fireMode === 'burst') mul = 1.0 + 0.30 * shotIndex * tame * recMul;
  else if (fireMode === 'full')  mul = 1.0 + 0.50 * shotIndex * tame * recMul;
  else                           mul = 1.0;
  return baseSpread * mul;
}

// 발사방식과 탄 순서에 따른 effectiveAimQuality
//   첫 발은 그대로, 이후 발은 fireMode에 따라 감소
//   recoil이 양수면 감소폭이 더 커진다
function getEffectiveAimQualityForShot(baseAimQuality, fireMode, shotIndex, skill, recoil) {
  const accBonus = (skill && skill.accuracy) || 1.0;
  const tame = 1 / Math.max(0.7, accBonus);
  const r = recoil || 0;
  const recMul = Math.max(0.8, 1 + r * 0.10);

  let drop;
  if (fireMode === 'semi')       drop = 0.0;
  else if (fireMode === 'burst') drop = 0.10 * shotIndex * tame * recMul;
  else if (fireMode === 'full')  drop = 0.18 * shotIndex * tame * recMul;
  else                           drop = 0.0;
  return Math.max(0, baseAimQuality - drop);
}

// 사격 후 aimTimer 흔들림 / 회복
//   recoil이 양수면 추가 흔들림
function applyFireModeAfterShot(shooter, fireMode, shotsFired, recoil) {
  const skill = shooter.skill || {};
  const tame = Math.max(0.7, (skill.accuracy || 1.0));
  let drop = 0;
  if (fireMode === 'semi')       drop = 0.05;
  else if (fireMode === 'burst') drop = 0.15 + 0.06 * Math.max(0, shotsFired - 1);
  else if (fireMode === 'full')  drop = 0.30 + 0.10 * Math.max(0, shotsFired - 1);
  // 반동에 따른 추가 흔들림 — 0.05 계수
  drop += Math.max(0, (recoil || 0)) * 0.05 * shotsFired;
  drop /= tame;
  shooter.aimTimer = Math.max(0, shooter.aimTimer - drop);
}

// =============================================================
