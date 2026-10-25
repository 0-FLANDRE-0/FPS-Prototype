import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { BODY_PARTS, BODY_PROFILE, HUMAN_TARGETS, HumanHitLog, actorRotation, worldPoint, resolveBodyAddress } from '../apps/training/src/human-targets.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { traceShot as traceWithProtection } from '../apps/training/src/ballistics.js';
import { shotBallistics } from '../apps/training/src/catalog.js';
import { cleanSettings } from '../apps/training/src/settings.js';
// Historical spatial fixtures: exercise geometry without the new protection execution.
const traceShot = (p,o,d,b,options={}) => traceWithProtection(p,o,d,b,{...options,geometryOnly:true});

const b = shotBallistics('556_m855'), actor = HUMAN_TARGETS[0];
const forward = new Vector3(0, 0, -1);
const shoot = (p, x, y, z = 0) => traceShot(p, new Vector3(actor.at[0] + x, y, z), forward, b);

test('all eight original medical parts and seventeen A-pose shapes resolve at real Rapier contacts', async () => {
  const foundation = await readFile(new URL('../reference/2d/src/medical/foundation.js', import.meta.url), 'utf8');
  const originalKeys = foundation.match(/const BODY_PART_KEYS = \[([^\]]+)\]/)[1].match(/'[^']+'/g).map(key => key.slice(1, -1));
  assert.deepEqual(BODY_PARTS, originalKeys);
  const p = await createPhysics();
  try {
    const parts = new Set();
    for (const shape of BODY_PROFILE.filter(s=>!s.joint)) {
      const local = shape.type === 'capsule' ? new Vector3(...shape.a).add(new Vector3(...shape.b)).multiplyScalar(0.5) : new Vector3(...shape.at);
      const result = shoot(p, local.x, local.y);
      assert.equal(result.reason, 'human', shape.id); assert.equal(result.hit.id, 'H01');
      assert.equal(result.hit.address.shapeId, shape.id); assert.equal(result.hit.address.bodyPart, shape.part);
      assert.equal(result.hit.address.side, 'front'); assert.equal(result.events.length, 0);
      assert.equal(result.residual.velocityMps, b.muzzleVelocityMps); assert.equal(result.residual.stability, 1);
      parts.add(result.hit.address.bodyPart);
    }
    assert.deepEqual([...parts].sort(), [...BODY_PARTS].sort()); assert.equal(BODY_PROFILE.filter(s=>!s.joint).length, 17); assert.equal(BODY_PROFILE.length,21);
    assert.equal(shoot(p, 0, 0.91).hit.address.zone, 'pelvis');
    assert.equal(shoot(p, 0, 0.91).hit.address.bodyPart, 'abdomen');
  } finally { p.dispose(); }
});

test('subzones distinguish face/skull, chest quadrants, shoulder/elbow, thigh/knee and hand/foot', async () => {
  const p = await createPhysics();
  try {
    const cases = [[0, 1.65, 'face', 'upper'], [0, 1.75, 'head', 'forehead'], [0.1, 1.4, 'chest', 'upper'],
      [-0.1, 1.25, 'chest', 'lower'], [0.22, 1.44, 'left_arm', 'shoulder'], [0.385, 1.215, 'left_arm', 'elbow'],
      [0.445, 1.10, 'left_arm', 'forearm'], [0.565, 0.958, 'left_arm', 'hand_wrist'],
      [0.12, 0.69, 'left_leg', 'mid_thigh'], [0.14, 0.535, 'left_leg', 'knee'], [0.17, 0.30, 'left_leg', 'lower_leg'], [0.19, 0.07, 'left_leg', 'foot_ankle']];
    for (const [x, y, part, zone] of cases) {
      const address = shoot(p, x, y).hit.address;
      assert.equal(address.hitPart, part, `${x},${y}`); assert.equal(address.zone, zone, `${x},${y}`);
    }
    assert.equal(shoot(p, 0.1, 1.4).hit.address.subZone, 'left');
    assert.equal(shoot(p, -0.1, 1.25).hit.address.subZone, 'right');
  } finally { p.dispose(); }
});

