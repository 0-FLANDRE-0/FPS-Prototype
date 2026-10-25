// These support/gas coefficients are prototype estimates, not measured M4 data.
// Projectile mass, velocity, weapon mass and fire cadence come from the original catalog.
export const RECOIL_MODEL = Object.freeze({ gasImpulseFactor: 1.35, momentArmM: 0.045, pitchInertiaKgM2: 0.14,
  yawInertiaKgM2: 0.16, reactionDelayS: 0.06, angularDrag: 28, angularFrequency: 42,
  dampingRatio: 1.04, rearFrequency: 48, rearDamping: 0.95 });
export const RECOVERY = Object.freeze({
  single: Object.freeze({ automatic: 0.94, settled: 0.008, idle: 0.16, rate: 10 }),
  burst: Object.freeze({ automatic: 0.84, settled: 0.035, idle: 0.26, rate: 6 }),
});

export function recoilImpulse(ballistics, shotId) {
  const p = RECOIL_MODEL;
  const impulseNs = ballistics.projectileMomentumNs * p.gasImpulseFactor;
  // Shot-seeded lateral variation is independent of rendering and frame rate.
  const seed = Math.imul(shotId ^ 0x45d9f3b, 0x45d9f3b) >>> 0;
  const lateral = (seed % 2001 / 1000 - 1) * 0.09;
  return Object.freeze({ impulseNs, projectileMomentumNs: ballistics.projectileMomentumNs,
    gasImpulseNs: impulseNs - ballistics.projectileMomentumNs,
    rearVelocityMps: impulseNs / ballistics.weaponMassKg,
    pitchVelocityRadS: impulseNs * p.momentArmM / p.pitchInertiaKgM2,
    yawVelocityRadS: impulseNs * p.momentArmM * lateral / p.yawInertiaKgM2,
    weaponMassKg: ballistics.weaponMassKg, model: p });
}

