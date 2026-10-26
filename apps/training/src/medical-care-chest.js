import{M4B}from'./medical-care-m4b-policy.js';
import{TEMPORARY_CARE as M4_VALUES}from'./medical-mo2-policy.js';
import{treatments}from'./medical-care-state.js';
import{careTime}from'./medical-care-systemic.js';
import{medicalSurfaces}from'./medical-surface.js';
const bridges=new WeakMap();
const sideTracks=new WeakMap();
export const registerChestCareBridge=bridge=>bridges.set(bridge.actor.medical,bridge);
export function chestSides(w){if(w._careChestSide)return[w._careChestSide];const lung=(w.s1OrganDamage||[]).filter(h=>h.organ==='lung');return[...new Set(lung.length?lung.map(h=>/right/.test(h.id)?'right':'left'):[w.bodyTrajectory?.entryAddress?.side==='right'?'right':'left'])];}
export function chestOpenings(bridge,side){const m=bridge.actor.medical;return medicalSurfaces(bridge).flatMap(s=>{const w=m.wounds.find(w=>w.id===s.woundId);if(!w?.chestTraumaModel?.openChestWound||!chestSides(w).includes(side))return[];const sides=chestSides(w);return[['entry',s.entry],['exit',s.exit]].filter(([,p])=>p&&(!sides.includes('left')||!sides.includes('right')||(p.bindActorPoint[0]>=0?'left':'right')===side)).map(([hole,p])=>({woundId:w.id,hole,face:p.face,side,point:p.bindActorPoint}));});}
// A bilateral wound keeps one medical wound and one set of bleeding sources.
// Only its chest input track is evaluated per side after a chest intervention.
// The original chest equation then reads the same parameters for each track.
export function chestCareTracks(m){
 const relevant=treatments(m).some(t=>['seal','needle'].includes(t.kind)&&t.status==='completed');
 if(!relevant&&!m.wounds.some(w=>sideTracks.has(w)))return m.wounds;
 return m.wounds.flatMap(w=>{const sides=chestSides(w);if(!w.chestTraumaModel||sides.length<2)return[w];let cached=sideTracks.get(w);if(!cached){cached=Object.fromEntries(sides.map(side=>[side,{...w,_careChestSide:side,chestTraumaModel:structuredClone(w.chestTraumaModel)}]));sideTracks.set(w,cached);}return Object.values(cached);});
}
export const chestCareSideModel=(w,side)=>sideTracks.get(w)?.[side]?.chestTraumaModel||w.chestTraumaModel;
export function commitChestCareTracks(m){for(const w of m.wounds){const tracks=sideTracks.get(w);if(!tracks)continue;const values=Object.values(tracks).map(p=>p.chestTraumaModel);for(const key of['_pneumoProg','tensionPneumothoraxRisk','breathingEfficiencyDrain'])w.chestTraumaModel[key]=Math.max(...values.map(t=>t[key]||0));}}
export function sealCoverage(m,side){const ts=treatments(m),seal=ts.filter(t=>t.kind==='seal'&&t.status==='completed'&&t.target.side===side),holes=bridges.has(m)?chestOpenings(bridges.get(m),side):ts.find(t=>t.kind==='seal'&&t.target.side===side)?.target.sideOpenings||[];if(!holes.length)return 0;return holes.filter(h=>seal.some(t=>t.target.woundId===h.woundId&&t.target.hole===h.hole)).length/holes.length;}
// Targets are normalized diagram coordinates, not a clinical landmark locator.
export const NEEDLE_SITES={anterior:{x:.34,y:.24},lateral:{x:.77,y:.54}};
export function needleSite(point){if(!point||![point.x,point.y].every(Number.isFinite))return null;return Object.keys(NEEDLE_SITES).find(k=>Math.hypot(point.x-NEEDLE_SITES[k].x,point.y-NEEDLE_SITES[k].y)<=M4_VALUES.needleRadius)||null;}
export function finishNeedle(bridge,t){const m=bridge.actor.medical,c=m.chestCompartments?.[t.target.side],hadTension=(c?.tensionAir||0)>0;let seed=(bridge.seed^0x4d345f4e^Math.imul(bridge.time*60|0,2654435761)^t.target.side.length)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const site=t.target.site,roll=random();t.needleResult={site,hadTension,positionCorrect:!!site,reachRoll:roll,success:!!site&&hadTension,recurrenceAtS:null,iatrogenic:false};t.needleResult.finalSeed=seed;
}
// Called by the generated 3D copy only, before its original chest progression.
// No intervention => null: identical original operations, no new medical fields.
export function chestCareInput(m,w){const ts=treatments(m);if(!ts.length)return null;const sides=chestSides(w),coverage=w.chestTraumaModel?.openChestWound?Math.min(...sides.map(s=>sealCoverage(m,s))):0,needles=ts.filter(t=>t.kind==='needle'&&t.status==='completed'&&sides.includes(t.target.side)&&t.needleResult?.success&&(t.needleResult.recurrenceAtS===null||careTime(m)<t.needleResult.recurrenceAtS));if(!coverage&&!needles.length)return null;return{progress:1-coverage,vent:coverage,needle:needles.length>0};}
export function chestCareTension(m,w,value,dt){const p=chestCareInput(m,w);return p?Math.max(0,value-(p.needle?M4_VALUES.needleDrainPerS:p.vent*M4_VALUES.ventDrainPerS)*dt):value;}
export function chestCareComplications(m){for(const t of treatments(m)){if(t.kind!=='needle'||!t.needleResult?.iatrogenic||t.status!=='completed')continue;const c=m.chestCompartments[t.target.side];c.pneumothoraxProgress=Math.max(c.pneumothoraxProgress,M4_VALUES.iatrogenicPneumo);c.lungEfficiency=Math.min(c.lungEfficiency,1-M4_VALUES.iatrogenicPneumo);m.breathingEfficiency=Math.min(m.breathingEfficiency,100*(1-M4_VALUES.iatrogenicPneumo*.25));}}
// M4b: venting is a continuous relaxation toward a coverage-dependent ceiling.
export function chestCareProgress(m,w,value,rate,ceil,dt){const coverage=chestCareInput(m,w)?.vent||0;if(!coverage)return Math.min(ceil,value+rate*dt);const target=Math.min(1,w.chestTraumaModel.pneumothoraxRisk+.4-.3*coverage);return value>target?Math.max(target,value-M4B.ventPneumoPerS*coverage*dt):Math.min(target,value+rate*dt);}
const valveCache=new WeakMap();
export function chestValveCandidate(w){let eligible=valveCache.get(w);if(eligible===undefined){const c=w.chestTraumaModel;if(w.partKey!=='chest'||!c?.lungInjuryCandidate||!(c.pneumothoraxRisk>0)){valveCache.set(w,false);return false;}const a=w.bodyTrajectory?.entryAddress,parts=[w.trainingMetadata?.shotId||0,w.trainingMetadata?.order||0,...(a?.actorLocalPoint||[]).map(x=>Math.round(x*10000))];let h=0x4d346256;for(const n of parts){h=Math.imul(h^(n|0),16777619)>>>0;h^=h>>>16;}eligible=(h>>>0)/4294967296<M4B.valveChance;valveCache.set(w,eligible);}return eligible&&w.chestTraumaModel._pneumoProg>M4B.valveThreshold;}
