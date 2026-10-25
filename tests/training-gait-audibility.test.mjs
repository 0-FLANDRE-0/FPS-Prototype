import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,Vector3} from 'three';
import {PlayerLocomotion} from '../apps/training/src/player-locomotion.js';
import {createPhysics} from '../apps/training/src/physics.js';
import {PLAYER} from '../apps/training/src/config.js';
import {SPRINT} from '../apps/training/src/sprint.js';
import {NOISE_TYPE_PROFILE,propagateSound,playbackGain,segmentBox} from '../apps/training/src/sound-acoustics.js';
import {SOUND_ROOMS as rooms,SOUND_PORTALS as portals,SOUND_WALLS as walls} from '../apps/training/src/sound-world.js';
import {FOOTSTEP_AUDIO} from '../apps/training/src/sound-tuning.js';

test('walk/run/crouch support cadence stays within practical ranges across eight directions and actual soles',async()=>{
 const physics=await createPhysics({humanTargets:[],armorProfile:{shapes:[]}}),body=new PlayerLocomotion(['standing','aim','crouch','walk'].map(n=>new AnimationClip(n,1,[])));
 try{for(const[gait,speed,min,max]of[['walk',PLAYER.speed,100,125],['run',SPRINT.speedMps,160,190],['crouch',PLAYER.crouchSpeed,65,90]])for(let direction=0;direction<8;direction++){
  body.reset();const angle=direction*Math.PI/4,times=[];
  for(let i=0;i<720;i++){const f=body.step({dt:1/60,time:i/60,feet:new Vector3(0,0,5),velocity:new Vector3(Math.sin(angle)*speed,0,-Math.cos(angle)*speed),yaw:0,crouched:gait==='crouch',sprinting:gait==='run',ads:false,grounded:true,physics});for(const c of f.contacts)if(c.time>1)times.push(c.time);}
  assert.ok(times.length>8);const spm=60*(times.length-1)/(times.at(-1)-times[0]);assert.ok(spm>=min&&spm<=max,`${gait}/${direction}: ${spm}`);
  assert.ok(times.slice(1).every((t,i)=>t-times[i]>.25),`${gait}: double taps`);
 }
 }finally{body.dispose();physics.world.free();}
});

test('low-cover/doorway footsteps take real unblocked edges while full concrete walls remain opaque',()=>{
 const e={type:'footstep_walk',sourceId:'E01',position:[74,FOOTSTEP_AUDIO.sourceHeightM-1e-8,-3],...NOISE_TYPE_PROFILE.footstep_walk,sourceDb:64};
 const p=propagateSound(e,[73.2,1.43,5],{rooms,portals,walls});assert.equal(p.sourceRoom,'combat');assert.equal(p.dominant,'portal');const around=p.components.find(c=>c.kind==='portal');assert.ok(around.screenDetours.some(d=>d.screenIds.includes('combat-low-cover')));assert.ok(p.levelDb>30);
 for(let i=0;i<around.points.length-1;i++)for(const w of walls){const h=segmentBox(around.points[i],around.points[i+1],w);assert.ok(!h||h.lengthM<1e-4||h.entry<=1e-6||h.exit>=.999999,'route intersects '+w.id);}
 const room=[{id:'room',boxes:[{min:[-10,0,-10],max:[10,4,10]}]}],wall={id:'solid',material:'concrete',at:[0,1.6,0],size:[.3,3.2,10]};
 const blocked=propagateSound({...e,position:[-2,.03,0]},[2,1.43,0],{rooms:room,portals:[],walls:[wall]});assert.equal(blocked.components.length,1);assert.equal(blocked.dominant,'wall');assert.ok(blocked.levelDb<12);assert.equal(playbackGain(blocked.levelDb,e),0);
});

test('footstep mix fades smoothly, retains distance ordering and boosts remote footsteps without raising gunshots',()=>{
 const enemy={type:'footstep_walk',sourceId:'E01'},own={...enemy,sourceId:'P01'};
 assert.equal(playbackGain(12,enemy),0);assert.ok(playbackGain(12.001,enemy)<playbackGain(13,enemy));assert.ok(playbackGain(13,enemy)<playbackGain(20,enemy));assert.ok(playbackGain(20,enemy)<playbackGain(40,enemy));
 assert.ok(playbackGain(40,enemy)>playbackGain(40,own));assert.ok(playbackGain(40,enemy)>playbackGain(40)*3);
 for(const db of[10,20,40,80,160])assert.equal(playbackGain(db,{type:'gunshot'}),playbackGain(db));
});
