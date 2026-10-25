import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Box3, Matrix4, Vector3 } from 'three';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceSha256 = 'f38f736aa92ca01564cbc3d6526655fc639677eedd2e0b7f939eb4ca3e0d978a';
// Component identities refer to the first source triangle, not a bounding box.
// Only connectivity is welded (0.0001 source units); exported vertices are untouched.
const componentSlots = new Map([[896, 'torso'], [1252, 'left'], [1116, 'right'],
  [108, 'front'], [900, 'rear'], [0, 'groin'], [220, 'shoulder-right'], [420, 'shoulder-left']]);

export async function extractArmorMesh() {
  const bytes = await readFile(resolve(root, 'apps/training/assets/soldier-character.glb'));
  if (createHash('sha256').update(bytes).digest('hex') !== sourceSha256) throw new Error('Review armor mesh selection for the changed soldier asset');
  const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binaryOffset = 20 + jsonLength + 8;
  const accessor = id => {
    const a = gltf.accessors[id], view = gltf.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC3: 3 }[a.type], width = { 5126: 4, 5125: 4, 5123: 2 }[a.componentType];
    const read = { 5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE' }[a.componentType];
    if (!size || !width || !read) throw new Error('Unsupported armor accessor');
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, axis) =>
      bytes[read](binaryOffset + (view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || width * size) + axis * width)));
  };
  const bounds = new Box3(), meshes = [];
  const walk = (id, parent = new Matrix4()) => {
    const node = gltf.nodes[id];
    // This hash-pinned static OBJ export has matrices only, no TRS, skin or morphs.
    if (node.translation || node.rotation || node.scale || node.skin !== undefined) throw new Error('Review soldier transforms');
    const matrix = parent.clone().multiply(node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4());
    if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
      const positions = accessor(primitive.attributes.POSITION).map(p => new Vector3(...p).applyMatrix4(matrix).toArray());
      for (const p of positions) bounds.expandByPoint(new Vector3(...p));
      meshes.push({ material: gltf.materials[primitive.material].name, positions, indices: accessor(primitive.indices).flat(), primitive });
    }
    for (const child of node.children || []) walk(child, matrix);
  };
  for (const node of gltf.scenes[gltf.scene || 0].nodes) walk(node);
  const center = bounds.getCenter(new Vector3()), scale = 1.8 / bounds.getSize(new Vector3()).y;
  const vest = meshes.find(mesh => mesh.material === 'Vest');
  if (!vest || vest.indices.length !== 4311 * 3) throw new Error('Review Vest primitive');
  const positions = vest.positions.map(p => [(p[0] - center.x) * scale, (p[1] - bounds.min.y) * scale, (p[2] - center.z) * scale]);
  const triangles = Array.from({ length: vest.indices.length / 3 }, (_, i) => vest.indices.slice(i * 3, i * 3 + 3));
  const parent = triangles.map((_, i) => i), vertices = new Map();
  const find = id => { while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; } return id; };
  triangles.forEach((triangle, id) => { for (const vertex of triangle) {
    const key = vest.positions[vertex].map(n => Math.round(n * 10000)).join(',');
    if (vertices.has(key)) parent[find(id)] = find(vertices.get(key)); else vertices.set(key, id);
  } });
  const connected = new Map();
  triangles.forEach((_, id) => { const key = find(id); if (!connected.has(key)) connected.set(key, []); connected.get(key).push(id); });
  const components = [...connected.values()].map(ids => ({ firstTriangle: ids[0], triangleCount: ids.length, triangleIds: ids }))
    .sort((a, b) => a.firstTriangle - b.firstTriangle);
  if (components.length !== 24 || [...componentSlots.keys()].some(id => !components.some(c => c.firstTriangle === id))) throw new Error('Review Vest connectivity');
  const slots = new Map(['front', 'rear', 'left', 'right', 'neck', 'groin', 'shoulder-left', 'shoulder-right'].map(slot => [slot, []]));
  for (const component of components) {
    const selection = componentSlots.get(component.firstTriangle);
    if (!selection) continue;
    for (const id of component.triangleIds) {
      let slot = selection;
      if (slot === 'torso') {
        const centroid = triangles[id].reduce((v, i) => v.add(new Vector3(...positions[i])), new Vector3()).divideScalar(3);
        // Semantic addresses only: do not cut, cap, move or add triangles here.
        slot = centroid.y >= 1.49 ? 'neck' : Math.abs(centroid.x) / 0.19 > Math.abs(centroid.z) / 0.17
          ? (centroid.x > 0 ? 'left' : 'right') : (centroid.z > 0 ? 'front' : 'rear');
      }
      slots.get(slot).push(id);
    }
  }
  const regions = Object.fromEntries([...slots].map(([slot, ids]) => {
    const sourceVertexIds = [...new Set(ids.flatMap(id => triangles[id]))].sort((a, b) => a - b);
    const remap = new Map(sourceVertexIds.map((id, index) => [id, index]));
    const vertices = sourceVertexIds.flatMap(id => positions[id]), indices = ids.flatMap(id => triangles[id].map(v => remap.get(v)));
    const box = new Box3(); for (const id of sourceVertexIds) box.expandByPoint(new Vector3(...positions[id]));
    return [slot, { vertices, indices, sourceVertexIds, sourceTriangleIds: ids,
      bounds: { min: box.min.toArray(), max: box.max.toArray() } }];
  }));
  const source = { asset: 'soldier-character.glb', material: 'Vest', sha256: sourceSha256,
    sourceTriangles: triangles.length, selectedTriangles: [...slots.values()].reduce((n, ids) => n + ids.length, 0),
    normalization: { heightM: 1.8, scale, rawBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } },
    selectedComponents: [...componentSlots].map(([firstTriangle, slot]) => ({ firstTriangle, slot,
      triangleCount: components.find(c => c.firstTriangle === firstTriangle).triangleCount })),
    excludedComponents: components.filter(c => !componentSlots.has(c.firstTriangle)).map(({ firstTriangle, triangleCount }) => ({ firstTriangle, triangleCount })),
    neckAddressBoundaryY: 1.49 };
  return { source, regions };
}

export async function generateArmorMesh() {
  const result = await extractArmorMesh(), path = resolve(root, 'apps/training/src/generated/armor-mesh.js');
  const source = '// Generated from the hash-pinned Vest triangles by scripts/training-armor-mesh.mjs.\n' +
    `export const ARMOR_MESH_SOURCE = ${JSON.stringify(result.source)};\nexport const ARMOR_MESH_REGIONS = ${JSON.stringify(result.regions)};\n`;
  await mkdir(resolve(path, '..'), { recursive: true });
  if (await readFile(path, 'utf8').catch(() => '') !== source) await writeFile(path, source);
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateArmorMesh(); console.log(`Armor mesh: ${result.source.selectedTriangles} unchanged triangles / ${Object.keys(result.regions).length} soft regions`);
}
