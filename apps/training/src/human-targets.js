import { Quaternion, Vector3 } from 'three';
import { BODY_MESH_REGIONS, BODY_MESH_SOURCE } from './generated/body-mesh.js';

export const HUMAN_TARGETS = Object.freeze([{ id: 'H01', label: '병사 표적', at: [17, 0, -4], yaw: 0 }]);
export const HUMAN_HEIGHT = 1.8;
// Reviewed in normalized model coordinates: exposed eye band, masked nose/jaw
// and helmet brow. These are address boundaries, not internal anatomy meshes.
export const HEAD_LANDMARKS = Object.freeze({ faceTopY: 1.684, eyesLowerY: 1.647, noseLowerY: 1.606 });
export const BODY_PARTS = Object.freeze(['head', 'neck', 'chest', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']);
const Y = new Vector3(0, 1, 0);
// Each closed surface is stored in bind coordinates and attached to one joint.
// Source clothing fits are coverage proxies, not anatomical tissue thickness.
export const BODY_PROFILE = Object.freeze(Object.entries(BODY_MESH_REGIONS).map(([id,m])=>Object.freeze({
  id,part:m.part,joint:m.joint||false,type:'trimesh',at:m.at,bone:m.bone,geometry:'mesh-fitted-closed',
  provenance:m.provenance,bounds:m.bounds,source:BODY_MESH_SOURCE,closed:true,
})));
const meshCache=new WeakMap();
export function bodyMesh(shape) {
  if(shape.type!=='trimesh')return null;
  if(!meshCache.has(shape)){const m=BODY_MESH_REGIONS[shape.id];meshCache.set(shape,{vertices:new Float32Array(m.vertices.map((v,i)=>v-shape.at[i%3])),indices:new Uint32Array(m.indices)});}
  return meshCache.get(shape);
}

export function actorRotation(actor) { return new Quaternion().setFromAxisAngle(Y, actor.yaw || 0); }
export function worldPoint(actor, local) { return new Vector3(...local).applyQuaternion(actorRotation(actor)).add(new Vector3(...actor.at)); }
export function shapePose(actor, shape, rig = null) {
  const rotation = actorRotation(actor);
  if (rig && shape.bone) {
    const matrix=rig.delta(shape.bone),local=new Vector3(...shape.at).applyMatrix4(matrix);
    return {position:worldPoint(actor,local.toArray()),rotation:rotation.multiply(new Quaternion().setFromRotationMatrix(matrix))};
  }
  if (shape.type !== 'capsule') return { position: worldPoint(actor, shape.at), rotation };
  const a = new Vector3(...shape.a), b = new Vector3(...shape.b), delta = b.clone().sub(a);
  return { position: worldPoint(actor, a.clone().add(b).multiplyScalar(0.5).toArray()),
    rotation: rotation.multiply(new Quaternion().setFromUnitVectors(Y, delta.clone().normalize())), halfHeight: delta.length() / 2 };
}
const canonicalPart = part => part.replace(/(Arm|Leg)$/, word => `_${word.toLowerCase()}`);
const PART_LABELS = { head: '머리', neck: '목', chest: '흉부', abdomen: '복부', leftArm: '왼팔', rightArm: '오른팔', leftLeg: '왼다리', rightLeg: '오른다리' };
const SIDE_LABELS = { front: '정면', rear: '후면', left: '왼쪽 측면', right: '오른쪽 측면', top: '위쪽', bottom: '아래쪽' };
function incomingSide(incoming) {
  const source = incoming.clone().negate();
  if (Math.abs(source.y) > Math.max(Math.abs(source.x), Math.abs(source.z))) return source.y > 0 ? 'top' : 'bottom';
  if (Math.abs(source.x) > Math.abs(source.z)) return source.x > 0 ? 'left' : 'right';
  return source.z >= 0 ? 'front' : 'rear';
}

// Deterministic 3D address; no legacy random hit-location roll, no wound/armor roll.
export function resolveBodyAddress(actor, shape, point, incomingDirection, rig = null) {
  const inverse = actorRotation(actor).invert();
  const local = point.clone().sub(new Vector3(...actor.at)).applyQuaternion(inverse);
  const incoming = incomingDirection.clone().applyQuaternion(inverse).normalize();
  // Undo the animated joint before classifying its bind-pose landmarks.
  const actorLocalPoint=local.toArray();
  if(rig && shape.bone){const inverseJoint=rig.delta(shape.bone).invert();local.applyMatrix4(inverseJoint);incoming.transformDirection(inverseJoint);}
  const side = incomingSide(incoming), part = shape.part;
  let hitPart = canonicalPart(part), region = part === 'head' ? 'head' : part === 'neck' ? 'neck' : /Arm|Leg/.test(part) ? 'limb' : 'torso';
  let zone, subZone, detail;
  if (part === 'head') {
    if (side === 'front' && local.y < HEAD_LANDMARKS.faceTopY) {
      hitPart = 'face'; zone = local.y < HEAD_LANDMARKS.noseLowerY ? 'lower' : local.y < HEAD_LANDMARKS.eyesLowerY ? 'mid' : 'upper';
      subZone = zone === 'lower' ? 'jaw' : zone === 'mid' ? 'nose' : 'eyes'; detail = '얼굴';
    } else { zone = side === 'rear' ? 'occipital' : side === 'left' || side === 'right' ? 'temporal' : side === 'top' ? 'crown' : 'forehead'; detail = '두개부'; }
  } else if (part === 'neck') {
    zone = side === 'rear' ? 'nape' : side === 'left' || side === 'right' ? 'side_neck' : local.y > 1.52 ? 'throat_upper' : 'throat_lower'; detail = '목';
  } else if (part === 'chest') {
    zone = local.y >= 1.34 ? 'upper' : 'lower';
    subZone = Math.abs(local.x) < 0.055 ? 'center' : local.x > 0 ? 'left' : 'right';
    detail = `${zone === 'upper' ? '상부' : '하부'} ${subZone === 'center' ? '중앙' : subZone === 'left' ? '왼쪽' : '오른쪽'}`;
  } else if (part === 'abdomen') {
    zone = shape.id === 'pelvis' ? 'pelvis' : Math.abs(local.x) > 0.115 ? 'flank' : local.y >= 1.085 ? 'upper' : 'lower';
    if (zone === 'pelvis') subZone = 'pelvis_upper';
    detail = { pelvis: '골반', flank: '옆구리', upper: '상복부', lower: '하복부' }[zone];
  } else if (part.endsWith('Arm')) {
    if (shape.id.endsWith('hand')) zone = 'hand_wrist';
    else if (local.y > 1.38) zone = 'shoulder';
    else if (local.y > 1.17 && local.y < 1.26) zone = 'elbow';
    else zone = shape.id.endsWith('upper-arm') ? 'upper_arm' : 'forearm';
    if (zone === 'shoulder') subZone = side === 'front' ? 'deltoid_front' : side === 'rear' ? 'deltoid_rear' : 'deltoid_outer';
    detail = { hand_wrist: '손·손목', shoulder: '어깨', elbow: '팔꿈치', upper_arm: '상완', forearm: '전완' }[zone];
  } else {
    zone = shape.id.endsWith('foot') ? 'foot_ankle' : local.y >= 0.46 && local.y <= 0.59 ? 'knee' : shape.id.endsWith('thigh') ? (local.y > 0.75 ? 'upper_thigh' : 'mid_thigh') : 'lower_leg';
    detail = { foot_ankle: '발·발목', knee: '무릎', upper_thigh: '상부 대퇴', mid_thigh: '대퇴', lower_leg: '하퇴' }[zone];
  }
  const fullAddress = [side, region, hitPart, zone, subZone].filter(Boolean).join('.');
  return { version: 1, targetId: actor.id, shapeId: shape.id, bodyPart: part, hitPart, region, side, zone, subZone: subZone || null,
    fullAddress, localPoint: local.toArray(), localIncomingDirection: incoming.toArray(), actorLocalPoint, bone: shape.bone || null, pose: rig?.pose || 'rest',
    label: `${PART_LABELS[part]} · ${detail} · ${SIDE_LABELS[side]}` };
}

export class HumanHitLog {
  constructor(targets = HUMAN_TARGETS) { this.targets = targets; this.reset(); }
  reset() { this.history = []; this.counts = Object.fromEntries(this.targets.map(target => [target.id, 0])); this.lastShotId = 0; }
  record(event) {
    const hits = event.trace.bodyHits?.length ? event.trace.bodyHits : event.hit?.kind === 'human' ? [{
      targetId: event.hit.id, address: event.hit.address, point: event.hit.point.toArray(), normal: event.hit.normal.toArray(),
      incomingDirection: event.hit.incomingDirection.toArray(), flightState: event.hit.flightState, before: event.trace.residual }] : [];
    if (!hits.length || event.shotId <= this.lastShotId) return null;
    this.lastShotId = event.shotId;
    const records = [];
    for (const targetId of new Set(hits.map(hit => hit.targetId))) {
      const hit = hits.find(hit => hit.targetId === targetId);
      const record = { shotId: event.shotId, time: event.time, targetId, ammoId: event.ammoId,
        address: structuredClone(hit.address), point: [...hit.point], normal: [...hit.normal],
        incomingDirection: [...hit.incomingDirection], flightState: hit.flightState,
        residual: { ...hit.before }, bodyPaths: structuredClone(hits.filter(hit => hit.targetId === targetId)),
        armorContacts: structuredClone(event.trace.armorContacts || []), armorResults: structuredClone(event.trace.armorResults || []),
        energyJ: hit.projectileEnergyInJ ?? 0.5 * event.ballistics.projectileMassKg * hit.before.velocityMps ** 2 };
      this.counts[targetId] = (this.counts[targetId] || 0) + 1; this.history.push(record); records.push(record);
    }
    while (this.history.length > 64) this.history.shift();
    return structuredClone(records[0]);
  }
  snapshot() { return structuredClone({ counts: this.counts, history: this.history, capacity: 64 }); }
}
