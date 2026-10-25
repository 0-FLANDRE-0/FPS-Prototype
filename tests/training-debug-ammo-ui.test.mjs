import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { CATALOG } from '../apps/training/src/catalog.js';
import { DEBUG_AMMO_TABLE, debugAmmoRows } from '../apps/training/src/debug-ammo-ui.js';

function originalDeclarations(path, names) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  return ast.body.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name) || node.type === 'VariableDeclaration' && node.declarations.some(declaration => names.includes(declaration.id.name))).map(node => source.slice(node.start, node.end)).join('\n');
}

test('debug table exposes every original registry cartridge and exact unmodified specification fields', () => {
  const before = JSON.stringify(CATALOG), rows = debugAmmoRows();
  assert.deepEqual(rows.map(row => row.id).sort(), Object.keys(CATALOG.AMMO_REGISTRY).sort());
  for (const row of rows) {
    const entry = CATALOG.AMMO_REGISTRY[row.id];
    assert.equal(row.name, entry.display.name);
    for (const [field, original] of Object.entries({ caliber: 'caliber', velocityMps: 'velocity', penetration: 'penetration', damage: 'damage', suppression: 'suppression', recoil: 'recoil', accuracyMul: 'accuracyMul' })) assert.equal(row[field], entry.ballistic[original], `${row.id} ${field}`);
    assert.equal(row.massG, entry.projectile.massG, `${row.id} mass is the per-projectile registry value`);
    assert.equal(row.armorDamagePct, entry.durability.armorDamagePct);
    assert.equal(row.pelletCount, entry.projectile.pelletCount || 1);
  }
  assert.equal(JSON.stringify(CATALOG), before);
  for (let i = 1; i < rows.length; i++) if (rows[i - 1].caliber === rows[i].caliber) assert.ok(rows[i - 1].penetration <= rows[i].penetration);
});

test('all eight materials and 1–7 class grades exactly match original 2D ammunition table functions', () => {
  const original = originalDeclarations('../reference/2d/src/presentation/armor-analysis.js', ['AI_CLASS_ARMORS', 'AI_MATERIALS', 'getPenetrationGrade', 'getClassArmorValue', 'getAmmoEffectivePenForMaterial', 'getSystemPenetrationProb']) + '\n' +
    originalDeclarations('../reference/2d/src/combat/damage-outcomes.js', ['effectivePenetration']) + '\n' + originalDeclarations('../reference/2d/src/combat/armor-resolution.js', ['penetrationProbability']);
  const context = vm.createContext({});
  vm.runInContext(original + '\nglobalThis.original = {AI_CLASS_ARMORS, AI_MATERIALS, getPenetrationGrade, getClassArmorValue, getAmmoEffectivePenForMaterial, getSystemPenetrationProb};', context);
  const source = context.original;
  assert.deepEqual([...source.AI_CLASS_ARMORS], [...DEBUG_AMMO_TABLE.classArmors]);
  assert.deepEqual([...source.AI_MATERIALS], [...DEBUG_AMMO_TABLE.materials]);
  for (const material of DEBUG_AMMO_TABLE.materials) for (const row of debugAmmoRows(material)) {
    const eff = source.getAmmoEffectivePenForMaterial(CATALOG.AMMO_PRESETS[row.id], material);
    assert.equal(row.effectivePenetration, eff);
    for (const cls of row.classes) {
      const probability = source.getSystemPenetrationProb(eff, material, source.getClassArmorValue(cls.class));
      assert.equal(cls.probability, probability, `${row.id}/${material}/Class${cls.class}`);
      assert.equal(cls.grade, source.getPenetrationGrade(probability));
    }
  }
  assert.throws(() => debugAmmoRows('invented-material'), /Unknown/);
});
