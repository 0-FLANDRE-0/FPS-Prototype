import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3,Matrix4} from 'three';
import {createSoldierRig} from '../apps/training/src/soldier-rig.js';
import {actorRotation} from '../apps/training/src/human-targets.js';
import {createInternalRegions,WOUND_CHANNEL_DEBUG} from '../apps/training/src/internal-model.js';

function fixture(id='A01'){
 const scene=new Scene(),rig=createSoldierRig(),actor={id,at:[4,0,-2],yaw:.2};
 const anatomy={rig,shapes:[{id:'brain',type:'ellipsoid',kind:'organ',bone:'head',center:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]],radii:[.06,.06,.06]}]};
 const physics={internalActors:new Map([[id,actor]]),internalAnatomies:new Map([[id,anatomy]])},debug=createInternalRegions(scene,physics);
 const world=bone=>new Matrix4().makeRotationFromQuaternion(actorRotation(actor)).setPosition(new Vector3(...actor.at)).multiply(rig.byName.get(bone).matrixWorld);
 function record(bodyPart='head',bone='head',n=60,m=.321){const origin=new Vector3(0,.015,.1).applyMatrix4(world(bone));return{address:{targetId:id,bone},bodyPart,woundChannel:{origin:origin.toArray(),direction:[0,0,-1],bodyPart,damageMultiplier:m,steps:Array.from({length:n},(_,i)=>({depthM:i*.005,dxM:.005,permanentRadiusM:.003,temporaryRadiusM:.025+i*.0001,fragmentRadiusM:i>n/2?.012:0}))}};}
 const trace={bodyHits:[{targetId:id,internalHits:[{id:'brain'}]}],armorResults:[]};
 return{scene,rig,actor,anatomy,physics,debug,world,record,trace,dispose(){debug.dispose();rig.dispose();}};
}
function withCanvas(run){const previous=globalThis.document,text=[];globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(value){text.push(value);}})})};try{return run(text);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}}

test('last-hit cavity display is lazy, bounded, and preserves every clinical sample and part multiplier',()=>withCanvas(text=>{
 const f=fixture();try{
  const records=[f.record(),f.record('chest','chest',180,.887)],before=JSON.stringify({records,trace:f.trace});
  f.debug.highlight(f.trace,records);assert.equal(f.debug.woundSnapshot().channels.length,2);assert.equal(f.debug.woundSnapshot().sampleCount,0);
  const channelRoot=f.debug.root.getObjectByName('last wound channels');assert.equal(channelRoot.children.length,0,'hidden checkbox does not build wound geometry');
  f.debug.setVisible(true);assert.equal(f.debug.woundSnapshot().sampleCount,96);assert.deepEqual(f.debug.woundSnapshot().channels.map(c=>c.clinicalStepCount),[60,180]);
  assert.deepEqual(f.debug.woundSnapshot().channels.map(c=>c.damageMultiplier),[.321,.887]);assert.equal(channelRoot.children.length,2);
  const meshes=[];channelRoot.traverse(node=>{if(node.isMesh)meshes.push(node);});assert.equal(meshes.length,6,'three merged cavity geometries per affected bone');
  for(const [kind,{color,opacity}]of Object.entries(WOUND_CHANNEL_DEBUG).filter(([,value])=>typeof value==='object')){const mesh=meshes.find(m=>m.name===`${kind} wound cavity`);assert.equal(mesh.material.color.getHex(),color);assert.equal(mesh.material.opacity,opacity);assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));}
  assert.deepEqual(text,['머리  m=0.321','흉부  m=0.887']);assert.equal(f.debug.entries[0].mesh.material.opacity,.8);assert.equal(f.debug.entries[0].mesh.material.color.getHex(),0xffff00);
  assert.equal(JSON.stringify({records,trace:f.trace}),before,'debug does not edit anatomy intersections or clinical data');
 }finally{f.dispose();}
}));

test('cavity vertices are frozen in the impacted bone frame and follow actor motion and bone rotation',()=>{
 const f=fixture();try{
  const beforeBone=f.world('head').clone();f.debug.setVisible(true);f.debug.highlight(f.trace,[f.record()]);f.scene.updateMatrixWorld(true);
  const mesh=f.debug.root.getObjectByName('permanent wound cavity'),vertex=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0),before=mesh.localToWorld(vertex.clone());
  f.actor.at[0]+=2;f.actor.yaw+=.7;f.rig.byName.get('head').rotation.z=.4;f.rig.root.updateMatrixWorld(true);f.debug.syncPose();f.scene.updateMatrixWorld(true);
  const after=mesh.localToWorld(vertex.clone()),expected=before.clone().applyMatrix4(beforeBone.invert()).applyMatrix4(f.world('head'));
  assert.ok(after.distanceTo(expected)<1e-6);assert.ok(after.distanceTo(before)>1,'wound does not remain floating at the shot world position');
 }finally{f.dispose();}
});

test('each target retains its own last hit, armor-only impacts clear that target, and null resets remain compatible',()=>{
 const a=fixture('A01'),b=fixture('B01');try{
  a.debug.setVisible(true);b.debug.setVisible(true);const mixed=[a.record(),b.record()];a.debug.highlight(a.trace,mixed);b.debug.highlight(b.trace,mixed);
  assert.deepEqual(a.debug.woundSnapshot().channels.map(c=>c.targetId),['A01']);assert.deepEqual(b.debug.woundSnapshot().channels.map(c=>c.targetId),['B01']);
  a.debug.highlight(b.trace,[b.record()]);assert.equal(a.debug.woundSnapshot().channels.length,1,'a different target being shot does not erase this last hit');
  a.debug.highlight({bodyHits:[],armorResults:[{targetId:'A01',outcome:'plate_block'}]},[{address:{targetId:'A01'},skinContact:false}]);assert.equal(a.debug.woundSnapshot().channels.length,0);assert.equal(b.debug.woundSnapshot().channels.length,1);
  b.debug.highlight(null);assert.equal(b.debug.woundSnapshot().channels.length,0);assert.equal(b.debug.woundSnapshot().sampleCount,0);assert.equal(b.debug.entries[0].mesh.material.opacity,.24);
  b.debug.highlight(b.trace);assert.equal(b.debug.entries[0].mesh.material.opacity,.8,'existing single-argument anatomy highlighting still works');
 }finally{a.dispose();b.dispose();}
});

test('replacing or disposing last-hit geometry releases its GPU resources and ignores unusable channels',()=>withCanvas(()=>{
 const f=fixture();try{
  f.debug.setVisible(true);f.debug.highlight(f.trace,[f.record()]);const channelRoot=f.debug.root.getObjectByName('last wound channels'),resources=[];
  channelRoot.traverse(node=>{for(const item of[node.geometry,node.material?.map,node.material])if(item){let disposed=false;item.addEventListener('dispose',()=>{disposed=true;});resources.push(()=>disposed);}});
  const bad=f.record();bad.woundChannel.direction=[0,0,0];f.debug.highlight(f.trace,[bad]);assert.equal(f.debug.woundSnapshot().channels.length,0);assert.ok(resources.every(read=>read()),'all replaced geometries, labels, and textures are released');
  f.debug.highlight(f.trace,[f.record('leftArm','leftUpperArm',30,.1)]);f.debug.dispose();assert.equal(f.scene.children.length,0);assert.equal(f.debug.woundSnapshot().channels.length,0);
 }finally{f.dispose();}
}));
