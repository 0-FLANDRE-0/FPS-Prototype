// Game tuning, in normalized joystick units. Hysteresis avoids edge chatter.
export const SPRINT = Object.freeze({ speedMps: 4.5, stickEnter: .97, stickExit: .82, forwardMinimum: .25, poseResponse: 14, gaitMultiplier: 1.35, nativeRotationGain: .5, pitchBiasRad: -.98 });

export class SprintIntent {
  constructor() { this.clear(); }
  clear() { this.toggled = this.automatic = this.suppressed = false; }
  updateStick(y) {
    const forward = -y;
    if (forward <= SPRINT.stickExit) { this.automatic = false; this.suppressed = false; }
    else if (!this.suppressed && forward >= SPRINT.stickEnter) this.automatic = true;
  }
  toggle() {
    if (this.toggled || this.automatic) {
      // Turning off while the stick is still high must actually stop sprinting.
      this.suppressed ||= this.automatic;
      this.toggled = this.automatic = false;
    } else { this.toggled = true; }
  }
  requested(keys) { return this.toggled || this.automatic || keys.has('ShiftLeft') || keys.has('ShiftRight'); }
}

export function canSprint(frame, { crouched = frame.crouch, busy = false } = {}) {
  const { x, y } = frame.move, length = Math.max(1, Math.hypot(x, y));
  return Boolean(frame.sprint && -y / length >= SPRINT.forwardMinimum && !crouched && !frame.ads && !frame.firing && !frame.firePressed && !busy);
}
