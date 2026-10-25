import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { AimState } from '../apps/training/src/aim.js';
import { AIM_DEFAULTS } from '../apps/training/src/settings.js';
import { OPTICS } from '../apps/training/src/optic-data.js';
import { ZEROING_TABLE } from '../apps/training/src/generated/zeroing.js';
import { zeroingPreset } from '../apps/training/src/zeroing.js';
import { shotBallistics } from '../apps/training/src/catalog.js';
import { traceShot } from '../apps/training/src/ballistics.js';
import { canonicalGeometry, solveZero, flightAtDistance } from '../scripts/training-zeroing-solver.mjs';
const ledger=JSON.parse(await readFile('docs/zeroing-ledger.json','utf8'));
const settings={...AIM_DEFAULTS,breath:0,walkSway:0};
const frame={feet:new Vector3(),viewHeight:1.43,time:0,speed:0,ads:true,reloading:false,blocked:false};

test('all fixed hardware angles reproduce the source conditions within .1mm using production flight',()=>{
  assert.equal(Object.keys(ZEROING_TABLE).length,5);
  for(const [id,p] of Object.entries(ledger.results)){
    const solved=solveZero(p);assert.equal(solved.thetaRad,ZEROING_TABLE[id].thetaRad);
    assert.ok(Math.abs(flightAtDistance(p,p.thetaRad,p.distanceM).heightM-p.offsetM)<.0001,id);
    const g=canonicalGeometry(p),dir=g.axis.applyAxisAngle(new Vector3(1,0,0),p.thetaRad).applyQuaternion(g.alignment);
    const plane={bodyPaths:()=>[],armorContacts:()=>[],contact:(o,d,max)=>{
      const distance=(-p.distanceM-o.z)/d.z;
      return distance>=0&&distance<=max?{id:'zero-plane',kind:'target',distance,point:o.clone().addScaledVector(d,distance),normal:new Vector3(0,0,1)}:null;
    }};
    const trace=traceShot(plane,g.muzzle,dir,shotBallistics(p.referenceAmmoId,p.weaponId),{simulateFlight:true,maxDistance:620});
    assert.equal(trace.hit.id,'zero-plane');assert.ok(Math.abs(trace.hit.point.y-p.offsetM)<.0001,id);
  }
});
test('stationary ADS uses only θ above the sight line; model tilt is not double-added',()=>{
  for(const [id,p] of Object.entries(ZEROING_TABLE)){
    const a=new AimState({...settings});a.setWeapon(p.weaponId);a.setOptic(OPTICS[id]);
    for(let i=0;i<240;i++)a.step(1/60,frame);
    const sight=a.frontSight.clone().sub(a.sight).normalize(),shot=a.shotPose().direction;
    assert.ok(Math.abs(sight.angleTo(shot)-p.thetaRad)<1e-9,id);
    assert.ok(shot.y>sight.y);
    assert.ok(Math.abs(shot.y-Math.sin(p.thetaRad))<1e-8,id);
    assert.deepEqual(a.shotPose().origin,a.muzzle);
  }
});
test('fixed sight elevation persists through hip, ADS blend, turn, weapon-size and device switching',()=>{
  const a=new AimState({...settings,weaponSize:115});
  for(const id of ['m4a1','eotech_xps3_0','trijicon_ta31','vudu_1_6x24','m4a1','ak74m']){
    if(id==='ak74m')a.setWeapon(id);else{a.setWeapon('m4a1');a.setOptic(OPTICS[id]);}
    const p=ZEROING_TABLE[id];assert.equal(zeroingPreset(a.weaponId,a.opticDef),p);
    for(const ads of [false,true,false])for(let i=0;i<60;i++){
      a.look(1,-.3,ads);a.step(1/60,{...frame,ads});
      const localShot=a.shotPose().direction.applyQuaternion(a.quaternion.clone().invert());
      const expected=a.geometry.sightAxis.clone().applyAxisAngle(new Vector3(1,0,0),p.thetaRad);
      assert.ok(localShot.distanceTo(expected)<1e-12);
    }
  }
});
test('nonreference cartridges keep the hardware angle and naturally produce different impacts',()=>{
  const p=ledger.results.m4a1,theta=p.thetaRad;
  assert.ok(Math.abs(flightAtDistance(p,theta,300,'556_m193').heightM)> .01);
  assert.ok(Math.abs(flightAtDistance(p,theta,300,'556_m995_ap').heightM)> .01);
  assert.equal(ZEROING_TABLE.m4a1.thetaRad,theta);
});
test('BDC tables retain requested units/ranges, FFP invariance, and source differences without changing flight limits',()=>{
  assert.deepEqual(ledger.report.acog.map(v=>v.mark),[7.8,12.6,18.7,26.4,35.8]);
  assert.deepEqual(ledger.report.vudu.map(v=>v.mark),[2,3,4.1]);
  assert.deepEqual(ledger.report.vudu.map(v=>v.distanceM),[365.76,457.2,548.64]);
  assert.equal(ledger.report.ffpZoomIndependent,true);assert.equal(ledger.report.flightChanged,true);
  assert.equal(ledger.calculation.limits.maxDistanceM,620);assert.ok(ledger.report.acog.at(-1).outsideLiveRange);
  const p=ledger.results.ak74m;assert.equal(p.offsetM,.24);assert.equal(p.normalFireCheck.offsetCm,13);
  assert.equal(p.normalFireCheck.applied,false);assert.equal(p.pApproximation,true);
});
