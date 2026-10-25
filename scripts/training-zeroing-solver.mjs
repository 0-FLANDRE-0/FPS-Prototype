// Build/QA only. Use the production flight steps, including its swept-chord
// arrival interpolation, rather than introducing a second ballistic model.
import { Vector3 } from 'three';
import { CATALOG, shotBallistics } from '../apps/training/src/catalog.js';
import { flightProfile, flightChord, advanceFlight, FLIGHT_LIMITS } from '../apps/training/src/flight.js';
import { sightGeometry } from '../apps/training/src/sight-geometry.js';
import { weaponMarkers } from '../apps/training/src/weapon-data.js';
import { OPTICS } from '../apps/training/src/optic-data.js';

export function canonicalGeometry(preset) {
  const g = sightGeometry(preset.weaponId, OPTICS[preset.opticId]);
  return { muzzle: new Vector3(...weaponMarkers(preset.weaponId).muzzle).sub(g.rear).applyQuaternion(g.visualAlignment),
    axis: g.sightAxis.clone(), alignment: g.visualAlignment.clone(),
    rear: g.rear.toArray(), front: g.front.toArray() };
}
export function flightAtDistance(preset, theta, distanceM, ammoId = preset.referenceAmmoId, flightOptions = {}) {
  const g = canonicalGeometry(preset), b = shotBallistics(ammoId, preset.weaponId);
  const profile = flightProfile(CATALOG.AMMO_PRESETS[ammoId], flightOptions);
  let p = g.muzzle.clone(), dir = g.axis.applyAxisAngle(new Vector3(1,0,0), theta).applyQuaternion(g.alignment),
    speed = b.muzzleVelocityMps, timeS = 0;
  for (let steps = 0; steps < FLIGHT_LIMITS.maxSteps; steps++) {
    const chord = flightChord(p, dir, speed, FLIGHT_LIMITS.maxChordM, profile);
    if (-chord.end.z >= distanceM) {
      const alpha = (-distanceM-p.z)/(chord.end.z-p.z);
      const velocity=advanceFlight(p,chord.initialVelocity,chord.dt*alpha,profile).velocity;
      return { heightM:p.clone().lerp(chord.end,alpha).y, lateralM:p.clone().lerp(chord.end,alpha).x,
        velocityMps:velocity.length(),energyJ:.5*b.projectileMassKg*velocity.lengthSq(),
        timeS:timeS+chord.dt*alpha, steps:steps+1 };
    }
    p = chord.end; dir = chord.velocity.clone().normalize(); speed = chord.velocity.length(); timeS += chord.dt;
    if(timeS >= FLIGHT_LIMITS.maxTimeS) break;
  }
  throw new Error('Zeroing plane not reached: '+distanceM);
}
export function solveZero(preset, flightOptions = {}) {
  let lo = -.03, hi = .03;
  const error = theta => flightAtDistance(preset,theta,preset.distanceM,preset.referenceAmmoId,flightOptions).heightM-preset.offsetM;
  if(error(lo)>=0 || error(hi)<=0) throw new Error('Zeroing root not bracketed');
  let theta, residualM, iterations;
  for(iterations=1;iterations<=60;iterations++) {
    theta=(lo+hi)/2; residualM=error(theta);
    if(Math.abs(residualM)<1e-8) break;
    if(residualM>0)hi=theta;else lo=theta;
  }
  const g=canonicalGeometry(preset),b=shotBallistics(preset.referenceAmmoId,preset.weaponId);
  return {...preset,thetaRad:theta,thetaMrad:theta*1000,sightHeightMm:-g.muzzle.y*1000,
    muzzleVelocityMps:b.muzzleVelocityMps,residualMm:residualM*1000,iterations,
    geometry:{rear:g.rear,front:g.front,muzzleInLevelSightFrame:g.muzzle.toArray()},
    retentionPer100M:flightProfile(CATALOG.AMMO_PRESETS[preset.referenceAmmoId],flightOptions).retentionPer100M};
}
