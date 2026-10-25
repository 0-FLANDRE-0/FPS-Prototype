
// RG1 game/solver tuning. No clinical state or terminal ballistics is changed.
// Four permits the complete AI1 squad to fall naturally together; a fifth
// (including P01) retires the oldest active body, never allocates another one.
export const RG1=Object.freeze({maxActive:4,highSolverS:1.5,lateSolverIterations:0,
 quietLinearMps:.15,quietAngularRadps:.5,quietS:1,minimumActiveS:1.5,
 maxLinearMps:12,maxAngularRadps:25,floorBelowMarginM:.15,floorClearanceM:.02,
 restQuietAngularRadps:1.5,restQuietLinearMps:.2,restDampingAfterS:2,restDampingQuietS:.25,restDampingLinear:64,restDampingAngular:256,restDampingDistal:512,
 playerMembership:128,ragdollMemberships:2|4|8|16});
const ZERO={x:0,y:0,z:0};
export const PLAYER_COLLISION_GROUPS=(RG1.playerMembership<<16)|(0xffff^RG1.ragdollMemberships);

export function prepareLifecycle(r){
 r.lifecycle={elapsedS:0,quietS:0,wakeAgeS:1e9,freezes:0,wakes:0,velocityClamps:0,floorRecoveries:0,solverReduced:false,reason:null};
 r.physics.ragdolls??=new Set();r.physics.ragdolls.add(r);
 // Production floors are finite, axis-aligned boxes. Check their actual bounds,
 // including their bottom: going outside a floor is never mistaken for tunneling.
 r.floorBoxes=[...r.physics.surface].filter(([,s])=>['floor','ground'].includes(s.kind)&&s.definition?.size&&s.definition?.at).map(([,s])=>s.definition);
}
export function activateLifecycle(r){
 const active=[...r.physics.ragdolls].filter(a=>a!==r&&a.active&&!a.frozen);
 // Preserve the first-person head-camera fall if P01 is the oldest. The
 // oldest NPC is retired first; the strict global dynamic limit remains4.
 while(active.length>=RG1.maxActive){const index=Math.max(0,active.findIndex(a=>a.actor.id!=='P01'));active.splice(index,1)[0].freeze('active-budget');}
 r.physics.ragdollSerial=(r.physics.ragdollSerial||0)+1;r.activationOrder=r.physics.ragdollSerial;
 // Reinsert on activation/wake so the oldest active, rather than prepared, wins.
 r.physics.ragdolls.delete(r);r.physics.ragdolls.add(r);
}
export function freezeRagdoll(r,reason='quiet'){
 if(!r.active||r.frozen)return false;
 for(const j of r.joints)for(const l of j.limits)j.setPD(l.axis,l.referenceRad);
 for(const p of r.parts.values()){
  p.body.setAdditionalSolverIterations(0);p.body.resetForces(false);p.body.resetTorques(false);
  p.body.setLinvel(ZERO,false);p.body.setAngvel(ZERO,false);p.body.sleep();p.body.setEnabled(false);
 }
 r.frozen=true;r.finalSyncPending=true;r.lifecycle.freezes++;r.lifecycle.reason=reason;r.lifecycle.frozenAtS=r.lifecycle.elapsedS;
 return true;
}
export function wakeFrozenRagdoll(r){
 r.lifecycle.quietS=0;r.lifecycle.wakeAgeS=0;r.lifecycle.restQuietS=0;r.lifecycle.restDampingRaised=false;if(!r.frozen)return false;activateLifecycle(r);
 for(const p of r.parts.values()){p.body.setEnabled(true);p.body.setAdditionalSolverIterations(RG1.lateSolverIterations);p.body.wakeUp();}
 r.frozen=false;r.lifecycle.wakes++;r.lifecycle.quietS=0;r.lifecycle.reason='shot';r.lifecycle.wakeAgeS=0;
 return true;
}
function limit(body,get,set,max,state){const v=body[get](),speed=Math.hypot(v.x,v.y,v.z);if(speed>max){body[set]({x:v.x*max/speed,y:v.y*max/speed,z:v.z*max/speed},false);state.velocityClamps++;}}
function bottom(p){const at=p.collider.translation(),q=p.collider.rotation();return at.y-Math.abs(1-2*(q.x*q.x+q.z*q.z))*p.collider.shape.halfHeight-p.collider.shape.radius;}
export function updateLifecycle(r,dt){
 if(r.frozen)return;
 const s=r.lifecycle;s.elapsedS+=dt;s.wakeAgeS=(s.wakeAgeS??Infinity)+dt;
 if(!s.solverReduced&&s.elapsedS>=RG1.highSolverS){for(const p of r.parts.values())p.body.setAdditionalSolverIterations(RG1.lateSolverIterations);s.solverReduced=true;}
 let maxLinear=0,maxAngular=0,lift=0;
 for(const p of r.parts.values()){
  limit(p.body,'linvel','setLinvel',RG1.maxLinearMps,s);limit(p.body,'angvel','setAngvel',RG1.maxAngularRadps,s);
  const at=p.collider.translation(),low=bottom(p);
  for(const floor of r.floorBoxes){const [x,y,z]=floor.at,[sx,sy,sz]=floor.size;if(Math.abs(at.x-x)>sx/2||Math.abs(at.z-z)>sz/2)continue;
   if(low<y-sy/2-RG1.floorBelowMarginM)lift=Math.max(lift,y+sy/2+RG1.floorClearanceM-low);
  }
  const v=p.body.linvel(),w=p.body.angvel();maxLinear=Math.max(maxLinear,Math.hypot(v.x,v.y,v.z));maxAngular=Math.max(maxAngular,Math.hypot(w.x,w.y,w.z));
 }
 if(lift){
  // Translate the whole articulated assembly by the same amount. Lifting only
  // one bone would stretch its joints and restart the original solver fight.
  for(const p of r.parts.values()){const at=p.body.translation();p.body.setTranslation({x:at.x,y:at.y+lift,z:at.z},true);p.body.setLinvel(ZERO,false);p.body.setAngvel(ZERO,false);}
  r.physics.world.propagateModifiedBodyPositionsToColliders();s.floorRecoveries++;s.lastRecoveryLiftM=lift;s.quietS=0;return;
 }
 s.maxLinearMps=maxLinear;s.maxAngularRadps=maxAngular;
 const passive=r.mode==='passive'&&!r.joints.some(j=>j.controls.some(c=>c.strength>0));
 if(!r.settling?.dampingRaised)s.restDampingRaised=false;
 const rest=passive&&r.settling?.dampingRaised&&r.settling?.lyingPose?.lying&&maxLinear<.2&&maxAngular<1.5;
 s.restQuietS=rest?(s.restQuietS||0)+dt:0;
 if(!s.restDampingRaised&&s.elapsedS>=RG1.restDampingAfterS&&s.restQuietS>=RG1.restDampingQuietS){for(const p of r.parts.values()){p.body.setLinearDamping(Math.max(p.body.linearDamping(),RG1.restDampingLinear));p.body.setAngularDamping(Math.max(p.body.angularDamping(),/Hand|Foot|^(head|neck)$/.test(p.bone)?RG1.restDampingDistal:RG1.restDampingAngular));}s.restDampingRaised=true;}
 // Default-solver joint corrections can retain high-frequency distal jitter
 // despite an actually supported, lying trunk. Use the explicit resting gate
 // only after the contact/lying viscosity phase; never on an airborne fall.
 s.quietLinearThresholdMps=s.restDampingRaised?RG1.restQuietLinearMps:RG1.quietLinearMps;s.quietAngularThresholdRadps=s.restDampingRaised?RG1.restQuietAngularRadps:RG1.quietAngularRadps;
 s.quietS=passive&&s.elapsedS>=RG1.minimumActiveS&&s.wakeAgeS>=.5&&maxLinear<s.quietLinearThresholdMps&&maxAngular<s.quietAngularThresholdRadps?s.quietS+dt:0;
 if(s.quietS>=RG1.quietS)r.freeze('quiet');
}
