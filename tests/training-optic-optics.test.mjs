import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {opticalField,opticEyeBox,stepOpticMagnification,VUDU_OPTICS} from '../apps/training/src/optic-optics.js';
import {AimState} from '../apps/training/src/aim.js';
import {AIM_DEFAULTS} from '../apps/training/src/settings.js';
import {Inventory,CRATE_OWNER} from '../apps/training/src/inventory.js';
import {VUDU} from '../apps/training/src/optic-data.js';

test('Vudu camera covers manufacturer 31.2/5.09m at 100yd; angular magnification remains 1–6x',()=>{
 for(const [m,width]of [[1,31.2],[6,5.09]]){const f=opticalField(m);assert.ok(Math.abs(2*91.44*Math.tan(f.trueFovRad/2)-width)<1e-10);}
 let last=Infinity;for(const m of [1,1.5,2,3,4,5,6]){const f=opticalField(m);assert.ok(f.trueFovRad<last);last=f.trueFovRad;assert.ok(Math.abs(f.apparentTan/f.trueTan-m)<1e-12);assert.ok(f.apparentFovRad*180/Math.PI>18.9&&f.apparentFovRad*180/Math.PI<19.5);assert.equal(f.exitPupilDiameterM,.024/m);}
});
test('high magnification narrows eye box: 6x centered/2mm/4mm and 1x tolerance',()=>{
 const a=opticEyeBox([0,0,.09],6),b=opticEyeBox([.002,0,.09],6),c=opticEyeBox([.004,0,.09],6);assert.ok(Math.abs(a.coverage-1)<1e-12);assert.ok(b.coverage>0&&b.coverage<.6);assert.equal(c.coverage,0);assert.equal(c.visible,false);assert.ok(Math.abs(opticEyeBox([.004,0,.09],1).coverage-1)<1e-12);
 assert.ok(Math.abs(opticEyeBox([0,.002,.09],6).coverage-b.coverage)<1e-12);
});
test('70/90/110mm eye relief gives axial edge shadow and no image outside the bundle',()=>{
 for(const m of [1,3,6]){assert.ok(Math.abs(opticEyeBox([0,0,.09],m).coverage-1)<1e-12);for(const z of [.070,.110]){const a=opticEyeBox([0,0,z],m);assert.ok(a.coverage>0&&a.coverage<.4);}assert.equal(opticEyeBox([0,0,.13],m).visible,false);assert.equal(opticEyeBox([0,0,-.09],m).visible,false);}
});
test('magnification travels continuously in 24 game ticks and never changes item identity',()=>{
 const item={instanceId:'optic-vudu-01'};for(let i=0;i<12;i++)stepOpticMagnification(item,1,1/60);assert.ok(Math.abs(item.magnification-Math.sqrt(6))<1e-12);for(let i=0;i<12;i++)stepOpticMagnification(item,1,1/60);assert.ok(Math.abs(item.magnification-6)<1e-12);stepOpticMagnification(item,1,10);assert.equal(item.magnification,6);for(let i=0;i<24;i++)stepOpticMagnification(item,-1,1/60);assert.ok(Math.abs(item.magnification-1)<1e-12);assert.equal(item.instanceId,'optic-vudu-01');
});
test('scoped ADS aligns eye to actual ocular/axis at 90mm; iron alignment and reset remain available',()=>{
 const aim=new AimState({...AIM_DEFAULTS,breath:0}),frame={feet:new Vector3(0,0,0),viewHeight:1.43,time:0,speed:0,ads:true,reloading:false,blocked:false};aim.setOptic(VUDU);for(let i=0;i<240;i++)aim.step(1/60,frame);
 const ocular=new Vector3(...VUDU.mountPosition).add(new Vector3(...VUDU_OPTICS.ocular)).applyQuaternion(aim.quaternion).add(aim.position),axis=new Vector3(0,0,-1).applyQuaternion(aim.quaternion),delta=aim.eye.clone().sub(ocular);
 assert.ok(Math.abs(-delta.dot(axis)-.09)<1e-9);assert.ok(delta.clone().addScaledVector(axis,.09).length()<1e-9);assert.ok(Math.abs(aim.barrelDirection.y)<1e-10);
 aim.setOptic(false);for(let i=0;i<240;i++)aim.step(1/60,frame);assert.ok(Math.abs(aim.barrelDirection.y-.008065214602995295)<1e-9);aim.setOptic(VUDU);aim.reset();assert.equal(aim.opticActive,false);
});
test('scope alignment cannot activate on the unrailed AK; its existing ADS geometry stays unchanged',()=>{
 const aim=new AimState({...AIM_DEFAULTS,breath:0});aim.setWeapon('ak74m');aim.setOptic(VUDU);assert.equal(aim.opticActive,false);for(let i=0;i<240;i++)aim.step(1/60,{feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads:true,reloading:false,blocked:false});assert.ok(Math.abs(aim.barrelDirection.y-.004428956475274414)<1e-9);
});
test('mounting the optical ADS geometry leaves hip display and muzzle unchanged, with device-specific zeroed shot direction',()=>{
 const bare=new AimState({...AIM_DEFAULTS}),scoped=new AimState({...AIM_DEFAULTS});scoped.setOptic(VUDU);
 for(let i=0;i<120;i++){for(const a of [bare,scoped]){a.look(i%30===0?20:0,i%40===0?-5:0,false);a.step(1/60,{feet:new Vector3(i*.01,0,0),viewHeight:1.43,time:i/60,speed:2.3,ads:false,reloading:false,blocked:false});}assert.deepEqual(scoped.position,bare.position);assert.deepEqual(scoped.quaternion,bare.quaternion);assert.deepEqual(scoped.shotPose().origin,bare.shotPose().origin);assert.deepEqual(scoped.shotPose().rotation,bare.shotPose().rotation);assert.notDeepEqual(scoped.shotPose().direction,bare.shotPose().direction);}
});
test('magnification belongs to the optic instance through weapon switching and detach/reattach',()=>{
 const inv=new Inventory(),id='optic-vudu-01',step=()=>{for(let i=0;i<180;i++)inv.step(1/60);};inv.openContainer(CRATE_OWNER);inv.installOptic(id);step();const optic=inv.optic;stepOpticMagnification(optic,1,.2);assert.ok(Math.abs(optic.magnification-Math.sqrt(6))<1e-12);inv.switchWeapon(1);step();assert.equal(inv.optic,null);inv.switchWeapon(0);step();assert.equal(inv.optic,optic);assert.equal(inv.removeOptic(),true);step();assert.equal(inv.items.get(id),optic);inv.installOptic(id);step();assert.equal(inv.optic,optic);assert.ok(Math.abs(optic.magnification-Math.sqrt(6))<1e-12);
});