export class RecoilState {
  constructor() { this.reset(); }
  reset() {
    this.pitch = this.yaw = this.pitchVelocity = this.yawVelocity = 0;
    this.holdPitch = this.holdYaw = this.rear = this.rearVelocity = 0;
    this.settledPitch = this.settledYaw = 0; this.profile = 'single'; this.burstShots = 0;
    this.visualPitch = this.visualVelocity = 0; this.sinceShot = 100; this.lastImpulse = null;
  }
  impulse(ballistics, shotId, { crouched = false, speed = 0, fireMode = 'full' } = {}) {
    const p = RECOIL_MODEL, kick = recoilImpulse(ballistics, shotId);
    const rapid = fireMode === 'full' && this.sinceShot < 0.18;
    this.profile = rapid ? 'burst' : 'single'; this.burstShots = rapid ? this.burstShots + 1 : 1;
    this.lastImpulse = kick; this.sinceShot = 0;
    this.pitchVelocity += kick.pitchVelocityRadS; this.yawVelocity += kick.yawVelocityRadS;
    this.rearVelocity += kick.rearVelocityMps;
    // Residual support direction is derived from the impulse response, not a camera snap.
    // The rifle reaches it over time; it is never the pre-shot camera direction.
    const support = this.support({ crouched, speed });
    const peakTime = (1 - Math.exp(-support.drag * support.delay)) / support.drag;
    this.holdPitch += kick.pitchVelocityRadS * peakTime * (1 - support.automatic);
    this.holdYaw += kick.yawVelocityRadS * peakTime * (1 - support.automatic);
    this.settledPitch += kick.pitchVelocityRadS * peakTime * support.settled;
    this.settledYaw += kick.yawVelocityRadS * peakTime * support.settled;
    this.visualVelocity += kick.rearVelocityMps * 0.065;
    return kick;
  }
  support({ crouched = false, speed = 0 } = {}) {
    const p = RECOIL_MODEL, recovery = RECOVERY[this.profile], moving = Math.min(1, speed / 2.7);
    return { delay: p.reactionDelayS * (crouched ? 0.85 : 1) * (1 + moving * 0.15),
      drag: p.angularDrag * (crouched ? 1.12 : 1) * (1 - moving * 0.08),
      frequency: p.angularFrequency * (crouched ? 1.12 : 1) * (1 - moving * 0.12),
      automatic: Math.min(0.98, recovery.automatic + (crouched ? 0.025 : 0) - moving * 0.035),
      settled: recovery.settled * (crouched ? 0.7 : 1) * (1 + moving * 0.4) };
  }
  compensate(delta, axis) {
    const velocity = axis + 'Velocity', hold = axis === 'pitch' ? 'holdPitch' : 'holdYaw';
    const current = this[axis];
    if (delta * current >= 0 || Math.abs(current) < 1e-9) return delta;
    const taken = Math.sign(current) * Math.min(Math.abs(delta), Math.abs(current));
    this[axis] -= taken;
    // Manual correction consumes the recoverable excursion before the residual.
    // No saved old-angle target can pull the player's new aim past its intended position.
    if (this[hold] * current > 0 && Math.abs(this[hold]) > Math.abs(this[axis])) this[hold] = this[axis];
    const settled = axis === 'pitch' ? 'settledPitch' : 'settledYaw';
    if (this[settled] * current > 0 && Math.abs(this[settled]) > Math.abs(this[axis])) this[settled] = this[axis];
    // Once the player removes the entire excursion, cancel its recovery velocity too.
    // A still-descending spring must not produce a second downward correction.
    if (Math.abs(this[axis]) < 1e-9) this[velocity] = 0;
    else if (this[velocity] * current > 0) this[velocity] *= Math.max(0, 1 - Math.abs(taken / current));
    return delta + taken;
  }
  constrainPitch(min, max) {
    // Support joint limits absorb motion at the travel limit, avoiding hidden windup.
    if (this.pitch > max) { this.pitch = max; this.pitchVelocity = Math.min(0, this.pitchVelocity); }
    if (this.pitch < min) { this.pitch = min; this.pitchVelocity = Math.max(0, this.pitchVelocity); }
    this.holdPitch = Math.max(min, Math.min(max, this.holdPitch));
    this.settledPitch = Math.max(min, Math.min(max, this.settledPitch));
  }
  step(dt, stance = {}) {
    const p = RECOIL_MODEL, support = this.support(stance);
    // Integrate at <= 1/240 s inside the fixed simulation. Rendering never writes recoil.
    const count = Math.ceil(dt * 240), h = dt / count;
    for (let i = 0; i < count; i++) {
      this.sinceShot += h;
      const recovery = RECOVERY[this.profile];
      if (this.sinceShot > recovery.idle) {
        const decay = Math.exp(-recovery.rate * h);
        this.holdPitch = this.settledPitch + (this.holdPitch - this.settledPitch) * decay;
        this.holdYaw = this.settledYaw + (this.holdYaw - this.settledYaw) * decay;
      }
      const reacting = this.sinceShot >= support.delay;
      const stiffness = reacting ? support.frequency ** 2 : 0;
      const damping = reacting ? 2 * p.dampingRatio * support.frequency : support.drag;
      this.pitchVelocity += (stiffness * (this.holdPitch - this.pitch) - damping * this.pitchVelocity) * h;
      this.yawVelocity += (stiffness * (this.holdYaw - this.yaw) - damping * this.yawVelocity) * h;
      this.pitch += this.pitchVelocity * h; this.yaw += this.yawVelocity * h;
      this.rearVelocity += (-(p.rearFrequency ** 2) * this.rear - 2 * p.rearDamping * p.rearFrequency * this.rearVelocity) * h;
      this.rear += this.rearVelocity * h;
      this.visualVelocity += (-(55 ** 2) * this.visualPitch - 2 * 0.8 * 55 * this.visualVelocity) * h;
      this.visualPitch += this.visualVelocity * h;
    }
  }
  snapshot() {
    return { pitch: this.pitch, yaw: this.yaw, pitchVelocity: this.pitchVelocity, yawVelocity: this.yawVelocity,
      residualPitch: this.holdPitch, residualYaw: this.holdYaw, rearM: this.rear, visualPitch: this.visualPitch,
      settledPitch: this.settledPitch, profile: this.profile, burstShots: this.burstShots,
      lastImpulse: this.lastImpulse ? { ...this.lastImpulse } : null };
  }
}
