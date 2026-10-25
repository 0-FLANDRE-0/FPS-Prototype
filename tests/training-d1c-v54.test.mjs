import test from'node:test';import assert from'node:assert/strict';import{BoxGeometry,Matrix4,Vector3}from'three';
import{meshTriangles,solidMeshIntervals,firstMeshSurface}from'../apps/training/src/armor-geometry.js';
import{intersectInternalBody,internalWorldShapes}from'../apps/training/src/internal-anatomy.js';
import{MedicalFeedback}from'../apps/training/src/medical-feedback.js';import{TrainingMedical}from'../apps/training/src/medical.js';
test('D1c conscious retinal blackout and unconscious blackout read separate engine flags without medical mutation',()=>{
 const m=new TrainingMedical().actor.medical;m.hemodynamics.map=10;m.hemodynamics.tissuePerfusion=0;m.hemodynamics.oxygenDelivery=0;const original=structuredClone(m),f=new MedicalFeedback();
 let r=f.step(1/60,0,m);assert.equal(r.vision.blackout,1);assert.equal(r.vision.unconscious,false);assert.deepEqual(m,original);
 m.isUnconscious=true;r=f.step(1/60,1/60,m);assert.equal(r.vision.unconscious,true);
 m.hemodynamics.map=93;m.hemodynamics.tissuePerfusion=m.hemodynamics.oxygenDelivery=1;r=f.step(1/60,2/60,m);assert.equal(r.vision.blackout,0);assert.equal(r.vision.unconscious,true,'recovered retinal input must not restore vision before consciousness');
});
test('D1c source-order BVH matches the unindexed linear narrow phase for inside, edge, tangent, distant and random rays',()=>{
 const g=new BoxGeometry(.6,1,.3,12,12,12),fast=meshTriangles(g.attributes.position.array,g.index.array),linear=fast.slice();let seed=17;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const rays=[[new Vector3(),new Vector3(0,0,1),.01],[new Vector3(.3,.5,2),new Vector3(0,0,-1),.01],[new Vector3(.3,0,0),new Vector3(0,1,0),5]];
 for(let n=0;n<300;n++)rays.push([new Vector3(random()*2-1,random()*2-1,random()*2-1),new Vector3(random()-.5,random()-.5,random()-.5).normalize(),random()*4]);
 for(const[o,d,l]of rays){assert.equal(JSON.stringify(solidMeshIntervals(fast,o,d,l)),JSON.stringify(solidMeshIntervals(linear,o,d,l)));assert.deepEqual(firstMeshSurface(fast,o,d,l),firstMeshSurface(linear,o,d,l));}g.dispose();
});
test('D1c private anatomy pose cache invalidates on matrices, translation, yaw and shape replacement; public shapes remain independent',()=>{
 const bone={matrixWorld:new Matrix4()},a={rig:{byName:new Map([['test',bone]])},profile:{nearMissM:.02},shapes:[{id:'organ',kind:'organ',identifier:'liver_candidate',organ:'liver',domain:'chest',bone:'test',type:'ellipsoid',center:[0,0,.2],radii:[.02,.04,.05],axes:[[1,0,0],[0,1,0],[0,0,1]]}]},actor={at:[0,0,0],yaw:0},body={bodyEntered:true,point:[.01,0,0],incomingDirection:[0,0,1],entryDistance:0,exitDistance:.4};
 const query=()=>intersectInternalBody(a,actor,body,.0028),fresh=()=>intersectInternalBody({...a,shapes:[...a.shapes]},actor,body,.0028);
 query();for(const change of[()=>{actor.at[0]+=.01;},()=>{actor.yaw=.1;},()=>{bone.matrixWorld.makeRotationX(.2);},()=>{a.shapes=[{...a.shapes[0],center:[.03,0,.2]}];}]){change();assert.equal(JSON.stringify(query()),JSON.stringify(fresh()));}
 const before=JSON.stringify(query()),world=internalWorldShapes(a,actor);world[0].center[0]=100;assert.equal(JSON.stringify(query()),before);
});
