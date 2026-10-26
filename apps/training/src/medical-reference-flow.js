import{MEDICAL_S1_PHYSIOLOGY_VALUES}from'./medical-s1-effects.js';
// Wound-lifetime metadata, kept outside the original clinical JSON/snapshots.
export const REFERENCE_CIRCULATION=Object.freeze({mapMmHg:MEDICAL_S1_PHYSIOLOGY_VALUES.referenceMapMmHg,cardiacOutputMlMin:MEDICAL_S1_PHYSIOLOGY_VALUES.restingCardiacOutputMlMin,classification:'원본 S1 기준 순환 / 사용자 설계값: 생성 시 고정 Qref'});
const references=new WeakMap(),empty=Object.freeze({total:0,external:0,limbInternal:0,cavity:0});
export const hasReferenceFlow=w=>references.has(w);
export const referenceFlow=w=>references.get(w)||empty;
export function freezeReferenceFlow(w,components){
 if(references.has(w))return references.get(w);
 const external=Math.max(0,components.external||0),limbInternal=Math.max(0,components.limbInternal||0),cavity=Math.max(0,components.cavity||0),value=Object.freeze({total:external+limbInternal+cavity,external,limbInternal,cavity});references.set(w,value);return value;
}
