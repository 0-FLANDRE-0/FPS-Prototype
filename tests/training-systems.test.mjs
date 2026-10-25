import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { extractCatalog } from '../scripts/training-catalog.mjs';
import { CATALOG, shotBallistics, catalogCounts, compatibleAmmo } from '../apps/training/src/catalog.js';
import { SOURCE_HASHES, TRAINING_PROFILES } from '../apps/training/src/generated/catalog.js';
import { Inventory, GRID_LAYOUTS, CRATE_OWNER, itemSize } from '../apps/training/src/inventory.js';
import { RecoilState, recoilImpulse } from '../apps/training/src/recoil.js';
import { AimState } from '../apps/training/src/aim.js';
import { Vector3 } from 'three';
import { AIM_DEFAULTS } from '../apps/training/src/settings.js';

function advance(inv, seconds = 6) { for (let t = 0; t < Math.ceil(seconds * 60); t++) inv.step(1 / 60); }
function conserved(inv) {
  const s = inv.snapshot();
  assert.equal(s.totalRounds + Object.values(s.spent).reduce((a, b) => a + b, 0), s.initialRounds);
  assert.equal(new Set(s.items.map(item => item.instanceId)).size, s.items.length);
  const byAmmo = Object.fromEntries(compatibleAmmo().map(id => [id, 0]));
  for (const item of s.items) {
    if (item.kind === 'ammo') byAmmo[item.definitionId] += item.count;
    if (item.kind === 'magazine') for (const id of item.rounds) byAmmo[id]++;
    if (item.kind === 'weapon' && item.chamber) byAmmo[item.chamber]++;
  }
  for (const id of compatibleAmmo()) assert.equal(byAmmo[id] + (s.spent[id] || 0), s.initialByAmmo[id]);
  for (const [owner, grid] of Object.entries(GRID_LAYOUTS)) {
    const occupied = new Set();
    for (const item of s.items.filter(i => i.owner === owner)) {
      assert.ok(item.cell); const { w, h } = itemSize(item);
      for (let y = item.cell.y; y < item.cell.y + h; y++) for (let x = item.cell.x; x < item.cell.x + w; x++) {
        assert.ok(x >= 0 && x < grid.cols && y >= 0 && y < grid.rows); assert.ok(!occupied.has(`${x},${y}`), 'No overlapping items'); occupied.add(`${x},${y}`);
      }
    }
  }
  for (const item of s.items) {
    if (item.kind === 'ammo') assert.ok(Number.isInteger(item.count) && item.count >= 0 && item.count <= 60);
    if (item.kind === 'magazine') {
      assert.ok(item.rounds.length <= 30); assert.ok(item.rounds.every(id => compatibleAmmo().includes(id)));
      if (item.owner.startsWith('weapon:')) assert.equal(inv.items.get(item.owner.slice(7)).magazineId, item.instanceId);
      if (item.owner === 'hand:reload') assert.equal(inv.action.incomingId, item.instanceId);
    }
    if (item.kind === 'weapon' && item.magazineId) assert.equal(inv.items.get(item.magazineId).owner, 'weapon:' + item.instanceId);
  }
}
test('all original registries and final source-switch tables match the unchanged source initialization', async () => {
  const original = await extractCatalog();
  assert.deepEqual(CATALOG, original.data); assert.deepEqual(SOURCE_HASHES, original.provenance);
  assert.deepEqual(TRAINING_PROFILES, original.trainingProfiles);
  assert.equal(catalogCounts().AMMO_REGISTRY, 114); assert.equal(catalogCounts().WEAPON_REGISTRY, 17);
  assert.equal(Object.keys(catalogCounts()).length, 12);
  assert.ok(CATALOG.AMMO_REGISTRY['556_m995_ap']); assert.ok(CATALOG.AMMO_PRESETS['556_m855'].terminalProfile);
  assert.ok(Object.isFrozen(CATALOG.AMMO_REGISTRY['556_m855'].projectile));
  // The shipped bundle carries one complete object, so unused definitions survive tree shaking.
  const generated = await readFile(new URL('../apps/training/src/generated/catalog.js', import.meta.url), 'utf8');
  assert.ok(generated.includes('HELMET_ACCESSORY_REGISTRY'));
});
test('barrel velocity is resolved once and energy stays separate from recoil momentum', () => {
  const b = shotBallistics('556_m855');
  assert.ok(Math.abs(b.projectileMassKg - 0.00402) < 1e-12); assert.equal(b.muzzleVelocityMps, 879);
  assert.equal(b.weaponMassKg, 3.07); assert.ok(Math.abs(b.projectileMomentumNs - 3.53358) < 1e-9);
  assert.equal(b.kinetics.initialMomentumNs, 3.534);
  assert.equal(b.kinetics.initialEnergyJ, +b.muzzleEnergyJ.toFixed(2));
  for (const id of compatibleAmmo()) assert.ok(shotBallistics(id).projectileMomentumNs > 0);
  assert.throws(() => shotBallistics('9mm_124gr'), /Unsupported/);
});
test('cartridges, magazines and an equipped weapon exist as separate instances; initial 30 means 29+1', () => {
  const inv = new Inventory({includeAK:false}); conserved(inv);
  assert.equal(inv.loadedRounds, 30); assert.equal(inv.magazine.rounds.length, 29); assert.equal(inv.weapon.chamber, '556_m855');
  assert.equal(inv.items.get('ammo:556_m855').count, 60);
  assert.equal(inv.unequip(), true); assert.equal(inv.loadedRounds, 0); assert.equal(inv.fire(), null);
  assert.equal(inv.items.get('mag-01').owner, 'weapon:weapon-01'); conserved(inv);
  assert.equal(inv.equip('weapon-01'), true); assert.equal(inv.loadedRounds, 30); conserved(inv);
});
test('automatic reload prefers any loaded bag magazine over empty or remembered choices; explicit insertion stays explicit', () => {
  const inv = new Inventory({includeAK:false}); inv.selectMagazine('mag-05');
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-02'); inv.cancel(); conserved(inv);
  assert.equal(inv.move('mag-02', 'bag', 3, 3), true);
  assert.equal(inv.move('mag-04', 'bag', 0, 0), true);
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-03', 'Skip the empty top-left magazine'); inv.cancel();
  assert.equal(inv.pack('mag-04', 'ammo:556_m193', 1), true); advance(inv, 1);
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-04', 'A single round at top-left beats a fuller magazine'); inv.cancel(); conserved(inv);
  assert.equal(inv.beginReload('mag-05'), true); assert.equal(inv.action.incomingId, 'mag-05', 'Explicitly choosing an empty magazine must still work');
  inv.cancel(); conserved(inv);
});
test('automatic reload reads grid rows before columns when all magazines are loaded, and uses the same order when all are empty', () => {
  const inv = new Inventory({includeAK:false});
  for (const id of ['mag-04', 'mag-05']) { assert.equal(inv.pack(id, 'ammo:556_m193', 1), true); advance(inv, 1); }
  assert.equal(inv.move('mag-02', 'bag', 3, 3), true); assert.equal(inv.move('mag-04', 'bag', 0, 0), true);
  inv.selectMagazine('mag-03');
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-04'); inv.cancel(); conserved(inv);
  assert.equal(inv.move('mag-04', 'bag', 5, 3), true);
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-03', 'Within the top row, choose the leftmost'); inv.cancel();
  assert.equal(inv.move('mag-03', 'bag', 2, 3), true);
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-05', 'An upper row wins over a lower magazine further left'); inv.cancel();
  for (const id of ['mag-02', 'mag-03', 'mag-04', 'mag-05']) { assert.equal(inv.unpack(id), true); advance(inv, 6); }
  assert.equal(inv.beginReload(), true); assert.equal(inv.action.incomingId, 'mag-05', 'Empty-only fallback follows the grid, too'); inv.cancel(); conserved(inv);
});
test('packing transfers actual cartridges in feed order; cancellation and unpacking preserve them', () => {
  const inv = new Inventory({includeAK:false});
  assert.equal(inv.pack('mag-01', '556_m193'), false, 'An installed magazine cannot be packed through the bag');
  assert.equal(inv.pack('mag-04', '9mm_124gr'), false);
  assert.equal(inv.pack('mag-04', '556_m855', 10), true); advance(inv, 0.6); inv.cancel();
  assert.equal(inv.items.get('mag-04').rounds.length, 4); assert.equal(inv.items.get('ammo:556_m855').count, 56); conserved(inv);
  inv.pack('mag-04', '556_m193', 10); advance(inv, 2);
  assert.equal(inv.items.get('mag-04').rounds[0], '556_m193'); assert.equal(inv.items.get('mag-04').rounds.length, 14);
  inv.unpack('mag-04'); advance(inv, 0.35); inv.cancel(); conserved(inv);
  inv.unpack('mag-04'); advance(inv, 5);
  assert.equal(inv.items.get('ammo:556_m193').count, 60); assert.equal(inv.items.get('ammo:556_m855').count, 60); conserved(inv);
});
test('tactical magazine swap retains the old chambered round and produces 30+1 without replacing its ammo ID', () => {
  const inv = new Inventory({includeAK:false}); assert.equal(inv.fire(), '556_m855');
  inv.selectMagazine('mag-02'); inv.beginReload(); assert.equal(inv.action.mode, 'tactical'); assert.equal(inv.action.duration, 2);
  advance(inv, 2.1); assert.equal(inv.loadedRounds, 31); assert.equal(inv.weapon.chamber, '556_m855');
  assert.equal(inv.magazine.rounds[0], '556_m193'); assert.equal(inv.items.get('mag-01').rounds.length, 28);
  assert.equal(inv.fire(), '556_m855'); assert.equal(inv.weapon.chamber, '556_m193'); assert.equal(inv.fire(), '556_m193'); conserved(inv);
});
test('magazine removal leaves a fireable chamber and supports a closed-bolt empty reload', () => {
  const inv = new Inventory({includeAK:false}); inv.removeMagazine(); advance(inv, 0.7);
  assert.equal(inv.magazine, null); assert.equal(inv.weapon.chamber, '556_m855');
  assert.equal(inv.fire(), '556_m855'); assert.equal(inv.fire(), null); assert.equal(inv.weapon.boltLocked, false);
  inv.beginReload('mag-02'); assert.equal(inv.action.mode, 'charging'); advance(inv, 3);
  assert.equal(inv.loadedRounds, 30); assert.equal(inv.magazine.rounds.length, 29); assert.equal(inv.weapon.chamber, '556_m193'); conserved(inv);
});
test('last shot locks the bolt; empty reload chambers one round and stays at 29+1', () => {
  const inv = new Inventory({includeAK:false}); for (let n = 0; n < 30; n++) assert.equal(inv.fire(), '556_m855');
  assert.equal(inv.weapon.chamber, null); assert.equal(inv.weapon.boltLocked, true);
  inv.beginReload('mag-03'); assert.equal(inv.action.mode, 'bolt-release'); assert.equal(inv.action.duration, 2.6);
  advance(inv, 1.6); assert.equal(inv.weapon.chamber, null); assert.equal(inv.magazine.rounds.length, 30);
  advance(inv, 1.1); assert.equal(inv.weapon.chamber, '556_mk262_mod1'); assert.equal(inv.magazine.rounds.length, 29); conserved(inv);
});
test('interrupting every reload stage preserves committed ownership and never manufactures rounds', () => {
  for (const empty of [false, true]) for (const seconds of [0.1, 0.7, 1.7, 2.3]) {
    const inv = new Inventory({includeAK:false}); if (empty) for (let n = 0; n < 30; n++) inv.fire();
    inv.beginReload('mag-02'); advance(inv, seconds); inv.cancel(); conserved(inv);
    assert.ok([...inv.items.values()].every(item => item.owner !== 'hand:reload'));
    if (!inv.weapon.chamber) { inv.rack(); advance(inv, 1.1); }
    conserved(inv);
    inv.beginReload('mag-03'); advance(inv, 3); conserved(inv);
  }
});
test('cycling a live chamber returns the cartridge to the bag and feeds the next round once', () => {
  const inv = new Inventory({includeAK:false}); inv.rack(); advance(inv, 1.1);
  assert.equal(inv.items.get('ammo:556_m855').count, 60);
  assert.equal([...inv.items.values()].find(i => i.owner === 'bag' && i.instanceId.startsWith('stack-')).count, 1);
  assert.equal(inv.magazine.rounds.length, 28); conserved(inv);
  inv.rack(); advance(inv, 0.4); inv.cancel(); assert.equal(inv.weapon.chamber, null); conserved(inv);
});
test('recoil follows momentum, not energy; raw impulse is independent of stance and viewmodel scale', () => {
  const light = shotBallistics('556_m193'), heavy = shotBallistics('556_mk262_mod1');
  const a = recoilImpulse(light, 1), b = recoilImpulse(heavy, 1);
  assert.ok(Math.abs(b.impulseNs / a.impulseNs - heavy.projectileMomentumNs / light.projectileMomentumNs) < 1e-12);
  assert.ok(Math.abs(a.rearVelocityMps - a.impulseNs / light.weaponMassKg) < 1e-12);
  const standing = new RecoilState(), crouched = new RecoilState();
  standing.impulse(light, 1); crouched.impulse(light, 1, { crouched: true });
  assert.deepEqual(standing.lastImpulse, crouched.lastImpulse);
  for (let i = 0; i < 180; i++) { standing.step(1 / 60); crouched.step(1 / 60, { crouched: true }); }
  assert.ok(crouched.pitch < standing.pitch);
  const normal = new AimState({ ...AIM_DEFAULTS }), large = new AimState({ ...AIM_DEFAULTS, weaponSize: 155, weaponHeight: 4 });
  assert.deepEqual(normal.onShot(light, 1), large.onShot(light, 1));
});
test('partial stabilization leaves a controllable residual; a new target and manual compensation are never pulled back to an old angle', () => {
  const r = new RecoilState(); r.impulse(shotBallistics('556_m855'), 1); let peak = 0;
  for (let n = 0; n < 180; n++) { r.step(1 / 60); peak = Math.max(peak, r.pitch); }
  assert.ok(r.pitch > 0 && r.pitch < peak * 0.02); assert.ok(Math.abs(r.rear) < 1e-9);
  r.compensate(-r.pitch, 'pitch'); for (let n = 0; n < 180; n++) r.step(1 / 60);
  assert.ok(Math.abs(r.pitch) < 1e-9); assert.equal(r.holdPitch, 0);
  const aim = new AimState({ ...AIM_DEFAULTS, breath: 0 });
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: true, reloading: false, blocked: false };
  aim.onShot(shotBallistics('556_m855'), 1); for (let i = 0; i < 90; i++) aim.step(1 / 60, controls);
  const oldAngle = aim.weaponPitch; aim.look(-80, 90, true);
  for (let i = 0; i < 180; i++) aim.step(1 / 60, controls);
  assert.ok(aim.weaponPitch < oldAngle - 0.08); assert.ok(aim.weaponYaw > 0.1); assert.ok(Math.abs(aim.recoil) < 1e-8);
});
test('early manual input consumes automatic recovery instead of doubling the downward correction', () => {
  const r = new RecoilState(); r.impulse(shotBallistics('556_m855'), 1);
  for (let n = 0; n < 5; n++) r.step(1 / 60);
  const before = r.pitch, residual = r.holdPitch, settled = r.settledPitch;
  const correction = Math.min(0.01, before - residual);
  assert.equal(r.compensate(-correction, 'pitch'), 0); assert.equal(r.holdPitch, residual);
  for (let n = 0; n < 180; n++) { r.step(1 / 60); assert.ok(r.pitch >= settled - 1e-6); }
  assert.ok(Math.abs(r.pitch - settled) < 1e-8);
  const fully = new RecoilState(); fully.impulse(shotBallistics('556_m855'), 1);
  for (let n = 0; n < 10; n++) fully.step(1 / 60);
  assert.ok(fully.pitchVelocity < 0, 'Already recovering before the player compensates');
  fully.compensate(-fully.pitch, 'pitch');
  for (let n = 0; n < 180; n++) { fully.step(1 / 60); assert.ok(Math.abs(fully.pitch) < 1e-9, 'Full correction must not undershoot during automatic recovery'); }
});
test('repeated shot impulses accumulate deterministically and substep results do not depend on display cadence', () => {
  const a = new RecoilState(), b = new RecoilState(), ballistics = shotBallistics('556_m855');
  let shot = 0;
  for (let t = 0; t < 300; t++) {
    if (t < 100 && t % 5 === 0) { a.impulse(ballistics, ++shot); b.impulse(ballistics, shot); }
    a.step(1 / 60); b.step(1 / 120); b.step(1 / 120);
    assert.ok(Number.isFinite(a.pitch) && Number.isFinite(a.yaw));
  }
  assert.ok(a.pitch > 0.02 && a.pitch < 0.05); assert.ok(Math.abs(a.pitch - b.pitch) < 1e-12); assert.ok(Math.abs(a.yaw - b.yaw) < 1e-12);
});
test('sustained uncorrected fire stops at the aim travel limit without hiding accumulated correction behind it', () => {
  const aim = new AimState({ ...AIM_DEFAULTS, breath: 0 }), ballistics = shotBallistics('556_m855');
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: true, reloading: false, blocked: false };
  for (let t = 0; t < 900; t++) {
    if (t % 5 === 0) aim.onShot(ballistics, t / 5 + 1);
    aim.step(1 / 60, controls);
    assert.ok(aim.weaponPitch <= 1.4); assert.ok(aim.recoil <= 1.4 + 1e-9);
  }
  const top = aim.weaponPitch; aim.look(0, 100, true); aim.step(1 / 60, controls);
  assert.ok(aim.weaponPitch < top - 0.05, 'The first downward drag must move the rifle away from the limit');
});

