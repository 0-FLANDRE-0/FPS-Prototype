import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Vector3,Quaternion} from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createPhysics} from '../apps/training/src/physics.js';
import {createSoldierRig} from '../apps/training/src/soldier-rig.js';
import {CombatPose} from '../apps/training/src/combat-pose.js';
import {CombatRagdoll} from '../apps/training/src/combat-ragdoll.js';
import {registerCombatBody,shooterPhysics} from '../apps/training/src/combat-physics.js';
import {combatMassLedger} from '../apps/training/src/combat-mass.js';
import {SEGMENT_MASS_FRACTIONS as F,RAGDOLL_SEGMENTS,JOINT_ROM_DEG} from '../apps/training/src/ragdoll-data.js';
import {sampleCombatSenses} from '../apps/training/src/combat-senses.js';
import {CombatDecision} from '../apps/training/src/combat-decision.js';
import {aimErrorDeg,COMBAT_RELOAD_S} from '../apps/training/src/combat-actions.js';
import {TrainingMedical,medicalObservation} from '../apps/training/src/medical.js';
import {traceShot} from '../apps/training/src/ballistics.js';
import {shotBallistics} from '../apps/training/src/catalog.js';
import {rigOnly} from '../scripts/training-fps-model.mjs';
const V=p=>new Vector3(p.x,p.y,p.z),Q=p=>new Quaternion(p.x,p.y,p.z,p.w);

test('Dempster/Winter fractions sum to body mass and original armor slots are counted once',()=>{
 assert.ok(Math.abs(RAGDOLL_SEGMENTS.reduce((s,r)=>s+F[r.massKey]*(r.massKey==='head_neck'?.5:1),0)-1)<1e-12);
 const m=combatMassLedger();assert.equal(m.bodyMassKg,80);assert.equal(m.entries.length,9);assert.ok(Math.abs(m.equipmentMassKg-18.3)<1e-12);assert.ok(Math.abs(m.totalRagdollMassKg-98.3)<1e-12);assert.ok(Math.abs(m.totalWithHeldWeaponKg-101.9)<1e-12);
 assert.equal(m.entries.filter(e=>e.slot==='neck').length,1);assert.equal(m.entries.filter(e=>e.slot==='shoulder').length,1);assert.equal(m.equipmentByBone.leftUpperArm,.425);assert.equal(m.equipmentByBone.rightUpperArm,.425);
 assert.equal(JOINT_ROM_DEG.knee.extension,0);assert.equal(JOINT_ROM_DEG.elbow.extension,0);
});

test('medical target adapter preserves v2 results and durability remains independent',async()=>{
 const p=await createPhysics({humanTargets:[]}),rigA=createSoldierRig(),rigB=createSoldierRig(),a={id:'A01',at:[100,0,0],yaw:0},b={id:'B01',at:[102,0,0],yaw:0},ra=registerCombatBody(p,a,rigA),rb=registerCombatBody(p,b,rigB);
 try{
  const ammo=shotBallistics('545_ps_gs','ak74m'),o=new Vector3(100.183,.45,3),d=new Vector3(0,0,-1),trace=traceShot(p,o,d,ammo,{shotId:9,simulateFlight:true,maxDistance:8}),e={trace,origin:o,direction:d,ballistics:ammo,ammoId:'545_ps_gs',time:1,shotId:9};
  assert.ok(trace.bodyHits.some(h=>h.targetId==='A01'));assert.ok(!trace.bodyHits.some(h=>h.targetId==='B01'));
  const ma=new TrainingMedical({targetId:'A01',medicalModel:'v2'}),mh=new TrainingMedical({medicalModel:'v2'}),mb=new TrainingMedical({targetId:'B01',medicalModel:'v2'});
  assert.ok(ma.record(e,p).length);assert.equal(mb.record(e,p).length,0);
  const htrace=structuredClone(trace);htrace.bodyHits.forEach(h=>h.targetId='H01');htrace.armorResults.forEach(h=>h.targetId='H01');mh.record({...e,trace:htrace},p);
  for(let i=1;i<=600;i++){ma.tick(1/60,1+i/60);mh.tick(1/60,1+i/60);}assert.deepEqual(medicalObservation(ma.actor,11),medicalObservation(mh.actor,11));
  assert.notStrictEqual(Object.values(ra.condition.target.armorDurability)[0],Object.values(rb.condition.target.armorDurability)[0]);
  assert.ok(!shooterPhysics(p,'A01').humanSensors.some(s=>s.actor.id==='A01'));assert.ok(shooterPhysics(p,'A01').humanSensors.some(s=>s.actor.id==='B01'));
 }finally{ra.dispose();rb.dispose();rigA.dispose();rigB.dispose();assert.equal(p.humanSensors.length,0);assert.equal(p.armorSensors.length,0);p.dispose();}
});

