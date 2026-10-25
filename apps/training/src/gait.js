// v50 presentation/gameplay tuning, not measured soldier gait data.
// A clip cycle has two support contacts. Normalize cadence by clip duration,
// rather than multiplying its already-fast cycle by translation speed.
export const GAIT=Object.freeze({speedExponent:.25,runThresholdMps:3,
 walk:Object.freeze({referenceMps:1.6,referenceSpm:114,minSpm:60,maxSpm:120}),
 run:Object.freeze({referenceMps:4.5,referenceSpm:174,minSpm:130,maxSpm:186}),
 crouch:Object.freeze({referenceMps:.85,referenceSpm:80,minSpm:40,maxSpm:84})});
export function gaitCadenceSpm(family,speed){const p=GAIT[family==='walk crouching'?'crouch':family]||GAIT.walk;return Math.max(p.minSpm,Math.min(p.maxSpm,p.referenceSpm*(Math.max(0,speed)/p.referenceMps)**GAIT.speedExponent));}
export function gaitClipRate(clip,family,speed){return gaitCadenceSpm(family,speed)*clip.duration/120;}
