import { CATALOG } from './catalog.js';

// S3 is a 3D-only type model. Original type/threshold values are read, never
// rewritten. Every other number here is an explicitly labelled shared tuning;
// W1 adds explicitly classified 7.62 defaults and a provisional SLAP core; see w1-ledger.json.
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
const M193_LENGTH_RATIO=.019/.00569,AK74_LENGTH_RATIO=.0255/.0056;
export const WOUND_S3_VALUES=freeze({
  ruleId:'terminal-types-s3b',calibers:['5.56x45mm','5.45x39mm','7.62x51mm'],
  source:'CATALOG.AMMO_TERMINAL_EFFECT: original type and thresholdVelocity; S3b 3D-only M855 fragment override',
  overrides:{'556_m855':{type:'fragment',grade:'family',source:'Emergency War Surgery 2004 printed1.8/PDF39: M-855 shows a similar pattern to M-193; shared M193 fragment defaults, original760m/s threshold'}},
  lengthRatioClassification:'tuning: caliber × shared type mean length ratio; donor figure ratios for yaw/fragment',
  referenceHelpers:'gelatinProfile and WOUND_PROFILES retain literal S1/S2 reference curves; live typed tissue profiles are separate',
  typeDefaults:{
    full_power:{yawDonor:'m80',lengthRatio:.028/.00782,fragmentFraction:0,expansionAreaScale:1,dragScale:1,cavityScale:1},
    sabot_penetrator:{yawDonor:'m80',yawKnotsM:[[0,0],[.28*.00566/.00569,0],[.55*.00566/.00569,Math.PI/2],[.8*.00566/.00569,Math.PI]],lengthRatio:4.5,diameterOverrideM:.00566,coreMassOverrideKg:.0035,fragmentFraction:0,expansionAreaScale:1,dragScale:.45,cavityScale:.65,classification:'W1 tuning: .223 core diameter secondary reference; 3.5g core and length=4.5diam provisional; no primary core mass/length found'},
    yaw:{yawDonor:'same-caliber figure',lengthRatio556:M193_LENGTH_RATIO,lengthRatio545:AK74_LENGTH_RATIO,fragmentFraction:0,expansionAreaScale:1,dragScale:1,cavityScale:1},
    fragment:{yawDonor:'m193',lengthRatio:M193_LENGTH_RATIO,fragmentFraction:.36,fragmentRangeM:.13,fragmentYawRad:Math.PI/18,fragmentOnsetDepthM:null,expansionAreaScale:1,dragScale:1,cavityScale:1},
    controlled_fragment:{yawDonor:'m193',lengthRatio:M193_LENGTH_RATIO,fragmentFraction:.36,fragmentRangeM:.13,fragmentYawRad:0,fragmentOnsetDepthM:.12,expansionAreaScale:1,dragScale:1,cavityScale:1},
    barrier_blind:{yawDonor:'m193',lengthRatio:M193_LENGTH_RATIO,fragmentFraction:.36,fragmentRangeM:.13,fragmentYawRad:0,fragmentOnsetDepthM:.12,expansionAreaScale:1,dragScale:1,cavityScale:1},
    penetrator:{yawDonor:'m193',yawKnotsM:[[0,0],[.28,0],[.55,Math.PI/2],[.8,Math.PI]],lengthRatio:4.5,fragmentFraction:0,expansionAreaScale:1,dragScale:.45,cavityScale:.65},
    small_caliber_ap:{yawDonor:'m193',yawKnotsM:[[0,0],[.28,0],[.55,Math.PI/2],[.8,Math.PI]],lengthRatio:4.5,fragmentFraction:0,expansionAreaScale:1,dragScale:.45,cavityScale:.65},
    expand:{yawDonor:'same-caliber figure below threshold',yawKnotsM:[[0,0],[.005,0],[.035,Math.PI/2],[2.56,Math.PI/2]],lengthRatio:3,fragmentFraction:0,expansionAreaScale:3.2,dragScale:1,cavityScale:1},
    frangible:{yawDonor:'same-caliber figure below threshold',yawKnotsM:[[0,0],[.005,0],[.035,Math.PI/2],[2.56,Math.PI/2]],lengthRatio:3,fragmentFraction:.9,fragmentRangeM:.06,fragmentYawRad:0,fragmentOnsetDepthM:.015,expansionAreaScale:1,dragScale:1,cavityScale:1},
    subsonic_standard:{yawDonor:'same-caliber figure',lengthRatio556:M193_LENGTH_RATIO,lengthRatio545:AK74_LENGTH_RATIO,fragmentFraction:0,expansionAreaScale:1,dragScale:1,cavityScale:1}
  },
  consistency:'controlled_fragment and barrier_blind use a fixed donor-onset depth, rather than a yaw-amplitude fragmentation gate; deterministic shared tuning, not a measured reliability distribution',
  thresholdPolicy:'first occupied tissue entry selects the original threshold class; that class follows the same projectile across parts',
  yawThresholdPolicy:'yaw and subsonic_standard use the donor depth curve at all speeds. Original thresholdVelocity remains recorded; it does not switch yaw off. Their original high/low tissue-damage multipliers are not used by the S3 physical HP calculation.',
  expansionBelowThreshold:'use same-caliber donor yaw without expansion; preserve the shared expand-type mean length ratio. Occupied depth and inherited yaw never reset between body parts.',
  classification:'original type/threshold; user-designed type behavior; shared game tuning for lengths, AP, expansion, frangibility and controlled fragmentation',
  reversePortCandidate:true
});

