import { Quaternion, Vector3 } from 'three';
import { CATALOG } from './catalog.js';
import { ARMOR_MESH_SOURCE, ARMOR_MESH_REGIONS } from './generated/armor-mesh.js';
import { actorRotation, worldPoint } from './human-targets.js';
import { bentPanelMesh, multiCurvePlateMesh } from './armor-geometry.js';
import {plateShape} from './plate-shapes.js';
import { armorBone } from './soldier-rig.js';
import { HEAD_MESH_SOURCE, FRONT_NECK_MESH, HELMET_COLLISION_MESH } from './generated/head-mesh.js';

export const ARMOR_COLORS = Object.freeze({ soft: '#65e7aa', plate: '#ffb85c', helmet: '#8eafff' });
const vest = CATALOG.BODY_ARMOR_REGISTRY.armor_6b45_basic_test;
const plate = CATALOG.PLATE_REGISTRY.plate_granit_br4;
const helmet = CATALOG.HELMET_REGISTRY.helmet_6b47_test;
// The user identifies this vest as 6B45. Plate mounts remain prototype dimensions.
// Plate dimensions and mounts are authored in normalized 1.8m space.
// Soft coverage uses original Vest triangles; their visual shell is not fabric thickness.
// Plate thickness (15mm) and item identity come from the original Br4 registry.
// The shooter_cut outline follows the original UI polygon; making it a 3D
// collider is new spatial coverage, not the original address coverage algorithm.
const shooterCut = [[0.22, 0], [0.78, 0], [1, 0.30], [1, 1], [0, 1], [0, 0.30]];
const panel = (id, slot, at, yaw, radius) => ({ id, slot, kind: 'plate', at, yaw,
  itemId: plate.id, geometry: 'curved-solid', width: .25, height: .30,
  thickness: plate.thickness.thicknessMm / 1000, outline: shooterCut, radius, segments: 16 });
const accessory = slot => CATALOG.PROTECTION_ACCESSORY_PRESETS[slot === 'groin' ? '6b45_groin' : slot === 'neck' ? '6b45_neck' : '6b45_shoulder'];
const meshPanels = Object.entries(ARMOR_MESH_REGIONS).map(([slot, mesh]) => {
  const item = ['groin', 'neck', 'shoulder-left', 'shoulder-right'].includes(slot) ? accessory(slot) : null;
  return { id: `soft-${slot}`, slot, kind: 'soft', geometry: 'trimesh', meshRegion: slot, at: [0, 0, 0], yaw: 0,
    itemId: item?.id || vest.id, protectionModel: 'rating-only', thickness: null, triangleCount: mesh.indices.length / 3, bounds: mesh.bounds,
    material: item?.material || vest.softArmor.material, armorValue: item?.armorValue ?? vest.softArmor.value,
    maxDurability: item ? CATALOG.ACCESSORY_MAX_DURABILITY[item.id] : vest.softArmor.maxDurability };
});
const freeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); };
const frontNeck = accessory('neck');
export const ARMOR_PROFILE = freeze({ id: 'h01-br4-protection-v10', name: '6B45 · Granit Br4', mode: 'protection',
  bodyArmorId: vest.id, frontPlateId: plate.id, backPlateId: plate.id, sidePlateId: 'plate_granit_side',
  meshSource: ARMOR_MESH_SOURCE,
  headMeshSource: HEAD_MESH_SOURCE,
  helmet: { identity: 'user-selected-6b47', itemId: helmet.id, mode: 'protection',
    skull: helmet.protection.skull, temporal: helmet.protection.temporal, maxDurability: CATALOG.HELMET_MAX_DURABILITY[helmet.id] },
  soft: { protectionModel: 'rating-only', plannedObliquityRule: 'boost-only-above-threshold',
    material: vest.softArmor.material, armorValue: vest.softArmor.value, maxDurability: vest.softArmor.maxDurability },
  plate: { material: plate.armor.material, armorValue: plate.armor.hardArmor, maxDurability: plate.durability.maxDurability,
    shape: 'shooter_cut', thicknessMm: plate.thickness.thicknessMm, ...plate.plateSystem },
  shapes: [
    ...meshPanels,
    // The actual front collar is in the source Head primitive, not Vest.
    // Its rim selection follows source faces and never caps the neck opening.
    { id: 'soft-neck-front', slot: 'neck', kind: 'soft', geometry: 'trimesh', meshRegion: 'neck-front',
      at: [0, 0, 0], yaw: 0, triangleCount: FRONT_NECK_MESH.indices.length / 3, bounds: FRONT_NECK_MESH.bounds,
      thickness: null, itemId: frontNeck.id, protectionModel: 'rating-only',
      provenance: FRONT_NECK_MESH.provenance, material: frontNeck.material,
      armorValue: frontNeck.armorValue, maxDurability: CATALOG.ACCESSORY_MAX_DURABILITY[frontNeck.id] },
    plateShape(plate.id,'front'),
    plateShape(plate.id,'rear'),
    plateShape('plate_granit_side','left'),
    plateShape('plate_granit_side','right'),
    { id: 'helmet-shell', slot: 'head', kind: 'helmet', geometry: 'trimesh', meshRegion: 'helmet-shell',
      at: [0, 0, 0], yaw: 0, triangleCount: HELMET_COLLISION_MESH.indices.length / 3, bounds: HELMET_COLLISION_MESH.bounds,
      provenance: 'unchanged-source-helmet-triangles', itemId: helmet.id, material: helmet.protection.skull.material, armorValue: helmet.protection.skull.shellArmor,
      maxDurability: CATALOG.HELMET_MAX_DURABILITY[helmet.id], thickness: null, protectionModel: 'shell-and-liner', identification: 'user-selected-6b47' },
  ] });