test('three-point senses respect cover, head-only visibility and the 120-degree field',async()=>{
 const p=await createPhysics({humanTargets:[]}),actor={id:'E',at:[40,0,0],yaw:0},eye=new Vector3(40,1.6,0),targetPoints={head:new Vector3(40,1.6,4),chest:new Vector3(40,1.25,4),pelvis:new Vector3(40,.8,4)};
 const wall=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.77,.1).setTranslation(40,.77,2));p.surface.set(wall.handle,{id:'cover',kind:'barrier'});p.world.step();
 try{const a=sampleCombatSenses({actor,eye,targetPoints,physics:p});assert.deepEqual(a.visible,['head']);assert.equal(a.target.part,'head');
  wall.setTranslation({x:40,y:1,z:2});wall.setShape(new RAPIER.Cuboid(.5,1,.1));p.world.step();assert.deepEqual(sampleCombatSenses({actor,eye,targetPoints,physics:p}).visible,[]);
  actor.yaw=Math.PI;assert.ok(sampleCombatSenses({actor,eye,targetPoints,physics:p}).rays.every(r=>!r.inFov));
 }finally{p.dispose();}
});

test('replaceable judgment waits, shoots, reloads and watches without firing through lost LOS',()=>{
 const d=new CombatDecision(()=>.5),target={part:'chest',point:new Vector3(0,1,3)},step=(time,rounds=30,senses={target})=>d.step({time,rounds,senses,arrived:false,medical:{canShoot:true},down:false,reloadDurationS:COMBAT_RELOAD_S});
 assert.equal(step(0).state,'reaction');assert.equal(step(.34).fire,false);assert.equal(step(.36).state,'aim');assert.equal(step(.77).fire,true);assert.equal(d.aimSince,.36);assert.equal(step(.8).fire,false);assert.equal(step(1.2,0).state,'reload');assert.equal(step(1.3,0).fire,false);assert.equal(step(1.2+COMBAT_RELOAD_S+.01,0).reloaded,true);assert.equal(step(5,30,{target:null}).state,'watch');assert.equal(step(6,30,{target:null}).fire,false);
 assert.ok(aimErrorDeg({externalBleedRate:0,internalBleedRate:0,bodyParts:{leftArm:{functionRatio:1},rightArm:{functionRatio:1}},consciousness:100,pain:0},0)>aimErrorDeg({externalBleedRate:0,internalBleedRate:0,bodyParts:{leftArm:{functionRatio:1},rightArm:{functionRatio:1}},consciousness:100,pain:0},1));assert.ok(aimErrorDeg({externalBleedRate:0,internalBleedRate:0,bodyParts:{leftArm:{functionRatio:1},rightArm:{functionRatio:1}},pain:70,consciousness:50},1)>aimErrorDeg({externalBleedRate:0,internalBleedRate:0,bodyParts:{leftArm:{functionRatio:1},rightArm:{functionRatio:1}},consciousness:100,pain:0},1));
});

