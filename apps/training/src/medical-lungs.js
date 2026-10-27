// User design: persistent raid-local lung damage -> leg reserve/recovery only.
// Raw S1 damage remains unchanged. Same-shot duplicate overlap uses max; distinct
// shots combine as a bounded union. No pulmonary respiration/oxygen path.
export const LUNG_STAMINA=Object.freeze({perLung:.25,classification:'사용자 설계값; 손상 결합식 튜닝'});
export function lungDamage(m){
 const shots=new Map();for(const w of m.wounds||[])for(const h of w.s1OrganDamage||[]){if(h.organ!=='lung')continue;const side=h.id.startsWith('left')?'left':'right',key=(w.trainingMetadata?.shotId??w.id)+':'+side,d=Math.max(0,Math.min(1,h.severity??h.effectiveVolumeM3/h.volumeM3??0));const row=shots.get(key);if(!row||d>row.d)shots.set(key,{side,d});}
 const out={left:0,right:0};for(const{side,d}of shots.values())out[side]=1-(1-out[side])*(1-d);return{...out,factor:1-LUNG_STAMINA.perLung*(out.left+out.right)};
}
