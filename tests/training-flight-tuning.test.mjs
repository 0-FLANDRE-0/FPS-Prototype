import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {CATALOG} from '../apps/training/src/catalog.js';
import {flightProfile,advanceFlight} from '../apps/training/src/flight.js';
import {getVelocityDragClass} from '../apps/training/src/generated/legacy-flight.js';
import {RETENTION_BY_CALIBER} from '../apps/training/src/generated/flight-tuning.js';
import {flightAtDistance} from '../scripts/training-zeroing-solver.mjs';
const fit=JSON.parse(await readFile('docs/flight-tuning-ledger.json')),old=JSON.parse(await readFile('docs/zeroing-ledger-v30.json')),now=JSON.parse(await readFile('docs/zeroing-ledger.json'));
test('5.56 manufacturer inverse fit meets all three BDC goals and preserves the legacy class retention ratios',()=>{
 assert.equal(fit.acceptance.passed,true);assert.equal(fit.tuning.R,RETENTION_BY_CALIBER['5.56x45mm']);
 assert.ok(fit.tuning.R>.88&&fit.tuning.R<.89);assert.ok(fit.comparison.every(r=>Math.abs(r.errorMOA)<1));
 for(const row of fit.tuning.mapping){assert.equal(flightProfile(CATALOG.AMMO_PRESETS[row.ammoId]).retentionPer100M,row.retentionPer100M);assert.equal(getVelocityDragClass(CATALOG.AMMO_PRESETS[row.ammoId]),row.legacyDragClass);}
 assert.equal(fit.tuning.mapping.length,12);
});
test('every non-5.56 registry profile, RK4 step and AK fixed zero remains exactly v30',()=>{
 let count=0;for(const ammo of Object.values(CATALOG.AMMO_PRESETS))if(!/^5\.56[×x]45(?:mm)?$/i.test(ammo.caliber||'')){
  const profile=flightProfile(ammo),before=flightProfile(ammo,{retentionByCaliber:{}});assert.deepEqual(profile,before);
  assert.deepEqual(advanceFlight(new Vector3(0,2,0),new Vector3(1,4,-890),1/120,profile),advanceFlight(new Vector3(0,2,0),new Vector3(1,4,-890),1/120,before));count++;
 }
 assert.ok(count>50);assert.deepEqual(now.results.ak74m,old.results.ak74m);
 for(const D of [100,200,300,400,500,600])assert.deepEqual(flightAtDistance(now.results.ak74m,now.results.ak74m.thetaRad,D),flightAtDistance(old.results.ak74m,old.results.ak74m.thetaRad,D,'545_ps_gs',{retentionByCaliber:{}}));
});
