import {Quaternion} from 'three';

// Game tuning for the final, passive contact phase. These are dissipative
// damping and sleep gates, not muscle torques, anatomy or medical parameters.
export const RAGDOLL_SETTLING=Object.freeze({
 minimumPassiveS:.75,contactStableS:.25,quietS:.6,wakeCooldownS:.5,
 dampingAngular:64,dampingExtremities:128,dampingLinear:24,
 dampingCoreMaxAngularRadps:.5,dampingCoreMaxLinearMps:.2,
 residualQuietS:.25,residualCoreMaxAngularRadps:.1,residualCoreMaxLinearMps:.03,
 residualMaxAngularRadps:.5,residualMaxLinearMps:.1,
 residualDampingAngular:128,residualDampingExtremities:256,residualDampingLinear:64,
 sleepMaxAngularRadps:.12,sleepMaxLinearMps:.015,
 maxJointExcessRad:Math.PI/18,contactPredictionM:.012,minimumSupportBodies:2,
 lyingMaxTorsoElevationDeg:35,lyingMaxPelvisHeightM:.5,lyingMaxHeadHeightM:.65,lyingMaxChestHeightM:.6,
});
const Q=p=>new Quaternion(p.x,p.y,p.z,p.w),wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
function maxJointExcess(r){
 let maximum=0;
 for(const j of r.joints){
  const a=Q(r.parts.get(j.parentBone).body.rotation()).multiply(Q(j.joint.frameX1())),b=Q(r.parts.get(j.childBone).body.rotation()).multiply(Q(j.joint.frameX2())),q=a.invert().multiply(b).normalize();
  for(const axis of [3,4,5]){const l=j.limits.find(limit=>limit.axis===axis),lockedExtra=!l&&(j.kind==='head-neck-fixed'||j.kind==='elbow'||j.kind==='knee');if(!l&&!lockedExtra)continue;const min=l?j.joint.rawSet.jointLimitsMin(j.joint.handle,axis):0,max=l?j.joint.rawSet.jointLimitsMax(j.joint.handle,axis):0,angle=2*Math.atan2([q.x,q.y,q.z][axis-3],q.w);maximum=Math.max(maximum,Math.abs(wrap(angle-(min+max)/2))-(max-min)/2);}
 }
 return maximum;
}
function supports(r){
 const world=r.physics.world,pairs=[],bodies=new Set(),heights=[];let core=false;
 for(const part of r.parts.values()){
  // Avoid nested rigid-body/collider-set queries while Rapier borrows its
  // narrow phase to enumerate contacts. Inspect handles only after callback.
  const handles=[];world.contactPairsWith(part.collider,other=>handles.push(other.handle));
  for(const handle of handles){
   const other=world.getCollider(handle);if(!other||other.isSensor())continue;
   const parent=other.parent();if(parent&&!parent.isFixed())continue;
   let supported=false;world.contactPair(part.collider,other,manifold=>{const normal=manifold.normal();if(Math.abs(normal.y)<.65)return;for(let i=0;i<manifold.numSolverContacts();i++)if(manifold.solverContactDist(i)<=RAGDOLL_SETTLING.contactPredictionM){supported=true;const point=manifold.solverContactPoint(i);if(point)heights.push(point.y);}});
   if(supported){bodies.add(part.bone);core||=/^(pelvis|spine|chest|neck|head)$/.test(part.bone);pairs.push(String(handle));}
  }
 }
 return{count:bodies.size,core,key:[...new Set(pairs)].sort().join('|'),floorY:heights.length?Math.min(...heights):null};
}
function lyingPose(r,floorY){
 if(floorY===null)return{lying:false,floorY};
 const pelvis=r.parts.get('pelvis').body.translation(),neck=r.parts.get('neck').body.translation(),head=r.parts.get('head').body.translation(),chest=r.parts.get('chest').body.translation(),dx=neck.x-pelvis.x,dy=neck.y-pelvis.y,dz=neck.z-pelvis.z,
  torsoElevationDeg=Math.asin(Math.min(1,Math.abs(dy)/Math.hypot(dx,dy,dz)))*180/Math.PI,pelvisHeightM=pelvis.y-floorY,headHeightM=head.y-floorY,chestHeightM=chest.y-floorY;
 return{floorY,pelvisHeightM,headHeightM,chestHeightM,torsoElevationDeg,lying:pelvisHeightM<=RAGDOLL_SETTLING.lyingMaxPelvisHeightM&&headHeightM<=RAGDOLL_SETTLING.lyingMaxHeadHeightM&&chestHeightM<=RAGDOLL_SETTLING.lyingMaxChestHeightM&&torsoElevationDeg<=RAGDOLL_SETTLING.lyingMaxTorsoElevationDeg};
}
function restoreDamping(r,state){
 if(state.baseDamping)for(const [name,base]of state.baseDamping){const p=r.parts.get(name);p.body.setLinearDamping(base.linear);p.body.setAngularDamping(base.angular);}
 state.dampingRaised=false;state.residualDampingRaised=false;state.residualQuietS=0;
}
// Restore ordinary damping BEFORE the actual hit impulse is integrated. This
// keeps the final settling viscosity from swallowing the first post-hit step.
export function wakeRagdollSettling(r){
 const state=r.settling;if(!state)return;
 const changed=state.wasSleeping||state.dampingRaised;restoreDamping(r,state);
 state.quietS=0;state.contactStableS=0;state.wakeCooldownS=RAGDOLL_SETTLING.wakeCooldownS;state.wasSleeping=false;
 if(changed)state.wakeTransitions++;state.phase='wake';
}

