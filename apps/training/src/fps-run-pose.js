import { AnimationMixer, Vector3, Quaternion } from 'three';

// Reuse the supplied AK Run clip, detached from the rendered driver. Sampling
// cannot overwrite reload bones or add its authored head/camera animation.
export function createRunPose(gltf) {
  const pack = gltf.scene.clone(true);
  const meshes = []; pack.traverse(n => { if (n.isMesh) meshes.push(n); });
  for (const mesh of meshes) mesh.removeFromParent();
  pack.updateMatrixWorld(true);
  const rifle = pack.getObjectByName('Rif_059'), head = pack.getObjectByName('Head_Cam_014');
  const restRifleInverse = rifle.matrixWorld.clone().invert(), restHead = head.matrixWorld.clone();
  const clip = gltf.animations.find(c => c.name.endsWith('AK_Run'));
  const mixer = new AnimationMixer(pack), action = mixer.clipAction(clip); action.play();
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  function sample(phase) {
    action.time = ((phase % 1) + 1) % 1 * clip.duration;
    mixer.update(0); pack.updateMatrixWorld(true);
    const frame = restHead.clone().multiply(head.matrixWorld.clone().invert()).multiply(rifle.matrixWorld).multiply(restRifleInverse);
    frame.decompose(position, rotation, scale);
    return { position: position.clone(), quaternion: rotation.clone().normalize() };
  }
  const origin = sample(0).position;
  return { sourceClip: clip.name, duration: clip.duration,
    sample(phase) { const pose = sample(phase); pose.position.sub(origin); return pose; } };
}