test('front/rear and anatomical left/right follow actor yaw and final incoming direction', () => {
  const shape = BODY_PROFILE.find(item => item.id === 'left-forearm');
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
    const rotated = { ...actor, yaw }, point = worldPoint(rotated, [0.48, 1.1, 0.07]);
    for (const [incoming, side] of [[[0, 0, -1], 'front'], [[0, 0, 1], 'rear'], [[-1, 0, 0], 'left'], [[1, 0, 0], 'right']]) {
      const direction = new Vector3(...incoming).applyQuaternion(actorRotation(rotated));
      const address = resolveBodyAddress(rotated, shape, point, direction);
      assert.equal(address.bodyPart, 'leftArm'); assert.equal(address.side, side);
      assert.ok(new Vector3(...address.localPoint).distanceTo(new Vector3(0.48, 1.1, 0.07)) < 1e-10);
    }
  }
});

test('rays through limb gaps and outside the silhouette never count a human hit or hit movement capsule', async () => {
  const p = await createPhysics();
  try {
    for (const [x, y] of [[0, 0.40], [0, 0.68], [0.32, 1.07], [0.9, 1.4]]) {
      const result = shoot(p, x, y); assert.notEqual(result.hit?.kind, 'human', `${x},${y}`);
      assert.notEqual(result.hit?.kind, 'human-movement');
    }
    const rear = traceShot(p, new Vector3(17, 1.4, -8), new Vector3(0, 0, 1), b);
    assert.equal(rear.hit.address.side, 'rear');
    for (const [x, direction, side] of [[19, new Vector3(-1, 0, 0), 'left'], [15, new Vector3(1, 0, 0), 'right']]) {
      const result = traceShot(p, new Vector3(x, 1.3, -4), direction, b);
      assert.equal(result.hit.address.side, side);
    }
  } finally { p.dispose(); }
});

test('cover penetration preserves original residuals at body entry and stops before any tissue processing', async () => {
  for (const [x, material, outcome] of [[11.5, 'drywall', 'penetrated'], [21.5, 'concrete', 'spent']]) {
    const p = await createPhysics({ humanTargets: [{ ...actor, at: [x, 0, -19] }] });
    try {
      const result = traceShot(p, new Vector3(x, 1.34, -8), forward, b, { random: () => 0.65 });
      assert.equal(result.events[0].material, material); assert.equal(result.events[0].outcome, 'penetrated');
      if (outcome === 'penetrated') {
        assert.equal(result.reason, 'human'); assert.equal(result.hit.flightState, 'penetrated');
        assert.deepEqual(result.residual, result.events.at(-1).after); assert.ok(result.residual.stability < 1);
        const segment = result.segments.at(-1), expected = new Vector3(...segment.to).sub(new Vector3(...segment.from)).normalize();
        assert.ok(expected.distanceTo(result.hit.incomingDirection) < 1e-10);
        assert.ok(result.hit.incomingDirection.distanceTo(forward) > 1e-4, 'Signed post-penetration wobble reaches the body resolver');
      } else { assert.equal(result.reason, 'spent'); assert.equal(result.hit.kind, 'barrier'); }
    } finally { p.dispose(); }
  }
});

