import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BufferGeometry, BufferAttribute, SkinnedMesh, MeshStandardMaterial, Group, Vector3 } from 'three';
import { readGLB } from '../scripts/training-soldier-skin.mjs';
import { createSoldierRig } from '../apps/training/src/soldier-rig.js';
import { createEquipmentMeshes } from '../apps/training/src/equipment-mesh.js';
import { HEAD_VISUAL_LAYOUT } from '../apps/training/src/equipment-head-layout.js';

const bytes = await readFile(new URL('../dist/soldier-fingers.glb', import.meta.url));
const { g, access } = readGLB(bytes), rig = createSoldierRig();
const names = { POSITION: 'position', NORMAL: 'normal', TANGENT: 'tangent', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };
const sources = ['Head', 'material'].map(name => {
  const p = g.meshes.find(m => m.name === name).primitives[0], geometry = new BufferGeometry();
  for (const [key, id] of Object.entries(p.attributes)) {
    const rows = access(id), ArrayType = key === 'JOINTS_0' ? Uint16Array : Float32Array;
    geometry.setAttribute(names[key], new BufferAttribute(new ArrayType(rows.flat()), rows[0].length));
  }
  geometry.setIndex(access(p.indices).flat());
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
  mesh.name = 'Soldier' + name;
  return mesh;
});
const equipment = createEquipmentMeshes(sources, rig, new Group());
const area = geometry => {
  let sum = 0;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), p = geometry.attributes.position, ix = geometry.index;
  for (let i = 0; i < ix.count; i += 3) {
    a.fromBufferAttribute(p, ix.getX(i)); b.fromBufferAttribute(p, ix.getX(i + 1)); c.fromBufferAttribute(p, ix.getX(i + 2));
    sum += b.sub(a).cross(c.sub(a)).length() * .5;
  }
  return sum;
};

test('visual partition retains both complete eyeballs on body and preserves pinned source asset', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), HEAD_VISUAL_LAYOUT.derivedAssetSHA256);
  assert.equal(equipment.rows.find(r => r.source === 'Soldiermaterial' && r.part === 'body').triangles, 404);
  assert.ok(!equipment.rows.some(r => r.source === 'Soldiermaterial' && r.part !== 'body'));
});

test('actual eye skin, nape and inner scalp UV islands never occur in helmet or rig geometry', () => {
  const skin = ([x, y]) => (x > .015 && x < .4 && y > .015 && y < .12) ||
    (x > .105 && x < .305 && y > .42 && y < .56) || (x > .315 && x < .44 && y > .24 && y < .285);
  const counts = { helmet: 0, rig: 0, body: 0 };
  for (const part of Object.keys(counts)) for (const mesh of equipment.parts[part]) {
    if (!mesh.name.startsWith('SoldierHead:')) continue;
    const { uv } = mesh.geometry.attributes, ix = mesh.geometry.index;
    for (let i = 0; i < ix.count; i += 3) {
      const u = [0, 1, 2].reduce((n, j) => n + uv.getX(ix.getX(i + j)), 0) / 3;
      const v = [0, 1, 2].reduce((n, j) => n + uv.getY(ix.getX(i + j)), 0) / 3;
      if (skin([((u % 1) + 1) % 1, ((v % 1) + 1) % 1])) counts[part]++;
    }
  }
  assert.equal(counts.helmet, 0); assert.equal(counts.rig, 0); assert.ok(counts.body > 300);
});

test('collar trim is complementary, has a smooth reviewed rim and preserves all source surface area', () => {
  const original = area(sources[0].geometry), partitioned = Object.values(equipment.parts).flat().filter(m => m.name.startsWith('SoldierHead:'));
  assert.ok(Math.abs(partitioned.reduce((n, m) => n + area(m.geometry), 0) - original) < 1e-8);
  const collar = equipment.parts.rig.find(m => m.name.startsWith('SoldierHead:')).geometry.attributes;
  for (let i = 0; i < collar.position.count; i++) {
    const x = collar.position.getX(i), height = 1.535 + .038 * (x / .116) ** 2;
    assert.ok(collar.position.getY(i) <= height + 2e-7);
    assert.ok(Math.abs([0, 1, 2, 3].reduce((n, j) => n + collar.skinWeight.getComponent(i, j), 0) - 1) < 2e-7);
  }
});
