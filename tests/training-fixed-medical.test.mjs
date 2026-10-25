import {test} from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {createPhysics} from '../apps/training/src/physics.js';import {traceShot} from '../apps/training/src/ballistics.js';
import {shotBallistics} from '../apps/training/src/catalog.js';import {TrainingMedical} from '../apps/training/src/medical.js';
import {withDebugSoldier} from '../apps/training/src/debug/soldier.js';
test('fixed A diagonal ray crosses arm then torso with ordered canonical medical events and conserved deposited energy',async()=>{
 const p=await createPhysics();try{
  const origin=new Vector3(19,1.43,-4),direction=new Vector3(17,1.05,-4).sub(origin).normalize(),ballistics=shotBallistics('556_m995_ap');
  const trace=traceShot(p,origin,direction,ballistics,{random:()=>.001,maxDistance:6});
  assert.equal(p.humanRigs.get('H01').pose,'rest');const parts=trace.bodyHits.flatMap(h=>h.parts);
  assert.deepEqual(parts.map(p=>p.bodyPart),['leftArm','abdomen']);
  for(const body of trace.bodyHits)assert.ok(Math.abs(body.parts.reduce((n,p)=>n+p.energyShareJ,0)-body.energyDepositedJ)<1e-7);
  const m=new TrainingMedical(),r=m.record({shotId:1,time:1,origin,direction,ballistics,ammoId:ballistics.ammoId,trace},p).filter(e=>e.skinContact);
  assert.deepEqual(r.map(e=>e.partKey),['leftArm','abdomen']);assert.deepEqual(r.map(e=>e.order),[1,2]);assert.ok(r.every(e=>e.shotId===1));
  assert.equal(m.actor.medical.wounds.length,2);assert.deepEqual(m.validate(),[]);assert.equal(p.humanRigs.get('H01').pose,'rest');
 }finally{p.dispose();}
});
test('preserved debug pose API always restores A even when inspection throws',async()=>{
 const p=await createPhysics();try{
  const initial=p.humanRigs.get('H01').snapshot();
  for(const pose of ['standing','aim','crouch','walk'])await withDebugSoldier(p,null,null,async({sync})=>{p.setHumanPose(pose,.3);sync();assert.equal(p.humanRigs.get('H01').pose,pose);});
  assert.deepEqual(p.humanRigs.get('H01').snapshot(),initial);
  await assert.rejects(withDebugSoldier(p,null,null,async()=>{p.setHumanPose('crouch');throw Error('inspection failed');}));
  assert.deepEqual(p.humanRigs.get('H01').snapshot(),initial);
 }finally{p.dispose();}
});
