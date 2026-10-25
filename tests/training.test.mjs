import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { readFile } from 'node:fs/promises';
import { AimState } from '../apps/training/src/aim.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { MARKERS, STEP } from '../apps/training/src/config.js';
import { AIM_DEFAULTS, AIM_PRESETS, cleanSettings } from '../apps/training/src/settings.js';
import { shotBallistics } from '../apps/training/src/catalog.js';

const movement = (x, y, crouch = false) => ({ move: { x, y }, crouch, sprint: false });
test('player collides with low cover and remains on the floor', async () => {
  const physics = await createPhysics();
  try {
    for (let i = 0; i < 450; i++) physics.step(movement(0, -1), 0);
    assert.ok(physics.feet.z > -1.3 && physics.feet.z < -0.8, `Unexpected cover contact: ${physics.feet.z}`);
    assert.ok(Math.abs(physics.feet.y) < 0.04);
    assert.equal(physics.grounded, true);
    physics.reset();
    for (let i = 0; i < 500; i++) physics.step(movement(-1, 0), 0);
    assert.ok(physics.feet.x > -8.65 && physics.feet.x < -8.25);
  } finally { physics.dispose(); }
});
test('stance keeps the feet fixed and can recover standing', async () => {
  const physics = await createPhysics();
  try {
    for (let i = 0; i < 30; i++) physics.step(movement(0, 0), 0);
    const y = physics.feet.y;
    physics.step(movement(0, 0, true), 0);
    assert.equal(physics.crouched, true); assert.ok(Math.abs(physics.feet.y - y) < 0.03);
    physics.step(movement(0, 0, false), 0);
    assert.equal(physics.crouched, false); assert.ok(Math.abs(physics.feet.y - y) < 0.03);
  } finally { physics.dispose(); }
});
test('nearest shot contact respects cover and actual muzzle direction', async () => {
  const physics = await createPhysics();
  try {
    const standing = physics.ray(new Vector3(0, 1.4, 5), new Vector3(0, 0, -1));
    assert.equal(standing.id, 'T01');
    const crouched = physics.ray(new Vector3(0, 0.9, 5), new Vector3(0, 0, -1));
    assert.equal(crouched.id, 'low-cover');
    assert.equal(physics.muzzleBlocked(new Vector3(0, 1.4, -16.5), new Vector3(0, 1.4, -17.1), new Vector3(0, 0, -1)), true);
  } finally { physics.dispose(); }
});
test('free aim moves the gun independently and recoil affects subsequent shots', () => {
  const aim = new AimState();
  aim.look(28, -10, false);
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: false, reloading: false, blocked: false };
  for (let i = 0; i < 6; i++) aim.step(STEP, controls);
  assert.ok(Math.abs(aim.freeYaw) > 0.02);
  assert.ok(Math.abs(aim.weaponYaw - aim.viewYaw) > 0.005);
  const fired = aim.shotPose();
  aim.onShot(shotBallistics('556_m855'), 1);
  assert.deepEqual(aim.shotPose().direction.toArray(), fired.direction.toArray(), 'A confirmed shot must not change after its impulse');
  aim.step(STEP, controls);
  assert.ok(aim.recoil > 0); assert.notDeepEqual(aim.shotPose().direction.toArray(), fired.direction.toArray());
  assert.ok(Math.abs(fired.direction.length() - 1) < 1e-9);
});
test('close ADS aligns measured sights at rest and recovers from recoil at oblique angles', () => {
  const aim = new AimState({ ...AIM_DEFAULTS, breath: 0 });
  aim.look(-180, 85, true);
  const camera = new PerspectiveCamera(52, 844 / 390, 0.015, 65);
  let time = 0;
  function gap() {
    camera.position.copy(aim.eye); camera.rotation.set(aim.viewPitch, aim.viewYaw, 0, 'YXZ'); camera.updateMatrixWorld(true);
    const rear = aim.sight.clone().project(camera), front = aim.frontSight.clone().project(camera);
    return Math.hypot((rear.x - front.x) * 422, (rear.y - front.y) * 195);
  }
  function step() { aim.step(STEP, { feet: new Vector3(2, 0, -3), viewHeight: 1.43, time: time += STEP, speed: 0, ads: true, reloading: false, blocked: false }); }
  for (let i = 0; i < 330; i++) step();
  assert.ok(gap() < 1e-6); assert.ok(aim.eye.distanceTo(aim.sight) < 0.08);
  aim.onShot(shotBallistics('556_m855'), 1); step(); assert.ok(gap() > 2, 'The rifle impulse must briefly disturb sight alignment');
  for (let i = 0; i < 180; i++) step();
  assert.ok(gap() < 0.001, 'Sight alignment must recover after the impulse');
  assert.ok(aim.ads > 0.999);
  assert.ok(aim.muzzle.y < aim.sight.y - 0.04);
  assert.ok(MARKERS.muzzle[2] < 0);
});
test('ADS front sight leads the rear aperture, retains bounded mount lag and settles on the sight line', () => {
  const aim = new AimState({ ...AIM_DEFAULTS, breath: 0 });
  const camera = new PerspectiveCamera(52, 844 / 390, 0.015, 65);
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: true, reloading: false, blocked: false };
  const screen = point => { const p = point.clone().project(camera); return [p.x * 422, p.y * 195]; };
  const step = () => { aim.step(STEP, controls); camera.position.copy(aim.eye); camera.rotation.set(aim.viewPitch, aim.viewYaw, 0, 'YXZ'); camera.updateMatrixWorld(true); };
  for (let i = 0; i < 180; i++) step();
  const rearBefore = screen(aim.sight), frontBefore = screen(aim.frontSight);
  aim.look(40, -8, true); step();
  const travel = (point, before) => Math.hypot(...screen(point).map((x, i) => x - before[i]));
  assert.ok(travel(aim.frontSight, frontBefore) > 2);
  assert.ok(travel(aim.sight, rearBefore) < travel(aim.frontSight, frontBefore) * .2, 'The front post moves before the rear aperture');
  for (let i = 0; i < 40; i++) { step(); assert.ok(Math.hypot(aim.sightLagYaw, aim.sightLagPitch) <= 0.022 + 1e-9); }
  for (let i = 0; i < 180; i++) step();
  assert.ok(Math.hypot(...screen(aim.sight).map((x, i) => x - screen(aim.frontSight)[i])) < 0.001);
});
test('walking gives the rifle position and roll motion, disturbs ADS and settles when stopped', () => {
  const aim = new AimState({ ...AIM_DEFAULTS, breath: 0 });
  const camera = new PerspectiveCamera(52, 844 / 390, 0.015, 65);
  let time = 0;
  const step = (ads, speed) => { aim.step(STEP, { feet: new Vector3(), viewHeight: 1.43, time: time += STEP, speed, ads, reloading: false, blocked: false }); };
  for (let i = 0; i < 180; i++) step(false, 0);
  const idle = aim.position.clone(), positions = [], orientations = [];
  for (let i = 0; i < 180; i++) { step(false, 2.7); if (i > 60) { positions.push(aim.position.clone()); orientations.push(aim.quaternion.clone()); } }
  const range = axis => Math.max(...positions.map(p => p[axis])) - Math.min(...positions.map(p => p[axis]));
  assert.ok(range('x') > 0.025); assert.ok(range('y') > 0.03 && range('y') < 0.048, 'Vertical travel should remain visible with the reduced walking amplitude');
  assert.ok(orientations.some(q => q.angleTo(orientations[0]) > 0.05));
  const phase = aim.gaitPhase;
  for (let i = 0; i < 180; i++) step(false, 0);
  assert.equal(aim.gaitPhase, phase, 'Walking cycles must stop when the player cannot travel');
  assert.ok(aim.position.distanceTo(idle) < 1e-6);
  for (let i = 0; i < 180; i++) step(true, 0);
  const gaps = [];
  for (let i = 0; i < 180; i++) {
    step(true, 2.7); camera.position.copy(aim.eye); camera.rotation.set(aim.viewPitch, aim.viewYaw, 0, 'YXZ'); camera.updateMatrixWorld(true);
    const rear = aim.sight.clone().project(camera), front = aim.frontSight.clone().project(camera);
    gaps.push(Math.hypot((rear.x - front.x) * 422, (rear.y - front.y) * 195));
  }
  assert.ok(Math.max(...gaps) > 5); assert.ok(Math.max(...gaps) < 12, 'Sight displacement remains bounded while walking');
  for (let i = 0; i < 180; i++) step(true, 0);
  assert.ok(Math.hypot(aim.sightLagYaw, aim.sightLagPitch) < 1e-6);
});
test('larger hip weapon shares its scale with shot attachments and returns to calibrated ADS size', () => {
  const normal = new AimState({ ...AIM_DEFAULTS, breath: 0, weaponSize: 100 });
  const large = new AimState({ ...AIM_DEFAULTS, breath: 0 });
  const raised = new AimState({ ...AIM_DEFAULTS, breath: 0, weaponHeight: 4 });
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: false, reloading: false, blocked: false };
  for (const aim of [normal, large, raised]) aim.step(STEP, controls);
  assert.ok(Math.abs(large.sight.distanceTo(large.frontSight) / normal.sight.distanceTo(normal.frontSight) - 1.15) < 1e-9);
  assert.ok(Math.abs(large.shotPose().origin.distanceTo(large.breech) / normal.shotPose().origin.distanceTo(normal.breech) - 1.15) < 1e-9);
  assert.equal(large.viewYaw, normal.viewYaw); assert.equal(large.viewPitch, normal.viewPitch);
  assert.ok(Math.abs(raised.muzzle.y - large.muzzle.y - 0.05) < 1e-9, 'Weapon height must move both the model pose and the shot origin');
  for (let i = 0; i < 180; i++) for (const aim of [normal, large, raised]) aim.step(STEP, { ...controls, ads: true });
  assert.ok(Math.abs(large.scale - 1) < 1e-9);
  assert.ok(large.frontSight.distanceTo(normal.frontSight) < 1e-9);
  assert.ok(raised.sight.distanceTo(large.sight) < 1e-9, 'Hip height must not shift the calibrated ADS eye point');
});
test('weapon leads the body camera, lag is bounded and camera catches up after input stops', () => {
  const aim = new AimState({ ...AIM_DEFAULTS, breath: 0, walkSway: 0 });
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: false, reloading: false, blocked: false };
  aim.look(120, -30, false);
  for (let i = 0; i < 6; i++) aim.step(STEP, controls);
  assert.ok(Math.abs(aim.weaponYaw) > Math.abs(aim.viewYaw) * 2);
  const initialLag = Math.hypot(aim.freeYaw, aim.freePitch);
  for (let i = 0; i < 140; i++) aim.step(STEP, controls);
  assert.ok(Math.hypot(aim.freeYaw, aim.freePitch) < initialLag * 0.02);
  aim.look(2000, -2000, false);
  for (let i = 0; i < 15; i++) { aim.step(STEP, controls); assert.ok(Math.hypot(aim.freeYaw, aim.freePitch) <= 20 * Math.PI / 180 + 1e-9); }
});
test('hip sensitivity and independent ADS multiplier control the same drag', () => {
  const settings = { ...AIM_DEFAULTS, breath: 0, walkSway: 0 };
  const slow = new AimState({ ...settings, sensitivity: 50 }), fast = new AimState({ ...settings, sensitivity: 150 });
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: false, reloading: false, blocked: false };
  slow.look(30, 0, false); fast.look(30, 0, false);
  for (let i = 0; i < 30; i++) { slow.step(STEP, controls); fast.step(STEP, controls); }
  assert.ok(Math.abs(fast.weaponYaw / slow.weaponYaw - 3) < 1e-6);
  const lowADS = new AimState({ ...settings, adsSensitivity: 25 }), highADS = new AimState({ ...settings, adsSensitivity: 100 });
  lowADS.look(30, 0, true); highADS.look(30, 0, true);
  for (let i = 0; i < 30; i++) { lowADS.step(STEP, { ...controls, ads: true }); highADS.step(STEP, { ...controls, ads: true }); }
  assert.ok(Math.abs(highADS.weaponYaw / lowADS.weaponYaw - 4) < 1e-6);
});
test('camera presets change the following rate and saved preferences reject invalid values', () => {
  const steady = new AimState({ ...AIM_DEFAULTS, ...AIM_PRESETS.steady, breath: 0, walkSway: 0 });
  const bodycam = new AimState({ ...AIM_DEFAULTS, ...AIM_PRESETS.bodycam, breath: 0, walkSway: 0 });
  const controls = { feet: new Vector3(), viewHeight: 1.43, time: 0, speed: 0, ads: false, reloading: false, blocked: false };
  for (const aim of [steady, bodycam]) { aim.look(70, 0, false); for (let i = 0; i < 12; i++) aim.step(STEP, controls); }
  assert.ok(Math.abs(bodycam.freeYaw) > Math.abs(steady.freeYaw) * 2);
  const repaired = cleanSettings({ sensitivity: 5000, adsSensitivity: 'oops', cameraFollow: -10, fov: NaN, unknown: true });
  assert.equal(repaired.sensitivity, 200); assert.equal(repaired.cameraFollow, 1); assert.equal(repaired.adsSensitivity, 55); assert.equal(repaired.fov, 66); assert.equal('unknown' in repaired, false);
  assert.equal(repaired.weaponSize, 115); assert.equal(repaired.weaponHeight, -1); assert.equal(repaired.weaponMotion, 100, 'Older saved settings must receive the new motion default');
  const older = cleanSettings({ sensitivity: 85, adsSensitivity: 42 });
  assert.equal(older.sensitivity, 85); assert.equal(older.adsSensitivity, 42); assert.equal(older.weaponSize, 115); assert.equal(older.weaponHeight, -1);
  assert.equal(older.trajectories, false); assert.equal(cleanSettings({ trajectories: true }).trajectories, true);
  assert.equal(cleanSettings({ trajectories: 'true' }).trajectories, false);
  assert.equal(older.mouseAdsMode, 'toggle', 'Old preferences retain the existing right-click toggle');
  assert.equal(cleanSettings({ mouseAdsMode: 'hold' }).mouseAdsMode, 'hold');
  assert.equal(cleanSettings({ mouseAdsMode: 'toggle' }).mouseAdsMode, 'toggle');
  for (const mouseAdsMode of [true, null, 'invalid']) assert.equal(cleanSettings({ mouseAdsMode }).mouseAdsMode, 'toggle');
});
test('prepared model keeps only one weapon and one casing with embedded textures', async () => {
  const raw = await readFile(new URL('../apps/training/assets/m4a1-training.glb', import.meta.url));
  assert.equal(raw.toString('ascii', 0, 4), 'glTF'); assert.equal(raw.readUInt32LE(8), raw.length);
  const json = JSON.parse(raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)));
  assert.equal(json.meshes.length, 22);
  assert.deepEqual(json.scenes[0].nodes.map(index => json.nodes[index].name), ['M4A1', 'SpentCasing']);
  assert.equal(json.images.length, 6); assert.ok(json.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.equal(json.asset.extras.license.startsWith('CC-BY-4.0'), true);
});
