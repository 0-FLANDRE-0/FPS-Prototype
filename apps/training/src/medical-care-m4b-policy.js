// Temporary former realistic constants. Drug/infusion equations remain M4b.
export const M4B={ruleId:'care-drugs-temporary-mo2',classification:'임시 고정 — 해당 단계에서 재작성',otfcDropConsciousness:65,ketamineRepeatS:1800,
 profile:{drugGain:1,pillOnset:60,otfcOnset:30,ketamineOnset:15,dissolveS:240,connectS:20,infuseS:180,pillS:28800,otfcS:7200,ketamineS:1800},
 application:{pill:4,otfc:2,ketamine:5},analgesia:{pill:25,otfc:60,ketamine:75},effects:{otfcDrowsy:7,otfcRespiration:.04,shockAmplification:1.5,ketamineDrowsy:5,ketamineSympathetic:.08,ketamineDoubleCssPx:4,ketamineDizzyCssPx:2,ketamineColor:.12,ketamineAudioRate:.92}};
export const DRUG_KINDS=['pill','otfc','ketamine'];export const M4B_KINDS=[...DRUG_KINDS,'blood'];
