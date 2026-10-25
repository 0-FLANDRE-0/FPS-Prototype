import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {s0Context} from '../scripts/training-s0-fixtures.mjs';
import {Inventory} from '../apps/training/src/inventory.js';
import {SelfCare} from '../apps/training/src/medical-care.js';
import {syncMedicalUses} from '../apps/training/src/medical-care-modes.js';
import {BANDAGE,bandageRequiredWork,bandageProgress,commitBandage} from '../apps/training/src/medical-bandage.js';
import {startPartRecovery,stepPartRecovery} from '../apps/training/src/medical-part-recovery.js';
import {TrainingMedical} from '../apps/training/src/medical.js';
import {registerBleedingWoundB1,updateBleedingB1} from '../apps/training/src/medical-b1.js';
import {registerLimbOpening,limbRoutingState} from '../apps/training/src/medical-routing.js';
let c,f;
before(async()=>{c=await s0Context();f=JSON.parse(await readFile(new URL('./fixtures/imported/checks-s0-v38/fixtures.json',import.meta.url))).find(r=>r.name==='arm-muscle'&&r.pose==='standing');});
after(()=>c.dispose());
function shot(id=100){return c.fire({target:new Vector3(...f.target),direction:new Vector3(...f.direction),ammoId:'545_ps_gs',shotId:id,isolateAnatomy:true});}
function fresh(mode='realistic'){
  c.reset();shot();const bridge=c.enemy.medical,m=bridge.actor.medical,inventory=new Inventory({includeMedical:true,treatmentMode:mode});inventory.setMedicalContainerOpen('ifak-01');
  const care=new SelfCare({inventory,getMedical:()=>bridge,getFeedback:()=>({amplitudes:{tremor:1}})}),w=m.wounds.find(w=>w.partKey==='leftArm'),item=inventory.items.get('medical:bandage');
  return {bridge,m,inventory,care,w,item,tick(dt=1/60){care.step(dt);bridge.tick(dt,bridge.time+dt);},finish(){for(let i=0;i<241&&care.active;i++)this.tick();assert.equal(care.list.at(-1).status,'completed');}};
}
test('treatment 1 fixed four seconds in all old modes, under severe pain, near-zero arm function and one usable hand',()=>{
  for(const mode of ['game','realistic','reality'])for(const injured of [false,true]){
    const x=fresh(mode);if(injured){x.m.bodyParts.rightArm.s2Comminuted=true;x.m.bodyParts.leftArm.functionRatio=.001;x.m.pain=x.m.stressResponse.perceivedPain=99;x.m.consciousness=31;x.m.hemodynamics.tissuePerfusion=.1;}
    assert.equal(x.care.preview(x.item.instanceId,{woundId:x.w.id}).timing.estimatedSeconds,4);
    assert.ok(x.care.request(x.item.instanceId,{woundId:x.w.id}));x.care.step(4-1e-5);assert.equal(x.care.active.status,'active');assert.equal(x.item.remaining,100);assert.equal(x.w.bandageRepair,undefined);
    x.care.step(1e-5);assert.equal(x.care.list[0].status,'completed');assert.equal(x.care.list[0].workS,4);
  }
});
test('real trace: no early HP/control/resource effect; completion consumes only needed durability; healing starts after completion',()=>{
  const x=fresh(),hp=x.m.bodyParts.leftArm.hp,blood=x.m.bloodMl,need=bandageRequiredWork(x.m,x.w);
  assert.ok(x.care.request(x.item.instanceId,{woundId:x.w.id}));for(let i=0;i<239;i++)x.tick();assert.equal(x.m.bodyParts.leftArm.hp,hp);assert.equal(x.item.remaining,100);assert.equal(x.w.bandageRepair,undefined);
  x.tick();assert.ok(Math.abs(x.item.remaining-(100-need))<1e-9);assert.equal(bandageProgress(x.w),1);assert.equal(x.m.bodyParts.leftArm.hp,hp);assert.equal(x.m.externalBleedRate,0);
  x.tick();assert.ok(x.m.bodyParts.leftArm.hp>hp);assert.ok(x.m.bloodMl<=blood);assert.equal(x.m.bodyParts.leftArm.maxHp,75);assert.deepEqual(x.bridge.validate(),[]);
});
test('short durability completes partial hemostasis, survives mode sync and can be continued by a second instance',()=>{
  const x=fresh(),need=bandageRequiredWork(x.m,x.w);x.item.remaining=need/4;assert.ok(x.care.request(x.item.instanceId,{woundId:x.w.id}));x.finish();assert.equal(bandageProgress(x.w),.25);assert.equal(x.inventory.items.has(x.item.instanceId),false);
  for(const mode of ['game','reality','realistic'])syncMedicalUses(x.inventory,mode);assert.equal(x.inventory.items.has(x.item.instanceId),false);assert.equal(bandageProgress(x.w),.25);
  const second={...x.item,instanceId:'bandage-second',owner:'bag',cell:{x:0,y:4},remaining:100};x.inventory.items.set(second.instanceId,second);assert.ok(x.care.request(second.instanceId,{woundId:x.w.id}));x.finish();assert.equal(bandageProgress(x.w),1);assert.ok(Math.abs(second.remaining-(100-need*.75))<1e-8);assert.equal(x.care.request(second.instanceId,{woundId:x.w.id}),false);
});
test('cancel, repeated clicks and reusing a cancelled record are atomic; cancelled elapsed work is discarded',()=>{
  const x=fresh();assert.ok(x.care.request(x.item.instanceId,{woundId:x.w.id}));assert.equal(x.care.request(x.item.instanceId,{woundId:x.w.id}),false);x.care.step(3);const t=x.care.active;
  assert.equal(x.inventory.move(x.item.instanceId,'bag',0,4),false);assert.equal(x.inventory.move('ifak-01','bag',0,4),false);
  assert.ok(x.care.interrupt('test cancel'));assert.equal(x.item.remaining,100);assert.equal(x.w.bandageRepair,undefined);assert.equal(x.m.partRecovery,undefined);
  assert.ok(x.care.resume(t.id));assert.equal(t.workS,0);assert.equal(t.remainingSeconds,4);x.care.step(3);assert.equal(x.item.remaining,100);x.care.step(1);assert.ok(x.item.remaining<100);const balance=x.item.remaining;x.care.step(999);assert.equal(x.item.remaining,balance);
});
test('lost target or moved/deleted item cannot be silently replaced or consumed',()=>{
  for(const failure of ['wound','item','owner','reservation']){
    const x=fresh();x.care.request(x.item.instanceId,{woundId:x.w.id});x.care.step(3);
    if(failure==='wound')x.m.wounds.splice(x.m.wounds.indexOf(x.w),1);else if(failure==='item')x.inventory.items.delete(x.item.instanceId);else if(failure==='owner')x.item.owner='container:ammo-crate';else x.inventory.medicalReservations.clear();
    x.care.step(1);assert.equal(x.care.list[0].status,'interrupted');assert.equal(x.item.remaining,100);assert.equal(x.w.bandageRepair,undefined);
  }
});
test('reset and medical model replacement release reservations; an unavailable patient cannot use supplies',()=>{
  const x=fresh();x.care.request(x.item.instanceId,{woundId:x.w.id});x.bridge.reset();void x.care.m;
  assert.equal(x.inventory.medicalReservations.size,0);assert.ok(x.inventory.move(x.item.instanceId,'bag',0,4));
  x.inventory.reset();assert.equal(x.inventory.medicalReservations.size,0);assert.equal(x.inventory.items.get('medical:bandage').remaining,100);
  x.inventory.setMedicalContainerOpen('ifak-01');x.m.isUnconscious=true;
  // The current bridge owns the replacement medical state, never the stale actor.
  x.bridge.actor.medical.isUnconscious=true;assert.equal(x.care.request('medical:bandage',{woundId:'missing'}),false);
});
test('workload depends on original injury, never current MAP or instantaneous flow',()=>{
  const x=fresh(),work=bandageRequiredWork(x.m,x.w);x.m.hemodynamics.map=15;for(const s of x.m.bleedSources)s.flowMlPerS=.00001;assert.equal(bandageRequiredWork(x.m,x.w),work);
});
test('new severe wounds never become cheaper just because part HP was already exhausted',()=>{const x=fresh();x.w.bodyHpDamage={damage:100,appliedDamage:1};const work=bandageRequiredWork(x.m,x.w);x.w.bodyHpDamage.appliedDamage=0;x.m.bodyParts.leftArm.hp=0;assert.equal(bandageRequiredWork(x.m,x.w),work);assert.ok(work>=68);});
test('recovery slows near maximum, reaches the exact current maximum, preserves other injuries and adds no blood',()=>{
  const med=new TrainingMedical(),m=med.actor.medical,p=m.bodyParts.leftArm;p.maxHp=60;p.hp=20;p.fracture=true;p.fractureType='hairline';const blood=m.bloodMl;
  startPartRecovery(m,'leftArm',4);stepPartRecovery(med.actor,1,4);assert.equal(p.hp,20);stepPartRecovery(med.actor,1,5);const early=p.hp-20;
  p.hp=59;m.partRecovery.leftArm.lastHp=59;stepPartRecovery(med.actor,1,6);assert.ok(p.hp-59<early);
  for(let i=7;i<50&&m.partRecovery.leftArm.active;i++)stepPartRecovery(med.actor,1,i);
  assert.equal(p.hp,60);assert.equal(p.maxHp,60);assert.equal(p.fracture,true);assert.equal(p.fractureType,'hairline');assert.equal(m.bloodMl,blood);
});
test('real healing persists through medical recomputation; new shot pauses healing and leaves a new untreated wound',()=>{
  const x=fresh();x.care.request(x.item.instanceId,{woundId:x.w.id});x.finish();let previous=x.m.bodyParts.leftArm.hp;
  for(let i=0;i<10000&&x.m.partRecovery.leftArm.active;i++){x.tick();assert.ok(x.m.bodyParts.leftArm.hp>=previous);previous=x.m.bodyParts.leftArm.hp;}
  assert.equal(x.m.bodyParts.leftArm.hp,75);assert.equal(x.m.bodyParts.leftArm.functionRatio,Math.min(1,x.m.bodyParts.leftArm.destructionFunctionalCap??1));assert.equal(x.m.partRecovery.leftArm.active,false);
  shot(101);assert.equal(x.m.wounds.at(-1).bandageRepair,undefined);assert.equal(bandageProgress(x.w),1);
  x.care.request(x.item.instanceId,{woundId:x.m.wounds.at(-1).id});x.finish();shot(102);const hp=x.m.bodyParts.leftArm.hp;x.tick();assert.equal(x.m.bodyParts.leftArm.hp,hp);assert.equal(x.m.partRecovery.leftArm.reason,'새 피격');
});
test('same part healing is not stacked; unconsciousness/death/arrest and destroyed structures never get revived',()=>{
  const med=new TrainingMedical(),m=med.actor.medical,p=m.bodyParts.leftArm;p.hp=30;startPartRecovery(m,'leftArm',0);stepPartRecovery(med.actor,1,1);const gain=p.hp-30;p.hp=30;startPartRecovery(m,'leftArm',1);startPartRecovery(m,'leftArm',1);stepPartRecovery(med.actor,1,2);assert.equal(p.hp-30,gain);
  for(const flag of ['isDead','isUnconscious','cardiacArrest']){m[flag]=true;const hp=p.hp;stepPartRecovery(med.actor,1,3);assert.equal(p.hp,hp);m[flag]=false;}
  p.hp=0;stepPartRecovery(med.actor,1,4);assert.equal(p.hp,0);assert.equal(m.partRecovery.leftArm.active,false);
});
test('shared vessel: only selected lesion changes, final wound contributions sum once, internal flow and blood volume are conserved',()=>{
  const med=new TrainingMedical(),m=med.actor.medical;
  for(const id of ['a','b']){const w={id,partKey:'leftLeg',s1OrganDamage:[{id:'left-femoral',kind:'vessel',vesselKind:'artery',domain:'leftLeg',bone:'leftUpperLeg',diameterM:.008,permanentVolumeM3:1e-8,direct:true,severity:.2,centerlineDistanceM:0,bulletRadiusM:.001}],bodyTrajectory:{entryAddress:{bone:'leftUpperLeg',localPoint:[.09,.8,0],localIncomingDirection:[0,0,-1]},woundChannel:{steps:[]}},bleedingProfile:{bleedingType:'none'}};m.wounds.push(w);registerBleedingWoundB1(m,w);registerLimbOpening(m,w,{entry:{},exit:{}});}
  updateBleedingB1(med.actor,0);const source=m.bleedSources[0],raw=source.rawFlowMlPerS,work=bandageRequiredWork(m,m.wounds[0]);commitBandage(m,m.wounds[0],{remaining:work/2},0);const blood=m.bloodMl;updateBleedingB1(med.actor,.1);
  assert.equal(source.lesions.length,2);assert.equal(m.bleedSources.length,1);assert.equal(source.rawFlowMlPerS,raw);assert.ok(m.wounds[0]._effInternal<m.wounds[1]._effInternal);
  assert.ok(Math.abs(m.wounds.reduce((n,w)=>n+w._effInternal,0)-source.flowMlPerS)<1e-10);
  const route=limbRoutingState(m).sources[0];assert.ok(route.segments[0].externalFlowMlPerS<route.segments[1].externalFlowMlPerS);assert.ok(Math.abs(route.internalFlowMlPerS-raw*.15)<1e-9);
  const loss=blood-m.bloodMl,pools=Object.values(m.bloodPoolsMl).reduce((a,b)=>a+b,0);assert.ok(Math.abs(loss-pools)<1e-8);assert.ok(Math.abs(loss-source.cumulativeMl)<1e-8);
});
