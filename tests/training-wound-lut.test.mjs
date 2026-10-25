import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../apps/training/src/catalog.js';
import { computeWoundChannel, computeWoundChannelDirect, WOUND_LUT_INFO } from '../apps/training/src/wound-channel.js';
import { isS3CalibratedAmmo } from '../apps/training/src/wound-s3-types.js';

test('S1 eagerly constructs every registered cartridge and both fragmentation-speed classes before shooting',()=>{
  assert.equal(WOUND_LUT_INFO.cartridges,Object.keys(CATALOG.AMMO_PRESETS).length);
  assert.equal(WOUND_LUT_INFO.speedClasses,2);
  assert.equal(WOUND_LUT_INFO.depthSamples,513);
  assert.equal(WOUND_LUT_INFO.depthStepM,.005);
  assert.equal(WOUND_LUT_INFO.maximumDepthM,2.56);
  assert.ok(WOUND_LUT_INFO.scalarBytes>0);
  assert.ok(Number.isFinite(WOUND_LUT_INFO.loadTimeMs));
  assert.equal(computeWoundChannel({ammoId:'556_m855',entryVelocityMps:879,lengthM:.2,bodyPart:'chest'}).calculationMode,'equivalent-depth-lut');
});

test('S1 eager tables preserve direct predictions across all 114 actual cartridge masses and three impact-speed factors',()=>{
  for(const [ammoId,ammo] of Object.entries(CATALOG.AMMO_PRESETS))for(const factor of [.65,.9,1.05]){
    const input={ammoId,entryVelocityMps:ammo.velocity*factor,massKg:ammo.projectileMassG/1000,lengthM:.2837,bodyPart:'chest'};
    const lut=computeWoundChannel(input),direct=computeWoundChannelDirect(input);
    // The new shared AP curve introduces an onset close to the partial final
    // cell. Its reported5mm interpolation bound differs; retain the literal
    // original tolerance for every untouched cartridge.
    assert.ok(Math.abs(lut.damageMultiplier-direct.damageMultiplier)<(isS3CalibratedAmmo(ammoId)?.00002:.00001),ammoId+' damage multiplier');
    assert.ok(Math.abs(lut.predictedExitVelocityMps-direct.predictedExitVelocityMps)<(isS3CalibratedAmmo(ammoId)?.03:.02),ammoId+' shadow exit speed');
    assert.equal(lut.fragmentation,direct.fragmentation,ammoId+' fragmentation gate');
    assert.equal(lut.geometryQueriesPerStep,0);
    assert.ok(lut.steps.every(s=>s.velocityOutMps<=s.velocityInMps&&s.velocityOutMps>=0));
  }
});

test('S2 table lookup retains off-grid yaw/mass/cloud state while respecting the caller-provided actual incoming speed',()=>{
  for(const ammoId of ['545_ps_gs','556_m855'])for(const velocity of [650,800,900]){
    const massKg=CATALOG.AMMO_PRESETS[ammoId].projectileMassG/1000;
    const first=computeWoundChannelDirect({ammoId,entryVelocityMps:velocity,massKg,lengthM:.1373,bodyPart:'leftArm'});
    const input={ammoId,entryVelocityMps:velocity*.72,massKg,lengthM:.1837,bodyPart:'chest',stateIn:first.stateOut};
    const copy=structuredClone(input),lut=computeWoundChannel(input),direct=computeWoundChannelDirect(input);
    assert.deepEqual(input,copy);
    assert.equal(lut.entryVelocityMps,input.entryVelocityMps);
    assert.equal(lut.initialYawRad,direct.initialYawRad);
    assert.equal(lut.stateOut.occupiedDepthM,first.stateOut.occupiedDepthM+input.lengthM);
    assert.equal(lut.fragmentation,direct.fragmentation);
    assert.ok(Math.abs(lut.predictedExitVelocityMps-direct.predictedExitVelocityMps)<1.5);
    assert.ok(Math.abs(lut.damageMultiplier-direct.damageMultiplier)<.004);
    const initial=.5*first.stateOut.massKg*input.entryVelocityMps**2+first.stateOut.fragmentEnergyJ;
    const remaining=.5*lut.stateOut.massKg*lut.predictedExitVelocityMps**2+lut.stateOut.fragmentEnergyJ;
    assert.ok(Math.abs(initial-lut.energyLostJ-remaining)<1e-7);
    assert.ok(Math.abs(lut.stateOut.massKg+lut.stateOut.fragmentMassKg-massKg)<1e-12);
  }
});
