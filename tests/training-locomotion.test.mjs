import test from'node:test';import assert from'node:assert/strict';import{AnimationClip,Vector3}from'three';
import{PlayerLocomotion}from'../apps/training/src/player-locomotion.js';import{createPhysics}from'../apps/training/src/physics.js';import{AimState}from'../apps/training/src/aim.js';import{AIM_DEFAULTS}from'../apps/training/src/settings.js';
const native=['standing','aim','crouch','walk'].map(n=>new AnimationClip(n,1,[]));
test('body FK contacts across24 gait/direction combinations occur at soles on actual floor, never cadence timers',async()=>{
 const physics=await createPhysics({humanTargets:[],armorProfile:{shapes:[]}}),body=new PlayerLocomotion(native);
 try{for(const[gait,speed]of[['walk',2.7],['run',4.5],['crouch',1.5]])for(let direction=0;direction<8;direction++){
  body.reset();const angle=direction*Math.PI/4,velocity=new Vector3(-Math.sin(angle)*speed,0,-Math.cos(angle)*speed),events=[];
  for(let i=0;i<240;i++){const f=body.step({dt:1/60,time:i/60,feet:new Vector3(0,0,5),velocity,yaw:0,crouched:gait==='crouch',sprinting:gait==='run',ads:false,grounded:true,physics});events.push(...f.contacts);}
  for(const side of['left','right'])assert.ok(events.filter(e=>e.side===side).length>=2,gait+' '+direction+' '+side);
  for(const e of events){assert.ok(e.clearanceM<=.012&&e.clearanceM>=-.025);assert.ok(e.supportVelocityMps<=.05);assert.equal(e.colliderId,'floor');assert.ok(Math.abs(e.position[1])<1e-6);}
 }
 }finally{body.dispose();physics.world.free();}
});
test('no contact sound while airborne or standing; motion clock and stance transitions remain finite',async()=>{
 const physics=await createPhysics({humanTargets:[],armorProfile:{shapes:[]}}),body=new PlayerLocomotion(native);try{
  for(let i=0;i<120;i++)assert.equal(body.step({dt:1/60,time:i/60,feet:new Vector3(0,1,5),velocity:new Vector3(0,0,-2.7),yaw:0,crouched:false,sprinting:false,ads:false,grounded:false,physics}).contacts.length,0);
  for(let i=120;i<240;i++)assert.equal(body.step({dt:1/60,time:i/60,feet:new Vector3(0,0,5),velocity:new Vector3(),yaw:0,crouched:i%60<30,sprinting:false,ads:true,grounded:true,physics}).contacts.length,0);
  assert.ok(Number.isFinite(body.frame.phaseRad));for(const v of body.frame.position)assert.ok(Number.isFinite(v));
 }finally{body.dispose();physics.world.free();}
});
test('rifle locomotion uses supplied body position/rotation/phase rather than an independent time sine',()=>{
 const settings={...AIM_DEFAULTS,breath:0},base={feet:new Vector3(),viewHeight:1.43,speed:2.7,ads:false,reloading:false,blocked:false,locomotion:{phaseRad:1.25,weight:.8,position:new Vector3(.01,.02,-.01),rotation:{x:.02,y:.01,z:-.02}}},a=new AimState(settings),b=new AimState(settings);
 a.step(1/60,{...base,time:1});b.step(1/60,{...base,time:100});assert.deepEqual(a.position.toArray(),b.position.toArray());assert.deepEqual(a.quaternion.toArray(),b.quaternion.toArray());assert.equal(a.gaitPhase,1.25);
 const c=new AimState(settings);c.step(1/60,{...base,time:1,locomotion:{...base.locomotion,position:new Vector3(.01,.03,-.01)}});assert.ok(c.position.y>a.position.y);
});

test('player eye and animated ankles remain aligned across walk/run/crouch and both leans without changing limb lengths',async()=>{
 const {CombatPose}=await import('../apps/training/src/combat-pose.js'),{createSoldierRig}=await import('../apps/training/src/soldier-rig.js'),{leanPose}=await import('../apps/training/src/lean.js'),{PerspectiveCamera}=await import('three');
 const physics=await createPhysics({humanTargets:[],armorProfile:{shapes:[]}}),body=new PlayerLocomotion(native),rig=createSoldierRig(),pose=new CombatPose(rig,native),camera=new PerspectiveCamera(),feet=new Vector3(0,0,5),actor={at:feet.toArray(),yaw:Math.PI};
 const length=(s,a,b)=>rig.byName.get(s+a).getWorldPosition(new Vector3()).distanceTo(rig.byName.get(s+b).getWorldPosition(new Vector3())),lengths=Object.fromEntries(['left','right'].map(s=>[s,[length(s,'UpperLeg','LowerLeg'),length(s,'LowerLeg','Foot')]]));
 try{for(const[gait,speed,height]of[['walk',2.7,1.43],['run',4.5,1.43],['crouch',1.5,.98]])for(const lean of[0,-1,1]){body.reset();for(let i=0;i<120;i++){body.step({dt:1/60,time:i/60,feet,velocity:new Vector3(0,0,-speed),yaw:0,crouched:gait==='crouch',sprinting:gait==='run',ads:false,grounded:true,physics});const lp=leanPose(lean,height,0);camera.position.copy(feet).add(new Vector3(0,height,0)).add(lp.headOffset);pose.player({actor,feet,camera,aim:{viewYaw:0,viewPitch:0,ads:0},lean:lp,handRows:[],time:i/60,locomotion:body});assert.ok(pose.eyeErrorM<.001);for(const s of['left','right']){assert.ok(pose.legErrors[s].errorM<.001);assert.ok(Math.abs(length(s,'UpperLeg','LowerLeg')-lengths[s][0])<1e-9);assert.ok(Math.abs(length(s,'LowerLeg','Foot')-lengths[s][1])<1e-9);}}}}
 finally{body.dispose();pose.dispose();rig.dispose();physics.world.free();}
});