// Call once after each world.step, before skipping sleeping skeleton sync.
// Rapier0.21 has no exposed sleep-threshold setter. Its real body.sleep() API
// is used only after all 17 actual bodies have stayed quiet on stable support;
// no transforms, velocities, joint limits or reported counters are overwritten.
export function updateRagdollSettling(r,dt=r.physics.world.timestep){
 if(!r.active)return null;
 const state=r.settling??={passiveS:0,contactStableS:0,quietS:0,wakeCooldownS:0,wasSleeping:false,dampingRaised:false,sleepTransitions:0,wakeTransitions:0},parts=[...r.parts.values()],allSleeping=parts.every(p=>p.body.isSleeping());
 state.sleepingBodies=parts.filter(p=>p.body.isSleeping()).length;
 if(state.wasSleeping&&!allSleeping){restoreDamping(r,state);state.quietS=0;state.contactStableS=0;state.wakeCooldownS=RAGDOLL_SETTLING.wakeCooldownS;state.wakeTransitions++;}
 state.wasSleeping=allSleeping;
 if(allSleeping){state.phase='sleeping';return state;}
 if(r.mode!=='passive'||r.joints.some(j=>j.controls.some(c=>(c.strength||0)>0))){state.passiveS=state.quietS=state.contactStableS=0;state.phase='active';return state;}
 state.passiveS+=dt;state.wakeCooldownS=Math.max(0,state.wakeCooldownS-dt);
 state.maxAngularRadps=Math.max(...parts.map(p=>{const w=p.body.angvel();return Math.hypot(w.x,w.y,w.z);}));
 state.maxLinearMps=Math.max(...parts.map(p=>{const v=p.body.linvel();return Math.hypot(v.x,v.y,v.z);}));
 const core=parts.filter(p=>/^(pelvis|spine|chest)$/.test(p.bone));
 state.coreMaxAngularRadps=Math.max(...core.map(p=>{const w=p.body.angvel();return Math.hypot(w.x,w.y,w.z);}));
 state.coreMaxLinearMps=Math.max(...core.map(p=>{const v=p.body.linvel();return Math.hypot(v.x,v.y,v.z);}));
 const contact=supports(r);state.supportBodies=contact.count;state.coreSupported=contact.core;state.lyingPose=lyingPose(r,contact.floorY);
 // Stability tracks the supporting environment surface; an extra hand/foot
 // touching that same floor must not reset an otherwise stable torso support.
 state.contactStableS=contact.key&&contact.key===state.contactKey?state.contactStableS+dt:0;state.contactKey=contact.key;
 if((!contact.core||contact.count<RAGDOLL_SETTLING.minimumSupportBodies||!state.lyingPose.lying)&&state.dampingRaised)restoreDamping(r,state);
 if(state.passiveS<RAGDOLL_SETTLING.minimumPassiveS||!contact.core||contact.count<RAGDOLL_SETTLING.minimumSupportBodies||state.contactStableS<RAGDOLL_SETTLING.contactStableS||state.wakeCooldownS>0){state.quietS=0;state.phase='contact';return state;}
 // A resting pelvis or bracing hands can support a stable seated/tripod pose.
 // Heavy final damping must not arrest the body before it has actually lain down.
 if(!state.lyingPose.lying){if(state.dampingRaised)restoreDamping(r,state);state.quietS=0;state.phase='toppling';return state;}
 state.maxJointExcessRad=maxJointExcess(r);
 // RG1: retain the measured joint error, but do not let it veto resting
 // damping after the high-iteration window. Otherwise late low-cost contacts
 // can remain awake forever solely because the old solver limit is exceeded.
 state.jointErrorAboveLegacyGate=state.maxJointExcessRad>RAGDOLL_SETTLING.maxJointExcessRad;
 if(!state.dampingRaised&&state.coreMaxAngularRadps<=RAGDOLL_SETTLING.dampingCoreMaxAngularRadps&&state.coreMaxLinearMps<=RAGDOLL_SETTLING.dampingCoreMaxLinearMps){
  state.baseDamping??=new Map(parts.map(p=>[p.bone,{linear:p.body.linearDamping(),angular:p.body.angularDamping()}]));
  for(const p of parts){p.body.setLinearDamping(Math.max(p.body.linearDamping(),RAGDOLL_SETTLING.dampingLinear));p.body.setAngularDamping(Math.max(p.body.angularDamping(),/Hand|Foot|^(head|neck)$/.test(p.bone)?RAGDOLL_SETTLING.dampingExtremities:RAGDOLL_SETTLING.dampingAngular));}state.dampingRaised=true;
 }
 // A second viscous phase is allowed only after an already lying trunk and
 // every limb show low residual motion. It dissipates motion through Rapier;
 // the sleep thresholds and all actual velocity measurements remain unchanged.
 const residualQuiet=state.dampingRaised&&state.coreMaxAngularRadps<=RAGDOLL_SETTLING.residualCoreMaxAngularRadps&&state.coreMaxLinearMps<=RAGDOLL_SETTLING.residualCoreMaxLinearMps&&state.maxAngularRadps<=RAGDOLL_SETTLING.residualMaxAngularRadps&&state.maxLinearMps<=RAGDOLL_SETTLING.residualMaxLinearMps;
 state.residualQuietS=residualQuiet?(state.residualQuietS||0)+dt:0;
 if(!state.residualDampingRaised&&state.residualQuietS>=RAGDOLL_SETTLING.residualQuietS){for(const p of parts){p.body.setLinearDamping(Math.max(p.body.linearDamping(),RAGDOLL_SETTLING.residualDampingLinear));p.body.setAngularDamping(Math.max(p.body.angularDamping(),/Hand|Foot|^(head|neck)$/.test(p.bone)?RAGDOLL_SETTLING.residualDampingExtremities:RAGDOLL_SETTLING.residualDampingAngular));}state.residualDampingRaised=true;
 }
 const quiet=state.maxAngularRadps<=RAGDOLL_SETTLING.sleepMaxAngularRadps&&state.maxLinearMps<=RAGDOLL_SETTLING.sleepMaxLinearMps;state.quietS=quiet?state.quietS+dt:0;state.phase=quiet?'quiet':'damping';
 if(state.quietS>=RAGDOLL_SETTLING.quietS){state.beforeSleep={maxAngularRadps:state.maxAngularRadps,maxLinearMps:state.maxLinearMps,maxJointExcessRad:state.maxJointExcessRad,quietS:state.quietS,supportBodies:state.supportBodies};for(const p of parts)p.body.sleep();state.sleepTransitions++;state.wasSleeping=parts.every(p=>p.body.isSleeping());state.sleepingBodies=parts.filter(p=>p.body.isSleeping()).length;state.phase=state.wasSleeping?'sleeping':'quiet';}
 return state;
}