// Rendered triangles and Rapier trimeshes share vertices AND topology.
const meshCache = new WeakMap();
function armorMesh(shape) {
  if (!meshCache.has(shape)) meshCache.set(shape, shape.geometry === 'trimesh'
    ? (() => { const mesh = shape.meshRegion === 'neck-front' ? FRONT_NECK_MESH : shape.meshRegion === 'helmet-shell' ? HELMET_COLLISION_MESH : ARMOR_MESH_REGIONS[shape.meshRegion];
      return { vertices: new Float32Array(mesh.vertices), indices: new Uint32Array(mesh.indices) }; })()
    : shape.verticalRadius ? multiCurvePlateMesh(shape) : bentPanelMesh(shape));
  return meshCache.get(shape);
}
export function armorIndices(shape) { return armorMesh(shape).indices; }
export function armorVertices(shape) {
  return armorMesh(shape).vertices;
}
export function armorPose(actor, shape, rig = null) {
  if(rig){const matrix=rig.delta(armorBone(shape));return {position:worldPoint(actor,new Vector3(...shape.at).applyMatrix4(matrix).toArray()),
    rotation:actorRotation(actor).multiply(new Quaternion().setFromRotationMatrix(matrix)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),shape.yaw))};}

  return { position: worldPoint(actor, shape.at),
    rotation: actorRotation(actor).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), shape.yaw)) };
}
export function armorOwnerId(actor, shape) { return `${actor.id}:${shape.kind === 'plate' || shape.kind === 'helmet' ? shape.id : ['front', 'rear', 'left', 'right'].includes(shape.slot) ? 'vest-soft' : shape.itemId}`; }
// Coverage is observed at the original surface. For a plate-covered vest, the
// protection pipeline must process the plate before the same vest's soft backer.
// Keep measured coordinates and physical order intact; do not move the mesh.
export function prioritizeArmorContacts(contacts) {
  const physical = contacts.sort((a, b) => a.entryDistance - b.entryDistance || a.layerId.localeCompare(b.layerId))
    .map((contact, physicalOrder) => ({ ...contact, physicalOrder }));
  const result = [...physical];
  for (const targetId of new Set(physical.map(contact => contact.targetId))) {
    const indices = result.flatMap((contact, index) => contact.targetId === targetId &&
      (contact.kind === 'plate' || contact.ownerId === `${targetId}:vest-soft`) ? [index] : []);
    const selected = indices.map(index => result[index]);
    if (!selected.some(contact => contact.kind === 'plate')) continue;
    const ordered = [...selected.filter(contact => contact.kind === 'plate'), ...selected.filter(contact => contact.kind === 'soft')];
    indices.forEach((index, i) => { result[index] = ordered[i]; });
  }
  return result.map((contact, protectionOrder) => ({ ...contact, protectionOrder }));
}
export function describeArmorContact(contact) {
  if (contact.kind === 'helmet') return contact.integral ? '6B47 라이너' : '6B47 헬멧';
  const slot = { front: '전면', rear: '후면', left: '좌측', right: '우측', groin: '낭심', neck: '목', 'shoulder-left': '좌측 어깨', 'shoulder-right': '우측 어깨' }[contact.slot];
  return `${slot} ${contact.kind === 'plate' ? '플레이트' : '소프트'}`;
}
