import { Vector3 } from 'three';
import { CATALOG } from './catalog.js';
import { advanceFlight, flightChord, flightProfile, FLIGHT_LIMITS } from './flight.js';
import { computeWoundChannel, woundProfile, WOUND_S1_VALUES, WOUND_S2_VALUES } from './wound-channel.js';
import { S3_TERMINAL_SETTINGS, terminalSettingS3 } from './wound-s3-types.js';

// A display-only measurement of the production model, never a second damage
// model. Registry muzzle speeds and the unchanged RK4/drag are used. Both
// columns share M855 at 10 m as the denominator so distance remains comparable.
export const DAMAGE_INDEX_S3_DEFINITION = Object.freeze({
  ruleId: 'damage-index-s3b', referenceAmmoId: '556_m855', referenceDistanceM: 10,
  distancesM: Object.freeze([10, 300]), measuredDepthM: .3, earlyDepthM: .1,
  densityKgM3: WOUND_S2_VALUES.softDensityKgM3,
  tissue: 'standard muscle-equivalent block; no bone or organs; muscle coefficient from the production wound kernel',
  reference: 'M855 at 10 m (first30cm) = 100 for near, far and early10cm columns; registry reference muzzle speed; manual debug overrides do not alter this table',
  maximumFlightDistanceM: FLIGHT_LIMITS.maxDistanceM,
  maximumBlockDepthM: WOUND_S1_VALUES.maxSteps * WOUND_S1_VALUES.stepM * 16,
  classification: 'automatic game-model index, not a measured biological injury or incapacitation score',
});

const EFFECT_TYPES = new Set(['fragment', 'controlled_fragment', 'barrier_blind', 'frangible', 'expand']);
const finite = value => Number.isFinite(value) ? value : null;

/** Sample horizontal range planes using the exact production RK4 integrator. */
export function damageIndexFlightS3(ammoId) {
  const entry = CATALOG.AMMO_REGISTRY[ammoId], ammo = CATALOG.AMMO_PRESETS[ammoId];
  if (!entry || !ammo) throw Error('Unregistered cartridge: ' + ammoId);
  const setting = terminalSettingS3(ammoId), profile = flightProfile(ammo);
  let position = new Vector3(), velocity = new Vector3(entry.ballistic.velocity, 0, 0), timeS = 0, travelledM = 0;
  const impacts = {}, threshold = setting?.thresholdVelocity, hasThresholdEffect = EFFECT_TYPES.has(setting?.type);
  let effectEndRangeM = hasThresholdEffect && velocity.length() < threshold ? 0 : null;
  // A bisection substep is only an observation inside a production chord; the
  // subsequent flight still starts at that chord's original computed end.
  const atPlane = (start, initial, dt, rangeM) => {
    let lo = 0, hi = dt;
    for (let i = 0; i < 36; i++) {
      const mid = (lo + hi) / 2;
      if (advanceFlight(start, initial, mid, profile).position.x < rangeM) lo = mid; else hi = mid;
    }
    return advanceFlight(start, initial, (lo + hi) / 2, profile);
  };
  for (let i = 0; i < FLIGHT_LIMITS.maxSteps && timeS < FLIGHT_LIMITS.maxTimeS && travelledM < FLIGHT_LIMITS.maxDistanceM; i++) {
    const chord = flightChord(position, velocity.clone().normalize(), velocity.length(), FLIGHT_LIMITS.maxDistanceM - travelledM, profile);
    for (const distanceM of DAMAGE_INDEX_S3_DEFINITION.distancesM) {
      if (!impacts[distanceM] && position.x <= distanceM && chord.position.x >= distanceM) {
        const sample = atPlane(position, velocity, chord.dt, distanceM);
        impacts[distanceM] = Object.freeze({ distanceM, velocityMps: sample.velocity.length(), heightM: sample.position.y });
      }
    }
    if (hasThresholdEffect && effectEndRangeM === null && velocity.length() >= threshold && chord.velocity.length() < threshold) {
      let lo = 0, hi = chord.dt;
      for (let j = 0; j < 36; j++) {
        const mid = (lo + hi) / 2;
        if (advanceFlight(position, velocity, mid, profile).velocity.length() >= threshold) lo = mid; else hi = mid;
      }
      effectEndRangeM = advanceFlight(position, velocity, (lo + hi) / 2, profile).position.x;
    }
    position = chord.position; velocity = chord.velocity;
    timeS += chord.dt; travelledM += chord.length;
  }
  for (const rangeM of DAMAGE_INDEX_S3_DEFINITION.distancesM) if (!impacts[rangeM]) throw Error(`${ammoId} does not reach the ${rangeM} m index plane within production flight limits`);
  return Object.freeze({ impacts: Object.freeze(impacts), effectEndRangeM, hasThresholdEffect,
    effectStillActiveAtFlightLimit: hasThresholdEffect && effectEndRangeM === null,
    observedHorizontalLimitM: position.x, thresholdVelocityMps: hasThresholdEffect ? threshold : null });
}

