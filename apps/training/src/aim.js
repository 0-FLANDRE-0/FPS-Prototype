import{opticForWeapon}from'./optic-data.js';
import { Euler, Quaternion, Vector3 } from 'three';
import { GUN, PLAYER } from './config.js';
import { AIM_DEFAULTS } from './settings.js';
import { RecoilState } from './recoil.js';
import { weaponMarkers, STOCK_CONTACTS, WEAPON_HIP_LIFT } from './weapon-data.js';
import { sightGeometry } from './sight-geometry.js';
import { zeroingDirection, zeroingPreset } from './zeroing.js';
import { SPRINT } from './sprint.js';
import {leanPoint} from './lean.js';
import {LOCOMOTION} from './locomotion-tuning.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const approach = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));
export function direction(yaw, pitch) {
  return new Vector3(0, 0, -1).applyEuler(new Euler(pitch, yaw, 0, 'YXZ'));
}
export class AimState {
  constructor(settings = { ...AIM_DEFAULTS }) { this.settings = settings; this.setWeapon('m4a1'); this.reset(); }
  setWeapon(id) {
    if(this.weaponId===id)return;
    this.weaponId=id;this.zeroingOverride=null;this.markers=weaponMarkers(id);
    this.ironGeometry=sightGeometry(id);
    this.setOptic(false);
  }
  setOptic(def){this.opticDef=def?.id&&['m4a1','scar_h'].includes(this.weaponId)?opticForWeapon(def,this.weaponId):null;this.opticActive=Boolean(this.opticDef);this.geometry=this.opticActive?sightGeometry(this.weaponId,this.opticDef):this.ironGeometry;}
  reset() {
    this.setOptic(false);this.opticLookScale=1;this.zeroingOverride=null;
    this.recoilState = new RecoilState();
    this.intentYaw = this.intentPitch = this.aimYaw = this.aimPitch = 0;
    this.viewYaw = this.viewPitch = this.freeYaw = this.freePitch = 0;
    this.weaponYaw = this.weaponPitch = 0;
    this.mountYaw = this.mountPitch = this.sightLagYaw = this.sightLagPitch = 0;
    this.lookMountYaw = this.lookMountPitch = 0;
    this.walking = this.gaitPhase = 0; this.scale = this.settings.weaponSize / 100;
    this.recoil = this.kick = this.ads = this.clearance = this.reloadPose = 0;
    this.sprintPose = 0;
    this.leanApplied=null;
    this.quaternion = new Quaternion(); this.alignment = new Quaternion();
    this.position = new Vector3(); this.eye = new Vector3();
    this.stockContact = new Vector3();
    this.muzzle = new Vector3(); this.breech = new Vector3();
    this.sight = new Vector3(); this.frontSight = new Vector3();
    this.barrelDirection = new Vector3(0, 0, -1);
  }
  look(dx, dy, aiming) {
    const gain = 0.0026 * this.settings.sensitivity / 100 * (aiming ? this.settings.adsSensitivity / 100 : 1);
    this.intentYaw += this.recoilState.compensate(-dx * gain, 'yaw');
    this.intentPitch = clamp(this.intentPitch + this.recoilState.compensate(-dy * gain, 'pitch'), -1.2, 1.2);
  }
  step(dt, { feet, viewHeight, time, speed, ads, reloading, nativeHandling=false, blocked, crouched = false, sprint=false, runPose=null, locomotion=null, swayMultiplier=1, medicalFeedback=null }) {
    this.leanApplied=null;
    const p = this.settings;
    const {rear,front,sightAxis,visualAlignment}=this.geometry;
    const handlingRate=medicalFeedback?.handlingRate??1;
    this.ads = approach(this.ads, ads && !reloading && !blocked ? (medicalFeedback?.aimHold?.alignment??1) : 0, 12*handlingRate, dt);
    this.recoilState.step(dt, { crouched, speed });
    this.recoil = this.recoilState.pitch; this.kick = this.recoilState.rear;
    this.clearance = approach(this.clearance, blocked ? 1 : 0, 13, dt);
    this.reloadPose = approach(this.reloadPose, reloading && !nativeHandling ? 1 : 0, 8, dt);
    // Input owns the weapon intent. The body camera follows the moving weapon.
    const response = p.weaponResponse * (1 + this.ads * 0.4)*handlingRate;
    this.aimYaw = approach(this.aimYaw, this.intentYaw, response, dt);
    this.aimPitch = approach(this.aimPitch, this.intentPitch, response, dt);
    const travel = clamp(speed / PLAYER.speed, 0, 1), motion = p.weaponMotion / 100;
    this.walking = approach(this.walking, travel, 10, dt);
    if(locomotion)this.gaitPhase=locomotion.phaseRad;else this.gaitPhase += (sprint ? Math.min(speed / PLAYER.speed, SPRINT.gaitMultiplier) : travel) * 7.8 * dt;
    this.sprintPose = approach(this.sprintPose, sprint && !ads && !reloading && !blocked && !crouched ? 1 : 0, SPRINT.poseResponse, dt);
    if(this.sprintPose<1e-5)this.sprintPose=0;
    const stride = Math.sin(this.gaitPhase), step = Math.cos(this.gaitPhase * 2),body=locomotion,bodyWeight=(body?.weight??0)*motion;
    const bodyYaw=body?body.rotation.y*LOCOMOTION.weaponRotationGain*p.walkSway/AIM_DEFAULTS.walkSway*bodyWeight:stride*p.walkSway*this.walking*motion*1.35,bodyPitch=body?body.rotation.x*LOCOMOTION.weaponRotationGain*p.walkSway/AIM_DEFAULTS.walkSway*bodyWeight:step*p.walkSway*this.walking*motion*.85*GUN.walkVertical;
    const swayScale = 1 - this.ads * 0.6;
    const swayYaw = (Math.sin(time * 1.7) * p.breath + bodyYaw) * swayScale*swayMultiplier;
    const swayPitch = (Math.sin(time * 2.3) * p.breath * 0.65 + bodyPitch) * swayScale*swayMultiplier;
    this.recoilState.constrainPitch(-1.4 - this.aimPitch - swayPitch, 1.4 - this.aimPitch - swayPitch);
    this.recoil = this.recoilState.pitch;
    this.weaponYaw = this.aimYaw + swayYaw + this.recoilState.yaw;
    this.weaponPitch = clamp(this.aimPitch + swayPitch + this.recoil, -1.4, 1.4);
    const follow = p.cameraFollow * (1 + this.ads * 2);
    this.viewYaw = approach(this.viewYaw, this.aimYaw + swayYaw * p.transfer + this.recoilState.yaw, follow, dt);
    this.viewPitch = approach(this.viewPitch, clamp(this.aimPitch + swayPitch * p.transfer + this.recoil, -1.4, 1.4), follow, dt);
    // Limit lag without turning the camera before the weapon has moved.
    const dy = this.weaponYaw - this.viewYaw, dp = this.weaponPitch - this.viewPitch;
    const limit = p.freeAim * Math.PI / 180 * (1 - this.ads * 0.75), divergence = Math.hypot(dy, dp);
    if (divergence > limit) { const keep = limit / divergence; this.viewYaw = this.weaponYaw - dy * keep; this.viewPitch = this.weaponPitch - dp * keep; }
    this.freeYaw = this.weaponYaw - this.viewYaw; this.freePitch = this.weaponPitch - this.viewPitch;
    // The rear mount and camera follow the faster rifle intent.
    const mountResponse = p.weaponResponse * 0.65 * (1 + this.ads * 0.35)*handlingRate;
    this.mountYaw = approach(this.mountYaw, this.weaponYaw, mountResponse, dt);
    this.mountPitch = approach(this.mountPitch, this.weaponPitch, mountResponse, dt);
    const lagYaw = this.weaponYaw - this.mountYaw, lagPitch = this.weaponPitch - this.mountPitch;
    const mountLimit = 0.022 * motion, mountLag = Math.hypot(lagYaw, lagPitch);
    if (mountLag > mountLimit) {
      const keep = mountLimit / mountLag;
      this.mountYaw = this.weaponYaw - lagYaw * keep; this.mountPitch = this.weaponPitch - lagPitch * keep;
    }
    this.sightLagYaw = this.weaponYaw - this.mountYaw; this.sightLagPitch = this.weaponPitch - this.mountPitch;
    // A separate input-only mount keeps hip turning lag out of shot recoil/sway.
    this.lookMountYaw = approach(this.lookMountYaw, this.aimYaw, mountResponse, dt);
    this.lookMountPitch = approach(this.lookMountPitch, this.aimPitch, mountResponse, dt);
    const lookLagYaw=this.aimYaw-this.lookMountYaw,lookLagPitch=this.aimPitch-this.lookMountPitch;
    const lookLag=Math.hypot(lookLagYaw,lookLagPitch);
    if(lookLag>mountLimit){const keep=mountLimit/lookLag;this.lookMountYaw=this.aimYaw-lookLagYaw*keep;this.lookMountPitch=this.aimPitch-lookLagPitch*keep;}
    else if(lookLag<1e-7){this.lookMountYaw=this.aimYaw;this.lookMountPitch=this.aimPitch;}
    const roll = GUN.hipRoll * (1 - this.ads) - this.reloadPose * 0.34 + (body?body.rotation.z*LOCOMOTION.weaponRotationGain*bodyWeight:stride*.055*this.walking*motion)*(1-this.ads*.5);
    this.quaternion.setFromEuler(new Euler(this.weaponPitch - this.clearance * 0.45 - this.reloadPose * 0.42,
      this.weaponYaw, roll, 'YXZ'));
    this.alignment.identity().slerp(visualAlignment, this.ads); this.quaternion.multiply(this.alignment);
    this.eye.copy(feet).add(new Vector3(0, viewHeight, 0));
    const viewRotation = new Quaternion().setFromEuler(new Euler(this.viewPitch, this.viewYaw, 0, 'YXZ'));
    // Enlarge the hip viewmodel, blending back to the calibrated ADS size.
    // Its geometry and every logical/rendered attachment share this same scale.
    this.scale = 1 + (p.weaponSize / 100 - 1) * (1 - this.ads);
    const hip = new Vector3(...GUN.hipOffset);
    hip.y += p.weaponHeight / 100 + WEAPON_HIP_LIFT[this.weaponId] * this.scale;
    hip.z += this.kick * 0.8 + this.clearance * 0.15 - this.ironGeometry.rear.z * (this.scale - 1) * 0.25;
    const hipPosition = hip.applyQuaternion(viewRotation).add(this.eye);
    const relief = Math.max(this.opticActive?Math.min(.045,this.opticDef.adsEyeReliefM*.8):.045, (this.opticActive?this.opticDef.adsEyeReliefM:GUN.eyeRelief) - this.kick * 0.6);
    const mountRotation = new Quaternion().setFromEuler(new Euler(this.mountPitch - this.clearance * 0.45 - this.reloadPose * 0.42,
      this.mountYaw, roll, 'YXZ')).multiply(this.alignment);
    // Restore the original recoil lever: the aperture follows the slower mount,
    // while the front sight and muzzle turn first. Hip translation follows the camera.
    const adsPosition = sightAxis.clone().multiplyScalar(relief).applyQuaternion(mountRotation).add(this.eye)
      .sub(rear.clone().multiplyScalar(this.scale).applyQuaternion(this.quaternion));
    this.position.copy(hipPosition).lerp(adsPosition, this.ads);
    const lookRotation = new Quaternion().setFromEuler(new Euler(this.aimPitch,this.aimYaw,roll,'YXZ'));
    const lookMountRotation = new Quaternion().setFromEuler(new Euler(this.lookMountPitch,this.lookMountYaw,roll,'YXZ'));
    const hipTurn = this.ironGeometry.rear.clone().multiplyScalar(this.scale).applyQuaternion(lookMountRotation)
      .sub(this.ironGeometry.rear.clone().multiplyScalar(this.scale).applyQuaternion(lookRotation));
    this.position.addScaledVector(hipTurn,(1-this.ads)*(1-this.reloadPose)*(1-this.clearance));
    const bob = body?body.position.clone().multiplyScalar(LOCOMOTION.weaponTranslationGain*bodyWeight).multiply(new Vector3(1-this.ads*.96,1-this.ads*.965,1-this.ads*.9)).applyQuaternion(viewRotation):new Vector3(stride * .022 * (1-this.ads*.96),step*.026*GUN.walkVertical*(1-this.ads*.965),Math.sin(this.gaitPhase*2)*.016*(1-this.ads*.9)).multiplyScalar(this.walking*motion).applyQuaternion(viewRotation);
    this.position.add(bob.multiplyScalar(swayMultiplier));
    if(this.sprintPose>0&&runPose){
      const pose=body?{position:new Vector3(),quaternion:new Quaternion()}:runPose.sample(this.gaitPhase/(2*Math.PI)),stock=new Vector3(...STOCK_CONTACTS[this.weaponId]).multiplyScalar(this.scale),contact=stock.clone().applyQuaternion(this.quaternion).add(this.position);
      const bounce=pose.position.multiplyScalar(this.scale*this.sprintPose).applyQuaternion(this.quaternion);
      this.quaternion.multiply(new Quaternion().slerp(pose.quaternion,this.sprintPose*SPRINT.nativeRotationGain)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),SPRINT.pitchBiasRad*this.sprintPose));
      this.position.copy(contact).sub(stock.applyQuaternion(this.quaternion)).add(bounce);
    }
    // Physical rifle rotation about its stock; never scales with camera presets
    // or weaponMotion, and never adds a second projectile dispersion draw.
    if(medicalFeedback?.active){const stock=new Vector3(...STOCK_CONTACTS[this.weaponId]).multiplyScalar(this.scale),contact=stock.clone().applyQuaternion(this.quaternion).add(this.position),a=medicalFeedback.angles;
      this.quaternion.multiply(new Quaternion().setFromEuler(new Euler(a.pitch,a.yaw,a.roll,'YXZ')));this.position.copy(contact).sub(stock.applyQuaternion(this.quaternion));this.position.y-=medicalFeedback.dropM;
    }
    this.stockContact.fromArray(STOCK_CONTACTS[this.weaponId]).multiplyScalar(this.scale).applyQuaternion(this.quaternion).add(this.position);
    this.muzzle.fromArray(this.markers.muzzle).multiplyScalar(this.scale).applyQuaternion(this.quaternion).add(this.position);
    this.breech.fromArray(this.markers.breech).multiplyScalar(this.scale).applyQuaternion(this.quaternion).add(this.position);
    this.sight.copy(rear).multiplyScalar(this.scale).applyQuaternion(this.quaternion).add(this.position);
    this.frontSight.copy(front).multiplyScalar(this.scale).applyQuaternion(this.quaternion).add(this.position);
    this.barrelDirection.set(0, 0, -1).applyQuaternion(this.quaternion);
  }
  applyLean(pose){
    if(!pose.value)return;
    const eye=this.eye.clone();this.leanApplied={pose,eye};
    for(const key of ['position','stockContact','muzzle','breech','sight','frontSight'])this[key].copy(leanPoint(this[key],eye,pose));
    this.eye.add(pose.headOffset);this.quaternion.premultiply(pose.rotation);this.barrelDirection.applyQuaternion(pose.rotation);
  }
  restoreLean(){
    if(!this.leanApplied)return;const {pose,eye}=this.leanApplied,inverse=pose.rotation.clone().invert();
    for(const key of ['position','stockContact','muzzle','breech','sight','frontSight']){
      if(this.leanApplied.retraction)this[key].sub(this.leanApplied.retraction);
      this[key].sub(eye).sub(pose.headOffset).applyQuaternion(inverse).add(eye);
    }
    this.eye.copy(eye);this.quaternion.premultiply(inverse);this.barrelDirection.applyQuaternion(inverse);this.leanApplied=null;
  }
  translateWeapon(offset,pose){
    this.leanApplied??={pose:{...pose,rotation:new Quaternion(),headOffset:new Vector3()},eye:this.eye.clone()};
    this.leanApplied.retraction??=new Vector3();this.leanApplied.retraction.add(offset);
    for(const key of ['position','stockContact','muzzle','breech','sight','frontSight'])this[key].add(offset);
  }
  onShot(ballistics, shotId, stance) { return this.recoilState.impulse(ballistics, shotId, stance); }
  shotPose() { return { origin: this.muzzle.clone(), direction: zeroingDirection(this.geometry.sightAxis, this.quaternion, (this.zeroingOverride??zeroingPreset(this.weaponId,this.opticDef))?.thetaRad), rotation: this.quaternion.clone(), breech: this.breech.clone() }; }
}
