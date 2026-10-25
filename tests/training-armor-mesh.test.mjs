import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractArmorMesh } from '../scripts/training-armor-mesh.mjs';
import { ARMOR_MESH_SOURCE, ARMOR_MESH_REGIONS } from '../apps/training/src/generated/armor-mesh.js';
import { ARMOR_PROFILE } from '../apps/training/src/armor-targets.js';

test('extracted collision triangles are unchanged source Vest triangles in rendered 1.8m coordinates', async () => {
  const extracted = await extractArmorMesh();
  assert.deepEqual(extracted.source, ARMOR_MESH_SOURCE); assert.deepEqual(extracted.regions, ARMOR_MESH_REGIONS);
  const bytes = await readFile(new URL('../apps/training/assets/soldier-character.glb', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ARMOR_MESH_SOURCE.sha256);
  const length = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + length)), binary = 28 + length;
  const primitive = gltf.meshes[4].primitives[0], position = gltf.accessors[primitive.attributes.POSITION], index = gltf.accessors[primitive.indices];
  const pView = gltf.bufferViews[position.bufferView], iView = gltf.bufferViews[index.bufferView];
  const selected = new Set(), scale = 1.8 / (10 - .0027000000700351957);
  // Independently check the original root's X/Z/-Y rotation and GLTFLoader bounds.
  // No decimation, vertex welding, caps, prism extrusion or mesh movement is allowed.
  for (const region of Object.values(ARMOR_MESH_REGIONS)) for (let tri = 0; tri < region.sourceTriangleIds.length; tri++) {
    const sourceId = region.sourceTriangleIds[tri]; assert.ok(!selected.has(sourceId)); selected.add(sourceId);
    for (let axis = 0; axis < 3; axis++) {
      const vertexId = bytes.readUInt32LE(binary + (iView.byteOffset || 0) + (index.byteOffset || 0) + (sourceId * 3 + axis) * 4);
      const localId = region.indices[tri * 3 + axis]; assert.equal(region.sourceVertexIds[localId], vertexId);
      const offset = binary + pView.byteOffset + (position.byteOffset || 0) + vertexId * (pView.byteStride || 12);
      const raw = [0, 4, 8].map(delta => bytes.readFloatLE(offset + delta));
      const expected = [(raw[0] + .00129997730255) * scale, (raw[2] - .0027000000700351957) * scale, (-raw[1] + .0404999852180473) * scale];
      expected.forEach((value, coordinate) => assert.ok(Math.abs(value - region.vertices[localId * 3 + coordinate]) < 1e-9));
    }
  }
  assert.equal(selected.size, 2452); assert.equal(ARMOR_MESH_SOURCE.sourceTriangles, 4311);
  assert.deepEqual(ARMOR_MESH_SOURCE.selectedComponents.map(c => c.firstTriangle).sort((a, b) => a - b), [0, 108, 220, 420, 896, 900, 1116, 1252]);
  for (const knee of [1454, 1938, 2226, 2608]) assert.ok(ARMOR_MESH_SOURCE.excludedComponents.some(c => c.firstTriangle === knee));
});

test('soft rating metadata is independent of mesh thickness and accessories own their original item values', () => {
  assert.equal(ARMOR_PROFILE.soft.protectionModel, 'rating-only');
  for (const shape of ARMOR_PROFILE.shapes.filter(s => s.kind === 'soft')) {
    assert.equal(shape.thickness, null); assert.equal(shape.protectionModel, 'rating-only');
    assert.equal(shape.armorValue, ['neck', 'groin'].includes(shape.slot) ? 33 : 32);
    if (shape.geometry === 'trimesh') assert.ok(shape.bounds.min[1] > .78, 'Knee pads do not receive soft protection');
    else { assert.equal(shape.provenance, 'authored-front-neck-protector'); assert.equal(shape.id, 'soft-neck-front'); }
    assert.ok(shape.maxDurability > 0);
  }
});
