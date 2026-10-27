import{referenceFlow}from'./medical-reference-flow.js';
import{MO2,GAUZE_KINDS}from'./medical-mo2-policy.js';
import{carePlans,careTime,treatments}from'./medical-care-state.js';
import{bleedingWounds,bleedingWound}from'./medical-bleeding-wounds.js';
import{summedComponentWork}from'./medical-work.js';
import{tourniquetOn}from'./medical-tourniquet.js';
import{systemicCareFactor}from'./medical-care-systemic.js';
import{activityFor}from'./medical-d2.js';
import{CATALOG}from'./catalog.js';
import{createLegacyProtection}from'./generated/legacy-protection.js';
const flows=new WeakMap(),profiles=createLegacyProtection(()=>.5),clamp=x=>Math.max(0,Math.min(1,x));
function sourceRows(m,s){
 const lesions=s.lesions?.length?s.lesions:[{woundId:s.woundIds[0],position:s.position,currentAreaMm2:1}],areas=lesions.map(l=>l.currentAreaMm2??(l.severity==null?1:l.severity*(l.closureFactor??1))),total=areas.reduce((a,b)=>a+b,0);
 return lesions.map((l,i)=>({woundId:l.woundId,position:l.position||s.position,share:areas[i]/Math.max(1e-30,total)}));
}
// Read-only counterfactual at CURRENT circulation. The shared CO/blood budget
// is allocated once before treatment; treating one wound cannot inflate another.
export function prepareCareFlows(m,cap,before,dt){
 const raw=m.bleedSources.reduce((n,s)=>n+s.rawFlowMlPerS,0),scale=raw>cap&&raw>0?cap/raw:1,available=dt>0&&raw*scale*dt>before?before/(raw*scale*dt):1;
 const table={sources:new Map(),wounds:new Map(),scale,available};
 for(const s of m.bleedSources){const rows=sourceRows(m,s).map((r,index)=>({...r,index,preFlow:s.rawFlowMlPerS*scale*available*r.share}));table.sources.set(s.id,rows);
  for(const r of rows){const w=table.wounds.get(r.woundId)||{q0:0};w.q0+=r.preFlow;table.wounds.set(r.woundId,w);}}
 flows.set(m,table);return table;
}
export const preFlow=(m,w)=>flows.get(m)?.wounds.get(typeof w==='string'?w:w.id)||{q0:0};
export function woundFlow(m,w){
 const pre=preFlow(m,w),table=flows.get(m);let actual=0;
 for(const s of m.bleedSources||[]){const plan=carePlans.get(m)?.get(s.id),rows=table?.sources.get(s.id)||sourceRows(m,s);
  for(let i=0;i<rows.length;i++){const r=rows[i];if(r.woundId!==w.id)continue;const p=plan?.segments[i],share=p?p.shareAfter/Math.max(1e-30,plan.factor):r.share;actual+=s.flowMlPerS*share;}}
 const leak=(w.care?.seepUntilS||0)>careTime(m);
 return{...pre,reference:referenceFlow(w),actual,grade:referenceFlow(w).total>MO2.bandageQ?'과다출혈':'일반 출혈',status:actual<=MO2.stopFlowMlS?'멎음':leak?'샘':'흐름'};
}
export function bandageFraction(m,w,time=careTime(m)){
 const ref=referenceFlow(w),maximum=ref.total>0?Math.min(1,MO2.bandageQ/ref.total):1;
 const b=w.care?.bandage;if(b?.active){if(b.finishing)return maximum;const f=MO2.bandageInitialBlock+(1-MO2.bandageInitialBlock)*clamp((time-b.appliedAtS)/MO2.bandageRiseS);return maximum*f;}
 return w.care?.unwrappedFraction||0;
}
export const bandageActive=w=>!!w?.care?.bandage?.active;
export const gauzeComplete=w=>!!w.care?.components?.length&&w.care.components.every(c=>c.workDone>=c.requiredWork-1e-9);
const componentId=(source,index)=>source+'|'+index;
// Parenchymal sources have no measured vascular aperture. Estimate their opening
// from the original local channel width, never organ severity/volume or current flow.
function organOpening(m,w,s,l,diameter){
 const origin=m.wounds.find(o=>o.id===l.originWoundId)||w,h=origin.s1OrganDamage?.find(h=>s.id.endsWith('/'+h.id)),channel=origin.bodyTrajectory?.woundChannel;let radius=h?.bulletRadiusM??diameter/2000,best=Infinity;
 if(h)for(const step of channel?.steps||[]){const delta=Math.abs(step.depthM+(channel.startDepthM||0)+step.dxM/2-h.closestDepthM);if(delta<best){best=delta;radius=step.permanentRadiusM;}}
 return Math.PI*(radius*1000)**2*MO2.organOpeningAreaFraction;
}
export function ensureWoundWork(m,w,commit=true){
 const state=w.care||{};if(state.components)return state.components;
 const components=[];let diameter=4;const ammo=CATALOG.AMMO_PRESETS[w.ammoId];if(ammo)diameter=profiles.getCanonicalProjectileProfile(ammo).diameterMm||4;
 for(const s of m.bleedSources||[]){if(!s.woundIds.includes(w.id))continue;const lesions=s.lesions?.length?s.lesions:[{woundId:s.woundIds[0]}];
  for(const [index,l]of lesions.entries()){if(l.woundId!==w.id)continue;
   const oozeArea=Math.PI*(diameter/2)**2*MO2.oozeOpeningAreaFraction*(w.exitWoundPresent?2:1),area=s.injuryType==='parenchymal'||s.organBed?organOpening(m,w,s,l,diameter):(l.baseAreaMm2??oozeArea);
   components.push({id:componentId(s.id,index),sourceId:s.id,index,originalAreaMm2:area,requiredWork:summedComponentWork(m,w,s,l,area,MO2),workDone:0});
  }
 }
 if(!components.length)components.push({id:'no-bleed',sourceId:null,index:0,originalAreaMm2:0,requiredWork:MO2.minimumComponentWork,workDone:0});
 if(commit){w.care??={ruleId:MO2.ruleId};w.care.components=components;}return components;
}
export const covers=kind=>GAUZE_KINDS.includes(kind);
export function remainingWork(m,w,kind){return ensureWoundWork(m,w,false).filter(c=>covers(kind,c.range)).reduce((n,c)=>n+Math.max(0,c.requiredWork-c.workDone),0);}
export function applyGauze(m,w,item,time){
 const p=MO2.products[item.definitionId],rows=ensureWoundWork(m,w).filter(c=>covers(item.definitionId,c.range)),need=rows.reduce((n,c)=>n+Math.max(0,c.requiredWork-c.workDone),0),used=Math.min(item.remaining,need/p.efficiency),fraction=need>0?Math.min(1,used*p.efficiency/need):0;
 for(const c of rows){c.workDone+=Math.max(0,c.requiredWork-c.workDone)*fraction;if(c.requiredWork-c.workDone<1e-9)c.workDone=c.requiredWork;}
 item.remaining=Math.max(0,item.remaining-used);if(item.remaining<1e-9)item.remaining=0;
 w.care.lastGauzeKind=item.definitionId;w.care.treatedAtS=time;w.care.lastUsed=used;
 if(gauzeComplete(w)){w.care.seepUntilS=0;w.care.unwrappedFraction=0;w.care.reopened=false;}
 return used;
}
function progressFor(w,s,index){const c=w.care?.components?.find(c=>c.id===componentId(s.id,index));return c?clamp(c.workDone/c.requiredWork):0;}
export function treatmentControlFactor(m,s){
 const table=flows.get(m),rows=table?.sources.get(s.id)||sourceRows(m,s);let factor=0;const segments=[];
 for(const r of rows){const w=bleedingWound(m,r.woundId);let coefficient=1;
  if(w){coefficient=(1-progressFor(w,s,r.index??rows.indexOf(r)))*(1-bandageFraction(m,w));
   const q=preFlow(m,w);if(gauzeComplete(w)&&(w.care.seepUntilS||0)>careTime(m)&&!bandageActive(w)){const ratio=q.q0>0?Math.min(1,MO2.movement.seepFlowMlS/q.q0):0;coefficient=Math.max(coefficient,ratio);}
   if(tourniquetOn(m,w.partKey))coefficient=0;
  }
  coefficient*=systemicCareFactor(m,s);factor+=r.share*coefficient;segments.push({...r,coefficient,shareAfter:r.share*coefficient});
 }
 if(segments.every(r=>r.coefficient===1)){carePlans.get(m)?.delete(s.id);return 1;}
 if(!carePlans.has(m))carePlans.set(m,new Map());carePlans.get(m).set(s.id,{factor,segments});return factor;
}
export const hasCareEffects=m=>treatments(m).length>0||bleedingWounds(m).some(w=>w.care);
export function woundComplete(m,w){
 const f=woundFlow(m,w);if((w.care?.seepUntilS||0)>careTime(m)||w.care?.reopened)return false;
 if(gauzeComplete(w))return true;
 return!!w.care?.bandage?.active&&referenceFlow(w).total<=MO2.bandageQ&&f.actual<=MO2.stopFlowMlS;
}
export function selectMovementEvent(care,time,dt,running,random,p=MO2.movement){
 const seep=care.seepUntilS>time?0:running?p.runSeepPerS:p.walkSeepPerS,reopen=running?p.runReopenPerS:p.walkReopenPerS,total=seep+reopen;
 if(random()>=1-Math.exp(-total*dt))return null;
 return random()<reopen/total?'reopen':'seep';
}
export function stepCareMovement(bridge,dt){
 const m=bridge.actor.medical,a=activityFor(m),speed=a?.controls?.speedMps||0;if(speed<.05||a.controls.crouched||m.isDead||m.isUnconscious)return;
 const running=!!a.controls.sprinting||speed>2.5,p=MO2.movement,time=bridge.time;
 const random=()=>{bridge.seed=(Math.imul(bridge.seed,1664525)+1013904223)>>>0;return bridge.seed/4294967296;};
 for(const w of bleedingWounds(m)){if(!gauzeComplete(w)||bandageActive(w)||tourniquetOn(m,w.partKey)||preFlow(m,w).q0<=MO2.stopFlowMlS)continue;
  const kind=selectMovementEvent(w.care,time,dt,running,random);if(!kind)continue;
  if(kind==='reopen'){for(const c of w.care.components)c.workDone=c.requiredWork*(1-p.reopenFraction);w.care.reopened=true;w.care.seepUntilS=0;}
  else w.care.seepUntilS=time+p.seepSeconds;
  const events=w.care.events??=[];events.push({kind,time});if(events.length>100)events.shift();
 }
}