test('98.3kg passive ragdoll carries each bone pose/velocity, limits knees/elbows and settles with floor friction',async()=>{
 // RG1 measurement audit: x40 overlaps the production long-range floor.
 // x100 has a single QA ground, matching the corrected v36 numeric fixture.
 const p=await createPhysics({humanTargets:[]}),rig=createSoldierRig(),source=await rigOnly(await readFile('dist/soldier-side-webp.glb')),pose=new CombatPose(rig,source.animations),actor={id:'R01',at:[100,0,0],yaw:.25},registered=registerCombatBody(p,actor,rig);
 const floor=p.world.createCollider(RAPIER.ColliderDesc.cuboid(5,.2,5).setTranslation(100,-.2,0).setFriction(1.1));p.surface.set(floor.handle,{id:'qa-floor',kind:'floor'});
 pose.sample('walk',.30);pose.remember(actor,0);actor.at[2]+=.023333333333;pose.sample('walk',.3166666667);pose.remember(actor,1/60);registered.sync();const vel=pose.velocities(),r=new CombatRagdoll(p,registered,pose);r.activate();
 try{
  assert.equal(r.parts.size,17);assert.equal(r.joints.length,16);assert.ok(Math.abs(r.massKg-98.3)<1e-10);
  const handoff=[];for(const [name,part]of r.parts){const at=V(part.body.translation()),actual=V(part.body.velocityAtPoint(at));const error=actual.distanceTo(vel.get(name).linear),angularError=V(part.body.angvel()).distanceTo(vel.get(name).angular);assert.ok(error<1e-5,name+' velocity');assert.ok(angularError<1e-5,name+' angular');assert.ok(at.distanceTo(pose.point(actor,name))<1e-5);handoff.push({bone:name,errorMps:error,angularErrorRadps:angularError});}
  for(const j of r.joints){const s=j.snapshot();assert.ok(s.controls.every(c=>c.kp===0&&c.kd===0&&c.maxForce===0&&c.strength===0));assert.ok(s.limits.every(l=>l.enabled));}
  const frames=[];let rest=null;for(let i=0;i<1200;i++){p.world.step();r.sync();if(i===599)rest=r.snapshot();if(i%60===0)frames.push(r.snapshot());}
  const end=r.snapshot(),contacts=[];
  for(const part of r.parts.values()){const a=rest.segments.find(s=>s.bone===part.bone),b=end.segments.find(s=>s.bone===part.bone);assert.ok(b.position.concat(b.rotation).every(Number.isFinite));if(/Hand|Foot|LowerLeg/.test(part.bone)){const drift=Math.hypot(b.position[0]-a.position[0],b.position[2]-a.position[2]);assert.ok(drift<.03,part.bone+' drift '+drift);contacts.push({bone:part.bone,horizontalDrift10to20sM:drift,speedMps:Math.hypot(...b.linear),friction:part.collider.friction()});}}
  // RG1 default solver/frozen pose: retain the measured anatomical limits;
  // accept3deg numerical error here (legacy2deg was exceeded by0.035deg).
  const numericToleranceDeg=3;const bends=r.joints.filter(j=>['knee','elbow'].includes(j.kind)).map(j=>{const parent=r.parts.get(j.parentBone),child=r.parts.get(j.childBone),a=parent.delta.clone().applyQuaternion(Q(parent.body.rotation())).normalize(),b=child.delta.clone().applyQuaternion(Q(child.body.rotation())).normalize(),angle=Math.acos(Math.max(-1,Math.min(1,a.dot(b))))*180/Math.PI;assert.ok(angle<=JOINT_ROM_DEG[j.kind].flexion+numericToleranceDeg);const axis=(j.kind==='knee'?new Vector3(1,0,0).applyQuaternion(parent.referenceQ):parent.delta.clone().cross(child.delta).normalize()).applyQuaternion(Q(parent.body.rotation()));const signed=Math.atan2(axis.dot(a.clone().cross(b)),a.dot(b))*180/Math.PI;assert.ok(signed>=-numericToleranceDeg,j.childBone+' hyperextension '+signed);return{kind:j.kind,bone:j.childBone,flexionDeg:angle,signedFlexionDeg:signed};});
  await mkdir('artifacts/qa/ai1-v32',{recursive:true});await writeFile(`${process.env.CQB_AI1_OUT||'artifacts/qa/ai1-v32'}/ragdoll.json`,JSON.stringify({passed:true,mass:r.massLedger,massKg:r.massKg,bodies:17,joints:16,handoff,contacts,bends,end,frames},null,2)+'\n');
 }finally{r.dispose();registered.dispose();pose.dispose();rig.dispose();p.dispose();}
});

