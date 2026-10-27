// MO3 blood-source ownership. Linked injuries carry no additional bullet/HP hit.
export const bleedingWounds=m=>(m.bleedingWounds?.length?[...m.wounds,...m.bleedingWounds]:m.wounds);
export const bleedingWound=(m,id)=>bleedingWounds(m).find(w=>w.id===id);
export function anatomicalPart(h,fallback){const d=h?.domain||'';if(d==='pelvis')return'abdomen';if(/^(left|right)-(upper-arm|forearm|hand)$/.test(d))return d.startsWith('left')?'leftArm':'rightArm';if(/^(left|right)-(thigh|lower-leg|foot)$/.test(d))return d.startsWith('left')?'leftLeg':'rightLeg';if(['head','neck','chest','abdomen','leftArm','rightArm','leftLeg','rightLeg'].includes(d))return d;if(['lung','heart_hook_only'].includes(h?.organ))return'chest';if(['liver','spleen','kidney','bowel','stomach','bladder'].includes(h?.organ))return'abdomen';return fallback;}
export function sourceOwner(m,origin,part){
 if(part===origin.partKey)return origin;const shot=origin.trainingMetadata?.shotId;
 const actual=shot==null?null:m.wounds.find(w=>w.partKey===part&&w.trainingMetadata?.shotId===shot);if(actual)return actual;
 m.bleedingWounds??=[];let w=m.bleedingWounds.find(w=>w.partKey===part&&w.originWoundIds.includes(origin.id));if(!w){w={id:'linked-'+origin.id+'-'+part,partKey:part,sourceOnly:true,b1Registered:true,originWoundIds:[origin.id],bleedSourceIds:[],createdAt:origin.trainingMetadata?.time??origin.createdAt??0,ammoId:origin.ammoId};m.bleedingWounds.push(w);}return w;
}
export function reconcileSourceOwners(m){
 for(const s of m.bleedSources||[])for(const l of s.lesions||[]){const origin=m.wounds.find(w=>w.id===l.originWoundId);if(!origin)continue;const owner=sourceOwner(m,origin,l.anatomicalPart||s.partKey||origin.partKey);l.woundId=owner.id;}
 // Merge same-shot linked injuries without inventing an entry/exit or tissue HP damage.
 const canonical=new Map();for(const w of m.bleedingWounds||[]){const origin=m.wounds.find(o=>o.id===w.originWoundIds[0]),shot=origin?.trainingMetadata?.shotId,key=shot==null?w.id:shot+':'+w.partKey;if(canonical.has(key)){const target=canonical.get(key);for(const s of m.bleedSources)for(const l of s.lesions||[])if(l.woundId===w.id)l.woundId=target.id;for(const id of w.originWoundIds)if(!target.originWoundIds.includes(id))target.originWoundIds.push(id);}else canonical.set(key,w);}
 const used=new Set();for(const w of bleedingWounds(m))w.bleedSourceIds=[];for(const s of m.bleedSources||[]){s.woundIds=[...new Set((s.lesions||[]).map(l=>l.woundId))];for(const id of s.woundIds){used.add(id);const w=bleedingWound(m,id);if(w)w.bleedSourceIds.push(s.id);}}
 if(m.bleedingWounds)m.bleedingWounds=[...canonical.values()].filter(w=>used.has(w.id));
}
