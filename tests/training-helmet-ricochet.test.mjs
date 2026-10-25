import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { parse } from 'acorn';
import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion } from 'three';
import { CATALOG, shotBallistics } from '../apps/training/src/catalog.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { traceShot } from '../apps/training/src/ballistics.js';
import { createLegacyProtection } from '../apps/training/src/generated/legacy-protection.js';
import { helmetRicochetCandidate, helmetShotRandom } from '../apps/training/src/helmet-ricochet.js';
import { TrainingMedical } from '../apps/training/src/medical.js';

const b = shotBallistics('556_m855'), direction = new Vector3(0, 0, -1);
const fixtures = [{ degree: 'clean', x: -.125 }, { degree: 'scrape', x: -.12 }, { degree: 'gouge', x: -.115 }];
const origin = f => new Vector3(17 + f.x, 1.69, 0);
const shoot = (p, f, options = {}) => traceShot(p, origin(f), direction, b, { random: () => .0001, maxDistance: 7, ...options });
const state = () => ({ pen: 46, velocity: 879, initialVelocity: 879, damage: 52, stability: 1, barrierCount: 0, ammo: CATALOG.AMMO_PRESETS['556_m855'] });
const contact = deg => ({ kind: 'helmet', itemId: 'helmet_6b47_test', material: 'aramid', incomingDirection: [Math.sin(deg * Math.PI / 180), 0, -Math.cos(deg * Math.PI / 180)], normal: [0, 0, 1] });
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('helmet ammo/material ricochet traits match unchanged original CQB for every cartridge', async () => {
  const source = await readFile(new URL('../reference/2d/src/combat/impact-address.js', import.meta.url), 'utf8');
  const names = ['HELMET_ZONE_CURVATURE', 'getMaterialRicochetMul', 'computeRicochetHint'];
  const body = parse(source, { ecmaVersion: 2022 }).body.filter(n => names.includes(n.id?.name || n.declarations?.[0]?.id?.name));
  assert.equal(body.length, 3);
  const vm = createContext({}); runInContext(body.map(n => source.slice(n.start, n.end)).join('\n'), vm);
  const legacy = createLegacyProtection();
  for (const ammo of Object.values(CATALOG.AMMO_PRESETS)) for (const material of ['aramid', 'pe', 'steel', 'titanium', 'composite']) {
    const address = { armorLayer: 'helmet', coverageZone: 'helmetShell', material };
    vm.address = address; vm.ammo = ammo;
    assert.deepEqual(legacy.computeRicochetHint(address, ammo, 'stopped'), JSON.parse(JSON.stringify(runInContext("computeRicochetHint(address, ammo, 'stopped')", vm))));
  }
});

test('only grazing incidence enables helmet ricochet; angle, remaining condition and normal overmatch bound its chance', () => {
  const legacy = createLegacyProtection(), candidate = (deg, armor = 15, durability = 1) => helmetRicochetCandidate(contact(deg), state(), armor, 46, durability, legacy);
  for (const angle of [0, 30, 54, 55]) assert.equal(candidate(angle).eligible, false);
  assert.ok(candidate(60).chance < candidate(70).chance); assert.ok(candidate(70).chance <= candidate(85).chance);
  assert.ok(candidate(75, 15, .5).chance < candidate(75).chance); assert.equal(candidate(75, 15, 0).eligible, false);
  assert.equal(candidate(60, 1).eligible, false);
  for (const extra of [{ itemId: 'no_helmet' }, { exitingSurface: true }, { exitingHead: true }, { startsInside: true }, { normal: [0, 0, 0] }])
    assert.equal(helmetRicochetCandidate({ ...contact(80), ...extra }, state(), 15, 46, 1, legacy).eligible, false);
  assert.equal(helmetRicochetCandidate(contact(80), { ...state(), pen: 0 }, 15, 46, 1, legacy).eligible, false);
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1.23), c = contact(75);
  near(helmetRicochetCandidate({ ...c, normal: new Vector3(...c.normal).applyQuaternion(rotation).toArray(),
    incomingDirection: new Vector3(...c.incomingDirection).applyQuaternion(rotation).toArray() }, state(), 15, 46, 1, legacy).chance, candidate(75).chance);
});

