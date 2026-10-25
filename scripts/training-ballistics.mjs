import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
// Narrow, reviewed declaration boundary. Original classic scripts stay unchanged.
const selections = {
  'src/runtime/scale.js': ['PX_PER_M', 'M_PER_PX', 'mToPx', 'pxToM'],
  'src/runtime/game-state.js': ['BARRIER_MATERIAL_PROPS', 'getBarrierMaterialProps', 'MATERIAL_ARMOR_PER_M',
    'getBarrierNominalThicknessM', 'getBarrierArmorPerMeter', 'computeBarrierEffectiveArmor'],
  'src/data/ammunition-legacy.js': ['getCaliberEnergyClass', 'ENERGY_CLASS_BARRIER_LOSS_MUL',
    'BEHAVIOR_BARRIER_LOSS_MUL', 'PENETRATOR_BEHAVIORS', 'getSpecialComboLossMul'],
  'src/combat/armor-resolution.js': ['penetrationProbability'],
  'src/combat/ballistics.js': ['DEFAULT_BARRIER_FIELDS', 'getAmmoBarrier', 'MATERIAL_BALLISTIC', 'getMaterialBallistic',
    'BEHAVIOR_BALLISTIC', 'getAmmoBallistic', 'getRicochetDecay', 'calcRicochetChance', 'calcRicochetDirection',
    'applyLegacyPenetrationWobble', '_applyBarrierLoss', '_shotIsDead', 'isBallisticAbsoluteStopper', 'RAY_MAX_SEGMENTS'],
};
const exports = ['mToPx', 'computeBarrierEffectiveArmor', 'getAmmoBarrier', 'penetrationProbability',
  'calcRicochetChance', 'calcRicochetDirection', 'getRicochetDecay', 'getAmmoBallistic',
  'applyLegacyPenetrationWobble', '_applyBarrierLoss', '_shotIsDead', 'isBallisticAbsoluteStopper',
  'RAY_MAX_SEGMENTS', 'MATERIAL_ARMOR_PER_M', 'BARRIER_MATERIAL_PROPS'];

export async function extractBallistics() {
  const declarations = [], sources = [];
  for (const [path, names] of Object.entries(selections)) {
    const source = await readFile(resolve(root, 'reference/2d', path), 'utf8');
    sources.push({ path, sha256: createHash('sha256').update(source).digest('hex'), declarations: names });
    for (const name of names) {
      const matches = [...source.matchAll(new RegExp(`^(?:const|function) ${name}\\b`, 'gm'))];
      if (matches.length !== 1) throw new Error(`Review legacy declaration boundary: ${path} / ${name}`);
      const start = matches[0].index;
      const rest = source.slice(start + matches[0][0].length);
      const next = /^(?:const|let|var|function|for)\s/m.exec(rest);
      const declaration = source.slice(start, next ? start + matches[0][0].length + next.index : source.length).trim();
      // A moved boundary must fail rather than silently include executable setup.
      new Script(declaration, { filename: `${path}:${name}` });
      declarations.push(declaration);
    }
  }
  const source = '// Generated from unchanged CQB declarations by scripts/training-ballistics.mjs. Do not edit.\n' +
    `export const LEGACY_BALLISTICS_SOURCES = ${JSON.stringify(sources)};\n` +
    'export function createLegacyBallistics(random = globalThis.Math.random) {\n' +
    'const Math = Object.create(globalThis.Math); Math.random = random;\n' +
    declarations.join('\n') + `\nreturn Object.freeze({ ${exports.join(', ')} });\n}\n`;
  return { source, sources };
}

export async function generateBallistics() {
  if(!process.argv.includes("--allow-reference-import"))throw Error("Reference import is opt-in; normal3Dbuild uses independently owned ported modules.");
  const result = await extractBallistics();
  const path = resolve(root, 'apps/training/src/generated/legacy-ballistics.js');
  await mkdir(resolve(path, '..'), { recursive: true });
  if (await readFile(path, 'utf8').catch(() => '') !== result.source) await writeFile(path, result.source);
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateBallistics();
