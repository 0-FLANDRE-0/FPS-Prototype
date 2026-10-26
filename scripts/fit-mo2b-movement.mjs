import{mkdir,writeFile}from'node:fs/promises';import{MO2}from'../apps/training/src/medical-mo2-policy.js';import{sampleMovement}from'./mo2b-fixtures.mjs';
const result=[];
for(const[running,targetSeep,targetReopen,startS,startR]of[[false,.45,.07,.0199,.00242],[true,.55,.60,.0266,.0305]]){
 const sKey=running?'runSeepPerS':'walkSeepPerS',rKey=running?'runReopenPerS':'walkReopenPerS',cache=new Map();
 function evaluate(s,r){s=Number(s.toPrecision(6));r=Number(r.toPrecision(6));const key=s+':'+r;if(cache.has(key))return cache.get(key);const p={...MO2.movement,[sKey]:s,[rKey]:r},trial=sampleMovement(running,p),score=(trial.seepTrialRate-targetSeep)**2+(trial.reopenTrialRate-targetReopen)**2,row={s,r,score,trial};cache.set(key,row);return row;}
 let best=evaluate(startS,startR);const initial=best;
 for(let round=0;round<5&&best.score>0;round++){const fraction=[.8,.4,.15,.05,.015][round];for(const axis of['s','r']){const center=best;for(let i=-8;i<=8;i++){const candidate=evaluate(axis==='s'?Math.max(1e-8,center.s*(1+i*fraction/8)):center.s,axis==='r'?Math.max(1e-8,center.r*(1+i*fraction/8)):center.r);if(candidate.score<best.score)best=candidate;}}console.log(JSON.stringify({running,round,s:best.s,r:best.r,seep:best.trial.seepTrialRate,reopen:best.trial.reopenTrialRate}));}
 result.push({running,targetSeep,targetReopen,initial,best,methods:'500 seeds0x740000+i,30s60Hz, production selectMovementEvent; first rupture terminates; prior separate seep counts as an experience, rupture itself is never an extra seep.'});
}
await mkdir('artifacts/qa/mo2b',{recursive:true});await writeFile('artifacts/qa/mo2b/movement-fit.json',JSON.stringify(result,null,2)+'\n');
