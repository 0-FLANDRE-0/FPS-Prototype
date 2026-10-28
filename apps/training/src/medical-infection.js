// MO4 user design / game tuning. Reads existing S1 injury; no damage or circulation edits.
export const INFECTION=Object.freeze({ruleId:'hollow-infection-mo4',organs:Object.freeze(['stomach','bowel','small_intestine','large_intestine','small_bowel','large_bowel','bladder']),minimumLatencyS:300,maximumLatencyS:600,progressionS:600,skillLatencyMultiplier:1,maximumStaminaLoss:.30,maximumRecoveryLoss:.50,classification:'사용자 설계값; 잠복 보간·피격별 합산·악화600초·증상 계수 튜닝/게임 허용'});
const seen=new WeakMap(),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),union=rows=>1-rows.reduce((p,s)=>p*(1-clamp(s)),1);
export const infectionLatency=(s,multiplier=INFECTION.skillLatencyMultiplier)=>(INFECTION.maximumLatencyS-(INFECTION.maximumLatencyS-INFECTION.minimumLatencyS)*clamp(s))*multiplier;
export function recordInfectionWounds(m,time=0){
 if(!seen.has(m))seen.set(m,new WeakSet());const visited=seen.get(m);
 for(const w of m.wounds||[]){if(visited.has(w))continue;visited.add(w);const hits=(w.s1OrganDamage||[]).filter(h=>INFECTION.organs.includes(h.organ)&&h.effectiveVolumeM3>0&&h.severity>0);if(!hits.length)continue;
  m.infection??={ruleId:INFECTION.ruleId,severity:0,level:0,symptomatic:false,exposures:[],skillLatencyMultiplier:INFECTION.skillLatencyMultiplier,lastUpdatedS:time,control:{progressionRate:1,reductionPerS:0}};
  const s=m.infection,key=String(w.trainingMetadata?.shotId??w.id),at=w.trainingMetadata?.time??w.createdAt??time;let e=s.exposures.find(e=>e.shotKey===key);
  if(!e){e={shotKey:key,atS:at,organs:[]};s.exposures.push(e);}
  for(const h of hits){const id=h.id||h.organ;let o=e.organs.find(o=>o.id===id);if(!o){o={id,organ:h.organ,severity:0,direct:false,woundIds:[],lesions:[]};e.organs.push(o);}let l=o.lesions.find(l=>l.woundId===w.id);if(!l){l={woundId:w.id,severity:0,direct:false};o.lesions.push(l);}l.severity=Math.max(l.severity,clamp(h.severity));l.direct||=!!h.direct;o.severity=union(o.lesions.map(l=>l.severity));o.direct||=!!h.direct;if(!o.woundIds.includes(w.id))o.woundIds.push(w.id);}
  e.severity=union(e.organs.map(o=>o.severity));e.latencyS=infectionLatency(e.severity,s.skillLatencyMultiplier);e.onsetS=e.atS+e.latencyS;
  s.severity=union(s.exposures.map(e=>e.severity));s.onsetS=Math.min(...s.exposures.map(e=>e.onsetS));
 }
 return m.infection||null;
}
// MO5 seam only: no antibiotic item/dose/onset is implemented here.
export function setInfectionControl(m,{progressionRate=1,reductionPerS=0}={}){
 if(!m.infection)return false;if(!Number.isFinite(progressionRate)||!Number.isFinite(reductionPerS))throw Error('Invalid infection control');
 m.infection.control={progressionRate:clamp(progressionRate),reductionPerS:Math.max(0,reductionPerS)};return true;
}
export function stepInfection(m,dt,time){
 const s=recordInfectionWounds(m,time-dt);if(!s||m.isDead)return;
 const start=Math.max(time-Math.max(0,dt),s.lastUpdatedS),elapsed=Math.max(0,time-start),active=Math.max(0,time-Math.max(start,s.onsetS));
 if(time>=s.onsetS)s.symptomatic=true;
 if(elapsed>0)s.level=clamp(s.level+active/INFECTION.progressionS*s.control.progressionRate-elapsed*s.control.reductionPerS);
 s.lastUpdatedS=Math.max(s.lastUpdatedS,time);
}
export function infectionModifiers(m){const level=clamp(m?.infection?.level||0);return{level,staminaFactor:1-INFECTION.maximumStaminaLoss*level,recoveryFactor:1-INFECTION.maximumRecoveryLoss*level};}
export const infectionSymptoms=m=>m?.infection?.symptomatic?{level:clamp(m.infection.level),text:'감염 · '+Math.round(clamp(m.infection.level)*100)+'%'}:null;
