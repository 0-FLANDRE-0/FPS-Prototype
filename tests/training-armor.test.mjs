import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scene, Vector3 } from 'three';
import { createPhysics } from '../apps/training/src/physics.js';
import { traceShot as traceWithProtection } from '../apps/training/src/ballistics.js';
import { CATALOG, shotBallistics } from '../apps/training/src/catalog.js';
import { HUMAN_TARGETS, HumanHitLog, actorRotation, worldPoint } from '../apps/training/src/human-targets.js';
import { ARMOR_PROFILE, armorPose, armorVertices, armorIndices } from '../apps/training/src/armor-targets.js';
import { createArmorRegions } from '../apps/training/src/armor-model.js';
import { cleanSettings } from '../apps/training/src/settings.js';
import { meshTriangles, solidMeshIntervals } from '../apps/training/src/armor-geometry.js';

// Historical spatial fixtures: exercise geometry without the new protection execution.
const traceShot = (p,o,d,b,options={}) => traceWithProtection(p,o,d,b,{...options,geometryOnly:true});

const b = shotBallistics('556_m855'), actor = HUMAN_TARGETS[0], forward = new Vector3(0, 0, -1);
const shoot = (p, x = 0, y = 1.335) => traceShot(p, new Vector3(17 + x, y, 0), forward, b);
const ids = result => result.armorContacts.map(contact => contact.layerId);
const near = (a, b, tolerance = 0.002) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);

test('front/rear plates are separate sensors; actual order ends at body entry rather than rear equipment', async () => {
  const p = await createPhysics();
  try {
    const front = shoot(p), rear = traceShot(p, new Vector3(17, 1.335, -8), forward.clone().negate(), b);
    assert.deepEqual(ids(front), ['plate-front', 'soft-front']); assert.deepEqual(ids(rear), ['plate-rear', 'soft-rear']);
    assert.equal(front.hit.address.bodyPart, 'chest'); assert.equal(rear.hit.address.side, 'rear');
    for (const result of [front, rear]) {
      const plate = result.armorContacts.find(c => c.kind === 'plate'), soft = result.armorContacts.find(c => c.kind === 'soft');
      assert.ok(plate.exitDistance < result.hit.distance); assert.ok(soft.entryDistance < result.hit.distance);
      near(plate.losMm, 15); assert.ok(plate.completeExit);
      assert.equal(plate.protectionOrder, 0); assert.equal(soft.protectionOrder, 1);
      if (result === front) { assert.ok(soft.entryDistance < plate.entryDistance); assert.equal(soft.physicalOrder, 0); }
      assert.equal(soft.geometry, 'mesh-surface'); assert.equal(soft.losMm, null); assert.equal(soft.thicknessMm, null);
      assert.equal(soft.exitDistance, null); assert.equal(soft.pathLengthM, null);
      assert.notEqual(plate.ownerId, soft.ownerId); assert.equal(result.events.length, 0);
      assert.deepEqual(plate.residual, result.residual); assert.deepEqual(soft.residual, result.residual);
    }
    assert.notEqual(front.armorContacts.find(c => c.kind === 'plate').ownerId, rear.armorContacts.find(c => c.kind === 'plate').ownerId);
    assert.equal(front.armorContacts.find(c => c.kind === 'soft').ownerId, rear.armorContacts.find(c => c.kind === 'soft').ownerId, 'Vest panels share one future soft-armor instance');
    assert.ok(p.armorSensors.every(({ collider }) => collider.isSensor()));
  } finally { p.dispose(); }
});

test('source coverage includes protectors and preserves collar opening, armpit gaps and excluded knees', async () => {
  const p = await createPhysics();
  try {
    for (const [x, y] of [[0.10, 1.445], [0, 1.14]]) {
      const result = shoot(p, x, y); assert.equal(result.reason, 'human'); assert.deepEqual(ids(result), ['soft-front']);
    }
    assert.deepEqual(ids(shoot(p, 0, .91)), ['soft-groin']);
    for (const [x, id] of [[.22, 'soft-shoulder-left'], [-.22, 'soft-shoulder-right']]) {
      const result = shoot(p, x, 1.34); assert.equal(result.hit.address.bodyPart, x > 0 ? 'leftArm' : 'rightArm');
      assert.deepEqual(ids(result), [id]); assert.equal(result.armorContacts[0].itemId, '6b45_shoulder');
    }
    const neck = traceShot(p, new Vector3(17, 1.535, -8), forward.clone().negate(), b);
    assert.equal(neck.hit.address.bodyPart, 'neck'); assert.deepEqual(ids(neck), ['soft-neck']);
    assert.equal(neck.armorContacts[0].itemId, '6b45_neck');
    for (const [x, y] of [[0, 1.65], [.49, 1.085], [.11, .50]]) assert.deepEqual(ids(shoot(p, x, y)), []);
    assert.deepEqual(p.armorContacts(new Vector3(17, 2, -4), new Vector3(0, -1, 0), .55).filter(c => c.kind === 'soft'), [], 'Original collar opening has no artificial cap');
    const armpit = p.armorContacts(new Vector3(17.20, 1.25, 0), forward, 4.4);
    assert.deepEqual(armpit, [], 'No triangles bridge the arm/torso gap');
    const graze = shoot(p, .18, 1.11); assert.notEqual(graze.hit?.kind, 'human'); assert.ok(graze.armorContacts.length);
    assert.equal(new HumanHitLog().record({ shotId: 1, hit: graze.hit, trace: graze }), null);
  } finally { p.dispose(); }
});

