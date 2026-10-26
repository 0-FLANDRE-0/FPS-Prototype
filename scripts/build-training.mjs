import{REFERENCE_CIRCULATION}from'../apps/training/src/medical-reference-flow.js';
import{MO2,TEMPORARY_CARE}from'../apps/training/src/medical-mo2-policy.js';
import{execFileSync}from'node:child_process';
import{generateSCAR}from'./training-scar-model.mjs';
import{generateScarZeroing}from'./training-scar-zeroing.mjs';
import{SCAR_DATA}from'../apps/training/src/scar-data.js';
import {RG1} from '../apps/training/src/ragdoll-lifecycle.js';
import {AI1,AI_SKILLS,aiSkill,FIRE_STYLES} from '../apps/training/src/ai1-config.js';
import {KILLHOUSE,KH_ROOMS,KH_PORTALS,KH_BOXES,KH_PLACEMENTS,KH_PATROLS,KH_GUARD_LOOKS} from '../apps/training/src/killhouse-config.js';
import{PLATE_SHAPES,PLATE_MOUNTS}from'../apps/training/src/plate-shapes.js';
import{PLATE_ACTION_SECONDS}from'../apps/training/src/plate-inventory.js';
import{SEARCH_SECONDS}from'../apps/training/src/corpse-inventory.js';
import {HEAD_VISUAL_LAYOUT} from '../apps/training/src/equipment-head-layout.js';
import{EQUIPMENT}from'../apps/training/src/equipment-data.js';
import{Inventory}from'../apps/training/src/inventory.js';
import{M4B}from'../apps/training/src/medical-care-m4b-policy.js';
import{MEDIC_SUPPORT}from'../apps/training/src/medical-supplies.js';
import{SYSTEMIC_CARE}from'../apps/training/src/medical-care-systemic.js';
import{MEDIC_POUCH}from'../apps/training/src/medical-supplies.js';
import{CARE}from'../apps/training/src/medical-care-state.js';
import{MEDICAL_ITEMS,MEDICAL_SUPPLIES,IFAK}from'../apps/training/src/medical-supplies.js';
import{LIMB_ROUTING}from'../apps/training/src/medical-routing.js';
import{MEDICAL_VIEW}from'../apps/training/src/medical-view.js';
import{MEDICAL_SURFACE}from'../apps/training/src/medical-surface.js';
import {RETINAL_RESPONSE} from '../apps/training/src/retinal-response.js';
import {D2} from '../apps/training/src/medical-d2.js';
import {BLACKOUT_REMNANT} from '../apps/training/src/blackout-remnant.js';
import {EYELIDS} from '../apps/training/src/medical-eyelids.js';
import {RETINAL_VISION} from '../apps/training/src/retinal-vision.js';
import {MEDICAL_WAVES} from '../apps/training/src/medical-waveforms.js';
import {D1} from '../apps/training/src/medical-feedback.js';
import {AIM_HOLD} from '../apps/training/src/medical-aim-hold.js';
import {PLAYER_FALL} from '../apps/training/src/player-fall.js';
import {PLAYER_DROP} from '../apps/training/src/player-weapon-drop.js';
import {SOUND} from '../apps/training/src/sound-acoustics.js';
import {AUDIO_TUNING,FOOTSTEP_AUDIO} from '../apps/training/src/sound-tuning.js';
import {GAIT} from '../apps/training/src/gait.js';
import {LOCOMOTION} from '../apps/training/src/locomotion-tuning.js';
import {FOOT_CONTACT} from '../apps/training/src/foot-contact.js';
import {MEDICAL_B1C_VALUES} from '../apps/training/src/medical-b1c.js';
import {MEDICAL_B1B_VALUES} from '../apps/training/src/medical-b1b.js';
import {MEDICAL_B1_VALUES} from '../apps/training/src/medical-b1.js';
import {MEDICAL_S2_VALUES} from '../apps/training/src/medical-s2-effects.js';
import {MEDICAL_S3B_VALUES} from '../apps/training/src/medical-s3b-effects.js';
import {MEDICAL_S3_VALUES} from '../apps/training/src/medical-s3-effects.js';
import {WOUND_S3_VALUES,S3_TERMINAL_SETTINGS} from '../apps/training/src/wound-s3-types.js';
import {S3_DAMAGE_INDICES,S3_DAMAGE_INDEX_VALUES} from '../apps/training/src/damage-index-s3.js';
import {BODY_CHANNEL_RULE_ID} from '../apps/training/src/body-channel.js';
import {DEBUG_WEAPON} from '../apps/training/src/debug-weapon.js';
import {WOUND_S1_VALUES,WOUND_S2_VALUES,WOUND_PROFILES,WOUND_LUT_INFO} from '../apps/training/src/wound-channel.js';
import {MEDICAL_S1_PHYSIOLOGY_VALUES} from '../apps/training/src/medical-s1-effects.js';
import WOUND_PROFILE_MAP from '../apps/training/src/generated/wound-profile-map.json' with {type:'json'};
import {MEDICAL_S0_VALUES} from '../apps/training/src/medical-s0.js';
import {RAGDOLL_STABILITY} from '../apps/training/src/ragdoll-stability.js';
import {RAGDOLL_SETTLING} from '../apps/training/src/ragdoll-settling.js';
import {BRACE_TUNING} from '../apps/training/src/fall-brace.js';
import {generateEnemyAnimations} from './training-enemy-animations.mjs';
import {ENEMY_ANIMATION_TUNING} from '../apps/training/src/enemy-combat-pose.js';
import {SOLDIER_AK_GRIP} from '../apps/training/src/generated/soldier-ak-grip.js';
import {generateSoldierFingers} from './training-soldier-fingers.mjs';
import {COMBAT,COMBAT_BOXES} from '../apps/training/src/combat-config.js';
import {MUSCLE} from '../apps/training/src/muscle-data.js';
import {combatMassLedger} from '../apps/training/src/combat-mass.js';
import {RAGDOLL_SEGMENTS,RAGDOLL_TUNING,SEGMENT_MASS_FRACTIONS,JOINT_ROM_DEG} from '../apps/training/src/ragdoll-data.js';
import {MEDICAL_R2_VALUES} from '../apps/training/src/medical-r2.js';
import {MEDICAL_R_VALUES} from '../apps/training/src/medical-r.js';
import INTERNAL_PROFILE from '../apps/training/src/internal-profile.json' with {type:'json'};
import { build as bundle } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {FLIGHT_RULE_ID,FLIGHT_LIMITS} from '../apps/training/src/flight.js';
import {LONG_RANGE,PLAYER} from '../apps/training/src/config.js';
import { generateZeroing } from './training-zeroing.mjs';
import {generateFlightTuning} from './training-flight-tuning.mjs';
import {SPRINT} from '../apps/training/src/sprint.js';
import {LEAN} from '../apps/training/src/lean.js';
import {FPS_HANDLING} from '../apps/training/src/handling-animation.js';
import { MEDICAL_V2_RULE_ID, MEDICAL_V2_VALUES, DOWN_REASON_PRIORITY } from '../apps/training/src/medical-v2.js';
import { generateArmorMesh } from './training-armor-mesh.mjs';
import { generateSoldierRig } from './training-soldier-rig.mjs';
import { generateSoldierSkin } from './training-soldier-skin.mjs';
import { generateHeadMesh } from './training-head-mesh.mjs';
import { generateWebP } from './training-webp.mjs';
import {generateSharedFPS} from './training-shared-fps-model.mjs';
import {generateVudu} from './training-vudu-model.mjs';
import {VUDU} from '../apps/training/src/optic-data.js';
import {VUDU_OPTICS} from '../apps/training/src/optic-optics.js';
import {SR3} from '../apps/training/src/optic-reticle.js';
import {OPTICS} from '../apps/training/src/optic-data.js';
import {generateSideOpticsAssets,SIDE_TEXTURE_POLICY} from './training-side-optics-assets.mjs';
export const root = fileURLToPath(new URL('../', import.meta.url));

