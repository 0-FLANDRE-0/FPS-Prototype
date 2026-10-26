import{treatments,setCareTime,careTime}from'./medical-care-state.js';
import{TEMPORARY_CARE}from'./medical-mo2-policy.js';
export{setCareTime,careTime};
// Temporary former realistic TXA only. Foam is a per-wound MO2 product now.
export const SYSTEMIC_CARE={txaDelay:TEMPORARY_CARE.txaDelay,txa:TEMPORARY_CARE.txa,txaArtery:TEMPORARY_CARE.txaArtery,classification:TEMPORARY_CARE.classification};
export function systemicCareFactor(m,s){let factor=1;for(const t of treatments(m)){if(t.status!=='completed'||t.kind!=='txa'||t.effectEligible===false||careTime(m)<t.appliedAtS+SYSTEMIC_CARE.txaDelay)continue;factor*=s.vesselKind==='artery'?SYSTEMIC_CARE.txaArtery:SYSTEMIC_CARE.txa;}return factor;}
export function systemicCarePain(){}
