import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
// Reviewed declarations only. Coverage RNG, medical execution, AAR and DOM stay in the original game.
const selections = {
  'src/medical/wound-metadata.js': ['_CALIBER_MM_TABLE', '_caliberStringToMm', 'getProjectileDiameterMm'],
  'src/combat/armor-durability.js': ['ARMOR_DURABILITY_CURVES', 'getDurabilityArmorMul',
    'ARMOR_VALID_DUR_MATERIALS', 'normalizeDurabilityMaterial', 'SUBSONIC_CLASS_REGISTRY', 'getSubsonicClass',
    '_apLikeFromBehavior', '_isBarrierBlindBehavior', 'getCanonicalProjectileMassG', 'getCanonicalProjectileProfile',
    'getArmorThreatClass', 'computeProjectileKinetics', 'resolveKineticPenetrationMul',
    'ARMOR_MATERIAL_THREAT_RESPONSE', 'getAmmoArmorWearBase', 'getArmorMaterialThreatResponse',
    'getPenetrationPressureFactor', 'getArmorHitResultFactor', 'getArmorVelocityFactor', 'ARMOR_LOCAL_SEVERITY', 'ARMOR_LOCAL_MIN_MUL',
    'ARMOR_MATERIAL_DAMAGE_PROFILE', 'getArmorMaterialDamageProfile', '_ensureLocalZones', 'ARMOR_ZONE_NEIGHBORS',
    'applyArmorLocalZoneDamage', 'getArmorLocalZoneMul', 'ARMOR_DAMAGE_MODE_LABEL_KO', 'getArmorKineticWearFactor',
    'resolveArmorDamageDistribution', 'resolveMaterialArmorDamageState', 'ARMOR_WEAR_TUNING_SCALE',
    'getAmmoLocalSeverity', 'applyPenetrationLocalityRebalance', 'applyArmorGlobalDamageCaps',
    'applyNeighborSplashRebalance', 'computeArmorDurabilityDamage', 'applyArmorWearMinimums'],
  'src/combat/damage-outcomes.js': ['effectivePenetration'],
  'src/combat/armor-resolution.js': ['penetrationProbability', 'rollPenetration', 'getHelmetArmorPenalty', 'applyHelmetArmorPenalty', 'residualPenetrationAfterHard',
    '_sabotInfo', '_ammoBarrierInfo', 'buildResidualThreatAfterHard', 'canBackerAttemptStop',
    'backerStopChanceGate', 'backerMitigationFactor', 'computeBackerResolution'],
  'src/combat/impact-address.js': ['HELMET_ZONE_CURVATURE', 'getMaterialRicochetMul', 'computeRicochetHint'],
  'src/medical/body-trauma.js': ['BODY_RESISTANCE', '_bodyTerminalMods'],
};
const exported = ['BODY_RESISTANCE', '_bodyTerminalMods', 'getCanonicalProjectileProfile', 'effectivePenetration',
  'computeProjectileKinetics', 'resolveKineticPenetrationMul', 'penetrationProbability', 'rollPenetration',
  'buildResidualThreatAfterHard', 'canBackerAttemptStop', 'backerStopChanceGate', 'backerMitigationFactor', 'computeBackerResolution', 'applyHelmetArmorPenalty',
  'getDurabilityArmorMul', 'getArmorLocalZoneMul', 'computeArmorDurabilityDamage', 'applyArmorLocalZoneDamage',
  'ARMOR_ZONE_NEIGHBORS', 'resolveBodyDepth', 'computeRicochetHint'];

export async function extractProtection() {
  const declarations = [], sources = [];
  for (const [path, names] of Object.entries(selections)) {
    const source = await readFile(resolve(root, 'reference/2d', path), 'utf8');
    sources.push({ path, sha256: createHash('sha256').update(source).digest('hex'), declarations: names });
    for (const name of names) {
      const matches = [...source.matchAll(new RegExp(`^(?:const|function) ${name}\\b`, 'gm'))];
      if (matches.length !== 1) throw new Error(`Review protection declaration: ${path} / ${name}`);
      const start = matches[0].index, rest = source.slice(start + matches[0][0].length);
      const next = /^(?:const|let|var|function|for)\s/m.exec(rest);
      const declaration = source.slice(start, next ? start + matches[0][0].length + next.index : source.length).trim();
      new Script(declaration, { filename: `${path}:${name}` }); declarations.push(declaration);
    }
  }
  const body = await readFile(resolve(root,'reference/2d/src/medical/body-trauma.js'), 'utf8');
  const start = body.indexOf('  const cost = br.cost * mods.costMul;'), end = body.indexOf('  // 파편 보수화 — size별 상한', start);
  if (start < 0 || end < 0 || body.indexOf('  const cost = br.cost * mods.costMul;', start + 1) >= 0) throw new Error('Review original body depth boundary');
  const block = body.slice(start, end);
  sources.at(-1).bodyDepthBlockSha256 = createHash('sha256').update(block).digest('hex');
  const wrapper = `function resolveBodyDepth(br, mods, penBefore) {\n${block}\nreturn { cost, skinEntry, depth, bodyEntered, deepTissue, exitWound, retained, nearExit, bttt, penAfterBody: bttt ? Math.max(0, penBefore - cost) : 0 };\n}`;
  new Script(wrapper);
  // Training inputs are already on the resolved 0..100 scale. Multiplying a low
  // post-impact residual by ten would revive it. Tests can select the original mixed-scale boundary.
  const source = '// Generated from unchanged CQB declarations; see scripts/training-protection.mjs.\n' +
    `export const LEGACY_PROTECTION_SOURCES = ${JSON.stringify(sources)};\n` +
    'export function createLegacyProtection(random = globalThis.Math.random, { resolvedScale = true } = {}) {\n' +
    'const Math = Object.create(globalThis.Math); Math.random = random; const ARMOR_SCALE = resolvedScale ? 1 : 10;\n' +
    declarations.join('\n') + '\n' + wrapper + `\nreturn Object.freeze({ ${exported.join(', ')} });\n}\n`;
  return { source, sources };
}
export async function generateProtection() {
  if(!process.argv.includes("--allow-reference-import"))throw Error("Reference import is opt-in; normal3Dbuild uses independently owned ported modules.");
  const result = await extractProtection(), path = resolve(root, 'apps/training/src/generated/legacy-protection.js');
  await mkdir(resolve(path, '..'), { recursive: true });
  if (await readFile(path, 'utf8').catch(() => '') !== result.source) await writeFile(path, result.source);
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateProtection();
