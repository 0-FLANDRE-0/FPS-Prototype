import * as T from 'three';
import { TrainingTrajectories } from './trajectories.js';

export class TrainingFX {
  constructor(scene, brass) {
    this.scene = scene; this.time = 0; this.pool = []; this.marks = []; this.audio = null; this.sound = true;
    this.trajectories = new TrainingTrajectories(scene);
    this.flash = new T.Mesh(new T.ConeGeometry(0.035, 0.16, 6), new T.MeshBasicMaterial({ color: '#ffdb77', transparent: true, opacity: 0 }));
    this.flash.geometry.rotateX(-Math.PI / 2); this.flash.geometry.translate(0, 0, -0.08);
    scene.add(this.flash);
    this.flashLife = 0;
    this.impactMaterial = new T.MeshBasicMaterial({ color: '#2e2923', transparent: true, opacity: 0.9, depthWrite: false });
    this.impactGeometry = new T.CircleGeometry(0.021, 8);
    this.puff = new T.InstancedMesh(new T.SphereGeometry(0.025, 4, 3), new T.MeshBasicMaterial({ color: '#cbbd96', transparent: true, opacity: 0.6 }), 72);
    this.puff.count = 0; this.particles = []; scene.add(this.puff);
    for (let i = 0; i < 22; i++) { const mesh = new T.Mesh(brass.geometry, brass.material); mesh.visible = false; scene.add(mesh); this.pool.push({ mesh, active: false, life: 0, velocity: new T.Vector3(), spin: new T.Vector3() }); }
    this.markPool=Array.from({length:70},()=>{const m=new T.Mesh(this.impactGeometry,this.impactMaterial);m.visible=false;scene.add(m);return m;});this.nextMark=0;
    this.nextCasing = 0; this.audioShots = 0;
    this.matrix = new T.Matrix4(); this.q = new T.Quaternion();
  }
  unlockAudio() { return this.soundEngine?.unlock(); }
  prepareAudio() { /* SND1 sprite is decoded once after a user gesture. */ }
  prewarm(renderer,camera){this.prepareAudio();const mark=this.markPool[0],casing=this.pool[0].mesh,oldCasing=casing.visible;mark.visible=casing.visible=true;this.puff.count=1;this.puff.setColorAt(0,new T.Color('#cbbd96'));this.puff.setMatrixAt(0,new T.Matrix4());renderer.compile(this.scene,camera);mark.visible=false;casing.visible=oldCasing;this.puff.count=0;}
  shot(event) {
    this.trajectories.shot(event);
    this.flash.position.copy(event.origin); this.flash.quaternion.copy(event.rotation); this.flashLife = 0.036;
    const casing = this.pool[this.nextCasing++ % this.pool.length]; casing.active = casing.mesh.visible = true; casing.life = 3.8;
    casing.mesh.position.copy(event.breech); casing.mesh.quaternion.copy(event.rotation);
    // World velocity = shooter translation at release + gun-local ejection.
    casing.velocity.set(1.9,1.6,0).applyQuaternion(event.rotation);
    if(event.shooterVelocity)casing.velocity.add(event.shooterVelocity);
    casing.spin.set(8.2, 4.3, 12.6);
    const impacts = [];
    for (const barrier of event.trace?.events || []) {
      impacts.push({ point: new T.Vector3(...barrier.point), normal: new T.Vector3(...barrier.normal), material: barrier.material });
      if (barrier.exitPoint) impacts.push({ point: new T.Vector3(...barrier.exitPoint), normal: new T.Vector3(...barrier.exitNormal), material: barrier.material });
    }
    for (const armor of event.trace?.armorResults || []) if (armor.outcome === 'ricochet') {
      impacts.push({ point: new T.Vector3(...armor.point), normal: new T.Vector3(...armor.ricochet.surfaceNormal), material: armor.material });
    }
    if (event.hit && !(event.trace?.events || []).some(item => item.id === event.hit.id) &&
      !impacts.some(impact => impact.point.distanceToSquared(event.hit.point) < 1e-8)) impacts.push(event.hit);
    const dustColors = { wood: '#ac8154', drywall: '#e1d9c4', glass: '#c0e4e8', thin_metal: '#e6c47e', steel: '#e6c47e', concrete: '#b5b1a4' };
    for (const impact of impacts) {
      const mark = this.markPool[this.nextMark++ % this.markPool.length];mark.visible=true;
      mark.position.copy(impact.point).addScaledVector(impact.normal, 0.002);
      mark.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), impact.normal);
      this.marks.push(mark); if (this.marks.length > 70) this.marks.shift();
      for (let i = 0; i < 7; i++) this.particles.push({ position: impact.point.clone(), color: new T.Color(dustColors[impact.material] || '#cbbd96'), velocity: impact.normal.clone().multiplyScalar(0.4 + i * 0.04).add(new T.Vector3(Math.sin(i * 4.3) * 0.4, 0.2 + i * 0.03, Math.cos(i * 2.2) * 0.2)), life: 0.35 + i * 0.025 });
      if (this.particles.length > 72) this.particles.splice(0, this.particles.length - 72);
    }
    this.soundEngine?.shot(event);
  }
  playShot() { /* All confirmed shots enter the shared physical event path. */ }
  update(dt) {
    this.trajectories.update(dt);
    this.time += dt; this.flashLife = Math.max(0, this.flashLife - dt); this.flash.material.opacity = this.flashLife > 0 ? 0.9 : 0;
    for (const casing of this.pool) {
      if (!casing.active) continue;
      casing.life -= dt; if (casing.life <= 0) { casing.mesh.visible = casing.active = false; continue; }
      casing.velocity.y -= 9.81 * dt; casing.mesh.position.addScaledVector(casing.velocity, dt);
      casing.mesh.rotation.x += casing.spin.x * dt; casing.mesh.rotation.y += casing.spin.y * dt; casing.mesh.rotation.z += casing.spin.z * dt;
      if (casing.mesh.position.y < 0.012) { casing.mesh.position.y = 0.012; casing.velocity.y = Math.abs(casing.velocity.y) > 0.5 ? Math.abs(casing.velocity.y) * 0.22 : 0; casing.velocity.x *= 0.72; casing.velocity.z *= 0.72; casing.spin.multiplyScalar(0.7); }
    }
    let count = 0;
    this.particles = this.particles.filter(particle => {
      particle.life -= dt; if (particle.life <= 0) return false;
      particle.velocity.y -= dt * 1.7; particle.position.addScaledVector(particle.velocity, dt);
      this.matrix.compose(particle.position, this.q, new T.Vector3().setScalar(Math.min(1.5, particle.life * 3)));
      this.puff.setColorAt(count, particle.color); this.puff.setMatrixAt(count++, this.matrix); return true;
    });
    this.puff.count = count; this.puff.instanceMatrix.needsUpdate = true;
    if (this.puff.instanceColor) this.puff.instanceColor.needsUpdate = true;
  }
  reset() {
    this.soundEngine?.reset();
    this.trajectories.reset();
    for (const item of this.pool) { item.active = item.mesh.visible = false; }
    for (const mark of this.markPool) mark.visible=false; this.marks = []; this.particles = []; this.puff.count = 0; this.flashLife = 0; this.flash.material.opacity = 0;
  }
}
