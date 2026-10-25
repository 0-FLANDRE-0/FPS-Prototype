import { Quaternion, Vector3 } from 'three';
import { weaponMarkers } from './weapon-data.js';
import { VUDU,opticForWeapon } from './optic-data.js';
import { VUDU_OPTICS } from './optic-optics.js';

const cache = new Map();
// Geometry only. This visual alignment preserves v29 ADS; it is never a
// ballistic elevation correction. Both the solver and firing use these markers.
export function sightGeometry(weaponId, optic = null) {
  const key = weaponId==="scar_h"?weaponId+":"+(optic?.id||"iron"):optic?.id || weaponId;
  optic=opticForWeapon(optic,weaponId);
  if (!cache.has(key)) {
    let rear, front;
    if (optic) {
      rear = new Vector3(...optic.mountPosition).add(optic.id === VUDU.id
        ? new Vector3(...VUDU_OPTICS.ocular) : new Vector3(0, optic.axisHeightM, 0));
      front = rear.clone().add(new Vector3(0, 0, -optic.axisLengthM));
    } else {
      const markers = weaponMarkers(weaponId);
      rear = new Vector3(...markers.sight); front = new Vector3(...markers.frontSight);
    }
    // Optical axes were exactly -Z in v29. Keep that exact representation;
    // normalizing an already measured length can introduce display round-off.
    const sightAxis = optic ? new Vector3(0,0,-1) : front.clone().sub(rear).normalize();
    cache.set(key, { rear, front, sightAxis,
      visualAlignment: new Quaternion().setFromUnitVectors(sightAxis, new Vector3(0, 0, -1)) });
  }
  return cache.get(key);
}