test('actor rotation and anatomical sides transform independent panel/plate mounts together', async () => {
  const rotated = { ...actor, yaw: Math.PI / 2 }, p = await createPhysics({ humanTargets: [rotated] });
  try {
    const front = traceShot(p, worldPoint(rotated, [0, 1.335, 2]), forward.clone().applyQuaternion(actorRotation(rotated)), b);
    assert.deepEqual(ids(front), ['plate-front', 'soft-front']); assert.equal(front.hit.address.side, 'front');
    near(front.armorContacts.find(c => c.kind === 'plate').localPoint[2], 0.150, 0.00001);
    // Aim behind the A-pose arms; a side ray at z=0 hits the arm first.
    const left = traceShot(p, worldPoint(rotated, [2, 1.11, -0.05]), new Vector3(-1, 0, 0).applyQuaternion(actorRotation(rotated)), b);
    const right = traceShot(p, worldPoint(rotated, [-2, 1.11, -0.05]), new Vector3(1, 0, 0).applyQuaternion(actorRotation(rotated)), b);
    assert.deepEqual(ids(left), ['soft-left']); assert.deepEqual(ids(right), ['soft-right']);
    assert.equal(left.hit.address.side, 'left'); assert.equal(right.hit.address.side, 'right');
  } finally { p.dispose(); }
});

test('LOS uses actual oblique chords, supports inside starts and clips at the next contact', async () => {
  const p = await createPhysics();
  try {
    const direction = new Vector3(1, 0, -1).normalize(), aim = new Vector3(17, 1.31, -3.850);
    const result = traceShot(p, aim.clone().addScaledVector(direction, -2), direction, b);
    const plate = result.armorContacts.find(contact => contact.layerId === 'plate-front');
    // Independent continuous-cylinder chord. Triangulation has a small bounded
    // approximation error; bending changes the old flat 19/cos(angle) chord.
    const shape = ARMOR_PROFILE.shapes.find(s => s.id === 'plate-front');
    const center = new Vector3(17, aim.y, -4 + shape.at[2] - shape.radius);
    const relative = aim.clone().sub(center), projection = relative.dot(direction);
    const root = radius => -projection - Math.sqrt(projection ** 2 - relative.lengthSq() + radius ** 2);
    const expected = (root(shape.radius - shape.thickness / 2) - root(shape.radius + shape.thickness / 2)) * 1000;
    near(plate.losMm, expected, .08); near(plate.incidenceDeg, 45, .7); assert.equal(plate.thicknessMm, 15);
    near(new Vector3(...plate.point).distanceTo(new Vector3(...plate.exitPoint)), plate.pathLengthM, 1e-10);
    const partial = p.armorContacts(new Vector3(17, 1.31, -3.8575), forward, 0.003)[0];
    assert.equal(partial.layerId, 'plate-front'); assert.equal(partial.startsInside, true); assert.equal(partial.completeExit, false);
    assert.equal(partial.incidenceDeg, null); near(partial.losMm, 3, 0.00001);
    assert.deepEqual(p.armorContacts(new Vector3(17, 1.335, 0), forward, 3), [], 'A sensor beyond the segment is not observed');
  } finally { p.dispose(); }
});

