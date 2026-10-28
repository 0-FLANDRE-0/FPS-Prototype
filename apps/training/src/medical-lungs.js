// User design: persistent raid-local lung damage -> leg reserve/recovery only.
// Raw S1 damage remains unchanged. Same-shot duplicate overlap uses max; distinct
// shots combine as a bounded union. No pulmonary respiration/oxygen path.
export const LUNG_STAMINA=Object.freeze({perLung:.25,gain:1.4117698367631553,classification:'사용자 설계값; g는 실제3탄 직접 관통 d의 중앙값을12.5%에 맞춘 튜닝; M80 목표 초과는 대장 기록'});
export function lungDamage(m){
 const shots=new Map();for(const w of m.wounds||[])for(const h of w.s1OrganDamage||[]){if(h.organ!=='lung')continue;const side=h.id.startsWith('left')?'left':'right',key=(w.trainingMetadata?.shotId??w.id)+':'+side,d=Math.max(0,Math.min(1,h.severity??h.effectiveVolumeM3/h.volumeM3??0));const row=shots.get(key);if(!row||d>row.d)shots.set(key,{side,d});}
 const out={left:0,right:0};for(const{side,d}of shots.values())out[side]=1-(1-out[side])*(1-d);const leftLoss=Math.min(LUNG_STAMINA.perLung,LUNG_STAMINA.gain*out.left),rightLoss=Math.min(LUNG_STAMINA.perLung,LUNG_STAMINA.gain*out.right);return{...out,leftLoss,rightLoss,factor:1-leftLoss-rightLoss};
}
