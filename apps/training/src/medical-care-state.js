import{MO2,productRule}from'./medical-mo2-policy.js';
import{tourniquetPenalties}from'./medical-tourniquet.js';
export const CARE=MO2,carePlans=new WeakMap();
const clocks=new WeakMap(),painOverlays=new WeakMap();
export const setCareTime=(m,time)=>clocks.set(m,time),careTime=m=>clocks.get(m)??0;
export const treatments=m=>(m.appliedTreatments||[]).filter(t=>t.status!=='removed');
export const activeTreatment=m=>treatments(m).find(t=>t.status==='active')||null;
export function careTiming(m,kind){
 if(m.isUnconscious||m.isDead||m.cardiacArrest)return{allowed:false,reason:'의식이 없어 자가 처치할 수 없습니다.'};
 const hands=['leftArm','rightArm'].filter(k=>!m.bodyParts[k].s2Comminuted&&!m.bodyParts[k].s2Amputated&&!m.bodyParts[k].amputated).length;
 if(!hands)return{allowed:false,reason:'사용 가능한 손이 없습니다.'};const seconds=productRule(kind).seconds;
 return{allowed:true,hands,multiplier:1,baseSeconds:seconds,estimatedSeconds:seconds,classification:'고정 사용시간; 부상·통증·관류 시간 배율 폐기'};
}
export function treatmentForWound(m,w){return treatments(m).filter(t=>t.target?.woundId===w.id||t.kind==='cat'&&t.target.partKey===w.partKey);}
export function treatmentStatus(ts){return ts.some(t=>t.status==='active')?'active':ts.some(t=>t.status==='interrupted')?'interrupted':ts.some(t=>t.status==='completed')?'treated':'untreated';}
export function careClinicalBefore(m){const old=painOverlays.get(m);if(old){for(const[k,v]of old){const p=m.bodyParts[k];if(p.pain>=v.written)p.pain=v.before+(p.pain-v.written);}painOverlays.delete(m);}}
export function careClinicalAfter(m){const effect=tourniquetPenalties(m,careTime(m)),rows=new Map();for(const[k,pain]of Object.entries(effect.pain)){const p=m.bodyParts[k];if(pain>p.pain){rows.set(k,{before:p.pain,written:pain});p.pain=pain;}}if(rows.size)painOverlays.set(m,rows);}
