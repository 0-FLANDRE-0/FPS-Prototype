import{Vector3,Quaternion}from'three';import{SOLDIER_FINGERS}from'./generated/soldier-fingers.js';import{SOLDIER_AK_GRIP}from'./generated/soldier-ak-grip.js';
const V=a=>new Vector3(...a),Q=a=>new Quaternion(...a).normalize(),MAX=Math.PI/12;
export const SOLDIER_RELAX_DEG=Object.freeze([18,25,15]);
export function relaxedFingerQuaternion(rig,name){const d=SOLDIER_FINGERS.bones.find(b=>b.name===name),parent=SOLDIER_FINGERS.bones.find(b=>b.name===d.parent),q=(parent?Q(parent.worldRestQ).invert():new Quaternion()).multiply(Q(d.worldRestQ));return q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),SOLDIER_RELAX_DEG[d.phalanx-1]*Math.PI/180*(d.side==='left'?-1:1)));}
export function relaxSoldierHands(rig){for(const d of SOLDIER_FINGERS.bones){const b=rig.byName.get(d.name);if(b)b.quaternion.copy(relaxedFingerQuaternion(rig,d.name));}rig.root.updateMatrixWorld(true);}
function sample(f,age){if(age<0||age>=.3)return{rotations:f.idle.map(Q),tip:V(f.idleTip)};const a=f.shoot.findLast(r=>r.age<=age)||f.shoot[0],b=f.shoot.find(r=>r.age>age)||a,t=a===b?0:(age-a.age)/(b.age-a.age);return{rotations:a.rotations.map((q,i)=>Q(q).slerp(Q(b.rotations[i]),t)),tip:V(a.tip).lerp(V(b.tip),t)};}
function solveSoldierAKGrip(rig,side,shotAge=100){const data=SOLDIER_AK_GRIP.hands[side],hand=rig.byName.get(side==='L'?'leftHand':'rightHand');if(!hand)return[];const handQ=hand.getWorldQuaternion(new Quaternion()),results=[];
 for(const f of data.fingers){const s=sample(f,shotAge),bones=f.bones.map(name=>rig.byName.get(name));
  for(let i=0;i<3;i++){const bone=bones[i],desired=handQ.clone().multiply(s.rotations[i]);bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(desired));bone.updateMatrixWorld(true);}
  const base=bones.map(b=>b.quaternion.clone().normalize()),tip=()=>V(f.tipRest).applyMatrix4(rig.delta(f.bones[2])),goal=s.tip.applyMatrix4(hand.matrixWorld);
  // Fingertip position only. Total adjustment of each local joint is bounded
  // against the extracted pose, never 15 degrees per iteration.
  for(let n=0;n<6;n++)for(let i=2;i>=0;i--){const b=bones[i],at=b.getWorldPosition(new Vector3()),from=tip().sub(at),to=goal.clone().sub(at);if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)continue;const delta=new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),desired=delta.multiply(b.getWorldQuaternion(new Quaternion())),local=b.parent.getWorldQuaternion(new Quaternion()).invert().multiply(desired).normalize(),angle=local.clone().multiply(base[i].clone().invert()).angleTo(new Quaternion());let difference=local.clone().multiply(base[i].clone().invert()).normalize();if(angle>MAX)difference=new Quaternion().slerp(difference,MAX/angle);b.quaternion.copy(difference.multiply(base[i]).normalize());b.updateMatrixWorld(true);}
  results.push({digit:f.digit,source:f.sourceBones,correctionDeg:bones.map((b,i)=>b.quaternion.angleTo(base[i])*180/Math.PI),tipErrorM:tip().distanceTo(goal),shotAge:shotAge<.3?shotAge:null});
 }
 rig.root.updateMatrixWorld(true);rig.skeleton.update();return results;
}
export{SOLDIER_AK_GRIP};

const gripCache=new WeakMap();
export function prepareSoldierAKGrips(rig){
 if(gripCache.has(rig)||!rig.byName.has('leftIndex1'))return;
 const saved=rig.bones.map(b=>b.quaternion.clone()),table={};
 for(const side of ['R','L']){table[side]=[];for(const age of [100,...SOLDIER_AK_GRIP.hands[side].fingers[0].shoot.map(s=>s.age)]){
  const metrics=solveSoldierAKGrip(rig,side,age),rotations=SOLDIER_AK_GRIP.hands[side].fingers.flatMap(f=>f.bones.map(name=>({name,q:rig.byName.get(name).quaternion.clone()})));table[side].push({age,metrics,rotations});
 }}
 rig.bones.forEach((b,i)=>b.quaternion.copy(saved[i]));rig.root.updateMatrixWorld(true);rig.skeleton.update();gripCache.set(rig,table);
}
export function applySoldierAKGrip(rig,side,age=100){
 prepareSoldierAKGrips(rig);const rows=gripCache.get(rig)?.[side];if(!rows)return[];
 const a=age<0||age>=.3?rows[0]:rows.findLast(r=>r.age<=age)||rows[1],b=age<0||age>=.3?a:rows.find(r=>r.age>age&&r.age<100)||a,t=a===b?0:(age-a.age)/(b.age-a.age);
 for(let i=0;i<a.rotations.length;i++){const r=a.rotations[i];rig.byName.get(r.name).quaternion.copy(r.q).slerp(b.rotations[i].q,t);}
 return a.metrics;
}
