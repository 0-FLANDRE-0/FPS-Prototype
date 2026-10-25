export const AIM_DEFAULTS = Object.freeze({ scarMaterialStrength:50,aiDisplay:false,enemyPlateType:'random',treatmentMode:'realistic',medicalEffects:100,sound:true,soundPaths:false,bodycamMic:70, sensitivity: 100, adsSensitivity: 55, cameraFollow: 3.5, freeAim: 20, weaponResponse: 12, fov: 66, lensStrength: 70, lensFov: 120, scopeFocus: 100, stepImpact: 100, transfer: 0.62, breath: 0.009, walkSway: 0.035, weaponSize: 115, weaponHeight: -1, weaponMotion: 100, trajectories: false, hitRegions: false, softArmorRegions: false, plateRegions: false, helmetRegions: false, skeletonRegions: false, internalRegions: false, targetPose: 'rest', mouseAdsMode: 'toggle', leanMode: 'hold', medicalModel: 'v2' });
export const AIM_PRESETS = Object.freeze({
  steady: { cameraFollow: 22, freeAim: 5, weaponResponse: 24, transfer: 0.1, breath: 0.0026, walkSway: 0.008 },
  balanced: { cameraFollow: 8, freeAim: 11, weaponResponse: 16, transfer: 0.28, breath: 0.005, walkSway: 0.022 },
  bodycam: { cameraFollow: 3.5, freeAim: 20, weaponResponse: 12, transfer: 0.62, breath: 0.009, walkSway: 0.035 },
});
const LIMITS = {scarMaterialStrength:[0,100], medicalEffects:[0,100], bodycamMic:[0,100], sensitivity: [25, 200], adsSensitivity: [25, 100], cameraFollow: [1, 25], freeAim: [3, 25], weaponResponse: [4, 25], fov: [60, 85], lensStrength: [0, 100], lensFov: [90, 140], scopeFocus: [0, 100], stepImpact: [0, 150], transfer: [0, 1], breath: [0, 0.02], walkSway: [0, 0.06], weaponSize: [100, 155], weaponHeight: [-4, 4], weaponMotion: [0, 160] };
const KEY = 'cqb.training.aim.v1';
export function cleanSettings(value) {
  const result = { ...AIM_DEFAULTS };
  if (!value || typeof value !== 'object') return result;
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = Math.min(max, Math.max(min, value[key]));
  }
  for (const key of ['aiDisplay','sound','soundPaths','trajectories', 'hitRegions', 'softArmorRegions', 'plateRegions', 'helmetRegions', 'skeletonRegions', 'internalRegions']) if (typeof value[key] === 'boolean') result[key] = value[key];
  if(['random','br4','br5'].includes(value.enemyPlateType))result.enemyPlateType=value.enemyPlateType;
  if (['toggle', 'hold'].includes(value.mouseAdsMode)) result.mouseAdsMode = value.mouseAdsMode;
  if (['legacy', 'v2'].includes(value.medicalModel)) result.medicalModel = value.medicalModel;
  if(['game','realistic','reality'].includes(value.treatmentMode))result.treatmentMode=value.treatmentMode;
  if (['toggle', 'hold'].includes(value.leanMode)) result.leanMode = value.leanMode;
  // H01 is a fixed inspection target. Ignore poses saved by the earlier rig demo.
  return result;
}
export function loadSettings() {
  try { return cleanSettings(JSON.parse(localStorage.getItem(KEY))); } catch { return { ...AIM_DEFAULTS }; }
}
export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(cleanSettings(settings))); } catch { /* File/opaque origins may only retain session preferences. */ }
}
