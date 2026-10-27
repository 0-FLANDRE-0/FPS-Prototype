// MO3 preserves the sum of old MO2b resource components, not blood routing.
// These opening facts affect resource points only. No flow fraction is computed.
const openings=new WeakMap();
export function recordWorkOpening(m,w,surface){if(surface?.entry){if(!openings.has(m))openings.set(m,new Map());openings.get(m).set(w.id,{exit:!!surface.exit});}}
export function summedComponentWork(m,w,s,lesion,area,k){
 let parts=[1];const origin=(m.wounds||[]).find(o=>o.id===(lesion.originWoundId||w.id))||w;
 if(s.injuryType==='ooze'&&s.ooze.costTwoParts)parts=[.5,.5];
 else if(['artery','vein'].includes(s.vesselKind)&&!s.organBed&&/(Arm|Leg)$/.test(origin.partKey)&&/(Arm|Leg)$/.test(s.partKey)){const o=openings.get(m)?.get(origin.id);if(o)parts=o.exit?[.85,.15]:[.4,.6];}
 return parts.reduce((n,f)=>n+Math.max(k.minimumComponentWork,area*f*k.workPerAreaMm2),0);
}
