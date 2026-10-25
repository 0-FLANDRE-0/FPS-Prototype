import { Vector3 } from 'three';

// New 3D game tuning, not certified 6B47 performance or original CQB constants.
// An unconfigured helmet has no extra ricochet roll. Add each item explicitly.
export const HELMET_RICOCHET_RULE_ID = 'helmet-surface-glancing-v1';
export const HELMET_RICOCHET_PROFILES = Object.freeze({
  helmet_6b47_test: Object.freeze({ onsetDeg: 55, fullDeg: 85, maximumChance: .65,
    cleanBelow: .18, gougeAbove: .55, minimumWearMul: .2, maximumWearMul: 2 }),
});
export const HELMET_RICOCHET_LABELS = Object.freeze({ clean: '튕김', scrape: '긁힘 후 도탄', gouge: '파고듦 후 도탄' });
const clamp = x => Math.max(0, Math.min(1, x));

// Helmet-only deterministic stream. The legacy first LCG draw varies slowly
// across consecutive shot IDs; keep legacy rolls intact and diffuse this seed.
export function helmetShotRandom(shotId) {
  let seed = (shotId ^ 0x6b47a21) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = Math.imul(seed ^ seed >>> 15, seed | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function helmetRicochetCandidate(contact, s, effectiveArmor, effectivePen, durabilityMul, legacy) {
  const profile = HELMET_RICOCHET_PROFILES[contact.itemId];
  const result = { ruleId: HELMET_RICOCHET_RULE_ID, eligible: false, chance: 0, roll: null, ricocheted: false };
  if (!profile || contact.exitingSurface || contact.exitingHead || contact.startsInside || effectiveArmor <= 0 || s.pen <= 0 || s.velocity <= 0) return result;
  const direction = new Vector3(...(contact.incomingDirection || [])), normal = new Vector3(...(contact.normal || []));
  if (![...direction.toArray(), ...normal.toArray()].every(Number.isFinite) || direction.lengthSq() < 1e-12 || normal.lengthSq() < 1e-12) return result;
  direction.normalize(); normal.normalize();
  const cosine = Math.min(1, Math.abs(direction.dot(normal))), incidenceDeg = Math.acos(cosine) * 180 / Math.PI;
  result.incidenceDeg = incidenceDeg;
  if (incidenceDeg <= profile.onsetDeg) return result;
  const t = clamp((incidenceDeg - profile.onsetDeg) / (profile.fullDeg - profile.onsetDeg));
  const angleMul = t * t * (3 - 2 * t);
  // Original ammo/material traits, with neutral 2D zone/side approximations.
  // Actual 3D incidence replaces the original zone curvature bonus.
  const hint = legacy.computeRicochetHint({ armorLayer: 'helmet', coverageZone: 'helmetShell', material: contact.material }, s.ammo, 'stopped');
  // Relative normal threat is an embed-severity proxy, never a depth in mm.
  const normalThreatRatio = Math.max(0, effectivePen / effectiveArmor * cosine ** 2);
  const overmatchMul = clamp(2 - normalThreatRatio);
  const chance = Math.min(profile.maximumChance, profile.maximumChance * angleMul *
    (hint.baseAmmoRicochet || 0) / .1 * hint.ammoRicochetMul * hint.materialMul * clamp(durabilityMul) * overmatchMul);
  return { ...result, eligible: chance > 0, chance, incidenceDeg, normalThreatRatio,
    severity: clamp(normalThreatRatio), angleMul, overmatchMul, profile,
    ammoSource: hint.ammoSource, ammoRicochetMul: hint.ammoRicochetMul, materialMul: hint.materialMul };
}

export function applyHelmetRicochet(candidate, contact, s, protection, ballistic) {
  const { severity, profile } = candidate;
  const degree = severity < profile.cleanBelow ? 'clean' : severity < profile.gougeAbove ? 'scrape' : 'gouge';
  const direction = new Vector3(...contact.incomingDirection).normalize(), normal = new Vector3(...contact.normal).normalize();
  if (direction.dot(normal) > 0) normal.negate();
  const dot = direction.dot(normal), tangent = direction.clone().addScaledVector(normal, -dot).normalize();
  const ammoBarrier = s.ammoBarrier || ballistic.getAmmoBarrier(s.ammo);
  const response = ballistic.calcRicochetDirection(Math.sqrt(Math.max(0, 1 - dot * dot)), dot, 0, 1, contact.material, ammoBarrier.barrierBehavior);
  // Mesh facets/jitter must not send a successful reflection into the shell.
  const outgoing = tangent.multiplyScalar(response.nx).addScaledVector(normal, Math.max(.01, response.ny)).normalize();
  const decay = ballistic.getRicochetDecay(ammoBarrier);
  // Clean deflections preserve most speed. Deep gouges approach the original
  // ammo-dependent ricochet decay. Pen/damage cannot exceed remaining energy.
  const velocityMul = .98 + (decay.vel - .98) * severity;
  const energyRetention = velocityMul ** 2;
  const penMul = Math.min(energyRetention, .96 + (decay.pen - .96) * severity);
  const damageMul = Math.min(energyRetention, .96 + (decay.dmg - .96) * severity);
  const stabilityMul = .92 + (decay.stab - .92) * severity;
  const massKg = protection.computeProjectileKinetics(s.ammo, s.velocity, s.initialVelocity).massKg;
  const energyInJ = .5 * massKg * s.velocity ** 2;
  s.velocity *= velocityMul; s.pen *= penMul; s.damage *= damageMul; s.stability *= stabilityMul; s.barrierCount++;
  const energyOutJ = .5 * massKg * s.velocity ** 2;
  return { ...candidate, ricocheted: true, degree, label: HELMET_RICOCHET_LABELS[degree],
    outgoingDirection: outgoing.toArray(), surfaceNormal: normal.toArray(), jitterDeg: response.jitterDeg,
    velocityMul, penMul, damageMul, stabilityMul, energyInJ, energyOutJ,
    energyDepositedJ: Math.max(0, energyInJ - energyOutJ),
    wearMul: profile.minimumWearMul + (profile.maximumWearMul - profile.minimumWearMul) * severity };
}
