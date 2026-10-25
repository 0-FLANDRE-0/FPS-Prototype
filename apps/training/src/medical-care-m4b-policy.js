// M4b authored/tuned simulation parameters. No clinical dosing engine.
export const M4B={ruleId:'care-m4b-v61',backSealRealityMultiplier:3,ventPneumoPerS:.006,valveChance:.10,valveThreshold:.24,valveRisePerS:.01,walkRebleedGain:1.0390625,sprintRebleedGain:.015625,otfcDropConsciousness:65,ketamineRepeatS:1800,
 profiles:{game:{drugGain:1.1,pillOnset:10,otfcOnset:5,ketamineOnset:3,dissolveS:60,connectS:5,infuseS:60,pillS:36000,otfcS:9000,ketamineS:2400},realistic:{drugGain:1,pillOnset:60,otfcOnset:30,ketamineOnset:15,dissolveS:240,connectS:20,infuseS:180,pillS:28800,otfcS:7200,ketamineS:1800},reality:{drugGain:.9,pillOnset:180,otfcOnset:120,ketamineOnset:60,dissolveS:480,connectS:60,infuseS:480,pillS:28800,otfcS:7200,ketamineS:1800}},
 application:{pill:{game:2,realistic:4,reality:6},otfc:{game:1,realistic:2,reality:3},ketamine:{game:2,realistic:5,reality:10}},
 analgesia:{pill:25,otfc:60,ketamine:75},effects:{otfcDrowsy:7,otfcRespiration:.04,shockAmplification:1.5,ketamineDrowsy:5,ketamineSympathetic:.08,ketamineDoubleCssPx:4,ketamineDizzyCssPx:2,ketamineColor:.12,ketamineAudioRate:.92}};
export const DRUG_KINDS=['pill','otfc','ketamine'];
export const M4B_KINDS=[...DRUG_KINDS,'blood'];
export function m4bDuration(kind,mode){return kind==='blood'?M4B.profiles[mode].connectS:M4B.application[kind]?.[mode];}
