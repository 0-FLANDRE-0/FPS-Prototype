import test from 'node:test';import assert from 'node:assert/strict';
import {MedicalFeedback,readMedicalFeedback}from'../apps/training/src/medical-feedback.js';
import {TrainingMedical}from'../apps/training/src/medical.js';
import {AimState}from'../apps/training/src/aim.js';import{AIM_DEFAULTS}from'../apps/training/src/settings.js';import{Vector3,Quaternion,PerspectiveCamera}from'three';
import{PlayerFallView,PLAYER_FALL}from'../apps/training/src/player-fall.js';
test('blood-volume grayscale progression stays monotonic and independent of flow, MAP and perfusion',()=>{
 let previous=0;for(let i=0;i<=50;i++){const m=new TrainingMedical().actor.medical;m.bloodMl=m.bloodMax*(1-i/100);const before=structuredClone(m),a=new MedicalFeedback().step(0,2,m);assert.ok(a.vision.desaturation>=previous);previous=a.vision.desaturation;assert.deepEqual(m,before);
  m.externalBleedRate=900;m.internalBleedRate=900;m.hemodynamics.map=20;m.hemodynamics.tissuePerfusion=.1;m.hemodynamics.oxygenDelivery=.1;const b=new MedicalFeedback().step(0,2,m);for(const k of['desaturation','peripheralDark','volumeTunnel','volumeBlackout'])assert.equal(a.vision[k],b.vision[k]);
 }const m=new TrainingMedical().actor.medical;m.hemodynamics.map=25;assert.equal(new MedicalFeedback().step(0,2,m).vision.desaturation,0);
});
test('v52 weak aim keeps ADS intent while it loses alignment and then actively recovers',()=>{
 const m=new TrainingMedical().actor.medical;m.aimMul=.25;m.weaponHandlingMul=.7;m.bodyParts.leftArm.pain=85;m.stressResponse.perceivedPain=70;
 const original=structuredClone(m),f=new MedicalFeedback(),aim=new AimState({...AIM_DEFAULTS,breath:0,walkSway:0}),rows=[];
 for(let i=0;i<3600;i++){const r=f.step(1/60,i/60,m);aim.step(1/60,{feet:new Vector3(),viewHeight:1.43,time:i/60,speed:0,ads:true,reloading:false,blocked:false,medicalFeedback:r});if(i>300)rows.push({ads:aim.ads,lapse:r.aimHold.lapse,error:Math.hypot(r.aimHold.yaw,r.aimHold.pitch)});}
 assert.ok(Math.min(...rows.map(r=>r.ads))<.9);assert.ok(Math.max(...rows.map(r=>r.ads))>.99);assert.ok(rows.some(r=>r.lapse>.2));assert.ok(rows.every(r=>r.error<=Math.SQRT2*.012+1e-12));assert.deepEqual(m,original);
 m.aimMul=1;m.bodyParts.leftArm.pain=0;m.stressResponse.perceivedPain=0;const r=f.step(1/60,61,m);assert.equal(r.aimHold.alignment,1);assert.deepEqual(r.angles,{yaw:0,pitch:0,roll:0});
});
test('v52 blood symptom consumer keeps orthostatic whitening separate from blood-volume grayscale',()=>{
 const m=new TrainingMedical().actor.medical;m.bloodMl=m.bloodMax*.8;m.hemodynamics.map=65;const f=new MedicalFeedback();f.step(1/60,0,m,{crouched:true});const base=f.output.vision.desaturation;f.step(1/60,1,m,{crouched:false});let white=0;for(let i=1;i<300;i++){const r=f.step(1/60,1+i/60,m);white=Math.max(white,r.vision.white);assert.equal(r.vision.desaturation,base);}assert.ok(white>0);
});
test('head-attached fall camera preserves its transition view, follows head roll and defers interface',()=>{
 const bone={getWorldQuaternion:q=>q.copy(rotation)},position=new Vector3(3,1.4,5),rotation=new Quaternion(),body={worldCom:()=>position.clone(),translation:()=>position.clone()},player={actor:{id:'P01',at:[0,0,0],yaw:0},rig:{byName:new Map([['head',bone]])},pose:{point:()=>position.clone()},ragdoll:{parts:new Map([['head',{body}],...['pelvis','chest','neck','spine'].map(name=>[name,{body:{translation:()=>({x:3,y:1.1,z:5})},collider:{}}])])}};
 const physics={surface:new Map(),world:{castShape:()=>null,contactPairsWith(){},getCollider:()=>null}},camera=new PerspectiveCamera();camera.position.set(3,1.457,5.065);camera.rotation.set(.1,.2,.15);const initial=camera.quaternion.clone(),view=new PlayerFallView(player,physics,camera);view.apply(camera,1);assert.ok(camera.position.distanceTo(new Vector3(3,1.457,5.065))<1e-12);assert.ok(camera.quaternion.angleTo(initial)<1e-7);
 rotation.setFromAxisAngle(new Vector3(0,0,1),.7);position.y=.35;view.capture(.5);view.apply(camera,1);assert.ok(camera.quaternion.angleTo(initial)>.6);assert.equal(view.interfaceReady,false);view.capture(PLAYER_FALL.maximumInterfaceS);assert.equal(view.interfaceReady,true);
});
test('prepared own ragdoll sensors cannot block walking, while Sector04 boundary remains collidable',async()=>{
 const [{createPhysics},{createCombatZone},{Scene},{default:R}]=await Promise.all([import('../apps/training/src/physics.js'),import('../apps/training/src/combat-zone.js'),import('three'),import('@dimforge/rapier3d-compat')]);
 const saved=globalThis.document;globalThis.document={createElement:()=>({width:512,height:256,getContext:()=>({fillRect(){},fillText(){}})})};const p=await createPhysics({humanTargets:[]});
 try{const zone=createCombatZone(new Scene(),p);p.relocate({x:74,z:5});const at=p.body.translation(),collider=p.world.createCollider(R.ColliderDesc.capsule(.5,.23).setTranslation(at.x,at.y,at.z).setSensor(true).setCollisionGroups(0));p.surface.set(collider.handle,{id:'P01',kind:'human-movement'});assert.equal(zone.playerCollisionFilter(collider),false);const boundary=[...p.surface].find(([,s])=>s.kind==='player-boundary');assert.equal(zone.playerCollisionFilter(p.world.getCollider(boundary[0])),true);for(let i=0;i<60;i++)p.step({move:{x:0,y:-1},crouch:false,sprint:false,collisionFilter:zone.playerCollisionFilter},0);assert.ok(p.feet.z<4,'normal walking is not held by own sensor');}
 finally{p.dispose();if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
