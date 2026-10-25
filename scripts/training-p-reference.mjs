// External original-2D medical replay. No reference code is shipped in the app.
import{readFile}from'node:fs/promises';import{resolve}from'node:path';import{createHash}from'node:crypto';import{createContext,runInContext}from'node:vm';import{parse}from'acorn';import assert from'node:assert/strict';import{extractMedical}from'./training-medical.mjs';import{CATALOG}from'../apps/training/src/catalog.js';
const root=resolve(import.meta.dirname,'../reference/2d');
async function declaration(path,name){const file=await readFile(resolve(root,path),'utf8'),n=parse(file,{ecmaVersion:2022,ranges:true}).body.find(n=>(n.type==='FunctionDeclaration'&&n.id.name===name)||(n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name===name)));assert.ok(n);const source=file.slice(n.start,n.end);return{path,name,source,sha256:createHash('sha256').update(source).digest('hex')};}
// The resting, untreated subject has no map, enemies, weapon actions or AI.
// These environment boundaries are explicit. Medical/treatment/timer statements
// in updateUnit and all original physiology declarations remain unchanged.
const noops=['tickAIScan','tickSpatialPerception','tickWatchRotation','tickGrenadeReaction','tickUtilityAI','applyPersonalSpace','processShotQueue','updateReload','syncActiveSlotAmmoFromLegacy','updateWeaponSwitch','updateInjuryWeaponHandling','updateMountedWeaponArc','updateLastKnownFromVisibility','decayMemory','maybeSuppressingFire','tickPeek','tickFragPlan','tickSmokeAlert','tickLastHeardNoise','tickAiStateMachine'];
const selectors={pickTarget:null,getBestThreatMemory:null,pickBestLastKnown:null,tickCoverFire:false,isExposedToThreat:false,tryAutoSeekCover:false,findNearbyCover:null,tickDoorInteraction:false,computeWeaponObstructionState:null,resolveActiveWeapon:null,computeAimQuality:1,getLoadHandlingMul:1};
export async function original2DReference(){
 const declarations=await Promise.all([declaration('src/simulation/unit-update.js','updateUnit'),declaration('src/medical/treatment.js','tickPendingMedic'),declaration('src/simulation/threat-throwables.js','tickStanceTransition'),declaration('src/combat/ammo-reload.js','getAcuteActionBlockState'),declaration('src/world/geometry-pathfinding.js','normalizeAngle'),declaration('src/world/geometry-pathfinding.js','angleDiff'),declaration('src/medical/foundation.js','ROTATE_SPEED'),declaration('src/simulation/noise-projectile-effects.js','THREAT_DURATION')]);
 // The original VM never installs 3D slots. Remove only the R2 adapter import;
 // every original declaration and the complete original updateUnit stay exact.
 const extracted=await extractMedical({treatmentAdapters:false});let source=extracted.source.replace(/^import \{preloadTargetR2,circulatingReserveR2\} from '\.\.\/medical-r2.js';\n/m,'').replace(/export /g,'');const pos=source.lastIndexOf('\nreturn {');assert.ok(pos>0);
 const boundaries=noops.map(n=>`function ${n}(){}`).join('\n')+'\n'+Object.entries(selectors).map(([n,v])=>`function ${n}(){return ${JSON.stringify(v)};}`).join('\n');
 source=source.slice(0,pos)+'\n'+boundaries+'\n'+declarations.map(d=>d.source).join('\n')+source.slice(pos).replace('return {','return {updateUnit,');
 const r={seed:0x6d656469,time:0,rear:null,sources:declarations.map(({source,...d})=>d),boundaries:{noops,selectors}};
 const context=createContext({catalog:CATALOG,structuredClone,console,random:()=>{r.seed=(Math.imul(r.seed,1664525)+1013904223)>>>0;return r.seed/4294967296;},rear:()=>r.rear||{candidate:'none',rearArmorResult:'no_rear_armor',penAfter:0,armorValue:0}});
 r.legacy=runInContext(source+'\ncreateLegacyMedical(catalog,random,rear);',context);
 r.actor=r.legacy.makeUnit({team:'enemy',name:'H01',x:0,y:0,loadout:{},bodyArmorId:'none',helmetId:'none',frontPlateId:'none',backPlateId:'none'});r.legacy.ensureMedicalExtensions(r.actor);r.legacy.recalcMedicalSummary(r.actor);r.legacy.syncLegacyCombatState(r.actor);
 r.tick=(dt,time)=>{assert.ok(!r.actor.pendingMedic&&!r.actor.stanceTransition&&!r.actor.painkillerActive&&!r.actor.painkillerDelay&&!r.actor.treatmentTimer&&!r.actor.movePath.length&&!r.actor.throwState);r.time=time;r.legacy.setTime(time);r.legacy.updateUnit(r.actor,dt);};
 return r;
}
