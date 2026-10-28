import{MEDICAL_S0_VALUES}from'./medical-s0.js';
// Exact pre-MO4 cardiac-pump-failure predicate. A label assigned by generic
// arrest attribution alone is NOT this anatomical fatality decision.
export const cardiacPumpFailure=m=>m.heartInjury?.pumpFunction<=MEDICAL_S0_VALUES.failedPumpThreshold&&m.isUnconscious&&m.hemodynamics.oxygenDelivery<.25;
export function markFatalHeart(m,time){
 if(m.fatalHeartInjury)return;m.fatalHeartInjury={ruleId:'heart-fatal-mo4',reason:'cardiac_pump_failure',atS:time,pumpFunction:m.heartInjury.pumpFunction,failedPumpThreshold:MEDICAL_S0_VALUES.failedPumpThreshold,unconscious:!!m.isUnconscious,oxygenDelivery:m.hemodynamics.oxygenDelivery,oxygenThreshold:.25,direct:m.heartInjury.hits.some(h=>h.direct??h.chordM>0),hits:structuredClone(m.heartInjury.hits),irreversible:true,classification:'기존 펌프 실패 판정; 사용자 설계값: 같은 틱 즉시 사망'};
}