test('single shots recover strongly, automatic bursts recover less, and an AUTO tap still behaves as a single shot', () => {
  const ballistics = shotBallistics('556_m855'), single = new RecoilState(), tap = new RecoilState(), burst = new RecoilState();
  let singlePeak = 0, burstPeak = 0;
  for (let t = 0; t < 240; t++) {
    if (!t) { single.impulse(ballistics, 1, { fireMode: 'semi' }); tap.impulse(ballistics, 1, { fireMode: 'full' }); }
    if (t < 50 && t % 5 === 0) burst.impulse(ballistics, t / 5 + 1, { fireMode: 'full' });
    for (const r of [single, tap, burst]) r.step(1 / 60);
    singlePeak = Math.max(singlePeak, single.pitch); burstPeak = Math.max(burstPeak, burst.pitch);
  }
  assert.equal(single.pitch, tap.pitch); assert.equal(tap.profile, 'single'); assert.equal(burst.profile, 'burst');
  assert.ok(single.pitch < singlePeak * 0.02, 'Single shot returns over 98% of its excursion');
  assert.ok(burst.pitch < burstPeak * 0.15, 'Burst returns over 85% after releasing fire');
  assert.ok(burst.pitch > single.pitch * 10); assert.deepEqual(single.lastImpulse, tap.lastImpulse);
  burst.impulse(ballistics, 11, { fireMode: 'full' }); assert.equal(burst.profile, 'single', 'A new isolated tap gets the strong response again');
});
test('grid footprints enforce two-cell magazines, eight-cell stored rifles, bounds and occupied destinations', () => {
  const inv = new Inventory({includeAK:false}); assert.equal(inv.carriedRounds(), 810); assert.equal(inv.reserveRounds, 780);
  assert.equal(inv.totalRounds(), 1530); assert.deepEqual(itemSize(inv.magazine), { w: 1, h: 2 });
  assert.equal(inv.move('mag-04', 'bag', 2, 4), false); assert.equal(inv.move('mag-04', 'bag', 4, 2), false);
  assert.equal(inv.move('mag-04', 'bag', 2, 3), true); conserved(inv);
  inv.reset(); assert.equal(inv.unequip({ x: 3, y: 3 }), false); assert.equal(inv.unequip({ x: 2, y: 3 }), true);
  assert.equal(inv.items.get('mag-01').owner, 'weapon:weapon-01'); assert.equal(inv.carriedRounds(), 810);
  assert.equal(inv.equip('weapon-01'), true); conserved(inv);
});
test('crate transfers preserve instances and split a merge at the 60-round stack limit', () => {
  const inv = new Inventory({includeAK:false}), id = 'crate:556_m855';
  assert.equal(inv.move(id, 'bag', 2, 3), false, 'Cannot reach a closed crate'); inv.openContainer(CRATE_OWNER);
  inv.pack('mag-04', 'ammo:556_m855', 10); advance(inv, 2);
  const before = inv.carriedRounds(); assert.equal(inv.move(id, 'bag', 4, 1), true);
  assert.equal(inv.items.get('ammo:556_m855').count, 60); assert.equal(inv.items.get(id).count, 50);
  assert.equal(inv.items.get(id).owner, CRATE_OWNER); assert.equal(inv.carriedRounds(), before + 10);
  assert.equal(inv.move(id, 'bag', 4, 1), false); assert.equal(inv.move(id, 'bag', 2, 3), true);
  assert.equal(inv.items.get(id).owner, 'bag'); assert.equal(inv.carriedRounds(), before + 60);
  assert.equal(inv.move(id, CRATE_OWNER, 2, 2), true); conserved(inv);
  inv.openContainer(); assert.equal(inv.move(id, 'bag', 3, 3), false); conserved(inv);
  inv.openContainer(CRATE_OWNER); const crateCell=inv.findCell(CRATE_OWNER,inv.items.get('mag-05')); assert.ok(crateCell); assert.equal(inv.move('mag-05', CRATE_OWNER, crateCell.x, crateCell.y),true);
  assert.equal(inv.beginReload('mag-05'), false, 'An explicit crate magazine cannot silently select another bag magazine');
});
test('packing directly from an open crate commits each round and closing it cancels the remaining transfer', () => {
  const inv = new Inventory({includeAK:false}); inv.openContainer(CRATE_OWNER);
  assert.equal(inv.pack('mag-04', 'crate:556_m855a1'), true); advance(inv, 0.6);
  assert.equal(inv.items.get('mag-04').rounds.length, 4); assert.equal(inv.items.get('crate:556_m855a1').count, 56);
  inv.openContainer(); assert.equal(inv.action, null); advance(inv, 5); assert.equal(inv.items.get('mag-04').rounds.length, 4); conserved(inv);
});
function fillBag(inv, leave = []) {
  inv.openContainer(CRATE_OWNER);
  for (const item of [...inv.items.values()].filter(i => i.owner === CRATE_OWNER)) {
    let cell = inv.findCell('bag', item);
    if (cell && leave.some(c => c.x === cell.x && c.y === cell.y)) {
      const options = [];
      for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) if (!leave.some(c => c.x === x && c.y === y) && inv.canPlace('bag', item, { x, y })) options.push({ x, y });
      cell = options[0];
    }
    if (cell) inv.move(item.instanceId, 'bag', cell.x, cell.y);
  }
}
test('full bags reject removal, reload and cartridge returns before changing ownership or losing ammunition', () => {
  const inv = new Inventory({includeAK:false}); fillBag(inv); conserved(inv);
  assert.equal(inv.removeMagazine(), false); assert.equal(inv.beginReload('mag-02'), false);
  assert.equal(inv.rack(), false); assert.equal(inv.unpack('mag-02'), false);
  assert.equal(inv.weapon.magazineId, 'mag-01'); assert.equal(inv.weapon.chamber, '556_m855'); assert.equal(inv.action, null); conserved(inv);
});
test('reload reservations keep incoming and outgoing storage valid at every cancellation phase', () => {
  for (const seconds of [0, 0.3, 0.7, 1.1, 1.4, 1.9, 2.1]) {
    const inv = new Inventory({includeAK:false}); fillBag(inv, [{ x: 2, y: 3 }, { x: 2, y: 4 }]);
    assert.equal(inv.beginReload('mag-02'), true); advance(inv, seconds);
    if (inv.action) assert.equal(inv.move('ammo:556_m855', 'bag', 0, 0), false, 'Moves cannot steal reserved space');
    inv.cancel(); conserved(inv); assert.ok([...inv.items.values()].every(i => i.owner !== 'hand:reload'));
  }
});
test('mixed cartridge return planning is atomic when there is insufficient space; empty reservations are removed on cancel', () => {
  const inv = new Inventory({includeAK:false}); inv.pack('mag-04', '556_m855', 1); advance(inv, 1);
  inv.pack('mag-04', '556_m193', 1); advance(inv, 1);
  inv.rack(); advance(inv, 1.1); fillBag(inv); conserved(inv);
  const before = inv.snapshot().items; assert.equal(inv.unpack('mag-04'), false, 'M193 has space, but M855 needs a new cell: no partial unpack');
  assert.equal(inv.rack(), false);
  assert.deepEqual(inv.snapshot().items, before);
  const spare = new Inventory({includeAK:false}); spare.rack(); spare.cancel();
  assert.ok([...spare.items.values()].every(i => i.kind !== 'ammo' || i.count > 0)); conserved(spare);
  spare.unpack('mag-02'); advance(spare, 0.25); spare.cancel();
  assert.ok([...spare.items.values()].every(i => i.kind !== 'ammo' || i.count > 0)); conserved(spare);
});
