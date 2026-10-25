import{treatments}from'./medical-care-state.js';
import{M4_VALUES}from'./medical-care-modes.js';
const times=new WeakMap();
export const SYSTEMIC_CARE={game:{txaDelay:5,txa:.5,txaArtery:.9,foamDelay:3,foam:0,foamArtery:.5},realistic:{txaDelay:30,txa:.75,txaArtery:1,foamDelay:15,foam:0.0365869140625,foamArtery:.8},reality:{txaDelay:600,txa:.95,txaArtery:1,foamDelay:30,foam:.9,foamArtery:1}};
export const setCareTime=(m,time)=>times.set(m,time);
export const careTime=m=>times.get(m)??0;
export function systemicCareFactor(m,s){let factor=1;for(const t of treatments(m)){if(t.status!=='completed'||!['txa','foam'].includes(t.kind)||t.effectEligible===false)continue;const k=SYSTEMIC_CARE[t.treatmentMode||'reality'];if(careTime(m)<t.appliedAtS+k[t.kind+'Delay'])continue;if(t.kind==='txa')factor*=s.vesselKind==='artery'?k.txaArtery:k.txa;else if(s.destination==='peritoneal')factor*=s.vesselKind==='artery'?k.foamArtery:k.foam;}return factor;}
export function systemicCarePain(m){if(treatments(m).some(t=>t.kind==='foam'&&t.status==='completed'&&careTime(m)>=t.appliedAtS+SYSTEMIC_CARE[t.treatmentMode||'reality'].foamDelay)){m.bodyParts.abdomen.pain=Math.max(m.bodyParts.abdomen.pain||0,M4_VALUES.foamPain);}}
