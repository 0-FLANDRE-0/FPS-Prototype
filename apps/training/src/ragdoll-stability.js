import {Vector3,Quaternion} from 'three';
// Engine stabilization tuning, not anatomical mass/inertia measurements.
// Distal capsules, the light neck and thighs receive extra inertia. Additional mass
// is exactly zero, so the original Dempster/equipment mass and COM remain intact.
export const RAGDOLL_STABILITY=Object.freeze({
 handInertiaFloorKgM2:.006,footInertiaFloorKgM2:.006,neckInertiaFloorKgM2:.012,hipInertiaFloorKgM2:.25,solverIterations:64,
});
export function stabilizeRagdollInertia(parts){
 const rows=[];
 for(const part of parts.values()){
  const floor=part.bone.endsWith('Hand')?RAGDOLL_STABILITY.handInertiaFloorKgM2:part.bone.endsWith('Foot')?RAGDOLL_STABILITY.footInertiaFloorKgM2:part.bone==='neck'?RAGDOLL_STABILITY.neckInertiaFloorKgM2:part.bone.endsWith('UpperLeg')?RAGDOLL_STABILITY.hipInertiaFloorKgM2:0;
  if(!floor)continue;
  const body=part.body,before=body.principalInertia(),mass=body.mass(),center=body.localCom(),frame=body.principalInertiaLocalFrame(),extra=new Vector3(...['x','y','z'].map(axis=>Math.max(0,floor-before[axis])));
  body.setAdditionalMassProperties(0,center,extra,new Quaternion(frame.x,frame.y,frame.z,frame.w),false);body.recomputeMassPropertiesFromColliders();
  const after=body.principalInertia();rows.push({bone:part.bone,floorKgM2:floor,massBeforeKg:mass,massAfterKg:body.mass(),centerBeforeM:{...center},centerAfterM:{...body.localCom()},inertiaBeforeKgM2:{...before},inertiaAfterKgM2:{...after},additionalMassKg:0});
 }
 return rows;
}
