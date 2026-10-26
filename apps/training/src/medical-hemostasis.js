import{referenceFlow}from'./medical-reference-flow.js';
import{MO2,GAUZE_KINDS}from'./medical-mo2-policy.js';
import{carePlans,oozeSplits,careTime,treatments}from'./medical-care-state.js';
import{limbRouteFractions,limbOpeningFact}from'./medical-routing.js';
import{tourniquetOn}from'./medical-tourniquet.js';
import{systemicCareFactor}from'./medical-care-systemic.js';
import{activityFor}from'./medical-d2.js';
import{CATALOG}from'./catalog.js';
import{createLegacyProtection}from'./generated/legacy-protection.js';
const flows=new WeakMap(),profiles=createLegacyProtection(()=>.5),clamp=x=>Math.max(0,Math.min(1,x));
function sourceRows(m,s){
 const limb=limbRouteFractions(m,s);if(limb)return limb;
 const lesions=s.lesions?.length?s.lesions:[{woundId:s.woundIds[0],position:s.position,currentAreaMm2:1}],areas=lesions.map(l=>l.currentAreaMm2??l.severity*(l.closureFactor??1)??1),total=areas.reduce((a,b)=>a+b,0);
 return lesions.map((l,i)=>({woundId:l.woundId,position:l.position||s.position,share:areas[i]/Math.max(1e-30,total),internalFraction:s.destination==='external'?0:s.injuryType==='ooze'?1-(oozeSplits.get(m)?.get(s.id)?.externalFraction??0):1}));
}
// Read-only counterfactual at CURRENT circulation. The shared CO/blood budget
// is allocated once before treatment; treating one wound cannot inflate another.
export function prepareCareFlows(m,cap,before,dt){
 const raw=m.bleedSources.reduce((n,s)=>n+s.rawFlowMlPerS,0),scale=raw>cap&&raw>0?cap/raw:1,available=dt>0&&raw*scale*dt>before?before/(raw*scale*dt):1;
 const table={sources:new Map(),wounds:new Map(),scale,available};
 for(const s of m.bleedSources){const rows=sourceRows(m,s).map((r,index)=>({...r,index,preFlow:s.rawFlowMlPerS*scale*available*r.share}));table.sources.set(s.id,rows);
  for(const r of rows){const w=table.wounds.get(r.woundId)||{q0:0,external:0,internal:0,limbInternal:0,cavity:0};w.q0+=r.preFlow;w.external+=r.preFlow*(1-r.internalFraction);w.internal+=r.preFlow*r.internalFraction;w[s.destination==='limb_compartment'?'limbInternal':'cavity']+=r.preFlow*r.internalFraction;table.wounds.set(r.woundId,w);}}
 flows.set(m,table);return table;
}
export const preFlow=(m,w)=>flows.get(m)?.wounds.get(typeof w==='string'?w:w.id)||{q0:0,external:0,internal:0,limbInternal:0,cavity:0};
export function woundFlow(m,w){
 const pre=preFlow(m,w),table=flows.get(m);let external=0,internal=0;
 for(const s of m.bleedSources||[]){const plan=carePlans.get(m)?.get(s.id),rows=table?.sources.get(s.id)||sourceRows(m,s);
  for(let i=0;i<rows.length;i++){const r=rows[i];if(r.woundId!==w.id)continue;const p=plan?.segments[i],share=p?p.shareAfter/Math.max(1e-30,plan.factor):r.share,fraction=p?.internalFractionAfter??r.internalFraction;external+=s.flowMlPerS*share*(1-fraction);internal+=s.flowMlPerS*share*fraction;}}
 const leak=(w.care?.seepUntilS||0)>careTime(m),actual=external+internal;
 return{...pre,reference:referenceFlow(w),externalFlow:external,internalFlow:internal,actual,grade:referenceFlow(w).total>MO2.bandageQ?'과다출혈':'일반 출혈',status:actual<=MO2.stopFlowMlS?'멎음':leak?'샘':'흐름'};
}
export function bandageFraction(m,w,time=careTime(m)){
 const ref=referenceFlow(w),maximum=ref.external>0?Math.min(1,MO2.bandageQ/ref.external):1;
 const b=w.care?.bandage;if(b?.active){if(b.finishing)return maximum;const f=MO2.bandageInitialBlock+(1-MO2.bandageInitialBlock)*clamp((time-b.appliedAtS)/MO2.bandageRiseS);return maximum*f;}
 return w.care?.unwrappedFraction||0;
}
export const bandageActive=w=>!!w?.care?.bandage?.active;
export const gauzeComplete=w=>!!w.care?.components?.length&&w.care.components.every(c=>c.workDone>=c.requiredWork-1e-9);
const componentId=(source,index,range)=>source+'|'+index+'|'+range;
// Parenchymal sources have no measured vascular aperture. Estimate their opening
// from the original local channel width, never organ severity/volume or current flow.
function organOpening(w,s,diameter){
 const h=w.s1OrganDamage?.find(h=>s.id.endsWith('/'+h.id)),channel=w.bodyTrajectory?.woundChannel;let radius=h?.bulletRadiusM??diameter/2000,best=Infinity;
 if(h)for(const step of channel?.steps||[]){const delta=Math.abs(step.depthM+(channel.startDepthM||0)+step.dxM/2-h.closestDepthM);if(delta<best){best=delta;radius=step.permanentRadiusM;}}
 return Math.PI*(radius*1000)**2*MO2.organOpeningAreaFraction;
}
export function ensureWoundWork(m,w,commit=true){
 const state=w.care||{};if(state.components)return state.components;
 const components=[];let diameter=4;const ammo=CATALOG.AMMO_PRESETS[w.ammoId];if(ammo)diameter=profiles.getCanonicalProjectileProfile(ammo).diameterMm||4;
 for(const s of m.bleedSources||[]){if(!s.woundIds.includes(w.id))continue;const lesions=s.lesions?.length?s.lesions:[{woundId:s.woundIds[0]}];
  for(const [index,l]of lesions.entries()){if(l.woundId!==w.id)continue;
   const oozeArea=Math.PI*(diameter/2)**2*MO2.oozeOpeningAreaFraction*(w.exitWoundPresent?2:1),area=s.injuryType==='parenchymal'||s.organBed?organOpening(w,s,diameter):(l.baseAreaMm2??oozeArea);
   let inside=s.destination==='external'?0:1;if(s.destination==='limb_compartment'){const opening=limbOpeningFact(m,w.id);inside=opening?.entry?(opening.exit?.15:.6):1;}else if(s.injuryType==='ooze'){inside=s.ooze.internal>0?(s.ooze.external>0?.5:1):0;}
   for(const[range,fraction]of [['external',1-inside],[s.destination==='limb_compartment'?'limb':'cavity',inside]])if(fraction>0)components.push({id:componentId(s.id,index,range),sourceId:s.id,index,range,originalAreaMm2:area*fraction,requiredWork:Math.max(MO2.minimumComponentWork,area*fraction*MO2.workPerAreaMm2),workDone:0});
  }
 }
 if(!components.length)components.push({id:'no-bleed',sourceId:null,index:0,range:'external',originalAreaMm2:0,requiredWork:MO2.minimumComponentWork,workDone:0});
 if(commit){w.care??={ruleId:MO2.ruleId};w.care.components=components;}return components;
}
export const covers=(kind,range)=>kind==='injector'||kind==='foam'||kind==='gauze'&&range!=='cavity';
export function remainingWork(m,w,kind){return ensureWoundWork(m,w,false).filter(c=>covers(kind,c.range)).reduce((n,c)=>n+Math.max(0,c.requiredWork-c.workDone),0);}
export function applyGauze(m,w,item,time){
 const p=MO2.products[item.definitionId],rows=ensureWoundWork(m,w).filter(c=>covers(item.definitionId,c.range)),need=rows.reduce((n,c)=>n+Math.max(0,c.requiredWork-c.workDone),0),used=Math.min(item.remaining,need/p.efficiency),fraction=need>0?Math.min(1,used*p.efficiency/need):0;
 for(const c of rows){c.workDone+=Math.max(0,c.requiredWork-c.workDone)*fraction;if(c.requiredWork-c.workDone<1e-9)c.workDone=c.requiredWork;}
 item.remaining=Math.max(0,item.remaining-used);if(item.remaining<1e-9)item.remaining=0;
 w.care.lastGauzeKind=item.definitionId;w.care.treatedAtS=time;w.care.lastUsed=used;
 if(gauzeComplete(w)){w.care.seepUntilS=0;w.care.unwrappedFraction=0;w.care.reopened=false;}
 return used;
}
function progressFor(w,s,index,range){const c=w.care?.components?.find(c=>c.id===componentId(s.id,index,range));return c?clamp(c.workDone/c.requiredWork):0;}
export function treatmentControlFactor(m,s){
 const table=flows.get(m),rows=table?.sources.get(s.id)||sourceRows(m,s);let factor=0;const segments=[];
 for(const r of rows){const w=m.wounds.find(w=>w.id===r.woundId);let ext=1,int=1;
  if(w){ext=1-progressFor(w,s,r.index??rows.indexOf(r),'external');int=1-progressFor(w,s,r.index??rows.indexOf(r),s.destination==='limb_compartment'?'limb':'cavity');
   const q=preFlow(m,w),blockedFraction=bandageFraction(m,w);if(blockedFraction>0)ext*=1-blockedFraction;
   if(gauzeComplete(w)&&(w.care.seepUntilS||0)>careTime(m)&&!bandageActive(w)){const ratio=q.q0>0?Math.min(1,MO2.movement.seepFlowMlS/q.q0):0;ext=Math.max(ext,ratio);int=Math.max(int,ratio);}
   if(tourniquetOn(m,w.partKey)&&(s.destination==='external'||s.destination==='limb_compartment'))ext=int=0;
  }
  const systemic=systemicCareFactor(m,s);ext*=systemic;int*=systemic;
  const coefficient=(1-r.internalFraction)*ext+r.internalFraction*int;factor+=r.share*coefficient;segments.push({...r,coefficient,shareAfter:r.share*coefficient,internalFractionAfter:coefficient>0?r.internalFraction*int/coefficient:r.internalFraction,allFactor:int,externalFactor:ext});
 }
 if(segments.every(r=>r.coefficient===1)){carePlans.get(m)?.delete(s.id);return 1;}
 if(!carePlans.has(m))carePlans.set(m,new Map());carePlans.get(m).set(s.id,{factor,segments});return factor;
}
export const hasCareEffects=m=>treatments(m).length>0||m.wounds.some(w=>w.care);
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
 for(const w of m.wounds){if(!gauzeComplete(w)||bandageActive(w)||tourniquetOn(m,w.partKey)||preFlow(m,w).q0<=MO2.stopFlowMlS)continue;
  const kind=selectMovementEvent(w.care,time,dt,running,random);if(!kind)continue;
  if(kind==='reopen'){for(const c of w.care.components)c.workDone=c.requiredWork*(1-p.reopenFraction);w.care.reopened=true;w.care.seepUntilS=0;}
  else w.care.seepUntilS=time+p.seepSeconds;
  const events=w.care.events??=[];events.push({kind,time});if(events.length>100)events.shift();
 }
}