test('armor geometry adds no gameplay RNG, ballistic losses, movement obstruction or standing restriction', async () => {
  for (const [at, origin, randomValue] of [[[17, 0, -4], [17, 1.335, 0], 0.65], [[11.5, 0, -19], [11.5, 1.335, -8], 0.65], [[21.5, 0, -19], [21.5, 1.335, -8], 0.65]]) {
    const plain = await createPhysics({ humanTargets: [{ ...actor, at }], armorProfile: null });
    const armored = await createPhysics({ humanTargets: [{ ...actor, at }] });
    try {
      const run = p => { let rolls = 0; const result = traceShot(p, new Vector3(...origin), forward, b, { random: () => { rolls++; return randomValue; } }); return { result, rolls }; };
      const baseline = run(plain), observed = run(armored);
      assert.equal(observed.rolls, baseline.rolls); assert.ok(baseline.rolls || observed.result.reason === 'human');
      const withoutArmor = ({ armorContacts, ...result }) => result;
      assert.deepEqual(withoutArmor(observed.result), withoutArmor(baseline.result));
      if (at[0] === 11.5) {
        assert.ok(observed.result.armorContacts.length > 0);
        for (const contact of observed.result.armorContacts) {
          assert.equal(contact.flightState, 'penetrated'); assert.deepEqual(contact.residual, observed.result.residual);
          assert.deepEqual(contact.incomingDirection, observed.result.hit.incomingDirection.toArray());
        }
      }
      if (at[0] === 21.5) assert.deepEqual(observed.result.armorContacts, [], 'Stopped cover prevents armor contacts behind it');
      const r1 = plain.ray(new Vector3(at[0], 1.335, at[2] + 1), forward, 2);
      const r2 = armored.ray(new Vector3(at[0], 1.335, at[2] + 1), forward, 2);
      assert.deepEqual(r2, r1); assert.equal(r2.kind, 'human-movement');
      for (const p of [plain, armored]) { p.stance(true); p.stance(false); assert.equal(p.crouched, false); }
    } finally { plain.dispose(); armored.dispose(); }
  }
});

test('ricochet armor contacts use the reflected path and residual state without an extra protection roll', async () => {
  const origin = new Vector3(23.2, 1.335, -15.94), direction = new Vector3(1, 0, -0.1).normalize();
  const run = p => { const rolls = [0.999, 0, 0.5]; let count = 0;
    return { trace: traceShot(p, origin, direction, b, { random: () => { count++; return rolls.shift() ?? 0.5; } }), get count() { return count; } }; };
  const empty = await createPhysics({ humanTargets: [] }); let placement;
  try {
    const baseline = run(empty), air = baseline.trace.segments.find(segment => segment.medium === 'air' && segment.state === 'ricochet');
    const reflected = new Vector3(...air.to).sub(new Vector3(...air.from)).normalize();
    const point = new Vector3(...air.from).addScaledVector(reflected, 1.1);
    placement = { ...actor, at: [point.x, 0, point.z], yaw: Math.atan2(-reflected.x, -reflected.z) };
  } finally { empty.dispose(); }
  const plain = await createPhysics({ humanTargets: [placement], armorProfile: null }), armored = await createPhysics({ humanTargets: [placement] });
  try {
    const baseline = run(plain), observed = run(armored), result = observed.trace;
    assert.equal(result.reason, 'human'); assert.deepEqual(ids(result), ['plate-front', 'soft-front']);
    assert.equal(observed.count, baseline.count); assert.deepEqual(result.residual, baseline.trace.residual);
    assert.equal(result.hit.address.side, 'front'); assert.equal(result.hit.flightState, 'ricochet');
    for (const contact of result.armorContacts) {
      assert.equal(contact.flightState, 'ricochet'); assert.deepEqual(contact.incomingDirection, result.hit.incomingDirection.toArray());
      assert.deepEqual(contact.residual, result.events[0].after);
    }
  } finally { plain.dispose(); armored.dispose(); }
});

test('shared diagnostic geometry matches sensor transforms and legacy metadata; settings and records remain detached', async () => {
  const scene = new Scene(), view = createArmorRegions(scene), p = await createPhysics(), log = new HumanHitLog();
  try {
    const metadata = view.snapshot(); assert.equal(metadata.diagnosticShapes, 14); assert.equal(metadata.softVisible, false); assert.equal(metadata.platesVisible, false);
    assert.equal(metadata.profile.plate.thicknessMm, CATALOG.PLATE_REGISTRY.plate_granit_br4.thickness.thicknessMm);
    assert.equal(metadata.profile.plate.ratingMode, 'icw'); assert.equal(metadata.profile.soft.armorValue, 32);
    for (const { shape, collider } of p.armorSensors) {
      const group = scene.getObjectByName(`${shape.kind}ArmorRegions`), mesh = group.children.find(child => child.isMesh && child.name === `H01:${shape.id}`);
      const pose = armorPose(actor, shape); assert.ok(mesh.position.distanceTo(pose.position) < 1e-10);
      assert.ok(mesh.quaternion.angleTo(pose.rotation) < 1e-7);
      assert.ok(mesh.position.distanceTo(new Vector3(...Object.values(collider.translation()))) < 1e-6);
      {
        assert.deepEqual(mesh.geometry.attributes.position.array, armorVertices(shape));
        assert.deepEqual(mesh.geometry.index.array, armorIndices(shape));
        assert.equal(collider.shapeType(), 6); // Rapier TriMesh, never a filled convex hull.
      }
    }
    const cleaned = cleanSettings({ trajectories: true, softArmorRegions: true, plateRegions: 'true' });
    assert.equal(cleaned.softArmorRegions, true); assert.equal(cleaned.plateRegions, false); assert.equal(cleanSettings({}).softArmorRegions, false);
    view.setVisible(true, false); assert.equal(view.snapshot().softVisible, true); assert.equal(view.snapshot().platesVisible, false);
    const trace = shoot(p), event = { shotId: 1, time: 1, hit: trace.hit, trace, ammoId: b.ammoId, ballistics: b };
    const record = log.record(event); assert.deepEqual(record.armorContacts, trace.armorContacts); assert.equal(log.record(event), null);
    record.armorContacts[0].itemId = 'corrupt'; metadata.profile.shapes[0].triangleCount = 99;
    assert.equal(log.snapshot().history[0].armorContacts[0].itemId, 'plate_granit_br4'); assert.equal(ARMOR_PROFILE.shapes[0].triangleCount, 485);
    log.reset(); assert.equal(log.snapshot().counts.H01, 0); assert.deepEqual(log.snapshot().history, []);
    view.dispose(); assert.equal(scene.children.length, 0);
  } finally { p.dispose(); }
});