test('ricochet into a body retains the reflected direction, state and original decay', async () => {
  const origin = new Vector3(23.2, 1.34, -15.94), direction = new Vector3(1, 0, -0.1).normalize();
  const shootRic = p => { const rolls = [0.999, 0, 0.5]; return traceShot(p, origin, direction, b, { random: () => rolls.shift() ?? 0.5 }); };
  const first = await createPhysics({ humanTargets: [] });
  let placement;
  try {
    const baseline = shootRic(first), segment = baseline.segments[1];
    const incoming = new Vector3(...segment.to).sub(new Vector3(...segment.from)).normalize();
    const center = new Vector3(...segment.from).addScaledVector(incoming, 2);
    placement = [center.x, center.y - 1.34, center.z];
  } finally { first.dispose(); }
  const p = await createPhysics({ humanTargets: [{ ...actor, at: placement }] });
  try {
    const result = shootRic(p);
    assert.equal(result.events[0].outcome, 'ricochet'); assert.equal(result.reason, 'human');
    assert.equal(result.hit.flightState, 'ricochet'); assert.equal(result.hit.address.side, 'right');
    assert.deepEqual(result.residual, result.events[0].after);
    assert.ok(result.hit.incomingDirection.z > 0, 'Body receives reflected ray rather than the original aim');
  } finally { p.dispose(); }
});

test('ballistic limb sensors do not widen movement collision or block standing; body capsule does', async () => {
  const p = await createPhysics();
  const move = { move: { x: 0, y: -1 }, crouch: false, sprint: false };
  const place = x => {
    p.body.setTranslation({ x, y: 0.89, z: -2.5 }, true); p.body.setNextKinematicTranslation({ x, y: 0.89, z: -2.5 });
    p.world.propagateModifiedBodyPositionsToColliders(); p.world.step(); p.sync(); p.velocity.set(0, 0, 0);
  };
  try {
    place(17.59); for (let i = 0; i < 140; i++) p.step(move, 0);
    assert.ok(p.feet.z < -5, 'Player can pass under the outstretched hand sensors');
    p.stance(true); p.stance(false); assert.equal(p.crouched, false);
    place(17); for (let i = 0; i < 140; i++) p.step(move, 0);
    assert.ok(p.feet.z > -3.6, 'The separate central capsule keeps the player out of the model');
  } finally { p.dispose(); }
});

test('hit journal counts once, bounds history, snapshots are detached, and reset clears observations', async () => {
  const p = await createPhysics(), log = new HumanHitLog();
  try {
    const trace = shoot(p, 0.445, 1.10), event = { shotId: 1, time: 1, hit: trace.hit, trace, ammoId: b.ammoId, ballistics: b };
    const record = log.record(event); assert.equal(record.address.bodyPart, 'leftArm'); assert.equal(record.residual.velocityMps, b.muzzleVelocityMps);
    assert.equal(log.record(event), null); assert.equal(log.snapshot().counts.H01, 1);
    record.address.zone = 'corrupted'; const snapshot = log.snapshot(); snapshot.history[0].residual.damage = -1;
    assert.equal(log.snapshot().history[0].address.zone, 'forearm'); assert.ok(log.snapshot().history[0].residual.damage > 0);
    for (let shotId = 2; shotId <= 90; shotId++) log.record({ ...event, shotId });
    assert.equal(log.snapshot().history.length, 64); assert.equal(log.snapshot().counts.H01, 90);
    log.reset(); assert.deepEqual(log.snapshot().history, []); assert.equal(log.snapshot().counts.H01, 0);
    assert.ok(log.record(event));
  } finally { p.dispose(); }
});

test('soldier keeps original embedded asset and attribution; older preferences default hit regions off', async () => {
  const raw = await readFile(new URL('../apps/training/assets/soldier-character.glb', import.meta.url));
  const credits = JSON.parse(await readFile(new URL('../apps/training/assets/soldier-credits.json', import.meta.url)));
  assert.equal(createHash('sha256').update(raw).digest('hex'), credits.sourceSha256);
  const json = JSON.parse(raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)));
  assert.equal(json.meshes.length, 5); assert.equal(json.images.length, 9);
  assert.ok(json.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.equal(json.skins?.length || 0, 0); assert.equal(json.animations?.length || 0, 0);
  assert.ok(json.asset.extras.license.includes('CC-BY-4.0'));
  assert.equal(cleanSettings({ trajectories: true }).hitRegions, false);
  assert.equal(cleanSettings({ hitRegions: 'true' }).hitRegions, false);
  assert.equal(cleanSettings({ hitRegions: true }).hitRegions, true);
});
