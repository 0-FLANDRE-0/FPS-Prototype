import{test}from'node:test';import assert from'node:assert/strict';import{Inventory,GRID_LAYOUTS,itemSize}from'../apps/training/src/inventory.js';import{magazineDefinition}from'../apps/training/src/catalog.js';import{verifyAKReference}from'../scripts/training-w-reference.mjs';
const advance=(i,s)=>{for(let k=0;k<Math.ceil(s*60);k++)i.step(1/60)};
function conserved(i){const counts=i.roundCounts();for(const[id,total]of Object.entries(i.initialByAmmo))assert.equal((counts[id]||0)+(i.spent[id]||0),total,id);for(const owner of Object.keys(GRID_LAYOUTS)){const cells=new Set();for(const item of i.items.values())if(item.owner===owner){assert.ok(item.cell);const size=itemSize(item);for(let y=item.cell.y;y<item.cell.y+size.h;y++)for(let x=item.cell.x;x<item.cell.x+size.w;x++){assert.ok(x<GRID_LAYOUTS[owner].cols&&y<GRID_LAYOUTS[owner].rows);assert.ok(!cells.has(x+','+y));cells.add(x+','+y)}}}for(const item of i.items.values())if(item.kind==='magazine')assert.ok(item.rounds.every(a=>magazineDefinition(item).allowedAmmoIds.includes(a)));}
test('AK 13 cartridges × 3 materials × 4 armor values match untouched original VM residual and durability',async()=>{assert.equal((await verifyAKReference()).rows.length,156)});
test('two caliber inventory rejects cross-caliber loading and preserves each cartridge through tactical/empty switch cancellations',()=>{
 for(const empty of [false,true])for(const stop of [0,.3,1.17,1.9,2.09,2.71]){const i=new Inventory();conserved(i);assert.equal(i.switchWeapon(1),true);advance(i,1);assert.equal(i.weapon.definitionId,'ak74m');assert.equal(i.beginReload('mag-02'),false);assert.equal(i.pack('mag-04','crate:545_ps_gs'),false);
  if(empty)for(let n=0;n<30;n++)assert.equal(i.fire(),'545_ps_gs');assert.equal(i.weapon.boltLocked,false);assert.equal(i.beginReload(),true);assert.equal(i.action.duration,empty?2.7:2.1);advance(i,stop);assert.equal(i.switchWeapon(0),true);advance(i,1);assert.equal(i.weapon.definitionId,'m4a1');conserved(i);assert.ok([...i.items.values()].every(x=>x.owner!=='hand:reload'));
 }
});
test('AK safety, no bolt hold-open, seated-magazine event and separate chambers survive weapon switching',()=>{const i=new Inventory();i.switchWeapon(1);advance(i,1);i.weapon.fireMode='safe';assert.equal(i.fire(),null);i.weapon.fireMode='full';const chamber=i.weapon.chamber;i.beginReload();advance(i,1.8);assert.equal(i.weapon.magazineId,null);assert.equal(i.weapon.chamber,chamber);advance(i,.11);assert.equal(i.weapon.magazineId,'ak-mag-02');advance(i,.3);assert.equal(i.loadedRounds,31);i.switchWeapon(0);advance(i,1);assert.equal(i.weapon.chamber,'556_m855');conserved(i)});
import {AimState} from '../apps/training/src/aim.js';
import {AIM_DEFAULTS} from '../apps/training/src/settings.js';
import {PerspectiveCamera} from 'three';
import {Vector3} from 'three';
test('both rifles lead their rear mount and camera during hip and ADS turns, then recover alignment',()=>{
 for(const id of ['m4a1','ak74m'])for(const ads of [false,true]){
  const aim=new AimState({...AIM_DEFAULTS,breath:0});aim.setWeapon(id);
  const camera=new PerspectiveCamera(52,844/390,.015,65);
  const controls={feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads,reloading:false,blocked:false};
  const step=()=>{aim.step(1/60,controls);camera.position.copy(aim.eye);camera.rotation.set(aim.viewPitch,aim.viewYaw,0,'YXZ');camera.updateMatrixWorld(true);};
  for(let i=0;i<240;i++)step();
  const before=aim.frontSight.clone().project(camera),rearBefore=aim.sight.clone().project(camera);
  aim.look(40,-8,ads);step();
  assert.ok(Math.abs(aim.weaponYaw)>Math.abs(aim.viewYaw),'rifle moves before camera');
  assert.ok(Math.abs(aim.weaponYaw)>Math.abs(aim.mountYaw),'rifle moves before rear mount');
  {const frontMove=aim.frontSight.clone().project(camera).distanceTo(before),rearMove=aim.sight.clone().project(camera).distanceTo(rearBefore);assert.ok(rearMove<frontMove*.2);}
  for(let i=0;i<240;i++){step();assert.ok(Math.hypot(aim.sightLagYaw,aim.sightLagPitch)<=.022+1e-9);}
  assert.ok(Math.hypot(aim.freeYaw,aim.freePitch)<1e-6);
  if(ads){const f=aim.frontSight.clone().project(camera),r=aim.sight.clone().project(camera);assert.ok(Math.hypot(f.x-r.x,f.y-r.y)<1e-7);}
 }
});

import {solveArm} from '../apps/training/src/fps-arms.js';
import {Bone} from 'three';
test('body shoulder IK keeps rigid segment lengths and detects both reach and folding limits',()=>{
 for(const pole of [undefined,new Vector3(-1,-1,.6)])for(const goal of [new Vector3(.7,1.6,.3),new Vector3(0,.1,0),new Vector3(0,4,0)]){
  const root=new Bone(),upper=new Bone(),fore=new Bone(),wrist=new Bone();root.add(upper);upper.add(fore);fore.add(wrist);fore.position.y=1;wrist.position.y=1.5;upper.updateMatrixWorld(true);
  const result=solveArm(upper,fore,wrist,goal,pole),a=upper.getWorldPosition(new Vector3()),b=fore.getWorldPosition(new Vector3()),c=wrist.getWorldPosition(new Vector3());
  assert.ok(Math.abs(a.distanceTo(b)-1)<1e-12);assert.ok(Math.abs(b.distanceTo(c)-1.5)<1e-12);
  if(goal.y===.1){assert.ok(Math.abs(result.unreachableM-.4)<1e-12);assert.ok(Math.abs(c.distanceTo(goal)-.4)<1e-5);}
  else if(goal.y===4){assert.ok(Math.abs(result.unreachableM-1.5)<1e-12);assert.ok(Math.abs(c.distanceTo(goal)-1.5)<1e-5);}
  else{assert.equal(result.unreachableM,0);assert.ok(c.distanceTo(goal)<1e-9);}
 }
});
