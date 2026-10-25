// 3D only. M4c user design/game allowance; these are not clinical recommendations.
export const M4C=Object.freeze({
 ruleId:'care-m4c-v62',
 caps:{game:{injury:1.2,total:1.5},realistic:{injury:1.5,total:2.2}},
 profiles:{
  game:{catSeconds:{leg:3,arm:2.5},bandageSeconds:3,gauzePackingSeconds:3,gauzePressureSeconds:4,sealSeconds:2,needleSeconds:2,txaSeconds:2,foamSeconds:3},
  realistic:{catSeconds:{leg:10,arm:8},bandageSeconds:8,gauzePackingSeconds:8,gauzePressureSeconds:20,sealSeconds:6,needleSeconds:8,txaSeconds:8,foamSeconds:12}
 },
 oneHandPressureEfficacy:.98,
 classification:'출처: 기존 현실180초 압박 근거 유지 / 원본: 현실 손 동작·약효·주입 / 사용자 설계값: 시간 분리·상한·리얼리스틱 시간 / 게임 허용: 단축 / 튜닝: 게임 시간·한 손 완료 압박효과98%',
 reversePortCandidate:true,automatic2DPort:false
});

export function careRemainingSeconds(workS,p,multiplier){
 return Math.max(0,p.gauzePackingSeconds-workS)*multiplier+
  Math.max(0,p.gauzePressureSeconds-Math.max(0,workS-p.gauzePackingSeconds));
}

// workS remains nominal packing + pressure seconds for existing effects/UI.
// Split at the boundary even when one simulation tick crosses both stages.
export function advanceGauze(t,dt,p,hands){
 const packing=p.gauzePackingSeconds,total=packing+p.gauzePressureSeconds;
 if(t.workS<packing){
  const until=(packing-t.workS)*t.timing.multiplier;
  if(dt<until){t.workS+=dt/t.timing.multiplier;return;}
  t.workS=packing;dt-=until;
 }
 const pressed=Math.min(dt,total-t.workS);
 if(hands===1&&pressed>0)t.oneHandPressureS=(t.oneHandPressureS||0)+pressed;
 t.workS=Math.min(total,t.workS+pressed);
}

export function completedGauzeCoefficient(t,original,pressureSeconds){
 // Two-hand records, including pre-M4c saves, retain exact original arithmetic.
 if(t.treatmentMode==='game'||!(t.oneHandPressureS>0))return original;
 const fraction=Math.min(1,t.oneHandPressureS/pressureSeconds);
 return original+(1-original)*(1-M4C.oneHandPressureEfficacy)*fraction;
}
