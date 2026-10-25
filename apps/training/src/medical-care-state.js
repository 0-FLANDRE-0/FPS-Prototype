import{isNewBandage}from'./medical-bandage.js';
// M3 game treatment state, created lazily: untreated medical JSON stays v58 exact.
// No medical/HP/ballistic formula or legacy 2D declaration is replaced here.
import{careProfile,careDuration}from'./medical-care-modes.js';
import{M4C,careRemainingSeconds}from'./medical-care-m4c-policy.js';
import{SOLDIER_BONES}from'./soldier-rig.js';
export const CARE=Object.freeze({ruleId:'self-care-m3-v59',catSeconds:{arm:28,leg:37.5},oneHandMultiplier:1.65,bandageSeconds:30,gauzePackingSeconds:30,gauzePressureSeconds:180,resumeSetupSeconds:1.5,aboveWoundM:.065,catResidual:.00005,looseArteryGain:.35,looseVeinFactor:.15,catPain:70,bandage:{artery:.8,vein:.15,capillary:.1},gauze:{artery:.03,vein:.05,capillary:.1},manualPressure:{artery:.15,vein:.15,capillary:.15},interruptedGauzeGain:.25,classification:'다리 CAT37.5초 연구 중앙값·180초 압박 제조사 출처; 위팔28초; 적용 시간·계수·배율·통증은 튜닝, 위치/중단/구성은 사용자 설계값',reversePortCandidate:true,automatic2DPort:false});
export const carePlans=new WeakMap();
// Private split of B1's existing mixed torso ooze; no new snapshot fields.
export const oozeSplits=new WeakMap();
export function rememberOozeSplit(m,s,external,total){if(!oozeSplits.has(m))oozeSplits.set(m,new Map());const rows=oozeSplits.get(m),r=rows.get(s.id)||{externalMl:0,externalFlowMlPerS:0};r.externalFraction=total>0?Math.max(0,Math.min(1,external/total)):0;rows.set(s.id,r);}
const painOverlays=new WeakMap();
export const treatments=m=>(m.appliedTreatments||[]).filter(t=>t.status!=='removed');
export const activeTreatment=m=>treatments(m).find(t=>t.status==='active')||null;
const bones=Object.fromEntries(SOLDIER_BONES.map(b=>[b.name,b.at])),clamp=x=>Math.max(0,Math.min(1,x));
export function limbChain(position){
 const partKey=position?.partKey;if(!/(Arm|Leg)$/.test(partKey||''))return null;
 const side=partKey.startsWith('left')?'left':'right',chain=(partKey.endsWith('Arm')?['UpperArm','Forearm','Hand','Middle1']:['UpperLeg','LowerLeg','Foot','Toes']).map(n=>side+n).filter(n=>bones[n]);
 const origin=bones[position.bone],point=position.bindActorPoint||(origin&&position.boneLocalPoint?origin.map((v,i)=>v+position.boneLocalPoint[i]):origin);if(!point)return null;
 let best=null,total=0;for(let i=0;i<chain.length-1;i++){const a=bones[chain[i]],b=bones[chain[i+1]],d=b.map((v,j)=>v-a[j]),l=Math.hypot(...d),u=clamp(d.reduce((n,v,j)=>n+(point[j]-a[j])*v,0)/(l*l)),distance=Math.hypot(...point.map((v,j)=>v-a[j]-d[j]*u));if(!best||distance<best.distance)best={partKey,chainOrder:i+u,pathDistanceM:total+l*u,distance,bone:chain[i],proximalPoint:position.proximalPoint||{chainOrder:0,bone:chain[0]}};total+=l;}
 return best;
}
export function regionPosition(partKey,region){const side=partKey.startsWith('left')?'left':'right',bone=side+({upperArm:'UpperArm',forearm:'Forearm',upperLeg:'UpperLeg',lowerLeg:'LowerLeg'}[region]||'');return bones[bone]?{partKey,bone,bindActorPoint:[...bones[bone]]}:null;}
export function limbPointAtDistance(partKey,distance){const side=partKey.startsWith('left')?'left':'right',chain=(partKey.endsWith('Arm')?['UpperArm','Forearm','Hand']:['UpperLeg','LowerLeg','Foot']).map(n=>bones[side+n]);let remaining=distance;for(let i=1;i<chain.length;i++){const a=chain[i-1],b=chain[i],length=Math.hypot(...b.map((v,j)=>v-a[j]));if(remaining<=length)return a.map((v,j)=>v+(b[j]-v)*remaining/length);remaining-=length;}return[...chain.at(-1)];}
export const treatmentProfile=t=>careProfile(t.treatmentMode||'reality',CARE);
export function careTiming(m,kind,partKey,feedback={},mode='reality'){
 const arms=['leftArm','rightArm'].map(k=>m.bodyParts[k]),usable=arms.filter(p=>!p.s2Comminuted&&!p.s2Amputated&&!p.amputated);if(m.isUnconscious||m.isDead||m.cardiacArrest)return{allowed:false,reason:'의식이 없어 자가 처치할 수 없습니다.'};if(!usable.length)return{allowed:false,reason:'두 팔이 분쇄·절단되어 자가 처치할 수 없습니다.'};
 const fn=usable.reduce((n,p)=>n+clamp(p.functionRatio??1),0)/usable.length,pain=Math.max(m.stressResponse?.perceivedPain??m.pain??0,...usable.map(p=>p.pain||0))/100,tremor=clamp(Math.hypot(...Object.values(feedback.amplitudes||{}).filter(Number.isFinite))/.004),consciousness=clamp((100-(m.consciousness??100))/100),perfusion=1-clamp(m.hemodynamics?.tissuePerfusion??1);
 const originalMultiplier=(usable.length===1?CARE.oneHandMultiplier:1)*(1+1.1*(1-fn))*(1+.8*pain)*(1+.35*tremor)*(1+.8*consciousness)*(1+.7*perfusion);
 // Preserve v61's exact multiplication order for uncapped reality hand work.
 const oneHand=usable.length===1?CARE.oneHandMultiplier:1,caps=M4C.caps[mode],multiplier=caps?Math.min(caps.total,Math.min(caps.injury,originalMultiplier/oneHand)*oneHand):originalMultiplier,profile=careProfile(mode,CARE),base=careDuration(kind,partKey,profile,mode);
 return{allowed:true,hands:usable.length,multiplier,baseSeconds:base,estimatedSeconds:kind==='gauze'?careRemainingSeconds(0,profile,multiplier):base*multiplier,factors:{function:fn,pain,tremor,consciousness,perfusion},classification:'사용자 설계값·게임 허용·튜닝; 손 동작만 부상 배율, 거즈 압박은 모드별 고정 시간; 현실 손 동작은 v61 원본'};
}
export function matchesTourniquet(t,position){const p=limbChain(position);return!!p&&t.target.partKey===p.partKey&&p.pathDistanceM>t.target.pathDistanceM+1e-8;}
export function treatmentForWound(m,w){return treatments(m).filter(t=>t.kind!=='cat'&&t.target.woundId===w.id||t.kind==='cat'&&t.target.partKey===w.partKey&&(m.bleedSources||[]).some(s=>!['intra_thoracic','intra_abdominal','junctional'].includes(s.controlClass)&&s.woundIds.includes(w.id)&&(s.lesions.length?s.lesions:[s]).some(l=>(l.woundId==null||l.woundId===w.id)&&matchesTourniquet(t,l.position||s.position))));}
export function treatmentStatus(list){list=list.filter(t=>!isNewBandage(t)||t.status!=='active');return list.some(t=>t.status==='interrupted')?'interrupted':list.length?'treated':'untreated';}
export function careClinicalBefore(m){const previous=painOverlays.get(m);if(previous){for(const[k,p]of previous){const part=m.bodyParts[k];if(part.pain>=p.written)part.pain=p.before+(part.pain-p.written);}painOverlays.delete(m);}if(!treatments(m).some(t=>t.kind==='cat'&&t.progress>0))return;m.acutePain=Math.max(m.acutePain||0,CARE.catPain);}
export function careClinicalAfter(m){
 const overlays=new Map();for(const t of treatments(m)){if(t.kind!=='cat'||t.progress<=0)continue;const k=t.target.partKey,p=m.bodyParts[k];p.functionRatio=0;if(!overlays.has(k))overlays.set(k,{before:p.pain||0,written:Math.max(p.pain||0,CARE.catPain)});p.pain=Math.max(p.pain||0,CARE.catPain);if(k.endsWith('Arm'))m.canShoot=false;else{m.canWalk=false;m.canMove=!!m.canCrawl;}}if(overlays.size)painOverlays.set(m,overlays);
}