test('real helmet mesh produces clean/scrape/gouge deflections with increasing wear and decreasing speed, no liner entry or energy gain', async () => {
  const p = await createPhysics(), shots = [];
  try {
    for (const f of fixtures) {
      p.reset(); const r = shoot(p, f), h = r.armorResults.find(c => c.outcome === 'ricochet');
      assert.ok(h); assert.equal(h.ricochet.degree, f.degree); assert.equal(r.bodyHits.length, 0);
      assert.equal(r.armorResults.length, 2); assert.equal(r.armorResults[1].outcome, 'not_reached');
      assert.equal(h.wear.resultKind, 'ricochet'); assert.equal(h.ricochet.continued, true);
      assert.ok(new Vector3(...h.ricochet.outgoingDirection).dot(new Vector3(...h.ricochet.surfaceNormal)) > 0);
      assert.ok(r.segments.some(s => s.medium === 'air' && s.state === 'ricochet'));
      near(h.ricochet.energyInJ, h.ricochet.energyOutJ + h.ricochet.energyDepositedJ);
      for (const key of ['penetration', 'velocityMps', 'damage', 'stability']) assert.ok(h.after[key] < h.before[key]);
      const wear = p.armorCondition.snapshot();
      for (const [id, d] of Object.entries(wear)) if (id !== h.ownerId) assert.equal(d.current, d.max);
      shots.push(h);
    }
    for (let i = 1; i < shots.length; i++) {
      assert.ok(shots[i].wear.globalAmount > shots[i - 1].wear.globalAmount);
      assert.ok(shots[i].wear.localAmount > shots[i - 1].wear.localAmount);
      assert.ok(shots[i].after.velocityMps < shots[i - 1].after.velocityMps);
    }
  } finally { p.dispose(); }
});

test('failed deflection falls through to shell/liner; exhausted shell does not roll deflection; reset/seed replay reproduce wear', async () => {
  const p = await createPhysics();
  try {
    const failed = shoot(p, fixtures[0], { random: () => .999 });
    assert.equal(failed.armorResults[0].outcome, 'penetrated'); assert.equal(failed.armorResults[0].ricochet.ricocheted, false);
    assert.equal(failed.armorResults[0].wear.resultKind, 'penetrated');
    assert.ok(failed.armorResults.find(r => r.integral && r.outcome !== 'not_reached'));
    p.reset(); p.armorCondition.target.armorDurability['H01:helmet-shell'].current = 0;
    const broken = shoot(p, fixtures[0]); assert.ok(broken.armorResults.every(r => r.outcome !== 'ricochet'));
    p.reset(); const a = shoot(p, fixtures[1], { random: undefined, shotId: 3 }), wear = p.armorCondition.snapshot();
    p.reset(); const c = shoot(p, fixtures[1], { random: undefined, shotId: 3 });
    assert.deepEqual(c, a); assert.deepEqual(p.armorCondition.snapshot(), wear);
  } finally { p.dispose(); }
});

test('shell winding rejects ricochet on a hollow exit and helmet RNG is independently reproducible', async () => {
  const p = await createPhysics();
  try {
    const exit = p.armorContacts(new Vector3(17, 1.71, -4), direction, 2).find(r => r.kind === 'helmet');
    assert.equal(exit.exitingSurface, true);
    const outside = p.armorContacts(new Vector3(16.88, 1.69, 0), direction, 7).find(r => r.kind === 'helmet');
    assert.equal(outside.exitingSurface, undefined);
    const rolls = Array.from({ length: 30 }, (_, i) => helmetShotRandom(i + 1)());
    assert.ok(rolls.some(r => r < .4)); assert.ok(rolls.some(r => r > .8));
    for (const id of [1, 3, 20]) {
      const a = helmetShotRandom(id), b = helmetShotRandom(id);
      assert.deepEqual(Array.from({ length: 20 }, a), Array.from({ length: 20 }, b));
    }
  } finally { p.dispose(); }
});

