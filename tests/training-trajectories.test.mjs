import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scene, Color, Matrix4, Vector3 } from 'three';
import { TrainingTrajectories, TRAJECTORY_COLORS, TRAJECTORY_LIFE, TRAJECTORY_SHOTS } from '../apps/training/src/trajectories.js';
import { traceShot } from '../apps/training/src/ballistics.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { shotBallistics } from '../apps/training/src/catalog.js';

test('trajectory instances follow real CQB penetration/ricochet paths and preserve shot results', async () => {
  const p = await createPhysics(), display = new TrainingTrajectories(new Scene());
  try {
    const b = shotBallistics('556_m855');
    const through = traceShot(p, new Vector3(11.5, 1.5, -8), new Vector3(0, 0, -1), b, { random: () => 0.4 });
    const rolls = [0.999, 0, 0.5];
    const ric = traceShot(p, new Vector3(23.2, 1.5, -15.78), new Vector3(1, 0, -0.1).normalize(), b, { random: () => rolls.length ? rolls.shift() : 0.5 });
    const frozen = JSON.stringify([through, ric]);
    display.shot({ shotId: 1, trace: through }); assert.equal(display.mesh.count, 0);
    display.setEnabled(true); display.shot({ shotId: 1, trace: through }); display.shot({ shotId: 2, trace: ric });
    assert.equal(display.mesh.material.depthTest, false, 'Training paths remain visible behind the obstacle');
    assert.ok(through.events[0].wobbleDeg !== 0, 'Post-penetration instability is visible in the outgoing direction');
    const all = [...through.segments, ...ric.segments]; assert.equal(display.mesh.count, all.length);
    for (const [i, segment] of all.entries()) {
      const matrix = new Matrix4(), color = new Color(); display.mesh.getMatrixAt(i, matrix); display.mesh.getColorAt(i, color);
      assert.ok(new Vector3(0, -0.5, 0).applyMatrix4(matrix).distanceTo(new Vector3(...segment.from)) < 1e-4);
      assert.ok(new Vector3(0, 0.5, 0).applyMatrix4(matrix).distanceTo(new Vector3(...segment.to)) < 1e-4);
      const expected = new Color(TRAJECTORY_COLORS[segment.state]).toArray();
      assert.ok(color.toArray().every((value, axis) => Math.abs(value - expected[axis]) < 1e-6));
    }
    display.update(1); display.setEnabled(false); assert.equal(display.mesh.count, 0); assert.equal(display.shots.length, 0);
    display.setEnabled(true); assert.equal(display.mesh.count, 0, 'Re-enabling does not resurrect old shots');
    assert.equal(JSON.stringify([through, ric]), frozen);
  } finally { display.dispose(); p.dispose(); }
});
test('automatic fire keeps a bounded trajectory history, expires it, and resets/disposes resources', () => {
  const scene = new Scene(), display = new TrainingTrajectories(scene); display.setEnabled(true);
  const trace = { segments: [{ from: [0, 1, 0], to: [0, 1, -10], state: 'initial', medium: 'air' }] };
  for (let i = 1; i <= TRAJECTORY_SHOTS + 10; i++) display.shot({ shotId: i, trace });
  assert.equal(display.shots.length, TRAJECTORY_SHOTS); assert.equal(display.shots[0].shotId, 11);
  assert.equal(display.mesh.count, TRAJECTORY_SHOTS);
  display.update(TRAJECTORY_LIFE - 0.01); assert.equal(display.mesh.count, TRAJECTORY_SHOTS);
  display.update(0.02); assert.equal(display.mesh.count, 0);
  display.shot({ shotId: 40, trace }); display.reset(); assert.equal(display.shots.length, 0); assert.equal(display.mesh.count, 0);
  const disposed = []; display.mesh.geometry.addEventListener('dispose', () => disposed.push('geometry'));
  display.mesh.material.addEventListener('dispose', () => disposed.push('material'));
  display.dispose(); assert.equal(scene.children.length, 0); assert.deepEqual(disposed, ['geometry', 'material']);
});
