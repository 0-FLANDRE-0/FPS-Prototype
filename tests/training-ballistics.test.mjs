import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { Vector3 } from 'three';
import { extractBallistics } from '../scripts/training-ballistics.mjs';
import { createLegacyBallistics } from '../apps/training/src/generated/legacy-ballistics.js';
import { traceShot, boxInterval } from '../apps/training/src/ballistics.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { CATALOG, shotBallistics, compatibleAmmo } from '../apps/training/src/catalog.js';
import { RANGE_LANES, BARRIERS, BOXES } from '../apps/training/src/config.js';

const root = new URL('../', import.meta.url),referenceRoot=new URL('../reference/2d/',import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
async function originalContext() {
  const context = createContext({ console: { log() {}, warn() {} } });
  const manifest = JSON.parse(await readFile(new URL('src/manifest.json', referenceRoot), 'utf8'));
  for (const { path } of manifest.scripts) {
    runInContext(await readFile(new URL(path, referenceRoot), 'utf8'), context, { timeout: 5000, filename: path });
    if (path === 'src/data/ammunition-registry.js') break;
  }
  const game = await readFile(new URL('src/runtime/game-state.js', referenceRoot), 'utf8');
  runInContext(game.slice(0, game.indexOf('const GAME =')), context);
  runInContext(await readFile(new URL('src/combat/ballistics.js', referenceRoot), 'utf8'), context);
  runInContext('Math.random = () => 0.5', context);
  return context;
}
test('generated barrier helpers retain unchanged source declarations and match original VM fixtures for every M4 ammo/material', async () => {
  const extracted = await extractBallistics();
  assert.equal(await readFile(new URL('apps/training/src/generated/legacy-ballistics.js', root), 'utf8'), extracted.source);
  const original = await originalContext(), legacy = createLegacyBallistics(() => 0.5);
  for (const ammoId of compatibleAmmo()) for (const material of Object.keys(legacy.BARRIER_MATERIAL_PROPS)) {
    const ammo = CATALOG.AMMO_PRESETS[ammoId], ammoBarrier = legacy.getAmmoBarrier(ammo);
    const state = { pen: ammo.penetration, velocity: 879, initialVelocity: 879, damage: ammo.damage, stability: 0.8, barrierCount: 2, ammo, ammoBarrier };
    const barrier = { material, nominalThicknessM: 0.3 };
    const ctx = { entryT: 32, exitT: 32 + 0.42 * 32, incidentDeg: 44 };
    original.fixture = { ammoId, state: plain(state), barrier, ctx };
    const expected = plain(runInContext(`(() => {
      const s = fixture.state, effective = computeBarrierEffectiveArmor(fixture.barrier, fixture.ctx);
      const probability = penetrationProbability(s.pen * s.ammoBarrier.barrierPenMul - effective.effectiveArmor);
      const chance = calcRicochetChance({incidentAngleRad: 1.2, material: fixture.barrier.material, ammoBarrier: s.ammoBarrier, impactVel: s.velocity, initialVel: s.initialVelocity, effectivePen: s.pen, barrierResistance: effective.effectiveArmor});
      const before = _applyBarrierLoss(s, fixture.barrier.material, effective.effectiveArmor);
      const wobble = applyLegacyPenetrationWobble(1, 0, s);
      return { effective, probability, chance, before, after: s, wobble, dead: _shotIsDead(s) };
    })()`, original));
    const effective = legacy.computeBarrierEffectiveArmor(barrier, ctx);
    const probability = legacy.penetrationProbability(state.pen * ammoBarrier.barrierPenMul - effective.effectiveArmor);
    const chance = legacy.calcRicochetChance({ incidentAngleRad: 1.2, material, ammoBarrier, impactVel: state.velocity, initialVel: state.initialVelocity, effectivePen: state.pen, barrierResistance: effective.effectiveArmor });
    const before = legacy._applyBarrierLoss(state, material, effective.effectiveArmor);
    assert.deepEqual(plain({ effective, probability, chance, before, after: state, wobble: legacy.applyLegacyPenetrationWobble(1, 0, state), dead: legacy._shotIsDead(state) }), expected);
  }
});
test('3D box chord handles an angled sheet, rotated box, miss, parallel ray and inside origin', () => {
  const definition = { at: [0, 1.5, 0], size: [6, 3, 0.3] };
  const origin = new Vector3(0, 1.5, 2), direct = boxInterval(origin, new Vector3(0, 0, -1), definition);
  assert.ok(Math.abs(direct.exit - direct.entry - 0.3) < 1e-10);
  const oblique = boxInterval(origin, new Vector3(1, 0, -1).normalize(), definition);
  assert.ok(Math.abs(oblique.exit - oblique.entry - 0.3 * Math.SQRT2) < 1e-10);
  const edge = boxInterval(origin, new Vector3(1, 0, -1).normalize(), { ...definition, size: [4, 3, 0.3] });
  assert.ok(Math.abs(edge.exit - edge.entry - 0.15 * Math.SQRT2) < 1e-10, 'A clipped edge chord is shorter than thickness/cos(angle)');
  const rotated = boxInterval(origin, new Vector3(0, 0, -1), { ...definition, yaw: Math.PI / 4 });
  assert.ok(Math.abs(rotated.exit - rotated.entry - 0.3 * Math.SQRT2) < 1e-10);
  assert.equal(boxInterval(new Vector3(8, 1.5, 2), new Vector3(0, 0, -1), definition), null);
  const inside = boxInterval(new Vector3(0, 1.5, 0), new Vector3(0, 0, -1), definition);
  assert.equal(inside.inside, true); assert.equal(inside.entry, 0); assert.equal(inside.exit, 0.15);
});
test('thin barrier reaches the target once; hard barriers stop it, open-space target retains muzzle state', async () => {
  const p = await createPhysics();
  try {
    const b = shotBallistics('556_m855'), shoot = lane => traceShot(p, new Vector3(lane.x, 1.5, lane.firingZ), new Vector3(0, 0, -1), b, { random: () => 0.5 });
    for (const lane of RANGE_LANES.slice(0, 4)) {
      const t = shoot(lane); assert.equal(t.hit.id, `T-${lane.id}`); assert.equal(t.events.length, lane.plies.length);
      assert.equal(t.events[0].outcome, 'penetrated'); assert.ok(t.residual.velocityMps < b.muzzleVelocityMps);
      assert.ok(Math.abs(t.events[0].pathLenM - lane.plies[0].thicknessM) < 0.0001);
      assert.ok(t.events[0].exitPoint[2] < t.events[0].point[2]);
      assert.deepEqual(t.segments.map(segment => segment.state), ['initial', ...Array(lane.plies.length * 2).fill('penetrated')]);
      assert.equal(t.segments[1].medium, 'barrier'); assert.deepEqual(t.segments[1].to, t.events[0].exitPoint);
      assert.ok(t.segments[2].stability < 1);
    }
    for (const lane of RANGE_LANES.slice(4, 6)) { const t = shoot(lane); assert.equal(t.reason, 'spent'); assert.equal(t.hit.kind, 'barrier'); }
    const direct = traceShot(p, new Vector3(0, 1.5, 5), new Vector3(0, 0, -1), b);
    assert.equal(direct.hit.id, 'T01'); assert.equal(direct.events.length, 0); assert.equal(direct.residual.velocityMps, b.muzzleVelocityMps);
    assert.deepEqual(direct.segments.map(segment => segment.state), ['initial']);
  } finally { p.dispose(); }
});
test('thickness and oblique path raise resistance; original ammo behavior distinguishes AP from frangible', async () => {
  const p = await createPhysics();
  try {
    const fire = (id, x, dir = new Vector3(0, 0, -1)) => traceShot(p, new Vector3(x, 1.5, -8), dir, shotBallistics(id), { random: () => 0.5 });
    const thin = fire('556_m855', 14), thick = fire('556_m855', 26.5);
    assert.ok(thick.events[0].effectiveArmor > thin.events[0].effectiveArmor * 3);
    assert.ok(thick.residual.velocityMps < thin.residual.velocityMps);
    const angled = traceShot(p, new Vector3(26.2, 1.5, -15.6), new Vector3(1, 0, -1).normalize(), shotBallistics('556_m855'), { random: () => 0.5 });
    assert.ok(angled.events[0].pathLenM > thick.events[0].pathLenM * 1.4);
    assert.ok(angled.events[0].effectiveArmor > thick.events[0].effectiveArmor * 1.4);
    const ap = fire('556_m995_ap', 19), frag = fire('556_mk255_rrlp', 19);
    assert.equal(ap.hit.kind, 'target'); assert.ok(['spent', 'stopped', 'shattered'].includes(frag.reason));
    assert.ok(ap.events[0].penProbability > frag.events[0].penProbability);
  } finally { p.dispose(); }
});
test('three physical drywall walls accumulate original losses and retain a live target-reaching projectile', async () => {
  for (const [id, count] of [['drywall', 1], ['layers', 3]]) {
    const lane = RANGE_LANES.find(lane => lane.id === id), panels = BARRIERS.filter(panel => panel.id.startsWith(`panel-${id}-`));
    assert.equal(panels.length, count);
    panels.forEach((panel, i) => {
      assert.equal(panel.size[2], .025); assert.equal(panel.nominalThicknessM, .025); assert.equal(panel.armor, null);
      if (i) assert.ok(Math.abs(panels[i - 1].at[2] - panel.at[2] - 1.025) < 1e-10);
    });
    assert.ok(lane.plies.every(ply => ply.armor === null));
  }
  const p = await createPhysics();
  try {
    const t = traceShot(p, new Vector3(29, 1.5, -8), new Vector3(0, 0, -1), shotBallistics('556_m855'), { random: () => 0.5 });
    assert.equal(t.events.length, 3); assert.equal(t.reason, 'target'); assert.equal(t.hit.id, 'T-layers');
    assert.ok(Math.abs(t.residual.velocityMps - 771) < 1); assert.ok(Math.abs(t.residual.stability - .42) < .01);
    assert.ok(Math.abs(t.hit.distance - t.hit.point.distanceTo(new Vector3(29, 1.5, -8))) < 0.001);
    for (let i = 1; i < 3; i++) {
      assert.equal(t.events[i].before.velocityMps, t.events[i - 1].after.velocityMps);
      assert.ok(t.events[i].after.velocityMps < t.events[i - 1].after.velocityMps);
      assert.ok(t.events[i].loss.totalLossMul > t.events[i - 1].loss.totalLossMul);
    }
  } finally { p.dispose(); }
});
test('seeded shots reproduce geometry/results; fixed RNG exercises ricochet and frangible shatter paths', async () => {
  const p = await createPhysics();
  try {
    const origin = new Vector3(19, 1.5, -8), dir = new Vector3(0, 0, -1), b = shotBallistics('556_m855');
    assert.deepEqual(plain(traceShot(p, origin, dir, b, { shotId: 72 })), plain(traceShot(p, origin, dir, b, { shotId: 72 })));
    // Grazing along the front face of the steel block; fail penetration, then force ricochet.
    const rolls = [0.999, 0, 0.5];
    const ric = traceShot(p, new Vector3(23.2, 1.5, -15.94), new Vector3(1, 0, -0.1).normalize(), b, { random: () => rolls.length ? rolls.shift() : 0.5 });
    assert.equal(ric.events[0].material, 'steel'); assert.equal(ric.events[0].outcome, 'ricochet');
    assert.ok(ric.events[0].ricChance > 0); assert.ok(ric.events[0].after.velocityMps < b.muzzleVelocityMps);
    assert.equal(ric.segments[0].state, 'initial'); assert.equal(ric.segments[1].state, 'ricochet');
    assert.deepEqual(ric.segments[0].to, ric.events[0].point); assert.ok(ric.segments[1].stability < 1);
    const sequence = [0.99, 0.99, 0.1];
    const frag = traceShot(p, origin, dir, shotBallistics('556_mk255_rrlp'), { random: () => sequence.shift() ?? 0.5 });
    assert.equal(frag.reason, 'shattered');
  } finally { p.dispose(); }
});
test('muzzle obstruction, very short rays, inside contacts and absolute stopper preserve collision safety', async () => {
  const p = await createPhysics();
  try {
    const b = shotBallistics('556_m995_ap'), forward = new Vector3(0, 0, -1);
    assert.equal(p.muzzleBlocked(new Vector3(16.5, 1.5, -15.95), new Vector3(16.5, 1.5, -16.1), forward), true);
    const short = traceShot(p, new Vector3(14, 1.5, -15.98), forward, b, { random: () => 0, maxDistance: 0.02 });
    assert.equal(short.reason, 'incomplete_exit'); assert.equal(short.events.length, 0);
    const inside = p.contact(new Vector3(14, 1.5, -16), forward, 5);
    assert.equal(inside.id, 'panel-wood-1'); assert.equal(inside.interval.inside, true);
    const outer = traceShot(p, new Vector3(14, 1.5, -30), forward, b, { random: () => 0 });
    assert.equal(outer.hit.id, 'annex-back'); assert.equal(outer.events[0].outcome, 'stopped');
    assert.ok(BOXES.find(box => box.id === 'annex-back').penetrable === false);
  } finally { p.dispose(); }
});
