import * as T from 'three';

export const TRAJECTORY_COLORS = Object.freeze({ initial: '#f4e9ad', penetrated: '#59d9ff', ricochet: '#ff7b9c', armor: '#ffb85c', body: '#bc8cff' });
export const TRAJECTORY_LIFE = 5;
export const TRAJECTORY_SHOTS = 24;
export const TRAJECTORY_SEGMENTS_PER_SHOT=512;
const MAX_SEGMENTS = TRAJECTORY_SHOTS * TRAJECTORY_SEGMENTS_PER_SHOT;
// Only long display paths are sampled; collision samples are never altered.
// Keep every material chord and state boundary, so penetration/ricochet colors survive.
export function displaySegments(segments){
  if(segments.length<=TRAJECTORY_SEGMENTS_PER_SHOT)return segments;
  const solids=segments.filter(s=>s.medium!=='air').length;
  const airRuns=segments.filter((s,i)=>s.medium==='air'&&(i===0||segments[i-1].medium!=='air'||segments[i-1].state!==s.state)).length;
  const stride=Math.ceil((segments.length-solids)/Math.max(1,TRAJECTORY_SEGMENTS_PER_SHOT-solids-airRuns));
  const result=[];
  for(let i=0;i<segments.length;){
    const first=segments[i];if(first.medium!=='air'){result.push(first);i++;continue;}
    let end=i;while(end+1<segments.length&&end-i+1<stride&&segments[end+1].medium==='air'&&segments[end+1].state===first.state)end++;
    result.push({...segments[end],from:first.from,...(first.timeStartS!==undefined?{timeStartS:first.timeStartS,velocityFromMps:first.velocityFromMps}:{})});i=end+1;
  }
  return result;
}

export class TrainingTrajectories {
  constructor(scene) {
    this.enabled = false; this.shots = [];
    this.mesh = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 4), new T.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    }), MAX_SEGMENTS);
    this.mesh.count = 0; this.mesh.visible = false; this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.colors = Object.fromEntries(Object.entries(TRAJECTORY_COLORS).map(([key, value]) => [key, new T.Color(value)]));
    this.matrix = new T.Matrix4(); this.rotation = new T.Quaternion(); this.up = new T.Vector3(0, 1, 0);
    this.start = new T.Vector3(); this.end = new T.Vector3(); this.midpoint = new T.Vector3(); this.direction = new T.Vector3(); this.scale = new T.Vector3();
    scene.add(this.mesh);
  }
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled; this.mesh.visible = enabled; this.reset();
  }
  shot(event) {
    if (!this.enabled || !event.trace?.segments.length) return;
    this.shots.push({ shotId: event.shotId, life: TRAJECTORY_LIFE, segments: displaySegments(event.trace.segments).map(segment => ({ ...segment, from: [...segment.from], to: [...segment.to] })) });
    if (this.shots.length > TRAJECTORY_SHOTS) this.shots.shift();
    this.rebuild();
  }
  update(dt) {
    if (!this.shots.length || dt <= 0) return;
    const count = this.shots.length;
    this.shots = this.shots.filter(shot => { shot.life -= dt; return shot.life > 0; });
    if (count !== this.shots.length) this.rebuild();
  }
  rebuild() {
    let count = 0;
    for (const shot of this.shots) for (const segment of shot.segments) {
      this.start.fromArray(segment.from); this.end.fromArray(segment.to); this.direction.subVectors(this.end, this.start);
      const length = this.direction.length(); if (length < 1e-5 || count === MAX_SEGMENTS) continue;
      this.rotation.setFromUnitVectors(this.up, this.direction.divideScalar(length));
      this.midpoint.addVectors(this.start, this.end).multiplyScalar(0.5);
      this.scale.set(0.012, length, 0.012); this.matrix.compose(this.midpoint, this.rotation, this.scale);
      this.mesh.setMatrixAt(count, this.matrix); this.mesh.setColorAt(count++, this.colors[segment.state] || this.colors.initial);
    }
    this.mesh.count = count; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  snapshot() {
    return { enabled: this.enabled, segments: this.mesh.count, shots: this.shots.map(shot => ({ shotId: shot.shotId, life: shot.life,
      states: shot.segments.map(segment => segment.state) })) };
  }
  reset() { this.shots = []; this.mesh.count = 0; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
