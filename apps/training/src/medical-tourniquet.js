import {MO2} from './medical-mo2-policy.js';
export const tourniquetOn=(m,part)=>!!m.appliedTreatments?.some(t=>t.kind==='cat'&&t.status==='completed'&&t.target.partKey===part);
export function tourniquetPenalties(m,time){
 const out={pain:{},armTremorRad:0,limp:{left:0,right:0},moveRate:1};if(!m?.appliedTreatments)return out;
 const p=MO2.tourniquet;
 for(const t of m.appliedTreatments){
  if(t.kind!=='cat'||!['completed','removed'].includes(t.status))continue;
  const attached=t.status==='completed',age=Math.max(0,(attached?time:t.removedAtS)-t.appliedAtS),gain=Math.min(1,age/p.painRiseS),fade=attached?1:Math.max(0,1-(time-t.removedAtS)/p.painFadeS),pain=(p.painStart+(p.painMaximum-p.painStart)*gain)*fade,key=t.target.partKey;
  out.pain[key]=Math.max(out.pain[key]||0,pain);
  if(attached&&key.endsWith('Arm'))out.armTremorRad=Math.max(out.armTremorRad,p.armTremorMaximumRad*gain);
  if(attached&&key.endsWith('Leg')){const limp=Math.min(1,Math.max(0,(age-p.limpStartS)/(p.limpFullS-p.limpStartS)))*p.limpMaximum;out.limp[key.startsWith('left')?'left':'right']=limp;out.moveRate=Math.min(out.moveRate,1-(1-p.minimumMoveRate)*limp/p.limpMaximum);}
 }
 return out;
}