export async function buildTraining() {
  await mkdir(resolve(root,'artifacts/qa'),{recursive:true});
  const ports=JSON.parse(await readFile(resolve(root,'apps/training/data/ported-v69.json'),'utf8'));
  const legacy={sources:ports.legacyBallisticsSources},flight={sources:ports.legacyFlightSources};
  const flightTuning=await generateFlightTuning();
  const zeroing=await generateZeroing({retentionByCaliber:flightTuning.tuning.overrides});
  const protection={sources:ports.legacyProtectionSources},medical={sources:ports.legacyMedicalSources,context:ports.legacyMedicalContext};
  const { SOFT_OBLIQUITY, BODY_REFERENCE_M, BODY_EXIT_RULE_ID } = await import('../apps/training/src/protection.js');
  const { ARMOR_PROFILE } = await import('../apps/training/src/armor-targets.js');
  const { HELMET_RICOCHET_RULE_ID, HELMET_RICOCHET_PROFILES } = await import('../apps/training/src/helmet-ricochet.js');
  const armorMesh = await generateArmorMesh();
  const headMesh = await generateHeadMesh();
  const gripSourceValidation={sourceSHA256:{},normalAKFingerPoseUnchanged:true,debugMagazineVisibilityOnly:false};
  for(const [path,expected]of Object.entries(SOLDIER_AK_GRIP.sourceCodeSHA256||{})){
    const code=await readFile(resolve(root,path),'utf8'),actual=createHash('sha256').update(code).digest('hex');gripSourceValidation.sourceSHA256[path]=actual;
    if(actual===expected)continue;
    // The sole permitted S2 difference keeps the debug-only virtual magazine
    // visible. Replacing precisely that guard must reproduce the original
    // whole-file fingerprint; every hand/finger/animation statement is checked.
    const normal=path==='apps/training/src/fps-arms.js'?code.replace('!inventory.magazine&&!inventory.isDebugWeapon&&!reloading','!inventory.magazine&&!reloading'):code;
    if(createHash('sha256').update(normal).digest('hex')!==expected){const w1=JSON.parse(await readFile(resolve(root,'docs/w1-ak-compatibility.json'),'utf8'));if(w1.sourceSHA256[path]!==actual)throw Error('Refresh common AK grip extraction: '+path);gripSourceValidation.w1SCARBranch=true;}
    gripSourceValidation.debugMagazineVisibilityOnly=true;
  }
  const soldierRig = await generateSoldierRig({headMesh});
  const soldierSkin = await generateSoldierSkin(soldierRig.glb);
  const webp = await generateWebP();
  const sharedFPS=await generateSharedFPS();
  const scarFPS=await generateSCAR(),scarZeroing=await generateScarZeroing(),scarCredits=JSON.parse(await readFile(resolve(root,"apps/training/assets/scar-credits.json"),"utf8"));
  const optic=await generateVudu();
  const opticCredits=JSON.parse(await readFile(resolve(root,'apps/training/assets/vudu-credits.json'),'utf8'));
  const fps={glb:sharedFPS.gun,meta:sharedFPS.akSource};
  const m4Arms={glb:sharedFPS.arms,meta:sharedFPS.m4Source};
  const fpsCredits=JSON.parse(await readFile(resolve(root,'apps/training/assets/fps-credits.json'),'utf8'));
  const m4ArmsCredits=JSON.parse(await readFile(resolve(root,'apps/training/assets/m4-arms-credits.json'),'utf8'));
  const soundSprite=await readFile(resolve(root,'apps/training/assets/sounds/prepared/snd1-sprite.wav'));
  const soundAssets=JSON.parse(await readFile(resolve(root,'apps/training/assets/sounds/prepared/manifest.json'),'utf8'));
  const soundCredits=JSON.parse(await readFile(resolve(root,'apps/training/assets/sound-credits.json'),'utf8'));
  const testModels = JSON.parse(await readFile(resolve(root, 'docs/training-model-audit.json'), 'utf8'));
  const sourceAsset = await readFile(resolve(root, 'apps/training/assets/m4a1-training.glb'));
  const sideAssets=await generateSideOpticsAssets({weapon:webp.weapon.glb,fps:sharedFPS.gun,arms:sharedFPS.arms,vudu:optic.glb,soldier:webp.soldier.glb});
  const asset=sideAssets.weapon.glb;fps.glb=sideAssets.fps.glb;m4Arms.glb=sideAssets.arms.glb;
  const opticAssets=Object.fromEntries(['xps3','acog'].map(name=>[name,sideAssets[name]]));
  const credits = JSON.parse(await readFile(resolve(root, 'apps/training/assets/credits.json'), 'utf8'));
  if (createHash('sha256').update(sourceAsset).digest('hex') !== credits.preparedSha256) throw new Error('Weapon asset differs from its recorded preparation');
  const fingerAsset=await generateSoldierFingers(sideAssets.soldier.glb);
  const soldier=fingerAsset.glb;
  const enemyAnimations=await generateEnemyAnimations();
  const soldierCredits = JSON.parse(await readFile(resolve(root, 'apps/training/assets/soldier-credits.json'), 'utf8'));
  soldierCredits.preparedSha256 = fingerAsset.meta.sha256;
  soldierCredits.changes = 'Derived normalized 1.8m GLB with native 24-joint skin plus 30 source-geometry finger joints and four native v9 clips; component-based equipment mounts and an authored inner uniform torso. Original source and native v9 GLB preserved. Separate WebP texture derivative of the immutable v13 skin. Topology/UVs/materials/non-image buffers retained; inner garment is the v13 additional primitive. Texture resolution unchanged; normals lossy q90, other maps recompressed q90/q92 per user side-update policy. Final finger derivative adds 30 measured finger bones and changes only exposed finger skin weights; palms/back retained. Common AK Idle/TriggerOnly rotations reused with at most15-degree fingertip correction; ragdoll fingers fixed in relaxed pose. Collision/protection unchanged.';
  const result = await bundle({ absWorkingDir: root, entryPoints: ['apps/training/src/main.js'], bundle: true, format: 'iife', target: ['es2020'], minify: true, write: false, legalComments: 'inline', metafile: true, define: { 'process.env.NODE_ENV': '"production"' } });
  const script = result.outputFiles[0].text;
  const css = await readFile(resolve(root, 'apps/training/styles.css'), 'utf8');
  const licenses = {
    three: await readFile(resolve(root, 'node_modules/three/LICENSE'), 'utf8'),
    rapier: await readFile(resolve(root, 'node_modules/@dimforge/rapier3d-compat/LICENSE'), 'utf8'),
  };
  let html = await readFile(resolve(root, 'apps/training/index.template.html'), 'utf8');
  if (/<\/script[\s/>]/i.test(script) || /<\/style[\s/>]/i.test(css)) throw new Error('Unsafe inline closing tag');
  for (const [marker, value] of [['/* @training:styles */', css], ['/* @training:model */', asset.toString('base64')],
    ['/* @training:fps */',fps.glb.toString('base64')],
    ['/* @training:scar */',scarFPS.glb.toString('base64')],
    ['/* @training:m4arms */',m4Arms.glb.toString('base64')],
    ['/* @training:optic */',sideAssets.vudu.glb.toString('base64')],
    ['/* @training:xps3 */',opticAssets.xps3.glb.toString('base64')],
    ['/* @training:acog */',opticAssets.acog.glb.toString('base64')],
    ['/* @training:soldier */', soldier.toString('base64')],
    ['/* @training:sound */',soundSprite.toString('base64')],
    ['/* @training:licenses */', JSON.stringify(licenses).replaceAll('<', '\\u003c')], ['/* @training:script */', script]]) {
    if (html.split(marker).length !== 2) throw new Error('Missing or duplicate training template marker');
    html = html.replace(marker, () => value);
  }
  await mkdir(resolve(root, 'dist'), { recursive: true });
  const path = resolve(root, 'dist/CQB_Training.html');
  await writeFile(path, html);
  const info = {medicalOverhaul:{stage:'MO2b-reference-flow',complete:false,branch:'feature/medical-overhaul',policy:MO2,referenceCirculation:REFERENCE_CIRCULATION,temporary:TEMPORARY_CARE,ledger:'docs/mo2b-ledger.json',contract:'docs/mo2b-instructions.md'},project:{repository:'0-FLANDRE-0/FPS-Prototype',baseline:'CQB-HTML v69',independent3DBuild:true,reference2DRequired:false},w1:{sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),version:'w1-v69',values:SCAR_DATA,model:scarFPS.meta,zeroing:scarZeroing,credits:scarCredits,ledger:'docs/w1-ledger.json',raw2DUnchanged:true,classification:'출처 / 원본 / 튜닝 / 사용자 설계값 / 게임 허용'},rg1:{version:'rg1-v68',values:RG1,classification:'사용자 설계값·튜닝·게임 허용',ledger:'docs/rg1-ledger.json',rapierUpgrade:false,clinicalBallisticProtectionEquationsChanged:false},ai1:{version:'ai1-senses-v67',classification:'원본 2D 침착성 프로필·AimState·RecoilState·SND1 읽기 + 사용자 설계값·튜닝·게임 허용',values:AI1,skills:Object.fromEntries(AI_SKILLS.map(id=>[id,aiSkill(id)])),fireStyles:FIRE_STYLES,killhouse:{...KILLHOUSE,rooms:KH_ROOMS,portals:KH_PORTALS,boxes:KH_BOXES,placements:KH_PLACEMENTS,patrols:KH_PATROLS,guardLooks:KH_GUARD_LOOKS},ledger:'docs/ai1-senses-ledger.json',sources:'docs/ai1-senses-sources.json',medicalBallisticProtectionEquationsChanged:false,separateAIDispersion:false,existing3DMOADraw:false,scope:'AI1 only; AI2 utility brain/cover/search and AI3 teamwork deferred'},equipmentM7b:{version:'v66',mounts:PLATE_MOUNTS,sideHeightM:1.135,sideHeightClassification:'사용자 설계값: v65보다150mm 하향',sideXZClassification:'튜닝: 원본6B45 본체 소프트 삼각형 안쪽 맞춤',sideSizeM:[.15,.20],ledger:'docs/equipment-m7b-ledger.json',scope:'3D side mounts only; other runtime files byte-exact versus v65'},equipmentM7:{plateShapes:PLATE_SHAPES,mounts:PLATE_MOUNTS,plateActionSeconds:PLATE_ACTION_SECONDS,searchSeconds:SEARCH_SECONDS,ledger:'docs/equipment-m7-ledger.json',sources:'docs/equipment-m7-sources.json',scope:'3D plate instances/shape/membership and unconscious or dead enemy inventory; no M5; raw2D and protection/medical equations unchanged'},equipmentM6:{visualFixV64:{layout:HEAD_VISUAL_LAYOUT,ledger:"docs/equipment-mesh-fix-v64-ledger.json",classification:"원본 표면/UV 검수 + 시각 분리 튜닝, 의료·방호 형상 불변"},values:EQUIPMENT,initial:new Inventory({includePlates:true,includeEquipment:true,includeMedical:true,includeAbdominal:true,includeMedic:true}).snapshot().equipment,oneHandBlood:true,ledger:'docs/equipment-m6-ledger.json',sources:'docs/equipment-m6-sources.json',instructions:'docs/training-m6-instructions.md',raw2DAndMedicalEquationsPreserved:true,authoredRuntimeMesh:'balaclava/scalp and neck connector; source GLBs byte preserved',scope:'player gear storage/drop/pickup; shared mesh partition; no M5/AI gear removal/belt or backpack drop; no bullet-vs-item'},treatmentM4c:{status:'replaced by MO2; old modes and coefficients removed'},treatmentM4b:{values:M4B,pouch:MEDIC_SUPPORT,classification:'임시 고정 — 해당 단계에서 재작성; 기존 리얼리스틱 약물·수혈 효과 유지',ledger:'docs/care-m4b-ledger.json',sources:'docs/care-m4b-sources.json'},treatmentM4:{temporary:TEMPORARY_CARE,scope:'TXA, chest items, NPA pending their later rewrite'},selfCare:{values:MO2,patient:'self',resourceAuthority:'createMedicalSupply and instance.remaining; no refill synchronizer',classification:'사용자 설계값 / 튜닝 / 게임 허용'},medicalItems:{ruleId:MEDICAL_ITEMS.ruleId,values:MEDICAL_ITEMS,supplies:MEDICAL_SUPPLIES,ifak:IFAK,limbRouting:LIMB_ROUTING,classification:'제품 무게 출처 / CAT2개·외부2x2·내부3x3 사용자 설계 / 내부 격자 실크기 비례 아님(게임 허용)',treatmentEffects:true,untreatedClinicalTimelineBytePreserved:true,legacyCompatibilityRatesPreserved:true,changedMedicalFields:['bloodPoolsMl','appliedTreatments when used','controlFactor and derived clinical response only when treated'],d2EquipmentMassInputKg:'inventory.carriedMassKg; default legacy13.7 retained in D2 data',ledger:'docs/self-care-m3-ledger.json',sources:'docs/self-care-m3-sources.json'}, medicalUI:{values:MEDICAL_VIEW,surfaceRecords:MEDICAL_SURFACE,patient:'self only',simulation:'active tabs continue physiology/AI/audio; pause freezes; active self-care or M4 intervention continues down physiology until death',storage:'same InventoryUI / same6x5bag DOM node',treatment:'MO2 single policy, per-wound bandage/gauze/injector/foam, one CAT per limb; temporary fixed TXA/drug/blood/chest items',legacyDebug:'internalRegions only',surfaceStorage:'M1 immutable weak skin records; trace/HP/channel unchanged',classification:'M1 user design; observation/projection thresholds tuning; no2D changes',ledger:'docs/medical-ui-m1-ledger.json',sources:'docs/medical-ui-m1-sources.json'}, activityD2:{...D2,effectiveEquipmentMassSource:'inventory.carriedMassKg (M6)',baseline:'v54',ledger:'docs/medical-d2-ledger.json',sources:'docs/medical-d2-sources.json',concussion:'S2 skull cavity risk only; no LOC/stagger added; shared tinnitus channel',zeroExercise:'retained physiology byte equality; post-exercise HR recovery explicitly active',exercise:'separate HR contribution, preload-limited pump/contractility, supply/demand oxygen, regional bleeding factors',hud:'8 anatomical parts,6 postures,2 stamina bars; DOM outside postprocessing',blackoutComposite:'20% remnant first; eyelids cover it; unconscious black last'},shotOptimization:{ruleId:'shot-optimization-d1c-v54',classification:'원본 계산 보존 / 튜닝 성능 목표',synchronous:true,formulaChanges:false,byteIdenticalRequired:true,staticMeshBVH:true,sourceTriangleOrderPreserved:true,wholeForwardRayWinding:true,internalShapeBroadphase:true,internalPrimitiveBroadphase:true,poseCache:'exact actor transform and used bone matrix comparison; private weak cache',targetsMs:{hitP95:4,miss:1},ledger:'docs/d1c-v54-ledger.json'},medicalFeedback:{ruleId:D1.ruleId,classification:'원본 성능 기여식 읽기 + D1 사용자 설계/튜닝',values:D1,blackoutRemnant:BLACKOUT_REMNANT,eyelids:EYELIDS,retinal:RETINAL_VISION,retinalResponse:{...RETINAL_RESPONSE,ledger:'docs/vision-stability-v56-ledger.json',physiologyReadOnly:true,unconsciousnessImmediate:true},waveforms:MEDICAL_WAVES,aimHold:AIM_HOLD,playerFall:PLAYER_FALL,playerWeaponDrop:PLAYER_DROP,visionDriver:'grayscale/peripheral: volume deficit; tunnel/blackout: max(volume, eye-heart hydrostatic MAP and tissue/oxygen delivery)' ,physiologyReadOnly:true,projectileDispersionAdded:false,additionalPassBeyondLens:0,maximumFullscreenPasses:1,identityPassWhenLensDisabled:true,ledger:'docs/medical-d2-ledger.json',sources:'docs/medical-d2-sources.json'},playerLocomotion:{classification:'원본 Mixamo 리타깃 + 접지/표현 튜닝',values:LOCOMOTION,gait:GAIT,movementSpeedsMps:{walk:PLAYER.speed,crouch:PLAYER.crouchSpeed,run:SPRINT.speedMps,enemyWalk:COMBAT.walkSpeedMps},contacts:FOOT_CONTACT,source:'apps/training/assets/sounds/prepared/locomotion.json',sourceFittedBootVertices:108,sharedPlayerBodyPhase:true,cameraAndWeaponFromBody:true,playerProxyIK:'pelvis reach projection, spine/chest eye IK, ankle IK; no limb scaling',ledger:'docs/gait-audibility-v50-ledger.json'},sound:{footstepTuning:{classification:'튜닝(보행/가청 범위 사용자 피드백)',values:FOOTSTEP_AUDIO,ledger:'docs/gait-audibility-v50-ledger.json'},samplePolicy:{classification:'사용자 피드백 + 튜닝',excludedGroups:soundAssets.excludedGroups,concreteGroup:'walk:concrete_walk+concrete_aux; run:concrete_run',speech:soundAssets.speechExclusions,metalEnvelope:soundAssets.metalEnvelope,ledger:'docs/locomotion-v49-ledger.json'},playbackTuning:{classification:'튜닝(사용자 피드백)',...AUDIO_TUNING,ledger:'docs/sound-tuning-v47-ledger.json'},values:SOUND,assetBytes:soundSprite.length,assetSha256:createHash('sha256').update(soundSprite).digest('hex'),clips:Object.keys(soundAssets.clips).length,credits:soundCredits,ledger:'docs/sound-snd1-ledger.json',sources:'docs/sound-snd1-sources.json',physicalAudioAndAIShared:true,ballisticMedicalChanges:false},bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), assetBytes: asset.length,
    enemyAnimations:{...enemyAnimations.meta,runtimeTuning:{classification:'튜닝',values:ENEMY_ANIMATION_TUNING},legIKClassification:'튜닝: segment/knee-plane correspondence, 3 mm floor clearance, 60 Hz/adaptive refinement; source ankle motion and measured rest geometry retained',runtimeEmbedded:true,enemyOnly:true,playerProxyNativeClipsPreserved:true,ledger:'docs/enemy-animation-ledger.json'},
    flight:{ruleId:FLIGHT_RULE_ID,...FLIGHT_LIMITS,method:'RK4 gravity + unchanged retention drag;3D5.56 BDC inverse-fit;W1M80/M993 G7 table; swept chord collisions',instantResolution:true,wind:false,zeroing:true,range:LONG_RANGE},flightTuning,legacyFlightSources:flight.sources,
    fpsAssetBytes:fps.glb.length,fpsModelCredits:fpsCredits,fpsDerivative:sharedFPS.meta.gun,fpsSourceDerivative:fps.meta,
    sharedFPSDerivative:sharedFPS.meta,
    sideOpticsAssets:Object.fromEntries(Object.entries(sideAssets).map(([name,data])=>[name,data.meta])),sideTexturePolicy:SIDE_TEXTURE_POLICY,
    optic:{stage:'three optics and focus' ,definitions:OPTICS,referenceUserHTMLSHA256:'537ae93e8279997ac8d770792fd7709241da9a38c32436f1eade14562e9b4975',definition:VUDU,derivative:optic.meta,credits:opticCredits,zeroing:true,pip:true,optics:VUDU_OPTICS,reticle:SR3,originalRegistriesUnchanged:true},
    m4ArmsAssetBytes:m4Arms.glb.length,m4ArmsModelCredits:m4ArmsCredits,m4ArmsDerivative:sharedFPS.meta.arms,m4ArmsSourceDerivative:m4Arms.meta,
    handling:{animationAuthority:true,profiles:FPS_HANDLING,originalRegistryUnchanged:true,gripSourceValidation},
    combat:{stage:'enemy Mixamo animation retarget v37',sector:'04',maximumEnemies:1,tuning:COMBAT,boxes:COMBAT_BOXES,kitMass:combatMassLedger(),ragdoll:{...RAGDOLL_TUNING,precreated:true,inactiveType:'position-based kinematic',inactiveGroups:0,inactiveSensor:true,solverWarmup:'isolated world once per session; live game untouched',ccdBones:RAGDOLL_SEGMENTS.map(p=>p.bone),frozenBodiesDisabled:true,hitShapesRetained:true,sleepingBoneSyncSkipped:true,hitWakesAllBodies:true,shaderPrecompile:'renderer.compile at combat sector entry',fingerBodies:0,fingerJoints:0,fixedRelaxedFingers:true,segmentMassFractions:SEGMENT_MASS_FRACTIONS,anatomicalROM:JOINT_ROM_DEG,headNeckSplit:'capsule volume — geometric tuning',strength:'medical read-only; enabled only after collapse',stability:RAGDOLL_STABILITY,settling:RAGDOLL_SETTLING,protectiveReach:BRACE_TUNING,jointAPI:'impulse generic; multibody binding tested and rejected for missing angular controls',acceptance:{maximumJointExcessDeg:10,settledAngularRadps:.5,stationaryCOMLimitM:1,movingCOMSpeedDurationS:.8,maximumSlipM:.15},preparedSolverIterations:MUSCLE.passiveSolverIterations,zeroROMAxes:'locked angular DOF; unchanged anatomical limits',muscleTuning:MUSCLE,standing:'100% animation with v33 procedural flinch; weapon released only on medical collapse',pelvisAnchor:{bodies:0,joints:0,colliders:0},collapseTargets:'enemy current mixed movement continues; stationary pose freezes; legacy native fallback and v36 muscle/brace/PD formulas unchanged',animationTargetRig:true,prewarmAt:'sector entry',performanceGoalRatio:1.5},
      playerProxy:{sameSoldierAsset:true,bones:54,hiddenLayer:4,sharedFPSArmsUnchanged:true,selfHitsExcluded:true,gunHits:false},judgment:'temporary replaceable state machine; original 2D AI not yet ported',equations:'external flight/wall/protection and physiology equations unchanged; S3 typed5.56/5.45 terminal and physical-volume HP',ledger:'docs/combat-ai1-ledger.json',collapseMotionLedger:'docs/collapse-motion-ledger.json',fallStabilityLedger:'docs/fall-stability-ledger.json'},
    zeroing,
    debugWeapon:{...DEBUG_WEAPON,slotNumber:3,separateFromOrdinaryEquipment:true,allRegistryAmmo:true,infiniteMagazine:true,muzzleVelocitySource:"selected registry reference or explicit debug override",normalAKRecoilSoundModel:true,zeroCondition:"AK П 100m/+0.24m; selected-ammo automatic zero default off",mobileButton:true,tableSource:"original2D ammunition table helpers/registry, with caliber and projectile mass"},
    sprint:{...SPRINT,sourceClip:'Rig|AK_Run',m4Retargeted:true,extraModelAssets:false,stamina:true},
    lean:{...LEAN,classification:'튜닝; 공식 동작 자료 없음',defaultMode:'hold',keys:['Q','E'],playerHitVolumes:true,
      pivot:'height proportional; pelvis rotation plus lateral torso shift to reach requested .25m head travel',collision:'head sphere .12m; safe leaned shoulder to muzzle sphere .03m and weapon retraction; .02m clearance; rendered interpolation also constrained; exclude player and sensors',shoulderGeometry:{dropM:.07,classification:'원본 v30 firing shoulder offset'},cantCompensation:false},
    soldierAssetBytes: soldier.length,soldierFingers:{...fingerAsset.meta,grip:{source:SOLDIER_AK_GRIP.source,maxCorrectionDeg:15,idleTimeS:0,triggerSource:'native AK TriggerOnly through unchanged common rig',releaseDurationS:0,ragdollFingersFixed:true,ledger:'docs/soldier-ak-grip-ledger.json'}}, soldierModelCredits: soldierCredits, armorMeshSource: armorMesh.source, headMeshSource: headMesh.source, soldierRig: soldierRig.meta, soldierSkin: soldierSkin.meta, textureDerivatives: {soldier:webp.soldier.meta,weapon:webp.weapon.meta},
    targetInspection: { targetId: 'H01', pose: 'rest', poseLocked: true, animationPlayback: false, woundsEnabled: true },
    medical: { defaultModel: 'v2', availableModels: ['legacy','v2'], v2: {ruleId:MEDICAL_V2_RULE_ID, values:MEDICAL_V2_VALUES, downReasonPriority:DOWN_REASON_PRIORITY, ledger:'docs/medical-v2-ledger.json', sourceDeclarationsUnchanged:true,s0:{values:MEDICAL_S0_VALUES,ledger:'docs/medical-s0-ledger.json',independent3D:true,classification:'튜닝; original 2D files and legacy declarations preserved'},s1:{values:WOUND_S1_VALUES,physiologyValues:MEDICAL_S1_PHYSIOLOGY_VALUES,profiles:WOUND_PROFILES,lookup:Object.fromEntries(Object.entries(WOUND_LUT_INFO).filter(([k])=>k!=='loadTimeMs')),cartridges:Object.keys(WOUND_PROFILE_MAP).length,profileMapSHA256:createHash('sha256').update(JSON.stringify(WOUND_PROFILE_MAP)).digest('hex'),independent3D:true,ledger:'docs/medical-s1-ledger.json',calibrationInputs:'docs/medical-s1-calibration-inputs.json',classification:'출처 도판 + original registry dimensions + explicitly tuned one-dimensional cavity approximation',terminalExitUnchanged:false,supersededBy:'s2',armorDeformationApplied:false,armorYawApplied:false},s2:{ruleId:BODY_CHANNEL_RULE_ID,values:WOUND_S2_VALUES,structuralValues:MEDICAL_S2_VALUES,lookup:Object.fromEntries(Object.entries(WOUND_LUT_INFO).filter(([k])=>k!=='loadTimeMs')),ledger:'docs/medical-s2-ledger.json',sources:'docs/medical-s2-sources.json',independent3D:true,authoritativeBodyVelocity:true,oneIntegrationPerPart:true,legacyBodyResistanceRetained:true,classification:'source densities + original gelatin calibration + explicit tissue/bone/structural tuning',concussionPhysiologyApplied:true,concussionOverride:'D2 independent symptom state; original S2 record unchanged'},b1c:{values:MEDICAL_B1C_VALUES,ledger:'docs/medical-b1c-ledger.json',sources:'docs/medical-b1c-sources.json',baseline:'v44',classification:'user2/3 ceiling; tuning union lesions; sourced hepatic/portal dimensions with ratio-authored paths'},b1b:{values:MEDICAL_B1B_VALUES,supersededBy:'b1c',ledger:'docs/medical-b1b-ledger.json',sources:'docs/medical-b1b-sources.json',baseline:'v43',classification:'sourced organ flow fractions; severity/closure and attribution tuning; arterial regional cap removed'},b1:{values:MEDICAL_B1_VALUES,supersededBy:'b1b',additionalTuning:{venaCavaNormalFlowFraction:.7,organNormalFlowFraction:.2,oozeMuscleFloorFraction:.001,estimatedFallbackDiameterM:.004,modeledAmputationArmDiameterM:.006,modeledAmputationLegDiameterM:.008},ledger:'docs/medical-b1-ledger.json',sources:'docs/medical-b1-sources.json',baseline:'v42',classification:'3D orifice sources / CO cap; treatment placeholders only; source vs tuning recorded'},s3b:{values:MEDICAL_S3B_VALUES,ledger:'docs/medical-s3b-ledger.json',sources:'docs/medical-s3b-sources.json',baseline:'v41',independent3D:true},s3:{values:MEDICAL_S3_VALUES,terminalValues:WOUND_S3_VALUES,terminalSettings:S3_TERMINAL_SETTINGS,damageIndices:S3_DAMAGE_INDICES,damageIndexDefinition:Object.fromEntries(Object.entries(S3_DAMAGE_INDEX_VALUES).filter(([k])=>k!=='loadTimeMs')),ledger:'docs/medical-s3b-ledger.json',sources:'docs/medical-s3b-sources.json',independent3D:true,originalRegistriesUnchanged:true,otherCalibers:'v40 HP equation retained; uncalibrated',classification:'original thresholds and types except explicit3D M855 fragment override; source plate donors + shared type tuning + user-designed part HP'}}, entry: 'applyDamageEvent', initializer: 'makeUnit/createMedical', tick: 'tickUnitMedicalBefore → tickMedical → tickUnitMedicalAfter', randomStream: 'separate after completed ballistic trace',
      internalAnatomy:{ruleId:INTERNAL_PROFILE.ruleId,structures:INTERNAL_PROFILE.shapes.length,profileBytes:Buffer.byteLength(JSON.stringify(INTERNAL_PROFILE)),profileSHA256:createHash('sha256').update(JSON.stringify(INTERNAL_PROFILE)).digest('hex'),nearMissM:INTERNAL_PROFILE.nearMissM,defaultVisible:false,placementSource:'measured bone/body section ratios; tuning; no clinical atlas',noBallisticMutation:false,originalShapeDefinitionsUnchanged:true,ballisticUse:"cached tissue/enclosure intervals drive authoritative S2 body losses"},rValues:MEDICAL_R_VALUES,r2Values:MEDICAL_R2_VALUES, geometryEnergyDepth: 'single cached S2 body channel; S3 5.56/5.45 typed terminal and effective cm3 × common C for HP; other caliber v40 HP equation; original physiology and legacy retained', rearArmor: 'read-only completed 3D trace projection',
      blocked: 'original applyOutcome(BLOCK) → applyDamageEvent physiology; calibrated5.56/5.45 no occupied tissue volume means0structural HP damage', poseAuthority: false },
    retarget: { debugOnly: true, runtimeEmbedded: false, method: 'SkeletonUtils.retargetClip + exported bone-axis offsets + stationary idle foot IK',
      boneNamesChanged: false, input: testModels.map(({path,bytes,sha256,boneCount,animations}) => ({path,bytes,sha256,boneCount,animations})),
      testedClip: 'Idle_Animation', draftOnlyModel: 'soldier_full_tactical_gear.glb', texturesDecodedDuringTest: 0 },
    protection: { profileId: ARMOR_PROFILE.id, bodyArmorId: ARMOR_PROFILE.bodyArmorId,
      frontPlateId: ARMOR_PROFILE.frontPlateId, backPlateId: ARMOR_PROFILE.backPlateId, helmet: ARMOR_PROFILE.helmet,
      softObliquity: SOFT_OBLIQUITY, bodyReferenceM: BODY_REFERENCE_M,
      helmetRicochet: { ruleId: HELMET_RICOCHET_RULE_ID, profiles: HELMET_RICOCHET_PROFILES,
        order: 'glancing surface roll before ordinary shell/liner rolls; failed deflection falls through',
        severity: 'effective penetration / effective shell armor × cos(incidence)^2; proxy, not physical depth',
        exitGate: 'source mesh winding rejects shell exits, including hollow helmet paths and exits from the same head',
        randomStream: 'helmet-only seeded Mulberry32; original shot rolls preserved; explicit QA random override applies to both',
        wear: 'original ricochet wear × continuous embed severity multiplier', source: 'new 3D game tuning + unchanged original ammo/material traits and direction/decay helpers' },
      bodyExitRuleId: BODY_CHANNEL_RULE_ID, legacyBodyExitRuleId: BODY_EXIT_RULE_ID, bodyEnergyShareRule: 'S2 per-cell energy loss; cached medical channel; primary exit energy ratio scales remaining penetration/damage', legacyBodyEnergyShareRule:'traversed part cost / total traversed cost', legacyContinuationMinPenetration: 6,
      armorExitVelocityRule: 'bounded square root of residual / incoming penetration; new spatial bridge' },
    packages: { three: '0.180.0', rapier: '0.21.0', esbuild: '0.25.10' }, sources: Object.keys(result.metafile.inputs), legacyBallisticsSources: legacy.sources, legacyProtectionSources: protection.sources, legacyMedicalSources: medical.sources, legacyMedicalContext: medical.context, modelCredits: credits };
  await writeFile(resolve(root, 'dist/training-build-info.json'), JSON.stringify(info,(key,value)=>['reversePortCandidate','automatic2DPort'].includes(key)?undefined:value,2) + '\n');
  return { html, path, info };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildTraining(); console.log(`Built dist/CQB_Training.html (${result.info.bytes} bytes, embedded model / WASM / renderer)`);
}