export const S3_TERMINAL_SETTINGS=freeze(Object.fromEntries(Object.entries(CATALOG.AMMO_PRESETS)
  .filter(([,ammo])=>WOUND_S3_VALUES.calibers.includes(ammo.caliber))
  .map(([ammoId,ammo])=>{
    const original=CATALOG.AMMO_TERMINAL_EFFECT[ammoId];
    if(!original||!WOUND_S3_VALUES.typeDefaults[original.type]||!Number.isFinite(original.thresholdVelocity))throw Error('Missing original S3 terminal classification: '+ammoId);
    const override=WOUND_S3_VALUES.overrides[ammoId],type=override?.type||original.type;
    const is762=ammo.caliber==='7.62x51mm',baseDefaults=WOUND_S3_VALUES.typeDefaults[type],typeDefaults=is762&&type==='controlled_fragment'?{...baseDefaults,yawDonor:'m80',lengthRatio:baseDefaults.lengthRatio,fragmentRangeM:baseDefaults.fragmentRangeM*.00782/.00569,fragmentOnsetDepthM:baseDefaults.fragmentOnsetDepthM*.00782/.00569}:is762&&type==='penetrator'?{...baseDefaults,yawDonor:'m80',yawKnotsM:baseDefaults.yawKnotsM.map(([d,a])=>[d*.00782/.00569,a])}:baseDefaults,sameCaliber=ammo.caliber==='5.45x39mm'?'ak74':'m193',donorProfileId=is762?'m80':['yaw','expand','frangible','subsonic_standard'].includes(type)?sameCaliber:'m193';
    const plate=ammoId==='545_ps_gs'||ammoId==='556_m193',family=['yaw','fragment','subsonic_standard'].includes(type)&&((sameCaliber==='ak74'&&donorProfileId==='ak74')||(sameCaliber==='m193'&&donorProfileId==='m193'));
    return [ammoId,{ammoId,caliber:ammo.caliber,type,override:override?{...override,originalType:original.type}:null,thresholdVelocity:original.thresholdVelocity,originalTerminalEffect:structuredClone(original),grade:plate?'plate':family?'family':'estimate',donorProfileId,typeDefaults,
      lengthRatio:typeDefaults.lengthRatio??(sameCaliber==='ak74'?typeDefaults.lengthRatio545:typeDefaults.lengthRatio556),
      classification:{type:override?'S3b user-authorized 3D override; original registry preserved':'original',thresholdVelocity:'original (including original estimatedThreshold annotations)',behavior:'user design + shared tuning',lengthRatio:'shared type tuning',grade:'source traceability, not a validation score'}}];
  })));
export const isS3CalibratedAmmo=ammoId=>Object.hasOwn(S3_TERMINAL_SETTINGS,ammoId);
export const terminalSettingS3=ammoId=>S3_TERMINAL_SETTINGS[ammoId]||null;
