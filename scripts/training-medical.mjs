import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { analyze } from 'eslint-scope';
import { CATALOG } from '../apps/training/src/catalog.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const roots=['makeUnit','createMedical','ensureMedicalExtensions','recalcMedicalSummary','syncLegacyCombatState','applyDamageEvent','tickMedical',
  'validatePartDestructionFoundation','validateWoundPipelineInvariants','validateWoundUiProjection','getAmmoMedicalProfile','normalizeMedicalImpactAddress','computeProjectileKinetics',
  'applyOutcome','OUTCOME','getProjectileDiameterMm'];
// Reviewed boundary: catalog initialization is already performed by training-catalog;
// presentation hooks are optional in the original. Rear armor is a read-only projection
// of the completed 3D trace, never a second armor simulation.
const supplied=new Set(['GAME','Math','resolveRearArmorInteraction',...Object.keys(CATALOG)]);
const excluded=new Set(['log','aarMedicalLog','aarEvent','addFloatingText','emitDustFromAction']);
const builtins=new Set(['Object','Array','Set','Map','Number','String','Boolean','RegExp','JSON','Date','Error','TypeError','Infinity','NaN','undefined','isNaN','isFinite','parseFloat','parseInt','console','structuredClone']);
function free(source) {
  const ast=parse(source,{ecmaVersion:2022,ranges:true});
  return [...new Set(analyze(ast,{ecmaVersion:2022,sourceType:'script',optimistic:true,ignoreEval:true}).globalScope.through.map(r=>r.identifier.name))];
}
export async function extractMedical({treatmentAdapters=true}={}){
  const manifest=JSON.parse(await readFile(resolve(root,'reference/2d/src/manifest.json'),'utf8')),pool=new Map();
  for(const {path} of manifest.scripts){
    const source=await readFile(resolve(root,'reference/2d',path),'utf8'),ast=parse(source,{ecmaVersion:2022,ranges:true});
    for(const node of ast.body){
      const names=node.type==='FunctionDeclaration'?[node.id.name]:node.type==='VariableDeclaration'?node.declarations.filter(d=>d.id.type==='Identifier').map(d=>d.id.name):[];
      for(const name of names)if(!supplied.has(name)&&!excluded.has(name)){
        if(pool.has(name))throw Error(`Duplicate original declaration ${name}`);
        pool.set(name,{path,name,source:source.slice(node.start,node.end),fileSha256:createHash('sha256').update(source).digest('hex')});
      }
    }
  }
  const selected=new Map(),unknown=new Set();
  function visit(name){
    if(selected.has(name)||supplied.has(name)||excluded.has(name)||builtins.has(name))return;
    const declaration=pool.get(name);if(!declaration){unknown.add(name);return;}
    selected.set(name,declaration);for(const dep of free(declaration.source))visit(dep);
  }
  roots.forEach(visit);if(unknown.size)throw Error('Review medical external bindings: '+[...unknown].join(', '));
  // Restore original manifest order (constant initializers may depend on earlier declarations).
  const declarations=[...pool.values()].filter(d=>selected.has(d.name));
  const sources=[];
  for(const d of declarations){let s=sources.find(s=>s.path===d.path);if(!s){s={path:d.path,sha256:d.fileSha256,declarations:[]};sources.push(s);}
    s.declarations.push({name:d.name,sha256:createHash('sha256').update(d.source).digest('hex')});}
  const binding=[...Object.keys(CATALOG)].map(k=>`const ${k}=catalog.${k};`).join('\n');
  // Medical inputs owned by the original updateUnit, not tickMedical. Copy the
  // reviewed original statements verbatim, preserving their before/after order.
  const contextPath='src/simulation/unit-update.js',contextFile=await readFile(resolve(root,'reference/2d',contextPath),'utf8');
  const unitTick=parse(contextFile,{ecmaVersion:2022,ranges:true}).body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='updateUnit');
  const statements=unitTick.body.body.map(n=>contextFile.slice(n.start,n.end));
  const beforeNeedles=['unit.suppression =','unit.pinned =','if (unit.isDowned) unit.downedTime'];
  const afterNeedles=['if (unit.stoppingTimer > 0)','if (unit.flashBlindTimer > 0)','if (unit.flashDeafTimer > 0)','if ((unit.impactKnockdownTimer || 0) > 0)'];
  const select=needles=>needles.map(prefix=>{const matches=statements.filter(s=>s.startsWith(prefix));if(matches.length!==1)throw Error('Original medical context changed: '+prefix);return matches[0];});
  const before=select(beforeNeedles),after=select(afterNeedles);
  const context={path:contextPath,sha256:createHash('sha256').update(contextFile).digest('hex'),before,after,
    statementSHA256:[...before,...after].map(s=>createHash('sha256').update(s).digest('hex'))};
  const hdOriginal=selected.get('updateHemodynamics').source;
  const fatigueStart=hdOriginal.indexOf('  // compensationExhaustion');
  const fatigueEnd=hdOriginal.indexOf('  // compensated/decompensating',fatigueStart);
  if(fatigueStart<0||fatigueEnd<0)throw Error('Review R fatigue source boundary');
  const hdR=hdOriginal.slice(0,fatigueStart).replace('function updateHemodynamics(', 'function updateHemodynamicsR(') +
    `  // R: deficit/load equilibrium, independent of dwell time. Game tuning.
  const deficit=Math.max(0,1-hd.volumeRatio);
  const drive=clamp01((deficit-.40)/.60);
  hd.compensationExhaustion=drive**4*hd.compensationLoad;
`+hdOriginal.slice(fatigueEnd);
  const pulseTerms=selected.get('buildBleedingPulseModel').source.replace('function buildBleedingPulseModel(', 'function getOriginalBleedingPulseTerms(').replace('return { extPulse, intPulse };','return { pressureModifier, pulseModifier, vascularToneModifier, pulsePressureInfluence };');
  const hdR2=hdR.replace('function updateHemodynamicsR(', 'function updateHemodynamicsR2(')
    .replace(/  let preloadTarget;[\s\S]*?  preloadTarget = clampMed\(preloadTarget, 0.05, 1.15\);/, '  let preloadTarget = preloadTargetR2(hd.volumeRatio);')
    .replace('  // MAP\n', `  // R2: filling reserve couples CO and resistance pressure to available flow.
  const reserve=circulatingReserveR2(hd.volumeRatio);
  hd.circulatingReserve=reserve;
  hd.cardiacOutputMul*=reserve;
  hd.strokeVolumeMul*=reserve;
  // MAP
`)
    .replace('hd.systemicVascularResistance * 0.4)', 'hd.systemicVascularResistance * 0.4 * reserve)')
    .replace('hd.strokeVolumeMul * 40, 15, 80', 'hd.strokeVolumeMul * 40, 0, 80');
  if(!hdR2.includes('preloadTargetR2(hd.volumeRatio)')||!hdR2.includes('hd.strokeVolumeMul*=reserve;')||!hdR2.includes('0.4 * reserve)')||!hdR2.includes('hd.strokeVolumeMul * 40, 0, 80'))throw Error('Review R2 hemodynamic source substitutions');
  const bleedR2=selected.get('updateMedicalBleedingWoundBased').source
    .replace('function updateMedicalBleedingWoundBased(', 'function updateMedicalBleedingWoundBasedR2(')
    .replace('Math.max(_targetExt, bp.currentExternal - _rate * dt)', 'bp.rNaturalReduction?.floor != null ? _targetExt + (bp.currentExternal - _targetExt) * Math.exp(-_rate * dt) : Math.max(_targetExt, bp.currentExternal - _rate * dt)')
    .replace('Math.max(_targetInt, bp.currentInternal - _intRate * dt)', 'bp.rNaturalReduction?.floor != null ? _targetInt + (bp.currentInternal - _targetInt) * Math.exp(-_intRate * dt) : Math.max(_targetInt, bp.currentInternal - _intRate * dt)');
  if(!bleedR2.includes('Math.exp(-_rate * dt)')||!bleedR2.includes('Math.exp(-_intRate * dt)'))throw Error('Review R2 natural reduction source substitutions');
  const slots=['buildBodyTrajectoryContext','buildOrganInjuryModel','buildChestTraumaModel','buildConfirmedInjuryModel','buildVascularEvidence','buildFractureEvidence','reinforceVascularEvidenceWithPartDestruction','finalizeBleedingProfileWithEvidence','buildBleedingPulseModel','updateSystemicHypoxiaDamage','updateMedicalPerformanceMultipliers','updateMedicalBleedingWoundBased','updateMedicalBleeding','updateHemodynamics','updateVitalsFromHemodynamics','updatePainShockConsciousness','recalcMedicalSummary','syncLegacyCombatState'];
  const install=`function installMedicalSlots(factory){\nconst slots=factory({${slots.join(',')},recomputeBodyPartFunctionRatio,aggregatePhysiologicEffectProfile,updateHemodynamicsR,updateHemodynamicsR2,updateMedicalBleedingWoundBasedR2,getOriginalBleedingPulseTerms});\n${slots.map(n=>`if(typeof slots.${n}==='function')${n}=slots.${n};`).join('\n')}\n}\n`;
  // M4: 3D-only input coefficients; retained 2D declarations and equations are untouched.
  if(treatmentAdapters)for(const d of declarations)if(d.name==='updateChestTrauma'){
    d.source=d.source.replace('for (const w of m.wounds)', 'for (const w of chestCareTracks(m))').replace('  if (anyChest && m.breathingEfficiency != null)', '  commitChestCareTracks(m);\n  if (anyChest && m.breathingEfficiency != null)').replace('const progRate = sealed ? 0.004 : 0.02;', 'const _m4=chestCareInput(m,w);\n    const progRate = (sealed ? 0.004 : 0.02)*(_m4?.progress??1);')
      .replace('0.01 * _tensionMod * dt','0.01 * _tensionMod * dt * (_m4?.progress??1)')
      .replace('    const drain = Math.min(0.9,','    ctm.tensionPneumothoraxRisk=chestCareTension(m,w,ctm.tensionPneumothoraxRisk,dt);\n    const drain = Math.min(0.9,');
    d.source=d.source.replace('ctm._pneumoProg = Math.min(ceil, ctm._pneumoProg + progRate * dt);','ctm._pneumoProg = chestCareProgress(m,w,ctm._pneumoProg,progRate,ceil,dt);').replace('ctm._pneumoProg > 0.6','(ctm._pneumoProg > 0.6 || chestValveCandidate(w))');
    if(!d.source.includes('const _m4=chestCareInput'))throw Error('Review M4 chest hook source');
  }
  if(treatmentAdapters)for(const d of declarations)if(d.name==='updateStressResponse')d.source=d.source.replace('sr.sympatheticTone = clamp01(approachValue(sr.sympatheticTone, sympTarget,','sr.sympatheticTone = clamp01(approachValue(sr.sympatheticTone, drugSympathetic(m)>0?clamp01(sympTarget+drugSympathetic(m)):sympTarget,');
  const source='// Generated reviewed CQB medical dependency closure; original declarations unchanged.\n'+
    (treatmentAdapters?`import {drugSympathetic} from '../medical-care-drugs.js';\nimport {chestCareInput,chestCareTension,chestCareTracks,commitChestCareTracks,chestCareProgress,chestValveCandidate} from '../medical-care-chest.js';\n`:'')+
    `import {preloadTargetR2,circulatingReserveR2} from '../medical-r2.js';\n`+
    `export const LEGACY_MEDICAL_SOURCES=${JSON.stringify(sources)};\n`+
    `export const LEGACY_MEDICAL_CONTEXT_SOURCE=${JSON.stringify(context)};\n`+
    `export function createLegacyMedical(catalog, random, rearArmorProjection) {\nconst Math=Object.create(globalThis.Math);Math.random=random;\nconst GAME={gameTime:0,debugBallistic:false,debugStrictPipeline:true};\nconst resolveRearArmorInteraction=rearArmorProjection;\n${binding}\n${declarations.map(d=>d.source).join('\n')}\n${hdR}\n${hdR2}\n${bleedR2}\n${pulseTerms}\n${install}function tickUnitMedicalBefore(unit,dt){\n${before.join('\n')}\n}\nfunction tickUnitMedicalAfter(unit,dt){\n${after.join('\n')}\n}\nreturn {${roots.map(n=>['recalcMedicalSummary','syncLegacyCombatState'].includes(n)?`get ${n}(){return ${n};}`:n).join(',')},installMedicalSlots,tickUnitMedicalBefore,tickUnitMedicalAfter,setTime(t){GAME.gameTime=t;},diagnostics(){return {pipelineErrors:GAME._pipelineErrors||[],eventSequence:GAME._woundEventSeq||0};}};\n}\n`;
  return {source,sources,context};
}
export async function generateMedical(){
  if(!process.argv.includes("--allow-reference-import"))throw Error("Reference import is opt-in; normal3Dbuild uses independently owned ported modules.");const r=await extractMedical(),path=resolve(root,'apps/training/src/generated/legacy-medical.js');await mkdir(resolve(path,'..'),{recursive:true});if(await readFile(path,'utf8').catch(()=>'')!==r.source)await writeFile(path,r.source);return r;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await generateMedical();console.log(JSON.stringify(r.sources.map(s=>({path:s.path,count:s.declarations.length}))));}
