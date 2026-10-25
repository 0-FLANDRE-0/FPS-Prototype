import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../apps/training/src/catalog.js';
import { computeWoundChannel, WOUND_S2_VALUES } from '../apps/training/src/wound-channel.js';
import { S3_TERMINAL_SETTINGS } from '../apps/training/src/wound-s3-types.js';
import { DAMAGE_INDICES_S3, DAMAGE_INDEX_S3_INFO, damageIndexS3, damageIndexBlockS3, damageIndexFlightS3 } from '../apps/training/src/damage-index-s3.js';
import { DEBUG_AMMO_COLUMN_COUNT, debugAmmoRows } from '../apps/training/src/debug-ammo-ui.js';

test('S3 table indices cover exactly the W1 32 selected rounds, with no invented values for the other 82', () => {
  assert.equal(Object.keys(DAMAGE_INDICES_S3).length, 32);
  assert.deepEqual(Object.keys(DAMAGE_INDICES_S3).sort(), Object.keys(S3_TERMINAL_SETTINGS).sort());
  assert.equal(DAMAGE_INDEX_S3_INFO.densityKgM3, WOUND_S2_VALUES.softDensityKgM3);
  assert.equal(DAMAGE_INDEX_S3_INFO.uncalibratedCartridges, 82);
  assert.equal(DEBUG_AMMO_COLUMN_COUNT, 24, 'all original 17 columns retained, seven added; original damage column relabeled');
  for (const row of debugAmmoRows()) {
    assert.equal(row.damage, CATALOG.AMMO_REGISTRY[row.id].ballistic.damage, 'original reference damage remains exact');
    assert.equal(row.damageIndex, damageIndexS3(row.id), 'material changes reuse the one eager cache');
    assert.equal(Boolean(row.damageIndex), Object.hasOwn(S3_TERMINAL_SETTINGS, row.id));
  }
  assert.equal(damageIndexS3('762x39_ps'), null);
  assert.ok(Object.isFrozen(DAMAGE_INDICES_S3));
});

test('both distance indices use one M855 10 m reference and the exact production first-30-cm channel', () => {
  const reference = DAMAGE_INDICES_S3['556_m855'];
  assert.equal(reference.near.index, 100);
  assert.ok(reference.near.index > reference.far.index, 'the far column is not independently normalized to 100');
  for (const [ammoId, row] of Object.entries(DAMAGE_INDICES_S3)) for (const key of ['near', 'far']) {
    const block = row[key];
    const actual = computeWoundChannel({ ammoId, entryVelocityMps: block.entryVelocityMps,
      massKg: CATALOG.AMMO_REGISTRY[ammoId].projectile.massG / 1000, lengthM: .3, bodyPart: 'chest' });
    assert.equal(block.effectiveVolumeCm3, actual.volumes.effectiveM3 * 1e6, `${ammoId}/${key}: live channel volume`);
    assert.equal(block.index, actual.volumes.effectiveM3 * 1e6 / reference.near.effectiveVolumeCm3 * 100);
    assert.equal(row.referenceVolumeCm3, reference.near.effectiveVolumeCm3);
    assert.ok(block.stopped && block.stopDepthM > 0, `${ammoId}/${key}: total standard block stopping depth observed`);
    assert.ok(['plate', 'family', 'estimate'].includes(row.grade));
  }
});

test('reference flight speeds, threshold ranges and block measurements are reproducible and read only', () => {
  const catalogBefore = JSON.stringify(CATALOG);
  for (const ammoId of ['556_m855', '545_ps_gs', '545_bs_gs', '545_us_gs', '556_hp']) {
    const cached = DAMAGE_INDICES_S3[ammoId], flight = damageIndexFlightS3(ammoId);
    assert.deepEqual(flight, cached.flight);
    assert.ok(flight.impacts[10].velocityMps < CATALOG.AMMO_REGISTRY[ammoId].ballistic.velocity);
    assert.ok(flight.impacts[300].velocityMps < flight.impacts[10].velocityMps);
    assert.ok(flight.impacts[300].heightM < flight.impacts[10].heightM);
    assert.deepEqual(damageIndexBlockS3(ammoId, cached.near.entryVelocityMps), Object.fromEntries(Object.entries(cached.near).filter(([key]) => !['distanceM', 'index'].includes(key))));
    if (flight.effectEndRangeM !== null) assert.ok(flight.effectEndRangeM >= 0 && flight.effectEndRangeM < flight.observedHorizontalLimitM);
  }
  assert.equal(JSON.stringify(CATALOG), catalogBefore);
});
