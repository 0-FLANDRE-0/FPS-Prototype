import { BODY_PROFILE } from './human-targets.js';
export const MEDICAL_SIDES = Object.freeze(['front','rear','left','right','top','bottom']);
const variants = {
  head: [['forehead'],['crown'],['temporal'],['occipital'],['upper','eyes'],['mid','nose'],['lower','jaw']],
  neck: [['throat_upper'],['throat_lower'],['side_neck'],['nape']],
  chest: ['upper','lower'].flatMap(z=>['center','left','right'].map(s=>[z,s])),
  abdomen: [['upper'],['lower'],['flank'],['pelvis','pelvis_upper']],
  arm: [['shoulder','deltoid_front'],['shoulder','deltoid_rear'],['shoulder','deltoid_outer'],['upper_arm'],['elbow'],['forearm'],['hand_wrist']],
  leg: [['upper_thigh'],['mid_thigh'],['knee'],['lower_leg'],['foot_ankle']],
};
export function mapMedicalAddress(address) {
  if (!address || !BODY_PROFILE.some(s=>s.id===address.shapeId && s.part===address.bodyPart)) throw Error('Unmapped body mesh');
  const family=address.bodyPart.endsWith('Arm')?'arm':address.bodyPart.endsWith('Leg')?'leg':address.bodyPart;
  if(!MEDICAL_SIDES.includes(address.side)||!variants[family]?.some(([z,s])=>z===address.zone&&(s||null)===(address.subZone||null)))
    throw Error('Unmapped medical zone: '+address.fullAddress);
  const hitPart=address.bodyPart.replace(/(Arm|Leg)$/,w=>`_${w.toLowerCase()}`);
  const impactAddress={...structuredClone(address),hitPart:address.hitPart==='face'?'face':hitPart,impactSide:address.side};
  // Front lower throat uses the canonical direct neck address. Other specific
  // neck/face zones are already recognized by normalizeMedicalImpactAddress.
  if(hitPart==='neck' && address.zone==='throat_lower')impactAddress.zone='neck_base';
  impactAddress.fullAddress=[impactAddress.side,impactAddress.region,impactAddress.hitPart,impactAddress.zone,impactAddress.subZone].filter(Boolean).join('.');
  const location=hitPart==='head'?(address.hitPart==='face'?'head_face':address.zone==='temporal'?'head_temporal':'head_skull'):hitPart;
  return {hitPart,location,isLeft:hitPart.startsWith('left_')?true:hitPart.startsWith('right_')?false:null,impactAddress};
}
// Enumerates every mesh, side and zone handled by the 3D classifier. The per-mesh
// list is a conservative superset where a joint cover crosses zone boundaries.
export function medicalAddressTable(){return BODY_PROFILE.map(shape=>{
  const family=shape.part.endsWith('Arm')?'arm':shape.part.endsWith('Leg')?'leg':shape.part;
  return {shapeId:shape.id,bodyPart:shape.part,bone:shape.bone,mappings:MEDICAL_SIDES.flatMap(side=>variants[family].map(([zone,subZone])=>{
    const face=shape.part==='head'&&['upper','mid','lower'].includes(zone);
    const address={shapeId:shape.id,bodyPart:shape.part,side,zone,subZone:subZone||null,hitPart:face?'face':shape.part,
      region:face||shape.part==='head'?'head':shape.part==='neck'?'neck':/Arm|Leg/.test(shape.part)?'limb':'torso'};
    return {side,zone,subZone:subZone||null,...mapMedicalAddress(address)};
  }))};});}