/** Standard block uses the same authoritative channel as live body impacts. */
export function damageIndexBlockS3(ammoId, entryVelocityMps) {
  const entry = CATALOG.AMMO_REGISTRY[ammoId], p = woundProfile(ammoId);
  const input = { ammoId, entryVelocityMps, massKg: entry.projectile.massG / 1000,
    lengthM: DAMAGE_INDEX_S3_DEFINITION.measuredDepthM, bodyPart: 'chest' };
  let channel = computeWoundChannel(input), occupiedDepthM = channel.stateOut.occupiedDepthM;
  const terminalEffect = channel.s3Terminal;
  const effectiveVolumeCm3 = channel.volumes.effectiveM3 * 1e6;
  let stopped = channel.stopped, fragmented = channel.fragmentation;
  let deformation = Boolean(terminalEffect?.expanded) || channel.steps.some(step => step.deformationAreaScale > 1 + 1e-12);
  let firstYawDepthM = channel.steps.find(step => Math.abs(step.yawRad) > 1e-9)?.depthM ?? null;
  const blockSizeM = WOUND_S1_VALUES.maxSteps * WOUND_S1_VALUES.stepM;
  for (let i = 0; i < 16 && !stopped && occupiedDepthM < DAMAGE_INDEX_S3_DEFINITION.maximumBlockDepthM; i++) {
    const offset = occupiedDepthM;
    channel = computeWoundChannel({ ...input, entryVelocityMps: channel.exitVelocityMps,
      lengthM: Math.min(blockSizeM, DAMAGE_INDEX_S3_DEFINITION.maximumBlockDepthM - offset),
      stateIn: channel.stateOut });
    occupiedDepthM = channel.stateOut.occupiedDepthM;
    if (firstYawDepthM === null) {
      const step = channel.steps.find(step => Math.abs(step.yawRad) > 1e-9);
      if (step) firstYawDepthM = offset + step.depthM;
    }
    stopped = channel.stopped; fragmented ||= channel.fragmentation;
    deformation ||= channel.steps.some(step => step.deformationAreaScale > 1 + 1e-12);
    if (occupiedDepthM <= offset + 1e-12) break;
  }
  return Object.freeze({ entryVelocityMps, effectiveVolumeCm3,
    stopDepthM: stopped ? occupiedDepthM : null, observedBlockDepthM: occupiedDepthM,
    stopped, fragmented, deformation, yawOnsetDepthM: finite(terminalEffect?.yawOnsetDepthM) ?? finite(p.yawOnsetDepthM) ?? firstYawDepthM,
    terminalVelocityMps: channel.exitVelocityMps });
}

export function calculateDamageIndexEntryS3(ammoId, referenceVolumeCm3) {
  const setting = terminalSettingS3(ammoId);
  if (!setting) return null;
  const flight = damageIndexFlightS3(ammoId), near = damageIndexBlockS3(ammoId, flight.impacts[10].velocityMps), far = damageIndexBlockS3(ammoId, flight.impacts[300].velocityMps);
  const denominator = referenceVolumeCm3 ?? damageIndexBlockS3(DAMAGE_INDEX_S3_DEFINITION.referenceAmmoId, damageIndexFlightS3(DAMAGE_INDEX_S3_DEFINITION.referenceAmmoId).impacts[10].velocityMps).effectiveVolumeCm3;
  if (!(denominator > 0)) throw Error('S3 damage index has no positive M855 reference volume');
  const earlyChannel=computeWoundChannel({ammoId,entryVelocityMps:flight.impacts[10].velocityMps,massKg:CATALOG.AMMO_REGISTRY[ammoId].projectile.massG/1000,lengthM:DAMAGE_INDEX_S3_DEFINITION.earlyDepthM,bodyPart:'chest'}),earlyVolumeCm3=earlyChannel.volumes.effectiveM3*1e6;
  return Object.freeze({ ammoId, grade: setting.grade, type: setting.type, thresholdVelocityMps: setting.thresholdVelocity,
    donorProfileId: setting.donorProfileId, referenceVolumeCm3: denominator,
    near: Object.freeze({ ...near, distanceM: 10, index: near.effectiveVolumeCm3 / denominator * 100 }),
    early: Object.freeze({distanceM:10,depthM:.1,entryVelocityMps:flight.impacts[10].velocityMps,effectiveVolumeCm3:earlyVolumeCm3,index:earlyVolumeCm3/denominator*100}),
    far: Object.freeze({ ...far, distanceM: 300, index: far.effectiveVolumeCm3 / denominator * 100 }), flight });
}

const started = performance.now();
const referenceFlight = damageIndexFlightS3(DAMAGE_INDEX_S3_DEFINITION.referenceAmmoId);
const referenceVolumeCm3 = damageIndexBlockS3(DAMAGE_INDEX_S3_DEFINITION.referenceAmmoId, referenceFlight.impacts[10].velocityMps).effectiveVolumeCm3;
export const DAMAGE_INDICES_S3 = Object.freeze(Object.fromEntries(Object.keys(S3_TERMINAL_SETTINGS).map(id => [id, calculateDamageIndexEntryS3(id, referenceVolumeCm3)])));
export const DAMAGE_INDEX_S3_INFO = Object.freeze({ ...DAMAGE_INDEX_S3_DEFINITION, cartridges: Object.keys(DAMAGE_INDICES_S3).length,
  uncalibratedCartridges: Object.keys(CATALOG.AMMO_REGISTRY).length - Object.keys(DAMAGE_INDICES_S3).length,
  referenceVolumeCm3, loadTimeMs: performance.now() - started, cache: 'once at module load; no per-frame or per-material recalculation' });
export const S3_DAMAGE_INDICES = DAMAGE_INDICES_S3;
export const S3_DAMAGE_INDEX_VALUES = DAMAGE_INDEX_S3_INFO;
export function damageIndexS3(ammoId) { return DAMAGE_INDICES_S3[ammoId] || null; }