test('reflected projectile re-queries Rapier and can hit a separate downstream target', async () => {
  const p = await createPhysics();
  try {
    const initial = shoot(p, fixtures[0]), h = initial.armorResults[0], out = new Vector3(...h.ricochet.outgoingDirection);
    const center = new Vector3(...h.point).addScaledVector(out, .8);
    const collider = p.world.createCollider(RAPIER.ColliderDesc.cuboid(.05, .05, .05).setTranslation(center.x, center.y, center.z));
    p.surface.set(collider.handle, { id: 'ricochet-test-target', kind: 'target', definition: { at: center.toArray(), size: [.1, .1, .1] } });
    p.reset(); const r = shoot(p, fixtures[0]);
    assert.equal(r.hit.id, 'ricochet-test-target'); assert.equal(r.segments.at(-1).state, 'ricochet');
    assert.ok(r.hit.distance > h.distance); assert.ok(r.residual.penetration > 0);
  } finally { p.dispose(); }
});

test('deflection records bounded blunt response without skin entry or penetrating bleeding, and never repeats equipment wear', async () => {
  const p = await createPhysics(), pains = [];
  try {
    for (const f of fixtures) {
      p.reset(); const trace = shoot(p, f), m = new TrainingMedical(), before = JSON.stringify(trace), wear = p.armorCondition.snapshot();
      const event = { shotId: 1, time: 0, origin: origin(f), direction, ballistics: b, ammoId: b.ammoId, trace };
      const records = m.record(event, p);
      assert.equal(records.length, 1); assert.equal(records[0].skinContact, false); assert.ok(records[0].ricochet.ricocheted);
      assert.equal(records[0].damageEvent.armorResultRaw, 'deflected'); assert.equal(records[0].damageEvent.armorResult, 'stopped');
      assert.equal(m.actor.medical.externalBleedRate, 0); assert.equal(m.actor.medical.internalBleedRate, 0);
      for (let i = 1; i <= 60; i++) m.tick(1 / 60, i / 60);
      assert.equal(m.actor.medical.externalBleedRate, 0); assert.equal(m.actor.medical.internalBleedRate, 0);
      assert.deepEqual(m.validate(), []); assert.equal(JSON.stringify(trace), before); assert.deepEqual(p.armorCondition.snapshot(), wear);
      assert.deepEqual(m.record(event, p), []); pains.push(records[0].damageEvent.painAdd);
    }
    // The original medical model remains authoritative; full traces are independently repeatable.
    assert.ok(pains.every(Number.isFinite)); assert.ok(pains[0] < pains[1] && pains[1] < pains[2]);
  } finally { p.dispose(); }
});

test('a deflection into exposed anatomy preserves the later body hit and medical event order', async () => {
  const p = await createPhysics();
  try {
    const o = new Vector3(16.955, 1.68, 0);
    const trace = traceShot(p, o, direction, b, { random: () => .0001, maxDistance: 7 });
    assert.ok(trace.armorResults.some(r => r.outcome === 'ricochet')); assert.ok(trace.bodyHits.length);
    const m = new TrainingMedical(), records = m.record({ shotId: 1, time: 0, origin: o, direction, ballistics: b, ammoId: b.ammoId, trace }, p);
    assert.equal(records[0].skinContact, false); assert.ok(records.slice(1).some(r => r.skinContact));
    assert.deepEqual(records.map(r => r.order), records.map((_, i) => i + 1)); assert.deepEqual(m.validate(), []);
  } finally { p.dispose(); }
});