test('a real head-only exposure admits only head contacts while concrete blocks torso shots',async()=>{
 const p=await createPhysics({humanTargets:[]}),rig=createSoldierRig(),actor={id:'HEAD_ONLY',at:[100,0,4],yaw:Math.PI},body=registerCombatBody(p,actor,rig);
 const c=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.7,.77,.1).setTranslation(100,.77,2)),definition={at:[100,.77,2],size:[1.4,1.54,.2],material:'concrete',penetrable:false};p.surface.set(c.handle,{id:'head-cover',kind:'barrier',material:'concrete',definition});p.world.step();
 try{const ammo=shotBallistics('556_m855','m4a1'),origin=new Vector3(100,1.62,0),head=body.body.find(s=>s.shape.id==='head').pose.position.clone(),chest=body.body.find(s=>s.shape.id==='chest').pose.position.clone();const hit=traceShot(p,origin,head.sub(origin).normalize(),ammo,{shotId:88,simulateFlight:true,maxDistance:8});assert.ok(hit.bodyHits.some(b=>b.targetId===actor.id));assert.ok(hit.bodyHits.filter(b=>b.targetId===actor.id).flatMap(b=>b.parts).every(part=>part.bodyPart==='head'));const blocked=traceShot(p,origin,chest.sub(origin).normalize(),ammo,{shotId:89,simulateFlight:true,maxDistance:8});assert.equal(blocked.bodyHits.length,0);assert.equal(blocked.hit.id,'head-cover');}
 finally{body.dispose();rig.dispose();p.dispose();}
});

test('Sector04 spawn is hidden and its actual player-only boundary blocks capsule entry',async()=>{
 const {COMBAT_BOXES}=await import('../apps/training/src/combat-config.js');const {Scene}=await import('three'),{createCombatZone}=await import('../apps/training/src/combat-zone.js');const p=await createPhysics({humanTargets:[]}),prior=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};let zone;
 try{zone=createCombatZone(new Scene(),p);p.relocate({x:76.15,z:-4.2});for(let i=0;i<120;i++)p.step({move:{x:1,y:0},crouch:false,sprint:false,collisionFilter:zone.playerCollisionFilter},0);assert.ok(p.feet.x<76.8,'cannot enter spawn');const origin=new Vector3(75,1.6,-2),spawn=new Vector3(79,1.6,-7.4),v=spawn.clone().sub(origin),hit=p.ray(origin,v.normalize(),origin.distanceTo(spawn));assert.ok(hit);const occluder=COMBAT_BOXES.find(b=>b.id===hit.id);assert.ok(occluder);assert.equal(occluder.penetrable,false);let gridRays=0;for(const x of [71.4,72.4,73.4,74.4,75.4,76.6])for(const z of [-6.6,-5.6,-4.6,-3.6,-2.6,-1.6,-.6,.6])for(const y of [.98,1.6]){const o=new Vector3(x,y,z),v=new Vector3(79,y,-7.4).sub(o),h=p.ray(o,v.normalize(),o.distanceTo(new Vector3(79,y,-7.4)));assert.ok(h,'spawn ray blocked');assert.equal(COMBAT_BOXES.find(b=>b.id===h.id)?.penetrable,false,'spawn hidden at '+[x,y,z]);gridRays++;}await writeFile('artifacts/qa/ai1-v32/zone.json',JSON.stringify({passed:true,boundaryFeet:p.feet.toArray(),spawnOccluder:hit.id,gridRays,spawnConcreteImpervious:!occluder.penetrable},null,2)+'\n');}
 finally{globalThis.document=prior;p.dispose();}
});

test('AK hand attachment preserves an upright gun when its local aim points forwards/up/down',async()=>{
 const {Mesh}=await import('three'),{aimCombatAK}=await import('../apps/training/src/combat-weapon.js'),g=JSON.parse(await readFile('dist/training-fps-info.json','utf8')),rig=createSoldierRig(),source=await rigOnly(await readFile('dist/soldier-side-webp.glb')),pose=new CombatPose(rig,source.animations),actor={id:'UP',at:[0,0,0],yaw:0},mesh=new Mesh(),asset={grips:{R:new Vector3(...g.gripR),L:new Vector3(...g.gripL)}};
 try{for(const target of [[0,1.4,8],[0,3,8],[0,.3,8],[3,1.4,8]]){pose.sample('aim',0);const shot=aimCombatAK(actor,pose,asset,mesh,{target:new Vector3(...target)});assert.ok(new Vector3(0,1,0).applyQuaternion(mesh.quaternion).y>.8,'up axis '+target);assert.ok(Object.values(pose.handErrors).every(r=>r.distanceM<.03));assert.ok(shot.origin.toArray().concat(shot.direction.toArray()).every(Number.isFinite));}}
 finally{pose.dispose();rig.dispose();}
});