test('source-derived front neck surface covers the throat while retaining the collar opening', async () => {
  const p = await createPhysics();
  try {
    const neck = shoot(p, 0, 1.51);
    assert.equal(neck.hit.address.bodyPart, 'neck'); assert.deepEqual(ids(neck), ['soft-neck-front']);
    const contact = neck.armorContacts[0]; assert.equal(contact.itemId, '6b45_neck'); assert.equal(contact.armorValue, 33);
    assert.equal(contact.thicknessMm, null); assert.equal(contact.losMm, null);
    assert.ok(contact.entryDistance < neck.hit.distance);
    assert.deepEqual(ids(shoot(p, 0, 1.55)), [], 'Exposed neck above the front protector stays exposed');
    assert.deepEqual(p.armorContacts(new Vector3(17, 2, -4), new Vector3(0, -1, 0), .55).filter(c => c.kind === 'soft'), [], 'No top cap added');
  } finally { p.dispose(); }
});

test('only front plate is lowered; both inward curved shells are watertight and preserve hollow-back material intervals', async () => {
  const p = await createPhysics();
  try {
    for (const shape of ARMOR_PROFILE.shapes.filter(s => s.kind === 'plate'&&['front','rear'].includes(s.slot))) {
      assert.equal(shape.at[1], shape.slot === 'front' ? 1.31 : 1.335);
      assert.ok(Math.abs(shape.at[2]) < .1485); assert.equal(shape.thickness, .015);
      const vertices = armorVertices(shape), indices = armorIndices(shape), edges = new Map();
      for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = indices[i + j], b = indices[i + (j + 1) % 3], key = [Math.min(a, b), Math.max(a, b)].join(':');
        const edge = edges.get(key) || { count: 0, orientation: 0 }; edge.count++; edge.orientation += a < b ? 1 : -1; edges.set(key, edge);
      }
      for (const edge of edges.values()) { assert.equal(edge.count, 2); assert.equal(edge.orientation, 0); }
      for (let i = 0; i < vertices.length; i += 3) {
        const radius = Math.hypot(vertices[i], vertices[i + 2] + shape.radius);
        near(Math.abs(radius - shape.radius), shape.thickness / 2, 1e-8);
      }
      const pose = armorPose(actor, shape), hollow = new Vector3(0, 0, -.015);
      const short = solidMeshIntervals(meshTriangles(vertices, indices), hollow, new Vector3(1, 0, 0), .01);
      assert.deepEqual(short, [], 'Concave center is empty, not a convex hull');
      const origin = new Vector3(-.3, 0, -.015), direction = new Vector3(1, 0, 0);
      const contacts = p.armorContacts(origin.clone().applyQuaternion(pose.rotation).add(pose.position), direction.clone().applyQuaternion(pose.rotation), .6);
      const plate = contacts.find(c => c.layerId === shape.id);
      assert.equal(plate.materialIntervals.length, 2); assert.equal(plate.startsInside, false);
      const intervals = plate.materialIntervals;
      assert.ok(intervals[1].entryDistance - intervals[0].exitDistance > .15);
      near(plate.pathLengthM, intervals.reduce((n, c) => n + c.exitDistance - c.entryDistance, 0), 1e-10);
      assert.ok(plate.pathLengthM < plate.exitDistance - plate.entryDistance - .15, 'LOS excludes the central air gap');
    }
    assert.deepEqual(ids(shoot(p, 0, 1.465)), ['soft-neck-front'], 'Lowered front top no longer reaches the protector');
  } finally { p.dispose(); }
});
